# Command Center — Nachrichtenschema (v1)

Der Chief of Staff (Grok Bot) sendet JSON-Nachrichten per `POST /push` an den Relay. Das Dashboard rendert `kind: "view"` und verarbeitet `kind: "control"`.

## Envelope

```json
{
  "version": 1,
  "kind": "view",
  "id": "optional-stable-id",
  "ts": "2026-10-20T20:00:00.000Z",
  "title": "Optionaler Titel der Ansicht",
  "blocks": []
}
```

| Feld | Pflicht | Beschreibung |
|------|---------|--------------|
| `version` | empfohlen | `1` |
| `kind` | ja | `"view"` oder `"control"` |
| `id` | nein | Stabile ID für Verlauf/Deduplizierung |
| `ts` | nein | ISO-Zeitstempel |
| `title` | nein | Setzt Dashboard-Titel bei Views |
| `blocks` | bei `view` | Array von Block-Objekten |
| `control` | bei `control` | Steuerungsaktion (siehe unten) |

Unbekannte Block-Typen werden als JSON angezeigt; das Dashboard stürzt nicht ab.

## Blöcke

Jeder Block hat ein Pflichtfeld `type`.

### `markdown`

```json
{ "type": "markdown", "content": "## Überschrift\nText mit **Fett**." }
```

### `card`

```json
{
  "type": "card",
  "title": "Deploy",
  "status": "ok",
  "body": "Relay ist live.",
  "links": [{ "label": "Dashboard", "href": "https://example.com" }]
}
```

`status` ist frei (z. B. `ok`, `running`, `error`) und steuert die Farbe.

### `cards`

```json
{
  "type": "cards",
  "items": [
    { "title": "GitHub", "status": "ok", "body": "2 PRs" },
    { "title": "Cursor", "status": "running", "body": "Agent aktiv" }
  ]
}
```

### `table`

```json
{
  "type": "table",
  "title": "Repos",
  "columns": ["Repo", "PRs", "CI"],
  "rows": [
    ["command-center", "1", "success"],
    ["other", "0", "pending"]
  ]
}
```

`rows` kann auch Objekte sein: `{ "Repo": "x", "PRs": "1" }` (Schlüssel gemäß `columns`).

### `list`

```json
{ "type": "list", "title": "Nächste Schritte", "items": ["A", "B", "C"] }
```

### `checklist`

```json
{
  "type": "checklist",
  "title": "Heute",
  "items": [
    { "label": "Relay deployen", "checked": true },
    { "label": "Demo", "checked": false }
  ]
}
```

### `keyValue`

```json
{
  "type": "keyValue",
  "title": "Kontext",
  "entries": {
    "Organisation": "manuel-envisix",
    "Offene PRs": 3,
    "Bereit": true
  }
}
```

### `chart`

```json
{
  "type": "chart",
  "title": "PRs pro Woche",
  "chartType": "bar",
  "labels": ["Mo", "Di", "Mi", "Do", "Fr"],
  "series": [{ "name": "PRs", "values": [1, 0, 2, 1, 3] }]
}
```

`chartType`: `"bar"` (Standard) oder `"line"`.

### `image`

```json
{
  "type": "image",
  "url": "https://example.com/chart.png",
  "alt": "Beschreibung",
  "caption": "Optional"
}
```

Alternativ kann der Chief of Staff ein Bild **inline** pushen (max. **5 MB** nach Dekodierung). Der Server speichert es im Daten-Volume und ersetzt `dataUrl` durch eine geschützte URL (`/media/uploads/…`, nur nach Login):

```json
{
  "type": "image",
  "dataUrl": "data:image/png;base64,iVBORw0KGgo…",
  "caption": "Screenshot vom Grok Bot"
}
```

Oder zuerst hochladen und die zurückgegebene URL in einem View-Block verwenden (siehe **Bild-Upload** unten).

### `linkList`

```json
{
  "type": "linkList",
  "title": "Links",
  "links": [{ "label": "GitHub Org", "href": "https://github.com/manuel-envisix" }]
}
```

### `html` (sandbox)

Für Sonderfälle: Inhalt wird in einem **sandboxed** `iframe` (`srcdoc`, ohne Rechte) gerendert.

