# Abnahme JM Connect 0.3.0 (Wiederbeitritt, Entzug, Companion, Logs; Owner, echte Hardware)

Spec: `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md`, Abschnitt 13 (die Schritte 8, 11, 12, 13, 14, 15, 16, 17, 20, 21 und 23 stehen hier wörtlich), Nachtrag „Umfang 4b (Connect 0.3.0) – Ergänzungen“ (N4b.1 bis N4b.3) und Messfragen aus Abschnitt 16. Plan: `docs/superpowers/plans/2026-10-06-zoom-stage4b-connect.md` (Texte aus der Texttabelle, Messungen M18 und M19 aus L23).

**Volle Abnahme (Spec 18):** `ABNAHME-0.2.0.md` verschiebt alle Schritte außerhalb des 4a-Kurztests hierher. Sie stehen so in dieser Liste: 9 → E3 (sechste Person, Q9), 11 → F2, 12 → C1, 13 → C2, 14 → G1, 15 → C3, 16 → A1, 17 → A4, 18 → B1 und B2 (statt der Frage M16 jetzt Messung M18), 20 → F3, 23 → G2, 25 → D1. Die Schritte 8 und 21 aus dem Kurztest wiederholen F1 und F4, weil sich der native Teil geändert hat. In den wörtlich übernommenen Zeilen gelten die Schrittnummern der Spec: „Schritt 8“ in G1 ist hier F1.

- Getestet wird ein **interner Bau** (`npm run dist:dir -w @jm/connect`, beide Wächter laufen mit) im **eigenen** Zoom-Konto. Er trägt noch die bisherige Versionsnummer; der Sprung auf 0.3.0 gehört zum Release.
- Der native Teil der Zoom-Bridge ist geändert (Entzug baut ab, Logzeilen ohne Namen). Darum wiederholt Gruppe F die wichtigsten Schritte aus Stage 1–3.
- Meeting-Nummer, Kenncode und echte Teilnehmernamen stehen **nie** in dieser Datei, in Notizen oder in Berichten; `<Meeting-Nummer>`, `<Kenncode>` und `<Name>` bleiben Platzhalter.
- Das Companion-Modul 0.2.0 kommt aus `npm run build:local` im Ordner `packages/companion-jm-suite` (`pkg.tgz`) und wird in Companion importiert.

**Getesteter Bau** (vom Owner auszufüllen):

| Bau | SHA-256 | Datum | Raum-PC |
| --- | --- | --- | --- |
| `apps/connect/release/win-unpacked/JM Connect.exe` | | | |
| `packages/companion-jm-suite/pkg.tgz` (Modul 0.2.0) | | | |

**Voraussetzungen:**
- Zoom-SDK und Zugangsdaten sind eingerichtet („Einrichtung prüfen“ meldet „Einrichtung in Ordnung …“).
- Zoom-Meeting im **eigenen** Konto der Meeting-SDK-App. Host ist der Owner im Zoom-Client auf einem zweiten Gerät; sein Zoom-Client kann die Aufnahme-Erlaubnis für einen Teilnehmer entziehen und wieder erteilen.
- Sechs Teilnehmer-Geräte (sechs nur für E3), zwei davon mit gleichem Anzeigenamen (C1, E1).
- NDI-Monitor (zum Beispiel NDI Studio Monitor) und Switcher im selben Netz.
- Companion mit Modul 0.2.0, ein laufender JM Titler (C3), ein Proxy-Zugang für bis zu fünf Browser-Gäste (C4, C5, G1).
- PowerShell auf dem Raum-PC (D1 bis D3, E4).

