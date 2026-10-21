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
  return resolve(process.env.CONFIG_PATH || resolve(process.cwd(), "config.local.json"));
}

export async function loadConfig(): Promise<AppConfig> {
  if (cached) return cached;
  let fileConfig: AppConfig = {};
  const path = configPath();
  try {
    const raw = await readFile(path, "utf8");
    fileConfig = JSON.parse(raw) as AppConfig;
  } catch {
    fileConfig = {};
  }

  cached = {
    ...fileConfig,
    github: {
      org: fileConfig.github?.org ?? process.env.CC_GITHUB_ORG ?? "manuel-envisix",
      token: process.env.CC_GITHUB_TOKEN || fileConfig.github?.token,
    },
    cursor: {
      apiKey: process.env.CURSOR_API_KEY || fileConfig.cursor?.apiKey,
    },
    grokBot: {
      agentsPath: process.env.GROK_BOT_AGENTS_PATH || fileConfig.grokBot?.agentsPath,
    },
    statusPollIntervalMs: fileConfig.statusPollIntervalMs ?? 60_000,
  };
  return cached;
}

export function relaySecret(): string {
  return process.env.RELAY_SECRET || "";
}

export function publicConfig(config: AppConfig) {
  return {
    relay: {
      sameOrigin: true,
      pushConfigured: Boolean(relaySecret()),
    },
    statusPollIntervalMs: config.statusPollIntervalMs ?? 60_000,
    loginRequired: Boolean(process.env.CC_LOGIN_PASSWORD?.length),
  };
}
