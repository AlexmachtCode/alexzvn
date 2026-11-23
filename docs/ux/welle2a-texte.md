# UX-Update Welle 2a: Texte zur Freigabe durch den Owner

Zweck: Alle neuen und geänderten sichtbaren Texte der sechs umgebauten Werkzeuge (Caption, Interpreter, Prompter, Stage Display, Recorder, Player) zur Freigabe durch den Owner. Texte der gemeinsamen Bausteine aller Tools (Oberfläche und Einstellungen) stehen nicht hier: Sie sind seit Welle 0 bzw. Welle 1 freigegeben, und die Welle 2a ändert an ihnen nichts (`packages/ui` und `packages/settings` sind auf diesem Branch unverändert). Einen Abschnitt „Gemeinsam“ gibt es deshalb nicht.

Stand: Branch `feat/ux-welle2a`, Code-Stand `ff4f8cd8fc` (alle 32 Aufgaben der sechs Werkzeuge fertig). Die Versionen sind Caption 0.6.0, Interpreter 0.3.0, Prompter 0.8.0, Stage Display 0.7.0, Recorder 0.10.0 und Player 0.9.0; das Datum der Changelog-Einträge (22.11.2026) ist ein Platzhalter und wird am Tag der Veröffentlichung gesetzt.

Lesehilfe: ‹…› steht für den Teil, der sich zur Laufzeit ändert (eine Zahl oder ein Name). Beispiel: „‹…› Pads spielen“ erscheint als „3 Pads spielen“. Die Nummer (z. B. PL12) nennst Du bitte bei jeder Änderung, die Du wünschst. Die Spalte „Ort“ sagt, wo der Text steht: Kopf (Kopfzeile), Haupttaste (große Taste im Live-Bereich), Statusleiste (unten), Panel (Einstellungen hinter ⚙), Live-Bereich, Hinweis. Wie in Welle 1 steht je Werkzeug jeder Text seiner Textkonstante, auch wo der Wortlaut der bisherige ist und nur der Ort neu; der Satz über jeder Tabelle nennt, was neu formuliert ist.

Aufbau: je Werkzeug eine Tabelle, dann „Ortshinweise“ (alte Texte, die einen verschobenen Ort nennen), „Changelog“, „Entfällt“, „Geänderte Bedienung“ und „Offene Fragen“.

## Caption

Neu formuliert sind CA9 bis CA11, CA23 bis CA25, CA30, CA34, CA35, CA37 und CA39 bis CA41. CA1, CA2, CA6 und CA7 sind der alte Wortlaut ohne die Symbole ● ■ ○ ◉. Alle übrigen sind der bisherige Wortlaut, jetzt im Panel oder im Live-Bereich.

| Nr. | Ort | Text |
| --- | --- | --- |
| CA1 | Haupttaste (Start/Stopp, in Ruhe) | „Start“ |
| CA2 | Haupttaste (Start/Stopp, solange die Erkennung läuft) | „Stopp“ |
| CA3 | Haupttaste (Hold, aus) | „Hold“ |
| CA4 | Haupttaste (Hold, an) | „Hold ✓“ |
| CA5 | Haupttaste | „Leeren“ |
| CA6 | Haupttaste (NDI, aus; oben links, auf dem alten Platz des NDI-Knopfs) | „NDI starten“ |
| CA7 | Haupttaste (NDI, an) | „NDI an“ |
| CA8 | Haupttaste (Sperrgrund aller vier Tasten, bis der Hauptprozess antwortet; ebenso in der Live-Zeile und im Abschnitt NDI-Ausgabe, dort als „Gesperrt: Lädt …“) | „Lädt …“ |
| CA9 | Statusleiste (Titel) | „NDI“ |
| CA10 | Statusleiste (NDI, solange der Sender Bilder meldet: Zustand und Empfängerzahl aus den gemeinsamen Texten, z. B. „sendet, 2 Empfänger“) | „‹…›, ‹…›“ |
| CA11 | Statusleiste (Titel) | „Mikrofon“ |
| CA12 | Panel (Audiogerät, Beschriftung der Wahl; vorher Tooltip des Auswahlfelds im Kopf) | „Audio-Eingang (Mikrofon)“ |
| CA13 | Panel (Audiogerät, Option für das Standardgerät) | „System-Standard (Mikrofon)“ |
| CA14 | Panel (Audiogerät, Name eines Eingangs ohne Namen, gezählt ab 1) | „Audiogerät ‹…›“ |
| CA15 | Live-Bereich (Live-Zeile, solange keine Zeile da ist) | „— bereit —“ |
| CA16 | Live-Bereich (Überschrift der Vorschau) | „NDI-Vorschau“ |
| CA17 | Live-Bereich (an der Vorschau, solange Hold an ist; jetzt umrahmt) | „eingefroren“ |
| CA18 | Live-Bereich (Pegelzeile) | „Pegel“ |
| CA19 | Live-Bereich (Pegelzeile, Zahl der Zeilen im Verlauf) | „‹…› Zeilen“ |
| CA20 | Live-Bereich (Verlauf, leer) | „Noch keine Untertitel.“ |
| CA21 | Live-Bereich (Verlauf, Tooltip der jüngsten Zeile) | „Doppelklick: letzte Zeile korrigieren“ |
| CA22 | Live-Bereich (Text unter den Haupttasten bei einem Mikrofonfehler; vorher eigenes rotes Band) | „Mikrofon: ‹…›“ |
| CA23 | Panel (Abschnittstitel; vorher Kopfleiste und Klappe „Erweitert“) | „Erkennung“ |
| CA24 | Panel (Erkennung, Beschriftung; vorher ohne) | „Modell“ |
| CA25 | Panel (Erkennung, Beschriftung; vorher ohne) | „Sprache“ |
| CA26 | Panel (Erkennung) | „Engine“ |
| CA27 | Panel (Erkennung) | „Fachwörter-Wörterbuch (eine je Zeile)“ |
| CA28 | Panel (Erkennung, Platzhalter des Wörterbuchs in vier Zeilen; ‹…› steht hier für den Zeilenumbruch) | „z. B.‹…›Jakobs Medien‹…›iveo‹…›NITROVON“ |
| CA29 | Panel (Erkennung) | „Max. Äußerung (s)“ |
| CA30 | Panel (Abschnittstitel; vorher Teil der NDI-Leiste) | „Darstellung“ |
| CA31 | Panel (Darstellung) | „Schrift“ |
| CA32 | Panel (Darstellung) | „Zeilen“ |
| CA33 | Panel (Darstellung, Kontrollkästchen) | „Band“ |
| CA34 | Statusleiste (Titel) | „Whisper“ |
| CA35 | Statusleiste (Whisper) | „verfügbar“ |
| CA36 | Statusleiste (Whisper, während eine Äußerung umgeschrieben wird) und Live-Bereich (neben dem Pegel, wie bisher) | „transkribiert …“ |
| CA37 | Statusleiste (Whisper) | „fehlt“ |
| CA38 | Hinweis (Live-Bereich, wenn whisper.cpp fehlt; vorher gelbes Band) | „whisper.cpp ist hier nicht gebündelt — Transkription läuft erst nach dem Office-Build (Binary + Modell).“ |
| CA39 | Statusleiste (Titel; der Fehler selbst steht als Text daneben) | „Fehler“ |
| CA40 | Statusleiste (Fehler) | „kein Fehler“ |
| CA41 | Panel (Fernsteuerung, Modulname im Companion-Hinweis) | „JM Caption“ |

## Interpreter

Neu formuliert sind IN4 bis IN6, IN11, IN14 bis IN16, IN23, IN37 und IN38; IN39 ist nach E10 geändert (alter Wortlaut unter „Entfällt“). IN3 stand bisher nur als Tooltip an der Taste. Alle übrigen sind der bisherige Wortlaut, jetzt im Panel, in der Statusleiste oder unverändert im Live-Bereich.

