import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  createVideoJobProgressEvent,
  createPdfReportShare,
  createVideoJob,
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
import { analyzeVideoUrl, isPublicVideoUrl } from "../videoAnalysis";
import { protectedProcedure, router } from "../_core/trpc";

const videoUrlInput = z
  .string()
  .trim()
  .url("Enter a valid public video URL.")
  .max(2048)
  .refine(isPublicVideoUrl, "Enter a public video URL rather than a local or private address.");

const shareExpiryInput = z.number().int().min(1).max(24 * 365);
const brandingTitleInput = z.string().trim().min(3).max(140);

async function loadPdfBranding(userId: number) {
  const branding = await getPdfReportBranding(userId);
  if (!branding?.logoStorageKey) return { coverTitle: branding?.coverTitle };
  const signedUrl = await storageGetSignedUrl(branding.logoStorageKey);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error("Saved report logo could not be loaded.");
  return { coverTitle: branding.coverTitle, logoBuffer: Buffer.from(await response.arrayBuffer()) };
}

export const videoJobsRouter = router({
  list: protectedProcedure.query(({ ctx }) => listVideoJobsForUser(ctx.user.id)),

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
      const pdf = await buildJobPdfReport(job, events, await loadPdfBranding(ctx.user.id));
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

  create: protectedProcedure
    .input(z.object({ videoUrl: videoUrlInput }))
    .mutation(({ ctx, input }) =>
      createVideoJob({ id: nanoid(), userId: ctx.user.id, videoUrl: input.videoUrl })
    ),

  run: protectedProcedure
    .input(z.object({ id: z.string().min(8).max(32) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getVideoJobForUser(input.id, ctx.user.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Video job not found." });
      if (existing.status === "done") return existing;
      if (existing.status === "processing") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This video is already being analyzed.",
        });
      }

      await updateVideoJobForUser(existing.id, ctx.user.id, {
        status: "processing",
        failureReason: null,
        startedAt: new Date(),
        completedAt: null,
      });
      await createVideoJobProgressEvent({
        jobId: existing.id,
        userId: ctx.user.id,
        stage: "queued",
        message: "Analysis queued. Preparing the source.",
      });
      await createVideoJobProgressEvent({
        jobId: existing.id,
        userId: ctx.user.id,
        stage: "reading",
        message: "Reading accessible video context and metadata.",
      });

      try {
        await createVideoJobProgressEvent({
          jobId: existing.id,
          userId: ctx.user.id,
          stage: "analyzing",
          message: "Distilling the core story and key topics.",
        });
        const analysis = await analyzeVideoUrl(existing.videoUrl);
        await createVideoJobProgressEvent({
          jobId: existing.id,
          userId: ctx.user.id,
          stage: "clips",
          message: "Shaping grounded short-form clip recommendations.",
        });
        const job = await updateVideoJobForUser(existing.id, ctx.user.id, {
          status: "done",
          summary: analysis.summary,
          topics: analysis.topics,
          clips: analysis.clips,
          sourceNote: analysis.sourceNote,
          model: "gpt-5-mini",
          completedAt: new Date(),
        });
        await createVideoJobProgressEvent({
          jobId: existing.id,
          userId: ctx.user.id,
          stage: "complete",
          message: "Your video brief is ready.",
        });
        return job;
      } catch (error) {
        const failureReason = error instanceof Error ? error.message : "Analysis failed unexpectedly.";
        await updateVideoJobForUser(existing.id, ctx.user.id, {
          status: "failed",
          failureReason: failureReason.slice(0, 1800),
          completedAt: new Date(),
        });
        await createVideoJobProgressEvent({
          jobId: existing.id,
          userId: ctx.user.id,
          stage: "failed",
          message: "The analysis could not be completed.",
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "We could not analyze this video. Please verify that it is publicly accessible and try again.",
        });
      }
    }),
});
