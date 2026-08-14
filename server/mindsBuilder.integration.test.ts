import {
  BUILDER_API_KEY_ENV,
  createMindsClient,
  parseHumanIdFromBuilderApiKey,
} from "@animocabrands/minds-client-lib";
import { describe, expect, it } from "vitest";

const VERIFIED_MIND_ID = "8208493e-f36b-1410-8466-00039ce7df11";

describe("Animoca Minds Builder API", () => {
  it("authenticates the configured Builder key and retrieves the configured live Mind", async () => {
    const builderApiKey = process.env[BUILDER_API_KEY_ENV];
    if (!builderApiKey) {
      throw new Error(`${BUILDER_API_KEY_ENV} is not configured.`);
    }
    if (!parseHumanIdFromBuilderApiKey(builderApiKey)) {
      throw new Error(`${BUILDER_API_KEY_ENV} does not contain a valid Builder API key payload.`);
    }

    const client = createMindsClient({ builderApiKey });
    const mind = await client.getMind(VERIFIED_MIND_ID, AbortSignal.timeout(15_000));

    expect(mind.mindId).toBe(VERIFIED_MIND_ID);
  }, 20_000);
});
