import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

const anonymousContext = { user: null, req: {}, res: {} } as unknown as TrpcContext;

describe("Mind API authorization", () => {
  it("rejects unauthenticated Mind reads and writes", async () => {
    const caller = appRouter.createCaller(anonymousContext);
    await expect(caller.mind.getMind()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.mind.getCreativeDNA()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.mind.getPreferenceEvidence({ memoryId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.mind.teachMind({ lesson: "Keep captions concise." })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.mind.submitFeedback({ feedbackType: "keep" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
