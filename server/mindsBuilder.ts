import {
  type BuilderMind,
  type MindsClient,
  MindsApiError,
  createMindsClient,
  parseHumanIdFromBuilderApiKey,
} from "@animocabrands/minds-client-lib";
import { ENV } from "./_core/env";

export type MindsBuilderAvailability = "available" | "unavailable";

export type MindsBuilderConnection = {
  availability: MindsBuilderAvailability;
  humanId: string | null;
  reason: "not_configured" | "invalid_key" | null;
};

export type MindsBuilderMindLookup =
  | { state: "connected"; mind: BuilderMind }
  | { state: "unavailable"; reason: "not_configured" | "invalid_key" | "unauthorized" | "forbidden" }
  | { state: "failed"; status: number | null; code: string | null };

export function getMindsBuilderConnection(apiKey = ENV.mindsBuilderApiKey): MindsBuilderConnection {
  if (!apiKey) return { availability: "unavailable", humanId: null, reason: "not_configured" };
  const humanId = parseHumanIdFromBuilderApiKey(apiKey);
  if (!humanId) return { availability: "unavailable", humanId: null, reason: "invalid_key" };
  return { availability: "available", humanId, reason: null };
}

export function createConfiguredMindsBuilderClient(apiKey = ENV.mindsBuilderApiKey): MindsClient | null {
  return getMindsBuilderConnection(apiKey).availability === "available"
    ? createMindsClient({ builderApiKey: apiKey })
    : null;
}

export async function getVerifiedBuilderMind(
  mindId: string,
  options: { apiKey?: string; signal?: AbortSignal } = {}
): Promise<MindsBuilderMindLookup> {
  const apiKey = options.apiKey ?? ENV.mindsBuilderApiKey;
  const connection = getMindsBuilderConnection(apiKey);
  if (connection.availability === "unavailable") {
    return { state: "unavailable", reason: connection.reason ?? "invalid_key" };
  }

  try {
    const client = createMindsClient({ builderApiKey: apiKey });
    const mind = await client.getMind(mindId, options.signal ?? AbortSignal.timeout(15_000));
    return { state: "connected", mind };
  } catch (error) {
    if (error instanceof MindsApiError) {
      if (error.status === 401) return { state: "unavailable", reason: "unauthorized" };
      if (error.status === 403) return { state: "unavailable", reason: "forbidden" };
      return { state: "failed", status: error.status, code: error.code };
    }
    return { state: "failed", status: null, code: null };
  }
}
