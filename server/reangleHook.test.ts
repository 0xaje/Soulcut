import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { mindRouter } from "./routers/mind";

vi.mock("./mindAnalysisContext", () => ({
  getCreativeMindAnalysisContextForUser: vi.fn().mockResolvedValue({
    preferences: [{ category: "hook", value: "Question-first hooks", confidence: 90, evidenceCount: 3 }],
  }),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({ hook: "Are you making this fatal creator mistake?" }),
        },
      },
    ],
  }),
  getDefaultModel: vi.fn().mockReturnValue("gpt-4o-mini"),
}));

describe("reangleHook mutation", () => {
  it("re-angles a hook into question format based on Creative DNA context", async () => {
    const caller = mindRouter.createCaller({
      user: { id: 1 },
      req: {},
      res: {},
    } as unknown as TrpcContext);

    const result = await caller.reangleHook({
      originalHook: "Most creators quit in month 1.",
      clipTitle: "Why creators fail",
      angle: "question",
    });

    expect(result.hook).toBe("Are you making this fatal creator mistake?");
    expect(result.angle).toBe("question");
  });
});
