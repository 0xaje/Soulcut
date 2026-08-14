import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { afterEach, describe, expect, it } from "vitest";
import { creativeMinds, memoryEvidence, mindMemories, users } from "../drizzle/schema";
import { createFeedbackEventForUser, getDb, listMemoryEvidenceForUser, listMindActivityForUser, upsertMindMemoryForUser } from "./db";

const cleanupOpenIds: string[] = [];

afterEach(async () => {
  const db = await getDb();
  if (!db) return;
  await Promise.all(cleanupOpenIds.splice(0).map(openId => db.delete(users).where(eq(users.openId, openId))));
});

describe("Mind evidence ownership isolation", () => {
  it.runIf(Boolean(process.env.DATABASE_URL))("does not expose a creator’s memory evidence to another authenticated creator", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database is required for ownership isolation coverage.");
    const ownerOpenId = `mind-owner-${nanoid(12)}`;
    const otherOpenId = `mind-other-${nanoid(12)}`;
    cleanupOpenIds.push(ownerOpenId, otherOpenId);

    await db.insert(users).values([{ openId: ownerOpenId, loginMethod: "test" }, { openId: otherOpenId, loginMethod: "test" }]);
    const owner = (await db.select().from(users).where(eq(users.openId, ownerOpenId)).limit(1))[0];
    const other = (await db.select().from(users).where(eq(users.openId, otherOpenId)).limit(1))[0];
    if (!owner || !other) throw new Error("Test users could not be created.");

    const ownerMindId = nanoid(24);
    const otherMindId = nanoid(24);
    await db.insert(creativeMinds).values([{ id: ownerMindId, userId: owner.id }, { id: otherMindId, userId: other.id }]);
    await db.insert(mindMemories).values({
      mindId: ownerMindId,
      category: "hook",
      memoryKey: "question-first",
      value: "Question-first openings",
      confidence: 84,
      source: "explicit_creator_instruction",
      evidenceCount: 1,
    });
    const memory = (await db.select().from(mindMemories).where(eq(mindMemories.mindId, ownerMindId)).limit(1))[0];
    if (!memory) throw new Error("Test memory could not be created.");
    await db.insert(memoryEvidence).values({ memoryId: memory.id, source: "onboarding", detail: "Owner chose question-first hooks.", weight: 3 });

    const ownerEvidence = await listMemoryEvidenceForUser({ userId: owner.id, memoryId: memory.id });
    const otherEvidence = await listMemoryEvidenceForUser({ userId: other.id, memoryId: memory.id });

    expect(ownerEvidence).toHaveLength(1);
    expect(ownerEvidence[0]?.detail).toBe("Owner chose question-first hooks.");
    expect(otherEvidence).toEqual([]);
  });

  it.runIf(Boolean(process.env.DATABASE_URL))("surfaces feedback evidence and activity only after a real owner-scoped feedback event is persisted", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database is required for feedback persistence coverage.");
    const ownerOpenId = `feedback-owner-${nanoid(12)}`;
    cleanupOpenIds.push(ownerOpenId);
    await db.insert(users).values({ openId: ownerOpenId, loginMethod: "test" });
    const owner = (await db.select().from(users).where(eq(users.openId, ownerOpenId)).limit(1))[0];
    if (!owner) throw new Error("Feedback test user could not be created.");

    const feedback = await createFeedbackEventForUser({
      userId: owner.id,
      recommendationId: "recommendation-1",
      feedbackType: "not_my_style",
      reason: "wrong_tone",
      feedbackText: "Avoid overly formal language.",
    });
    const memory = await upsertMindMemoryForUser({
      userId: owner.id,
      category: "tone",
      memoryKey: "avoid-overly-formal-language",
      value: "Avoid overly formal language.",
      confidence: 78,
      source: "feedback",
      evidence: { source: "feedback", sourceReference: `feedback:${feedback.id}`, detail: "Avoid overly formal language.", weight: 3 },
      activity: { type: "updated", message: "Updated: Avoid overly formal language." },
    });

    const [evidence, activity] = await Promise.all([
      listMemoryEvidenceForUser({ userId: owner.id, memoryId: memory.id }),
      listMindActivityForUser(owner.id),
    ]);
    expect(evidence).toEqual([expect.objectContaining({ source: "feedback", sourceReference: `feedback:${feedback.id}`, detail: "Avoid overly formal language." })]);
    expect(activity).toEqual(expect.arrayContaining([expect.objectContaining({ userId: owner.id, memoryId: memory.id, activityType: "updated", message: "Updated: Avoid overly formal language." })]));
  });
});
