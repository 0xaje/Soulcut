import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  createFeedbackEventForUser: vi.fn(),
  ensureCreativeMindForUser: vi.fn(),
  getFeedbackSignalSummaryForUser: vi.fn(),
  getCreativeMindForUser: vi.fn(),
  getMindStatsForUser: vi.fn(),
  getVideoJobForUser: vi.fn(),
  listRecommendationComparisonForUser: vi.fn(),
  listMemoryEvidenceForUser: vi.fn(),
  listMindActivityForUser: vi.fn(),
  listMindMemoriesForUser: vi.fn(),
  markCreativeMindOnboarded: vi.fn(),
  setMindMemoryRetirementForUser: vi.fn(),
  updateMindMemoryForUser: vi.fn(),
  upsertMindMemoryForUser: vi.fn(),
  resetCreativeMindForUser: vi.fn(),
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
    dbMocks.getFeedbackSignalSummaryForUser.mockResolvedValue({ keepCount: 0, notMyStyleCount: 0, totalCount: 0 });
    dbMocks.markCreativeMindOnboarded.mockResolvedValue({ id: "mind-7", userId: 7, onboardedAt: new Date() });
    dbMocks.updateMindMemoryForUser.mockResolvedValue({ id: 12, value: "Use concise hooks" });
    dbMocks.setMindMemoryRetirementForUser.mockResolvedValue({ id: 12, value: "Use concise hooks" });
    dbMocks.listRecommendationComparisonForUser.mockResolvedValue([]);
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

  it("refines only the caller’s active preference through the owner-scoped persistence helper", async () => {
    const caller = mindRouter.createCaller(context);
    await expect(caller.updatePreference({ memoryId: 12, value: "Use concise, question-first hooks." })).resolves.toMatchObject({ message: "Your Mind preference was refined." });
    expect(dbMocks.updateMindMemoryForUser).toHaveBeenCalledWith({ userId: 7, memoryId: 12, value: "Use concise, question-first hooks." });
  });

  it("retires and restores only the caller’s preference through the lifecycle helper", async () => {
    const caller = mindRouter.createCaller(context);
    await caller.retirePreference({ memoryId: 12, reason: "No longer relevant" });
    await caller.restorePreference({ memoryId: 12 });
    expect(dbMocks.setMindMemoryRetirementForUser).toHaveBeenNthCalledWith(1, { userId: 7, memoryId: 12, retired: true, reason: "No longer relevant" });
    expect(dbMocks.setMindMemoryRetirementForUser).toHaveBeenNthCalledWith(2, { userId: 7, memoryId: 12, retired: false });
  });

  it("returns comparison rows only via the authenticated caller’s owner-scoped helper", async () => {
    dbMocks.listRecommendationComparisonForUser.mockResolvedValue([{ jobId: "owned-job" }]);
    const caller = mindRouter.createCaller(context);
    await expect(caller.getRecommendationComparison()).resolves.toEqual([{ jobId: "owned-job" }]);
    expect(dbMocks.listRecommendationComparisonForUser).toHaveBeenCalledWith(7);
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
      evidence: expect.objectContaining({ source: "feedback", sourceReference: "feedback:1:job:job-owned", weight: 3 }),
      activity: expect.objectContaining({ type: "updated" }),
    }));
    expect(result.message).toContain("updated your Creative DNA");
  });

  it("persists a detailed correction and learns from its free-form content", async () => {
    dbMocks.getVideoJobForUser.mockResolvedValue({ id: "job-owned", clips: [] });
    const caller = mindRouter.createCaller(context);

    await caller.submitFeedback({
      jobId: "job-owned",
      recommendationId: "clip-1",
      feedbackType: "not_my_style",
      reason: "other",
      feedbackText: "Make these hooks less clickbaity and more conversational.",
    });

    expect(dbMocks.createFeedbackEventForUser).toHaveBeenCalledWith(expect.objectContaining({
      reason: "other",
      feedbackText: "Make these hooks less clickbaity and more conversational.",
    }));
    expect(dbMocks.upsertMindMemoryForUser).toHaveBeenCalledWith(expect.objectContaining({
      category: "hook",
      value: "Make these hooks less clickbaity and more conversational.",
      source: "feedback",
      evidence: expect.objectContaining({ detail: "Make these hooks less clickbaity and more conversational." }),
    }));
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
      { id: 44, value: "Question-first hooks", confidence: 84, evidenceCount: 3, source: "behavioral_pattern" },
    ]);
    const caller = mindRouter.createCaller(context);
    const results = await caller.getPersonalizedRecommendations({ jobId: "job-owned" });

    expect(dbMocks.getVideoJobForUser).toHaveBeenCalledWith("job-owned", 7);
    expect(results[0]?.fit).toEqual([expect.objectContaining({ memoryId: 44, evidenceCount: 3 })]);
    expect(results[0]?.mindConfidence).toBe(84);
    expect(results[0]?.explanation).toEqual(expect.objectContaining({ confidence: 84, evidence: [expect.objectContaining({ source: "behavioral_pattern" })] }));
  });

  it("detects a behavioral hook pattern only after repeated persisted choices for an owned recommendation", async () => {
    dbMocks.getVideoJobForUser.mockResolvedValue({
      id: "job-owned",
      clips: [{ startSeconds: 0, endSeconds: 12, title: "Question opening", hook: "Are you using AI wrong?", reason: "Fast payoff" }],
    });
    dbMocks.createFeedbackEventForUser.mockResolvedValue({ id: 18 });
    dbMocks.getFeedbackSignalSummaryForUser.mockResolvedValue({ keepCount: 2, notMyStyleCount: 0, totalCount: 2 });
    const caller = mindRouter.createCaller(context);

    const result = await caller.submitFeedback({ jobId: "job-owned", recommendationId: "clip-1", feedbackType: "keep" });

    expect(dbMocks.createFeedbackEventForUser).toHaveBeenCalledWith(expect.objectContaining({
      signalCategory: "hook",
      signalKey: "hook-question-first",
      signalValue: "Question-first hooks",
    }));
    expect(dbMocks.getFeedbackSignalSummaryForUser).toHaveBeenCalledWith({ userId: 7, signalKey: "hook-question-first" });
    expect(dbMocks.upsertMindMemoryForUser).toHaveBeenCalledWith(expect.objectContaining({
      source: "behavioral_pattern",
      category: "hook",
      activity: expect.objectContaining({ type: "detected" }),
      evidence: expect.objectContaining({ source: "selection", sourceReference: "feedback:18:signal:hook-question-first" }),
    }));
    expect(result.message).toContain("detected a pattern");
  });

  it("does not invent a fit explanation when stored preferences do not match the recommendation", async () => {
    dbMocks.getVideoJobForUser.mockResolvedValue({
      id: "job-owned",
      clips: [{ startSeconds: 0, endSeconds: 12, title: "Statement opening", hook: "AI is changing everything", reason: "A decisive framing" }],
    });
    dbMocks.listMindMemoriesForUser.mockResolvedValue([
      { id: 91, value: "Question-first hooks", confidence: 88, evidenceCount: 4, source: "behavioral_pattern" },
    ]);
    const caller = mindRouter.createCaller(context);

    const results = await caller.getPersonalizedRecommendations({ jobId: "job-owned" });

    expect(results[0]?.fit).toEqual([]);
    expect(results[0]?.explanation).toEqual(expect.objectContaining({ confidence: 0, evidence: [] }));
  });

  it("resets the creative mind to a clean slate", async () => {
    dbMocks.resetCreativeMindForUser.mockResolvedValue({ success: true, message: "Creative Mind reset to a clean slate." });
    const caller = mindRouter.createCaller(context);

    const result = await caller.resetMind();

    expect(dbMocks.resetCreativeMindForUser).toHaveBeenCalledWith(7);
    expect(result.success).toBe(true);
  });
});
