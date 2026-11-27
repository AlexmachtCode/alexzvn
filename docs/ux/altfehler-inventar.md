# Altfehler-Inventar: neun Apps nach UX-Welle 2a und 2b

Stand: main `cf42db4e4a`, erstellt am 25.11.2026 (nur gelesen, jeder Befund am Code geprüft). Runde 1 (S und A) beschreibt `docs/superpowers/specs/2026-11-25-altfehler-runde1-design.md`; B, C und D bleiben hier für später.

**Stand Stufe 1 (`feat/altfehler`):** Die zehn Befunde der Stufe 1 (PL-N, PL-T13, PL-4, PL-10, PL-11, PL-16a, PL-T14, SC-S1, SC-S2, SC-S3) sind auf dem Branch behoben, aber noch nicht released; ihre Zeilen in Abschnitt 2 tragen den Vermerk „✅ behoben auf `feat/altfehler`, Task N“, die Übersicht steht in Abschnitt 0. Die Zählung in Abschnitt 1 und die Tabellen je App geben weiter den Stand von `main` wieder. Entscheidungen und vermerkte Kleinigkeiten: `docs/ux/altfehler-entscheidungen.md`; Abnahme: `docs/ux/ABNAHME-Altfehler-Stufe1.md`.

**Stand Stufe 2 (`feat/altfehler-stufe2`, 27.11.2026):** Stufe 1 ist seit dem 26.11.2026 released (Player 0.10.0 und Studio-Control 0.8.0, PR #334); die Vermerke „behoben auf `feat/altfehler`“ gelten damit auf `main`. Die 19 Befunde der Stufe 2 aus Abschnitt 2 und die vier Zusätze des Spec-Nachtrags (PL-K1, PL-K2, RE-NAS, RE-PLATZ) sind auf dem Branch `feat/altfehler-stufe2` behoben, aber weder gepusht noch released; PS-10 hat der Owner als gewollt bestätigt, es ist kein Altfehler mehr. Die Zeilen in Abschnitt 2 tragen den Vermerk „✅ behoben auf `feat/altfehler-stufe2`, Task N“, PL-K1 und PL-K2 in Abschnitt 7 ebenso, die Übersicht steht in Abschnitt 0b; neue Kandidaten aus dem Bau stehen in Abschnitt 7. Die Zählung in Abschnitt 1 und die Tabellen je App geben weiter den Stand von `main` vor Stufe 1 wieder (`cf42db4e4a`). Entscheidungen: `docs/ux/altfehler-entscheidungen.md`, Abschnitt „Stufe 2“; Abnahme: `docs/ux/ABNAHME-Altfehler-Stufe2.md`; Texte: `docs/ux/altfehler-stufe2-texte.md`.

**Quellen:** `docs/ux/welle2a-texte.md` und `docs/ux/welle2b-texte.md` (Abschnitt „Offene Fragen“), `docs/ux/funktionslisten/<app>.md` (Abschnitt 10), `docs/ux/welle2-entscheidungen.md` (W64 ff.), `docs/superpowers/plans/2026-11-23-ux-welle2b.md` (B10, B11, B13), Ledger 2a (`progress.md`, `final-minors.txt`, aus dem Archiv entpackt) und Ledger 2b (`2026-11-25-ux-welle2b-rulings-und-minors.md`).

**Konventionen:**
- In den App-Tabellen sind Pfade relativ zu `apps/<app>/src/`. `R/` steht für `renderer/src/`.
- „Bef. n“ ist die Befund-Nr. aus Abschnitt 10 der Funktionsliste. „F3“ ist Offene Frage 3 der Texttabelle. „L2a/L2b“ ist ein Kleinpunkt oder Ruling aus dem Ledger.
- Die Spalte „Grundlage“ übernimmt das Wort der Quelle: **gemessen**, **laut Code** oder **abgeleitet**. Habe ich beim Nachlesen selbst etwas ergänzt, steht „eigene Lesung“ dabei.
- Die Spalte „Fix“ nennt die Größe (klein, mittel, groß) und die Schicht: **R** = nur Renderer und Text, **S** = Store-Logik, **M** = Hauptprozess, **I** = IPC oder Preload.

**Kategorien:** S = Sicherheit. A = kann eine laufende Show stören oder abbrechen. B = falsche oder irreführende Anzeige ohne direkte Folge. C = Komfort oder Text. D = toter Code oder Doku.

---

## 0. Stufe 1: behoben auf `feat/altfehler` (Abnahme offen)

| ID | Task | Was geändert ist |
|---|---|---|
| PL-N | 1 | GO auf einen Video-Cue wartet auf „bereit“ des Ausgabefensters (höchstens 5 s) und spielt auch bei geschlossener Ausgabe. |
| PL-T13 | 1 | Es gibt nie zwei Ausgabefenster; ein schließendes altes Fenster verwaist das neue nicht mehr. |
| PL-11 | 2 | Die Pause hält auch den Vorlauf an; „Weiter“ setzt ihn mit der Restzeit fort. |
| PL-16a | 2 | Companion `CUE` oder `STANDBY` mit einer Nummer außerhalb der Show wird mit Hinweis abgelehnt. |
| PL-T14 | 3 | Ein Ton-Cue, der nicht lädt, meldet das im Fenster und gilt nicht als laufend. |
| PL-4 | 4 | Pad-Tasten sperren mit Strg, Alt, Cmd und bei offenem Dialog oder Panel; AltGr-Zeichen wie @ lösen weiter aus (Fix-Welle, R17). |
| PL-10 | 4 | Rückfragen beim Entfernen eines benutzten Mediums und eines Cues bei laufender Show, als Fenster im Player-Fenster (Fix-Welle, R16); der Standby folgt seinem Cue. |
| SC-S1 | 5 | Das Panel nennt den Ort der Datei mit dem Erst-Passwort (Messung: kein bekanntes oder leeres Passwort). |
| SC-S3 | 5 | Das Companion-Gateway folgt dem Modus in `control.json`; „secure“ verlangt das Suite-Token, eine per Launcher gesicherte Suite dazu TLS (Companion braucht dann auch den TLS-Fingerprint). |
| SC-S2 | 6 | Ohne Anmeldung ist nur das eigene App-Fenster Admin; fremde Ursprünge bekommen HTTP 403. |

---

## 0b. Stufe 2: behoben auf `feat/altfehler-stufe2` (Abnahme offen)

Task-Nummern aus dem Plan `docs/superpowers/plans/2026-11-26-altfehler-stufe2.md`. RE-NAS und RE-PLATZ stammen aus dem Spec-Nachtrag (Abschnitt 8) und stehen nicht in Abschnitt 2; PL-K1 und PL-K2 waren Kandidaten aus Stufe 1 (Abschnitt 7).

| ID | Task | Was geändert ist |
|---|---|---|
| PL-K1 | 1 | Ein Cue, der während seiner Vorlaufzeit gelöscht wird, startet nicht mehr, auch nicht in oder nach der Pause und auch nicht als Video-Cue, der noch auf das Ausgabefenster wartet. |
| PL-K2 | 1 | Ein GO ohne Vorlauf in der Pause hebt die Pause ganz auf wie „Weiter“, auch für ein angehaltenes Ausgabevideo; „Weiter“ startet ein Video, das schon zu Ende lief, nicht neu (derselbe Fehler bei „Weiter“, Festlegung P3; in den Notizen des Controllers PL-K6, kein eigener Kandidat). |
| IN-3 | 2 | „Starten“ ist gesperrt, solange der Start läuft („Startet …“); ein zweiter Klick verwirft den ersten Start nicht mehr. Nach 15 s ohne Antwort der Geräte bricht der Start mit Meldung ab. |
| IN-8 | 2 | „Ducking-Werte zurücksetzen“ lässt die beiden Vorverstärkungen stehen. |
| SD-5 | 3 | Die Presenter-PIN steht verdeckt im Feld („Anzeigen“, „Verbergen“) und gilt erst mit „Setzen“; Datei und Anfrage bleiben im Klartext (Protokoll des Presenters). |
| SD-1 | 3 | Die Nachricht ist ein Entwurf und geht erst mit „Senden“ oder Enter auf die Bühne; nach einem Neustart steht keine Nachricht auf der Bühne, der Entwurf steht im Feld. |
| SD-3 | 3 | Die mDNS-Suche übernimmt einen Fund nur noch auf der Vorgabe (`127.0.0.1` oder leer); ein eingetragener Host ohne Verbindung heißt „nicht erreichbar“. |
| CA-1 | 4 | Ein Mikrofonfehler beim Start beendet die Transkription (Companion `running=0`), Caption startet nicht von selbst neu, der Grund steht im Fenster bis zum nächsten Start. |
| CA-4 | 4 | „Leeren“ leert bei Hold auch die NDI-Quelle; Hold bleibt an. |
| CA-5 | 4 | Eine Korrektur trifft die angeklickte Zeile (Zeilen-Kennung statt „letzte Zeile“), Escape bricht ab. |
| CA-8 | 5 | „Schrift“ und „Max. Äußerung (s)“ sind Zahlenfelder mit Prüfung; Werte aus Datei und Fernsteuerung zieht der Hauptprozess auf die Grenzen. |
| CA-11 | 5 | Mac: Fenster schließen beendet Transkription und Hold, ein Klick aufs Dock öffnet wieder, Companion `transcribe on` ohne Fenster wird abgelehnt. Nicht auf dem Mac gemessen. |
| RE-2 | 6 | `ARM` und `DISARM` werden während der Aufnahme abgelehnt, „Eingang schließen“ ist dann gesperrt. |
| RE-2b | 6 | `RECORD ON` ohne Zielordner wird abgelehnt, statt am Rechner einen Ordnerdialog zu öffnen. |
| RE-7b | 6 | Ein Netzwerkordner aus einer Show gilt erst nach „Übernehmen“ im Fenster und ist danach gemerkt; ungültige Pfade kommen nicht durch, die Prüfung blockiert den Hauptprozess nicht. |
| RE-NAS | 6 | Die Prüfung eines Netzwerkordners hält kein anderes Preset auf; der Netzwerkordner eines Presets gilt erst nach seiner Prüfung (bis dahin der alte Ordner, Ruling S2-R13). |
| RE-3 | 7 | Schreibfehler und 2 s ohne Audiodaten beenden die Aufnahme sauber; der Fehler steht in Statusleiste, Marke und Haupttaste, Companion sieht `recording=0`. Nicht am echten Datenträger gemessen. |
| RE-7a | 7 | Schließen während einer Aufnahme fragt nach (im Fenster, Rückfall Windows-Dialog nach 1 s); Abmelden und Herunterfahren schließen ohne Frage ab. |
| RE-PLATZ | 7 | Neuer Statuseintrag „Platz“ mit der Restzeit für das eingestellte Format, gelb unter 15 min, rot unter 5 min, nie gesperrt, sonst „Platz unbekannt“. |
| PS-15 | 8 | Die PIN-Prüfung der Handy-Seite schaltet nichts mehr; Schwarz und Weiß bleiben. |
| PS-18 | 8 | Companion „Schwarz“ und „Weiß“ haben die Wahl „Umschalten“ (Vorgabe), „An“ und „Aus“ (Companion-Modul 0.4.0); ohne Wahl wie bisher. |
| CN-MV | 9 | „Ja, verlassen“ nimmt erst nach 1 s einen Klick an; ein Doppelklick verlässt das Meeting nie. |
| PS-10 | 11 | Kein Fix: vom Owner als gewollt bestätigt (Spec 5, Owner 25.11. 12:49, Frage 5 A); das Handbuch nennt jetzt, dass Esc sofort und ohne Rückfrage beendet. |

---

## 1. Zählung (nur Befunde, die auf main noch bestehen)

| App | S | A | B | C | D | zusammen |
|---|---|---|---|---|---|---|
| Caption | 0 | 5 | 2 | 3 | 1 | 11 |
| Interpreter | 0 | 2 | 2 | 4 | 2 | 10 |
| Prompter | 0 | 0 | 2 | 3 | 2 | 7 |
| Stage Display | 1 | 2 | 1 | 3 | 0 | 7 |
| Recorder | 1 | 4 | 3 | 4 | 2 | 14 |
| Player | 0 | 7 | 4 | 4 | 2 | 17 |
| Presenter | 0 | 3 | 6 | 5 | 0 | 14 |
| Studio-Control | 3 | 0 | 4 | 4 | 1 | 12 |
| Connect | 0 | 1 | 4 | 6 | 1 | 12 |
| **zusammen** | **5** | **24** | **28** | **36** | **11** | **104** |

Nicht gezählt sind:
- 6 Befunde mit Status „unklar“ (Abschnitt 5);
- die von 2a und 2b behobenen oder vom Owner entschiedenen Befunde (je App unter „nein“);
- reine Mess- und Bestandsbefunde ohne Fehler (je App am Ende der Tabelle).

---

## 2. Befunde der Kategorien S und A

### S: Sicherheit (5)

| ID | Befund | Grundlage | Beleg auf main | Warum S | Fix |
|---|---|---|---|---|---|
| SC-S1 | ✅ *behoben auf `feat/altfehler`, Task 5* · **Studio-Control, Server 7778 auf allen Netzwerkschnittstellen.** Der Web- und Socket-Server ist im ganzen LAN erreichbar, solange die App läuft. In der Messung mit Entwickler-Schalter war er nach jedem von 5 frischen Starts rund 110 s mit Admin/Admin offen. Ohne den Schalter legt die App beim ersten Start ein Zufallspasswort in einer Datei ab (laut Code). | gemessen (Task 14) und laut Code | `main/server.ts:133` (`SERVER_HOST = '0.0.0.0'`), `:1082`; `main/auth/bootstrap.ts:17-59` | Steuerung von ATEM, OBS, TriCaster, PTZ, Pult und Licht aus dem LAN, geschützt nur durch die Anmeldung | mittel; M (Bind-Adresse, Konto beim ersten Start) |
| SC-S2 | ✅ *behoben auf `feat/altfehler`, Task 6* · **Studio-Control, Loopback ist Admin (Bef. 4).** Jeder Zugriff von 127.0.0.1 läuft am Server als „local“ mit Admin-Rechten, egal wer angemeldet ist. Die Rollen wirken nur über die Sperren im Fenster. Eigene Lesung: Socket.IO erlaubt jeden Ursprung (`cors: { origin: '*' }`). Damit ist jeder Prozess auf dem Rechner Admin, nach dem Code womöglich auch eine Webseite im Browser desselben Rechners (nicht gemessen). | gemessen (Loopback), laut Code (CORS) | `main/auth/middleware.ts:11-44`, `:76-82`; `main/server.ts:1054` | Rechte-Umgehung ohne Anmeldung | mittel bis groß; M und R (das Fenster müsste sich anmelden) |
| SC-S3 | ✅ *behoben auf `feat/altfehler`, Task 5* · **Studio-Control, Companion-Gateway 8735 offen (Bef. 11).** Das Gateway liest die `control.json` nicht und läuft deshalb immer im offenen Modus ohne Anmeldung, auf allen Schnittstellen. Auch wenn die Suite auf „secure“ steht, nimmt es jeden Befehl an, etwa `atem_cut`, `obs_*` oder `lighting_*`. | laut Code | `main/gateway/control-gateway.ts:317-339`: `new SuiteControlServer` ohne `appDataDir`. Alle anderen Steuerserver geben ihn mit, z. B. `apps/caption/src/main/control-server.ts:36-37` | jeder im LAN kann Bildmischer, Stream und Licht schalten | klein; M (eine Option, wie in den übrigen Apps) |
| RE-7b | ✅ *behoben auf `feat/altfehler-stufe2`, Task 6* · **Recorder, Zielordner aus der Show ungeprüft (Bef. 7).** Ein Ordner aus einer `.jmshow` übernimmt die App ohne `istErlaubterOrdner` und ohne die Netzwerk-Rückfrage. Es erscheint nur ein Hinweisband. Beim Import gibt es die Rückfrage, weil sich Windows beim Schreiben an dem Server anmeldet. `settings:load` prüft den gemerkten Ordner synchron mit `existsSync`, ein langsames NAS bremst also den Hauptprozess. | laut Code | `main/index.ts:34`; `R/store/recorder.ts:305-311`; Gegenprobe Import: `main/presets.ts:64-69`, `:79-96`; `main/ipc.ts:37` | eine Show-Datei kann einen fremden Netzwerk- oder Gerätepfad setzen, Windows meldet sich dort an | mittel; M und S |
| SD-5 | ✅ *behoben auf `feat/altfehler-stufe2`, Task 3* · **Stage Display, Presenter-PIN im Klartext (Bef. 5).** Die PIN steht offen im Feld, in `stage-config.json` und als `?pin=` in der HTTP-Anfrage. Jedes getippte Zeichen baut eine neue Verbindung auf. | laut Code | `R/views/Einstellungen.tsx:52-53` (`TextInput`); `main/config.ts:13`; `main/presenter-client.ts:77`; `R/lib/aktionen.ts:46` | gering: Geheimnis offen sichtbar und gespeichert | klein bis mittel; R (Passwortfeld, „Setzen“), ggf. M (Ablage) |

### A: kann eine laufende Show stören (24)

| ID | Befund | Grundlage | Beleg auf main | Warum A | Fix |
|---|---|---|---|---|---|
| PL-N | ✅ *behoben auf `feat/altfehler`, Task 1* · **Player, erstes GO auf einen Video-Cue bei geschlossener Ausgabe.** Das GO öffnet das Fenster, das Video läuft aber nie an. Erst ein zweites GO spielt. | gemessen (Nebenbefund 25.11., L2b Ruling 86), Ursache laut Code | `R/store/player.ts:530-535` schickt `load` nach `output.open()`. `open` kehrt zurück, bevor das Fenster geladen ist (`main/output-window.ts:61-114`, `loadOutput` ohne Warten). `sendToOutput` schickt sofort (`:151-153`), die Ausgabe meldet sich erst in `R/views/OutputView.tsx:49` an | der Cue fällt im Lauf aus | klein bis mittel; M (open erst nach dem Laden auflösen) oder I (Ausgabe meldet „bereit“) |
| PL-T13 | ✅ *behoben auf `feat/altfehler`, Task 1* · **Player, zwei Ausgabefenster** nach schnellem Schließen und Öffnen. Das alte Fenster setzt beim Schließen `outputWindow = null` ohne Bedingung und verwaist damit das neue. | laut Code (L2a Ruling Task 13, F3) | `main/output-window.ts:103-104`, `:117-122` | zweites Bild auf dem Ausgabeschirm, Befehle gehen an ein anderes Fenster | klein; M |
| PL-4 | ✅ *behoben auf `feat/altfehler`, Task 4* · **Player, Pad-Tasten feuern zu leicht (Bef. 4).** Umschalttasten prüft niemand, Strg+C löst also das Pad „C“ aus. Ein offener Pad-Dialog und das Panel sperren nicht, außer der Fokus steht in einem Feld. | laut Code | `R/views/SoundboardView.tsx:48-58` | ungewollter Ton auf der PA | klein; R |
| PL-10 | ✅ *behoben auf `feat/altfehler`, Task 4* · **Player, Löschen ohne Rückfrage (Bef. 10).** Nur „Show löschen“ fragt nach. Cue, Pad, Playlist, Playlist-Eintrag und Medium verschwinden sofort. Wer ein Medium entfernt, macht alle Pads und Cues damit zu „Medium fehlt“. | laut Code | Rückfrage nur in `R/views/ShowView.tsx:248`; ohne Rückfrage: `:287`, `R/views/LibraryView.tsx:67`, `R/views/SoundboardView.tsx:314` | wird im Lauf ein Cue vor dem Standby gelöscht, verschiebt sich die Reihenfolge, und das nächste GO trifft einen anderen Cue | klein; R |
| PL-11 | ✅ *behoben auf `feat/altfehler`, Task 2* · **Player, Pause hält den Vorlauf nicht an (Bef. 11).** Ein Cue mit Pre-Wait startet mitten in der Pause. Er weckt dabei die angehaltene Tonmaschine, und alle pausierten Ton-Cues laufen wieder. | abgeleitet | Zeitgeber `R/store/player.ts:555`; die Pause fasst ihn nicht an (`:592-602`); `R/lib/show-audio.ts:39-40` (`ctx.resume()`) | Ton läuft in der Pause an | mittel; S |
| PL-16a | ✅ *behoben auf `feat/altfehler`, Task 2* · **Player, `cue 0` oder eine Nummer außerhalb der Liste (Bef. 16).** `fireCue` setzt den Standby dann ans Ende der Liste. Das nächste GO tut nichts. | laut Code | `R/store/player.ts:76-77`, `:494-499` | ein falscher Companion-Knopf legt die Show still | klein; S |
| PL-T14 | ✅ *behoben auf `feat/altfehler`, Task 3* · **Player, ein Ton-Cue lädt nicht.** Fehlt die Datei oder ist sie kaputt, klingt nichts und keine Meldung erscheint. Der Cue bleibt in `playingCueIds`, ON AIR und „1 laufend“ bleiben an, bis Stop. | laut Code (L2a Task 14 minor, eigene Lesung des Ladewegs) | `R/store/player.ts:513-516` (ID vor dem Laden), `:537` (`void showAudio.play` ohne `catch`); `R/lib/show-audio.ts:21-36` | falscher Live-Zustand, Ausfall unbemerkt | klein; S und R (Meldung) |
| CA-1 | ✅ *behoben auf `feat/altfehler-stufe2`, Task 4* · **Caption, Mikrofonfehler (Bef. 1, F3).** `running` bleibt an, Companion meldet `running=1`. Der Fehler bleibt bis zum nächsten erfolgreichen Start stehen, auch nach Stopp. Bei jeder Übertragung versucht die App neu zu starten. | laut Code (Neuversuch abgeleitet) | `R/views/CaptionOberflaeche.tsx:110-120` (`micError` wird nur bei Erfolg gelöscht, Effekt hängt an `cfg`); `main/index.ts:143-149` | Companion und Statusmeldung behaupten „Transkription läuft“, es kommen aber keine Untertitel | mittel; R und I (Fehler an Main melden bzw. `running` zurücknehmen) |
| CA-4 | ✅ *behoben auf `feat/altfehler-stufe2`, Task 4* · **Caption, Hold friert nur Vorschau und NDI ein (Bef. 4).** Live-Zeile und Verlauf laufen weiter. „Leeren“ bei Hold löscht die Zeilen, der eingefrorene Text bleibt aber auf der NDI-Quelle stehen, bis Hold aus ist. | abgeleitet | `R/lib/ndi-engine.ts:82-86` | die Sendung zeigt nach „Leeren“ weiter Text | mittel; R (Engine), braucht Owner-Entscheid zur Bedienlogik |
| CA-5 | ✅ *behoben auf `feat/altfehler-stufe2`, Task 4* · **Caption, Korrektur trifft die falsche Zeile (Bef. 5).** Kommt während der Eingabe eine neue Zeile, ersetzt die Korrektur die jüngste Zeile statt der angeklickten. Escape bricht nicht ab. | abgeleitet | `main/index.ts:237-244` (`correctLast` ersetzt die letzte Zeile) | falscher Text auf der Sendung | mittel; I und M (Zeilen-ID mitgeben), R |
| CA-8 | ✅ *behoben auf `feat/altfehler-stufe2`, Task 5* · **Caption, Konfiguration ohne Prüfung (Bef. 8).** Ein geleertes Zahlenfeld wird 0 und wirkt sofort. Schriftgröße 0 zeichnet nichts Lesbares auf NDI. Jede Taste schreibt die Datei. | laut Code (Wirkung abgeleitet) | `main/index.ts:215-220`; `R/views/Einstellungen.tsx:90`, `:112` (`Number(e.target.value)`) | wer im Lauf die Schriftgröße ändert, lässt die Untertitel kurz verschwinden | klein bis mittel; R (NumberInput wie Recorder E13), M (Prüfung) |
| CA-11 | ✅ *behoben auf `feat/altfehler-stufe2`, Task 5 (nicht auf dem Mac gemessen)* · **Caption, Mac ohne Fenster (Bef. 11).** Nach dem Schließen bleibt die App offen, `running` und `hold` bleiben gesetzt. Fernbefehle wirken weiter und melden `running=1`, obwohl nichts aufnimmt. | laut Code, nicht gemessen | `main/index.ts:397-399` (kein `activate`-Hörer) | falscher Live-Zustand an Companion; nur Mac, selten | klein; M |
| IN-3 | ✅ *behoben auf `feat/altfehler-stufe2`, Task 2* · **Interpreter, Start nicht gesperrt (Bef. 3).** Solange der Start läuft, ist die Taste frei. Ein zweiter Klick ruft `start()` erneut, das zuerst `stop()` ruft und die halbe Verdrahtung des ersten Aufrufs verwirft. Laut 2a-Ledger (Task 28/32) unterschätzt der Befund den Doppelklick. | abgeleitet | `R/lib/oberflaeche.ts:374-382` (keine Lage „startet“); `R/core/engine.ts:150-151` | Einspeisung in die Konferenz kann gestört starten; Ausmaß nicht gemessen | klein; R |
| IN-8 | ✅ *behoben auf `feat/altfehler-stufe2`, Task 2* · **Interpreter, „Ducking-Werte zurücksetzen“ (Bef. 8)** setzt auch beide Vorverstärkungen auf 0 dB zurück, und zwar im laufenden Mix. | laut Code (Live-Wirkung eigene Lesung) | `R/store/settings.ts:23`; `shared/ducking.ts:24-32`; `R/core/engine.ts:136-142` | hörbarer Pegelsprung auf der Dolmetscherspur | klein; S (ohne Gains zurücksetzen) und Text |
| SD-1 | ✅ *behoben auf `feat/altfehler-stufe2`, Task 3* · **Stage Display, Nachricht ist live und gemerkt (Bef. 1).** Jeder Buchstabe geht sofort an den Bühnenschirm, Halbsätze sind also zu sehen. Die Nachricht wird gespeichert und erscheint beim nächsten Start wieder auf der Bühne. | laut Code | `R/views/LiveBereich.tsx:59-61`; `main/config.ts:15`, `:52` | unfertiger oder alter Text vor dem Redner; vielleicht gewollt (Abschnitt 5) | mittel; R (Entwurf und Senden), Bedienlogik |
| SD-3 | ✅ *behoben auf `feat/altfehler-stufe2`, Task 3* · **Stage Display, mDNS ersetzt einen eingetragenen Host still (Bef. 3, F3).** Fällt eine eingeschaltete Quelle kurz aus, stellt die Suche sie auf einen gefundenen anderen Host um, ohne Hinweis. | laut Code | `main/index.ts:100-140` | die Bühne zeigt den Timer eines anderen Rechners | mittel; M und R (Anzeige „gefunden“ oder „manuell“) |
| RE-2 | ✅ *behoben auf `feat/altfehler-stufe2`, Task 6* · **Recorder, Fernbefehl ARM und „Eingang schließen“ (Bef. 2, F3).** Beide beenden eine laufende Aufnahme ohne Rückfrage. „Eingang schließen“ steht in der Aufnahme frei neben „Stopp“. | laut Code | `main/recorder.ts:213` (`arm` schließt zuerst); `R/store/recorder.ts:341-346`; `R/lib/oberflaeche.ts:375` | die Aufnahme endet | klein bis mittel; S (ARM in Aufnahme ablehnen), R (Rückfrage oder Sperre) |
| RE-2b | ✅ *behoben auf `feat/altfehler-stufe2`, Task 6* · **Recorder, RECORD ON ohne Zielordner (Bef. 2).** Der Fernbefehl öffnet einen Ordnerdialog am Rechner. Die Aufnahme startet erst, wenn dort jemand wählt. | laut Code | `R/store/recorder.ts:496-502` | die Aufnahme beginnt nicht | klein; S |
| RE-3 | ✅ *behoben auf `feat/altfehler-stufe2`, Task 7 (nicht am echten Datenträger gemessen)* · **Recorder, kein Fehlerzustand (Bef. 3, F3).** Der Aufnahmezustand hat kein Fehlerfeld. Ein Schreibfehler im Audio-Block wird nicht abgefangen. Fehler erscheinen nur als 5-s-Toast. | laut Code; was das Addon mit einem Wurf macht: nicht gemessen | `shared/types.ts:13-24`; `main/recorder.ts:134-140` (`writeBlock` ohne `try`) | „REC“ kann stehen, während nichts geschrieben wird | mittel bis groß; M, I, S, R |
| RE-7a | ✅ *behoben auf `feat/altfehler-stufe2`, Task 7* · **Recorder, Fenster schließen beendet die Aufnahme (Bef. 7).** Es gibt keine Rückfrage; die Datei wird sauber abgeschlossen. | laut Code | `main/index.ts:123-126` | die Aufnahme endet durch einen Fehlklick | klein bis mittel; M (close abfangen), R (Rückfrage) |
| PS-10 | ☑ *vom Owner bestätigt, kein Altfehler (Spec 5, Owner 25.11. 12:49, Frage 5 A); das Handbuch nennt es seit `feat/altfehler-stufe2`, Task 11* · **Presenter, Esc beendet die Präsentation (Bef. 10).** Das gilt überall in Referent und Publikum, auch in Übersicht und Handy-Fenster. Eine Rückfrage gibt es nicht. 2b hat das als alte Bedienung bewusst behalten (L2b Ruling 76). | gemessen | `R/lib/oberflaeche.ts:684-687` | die Show endet mit einer Taste; Owner muss entscheiden, ob das ein Altfehler ist. Berichtigung (Stufe 2, P5): Ein Handy-Fenster gibt es seit 2b nicht mehr; Esc beendet im Referenten, im Publikumsfenster und in der Übersicht, im Panel schließt Esc das Panel | klein; R |
| PS-15 | ✅ *behoben auf `feat/altfehler-stufe2`, Task 8* · **Presenter, Handy-Verbindung hebt Schwarz- oder Weißbild auf (Bef. 15, F3).** „Verbinden“ auf der Handy-Seite prüft die PIN mit der Aktion `live`. | abgeleitet | `main/remote-page.ts:142` → `main/remote.ts:195-196` → `main/present.ts:145-150` | das Publikum sieht mitten in der Pause wieder die Folie | klein; M (PIN-Prüfung ohne Aktion) |
| PS-18 | ✅ *behoben auf `feat/altfehler-stufe2`, Task 8* · **Presenter, Companion BLACK und WHITE schalten um (Bef. 18).** Ein zweites `BLACK` zeigt wieder die Folie, obwohl die Fähigkeit „Schwarz“ heißt. | laut Code | `main/present.ts:145-150`; `main/control-server.ts:73-74` | ein doppelter Druck „sicher schwarz“ holt die Folie zurück | klein; M (Verb, Bedienlogik Companion) |
| CN-MV | ✅ *behoben auf `feat/altfehler-stufe2`, Task 9* · **Connect, Doppelklick auf „Meeting verlassen“.** Der erste Klick stellt die Rückfrage, und die Taste wird an derselben Stelle zu „Ja, verlassen“. Ein Doppelklick verlässt das Meeting also trotz laufender Slots. | abgeleitet (L2b Ruling 76: „Altbestand vor 2b“) | `R/zoom/ZoomCard.tsx:146-153`, `:290` | alle Zoom-Slots fallen aus der Sendung | klein; R (kurze Sperre nach dem ersten Klick) |

---

## 3. Muster über mehrere Apps

| Muster | betroffene Apps | Befunde |
|---|---|---|
| **Fehler oder Zustand wird nicht im Fenster gemeldet** (nur Log oder Konsole, still verworfen, roher oder fehlender Grund) | **8 von 9:** Caption, Prompter, Stage Display, Recorder, Player, Presenter, Studio-Control, Connect | CA-7, CA-12, PR-2, SD-7, RE-3, RE-10, RE-13, PL-T14, PL-15, PS-16, SC-5, SC-8, CN-14, CN-10 |
| **Fernsteuerungs-Zustand weicht von der Wirklichkeit ab, oder ein Fernbefehl hat eine harte Nebenwirkung** | **6:** Caption, Prompter, Recorder, Player, Presenter, Connect | CA-1, CA-11, PR-7, RE-2, RE-2b, PL-5, PL-16a, PL-16b, PS-15, PS-18, CN-13a |
| **Folgenreiche Aktion ohne Rückfrage oder Doppelklick-Schutz** | **5:** Recorder, Player, Presenter, Connect, Interpreter | RE-2, RE-7a, PL-10, PL-T13, PS-10, PS-21, CN-MV, IN-3 |
| **Eingaben und Dateien ungeprüft** (IPC, Show-Datei, Skriptdatei, Fernbefehl-Zahl) | **4:** Caption, Prompter, Recorder, Player | CA-8, PR-8, PR-13, RE-7b, PL-16a |
| **Eingabe wirkt sofort bei jeder Taste oder beim Verlassen, auch auf die Live-Ausgabe** | **4:** Caption, Stage Display, Connect, Recorder | CA-8, SD-1, SD-5, CN-BV, RE-5 |
| **Netz-Absicherung fehlt** | **3:** Studio-Control, Recorder, Stage Display | SC-S1, SC-S2, SC-S3, RE-7b, SD-5 |
| **Rohe oder englische Fehlertexte in der deutschen Oberfläche** | **3:** Studio-Control, Connect, Interpreter | SC-EN, CN-108, IN-5, IN-6 |
| **Toter Code oder veraltete Doku** | **7:** Caption, Interpreter, Prompter, Recorder, Player, Studio-Control, Connect | CA-17, IN-13, IN-T31, PR-10, RE-12, RE-15, PL-14, PL-T14b, SC-10, CN-13d |
| **Mikrofon-Probe beim Start** (Welle 1 hat sie im Switcher abgeschafft) | **2:** Caption, Interpreter | CA-13, IN-10 |
| **App lebt ohne Hauptfenster weiter** | **2:** Caption (Mac), Stage Display | CA-11, SD-10 |
| **Sperre ohne sichtbaren Grund** (Haupttasten seit 2b mit Grund) | **2:** Connect, Presenter | CN-10, PS-13 |
| **Einstellung wirkt erst beim nächsten Start**, ohne dass das Feld es sagt | **2:** Caption, Interpreter (Interpreter seit 2a mit Hinweis) | CA-12, IN-1 |

Zwei Folgerungen für die Reihenfolge:
- **Rückfragen und Doppelklick-Sperren** sind meist kleine Renderer-Fixes mit großer Wirkung im Betrieb: RE-2, RE-7a, PL-10, PS-10, CN-MV, IN-3.
- **„Fehler im Fenster zeigen“** ist die breiteste Lücke. Sie lässt sich als ein gemeinsames Muster bauen, etwa ein Fehlereintrag in der Statusleiste je App. Meist braucht das aber Main und IPC.

---

## 4. Tabelle je App

### Caption

| ID | Herkunft | Was der Bediener erlebt | Grundlage | Besteht auf main | Kat. | Fix |
|---|---|---|---|---|---|---|
| CA-1 | Bef. 1, F3, L2a Task 23, L2a Ruling 25/26 | Siehe Abschnitt 2. | laut Code | ja: `R/views/CaptionOberflaeche.tsx:110-120` | A | mittel; R, I |
| CA-3 | Bef. 3 | Das Feld für den NDI-Namen wirkt nicht auf den laufenden Sender. `ndi on` per Companion bei laufendem NDI startet ihn mit dem neuen Namen neu. | laut Code | ja, gemildert durch „Im Netz:“: `main/index.ts:133`, `:160-162` | C | klein; R (Hinweis) oder M |
| CA-4 | Bef. 4, F3 | Siehe Abschnitt 2. | abgeleitet | ja: `R/lib/ndi-engine.ts:82-86` | A | mittel; R |
| CA-5 | Bef. 5, F3 | Siehe Abschnitt 2. | abgeleitet | ja: `main/index.ts:237-244` | A | mittel; I, M, R |
| CA-6 | Bef. 6, F3 | Beim Stopp gehen die letzten Worte verloren, weil Main nach dem Stopp keine Äußerung mehr annimmt. Eine Äußerung in Arbeit kommt danach noch als Zeile an, „nutze CLI“ blitzt kurz auf. | abgeleitet | ja: `R/lib/capture.ts:112-113`, `main/index.ts:245-248` | B | mittel; M |
| CA-7 | Bef. 7, F3 | Fehlt das gewählte Modell, läuft still Base, und die Oberfläche zeigt weiter die gewählte Stufe. Der erste Aufruf nach einem Wechsel wartet bis 20 s; ein Wechsel auf CLI lässt den Server im Speicher. | laut Code | ja: `main/transcriber.ts:42-48` | B | klein bis mittel; M, R |
| CA-8 | Bef. 8 | Siehe Abschnitt 2. | laut Code | ja: `main/index.ts:215-220`, `R/views/Einstellungen.tsx:90`, `:112` | A | klein bis mittel; R, M |
| CA-11 | Bef. 11 | Siehe Abschnitt 2. | laut Code, nicht gemessen | ja: `main/index.ts:397-399` | A | klein; M |
| CA-12 | Bef. 12 | „Max. Äußerung“ und die Stille-Werte wirken erst beim nächsten Start der Aufnahme. Das Wörterbuch wird ohne Hinweis bei 800 Zeichen gekappt. | laut Code | ja: `R/views/CaptionOberflaeche.tsx:96-108`, `shared/prompt.ts:5`, `:14` | C | klein; R |
| CA-13 | Bef. 13 | Beim Start öffnet die App kurz das Mikrofon, ohne dass jemand „Start“ gedrückt hat. | laut Code | ja: `R/lib/capture.ts:27-41`, `R/views/CaptionOberflaeche.tsx:68-78` | C | klein; R |
| CA-17 | Bef. 17 | Ungenutzte Teile: `clearQueue`, `ndi.status`, `platform`, die Abmeldung von `onState`. | laut Code | ja: `main/transcriber.ts:55` | D | klein |
| CA-2 | Bef. 2 | NDI meldete nur, dass ein Prozess existiert. | laut Code | nein (behoben in 2a, E8: `main/ndi/wachhund.ts`) | – | – |
| CA-9 | Bef. 9 | Eine gemerkte Geräte-ID fehlt in der Liste. | laut Code | nein (2a: Statusleiste „Gerät nicht gefunden“; dass die Aufnahme scheitert statt still das Standardgerät zu nehmen, ist gewollt) | – | – |
| CA-10 | Bef. 10 | Der Start des Steuerservers wurde nicht gemeldet. | laut Code | nein (behoben in 2a, E2: `main/index.ts:378-391`) | – | – |

Nicht aufgenommen, weil umgesetzt oder Bestand: Bef. 14, 15, 16, 18.

### Interpreter

| ID | Herkunft | Was der Bediener erlebt | Grundlage | Besteht auf main | Kat. | Fix |
|---|---|---|---|---|---|---|
| IN-1 | Bef. 1 | Ein Gerätewechsel im Betrieb wirkt erst nach Stopp und Start. Seit 2a steht dazu ein Hinweis. | laut Code | ja: `R/core/engine.ts:150-157` | C | mittel; R (Neustart im Betrieb wäre neue Bedienlogik) |
| IN-3 | Bef. 3, F3, L2a Task 28/32 | Siehe Abschnitt 2. | abgeleitet | ja: `R/lib/oberflaeche.ts:374-382` | A | klein; R |
| IN-5 | Bef. 5 | Fehlt ein gemerkter Eingang, scheitert der Start mit der rohen Browser-Meldung. Die Anzeige „nicht verfügbar“ gibt es seit 2a. | laut Code | ja: `R/core/engine.ts:186-189`, `:213-216` | C | klein; R |
| IN-6 | Bef. 6, F3 | Das Fehlerband bleibt bis zum nächsten erfolgreichen Start stehen, auch nach Stopp, und zeigt den rohen Text. | laut Code | ja: `R/core/engine.ts:184-188` (gelöscht nur dort), `:192-210` (`stop` löscht nicht) | B | klein; R |
| IN-8 | Bef. 8, F3 | Siehe Abschnitt 2. | laut Code | ja: `R/store/settings.ts:23`, `R/core/engine.ts:136-142` | A | klein; S, Text |
| IN-10 | Bef. 10, F3 | Beim Start und bei jedem `devicechange` öffnet die App kurz das Standardmikrofon, solange keine Gerätenamen bekannt sind. | laut Code | ja: `R/core/engine.ts:66-78` | C | klein; R |
| IN-16 | Bef. 16 | Die Liste zeigt die Sammeleinträge „Standard - …“, und die Kabel-Erkennung greift auch auf sie. | abgeleitet | ja (laut Liste unverändert; `listDevices` in `R/core/engine.ts`) | C | klein; R |
| IN-T30 | L2a Task 30/31, Gesamtprüfung M6, F3 | Im Stillstand zeigt der Eintrag Ducking „offen“, seit der Gesamtprüfung grau. „Offen“ ist dabei nur der Ruhewert, nicht gemessen. | laut Code | ja: `R/lib/oberflaeche.ts:346` | B | klein; R, Text |
| IN-T31 | L2a Task 31 | Eine Ablehnung von `motor.stop()` bleibt unbehandelt. | laut Code | ja: `R/lib/aktionen.ts:67` | D | klein; R |
| IN-13 | Bef. 13 | `platform` ist ungenutzt. | laut Code | ja (laut Liste) | D | klein |
| IN-2 | Bef. 2 | Die Haupttaste war im Lauf gesperrt, wenn ein Eingang leer war. | abgeleitet | nein (seit 2a ist „– bitte wählen –“ nicht mehr wählbar, Ruling Task 31; die Regel steht noch in `R/lib/oberflaeche.ts:380`) | – | – |
| IN-4 | Bef. 4 | Der Text „Mix geht auf den Systemstandard“ war falsch. | abgeleitet | nein (Text in 2a korrigiert, E10) | – | – |
| IN-7 | Bef. 7 | Bypass war nicht erkennbar. | laut Code | nein (2a: „Überbrückt“, `R/views/LiveBereich.tsx:245-246`) | – | – |

Nicht aufgenommen: Bef. 9, 11, 12 und 15 (umgesetzt). Bef. 14 (Mac) steht in Abschnitt 5.

### Prompter

| ID | Herkunft | Was der Bediener erlebt | Grundlage | Besteht auf main | Kat. | Fix |
|---|---|---|---|---|---|---|
| PR-2 | Bef. 2, F3 | Startet die Handy-Fernbedienung nicht, etwa weil Port 7781 belegt ist, steht der Grund nur in `console.error`. Die Statusleiste sagt seit 2a „nicht gestartet“ ohne Grund. | laut Code | ja: `main/index.ts:153-164` | B | klein; M, I, R |
| PR-7 | Bef. 7, F3 | Die Vorschau stoppt nicht am Textende, nur das Ausgabefenster tut das. Ohne offenen Monitor läuft der Anker weiter, Companion meldet weiter `scrolling=1`, und ein später geöffneter Monitor endet sofort. | laut Code | ja: `R/views/LiveBereich.tsx:108` (kein `onEnd`), `R/components/PrompterScroller.tsx:80-85` | B | klein; R |
| PR-8 | Bef. 8 | `prompter:setConfig` prüft das Tempo nicht; nur Regler und Fernsteuerung begrenzen es. | laut Code | ja: `main/index.ts:343-349` | D | klein; M |
| PR-9 | Bef. 9 | Die Farben für Hintergrund, Text und Akzent wirken, lassen sich aber nirgends einstellen. | laut Code | ja: `shared/types.ts:46`, `:72` (kein Feld im Panel) | C | mittel; R (neue Funktion) |
| PR-10 | Bef. 10 | Die Capability nennt für `speed` die Vorgabe 2, Main kennt keine Vorgabe. | laut Code | ja: `packages/suite-control-protocol/src/capabilities.ts:323`, `main/index.ts:103-106` | D | klein |
| PR-11 | Bef. 11, F3 | Der Zeilenabstand ändert die Lesegeschwindigkeit, obwohl der Tempo-Wert gleich bleibt (em/s = Tempo × Zeilenabstand). | laut Code | ja: `main/index.ts:66-69` | C | klein (Text) bis mittel (Formel, M) |
| PR-13 | Bef. 13, F3 | Der Dateileser prüft weder Größe noch Typ; alles außer `.docx` wird als UTF-8 gelesen. | laut Code | ja: `main/docx.ts:10-13` | C | klein; M |
| PR-1 | Bef. 1 | „Talent-Monitor offen“ war geglaubt statt gemessen. | laut Code | nein (2a E3: gemessener Zustand, `R/lib/bruecken.ts:29-31`; das Store-Feld `outputOpen` ist ungenutzt) | – | – |
| PR-2b | Bef. 2 (Steuerport 8727) | Ein belegter Steuerport blieb unsichtbar. | laut Code | nein (2a E2: `main/index.ts:427-437`) | – | – |
| PR-5 | Bef. 5 | Der Filter ließ `SELECT` durch. | abgeleitet | nein (2a: `R/lib/oberflaeche.ts:236-241`; Leertaste auf Knöpfen nach O1 gewollt) | – | – |
| PR-12 | Bef. 12 | Es gab keinen Theme-Knopf und keinen Mac-Ziehbereich. | abgeleitet | nein (2a: AppShell; Mac ungemessen) | – | – |

Nicht aufgenommen: Bef. 3, 4 und 6 (Bauhinweise). Bef. 14 (nicht gemessen) steht in Abschnitt 5.

### Stage Display

| ID | Herkunft | Was der Bediener erlebt | Grundlage | Besteht auf main | Kat. | Fix |
|---|---|---|---|---|---|---|
| SD-1 | Bef. 1 | Siehe Abschnitt 2. | laut Code | ja: `R/views/LiveBereich.tsx:59-61`, `main/config.ts:52` | A | mittel; R |
| SD-3 | Bef. 3, F3, L2a Final | Siehe Abschnitt 2. | laut Code | ja: `main/index.ts:100-140` | A | mittel; M, R |
| SD-5 | Bef. 5, F3 | Siehe Abschnitt 2. | laut Code | ja: `R/views/Einstellungen.tsx:52-53`, `main/config.ts:13`, `R/lib/aktionen.ts:46` | S | klein bis mittel; R, M |
| SD-7 | Bef. 7, F3 | Nicht erreichbar, falsche PIN (401) und fehlende Fernsteuerung im Presenter zeigen alle „nicht gefunden“. Fehler von Datei, Show und mDNS stehen nur im Log. | laut Code | ja: `main/presenter-client.ts:81-86`, `main/index.ts:318-322` | B | mittel; M, I, R |
| SD-9 | Bef. 9 | Der Schalter „Uhr“ gilt nur für die kleine Uhr; die große Uhr in der Mitte bleibt immer. | laut Code | ja: `R/components/StageScreen.tsx:57`, `:95` | C | klein; R (Bühnenbild, bisher bewusst unangetastet) |
| SD-10 | Bef. 10, F3 | Schließt man das Hauptfenster, hält ein offener Bühnenschirm die App am Leben. Bedienen lässt sie sich dann nur über einen zweiten Start. | abgeleitet | ja: `main/index.ts:184-186`, `:327-329` (zweiter Start öffnet wieder: `:290-297`) | C | klein; M |
| SD-12 | Bef. 12 | Eine Show schaltet Quellen ein und setzt Host, Port und PIN, und das wird dauerhaft gespeichert. | laut Code | ja: `main/index.ts:246-266` (`patchConfig`) | C | klein bis mittel; M |
| SD-2 | Bef. 2 | „Bühnenschirm offen“ war geglaubt. | laut Code | nein (2a: gemessener Zustand, `R/lib/bruecken.ts:22`) | – | – |
| SD-4 | Bef. 4 | Der Port wurde bei jedem Tastendruck übernommen. | laut Code | nein (2a: `PeersSection` mit „Setzen“, `R/views/Einstellungen.tsx:38`) | – | – |

Nicht aufgenommen: Bef. 6, 8 und 11 (Aufbau bzw. gewollt nach „Wahl ≠ Bewegung“).

### Recorder

| ID | Herkunft | Was der Bediener erlebt | Grundlage | Besteht auf main | Kat. | Fix |
|---|---|---|---|---|---|---|
| RE-2 | Bef. 2, F3, L2a Task 18, L2a Final | Siehe Abschnitt 2. | laut Code | ja: `main/recorder.ts:213`, `R/store/recorder.ts:341-346`, `R/lib/oberflaeche.ts:375` | A | klein bis mittel; S, R |
| RE-2b | Bef. 2 | Siehe Abschnitt 2. | laut Code | ja: `R/store/recorder.ts:496-502` | A | klein; S |
| RE-3 | Bef. 3, F3, L2a Task 18 | Siehe Abschnitt 2. Fehlt das Addon, gibt es seit 2a den Eintrag „Audio-Modul fehlt“. | laut Code | ja: `shared/types.ts:13-24`, `main/recorder.ts:134-140` | A | mittel bis groß; M, I, S, R |
| RE-4 | Bef. 4 | Das Hinweisband „Gerät nicht gefunden“ und der Ordner-Hinweis werden nie neu geprüft. Sie verschwinden nur durch eigene Wahl oder „×“. | laut Code | ja: `R/store/recorder.ts:157`, `:392` | B | klein; S, R |
| RE-5 | Bef. 5 (Rest) | Das Dauerfeld ist nativ, ein leeres Feld wird 0. | laut Code | ja (laut Liste; Kanäle und Samplerate seit 2a NumberInput) | C | klein; R |
| RE-7a | Bef. 7 | Siehe Abschnitt 2. | laut Code | ja: `main/index.ts:123-126` | A | klein bis mittel; M, R |
| RE-7b | Bef. 7, F3, L2a Task 18 | Siehe Abschnitt 2. | laut Code | ja: `main/index.ts:34`, `R/store/recorder.ts:305-311`, `main/ipc.ts:37` | S | mittel; M, S |
| RE-8 | Bef. 8, L2a Task 18 | „Als Preset speichern…“, „Löschen“ und „⋯“ sind während der Aufnahme frei; nur Auswahl und „Zurücksetzen“ sind gesperrt. | laut Code | ja: `R/components/PresetLeiste.tsx:84` gegen `:119`, `:141`, `:181` | C | klein; R |
| RE-9 | Bef. 9 (Rest) | Die Uhr bleibt nach „Stopp“ auf dem Endwert stehen. | laut Liste | ja (Nr. 26; vielleicht gewollt) | C | klein; R |
| RE-10 | Bef. 10, F3, L2a Task 18 | Der Preset-Import entfernt unerlaubte Ordner still; die Meldung sagt es nicht. | laut Code | ja: `main/presets.ts:64-69`, `:98-102` | B | klein; M |
| RE-12 | Bef. 12 | Die Verstärkung hat drei Grenzen: Schieber und Store −12 bis 24 dB, Main −24 bis 36 dB. | laut Code | ja: `main/recorder.ts:63-67` | D | klein |
| RE-13 | Bef. 13, F3 | Ein gescheiterter Auto-Stopp meldet nichts. Meldungen des Stores teilen sich einen Toast-Platz. | laut Code | ja: `main/recorder.ts:447-452` | B | klein; M |
| RE-14 | Bef. 14 | „Spuren einzeln“ ist bei einem Kanal wirkungslos, ohne Hinweis. Nach einem Schreibfehler beim Auffüllen endet das Auffüllen, die Meldung kommt einmal. | laut Code | ja: `main/recorder.ts:315`, `:200-206` | C | klein; R, Text |
| RE-15 | Bef. 15, L2a Task 18 | Die README führt die 4-GB-Teilung noch als offen. | laut Code | ja (`apps/recorder/README.md`, laut Liste) | D | klein |

Nein, behoben in 2a: Bef. 1 (`init` bleibt in der Wurzel), Bef. 5 (Kanäle und Samplerate), Bef. 6 (Theme), Bef. 9 (Anordnung), Bef. 11 (rohe Farbe).

### Player

| ID | Herkunft | Was der Bediener erlebt | Grundlage | Besteht auf main | Kat. | Fix |
|---|---|---|---|---|---|---|
| PL-N | Nebenbefund 25.11., L2b Ruling 86 | Siehe Abschnitt 2. | gemessen, Ursache laut Code | ja: `R/store/player.ts:530-535`, `main/output-window.ts:61-114`, `:151-153`, `R/views/OutputView.tsx:49` | A | klein bis mittel; M oder I |
| PL-T13 | L2a Ruling Task 13, L2a Final, F3 | Siehe Abschnitt 2. | laut Code | ja: `main/output-window.ts:103-104`, `:117-122` | A | klein; M |
| PL-4 | Bef. 4 | Siehe Abschnitt 2. | laut Code | ja: `R/views/SoundboardView.tsx:48-58` | A | klein; R |
| PL-10 | Bef. 10, F3 | Siehe Abschnitt 2. | laut Code | ja: `R/views/ShowView.tsx:248` (einzige Rückfrage) | A | klein; R |
| PL-11 | Bef. 11, L2a Task 12 | Siehe Abschnitt 2. Den Teil „Stop in der Pause“ hat 2a behoben (`R/store/player.ts:582`). | abgeleitet | ja: `R/store/player.ts:555`, `:592-602` | A | mittel; S |
| PL-16a | Bef. 16 | Siehe Abschnitt 2. | laut Code | ja: `R/store/player.ts:494-499` | A | klein; S |
| PL-T14 | L2a Task 14 minor | Siehe Abschnitt 2. | laut Code | ja: `R/store/player.ts:513-516`, `:537` | A | klein; S, R |
| PL-16b | Bef. 16 | Das Companion-Verb `pad` zählt ab 0, die Oberfläche ab 1: `pad 1` löst „Pad 2“ aus. | laut Code | ja: `main/control-server.ts:78-79`, `packages/suite-control-protocol/src/capabilities.ts:216` | B | klein; M (Verb, Bedienlogik) |
| PL-13 | Bef. 13, F3, L2a Task 12 | Umsortieren der Playlist bei aktiver Suche tauscht die falschen Einträge, weil der sichtbare Index auf die ganze Liste trifft. | abgeleitet | ja: `R/views/LibraryView.tsx:203-210`, `:239-248` | B | klein; R |
| PL-18 | Bef. 18, F3, L2a Task 12 | Das Ausgabevideo kappt positives Gain auf 0 dB, die Tonmaschine verstärkt es. Derselbe Wert wirkt also je nach Art verschieden. | laut Code | ja: `R/views/OutputView.tsx:52` gegen `R/lib/show-audio.ts:46` | B | klein bis mittel; R (Ausgabeansicht) |
| PL-5 | Bef. 5 (Rest) | Companion `playing` und `playing_count` zählen Cues im Vorlauf mit, `playing` auch ein Video nach Alt+F4. ON AIR ist seit 2a und 2b davon frei. | laut Code | ja: `R/store/player.ts:49-58` (`computeRemoteState`) | B | klein; S (Bedienlogik Companion) |
| PL-12 | Bef. 12, F3, L2a Task 12 | Der Pad-Dialog setzt Gain und Farbe beim Speichern auf 0 und leer zurück. Beide lassen sich in der Oberfläche nicht einstellen. | laut Code | ja: `R/views/SoundboardView.tsx:242-249`, `main/library.ts:348-355` | C | klein; R |
| PL-6 | Bef. 6 | `standby_label` an Companion ist der Medientitel, nicht die Cue-Beschriftung. | laut Code | ja: `R/store/player.ts:50` | C | klein; S |
| PL-15 | Bef. 15 (Rest) | Unbekannte Verben und ungültige Zahlen werden still verworfen. | laut Code | ja: `main/control-server.ts:85-86` | C | klein; M |
| PL-17 | Bef. 17 (Rest) | Pads und Cue-Zeilen sind `div` mit Klick und per Tastatur nicht erreichbar. | laut Code | ja: `R/views/SoundboardView.tsx:153-154` | C | mittel; R |
| PL-14 | Bef. 14, L2a Task 12 | Die CSP nennt das Schema `jm-media:`, es heißt aber `jmedia`. Medien laufen trotzdem, weil das Schema mit `bypassCSP` registriert ist. | laut Code | ja: `main/index.ts:72` gegen `shared/media-url.ts:5` | D | klein; M |
| PL-T14b | L2a Task 14 minor | `panikDerShow` übersprünge `clearShowTimers`, wenn `output.command` synchron würfe. Praktisch unerreichbar, weil IPC ein Promise liefert. | laut Code | ja: `R/store/player.ts:32-37` | D | klein; S |
| PL-1 | Bef. 1 | Panik stoppte die Pads nicht. | laut Code | nein (2a W2-10: `R/store/player.ts:585-590`) | – | – |
| PL-2 | Bef. 2, 2a-Frage 1 | Panik stoppt die Vorschau der Bibliothek nicht. | laut Code | nein (Owner 23.11.: so lassen) | – | – |
| PL-3/7/8/9 | Bef. 3, 7, 8, 9 | Leertaste und Escape bei offenem Panel; Stop und Panik nur in der Cue-Show; Ausgabe geglaubt; Beschriftung „GO ⏎“. | laut Code | nein (behoben in 2a: O1, Fußleiste, gemessener Zustand, ⏎ entfernt) | – | – |
| PL-15a/17a | Bef. 15, 17 | Belegter Port 8725 unsichtbar; Escape schloss keinen Dialog. | laut Code | nein (2a: Fernsteuerungs-Meldung `main/index.ts:188-197`; Modal aus `@jm/ui` schließt mit Escape, `packages/ui/src/components/Modal.tsx:68-72`) | – | – |
| PL-AltF4 | L2a Final parked | Nach Alt+F4 und Wiederöffnen zählte das alte Video für ON AIR. | laut Code | nein (behoben in 2b, Task 6/W74: `R/lib/oberflaeche.ts:142-149`) | – | – |

### Presenter

| ID | Herkunft | Was der Bediener erlebt | Grundlage | Besteht auf main | Kat. | Fix |
|---|---|---|---|---|---|---|
| PS-10 | Bef. 10, L2b Ruling 76 | Siehe Abschnitt 2. | gemessen | ja: `R/lib/oberflaeche.ts:684-687` | A | klein; R |
| PS-15 | Bef. 15, F3 | Siehe Abschnitt 2. | abgeleitet | ja: `main/remote-page.ts:142`, `main/present.ts:145-150` | A | klein; M |
| PS-18 | Bef. 18 | Siehe Abschnitt 2. | laut Code | ja: `main/present.ts:145-150`, `main/control-server.ts:73-74` | A | klein; M |
| PS-7b | Bef. 7 (Handy-Teil) | Die Handy-Seite sperrt „Weiter“ auf der letzten Folie, auch mit Schleife, und zeigt „Ende der Präsentation“. B13 hat nur den Referenten geheilt. | laut Code | ja: `main/remote-page.ts:121`, `:123` | B | klein; M (die Seite ist HTML im Main) |
| PS-12 | Bef. 12 | „Publikum Vollbild“ zeigt keinen Zustand; der Umschalter liefert ein Ergebnis, das niemand liest. | laut Code | ja: `main/windows.ts:256-261`, `R/lib/useStand.ts:302`, `R/views/ReferentLeiste.tsx:90` | B | klein; R, I |
| PS-16 | Bef. 16, F3 | Nach „Port … ist belegt“ startet ein neuer Port mit „Setzen“ den Handy-Server nicht, und der Fehlertext verschwindet. Nur der Server-Schalter hilft. | abgeleitet | ja: `R/components/RemotePanel.tsx:92-98` (`enabled` aus `running`) | B | klein; R |
| PS-17 | Bef. 17, F3 | Die Gast-Klick-Pille sagt bei „verbindet“ und „abgelehnt“ gleichermaßen „Gast-Klick getrennt“. | laut Code | ja: `shared/gast-klicker.ts:69-73` | B | klein; R, Text |
| PS-25 | Bef. 25, F3 | Der Mauszeiger bleibt im Publikumsfenster sichtbar. | abgeleitet | ja: `R/views/AudienceView.tsx` (kein Ausblenden) | B | klein; R (Ausgabeansicht) |
| PS-26 | Bef. 26, F3 | Die Laufzeit-Uhr zählt ab dem Öffnen des Referenten und fällt bei Strg+R auf 0 zurück. | abgeleitet | ja: `R/components/Clock.tsx:15-18` | B | klein bis mittel; R (Startzeit aus Main: I) |
| PS-13 | Bef. 13 (Rest) | „PDF-Export“ ist ohne Grund gesperrt. Haupttaste, Zurück und Weiter tragen seit 2b einen Grund. | laut Code | ja: `R/components/Toolbar.tsx:83` | C | klein; R |
| PS-19 | Bef. 19 | Handy und Gast-Klicker sind nur im Referenten einstellbar, also nur während einer Präsentation; Timer-Sync und Import nur im Editor. | laut Code | ja (laut Liste, Aufbau unverändert) | C | mittel; R |
| PS-21 | Bef. 21, F3 | „Öffnen“ ersetzt ein ungespeichertes Projekt ohne Rückfrage, anders als „Neu“ und Ablegen per Maus. „✕“ löscht eine Folie, „Entfernen“ ein Overlay, ohne Rückgängig; Schließen des Editors fragt nicht. Eine laufende Präsentation trifft das nicht, weil sie beim Start eine Kopie bekommt. | laut Code (Schließen abgeleitet) | ja: `R/store/project.ts:291-295` gegen `:233-236` und `R/components/Toolbar.tsx:56-66`; `R/components/SlideList.tsx:67-72`; `R/components/Inspector.tsx:78` | C (Verlust von Vorbereitung, nicht im Lauf) | klein (R); Schließen mittel (M) |
| PS-27 | Bef. 27, F3 | „Konvertiere mit LibreOffice…“ steht schon, während der Dateidialog offen ist. | laut Code | ja: `R/store/project.ts:207` | C | klein; R |
| PS-28 | Bef. 28, F3 | Overlays sind fokussierbar, haben aber keine Taste zum Verschieben oder Löschen. | laut Code | ja: `R/components/EditorStage.tsx:108-125` | C | mittel; R |
| PS-7/8 | Bef. 7 (Referent), Bef. 8 | Weiter trotz Schleife gesperrt; Kürzel wirkten aus Textfeldern. | gemessen | nein (behoben in 2b, B13 und B10: `R/lib/oberflaeche.ts:547`, `:596-614`) | – | – |
| PS-11 | Bef. 11 | Die Bildschirmwahl verschob sofort, die Liste blieb alt. | abgeleitet | nein (2b B11: `main/index.ts:63`) | – | – |
| PS-14 | Bef. 14 | Fernsteuerung und Master-Link ohne Meldung. | gemessen | nein (2b Task 8) | – | – |
| PS-23/24 | Bef. 23, 24 | Thema fest dunkel; rohe Farben. | laut Code | nein (2b: AppShell mit ThemeToggle, `R/views/EditorOberflaeche.tsx:1-41`) | – | – |

Nicht aufgenommen: Bef. 1 bis 6 (Messungen), Bef. 9 (O1 gewollt), Bef. 20 (Bauhinweis). Bef. 22 (Mac) steht in Abschnitt 5.

### Studio-Control

| ID | Herkunft | Was der Bediener erlebt | Grundlage | Besteht auf main | Kat. | Fix |
|---|---|---|---|---|---|---|
| SC-S1 | F3 (sicherheitsrelevant), W132, L2b Ruling 69 | Siehe Abschnitt 2. | gemessen und laut Code | ja: `main/server.ts:133`, `:1082` | S | mittel; M |
| SC-S2 | Bef. 4, F3 | Siehe Abschnitt 2. | gemessen, laut Code (CORS: eigene Lesung) | ja: `main/auth/middleware.ts:11-44`, `:76-82`, `main/server.ts:1054` | S | mittel bis groß; M, R |
| SC-S3 | Bef. 11, F3 | Siehe Abschnitt 2. | laut Code | ja: `main/gateway/control-gateway.ts:317-339` | S | klein; M |
| SC-5 | Bef. 5, F3, L2b Minor 20 | Ein ATEM ohne Gegenstelle oder nach einem Abriss bleibt dauerhaft bei „verbindet …“ und meldet nie „getrennt“ (gemessen 82 s). | gemessen | ja: `main/drivers/atem/client.ts:17-31` (`disconnected` → `connecting`) | B | klein bis mittel; M (Treiber) |
| SC-8 | Bef. 8, F3, L2b Minor 20 | Scheitert ein Befehl am Gerät (ATEM, OBS, TriCaster, PTZ) oder ein Formular, steht das nur in der Konsole. Auch ein gescheitertes Rollen-„Setzen“ bleibt still. | laut Code | ja: `R/components/video/AtemPanel.tsx:46-53`, `R/components/video/PtzPanel.tsx:126-133`, `R/components/setup/UserManager.tsx:75-78` | B | mittel; R (neue Anzeige) |
| SC-11b | Bef. 11, F3 | TriCaster REC und STREAM senden nur die Start-Kürzel; aus der App lässt sich nichts stoppen. Seit 2b steht der Hinweis „ohne Rückmeldung“ dabei. | laut Code | ja: `R/components/video/TricasterPanel.tsx:31` | B | klein bis mittel; R (Bedienlogik) |
| SC-LT | 2b-F2, F3, L2b Minor 18 | Die Leertexte „Noch kein … konfiguriert“ stehen schon vor der ersten Server-Meldung. Der Audio-Leertext „Noch kein Pult verbunden“ meint „eingerichtet“. | laut Code | ja: `R/components/audio/AudioPanel.tsx:148`, `R/components/video/AtemPanel.tsx:117`, `R/components/video/ObsPanel.tsx:114` | B | klein; R, Text |
| SC-6 | Bef. 6, F3 | Bei 1024×640 liegen „Save“, „Hinzufügen“ und „Abbr.“ im Inventar rechts außerhalb des Fensters, erreichbar nur mit waagerechtem Scrollen. | gemessen | ja: `R/components/setup/DeviceTable.tsx:112-220` | C | klein; R |
| SC-EN | 2b-F2 | Englische Reste: „Scanning“, „Save“, die Rollen admin, operator und viewer, die Makro-Namen, die DDR-Tooltips „Play“, „Pause“, „Stop“ und „login failed“. Rohe Gerätefehler wie „connect ETIMEDOUT …“ stehen jetzt sichtbar in den Pillen. | laut Code | ja: `R/components/setup/DiscoverPanel.tsx:93`, `R/components/setup/DeviceTable.tsx:141`, `R/components/setup/UserManager.tsx:15`, `R/components/video/DdrPanel.tsx:51`, `:60`, `:69`, `R/views/Login.tsx:31`, `R/lib/oberflaeche.ts:178` | C | klein; Text (Gerätefehler: Übersetzungstabelle, R) |
| SC-10b | Bef. 10, F3 | Die Leerzustände schicken Betrachter „ins Setup“, das sie nicht öffnen dürfen. | laut Code | ja: `R/components/video/AtemPanel.tsx:125`, `ObsPanel.tsx:122`, `PtzPanel.tsx:235`, `R/components/audio/AudioPanel.tsx:159` | C | klein; Text |
| SC-12 | Bef. 12, F3 | Der Tray-Eintrag „Fenster anzeigen“ wird nie nachgeführt. Die LAN-URLs zeigen ungepackt den Vite-Port 5174. | laut Code | ja: `main/index.ts:125-133`, `main/server.ts:1129-1132` | C | klein; M |
| SC-10 | Bef. 10, F3 | Toter Code: die Status-Zweige `tricaster/ptz/audio:status`, `remote.getUrls`, `remote.getAddresses`, `closeWindow`, `/api/me`, `/api/audit`, `stopServer`, `gatewayStatus()`. | laut Code | ja: `R/App.tsx:68-70` (laut Liste), `main/server.ts:1107` | D | klein; M, R |
| SC-9, SC-10a, SC-11a | Bef. 9, 10, 11 | Rollenwahl wirkte sofort; `ComingSoon` und Kumo-Hinweise; Lage des Gateways unsichtbar. | laut Code | nein (behoben in 2b: „Setzen“, gelöscht, Statusleiste) | – | – |

Nicht aufgenommen: Bef. 1, 2, 3, 7 und 13 (Messungen). SC-PTZ steht in Abschnitt 5.

### Connect

| ID | Herkunft | Was der Bediener erlebt | Grundlage | Besteht auf main | Kat. | Fix |
|---|---|---|---|---|---|---|
| CN-MV | L2b Ruling 76 | Siehe Abschnitt 2. | abgeleitet | ja: `R/zoom/ZoomCard.tsx:146-153`, `:290` | A | klein; R |
| CN-13a | Bef. 13, F3 | Die Companion-Variable `connected` (SFU verbunden) meldet niemand; Knöpfe darauf zeigen nie „verbunden“. | laut Code | ja: `packages/suite-control-protocol/src/capabilities.ts:661` gegen `main/control-state.ts:12` | B | klein; M |
| CN-14 | Bef. 14, F3 | Einige Zustände des Zoom-Kerns erreichen die Oberfläche nicht. Dazu gehören ein gescheiterter Wiederbeitritt und sein Anlass, eine misslungene JWT-Erneuerung, ersetzte Laufzeit-Dateien, ein unvollständiges Aufräumen und die 5-Slot-Zustimmung. | abgeleitet | ja: `main/zoom/kern.ts:944`, `:1015`, `:1149`, `:1828`, `:1855` (nur `d.log`) | B | mittel; M, I, R |
| CN-6 | Bef. 6 | Wer im Standby steht, zeigt die Oberfläche nicht; nur Companion sieht es über STATE. Plan C1-A: bewusst so gelassen. | gemessen | ja: `R/views/ConnectOberflaeche.tsx:200` | B | klein; R |
| CN-BV | L2b Final Minor 52 | Der Bild-Versatz wird schon beim Verlassen des Felds übernommen und wirkt auf laufende Slots. | laut Code | ja: `R/zoom/ZoomCard.tsx:321-324` | B | klein; R |
| CN-108 | Liste Nr. 108, F3, L2b Minor 22 | Fehler aus „Raum öffnen“, Einladen und „Raum schließen“ tragen Electrons englischen Vorsatz „Error invoking remote method '…': Error: “. Der Launcher filtert ihn bereits. | abgeleitet | ja: `R/views/ConnectOberflaeche.tsx:292`, `:306`, `:321`, `:345`; Vorbild `apps/launcher/src/renderer/src/lib/verbund-texte.ts:44-47` | C | klein; R |
| CN-10 | Bef. 10, F3 | 📊, die Gast-Aktionen, „Link erzeugen“ und „Sprecher einladen“ sind ohne Raumverbindung gesperrt, ohne sichtbaren Grund. | laut Code | ja: `R/views/CloudRaum.tsx:191`, `:251`, `:324`, `:548-566` | C | klein; R |
| CN-9 | Bef. 9, F3 | Ohne Raum öffnet Connect selbst Verbindungen: mDNS-Suche nach JM Presenter und Anwesenheit beim Launcher alle 10 s. Zu sehen ist davon nichts. | gemessen | ja: `main/presenter-link.ts:33-77`, `packages/app-runtime/src/index.ts:327-372` | C | klein; M (eher Entscheid als Fix) |
| CN-13b | Bef. 13, F3 | „Ablehnen“ und „Stumm“ haben kein Fernsteuer-Verb, „Stumm“ auch keinen Knopf. | laut Code | ja (Capability ohne `deny` und `mute`, `capabilities.ts:632-661`) | C | mittel; M, Capability |
| CN-13c | Bef. 13, F3 | Das Tray-„Raum schließen“ ist nur mit mindestens einer NDI-Gastquelle aktiv, bei offenem Raum ohne Gast also gesperrt. | abgeleitet | ja: `main/tray.ts:88` | C | klein; M |
| CN-5 | Bef. 5 (Rest) | Das Programm-Abzeichen ist immer abgeschnitten, auch „Programm: aus“; der volle Text steht nur im Tooltip. Die Zugangszeile ist in der Statusleiste gekürzt. | gemessen | ja: `R/views/CloudRaum.tsx:410-418` | C | klein; R |
| CN-13d | Bef. 13 | Der Kanal `jmc:program-status` ist ungenutzt. | laut Code | ja: `shared/ipc.ts:34-35` (laut Liste) | D | klein |
| CN-3/4/7/11 | Bef. 3, 4, 7, 11 | Bildlaufleiste verschob alles; Live-Tasten unter dem Rand; Talkback nur per Zeiger; Wahl wirkte sofort. | gemessen | nein (behoben in 2b) | – | – |

Nicht aufgenommen: Bef. 1, 2, 8 und 12 (Messungen und Grenzen).

---

## 5. Nicht geklärt

| ID | Was offen ist |
|---|---|
| SC-PTZ | **Studio-Control, PTZ-Loslassen nach einem Kamerawechsel** (L2b Ruling 76: „Altbestand“). Der Codeweg besteht: `exec` nimmt die Kamera, die beim Loslassen gewählt ist (`R/components/video/PtzPanel.tsx:126-131`). Wäre das eine andere als beim Drücken, führe die alte Kamera weiter, Kategorie A. Ob man über die Oberfläche hinkommt, ist offen: Ein Klick auf die Auswahl nimmt der Taste den Fokus und löst das Loslassen vermutlich vorher aus. Denkbar ist eine Inventar-Änderung von einem zweiten Client während des Haltens. |
| PL-T12 | **Player, README ohne Codec-Hinweis und ungenutzte Preload-Funktionen** (L2a Task 12). Nicht nachgelesen. |
| IN-14, PS-22, PR-12 | **Mac-Rahmen und Ampel** sind in keiner App gemessen. Für Caption gilt dasselbe: CA-11 ist nur laut Code belegt. Stand Stufe 2: Der Fix für CA-11 ist nur per Test belegt, nicht auf dem Mac gemessen (Festlegung C2). |
| PR-14 | **Prompter, nicht gemessen:** nativer Dateidialog im gepackten Build, Leertaste auf fokussierten Knöpfen, QR bei sehr langem Token, mDNS-Sichtbarkeit. |
| IN-3 | **Interpreter, Wirkung des Doppelstarts** ist nicht gemessen. Laut Code laufen zwei `start()` ineinander; ob dann zwei Mixe auf den Ausgang gehen, ist offen. Der 2a-Prüfer schrieb „Befund 3 unterschätzt Doppelklick“. Stand Stufe 2: Mit dem Fix ist der Doppelklick im echten Fenster gemessen (Task 2, Fake-Mikrofon: 2 statt 4 Geräteanfragen, ein Start); wie sich der alte Doppelstart auf den Ausgang auswirkte, ist weiter nicht gemessen. |
| RE-3 | **Recorder:** Was das Audio-Addon tut, wenn der Rückruf wirft, und wie weit `status` bei Geräteverlust zurückgeht, ist nicht gemessen. Stand Stufe 2: Kein Schreibfehler erreicht das Addon mehr (Festlegung B2), Geräteverlust erkennt ein Wächter nach 2 s ohne Blöcke (B1); am echten Datenträger und mit echtem Gerät prüft das erst die Abnahme (AR7 bis AR9). |
| SC-S2 | **Studio-Control:** Ob eine Webseite im Browser des Regie-Rechners die Loopback-Admin-Rechte über Socket.IO tatsächlich nutzen kann, hängt vom Browser-Schutz für lokale Netze ab. Nicht gemessen, nur aus dem Code abgeleitet. |
| SD-1, PS-10, CN-9, CN-6 | **Gewollt oder Altfehler?** Hier beschreibt die Funktionsliste Verhalten ohne Fehlerwertung (live getippte Nachricht, Esc beendet, Netz beim Start, Standby ohne Anzeige). Ob das Altfehler sind, muss der Owner sagen. Stand Stufe 2: Entschieden sind SD-1 (Altfehler, behoben, Owner 25.11. Frage 7 B) und PS-10 (gewollt, kein Altfehler, Frage 5 A); CN-9 und CN-6 sind offen. |
| L2b Minor 50 | **Presenter:** „Timer unerreichbar → anderes Fenster alter Stand; scheitert `getConfig`, tut der Schalter still nichts“ (`R/lib/useStand.ts:327-328`). Ob das vor 2b schon so war, ist nicht geklärt. Nicht aufgenommen. |

**Bewusst nicht aufgenommen, weil die Wellen es selbst eingeführt haben:**
- die Folgen aus 2a-Frage 2: ON AIR bleibt „an“ über stillem Ton nach einem Video-Start in der Pause;
- L2b Release-Minor 58: ON AIR schon bei `loadedmetadata`, 13 bis 16 ms vor dem Abspielen;
- L2b Final M5: Studio-Control-Haupttasten nur über den Listenindex gepaart;
- die Raum-Taste von Connect ohne Doppelklick-Sperre (W116, Owner Z1 A).

**Eigene Beobachtung außerhalb der Quellen, nicht gezählt:** Connect „Entfernen“ eines Gasts hat keine Rückfrage (`R/views/CloudRaum.tsx:557`, `:566`).

---

## 6. Zusammengeführte Doppel

| Eintrag | zusammengeführte Quellen |
|---|---|
| CA-1 | Caption Bef. 1 · 2a-F3 · L2a Task 23 (Altfehler-Liste) · L2a Ruling Task 25/26 (`micError` bleibt) · L2a Final declined „Caption micError (CAZ2)“ |
| CA-4, CA-5, CA-6, CA-7 | Caption Bef. 4 bis 7 · 2a-F3 · L2a Task 23 |
| CA-8 | Caption Bef. 8 · L2a Task 23 („leeres Zahlenfeld wird 0“) |
| CA-11 | Caption Bef. 11 · L2a Task 23 („Mac running ohne Fenster“) |
| IN-3 | Interpreter Bef. 3 · 2a-F3 · L2a Task 28 und Task 32 („Befund 3 unterschätzt Doppelklick“) |
| IN-T30 | 2a-F3 („Prüfung Task 30“) · L2a Task 30 · L2a Task 31 („Floor offen im Stillstand, vertagt“) · L2a Final M6 (Ton `off`) |
| PR-2, PR-7, PR-11, PR-13 | Prompter Bef. 2, 7, 11, 13 · 2a-F3 |
| SD-3 | Stage Bef. 3 · 2a-F3 · L2a Final declined („Stage-mDNS ersetzt Host, Altfehler“) |
| SD-5, SD-7, SD-10 | Stage Bef. 5, 7, 10 · 2a-F3 |
| RE-2 | Recorder Bef. 2 · 2a-F3 · L2a Task 18 · L2a Final declined („Recorder ARM/Eingang schließen, Altfehler, U6“) |
| RE-3, RE-7b, RE-8, RE-10, RE-15 | Recorder Bef. 3, 7, 8, 10, 15 · L2a Task 18 („kein Fehlerfeld“, „Netzwerkordner-Rückfrage nur beim Import“, „Preset-Knöpfe nicht gesperrt“, „Import verwirft Ordner“, „README“) · 2a-F3 für 3, 7, 10 |
| PL-T13 | 2a-F3 („Ruling Task 13“) · L2a Ruling Task 13 · L2a Final declined („zweites Player-Ausgabefenster, Altfehler“) |
| PL-11, PL-12, PL-13, PL-14, PL-18 | Player Bef. 11 bis 14 und 18 · L2a Task 12 (Zusatzbefunde: CSP, Gain, Pad-Dialog, Umsortieren, Stop in Pause) · 2a-F3 für 10, 12, 13, 18 |
| PL-N | Auftrag (Nebenbefund 25.11.) · L2b Ruling 86 |
| PS-15 bis PS-17, PS-21, PS-25 bis PS-28 | Presenter Bef. 15 bis 17, 21, 25 bis 28 · 2b-F3 |
| SC-S1 | 2b-F3 („sicherheitsrelevant, gemessen Task 14“) · W132 · L2b Ruling 27 (Messaufbau Admin/Admin) · L2b Ruling 69 |
| SC-S2 | Studio-Control Bef. 4 · 2b-F3 („jeder Befehl am Server als Admin“) |
| SC-S3, SC-11b | Studio-Control Bef. 11 · 2b-F3 („Gateway liest control.json nicht …, REC und STREAM nur Start-Kürzel“) |
| SC-5 | Studio-Control Bef. 5 · 2b-F3 · L2b Minor 20 („Befund 5 erledigt zu stark, ATEM erreicht nie `down`“) |
| SC-8 | Studio-Control Bef. 8 · 2b-F3 · L2b Minor 20 („UserManager … fehlgeschlagenes Setzen völlig still“) |
| SC-LT | 2b-F2 (Audio-Leertext) · 2b-F3 (Konfig-Leertexte vor der ersten Server-Meldung) · L2b Minor 18 · L2b Ruling 66 |
| SC-EN | 2b-F2 · L2b Ruling 66 · Owner 25.11. (Frage 2 ins Altfehler-Thema) |
| CN-108 | 2b-F3 (Liste Nr. 108) · L2b Minor 22 („IPC-Fehler mit Electron-Vorsatz“) · Funktionsliste Bef. 12 (Vorsatz in den Messungen) |
| CN-9, CN-10, CN-13a bis CN-13c, CN-14 | Connect Bef. 9, 10, 13, 14 · 2b-F3 |

## 7. Kandidaten für eine spätere Runde (beim Bau von Stufe 1 und Stufe 2 aufgefallen, nicht behoben)

Keine geprüften Befunde, nur Beobachtungen der Prüfer an Studio-Control und, seit der Gesamtprüfung der Stufe 1 (Ruling R19), am Player; jede braucht eine eigene Prüfung, bevor sie ein Befund wird. Sie sind nicht in der Zählung. PL-K1 ist ein Show-Risiko und steht darum zuerst für Stufe 2 an.

Stand Stufe 2: PL-K1 und PL-K2 sind auf `feat/altfehler-stufe2` behoben (Vermerk in der Zeile). Neu dazu kommen die Kandidaten aus dem Bau der Stufe 2 (CA-K1, CA-K2, CN-K1, RE-K1, RE-K3 bis RE-K7; RE-K2 ist nicht vergeben) und aus ihrer Gesamtprüfung (RE-K8, LA-K1). RE-K4 bis RE-K7 sind die Punkte 2 bis 5 der 0.9.2-Liste aus PR #296, im Wortlaut der Liste; nach Spec 8 sind sie Kategorie B bis D und darum hier statt im Plan. Punkt 1 der Liste, die langsame NAS-Prüfung, die das nächste Preset aufhält, ist RE-NAS und behoben (Abschnitt 0b).

| ID | Kandidat | Grundlage | Beleg |
|---|---|---|---|
| SC-K1 | **Studio-Control, ein entfernter ATEM schickt kein neues `atem:state`.** Nach dem Entfernen bleibt die Anzeige des Fensters beim alten Zustand, bis etwas anderes ihn erneuert. | Altverhalten, bei Task 6 beobachtet, nicht nachgelesen | offen |
| SC-K2 | **Studio-Control, `setWindowOpenHandler` gibt jedes Schema an `shell.openExternal`.** Ein Link mit einem anderen Schema als `http` oder `https` ginge ans Betriebssystem. | Altverhalten, laut Code | `main/index.ts:95-98` |
| SC-K3 | **Studio-Control, eine ins Fenster gezogene Datei navigiert weg.** Das Fenster verlässt die App und zeigt die Datei; das ist Bedienung, nach Ruling R13 keine Sicherheitslücke mehr. | Beobachtung, nicht gemessen | `main/index.ts` (kein `will-navigate`-Schutz) |
| SC-K4 | **Studio-Control, `loadMain` lädt `ELECTRON_RENDERER_URL` auch im Paket.** Ist die Umgebungsvariable gesetzt, zeigt das gepackte Fenster eine fremde Adresse; das Geheimnis geht dorthin nicht (R13). | laut Code | `main/index.ts:57-64` |
| PL-K1 | ✅ *behoben auf `feat/altfehler-stufe2`, Task 1* · **Player, ein Cue im Vorlauf gelöscht spielt später trotzdem.** `removeShowCue` stoppt den Ton und nimmt die ID aus der Liste, räumt aber den Vorlauf-Zeitgeber nicht; nach Ablauf startet der gelöschte Cue. | Gesamtprüfung, laut Code (R19) | `R/store/player.ts` (`removeShowCue`, `vorlaeufe.starte`) |
| PL-K2 | ✅ *behoben auf `feat/altfehler-stufe2`, Task 1 (mit „Weiter“ nach dem natürlichen Ende, P3)* · **Player, GO ohne Vorlauf in der Pause lässt ein pausiertes Ausgabevideo stehen.** Der Start hebt die Pause auf (A1), schickt der Ausgabe aber kein `resume`; ein angehaltenes Video bleibt stehen, während die Show als laufend gilt. | Gesamtprüfung, laut Code (R19) | `R/store/player.ts` (`startNow`) |
| PL-K3 | **Player, ein entferntes Medium verschwindet still aus den Playlists.** Die Rückfrage (PL-10) zählt nur Cues und Pads; Einträge in Playlists löscht der Fremdschlüssel ohne Hinweis (`ON DELETE CASCADE`). | Gesamtprüfung, laut Code (R19) | `packages/media-library/src/schema.ts` (`playlist_items`), `main/library.ts` (`mediumNutzung`) |
| PL-K4 | **Player, die Rückfrage „Cue löschen“ bleibt bei einem Show-Wechsel offen.** Lädt Companion (`loadShow`) eine andere Show, während das Fenster offen ist, löscht „Entfernen“ den genannten Cue aus der vorigen Show; die Frage passt dann nicht mehr zur sichtbaren Show. | Nachprüfung der Fix-Welle, laut Code | `R/views/ShowView.tsx` (Rückfrage-Zustand), `R/store/player.ts` (`loadShow`) |
| PL-K5 | **Player, Pause während des Wartens auf „bereit“ verschluckt das Einblenden.** Mit Einblendzeit läuft die Rampe aus `load` unter dem sofort folgenden `pause` weiter; nach „Weiter“ kommt das Video ohne Einblenden mit voller Lautstärke. Gleiche Art wie Pause während einer Blende. | Nachprüfung der Fix-Welle, laut Code | `R/store/player.ts` (K5), `R/views/OutputView.tsx` (`load`) |
| CA-K1 | **Caption, ein Mikrofon, das mitten im Lauf ausfällt, meldet keinen Fehler.** CA-1 deckt nur den Start: Fällt die Spur später weg (Gerät abgezogen), bleibt `running=1`, und es kommt nur keine Zeile mehr. | Festlegung C3, laut Code | `R/lib/capture.ts` (kein Hörer auf das Ende der Spur) |
| CA-K2 | **Caption, jeder Start fragt das Mikrofon zweimal an.** Die Antwort auf `caption:start` und die Übertragung des Zustands setzen die Konfiguration je einmal neu; der Effekt läuft ein zweites Mal, der erste Versuch gilt als abgebrochen. Kein Neustart nach einem Fehler, aber eine doppelte Geräteanfrage je Start (Altbestand). | gemessen (Task 4, zwei Anfragen je Start) | `R/views/CaptionOberflaeche.tsx` (Effekt hängt an `cfg`) |
| CN-K1 | **Connect, „Ja, verlassen“ verfällt nie.** Die Rückfrage an „Meeting verlassen“ bleibt stehen, bis jemand klickt; ein Klick viel später verlässt das Meeting ohne neue Frage. CN-MV sperrt nur die erste Sekunde. | Festlegung P6, laut Code | `R/zoom/verlassen.ts` (`frageSeit` ohne Ablauf), `R/zoom/ZoomCard.tsx` |
| RE-K1 | **Recorder, die Show-Datei wird synchron gelesen.** Der Hauptprozess liest die `.jmshow` mit `readFileSync`, und beim Start einer Aufnahme legt er den Zielordner synchron an und prüft Dateinamen mit `existsSync`; ein langsames NAS hält dabei den Hauptprozess an. RE-7b hat nur die Prüfung des gemerkten Ordners asynchron gemacht. | Festlegung B4, laut Code | `main/index.ts` (`applyShowFromDeepLink`), `main/recorder.ts` (`mkdirSync`, `freierBasisname` mit `existsSync`) |
| RE-K3 | **Recorder auf dem Mac ohne Schutz durch die Rückfrage.** Bei Cmd+Q melden Presence-bye und Master-Link-Stopp in `before-quit` den Recorder schon vor der Frage ab; wählt man „Weiter aufnehmen“, gilt er im Verbund als weg. Abmelden und Herunterfahren fragen auf dem Mac nach, statt ohne Frage abzuschließen. Gebaut und ausgeliefert wird der Recorder nur für Windows (Ruling S2-R14, S2-R19). | Prüfung Task 7, laut Code, nicht auf dem Mac gemessen | `main/index.ts` (`before-quit`, `powerMonitor` nur unter Linux), `packages/app-runtime/src/index.ts` (`before-quit`) |
| RE-K4 | **Recorder, Fehlertexte von „Preset speichern“ und „Preset löschen“ mit englischem Präfix** (0.9.2-Liste, Punkt 2). Scheitert `presets:speichern` oder `presets:loeschen`, steht in der Meldung Electrons Vorsatz „Error invoking remote method '…': Error: “ hinter „Preset konnte nicht gespeichert werden: “ bzw. „… gelöscht werden: “, wie CN-108 in Connect. | PR #296, am Code bestätigt | `R/store/recorder.ts` (Meldungen mit `(e as Error).message` nach `presets.speichern`/`presets.loeschen`), `main/ipc.ts` (`presets:speichern`, `presets:loeschen`) |
| RE-K5 | **Recorder, `PresetDateiErgebnis.netzwerk` hat keinen Nutzer mehr** (0.9.2-Liste, Punkt 3). Das Feld ist im Vertrag noch deklariert, wird aber weder gesetzt noch gelesen. | PR #296, am Code bestätigt (grep) | `shared/types.ts` (`PresetDateiErgebnis.netzwerk`) |
| RE-K6 | **Recorder, die Export-Grenze greift erst nach dem Speicherdialog** (0.9.2-Liste, Punkt 4). Hat jemand mehr Presets, als eine Datei aufnehmen darf, erfährt er das erst, nachdem er im Speicherdialog einen Ort gewählt hat. | PR #296, am Code bestätigt | `main/ipc.ts` (`presets:exportieren`: `showSaveDialog` vor `baueExportDatei`), `shared/presets.ts` (`baueExportDatei` wirft ab `EXPORT_MAX_PRESETS`) |
| RE-K7 | **Recorder, langfristig die Aufnahmezeit je Block aus dem Addon** (0.9.2-Liste, Punkt 5). Gemeint ist PortAudios Zeitstempel `inputBufferAdcTime`; heute gibt das Audio-Addon keine Zeit mit, der Hauptprozess zählt die Aufnahmedauer aus den Frames und stempelt die Ankunft eines Blocks mit der eigenen Uhr (`Date.now()` in `onFrames`, darauf baut auch der Wächter von RE-3). | PR #296, laut Code | `main/recorder.ts` (`onFrames`, `recordedSec`) |
| RE-K8 | **Recorder, mehrere tote Netzwerkpfade können den libuv-Pool belegen.** Die Platz-Abfrage (`statfs`, RE-PLATZ) und die Ordnerprüfung (`fs:ordnerDa`, RE-NAS) geben eine hängende Abfrage nach ihrer Zeitgrenze auf, die Abfrage selbst läuft aber weiter und hält einen Thread des libuv-Pools (Node-Vorgabe 4). Antworten mehrere verschiedene Netzwerkpfade nicht (NAS aus, Netz weg), können sie den Pool belegen; dann warten alle asynchronen Dateizugriffe des Hauptprozesses, auch neue Platz-Abfragen. | Gesamtprüfung Stufe 2, M3, laut Code | `main/platz.ts` (`PlatzAbfrage`, `PLATZ_GRENZE_MS`), `main/ipc.ts` (`fs:ordnerDa`, `fs:platz`) |
| LA-K1 | **Launcher, kein stilles Update eines laufenden Werkzeugs.** „Alle aktualisieren“ in der Toolbox startet für jedes Werkzeug den NSIS-Installer still (`/S`); der beendet eine laufende App (WM_CLOSE, nach etwa 1,3 s hart), auch einen Recorder mitten in der Aufnahme. Seit Ruling S2-R26 bleibt die Aufnahme bis zum Moment der Anfrage abspielbar, der Rest fehlt. Gewünscht wäre, dass der Launcher laufende Werkzeuge erkennt und sie nicht ungefragt aktualisiert. | Gesamtprüfung Stufe 2, I1, laut Code | `apps/launcher/src/main/installer.ts` (`spawn(dest, ['/S'])`) |

Zur Kenntnis (Festlegung P9): Die Funktionsliste des Switchers ist im GIT-Modus schon auf `main` (`eb8670b224`) rot; das kommt nicht aus den Altfehler-Stufen und wurde dort weder geprüft noch geändert.
