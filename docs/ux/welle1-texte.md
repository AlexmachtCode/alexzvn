# UX-Update Welle 1: Texte zur Freigabe durch den Owner

Zweck: Alle neuen und geänderten sichtbaren Texte der fünf umgebauten Werkzeuge (Switcher, Timer, Rundown, Q&A, Battle) zur Freigabe durch den Owner. Texte der gemeinsamen Bausteine aller Tools (Oberfläche und Einstellungen), die seit Welle 0 freigegeben sind, stehen nicht hier; nur der eine neue gemeinsame Text steht unter „Gemeinsam“.

Stand: Branch `feat/ux-welle1`, Code-Stand `e5d365082f`. Die Versionen sind Switcher 0.12.0, Timer 0.15.0, Rundown 0.9.0, Q&A 0.7.0 und Battle 0.5.0; das Datum der Changelog-Einträge (21.11.2026) ist ein Platzhalter und wird am Tag der Veröffentlichung gesetzt.

Lesehilfe: ‹…› steht für den Teil, der sich zur Laufzeit ändert (eine Zahl oder ein Name). Beispiel: „Runde ‹…›/‹…›“ erscheint als „Runde 2/3“. Die Nummer (z. B. SW12) nennst Du bitte bei jeder Änderung, die Du wünschst. Die Spalte „Ort“ sagt, wo der Text steht: Statusleiste (unten), Haupttaste (große Taste im Live-Bereich), Panel (Einstellungen hinter ⚙), Hinweis, Kopf (Kopfzeile).

Aufbau: je Werkzeug eine Tabelle, dann „Gemeinsam“, „Ortshinweise“ (alte Texte, die einen verschobenen Ort nennen), „Changelog“, „Entfällt“, „Geänderte Bedienung“, „Fragen an den Owner“ und „Handbuch“ (die Stellen der fünf Kochbuch-Handbücher, die einen alten Ort nannten).

## Switcher

| Nr. | Ort | Text |
| --- | --- | --- |
| SW1 | Haupttaste (Sperrgrund) | „Keine andere Szene in der Vorschau“ |
| SW2 | Haupttaste (Sperrgrund) | „Überblendung läuft“ |
| SW3 | Haupttaste (Sperrgrund) | „Stream-Ziel in den Einstellungen festlegen“ |
| SW4 | Statusleiste | „läuft“ |
| SW5 | Statusleiste | „kein Ziel“ |
| SW6 | Statusleiste | „stumm“ |
| SW7 | Panel (Fernsteuerung, Modulname) | „jm-switcher“ |
| SW8 | Panel (Audio, Auswahl) | „— Kein Ton (stille Spur) —“ |
| SW9 | Panel (Audio, Auswahl-Titel) | „Programm-Audio“ |
| SW10 | Mischer (Titel des einklappbaren unteren Bereichs) | „Szenen, Ebenen und Quellen“ |
| SW11 | Kopf (Sendezustand) | „LIVE“ |
| SW12 | Kopf (Sendezustand) | „REC“ |
| SW13 | Haupttaste | „Cut“ |
| SW14 | Haupttaste | „Auto“ |
| SW15 | Haupttaste | „Dauer“ |
| SW16 | Haupttaste | „ms“ |
| SW17 | Haupttaste | „Aufnehmen“ |
| SW18 | Haupttaste | „Aufnahme stoppen“ |
| SW19 | Haupttaste | „Stream starten“ |
| SW20 | Haupttaste | „Stream stoppen“ |
| SW21 | Statusleiste (Titel) | „NDI“ |
| SW22 | Statusleiste (Titel) | „Audio“ |
| SW23 | Statusleiste (Titel) | „Aufnahme“ |
| SW24 | Statusleiste (Titel) | „Stream“ |
| SW25 | Panel (Einleitung) | „Stream-Ziel und Qualität. Aufnahme & Stream startest du in der Mischer-Ansicht.“ |
| SW26 | Panel (Hinweis) | „So erscheint die Ausgabe im Netz (z. B. als Eingang in TriCaster, vMix, OBS oder einem NDI-Monitor). In der Mischer-Leiste wählst du, ob das Program-Bild oder das Multiview gesendet wird, und schaltest die Ausgabe live an/aus.“ |
| SW27 | Panel (Hinweis) | „Zeigt das On-Air-Programmbild formatfüllend auf dem gewählten Monitor — per HDMI direkt an Beamer, Kontrollmonitor oder Encoder. Läuft unabhängig von NDI und der Aufnahme; wähle für die Regie am besten einen anderen Monitor als den mit der Bedienoberfläche.“ |
| SW28 | Panel (Hinweis) | „Mikro / Line-In / Capture-Ton. Wird in Aufnahme + Stream gemischt; Pegel & Mute in der Mischer-Leiste. Audio folgt (noch) nicht der Bildquelle — feste Programm-Audioquelle.“ |
| SW29 | Panel (Hinweis) | „Zeilenprotokoll (PREVIEW/PROGRAM/CUT/AUTO/RECORD/STREAM) für ein Stream-Deck via Bitfocus Companion — Modul: packages/companion-jm-switcher. Im Companion-Modul Host (IP dieses Rechners) + Port eintragen.“ |
| SW30 | Panel (Knopf) | „Monitore aktualisieren“ |
| SW31 | Panel (Abschnittstitel) | „Streaming“ |
| SW32 | Panel (Abschnittstitel) | „Aufnahme“ |
| SW33 | Panel (Abschnittstitel) | „Programm-Format“ |
| SW34 | Panel (Feld und Hinweis) | „RTMP-Ziel“ |
| SW35 | Panel (Feld und Hinweis) | „rtmp://server/app/streamkey“ |
| SW36 | Panel (Feld und Hinweis) | „Vollständige URL inkl. Streamkey (z. B. YouTube-/Twitch-Ingest oder lokaler nginx-rtmp).“ |
| SW37 | Panel (Feld und Hinweis) | „Stream-Bitrate“ |
| SW38 | Panel (Feld und Hinweis) | „Video-Bitrate des H.264-Streams (x264).“ |
| SW39 | Panel (Feld und Hinweis) | „Aufnahme-Bitrate“ |
| SW40 | Panel (Feld und Hinweis) | „Video-Bitrate der WebM-Aufnahme.“ |
| SW41 | Panel (Feld und Hinweis) | „kbit/s“ |
| SW42 | Panel (Feld und Hinweis) | „Empfohlen für“ |
| SW43 | Panel (Feld und Hinweis) | „NDI-Quelle“ |
| SW44 | Panel (Feld und Hinweis) | „Was als NDI-Quelle ausgegeben wird“ |
| SW45 | Panel (Feld und Hinweis) | „Program“ |
| SW46 | Panel (Feld und Hinweis) | „Multiview“ |
| SW47 | Panel (Feld und Hinweis) | „Programm-Auflösung“ |
| SW48 | Panel (Feld und Hinweis) | „Ausgabe-Bildrate“ |
| SW49 | Panel (Feld und Hinweis) | „Full-HD 1080p“ |
| SW50 | Panel (Feld und Hinweis) | „HD 720p“ |
| SW51 | Panel (Feld und Hinweis) | „Auflösung:“ |
| SW52 | Panel (Feld und Hinweis) | „Ton:“ |
| SW53 | Panel (Feld und Hinweis) | „Programm-Ton der gewählten Audioquelle“ |
| SW54 | Panel (Feld und Hinweis) | „stille AAC-Spur (keine Audioquelle gewählt)“ |
| SW55 | Panel (Feld und Hinweis) | „Der Stream wird aus dem Program-Bild kodiert (libx264, zerolatency) — die Auflösung folgt der Programm-Auflösung, es wird nie hochskaliert.“ |
| SW56 | Panel (Feld und Hinweis) | „Aufnahmen werden als WebM gespeichert (Speicherort wird beim Start abgefragt). Für MP4 die Datei im JM Media Converter umwandeln.“ |
| SW57 | Panel (Feld und Hinweis) | „Auflösung und Bildrate gelten für alle Ausgaben — NDI, Aufnahme, RTMP und den zweiten Bildschirm. Das Programm wird in dieser Auflösung komponiert (kein Hochskalieren). 1080p ist echtes Full-HD und kostet mehr Rechenleistung; auf schwächeren Rechnern 720p wählen. Das Multiview bleibt 720p und zeigt Program + Preview groß plus alle Szenen als Kacheln mit Tally.“ |
| SW58 | Panel (Feld und Hinweis) | „Eine geänderte Bildrate greift, sobald weder Aufnahme noch Sendung läuft — solange eine von beiden läuft, behält auch eine neu gestartete zweite Ausgabe die bisherige Rate.“ |
| SW59 | Werkzeugleiste (Projekt) | „Projekt“ |
| SW60 | Werkzeugleiste (Projekt) | „Neu“ |
| SW61 | Werkzeugleiste (Projekt) | „Öffnen…“ |
| SW62 | Werkzeugleiste (Projekt) | „Speichern“ |
| SW63 | Werkzeugleiste (Projekt) | „Speichern unter…“ |
| SW64 | Werkzeugleiste (Projekt) | „· ungespeichert“ |
| SW65 | Werkzeugleiste (Projekt) | „Nicht gespeichert“ |

