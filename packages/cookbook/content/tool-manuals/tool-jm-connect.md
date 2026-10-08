---
id: tool-jm-connect
title: "JM Connect — Browser-Gäste und Zoom-Teilnehmer als NDI-Quellen"
category: Tool-Manuals
difficulty: anspruchsvoll
setupTimeMin: 45
teamSize: "1-2"
tags: [connect, zoom, remote, gaeste, ndi, companion, wiederbeitritt, manual]
relatedTools: [jm-connect, jm-switcher, jm-rundown]
prerequisites:
  - Windows 10/11, 64 Bit (Zoom nur unter Windows)
  - JM Connect ab 0.3.0, installiert über den Launcher
  - Zoom-SDK 7.1.5.43953 (per „Zoom-SDK laden“ oder als SDK-Ordner aus der JM-Ablage)
  - Zugangsdaten der Meeting-SDK-App (Datei oder Client-ID und Client-Secret)
  - Ein Zoom-Meeting im eigenen Zoom-Konto, Host im Zoom-Client
  - NDI-Switcher oder NDI-Monitor im selben Netz
equipmentOwner: jm
crewRoles:
  - Media Operator (Zuschaltungen)
  - Host im Zoom-Client (lässt zu, erteilt die Aufnahme-Erlaubnis)
lastReviewed: 2026-10-06
owner: tech@jakobsmedien.com
summary: "Remote-Gäste per Browser und einzelne Zoom-Teilnehmer als eigene NDI-Quellen im Switcher. Zoom wird einmal je PC eingerichtet, das Meeting muss im eigenen Zoom-Konto liegen, Personen werden einzeln geladen. Nach einem Abriss tritt Connect selbst wieder bei. Fernsteuerbar per Companion über Port 8737."
---

## Zutaten

### Voraussetzungen
- Windows 10/11, 64 Bit. Zoom gibt es nur unter Windows; unter macOS zeigt Connect nur die Browser-Gäste.
- JM Connect ab Version 0.3.0, installiert über den Launcher.
- Zoom-SDK 7.1.5.43953: auf JM-eigenen Rechnern per Knopf „Zoom-SDK laden“ (braucht den SDK-Schlüssel), sonst als SDK-Ordner aus der JM-Ablage. Connect kopiert es einmal je PC nach %LOCALAPPDATA%\JM Connect\zoom-laufzeit (rund 315 MB).
- Zugangsdaten der Meeting-SDK-App: die Zugangsdaten-Datei (clientId, clientSecret) oder Client-ID und Client-Secret von Hand. Connect speichert sie verschlüsselt unter diesem Windows-Konto und schickt sie nie in die Cloud.
- Ein Zoom-Meeting im eigenen Zoom-Konto der Meeting-SDK-App. Der Host sitzt im Zoom-Client auf einem zweiten Gerät.
- Kopfhörer am Regieplatz.
- NDI-Switcher (JM Switcher, TriCaster, vMix, OBS) oder NDI-Monitor im selben Netz.

### Netzwerk & Steuerung
- Steuerport 8737 (TCP-Zeilenprotokoll), mDNS-Name jm-connect-ctl (TXT ctl=1). In Companion die Rolle „JM Connect“, ab Modul 0.2.0.
- Befehle für Browser-Gäste: CONNECT GO · CONNECT NEXT · CONNECT STANDBY <Gast-ID> · CONNECT ONAIR <Gast-ID> · CONNECT OFF <Gast-ID> · CONNECT APPROVE <Gast-ID> · CONNECT TALKBACK on|off|toggle · CONNECT SLIDES <Gast-ID> on|off|toggle · CONNECT KICK <Gast-ID> · STATE?
- Befehle für Zoom: CONNECT ZOOM_LOAD <Anzeigename> lädt die Person mit genau diesem Anzeigenamen (Groß- und Kleinschreibung egal, Leerzeichen erlaubt) mit der Ton-Einstellung ihrer Zeile. CONNECT ZOOM_UNLOAD <Anzeigename> entlädt sie oder vergisst die gemerkte Quelle. CONNECT ZOOM_DELAY <ms> setzt den Bild-Versatz (0 bis 1000). Einen Beitritt per Companion gibt es bewusst nicht.
- STATE der Browser-Gäste: room, connected, guests, lobby, onair, active_label, standby, standby_label, talkback.
- STATE von Zoom: zoom_status (einrichtung, bereit, tritt_bei, warteraum, im_meeting, abriss, verlaesst, fehler), zoom_sources (Anzahl geladener Quellen), zoom_live (1/0), zoom_privilege (Aufnahme-Erlaubnis, 1/0), zoom_alarm (Eingriff nötig, 1/0), zoom_cmd (Ergebnis des letzten Zoom-Befehls: ok oder f1 bis f8), zoom_cmd_rejected (letzter Zoom-Befehl abgelehnt, 1/0). Die zoom_*-Werte enthalten nie einen Namen.
- Feedbacks: Gast auf Sendung (rot), Gäste im Warteraum (gelb), Talkback (gelb), Zoom-Quellen geladen (grün), Zoom braucht einen Eingriff (rot), letzter Zoom-Befehl abgelehnt (gelb).
- Ab Modul 0.2.0 leuchten „Gast auf Sendung“ und „Gäste im Warteraum“ bei jeder Anzahl über 0, und Namen mit Leerzeichen (active_label, standby_label) kommen ganz an. Ältere Module zeigen solche Namen kodiert, zum Beispiel Anna%20Maria.
- JM Rundown kennt die Zoom-Aktionen erst ab seinem nächsten Release; bis dahin steuert er Zoom nicht.

