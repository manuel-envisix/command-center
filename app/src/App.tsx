import { useCallback, useMemo, useRef, useState } from "react";
import { AgentsTab } from "./components/AgentsTab";
import { BlockRenderer } from "./components/blocks/BlockRenderer";
import { StatusBar } from "./components/StatusBar";
import { useRelay } from "./hooks/useRelay";
import { findViewIndex } from "./lib/controlActions";
import { upsertViewInHistory } from "./lib/viewHistory";
import type { AgentChatPayload } from "./types/agentChat";
import {
  type DashboardMessage,
  isViewMessage,
  normalizeBlock,
} from "./types/message";

interface Toast {
  id: string;
  message: string;
  level: "info" | "success" | "warning" | "error";
}

type MainTab = "dashboard" | "agents";

function viewKey(msg: DashboardMessage, index: number) {
  return msg.id ?? `view-${msg._seq ?? index}`;
}

export default function App() {
  const [mainTab, setMainTab] = useState<MainTab>("dashboard");
  const [title, setTitle] = useState("Command Center");
  const [views, setViews] = useState<DashboardMessage[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [agentChats, setAgentChats] = useState<Record<string, AgentChatPayload>>({});
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const viewsRef = useRef(views);
  viewsRef.current = views;

  const handleMessage = useCallback((msg: DashboardMessage) => {
    if (msg.kind === "control" && msg.control) {
      const c = msg.control;
      if (c.action === "clear") {
        setViews([]);
        setCursor(-1);
        setHighlightIndex(null);
      } else if (c.action === "setTitle") {
        setTitle(c.title);
      } else if (c.action === "focus" || c.action === "highlight") {
        if (typeof c.blockIndex === "number") setHighlightIndex(c.blockIndex);
      } else if (c.action === "notify") {
        const id = crypto.randomUUID();
        setToasts((t) => [...t, { id, message: c.message, level: c.level ?? "info" }]);
        const duration = c.durationMs ?? 4000;
        setTimeout(() => {
          setToasts((t) => t.filter((x) => x.id !== id));
        }, duration);
      } else if (c.action === "showTab") {
        setMainTab(c.tab === "views" ? "dashboard" : "agents");
      } else if (c.action === "openAgent") {
        setMainTab("agents");
        setSelectedAgentId(c.agentId);
      } else if (c.action === "showView") {
        setMainTab("dashboard");
        const idx = findViewIndex(viewsRef.current, c.id);
        if (idx >= 0) setCursor(idx);
      } else if (c.action === "back") {
        setMainTab("dashboard");
        setCursor((cur) => (cur > 0 ? cur - 1 : cur));
      } else if (c.action === "forward") {
        setMainTab("dashboard");
        const len = viewsRef.current.length;
        setCursor((cur) => (cur >= 0 && cur < len - 1 ? cur + 1 : cur));
      }
      return;
    }

    if (isViewMessage(msg)) {
      setViews((prev) => {
        const { views, isNew } = upsertViewInHistory(prev, msg);
        if (isNew) {
          setCursor(views.length - 1);
        }
        return views;
      });
      if (msg.title) setTitle(msg.title);
      setHighlightIndex(null);
    }
  }, []);

  const handleAgentChat = useCallback((payload: AgentChatPayload) => {
    setAgentChats((prev) => ({ ...prev, [payload.agentId]: payload }));
  }, []);

  const { connected, publicConfig } = useRelay({
    onDashboardMessage: handleMessage,
    onAgentChat: handleAgentChat,
  });

  const current = cursor >= 0 ? views[cursor] : null;
  const blocks = useMemo(() => {
    if (!current?.blocks) return [];
    return current.blocks.map(normalizeBlock);
  }, [current]);

  const canBack = cursor > 0;
  const canForward = cursor >= 0 && cursor < views.length - 1;
  const agentsEnabled = publicConfig?.cursorAgentsEnabled ?? false;

  return (
    <div className="app-shell">
      <header className="top-bar">
        <h1>{title}</h1>
        <nav className="main-tabs" aria-label="Hauptnavigation">
          <button
            type="button"
            className={mainTab === "dashboard" ? "active" : ""}
            onClick={() => setMainTab("dashboard")}
          >
            Dashboard
          </button>
          {agentsEnabled && (
            <button
              type="button"
              className={mainTab === "agents" ? "active" : ""}
              onClick={() => setMainTab("agents")}
            >
              Agents
            </button>
          )}
        </nav>
        <span className={`conn-pill ${connected ? "ok" : "bad"}`}>
          {connected ? "Live verbunden" : "Getrennt"}
        </span>
        {mainTab === "dashboard" && (
          <>
            <button type="button" disabled={!canBack} onClick={() => setCursor((c) => c - 1)}>
              Zurück
            </button>
            <button type="button" disabled={!canForward} onClick={() => setCursor((c) => c + 1)}>
              Vorwärts
            </button>
          </>
        )}
      </header>

      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.level}`}>{t.message}</div>
        ))}
      </div>

      {mainTab === "agents" ? (
        <AgentsTab
          liveByAgentId={agentChats}
          embedAllowed={Boolean(publicConfig?.cursorAgentEmbedAllowed)}
          selectedAgentId={selectedAgentId}
          onSelectedAgentIdChange={setSelectedAgentId}
        />
      ) : (
        <div className="main-layout">
          <aside className="history-panel">
            <h2>Verlauf</h2>
            {views.length === 0 && (
              <p style={{ color: "var(--muted)", fontSize: 14 }}>Noch keine Ansichten.</p>
            )}
            {views.map((v, i) => (
              <button
                key={viewKey(v, i)}
                type="button"
                className={`history-item${i === cursor ? " active" : ""}`}
                onClick={() => setCursor(i)}
              >
                {v.title ?? `Ansicht ${i + 1}`}
                <small>
                  {v.ts ? new Date(v.ts).toLocaleString("de-AT") : `#${v._seq ?? i + 1}`}
                </small>
              </button>
            ))}
          </aside>

          <main className="stage">
            {!current && (
              <div className="stage-empty">
                <p>Warte auf Live-Ansichten vom Chief of Staff …</p>
                <p style={{ fontSize: 14 }}>
                  Push: {publicConfig?.relay.pushConfigured ? "bereit" : "RELAY_SECRET fehlt"}
                </p>
              </div>
            )}
            {blocks.map((block, i) => (
              <BlockRenderer key={i} block={block} highlighted={highlightIndex === i} />
            ))}
          </main>
        </div>
      )}

      <StatusBar intervalMs={publicConfig?.statusPollIntervalMs ?? 60_000} />
    </div>
  );
}
