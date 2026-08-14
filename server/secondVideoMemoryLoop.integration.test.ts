import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { afterEach, describe, expect, it } from "vitest";
import { users } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { createVideoJob, getDb, getVideoJobForUser, updateVideoJobForUser, upsertMindMemoryForUser } from "./db";
import { getCreativeMindAnalysisContextForUser } from "./mindAnalysisContext";
import { mindRouter } from "./routers/mind";

const cleanupOpenIds: string[] = [];

afterEach(async () => {
  const db = await getDb();
  if (!db) return;
  await Promise.all(cleanupOpenIds.splice(0).map(openId => db.delete(users).where(eq(users.openId, openId))));
});

describe("second-video Mind memory loop", () => {
  it.runIf(Boolean(process.env.DATABASE_URL))("carries a persisted creator preference into the next job context, result snapshot, and grounded explanation", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database is required for the second-video memory-loop test.");
    const openId = `second-video-owner-${nanoid(12)}`;
    cleanupOpenIds.push(openId);
    await db.insert(users).values({ openId, loginMethod: "test" });
    const owner = (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
    if (!owner) throw new Error("Test user could not be created.");

    await upsertMindMemoryForUser({
      userId: owner.id,
      category: "hook",
      memoryKey: "question-first-hooks",
      value: "Question-first hooks",
      confidence: 86,
      source: "explicit_creator_instruction",
      evidence: { source: "teaching", detail: "Creator prefers question-first hooks.", weight: 4 },
      activity: { type: "learned", message: "Learned: Question-first hooks" },
    });
    const context = await getCreativeMindAnalysisContextForUser(owner.id);
    expect(context?.preferences).toEqual(expect.arrayContaining([expect.objectContaining({ value: "Question-first hooks", confidence: 86 })]));

    const jobId = `second-video-${nanoid(12)}`;
    await createVideoJob({ id: jobId, userId: owner.id, videoUrl: "https://video.example/second-video" });
    await updateVideoJobForUser(jobId, owner.id, {
      status: "done",
      summary: "A second video brief.",
      topics: ["workflow"],
      clips: [{ startSeconds: 4, endSeconds: 18, title: "Question opening", hook: "What question is your workflow missing?", reason: "A quick payoff for beginners." }],
      sourceNote: "Grounded in public context.",
      mindContextSnapshot: context,
      completedAt: new Date(),
    });
    const storedJob = await getVideoJobForUser(jobId, owner.id);
    expect(storedJob?.mindContextSnapshot).toEqual(context);

    const caller = mindRouter.createCaller({ user: { id: owner.id }, req: {}, res: {} } as unknown as TrpcContext);
    const recommendations = await caller.getPersonalizedRecommendations({ jobId });
    expect(recommendations[0]?.explanation).toEqual(expect.objectContaining({
      confidence: 86,
      evidence: [expect.objectContaining({ statement: "Question-first hooks", source: "explicit_creator_instruction" })],
    }));
  });
});