## Timer

| Nr. | Ort | Text |
| --- | --- | --- |
| TI1 | Haupttaste | „Start“ |
| TI2 | Haupttaste | „Resume“ |
| TI3 | Haupttaste | „Pause“ |
| TI4 | Haupttaste | „Reset“ |
| TI5 | Haupttaste | „← Prev“ |
| TI6 | Haupttaste | „Next →“ |
| TI7 | Haupttaste (Kürzel) | „Leertaste“ |
| TI8 | Haupttaste | „R“ |
| TI9 | Haupttaste (Sperrgrund) | „Erster Programmpunkt“ |
| TI10 | Haupttaste (Sperrgrund) | „Letzter Programmpunkt“ |
| TI11 | Haupttaste (Sperrgrund) | „Keine Programmpunkte“ |
| TI12 | Haupttaste (Sperrgrund) | „Nichts zurückzusetzen“ |
| TI13 | Statusleiste (Sync) | „Sync“ |
| TI14 | Statusleiste (Sync) | „Verbunden mit JM Timer-Sync“ |
| TI15 | Statusleiste (Sync) | „Keine Verbindung“ |
| TI16 | Statusleiste (Speaker-Fenster) | „Fenster offen“ |
| TI17 | Statusleiste (Speaker-Fenster) | „Fenster zu“ |
| TI18 | Panel (Speaker-Fenster) | „Öffnet auf dem zweiten Bildschirm, falls vorhanden.“ |
| TI19 | Panel (Speaker-Fenster) | „Speaker-Fenster öffnen“ |
| TI20 | Panel (Speaker-Fenster) | „Speaker-Fenster schließen“ |
| TI21 | Kopf (Mitte) | „Speaker · Open“ |
| TI22 | Kopf (Mitte) | „Open Speaker“ |
| TI23 | Hinweis (Countdown) | „Während der Timer läuft, Dauer per Delay anpassen.“ |
| TI24 | Panel (Abschnittstitel) | „Speaker-Fenster“ |
| TI25 | Panel (Abschnittstitel) | „LAN-Fernbedienung“ |
| TI26 | Panel (Abschnittstitel) | „Farben“ |

## Rundown

| Nr. | Ort | Text |
| --- | --- | --- |
| RD1 | Haupttaste | „GO“ |
| RD2 | Haupttaste | „◀ Zurück“ |
| RD3 | Haupttaste | „Weiter ▶“ |
| RD4 | Haupttaste | „Leertaste“ |
| RD5 | Haupttaste | „↑“ |
| RD6 | Haupttaste | „↓“ |
| RD7 | Haupttaste (Sperrgrund) | „Keine Zeile im Ablauf“ |
| RD8 | Statusleiste (iveo) | „Keine Show“ |
| RD9 | Statusleiste (iveo) | „Show ohne iveo“ |
| RD10 | Werkzeugleiste | „Neu“ |
| RD11 | Werkzeugleiste | „Öffnen“ |
| RD12 | Werkzeugleiste | „Regieplan…“ |
| RD13 | Werkzeugleiste (Tooltip) | „Regieplan aus Excel/CSV importieren — legt je Punkt eine Zeile an“ |
| RD14 | Werkzeugleiste | „Export…“ |
| RD15 | Werkzeugleiste (Tooltip) | „Aktuellen Ablauf als Regieplan (Excel) exportieren — z. B. für den JM Timer“ |
| RD16 | Werkzeugleiste | „Speichern“ |
| RD17 | Werkzeugleiste | „Speichern unter …“ |
| RD18 | Werkzeugleiste | „• ungespeichert“ |
| RD19 | Werkzeugleiste (Feld, Bezeichnung für Screenreader) | „Name des Ablaufs“ |
| RD20 | Transport (unter den Haupttasten) | „Scharf“ |
| RD21 | Transport (unter den Haupttasten) | „—“ |
| RD22 | Transport (unter den Haupttasten) | „Zuletzt gefeuert:“ |
| RD23 | Transport (unter den Haupttasten) | „keine Aktionen“ |
| RD24 | Hinweis | „Hinweis schließen“ |
| RD25 | Panel (Gegenstellen) | „Noch keine Tools gefunden — Suite-Tools im selben Netz starten (mDNS) oder Verbindungen manuell setzen.“ |
| RD26 | Panel (Gegenstellen) | „gefunden:“ |

## Q&A

| Nr. | Ort | Text |
| --- | --- | --- |
| QA1 | Kopf (Mitte) | „wartend“ |
| QA2 | Haupttaste | „Nächste ▶“ |
| QA3 | Haupttaste | „■ Beenden“ |
| QA4 | Haupttaste (Sperrgrund) | „Niemand am Wort“ |
| QA5 | Statusleiste (Saal) | „Saal-Einreichung“ |
| QA6 | Haupttaste (Saal-Einreichung) | „Saal-Einreichung ◉ An“ |
| QA7 | Haupttaste (Saal-Einreichung) | „Saal-Einreichung ○ Aus“ |
| QA8 | Statusleiste (Saal) | „kein Netzwerk“ |
| QA9 | Statusleiste (Extern) | „Extern“ |
| QA10 | Statusleiste (Extern) | „an“ |
| QA11 | Panel (Gegenstellen) | „gefunden:“ |
| QA12 | Panel (Gegenstellen) | „Q&A koppelt Redezeit an den JM Timer und die Bauchbinde an den JM Titler.“ |
| QA13 | Panel (Abschnittstitel) | „Redezeit und Kopplung“ |
| QA14 | Panel (Abschnittstitel) | „Moderation“ |
| QA15 | Panel (Hinweis) | „Standardmäßig aktiv: Redezeit (Timer) und Bauchbinde (Titler) werden beim Ans-Wort-Holen automatisch gesteuert — hier pro Werkzeug mit einem Klick umschaltbar.“ |
| QA16 | Live-Bereich (Leertext) | „Niemand am Wort. „Nächste“ ruft die erste Wortmeldung auf.“ |