## A · Wiederbeitritt (Spec 6.4)

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| A1 | Netzwerkkabel des Raum-PCs 60 s ziehen, dann wieder stecken | Z10, dann Z11 mit Versuchen; in Z11 steht jede geladene Quelle unter „Gemerkte Quellen“ als „{Name} — wartet auf den Wiederbeitritt“ (nicht „wartet auf die Person“), ebenso nach „Wiederbeitritt gescheitert …“; danach wieder im Meeting, eindeutige Quellen kommen mit gleichem NDI-Namen zurück, der Switcher verbindet sich selbst; solange gemerkte Quellen fehlen, steht `zoom_alarm` auf 1; muss der Host die Erlaubnis neu erteilen, steht bis dahin jede anwesende Person als „{Name} — wartet auf die Aufnahme-Erlaubnis“ unter „Gemerkte Quellen“, danach kurz „{Name} — wird geladen …“; notieren: Zeit bis Bild, musste der Host zulassen oder Erlaubnis neu erteilen (M2) | |
| A2 | Wie A1, dabei die Karte, das Tray und danach das Log ansehen | Karte in Z11 „Verbindung zum Meeting verloren. Wiederbeitritt i von 5 in s s.“ mit herunterzählenden Sekunden, während eines Versuchs „… Wiederbeitritt i von 5 läuft …“; Tray „△ Zoom: Verbindung verloren, Wiederbeitritt i von 5“; nach dem Erfolg unter „Hinweise“ „Wieder im Meeting. k Quellen neu geladen, d warten auf eine eindeutige Person.“ (Einzahl bei 1). Im Log je Versuch „[zoom] Wiederbeitritt: Versuch i …“ mit der Dauer in ms | |
| A3 | Netz nur kurz trennen (Kabel 5 s ziehen) | Z10 „Verbindung unterbrochen. Zoom versucht selbst, neu zu verbinden …“, danach wieder im Meeting **ohne** Z11; die Quellen laufen ohne Handgriff weiter, keine zweite `zoom-bridge.exe` im Task-Manager. Hat vorher eine geladene Person das Meeting verlassen, bleibt ihre Zeile in Z10 „{Name} — Person weg, Quelle schwarz“ mit „Entladen“ (nicht „wartet auf den Wiederbeitritt“), und „Entladen“ wirkt dort | |
| A4 | Host schiebt JM Connect in den Warteraum und lässt es wieder zu | „Im Warteraum …“, dann „Trete dem Meeting bei …“, dann wieder im Meeting; **kein** „Verbindung unterbrochen“, kein Wiederbeitritt; notieren, ob die Quellen dabei bestehen bleiben (M17) | |
| A5 | Kabel ziehen, bis Z11 erscheint; dann „Abbrechen“; Kabel stecken; „Erneut beitreten“ | Nach „Abbrechen“ Meldung „Wiederbeitritt abgebrochen.“ mit „Erneut beitreten“ und „Schließen“, keine weitere `zoom-bridge.exe`; die gemerkten Quellen stehen weiter als „{Name} — wartet auf den Wiederbeitritt“ (nicht „wartet auf die Person“), auch während „Erneut beitreten“ läuft; „Erneut beitreten“ führt ohne neue Eingabe ins Meeting, die gemerkten Quellen kommen zurück | |
| A6 | Kabel ziehen, bis Z11 erscheint; dann Tray „Zoom-Meeting verlassen“ | Schon während „Verlasse das Meeting …“ steht unter „Gemerkte Quellen“ nichts mehr (nicht „{Name} — wartet auf den Wiederbeitritt“); danach Karte „Bereit. Meeting-Nummer und Kenncode eingeben.“, keine Meldung, keine gemerkten Quellen, `zoom_alarm` 0, keine `zoom-bridge.exe` im Task-Manager | |

## B · Entzug der Aufnahme-Erlaubnis (N4b.1)

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| B1 | Zwei Personen laden, eine davon vorher mit „Ton“ aus; beide im NDI-Monitor ansehen und anhören. Dann entzieht der Host im Zoom-Client die Aufnahme-Erlaubnis | Im NDI-Monitor stoppen Bild und Ton beider Quellen **sofort**, die Quellen verschwinden aus der NDI-Liste. Karte „Aufnahme-Erlaubnis vom Host entzogen, Quellen gestoppt. Erteilt der Host sie im Zoom-Client wieder, lädt Connect die gemerkten Quellen von selbst.“; Tray „△ Zoom: Aufnahme-Erlaubnis vom Host entzogen, Quellen gestoppt“; beide Personen unter „Gemerkte Quellen“ als „{Name} — wartet auf die Aufnahme-Erlaubnis“ (nicht „wartet auf die Person“); `zoom_sources` 0, `zoom_privilege` 0, `zoom_alarm` 1. Im Log „[zoom-bridge] Entzug: Ton-Abo abmelden (ausserhalb des Rueckrufs)“, „… Entzug: Bild-Abos abbauen“, „… Entzug: Rohdaten-Aufnahme beenden“ und je Quelle „[zoom] Quelle … gestoppt (Entzug)“; notieren, ob danach Fehlerzeilen der Bridge folgen (M18) | |
| B2 | Der Host erteilt die Erlaubnis wieder | Beide Quellen kommen von selbst zurück, mit gleichem NDI-Namen und unveränderter Ton-Einstellung (die eine weiter ohne Ton); „Gemerkte Quellen“ leer, `zoom_alarm` 0; notieren, ob die Bridge beim neuen Abo Fehler meldet (M18) | |
| B3 | Entziehen lassen; in Connect eine der beiden gemerkten Quellen „Vergessen“; dann erteilen lassen | Nur die andere Quelle kommt zurück | |
| B4 | Entziehen lassen; in Connect „Meeting verlassen“; danach erteilt der Host die Erlaubnis | Karte „Bereit. …“, keine gemerkten Quellen (schon während „Verlasse das Meeting …“ keine mehr), `zoom_alarm` 0; es entsteht keine Quelle | |