| Nr. | Ort | Text |
| --- | --- | --- |
| IN1 | Haupttaste (in Ruhe) | „Starten“ |
| IN2 | Haupttaste (solange der Mix läuft) | „Stoppen“ |
| IN3 | Haupttaste (Sperrgrund, sichtbar unter der Taste und weiter als Tooltip) | „Erst beide Eingänge wählen“ |
| IN4 | Haupttaste (Sperrgrund bis zur ersten Antwort der Engine, einen Bildaufbau lang) | „Lädt …“ |
| IN5 | Kopf (Sendezustand, solange der Mix läuft) | „MIX AKTIV“ |
| IN6 | Panel (Audiogerät, Hinweis an jeder der drei Wahlen) und Statusleiste (Floor, Dolmetscher, Ausgabegerät im Betrieb bei geänderter Wahl, z. B. „‹Gerät› · Wirkt erst nach Stopp und erneutem Start.“). Bei einer im Betrieb geänderten Ausgabe zeigt der Live-Bereich zusätzlich wie bisher die Karte „Das Ausgabegerät wurde geändert, der Interpreter sendet aber noch auf das beim Start gewählte Gerät. Die Änderung wirkt erst, wenn er gestoppt und erneut gestartet wird.“ (Nr. 61); die Warnung steht dann doppelt | „Wirkt erst nach Stopp und erneutem Start.“ |
| IN7 | Panel (Audiogerät, Beschriftung der Wahl) | „Floor (O-Ton)“ |
| IN8 | Statusleiste (Titel), Live-Bereich (Pegel) und Panel (Ducking, Vorverstärkung) | „Floor“ |
| IN9 | Panel (Audiogerät, Wahl; Ducking, Vorverstärkung), Statusleiste (Titel) und Live-Bereich (Pegel) | „Dolmetscher“ |
| IN10 | Panel (Audiogerät, Beschriftung der Wahl) | „Ausgabe (virtuelles Kabel)“ |
| IN11 | Statusleiste (Titel) | „Ausgabegerät“ |
| IN12 | Panel (Audiogerät, Option ohne eigenes Gerät) und Statusleiste (Ausgabegerät) | „Systemstandard“ |
| IN13 | Panel (Abschnittstitel; vorher Kartentitel) und Statusleiste (Titel) | „Ducking“ |
| IN14 | Statusleiste (Ducking) | „abgesenkt“ |
| IN15 | Statusleiste (Ducking) | „offen“ |
| IN16 | Statusleiste (Ducking, solange Überbrücken an ist; nie „offen“) | „überbrückt“ |
| IN17 | Panel (Ducking, Kontrollkästchen) | „Überbrücken (zum Vergleichshören)“ |
| IN18 | Panel (Ducking, Unterüberschrift; vorher eigene Karte) | „Vorverstärkung“ |
| IN19 | Panel (Ducking, Knopf am Ende des Abschnitts; vorher in der Karte „Vorverstärkung“) | „Ducking-Werte zurücksetzen“ |
| IN20 | Live-Bereich (Kartentitel) | „Pegel“ |
| IN21 | Live-Bereich (Anzeige in der Karte „Pegel“) | „FLOOR ABGESENKT“ |
| IN22 | Live-Bereich (Anzeige in der Karte „Pegel“) | „Floor offen“ |
| IN23 | Live-Bereich (neben der Anzeige, nur solange Überbrücken an ist) | „Überbrückt“ |
| IN24 | Live-Bereich (Pegelwert ohne Signal) | „—“ |
| IN25 | Live-Bereich (Pegelwert) | „‹…› dB“ |
| IN26 | Live-Bereich (Tooltip der Schwellenmarke) | „Schwelle ‹…› dB“ |
| IN27 | Panel (Ducking, Regler) | „Schwelle“ |
| IN28 | Panel (Ducking, Hinweis am Regler) | „Ab diesem Dolmetscher-Pegel wird der O-Ton abgesenkt.“ |
| IN29 | Panel (Ducking, Regler) | „Absenkung“ |
| IN30 | Panel (Ducking, Hinweis am Regler) | „Wie weit der O-Ton zurückgeht, solange gesprochen wird.“ |
| IN31 | Panel (Ducking, Regler) | „Attack“ |
| IN32 | Panel (Ducking, Hinweis am Regler) | „Wie schnell abgesenkt wird.“ |
| IN33 | Panel (Ducking, Regler) | „Release“ |
| IN34 | Panel (Ducking, Hinweis am Regler) | „Wie schnell der O-Ton zurückkommt.“ |
| IN35 | Panel (Ducking, Regler) | „Nachlauf“ |
| IN36 | Panel (Ducking, Hinweis am Regler) | „Atempausen kürzer als der Nachlauf reißen den O-Ton nicht hoch (verhindert Pumpen).“ |
| IN37 | Statusleiste (Titel; der Fehler selbst steht als Text daneben) | „Fehlermeldung“ |
| IN38 | Statusleiste (Fehlermeldung) | „kein Fehler“ |
| IN39 | Hinweis (Kabel-Karte im Live-Bereich, wenn das gewählte Ausgabegerät fehlt; geändert nach E10, R9) | „Das gewählte Ausgabegerät ist derzeit nicht verfügbar. Der Start schlägt damit fehl.“ |

## Prompter

Neu formuliert sind PR4 bis PR7, PR10 bis PR14, PR17, PR18, PR20, PR21, PR24 und PR25. PR1 bis PR3 sind der alte Wortlaut ohne die Symbole ▶ ❙❙ ⟲; PR19 hat keinen Schlusspunkt mehr (Ruling R-T5a). Alle übrigen sind der bisherige Wortlaut, jetzt im Panel oder im Live-Bereich.

| Nr. | Ort | Text |
| --- | --- | --- |
| PR1 | Haupttaste (GO/Pause, Text steht) | „GO“ |
| PR2 | Haupttaste (GO/Pause, Text läuft) | „Pause“ |
| PR3 | Haupttaste | „Anfang“ |
| PR4 | Haupttaste (Tooltip PR8) | „Marke zurück“ |
| PR5 | Haupttaste (Tooltip PR9) | „Marke vor“ |
| PR6 | Haupttaste (Kürzel an GO/Pause) | „Leertaste“ |
| PR7 | Haupttaste (Kürzel an Anfang) | „Pos1“ |
| PR8 | Haupttaste (Tooltip an Marke zurück, wie bisher) | „Voriger Abschnitt“ |
| PR9 | Haupttaste (Tooltip an Marke vor, wie bisher) | „Nächster Abschnitt“ |
| PR10 | Hinweis (Live-Bereich, unter dem Tempo; ersetzt den Tastenhinweis im Kopf) | „Leertaste, Pfeiltasten und Pos1 steuern den Lauf, solange der Cursor nicht im Skript oder in einem Feld steht.“ |
| PR11 | Statusleiste (Titel) | „Talent-Monitor“ |
| PR12 | Statusleiste (Talent-Monitor) | „zu“ |
| PR13 | Statusleiste (Talent-Monitor; mit dem Bildschirm, sobald die Liste ihn kennt: „offen · ‹Bildschirm›“) | „offen“ |
| PR14 | Statusleiste (Talent-Monitor) | „abgestürzt“ |
| PR15 | Panel (Knopf unter „Ausgabe auf Bildschirm“, nur bei offenem Monitor; vorher Beschriftung des Öffnen-Knopfs bei offenem Monitor) | „Auf diesen Bildschirm“ |
| PR16 | Panel (Ausgabe auf Bildschirm, Zusatz im Namen des Hauptbildschirms in der Auswahl, z. B. „Monitor 1 · primär (1920×1080)“; wie bisher) | „· primär“ |
| PR17 | Panel (Abschnittstitel) und Statusleiste (Titel) | „Handy-Fernbedienung“ |
| PR18 | Statusleiste (Handy-Fernbedienung an, Server nicht gestartet; der Grund steht nur im Protokoll) | „nicht gestartet“ |
| PR19 | Statusleiste (Handy-Fernbedienung läuft ohne Adresse) und Panel (Handy-Fernbedienung; geändert, ohne Schlusspunkt) | „Keine LAN-Adresse gefunden“ |
| PR20 | Statusleiste (Handy-Fernbedienung läuft) | „1 Adresse“ |
| PR21 | Statusleiste (Handy-Fernbedienung läuft) | „‹…› Adressen“ |
| PR22 | Live-Bereich (Regler) und Statusleiste (Titel) | „Tempo“ |
| PR23 | Live-Bereich (Einheit am Regler) und Statusleiste (Tempo, z. B. „1.5 Z/s“, die Zahl wie am Regler) | „Z/s“ |
| PR24 | Panel (Fernsteuerung, Modulname im Companion-Hinweis) | „JM Prompter“ |
| PR25 | Panel (Abschnittstitel; vorher „Lauf & Schrift“, das Tempo steht jetzt im Live-Bereich) | „Schrift“ |
| PR26 | Panel (Abschnittstitel) | „Lese-Linie“ |
| PR27 | Panel (Abschnittstitel) | „Darstellung“ |

## Stage-Display

