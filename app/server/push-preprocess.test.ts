import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { MediaStore } from "./media-store.js";
import { preprocessPushMessage } from "./push-preprocess.js";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("preprocessPushMessage", () => {
  it("replaces image dataUrl with stored url", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cc-push-"));
    const store = MediaStore.fromDataDir(dir);
    const out = await preprocessPushMessage(
      {
        kind: "view",
        blocks: [{ type: "image", dataUrl: TINY_PNG, caption: "Shot" }],
      },
      store,
    );
    const block = (out.blocks as Record<string, unknown>[])[0];
    expect(block.url).toMatch(/^\/media\/uploads\//);
    expect(block.dataUrl).toBeUndefined();
    expect(block.caption).toBe("Shot");
    await rm(dir, { recursive: true, force: true });
  });
});
