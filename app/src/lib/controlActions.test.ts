import { describe, expect, it } from "vitest";
import { findViewIndex, mapVoiceTab, normalizeControlAction } from "./controlActions";
import type { DashboardMessage } from "../types/message";

describe("controlActions", () => {
  it("maps views tab alias", () => {
    expect(mapVoiceTab("views")).toBe("dashboard");
    expect(mapVoiceTab("agents")).toBe("agents");
    expect(mapVoiceTab("nope")).toBeNull();
  });

  it("parses navigation controls", () => {
    expect(normalizeControlAction({ action: "showTab", tab: "agents" })).toEqual({
      action: "showTab",
      tab: "agents",
    });
    expect(normalizeControlAction({ action: "openAgent", agentId: "bc-1" })).toEqual({
      action: "openAgent",
      agentId: "bc-1",
    });
    expect(normalizeControlAction({ action: "showView", id: "daily-brief" })).toEqual({
      action: "showView",
      id: "daily-brief",
    });
    expect(normalizeControlAction({ action: "back" })).toEqual({ action: "back" });
    expect(normalizeControlAction({ action: "forward" })).toEqual({ action: "forward" });
  });

  it("finds views by id or seq", () => {
    const views: DashboardMessage[] = [
      { kind: "view", id: "a", blocks: [] },
      { kind: "view", _seq: 7, blocks: [] },
    ];
    expect(findViewIndex(views, "a")).toBe(0);
    expect(findViewIndex(views, "7")).toBe(1);
    expect(findViewIndex(views, "missing")).toBe(-1);
  });
});
