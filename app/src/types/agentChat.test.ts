import { describe, expect, it } from "vitest";
import { parseAgentChatPayload } from "./agentChat";

describe("parseAgentChatPayload", () => {
  it("parses agent chat websocket payloads", () => {
    const payload = parseAgentChatPayload({
      kind: "agent_chat",
      agentId: "bc-1",
      updatedAt: 1,
      agent: { id: "bc-1", name: "Test", status: "ACTIVE" },
      messages: [{ id: "m1", role: "user", content: "Hi" }],
    });
    expect(payload?.agentId).toBe("bc-1");
    expect(payload?.messages).toHaveLength(1);
  });
});
