---
id: tool-jm-prompter
title: "JM Prompter — Teleprompter mit Handy-Fernbedienung"
category: Tool-Manuals
difficulty: einfach
setupTimeMin: 10
teamSize: "1"
tags: [prompter, teleprompter, skript, scroll, spiegel, handy-remote, companion, manual]
relatedTools: [jm-prompter, jm-timer, jm-rundown]
prerequisites:
  - JM Prompter installiert (über den Launcher)
  - Ein Skript (getippt oder als .docx / .txt / .md)
  - Zweiter Monitor als Talent-/Prompter-Ausgabe
  - Optional Handy im selben WLAN für die Fernbedienung
equipmentOwner: jm
crewRoles:
  - Prompter Operator / Regie
lastReviewed: 2026-07-04
owner: tech@jakobsmedien.com
summary: "Teleprompter mit Skript-Editor und Vollbild-Scroller auf dem Talent-Monitor — Tempo, Schrift, Ränder und Lesezeile einstellbar, Spiegelmodus für Beamsplitter, Fernbedienung per Handy (QR) oder Companion."
---

## Zutaten

### Voraussetzungen
- JM Prompter installiert (über den Launcher)
- Ein Skript: direkt getippt oder aus **.docx / .txt / .md** geladen. Zeilen mit `#` / `##` werden zu Sprungmarken (Abschnitte).
- Zweiter Monitor als Talent-Ausgabe (bei Beamsplitter-Glas: Spiegelmodus)
- Optional: Handy im selben WLAN für die Fernbedienung, oder Bitfocus Companion / JM Rundown

### Netzwerk & Ports
- Port **8727** (TCP-Zeilenprotokoll): Steuerport für Companion / Rundown. Auto-Discovery über mDNS (`jm-prompter-ctl`, TXT `ctl=1`).
- Port **7781** (HTTP): Handy-Fernbedienung (`@jm/remote`) — QR-Code + URL im Operator-Fenster. Optional per Suite-Token abgesichert.

### Fernsteuer-Befehle (TCP 8727)
- `PROMPTER SCROLL ON` / `OFF` / `TOGGLE` — Scrollen starten/stoppen/umschalten
- `PROMPTER SPEED <n>` — Tempo setzen (0,2–6 Zeilen/s)
- `PROMPTER FASTER` / `PROMPTER SLOWER` — Tempo schrittweise ändern
- `PROMPTER TOP` — an den Skriptanfang springen
- `STATE?` — Zustand abfragen. Gepushte STATE-Werte: `scrolling` (0/1), `speed`

## Schritt-für-Schritt

### Einrichtung
- Skript eintippen oder eine .docx/.txt/.md laden. Mit `#`/`##` Abschnitte markieren, um live vor-/zurückspringen zu können.
- Lesbarkeit einstellen: Schriftgröße, Zeilenhöhe, Seitenrand, Lesezeile (Position), Fett — auf Abstand und Talent abstimmen.
- Bei Beamsplitter-Prompter den **Spiegelmodus** aktivieren (horizontal für Glas vor der Kamera, vertikal für Deckenspiegel).
- Vollbild-Ausgabe auf den Talent-Monitor legen (Display wählen).
- Fernbedienung: Handy-Remote einschalten und QR scannen (Port 7781), oder Companion/Rundown auf Port 8727 zeigen lassen.

### Während
- Tempo mit dem Sprecher einregeln — lieber etwas langsamer als zu schnell. `FASTER`/`SLOWER` (lokal oder per Handy/Companion) justieren live.
- `SCROLL TOGGLE` startet/stoppt; bei Versprechern per Abschnittssprung zurück, `TOP` an den Anfang.
- Das Handy in der Hand des Regie-/Prompter-Operators: GO/Pause + Tempo ±, ohne an den Rechner zu müssen.

### Nachbereitung
- Scrollen stoppen, an den Anfang (`TOP`) für den nächsten Take/Beitrag.

## Profi-Tipps
- Abschnittsmarker (`#`) großzügig setzen — bei Umstellungen im Ablauf springst du sofort zur richtigen Stelle statt zu suchen.
- Tempo lieber knapp unter der Wohlfühlgrenze — ein Sprecher, der auf den Prompter „wartet", wirkt souveräner als einer, der hinterherhetzt.
- Handy-Remote an die Regie geben und `TOGGLE`/Tempo dort bedienen — der Talent sieht nur ruhigen Text, keine Hektik.
- Lesezeile als festen Ankerpunkt einblenden — die Augen des Sprechers bleiben auf einer Höhe, das reduziert das „Prompter-Glasauge".
- Über eine **`.jmshow`** wird das Skript automatisch geladen — eine Show öffnen, Text steht.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| Handy-Remote „Keine LAN-Adresse gefunden" | Rechner im WLAN? Bei getrennten Netzen Adresse manuell/über den Launcher prüfen |
| Handy zeigt „getrennt – verbinde…" | Suite läuft sicher → Token fehlt in der URL; QR neu scannen (Token steckt in `?t=`) |
| Companion steuert nicht | Port 8727 offen? `jm-prompter-ctl` (ctl=1) im mDNS sichtbar? |
| Skript lädt nicht | Format .docx/.txt/.md? Datei lesbar? Fehlermeldung beachten |
| Kein Bild auf dem Talent-Monitor | Ausgabe geöffnet + richtiger Monitor gewählt? |
| Text spiegelverkehrt/falsch herum | Spiegelmodus passend zur Optik (H für Glas, V für Deckenspiegel) |

## Checklisten

### Einrichtung
- [ ] Skript geladen/getippt, Abschnitte (`#`) gesetzt
- [ ] Schrift/Zeilenhöhe/Rand/Lesezeile eingestellt
- [ ] Spiegelmodus passend zur Optik
- [ ] Ausgabe auf Talent-Monitor (Vollbild)
- [ ] Fernbedienung verbunden (Handy 7781 / Companion 8727)

### Vor Live
- [ ] Tempo mit dem Sprecher getestet
- [ ] Sprungmarken funktionieren
- [ ] Handy-Remote reagiert (GO/Pause/Tempo)
