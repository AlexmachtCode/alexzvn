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
- Port **7781** (HTTP): Handy-Fernbedienung (`@jm/remote`) — QR-Code + URL im Panel ⚙ › Handy-Fernbedienung (die Statusleiste zeigt den Eintrag „Handy-Fernbedienung“). Optional per Suite-Token abgesichert.

### Fernsteuer-Befehle (TCP 8727)
- `PROMPTER SCROLL ON` / `OFF` / `TOGGLE` — Scrollen starten/stoppen/umschalten
- `PROMPTER SPEED <n>` — Tempo setzen (0,2–6 Zeilen/s)
- `PROMPTER FASTER` / `PROMPTER SLOWER` — Tempo schrittweise ändern
- `PROMPTER TOP` — an den Skriptanfang springen
- `STATE?` — Zustand abfragen. Gepushte STATE-Werte: `scrolling` (0/1), `speed`

## Schritt-für-Schritt

### Einrichtung
- Skript eintippen oder eine .docx/.txt/.md laden. Mit `#`/`##` Abschnitte markieren, um live vor-/zurückspringen zu können.
- Lesbarkeit im Panel ⚙ einstellen: Schriftgröße, Zeilenhöhe und Seitenrand unter Schrift, Lesezeile (Position) unter Lese-Linie, Fett unter Darstellung — auf Abstand und Talent abstimmen.
- Bei Beamsplitter-Prompter den **Spiegelmodus** im Panel ⚙ › Darstellung aktivieren („Spiegeln ⇄“ horizontal für Glas vor der Kamera, „Spiegeln ⇅“ vertikal für Deckenspiegel).
- Vollbild-Ausgabe auf den Talent-Monitor legen: im Panel ⚙ › Ausgabe auf Bildschirm den Bildschirm wählen und den Schalter „Ausgabe“ einschalten; ein offenes Fenster zieht mit „Auf diesen Bildschirm“ um (Statusleiste „Talent-Monitor“).
- Fernbedienung: Handy-Remote im Panel ⚙ › Handy-Fernbedienung einschalten („Fernbedienung aktiv“) und den QR dort scannen (Port 7781), oder Companion/Rundown auf Port 8727 zeigen lassen (Statusleiste „Fernsteuerung“, Panel ⚙ › Fernsteuerung).

### Während
- Tempo mit dem Sprecher einregeln — lieber etwas langsamer als zu schnell. `FASTER`/`SLOWER` (lokal mit dem Tempo-Regler unter der Vorschau oder per Handy/Companion) justieren live.
- `SCROLL TOGGLE` startet/stoppt (lokal die Haupttaste „GO“ bzw. „Pause“ oder die Leertaste); bei Versprechern per Abschnittssprung zurück (Haupttaste „Marke zurück“), `TOP` an den Anfang (Haupttaste „Anfang“ oder Pos1).
- Das Handy in der Hand des Regie-/Prompter-Operators: GO/Pause + Tempo ±, ohne an den Rechner zu müssen.

### Nachbereitung
- Scrollen stoppen (Haupttaste „Pause“), an den Anfang mit der Haupttaste „Anfang“ (`TOP`) für den nächsten Take/Beitrag.

## Profi-Tipps
- Abschnittsmarker (`#`) großzügig setzen — bei Umstellungen im Ablauf springst du sofort zur richtigen Stelle statt zu suchen.
- Tempo lieber knapp unter der Wohlfühlgrenze — ein Sprecher, der auf den Prompter „wartet", wirkt souveräner als einer, der hinterherhetzt.
- Handy-Remote an die Regie geben und `TOGGLE`/Tempo dort bedienen — der Talent sieht nur ruhigen Text, keine Hektik.
- Lesezeile als festen Ankerpunkt einblenden (Panel ⚙ › Lese-Linie) — die Augen des Sprechers bleiben auf einer Höhe, das reduziert das „Prompter-Glasauge".
- Über eine **`.jmshow`** wird das Skript automatisch geladen — eine Show öffnen, Text steht.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| Handy-Remote „Keine LAN-Adresse gefunden“ (Statusleiste „Handy-Fernbedienung“, Panel ⚙ › Handy-Fernbedienung) | Rechner im WLAN? Bei getrennten Netzen Adresse manuell/über den Launcher prüfen |
| Handy zeigt „getrennt – verbinde…" | Suite läuft sicher → Token fehlt in der URL; QR neu scannen (Token steckt in `?t=`) |
| Companion steuert nicht | Statusleiste „Fernsteuerung“ ansehen; Port 8727 offen? `jm-prompter-ctl` (ctl=1) im mDNS sichtbar? |
| Skript lädt nicht | Format .docx/.txt/.md? Datei lesbar? Fehlermeldung beachten |
| Kein Bild auf dem Talent-Monitor | Statusleiste „Talent-Monitor“ ansehen (zu, Bildschirm fehlt, abgestürzt); Schalter „Ausgabe“ im Panel ⚙ › Ausgabe auf Bildschirm an + richtiger Monitor gewählt? |
| Text spiegelverkehrt/falsch herum | Spiegelmodus im Panel ⚙ › Darstellung passend zur Optik (H für Glas, V für Deckenspiegel) |

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
