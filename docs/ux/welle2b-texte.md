# UX-Update Welle 2b: Texte zur Freigabe durch den Owner

Zweck: Alle neuen und geänderten sichtbaren Texte der Welle 2b zur Freigabe durch den Owner: die drei umgebauten Werkzeuge Presenter, Studio-Control und Connect, der Nachzug für Prompter, Stage Display und Player sowie die Texte der gemeinsamen Bausteine, die 2b neu zeigt. Dazu der Entwurf der Release-Notizen, was entfällt, was sich in der Bedienung ändert, und die offenen Fragen.

Stand: Branch `feat/ux-welle2b`, Code-Stand `8e9a2c5b83` (Aufgaben 1 bis 26 fertig, zuletzt das Rückspiel der Regeln in die früheren Apps). Die Versionen sind Presenter 0.15.0, Studio-Control 0.7.0, Connect 0.6.0, Prompter 0.8.1, Stage Display 0.7.1 und Player 0.9.1; das Datum der Changelog-Einträge (23.11.2026) ist ein Platzhalter und wird am Tag der Veröffentlichung gesetzt. Nichts davon ist veröffentlicht.

Lesehilfe: ‹…› steht für den Teil, der sich zur Laufzeit ändert (eine Zahl, ein Name oder ein Text aus einem gemeinsamen Baustein). Beispiel: „Folie ‹…› von ‹…›“ erscheint als „Folie 3 von 12“. Die Nummer (z. B. PS12) nennst Du bitte bei jeder Änderung, die Du wünschst. Die Spalte „Ort“ sagt, wo der Text steht: Kopf (Kopfzeile), Werkzeugleiste (Zeile unter dem Kopf), Leiste (Referent), Haupttaste (große Taste im Live-Bereich), Statusleiste (unten), Panel (Einstellungen hinter ⚙), Live-Bereich, Hinweis. Wie in Welle 1 und 2a steht je Werkzeug jeder Text seiner Textkonstante, auch wo der Wortlaut der bisherige ist und nur der Ort neu; der Satz über jeder Tabelle nennt, was neu formuliert ist.

Aufbau: Bausteine, je Werkzeug eine Tabelle, der Nachzug, dann „Changelog“, „Entfällt“, „Geänderte Bedienung“, „Offene Fragen“ und „Handbuch“ (alter und neuer Text je Stelle in den sechs Handbüchern).

## Bausteine

Neu ist nur X1. X2 bis X6 sind freigegebene Texte der gemeinsamen Bausteine, die Welle 2b an neuer Stelle oder mit neuer Bedeutung zeigt. Die übrigen Rahmen-Texte (Hell und Dunkel, ⚙ „Einstellungen öffnen“, „LIVE“, „unbekannt“, „verbunden“, „aus“, „Fernsteuerung“) kommen unverändert aus den Bausteinen; sie sind seit Welle 0 und 1 freigegeben und stehen in Presenter, Studio-Control und Connect zum ersten Mal.

| Nr. | Ort | Text |
| --- | --- | --- |
| X1 | Panel (Abschnitt „Ausgabe auf Bildschirm“, unter der Bildschirmwahl, nur solange das Fenster gemessen auf einem bekannten Bildschirm steht: „Steht auf ‹Bildschirm›“; Prompter, Stage Display, Player und Presenter-Editor während der Präsentation) | „Steht auf“ |
| X2 | Panel (Pille von „Ausgabe auf Bildschirm“; bei offenem Fenster jetzt der Bildschirm, auf dem das Fenster gemessen steht, nicht mehr der gewählte) | „auf Bildschirm ‹…›“ |
| X3 | Panel (Pille von „Ausgabe auf Bildschirm“; jetzt auch, wenn das offene Fenster gemessen auf keinem Bildschirm der Liste steht) und Leiste des Presenter-Referenten (Tooltip von „Auf diesen Bildschirm“, gesperrt, solange der gewählte Bildschirm fehlt) | „Bildschirm fehlt“ |
| X4 | Halte-Knopf (Tooltip und Name für Screenreader, solange er gesperrt ist; Connect 🎙 je Gast, Studio-Control PTZ-Richtung, Zoom und Fokus) | „Gesperrt: ‹…›“ |
| X5 | Knopf, der eine Wahl erst übernimmt (Presenter Handy-Fernsteuerung und JM Timer, Studio-Control Rolle je Benutzer, Connect laufende Zoom-Kachel und Sprecher-Signal, Player Show-Auswahl) | „Setzen“ |
| X6 | Name dieses Knopfs für Screenreader, z. B. „Setzen: Handy-Fernsteuerung“ oder „Setzen: Show“ | „Setzen: ‹…›“ |

## Presenter

Neu formuliert sind PS4 bis PS6, PS9 bis PS16, PS18, PS19, PS21, PS22, PS25, PS27 bis PS31, PS33, PS37, PS49 bis PS53, PS66 und PS70 bis PS73. PS1, PS2, PS7 und PS8 sind der alte Wortlaut ohne die Zeichen ▶ ■ ‹ ›; PS6 und PS9 ersetzen ⬛ und ⬜; PS26 ist neu im Presenter, mit dem Wortlaut aus Prompter, Stage Display und Player. Alle übrigen sind der bisherige Wortlaut, jetzt im Panel, in der Statusleiste, in der Leiste oder als Grund an einer Taste.

| Nr. | Ort | Text |
| --- | --- | --- |
| PS1 | Haupttaste (Editor, rechts in der Werkzeugleiste) | „Präsentieren“ |
| PS2 | Haupttaste (Editor, während der Präsentation; zeigt LIVE, solange das Publikum die Folie sieht) | „Beenden“ |
| PS3 | Haupttaste (Sperrgrund an „Präsentieren“ ohne sichtbare Folie; bisher eine Fehlermeldung, die man über den gesperrten Knopf nie erreichte) | „Keine sichtbaren Folien zum Präsentieren.“ |
| PS4 | Haupttaste (Sperrgrund an „Präsentieren“, falls der Editor beschäftigt ist und keinen eigenen Text schickt; sonst steht dort der Beschäftigt-Text wie „Konvertiere mit LibreOffice…“) | „Beschäftigt …“ |
| PS5 | Haupttaste (Sperrgrund aller Haupttasten in Editor und Referent, bis der Hauptprozess antwortet) und NDI-Schalter (Tooltip in dieser Zeit) | „Lädt …“ |
| PS6 | Haupttaste (Referent, links in der Reihe unter der Folie) und Statusleiste (Präsentation, solange Schwarz steht; als Warnung) | „Schwarz“ |
| PS7 | Haupttaste (Referent, links neben „Gehe zu“) | „Zurück“ |
| PS8 | Haupttaste (Referent, rechts neben „Gehe zu“) | „Weiter“ |
| PS9 | Haupttaste (Referent, rechts in der Reihe unter der Folie) und Statusleiste (Präsentation, solange Weiß steht; als Warnung) | „Weiß“ |
| PS10 | Haupttaste (an Schwarz bzw. Weiß, solange die Pause steht: „Schwarz · an“, „Weiß · an“) | „ · an“ |
| PS11 | Haupttaste (Kürzel an Schwarz, eigene Zeile unter der Beschriftung) | „B“ |
| PS12 | Haupttaste (Kürzel an Zurück) | „←“ |
| PS13 | Haupttaste (Kürzel an Weiter) | „→“ |
| PS14 | Haupttaste (Kürzel an Weiß) | „W“ |
| PS15 | Haupttaste (Sperrgrund an Zurück auf der ersten Folie) | „Erste Folie“ |
| PS16 | Haupttaste (Sperrgrund an Weiter auf der letzten Folie ohne Schleife; mit Schleife bleibt Weiter bedienbar) | „Letzte Folie“ |
| PS17 | Kopf (Referent, ganz rechts nach ⚙; bei schmalem Fenster letzte Taste rechts in der Leiste, P2 B; wörtlich der alte Knopf ganz rechts im Kopf) | „■ Beenden“ |
| PS18 | Kopf bzw. Leiste (Referent, Tooltip von „■ Beenden“: das vorhandene Kürzel) | „Esc“ |
| PS19 | Statusleiste (Titel) | „Publikum“ |
| PS20 | Statusleiste (Publikum, Präsentation läuft ohne Publikumsfenster), Panel (Editor, nur Windows: Schalter unter „Ausgabe auf Bildschirm“; vorher Eintrag der Bildschirmwahl im Kopf) und Leiste (Referent, Eintrag der Bildschirmwahl, solange nur NDI läuft) | „Keiner – nur NDI“ |
| PS21 | Panel (Editor, Sperrgrund von „Ausgabe auf Bildschirm“, solange „Keiner – nur NDI“ gewählt ist) | „„Keiner – nur NDI“ ist gewählt.“ |
| PS22 | Panel (Editor, Sperrgrund des Schalters „Keiner – nur NDI“, solange NDI kein Bild liefert; vorher gesperrt ohne Grund) | „Erst wählbar, wenn NDI ein Bild liefert.“ |
| PS23 | Leiste (Referent, Tooltip der Bildschirmwahl, wie bisher) | „Publikums-Bildschirm“ |
| PS24 | Leiste (Referent, Tooltip an „Publikum Vollbild“, wenn nur NDI läuft, wie bisher; neu auch als Sperrgrund von „Auf diesen Bildschirm“) | „Kein Publikumsfenster – Bild nur über NDI“ |
| PS25 | Statusleiste (Publikum, Präsentation beendet, Fenster gemessen noch offen: „aus, Fenster noch offen · ‹Bildschirm›“) | „‹…› · ‹…›“ |
| PS26 | Leiste (Referent, Knopf rechts neben der Bildschirmwahl; erst er verschiebt das Publikum) | „Auf diesen Bildschirm“ |
| PS27 | Leiste (Tooltip von „Auf diesen Bildschirm“, gesperrt, bis Präsentation und Bildschirmliste bekannt sind) | „Bildschirm des Publikums unbekannt“ |
| PS28 | Leiste (Tooltip von „Auf diesen Bildschirm“, gesperrt, solange kein Publikumsfenster gemessen ist) | „Kein Publikumsfenster“ |
| PS29 | Leiste (Tooltip von „Auf diesen Bildschirm“, gesperrt ohne Wahl) | „Kein Bildschirm gewählt“ |
| PS30 | Leiste (Tooltip von „Auf diesen Bildschirm“, gesperrt, solange die Wahl der gemessene Bildschirm ist) | „Das Publikum steht schon auf diesem Bildschirm.“ |
| PS31 | Panel (NDI-Ausgabe, nur Windows; Fehlertext, falls der Hauptprozess bei „nicht verfügbar“ keinen Grund mitschickt) | „nicht verfügbar“ |
| PS32 | Panel (NDI-Ausgabe, Hinweis unter dem Abschnitt) und Tooltip des NDI-Schalters in Werkzeugleiste und Leiste, wörtlich der alte Tooltip | „NDI-Ausgang „JM Presenter“: 1920×1080, 25 fps, transparente Ränder“ |
| PS33 | NDI-Schalter (Werkzeugleiste und Leiste, bis der Hauptprozess antwortet; ‹…› ist „unbekannt“) | „NDI ‹…›“ |
| PS34 | Panel (Gegenstellen, Name der Zeile) und Statusleiste (Titel), wie bisher | „JM Timer“ |
| PS35 | Panel (Hinweis unter „Gegenstellen“; wörtlich aus dem alten ⚙-Menü) | „Zeigt den Countdown des JM Timers live in der Referentenansicht.“ |
| PS36 | Panel (Abschnittstitel) und Statusleiste (Titel); bisher Tooltip von 📱 | „Handy-Fernsteuerung“ |
| PS37 | Statusleiste (Handy-Fernsteuerung, der Server läuft) | „läuft“ |
| PS38 | Panel (Handy-Fernsteuerung, Beschreibung des Abschnitts; wörtlich aus dem alten Fenster) | „Steuere die Präsentation vom Handy oder Tablet im selben Netzwerk.“ |
| PS39 | Panel (Handy-Fernsteuerung, Beschriftung des Schalters, an) | „Server aktiv“ |
| PS40 | Panel (Handy-Fernsteuerung, Beschriftung des Schalters, aus) | „Server aus“ |
| PS41 | Panel (Handy-Fernsteuerung, Hinweis am Schalter, an) | „Telefone können sich verbinden.“ |
| PS42 | Panel (Handy-Fernsteuerung, Hinweis am Schalter, aus) | „Einschalten, um ein Gerät zu koppeln.“ |
| PS43 | Panel (Handy-Fernsteuerung, Beschriftung der Auswahl) | „Netzwerkkarte“ |
| PS44 | Panel (Handy-Fernsteuerung, Schalter) | „PIN-Schutz (empfohlen im offenen WLAN)“ |
| PS45 | Panel (Handy-Fernsteuerung, Überschrift über Adresse und QR-Code) | „Am Handy öffnen“ |
| PS46 | Panel (Handy-Fernsteuerung, Überschrift der PIN) | „PIN“ |
| PS47 | Panel (Handy-Fernsteuerung, Kopplung ohne PIN) | „Ohne PIN — jeder im Netzwerk kann steuern.“ |
| PS48 | Panel (Handy-Fernsteuerung, Ersatztext des QR-Bilds) | „QR“ |
| PS49 | Panel (Handy-Fernsteuerung, Sperrgrund von „Setzen“, solange nichts geändert ist) | „Netzwerkkarte und Port sind schon so eingestellt.“ |
| PS50 | Panel (Handy-Fernsteuerung, Sperrgrund von „Setzen“ bei ungültigem Port; nennt den Bereich, den der Handy-Server wie bisher annimmt, und weicht darum bewusst vom gemeinsamen Text „Setzen geht erst mit einem gültigen Port.“ ab) | „Setzen geht erst mit einem Port von 1024 bis 65535.“ |
| PS51 | Panel (Handy-Fernsteuerung, Sperrgrund von „Setzen“, solange angewendet wird; Server- und PIN-Schalter sind dann ebenfalls gesperrt) | „Wird angewendet …“ |
| PS52 | Panel (Abschnittstitel; vorher „🌐 Gast-Klicker übers Internet (Zoom-Gäste)“) und Statusleiste (Titel) | „Gast-Klicker“ |
| PS53 | Statusleiste (Gast-Klicker, verbunden und pausiert; als Warnung) | „pausiert“ |
| PS54 | Panel (Gast-Klicker, Beschreibung des Abschnitts; wörtlich) | „Remote-Gäste öffnen einen Link im Browser und schalten ihre Folien selbst weiter – ohne Installation.“ |
| PS55 | Panel (Gast-Klicker, Beschriftung des Schalters, an) | „Gast-Klicker an“ |
| PS56 | Panel (Gast-Klicker, Beschriftung des Schalters, aus) | „Gast-Klicker aus“ |
| PS57 | Panel (Gast-Klicker, Name des Schalters für Screenreader) | „Gast-Klicker ein/aus“ |
| PS58 | Panel (Gast-Klicker, Feld) | „Link für die Gäste“ |
| PS59 | Panel (Gast-Klicker, Knopf) | „Für den Zoom-Chat kopieren“ |
| PS60 | Panel (Gast-Klicker, derselbe Knopf für zwei Sekunden nach dem Kopieren) | „Kopiert ✓“ |
| PS61 | Panel (Gast-Klicker, Knopf) | „Gast-Klick pausieren“ |
| PS62 | Panel (Gast-Klicker, Knopf, solange pausiert) | „Gast-Klick fortsetzen“ |
| PS63 | Panel (Gast-Klicker, Knopf) | „Neuer Link“ |
| PS64 | Rückfrage nach „Neuer Link“ (Systemdialog, wie bisher) | „Neuen Link erzeugen? Der alte Link funktioniert dann nicht mehr.“ |
| PS65 | Panel (Gast-Klicker, Hinweis) | „Wer den Link hat, kann vor/zurück klicken. Ist Publikum im Chat, den Link privat an den Gast schicken. Dein eigener Clicker und die Tastatur wirken immer.“ |
| PS66 | Panel (Abschnittstitel, nur im Editor; vorher Teil des ⚙-Menüs) | „Import“ |
| PS67 | Panel (Import, Schalter) | „PPTX-Aufbau-Animationen als Einzelschritte“ |
| PS68 | Panel (Import, Abzeichen am Abschnittstitel) | „experimentell“ |
| PS69 | Panel (Import, Hinweis am Schalter) | „Splittet On-Click-Animationen beim Office-Import in einzelne Folien. Bei Problemen wird automatisch auf das flache PDF zurückgefallen.“ |
| PS70 | Statusleiste (Titel) | „Präsentation“ |
| PS71 | Statusleiste (Präsentation, keine läuft) | „keine“ |
| PS72 | Statusleiste (Präsentation läuft, das Publikum sieht die Folie) | „Folie ‹…› von ‹…›“ |
| PS73 | Panel (Fernsteuerung, Modulname im Companion-Hinweis) | „JM Presenter“ |

