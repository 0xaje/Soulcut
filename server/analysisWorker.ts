import { nanoid } from "nanoid";
import {
  claimNextVideoJob,
  createVideoJobProgressEvent,
  isVideoJobCancelled,
  updateClaimedVideoJob,
} from "./db";
import { getCreativeMindAnalysisContextForUser } from "./mindAnalysisContext";
import { storageGetSignedUrl } from "./storage";
import { parseCreatorTranscript, type ParsedTranscript } from "./transcriptIngestion";
import { analyzeVideoUrl } from "./videoAnalysis";

async function loadJobTranscript(job: { transcriptStorageKey?: string | null; transcriptFormat?: "txt" | "srt" | "vtt" | null }): Promise<ParsedTranscript | null> {
  if (!job.transcriptStorageKey || !job.transcriptFormat) return null;
  const response = await fetch(await storageGetSignedUrl(job.transcriptStorageKey));
  if (!response.ok) throw new Error("Imported transcript could not be loaded for analysis.");
  return parseCreatorTranscript({
    filename: `transcript.${job.transcriptFormat}`,
    mimeType: job.transcriptFormat === "vtt" ? "text/vtt" : job.transcriptFormat === "srt" ? "application/x-subrip" : "text/plain",
    bytes: Buffer.from(await response.arrayBuffer()),
  });
}

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
    const transcript = await loadJobTranscript(job);
    if (transcript) await addEvent("reading", `Imported ${transcript.format.toUpperCase()} transcript loaded with ${transcript.characterCount.toLocaleString()} characters.`);
    await addEvent("analyzing", mindContext ? "Distilling the story through your Creative Mind preferences." : "Distilling the core story and key topics.");
    const analysis = transcript ? await analyzeVideoUrl(job.videoUrl, mindContext, transcript) : await analyzeVideoUrl(job.videoUrl, mindContext);
    if (await cancelled()) return { processed: true as const, status: "cancelled" as const };
    const contextApplied = await updateClaimedVideoJob(job.id, workerToken, { mindContextSnapshot: mindContext });
    if (!contextApplied || await cancelled()) return { processed: true as const, status: "cancelled" as const };
    await addEvent("clips", "Shaping grounded short-form clip recommendations.");
    const model = process.env.LLM_MODEL || "llama-3.3-70b-versatile";
    const completed = await updateClaimedVideoJob(job.id, workerToken, {
      status: "done",
      summary: analysis.summary,
      topics: analysis.topics,
      clips: analysis.clips,
      sourceNote: analysis.sourceNote,
      model,
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
