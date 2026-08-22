import { ENV } from "./_core/env";

const localFileStorage = new Map<string, { data: Buffer; contentType: string }>();

export function getStoredBuffer(key: string): { data: Buffer; contentType: string } | undefined {
  return localFileStorage.get(normalizeKey(key));
}

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;

  if (!forgeUrl || !forgeKey) {
    return null;
  }

  // If using external LLM inference like Groq, don't attempt Forge S3 requests
  if (forgeUrl.includes("groq.com") || forgeUrl.includes("openai.com")) {
    return null;
  }

  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const bufferData = Buffer.isBuffer(data)
    ? data
    : typeof data === "string"
    ? Buffer.from(data, "utf8")
    : Buffer.from(data);

  // Always store locally in memory for instant, rock-solid access
  localFileStorage.set(key, { data: bufferData, contentType });

  const forgeConfig = getForgeConfig();
  if (forgeConfig) {
    try {
      const presignUrl = new URL("v1/storage/presign/put", forgeConfig.forgeUrl + "/");
      presignUrl.searchParams.set("path", key);

      const presignResp = await fetch(presignUrl, {
        headers: { Authorization: `Bearer ${forgeConfig.forgeKey}` },
      });

      if (presignResp.ok) {
        const { url: s3Url } = (await presignResp.json()) as { url: string };
        if (s3Url) {
          const blob = new Blob([bufferData], { type: contentType });
          await fetch(s3Url, {
            method: "PUT",
            headers: { "Content-Type": contentType },
            body: blob,
          });
        }
      }
    } catch {
      // Local storage fallback is already recorded
    }
  }

  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const local = localFileStorage.get(key);
  if (local) {
    return `/manus-storage/${key}`;
  }

  const forgeConfig = getForgeConfig();
  if (!forgeConfig) {
    return `/manus-storage/${key}`;
  }

  try {
    const getUrl = new URL("v1/storage/presign/get", forgeConfig.forgeUrl + "/");
    getUrl.searchParams.set("path", key);

    const resp = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${forgeConfig.forgeKey}` },
    });

    if (resp.ok) {
      const { url } = (await resp.json()) as { url: string };
      if (url) return url;
    }
  } catch {
    // Fallback to proxy route
  }

  return `/manus-storage/${key}`;
}
