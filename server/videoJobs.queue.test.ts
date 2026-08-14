import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  archiveVideoJobForUser: vi.fn(),
  cancelVideoJobForUser: vi.fn(),
  consumeAnalysisQuota: vi.fn(),
  consumeRateLimit: vi.fn(),
  createVideoJobProgressEvent: vi.fn(),
  createPdfReportShare: vi.fn(),
  createVideoJob: vi.fn(),
  deleteVideoJobForUser: vi.fn(),
  getPdfReportBranding: vi.fn(),
  getVideoJobForUser: vi.fn(),
  listActivePdfReportSharesForUser: vi.fn(),
  listAllVideoJobProgressEventsForUser: vi.fn(),
  listAllVideoJobsForUser: vi.fn(),
  listVideoJobProgressEventsForUser: vi.fn(),
  listVideoJobsForUser: vi.fn(),
  revokePdfReportShareForUser: vi.fn(),
  storageGet: vi.fn(),
  storageGetSignedUrl: vi.fn(),
  storagePut: vi.fn(),
  upsertPdfReportBranding: vi.fn(),
  updateVideoJobForUser: vi.fn(),
}));

vi.mock("./db", () => mocks);
vi.mock("./videoAnalysis", () => ({ isPublicVideoUrl: () => true }));
vi.mock("./storage", () => ({ storageGet: mocks.storageGet, storageGetSignedUrl: mocks.storageGetSignedUrl, storagePut: mocks.storagePut }));

import { appRouter } from "./routers";

const authenticatedContext = {
  user: { id: 42 },
  req: { protocol: "https", headers: {} },
  res: {},
} as unknown as TrpcContext;

describe("queued video-job admission", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.consumeRateLimit.mockResolvedValue(true);
    mocks.consumeAnalysisQuota.mockResolvedValue({ allowed: true, used: 1 });
    mocks.createVideoJobProgressEvent.mockResolvedValue(undefined);
    mocks.storagePut.mockResolvedValue({ key: "transcripts/42/private.vtt", url: "/manus-storage/transcripts/42/private.vtt" });
    mocks.getVideoJobForUser.mockResolvedValue(undefined);
    mocks.createVideoJob.mockImplementation(async (input: { id: string; userId: number; videoUrl: string }) => ({
      ...input,
      status: "pending",
      createdAt: new Date(),
    }));
    mocks.updateVideoJobForUser.mockImplementation(async (id: string, userId: number, changes: Record<string, unknown>) => ({
      id,
      userId,
      status: "pending",
      videoUrl: "https://www.youtube.com/watch?v=public-video",
      ...changes,
    }));
  });

  it("rejects a rate-limited submission before a pending job can be created", async () => {
    mocks.consumeRateLimit.mockResolvedValue(false);
    const caller = appRouter.createCaller(authenticatedContext);

    await expect(caller.videoJobs.create({ videoUrl: "https://www.youtube.com/watch?v=public-video" }))
      .rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

    expect(mocks.createVideoJob).not.toHaveBeenCalled();
    expect(mocks.createVideoJobProgressEvent).not.toHaveBeenCalled();
  });

  it("rejects a quota-exhausted submission before a pending job can be created", async () => {
    mocks.consumeAnalysisQuota.mockResolvedValue({ allowed: false, used: 20 });
    const caller = appRouter.createCaller(authenticatedContext);

    await expect(caller.videoJobs.create({ videoUrl: "https://www.youtube.com/watch?v=public-video" }))
      .rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

    expect(mocks.createVideoJob).not.toHaveBeenCalled();
    expect(mocks.createVideoJobProgressEvent).not.toHaveBeenCalled();
  });

  it("creates a user-owned pending record and records its queue entry after capacity is granted", async () => {
    const caller = appRouter.createCaller(authenticatedContext);

    const job = await caller.videoJobs.create({ videoUrl: "https://www.youtube.com/watch?v=public-video" });

    expect(mocks.consumeRateLimit).toHaveBeenCalledWith({
      userId: 42,
      scope: "analysis-submission",
      maximum: 10,
      windowMinutes: 60,
    });
    expect(mocks.consumeAnalysisQuota).toHaveBeenCalledWith(42, 20);
    expect(mocks.updateVideoJobForUser).toHaveBeenCalledWith(job.id, 42, { startedAt: expect.any(Date) });
    expect(mocks.createVideoJobProgressEvent).toHaveBeenCalledWith({
      jobId: job.id,
      userId: 42,
      stage: "queued",
      message: "Analysis queued. A worker will begin shortly.",
    });
  });

  it("stores a validated creator-provided transcript privately and persists only its provenance on the queued job", async () => {
    const caller = appRouter.createCaller(authenticatedContext);
    const dataUrl = `data:text/vtt;base64,${Buffer.from("WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nWhat is the signal?").toString("base64")}`;

    const job = await caller.videoJobs.createWithTranscript({
      videoUrl: "https://www.youtube.com/watch?v=public-video",
      filename: "creator.vtt",
      mimeType: "text/vtt",
      dataUrl,
    });

    expect(mocks.storagePut).toHaveBeenCalledWith(expect.stringMatching(/^transcripts\/42\//), expect.stringContaining("00:00:01.000 --> 00:00:04.000"), "text/vtt");
    expect(mocks.createVideoJob).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      transcriptStorageKey: "transcripts/42/private.vtt",
      transcriptFormat: "vtt",
      transcriptCharacterCount: expect.any(Number),
    }));
    expect(mocks.createVideoJobProgressEvent).toHaveBeenCalledWith(expect.objectContaining({ jobId: job.id, userId: 42, stage: "queued", message: expect.stringContaining("imported VTT transcript") }));
  });

  it("restores an archived brief only through the authenticated owner-scoped update", async () => {
    mocks.getVideoJobForUser.mockResolvedValue({
      id: "archived-job-123",
      userId: 42,
      status: "done",
      archivedAt: new Date("2026-08-14T00:00:00.000Z"),
    });
    const caller = appRouter.createCaller(authenticatedContext);

    await caller.videoJobs.restore({ id: "archived-job-123" });

    expect(mocks.updateVideoJobForUser).toHaveBeenCalledWith("archived-job-123", 42, { archivedAt: null });
  });
});
