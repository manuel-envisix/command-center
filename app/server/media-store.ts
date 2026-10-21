import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export class UploadTooLargeError extends Error {
  constructor() {
    super(`Upload exceeds ${MAX_UPLOAD_BYTES} bytes`);
    this.name = "UploadTooLargeError";
  }
}

export class InvalidUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUploadError";
  }
}

const MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

export function extensionForContentType(contentType: string): string {
  const base = contentType.split(";")[0].trim().toLowerCase();
  const ext = MIME_TO_EXT[base];
  if (!ext) throw new InvalidUploadError(`Unsupported content type: ${contentType}`);
  return ext;
}

export function parseDataUrl(dataUrl: string): { contentType: string; buffer: Buffer } {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!match) throw new InvalidUploadError("Invalid data URL");
  const contentType = match[1].trim();
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  return { contentType, buffer };
}

export class MediaStore {
  constructor(private uploadsDir: string) {}

  static fromDataDir(dataDir: string): MediaStore {
    return new MediaStore(join(dataDir, "uploads"));
  }

  async saveBuffer(buffer: Buffer, contentType: string): Promise<{ filename: string; url: string }> {
    if (buffer.length > MAX_UPLOAD_BYTES) throw new UploadTooLargeError();
    const ext = extensionForContentType(contentType);
    const filename = `${randomUUID()}${ext}`;
    await mkdir(this.uploadsDir, { recursive: true });
    await writeFile(join(this.uploadsDir, filename), buffer);
    return { filename, url: `/media/uploads/${filename}` };
  }

  async saveDataUrl(dataUrl: string): Promise<{ filename: string; url: string }> {
    const { contentType, buffer } = parseDataUrl(dataUrl);
    return this.saveBuffer(buffer, contentType);
  }

  async saveBase64(contentType: string, dataBase64: string): Promise<{ filename: string; url: string }> {
    const buffer = Buffer.from(dataBase64.replace(/\s/g, ""), "base64");
    return this.saveBuffer(buffer, contentType);
  }

  resolveFilename(name: string): string | null {
    if (!/^[0-9a-f-]{36}\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return null;
    return join(this.uploadsDir, name);
  }

  async readUpload(filename: string): Promise<{ buffer: Buffer; contentType: string }> {
    const path = this.resolveFilename(filename);
    if (!path) throw new InvalidUploadError("Invalid upload name");
    const buffer = await readFile(path);
    const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
    const contentType =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".gif"
            ? "image/gif"
            : ext === ".webp"
              ? "image/webp"
              : ext === ".svg"
                ? "image/svg+xml"
                : "application/octet-stream";
    return { buffer, contentType };
  }
}
