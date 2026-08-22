import type { Express } from "express";
import { getStoredBuffer } from "../storage";
import { ENV } from "./env";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    // 1. Check local buffer storage first
    const localItem = getStoredBuffer(key);
    if (localItem) {
      res.setHeader("Content-Type", localItem.contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(localItem.data);
      return;
    }

    // 2. If Forge S3 is configured and not Groq/OpenAI, proxy from Forge
    if (
      ENV.forgeApiUrl &&
      ENV.forgeApiKey &&
      !ENV.forgeApiUrl.includes("groq.com") &&
      !ENV.forgeApiUrl.includes("openai.com")
    ) {
      try {
        const forgeUrl = new URL(
          "v1/storage/presign/get",
          ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
        );
        forgeUrl.searchParams.set("path", key);

        const forgeResp = await fetch(forgeUrl, {
          headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
        });

        if (forgeResp.ok) {
          const { url } = (await forgeResp.json()) as { url: string };
          if (url) {
            res.set("Cache-Control", "no-store");
            res.redirect(307, url);
            return;
          }
        }
      } catch (err) {
        console.error("[StorageProxy] forge error:", err);
      }
    }

    res.status(404).send("File not found");
  });
}
