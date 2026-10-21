/** Best-effort snapshot of assistant text from an active run SSE stream. */
export async function fetchRunStreamText(
  apiKey: string,
  agentId: string,
  runId: string,
  timeoutMs = 2500,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let text = "";
  try {
    const res = await fetch(
      `https://api.cursor.com/v1/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}/stream`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "text/event-stream",
        },
        signal: controller.signal,
      },
    );
    if (!res.ok || !res.body) return text;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const block of parts) {
        const lines = block.split("\n");
        let event = "";
        let data = "";
        for (const line of lines) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          if (line.startsWith("data:")) data = line.slice(5).trim();
        }
        if (!data) continue;
        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          if (event === "assistant" && typeof parsed.text === "string") {
            text += parsed.text;
          }
          if (event === "result" && typeof parsed.text === "string") {
            text = parsed.text;
          }
        } catch {
          // ignore malformed SSE chunk
        }
      }
    }
  } catch {
    // timeout or network
  } finally {
    clearTimeout(timer);
  }
  return text;
}
