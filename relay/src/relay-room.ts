import { DurableObject } from "cloudflare:workers";
import {
  extractBearerSecret,
  extractWsSecret,
  isAuthorized,
} from "./auth";

const MAX_HISTORY = 50;
const HISTORY_KEY = "history";

export interface Env {
  RELAY_ROOM: DurableObjectNamespace;
  RELAY_SECRET: string;
}

export type StoredMessage = Record<string, unknown> & {
  _seq?: number;
  _receivedAt?: number;
};

export class RelayRoom extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/push" && request.method === "POST") {
      return this.handlePush(request);
    }
    if (path === "/ws" && request.method === "GET") {
      return this.handleWebSocket(request, url);
    }
    if (path === "/health" && request.method === "GET") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  private checkSecret(provided: string | null): boolean {
    return isAuthorized(provided, this.env.RELAY_SECRET);
  }

  private async handlePush(request: Request): Promise<Response> {
    const secret = extractBearerSecret(request);
    if (!this.checkSecret(secret)) {
      return new Response("Unauthorized", { status: 401 });
    }

    let body: StoredMessage;
    try {
      body = (await request.json()) as StoredMessage;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return new Response("Message must be a JSON object", { status: 400 });
    }

    const history = await this.loadHistory();
    const seq = (history.at(-1)?._seq ?? 0) + 1;
    const stored: StoredMessage = {
      ...body,
      _seq: seq,
      _receivedAt: Date.now(),
    };
    history.push(stored);
    while (history.length > MAX_HISTORY) {
      history.shift();
    }
    await this.ctx.storage.put(HISTORY_KEY, history);

    const payload = JSON.stringify(stored);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        // Client may have disconnected.
      }
    }

    return Response.json({ ok: true, seq });
  }

  private async handleWebSocket(request: Request, url: URL): Promise<Response> {
    const secret = extractWsSecret(request, url);
    if (!this.checkSecret(secret)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);

    const history = await this.loadHistory();
    for (const msg of history) {
      try {
        server.send(JSON.stringify(msg));
      } catch {
        break;
      }
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  private async loadHistory(): Promise<StoredMessage[]> {
    const raw = await this.ctx.storage.get<StoredMessage[]>(HISTORY_KEY);
    return Array.isArray(raw) ? raw : [];
  }

  async webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer): Promise<void> {
    // Dashboard is receive-only; ignore client messages.
  }

  async webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    ws.close();
  }
}
