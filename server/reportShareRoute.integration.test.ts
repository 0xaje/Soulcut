import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { registerReportShareRoute } from "./reportShareRoute";

const servers: Server[] = [];

async function startShareServer() {
  const app = express();
  registerReportShareRoute(app, {
    getShareByToken: async token => token === "valid_share_token_1234567890" ? { storageKey: "report-shares/report.pdf", expiresAt: null, revokedAt: null } : undefined,
    getReportUrl: async key => ({ url: `/manus-storage/${key}` }),
  });
  const server = createServer(app);
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Share test server did not bind.");
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

describe("PDF report share links", () => {
  it("redirects a valid opaque token to its stored report without requiring authentication", async () => {
    const url = await startShareServer();
    const response = await fetch(`${url}/share/report/valid_share_token_1234567890`, { redirect: "manual" });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/manus-storage/report-shares/report.pdf");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("does not disclose records for invalid or malformed tokens", async () => {
    const url = await startShareServer();
    const unknown = await fetch(`${url}/share/report/unknown_share_token_1234567890`);
    const malformed = await fetch(`${url}/share/report/short`);
    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(404);
  });

  it("rejects expired and revoked report links without revealing stored report details", async () => {
    const app = express();
    registerReportShareRoute(app, {
      getShareByToken: async token => token === "expired_share_token_1234567890" ? { storageKey: "hidden.pdf", expiresAt: new Date(Date.now() - 1), revokedAt: null } : { storageKey: "hidden.pdf", expiresAt: null, revokedAt: new Date() },
      getReportUrl: async key => ({ url: `/manus-storage/${key}` }),
    });
    const server = createServer(app);
    servers.push(server);
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve()); });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Share test server did not bind.");
    const url = `http://127.0.0.1:${address.port}`;
    expect((await fetch(`${url}/share/report/expired_share_token_1234567890`)).status).toBe(404);
    expect((await fetch(`${url}/share/report/revoked_share_token_1234567890`)).status).toBe(404);
  });
});
