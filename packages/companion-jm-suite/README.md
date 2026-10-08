# JM Suite — Bitfocus Companion Module

> **Ein Modul für die ganze Suite.** Statt pro Tool ein eigenes Companion-Modul
> gibt es **eine** Verbindung je Tool: Rolle wählen (Switcher, Timer, Player,
> Titler, Presenter, Prompter, Recorder, DAW, Connect …) — Actions, Feedbacks (Button-
> Farben/Tally) und Variablen werden **automatisch** aus der geteilten
> Capabilities-Tabelle der Suite generiert.

Gesprochen wird das suite-weite TCP-Zeilenprotokoll
([`@jm/suite-control-protocol`](../suite-control-protocol/README.md)).

## Verwendung in Companion

1. Verbindung „JM Suite" hinzufügen.
2. **Tool (Rolle)** wählen und die **Verbindung** festlegen:
   - **Automatisch (mDNS):** das Modul findet den Steuer-Endpunkt des Tools im
     LAN selbst und verbindet sich — Tool starten genügt (UDP 5353 offen).
   - **Manuell (IP/Port):** **IP-Adresse** des Tool-Rechners und **Port** setzen.
     Standard-Ports: Switcher 8723, Timer 8724, Player 8725, Titler 8726,
     Prompter 8727, Presenter 8728, Recorder 8729, DAW 8730, Connect 8737.
3. Für mehrere Tools einfach mehrere „JM Suite"-Verbindungen anlegen (eine je
   Tool). Das Feld **Gefunden im LAN** zeigt die aktuell per mDNS entdeckten
   Steuer-Endpunkte als Hilfe.

Die Actions/Feedbacks/Variablen erscheinen passend zur gewählten Rolle. Presets
liefern fertige Buttons je Tool.

> **mDNS-Marker:** Steuer-Endpunkte annoncieren sich mit TXT `ctl=1` (Tools, die
> daneben einen eigenen Socket.IO-/SSE-Dienst betreiben — Timer, Presenter,
> Prompter — werden so eindeutig vom anderen Endpunkt unterschieden). Der
> Switcher ist der Sonderfall ohne Marker; das Modul erkennt ihn an `role=switcher`.

**Feedbacks „an/aus“** leuchten bei `1`, `an`, `true` **und bei jeder positiven
ganzen Zahl** (ab Modul 0.2.0). So leuchtet „Connect: es ist ein Gast auf
Sendung“ auch bei 2 oder 5 Gästen; bei `0` ist die Taste aus.

**Namen mit Leerzeichen** kommen ab Modul 0.2.0 ganz in der Variable an: Das Tool
schreibt Leerraum und `%` im STATE als `%XX` (z. B. `Anna%20Maria`), das Modul
liest es zurück. Ein Tool, das noch ohne diese Kodierung sendet, wird unverändert
gelesen.

## Rolle „JM Connect“ (ab Modul 0.2.0)

Bis Modul 0.1.0 fehlte die Rolle ganz; mit 0.2.0 ist Connect erstmals steuerbar
(Port 8737, mDNS `jm-connect-ctl`).

- **Raum:** GO, NEXT, Standby, Auf Sendung, Aus Sendung, Freigeben, Talkback,
  Folien-Steuerung, Entfernen (Gast-ID); Variablen `room`, `guests`, `lobby`,
  `onair`, `active_label`, `standby`, `standby_label`, `talkback`, `connected`.
- **Zoom (nur Connect unter Windows):**
  - Aktionen „Zoom: Person als Quelle laden“ (`CONNECT ZOOM_LOAD <Anzeigename>`),
    „Zoom: Quelle entladen“ (`CONNECT ZOOM_UNLOAD <Anzeigename>`) und
    „Zoom: Bild-Versatz setzen“ (`CONNECT ZOOM_DELAY <ms>`, 0–1000). Der
    Anzeigename ist der Name in Zoom; Leerzeichen sind erlaubt
    („Anna Maria“). Beitreten oder Verlassen geht nicht per Companion.
  - Variablen `zoom_status`, `zoom_sources`, `zoom_live`, `zoom_privilege`,
    `zoom_alarm`, `zoom_cmd` (Ergebnis des letzten Zoom-Befehls: `ok` oder
    `f1` … `f8`, vor dem ersten Befehl leer) und `zoom_cmd_rejected` (1/0).
  - Feedbacks „Zoom-Quellen geladen“ (grün), „Zoom braucht einen Eingriff“
    (rot) und „letzter Zoom-Befehl abgelehnt“ (gelb). Den Grund einer Ablehnung
    zeigt JM Connect im Fenster unter „Hinweise“.
