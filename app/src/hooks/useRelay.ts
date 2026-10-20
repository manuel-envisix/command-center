import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardMessage } from "../types/message";
import { parseIncomingMessage } from "../types/message";

interface PublicConfig {
  relay: { url: string | null; hasSecret: boolean };
  statusPollIntervalMs: number;
}

export function useRelay(onMessage: (msg: DashboardMessage) => void) {
  const [connected, setConnected] = useState(false);
  const [publicConfig, setPublicConfig] = useState<PublicConfig | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(async () => {
    const res = await fetch("/api/config/public");
    const cfg = (await res.json()) as PublicConfig;
    setPublicConfig(cfg);

    if (!cfg.relay.url || !cfg.relay.hasSecret) {
      setConnected(false);
      return;
    }

    const secretRes = await fetch("/api/relay/ws-url");
    if (!secretRes.ok) {
      setConnected(false);
      return;
    }
    const { url: fullUrl } = (await secretRes.json()) as { url: string };

    if (wsRef.current) {
      wsRef.current.close();
    }

    const socket = new WebSocket(fullUrl);
    wsRef.current = socket;

    socket.onopen = () => setConnected(true);
    socket.onclose = () => {
      setConnected(false);
      setTimeout(() => connect().catch(() => undefined), 3000);
    };
    socket.onerror = () => setConnected(false);
    socket.onmessage = (ev) => {
      try {
        const parsed = parseIncomingMessage(JSON.parse(String(ev.data)));
        if (parsed) onMessageRef.current(parsed);
      } catch {
        // Ignorieren.
      }
    };
  }, []);

  useEffect(() => {
    connect().catch(() => undefined);
    return () => wsRef.current?.close();
  }, [connect]);

  return { connected, publicConfig };
}
