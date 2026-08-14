import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  createFeedbackEventForUser: vi.fn(),
  ensureCreativeMindForUser: vi.fn(),
  getCreativeMindForUser: vi.fn(),
  getMindStatsForUser: vi.fn(),
  getVideoJobForUser: vi.fn(),
  listMemoryEvidenceForUser: vi.fn(),
  listMindActivityForUser: vi.fn(),
  listMindMemoriesForUser: vi.fn(),
  markCreativeMindOnboarded: vi.fn(),
  upsertMindMemoryForUser: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./mindsBuilder", () => ({ getMindsBuilderConnection: () => ({ availability: "available", humanId: "builder-account", reason: null }) }));

import { mindRouter } from "./routers/mind";

const context = { user: { id: 7 }, req: {}, res: {} } as unknown as TrpcContext;

describe("Mind router", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dbMocks.ensureCreativeMindForUser.mockResolvedValue({ id: "mind-7", userId: 7, name: "SoulCut Creative Director" });
    dbMocks.listMindMemoriesForUser.mockResolvedValue([]);
    dbMocks.getMindStatsForUser.mockResolvedValue({ preferenceCount: 0, feedbackCount: 0, strongPatterns: 0, averageConfidence: 0 });
    dbMocks.upsertMindMemoryForUser.mockResolvedValue({ id: 12, category: "caption", value: "Do not use emojis", confidence: 92, evidenceCount: 1 });
    dbMocks.createFeedbackEventForUser.mockResolvedValue({ id: 1 });
    dbMocks.markCreativeMindOnboarded.mockResolvedValue({ id: "mind-7", userId: 7, onboardedAt: new Date() });
  });

  it("rejects empty onboarding so a Mind cannot be marked ready without an explicit creator signal", async () => {
    const caller = mindRouter.createCaller(context);

    await expect(caller.completeOnboarding({ voice: [], hooks: [], pacing: [] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.upsertMindMemoryForUser).not.toHaveBeenCalled();
    expect(dbMocks.markCreativeMindOnboarded).not.toHaveBeenCalled();
  });

  it("persists an explicit onboarding memory before marking the Mind ready", async () => {
    const caller = mindRouter.createCaller(context);

    await caller.completeOnboarding({ voice: ["Conversational"], hooks: [], pacing: [], audience: "First-time founders" });

    expect(dbMocks.upsertMindMemoryForUser).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      category: "voice",
      source: "explicit_creator_instruction",
      evidence: expect.objectContaining({ source: "onboarding", weight: 3 }),
    }));
    expect(dbMocks.markCreativeMindOnboarded).toHaveBeenCalledWith(7);
  });

  it("turns direct teaching into an explicit, evidence-backed memory request", async () => {
    const caller = mindRouter.createCaller(context);
    const result = await caller.teachMind({ lesson: "Don't use emojis in captions." });

    expect(dbMocks.upsertMindMemoryForUser).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      category: "caption",
      source: "explicit_creator_instruction",
      evidence: expect.objectContaining({ source: "teaching", weight: 4 }),
    }));
    expect(result.message).toContain("Your Mind learned");
  });

  it("checks video-job ownership before recording recommendation feedback", async () => {
    dbMocks.getVideoJobForUser.mockResolvedValue(undefined);
    const caller = mindRouter.createCaller(context);

    await expect(caller.submitFeedback({ jobId: "other-user-job", feedbackType: "not_my_style", reason: "wrong_tone" }))
      .rejects.toThrow("Video job not found.");
    expect(dbMocks.createFeedbackEventForUser).not.toHaveBeenCalled();
  });

  it("persists creator feedback and updates the same user’s Creative DNA through an evidence-backed memory", async () => {
    dbMocks.getVideoJobForUser.mockResolvedValue({ id: "job-owned" });
    const caller = mindRouter.createCaller(context);

    const result = await caller.submitFeedback({ jobId: "job-owned", recommendationId: "clip-1", feedbackType: "not_my_style", reason: "wrong_tone" });

    expect(dbMocks.createFeedbackEventForUser).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      jobId: "job-owned",
      recommendationId: "clip-1",
      feedbackType: "not_my_style",
      reason: "wrong_tone",
    }));
    expect(dbMocks.upsertMindMemoryForUser).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      category: "tone",
      source: "feedback",
      evidence: expect.objectContaining({ source: "feedback", sourceReference: "job-owned", weight: 3 }),
      activity: expect.objectContaining({ type: "updated" }),
    }));
    expect(result.message).toContain("updated your Creative DNA");
  });

  it("returns preference evidence only through the requesting user’s owner-scoped helper", async () => {
    dbMocks.listMemoryEvidenceForUser.mockResolvedValue([{ id: 6, memoryId: 12, detail: "Creator chose a question-led opening.", source: "onboarding", weight: 3 }]);
    const caller = mindRouter.createCaller(context);

    await expect(caller.getPreferenceEvidence({ memoryId: 12 })).resolves.toHaveLength(1);
    expect(dbMocks.listMemoryEvidenceForUser).toHaveBeenCalledWith({ userId: 7, memoryId: 12 });

    dbMocks.listMemoryEvidenceForUser.mockResolvedValue([]);
    await expect(caller.getPreferenceEvidence({ memoryId: 999 })).resolves.toEqual([]);
    expect(dbMocks.listMemoryEvidenceForUser).toHaveBeenLastCalledWith({ userId: 7, memoryId: 999 });
  });

  it("grounds personalized recommendation fit in stored Mind memories", async () => {
    dbMocks.getVideoJobForUser.mockResolvedValue({
      id: "job-owned",
      clips: [{ startSeconds: 0, endSeconds: 12, title: "Question opening", hook: "A question for beginners", reason: "Fast payoff" }],
    });
    dbMocks.listMindMemoriesForUser.mockResolvedValue([
      { id: 44, value: "Question-first hooks", confidence: 84, evidenceCount: 3 },
    ]);
    const caller = mindRouter.createCaller(context);
    const results = await caller.getPersonalizedRecommendations({ jobId: "job-owned" });

    expect(dbMocks.getVideoJobForUser).toHaveBeenCalledWith("job-owned", 7);
    expect(results[0]?.fit).toEqual([expect.objectContaining({ memoryId: 44, evidenceCount: 3 })]);
    expect(results[0]?.mindConfidence).toBe(84);
  });
});