## Studio-Control

Neu formuliert sind SC1, SC3 bis SC12 und SC27 bis SC35. SC2 ist als ON AIR neu und an den Haupttasten der alte Wortlaut ohne „● “; SC13 bis SC17 sind die bisherigen Gerätenamen, jetzt auch als Statuseinträge. SC18 bis SC26 sind der alte Wortlaut der Haupttasten ohne „● “ und ohne Großschreibung; OBS heißt jetzt „STREAM“ wie ATEM und TriCaster statt „Stream“.

| Nr. | Ort | Text |
| --- | --- | --- |
| SC1 | Kopf (ON AIR, solange ein verbundener ATEM oder OBS streamt) | „LIVE“ |
| SC2 | Kopf (ON AIR, solange ein verbundener ATEM oder OBS aufnimmt, ohne Stream) und Haupttaste (ATEM, TriCaster) | „REC“ |
| SC3 | Werkzeugleiste (rechts; vorher „Logout“ im Kopf) | „Abmelden“ |
| SC4 | Werkzeugleiste (Rolle rechts neben dem Namen), Statusleiste (Benutzer) und Sperrgrund (SC28) | „Admin“ |
| SC5 | Werkzeugleiste, Statusleiste und Sperrgrund wie SC4 | „Bediener“ |
| SC6 | Werkzeugleiste, Statusleiste und Sperrgrund wie SC4 | „Betrachter“ |
| SC7 | Werkzeugleiste (rechts) und Statusleiste (Benutzer): Name und Rolle, z. B. „Niki · Bediener“ | „‹…› · ‹…›“ |
| SC8 | Statusleiste (Titel) | „Benutzer“ |
| SC9 | Statusleiste (Titel; vorher Pille „Sync“ bzw. „Offline“ im Kopf) | „Server“ |
| SC10 | Statusleiste (Server getrennt) und Geräte-Pillen und -Einträge (getrennt ohne Fehlertext) | „getrennt“ |
| SC11 | Statusleiste (Titel; heißt wie der Reiter) | „Licht“ |
| SC12 | Statusleiste (Licht, Blackout gesetzt; als Warnung) und Licht-Pille | „Blackout (ohne Rückmeldung)“ |
| SC13 | Statusleiste (Titel, sobald ein ATEM eingerichtet ist) und Sperrgründe | „ATEM“ |
| SC14 | Statusleiste (Titel, sobald ein OBS eingerichtet ist) und Sperrgründe | „OBS“ |
| SC15 | Statusleiste (Titel, sobald ein TriCaster eingerichtet ist) und Sperrgründe | „TriCaster“ |
| SC16 | Statusleiste (Titel, sobald eine Kamera eingerichtet ist) und Sperrgründe | „PTZ“ |
| SC17 | Statusleiste (Titel, sobald ein Pult eingerichtet ist) | „Audio“ |
| SC18 | Haupttaste (ATEM) | „Cut“ |
| SC19 | Haupttaste (ATEM, TriCaster) | „Auto“ |
| SC20 | Haupttaste (ATEM) | „FTB“ |
| SC21 | Haupttaste (ATEM, TriCaster und jetzt auch OBS) | „STREAM“ |
| SC22 | Haupttaste (TriCaster) | „Take“ |
| SC23 | Haupttaste (TriCaster) | „Fade Black“ |
| SC24 | Haupttaste (OBS) | „Aufnahme“ |
| SC25 | Haupttaste (Licht, oben rechts im Licht-Panel) | „Blackout“ |
| SC26 | Haupttaste (Licht, solange Blackout gesetzt ist) | „Blackout aus“ |
| SC27 | Hinweis (unter der TriCaster-Reihe: REC und STREAM schalten um, ohne dass der TriCaster antwortet) | „REC und STREAM ohne Rückmeldung“ |
| SC28 | Haupttaste und PTZ-Halte-Knopf (Sperrgrund, wenn die Rolle das Schalten nicht darf; vor dem Gerätegrund) | „Rolle ‹…› darf nicht schalten“ |
| SC29 | Haupttaste und PTZ-Halte-Knopf (Sperrgrund, Gerät gemessen nicht verbunden, z. B. „ATEM nicht verbunden“) | „‹…› nicht verbunden“ |
| SC30 | Haupttaste und PTZ-Halte-Knopf (Sperrgrund, solange das Gerät nichts gemeldet hat oder der Server nicht verbunden ist, z. B. „ATEM unbekannt“) | „‹…› unbekannt“ |
| SC31 | Haupttaste (Sperrgrund, solange niemand angemeldet ist; die Gerätepanels stehen erst nach der Anmeldung, im Betrieb also nicht zu sehen, abgeleitet) | „Nicht angemeldet“ |
| SC32 | Haupttaste (Sperrgrund des Blackout vor der ersten Antwort und ohne Server) und OBS (Zeile statt der Szenenknöpfe, solange nichts gemessen ist; vorher „Nicht verbunden.“) | „Zustand unbekannt“ |
| SC33 | Setup › Benutzer (Sperrgrund von „Setzen“ je Zeile, solange die Rolle nicht geändert ist) | „Die Rolle ist schon so eingestellt.“ |
| SC34 | Setup › Benutzer (Sperrgrund von „Setzen“ in der eigenen Zeile) | „Du kannst deine eigene Rolle nicht ändern.“ |
| SC35 | Panel (Fernsteuerung, Modulname im Companion-Hinweis; nur im App-Fenster) | „JM Studio Control“ |

## Connect

Neu formuliert sind CN1 bis CN9 als Statuseinträge (CN1 bis CN3 auch als Panel-Abschnitte), CN11 bis CN18, CN22 und CN24 bis CN29. CN10 ist der bisherige Name „Zoom-Slots“, jetzt als Statuseintrag. CN19 bis CN21 sind die bisherigen Beschriftungen, jetzt eine Taste; CN23 ist der alte Wortlaut ohne 🎙. Die Zustandstexte der Einträge Zoom, Programm und Gäste (NDI) sind die vorhandenen Zeilen aus Kopf, Tray und Abzeichen (bei Zoom und Gäste ohne den Vorsatz „‹Symbol› Zoom: “ bzw. „‹Symbol› Gäste: “).

| Nr. | Ort | Text |
| --- | --- | --- |
| CN1 | Statusleiste (Titel; der Text ist die Zugangszeile aus dem Hauptprozess) und Panel (Abschnittstitel; vorher Karte „Cloud-Zugang: ‹Adresse› · ‹Zugangszeile›“ im Live-Bereich) | „Cloud-Zugang“ |
| CN2 | Statusleiste (Titel, nur unter Windows und nur bei einem Mangel; öffnet das Panel dort) und Panel (Abschnittstitel; vorher Knopf „Einrichtung“ bzw. die aufgeklappte Einrichtung im Arbeitsbereich) | „Zoom-Einrichtung“ |
| CN3 | Panel (Abschnittstitel; vorher „Vorgaben …“ und „Sprecher-Einstellungen …“ in der Zoom-Karte) | „Zoom-Vorgaben“ |
| CN4 | Statusleiste (Titel; vorher „● Raum verbunden“ bzw. „○ Raum nicht verbunden“ im Kopf) | „Raum“ |
| CN5 | Statusleiste (Titel, nur unter Windows; vorher die Zoom-Zeile im Kopf) | „Zoom“ |
| CN6 | Statusleiste (Titel; Text wie das Programm-Abzeichen) | „Programm“ |
| CN7 | Statusleiste (Titel; „gefunden“ bzw. „nicht gefunden“) | „Presenter“ |
| CN8 | Statusleiste (Titel; Text wie die Gäste-Zeile im Tray) | „Gäste (NDI)“ |
| CN9 | Statusleiste (Titel; der Eintrag steht auf Sendung, solange ein Gast auf Sendung ist) | „Gäste“ |
| CN10 | Statusleiste (Titel, nur unter Windows) | „Zoom-Slots“ |
| CN11 | Statusleiste (Gäste und Zoom-Slots, zwei Angaben, z. B. „2 auf Sendung · 1 im Warteraum“) | „‹…› · ‹…›“ |
| CN12 | Statusleiste (Raum, ohne Verbindung) | „nicht verbunden“ |
| CN13 | Statusleiste (Raum, nach einem Raumabbruch; als Fehler) | „abgebrochen“ |
| CN14 | Statusleiste (Gäste, niemand im Warteraum oder auf Sendung) | „keine im Warteraum oder auf Sendung“ |
| CN15 | Statusleiste (Gäste) | „‹…› im Warteraum“ |
| CN16 | Statusleiste (Gäste) | „‹…› auf Sendung“ |
| CN17 | Statusleiste (Zoom-Slots) | „‹…› mit Ersatzbild“ |
| CN18 | Statusleiste (Zoom-Slots) | „‹…› offen“ |
| CN19 | Haupttaste (Raum, ohne Show; wie bisher) | „Raum öffnen“ |
| CN20 | Haupttaste (Raum, mit Show; wie bisher) | „Raum „‹…›“ öffnen“ |
| CN21 | Haupttaste (Raum, solange er offen ist; dieselbe Taste wie CN19) und Knopf unter den Haupttasten nach einem Raumabbruch (wie bisher) | „Raum schließen“ |
| CN22 | Haupttaste (rechts neben der Raum-Taste, halten zum Sprechen; vorher „🎙 Halten zum Sprechen (alle Gäste)“) | „Talkback alle“ |
| CN23 | Haupttaste (Talkback alle, solange gehalten) | „Regie spricht — alle Gäste“ |
| CN24 | Haupttaste (Sperrgrund der Raum-Taste ohne Cloud-Zugang; sonst steht dort die Zugangszeile aus dem Hauptprozess) | „Cloud-Zugang fehlt“ |
| CN25 | Haupttaste (Sperrgrund von „Talkback alle“) und 🎙 je Gast (Tooltip „Gesperrt: …“), solange der Raum nicht verbunden ist | „Raum nicht verbunden“ |
| CN26 | Haupttaste (Sperrgrund der Raum-Taste, bis der Hauptprozess antwortet) | „Zustand unbekannt“ |
| CN27 | Zoom-Spalte (laufende Kachel im Modus Aktiver Sprecher oder Bildschirmfreigabe, Einstellungen offen: Sperrgrund von „Setzen“, solange nichts geändert ist) | „Auflösung, Ersatzbild und Bildformat sind schon so eingestellt.“ |
| CN28 | Panel (Zoom-Vorgaben, Sperrgrund von „Setzen“ unter dem Sprecher-Signal, solange Signal und Haltezeit nicht geändert sind; geändert in der Gesamtprüfung, I4, weil „Setzen“ jetzt auch die Haltezeit übernimmt; vorher „Das Sprecher-Signal ist schon so eingestellt.“) | „Sprecher-Signal und Haltezeit sind schon so eingestellt.“ |
| CN29 | Zoom-Spalte und Panel (Sperrgrund von „Setzen“, solange gesendet wird) | „Wird gesendet …“ |
| CN30 | Zoom-Spalte (laufende Teilnehmer-Kachel, Einstellungen offen: Sperrgrund von „Setzen“, solange Person und Auswahlen nicht geändert sind; neu in der Gesamtprüfung, I4, weil „Setzen“ dort auch die Person übernimmt) | „Person, Auflösung, Ersatzbild und Bildformat sind schon so eingestellt.“ |

## Nachzug

