import { and, asc, desc, eq, gt, gte, isNotNull, isNull, like, lte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import {
  type CreativeMind,
  type MindMemory,
  type MindActivity,
  type ClipSuggestion,
  type InsertUser,
  type InsertVideoJob,
  type VideoJob,
  type VideoJobProgressStage,
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
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
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

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export type MindMemoryCategory = NonNullable<MindMemory["category"]>;
export type MindMemorySource = NonNullable<MindMemory["source"]>;
export type MindEvidenceSource = "onboarding" | "teaching" | "feedback" | "analysis" | "selection";
export type MindActivityType = NonNullable<MindActivity["activityType"]>;

function clampConfidence(value: number) {
  return Math.max(1, Math.min(100, Math.round(value)));
}

export async function getCreativeMindForUser(userId: number): Promise<CreativeMind | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(creativeMinds).where(eq(creativeMinds.userId, userId)).limit(1);
  return rows[0];
}

export async function ensureCreativeMindForUser(userId: number): Promise<CreativeMind> {
  const existing = await getCreativeMindForUser(userId);
  if (existing) return existing;
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
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
  if (!db) throw new Error("Database is not available");
  await db.update(creativeMinds).set({ onboardedAt: new Date(), updatedAt: new Date() }).where(and(eq(creativeMinds.id, mind.id), eq(creativeMinds.userId, userId)));
  const updated = await getCreativeMindForUser(userId);
  if (!updated) throw new Error("Creative Mind could not be updated");
  return updated;
}

export async function listMindMemoriesForUser(userId: number): Promise<MindMemory[]> {
  const mind = await ensureCreativeMindForUser(userId);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(mindMemories).where(eq(mindMemories.mindId, mind.id)).orderBy(desc(mindMemories.confidence), desc(mindMemories.updatedAt));
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
  if (!db) throw new Error("Database is not available");
  const now = new Date();
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

export async function listMemoryEvidenceForUser(input: { userId: number; memoryId: number }) {
  const mind = await getCreativeMindForUser(input.userId);
  if (!mind) return [];
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const memory = await db.select({ id: mindMemories.id }).from(mindMemories)
    .where(and(eq(mindMemories.id, input.memoryId), eq(mindMemories.mindId, mind.id))).limit(1);
  if (!memory[0]) return [];
  return db.select().from(memoryEvidence).where(eq(memoryEvidence.memoryId, input.memoryId)).orderBy(desc(memoryEvidence.createdAt));
}

export async function listMindActivityForUser(userId: number, limit = 12) {
  const mind = await ensureCreativeMindForUser(userId);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
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
}) {
  const mind = await ensureCreativeMindForUser(input.userId);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(feedbackEvents).values({ mindId: mind.id, ...input });
  const rows = await db.select().from(feedbackEvents).where(and(eq(feedbackEvents.mindId, mind.id), eq(feedbackEvents.userId, input.userId))).orderBy(desc(feedbackEvents.id)).limit(1);
  if (!rows[0]) throw new Error("Feedback event could not be saved");
  return rows[0];
}

export async function getMindStatsForUser(userId: number) {
  const mind = await ensureCreativeMindForUser(userId);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [memories, feedback] = await Promise.all([
    db.select().from(mindMemories).where(eq(mindMemories.mindId, mind.id)),
    db.select().from(feedbackEvents).where(and(eq(feedbackEvents.mindId, mind.id), eq(feedbackEvents.userId, userId))),
  ]);
  const averageConfidence = memories.length === 0 ? 0 : Math.round(memories.reduce((sum, memory) => sum + memory.confidence, 0) / memories.length);
  const strongPatterns = memories.filter(memory => memory.confidence >= 75 && memory.evidenceCount >= 2).length;
  return { mind, preferenceCount: memories.length, feedbackCount: feedback.length, strongPatterns, averageConfidence };
}

export type VideoJobStatus = "pending" | "processing" | "retrying" | "done" | "failed" | "cancelled";

type VideoJobUpdate = Partial<{
  status: VideoJobStatus;
  videoTitle: string | null;
  summary: string | null;
  topics: string[] | null;
  clips: ClipSuggestion[] | null;
  sourceNote: string | null;
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
}): Promise<VideoJob> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db.insert(videoJobs).values(input);
  const job = await getVideoJobForUser(input.id, input.userId);
  if (!job) throw new Error("Video job could not be created");
  return job;
}

