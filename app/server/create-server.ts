import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { InvalidUploadError, MediaStore, UploadTooLargeError } from "./media-store.js";
import { preprocessPushMessage } from "./push-preprocess.js";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";
import {
  checkLoginRateLimit,
  clearSessionCookie,
  isAuthenticated,
  isLoginEnabled,
  setSessionCookie,
  sessionSecret,
  signSession,
  verifyLoginPassword,
} from "./auth.js";
import { handleApi } from "./api.js";
import { loginPageHtml } from "./login-page.js";
import { AgentLiveService } from "./agent-live.js";
import { setAgentLiveService } from "./agent-live-registry.js";
import { MessageRelay } from "./relay.js";
import { extractBearerSecret, isAuthorized } from "./relay-auth.js";
import { relaySecret } from "./config.js";

export interface CreateServerOptions {
  staticDir?: string;
  viteMiddleware?: (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
  port: number;
  host?: string;
  secureCookies?: boolean;
}

function clientIp(req: IncomingMessage): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
  return req.socket.remoteAddress ?? "unknown";
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function redirect(res: ServerResponse, location: string): void {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.end();
}

function sendText(res: ServerResponse, status: number, body: string, type = "text/html; charset=utf-8"): void {
  res.statusCode = status;
  res.setHeader("Content-Type", type);
  res.end(body);
}

function isPublicPath(pathname: string, method: string): boolean {
  if (pathname === "/health") return true;
  if (pathname === "/push" && method === "POST") return true;
  if (pathname === "/upload" && method === "POST") return true;
  if (pathname === "/login") return true;
  if (pathname === "/api/login" && (method === "GET" || method === "POST")) return true;
  return false;
}

export async function startServer(options: CreateServerOptions) {
  const dataDir = process.env.DATA_DIR || join(process.cwd(), ".data");
  const persistPath = join(dataDir, "relay-history.json");
  const mediaStore = MediaStore.fromDataDir(dataDir);
  const relay = new MessageRelay(persistPath);
  await relay.init();
  setAgentLiveService(new AgentLiveService(relay));

  const wss = new WebSocketServer({ noServer: true });
  const secure = options.secureCookies ?? process.env.NODE_ENV === "production";

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const pathname = url.pathname.replace(/\/+$/, "") || "/";

      if (pathname === "/health") {
        sendText(res, 200, JSON.stringify({ ok: true }), "application/json");
        return;
      }

      if (pathname === "/upload" && req.method === "POST") {
        const secret = relaySecret();
        const provided = extractBearerSecret(req);
        if (!isAuthorized(provided, secret)) {
          sendText(res, 401, "Unauthorized");
          return;
        }
        let payload: { contentType?: string; dataBase64?: string };
        try {
          payload = JSON.parse(await readBody(req)) as { contentType?: string; dataBase64?: string };
        } catch {
          sendText(res, 400, "Invalid JSON");
          return;
        }
        const contentType = payload.contentType?.trim();
        const dataBase64 = payload.dataBase64;
        if (!contentType || typeof dataBase64 !== "string") {
          sendText(res, 400, "contentType and dataBase64 required");
          return;
        }
        try {
          const saved = await mediaStore.saveBase64(contentType, dataBase64);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, url: saved.url, filename: saved.filename }));
        } catch (err) {
          if (err instanceof UploadTooLargeError) {
            sendText(res, 413, err.message);
            return;
          }
          if (err instanceof InvalidUploadError) {
            sendText(res, 400, err.message);
            return;
          }
          throw err;
        }
        return;
      }

      if (pathname === "/push" && req.method === "POST") {
        const secret = relaySecret();
        const provided = extractBearerSecret(req);
        if (!isAuthorized(provided, secret)) {
          sendText(res, 401, "Unauthorized");
          return;
        }
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(await readBody(req)) as Record<string, unknown>;
        } catch {
          sendText(res, 400, "Invalid JSON");
          return;
        }
        if (!body || typeof body !== "object" || Array.isArray(body)) {
          sendText(res, 400, "Message must be a JSON object");
          return;
        }
        try {
          body = await preprocessPushMessage(body, mediaStore);
        } catch (err) {
          if (err instanceof UploadTooLargeError) {
            sendText(res, 413, err.message);
            return;
          }
          if (err instanceof InvalidUploadError) {
            sendText(res, 400, err.message);
            return;
          }
          throw err;
        }
        const stored = relay.push(body);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true, seq: stored._seq }));
        return;
      }

      const mediaMatch = pathname.match(/^\/media\/uploads\/([^/]+)$/);
      if (mediaMatch && req.method === "GET") {
        if (!isAuthenticated(req)) {
          redirect(res, "/login");
          return;
        }
        try {
          const { buffer, contentType } = await mediaStore.readUpload(mediaMatch[1]);
          res.statusCode = 200;
          res.setHeader("Content-Type", contentType);
          res.setHeader("Cache-Control", "private, max-age=86400");
          res.end(buffer);
        } catch {
          res.statusCode = 404;
          res.end("Not Found");
        }
        return;
      }

      if (pathname === "/login" && req.method === "GET") {
        if (!isLoginEnabled()) {
          redirect(res, "/");
          return;
        }
        if (isAuthenticated(req)) {
          redirect(res, "/");
          return;
        }
        sendText(res, 200, loginPageHtml());
        return;
      }

      if (pathname === "/api/login") {
        if (req.method === "GET") {
          redirect(res, "/login");
          return;
        }
        if (req.method === "POST") {
          if (!isLoginEnabled()) {
            redirect(res, "/");
            return;
          }
          const ip = clientIp(req);
          if (!checkLoginRateLimit(ip)) {
            sendText(res, 429, loginPageHtml("Zu viele Versuche. Bitte später erneut versuchen."));
            return;
          }
          const raw = await readBody(req);
          const params = new URLSearchParams(raw);
          const password = params.get("password") ?? "";
          if (!verifyLoginPassword(password)) {
            sendText(res, 401, loginPageHtml("Passwort ungültig."));
            return;
          }
          const token = signSession(sessionSecret());
          setSessionCookie(res, token, secure);
          redirect(res, "/");
          return;
        }
      }

      if (pathname === "/api/logout" && req.method === "POST") {
        clearSessionCookie(res, secure);
        redirect(res, "/login");
        return;
      }

      if (!isPublicPath(pathname, req.method ?? "GET") && !isAuthenticated(req)) {
        if (pathname.startsWith("/api/")) {
          res.statusCode = 401;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Nicht angemeldet" }));
          return;
        }
        redirect(res, "/login");
        return;
      }

      const apiHandled = await handleApi(req, res);
      if (apiHandled) return;

      if (options.viteMiddleware) {
        options.viteMiddleware(req, res, () => {
          void serveStatic(pathname, options.staticDir, res);
        });
        return;
      }

      if (options.staticDir) {
        await serveStatic(pathname, options.staticDir, res);
        return;
      }

      res.statusCode = 404;
      res.end("Not Found");
    } catch (err) {
      res.statusCode = 500;
      res.end(err instanceof Error ? err.message : "Server error");
    }
  });

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }
    if (!isAuthenticated(req)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      relay.addClient(ws);
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(options.port, options.host ?? "0.0.0.0", () => resolve());
  });

  return server;
}

async function serveStatic(pathname: string, staticDir: string | undefined, res: ServerResponse) {
  if (!staticDir) {
    res.statusCode = 404;
    res.end("Not Found");
    return;
  }
  const rel = pathname === "/" ? "/index.html" : pathname;
  const filePath = join(staticDir, rel);
  try {
    const data = await readFile(filePath);
    const ct = contentType(filePath);
    res.statusCode = 200;
    res.setHeader("Content-Type", ct);
    res.end(data);
  } catch {
    try {
      const spa = await readFile(join(staticDir, "index.html"));
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(spa);
    } catch {
      res.statusCode = 404;
      res.end("Not Found");
    }
  }
}

function contentType(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}
