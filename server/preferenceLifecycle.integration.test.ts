import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { afterEach, describe, expect, it } from "vitest";
import { users } from "../drizzle/schema";
import { getDb, listMindMemoriesForUser, setMindMemoryRetirementForUser, upsertMindMemoryForUser } from "./db";
import { getCreativeMindAnalysisContextForUser } from "./mindAnalysisContext";

const cleanupOpenIds: string[] = [];

afterEach(async () => {
  const db = await getDb();
  if (!db) return;
  await Promise.all(cleanupOpenIds.splice(0).map(openId => db.delete(users).where(eq(users.openId, openId))));
});

describe("preference lifecycle persistence", () => {
  it.runIf(Boolean(process.env.DATABASE_URL))("keeps a retired preference auditable while excluding it from future bounded analysis context until restored", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database is required for preference lifecycle coverage.");
    const openId = `retired-preference-owner-${nanoid(12)}`;
    cleanupOpenIds.push(openId);
    await db.insert(users).values({ openId, loginMethod: "test" });
    const owner = (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
    if (!owner) throw new Error("Test user could not be created.");

    const memory = await upsertMindMemoryForUser({
      userId: owner.id,
      category: "hook",
      memoryKey: "question-first-hooks",
      value: "Question-first hooks",
      confidence: 86,
      source: "explicit_creator_instruction",
      evidence: { source: "teaching", detail: "Creator taught question-first hooks.", weight: 4 },
      activity: { type: "learned", message: "Learned: Question-first hooks" },
    });
    await setMindMemoryRetirementForUser({ userId: owner.id, memoryId: memory.id, retired: true, reason: "Changing creative direction" });

    expect(await listMindMemoriesForUser(owner.id)).toEqual([]);
    expect(await listMindMemoriesForUser(owner.id, { includeRetired: true })).toEqual(expect.arrayContaining([expect.objectContaining({ id: memory.id, retiredAt: expect.any(Date), retirementReason: "Changing creative direction" })]));
    expect(await getCreativeMindAnalysisContextForUser(owner.id)).toBeNull();

    await setMindMemoryRetirementForUser({ userId: owner.id, memoryId: memory.id, retired: false });
    expect(await getCreativeMindAnalysisContextForUser(owner.id)).toEqual(expect.objectContaining({ preferences: [expect.objectContaining({ value: "Question-first hooks" })] }));
  });
});
