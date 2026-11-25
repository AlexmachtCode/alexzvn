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
  - Anmeldung: Ohne Anmeldung ist nur das eigene App-Fenster Admin. Ein Browser, auch der auf demselben Rechner wie Studio Control (`http://localhost:7778/`), und jedes Programm melden sich mit einem Konto an. Anfragen von fremden Webseiten (eine andere Herkunft als der Server selbst) weist Studio Control mit „403“ ab.
- Port 8735 (TCP-Zeilenprotokoll): EIN Companion-Gateway für den ganzen Studio-Hub. mDNS-Name jm-studio-control-ctl (TXT ctl=1). Studio Control hat sonst keinen weiteren _jmps._tcp-Advert (keine Namenskollision).
- Modell: EINE Rolle studio mit typ-präfixierten Verben; je Gerätetyp wird die PRIMÄR-Instanz (die erste konfigurierte) bedient.
- Companion und „secure“: Das Gateway richtet sich nach dem Modus der Suite (`control.json`, im Panel ⚙ › Fernsteuerung). Steht die Suite auf „secure“, nimmt es Befehle nur mit dem Suite-Token an; hat der Launcher die Suite gesichert (Sichere Steuerebene), spricht es zusätzlich TLS. Companion braucht dann im Modul „JM Suite“ beide Felder aus dem Launcher › „Sichere Steuerebene“, „Suite-Token“ und „TLS-Fingerprint (SHA-256)“, wie bei den anderen Werkzeugen; mit dem Token allein bleibt Companion bei „Authentifiziere …“ stehen. Auf „open“ geht es wie bisher ohne.
- Fern-Befehle: STUDIO atem_program <n> | STUDIO atem_cut | STUDIO obs_scene <n> | STUDIO obs_record on|off | STUDIO tricaster_shortcut <name> | STATE?.
- Audit: Das TCP-Protokoll hat keinen Token (Companion-TCP); das Gateway handelt unter der festen Identität companion-gateway und protokolliert jeden Befehl (wer/was/Ziel) — Nachvollziehbarkeit für regulierte Umgebungen.

## Schritt-für-Schritt

### Einrichtung
- Geräte in den Panels der Reiter Video (TriCaster, ATEM, OBS, PTZ), Audio und Licht anlegen und verbinden und je Typ eine Primär-Instanz festlegen (die Reiter stehen in der Werkzeugleiste unter dem Kopf; Geräte im Netz sucht Setup › Discovery); die Statusleiste zeigt je eingerichtetem Gerätetyp einen Eintrag
- Nutzer und Rollen anlegen (wer darf was): Reiter Setup › Benutzer (nur Admin), „+ Benutzer anlegen“; eine Rolle ändert sich erst mit „Setzen“ in derselben Zeile, die Auswahl allein ändert nichts — Web-UI auf Port 7778 mit Bearer-Auth
- Beim ersten Start legt Studio Control das Konto „Admin“ mit einem Erst-Passwort an, das in einer Datei neben den Einstellungen des Programms liegt. Das Panel ⚙ › Abschnitt „Browser-Zugang“ (nur im App-Fenster, unter „Fernsteuerung“) nennt den Ort dieser Datei, solange es sie gibt, nie das Passwort selbst. Nach der ersten Anmeldung das Passwort ändern und die Datei löschen; danach steht dort „Keine Datei mit Erst-Passwort vorhanden.“
- Für das Tablet oder einen Browser am Regie-Rechner: `http://‹IP›:7778/` öffnen (Tray › „LAN-URLs“) und mit einem Konto aus Setup › Benutzer anmelden; nur das Fenster der App selbst braucht keine Anmeldung
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
| Browser oder Programm bekommt keinen Zugriff, auch am Regie-Rechner | Mit einem Konto aus Setup › Benutzer anmelden (die Anmeldung gilt auch auf demselben Rechner). Antwort „403“ heißt: Die Seite kommt nicht vom Server selbst (fremde Webseite) und wird abgewiesen; die Adresse `http://‹IP›:7778/` direkt öffnen |
| Passwort für „Admin“ vergessen oder unbekannt | Im App-Fenster Panel ⚙ › „Browser-Zugang“: Dort steht der Ort der Datei mit dem Erst-Passwort, solange sie besteht. Steht dort „Keine Datei …“, ein anderes Admin-Konto in Setup › Benutzer nutzen |
| Companion-Gateway reagiert nicht | Im App-Fenster Statusleiste „Fernsteuerung“ bzw. Panel ⚙ › Fernsteuerung ansehen (bereit, Port belegt, Fehler; das Gateway hat keinen eigenen Schalter); steht die Suite auf „secure“, braucht Companion Suite-Token und TLS-Fingerprint aus dem Launcher (Sichere Steuerebene); fehlt eines davon, kommt keine Verbindung zustande (ohne Token lehnt das Gateway ab, mit Token ohne Fingerprint bleibt Companion bei „Authentifiziere …“ stehen); Port 8735 (jm-studio-control-ctl) erreichbar? |
| Aktion verweigert | Die gesperrte Taste nennt den Grund (z. B. „Rolle Betrachter darf nicht schalten“ oder „ATEM nicht verbunden“); Nutzerrolle/Rechte im Reiter Setup › Benutzer kontrollieren (Admin) |

## Checklisten

### Einrichtung
- [ ] Geräte verbunden (Primär-Instanz je Typ)
- [ ] Rollen gesetzt (Setup › Benutzer, Web-UI Port 7778)
- [ ] Erst-Passwort geändert und die Datei gelöscht (Panel ⚙ › „Browser-Zugang“ zeigt „Keine Datei …“)
- [ ] PGM-Vorschau läuft
- [ ] Companion-Gateway Port 8735 bereit (Statusleiste „Fernsteuerung“, optional)

### Vor Live
- [ ] Schalt-Test je Gewerk gelaufen
- [ ] Rechte/Rollen geprüft
- [ ] Audit-Log schreibt mit