## Battle

| Nr. | Ort | Text |
| --- | --- | --- |
| BA1 | Panel (Abschnittstitel) | „Battle“ |
| BA2 | Panel (Abschnittstitel) und Live-Bereich (Replay-Karte) | „Instant-Replay“ |
| BA3 | Panel (Abschnittstitel) | „Zurücksetzen“ |
| BA4 | Statusleiste / Karte (Voting) | „Publikums-Voting“ |
| BA5 | Haupttaste | „Voting öffnen (Runde ‹…›)“ |
| BA6 | Haupttaste | „Voting offen (Runde ‹…›) — schließen“ |
| BA7 | Haupttaste (Sperrgrund) | „Voting-Server ist aus“ |
| BA8 | Haupttaste (Sperrgrund) | „Publikums-Voting ist abgeschaltet“ |
| BA9 | Statusleiste (Voting) | „geschlossen (Runde ‹…›)“ |
| BA10 | Statusleiste (Voting) | „offen (Runde ‹…›)“ |
| BA11 | Statusleiste / Karte (Voting) | „kein Netzwerk“ |
| BA12 | Haupttaste (Replay) | „⧉ Clip (letzte ‹…›s)“ |
| BA13 | Haupttaste (Replay) | „schneidet …“ |
| BA14 | Haupttaste (Sperrgrund) | „keine Aufnahme-Quelle“ |
| BA15 | Haupttaste (Sperrgrund) | „Clip läuft“ |
| BA16 | Live-Bereich (Replay-Karte, Quelle) | „keine Quelle gewählt“ |
| BA17 | Panel (Replay, Zielordner) | „Zielordner“ |
| BA18 | Panel (Replay, Zielordner) | „Standard (Videos/JM Battle Clips)“ |
| BA19 | Kopf (Mitte) | „Runde ‹…›/‹…›“ |
| BA20 | Panel (Gegenstellen) | „Battle blendet die VS-Bauchbinde über den JM Titler ein.“ |
| BA21 | Panel (Gegenstellen) | „gefunden:“ |
| BA22 | Panel (Zurücksetzen) | „Battle zurücksetzen“ |
| BA23 | Rückfrage (Zurücksetzen) | „Battle zurücksetzen? Runden/Stimmen werden geleert (Namen bleiben). Ein laufendes VS geht aus.“ |
| BA24 | Haupttaste | „Nächste Runde ▶“ |
| BA25 | Haupttaste | „● VS on air“ |
| BA26 | Haupttaste | „○ VS einblenden“ |
| BA27 | Hinweis (unter VS) | „Titler nicht verbunden: VS wird gesetzt, die Bauchbinde erscheint aber nicht.“ |
| BA28 | Statusleiste (Aufnahme-Quelle) | „Aufnahme-Quelle“ |
| BA29 | Statusleiste (Aufnahme-Quelle) | „fehlt“ |

## Gemeinsam

Ein neuer Text im gemeinsamen Baustein für die Einstellungen (Gegenstellen), der in Rundown und Q&A erscheint. Sonst gibt es in den gemeinsamen Bausteinen aller Tools seit dem Stand vor Welle 1 keinen neuen sichtbaren Text.

| Nr. | Ort | Text |
| --- | --- | --- |
| GE1 | Statusleiste / Panel (Gegenstellen: Zeile eines gefundenen, aber nicht verbundenen Tools) | „gefunden · nicht verbunden“ |

## Ortshinweise

Diese Texte sind wörtlich geblieben (schon freigegeben), nennen aber einen Ort, der sich geändert hat. Die Switcher-Texte stehen zusätzlich mit ihrer Nr. in der Tabelle oben; die Q&A-Texte sind freigegebene Zugangstexte, die nicht in der Tabelle stehen. Bitte entscheide je Eintrag: so lassen, oder einen neuen Wortlaut vorgeben.

- Switcher, Panel Einleitung (SW25): „Aufnahme & Stream startest du in der Mischer-Ansicht.“ Es gibt keine Ansicht „Mischer“ mehr als Reiter; die Tasten „Aufnehmen“ und „Stream starten“ sind jetzt die Haupttasten unter der Kopfzeile.
- Switcher, Panel NDI (SW26): „In der Mischer-Leiste wählst du, ob das Program-Bild oder das Multiview gesendet wird, und schaltest die Ausgabe live an/aus.“ Die Wahl der NDI-Quelle (Program oder Multiview) liegt jetzt im Panel unter „Programm-Format“; das An- und Ausschalten der Ausgabe liegt in der Ausgabeleiste des Mischers.
- Switcher, Panel Audio (SW28): „Pegel & Mute in der Mischer-Leiste.“ Pegel und Mute liegen in der Ausgabeleiste des Mischers.
- Switcher, Panel Fernsteuerung (SW29): Der alte Satz zum Zeilenprotokoll und zum Companion-Modul steht jetzt zusätzlich zum Companion-Hinweis des gemeinsamen Abschnitts; der Companion-Hinweis kommt dadurch doppelt vor.
- Q&A, Saal-Einreichung (Karte im Live-Bereich): „Aus. Anschalten, damit der Saal Fragen per Handy (QR) einreichen kann.“ Das „Anschalten“ ist jetzt die Haupttaste „Saal-Einreichung ○ Aus“ im Live-Bereich, nicht mehr ein Knopf in der Karte.
- Q&A, Karte Extern im Live-Bereich: „Für Fragen per Livestream oder Presse: im Launcher anmelden und hier ein Event erzeugen.“ Das Event entsteht im Panel-Abschnitt „Extern“ hinter ⚙, nicht in dieser Karte; „hier“ meint also das Panel (früher das Einstellungs-Fenster).
- Battle: Die Einstellungshinweise (Runden, Voting, VS-Bauchbinde) stehen wörtlich weiter da, jetzt im Panel statt im Fenster „Einstellungen“.

## Changelog

Entwurf der Release-Notizen (`packages/suite-manifest/changelog.json`), wörtlich wie dort. Das Datum ist ein Platzhalter.

