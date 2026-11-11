---
id: tool-jm-connect
title: "JM Connect — Browser-Gäste und Zoom-Slots als NDI®-Quellen"
category: Tool-Manuals
difficulty: anspruchsvoll
setupTimeMin: 45
teamSize: "1-2"
tags: [connect, zoom, slots, remote, gaeste, ndi, companion, wiederbeitritt, manual]
relatedTools: [jm-connect, jm-switcher, jm-rundown]
prerequisites:
  - Windows 10/11, 64 Bit (mit Zoom und NDI) oder macOS auf Apple Silicon oder Intel (mit NDI, ohne Zoom)
  - JM Connect ab 0.4.0, installiert über den Launcher
  - Zoom-SDK 7.1.5.43953 (per „Zoom-SDK laden“ oder als SDK-Ordner aus der JM-Ablage)
  - Zugangsdaten der Meeting-SDK-App (Datei oder Client-ID und Client-Secret)
  - Ein Zoom-Meeting im eigenen Zoom-Konto, Host im Zoom-Client
  - NDI-Switcher oder NDI-Monitor im selben Netz
equipmentOwner: jm
crewRoles:
  - Media Operator (Zuschaltungen)
  - Host im Zoom-Client (lässt zu, erteilt die Aufnahme-Erlaubnis)
lastReviewed: 2026-10-20
owner: tech@jakobsmedien.com
summary: "Remote-Gäste per Browser und Zoom als feste NDI-Quellen im Switcher: bis zu 16 Zoom-Slots mit eigenem NDI-Namen zeigen je eine Person, den aktiven Sprecher oder die neueste Bildschirmfreigabe. Zoom wird einmal je PC eingerichtet, das Meeting muss im eigenen Zoom-Konto liegen. Nach einem Abriss tritt Connect selbst wieder bei und startet die eingeschalteten Slots neu. Fernsteuerbar per Companion über Port 8737. Unter macOS mit NDI, aber ohne Zoom; NDI-Ausfälle zeigt Connect an der Gastzeile, am Programm-Abzeichen, im Tray und in Companion."
---

## Zutaten

### Voraussetzungen
- Windows 10/11, 64 Bit, für Zoom und NDI. macOS (Apple Silicon oder Intel, installiert über den Launcher) ab Connect 0.4.0 mit NDI: Gäste erscheinen als NDI-Quelle, und der Programm-Rückkanal mit Mix-Minus läuft wie unter Windows; Zoom gibt es unter macOS nicht. Die NDI-Laufzeit liegt im Paket; NDI Tools oder ein NDI-SDK braucht der Rechner nicht.
- macOS, erster Start (Stand vor der Abnahme von 0.4.0): Das Mac-Paket ist nicht signiert. Meldet macOS, es könne JM Connect nicht prüfen, lässt sich die App unter „Systemeinstellungen › Datenschutz & Sicherheit“ freigeben; Rechtsklick und „Öffnen“ helfen ab macOS 15 nicht mehr. Fragt macOS nach dem Zugriff auf das lokale Netzwerk („JM Connect sendet die Gäste als NDI-Quellen ins lokale Netzwerk und empfängt dort das Programm (NDI).“), bitte erlauben; die Einstellung steht unter Systemeinstellungen › Datenschutz & Sicherheit › Lokales Netzwerk. Welche Handgriffe macOS genau verlangt und wann es fragt, ergänzt dieses Handbuch nach der Abnahme.
- JM Connect ab Version 0.4.0, installiert über den Launcher.
- Zoom-SDK 7.1.5.43953: auf JM-eigenen Rechnern per Knopf „Zoom-SDK laden“ (braucht den SDK-Schlüssel), sonst als SDK-Ordner aus der JM-Ablage. Connect kopiert es einmal je PC nach %LOCALAPPDATA%\JM Connect\zoom-laufzeit (rund 315 MB).
- Zugangsdaten der Meeting-SDK-App: die Zugangsdaten-Datei (clientId, clientSecret) oder Client-ID und Client-Secret von Hand. Connect speichert sie verschlüsselt unter diesem Windows-Konto und schickt sie nie in die Cloud.
- Ein Zoom-Meeting im eigenen Zoom-Konto der Meeting-SDK-App. Der Host sitzt im Zoom-Client auf einem zweiten Gerät.
- Kopfhörer am Regieplatz.
- NDI-Switcher (JM Switcher, TriCaster, vMix, OBS) oder NDI-Monitor im selben Netz.

### Netzwerk & Steuerung
- Steuerport 8737 (TCP-Zeilenprotokoll), mDNS-Name jm-connect-ctl (TXT ctl=1). In Companion die Rolle „JM Connect“, für die Zoom-Slots ab Modul 0.3.0 (liegt dem Release von Connect 0.4.0 bei; in Companion über „Import custom module“ importieren).
- Befehle für Browser-Gäste: CONNECT GO · CONNECT NEXT · CONNECT STANDBY <Gast-ID> · CONNECT ONAIR <Gast-ID> · CONNECT OFF <Gast-ID> · CONNECT APPROVE <Gast-ID> · CONNECT TALKBACK on|off|toggle · CONNECT SLIDES <Gast-ID> on|off|toggle · CONNECT KICK <Gast-ID> · STATE?
- Befehle für Zoom-Slots (ab Modul 0.3.0): CONNECT ZOOM_SLOT <Nr> ON|OFF|TOGGLE setzt die Start-Taste eines Slots. CONNECT ZOOM_SLOT_MODE <Nr> teilnehmer|sprecher|freigabe wechselt den Modus; die Quelle bleibt im Switcher. CONNECT ZOOM_SLOT_PERSON <Nr> <Anzeigename> wählt die Person und den Modus Teilnehmer; sie muss nicht im Meeting sein. CONNECT ZOOM_SLOT_AUDIO <Nr> ON|OFF|TOGGLE: OFF macht die Quelle still (auch den Computerton einer Freigabe), ON stellt den vorigen Ton-Stand wieder her (ohne vorigen Stand: Ton an).
- Befehle wie in 0.3.0: CONNECT ZOOM_LOAD <Anzeigename> legt für die Person mit genau diesem Anzeigenamen (Groß- und Kleinschreibung egal, Leerzeichen erlaubt) einen vorübergehenden Slot an und schaltet ihn ein; er gilt bis zum Ende dieses Meetings und wird nie gespeichert. Gibt es schon einen ausgeschalteten Teilnehmer-Slot mit diesem Namen, schaltet ZOOM_LOAD ihn nur für dieses Meeting ein (Kennzeichen „nur dieses Meeting an“); läuft schon einer, ändert sich nichts. CONNECT ZOOM_UNLOAD <Anzeigename> schaltet die Teilnehmer-Slots dieser Person aus: vorübergehende verschwinden, gespeicherte bleiben. CONNECT ZOOM_DELAY <ms> setzt den Bild-Versatz (0 bis 1000). Einen Beitritt per Companion gibt es bewusst nicht.
- STATE der Browser-Gäste: room, connected, guests, lobby, onair, active_label, standby, standby_label, talkback.
- STATE von Zoom: zoom_status (einrichtung, bereit, tritt_bei, warteraum, im_meeting, abriss, verlaesst, fehler), zoom_sources (Anzahl laufender Slots), zoom_live (1, solange mindestens ein Slot läuft), zoom_privilege (Aufnahme-Erlaubnis, 1/0), zoom_alarm (Eingriff nötig, 1/0), zoom_cmd (Ergebnis des letzten Zoom-Befehls: ok oder f1 bis f14), zoom_cmd_rejected (letzter Zoom-Befehl abgelehnt, 1/0). Je Slot n = 1 bis 16: zoom_slot{n}_on (eingeschaltet, auch nur für dieses Meeting), zoom_slot{n}_live (zeigt Bild), zoom_slot{n}_alarm (braucht einen Eingriff), zoom_slot{n}_audio (Ton eingeschaltet, Computerton eingerechnet), zoom_slot{n}_mode (teilnehmer, sprecher, freigabe), zoom_slot{n}_target (wen der Slot gerade zeigt), zoom_slot{n}_state (fehlt, aus, wartet, startet, zeigt, gehalten, ersatz, fehler, zurueckgestellt, stoppt). Namen stehen nur in zoom_slot{n}_target und nur, solange der Slot Bild zeigt; alle übrigen zoom_*-Werte enthalten keinen Namen.
- STATE von NDI (Windows und macOS, in jedem Zustand, auch bei geschlossenem Raum): ndi_sources (Gast-NDI-Quellen, die bestehen), ndi_failed (ausgefallene Gast-NDI-Quellen), ndi_program (Programm-Empfang: aus, sucht, keine_quelle, verbunden, ohne_bild, staut, fehler, neustart, gescheitert), ndi_alarm (1, sobald eine Gast-Quelle ausgefallen ist oder der Programm-Empfang auf fehler, staut, neustart oder gescheitert steht; nicht bei sucht, keine_quelle und ohne_bild, denn dann liegt die Ursache meist außerhalb von Connect).
- Feedbacks: Gast auf Sendung (rot), Gäste im Warteraum (gelb), Talkback (gelb), Zoom-Slots laufen (grün), Zoom braucht einen Eingriff (rot), letzter Zoom-Befehl abgelehnt (gelb); je Slot (Option „Slot (Nr.)“): Zoom-Slot eingeschaltet (gelb), Zoom-Slot zeigt Bild (grün), Zoom-Slot braucht einen Eingriff (rot). Dazu auf beiden Plattformen „Connect: NDI-Ausfall“ (rot, auf ndi_alarm).
- Ab Modul 0.2.0 leuchten „Gast auf Sendung“ und „Gäste im Warteraum“ bei jeder Anzahl über 0, und Namen mit Leerzeichen (active_label, standby_label) kommen ganz an. Ältere Module kennen die Rolle „JM Connect“ nicht. Modul 0.2.0 läuft mit Connect 0.4.0 weiter (ZOOM_LOAD, ZOOM_UNLOAD und ZOOM_DELAY wirken über vorübergehende Slots), zeigt die Slots und die ndi_*-Werte aber nicht.
- JM Rundown kennt die Zoom-Aktionen erst ab seinem nächsten Release; bis dahin steuert er Zoom nicht.