## C · Companion (Modul 0.2.0)

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| C1 | Zwei Geräte mit gleichem Namen; Companion `zoom_load` mit diesem Namen | beide Zeilen „Name doppelt“; Companion-Hinweis F3 in Connect; am Pult `zoom_cmd=f3`, Feedback „letzter Zoom-Befehl abgelehnt“ gelb | |
| C2 | Companion: `zoom_unload` und `zoom_load` per Name, Variablen und Feedbacks ansehen | Quelle geht und kommt; `zoom_status`, `zoom_sources` stimmen; `zoom_live` grün; `zoom_cmd=ok`, Abgelehnt-Feedback aus | |
| C3 | Companion 0.2.0, Rolle „JM Connect“ und Rolle „JM Titler“ | Connect ist als Rolle wählbar; GO, NEXT, ONAIR, OFF und TALKBACK wirken an den Browser-Gästen; am Titler wirken `graphic` und `slot`. Grund: Das Modul liefert diese Rollenteile erstmals aus (Ergänzung 0.12) | |
| C4 | Tasten mit den Feedbacks „Connect: es ist ein Gast auf Sendung“ und „Connect: Gäste im Warteraum“ anlegen; nacheinander 0, 1, 2 und 5 Browser-Gäste im Warteraum bzw. auf Sendung | Beide Tasten leuchten bei 1, 2 und 5 Gästen, bei 0 nicht (Spec 17.2 Nr. 2) | |
| C5 | Ein Browser-Gast heißt „Anna Maria Beispiel“; ihn als Standby vormerken und auf Sendung schalten; die Variablen `standby_label` und `active_label` in Companion ansehen | Der ganze Name „Anna Maria Beispiel“ steht in der Variable, nicht nur „Anna“ (Spec 17.2 Nr. 3) | |
| C6 | Companion `zoom_delay` mit 300, danach mit 1001 | Bei 300: Versatz-Feld zeigt 300, darunter „bestätigt: 300 ms“, `zoom_cmd=ok`. Bei 1001: unter „Hinweise“ „Companion: Versatz „1001“ ungültig — erlaubt sind ganze Zahlen von 0 bis 1000.“, `zoom_cmd=f6`, Abgelehnt-Feedback gelb; der Versatz bleibt 300 | |
| C7 | Eine nicht geladene Person per Companion-Taste `zoom_load` laden und die Taste dabei zweimal schnell hintereinander drücken | Genau eine Quelle, keine Quelle mit „(2)“ im Namen, `zoom_cmd=ok`, Abgelehnt-Feedback aus | |