Prompter, Stage Display und Player (2a-Werkzeuge, je eine Patch-Version). Neu formuliert sind PLN2 bis PLN4. PRN1 und PRN2 sind die bisherigen Kürzel, jetzt in jedem Zustand und in eigener Zeile; PRN3, SDN1 und PLN1 sind die bisherigen Titel, die nur noch in der Statusleiste stehen, weil die Zeile darunter im Panel entfällt (der Abschnitt nennt den Bildschirm jetzt selbst, X1 und X2).

| Nr. | Ort | Text |
| --- | --- | --- |
| PRN1 | Prompter, Haupttaste (Kürzel an GO, jetzt in jedem Zustand, auch im Lauf neben LIVE und Pause, in eigener Zeile unter der Beschriftung) | „Leertaste“ |
| PRN2 | Prompter, Haupttaste (Kürzel an Anfang, in eigener Zeile) | „Pos1“ |
| PRN3 | Prompter, Statusleiste (Titel; die Zeile „Talent-Monitor: ‹Zustand›“ unter „Ausgabe auf Bildschirm“ entfällt) | „Talent-Monitor“ |
| SDN1 | Stage Display, Statusleiste (Titel; die Zeile „Bühnenschirm: ‹Zustand›“ unter „Ausgabe auf Bildschirm“ entfällt) | „Bühnenschirm“ |
| PLN1 | Player, Statusleiste (Titel; die Zeile „Video-Ausgabe: ‹Zustand›“ unter „Ausgabe auf Bildschirm“ entfällt) | „Video-Ausgabe“ |
| PLN2 | Player, Cue-Show (Name der Show-Auswahl für Screenreader, in „Setzen: Show“) | „Show“ |
| PLN3 | Player, Cue-Show (Sperrgrund von „Setzen“, solange die Show gewählt wird; Tooltip) | „Die Show wird gewählt …“ |
| PLN4 | Player, Cue-Show (Tooltip an „Umbenennen“ und „Löschen“, gesperrt, solange eine andere Show gewählt, aber nicht gesetzt ist) | „Setze erst die gewählte Show oder nimm die Auswahl zurück.“ |

## Changelog

Entwurf der Release-Notizen (`packages/suite-manifest/changelog.json`), wörtlich wie dort. Das Datum ist ein Platzhalter. CL-PS4 nennt den Tastenfilter für Textfelder und die Weiter-Taste mit Schleife; CL-PL2 ist der Video-Beleg: Was Player 0.9.0 über ON AIR versprach, stimmt jetzt auch nach Alt+F4 und Wiederöffnen.

| Nr. | App, Version | Text |
| --- | --- | --- |
| CL-PS1 | Presenter 0.15.0 | „Neue Oberfläche im Editor: Oben die Kopfzeile mit „JM Presenter“, ON AIR und den Schaltern für Hell und Dunkel (je Rechner gemerkt) sowie Einstellungen, darunter die Werkzeugleiste mit den Datei-Knöpfen, NDI und der Haupttaste „Präsentieren“ bzw. „Beenden“. Das ⚙-Menü und das Fenster „Fernsteuerung übers Netzwerk“ (📱) sind ins Panel hinter ⚙ umgezogen: Ausgabe auf Bildschirm, NDI-Ausgabe, Fernsteuerung, Handy-Fernsteuerung, Gast-Klicker, Gegenstellen (JM Timer) und Import. Handy-Fernsteuerung und Gast-Klicker sind damit auch ohne laufende Präsentation erreichbar.“ |
| CL-PS2 | Presenter 0.15.0 | „Die Referentenansicht bleibt dunkel, auch wenn der Editor hell ist. Oben stehen ON AIR, ⚙ und ganz rechts „■ Beenden“, darunter eine Leiste mit Folienzähler, Folientitel und Uhr, rechts Bildschirmwahl, „Auf diesen Bildschirm“, NDI, Gast-Klick, Schleife, „Publikum Vollbild“, „Vollbild“ und „Übersicht“; bei schmalem Fenster steht „■ Beenden“ dort als letzte Taste, wie im alten, zweizeiligen Kopf. Unter der Folie liegen die Tasten „Schwarz“, „Zurück“, „Gehe zu“, „Weiter“ und „Weiß“ mit ihren Kürzeln B, ←, → und W. Die Bildschirmwahl merkt nur den Bildschirm; das Publikum zieht erst mit „Auf diesen Bildschirm“ um.“ |
| CL-PS3 | Presenter 0.15.0 | „Neue Statusleiste in Editor und Referent: Master, JM Timer, Publikum, NDI (nur Windows), Fernsteuerung, Handy-Fernsteuerung, Gast-Klicker und Präsentation. Sie zeigt nur, was der Presenter wirklich meldet; bis zur ersten Antwort steht dort „unbekannt“. ON AIR leuchtet nur, solange das Publikum die Folie sieht, nicht bei Schwarz oder Weiß. Gesperrte Tasten nennen ihren Grund, etwa „Erste Folie“, „Letzte Folie“ oder „Keine sichtbaren Folien zum Präsentieren.““ |
| CL-PS4 | Presenter 0.15.0 | „Tastenkürzel wirken nicht mehr, solange der Cursor in einem Textfeld steht: Punkt, Komma, B, W, Rücktaste und Enter schalten im Feld „Gehe zu“ und in den Feldern des Panels nicht mehr schwarz oder weiß und blättern nicht. Enter in „Gehe zu“ springt jetzt zur Folie, danach wirken Klicker und Tasten sofort wieder; der Klicker blättert auch, wenn die Bildschirmwahl den Fokus hat oder im Panel eine Auswahl oder der Gast-Link markiert ist. Mit Schleife lässt sich „Weiter“ auf der letzten Folie drücken und springt zur ersten; bisher war die Taste dort gesperrt. Netzwerkkarte und Port der Handy-Fernsteuerung sowie Host und Port des JM Timers gelten erst mit „Setzen“. Es gibt keine neuen Tastenkürzel.“ |
| CL-SC1 | Studio-Control 0.7.0 | „Neue Oberfläche: Die Anmeldung steht im Rahmen mit der Kopfzeile „JM Studio Control“ und dem Schalter für Hell und Dunkel, der jetzt je Rechner gemerkt wird. Nach der Anmeldung stehen die Reiter Video, Audio, Licht und Setup in der Werkzeugleiste, rechts daneben Name und Rolle und „Abmelden“ (bisher „Logout“). Im App-Fenster liegt hinter ⚙ das Panel „Fernsteuerung“ mit dem Stand des Companion-Gateways (Port 8735); im Browser gibt es kein ⚙.“ |
| CL-SC2 | Studio-Control 0.7.0 | „Neue Statusleiste: Master, Server, je eingerichtetem Gerätetyp ATEM, OBS, TriCaster, PTZ und Audio, dazu Licht, Fernsteuerung und Benutzer. Sie zeigt nur Gemessenes: Ist der Server getrennt oder hat er noch nicht geantwortet, stehen die Geräte auf „unbekannt“ und ihre Tasten sind gesperrt. ON AIR zeigt „LIVE“ bzw. „REC“ nur, wenn ein verbundener ATEM oder OBS wirklich streamt oder aufnimmt.“ |
| CL-SC3 | Studio-Control 0.7.0 | „Die Haupttasten (ATEM Cut, Auto, FTB, REC, STREAM; TriCaster Take, Auto, Fade Black, REC, STREAM; OBS Aufnahme, STREAM; Licht Blackout) stehen in der gewohnten Reihenfolge, zeigen LIVE nur bei gemessener Sendung und nennen ihren Grund, wenn sie gesperrt sind, etwa „Rolle Betrachter darf nicht schalten“ oder „ATEM nicht verbunden“. Unter der TriCaster-Reihe steht „REC und STREAM ohne Rückmeldung“. Den Blackout sieht jetzt auch der Betrachter, gesperrt mit Grund. Die festen Texte der Geräte-Pillen sind deutsch; bei einer Trennung zeigt die Pille den Fehlertext des Geräts.“ |
| CL-SC4 | Studio-Control 0.7.0 | „PTZ-Richtung, Zoom und Fokus lassen sich auch per Leertaste oder Enter halten; das Loslassen kommt genau einmal, auch wenn das Fenster dabei den Fokus verliert. Im Setup ändert die Rollen-Auswahl eine Rolle erst mit „Setzen“. „Logout“, „Light“ und „Dark“, „Coming soon“ und die Hinweise an den Reitern entfallen. Befehle, Companion-Gateway und Geräteanbindung bleiben gleich, es gibt weiter keine Tastenkürzel.“ |
| CL-CN1 | Connect 0.6.0 | „Neue Oberfläche: Oben die Kopfzeile mit „JM Connect“, ON AIR und den Schaltern für Hell und Dunkel sowie Einstellungen. Darunter zwei Spalten: links der Cloud-Raum mit der Raum-Taste, „Talkback alle“, Einladungen und Gästeliste, rechts Zoom (nur Windows; auf dem Mac eine Spalte). Cloud-Zugang, Zoom-Einrichtung, Zoom-Vorgaben und Fernsteuerung liegen jetzt im Panel hinter ⚙. Unten steht immer die Fußzeile mit Logordner und Lizenzbedingungen.“ |
| CL-CN2 | Connect 0.6.0 | „Neue Statusleiste mit Master, Cloud-Zugang, Raum, Zoom, Zoom-Einrichtung, Programm, Presenter, Gäste (NDI), Zoom-Slots, Fernsteuerung und Gäste. Sie zeigt nur Gemessenes; bis zur ersten Antwort steht dort „unbekannt“. ON AIR leuchtet nur, solange der Raum verbunden und mindestens ein Gast auf Sendung ist. Fehlt etwas in der Zoom-Einrichtung, öffnet der Eintrag „Zoom-Einrichtung“ das Panel an dieser Stelle.“ |
| CL-CN3 | Connect 0.6.0 | „Eine Taste öffnet und schließt den Raum und nennt ihren Grund, wenn sie gesperrt ist; das zweite „Raum schließen“ in der Einladen-Zeile entfällt. „Talkback alle“ steht immer neben der Raum-Taste. „Talkback alle“ und 🎙 je Gast lassen sich auch per Leertaste oder Enter halten; das Loslassen kommt genau einmal, auch beim Wechsel in ein anderes Fenster. In breiten Fenstern stehen 🎙 und 📊 vor dem Namen des Gasts.“ |
| CL-CN4 | Connect 0.6.0 | „An laufenden Zoom-Slots gelten Auflösung, Ersatzbild und Bildformat erst mit „Setzen“, ebenso das Sprecher-Signal in den Zoom-Vorgaben; Person und Sprecher-Haltezeit eines laufenden Slots gelten erst mit Enter oder „Setzen“; ein Durchblättern mit den Pfeiltasten schaltet das Bild nicht mehr um. Die Zeilen „Steuerport 8737“ und „● Raum verbunden“ im Kopf entfallen, das zeigt jetzt die Statusleiste. NDI-Bilder, Talkback und Fernsteuerung (Port 8737) bleiben gleich, es gibt keine neuen Tastenkürzel.“ |
| CL-PR1 | Prompter 0.8.1 | „GO zeigt das Kürzel „Leertaste“ jetzt auch, während der Text läuft, und „Anfang“ das Kürzel „Pos1“, je in einer eigenen Zeile unter der Beschriftung. In der kleinsten Fenstergröße ist der Satz unter dem Tempo dadurch erst nach Scrollen ganz zu sehen.“ |
| CL-PR2 | Prompter 0.8.1 | „Unter „Ausgabe auf Bildschirm“ nennen Pille und „Steht auf“ jetzt den Bildschirm, auf dem der Talent-Monitor wirklich steht, nicht den nur gewählten; ein angesteckter oder abgezogener Bildschirm erscheint in der Liste, ohne das Panel neu zu öffnen. Die Adressen der Handy-Fernbedienung lassen sich markieren.“ |
| CL-SD1 | Stage Display 0.7.1 | „Unter „Ausgabe auf Bildschirm“ nennen Pille und „Steht auf“ jetzt den Bildschirm, auf dem der Bühnenschirm wirklich steht, nicht den nur gewählten; die Zeile „Bühnenschirm: …“ darunter entfällt. Ein angesteckter oder abgezogener Bildschirm erscheint in der Liste, ohne das Panel neu zu öffnen.“ |
| CL-PL1 | Player 0.9.1 | „In der Cue-Show wechselt die Show-Auswahl die Show erst mit „Setzen“, das dann rechts im Kopf der Cue-Show vor „▦ Ausgabe“ erscheint. Bisher wechselte schon jede Auswahl die Show und stoppte die laufende hart, auch ein versehentlicher Druck auf eine Pfeiltaste. Solange eine Show gewählt, aber nicht gesetzt ist, sind „Umbenennen“ und „Löschen“ gesperrt.“ |
| CL-PL2 | Player 0.9.1 | „ON AIR und die Anzeige „1 laufend“ zählen ein Video jetzt auch richtig, nachdem das Ausgabefenster per Alt+F4 geschlossen und über den Schalter „Ausgabe“ wieder geöffnet wurde: Es zählt erst wieder, wenn es im Ausgabefenster wirklich läuft. Unter „Ausgabe auf Bildschirm“ nennen Pille und „Steht auf“ den Bildschirm, auf dem das Fenster wirklich steht; neue oder abgezogene Bildschirme erscheinen ohne neues Öffnen des Panels.“ |

## Entfällt

Sichtbare Texte, die mit dem Umbau wegfallen oder anders gesagt werden (R9). Spalte „Ersatz“: was an die Stelle tritt, wenn etwas.

