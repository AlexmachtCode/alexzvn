# Altfehler, Runde 1: Sicherheit und Show-Risiken (Entwurf)

Stand: 25.11.2026, Entwurf zur Freigabe durch den Owner. Grundlage: die Bestandsaufnahme `docs/ux/altfehler-inventar.md`
(am Code von main `cf42db4e4a` geprüft, jeder Befund mit Datei und Zeile belegt). Kennungen wie `PL-N` oder `SC-S2` stammen
von dort; die Zeilenangaben gelten für diesen Stand.

## 1. Anlass und Absicht

Die Funktionslisten der UX-Wellen 2a und 2b haben in neun Apps Fehler gefunden, die schon vor dem Umbau bestanden. Der
Umbau hat sie absichtlich nicht angefasst (Regel „die Bedienlogik bleibt“). Der Owner hat entschieden, dass sie ein eigenes
Thema werden: am 23.11. für die 2a-Apps (Caption, Interpreter, Prompter, Stage Display, Recorder, Player) und am 25.11. für
die 2b-Apps (Presenter, Studio-Control, Connect).

Die Bestandsaufnahme zählt 104 Altfehler, die auf main noch bestehen. Fünf betreffen die Sicherheit (S), 24 können eine
laufende Show stören (A); der Rest sind falsche Anzeigen (B, 28), Komfort und Text (C, 36) und toter Code oder Doku (D, 11).

Der Owner hat am 25.11. um 12:25 Weg 1 gewählt: **erst das Risiko.** Diese Runde behebt nur die 29 Befunde der Kategorien S
und A. Von ihnen ist einer schon im Betrieb aufgefallen: Im Player spielt das erste GO auf einen Video-Cue bei geschlossener
Ausgabe nicht (PL-N). Die übrigen sind am Code gefunden, nicht auf Einsätzen.

Erfolg heißt: Nach dieser Runde kann keiner der 29 Befunde mehr eine Show stören oder die Steuerung im Netz öffnen. Jeder
ist behoben oder vom Owner ausdrücklich als gewolltes Verhalten bestätigt. Für jeden behobenen gibt es einen Test, der vorher
rot war. Was im Betrieb sichtbar ist, ist im echten Fenster nachgemessen.

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
- Die 29 Befunde der Tabelle in Abschnitt 5 erreichen das dort beschriebene Zielverhalten.
- Zwei Stufen. **Stufe 1** (zuerst, eigenes Release): Studio-Control (SC-S1 bis SC-S3) und Player (sieben A-Befunde).
  **Stufe 2:** die übrigen 19 Befunde in Caption, Interpreter, Stage Display, Recorder, Presenter und Connect.
- Je App ein Release, wie in den Wellen; Changelog und Kochbuch-Handbuch nennen jede geänderte Bedienung.

**Nicht-Ziele**
- Die 75 Befunde der Kategorien B, C und D. Sie bleiben in `docs/ux/altfehler-inventar.md` für eine spätere Runde.
- Die Welle-1-Apps (Switcher, Timer, Rundown, Q&A, Battle) und der Launcher.
- Neue Funktionen, Umgestaltung der Oberfläche, neue Tastenkürzel.
- Der gemeinsame Baustein „Fehler im Fenster melden“ für alle Apps (Muster in 8 von 9 Apps). Gebaut wird nur, was ein
  A-Befund braucht; ein Baustein entsteht nur dort, wo mehrere A-Befunde dasselbe brauchen.

**Anti-Ziele** (wäre ein Misserfolg, auch wenn es technisch funktioniert)
- Eine Taste, die im Lauf gebraucht wird, verhält sich ohne Owner-Entscheid anders als bisher. Beispiele sind Esc im
  Presenter (PS-10) und „Schwarz“ über Companion (PS-18).
- Bestehende Companion-Tasten brechen still. Ein Verb ändert seine Wirkung nur mit Owner-Entscheid (Fragen 3 und 4), und
  der Changelog nennt es.
- Neue Rückfragen bremsen Routine-Handgriffe. Eine Rückfrage kommt nur, wo eine Aktion etwas Laufendes beendet (Aufnahme,
  Meeting, Show) oder Daten weg sind, die gerade gebraucht werden.
- Die Studio-Control-Absicherung sperrt jemanden aus, der heute rechtmäßig steuert: das App-Fenster selbst, Companion über
  das Gateway, angemeldete Browser.
