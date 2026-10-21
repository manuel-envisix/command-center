import type { WebSocket } from "ws";

const MAX_HISTORY = 50;

export type StoredMessage = Record<string, unknown> & {
  _seq?: number;
  _receivedAt?: number;
};

export class MessageRelay {
  private history: StoredMessage[] = [];
  private clients = new Set<WebSocket>();
  private persistPath: string | null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(persistPath: string | null) {
    this.persistPath = persistPath;
  }

  async init(): Promise<void> {
    if (!this.persistPath) return;
    try {
      const { readFile } = await import("node:fs/promises");
      const raw = await readFile(this.persistPath, "utf8");
      const parsed = JSON.parse(raw) as StoredMessage[];
      if (Array.isArray(parsed)) {
        this.history = parsed.slice(-MAX_HISTORY);
      }
    } catch {
      // No history file yet.
    }
  }

  addClient(ws: WebSocket): void {
    this.clients.add(ws);
    ws.on("close", () => this.clients.delete(ws));
    for (const msg of this.history) {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    }
  }

  broadcast(body: StoredMessage): void {
    const payload = JSON.stringify(body);
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) {
        client.send(payload);
      }
    }
  }

  push(body: StoredMessage): StoredMessage {
    const seq = (this.history.at(-1)?._seq ?? 0) + 1;
    const stored: StoredMessage = {
      ...body,
      _seq: seq,
      _receivedAt: Date.now(),
    };
    this.history.push(stored);
    while (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }
    this.schedulePersist();
    const payload = JSON.stringify(stored);
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) {
        client.send(payload);
      }
    }
    return stored;
  }

  private schedulePersist(): void {
    if (!this.persistPath) return;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      void this.flushPersist();
    }, 500);
  }

  private async flushPersist(): Promise<void> {
    if (!this.persistPath) return;
    try {
      const { writeFile, mkdir } = await import("node:fs/promises");
      const { dirname } = await import("node:path");
      await mkdir(dirname(this.persistPath), { recursive: true });
      await writeFile(this.persistPath, JSON.stringify(this.history), "utf8");
    } catch {
      // Persistence is best-effort.
    }
  }
}