Neu formuliert sind SD1 bis SD4, SD25 und SD32 bis SD35. Alle übrigen sind der bisherige Wortlaut, jetzt im Panel, als Haupttaste oder in der Statusleiste.

| Nr. | Ort | Text |
| --- | --- | --- |
| SD1 | Statusleiste (Titel; vorher Teil des Abschnittstitels „Ausgabe (Bühnenschirm)“) | „Bühnenschirm“ |
| SD2 | Statusleiste (Bühnenschirm) | „zu“ |
| SD3 | Statusleiste (Bühnenschirm; mit dem Bildschirm, sobald die Liste ihn kennt: „offen · ‹Bildschirm›“) | „offen“ |
| SD4 | Statusleiste (Bühnenschirm) | „abgestürzt“ |
| SD5 | Panel (Knopf unter „Ausgabe auf Bildschirm“, nur bei offenem Schirm; wie bisher) | „Auf diesen Bildschirm“ |
| SD6 | Panel (Ausgabe auf Bildschirm, Zusatz im Namen des Hauptbildschirms in der Auswahl; wie bisher) | „· primär“ |
| SD7 | Haupttaste (Bühnenschirm zu; vorher eigener Knopf) | „Vollbild-Ausgabe öffnen“ |
| SD8 | Haupttaste (Bühnenschirm offen; vorher eigener Knopf) | „Ausgabe schließen“ |
| SD9 | Panel (Gegenstellen, Name der Quelle) und Statusleiste (Titel) | „JM Timer“ |
| SD10 | Panel (Gegenstellen, Name der Quelle) und Statusleiste (Titel) | „JM Switcher“ |
| SD11 | Panel (Gegenstellen, Name der Quelle) und Statusleiste (Titel) | „JM Presenter“ |
| SD12 | Live-Bereich (bis der Hauptprozess antwortet; jetzt mit Kopf und Statusleiste) | „Lädt…“ |
| SD13 | Live-Bereich (Überschrift) | „Vorschau“ |
| SD14 | Live-Bereich (Feld, direkt unter der Vorschau) | „Nachricht (Ad-hoc, hat Vorrang vor Timer-Nachricht)“ |
| SD15 | Live-Bereich (Platzhalter des Felds) | „z. B. „Bitte Plätze einnehmen“ — leer = Timer-Nachricht“ |
| SD16 | Live-Bereich (Überschrift der Schalterreihe) | „Anzeige-Elemente“ |
| SD17 | Live-Bereich (Schalter; vorher Kontrollkästchen) | „Uhr“ |
| SD18 | Live-Bereich (Schalter) | „Timer/Countdown“ |
| SD19 | Live-Bereich (Schalter) | „Switcher-Status“ |
| SD20 | Live-Bereich (Schalter) | „Presenter (REF)“ |
| SD21 | Live-Bereich (Schalter) und Statusleiste (Titel) | „Nachricht“ |
| SD22 | Panel (Gegenstellen, Hinweis zu JM Timer; jetzt als Liste unter dem Abschnitt, weil der gemeinsame Abschnitt keinen Platz für Hinweise hat; vorher rechts neben dem Namen) | „Countdown · Programmpunkt · Nachricht (Port 7777)“ |
| SD23 | Panel (Gegenstellen, Hinweis zu JM Switcher, Liste unter dem Abschnitt) | „Program/Preview · REC/Stream (Companion-Port)“ |
| SD24 | Panel (Gegenstellen, Hinweis zu JM Presenter, Liste unter dem Abschnitt) | „Referentenansicht: Folie · Notizen · Nächste (Fernsteuerung im Presenter aktivieren, Port 7330)“ |
| SD25 | Panel (Abschnittstitel, nur bei eingeschalteter Presenter-Quelle wie bisher; vorher Teil der Presenter-Karte) | „Presenter-Kopplung“ |
| SD26 | Panel (Presenter-Kopplung, Feld und Platzhalter) | „PIN“ |
| SD27 | Panel (Presenter-Kopplung, Hinweis und Tooltip am Feld) | „PIN nur falls die Presenter-Fernsteuerung mit PIN läuft — sonst leer lassen“ |
| SD28 | Panel (Presenter-Kopplung, Beschriftung der Umschalter) | „Anzeige“ |
| SD29 | Panel (Presenter-Kopplung, Umschalter) | „Referenzansicht“ |
| SD30 | Panel (Presenter-Kopplung, Umschalter) | „Hauptansicht“ |
| SD31 | Panel (Presenter-Kopplung, Hinweis) | „Folienbild erscheint, sobald eine Präsentation läuft“ |
| SD32 | Statusleiste (Nachricht, steht auf dem offenen Schirm) | „auf dem Schirm“ |
| SD33 | Statusleiste (Nachricht, leer) | „keine Nachricht“ |
| SD34 | Statusleiste (Nachricht, Anzeige-Element ausgeschaltet) | „Element aus“ |
| SD35 | Statusleiste (Nachricht gesetzt, Schirm nicht offen) | „Schirm nicht offen“ |

## Recorder

Neu formuliert sind RE7 bis RE9, RE11 bis RE14, RE16, RE23 bis RE28, RE30 bis RE35. RE29 und RE42 sind nach R9 geändert (alter Wortlaut unter „Entfällt“). RE5 und RE8 nehmen den Wortlaut bestehender Meldungen auf, jetzt als Grund an der Taste. Alle übrigen sind der bisherige Wortlaut, jetzt im Panel, als Haupttaste oder in der Statusleiste.

| Nr. | Ort | Text |
| --- | --- | --- |
| RE1 | Haupttaste (Eingang zu) | „Eingang öffnen“ |
| RE2 | Haupttaste (Eingang offen; beendet wie bisher auch eine laufende Aufnahme) | „Eingang schließen“ |
| RE3 | Haupttaste (Aufnahme, bei offenem Eingang; bei geschlossenem Eingang gesperrt) | „Aufnahme“ |
| RE4 | Haupttaste (solange die Aufnahme läuft) | „Stopp“ |
| RE5 | Haupttaste (Sperrgrund an „Eingang öffnen“, kein Gerät gewählt; Wortlaut der bisherigen Meldung ohne Punkt) | „Kein Eingang gewählt“ |
| RE6 | Haupttaste (Sperrgrund an „Eingang öffnen“, solange die Geräte gesucht werden) und Live-Bereich (neben der Überschrift „Aufnahme“, wie bisher) | „Suche Audiogeräte…“ |
| RE7 | Haupttaste (Sperrgrund beider Tasten, bis der Hauptprozess zum ersten Mal antwortet) | „Aufnahmezustand wird abgefragt…“ |
| RE8 | Haupttaste (Sperrgrund an „Aufnahme“ bei geschlossenem Eingang; Wortlaut der Meldung „Erst den Eingang öffnen (Arm).“ ohne den Zusatz) | „Erst den Eingang öffnen“ |
| RE9 | Kopf (Sendezustand, nur während der Aufnahme) | „REC“ |
| RE10 | Statusleiste (Titel) und Panel (Audiogerät, Beschriftung der Wahl) | „Eingang“ |
| RE11 | Statusleiste (Eingang, z. B. „zu · ‹Gerät› · 2 ch · 48000 Hz“) | „zu“ |
| RE12 | Statusleiste (Eingang, z. B. „offen · ‹Gerät› · 8 ch · 48000 Hz“) | „offen“ |
| RE13 | Statusleiste (Eingang, Zahl der Kanäle) | „‹…› ch“ |
| RE14 | Statusleiste (Eingang, Samplerate) | „‹…› Hz“ |
| RE15 | Panel (Audiogerät, Eintrag der Geräteliste: Name — Treiber (Kanäle), wie bisher) | „‹…› — ‹…› (‹…› ch)“ |
| RE16 | Panel (Abschnittstitel) | „Format“ |
| RE17 | Panel (Format) | „Kanäle“ |
| RE18 | Panel (Format) | „Samplerate (Hz)“ |
| RE19 | Panel (Format, Knopf neben den Kanälen) | „Max“ |
| RE20 | Panel (Format, Tooltip von „Max“) | „Alle ‹…› Kanäle“ |
| RE21 | Panel (Format, Hinweis bei einem ASIO-Gerät) | „ASIO: Samplerate muss exakt zur Geräte-Einstellung (z. B. DVSC) passen, sonst schlägt das Öffnen fehl.“ |
| RE22 | Statusleiste (Titel) und Live-Bereich (Überschrift der Karte mit den Tasten) | „Aufnahme“ |
| RE23 | Statusleiste (Aufnahme) | „keine Aufnahme“ |
| RE24 | Statusleiste (Aufnahme läuft, Dateiname noch unbekannt; sonst steht der Dateiname) | „läuft“ |
| RE25 | Statusleiste (Titel) | „Zeitplan“ |
| RE26 | Statusleiste (Zeitplan) | „kein Zeitplan“ |
| RE27 | Statusleiste (Zeitplan, geplanter Start mit Uhrzeit, z. B. „Start 19:30 · Auto-Stopp 21:00“) | „Start ‹…›“ |
| RE28 | Statusleiste (Zeitplan, Auto-Stopp mit Uhrzeit) | „Auto-Stopp ‹…›“ |
| RE29 | Live-Bereich (Fußtext der Karte „Geplante Aufnahme“; geändert nach R9, die Werte stehen jetzt im Panel) | „Start/Stopp laufen zuverlässig im Hintergrund (auch unbeaufsichtigt). Zielordner, Dateiname und „Spuren einzeln“ gelten wie in den Einstellungen unter Ziel eingestellt. Ein manueller Stopp hebt den Auto-Stopp auf.“ |
| RE30 | Statusleiste (Titel, nur wenn die Geräteliste nach dem Start leer bleibt) | „Audio-Modul“ |
| RE31 | Statusleiste (Audio-Modul) | „Audio-Modul fehlt“ |
| RE32 | Statusleiste (Titel, solange eine Meldung des Hauptprozesses offen ist; die Meldung selbst steht daneben) | „Meldung“ |
| RE33 | Live-Bereich (Knopf am Meldungsband über den Tasten) | „OK“ |
| RE34 | Panel (Fernsteuerung, Modulname im Companion-Hinweis) | „JM Audio Recorder“ |
| RE35 | Panel (Abschnittstitel) | „Ziel“ |
| RE36 | Panel (Ziel) und Live-Bereich (Ziel-Anzeige in der Karte) | „Zielordner“ |
| RE37 | Panel (Ziel, Knopf) | „Ordner wählen…“ |
| RE38 | Panel (Ziel) und Live-Bereich (Ziel-Anzeige in der Karte) | „noch keiner gewählt“ |
| RE39 | Panel (Ziel) | „Dateiname (optional)“ |
| RE40 | Panel (Ziel, Platzhalter) | „leer = Zeitstempel“ |
| RE41 | Panel (Ziel, Kontrollkästchen) | „Spuren zusätzlich einzeln speichern“ |
| RE42 | Panel (Ziel, Hinweis am Kontrollkästchen; geändert nach R9, nur das Schlusszeichen) | „je Kanal eine Mono-WAV im Unterordner „…-Spuren““ |
| RE43 | Live-Bereich (Ziel-Anzeige, Tooltip des Dateinamens) | „Im Ordner zeigen“ |