| Nr. | Werkzeug | Alter Text | Ersatz |
| --- | --- | --- | --- |
| EN1 | Presenter | Der Name in Großbuchstaben „JM PRESENTER“ und der Untertitel „Folien-Editor & Präsentation“ (beide erst ab mittlerer Breite) | „JM Presenter“ mit Logo aus dem gemeinsamen Kopf, in jeder Breite; der Untertitel entfällt (E16) |
| EN2 | Presenter, Editor | „▶ Präsentieren“, „■ Beenden“ (Kopf) | „Präsentieren“, „Beenden“ als Haupttaste in der Werkzeugleiste (PS1, PS2) |
| EN3 | Presenter, Editor | ⚙-Menü „Einstellungen“ mit dem Kontrollkästchen „JM Timer synchronisieren“, den Tooltips „Host / IP des JM Timers“ und „Port (Standard 7777)“ und dem Punkt mit dem Tooltip „verbunden“ bzw. „keine Verbindung“ | Panel-Abschnitt „Gegenstellen“ mit der Zeile „JM Timer“ (PS34), Schalter „Aktiv“, Feldern „Host“ und „Port“ und „Setzen“ (gemeinsame Texte), darunter die alte Erklärung (PS35); der Import-Schalter steht im Abschnitt „Import“ (PS66) |
| EN4 | Presenter, Editor | Bildschirmwahl im Kopf mit dem Tooltip „Publikums-Bildschirm“ | Panel-Abschnitt „Ausgabe auf Bildschirm“ (gemeinsamer Text); im Referenten bleibt der Tooltip an seiner Wahl (PS23) |
| EN5 | Presenter, Referent | „⬛“ und „⬜“ mit den Tooltips „Schwarzbild (Taste B)“ und „Weißbild (Taste W)“ | „Schwarz“ und „Weiß“ als Haupttasten mit den Kürzeln B und W, „ · an“ während der Pause (PS6, PS9 bis PS11, PS14) |
| EN6 | Presenter, Referent | „‹ Zurück“, „Weiter ›“ | „Zurück“, „Weiter“ mit den Kürzeln ← und → (PS7, PS8, PS12, PS13) |
| EN7 | Presenter, Referent | „📱“ mit dem Tooltip „Handy-Fernsteuerung“ | ⚙ im Kopf öffnet das Panel (B7); „Handy-Fernsteuerung“ ist Abschnitt und Statuseintrag (PS36) |
| EN8 | Presenter, Referent | Fenster „📱 Fernsteuerung übers Netzwerk“ mit „🌐 Gast-Klicker übers Internet (Zoom-Gäste)“ und „schließen ✕“ | Panel-Abschnitte „Handy-Fernsteuerung“ (PS36) und „Gast-Klicker“ (PS52), in Editor und Referent; das Panel schließt über ✕, Escape oder ⚙ |
| EN9 | Studio-Control | Kopf-Marke „JM STUDIO“ mit „Control“ | „JM Studio Control“ mit Logo aus dem gemeinsamen Kopf (E16, B9) |
| EN10 | Studio-Control | „Logout“ | „Abmelden“ in der Werkzeugleiste (SC3) |
| EN11 | Studio-Control | „Light“ bzw. „Dark“ (Knopf im Kopf, nicht gemerkt) | Schalter für Hell und Dunkel aus dem gemeinsamen Baustein, die Wahl wird gemerkt |
| EN12 | Studio-Control | Pille „Sync“ bzw. „Offline“ im Kopf | Statuseintrag „Server“ (SC9) mit „verbunden“, „getrennt“ (SC10) oder „unbekannt“ |
| EN13 | Studio-Control | Hinweise an den Reitern: „TriCaster · PTZ · Kumo“ (Video), „Coming soon“ (Audio, Licht), „Geräte · Benutzer“ (Setup); nur ab großer Breite | keiner; „Geräte · Benutzer“ fiel mit, damit kein einzelner Rest bleibt (bitte sagen, falls er bleiben soll) |
| EN14 | Studio-Control | Logo und Titel „JM Studio Control“ in der Anmeldekarte | stehen im Kopf |
| EN15 | Studio-Control | Bereich „Coming soon“, nie sichtbar: „Phase 2+“, „Dieser Bereich ist im MVP noch nicht implementiert. Er wird im nächsten Schritt ergänzt.“ | keiner |
| EN16 | Studio-Control | Rollen im Kopf „admin“, „operator“, „viewer“ | „Admin“, „Bediener“, „Betrachter“ in der Werkzeugleiste (SC4 bis SC6); die Rollen-Auswahl im Setup bleibt englisch (Offene Fragen) |
| EN17 | Studio-Control | Geräte-Pillen „Idle“, „Connected · v‹Version›“, „Polling …“, „Offline“ (Fehler nur als Tooltip), „Verbinde …“, „Verbunden“ und das ATEM-Modell (z. B. „ATEM Mini Pro“) | gemeinsame Pillen „verbunden“, „verbindet …“, „unbekannt“, bei einer Trennung der Fehlertext bzw. „getrennt“ (SC10). TriCaster-Version und ATEM-Modell stehen damit nirgends mehr in der Oberfläche; Companion bekommt den ATEM-Namen weiter. Wenn Du sie zurück willst (etwa als Tooltip der Pille), notiere es hier |
| EN18 | Studio-Control | PTZ-Pille „Bereit“, „Standby“, „Suche …“ | gemeinsame Pillen wie EN17; ob die Kamera eingeschaltet oder im Standby ist, steht weiter bei der Kamera |
| EN19 | Studio-Control | Licht-Pille „Output → ‹Host›“, „Blackout“, „Kein Node“ | „an (ohne Rückmeldung)“ (gemeinsamer Text), „Blackout (ohne Rückmeldung)“ (SC12), „aus“ wie der Statuseintrag |
| EN20 | Studio-Control | Tasten „● REC“, „● STREAM“, „● Aufnahme“, „● Stream“ und die Großschreibung (CUT, AUTO, FADE BLACK, AUFNAHME …) | „REC“, „STREAM“, „Aufnahme“ in normaler Schreibweise, der Zustand zeigt die LIVE-Fläche; OBS heißt „STREAM“ (SC2, SC18 bis SC26) |
| EN21 | Studio-Control | Discovery „SCANNING“ (großgeschrieben) | „Scanning“ (bleibt englisch, Offene Fragen) |
| EN22 | Studio-Control | OBS „Nicht verbunden.“, auch wenn der Zustand nur unbekannt war | „Zustand unbekannt“ (SC32); „Nicht verbunden.“ bleibt für gemessen getrennt |
| EN23 | Connect | Zeile „Steuerport 8737“ im Kopf | Statuseintrag „Fernsteuerung“ und Panel-Abschnitt „Fernsteuerung“ mit dem Port (gemeinsame Texte) |
| EN24 | Connect | „● Raum verbunden“ bzw. „○ Raum nicht verbunden“ im Kopf | Statuseintrag „Raum“ (CN4) mit „verbunden“, „nicht verbunden“ (CN12) oder „abgebrochen“ (CN13) |
| EN25 | Connect | Zoom-Zeile im Kopf mit dem Vorsatz „‹Symbol› Zoom: “ | Statuseintrag „Zoom“ (CN5) mit derselben Zeile ohne Vorsatz; Tray und Tooltip behalten ihn |
| EN26 | Connect | Karte „Cloud-Zugang: ‹Adresse› · ‹Zugangszeile›“ mit „ändern“ und „Schließen“ | Statuseintrag und Panel-Abschnitt „Cloud-Zugang“ (CN1) |
| EN27 | Connect | Das zweite „Raum schließen“ in der Einladen-Zeile | die eine Raum-Taste (CN19 bis CN21, B21) |
| EN28 | Connect | „🎙 Halten zum Sprechen (alle Gäste)“, gehalten „🎙 Regie spricht — alle Gäste“ (volle Breite über der Gästeliste) | „Talkback alle“, gehalten „Regie spricht — alle Gäste“ (CN22, CN23), neben der Raum-Taste |
| EN29 | Connect | Knöpfe „Einrichtung“, „Vorgaben …“ und „Sprecher-Einstellungen …“ in der Zoom-Karte | Panel-Abschnitte „Zoom-Einrichtung“ und „Zoom-Vorgaben“ (CN2, CN3) |
| EN30 | Prompter, Stage Display, Player | Zeile unter „Ausgabe auf Bildschirm“ im Panel: „Talent-Monitor: ‹Zustand›“, „Bühnenschirm: ‹Zustand›“, „Video-Ausgabe: ‹Zustand›“ | die Pille des Abschnitts nennt den gemessenen Bildschirm (X2), darunter „Steht auf ‹Bildschirm›“ (X1) |

## Geänderte Bedienung

Keine Funktion fällt weg, es gibt keine neuen Tastenkürzel. An diesen Stellen verhält sich die Bedienung anders als bisher:

- **Alle, gemeinsame Bausteine:** Die Pille eines Panel-Abschnitts ist höchstens 12rem breit; ein längerer Text endet mit „…“, der volle Text steht im Tooltip. Das gilt in allen Werkzeugen mit Panel, ohne eigenes Release der übrigen (Owner 23.11. 13:31). Halten (Talkback, PTZ) geht auch per Leertaste oder Enter auf der fokussierten Taste; das Loslassen kommt je Druck genau einmal, auch wenn das Fenster den Fokus verliert, verdeckt wird, die Taste gesperrt wird oder verschwindet. Eine Taste mit Kürzelzeile zeigt das Kürzel in jedem Zustand in einer eigenen Zeile und ist in allen Zuständen gleich hoch (90 px), solange ihre Beschriftung in eine Zeile passt; zur Ausnahme „Schwarz · an“ bei 1024 Breite siehe Offene Fragen, Frage 1. Statusleiste mit vielen Einträgen (Gesamtprüfung): Kein Eintrag läuft mehr über seinen Nachbarn. Fehlt Platz, kürzen sich zuerst die Details, dann die Beschriftungen mit „…“; zuerst die Einträge „in Ordnung“ und „aus“, zuletzt Warnung, Fehler und LIVE; das Symbol bleibt sichtbar, der volle Text (Beschriftung und Detail) steht im Tooltip, jetzt auch ohne Detail. Gemessen mit den elf Einträgen von Connect bei 1600, 1280, 1024 und 900 px: keine Überlappung, Warnung, Fehler und LIVE behalten ihre Beschriftung; bei 1024 und 900 px zeigen die Einträge „in Ordnung“ und „aus“ nur noch ihr Symbol. Die Fehlerzeile unter einem Feld lässt sich markieren. Beides gilt in allen Werkzeugen mit Statusleiste bzw. Feldern, ohne eigenes Release der übrigen.
- **Presenter, Panel statt ⚙-Menü und 📱-Fenster:** Das ⚙-Menü des Editors und das Fenster „Fernsteuerung übers Netzwerk“ des Referenten sind ein Panel hinter ⚙, in beiden Fenstern; Handy-Fernsteuerung und Gast-Klicker gehen damit auch ohne laufende Präsentation. Das Panel schiebt den Inhalt zur Seite und verdeckt den Live-Bereich nicht. Escape im Panel schließt nur das Panel; bisher beendete Esc im Handy-Fenster die Präsentation. Außerhalb des Panels beendet Esc im Referenten wie bisher.
- **Presenter, Editor:** Die Haupttaste steht rechts in der Werkzeugleiste und ist auch in der Mindestgröße 900×640 erreichbar (bisher lag sie dort außerhalb des Fensters). Bei 900×640 bricht die Werkzeugleiste um, sobald NDI ein Bild liefert; die Haupttaste rückt dann 35 px tiefer (gemessen). Bei 1320×880 liegen Hell/Dunkel und ⚙ auf dem alten Platz von „▶ Präsentieren“ (nicht folgenreich). Die Haupttaste „Präsentieren“ bzw. „Beenden“ liegt auf dem alten Reiter „Übergänge“ der rechten Spalte, der NDI-Schalter auf dem alten Reiter „Folie“ (14 Konflikte bei 1320×880 und 900×640, gemessen in Task 10): Ein Gewohnheitsklick auf „Übergänge“ startet bzw. beendet die Präsentation, einer auf „Folie“ schaltet NDI. Hingenommen, die Lage nach B14 bleibt (Owner 24.11. 22:18, P1 A). Host und Port des JM Timers stehen jetzt immer da und gelten erst mit „Setzen“, nicht mehr beim Verlassen des Felds; ein leerer Host wird wie bisher 127.0.0.1, ein ungültiger Port 7777. Wer „Automatisch (Hauptmonitor)“ wählt, sieht danach den Eintrag des Hauptbildschirms als gewählt. Fehlt der gewählte Startbildschirm, melden Pille und Statuseintrag „Publikum“ das gleich. „Keiner – nur NDI“ und die Beschäftigt-Anzeige sind im echten Fenster ungemessen (Abnahme).
- **Presenter, Referent, Tastenfolge unter der Folie:** „Schwarz · Zurück · Gehe zu · Weiter · Weiß“. Das weicht vom Wortlaut W2-3 („Zurück · Weiter · Schwarz · Weiß“) ab. Grund ist die Tastenplatz-Regel: Zurück und Weiter bleiben links und rechts von „Gehe zu“ wie bisher, Schwarz und Weiß liegen an den Rändern, wo bisher nichts lag. Bestätigt mit der Planübersicht am 23.11. 13:15. Gemessen liegt unter der Folie bei 1500×920 und 1024×620 keine Taste auf dem alten Platz einer anderen; die Reihe ist höher und sitzt etwas höher als früher, wer genau auf die alte Mitte von „Zurück“ oder „Weiter“ klickt, trifft knapp darunter ins Leere. Bei offenem Panel und 1024 Breite rückt Weiter in eine zweite Zeile.
- **Presenter, Referent, „■ Beenden“ bei schmalem Fenster (Owner 24.11. 22:18, P2 B):** Ist das Fenster innen schmaler als 1476 px (also bei 1280×800 und 1024×620, nicht bei 1500×920), steht „■ Beenden“ nicht mehr im Kopf, sondern als letzte Taste rechts in der Leiste, oben in deren erster Zeile; im Kopf steht rechts dann nur ⚙. Dort lag „■ Beenden“ auch im alten Kopf, der bei diesen Breiten in zwei Zeilen umbrach. Bisher lag bei 1024 Breite das neue „■ Beenden“ auf dem alten „Publikum Vollbild“ bzw. bei vollem Kopf auf dem alten „⬜“ (ein Gewohnheitsklick beendete die Präsentation) und die Schleife auf dem alten „■ Beenden“. Ab 1476 px bleibt alles wie gebaut. Der Umschaltpunkt ist die Breite, ab der der alte Kopf in jedem gemessenen Zustand einzeilig war; wer das Fenster darüber oder darunter zieht, sieht „■ Beenden“ einmal den Ort wechseln. Gemessen (36 Breiten von 1024 bis 1920, die Zustände aus Task 11, zwei Läufe): Keine Taste liegt auf dem alten Platz von „■ Beenden“, und „■ Beenden“ liegt auf keinem alten Bedienelement außer dem alten „■ Beenden“; auch sonst liegt keine folgenreiche Taste auf dem alten Platz einer anderen im selben Zustand, außer wie bisher bei vollem Kopf zwischen 1100 und 1180 Breite: dort liegt „Auf diesen Bildschirm“ auf dem alten „Publikum Vollbild“ (gesperrt, solange kein anderer Bildschirm gewählt ist). Preis: Zwischen 1300 und 1400 Breite ist die Leiste in den meisten Zuständen zweizeilig statt einzeilig (die Folie bleibt gleich groß); bei vollem Kopf (NDI sendet, Gast-Klick an, Schleife) bis 1080 Breite ist sie dreizeilig, und die Folie wird kleiner (bei 1024×620 443×249 statt 510×287, mit offenem Panel 270×152 statt 336×189); die Tasten unter der Folie bleiben, wo sie sind.
- **Presenter, Referent, Bildschirmwahl mit zweitem Klick:** Die Bildschirmwahl in der Leiste merkt nur den Bildschirm; das Publikum zieht erst mit „Auf diesen Bildschirm“ um (B11). Der Knopf ist gesperrt mit Grund, solange die Wahl dem gemessenen Bildschirm entspricht. Den Grund zeigt der Tooltip auch am gesperrten Knopf: Die Leistenknöpfe (und NDI) tragen ihren Tooltip seit der Gesamtprüfung am Rahmen um den Knopf, wie in Connect, weil Chromium gesperrten Knöpfen keine Mausereignisse gibt.
- **Presenter, JM Timer in Editor und Referent:** Der Abschnitt Gegenstellen steht in beiden Fenstern. Seit der Gesamtprüfung folgt jedes Fenster einer Änderung im anderen: Es liest die Timer-Einstellung beim Öffnen des Panels, beim Wechsel in das Fenster und bei jeder Änderung der Verbindung neu, und „Aktiv“ und „Setzen“ übernehmen Host und Port des angewandten Stands, nie eine alte Kopie. Bisher zeigte das andere Fenster weiter „aus“, und sein nächster Schalterdruck schrieb den alten Host und Port zurück.
- **Presenter, vor der ersten Antwort:** „Ausgabe auf Bildschirm“ im Editor zeigt „unbekannt“, bis der Präsentationszustand gemeldet ist (bisher kurz „aus“); der Gast-Klicker heißt dann nur „Gast-Klicker“ mit „unbekannt“ darunter (bisher „Gast-Klicker aus“). Beides dauert nur Millisekunden.
- **Presenter, Referent, Tasten in Feldern:** Aus einem Textfeld (Feld „Gehe zu“, Felder des Panels) wirken keine Kürzel mehr: Punkt, Komma, B, W, Leertaste, Pfeile, Pos1, Ende und Esc tun dort nichts, die Rücktaste löscht im Feld, statt zurückzublättern, und Enter in „Gehe zu“ springt zur Folie, statt weiterzublättern (B10). Nach „Gehe zu“ verlässt der Fokus das Feld, auch bei ungültiger Eingabe, damit Klicker und Tasten sofort wieder wirken; wer eine zweite Nummer eingeben will, klickt wieder hinein. Auswahl und Knöpfe sind keine Textfelder: Der Klicker blättert weiter, auch wenn die Bildschirmwahl den Fokus hat. Das gilt seit der Gesamtprüfung auch im Panel des Referenten: Auf der Auswahl „Netzwerkkarte“ und im schreibgeschützten Gast-Link wirken alle Kürzel wie auf der Bildschirmwahl (Bild↓, Bild↑, Pfeile, Schwarz, Weiß; die Pfeile wählen dort also keine andere Netzwerkkarte, gewählt wird mit der Maus), nur Escape schließt weiter das Panel; in den Textfeldern des Panels (Timer-Host, Port) wirken keine Kürzel. Bisher blieb der Klicker tot, solange der Fokus nach einer Mauswahl im Panel lag. Strg+W in einem Feld schaltet nicht mehr Weiß und schließt das Fenster nicht (unter Windows gemessen; Cmd+W am Mac prüft die Abnahme); außerhalb von Feldern schaltet Strg+W wie bisher Weiß.
- **Presenter, Referent, Weiter mit Schleife:** Mit Schleife ist „Weiter“ auf der letzten Folie bedienbar und springt zur ersten (B13); ohne Schleife gesperrt mit „Letzte Folie“. Bisher war die Taste dort trotz Schleife gesperrt.
- **Presenter, Referent, Darstellung:** Der Referent bleibt dunkel, auch wenn der Editor hell ist. Die Übersicht liegt nur noch im Inhalt, deckt Kopf und Leiste nicht mehr ab, und „Übersicht“ schließt sie wieder. Die Nachricht der Timer-Leiste ist rot im Farbton der Suite. Bei 1024×620 ist die Folie kleiner (510×287 statt etwa 609×343, wegen Leiste, Statusleiste und der 90-px-Tasten); bei 1500×920 bleibt sie gleich. Die Statusleiste kürzt bei 1024 Breite „Handy-Fernsteuerung: aus“ (voller Text im Tooltip). In der Statusleiste zeigt „Präsentation“ bei Schwarz und Weiß eine Warnung.
- **Presenter, Handy-Fernsteuerung:** Netzwerkkarte und Port gelten erst mit „Setzen“ (eigener Knopf, ein Klick mehr; Wahl ≠ Bewegung): Bisher band jede Wahl, auch per Pfeiltaste, den Handy-Server neu, und ein verbundenes Handy fiel. Server- und PIN-Schalter wirken weiter sofort. Ein nicht gesetzter Entwurf verfällt beim Schließen des Panels. Ein leeres Port-Feld zeigt nichts statt „0“. Während die Gast-Klick-Pille der Leiste arbeitet, sind auch die Gast-Klicker-Knöpfe im Panel gesperrt.
- **Studio-Control, Rahmen und Anmeldung:** Die Anmeldung steht im Rahmen (Kopf mit Hell/Dunkel, leere Statusleiste, kein ⚙). Statusleiste, ⚙ und ON AIR erscheinen erst nach der Anmeldung; wer die App mitten in einer Sendung neu startet, sieht ON AIR erst nach dem Anmelden. Reiter Video, Audio, Licht und Setup als Tabs in der Werkzeugleiste, rechts Name · Rolle und „Abmelden“ (gleiche Stelle in allen gemessenen Zuständen); die Unterreiter im Setup sehen ebenso aus. Hell/Dunkel wird jetzt gemerkt. Das Panel „Fernsteuerung“ gibt es nur im App-Fenster, nach dem Abmelden ist es zu.
- **Studio-Control, Haupttasten und Tastenplätze:** Haupttasten neutral mit grüner Kante, LIVE nur bei gemessener Sendung, gesperrt mit sichtbarem Grund in der Taste (dann höher); 48 statt 45 px hoch, „Fade Black“ 120 statt 144 px breit; TriCaster REC und STREAM stehen fest, nie LIVE, mit dem Hinweis darunter. Der Inhalt beginnt rund 18 px tiefer als bisher (Kopf und Werkzeugleiste statt des alten Kopfs) und sitzt nur etwa 6 px unter der Werkzeugleiste; so liegt gemessen keine folgenreiche Taste auf dem alten Platz einer anderen im selben Zustand (alle 70 Zustände je Größe nachgestellt, 140 zusammen, auch kein PTZ-Preset). Mit offenem Panel kann eine Hauptreihe umbrechen, mit geschlossenem nie. Der aktive Preview-Bus hat im Hellen dunkle Schrift auf Gelb.
- **Studio-Control, Licht und PTZ:** Den Blackout sieht jetzt auch der Betrachter, gesperrt mit Grund (bisher ausgeblendet); ohne Node fehlt er wie bisher, vor der ersten Antwort und ohne Server ist er gesperrt mit „Zustand unbekannt“. PTZ-Richtung, Zoom und Fokus halten auch per Leertaste oder Enter auf dem fokussierten Knopf; gesperrt steht der Grund im Tooltip.
- **Studio-Control, ohne verbundenen Server:** Alle Gerätezustände sind „unbekannt“, kein ON AIR, alle Tasten der Gerätepanels sind gesperrt (auch Busse, Szenen, Makros, Presets, Fader, Mute und Leuchten-Regler); die gemeldete Program/Preview-Auswahl, die OBS-Szenen, Fehlerbänder und die Power-Anzeige sind ausgeblendet, die Leuchten nicht gedimmt. Bei einem kurzen Server-Abriss sieht der Bediener also keine letzte Auswahl.
- **Studio-Control, Pillen und Rollen:** Die Pillen zeigen bei einer Trennung den Fehlertext des Geräts in der Pille statt nur als Tooltip; er kann lang und englisch sein. Im Setup › Benutzer ändert die Rollen-Auswahl nichts mehr beim Wählen, auch nicht per Pfeiltaste; erst „Setzen“ in derselben Zeile ändert die Rolle (ein Klick mehr; jede Zeile ist dadurch zweizeilig). Ein Entwurf verfällt beim Verlassen des Reiters. Während die Änderung läuft, ist „Setzen“ nicht gesperrt; ein zweiter Klick schickt dieselbe Änderung noch einmal, mit gleichem Ergebnis. Fehlerbänder, Anmelde- und Benutzerfehler und „Letzte Aktionen“ lassen sich markieren.
- **Connect, Rahmen:** Kopf mit ON AIR (nur bei Raumverbindung und Gast auf Sendung), Hell/Dunkel (gemerkt) und ⚙; Statusleiste unten; der Inhalt ist ein eigener Scrollbereich, links mit festem Rand statt zentriert; Schrift Manrope; Kopf 44 statt 48 px hoch. Fenstertext ist nur noch in Feldern und markierten Bereichen auswählbar (Fehlerfeld, Hinweise zum Raum, Zugangszeile, Einladungslink, Zoom-Statuszeile und Meldungen, Messwerte, Hinweise, seit der Gesamtprüfung auch die Grundzeile eines Ausfalls an Programm-Abzeichen und Gastzeile); bisher jeder Text. Strg+R schließt jetzt auch das Panel und verwirft seine Entwürfe.
- **Connect, Raum und Talkback:** Eine Raum-Taste für Öffnen und Schließen, gesperrt mit sichtbarem Grund. Nach einem Raumabbruch zeigt sie „Raum öffnen“, und „Raum schließen“ steht als normaler Knopf unter den Haupttasten. Ein Doppelklick auf die Raum-Taste kann einen eben geöffneten Raum wieder schließen; hingenommen (Owner 24.11. 16:09, Z1 A). „Talkback alle“ steht immer da (gesperrt „Raum nicht verbunden“), halb breit rechts neben der Raum-Taste statt voller Breite über der Gästeliste; Halten auch per Leertaste oder Enter, Abbruch beim Fensterwechsel; 🎙 je Gast ebenso. Blockfolge: Fehlerfeld und Hinweise zum Raum und die Show-Karte stehen über den Haupttasten, Einladungen über der Gästeliste.
- **Connect, Tastenplätze (Owner 24.11. 16:09, „mit deiner Empfehlung“):** F1 A, hingenommen: „Talkback alle“ liegt in einigen Lagen dort, wo früher mit offener Show der breite Knopf „Raum „‹Show›“ öffnen“ stand (bedienbar bei 1280×860 in 2 Lagen, bei 980×640 in 11; ein Fehldruck spricht nur, solange gehalten wird). F2 B bei 1280×860: In der breiten Gästeliste stehen 🎙 und 📊 vor dem Namen statt hinter den Abzeichen, die Gast-Aktionen auf eigener Zeile ab dem Zeilenanfang; dort liegt keine Taste der Gästeliste mehr auf einem alten Platz derselben Lage (gemessen); die Tab-Reihenfolge bleibt. F2 A bei 980×640 und für die Kacheln, hingenommen: Bei 980×640 bleiben 21 gefährliche Treffer (etwa „Entfernen“ auf dem alten „Standby“ desselben Gasts); bei 1280×860 bleiben nur Treffer der Kachel-Taste Start/Stopp (10, bedienbar), keiner auf einem alten „Entfernen“ oder „Auf Sendung“. Erst nach Deinem Entscheid gemessen (Nachmessung zu F2 B mit offenen Einstellungen laufender Kacheln) und nach Ruling ebenfalls unter F2 A gezählt: „Setzen“ einer laufenden Kachel mit 4 Treffern (davon 2 bedienbar, nur mit offenem Entwurf); Start/Stopp trifft in diesen Lagen 10-mal, davon 8-mal an denselben Stellen wie ohne offene Einstellungen (Kachel 1 auf dem alten „Freigeben“ bzw. „Raum schließen“, schon oben gezählt) und 2-mal neu (Kachel 3 auf dem alten „Talkback alle“, nur wenn die Einstellungen aller Kacheln offen sind); auch diese liegen auf keinem alten „Entfernen“ oder „Auf Sendung“. Soll „Setzen“ oder Start/Stopp deshalb anders liegen, notiere es bitte bei der Freigabe. F3 A, hingenommen: Die erste Gastzeile ist bei 1280×860 in 20 von 114 Lagen mit zwei oder drei offenen Einladungen erst nach Scrollen zu sehen (bisher 22).
- **Connect, Zoom:** Zoom steht rechts neben dem Cloud-Raum (zwei Spalten ab mittlerer Breite), unter macOS eine Spalte; Kacheln bei 980×640 einspaltig (abgeleitet). Die Zoom-Tasten stehen rechtsbündig: „Erneut beitreten“, „Beitreten“ und „Meeting verlassen“ ganz rechts, „Schließen“, „Vergessen“ und „Abbrechen“ links daneben, also seitenverkehrt zu bisher; die Tab-Reihenfolge bleibt. Die Zoom-Einrichtung steht im Panel; bei einem Mangel öffnet der Statuseintrag „Zoom-Einrichtung“ das Panel dort, statt die Einrichtung im Arbeitsbereich aufzuklappen; das Ergebnis von „Einrichtung prüfen“ steht als Meldung in der Zoom-Spalte. Die Zoom-Vorgaben stehen offen im Panel; „nur für diese Sitzung gemerkt“ zeigt weiter der Kopf der Slots in der Zoom-Spalte. An einer laufenden Kachel (startet, zeigt, gehalten, Ersatzbild) gelten Auflösung, Ersatzbild und Bildformat erst mit „Setzen“ rechts in der Reihe, ein Klick mehr; an einer gestoppten wie bisher sofort. Seit der Gesamtprüfung auch die Person einer laufenden Teilnehmer-Kachel: Enter im Feld übernimmt nur die Person, „Setzen“ alles zusammen, Wegklicken oder Alt+Tab übernimmt nichts mehr (bisher ging ein halb getippter Name beim Verlassen des Felds auf Sendung); an einer gestoppten Kachel übernehmen Enter und Verlassen wie bisher. Sprecher-Signal und Haltezeit in den Zoom-Vorgaben ebenso mit „Setzen“ (ein Knopf für beide); die Haltezeit auch mit Enter, nicht mehr beim Verlassen des Felds; eine Haltezeit, die keine Zahl ist, sperrt „Setzen“ mit „Haltezeit: erlaubt sind 0 bis 5 Sekunden.“. Nicht gesetzte Entwürfe von Signal und Haltezeit gehen beim Schließen des Panels verloren. Die Schalter Ton, Computerton, ohne Kamera und Vorschau, die Vorgaben und „Person im NDI-Namen“ wirken weiter sofort.
- **Connect, Cloud-Zugang und Statusleiste:** Im Panel schließt „Speichern“ nichts mehr; eine nicht gespeicherte Adresse geht beim Schließen des Panels verloren (bisher blieb sie im Feld). Der Eintrag „Programm“ zeigt den Text des Abzeichens, „Programm“ steht dort also doppelt.
- **Prompter:** GO trägt „Leertaste“ jetzt auch im Lauf, Anfang „Pos1“, je in eigener Zeile; damit ist W63 zurückgenommen. Alle sechs Tasten sind in Ruhe und im Lauf gleich hoch (90 px), keine liegt auf dem alten Platz einer anderen (gemessen). Preis: In der Mindestgröße 940×620 läuft die rechte Spalte 53 px über (bisher 2 px); Vorschau, Tasten und Tempo-Regler bleiben ohne Scrollen sichtbar, nur der Satz unter dem Tempo braucht Scrollen, und er ist der einzige Ort, der die Pfeiltasten nennt. Abnahmepunkt: GO im Lauf mit „Leertaste“ und der Satz in der Mindestgröße.
- **Prompter, Stage Display, Player:** Pille und „Steht auf“ unter „Ausgabe auf Bildschirm“ folgen der Messung, nie der Wahl; die Bildschirmliste wird auch bei jedem Anstecken, Abziehen oder Ändern eines Bildschirms neu gelesen, ohne das Panel neu zu öffnen. „Bildschirm fehlt“ bleibt nach dem Wiederanstecken stehen, bis das Fenster neu geöffnet oder verschoben wird (Abnahmepunkt).
- **Player:** Nach Alt+F4 und Wiederöffnen über den Schalter „Ausgabe“ zählt ein Video für ON AIR und „‹n› laufend“ erst wieder, wenn das neue Fenster es wirklich abspielt; bis dahin bleibt ON AIR aus (Abnahmepunkt). Die Show-Auswahl der Cue-Show hält nur einen Entwurf; „Setzen“ erscheint erst dann vorn in der rechten Gruppe des Kopfs, ein Klick mehr beim Showwechsel; ohne Entwurf steht jede Taste wie bisher (gemessen). Solange ein Entwurf offen ist, sind „Umbenennen“ und „Löschen“ gesperrt; wählt Companion, der Show-Start oder „+ Neu“ eine andere Show, fällt der Entwurf weg. Während ein Entwurf offen ist, kann der Kopf bei 1040×660 weiter umbrechen (mit offenem Panel, bei geschlossenem mit sehr langen Show-Namen, gemessen mit 60 Zeichen): „▦ Ausgabe“, „+ Cue“ und die Cue-Liste rücken dann 41 px tiefer; die Zeilen einer gefüllten Cue-Liste sind dabei ungemessen. Die Soundboard-Auswahl legt wie bisher sofort fest, welchen Sound Companion mit `PLAYER PAD n` spielt, auch per Pfeiltaste auf der fokussierten Auswahl; das bleibt so nach Deinem Entscheid vom 24.11. 22:17 (Option A: die gezeigte Bank ist die Bank, die Companion spielt; mit einem „Setzen“ wie bei der Show-Wahl könnten Bildschirm und Fern-Pads auseinanderlaufen).