### Browser-Gäste (kurz)
- Raum öffnen (braucht den Cloud-Zugang), für jeden Gast einen Link erzeugen und verschicken.
- Gäste landen im Warteraum: prüfen und freigeben.
- Freigegebene Gäste auf Sendung schalten. Jeder Gast ist eine eigene NDI-Quelle „JM Connect – <Name>“, ein geteilter Bildschirm eine weitere „JM Connect – <Name> (Bildschirm)“, unter Windows wie unter macOS. Ein NDI-Abzeichen an der Gastzeile zeigt den Zustand jeder Quelle.
- Talkback (Regie ins Ohr) für alle oder per Halten-Taste für einen Gast; Programm-Rückkanal mit Mix-Minus je Gast unter Windows und macOS (er kommt über NDI vom Switcher, Quelle mit „JM Switcher“ im Namen).

### Zoom-Slots (kurz)
- Ein Slot ist ein fester Platz mit Nummer (1 bis 16) und eigenem NDI-Namen. Im Switcher ist er eine NDI-Quelle, die bestehen bleibt, auch wenn sich ändert, wen der Slot zeigt.
- Modus je Slot: „Teilnehmer“ (eine gewählte Person), „Aktiver Sprecher“ (wer gerade spricht, nie JM Connect selbst) oder „Bildschirmfreigabe“ (die neueste laufende Freigabe; bei Pause oder stehendem Bildschirm bleibt das letzte Bild stehen).
- Je Slot: Auflösung („360p“, „720p“, „1080p“), Ersatzbild, solange Zoom kein Bild liefert („transparent“, „eingefroren“, „schwarz“, „weiß“), Ton an oder aus mit der Tonart „Mischton“ (alle Mikrofone des Meetings) oder „Person“ (nur die gezeigte Person, nur im Modus Teilnehmer), bei Bildschirmfreigaben zusätzlich „Computerton der Freigabe“.
- Gespeicherte Slots bleiben samt Einstellungen am Rechner und starten im Meeting von selbst, sobald sie eingeschaltet sind und der Host die Aufnahme-Erlaubnis erteilt hat. Vorübergehende Slots (per Companion ZOOM_LOAD) gelten nur bis zum Ende des Meetings.

### NDI-Anzeige (kurz)
- Gastzeile: je NDI-Quelle des Gasts ein Abzeichen; die Abzeichen der Bildschirm-Quelle beginnen mit „Bildschirm: …“. „NDI ●“ heißt, die Quelle sendet; nach der ersten Zählung steht die Zahl der Empfänger dabei, etwa „NDI ● 1 Empfänger“.
- Programm-Abzeichen über der Gästeliste: „Programm ● …“ heißt, das Programm vom Switcher kommt an und geht an die Gäste. Daneben der Link „ndi.video“.
- Fällt eine Quelle oder der Programm-Empfang aus, steht der Grund in einer Zeile darunter, mit „NDI neu starten“ bzw. „Programm neu starten“ und „Logordner öffnen“. Abzeichen und Zeilen stehen auch, solange die Verbindung zum Raum getrennt ist.
- Fußzeile des Hauptfensters (Windows und macOS): der Markenhinweis, „Logordner öffnen“ und „Lizenzbedingungen“.
- Tray: Die Zeile „Gäste“ nennt Ausfälle, startende Quellen und Quellen ohne Bild; der Tooltip nennt „NDI-Ausfall“. „Raum schließen“ im Tray-Menü schließt den Raum wie der Knopf im Fenster.

### Harte Grenzen
- Kein Tally, kein Talkback/IFB und kein Mix-Minus je Zoom-Person: Zoom-Ton ist ein gemeinsamer Kanal. Das ist eine Grenze von Zoom.
- Nur Meetings im eigenen Zoom-Konto. Zwei Gründe, beide von Zoom: Eine nicht im Zoom Marketplace veröffentlichte App kommt nicht in Meetings fremder Konten (Code 63), und seit 02.03.2026 verlangt Zoom dafür zusätzlich ein OBF-Token (Codes 503/504).
- Ohne Aufnahme-Erlaubnis des Hosts läuft kein Slot. Entzieht der Host sie, stoppt Connect sofort Bild und Ton aller Slots.
- Bis zu 16 Slots; gemessen sind 5 gleichzeitig laufende. Beim Einschalten des 6. fragt Connect einmal nach („Trotzdem einschalten“); die Zustimmung gilt, bis wieder höchstens 5 Slots eingeschaltet sind. Über Companion fragt Connect nicht nach: ZOOM_SLOT … ON und ZOOM_LOAD schalten auch den 6. und jeden weiteren Slot ein, setzen die Zustimmung und melden unter „Hinweise“ „Companion: 6. Slot eingeschaltet — mehr als 5 sind nicht gemessen.“ (zoom_cmd f8, nicht abgelehnt). Ob dieser Rechner mehr schafft, zeigen die Messwerte.
- Rückkehr nur bei eindeutigem Namen: Verlässt die gezeigte Person das Meeting und kommt wieder, zeigt der Slot sie von selbst wieder, aber nur, wenn ihr Anzeigename im Meeting eindeutig ist; sonst wählt der Bediener an der Kachel („Welche Person?“).
- 1080p nur, soweit Zoom liefert: Die Messzeile der Kachel zeigt, was wirklich ankommt, zum Beispiel „1080p gewünscht · Zoom liefert 1280×720 · 30 Bilder/s“.
- Kopfhörer tragen: Lautsprecher im selben Raum wie ein abonniertes Mikrofon erzeugen Echo.
- Kein Dolmetscherton, kein Ton zurück nach Zoom.
- Die Vorschau in der Kachel zeigt etwa 2 Bilder pro Sekunde und ohne Bild-Versatz; Bild und Ton im Takt zeigt nur der Switcher oder NDI-Monitor. Bildschirmfreigaben senden ohne Bild-Versatz.
- Zoom-Slots nur unter Windows: Unter macOS steht an der Stelle der Zoom-Karte „Zoom-Slots gibt es nur unter Windows: Die Zoom-Bridge läuft nur dort.“
- Zoom nur unter Windows. Das Mac-Paket hat NDI (Gäste als NDI-Quellen, Programm-Rückkanal), aber keine Zoom-Karte; es ist nicht signiert.
- Fällt ein NDI-Prozess wiederholt aus, startet Connect ihn höchstens dreimal hintereinander von selbst neu; danach nur per „NDI neu starten“ bzw. „Programm neu starten“.
- Die SDK-Fassung ist fest (7.1.5.43953). Lehnt Zoom sie ab, hilft nur ein neuer Connect-Release.
- JM Rundown kennt die Zoom-Aktionen erst ab seinem nächsten Release.