| Nr. | App, Version | Text |
| --- | --- | --- |
| CL-SW1 | Switcher 0.12.0 | „Neue Oberfläche: Oben die Kopfzeile mit „JM Switcher“, dem Sendezustand („REC“ bzw. „LIVE“) und den Schaltern für Hell und Dunkel sowie Einstellungen, darunter die Projekt-Leiste mit Neu, Öffnen und Speichern, die Haupttasten „Cut“, „Auto“, „Aufnehmen“ und „Stream starten“ und der Mischer. Die Einstellungen liegen jetzt im Panel hinter ⚙, die Reiter „Mischer“ und „Einstellungen“ entfallen.“ |
| CL-SW2 | Switcher 0.12.0 | „Neue Statusleiste mit sieben Einträgen: Master, NDI, Bildschirm, Aufnahme, Stream, Fernsteuerung und Audio. Sie zeigt nur, was der Switcher wirklich weiß; ein Klick auf einen Eintrag öffnet, wo es eine Einstellung gibt, das Panel am passenden Abschnitt.“ |
| CL-SW3 | Switcher 0.12.0 | „Gesperrte Haupttasten nennen ihren Grund, zum Beispiel „Stream-Ziel in den Einstellungen festlegen“. Der untere Bereich mit Szenen, Ebenen und Quellen lässt sich einklappen.“ |
| CL-SW4 | Switcher 0.12.0 | „Zahlenfelder übernehmen den Wert bei Enter oder beim Verlassen des Feldes; die Pfeiltasten ändern sie nicht mehr. Bedienung, Fernsteuerung (Companion-Befehle) und Ausgaben bleiben gleich, es gibt keine neuen Tastenkürzel.“ |
| CL-TI1 | Timer 0.15.0 | „Neue Oberfläche: Oben die Kopfzeile mit „JM Timer“, der Anzeige „Show vom Master“ und dem Speaker-Knopf, darunter die Modi Clock, Countdown und Timetable mit den Haupttasten „Start“, „Resume“, „Pause“, „Reset“, „← Prev“ und „Next →“. Remote und Farben liegen jetzt im Panel hinter ⚙ als „LAN-Fernbedienung“ und „Farben“, dazu der Abschnitt „Speaker-Fenster“.“ |
| CL-TI2 | Timer 0.15.0 | „Neue Statusleiste mit vier Einträgen: Master, Sync, Speaker-Fenster und Fernsteuerung. Sie zeigt nur, was der Timer wirklich weiß; solange noch keine Antwort da ist, steht dort „unbekannt“.“ |
| CL-TI3 | Timer 0.15.0 | „Gesperrte Haupttasten nennen ihren Grund, zum Beispiel „Erster Programmpunkt“ oder „Nichts zurückzusetzen“. Die Kürzel Leertaste und R stehen auf den Tasten und gelten wie bisher nur im Countdown. Delay und Auto-Advance sind einklappbare Karten.“ |
| CL-TI4 | Timer 0.15.0 | „Hell und Dunkel per Schalter in der Kopfzeile, gemerkt je Rechner. Die Versionszeile „v0.1.0“ und die Zeile „Live Production“ in der Seitenleiste entfallen. Bedienung und Fernsteuerung (Port 8724) bleiben gleich.“ |
| CL-RD1 | Rundown 0.9.0 | „Neue Oberfläche: Oben die Kopfzeile mit „JM Rundown“, der Anzeige „Show vom Master“ und den Schaltern für Hell und Dunkel sowie Einstellungen, darunter die Werkzeugleiste mit Neu, Öffnen, Regieplan…, Export… und Speichern. Links steht die Liste mit den Haupttasten „GO“, „◀ Zurück“ und „Weiter ▶“, rechts der Editor der gewählten Zeile. Das Fenster „Tool-Verbindungen“ ist ins Panel hinter ⚙ umgezogen.“ |
| CL-RD2 | Rundown 0.9.0 | „Neue Statusleiste: Master, iveo, je ein Eintrag pro gefundenem Tool und die Fernsteuerung. Ein Tool, das im Netz gefunden, aber nicht verbunden ist, heißt „gefunden · nicht verbunden“; seine Adresse steht im Panel als „gefunden: host:port“.“ |
| CL-RD3 | Rundown 0.9.0 | „GO nennt seinen Grund, wenn keine Zeile im Ablauf ist („Keine Zeile im Ablauf“). Die Kürzel Leertaste, ↑ und ↓ stehen jetzt auf den Tasten und gelten wie bisher.“ |
| CL-RD4 | Rundown 0.9.0 | „Das Host-Feld einer Gegenstelle ist nicht mehr mit der gefundenen Adresse vorbelegt, und „Setzen“ geht erst mit einem gültigen Port. Bedienung, Fernsteuerung und Ablaufdateien bleiben gleich.“ |
| CL-QA1 | Q&A 0.7.0 | „Neue Oberfläche: Oben die Kopfzeile mit „JM Q&A“, „N wartend“, dem Sendezustand und den Schaltern für Hell und Dunkel sowie Einstellungen, darunter der Live-Bereich mit den Haupttasten „Nächste ▶“, „■ Beenden“ und „Saal-Einreichung“. Einstellungen, Kopplung, Extern und Moderation liegen jetzt im Panel hinter ⚙; die Fenster „Einstellungen“ und „Verbindungen“, die Karte „Kopplung“ und die beiden Kopf-Knöpfe dazu entfallen.“ |
| CL-QA2 | Q&A 0.7.0 | „Neue Statusleiste mit sechs Einträgen: Master, Extern, Kopplung Timer, Kopplung Titler, Fernsteuerung und Saal. Sie zeigt nur, was Q&A wirklich weiß; ein im Netz gefundener, aber nicht verbundener Timer oder Titler steht dort als „host:port · gefunden · nicht verbunden“.“ |
| CL-QA3 | Q&A 0.7.0 | „Die Saal-Einreichung ist eine Haupttaste mit Zustand („Saal-Einreichung ◉ An“ bzw. „○ Aus“). Die Zugangstexte für Fragen per Handy und per Livestream bleiben wie bisher.“ |
| CL-QA4 | Q&A 0.7.0 | „Zahlenfelder wie die Redezeit übernehmen den Wert bei Enter oder beim Verlassen des Feldes; Werte unter 5 setzt Q&A weiter auf 5. Bedienung und Fernsteuerung bleiben gleich, es gibt keine neuen Tastenkürzel.“ |
| CL-BA1 | Battle 0.5.0 | „Neue Oberfläche: Oben die Kopfzeile mit „JM Battle“, „Runde n/m“, dem Sendezustand und den Schaltern für Hell und Dunkel sowie Einstellungen, darunter der Live-Bereich mit den Haupttasten „VS“, „Voting öffnen“, „Nächste Runde ▶“ und „⧉ Clip“. Einstellungen, Verbindungen und Zurücksetzen liegen jetzt im Panel hinter ⚙; die Fenster „Einstellungen“ und „Verbindungen“ entfallen. Die Karte „Instant-Replay“ bleibt rechts im Live-Bereich.“ |
| CL-BA2 | Battle 0.5.0 | „Neue Statusleiste mit fünf Einträgen: Master, Titler, Fernsteuerung, Publikums-Voting und Aufnahme-Quelle. Sie zeigt nur, was Battle wirklich weiß.“ |
| CL-BA3 | Battle 0.5.0 | „Gesperrte Haupttasten nennen ihren Grund, zum Beispiel „Voting-Server ist aus“ oder „keine Aufnahme-Quelle“. Ist der Titler nicht verbunden, sagt ein Hinweis unter dem VS-Knopf, dass die Bauchbinde nicht erscheint. Die Rückfrage beim Zurücksetzen nennt jetzt auch, dass ein laufendes VS ausgeht.“ |
| CL-BA4 | Battle 0.5.0 | „Länge und Runden übernehmen den Wert bei Enter oder beim Verlassen des Feldes. Bedienung, Fernsteuerung und das VS-Bild bleiben gleich, es gibt keine neuen Tastenkürzel.“ |

## Entfällt

Sichtbare Texte, die mit dem Umbau wegfallen oder anders gesagt werden. Spalte „Ersatz“: was an die Stelle tritt, wenn etwas.

