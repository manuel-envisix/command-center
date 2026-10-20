import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import open from "open";
import { createServer as createViteServer } from "vite";
import { handleApi } from "./api.js";

const API_PORT = 4177;
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

async function startApiServer() {
  const server = createServer(async (req, res) => {
    try {
      const handled = await handleApi(req, res);
      if (!handled) {
        res.statusCode = 404;
        res.end("Not found");
      }
    } catch (err) {
      res.statusCode = 500;
      res.end(err instanceof Error ? err.message : "Server error");
    }
  });
  await new Promise<void>((r) => server.listen(API_PORT, "127.0.0.1", () => r()));
  return server;
}

async function main() {
  await startApiServer();

  const vite = await createViteServer({
    root: ROOT,
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${API_PORT}`,
          changeOrigin: true,
        },
      },
    },
    appType: "spa",
  });

  await vite.listen();
  const url = "http://127.0.0.1:5173";
  console.log(`Command Center läuft auf ${url}`);
  if (process.env.CI !== "true" && process.env.NO_OPEN !== "1") {
    await open(url).catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
