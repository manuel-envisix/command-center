import { describe, expect, it } from "vitest";
import { assertSafeArtifactPath, isImageArtifactPath } from "./artifacts.js";

describe("artifacts", () => {
  it("detects image paths", () => {
    expect(isImageArtifactPath("artifacts/demo.png")).toBe(true);
    expect(isImageArtifactPath("artifacts/out.zip")).toBe(false);
  });

  it("validates safe paths", () => {
    expect(() => assertSafeArtifactPath("artifacts/a.png")).not.toThrow();
    expect(() => assertSafeArtifactPath("../etc/passwd")).toThrow();
    expect(() => assertSafeArtifactPath("artifacts/../x")).toThrow();
  });
});
