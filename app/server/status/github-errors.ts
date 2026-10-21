export class GithubApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`GitHub API ${status}`);
    this.name = "GithubApiError";
  }
}

export function friendlyGithubError(err: unknown, owner: string): string {
  if (err instanceof GithubApiError) {
    if (err.status === 401) {
      return "GitHub-Token ungültig oder abgelaufen.";
    }
    if (err.status === 403) {
      return "GitHub-Zugriff verweigert (Token-Rechte prüfen).";
    }
    if (err.status === 404) {
      return `GitHub-Konto „${owner}“ nicht gefunden oder nicht sichtbar.`;
    }
    if (err.status >= 500) {
      return "GitHub ist vorübergehend nicht erreichbar.";
    }
    return `GitHub-Abfrage fehlgeschlagen (${err.status}).`;
  }
  if (err instanceof Error && err.message.startsWith("GitHub API")) {
    const status = Number(/GitHub API (\d+)/.exec(err.message)?.[1]);
    if (status === 401) return "GitHub-Token ungültig oder abgelaufen.";
    if (status === 403) return "GitHub-Zugriff verweigert (Token-Rechte prüfen).";
    if (status === 404) {
      return `GitHub-Konto „${owner}“ nicht gefunden oder nicht sichtbar.`;
    }
    if (status >= 500) return "GitHub ist vorübergehend nicht erreichbar.";
    if (status) return `GitHub-Abfrage fehlgeschlagen (${status}).`;
  }
  return "GitHub-Status konnte nicht geladen werden.";
}
