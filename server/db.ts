import { and, asc, desc, eq, gt, isNull, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  type ClipSuggestion,
  type InsertUser,
  type InsertVideoJob,
  type VideoJob,
  type VideoJobProgressStage,
  pdfReportBranding,
  pdfReportShares,
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

type VideoJobStatus = "pending" | "processing" | "done" | "failed";

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

export async function listVideoJobsForUser(userId: number): Promise<VideoJob[]> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  return db
    .select()
    .from(videoJobs)
    .where(eq(videoJobs.userId, userId))
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
