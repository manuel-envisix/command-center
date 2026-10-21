import { marked } from "marked";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ImageLightbox } from "./ImageLightbox";
import type { AgentChatPayload, AgentSummary } from "../types/agentChat";

interface AgentsTabProps {
  liveByAgentId: Record<string, AgentChatPayload>;
  embedAllowed: boolean;
  selectedAgentId: string | null;
  onSelectedAgentIdChange: (id: string | null) => void;
}

function repoLabel(agent: AgentSummary): string {
  const repo = agent.repos?.[0];
  if (!repo) return "—";
  const short = repo.url.replace(/^https?:\/\//, "");
  const branch = repo.branch ?? repo.startingRef;
  return branch ? `${short} · ${branch}` : short;
}

function prLink(agent: AgentSummary): string | null {
  return agent.repos?.find((r) => r.prUrl)?.prUrl ?? null;
}

export function AgentsTab({
  liveByAgentId,
  embedAllowed,
  selectedAgentId,
  onSelectedAgentIdChange,
}: AgentsTabProps) {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [configured, setConfigured] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const selectedId = selectedAgentId;
  const [followUp, setFollowUp] = useState("");
  const [confirmSend, setConfirmSend] = useState(false);
  const [sending, setSending] = useState(false);

  const selected = selectedId ? liveByAgentId[selectedId] : null;
  const selectedMeta = useMemo(
    () => agents.find((a) => a.id === selectedId) ?? selected?.agent,
    [agents, selectedId, selected],
  );

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/live");
      const data = await res.json();
      setConfigured(Boolean(data.configured));
      setAgents(data.agents ?? []);
      setLoadError(data.configured ? null : "CURSOR_API_KEY nicht konfiguriert");
    } catch {
      setLoadError("Agentenliste konnte nicht geladen werden");
    }
  }, []);

  useEffect(() => {
    refreshList();
    const id = setInterval(refreshList, 30_000);
    return () => clearInterval(id);
  }, [refreshList]);

  useEffect(() => {
    if (!selectedId) return;
    void fetch(`/api/agents/${encodeURIComponent(selectedId)}/watch`, { method: "POST" });
    return () => {
      void fetch(`/api/agents/${encodeURIComponent(selectedId)}/watch`, { method: "DELETE" });
    };
  }, [selectedId]);

  const openAgent = (id: string) => onSelectedAgentIdChange(id);
  const closeAgent = () => onSelectedAgentIdChange(null);

  const sendFollowUp = async () => {
    if (!selectedId || !followUp.trim() || !confirmSend) return;
    setSending(true);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(selectedId)}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: followUp.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setFollowUp("");
      setConfirmSend(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Senden fehlgeschlagen");
    } finally {
      setSending(false);
    }
  };

  if (!configured) {
    return (
      <div className="agents-empty">
        <p>{loadError ?? "Cursor Cloud Agents nicht verfügbar."}</p>
      </div>
    );
  }

  if (selectedId) {
    const detail = selectedMeta ?? {
      id: selectedId,
      name: selectedId,
      status: "…",
    };
    const cursorUrl = detail.url ?? `https://cursor.com/agents/${selectedId}`;
    const pr = prLink(detail);
    return (
      <div className="agents-detail">
        <button type="button" className="agents-back" onClick={closeAgent}>
          ← Agenten
        </button>
        <header className="agents-detail-header">
          <div>
            <h2>{detail.name}</h2>
            <p className="agents-meta">
              {detail.status} · {repoLabel(detail)}
            </p>
          </div>
          <div className="agents-detail-actions">
            <a className="btn-link" href={cursorUrl} target="_blank" rel="noreferrer">
              In Cursor öffnen
            </a>
            {pr && (
              <a className="btn-link" href={pr} target="_blank" rel="noreferrer">
                PR
              </a>
            )}
          </div>
        </header>

        {!embedAllowed && (
          <p className="agents-embed-hint">
            Live-Einbettung ist blockiert (X-Frame-Options: SAMEORIGIN). Nutze „In Cursor öffnen“.
          </p>
        )}
        {embedAllowed && (
          <iframe
            className="agents-embed"
            title="Cursor Agent Live"
            src={cursorUrl}
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        )}

        {selected?.artifacts && selected.artifacts.length > 0 && (
          <section className="agents-artifacts" aria-label="Agent-Artefakte">
            <h3>Screenshots &amp; Artefakte</h3>
            <div className="agents-artifact-grid">
              {selected.artifacts.map((artifact) =>
                artifact.kind === "image" ? (
                  <ImageLightbox
                    key={artifact.path}
                    src={artifact.proxyUrl}
                    alt={artifact.name}
                    className="agents-artifact-thumb"
                  />
                ) : (
                  <a
                    key={artifact.path}
                    className="agents-artifact-file"
                    href={artifact.proxyUrl}
                    download={artifact.name}
                  >
                    {artifact.name}
                  </a>
                ),
              )}
            </div>
          </section>
        )}

        <div className="agents-chat">
          {selected?.error && <p className="agents-error">{selected.error}</p>}
          {(selected?.messages ?? []).map((m) => (
            <div key={m.id} className={`chat-bubble ${m.role}`}>
              <div
                className="chat-content"
                dangerouslySetInnerHTML={{
                  __html: marked.parse(m.content, { async: false }) as string,
                }}
              />
            </div>
          ))}
          {(selected?.messages?.length ?? 0) === 0 && (
            <p className="agents-meta">Keine Nachrichten geladen …</p>
          )}
        </div>

        <div className="agents-followup">
          <textarea
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            placeholder="Follow-up an den Agenten …"
            rows={3}
          />
          <label className="confirm-row">
            <input
              type="checkbox"
              checked={confirmSend}
              onChange={(e) => setConfirmSend(e.target.checked)}
            />
            Follow-up senden bestätigen
          </label>
          <button
            type="button"
            disabled={!confirmSend || !followUp.trim() || sending}
            onClick={sendFollowUp}
          >
            {sending ? "Sende …" : "Follow-up senden"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="agents-list-wrap">
      <div className="agents-list">
        {agents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            className="agents-list-item"
            onClick={() => openAgent(agent.id)}
          >
            <strong>{agent.name}</strong>
            <span className="agents-meta">{agent.status}</span>
            <span className="agents-meta">{repoLabel(agent)}</span>
            {prLink(agent) && <span className="agents-meta">PR verfügbar</span>}
          </button>
        ))}
        {agents.length === 0 && <p className="agents-meta">Keine Cloud Agents gefunden.</p>}
      </div>
    </div>
  );
}