### Logs und Datenschutz
- JM Connect merkt sich die Meeting-Nummer des letzten Beitritts im Klartext in connect-settings.json (%APPDATA%\JM Connect), den Kenncode nur mit der Windows-Verschlüsselung. Beides steht nach „Schließen“ und nach einem Neustart wieder bereit, bis neue Daten eingetragen werden; „Vergessen“ löscht beides. Ins Log und in den Companion-Status kommen Meeting-Nummer und Kenncode nie.
- Das Log nennt Zoom-Teilnehmer und Browser-Gäste nur mit ihrer Kennung, nie mit dem Anzeigenamen, und Slots nur mit Nummer und Modus. Karte, Companion-Variable zoom_slot{n}_target und NDI-Namen zeigen die Namen weiter.
- Teilnehmer-Slots speichern den Anzeigenamen ihrer Person am Rechner (in connect-settings.json unter %APPDATA%\JM Connect), damit der Slot sie im nächsten Meeting wiederfindet. Vorübergehende Slots (ZOOM_LOAD) und Namen aus einer Umbenennung im Meeting speichert Connect nie.
- „Messwerte kopieren“ legt die Messwerte ohne Teilnehmer- und ohne NDI-Namen in die Zwischenablage (Slots als Nummer und Modus, Personen als Kennung).
- Alle Suite-Apps löschen Logzeilen, die älter als 14 Tage sind, 30 Sekunden nach dem Start und danach alle 6 Stunden, jeweils ab ihrem nächsten Release. Ein zweiter Start einer schon laufenden App räumt nicht auf.
- Den Logordner öffnet „Logordner öffnen“ in der Fußzeile des Hauptfensters (Windows und macOS), an jeder Zeile eines NDI-Ausfalls und in der Zoom-Karte (nur Windows). Den Pfad unter macOS ergänzt dieses Handbuch nach der Abnahme (Stand vor der Abnahme von 0.4.0).
- Ausfälle der NDI-Quellen und des Programm-Empfangs stehen im Log mit Schlüssel, Grund, Exit-Code, PID und Neustart-Zähler, ohne Gast- und ohne NDI-Namen. Erkennt Connect eine Takt-Lücke (Hänger oder Ruhezustand des Rechners), steht sie mit ihrer Länge im Log („Takt-Lücke … ms“), ebenfalls ohne Namen.

### Deinstallieren
- Der Laufzeit-Ordner bleibt beim Deinstallieren liegen. Bei Bedarf %LOCALAPPDATA%\JM Connect\zoom-laufzeit von Hand löschen.
- Das Zoom-SDK legt selbst %APPDATA%\ZoomSDK an. Auch dieser Ordner bleibt und lässt sich von Hand löschen.

