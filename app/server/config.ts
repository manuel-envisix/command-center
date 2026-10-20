import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface AppConfig {
  relay?: {
    url?: string;
    secret?: string;
  };
  github?: {
    token?: string;
    org?: string;
  };
  cursor?: {
    apiKey?: string;
  };
  grokBot?: {
    agentsPath?: string;
  };
  statusPollIntervalMs?: number;
}

let cached: AppConfig | null = null;

export function configPath(): string {
  return resolve(process.env.CONFIG_PATH || resolve(process.cwd(), "../config.local.json"));
}

export async function loadConfig(): Promise<AppConfig> {
  if (cached) return cached;
  const path = configPath();
  try {
    const raw = await readFile(path, "utf8");
    cached = JSON.parse(raw) as AppConfig;
    return cached;
  } catch {
    cached = {};
    return cached;
  }
}

export function publicConfig(config: AppConfig) {
  return {
    relay: {
      url: config.relay?.url ?? null,
      hasSecret: Boolean(config.relay?.secret),
    },
    statusPollIntervalMs: config.statusPollIntervalMs ?? 60_000,
  };
}