- Ein Fernbefehl öffnet ein Fenster oder einen Dialog am Show-Rechner (heute RE-2b).

## 3. Rahmen (bindend)

- Es gelten die Regeln der UX-Wellen: Test zuerst (rot, dann grün, Mutationsprobe bei Logik); „Nur Gemessenes“ in Anzeige
  und Doku; Kreuzzustände durchgehen. Messungen im echten Fenster laufen isoliert: eigenes Profil, umgelenkte Benutzerordner,
  Blocker auf dem Steuerport, nur Fake-Medien, nie das echte Profil.
- Die Bedienlogik ändert sich **nur** an den Stellen in Abschnitt 5. Was dort nicht steht, bleibt.
- Neue oder geänderte sichtbare Texte (Rückfragen, Sperrgründe, Fehlermeldungen) und alle Changelog-Notizen gehen vor dem
  Release als Texttabelle an den Owner, wie in den Wellen.
- Studio-Control nur gegen Testadressen (192.0.2.x), keine echten Geräte, kein Licht-Node.
- Release, Merge, Push, Tag nur mit frischem Owner-OK. Release-Wege je App wie bisher: Studio-Control, Prompter, Stage Display,
  Player und Interpreter über die CI; Presenter Windows lokal mit NDI; Connect, Caption und Recorder lokal (native Teile).
- Mac-Befunde ohne Mac zum Messen (CA-11): nur per Test am Code, im Changelog als „nicht auf dem Mac gemessen“.

## 4. Wege (Owner-Entscheid 25.11. 12:25: Weg 1)

1. **Erst das Risiko (gewählt).** Nur S und A, Stufe 1 vorgezogen. Preis: 75 kleinere Befunde bleiben liegen.
2. **App für App, alles.** Alle 104 Befunde, eine App nach der anderen. Verworfen: neun lange Durchgänge, die
   Studio-Control-Absicherung wartet, bis die App dran ist.
3. **Erst gemeinsame Bausteine** (Fehler im Fenster, Rückfrage/Doppelklick-Sperre), dann einsetzen. Verworfen: größter
   Umbau, auch der Player-Fix wartet.

## 5. Zielverhalten je Befund

„Owner“ in der Spalte Entscheid heißt: Das Zielverhalten ist ein Vorschlag, der Owner entscheidet vor dem Plan (Abschnitt 6).
„Mein Vorschlag“ heißt: Ich habe es so festgelegt, der Owner kann es beim Lesen korrigieren.

**Abgelehnte Fernbefehle (gilt für PL-16a, RE-2 und RE-2b, mein Vorschlag):**
- Ein abgelehnter Fernbefehl ändert nichts.
- Companion sieht über die bestehenden Zustandswerte, dass sich nichts geändert hat.
- Den Grund nennt das Fenster der App, das Log hat eine Zeile dazu.
- Protokoll (`@jm/suite-control-protocol`) und Companion-Modul ändern sich in dieser Runde nicht. Das Modul verwirft heute alle Zeilen außer Zustand und Anmeldung und hat einen eigenen Auslieferungsweg. Eine Fehleranzeige in Companion ist ein eigenes Thema.

### Stufe 1: Studio-Control

| ID | Heute | Ziel | Entscheid |
|---|---|---|---|
| SC-S1 | Der Server (Port 7778, Weboberfläche und Socket.IO) lauscht an allen Netzwerkkarten. Im Netz schützt ihn nur die Anmeldung, und das erste Admin-Konto bekommt beim ersten Start ein Zufallspasswort in einer Datei (laut Code). | Hängt an Frage 1: (a) Der Browser-Zugang im Netz bleibt, mit Anmeldung; das Konto beim ersten Start wird nachgemessen und der Weg zum Passwort im Panel sichtbar. (b) Der Server lauscht nur am eigenen Rechner; der Zugang im Netz ist ein Schalter im Panel, standardmäßig aus. | Owner (Frage 1) |
| SC-S2 | Jeder Zugriff von 127.0.0.1 gilt als Admin („local“), Socket.IO erlaubt jeden Ursprung. Damit ist jedes Programm auf dem Rechner Admin, laut Code womöglich auch eine Webseite im Browser desselben Rechners. | Nur das eigene App-Fenster ist am Server Admin. Das läuft über ein Geheimnis, das der Hauptprozess bei jedem Start erzeugt und nur an sein Fenster gibt; weder Datei noch Netz sehen es. Für das Fenster selbst bleibt alles wie heute: Die Anmeldung im Fenster bleibt, die Rollen wirken dort weiter über die Sperren im Fenster, und das Protokoll schreibt weiter „local“. Alle anderen, auch vom eigenen Rechner, melden sich an wie im Netz und haben am Server die Rolle ihres Kontos. Socket.IO und HTTP nehmen nur den eigenen Ursprung an. | Mein Vorschlag: Das Fenster bleibt Admin. So gibt es keine neuen Ablehnungen im Fenster, die dort still blieben (SC-8 ist nicht in dieser Runde). |
| SC-S3 | Das Companion-Gateway (8735) liest `control.json` nicht und läuft darum immer offen, auch wenn die Suite auf „secure“ steht. | Das Gateway liest `control.json` wie alle anderen Steuerserver. Im Modus „secure“ verlangt es den Schlüssel, im Modus „open“ bleibt alles wie heute. Der Changelog sagt, dass Companion bei „secure“ den Schlüssel braucht. | Mein Vorschlag |

