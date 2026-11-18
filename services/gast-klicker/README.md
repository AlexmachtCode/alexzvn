# JM Gast-Klicker (Cloudflare-Worker `jm-gast-klicker`)

Remote-Gäste (z. B. per Zoom zugeschaltet) schalten ihre Folien, die lokal im JM Presenter laufen, selbst weiter:
Link im Browser, zwei große Knöpfe oder Pfeiltasten, kleines Vorschaubild der aktuellen Folie. Issue #317,
Entwurf `docs/superpowers/specs/2026-11-18-presenter-gast-klicker-design.md`.

## Aufbau

| Datei | Aufgabe |
|---|---|
| `worker.js` | Routen, Sicherheits-Header, Weitergabe an den Durable Object (EU) |
| `raum.js` | Raumlogik + Durable Object `KlickRaum` (ohne Cloudflare-Importe, unter Node testbar) |
| `gast-seite.js` | Gast-Seite (eine HTML-Datei, alles inline; Englisch, Deutsch bei deutschem Browser) |
| `test/raum.test.mjs`, `test/worker.test.mjs` | Selbsttests ohne Cloudflare (laufen in der CI) |

Routen: `GET /k/<raum>` (Gast-Seite), `GET /k/<raum>/ws` (Gast), `GET /h/<raum>/ws` (Presenter), sonst 404.

- Die Raum-Kennung (12 Zeichen `[a-z0-9]`) ist aus dem Host-Geheimnis des Presenters abgeleitet
  (`raumAusGeheimnis`): nur wer das Geheimnis kennt, kann den Raum hinter einem Link öffnen. Das Geheimnis kommt in
  einem Header beim Verbindungsaufbau (`Authorization: Bearer …`, Worker und DO prüfen es vor dem Annehmen) und in
  der ersten WebSocket-Nachricht, nie in der URL; gespeichert wird nur sein SHA-256.
- Über den Dienst geht nur „vor“/„zurück“; der Presenter prüft Pause und laufende Präsentation selbst.
- Drossel 150 ms je Gast, höchstens 30 Gäste, Gast-Nachrichten ≤ 256 Byte, Bilder nur vom Presenter ≤ 256 KB,
  höchstens 20 unangemeldete Presenter-Verbindungen (älteste fliegt zuerst, 10 s), Verfall 7 Tage nach der letzten Presenter-Verbindung.
- Folienbilder liegen nur im Speicher des Durable Objects, nie dauerhaft.

## Tests

```
node services/gast-klicker/test/raum.test.mjs
node services/gast-klicker/test/worker.test.mjs
```

## Deploy

Nur mit Owner-OK, aus diesem Ordner: `npx wrangler@4 deploy`. Vorher `npx wrangler@4 whoami`.

**Nicht mit dem Suite-Proxy zusammenlegen**, solange dort die Launcher-Anmeldung aus ihrem Branch live läuft:
ein Deploy des Proxys von main würde sie zurückdrehen.
