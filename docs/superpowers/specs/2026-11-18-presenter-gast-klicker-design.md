# Gast-Klicker übers Internet (JM Presenter, #317) — Entwurf

Stand 18.11.2026. Issue #317. Weg A vom Owner gewählt (18.11. 17:48 „a, passt“); Presentation im JM Presenter
(Owner 17:45 „317 im presenter, ja bitte noch für cop planen“).

## 1. Absicht und Warum

Am COP-Stand hat Niki viele Präsentationen von Remote-Gästen, die per Zoom zugeschaltet sind. Die Folien laufen
bewusst lokal im JM Presenter, weil die Bildschirmfreigabe der Gäste bei schlechtem Internet nicht sendefähig wäre.
Heute klickt Niki für jeden Gast weiter; die Gäste müssen ständig „Next slide“ sagen.

Ziel: Die Präsentation bleibt lokal, aber der Gast schaltet seine Folien selbst weiter — über einen Link im Browser,
ohne Installation, mit kaum Erklärung. Ein Klick ist ein winziges Signal und kommt auch über wackliges Internet an.

Niki arbeitet allein (ein Rechner Präsentation, ein Rechner Zoom). Das Werkzeug darf ihm keinen Mehraufwand machen
und muss nebenbei mitlaufen. Fällt es aus, klickt Niki wie bisher weiter.

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
- Gast öffnet einen Link und schaltet mit zwei großen Knöpfen oder Pfeiltasten vor und zurück.
- Gast sieht ein kleines Vorschaubild der aktuellen Folie und „Folie n / m“ — so merkt er, dass sein Klick
  angekommen ist, auch wenn sein Zoom-Bild hinterherhängt.
- Ein Link pro Event (bleibt über Neustarts des Presenters gleich), den Niki einmal in den Zoom-Chat stellt.
- Niki kann Gast-Klicks mit einem Griff pausieren; sein eigener Clicker/Tastatur wirkt immer.
- Nutzbar noch während der COP: Release im Fenster 18–06 heute Nacht, spätestens 19.11. abends.

**Nicht-Ziele (diese Stufe)**
- Automatische Freigabe nur für den in Zoom gespotlighteten Gast und automatisches Posten des Links durch Connect
  (Stufe B, nach der COP, setzt auf diesem Entwurf auf).
- PowerPoint/Keynote — nur JM Presenter.
- Weitere Steuerung über das Internet (Sprung zu Folie, Schwarzbild, Beenden) — nur vor/zurück.
- Ein Knopf direkt in Zoom (bräuchte eine Zoom-App beim Gast).

**Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch läuft)**
- Niki muss pro Gast etwas einrichten oder erklären.
- Ein Ausfall des Dienstes stört den lokalen Betrieb (Präsentation, NDI, lokaler Clicker, Handy-Fernbedienung).
- Fremde können über den Dienst mehr als vor/zurück auslösen, oder ein Rechner am Stand öffnet einen
  eingehenden Port.
- Ein Deploy gefährdet den laufenden Suite-Proxy (Launcher-Katalog, Anmeldung, Q&A, Connect).

## 3. Rahmen

- **Suite-Proxy ist tabu:** `services/release-proxy` (Worker `jm-suite-proxy`) läuft live mit dem Stand der
  Launcher-Anmeldung Teil 1 aus dem Branch `docs/launcher-anmeldung`; ein Deploy von main würde das zurückdrehen.
  Der Gast-Klicker bekommt deshalb einen **eigenen Worker** im selben Cloudflare-Konto
  (`*.jm-production-suite.workers.dev`, Workers Paid).
- **Release-Fenster COP31:** für Nutzer sichtbare Schritte nur 18:00–06:00 Berlin; jeder Release-Schritt mit
  Owner-OK. Der Worker-Deploy ist nach außen gerichtet → Owner-OK vor dem Deploy.
- **Presenter-Release-Weg** wie 0.13.x: Windows lokal gebaut, Mac per CI, `freigabe.ps1` als Windows-Aufgabe.
  Basis ist Presenter 0.13.2 (Tag `presenter-v0.13.2`, 6c3f901326; Release 18.11. 18:30).
- Presenter läuft auf Electron 33 (Node 20): im Main-Prozess gibt es kein globales `WebSocket`.
- Gäste sind international (COP): Gast-Seite auf Englisch, auf Deutsch bei deutschem Browser.