### Browser-Gäste (kurz)
- Raum öffnen (braucht den Cloud-Zugang), für jeden Gast einen Link erzeugen und verschicken.
- Gäste landen im Warteraum: prüfen und freigeben.
- Freigegebene Gäste auf Sendung schalten. Jeder Gast ist eine eigene NDI-Quelle „JM Connect – <Name>“, ein geteilter Bildschirm eine weitere.
- Talkback (Regie ins Ohr) für alle oder per Halten-Taste für einen Gast; Programm-Rückkanal mit Mix-Minus je Gast.

### Harte Grenzen
- Kein Tally, kein Talkback/IFB und kein Mix-Minus je Zoom-Person: Zoom-Ton ist ein gemeinsamer Kanal. Das ist eine Grenze von Zoom.
- Nur Meetings im eigenen Zoom-Konto. Zwei Gründe, beide von Zoom: Eine nicht im Zoom Marketplace veröffentlichte App kommt nicht in Meetings fremder Konten (Code 63), und seit 02.03.2026 verlangt Zoom dafür zusätzlich ein OBF-Token (Codes 503/504).
- Ohne Aufnahme-Erlaubnis des Hosts gibt es keine Zoom-Quellen. Entzieht der Host sie, stoppt Connect sofort Bild und Ton aller Zoom-Quellen.
- Höchstens 5 Zoom-Quellen sind gemessen. Ab der 6. warnt Connect; von selbst lädt es nie mehr als 5.
- Kopfhörer tragen: Lautsprecher im selben Raum wie ein abonniertes Mikrofon erzeugen Echo.
- Kein Mischton, kein Bildschirmton, kein Dolmetscherton, kein Ton zurück nach Zoom.
- Keine Bildvorschau in Connect: das Bild im Switcher oder NDI-Monitor ansehen.
- Zoom nur unter Windows.
- Die SDK-Fassung ist fest (7.1.5.43953). Lehnt Zoom sie ab, hilft nur ein neuer Connect-Release.
- JM Rundown kennt die Zoom-Aktionen erst ab seinem nächsten Release.

### Logs und Datenschutz
- JM Connect schreibt Meeting-Nummer und Kenncode nie auf die Platte, nie ins Log und nie in den Companion-Status. Nach einem Neustart von Connect müssen sie neu eingegeben werden.
- Das Log nennt Zoom-Teilnehmer und Browser-Gäste nur mit ihrer Kennung, nie mit dem Anzeigenamen. Karte und NDI-Namen zeigen die Namen weiter.
- Alle Suite-Apps löschen Logzeilen, die älter als 14 Tage sind, beim Start und danach alle 6 Stunden, jeweils ab ihrem nächsten Release.
- Den Logordner öffnet der Knopf „Logordner öffnen“ in der Zoom-Karte.

### Deinstallieren
- Der Laufzeit-Ordner bleibt beim Deinstallieren liegen. Bei Bedarf %LOCALAPPDATA%\JM Connect\zoom-laufzeit von Hand löschen.
- Das Zoom-SDK legt selbst %APPDATA%\ZoomSDK an. Auch dieser Ordner bleibt und lässt sich von Hand löschen.

## Schritt-für-Schritt

