import type { IncomingMessage, ServerResponse } from "node:http";
import { loadConfig, publicConfig } from "./config.js";
import { fetchCursorStatus } from "./status/cursor.js";
import { fetchGithubStatus } from "./status/github.js";
import { fetchGrokBotStatus } from "./status/grok-bot.js";

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith("/api/")) return false;

  if (url.pathname === "/api/config/public" && req.method === "GET") {
    const config = await loadConfig();
    sendJson(res, 200, publicConfig(config));
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
