import { describe, expect, it } from "vitest";
import { formatStatusError } from "./statusError";

describe("formatStatusError", () => {
  it("replaces raw GitHub JSON errors", () => {
    expect(
      formatStatusError('GitHub API 404: {"message":"Not Found","documentation_url":"…"}'),
    ).toBe("GitHub-Konto nicht gefunden.");
  });

  it("keeps short friendly messages", () => {
    expect(formatStatusError("GitHub-Token ungültig.")).toBe("GitHub-Token ungültig.");
  });
});
