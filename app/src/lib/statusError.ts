/** Short, user-facing status text — never show raw API JSON in the footer. */
export function formatStatusError(message: string, fallback = "Status konnte nicht geladen werden."): string {
  const trimmed = message.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith("GitHub API ") && trimmed.includes("{")) {
    const status = Number(/^GitHub API (\d+)/.exec(trimmed)?.[1]);
    if (status === 401) return "GitHub-Token ungültig oder abgelaufen.";
    if (status === 403) return "GitHub-Zugriff verweigert.";
    if (status === 404) return "GitHub-Konto nicht gefunden.";
    if (status) return `GitHub-Abfrage fehlgeschlagen (${status}).`;
    return "GitHub-Status konnte nicht geladen werden.";
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return fallback;
  }
  if (trimmed.length > 120) {
    return `${trimmed.slice(0, 117)}…`;
  }
  return trimmed;
}
