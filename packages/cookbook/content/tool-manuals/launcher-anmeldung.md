---
id: launcher-anmeldung
title: "JM Launcher — Anmelden (Konto, Stufen, Zoom anfragen)"
category: Tool-Manuals
difficulty: einfach
setupTimeMin: 5
teamSize: "1"
tags: [launcher, anmeldung, konto, login, google, externe, zoom, iveo, manual]
relatedTools: []
prerequisites:
  - JM Launcher ab 0.18.0
  - Internet für die erste Anmeldung
  - "Kollegen: Google-Firmenkonto von jakobsmedien.com"
  - "Externe Techniker: Einladungscode von einem Admin"
equipmentOwner: jm
crewRoles:
  - Technik (Kollegen und externe Techniker)
lastReviewed: 2026-11-04
owner: tech@jakobsmedien.com
summary: "Einmal im Launcher anmelden, dann hat jedes Tool, was es braucht: Installieren und Updates, iveo-Events, Q&A extern. Kollegen melden sich mit Google an, externe Techniker mit E-Mail und Passwort. Der Launcher zeigt einen Code, der Browser denselben; bestätigt wird nur, wenn beide gleich sind. Tools ohne Server-Teil laufen auch ohne Anmeldung, und eine laufende Produktion hängt nie an der Anmeldung."
---

## Zutaten

### Was die Anmeldung bringt
- Installieren, Updates, Feedback und Kochbuch-Entwürfe über die Anmeldung; einen Schlüssel oder Token trägt niemand mehr ein.
- iveo-Events, die ein Admin hinterlegt hat; das Token kommt nur in den Speicher des Launchers, nie in die Show-Datei.
- „Q&A extern“: JM Q&A holt seine Freigabe beim Launcher.
- Oben rechts steht, wer angemeldet ist: ein Kreis mit Initialen in der Farbe der Stufe, dazu Name und Stufe (Admin, Kollege, Externer); ohne Anmeldung „Anmelden“.

### Wer sich wie anmeldet
- **Kollegen** mit ihrem Google-Konto von jakobsmedien.com; beim ersten Mal sind sie automatisch Kollegen.
- **Externe Techniker** mit E-Mail und Passwort; das Passwort setzen sie beim ersten Mal mit dem Einladungscode, den ihnen ein Admin auf eigenem Weg gibt (z. B. Chat). Ein Externer hat einen Zugang bis zu einem Datum und nur die Tools, die der Admin freigibt.
- An einem Rechner ist immer ein Konto angemeldet. Was ohne Server läuft (Tools öffnen, Shows, Verbund, Steuerebene), geht auch ohne Anmeldung.

## Schritt-für-Schritt

### Einrichtung (erste Anmeldung)
- Oben rechts auf „Anmelden“ klicken. Der Launcher öffnet „Im Browser anmelden“ mit einem Code und dem Satz „Der Browser zeigt gleich denselben Code. Bestätige dort nur, wenn er übereinstimmt.“
- Der Browser öffnet die Anmeldeseite. Kollegen wählen „Mit Google anmelden“. Externe tragen E-Mail und Passwort ein; beim ersten Mal oder mit neuem Code unter „Erstes Mal hier oder neuen Code bekommen?“ den Einladungscode und zweimal das neue Passwort (mindestens 10 Zeichen).
- Die Seite fragt „Zeigt dein Launcher diesen Code?“ und nennt den Rechner. Nur wenn der Code gleich ist: „Ja, das ist mein Rechner“. Sonst „Nein, abbrechen“.
- Der Launcher meldet sich von selbst an und zeigt oben Name und Stufe. Geht der Browser nicht auf: „Adresse kopieren“ und die Adresse selbst im Browser öffnen.
- Beim ersten Mal löscht der Launcher einen früher gespeicherten GitHub-Token; alte, lokal gespeicherte iveo-Tokens verschwinden nach und nach, sobald ein Admin das Event zentral hinterlegt (spätestens nach 30 Tagen).

