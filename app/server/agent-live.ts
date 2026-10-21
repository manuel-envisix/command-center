import { loadConfig } from "./config.js";
import {
  buildConversation,
  type ChatMessage,
} from "./cursor/conversation.js";
import { fetchRunStreamText } from "./cursor/stream.js";
import { getAgent, listAgents, listRuns } from "./cursor/api.js";
import type { MessageRelay } from "./relay.js";

export interface AgentChatPayload {
  kind: "agent_chat";
  agentId: string;
  updatedAt: number;
  agent: {
    id: string;
    name: string;
    status: string;
    url?: string;
    repos?: Array<{ url: string; startingRef?: string; branch?: string; prUrl?: string }>;
  };
  messages: ChatMessage[];
  error?: string;
}

interface WatchState {
  refs: number;
  timer: ReturnType<typeof setInterval>;
}

export class AgentLiveService {
  private watches = new Map<string, WatchState>();
  private liveText = new Map<string, string>();

  constructor(private relay: MessageRelay) {}

  watch(agentId: string): void {
    const existing = this.watches.get(agentId);
    if (existing) {
      existing.refs += 1;
      void this.poll(agentId);
      return;
    }
    const timer = setInterval(() => {
      void this.poll(agentId);
    }, 4000);
    this.watches.set(agentId, { refs: 1, timer });
    void this.poll(agentId);
  }

  unwatch(agentId: string): void {
    const existing = this.watches.get(agentId);
    if (!existing) return;
    existing.refs -= 1;
    if (existing.refs <= 0) {
      clearInterval(existing.timer);
      this.watches.delete(agentId);
      this.liveText.delete(agentId);
    }
  }

  async poll(agentId: string): Promise<void> {
    const config = await loadConfig();
    const apiKey = config.cursor?.apiKey;
    if (!apiKey) {
      this.broadcast(agentId, [], { id: agentId, name: agentId, status: "UNKNOWN" }, "CURSOR_API_KEY fehlt");
      return;
    }

    try {
      const agent = await getAgent(apiKey, agentId);
      const runs = await listRuns(apiKey, agentId, 40);
      const latest = runs.items[0];
      const liveByRunId: Record<string, string> = {};
      if (
        latest &&
        (latest.status === "RUNNING" || latest.status === "CREATING")
      ) {
        const streamed = await fetchRunStreamText(apiKey, agentId, latest.id);
        if (streamed) {
          liveByRunId[latest.id] = streamed;
          this.liveText.set(agentId, streamed);
        } else if (this.liveText.has(agentId)) {
          liveByRunId[latest.id] = this.liveText.get(agentId)!;
        }
      }

      const messages = await buildConversation(apiKey, agentId, runs.items, liveByRunId);
      const branches = latest?.git?.branches ?? [];
      const repos = (agent.repos ?? []).map((r) => {
        const match = branches.find((b) => r.url.includes(b.repoUrl) || b.repoUrl.includes(r.url.replace(/^https?:\/\//, "")));
        return {
          url: r.url,
          startingRef: r.startingRef,
          branch: match?.branch,
          prUrl: match?.prUrl,
        };
      });

      this.broadcast(agentId, messages, {
        id: agent.id,
        name: agent.name,
        status: agent.status,
        url: agent.url,
        repos,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Cursor API Fehler";
      this.broadcast(agentId, [], { id: agentId, name: agentId, status: "ERROR" }, message);
    }
  }

  async listAgentsSummary() {
    const config = await loadConfig();
    const apiKey = config.cursor?.apiKey;
    if (!apiKey) return { configured: false, agents: [] as AgentChatPayload["agent"][] };
    const data = await listAgents(apiKey, 30);
    const agents = await Promise.all(
      data.items.map(async (item) => {
        try {
          const detail = await getAgent(apiKey, item.id);
          const runs = await listRuns(apiKey, item.id, 1);
          const b = runs.items[0]?.git?.branches?.[0];
          const repos = (detail.repos ?? []).map((r) => ({
            url: r.url,
            startingRef: r.startingRef,
            branch: b?.branch,
            prUrl: b?.prUrl,
          }));
          return {
            id: item.id,
            name: item.name,
            status: item.status,
            url: item.url ?? detail.url,
            repos,
          };
        } catch {
          return {
            id: item.id,
            name: item.name,
            status: item.status,
            url: item.url,
          };
        }
      }),
    );
    return { configured: true, agents };
  }

  private broadcast(
    agentId: string,
    messages: ChatMessage[],
    agent: AgentChatPayload["agent"],
    error?: string,
  ): void {
    const payload: AgentChatPayload = {
      kind: "agent_chat",
      agentId,
      updatedAt: Date.now(),
      agent,
      messages,
      error,
    };
    this.relay.broadcast({ ...payload } as Record<string, unknown>);
  }
}
