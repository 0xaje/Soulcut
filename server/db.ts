import { and, asc, desc, eq, gt, gte, isNotNull, isNull, like, lte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import {
  type CreativeMind,
  type MindMemory,
  type MindActivity,
  type MindContextSnapshot,
  type ClipSuggestion,
  type InsertUser,
  type InsertVideoJob,
  type VideoJob,
  type VideoJobProgressStage,
  type User,
  analysisUsage,
  creativeMinds,
  creativePreferences,
  feedbackEvents,
  memoryEvidence,
  mindActivity,
  mindMemories,
  pdfReportBranding,
  pdfReportShares,
  requestRateLimits,
  users,
  videoJobs,
  videoJobProgressEvents,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith("postgres")) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect to MySQL database, falling back to local memory store:", error);
      _db = null;
    }
  }
  return _db;
}

// -------------------------------------------------------------
// In-Memory Fallback Store (Ensures 100% functionality without MySQL)
// -------------------------------------------------------------
const memoryUsers = new Map<number, User>();
const memoryUsersByOpenId = new Map<string, User>();
let nextUserId = 1;

const memoryCreativeMinds = new Map<number, CreativeMind>();
const memoryMindMemories = new Map<number, MindMemory>();
let nextMemoryId = 1;

interface MemoryEvidenceRecord {
  id: number;
  memoryId: number;
  source: string;
  sourceReference: string | null;
  detail: string;
  weight: number;
  confidenceBefore: number | null;
  confidenceAfter: number;
  createdAt: Date;
}
const memoryEvidenceList: MemoryEvidenceRecord[] = [];
let nextEvidenceId = 1;

interface MemoryPreferenceRecord {
  mindId: string;
  memoryId: number;
  category: string;
  label: string;
  confidence: number;
  source: string;
  evidenceCount: number;
  lastUpdatedAt: Date;
  updatedAt: Date;
}
const memoryPreferences = new Map<string, MemoryPreferenceRecord>();

interface MemoryActivityRecord {
  id: number;
  mindId: string;
  userId: number;
  memoryId: number | null;
  activityType: string;
  message: string;
  createdAt: Date;
}
const memoryActivities: MemoryActivityRecord[] = [];
let nextActivityId = 1;

interface MemoryFeedbackRecord {
  id: number;
  mindId: string;
  userId: number;
  jobId: string | null;
  recommendationId: string | null;
  feedbackType: "keep" | "not_my_style" | "teach";
  reason: string | null;
  feedbackText: string | null;
  signalCategory: string | null;
  signalKey: string | null;
  signalValue: string | null;
  createdAt: Date;
}
const memoryFeedbackEvents: MemoryFeedbackRecord[] = [];
let nextFeedbackId = 1;

const memoryVideoJobs = new Map<string, VideoJob>();

interface MemoryProgressRecord {
  id: number;
  jobId: string;
  userId: number;
  stage: VideoJobProgressStage;
  message: string;
  createdAt: Date;
}
const memoryProgressEvents: MemoryProgressRecord[] = [];
let nextProgressId = 1;

const memoryAnalysisUsage = new Map<string, { userId: number; usageDate: Date; analysisCount: number; updatedAt: Date }>();
const memoryRateLimits = new Map<string, { userId: number; scope: string; windowKey: string; requestCount: number; updatedAt: Date }>();

interface MemoryPdfShareRecord {
  token: string;
  jobId: string;
  userId: number;
  storageKey: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}
const memoryPdfShares = new Map<string, MemoryPdfShareRecord>();

interface MemoryBrandingRecord {
  userId: number;
  coverTitle: string;
  logoStorageKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}
const memoryBranding = new Map<number, MemoryBrandingRecord>();

