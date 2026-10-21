const API_BASE = "https://api.cursor.com/v1";

export class CursorApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function cursorFetch<T>(
  apiKey: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new CursorApiError(res.status, text.slice(0, 300));
  }
  return res.json() as Promise<T>;
}

export interface CursorAgentListItem {
  id: string;
  name: string;
  status: string;
  url?: string;
  createdAt?: string;
  updatedAt?: string;
  latestRunId?: string;
}

export interface CursorAgentDetail extends CursorAgentListItem {
  repos?: Array<{ url: string; startingRef?: string }>;
  latestRunId?: string;
}

export interface CursorRunSummary {
  id: string;
  agentId: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  git?: {
    branches?: Array<{ repoUrl: string; branch?: string; prUrl?: string }>;
  };
}

export interface CursorRunDetail extends CursorRunSummary {
  durationMs?: number;
  result?: string;
  prompt?: { text?: string };
}

export async function listAgents(apiKey: string, limit = 30) {
  return cursorFetch<{ items: CursorAgentListItem[]; nextCursor?: string }>(
    apiKey,
    `/agents?limit=${limit}&includeArchived=false`,
  );
}

export async function getAgent(apiKey: string, agentId: string) {
  return cursorFetch<CursorAgentDetail>(apiKey, `/agents/${encodeURIComponent(agentId)}`);
}

export async function listRuns(apiKey: string, agentId: string, limit = 30) {
  return cursorFetch<{ items: CursorRunSummary[] }>(
    apiKey,
    `/agents/${encodeURIComponent(agentId)}/runs?limit=${limit}`,
  );
}

export async function getRun(apiKey: string, agentId: string, runId: string) {
  return cursorFetch<CursorRunDetail>(
    apiKey,
    `/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}`,
  );
}

export async function createFollowUpRun(apiKey: string, agentId: string, text: string) {
  return cursorFetch<{ run: CursorRunSummary }>(
    apiKey,
    `/agents/${encodeURIComponent(agentId)}/runs`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: { text } }),
    },
  );
}