| Nr. | Werkzeug | Alter Text | Ersatz |
| --- | --- | --- | --- |
| EN1 | Timer | „v0.1.0“ (Seitenleiste, die Zahl war falsch; das Paket war 0.14.1) | keiner |
| EN2 | Timer | „Live Production“ (Seitenleiste, Markenzeile) | keiner; die Kopfzeile zeigt „JM Timer“ |
| EN3 | Switcher | „Video-Mischer · Program / Preview“ (Untertitel neben dem Namen) | keiner; die Kopfzeile zeigt „JM Switcher“ |
| EN4 | Switcher | Die Reiter „Mischer“ und „Einstellungen“ | Der Mischer ist immer sichtbar, die Einstellungen liegen im Panel hinter ⚙ |
| EN5 | Switcher, Timer | „Light“ bzw. „Dark“ (Knopf in der Kopfzeile) | Schalter für Hell und Dunkel aus dem gemeinsamen Baustein; die Wahl wird jetzt gemerkt |
| EN6 | Switcher | „Audiogerät 0“ (Ersatzbeschriftung eines unbenannten Geräts, gezählt ab 0) | „Audiogerät 1“ (gezählt ab 1) |
| EN7 | Timer | „Real-Time Clock“, „Countdown“, „Timetable“, „Remote · LAN“, „Timer Farben“ (Titel links in der Kopfzeile je Modus) | Die Kopfzeile zeigt nur noch „JM Timer“. Die Modi Clock, Countdown und Timetable behalten ihre Überschriften im Inhalt („Real-Time Clock“, „Countdown“, „Timetable · Regieplan“; die Kopfzeile sagte nur „Timetable“). „Remote · LAN“ und „Timer Farben“ heißen im Panel „LAN-Fernbedienung“ und „Farben“ |
| EN8 | Timer | Seitenleisten-Einträge „Remote“ (Hinweis „LAN“) und „Farben“ (Hinweis „Timer-States“) | Abschnitte „LAN-Fernbedienung“ und „Farben“ im Panel hinter ⚙ |
| EN9 | Timer | „Während der Timer läuft, Dauer per Delay-Karte rechts anpassen.“ | „Während der Timer läuft, Dauer per Delay anpassen.“ (Hinweis im Countdown; die Karte „Delay“ steht jetzt unter dem Countdown) |
| EN10 | Timer | „Space · Start / Pause      R · Reset“ (Hinweiszeile im Countdown) | Kürzel „Leertaste“ und „R“ auf den Haupttasten |
| EN11 | Timer | „Live“ (feste Pille an der Uhr) | keiner; „Live“ gibt es nur noch für echte On-Air-Quellen |
| EN12 | Timer | „Sync“ / „Offline“ (Pille in der Kopfzeile) und „Sync · Verbunden“ / „Sync · Offline“ (Remote-Ansicht) | Statusleiste „Sync“ mit „Verbunden mit JM Timer-Sync“ bzw. „Keine Verbindung“ |
| EN13 | Timer | „Remote · LAN-Browser“ (Kopf der Remote-Ansicht) und „Timer Farben“ (Kopf der Farben-Ansicht) | Abschnittstitel „LAN-Fernbedienung“ und „Farben“ |
| EN14 | Timer | Nur Anführungszeichen getauscht, Text sonst gleich: Platzhalter der Nachrichtenzeile und die Hinweise im Ablauf („Start Show“, „Next“ standen mit einem ASCII-Anführungszeichen am Ende) | gleicher Text mit „ “ |
| EN15 | Rundown | Knopf „Verbindungen …“ und das Fenster „Tool-Verbindungen“ | ⚙ in der Kopfzeile; Abschnitt „Gegenstellen“ im Panel; ein Klick auf einen Tool-Eintrag der Statusleiste öffnet ihn |
| EN16 | Rundown, Q&A, Battle | Fenster „Tool-Verbindungen“ (Erklärtext je Werkzeug, etwa „… Standard ist automatisch (mDNS); für Cross-Subnet einen Host/Port manuell setzen. „Auto“ entfernt den Override.“) | Erster Satz je Werkzeug als eigener Text (siehe Gegenstellen-Zeilen der Tabellen), der Rest aus dem gemeinsamen Text: „Standard ist automatisch (mDNS). Für ein anderes Subnetz oder blockiertes mDNS Host und Port setzen – das überschreibt den Fund. „Auto“ nimmt das wieder zurück.“ |
| EN17 | Rundown, Q&A, Battle | „IP (leer = mDNS)“ (Platzhalter Host) | „leer = automatisch“ (gemeinsamer Text) |
| EN18 | Rundown, Q&A, Battle | „nicht verbunden“ (Gegenstelle nicht im Netz gefunden) und „manuell host:port — suche …“ | „nicht gefunden“ bzw. „manuell: host:port · nicht verbunden“ (gemeinsame Texte); ein gefundenes, aber nicht verbundenes Tool heißt „gefunden · nicht verbunden“ (GE1) |
| EN19 | Rundown, Q&A, Battle | „verbunden host:port (mDNS)“ bzw. „(manuell)“ | „verbunden“ plus „gefunden: host:port“ bzw. „manuell: host:port“ |
| EN20 | Rundown, Q&A, Battle | Tooltip „zurück auf Auto/mDNS“ am Knopf „Auto“ | keiner; der Knopf trägt die Bezeichnung „Auto: ‹Tool›“ für Screenreader |
| EN21 | Rundown | Die Rückfall-Option mit dem rohen Verb im Auswahlfeld einer Aktion; die erste Option bei leerem Wert | „nicht verfügbar: ‹Verb›“ (gesperrte Option) bzw. „– bitte wählen –“ (gemeinsame Texte) |
| EN22 | Q&A | Die Fenster „Einstellungen“ und „Tool-Verbindungen“ (beide als Overlay über dem Inhalt) | Abschnitte „Redezeit und Kopplung“, „Extern“, „Moderation“ und „Gegenstellen“ im Panel hinter ⚙ |
| EN23 | Battle | „VS-Bauchbinde mit den Namen läuft über den Titler.“ (Zeile unter dem VS-Knopf) | Statuseintrag „Titler“ und Hinweis „Titler nicht verbunden: VS wird gesetzt, die Bauchbinde erscheint aber nicht.“; im Panel der Satz „Battle blendet die VS-Bauchbinde über den JM Titler ein.“ |
| EN24 | Battle | Kopf-Knöpfe „Verbindungen“, „Einstellungen“ und „VS“ (Titel „VS-Bauchbinde (Titler) on air“); die Fenster „Tool-Verbindungen“ und „Einstellungen“ | ⚙, Haupttaste „○ VS einblenden“ bzw. „● VS on air“ und das Panel |
| EN25 | Battle | Im Scoreboard nur das Zeichen „▶“ als Taste | „Nächste Runde ▶“ |
| EN26 | Q&A | Kopf-Knöpfe „Verbindungen“ und „Einstellungen“ | ⚙ in der Kopfzeile öffnet das Panel; ein Klick auf einen Eintrag der Statusleiste springt zum passenden Abschnitt |
| EN27 | Q&A | Karte „Kopplung“ rechts im Live-Bereich: Überschrift „Kopplung“, je Tool (Timer, Titler) die Zustände „aus“, „aktiviert · nicht gefunden“ und „gekoppelt · host:port“, die Knöpfe „An“ und „Aus“ mit den Tooltips „Auto-Kopplung ausschalten“ und „Auto-Kopplung einschalten“ | Statusleisten-Einträge „Timer“ und „Titler“ (Detail „aus“, „nicht gefunden“, „host:port“ bei Verbindung bzw. „host:port · gefunden · nicht verbunden“); die Schalter „Redezeit-Timer automatisch“ und „Bauchbinde automatisch“ im Panel-Abschnitt „Redezeit und Kopplung“; der Erklärsatz „Standardmäßig aktiv: …“ steht dort als Abschnitts-Hinweis (QA15) |

## Geänderte Bedienung

Keine Funktion fällt weg, aber an diesen Stellen verhält sich die Bedienung anders als bisher:

