import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { afterEach, describe, expect, it } from "vitest";
import { users } from "../drizzle/schema";
import { createFeedbackEventForUser, createVideoJob, getDb, listRecommendationComparisonForUser, updateVideoJobForUser } from "./db";

const cleanupOpenIds: string[] = [];

afterEach(async () => {
  const db = await getDb();
  if (!db) return;
  await Promise.all(cleanupOpenIds.splice(0).map(openId => db.delete(users).where(eq(users.openId, openId))));
});

describe("recommendation comparison persistence", () => {
  it.runIf(Boolean(process.env.DATABASE_URL))("returns only the owner’s saved analysis snapshots, clip counts, and explicit feedback totals in chronological order", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database is required for recommendation comparison coverage.");
    const ownerOpenId = `comparison-owner-${nanoid(12)}`;
    const otherOpenId = `comparison-other-${nanoid(12)}`;
    cleanupOpenIds.push(ownerOpenId, otherOpenId);
    await db.insert(users).values([{ openId: ownerOpenId, loginMethod: "test" }, { openId: otherOpenId, loginMethod: "test" }]);
    const owner = (await db.select().from(users).where(eq(users.openId, ownerOpenId)).limit(1))[0];
    const other = (await db.select().from(users).where(eq(users.openId, otherOpenId)).limit(1))[0];
    if (!owner || !other) throw new Error("Comparison test users could not be created.");

    const firstJobId = `comparison-first-${nanoid(8)}`;
    const secondJobId = `comparison-second-${nanoid(8)}`;
    const otherJobId = `comparison-other-${nanoid(8)}`;
    await createVideoJob({ id: firstJobId, userId: owner.id, videoUrl: "https://video.example/first" });
    await createVideoJob({ id: secondJobId, userId: owner.id, videoUrl: "https://video.example/second", transcriptFormat: "vtt", transcriptStorageKey: "test/private.vtt", transcriptCharacterCount: 120 });
    await createVideoJob({ id: otherJobId, userId: other.id, videoUrl: "https://video.example/other" });
    await updateVideoJobForUser(firstJobId, owner.id, { status: "done", clips: [{ startSeconds: 1, endSeconds: 8, title: "First", hook: "Question", reason: "Signal" }], mindContextSnapshot: { preferences: [{ category: "hook", value: "Question-first hooks", confidence: 84, evidenceCount: 3 }] } });
    await updateVideoJobForUser(secondJobId, owner.id, { status: "done", clips: [{ startSeconds: 1, endSeconds: 8, title: "Second", hook: "Question", reason: "Signal" }, { startSeconds: 9, endSeconds: 16, title: "Second two", hook: "Payoff", reason: "Signal" }], mindContextSnapshot: { preferences: [{ category: "hook", value: "Question-first hooks", confidence: 84, evidenceCount: 3 }, { category: "pacing", value: "Fast openings", confidence: 80, evidenceCount: 2 }] } });
    await updateVideoJobForUser(otherJobId, other.id, { status: "done", clips: [{ startSeconds: 1, endSeconds: 8, title: "Other", hook: "Other", reason: "Other" }], mindContextSnapshot: { preferences: [{ category: "tone", value: "Other creator", confidence: 88, evidenceCount: 3 }] } });
    await createFeedbackEventForUser({ userId: owner.id, jobId: secondJobId, recommendationId: "clip-1", feedbackType: "keep" });
    await createFeedbackEventForUser({ userId: owner.id, jobId: secondJobId, recommendationId: "clip-2", feedbackType: "not_my_style", reason: "too_slow" });

    const comparison = await listRecommendationComparisonForUser(owner.id);
    expect(comparison).toHaveLength(2);
    expect(comparison.map(item => item.jobId)).toEqual([firstJobId, secondJobId]);
    expect(comparison[0]).toMatchObject({ appliedPreferenceCount: 1, clipCount: 1, keptCount: 0, correctedCount: 0 });
    expect(comparison[1]).toMatchObject({ transcriptFormat: "vtt", appliedPreferenceCount: 2, clipCount: 2, keptCount: 1, correctedCount: 1 });
    expect(comparison.flatMap(item => item.appliedPreferences.map(preference => preference.value))).not.toContain("Other creator");
  });
});