## Player

Neu formuliert sind PL6, PL7, PL9, PL10, PL16 bis PL18, PL23 bis PL25 und PL27 bis PL30; PL21 ist neu im Player (Wortlaut wie im Prompter). PL1 ist der alte Wortlaut ohne „⏎“. Alle übrigen sind der bisherige Wortlaut, jetzt im Panel, in der Statusleiste oder an neuer Stelle im Transport.

| Nr. | Ort | Text |
| --- | --- | --- |
| PL1 | Haupttaste (GO, ganz rechts im Transport der Cue-Show) | „GO“ |
| PL2 | Haupttaste (Pause/Weiter, Show läuft) | „❚❚ Pause“ |
| PL3 | Haupttaste (Pause/Weiter, Show pausiert) | „▶ Weiter“ |
| PL4 | Haupttaste (Transport) und Fußleiste (Bibliothek, Soundboard) | „■ Stop“ |
| PL5 | Haupttaste (Transport) und Fußleiste (Bibliothek, Soundboard) | „⛔ Panik“ |
| PL6 | Haupttaste (Kürzel an GO) | „Leertaste“ |
| PL7 | Haupttaste (Kürzel an Stop, nur in der Cue-Show) | „Esc“ |
| PL8 | Haupttaste (Tooltip an Panik, im Transport und in der Fußleiste; stimmt jetzt auch für die Pads, nicht für die Vorschau der Bibliothek, siehe Offene Fragen) | „Sofort alles stoppen“ |
| PL9 | Haupttaste (Sperrgrund an GO) | „Kein Standby-Cue“ |
| PL10 | Haupttaste (Sperrgrund an Pause/Weiter) | „Kein Cue läuft“ |
| PL11 | Live-Bereich (Überschrift der Standby-Anzeige, jetzt über den Tasten) und Statusleiste (Cue-Show in Ruhe, z. B. „Standby Cue 3 · Intro“) | „Standby“ |
| PL12 | Live-Bereich (Standby-Anzeige: Nummer und Beschriftung, sonst Dateiname) und Statusleiste (Cue-Show) | „Cue ‹…› · ‹…›“ |
| PL13 | Live-Bereich (Standby-Anzeige, Cue ohne Beschriftung und Datei) | „—“ |
| PL14 | Live-Bereich (Standby-Anzeige nach dem letzten Cue) und Statusleiste (Cue-Show) | „— Ende —“ |
| PL15 | Statusleiste (Titel; vorher Titel des Dialogs) | „Video-Ausgabe“ |
| PL16 | Statusleiste (Video-Ausgabe) | „zu“ |
| PL17 | Statusleiste (Video-Ausgabe; mit dem Bildschirm, sobald die Liste ihn kennt: „offen · ‹Bildschirm›“) | „offen“ |
| PL18 | Statusleiste (Video-Ausgabe) | „abgestürzt“ |
| PL19 | Panel (Hinweis unter „Ausgabe auf Bildschirm“; vorher Text im Dialog; der gemeinsame Abschnitt hat zusätzlich seinen eigenen Hinweis) | „Bildschirm für das Vollbild-Ausgabefenster wählen. Video-Cues erscheinen dort.“ |
| PL20 | Panel (Ausgabe auf Bildschirm, Zusatz im Namen des Hauptbildschirms in der Auswahl, z. B. „Monitor 1 · Primär (1920×1080)“; vorher auf der Bildschirmkarte) | „· Primär“ |
| PL21 | Panel (Knopf unter „Ausgabe auf Bildschirm“, nur bei offenem Fenster; zieht es auf den gewählten Bildschirm) | „Auf diesen Bildschirm“ |
| PL22 | Statusleiste (Titel; Name wie der Reiter) | „Cue-Show“ |
| PL23 | Statusleiste (Cue-Show) | „‹…› laufend“ |
| PL24 | Statusleiste (Cue-Show) | „pausiert“ |
| PL25 | Statusleiste (Cue-Show) | „keine Show gewählt“ |
| PL26 | Statusleiste (Titel; Name wie der Reiter) | „Soundboard“ |
| PL27 | Statusleiste (Soundboard) | „kein Pad spielt“ |
| PL28 | Statusleiste (Soundboard) | „1 Pad spielt“ |
| PL29 | Statusleiste (Soundboard) | „‹…› Pads spielen“ |
| PL30 | Panel (Fernsteuerung, Modulname im Companion-Hinweis) | „JM Player“ |

## Ortshinweise

Diese Texte sind wörtlich geblieben, nennen aber einen Ort oder ein Ziel, das sich geändert hat, oder stehen an einem Platz, den Du ansehen solltest. Bitte entscheide je Eintrag: so lassen, oder einen neuen Wortlaut bzw. Platz vorgeben.

- Recorder, Hinweisband bei fehlendem Eingang (Text aus dem Store, unverändert): „… Gerät/Treiber starten und „Geräte aktualisieren“ drücken.“ Der Knopf „Geräte aktualisieren“ steht jetzt im Panel hinter ⚙ (Abschnitt „Audiogerät“), nicht mehr über dem Eingang. Ein neuer Wortlaut wäre eine Änderung im Store, die die Welle 2a sonst nicht macht.
- Player, Cue-Zeile: Der Knopf ⚙ mit dem Tooltip „Einstellungen“ öffnet wie bisher den Dialog des Cues. Neu öffnet ⚙ im Kopf das Panel („Einstellungen öffnen“). Zwei gleiche Zeichen führen damit zu verschiedenen Zielen; im Soundboard heißt der entsprechende Knopf „Pad bearbeiten“.
- Player, Cue-Show: „▦ Ausgabe“ öffnet jetzt das Panel am Abschnitt „Ausgabe auf Bildschirm“, nicht mehr den Dialog „Video-Ausgabe“. Wortlaut gleich.
- Stage Display, Hinweise der Quellen (SD22 bis SD24): Sie stehen als Liste unter „Gegenstellen“, weil der gemeinsame Abschnitt keinen Platz für einen Hinweis je Zeile hat. So lassen oder streichen?

