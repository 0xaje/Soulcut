import { describe, expect, it } from "vitest";
import { createConfiguredMindsBuilderClient, getMindsBuilderConnection, getVerifiedBuilderMind } from "./mindsBuilder";

describe("Minds Builder adapter", () => {
  it("reports a truthful unavailable state without a configured Builder key", async () => {
    expect(getMindsBuilderConnection("")).toEqual({
      availability: "unavailable",
      humanId: null,
      reason: "not_configured",
    });
    expect(createConfiguredMindsBuilderClient("")).toBeNull();
    await expect(getVerifiedBuilderMind("8208493e-f36b-1410-8466-00039ce7df11", { apiKey: "" })).resolves.toEqual({
      state: "unavailable",
      reason: "not_configured",
    });
  });

  it("does not create a client for a malformed Builder key", () => {
    expect(getMindsBuilderConnection("not-a-builder-key")).toEqual({
      availability: "unavailable",
      humanId: null,
      reason: "invalid_key",
    });
    expect(createConfiguredMindsBuilderClient("not-a-builder-key")).toBeNull();
  });
});
