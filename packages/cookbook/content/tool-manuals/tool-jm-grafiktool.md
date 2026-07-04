---
id: tool-jm-grafiktool
title: "JM Grafiktool — Ebenen-Editor & Freistellen"
category: Tool-Manuals
difficulty: mittel
setupTimeMin: 10
teamSize: "1"
tags: [grafiktool, grafik, ebenen, freistellen, magic-mask, bauchbinde, psd, jmtitler, manual]
relatedTools: [jm-grafiktool, jm-titler, jm-editor]
prerequisites:
  - JM Grafiktool installiert (über den Launcher)
  - Für „Magic Mask" das lokale KI-Modell (u2netp.onnx) vorhanden
  - Quellbilder lokal (PNG/JPG/PSD/SVG/TIFF)
equipmentOwner: jm
crewRoles:
  - Grafik / Bildbearbeitung
lastReviewed: 2026-07-05
owner: tech@jakobsmedien.com
summary: "Schlanker Ebenen-Grafikeditor für Bauchbinden, Hintergründe und Freistellen (Magic Mask, lokal per KI) — Pinsel/Auswahl/Text/Formen, PSD/SVG/TIFF-Import, .jmg-Projekt und Export als .jmtitler-Vorlage für den JM Titler."
---

## Zutaten

### Voraussetzungen
- JM Grafiktool installiert (über den Launcher).
- Für **Magic Mask** (KI-Freistellen): das lokale Modell **`u2netp.onnx`** muss mitinstalliert sein — läuft offline auf der CPU, kein Cloud-Dienst.
- Quellbilder lokal: `png, jpg, webp, gif, bmp, tif` sowie **`psd`** (Photoshop), **`svg`** und `.jmg`-Projekte.

### Lokales Werkzeug
- Reiner Grafikeditor — **kein Steuerserver / keine Fernsteuerung**, keine Netzwerkabhängigkeit.
- Über eine **`.jmshow`** öffnet das Grafiktool sein referenziertes `.jmg`-Dokument automatisch.

## Schritt-für-Schritt

### Einrichtung
- Neues Dokument anlegen oder ein Bild/PSD/SVG importieren. Arbeit erfolgt in **Ebenen** (Raster/Text/Form) mit Maske, Deckkraft und Blend-Modus.

### Während (Gestalten & Freistellen)
- Werkzeuge: **Pinsel**, **Radierer**, **Auswahl** (Rechteck/Lasso/Zauberstab), **Füllen**, **Form**, **Text**, **Freistellen (Crop)**, Pipette, Hand/Zoom.
- **Magic Mask**: Motiv per KI freistellen — der Hintergrund wird als Maske entfernt (rembg-kompatibel). Große Bilder brauchen auf der CPU etwas Zeit.
- Text-Ebenen benennen wie die späteren Variablen (z. B. `name`, `subtitle`, `location`) — das erleichtert den Titler-Export.

### Ausgabe
- **Projekt** als `.jmg` speichern (ZIP aus Ebenen + Masken).
- **Raster-Export** als PNG/JPG für Standbilder/Bauchbinden im Schnitt.
- **`.jmtitler`-Export** für den JM Titler: Text-Ebenen werden zu Slots (Auto-Mapping Ebenenname → `{{name}}`/`{{subtitle}}`/`{{location}}`), Nicht-Text-Ebenen zum Hintergrund — im Titler als Grafik-Vorlage nutzbar.
- Häufig gebrauchte Assets in die **Bibliothek** legen.

## Profi-Tipps
- Bauchbinden im Grafiktool bauen und als **`.jmtitler`** exportieren — im Titler bleiben die Textfelder als Variablen aus DataLink/iveo füllbar (dynamische Namen/Funktionen).
- Text-Ebenen konsequent nach dem Variablennamen benennen — dann sitzt das Slot-Mapping beim Titler-Import ohne Nacharbeit.
- Magic Mask liefert die Maske; mit Pinsel/Radierer an Haaren/Kanten nachbessern, statt neu freizustellen.
- PSD aus einem vollwertigen Grafikprogramm importieren, wenn die Gestaltung dort schon steht — Ebenen bleiben erhalten.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| „KI-Modell (u2netp.onnx) nicht gefunden" | Modell fehlt in der Installation — ohne es ist Magic Mask nicht verfügbar (Rest funktioniert) |
| PSD/TIFF/SVG lädt nicht | Datei beschädigt/exotische Variante — als PNG exportieren und dieses importieren |
| Freistellen dauert lange | Große Auflösung auf CPU — kleiner rechnen oder Ausschnitt bearbeiten |
| Titler zeigt Slots falsch | Text-Ebenen im Grafiktool nach den Variablennamen benennen und neu exportieren |
| Schriftliste leer | System-Fonts nicht gefunden — Standardschrift nutzen |

## Checklisten

### Gestalten
- [ ] Dokument/Import angelegt, Ebenen sortiert
- [ ] Motiv freigestellt (Magic Mask + Nachbesserung)
- [ ] Text-Ebenen nach Variablennamen benannt

### Ausgabe
- [ ] `.jmg` gespeichert
- [ ] Export gewählt: PNG/JPG (Standbild) oder `.jmtitler` (Titler-Vorlage)
- [ ] Häufige Assets in der Bibliothek