## 4. Ansätze

| | Weg | Abwägung |
|---|---|---|
| **A (gewählt)** | Presenter verbindet sich ausgehend mit einem neuen kleinen Cloudflare-Dienst; ein Link pro Event; wer den Link hat, darf klicken; Niki kann pausieren. | Schnell machbar, keine Änderung an Connect/Zoom-Anbindung. Haken: Wer den Link hat, kann klicken — ist Publikum im Chat, schickt Niki den Link privat an den Gast. |
| B (später) | Wie A, dazu erkennt Connect den gespotlighteten Zoom-Teilnehmer und schickt ihm automatisch einen persönlichen Link per Privat-Chat; nur dieser Link wirkt. | Null Aufwand für Niki, aber Umbau der nativen Zoom-Brücke (Spotlight-Ereignis ist dort heute leer, Chat-Senden fehlt), Test im echten Meeting, abhängig von Chat-Einstellungen des Hosts → nicht in zwei COP-Tagen. Pinnen ist für die Bridge unsichtbar (nur lokal in Nikis Zoom). |
| C (verworfen) | Zoom-Chat als Fernbedienung („weiter“ tippen). | Gleicher Brücken-Umbau wie B, kein Vorschaubild, umständlich. |
| verworfen | Handy-Fernbedienung des Presenters (`remote.ts`) per Tunnel ins Internet öffnen. | Kann viel mehr als vor/zurück (Beenden, Schwarzbild, Sprung), nur 4-stellige PIN, eingehender Weg. |
| verworfen | Folien-Fernbedienung der Connect-Green-Room-Seite (Welle 6.3c) nutzen. | Läuft über den gesperrten Suite-Proxy, braucht Connect-Bedienung je Gast und Kamera-/WebRTC-Seite. Bauweise (Raum-DO, Drossel 150 ms, Knopf-Seite) wird übernommen, nicht der Dienst. |

## 5. Entwurf

### 5.1 Überblick

```
Gast-Browser ──wss──▶ Worker jm-gast-klicker ──▶ Durable Object „KlickRaum“ (eine Instanz je Raum, EU)
                                                     ▲
JM Presenter (Main-Prozess) ──wss, ausgehend──────────┘
   ├─ empfängt  {cmd next|prev}  → present.next()/prev()   (außer pausiert / keine Präsentation)
   └─ sendet    Stand (aktiv, n, m, pausiert) + JPEG-Vorschau bei jedem Folienwechsel
```

Kein Rechner am Stand öffnet einen Port. Der Dienst speichert keine Folien dauerhaft.

### 5.2 Cloud-Dienst `services/gast-klicker` (neuer Worker `jm-gast-klicker`)

- Eigenes Verzeichnis mit `wrangler.toml`, eigener Durable-Object-Klasse `KlickRaum` (SQLite-DO,
  `jurisdiction('eu')` wie `connect-relay.js`), WebSocket-Hibernation-API.
- **Routen**
  - `GET /k/<raum>` → Gast-Seite (eine HTML-Datei, alles inline, strenge CSP, `no-store`).
  - `GET /k/<raum>/ws` → WebSocket Gast.
  - `GET /h/<raum>/ws` → WebSocket Presenter. Das Host-Geheimnis kommt in der **ersten Nachricht**, nicht in
    der URL (taucht so in keinem Log auf).
  - Alles andere → 404.
- **Raum und Geheimnis:** Der Presenter erzeugt die Raum-Kennung (12 Zeichen aus `[a-z0-9]`, Zufall aus
  `crypto`) und ein Host-Geheimnis (32 Byte hex). Der DO merkt sich beim ersten Presenter-Kontakt den SHA-256 des
  Geheimnisses (Vertrauen beim ersten Mal); danach wird jeder Presenter mit anderem Geheimnis abgewiesen. Ein
  neuer Presenter mit richtigem Geheimnis ersetzt eine alte Presenter-Verbindung (Neustart, Netzwechsel).
- **Verfall:** DO-Alarm löscht den Raum 7 Tage nach der letzten Presenter-Verbindung (ein Link hält eine
  Event-Woche).
