import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import open from "open";
import { createServer as createViteServer } from "vite";
import { startServer } from "./create-server.js";

const PORT = Number(process.env.PORT || 5173);
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

async function main() {
  const vite = await createViteServer({
    root: ROOT,
    server: { middlewareMode: true },
    appType: "spa",
  });

  await startServer({
    port: PORT,
    host: "127.0.0.1",
    secureCookies: false,
    viteMiddleware: (req, res, next) => {
      vite.middlewares(req, res, next);
    },
  });

  const url = `http://127.0.0.1:${PORT}`;
  console.log(`Command Center läuft auf ${url}`);
  if (process.env.CI !== "true" && process.env.NO_OPEN !== "1") {
    await open(url).catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
