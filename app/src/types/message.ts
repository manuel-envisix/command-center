import { normalizeControlAction } from "../lib/controlActions";

export const MESSAGE_VERSION = 1;

export type LinkItem = { label: string; href: string };

export type Block =
  | { type: "markdown"; content: string }
  | {
      type: "card";
      title: string;
      status?: string;
      body?: string;
      links?: LinkItem[];
    }
  | {
      type: "cards";
      items: Array<{
        title: string;
        status?: string;
        body?: string;
        links?: LinkItem[];
      }>;
    }
  | {
      type: "table";
      title?: string;
      columns: string[];
      rows: string[][] | Record<string, string>[];
    }
  | { type: "list"; title?: string; items: string[] }
  | {
      type: "checklist";
      title?: string;
      items: Array<{ label: string; checked?: boolean }>;
    }
  | { type: "keyValue"; title?: string; entries: Record<string, string | number | boolean> }
  | {
      type: "chart";
      title?: string;
      chartType?: "bar" | "line";
      labels: string[];
      series: Array<{ name?: string; values: number[] }>;
    }
  | { type: "image"; url: string; alt?: string; caption?: string }
  | { type: "linkList"; title?: string; links: LinkItem[] }
  | { type: "html"; content: string; title?: string };

export type ControlAction =
  | { action: "clear" }
  | { action: "setTitle"; title: string }
  | { action: "focus"; blockIndex?: number; blockId?: string }
  | {
      action: "notify";
      message: string;
      level?: "info" | "success" | "warning" | "error";
      durationMs?: number;
    }
  | { action: "highlight"; blockIndex?: number; blockId?: string }
  | { action: "showTab"; tab: "views" | "agents" }
  | { action: "openAgent"; agentId: string }
  | { action: "showView"; id: string }
  | { action: "back" }
  | { action: "forward" };

export interface DashboardMessage {
  version?: number;
  kind: "view" | "control";
  id?: string;
  ts?: string;
  title?: string;
  blocks?: Block[];
  control?: ControlAction;
  _seq?: number;
  _receivedAt?: number;
}

export function isViewMessage(msg: DashboardMessage): boolean {
  return msg.kind === "view" && Array.isArray(msg.blocks);
}

export function normalizeBlock(raw: unknown): Block | { type: "unknown"; raw: unknown } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { type: "unknown", raw };
  }
  const obj = raw as Record<string, unknown>;
  const type = obj.type;
  if (typeof type !== "string") return { type: "unknown", raw };

  switch (type) {
    case "markdown":
      if (typeof obj.content === "string") return { type, content: obj.content };
      break;
    case "card":
      if (typeof obj.title === "string") {
        return {
          type,
          title: obj.title,
          status: typeof obj.status === "string" ? obj.status : undefined,
          body: typeof obj.body === "string" ? obj.body : undefined,
          links: Array.isArray(obj.links) ? (obj.links as LinkItem[]) : undefined,
        };
      }
      break;
    case "cards":
      if (Array.isArray(obj.items)) {
        return {
          type: "cards",
          items: obj.items as Array<{
            title: string;
            status?: string;
            body?: string;
            links?: LinkItem[];
          }>,
        };
      }
      break;
    case "table":
      if (Array.isArray(obj.columns) && Array.isArray(obj.rows)) {
        return {
          type,
          title: typeof obj.title === "string" ? obj.title : undefined,
          columns: obj.columns as string[],
          rows: obj.rows as string[][],
        };
      }
      break;
    case "list":
      if (Array.isArray(obj.items)) {
        return {
          type,
          title: typeof obj.title === "string" ? obj.title : undefined,
          items: obj.items as string[],
        };
      }
      break;
    case "checklist":
      if (Array.isArray(obj.items)) {
        return {
          type,
          title: typeof obj.title === "string" ? obj.title : undefined,
          items: obj.items as Array<{ label: string; checked?: boolean }>,
        };
      }
      break;
    case "keyValue":
      if (obj.entries && typeof obj.entries === "object") {
        return {
          type,
          title: typeof obj.title === "string" ? obj.title : undefined,
          entries: obj.entries as Record<string, string | number | boolean>,
        };
      }
      break;
    case "chart":
      if (Array.isArray(obj.labels) && Array.isArray(obj.series)) {
        return {
          type,
          title: typeof obj.title === "string" ? obj.title : undefined,
          chartType: obj.chartType === "line" ? "line" : "bar",
          labels: obj.labels as string[],
          series: obj.series as Array<{ name?: string; values: number[] }>,
        };
      }
      break;
    case "image":
      if (typeof obj.url === "string") {
        return {
          type,
          url: obj.url,
          alt: typeof obj.alt === "string" ? obj.alt : undefined,
          caption: typeof obj.caption === "string" ? obj.caption : undefined,
        };
      }
      break;
    case "linkList":
      if (Array.isArray(obj.links)) {
        return {
          type,
          title: typeof obj.title === "string" ? obj.title : undefined,
          links: obj.links as LinkItem[],
        };
      }
      break;
    case "html":
      if (typeof obj.content === "string") {
        return {
          type,
          content: obj.content,
          title: typeof obj.title === "string" ? obj.title : undefined,
        };
      }
      break;
    default:
      return { type: "unknown", raw };
  }
  return { type: "unknown", raw };
}

export function parseIncomingMessage(raw: unknown): DashboardMessage | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const msg = raw as DashboardMessage;
  if (msg.kind !== "view" && msg.kind !== "control") return null;
  if (msg.kind === "control") {
    if (!msg.control) return null;
    const normalized = normalizeControlAction(msg.control);
    if (!normalized) return null;
    return { ...msg, control: normalized };
  }
  return msg;
}
