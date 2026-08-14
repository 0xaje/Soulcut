import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerScheduledWorkerRoutes } from "./scheduledWorkers";

const servers: Server[] = [];

async function startScheduledWorkerServer(isCron: boolean) {
  const app = express();
  const processNextAnalysisJob = vi.fn().mockResolvedValue({ processed: true, status: "done" });
  const cleanupStalePdfReportShares = vi.fn().mockResolvedValue(3);
  registerScheduledWorkerRoutes(app, {
    authenticateRequest: async () => isCron ? { isCron: true, taskUid: "task-123" } : null,
    processNextAnalysisJob,
    cleanupStalePdfReportShares,
  });
  const server = createServer(app);
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port.");
  return { url: `http://127.0.0.1:${address.port}`, processNextAnalysisJob, cleanupStalePdfReportShares };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

describe("scheduled worker routes", () => {
  it("rejects non-cron requests before queue or cleanup work can run", async () => {
    const { url, processNextAnalysisJob, cleanupStalePdfReportShares } = await startScheduledWorkerServer(false);

    const [workerResponse, cleanupResponse] = await Promise.all([
      fetch(`${url}/api/scheduled/analysis-worker`, { method: "POST" }),
      fetch(`${url}/api/scheduled/report-cleanup`, { method: "POST" }),
    ]);

    expect(workerResponse.status).toBe(403);
    expect(cleanupResponse.status).toBe(403);
    expect(processNextAnalysisJob).not.toHaveBeenCalled();
    expect(cleanupStalePdfReportShares).not.toHaveBeenCalled();
  });

  it("runs exactly the requested scheduled task for an authenticated cron invocation", async () => {
    const { url, processNextAnalysisJob, cleanupStalePdfReportShares } = await startScheduledWorkerServer(true);

    const workerResponse = await fetch(`${url}/api/scheduled/analysis-worker`, { method: "POST" });
    const cleanupResponse = await fetch(`${url}/api/scheduled/report-cleanup`, { method: "POST" });

    await expect(workerResponse.json()).resolves.toEqual({ processed: true, status: "done" });
    await expect(cleanupResponse.json()).resolves.toEqual({ removedShareRecords: 3 });
    expect(processNextAnalysisJob).toHaveBeenCalledTimes(1);
    expect(cleanupStalePdfReportShares).toHaveBeenCalledTimes(1);
  });
});
