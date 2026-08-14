import type { Express, Request, Response } from "express";
import type { VideoJobProgressStage } from "../drizzle/schema";
import {
  getVideoJobForUser,
  listVideoJobProgressEventsForUser,
} from "../server/db";
import { sdk } from "./_core/sdk";

type ProgressPayload = {
  id: number;
  stage: VideoJobProgressStage;
  message: string;
  createdAt: Date | string;
};

const terminalStages = new Set<VideoJobProgressStage>(["complete", "failed"]);

export function formatProgressSse(payload: ProgressPayload): string {
  return `event: progress\ndata: ${JSON.stringify(payload)}\n\n`;
}

function writeSnapshot(res: Response, stage: VideoJobProgressStage, message: string) {
  res.write(
    formatProgressSse({
      id: 0,
      stage,
      message,
      createdAt: new Date(),
    })
  );
}

export function registerAnalysisProgressStream(app: Express) {
  app.get("/api/video-jobs/:id/progress", async (req: Request, res: Response) => {
    const jobId = req.params.id;
    if (!jobId || jobId.length > 32) {
      res.status(400).json({ error: "Invalid video job." });
      return;
    }

    const user = await sdk.authenticateRequest(req).catch(() => null);
    if (!user) {
      res.status(401).json({ error: "Authentication is required." });
      return;
    }

    const job = await getVideoJobForUser(jobId, user.id);
    if (!job) {
      res.status(404).json({ error: "Video job not found." });
      return;
    }

    res.status(200).set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();

    let lastEventId = 0;
    let closed = false;

    const close = () => {
      closed = true;
      clearInterval(pollTimer);
      clearInterval(heartbeatTimer);
    };

    const emitAvailableEvents = async () => {
      if (closed || res.writableEnded) return;
      const events = await listVideoJobProgressEventsForUser({
        jobId,
        userId: user.id,
        afterId: lastEventId,
      });
      for (const event of events) {
        lastEventId = event.id;
        res.write(formatProgressSse(event));
        if (terminalStages.has(event.stage)) {
          res.end();
          close();
          return;
        }
      }

      if (lastEventId === 0) {
        const stage: VideoJobProgressStage = job.status === "failed" ? "failed" : job.status === "done" ? "complete" : "queued";
        const message = stage === "complete" ? "Your video brief is ready." : stage === "failed" ? "The analysis could not be completed." : "Analysis queued. Preparing the source.";
        writeSnapshot(res, stage, message);
        if (terminalStages.has(stage)) {
          res.end();
          close();
        }
      }
    };

    const pollTimer = setInterval(() => {
      void emitAvailableEvents().catch(() => {
        if (!res.writableEnded) res.end();
        close();
      });
    }, 1200);
    const heartbeatTimer = setInterval(() => {
      if (!closed && !res.writableEnded) res.write(": keep-alive\n\n");
    }, 15_000);

    req.on("close", close);
    await emitAvailableEvents().catch(() => {
      if (!res.writableEnded) res.end();
      close();
    });
  });
}