- Zahlenfelder (z. B. Dauer, Redezeit, Länge, Runden, Bitraten) übernehmen den Wert bei Enter oder beim Verlassen des Feldes, nicht mehr bei jedem Tastendruck.
- Die Pfeiltasten ↑ und ↓ ändern den Wert in Zahlenfeldern nicht mehr. Das gilt schon im abgenommenen Titler und kommt aus dem gemeinsamen Zahlenfeld; ein Wiederherstellen ist für Welle 1 nicht vorgesehen.
- Q&A, Redezeit: Eingaben unter 5 setzt Q&A beim Übernehmen weiter auf 5; es gibt weiter keine Obergrenze. Ein leeres Feld wird abgewiesen und der alte Wert bleibt, früher speicherte es 5.
- Das Host-Feld einer Gegenstelle (Rundown, Q&A, Battle) ist nicht mehr mit der gefundenen Adresse vorbelegt; die gefundene Adresse steht als „gefunden: host:port“ daneben. „Setzen“ ist gesperrt, bis der Port gültig ist (1 bis 65535), und nennt den Grund.
- Switcher: Der untere Bereich „Szenen, Ebenen und Quellen“ lässt sich einklappen.
- Timer: Delay und Auto-Advance sind einklappbare Karten unter dem Countdown.
- Gesperrte Haupttasten nennen ihren Grund, wo es vorher nur ein abgeblendeter Knopf war (z. B. Cut und Auto im Switcher, GO ohne Zeile im Rundown, Voting und Replay in Battle).
- Die Einstellungen liegen in allen fünf Werkzeugen im Panel hinter ⚙; Reiter, Overlays und Einstellungs-Fenster entfallen. Es gibt keine neuen Tastenkürzel; die vorhandenen Kürzel stehen jetzt auf den Tasten.
- Hell und Dunkel schaltest Du mit dem Schalter in der Kopfzeile; die Wahl wird je Rechner gemerkt.

## Fragen an den Owner

- Switcher, Audio: Die Statusleiste zeigt bei „— Kein Ton (stille Spur) —“ die Warnung „kein Gerät gewählt“, obwohl „Kein Ton“ eine bewusste Wahl sein kann. Soll das als „aus“ ohne Warnung erscheinen?
- Switcher: Die Panel-Texte zu NDI, Audio und Einleitung (siehe Ortshinweise) nennen „Mischer-Leiste“ und „Mischer-Ansicht“. Neu formulieren oder so lassen?
- Timer und Switcher: Die Zeilen „Live Production“ und „Video-Mischer · Program / Preview“ entfallen, weil die Kopfzeile links nur Logo und Toolname zeigt. Soll eine Untertitelzeile zurückkommen?
- Q&A: Soll der Satz „… hier ein Event erzeugen“ (Ortshinweise) umformuliert werden, weil er nun im Panel steht?
- Battle: „Battle zurücksetzen? Runden/Stimmen werden geleert (Namen bleiben). Ein laufendes VS geht aus.“ ist die neue Rückfrage; der letzte Satz ist neu.

## Handbuch

Die fünf Handbücher im Kochbuch nennen jetzt die neuen Orte (Panel ⚙, Statusleiste, Haupttasten, Live-Bereich) statt der alten (Reiter, Seitenleiste, Fenster „Einstellungen“). Alles andere im Handbuch bleibt wie es war. Je Stelle steht ein Satz in Klartext, dann der alte Text (`-`, in Code-Schrift) und der neue Text (`+`). Bitte sag mir, wenn eine Stelle anders klingen soll.

### Switcher

Der Steuerport wird jetzt im Panel ⚙ unter Fernsteuerung aktiviert, nicht mehr in „Companion-/Steuerung-Einstellungen“.

- `wird im Switcher aktiviert (Companion-/Steuerung-Einstellungen) bzw.`
+ wird im Switcher im Panel ⚙ › Fernsteuerung aktiviert (die Statusleiste zeigt den Eintrag „Fernsteuerung“) bzw.

Quellen legst Du im einklappbaren unteren Bereich des Mischers an.

- `Quellen hinzufügen (Bildschirm/Fenster, NDI, Capture-Karte)`
+ Quellen hinzufügen (Bildschirm/Fenster, NDI, Capture-Karte) im unteren Bereich „Szenen, Ebenen und Quellen“ des Mischers (lässt sich einklappen)

Die Audioquelle wählst Du im Panel unter „Audiogerät“, den Pegel siehst Du in der Ausgabeleiste unter den Haupttasten.

- `Audioquelle zuordnen und Pegel kontrollieren`
+ Audioquelle im Panel ⚙ › Audiogerät zuordnen und den Pegel in der Ausgabeleiste unter den Haupttasten kontrollieren

Das Stream-Ziel trägst Du im Panel unter „Streaming“ ein; ohne Ziel ist „Stream starten“ gesperrt und sagt warum.

- `Für Stream: RTMP-Ziel + Stream-Key hinterlegen und Verbindung testen`
+ Für Stream: RTMP-Ziel + Stream-Key im Panel ⚙ › Streaming hinterlegen und Verbindung testen (ohne Ziel ist die Haupttaste „Stream starten“ gesperrt und nennt den Grund)

Der Steuerport für Companion wird im Panel unter „Fernsteuerung“ aktiviert.

- `Optional: Steuerport aktivieren und Companion verbinden (Tasten für CUT/AUTO/PROGRAM/Szenen)`
+ Optional: Steuerport im Panel ⚙ › Fernsteuerung aktivieren und Companion verbinden (Tasten für CUT/AUTO/PROGRAM/Szenen)

Cut und Auto sind jetzt Haupttasten unter der Kopfzeile.

- `Mit CUT hart oder mit AUTO weich auf Program schalten`
+ Mit CUT hart oder mit AUTO weich auf Program schalten (Haupttasten „Cut“ und „Auto“ unter der Kopfzeile)

Aufnahme und Stream starten über Haupttasten; die Kopfzeile zeigt den Sendezustand.

- `Aufnahme (RECORD) und/oder Stream (STREAM) starten`
+ Aufnahme (RECORD) und/oder Stream (STREAM) starten (Haupttasten „Aufnehmen“ und „Stream starten“; die Kopfzeile zeigt dann „REC“ bzw. „LIVE“)

Den Stream-Zustand liest Du in der Statusleiste, den Pegel in der Ausgabeleiste.

- `Stream-Status (Bitrate, Drops) und Audiopegel beobachten`
+ Stream-Status (Bitrate, Drops) und Audiopegel beobachten: Statusleiste unten (Aufnahme, Stream, Audio), der Pegel in der Ausgabeleiste

Bei „Companion steuert nicht“ schaust Du zuerst auf die Statusleiste und das Panel Fernsteuerung.

- `Steuerport im Switcher aktiviert? Gleicher Port in Companion?`
+ Statusleiste „Fernsteuerung“ ansehen: Steuerport im Panel ⚙ › Fernsteuerung aktiviert? Gleicher Port in Companion?

Bei „Kein Ton im Stream“ prüfst Du das Panel Audiogerät, die Statusleiste Audio und die Ausgabeleiste.

- `Audioquelle zugeordnet? Pegel/Mute prüfen`
+ Audioquelle im Panel ⚙ › Audiogerät zugeordnet (Statusleiste „Audio“)? Pegel/Mute in der Ausgabeleiste prüfen

### Timer

Die Adressen für die Remote-View stehen jetzt im Panel „LAN-Fernbedienung“, nicht mehr in der Seitenleiste.

- `Die kopierbaren URLs stehen in der Operator-Sidebar unter „Remote".`
+ Die kopierbaren URLs stehen im Panel ⚙ › LAN-Fernbedienung.

Der Token-Schutz wird im Panel „LAN-Fernbedienung“ geschaltet, nicht in „den Einstellungen“.