export async function getVideoJobForUser(id: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

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
  if (!db) throw new Error("Database is not available");

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
  if (!db) throw new Error("Database is not available");

  return db
    .select()
    .from(videoJobs)
    .where(eq(videoJobs.userId, userId))
    .orderBy(desc(videoJobs.createdAt));
}

export async function updateVideoJobForUser(
  id: string,
  userId: number,
  changes: VideoJobUpdate
): Promise<VideoJob> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db
    .update(videoJobs)
    .set({ ...changes, updatedAt: new Date() } as Partial<InsertVideoJob>)
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
  if (!db) throw new Error("Database is not available");
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
  if (!db) throw new Error("Database is not available");
  const now = new Date();
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
  if (!db) throw new Error("Database is not available");
  await db.update(videoJobs).set({ ...changes, updatedAt: new Date() } as Partial<InsertVideoJob>)
    .where(and(eq(videoJobs.id, id), eq(videoJobs.workerToken, workerToken)));
  const jobs = await db.select().from(videoJobs).where(and(eq(videoJobs.id, id), eq(videoJobs.workerToken, workerToken))).limit(1);
  return jobs[0];
}

export async function isVideoJobCancelled(id: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const jobs = await db.select({ status: videoJobs.status }).from(videoJobs).where(eq(videoJobs.id, id)).limit(1);
  return jobs[0]?.status === "cancelled";
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function consumeAnalysisQuota(userId: number, maximum: number): Promise<{ allowed: boolean; used: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const usageDate = todayUtc();
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
  if (!db) throw new Error("Database is not available");
  const bucket = Math.floor(Date.now() / (input.windowMinutes * 60_000));
  const windowKey = `${input.windowMinutes}m-${bucket}`;
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
  if (!db) throw new Error("Database is not available");

  await db.insert(videoJobProgressEvents).values(input);
}

export async function listVideoJobProgressEventsForUser(input: {
  jobId: string;
  userId: number;
  afterId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

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
  if (!db) throw new Error("Database is not available");

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
  if (!db) throw new Error("Database is not available");
  await db.insert(pdfReportShares).values(input);
}

export async function getPdfReportShareByToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const results = await db.select().from(pdfReportShares).where(eq(pdfReportShares.token, token)).limit(1);
  return results[0];
}

export async function listActivePdfReportSharesForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const now = new Date();
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
  if (!db) throw new Error("Database is not available");
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
  if (!db) throw new Error("Database is not available");
  const result = await db.delete(pdfReportShares).where(or(
    isNotNull(pdfReportShares.revokedAt),
    lte(pdfReportShares.expiresAt, now)
  ));
  return Number((result as { rowsAffected?: number }).rowsAffected ?? 0);
}

export async function getPdfReportBranding(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const results = await db.select().from(pdfReportBranding).where(eq(pdfReportBranding.userId, userId)).limit(1);
  return results[0];
}

export async function upsertPdfReportBranding(input: { userId: number; coverTitle?: string; logoStorageKey?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await getPdfReportBranding(input.userId);
  const coverTitle = input.coverTitle ?? existing?.coverTitle ?? "Video Analysis Report";
  const logoStorageKey = input.logoStorageKey ?? existing?.logoStorageKey ?? null;
  await db.insert(pdfReportBranding).values({ userId: input.userId, coverTitle, logoStorageKey }).onDuplicateKeyUpdate({
    set: { coverTitle, logoStorageKey, updatedAt: new Date() },
  });
  const saved = await getPdfReportBranding(input.userId);
  if (!saved) throw new Error("Report branding could not be saved");
  return saved;
}
