# Abnahme JM Connect 0.2.0 (Zoom, Owner, echte Hardware)

Spec: `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md`, Abschnitt 13 (Voraussetzungen und Schritte wörtlich), Messfragen aus Abschnitt 16.

**4a-Kurztest (Plan 4a, Spec 18):** nur die Schritte mit „ja“ in der Spalte „4a-Kurztest“ (1–8, 10, 19, 21, 22, 24). Er liefert die Messungen M1, M3, M7 und M9 (Abschnitt „Messungen aus dem Kurztest“ unten). Die übrigen Schritte gehören zur vollen Abnahme vor dem Release `connect-v0.2.0` (Plan 4b).
- Getestet wird ein **interner Bau** mit der Version **0.1.0**; die Version steigt erst mit dem Release (Plan 4b). Schritt 1 zeigt darum 0.1.0.
- In 4a gibt es noch keinen automatischen Wiederbeitritt: Ein Verbindungsabriss endet in der Zoom-Karte mit einer Fehlermeldung und „Erneut beitreten“. Die Companion-Schritte (12, 13, 15) brauchen das Modul 0.2.0 aus Plan 4b.
- Meeting-Nummer und Kenncode **nie** in diese Datei, in Notizen oder in Berichte schreiben; `<Meeting-Nummer>` und `<Kenncode>` bleiben Platzhalter.

**Getesteter Bau** (vom Owner auszufüllen; die SHA-256 steht im Bericht von Aufgabe 20 des Plans 4a):

| Installer | SHA-256 | Datum | Raum-PC |
| --- | --- | --- | --- |
| `JM Connect-0.1.0-win-x64.exe` | | | |

**Voraussetzungen:**
- Raum-PC **ohne** VC-Redist: In „Apps“ gibt es kein „Microsoft Visual C++ 2015-2022 Redistributable (x64)“, und der Registrierungsschlüssel `HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64` fehlt. Zusätzlich fehlen `C:\Windows\System32\msvcp140.dll` und `C:\Windows\System32\vcruntime140.dll`. Liegen sie dort (von anderen Installern hinterlassen), Dateifassung notieren: Zooms Hilfsprogramme suchen auch in System32, M1 gilt dann als **nicht belegt**.
- Zoom-Meeting im **eigenen** Konto der Meeting-SDK-App. Host ist der Owner im Zoom-Client auf einem zweiten Gerät. Dazu fünf Teilnehmer-Geräte; zwei davon für den Doppelnamen-Test.
- Ein **fremdes** Zoom-Konto mit einem Meeting (für Schritt 24).
- Switcher oder NDI-Monitor im selben Netz, Companion mit Modul 0.2.0, ein laufender JM Titler (Schritt 15).
- Ein Proxy-Zugang für Browser-Gäste (Schritt 14).

