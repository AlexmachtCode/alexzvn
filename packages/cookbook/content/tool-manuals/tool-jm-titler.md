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
lastReviewed: 2026-10-17
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
- Vorlage wählen (Bauchbinde/Banner/Ticker/Grafik) unter **Vorlage** neben der Vorschau. Alles Einrichtende liegt im Panel **Einstellungen**: ⚙ oben rechts oder ein Klick auf einen Eintrag der Statusleiste (außer Master) öffnet es am passenden Abschnitt — iveo, NDI-Ausgabe (der Schalter „Ausgabe“ startet NDI), Ausgabe auf Bildschirm, Fernsteuerung, DataLink („Ordner wählen …“), Stil (Position, Größe, Farben) und Grafik-Vorlagen (Import)
- NDI im Mischer als Quelle einbinden — oder das Ausgabe-Fenster auf den zweiten Monitor legen (Chroma-Green für Hardware-Keyer)
- DataLink (optional): Watchfolder mit CSV/TSV wählen — jede Zeile wird ein abrufbarer Eintrag, Spalten füllen die `{{name}}`/`{{subtitle}}`/`{{location}}`-Variablen. Gelesen werden UTF-8 (mit oder ohne BOM), UTF-16 mit BOM und sonst Windows-1252 (Excel „CSV (Trennzeichen-getrennt)“). Excel „Unicode-Text“ speichert als `.txt`, und `.txt` liest der DataLink als Datei mit `schlüssel=wert`-Zeilen, nicht als Tabelle: Die Datei vor dem Ablegen in `.tsv` umbenennen, sonst entsteht kein Eintrag; Variablennamen dürfen Umlaute enthalten, z. B. `{{größe}}`
- Grafik-Vorlage (optional): PSD oder `.jmtitler` importieren — Ebenennamen werden automatisch auf DataLink-Variablen gemappt (Titel/Name → `{{name}}`, Untertitel/Funktion → `{{subtitle}}`, Ort → `{{location}}`)
- iveo (optional): Wird der Titler über eine iveo-gebundene Show gestartet, materialisiert der Launcher die Speaker automatisch in den DataLink (`speakers.tsv` mit den Spalten `name`, `funktion`, `title`, `organisation`, `organisationen`, `@kennung`) — kein Token im Titler nötig. Ab Titler 0.12.1 mit Launcher 0.16.0 gibt es `{{organisation}}` (Hauptorganisation) und `{{organisationen}}` (alle, mit „ · “ verbunden); ohne Organisation bleiben beide leer, eine Vorlage „{{name}} · {{organisation}}“ zeigt dann „Name · “, darum den Trenner besser in eine eigene Ebene legen. Im Verbund braucht auch der gekoppelte Rechner Titler 0.12.1
- Kopfzeile: in der Mitte im Verbund (gekoppelter Rechner) „Show vom Master: ⟨Show⟩ · Stand ⟨hh:mm⟩“; solange die Speaker vom Master kommen, ist die Ordnerwahl unter Einstellungen › DataLink gesperrt, der Grund steht dort. Rechts **ON AIR** bzw. „bereit“, der Schalter Hell/Dunkel (je Arbeitsplatz gemerkt; das Recall-Board übernimmt ihn beim Öffnen, das Ausgabefenster bleibt unverändert) und ⚙
- Statusleiste unten: Master, iveo, NDI, Bildschirm, Fernsteuerung, DataLink. „unbekannt“ heißt: Der Titler weiß es (noch) nicht; „an (ohne Rückmeldung)“ heißt: eingeschaltet, eine Bestätigung gibt es nicht

### Während
- Bauchbinde füllen: **Vorlage** und **Inhalt** (Namensfeld) stehen immer offen neben der Vorschau; per DataLink `RECALL`/`NEXT`/`PREV` durch die Liste springen — lokal mit **◀ Eintrag** / **Eintrag ▶** unter der Vorschau (am Anfang bzw. Ende der Liste gesperrt, der Grund steht auf der Taste) oder per Klick unter **Daten / Recall**
- **Take** blendet on air (die Kopfzeile zeigt **ON AIR**, die Taste „LIVE“), **Clear** blendet aus — lokal oder per Companion/Rundown/Q&A (`TAKE`/`CLEAR`). Tastenkürzel gibt es keine
- Q&A-Kopplung: der aktive Sprecher setzt automatisch `TITLER TEXT` + `TITLER TAKE`
- Bei iveo-Live-Umschaltung lädt der Titler die Speaker der neuen Side Session non-destruktiv nach (`TITLER RELOAD`)

### Nachbereitung
- Bauchbinde ausblenden (`CLEAR`), NDI-Quelle im Mischer bleibt bestehen
- Importierte Vorlagen/Watchfolder für die nächste Show prüfen/austauschen

## Profi-Tipps
- Companion-Button „Nächster Redner": `TITLER NEXT` gefolgt von `TITLER TAKE` — ein Tastendruck holt den nächsten DataLink-Eintrag und blendet ihn ein.
- Grafik im JM Grafiktool bauen und als `.jmtitler` „an den Titler senden" — Hintergrund + variablen-fähige Text-Slots kommen fertig gemappt an.
- Für Konferenzen mit iveo: Speaker nie von Hand tippen — die Show materialisiert `speakers.tsv`, der Titler ruft sie per `RECALL` ab. Organisationen kommen mit (`{{organisation}}`, `{{organisationen}}`); eine Änderung in iveo erreicht die Bauchbinde in der Regel binnen etwa 5 Minuten, solange der Launcher mit dem iveo-Token dieser Show läuft und regelmäßig abfragt.
- Zweiter Bildschirm statt NDI, wenn der Mischer nur SDI/HDMI-Keying kann: Chroma-Green-Ausgabe auf den Keyer, NDI bleibt zusätzlich verfügbar.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| NDI-Quelle taucht im Mischer nicht auf | Statusleiste **NDI**: „aus“ → unter Einstellungen › NDI-Ausgabe einschalten. „an (ohne Rückmeldung)“ heißt nur: eingeschaltet, eine Bestätigung des Senders gibt es nicht. Dann: gleiches Subnetz? NDI-Discovery/Firewall frei? |
| Bauchbinde hat keinen transparenten Hintergrund | NDI führt Alpha — im Mischer als NDI (nicht als Screen-Capture) einbinden; beim 2. Bildschirm den Keyer auf Chroma-Green stellen |
| `{{variablen}}` bleiben leer | Statusleiste **DataLink**: „kein Ordner“ → unter Einstellungen › DataLink einen Ordner wählen; „Ordner fehlt“ → Ordner umbenannt oder Laufwerk weg. Spalten-/Ebenennamen passen zum Mapping? Per `RECALL <Nr.>` einen Eintrag ziehen |
| Companion/Q&A steuert nicht | Statusleiste **Fernsteuerung**: „Port belegt“ → ein anderes Programm hält 8726; es beenden und den Titler neu starten. „bereit · 0 verbunden“ → der Titler lauscht, kein Client ist verbunden: Port 8726 in der Firewall offen? `jm-titler-ctl` im mDNS sichtbar? |
| iveo-Speaker fehlen oder `{{organisation}}` bleibt leer | Show iveo-gebunden gestartet? Der Token liegt im Launcher (single-holder) — der Titler liest nur `speakers.tsv`. Leere Organisation: Titler ab 0.12.1 und Launcher ab 0.16.0, im Verbund auch auf dem gekoppelten Rechner? Hat der Speaker in iveo eine Organisation? |

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
