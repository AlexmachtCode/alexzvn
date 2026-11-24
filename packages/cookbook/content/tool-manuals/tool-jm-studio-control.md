---
id: tool-jm-studio-control
title: "JM Studio Control — Studio & TriCaster steuern"
category: Tool-Manuals
difficulty: anspruchsvoll
setupTimeMin: 45
teamSize: "1"
tags: [studio-control, tricaster, atem, obs, ptz, companion, gateway, audit, manual]
relatedTools: [jm-studio-control, jm-switcher, jm-stage-display]
prerequisites:
  - JM Studio Control installiert (über den Launcher)
  - Studiogeräte im Netz erreichbar (TriCaster, ATEM, OBS, PTZ, Audio/Licht)
  - Nutzer und Rollen festgelegt
  - Bitfocus Companion (Gateway-Rolle studio, optional)
equipmentOwner: gemischt
crewRoles:
  - Studio-Operator / Technische Leitung
lastReviewed: 2026-06-25
owner: tech@jakobsmedien.com
summary: "Zentrale, auditierte Studiosteuerung (TriCaster/ATEM/OBS/PTZ/Audio/Licht) mit Nutzerrollen und NDI-PGM-Vorschau (Port 7778) plus EIN Companion-Gateway über Port 8735."
---

## Zutaten

### Voraussetzungen
- JM Studio Control (über den Launcher)
- Erreichbare Studiogeräte: Video-Mischer (TriCaster/ATEM/OBS), PTZ-Kameras, Audio, Licht
- Nutzer und Rollen
- Optional: Bitfocus Companion über die Gateway-Rolle studio

### Gewerke
- Video-Mischer (TriCaster / ATEM / OBS)
- PTZ-Kameras (Panasonic)
- Audiopult und Licht (Art-Net)

### Netzwerk & Ports
- Port 7778 (Socket.IO/HTTP, Bearer-Auth): Web-/Bedien-UI und NDI-PGM-Vorschau. Hier melden sich die Operator-Clients an.
- Port 8735 (TCP-Zeilenprotokoll): EIN Companion-Gateway für den ganzen Studio-Hub. mDNS-Name jm-studio-control-ctl (TXT ctl=1). Studio Control hat sonst keinen weiteren _jmps._tcp-Advert (keine Namenskollision).
- Modell: EINE Rolle studio mit typ-präfixierten Verben; je Gerätetyp wird die PRIMÄR-Instanz (die erste konfigurierte) bedient.
- Fern-Befehle: STUDIO atem_program <n> | STUDIO atem_cut | STUDIO obs_scene <n> | STUDIO obs_record on|off | STUDIO tricaster_shortcut <name> | STATE?.
- Audit: Das TCP-Protokoll hat keinen Token (Companion-TCP); das Gateway handelt unter der festen Identität companion-gateway und protokolliert jeden Befehl (wer/was/Ziel) — Nachvollziehbarkeit für regulierte Umgebungen.

## Schritt-für-Schritt

### Einrichtung
- Geräte in den Panels der Reiter Video (TriCaster, ATEM, OBS, PTZ), Audio und Licht anlegen und verbinden und je Typ eine Primär-Instanz festlegen (die Reiter stehen in der Werkzeugleiste unter dem Kopf; Geräte im Netz sucht Setup › Discovery); die Statusleiste zeigt je eingerichtetem Gerätetyp einen Eintrag
- Nutzer und Rollen anlegen (wer darf was): Reiter Setup › Benutzer (nur Admin), „+ Benutzer anlegen“; eine Rolle ändert die Auswahl der Zeile erst mit „Setzen“ — Web-UI auf Port 7778 mit Bearer-Auth
- NDI-PGM-Vorschau einrichten
- Optional: Companion mit dem Gateway auf Port 8735 verbinden (typ-präfixierte Verben); das Gateway startet von selbst, im App-Fenster zeigen die Statusleiste „Fernsteuerung“ und das Panel ⚙ › Fernsteuerung seinen Stand (im Browser gibt es kein ⚙)

### Während
- Quellen/Szenen schalten (z. B. STUDIO atem_program 2, STUDIO obs_scene 3), PTZ steuern, Audio/Licht bedienen (lokal in den Panels der Reiter Video, Audio und Licht; gesperrte Haupttasten wie Cut, Auto, FTB, REC und STREAM nennen ihren Grund; PTZ-Richtung, Zoom und Fokus halten auch per Leertaste oder Enter)
- PGM-Vorschau im Blick behalten
- Aufnahme per STUDIO obs_record on/off (lokal „Aufnahme“ im OBS-Panel; ON AIR im Kopf zeigt „REC“ bzw. „LIVE“ nur, solange ein verbundener ATEM oder OBS wirklich aufnimmt bzw. streamt); alle Aktionen werden zentral auditiert (die letzten stehen im TriCaster-Panel unter „/ Letzte Aktionen“, ab Bediener)

### Nachbereitung
- Session/Logs sichern (Audit-Log bleibt erhalten)

## Profi-Tipps
- Pro Gerätetyp genau eine Primär-Instanz festlegen — das Gateway adressiert immer die erste konfigurierte; Mehrinstanz-Adressierung ist (noch) nicht im flachen Verb-Set.
- Das Companion-Gateway bündelt alle Gewerke auf EINER Rolle (Port 8735), statt jedes Gerät einzeln anzubinden.
- TriCaster-Makros per STUDIO tricaster_shortcut <name> auslösen — Shortcut-Namen vorab im TriCaster festlegen.
- Bei Audits/Abnahmen: das zentrale Log zeigt jeden Gateway-Befehl unter companion-gateway — praktisch für regulierte Kunden.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| Gerät nicht erreichbar | Eintrag des Gerätetyps in der Statusleiste und Pille im Panel ansehen (bei einer Trennung steht dort der Fehlertext des Geräts); Netz/IP und Anmeldedaten prüfen; richtige Primär-Instanz konfiguriert? |
| Verb wirkt nicht | Richtiges Typ-Präfix (atem_/obs_/tricaster_) und Primär-Instanz prüfen |
| Web-UI/PGM nicht erreichbar | Statusleiste „Server“ ansehen (ohne verbundenen Server stehen alle Geräte auf „unbekannt“ und ihre Tasten sind gesperrt); Port 7778 erreichbar? Bearer-Token korrekt? |
| Companion-Gateway reagiert nicht | Im App-Fenster Statusleiste „Fernsteuerung“ bzw. Panel ⚙ › Fernsteuerung ansehen (bereit, Port belegt, Fehler; das Gateway hat keinen eigenen Schalter); Port 8735 (jm-studio-control-ctl) erreichbar? |
| Aktion verweigert | Die gesperrte Taste nennt den Grund (z. B. „Rolle Betrachter darf nicht schalten“ oder „ATEM nicht verbunden“); Nutzerrolle/Rechte im Reiter Setup › Benutzer kontrollieren (Admin) |

## Checklisten

### Einrichtung
- [ ] Geräte verbunden (Primär-Instanz je Typ)
- [ ] Rollen gesetzt (Setup › Benutzer, Web-UI Port 7778)
- [ ] PGM-Vorschau läuft
- [ ] Companion-Gateway Port 8735 bereit (Statusleiste „Fernsteuerung“, optional)

### Vor Live
- [ ] Schalt-Test je Gewerk gelaufen
- [ ] Rechte/Rollen geprüft
- [ ] Audit-Log schreibt mit
