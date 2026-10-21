export function loginPageHtml(error?: string): string {
  const err = error ? `<p class="err">${escapeHtml(error)}</p>` : "";
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Command Center — Anmeldung</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f1117; color: #e8ecf4; display: grid; place-items: center; min-height: 100vh; margin: 0; }
    form { background: #171b26; border: 1px solid #2a3142; border-radius: 12px; padding: 24px; width: min(360px, 92vw); }
    h1 { font-size: 1.1rem; margin: 0 0 16px; }
    label { display: block; font-size: 0.85rem; color: #9aa3b5; margin-bottom: 6px; }
    input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #2a3142; background: #0f1117; color: inherit; }
    button { margin-top: 16px; width: 100%; padding: 10px; border: 0; border-radius: 8px; background: #5b9dff; color: #0f1117; font-weight: 600; cursor: pointer; }
    .err { color: #ff6b6b; font-size: 0.9rem; }
  </style>
</head>
<body>
  <form method="post" action="/api/login">
    <h1>Command Center</h1>
    ${err}
    <label for="password">Passwort</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required />
    <button type="submit">Anmelden</button>
  </form>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
