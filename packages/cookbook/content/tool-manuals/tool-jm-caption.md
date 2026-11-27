---
id: tool-jm-caption
title: "JM Caption — Live-Untertitel (NDI) einrichten"
category: Tool-Manuals
difficulty: mittel
setupTimeMin: 20
teamSize: "1"
tags: [caption, untertitel, ndi, whisper, barrierefreiheit, bitv, companion, manual]
relatedTools: [jm-caption, jm-switcher, jm-studio-control]
prerequisites:
  - Windows mit installierter NDI-Runtime
  - JM Caption installiert (über den Launcher)
  - Audioeingang (Mikrofon oder Saal-/Stream-Mix)
  - Whisper-Modell (Basismodell mitgeliefert, größere nachladbar)
equipmentOwner: jm
crewRoles:
  - Media Operator (Untertitel)
lastReviewed: 2026-06-25
owner: tech@jakobsmedien.com
summary: "Live-Untertitel offline via whisper.cpp als transparente NDI-Quelle — für Politik-Streams, Pressekonferenzen und Barrierefreiheit (BITV), fernsteuerbar per Companion über Port 8732."
---

## Zutaten

### Voraussetzungen
- Windows + NDI-Runtime
- JM Caption (über den Launcher)
- Audioeingang (Mikrofon oder besser ein sauberer Mix)
- Whisper-Modell (Basis mitgeliefert, größere für mehr Genauigkeit nachladbar)

### Netzwerk & Steuerung
- Port 8732 (TCP-Zeilenprotokoll): Steuerport für Bitfocus Companion. mDNS-Name jm-caption-ctl (TXT ctl=1, Auto-Discovery).
- Fern-Befehle: CAPTION transcribe on|off|toggle | CAPTION hold on|off|toggle | CAPTION ndi on|off|toggle | CAPTION clear | STATE?.
- Status-Push: STATE running, hold, ndi, connections, lines.
- Ausgabe ist eine eigene, transparente NDI-Quelle — im LAN per mDNS sichtbar, wird im Mischer (TriCaster/vMix/OBS) als Quelle eingebunden.

## Schritt-für-Schritt

### Einrichtung
- Audioquelle im Panel ⚙ › Audiogerät wählen (sauberer Pult-Mix bevorzugt gegenüber Raummikrofon; die Statusleiste zeigt sie unter „Mikrofon“)
- Sprache und Whisper-Modell im Panel ⚙ › Erkennung setzen (größer = genauer, aber mehr CPU-Last)
- Stil und Position der Untertitel im Panel ⚙ › Darstellung anpassen (Schrift, Zeilen, Band). „Schrift“ (16 bis 160) und „Max. Äußerung (s)“ im Panel ⚙ › Erkennung (2 bis 15) gelten erst nach Enter oder beim Verlassen des Feldes; ein leeres Feld oder eine Zahl außerhalb der Grenzen wird nicht übernommen, unter dem Feld steht der Grund (etwa „Bitte eine Zahl eingeben.“ oder „Mindestens 16.“)
- NDI-Ausgabe mit der Haupttaste „NDI starten“ einschalten und in TriCaster / vMix / OBS als Quelle einbinden (den Namen im Netz zeigt das Panel ⚙ › NDI-Ausgabe unter „Im Netz:“)
- Optional: Companion auf Port 8732 verbinden (Transkription an/aus, Hold, NDI, Clear; Statusleiste „Fernsteuerung“, Panel ⚙ › Fernsteuerung)

