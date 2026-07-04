---
id: tool-jm-transcribe
title: "JM Transcribe — Untertitel & Transkripte (offline)"
category: Tool-Manuals
difficulty: einfach
setupTimeMin: 10
teamSize: "1"
tags: [transcribe, untertitel, transkript, whisper, srt, vtt, offline, manual]
relatedTools: [jm-transcribe, jm-editor, jm-media-converter]
prerequisites:
  - JM Transcribe installiert (über den Launcher)
  - Audio-/Videodateien lokal verfügbar
  - Ausreichend Plattenplatz für nachgeladene Modelle (optional)
equipmentOwner: jm
crewRoles:
  - Postproduktion / Untertitel
lastReviewed: 2026-07-05
owner: tech@jakobsmedien.com
summary: "Erzeugt Untertitel und Transkripte (SRT/VTT/TXT) lokal und offline aus Audio-/Videodateien via whisper.cpp — Sprachwahl oder Auto-Erkennung, Übersetzung nach Englisch, Basismodell mitgeliefert, größere Modelle nachladbar."
---

## Zutaten

### Voraussetzungen
- JM Transcribe installiert (über den Launcher). whisper-Binary + **Basismodell** sind mitgebündelt — läuft **offline**, keine Cloud.
- Audio-/Videodateien lokal (ffmpeg wandelt intern in 16-kHz-Mono-WAV).
- Plattenplatz, falls größere Modelle nachgeladen werden.

### Lokales Werkzeug
- Reines Offline-Werkzeug — **kein Steuerserver / keine Fernsteuerung**.
- Über eine **`.jmshow`** übernimmt Transcribe Voreinstellungen (Sprache, Modell, Aufgabe, Formate, Zielordner) — sinnvoll, um pro Produktion gleich richtig zu starten.

## Schritt-für-Schritt

### Einrichtung
- **Modell** wählen: `base` (mitgeliefert, schnell) bis `large-v3` (beste Qualität, langsam). Größere Modelle werden bei Bedarf einmalig heruntergeladen.
- **Sprache** wählen oder „Automatisch erkennen".
- **Aufgabe**: `Transkribieren` (Originalsprache) oder `Übersetzen` (immer nach Englisch).
- **Formate**: SRT, VTT und/oder TXT. **Zielordner** setzen (leer = neben der Quelldatei).

### Während
- Dateien per Dialog hinzufügen **oder** in das Fenster ziehen. Die Job-Queue arbeitet sie nacheinander ab (Fortschritt je Datei).
- Größeres Modell = genauer, aber deutlich langsamer — bei vielen Dateien Modellgröße bewusst wählen.

### Nachbereitung
- Ergebnisdateien prüfen (Chips je Job) und „Im Ordner zeigen". Untertitel in den Schnitt (JM Editor) übernehmen oder als Transkript weitergeben.

## Profi-Tipps
- Für saubere Untertitel `base`/`small` meist ausreichend; `medium`/`large-v3` für schwierige Akustik oder fremde Sprachen.
- „Automatisch erkennen" nur, wenn die Sprache unklar ist — die feste Sprachwahl ist zuverlässiger.
- SRT für Videoschnitt/YouTube, VTT für Web-Player, TXT als reines Redemanuskript — bei Bedarf einfach mehrere Formate ankreuzen.
- Über eine **`.jmshow`** pro Event Sprache + Zielordner vorbelegen — dann ist jede Aufnahme sofort richtig eingestellt.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| „Engine nicht verfügbar" / kein Transkribieren | whisper-Binary fehlt (Windows-Build) — Installation prüfen |
| Modell nicht installiert | Modell im Tool herunterladen (base ist immer da) |
| Keine Ausgabedatei erzeugt | Schreibrechte/Zielordner prüfen; mindestens ein Format wählen |
| Datei wird nicht verarbeitet | Exotischer Codec — vorab im JM Media Converter umwandeln |
| Transkription sehr langsam | Kleineres Modell wählen; große Modelle brauchen Zeit/CPU |

## Checklisten

### Einrichtung
- [ ] Modell + Sprache + Aufgabe gewählt
- [ ] Formate (SRT/VTT/TXT) + Zielordner gesetzt
- [ ] Gewünschtes Modell installiert

### Durchlauf
- [ ] Dateien hinzugefügt, Queue läuft
- [ ] Ergebnis stichprobenartig geprüft (Timing/Rechtschreibung)
