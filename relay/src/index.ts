import { RelayRoom } from "./relay-room";

export { RelayRoom };

export interface Env {
  RELAY_ROOM: DurableObjectNamespace<RelayRoom>;
  RELAY_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/health" && request.method === "GET") {
      return new Response(JSON.stringify({ ok: true, service: "command-center-relay" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const id = env.RELAY_ROOM.idFromName("global");
    const stub = env.RELAY_ROOM.get(id);
    const doUrl = new URL(request.url);
    doUrl.pathname = path;
    const doRequest = new Request(doUrl.toString(), request);
    return stub.fetch(doRequest);
  },
} satisfies ExportedHandler<Env>;
