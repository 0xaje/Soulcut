import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  archiveVideoJobForUser,
  cancelVideoJobForUser,
  consumeAnalysisQuota,
  consumeRateLimit,
  createVideoJobProgressEvent,
  createPdfReportShare,
  createVideoJob,
  deleteVideoJobForUser,
  getPdfReportBranding,
  getVideoJobForUser,
  listActivePdfReportSharesForUser,
  listAllVideoJobProgressEventsForUser,
  listAllVideoJobsForUser,
  listVideoJobProgressEventsForUser,
  listVideoJobsForUser,
  revokePdfReportShareForUser,
  upsertPdfReportBranding,
  updateVideoJobForUser,
} from "../db";
import { buildJobHistoryCsv } from "../jobHistoryCsv";
import { buildJobPdfReport } from "../jobPdfReport";
import { storageGet, storageGetSignedUrl, storagePut } from "../storage";
import { isPublicVideoUrl } from "../videoAnalysis";
import { protectedProcedure, router } from "../_core/trpc";

const videoUrlInput = z
  .string()
  .trim()
  .url("Enter a valid public video URL.")
  .max(2048)
  .refine(isPublicVideoUrl, "Enter a public video URL rather than a local or private address.");

const shareExpiryInput = z.number().int().min(1).max(24 * 365);
const brandingTitleInput = z.string().trim().min(3).max(140);
const jobIdInput = z.object({ id: z.string().min(8).max(32) });
const ANALYSIS_SUBMISSION_RATE_LIMIT = { scope: "analysis-submission", maximum: 10, windowMinutes: 60 } as const;
const DAILY_ANALYSIS_QUOTA = 20;
const jobListInput = z.object({
  includeArchived: z.boolean().optional(),
  search: z.string().trim().max(256).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  statuses: z.array(z.enum(["pending", "processing", "retrying", "done", "failed", "cancelled"])).max(6).optional(),
}).optional();

function dateRangeFromInput(input: { startDate?: string; endDate?: string }) {
  const startDate = input.startDate ? new Date(`${input.startDate}T00:00:00.000Z`) : undefined;
  const endDate = input.endDate ? new Date(`${input.endDate}T23:59:59.999Z`) : undefined;
  return { startDate, endDate };
}

async function consumeSubmissionCapacity(userId: number) {
  const rateAllowed = await consumeRateLimit({ userId, ...ANALYSIS_SUBMISSION_RATE_LIMIT });
  if (!rateAllowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "You have reached the submission limit of 10 analyses per hour. Please try again later.",
    });
  }

  const quota = await consumeAnalysisQuota(userId, DAILY_ANALYSIS_QUOTA);
  if (!quota.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "You have reached the daily limit of 20 analyses. Please try again tomorrow.",
    });
  }
}

async function loadPdfBranding(userId: number) {
  const branding = await getPdfReportBranding(userId);
  if (!branding?.logoStorageKey) return { coverTitle: branding?.coverTitle };
  const signedUrl = await storageGetSignedUrl(branding.logoStorageKey);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error("Saved report logo could not be loaded.");
  return { coverTitle: branding.coverTitle, logoBuffer: Buffer.from(await response.arrayBuffer()) };
}