- `(in den Einstellungen aktivierbar, Token neu generierbar)`
+ (im Panel ⚙ › LAN-Fernbedienung mit „Auth aktivieren“ einschaltbar, Token dort neu generierbar)

Das Sprecherfenster öffnest Du mit dem Speaker-Knopf in der Kopfzeile.

- `Sprecherfenster auf den Talent-Monitor schieben (Vollbild)`
+ Sprecherfenster mit dem Speaker-Knopf in der Kopfzeile öffnen (Statusleiste „Speaker-Fenster“, Einstellungen im Panel ⚙ › Speaker-Fenster) und auf den Talent-Monitor schieben (Vollbild)

Die URL für Backstage oder iPad holst Du aus dem Panel „LAN-Fernbedienung“.

- `Remote-View bei Bedarf: URL aus der „Remote"-Sidebar an Backstage/iPad geben`
+ Remote-View bei Bedarf: URL aus dem Panel ⚙ › LAN-Fernbedienung an Backstage/iPad geben

Port und verbundene Clients der Fernsteuerung zeigt die Statusleiste.

- `(Auto-Discovery über jm-timer-ctl) — oder`
+ (Auto-Discovery über jm-timer-ctl; Port und verbundene Clients zeigt die Statusleiste unter „Fernsteuerung“, Panel ⚙ › Fernsteuerung) — oder

Die lokale Bedienung läuft über die Haupttasten; Leertaste und R gelten wie bisher nur im Countdown.

- `Timer starten / stoppen / zurücksetzen (lokal oder per Companion: TIMER START/STOP/RESET)`
+ Timer starten / stoppen / zurücksetzen (lokal mit den Haupttasten „Start“, „Resume“/„Pause“ und „Reset“, im Countdown auch Leertaste und R; per Companion: TIMER START/STOP/RESET)

Die Nachrichtenleiste liegt über dem Inhalt.

- `Kurznachricht für die Bühne einblenden;`
+ Kurznachricht für die Bühne einblenden (Nachrichtenleiste über dem Inhalt);

Das Token holst Du aus dem Panel „LAN-Fernbedienung“, nicht aus „den Einstellungen“.

- `Token aus den Einstellungen verwenden oder neu generieren`
+ Token aus dem Panel ⚙ › LAN-Fernbedienung verwenden oder dort neu generieren

Bei „Companion/Rundown steuert nicht“ liest Du zuerst die Statusleiste.

- `Steuerport offen? jm-timer-ctl im mDNS sichtbar?`
+ Steuerport offen (Statusleiste „Fernsteuerung“)? jm-timer-ctl im mDNS sichtbar?

### Rundown

Zeilen und Aktionen legst Du in der Liste und im Editor rechts an.

- `Rundown-Zeilen je Segment anlegen und die Aktionen pro Zeile zuordnen`
+ Rundown-Zeilen je Segment in der Liste anlegen („+ Zeile hinzufügen“) und die Aktionen pro Zeile im Editor rechts zuordnen („+ Aktion hinzufügen“)

Den Zustand der gefundenen Tools liest Du in der Statusleiste; Host und Port setzt Du im Panel unter „Gegenstellen“.

- `Live-Status der gefundenen Tools prüfen (grün = ansteuerbar)`
+ Status der gefundenen Tools in der Statusleiste prüfen (ein Eintrag je Tool; „verbunden“ = ansteuerbar, „gefunden · nicht verbunden“ = im Netz da, aber nicht verbunden; Host und Port bei Bedarf im Panel ⚙ › Gegenstellen setzen)

Die Fernsteuerung für Companion zeigt die Statusleiste und das Panel „Fernsteuerung“.

- `Optional: Companion auf Port 8731 / jm-rundown-ctl verbinden für Fern-GO`
+ Optional: Companion auf Port 8731 / jm-rundown-ctl verbinden für Fern-GO (Statusleiste „Fernsteuerung“, Panel ⚙ › Fernsteuerung)

Gespeichert wird über die Werkzeugleiste.

- `Als .jmrundown speichern`
+ Als .jmrundown speichern (Werkzeugleiste: Speichern)

GO ist eine Haupttaste (auch Leertaste); Zurück und Weiter wählen nur die Zeile.

- `Pro Segment GO drücken — feuert alle zugeordneten Aktionen gleichzeitig (lokal oder per RUNDOWN GO)`
+ Pro Segment die Haupttaste „GO“ drücken (oder die Leertaste) — feuert alle zugeordneten Aktionen gleichzeitig (lokal oder per RUNDOWN GO); „◀ Zurück“ und „Weiter ▶“ wählen die Zeile, ohne zu feuern

Der Live-Status und die Tally-Anzeige sind jetzt die Statusleiste.

- `Live-Status / Tally im Blick behalten`
+ Statusleiste im Blick behalten (Verbindung je Tool und seine aktiven Rückmeldungen)

Bei einem Tool, das nicht gefunden wird, schaust Du in die Statusleiste.

- `Gleiches Subnetz? Tool gestartet?`
+ Statusleiste: Eintrag des Tools fehlt oder steht auf „nicht gefunden“. Gleiches Subnetz? Tool gestartet?

Bei „GO feuert nicht alle Aktionen“ prüfst Du den Statusleisten-Eintrag des Tools.

- `Live-Status des betroffenen Tools prüfen`
+ Statusleiste: Eintrag des betroffenen Tools prüfen

Bei „Companion-GO ohne Wirkung“ schaust Du zuerst auf die Statusleiste.

- `Companion zeigt auf Port 8731 (jm-rundown-ctl)? Gemeinsames LAN?`
+ Statusleiste „Fernsteuerung“ ansehen; Companion zeigt auf Port 8731 (jm-rundown-ctl)? Gemeinsames LAN?

Port und Endpunkt ordnest Du im Panel „Gegenstellen“ neu zu.

- `Ziel-Tool neu gestartet → Port/Endpunkt erneut zuordnen`
+ Ziel-Tool neu gestartet → Port/Endpunkt erneut zuordnen (Panel ⚙ › Gegenstellen)

Die Checkliste fragt jetzt nach der Statusleiste statt nach dem Live-Status.

- `Live-Status grün`
+ Statusleiste: gefundene Tools verbunden

### Q&A

Die Saal-Einreichung schaltest Du mit der Haupttaste im Live-Bereich.

- `QR-Einreichung aktivieren (Port 7782) — Erreichbarkeit der Einreich-Seite vom Gäste-WLAN testen`
+ QR-Einreichung mit der Haupttaste „Saal-Einreichung“ im Live-Bereich aktivieren („◉ An“, Port 7782; der QR steht rechts im Live-Bereich) — Erreichbarkeit der Einreich-Seite vom Gäste-WLAN testen

Die Moderation stellst Du im Panel unter „Moderation“ ein.

- `Moderation/Freigabe einstellen (Filter vor Veröffentlichung)`
+ Moderation/Freigabe im Panel ⚙ › Moderation einstellen (Filter vor Veröffentlichung)

Die Kopplung zu Timer und Titler zeigt die Statusleiste; die Schalter stehen im Panel „Redezeit und Kopplung“.

- `prüfen — beide im selben LAN gestartet`
+ prüfen — beide im selben LAN gestartet. Die Statusleiste zeigt „Kopplung Timer“ und „Kopplung Titler“, die Schalter dazu stehen im Panel ⚙ › Redezeit und Kopplung

Die Fernsteuerung für Companion zeigt die Statusleiste und das Panel „Fernsteuerung“.

