export interface AgentChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  status?: string;
}

export interface AgentSummary {
  id: string;
  name: string;
  status: string;
  url?: string;
  repos?: Array<{
    url: string;
    startingRef?: string;
    branch?: string;
    prUrl?: string;
  }>;
}

export interface AgentChatPayload {
  kind: "agent_chat";
  agentId: string;
  updatedAt: number;
  agent: AgentSummary;
  messages: AgentChatMessage[];
  error?: string;
}

export function parseAgentChatPayload(raw: unknown): AgentChatPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as AgentChatPayload;
  if (obj.kind !== "agent_chat" || typeof obj.agentId !== "string") return null;
  if (!Array.isArray(obj.messages)) return null;
  return obj;
}