### Einrichtung
- Zoom-Karte, Knopf „Einrichtung“ aufklappen. Zoom bleibt gesperrt, bis Zoom-SDK und Zugangsdaten eingerichtet sind.
- Zoom-SDK auf JM-eigenen Rechnern: unter „SDK-Schlüssel“ auf „Eintragen …“, den Schlüssel einfügen und speichern, dann „Zoom-SDK laden“ (rund 143 MB, mit Fortschritt und „Abbrechen“).
- Zoom-SDK ohne Schlüssel: „SDK-Ordner wählen …“ und den SDK-Ordner aus der JM-Ablage wählen (den Ordner mit dem Unterordner x64\bin). Danach steht dort „Zoom-SDK 7.1.5.43953 eingerichtet“.
- Zugangsdaten: „Datei wählen …“ oder „Eintragen …“ (Client-ID und Client-Secret). Danach steht dort „hinterlegt (Client-ID endet auf …)“.
- „Einrichtung prüfen“ meldet sich ohne Meeting bei Zoom an. Erwartet: „Einrichtung in Ordnung: Zoom-SDK 7.1.5 (43953), Anmeldung bei Zoom erfolgreich.“
- Vor der Show den Bild-Versatz eintragen (Wert aus dem Klatschtest). Erscheint darunter „Nur für diese Sitzung gemerkt …“, ließ sich die Einstellungsdatei nicht schreiben: Der Wert gilt bis zum Beenden von Connect und muss danach neu eingetragen werden.
- Vor der Show mit dem Host absprechen: „JM Connect“ aus dem Warteraum zulassen und die Aufnahme-Erlaubnis erteilen, nach einem Wiederbeitritt gegebenenfalls erneut. Kopfhörer bereitlegen.

### Während
- Meeting-Nummer, Kenncode (darf leer bleiben) und Anzeigename (Vorgabe „JM Connect“) eingeben, „Beitreten“. Das Kenncode-Feld leert sich sofort.
- Im Warteraum muss der Host „JM Connect“ zulassen. Danach fragt Connect die Aufnahme-Erlaubnis an; der Host erteilt sie im Zoom-Client.
- Personen laden: vor dem Laden den Schalter „Ton“ der Zeile setzen (bei geladener Quelle erst entladen), dann „Als Quelle laden“. Jede Person wird eine eigene NDI-Quelle „JM Connect – Zoom <Name>“ mit Bild und Ton.
- Bild und Ton jeder Quelle stehen in ihrer Zeile im Klartext, zum Beispiel „Bild läuft · Ton läuft“ oder „Bild schwarz: Kamera aus · Ton läuft“.
- Name doppelt im Meeting: Connect markiert beide Zeilen rot. Von Hand laden; die zweite Quelle heißt „JM Connect – Zoom <Name> (2)“.
- Verbindung weg: Erst versucht Zoom selbst, neu zu verbinden („Verbindung unterbrochen …“). Gelingt das nicht, tritt Connect mit bis zu 5 Versuchen neu bei (nach 2, 5, 10, 20 und 30 s, mit Countdown in der Karte). „Abbrechen“ beendet die Versuche, „Erneut beitreten“ startet später mit denselben Daten.
- Nach dem Wiederbeitritt muss der Host gegebenenfalls wieder zulassen und die Aufnahme-Erlaubnis erteilen. Dann lädt Connect alle gemerkten Quellen mit eindeutigem Namen von selbst, mit derselben Ton-Einstellung und demselben NDI-Namen.
- Gemerkte Quellen: Wer geladen war und gerade fehlt, steht unter „Gemerkte Quellen“ (wartet auf die Person, Name doppelt, Person weg, oder über 5 Quellen nicht automatisch geladen). „Vergessen“ nimmt einen Eintrag heraus. Solange Einträge fehlen, steht zoom_alarm auf 1.
- Entzieht der Host die Aufnahme-Erlaubnis, stoppt Connect sofort Bild und Ton aller Zoom-Quellen. Erteilt er sie wieder, lädt Connect die gemerkten Quellen von selbst, höchstens 5.
- Companion: ZOOM_LOAD, ZOOM_UNLOAD und ZOOM_DELAY wirken wie die Knöpfe der Karte. Leuchtet „letzter Zoom-Befehl abgelehnt“, steht der Grund unter „Hinweise“ in der Karte.

### Nachbereitung
- „Meeting verlassen“ (bei geladenen Quellen fragt der Knopf einmal nach) oder Connect über das Tray beenden. Beides verlässt das Meeting sauber; die Zoom-Quellen verschwinden.
- Nach einer Fehlermeldung leert „Schließen“ Meeting-Nummer, Kenncode und gemerkte Quellen.
- Bei Störungen „Logordner öffnen“ und main.log sichern. Es enthält weder Teilnehmernamen noch Kenncode noch Meeting-Nummer.

