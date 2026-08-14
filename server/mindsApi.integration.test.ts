import { describe, expect, it } from "vitest";

const MINDS_API_BASE_URL = "https://api.getminds.ai/v1";

describe("Minds API credential", () => {
  const apiKey = process.env.MINDS_API_KEY;
  const hasOfficialResearchApiKey = apiKey?.startsWith("minds_") ?? false;

  it.skipIf(!hasOfficialResearchApiKey)("authenticates the configured server-only Minds research API key", async () => {
    if (!apiKey?.startsWith("minds_")) {
      throw new Error("MINDS_API_KEY must be a dedicated official Minds API key beginning with minds_.");
    }

    const response = await fetch(`${MINDS_API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => null) as { id?: string; data?: { id?: string } } | null;
    const accountId = payload?.id ?? payload?.data?.id;

    expect(response.status, "Minds API credential must authenticate successfully.").toBe(200);
    expect(accountId).toEqual(expect.any(String));
  });
});