## Offene Fragen

1. **Kürzelzeile bei „Schwarz · an“ (Presenter-Referent, 1024 Breite).** Gemessen (Task 11): „Schwarz · an“ bricht in der 107 px breiten Taste um; die Tasten der Reihe sind dann 92 statt 90 px hoch, die Reihe wächst während der Pause um 2 px, und die Folie wird 2 px niedriger; bei 1500 nicht. Die 90 px sind ein gemeinsames Maß, das Prompter (GO, Anfang) und Presenter (Reihe unter der Folie) nutzen. ☐ A · hinnehmen (2 px Sprung nur während der Pause; Empfehlung, weil B ein gemeinsames Maß auch im Prompter verschiebt und dort ungemessen ist) ☐ B · das Maß auf 92 px anheben (alle Tasten mit Kürzelzeile 2 px höher, auch im Prompter; dort wächst der Überlauf in der Mindestgröße entsprechend, abgeleitet, nicht gemessen)
2. **Studio-Control: englische Reste und ein ungenauer Text.** Nach der Regel „vorhandene Texte werden nicht umformuliert“ bleiben: „Scanning“ (Discovery), „Save“ (Inventar), die Rollen in der Rollen-Auswahl im Setup („admin“, „operator“, „viewer“), die Makro-Namen, die DDR-Tooltips „Play“, „Pause“, „Stop“, „login failed“ (Rückfall der Anmeldung, kaum erreichbar) und rohe Fehlertexte der Geräte in den Pillen (etwa „connect ETIMEDOUT 192.0.2.11:4455“, jetzt sichtbar statt nur als Tooltip). Der Audio-Leertext „Noch kein Pult verbunden. …“ steht, solange kein Pult eingerichtet ist, und meint „eingerichtet“. Was soll gelten? ☐ so lassen ☐ in einem eigenen Text-Nachtrag übersetzen bzw. umformulieren (bitte Wortlaute nennen) ☐ mit ins Altfehler-Thema (Frage 3; Empfehlung, weil die Welle vorhandene Texte nicht umformuliert und ein Text-Nachtrag dasselbe Thema wäre)
3. **Altfehler aus den Funktionslisten von Presenter, Studio-Control und Connect.** Fehler, die schon vor der Welle 2b bestanden und die der Umbau absichtlich nicht ändert (Bedienlogik bleibt). Für die 2a-Werkzeuge hast Du am 23.11. 12:25 entschieden: eigenes Thema. Sollen diese dazu? ☐ ja, alle (Empfehlung, wie Dein Entscheid für 2a) ☐ ja, nur diese (bitte Werkzeug und Befund nennen) ☐ nein. Die wichtigsten:
   - Presenter: Die Handy-Seite verbindet mit „live“ und hebt dabei ein Schwarz- oder Weißbild auf (Befund 15, abgeleitet); nach „Port … ist belegt“ startet ein neuer Port mit „Setzen“ den Handy-Server nicht, dafür braucht es den Server-Schalter (16); die Gast-Klick-Pille sagt bei „verbindet“ und „abgelehnt“ „Gast-Klick getrennt“ (17; die Statusleiste unterscheidet jetzt); „Öffnen“, „✕“ und „Entfernen“ fragen nicht zurück, Schließen des Editors mit ungespeichertem Projekt auch nicht (21); der Mauszeiger bleibt im Publikumsfenster sichtbar (25, abgeleitet); die Laufzeit-Uhr beginnt beim Öffnen des Referenten und fällt bei Strg+R zurück (26); „Konvertiere mit LibreOffice…“ steht schon, während der Dateidialog offen ist (27); Einblendungen haben keine Taste zum Verschieben oder Löschen (28).
   - Studio-Control: **Sicherheitsrelevant, gemessen (Task 14):** Der Server von Studio-Control lauscht auf Port 7778 auf allen Netzwerkschnittstellen, nicht nur am eigenen Rechner (laut Code, solange die App läuft); in den Messungen mit frischem Wegwerf-Profil war er so bei jedem von 5 Starts bis etwa 110 s lang erreichbar, mit dem Konto Admin/Admin. Dieses Konto legte der Entwickler-Schalter der Messung an (`JM_STUDIO_DEV_ADMIN=1`); ohne ihn legt die App beim ersten Start ein Zufallspasswort in einer Datei im Benutzerordner ab (laut Code, nicht gemessen). Aus dem App-Fenster läuft jeder Befehl am Server als Admin, die Rollen wirken dort nur über die Sperren im Fenster (Befund 4, gemessen); ein ATEM ohne Gegenstelle bleibt bei „verbindet …“ und meldet nie „getrennt“ (5, gemessen 82 s lang); bei 1024×640 liegen „Save“, „Hinzufügen“ und „Abbr.“ im Inventar rechts außerhalb des Fensters (6, gemessen); Befehle und Formulare melden Fehler nicht im Fenster (8); toter Code und Hinweise für Betrachter „im Setup“ (10); das Gateway liest „control.json“ nicht und lauscht auf allen Netzwerkschnittstellen, TriCaster REC und STREAM senden nur die Start-Kürzel (11); die Tray-Beschriftung „Fenster anzeigen“ ändert sich nie, und die LAN-Adressen im Tray zeigen im Entwicklungsbetrieb den falschen Port (12); die Leertexte der Konfiguration („Noch kein … konfiguriert“) stehen schon vor der ersten Server-Meldung.
   - Connect: Fehler aus „Raum öffnen“, Einladen und „Raum schließen“ tragen im Fehlerfeld Electrons englischen Vorsatz „Error invoking remote method …“ (abgeleitet, nicht gemessen; Liste Nr. 108); 📊, die Gast-Aktionen, „Link erzeugen“ und „Sprecher einladen“ sind ohne Raumverbindung gesperrt ohne sichtbaren Grund (Befund 10); Connect sucht beim Start selbst nach JM Presenter und meldet sich beim Launcher (9); die Companion-Variable für die Verbindung zum Medienserver meldet niemand, Ablehnen und Stumm haben kein Fernsteuer-Verb, das Tray-„Raum schließen“ geht nur mit einer NDI-Gastquelle (13); einige Zustände des Zoom-Kerns stehen nur im Log (14).

Ohne Frage: P1 und P2 hast Du am 24.11. 22:18 entschieden (P1 A, P2 B; siehe „Geänderte Bedienung“, Presenter). Task 4 Step 5 hat seine harten Bedingungen erfüllt, W63 ist zurückgenommen (GO trägt „Leertaste“ auch im Lauf); der Preis steht unter „Geänderte Bedienung“ beim Prompter. Die Connect-Fragen F1 bis F3 und Z1 hast Du am 24.11. 16:09 entschieden (siehe „Geänderte Bedienung“). An die Schlussprüfung, keine Owner-Frage: In der Statusleiste liefen bei vielen Einträgen Beschriftungen ineinander (Connect), und die Fehlerzeile eines Felds war nicht markierbar (beides gemeinsame Bausteine); beides ist in der Gesamtprüfung behoben (siehe „Geänderte Bedienung“, gemeinsame Bausteine).

## Handbuch

Die sechs Handbücher im Kochbuch (Presenter, Studio-Control, Connect, Prompter, Stage Display, Player) nennen jetzt die neuen Orte: Panel ⚙ mit Abschnitt, Statusleiste, Werkzeugleiste des Editors, Kopf und Leiste des Referenten, die Spalten Cloud-Raum und Zoom in Connect und die Reiter in der Werkzeugleiste von Studio-Control. Die alten Orte (⚙-Menü des Editors, Fenster „Fernsteuerung übers Netzwerk“, Zoom-Karte mit „Einrichtung“, „Vorgaben …“ und „Sprecher-Einstellungen …“, Karte „Cloud-Zugang“) kommen nicht mehr vor. Wo sich die Bedienung ändert („Setzen“, Halten per Leertaste, eine Bildschirmwahl, die nur merkt), steht es dabei; Prompter, Stage Display und Player bekommen nur den gemessenen Bildschirm in der Pannenhilfe und der Player die Show-Wahl mit „Setzen“. Alles andere im Handbuch bleibt, wie es war. Je Stelle steht ein Satz in Klartext, dann der alte Text (`-`, in Code-Schrift) und der neue Text (`+`); bei langen Absätzen nur der geänderte Satz oder Satzteil. Die zwei Stellen im Presenter, die an den Owner-Fragen P1 und P2 hingen, sind nach Deinem Entscheid vom 24.11. 22:18 nachgezogen: Die Haupttaste bleibt in der Werkzeugleiste (P1 A), „■ Beenden“ steht bei schmalem Fenster in der Leiste des Referenten (P2 B). Bitte sag mir, wenn eine Stelle anders klingen soll.

### Presenter

Importiert wird über die Werkzeugleiste des Editors oder per Ziehen ins Fenster; die PPTX-Option steht im Panel unter „Import“.

- `Dokument importieren: PDF/Bilder direkt, Office-Dateien werden per LibreOffice zu PDF gewandelt. Bei Bedarf als **.jmpres**-Projekt speichern (behält Overlays/Reihenfolge).`
+ Dokument importieren: mit „+ PDF / Bilder“ bzw. „+ Office“ in der Werkzeugleiste des Editors oder per Ziehen ins Fenster. PDF/Bilder direkt, Office-Dateien werden per LibreOffice zu PDF gewandelt (PPTX-Aufbau-Animationen als Einzelschritte schaltet das Panel ⚙ › Import). Bei Bedarf mit „Speichern“ als **.jmpres**-Projekt speichern (behält Overlays/Reihenfolge).

Den Bildschirm des Publikums wählst Du vor dem Start im Panel, gestartet wird mit der Haupttaste der Werkzeugleiste; während der Präsentation zieht erst „Auf diesen Bildschirm“ in der Leiste des Referenten das Publikum um.