- Unter macOS sendet Connect keine `zoom_*`-Werte (die Variablen bleiben leer);
  Zoom-Befehle schreibt Connect dort nur ins Log.
- JM Rundown bietet die Zoom-Aktionen erst mit seinem nächsten Release an.

## Aufbau

| Datei | Inhalt |
|---|---|
| `main.js` | Companion-Modul (InstanceBase). Generiert Definitionen aus `CAPABILITIES`, verbindet per TCP (manuell oder mDNS-Auto), liest STATE → Variablen/Feedbacks. |
| `lib.mjs` | Pure Hilfsfunktionen (Zeilenbau, Optionsfelder, Toggle-Auflösung, Endpunkt-Auswahl) — ohne Companion-Runtime testbar. |
| `discovery.mjs` | mDNS-Browse (`bonjour-service`) der Suite-Steuer-Endpunkte (`_jmps._tcp`, TXT `ctl=1`). Spiegelt `@jm/discovery`, da das Modul standalone ist. |
| `generated/protocol.mjs` | **Generiert** aus `packages/suite-control-protocol/src/{index,capabilities}.ts` — Parser + Capabilities. NICHT von Hand bearbeiten. |
| `companion/manifest.json` | Companion-Modul-Manifest (node22, nodejs-ipc). |

## Protokoll synchron halten

Das Modul liegt **außerhalb** der npm-workspaces (standalone baubar). Ändert sich
das Protokoll oder die Capabilities-Tabelle in `packages/suite-control-protocol`,
neu generieren:

```
npm run sync      # → generated/protocol.mjs neu bauen (esbuild)
```

Die generierte Datei ist eingecheckt, damit das Modul ohne Monorepo-Quelle
baubar/verteilbar bleibt. `npm run sync` hier und `node scripts/sync-companion-protocol.mjs`
in der Repo-Wurzel erzeugen dieselbe Datei, Byte für Byte. Der CI-Schritt
„Companion-Protokoll aktuell“ erzeugt sie neu und wird rot, sobald die eingecheckte
Datei von den Capabilities abweicht.

## Bauen / Testen

```
npm install       # einmalig: @companion-module/base + tools + bonjour-service
npm run selftest  # Zeilenbau + Round-Trip + Discovery-Auswahl + Feedbacks/Rolle Connect/STATE (ohne Companion-Runtime)
npm run build     # companion-module-build → Verteilpaket (pkg/)
```

**In Companion testen (Developer-Mode):** In Companion unter *Settings →
Developer modules path* auf diesen Ordner zeigen — das Modul „JM Suite"
erscheint, ohne ein Paket zu bauen. Schnellster Weg, um Actions/Feedbacks/
mDNS-Auto-Discovery live zu prüfen.

> **Packaging-Hinweis:** `npm run build` (`companion-module-build`) ruft intern
> `yarn`/`webpack` auf und erwartet das Modul **standalone** (außerhalb eines
> npm-/yarn-Workspaces). Im Monorepo-Checkout wählt yarn classic sonst die
> Repo-Wurzel und bricht mit „Command webpack not found" ab. Fürs Verteilpaket
> das Modulverzeichnis isoliert auschecken/kopieren und dort bauen (so läuft es
> auch in der Companion-CI). Für Funktionstests genügt der Developer-Mode oben.

> Das ältere `jm-switcher`-Modul bleibt vorerst als Bestandsschutz; `jm-suite`
> deckt den Switcher (Rolle „switcher") rückwärtskompatibel mit ab.