## Profi-Tipps
- Companion-Tasten per Anzeigename anlegen, zum Beispiel ZOOM_LOAD Anna Maria Beispiel. Zooms Teilnehmer-Kennungen gelten nur bis zum nächsten Beitritt, der Name bleibt.
- Doppelte Namen vorher vermeiden: Teilnehmer bitten, sich in Zoom eindeutig zu benennen (Handys heißen oft gleich, etwa „Samsung SM-…“). Sonst gibt es nach einem Abriss Handarbeit, mit Absicht: lieber ein Handgriff als die falsche Person.
- Das Feedback „Zoom braucht einen Eingriff“ (zoom_alarm) auf eine Taste legen. Es leuchtet bei Abriss, Fehler, fehlender Aufnahme-Erlaubnis und solange gemerkte Quellen fehlen.
- Einen Browser-Gast nie „Zoom <Name>“ nennen, wenn diese Person auch aus Zoom geladen ist: Dann senden zwei Quellen unter demselben NDI-Namen.
- Den Versatz einmal je Raum mit dem Klatschtest messen; er gilt für alle Zoom-Quellen.
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
| „Aufnahme-Erlaubnis vom Host entzogen, Quellen gestoppt …“ | Der Host hat die Erlaubnis entzogen; Connect hat Bild und Ton aller Zoom-Quellen sofort gestoppt. Erteilt der Host sie wieder, lädt Connect die gemerkten Quellen von selbst. |
| „NDI ließ sich in der Zoom-Bridge nicht starten …“ | Die NDI-Laufzeit fehlt oder ist gestört. Details im Log; JM Connect neu installieren. |
| „NDI-Name doppelt: Ein Browser-Gast und diese Zoom-Person senden beide als …“ | Ein Browser-Gast heißt wie eine Zoom-Quelle. Einen der beiden umbenennen. |
| „Name doppelt im Meeting …“ | Zwei Personen tragen denselben Anzeigenamen. Nach einem Wiederbeitritt lädt Connect sie nicht von selbst; von Hand laden oder die Personen umbenennen lassen. |
| „… nicht automatisch geladen (mehr als 5 Zoom-Quellen), bitte von Hand laden“ | Die gemerkte Quelle liegt über der Betriebsgröße 5. In der Teilnehmerliste von Hand laden (zweiter Klick nach der Warnung) oder vergessen. |
| „Verbindung unterbrochen. Zoom versucht selbst, neu zu verbinden …“ | Das Netz war kurz weg. Abwarten: Zoom verbindet selbst, die Quellen laufen danach weiter. |
| „Verbindung zum Meeting verloren. Wiederbeitritt … von 5 …“ | Connect tritt selbst neu bei. Netz prüfen; „Abbrechen“ beendet die Versuche. |
| „Wiederbeitritt gescheitert (…). „Erneut beitreten“ versucht es noch einmal.“ | Alle 5 Versuche sind gescheitert, der letzte Grund steht in Klammern. Netz prüfen, dann „Erneut beitreten“. |
| „Wiederbeitritt abgebrochen.“ | „Abbrechen“ wurde gedrückt. „Erneut beitreten“ startet neu; die gemerkten Quellen bleiben. |
| „Meeting beendet: …“ | Der Host hat das Meeting beendet. „Erneut beitreten“, sobald er es neu startet, sonst „Schließen“. |
| „Nur für diese Sitzung gemerkt — die Einstellungsdatei ließ sich nicht schreiben.“ (unter dem Versatz) | connect-settings.json ist schreibgeschützt oder gesperrt. Der Versatz gilt bis zum Beenden von Connect. Schreibrechte im Ordner %APPDATA%\JM Connect prüfen. |
| Companion-Taste „letzter Zoom-Befehl abgelehnt“ leuchtet | Der Grund steht unter „Hinweise“ in der Zoom-Karte, zum Beispiel „Companion: niemand namens … im Meeting.“ Namen prüfen und die Taste erneut drücken. |
| Ein Text endet mit „Details im Log“ | Knopf „Logordner öffnen“ in der Zoom-Karte, dann main.log ansehen. |

## Checklisten

### Einrichtung (einmal je PC)
- [ ] „Zoom-SDK 7.1.5.43953 eingerichtet“
- [ ] Zugangsdaten hinterlegt (Client-ID endet auf …)
- [ ] „Einrichtung prüfen“ meldet „Einrichtung in Ordnung …“
- [ ] Companion-Modul 0.2.0 mit der Rolle „JM Connect“ an Port 8737 (optional)

### Vor Live
- [ ] Meeting im eigenen Zoom-Konto, Host im Zoom-Client bereit
- [ ] Bild-Versatz eingetragen, darunter „bestätigt: … ms“
- [ ] Kopfhörer am Regieplatz
- [ ] Jede Zoom-Person mit eindeutigem Anzeigenamen
- [ ] Aufnahme-Erlaubnis erteilt, Quellen im Switcher mit Bild und Ton
- [ ] Höchstens 5 Zoom-Quellen

### Nach Live
- [ ] „Meeting verlassen“ oder Connect beendet, keine Zoom-Quelle mehr im Switcher
- [ ] Bei Störungen das Log über „Logordner öffnen“ gesichert
