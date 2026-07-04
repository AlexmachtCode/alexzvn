---
id: tool-jm-titler
title: "JM Titler — Live-Bauchbinden & CG als NDI-Quelle"
category: Tool-Manuals
difficulty: mittel
setupTimeMin: 15
teamSize: "1"
tags: [titler, bauchbinde, lowerthird, ndi, datalink, iveo, psd, companion, manual]
relatedTools: [jm-titler, jm-switcher, jm-qa, jm-rundown, jm-grafiktool]
prerequisites:
  - JM Titler installiert (über den Launcher) — nativer Build mit NDI
  - Bildmischer/Playout mit NDI-Eingang (TriCaster, vMix, OBS, JM Switcher)
  - Optional Watchfolder mit CSV/TSV für DataLink-Variablen
  - Optional Bitfocus Companion / JM Rundown / JM Q&A für die Fernsteuerung
equipmentOwner: jm
crewRoles:
  - Grafik / Media Operator
lastReviewed: 2026-07-04
owner: tech@jakobsmedien.com
summary: "Live-Bauchbinden, Banner und Ticker als transparente NDI-Quelle — mit DataLink-Variablen aus Dateien, iveo-Speakerdaten, PSD-/Grafiktool-Import, zweitem Bildschirm und TCP-Fernsteuerung."
---

## Zutaten

### Voraussetzungen
- JM Titler installiert (über den Launcher; nativer Build inkl. NDI-Anbindung)
- Ein Bildmischer/Playout mit NDI-Eingang (TriCaster, vMix, OBS oder JM Switcher)
- Optional: Watchfolder mit CSV/TSV/`key=wert`-Dateien für DataLink-Variablen
- Optional: Bitfocus Companion, JM Rundown oder JM Q&A für die Fernsteuerung

### Netzwerk & Ausgabe
- Ausgabe: transparente **NDI-Quelle** — im Mischer als NDI-Input auswählen. Die Bauchbinde liegt mit Alpha auf, der Hintergrund bleibt frei.
- 2. Bildschirm (Alternative zu NDI): Ausgabe als Chroma-Green-Fenster (`view=output`) auf einen zweiten Monitor/HDMI — für Hardware-Keyer, ohne NDI. Die NDI-Ausgabe bleibt davon unberührt.
- Port **8726** (TCP-Zeilenprotokoll): Steuerport für Companion / Rundown / Q&A. Auto-Discovery über mDNS (`jm-titler-ctl`, TXT `ctl=1`).

### Fernsteuer-Befehle (TCP 8726)
- `TITLER TAKE` / `TITLER CLEAR` / `TITLER TOGGLE` — Bauchbinde on air / ausblenden / umschalten
- `TITLER TEMPLATE <lowerthird|banner|ticker|graphic>` — Vorlagentyp wählen
- `TITLER TEXT <name> <untertitel>` — Text fernsetzen (Leerzeichen als `_`, `-` = leeres Feld). Nutzt z. B. JM Q&A für den aktiven Sprecher.
- `TITLER RECALL <Nr. oder Name>` — DataLink-Eintrag abrufen (füllt die `{{variablen}}`)
- `TITLER NEXT` / `TITLER PREV` — im DataLink-Liste vor/zurück
- `STATE?` — Zustand abfragen. Der Titler pusht laufend STATE (`entry`, `index`, `count`, on-air-Status)

## Schritt-für-Schritt

### Einrichtung
- Vorlage wählen (Bauchbinde/Banner/Ticker/Grafik) und Stil einstellen — der Reiter „Einstellungen" bündelt DataLink, iveo-Status, Ausgabe (NDI/2. Bildschirm)
- NDI im Mischer als Quelle einbinden — oder das Ausgabe-Fenster auf den zweiten Monitor legen (Chroma-Green für Hardware-Keyer)
- DataLink (optional): Watchfolder mit CSV/TSV wählen — jede Zeile wird ein abrufbarer Eintrag, Spalten füllen die `{{name}}`/`{{subtitle}}`/`{{location}}`-Variablen
- Grafik-Vorlage (optional): PSD oder `.jmtitler` importieren — Ebenennamen werden automatisch auf DataLink-Variablen gemappt (Titel/Name → `{{name}}`, Untertitel/Funktion → `{{subtitle}}`, Ort → `{{location}}`)
- iveo (optional): Wird der Titler über eine iveo-gebundene Show gestartet, materialisiert der Launcher die Speaker automatisch in den DataLink (`speakers.tsv`) — kein Token im Titler nötig

### Während
- Bauchbinde füllen: Namensfeld ist immer sichtbar; per DataLink `RECALL`/`NEXT`/`PREV` durch die Liste springen
- `TAKE` blendet on air, `CLEAR` blendet aus — lokal oder per Companion/Rundown/Q&A
- Q&A-Kopplung: der aktive Sprecher setzt automatisch `TITLER TEXT` + `TITLER TAKE`
- Bei iveo-Live-Umschaltung lädt der Titler die Speaker der neuen Side Session non-destruktiv nach (`TITLER RELOAD`)

### Nachbereitung
- Bauchbinde ausblenden (`CLEAR`), NDI-Quelle im Mischer bleibt bestehen
- Importierte Vorlagen/Watchfolder für die nächste Show prüfen/austauschen

## Profi-Tipps
- Companion-Button „Nächster Redner": `TITLER NEXT` gefolgt von `TITLER TAKE` — ein Tastendruck holt den nächsten DataLink-Eintrag und blendet ihn ein.
- Grafik im JM Grafiktool bauen und als `.jmtitler` „an den Titler senden" — Hintergrund + variablen-fähige Text-Slots kommen fertig gemappt an.
- Für Konferenzen mit iveo: Speaker nie von Hand tippen — die Show materialisiert `speakers.tsv`, der Titler ruft sie per `RECALL` ab.
- Zweiter Bildschirm statt NDI, wenn der Mischer nur SDI/HDMI-Keying kann: Chroma-Green-Ausgabe auf den Keyer, NDI bleibt zusätzlich verfügbar.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| NDI-Quelle taucht im Mischer nicht auf | Gleiches Subnetz? NDI-Discovery/Firewall frei? Titler wirklich gestartet? |
| Bauchbinde hat keinen transparenten Hintergrund | NDI führt Alpha — im Mischer als NDI (nicht als Screen-Capture) einbinden; beim 2. Bildschirm den Keyer auf Chroma-Green stellen |
| `{{variablen}}` bleiben leer | DataLink-Watchfolder gewählt? Spalten-/Ebenennamen passen zum Mapping? Per `RECALL <Nr.>` einen Eintrag ziehen |
| Companion/Q&A steuert nicht | Port 8726 offen? `jm-titler-ctl` im mDNS sichtbar? |
| iveo-Speaker fehlen | Show iveo-gebunden gestartet? Der Token liegt im Launcher (single-holder) — der Titler liest nur `speakers.tsv` |

## Checklisten

### Einrichtung
- [ ] Vorlage + Stil gewählt
- [ ] NDI im Mischer eingebunden (oder 2. Bildschirm/Chroma-Green gelegt)
- [ ] DataLink-Watchfolder gesetzt (optional)
- [ ] PSD/`.jmtitler`-Vorlage importiert (optional)
- [ ] Companion/Rundown/Q&A auf Port 8726 verbunden (optional)

### Vor Live
- [ ] Test-`TAKE`/`CLEAR` gelaufen
- [ ] `RECALL`/`NEXT`/`PREV` durch die Liste getestet
- [ ] Q&A-/iveo-Kopplung geprüft (optional)
