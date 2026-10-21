import { useEffect, useState } from "react";

interface GithubStatus {
  configured: boolean;
  org: string | null;
  totalOpenPrs: number;
  repos: Array<{ name: string; openPrs: number; ciStatus: string }>;
  error?: string;
}

interface CursorStatus {
  configured: boolean;
  agents: Array<{ name: string; status: string }>;
  error?: string;
}

interface GrokStatus {
  configured: boolean;
  agents: Array<{ name: string; lastExport: string | null }>;
  error?: string;
}

export function StatusBar({ intervalMs }: { intervalMs: number }) {
  const [github, setGithub] = useState<GithubStatus | null>(null);
  const [cursor, setCursor] = useState<CursorStatus | null>(null);
  const [grok, setGrok] = useState<GrokStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/status/all");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setGithub(data.github);
          setCursor(data.cursor);
          setGrok(data.grokBot);
        }
      } catch {
        // Statusleiste bleibt mit letztem Stand / leer.
      }
    }
    load();
    const id = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  const showGrok = Boolean(grok?.configured);

  return (
    <footer
      className="status-bar"
      style={{ gridTemplateColumns: showGrok ? "repeat(3, 1fr)" : "repeat(2, 1fr)" }}
      aria-label="Systemstatus"
    >
      <section className="status-section">
        <h3>GitHub</h3>
        {!github?.configured && <div>Nicht konfiguriert</div>}
        {github?.configured && (
          <div>
            {github.error ? (
              <span style={{ color: "var(--err)" }}>{github.error}</span>
            ) : (
              <>
                <strong>{github.org}</strong> · {github.totalOpenPrs} offene PRs
                <ul>
                  {github.repos.slice(0, 4).map((r) => (
                    <li key={r.name}>
                      {r.name}: {r.openPrs} PR · CI {r.ciStatus}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </section>
      <section className="status-section">
        <h3>Cursor Cloud Agents</h3>
        {!cursor?.configured && <div>Nicht konfiguriert</div>}
        {cursor?.configured && (
          <div>
            {cursor.error ? (
              <span style={{ color: "var(--err)" }}>{cursor.error}</span>
            ) : (
              <ul>
                {cursor.agents.slice(0, 5).map((a, i) => (
                  <li key={`${a.name}-${i}`}>{a.name} ({a.status})</li>
                ))}
                {cursor.agents.length === 0 && <li>Keine Agenten</li>}
              </ul>
            )}
          </div>
        )}
      </section>
      {showGrok && (
        <section className="status-section">
          <h3>Grok Bot Assistenten</h3>
          <div>
            {grok?.error ? (
              <span style={{ color: "var(--warn)" }}>{grok.error}</span>
            ) : (
              <ul>
                {grok?.agents.slice(0, 6).map((a) => (
                  <li key={a.name}>
                    {a.name}
                    {a.lastExport ? ` · ${new Date(a.lastExport).toLocaleDateString("de-AT")}` : ""}
                  </li>
                ))}
                {(grok?.agents.length ?? 0) === 0 && <li>Keine Exporte gefunden</li>}
              </ul>
            )}
          </div>
        </section>
      )}
    </footer>
  );
}