### Stufe 1: Player

| ID | Heute | Ziel | Entscheid |
|---|---|---|---|
| PL-N | Bei geschlossener Ausgabe öffnet das erste GO auf einen Video-Cue das Fenster, das Video läuft aber nie an. Der Ladebefehl kommt, bevor die Ausgabe zuhört. Erst ein zweites GO spielt. Im Betrieb aufgefallen. | Ein GO spielt das Video, auch bei geschlossener Ausgabe. Das Öffnen gilt erst als fertig, wenn die Ausgabe gemeldet hat, dass sie zuhört; erst dann geht der Ladebefehl hinaus. ON AIR bleibt wie heute an das echte Abspielen gebunden. Gemessen im echten Fenster: GO bei geschlossener Ausgabe, und das Video läuft. | fest |
| PL-T13 | Wird schnell geschlossen und wieder geöffnet, sind zwei Ausgabefenster möglich: Das alte setzt beim Schließen die Referenz auf das neue zurück. | Es gibt höchstens ein Ausgabefenster. Das Schließen eines alten Fensters lässt das neue unberührt. | fest |
| PL-4 | Pad-Tasten prüfen keine Umschalttasten (Strg+C löst Pad „C“ aus) und wirken auch bei offenem Dialog oder Panel. | Ein Pad löst nur die Taste ohne Strg, Alt oder Meta aus, und nur, wenn weder Dialog noch Panel offen ist und der Fokus in keinem Feld steht. | Mein Vorschlag |
| PL-10 | Nur „Show löschen“ fragt nach. Wird ein Cue vor dem Standby gelöscht, rückt der Standby auf einen anderen Cue. Wird ein Medium entfernt, fehlt es allen Cues und Pads. | Der Standby folgt dem Cue selbst, nicht der Position; Löschen anderer Cues verschiebt ihn nicht. Eine Rückfrage kommt beim Löschen eines Mediums, das Cues oder Pads benutzen (mit Anzahl), und beim Löschen eines Cues, solange die Show läuft. Sonst bleibt Löschen wie heute ohne Rückfrage. | Owner (Frage 8) |
| PL-11 | Die Pause hält den Vorlauf (Pre-Wait) nicht an. Ein Cue startet mitten in der Pause und weckt alle pausierten Töne. | Die Pause hält auch laufende Vorläufe an; „weiter“ setzt sie mit der Restzeit fort. In der Pause startet kein Cue von selbst. | fest |
| PL-16a | Companion `cue 0` oder eine Nummer außerhalb der Liste setzt den Standby ans Ende, und das nächste GO tut nichts. Dasselbe tut `standby` mit einer Nummer außerhalb der Liste. | `cue` und `standby` lehnen eine ungültige Nummer ab, wie oben unter „Abgelehnte Fernbefehle“ beschrieben. Der Standby bleibt, wo er war. | Owner (Frage 3) |
| PL-T14 | Lädt ein Ton-Cue nicht (Datei fehlt oder ist kaputt), klingt nichts, und es kommt keine Meldung. Der Cue zählt weiter als „laufend“, ON AIR bleibt an. | Der Cue verlässt „laufend“ sofort, ON AIR folgt. Eine Meldung im Fenster nennt den Cue und den Grund. Das Log hat eine Zeile dazu. | fest |

### Stufe 2: Caption

