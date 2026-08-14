import type { Express, Request, Response } from "express";
import { cleanupStalePdfReportShares } from "./db";
import { processNextAnalysisJob } from "./analysisWorker";
import { sdk } from "./_core/sdk";

type ScheduledWorkerDependencies = {
  authenticateRequest: (req: Request) => Promise<{ isCron?: boolean; taskUid?: string } | null>;
  processNextAnalysisJob: typeof processNextAnalysisJob;
  cleanupStalePdfReportShares: typeof cleanupStalePdfReportShares;
};

async function requireCronRequest(
  req: Request,
  res: Response,
  authenticateRequest: ScheduledWorkerDependencies["authenticateRequest"]
) {
  const user = await authenticateRequest(req).catch(() => null);
  if (!user?.isCron || !user.taskUid) {
    res.status(403).json({ error: "cron-only" });
    return false;
  }
  return true;
}

export function registerScheduledWorkerRoutes(app: Express, overrides: Partial<ScheduledWorkerDependencies> = {}) {
  const dependencies: ScheduledWorkerDependencies = {
    authenticateRequest: req => sdk.authenticateRequest(req).catch(() => null),
    processNextAnalysisJob,
    cleanupStalePdfReportShares,
    ...overrides,
  };

  app.post("/api/scheduled/analysis-worker", async (req, res) => {
    if (!(await requireCronRequest(req, res, dependencies.authenticateRequest))) return;
    try {
      res.json(await dependencies.processNextAnalysisJob());
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Worker execution failed." });
    }
  });

  app.post("/api/scheduled/report-cleanup", async (req, res) => {
    if (!(await requireCronRequest(req, res, dependencies.authenticateRequest))) return;
    try {
      res.json({ removedShareRecords: await dependencies.cleanupStalePdfReportShares() });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Cleanup execution failed." });
    }
  });
}
