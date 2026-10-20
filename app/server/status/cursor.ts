import type { AppConfig } from "../config.js";

export interface CursorAgentItem {
  id: string;
  name: string;
  status: string;
  url?: string;
  updatedAt?: string;
}

export interface CursorStatusSummary {
  configured: boolean;
  agents: CursorAgentItem[];
  error?: string;
}

export async function fetchCursorStatus(config: AppConfig): Promise<CursorStatusSummary> {
  const apiKey = config.cursor?.apiKey;
  if (!apiKey) {
    return { configured: false, agents: [] };
  }

  try {
    const res = await fetch("https://api.cursor.com/v1/agents?limit=15&includeArchived=false", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cursor API ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      items?: Array<{
        id: string;
        name: string;
        status: string;
        url?: string;
        updatedAt?: string;
      }>;
    };
    const agents = (data.items ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      url: a.url,
      updatedAt: a.updatedAt,
    }));
    return { configured: true, agents };
  } catch (err) {
    return {
      configured: true,
      agents: [],
      error: err instanceof Error ? err.message : "Cursor-Fehler",
    };
  }
}
