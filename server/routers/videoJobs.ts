import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  createVideoJobProgressEvent,
  createVideoJob,
  getVideoJobForUser,
  listVideoJobProgressEventsForUser,
  listVideoJobsForUser,
  updateVideoJobForUser,
} from "../db";
import { analyzeVideoUrl, isPublicVideoUrl } from "../videoAnalysis";
import { protectedProcedure, router } from "../_core/trpc";

const videoUrlInput = z
  .string()
  .trim()
  .url("Enter a valid public video URL.")
  .max(2048)
  .refine(isPublicVideoUrl, "Enter a public video URL rather than a local or private address.");

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