- **Nachrichten** (JSON mit Feld `t`; Bilder als Binärnachricht):
  - Presenter → DO: `{t:'hallo', geheimnis}` (erste Nachricht), `{t:'stand', aktiv, index, total, pausiert}`,
    Binär = JPEG der aktuellen Folie.
  - DO → Presenter: `{t:'ok'}` / `{t:'abgelehnt'}`, `{t:'cmd', dir:'next'|'prev'}`, `{t:'gaeste', n}`,
    `{t:'bildBitte'}`.
  - Gast → DO: `{t:'cmd', dir:'next'|'prev'}`.
  - DO → Gast: `{t:'stand', aktiv, index, total, pausiert, presenter: true|false}`, Binär = JPEG.
- **Regeln im DO**
  - Gast-Kommandos gehen nur weiter, wenn ein Presenter verbunden ist und `pausiert` nicht gesetzt ist; der
    Presenter prüft trotzdem selbst noch einmal (er ist maßgeblich).
  - Drossel: höchstens ein Kommando je Gast-Verbindung alle 150 ms (wie `SLIDE_MIN_GAP_MS` in `connect-relay.js`).
  - Höchstens 30 gleichzeitige Gäste je Raum; Gast-Nachrichten höchstens 256 Byte; Bilder nur vom Presenter,
    höchstens 256 KB; alles andere wird verworfen.
  - Letzter Stand und letztes Bild liegen nur im Speicher des DO. Kommt ein Gast dazu und der DO hat kein Bild
    (z. B. nach dem Aufwachen aus der Hibernation), schickt er dem Presenter `bildBitte`.
  - Ändert sich die Gastzahl, bekommt der Presenter `{t:'gaeste', n}`.
- Die Raumlogik (Annahme/Ablehnung, Drossel, Weiterleitung) liegt als **reine Funktionen** in einem eigenen
  Modul, damit sie ohne Cloudflare unter Node testbar ist; der DO ist nur die Hülle.

### 5.3 Gast-Seite

```
┌──────────────────────────────────────┐
│  [ Vorschaubild der aktuellen Folie ] │   16:9, füllt die Breite
│                                       │
│            Slide 4 / 12               │
│  ┌───────────────┐ ┌───────────────┐  │
│  │   ◀  Back     │ │   Next  ▶     │  │   große Knöpfe, Daumen-tauglich
│  └───────────────┘ └───────────────┘  │
│  ● Connected · use ← → keys           │   Statuszeile
└──────────────────────────────────────┘
```

- Pfeiltasten, Bild↑/Bild↓, Leertaste (= weiter) — auch für Presenter-Clicker, die der Gast evtl. am eigenen
  Rechner hat.
- Nach einem Klick leuchtet der Knopf, bis ein neuer Stand kommt; kommt nach 3 s keiner, Hinweis
  „Klick nicht bestätigt – Verbindung prüfen“.
- Zustände: verbunden · Presenter offline („Niki schaltet gerade weiter“ / sinngemäß englisch) · pausiert
  („Die Regie schaltet gerade“) · keine Präsentation aktiv · Verbindung weg (automatisch neu verbinden).
- Sprache: Deutsch bei `navigator.language` de*, sonst Englisch.
- Kein externes Laden (Schriften, Skripte); funktioniert auf Handy und Laptop.

### 5.4 Presenter

- **Neues Modul `src/main/gast-klicker.ts`** im Main-Prozess:
  - WebSocket-Client über das Paket `ws` (als eigene Abhängigkeit eintragen; liegt über `socket.io-client`
    bereits im Lockfile).
  - Verbinden, `hallo` mit Geheimnis senden, bei Trennung neu verbinden (1 s, verdoppelnd bis 30 s, zufällig
    gestreut); Statusänderungen an die Fenster melden.
  - `subscribe()` aus `present.ts`: bei jeder Änderung Stand senden; ~300 ms nach einem Folienwechsel Vorschau
    erfassen und senden (gleiche Folie nicht doppelt). Quelle: Publikumsfenster (`captureAudience`), sonst
    NDI-Fenster (Präsentation nur über NDI), sonst kein Bild (Gast sieht dann nur „Slide n / m“). Breite 640 px,
    JPEG.
  - Eingehendes `cmd`: nur ausführen, wenn eine Präsentation aktiv und nicht pausiert ist → `next()` / `prev()`.
    Eine Log-Zeile je Gast-Klick (`[gast-klicker] next`), keine Namen/IPs.
  - Basis-URL fest `https://jm-gast-klicker.jm-production-suite.workers.dev`, für Tests per Umgebungsvariable
    `JMPR_GAST_KLICKER_URL` überschreibbar.
