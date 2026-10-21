import { describe, expect, it } from "vitest";
import { MessageRelay } from "./relay";

describe("MessageRelay", () => {
  it("stores history with sequence numbers", () => {
    const relay = new MessageRelay(null);
    const a = relay.push({ kind: "view", blocks: [] });
    const b = relay.push({ kind: "control", control: { action: "clear" } });
    expect(a._seq).toBe(1);
    expect(b._seq).toBe(2);
  });
});
