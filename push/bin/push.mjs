#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function usage() {
  console.error(`Usage: node push/bin/push.mjs [--config path] [--file payload.json] [--url baseUrl]
       echo '{"kind":"view",...}' | node push/bin/push.mjs

Uses COMMAND_CENTER_URL + RELAY_SECRET from env, or config.local.json (relay.url / relay.secret legacy keys).`);
  process.exit(1);
}

async function loadConfig(configPath) {
  const raw = await readFile(configPath, "utf8");
  return JSON.parse(raw);
}

async function main() {
  const args = process.argv.slice(2);
  let configPath = resolve(process.env.CONFIG_PATH || "./config.local.json");
  let filePath = null;
  let cliUrl = process.env.COMMAND_CENTER_URL || null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config" && args[i + 1]) {
      configPath = resolve(args[++i]);
    } else if (args[i] === "--file" && args[i + 1]) {
      filePath = resolve(args[++i]);
    } else if (args[i] === "--url" && args[i + 1]) {
      cliUrl = args[++i];
    } else if (args[i] === "-h" || args[i] === "--help") {
      usage();
    }
  }

  let bodyText;
  if (filePath) {
    bodyText = await readFile(filePath, "utf8");
  } else {
    bodyText = await new Promise((res, rej) => {
      const chunks = [];
      process.stdin.on("data", (c) => chunks.push(c));
      process.stdin.on("end", () => res(Buffer.concat(chunks).toString("utf8")));
      process.stdin.on("error", rej);
      if (process.stdin.isTTY) {
        res("");
      }
    });
  }

  if (!bodyText.trim()) {
    usage();
  }

  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    console.error("Invalid JSON payload");
    process.exit(1);
  }

  let url = cliUrl;
  let secret = process.env.RELAY_SECRET || null;
  if (!url || !secret) {
    try {
      const config = await loadConfig(configPath);
      url = url || config?.relay?.url || config?.commandCenterUrl;
      secret = secret || config?.relay?.secret;
    } catch {
      // optional config file
    }
  }

  if (!url || !secret) {
    console.error("Set COMMAND_CENTER_URL and RELAY_SECRET, or provide config with relay.url / relay.secret");
    process.exit(1);
  }

  const pushUrl = `${url.replace(/\/$/, "")}/push`;
  const res = await fetch(pushUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`Push failed (${res.status}): ${text}`);
    process.exit(1);
  }
  console.log(text);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