// -------------------------------------------------------------
// Database & In-Memory Operations
// -------------------------------------------------------------

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    let existing = memoryUsersByOpenId.get(user.openId);
    const now = new Date();
    if (!existing) {
      existing = {
        id: nextUserId++,
        openId: user.openId,
        name: user.name ?? null,
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? null,
        role: (user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user")) as "user" | "admin",
        createdAt: now,
        updatedAt: now,
        lastSignedIn: user.lastSignedIn ?? now,
      };
      memoryUsers.set(existing.id, existing);
      memoryUsersByOpenId.set(existing.openId, existing);
    } else {
      if (user.name !== undefined) existing.name = user.name ?? null;
      if (user.email !== undefined) existing.email = user.email ?? null;
      if (user.loginMethod !== undefined) existing.loginMethod = user.loginMethod ?? null;
      if (user.role !== undefined) existing.role = user.role as "user" | "admin";
      existing.lastSignedIn = user.lastSignedIn ?? now;
      existing.updatedAt = now;
    }
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) {
    return memoryUsersByOpenId.get(openId);
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export type MindMemoryCategory = NonNullable<MindMemory["category"]>;
export type MindMemorySource = NonNullable<MindMemory["source"]>;
export type MindEvidenceSource = "onboarding" | "teaching" | "feedback" | "analysis" | "selection";
export type MindActivityType = NonNullable<MindActivity["activityType"]>;

export type FeedbackSignalSummary = {
  keepCount: number;
  notMyStyleCount: number;
  totalCount: number;
};

function clampConfidence(value: number) {
  return Math.max(1, Math.min(100, Math.round(value)));
}

export async function getCreativeMindForUser(userId: number): Promise<CreativeMind | undefined> {
  const db = await getDb();
  if (!db) {
    return memoryCreativeMinds.get(userId);
  }
  const rows = await db.select().from(creativeMinds).where(eq(creativeMinds.userId, userId)).limit(1);
  return rows[0];
}

export async function ensureCreativeMindForUser(userId: number): Promise<CreativeMind> {
  const existing = await getCreativeMindForUser(userId);
  if (existing) return existing;
  const db = await getDb();
  if (!db) {
    const now = new Date();
    const newMind: CreativeMind = {
      id: nanoid(),
      userId,
      name: "SoulCut Creative Director",
      externalMindId: null,
      externalStatus: "not_linked",
      onboardedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    memoryCreativeMinds.set(userId, newMind);
    return newMind;
  }
  try {
    await db.insert(creativeMinds).values({ id: nanoid(), userId });
  } catch (error) {
    const concurrent = await getCreativeMindForUser(userId);
    if (concurrent) return concurrent;
    throw error;
  }
  const created = await getCreativeMindForUser(userId);
  if (!created) throw new Error("Creative Mind could not be created");
  return created;
}

export async function markCreativeMindOnboarded(userId: number): Promise<CreativeMind> {
  const mind = await ensureCreativeMindForUser(userId);
  const db = await getDb();
  if (!db) {
    mind.onboardedAt = new Date();
    mind.updatedAt = new Date();
    return mind;
  }
  await db.update(creativeMinds).set({ onboardedAt: new Date(), updatedAt: new Date() }).where(and(eq(creativeMinds.id, mind.id), eq(creativeMinds.userId, userId)));
  const updated = await getCreativeMindForUser(userId);
  if (!updated) throw new Error("Creative Mind could not be updated");
  return updated;
}

export async function listMindMemoriesForUser(userId: number, options: { includeRetired?: boolean } = {}): Promise<MindMemory[]> {
  const mind = await ensureCreativeMindForUser(userId);
  const db = await getDb();
  if (!db) {
    const memories = Array.from(memoryMindMemories.values()).filter(m => m.mindId === mind.id && (options.includeRetired || !m.retiredAt));
    return memories.sort((a, b) => b.confidence - a.confidence || b.updatedAt.getTime() - a.updatedAt.getTime());
  }
  const conditions = [eq(mindMemories.mindId, mind.id)];
  if (!options.includeRetired) conditions.push(isNull(mindMemories.retiredAt));
  return db.select().from(mindMemories).where(and(...conditions)).orderBy(desc(mindMemories.confidence), desc(mindMemories.updatedAt));
}

export async function upsertMindMemoryForUser(input: {
  userId: number;
  category: MindMemoryCategory;
  memoryKey: string;
  value: string;
  confidence: number;
  source: MindMemorySource;
  evidence: { source: MindEvidenceSource; sourceReference?: string | null; detail: string; weight?: number };
  activity: { type: MindActivityType; message: string };
}): Promise<MindMemory> {
  const mind = await ensureCreativeMindForUser(input.userId);
  const db = await getDb();
  const now = new Date();

  if (!db) {
    const existing = Array.from(memoryMindMemories.values()).find(
      m => m.mindId === mind.id && m.category === input.category && m.memoryKey === input.memoryKey
    );
    const evidenceCount = (existing?.evidenceCount ?? 0) + 1;
    const confidence = existing
      ? clampConfidence(Math.max(existing.confidence, input.confidence) + Math.min(8, Math.max(1, input.evidence.weight ?? 1)))
      : clampConfidence(input.confidence);

    let memory: MindMemory;
    if (existing) {
      existing.value = input.value;
      existing.confidence = confidence;
      existing.source = input.source;
      existing.evidenceCount = evidenceCount;
      existing.lastReinforcedAt = now;
      existing.retiredAt = null;
      existing.retirementReason = null;
      existing.updatedAt = now;
      memory = existing;
    } else {
      memory = {
        id: nextMemoryId++,
        mindId: mind.id,
        category: input.category,
        memoryKey: input.memoryKey,
        value: input.value,
        confidence,
        source: input.source,
        evidenceCount,
        lastReinforcedAt: now,
        retiredAt: null,
        retirementReason: null,
        createdAt: now,
        updatedAt: now,
      };
      memoryMindMemories.set(memory.id, memory);
    }

    memoryEvidenceList.push({
      id: nextEvidenceId++,
      memoryId: memory.id,
      source: input.evidence.source,
      sourceReference: input.evidence.sourceReference ?? null,
      detail: input.evidence.detail,
      weight: input.evidence.weight ?? 1,
      confidenceBefore: existing?.confidence ?? null,
      confidenceAfter: confidence,
      createdAt: now,
    });

    memoryActivities.push({
      id: nextActivityId++,
      mindId: mind.id,
      userId: input.userId,
      memoryId: memory.id,
      activityType: input.activity.type,
      message: input.activity.message,
      createdAt: now,
    });

    return memory;
  }

  const existing = await db.select().from(mindMemories)
    .where(and(eq(mindMemories.mindId, mind.id), eq(mindMemories.category, input.category), eq(mindMemories.memoryKey, input.memoryKey)))
    .limit(1);
  const previous = existing[0];
  const evidenceCount = (previous?.evidenceCount ?? 0) + 1;
  const confidence = previous
    ? clampConfidence(Math.max(previous.confidence, input.confidence) + Math.min(8, Math.max(1, input.evidence.weight ?? 1)))
    : clampConfidence(input.confidence);

  if (previous) {
    await db.update(mindMemories).set({
      value: input.value,
      confidence,
      source: input.source,
      evidenceCount,
      lastReinforcedAt: now,
      retiredAt: null,
      retirementReason: null,
      updatedAt: now,
    }).where(eq(mindMemories.id, previous.id));
  } else {
    await db.insert(mindMemories).values({
      mindId: mind.id,
      category: input.category,
      memoryKey: input.memoryKey,
      value: input.value,
      confidence,
      source: input.source,
      evidenceCount,
      lastReinforcedAt: now,
    });
  }

  const rows = await db.select().from(mindMemories)
    .where(and(eq(mindMemories.mindId, mind.id), eq(mindMemories.category, input.category), eq(mindMemories.memoryKey, input.memoryKey)))
    .limit(1);
  const memory = rows[0];
  if (!memory) throw new Error("Mind memory could not be saved");

  await db.insert(memoryEvidence).values({
    memoryId: memory.id,
    source: input.evidence.source,
    sourceReference: input.evidence.sourceReference ?? null,
    detail: input.evidence.detail,
    weight: input.evidence.weight ?? 1,
    confidenceBefore: previous?.confidence ?? null,
    confidenceAfter: confidence,
  });
  await db.insert(creativePreferences).values({
    mindId: mind.id,
    memoryId: memory.id,
    category: input.category,
    label: input.value.slice(0, 160),
    confidence,
    source: input.source,
    evidenceCount,
    lastUpdatedAt: now,
  }).onDuplicateKeyUpdate({
    set: { label: input.value.slice(0, 160), confidence, source: input.source, evidenceCount, lastUpdatedAt: now, updatedAt: now },
  });
  await db.insert(mindActivity).values({
    mindId: mind.id,
    userId: input.userId,
    memoryId: memory.id,
    activityType: input.activity.type,
    message: input.activity.message,
  });
  return memory;
}

export async function updateMindMemoryForUser(input: { userId: number; memoryId: number; value: string }): Promise<MindMemory | undefined> {
  const mind = await getCreativeMindForUser(input.userId);
  if (!mind) return undefined;
  const db = await getDb();
  const now = new Date();

  if (!db) {
    const existing = memoryMindMemories.get(input.memoryId);
    if (!existing || existing.mindId !== mind.id || existing.retiredAt) return undefined;
    existing.value = input.value;
    existing.updatedAt = now;
    memoryEvidenceList.push({
      id: nextEvidenceId++,
      memoryId: existing.id,
      source: "teaching",
      sourceReference: null,
      detail: `Creator refined this preference to: ${input.value}`,
      weight: 1,
      confidenceBefore: existing.confidence,
      confidenceAfter: existing.confidence,
      createdAt: now,
    });
    memoryActivities.push({
      id: nextActivityId++,
      mindId: mind.id,
      userId: input.userId,
      memoryId: existing.id,
      activityType: "updated",
      message: `Refined: ${input.value}`,
      createdAt: now,
    });
    return existing;
  }

  const existing = (await db.select().from(mindMemories)
    .where(and(eq(mindMemories.id, input.memoryId), eq(mindMemories.mindId, mind.id), isNull(mindMemories.retiredAt)))
    .limit(1))[0];
  if (!existing) return undefined;
  await db.update(mindMemories).set({ value: input.value, updatedAt: now }).where(eq(mindMemories.id, existing.id));
  await db.update(creativePreferences).set({ label: input.value.slice(0, 160), lastUpdatedAt: now, updatedAt: now })
    .where(and(eq(creativePreferences.mindId, mind.id), eq(creativePreferences.memoryId, existing.id)));
  await db.insert(memoryEvidence).values({
    memoryId: existing.id,
    source: "teaching",
    detail: `Creator refined this preference to: ${input.value}`,
    weight: 1,
    confidenceBefore: existing.confidence,
    confidenceAfter: existing.confidence,
  });
  await db.insert(mindActivity).values({ mindId: mind.id, userId: input.userId, memoryId: existing.id, activityType: "updated", message: `Refined: ${input.value}` });
  return (await db.select().from(mindMemories).where(eq(mindMemories.id, existing.id)).limit(1))[0];
}

export async function setMindMemoryRetirementForUser(input: { userId: number; memoryId: number; retired: boolean; reason?: string | null }): Promise<MindMemory | undefined> {
  const mind = await getCreativeMindForUser(input.userId);
  if (!mind) return undefined;
  const db = await getDb();
  const now = new Date();

  if (!db) {
    const existing = memoryMindMemories.get(input.memoryId);
    if (!existing || existing.mindId !== mind.id) return undefined;
    if (input.retired === Boolean(existing.retiredAt)) return existing;
    existing.retiredAt = input.retired ? now : null;
    existing.retirementReason = input.retired ? (input.reason?.trim() || null) : null;
    existing.updatedAt = now;
    memoryActivities.push({
      id: nextActivityId++,
      mindId: mind.id,
      userId: input.userId,
      memoryId: existing.id,
      activityType: input.retired ? "updated" : "reinforced",
      message: input.retired ? `Retired: ${existing.value}` : `Restored: ${existing.value}`,
      createdAt: now,
    });
    return existing;
  }

  const existing = (await db.select().from(mindMemories)
    .where(and(eq(mindMemories.id, input.memoryId), eq(mindMemories.mindId, mind.id)))
    .limit(1))[0];
  if (!existing) return undefined;
  if (input.retired === Boolean(existing.retiredAt)) return existing;
  await db.update(mindMemories).set({ retiredAt: input.retired ? now : null, retirementReason: input.retired ? (input.reason?.trim() || null) : null, updatedAt: now })
    .where(eq(mindMemories.id, existing.id));
  await db.insert(mindActivity).values({
    mindId: mind.id,
    userId: input.userId,
    memoryId: existing.id,
    activityType: input.retired ? "updated" : "reinforced",
    message: input.retired ? `Retired: ${existing.value}` : `Restored: ${existing.value}`,
  });
  return (await db.select().from(mindMemories).where(eq(mindMemories.id, existing.id)).limit(1))[0];
}

export async function listMemoryEvidenceForUser(input: { userId: number; memoryId: number }) {
  const mind = await getCreativeMindForUser(input.userId);
  if (!mind) return [];
  const db = await getDb();
  if (!db) {
    const memory = memoryMindMemories.get(input.memoryId);
    if (!memory || memory.mindId !== mind.id) return [];
    return memoryEvidenceList.filter(e => e.memoryId === input.memoryId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  const memory = await db.select({ id: mindMemories.id }).from(mindMemories)
    .where(and(eq(mindMemories.id, input.memoryId), eq(mindMemories.mindId, mind.id))).limit(1);
  if (!memory[0]) return [];
  return db.select().from(memoryEvidence).where(eq(memoryEvidence.memoryId, input.memoryId)).orderBy(desc(memoryEvidence.createdAt));
}

export async function listMindConfidenceEvolutionForUser(userId: number) {
  const mind = await ensureCreativeMindForUser(userId);
  const db = await getDb();
  if (!db) {
    const userMemories = Array.from(memoryMindMemories.values()).filter(m => m.mindId === mind.id);
    const memoryIds = new Set(userMemories.map(m => m.id));
    const evidence = memoryEvidenceList.filter(e => memoryIds.has(e.memoryId)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id);
    const latestByMemory = new Map<number, typeof evidence[number]>();
    evidence.forEach(item => {
      if (!latestByMemory.has(item.memoryId)) latestByMemory.set(item.memoryId, item);
    });
    return latestByMemory;
  }
  const evidence = await db.select({
    memoryId: memoryEvidence.memoryId,
    confidenceBefore: memoryEvidence.confidenceBefore,
    confidenceAfter: memoryEvidence.confidenceAfter,
    createdAt: memoryEvidence.createdAt,
    id: memoryEvidence.id,
  }).from(memoryEvidence)
    .innerJoin(mindMemories, eq(memoryEvidence.memoryId, mindMemories.id))
    .where(eq(mindMemories.mindId, mind.id))
    .orderBy(desc(memoryEvidence.createdAt), desc(memoryEvidence.id));
  const latestByMemory = new Map<number, typeof evidence[number]>();
  evidence.forEach(item => {
    if (!latestByMemory.has(item.memoryId)) latestByMemory.set(item.memoryId, item);
  });
  return latestByMemory;
}

export async function listMindActivityForUser(userId: number, limit = 12) {
  const mind = await ensureCreativeMindForUser(userId);
  const db = await getDb();
  if (!db) {
    return memoryActivities.filter(a => a.mindId === mind.id && a.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id)
      .slice(0, limit);
  }
  return db.select().from(mindActivity)
    .where(and(eq(mindActivity.mindId, mind.id), eq(mindActivity.userId, userId)))
    .orderBy(desc(mindActivity.createdAt), desc(mindActivity.id)).limit(limit);
}

export async function createFeedbackEventForUser(input: {
  userId: number;
  jobId?: string | null;
  recommendationId?: string | null;
  feedbackType: "keep" | "not_my_style" | "teach";
  reason?: string | null;
  feedbackText?: string | null;
  signalCategory?: string | null;
  signalKey?: string | null;
  signalValue?: string | null;
}) {
  const mind = await ensureCreativeMindForUser(input.userId);
  const db = await getDb();
  const now = new Date();

  if (!db) {
    const feedback: MemoryFeedbackRecord = {
      id: nextFeedbackId++,
      mindId: mind.id,
      userId: input.userId,
      jobId: input.jobId ?? null,
      recommendationId: input.recommendationId ?? null,
      feedbackType: input.feedbackType,
      reason: input.reason ?? null,
      feedbackText: input.feedbackText ?? null,
      signalCategory: input.signalCategory ?? null,
      signalKey: input.signalKey ?? null,
      signalValue: input.signalValue ?? null,
      createdAt: now,
    };
    memoryFeedbackEvents.push(feedback);
    return feedback;
  }

  await db.insert(feedbackEvents).values({ mindId: mind.id, ...input });
  const rows = await db.select().from(feedbackEvents).where(and(eq(feedbackEvents.mindId, mind.id), eq(feedbackEvents.userId, input.userId))).orderBy(desc(feedbackEvents.id)).limit(1);
  if (!rows[0]) throw new Error("Feedback event could not be saved");
  return rows[0];
}

export async function getFeedbackSignalSummaryForUser(input: { userId: number; signalKey: string }): Promise<FeedbackSignalSummary> {
  const mind = await ensureCreativeMindForUser(input.userId);
  const db = await getDb();
  if (!db) {
    const rows = memoryFeedbackEvents.filter(e => e.mindId === mind.id && e.userId === input.userId && e.signalKey === input.signalKey);
    const keepCount = rows.filter(row => row.feedbackType === "keep").length;
    const notMyStyleCount = rows.filter(row => row.feedbackType === "not_my_style").length;
    return { keepCount, notMyStyleCount, totalCount: rows.length };
  }
  const rows = await db.select({ feedbackType: feedbackEvents.feedbackType }).from(feedbackEvents)
    .where(and(
      eq(feedbackEvents.mindId, mind.id),
      eq(feedbackEvents.userId, input.userId),
      eq(feedbackEvents.signalKey, input.signalKey)
    ));
  const keepCount = rows.filter(row => row.feedbackType === "keep").length;
  const notMyStyleCount = rows.filter(row => row.feedbackType === "not_my_style").length;
  return { keepCount, notMyStyleCount, totalCount: rows.length };
}

export async function getMindStatsForUser(userId: number) {
  const mind = await ensureCreativeMindForUser(userId);
  const db = await getDb();
  if (!db) {
    const memories = Array.from(memoryMindMemories.values()).filter(m => m.mindId === mind.id && !m.retiredAt);
    const feedback = memoryFeedbackEvents.filter(e => e.mindId === mind.id && e.userId === userId);
    const averageConfidence = memories.length === 0 ? 0 : Math.round(memories.reduce((sum, memory) => sum + memory.confidence, 0) / memories.length);
    const strongPatterns = memories.filter(memory => memory.confidence >= 75 && memory.evidenceCount >= 2).length;
    return { mind, preferenceCount: memories.length, feedbackCount: feedback.length, strongPatterns, averageConfidence };
  }
  const [memories, feedback] = await Promise.all([
    db.select().from(mindMemories).where(and(eq(mindMemories.mindId, mind.id), isNull(mindMemories.retiredAt))),
    db.select().from(feedbackEvents).where(and(eq(feedbackEvents.mindId, mind.id), eq(feedbackEvents.userId, userId))),
  ]);
  const averageConfidence = memories.length === 0 ? 0 : Math.round(memories.reduce((sum, memory) => sum + memory.confidence, 0) / memories.length);
  const strongPatterns = memories.filter(memory => memory.confidence >= 75 && memory.evidenceCount >= 2).length;
  return { mind, preferenceCount: memories.length, feedbackCount: feedback.length, strongPatterns, averageConfidence };
}

export async function resetCreativeMindForUser(userId: number): Promise<{ success: boolean; message: string }> {
  const mind = await getCreativeMindForUser(userId);
  if (!mind) return { success: true, message: "No active mind found." };
  const db = await getDb();
  const now = new Date();

  if (!db) {
    const userMemories = Array.from(memoryMindMemories.values()).filter(m => m.mindId === mind.id);
    const memoryIds = new Set(userMemories.map(m => m.id));

    for (const [key, mem] of Array.from(memoryMindMemories.entries())) {
      if (mem.mindId === mind.id) {
        memoryMindMemories.delete(key);
      }
    }

    for (let i = memoryEvidenceList.length - 1; i >= 0; i--) {
      if (memoryIds.has(memoryEvidenceList[i].memoryId)) {
        memoryEvidenceList.splice(i, 1);
      }
    }

    for (const [key, pref] of Array.from(memoryPreferences.entries())) {
      if (pref.mindId === mind.id) {
        memoryPreferences.delete(key);
      }
    }

    for (let i = memoryActivities.length - 1; i >= 0; i--) {
      if (memoryActivities[i].mindId === mind.id || memoryActivities[i].userId === userId) {
        memoryActivities.splice(i, 1);
      }
    }

    for (let i = memoryFeedbackEvents.length - 1; i >= 0; i--) {
      if (memoryFeedbackEvents[i].mindId === mind.id || memoryFeedbackEvents[i].userId === userId) {
        memoryFeedbackEvents.splice(i, 1);
      }
    }

    mind.onboardedAt = null;
    mind.updatedAt = now;

    return { success: true, message: "Creative Mind reset to a clean slate." };
  }

  const userMemories = await db.select({ id: mindMemories.id }).from(mindMemories).where(eq(mindMemories.mindId, mind.id));
  const memoryIds = userMemories.map(m => m.id);

  if (memoryIds.length > 0) {
    for (const memId of memoryIds) {
      await db.delete(memoryEvidence).where(eq(memoryEvidence.memoryId, memId));
    }
    await db.delete(mindMemories).where(eq(mindMemories.mindId, mind.id));
  }

  await db.delete(creativePreferences).where(eq(creativePreferences.mindId, mind.id));
  await db.delete(mindActivity).where(and(eq(mindActivity.mindId, mind.id), eq(mindActivity.userId, userId)));
  await db.delete(feedbackEvents).where(and(eq(feedbackEvents.mindId, mind.id), eq(feedbackEvents.userId, userId)));
  await db.update(creativeMinds).set({ onboardedAt: null, updatedAt: now }).where(and(eq(creativeMinds.id, mind.id), eq(creativeMinds.userId, userId)));

  return { success: true, message: "Creative Mind reset to a clean slate." };
}

export type VideoJobStatus = "pending" | "processing" | "retrying" | "done" | "failed" | "cancelled";

type VideoJobUpdate = Partial<{
  status: VideoJobStatus;
  videoTitle: string | null;
  summary: string | null;
  topics: string[] | null;
  clips: ClipSuggestion[] | null;
  sourceNote: string | null;
  mindContextSnapshot: MindContextSnapshot | null;
  model: string | null;
  failureReason: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  archivedAt: Date | null;
  cancelledAt: Date | null;
  nextAttemptAt: Date | null;
  workerToken: string | null;
  workerClaimedAt: Date | null;
  lastAttemptAt: Date | null;
}>;

export async function createVideoJob(input: {
  id: string;
  userId: number;
  videoUrl: string;
  transcriptStorageKey?: string;
  transcriptFormat?: "txt" | "srt" | "vtt";
  transcriptCharacterCount?: number;
}): Promise<VideoJob> {
  const db = await getDb();
  const now = new Date();

  if (!db) {
    const job: VideoJob = {
      id: input.id,
      userId: input.userId,
      videoUrl: input.videoUrl,
      videoTitle: null,
      summary: null,
      topics: null,
      clips: null,
      sourceNote: null,
      mindContextSnapshot: null,
      status: "pending",
      model: null,
      attemptCount: 0,
      maxAttempts: 3,
      workerToken: null,
      workerClaimedAt: null,
      lastAttemptAt: null,
      nextAttemptAt: null,
      failureReason: null,
      startedAt: null,
      completedAt: null,
      archivedAt: null,
      cancelledAt: null,
      transcriptStorageKey: input.transcriptStorageKey ?? null,
      transcriptFormat: input.transcriptFormat ?? null,
      transcriptCharacterCount: input.transcriptCharacterCount ?? null,
      createdAt: now,
      updatedAt: now,
    };
    memoryVideoJobs.set(job.id, job);
    return job;
  }

  await db.insert(videoJobs).values(input);
  const job = await getVideoJobForUser(input.id, input.userId);
  if (!job) throw new Error("Video job could not be created");
  return job;
}

export async function getVideoJobForUser(id: string, userId: number): Promise<VideoJob | undefined> {
  const db = await getDb();
  if (!db) {
    const job = memoryVideoJobs.get(id);
    return job && job.userId === userId ? job : undefined;
  }

  const result = await db
    .select()
    .from(videoJobs)
    .where(and(eq(videoJobs.id, id), eq(videoJobs.userId, userId)))
    .limit(1);
  return result[0];
}

export type VideoJobListFilters = {
  includeArchived?: boolean;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  statuses?: VideoJobStatus[];
};

export async function listVideoJobsForUser(userId: number, filters: VideoJobListFilters = {}): Promise<VideoJob[]> {
  const db = await getDb();
  if (!db) {
    let jobs = Array.from(memoryVideoJobs.values()).filter(j => j.userId === userId);
    if (!filters.includeArchived) jobs = jobs.filter(j => !j.archivedAt);
    if (filters.search?.trim()) {
      const s = filters.search.trim().toLowerCase();
      jobs = jobs.filter(j => j.videoUrl.toLowerCase().includes(s));
    }
    if (filters.startDate) jobs = jobs.filter(j => j.createdAt >= filters.startDate!);
    if (filters.endDate) jobs = jobs.filter(j => j.createdAt <= filters.endDate!);
    if (filters.statuses?.length) jobs = jobs.filter(j => filters.statuses!.includes(j.status));
    return jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 50);
  }

  const predicates = [eq(videoJobs.userId, userId)];
  if (!filters.includeArchived) predicates.push(isNull(videoJobs.archivedAt));
  if (filters.search?.trim()) predicates.push(like(videoJobs.videoUrl, `%${filters.search.trim()}%`));
  if (filters.startDate) predicates.push(gte(videoJobs.createdAt, filters.startDate));
  if (filters.endDate) predicates.push(lte(videoJobs.createdAt, filters.endDate));
  if (filters.statuses?.length) predicates.push(or(...filters.statuses.map(status => eq(videoJobs.status, status)))!);

  return db
    .select()
    .from(videoJobs)
    .where(and(...predicates))
    .orderBy(desc(videoJobs.createdAt))
    .limit(50);
}

export async function listAllVideoJobsForUser(userId: number): Promise<VideoJob[]> {
  const db = await getDb();
  if (!db) {
    return Array.from(memoryVideoJobs.values())
      .filter(j => j.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  return db
    .select()
    .from(videoJobs)
    .where(eq(videoJobs.userId, userId))
    .orderBy(desc(videoJobs.createdAt));
}

export type RecommendationComparisonItem = {
  jobId: string;
  videoUrl: string;
  createdAt: Date;
  transcriptFormat: "txt" | "srt" | "vtt" | null;
  clipCount: number;
  appliedPreferenceCount: number;
  appliedPreferences: Array<{ category: string; value: string; confidence: number; evidenceCount: number }>;
  keptCount: number;
  correctedCount: number;
};

export async function listRecommendationComparisonForUser(userId: number): Promise<RecommendationComparisonItem[]> {
  const db = await getDb();
  if (!db) {
    const doneJobs = Array.from(memoryVideoJobs.values())
      .filter(j => j.userId === userId && j.status === "done")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, 12);
    return doneJobs.map(job => {
      const snapshot = job.mindContextSnapshot?.preferences ?? [];
      const jobFeedback = memoryFeedbackEvents.filter(e => e.userId === userId && e.jobId === job.id);
      const keptCount = jobFeedback.filter(e => e.feedbackType === "keep").length;
      const correctedCount = jobFeedback.filter(e => e.feedbackType === "not_my_style").length;
      return {
        jobId: job.id,
        videoUrl: job.videoUrl,
        createdAt: job.createdAt,
        transcriptFormat: job.transcriptFormat,
        clipCount: job.clips?.length ?? 0,
        appliedPreferenceCount: snapshot.length,
        appliedPreferences: snapshot,
        keptCount,
        correctedCount,
      };
    });
  }
  const jobs = await db.select().from(videoJobs)
    .where(and(eq(videoJobs.userId, userId), eq(videoJobs.status, "done")))
    .orderBy(asc(videoJobs.createdAt), asc(videoJobs.id))
    .limit(12);
  const jobIds = jobs.map(job => job.id);
  if (!jobIds.length) return [];
  const feedback = await db.select({ jobId: feedbackEvents.jobId, feedbackType: feedbackEvents.feedbackType })
    .from(feedbackEvents)
    .where(and(eq(feedbackEvents.userId, userId), or(...jobIds.map(jobId => eq(feedbackEvents.jobId, jobId)))!));
  const feedbackByJob = new Map<string, { keptCount: number; correctedCount: number }>();
  feedback.forEach(event => {
    if (!event.jobId) return;
    const current = feedbackByJob.get(event.jobId) ?? { keptCount: 0, correctedCount: 0 };
    if (event.feedbackType === "keep") current.keptCount += 1;
    if (event.feedbackType === "not_my_style") current.correctedCount += 1;
    feedbackByJob.set(event.jobId, current);
  });
  return jobs.map(job => {
    const snapshot = job.mindContextSnapshot?.preferences ?? [];
    const counts = feedbackByJob.get(job.id) ?? { keptCount: 0, correctedCount: 0 };
    return {
      jobId: job.id,
      videoUrl: job.videoUrl,
      createdAt: job.createdAt,
      transcriptFormat: job.transcriptFormat,
      clipCount: job.clips?.length ?? 0,
      appliedPreferenceCount: snapshot.length,
      appliedPreferences: snapshot,
      ...counts,
    };
  });
}

export async function updateVideoJobForUser(
  id: string,
  userId: number,
  changes: VideoJobUpdate
): Promise<VideoJob> {
  const db = await getDb();
  const now = new Date();

  if (!db) {
    const job = memoryVideoJobs.get(id);
    if (!job || job.userId !== userId) throw new Error("Video job was not found");
    Object.assign(job, changes, { updatedAt: now });
    return job;
  }

  await db
    .update(videoJobs)
    .set({ ...changes, updatedAt: now } as Partial<InsertVideoJob>)
    .where(and(eq(videoJobs.id, id), eq(videoJobs.userId, userId)));

  const job = await getVideoJobForUser(id, userId);
  if (!job) throw new Error("Video job was not found");
  return job;
}

export async function archiveVideoJobForUser(id: string, userId: number): Promise<VideoJob> {
  return updateVideoJobForUser(id, userId, { archivedAt: new Date() });
}

export async function deleteVideoJobForUser(id: string, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    const job = memoryVideoJobs.get(id);
    if (job && job.userId === userId) {
      memoryVideoJobs.delete(id);
      return true;
    }
    return false;
  }
  const result = await db.delete(videoJobs).where(and(eq(videoJobs.id, id), eq(videoJobs.userId, userId)));
  return Number((result as { rowsAffected?: number }).rowsAffected ?? 0) > 0;
}

export async function cancelVideoJobForUser(id: string, userId: number): Promise<VideoJob | undefined> {
  const job = await getVideoJobForUser(id, userId);
  if (!job || ["done", "failed", "cancelled"].includes(job.status)) return undefined;
  return updateVideoJobForUser(id, userId, {
    status: "cancelled",
    cancelledAt: new Date(),
    completedAt: new Date(),
    workerToken: null,
    workerClaimedAt: null,
  });
}

export async function claimNextVideoJob(workerToken: string): Promise<VideoJob | undefined> {
  const db = await getDb();
  const now = new Date();

  if (!db) {
    const candidates = Array.from(memoryVideoJobs.values()).filter(
      j => !j.archivedAt && !j.cancelledAt && (j.status === "pending" || j.status === "retrying") && (!j.nextAttemptAt || j.nextAttemptAt <= now)
    ).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const job = candidates[0];
    if (!job) return undefined;
    job.status = "processing";
    job.workerToken = workerToken;
    job.workerClaimedAt = now;
    job.lastAttemptAt = now;
    job.attemptCount += 1;
    job.updatedAt = now;
    return job;
  }

  const candidate = await db
    .select()
    .from(videoJobs)
    .where(and(
      isNull(videoJobs.archivedAt),
      isNull(videoJobs.cancelledAt),
      or(eq(videoJobs.status, "pending"), eq(videoJobs.status, "retrying")),
      or(isNull(videoJobs.nextAttemptAt), lte(videoJobs.nextAttemptAt, now))
    ))
    .orderBy(asc(videoJobs.createdAt))
    .limit(1);
  const job = candidate[0];
  if (!job) return undefined;

  await db
    .update(videoJobs)
    .set({ status: "processing", workerToken, workerClaimedAt: now, lastAttemptAt: now, attemptCount: job.attemptCount + 1, updatedAt: now })
    .where(and(eq(videoJobs.id, job.id), or(eq(videoJobs.status, "pending"), eq(videoJobs.status, "retrying")), isNull(videoJobs.cancelledAt)));
  const claimed = await db.select().from(videoJobs).where(and(eq(videoJobs.id, job.id), eq(videoJobs.workerToken, workerToken))).limit(1);
  return claimed[0];
}

export async function updateClaimedVideoJob(id: string, workerToken: string, changes: VideoJobUpdate): Promise<VideoJob | undefined> {
  const db = await getDb();
  const now = new Date();

  if (!db) {
    const job = memoryVideoJobs.get(id);
    if (!job || job.workerToken !== workerToken) return undefined;
    Object.assign(job, changes, { updatedAt: now });
    return job;
  }

  await db.update(videoJobs).set({ ...changes, updatedAt: now } as Partial<InsertVideoJob>)
    .where(and(eq(videoJobs.id, id), eq(videoJobs.workerToken, workerToken)));
  const jobs = await db.select().from(videoJobs).where(and(eq(videoJobs.id, id), eq(videoJobs.workerToken, workerToken))).limit(1);
  return jobs[0];
}

export async function isVideoJobCancelled(id: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return memoryVideoJobs.get(id)?.status === "cancelled";
  }
  const jobs = await db.select({ status: videoJobs.status }).from(videoJobs).where(eq(videoJobs.id, id)).limit(1);
  return jobs[0]?.status === "cancelled";
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function consumeAnalysisQuota(userId: number, maximum: number): Promise<{ allowed: boolean; used: number }> {
  const db = await getDb();
  const usageDate = todayUtc();
  const key = `${userId}-${usageDate.toISOString().slice(0, 10)}`;

  if (!db) {
    const current = memoryAnalysisUsage.get(key);
    if (current && current.analysisCount >= maximum) return { allowed: false, used: current.analysisCount };
    if (current) {
      current.analysisCount += 1;
      current.updatedAt = new Date();
      return { allowed: true, used: current.analysisCount };
    }
    memoryAnalysisUsage.set(key, { userId, usageDate, analysisCount: 1, updatedAt: new Date() });
    return { allowed: true, used: 1 };
  }

  const rows = await db.select().from(analysisUsage).where(and(eq(analysisUsage.userId, userId), eq(analysisUsage.usageDate, usageDate))).limit(1);
  const current = rows[0];
  if (current && current.analysisCount >= maximum) return { allowed: false, used: current.analysisCount };
  if (current) {
    await db.update(analysisUsage).set({ analysisCount: current.analysisCount + 1, updatedAt: new Date() }).where(and(eq(analysisUsage.userId, userId), eq(analysisUsage.usageDate, usageDate)));
    return { allowed: true, used: current.analysisCount + 1 };
  }
  await db.insert(analysisUsage).values({ userId, usageDate, analysisCount: 1 });
  return { allowed: true, used: 1 };
}

export async function consumeRateLimit(input: { userId: number; scope: string; maximum: number; windowMinutes: number }): Promise<boolean> {
  const db = await getDb();
  const bucket = Math.floor(Date.now() / (input.windowMinutes * 60_000));
  const windowKey = `${input.windowMinutes}m-${bucket}`;
  const key = `${input.userId}-${input.scope}-${windowKey}`;

  if (!db) {
    const current = memoryRateLimits.get(key);
    if (current && current.requestCount >= input.maximum) return false;
    if (current) {
      current.requestCount += 1;
      current.updatedAt = new Date();
    } else {
      memoryRateLimits.set(key, { userId: input.userId, scope: input.scope, windowKey, requestCount: 1, updatedAt: new Date() });
    }
    return true;
  }

  const rows = await db.select().from(requestRateLimits).where(and(eq(requestRateLimits.userId, input.userId), eq(requestRateLimits.scope, input.scope), eq(requestRateLimits.windowKey, windowKey))).limit(1);
  const current = rows[0];
  if (current && current.requestCount >= input.maximum) return false;
  if (current) {
    await db.update(requestRateLimits).set({ requestCount: current.requestCount + 1, updatedAt: new Date() }).where(and(eq(requestRateLimits.userId, input.userId), eq(requestRateLimits.scope, input.scope), eq(requestRateLimits.windowKey, windowKey)));
  } else {
    await db.insert(requestRateLimits).values({ userId: input.userId, scope: input.scope, windowKey, requestCount: 1 });
  }
  return true;
}

export async function createVideoJobProgressEvent(input: {
  jobId: string;
  userId: number;
  stage: VideoJobProgressStage;
  message: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) {
    memoryProgressEvents.push({
      id: nextProgressId++,
      jobId: input.jobId,
      userId: input.userId,
      stage: input.stage,
      message: input.message,
      createdAt: new Date(),
    });
    return;
  }

  await db.insert(videoJobProgressEvents).values(input);
}

export async function listVideoJobProgressEventsForUser(input: {
  jobId: string;
  userId: number;
  afterId?: number;
}) {
  const db = await getDb();
  if (!db) {
    let events = memoryProgressEvents.filter(e => e.jobId === input.jobId && e.userId === input.userId);
    if (input.afterId && input.afterId > 0) {
      events = events.filter(e => e.id > input.afterId!);
    }
    return events.sort((a, b) => a.id - b.id);
  }

  const filters = [
    eq(videoJobProgressEvents.jobId, input.jobId),
    eq(videoJobProgressEvents.userId, input.userId),
  ];
  if (input.afterId && input.afterId > 0) {
    filters.push(gt(videoJobProgressEvents.id, input.afterId));
  }

  return db
    .select()
    .from(videoJobProgressEvents)
    .where(and(...filters))
    .orderBy(asc(videoJobProgressEvents.id));
}

export async function listAllVideoJobProgressEventsForUser(userId: number) {
  const db = await getDb();
  if (!db) {
    return memoryProgressEvents.filter(e => e.userId === userId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id);
  }

  return db
    .select()
    .from(videoJobProgressEvents)
    .where(eq(videoJobProgressEvents.userId, userId))
    .orderBy(asc(videoJobProgressEvents.createdAt), asc(videoJobProgressEvents.id));
}

export async function createPdfReportShare(input: {
  token: string;
  jobId: string;
  userId: number;
  storageKey: string;
  expiresAt: Date | null;
}) {
  const db = await getDb();
  if (!db) {
    memoryPdfShares.set(input.token, {
      ...input,
      revokedAt: null,
      createdAt: new Date(),
    });
    return;
  }
  await db.insert(pdfReportShares).values(input);
}

export async function getPdfReportShareByToken(token: string) {
  const db = await getDb();
  if (!db) {
    return memoryPdfShares.get(token);
  }
  const results = await db.select().from(pdfReportShares).where(eq(pdfReportShares.token, token)).limit(1);
  return results[0];
}

export async function listActivePdfReportSharesForUser(userId: number) {
  const db = await getDb();
  const now = new Date();
  if (!db) {
    return Array.from(memoryPdfShares.values())
      .filter(s => s.userId === userId && !s.revokedAt && (!s.expiresAt || s.expiresAt > now))
      .map(s => {
        const job = memoryVideoJobs.get(s.jobId);
        return {
          token: s.token,
          jobId: s.jobId,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
          videoUrl: job?.videoUrl ?? "",
          jobStatus: job?.status ?? "pending",
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  return db
    .select({
      token: pdfReportShares.token,
      jobId: pdfReportShares.jobId,
      createdAt: pdfReportShares.createdAt,
      expiresAt: pdfReportShares.expiresAt,
      videoUrl: videoJobs.videoUrl,
      jobStatus: videoJobs.status,
    })
    .from(pdfReportShares)
    .innerJoin(videoJobs, eq(pdfReportShares.jobId, videoJobs.id))
    .where(and(
      eq(pdfReportShares.userId, userId),
      isNull(pdfReportShares.revokedAt),
      or(isNull(pdfReportShares.expiresAt), gt(pdfReportShares.expiresAt, now))
    ))
    .orderBy(desc(pdfReportShares.createdAt));
}

export async function revokePdfReportShareForUser(input: { token: string; userId: number }): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    const s = memoryPdfShares.get(input.token);
    if (!s || s.userId !== input.userId || s.revokedAt) return false;
    s.revokedAt = new Date();
    return true;
  }
  const found = await db
    .select({ token: pdfReportShares.token })
    .from(pdfReportShares)
    .where(and(eq(pdfReportShares.token, input.token), eq(pdfReportShares.userId, input.userId), isNull(pdfReportShares.revokedAt)))
    .limit(1);
  if (!found[0]) return false;
  await db
    .update(pdfReportShares)
    .set({ revokedAt: new Date() })
    .where(and(eq(pdfReportShares.token, input.token), eq(pdfReportShares.userId, input.userId)));
  return true;
}

export async function cleanupStalePdfReportShares(now = new Date()): Promise<number> {
  const db = await getDb();
  if (!db) {
    let count = 0;
    Array.from(memoryPdfShares.entries()).forEach(([token, s]) => {
      if (s.revokedAt || (s.expiresAt && s.expiresAt <= now)) {
        memoryPdfShares.delete(token);
        count++;
      }
    });
    return count;
  }
  const result = await db.delete(pdfReportShares).where(or(
    isNotNull(pdfReportShares.revokedAt),
    lte(pdfReportShares.expiresAt, now)
  ));
  return Number((result as { rowsAffected?: number }).rowsAffected ?? 0);
}

export async function getPdfReportBranding(userId: number) {
  const db = await getDb();
  if (!db) {
    return memoryBranding.get(userId);
  }
  const results = await db.select().from(pdfReportBranding).where(eq(pdfReportBranding.userId, userId)).limit(1);
  return results[0];
}

export async function upsertPdfReportBranding(input: { userId: number; coverTitle?: string; logoStorageKey?: string | null }) {
  const db = await getDb();
  const now = new Date();
  if (!db) {
    const existing = memoryBranding.get(input.userId);
    const coverTitle = input.coverTitle ?? existing?.coverTitle ?? "Video Analysis Report";
    const logoStorageKey = input.logoStorageKey ?? existing?.logoStorageKey ?? null;
    const saved: MemoryBrandingRecord = {
      userId: input.userId,
      coverTitle,
      logoStorageKey,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    memoryBranding.set(input.userId, saved);
    return saved;
  }
  const existing = await getPdfReportBranding(input.userId);
  const coverTitle = input.coverTitle ?? existing?.coverTitle ?? "Video Analysis Report";
  const logoStorageKey = input.logoStorageKey ?? existing?.logoStorageKey ?? null;
  await db.insert(pdfReportBranding).values({ userId: input.userId, coverTitle, logoStorageKey }).onDuplicateKeyUpdate({
    set: { coverTitle, logoStorageKey, updatedAt: now },
  });
  const saved = await getPdfReportBranding(input.userId);
  if (!saved) throw new Error("Report branding could not be saved");
  return saved;
}
