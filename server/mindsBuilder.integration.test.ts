import {
  BUILDER_API_KEY_ENV,
  createMindsClient,
  parseHumanIdFromBuilderApiKey,
} from "@animocabrands/minds-client-lib";
import { describe, expect, it } from "vitest";

const VERIFIED_MIND_ID = "8208493e-f36b-1410-8466-00039ce7df11";

describe("Animoca Minds Builder API", () => {
  const builderApiKey = process.env[BUILDER_API_KEY_ENV] || process.env.MINDS_API_KEY;
  const hasBuilderKey = Boolean(builderApiKey && parseHumanIdFromBuilderApiKey(builderApiKey));

  it.skipIf(!hasBuilderKey)("authenticates the configured Builder key and retrieves the configured live Mind", async () => {
    if (!builderApiKey) {
      throw new Error(`${BUILDER_API_KEY_ENV} is not configured.`);
    }
    if (!parseHumanIdFromBuilderApiKey(builderApiKey)) {
      throw new Error(`${BUILDER_API_KEY_ENV} does not contain a valid Builder API key payload.`);
    }

    const client = createMindsClient({ builderApiKey });
    const targetMindId = process.env.MINDS_BUILDER_MIND_ID || process.env.MINDS_MIND_ID || VERIFIED_MIND_ID;
    const mind = await client.getMind(targetMindId, AbortSignal.timeout(15_000));

    expect(mind.mindId).toBe(targetMindId);
  }, 20_000);
});