## Changelog

Entwurf der Release-Notizen (`packages/suite-manifest/changelog.json`), wörtlich wie dort. Das Datum ist ein Platzhalter.

| Nr. | App, Version | Text |
| --- | --- | --- |
| CL-CA1 | Caption 0.6.0 | „Neue Oberfläche: Oben die Kopfzeile mit „JM Caption“, ON AIR und den Schaltern für Hell und Dunkel sowie Einstellungen, darunter die Haupttasten „NDI starten“, „Start“, „Hold“ und „Leeren“ und die Live-Zeile mit NDI-Vorschau, Pegel und Verlauf. Modell, Sprache, Mikrofon, die NDI-Einstellungen und der Inhalt der Klappe „Erweitert“ liegen jetzt im Panel hinter ⚙, in den Abschnitten „NDI-Ausgabe“, „Audiogerät“, „Fernsteuerung“, „Erkennung“ und „Darstellung“.“ |
| CL-CA2 | Caption 0.6.0 | „Neue Statusleiste mit sechs Einträgen: Master, NDI, Fernsteuerung, Mikrofon, Whisper und Fehler. NDI zeigt jetzt den gemessenen Zustand: „sendet“ mit der Zahl der Empfänger nur, solange der Sender wirklich Bilder meldet, sonst „an (ohne Rückmeldung)“. Endet der Sender, meldet Caption NDI als aus, auch an Companion. ON AIR leuchtet nur, wenn NDI sendet, die Erkennung läuft und das Mikrofon keinen Fehler hat.“ |
| CL-CA3 | Caption 0.6.0 | „Ein Mikrofonfehler steht jetzt als Text unter den Haupttasten und in der Statusleiste; ein gemerktes Mikrofon, das fehlt, zeigt die Statusleiste vorab als „Gerät nicht gefunden“. Im Abschnitt „NDI-Ausgabe“ nennt „Im Netz:“ den Namen, unter dem der Sender gerade läuft; der Quellname gilt nach Enter oder beim Verlassen des Feldes, und der Schalter „Ausgabe“ startet und stoppt NDI auch dort.“ |
| CL-CA4 | Caption 0.6.0 | „Die Tasten verlieren ihre Symbole (● ■ ○ ◉) und stehen jetzt zusammen oben im Live-Bereich. NDI bleibt oben links auf seinem gewohnten Platz; auf den alten Plätzen von Stopp, Hold und Leeren oben rechts liegt keine Taste, die etwas beendet oder leert (bei der Standardgröße des Fensters). Hell und Dunkel per Schalter in der Kopfzeile, gemerkt je Rechner. Erkennung, NDI-Bild und die Befehle der Fernsteuerung (Port 8732) bleiben gleich, es gibt keine neuen Tastenkürzel.“ |
| CL-IN1 | Interpreter 0.3.0 | „Neue Oberfläche: Oben die Kopfzeile mit „JM Interpreter“, „MIX AKTIV“ während des Betriebs und den Schaltern für Hell und Dunkel sowie Einstellungen, darunter die Karte „Pegel“, die Haupttaste „Starten“ bzw. „Stoppen“ und die Hinweise zum virtuellen Kabel. Die drei Geräte-Wahlen und die Ducking-Regler liegen jetzt im Panel hinter ⚙, in den Abschnitten „Audiogerät“ und „Ducking“.“ |
| CL-IN2 | Interpreter 0.3.0 | „Neue Statusleiste mit sechs Einträgen: Master, Floor, Dolmetscher, Ausgabegerät, Ducking und Fehlermeldung. Im Betrieb zeigen Floor, Dolmetscher und Ausgabegerät das Gerät, mit dem gestartet wurde; ein gemerktes Gerät, das fehlt, heißt „Gerät nicht gefunden“. Ist Überbrücken an, steht im Live-Bereich „Überbrückt“ und in der Statusleiste „überbrückt“.“ |
| CL-IN3 | Interpreter 0.3.0 | „Alle drei Geräte-Wahlen tragen jetzt den Hinweis „Wirkt erst nach Stopp und erneutem Start.“ Eine Wahl im Betrieb stoppt nichts; die Statusleiste warnt, bis neu gestartet ist. Fehlt das gewählte Ausgabegerät, sagt die Karte jetzt richtig, dass der Start fehlschlägt; bisher hieß es, der Mix gehe auf den Systemstandard.“ |
| CL-IN4 | Interpreter 0.3.0 | „Ein gewählter Eingang lässt sich nicht mehr auf „– bitte wählen –“ zurückstellen. Der Grund einer gesperrten Taste („Erst beide Eingänge wählen“) steht jetzt sichtbar unter der Taste. Hell und Dunkel per Schalter in der Kopfzeile, gemerkt je Rechner; die Zeile „Floor/Dolmetscher-Ducking · Einspeisung in Zoom/Webex“ entfällt. Mix und Ducking bleiben gleich, es gibt keine neuen Tastenkürzel.“ |
| CL-PR1 | Prompter 0.8.0 | „Neue Oberfläche: Oben die Kopfzeile mit „JM Prompter“, ON AIR und den Schaltern für Hell und Dunkel sowie Einstellungen. Links bleibt das Skript, rechts stehen Vorschau, die Haupttasten „GO“, „Anfang“, „Marke zurück“ und „Marke vor“, die Knöpfe „↑ zurück“ und „↓ vor“ und das Tempo. Talent-Monitor, Schrift, Lese-Linie, Darstellung und Handy-Fernbedienung liegen jetzt im Panel hinter ⚙.“ |
| CL-PR2 | Prompter 0.8.0 | „Neue Statusleiste mit fünf Einträgen: Master, Talent-Monitor, Fernsteuerung, Handy-Fernbedienung und Tempo. Der Talent-Monitor zeigt den gemessenen Zustand des Fensters: Wird es anders als per Knopf geschlossen, der Bildschirm abgezogen oder stürzt es ab, steht dort „zu“, „Bildschirm fehlt“ bzw. „abgestürzt“. ON AIR leuchtet nur, solange der Text läuft und der Monitor wirklich offen ist.“ |
| CL-PR3 | Prompter 0.8.0 | „Die Kürzel Leertaste und Pos1 stehen auf den Tasten; ein Satz unter dem Tempo sagt, dass sie nur gelten, solange der Cursor nicht im Skript oder in einem Feld steht. In einer Auswahl wie der Bildschirmwahl gehören Pfeiltasten und Leertaste jetzt der Auswahl. Startet die Handy-Fernbedienung nicht, steht in der Statusleiste „nicht gestartet“.“ |
| CL-PR4 | Prompter 0.8.0 | „Hell und Dunkel per Schalter in der Kopfzeile, gemerkt je Rechner. Die Zeile „Teleprompter“ und der Tastenhinweis im Kopf entfallen. Lauf, Talent-Monitor und Fernsteuerung (Port 8727) bleiben gleich, es gibt keine neuen Tastenkürzel.“ |
| CL-SD1 | Stage Display 0.7.0 | „Neue Oberfläche: Oben die Kopfzeile mit „JM Stage Display“ und den Schaltern für Hell und Dunkel sowie Einstellungen, darunter Vorschau, Nachricht, die Anzeige-Elemente und die Haupttaste „Vollbild-Ausgabe öffnen“ bzw. „Ausgabe schließen“. Bühnenschirm, Quellen und Presenter-Kopplung liegen jetzt im Panel hinter ⚙, in den Abschnitten „Ausgabe auf Bildschirm“, „Gegenstellen“ und „Presenter-Kopplung“.“ |
| CL-SD2 | Stage Display 0.7.0 | „Neue Statusleiste mit sechs Einträgen: Master, JM Timer, JM Switcher, JM Presenter, Bühnenschirm und Nachricht. Der Bühnenschirm zeigt den gemessenen Zustand des Fensters („zu“, „offen“, „Bildschirm fehlt“, „abgestürzt“). Die Nachricht steht erst auf „auf dem Schirm“, wenn sie wirklich auf dem offenen Bühnenschirm zu sehen ist.“ |
| CL-SD3 | Stage Display 0.7.0 | „Host und Port einer Quelle gelten jetzt erst mit „Setzen“, nicht mehr mit jedem Tastendruck; so entsteht nicht bei jeder Ziffer eine neue Verbindung. Eine eingeschaltete Quelle ohne Verbindung heißt „nicht gefunden“ statt „getrennt“. Die Anzeige-Elemente sind Schalter statt Kontrollkästchen.“ |
| CL-SD4 | Stage Display 0.7.0 | „Hell und Dunkel per Schalter in der Kopfzeile, gemerkt je Rechner. Die Zeile „Bühnen-/Crew-Schirm“ neben dem Namen entfällt. Das Bild auf dem Bühnenschirm bleibt gleich, und es gibt weiter keine Tastenkürzel.“ |
| CL-RE1 | Recorder 0.10.0 | „Neue Oberfläche: Oben die Kopfzeile mit „JM Audio Recorder“, „REC“ während der Aufnahme und den Schaltern für Hell und Dunkel sowie Einstellungen. Darunter stehen Presets, die Haupttasten „Aufnahme“ bzw. „Stopp“ und „Eingang öffnen“ bzw. „Eingang schließen“, Uhr und Pegel gemeinsam im Blick, der Zeitplan darunter. Eingang, Format, Ziel und Fernsteuerung liegen jetzt im Panel hinter ⚙.“ |
| CL-RE2 | Recorder 0.10.0 | „Neue Statusleiste: Master, Aufnahme, Fernsteuerung, Eingang und Zeitplan, bei Bedarf dazu Audio-Modul und Meldung. Sie zeigt nur, was der Hauptprozess wirklich meldet; bis zur ersten Antwort steht dort „unbekannt“, und die Tasten sind mit „Aufnahmezustand wird abgefragt…“ gesperrt. „REC“ im Kopf leuchtet nur während der Aufnahme, nicht schon bei offenem Eingang.“ |
| CL-RE3 | Recorder 0.10.0 | „Meldungen des Hauptprozesses bleiben jetzt als Band über den Tasten stehen, bis sie mit „OK“ bestätigt sind; der kurze Hinweis erscheint oben statt unten. Gesperrte Tasten nennen ihren Grund, zum Beispiel „Kein Eingang gewählt“ oder „Erst den Eingang öffnen“.“ |
| CL-RE4 | Recorder 0.10.0 | „Kanäle und Samplerate gelten nach Enter oder beim Verlassen des Feldes und nennen ungültige Werte, statt sie still zu begrenzen; die Pfeiltasten ändern sie nicht mehr. Hell und Dunkel per Schalter in der Kopfzeile, gemerkt je Rechner; die Zeile „Mehrkanal-Aufnahme · Dante / ASIO“ entfällt. Aufnahme und Fernsteuerung (Port 8729) bleiben gleich, es gibt keine neuen Tastenkürzel.“ |
| CL-PL1 | Player 0.9.0 | „Neue Oberfläche: Oben die Kopfzeile mit „JM Player“, ON AIR und den Schaltern für Hell und Dunkel sowie Einstellungen, darunter die Reiter Bibliothek, Soundboard und Cue-Show. Der Dialog „Video-Ausgabe“ ist ins Panel hinter ⚙ umgezogen (Abschnitt „Ausgabe auf Bildschirm“, dazu „Fernsteuerung“); „▦ Ausgabe“ in der Cue-Show öffnet das Panel an dieser Stelle.“ |
| CL-PL2 | Player 0.9.0 | „Neue Statusleiste mit fünf Einträgen: Master, Video-Ausgabe, Fernsteuerung, Cue-Show und Soundboard. Sie zeigt nur Gemessenes: den Zustand des Ausgabefensters („zu“, „offen“, „Bildschirm fehlt“, „abgestürzt“) und wie viele Cues und Pads wirklich spielen. ON AIR leuchtet nur, solange ein Cue der Show wirklich spielt (nicht im Vorlauf, nicht pausiert) oder ein Pad klingt; Vollbild lässt sich nur schalten, wenn sein Zustand gemessen ist.“ |
| CL-PL3 | Player 0.9.0 | „Panik stoppt jetzt auch die Pads des Soundboards. Stop und Panik stehen zusätzlich in einer Fußleiste in Bibliothek und Soundboard, an derselben Stelle wie in der Cue-Show. Die Reihenfolge der Tasten bleibt (Pause/Weiter, Stop, Panik, GO); gesperrte Tasten nennen ihren Grund („Kein Standby-Cue“, „Kein Cue läuft“), GO heißt „GO“ statt „GO ⏎“, und die Kürzel Leertaste und Esc stehen auf den Tasten.“ |
| CL-PL4 | Player 0.9.0 | „Nach Stop und nach dem Start eines Cues zeigt die Taste wieder „❚❚ Pause“, und Companion meldet die Show nicht mehr als pausiert; bisher blieb nach einer Pause „▶ Weiter“ stehen. Die Bildschirmwahl merkt nur den Bildschirm, ein offenes Fenster zieht mit „Auf diesen Bildschirm“ um, und Escape schließt die Dialoge. Hell und Dunkel per Schalter, gemerkt je Rechner; die Zeile „Player · Bibliothek · Soundboard“ entfällt, es gibt keine neuen Tastenkürzel.“ |

