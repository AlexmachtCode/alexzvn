---
id: tool-jm-copy
title: "JM Copy — verifizierter Offload (xxHash64 + MHL)"
category: Tool-Manuals
difficulty: einfach
setupTimeMin: 10
teamSize: "1"
tags: [copy, offload, backup, sicherung, prüfsumme, mhl, xxhash, spiegel, manual]
relatedTools: [jm-copy]
prerequisites:
  - JM Copy installiert (über den Launcher)
  - Quellmedium (Karte/Laufwerk) und ein oder mehrere Ziel-Datenträger
  - Für die Netzwerk-Spiegelung erreichbare Backup-Ziele (UNC/Laufwerk)
equipmentOwner: jm
crewRoles:
  - DIT / Data Wrangler
lastReviewed: 2026-07-05
owner: tech@jakobsmedien.com
summary: "Verifizierter Medien-Offload: Footage von Karte/Quelle parallel auf mehrere Ziele kopieren, per xxHash64 zurücklesen und prüfen, MHL-Protokoll schreiben — plus Master-Ordner-Vorlagen und ein Netzwerk-Ordner-Spiegel als Backup."
---

## Zutaten

### Voraussetzungen
- JM Copy installiert (über den Launcher). Reines Werkzeug ohne Cloud, ohne native Abhängigkeiten.
- Quellmedium (Kamerakarte, Recorder-Laufwerk) und **ein oder mehrere** Ziel-Datenträger.
- Für die Spiegelung (Backup-Rechner) erreichbare Netzwerkfreigaben (UNC/Laufwerk/Volume).

### Lokales Werkzeug
- Reines Kopier-/Sicherungswerkzeug — **kein Steuerserver, keine Show-Anbindung**. Vier Bereiche: **Kopieren · Sync · Vorlagen · Prüfen**.

## Schritt-für-Schritt

### Einrichtung (Kopieren)
- **Quelle** wählen: Dateien und/oder Ordner (rekursiv gescannt, Junk wie `.DS_Store`/`Thumbs.db` übersprungen).
- **Ziele** hinzufügen: beliebig viele — es wird **einmal gelesen und parallel auf alle Ziele geschrieben** (schneller Fan-out).
- **Master-Ordner** aus einer Vorlage (Baukasten) erzeugen: Datums-/Projekt-Tokens (`{YYYY}{MM}{DD}`, `{projekt}`, `{kunde}`, `{episode}` …) + feste Unterordner (Footage/Audio/Docs …).
- **Optionen**: Verifizieren (an), MHL-Protokoll (an), optional zusätzlich MD5.

### Während
- Kopiervorgang starten — jede Datei wird beim Kopieren per **xxHash64** gehasht.
- Bei aktivem **Verify** wird jede geschriebene Datei zurückgelesen und der Hash gegen die Quelle geprüft (je Ziel).
- Fortschritt je Datei/Job wird angezeigt; Probleme werden als `mismatch`/`failed` markiert.

### Nachbereitung
- Ergebnis prüfen: „Alles verifiziert" bzw. „N Datei(en) mit Problemen", je Ziel „MHL ✓" und „Im Finder/Explorer zeigen".
- Das **`.mhl`**-Protokoll (MHL 1.1, `xxhash64be`) liegt am Ziel — lesbar von DaVinci Resolve, Silverstack, ShotPut Pro.
- **Später erneut prüfen**: Reiter „Prüfen" → Ordner wählen → JM Copy rehasht alle im MHL referenzierten Dateien (ok / mismatch / missing).

### Netzwerk-Spiegel (Reiter „Sync")
- Einweg-Spiegel Quelle → Ziel(e) für ein Backup: Vorschau (Trockenlauf) zeigt „+neu · aktualisiert · gelöscht"; bei **Mirror** werden überzählige Dateien am Ziel gelöscht (rot markiert — bewusst prüfen).
- Automatik: **manuell**, **Überwachen** (Datei-Änderungen) oder **Intervall** — läuft, solange JM Copy offen ist.

## Profi-Tipps
- Beim Offload **immer verifizieren** — nur so ist die Kopie beweisbar identisch (xxHash64 ist schnell, MD5 nur zusätzlich, wenn ein Kunde es verlangt).
- Direkt auf **zwei Ziele** kopieren (Arbeits- + Backup-Platte) — der Fan-out macht das fast ohne Zeitverlust.
- Master-Ordner-Vorlage einmal pro Projekt einrichten — dann landet jede Karte konsistent benannt im richtigen Baum.
- Das MHL nicht wegwerfen — mit „Prüfen" lässt sich Tage später belegen, dass nichts gekippt ist.
- „Mirror" mit Bedacht: es **löscht** am Ziel, was an der Quelle fehlt — vorher die Vorschau lesen.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| „Ziel ist identisch mit der Quelle" | Anderes Ziel wählen (nicht auf die Quelle kopieren) |
| „Prüfsumme stimmt nicht überein" | Medium/Kabel defekt — Kopie wiederholen, Karte prüfen, nicht löschen |
| Ziel nicht erreichbar | Netzlaufwerk verbunden? Freigabe/Rechte, Kabel/WLAN prüfen |
| Zieldatenträger voll | Freien Platz vor dem Offload prüfen |
| Mirror hat am Ziel gelöscht | Das ist gewollt — vorher Vorschau lesen; kritische Backups nicht spiegeln |
| Quelldatei nicht lesbar | Wird übersprungen (`skipped`) — Karte/Reader prüfen |

## Checklisten

### Offload
- [ ] Quelle gewählt, Ziel(e) hinzugefügt
- [ ] Master-Ordner/Vorlage gesetzt
- [ ] Verify + MHL aktiv
- [ ] Nach dem Lauf: „Alles verifiziert", MHL am Ziel

### Backup-Spiegel
- [ ] Vorschau gelesen (neu/aktualisiert/gelöscht)
- [ ] Mirror nur, wenn Löschen am Ziel gewollt ist
