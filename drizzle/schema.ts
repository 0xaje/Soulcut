import { date, index, int, json, mysqlEnum, mysqlTable, primaryKey, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

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

export const creativeMinds = mysqlTable(
  "creative_minds",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 140 }).default("SoulCut Creative Director").notNull(),
    externalMindId: varchar("externalMindId", { length: 64 }),
    externalStatus: mysqlEnum("externalStatus", ["not_linked", "verified", "unavailable"]).default("not_linked").notNull(),
    onboardedAt: timestamp("onboardedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("creative_minds_user_id_unique").on(table.userId)]
);

export type CreativeMind = typeof creativeMinds.$inferSelect;

export const mindMemories = mysqlTable(
  "mind_memories",
  {
    id: int("id").autoincrement().primaryKey(),
    mindId: varchar("mindId", { length: 32 })
      .notNull()
      .references(() => creativeMinds.id, { onDelete: "cascade" }),
    category: mysqlEnum("category", ["voice", "hook", "pacing", "caption", "visual", "audience", "editing", "storytelling", "topics", "avoidances", "format", "tone"])
      .notNull(),
    memoryKey: varchar("memoryKey", { length: 128 }).notNull(),
    value: text("value").notNull(),
    confidence: int("confidence").default(50).notNull(),
    source: mysqlEnum("source", ["explicit_creator_instruction", "feedback", "behavioral_pattern", "analysis_observation"])
      .notNull(),
    evidenceCount: int("evidenceCount").default(1).notNull(),
    lastReinforcedAt: timestamp("lastReinforcedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("mind_memories_mind_category_key_unique").on(table.mindId, table.category, table.memoryKey),
    index("mind_memories_mind_updated_idx").on(table.mindId, table.updatedAt),
  ]
);

export type MindMemory = typeof mindMemories.$inferSelect;

export const memoryEvidence = mysqlTable(
  "memory_evidence",
  {
    id: int("id").autoincrement().primaryKey(),
    memoryId: int("memoryId")
      .notNull()
      .references(() => mindMemories.id, { onDelete: "cascade" }),
    source: mysqlEnum("source", ["onboarding", "teaching", "feedback", "analysis", "selection"])
      .notNull(),
    sourceReference: varchar("sourceReference", { length: 128 }),
    detail: text("detail").notNull(),
    weight: int("weight").default(1).notNull(),
    confidenceBefore: int("confidenceBefore"),
    confidenceAfter: int("confidenceAfter"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("memory_evidence_memory_created_idx").on(table.memoryId, table.createdAt)]
);

export type MemoryEvidence = typeof memoryEvidence.$inferSelect;

export const creativePreferences = mysqlTable(
  "creative_preferences",
  {
    id: int("id").autoincrement().primaryKey(),
    mindId: varchar("mindId", { length: 32 })
      .notNull()
      .references(() => creativeMinds.id, { onDelete: "cascade" }),
    memoryId: int("memoryId")
      .notNull()
      .references(() => mindMemories.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 32 }).notNull(),
    label: varchar("label", { length: 160 }).notNull(),
    confidence: int("confidence").notNull(),
    source: varchar("source", { length: 64 }).notNull(),
    evidenceCount: int("evidenceCount").default(1).notNull(),
    lastUpdatedAt: timestamp("lastUpdatedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("creative_preferences_memory_id_unique").on(table.memoryId),
    index("creative_preferences_mind_updated_idx").on(table.mindId, table.lastUpdatedAt),
  ]
);

export type CreativePreference = typeof creativePreferences.$inferSelect;

export const feedbackEvents = mysqlTable(
  "feedback_events",
  {
    id: int("id").autoincrement().primaryKey(),
    mindId: varchar("mindId", { length: 32 })
      .notNull()
      .references(() => creativeMinds.id, { onDelete: "cascade" }),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: varchar("jobId", { length: 32 }).references(() => videoJobs.id, { onDelete: "set null" }),
    recommendationId: varchar("recommendationId", { length: 128 }),
    feedbackType: mysqlEnum("feedbackType", ["keep", "not_my_style", "teach"]).notNull(),
    reason: varchar("reason", { length: 80 }),
    feedbackText: text("feedbackText"),
    signalCategory: varchar("signalCategory", { length: 32 }),
    signalKey: varchar("signalKey", { length: 128 }),
    signalValue: varchar("signalValue", { length: 240 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("feedback_events_mind_created_idx").on(table.mindId, table.createdAt),
    index("feedback_events_user_created_idx").on(table.userId, table.createdAt),
    index("feedback_events_mind_signal_idx").on(table.mindId, table.signalKey, table.createdAt),
  ]
);

export type FeedbackEvent = typeof feedbackEvents.$inferSelect;

export const mindActivity = mysqlTable(
  "mind_activity",
  {
    id: int("id").autoincrement().primaryKey(),
    mindId: varchar("mindId", { length: 32 })
      .notNull()
      .references(() => creativeMinds.id, { onDelete: "cascade" }),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    memoryId: int("memoryId").references(() => mindMemories.id, { onDelete: "set null" }),
    activityType: mysqlEnum("activityType", ["learned", "updated", "reinforced", "detected"]).notNull(),
    message: varchar("message", { length: 320 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("mind_activity_mind_created_idx").on(table.mindId, table.createdAt),
    index("mind_activity_user_created_idx").on(table.userId, table.createdAt),
  ]
);

export type MindActivity = typeof mindActivity.$inferSelect;

export type ClipSuggestion = {
  startSeconds: number;
  endSeconds: number;
  title: string;
  hook: string;
  reason: string;
};

export type MindContextSnapshot = {
  preferences: Array<{
    category: string;
    value: string;
    confidence: number;
    evidenceCount: number;
  }>;
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
    mindContextSnapshot: json("mindContextSnapshot").$type<MindContextSnapshot | null>(),
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