| ID | Heute | Ziel | Entscheid |
|---|---|---|---|
| CA-1 | Bei einem Mikrofonfehler bleibt `running` an, Companion meldet `running=1`, und bei jeder Konfigurationsänderung startet die App neu. | Bei einem Mikrofonfehler wird `running` zurückgenommen (Companion `running=0`), der Fehler steht im Fenster bis zum nächsten Start oder Stopp, und es gibt keinen Neustart von selbst. | fest |
| CA-4 | Hold friert nur Vorschau und NDI ein. „Leeren“ während Hold löscht die Zeilen, der eingefrorene Text bleibt aber auf NDI stehen, bis Hold aus ist. | Hängt an Frage 6. Vorschlag: „Leeren“ leert immer auch die NDI-Quelle, Hold hin oder her, weil „Leeren“ der Griff im Notfall ist. | Owner (Frage 6) |
| CA-5 | Kommt während einer Korrektur eine neue Zeile an, ersetzt die Korrektur die jüngste Zeile statt der angeklickten. Escape bricht nicht ab. | Die Korrektur trifft die angeklickte Zeile (über eine Kennung der Zeile), auch wenn inzwischen neue Zeilen kamen. Escape bricht ab. | fest |
| CA-8 | Ein geleertes Zahlenfeld wird sofort 0 und wirkt; Schriftgröße 0 lässt die Untertitel auf NDI verschwinden. Jede Taste schreibt die Datei. | Zahlenfelder haben Grenzen; ein leeres oder ungültiges Feld wirkt nicht. Übernommen wird mit Enter oder beim Verlassen, auf die Grenzen gezogen, wie im Recorder. Eine Schriftgröße unter dem Mindestwert gibt es nicht. | fest |
| CA-11 | Nur Mac: Nach dem Schließen des Fensters bleibt die App offen, `running` und `hold` bleiben gesetzt, Fernbefehle melden `running=1`. | Schließt das letzte Fenster, endet die Transkription (`running=0`, Hold aus). Ein Klick aufs Dock öffnet das Fenster wieder. Nur per Test belegt, nicht auf dem Mac gemessen. | fest |

### Stufe 2: Interpreter

| ID | Heute | Ziel | Entscheid |
|---|---|---|---|
| IN-3 | Während des Starts ist die Start-Taste frei; ein zweiter Klick verwirft den halben ersten Start. | Während des Starts ist die Taste gesperrt, mit Grund („startet …“), und ein zweiter Start wird auch in der Engine verworfen. | fest |
| IN-8 | „Ducking-Werte zurücksetzen“ setzt auch beide Vorverstärkungen auf 0 dB zurück, im laufenden Mix. | Die Taste setzt nur die Ducking-Werte zurück; die Vorverstärkungen bleiben. | fest |

### Stufe 2: Stage Display

| ID | Heute | Ziel | Entscheid |
|---|---|---|---|
| SD-5 (S) | Die Presenter-PIN steht offen im Feld, in `stage-config.json` und als `?pin=` in der Anfrage. Jedes getippte Zeichen baut neu auf. | Das Feld zeigt die PIN verdeckt (mit „Anzeigen“), sie gilt erst mit „Setzen“. Ablage und Anfrage bleiben, weil das Protokoll zum Presenter gehört; die Doku nennt das. | Mein Vorschlag |
| SD-1 | Jeder getippte Buchstabe der Nachricht geht sofort auf die Bühne; die Nachricht wird gespeichert und erscheint beim nächsten Start wieder. | Hängt an Frage 7. Vorschlag: Die Nachricht ist ein Entwurf und geht erst mit „Senden“ (oder Enter) auf die Bühne. Beim Start der App ist keine Nachricht auf der Bühne; der Text bleibt als Entwurf stehen. | Owner (Frage 7) |
| SD-3 | Fällt eine eingeschaltete Quelle kurz aus, stellt die mDNS-Suche sie still auf einen anderen gefundenen Host um. | Die Suche übernimmt einen gefundenen Host nur, solange die Quelle noch auf der Vorgabe 127.0.0.1 steht, also nie eingerichtet war. Das ist der Weg „verbinden ohne IP-Eingabe“, er bleibt. Steht ein anderer Host drin, ob von Hand oder früher gefunden, wechselt die Suche nie mehr von selbst. Andere gefundene Hosts sind dann nur noch Vorschläge, und die Statusleiste zeigt „nicht erreichbar“. Ein neues Feld braucht es nicht; gespeicherte Hosts gelten nach dem Update als eingerichtet. | Mein Vorschlag |

### Stufe 2: Recorder

