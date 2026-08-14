import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("videoJobs authorization", () => {
  it("does not allow an anonymous caller to read user-specific video job history", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(caller.videoJobs.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.videoJobs.timeline({ id: "sample-job" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
