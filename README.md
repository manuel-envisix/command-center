# Command Center

Lokales Live-Dashboard (UI auf Deutsch) für Manuel Kroiß / Envisix: Grok Bot pusht Ansichten über einen Cloudflare-Relay, während GitHub, Cursor Cloud Agents und Grok-Bot-Exporte in der Statusleiste erscheinen.

## Architektur

| Teil | Beschreibung |
|------|----------------|
| `relay/` | Cloudflare Worker + Durable Object: `POST /push`, WebSocket `GET /ws`, letzte 50 Nachrichten |
| `app/` | Vite + React Dashboard, lokaler API-Proxy für Tokens |
| `push/` | CLI zum Testen von Push-Nachrichten |
| `docs/messages.md` | Nachrichtenschema für den Chief of Staff |

## Voraussetzungen

- Node.js 20+
- Cloudflare-Konto (Free Tier) für den Relay
- Lokale `config.local.json` (nicht committen)

## Einrichtung (lokal)

1. Repository klonen und Abhängigkeiten installieren:

```bash
npm install
```

2. Beispiel-Konfiguration kopieren:

```bash
cp config.example.json config.local.json
```

3. `config.local.json` anpassen: Relay-URL/Secret, optional GitHub-Token, Cursor API Key, optional Pfad zu Grok-Bot-Agent-Exporten.

4. Dashboard starten (öffnet den Browser):

```bash
npm start
```

## Relay deployen (Cloudflare)

1. In `relay/` einloggen und Secret setzen:

```bash
cd relay
npx wrangler login
```

```bash
npx wrangler secret put RELAY_SECRET
```

2. Worker deployen:

```bash
npx wrangler deploy
```

3. Die ausgegebene `*.workers.dev`-URL in `config.local.json` unter `relay.url` eintragen. Dasselbe Secret wie bei `RELAY_SECRET` unter `relay.secret` (nur lokal).

### Worker-Secrets & Bindings

| Name | Art | Beschreibung |
|------|-----|--------------|
| `RELAY_SECRET` | Secret (Pflicht) | Bearer-Token für `POST /push` und WebSocket-Auth (`?secret=` oder Subprotocol `cc-secret.<wert>`) |
| `RELAY_ROOM` | Durable Object Binding | In `wrangler.toml` vorkonfiguriert |

Keine weiteren Secrets im Worker nötig.

### Relay lokal testen

```bash
cd relay
npx wrangler dev
```

## Push testen

```bash
node push/bin/push.mjs --file push/examples/view-status.json
```

Mit stdin:

```bash
cat push/examples/control-toast.json | node push/bin/push.mjs
```

## Beispiel-Push (Minimal)

```json
{
  "version": 1,
  "kind": "view",
  "title": "Hallo Command Center",
  "blocks": [
    { "type": "markdown", "content": "Erste **Live-Ansicht**." }
  ]
}
```

```bash
curl -X POST "$RELAY_URL/push" \
  -H "Authorization: Bearer $RELAY_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"version":1,"kind":"view","title":"Test","blocks":[{"type":"markdown","content":"Hi"}]}'
```

## Sicherheit

- Dieses Repo ist **öffentlich**: keine echten Tokens, IPs oder privaten Hostnamen committen.
- Secrets nur in `config.local.json` (gitignored) und als Cloudflare Worker Secret `RELAY_SECRET`.
- GitHub- und Cursor-Tokens werden nur vom lokalen API-Server verwendet; das Frontend ruft `/api/status/*` auf.
- Die Relay-WebSocket-URL mit Secret wird nur über `GET /api/relay/ws-url` an den lokalen Browser geliefert.
- `html`-Blöcke laufen in einem sandboxed `iframe` ohne Berechtigungen.

## Tests & CI

```bash
npm test
npm run typecheck
```

GitHub Actions (`.github/workflows/ci.yml`) führt Typecheck und Tests aus.

## Lizenz

Siehe [LICENSE](LICENSE).
