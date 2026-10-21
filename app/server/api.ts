import type { IncomingMessage, ServerResponse } from "node:http";
import { getAgentLiveService } from "./agent-live-registry.js";
import { createFollowUpRun } from "./cursor/api.js";
import {
  assertSafeArtifactPath,
  getArtifactDownloadUrl,
} from "./cursor/artifacts.js";
import { loadConfig, publicConfig } from "./config.js";
import { fetchCursorStatus } from "./status/cursor.js";
import { fetchGithubStatus } from "./status/github.js";
import { fetchGrokBotStatus } from "./status/grok-bot.js";

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith("/api/")) return false;

  if (url.pathname === "/api/config/public" && req.method === "GET") {
    const config = await loadConfig();
    sendJson(res, 200, publicConfig(config));
    return true;
  }

  if (url.pathname === "/api/agents/live" && req.method === "GET") {
    const live = getAgentLiveService();
    if (!live) {
      sendJson(res, 503, { configured: false, agents: [] });
      return true;
    }
    sendJson(res, 200, await live.listAgentsSummary());
    return true;
  }

  const watchMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/watch$/);
  if (watchMatch && req.method === "POST") {
    const live = getAgentLiveService();
    if (!live) {
      sendJson(res, 503, { error: "Agent live service unavailable" });
      return true;
    }
    live.watch(watchMatch[1]);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (watchMatch && req.method === "DELETE") {
    const live = getAgentLiveService();
    live?.unwatch(watchMatch[1]);
    sendJson(res, 200, { ok: true });
    return true;
  }

  const artifactMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/artifact$/);
  if (artifactMatch && req.method === "GET") {
    const config = await loadConfig();
    const apiKey = config.cursor?.apiKey;
    if (!apiKey) {
      sendJson(res, 503, { error: "CURSOR_API_KEY nicht konfiguriert" });
      return true;
    }
    const artifactPath = url.searchParams.get("path") ?? "";
    try {
      assertSafeArtifactPath(artifactPath);
      const { url: presigned } = await getArtifactDownloadUrl(
        apiKey,
        artifactMatch[1],
        artifactPath,
      );
      const upstream = await fetch(presigned);
      if (!upstream.ok) {
        sendJson(res, 502, { error: `Artifact download failed (${upstream.status})` });
        return true;
      }
      const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.statusCode = 200;
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "private, max-age=300");
      res.end(buf);
    } catch (err) {
      sendJson(res, 400, {
        error: err instanceof Error ? err.message : "Artifact request failed",
      });
    }
    return true;
  }

  const followMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/followup$/);
  if (followMatch && req.method === "POST") {
    const config = await loadConfig();
    const apiKey = config.cursor?.apiKey;
    if (!apiKey) {
      sendJson(res, 503, { error: "CURSOR_API_KEY nicht konfiguriert" });
      return true;
    }
    let body: { text?: string };
    try {
      body = JSON.parse(await readBody(req)) as { text?: string };
    } catch {
      sendJson(res, 400, { error: "Invalid JSON" });
      return true;
    }
    const text = body.text?.trim();
    if (!text) {
      sendJson(res, 400, { error: "text required" });
      return true;
    }
    try {
      const run = await createFollowUpRun(apiKey, followMatch[1], text);
      getAgentLiveService()?.watch(followMatch[1]);
      sendJson(res, 200, { ok: true, runId: run.run.id });
    } catch (err) {
      sendJson(res, 502, {
        error: err instanceof Error ? err.message : "Follow-up fehlgeschlagen",
      });
    }
    return true;
  }

  if (url.pathname === "/api/status/github" && req.method === "GET") {
    const config = await loadConfig();
    sendJson(res, 200, await fetchGithubStatus(config));
    return true;
  }

  if (url.pathname === "/api/status/cursor" && req.method === "GET") {
    const config = await loadConfig();
    sendJson(res, 200, await fetchCursorStatus(config));
    return true;
  }

  if (url.pathname === "/api/status/grok-bot" && req.method === "GET") {
    const config = await loadConfig();
    sendJson(res, 200, await fetchGrokBotStatus(config));
    return true;
  }

  if (url.pathname === "/api/status/all" && req.method === "GET") {
    const config = await loadConfig();
    const [github, cursor, grokBot] = await Promise.all([
      fetchGithubStatus(config),
      fetchCursorStatus(config),
      fetchGrokBotStatus(config),
    ]);
    sendJson(res, 200, { github, cursor, grokBot });
    return true;
  }

  sendJson(res, 404, { error: "Not found" });
  return true;
}
