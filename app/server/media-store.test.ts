import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  MediaStore,
  UploadTooLargeError,
  parseDataUrl,
} from "./media-store.js";

describe("MediaStore", () => {
  it("saves and reads a tiny PNG data URL", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cc-upload-"));
    const store = MediaStore.fromDataDir(dir);
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const { filename, url } = await store.saveDataUrl(dataUrl);
    expect(url).toBe(`/media/uploads/${filename}`);
    const { buffer } = await store.readUpload(filename);
    expect(buffer.length).toBeGreaterThan(0);
    await rm(dir, { recursive: true, force: true });
  });

  it("rejects oversize uploads", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cc-upload-"));
    const store = MediaStore.fromDataDir(dir);
    const big = Buffer.alloc(MAX_UPLOAD_BYTES + 1);
    await expect(store.saveBuffer(big, "image/png")).rejects.toBeInstanceOf(UploadTooLargeError);
    await rm(dir, { recursive: true, force: true });
  });

  it("parses data URLs", () => {
    const { contentType, buffer } = parseDataUrl(
      "data:image/png;base64,iVBORw0KGgo=",
    );
    expect(contentType).toBe("image/png");
    expect(buffer.length).toBeGreaterThan(0);
  });
});
