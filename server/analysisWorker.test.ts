import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claimNextVideoJob: vi.fn(),
  createVideoJobProgressEvent: vi.fn(),
  isVideoJobCancelled: vi.fn(),
  updateClaimedVideoJob: vi.fn(),
  analyzeVideoUrl: vi.fn(),
}));

vi.mock("./db", () => ({
  claimNextVideoJob: mocks.claimNextVideoJob,
  createVideoJobProgressEvent: mocks.createVideoJobProgressEvent,
  isVideoJobCancelled: mocks.isVideoJobCancelled,
  updateClaimedVideoJob: mocks.updateClaimedVideoJob,
}));

vi.mock("./videoAnalysis", () => ({ analyzeVideoUrl: mocks.analyzeVideoUrl }));

import { processNextAnalysisJob, retryDelayMs } from "./analysisWorker";

const queuedJob = {
  id: "queued-job-123",
  userId: 42,
  videoUrl: "https://www.youtube.com/watch?v=public-video",
  attemptCount: 1,
  maxAttempts: 3,
};

const analysis = {
  summary: "A concise, grounded brief.",
  topics: ["storytelling"],
  clips: [{ startSeconds: 3, endSeconds: 18, title: "The opening", hook: "Start here", reason: "Fast signal" }],
  sourceNote: "Public source context.",
};

describe("durable analysis worker", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.claimNextVideoJob.mockResolvedValue(queuedJob);
    mocks.createVideoJobProgressEvent.mockResolvedValue(undefined);
    mocks.isVideoJobCancelled.mockResolvedValue(false);
    mocks.updateClaimedVideoJob.mockResolvedValue({ ...queuedJob, status: "done" });
    mocks.analyzeVideoUrl.mockResolvedValue(analysis);
  });

  it("uses capped exponential retry delays", () => {
    expect(retryDelayMs(1)).toBe(30_000);
    expect(retryDelayMs(2)).toBe(60_000);
    expect(retryDelayMs(6)).toBe(15 * 60_000);
  });

  it("claims one queued job, records the stages, and persists a completed analysis", async () => {
    await expect(processNextAnalysisJob()).resolves.toMatchObject({ processed: true, status: "done" });

    expect(mocks.analyzeVideoUrl).toHaveBeenCalledWith(queuedJob.videoUrl);
    expect(mocks.updateClaimedVideoJob).toHaveBeenCalledWith(
      queuedJob.id,
      expect.any(String),
      expect.objectContaining({ status: "done", summary: analysis.summary, nextAttemptAt: null })
    );
    expect(mocks.createVideoJobProgressEvent.mock.calls.map(call => call[0].stage)).toEqual([
      "reading",
      "analyzing",
      "clips",
      "complete",
    ]);
  });

  it("schedules a retry instead of failing on a transient analysis error", async () => {
    mocks.analyzeVideoUrl.mockRejectedValue(new Error("Provider temporarily unavailable"));
    mocks.updateClaimedVideoJob.mockResolvedValue({ ...queuedJob, status: "retrying" });

    await expect(processNextAnalysisJob()).resolves.toMatchObject({ processed: true, status: "retrying" });

    expect(mocks.updateClaimedVideoJob).toHaveBeenCalledWith(
      queuedJob.id,
      expect.any(String),
      expect.objectContaining({ status: "retrying", failureReason: "Provider temporarily unavailable", nextAttemptAt: expect.any(Date) })
    );
    expect(mocks.createVideoJobProgressEvent.mock.calls.at(-1)?.[0]).toMatchObject({ stage: "retrying" });
  });

  it("marks the job failed after the final allowed attempt", async () => {
    mocks.claimNextVideoJob.mockResolvedValue({ ...queuedJob, attemptCount: 3 });
    mocks.analyzeVideoUrl.mockRejectedValue(new Error("Public source is unavailable"));
    mocks.updateClaimedVideoJob.mockResolvedValue({ ...queuedJob, status: "failed" });

    await expect(processNextAnalysisJob()).resolves.toMatchObject({ processed: true, status: "failed" });

    expect(mocks.updateClaimedVideoJob).toHaveBeenCalledWith(
      queuedJob.id,
      expect.any(String),
      expect.objectContaining({ status: "failed", completedAt: expect.any(Date) })
    );
    expect(mocks.createVideoJobProgressEvent.mock.calls.at(-1)?.[0]).toMatchObject({ stage: "failed" });
  });

  it("stops without a completion event when a user cancels while analysis is running", async () => {
    mocks.isVideoJobCancelled.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(processNextAnalysisJob()).resolves.toEqual({ processed: true, status: "cancelled" });

    expect(mocks.updateClaimedVideoJob).not.toHaveBeenCalled();
    expect(mocks.createVideoJobProgressEvent.mock.calls.map(call => call[0].stage)).toEqual(["reading", "analyzing"]);
  });
});