- `**Publikumsansicht** auf den Beamer/zweiten Monitor legen (Vollbild); die **Referentenansicht** bleibt beim Operator (aktuelle + nächste Folie, Notizen).`
+ **Publikumsansicht** auf den Beamer/zweiten Monitor legen (Vollbild): im Editor den Bildschirm im Panel ⚙ › Ausgabe auf Bildschirm wählen, dann mit der Haupttaste „Präsentieren“ rechts in der Werkzeugleiste starten. Während der Präsentation den Bildschirm in der Leiste des Referenten wählen und mit „Auf diesen Bildschirm“ umziehen; die Wahl allein verschiebt nichts. Die **Referentenansicht** bleibt beim Operator (aktuelle + nächste Folie, Notizen) und bleibt dunkel, auch wenn der Editor hell ist.

Die Handy-Fernsteuerung steht jetzt im Panel, in Editor und Referent; Netzwerkkarte und Port gelten erst mit „Setzen“.

- `Handy-Clicker aktivieren: Port/Interface wählen, **PIN** setzen, QR/URL ans Handy geben.`
+ Handy-Clicker im Panel ⚙ › Handy-Fernsteuerung aktivieren (in Editor und Referent, auch vor der Präsentation): Netzwerkkarte und Port wählen und mit „Setzen“ übernehmen, „PIN-Schutz (empfohlen im offenen WLAN)“ anlassen, den Server einschalten („Server aktiv“), QR/URL und **PIN** aus dem Abschnitt ans Handy geben.

Fernsteuerung und JM Timer zeigen Statusleiste und Panel; Host und Port des Timers gelten erst mit „Setzen“.

- `Fernsteuerung: Companion/Rundown auf Port 8728; JM Timer für den Countdown verbinden (7777).`
+ Fernsteuerung: Companion/Rundown auf Port 8728 (Statusleiste „Fernsteuerung“, Panel ⚙ › Fernsteuerung); JM Timer für den Countdown im Panel ⚙ › Gegenstellen verbinden: in der Zeile „JM Timer“ „Aktiv“ einschalten, Host und Port (7777) eintragen und mit „Setzen“ übernehmen (Statusleiste „JM Timer“).

Der Gast-Klicker hat einen eigenen Abschnitt im Panel, nicht mehr im Fenster „Fernsteuerung“.

- `im Fenster **Fernsteuerung** den Abschnitt „Gast-Klicker“ einschalten,`
+ im Panel ⚙ › Gast-Klicker (in Editor und Referent, auch vor der Präsentation) den Schalter einschalten („Gast-Klicker an“),

Blättern geht über die Haupttasten unter der Folie; mit Schleife springt „Weiter“ von der letzten auf die erste Folie, und aus Textfeldern wirken keine Kürzel; auf einer Auswahl, auch im Panel, und im Gast-Link blättert der Klicker weiter (Gesamtprüfung I2).

- `` Navigieren mit `NEXT`/`PREV` (lokal, Handy oder Companion). `GOTO` springt gezielt. ``
+ Navigieren mit `NEXT`/`PREV` (lokal mit den Haupttasten „Zurück“ und „Weiter“ unter der Folie im Referenten, dem Klicker oder den Pfeiltasten, per Handy oder Companion). Mit Schleife springt „Weiter“ auf der letzten Folie zur ersten. `GOTO` springt gezielt (lokal die Nummer ins Feld „Folie“ zwischen „Zurück“ und „Weiter“ tippen, dann Enter oder „Gehe zu“). Steht der Cursor in einem Textfeld, wirken die Tastenkürzel nicht; auf einer Auswahl (auch im Panel) und im Gast-Link blättert der Klicker weiter.

Schwarz und Weiß sind Haupttasten links und rechts unter der Folie.

- `` `BLACK`/`WHITE` für Pausen/Umbau, `LIVE` holt die Folie zurück. ``
+ `BLACK`/`WHITE` für Pausen/Umbau, `LIVE` holt die Folie zurück (lokal die Haupttasten „Schwarz“ links und „Weiß“ rechts unter der Folie oder B und W; ein zweiter Druck holt die Folie zurück, solange steht an der Taste „Schwarz · an“ bzw. „Weiß · an“).

Der Countdown steht in der Timer-Leiste; ON AIR leuchtet nur, solange das Publikum die Folie sieht.

- `Referentenansicht im Blick behalten: Notizen + nächste Folie + Countdown; das Publikum sieht nur die saubere Folie.`
+ Referentenansicht im Blick behalten: Notizen + nächste Folie + Countdown (Timer-Leiste über „Nächste Folie“); das Publikum sieht nur die saubere Folie. ON AIR im Kopf leuchtet nur, solange das Publikum die Folie sieht, nicht bei Schwarz oder Weiß.

Die Gast-Klick-Anzeige steht in der Leiste unter dem Kopf.

- `Die Anzeige **„Gast-Klick ●“** in der Referentenansicht pausiert`
+ Die Anzeige **„Gast-Klick ●“** in der Leiste der Referentenansicht pausiert

Beendet wird mit „■ Beenden“ im Referenten, ganz rechts im Kopf oder bei schmalem Fenster als letzte Taste der Leiste, oder mit „Beenden“ in der Werkzeugleiste des Editors.

- `` `STOP` beendet die Präsentation; Projekt (.jmpres) sichern, falls Overlays/Anpassungen erhalten bleiben sollen. ``
+ `STOP` beendet die Präsentation (lokal „■ Beenden“ ganz rechts im Kopf des Referenten, bei schmalem Fenster als letzte Taste rechts in der Leiste, oder Esc außerhalb des Panels, im Editor „Beenden“ in der Werkzeugleiste); Projekt (.jmpres) mit „Speichern“ sichern, falls Overlays/Anpassungen erhalten bleiben sollen.

„Neuer Link“ steht im Panel unter „Gast-Klicker“.

- `im Fenster Fernsteuerung **„Neuer Link“**`
+ im Panel ⚙ › Gast-Klicker **„Neuer Link“**

Ein belegter Port zeigt sich im Panel und in der Statusleiste; nach dem Fehler braucht es den Server-Schalter (Altfehler, Offene Frage 3). In der Spalte „Risiko“ derselben Zeile ist nur das Schlusszeichen von „Port belegt“ berichtigt.

- `Anderen Remote-Port wählen (Standard 7330)`
+ Den Fehler zeigen das Panel ⚙ › Handy-Fernsteuerung und die Statusleiste „Handy-Fernsteuerung“. Dort einen anderen Port eintragen (Standard 7330), mit „Setzen“ übernehmen und den Server wieder einschalten („Server aktiv“); „Setzen“ allein startet ihn nach dem Fehler nicht

Wo das Publikum wirklich steht, sagt die Statusleiste; umgezogen wird über die Leiste des Referenten.

- `Publikumsfenster geöffnet + richtiger Monitor? Vollbild aktiv?`
+ Statusleiste „Publikum“ ansehen: Sie nennt den Bildschirm, auf dem das Publikumsfenster wirklich steht. Falscher Monitor: in der Leiste des Referenten den richtigen wählen und „Auf diesen Bildschirm“ drücken. Vollbild aktiv („Publikum Vollbild“ in der Leiste)?

Den Timer prüfst Du über die Statusleiste und das Panel.

- `JM Timer läuft und ist auf 7777 erreichbar, Timer-Sync aktiv?`
+ JM Timer läuft und ist auf 7777 erreichbar? Statusleiste „JM Timer“ ansehen; im Panel ⚙ › Gegenstellen „Aktiv“ an, Host und Port mit „Setzen“ übernommen?

Den Gast-Klicker prüfst Du im Panel und in der Statusleiste.

- `Gast-Klicker eingeschaltet? Internet am Präsentationsrechner prüfen;`
+ Gast-Klicker im Panel ⚙ › Gast-Klicker eingeschaltet (Statusleiste „Gast-Klicker“)? Internet am Präsentationsrechner prüfen;

Den aktuellen Link kopierst Du im Panel.

- `im Fenster Fernsteuerung den aktuellen Link kopieren`
+ im Panel ⚙ › Gast-Klicker den aktuellen Link kopieren

Bei „Companion steuert nicht“ liest Du zuerst die Statusleiste.

- `` Port 8728 offen? `jm-presenter-ctl` (ctl=1) im mDNS? ``
+ Statusleiste „Fernsteuerung“ ansehen (bereit, Port belegt, Fehler); Port 8728 offen? `jm-presenter-ctl` (ctl=1) im mDNS?

### Studio-Control

Geräte legst Du in den Panels der Reiter an; die Reiter stehen jetzt in der Werkzeugleiste, und die Statusleiste zeigt je Gerätetyp einen Eintrag.

- `Geräte verbinden und je Typ eine Primär-Instanz festlegen (ATEM, OBS, TriCaster, PTZ, Audio, Licht)`
+ Geräte in den Panels der Reiter Video (TriCaster, ATEM, OBS, PTZ), Audio und Licht anlegen und verbinden und je Typ eine Primär-Instanz festlegen (die Reiter stehen in der Werkzeugleiste unter dem Kopf; Geräte im Netz sucht Setup › Discovery); die Statusleiste zeigt je eingerichtetem Gerätetyp einen Eintrag

Benutzer und Rollen stehen im Reiter Setup; eine Rolle gilt erst mit „Setzen“.

- `Nutzer und Rollen anlegen (wer darf was) — Web-UI auf Port 7778 mit Bearer-Auth`
+ Nutzer und Rollen anlegen (wer darf was): Reiter Setup › Benutzer (nur Admin), „+ Benutzer anlegen“; eine Rolle ändert sich erst mit „Setzen“ in derselben Zeile, die Auswahl allein ändert nichts — Web-UI auf Port 7778 mit Bearer-Auth

Das Gateway startet von selbst; seinen Stand zeigen Statusleiste und Panel im App-Fenster.

- `Optional: Companion-Gateway auf Port 8735 aktivieren (typ-präfixierte Verben)`
+ Optional: Companion mit dem Gateway auf Port 8735 verbinden (typ-präfixierte Verben); das Gateway startet von selbst, im App-Fenster zeigen die Statusleiste „Fernsteuerung“ und das Panel ⚙ › Fernsteuerung seinen Stand (im Browser gibt es kein ⚙)

Geschaltet wird in den Panels der Reiter; gesperrte Haupttasten nennen ihren Grund, PTZ hält auch per Taste.

- `Quellen/Szenen schalten (z. B. STUDIO atem_program 2, STUDIO obs_scene 3), PTZ steuern, Audio/Licht bedienen`
+ Quellen/Szenen schalten (z. B. STUDIO atem_program 2, STUDIO obs_scene 3), PTZ steuern, Audio/Licht bedienen (lokal in den Panels der Reiter Video, Audio und Licht; gesperrte Haupttasten wie Cut, Auto, FTB, REC und STREAM nennen ihren Grund; PTZ-Richtung, Zoom und Fokus halten auch per Leertaste oder Enter)

ON AIR im Kopf zeigt nur gemessene Aufnahme oder Sendung; die letzten Aktionen stehen im TriCaster-Panel.

- `Aufnahme per STUDIO obs_record on/off; alle Aktionen werden zentral auditiert`
+ Aufnahme per STUDIO obs_record on/off (lokal „Aufnahme“ im OBS-Panel; ON AIR im Kopf zeigt „REC“ bzw. „LIVE“ nur, solange ein verbundener ATEM oder OBS wirklich aufnimmt bzw. streamt); alle Aktionen werden zentral auditiert (die letzten stehen im TriCaster-Panel unter „/ Letzte Aktionen“, ab Bediener)

Bei „Gerät nicht erreichbar“ liest Du zuerst Statusleiste und Pille.

- `Netz/IP und Anmeldedaten prüfen; richtige Primär-Instanz konfiguriert?`
+ Eintrag des Gerätetyps in der Statusleiste und Pille im Panel ansehen (bei einer Trennung steht dort der Fehlertext des Geräts); Netz/IP und Anmeldedaten prüfen; richtige Primär-Instanz konfiguriert?

Ob der eigene Server verbunden ist, zeigt der Eintrag „Server“.

- `Port 7778 erreichbar? Bearer-Token korrekt?`
+ Statusleiste „Server“ ansehen (ohne verbundenen Server stehen alle Geräte auf „unbekannt“ und ihre Tasten sind gesperrt); Port 7778 erreichbar? Bearer-Token korrekt?

Das Gateway hat keinen Schalter in den Einstellungen; seinen Stand zeigen Statusleiste und Panel.

- `Port 8735 (jm-studio-control-ctl) erreichbar? Gateway in den Einstellungen aktiviert?`
+ Im App-Fenster Statusleiste „Fernsteuerung“ bzw. Panel ⚙ › Fernsteuerung ansehen (bereit, Port belegt, Fehler; das Gateway hat keinen eigenen Schalter); Port 8735 (jm-studio-control-ctl) erreichbar?

Eine gesperrte Taste sagt jetzt selbst, warum; die Rollen stehen im Reiter Setup.

- `Nutzerrolle/Rechte in der Web-UI kontrollieren`
+ Die gesperrte Taste nennt den Grund (z. B. „Rolle Betrachter darf nicht schalten“ oder „ATEM nicht verbunden“); Nutzerrolle/Rechte im Reiter Setup › Benutzer kontrollieren (Admin)

Die Checkliste nennt den Ort der Rollen und die Statusleiste.

- `Rollen gesetzt (Web-UI Port 7778)`
+ Rollen gesetzt (Setup › Benutzer, Web-UI Port 7778)

- `Companion-Gateway Port 8735 aktiv (optional)`
+ Companion-Gateway Port 8735 bereit (Statusleiste „Fernsteuerung“, optional)

### Connect

„Zoom-SDK laden“ steht im Panel unter „Zoom-Einrichtung“.

- `Zoom-SDK 7.1.5.43953: auf JM-Rechnern per Knopf „Zoom-SDK laden“ (läuft über die Anmeldung im Launcher),`
+ Zoom-SDK 7.1.5.43953: auf JM-Rechnern per Knopf „Zoom-SDK laden“ im Panel ⚙ › Zoom-Einrichtung (läuft über die Anmeldung im Launcher),

Eine Raum-Taste öffnet und schließt den Raum.

- `Raum öffnen (braucht die Anmeldung im Launcher), für jeden Gast einen Link erzeugen und verschicken.`
+ Raum mit der Haupttaste „Raum öffnen“ im Cloud-Raum (unter Windows die linke Spalte) öffnen (braucht die Anmeldung im Launcher; dieselbe Taste schließt ihn wieder), für jeden Gast mit „Link erzeugen“ einen Link erzeugen und verschicken.

