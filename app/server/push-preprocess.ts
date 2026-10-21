import type { MediaStore } from "./media-store.js";
import { InvalidUploadError } from "./media-store.js";

async function preprocessBlock(block: unknown, store: MediaStore): Promise<unknown> {
  if (!block || typeof block !== "object" || Array.isArray(block)) return block;
  const obj = block as Record<string, unknown>;
  if (obj.type !== "image") return block;

  const dataUrl = obj.dataUrl;
  if (typeof dataUrl === "string" && dataUrl.length > 0) {
    const saved = await store.saveDataUrl(dataUrl);
    const { dataUrl: _drop, ...rest } = obj;
    return { ...rest, url: saved.url };
  }
  return block;
}

export async function preprocessPushMessage(
  body: Record<string, unknown>,
  store: MediaStore,
): Promise<Record<string, unknown>> {
  if (body.kind !== "view" || !Array.isArray(body.blocks)) return body;
  try {
    const blocks = await Promise.all(body.blocks.map((b) => preprocessBlock(b, store)));
    return { ...body, blocks };
  } catch (err) {
    if (err instanceof InvalidUploadError) {
      throw err;
    }
    throw err;
  }
}
