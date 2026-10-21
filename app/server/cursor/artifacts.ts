import { cursorFetch } from "./api.js";

export interface CursorArtifactItem {
  path: string;
  sizeBytes?: number;
  updatedAt?: string;
}

export async function listArtifacts(apiKey: string, agentId: string) {
  return cursorFetch<{ items: CursorArtifactItem[] }>(
    apiKey,
    `/agents/${encodeURIComponent(agentId)}/artifacts`,
  );
}

export async function getArtifactDownloadUrl(apiKey: string, agentId: string, artifactPath: string) {
  return cursorFetch<{ url: string; expiresAt?: string }>(
    apiKey,
    `/agents/${encodeURIComponent(agentId)}/artifacts/download?path=${encodeURIComponent(artifactPath)}`,
  );
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;

export function isImageArtifactPath(path: string): boolean {
  return IMAGE_EXT.test(path);
}

export function assertSafeArtifactPath(path: string): void {
  if (!path.startsWith("artifacts/")) {
    throw new Error("Artifact path must start with artifacts/");
  }
  if (path.includes("..") || path.includes("\\")) {
    throw new Error("Invalid artifact path");
  }
}
