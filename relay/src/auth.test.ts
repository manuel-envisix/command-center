import { describe, expect, it } from "vitest";
import {
  extractBearerSecret,
  extractWsSecret,
  isAuthorized,
} from "./auth";

describe("relay auth", () => {
  it("extracts bearer token", () => {
    const req = new Request("https://example.com/push", {
      headers: { Authorization: "Bearer my-secret-token" },
    });
    expect(extractBearerSecret(req)).toBe("my-secret-token");
  });

  it("rejects missing bearer", () => {
    const req = new Request("https://example.com/push");
    expect(extractBearerSecret(req)).toBeNull();
  });

  it("extracts ws secret from query", () => {
    const req = new Request("https://example.com/ws?secret=abc");
    const url = new URL(req.url);
    expect(extractWsSecret(req, url)).toBe("abc");
  });

  it("extracts ws secret from subprotocol", () => {
    const req = new Request("https://example.com/ws", {
      headers: { "Sec-WebSocket-Protocol": "cc-secret.myproto, other" },
    });
    const url = new URL(req.url);
    expect(extractWsSecret(req, url)).toBe("myproto");
  });

  it("compares secrets in constant time fashion", () => {
    expect(isAuthorized("same", "same")).toBe(true);
    expect(isAuthorized("same", "diff")).toBe(false);
    expect(isAuthorized(null, "x")).toBe(false);
  });
});
