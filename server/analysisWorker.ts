import { nanoid } from "nanoid";
import {
  claimNextVideoJob,
  createVideoJobProgressEvent,
  isVideoJobCancelled,
  updateClaimedVideoJob,
} from "./db";
import { getCreativeMindAnalysisContextForUser } from "./mindAnalysisContext";
import { analyzeVideoUrl } from "./videoAnalysis";

export function retryDelayMs(attemptCount: number): number {
  return Math.min(15 * 60_000, 30_000 * 2 ** Math.max(0, attemptCount - 1));
}

export async function processNextAnalysisJob() {
  const workerToken = nanoid(32);
  const job = await claimNextVideoJob(workerToken);
  if (!job) return { processed: false as const };

  const cancelled = async () => isVideoJobCancelled(job.id);
  const addEvent = (stage: "reading" | "analyzing" | "clips" | "retrying" | "complete" | "failed", message: string) =>
    createVideoJobProgressEvent({ jobId: job.id, userId: job.userId, stage, message });

  try {
    if (await cancelled()) return { processed: true as const, status: "cancelled" as const };
    await addEvent("reading", "Worker claimed the job and is reading accessible video context.");
    const mindContext = await getCreativeMindAnalysisContextForUser(job.userId);
    await addEvent("analyzing", mindContext ? "Distilling the story through your Creative Mind preferences." : "Distilling the core story and key topics.");
    const analysis = await analyzeVideoUrl(job.videoUrl, mindContext);
    if (await cancelled()) return { processed: true as const, status: "cancelled" as const };
    await addEvent("clips", "Shaping grounded short-form clip recommendations.");
    const completed = await updateClaimedVideoJob(job.id, workerToken, {
      status: "done",
      summary: analysis.summary,
      topics: analysis.topics,
      clips: analysis.clips,
      sourceNote: analysis.sourceNote,
      model: "gpt-5-mini",
      completedAt: new Date(),
      workerToken: null,
      workerClaimedAt: null,
      nextAttemptAt: null,
    });
    if (!completed || await cancelled()) return { processed: true as const, status: "cancelled" as const };
    await addEvent("complete", "Your video brief is ready.");
    return { processed: true as const, status: "done" as const };
  } catch (error) {
    if (await cancelled()) return { processed: true as const, status: "cancelled" as const };
    const message = error instanceof Error ? error.message : "Analysis failed unexpectedly.";
    if (job.attemptCount >= job.maxAttempts) {
      const failed = await updateClaimedVideoJob(job.id, workerToken, {
        status: "failed",
        failureReason: message.slice(0, 1800),
        completedAt: new Date(),
        workerToken: null,
        workerClaimedAt: null,
      });
      if (!failed || await cancelled()) return { processed: true as const, status: "cancelled" as const };
      await addEvent("failed", "The analysis could not be completed after the allowed retries.");
      return { processed: true as const, status: "failed" as const };
    }

    const nextAttemptAt = new Date(Date.now() + retryDelayMs(job.attemptCount));
    const retrying = await updateClaimedVideoJob(job.id, workerToken, {
      status: "retrying",
      failureReason: message.slice(0, 1800),
      nextAttemptAt,
      workerToken: null,
      workerClaimedAt: null,
    });
    if (!retrying || await cancelled()) return { processed: true as const, status: "cancelled" as const };
    await addEvent("retrying", `Retry ${job.attemptCount + 1} is scheduled after a short backoff.`);
    return { processed: true as const, status: "retrying" as const, nextAttemptAt };
  }
}
