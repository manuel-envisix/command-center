import { useCallback, useEffect, useRef, useState } from "react";
import { parseAgentChatPayload, type AgentChatPayload } from "../types/agentChat";
import type { DashboardMessage } from "../types/message";
import { parseIncomingMessage } from "../types/message";

interface PublicConfig {
  relay: { sameOrigin: boolean; pushConfigured: boolean };
  statusPollIntervalMs: number;
  loginRequired?: boolean;
  cursorAgentsEnabled?: boolean;
  cursorAgentEmbedAllowed?: boolean;
}

function wsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

interface RelayHandlers {
  onDashboardMessage: (msg: DashboardMessage) => void;
  onAgentChat?: (msg: AgentChatPayload) => void;
}

export function useRelay({ onDashboardMessage, onAgentChat }: RelayHandlers) {
  const [connected, setConnected] = useState(false);
  const [publicConfig, setPublicConfig] = useState<PublicConfig | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const onDashboardRef = useRef(onDashboardMessage);
  const onAgentChatRef = useRef(onAgentChat);
  onDashboardRef.current = onDashboardMessage;
  onAgentChatRef.current = onAgentChat;

  const connect = useCallback(async () => {
    const res = await fetch("/api/config/public");
    const cfg = (await res.json()) as PublicConfig;
    setPublicConfig(cfg);

    if (wsRef.current) {
      wsRef.current.close();
    }

    const socket = new WebSocket(wsUrl());
    wsRef.current = socket;

    socket.onopen = () => setConnected(true);
    socket.onclose = () => {
      setConnected(false);
      setTimeout(() => connect().catch(() => undefined), 3000);
    };
    socket.onerror = () => setConnected(false);
    socket.onmessage = (ev) => {
      try {
        const raw = JSON.parse(String(ev.data));
        const agentChat = parseAgentChatPayload(raw);
        if (agentChat) {
          onAgentChatRef.current?.(agentChat);
          return;
        }
        const parsed = parseIncomingMessage(raw);
        if (parsed) onDashboardRef.current(parsed);
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
