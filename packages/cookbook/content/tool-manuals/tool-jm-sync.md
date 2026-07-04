---
id: tool-jm-sync
title: "JM Sync — A/V-Versatz messen (Lipsync)"
category: Tool-Manuals
difficulty: mittel
setupTimeMin: 10
teamSize: "1"
tags: [sync, lipsync, av-versatz, latenz, streaming, messung, kalibrierung, manual]
relatedTools: [jm-sync]
prerequisites:
  - JM Sync installiert (über den Launcher) oder als Web-App auf dem Handy
  - Kamera + Mikrofon bzw. Capture-Card + Audio-Interface
  - Ein Referenzsignal (der eingebaute Generator oder ein Klatschbrett)
equipmentOwner: jm
crewRoles:
  - Streaming / Technik
lastReviewed: 2026-07-05
owner: tech@jakobsmedien.com
summary: "Misst den A/V-Versatz (Lipsync-Offset), den eine Streaming-Pipeline einbaut — Softwareersatz fürs Sync-It-Plus: ein Generator löst Blitz + Piep gleichzeitig aus, die Messung erfasst beide mit einer Uhr, die Differenz ist der Versatz. Mit Null-Abgleich (Kalibrierung) und Verlaufsanzeige."
---

## Zutaten

### Voraussetzungen
- JM Sync installiert (über den Launcher) — oder als **Web-App** auf dem Handy (braucht HTTPS, Kamera + Mikro).
- Eine **Videoquelle** (Kamera/Capture-Card) und eine **Audioquelle** (Mikro/Audio-Interface), die den zu prüfenden Signalweg abbilden.
- Ein **Referenzsignal**: der eingebaute **Generator** (Blitz + Piep) oder ein echtes Klatschbrett.

### Lokales Werkzeug
- Reines Messwerkzeug — **kein Steuerserver, keine Show-Anbindung**. Drei Reiter: **Messung · Generator · Kalibrierung**.
- Prinzip: Blitz und Piep werden **exakt gleichzeitig** ausgelöst und durch die Pipeline geschickt; da beide mit **einer** Uhr gemessen werden, ist keine Zeitsynchronisation nötig. Positiver Wert = **Audio führt**, negativer = **Video führt**.

## Schritt-für-Schritt

### Einrichtung
- Video- und Audioquelle wählen (im Studio Capture-Card + Interface; für einen Schnelltest lässt sich auch ein Bildschirm/Tab als Quelle nehmen).
- **Kalibrierung (Null-Abgleich)**: Generator und Messung einmal **direkt** gegeneinander laufen lassen (ohne die zu prüfende Pipeline). JM Sync speichert die Eigenlatenz als Baseline und zieht sie danach automatisch ab.

### Während (Messung)
- **Generator** starten (am Punkt, den man prüfen will — z. B. auf dem Encoder-Screen). Intervall (1–5 s) und Frequenz (400–2000 Hz) sind mit der Messung gekoppelt.
- **Messung** starten und ablesen: „Audio führt X ms" bzw. „Video führt X ms", plus **Verlaufsgraph** für stabile Mittelwerte.
- Den gemessenen Versatz am Mischer/Encoder ausgleichen (Audio-Delay) und gegenkontrollieren.

### Nachbereitung
- Messung stoppen; bei geänderter Pipeline neu kalibrieren und messen.

## Profi-Tipps
- **Immer erst kalibrieren** — sonst steckt die Eigenlatenz von Kamera/Interface im Ergebnis und du korrigierst den falschen Wert.
- Den Generator dort zeigen, wo das Signal in die Pipeline geht (Bühnen-Monitor/Encoder-Screen); die Messung am Ende (Stream/Recording) — die Differenz ist genau der Pipeline-Versatz.
- Den Verlaufsgraphen beobachten, nicht den Momentwert — kurze Ausreißer werden verworfen, der Median ist belastbar.
- Handy-Web-App als schnelle Zweitmessung „von der Bühne aus" (Kamera aufs Display, Mikro an den Lautsprecher).

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| „Could not start video source" | Kamera/Capture von anderer App (OBS/Teams) belegt — schließen, Gerät freigeben |
| Keine Geräte erkannt | Kamera-/Mikrofon-Freigabe erteilt? Gerät angeschlossen? |
| Werte springen stark | Referenzsignal zu schwach/verdeckt — Blitz gut sichtbar, Piep laut genug |
| Ergebnis wirkt „verschoben" | Nicht kalibriert — Null-Abgleich durchführen |
| Web-App zeigt keine Kamera | PWA braucht HTTPS für den Kamerazugriff |
| Gerät kann Einstellung nicht | Andere Auflösung/Rate wählen (Overconstrained) |

## Checklisten

### Vor der Messung
- [ ] Video- + Audioquelle gewählt
- [ ] Null-Abgleich (Kalibrierung) gemacht
- [ ] Generator sichtbar/hörbar am richtigen Punkt

### Messung
- [ ] Verlauf stabil, Median abgelesen
- [ ] Versatz am Encoder/Mischer korrigiert und gegengeprüft
