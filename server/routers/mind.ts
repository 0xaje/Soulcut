import { z } from "zod";
import {
  createFeedbackEventForUser,
  ensureCreativeMindForUser,
  getCreativeMindForUser,
  getMindStatsForUser,
  getVideoJobForUser,
  listMemoryEvidenceForUser,
  listMindActivityForUser,
  listMindMemoriesForUser,
  markCreativeMindOnboarded,
  upsertMindMemoryForUser,
  type MindMemoryCategory,
} from "../db";
import { getMindsBuilderConnection } from "../mindsBuilder";
import { protectedProcedure, router } from "../_core/trpc";

const categories = ["voice", "hook", "pacing", "caption", "visual", "audience", "editing", "storytelling", "topics", "avoidances", "format", "tone"] as const;
const feedbackReasons = ["too_slow", "wrong_tone", "wrong_hook", "too_generic", "too_much_text", "not_my_audience", "other"] as const;

const compactText = (value: string) => value.replace(/\s+/g, " ").trim();
const memoryKey = (value: string) => compactText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 120) || "creator-preference";

function inferTeaching(lesson: string, category?: MindMemoryCategory) {
  const normalized = compactText(lesson);
  const lower = normalized.toLowerCase();
  const inferredCategory = category
    ?? (/(emoji|caption|subtitle|text)/.test(lower) ? "caption"
      : /(hook|opening|question|curiosity|statement)/.test(lower) ? "hook"
        : /(pace|pacing|intro|fast|slow)/.test(lower) ? "pacing"
          : /(audience|beginner|jargon|viewer)/.test(lower) ? "audience"
            : /(corporate|tone|conversational|humor|professional|voice)/.test(lower) ? "tone"
              : "format");
  return { category: inferredCategory as MindMemoryCategory, value: normalized };
}

function feedbackMemory(reason: (typeof feedbackReasons)[number] | undefined, text: string | null | undefined) {
  const explicit = compactText(text ?? "");
  if (explicit) return inferTeaching(explicit);
  switch (reason) {
    case "too_slow": return { category: "pacing" as const, value: "Avoid slow openings and reach the payoff sooner." };
    case "wrong_tone": return { category: "tone" as const, value: "Avoid a tone that does not sound like the creator." };
    case "wrong_hook": return { category: "hook" as const, value: "Prefer hooks that match the creator's established opening style." };
    case "too_generic": return { category: "hook" as const, value: "Prefer specific, distinctive hooks over generic framing." };
    case "too_much_text": return { category: "caption" as const, value: "Keep captions concise and avoid excessive on-screen text." };
    case "not_my_audience": return { category: "audience" as const, value: "Prioritize recommendations aligned with the creator's intended audience." };
    default: return { category: "format" as const, value: "The creator rejected this recommendation style." };
  }
}

function whyItFits(memory: Awaited<ReturnType<typeof listMindMemoriesForUser>>, clip: { hook: string; reason: string }) {
  const clipText = `${clip.hook} ${clip.reason}`.toLowerCase();
  const matching = memory.filter(item => item.value.toLowerCase().split(/\s+/).some(word => word.length > 4 && clipText.includes(word))).slice(0, 3);
  const evidence = matching.length ? matching : memory.slice(0, 3);
  return evidence.map(item => ({ memoryId: item.id, statement: item.value, confidence: item.confidence, evidenceCount: item.evidenceCount }));
}