- `Optional: Companion auf Port 8733 verbinden (NEXT/END/EXTEND/CLEAR)`
+ Optional: Companion auf Port 8733 verbinden (NEXT/END/EXTEND/CLEAR; Statusleiste „Fernsteuerung“, Panel ⚙ › Fernsteuerung)

„Nächste ▶“ ist die Haupttaste zum Ans-Wort-Holen.

- `Per Klick (oder QA NEXT) jemanden ans Wort holen`
+ Per Klick (Haupttaste „Nächste ▶“ oder QA NEXT) jemanden ans Wort holen

„■ Beenden“ ist die Haupttaste zum Beenden.

- `Wortbeitrag beenden mit QA END`
+ Wortbeitrag beenden mit „■ Beenden“ oder QA END

Bei „QR-Einreichung kommt nicht an“ prüfst Du zuerst die Haupttaste „Saal-Einreichung“.

- `Gäste-WLAN erreicht Port 7782 am Host?`
+ Haupttaste „Saal-Einreichung“ auf „◉ An“? Gäste-WLAN erreicht Port 7782 am Host?

Bei „Timer/Titler reagieren nicht“ liest Du die beiden Kopplungs-Einträge der Statusleiste.

- `Beide im selben LAN gestartet? mDNS/Firewall prüfen`
+ Statusleiste „Kopplung Timer“ bzw. „Kopplung Titler“ lesen (aus, nicht gefunden, gefunden · nicht verbunden). Beide im selben LAN gestartet? mDNS/Firewall prüfen

Bei „Companion steuert nicht“ liest Du zuerst die Statusleiste.

- `Port 8733 (jm-qa-ctl) erreichbar? Gemeinsames LAN?`
+ Statusleiste „Fernsteuerung“ ansehen; Port 8733 (jm-qa-ctl) erreichbar? Gemeinsames LAN?

Die Kopplung zum Titler schaltest Du im Panel „Redezeit und Kopplung“, nicht in „den Q&A-Einstellungen“.

- `TITLER TEXT-Kopplung in den Q&A-Einstellungen aktiv?`
+ Schalter „Bauchbinde automatisch“ im Panel ⚙ › Redezeit und Kopplung an?

### Battle

Namen stehen in den Ecken A und B, die Rundenzahl im Panel „Battle“.

- `Kontrahenten und Runden anlegen`
+ Kontrahenten (Name und Crew in den Ecken A und B) und Runden (Panel ⚙ › Battle) anlegen

Den Titler siehst Du in der Statusleiste, die VS-Bauchbinde schaltest Du mit der Haupttaste „VS“.

- `VS-Bauchbinde über JM Titler prüfen (BATTLE VS on/off blendet sie ein/aus)`
+ VS-Bauchbinde über JM Titler prüfen (Statusleiste „Titler“; die Haupttaste „VS“ bzw. BATTLE VS on/off blendet sie ein/aus; ist der Titler nicht verbunden, sagt ein Hinweis unter der Taste, dass die Bauchbinde nicht erscheint)

Das Voting richtest Du im Panel „Battle“ und in der Karte „Publikums-Voting“ im Live-Bereich ein.

- `Voting konfigurieren (Jury-Entscheid und/oder Publikum per QR, Port 7783)`
+ Voting konfigurieren (Jury-Entscheid und/oder Publikum per QR, Port 7783): Schalter „Publikums-Voting“ im Panel ⚙ › Battle, Server mit „◉ An“ in der Karte „Publikums-Voting“ rechts im Live-Bereich; die Statusleiste zeigt „Publikums-Voting“

Die Aufnahmequelle wählst Du in der Karte „Instant-Replay“, den Zielordner im Panel.

- `Aufnahmequelle für den Instant-Replay verbinden`
+ Aufnahmequelle für den Instant-Replay verbinden (Karte „Instant-Replay“ rechts im Live-Bereich, Knopf „Aufnahme …“; Zielordner im Panel ⚙ › Instant-Replay; Statusleiste „Aufnahme-Quelle“)

Die Fernsteuerung für Companion zeigt die Statusleiste und das Panel „Fernsteuerung“.

- `Optional: Companion auf Port 8734 verbinden`
+ Optional: Companion auf Port 8734 verbinden (Statusleiste „Fernsteuerung“, Panel ⚙ › Fernsteuerung)

VS blendest Du mit der Haupttaste „VS“ ein.

- `Runde starten, VS-Bauchbinde einblenden (BATTLE VS on)`
+ Runde starten, VS-Bauchbinde einblenden (Haupttaste „VS“ bzw. BATTLE VS on)

Voting öffnest Du mit der Haupttaste, den Sieger setzt Du mit den Jury-Knöpfen im Scoreboard.

- `Voting öffnen (BATTLE VOTING on), dann schließen (off); Sieger setzen mit BATTLE WIN a|b|tie`
+ Voting öffnen (Haupttaste „Voting öffnen“ bzw. BATTLE VOTING on), dann schließen (off); Sieger setzen mit den Jury-Knöpfen im Scoreboard oder BATTLE WIN a|b|tie

Den Replay-Clip schneidest Du mit der Haupttaste „⧉ Clip“.

- `Bei Bedarf BATTLE REPLAY — letzte Sekunden aus der Aufnahme abspielen`
+ Bei Bedarf Haupttaste „⧉ Clip“ bzw. BATTLE REPLAY — letzte Sekunden aus der Aufnahme abspielen

In die nächste Runde geht es mit der Haupttaste „Nächste Runde ▶“.

- `Mit BATTLE NEXT in die nächste Runde`
+ Mit „Nächste Runde ▶“ bzw. BATTLE NEXT in die nächste Runde

Zurückgesetzt wird im Panel unter „Zurücksetzen“; die Rückfrage nennt, dass ein laufendes VS ausgeht.

- `Ergebnisse sichern; BATTLE RESET für das nächste Battle`
+ Ergebnisse sichern; Zurücksetzen für das nächste Battle im Panel ⚙ › Zurücksetzen (die Rückfrage nennt, dass ein laufendes VS ausgeht) oder per BATTLE RESET

Bei „VS-Bauchbinde fehlt“ liest Du die Statusleiste und den Schalter „VS-Bauchbinde automatisch“.

- `JM Titler im selben LAN gestartet? BATTLE VS on gesendet?`
+ Statusleiste „Titler“ lesen; Schalter „VS-Bauchbinde automatisch“ im Panel ⚙ › Battle an? JM Titler im selben LAN gestartet? BATTLE VS on gesendet?

Bei „Instant-Replay ist leer“ schaust Du auf die Statusleiste „Aufnahme-Quelle“.

- `Quelle/Verbindung prüfen`
+ Quelle/Verbindung prüfen (Statusleiste „Aufnahme-Quelle“)

Bei „QR-Voting kommt nicht an“ prüfst Du zuerst den Server in der Karte und den Schalter im Panel.

- `Gäste-WLAN erreicht Port 7783 am Host?`
+ Server in der Karte „Publikums-Voting“ auf „◉ An“, Schalter „Publikums-Voting“ im Panel ⚙ › Battle an? Gäste-WLAN erreicht Port 7783 am Host?

Bei „Companion steuert nicht“ liest Du zuerst die Statusleiste.

- `Port 8734 (jm-battle-ctl) erreichbar? Gemeinsames LAN?`
+ Statusleiste „Fernsteuerung“ ansehen; Port 8734 (jm-battle-ctl) erreichbar? Gemeinsames LAN?

Freigabe: ☐ alle Texte wie hier ☐ mit Änderungen (bitte je Nr. notieren)