## Entfällt

Sichtbare Texte, die mit dem Umbau wegfallen oder anders gesagt werden (R9). Spalte „Ersatz“: was an die Stelle tritt, wenn etwas.

| Nr. | Werkzeug | Alter Text | Ersatz |
| --- | --- | --- | --- |
| EN1 | Prompter, Stage Display, Recorder, Player, Interpreter | Die Zeile neben dem Namen im Kopf: „Teleprompter“, „Bühnen-/Crew-Schirm“, „Mehrkanal-Aufnahme · Dante / ASIO“, „Player · Bibliothek · Soundboard“, „Floor/Dolmetscher-Ducking · Einspeisung in Zoom/Webex“ (Caption hatte keine) | keiner (E16); die Kopfzeile zeigt Logo und Toolname |
| EN2 | alle sechs | Der Name in Großbuchstaben „JM PROMPTER“, „JM STAGE DISPLAY“, „JM AUDIO RECORDER“, „JM PLAYER“; „JM Caption“ und „JM Interpreter“ als Text ohne Logo | „JM Prompter“, „JM Stage Display“, „JM Audio Recorder“, „JM Player“, „JM Caption“, „JM Interpreter“ mit Logo aus dem gemeinsamen Kopf |
| EN3 | Recorder, Player | „Light“ bzw. „Dark“ (Knopf im Kopf; der Start war immer dunkel) | Schalter für Hell und Dunkel aus dem gemeinsamen Baustein, die Wahl wird gemerkt; Prompter, Stage Display, Caption und Interpreter bekommen den Schalter neu |
| EN4 | Prompter | Tastenhinweis im Kopf „Leertaste = GO/Pause · ↑/↓ = nudge · Pos1 = Anfang“ | Kürzel „Leertaste“ und „Pos1“ auf den Tasten (PR6, PR7) und der Hinweis unter dem Tempo (PR10) |
| EN5 | Prompter | „▶ GO“, „❙❙ Pause“, „⟲ Anfang“ | „GO“, „Pause“, „Anfang“ (PR1 bis PR3) |
| EN6 | Prompter | „⏮ Marke“, „Marke ⏭“ | „Marke zurück“, „Marke vor“ (PR4, PR5); die Tooltips „Voriger Abschnitt“ und „Nächster Abschnitt“ bleiben |
| EN7 | Prompter | Abschnittstitel „Lauf & Schrift“, „Ausgabe (Talent-Monitor)“, „Fernbedienung (Handy im WLAN)“ | „Schrift“ (PR25; das Tempo steht im Live-Bereich), „Ausgabe auf Bildschirm“ (gemeinsamer Text; Statuseintrag „Talent-Monitor“, PR11), „Handy-Fernbedienung“ (PR17) |
| EN8 | Prompter, Stage Display | „Primärer Bildschirm“ (erster Eintrag der Bildschirmwahl) | „Automatisch (Hauptmonitor)“ (gemeinsamer Text) |
| EN9 | Prompter | Knöpfe „Vollbild öffnen“ und „Schließen“ | Schalter „Ausgabe“ (gemeinsamer Text); „Auf diesen Bildschirm“ bleibt als Knopf bei offenem Monitor (PR15) |
| EN10 | Prompter | „Keine LAN-Adresse gefunden.“ | „Keine LAN-Adresse gefunden“ ohne Schlusspunkt, jetzt auch in der Statusleiste (PR19, Ruling R-T5a) |
| EN11 | Prompter, Stage Display | Kontrollkästchen „Lese-Linie anzeigen“, „Spiegeln ⇄“, „Spiegeln ⇅“, „Fett“, „Fernbedienung aktiv“ und die fünf Anzeige-Elemente | Schalter mit gleicher Beschriftung |
| EN12 | Stage Display | Abschnittstitel „Ausgabe (Bühnenschirm)“ und „Quellen“ | „Ausgabe auf Bildschirm“ und „Gegenstellen“ (gemeinsame Texte); Statuseintrag „Bühnenschirm“ (SD1) |
| EN13 | Stage Display | Zwei Knöpfe „Vollbild-Ausgabe öffnen“ und „Ausgabe schließen“ | eine Haupttaste mit wechselnder Beschriftung, gleicher Wortlaut (SD7, SD8); „Auf diesen Bildschirm“ im Panel (SD5) |
| EN14 | Stage Display | Marke „getrennt“ (Quelle an, nicht verbunden) | „nicht gefunden“ (gemeinsamer Text, Ruling Task 9); „verbunden“ bleibt, eine ausgeschaltete Quelle heißt „aus“ |
| EN15 | Stage Display | Platzhalter „Host/IP“ und das Port-Feld, das mit jedem Tastendruck neu verband | Felder „Host“ und „Port“ mit dem Knopf „Setzen“ (gemeinsamer Abschnitt Gegenstellen) |
| EN16 | Stage Display | Hinweise der Quellen rechts neben dem Namen (nur bei breitem Fenster) | dieselben Hinweise als Liste unter „Gegenstellen“ (SD22 bis SD24) |
| EN17 | Player | „GO ⏎“ | „GO“ mit dem Kürzel „Leertaste“ (PL1, PL6); „⏎“ war falsch, ausgelöst wird die Leertaste |
| EN18 | Player | „❚❚ PAUSE“, „▶ WEITER“, „■ STOP“ (in Großbuchstaben gezeigt) | „❚❚ Pause“, „▶ Weiter“, „■ Stop“ in normaler Schreibweise (PL2 bis PL4); Stop mit dem Kürzel „Esc“ (PL7) |
| EN19 | Player | Dialog „Video-Ausgabe“: Titel, Bildschirmkarten „‹Name› · Primär“ mit „B×H“, Knöpfe „Ausgabe schließen“, „Vollbild aus“ bzw. „Vollbild an“ und „Fertig“ | Abschnitt „Ausgabe auf Bildschirm“ im Panel: Auswahl mit „‹Name› · Primär (B×H)“ (PL20) und „Automatisch (Hauptmonitor)“, Schalter „Ausgabe“ und „Vollbild“ (gemeinsame Texte), Knopf „Auf diesen Bildschirm“ (PL21); „Video-Ausgabe“ bleibt als Statuseintrag (PL15); „Fertig“ ohne Ersatz, das Panel schließt über ✕, Escape oder ⚙ |
| EN20 | Player | „Keine Bildschirme erkannt.“ | „Kein Bildschirm gefunden“ (gemeinsamer Text) |
| EN21 | Recorder | Fußtext der Karte „Geplante Aufnahme“: `Start/Stopp laufen zuverlässig im Hintergrund (auch unbeaufsichtigt). Zielordner, Dateiname und „Spuren einzeln" gelten wie oben eingestellt. Ein manueller Stopp hebt den Auto-Stopp auf.` | RE29: „wie in den Einstellungen unter Ziel eingestellt“, weil die Werte jetzt im Panel stehen, nicht mehr oben; Schlusszeichen typografisch |
| EN22 | Recorder | Nur Anführungszeichen getauscht, Text sonst gleich: `je Kanal eine Mono-WAV im Unterordner „…-Spuren"` | gleicher Text mit „ “ (RE42) |
| EN23 | Recorder | Marke „Inaktiv“ vor der ersten Antwort des Hauptprozesses (Vorgabewert, nicht gemessen) | „unbekannt“ (gemeinsamer Text); „Inaktiv“ bleibt für den gemessenen Ruhezustand |
| EN24 | Recorder | Knopf „Geräte aktualisieren“ im Seitenkopf über dem Eingang | Knopf „Geräte aktualisieren“ im Panel-Abschnitt „Audiogerät“ (gemeinsamer Text, gleicher Wortlaut; siehe Ortshinweise) |
| EN25 | Recorder | Die Tasten „EINGANG ÖFFNEN“, „EINGANG SCHLIESSEN“, „AUFNAHME“, „STOPP“ (in Großbuchstaben gezeigt) | normale Schreibweise (RE1 bis RE4) |
| EN26 | Caption | „● Start“, „■ Stopp“, „○ NDI starten“, „◉ NDI an“ | „Start“, „Stopp“, „NDI starten“, „NDI an“ ohne Symbol (CA1, CA2, CA6, CA7); eine laufende Taste trägt die Kennung „LIVE“ |
| EN27 | Caption | Klappe „▸ Erweitert (Wörterbuch · Engine · Fenster)“ bzw. „▾ …“ | Panel-Abschnitt „Erkennung“ (CA23) |
| EN28 | Caption | Platzhalter „NDI-Quellname“; Beschriftung „fps“ | Feld „Quellenname“ mit dem Hinweis „Kein Quellenname eingetragen.“ bzw. „Im Netz: ‹Name›“; „Bildrate“ (gemeinsame Texte) |
| EN29 | Caption | „‹n› Empfänger“ rechts in der NDI-Leiste, schon sobald der Sender-Prozess lief (auch „0 Empfänger“ vor der ersten Meldung) | „‹n› Empfänger“ am Schalter im Panel und „sendet, ‹n› Empfänger“ in der Statusleiste (CA10), nur solange der Sender Bilder meldet (E8) |
| EN30 | Caption | „⟳“ mit dem Tooltip „Audiogeräte aktualisieren“; Tooltip „Audio-Eingang (Mikrofon)“ am Auswahlfeld im Kopf | Knopf „Geräte aktualisieren“ (gemeinsamer Text); „Audio-Eingang (Mikrofon)“ als Beschriftung der Wahl (CA12) |
| EN31 | Caption | „Lädt …“ allein im leeren Fenster | Kopf und Statusleiste stehen schon; „Lädt …“ als Grund unter den gesperrten Tasten (CA8) |
| EN32 | Interpreter | „Das gewählte Ausgabegerät ist derzeit nicht verfügbar. Der Mix geht auf den Systemstandard und erreicht die Konferenz nicht.“ | IN39 (E10: der Satz stimmte nicht, der Start schlägt in diesem Fall fehl) |
| EN33 | Interpreter | „— bitte wählen —“ (langer Strich, auch nach einer Wahl wieder wählbar) | „– bitte wählen –“ (gemeinsamer Text), nur solange nichts gewählt ist (Ruling Task 31) |
| EN34 | Interpreter | Karten „Ducking“ und „Vorverstärkung“ im Hauptfenster; „Ducking-Werte zurücksetzen“ in der Karte „Vorverstärkung“ | Panel-Abschnitt „Ducking“ (IN13) mit der Unterüberschrift „Vorverstärkung“ (IN18); der Knopf steht am Ende des Abschnitts (IN19) |