- **Einstellungen** (persistiert wie `remote-config`): `an`, `raum`, `geheimnis`. `pausiert` wird nicht
  gespeichert (Start immer „nicht pausiert“). Erster Einschalt erzeugt Raum + Geheimnis; „Neuer Link“ erzeugt
  beide neu (alter Link wirkt nicht mehr).
- **Bedienung** im Fenster „Fernsteuerung“ (`RemotePanel.tsx`), neuer Abschnitt
  „🌐 Gast-Klicker übers Internet (Zoom-Gäste)“:
  - Schalter an/aus.
  - Link mit Knopf „Für den Zoom-Chat kopieren“ → kopiert z. B.
    `Advance your slides yourself / Folien selbst weiterschalten: <link>`.
  - Status: verbunden / getrennt / abgelehnt, „n Gäste verbunden“.
  - Knopf „Gast-Klick pausieren“ / „fortsetzen“.
  - „Neuer Link“ (mit Rückfrage).
  - Kurzer Hinweis: „Wer den Link hat, kann vor/zurück klicken. Ist Publikum im Chat, den Link privat an den Gast
    schicken.“
- **Referentenansicht:** kleine Anzeige „Gast-Klick an / pausiert“, per Klick umschaltbar, nur wenn der
  Gast-Klicker eingeschaltet ist — damit Niki während der Präsentation nicht ins Fernsteuerungs-Fenster muss.
- Ausfall des Dienstes: Statuszeile „getrennt“, sonst keine Wirkung; lokale Steuerung unverändert.

### 5.5 Sicherheit und Datenschutz

- Über das Internet wirkt nur vor/zurück; der Presenter führt nichts anderes aus.
- Der Link ist die Berechtigung (Weg A). Raum-Kennung mit ~62 bit Zufall ist nicht erratbar; „Neuer Link“ sperrt
  einen weitergegebenen Link.
- Folienbilder laufen durch Cloudflare (DO in der EU), werden nur an verbundene Gäste dieses Raums geschickt und
  nicht gespeichert.
- Räume anlegen kann jeder, der die Worker-URL kennt (kein Schlüssel im Presenter, der ohnehin auslesbar wäre);
  begrenzt durch Kappungen je Raum und den Verfall. Akzeptiertes Restrisiko für diese Stufe.

### 5.6 Prüfung

- Unit-Tests der Raumlogik (Node, ohne Cloudflare): Geheimnis ersetzen/abweisen, Drossel, Pause, ohne Presenter,
  Kappungen, `bildBitte`.
- Unit-Tests im Presenter für Nachrichten-Behandlung (pausiert/inaktiv → kein Weiterschalten).
- Prüfstand der gepackten App gegen einen lokalen Stand-in-Dienst (kleiner Node-WebSocket-Server, der das
  Protokoll spricht): Gast-`next` → Folie wechselt; Pause → kein Wechsel; Bild kommt an (Publikumsfenster und
  NDI-only); Dienst weg → Presenter läuft weiter, verbindet neu.
- Nach dem Worker-Deploy ein Rauchtest gegen den echten Dienst (Skript als Presenter + Gast).
- Selbsttests Node 24 und Node 22 grün, Typprüfung grün; bestehende Prüfstand-Gruppen unverändert.

### 5.7 Auslieferung

1. Worker-Deploy `jm-gast-klicker` (Owner-OK).
2. Presenter **0.14.0** (neue Funktion): Changelog zur Owner-Freigabe, Handbuch-Abschnitt im Kochbuch
   (`tool-jm-presenter.md`, Cookbook-CRLF-Falle beachten), Release per `freigabe.ps1` im Fenster.
3. Merge erst nach dem Release.

## 6. Dem Builder überlassen

Dateiaufteilung im Worker, genaue Texte der Gast-Seite (im Sinn von 5.3), Platzierung der Anzeige in der
Referentenansicht, Backoff-Details, Form des Stand-in-Dienstes im Prüfstand.

## 7. Danach (Stufe B, nach der COP)

Connect erkennt den gespotlighteten Zoom-Gast (`onSpotlightedUserListChangeNotification` in der Brücke), schickt
ihm per Privat-Chat einen persönlichen Link, nur dieser wirkt; Wechsel des Spotlights entzieht die Berechtigung.
Baut auf Raum/Protokoll aus Stufe A auf.