export const videoJobsRouter = router({
  list: protectedProcedure.input(jobListInput).query(({ ctx, input }) =>
    listVideoJobsForUser(ctx.user.id, {
      includeArchived: input?.includeArchived,
      search: input?.search,
      statuses: input?.statuses,
      ...dateRangeFromInput(input ?? {}),
    })
  ),

  get: protectedProcedure
    .input(z.object({ id: z.string().min(8).max(32) }))
    .query(async ({ ctx, input }) => {
      const job = await getVideoJobForUser(input.id, ctx.user.id);
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Video job not found." });
      return job;
    }),

  timeline: protectedProcedure
    .input(z.object({ id: z.string().min(8).max(32) }))
    .query(async ({ ctx, input }) => {
      const job = await getVideoJobForUser(input.id, ctx.user.id);
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Video job not found." });
      return listVideoJobProgressEventsForUser({ jobId: job.id, userId: ctx.user.id });
    }),

  exportCsv: protectedProcedure.mutation(async ({ ctx }) => {
    const [jobs, events] = await Promise.all([
      listAllVideoJobsForUser(ctx.user.id),
      listAllVideoJobProgressEventsForUser(ctx.user.id),
    ]);
    const dateStamp = new Date().toISOString().slice(0, 10);
    return {
      filename: `soulcut-job-history-${dateStamp}.csv`,
      csv: buildJobHistoryCsv(jobs, events),
    };
  }),

  exportPdf: protectedProcedure
    .input(z.object({ id: z.string().min(8).max(32) }))
    .mutation(async ({ ctx, input }) => {
      const job = await getVideoJobForUser(input.id, ctx.user.id);
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Video job not found." });
      const events = await listVideoJobProgressEventsForUser({ jobId: job.id, userId: ctx.user.id });
      const pdf = await buildJobPdfReport(job, events, await loadPdfBranding(ctx.user.id), job.mindContextSnapshot);
      return {
        filename: `soulcut-report-${job.id}.pdf`,
        base64: pdf.toString("base64"),
      };
    }),

  createPdfShare: protectedProcedure
    .input(z.object({ id: z.string().min(8).max(32), expiresInHours: shareExpiryInput }))
    .mutation(async ({ ctx, input }) => {
      const job = await getVideoJobForUser(input.id, ctx.user.id);
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Video job not found." });
      const events = await listVideoJobProgressEventsForUser({ jobId: job.id, userId: ctx.user.id });
      const pdf = await buildJobPdfReport(job, events, await loadPdfBranding(ctx.user.id));
      const token = nanoid(40);
      const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000);
      const stored = await storagePut(
        `report-shares/${ctx.user.id}/${job.id}-${token}.pdf`,
        pdf,
        "application/pdf"
      );
      await createPdfReportShare({
        token,
        jobId: job.id,
        userId: ctx.user.id,
        storageKey: stored.key,
        expiresAt,
      });
      return { sharePath: `/share/report/${token}`, expiresAt };
    }),

  listPdfShares: protectedProcedure.query(({ ctx }) => listActivePdfReportSharesForUser(ctx.user.id)),

  revokePdfShare: protectedProcedure
    .input(z.object({ token: z.string().min(24).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const revoked = await revokePdfReportShareForUser({ token: input.token, userId: ctx.user.id });
      if (!revoked) throw new TRPCError({ code: "NOT_FOUND", message: "Active share link not found." });
      return { success: true };
    }),

  getPdfBranding: protectedProcedure.query(async ({ ctx }) => {
    const branding = await getPdfReportBranding(ctx.user.id);
    const logoUrl = branding?.logoStorageKey ? (await storageGet(branding.logoStorageKey)).url : null;
    return { coverTitle: branding?.coverTitle ?? "Video Analysis Report", logoUrl };
  }),

  setPdfCoverTitle: protectedProcedure
    .input(z.object({ coverTitle: brandingTitleInput }))
    .mutation(async ({ ctx, input }) => {
      const branding = await upsertPdfReportBranding({ userId: ctx.user.id, coverTitle: input.coverTitle });
      const logoUrl = branding.logoStorageKey ? (await storageGet(branding.logoStorageKey)).url : null;
      return { coverTitle: branding.coverTitle, logoUrl };
    }),

  uploadPdfLogo: protectedProcedure
    .input(z.object({ dataUrl: z.string().max(2_800_000) }))
    .mutation(async ({ ctx, input }) => {
      const match = input.dataUrl.match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/);
      if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Upload a PNG or JPEG logo." });
      const contentType = match[1];
      const image = Buffer.from(match[2], "base64");
      const validMagic = contentType === "image/png"
        ? image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : image.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
      if (!validMagic || image.length > 2_000_000) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Upload a valid image smaller than 2 MB." });
      }
      const extension = contentType === "image/png" ? "png" : "jpg";
      const stored = await storagePut(`report-branding/${ctx.user.id}/logo.${extension}`, image, contentType);
      const branding = await upsertPdfReportBranding({ userId: ctx.user.id, logoStorageKey: stored.key });
      return { coverTitle: branding.coverTitle, logoUrl: stored.url };
    }),

  archive: protectedProcedure
    .input(jobIdInput)
    .mutation(async ({ ctx, input }) => {
      const job = await getVideoJobForUser(input.id, ctx.user.id);
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Video job not found." });
      if (["pending", "processing", "retrying"].includes(job.status)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Cancel an active analysis before archiving it.",
        });
      }
      return archiveVideoJobForUser(job.id, ctx.user.id);
    }),

  restore: protectedProcedure
    .input(jobIdInput)
    .mutation(async ({ ctx, input }) => {
      const job = await getVideoJobForUser(input.id, ctx.user.id);
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Video job not found." });
      if (!job.archivedAt) {
        throw new TRPCError({ code: "CONFLICT", message: "This brief is already in your active history." });
      }
      return updateVideoJobForUser(job.id, ctx.user.id, { archivedAt: null });
    }),

  cancel: protectedProcedure
    .input(jobIdInput)
    .mutation(async ({ ctx, input }) => {
      const job = await cancelVideoJobForUser(input.id, ctx.user.id);
      if (!job) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Only queued or active analyses can be cancelled.",
        });
      }
      await createVideoJobProgressEvent({
        jobId: job.id,
        userId: ctx.user.id,
        stage: "cancelled",
        message: "Analysis cancelled by the workspace user.",
      });
      return job;
    }),

  delete: protectedProcedure
    .input(jobIdInput)
    .mutation(async ({ ctx, input }) => {
      const job = await getVideoJobForUser(input.id, ctx.user.id);
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Video job not found." });
      if (["pending", "processing", "retrying"].includes(job.status)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Cancel an active analysis before permanently deleting it.",
        });
      }
      const deleted = await deleteVideoJobForUser(job.id, ctx.user.id);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Video job not found." });
      return { success: true };
    }),

  create: protectedProcedure
    .input(z.object({ videoUrl: videoUrlInput }))
    .mutation(async ({ ctx, input }) => {
      await consumeSubmissionCapacity(ctx.user.id);
      const job = await createVideoJob({ id: nanoid(), userId: ctx.user.id, videoUrl: input.videoUrl });
      const queuedJob = await updateVideoJobForUser(job.id, ctx.user.id, { startedAt: new Date() });
      await createVideoJobProgressEvent({
        jobId: queuedJob.id,
        userId: ctx.user.id,
        stage: "queued",
        message: "Analysis queued. A worker will begin shortly.",
      });
      return queuedJob;
    }),

  run: protectedProcedure
    .input(jobIdInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await getVideoJobForUser(input.id, ctx.user.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Video job not found." });
      if (existing.status === "done") return existing;
      if (existing.archivedAt) {
        throw new TRPCError({ code: "CONFLICT", message: "Restore this archived job before running it again." });
      }
      if (existing.status === "processing" || existing.status === "retrying") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This video is already queued for analysis.",
        });
      }
      if (existing.status === "pending" && existing.startedAt) return existing;

      await consumeSubmissionCapacity(ctx.user.id);

      const job = await updateVideoJobForUser(existing.id, ctx.user.id, {
        status: "pending",
        failureReason: null,
        startedAt: new Date(),
        completedAt: null,
        cancelledAt: null,
        nextAttemptAt: null,
        workerToken: null,
        workerClaimedAt: null,
      });
      await createVideoJobProgressEvent({
        jobId: existing.id,
        userId: ctx.user.id,
        stage: "queued",
        message: "Analysis queued. A worker will begin shortly.",
      });
      return job;
    }),
});
