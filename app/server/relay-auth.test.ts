import { describe, expect, it } from "vitest";
import { extractBearerSecret, isAuthorized } from "./relay-auth";

describe("relay auth", () => {
  it("extracts bearer token", () => {
    const req = { headers: { authorization: "Bearer my-secret-token" } };
    expect(extractBearerSecret(req)).toBe("my-secret-token");
  });

  it("compares secrets safely", () => {
    expect(isAuthorized("same", "same")).toBe(true);
    expect(isAuthorized("same", "diff")).toBe(false);
    expect(isAuthorized(null, "x")).toBe(false);
  });
});
