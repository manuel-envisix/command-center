import { describe, expect, it } from "vitest";
import { mergeRunMessages } from "./conversation.js";

describe("mergeRunMessages", () => {
  it("maps prompt and result to user/assistant pair", () => {
    const msgs = mergeRunMessages(
      { id: "run-1", agentId: "bc-1", status: "FINISHED" },
      {
        id: "run-1",
        agentId: "bc-1",
        status: "FINISHED",
        prompt: { text: "Fix the bug" },
        result: "Done.",
      },
    );
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("user");
    expect(msgs[1].role).toBe("assistant");
    expect(msgs[1].content).toBe("Done.");
  });

  it("uses live assistant text for running runs", () => {
    const msgs = mergeRunMessages(
      { id: "run-2", agentId: "bc-1", status: "RUNNING" },
      { id: "run-2", agentId: "bc-1", status: "RUNNING" },
      "Partial reply",
    );
    expect(msgs.at(-1)?.content).toBe("Partial reply");
  });
});
