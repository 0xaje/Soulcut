import { date, index, int, json, mysqlEnum, mysqlTable, primaryKey, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type ClipSuggestion = {
  startSeconds: number;
  endSeconds: number;
  title: string;
  hook: string;
  reason: string;
};

export const videoJobs = mysqlTable(
  "video_jobs",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    videoUrl: varchar("videoUrl", { length: 2048 }).notNull(),
    videoTitle: varchar("videoTitle", { length: 512 }),
    status: mysqlEnum("status", ["pending", "processing", "retrying", "done", "failed", "cancelled"])
      .default("pending")
      .notNull(),
    summary: text("summary"),
    topics: json("topics").$type<string[]>(),
    clips: json("clips").$type<ClipSuggestion[]>(),
    sourceNote: text("sourceNote"),
    model: varchar("model", { length: 128 }),
    failureReason: text("failureReason"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    archivedAt: timestamp("archivedAt"),
    cancelledAt: timestamp("cancelledAt"),
    attemptCount: int("attemptCount").default(0).notNull(),
    maxAttempts: int("maxAttempts").default(3).notNull(),
    nextAttemptAt: timestamp("nextAttemptAt"),
    workerToken: varchar("workerToken", { length: 64 }),
    workerClaimedAt: timestamp("workerClaimedAt"),
    lastAttemptAt: timestamp("lastAttemptAt"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("video_jobs_user_created_idx").on(table.userId, table.createdAt),
    index("video_jobs_queue_idx").on(table.status, table.nextAttemptAt, table.createdAt),
  ]
);

export type VideoJob = typeof videoJobs.$inferSelect;
export type InsertVideoJob = typeof videoJobs.$inferInsert;

export const videoJobProgressEvents = mysqlTable(
  "video_job_progress_events",
  {
    id: int("id").autoincrement().primaryKey(),
    jobId: varchar("jobId", { length: 32 })
      .notNull()
      .references(() => videoJobs.id, { onDelete: "cascade" }),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stage: mysqlEnum("stage", ["queued", "reading", "analyzing", "clips", "retrying", "complete", "failed", "cancelled"])
      .notNull(),
    message: varchar("message", { length: 512 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("video_job_progress_events_job_id_idx").on(table.jobId, table.id),
    index("video_job_progress_events_user_id_idx").on(table.userId, table.id),
  ]
);

export type VideoJobProgressEvent = typeof videoJobProgressEvents.$inferSelect;
export type VideoJobProgressStage = NonNullable<VideoJobProgressEvent["stage"]>;

export const pdfReportShares = mysqlTable(
  "pdf_report_shares",
  {
    id: int("id").autoincrement().primaryKey(),
    token: varchar("token", { length: 64 }).notNull().unique(),
    jobId: varchar("jobId", { length: 32 })
      .notNull()
      .references(() => videoJobs.id, { onDelete: "cascade" }),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storageKey: varchar("storageKey", { length: 1024 }).notNull(),
    expiresAt: timestamp("expiresAt"),
    revokedAt: timestamp("revokedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("pdf_report_shares_job_user_idx").on(table.jobId, table.userId),
    index("pdf_report_shares_token_idx").on(table.token),
  ]
);

export type PdfReportShare = typeof pdfReportShares.$inferSelect;

export const pdfReportBranding = mysqlTable("pdf_report_branding", {
  userId: int("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  coverTitle: varchar("coverTitle", { length: 140 }).default("Video Analysis Report").notNull(),
  logoStorageKey: varchar("logoStorageKey", { length: 1024 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PdfReportBranding = typeof pdfReportBranding.$inferSelect;

export const analysisUsage = mysqlTable(
  "analysis_usage",
  {
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    usageDate: date("usageDate").notNull(),
    analysisCount: int("analysisCount").default(0).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [primaryKey({ columns: [table.userId, table.usageDate] })]
);

export const requestRateLimits = mysqlTable(
  "request_rate_limits",
  {
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scope: varchar("scope", { length: 64 }).notNull(),
    windowKey: varchar("windowKey", { length: 32 }).notNull(),
    requestCount: int("requestCount").default(0).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [primaryKey({ columns: [table.userId, table.scope, table.windowKey] })]
);
