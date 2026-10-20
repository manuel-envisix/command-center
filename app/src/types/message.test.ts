import { describe, expect, it } from "vitest";
import { isViewMessage, normalizeBlock, parseIncomingMessage } from "./message";

describe("message schema", () => {
  it("parses view messages", () => {
    const msg = parseIncomingMessage({
      version: 1,
      kind: "view",
      blocks: [{ type: "markdown", content: "Hi" }],
    });
    expect(msg).not.toBeNull();
    expect(isViewMessage(msg!)).toBe(true);
  });

  it("normalizes markdown blocks", () => {
    const block = normalizeBlock({ type: "markdown", content: "# Titel" });
    expect(block).toMatchObject({ type: "markdown", content: "# Titel" });
  });

  it("falls back unknown blocks", () => {
    const block = normalizeBlock({ type: "future-widget", foo: 1 });
    expect(block).toEqual({ type: "unknown", raw: { type: "future-widget", foo: 1 } });
  });

  it("rejects invalid root messages", () => {
    expect(parseIncomingMessage({ kind: "nope" })).toBeNull();
    expect(parseIncomingMessage(null)).toBeNull();
  });
});
