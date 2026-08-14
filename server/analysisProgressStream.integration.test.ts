import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { registerAnalysisProgressStream } from "./analysisProgressStream";

const servers: Server[] = [];

async function startTestServer() {
  const app = express();
  let readCount = 0;
  registerAnalysisProgressStream(app, {
    authenticateRequest: async req =>
      req.headers.authorization === "Bearer integration-token" ? { id: 42 } : null,
    getJobForUser: async (jobId, userId) =>
      jobId === "job-stream" && userId === 42 ? { status: "processing" } : undefined,
    listProgressEvents: async ({ afterId }) => {
      readCount += 1;
      if (!afterId) {
        return [{
          id: 1,
          stage: "reading",
          message: "Reading accessible video context and metadata.",
          createdAt: new Date("2026-08-14T03:40:00.000Z"),
        }];
      }
      return [{
        id: 2,
        stage: "complete",
        message: "Your video brief is ready.",
        createdAt: new Date("2026-08-14T03:40:01.000Z"),
      }];
    },
    pollIntervalMs: 5,
    heartbeatIntervalMs: 1000,
  });

  const server = createServer(app);
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port.");

  return { url: `http://127.0.0.1:${address.port}`, getReadCount: () => readCount };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

describe("analysis progress stream integration", () => {
  it("streams ordered, authenticated stage updates over an HTTP SSE response and closes on completion", async () => {
    const { url, getReadCount } = await startTestServer();

    const response = await fetch(`${url}/api/video-jobs/job-stream/progress`, {
      headers: { Authorization: "Bearer integration-token" },
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain('"id":1');
    expect(body).toContain('"stage":"reading"');
    expect(body).toContain('"id":2');
    expect(body).toContain('"stage":"complete"');
    expect(body.indexOf('"id":1')).toBeLessThan(body.indexOf('"id":2'));
    expect(getReadCount()).toBeGreaterThanOrEqual(2);
  });

  it("rejects a stream request without the authenticated session contract", async () => {
    const { url } = await startTestServer();

    const response = await fetch(`${url}/api/video-jobs/job-stream/progress`);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication is required." });
  });
});
