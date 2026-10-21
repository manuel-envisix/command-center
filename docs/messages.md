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

## Beispiel: komplette View pushen

```bash
export COMMAND_CENTER_URL='https://agent-factory.envisix.at'
export RELAY_SECRET='…'
node push/bin/push.mjs --file push/examples/view-status.json
```

Oder `curl -X POST https://agent-factory.envisix.at/push` mit Header `Authorization: Bearer $RELAY_SECRET`.

## Relay-Antwort

Erfolg: `200` mit `{ "ok": true, "seq": 42 }`. Der Relay hängt `_seq` und `_receivedAt` an die gespeicherte Nachricht; Clients erhalten dieselbe Form über WebSocket.
