import { useCallback, useMemo, useState } from "react";
import { BlockRenderer } from "./components/blocks/BlockRenderer";
import { StatusBar } from "./components/StatusBar";
import { useRelay } from "./hooks/useRelay";
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

function viewKey(msg: DashboardMessage, index: number) {
  return msg.id ?? `view-${msg._seq ?? index}`;
}

export default function App() {
  const [title, setTitle] = useState("Command Center");
  const [views, setViews] = useState<DashboardMessage[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

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
      }
      return;
    }

    if (isViewMessage(msg)) {
      setViews((prev) => {
        const next = [...prev, msg];
        setCursor(next.length - 1);
        return next;
      });
      if (msg.title) setTitle(msg.title);
      setHighlightIndex(null);
    }
  }, []);

  const { connected, publicConfig } = useRelay(handleMessage);

  const current = cursor >= 0 ? views[cursor] : null;
  const blocks = useMemo(() => {
    if (!current?.blocks) return [];
    return current.blocks.map(normalizeBlock);
  }, [current]);

  const canBack = cursor > 0;
  const canForward = cursor >= 0 && cursor < views.length - 1;

  return (
    <div className="app-shell">
      <header className="top-bar">
        <h1>{title}</h1>
        <span className={`conn-pill ${connected ? "ok" : "bad"}`}>
          {connected ? "Live verbunden" : "Getrennt"}
        </span>
        <button type="button" disabled={!canBack} onClick={() => setCursor((c) => c - 1)}>
          Zurück
        </button>
        <button type="button" disabled={!canForward} onClick={() => setCursor((c) => c + 1)}>
          Vorwärts
        </button>
      </header>

      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.level}`}>{t.message}</div>
        ))}
      </div>

      <div className="main-layout">
        <aside className="history-panel">
          <h2>Verlauf</h2>
          {views.length === 0 && <p style={{ color: "var(--muted)", fontSize: 14 }}>Noch keine Ansichten.</p>}
          {views.map((v, i) => (
            <button
              key={viewKey(v, i)}
              type="button"
              className={`history-item${i === cursor ? " active" : ""}`}
              onClick={() => setCursor(i)}
            >
              {v.title ?? `Ansicht ${i + 1}`}
              <small>{v.ts ? new Date(v.ts).toLocaleString("de-AT") : `#${v._seq ?? i + 1}`}</small>
            </button>
          ))}
        </aside>

        <main className="stage">
          {!current && (
            <div className="stage-empty">
              <p>Warte auf Live-Ansichten vom Chief of Staff …</p>
              <p style={{ fontSize: 14 }}>
                Relay: {publicConfig?.relay.url ?? "nicht konfiguriert"}
              </p>
            </div>
          )}
          {blocks.map((block, i) => (
            <BlockRenderer key={i} block={block} highlighted={highlightIndex === i} />
          ))}
        </main>
      </div>

      <StatusBar intervalMs={publicConfig?.statusPollIntervalMs ?? 60_000} />
    </div>
  );
}