| ID | Heute | Ziel | Entscheid |
|---|---|---|---|
| RE-7b (S) | Ein Zielordner aus einer `.jmshow` wird ungeprüft übernommen, ohne die Netzwerk-Rückfrage des Imports. Windows meldet sich dann beim Schreiben an diesem Server an. Shows kommen auch per Launcher-Link, oft ohne jemanden am Recorder. | Der Ordner aus der Show geht durch dieselbe Prüfung wie beim Import. Für Netzwerkordner hängt das Weitere an Frage 2. Vorschlag: Ein bestätigter Netzwerkordner wird gemerkt (je Pfad), danach geht er ohne Klick. Ein neuer Netzwerkordner aus einer Show braucht einmal die Bestätigung im Fenster, als Hinweis mit Taste, nie als Dialog, der den Rechner blockiert. Bis dahin ist kein Ordner gesetzt, und RECORD ON wird mit Grund abgelehnt (RE-2b). Die Prüfung blockiert den Hauptprozess nicht. | Owner (Frage 2) |
| RE-2 | Der Fernbefehl ARM und „Eingang schließen“, im Fenster wie über Companion (`arm`, `disarm`), beenden eine laufende Aufnahme ohne Rückfrage. | Hängt an Frage 3. Vorschlag: Während einer Aufnahme lehnen `arm` und `disarm` ab (siehe „Abgelehnte Fernbefehle“); beenden geht nur mit Stopp. Im Fenster ist „Eingang schließen“ während der Aufnahme gesperrt, mit Grund („Erst die Aufnahme stoppen“). | Owner (Frage 3) |
| RE-2b | RECORD ON ohne Zielordner öffnet einen Ordnerdialog am Rechner, und die Aufnahme startet erst nach einer Wahl. | Hängt an Frage 3. Vorschlag: RECORD ON über Companion ohne Zielordner wird abgelehnt (siehe „Abgelehnte Fernbefehle“), am Rechner öffnet sich kein Dialog. Von Hand im Fenster bleibt der Dialog wie heute. | Owner (Frage 3) |
| RE-3 | Der Aufnahmezustand hat kein Fehlerfeld, ein Schreibfehler im Audio-Block wird nicht abgefangen, Fehler erscheinen nur als Toast für 5 s. | Ein Schreibfehler setzt den Zustand „Fehler“. Er bleibt in Statusleiste und Haupttaste sichtbar, bis jemand stoppt oder neu startet. Companion sieht über die bestehenden Zustandswerte, dass nicht aufgenommen wird; einen neuen Zustandswert gibt es nicht. Ob die Aufnahme weiterläuft oder sauber endet, legt der Plan nach Messung fest, je nachdem, was das Addon bei einem Fehler tut. Sicher ist nur: Es steht nie „REC“, ob im Fenster oder bei Companion, während nichts geschrieben wird. | fest |
| RE-7a | Das Fenster zu schließen beendet die Aufnahme ohne Rückfrage (die Datei wird sauber abgeschlossen). | Läuft eine Aufnahme, fragt das Schließen nach („Aufnahme läuft. Wirklich beenden?“). Ohne Aufnahme schließt das Fenster wie heute. | fest |

### Stufe 2: Presenter

| ID | Heute | Ziel | Entscheid |
|---|---|---|---|
| PS-15 | Verbindet sich die Handy-Seite, prüft sie die PIN mit der Aktion `live` und hebt so ein Schwarz- oder Weißbild auf. | Die PIN-Prüfung schaltet nichts. Schwarz und Weiß bleiben, bis jemand sie aufhebt. | fest |
| PS-10 | Esc beendet die Präsentation überall (Referent, Publikum, Übersicht, Handy-Fenster), ohne Rückfrage. 2b hat das als alte Bedienung behalten. | Hängt an Frage 5. | Owner (Frage 5) |
| PS-18 | Companion „Schwarz“ und „Weiß“ schalten um: Ein zweiter Druck auf „Schwarz“ zeigt wieder die Folie. | Hängt an Frage 4. | Owner (Frage 4) |

### Stufe 2: Connect

| ID | Heute | Ziel | Entscheid |
|---|---|---|---|
| CN-MV | Der erste Klick auf „Meeting verlassen“ stellt die Rückfrage, und an derselben Stelle steht dann „Ja, verlassen“. Ein Doppelklick verlässt das Meeting also trotz laufender Slots. | Ein Doppelklick verlässt nie. „Ja, verlassen“ nimmt erst nach einer kurzen Sperrzeit Klicks an, oder es steht an einer anderen Stelle als „Meeting verlassen“. Was davon, entscheidet der Plan nach der Tastenplatz-Regel der Wellen. | fest |