export const mindRouter = router({
  getMind: protectedProcedure.query(async ({ ctx }) => {
    const mind = await ensureCreativeMindForUser(ctx.user.id);
    const builder = getMindsBuilderConnection();
    return { mind, builderAvailability: builder.availability, builderHumanId: builder.humanId };
  }),

  getCreativeDNA: protectedProcedure.query(async ({ ctx }) => {
    const [mind, memories, stats] = await Promise.all([
      ensureCreativeMindForUser(ctx.user.id),
      listMindMemoriesForUser(ctx.user.id),
      getMindStatsForUser(ctx.user.id),
    ]);
    return { mind, memories, stats };
  }),

  getMindMemories: protectedProcedure.query(({ ctx }) => listMindMemoriesForUser(ctx.user.id)),

  getMindActivity: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(30).optional() }).optional())
    .query(({ ctx, input }) => listMindActivityForUser(ctx.user.id, input?.limit ?? 12)),

  getMindStats: protectedProcedure.query(({ ctx }) => getMindStatsForUser(ctx.user.id)),

  getPreferenceEvidence: protectedProcedure
    .input(z.object({ memoryId: z.number().int().positive() }))
    .query(({ ctx, input }) => listMemoryEvidenceForUser({ userId: ctx.user.id, memoryId: input.memoryId })),

  completeOnboarding: protectedProcedure
    .input(z.object({
      voice: z.array(z.string().trim().min(1).max(80)).max(6),
      hooks: z.array(z.string().trim().min(1).max(80)).max(6),
      pacing: z.array(z.string().trim().min(1).max(80)).max(6),
      audience: z.string().trim().max(220).optional(),
      notes: z.string().trim().max(500).optional(),
    }).refine(input => input.voice.length + input.hooks.length + input.pacing.length > 0 || Boolean(input.audience?.trim()) || Boolean(input.notes?.trim()), {
      message: "Choose at least one creative preference or add an audience or note before teaching your Mind.",
    }))
    .mutation(async ({ ctx, input }) => {
      const initialMemories = [
        ...input.voice.map(value => ({ category: "voice" as const, value })),
        ...input.hooks.map(value => ({ category: "hook" as const, value })),
        ...input.pacing.map(value => ({ category: "pacing" as const, value })),
        ...(input.audience ? [{ category: "audience" as const, value: input.audience }] : []),
        ...(input.notes ? [inferTeaching(input.notes)] : []),
      ];
      for (const item of initialMemories) {
        await upsertMindMemoryForUser({
          userId: ctx.user.id,
          category: item.category,
          memoryKey: memoryKey(item.value),
          value: item.value,
          confidence: 86,
          source: "explicit_creator_instruction",
          evidence: { source: "onboarding", detail: item.value, weight: 3 },
          activity: { type: "learned", message: `Learned: ${item.value}` },
        });
      }
      return markCreativeMindOnboarded(ctx.user.id);
    }),

  teachMind: protectedProcedure
    .input(z.object({ lesson: z.string().trim().min(3).max(500), category: z.enum(categories).optional() }))
    .mutation(async ({ ctx, input }) => {
      const learned = inferTeaching(input.lesson, input.category);
      const memory = await upsertMindMemoryForUser({
        userId: ctx.user.id,
        category: learned.category,
        memoryKey: memoryKey(learned.value),
        value: learned.value,
        confidence: 92,
        source: "explicit_creator_instruction",
        evidence: { source: "teaching", detail: learned.value, weight: 4 },
        activity: { type: "learned", message: `Learned: ${learned.value}` },
      });
      return { memory, message: `Your Mind learned: ${learned.value}` };
    }),

  submitFeedback: protectedProcedure
    .input(z.object({
      jobId: z.string().min(8).max(32).optional(),
      recommendationId: z.string().min(1).max(128).optional(),
      feedbackType: z.enum(["keep", "not_my_style"]),
      reason: z.enum(feedbackReasons).optional(),
      feedbackText: z.string().trim().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.jobId) {
        const job = await getVideoJobForUser(input.jobId, ctx.user.id);
        if (!job) throw new Error("Video job not found.");
      }
      const feedbackEvent = await createFeedbackEventForUser({ userId: ctx.user.id, ...input });
      const learned = input.feedbackType === "keep"
        ? inferTeaching(input.feedbackText || "The creator approved this recommendation style.", "format")
        : feedbackMemory(input.reason, input.feedbackText);
      const memory = await upsertMindMemoryForUser({
        userId: ctx.user.id,
        category: learned.category,
        memoryKey: memoryKey(learned.value),
        value: learned.value,
        confidence: input.feedbackType === "keep" ? 66 : 78,
        source: "feedback",
        evidence: { source: "feedback", sourceReference: `feedback:${feedbackEvent.id}${input.jobId ? `:job:${input.jobId}` : ""}`, detail: learned.value, weight: input.feedbackType === "keep" ? 1 : 3 },
        activity: { type: input.feedbackType === "keep" ? "reinforced" : "updated", message: `${input.feedbackType === "keep" ? "Reinforced" : "Updated"}: ${learned.value}` },
      });
      return { memory, message: input.feedbackType === "keep" ? "Your Mind reinforced this preference." : "Your Mind updated your Creative DNA." };
    }),

  getPersonalizedRecommendations: protectedProcedure
    .input(z.object({ jobId: z.string().min(8).max(32) }))
    .query(async ({ ctx, input }) => {
      const job = await getVideoJobForUser(input.jobId, ctx.user.id);
      if (!job) throw new Error("Video job not found.");
      const memories = await listMindMemoriesForUser(ctx.user.id);
      const averageConfidence = memories.length ? Math.round(memories.reduce((sum, item) => sum + item.confidence, 0) / memories.length) : 0;
      return (job.clips ?? []).map((clip, index) => ({
        id: `clip-${index + 1}`,
        clip,
        fit: whyItFits(memories, clip),
        mindConfidence: averageConfidence,
      }));
    }),
});
