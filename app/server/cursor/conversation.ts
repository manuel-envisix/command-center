import type { CursorRunDetail, CursorRunSummary } from "./api.js";
import { getRun } from "./api.js";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  status?: string;
}

export function mergeRunMessages(
  run: CursorRunSummary,
  detail: CursorRunDetail,
  liveAssistantText?: string,
): ChatMessage[] {
  const out: ChatMessage[] = [];
  const prompt = detail.prompt?.text?.trim();
  if (prompt) {
    out.push({
      id: `${run.id}:user`,
      role: "user",
      content: prompt,
      createdAt: run.createdAt,
    });
  }

  const assistantText =
    liveAssistantText?.trim() ||
    detail.result?.trim() ||
    (detail.status === "RUNNING" || detail.status === "CREATING"
      ? "_Agent arbeitet …_"
      : "");

  if (assistantText) {
    out.push({
      id: `${run.id}:assistant`,
      role: "assistant",
      content: assistantText,
      createdAt: run.updatedAt ?? run.createdAt,
      status: detail.status,
    });
  }
  return out;
}

export async function buildConversation(
  apiKey: string,
  agentId: string,
  listRunItems: CursorRunSummary[],
  liveByRunId: Record<string, string>,
): Promise<ChatMessage[]> {
  const chronological = [...listRunItems].reverse();
  const messages: ChatMessage[] = [];
  for (const run of chronological) {
    const detail = await getRun(apiKey, agentId, run.id);
    messages.push(...mergeRunMessages(run, detail, liveByRunId[run.id]));
  }
  return messages;
}
