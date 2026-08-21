import { z } from "zod";
import {
  createFeedbackEventForUser,
  ensureCreativeMindForUser,
  getFeedbackSignalSummaryForUser,
  listMindConfidenceEvolutionForUser,
  getCreativeMindForUser,
  getMindStatsForUser,
  getVideoJobForUser,
  listMemoryEvidenceForUser,
  listMindActivityForUser,
  listMindMemoriesForUser,
  listRecommendationComparisonForUser,
  markCreativeMindOnboarded,
  setMindMemoryRetirementForUser,
  updateMindMemoryForUser,
  upsertMindMemoryForUser,
  type MindMemoryCategory,
} from "../db";
import { getMindsBuilderConnection } from "../mindsBuilder";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM, getDefaultModel } from "../_core/llm";
import { formatCreativeMindGuidance } from "../videoAnalysis";
import { getCreativeMindAnalysisContextForUser } from "../mindAnalysisContext";

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
  return memory
    .filter(item => item.value.toLowerCase().split(/[^a-z0-9]+/).some(word => word.length > 4 && clipText.includes(word)))
    .slice(0, 3)
    .map(item => ({ memoryId: item.id, statement: item.value, confidence: item.confidence, evidenceCount: item.evidenceCount, source: item.source }));
}

function recommendationSignal(job: { clips: Array<{ hook: string; reason: string }> | null } | null | undefined, recommendationId: string | undefined) {
  if (!job || !recommendationId) return null;
  const match = recommendationId.match(/^clip-(\d+)$/);
  const clipIndex = match ? Number(match[1]) - 1 : -1;
  const clip = clipIndex >= 0 ? job.clips?.[clipIndex] : undefined;
  if (!clip) return null;
  const hook = `${clip.hook} ${clip.reason}`.toLowerCase();
  if (hook.includes("?")) return { category: "hook" as const, key: "hook-question-first", value: "Question-first hooks" };
  if (/(problem|mistake|wrong|struggling|challenge)/.test(hook)) return { category: "hook" as const, key: "hook-problem-first", value: "Problem-first hooks" };
  if (/(curious|curiosity|wonder|surprising|unexpected)/.test(hook)) return { category: "hook" as const, key: "hook-curiosity-driven", value: "Curiosity-driven hooks" };
  return null;
}

function behavioralConfidence(keepCount: number, notMyStyleCount: number) {
  const total = keepCount + notMyStyleCount;
  if (!total) return 0;
  return Math.min(96, Math.round(55 + (Math.max(keepCount, notMyStyleCount) / total) * 35 + Math.min(8, total * 2)));
}

