import type { DashboardMessage, ControlAction } from "../types/message";

export type MainTab = "dashboard" | "agents";

export function mapVoiceTab(tab: string): MainTab | null {
  if (tab === "views" || tab === "dashboard") return "dashboard";
  if (tab === "agents") return "agents";
  return null;
}

export function findViewIndex(views: DashboardMessage[], id: string): number {
  const direct = views.findIndex((v) => v.id === id);
  if (direct >= 0) return direct;
  return views.findIndex((v) => String(v._seq ?? "") === id);
}

export function normalizeControlAction(raw: unknown): ControlAction | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const action = o.action;
  if (typeof action !== "string") return null;

  switch (action) {
    case "clear":
      return { action: "clear" };
    case "setTitle":
      return typeof o.title === "string" ? { action: "setTitle", title: o.title } : null;
    case "focus":
      return {
        action: "focus",
        blockIndex: typeof o.blockIndex === "number" ? o.blockIndex : undefined,
        blockId: typeof o.blockId === "string" ? o.blockId : undefined,
      };
    case "highlight":
      return {
        action: "highlight",
        blockIndex: typeof o.blockIndex === "number" ? o.blockIndex : undefined,
        blockId: typeof o.blockId === "string" ? o.blockId : undefined,
      };
    case "notify": {
      if (typeof o.message !== "string") return null;
      const level = o.level;
      const notifyLevel =
        level === "info" || level === "success" || level === "warning" || level === "error"
          ? level
          : undefined;
      return {
        action: "notify",
        message: o.message,
        level: notifyLevel,
        durationMs: typeof o.durationMs === "number" ? o.durationMs : undefined,
      };
    }
    case "showTab":
      return typeof o.tab === "string" && mapVoiceTab(o.tab)
        ? { action: "showTab", tab: o.tab === "dashboard" ? "views" : (o.tab as "views" | "agents") }
        : typeof o.tab === "string" && (o.tab === "views" || o.tab === "agents")
          ? { action: "showTab", tab: o.tab }
          : null;
    case "openAgent":
      return typeof o.agentId === "string" && o.agentId.length > 0
        ? { action: "openAgent", agentId: o.agentId }
        : null;
    case "showView":
      return typeof o.id === "string" && o.id.length > 0
        ? { action: "showView", id: o.id }
        : null;
    case "back":
      return { action: "back" };
    case "forward":
      return { action: "forward" };
    default:
      return null;
  }
}