### Lizenz und Marke
- „Lizenzbedingungen“ in der Fußzeile des Hauptfensters öffnet die Lizenzbedingungen von JM Connect (LIZENZ.txt im Paket, Windows und macOS). Sie gelten für jede Nutzung und enthalten die Bedingungen für die enthaltene NDI-Laufzeit.
- Neben der NDI-Laufzeit liegt im Paket ihr Lizenztext für Drittbibliotheken: unter Windows Processing.NDI.Lib.Licenses.txt in resources\bin\win, unter macOS die Lizenzdatei des NDI-SDK für Apple in Contents/Resources/bin/mac.
- NDI® is a registered trademark of Vizrt NDI AB.
- Mehr zu NDI: ndi.video (https://ndi.video/). In Connect öffnet der Link „ndi.video“ über der Gästeliste und im Kopf der Zoom-Slots diese Seite.

## Schritt-für-Schritt

### Einrichtung
- Unter macOS gibt es keine Zoom-Karte; die Zoom-Schritte dieses Abschnitts entfallen dort. Beim ersten Start die Hinweise unter „Voraussetzungen“ beachten (Freigabe der App, lokales Netzwerk).
- Programm-Rückkanal: Im JM Switcher den NDI-Ausgang „JM Switcher“ einschalten. Connect sucht nach „Raum öffnen“ eine NDI-Quelle mit diesem Namen und zeigt sie über der Gästeliste („Programm ● …“).
- Zoom-Karte, Knopf „Einrichtung“ aufklappen. Zoom bleibt gesperrt, bis Zoom-SDK und Zugangsdaten eingerichtet sind.
- Zoom-SDK auf JM-eigenen Rechnern: unter „SDK-Schlüssel“ auf „Eintragen …“, den Schlüssel einfügen und speichern, dann „Zoom-SDK laden“ (rund 143 MB, mit Fortschritt und „Abbrechen“).
- Zoom-SDK ohne Schlüssel: „SDK-Ordner wählen …“ und den SDK-Ordner aus der JM-Ablage wählen (den Ordner mit dem Unterordner x64\bin). Danach steht dort „Zoom-SDK 7.1.5.43953 eingerichtet“.
- Zugangsdaten: „Datei wählen …“ oder „Eintragen …“ (Client-ID und Client-Secret). Danach steht dort „hinterlegt (Client-ID endet auf …)“.
- „Einrichtung prüfen“ meldet sich ohne Meeting bei Zoom an. Erwartet: „Einrichtung in Ordnung: Zoom-SDK 7.1.5 (43953), Anmeldung bei Zoom erfolgreich.“
- Vor der Show den Bild-Versatz eintragen (Wert aus dem Klatschtest). Er gilt für Teilnehmer- und Sprecher-Slots, nicht für Bildschirmfreigaben. Erscheint darunter „Nur für diese Sitzung gemerkt …“, ließ sich die Einstellungsdatei nicht schreiben: Der Wert gilt bis zum Beenden von Connect und muss danach neu eingetragen werden.
- Zoom-Slots anlegen (geht auch ohne Meeting): „Slot hinzufügen“, an der Kachel „Einstellungen“ aufklappen und „NDI-Name“ (so heißt die Quelle im Switcher, 1 bis 60 Zeichen, ohne Doppelpunkt), „Modus“, „Person“ (nur Teilnehmer: der Anzeigename in Zoom), „Auflösung“, „Ersatzbild“ und „Ton“ setzen. Jede Änderung wird sofort gespeichert und wirkt im Meeting sofort.
- Mit „Start“ den Slot einschalten, mit „Stopp“ aus. Den NDI-Namen ändern und den Slot löschen geht nur bei ausgeschaltetem Slot.
- Im Kopf der Zoom-Slots: „Vorgaben …“ legt Auflösung und Ton für neue Slots fest, „Sprecher-Einstellungen …“ das Sprecher-Signal und die Haltezeit (0 bis 5 s; so lange muss jemand sprechen, bevor der Sprecher-Slot wechselt), der Schalter „Vorschau“ die Vorschau aller Kacheln.
- Nach dem Update von 0.3.0 ist die Slot-Liste leer („Noch keine Slots. …“). Ein Switcher-Eingang aus 0.3.0 („JM Connect – Zoom <Name>“) bekommt sein Bild wieder, wenn die Person im Meeting mit „Als Slot laden“ geladen wird: Der Slot bekommt den bisherigen NDI-Namen.
- Vor der Show mit dem Host absprechen: „JM Connect“ aus dem Warteraum zulassen und die Aufnahme-Erlaubnis erteilen, nach einem Wiederbeitritt gegebenenfalls erneut. Kopfhörer bereitlegen.

### Während
- Meeting-Nummer, Kenncode (darf leer bleiben) und Anzeigename (Vorgabe „JM Connect“) eingeben, „Beitreten“. Das Kenncode-Feld leert sich sofort.
- Im Warteraum muss der Host „JM Connect“ zulassen. Danach fragt Connect die Aufnahme-Erlaubnis an; der Host erteilt sie im Zoom-Client.
- Slots starten: Nach der Aufnahme-Erlaubnis starten die eingeschalteten Slots von selbst. Eine Person aus der Teilnehmerliste: „Als Slot laden“ legt einen gespeicherten Teilnehmer-Slot „JM Connect – Zoom <Name>“ an und schaltet ihn ein (ab dem 6. eingeschalteten Slot erst nach der Nachfrage). Zeigt schon ein Slot die Person, steht in ihrer Zeile „läuft in Slot …“.
- Jede Kachel sagt im Klartext, was der Slot zeigt, zum Beispiel „Zeigt Anna.“, „Wartet auf Anna · Ersatzbild transparent“ oder „Anna: Kamera aus · Ersatzbild transparent“; darunter Auflösung und Bildrate („720p · Zoom liefert 1280×720 · 30 Bilder/s“), den Ton und gegebenenfalls einen Fehler.
- Name doppelt im Meeting: Die Kachel zeigt „Name doppelt: „Anna“ ist 2-mal im Meeting. Bitte unten die richtige Person wählen. · Ersatzbild transparent“; unter „Welche Person?“ die richtige wählen. Connect hängt nie von selbst auf eine Person gleichen Namens um: lieber ein Handgriff als die falsche Person auf Sendung.
- Modus am laufenden Slot wechseln: unter „Einstellungen“ den Modus wählen; die Quelle bleibt im Switcher bestehen, nur das Bild wechselt. Ebenso wirken Person, Auflösung, Ersatzbild und Ton sofort, ohne Neustart der Quelle.
- Verbindung weg: Erst versucht Zoom selbst, neu zu verbinden („Verbindung unterbrochen …“). Gelingt das nicht, tritt Connect mit bis zu 5 Versuchen neu bei (nach 2, 5, 10, 20 und 30 s, mit Countdown in der Karte). „Abbrechen“ beendet die Versuche, „Erneut beitreten“ startet später mit denselben Daten.
- Nach dem Wiederbeitritt muss der Host gegebenenfalls wieder zulassen und die Aufnahme-Erlaubnis erteilen. Dann startet Connect alle eingeschalteten Slots von selbst, mit denselben Einstellungen und demselben NDI-Namen; unter „Hinweise“ steht „Wieder im Meeting. … laufen wieder.“
- Verlässt die gezeigte Person das Meeting, zeigt der Slot sein Ersatzbild („Wartet auf Anna · Ersatzbild transparent“), und zoom_alarm steht auf 1. Kommt sie zurück, zeigt der Slot sie wieder, ohne dass die Quelle im Switcher verschwindet (bei eindeutigem Namen).
- Ein Slot auf eine Person, die in diesem Meeting nicht dabei ist, wartet still auf sie und hebt zoom_alarm nicht. Braucht ein Slot einen Eingriff (Name doppelt, Aufbau gescheitert, keine Antwort der Zoom-Bridge, Abo abgelehnt), nennt seine Kachel Grund und Handgriff, und zoom_alarm und zoom_slot{n}_alarm stehen auf 1.
- Entzieht der Host die Aufnahme-Erlaubnis, stoppt Connect sofort Bild und Ton aller Slots („Gestoppt: Der Host hat die Aufnahme-Erlaubnis entzogen. …“). Erteilt er sie wieder, startet Connect die eingeschalteten Slots von selbst.
- Companion: Die Slot-Befehle wirken wie Start-Taste, Modus, Person und Ton der Kachel, nur ohne Nachfrage: Wird damit der 6. oder ein weiterer Slot eingeschaltet, schaltet Connect ihn ein und meldet „Companion: … Slot eingeschaltet — mehr als 5 sind nicht gemessen.“ (zoom_cmd f8). Ein per ZOOM_LOAD angelegter Slot trägt an der Kachel das Kennzeichen „vorübergehend“ mit dem Knopf „Behalten“; „Behalten“ macht ihn zu einem gespeicherten Slot. Leuchtet „letzter Zoom-Befehl abgelehnt“, steht der Grund unter „Hinweise“ in der Karte.
- „Messwerte“ (aufklappbar, unter den Slots) zeigt Last, Auflösung, Bildrate und Ton je Slot sowie die Sprecher-Signale; „Messwerte kopieren“ legt sie ohne Namen in die Zwischenablage, etwa für einen Fehlerbericht.

- NDI im Blick behalten: „NDI ●“ an jeder Gast-Quelle und „Programm ● …“ über der Gästeliste heißen, alles läuft; was die übrigen Anzeigen bedeuten, steht in der Pannenhilfe.
- Fällt eine Gast-Quelle aus, startet Connect sie von selbst neu, höchstens dreimal hintereinander; danach „NDI neu starten“ an der Zeile des Ausfalls. Ebenso „Programm neu starten“ für den Programm-Empfang.
- Reißt die Verbindung zum Raum ab, bleibt die Gästeliste mit dem letzten Stand stehen; Gäste steuern, Talkback, Folien und Einladen sind gesperrt, bis Connect wieder verbunden ist. „Raum schließen“ (im Fenster; im Tray, solange Gast-Quellen eingetragen sind), „NDI neu starten“, „Programm neu starten“, „Logordner öffnen“ und „Lizenzbedingungen“ bleiben bedienbar.
- Die Anmeldung von Connect am Raum gilt 8 Stunden ab dem letzten „Raum öffnen“. Reißt die Verbindung danach ab, versucht Connect es für die Bedienung nicht weiter („Verbindung zum Raum beendet: …“): dann „Raum öffnen“ wählen, nicht „Raum schließen“. „Raum öffnen“ meldet Connect neu an, ohne einen verteilten Link ungültig zu machen; die Gäste bleiben im Raum.
### Nachbereitung
- „Meeting verlassen“ (bei laufenden Slots fragt der Knopf einmal nach) oder Connect über das Tray beenden. Beides verlässt das Meeting sauber; die Zoom-Quellen verschwinden aus dem Switcher. Gespeicherte Slots bleiben samt Einstellungen für das nächste Meeting; vorübergehende sind weg, und per ZOOM_LOAD nur für dieses Meeting eingeschaltete Slots sind wieder aus.
- Nach einer Fehlermeldung schließt „Schließen“ die Meldung; die gemerkte Meeting-Nummer steht danach wieder im Feld, vorübergehende Slots verschwinden.
- Bei Störungen „Logordner öffnen“ und main.log sichern. Es enthält weder Teilnehmernamen noch Kenncode noch Meeting-Nummer.

## Profi-Tipps
- Companion-Tasten je Slot-Nummer anlegen, zum Beispiel ZOOM_SLOT 1 TOGGLE mit dem Feedback „Zoom-Slot zeigt Bild“ für Slot 1: Slot-Nummern und NDI-Namen bleiben über Meetings gleich, Zooms Teilnehmer-Kennungen nicht. Eine Person auf einen Slot legen: ZOOM_SLOT_PERSON 1 Anna Maria Beispiel.
- Eine Companion-Taste fragt beim 6. eingeschalteten Slot nicht nach: Sie schaltet ihn ein und meldet nur die Warnung „Companion: 6. Slot eingeschaltet — mehr als 5 sind nicht gemessen.“ (zoom_cmd f8). Wer das vermeiden will, legt Start-Tasten auf höchstens 5 Slots.
- Doppelte Namen vorher vermeiden: Teilnehmer bitten, sich in Zoom eindeutig zu benennen (Handys heißen oft gleich, etwa „Samsung SM-…“). Sonst wählt der Bediener an der Kachel, mit Absicht: lieber ein Handgriff als die falsche Person.
- Das Feedback „Zoom braucht einen Eingriff“ (zoom_alarm) auf eine Taste legen. Es leuchtet bei Abriss, Fehler, fehlender Aufnahme-Erlaubnis und solange ein Slot einen Eingriff braucht; „Zoom-Slot braucht einen Eingriff“ zeigt dasselbe je Slot.
- Einen Browser-Gast nie so nennen wie den NDI-Namen eines Slots: Dann senden zwei Quellen unter demselben NDI-Namen. Die Kachel warnt („NDI-Name doppelt: Ein Browser-Gast sendet ebenfalls als …“).
- Den Versatz einmal je Raum mit dem Klatschtest messen; er gilt für alle Teilnehmer- und Sprecher-Slots, nicht für Bildschirmfreigaben.
- Für Bildschirmfreigaben einen eigenen Slot im Modus „Bildschirmfreigabe“ anlegen: Er zeigt immer die neueste Freigabe, ohne dass jemand die teilende Person wählen muss.
- Die Vorschau kostet Rechenzeit: Bei vielen Slots den Schalter „Vorschau“ ausschalten; bei minimiertem Fenster ist sie ohnehin aus.
- Das Feedback „Connect: NDI-Ausfall“ (ndi_alarm) auf eine Taste legen: Es leuchtet, sobald eine Gast-Quelle ausgefallen ist oder der Programm-Empfang hängt oder ausfällt, unter Windows und macOS. „NDI: kein Bild“ allein hebt es nicht, weil die Ursache dann meist außerhalb von Connect liegt (Switcher-Ausgang, Netz, Gast).
- Notfallweg: Das Einzelpaket zoom-bridge-v0.1.0 bleibt bis zur ersten Live-Show mit Connect verfügbar.

## Pannenhilfe

| Meldung | Ursache und Abhilfe |
| --- | --- |
| „In diesem Ordner liegt kein Zoom-SDK …“ | Falscher Ordner. Den entpackten SDK-Ordner (mit Unterordner x64\bin) oder direkt x64\bin wählen. |
| „Das ist die 32-Bit-Fassung des Zoom-SDK …“ | Der Ordner x86\bin ist gewählt. Den Ordner x64\bin oder den SDK-Ordner darüber wählen. |
| „Dieses Zoom-SDK hat die Fassung … Diese Connect-Fassung braucht genau 7.1.5.43953 …“ | Andere SDK-Fassung. Das SDK 7.1.5.43953 aus der JM-Ablage wählen oder „Zoom-SDK laden“. Eine andere Fassung braucht einen neuen Connect-Release. |
| „Die Fassung des Zoom-SDK lässt sich nicht lesen …“ | Die sdk.dll ist verändert oder beschädigt. Das unveränderte SDK aus der JM-Ablage wählen. |
| „Im SDK-Ordner liegt eine Datei, die wie eine Connect-Datei heißt …“ | Kein unverändertes Zoom-SDK, zum Beispiel ein Ordner des Einsatzpakets. Das SDK aus der JM-Ablage wählen. |
| „Für die Kopie des Zoom-SDK fehlt Platz …“ | Auf dem Laufwerk von %LOCALAPPDATA% ist zu wenig frei (Kopie rund 315 MB, beim Laden zusätzlich ZIP und Entpackordner). Platz schaffen und erneut versuchen. |
| „Das Zoom-SDK ließ sich nicht kopieren (…)“ | Lese- oder Schreibfehler, oft Virenschutz oder ein gesperrter Ordner. Die alte Einrichtung bleibt. Grund in Klammern prüfen, erneut wählen. |
| „Die Kopie des Zoom-SDK ist unvollständig …“ | Die Nachprüfung fand nicht alle Dateien. Den Ordner erneut wählen. |
| „Dieser Connect-Installation fehlt die Zoom-Bridge …“ | Die Installation ist beschädigt. JM Connect über den Launcher neu installieren. |
| „Die Zoom-Laufzeit auf diesem PC ist unvollständig (…)“ | Eine Datei im Laufzeit-Ordner fehlt oder ist verändert (Virenschutz, Aufräumprogramm). Den SDK-Ordner erneut wählen oder „Zoom-SDK laden“. |
| „Während Zoom läuft oder das Zoom-SDK geladen oder kopiert wird, lässt sich die Einrichtung nicht ändern.“ | Sperre, solange ein Meeting läuft, die Zoom-Bridge noch abbaut oder das SDK geladen oder kopiert wird. Erst das Meeting verlassen oder das Ende der Kopie abwarten. |
| „Für „Zoom-SDK laden“ fehlt der SDK-Schlüssel …“ | Unter „SDK-Schlüssel“ den Schlüssel eintragen. Ihn gibt es nur für JM-eigene Rechner; sonst den SDK-Ordner wählen. |
| „Der Proxy hat den SDK-Schlüssel abgelehnt …“ | Der Schlüssel ist falsch. Entfernen und neu eintragen. |
| „Der Proxy ist nicht erreichbar (…)“ | Kein Netz oder der Proxy ist gestört. Netz prüfen oder den SDK-Ordner von Hand wählen. |
| „Auf dem Proxy liegt kein passendes Zoom-SDK …“ | Das Paket fehlt in der Ablage. Den SDK-Ordner von Hand wählen und den Owner informieren. |
| „Das geladene Zoom-SDK ließ sich nicht entpacken …“ (auch: nicht laden, falsche Prüfsumme) | Abbruch, beschädigte Datei oder Platz, Rechte, Virenschutz, Pfadlänge (die Meldung von tar.exe steht im Log). Die alte Einrichtung bleibt. Erneut laden oder den Ordner von Hand wählen. |
| „zoom-bridge.exe fehlt im Laufzeit-Ordner …“ | Der Laufzeit-Ordner ist unvollständig. Den SDK-Ordner erneut wählen. |
| „Windows hat den Start der Zoom-Bridge verhindert …“ | Virenschutz oder Smart App Control blockiert die unsignierte zoom-bridge.exe. Eine Ausnahme für %LOCALAPPDATA%\JM Connect\zoom-laufzeit eintragen lassen. |
| „Die Zoom-Bridge ist beim Start gestorben: Eine DLL …“ (0xC0000135, 0xC0000139, 0xC000007B) | Eine DLL fehlt, ist zu alt oder kein 64-Bit-Programm. Mit den Zugangsdaten hat das nichts zu tun. Den SDK-Ordner erneut wählen. |
| „Die Zoom-Bridge hat sich beendet, bevor Zoom die Anmeldung beantwortet hat …“ | Absturz beim Start. Details im Log; erneut versuchen, sonst das SDK neu einrichten. |
| „Die Zoom-Laufzeit meldet die Fassung …“ | Laufzeit und Connect passen nicht zusammen. Den SDK-Ordner erneut wählen. |
| „Das Zoom-SDK ließ sich nicht starten …“ oder „Auf diesem PC läuft schon ein anderes Programm mit dem Zoom-Meeting-SDK …“ | Meist läuft noch das Einsatzpaket zoom-join. Das andere Programm beenden und erneut versuchen; sonst Details im Log. |
| „Zoom hat die Anmeldung abgelehnt: Client-ID oder Client-Secret stimmen nicht …“ | Falsche Zugangsdaten. Datei oder Eingabe prüfen und neu hinterlegen. |
| „Zoom hat die Anmeldung abgelehnt: Das Anmelde-Token passt nicht …“ | Meist falsche Zugangsdaten, sonst geht die Uhr dieses PCs falsch. Zugangsdaten prüfen, Uhrzeit synchronisieren. |
| „Das Zoom-Konto der App darf das Meeting-SDK nicht nutzen …“ | Einstellung im Zoom-Konto. Das klärt der Inhaber des Zoom-Kontos. |
| „Zoom ist gerade nicht erreichbar …“ | Netz oder Zoom gestört. Netz prüfen, erneut versuchen. |
| „Zoom lässt diese SDK-Fassung nicht mehr zu …“ | Zoom hat die Fassung 7.1.5 abgelöst. Es braucht einen neuen Connect-Release mit neuer SDK-Fassung; bis dahin kein Zoom. |
| „Zu viele Anmeldungen in kurzer Zeit …“ | Zoom drosselt. Einige Minuten warten. |
| „Zoom hat die Anmeldung abgelehnt (…)“ | Anderer Grund, Code in Klammern. Log sichern und den Owner informieren. |
| „Zoom hat auf die Anmeldung nicht geantwortet (30 s) …“ | Keine Verbindung zu Zoom. Netz und Firewall prüfen, erneut versuchen. |
| „Zugangsdaten fehlen — bitte eintragen oder die Datei wählen.“ | Noch keine Zugangsdaten hinterlegt. Unter „Zugangsdaten“ eintragen oder die Datei wählen. |
| „Das Zoom-SDK hat die Anmeldung sofort abgewiesen …“ | Das SDK selbst lehnt ab, nicht das Netz. Details im Log; die Zugangsdaten neu hinterlegen. |
| „Beitritt gescheitert: falscher Kenncode.“ | Kenncode prüfen und erneut beitreten. |
| „Beitritt gescheitert: Dieses Meeting gibt es nicht …“ | Meeting-Nummer prüfen. |
| „… Das Meeting gehört nicht zum Zoom-Konto dieser App …“ | Harte Grenze: JM Connect kommt nur in Meetings des eigenen Zoom-Kontos. Das Meeting im eigenen Konto anlegen. |
| „… Zoom verlangt für dieses Meeting einen Beitritt im Namen eines angemeldeten Nutzers (OBF-Token) …“ | Das Meeting gehört einem fremden Konto. Das kann Connect nicht; das Meeting im eigenen Konto anlegen. |
| „Der Host hat zugelassen, aber Zoom hat den Einlass in 30 s nicht abgeschlossen …“ | Das Netz ist beim Einlass aus dem Warteraum zu langsam. Netz prüfen, erneut beitreten. |
| „Keine Aufnahme-Erlaubnis — der Host muss sie im Zoom-Client erteilen.“ | Der Host hat die Erlaubnis noch nicht erteilt. Im Zoom-Client erteilen lassen; Connect merkt es von selbst. |
| „Aufnahme-Erlaubnis vom Host entzogen, Slots gestoppt …“ | Der Host hat die Erlaubnis entzogen; Connect hat Bild und Ton aller Slots sofort gestoppt. Erteilt der Host sie wieder, startet Connect die eingeschalteten Slots von selbst. |
| „NDI ließ sich in der Zoom-Bridge nicht starten …“ | Die NDI-Laufzeit fehlt oder ist gestört. Details im Log; JM Connect neu installieren. |
| „NDI-Name doppelt: Ein Browser-Gast sendet ebenfalls als …“ (an der Kachel) | Ein Browser-Gast heißt wie der NDI-Name eines Slots; im Switcher ist nicht sicher, welche Quelle ankommt. Einen der beiden umbenennen. |
| „Name doppelt: „…“ ist …-mal im Meeting. Bitte unten die richtige Person wählen. …“ | Zwei Personen tragen denselben Anzeigenamen. Unter „Welche Person?“ an der Kachel die richtige wählen oder die Personen umbenennen lassen. Connect wählt nie von selbst. |
| „„…“ hat das Meeting verlassen; eine andere Person mit diesem Namen ist noch da. …“ | Die gezeigte Person ist gegangen, eine gleichnamige war schon vorher da; Connect springt nicht auf sie. Ist sie gemeint, unter „Welche Person?“ wählen. |
| „Nicht gestartet: mehr als 5 Slots ohne Bestätigung. …“ | Mehr als 5 Slots sind eingeschaltet, aber die Zustimmung fehlt (etwa nach einer von Hand geänderten Einstellungsdatei); die ersten 5 laufen. Einmal „Stopp“ und wieder „Start“, dann „Trotzdem einschalten“. |
| „Mehr als 5 Zoom-Slots gleichzeitig sind nicht gemessen. …“ | Nachfrage beim 6. eingeschalteten Slot. „Trotzdem einschalten“ schaltet ihn ein; ob der Rechner es schafft, zeigen die Messwerte. |
| „Höchstens 16 Slots. Zuerst einen Slot löschen.“ | Alle 16 Nummern sind belegt, vorübergehende Slots eingerechnet. Einen ausgeschalteten Slot löschen. |
| „Wartet auf die Aufnahme-Erlaubnis des Hosts.“ (an der Kachel) | Der Host hat die Aufnahme-Erlaubnis noch nicht erteilt. Im Zoom-Client erteilen lassen; die eingeschalteten Slots starten dann von selbst. |
| „Wartet auf … · Ersatzbild …“ | Die Person des Slots ist nicht im Meeting oder hat es verlassen. Kommt sie mit eindeutigem Namen, zeigt der Slot sie von selbst. Ist der Name falsch geschrieben, unter „Einstellungen“ bei „Person“ berichtigen. |
| „Wartet auf … (im Warteraum) · Ersatzbild …“ | Die Person wartet im Warteraum. Der Host lässt sie im Zoom-Client zu. |
| „Keine Person gewählt · Ersatzbild …“ | Teilnehmer-Slot ohne Person. Unter „Einstellungen“ bei „Person“ den Anzeigenamen eintragen. |
| „…: Kamera aus · Ersatzbild …“ | Zoom meldet die Kamera der Person als aus. Kein Fehler; der Slot zeigt wieder Bild, sobald die Kamera an ist. |
| „…: Zoom liefert gerade kein Bild · Ersatzbild …“ | Zoom liefert kein Bild, obwohl die Kamera als an gilt (Netz der Person oder Zoom selbst). Abwarten; bleibt es, die Person bitten, die Kamera aus- und wieder einzuschalten. |
| „…: erstes Bild steht noch aus · Ersatzbild …“ | Der Slot ist gestartet oder hat umgeschaltet, das erste Bild kommt noch. Bleibt es länger, die Messwerte ansehen. |
| „…: Zoom hat das Abo abgelehnt (…) · Ersatzbild …. Für einen neuen Versuch „Stopp“ und wieder „Start“.“ | Zoom hat das Bild dieses Slots verweigert (Grund in Klammern). Connect versucht es nicht von selbst neu. „Stopp“, dann „Start“; scheitert es wieder, einen Slot weniger betreiben und „Messwerte kopieren“ sichern. |
| „Keine Antwort der Zoom-Bridge. Für einen neuen Versuch „Stopp“ und wieder „Start“.“ | Die Zoom-Bridge hat das Starten dieses Slots nicht binnen 10 s beantwortet. „Stopp“, dann „Start“; bleibt die Antwort aus, „Logordner öffnen“ und main.log sichern. |
| „Gescheitert: Der Slot ließ sich nicht aufbauen (…). Details im Log. …“ | Der Aufbau des Slots ist gescheitert (Grund in Klammern). Connect startet ihn nicht von selbst neu. „Stopp“, dann „Start“; Details im Log. |
| „Wartet auf eine sprechende Person · Ersatzbild …“ | Sprecher-Slot: Noch hat niemand gesprochen, den der Slot zeigen darf. Unter „Sprecher-Einstellungen …“ ein anderes Signal versuchen. |
| „Wartet auf eine Bildschirmfreigabe · Ersatzbild …“ | Freigabe-Slot: Niemand teilt gerade. Kein Fehler. |
| „Freigabe von … pausiert · letztes Bild gehalten“ oder „… unverändert · letztes Bild gehalten“ | Die Freigabe ist pausiert bzw. der Bildschirm steht; der Slot hält das letzte Bild. Kein Fehler. |
| „… gewünscht · Zoom liefert …“ (Messzeile) | Zoom liefert eine kleinere Auflösung als gewählt (Netz, Zoom-Konto ohne HD, viele Slots). Kein Fehler von Connect; die Kachel zeigt ehrlich, was ankommt. |
| „Ton: Person-Ton gibt es nur im Modus Teilnehmer. …“ | Tonart „Person“ in einem Sprecher- oder Freigabe-Slot. Unter „Einstellungen“ „Mischton“ wählen oder den Modus Teilnehmer. |
| „Ton nicht verfügbar (…) — das Bild läuft ohne Ton. …“ | Zoom hat den Ton verweigert. Den Ton des Slots aus- und wieder einschalten. |
| „Vorschau nicht verfügbar (…). Bild und Ton laufen unverändert.“ | Die Vorschau ließ sich auf diesem Rechner nicht einrichten. Nur die Kacheln sind betroffen, die NDI-Quellen laufen. |
| „Der NDI-Name muss 1 bis 60 Zeichen lang sein.“, „Ein Doppelpunkt ist im NDI-Namen nicht erlaubt …“, „Diesen NDI-Namen trägt schon Slot …“, „Steuerzeichen sind im NDI-Namen nicht erlaubt.“ | Der NDI-Name ist ungültig oder schon vergeben. Einen anderen Namen eintragen: 1 bis 60 Zeichen, ohne Doppelpunkt, eindeutig unter den Slots. |
| „Die Einstellungen von Connect waren unlesbar. …“ | connect-settings.json war beschädigt. Connect hat sie gesichert (Name im Text) und arbeitet mit den Vorgaben; fehlende Slots neu anlegen. |
| „… gespeicherte Slots waren unvollständig oder doppelt …“ | Einträge in connect-settings.json waren ungültig, etwa nach einer Änderung von Hand. Die übrigen Slots sind da; fehlende neu anlegen. |
| „Verbindung unterbrochen. Zoom versucht selbst, neu zu verbinden …“ | Das Netz war kurz weg. Abwarten: Zoom verbindet selbst, die Slots laufen danach weiter. |
| „Verbindung zum Meeting verloren. Wiederbeitritt … von 5 …“ | Connect tritt selbst neu bei. Netz prüfen; „Abbrechen“ beendet die Versuche. |
| „Wiederbeitritt gescheitert (…). „Erneut beitreten“ versucht es noch einmal.“ | Alle 5 Versuche sind gescheitert, der letzte Grund steht in Klammern. Netz prüfen, dann „Erneut beitreten“. |
| „Wiederbeitritt abgebrochen.“ | „Abbrechen“ wurde gedrückt. „Erneut beitreten“ startet neu; danach starten die eingeschalteten Slots wieder. |
| „Wiederbeitritt abgebrochen: …“ | Ein Versuch ist endgültig gescheitert, der Grund steht dahinter (zum Beispiel abgelehnte Zugangsdaten oder ein Fehler beim Start der Zoom-Bridge). Den Grund beheben, dann „Erneut beitreten“; die eingeschalteten Slots starten danach wieder. Details im Log. |
| „Meeting beendet: …“ | Der Host hat das Meeting beendet. „Erneut beitreten“, sobald er es neu startet, sonst „Schließen“. |
| „Nur für diese Sitzung gemerkt — die Einstellungsdatei ließ sich nicht schreiben.“ (unter dem Versatz oder in der Zoom-Karte) | connect-settings.json ist schreibgeschützt oder gesperrt. Versatz und Slots gelten bis zum Beenden von Connect. Schreibrechte im Ordner %APPDATA%\JM Connect prüfen. |
| „NDI startet …“ (Gastzeile) | Der NDI-Prozess der Quelle startet. Meldet er sich nicht binnen 10 s, beendet Connect ihn und nennt den Grund („Der NDI-Prozess meldete sich nicht binnen 10 s.“). |
| „NDI ● kein Empfänger“ | Die Quelle sendet, aber kein Switcher hat sie gewählt. Im Switcher den Eingang „JM Connect – <Name>“ wählen. Unter macOS zusätzlich den Zugriff auf das lokale Netzwerk prüfen (Systemeinstellungen › Datenschutz & Sicherheit › Lokales Netzwerk). |
| „NDI: kein Bild“ | Die Quelle besteht, aber seit über 3 s kam kein Bild des Gasts an, etwa weil seine Kamera im Browser aus ist oder sein Netz hängt. Den Gast bitten, Kamera und Netz zu prüfen; sobald wieder Bilder kommen, steht wieder „NDI ●“. |
| „NDI ausgefallen · Neustart … von 3 …“ | Der NDI-Prozess der Quelle ist ausgefallen. Connect startet ihn nach 1 s von selbst neu, höchstens dreimal hintereinander; im Switcher kann die Quelle kurz fehlen. Zeigt der Switcher-Eingang danach kein Bild, den Eingang dort neu wählen. |
| „NDI ausgefallen“ mit der Zeile „NDI-Quelle Kamera: … Details im Log.“ bzw. „NDI-Quelle Bildschirm: … Details im Log.“ | Connect startet die Quelle nicht mehr von selbst. Den Grund in der Zeile lesen (Zeilen unten), dann „NDI neu starten“; „Logordner öffnen“ führt zu main.log. |
| „NDI fehlt in diesem Paket oder ließ sich nicht laden (Addon oder NDI-Laufzeit).“ | Die Installation ist unvollständig oder beschädigt. JM Connect über den Launcher neu installieren. |
| „Die NDI-Laufzeit ließ sich nicht starten.“ | Die NDI-Laufzeit im Paket startet nicht. „NDI neu starten“ bzw. „Programm neu starten“; hilft das nicht, Connect neu starten, sonst neu installieren. Details im Log. |
| „Der NDI-Sender ließ sich nicht anlegen.“ | NDI hat den Sender für diese Quelle abgelehnt. „NDI neu starten“; bleibt es, das Log sichern und melden. |
| „Der NDI-Prozess endete beim Start (Code …).“ | Der Prozess endete, bevor er bereit war. Connect startet ihn nicht von selbst neu, weil ein Startfehler meist wiederkehrt. „NDI neu starten“ bzw. „Programm neu starten“ (der Knopf erscheint erst, wenn die Zeile „NDI ausgefallen“ bzw. „Programm-Empfang ausgefallen“ steht); kehrt es wieder, Connect neu installieren und den Code mit dem Log melden. |
| „Der NDI-Prozess fiel nach drei Neustarts erneut aus.“ | Connect hat den Prozess dreimal hintereinander neu gestartet. „NDI neu starten“ bzw. „Programm neu starten“; fällt er wieder aus, das Log sichern und melden. |
| „Das interne Medienfenster von Connect fehlt. Bitte Connect neu starten.“ | Das versteckte Fenster, das die Bilder der Gäste liefert, ist abgestürzt oder geschlossen. Connect beenden und neu starten; einen Knopf zum Neustarten der Quelle gibt es in diesem Fall nicht. Was der Neustart kostet (Gast-Quellen, Zoom-Meeting, Links), steht in der Zeile „Programm kommt an, die Weitergabe an die Gäste hängt“. |
| „Der NDI-Prozess meldete sich nicht binnen 10 s.“ | Der Prozess hing beim Start. „NDI neu starten“ bzw. „Programm neu starten“ (der Knopf erscheint erst, wenn die Zeile „NDI ausgefallen“ bzw. „Programm-Empfang ausgefallen“ steht); Details im Log. |
| „Der NDI-Prozess meldete einen unbekannten Fehler.“ | Details im Log; „NDI neu starten“ bzw. „Programm neu starten“. |
| „NDI: keine Quelle“ (Gastzeile) | Für diesen eingelassenen Gast besteht in Connect keine NDI-Quelle, etwa nachdem Connect bei offenem Raum neu gestartet wurde. Tray-Zeile und ndi_alarm zählen ihn nicht. Ob den Gast entfernen und neu einladen ihm wieder eine Quelle gibt, ergänzt dieses Handbuch nach der Abnahme (Stand vor der Abnahme von 0.4.0). |
| „Programm sucht …“ | Connect sucht die Programm-Quelle im Netz. Kurz abwarten. |
| „Programm: keine Quelle“ | Connect findet keine NDI-Quelle mit „JM Switcher“ im Namen (der Tooltip nennt den gesuchten Namen) und sucht laufend weiter. Im Switcher den NDI-Ausgang einschalten; unter macOS den Zugriff auf das lokale Netzwerk prüfen. |
| „Programm: kein Bild von …“ | Die Programm-Quelle besteht, aber seit über 3 s kommt kein Bild an (Switcher-Ausgang, Netz oder NDI-Verbindung). Im Switcher den NDI-Ausgang prüfen; kommt wieder Bild, steht wieder „Programm ● …“. |
| „Programm kommt an, die Weitergabe an die Gäste hängt“ | Das Programm kommt vom Switcher an, aber das interne Medienfenster nimmt keine Bilder ab; die Gäste sehen ein stehendes Programm. Abwarten; bleibt es, „Logordner öffnen“ und main.log sichern. Einen Knopf dafür gibt es nicht: Nur Connect neu starten baut das Medienfenster neu auf, und das kostet viel. Alle NDI-Quellen und das Programm setzen aus; Gäste, die schon eingelassen sind, bekommen danach keine NDI-Quelle für ihre Kamera zurück (siehe die Zeile „NDI: keine Quelle“); unter Windows verlässt Connect dabei das Zoom-Meeting, danach erneut beitreten (die gemerkte Meeting-Nummer steht im Feld, der Kenncode ist gespeichert), vom Host zulassen und die Aufnahme-Erlaubnis erneut erteilen lassen. Darum nur, wenn der Rückkanal wichtiger ist als die Gast-Quellen, etwa zwischen zwei Programmteilen. Die verteilten Links gelten danach nur weiter, wenn vor „Raum öffnen“ dieselbe `.jmshow` geöffnet ist (der Knopf heißt dann „Raum „…“ öffnen“); ohne `.jmshow` öffnet Connect einen neuen Raum, und jeder Gast braucht einen neuen Link. „Raum schließen“ ist kein Ausweg, es macht jeden verteilten Link ungültig. |
| „Programm: Öffnen gescheitert (…) · neuer Versuch folgt“ | NDI konnte die gefundene Quelle nicht öffnen; Connect versucht es nach 3 s von selbst neu. Bleibt es, im Switcher den NDI-Ausgang aus- und wieder einschalten. |
| „Programm-Empfang ausgefallen · Neustart … von 3 …“ | Der Prozess des Programm-Empfangs ist ausgefallen; Connect startet ihn nach 1 s von selbst neu, höchstens dreimal hintereinander. |
| „Programm-Empfang ausgefallen“ mit der Zeile „Programm-Empfang: … Details im Log.“ | Connect startet den Empfang nicht mehr von selbst. Den Grund lesen (dieselben Gründe wie bei den Gast-Quellen), dann „Programm neu starten“; „Logordner öffnen“ führt zu main.log. |
| „△ Gäste: … von … NDI-Quellen ausgefallen“ bzw. „△ Gäste: NDI-Quelle ausgefallen“ (Tray) | Mindestens eine Gast-Quelle ist ausgefallen. Im Fenster an der Gastzeile den Grund lesen. |
| „○ Gäste: NDI-Quelle startet …“ (Tray) | Gast-Quellen starten gerade. Kein Fehler. |
| „JM Connect — NDI-Ausfall“ (Tooltip im Tray) | Eine Gast-Quelle ist ausgefallen, oder der Programm-Empfang hängt, startet neu oder ist ausgefallen (wie ndi_alarm). Im Fenster nachsehen. |
| „Keine Verbindung zum Raum; Connect versucht laufend, neu zu verbinden. …“ | Die Verbindung der Bedienung zum Raum ist getrennt (Netz oder Proxy). Die Gästeliste zeigt den letzten Stand, die NDI-Abzeichen den aktuellen; Gäste steuern, Talkback, Folien und Einladen sind gesperrt. Netz prüfen und abwarten. |
| „Keine Verbindung zum Raum „…“. Adresse und Proxy-Key prüfen — im Hintergrund wird weiter versucht.“ | Connect hat den Raum 8 s nach „Raum öffnen“ noch nicht erreicht. Cloud-Zugang (Adresse, Proxy-Key) und Netz prüfen. |
| „Verbindung zum Raum beendet: Die Anmeldung von Connect gilt 8 Stunden ab dem letzten „Raum öffnen“ und ist abgelaufen, …“ | Die Anmeldung von Connect am Raum ist abgelaufen; Connect versucht es für die Bedienung nicht weiter. „Raum öffnen“ wählen, nicht „Raum schließen“: „Raum öffnen“ meldet Connect neu an, die Gäste bleiben, und kein verteilter Link wird ungültig. „Raum schließen“ würde alle Gäste aus dem Raum werfen und jeden Link ungültig machen. Bilder und Programm-Rückkanal können kurz aussetzen. |
| „Logordner ließ sich nicht öffnen: …“, „Lizenzbedingungen ließen sich nicht öffnen: …“ oder „ndi.video ließ sich nicht öffnen: https://ndi.video/“ | Das System hat das Öffnen abgelehnt. Den genannten Pfad bzw. die Adresse von Hand öffnen; Knopf bzw. Link bleiben für einen neuen Versuch bedienbar. |
| Companion-Taste „letzter Zoom-Befehl abgelehnt“ leuchtet | Der Grund steht unter „Hinweise“ in der Zoom-Karte, zum Beispiel „Companion: niemand namens … im Meeting.“ Namen prüfen und die Taste erneut drücken. |
| „Companion: … Slot eingeschaltet — mehr als 5 sind nicht gemessen.“ (unter „Hinweise“) | Ein Companion-Befehl (ZOOM_SLOT … ON oder ZOOM_LOAD) hat mehr als 5 Slots eingeschaltet. Über Companion fragt Connect nicht nach: Der Befehl ist ausgeführt (zoom_cmd f8, nicht abgelehnt), die Zustimmung gesetzt. Ob der Rechner es schafft, zeigen die Messwerte; sonst einen Slot ausschalten. |
| Ein Text endet mit „Details im Log“ | Knopf „Logordner öffnen“ daneben, in der Fußzeile des Hauptfensters oder in der Zoom-Karte, dann main.log ansehen. |

## Checklisten

### Einrichtung (einmal je PC)
- [ ] „Zoom-SDK 7.1.5.43953 eingerichtet“
- [ ] Zugangsdaten hinterlegt (Client-ID endet auf …)
- [ ] „Einrichtung prüfen“ meldet „Einrichtung in Ordnung …“
- [ ] Companion-Modul 0.3.0 mit der Rolle „JM Connect“ an Port 8737 (optional)
- [ ] Unter macOS: App freigegeben (Systemeinstellungen › Datenschutz & Sicherheit), Zugriff auf das lokale Netzwerk erlaubt
- [ ] Zoom-Slots angelegt: NDI-Namen wie die Switcher-Eingänge, Modus, Person, Auflösung, Ton; „Start“ an den Slots, die laufen sollen

### Vor Live
- [ ] Meeting im eigenen Zoom-Konto, Host im Zoom-Client bereit
- [ ] Bild-Versatz eingetragen, darunter „bestätigt: … ms“
- [ ] Kopfhörer am Regieplatz
- [ ] Jede Zoom-Person mit eindeutigem Anzeigenamen
- [ ] Aufnahme-Erlaubnis erteilt, jede eingeschaltete Kachel zeigt ihr Bild („Zeigt …“), die Slots im Switcher mit Bild und Ton
- [ ] Über der Gästeliste „Programm ● …“, an jeder Gast-Quelle „NDI ●“ mit Empfänger
- [ ] Höchstens 5 Slots eingeschaltet (mehr nur nach „Trotzdem einschalten“, nicht gemessen)

### Nach Live
- [ ] „Meeting verlassen“ oder Connect beendet, keine Zoom-Quelle mehr im Switcher
- [ ] Bei Störungen das Log über „Logordner öffnen“ gesichert