## Geänderte Bedienung

Keine Funktion fällt weg. An diesen Stellen verhält sich die Bedienung anders als bisher:

- Alle sechs: Die Einstellungen liegen im Panel hinter ⚙; ein Klick auf einen Eintrag der Statusleiste öffnet das Panel am passenden Abschnitt. Escape schließt das Panel. Leertaste auf einem Knopf oder Schalter im Panel geht an das Werkzeug (O1), Felder behalten ihre Tasten. Es gibt keine neuen Tastenkürzel; die vorhandenen stehen auf den Tasten. Hell und Dunkel schaltest Du in der Kopfzeile, die Wahl wird je Rechner gemerkt.
- Prompter: In einer Auswahl (z. B. der Bildschirmwahl) gehören Pfeiltasten und Leertaste jetzt der Auswahl, nicht mehr dem Lauf. Die Bildschirmliste wird beim Öffnen des Panels gelesen, nicht beim Anklicken der Auswahl; den Namen des offenen Bildschirms kennt die Statusleiste erst, nachdem das Panel einmal offen war.
- Stage Display: Host und Port einer Quelle übernimmt der Knopf „Setzen“; die Pfeiltasten im Port-Feld ändern nichts mehr. Host und Port stehen auch bei ausgeschalteter Quelle da.
- Player: Panik stoppt zusätzlich die Pads (W2-10); auch ein Pad, das gerade lädt, startet danach nicht mehr, und das gilt ebenso für „■ Alle stoppen“. Stop und der Start eines Cues heben „pausiert“ auf (siehe Offene Fragen). Die Bildschirmwahl merkt nur; geöffnet wird mit dem Schalter „Ausgabe“, umgezogen mit „Auf diesen Bildschirm“; „Automatisch (Hauptmonitor)“ merkt keinen Bildschirm, das Fenster öffnet dann auf dem Hauptmonitor. Der Schalter „Vollbild“ erscheint nur mit gemessenem Wert. Escape schließt die drei Dialoge und verwirft die Eingabe, auch im Tastenfeld des Pad-Dialogs. Pad-Tasten, Leertaste und Esc wirken wie bisher nicht in Feldern, jetzt auch nicht in bearbeitbarem Text (contentEditable). In der Cue-Show löst bei offenem Panel die Leertaste auf einem Knopf GO aus; vorher sperrte der offene Dialog „Video-Ausgabe“ Leertaste und Esc. Enter auf GO gedrückt halten löst GO einmal aus, nicht wiederholt. ON AIR geht mit Stop aus, auch während der Ton noch ausklingt.
- Recorder: „Aufnahme“ bzw. „Stopp“ steht links, „Eingang öffnen“ bzw. „Eingang schließen“ rechts, wie bisher bei offenem Eingang; bei geschlossenem Eingang wandert „Eingang öffnen“ damit nach rechts. „Eingang schließen“, das auch eine laufende Aufnahme beendet, liegt nie auf dem Platz von „Stopp“ (Ruling Task 21). Kanäle und Samplerate übernehmen den Wert bei Enter oder beim Verlassen des Feldes, die Pfeiltasten ändern ihn nicht mehr, und ungültige Werte nennen einen Fehler (z. B. „Mindestens 8000.“, „Bitte eine ganze Zahl eingeben.“) statt still zu begrenzen. Die Taste „Aufnahme“ steht bei geschlossenem Eingang gesperrt da (vorher gab es sie dort nicht); der Fernbefehl RECORD bleibt wie bisher. Der kurze Hinweis steht oben über der Preset-Leiste und scrollt mit dem Inhalt.
- Caption: Die vier Haupttasten stehen als Raster oben im Live-Bereich: oben links NDI auf seinem alten Platz, rechts daneben Start/Stopp, darunter Hold und Leeren. Start, Hold und Leeren lagen vorher oben rechts in der Kopfzeile; dort liegen jetzt ON AIR, Hell/Dunkel und ⚙, keine Taste, die etwas beendet oder leert. Maßstab ist die Standardgröße 1100×780; bei 900 px Breite brach die alte Kopfzeile um, dort ist die Lage ein Abnahmepunkt (Ruling Task 26). Der NDI-Quellname gilt nach Enter oder beim Verlassen des Feldes, ohne Leerzeichen am Rand; Escape im Feld verwirft die Eingabe. Gerät, Modell, Engine, Auflösung und Bildrate wirken weiter sofort. Ein gemerkter Wert, der nicht in seiner Liste steht, erscheint als „nicht verfügbar: ‹Wert›“. Endet der NDI-Sender, steht `connections` für Companion auf 0, und eine späte Meldung eines alten Senders zählt nicht mehr (E8).
- Interpreter: Die Haupttaste „Starten“ bzw. „Stoppen“ steht weiter oben rechts in derselben Spalte, etwa 37 px tiefer und breiter; auf ihrem alten Platz liegt bei 900 px Breite ein Teil des Hell/Dunkel-Schalters, der den Mix nicht berührt (Ruling Task 31). „– bitte wählen –“ ist nach einer Wahl nicht mehr wählbar (Ruling Task 31). Im Betrieb steht der Pegel im Panel nur unter der Wahl, die dem gestarteten Gerät entspricht.

