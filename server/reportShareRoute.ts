import type { Express, Request, Response } from "express";
import { getPdfReportShareByToken } from "./db";
import { storageGet } from "./storage";

type ShareRecord = { storageKey: string; expiresAt: Date | null; revokedAt: Date | null };

type ReportShareDependencies = {
  getShareByToken: (token: string) => Promise<ShareRecord | undefined>;
  getReportUrl: (storageKey: string) => Promise<{ url: string }>;
};

const shareTokenPattern = /^[A-Za-z0-9_-]{24,64}$/;

export function isActiveReportShare(share: ShareRecord, now = new Date()): boolean {
  return !share.revokedAt && (!share.expiresAt || share.expiresAt.getTime() > now.getTime());
}

export function registerReportShareRoute(app: Express, overrides: Partial<ReportShareDependencies> = {}) {
  const dependencies: ReportShareDependencies = {
    getShareByToken: getPdfReportShareByToken,
    getReportUrl: storageGet,
    ...overrides,
  };

  app.get("/share/report/:token", async (req: Request, res: Response) => {
    const token = req.params.token;
    if (!token || !shareTokenPattern.test(token)) {
      res.status(404).send("Report link not found.");
      return;
    }

    try {
      const share = await dependencies.getShareByToken(token);
      if (!share) {
        res.status(404).send("Report link not found.");
        return;
      }
      if (!isActiveReportShare(share)) {
        res.status(404).send("Report link not found.");
        return;
      }
      const { url } = await dependencies.getReportUrl(share.storageKey);
      res.set("Cache-Control", "no-store").redirect(302, url);
    } catch {
      res.status(500).send("Report link is temporarily unavailable.");
    }
  });
}