```json
{
  "type": "html",
  "title": "Widget",
  "content": "<div style='font-family:sans-serif'><h2>Hallo</h2></div>"
}
```

## Steuerung (`kind: "control"`)

```json
{
  "version": 1,
  "kind": "control",
  "control": { "action": "clear" }
}
```

| `action` | Felder | Wirkung |
|----------|--------|---------|
| `clear` | — | Verlauf leeren |
| `setTitle` | `title` | Fenstertitel setzen |
| `focus` / `highlight` | `blockIndex` oder `blockId` | Block hervorheben |
| `notify` | `message`, optional `level`, `durationMs` | Toast (`info`, `success`, `warning`, `error`) |
| `showTab` | `tab`: `"views"` oder `"agents"` | Hauptreiter wechseln (`views` = Dashboard/Verlauf) |
| `openAgent` | `agentId` (z. B. `bc-…`) | Reiter Agents + Live-Chat dieses Cloud Agents |
| `showView` | `id` | Im Verlauf zur Ansicht springen (`id` oder `_seq` als String) |
| `back` | — | Eine Ansicht zurück im Verlauf |
| `forward` | — | Eine Ansicht vor im Verlauf |

Alle Steuerungsnachrichten werden über WebSocket an **alle** verbundenen Clients gebroadcastet; jeder Client führt die Aktion sofort aus (z. B. Sprachbefehl vom Chief of Staff über `POST /push`).

### Beispiele: Navigation per Sprache

```json
{ "version": 1, "kind": "control", "control": { "action": "showTab", "tab": "views" } }
```

```json
{ "version": 1, "kind": "control", "control": { "action": "showTab", "tab": "agents" } }
```

```json
{
  "version": 1,
  "kind": "control",
  "control": { "action": "openAgent", "agentId": "bc-539eaa0e-7c93-54f6-a803-7dc9e58fc5e1" }
}
```

```json
{ "version": 1, "kind": "control", "control": { "action": "showView", "id": "daily-brief" } }
```

```json
{ "version": 1, "kind": "control", "control": { "action": "back" } }
```

```json
{ "version": 1, "kind": "control", "control": { "action": "forward" } }
```

## Beispiel: komplette View pushen

```bash
export COMMAND_CENTER_URL='https://agent-factory.envisix.at'
export RELAY_SECRET='…'
node push/bin/push.mjs --file push/examples/view-status.json
```

Oder `curl -X POST https://agent-factory.envisix.at/push` mit Header `Authorization: Bearer $RELAY_SECRET`.

## Bild-Upload (`POST /upload`)

Authentifizierung wie bei `/push`: `Authorization: Bearer $RELAY_SECRET`.

Request (JSON, max. **5 MB** dekodiert):

```json
{
  "contentType": "image/png",
  "dataBase64": "iVBORw0KGgo…"
}
```

Antwort:

```json
{ "ok": true, "url": "/media/uploads/550e8400-e29b-41d4-a716-446655440000.png", "filename": "…" }
```

Die `url` ist relativ zur Command-Center-Origin und erfordert eine **eingeloggte** Browser-Session (`GET /media/uploads/…`). In Push-Views kannst du sie im `image`-Block als `url` verwenden.

```bash
curl -sS -X POST "$COMMAND_CENTER_URL/upload" \
  -H "Authorization: Bearer $RELAY_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"contentType":"image/png","dataBase64":"…"}'
```

Erlaubte Typen: `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`. Dateien liegen unter `DATA_DIR/uploads/` (Docker-Volume `./data`).

## Cloud-Agent-Artefakte (Dashboard)

Im Reiter **Agents** listet das Dashboard Bilder und Dateien aus dem Cursor-Artefakt-Store (`GET /v1/agents/{id}/artifacts`). Downloads laufen **serverseitig** über `GET /api/agents/{id}/artifact?path=artifacts/…` (API-Key bleibt auf dem Server). Bilder werden als Thumbnails mit Vollbild-Tap angezeigt.

## Relay-Antwort

Erfolg: `200` mit `{ "ok": true, "seq": 42 }`. Der Relay hängt `_seq` und `_receivedAt` an die gespeicherte Nachricht; Clients erhalten dieselbe Form über WebSocket. `image`-Blöcke mit `dataUrl` werden vor dem Speichern in persistente URLs umgewandelt.