| # | Schritt | Erwartung | 4a-Kurztest | Ergebnis |
| --- | --- | --- | --- | --- |
| 1 | Connect 0.2.0 auf dem Raum-PC installieren | Version sichtbar; Zoom-Karte zeigt „nicht vollständig eingerichtet: SDK-Ordner fehlt · Zugangsdaten fehlen“, „Beitreten“ fehlt, Hinweis zur Sperre; Tray „△ Zoom: Einrichtung unvollständig“ | ja | *Hinweis 4a-Kurztest: der interne Bau zeigt Version **0.1.0**, nicht 0.2.0 (siehe Kopf).* |
| 2 | SDK-Ordner `x86\bin` wählen | Text S2, nichts kopiert | ja | |
| 3 | SDK-Ordner aus der JM-Ablage wählen | Fortschritt; danach „Zoom-SDK 7.1.5.43953 eingerichtet“; Ordner unter `%LOCALAPPDATA%\JM Connect\zoom-laufzeit\` | ja | |
| 4 | Zugangsdaten-Datei wählen, danach die Datei umbenennen, Connect beenden und **aus dem Launcher** neu starten | „hinterlegt (Client-ID endet auf …)“; bleibt nach dem Neustart hinterlegt. Ab hier läuft Connect aus dem Launcher (Voraussetzung für M6 in Schritt 6) | ja | |
| 5 | „Einrichtung prüfen“ | Meldung „Einrichtung in Ordnung: Zoom-SDK 7.1.5 (43953) …“ im Meldungsbereich, „OK“ quittiert sie; Tray bleibt dabei „○ Zoom: kein Meeting“ — **ohne VC-Redist** (M1, erster Teil); kein Smart-App-Control-Block (M7) | ja | |
| 6 | Beitreten mit `<Meeting-Nummer>` und `<Kenncode>`, Anzeigename Vorgabe | Warteraum (falls an), Host lässt zu: Karte geht von „Im Warteraum …“ auf „Trete dem Meeting bei …“, **nie** „Verbindung unterbrochen“; Erlaubnis-Anfrage beim Host, nach dem Erteilen „Im Meeting. Personen unten als Quelle laden.“; Tray und Kopfzeile wie 7.2. Gelingt der Beitritt mit Connect aus dem Launcher, ist M6 belegt | ja | |
| 7 | Teilnehmerliste ansehen | keine eigene Zeile; Host markiert; Kamera-Zustand stimmt | ja | |
| 8 | Fünf Personen laden, bei einer vorher „Ton“ aus | fünf Quellen „JM Connect – Zoom <Name>“ im Switcher mit Bild, vier mit Ton; Tray „● Zoom: 5 Quellen geladen“. Im Task-Manager (Details, Spalte „Befehlszeile“) **alle** Prozesse aus dem Laufzeit-Ordner notieren: erwartet `zoom-bridge.exe`; jede weitere EXE von dort (zum Beispiel `aomhost64.exe`, `zWebview2Agent.exe`, `zcscpthost.exe`) belegt M1, zweiter Teil. Läuft keine Hilfs-EXE, bleibt M1 Teil 2 offen | ja | |
| 9 | Sechste Person laden (falls da) | Warnung Q9, zweiter Klick lädt | – | |
| 10 | Versatz auf den Projekttest-Wert setzen | „bestätigt: … ms“ (ob der Wert einen Neustart übersteht, prüft Schritt 22) | ja | |
| 11 | Eine Person verlässt das Meeting und kommt zurück | Quelle kommt mit gleichem NDI-Namen zurück, ohne Handgriff | – | |
| 12 | Zwei Geräte mit gleichem Namen; Companion `zoom_load` mit diesem Namen | beide Zeilen „Name doppelt“; Companion-Hinweis F3 in Connect; am Pult `zoom_cmd=f3`, Feedback „letzter Zoom-Befehl abgelehnt“ gelb | – | |
| 13 | Companion: `zoom_unload` und `zoom_load` per Name, Variablen und Feedbacks ansehen | Quelle geht und kommt; `zoom_status`, `zoom_sources` stimmen; `zoom_live` grün; `zoom_cmd=ok`, Abgelehnt-Feedback aus | – | |
| 14 | **Gemischte Last (M5):** fünf Zoom-Quellen laufen (aus Schritt 8, sonst neu laden); Raum öffnen, **zwei** Browser-Gäste freigeben und auf Sendung, Programm-Rückkanal an; ein Gast heißt „Zoom <Name einer geladenen Person>“ | alle **sieben** Quellen im Switcher; Gäste-Zeile im Tray zählt richtig; Kollisionswarnung Q10; CPU- und GPU-Last (Task-Manager) über 5 min notieren; notieren, welche der beiden gleichnamigen Quellen im Switcher ankommt (M8) | – | |
| 15 | Companion 0.2.0, Rolle „JM Connect“ und Rolle „JM Titler“ | Connect ist als Rolle wählbar; GO, NEXT, ONAIR, OFF und TALKBACK wirken an den Browser-Gästen; am Titler wirken `graphic` und `slot`. Grund: Das Modul liefert diese Rollenteile erstmals aus (Ergänzung 0.12) | – | |
| 16 | Netzwerkkabel des Raum-PCs 60 s ziehen, dann wieder stecken | Z10, dann Z11 mit Versuchen; danach wieder im Meeting, eindeutige Quellen kommen mit gleichem NDI-Namen zurück, der Switcher verbindet sich selbst; solange gemerkte Quellen fehlen, steht `zoom_alarm` auf 1; notieren: Zeit bis Bild, musste der Host zulassen oder Erlaubnis neu erteilen (M2) | – | |
| 17 | Host schiebt JM Connect in den Warteraum und lässt es wieder zu | „Im Warteraum …“, dann „Trete dem Meeting bei …“, dann wieder im Meeting; **kein** „Verbindung unterbrochen“, kein Wiederbeitritt; notieren, ob die Quellen dabei bestehen bleiben (M17) | – | |
| 18 | optional: Host entzieht die Aufnahme-Erlaubnis (falls der Zoom-Client das anbietet) und erteilt sie wieder | „Aufnahme-Erlaubnis fehlt (vom Host entzogen)“; notieren, ob die Quellen dabei Bild senden (M16) | – | |
| 19 | Fenster schließen | Connect im Tray, Quellen laufen weiter | ja | |
| 20 | Host beendet das Meeting; danach startet er es neu; danach entfernt er JM Connect | Meldung „Meeting beendet: vom Gastgeber beendet.“ steht in der Karte (nicht nur Z2), Quellen weg; „Erneut beitreten“ führt wieder ins Meeting; nach dem Entfernen Meldung C61; „Schließen“ leert Nummer und Kenncode | – | |
| 21 | Beitreten, Tray → Beenden | Connect beendet sich binnen 15 s; im Zoom-Client verschwindet „JM Connect“ sofort; kein `zoom-bridge.exe` im Task-Manager | ja | |
| 22 | Connect neu starten; dann beitreten; dann per Task-Manager hart beenden | Versatz-Feld zeigt den Wert aus Schritt 10, Zugangsdaten hinterlegt; nach dem Beitritt „bestätigt: … ms“ mit diesem Wert; nach dem harten Ende notieren, wie lange „JM Connect“ im Zoom-Client stehen bleibt (M3) | ja | |
| 23 | Connect starten, beitreten, zwei Quellen laden, 65 min im Meeting bleiben | keine Unterbrechung | – | |
| 24 | Beitritt in das Meeting des fremden Kontos | Text C63 bzw. C500; Code aus dem Log notieren (M9) | ja | |
| 25 | Logordner (Knopf „Logordner öffnen“) nach dem Kenncode und der Meeting-Nummer durchsuchen | kein Treffer | – | |

## Messungen aus dem Kurztest

| # | Frage (Spec 16) | Wo gemessen | Ergebnis |
| --- | --- | --- | --- |
| M1 | Starten `zoom-bridge.exe` **und** Zooms Hilfsprogramme auf einem PC ohne VC-Redist aus dem Laufzeit-Ordner? Belegt nur, wenn auch System32 keine `msvcp140.dll`/`vcruntime140.dll` hat und in Schritt 8 mindestens eine Hilfs-EXE aus dem Laufzeit-Ordner lief. | Abnahme 5 und 8 | |
| M3 | Wie lange bleibt „JM Connect“ im Meeting, wenn Connect hart endet? Windows hängt Kindprozesse an ein Job-Objekt mit „beim Schließen töten“; ein `Leave` kommt dann nicht. | Abnahme 22 | |
| M7 | Blockiert Smart App Control die unsignierte `zoom-bridge.exe` aus `%LOCALAPPDATA%`? | Abnahme 5 (Text B2, falls ja) | |
| M9 | Welcher Code kommt beim Fremdkonto tatsächlich (63, 503 oder 504)? | Abnahme 24 | |