export const mindRouter = router({
  getMind: protectedProcedure.query(async ({ ctx }) => {
    const mind = await ensureCreativeMindForUser(ctx.user.id);
    const builder = getMindsBuilderConnection();
    return { mind, builderAvailability: builder.availability, builderHumanId: builder.humanId };
  }),

  getCreativeDNA: protectedProcedure
    .input(z.object({ includeRetired: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
    const [mind, memories, stats, confidenceEvolution] = await Promise.all([
      ensureCreativeMindForUser(ctx.user.id),
      listMindMemoriesForUser(ctx.user.id, { includeRetired: input?.includeRetired }),
      getMindStatsForUser(ctx.user.id),
      listMindConfidenceEvolutionForUser(ctx.user.id),
    ]);
    return {
      mind,
      memories: memories.map(memory => ({ ...memory, confidenceEvolution: confidenceEvolution.get(memory.id) ?? null })),
      stats,
    };
    }),

  getMindMemories: protectedProcedure
    .input(z.object({ includeRetired: z.boolean().optional() }).optional())
    .query(({ ctx, input }) => listMindMemoriesForUser(ctx.user.id, { includeRetired: input?.includeRetired })),

  getMindActivity: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(30).optional() }).optional())
    .query(({ ctx, input }) => listMindActivityForUser(ctx.user.id, input?.limit ?? 12)),

  getMindStats: protectedProcedure.query(({ ctx }) => getMindStatsForUser(ctx.user.id)),

  getRecommendationComparison: protectedProcedure.query(({ ctx }) => listRecommendationComparisonForUser(ctx.user.id)),

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

  updatePreference: protectedProcedure
    .input(z.object({ memoryId: z.number().int().positive(), value: z.string().trim().min(3).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const memory = await updateMindMemoryForUser({ userId: ctx.user.id, memoryId: input.memoryId, value: compactText(input.value) });
      if (!memory) throw new Error("Preference not found or already retired.");
      return { memory, message: "Your Mind preference was refined." };
    }),

  retirePreference: protectedProcedure
    .input(z.object({ memoryId: z.number().int().positive(), reason: z.string().trim().max(320).optional() }))
    .mutation(async ({ ctx, input }) => {
      const memory = await setMindMemoryRetirementForUser({ userId: ctx.user.id, memoryId: input.memoryId, retired: true, reason: input.reason });
      if (!memory) throw new Error("Preference not found.");
      return { memory, message: "This preference will no longer guide future analysis." };
    }),

  restorePreference: protectedProcedure
    .input(z.object({ memoryId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const memory = await setMindMemoryRetirementForUser({ userId: ctx.user.id, memoryId: input.memoryId, retired: false });
      if (!memory) throw new Error("Preference not found.");
      return { memory, message: "This preference can guide future analysis again." };
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
      let job: Awaited<ReturnType<typeof getVideoJobForUser>> | undefined;
      if (input.jobId) {
        job = await getVideoJobForUser(input.jobId, ctx.user.id);
        if (!job) throw new Error("Video job not found.");
      }
      const signal = recommendationSignal(job, input.recommendationId);
      const feedbackEvent = await createFeedbackEventForUser({
        userId: ctx.user.id,
        ...input,
        signalCategory: signal?.category,
        signalKey: signal?.key,
        signalValue: signal?.value,
      });
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
      let behavioralMemory = null;
      if (signal) {
        const summary = await getFeedbackSignalSummaryForUser({ userId: ctx.user.id, signalKey: signal.key });
        const dominantType = summary.keepCount > summary.notMyStyleCount ? "keep" : summary.notMyStyleCount > summary.keepCount ? "not_my_style" : null;
        const dominantCount = dominantType === "keep" ? summary.keepCount : dominantType === "not_my_style" ? summary.notMyStyleCount : 0;
        if (dominantType && dominantCount >= 2) {
          const value = dominantType === "keep" ? `Frequently keeps ${signal.value.toLowerCase()}.` : `Frequently rejects ${signal.value.toLowerCase()}.`;
          behavioralMemory = await upsertMindMemoryForUser({
            userId: ctx.user.id,
            category: signal.category,
            memoryKey: `behavioral-${signal.key}-${dominantType}`,
            value,
            confidence: behavioralConfidence(summary.keepCount, summary.notMyStyleCount),
            source: "behavioral_pattern",
            evidence: {
              source: "selection",
              sourceReference: `feedback:${feedbackEvent.id}:signal:${signal.key}`,
              detail: `${summary.keepCount} kept and ${summary.notMyStyleCount} rejected recommendations with ${signal.value.toLowerCase()}.`,
              weight: 1,
            },
            activity: { type: "detected", message: `Detected: ${value}` },
          });
        }
      }
      return {
        memory,
        behavioralMemory,
        message: behavioralMemory
          ? "Your Mind detected a pattern from your repeated choices."
          : input.feedbackType === "keep"
            ? "Your Mind reinforced this preference."
            : "Your Mind updated your Creative DNA.",
      };
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
      })).map(recommendation => {
        const explanationConfidence = recommendation.fit.length
          ? Math.round(recommendation.fit.reduce((sum, item) => sum + item.confidence, 0) / recommendation.fit.length)
          : 0;
        return {
          ...recommendation,
          explanation: {
            confidence: explanationConfidence,
            summary: recommendation.fit.length
              ? `This recommendation matches ${recommendation.fit.length} documented Creative DNA preference${recommendation.fit.length === 1 ? "" : "s"}.`
              : "Your Mind does not yet have a documented preference that directly matches this recommendation.",
            evidence: recommendation.fit,
          },
        };
      });
    }),

  reangleHook: protectedProcedure
    .input(
      z.object({
        originalHook: z.string().min(3).max(300),
        clipTitle: z.string().max(200).optional(),
        angle: z.enum(["urgent", "question", "contrarian", "story"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const mindContext = await getCreativeMindAnalysisContextForUser(ctx.user.id);
      const anglePrompts: Record<string, string> = {
        urgent: "High urgency and FOMO opening that creates immediate stakes in under 14 words.",
        question: "Compelling open-ended question that triggers intense curiosity and psychological tension.",
        contrarian: "Counter-intuitive hot take or myth-buster that challenges common industry assumptions.",
        story: "Immersive personal epiphany opening ('The moment I realized...').",
      };

      const prompt = `You are SoulCut's AI Creative Director. Re-angle this video hook according to the requested angle: "${anglePrompts[input.angle] || input.angle}".
Original hook: "${input.originalHook}"
${input.clipTitle ? `Clip Title: "${input.clipTitle}"` : ""}
${formatCreativeMindGuidance(mindContext)}

Respond ONLY with a valid JSON object matching this schema:
{
  "hook": "re-angled hook text string (max 180 chars)"
}`;

      try {
        const response = await invokeLLM({
          model: getDefaultModel(),
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
          maxTokens: 150,
        });
        const rawContent = response.choices[0]?.message?.content;
        const contentStr = typeof rawContent === "string" ? rawContent : "{}";
        const parsed = JSON.parse(contentStr || "{}");
        return {
          hook: (parsed.hook as string) || input.originalHook,
          angle: input.angle,
        };
      } catch {
        return {
          hook: input.originalHook,
          angle: input.angle,
        };
      }
    }),
});
