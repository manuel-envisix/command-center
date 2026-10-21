import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./create-server.js";

const PORT = Number(process.env.PORT || 3000);
const staticDir = resolve(fileURLToPath(new URL("../dist", import.meta.url)));

await startServer({
  port: PORT,
  staticDir,
  secureCookies: true,
});

console.log(`Command Center production server on port ${PORT}`);
