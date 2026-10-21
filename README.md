# Command Center

Live-Dashboard (UI auf Deutsch) für Manuel Kroiß / Envisix: Grok Bot pusht Ansichten per HTTP, GitHub / Cursor Cloud Agents / Grok-Bot-Exporte erscheinen in der Statusleiste.

**Produktion:** https://agent-factory.envisix.at (Docker + Traefik auf dem vServer)

## Architektur

| Teil | Beschreibung |
|------|----------------|
| `app/` | Vite + React UI, Node-Server mit integriertem Relay (`POST /push`, WebSocket `/ws`, Historie 50 Nachrichten, optional `/data` Volume) |
| `push/` | CLI zum Testen von Push-Nachrichten |
| `deployment/` | `docker-compose.yml` für Traefik, `remote-deploy.sh` |
| `docs/messages.md` | Nachrichtenschema für den Chief of Staff |

## Lokale Entwicklung

```bash
npm install
cp config.example.json config.local.json   # optional für Status-APIs
npm start
```

Ohne `CC_LOGIN_PASSWORD` ist die Anmeldung lokal deaktiviert. Für Login-Tests:

```bash
export CC_LOGIN_PASSWORD='dev-pass'
export SESSION_SECRET='local-dev-session-secret'
export RELAY_SECRET='local-dev-relay-secret'
npm start
```

## VPS / Produktion (envisix-prod-01)

### Einmalig auf dem Server

```bash
mkdir -p ~/hosting/command-center/data
```

Generate-once Secrets (werden von `deployment/remote-deploy.sh` angelegt, wenn sie fehlen):

- `~/hosting/command-center/.env` — `RELAY_SECRET`, `SESSION_SECRET`

Runtime-Konfiguration (von CI geschrieben, **nicht committen**):

- `~/hosting/command-center/.env.runtime` — Image-Tag, `CC_LOGIN_PASSWORD`, optionale API-Keys

### Docker Compose (Traefik)

- Host: `agent-factory.envisix.at`
- Entrypoint: `websecure`, `certresolver=letsencrypt-dns`
- Netzwerk: externes `proxy`
- Siehe `deployment/docker-compose.yml`

### Image

```bash
docker build -t ghcr.io/manuel-envisix/command-center:local .
```

Registry: `ghcr.io/manuel-envisix/command-center`

### GitHub Actions Deploy

Workflow: `.github/workflows/deploy.yml` (Push auf `main` und `cursor/command-center-v1-c5e1`, plus `workflow_dispatch`).

**Repository-Secrets (Deploy):**

| Secret | Pflicht | Hinweis |
|--------|---------|---------|
| `SSH_PRIVATE_KEY` | ja | SSH-Key für VPS |
| `VPS_HOST` | ja | Hostname des vServers |
| `VPS_USER` | ja | SSH-Benutzer |
| `CC_LOGIN_PASSWORD` oder `CC_LOGIN_PASSWORD_B64` | ja | Dashboard-Passwort (Base64 empfohlen bei `$` / `\`) |
| `CC_GITHUB_TOKEN` / `CC_GITHUB_TOKEN_B64` | nein | Statusleiste GitHub |
| `CURSOR_API_KEY` / `CURSOR_API_KEY_B64` | nein | Statusleiste Cursor |

Fehlen Pflicht-Secrets, wird der Deploy-Job mit Hinweis übersprungen (Build läuft weiter).

### RELAY_SECRET für den Grok Bot (Assistant Push)

Auf dem VPS (Werte nicht in Logs teilen):

```bash
grep '^RELAY_SECRET=' ~/hosting/command-center/.env
```

Nur dieser Pfad — Secret lokal kopieren und dem Assistant als Bearer-Token geben.

## Ansicht vom Grok Bot pushen

```bash
curl -sS -X POST 'https://agent-factory.envisix.at/push' \
  -H "Authorization: Bearer $RELAY_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"version":1,"kind":"view","title":"Test","blocks":[{"type":"markdown","content":"Hallo **Command Center**"}]}'
```

`/push` ist **nicht** hinter dem Login — nur Bearer `RELAY_SECRET`. UI, `/api/*` und WebSocket `/ws` erfordern die Session (Passwort `CC_LOGIN_PASSWORD`).

CLI:

```bash
export COMMAND_CENTER_URL='https://agent-factory.envisix.at'
export RELAY_SECRET='...'
node push/bin/push.mjs --file push/examples/view-status.json
```

## Sicherheit

- Öffentliches Repo: keine Secrets, IPs oder privaten Hostnamen committen.
- Produktion: HttpOnly-Session-Cookie (signiert mit `SESSION_SECRET`), Rate-Limit auf Login.
- Status-Tokens nur als Container-Env (`CC_GITHUB_TOKEN`, `CURSOR_API_KEY`).

## Tests

```bash
npm run typecheck
npm test
```

## Lizenz

Siehe [LICENSE](LICENSE).
