import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { AppConfig } from "../config.js";

export interface GrokAgentEntry {
  name: string;
  lastExport: string | null;
  sourceFile?: string;
}

export interface GrokBotStatusSummary {
  configured: boolean;
  path: string | null;
  agents: GrokAgentEntry[];
  error?: string;
}

async function parseAgentFile(filePath: string, content: string): Promise<Partial<GrokAgentEntry>> {
  const base = filePath.split("/").pop() ?? "agent";
  let name = base.replace(/\.(md|json|yaml|yml)$/i, "");

  if (filePath.endsWith(".json")) {
    try {
      const data = JSON.parse(content) as Record<string, unknown>;
      if (typeof data.name === "string") name = data.name;
      else if (typeof data.title === "string") name = data.title;
      else if (typeof data.agent === "string") name = data.agent;
      const exported =
        (typeof data.exportedAt === "string" && data.exportedAt) ||
        (typeof data.lastExport === "string" && data.lastExport) ||
        null;
      return { name, lastExport: exported };
    } catch {
      return { name };
    }
  }

  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) name = titleMatch[1].trim();
  const dateMatch =
    content.match(/export(?:ed)?(?:\s*at)?[:\s]+([0-9]{4}-[0-9]{2}-[0-9]{2}[^\s]*)/i) ||
    content.match(/last[_\s-]?export[:\s]+([0-9]{4}-[0-9]{2}-[0-9]{2}[^\s]*)/i);
  return { name, lastExport: dateMatch?.[1] ?? null };
}

export async function fetchGrokBotStatus(config: AppConfig): Promise<GrokBotStatusSummary> {
  const agentsPath = config.grokBot?.agentsPath;
  if (!agentsPath) {
    return { configured: false, path: null, agents: [] };
  }

  try {
    const dirStat = await stat(agentsPath);
    if (!dirStat.isDirectory()) {
      return {
        configured: true,
        path: agentsPath,
        agents: [],
        error: "Pfad ist kein Verzeichnis",
      };
    }

    const entries = await readdir(agentsPath, { withFileTypes: true });
    const agents: GrokAgentEntry[] = [];

    for (const entry of entries) {
      const full = join(agentsPath, entry.name);
      if (entry.isDirectory()) {
        const nested = await readdir(full).catch(() => []);
        for (const file of nested) {
          if (/\.(md|json|ya?ml)$/i.test(file)) {
            const fp = join(full, file);
            const st = await stat(fp);
            const content = await readFile(fp, "utf8").catch(() => "");
            const parsed = await parseAgentFile(fp, content);
            agents.push({
              name: parsed.name ?? entry.name,
              lastExport: parsed.lastExport ?? st.mtime.toISOString(),
              sourceFile: file,
            });
          }
        }
        continue;
      }
      if (!/\.(md|json|ya?ml)$/i.test(entry.name)) continue;
      const st = await stat(full);
      const content = await readFile(full, "utf8").catch(() => "");
      const parsed = await parseAgentFile(full, content);
      agents.push({
        name: parsed.name ?? entry.name,
        lastExport: parsed.lastExport ?? st.mtime.toISOString(),
        sourceFile: entry.name,
      });
    }

    agents.sort((a, b) => a.name.localeCompare(b.name, "de"));
    return { configured: true, path: agentsPath, agents };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { configured: true, path: agentsPath, agents: [], error: "Pfad nicht gefunden" };
    }
    return {
      configured: true,
      path: agentsPath,
      agents: [],
      error: err instanceof Error ? err.message : "Grok-Bot-Lesefehler",
    };
  }
}