### Während
- Transkription starten (lokal mit der Haupttaste „Start“ oder CAPTION transcribe on). Scheitert das Mikrofon beim Start, endet die Transkription gleich wieder: Die Haupttaste steht auf „Start“, Companion sieht running=0, und unter den Haupttasten steht „Mikrofon: …“ mit dem Grund (etwa „Gerät nicht gefunden“), bis wieder gestartet wird; Caption startet nicht von selbst neu
- Bei Fehlern mit der Haupttaste „Hold“ bzw. CAPTION hold on einfrieren, die jüngste Zeile per Doppelklick im Verlauf korrigieren (Enter oder ein Klick daneben übernimmt, Escape bricht ab und lässt den alten Text; kommen beim Tippen neue Zeilen dazu, trifft die Korrektur trotzdem die angeklickte Zeile), dann Hold wieder lösen („Hold ✓“ bzw. hold off)
- Die Haupttaste „Leeren“ bzw. CAPTION clear leert die Anzeige hart (z. B. vor einem neuen Sprecher); bei Hold leert sie auch die NDI-Quelle, Hold bleibt an und hält das leere Bild
- Lesbarkeit und Timing im Blick behalten (Live-Zeile und NDI-Vorschau im Live-Bereich)

### Nachbereitung
- Transkription stoppen (Haupttaste „Stopp“ bzw. CAPTION transcribe off), NDI bei Bedarf abschalten (Haupttaste „NDI an“ oder Schalter „Ausgabe“ im Panel ⚙ › NDI-Ausgabe). Auf dem Mac (nicht gemessen, Caption wird nur für Windows ausgeliefert): Schließt man das Fenster, endet die Transkription und Hold geht aus, auch für Companion; ein Klick aufs Dock öffnet das Fenster wieder, und solange es zu ist, lehnt Caption ein CAPTION transcribe on ab

## Profi-Tipps
- Größeres Modell = bessere Genauigkeit, aber mehr CPU-Last — vorab unter Realbedingungen testen, Aussetzer = Modell kleiner wählen.
- Sauberer Ton (Pult-Mix statt Raummikro) verbessert die Erkennung deutlich.
- Companion-Hold als eigener Taster: in heiklen Momenten (O-Ton, Versprecher) einfrieren statt löschen.
- NDI separat halten: Transkription kann laufen, während die NDI-Ausgabe per CAPTION ndi off kurz aus dem Programm genommen wird.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| NDI-Quelle erscheint nicht im Mixer | Statusleiste „NDI“ ansehen (nur „sendet“ heißt, dass Bilder rausgehen) und den Namen unter „Im Netz:“ im Panel ⚙ › NDI-Ausgabe prüfen. NDI-Runtime installiert? Gleiches Subnetz, mDNS/Firewall frei |
| Companion steuert nicht | Statusleiste „Fernsteuerung“ ansehen; Port 8732 (jm-caption-ctl) erreichbar? Gemeinsames LAN? |
| Untertitel zu spät oder falsch | Modell/Sprache im Panel ⚙ › Erkennung prüfen, Audioqualität (Pult-Mix) verbessern |
| Aussetzer / Ruckeln | CPU-Last beobachten, kleineres Whisper-Modell im Panel ⚙ › Erkennung wählen |
| Transkription geht nach „Start“ gleich wieder aus, unter den Haupttasten steht „Mikrofon: …“ | Der Grund steht hinter „Mikrofon:“ (etwa „Gerät nicht gefunden“: das gewählte Gerät ist abgezogen oder heißt anders). Gerät im Panel ⚙ › Audiogerät prüfen oder neu wählen, dann „Start“; Caption versucht es nicht von selbst neu, Companion sieht so lange running=0. Fällt ein Mikrofon erst mitten im Lauf aus, meldet Caption das noch nicht: Pegel im Live-Bereich im Blick behalten |
| „Schrift“ oder „Max. Äußerung (s)“ wirkt nicht, unter dem Feld steht ein Grund | Der Wert ist leer, keine (ganze) Zahl oder außerhalb der Grenzen (Schrift 16 bis 160, Max. Äußerung 2 bis 15): korrigieren und mit Enter übernehmen; bis dahin gilt der alte Wert |

## Checklisten

### Einrichtung
- [ ] Audioquelle gewählt (Mix bevorzugt)
- [ ] Modell und Sprache gesetzt
- [ ] NDI-Quelle im Mixer sichtbar
- [ ] Companion an Port 8732 verbunden (optional)

### Vor Live
- [ ] Probesatz korrekt erkannt
- [ ] Hold getestet (CAPTION hold on/off)
- [ ] Lesbarkeit und Position ok
