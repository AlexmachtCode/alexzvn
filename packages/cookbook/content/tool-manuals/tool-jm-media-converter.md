---
id: tool-jm-media-converter
title: "JM Media Converter — Video umwandeln & Office→PDF"
category: Tool-Manuals
difficulty: einfach
setupTimeMin: 10
teamSize: "1"
tags: [media-converter, konvertierung, transcode, ffmpeg, codec, office, pdf, libreoffice, manual]
relatedTools: [jm-media-converter, jm-editor]
prerequisites:
  - JM Media Converter installiert (über den Launcher)
  - Für Office→PDF LibreOffice installiert
  - Ausreichend Plattenplatz für die Ausgabedateien
equipmentOwner: jm
crewRoles:
  - Medien / Zuarbeit
lastReviewed: 2026-07-05
owner: tech@jakobsmedien.com
summary: "Lokales Umwandeln: Video in gängige Codecs (H.264/H.265/AV1/ProRes/DNxHR) mit Skalierung, Ratensteuerung und Hardware-Beschleunigung — plus Office-Dokumente (PPTX/DOCX/…) nach PDF über LibreOffice."
---

## Zutaten

### Voraussetzungen
- JM Media Converter installiert (über den Launcher). FFmpeg/FFprobe sind mitgebündelt (Video).
- **LibreOffice** vom Nutzer installiert — nur dann funktioniert Office→PDF (`soffice` wird an den üblichen Orten gesucht).
- Plattenplatz für die Ausgabedateien.

### Lokales Werkzeug
- Reines Umwandlungs-/Batch-Werkzeug — **kein Steuerserver / keine Fernsteuerung**, keine Show-Anbindung. Läuft eigenständig.

## Schritt-für-Schritt

### Einrichtung
- Datei(en) laden und den Zielordner wählen.
- Für Video ein **Preset** wählen: **H.264 (mp4)**, **H.265/HEVC (mp4)**, **AV1 (mp4)**, **ProRes 422 HQ (mov)** oder **DNxHR HQ (mov)**; dazu **Auflösung** (Original / 2160p / 1440p / 1080p / 720p / 480p), **Ratensteuerung** (Qualität/CRF, VBR oder CBR) und **Ton** (AAC/MP3/AC-3/ALAC/PCM, Originalspur übernehmen oder kein Ton).

### Während
- **Video**: Umwandlung starten — die Queue zeigt Fortschritt/ETA/fps. Optional **trimmen** (Start/Ende) und **Hardware-Beschleunigung** (NVENC/QSV/VideoToolbox) nutzen, sonst Software-Fallback.
- **Office → PDF**: Office-Dokument laden (`doc, docx, odt, rtf, txt, xls, xlsx, ods, csv, ppt, pptx, odp`) → LibreOffice wandelt headless nach **PDF**.

### Nachbereitung
- Ausgabedatei prüfen (bei Namenskollision wird `-converted` angehängt).
- PDF direkt im JM Presenter (Folien) nutzen; umgewandeltes Video im JM Editor weiterverarbeiten.

## Profi-Tipps
- Für Web/YouTube **H.264/HEVC**, für Schnitt/Sendung **ProRes/DNxHR**, für maximale Kompression **AV1** (langsamer). Beschriftung als Faustregel: „für Web" vs. „für Schnitt".
- Kommt ein Clip im JM Editor nicht flüssig oder gar nicht rein, hier vorab in ein edit-freundliches Format (ProRes/H.264) wandeln.
- PPTX-Folien vorab hier zu PDF wandeln und im Presenter das PDF importieren — spart den LibreOffice-Schritt unter Live-Druck.
- Hardware-Encoder für lange Dateien; bei Qualitätszweifeln kurzen Testausschnitt vergleichen.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| „LibreOffice wurde nicht gefunden" | LibreOffice installieren (Office→PDF braucht es); danach Tool neu starten |
| „Es wurde keine PDF erzeugt" / Timeout | Dokument beschädigt/sehr groß — in LibreOffice manuell öffnen und exportieren |
| Video-Export-Fehler (FFmpeg) | Fehlerdetail lesen; anderes Preset/Container; Zielpfad beschreibbar? |
| Hardware-Encoder nicht verfügbar | Automatischer Software-Fallback — langsamer, gleiches Ergebnis |
| Ausgabedatei überschreibt nichts | Bei Namenskollision wird `-converted` angehängt — Zielordner prüfen |
| Platte voll | Freien Platz vor großen Batches prüfen |

## Checklisten

### Video
- [ ] Preset + Auflösung + Ratensteuerung gewählt
- [ ] Ton-Einstellung passt (Codec/Original/kein Ton)
- [ ] Zielordner mit Platz; Testausschnitt bei kritischen Abgaben

### Office → PDF
- [ ] LibreOffice installiert
- [ ] Dokument geladen, PDF erzeugt und geprüft
