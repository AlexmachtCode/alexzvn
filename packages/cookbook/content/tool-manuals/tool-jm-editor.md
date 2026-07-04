---
id: tool-jm-editor
title: "JM Editor — Schnittprogramm (Trim/Cut/Export)"
category: Tool-Manuals
difficulty: mittel
setupTimeMin: 15
teamSize: "1"
tags: [editor, schnitt, video, ffmpeg, export, bauchbinde, prores, dnxhr, manual]
relatedTools: [jm-editor, jm-media-converter, jm-grafiktool]
prerequisites:
  - JM Editor installiert (über den Launcher)
  - Quellclips lokal verfügbar (Video/Audio/Bild)
  - Ausreichend Plattenplatz für Proxys und Export
equipmentOwner: jm
crewRoles:
  - Cutter / Editor
lastReviewed: 2026-07-05
owner: tech@jakobsmedien.com
summary: "Leichtes Schnittprogramm auf FFmpeg-Basis: Clips importieren, trimmen, schneiden und aneinanderreihen, Kreuzblenden, Titel/Bauchbinden und Lautstärke pro Clip — Export in H.264/H.265/ProRes/DNxHR mit flüssiger Vorschau über automatische Proxys."
---

## Zutaten

### Voraussetzungen
- JM Editor installiert (über den Launcher). FFmpeg/FFprobe sind mitgebündelt — kein separater Codec-Pack nötig.
- Quellmaterial lokal: Video (`mp4, mov, mkv, avi, mxf, webm, mpg, ts, m2ts, r3d …`), Audio (`wav, mp3, m4a, aac, flac, ogg …`), Bilder (`png, jpg, webp, tif …`).
- Plattenplatz für **Proxys** (Vorschau) und die Exportdatei.

### Lokales Werkzeug
- Reines Schnittprogramm — **kein Steuerserver / keine Fernsteuerung**, keine Netzwerkabhängigkeit. Läuft eigenständig.
- Über eine **`.jmshow`** öffnet der Editor sein referenziertes `.jmedit`-Projekt automatisch (Show-Anbindung).

## Schritt-für-Schritt

### Einrichtung
- Clips importieren und auf die Timeline ziehen. Spuren: **Titel** (Overlay), **Video**, **Audio**.
- ProRes/MXF/DNxHD-Quellen und Material über 1440p bekommen automatisch einen **720p-Proxy** für frame-genaues Scrubbing — kurz warten, bis er erzeugt ist (einmalig, gecacht).

### Während (Schnitt)
- **Trimmen/Schneiden/Teilen**: Clip-Anfang/-Ende ziehen, an der Abspielposition teilen, Lücken schließen.
- **Kreuzblenden** (Dissolve) zwischen zwei Clips setzen; harte Schnitte bleiben Cut.
- **Titel/Bauchbinden** auf der Titelspur: Text + Untertitel, Farbe, Hintergrundbox, Position, Fett.
- **Lautstärke pro Clip** anpassen (Gain).

### Export
- Preset wählen: **H.264 (mp4)**, **H.265/HEVC (mp4)**, **ProRes 422 HQ (mov)** oder **DNxHR HQ (mov)**. Auflösung/Bitrate bzw. Qualität (CRF), Ton als AAC oder PCM-WAV.
- Hardware-Encoder (NVENC/QSV/VideoToolbox) nutzen, wenn verfügbar — sonst Software-Fallback.
- Export rechnet aus den **Originaldateien** (nicht den Proxys) → volle Qualität.

## Profi-Tipps
- Für die Sendung/Weiterverarbeitung **ProRes/DNxHR** exportieren (edit-freundlich), für Web/YouTube **H.264/HEVC**.
- Den Proxy-Lauf einmal in Ruhe abwarten — danach scrubbt auch schweres ProRes-/MXF-Material flüssig.
- Titel/Bauchbinden, die öfter gebraucht werden, im **JM Grafiktool** gestalten und als Standbild importieren — mehr Gestaltungsfreiheit als das eingebaute Titel-Feld.
- Hardware-Encoder spart bei langen Exporten viel Zeit; bei Qualitätszweifeln einen kurzen Testexport vergleichen.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| Export bricht ab (FFmpeg-Fehler) | Fehlerdetail (stderr) lesen; Preset/Codec-Kombination prüfen; Zielpfad beschreibbar? |
| Vorschau ruckelt / kein Bild | Proxy-Erzeugung läuft noch (ProRes/MXF/>1440p) — kurz warten |
| „Keine Videoclips auf der Timeline" | Mindestens einen Videoclip auf die Videospur legen |
| Hardware-Encoder nicht verfügbar | Automatischer Software-Fallback — Export dauert länger, Ergebnis identisch |
| Clip lässt sich nicht importieren | Exotischer Container/Codec — vorab im JM Media Converter umwandeln |
| Platte voll beim Export | Freien Platz prüfen (Proxys + Export brauchen Platz) |

## Checklisten

### Vor dem Schnitt
- [ ] Clips importiert, Proxys erzeugt (bei ProRes/MXF/4K)
- [ ] Timeline-Spuren sortiert (Titel/Video/Audio)

### Vor dem Export
- [ ] Schnitte/Blenden final, Titel korrekt
- [ ] Lautstärke pro Clip geprüft
- [ ] Preset + Auflösung/Qualität gewählt, Zielordner mit Platz
- [ ] Kurzer Testexport bei kritischen Abgaben