## Offene Fragen

1. **Player, Panik in der Bibliothek.** Panik in der Fußleiste der Bibliothek stoppt die Vorschau der Bibliothek nicht (wie bisher), der Tooltip „Sofort alles stoppen“ (PL8) steht aber auch dort. Was soll gelten? ☐ so lassen ☐ Panik stoppt auch die Vorschau (eine weitere Änderung der Bedienlogik) ☐ der Tooltip in der Fußleiste ändert sich (bitte Wortlaut nennen, z. B. „Show und Pads sofort stoppen“)
2. **Player, „pausiert“ nach Stop und Cue-Start.** Stop und jeder Start eines Cues heben jetzt „pausiert“ auf: Die Taste zeigt wieder „❚❚ Pause“, und Companion meldet die Show nicht mehr als pausiert. Vorher blieb der Merker stehen, auch während Ton lief (Befund 11 der Player-Liste). Zwei Folgen bleiben dabei: Startet in der Pause ein Video-Cue, klingen die angehaltenen Ton-Cues erst nach Pause → Weiter wieder. Und endet der neu gestartete Cue, während die übrigen noch angehalten sind (Ton-Cues nach einem Video-Start, ein Video nach einem Ton-Start), zeigen ON AIR und „‹n› laufend“ fälschlich weiter „an“, über stillem Ton bzw. stehendem Bild, bis die angehaltenen Cues weiterlaufen oder Stop bzw. Panik sie beendet. ☐ so behalten ☐ zurücknehmen (zwei Zeilen im Store; dann zeigt ON AIR in diesen zwei Fällen „aus“, obwohl Ton läuft, und der erste Satz von CL-PL4 entfällt)
3. **Alle sechs, Altfehler.** Die Funktionslisten (Abschnitt 10) und die Prüfungen haben Fehler gefunden, die schon vor der Welle 2a bestanden und die der Umbau absichtlich nicht ändert. Sollen sie nach der Welle 2a ein eigenes Thema werden? ☐ ja, alle ☐ ja, nur diese (bitte Nummern oder Zeilen nennen) ☐ nein. Die wichtigsten je Werkzeug:
   - Caption: Bei einem Mikrofonfehler bleibt „läuft“ stehen (Companion meldet `running=1`); Hold friert nur Vorschau und NDI ein, und „Leeren“ bei Hold erreicht NDI nicht; die Korrektur trifft die jüngste statt der angeklickten Zeile; beim Stopp gehen die letzten Worte verloren; die Modellwahl fällt still auf Base zurück (Befunde 1, 4 bis 7).
   - Interpreter: Ein zweiter Klick während des Starts verwirft den ersten Start; das Fehlerband bleibt bis zum nächsten erfolgreichen Start stehen; die Mikrofon-Probe öffnet beim Start das Standardmikrofon; „Ducking-Werte zurücksetzen“ setzt auch die Vorverstärkung zurück; im Stillstand zeigt Ducking „offen“ (Befunde 3, 6, 8, 10; Prüfung Task 30).
   - Prompter: Startet die Handy-Fernbedienung nicht, steht der Grund nur im Protokoll; die Vorschau läuft ohne offenen Monitor über das Textende hinaus; der Zeilenabstand ändert die Lesegeschwindigkeit, ohne dass sich das Tempo ändert; der Dateileser prüft weder Größe noch Typ (Befunde 2, 7, 11, 13).
   - Stage Display: Die Suche im Netz ersetzt einen von Hand eingetragenen Host still; falsche PIN, fehlende Fernsteuerung im Presenter und nicht erreichbar zeigen alle „nicht gefunden“; die PIN steht im Klartext; ohne Hauptfenster hält ein offener Bühnenschirm die App am Leben (Befunde 3, 5, 7, 10).
   - Recorder: Der Fernbefehl ARM und „Eingang schließen“ beenden eine laufende Aufnahme ohne Rückfrage; Schreibfehler haben keinen Fehlerzustand, nur einen Toast; die Rückfrage zum Netzwerkordner gibt es nur beim Import, und der Import verwirft Ordner still; ein gescheiterter Auto-Stopp meldet nichts (Befunde 2, 3, 7, 10, 13).
   - Player: Nach schnellem Schließen und Öffnen sind zwei Ausgabefenster möglich (Ruling Task 13); nur das Löschen einer Show fragt zurück; der Pad-Dialog setzt Gain und Farbe zurück; Umsortieren bei aktiver Suche tauscht die falschen Einträge; das Ausgabevideo ignoriert positives Gain (Befunde 10, 12, 13, 18).

Freigabe: ☐ alle Texte wie hier ☐ mit Änderungen (bitte je Nr. notieren)