## 6. Fragen an den Owner vor dem Plan

1. **Studio-Control im Browser (SC-S1):** Öffnet jemand Studio-Control im Browser eines anderen Geräts, etwa auf einem
   Tablet? Ja → (a), der Netzzugang bleibt mit Anmeldung. Nein → (b), nur der eigene Rechner, Netzzugang per Schalter.
2. **Recorder, Netzwerkordner aus einer Show (RE-7b):**
   - Heute nimmt eine Show mit NAS-Ordner, die der Launcher öffnet, ohne Klick am Recorder auf.
   - Vorschlag (A): Einen neuen Netzwerkordner bestätigt man einmal im Fenster des Recorders. Danach ist er gemerkt und geht
     ohne Klick.
   - (B): Ordner aus Shows, die der Launcher öffnet, gelten ohne Bestätigung, nur Dateien von Hand werden geprüft.
   - (C): Jedes Mal bestätigen.
3. **Companion-Befehle, die heute Schaden anrichten (PL-16a, RE-2, RE-2b), künftig ablehnen?** Gemeint sind:
   - Player: `cue` und `standby` mit ungültiger Nummer;
   - Recorder: `arm` und `disarm` während einer Aufnahme (beenden geht dann nur mit Stopp);
   - Recorder: `record on` ohne Zielordner, ohne Dialog am Rechner.

   Vorschlag: ja, alle. Die Befehle wirken danach anders als heute; der Changelog nennt das.
4. **Presenter über Companion, „Schwarz“ und „Weiß“ (PS-18):**
   - (A) Wie heute umschalten; der Changelog und das Handbuch sagen es.
   - (B) „Schwarz“ schaltet immer schwarz; aufheben über eine neue Aktion „Folie zeigen“. Bestehende Tasten wirken dann anders.
   - Vorschlag (C): Standard bleibt Umschalten, also bestehende Tasten unverändert. Neu kommt eine Wahl an der Aktion dazu:
     „an“, „aus“ und „umschalten“, wie beim Licht-Blackout. Wer „sicher schwarz“ will, stellt die Taste auf „an“. Das braucht
     ein Update des Companion-Moduls.
5. **Esc im Presenter (PS-10):**
   - Vorschlag (A): Esc beendet weiter überall sofort, wie bisher. Es gab dazu keine Meldung aus dem Betrieb, und 2b hat es
     bewusst behalten.
   - (B) Esc beendet nur im Referenten, im Publikum und auf dem Handy nicht.
   - (C) Esc fragt nach, ein zweites Esc beendet.
6. **Caption, „Leeren“ während Hold (CA-4):**
   - Vorschlag (A): „Leeren“ leert auch die NDI-Quelle.
   - (B) Hold hat Vorrang. NDI bleibt bis Hold aus, dann aber ohne den gelöschten Text.
7. **Nachricht im Stage Display (SD-1):**
   - (A) Tippen geht direkt auf die Bühne, so lassen.
   - Vorschlag (B): Die Nachricht ist ein Entwurf und geht erst mit „Senden“ oder Enter auf die Bühne. Nach einem Neustart
     ist nichts auf der Bühne.
8. **Player, Löschen (PL-10):**
   - Vorschlag: Der Standby folgt dem Cue. Eine Rückfrage kommt nur, wenn ein Medium noch benutzt wird oder die Show läuft.
   - Oder soll jedes Löschen nachfragen?

## 7. Was dem Bauenden bleibt

- Das Wie jedes Fixes, soweit Abschnitt 5 nur das Verhalten festlegt. Dazu gehören die Bereit-Meldung der Player-Ausgabe,
  das Fenster-Geheimnis in Studio-Control und die Kennung der Caption-Zeilen.
- Versionsnummern nach der Regel der Wellen (Patch eine bis zwei Notizen, Minor drei bis vier) und der Schnitt in Tasks.
- Die Entwürfe der neuen Texte; sie gehen als Texttabelle an den Owner.
- Wo ein Befund im echten Fenster gemessen werden muss: mindestens PL-N, PL-T13, PL-T14, RE-7a, CN-MV und SC-S2 (das
  App-Fenster bleibt Admin, ein fremder Ursprung wird abgelehnt).