### Während (Betrieb)
- Die Anmeldung gilt bis zum nächsten Start des Launchers; beim Start prüft er sie im Hintergrund. Ohne Internet gilt sie weiter, oben steht dann „offline“, im Konto-Dialog das Datum, bis zu dem sie gilt (höchstens 30 Tage nach der letzten Prüfung beim Server; läuft der Launcher so lange, prüft er vorher von selbst neu).
- Entzieht ein Admin den Zugang, läuft alles weiter, was schon läuft; beim nächsten Start ist der Rechner abgemeldet. Oben steht dann „Zugang entzogen“.
- **Zoom anfragen (Externe):** im Konto-Dialog „Zoom anfragen“, Zweck oder Event und den Zeitraum eintragen, „Anfrage senden“. Ein Admin gibt frei. Connect nutzt die Freigabe erst mit einem kommenden Update (bis dahin gilt Zoom in Connect wie bisher); danach wirkt sie ab dem nächsten Start des Launchers und nur auf einem JM-Rechner unter Windows. Kollegen brauchen keine Anfrage.
- **Admins** öffnen die Admin-Maske über „Admin-Maske öffnen“ in den Einstellungen oder im Konto-Dialog: Zugänge, iveo-Events, Anfragen, Geräte. Ein Punkt am Zahnrad zeigt offene Zoom-Anfragen. Scheidet ein Kollege aus, sperren Admins seinen Zugang sofort (Zugang löschen); ohne Sperre muss er sich spätestens 90 Tage nach seiner letzten Anmeldung mit Google neu anmelden und kommt dann nicht mehr herein.

### Nachbereitung
- Abmelden im Konto-Dialog (Klick auf den Kreis oben rechts), „Abmelden“. Der iveo-Abgleich der offenen Show stoppt; laufende Tools arbeiten weiter. Neue Freigaben gibt es erst nach einer neuen Anmeldung.

## Profi-Tipps
- Vor einer Produktion einmal mit Internet starten: Dann ist die Anmeldung frisch und gilt auch offline wieder bis zu 30 Tage.
- Den Code immer vergleichen. Eine weitergeleitete Anmeldeadresse nützt einem anderen nichts: Ein Vorgang gehört dem ersten Konto, das sich darauf anmeldet.
- JM Q&A behält seine Freigabe 72 Stunden, auch über einen Neustart von Q&A und bei geschlossenem Launcher. Für eine neue Freigabe muss der Launcher laufen.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| „Der Code ist abgelaufen. Starte die Anmeldung neu.“ | Der Code gilt 5 Minuten; „Neu starten“ |
| „Im Browser wurde „Nein, abbrechen“ gewählt. Es wurde nichts angemeldet.“ | Neu anmelden und den Code genau vergleichen |
| „Der Server ist nicht erreichbar. Prüfe die Internetverbindung und versuche es erneut.“ | Internet prüfen, „Erneut versuchen“; eine bestehende Anmeldung gilt offline weiter |
| Der Browser geht nicht auf | „Adresse kopieren“ und die Adresse selbst öffnen |
| Oben steht „Anmeldung abgelaufen“ | 30 Tage ohne Prüfung beim Server, der Zugang ist abgelaufen oder die letzte Anmeldung mit Google ist 90 Tage her: neu anmelden bzw. einen Admin nach einer Verlängerung fragen |
| Oben steht „Zugang entzogen“ | Einen Admin fragen; was läuft, läuft weiter |
| Oben steht „Anmelden nicht möglich“ | Auf diesem Rechner gibt es keinen sicheren Schlüsselspeicher; Benutzerkonto und Betriebssystem prüfen lassen |
| Zoom-Freigabe wirkt nicht | Connect nutzt Zoom-Freigaben erst mit einem kommenden Update; danach wirken sie nach dem nächsten Start und nur auf JM-Rechnern unter Windows. Der Konto-Dialog sagt, ob der Rechner ein JM-Rechner ist |
| JM Q&A: „Kein Launcher mit Anmeldung gefunden. Starte den Launcher und melde dich dort an.“ | Launcher starten und anmelden; Q&A versucht es von selbst weiter |

## Checklisten

### Neuer Rechner
- [ ] Launcher ab 0.18.0 installiert
- [ ] Angemeldet, oben stehen Name und Stufe
- [ ] Im Konto-Dialog stimmt „Dieser Rechner“ (JM-Rechner ja oder nein)

### Vor der Produktion
- [ ] Launcher einmal mit Internet gestartet, oben steht nicht „offline“
- [ ] iveo-Events im Show-Editor auswählbar (sonst einen Admin bitten, das Event zu hinterlegen)
- [ ] Externe mit Zoom: Freigabe im Konto-Dialog sichtbar