## D · Logs (N4b.2)

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| D1 | Zum Schluss, nach allen anderen Gruppen (auch E, F und G): Logordner („Logordner öffnen“) nach dem Kenncode, der Meeting-Nummer (wie eingegeben und nur die Ziffern) und den Anzeigenamen aller Teilnehmer durchsuchen, zum Beispiel `Select-String -Path "$env:APPDATA\JM Connect\logs\*" -SimpleMatch -Pattern '<Kenncode>','<Meeting-Nummer>','<Name>'` | Kein Treffer (Schritt 25 aus 0.2.0 nachgeholt). Erlaubt ist nur der eigene Anzeigename „JM Connect“; Zeilen der Bridge zeigen statt eines Namens „‹Name›“, Browser-Gäste stehen mit ihrer Kennung im Audit | |
| D2 | Vor dem ersten Beitritt `Get-ChildItem "$env:APPDATA" -Recurse -File \| Select-Object FullName, Length, LastWriteTime` in eine Datei schreiben, nach einem Meeting noch einmal, dann vergleichen | Notieren, welche Dateien das Zoom-SDK trotz abgeschalteter SDK-Logs neu anlegt oder ändert (erwartet: unter `%APPDATA%\ZoomSDK\`), und ob sie Meeting-Nummer oder Teilnehmernamen enthalten (`Select-String` wie in D1) (M19) | |
| D3 | Connect beenden. Im Logordner eine Datei `main.log.4` anlegen und auf 15 Tage altern, dazu `renderer.log.3` mit einer Zeile von vor 20 Tagen und einer von gestern (PowerShell unter der Tabelle). Connect starten und eine Minute warten (aufgeräumt wird 30 s nach dem Start) | `main.log.4` ist weg; `renderer.log.3` enthält nur noch „junge Zeile“; in `main.log` steht eine Zeile „[runtime] Logs aufgeräumt: g gelöscht, k gekürzt (Frist 14 Tage)“ mit g ≥ 1 und k ≥ 1. Auf einem Raum-PC mit älteren Logs (aus 0.1.0 bis 0.2.x) sind beide Zahlen höher; dann sind auch diese Dateien weg bzw. beginnen mit einer Zeile der letzten 14 Tage | |
| D4 | Nach dem nächsten Release einer anderen Suite-App (zum Beispiel JM Timer) D3 in deren Logordner wiederholen | Wie D3. Vor deren Release bleibt das Ergebnis „offen“: Die Löschfrist wirkt je App erst mit ihrem eigenen Release | |

PowerShell für D3 (Logordner von Connect):

```powershell
$l = "$env:APPDATA\JM Connect\logs"
Set-Content "$l\main.log.4" "alt"
(Get-Item "$l\main.log.4").LastWriteTime = (Get-Date).AddDays(-15)
$alt = (Get-Date).ToUniversalTime().AddDays(-20).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$jung = (Get-Date).ToUniversalTime().AddDays(-1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
Set-Content "$l\renderer.log.3" "$alt [INFO] [jm-connect] alte Zeile", "$jung [INFO] [jm-connect] junge Zeile"
(Get-Item "$l\renderer.log.3").LastWriteTime = (Get-Date).AddDays(-1)
```

## E · Randfälle (N4b.3)

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| E1 | Zwei Geräte mit gleichem Namen; die erste Person laden, dann die zweite | Vor dem Laden zeigt die zweite Zeile „wird: JM Connect – Zoom <Name> (2)“; nach dem Laden endet ihr NDI-Name auf „(2)“, im Switcher stehen beide Quellen | |
| E2 | Eine Person mit „Ton“ aus laden; Kabel ziehen, bis Z11 erscheint, „Abbrechen“; Kabel stecken, „Erneut beitreten“ | Nach „Abbrechen“ und während „Erneut beitreten“ steht die Person unter „Gemerkte Quellen“ als „<Name> — wartet auf den Wiederbeitritt“. Schon bevor die Quelle wieder läuft, steht der Ton-Schalter dieser Zeile auf aus; die Quelle kommt ohne Ton zurück | |
| E3 | Sechs Personen laden (die sechste mit dem zweiten Klick nach der Warnung); Kabel 60 s ziehen, dann stecken | In Z11 stehen alle sechs unter „Gemerkte Quellen“ als „<Name> — wartet auf den Wiederbeitritt“. Nach dem Wiederbeitritt laufen genau 5 Quellen; unter „Hinweise“ „Wieder im Meeting. 5 Quellen neu geladen, 0 warten auf eine eindeutige Person, 1 über der Grenze von 5 nicht geladen.“ (sechs eindeutige Namen); im Log „[zoom] Abgleich: 1 gemerkte Quelle über der Betriebsgröße, nicht geladen“; die sechste steht unter „Gemerkte Quellen“ als „<Name> — nicht automatisch geladen (mehr als 5 Zoom-Quellen), bitte von Hand laden“, `zoom_alarm` 1; von Hand laden: Warnung „Mehr als 5 Zoom-Quellen sind nicht gemessen. …“, der zweite Klick lädt | |
| E4 | Connect beenden; `attrib +R "$env:APPDATA\JM Connect\connect-settings.json"`; Connect starten, beitreten, den Versatz ändern; Connect neu starten; danach `attrib -R "$env:APPDATA\JM Connect\connect-settings.json"` | Nach der Änderung unter dem Feld gelb „Nur für diese Sitzung gemerkt — die Einstellungsdatei ließ sich nicht schreiben.“, das Feld wird nicht rot, im Meeting „bestätigt: … ms“ mit dem neuen Wert; nach dem Neustart zeigt das Feld wieder den alten Wert | |
| E5 | Beitreten mit falschem Kenncode; „Schließen“ | Meldung „Beitritt gescheitert: falscher Kenncode.“; nach „Schließen“ sind Meeting-Nummer und Kenncode in der Karte leer | |
| E6 | Einen Hinweis erzeugen (Companion `zoom_load` mit einem Namen, den es im Meeting nicht gibt); „Meeting verlassen“; mit neu eingegebenen Daten beitreten | Vorher unter „Hinweise“ „Companion: niemand namens „…“ im Meeting.“; nach dem neuen Beitritt ist „Hinweise“ leer | |
| E7 | Bei einer geladenen Person Kamera aus und wieder an, Mikrofon stumm und wieder an | Die Zeile zeigt Bild und Ton im Klartext, zum Beispiel „Bild schwarz: Kamera aus“, „Bild läuft“, „Ton: Stille“, „Ton läuft“; keine Rohwerte wie „black (cameraOff)“ | |
| E8 | Mit fünf geladenen Quellen „Meeting verlassen“ und sofort danach in der Einrichtung auf „SDK-Ordner wählen …“ | Der Knopf ist gesperrt (Tooltip „Während Zoom läuft oder das Zoom-SDK geladen oder kopiert wird, lässt sich die Einrichtung nicht ändern.“), bis der Abbau fertig ist; danach wieder frei. Während „Verlasse das Meeting …“ steht unter „Gemerkte Quellen“ nichts (nicht „<Name> — wartet auf den Wiederbeitritt“) | |

## F · Regression Stage 1–3 (nativer Teil geändert)

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| F1 | Fünf Personen laden, bei einer vorher „Ton“ aus | fünf Quellen „JM Connect – Zoom <Name>“ im Switcher mit Bild, vier mit Ton; Tray „● Zoom: 5 Quellen geladen“. Im Task-Manager (Details, Spalte „Befehlszeile“) **alle** Prozesse aus dem Laufzeit-Ordner notieren: erwartet `zoom-bridge.exe`; jede weitere EXE von dort (zum Beispiel `aomhost64.exe`, `zWebview2Agent.exe`, `zcscpthost.exe`) belegt M1, zweiter Teil. Läuft keine Hilfs-EXE, bleibt M1 Teil 2 offen | |
| F2 | Eine Person verlässt das Meeting und kommt zurück | Quelle kommt mit gleichem NDI-Namen zurück, ohne Handgriff | |
| F3 | Host beendet das Meeting; danach startet er es neu; danach entfernt er JM Connect | Meldung „Meeting beendet: vom Gastgeber beendet.“ steht in der Karte (nicht nur Z2), Quellen weg; „Erneut beitreten“ führt wieder ins Meeting; nach dem Entfernen Meldung C61; „Schließen“ leert Nummer und Kenncode | |
| F4 | Beitreten, Tray → Beenden | Connect beendet sich binnen 15 s; im Zoom-Client verschwindet „JM Connect“ sofort; kein `zoom-bridge.exe` im Task-Manager | |

## G · Last und Dauer (Spec 13 Nr. 14 und 23)

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| G1 | **Gemischte Last (M5):** fünf Zoom-Quellen laufen (aus Schritt 8, sonst neu laden); Raum öffnen, **zwei** Browser-Gäste freigeben und auf Sendung, Programm-Rückkanal an; ein Gast heißt „Zoom <Name einer geladenen Person>“ | alle **sieben** Quellen im Switcher; Gäste-Zeile im Tray zählt richtig; Kollisionswarnung Q10; CPU- und GPU-Last (Task-Manager) über 5 min notieren; notieren, welche der beiden gleichnamigen Quellen im Switcher ankommt (M8) | |
| G2 | Connect starten, beitreten, zwei Quellen laden, 65 min im Meeting bleiben | keine Unterbrechung | |

## Messungen

| # | Frage | Wo gemessen | Ergebnis |
| --- | --- | --- | --- |
| M2 | Lässt Zoom eine neue Bridge direkt nach einem Abriss zu? Muss der Host zulassen oder die Erlaubnis neu erteilen? Wie lange bis Bild? Verbindet der Switcher selbst? | A1, A2 | |
| M5 | Gemischte Last: 5 Zoom-Quellen + 2 Browser-Gäste auf Sendung + Programm-Rückkanal, CPU- und GPU-Last | G1 | |
| M8 | Was tut NDI mit zwei gleichnamigen Sendern auf einem PC (Kollision Gast ↔ Zoom)? | G1 | |
| M17 | Bleiben Abos bestehen, wenn der Host JM Connect mitten im Meeting in den Warteraum schiebt und wieder zulässt? | A4 | |
| M18 | Stoppt das Zoom-SDK die Lieferung beim Entzug selbst? Laufen Abmelden und `StopRawRecording` beim Entzug und `StartRawRecording` nach der Wiedererteilung fehlerfrei? | B1, B2 (Log) | |
| M19 | Legt das Zoom-SDK trotz abgeschalteter SDK-Logs Dateien unter `%APPDATA%` an, und stehen darin Meeting-Nummer oder Teilnehmernamen? | D2 | |