„Talkback alle“ steht neben der Raum-Taste; Halten geht auch per Leertaste oder Enter.

- `Talkback (Regie ins Ohr) für alle oder per Halten-Taste für einen Gast;`
+ Talkback (Regie ins Ohr) für alle mit „Talkback alle“ rechts neben der Raum-Taste oder mit 🎙 an der Gastzeile für einen Gast, je so lange gehalten (mit der Maus oder per Leertaste bzw. Enter auf der Taste);

Das Programm-Abzeichen hat einen Eintrag in der Statusleiste.

- `Daneben der Link „ndi.video“.`
+ Daneben der Link „ndi.video“; denselben Text zeigt der Eintrag „Programm“ der Statusleiste.

Die Fußzeile steht unten im Inhalt unter beiden Spalten.

- `Fußzeile des Hauptfensters (Windows und macOS): der Markenhinweis,`
+ Fußzeile des Hauptfensters (Windows und macOS, unten im Inhalt unter beiden Spalten): der Markenhinweis,

Das Tray-Menü schließt den Raum wie die Raum-Taste.

- `„Raum schließen“ im Tray-Menü schließt den Raum wie der Knopf im Fenster.`
+ „Raum schließen“ im Tray-Menü schließt den Raum wie die Raum-Taste im Fenster.

Unter macOS fehlen die Zoom-Spalte und die Zoom-Abschnitte im Panel.

- `Unter macOS steht an der Stelle der Zoom-Karte „Zoom-Slots gibt es nur unter Windows: Die Zoom-Bridge läuft nur dort.“`
+ Unter macOS steht statt der Zoom-Spalte unter dem Cloud-Raum „Zoom-Slots gibt es nur unter Windows: Die Zoom-Bridge läuft nur dort.“

- `aber keine Zoom-Karte; es ist nicht signiert.`
+ aber keine Zoom-Spalte und im Panel keine Zoom-Abschnitte; es ist nicht signiert.

Die Namen zeigt die Zoom-Spalte, nicht mehr eine Karte.

- `Karte, Companion-Variable zoom_slot{n}_target und NDI-Namen zeigen die Namen weiter.`
+ Zoom-Spalte, Companion-Variable zoom_slot{n}_target und NDI-Namen zeigen die Namen weiter.

„Logordner öffnen“ steht in der Zoom-Spalte unter den Zoom-Quellen und an Meldungen.

- `an jeder Zeile eines NDI-Ausfalls und in der Zoom-Karte (nur Windows).`
+ an jeder Zeile eines NDI-Ausfalls und in der Zoom-Spalte (unter den Zoom-Quellen und an Meldungen mit „Details im Log“, nur Windows).

Die Zeile „Cloud-Zugang“ steht in Statusleiste und Panel, „Zoom-Anmeldung“ im Panel unter „Zoom-Einrichtung“.

- `Zwei Zeilen zeigen den Stand: „Cloud-Zugang“ („Cloud-Zugang über den Launcher`
+ Zwei Zeilen zeigen den Stand: „Cloud-Zugang“ in der Statusleiste und im Panel ⚙ › Cloud-Zugang („Cloud-Zugang über den Launcher

- `und in der Zoom-Karte „Zoom-Anmeldung“ („Zoom-Anmeldung über den Launcher`
+ und „Zoom-Anmeldung“ im Panel ⚙ › Zoom-Einrichtung („Zoom-Anmeldung über den Launcher

Alte Werte entfernst Du im Panel.

- `Auf der Karte steht „Alter Proxy-Key: hinterlegt, nur noch im Übergang.“. Alte Werte lassen sich nur noch entfernen, nicht mehr eintragen; mit „Entfernen“ räumt man sie weg.`
+ Im Panel ⚙ › Cloud-Zugang steht „Alter Proxy-Key: hinterlegt, nur noch im Übergang.“. Alte Werte lassen sich nur noch entfernen, nicht mehr eintragen; mit „Key entfernen“ (Panel ⚙ › Cloud-Zugang) bzw. „Entfernen“ (Panel ⚙ › Zoom-Einrichtung) räumt man sie weg.

- `Unter macOS gibt es keine Zoom-Karte; die Zoom-Schritte dieses Abschnitts entfallen dort.`
+ Unter macOS gibt es keine Zoom-Spalte und im Panel keine Zoom-Abschnitte; die Zoom-Schritte dieses Abschnitts entfallen dort.

Die Zoom-Einrichtung steht im Panel; bei einem Mangel führt die Statusleiste hin, statt dass die Einrichtung im Arbeitsbereich aufklappt.

- `Zoom-Karte, Knopf „Einrichtung“ aufklappen.`
+ Die Zoom-Einrichtung steht im Panel ⚙ › Zoom-Einrichtung; fehlt dort etwas, steht in der Statusleiste der Eintrag „Zoom-Einrichtung“ und öffnet das Panel an dieser Stelle.

- `Liegt noch einer auf diesem Rechner, zeigt die Zoom-Karte eine Zeile dazu und den Knopf „Entfernen“`
+ Liegt noch einer auf diesem Rechner, zeigt das Panel (⚙ › Zoom-Einrichtung bzw. ⚙ › Cloud-Zugang) eine Zeile dazu und den Knopf „Entfernen“ bzw. „Key entfernen“

„Einrichtung prüfen“ steht im Panel, sein Ergebnis als Meldung in der Zoom-Spalte.

- `„Einrichtung prüfen“ meldet sich ohne Meeting bei Zoom an, mit dem Zoom-Anmelde-Token vom Server.`
+ „Einrichtung prüfen“ im Panel ⚙ › Zoom-Einrichtung meldet sich ohne Meeting bei Zoom an, mit dem Zoom-Anmelde-Token vom Server; das Ergebnis steht als Meldung in der Zoom-Spalte.

An einem laufenden Slot gelten Person, Auflösung, Ersatzbild und Bildformat erst mit „Setzen“ (die Person auch mit Enter; Gesamtprüfung I4).

- `Jede Änderung wird sofort gespeichert und wirkt im Meeting sofort.`
+ Jede Änderung wird sofort gespeichert und wirkt im Meeting sofort; nur an einem laufenden Slot halten Person, Auflösung, Ersatzbild und Bildformat einen Entwurf, den erst „Setzen“ rechts in der Reihe übernimmt (die Person auch Enter im Feld).

Vorgaben und Sprecher-Einstellungen stehen offen im Panel unter „Zoom-Vorgaben“; Sprecher-Signal und Haltezeit gelten erst mit „Setzen“ (die Haltezeit auch mit Enter; Gesamtprüfung I4).

- `Im Kopf der Zoom-Slots: „Vorgaben …“ legt Auflösung und Ton für neue Slots fest, „Sprecher-Einstellungen …“ das Sprecher-Signal und die Haltezeit (0 bis 5 s; so lange muss jemand sprechen, bevor der Sprecher-Slot wechselt), der Schalter „Vorschau“ die Vorschau aller Kacheln.`
+ Im Panel ⚙ › Zoom-Vorgaben legen „Auflösung“ und „Ton“ die Vorgaben für neue Slots fest, darunter das Sprecher-Signal und die Haltezeit (0 bis 5 s; so lange muss jemand sprechen, bevor der Sprecher-Slot wechselt); beide gelten erst mit „Setzen“ unter den Optionsfeldern, die Haltezeit auch mit Enter im Feld. Ein nicht gesetztes Sprecher-Signal oder eine nicht gesetzte Haltezeit geht beim Schließen des Panels verloren. Im Kopf der Zoom-Slots schaltet „Vorschau“ die Vorschau aller Kacheln.

- `Schalter „Person im NDI-Namen“ im Kopf der Zoom-Slots (Vorgabe: aus):`
+ Schalter „Person im NDI-Namen“ im Panel ⚙ › Zoom-Vorgaben (Vorgabe: aus):

Am laufenden Slot wirkt der Ton sofort, Person und die drei Wahlen erst mit „Setzen“ (Gesamtprüfung I4).

- `Ebenso wirken Person, Auflösung, Ersatzbild und Ton sofort, ohne Neustart der Quelle.`
+ Ebenso wirkt der Ton sofort, ohne Neustart der Quelle. Person, Auflösung, Ersatzbild und Bildformat gelten am laufenden Slot erst mit „Setzen“ rechts in der Reihe (die Person auch mit Enter im Feld), ebenfalls ohne Neustart der Quelle; ein Durchblättern mit den Pfeiltasten oder ein Wegklicken aus dem Feld „Person“ schaltet das Bild nicht mehr um.

Was früher „die Karte“ hieß, ist jetzt die Zoom-Spalte.

- `mit Countdown in der Karte).`
+ mit Countdown in der Zoom-Spalte).

- `steht der Grund unter „Hinweise“ in der Karte.`
+ steht der Grund unter „Hinweise“ in der Zoom-Spalte.

„Raum schließen“ ist die Raum-Taste; nach einem Raumabbruch steht es als eigener Knopf unter den Haupttasten.

- `„Raum schließen“ (im Fenster; im Tray, solange Gast-Quellen eingetragen sind),`
+ „Raum schließen“ (die Raum-Taste im Fenster; im Tray, solange Gast-Quellen eingetragen sind),

- `dann „Raum öffnen“ wählen, nicht „Raum schließen“.`
+ dann „Raum öffnen“ wählen (die Raum-Taste zeigt es nach dem Abbruch; „Raum schließen“ steht dann als eigener Knopf darunter), nicht „Raum schließen“.

In der Pannenhilfe zeigen die Stellen auf das Panel und die Zoom-Spalte.

- `Unter „Sprecher-Einstellungen …“ ein anderes Signal versuchen.`
+ Im Panel ⚙ › Zoom-Vorgaben ein anderes Sprecher-Signal wählen und mit „Setzen“ übernehmen.

- `(unter dem Versatz oder in der Zoom-Karte)`
+ (unter dem Versatz, im Kopf der Zoom-Slots oder im Panel ⚙ › Zoom-Einrichtung)

- `Cloud-Zugang (Zeile „Cloud-Zugang“ in der Karte) und Netz prüfen.`
+ Cloud-Zugang (Statusleiste „Cloud-Zugang“, Panel ⚙ › Cloud-Zugang) und Netz prüfen.

- `Der Grund steht unter „Hinweise“ in der Zoom-Karte,`
+ Der Grund steht unter „Hinweise“ in der Zoom-Spalte,

- `in der Fußzeile des Hauptfensters oder in der Zoom-Karte, dann main.log ansehen.`
+ in der Fußzeile des Hauptfensters oder in der Zoom-Spalte, dann main.log ansehen.

Die Checkliste nennt die Zeile „Zoom-Anmeldung“ im Panel.

- `die Zeile „Zoom-Anmeldung“ in der Zoom-Karte nennt den Launcher`
+ die Zeile „Zoom-Anmeldung“ im Panel ⚙ › Zoom-Einrichtung nennt den Launcher

### Prompter

Bei „Kein Bild auf dem Talent-Monitor“ nennen Pille und „Steht auf“ den gemessenen Bildschirm.

- `Statusleiste „Talent-Monitor“ ansehen (zu, Bildschirm fehlt, abgestürzt); Schalter „Ausgabe“ im Panel ⚙ › Ausgabe auf Bildschirm an + richtiger Monitor gewählt?`
+ Statusleiste „Talent-Monitor“ ansehen (zu, Bildschirm fehlt, abgestürzt); Schalter „Ausgabe“ im Panel ⚙ › Ausgabe auf Bildschirm an + richtiger Monitor gewählt? Pille und „Steht auf“ im Abschnitt nennen den Bildschirm, auf dem der Monitor wirklich steht. Nach dem Wiederanstecken bleibt „Bildschirm fehlt“ stehen, bis „Auf diesen Bildschirm“ das Fenster verschiebt oder es neu geöffnet wird

### Stage Display

Bei „Kein Bild auf dem Bühnen-Monitor“ nennen Pille und „Steht auf“ den gemessenen Bildschirm.

- `Statusleiste „Bühnenschirm“ ansehen (zu, Bildschirm fehlt, abgestürzt); Ausgabe mit der Haupttaste „Vollbild-Ausgabe öffnen“ geöffnet + richtiger Monitor (Vollbild) im Panel ⚙ › Ausgabe auf Bildschirm gewählt?`
+ Statusleiste „Bühnenschirm“ ansehen (zu, Bildschirm fehlt, abgestürzt); Ausgabe mit der Haupttaste „Vollbild-Ausgabe öffnen“ geöffnet + richtiger Monitor (Vollbild) im Panel ⚙ › Ausgabe auf Bildschirm gewählt? Pille und „Steht auf“ im Abschnitt nennen den Bildschirm, auf dem der Schirm wirklich steht. Nach dem Wiederanstecken bleibt „Bildschirm fehlt“ stehen, bis „Auf diesen Bildschirm“ das Fenster verschiebt oder es neu geöffnet wird

### Player

Eine andere Show wechselt erst mit „Setzen“.

- `Show-Cues im Reiter „Cue-Show“ in Reihenfolge bringen;`
+ Show-Cues im Reiter „Cue-Show“ in Reihenfolge bringen (eine andere Show dort mit der Show-Auswahl wählen und mit „Setzen“ übernehmen, das dann rechts im Kopf der Cue-Show vor „▦ Ausgabe“ erscheint; erst „Setzen“ wechselt die Show und räumt die laufende);

Bei „Kein Ton/Bild beim GO“ nennen Pille und „Steht auf“ den gemessenen Bildschirm.

- `Video: Statusleiste „Video-Ausgabe“ und Panel ⚙ › Ausgabe auf Bildschirm prüfen.`
+ Video: Statusleiste „Video-Ausgabe“ und Panel ⚙ › Ausgabe auf Bildschirm prüfen (Pille und „Steht auf“ nennen den Bildschirm, auf dem das Fenster wirklich steht; nach dem Wiederanstecken bleibt „Bildschirm fehlt“ stehen, bis „Auf diesen Bildschirm“ das Fenster verschiebt oder es neu geöffnet wird).

Freigabe: ☐ alle Texte wie hier ☐ mit Änderungen (bitte je Nr. notieren)
