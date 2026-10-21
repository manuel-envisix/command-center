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

function pickNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const v of values) {
    if (v && v.trim().length > 0) return v;
  }
  return undefined;
}

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
      token: pickNonEmpty(process.env.CC_GITHUB_TOKEN, fileConfig.github?.token),
    },
    cursor: {
      apiKey: pickNonEmpty(process.env.CURSOR_API_KEY, fileConfig.cursor?.apiKey),
    },
    grokBot: {
      agentsPath: pickNonEmpty(process.env.GROK_BOT_AGENTS_PATH, fileConfig.grokBot?.agentsPath),
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
    cursorAgentsEnabled: Boolean(config.cursor?.apiKey),
    cursorAgentEmbedAllowed: false,
  };
}
