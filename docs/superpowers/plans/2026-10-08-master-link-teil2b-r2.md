# Master-Link Teil 2b · Release 2 „Show-Daten über den Verbund“ · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Timer, Titler und Rundown auf einem gekoppelten Rechner B arbeiten mit der Show, die am Master offen ist. Sie holen den Stand direkt über ihre Verbund-Verbindung (Abo → Stand → Änderungen), auch ohne Launcher auf B. Sie zeigen „Show vom Master: X · Stand hh:mm“ und behalten den letzten Stand, wenn der Master fehlt. RELOAD geht nur noch an Tools auf dem Master-Rechner. Am Einzelplatz bleibt alles wie in 2a.

**Architecture:**
- **Transport (`@jm/master-link`, Spec 13):**
  - Der ZeilenLeser gibt Zeilen einzeln heraus; die Grenze gilt beim Entnehmen, der Puffer ist eine Stückliste.
  - Drei neue Nachrichten `abo`, `stand`, `aenderung` mit lockeren Prüfern; den Inhalt prüfen `pruefeAbo`/`pruefeStand` in `show-daten.ts`.
  - Der Server vergibt Sitzungs-Kennungen und meldet `daten`, `getrennt` (genau einmal) und `entstaut`; `sendeDaten` hält Rückdruck (1 MiB).
  - Der Client hat `sende`, das Ereignis `daten` (auch für nachgeholte Zeilen) und `kopplung()`. Dazu `eigeneAdressen` und `istDieserRechner` in `adresswahl.ts`.
- **Master-Launcher (Spec 14, 15):**
  - `@jm/show` liefert den Ausschnitt über die Freigabeliste `VERBUND_EINSTELLUNGEN` (`showFuerVerbund`).
  - Der iveo-Kern meldet jede Änderung der offenen Show (`meldeShow`) und frischt die Side-Event-Liste auf (Z3, neues Modul `iveo-side-events.ts`).
  - Der neue `verbund/verteiler.ts` (ohne Electron) führt Epoche, Folge, Abos je Sitzung, 900 KiB, 32 Abos je Rechner und Stau.
  - `MasterRolle` reicht die Server-Ereignisse an den Verteiler; RELOAD geht in der Rolle Master nur an Endpunkte dieses Rechners, auch beim Nachholen.
  - Das Verbund-Modal zeigt „Show im Verbund …“ und je Tool „bezieht Show-Daten“.
- **Tool-Seite (`@jm/app-runtime`, Spec 16):** reine Module `verbund-typen.ts`, `verbund-anzeige.ts` (V1–V15), `verbund-daten.ts` (Zustandsmaschine `VerbundFolger` mit übergebener Uhr), `verbund-speicher.ts` (Zwischenspeicher `master-stand.json`), dazu `verbund.ts`/`verbund-ipc.ts` als Electron-Anbindung. `src/index.ts` bekommt nur drei kleine Einfügungen (Zoom Stage 4b, G2).
- **Tools (Spec 17):** Timer `timerAktionenAusShow`, Titler Datenquelle `master` mit gesperrter Ordnerwahl (O1), Rundown Gedächtnis und Zeiger mit Master-Schlüssel, `waehleLauncher` (Z2). Alle drei ignorieren RELOAD im Verbundmodus und zeigen die V-Zeile. Ein Show-Deep-Link ändert dort die Show-Daten nicht: Der Timer ignoriert ihn, der Titler übernimmt nur die Vorlage, der Rundown lädt nichts daraus (E24).
- **Absicherung:** Kettentest ohne Electron (Spec 18), Durchgang mit gebauten Tools und Test-Master (Spec 19.7, nur nach Owner-Freigabe; erteilt am 08.10.2026), Abnahme-Datei an zwei Rechnern (Spec 20) mit Zusatzprüfungen für das, was der Durchgang nicht erreicht (N17, N23).

**Tech Stack:** TypeScript (ESM), Electron 33, React 18. Selbsttests:
- `tsx` für master-link, Launcher `selftest:verbund` und `selftest:iveo`, Titler, app-runtime `test/verbund.test.ts`
- `node --experimental-strip-types` für Timer, Rundown, Launcher-`selftest` und den CSP-Teil von app-runtime
- esbuild-Bündel für `@jm/iveo` mit `@jm/show`

Echte TLS-Sockets nur auf `127.0.0.1`. Der Durchgang läuft mit `tsx`, Electron und dem Chrome-DevTools-Protokoll.

**Spec:** `docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md`, vom Owner freigegeben am 02.10.2026.
- Umfang dieses Plans: Teil B (Abschnitte 12–21) mit 0 und 1 (Ergänzungen, D1–D5), 22 (Sicherheit), 24 (Folgeaufgaben), 25 (Risiken), 27 (O1–O3).
- Teil A (Release 1) ist gemergt und released (Launcher 0.14.0, Titler 0.10.0, Rundown 0.7.0; Timer 0.13.0 unverändert).
- Plan und Spec gehören zusammen. Bei Widerspruch gilt die Spec, und die Abweichung wird gemeldet. Ausnahmen sind nur die Entscheidungen im Abschnitt „Entscheidungen, wo die Spec schweigt“. Bewusste Abweichungen von der Spec sind dort mit **„Weicht ab“** markiert (E6, E9, E14, E15, E47). Der Owner hat alle fünf am 08.10.2026 bestätigt (Owner-Frage 1, N19). Dazu kommt eine Textabweichung, die der Owner selbst entschieden hat: die Einzahl „· 1 Tool bezieht sie“ im Verbund-Modal (E43, Owner-Frage 3, N16). Gemeldet ist außerdem eine Abweichung im Wortlaut von 19.6, die der Neuaufsatz auf `main` mit sich bringt: C11 legt den CI-Schritt „app-runtime (CSP, Verbund-Anzeige, Abo-Zustand)“ nicht neu an, sondern benennt den Schritt aus Zoom 4b mit demselben Befehl um; der Zweck von 19.6 (genau ein Schritt, der beide Teile ausführt) bleibt (C11 „Abweichungen“, N40).

**Arbeitsort:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b-r2`, Branch `feat/master-link-teil2b-r2`, Basis `adda584693` (`origin/main` am 12.10.2026, mit Zoom Stage 4b und UX Welle 0; Neuaufsatz N25). Geplant wurde gegen `5f8ed15ef8` (beim Planen `origin/main`; am 08.10.2026 stand `origin/main` auf `b7e959866d`, N20). Alle Pfade sind relativ zum Worktree. Zeilenangaben und Zählstände gelten für die Basis `adda584693` bzw. den Stand nach der genannten Aufgabe; maßgeblich ist immer der wortgleiche Vorher-Text.

**Umsetzung (Owner, 08.10.2026, N19):** per Workflow (subagent-driven), und zwar **nach** Zoom Stage 4b. Vor C1 setzt die steuernde Sitzung den Branch auf den dann aktuellen `main` (mit 4b) neu auf und lässt die Anker (Vorher-Texte) und Zählstände der berührten Stellen in einem eigenen Durchgang nachmessen; die Berührungspunkte stehen im Schlussabschnitt. Dieser Neuaufsatz ist nicht Teil der Aufgaben C1–C21. **Erledigt am 12.10.2026 (N25):** Basis `adda584693`, darin Zoom 4b (PR #251, `2df1f79357`) und UX Welle 0 (PR #250, `efcfff3c5a`). Nachgemessen und nachgezogen sind C11–C21 und die globalen Abschnitte (vierte Runde, N25–N32), C1–C10 in einem eigenen Messgang (N33); danach ist beides zusammengeführt und der Plan zweimal ohne Tests abgespielt (N34). Eine Nachprüfung dieses Durchgangs hat Angaben, Spannen und Vermerke nachgezogen, ohne eine Operation zu ändern (N35–N42). Nicht erledigt sind die Textpunkte der dritten Nachprüfung (Absatz vor N22); sie bleiben offen und gehören vor C21 (N39).

**Aufbau:** 21 Aufgaben C1–C21 in fünf Blöcken. Jede Aufgabe braucht nur, was davor fertig ist. Ausgeführt wird der Reihe nach.

| Block | Aufgaben | Inhalt |
| --- | --- | --- |
| A | C1–C4 | Transport `@jm/master-link` |
| B | C5–C10 | Ausschnitt `@jm/show`, iveo-Kern, Verteiler, Master-Verdrahtung, RELOAD, Verbund-Modal |
| C | C11–C13 | Tool-Seite `@jm/app-runtime` |
| D | C14–C18 | Anwenden in Timer, Titler, Rundown |
| E | C19–C21 | Kette (Spec 18), Durchgang, Abnahme/Doku/Versionen |

**M1 gilt weiter als „nein“** (Spec 23 „Ergebnisse“, R1-Ruling K1): Der Mapper setzt keine iveo-Kennung. Speaker in Shows tragen deshalb keine `id`; der Titler hält über Ersatz-Schlüssel. Nichts in R2 (Testdaten, Doku, Notes, Abnahme) sagt Kennungen zu. Tests, die Kennungen brauchen, bauen sie ausdrücklich in ihre Testdaten.

**Zoom Stage 4b und UX Welle 0 auf `main` (Berührung klein halten):** Zoom Stage 4b (Connect 0.3.0) ist mit PR #251 (`2df1f79357`) auf `main`, UX Welle 0 mit PR #250 (`efcfff3c5a`); der Branch steht seit dem Neuaufsatz vom 12.10.2026 darauf (N25). 4b ändert in `packages/app-runtime` nur `src/index.ts` (Log-Aufräumen), das neue Modul `src/log-aufraeumen.ts` und `test/selftest.ts` (`package.json` bleibt unverändert), dazu `packages/suite-control-protocol`, `packages/companion-jm-suite` und `.github/workflows/ci-checks.yml`. UX Welle 0 bringt `packages/ui`, das neue `packages/settings` und zwei CI-Schritte. Von den 81 Dateien dieses Plans ändert `main` seit `5f8ed15ef8` genau vier (`git diff --numstat 5f8ed15ef8 adda584693`: `ci-checks.yml` +25/−0, `package-lock.json` +41/−3, `packages/app-runtime/src/index.ts` +13/−1, `packages/suite-manifest/changelog.json` +30/−0; Liste im Schlussabschnitt). Dieser Plan hält die Berührung klein (G2):
- In `packages/app-runtime` liegt alles Neue in sieben neuen Dateien (`src/verbund-typen.ts`, `verbund-anzeige.ts`, `verbund-daten.ts`, `verbund-speicher.ts`, `verbund.ts`, `verbund-ipc.ts`, `test/verbund.test.ts`).
- `src/index.ts` bekommt genau drei Einfügungen (15 Zeilen, C13). Keine bestehende Zeile wird verschoben, umformatiert oder gelöscht. Sie sitzen auf der 4b-Fassung (660 Zeilen); nach C13 hat die Datei 675 Zeilen, wie die Dreiwege-Zusammenführung vom 08.10.2026 vorhersagte (648 + 15 aus R2 + 12 aus 4b; gemessen 12.10.2026, N29). Die Quelltext-Wächter des 4b-Selbsttests zu `index.ts` bleiben dabei grün.
- `package.json` und der app-runtime-Block in `package-lock.json` gehen in einen eigenen Commit (C11, Commit 1).
- CI: Der Job `selftests` hat auf `adda584693` 22 Schritte (13 auf `5f8ed15ef8`, dazu Presenter, Appkit und App Designer aus PR #248, „UI-Bausteine …“ und „Einstellungs-Abschnitte …“ aus PR #250, Steuerprotokoll, Companion-Modul, Companion-Protokoll aktuell und App-Laufzeit aus PR #251). Der letzte ist „App-Laufzeit (Log-Aufräumen, CSP)“ mit **demselben Befehl** `npm run selftest -w @jm/app-runtime`, den R2 braucht. C11 hängt deshalb keinen zweiten Schritt an, sondern benennt diesen um in „App-Laufzeit (Log-Aufräumen, CSP, Verbund-Anzeige, Abo-Zustand)“; der Job behält 22 Schritte, darin genau **einer** mit diesem Befehl (Spec 19.6, N26). Der frühere Weg (auf `5f8ed15ef8` einen eigenen Schritt anhängen und den Textkonflikt beim Zusammenführen auflösen, N11, N22) ist mit dem Neuaufsatz entfallen.
- Zählstände: Zoom 4b erweitert `packages/app-runtime/test/selftest.ts` (CSP und Log-Aufräumen). Der erste Teil von `npm run selftest -w @jm/app-runtime` zeigt deshalb `50 passed` statt `15 passed` (gemessen am 12.10.2026 auf `adda584693`, wie am 08.10.2026 an `85dcba597d`); der Verbund-Teil bleibt `208 passed`. Die Erwartungen in C11–C13 und C21 nennen diese Zahlen (N27).
- `packages/suite-control-protocol` und `packages/companion-jm-suite` bleiben unberührt; es gibt keinen neuen STATE-Schlüssel. Die STATE-Kodierung aus 4b (Leerraum und `%` als `%XX`) berührt R2 nicht (N31).

**Freigaben, an denen die Ausführung hält** (Ledger-Zeilen, die nur der Owner bzw. die steuernde Sitzung setzt):
- „Owner-Freigabe C20“: Der Owner hat den Durchgang am 08.10.2026 freigegeben (Owner-Frage 8, N19). Die Ledger-Zeile setzt die steuernde Sitzung beim Start der Umsetzung; C20 läuft dann ganz. Fehlt sie trotzdem, endet C20 nach dem Commit des Skripts (Step 6), und der Lauf wird **vor dem Merge** nachgeholt (Pflicht, N14). Was C20 an der Main-Verdrahtung von Titler und Rundown (C16, C18) prüft und was nicht, steht in C16 und C18 unter „Regeln“; was er nicht erreicht (Show-Link, Startreihenfolge, gesperrte Ordnerwahl, Rundown-Datei am Master mit „Öffnen…“/„Neu“ im Verbund, eigene Wahl nach dem Entkoppeln), steht als „Zusatzprüfungen (nicht in Spec 20)“ in der Abnahme-Datei (C21, N17, N23). Von Hand nicht erreichbar ist die Ablehnung im Main des Titlers, solange die Oberfläche die Ordnerwahl schon sperrt; sie ist als reine Regel getestet (C15).
- „Owner-Freigabe Notes R2“: Ohne sie endet C21 mit dem Entwurf im Bericht (Step 10); der Commit von C21 folgt erst danach. Diese Freigabe und die der Texte ohne Spec-Vorgabe sind die einzigen offenen Owner-Punkte (Stand 08.10.2026).

**Wie dieser Plan entstanden ist:**
- Eine Gliederung hat die Aufgaben C1–C21, das Schnittstellen-Register, die Entscheidungen E1–E29 und die Liste „R2 oder Folgeaufgabe“ festgelegt. Fünf Schreiber haben die Blöcke A–E ausformuliert, jeder in einer eigenen Kopie des Worktrees (Stand `5f8ed15ef8`). Block A und B waren gegeneinander gemessen; C, D und E hatten für frühere Blöcke Stand-ins nach dem Register.
- **Zusammengeführt und durchgespielt am 08.10.2026:** Alle 282 Operationen (Vorher/Nachher-Ersetzungen, Einfügungen, neue Dateien; ohne Gegenproben) wurden der Reihe nach aus dem Plantext auf eine frische Kopie (`git archive HEAD`, `node_modules` per Junction, `@jm/*` auf die Pakete der Kopie) angewendet. Jeder Vorher-Text kam genau einmal vor. Nach jeder Aufgabe liefen ihre Rot- und Grünläufe und der Typecheck; jede `FAIL`- und Fehlerzeile der Rotläufe steht wörtlich im Plan. Windows 11, Node 24.16.0.
- Zum Schluss wurde der fertige Plantext noch einmal ohne Tests auf eine zweite frische Kopie abgespielt; alle 81 berührten Dateien waren danach Byte für Byte gleich der gemessenen Kopie.
- **Nachbesserung nach der Plan-Prüfung (08.10.2026, N1–N14, Abschnitt „Nachbesserung nach der Plan-Prüfung“):** Der geänderte Plan wurde noch einmal ganz auf eine frische Kopie abgespielt (jetzt 283 Operationen, jeder Vorher-Text genau einmal), mit den Rot- und Grünläufen, Gegenproben und Typechecks von C4–C19 und den Prüfungen von C21 (C1–C3 und C20 sind unverändert), und einem Gesamtlauf am Ende (alle Selbsttests grün, `typecheck --workspaces` Exit 0). Ein zweites Abspielen ohne Tests auf eine weitere frische Kopie ergab in allen berührten Dateien dieselben Bytes. Die Zahlen in diesem Plan sind die dabei gemessenen. Windows 11, Node 24.16.0; die CI läuft auf `ubuntu-latest` mit Node 22 und ist der erste Lauf unter Linux (N12).
- **Zweite Runde (08.10.2026, N15–N21, Owner-Antworten und Nachprüfung):** Der Plan wurde wieder ganz auf eine frische Kopie abgespielt (283 Operationen, jeder Vorher-Text genau einmal), mit den Rot- und Grünläufen, Gegenproben und Typechecks von C10–C19 und den Prüfungen von C21 (C1–C9 sind nur angewendet, ihr Code ist unverändert; vom Durchgang C20 nur das Anlegen des Skripts, `tsc` und die Zählung, nie ein Lauf), und einem Gesamtlauf am Ende. Ein zweites Abspielen ohne Tests auf eine weitere frische Kopie ergab in allen 81 berührten Dateien dieselben Bytes. Die Zahlen in diesem Plan sind die dabei gemessenen, wieder Windows 11, Node 24.16.0.
- **Dritte Runde (08.10.2026, N22–N24, zweite Nachprüfung):** Der Plan wurde wieder ganz auf eine frische Kopie abgespielt (283 Operationen, jeder Vorher-Text genau einmal), diesmal mit den Rot- und Grünläufen, Typechecks, Builds und Zählungen aller Aufgaben C1–C19, den Gegenproben, deren Änderung der Plan wörtlich nennt (C1, C3, C4, C8, C10–C13, die Zeilen mit N-Verweis in C15 und C17, C19), den Prüfungen von C21 samt ihren Gegenproben und einem Gesamtlauf am Ende (alle Selbsttests grün, `typecheck --workspaces` Exit 0). Nicht gelaufen sind die Gegenproben, die nur der jeweilige Schreiber gemessen hat (C14, die Zeilen ohne N-Verweis in C15 und C17), C20 Step 3 und der Durchgang selbst (von C20 nur das Anlegen des Skripts, `tsc` und die Zählung); `npm install --package-lock-only` aus C11 Step 2 lief in der Kopie nicht, dort wurde der erwartete Lockfile-Abschnitt eingespielt. Ein zweites Abspielen ohne Tests auf eine weitere frische Kopie ergab in allen 81 berührten Dateien dieselben Bytes. Laufzeiten stehen als Spannen über alle Runden. Windows 11, Node 24.16.0.
- **Vierte Runde (12.10.2026, N25–N42, Neuaufsatz auf `main`):** Der Plan wurde auf eine frische Kopie der neuen Basis `adda584693` abgespielt (283 Operationen, jeder Vorher-Text genau einmal). C1–C10 dort nur angewendet; C11–C21 Step für Step mit allen Rot- und Grünläufen, den Gegenproben mit wörtlich genannter Änderung (C11, C12, C13, die Zeilen mit N-Verweis in C15 und C17, C19, C21), Typechecks, Builds und Zählungen und dem Gesamtlauf aus C21 Step 9 (alle Selbsttests grün, `typecheck --workspaces` Exit 0). Von C20 nur das Anlegen des Skripts, `tsc`, die Zählung und der Launcher-Typecheck; nie ein Lauf. `npm install --package-lock-only` aus C11 Step 2 lief in der Kopie wieder nicht, dort wurde der erwartete Lockfile-Abschnitt eingespielt. Ein zweites Abspielen des geänderten Plans ohne Tests auf eine weitere frische Kopie ergab in allen 81 berührten Dateien dieselben Bytes (47 davon berühren C11–C21). C1–C10 hat ein eigener Messgang auf einer weiteren frischen Kopie Step für Step gemessen: alle Rot-, Grün- und Gegenprobenläufe, Typechecks (darunter `typecheck --workspaces` nach C4 und C5), Builds und Zählungen, ohne die Commit-Steps (N33). Nach dem Zusammenführen beider Messgänge wurde der fertige Plan zweimal ohne Tests auf je eine frische Kopie abgespielt: 283 Operationen, 0 Fehler, alle 81 berührten Dateien in beiden Kopien Byte für Byte gleich (N34). Nach der Nachprüfung (N35–N42, keine Operation geändert) sind die geänderten Laufzeiten auf einer frischen Kopie nachgemessen, und der fertige Plan ist noch einmal ohne Tests auf eine weitere frische Kopie abgespielt: 283 Operationen, 0 Fehler, alle 81 berührten Dateien Byte für Byte gleich der Messkopie. Windows 11, Node 24.16.0.

| Aufgabe | Rot (gemessen) | Grün (gemessen) |
| --- | --- | --- |
| C1 | 134 `ok`, dann `TypeError: leser.naechste is not a function` | `591 ok, 0 fehlgeschlagen.`; Typecheck master-link |
| C2 | 184 `ok`, 9 `FAIL`, `TypeError: v.sendeZeile …`; dann `ERR_MODULE_NOT_FOUND … show-daten` | `670 ok` |
| C3 | 547 `ok`, 8 `FAIL`, `TypeError: a.server.sendeDaten …` | 715 Prüfungen; einmal unter Fremdlast `714 ok, 1 fehlgeschlagen.` (Teil-1-Prüfung, siehe Konventionen); Typecheck master-link und Launcher |
| C4 | 719 `ok`, 5 `FAIL`, `TypeError: c.sende …`; dann `SyntaxError … 'eigeneAdressen'` | `756 ok`; Launcher `selftest:verbund` 188 |
| C5 | esbuild `2 errors` (`showFuerVerbund`, `VERBUND_EINSTELLUNGEN`) | iveo 190 ok-Zeilen; Timer 41; Rundown 404 + 81; `typecheck --workspaces` exit 0 |
| C6 | `241 ok, 14 fehlgeschlagen.` | 255 / 47 / 84 / 6 |
| C7 | `257 ok, 17 fehlgeschlagen.`; Hülle `ERR_MODULE_NOT_FOUND … iveo-side-events` | 274 / 52 / 84 / 6 |
| C8 | 188, dann `ERR_MODULE_NOT_FOUND … verbund\verteiler` | 188 + 44 |
| C9 | `SyntaxError … 'waehleReloadZiele'`; `276 ok, 1 fehlgeschlagen.`; `191 ok, 8 fehlgeschlagen.` | 277 / 52 / 84 / 12; 199 + 44; Build Launcher |
| C10 | `200 ok, 3 fehlgeschlagen.`; `SyntaxError … 'toolDatenText'` | 203 + 53; Launcher `selftest` 113; Build Launcher; Gegenprobe Einzahl `52 ok, 1 fehlgeschlagen.` (N16) |
| C11 | 50, dann `ERR_MODULE_NOT_FOUND` (Test, dann `verbund-anzeige`) | 50 + 64; Lockfile genau ein Abschnitt (+5/−1); CI-Liste 22 Schritte, der 4b-Schritt umbenannt, genau ein app-runtime-Schritt (N26); `typecheck --workspaces` exit 0 |
| C12 | 50 + 64, dann `ERR_MODULE_NOT_FOUND … verbund-daten` | 50 + 174 (nach ZF1, N3–N5 und N18); Gegenprobe N18 1 `FAIL` |
| C13 | `ERR_MODULE_NOT_FOUND … verbund-speicher` | 50 + 208; `index.ts` 15 Zeilen dazu, 0 weg (675 von 675 CRLF); `typecheck --workspaces` exit 0; Bündel Sync/Timer |
| C14 | `ERR_MODULE_NOT_FOUND … show-anwenden.ts`; Typecheck `TS5097` | 59 passed; Typecheck, Build, Preload 3 |
| C15 | `SyntaxError … 'ordnerPatchAbgelehnt'`; Zwischenstand 474 + 3 `FAIL`; 4 Typfehler im Main | 477; Typecheck; Gegenproben E22 je 1 `FAIL` (N17) |
| C16 | – | 477; Typecheck, Build, Preload 3, eine Registrierung |
| C17 | zwei `SyntaxError`; Zwischenstand 109; 4 Typfehler im Main | 443 + 109; Typecheck; Gegenproben `showLinkWeg` 2 / 1 / 2 `FAIL` (N15) |
| C18 | – | 443 + 109; Typecheck, Build, Preload 3, `showPfad` in 20 Zeilen, kein `verbundIgnoriert('deeplink'` |
| C19 | vor ZF2: `61 ok, 2 fehlgeschlagen.` (beide in M) | `63 ok`, 9–10 s (nach N12 mit Stille-Frist 2 s: 10,4–11 s, N35); Gegenproben 29 bzw. 7 `FAIL`; `selftest:verbund` 203 / 53 / 63 |
| C20 | Laden ohne `ELECTRON_EXE`: `ABBRUCH …`, Exit 2 (in der ersten Runde) | tsc ohne Meldung, 33 × `pruefe(`; der Durchgang selbst nicht (G8, beim Planen nie gelaufen) |
| C21 | – | JSON gültig, `Release-Vorbereitung ok`, Abnahme-Tabelle wortgleich (14 Schritte; die Zusatzprüfungen stehen als Liste unter der Tabelle), CRLF = LF; Gesamtlauf aller Tests grün, `typecheck --workspaces` exit 0 |

## Global Constraints

- **G1 Nicht anfassen:** `packages/suite-control-protocol`, `packages/companion-jm-suite`, `packages/zoom-bridge`, `apps/connect`, `apps/qa`, `apps/battle`, der Timer-Socket `:7777` (Server im Timer), `packages/master-link/src/koppeln.ts` (Spec 13.5), `apps/rundown/test/e2e-teil2a.mjs`, `packages/suite-manifest/suite.json` (zieht der Bot nach).
- **G2 Zoom Stage 4b auf `main` (Berührung klein halten):**
  - In `packages/app-runtime` kommt alles Neue in **neue Dateien**: `src/verbund-typen.ts`, `src/verbund-anzeige.ts`, `src/verbund-daten.ts`, `src/verbund-speicher.ts`, `src/verbund.ts`, `src/verbund-ipc.ts`, `test/verbund.test.ts`.
  - `src/index.ts` bekommt genau drei Einfügungen: (a) ein Export-Block direkt nach `export type { CspConfig } from './csp';` (Ist `:48`), (b) eine Importzeile `import { verbundAnClient } from './verbund';` direkt nach der Importzeile von `@jm/master-link` (Ist `:17`), (c) eine Zeile `verbundAnClient(client, { userData: app.getPath('userData'), log: info.log });` in `startMasterLink` direkt nach `client.starte();` (Ist `:387`): Der Folger startet erst, wenn der Client seine `master-link.json` gelesen hat (Zusammenführung ZF2). Keine bestehende Zeile wird verschoben, umformatiert oder gelöscht. (Ist-Zeilen auf `adda584693`; auf `5f8ed15ef8` waren es `:47`, `:16`, `:379`, N29.)
  - `packages/app-runtime/package.json` (Abhängigkeit `@jm/show`, devDependency `tsx`, Skript `selftest`) und der zugehörige Block in `package-lock.json` gehen in einen **eigenen Commit** (C11, Commit 1).
  - `.github/workflows/ci-checks.yml`: Im Job `selftests` steht danach **genau ein** Schritt mit `npm run selftest -w @jm/app-runtime` (Spec 19.6). Seit dem Neuaufsatz auf `adda584693` (N25) steht der 4b-Schritt „App-Laufzeit (Log-Aufräumen, CSP)“ mit diesem Befehl schon zuletzt im Job. C11 hängt nichts an, sondern benennt ihn um in „App-Laufzeit (Log-Aufräumen, CSP, Verbund-Anzeige, Abo-Zustand)“; der Job behält 22 Schritte (C11 Step 12, gemessen, N26). Der zweite Fall aus N22 (Stand ohne 4b, `5f8ed15ef8`: Schritt „App-Laufzeit (CSP, Verbund-Anzeige, Abo-Zustand)“ ans Ende anhängen, Textkonflikt beim Zusammenführen) ist mit dem Neuaufsatz entfallen.
  - Kein STATE-Schlüssel und keine Änderung in `packages/suite-control-protocol` oder `packages/companion-jm-suite`.
- **G3 Protokoll und Grenzen (Spec 13):** `PROTOKOLL` bleibt `1`, Fassung `1` (`SHOW_FASSUNG`). Neue `t` nur `abo`, `stand`, `aenderung`, mit lockeren Prüfern. Werte wörtlich:
  - Zeile nach der Anmeldung 1 MiB (`GRENZEN.nachAnmeldung = 1048576`, unverändert)
  - größte Stand-Zeile 921 600 Byte, gemessen als UTF-8-Bytes der fertigen Zeile mit `\n` (`GRENZEN.maxStandZeile`)
  - 32 Abos je `rechnerId` (`GRENZEN.maxAbosJeRechner`)
  - Stau-Grenze 1 MiB `socket.writableLength` je Sitzung (`GRENZEN.stauBytes = 1048576`)
  - Abo-Antwortfrist 5 s, Abo-Wiederholung 30 s, Anwende-Versuche 5 × 1 s (`VERBUND_FRISTEN` in app-runtime)
  - Zwischenspeicher schreiben: bis zu 5 Versuche im Abstand von 50 ms
  - „ohne Show-Daten (Update nötig)“ 10 s nach der Anmeldung (reine Anzeige im Verbund-Modal; Ausnahme von G13, siehe dort); Log-Drossel für „ignoriert“-Zeilen 60 s
- **G4 Ausschnitt (Spec 14, 22):** nur über `showFuerVerbund` und `VERBUND_EINSTELLUNGEN` (Freigabeliste). Nie `iveo.baseUrl`, `tools[].document`, `tools[].network`, nie ein Token. Tools schreiben nichts an den Master zurück; der Master wertet `stand`/`aenderung` von Clients nicht aus.
- **G5 Texte:** wörtlich aus Spec 15.5, 15.6, 16.1, 16.4 (V1–V15), 17.2, 17.3, 6.3/7.8 (wo berührt), mit deutschen Anführungszeichen „…“. Ausnahmen: Die Modal-Zeile heißt bei genau einem Bezieher „· 1 Tool bezieht sie“ (Owner-Entscheid 08.10.2026, E43, N16); zum Show-Link im Verbundmodus schreibt der Rundown statt der 16.1-Zeile eine eigene Zeile (E24, Auslegung 17.3 vor 16.1). Texte, die die Spec nicht vorgibt, stehen in der Liste „Texte ohne Spec-Vorgabe“ (Abschnitt „Entscheidungen“, E13) und gehen vor dem Release an den Owner.
- **G6 Logs:** nie ein Token, nie Dateiinhalt, nie die Meldung eines JSON-Parse-Fehlers. Gründe sind Feldnamen oder Fehlercodes (`EBUSY`), nie Werte aus dem Netz.
- **G7 Testläufer und Importe:**
  - Kein Test lädt Electron (die CI installiert mit `npm ci --ignore-scripts`).
  - `node --experimental-strip-types` (Timer, Rundown, Launcher-`selftest`, app-runtime-CSP): keine Paket-Laufzeitimporte in den getesteten Modulen, nur `import type`; relative Laufzeitimporte mit `.ts`-Endung.
  - Timer `src/shared/*.ts`: aus `@jm/show` nur Typen (Regel aus `show-ablauf.ts:1-10`).
  - Rundown `src/shared/*.ts`: keine `electron`-, `node:`- oder Paket-Laufzeitimporte, zwischen Modulen nur `import type` (R1-G8).
  - `tsx`: master-link, Launcher (`selftest:verbund`, `selftest:iveo`), Titler, app-runtime `test/verbund.test.ts`.
- **G8 Token, `%APPDATA%`, Netz:** Kein Agent liest ein Token oder Dateien unter `%APPDATA%`. Keine echten iveo-, Proxy- oder Netzdienste; Tests laufen gegen Attrappen und Sockets auf `127.0.0.1`. Nur der Durchgang C20 legt Dateien unter `%APPDATA%` beiseite und stellt sie wieder her, und nur nach der Zeile „Owner-Freigabe C20“ im Ledger.
- **G9 Versionen und Changelog (nur C21):** Launcher **0.15.0**, Timer **0.14.0**, Titler **0.11.0**, Rundown **0.8.0** in `package.json` und `package-lock.json`. `changelog.json` ohne ASCII-Anführungszeichen in Texten; vor dem Commit `node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8'))"`.
- **G10 Git:**
  - Ein Commit je Aufgabe (Ausnahme C11: zwei Commits nach G2), deutsch im Stil `feat(master-link): …`, Commit-Text ohne Umlaute, letzte Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - `git add` nur mit expliziten Pfaden, danach `git status --short` lesen (ein fehlender Pfad kippt den ganzen Befehl).
  - Kein Push, kein Tag, kein Merge, kein Release, kein PR. Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel.
  - Plantext und Ledger enthalten keine Anweisungen zu Push, Tag, Merge oder Release. Der Schlussabschnitt „Nach der Umsetzung (nur Controller und Owner)“ beschreibt sie.
- **G11 TDD und Typecheck:** Erst den Test rot sehen, dann Code. Jede Aufgabe endet mit `npm run typecheck -w <paket>` für jedes berührte Paket mit Typecheck (`@jm/master-link`, `@jm/launcher`, `@jm/timer`, `@jm/titler`, `@jm/rundown`). Ändert eine Aufgabe `packages/app-runtime/src` oder `packages/show/src`, läuft zusätzlich `npm run typecheck --workspaces --if-present` (25 Apps importieren app-runtime; app-runtime und show haben selbst keinen Typecheck). Ändert eine Aufgabe `packages/show/src`, laufen zusätzlich `npm run selftest -w @jm/timer` und `npm run selftest -w @jm/rundown` (beide laden `packages/show/src/index.ts` per Typ-Stripping, R1-Ruling zu B3).
- **G12 Zeilenenden:** `core.autocrlf=true`; die berührten Dateien liegen im Arbeitsbaum mit CRLF vor (`git ls-files --eol`). Änderungen mit dem Edit-Werkzeug (Vorher-Text exakt ersetzen), nicht mit `sed`. Neue Dateien schreibt das Write-Werkzeug mit LF; die Warnung „LF will be replaced by CRLF“ ist harmlos. Nach jeder Änderung gilt: Zahl der CRLF in einer geänderten Datei gleich ihrer Zeilenzahl, in einer neuen Datei 0. Gemessen wird mit dem Befehl unter „Konventionen in jeder Aufgabe“ (nicht mit `grep -c $'\r'`, das in der Git-Bash jede Zeile zählt).
- **G13 Uhr und Fristen:** Neue Fristen (app-runtime, Verteiler) laufen über eine übergebene Uhr bzw. Zeitgeber (`setTimeout`), nie über `Date.now()`-Differenzen. Die Empfangszeit „Stand hh:mm“ ist bewusst die Uhr von Rechner B (Spec 16.4). **Ausnahme (bewusst):** Die 10-s-Regel „ohne Show-Daten (Update nötig)“ im Verbund-Modal (C10, `toolDatenText`) vergleicht `Date.now()` im Renderer mit `seit` des Servers. Beides ist die Uhr des Master-Rechners, und es ist reine Anzeige: Springt dort die Uhr, erscheint der Hinweis zu früh, zu spät oder gar nicht; an Daten und Abos ändert das nichts. Ein Zeitgeber je Teilnehmer wäre der Weg ohne Uhrsprung (gehört zu FA12).
- **G14 Zweitinstanz:** Ohne Single-Instance-Lock gibt es keinen Client, kein Abo und kein Schreiben von `master-stand.json` (app-runtime startet den Client nur mit Lock, `index.ts:376-379`).
- **G15 Electron-Verdrahtung:** Logik steckt in reinen Funktionen mit Tests. Die dünne Electron-Schicht (IPC, Preload, Main-Aufrufe) prüfen Typecheck, `electron-vite build` der App und der Durchgang C20, soweit er sie erreicht; was er nicht startet (Show-Link, Startreihenfolge, Ordnerwahl, „Öffnen…“/„Neu“, Hinweis zur Rundown-Datei), steht in C16 und C18 unter „Regeln“ und als Handprüfung in der Abnahme-Datei (N17, N23).
- **G16 Abbruchregel:** Weicht ein gemessener Wert von der Erwartung im Plan ab (Rot- oder Grünzählung, `FAIL`-Zeile, Laufzeit über der genannten Grenze), hält der Ausführende an und meldet, statt Tests oder Erwartungen anzupassen. Ausnahme: Messwerte in Klammern einer grünen `ok`-Zeile (Kopierzähler, Rückdruck, Größen) sind Bezugswerte; eine andere Zahl dort gehört in den Bericht, ist aber kein Abbruchgrund.

## Testläufe (wie sie wirklich heißen)

Vorher gemessen am 08.10.2026 im Stand `5f8ed15ef8`; nachher gemessen beim Durchspielen aller 21 Aufgaben in einer frischen Kopie, zuletzt nach der dritten Runde N22–N24 (siehe „Wie dieser Plan entstanden ist“). Nach dem Neuaufsatz (vierte Runde, 12.10.2026, Basis `adda584693`) sind beide Spalten ganz nachgemessen: „Nach C21“ in C21 Step 9, „Vorher“ im Messgang C1–C10 vor C1 (Titler und app-runtime dort nach C10, das beide nicht berührt; N33). Geändert hat sich nur app-runtime (jetzt `50 passed`, N27); alle übrigen Vorher-Werte sind gleich geblieben, die Pakete ändert `main` seit `5f8ed15ef8` nicht. Alle Messungen: Windows 11, Node 24.16.0. Die CI (`ubuntu-latest`, `node-version: 22`) ist der erste Lauf unter Linux; zeitabhängige Prüfungen haben dafür Abstand zu ihren Fristen (N12).

| Paket | Befehl | Vorher | Nach C21 |
| --- | --- | --- | --- |
| `@jm/master-link` | `npm run selftest -w @jm/master-link` (tsx) | 572 ok, ca. 35 s | 756 ok, ca. 40 s |
| `@jm/launcher` | `npm run selftest -w @jm/launcher` (strip-types) | 113 ok | 113 ok |
| `@jm/launcher` | `npm run selftest:verbund -w @jm/launcher` (tsx; ab C8 `&& tsx test/verteiler.test.ts`, ab C19 `&& tsx test/verbund-kette.test.ts`) | 188 ok, ca. 16 s | 203 + 53 + 63 ok, 24,7–28 s (N35) |
| `@jm/launcher` | `npm run selftest:iveo -w @jm/launcher` (tsx, vier Dateien) | 239 / 47 / 84 / 6 ok | 277 / 52 / 84 / 12 ok |
| `@jm/iveo` (mit `@jm/show`) | `npm run selftest -w @jm/iveo` | 166 ok-Zeilen, „ALLE TESTS OK“ | 190 ok-Zeilen, „ALLE TESTS OK“ |
| `@jm/timer` | `npm run selftest -w @jm/timer` | 41 passed | 59 passed |
| `@jm/rundown` | `npm run selftest -w @jm/rundown` (zwei Läufe: `test/selftest.ts`, `test/gedaechtnis.test.ts`) | 404 + 81 ok-Zeilen, zweimal „ALLE TESTS OK“ | 443 + 109 ok-Zeilen |
| `@jm/titler` | `npm run selftest -w @jm/titler` (tsx) | 407 ok-Zeilen, „ALLE TESTS OK“ | 477 ok-Zeilen |
| `@jm/app-runtime` | `npm run selftest -w @jm/app-runtime` (ab C11 `… && tsx test/verbund.test.ts`) | 50 passed (CSP und Log-Aufräumen aus Zoom 4b; auf `5f8ed15ef8` waren es 15) | 50 + 208 passed |
| Typecheck | `npm run typecheck -w @jm/master-link` / `-w @jm/launcher` / `-w @jm/timer` / `-w @jm/titler` / `-w @jm/rundown`; bei app-runtime/show `npm run typecheck --workspaces --if-present` (31 Workspaces mit Typecheck, darunter `@jm/ui` und `@jm/settings` aus UX Welle 0) | exit 0 | exit 0 |
| Durchgang (nicht in der CI) | `npm run build -w @jm/timer -w @jm/titler -w @jm/rundown`, dann `ELECTRON_EXE=<electron.exe> node node_modules/tsx/dist/cli.mjs apps/launcher/test/e2e-teil2b-verbund.ts` | – | neu (C20); Lauf in der Umsetzung, freigegeben am 08.10.2026 |

„ok-Zeilen“ zählt `grep -cE '^\s*ok\b'` in der Ausgabe; Läufe mit eigener Zusammenfassung nennen sie (`… ok, 0 fehlgeschlagen.`, `… passed, 0 failed`).

## Konventionen in jeder Aufgabe

- **Arbeitsverzeichnis:** der Worktree-Wurzelordner, Befehle in der Git Bash. Voraussetzung jeder Aufgabe: die vorige ist committet und ihre Zählstände stimmen.
- **Zeilenenden prüfen (G12):**
  ```
  node -e "for (const f of process.argv.slice(1)) { const t = require('fs').readFileSync(f, 'utf8'); console.log(f, (t.match(/\n/g) || []).length, (t.match(/\r\n/g) || []).length); }" <Dateien>
  ```
  Ausgabe je Datei: Pfad, Zahl der Zeilen, Zahl der CRLF. Bei geänderten Dateien sind beide Zahlen gleich; neue Dateien (Write-Werkzeug) haben 0 CRLF.
- **Prüfzeilen mit Messwerten:** Einige `ok`-Zeilen tragen Messwerte in Klammern (Kopierzähler, Rückdruck, Größen). Die Erwartung ist die Prüfbedingung im Test; die Zahl im Plan ist die Messung vom 08.10.2026 als Bezug (G16).
- **Gegenproben** (Steps mit „Gegenprobe“ im Titel) ändern Code nur vorübergehend und werden genau zurückgenommen, bevor die Aufgabe weitergeht. Sie werden nie committet.
- **Zeitabhängige Teil-1-Prüfung unter Fremdlast:** Laufen mehrere Testläufe gleichzeitig, kann im master-link-Selbsttest die unveränderte Prüfung „Datei zweimal unlesbar → fehler:datei (Review Focus 3)“ (`test/client.test.ts`) einmal scheitern (beim Zusammenführen einmal gesehen, Lauf 77 s statt rund 40 s). Dann den Lauf einmal ohne Fremdlast wiederholen; bleibt die Zeile rot oder scheitert eine andere, gilt G16.
- **„Gliederung“ bzw. „Gerüst“** in den Aufgaben meint die Vorlage, aus der dieser Plan entstand. Ihr Inhalt steht vollständig hier: Global Constraints G1–G16, Review Focus, Entscheidungen E1–E29, Vormerkungen (dort „Abschnitt 8“) und Schnittstellen-Register (dort „Abschnitt 9“, S-A bis S-E). „Ist-Karte …“ verweist auf Bestandsaufnahmen des Codes vor dem Plan; die Aussage, um die es geht, steht jeweils dabei.
- **„Abweichungen vom Gerüst“** am Ende jeder Aufgabe nennt, wo die Aufgabe über das Schnittstellen-Register oder die Gliederung hinausgeht. Die Punkte sind im Abschnitt „Entscheidungen“ zusammengefasst.

## Review Focus (in die Tests der genannten Aufgabe)

1. **Umlaute und Mehrbyte-Zeichen an Grenzen.** Ein „ä“ liegt genau auf einer TLS-Stückgrenze; eine Show mit vielen Umlauten hat unter 900 000 Zeichen, aber über 921 600 Byte.
   - Erwartet: Die Zeile kommt unverändert an; der Verteiler misst Bytes der fertigen Zeile und schickt `zu-gross`.
   - Test: **C1** („Umlaut über die Stückgrenze“), **C8** (Nr. 4 „900 KiB in Bytes, nicht in Zeichen“, mit Gegenprobe).
2. **Schnelle Folge von Ständen.** Panel-Umschalten und Editor-Speichern am Master innerhalb von Millisekunden; danach kommt ein älterer Stand (kleinere Folge, gleiche Epoche) verspätet an, etwa aus einem nachgeholten Zeilenrest.
   - Erwartet: Nur neuere Stände werden angewendet; der ältere ruft `anwenden` nicht, und die Anzeige bleibt beim neueren.
   - Test: **C12** („älterer Stand nach neuerem“).
3. **Zwischenspeicher einer anderen Show desselben Masters.** Das Tool auf B war geschlossen, als der Master die Show wechselte. Beim Start wird Show X aus dem Zwischenspeicher mit `neueShow = false` angewendet; der erste Live-Stand trägt Show Y.
   - Erwartet: `neueShow = true` (gleicher Master, anderer `schluessel`), also Timer „initial“ und Rundown anderes Gedächtnis.
   - Test: **C12** („Start mit X, erster Stand Y“), **C17** (`entscheideMasterStand` über den Zeiger).
4. **`master-link.json` wird ohne Rollenwechsel neu geschrieben** (Slave-Launcher auf B aktualisiert `letzteAdresse` oder den Rechnernamen).
   - Erwartet: Der Verbundmodus bleibt, kein Wechsel auf `frueher`, keine Anzeige V13, kein Neuanwenden.
   - Test: **C12** („Datei geändert, Rolle und Master gleich“).
5. **Kaputter oder fremder Zwischenspeicher.** `master-stand.json` halb geschrieben, leer, `fassung: 2` oder mit einem Show-Objekt, das keine Show ist.
   - Erwartet: ignoriert mit einer Warnung ohne Dateiinhalt; das Tool startet wie ohne Zwischenspeicher und stürzt nie ab; der nächste angewendete Stand überschreibt die Datei.
   - Test: **C13** (Speicher-Tests), **C12** („Speicher liefert null“).

---

## Dateistruktur

Die Liste ist aus den Vorher/Nachher-Schritten des Plans abgeleitet (beim Durchspielen gezählt: 81 Dateien, 17 davon neu).

**Neu**
- `packages/master-link/src/show-daten.ts` (C2): Fassung, `DatenGrund`, `AboInhalt`, `StandInhalt`, `Pruefung`, `pruefeAbo`, `pruefeStand`, `kodiereAbo`, `kodiereStand`, `zeilenBytes`, `antwortFassung`.
- `packages/master-link/test/show-daten.test.ts` (C2): Regeln aus 13.2 und Kodierung, im Testläufer `test/selftest.ts` eingetragen.
- `apps/launcher/src/main/iveo-side-events.ts` (C7): reine Bildung der Side-Event-Liste (`toProgramList`, `bildeSideEventListe`), aus `iveo-sync.ts` herausgezogen, damit der Kern sie ohne Electron nutzt.
- `apps/launcher/src/main/verbund/verteiler.ts` (C8): Verteiler ohne Electron (15.1–15.3, 15.6).
- `apps/launcher/test/verteiler.test.ts` (C8, C10): Spec 19.3 Nr. 1–10.
- `apps/launcher/test/verbund-kette.test.ts` (C19): Spec 18 über die echte Kette ohne Electron.
- `apps/launcher/test/e2e-teil2b-verbund.ts` (C20): Durchgang 19.7, nicht in der CI.
- `packages/app-runtime/src/verbund-typen.ts`, `verbund-anzeige.ts` (C11), `verbund-daten.ts` (C12), `verbund-speicher.ts`, `verbund-ipc.ts`, `verbund.ts` (C13).
- `packages/app-runtime/test/verbund.test.ts` (C11–C13).
- `apps/timer/src/shared/show-anwenden.ts` und `apps/timer/src/shared/verbund.ts` (Brücken-Typ, E28) (C14).
- `packages/master-link/ABNAHME-2b.md` (C21).

**Geändert**
- `@jm/master-link`: `src/fristen.ts` (`GRENZEN`, C1), `src/rahmen.ts` (ZeilenLeser C1; `DatenZeile`, Prüfer C2), `src/verbindung.ts` (`aufDaten` C1; `sende`, `sendeZeile` C2), `src/index.ts` (eine `export *`-Zeile, C2), `src/server.ts` (C3), `src/client.ts` und `src/adresswahl.ts` (C4); Tests `test/rahmen.test.ts` (C1, C2), `test/selftest.ts` und `test/koppeln.test.ts` (nur ein Typfehler durch `sende(): boolean`, C2), `test/server.test.ts` (C3), `test/client.test.ts` und `test/adresswahl.test.ts` (C4).
- `@jm/show`: `packages/show/src/index.ts` (neue Exporte am Dateiende, C5). Test: `packages/iveo/test/selftest.ts` (C5).
- Launcher Main: `src/main/iveo-abgleich-kern.ts` (C6, C7, C9), `src/main/iveo-sync.ts` (C7, C9), `src/main/health.ts`, `src/main/reload-nachholen.ts`, `src/main/verbund/index.ts` (C9), `src/main/verbund/master.ts` und `src/main/verbund/kern.ts` (C9, C10).
- Launcher Shared/Renderer: `src/shared/types.ts`, `src/renderer/src/lib/verbund-texte.ts`, `src/renderer/src/components/VerbundMaster.tsx` (C10).
- Launcher Tests und Paket: `test/iveo-abgleich.test.ts` (C6, C7, C9), `test/iveo-huelle.test.ts` (C7), `test/reload-nachholen.test.ts` (C9), `test/verbund.test.ts` (C9, C10), `package.json` (`selftest:verbund` C8, C19; Version C21).
- `@jm/app-runtime`: `src/index.ts` (G2, C13), `package.json` (C11).
- Timer (C14): `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/src/sync/jm.d.ts`, `src/renderer/src/components/Topbar.tsx`, `tsconfig.node.json`, `tsconfig.web.json`, `test/selftest.ts`.
- Titler: `src/shared/datenquelle.ts`, `src/main/show-quelle.ts`, `test/selftest.ts` (C15); `src/main/index.ts` (Typ-Brücke C15, Verdrahtung C16); `src/shared/types.ts`, `src/preload/index.ts`, `src/renderer/src/views/OperatorView.tsx` mit der Einstellung › DataLink (C16).
- Rundown: `src/shared/ausgangsstand.ts` (Typen `GedaechtnisQuelle`, `Zeiger`), `src/main/gedaechtnis.ts`, `src/shared/conductor.ts`, `test/gedaechtnis.test.ts`, `test/selftest.ts` (C17); `src/main/index.ts` (Typ-Brücke C17, Ladewege C18); `src/main/conductor.ts`, `src/shared/types.ts`, `src/preload/index.ts`, `src/renderer/src/components/ToolLinks.tsx` (C18).
- CI: `.github/workflows/ci-checks.yml` (genau ein app-runtime-Schritt im Job `selftests`: der Schritt aus Zoom 4b, umbenannt; C11, G2, N26).
- Doku und Release (C21): `docs/suite-verbund.md` (Stand-Satz und neuer Abschnitt „Show-Daten im Verbund“), `docs/jm-show.md` (Absatz „Grenzen“), die vier `package.json` von Launcher, Timer, Titler, Rundown, `package-lock.json` (app-runtime-Block in C11, Versionen in C21), `packages/suite-manifest/changelog.json`.

**Unverändert, obwohl die Gliederung sie nannte:** `apps/titler/src/renderer/src/jmtitler.d.ts`, `apps/rundown/src/renderer/src/jmrundown.d.ts` (die Brücke kommt über `JmtitlerApi` bzw. `JmRundownApi` in `src/shared/types.ts`), `apps/rundown/src/renderer/src/App.tsx` (die V-Zeile abonniert `ToolLinks` selbst), `packages/master-link/test/aufbau.ts` und `test/rohclient.ts` (reichen aus).

**Nicht angefasst:** siehe G1.

## Bewusst nicht in diesem Plan

- Folgeaufgaben FA1–FA10 der Spec (Abschnitt 24) und die neuen FA11–FA23 (Abschnitt „Folgeaufgaben aus diesem Plan“).
- Release, Tags, Katalog, PR: nur beschreibend im Schlussabschnitt.
- Die Zwei-Rechner-Abnahme selbst (Owner, nach dem Release; C21 legt nur die Datei an).
- **Zusatzbitte des Owners „Zoom-Bridge: Shared Content als eigenständiges Signal“:** gehört nicht zu R2 (anderes Paket; Zoom Stage 4b ist seit PR #251 auf `main`, die Zusatzbitte ist eine eigene Zoom-Stufe danach, N37). Erledigt: Issue #247 (steuernde Sitzung, 08.10.2026: Machbarkeit geprüft, eigene Zoom-Stufe nach 4b); kein Punkt dieses Plans.

## Entscheidungen, wo die Spec schweigt

E1–E29 stammen aus der Gliederung. E30–E61 haben die Schreiber der Blöcke beim Ausformulieren getroffen; jede steht mit Grund in der genannten Aufgabe unter „Abweichungen vom Gerüst“. Bewusste Abweichungen von der Spec tragen **„Weicht ab“**; der Owner hat alle fünf (E6, E9, E14, E15, E47) am 08.10.2026 bestätigt. Eine Bestätigung steht für keine Entscheidung mehr aus (Owner 08.10.2026, N19); vor dem Release freizugeben sind nur die Texte ohne Spec-Vorgabe (Tabelle unten).

### Aus der Gliederung

1. **E1 ZeilenLeser-API:** `fuettere(stueck): void` und `naechste(): string | null`; die alte Form `fuettere(): string[]` entfällt. Die sechs alten Prüfungen (`rahmen.test.ts:73-85`) laufen über eine Testhilfe `alleZeilen(leser, stueck)`. Ein Kopierzähler hängt an einem optionalen Konstruktor-Parameter `messung?: { kopiert: number }` (nur im Test gesetzt). (C1)
2. **E2 Prüfung beim Empfänger:** Der Rahmen nimmt `abo`/`stand`/`aenderung` als beliebige Objekte an (`DatenZeile` mit Indexsignatur). Der Server meldet `daten` nur für ein Abo, das `pruefeAbo` besteht; ein ungültiges Abo ergibt eine Warnung je Sitzung und Grund. `stand`/`aenderung` prüft die app-runtime mit `pruefeStand`. (C2, C3, C12)
3. **E3 `abo` vor der Anmeldung** gilt wie jede unerwartete erste Nachricht: Verbindung zu (Ist `server.ts:250`). (C3)
4. **E4 `getrennt` in `stoppe()`:** synchron für jede angemeldete Sitzung, bevor die Map geleert wird; das spätere `ende` meldet nichts mehr (Merker je Sitzung). (C3)
5. **E5 Stau:** geprüft wird vor dem Schreiben (`writableLength > GRENZEN.stauBytes`). Nach `entstaut` schickt der Verteiler den neuesten Stand als `aenderung`, wenn er neuer ist als der zuletzt an diese Sitzung gesendete. (C3, C8)
6. **E6 `kopplung().letzteAdresse`:** Adresse der letzten Verbindung dieses Prozesses, sonst `kopplung.letzteAdresse` aus der Datei (wie `runde`, `client.ts:445`). **Weicht ab** von Spec 13.7 („aus master-link.json“): Ohne Launcher auf B veraltet der Dateiwert. Vom Owner bestätigt am 08.10.2026. (C4)
7. **E7 `istDieserRechner`:** wahr für `127.0.0.0/8`, `::1`, `localhost` und jede Adresse einer eigenen Karte (nach Entfernen von `::ffff:`, Klammern und IPv6-Zone, IPv6 ohne Rücksicht auf Groß/Klein); für einen Hostnamen nur, wenn er dem eigenen Hostnamen gleicht (ohne `.local`, ohne Schlusspunkt, ohne Rücksicht auf Groß/Klein). Jeder andere Hostname gilt als fremd (Ist-Karte Master 4: `svc.host` kann ein Hostname sein). (C4)
8. **E8 Vergleich des Ausschnitts** über die serialisierte Form einschließlich `updatedAt` (Spec 13.3 wörtlich). Jedes Speichern am Master ergibt deshalb einen neuen Stand; die Tools wenden ihn idempotent an. (C8)
9. **E9 Spec 18 („dieselbe Show wieder öffnen = neue Epoche“) gegen 19.3 Nr. 2 („keine neue Folge“):** Die Epoche wechselt nur beim Start der Rolle Master (13.3, 15.1). Wird dieselbe Show unverändert erneut gemeldet, entsteht keine neue Folge und keine `aenderung`. Die Zeile in 18 gilt für einen Launcher-Neustart mit derselben Show. Beides endet in V4 und gleichem Ergebnis. **Weicht ab** von Spec 18 („Master öffnet dieselbe Show wieder | neue Epoche“) für den Fall ohne Neustart der Rolle (N2). Vom Owner bestätigt am 08.10.2026. (C8, C19 C und I)
10. **E10 `meldeShow` nach dem Schreiben** liest die Datei über `leseShow(pfad)` zurück („wie sie in der Datei steht“, mit dem `updatedAt`, das die Hülle beim Schreiben setzt, `iveo-sync.ts:384-386`). Scheitert gerade dieses Zurücklesen (etwa EBUSY), meldet der Kern die eben geschriebene Show (ohne das `updatedAt` der Hülle), nie `null`: „nicht-lesbar“ gehört nur zu `offeneShowGespeichert` (15.1, N6). Die Abhängigkeit `meldeShow` ist optional; ohne sie liest der Kern nicht zurück, und die 239 bestehenden Kern-Prüfungen bleiben unverändert. (C6)
11. **E11 Fehlgeschlagenes `openShow`** (Parse-Fehler, `show.ts:32-37`) löst nichts aus; der Verbund verteilt weiter die Show, die der Launcher noch offen hat.
12. **E12 „Rolle Master läuft“** für den RELOAD-Filter heißt: Die Rolle in der `master-link.json` des Launchers ist `master` (nicht der Serverzustand). Der Verbund-Kern bekommt dafür `rolle()`. Tools auf B sind ohnehin im Verbundmodus und ignorieren RELOAD. (C9)
13. **E13 Texte ohne Spec-Vorgabe:** stehen gesammelt in der Liste unten („Texte ohne Spec-Vorgabe“); Owner-Freigabe vor dem Release, im Ledger vermerken.
14. **E14 Timer:** `timerAktionenAusShow(show, mode, eigeneListe)` mit drittem Parameter `eigeneListe: boolean`, weil der Timer-Selbsttest `@jm/show` nicht zur Laufzeit lädt (G7); der Aufrufer rechnet `hatEigeneTimerListe(settings)`. `show-anwenden.ts` importiert `./show-ablauf.ts` mit Endung; `tsconfig.node.json` und `tsconfig.web.json` des Timers bekommen `"allowImportingTsExtensions": true` (Präzedenz `apps/connect`, `apps/interpreter`, `apps/switcher`). **Weicht ab** von der Signatur in Spec 17.1. Vom Owner bestätigt am 08.10.2026. (C14)
15. **E15 Rundown:** `waehleLauncher(funde, kopplung, istHier)` mit einer Prüffunktion `istHier: (host: string) => boolean` statt `eigeneAdressen`, weil `src/shared` keine Paket-Laufzeitimporte hat (G7). Der Main übergibt `istHostDieserRechner` aus `@jm/app-runtime`. Der Rundown bekommt dadurch keine neue Abhängigkeit und keine Änderung der Bündel-Liste. **Weicht ab** von der Signatur in Spec 17.4. Vom Owner bestätigt am 08.10.2026. (C17, C18)
16. **E16 `verbundDatenErsetzt()`** löscht den Zwischenspeicher und setzt `angewendet` auf `null`. Aus `frueher` wird `einzelplatz`; andere Arten bleiben (die Verbindung läuft weiter). Die Tools rufen es nach jeder eigenen angewendeten Show außerhalb des Verbundmodus; Ergänzung siehe E56. (C12, C14, C16, C18)
17. **E17 Reihenfolge beim Start:** Der Zwischenspeicher wird angewendet, sobald beides gilt: Das Tool hat `folgeMasterShow` registriert, und der Client läuft (Lock, `whenReady`). Die Tools registrieren erst, wenn sie bereit sind: Timer nach `loadState()`, Titler in `starteDatenquelle`, Rundown vor dem ersten Laden einer Show; Ergänzung siehe E55. (C12, C13, C14, C16, C18)
18. **E18 Zwischenspeicher schreiben:** eigene kleine asynchrone Funktion (Zwischendatei, umbenennen, bis zu 5 Versuche à 50 ms bei `EPERM`/`EBUSY`/`EACCES`), nicht `schreibeAtomar` aus `@jm/master-link` (das blockiert bis zu 2 s synchron, `datei.ts:119-150`). (C13)
19. **E19 Drossel zentral:** `verbundIgnoriert(weg, pfad?)` in app-runtime schreibt die beiden Zeilen aus 16.1 höchstens einmal je Minute und Weg. Die Drossel liegt im reinen `VerbundFolger.ignoriert` (übergebene Uhr, E44). (C12, C13)
20. **E20 Verbund-Modal:** Die Texte sind reine Funktionen in `apps/launcher/src/renderer/src/lib/verbund-texte.ts`. Für die 10-s-Regel rendert das Modal alle 2 s neu, solange es offen ist. (C10)
21. **E21 Titler, gleiche Show im Master-Weg:** `quellSchritt` bestimmt sie selbst aus dem Zustand (`masterId` + `schluessel`), nicht aus einem Parameter des Aufrufers. Der Pfad-Weg bleibt wie in R1 (die doppelte Wahrheit `gleicheShow`/`showPfad` dort ist FA21). (C15)
22. **E22 Titler-Sperre im Main:** Bei Datenquelle `master` lehnen `titler:pickDataFolder`, `titler:setConfig` mit `dataFolder` und `titler:zurueckZumOrdner` ab (Log, Status unverändert); der Renderer zeigt den Text aus 17.2. Die Regeln sind rein und in C15 getestet: `ordnerWahlGesperrt` (Dialog, Knopf K1) und `ordnerPatchAbgelehnt` (Config-Patch, N17); im Main bleibt nur der Aufruf. (C15, C16)
23. **E23 Side-Event-Cache des Panels** bleibt, wie er ist; aufgefrischt wird die Liste in der Show (15.4). Das Panel liest weiter den Cache (FA22). (C7)
24. **E24 Rundown, Show-Deep-Link im Verbundmodus** (Auslegung: 17.3 vor 16.1; N15, ersetzt die Fassung aus N1): Der Rundown lädt aus dem Link nichts, weder Daten noch Dokument. 17.3 ist die Rundown-eigene Regel („Show-Deep-Link | Daten ignoriert“, „Eigene Rundown-Datei der Show: wird auf B nicht geladen“) und geht der allgemeinen Regel 16.1 („liefert nur noch Dokumente“) vor. Ein Show-Link kommt oft ohne bewusste Handlung (Launcher, Doppelklick) und darf einen laufenden Rundown nicht auf die erste Zeile setzen, GO-Folgen abbrechen oder das Gedächtnis der Master-Show überschreiben; „Öffnen…“ bleibt wie in 17.3 der bewusste Weg, eine `.jmrundown` zu laden. Der Rundown schreibt nicht die 16.1-Zeile („… liefert hier nur Dokumente …“, die hier nicht stimmte), sondern je Link eine eigene Infozeile „Verbund: Show-Link „⟨Name⟩“ – der Rundown folgt der Show vom Master und lädt daraus nichts.“ (⟨Name⟩ = Dateiname des Links über `kuerzeName`; ohne Drossel, ein Link ist eine einzelne Handlung). Die Entscheidung ist die reine Funktion `showLinkWeg` (C17, rot zuerst); C18 nutzt sie. Der stehende Hinweis aus 17.3 bleibt unverändert, weil nichts geladen wird. (C17, C18)
25. **E25 Rundown-Übergang „Name gleicht der Show“:** Vergleich nach `trim()`, ohne Rücksicht auf Groß/Klein; ein leerer Name gleicht nie. (C17)
26. **E26 Durchgang:** eigene Helfer im neuen Skript; `e2e-teil2a.mjs` bleibt unverändert. Die bekannten Schwächen werden nicht geerbt (`bis` mit `try/catch`, CDP wertet `error` aus, jede Prüfzeile mit Detail, Bildvergleich mit Gegenprobe „nicht leer“). (C20)
27. **E27 Namen:** app-runtime führt `VerbundDaten` nach Spec 16.2; `@jm/master-link` exportiert einen gleichnamigen anderen Typ (`speicher.ts:30`). app-runtime importiert aus `@jm/master-link` nur einzeln benannte Typen und Funktionen (etwa `kuerzeName`, N5; über `index.ts` auch re-exportiert, N15) und re-exportiert es nie als Ganzes. Die app-runtime-Prüfung heißt `istHostDieserRechner(host)`, die reine Funktion in master-link `istDieserRechner(host, eigeneAdressen, eigenerName?)`. (C4, C13)
28. **E28 Brücken-Typ in den Tools:** Jede Tool-App führt `interface VerbundAnzeigeZeile { text: string; farbe: 'gruen' | 'gelb' | 'rot' | 'gedaempft' }` (strukturgleich mit `VerbundAnzeige` aus app-runtime), damit `tsconfig.web.json` app-runtime (Electron-Typen) nicht einliest. Titler und Rundown in `src/shared/types.ts`; der Timer hat keine `types.ts` und bekommt dafür die neue Datei `src/shared/verbund.ts` (nur dieser Typ). Preload und Renderer-Typdatei importieren ihn mit `import type`. (C14, C16, C18)
29. **E29 Tools auf dem Master-Rechner** (Rolle `master` in der Datei) senden kein Abo. Bekäme der Verteiler doch ein Abo von `dieserRechner`, bedient er es wie jedes andere. (C8, C12)

### Aus den Blöcken (Transport, C1–C4)

30. **E30 `Verbindung.sende(): boolean`** liefert `true`, sobald die Zeile dem Socket übergeben ist, auch wenn `socket.write` wegen der Hochwassermarke `false` meldet; `false` nur bei geschlossener, schließender oder zerstörter Verbindung (Spec 13.6/13.7: „ob die Zeile in den Puffer ging“). Das Gliederungs-Register sagte „Rückgabe von `socket.write`“; damit hielte die Tool-Seite ein hinausgegangenes `abo` für verloren. `sendeZeile` wirft auch bei einem `\n` mitten in der Zeile. Prüfgrund für Nicht-Objekte ist `art`. (C2)
31. **E31 Server:** Sitzungs-Kennungen zählen je Server-Instanz ab 1 und werden nie wiederverwendet, auch nicht über `stoppe()`/`starte()`. In `sitzungEnde` kommt `getrennt` vor `aenderung`. Die drei neuen Ereignisse gehen über `sendeEreignis` mit Wurfschutz (Logzeile wie beim Client aus Teil 1). `daten` kommt auch für `art: 'launcher'`; das Ignorieren ist Sache des Verteilers. (C3)
32. **E32 `kopplung()`:** Bei Rolle `aus` ist der Master `null`, auch wenn die Datei noch eine Kopplung trägt. `adressen` stammen nur aus dem letzten `angemeldet` (leer bis zur ersten Anmeldung). `null` auch bei beschädigter Datei (`fehler:datei`). `eigeneAdressen` normiert Groß/Klein (IPv6) und `::ffff:`; ein leerer `eigenerName` erkennt keinen Hostnamen. (C4)

### Aus den Blöcken (Ausschnitt und Master-Launcher, C5–C10)

33. **E33 `showFuerVerbund` normalisiert selbst:** ruft intern `migrateShow` (idempotent) und kopiert das Ergebnis tief über JSON. `jm-player` und `jm-presenter` stehen mit leerer Liste in `VERBUND_EINSTELLUNGEN`. (C5)
34. **E34 `mitDokument` nur gültig:** „Dokument“ heißt nicht-leerer String nach `trim()` (wie der Rundown, `gedaechtnis.ts:260`); aufgenommen werden nur appIds nach `[a-z0-9-]{1,64}`, höchstens 64, ohne Doppelte. Sonst verwürfe jedes Tool den ganzen Stand (13.2, V15). (C5)
35. **E35 Größe:** gemessen als UTF-8-Bytes der fertigen `aenderung`-Zeile mit der Kandidaten-Folge und Fassung 1 (die `stand`-Zeile ist 4 Byte kürzer); KiB in Logzeilen und Modal = `Math.ceil(bytes / 1024)`. (C8)
36. **E36 `seListeIso` (15.4):** Startwert `syncedAt` der Show. Im Agenda-Modus rückt es auf den vor dem Zusatzabruf genommenen Zeitpunkt vor, sobald der Stand in der Datei steht (dieselbe Regel wie `lastSyncIso`, 7.2). Listen-Abfrage und Tagesübersicht bilden die Liste frisch aus dem Snapshot: `seListeIso = fetchedAt`, Merker gelöscht. (C7)
37. **E37 Merker „Side-Event-Liste veraltet“** liegt in `AktiveShow` (je offene Show, nur im Speicher). Ein gelungener Zusatzabruf löscht ihn sofort, auch wenn das Schreiben danach scheitert. (C7)
38. **E38 Statuszeile mit beiden Merkern:** Text `⟨6.3-Text⟩; ⟨15.4-Text⟩`, `seit` = der frühere der beiden Zeitpunkte (eine Uhrzeit, `iveo-status.ts` unverändert). (C7)
39. **E39 Verteiler überspringt gestaute Abos** beim Verteilen eines neuen Stands; nach `entstaut` kommt der neueste (E5). Die Abo-Grenze warnt einmal je Rechner, erneut erst, nachdem dort wieder Platz war. `nicht-lesbar` trägt `mitDokument = []` und `dateiName = basename(pfad)`, gesäubert mit `kuerzeName`. (C8)
40. **E40 Verteiler und Rolle:** `MasterRolle.stoppe()` stoppt den Verteiler nur, wenn die Rolle einen Server hatte. `showImVerbund` setzt der Verbund-Kern aus `Verteiler.stand()`; `MasterRolle.stand()` liefert `showImVerbund: null`. Dafür schließt `VerbundKernDeps.verteiler` `stand` ein (`MasterAbhaengigkeiten.verteiler` bleibt ohne). (C9, C10)
41. **E41 `neuAufsetzen` außerhalb „daten-beschaedigt“:** Warnung und Rückkehr ohne Wurf (die Oberfläche bietet den Knopf nur dort an); zwei alte Prüfungen in `verbund.test.ts` bringen den Master deshalb zuerst in „daten-beschaedigt“ (Vormerkung 9). (C9)
42. **E42 RELOAD-Ziele:** `health.ts` liest bei jedem Aufruf `eigeneAdressen(networkInterfaces())` und `hostname()` neu (Karten können wechseln, kein Zwischenspeicher). (C9)
43. **E43 Modal, Tools auf dem Master-Rechner:** Bei ihnen zeigt das Modal weder „bezieht Show-Daten“ noch „ohne Show-Daten (Update nötig)“: Sie abonnieren nicht (16.1, E29). Die Regel steht im Aufrufer (`VerbundMaster.tsx`); `toolDatenText` behält die Register-Signatur, dazu `OHNE_DATEN_NACH_MS`. Bei genau einem Bezieher heißt es „· 1 Tool bezieht sie“ (Owner 08.10.2026, N16), sonst wörtlich „⟨n⟩ Tools beziehen sie“. Alte Prüfungen, die Block B bewusst ändert: C7 Fixture `showMit` (P1–P3 statt P1–P2), `iveo-abgleich.test.ts:434` (Länge 3 statt 2), Prüfung „Nr. 13“; C9 die beiden `neuAufsetzen`-Prüfungen. (C7, C9, C10)

### Aus den Blöcken (Tool-Seite, C11–C13)

44. **E44 `VerbundFolger.ignoriert(weg, pfad?)`:** Die Drossel aus E19 liegt im reinen Folger (übergebene Uhr, Name des Masters); `verbundIgnoriert` ruft sie nur weiter. Der Test steht deshalb in C12. (C12, C13)
45. **E45 `VERBUND_FRISTEN` ist `Readonly<VerbundFristen>`** mit eigenem Interface statt `as const`, und der Konstruktor nimmt `fristen?: Partial<VerbundFristen>`. Mit `as const` ließe `Partial<typeof VERBUND_FRISTEN>` nur die Vorgabewerte zu; die Kette C19 braucht kurze Fristen. Werte unverändert. (C12)
46. **E46 V4 nennt den angewendeten Stand;** nur wenn von diesem Master noch nichts angewendet ist (Start, Handler noch nicht registriert, früherer Master), den empfangenen `letzter`. `grund` ohne Wert bei `show: null` zeigt wie `keine-show`. (C11)
47. **E47 Abo nur, wenn das Tool folgt:** Ein Tool schickt `abo` erst, wenn `folge()` gerufen ist; ist es da schon verbunden, sofort, sonst nach der nächsten Anmeldung (einmal je Verbindung). `startMasterLink` läuft in jedem Tool mit Master-Link (25 Apps); ohne diese Bedingung abonnierten auch Q&A, Battle, Caption usw. und belegten Plätze der 32-Abo-Grenze. Folge: Registriert ein Tool später als 10 s nach seiner Anmeldung, zeigt der Master bis dahin „ohne Show-Daten (Update nötig)“; die drei Tools registrieren gleich nach dem Start (E17). **Weicht ab** von Spec 12 und 16.1 („Abo nach jeder Anmeldung“ für Rolle Slave mit Kopplung): Tools ohne Anwenden abonnieren nie (N2). Vom Owner bestätigt am 08.10.2026. (C12)
48. **E48 Anwende-Ziel:** Ein gerade versuchter Stand zählt beim Vergleich „neu“ mit; ein Stand, der nicht neuer ist als das laufende Ziel, ersetzt es nicht. Wirft `anwenden`, folgen bis zu fünf neue Versuche im Abstand von 1 s (16.2 „bis zu fünfmal … erneut“, also höchstens sechs Aufrufe; Zusammenführung ZF1). Danach fällt das Ziel weg (`fehler` bleibt stehen); der nächste Stand, der neuer ist als der angewendete, wird wieder versucht, auch derselbe nach einem Neuabo. Ein älterer Stand derselben Epoche ersetzt `letzter` nicht (Review Focus 2). Die Versuche mit einem Stand vom Master enden auch, wenn der Verbund endet (N4) oder die Kopplung direkt auf einen anderen Master wechselt (16.1 „Anderer Master“, N18). (C12)
49. **E49 ⟨M⟩ und Grund:** ⟨M⟩ ist der Name aus der laufenden Anmeldung, sonst `kopplung.masterName`, sonst „Master“; in `frueher` der Name, der mit dem angewendeten Stand kam. Der Grund in `fehler` ist `err.code`, sonst der Fehlertyp, höchstens 40 Zeichen aus `[A-Za-z0-9_.-]`, nie die Meldung (G6). (C12)
50. **E50 Zwischenspeicher der Reihe nach:** Der Folger schreibt nie zwei Stände gleichzeitig; kommt während des Schreibens ein neuer, folgt danach nur der neueste. Kommt `ersetzt()` während des Schreibens, löscht er die Datei danach noch einmal. `darfSchreiben: false` unterdrückt Schreiben **und** Löschen (G14). `ersetzt()` vor `starte()` verhindert das spätere Anwenden des Zwischenspeichers; ein Stand vor `folge()` wird gemerkt und nach dem Zwischenspeicher angewendet, wenn er neuer ist. (C12)
51. **E51 Electron-Anbindung:** zusätzliche Exporte `standDatei(userData)`, `VERBUND_ANZEIGE_KANAL`, `registriereVerbundIpc(quelle)` (nicht über `index.ts`). `folgeMasterShow` und `verbundDatenErsetzt` dürfen vor dem Client-Start kommen und werden nachgereicht. `darfSchreiben` kommt aus `app.hasSingleInstanceLock()`. `index.ts` exportiert `verbundAnzeige` nicht (die Tools lesen die Zeile über IPC); zusätzlich exportiert es `nichtAngewendet` (N3) und `kuerzeName` aus `@jm/master-link` (für die Logzeile des Rundowns zum Show-Link, der `@jm/master-link` nicht als eigene Abhängigkeit hat, N15). `verbundAnClient` wirft nie (eine Warnung), sonst bräche auch der Master-Link-Client ab; es läuft direkt nach `client.starte()` (ZF2). (C13)

### Aus den Blöcken (Tools, C14–C18)

52. **E52 Timer:** `currentShowPath` bleibt beim Anwenden eines Master-Stands unverändert; nach dem Ende des Verbunds liest ein RELOAD wieder die zuletzt geöffnete eigene Show (wie 2a). Privater Helfer `wendeTimerShowAn(show, mode)` im Main. (C14)
53. **E53 Titler, reine Regeln:** `startZustand` hat den dritten Parameter mit Vorgabe `= null`; `nichtLesbar.gemerkt` und `tsvNichtGeschrieben(…).gemerkt` sind `GemerkteShowPfad | null`; H4 gilt auch bei Art `master` (nicht schreibbare TSV im Master-Weg, Wortlaut wie R1, FA19); zusätzlicher Typwächter `istMasterForm`. Wo 17.2 schweigt: gemerkt wird im Master-Weg nur bei Änderung; eine neue Show ohne Speaker im Verbund löscht `show-zuletzt.json`; `verbundEnde` ändert nur die Art `master`; Q4 nennt den vollen Showname (die Oberfläche kürzt). (C15)
54. **E54 Typ-Brücken eine Aufgabe früher:** `apps/titler/src/main/index.ts` wird schon in C15 und `apps/rundown/src/main/index.ts` schon in C17 berührt (je eine verhaltensgleiche Typ-Brücke), weil die neuen Unions sonst den Typecheck brechen (G11). C16 bzw. C18 bauen die Stellen danach aus. (C15, C17)
55. **E55 Start-Deep-Link nach der Registrierung** (Titler und Rundown): Die Registrierung `folgeMasterShow` kommt vor dem Show-Deep-Link beim Start, damit `imVerbundmodus()` beim Start-Deep-Link schon stimmt (16.3 „sofort Verbundmodus“, 17.2, E24). Ergänzt E17. Die Reihenfolge ist Verdrahtung im Main ohne eigene Entscheidung, die sich als reine Funktion testen ließe; C20 startet ohne Deep-Link. Sie steht deshalb als Handprüfung unter „Zusatzprüfungen (nicht in Spec 20)“ in der Abnahme-Datei (C21, N17). (C16, C18)
56. **E56 Ergänzung zu E16:** Titler-Ordnerwahl und Knopf K1 sowie Rundown „Öffnen…“ und „Neu“ außerhalb des Verbundmodus rufen ebenfalls `verbundDatenErsetzt()`. Sonst holte ein Neustart nach dem Entkoppeln die Daten des früheren Masters aus dem Zwischenspeicher zurück und verdrängte die Wahl des Bedieners. (C16, C18)
57. **E57 Titler, Main:** Name des Masters beim Start aus `verbundKopplung().masterName` (die Master-Form der gemerkten Show trägt keinen Namen; der Sperrtext braucht ihn). V12 bei Wurf: Der Main wirft `nichtAngewendet(⟨Fehlercode⟩)`, V12 lautet also „Show vom Master nicht übernommen: ⟨Fehlercode⟩“ (etwa `EBUSY`); den Zusammenhang mit der TSV zeigt H4 in der Quellzeile des Titlers (N3; ein einfaches `Error` ergab „…: Error“). Das Ende des Verbunds erkennt der Titler über `verbundEndetFuer` (N8). (C16)
58. **E58 Rundown, Gedächtnis:** Die Typen `GedaechtnisQuelle` und `Zeiger` sind in `src/shared/ausgangsstand.ts` definiert und aus `src/main/gedaechtnis.ts` re-exportiert (`entscheideMasterStand` in `src/shared/conductor.ts` braucht `Zeiger`, G7). `schreibeGedaechtnis` ohne gültige Quelle → `false` (bisher Hash des Arbeitsordners, #235). Zusätzlicher Export `mitRundownDokument`. (C17)
59. **E59 Rundown, Ladewege:** `Conductor` bekommt einen zweiten Konstruktor-Parameter `LauncherWahl` und `neuWaehlen()` (intern); vor `start()` baut `neuWaehlen()` keine Clients. Ein Slave ohne `masterId` geht als Einzelplatz (`null`) in `waehleLauncher`. „Übergang“ und „leer“ setzen `filePath` auf `null` und `dirty` auf `false`. Eine Master-Show ohne Ablauf und ohne Gedächtnis lässt das Dokument stehen (wie 2a 5.2). Ohne Schlüssel im Stand wirft `anwenden` `nichtAngewendet('SCHLUESSEL_FEHLT')`, V12 „Show vom Master nicht übernommen: SCHLUESSEL_FEHLT“ (N3). Ladeweg und Hinweis-Merker sind reine Funktionen aus C17 (`masterAusgang`, `dokumentHinweis`), ebenso die Entscheidung zum Show-Link (`showLinkWeg`, N15); `ladeMasterShow` rechnet erst und setzt dann den Zustand (N9). (C18)

### Aus den Blöcken (Kette, Durchgang, Abschluss, C19–C21)

60. **E60 Kette und Durchgang:** Am Master laufen in C19 `MasterLinkServer` und `Verteiler` direkt, verdrahtet wie `MasterRolle` (die Rolle selbst prüft C9). C19 deckt zusätzlich die Zeilen „Netz kurz/länger weg“, Slave-Launcher und Rolle „aus“; die Gegenproben laufen über den Schalter `KETTE_GEGENPROBE`. C20 prüft zusätzlich Port 8736, liest den Timer-Ablauf über den Timer-Socket 7777, startet in Prüfung 5 alle drei Tools neu und legt die ganzen `verbund`-Ordner beiseite. (C19, C20)
61. **E61 Abnahme und Doku:** Die Abnahme-Datei trägt über der wortgleichen Tabelle drei Voraussetzungen, darunter die vier Hinweise (M1, FA15, FA17, FA4) und den Abschnitt „Zusatzprüfungen (nicht in Spec 20)“ mit fünf Handprüfungen (N17, N23). `docs/suite-verbund.md` bekommt auch einen neuen Stand-Satz in Zeile 5. Die Notes nennen über die Pflichtpunkte hinaus, was ein Bediener merkt. (C21)

### Texte ohne Spec-Vorgabe (Owner-Freigabe vor dem Release)

| Ort | Text | Stufe | Aufgabe |
| --- | --- | --- | --- |
| Server, ungültiges Abo | „Master-Link: ungültiges Abo von ⟨Rechnername⟩/⟨appId⟩ (⟨Feld⟩), ignoriert.“ (einmal je Sitzung und Feld) | warn | C3 |
| Server, werfender Zuhörer | „Master-Link: Zuhörer von „⟨Ereignis⟩“ warf (⟨Code⟩).“ (Wortlaut des Clients aus Teil 1, neuer Ort) | warn | C3 |
| Kern, `meldeShow` wirft | „Verbund: Show-Stand nicht weitergegeben (⟨Fehlername⟩).“ | warn | C6 |
| Kern, Zusatzabruf scheitert (15.4 „eine Warnung“) | „iveo: Side-Event-Liste nicht abrufbar (⟨Fehler⟩), Liste aus der Datei bleibt.“ | warn | C7 |
| Kern, Statuszeile mit beiden Merkern | „iveo-Abgleich gestört: Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand; Side-Event-Liste von iveo nicht abrufbar, Liste aus früherem Stand (seit ⟨hh:mm⟩)“ | – | C7 |
| Verteiler, Launcher-Abo (15.2 „mit einer Logzeile“) | „Verbund: Abo von ⟨Rechnername⟩/⟨appId⟩ ignoriert, ein Launcher braucht keine Show-Daten.“ (einmal je Sitzung) | info | C8 |
| Verteiler, Stufen der Zeilen aus 15.6 | „verteilt“, „neues Abo“, Launcher-Abo = info; „zu groß“, „nicht lesbar“, „Abo-Grenze“, „gestaut“ = warn | – | C8 |
| MasterRolle, `neuAufsetzen` im falschen Zustand | „Master: „Verbund neu aufsetzen“ nur bei beschädigten Verbunddaten, nichts gelöscht.“ | warn | C9 |
| Modal, ein Bezieher | „· 1 Tool bezieht sie“ (Owner-Entscheid 08.10.2026, N16; Spec 15.5 wörtlich ergäbe „· 1 Tools beziehen sie“) | – | C10 |
| app-runtime, ungültiger Stand (13.2) | „Verbund: Show-Daten von „⟨M⟩“ verworfen (⟨t⟩, Feld ⟨Feld⟩).“ | warn | C12 |
| app-runtime, übernommen | „Verbund: Show „⟨S⟩“ vom Master „⟨M⟩“ übernommen (Stand ⟨Folge⟩[, neue Show]).“ | info | C12 |
| app-runtime, nicht übernommen | „Verbund: Show vom Master „⟨M⟩“ nicht übernommen (⟨Code⟩), neuer Versuch in 1 s.“ bzw. „… nicht übernommen (⟨Code⟩), weiter erst mit dem nächsten Stand.“ | warn | C12 |
| app-runtime, werfender Zuhörer | „Verbund: Zuhörer von „⟨Name⟩“ warf (⟨Code⟩).“ | warn | C12 |
| app-runtime, Zwischenspeicher nicht lesbar (16.3) | „Verbund: Zwischenspeicher nicht lesbar (⟨Grund⟩), wird beim nächsten Stand überschrieben.“ | warn | C13 |
| app-runtime, Zwischenspeicher nicht geschrieben | „Verbund: Zwischenspeicher nicht geschrieben (⟨Code⟩).“ | warn | C13 |
| app-runtime, Start gescheitert | „Verbund: nicht gestartet (⟨Code⟩).“ | warn | C13 |
| Titler, Ordnerwahl abgelehnt | „DataLink: Ordnerwahl abgelehnt. ⟨Text aus 17.2⟩“ | – | C16 |
| Titler, V12-Grund | der Fehlercode der TSV, also „Show vom Master nicht übernommen: ⟨Fehlercode⟩“ (etwa `EBUSY`; `nichtAngewendet`, N3) | – | C16 |
| Rundown, V12-Grund ohne Schlüssel | „Show vom Master nicht übernommen: SCHLUESSEL_FEHLT“ (`nichtAngewendet('SCHLUESSEL_FEHLT')`, N3; laut 13.1 ausgeschlossen) | – | C18 |
| Rundown, Show-Link im Verbundmodus (statt der 16.1-Zeile, E24) | „Verbund: Show-Link „⟨Name⟩“ – der Rundown folgt der Show vom Master und lädt daraus nichts.“ (je Link; ⟨Name⟩ = Dateiname über `kuerzeName`; `showLinkWeg`, N15) | info | C17, C18 |

## Vormerkungen: in R2 oder Folgeaufgabe

Aus der Teil-1-Schlussprüfung, den geparkten Punkten aus Teil 1 und den offenen Punkten aus R1. In R2 kommt ein Punkt nur, wenn die Spec ihn verlangt oder R2 den Code ohnehin anfasst.

| # | Vormerkung | Entscheidung | Grund | Aufgabe |
| --- | --- | --- | --- | --- |
| 1 | ZeilenLeser prüft alle Zeilen eines TLS-Stücks gegen die alte Grenze; Zeilen im selben Stück wie `angemeldet` gehen verloren | **R2** | Spec 13.5 Zeilen 1–2 | C1 |
| 2 | Übergabe nach `angemeldet`: `betreibe` verwirft nachgeholte `stand`/`aenderung` | **R2** | Spec 13.5 Zeile 3 | C4 |
| 3 | `removeAllListeners` nach `gekoppelt` (`koppeln.ts:158`) | **keine Reparatur**, Regressionstest | Spec 13.5 „Koppeln braucht keine Reparatur“; der Test fehlte | C3 |
| 4 | Sitzungs-Obergrenze je `rechnerId` | **FA11** | nicht in der Spec; eine neue Ablehnung änderte das Protokollverhalten; die 32-Abo-Grenze schützt die Show-Daten | – |
| 5 | Monotone Uhr in master-link (`Date.now` in server/client/speicher) | **FA12** | R2 vergleicht keine Zeiten über Rechner; neue Fristen laufen nach G13 über Zeitgeber. Ausnahme ist die reine Anzeige „ohne Show-Daten (Update nötig)“ im Modal (C10, Uhr des Master-Rechners, G13) | – |
| 6 | `mdnsGesehen` über zwei Runden | **FA13** | betrifft nur den Fehlertext; V11 übernimmt Client-Texte unverändert | – |
| 7 | mDNS-Sockets bleiben im Zustand verbunden offen | **FA14** | R2 fügt keinen Client hinzu (jedes Tool hat seit Teil 1 einen); eine Änderung träfe das Wiederverbinden aus Teil 1 und ist nicht in der Spec; ungemessen | – |
| 8 | Slave-Umbenennung erreicht den Master erst bei der nächsten Anmeldung | **FA15**, Hinweis in der Abnahme | R2 ändert keinen Namensweg | C21 (Hinweis) |
| 9 | `neuAufsetzen` ohne Zustandsprüfung (`master.ts:482`, `kern.ts:373`) | **R2, klein** | C9 ändert `master.ts`/`kern.ts` ohnehin; ein Fehlaufruf löscht Identität und Verbund | C9 (E41) |
| 10 | Datei-Wache ↔ `koppele()` ohne `nacheinander` | **FA16** | Slave-Launcher-Weg, kein Bezug zu R2 (15.2) | – |
| 11 | R1: Editor mit Merker geöffnet, Liste kommt zurück, Speichern → ein Takt falsche Störung | **FA17**, Hinweis in der Abnahme | R2 ändert den Show-Editor nicht; der Merker reist nun mit (19.2) und ist auf B sichtbar | C21 (Hinweis) |
| 12 | R1: Agenda-Zeile vor `istAktuell` | **erledigt** (Commit `6fd1de88d6`, `iveo-abgleich-kern.ts:736`) | C6 fügt `meldeShow` hinter dieser Zeile ein und verschiebt sie nicht; eine Prüfung hält das fest | C6 |
| 13 | R1: `loeseSideEventLeicht` warnt vor `istAktuell` | **FA18** | Die Spec verlangt es nicht; Verhalten aus R1 (die Warnung eines verworfenen Umschaltens) ohne Bezug zu den Show-Daten. Einen neuen Text bräuchte die Behebung nicht (die vorhandene Warnung „iveo switch: Speakerliste nicht abrufbar …“ wanderte nur hinter `istAktuell`), und C7 Step 11 ändert `umschaltenJetzt` an dieser Stelle; mitgenommen wird sie trotzdem nicht, damit C7 bei 15.4 bleibt | – |
| 14 | R1: H4-Text bei TSV-Schreibfehler | **FA19** (Owner-Text) | Der Master-Weg im Titler nutzt denselben H4-Weg (`tsvNichtGeschrieben`); der Wortlaut bleibt | C15, C16 |
| 15 | R1: Rundown-Picker bei Gleichnamigen | **FA20** | R2 ändert den Picker nicht; löst sich mit der iveo-Kennung (M1) | – |
| 16 | R1-Politur (Task 8/9/10/15/16, `keepListener`, `mitSpeakern`/`gleicheShow` im Pfad-Weg) | **FA21**; im neuen Master-Weg gilt E21 | R2 fasst Tabellenkern, Abruf und Picker nicht an | C15 (E21) |
| 17 | R1 Task 14: OperatorView-Zweig `ohneOrdner` | **mitprüfen**, Änderung nur bei Befund | C16 öffnet die Datei ohnehin; ohne Befund unverändert | C16 |
| 18 | R1 Task 17: Schwächen des Durchgangs | **im neuen Skript nicht erben** (E26) | altes Skript bleibt | C20 |
| 19 | Panel-Cache gegen Show-Liste der Side Events | **FA22** (E23) | Spec schweigt; 15.4 nennt nur die Show-Liste | – |
| 20 | Keine Datei-Beobachtung der offenen Show (Handänderung wird nicht verteilt) | **FA23** | Der Launcher bemerkt sie selbst nicht; Spec 15.1 nennt nur die vier Auslöser | – |

## Folgeaufgaben aus diesem Plan (FA11–FA23)

Sie ergänzen FA1–FA10 der Spec (Abschnitt 24). Ein Bediener merkt FA15, FA17 und FA20; die Abnahme-Datei (C21) und der Abschnitt „Show-Daten im Verbund“ in `docs/suite-verbund.md` nennen sie.

| # | Aufgabe | Warum nicht jetzt |
| --- | --- | --- |
| FA11 | **Sitzungs-Obergrenze je `rechnerId`** am Master-Server | nicht in der Spec; eine neue Ablehnung ändert das Protokollverhalten. Die 32-Abo-Grenze (13.4) schützt die Show-Daten. |
| FA12 | **Monotone Uhr in master-link** (`Date.now` in Server, Client, Speicher); dazu die 10-s-Regel im Verbund-Modal als Zeitgeber je Teilnehmer | R2 vergleicht keine Zeiten über Rechner; die neuen Fristen laufen über Zeitgeber (G13). Die Modal-Regel ist reine Anzeige mit der Uhr des Master-Rechners (Ausnahme in G13). |
| FA13 | **`mdnsGesehen` über zwei Runden** | betrifft nur den Fehlertext; V11 zeigt die Client-Texte unverändert. |
| FA14 | **mDNS-Sockets im Zustand verbunden schließen** | Änderung am Wiederverbinden aus Teil 1, nicht in der Spec, ungemessen. |
| FA15 | **Slave-Umbenennung sofort am Master** | Heute erst bei der nächsten Anmeldung; R2 ändert keinen Namensweg. Hinweis in der Abnahme. |
| FA16 | **Datei-Wache und `koppele()` nacheinander** | Slave-Launcher-Weg, ohne Bezug zu R2. |
| FA17 | **Ein Takt falsche Störung** nach Editor-Speichern mit Merker | R2 ändert den Show-Editor nicht; der Merker ist auf B sichtbar. Hinweis in der Abnahme. |
| FA18 | **`loeseSideEventLeicht` warnt vor `istAktuell`** (die vorhandene Warnung hinter `istAktuell` verschieben, Test „verworfenes Umschalten → keine Warnung“) | Die Spec verlangt es nicht; Verhalten aus R1 ohne Bezug zu den Show-Daten. Ein neuer Text wäre nicht nötig. |
| FA19 | **H4-Text bei TSV-Schreibfehler** (Owner-Text) | Der Master-Weg nutzt den H4-Weg aus R1 unverändert. |
| FA20 | **Rundown-Picker bei Gleichnamigen** | löst sich mit der iveo-Kennung (M1). |
| FA21 | **R1-Politur** (`keepListener`, `mitSpeakern`/`gleicheShow` im Pfad-Weg des Titlers u. a.) | R2 fasst Tabellenkern, Abruf und Picker nicht an. |
| FA22 | **Panel-Cache der Side Events** an die Show-Liste angleichen | Spec schweigt; 15.4 nennt nur die Liste in der Show (E23). |
| FA23 | **Datei-Beobachtung der offenen Show am Master** (Handänderung verteilen) | Der Launcher bemerkt sie selbst nicht; 15.1 nennt nur vier Auslöser. |

## Schnittstellen-Register (Stand nach der Zusammenführung, verbindlich)

Diese Namen und Signaturen gelten für alle Aufgaben; die Code-Blöcke der Aufgaben setzen sie wörtlich um (beim Durchspielen geprüft). Gegenüber der Gliederung geänderte oder ergänzte Stellen tragen den Verweis auf ihre Entscheidung.

### S-A · `@jm/master-link` (C1–C4)

```ts
// fristen.ts — GRENZEN erweitert (bestehende Werte unverändert) — C1
GRENZEN.maxStandZeile    // 921_600   UTF-8-Bytes der fertigen Zeile samt '\n' (Spec 13.4)
GRENZEN.maxAbosJeRechner // 32        (Spec 13.4)
GRENZEN.stauBytes        // 1_048_576 socket.writableLength je Sitzung (Spec 13.6)

// rahmen.ts — C1, C2
export class ZeilenLeser {
  constructor(grenze: number, messung?: { kopiert: number });
  setzeGrenze(grenze: number): void;
  fuettere(stueck: Buffer): void;            // hängt an, sucht '\n' nur im neuen Stück, wirft nie
  naechste(): string | null;                 // eine Zeile; wirft ZeileZuLang gegen die AKTUELLE Grenze
}
export interface DatenZeile { t: 'abo' | 'stand' | 'aenderung'; [feld: string]: unknown }
export type Nachricht = /* acht Teil-1-Typen */ | DatenZeile;
// PRUEFER: ['abo', () => true], ['stand', () => true], ['aenderung', () => true] — nie 'kaputt'

// verbindung.ts (class Verbindung) — C2, E30
sende(n: Nachricht): boolean;          // true: dem Socket übergeben; false: geschlossen, schließend oder zerstört
sendeZeile(zeile: string): boolean;    // fertige Zeile (kodiereStand); wirft ohne genau ein '\n' am Ende

// show-daten.ts (neu, in index.ts: export * from './show-daten') — C2
export const SHOW_FASSUNG = 1;
export type DatenGrund = 'keine-show' | 'zu-gross' | 'nicht-lesbar';
export interface AboInhalt { art: 'show'; fassung: number }
export interface StandInhalt {
  art: 'show'; fassung: number; epoche: string; folge: number;
  schluessel: string | null; show: Record<string, unknown> | null; grund?: DatenGrund; mitDokument: string[];
}
export type Pruefung<T> = { ok: true; wert: T } | { ok: false; grund: string };   // grund = Feldname aus Tabelle 13.2
export function pruefeAbo(o: unknown): Pruefung<AboInhalt>;
export function pruefeStand(o: unknown): Pruefung<StandInhalt>;   // für t 'stand' und 'aenderung'
export function kodiereAbo(fassung?: number): string;             // '{"t":"abo","art":"show","fassung":1}\n'
export function kodiereStand(t: 'stand' | 'aenderung', s: StandInhalt): string;  // genau eine Zeile mit '\n'
export function zeilenBytes(zeile: string): number;               // Buffer.byteLength(zeile, 'utf8')
export function antwortFassung(erbeten: number): number;          // Math.min(erbeten, SHOW_FASSUNG)

// server.ts — C3, E31
export interface TeilnehmerDaten { sitzung: number; schluessel: string; rechnerId: string; art: 'tool' | 'launcher'; appId: string; dieserRechner: boolean }
export type SendeErgebnis = 'gesendet' | 'gestaut' | 'weg';
export interface TeilnehmerStand extends TeilnehmerInfo { rechnerId: string; adresse: string; seit: number; letzteZeile: number; sitzung: number }
class MasterLinkServer {
  // Ereignisse (neu): 'daten' (t: TeilnehmerDaten, abo: AboInhalt) · 'getrennt' (sitzung: number) · 'entstaut' (sitzung: number)
  // 'aenderung' (Teilnehmerliste) und 'warnung' (Text) bleiben unverändert.
  sendeDaten(sitzung: number, zeile: string): SendeErgebnis;   // 'weg' auch, wenn der Server nicht läuft
}

// client.ts — C4, E6, E32
export interface KopplungInfo { rolle: Rolle; masterId: string | null; masterName: string | null; letzteAdresse: string | null; adressen: string[] }
class MasterLinkClient {
  sende(n: Nachricht): boolean;          // nur im Zustand verbunden mit offener Verbindung, sonst false
  kopplung(): KopplungInfo | null;       // null: master-link.json fehlt oder ist beschädigt (fehler:datei)
  // Ereignis (neu): 'daten' (n: DatenZeile) für t 'stand' und 'aenderung', auch nachgeholte; immer nach 'angemeldet'; ungeprüft
}

// adresswahl.ts — C4, E7
export function eigeneAdressen(ni: NetzwerkInterfaces): string[];   // alle Adressen aller Karten, inkl. intern, ohne Zone
export function istDieserRechner(host: string, eigeneAdressen: readonly string[], eigenerName?: string): boolean;
```

### S-B · `@jm/show` und Master-Launcher (C5–C10)

```ts
// packages/show/src/index.ts (neue Exporte am Dateiende) — C5, E33, E34
export const VERBUND_EINSTELLUNGEN: Readonly<Record<string, readonly string[]>>;  // Tabelle 14.2 wörtlich, eingefroren
export interface VerbundAusschnitt { show: Show; lokalGeblieben: string[]; mitDokument: string[] }
export function showFuerVerbund(show: Show): VerbundAusschnitt;   // Eingabe bleibt unverändert, Ergebnis teilt kein Objekt mit ihr

// apps/launcher/src/main/iveo-abgleich-kern.ts — KernAbhaengigkeiten (neu, beide optional) — C6, C9
meldeShow?(pfad: string, show: Show | null): void;                // null = gerade gespeichert und nicht lesbar
verbundReload?(): { andereRechner: number } | null;               // null = Rolle nicht Master (alte RELOAD-Logzeile)
export type IveoClientLike = Pick<IveoClient, /* bisherige */ | 'listPrograms'>;   // C7
export function ablaufSignatur(ablauf, speakers, speakerVeraltetSeit?, sideEvents: ShowIveoProgramRef[] = []): string;  // C7

// apps/launcher/src/main/iveo-side-events.ts (neu, rein) — C7
export function toProgramList(programs: IveoProgram[]): IveoProgramRef[];   // unverändert verschoben
export function bildeSideEventListe(programs: IveoProgram[], filter: IveoProgramFilter): ShowIveoProgramRef[];

// apps/launcher/src/main/verbund/verteiler.ts (neu, ohne Electron) — C8
export interface VerteilerServer { sendeDaten(sitzung: number, zeile: string): SendeErgebnis }
export interface VerteilerAbhaengigkeiten {
  log(stufe: 'info' | 'warn', text: string): void;
  rechnerName(rechnerId: string): string;
  neueEpoche?: () => string;              // Vorgabe crypto.randomUUID
  aufloesen?: (p: string) => string;      // Vorgabe path.resolve
  jetzt?: () => number;                   // Vorgabe Date.now (nur Anzeige „Stand hh:mm“ am Master)
  beiAenderung?: () => void;              // Modal neu melden
}
export interface VerteilerStand {
  grund: DatenGrund | null; showName: string | null; dateiName: string | null;
  verteiltAm: number | null; groesseKiB: number | null; epoche: string | null; folge: number | null;
  abos: { sitzung: number; rechnerId: string; appId: string }[];
}
export class Verteiler {
  constructor(d: VerteilerAbhaengigkeiten);
  starte(server: VerteilerServer): void;          // neue Epoche, Abos leer, Stand aus der gemerkten Show, Folge 0
  stoppe(): void;                                 // Abos leer, Epoche null, sendet nichts mehr; die gemerkte Show bleibt
  meldeShow(pfad: string, show: Show | null): void;   // merkt auch ohne laufende Rolle; null = nicht-lesbar
  aufAbo(t: TeilnehmerDaten, abo: AboInhalt): void;
  aufGetrennt(sitzung: number): void;
  aufEntstaut(sitzung: number): void;
  hatAbo(sitzung: number): boolean;
  stand(): VerteilerStand;
  abosAndererRechner(): number;
}
export function verbundSchluessel(pfad: string, aufloesen?: (p: string) => string): string;  // 16 Hex, Formel 2a-Spec 4.7

// apps/launcher/src/main/verbund/master.ts — MasterAbhaengigkeiten (neu, optional) — C9
verteiler?: Pick<Verteiler, 'starte' | 'stoppe' | 'aufAbo' | 'aufGetrennt' | 'aufEntstaut' | 'hatAbo'>;
// apps/launcher/src/main/verbund/kern.ts — C9, C10, E12, E40
//   VerbundKernDeps.verteiler?: Pick<Verteiler, 'starte' | 'stoppe' | 'aufAbo' | 'aufGetrennt' | 'aufEntstaut' | 'hatAbo' | 'stand'>
//   Rückgabe von erzeugeVerbundKern zusätzlich: rolle(): VerbundRolle   (Rolle aus master-link.json)
// apps/launcher/src/main/verbund/index.ts — C9
export function meldeShowAnVerbund(pfad: string, show: Show | null): void;
export function verbundReloadInfo(): { andereRechner: number } | null;   // null, wenn Rolle nicht master (E12)

// apps/launcher/src/main/reload-nachholen.ts — C9
nachSenden(appId: string, zeile: string, erreicht: number, nurDieserRechner?: boolean): void;
beiVerbindung(appId: string, aufDiesemRechner?: boolean): string | null;
export function waehleReloadZiele<T extends { appId: string; host: string; verbunden: boolean }>(
  eintraege: readonly T[], appId: string, istHier: ((host: string) => boolean) | null): T[];
// apps/launcher/src/main/health.ts — C9, E42
export function sendControlCommand(appId: string, line: string, opt?: { nurDieserRechner?: boolean }): number;

// apps/launcher/src/shared/types.ts — C10
export interface VerbundShowStand {
  grund: 'keine-show' | 'zu-gross' | 'nicht-lesbar' | null;
  showName: string | null; dateiName: string | null; verteiltAm: number | null; groesseKiB: number | null; bezieher: number;
}
// VerbundMasterStand.showImVerbund: VerbundShowStand | null; VerbundTool.bezieht: boolean
// apps/launcher/src/renderer/src/lib/verbund-texte.ts — C10, E43
export function verbundShowZeile(s: VerbundShowStand, uhrzeit: (ms: number) => string): { text: string; rot: boolean };
export function toolDatenText(appId: string, verbundenSeit: number, bezieht: boolean, jetzt: number): string | null;
export const OHNE_DATEN_NACH_MS = 10_000;
```

### S-C · `@jm/app-runtime` (C11–C13)

```ts
// verbund-typen.ts — wörtlich Spec 16.2, DatenGrund aus @jm/master-link — C11
export interface MasterStand { masterId: string; masterName: string; epoche: string; folge: number; schluessel: string | null;
  show: Show | null; grund?: DatenGrund; mitDokument: string[]; empfangenAm: number }
export type VerbundDaten = { art: 'einzelplatz' } | ({ art: 'warte' } & MitStand) | ({ art: 'ohne-daten' } & MitStand)
  | ({ art: 'aktuell'; letzter: MasterStand } & MitStand) | ({ art: 'getrennt'; client: ClientZustand } & MitStand)
  | ({ art: 'frueher'; grund: 'entkoppelt' | 'datei' } & MitStand) | { art: 'datei-defekt' };
export interface VerbundKopplung { rolle: 'aus' | 'master' | 'slave'; masterId: string | null; masterName: string | null;
  masterAdresse: string | null; adressen: string[]; letzteAdresse: string | null }
export interface VerbundAnzeige { text: string; farbe: 'gruen' | 'gelb' | 'rot' | 'gedaempft' }
export interface FolgeHandler { anwenden(stand: MasterStand & { show: Show }, neueShow: boolean): void; beiWechsel?(d: VerbundDaten): void }

// verbund-anzeige.ts (rein) — C11, E46
export function verbundAnzeige(d: VerbundDaten, uhrzeit?: (ms: number) => string): VerbundAnzeige | null;
export function kuerzeShowName(name: string): string;     // höchstens 40 Code Points, sonst 39 + '…'

// verbund-daten.ts (rein, Zustandsmaschine) — C12, E44, E45, E47–E50
export interface VerbundFristen { antwortMs: number; aboWiederholMs: number; anwendeVersuche: number; anwendePauseMs: number }
export const VERBUND_FRISTEN: Readonly<VerbundFristen>;   // { antwortMs: 5000, aboWiederholMs: 30000, anwendeVersuche: 5, anwendePauseMs: 1000 }
export interface ClientLike {
  zustand(): ClientZustand; kopplung(): KopplungInfo | null; sende(n: Nachricht): boolean;
  on(e: 'zustand' | 'angemeldet' | 'daten', f: (x: any) => void): unknown;
}
export interface Uhr { jetzt(): number; setTimeout(f: () => void, ms: number): unknown; clearTimeout(h: unknown): void }
export interface StandSpeicher { lies(): MasterStand | null; schreibe(s: MasterStand): Promise<boolean>; loesche(): void }
export function nichtAngewendet(code: string): Error & { code: string };   // Wurf für anwenden: V12 und Logzeile zeigen code (N3)
export class VerbundFolger extends EventEmitter {
  constructor(o: { client: ClientLike; speicher: StandSpeicher; log(stufe: 'info' | 'warn', t: string): void;
                   uhr?: Uhr; fristen?: Partial<VerbundFristen>; darfSchreiben?: boolean });
  folge(h: FolgeHandler): void;      // registriert; Zwischenspeicher genau einmal, sobald auch starte() lief (E17); verbunden → Abo jetzt (E47)
  starte(): void;                    // Client läuft: Zwischenspeicher lesen, Zuhörer anhängen
  daten(): VerbundDaten;
  imVerbundmodus(): boolean;
  ersetzt(): void;                   // verbundDatenErsetzt (E16)
  kopplung(): VerbundKopplung | null;
  ignoriert(weg: 'reload' | 'deeplink', pfad?: string): void;   // Logzeilen 16.1, höchstens einmal je Minute und Weg (E19, E44)
  stoppe(): void;
  // Ereignis 'wechsel' (d: VerbundDaten) bei jeder Änderung von daten()
}

// verbund-speicher.ts (fs, ohne Electron) — C13, E18
export function standDatei(userData: string): string;   // <userData>/verbund/master-stand.json
export function erzeugeStandSpeicher(datei: string, log: (stufe: 'info' | 'warn', t: string) => void,
  umbenennen?: (von: string, nach: string) => void): StandSpeicher;   // Inhalt { fassung: 1, stand }

// verbund-ipc.ts (Electron) — C13, E51
export const VERBUND_ANZEIGE_KANAL = 'jmps:verbund-anzeige';
export function registriereVerbundIpc(quelle: { daten(): VerbundDaten; on(e: 'wechsel', f: (d: VerbundDaten) => void): unknown }): void;

// verbund.ts (Electron-Anbindung) — über index.ts öffentlich (Einfügung a, G2) — C13
export function folgeMasterShow(h: FolgeHandler): void;
export function verbundDaten(): VerbundDaten;              // ohne Client: { art: 'einzelplatz' }
export function imVerbundmodus(): boolean;                 // ohne Client: false
export function verbundDatenErsetzt(): void;               // vor dem Client-Start gemerkt und nachgereicht
export function verbundKopplung(): VerbundKopplung | null;
export function verbundIgnoriert(weg: 'reload' | 'deeplink', pfad?: string): void;   // Texte 16.1, 60-s-Drossel je Weg
export function istHostDieserRechner(host: string): boolean;   // istDieserRechner mit os.networkInterfaces() und os.hostname()
export function verbundAnClient(client: MasterLinkClient, o: { userData: string; log: Logger }): void;  // nur intern (index.ts, direkt nach client.starte(), ZF2), wirft nie
// index.ts exportiert zusätzlich nichtAngewendet (aus verbund-daten, N3), kuerzeName (aus @jm/master-link, für den Rundown, N15)
//   und die Typen MasterStand, VerbundDaten, VerbundKopplung, VerbundAnzeige, FolgeHandler — nicht verbundAnzeige.
// IPC: ipcMain.handle('jmps:verbund-anzeige') → VerbundAnzeige | null; bei 'wechsel' webContents.send('jmps:verbund-anzeige', anzeige) an alle Fenster
```

### S-D · Tools (C14–C18)

```ts
// Preload je Tool (window.jm, window.jmtitler, window.jmrundown) — C14, C16, C18
verbundAnzeige(): Promise<VerbundAnzeigeZeile | null>;                     // ipcRenderer.invoke('jmps:verbund-anzeige'), Ablehnung → null
onVerbundAnzeige(cb: (a: VerbundAnzeigeZeile | null) => void): () => void; // ipcRenderer.on('jmps:verbund-anzeige')
// VerbundAnzeigeZeile (E28): Timer src/shared/verbund.ts, Titler und Rundown src/shared/types.ts

// apps/timer/src/shared/show-anwenden.ts — C14, E14
export type TimerAktion = Extract<Command, { type: 'tt:setAll' | 'tt:replaceItems' | 'setDuration' }>;
export function timerAktionenAusShow(show: Show, mode: 'initial' | 'reload', eigeneListe: boolean): TimerAktion[];

// apps/titler/src/shared/datenquelle.ts — C15, E21, E53
export type DatenQuelleArt = 'show' | 'ordner' | 'frueher' | 'master';
export interface GemerkteShowPfad { showPfad: string; showName: string; mitSpeakern: boolean }   // heutiges GemerkteShow
export interface GemerkteShowMaster { quelle: 'master'; masterId: string; schluessel: string | null; showName: string }
export type GemerkteShow = GemerkteShowPfad | GemerkteShowMaster;
export function istMasterForm(g: GemerkteShow | null): g is GemerkteShowMaster;
// QuellZustand + master: { masterId: string; masterName: string; schluessel: string | null } | null
// QuellEreignis + | { t: 'masterStand'; masterId: string; masterName: string; schluessel: string | null; show: Show }
//               + | { t: 'verbundEnde' }
export function startZustand(gemerkt: GemerkteShow | null, frueher: boolean, gekoppelterMaster: string | null = null): QuellZustand;
export function ordnerWahlGesperrt(z: QuellZustand): string | null;   // Text 17.2 bei art 'master', sonst null
export function verbundEndetFuer(z: QuellZustand, lage: string): boolean;   // master und Lage frueher/einzelplatz/datei-defekt (N8)
export function ordnerPatchAbgelehnt(neu: string | undefined, vorher: string, z: QuellZustand): string | null;   // E22 Config-Patch (N17)
// quellZeile: Q4 „Quelle: Show vom Master „⟨S⟩““ bei art 'master'
// apps/titler/src/main/show-quelle.ts: leseGemerkteShow(userData): GemerkteShow | null; schreibeGemerkteShow(userData, wert: GemerkteShow): boolean
// apps/titler/src/shared/types.ts: TitlerStatus.datenQuelle.ordnerGesperrt?: string (C16)

// apps/rundown/src/shared/ausgangsstand.ts (definiert) und src/main/gedaechtnis.ts (re-exportiert) — C17, E58
export type GedaechtnisQuelle = { art: 'pfad'; showPfad: string } | { art: 'master'; masterId: string; schluessel: string };
export type Zeiger = { showPfad: string; schluessel: string }
  | { quelle: 'master'; masterId: string; masterSchluessel: string; showName: string; schluessel: string };
// GedaechtnisInhalt + quelle?: 'master'; masterId?: string; masterSchluessel?: string
// apps/rundown/src/main/gedaechtnis.ts
export function gedaechtnisSchluesselFuer(q: GedaechtnisQuelle): string;   // master: sha256("master|"+masterId+"|"+schluessel), 16 Hex
export function leseZeiger(ordner: string): Zeiger | null;
export function schreibeZeiger(ordner: string, z: Zeiger): boolean;
export function ausShow(show: Show): Extract<ShowGelesen, { ok: true }>;   // reiner Teil von leseShowSicher
// apps/rundown/src/shared/conductor.ts — C17, E15, E25
export interface KopplungFuerWahl { rolle: 'aus' | 'master' | 'slave'; masterAdresse: string | null; adressen: string[]; letzteAdresse: string | null }
export function waehleLauncher(funde: readonly Endpoint[], kopplung: KopplungFuerWahl | null,
  istHier: (host: string) => boolean): Endpoint | null;
export function entscheideMasterStand(zeiger: Zeiger | null, stand: { masterId: string; schluessel: string | null }): 'gleich' | 'neu';
export const HINWEIS_RUNDOWN_DATEI_AM_MASTER: string;   // Text 17.3 wörtlich
export function mitRundownDokument(mitDokument: readonly string[]): boolean;
export function gleicherShowName(docName: string, showName: string): boolean;
export function dokumentHinweis(vorher: string | null, stand: { masterId: string; mitDokument: readonly string[] }, masterSchluessel: string): { fuer: string | null; zeigen: boolean };   // N9
export type MasterAusgang = 'gedaechtnis' | 'uebergang' | 'leer' | 'bleibt';
export function masterAusgang(o: { mitGedaechtnis: boolean; ablaufLeer: boolean; docName: string; showName: string }): MasterAusgang;   // N9
export function showLinkWeg(imVerbund: boolean, pfad: string, kuerze: (name: string) => string):
  { weg: 'laden' } | { weg: 'ignorieren'; log: string };   // E24: im Verbundmodus nichts laden, eigene Logzeile (N15)
// apps/rundown/src/main/conductor.ts (intern) — C18, E59
export interface LauncherWahl { kopplung(): KopplungFuerWahl | null; istHier(host: string): boolean }
// class Conductor { constructor(onChange: () => void, launcherWahl?: LauncherWahl); neuWaehlen(): void }
```

### S-E · Kette und Durchgang (C19, C20)

- `apps/launcher/test/verbund-kette.test.ts` nutzt S-A (`MasterLinkServer`, `MasterLinkClient`, Testhilfen aus `packages/master-link/test/aufbau.ts`), S-B (`Verteiler`) und S-C per Relativpfad (`../../../packages/app-runtime/src/verbund-daten`, `verbund-anzeige`, `verbund-speicher`, `verbund-typen`); nie `packages/app-runtime/src/index.ts`, das Electron lädt.
- `apps/launcher/test/e2e-teil2b-verbund.ts` nutzt S-A/S-B für den Test-Master auf Port 8738 und S-D (Preload `verbundAnzeige()`) per CDP (Rundown 9334, Titler 9335, Timer 9336).

## Abweichungen und Entscheidungen bei der Zusammenführung

Beim Zusammensetzen der fünf Blöcke und beim Durchspielen gefunden und im Plantext aufgelöst. ZF1, ZF2 und ZF10 ändern Verhalten; ZF1 und ZF2 fand der Kettentest C19 erst gegen den echten Code der früheren Blöcke, ZF10 der Abgleich der Zusagen von C13 mit Block D.

1. **ZF1 · Anwende-Versuche: der erste und bis zu fünf neue** (C12, gefunden von C19 J). Block C rief `anwenden` insgesamt fünfmal; Block E prüfte sechs Aufrufe. Die Spec entscheidet: 16.2 „wendet … bis zu fünfmal im Abstand von 1 s **erneut** an“, 18 „bis zu fünf neue Versuche“, 19.4 „fünf neue Versuche im Abstand von 1 s“. Geändert in C12: `rest: 1 + this.f.anwendeVersuche` mit Kommentar, drei Erwartungen im Test (`versuche === 6`, `9`, `11`), Kopfkommentar, Commit-Text und E48. Die Zahl der Prüfungen bleibt (103 in C12); gemessen danach `15 passed` und `201 passed`, C19 J grün. (Nach der Nachbesserung N3–N5: 109 in C12, `207 passed`; nach N18: 110, `208 passed`.)
2. **ZF2 · Der Folger startet direkt nach `client.starte()`** (G2 c, C13, C19; gefunden von C19 M). Die Gliederung setzte Einfügung (c) vor `client.starte()`. Dort liefert `client.kopplung()` noch `null`; ein schon registrierter Handler bekam den Zwischenspeicher mit „keine Kopplung“: beim Start kurz V13, und Titler oder Rundown gingen über `beiWechsel` auf `frueher` (16.3 verlangt „sofort Verbundmodus“). Gemessen: `61 ok, 2 fehlgeschlagen.` (beide in M). Geändert: G2 (c) und C13 Step 7 (c) stehen jetzt hinter `client.starte();`, der Kommentar in `verbund.ts` und die Begründung in C13 „Vorab“, die Reihenfolge in `baueWerkzeug` von C19. Das synchrone `zustand` des Clients verpasst der Folger dabei nicht folgenreich: `starte()` leitet die Lage neu ab und meldet sie. Danach `63 ok, 0 fehlgeschlagen.`; die Einfügungen in `index.ts` bleiben 13 Zeilen ohne gelöschte Zeile (nach N3: 14, nach N15: 15, je eine Exportzeile mehr).
3. **ZF3 · Rundown-Zählung:** Der Rundown-Selbsttest hat vor R2 **404 + 81** `ok`-Zeilen (zusammen 485), nicht „485 + 81“ wie in der Gliederung. Blöcke B und D hatten das schon gemessen; Testläufe und C21 nennen 404 + 81, nach R2 430 + 109 (nach der Nachbesserung N9: 440 + 109, nach N15: 443 + 109).
4. **ZF4 · Nummern:** Die Entscheidungen der Blöcke stehen als E30–E61 im Abschnitt „Entscheidungen“. Verweise auf den Bericht von Block B („Bericht Nr. …“) sind durch diese Nummern ersetzt; die Berichte der Schreiber gehören nicht in den Plan.
5. **ZF5 · Keine „gleiche Ersetzung“:** C14 Step 6 nannte für `apps/timer/tsconfig.web.json` nur „dieselbe Ersetzung“. Jetzt steht dort der eigene Vorher/Nachher-Text (beim Durchspielen genau einmal gefunden).
6. **ZF6 · Register auf Stand gebracht:** Gegenüber der Gliederung kamen dazu bzw. änderten sich `Verbindung.sende` (E30), `VerbundFristen` und `Partial<VerbundFristen>` (E45; die Kette braucht kurze Fristen, Block E hatte das als Befund gemeldet), `VerbundFolger.ignoriert` (E44), `standDatei`, `VERBUND_ANZEIGE_KANAL`, `registriereVerbundIpc` (E51), `toProgramList`, `IveoClientLike`, Signatur mit Side Events (C7), `rolle()` und `stand` am Verbund-Kern (E12, E40), `OHNE_DATEN_NACH_MS` (E43), `istMasterForm` (E53), Typen im Rundown in `src/shared/ausgangsstand.ts` und `mitRundownDokument` (E58), `LauncherWahl` (E59).
7. **ZF7 · Dateistruktur aus den Steps abgeleitet:** dazu `packages/master-link/test/koppeln.test.ts` (C2, ein Typfehler), `apps/launcher/test/iveo-huelle.test.ts` (C7), `apps/rundown/src/shared/ausgangsstand.ts` (C17). Unverändert bleiben `jmtitler.d.ts`, `jmrundown.d.ts`, Rundown-`App.tsx` (die Gliederung nannte sie).
8. **ZF8 · Zeitabhängige Teil-1-Prüfung:** Nach C3 scheiterte einmal unter Fremdlast (Lauf 77 s statt rund 40 s) die unveränderte Prüfung „Datei zweimal unlesbar → fehler:datei (Review Focus 3)“ in `packages/master-link/test/client.test.ts`; in allen späteren Läufen war sie grün. Die Regel steht unter „Konventionen in jeder Aufgabe“.
9. **ZF9 · Messhinweise der Blöcke:** Wo ein Block gegen Stand-ins gemessen hatte („nach A–D nachmessen“, „Nachgerechnet … Stand-in“), stehen jetzt die beim Durchspielen gemessenen Werte. Die Gegenproben-Tabellen in C11–C17 hat der jeweilige Schreiber gemessen; sie betreffen nur reinen Code der eigenen Aufgabe. Block E schreibt „Erwartet“/„Befehl“ wie die anderen Blöcke; die Task-Überschriften heißen einheitlich „Task N: CN · …“.
10. **ZF10 · Preload liefert `null` statt einer Ablehnung** (C14, C16, C18). C13 sagt zu: Ohne Folger (Zweitinstanz, Fehler beim Start) gibt es keinen IPC-Handler, `invoke` lehnt ab, „der Preload fängt das ab und liefert `null`“. Die drei Preloads aus Block D fingen nicht ab; die Oberflächen rufen `verbundAnzeige().then(…)` ohne `catch`. Jetzt: `(ipcRenderer.invoke('jmps:verbund-anzeige') as Promise<VerbundAnzeigeZeile | null>).catch(() => null)`. Nachgemessen: Typecheck und Build der drei Tools grün, Preload-Zählung je `3`, Selbsttests unverändert.

## Nachbesserung nach der Plan-Prüfung (08.10.2026)

Drei Prüfer (Spec, Code, Robustheit) haben den zusammengeführten Plan gelesen und nachgespielt. Was übernommen wurde, steht hier; der Plantext der genannten Aufgaben ist danach geändert und auf einer frischen Kopie neu gemessen (alle Zahlen in den Aufgaben sind die neuen).

1. **N1 · Rundown, Show-Deep-Link im Verbundmodus nach Spec** (E24, C18; **ersetzt durch N15**, der Text bleibt zur Nachvollziehbarkeit stehen): Er liefert nur das Dokument (16.1) — die eigene Rundown-Datei der verlinkten Show wird wie „Öffnen…“ Ausgangsstand und sofort abgeglichen (17.3); die Daten bleiben die des Masters. Vorher ignorierte der Rundown den Link ganz, ohne „Weicht ab“, und schrieb die 16.1-Zeile „… liefert hier nur Dokumente …“, die dann nicht stimmte. Notes und `docs/suite-verbund.md` (C21) sagen es jetzt so.
2. **N2 · „Weicht ab“ nachgetragen** für E9 (Spec 18, neue Epoche) und E47 (Spec 12/16.1, Abo nach jeder Anmeldung); beide stehen jetzt in Owner-Frage Nr. 1.
3. **N3 · V12 zeigt den Grund des Tools** (C12, C13, C16, C18): Neuer Export `nichtAngewendet(code)` aus `verbund-daten.ts` (über `index.ts` öffentlich, eine Zeile mehr im Export-Block: 14 statt 13). Titler (`EBUSY` u. a.) und Rundown (`SCHLUESSEL_FEHLT`) werfen damit; ein einfaches `Error` zeigte „Show vom Master nicht übernommen: Error“. Drei Prüfungen in C12.
4. **N4 · Keine Anwende-Versuche nach dem Ende des Verbunds** (C12): `aufZustand` beendet die Versuche mit einem Stand vom Master, sobald die Kopplung keinen Slave mehr zeigt; ein Stand aus dem Zwischenspeicher wird weiter versucht (16.3). Zwei Prüfungen.
5. **N5 · Showname in der Logzeile „übernommen“ über `kuerzeName`** (C12): einzeilig, höchstens 60 Zeichen; eine Prüfung.
6. **N6 · Zurücklesen nach dem Schreiben scheitert → die geschriebene Show, nie `null`** (C6, E10): sonst zeigten alle Tools auf B V8 „Show am Master nicht lesbar“, obwohl die Datei in Ordnung ist. Eine Prüfung (Testnaht `leseAusNachSchreiben`).
7. **N7 · Speichern im Editor behält den Merker „Side-Event-Liste veraltet“** (C7): „seit“ bleibt der erste Fehlschlag (15.4). Eine Prüfung.
8. **N8 · Titler erkennt jedes Ende des Verbunds** (C15, C16): reine Regel `verbundEndetFuer` für `frueher`, `einzelplatz` und `datei-defekt`; vorher blieb der Titler nach einem Start mit Master-Form ohne lesbaren Zwischenspeicher und anschließendem Entkoppeln in Quelle `master` (Q4 und gesperrte Ordnerwahl ohne Verbund). Sechs Prüfungen.
9. **N9 · Rundown-Ladeweg und Hinweis-Merker als reine Funktionen** (C17, C18): `masterAusgang` und `dokumentHinweis` mit zehn Prüfungen, rot zuerst; `ladeMasterShow` rechnet erst und setzt dann Zeiger, `masterQuelle` und `masterShow` (ein Wurf lässt nichts halb gemerkt zurück, der nächste Versuch lädt wieder als neue Show).
10. **N10 · `iveo` im Ausschnitt über eine Freigabeliste** (C5): die sieben Felder ausdrücklich statt „alles außer `baseUrl`“ (Spec 0 Nr. 4, 14.1, 22). Prüfzahl unverändert.
11. **N11 · Zoom Stage 4b** (Kopf, G2, C11, Schlussabschnitt): CI-Konflikt und gemeinsamer Schritt, Zählstand des CSP-Teils nach dem Merge, berichtigte Aussage zu `package.json`. Die Zahlen daraus (17 Schritte, `5e5cd7fca7`, `43 passed`) sind durch N20 überholt.
12. **N12 · Zeitabhängige Tests mit Abstand** (C13, C19): C13 wartet auf die Datei statt fest 50 ms; C19 nutzt eine Stille-Frist von 2 s statt 1,2 s (Abschnitt E wartet bis 5 s auf die Trennung). C19 gemessen 11 s, Gegenproben unverändert 29 bzw. 7 `FAIL`. Die CI unter Linux/Node 22 ist der erste Lauf dort.
13. **N13 · Text- und Angabenkorrekturen:** G13 nennt die Modal-Regel als bewusste Ausnahme (FA12); FA18 richtig begründet; die Rücknahme der Gegenprobe in C4 Step 8 eindeutig mit Vorzeile; Bereichsangaben, die nicht zur Fundstelle passten, nachgezogen.
14. **N14 · Durchgang C20 vor dem Merge Pflicht:** C16 und C18 haben außer Typecheck und Build nur diesen Verhaltensnachweis. (Seit N17 genauer: Was C20 davon prüft und was nicht, steht in C16 und C18; der Rest steht als Handprüfung in der Abnahme-Datei.)

Abgelehnt wurde keiner der 17 Befunde. Zwei waren derselbe (CI-Schritt mit Zoom 4b).

### Zweite Runde: Owner-Antworten und Nachprüfung (08.10.2026)

Eine unabhängige Nachprüfung hat die Behebung gelesen und nachgespielt (16 Befunde behoben, Befund 11 nur teilweise, neue Befunde N-W1 und N-K1 bis N-K8). Der Owner hat am selben Tag die offenen Fragen beantwortet, die steuernde Sitzung hat zu den Befunden entschieden. Umgesetzt ist das hier; der ganze Plan ist danach neu abgespielt und gemessen (siehe „Wie dieser Plan entstanden ist“).

15. **N15 · Rundown ignoriert einen Show-Deep-Link im Verbundmodus ganz** (zu N-W1; ersetzt N1; E24, C13, C17, C18, C21): Weder Daten noch Dokument. Auslegung „17.3 vor 16.1“: 17.3 ist die Rundown-eigene Regel („Show-Deep-Link | Daten ignoriert“, „Eigene Rundown-Datei der Show: wird auf B nicht geladen“). Ein Show-Link kommt oft ohne bewusste Handlung (Launcher, Doppelklick) und darf einen laufenden Rundown nicht auf die erste Zeile setzen, GO-Folgen abbrechen (`cancelPendingFires`) oder das Gedächtnis der Master-Show überschreiben, wie es N1 über `gleicheMitMasterAb` tat; „Öffnen…“ bleibt der bewusste Weg. Statt der 16.1-Zeile schreibt der Rundown eine eigene, wahre Infozeile „Verbund: Show-Link „⟨Name⟩“ – der Rundown folgt der Show vom Master und lädt daraus nichts.“ (⟨Name⟩ = Dateiname über `kuerzeName`). Die Entscheidung ist die reine Funktion `showLinkWeg` in C17 (drei Prüfungen, rot zuerst mit `SyntaxError`, Gegenproben 2 / 1 / 2 `FAIL`); C18 nutzt sie, `ladeDokumentImVerbund` entfällt. `kuerzeName` kommt über `@jm/app-runtime` (eine Exportzeile mehr in `index.ts`, jetzt 15 Zeilen, 663 von 663; überholt durch N29: auf `adda584693` 675 von 675), weil der Rundown `@jm/master-link` nicht als eigene Abhängigkeit hat. Der Hinweis aus 17.3 bleibt unverändert. Notes und `docs/suite-verbund.md` (C21): „Im Verbund lädt der Rundown auf einem gekoppelten Rechner aus einem Show-Link nichts; eine eigene Rundown-Datei lässt sich mit „Öffnen…“ laden.“
16. **N16 · Modal bei genau einem Bezieher „· 1 Tool bezieht sie“** (Owner-Antwort auf Frage 3; C10, E43, C21): sonst wörtlich 15.5 „· ⟨n⟩ Tools beziehen sie“. Eine Prüfung in `verteiler.test.ts` Nr. 10 (jetzt 53), Gegenprobe Step 10 mit genau dieser `FAIL`-Zeile (`52 ok, 1 fehlgeschlagen.`). Texttabelle, Doku und `selftest:verbund` (203 / 53 / 63) nachgezogen.
17. **N17 · Ehrlich, was C20 prüft; Sperre E22 als reine Funktion; Zusatzprüfungen** (zu Befund 11; C15, C16, C18, C21, Kopf, Schlussabschnitt): C16 und C18 sagen jetzt Prüfung für Prüfung, was der Durchgang abdeckt und was nicht (Show-Link, Startreihenfolge, Ordnerwahl, „Öffnen…“/„Neu“, Launcher-Wahl). Die Regel der Sperre für einen Config-Patch ist die reine Funktion `ordnerPatchAbgelehnt` in C15 (drei Prüfungen, rot zuerst mit `SyntaxError … 'ordnerPatchAbgelehnt'`, Gegenproben je 1 `FAIL`); der Main ruft sie, eine Warnung bleibt an einer Stelle. Die Startreihenfolge (E55) ist Verdrahtung ohne testbare Entscheidung: Sie steht mit dem Show-Link und der gesperrten Ordnerwahl als Handprüfung unter „Zusatzprüfungen (nicht in Spec 20)“ in der Abnahme-Datei, unter der unveränderten Tabelle aus Spec 20.
18. **N18 · Anwende-Versuche enden auch beim direkten Wechsel an einen anderen Master** (zu N-K7; C12, E48): `aufZustand` beendet die Versuche mit einem Stand vom Master, wenn die Kopplung weiter einen Slave zeigt, aber eine andere `masterId` (16.1 „Anderer Master“). Eine Prüfung; rot gegen die Fassung vor N18 (Gegenprobe: 1 `FAIL`). C12 jetzt 110 Prüfungen, `174 passed`; C13 `208 passed`.
19. **N19 · Owner-Antworten vom 08.10.2026:** alle fünf „Weicht ab“ bestätigt (E6, E9, E14, E15, E47; Owner-Fragen 1, 4, 7); Durchgang C20 freigegeben (Frage 8; die Ledger-Zeile setzt die steuernde Sitzung beim Start der Umsetzung, C20 läuft dann ganz); Umsetzung per Workflow nach Zoom 4b, vor C1 Neuaufsatz auf `main` mit Nachmessen der Anker und Zählstände (Kopf, Schlussabschnitt). Offen bleiben nur die Texte ohne Spec-Vorgabe und die Notes R2 (Freigabe vor dem Commit von C21).
20. **N20 · Fakten zu `main` und Zoom 4b auf dem Stand vom 08.10.2026** (zu N-K5; Kopf, Testläufe, Schlussabschnitt), lesend mit `git` nachgeprüft: `origin/main` = `b7e959866d` mit 16 Schritten im Job `selftests` (dazu Presenter, Appkit, App Designer aus PR #248) und `docs/roadmap.md` aus PR #249; gegen `5f8ed15ef8` ändert `main` außerdem `package-lock.json`, `packages/suite-manifest/changelog.json` und `ci-checks.yml`. `feat/zoom-stage4b` = `85dcba597d` (neu aufgesetzt auf `b7e959866d`; seit `9611b31c1e` nur `apps/connect`, `packages/zoom-bridge/test` und Doku), 20 Schritte, letzter „App-Laufzeit (Log-Aufräumen, CSP)“; app-runtime-Selbsttest dort `50 passed` (in einer Kopie gemessen). Nach beiden bleibt **ein** app-runtime-Schritt, der Job hat 20 Schritte (überholt durch N26: auf `adda584693` 22 Schritte, dazu zwei aus UX Welle 0). Die Zusammenführung von `index.ts` mit `85dcba597d` ist konfliktfrei (675 Zeilen).
21. **N21 · Kleinkorrekturen** (N-K1 bis N-K4, N-K6, N-K8): `index.ts` nach C13 mit Zeilenzahl (jetzt 663, wegen N15; mit 14 Zeilen wären es 662 gewesen, N-K1; überholt durch N29: 675 auf `adda584693`); `nichtAngewendet` (und `kuerzeName`) im Produces-Block und im Commit-Text von C13 (N-K2); C21 Step 10 nennt die Zeilenzahl der Texttabelle nach dem neuen Stand (20, N-K3); Architektur, Commit-Texte von C16 und C18 und die Lesestellen in C18 folgen dem Plan (N-K4); Zoom-Bridge-Zusatzbitte überall „erledigt: Issue #247“ (N-K6); die Gegenproben-Zeile „Sperre auch bei `ordner` im Verbund“ in C15 nennt die gemessenen 3 `FAIL`-Zeilen einzeln (N-K8).

### Dritte Runde: zweite Nachprüfung (08.10.2026)

Eine zweite unabhängige Nachprüfung hat die zweite Runde gelesen und nachgespielt: kein kritischer oder wichtiger Befund, zehn kleine (K1–K10). Übernommen ist, was zutraf; der ganze Plan ist danach wieder abgespielt und gemessen (siehe „Wie dieser Plan entstanden ist“). Unverändert bleibt `kuerzeName` über `@jm/app-runtime` (N15, K9): Der Rundown braucht den Namen für seine Logzeile und hat `@jm/master-link` nicht als eigene Abhängigkeit; `index.ts` hat deshalb nach C13 663 Zeilen (überholt durch N29: 675 auf `adda584693`). Bestätigt von der steuernden Sitzung am 08.10.2026: Der Export über `@jm/app-runtime` gilt; eine neue Abhängigkeit des Rundowns auf `@jm/master-link` wäre der größere Eingriff (E15).

Eine dritte Nachprüfung fand danach nur noch kleine Text- und Angabenpunkte (Liste der Handprüfungen in N17 ohne die Zusatzprüfungen 4 und 5, Satzbau im Doku-Satz zur Log-Drossel und in zwei Notes-Einträgen, „über/unter der Tabelle“ in der Kopf-Tabelle zu C21, Step 10 von C21 nennt nur Changelog-Einträge als Ort geänderter Texte, Erwartung zum stehenden Hinweis nach „Öffnen…“ in der Abnahme). Sie werden im Nachmess-Durchgang nach O-4 (Neuaufsatz auf `main` mit 4b) mit erledigt. (Stand 12.10.2026: In der vierten Runde, N25–N42, nicht mit erledigt, weil es keine Messwerte sind; offen, Zeitpunkt in N39.)

22. **N22 · CI-Schritt für beide Stände** (zu K1; G2, C11, Kopf-Tabelle, Dateistruktur, Selbstprüfung, Schlussabschnitt): G2 nennt jetzt beide Fälle. Ohne 4b wird der Schritt angehängt; mit 4b (nach dem Neuaufsatz, der vorgesehene Fall) wird der 4b-Schritt umbenannt. In jedem Fall steht genau ein app-runtime-Schritt im Job (Spec 19.6). Der Commit-Text von C11 sagt „genau ein CI-Schritt“ statt „am Ende“. Der Schlussabschnitt nennt alle Stellen, die der Nachmess-Durchgang dafür mitzieht.
23. **N23 · Zusatzprüfungen 4 und 5; offen gesagt, was nirgends zur Laufzeit läuft** (zu K3; C21 Step 2, Kopf, G15, C16, C18, E61, Owner-Frage 5, Schlussabschnitt): Die Abnahme-Datei bekommt zwei Handprüfungen dazu: die Rundown-Datei am Master mit dem stehenden Hinweis und „Öffnen…“/„Neu“ im Verbundmodus (17.3), und die eigene Wahl nach dem Entkoppeln (Titler-Ordner, Rundown „Neu“, E56). Die Einleitung nennt auch den Timer, die Logzeile heißt wie in der Texttabelle „⟨Name⟩“, und sie sagt, was nur als reine Regel geprüft ist: die Ablehnung im Main des Titlers, solange die Oberfläche die Wahl schon sperrt (E22). Die Tabelle aus Spec 20 bleibt wortgleich.
24. **N24 · Text- und Angabenkorrekturen** (zu K2, K4–K8, K10): Keine Bitte um Bestätigung mehr zu geschlossenen Owner-Fragen (Überschrift der Entscheidungen, C15, C16, C18); Owner-Fragen 5 und 6 sind als vom Owner geschlossen vermerkt (offen bleiben nur Texte und Notes, N19). Die Doku zur Log-Drossel unterscheidet Neu-Laden und Show-Link (der Rundown vermerkt jeden Show-Link). Zu 4b in `index.ts`: 13 Zeilen eingefügt, eine Leerzeile gelöscht (netto +12). Der Code-Kommentar in C18 beschreibt keine nie committete Fassung mehr; der Funktionsname der Fassung aus N1 steht nur noch in N15. G5 und der Kopf nennen die Modal-Einzahl als Owner-Entscheid (und G5 die eigene Show-Link-Zeile des Rundowns). E61, die Kopf-Tabelle zu C21 und „nie von selbst geladen“ in C18 sind genauer gefasst.

### Vierte Runde: Neuaufsatz auf `main` (12.10.2026)

Vor C1 ist der Branch auf `main` `adda584693` neu aufgesetzt (Owner-Entscheid O-4, N19). Dieser Durchgang hat C11–C21 und die globalen Abschnitte nachgemessen und nachgezogen (siehe „Wie dieser Plan entstanden ist“, vierte Runde); C1–C10 hat ein eigener Messgang nachgemessen (N33), danach ist beides zusammengeführt und gegengeprüft (N34). „Alle Anker greifen“ hieß dabei nicht „alles stimmt“: Mit dem alten C11 Step 12 griffen alle 283 Operationen, der Job hatte danach aber zwei app-runtime-Schritte. Nicht Teil dieses Durchgangs sind die Textpunkte der dritten Nachprüfung (Absatz vor N22); sie sind keine Messwerte und bleiben offen (N39).

25. **N25 · Neuaufsatz** (Kopf „Arbeitsort“, „Umsetzung“, Abschnitt zu Zoom 4b und UX Welle 0, Schlussabschnitt): Basis `adda584693` = `origin/main` am 12.10.2026, darin Zoom 4b (PR #251, `2df1f79357`), UX Welle 0 (PR #250, `efcfff3c5a`), `f118fcd215` (`suite.json` Connect 0.3.0) und PR #252 (Roadmap). Von den 81 Dateien des Plans ändert `main` seit `5f8ed15ef8` genau vier (`git diff --numstat 5f8ed15ef8 adda584693`: `ci-checks.yml` +25/−0, `package-lock.json` +41/−3, `packages/app-runtime/src/index.ts` +13/−1, `changelog.json` +30/−0); ohne R2-Text dazu `packages/app-runtime/test/selftest.ts` und `src/log-aufraeumen.ts`. Gemessen: Der Plan vom 08.10.2026 greift auf einer frischen Kopie mit allen 283 Operationen, 0 Fehler. Der Absatz „Liegt 4b beim Merge … noch nicht auf `main`“ im Schlussabschnitt ist als überholt markiert.
26. **N26 · CI-Schritt umbenannt statt angehängt** (C11 Step 12 und 13, „Dateien“, „Regeln“, G2, Kopf, Kopf-Tabelle, Dateistruktur, Selbstprüfung 19.6, Schlussabschnitt): Vorher/Nachher von Step 12 treffen jetzt den 4b-Schritt „App-Laufzeit (Log-Aufräumen, CSP)“ (Zeilen 92–93) und benennen ihn um in „App-Laufzeit (Log-Aufräumen, CSP, Verbund-Anzeige, Abo-Zustand)“, mit zwei Kommentarzeilen davor. Die YAML-Prüfung zählt zusätzlich die Schritte mit dem app-runtime-Befehl. Gemessen: `22 Schritte, letzter: App-Laufzeit (Log-Aufräumen, CSP, Verbund-Anzeige, Abo-Zustand) | npm run selftest -w @jm/app-runtime | app-runtime-Schritte: 1`, Datei 124 → 126 Zeilen, CRLF durchgehend. Gegenprobe mit dem alten Anhängen: `23 Schritte, … | app-runtime-Schritte: 2`. 22 statt der früher erwarteten 20 Schritte, weil UX Welle 0 „UI-Bausteine …“ und „Einstellungs-Abschnitte …“ dazugebracht hat. Der Commit-Text von C11 Step 4 begründet den eigenen Commit nicht mehr mit `feat/zoom-stage4b`, der von Step 13 nennt die Umbenennung.
27. **N27 · app-runtime-Zählstände** (C11 Step 3, 6, 9; C12 Step 2, 4; C13 Step 2, 4, 8; C21 Step 9; Kopf, Unterpunkt „Zählstände“; Kopf-Tabelle; Testläufe): Der CSP-Teil des Selbsttests zeigt mit 4b `50 passed, 0 failed` statt `15 passed` (vor C11 und nach jeder dieser Aufgaben gemessen). Der Verbund-Teil ist unverändert: `64`, `174`, `208 passed`, die Rotläufe mit denselben `ERR_MODULE_NOT_FOUND`-Zeilen. Alle Gegenproben von C11 (1 und 2 `FAIL`), C12 (8, 1, 1, 2, 2, 2, 1, 2, 1, 1, 2 `FAIL`) und C13 (Step 9 `verbund.ts(53,3): error TS2322 …`; Step 11 3, 1, 1, 1 `FAIL`) wörtlich wie im Plan.
28. **N28 · Lockfile in C11** (C11 „Dateien“, „Vorab“, Step 2, Commit-Text Step 4; C21 Step 8): Block `packages/app-runtime` bei `:17400-17409` statt `:17396-17405`, Hunk `@@ -17401,7 +17401,11 @@` statt `@@ -17397,7 +17397,11 @@`, Lockfile 17 656 → 17 660 Zeilen statt 17 618 → 17 622; `+5/−1` und `package.json` `+6/−2` unverändert. `npm install --package-lock-only` lief in der Kopie nicht (wie in der dritten Runde); der erwartete Abschnitt ist eingespielt, Hunk-Kopf und `--stat` sind mit `git diff --no-index` gemessen. Ob npm auf der neuen Basis offline genau diesen Abschnitt schreibt, zeigt erst die Umsetzung; sonst hält Step 2 nach G16.
29. **N29 · `index.ts`** (G2, G14, C13 „Dateien“, „Regeln“, Step 8, „Abweichungen“, Kopf, Schlussabschnitt): Ist-Zeilen `:17` (Import), `:48` (`CspConfig`), `:387` (`client.starte()`), Sperre `:376-379`, `index.ts:379` in den Abweichungen. 660 → 675 Zeilen, 15 Einfügungen, 0 gelöschte (Hunks `@@ -15,6 +15,7 @@`, `@@ -46,6 +47,19 @@`, `@@ -385,6 +399,7 @@`). Wechselwirkung mit 4b: Die beiden Quelltext-Wächter im 4b-Selbsttest („initAppRuntime plant das Aufräumen nach dem Logger …“, „… und index.ts räumt nirgends sofort auf …“) bleiben nach C13 grün (`50 passed`); C13 Step 8 sagt jetzt, warum.
30. **N30 · Changelog und Versionen in C21** (C21 „Dateien“, Step 7, Step 8, Step 9, „Abweichungen“ Nr. 4): Vorher-Texte bei `:31-35`, `:645-649`, `:1079-1083`, `:1379-1383` (vor C21; vorher `:22-26`, `:629-633`, `:1063-1067`, `:1363-1367`), jeder genau einmal; nach C21 `changelog.json 1716/1716`, `package-lock.json 17660/17660`. Unverändert gemessen: Lockfile-Blöcke bei `:293`, `:546`, `:704`, `:736`, JSON gültig, `Release-Vorbereitung ok`, Abnahme-Tabelle wortgleich mit 14 Schritten, beide Gegenproben (`Error: launcher: ASCII-Anführungszeichen`, `nicht wortgleich: {"soll":16,"ist":16,"fehler":[2]}`). Gesamtlauf Step 9: 756; 113; 203 / 53 / 63; 277 / 52 / 84 / 12; 190; 59; 443 + 109; 477; 50 / 208; `typecheck --workspaces` Exit 0.
31. **N31 · Wechselwirkungen ohne Textänderung** (Kopf, Testläufe, Schlussabschnitt):
    - STATE-Kodierung aus 4b (`formatSuiteState` kodiert Leerraum und `%` als `%XX`): R2 erzeugt keinen STATE-Wert, und kein R2-Test prüft STATE-Text. Nur der Durchgang C20 liest STATE, über `SuiteControlClient` (dekodiert mit `parseSuiteState`), und vergleicht `entry` (Einwort-Name), `entry_count`, `total` und `on_air`. Gemessen: `formatSuiteState` ergibt für diese Werte unverändert `STATE ns=titler entry=Alan entry_index=2 entry_count=4 on_air=1`, und `parseSuiteState` liest sie zurück. Der Kommentar „Einwort-Namen: STATE trennt an Leerzeichen“ in C20 bleibt richtig; mehrteilige Namen kämen seit 4b als `%20` an und würden dekodiert. Nötig sind die Einwort-Namen damit nicht mehr, sie schaden aber nicht (der Messgang C1–C10 nannte den Kommentar „überholt, aber unschädlich“; derselbe Befund, der Code von C20 bleibt).
    - `typecheck --workspaces` prüft jetzt 31 Workspaces, darunter `@jm/ui` und `@jm/settings`: Exit 0 nach C11, C12, C13 und C21, 60–88 s (in der Nachprüfung nach C11 87 und 90 s; maßgeblich ist die Spanne 55–125 s in C11 Step 10 und C21 Step 9, N35). 25 Apps importieren weiter `@jm/app-runtime`.
    - Titler, Timer, Rundown, Launcher, master-link und iveo ändert `main` nicht: alle Rot- und Grünläufe, Typecheck-Meldungen (C14 `TS5097`, C15 und C17 je vier), Builds und Zählungen von C14–C19 wörtlich wie im Plan, ebenso die Gegenproben von C15 (N8, N17, N21), C17 (N15) und C19 (29 bzw. 7 `FAIL`). Die Gegenproben ohne wörtlich genannte Änderung (C14, Zeilen ohne N-Verweis in C15 und C17) liefen wie in der dritten Runde nicht.
32. **N32 · Zeilenangaben, die schon vor dem Neuaufsatz nicht stimmten** (C15 Step 1 und „Abweichungen“, C18 „Dateien“ und Step 8): Gemessen wurde für jede Operation von C11–C21 die Lage des Vorher-Texts im Stand vor ihrer Aufgabe. Abweichend standen nur Angaben in Dateien, die `main` nicht ändert: Im Titler-Selbsttest (C15) liegen die alten Literale bei Zeile 633–636, 674 und 689 (nach Ersetzung 1: 637–640, 678, 693), der Plan nannte 635–638, 676 und 691. Im Rundown-Main (C18, „Stand nach C17“) stehen `starteOhneDeepLink` bei `:812-826`, sein Ende bei `:842` und der Start in `whenReady` bei `:917-921`; der Plan nannte die Zeilen vor der Typ-Brücke aus C17 (`:812-825`, `:841`, `:916-920`). Die Vorher-Texte selbst waren richtig und trafen genau einmal; nur die Angaben sind nachgezogen.
33. **N33 · Messgang C1–C10** (C4 Step 9, C6, C7, C9 und C10 „Dateien“, C8 Step 5; Kopf „Umsetzung“, „Wie dieser Plan entstanden ist“, Testläufe, Schlussabschnitt): Auf einer eigenen frischen Kopie von `cd6c8394ee` (Basis `adda584693` mit den beiden Plan-Commits) liefen C1–C10 Step für Step: 144 Operationen, jeder Vorher-Text genau einmal; alle Rot-, Grün- und Gegenprobenläufe, Typechecks, Builds und Zählungen, ohne die Commit-Steps. Alle `FAIL`-Zeilen, Fehlermeldungen (Text und Ort), Zählstände und Zeilenangaben der Steps von C1–C10 stimmen; `main` ändert keine Datei dieser Aufgaben (`git diff --stat 5f8ed15ef8 adda584693` ist leer für `packages/master-link`, `packages/show`, `packages/iveo`, `apps/launcher`, `apps/timer`, `apps/rundown`, `apps/titler`). Die Spalte „Vorher“ der Testläufe ist bestätigt: 572, 113, 188, 239 / 47 / 84 / 6, 166, 41, 404 + 81, 407, dazu app-runtime `50 passed` (N27). Nachgezogen:
    - C4 Step 9: `typecheck --workspaces` hat 31 Typecheck-Skripte statt 29 (`@jm/ui` hat mit UX Welle 0 ein Typecheck-Skript bekommen, `@jm/settings` ist neu); Exit 0, 0 × `error TS`, 90 s nach C4 und 65 s nach C5 (C5 Step 6 nennt keine Zahl).
    - C7 „Dateien“: Der Kern ist nach C6 um 40 Zeilen länger (`iveo-abgleich-kern.ts` 971 → 1011), nicht „rund 25“; die Vorher-Texte von C7 liegen deshalb 0 bis 40 Zeilen hinter den Ist-Zeilen von `5f8ed15ef8`. Alter Fehler, nicht durch `main`.
    - C8 Step 5: `verteiler.test.ts` allein lief in 1,1 bis 1,3 s, unter der alten Spanne „1,5 bis 4 s“; jetzt „1,1 bis 4 s“ (die Untergrenze ist nach G16 kein Abbruchgrund).
    - Kopf der Aufgaben, je eine Zeile neben dem Vorher-Text des Steps (alte Fehler; die Steps nannten die richtige Spanne): C6 Objekt `u` `:288-290` statt `:288-289`, `schreibeShow` `:309-312` statt `:309-311`, Listen-Abfrage `:645-650` statt `:645-649`, Agenda-Abfrage `:739-744` statt `:739-743`; C9 Prüfung „neuAufsetzen mit Löschfehler“ `:440-452` statt `:439-451` (der Block beginnt mit seinem Kommentar); C10 `master.ts` `stand()` `:529-532` statt `:530-531`.
    - C10 „Dateien“: Die Ist-Zeilen in `master.ts` und `kern.ts` gelten wie die Angaben in Step 5 und 6 für die Basis; im Stand nach C9 stehen die Vorher-Texte zu `stand()` 24 bzw. 7 Zeilen weiter hinten (`master.ts:543`, `:553-556`; `kern.ts:245-257`), der Import in `kern.ts` bleibt bei `:8`. Das steht jetzt in C10 „Dateien“.
    - Wechselwirkungen mit `main`: C1–C10 erzeugen keinen STATE-Wert (RELOAD geht als Befehlszeile hinaus, und Befehlszeilen kodiert 4b nie, `packages/suite-control-protocol/src/index.ts:16-17`). Timer 41 und Rundown 404 + 81 vor C1 und nach C5 (G11), Titler 407. Der fehlende Link `@jm/settings` im `node_modules` des Worktrees stört keinen Typecheck.
34. **N34 · Zusammenführung und Gegenprüfung** (ganzer Plan, darin Selbstprüfung 3): Die Messgänge zu C1–C10 (N33) und zu C11–C21 mit den globalen Abschnitten (N25–N32) sind zusammengeführt. Zählstände, die an mehreren Stellen stehen (Kopf-Tabelle, Testläufe, Aufgabentext, C21 Step 8 und 9, Selbstprüfung, Schlussabschnitt), sind abgeglichen; die Plan-Datei hat durchgehend CRLF. N33 ändert keinen Vorher-, Nachher- oder Dateitext: Die 283 Operationen sind dieselben wie nach N25–N32. Danach wurde der fertige Plan zweimal ohne Tests auf je eine frische Kopie von `cd6c8394ee` abgespielt (der Lockfile-Abschnitt aus C11 Step 2 in beiden gleich eingespielt, N28): 283 Operationen, 0 Fehler, alle 81 berührten Dateien in beiden Kopien Byte für Byte gleich. `git add` jeder Aufgabe nennt genau die Dateien ihrer Steps, außer `package-lock.json` in C11 (aus `npm install --package-lock-only`, Selbstprüfung 3). Auf der ersten Kopie lief zusätzlich: die Länge des Kerns nach C6 (1011 Zeilen), nach C8 `verteiler.test.ts` dreimal (`44 ok`, 1,1–1,2 s), die Lage der Vorher-Texte von C6, C9 und C10 vor ihrer Aufgabe und der Grünlauf von C10 (Kopf in „Dateien“ ergänzt): `203 ok` und `53 ok`, Launcher `selftest` `113 ok`, je 0 fehlgeschlagen.

Eine unabhängige Nachprüfung der vierten Runde (Code: C11–C21 auf einer frischen Kopie nachgespielt und gemessen; Stimmigkeit: Plan gegen Spec, Git und sich selbst) fand einen wichtigen und sieben kleine Befunde, keinen kritischen. Übernommen sind alle acht (N35–N42). Keiner ändert einen Vorher-, Nachher- oder Dateitext: Die 283 Operationen und die `git add`-Listen sind dieselben wie nach N34 (gleicher Hash; `--pruefe-add` wie in N34, nur C11 zusätzlich `package-lock.json`). Gemessen wurde auf einer frischen Kopie von `cd6c8394ee`, auf die der Plan Aufgabe für Aufgabe abgespielt war (Lockfile-Abschnitt aus C11 Step 2 eingespielt wie in N28): `typecheck --workspaces` nach C11, der app-runtime-Selbsttest nach C12, C19 Step 3 und 7 (N35) und die YAML-Prüfung aus C11 Step 12 (N40). Danach ist der fertige Plan ohne Tests auf eine weitere frische Kopie abgespielt: 283 Operationen, 0 Fehler, alle 81 berührten Dateien Byte für Byte gleich der Messkopie (dort zusätzlich nur die von Git ignorierten `*.tsbuildinfo` aus dem Typecheck).

35. **N35 · Laufzeit-Bezugswerte** (Kopf-Tabelle C19; Testläufe; N31; C12 „Vorab“; C19 Step 3 und 7; C21 Step 9): Einige Bezugswerte lagen knapp außerhalb ihrer Spannen, und für `typecheck --workspaces` nannte N31 eine andere Spanne (60–88 s) als C11 Step 10 und C21 Step 9 (55–125 s). Nachgemessen auf einer frischen Kopie von `cd6c8394ee`, je dreimal: `verbund-kette.test.ts` allein 10,49–10,57 s (`63 ok, 0 fehlgeschlagen.`, 18 Abschnitte, 0 `FAIL`), `selftest:verbund` 24,9–25,1 s (203 / 53 / 63), `npm run selftest -w @jm/app-runtime` nach C12 1,9–2,0 s (`50 passed`, `174 passed`); dazu einmal `typecheck --workspaces` nach C11: 87 s, 31 Workspaces, Exit 0. Die Prüfung hatte 10,48 s, 24,8 s, 1,9 s und 90 s gemessen. Nachgezogen: C19 Step 3 und Kopf-Tabelle 10,4–11 s, C19 Step 7 24,7–27 s, Testläufe und C21 Step 9 24,7–28 s. C12 „Vorab“ nennt die 1,3 s jetzt als Messung vom 08.10.2026 ohne 4b; der CSP-Teil aus 4b startet einen Kindprozess (`spawnSync` in `packages/app-runtime/test/selftest.ts`). N31 verweist auf die Spanne 55–125 s. Keine dieser Zahlen ist eine Grenze; G16 hält nur über einer genannten Grenze (C19 Step 3: unter 60 s).
36. **N36 · Arbeitsverzeichnis von C1** (der wichtige Befund; C1 „Arbeitsverzeichnis“, über „wie C1“ auch C2–C4; die Sätze zu den Zeilenangaben in C1, C5 und C7): C1 nannte als Stand des Branches noch `5f8ed15ef8`, als einzige Stelle in einer Aufgabe. Jetzt steht dort die Basis `adda584693` (N25) und dass `packages/master-link` seit `5f8ed15ef8` unverändert ist. Die Sätze „Zeilenangaben gelten für (den Stand) `5f8ed15ef8`“ in C1, C5 und C7 sagen dazu, dass die Angaben in diesen Dateien auch für `adda584693` gelten: `git diff --numstat 5f8ed15ef8 adda584693` ist für `packages/master-link`, `packages/show`, `packages/iveo` und `apps/launcher` leer (nachgeprüft wie in N33). Die übrigen Nennungen von `5f8ed15ef8` stehen als Geschichte („auf `5f8ed15ef8` waren es …“) oder als Lage in Dateien, die `main` nicht ändert (C2 „Dateien“, C18 `showPfad`).
37. **N37 · Überschrift G2 und Zusatzbitte** (G2; „Bewusst nicht in diesem Plan“): G2 hieß noch „Parallelarbeit Zoom Stage 4b (Merge klein halten)“, jetzt „Zoom Stage 4b auf `main` (Berührung klein halten)“ wie der Abschnitt im Kopf. Die Zusatzbitte nannte 4b im Präsens als laufende Arbeit auf `feat/zoom-stage4b`; jetzt steht dort, dass 4b seit PR #251 auf `main` ist (`2df1f79357`) und die Zusatzbitte eine eigene Zoom-Stufe danach (Issue #247).
38. **N38 · Vermerk zur dritten Nachprüfung** (Absatz vor N22): Der Vermerk vom 12.10.2026 nannte die vierte Runde als N25–N32; jetzt N25–N42, mit Verweis auf N39.
39. **N39 · Textpunkte der dritten Nachprüfung: offen, mit Zeitpunkt** (Kopf „Umsetzung“; Einleitung der vierten Runde; Schlussabschnitt, „Stand der Owner-Punkte“ und „Umsetzung“): Kopf und Schlussabschnitt meldeten den Neuaufsatz ohne Einschränkung als erledigt, und die Aufzählung der offenen Punkte im Schlussabschnitt nannte die Textpunkte nicht, obwohl der Absatz vor N22 sie in diesen Durchgang gelegt hatte. Jetzt sagen beide Stellen, dass sie offen sind und vor C21 gehören. Drei der sechs Punkte betreffen Texte, die C21 schreibt: die Erwartung zum stehenden Hinweis nach „Öffnen…“ in der Abnahme-Datei (Step 2), den Doku-Satz zur Log-Drossel (Step 3) und zwei Notes-Einträge (Step 7). Werden sie geändert, ist C21 neu abzuspielen. Die übrigen drei (Liste in N17, „über/unter der Tabelle“ in der Kopf-Tabelle zu C21, Ort geänderter Texte in C21 Step 10) sind Plantext ohne Operation. Den Zeitpunkt vor C21 legt die steuernde Sitzung fest; spätestens gehören die Notes-Einträge zum Entwurf, der in C21 Step 10 dem Owner vorliegt.
40. **N40 · Spec 19.6 im Wortlaut: Abweichung gemeldet** (Kopf „Spec“; C11 Step 12 und „Abweichungen“; Selbstprüfung 19.6): 19.6 sagt: Neuer Schritt im Job `selftests` „app-runtime (CSP, Verbund-Anzeige, Abo-Zustand)“. C11 benennt seit N26 den 4b-Schritt um. Der Plan gab 19.6 als „Spec 19.6 verlangt einen Schritt“ wieder und führte die Abweichung im Wortlaut (anderer Name; Umbenennen statt Anlegen) nirgends. Jetzt gibt C11 Step 12 die Spec richtig wieder, C11 „Abweichungen“ begründet den Weg (ein zweiter Schritt mit demselben Befehl liefe dieselben Tests doppelt), und der Kopf (Absatz „Spec“) und Selbstprüfung 19.6 melden die Abweichung. Der Zweck von 19.6 bleibt: genau ein Schritt, der beide Teile aus 19.4 ausführt, ohne Electron, in der Zeitgrenze von 15 min (`timeout-minutes: 15` im Job). Keine Operation ändert sich; nachgeprüft auf der frischen Kopie: C11 Step 12 ergibt weiter `22 Schritte, letzter: App-Laufzeit (Log-Aufräumen, CSP, Verbund-Anzeige, Abo-Zustand) | npm run selftest -w @jm/app-runtime | app-runtime-Schritte: 1`. Eine „Weicht ab“-Entscheidung mit Owner-Bestätigung ist das nicht; nach der Regel im Kopf ist die Abweichung gemeldet.
41. **N41 · Überholt-Vermerke an Ort und Stelle** (N15, N20, N21, Absatz nach N21): Diese Punkte nannten im Präsens Zahlen vom 08.10.2026 (`index.ts` nach C13 663 Zeilen, der Job mit 20 Schritten). Wie bei N11 trägt jede Stelle jetzt einen Vermerk: 675 Zeilen (N29) bzw. 22 Schritte (N26).
42. **N42 · Ortsangaben in N27 und N34**: N27 nennt jetzt auch den Kopf (Unterpunkt „Zählstände“: `50 passed` statt `15 passed`), N34 die Selbstprüfung 3 (dort steht die vierte Runde). Beide Änderungen waren inhaltlich gedeckt; es fehlte nur die Ortsangabe.

## Owner-Fragen und Freigaben

Keine dieser Fragen hält den Beginn der Umsetzung auf. **Stand 08.10.2026 (N19): offen ist nur Nr. 2.** Die Antworten des Owners stehen bei den Fragen.

1. **„Weicht ab“ bestätigen:** E6 (`kopplung().letzteAdresse` aus der laufenden Verbindung, C4), E9 (dieselbe Show unverändert erneut gemeldet → keine neue Epoche, Spec 18; Nr. 7), E14 (`timerAktionenAusShow` mit drittem Parameter, C14), E15 (`waehleLauncher` mit `istHier` statt `eigeneAdressen`, C17/C18), E47 (Abo nur, wenn das Tool folgt, Spec 12/16.1; Nr. 4). **Beantwortet (Owner 08.10.2026): alle fünf bestätigt.**
2. **Texte ohne Spec-Vorgabe** (Tabelle unter „Entscheidungen“) vor dem Release freigeben; dazu die Notes-Texte aus C21 Step 7 (Ledger-Zeile „Owner-Freigabe Notes R2“). **Offen** (Freigabe vor dem Commit von C21).
3. **Modal bei einem Bezieher:** Spec 15.5 wörtlich ergibt „· 1 Tools beziehen sie“. Soll es „· 1 Tool bezieht sie“ heißen? (C10, eine Zeile in `verbund-texte.ts` und ein Test) **Beantwortet (Owner 08.10.2026): ja, Einzahl;** umgesetzt in C10 mit einer Prüfung, rot in der Gegenprobe (N16).
4. **E47 Abo nur, wenn das Tool folgt (Weicht ab, Nr. 1):** Tools ohne Anwenden (Q&A, Battle, Caption …) abonnieren nicht. Folge: Ein Tool, das sich später als 10 s nach seiner Anmeldung registriert, steht am Master bis dahin auf „ohne Show-Daten (Update nötig)“. Die drei Tools registrieren gleich nach dem Start. **Beantwortet (Owner 08.10.2026): bestätigt.**
5. **E55/E56 Tools beim Start und nach dem Entkoppeln:** Start-Deep-Link erst nach der Registrierung (Titler, Rundown); eigene Ordnerwahl bzw. „Öffnen…“/„Neu“ außerhalb des Verbundmodus löschen den Zwischenspeicher des früheren Masters. Kein offener Punkt mehr (Owner 08.10.2026: offen bleiben nur die Texte ohne Spec-Vorgabe und die Notes R2, N19); die Startreihenfolge und die eigene Wahl nach dem Entkoppeln stehen als Zusatzprüfungen in der Abnahme-Datei (N17, N23).
6. **E53 Titler, wo 17.2 schweigt:** Eine neue Master-Show ohne Speaker löscht `show-zuletzt.json`; `verbundEnde` ändert nur die Quelle `master`; Q4 nennt den vollen Showname. Kein offener Punkt mehr (Owner 08.10.2026: offen bleiben nur die Texte ohne Spec-Vorgabe und die Notes R2, N19).
7. **E9 (Weicht ab, Nr. 1; Hinweis, kein Blocker):** „Master öffnet dieselbe Show wieder“ ergibt nur nach einem Neustart der Rolle eine neue Epoche; ein erneutes Melden derselben unveränderten Show erzeugt keine `aenderung`. **Beantwortet (Owner 08.10.2026): bestätigt.**
8. **Durchgang C20:** braucht die Ledger-Zeile „Owner-Freigabe C20“ (berührt `%APPDATA%`, startet gebaute Tools). Er ist Pflicht vor dem Merge (N14). **Beantwortet (Owner 08.10.2026): freigegeben.** Die Ledger-Zeile setzt die steuernde Sitzung beim Start der Umsetzung; C20 läuft dann ganz.
9. **Zusatzbitte Zoom-Bridge** („Shared Content als eigenständiges Signal“): nicht Teil von R2. Erledigt in der steuernden Sitzung am 08.10.2026: Machbarkeit geprüft, Issue #247 angelegt, eigene Zoom-Stufe nach 4b; kein Owner-Punkt für diesen Plan.

---

## Aufgaben

### Task 1: C1 · `ZeilenLeser` gibt Zeilen einzeln heraus, Grenze beim Entnehmen, Stückliste; neue `GRENZEN`

**Spec:** `docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md` 2.4 Nr. 3; 13.4 (Tabelle); 13.5 Zeilen 1 und 2 („Grenze je Stück statt je Zeile“, „Kopieren je Stück“) samt ihren Tests; 19.1 erster Punkt („alle Tests aus 13.5“). Gliederung: E1, Vormerkung 1, Review Focus 1.

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b-r2` (Branch `feat/master-link-teil2b-r2`, Basis `adda584693` nach dem Neuaufsatz N25; `packages/master-link` ist seit `5f8ed15ef8` unverändert, N33, N36). Alle Pfade relativ dazu. Voraussetzung: `node_modules\.package-lock.json` existiert, und `npm run selftest -w @jm/master-link` endet mit `572 ok, 0 fehlgeschlagen.`

**Dateien:**
- Modify: `packages/master-link/src/fristen.ts` Zeilen 68–70 (Ende von `GRENZEN`)
- Modify: `packages/master-link/src/rahmen.ts` Zeilen 99–127 (Klasse `ZeilenLeser`, ganz)
- Modify: `packages/master-link/src/verbindung.ts` Zeilen 36–47 (`aufDaten` bis einschließlich `const r = dekodiere(zeile);`)
- Test: `packages/master-link/test/rahmen.test.ts` Zeilen 3–4 (Importe), 73–85 (Abschnitt „Rahmen: Zeilenleser“), 206–210 (Dateiende)

Zeilenangaben gelten für `5f8ed15ef8` (in diesen Dateien gleich `adda584693`, N33, N36). Maßgeblich ist immer der wortgleiche Vorher-Text.

**Interfaces:**
- Consumes: keine.
- Produces (Register S-A, exakt so; C2–C21 bauen darauf):
  ```ts
  // packages/master-link/src/fristen.ts — GRENZEN erweitert, bestehende Werte unverändert
  GRENZEN.maxStandZeile    // 921_600   UTF-8-Bytes der fertigen Zeile samt '\n' (Spec 13.4)
  GRENZEN.maxAbosJeRechner // 32        (Spec 13.4)
  GRENZEN.stauBytes        // 1_048_576 socket.writableLength je Sitzung (Spec 13.6)

  // packages/master-link/src/rahmen.ts
  export class ZeilenLeser {
    constructor(grenze: number, messung?: { kopiert: number });
    setzeGrenze(grenze: number): void;
    /** Hängt das Stück an; sucht '\n' nur im neuen Stück. Wirft nie. */
    fuettere(stueck: Buffer): void;
    /** Nächste vollständige Zeile (UTF-8, ohne '\n') oder null. Wirft ZeileZuLang, wenn sie länger als die AKTUELLE
     *  Grenze ist, oder – ohne vollständige Zeile – wenn der Rest die Grenze übersteigt. */
    naechste(): string | null;
  }
  ```
  `fuettere(): string[]` entfällt (E1). Einziger Aufrufer ist `Verbindung.aufDaten`; `git grep -n "fuettere\|ZeilenLeser" -- apps packages ':!packages/master-link'` ist leer.

**Regeln für diese Aufgabe:**
- Nur `packages/master-link` ändern. `koppeln.ts` bleibt unberührt (G1). `PROTOKOLL` bleibt 1 (G3).
- TDD: erst den Test rot sehen, dann Code (G11).
- Die Dateien liegen mit CRLF vor. Änderungen nur mit dem Edit-Werkzeug (Vorher-Text exakt ersetzen), nie mit `sed` (G12).
- Weicht eine Zählung ab, anhalten und melden (G16).
- Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel (G10).

---

- [ ] **Step 1: Fehlschlagende Tests schreiben** (`packages/master-link/test/rahmen.test.ts`)

Ersetzung 1 (Zeilen 3–4), Vorher:
```ts
import { tlsPaar } from './tlspaar';
import { dekodiere, kodiere, PROTOKOLL, ZeileZuLang, ZeilenLeser, type Nachricht } from '../src/rahmen';
```
Nachher:
```ts
import { tlsPaar } from './tlspaar';
import { GRENZEN } from '../src/fristen';
import { dekodiere, kodiere, PROTOKOLL, ZeileZuLang, ZeilenLeser, type Nachricht } from '../src/rahmen';
```

Ersetzung 2 (Zeilen 73–85), Vorher:
```ts
  abschnitt('Rahmen: Zeilenleser');
  const l = new ZeilenLeser(16);
  gleich(l.fuettere(Buffer.from('{"a"')), [], 'unvollständige Zeile → nichts');
  gleich(l.fuettere(Buffer.from(':1}\n{"b":2}\n')), ['{"a":1}', '{"b":2}'], 'zwei Zeilen über zwei Stücke');
  const e = Buffer.from('é\n', 'utf8');
  gleich([...l.fuettere(e.subarray(0, 1)), ...l.fuettere(e.subarray(1))], ['é'], 'UTF-8-Zeichen über Stückgrenze');
  let geworfen = false;
  try { l.fuettere(Buffer.from('x'.repeat(17))); } catch (f) { geworfen = f instanceof ZeileZuLang; }
  pruefe(geworfen, 'unvollständige Zeile über der Grenze → ZeileZuLang');
  const l2 = new ZeilenLeser(4);
  gleich(l2.fuettere(Buffer.from('abcd\n')), ['abcd'], 'Zeile genau an der Grenze ist erlaubt');
  l2.setzeGrenze(100);
  gleich(l2.fuettere(Buffer.from('x'.repeat(50) + '\n')), ['x'.repeat(50)], 'setzeGrenze hebt die Grenze an');
```
Nachher:
```ts
  abschnitt('Rahmen: Zeilenleser');
  /** Ein Stück füttern und alle fertigen Zeilen entnehmen — wie Verbindung.aufDaten, nur ohne Zuhörer dazwischen. */
  const alleZeilen = (leser: ZeilenLeser, stueck: Buffer): string[] => {
    leser.fuettere(stueck);
    const zeilen: string[] = [];
    for (let z = leser.naechste(); z !== null; z = leser.naechste()) zeilen.push(z);
    return zeilen;
  };
  const l = new ZeilenLeser(16);
  gleich(alleZeilen(l, Buffer.from('{"a"')), [], 'unvollständige Zeile → nichts');
  gleich(alleZeilen(l, Buffer.from(':1}\n{"b":2}\n')), ['{"a":1}', '{"b":2}'], 'zwei Zeilen über zwei Stücke');
  const e = Buffer.from('é\n', 'utf8');
  gleich([...alleZeilen(l, e.subarray(0, 1)), ...alleZeilen(l, e.subarray(1))], ['é'], 'UTF-8-Zeichen über Stückgrenze');
  let geworfen = false;
  try { alleZeilen(l, Buffer.from('x'.repeat(17))); } catch (f) { geworfen = f instanceof ZeileZuLang; }
  pruefe(geworfen, 'unvollständige Zeile über der Grenze → ZeileZuLang');
  const l2 = new ZeilenLeser(4);
  gleich(alleZeilen(l2, Buffer.from('abcd\n')), ['abcd'], 'Zeile genau an der Grenze ist erlaubt');
  l2.setzeGrenze(100);
  gleich(alleZeilen(l2, Buffer.from('x'.repeat(50) + '\n')), ['x'.repeat(50)], 'setzeGrenze hebt die Grenze an');

  abschnitt('Rahmen: Zeilenleser gibt Zeilen einzeln heraus (Teil 2b, Spec 13.4, 13.5)');
  {
    gleich([GRENZEN.maxStandZeile, GRENZEN.maxAbosJeRechner, GRENZEN.stauBytes], [921_600, 32, 1_048_576],
      'Grenzen Teil 2b: Stand-Zeile 900 KiB, 32 Abos je Rechner, Stau 1 MiB');
    const gross = 'g'.repeat(900 * 1024);
    // Die Grenze gilt beim Entnehmen: setzeGrenze nach der ersten Zeile wirkt schon für die zweite Zeile desselben Stücks.
    const l3 = new ZeilenLeser(GRENZEN.vorAnmeldung);
    l3.fuettere(Buffer.from(`a\n${gross}\n`));
    gleich(l3.naechste(), 'a', 'Grenze gilt beim Entnehmen: die erste Zeile kommt mit 4 KiB heraus');
    l3.setzeGrenze(GRENZEN.nachAnmeldung);
    pruefe(l3.naechste() === gross, 'Grenze gilt beim Entnehmen: nach setzeGrenze(1 MiB) kommt die 900-KiB-Zeile desselben Stücks heraus');
    gleich(l3.naechste(), null, '… danach keine weitere Zeile');
    const l4 = new ZeilenLeser(GRENZEN.vorAnmeldung);
    l4.fuettere(Buffer.from(`a\n${gross}\n`));
    const erste = l4.naechste();
    let wurf4 = false;
    try { l4.naechste(); } catch (f) { wurf4 = f instanceof ZeileZuLang; }
    pruefe(erste === 'a' && wurf4, 'ohne Anheben wirft die zweite Zeile, die erste kam vorher heraus');
    // Unvollständige Zeile: genau an der Grenze wartet sie, ein Byte darüber wirft.
    const l5 = new ZeilenLeser(4096);
    l5.fuettere(Buffer.alloc(4096, 0x78));
    gleich(l5.naechste(), null, 'unvollständige Zeile mit genau 4096 Byte → nichts, kein Wurf');
    l5.fuettere(Buffer.from('x'));
    let wurf5 = false;
    try { l5.naechste(); } catch (f) { wurf5 = f instanceof ZeileZuLang; }
    pruefe(wurf5, 'unvollständige Zeile mit 4097 Byte (ohne \\n) → ZeileZuLang');
    const l6 = new ZeilenLeser(4096);
    l6.fuettere(Buffer.from(`${'x'.repeat(4096)}\n${'y'.repeat(4097)}\n`));
    gleich(l6.naechste()?.length, 4096, 'Zeile mit genau 4096 Byte → heraus');
    let wurf6 = false;
    try { l6.naechste(); } catch (f) { wurf6 = f instanceof ZeileZuLang; }
    pruefe(wurf6, 'Zeile mit 4097 Byte → ZeileZuLang');
    // Review Focus 1: ein „ä“ (zwei Byte) genau auf der Stückgrenze.
    const umlaut = Buffer.from('{"name":"Bär"}\n', 'utf8');
    const mitte = umlaut.indexOf(0xc3) + 1;
    const l7 = new ZeilenLeser(4096);
    l7.fuettere(umlaut.subarray(0, mitte));
    gleich(l7.naechste(), null, 'Umlaut über die Stückgrenze: erste Hälfte → noch keine Zeile');
    l7.fuettere(umlaut.subarray(mitte));
    gleich(l7.naechste(), '{"name":"Bär"}', 'Umlaut über die Stückgrenze → unverändert dekodiert');
    // Kopierzähler (nur im Test gesetzt, Spec 19.1): zusammengefügt wird nur die fertige Zeile.
    const messung = { kopiert: 0 };
    const l8 = new ZeilenLeser(GRENZEN.nachAnmeldung, messung);
    const mib = Buffer.alloc(GRENZEN.nachAnmeldung + 1, 0x7a);
    mib[GRENZEN.nachAnmeldung] = 0x0a;
    let heraus: string | null = null;
    for (let ab = 0; ab < mib.length; ab += 16 * 1024) {
      l8.fuettere(mib.subarray(ab, ab + 16 * 1024));
      heraus = l8.naechste() ?? heraus;
    }
    gleich(heraus?.length, GRENZEN.nachAnmeldung, '1 MiB in 16-KiB-Stücken: die Zeile kommt ganz heraus');
    pruefe(messung.kopiert > 0 && messung.kopiert <= 2 * 1024 * 1024,
      `1 MiB in 16-KiB-Stücken kopiert höchstens 2 MiB (gemessen: ${messung.kopiert} Byte)`);
    const messung2 = { kopiert: 0 };
    const l9 = new ZeilenLeser(4096, messung2);
    gleich(alleZeilen(l9, Buffer.from('{"t":"puls"}\n{"t":"puls"}\n')), ['{"t":"puls"}', '{"t":"puls"}'], 'zwei ganze Zeilen in einem Stück');
    gleich(messung2.kopiert, 0, 'Zeilen ganz in einem Stück kopieren nichts');
  }
```

Ersetzung 3 (Zeilen 206–210, Dateiende), Vorher:
```ts
    pruefe(enden[0] === undefined, 'Zwangsabbruch nach regulärem Schließen: ende ohne Fehler');
    gleich(nachrichten, 1, 'Daten nach schliesse() in einem späteren Chunk werden verworfen (auch die überlange Zeile)');
    p.schliesse();
  }
}
```
Nachher:
```ts
    pruefe(enden[0] === undefined, 'Zwangsabbruch nach regulärem Schließen: ende ohne Fehler');
    gleich(nachrichten, 1, 'Daten nach schliesse() in einem späteren Chunk werden verworfen (auch die überlange Zeile)');
    p.schliesse();
  }

  abschnitt('Verbindung: Grenze je Zeile im selben TLS-Schreibvorgang (Teil 2b, Spec 13.5)');
  {
    // Wie 'angemeldet': der Zuhörer der ersten Zeile hebt die Grenze. Beide Zeilen gehen in EINEM write hinaus.
    const p = await tlsPaar(z);
    p.client.on('error', () => {}); // kappt der Server (Fehlerfall), meldet der Client ECONNRESET — dann zählt die Prüfzeile
    const v = new Verbindung(p.server, GRENZEN.vorAnmeldung);
    const angekommen: string[] = [];
    let ende: Error | undefined | null = null;
    v.on('nachricht', (n: Nachricht) => {
      angekommen.push(n.t);
      if (n.t === 'puls') v.setzeGrenze(GRENZEN.nachAnmeldung);
    });
    v.on('unbekannt', (t: string) => angekommen.push(t));
    v.on('ende', (f?: Error) => { ende = f; });
    p.client.write(`${kodiere({ t: 'puls' })}{"t":"gross","x":"${'y'.repeat(900 * 1024)}"}\n`);
    await bis(() => angekommen.length === 2 || ende !== null, 3000);
    gleich(angekommen, ['puls', 'gross'], 'Zuhörer der ersten Zeile hebt die Grenze: die 900-KiB-Zeile desselben Schreibvorgangs kommt an');
    pruefe(ende === null && v.offen, '… kein ende, die Verbindung bleibt offen');
    p.schliesse();
  }
  {
    const p = await tlsPaar(z);
    p.client.on('error', () => {}); // der Server kappt mitten im Schreiben: ECONNRESET beim Client ist hier nicht der Gegenstand
    const v = new Verbindung(p.server, GRENZEN.vorAnmeldung);
    const angekommen: string[] = [];
    let ende: Error | undefined | null = null;
    v.on('nachricht', (n: Nachricht) => angekommen.push(n.t));
    v.on('unbekannt', (t: string) => angekommen.push(t));
    v.on('ende', (f?: Error) => { ende = f; });
    p.client.write(`${kodiere({ t: 'puls' })}{"t":"gross","x":"${'y'.repeat(900 * 1024)}"}\n`);
    await bis(() => ende !== null, 3000);
    pruefe(ende !== null && (ende as Error).message === 'rahmen', 'ohne Anheben: ende("rahmen")');
    gleich(angekommen, ['puls'], '… die erste Zeile kam vorher an (früher ging sie mit dem ganzen Stück verloren)');
    p.schliesse();
  }
}
```
Die bestehenden Fälle „Nach schliesse() … gepipelte Zeilen verworfen“ (Zeilen 154–209) bleiben unverändert und müssen grün bleiben.

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/master-link
```
Erwartet (gemessen): Abbruch nach 134 `ok`-Zeilen, Exitcode 1:
```
TypeError: leser.naechste is not a function
    at alleZeilen (…\packages\master-link\test\rahmen.test.ts:79:24)
```

- [ ] **Step 3: Neue Grenzen** (`packages/master-link/src/fristen.ts`, Zeilen 68–70)

Vorher:
```ts
  /** mDNS-TXT ≤ 255 Byte je Eintrag: 60 Zeichen à ≤ 4 Byte + "name=" passen. */
  maxNamenLaenge: 60,
} as const;
```
Nachher:
```ts
  /** mDNS-TXT ≤ 255 Byte je Eintrag: 60 Zeichen à ≤ 4 Byte + "name=" passen. */
  maxNamenLaenge: 60,
  /** Teil 2b (Spec 13.4): größte stand-/aenderung-Zeile des Masters — UTF-8-Bytes der fertigen Zeile samt '\n'. */
  maxStandZeile: 921_600,
  /** Teil 2b (Spec 13.4): Abos je gekoppeltem Rechner (rechnerId); weitere beantwortet der Verteiler nicht. */
  maxAbosJeRechner: 32,
  /** Teil 2b (Spec 13.6): Stau-Grenze je Sitzung — Bytes im Schreibpuffer (socket.writableLength). */
  stauBytes: 1024 * 1024,
} as const;
```

- [ ] **Step 4: `ZeilenLeser` neu** (`packages/master-link/src/rahmen.ts`, Zeilen 99–127)

Vorher:
```ts
/** Zerlegt einen Bytestrom in Zeilen; eine Zeile (auch eine unvollständige) über `grenze` Bytes wirft. */
export class ZeilenLeser {
  private grenze: number;
  private puffer: Buffer = Buffer.alloc(0);

  constructor(grenze: number) {
    this.grenze = grenze;
  }

  setzeGrenze(grenze: number): void {
    this.grenze = grenze;
  }

  fuettere(stueck: Buffer): string[] {
    this.puffer = this.puffer.length > 0 ? Buffer.concat([this.puffer, stueck]) : stueck;
    const zeilen: string[] = [];
    let start = 0;
    for (;;) {
      const nl = this.puffer.indexOf(0x0a, start);
      if (nl === -1) break;
      if (nl - start > this.grenze) throw new ZeileZuLang();
      zeilen.push(this.puffer.subarray(start, nl).toString('utf8'));
      start = nl + 1;
    }
    this.puffer = Buffer.from(this.puffer.subarray(start));
    if (this.puffer.length > this.grenze) throw new ZeileZuLang();
    return zeilen;
  }
}
```
Nachher:
```ts
/**
 * Zerlegt einen Bytestrom in Zeilen (Teil 2b, Spec 13.5). `fuettere` hängt ein Stück an und merkt sich seine
 * Zeilenenden — gesucht wird nur im neuen Stück. `naechste` gibt EINE Zeile heraus; die Grenze gilt beim Entnehmen.
 * So wirkt ein setzeGrenze() im Zuhörer einer Zeile (etwa 'angemeldet') schon für die nächste Zeile desselben Stücks.
 * Der Puffer ist eine Liste von Stücken: zusammengefügt (kopiert) wird nur eine fertige Zeile, die über mehrere
 * Stücke reicht. `messung` zählt diese Bytes (nur im Test gesetzt, Spec 19.1).
 */
export class ZeilenLeser {
  private grenze: number;
  private readonly messung: { kopiert: number } | undefined;
  /** Noch nicht entnommene Stücke; im ersten beginnt der Rest bei `kopf`. */
  private stuecke: Buffer[] = [];
  private kopf = 0;
  /** Stromposition des ersten nicht entnommenen Bytes bzw. hinter dem letzten gefütterten Byte. */
  private gelesen = 0;
  private gesamt = 0;
  /** Stromposition jedes noch nicht entnommenen '\n', in Reihenfolge; `naechstesEnde` zeigt auf das nächste. */
  private enden: number[] = [];
  private naechstesEnde = 0;

  constructor(grenze: number, messung?: { kopiert: number }) {
    this.grenze = grenze;
    this.messung = messung;
  }

  setzeGrenze(grenze: number): void {
    this.grenze = grenze;
  }

  /** Hängt das Stück an; sucht '\n' nur im neuen Stück. Wirft nie. */
  fuettere(stueck: Buffer): void {
    if (stueck.length === 0) return;
    for (let i = stueck.indexOf(0x0a); i !== -1; i = stueck.indexOf(0x0a, i + 1)) this.enden.push(this.gesamt + i);
    this.stuecke.push(stueck);
    this.gesamt += stueck.length;
  }

  /**
   * Nächste vollständige Zeile (UTF-8, ohne '\n') oder null. Wirft ZeileZuLang, wenn sie länger als die AKTUELLE
   * Grenze ist, oder – ohne vollständige Zeile – wenn der Rest (eine angefangene Zeile) die Grenze übersteigt.
   */
  naechste(): string | null {
    if (this.naechstesEnde >= this.enden.length) {
      if (this.gesamt - this.gelesen > this.grenze) throw new ZeileZuLang();
      return null;
    }
    const laenge = this.enden[this.naechstesEnde] - this.gelesen;
    if (laenge > this.grenze) throw new ZeileZuLang();
    this.naechstesEnde++;
    if (this.naechstesEnde === this.enden.length) {
      this.enden = [];
      this.naechstesEnde = 0;
    }
    const zeile = this.entnimm(laenge);
    this.vor(1); // das '\n'
    return zeile;
  }

  /** Die nächsten `n` Bytes als Text; über mehrere Stücke wird nur diese Zeile zusammengefügt. */
  private entnimm(n: number): string {
    const erstes = this.stuecke[0];
    if (this.kopf + n <= erstes.length) {
      const text = erstes.toString('utf8', this.kopf, this.kopf + n);
      this.vor(n);
      return text;
    }
    const teile: Buffer[] = [];
    let rest = n;
    let ab = this.kopf;
    for (let i = 0; rest > 0; i++) {
      const stueck = this.stuecke[i];
      const nimm = Math.min(rest, stueck.length - ab);
      teile.push(stueck.subarray(ab, ab + nimm));
      rest -= nimm;
      ab = 0;
    }
    if (this.messung) this.messung.kopiert += n;
    const text = Buffer.concat(teile, n).toString('utf8');
    this.vor(n);
    return text;
  }

  /** Rückt den Anfang des Rests um `n` Bytes vor und gibt ganz entnommene Stücke frei. */
  private vor(n: number): void {
    this.gelesen += n;
    let rest = n;
    while (rest > 0) {
      const uebrig = this.stuecke[0].length - this.kopf;
      if (rest < uebrig) {
        this.kopf += rest;
        return;
      }
      rest -= uebrig;
      this.stuecke.shift();
      this.kopf = 0;
    }
  }
}
```

- [ ] **Step 5: `Verbindung.aufDaten` entnimmt Zeile für Zeile** (`packages/master-link/src/verbindung.ts`, Zeilen 36–47)

Vorher:
```ts
  private aufDaten(d: Buffer): void {
    if (this.beendet || this.schliessend) return;
    let zeilen: string[];
    try {
      zeilen = this.leser.fuettere(d);
    } catch {
      this.brich();
      return;
    }
    for (const zeile of zeilen) {
      if (this.beendet || this.schliessend) return;
      const r = dekodiere(zeile);
```
Nachher:
```ts
  /**
   * Teil 2b (Spec 13.5): eine Zeile entnehmen, ausgeben, erst dann die nächste entnehmen. Die Grenze gilt so je Zeile —
   * hebt der Zuhörer von 'angemeldet' sie an, gilt für die nächste Zeile desselben Stücks schon 1 MiB.
   */
  private aufDaten(d: Buffer): void {
    if (this.beendet || this.schliessend) return;
    this.leser.fuettere(d);
    for (;;) {
      if (this.beendet || this.schliessend) return;
      let zeile: string | null;
      try {
        zeile = this.leser.naechste();
      } catch {
        this.brich();
        return;
      }
      if (zeile === null) return;
      const r = dekodiere(zeile);
```
Der Rest der Schleife (`kaputt` → `brich()`, sonst `emit`) bleibt wörtlich, wie er ist.

- [ ] **Step 6: Tests laufen lassen (grün)**

```
npm run selftest -w @jm/master-link
```
Erwartet: keine `FAIL`-Zeile, letzte Zeile `591 ok, 0 fehlgeschlagen.` (572 + 15 + 4), Exitcode 0, Laufzeit gemessen 31 s. Darunter:
```
── Rahmen: Zeilenleser gibt Zeilen einzeln heraus (Teil 2b, Spec 13.4, 13.5)
  ok  Grenzen Teil 2b: Stand-Zeile 900 KiB, 32 Abos je Rechner, Stau 1 MiB
  ok  Grenze gilt beim Entnehmen: die erste Zeile kommt mit 4 KiB heraus
  ok  Grenze gilt beim Entnehmen: nach setzeGrenze(1 MiB) kommt die 900-KiB-Zeile desselben Stücks heraus
  ok  … danach keine weitere Zeile
  ok  ohne Anheben wirft die zweite Zeile, die erste kam vorher heraus
  ok  unvollständige Zeile mit genau 4096 Byte → nichts, kein Wurf
  ok  unvollständige Zeile mit 4097 Byte (ohne \n) → ZeileZuLang
  ok  Zeile mit genau 4096 Byte → heraus
  ok  Zeile mit 4097 Byte → ZeileZuLang
  ok  Umlaut über die Stückgrenze: erste Hälfte → noch keine Zeile
  ok  Umlaut über die Stückgrenze → unverändert dekodiert
  ok  1 MiB in 16-KiB-Stücken: die Zeile kommt ganz heraus
  ok  1 MiB in 16-KiB-Stücken kopiert höchstens 2 MiB (gemessen: 1048576 Byte)
  ok  zwei ganze Zeilen in einem Stück
  ok  Zeilen ganz in einem Stück kopieren nichts
…
── Verbindung: Grenze je Zeile im selben TLS-Schreibvorgang (Teil 2b, Spec 13.5)
  ok  Zuhörer der ersten Zeile hebt die Grenze: die 900-KiB-Zeile desselben Schreibvorgangs kommt an
  ok  … kein ende, die Verbindung bleibt offen
  ok  ohne Anheben: ende("rahmen")
  ok  … die erste Zeile kam vorher an (früher ging sie mit dem ganzen Stück verloren)
```
Der Abschnitt „Rahmen: Zeilenleser“ zählt weiter 6 `ok` (die alten Fälle über `alleZeilen`).

- [ ] **Step 7: Gegenprobe — die TLS-Tests fangen „Grenze je Stück“** (`packages/master-link/src/verbindung.ts`, vorübergehend)

Die neue Schleife vorübergehend so umbauen, dass sie erst alle Zeilen entnimmt und dann ausgibt (das alte Verhalten). Vorher:
```ts
    this.leser.fuettere(d);
    for (;;) {
      if (this.beendet || this.schliessend) return;
      let zeile: string | null;
      try {
        zeile = this.leser.naechste();
      } catch {
        this.brich();
        return;
      }
      if (zeile === null) return;
```
Nachher (nur für diesen Lauf):
```ts
    this.leser.fuettere(d);
    const alle: string[] = [];
    try {
      for (let z = this.leser.naechste(); z !== null; z = this.leser.naechste()) alle.push(z);
    } catch {
      this.brich();
      return;
    }
    for (const zeile of alle) {
      if (this.beendet || this.schliessend) return;
```
```
npm run selftest -w @jm/master-link
```
Erwartet (gemessen), Exitcode 1:
```
FAIL  Zuhörer der ersten Zeile hebt die Grenze: die 900-KiB-Zeile desselben Schreibvorgangs kommt an (ist [], soll ["puls","gross"])
FAIL  … kein ende, die Verbindung bleibt offen
FAIL  … die erste Zeile kam vorher an (früher ging sie mit dem ganzen Stück verloren) (ist [], soll ["puls"])
588 ok, 3 fehlgeschlagen.
```
Dann die Ersetzung genau zurücknehmen (Nachher-Text wieder durch den Vorher-Text ersetzen) und Step 6 wiederholen: `591 ok, 0 fehlgeschlagen.`

- [ ] **Step 8: Typecheck und Zeilenenden**

```
npm run typecheck -w @jm/master-link
node -e "for (const f of process.argv.slice(1)) { const t = require('fs').readFileSync(f, 'utf8'); console.log(f, (t.match(/\n/g) || []).length, (t.match(/\r\n/g) || []).length); }" packages/master-link/src/fristen.ts packages/master-link/src/rahmen.ts packages/master-link/src/verbindung.ts packages/master-link/test/rahmen.test.ts
```
Erwartet: `tsc` ohne Meldung, Exitcode 0; dann:
```
packages/master-link/src/fristen.ts 90 90
packages/master-link/src/rahmen.ts 196 196
packages/master-link/src/verbindung.ts 95 95
packages/master-link/test/rahmen.test.ts 313 313
```

- [ ] **Step 9: Commit** (Bash-Werkzeug; Commit-Text ohne Umlaute)

```
git add packages/master-link/src/fristen.ts packages/master-link/src/rahmen.ts packages/master-link/src/verbindung.ts packages/master-link/test/rahmen.test.ts
git status --short
```
Erwartet genau:
```
M  packages/master-link/src/fristen.ts
M  packages/master-link/src/rahmen.ts
M  packages/master-link/src/verbindung.ts
M  packages/master-link/test/rahmen.test.ts
```
Dann:
```
git commit -m "feat(master-link): Zeilenleser gibt Zeilen einzeln heraus, Grenze je Zeile (Teil 2b R2)" -m "ZeilenLeser.fuettere haengt das Stueck an und merkt sich nur dessen Zeilenenden; naechste entnimmt eine Zeile und prueft sie gegen die aktuelle Grenze. Verbindung.aufDaten gibt jede Zeile aus, bevor sie die naechste entnimmt: ein setzeGrenze im Zuhoerer von angemeldet gilt schon fuer die naechste Zeile desselben TLS-Stuecks (Spec 13.5). Zusammengefuegt wird nur eine fertige Zeile ueber mehrere Stuecke (Testzaehler: 1 MiB in 16-KiB-Stuecken kopiert 1 MiB). GRENZEN um maxStandZeile 921600, maxAbosJeRechner 32 und stauBytes 1 MiB ergaenzt (Spec 13.4)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Keine an den Schnittstellen.
- `fuettere` merkt sich beim Anhängen alle Zeilenenden des neuen Stücks (eine lineare Suche je Stück); `naechste` sucht nicht mehr. Das erfüllt „gesucht wird nur im neuen Stück, ab der letzten Suchstelle“ (Spec 13.5).
- Der Kopierzähler zählt nur Bytes, die `Buffer.concat` für eine Zeile über mehrere Stücke zusammenfügt. Gemessen: genau 1 048 576 Byte für die 1-MiB-Zeile (vorher quadratisch).
- Zusätzliche Prüfzeilen über die Gliederung hinaus: die drei `GRENZEN`-Werte, „unvollständige Zeile mit genau 4096 Byte → nichts“, „… die Zeile kommt ganz heraus“ (ohne sie bestünde der Zählertest auch mit einem Leser, der nichts liefert), „erste Hälfte → noch keine Zeile“.
- Beide neuen TLS-Tests hängen `p.client.on('error', () => {})` an. Kappt der Server mitten im 900-KiB-Schreiben, meldet der Client `ECONNRESET`; ohne Zuhörer bräche der ganze Selbsttest mit „Unhandled 'error' event“ ab statt einer `FAIL`-Zeile (so gemessen, bevor die Zeilen dazukamen).

---

### Task 2: C2 · Nachrichten `abo`/`stand`/`aenderung` mit lockeren Prüfern, `show-daten.ts`, `sende` mit Rückgabe und `sendeZeile`

**Spec:** 13.1 (Nachrichten, Fassung), 13.2 (lockere Prüfer, Tabelle), 13.5 Zeilen 4 und 5 („Strenge Prüfer“, „`PROTOKOLL` erhöhen“), 13.6 erster Punkt, 13.7 „Rahmen“, 19.1 zweiter Punkt (`pruefeAbo`, `pruefeStand`: jede Regel gültig und ungültig). Gliederung: E2, G3, G6.

**Arbeitsverzeichnis/Voraussetzung:** wie C1; C1 ist committet, `npm run selftest -w @jm/master-link` endet mit `591 ok, 0 fehlgeschlagen.`

**Dateien:**
- Create: `packages/master-link/src/show-daten.ts`
- Create: `packages/master-link/test/show-daten.test.ts`
- Modify: `packages/master-link/src/rahmen.ts` Zeilen 19–20 (`export type Nachricht =`), 26–27 (`puls`), 75–76 (Ende von `PRUEFER`) — durch C1 nicht verschoben
- Modify: `packages/master-link/src/index.ts` Zeilen 5–6
- Modify: `packages/master-link/src/verbindung.ts` `sende` (Stand `5f8ed15ef8` Zeilen 68–70, nach C1 Zeilen 74–76)
- Modify: `packages/master-link/test/selftest.ts` Zeilen 6–7 und 16
- Modify: `packages/master-link/test/koppeln.test.ts` Zeile 179 (nur ein Typfehler durch `sende(): boolean`; `src/koppeln.ts` bleibt unberührt, G1)
- Test: `packages/master-link/test/rahmen.test.ts` nach „Teilnehmer mit falscher Art → kaputt“ (Stand `5f8ed15ef8` Zeile 35, nach C1 Zeile 36) und am Dateiende (nach dem C1-Block)

**Interfaces:**
- Consumes: C1 (`GRENZEN`, `ZeilenLeser`).
- Produces (Register S-A, exakt so):
  ```ts
  // packages/master-link/src/rahmen.ts
  export interface DatenZeile { t: 'abo' | 'stand' | 'aenderung'; [feld: string]: unknown }
  export type Nachricht = /* die acht Teil-1-Typen */ | DatenZeile;
  // PRUEFER: ['abo', () => true], ['stand', () => true], ['aenderung', () => true] — nie 'kaputt'

  // packages/master-link/src/verbindung.ts (class Verbindung)
  sende(n: Nachricht): boolean;          // true: an den Socket übergeben; false: geschlossen, schließend oder zerstört
  sendeZeile(zeile: string): boolean;    // fertige Zeile (kodiereStand); wirft ohne genau ein '\n' am Ende

  // packages/master-link/src/show-daten.ts (über src/index.ts: export * from './show-daten')
  export const SHOW_FASSUNG = 1;
  export type DatenGrund = 'keine-show' | 'zu-gross' | 'nicht-lesbar';
  export interface AboInhalt { art: 'show'; fassung: number }
  export interface StandInhalt {
    art: 'show'; fassung: number; epoche: string; folge: number;
    schluessel: string | null; show: Record<string, unknown> | null; grund?: DatenGrund; mitDokument: string[];
  }
  export type Pruefung<T> = { ok: true; wert: T } | { ok: false; grund: string };  // grund = Feldname aus Tabelle 13.2
  export function pruefeAbo(o: unknown): Pruefung<AboInhalt>;
  export function pruefeStand(o: unknown): Pruefung<StandInhalt>;   // für t 'stand' und 'aenderung'
  export function kodiereAbo(fassung?: number): string;             // '{"t":"abo","art":"show","fassung":1}\n'
  export function kodiereStand(t: 'stand' | 'aenderung', s: StandInhalt): string;  // genau eine Zeile mit '\n'
  export function zeilenBytes(zeile: string): number;               // Buffer.byteLength(zeile, 'utf8')
  export function antwortFassung(erbeten: number): number;          // Math.min(erbeten, SHOW_FASSUNG)
  ```
  `pruefeAbo`/`pruefeStand` liefern einen neu gebauten Wert ohne `t` und ohne fremde Felder; `show` ist dasselbe Objekt (nicht kopiert), `mitDokument` eine Kopie. Für kein Objekt ist der Grund `art`.

**Regeln für diese Aufgabe:** wie C1. Dazu G6: Ein Prüfgrund ist immer ein Feldname, nie ein Wert aus dem Netz (er geht in C3 und C12 ins Log).

---

- [ ] **Step 1: Fehlschlagende Tests im Rahmen-Test** (`packages/master-link/test/rahmen.test.ts`)

Ersetzung 1 (nach C1 Zeile 36), Vorher:
```ts
  gleich(dekodiere('{"t":"anmelden","protokoll":1,"rechnerId":"r","rechnerName":"B","signatur":"s","teilnehmer":{"art":"x","appId":"a","name":"n","version":"v","pid":1}}'), { art: 'kaputt' }, 'Teilnehmer mit falscher Art → kaputt');
```
Nachher:
```ts
  gleich(dekodiere('{"t":"anmelden","protokoll":1,"rechnerId":"r","rechnerName":"B","signatur":"s","teilnehmer":{"art":"x","appId":"a","name":"n","version":"v","pid":1}}'), { art: 'kaputt' }, 'Teilnehmer mit falscher Art → kaputt');

  abschnitt('Rahmen: Show-Daten mit lockeren Prüfern (Teil 2b, Spec 13.2)');
  const daten: Nachricht[] = [
    { t: 'abo', art: 'show', fassung: 1 },
    { t: 'stand', art: 'show', fassung: 1, epoche: 'e', folge: 0, schluessel: null, show: null, grund: 'keine-show', mitDokument: [] },
    { t: 'aenderung', art: 'show', fassung: 1, epoche: 'e', folge: 1, schluessel: null, show: null, grund: 'keine-show', mitDokument: [] },
  ];
  for (const n of daten) gleich(dekodiere(kodiere(n).slice(0, -1)), { art: 'nachricht', n }, `${n.t}: kodiere → dekodiere hin und zurück`);
  for (const zeile of ['{"t":"abo"}', '{"t":"stand","folge":"x"}', '{"t":"aenderung","show":[1,2]}', '{"t":"stand","epoche":null,"x":{}}']) {
    gleich(dekodiere(zeile).art, 'nachricht', `${zeile} → nachricht, nie kaputt (lockerer Prüfer)`);
  }
  gleich(PROTOKOLL, 1, 'PROTOKOLL bleibt 1 (Fähigkeiten laufen über fassung)');
```

Ersetzung 2 (Dateiende, Ende des C1-Blocks), Vorher:
```ts
    pruefe(ende !== null && (ende as Error).message === 'rahmen', 'ohne Anheben: ende("rahmen")');
    gleich(angekommen, ['puls'], '… die erste Zeile kam vorher an (früher ging sie mit dem ganzen Stück verloren)');
    p.schliesse();
  }
}
```
Nachher:
```ts
    pruefe(ende !== null && (ende as Error).message === 'rahmen', 'ohne Anheben: ende("rahmen")');
    gleich(angekommen, ['puls'], '… die erste Zeile kam vorher an (früher ging sie mit dem ganzen Stück verloren)');
    p.schliesse();
  }

  abschnitt('Verbindung: Show-Daten, sende mit Rückgabe, sendeZeile (Teil 2b, Spec 13.2, 13.6)');
  {
    const p = await tlsPaar(z);
    const v = new Verbindung(p.server, GRENZEN.nachAnmeldung);
    const empfangen: Nachricht[] = [];
    let ende: Error | undefined | null = null;
    v.on('nachricht', (n: Nachricht) => empfangen.push(n));
    v.on('ende', (f?: Error) => { ende = f; });
    p.client.write('{"t":"stand","folge":"x","show":[]}\n');
    await bis(() => empfangen.length === 1 || ende !== null);
    gleich(empfangen, [{ t: 'stand', folge: 'x', show: [] }], 'stand mit falschem Feld → Ereignis nachricht (den Inhalt prüft der Empfänger)');
    pruefe(ende === null && v.offen, '… die Leitung bleibt');
    let gelesen = '';
    p.client.on('data', (d: Buffer) => { gelesen += d.toString('utf8'); });
    const zeile = '{"t":"aenderung","art":"show","fassung":1,"epoche":"e","folge":1,"schluessel":null,"show":null,"grund":"keine-show","mitDokument":[]}\n';
    gleich(v.sende({ t: 'puls' }), true, 'sende: offene Verbindung → true');
    gleich(v.sendeZeile(zeile), true, 'sendeZeile: offene Verbindung → true');
    await bis(() => gelesen.length >= 13 + zeile.length);
    gleich(gelesen, `{"t":"puls"}\n${zeile}`, 'sendeZeile: die fertige Zeile kommt unverändert an');
    const wirft = (x: string): boolean => {
      try {
        v.sendeZeile(x);
        return false;
      } catch {
        return true;
      }
    };
    pruefe(wirft('{"t":"puls"}'), 'sendeZeile ohne \\n am Ende → wirft');
    pruefe(wirft('{"t":"puls"}\n{"t":"puls"}\n'), 'sendeZeile mit \\n mitten in der Zeile → wirft');
    v.schliesse();
    gleich([v.sende({ t: 'puls' }), v.sendeZeile(zeile)], [false, false], 'nach schliesse(): sende und sendeZeile → false');
    p.schliesse();
  }
}
```

- [ ] **Step 2: Test laufen lassen (rot, Teil 1)**

```
npm run selftest -w @jm/master-link
```
Erwartet (gemessen): Exitcode 1; nach 184 `ok`-Zeilen diese `FAIL`-Zeilen und der Abbruch:
```
FAIL  abo: kodiere → dekodiere hin und zurück (ist {"art":"unbekannt","t":"abo"}, soll {"art":"nachricht","n":{"t":"abo","art":"show","fassung":1}})
FAIL  stand: kodiere → dekodiere hin und zurück (ist {"art":"unbekannt","t":"stand"}, soll …)
FAIL  aenderung: kodiere → dekodiere hin und zurück (ist {"art":"unbekannt","t":"aenderung"}, soll …)
FAIL  {"t":"abo"} → nachricht, nie kaputt (lockerer Prüfer) (ist "unbekannt", soll "nachricht")
FAIL  {"t":"stand","folge":"x"} → nachricht, nie kaputt (lockerer Prüfer) (ist "unbekannt", soll "nachricht")
FAIL  {"t":"aenderung","show":[1,2]} → nachricht, nie kaputt (lockerer Prüfer) (ist "unbekannt", soll "nachricht")
FAIL  {"t":"stand","epoche":null,"x":{}} → nachricht, nie kaputt (lockerer Prüfer) (ist "unbekannt", soll "nachricht")
FAIL  stand mit falschem Feld → Ereignis nachricht (den Inhalt prüft der Empfänger) (ist [], soll [{"t":"stand","folge":"x","show":[]}])
FAIL  sende: offene Verbindung → true (ist undefined, soll true)
TypeError: v.sendeZeile is not a function
    at laufe (…\packages\master-link\test\rahmen.test.ts:342:14)
```

- [ ] **Step 3: Fehlschlagende Tests für `show-daten.ts`**

Neue Datei `packages/master-link/test/show-daten.test.ts` (Write-Werkzeug):
```ts
// Show-Daten im Verbund (Teil 2b, Spec 13.1–13.3): Inhalt von abo, stand und aenderung prüfen und kodieren.
import { abschnitt, gleich, pruefe } from './helfer';
import { dekodiere } from '../src/rahmen';
import {
  antwortFassung, kodiereAbo, kodiereStand, pruefeAbo, pruefeStand, SHOW_FASSUNG, zeilenBytes, type StandInhalt,
} from '../src/show-daten';

export async function laufe(): Promise<void> {
  abschnitt('Show-Daten: pruefeAbo (Teil 2b, Spec 13.2)');
  gleich(SHOW_FASSUNG, 1, 'Show-Daten: Fassung 1');
  gleich(pruefeAbo({ t: 'abo', art: 'show', fassung: 1 }), { ok: true, wert: { art: 'show', fassung: 1 } },
    'pruefeAbo: Fassung 1 → gültig, der Wert trägt nur art und fassung');
  gleich(pruefeAbo({ t: 'abo', art: 'show', fassung: 2 }), { ok: true, wert: { art: 'show', fassung: 2 } },
    'pruefeAbo: Fassung 2 (ein künftiges Tool) → gültig');
  const ungueltigeAbos: Array<[string, unknown, string]> = [
    ['art fehlt', { t: 'abo', fassung: 1 }, 'art'],
    ["art 'Show'", { t: 'abo', art: 'Show', fassung: 1 }, 'art'],
    ['fassung 0', { t: 'abo', art: 'show', fassung: 0 }, 'fassung'],
    ['fassung 1.5', { t: 'abo', art: 'show', fassung: 1.5 }, 'fassung'],
    ["fassung '1'", { t: 'abo', art: 'show', fassung: '1' }, 'fassung'],
    ['fassung fehlt', { t: 'abo', art: 'show' }, 'fassung'],
    ['kein Objekt', 'abo', 'art'],
    ['null', null, 'art'],
  ];
  for (const [was, o, grund] of ungueltigeAbos) gleich(pruefeAbo(o), { ok: false, grund }, `pruefeAbo: ${was} → ungültig (${grund})`);

  abschnitt('Show-Daten: pruefeStand, jede Regel der Tabelle 13.2');
  const basis = {
    t: 'stand', art: 'show', fassung: 1, epoche: '3f2a9c1e-0b7d-4c55-9e21-7a1d2b3c4d5e', folge: 0,
    schluessel: '0123456789abcdef', show: { schemaVersion: 1, name: 'COP31', tools: [] }, mitDokument: ['jm-rundown'],
  };
  const mit = (teil: Record<string, unknown>, ohne?: string): Record<string, unknown> => {
    const o: Record<string, unknown> = { ...basis, ...teil };
    if (ohne) delete o[ohne];
    return o;
  };
  const gilt = (o: unknown, was: string): void => pruefe(pruefeStand(o).ok, `pruefeStand: ${was} → gültig`);
  const giltNicht = (o: unknown, grund: string, was: string): void =>
    gleich(pruefeStand(o), { ok: false, grund }, `pruefeStand: ${was} → ungültig (${grund})`);

  gleich(pruefeStand(basis), {
    ok: true,
    wert: { art: 'show', fassung: 1, epoche: basis.epoche, folge: 0, schluessel: basis.schluessel, show: basis.show, mitDokument: ['jm-rundown'] },
  }, 'pruefeStand: vollständiger Stand → gültig, der Wert ohne t');
  gilt(mit({ t: 'aenderung', folge: 7 }), 'aenderung mit denselben Feldern');
  gilt(mit({ fassung: 2 }), 'fassung 2');
  gilt(mit({ epoche: 'a'.repeat(64) }), 'epoche mit 64 Zeichen');
  gilt(mit({ epoche: 'Abc-09' }), 'epoche aus Buchstaben, Ziffern und -');
  gilt(mit({ folge: Number.MAX_SAFE_INTEGER }), 'folge MAX_SAFE_INTEGER');
  gilt(mit({ schluessel: null, show: null, grund: 'keine-show' }), 'schluessel null ohne Show');
  for (const g of ['keine-show', 'zu-gross', 'nicht-lesbar']) gilt(mit({ show: null, grund: g }), `show null mit grund ${g}`);
  gilt(mit({ mitDokument: Array.from({ length: 64 }, (_, i) => `jm-tool-${i}`) }), 'mitDokument mit 64 Einträgen');
  gilt(mit({ mitDokument: ['a'.repeat(64)] }), 'mitDokument-Eintrag mit 64 Zeichen');
  const ohneListe = pruefeStand(mit({}, 'mitDokument'));
  gleich(ohneListe.ok ? ohneListe.wert.mitDokument : null, [], 'pruefeStand: mitDokument fehlt → []');
  const ungueltigeStaende: Array<[string, Record<string, unknown>, string]> = [
    ["art 'Show'", mit({ art: 'Show' }), 'art'],
    ['fassung 0', mit({ fassung: 0 }), 'fassung'],
    ['fassung 1.5', mit({ fassung: 1.5 }), 'fassung'],
    ['epoche mit 65 Zeichen', mit({ epoche: 'a'.repeat(65) }), 'epoche'],
    ['epoche leer', mit({ epoche: '' }), 'epoche'],
    ['epoche mit Leerzeichen', mit({ epoche: 'a b' }), 'epoche'],
    ['epoche mit Umlaut', mit({ epoche: 'ä' }), 'epoche'],
    ['epoche fehlt', mit({}, 'epoche'), 'epoche'],
    ['folge -1', mit({ folge: -1 }), 'folge'],
    ['folge 1.5', mit({ folge: 1.5 }), 'folge'],
    ['folge MAX_SAFE_INTEGER + 1', mit({ folge: Number.MAX_SAFE_INTEGER + 1 }), 'folge'],
    ["folge 'x'", mit({ folge: 'x' }), 'folge'],
    ['schluessel mit Großbuchstaben', mit({ schluessel: '0123456789ABCDEF' }), 'schluessel'],
    ['schluessel mit 15 Zeichen', mit({ schluessel: '0123456789abcde' }), 'schluessel'],
    ['schluessel mit 17 Zeichen', mit({ schluessel: '0123456789abcdef0' }), 'schluessel'],
    ['schluessel fehlt', mit({}, 'schluessel'), 'schluessel'],
    ['show als Array', mit({ show: [] }), 'show'],
    ['show als Text', mit({ show: 'COP31' }), 'show'],
    ['show fehlt', mit({}, 'show'), 'show'],
    ['grund neben einem Show-Objekt', mit({ grund: 'zu-gross' }), 'grund'],
    ['show null ohne grund', mit({ show: null }), 'grund'],
    ['unbekannter grund', mit({ show: null, grund: 'weg' }), 'grund'],
    ['mitDokument mit 65 Einträgen', mit({ mitDokument: Array.from({ length: 65 }, (_, i) => `jm-tool-${i}`) }), 'mitDokument'],
    ["mitDokument mit 'A'", mit({ mitDokument: ['A'] }), 'mitDokument'],
    ['mitDokument-Eintrag mit 65 Zeichen', mit({ mitDokument: ['a'.repeat(65)] }), 'mitDokument'],
    ['mitDokument-Eintrag leer', mit({ mitDokument: [''] }), 'mitDokument'],
    ['mitDokument als Text', mit({ mitDokument: 'jm-rundown' }), 'mitDokument'],
  ];
  for (const [was, o, grund] of ungueltigeStaende) giltNicht(o, grund, was);
  giltNicht([basis], 'art', 'Array statt Objekt');

  abschnitt('Show-Daten: kodieren (Teil 2b, Spec 13.1)');
  gleich(kodiereAbo(), '{"t":"abo","art":"show","fassung":1}\n', 'kodiereAbo: Fassung 1, genau eine Zeile');
  const stand: StandInhalt = {
    art: 'show', fassung: 1, epoche: 'e-1', folge: 3, schluessel: '0123456789abcdef',
    show: { name: 'Zeile\nmit Umbruch und Bär' }, mitDokument: [],
  };
  for (const t of ['stand', 'aenderung'] as const) {
    const zeile = kodiereStand(t, stand);
    pruefe(zeile.indexOf('\n') === zeile.length - 1, `kodiereStand(${t}): genau eine Zeile mit \\n (auch mit Umbruch im Show-Namen)`);
    const d = dekodiere(zeile.slice(0, -1));
    pruefe(d.art === 'nachricht' && d.n.t === t, `kodiereStand(${t}) → dekodiere → Nachricht ${t}`);
    gleich(d.art === 'nachricht' ? pruefeStand(d.n) : null, { ok: true, wert: stand }, `kodiereStand(${t}) → dekodiere → pruefeStand ok, Inhalt gleich`);
  }
  const ohneShow: StandInhalt = { art: 'show', fassung: 1, epoche: 'e-1', folge: 4, schluessel: null, show: null, grund: 'keine-show', mitDokument: [] };
  gleich(kodiereStand('stand', ohneShow),
    '{"t":"stand","art":"show","fassung":1,"epoche":"e-1","folge":4,"schluessel":null,"show":null,"grund":"keine-show","mitDokument":[]}\n',
    'kodiereStand: feste Feldreihenfolge, grund nur ohne Show');
  gleich(zeilenBytes('ä'), 2, 'zeilenBytes zählt ä als 2 Byte');
  gleich(zeilenBytes(kodiereAbo()), 37, 'zeilenBytes einer Abo-Zeile samt \\n');
  gleich([antwortFassung(5), antwortFassung(1)], [1, 1], 'antwortFassung: höchstens die eigene Fassung (5 → 1, 1 → 1)');
}
```

Eintrag im Testläufer (`packages/master-link/test/selftest.ts`), Ersetzung 1 (Zeilen 6–7), Vorher:
```ts
import { laufe as rahmen } from './rahmen.test';
import { laufe as adresswahl } from './adresswahl.test';
```
Nachher:
```ts
import { laufe as rahmen } from './rahmen.test';
import { laufe as showDaten } from './show-daten.test';
import { laufe as adresswahl } from './adresswahl.test';
```
Ersetzung 2 (Zeile 16), Vorher:
```ts
for (const laufe of [code, beweis, rahmen, adresswahl, fehler, datei, speicher, mdns, server, koppeln, client]) {
```
Nachher:
```ts
for (const laufe of [code, beweis, rahmen, showDaten, adresswahl, fehler, datei, speicher, mdns, server, koppeln, client]) {
```

- [ ] **Step 4: Test laufen lassen (rot, Teil 2)**

```
npm run selftest -w @jm/master-link
```
Erwartet (gemessen): sofortiger Abbruch beim Laden, Exitcode 1:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\packages\master-link\src\show-daten' imported from …\packages\master-link\test\show-daten.test.ts
```

- [ ] **Step 5: `DatenZeile`, `Nachricht` und lockere Prüfer** (`packages/master-link/src/rahmen.ts`)

Ersetzung 1 (Zeilen 19–20), Vorher:
```ts
export type Nachricht =
  | { t: 'hallo'; protokoll: number; masterId: string; name: string; nonce: string }
```
Nachher:
```ts
/**
 * Show-Daten (Teil 2b, Spec 13.1): `abo` (Tool → Master), `stand` und `aenderung` (Master → Tool). Der Rahmen nimmt sie
 * mit lockeren Prüfern an: ein falsches Feld kappt nie die Leitung (Spec 13.2). Den Inhalt prüft der Empfänger mit
 * pruefeAbo/pruefeStand (show-daten.ts).
 */
export interface DatenZeile {
  t: 'abo' | 'stand' | 'aenderung';
  [feld: string]: unknown;
}

export type Nachricht =
  | { t: 'hallo'; protokoll: number; masterId: string; name: string; nonce: string }
```
Ersetzung 2 (Zeilen 26–27), Vorher:
```ts
  | { t: 'abgelehnt'; grund: Grund; rest?: number; master?: number; suite?: string }
  | { t: 'puls' };
```
Nachher:
```ts
  | { t: 'abgelehnt'; grund: Grund; rest?: number; master?: number; suite?: string }
  | { t: 'puls' }
  | DatenZeile;
```
Ersetzung 3 (Zeilen 75–76), Vorher:
```ts
  ['puls', () => true],
]);
```
Nachher:
```ts
  ['puls', () => true],
  // Teil 2b (Spec 13.2): lockere Prüfer — jedes Objekt gilt, nie 'kaputt'. Den Inhalt prüft der Empfänger.
  ['abo', () => true],
  ['stand', () => true],
  ['aenderung', () => true],
]);
```

- [ ] **Step 6: `show-daten.ts` anlegen**

Neue Datei `packages/master-link/src/show-daten.ts` (Write-Werkzeug):
```ts
// Show-Daten im Verbund (Teil 2b, Spec 13.1–13.3): Inhalt der Nachrichten abo, stand und aenderung — reine Funktionen.
// Der Rahmen nimmt die drei Typen mit lockeren Prüfern an (rahmen.ts); geprüft wird hier, beim Empfänger. Ungültiger
// Inhalt wird verworfen, die Leitung bleibt. `grund` einer fehlgeschlagenen Prüfung ist immer ein Feldname aus der
// Tabelle 13.2 — nie ein Wert aus dem Netz (er geht so ins Log).

/** Fassung der Show-Daten. PROTOKOLL bleibt 1; Fähigkeiten laufen über die Fassung (Spec 13.1). */
export const SHOW_FASSUNG = 1;

/** Warum ein Stand keine Show trägt (Spec 13.1). */
export type DatenGrund = 'keine-show' | 'zu-gross' | 'nicht-lesbar';

export interface AboInhalt {
  art: 'show';
  fassung: number;
}

export interface StandInhalt {
  art: 'show';
  fassung: number;
  epoche: string;
  folge: number;
  /** Erste 16 Hex-Zeichen von SHA-256 über den normalisierten Show-Pfad am Master; null ohne offene Show. */
  schluessel: string | null;
  /** Der Ausschnitt (Spec 14) oder null; das Tool liest ihn mit migrateShow. */
  show: Record<string, unknown> | null;
  /** Genau dann gesetzt, wenn show null ist. */
  grund?: DatenGrund;
  /** appIds der Tools, deren Eintrag am Master ein Dokument trägt (ohne Pfad). */
  mitDokument: string[];
}

export type Pruefung<T> = { ok: true; wert: T } | { ok: false; grund: string };

type Objekt = Record<string, unknown>;
const istObjekt = (v: unknown): v is Objekt => typeof v === 'object' && v !== null && !Array.isArray(v);
const istFassung = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1;
const EPOCHE = /^[A-Za-z0-9-]{1,64}$/;
const SCHLUESSEL = /^[0-9a-f]{16}$/;
const APP_ID = /^[a-z0-9-]{1,64}$/;
const MAX_DOKUMENTE = 64;
const GRUENDE: ReadonlySet<unknown> = new Set<DatenGrund>(['keine-show', 'zu-gross', 'nicht-lesbar']);

/** abo (Spec 13.1/13.2): art genau 'show', fassung ganze Zahl ≥ 1. Kein Objekt → grund 'art'. */
export function pruefeAbo(o: unknown): Pruefung<AboInhalt> {
  if (!istObjekt(o) || o.art !== 'show') return { ok: false, grund: 'art' };
  if (!istFassung(o.fassung)) return { ok: false, grund: 'fassung' };
  return { ok: true, wert: { art: 'show', fassung: o.fassung } };
}

/** stand und aenderung (Spec 13.2): jede Regel der Tabelle, in ihrer Reihenfolge. Kein Objekt → grund 'art'. */
export function pruefeStand(o: unknown): Pruefung<StandInhalt> {
  if (!istObjekt(o) || o.art !== 'show') return { ok: false, grund: 'art' };
  if (!istFassung(o.fassung)) return { ok: false, grund: 'fassung' };
  if (typeof o.epoche !== 'string' || !EPOCHE.test(o.epoche)) return { ok: false, grund: 'epoche' };
  if (typeof o.folge !== 'number' || !Number.isSafeInteger(o.folge) || o.folge < 0) return { ok: false, grund: 'folge' };
  if (o.schluessel !== null && (typeof o.schluessel !== 'string' || !SCHLUESSEL.test(o.schluessel))) {
    return { ok: false, grund: 'schluessel' };
  }
  if (o.show !== null && !istObjekt(o.show)) return { ok: false, grund: 'show' };
  if (o.show === null ? !GRUENDE.has(o.grund) : o.grund !== undefined) return { ok: false, grund: 'grund' };
  const liste = o.mitDokument === undefined ? [] : o.mitDokument;
  if (!Array.isArray(liste) || liste.length > MAX_DOKUMENTE || !liste.every((a) => typeof a === 'string' && APP_ID.test(a))) {
    return { ok: false, grund: 'mitDokument' };
  }
  const wert: StandInhalt = {
    art: 'show',
    fassung: o.fassung,
    epoche: o.epoche,
    folge: o.folge,
    schluessel: o.schluessel,
    show: o.show,
    ...(o.show === null ? { grund: o.grund as DatenGrund } : {}),
    mitDokument: [...(liste as string[])],
  };
  return { ok: true, wert };
}

/** Die Abo-Zeile des Tools, genau eine Zeile mit '\n'. */
export function kodiereAbo(fassung: number = SHOW_FASSUNG): string {
  return `${JSON.stringify({ t: 'abo', art: 'show', fassung })}\n`;
}

/**
 * Eine stand- bzw. aenderung-Zeile in fester Feldreihenfolge, genau eine Zeile mit '\n' (JSON.stringify maskiert
 * Zeilenumbrüche in Texten). Der Master serialisiert so einmal und schreibt dieselbe Zeile an alle Abos (Spec 13.6).
 */
export function kodiereStand(t: 'stand' | 'aenderung', s: StandInhalt): string {
  const zeile = {
    t,
    art: s.art,
    fassung: s.fassung,
    epoche: s.epoche,
    folge: s.folge,
    schluessel: s.schluessel,
    show: s.show,
    ...(s.grund !== undefined ? { grund: s.grund } : {}),
    mitDokument: s.mitDokument,
  };
  return `${JSON.stringify(zeile)}\n`;
}

/** UTF-8-Bytes einer fertigen Zeile — dagegen gilt GRENZEN.maxStandZeile (Spec 13.4), nicht gegen Zeichen. */
export function zeilenBytes(zeile: string): number {
  return Buffer.byteLength(zeile, 'utf8');
}

/** Spec 13.1: die höchste eigene Fassung, die nicht über der erbetenen liegt. */
export function antwortFassung(erbeten: number): number {
  return Math.min(erbeten, SHOW_FASSUNG);
}
```

- [ ] **Step 7: Öffentliche API** (`packages/master-link/src/index.ts`, Zeilen 5–6)

Vorher:
```ts
export * from './rahmen';
export * from './verbindung';
```
Nachher:
```ts
export * from './rahmen';
export * from './show-daten';
export * from './verbindung';
```

- [ ] **Step 8: `sende` mit Rückgabe, `sendeZeile`** (`packages/master-link/src/verbindung.ts`, nach C1 Zeilen 74–76)

Vorher:
```ts
  sende(n: Nachricht): void {
    if (!this.beendet && !this.schliessend && !this.socket.destroyed) this.socket.write(kodiere(n));
  }
```
Nachher:
```ts
  /**
   * Teil 2b (Spec 13.6): true, wenn die Zeile in den Schreibpuffer ging; false, wenn nichts hinausging (geschlossen,
   * schließend oder zerstört). Ein Puffer über der Hochwassermarke ist kein false — Rückdruck misst der Server selbst
   * über socket.writableLength (MasterLinkServer.sendeDaten).
   */
  sende(n: Nachricht): boolean {
    return this.schreibe(kodiere(n));
  }

  /** Teil 2b (Spec 13.6): eine fertige Zeile (kodiereStand) — genau ein '\n', am Ende; sonst wirft sie (Programmfehler). */
  sendeZeile(zeile: string): boolean {
    if (zeile.indexOf('\n') !== zeile.length - 1) throw new Error('sendeZeile: genau eine Zeile mit \\n am Ende erwartet');
    return this.schreibe(zeile);
  }

  private schreibe(zeile: string): boolean {
    if (this.beendet || this.schliessend || this.socket.destroyed) return false;
    this.socket.write(zeile);
    return true;
  }
```

- [ ] **Step 9: Typfehler im Koppel-Test beheben** (`packages/master-link/test/koppeln.test.ts`, Zeile 179)

Ohne diese Ersetzung meldet der Typecheck (gemessen): `test/koppeln.test.ts(179,32): error TS2322: Type 'boolean' is not assignable to type 'void'.` Der Test selbst ändert sich nicht.

Vorher:
```ts
      const leer = (): void => v.sende({ t: 'hallo', protokoll: 1, masterId: 'falsch', name: 'X', nonce: '' });
```
Nachher:
```ts
      const leer = (): void => {
        v.sende({ t: 'hallo', protokoll: 1, masterId: 'falsch', name: 'X', nonce: '' });
      };
```

- [ ] **Step 10: Tests laufen lassen (grün)**

```
npm run selftest -w @jm/master-link
```
Erwartet: keine `FAIL`-Zeile, letzte Zeile `670 ok, 0 fehlgeschlagen.` (591 + 16 im Rahmen-Test + 63 in `show-daten.test.ts`), Exitcode 0, Laufzeit gemessen 31–33 s. Darunter unter anderem:
```
── Rahmen: Show-Daten mit lockeren Prüfern (Teil 2b, Spec 13.2)
  ok  abo: kodiere → dekodiere hin und zurück
  ok  {"t":"stand","folge":"x"} → nachricht, nie kaputt (lockerer Prüfer)
  ok  PROTOKOLL bleibt 1 (Fähigkeiten laufen über fassung)
…
── Show-Daten: pruefeAbo (Teil 2b, Spec 13.2)
  ok  pruefeAbo: fassung '1' → ungültig (fassung)
── Show-Daten: pruefeStand, jede Regel der Tabelle 13.2
  ok  pruefeStand: mitDokument fehlt → []
  ok  pruefeStand: folge MAX_SAFE_INTEGER + 1 → ungültig (folge)
  ok  pruefeStand: show null ohne grund → ungültig (grund)
  ok  pruefeStand: Array statt Objekt → ungültig (art)
── Show-Daten: kodieren (Teil 2b, Spec 13.1)
  ok  kodiereStand(stand) → dekodiere → pruefeStand ok, Inhalt gleich
  ok  zeilenBytes einer Abo-Zeile samt \n
…
── Verbindung: Show-Daten, sende mit Rückgabe, sendeZeile (Teil 2b, Spec 13.2, 13.6)
  ok  stand mit falschem Feld → Ereignis nachricht (den Inhalt prüft der Empfänger)
  ok  … die Leitung bleibt
  ok  sende: offene Verbindung → true
  ok  sendeZeile: offene Verbindung → true
  ok  sendeZeile: die fertige Zeile kommt unverändert an
  ok  sendeZeile ohne \n am Ende → wirft
  ok  sendeZeile mit \n mitten in der Zeile → wirft
  ok  nach schliesse(): sende und sendeZeile → false
```
Die drei Show-Daten-Abschnitte zählen 11, 41 und 11 `ok`.

- [ ] **Step 11: Typecheck und Zeilenenden**

```
npm run typecheck -w @jm/master-link
node -e "for (const f of process.argv.slice(1)) { const t = require('fs').readFileSync(f, 'utf8'); console.log(f, (t.match(/\n/g) || []).length, (t.match(/\r\n/g) || []).length); }" packages/master-link/src/rahmen.ts packages/master-link/src/verbindung.ts packages/master-link/src/index.ts packages/master-link/test/selftest.ts packages/master-link/test/rahmen.test.ts packages/master-link/test/koppeln.test.ts packages/master-link/src/show-daten.ts packages/master-link/test/show-daten.test.ts
```
Erwartet: `tsc` ohne Meldung, Exitcode 0; dann:
```
packages/master-link/src/rahmen.ts 211 211
packages/master-link/src/verbindung.ts 112 112
packages/master-link/src/index.ts 15 15
packages/master-link/test/selftest.ts 20 20
packages/master-link/test/rahmen.test.ts 359 359
packages/master-link/test/koppeln.test.ts 297 297
packages/master-link/src/show-daten.ts 110 0
packages/master-link/test/show-daten.test.ts 108 0
```

- [ ] **Step 12: Commit**

```
git add packages/master-link/src/index.ts packages/master-link/src/rahmen.ts packages/master-link/src/show-daten.ts packages/master-link/src/verbindung.ts packages/master-link/test/koppeln.test.ts packages/master-link/test/rahmen.test.ts packages/master-link/test/selftest.ts packages/master-link/test/show-daten.test.ts
git status --short
```
Erwartet genau:
```
M  packages/master-link/src/index.ts
M  packages/master-link/src/rahmen.ts
A  packages/master-link/src/show-daten.ts
M  packages/master-link/src/verbindung.ts
M  packages/master-link/test/koppeln.test.ts
M  packages/master-link/test/rahmen.test.ts
M  packages/master-link/test/selftest.ts
A  packages/master-link/test/show-daten.test.ts
```
Dann:
```
git commit -m "feat(master-link): Show-Daten abo/stand/aenderung mit lockeren Pruefern, show-daten.ts (Teil 2b R2)" -m "abo, stand und aenderung stehen in Nachricht (DatenZeile) und in der Prueferliste mit Pruefern, die jedes Objekt annehmen: ein falsches Feld kappt nie die Leitung (Spec 13.2). show-daten.ts prueft den Inhalt beim Empfaenger (pruefeAbo, pruefeStand; Grund ist immer ein Feldname) und kodiert Zeilen in fester Reihenfolge (kodiereAbo, kodiereStand), dazu zeilenBytes und antwortFassung. Verbindung.sende meldet, ob die Zeile hinausging; sendeZeile schreibt eine fertige Zeile (Spec 13.6). PROTOKOLL bleibt 1." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- **`Verbindung.sende` (Rückgabe):** Das Register sagt „sonst Rückgabe von `socket.write`“. Umgesetzt ist `true`, sobald die Zeile dem Socket übergeben ist, auch wenn `socket.write` wegen der Hochwassermarke (16 KiB) `false` liefert; `false` nur bei geschlossener, schließender oder zerstörter Verbindung. Grund: Spec 13.6 („ob die Zeile in den Puffer ging“) und 13.7 Client („`false`, wenn nichts hinausging“). Mit der Rückgabe von `write` hieße `false` auch „gepuffert, aber über 16 KiB“ — die Tool-Seite (C12) hielte dann ein hinausgegangenes `abo` für verloren. Rückdruck misst der Server über `writableLength` (C3, E5). Signatur unverändert.
- **`sendeZeile`** wirft auch bei einem `\n` mitten in der Zeile (Register: „wirft ohne '\n' am Ende“). Eine solche Zeile zerfiele beim Empfänger in zwei, die erste wäre `kaputt` und kappte die Leitung. `kodiereStand` erzeugt nie ein inneres `\n` (geprüft).
- **Prüfgrund für Nicht-Objekte** ist `art`, damit `grund` immer ein Feldname aus Tabelle 13.2 bleibt (G6). Aus `dekodiere` kommt ohnehin nur ein Objekt.
- **`koppeln.test.ts:179`:** eine Typ-Korrektur im Test (Pfeilfunktion mit Block), weil `sende` jetzt `boolean` liefert. G1 sperrt nur `src/koppeln.ts`.
- `show-daten.ts` importiert nichts aus `rahmen.ts`; die Prüfer nehmen `unknown`.
- Zwei rote Läufe statt einem: Ein fehlendes Modul bricht den ganzen Lauf beim Laden ab, deshalb erst die Rahmen-Tests (Step 2, aussagekräftige `FAIL`-Zeilen), dann die neue Testdatei (Step 4).

---

### Task 3: C3 · Server mit Sitzungs-Kennung, Ereignissen `daten`/`getrennt`/`entstaut` und `sendeDaten` mit Rückdruck

**Spec:** 13.5 („Koppeln braucht keine Reparatur“; Zeile 5 „Ein Teil-1-Client … bekommt keine 2b-Zeile“), 13.6 (Sitzungs-Kennung, `sendeDaten`, Stau, `entstaut`), 13.7 „Server“, 19.1 (Server, Ersetzung, Rückdruck, Teil-1-Client), 22 (`appId` meldet der Teilnehmer selbst). Gliederung: E2, E3, E4, E5, E13 (Server-Logtext), G4, G6, Vormerkung 3.

**Arbeitsverzeichnis/Voraussetzung:** wie C1; C2 ist committet, `npm run selftest -w @jm/master-link` endet mit `670 ok, 0 fehlgeschlagen.`

**Dateien:**
- Modify: `packages/master-link/src/server.ts` (durch C1/C2 nicht verschoben): Zeilen 9–22 (Importe, Kopfkommentar, `TeilnehmerStand`), 60–65 (Ende von `Sitzung`), 72 (`istLoopback`), 96–97 (Felder), 207–210 (Sitzung anlegen), 230–239 (`aufNachricht`, angemeldet), 398–403 (`meldeAn`, Ersetzen), 424–427 (`sitzungEnde`), 500 (`teilnehmer()`), 536–538 (`stoppe`), 545–548 (`warne`, davor neue Methoden)
- Test: `packages/master-link/test/server.test.ts` Zeilen 1–9 (Importe), 12–14 (nach dem Rohclient-Import), 426–429 (Dateiende)
- Unverändert: `test/aufbau.ts`, `test/rohclient.ts` (reichen aus), `src/koppeln.ts` (G1)

**Interfaces:**
- Consumes: C1 (`GRENZEN.stauBytes`), C2 (`DatenZeile`, `pruefeAbo`, `AboInhalt`, `Verbindung.sendeZeile`; im Test `kodiereStand`, `zeilenBytes`).
- Produces (Register S-A, exakt so):
  ```ts
  // packages/master-link/src/server.ts
  export interface TeilnehmerDaten { sitzung: number; schluessel: string; rechnerId: string; art: 'tool' | 'launcher'; appId: string; dieserRechner: boolean }
  export type SendeErgebnis = 'gesendet' | 'gestaut' | 'weg';
  export interface TeilnehmerStand extends TeilnehmerInfo { rechnerId: string; adresse: string; seit: number; letzteZeile: number; sitzung: number }
  class MasterLinkServer {
    // Ereignisse (neu):
    //  'daten'    (t: TeilnehmerDaten, abo: AboInhalt) — nur ein gültiges abo einer angemeldeten Sitzung (auch art 'launcher')
    //  'getrennt' (sitzung: number) — genau einmal je angemeldeter Sitzung: beim Ersetzen sofort in meldeAn (vor 'angemeldet'
    //             an die neue), sonst beim Ende, in stoppe() synchron vor dem Leeren der Teilnehmerliste
    //  'entstaut' (sitzung: number) — nach 'gestaut' einmal beim nächsten drain, nie nach 'getrennt'
    // 'aenderung' (Teilnehmerliste) und 'warnung' (Text) bleiben unverändert.
    sendeDaten(sitzung: number, zeile: string): SendeErgebnis;   // 'weg' auch, wenn der Server nicht läuft
  }
  ```
  Sitzungs-Kennungen beginnen je Server-Instanz bei 1 und werden nie wiederverwendet (auch nicht über `stoppe()`/`starte()`). `dieserRechner` stammt aus dem Verbund-Eintrag der `rechnerId`. Ein werfender Zuhörer von `daten`/`getrennt`/`entstaut` trifft weder den Socket-Handler noch `meldeAn`/`stoppe()`; er ergibt eine Logzeile je Ereignis und Fehlercode.

**Regeln für diese Aufgabe:** wie C1. Dazu G4 (der Master wertet `stand`/`aenderung` von Clients nicht aus), G6 (Logzeilen: Rechnername und `appId` sind über `kuerzeName` gesäubert, der Grund ist ein Feldname), E13 (Text „Master-Link: ungültiges Abo von ⟨Rechnername⟩/⟨appId⟩ (⟨Feld⟩), ignoriert.“ wörtlich, Owner-Freigabe vor dem Release).

---

- [ ] **Step 1: Fehlschlagende Tests schreiben** (`packages/master-link/test/server.test.ts`)

Ersetzung 1 (Zeilen 1–9), Vorher:
```ts
import { existsSync, readFileSync } from 'node:fs';
import { connect as netConnect, createServer as netServer, type Socket } from 'node:net';
import type { NetworkInterfaceInfo } from 'node:os';
import { join } from 'node:path';
import { erzeugeSchluesselpaar, signiereAnmeldung } from '../src/beweis';
import { GRENZEN } from '../src/fristen';
import { PROTOKOLL } from '../src/rahmen';
import { MasterLinkServer } from '../src/server';
import { DateiVerbund, SpeicherVerbund, type VerbundEintrag } from '../src/speicher';
```
Nachher:
```ts
import { existsSync, readFileSync } from 'node:fs';
import { connect as netConnect, createServer as netServer, type Socket } from 'node:net';
import type { NetworkInterfaceInfo } from 'node:os';
import { join } from 'node:path';
import type { TLSSocket } from 'node:tls';
import { erzeugeSchluesselpaar, signiereAnmeldung } from '../src/beweis';
import { GRENZEN } from '../src/fristen';
import { koppele } from '../src/koppeln';
import { PROTOKOLL, type DatenZeile, type Nachricht } from '../src/rahmen';
import { MasterLinkServer, type SendeErgebnis, type TeilnehmerDaten } from '../src/server';
import { kodiereStand, zeilenBytes, type AboInhalt } from '../src/show-daten';
import { DateiVerbund, SpeicherVerbund, type VerbundEintrag } from '../src/speicher';
```

Ersetzung 2 (Zeilen 12–14), Vorher:
```ts
import { verbindeRoh, type RohClient } from './rohclient';

export async function laufe(): Promise<void> {
```
Nachher:
```ts
import { verbindeRoh, type RohClient } from './rohclient';

/** Eine fertige stand-/aenderung-Zeile; `fuell` Zeichen Nutzlast machen sie groß (Rückdruck). */
function zeile(t: 'stand' | 'aenderung', folge: number, fuell = 0): string {
  return kodiereStand(t, {
    art: 'show', fassung: 1, epoche: 'e-1', folge, schluessel: null,
    show: fuell > 0 ? { x: 'y'.repeat(fuell) } : null, ...(fuell > 0 ? {} : { grund: 'keine-show' as const }), mitDokument: [],
  });
}

/** Sitzungen des Servers von innen (nur für Tests): Kennung und Socket. */
type InnenSitzung = { sitzung: number; v: { socket: TLSSocket; emit(n: string, x?: unknown): boolean } };
const innen = (s: MasterLinkServer): InnenSitzung[] => [...(s as unknown as { sitzungen: Set<InnenSitzung> }).sitzungen];

export async function laufe(): Promise<void> {
```

Ersetzung 3 (Zeilen 426–429, Dateiende), Vorher:
```ts
    gleich((a.server as unknown as { lauschAdressen: string[] }).lauschAdressen, ['127.0.0.6', '127.0.0.1'], 'erneuter Aufruf bindet die Karten-IP nach');
    await a.server.stoppe();
  }
}
```
Nachher:
```ts
    gleich((a.server as unknown as { lauschAdressen: string[] }).lauschAdressen, ['127.0.0.6', '127.0.0.1'], 'erneuter Aufruf bindet die Karten-IP nach');
    await a.server.stoppe();
  }

  abschnitt('Server: Show-Daten — Sitzung, daten, getrennt (Teil 2b, Spec 13.6, 13.7)');
  {
    const warnungen: string[] = [];
    const a = await baueServer();
    a.server.on('warnung', (t: string) => warnungen.push(t));
    const daten: Array<[TeilnehmerDaten, AboInhalt]> = [];
    const getrennt: number[] = [];
    a.server.on('daten', (t: TeilnehmerDaten, abo: AboInhalt) => daten.push([t, abo]));
    a.server.on('getrennt', (s: number) => getrennt.push(s));
    const c = await meldeAn(a);
    await c.naechste('angemeldet');
    const eigen = await meldeAn(a, a.eigen, 'jm-titler');
    await eigen.naechste('angemeldet');
    gleich(a.server.teilnehmer().map((t) => [t.appId, t.sitzung]), [['jm-timer', 1], ['jm-titler', 2]],
      'zwei Sitzungen → verschiedene Kennungen (Zähler je Server), teilnehmer() trägt sitzung');
    c.v.sende({ t: 'abo', art: 'show', fassung: 1 });
    await bis(() => daten.length === 1);
    gleich(daten[0], [
      { sitzung: 1, schluessel: 'rechner-b\u0000jm-timer', rechnerId: 'rechner-b', art: 'tool', appId: 'jm-timer', dieserRechner: false },
      { art: 'show', fassung: 1 },
    ], 'abo einer angemeldeten Sitzung → daten mit sitzung, schluessel, rechnerId, art, appId, dieserRechner');
    eigen.v.sende({ t: 'abo', art: 'show', fassung: 2 });
    await bis(() => daten.length === 2);
    gleich(daten[1]?.[0].dieserRechner, true, 'abo vom Master-Rechner selbst → dieserRechner true');
    gleich(daten[1]?.[1], { art: 'show', fassung: 2 }, '… die erbetene Fassung reist mit (die Antwortfassung wählt der Verteiler)');
    c.v.sende({ t: 'abo', art: 'film', fassung: 1 });
    c.v.sende({ t: 'abo', art: 'film', fassung: 1 });
    c.v.sende({ t: 'abo', art: 'show', fassung: 0 });
    await bis(() => warnungen.filter((w) => w.includes('ungültiges Abo')).length === 2, 1000);
    await warte(100);
    gleich(warnungen.filter((w) => w.includes('ungültiges Abo')), [
      'Master-Link: ungültiges Abo von Regie-Laptop 2/jm-timer (art), ignoriert.',
      'Master-Link: ungültiges Abo von Regie-Laptop 2/jm-timer (fassung), ignoriert.',
    ], 'ungültiges abo → eine Warnung je Sitzung und Feld (E13); dasselbe noch einmal → keine zweite');
    gleich(daten.length, 2, '… kein daten für ein ungültiges abo');
    pruefe(!c.beendet(), '… die Leitung bleibt');
    c.v.sende({ t: 'stand', art: 'show', fassung: 1 });
    c.v.sende({ t: 'aenderung', folge: 'x' });
    await warte(200);
    pruefe(daten.length === 2 && !c.beendet(), 'stand/aenderung von einem Client → ignoriert, die Leitung bleibt (G4)');
    c.zu();
    await bis(() => getrennt.length === 1);
    await warte(300);
    gleich(getrennt, [1], 'Sitzung zu → getrennt(sitzung) genau einmal');
    gleich(a.server.sendeDaten(1, zeile('aenderung', 1)), 'weg', 'sendeDaten an eine beendete Sitzung → weg');
    gleich(a.server.sendeDaten(99, zeile('aenderung', 1)), 'weg', 'sendeDaten an eine unbekannte Sitzung → weg');
    eigen.zu();
    await a.server.stoppe();
  }
  {
    const a = await baueServer();
    let daten = 0;
    a.server.on('daten', () => daten++);
    const r = await verbindeRoh(a.port);
    r.v.sende({ t: 'abo', art: 'show', fassung: 1 });
    await bis(() => r.beendet(), 1000);
    pruefe(r.beendet() && daten === 0, 'abo als erste Nachricht vor anmelden → Verbindung zu, kein daten (E3)');
    await a.server.stoppe();
  }
  {
    const zeilen: string[] = [];
    const a = await baueServer({ log: (_s, t) => zeilen.push(t) });
    a.server.on('daten', () => {
      throw Object.assign(new Error('Testwurf'), { code: 'TESTWURF' });
    });
    const c = await meldeAn(a);
    await c.naechste('angemeldet');
    c.v.sende({ t: 'abo', art: 'show', fassung: 1 });
    c.v.sende({ t: 'abo', art: 'show', fassung: 1 });
    await bis(() => zeilen.some((z) => z.includes('TESTWURF')), 1000);
    await warte(100);
    gleich(zeilen.filter((z) => z.includes('warf')), ['Master-Link: Zuhörer von „daten“ warf (TESTWURF).'],
      'werfender daten-Zuhörer: eine Logzeile, auch beim zweiten Wurf');
    pruefe(!c.beendet(), '… die Leitung bleibt (der Wurf trifft den Socket-Handler nicht)');
    c.zu();
    await a.server.stoppe();
  }

  abschnitt('Server: Ersetzung, die neue Sitzung schickt ihr abo, bevor die alte zu ist (Teil 2b, Spec 13.6, 19.1)');
  {
    const a = await baueServer();
    // Nachgebauter Verteiler: Abos nach sitzung, Antwort stand, verteile() schickt eine aenderung an alle Abos.
    const abos = new Set<number>();
    const getrennt: number[] = [];
    let teilnehmerBeiGetrennt = -1;
    a.server.on('daten', (t: TeilnehmerDaten) => {
      abos.add(t.sitzung);
      a.server.sendeDaten(t.sitzung, zeile('stand', 0));
    });
    a.server.on('getrennt', (s: number) => {
      getrennt.push(s);
      abos.delete(s);
      teilnehmerBeiGetrennt = a.server.teilnehmer().length;
    });
    const verteile = (folge: number): SendeErgebnis[] => [...abos].map((s) => a.server.sendeDaten(s, zeile('aenderung', folge)));
    const alt = await meldeAn(a, a.slave, 'jm-timer', 7);
    await alt.naechste('angemeldet');
    alt.v.sende({ t: 'abo', art: 'show', fassung: 1 });
    pruefe((await alt.naechste('stand')) !== null, 'alte Sitzung: abo → stand');
    const altSitzung = a.server.teilnehmer()[0]!.sitzung;
    alt.socket.pause(); // liest nicht mehr: ihr Ende kommt erst mit dem 200-ms-Zwangsabbruch von schliesse()
    const neu = await meldeAn(a, a.slave, 'jm-timer', 7); // gleiche pid und Adresse → ersetzt
    await neu.naechste('angemeldet');
    gleich(getrennt, [altSitzung], 'Ersetzung: getrennt nur für die alte Sitzung, sofort in meldeAn');
    gleich(teilnehmerBeiGetrennt, 0, '… noch bevor die neue Sitzung eingetragen und angemeldet ist');
    const neuSitzung = a.server.teilnehmer()[0]!.sitzung;
    pruefe(neuSitzung !== altSitzung, `… die neue Sitzung hat eine eigene Kennung (${altSitzung} → ${neuSitzung})`);
    gleich(verteile(1), [], 'vor ihrem abo: kein Abo mehr, nichts verteilt');
    await warte(100);
    gleich(neu.nachrichten.filter((n) => n.t === 'stand' || n.t === 'aenderung'), [], '… die neue Sitzung bekam vor ihrem abo nichts');
    neu.v.sende({ t: 'abo', art: 'show', fassung: 1 });
    pruefe((await neu.naechste('stand')) !== null, 'neue Sitzung: ihr abo → stand');
    gleich(innen(a.server).length, 2, '… während die alte Sitzung am Server noch offen ist (bis zu 200 ms)');
    await warte(400); // länger als der 200-ms-Zwangsabbruch der alten Sitzung
    gleich(innen(a.server).length, 1, 'die alte Sitzung ist inzwischen zu');
    gleich(getrennt, [altSitzung], '… ihr spätes Ende meldet kein zweites getrennt');
    gleich(verteile(2), ['gesendet'], 'das Abo der neuen Sitzung bleibt');
    const n2 = await neu.naechste('aenderung');
    gleich(n2 && (n2 as DatenZeile).folge, 2, 'die nächste aenderung kommt bei der neuen Sitzung an');
    gleich(a.server.sendeDaten(altSitzung, zeile('aenderung', 3)), 'weg', 'sendeDaten an die ersetzte Sitzung → weg');
    alt.zu();
    neu.zu();
    await a.server.stoppe();
  }

  abschnitt('Server: stoppe() meldet getrennt je angemeldeter Sitzung genau einmal (Teil 2b, E4)');
  {
    const a = await baueServer();
    const getrennt: number[] = [];
    let daten = 0;
    a.server.on('getrennt', (s: number) => getrennt.push(s));
    a.server.on('daten', () => daten++);
    const c1 = await meldeAn(a);
    await c1.naechste('angemeldet');
    const c2 = await meldeAn(a, a.eigen, 'jm-titler');
    await c2.naechste('angemeldet');
    const roh = await verbindeRoh(a.port); // nicht angemeldet: keine Sitzungskennung, kein getrennt
    const sitzungen = innen(a.server);
    const gestoppt = a.server.stoppe();
    gleich([...getrennt].sort(), [1, 2], 'stoppe(): getrennt je angemeldeter Sitzung, synchron im Aufruf');
    await gestoppt;
    await warte(300);
    gleich(getrennt.length, 2, '… genau einmal (das spätere ende der Sockets meldet nichts mehr)');
    for (const s of sitzungen) s.v.emit('nachricht', { t: 'abo', art: 'show', fassung: 1 });
    await warte(20);
    gleich(daten, 0, 'nach stoppe(): eine späte abo-Zeile ergibt kein daten');
    roh.zu();
  }

  abschnitt('Server: Rückdruck — sendeDaten staut über 1 MiB, entstaut beim nächsten drain (Teil 2b, Spec 13.6)');
  {
    const a = await baueServer({}, { stilleMs: 60_000 }); // der pausierte Client schickt keinen Puls
    const entstaut: number[] = [];
    const getrennt: number[] = [];
    a.server.on('entstaut', (s: number) => entstaut.push(s));
    a.server.on('getrennt', (s: number) => getrennt.push(s));
    const c = await meldeAn(a);
    await c.naechste('angemeldet');
    const sitzung = a.server.teilnehmer()[0]!.sitzung;
    const serverSocket = innen(a.server).find((s) => s.sitzung === sitzung)!.v.socket;
    const gross = zeile('aenderung', 1, 64 * 1024 - 200);
    c.socket.pause();
    let gesendet = 0;
    let ergebnis: SendeErgebnis = 'gesendet';
    // Begrenzt: 64-KiB-Zeilen, Abbruch nach 64 MiB. Zwischen zwei Zeilen läuft die Ereignisschleife (echte Socket-Puffer).
    while (ergebnis === 'gesendet' && gesendet < 64 * 1024 * 1024) {
      ergebnis = a.server.sendeDaten(sitzung, gross);
      if (ergebnis === 'gesendet') gesendet += zeilenBytes(gross);
      await new Promise<void>((r) => setImmediate(r));
    }
    const beimStau = serverSocket.writableLength;
    gleich(ergebnis, 'gestaut', `Client liest nicht → gestaut (nach ${Math.round(gesendet / 1024)} KiB, writableLength beim Stau ${beimStau} Byte)`);
    pruefe(beimStau > GRENZEN.stauBytes && beimStau <= GRENZEN.stauBytes + zeilenBytes(gross),
      `… erst über 1 MiB im Schreibpuffer, höchstens eine Zeile darüber (gemessen: ${beimStau} Byte, Zeile ${zeilenBytes(gross)} Byte)`);
    gleich([a.server.sendeDaten(sitzung, gross), serverSocket.writableLength], ['gestaut', beimStau], 'weiteres sendeDaten → gestaut, ohne zu schreiben');
    c.socket.resume();
    await bis(() => entstaut.length > 0, 10_000);
    await warte(300);
    gleich(entstaut, [sitzung], 'Client liest wieder → genau ein entstaut(sitzung)');
    gleich(a.server.sendeDaten(sitzung, zeile('aenderung', 2)), 'gesendet', 'nach entstaut schreibt sendeDaten wieder');
    // Stau, dann Sitzungsende: ein spätes drain meldet kein entstaut mehr.
    c.socket.pause();
    ergebnis = 'gesendet';
    for (let n = 0; ergebnis === 'gesendet' && n < 1024; n++) {
      ergebnis = a.server.sendeDaten(sitzung, gross);
      await new Promise<void>((r) => setImmediate(r));
    }
    gleich(ergebnis, 'gestaut', 'zweiter Stau');
    c.zu();
    await bis(() => getrennt.length === 1, 2000);
    serverSocket.emit('drain');
    await warte(100);
    gleich(entstaut, [sitzung], 'entstaut nach Sitzungsende kommt nicht (auch nicht bei einem späten drain)');
    await a.server.stoppe();
  }

  abschnitt('Server: Teil-1-Client ohne abo bleibt angemeldet und bekommt keine 2b-Zeile (Teil 2b, Spec 13.5, 19.1)');
  {
    const a = await baueServer({}, { pulsMs: 100 });
    a.server.on('daten', (t: TeilnehmerDaten) => a.server.sendeDaten(t.sitzung, zeile('stand', 0)));
    const mitAbo = await meldeAn(a, a.slave, 'jm-timer');
    const teil1 = await meldeAn(a, a.slave, 'jm-titler'); // schickt nie ein abo
    await mitAbo.naechste('angemeldet');
    await teil1.naechste('angemeldet');
    mitAbo.v.sende({ t: 'abo', art: 'show', fassung: 1 });
    pruefe((await mitAbo.naechste('stand')) !== null, 'die Sitzung mit abo bekommt stand');
    await warte(500);
    pruefe(teil1.nachrichten.some((n) => n.t === 'puls'), 'Teil-1-Client bekommt den Puls');
    gleich(teil1.nachrichten.filter((n) => n.t !== 'puls'), [], '… sonst nichts (keine 2b-Zeile)');
    pruefe(!teil1.beendet() && a.server.teilnehmer().some((t) => t.appId === 'jm-titler'), '… und bleibt angemeldet');
    mitAbo.zu();
    teil1.zu();
    await a.server.stoppe();
  }

  abschnitt('Server: nach gekoppelt sendet der Master bis teilnehmer nichts (Spec 13.5 „Koppeln braucht keine Reparatur“)');
  {
    const a = await baueServer({}, { pulsMs: 100 });
    const { code } = a.server.oeffneKopplung();
    const r = await koppele({ adresse: '127.0.0.1', port: a.port, code: code!, rechner: { id: 'rechner-c', name: 'Neuer PC' } });
    pruefe(r.ok, 'gekoppelt');
    if (r.ok) {
      const zeilen: string[] = [];
      r.verbindung.on('nachricht', (n: Nachricht) => zeilen.push(n.t));
      r.verbindung.on('unbekannt', (t: string) => zeilen.push(t));
      await warte(1000);
      gleich(zeilen, [], 'nach gekoppelt: 1 s lang keine Zeile vom Master, auch kein Puls (removeAllListeners in koppeln.ts verliert nichts)');
      r.verbindung.sende({ t: 'teilnehmer', teilnehmer: { art: 'launcher', appId: 'jm-launcher', name: 'JM Production Suite', version: '0.15.0', pid: 3 } });
      await bis(() => zeilen.includes('puls'), 1000);
      gleich(zeilen[0], 'angemeldet', 'Gegenprobe: nach teilnehmer kommt zuerst angemeldet …');
      pruefe(zeilen.includes('puls'), '… und danach der Puls (100 ms)');
      r.verbindung.schliesse();
    }
    await a.server.stoppe();
  }
}
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/master-link
```
Erwartet (gemessen): Exitcode 1; nach 547 `ok`-Zeilen diese `FAIL`-Zeilen und der Abbruch:
```
FAIL  zwei Sitzungen → verschiedene Kennungen (Zähler je Server), teilnehmer() trägt sitzung (ist [["jm-timer",null],["jm-titler",null]], soll [["jm-timer",1],["jm-titler",2]])
FAIL  abo einer angemeldeten Sitzung → daten mit sitzung, schluessel, rechnerId, art, appId, dieserRechner (ist undefined, soll …)
FAIL  abo vom Master-Rechner selbst → dieserRechner true (ist undefined, soll true)
FAIL  … die erbetene Fassung reist mit (die Antwortfassung wählt der Verteiler) (ist undefined, soll {"art":"show","fassung":2})
FAIL  ungültiges abo → eine Warnung je Sitzung und Feld (E13); dasselbe noch einmal → keine zweite (ist [], soll […])
FAIL  … kein daten für ein ungültiges abo (ist 0, soll 2)
FAIL  stand/aenderung von einem Client → ignoriert, die Leitung bleibt (G4)
FAIL  Sitzung zu → getrennt(sitzung) genau einmal (ist [], soll [1])
TypeError: a.server.sendeDaten is not a function
    at laufe (…\packages\master-link\test\server.test.ts:489:21)
```
(Die Zeile `ok  … die Leitung bleibt` steht zwischen den `FAIL`-Zeilen; sie gilt schon heute.)

- [ ] **Step 3: Typen, Importe, Kopfkommentar** (`packages/master-link/src/server.ts`, Zeilen 9–22)

Vorher:
```ts
import { fristen as mitFristen, GRENZEN, kuerzeName, MASTER_PORT, type Fristen } from './fristen';
import { PROTOKOLL, type Grund, type Nachricht, type TeilnehmerInfo } from './rahmen';
import type { Identitaet, VerbundSpeicher } from './speicher';
import { Verbindung } from './verbindung';

// Master-Link-Server (Spec 3, 5, 6). Jeder Teilnehmer (Tool/Slave-Launcher) hat eine eigene
// Verbindung; Schlüssel am Master ist rechnerId + appId, die neuere Verbindung gewinnt.

export interface TeilnehmerStand extends TeilnehmerInfo {
  rechnerId: string;
  adresse: string;
  seit: number;
  letzteZeile: number;
}
```
Nachher:
```ts
import { fristen as mitFristen, GRENZEN, kuerzeName, MASTER_PORT, type Fristen } from './fristen';
import { PROTOKOLL, type DatenZeile, type Grund, type Nachricht, type TeilnehmerInfo } from './rahmen';
import { pruefeAbo } from './show-daten';
import type { Identitaet, VerbundSpeicher } from './speicher';
import { Verbindung } from './verbindung';

// Master-Link-Server (Spec 3, 5, 6). Jeder Teilnehmer (Tool/Slave-Launcher) hat eine eigene
// Verbindung; Schlüssel am Master ist rechnerId + appId, die neuere Verbindung gewinnt.
// Teil 2b (Spec 13.6, 13.7): Show-Daten hängen an der Sitzungs-Kennung `sitzung`, nicht am Schlüssel. Ereignisse:
//  - 'daten' (t: TeilnehmerDaten, abo: AboInhalt) — ein gültiges abo einer angemeldeten Sitzung
//  - 'getrennt' (sitzung: number)  — genau einmal je angemeldeter Sitzung (Ersetzen, Ende oder stoppe())
//  - 'entstaut' (sitzung: number)  — nach 'gestaut' beim nächsten drain
//  - 'aenderung' (ohne Nutzlast)    — Teilnehmerliste/Kopplung geändert (Teil 1, hat mit der Nachricht nichts zu tun)

export interface TeilnehmerStand extends TeilnehmerInfo {
  rechnerId: string;
  adresse: string;
  seit: number;
  letzteZeile: number;
  /** Teil 2b: Sitzungs-Kennung (Zähler je Server, ab 1). */
  sitzung: number;
}

/** Teil 2b (Spec 13.7): wer ein Abo schickt. `appId` meldet der Teilnehmer selbst (gekürzt, Spec 22). */
export interface TeilnehmerDaten {
  sitzung: number;
  schluessel: string;
  rechnerId: string;
  art: 'tool' | 'launcher';
  appId: string;
  dieserRechner: boolean;
}

/** Teil 2b (Spec 13.6): Ergebnis von sendeDaten. */
export type SendeErgebnis = 'gesendet' | 'gestaut' | 'weg';
```

- [ ] **Step 4: Sitzung, Hilfsfunktion, Felder** (`packages/master-link/src/server.ts`)

Ersetzung 1 (Zeilen 60–65), Vorher:
```ts
  seit: number;
  letzteZeile: number;
  stille: ReturnType<typeof setTimeout> | null;
}

interface RohEintrag {
```
Nachher:
```ts
  seit: number;
  letzteZeile: number;
  stille: ReturnType<typeof setTimeout> | null;
  /** Teil 2b: 0 bis zur Anmeldung, dann die Kennung. */
  sitzung: number;
  /** 'getrennt' ist für diese Sitzung schon gemeldet (genau einmal). */
  getrenntGemeldet: boolean;
  /** sendeDaten schreibt nicht, bis 'drain' kommt. */
  gestaut: boolean;
  /** Felder, zu denen schon eine Warnung „ungültiges Abo“ geschrieben wurde. */
  aboWarnungen: Set<string>;
}

interface RohEintrag {
```
Ersetzung 2 (Zeile 72), Vorher:
```ts
const istLoopback = (ip: string): boolean => ip.startsWith('127.') || ip === '::1';
```
Nachher:
```ts
const istLoopback = (ip: string): boolean => ip.startsWith('127.') || ip === '::1';

/** Code einer Ausnahme fürs Log: err.code, sonst der Fehlertyp — nie die Meldung (wie wurfCode in client.ts). */
function wurfCode(e: unknown): string {
  const o = (typeof e === 'object' && e !== null ? e : {}) as { code?: unknown; name?: unknown };
  const roh = typeof o.code === 'string' && o.code ? o.code : typeof o.name === 'string' && o.name ? o.name : 'UNBEKANNT';
  return roh.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 40) || 'UNBEKANNT';
}
```
Ersetzung 3 (Zeilen 96–97), Vorher:
```ts
  private pulsZeitgeber: ReturnType<typeof setInterval> | null = null;
  private fenster: { code: string; erzeugt: number; fehlversuche: number; verbraucht: boolean } | null = null;
```
Nachher:
```ts
  private pulsZeitgeber: ReturnType<typeof setInterval> | null = null;
  private fenster: { code: string; erzeugt: number; fehlversuche: number; verbraucht: boolean } | null = null;
  /** Teil 2b: letzte vergebene Sitzungs-Kennung (nie zurückgesetzt, auch nicht über stoppe()/starte()). */
  private sitzungsZaehler = 0;
  /** Teil 2b: angemeldete Sitzungen nach Kennung, bis 'getrennt' gemeldet ist. */
  private readonly nachKennung = new Map<number, Sitzung>();
  /** Zuletzt geloggter Wurf eines Zuhörers — je Ereignis und Code eine Zeile. */
  private wurfGeloggt: string | null = null;
```
Ersetzung 4 (Zeilen 207–210), Vorher:
```ts
      seit: this.jetzt(),
      letzteZeile: this.jetzt(),
      stille: null,
    };
```
Nachher:
```ts
      seit: this.jetzt(),
      letzteZeile: this.jetzt(),
      stille: null,
      sitzung: 0,
      getrenntGemeldet: false,
      gestaut: false,
      aboWarnungen: new Set<string>(),
    };
```

- [ ] **Step 5: `abo` nach der Anmeldung** (`packages/master-link/src/server.ts`, Zeilen 230–239)

Vorher:
```ts
    if (s.angemeldet) {
      if (n.t === 'teilnehmer' && s.info) {
        const info = normiereTeilnehmer(n.teilnehmer);
        if (info.appId === s.info.appId) {
          s.info = info;
          this.emit('aenderung');
        }
      }
      return;
    }
```
Nachher:
```ts
    if (s.angemeldet) {
      if (n.t === 'teilnehmer' && s.info) {
        const info = normiereTeilnehmer(n.teilnehmer);
        if (info.appId === s.info.appId) {
          s.info = info;
          this.emit('aenderung');
        }
      } else if (n.t === 'abo') {
        this.aufAbo(s, n);
      }
      // stand/aenderung von einem Client wertet der Master nicht aus (Spec 22, G4).
      return;
    }
```
Ein `abo` als erste Nachricht vor der Anmeldung läuft weiter in den Zweig „erste Nachricht weder anmelden noch koppeln → `schliesse()`“ (Zeile 251, E3); dafür ist keine Änderung nötig.

- [ ] **Step 6: Kennung vergeben, `getrennt` beim Ersetzen, Ende, `teilnehmer()`, `stoppe()`** (`packages/master-link/src/server.ts`)

Ersetzung 1 (Zeilen 398–403), Vorher:
```ts
      this.teilnehmerMap.delete(schluessel);
      alt.v.sende({ t: 'abgelehnt', grund: 'ersetzt' });
      alt.v.schliesse();
    }
    s.angemeldet = true;
    s.rechnerId = rechnerId;
```
Nachher:
```ts
      this.teilnehmerMap.delete(schluessel);
      alt.v.sende({ t: 'abgelehnt', grund: 'ersetzt' });
      alt.v.schliesse();
      // Teil 2b (Spec 13.6/13.7): sofort, noch vor 'angemeldet' an die neue Sitzung. Das Ende der alten (bis zu 200 ms
      // später) meldet nichts mehr — so trifft es nie das Abo der neuen.
      this.meldeGetrennt(alt);
    }
    s.angemeldet = true;
    s.sitzung = ++this.sitzungsZaehler;
    this.nachKennung.set(s.sitzung, s);
    s.rechnerId = rechnerId;
```
Ersetzung 2 (Zeilen 424–427), Vorher:
```ts
  private sitzungEnde(s: Sitzung): void {
    if (s.stille) clearTimeout(s.stille);
    this.sitzungen.delete(s);
    if (s.schluessel && this.teilnehmerMap.get(s.schluessel) === s) {
```
Nachher:
```ts
  private sitzungEnde(s: Sitzung): void {
    if (s.stille) clearTimeout(s.stille);
    this.sitzungen.delete(s);
    this.meldeGetrennt(s);
    if (s.schluessel && this.teilnehmerMap.get(s.schluessel) === s) {
```
Ersetzung 3 (Zeile 500), Vorher:
```ts
      aus.push({ ...s.info, rechnerId: s.rechnerId, adresse: s.v.adresse, seit: s.seit, letzteZeile: s.letzteZeile });
```
Nachher:
```ts
      aus.push({ ...s.info, rechnerId: s.rechnerId, adresse: s.v.adresse, seit: s.seit, letzteZeile: s.letzteZeile, sitzung: s.sitzung });
```
Ersetzung 4 (Zeilen 536–538), Vorher:
```ts
    const getrennt = [...this.teilnehmerMap.values()];
    getrennt.forEach((s, i) => this.merkeGesehen(s, i === getrennt.length - 1));
    this.teilnehmerMap.clear();
```
Nachher:
```ts
    const getrennt = [...this.teilnehmerMap.values()];
    getrennt.forEach((s, i) => this.merkeGesehen(s, i === getrennt.length - 1));
    // Teil 2b (E4): 'getrennt' synchron je angemeldeter Sitzung; das spätere 'ende' der Sockets meldet nichts mehr.
    for (const s of this.sitzungen) this.meldeGetrennt(s);
    this.teilnehmerMap.clear();
```

- [ ] **Step 7: `sendeDaten`, `aufDrain`, `aufAbo`, `meldeGetrennt`, `sendeEreignis`** (`packages/master-link/src/server.ts`, Zeilen 545–548)

Vorher:
```ts
  private warne(text: string): void {
    this.log('warn', text);
    this.emit('warnung', text);
  }
```
Nachher:
```ts
  /**
   * Teil 2b (Spec 13.6): eine fertige Zeile (kodiereStand) an eine angemeldete Sitzung. 'weg': unbekannt, ersetzt,
   * beendet oder Server gestoppt. Liegen schon mehr als GRENZEN.stauBytes im Schreibpuffer (socket.writableLength),
   * schreibt er nicht und liefert 'gestaut' — bis zum nächsten 'drain', dann kommt einmal 'entstaut(sitzung)' (E5).
   */
  sendeDaten(sitzung: number, zeile: string): SendeErgebnis {
    const s = this.nachKennung.get(sitzung);
    if (!this.laeuft || !s || s.getrenntGemeldet || !s.v.offen) return 'weg';
    if (s.gestaut) return 'gestaut';
    if (s.v.socket.writableLength > GRENZEN.stauBytes) {
      s.gestaut = true;
      s.v.socket.once('drain', () => this.aufDrain(s));
      return 'gestaut';
    }
    return s.v.sendeZeile(zeile) ? 'gesendet' : 'weg';
  }

  private aufDrain(s: Sitzung): void {
    if (!s.gestaut) return;
    s.gestaut = false;
    if (!this.laeuft || s.getrenntGemeldet || !s.v.offen) return;
    this.sendeEreignis('entstaut', s.sitzung);
  }

  /** Teil 2b (Spec 13.7, E2): nur ein gültiges abo wird gemeldet; ein ungültiges warnt einmal je Sitzung und Feld (E13). */
  private aufAbo(s: Sitzung, n: DatenZeile): void {
    if (!s.rechnerId || !s.info || !s.schluessel || s.getrenntGemeldet) return;
    const p = pruefeAbo(n);
    const eintrag = this.o.verbund.finde(s.rechnerId);
    if (!p.ok) {
      if (s.aboWarnungen.has(p.grund)) return;
      s.aboWarnungen.add(p.grund);
      this.warne(`Master-Link: ungültiges Abo von ${kuerzeName(eintrag?.name ?? s.rechnerId)}/${s.info.appId} (${p.grund}), ignoriert.`);
      return;
    }
    const t: TeilnehmerDaten = {
      sitzung: s.sitzung,
      schluessel: s.schluessel,
      rechnerId: s.rechnerId,
      art: s.info.art,
      appId: s.info.appId,
      dieserRechner: eintrag?.dieserRechner === true,
    };
    this.sendeEreignis('daten', t, p.wert);
  }

  /** Teil 2b (Spec 13.7): genau einmal je angemeldeter Sitzung — beim Ersetzen, beim Ende oder in stoppe(). */
  private meldeGetrennt(s: Sitzung): void {
    if (s.sitzung === 0 || s.getrenntGemeldet) return;
    s.getrenntGemeldet = true;
    this.nachKennung.delete(s.sitzung);
    this.sendeEreignis('getrennt', s.sitzung);
  }

  /** Ein werfender Zuhörer (Verteiler) darf weder den Socket-Handler noch meldeAn/stoppe() treffen. */
  private sendeEreignis(name: 'daten' | 'getrennt' | 'entstaut', ...werte: unknown[]): void {
    try {
      this.emit(name, ...werte);
    } catch (e) {
      const schluessel = `${name}/${wurfCode(e)}`;
      if (schluessel === this.wurfGeloggt) return;
      this.wurfGeloggt = schluessel;
      this.log('warn', `Master-Link: Zuhörer von „${name}“ warf (${wurfCode(e)}).`);
    }
  }

  private warne(text: string): void {
    this.log('warn', text);
    this.emit('warnung', text);
  }
```

- [ ] **Step 8: Tests laufen lassen (grün)**

```
npm run selftest -w @jm/master-link
```
Erwartet: keine `FAIL`-Zeile (die Zeile `ok  CERT_SIGNATURE_FAILURE → zertifikat` ist keine), letzte Zeile `715 ok, 0 fehlgeschlagen.` (670 + 45), Exitcode 0. Laufzeit gemessen 34–46 s ohne Fremdlast. Die neuen Abschnitte:
```
── Server: Show-Daten — Sitzung, daten, getrennt (Teil 2b, Spec 13.6, 13.7)          14 ok
── Server: Ersetzung, die neue Sitzung schickt ihr abo, bevor die alte zu ist (…)    13 ok
── Server: stoppe() meldet getrennt je angemeldeter Sitzung genau einmal (Teil 2b, E4) 3 ok
── Server: Rückdruck — sendeDaten staut über 1 MiB, entstaut beim nächsten drain (…)  7 ok
── Server: Teil-1-Client ohne abo bleibt angemeldet und bekommt keine 2b-Zeile (…)    4 ok
── Server: nach gekoppelt sendet der Master bis teilnehmer nichts (…)                  4 ok
```
Rückdruck, gemessen in drei Läufen hintereinander gleich (Windows 11, Node 24.16.0):
```
  ok  Client liest nicht → gestaut (nach 1342 KiB, writableLength beim Stau 1112735 Byte)
  ok  … erst über 1 MiB im Schreibpuffer, höchstens eine Zeile darüber (gemessen: 1112735 Byte, Zeile 65455 Byte)
  ok  weiteres sendeDaten → gestaut, ohne zu schreiben
  ok  Client liest wieder → genau ein entstaut(sitzung)
  ok  nach entstaut schreibt sendeDaten wieder
  ok  zweiter Stau
  ok  entstaut nach Sitzungsende kommt nicht (auch nicht bei einem späten drain)
```
Damit ist Ist-Karte Transport 12 beantwortet: `writableLength` bildet die 1-MiB-Schwelle bei TLS ab (21 Zeilen à 65 455 Byte gingen hinaus; rund 256 KiB davon nahmen die Socket-Puffer des Betriebssystems auf, der Rest lag im Schreibpuffer), und `drain` kommt nach dem Weiterlesen verlässlich, genau einmal.

- [ ] **Step 9: Gegenprobe — `getrennt` beim Ersetzen** (`packages/master-link/src/server.ts`, vorübergehend)

Die in Step 6 eingefügte Zeile `      this.meldeGetrennt(alt);` (nur sie, nicht der Kommentar darüber) vorübergehend löschen und laufen lassen:
```
npm run selftest -w @jm/master-link
```
Erwartet (gemessen), Exitcode 1:
```
FAIL  Ersetzung: getrennt nur für die alte Sitzung, sofort in meldeAn (ist [], soll [1])
FAIL  … noch bevor die neue Sitzung eingetragen und angemeldet ist (ist -1, soll 0)
FAIL  vor ihrem abo: kein Abo mehr, nichts verteilt (ist ["weg"], soll [])
712 ok, 3 fehlgeschlagen.
```
Dann die Zeile wieder einfügen (wortgleich wie in Step 6, Ersetzung 1) und Step 8 wiederholen: `715 ok, 0 fehlgeschlagen.`

- [ ] **Step 10: Typecheck, Verbraucher, Zeilenenden**

```
npm run typecheck -w @jm/master-link
npm run typecheck -w @jm/launcher
npm run selftest:verbund -w @jm/launcher
node -e "for (const f of process.argv.slice(1)) { const t = require('fs').readFileSync(f, 'utf8'); console.log(f, (t.match(/\n/g) || []).length, (t.match(/\r\n/g) || []).length); }" packages/master-link/src/server.ts packages/master-link/test/server.test.ts
```
Erwartet: beide Typechecks ohne Fehler, Exitcode 0 (der Launcher nutzt `teilnehmer()` in `verbund/master.ts:507`; `sitzung` kommt nur dazu). `selftest:verbund` endet mit `188 ok, 0 fehlgeschlagen.` (gemessen 13–16 s; der Launcher-Test fährt den echten Server und Client). Dann:
```
packages/master-link/src/server.ts 676 676
packages/master-link/test/server.test.ts 680 680
```

- [ ] **Step 11: Commit**

```
git add packages/master-link/src/server.ts packages/master-link/test/server.test.ts
git status --short
```
Erwartet genau:
```
M  packages/master-link/src/server.ts
M  packages/master-link/test/server.test.ts
```
Dann:
```
git commit -m "feat(master-link): Server mit Sitzungs-Kennung, daten, getrennt und sendeDaten mit Rueckdruck (Teil 2b R2)" -m "Jede angemeldete Sitzung bekommt eine Kennung (Zaehler je Server); teilnehmer() traegt sie. Ein gueltiges abo meldet daten mit Sitzung und Herkunft, ein ungueltiges warnt einmal je Sitzung und Feld. getrennt kommt genau einmal je Sitzung: beim Ersetzen sofort in meldeAn, sonst beim Ende oder synchron in stoppe(). sendeDaten schreibt nicht mehr, sobald mehr als 1 MiB im Schreibpuffer liegen (gestaut), und meldet beim naechsten drain einmal entstaut (Spec 13.6, 13.7). Werfende Zuhoerer treffen den Socket nicht. Regressionstest: nach gekoppelt sendet der Master bis teilnehmer nichts; koppeln.ts bleibt unveraendert." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Keine an den Schnittstellen.
- **Ergänzung, nicht im Register:** Die drei neuen Ereignisse gehen über `sendeEreignis` mit Wurf-Schutz. Ein werfender Verteiler-Zuhörer brächte sonst über den Socket-Handler den Launcher-Hauptprozess zum Absturz. Logzeile „Master-Link: Zuhörer von „⟨Ereignis⟩“ warf (⟨Code⟩).“ — wortgleich mit dem Client aus Teil 1, einmal je Ereignis und Code. Bitte in die E13-Liste zur Owner-Freigabe aufnehmen (kein neuer Wortlaut, aber ein neuer Ort).
- `wurfCode` steht als modulinterne Kopie in `server.ts` (5 Zeilen). Der Server soll `client.ts` nicht importieren, und eine Verschiebung nach `fehler.ts` hätte `client.ts` in dieser Aufgabe mit angefasst.
- „Zähler je Serverlauf“ (Spec 13.6) ist als Zähler je Server-Instanz umgesetzt, der auch über `stoppe()`/`starte()` nicht zurückgesetzt wird. So wird eine Kennung nie wiederverwendet. `MasterRolle` baut ohnehin je Start einen neuen Server (Ist-Karte Master 4).
- In `sitzungEnde` kommt `getrennt` vor `aenderung`. Der Verteiler hat das Abo also schon gelöscht, wenn das Modal neu meldet.
- Die E13-Warnung geht über `warne` (Log `warn` und Ereignis `warnung`, wie „doppelt aktiv“). Rechnername aus dem Verbund-Eintrag, gekürzt mit `kuerzeName`; fehlt der Eintrag, die `rechnerId`.
- `daten` kommt auch für `art: 'launcher'`; das Ignorieren mit Logzeile ist Sache des Verteilers (Spec 15.2, C8).
- Zusätzliche Tests über die Gliederung hinaus: werfender `daten`-Zuhörer; `abo` vom Master-Rechner (`dieserRechner: true`, Fassung 2 reist mit); obere Schranke des Staus (höchstens eine Zeile über 1 MiB, E5); spätes `drain` nach dem Ende (künstlich ausgelöst, sonst prüfte der Fall nichts).
- Der Test liest die private Sitzungsliste über `innen()`, wie der bestehende A7-Test (`server.test.ts:372`).

---

### Task 4: C4 · Client mit `sende`, Ereignis `daten` (auch nachgeholt) und `kopplung()`; `eigeneAdressen` und `istDieserRechner`

**Spec:** 13.5 Zeile 3 („Übergabe nach `angemeldet`“) samt Test, 13.5 Zeile 1 Test-Teil „Vor der Anmeldung eine Zeile mit 4 KiB + 1 Byte → Trennung wie bisher“, 13.7 „Client“ und „Adressen“, 15.3 (Begriff „eigener Rechner“), 17.4 (Nutzer `waehleLauncher`), 19.1 (Client, `istDieserRechner`). Gliederung: E6 (weicht ab von Spec 13.7, dort schon so vermerkt), E7, E27, Vormerkung 2.

**Arbeitsverzeichnis/Voraussetzung:** wie C1; C3 ist committet, `npm run selftest -w @jm/master-link` endet mit `715 ok, 0 fehlgeschlagen.`

**Dateien:**
- Modify: `packages/master-link/src/client.ts` (durch C1–C3 nicht verschoben): Zeile 7 (Import aus `./datei`), Zeile 42 (`Versuch`, danach `KopplungInfo`), Zeilen 298–302 (`zustand()`, danach `sende`/`kopplung`), Zeilen 575–578 (`aufNachricht` in `betreibe`)
- Modify: `packages/master-link/src/adresswahl.ts` Zeilen 125–135 (`kandidatenliste`, danach die neuen Funktionen)
- Test: `packages/master-link/test/client.test.ts` Zeilen 15–17 (Importe), 676–677 (Ende von `laufe`), 906–909 (Dateiende)
- Test: `packages/master-link/test/adresswahl.test.ts` Zeilen 3–5 (Import), 77–79 (Dateiende)

**Interfaces:**
- Consumes: C1 (Grenze je Zeile), C2 (`DatenZeile`, `Nachricht`, `Verbindung.sende(): boolean`; im Test `kodiereAbo`, `kodiereStand`), C3 (im Test: Ereignis `daten` des Servers, `TeilnehmerDaten`).
- Produces (Register S-A, exakt so):
  ```ts
  // packages/master-link/src/client.ts
  export interface KopplungInfo { rolle: Rolle; masterId: string | null; masterName: string | null; letzteAdresse: string | null; adressen: string[] }
  class MasterLinkClient {
    sende(n: Nachricht): boolean;     // nur im Zustand verbunden mit offener Verbindung, sonst false
    kopplung(): KopplungInfo | null;  // null: master-link.json fehlt oder ist beschädigt (Zustand fehler:datei)
    // Ereignis (neu): 'daten' (n: DatenZeile) für t 'stand' und 'aenderung', auch für nachgeholte; immer nach 'angemeldet'.
    // Der Inhalt ist UNGEPRÜFT — der Empfänger (app-runtime, C12) ruft pruefeStand.
  }
  // packages/master-link/src/adresswahl.ts
  export function eigeneAdressen(ni: NetzwerkInterfaces): string[];   // alle Adressen aller Karten, inkl. intern, ohne Zone
  export function istDieserRechner(host: string, eigeneAdressen: readonly string[], eigenerName?: string): boolean;  // E7
  ```
  `Rolle` ist der bestehende Typ aus `datei.ts` (`'aus' | 'master' | 'slave'`). `kopplung()` im Einzelnen: Rolle `aus` → `masterId`, `masterName`, `letzteAdresse` `null`, `adressen` `[]` (auch wenn die Datei noch eine Kopplung trägt); sonst `masterId`/`masterName` aus `kopplung` der Datei, `letzteAdresse` = Adresse der letzten Verbindung dieses Prozesses, sonst `kopplung.letzteAdresse` der Datei (E6), `adressen` = Kopie der Adressen aus dem letzten `angemeldet` (leer bis zur ersten Anmeldung; eine verbindungsrelevante Dateiänderung setzt beides zurück, wie in `neustart`). Jeder Aufruf liefert ein neues Objekt.

**Regeln für diese Aufgabe:** wie C1.

---

- [ ] **Step 1: Fehlschlagende Client-Tests** (`packages/master-link/test/client.test.ts`)

Ersetzung 1 (Zeilen 15–17), Vorher:
```ts
import { kodiere, type Nachricht } from '../src/rahmen';
import { MasterLinkServer } from '../src/server';
import { Verbindung } from '../src/verbindung';
```
Nachher:
```ts
import { kodiere, type DatenZeile, type Nachricht } from '../src/rahmen';
import { MasterLinkServer, type TeilnehmerDaten } from '../src/server';
import { kodiereAbo, kodiereStand } from '../src/show-daten';
import { Verbindung } from '../src/verbindung';
```

Ersetzung 2 (Zeilen 676–677), Vorher:
```ts
  await laufeEndpruefung();
}
```
Nachher:
```ts
  await laufeEndpruefung();
  await laufeShowDaten();
}
```

Ersetzung 3 (Zeilen 906–909, Dateiende), Vorher:
```ts
    pruefe(zeilen.length > 0 && zeilen.every((t) => !/[\p{Cc}\p{Cf}]/u.test(t)), 'Logzeilen einzeilig, ohne Steuer-/Formatzeichen');
    await c.stoppe();
  }
}
```
Nachher:
```ts
    pruefe(zeilen.length > 0 && zeilen.every((t) => !/[\p{Cc}\p{Cf}]/u.test(t)), 'Logzeilen einzeilig, ohne Steuer-/Formatzeichen');
    await c.stoppe();
  }
}

/** Kleine stand-/aenderung-Zeile ohne Show (passt mit 'angemeldet' in ein TLS-Stück). */
const kleineZeile = (t: 'stand' | 'aenderung', folge: number): string =>
  kodiereStand(t, { art: 'show', fassung: 1, epoche: 'e-1', folge, schluessel: null, show: null, grund: 'keine-show', mitDokument: [] });

/** Die Master-Attrappe beantwortet den Puls des Clients — sonst trennt dessen Stille-Frist (600 ms) mitten im Test. */
const antwortePuls = (v: Verbindung): void => {
  v.on('nachricht', (n: Nachricht) => {
    if (n.t === 'puls') v.sende({ t: 'puls' });
  });
};

/** Teil 2b (Spec 13.5, 13.7): Show-Daten am Client — Ereignis daten (auch nachgeholt), sende, kopplung(). */
export async function laufeShowDaten(): Promise<void> {
  abschnitt('Client: angemeldet und Show-Daten im selben Stück (Teil 2b, Spec 13.5)');
  {
    // 900-KiB-aenderung im selben Schreibvorgang wie angemeldet: die Grenze gilt je Zeile, nichts wird gekappt.
    const a = await baueServer();
    const gross = kodiereStand('aenderung', {
      art: 'show', fassung: 1, epoche: 'e-1', folge: 5, schluessel: null, show: { x: 'y'.repeat(900 * 1024) }, mitDokument: [],
    });
    const { srv, zaehler } = await attrappe(a, (ts, v) => {
      antwortePuls(v);
      ts.write(kodiere({ t: 'angemeldet', adressen: [], suite: '0.15.0' }) + gross);
    });
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const c = neuerClient(pfad);
    const daten: DatenZeile[] = [];
    c.on('daten', (n: DatenZeile) => daten.push(n));
    c.starte();
    await bis(() => daten.length === 1, 3000);
    pruefe(daten.length === 1 && daten[0]!.folge === 5 && (daten[0]!.show as { x: string }).x.length === 900 * 1024,
      'angemeldet und 900-KiB-aenderung im selben Schreibvorgang → daten kommt vollständig an');
    pruefe(art(c) === 'verbunden' && zaehler.n === 1, `… Zustand verbunden, keine Trennung (${zaehler.n} Verbindung)`);
    await c.stoppe();
    srv.close();
  }
  {
    // Kleine aenderung im selben Stück wie angemeldet: halteFest hält sie fest, betreibe gibt sie als daten aus.
    const a = await baueServer();
    const { srv } = await attrappe(a, (ts, v) => {
      antwortePuls(v);
      ts.write(kodiere({ t: 'angemeldet', adressen: [], suite: '0.15.0' }) + kleineZeile('aenderung', 3));
    });
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const c = neuerClient(pfad);
    const reihenfolge: string[] = [];
    c.on('angemeldet', () => reihenfolge.push('angemeldet'));
    c.on('daten', (n: DatenZeile) => reihenfolge.push(`daten:${n.t}:${String(n.folge)}`));
    c.starte();
    await bis(() => reihenfolge.length >= 2, 2000);
    gleich(reihenfolge.slice(0, 2), ['angemeldet', 'daten:aenderung:3'],
      'angemeldet und aenderung in einem Stück → daten kommt an (nachgeholt), nach dem Ereignis angemeldet');
    await c.stoppe();
    srv.close();
  }
  {
    // Dasselbe auf dem Weg nach dem Koppeln (uebernehme → warteAufAngemeldet), ein Chunk aus zwei Zeilen.
    const a = await baueServer();
    await a.server.stoppe();
    const pfad = masterLinkPfad(tempOrdner());
    const d = dateiFuer(a);
    schreibeMasterLinkDatei(pfad, d);
    const c = neuerClient(pfad);
    const daten: DatenZeile[] = [];
    c.on('daten', (n: DatenZeile) => daten.push(n));
    c.starte();
    await bis(() => art(c) === 'fehler:verweigert', 1000);
    const socket = new StummerSocket();
    c.uebernehme(new Verbindung(socket as unknown as TLSSocket, GRENZEN.vorAnmeldung), d.kopplung!, 'Regie-PC');
    socket.emit('data', Buffer.from(kodiere({ t: 'angemeldet', adressen: [], suite: '0.15.0' }) + kleineZeile('stand', 0)));
    await bis(() => daten.length === 1, 1500);
    gleich(daten.map((n) => n.t), ['stand'], 'übernommene Verbindung: angemeldet + stand in einem Chunk → daten');
    await c.stoppe();
  }

  abschnitt('Client: Zeilengrenze genau an 4 KiB vor der Anmeldung (Teil 2b, Spec 13.5)');
  {
    const a = await baueServer();
    let laenge = GRENZEN.vorAnmeldung + 1;
    const huelle = '{"t":"gross","x":""}';
    const { srv } = await attrappe(a, (ts, v) => {
      antwortePuls(v);
      ts.write(`{"t":"gross","x":"${'y'.repeat(laenge - huelle.length)}"}\n${kodiere({ t: 'angemeldet', adressen: [], suite: '0.15.0' })}`);
    });
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const c = neuerClient(pfad);
    const gesehen = new Set<string>();
    c.on('zustand', () => gesehen.add(art(c)));
    c.starte();
    await bis(() => art(c) === 'fehler:kein-master', 2000);
    pruefe(art(c) === 'fehler:kein-master' && !gesehen.has('verbunden'), 'Zeile mit 4 KiB + 1 Byte vor angemeldet → Trennung wie bisher (kein-master)');
    await c.stoppe();
    laenge = GRENZEN.vorAnmeldung;
    const c2 = neuerClient(pfad);
    c2.starte();
    await bis(() => art(c2) === 'verbunden', 2000);
    gleich(art(c2), 'verbunden', 'Zeile mit genau 4 KiB vor angemeldet → erlaubt, verbunden');
    await c2.stoppe();
    srv.close();
  }

  abschnitt('Client: Ereignis daten nur für stand und aenderung (Teil 2b, Spec 13.7)');
  {
    const a = await baueServer();
    const { srv } = await attrappe(a, (ts, v) => {
      antwortePuls(v);
      v.sende({ t: 'angemeldet', adressen: [], suite: '0.15.0' });
      setTimeout(() => ts.write(kleineZeile('stand', 0) + kodiereAbo() + '{"t":"zukunft"}\n' + kleineZeile('aenderung', 1)), 100);
    });
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const c = neuerClient(pfad);
    const typen: string[] = [];
    c.on('daten', (n: DatenZeile) => typen.push(n.t));
    c.starte();
    await bis(() => typen.length >= 2, 2000);
    await warte(100);
    gleich(typen, ['stand', 'aenderung'], 'stand und aenderung nach der Anmeldung → daten; abo und unbekannte Typen → kein daten');
    await c.stoppe();
    srv.close();
  }
  {
    const a = await baueServer();
    const { srv } = await attrappe(a, (ts, v) => {
      antwortePuls(v);
      v.sende({ t: 'angemeldet', adressen: [], suite: '0.15.0' });
      setTimeout(() => ts.write(kleineZeile('aenderung', 1) + kleineZeile('aenderung', 2)), 100);
    });
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const zeilen: string[] = [];
    const c = neuerClient(pfad, { log: (_s, t) => zeilen.push(t) });
    let wuerfe = 0;
    c.on('daten', () => {
      wuerfe++;
      throw Object.assign(new Error('Testwurf'), { code: 'TESTWURF' });
    });
    c.starte();
    await bis(() => wuerfe >= 2, 2000);
    await warte(100);
    gleich(zeilen.filter((z) => z.includes('warf')), ['Master-Link: Zuhörer von „daten“ warf (TESTWURF).'],
      'werfender daten-Zuhörer: eine Logzeile für zwei Würfe');
    gleich(art(c), 'verbunden', '… Schleife und Socket laufen weiter (verbunden)');
    await c.stoppe();
    srv.close();
  }

  abschnitt('Client: sende nur im Zustand verbunden (Teil 2b, Spec 13.7)');
  {
    const a = await baueServer({}, { pulsMs: 150, stilleMs: 600 });
    const abos: TeilnehmerDaten[] = [];
    a.server.on('daten', (t: TeilnehmerDaten) => abos.push(t));
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const c = neuerClient(pfad);
    gleich(c.sende({ t: 'abo', art: 'show', fassung: 1 }), false, 'sende vor starte() → false');
    c.starte();
    await bis(() => art(c) === 'verbunden');
    gleich(c.sende({ t: 'abo', art: 'show', fassung: 1 }), true, 'sende im Zustand verbunden → true');
    await bis(() => abos.length === 1);
    gleich(abos.map((t) => t.appId), ['jm-timer'], '… die Gegenseite liest die Zeile (der Master meldet daten)');
    await a.server.stoppe();
    await bis(() => art(c) !== 'verbunden');
    gleich(c.sende({ t: 'abo', art: 'show', fassung: 1 }), false, 'nach der Trennung → false');
    await c.stoppe();
  }

  abschnitt('Client: kopplung() (Teil 2b, Spec 13.7, E6)');
  {
    const ohne = neuerClient(masterLinkPfad(tempOrdner()));
    ohne.starte();
    await bis(() => art(ohne) === 'aus');
    gleich(ohne.kopplung(), null, 'ohne master-link.json → null');
    await ohne.stoppe();
    const a = await baueServer();
    await a.server.stoppe();
    const pfad = masterLinkPfad(tempOrdner());
    const d = dateiFuer(a);
    schreibeMasterLinkDatei(pfad, { ...d, rolle: 'aus' });
    const aus = neuerClient(pfad);
    aus.starte();
    await bis(() => aus.kopplung() !== null, 1000);
    gleich(aus.kopplung(), { rolle: 'aus', masterId: null, masterName: null, letzteAdresse: null, adressen: [] },
      'Rolle aus → rolle aus, ohne Master');
    await aus.stoppe();
    const mitAdresse = { ...d, kopplung: { ...d.kopplung!, letzteAdresse: '10.9.9.9', masterName: 'Regie-PC (Saal 2)' } };
    schreibeMasterLinkDatei(pfad, mitAdresse);
    const nie = neuerClient(pfad, { anmelden: async (): Promise<Versuch> => ({ ok: false, ergebnis: { art: 'tcp-timeout' } }) });
    nie.starte();
    await bis(() => nie.kopplung() !== null, 1000);
    gleich(nie.kopplung(), {
      rolle: 'slave', masterId: a.identitaet.masterId, masterName: 'Regie-PC (Saal 2)', letzteAdresse: '10.9.9.9', adressen: [],
    }, 'Slave, noch nie angemeldet → Master und letzteAdresse aus der Datei, keine Adressen');
    writeFileSync(pfad, 'Müll');
    await bis(() => art(nie) === 'fehler:datei', 1000);
    gleich(nie.kopplung(), null, 'Datei beschädigt (fehler:datei) → null');
    schreibeMasterLinkDatei(pfad, mitAdresse);
    await bis(() => nie.kopplung() !== null, 1000);
    gleich(nie.kopplung()?.masterId, a.identitaet.masterId, 'Datei repariert → wieder die Kopplung');
    await nie.stoppe();
  }
  {
    const a = await baueServer();
    const { srv } = await attrappe(a, (_ts, v) => {
      antwortePuls(v);
      v.sende({ t: 'angemeldet', adressen: ['10.0.0.7', '192.168.1.7'], suite: '0.15.0' });
    });
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const c = neuerClient(pfad);
    c.starte();
    await bis(() => art(c) === 'verbunden');
    gleich(c.kopplung(), {
      rolle: 'slave', masterId: a.identitaet.masterId, masterName: 'Regie-PC', letzteAdresse: '127.0.0.1', adressen: ['10.0.0.7', '192.168.1.7'],
    }, 'nach angemeldet → adressen aus angemeldet, letzteAdresse = Adresse dieser Verbindung (E6)');
    c.kopplung()!.adressen.push('10.6.6.6');
    gleich(c.kopplung()!.adressen.length, 2, 'kopplung() liefert eine Kopie (der Aufrufer ändert den Client nicht)');
    await c.stoppe();
    srv.close();
  }
}
```
Die Hilfen `attrappe`, `dateiFuer`, `neuerClient`, `art`, `StummerSocket`, `KURZ` stehen schon in der Datei (Zeilen 22–84); `writeFileSync`, `TLSSocket`, `GRENZEN`, `Versuch` sind schon importiert.

- [ ] **Step 2: Test laufen lassen (rot, Teil 1)**

```
npm run selftest -w @jm/master-link
```
Erwartet (gemessen): Exitcode 1; nach 719 `ok`-Zeilen diese `FAIL`-Zeilen und der Abbruch:
```
FAIL  angemeldet und 900-KiB-aenderung im selben Schreibvorgang → daten kommt vollständig an
FAIL  angemeldet und aenderung in einem Stück → daten kommt an (nachgeholt), nach dem Ereignis angemeldet (ist ["angemeldet"], soll ["angemeldet","daten:aenderung:3"])
FAIL  übernommene Verbindung: angemeldet + stand in einem Chunk → daten (ist [], soll ["stand"])
FAIL  stand und aenderung nach der Anmeldung → daten; abo und unbekannte Typen → kein daten (ist [], soll ["stand","aenderung"])
FAIL  werfender daten-Zuhörer: eine Logzeile für zwei Würfe (ist [], soll ["Master-Link: Zuhörer von „daten“ warf (TESTWURF)."])
TypeError: c.sende is not a function
    at laufeShowDaten (…\packages\master-link\test\client.test.ts:1071:14)
```
Schon grün (Regressionstests, durch C1 erfüllt): `… Zustand verbunden, keine Trennung (1 Verbindung)`, beide Zeilen „Zeilengrenze genau an 4 KiB …“, `… Schleife und Socket laufen weiter (verbunden)`.

- [ ] **Step 3: Fehlschlagende Adress-Tests** (`packages/master-link/test/adresswahl.test.ts`)

Ersetzung 1 (Zeilen 3–5), Vorher:
```ts
import {
  imSubnetz, istVirtuell, kandidatenliste, listeKarten, ordneKandidaten, wirksameKarten, type NetzwerkInterfaces,
} from '../src/adresswahl';
```
Nachher:
```ts
import {
  eigeneAdressen, imSubnetz, istDieserRechner, istVirtuell, kandidatenliste, listeKarten, ordneKandidaten, wirksameKarten,
  type NetzwerkInterfaces,
} from '../src/adresswahl';
```

Ersetzung 2 (Zeilen 77–79, Dateiende), Vorher:
```ts
  gleich(kandidatenliste({ ...quelle, mdns: [], letzteAdresse: null, adressen: ['127.0.0.1'], festeAdresse: null }), ['127.0.0.1'],
    'Adresse aus der Datei darf Loopback sein (Tests, Selbstkopplung)');
}
```
Nachher:
```ts
  gleich(kandidatenliste({ ...quelle, mdns: [], letzteAdresse: null, adressen: ['127.0.0.1'], festeAdresse: null }), ['127.0.0.1'],
    'Adresse aus der Datei darf Loopback sein (Tests, Selbstkopplung)');

  abschnitt('Adresswahl: eigene Adressen und istDieserRechner (Teil 2b, Spec 13.7, E7)');
  const eigene = eigeneAdressen(regie);
  gleich(eigene, ['10.0.0.110', 'fe80::1', '172.20.64.1', '100.64.0.5', '169.254.10.20', '127.0.0.1', 'fe80::2'],
    'eigeneAdressen: alle Karten, auch interne und IPv6, in Fund-Reihenfolge');
  gleich(eigeneAdressen({ 'WLAN': [{ ...v6('fe80::ab'), address: 'FE80::AB%12' }], 'X': [v4('10.0.0.110', '10.0.0.110/24')] }),
    ['fe80::ab', '10.0.0.110'], 'eigeneAdressen: ohne Zone, IPv6 klein geschrieben');
  const fall = (host: string, soll: boolean, was: string, eigenerName?: string): void =>
    gleich(istDieserRechner(host, eigene, eigenerName), soll, `istDieserRechner(${JSON.stringify(host)}): ${was} → ${soll}`);
  fall('127.0.0.1', true, 'Loopback');
  fall('127.5.5.5', true, 'ganz 127.0.0.0/8');
  fall('::1', true, 'IPv6-Loopback');
  fall('[::1]', true, 'IPv6-Loopback in Klammern');
  fall('::ffff:127.0.0.1', true, 'IPv4-gemapptes Loopback');
  fall('localhost', true, 'localhost');
  fall('10.0.0.110', true, 'eigene IPv4');
  fall('::ffff:10.0.0.110', true, 'eigene IPv4, IPv4-gemappt');
  fall('fe80::1%12', true, 'eigene IPv6 mit Zone');
  fall('FE80::1', true, 'eigene IPv6 groß geschrieben');
  fall('10.0.0.111', false, 'fremde Adresse im eigenen Netz');
  fall('192.168.1.5', false, 'fremde Adresse');
  fall('Regie-PC', true, 'eigener Hostname', 'regie-pc');
  fall('REGIE-PC.local', true, 'eigener Hostname groß und mit .local', 'Regie-PC');
  fall('regie-pc.local.', true, 'eigener Hostname mit .local und Schlusspunkt', 'Regie-PC');
  fall('Regie-Laptop-2.local', false, 'fremder Hostname', 'Regie-PC');
  fall('Regie-PC', false, 'Hostname ohne bekannten eigenen Namen');
  fall('127.0.0.1.example.com', false, 'Hostname, der mit 127. beginnt', 'Regie-PC');
  fall('', false, 'leerer String', 'Regie-PC');
}
```

- [ ] **Step 4: Test laufen lassen (rot, Teil 2)**

```
npm run selftest -w @jm/master-link
```
Erwartet (gemessen): sofortiger Abbruch beim Laden, Exitcode 1:
```
SyntaxError: The requested module '../src/adresswahl' does not provide an export named 'eigeneAdressen'
```

- [ ] **Step 5: `KopplungInfo`, `sende`, `kopplung()`, Ereignis `daten`** (`packages/master-link/src/client.ts`)

Ersetzung 1 (Zeile 7), Vorher:
```ts
import { DateiBeobachter, type Kopplung, type MasterLinkDatei } from './datei';
```
Nachher:
```ts
import { DateiBeobachter, type Kopplung, type MasterLinkDatei, type Rolle } from './datei';
```
Ersetzung 2 (Zeile 42), Vorher:
```ts
export type Versuch = { ok: true; a: Angemeldet } | { ok: false; ergebnis: VersuchsErgebnis };
```
Nachher:
```ts
export type Versuch = { ok: true; a: Angemeldet } | { ok: false; ergebnis: VersuchsErgebnis };

/**
 * Teil 2b (Spec 13.7): die Kopplung, wie der Client sie sieht — für app-runtime (16.2) und waehleLauncher (17.4).
 * Rolle und Master aus master-link.json (Rolle „aus“: ohne Master). `letzteAdresse`: Adresse der letzten Verbindung
 * dieses Prozesses, sonst kopplung.letzteAdresse aus der Datei (E6). `adressen`: aus dem letzten 'angemeldet'.
 */
export interface KopplungInfo {
  rolle: Rolle;
  masterId: string | null;
  masterName: string | null;
  letzteAdresse: string | null;
  adressen: string[];
}
```
Ersetzung 3 (Zeilen 298–302), Vorher:
```ts
  zustand(): ClientZustand {
    return this.z;
  }

  /** Neue Generation: alte Schleifen beenden sich daran, laufende Anmeldeversuche der alten brechen sofort ab (A5). */
```
Nachher:
```ts
  zustand(): ClientZustand {
    return this.z;
  }

  /** Teil 2b (Spec 13.7): nur im Zustand verbunden mit offener Verbindung; false, wenn nichts hinausging. */
  sende(n: Nachricht): boolean {
    const v = this.verbindung;
    if (this.z.art !== 'verbunden' || !v || !v.offen) return false;
    return v.sende(n);
  }

  /** Teil 2b (Spec 13.7, E6): null ohne gelesene master-link.json (fehlt) oder bei beschädigter Datei (fehler:datei). */
  kopplung(): KopplungInfo | null {
    const d = this.datei;
    if (!d || (this.z.art === 'fehler' && this.z.code === 'datei')) return null;
    const k = d.rolle === 'aus' ? null : d.kopplung;
    if (!k) return { rolle: d.rolle, masterId: null, masterName: null, letzteAdresse: null, adressen: [] };
    return {
      rolle: d.rolle,
      masterId: k.masterId,
      masterName: k.masterName,
      letzteAdresse: this.letzteAdresse ?? k.letzteAdresse,
      adressen: [...this.gelernteAdressen],
    };
  }

  /** Neue Generation: alte Schleifen beenden sich daran, laufende Anmeldeversuche der alten brechen sofort ab (A5). */
```
Ersetzung 4 (Zeilen 575–578, in `betreibe`), Vorher:
```ts
      const aufNachricht = (n: Nachricht): void => {
        setzeStille();
        merke(n);
      };
```
Nachher:
```ts
      const aufNachricht = (n: Nachricht): void => {
        setzeStille();
        merke(n);
        // Teil 2b (Spec 13.5, 13.7): stand/aenderung als 'daten' — auch die nachgeholten aus dem Stück von 'angemeldet'.
        if (n.t === 'stand' || n.t === 'aenderung') this.sendeEreignis('daten', n);
      };
```
`betreibe` meldet `angemeldet` (Zeile 550) vor dem Durchspielen von `nachgeholt` (Zeile 582); diese Reihenfolge bleibt und ist die Zusage „immer nach 'angemeldet'“. Ist die Verbindung beim Übernehmen schon zu (Zweig `!a.v.offen`, Zeilen 539–544), wird weiter nur `abgelehnt` ausgewertet; die verlorenen Daten holt das Neuabo (Spec 13.3).

- [ ] **Step 6: `eigeneAdressen` und `istDieserRechner`** (`packages/master-link/src/adresswahl.ts`, Zeilen 125–135)

Vorher:
```ts
/** Spec 4.5: Master-Rechner nur 127.0.0.1; sonst mDNS → zuletzt → Datei → feste Adresse, entdoppelt. */
export function kandidatenliste(q: KandidatenQuelle): string[] {
  if (q.rolle === 'master') return ['127.0.0.1'];
  const alle = [
    ...ordneKandidaten(q.mdns, q.karten, q.gewaehlteKarte),
    ...(q.letzteAdresse ? [q.letzteAdresse] : []),
    ...q.adressen,
    ...(q.festeAdresse ? [q.festeAdresse] : []),
  ];
  return [...new Set(alle)];
}
```
Nachher:
```ts
/** Spec 4.5: Master-Rechner nur 127.0.0.1; sonst mDNS → zuletzt → Datei → feste Adresse, entdoppelt. */
export function kandidatenliste(q: KandidatenQuelle): string[] {
  if (q.rolle === 'master') return ['127.0.0.1'];
  const alle = [
    ...ordneKandidaten(q.mdns, q.karten, q.gewaehlteKarte),
    ...(q.letzteAdresse ? [q.letzteAdresse] : []),
    ...q.adressen,
    ...(q.festeAdresse ? [q.festeAdresse] : []),
  ];
  return [...new Set(alle)];
}

/** Adresse bzw. Name vergleichbar machen: ohne Klammern, ohne IPv6-Zone, ohne „::ffff:“ vor IPv4, klein geschrieben. */
function normiereHost(host: string): string {
  let h = host.trim().toLowerCase();
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  const zone = h.indexOf('%');
  if (zone >= 0) h = h.slice(0, zone);
  if (h.startsWith('::ffff:') && istIPv4Adresse(h.slice(7))) h = h.slice(7);
  return h;
}

/** Hostname ohne Schlusspunkt und ohne „.local“ (mDNS). */
const ohneLocal = (name: string): string => name.replace(/\.$/, '').replace(/\.local$/, '');

/** Teil 2b (Spec 13.7, E7): alle Adressen aller Karten (auch interne und IPv6), ohne Zone, entdoppelt. */
export function eigeneAdressen(ni: NetzwerkInterfaces): string[] {
  const alle = new Set<string>();
  for (const eintraege of Object.values(ni)) {
    for (const i of eintraege ?? []) {
      const a = normiereHost(i.address);
      if (a) alle.add(a);
    }
  }
  return [...alle];
}

/**
 * Teil 2b (Spec 13.7, 15.3, 17.4; E7): liegt `host` auf diesem Rechner? Wahr für 127.0.0.0/8, ::1, localhost und jede
 * Adresse einer eigenen Karte. Ein Hostname gilt nur, wenn er `eigenerName` gleicht (ohne „.local“, Groß/Klein egal);
 * jeder andere Hostname gilt als fremd.
 */
export function istDieserRechner(host: string, eigeneAdressen: readonly string[], eigenerName?: string): boolean {
  const h = normiereHost(host);
  if (!h) return false;
  if (h === 'localhost' || h === '::1' || (istIPv4Adresse(h) && h.startsWith('127.'))) return true;
  if (istIPv4Adresse(h) || h.includes(':')) return eigeneAdressen.some((a) => normiereHost(a) === h);
  return eigenerName !== undefined && eigenerName.trim() !== '' && ohneLocal(h) === ohneLocal(normiereHost(eigenerName));
}
```

- [ ] **Step 7: Tests laufen lassen (grün)**

```
npm run selftest -w @jm/master-link
```
Erwartet: keine `FAIL`-Zeile (die Zeile `ok  CERT_SIGNATURE_FAILURE → zertifikat` ist keine), letzte Zeile `756 ok, 0 fehlgeschlagen.` (715 + 21 Adresswahl + 20 Client), Exitcode 0. Laufzeit gemessen 36–39 s ohne Fremdlast. Darunter:
```
── Adresswahl: eigene Adressen und istDieserRechner (Teil 2b, Spec 13.7, E7)           21 ok
── Client: angemeldet und Show-Daten im selben Stück (Teil 2b, Spec 13.5)             4 ok
── Client: Zeilengrenze genau an 4 KiB vor der Anmeldung (Teil 2b, Spec 13.5)         2 ok
── Client: Ereignis daten nur für stand und aenderung (Teil 2b, Spec 13.7)            3 ok
── Client: sende nur im Zustand verbunden (Teil 2b, Spec 13.7)                        4 ok
── Client: kopplung() (Teil 2b, Spec 13.7, E6)                                         7 ok
```
Unter anderem:
```
  ok  istDieserRechner("fe80::1%12"): eigene IPv6 mit Zone → true
  ok  istDieserRechner("REGIE-PC.local"): eigener Hostname groß und mit .local → true
  ok  istDieserRechner("127.0.0.1.example.com"): Hostname, der mit 127. beginnt → false
  ok  angemeldet und aenderung in einem Stück → daten kommt an (nachgeholt), nach dem Ereignis angemeldet
  ok  nach angemeldet → adressen aus angemeldet, letzteAdresse = Adresse dieser Verbindung (E6)
```

- [ ] **Step 8: Gegenprobe — nachgeholte Zeilen** (`packages/master-link/src/client.ts`, vorübergehend)

In `betreibe` die nachgeholten Nachrichten vorübergehend nur auswerten, nicht ausgeben. Die Vorzeile gehört zum Vorher-Text: `for (const n of nachgeholt) merke(n);` steht schon im Zweig `if (!a.v.offen)` (Ist `:576`, mit acht Leerzeichen), und ohne Vorzeile träfe die Rücknahme zwei Stellen. Vorher (Ist `:618-619`, genau einmal):
```ts
      a.v.on('ende', beende);
      for (const n of nachgeholt) aufNachricht(n);
```
Nachher (nur für diesen Lauf):
```ts
      a.v.on('ende', beende);
      for (const n of nachgeholt) merke(n);
```
```
npm run selftest -w @jm/master-link
```
Erwartet (gemessen), Exitcode 1:
```
FAIL  angemeldet und aenderung in einem Stück → daten kommt an (nachgeholt), nach dem Ereignis angemeldet (ist ["angemeldet"], soll ["angemeldet","daten:aenderung:3"])
FAIL  übernommene Verbindung: angemeldet + stand in einem Chunk → daten (ist [], soll ["stand"])
754 ok, 2 fehlgeschlagen.
```
Dann zurücknehmen, wieder mit der Vorzeile (genau einmal): Vorher `      a.v.on('ende', beende);` + `      for (const n of nachgeholt) merke(n);` → Nachher `      a.v.on('ende', beende);` + `      for (const n of nachgeholt) aufNachricht(n);`. Danach Step 7 wiederholen: `756 ok, 0 fehlgeschlagen.`

- [ ] **Step 9: Typecheck, Verbraucher, Zeilenenden**

```
npm run typecheck -w @jm/master-link
npm run typecheck -w @jm/launcher
npm run selftest:verbund -w @jm/launcher
npm run typecheck --workspaces --if-present
node -e "for (const f of process.argv.slice(1)) { const t = require('fs').readFileSync(f, 'utf8'); console.log(f, (t.match(/\n/g) || []).length, (t.match(/\r\n/g) || []).length); }" packages/master-link/src/client.ts packages/master-link/src/adresswahl.ts packages/master-link/test/client.test.ts packages/master-link/test/adresswahl.test.ts
```
Erwartet: alle Typechecks ohne `error TS`, Exitcode 0 (`--workspaces`: 31 Typecheck-Skripte, auf `5f8ed15ef8` waren es 29, dazu `@jm/ui` und `@jm/settings` aus UX Welle 0, N33; gemessen 80–108 s; nötig, weil `@jm/app-runtime` den Client importiert und 25 Apps app-runtime typprüfen). `selftest:verbund` endet mit `188 ok, 0 fehlgeschlagen.` Dann:
```
packages/master-link/src/client.ts 679 679
packages/master-link/src/adresswahl.ts 173 173
packages/master-link/test/client.test.ts 1136 1136
packages/master-link/test/adresswahl.test.ts 108 108
```

- [ ] **Step 10: Commit**

```
git add packages/master-link/src/adresswahl.ts packages/master-link/src/client.ts packages/master-link/test/adresswahl.test.ts packages/master-link/test/client.test.ts
git status --short
```
Erwartet genau:
```
M  packages/master-link/src/adresswahl.ts
M  packages/master-link/src/client.ts
M  packages/master-link/test/adresswahl.test.ts
M  packages/master-link/test/client.test.ts
```
Dann:
```
git commit -m "feat(master-link): Client sende, daten auch fuer nachgeholte Zeilen, kopplung(); istDieserRechner (Teil 2b R2)" -m "betreibe gibt stand und aenderung als Ereignis daten aus, auch die im Stueck von angemeldet nachgeholten, immer nach angemeldet (Spec 13.5). sende schreibt nur im Zustand verbunden. kopplung() liefert Rolle, Master, letzte Adresse (dieser Prozess, sonst Datei) und die Adressen aus angemeldet; null ohne lesbare master-link.json (Spec 13.7). adresswahl.ts: eigeneAdressen und istDieserRechner fuer Loopback, eigene Karten und den eigenen Hostnamen (Spec 13.7, 15.3, 17.4)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Keine an den Schnittstellen. `kopplung().letzteAdresse` folgt E6 (Laufzeitwert vor Datei) und weicht damit, wie in der Gliederung vermerkt, von Spec 13.7 ab.
- `kopplung()`: Bei Rolle `aus` ist der Master `null`, auch wenn die Datei noch eine Kopplung trägt (Testfall der Gliederung). `adressen` ist wörtlich Spec 13.7 („aus dem letzten `angemeldet`“): leer bis zur ersten Anmeldung, kein Rückgriff auf `kopplung.adressen` der Datei. `waehleLauncher` (17.4) braucht `adressen` nur im Zustand „verbunden“, dann sind sie gesetzt.
- `kopplung()` ist auch bei beschädigter Datei (`fehler:datei`) `null`, obwohl der Client den letzten gültigen Stand intern behält (Register: „null ohne gelesene master-link.json (fehlt oder defekt)“).
- `eigeneAdressen` normiert über die Gliederung hinaus auch Groß/Klein (IPv6) und `::ffff:`; `istDieserRechner` vergleicht beide Seiten gleich normiert. Ein Hostname mit Schlusspunkt (`regie-pc.local.`) gilt wie ohne; ein leerer `eigenerName` erkennt keinen Hostnamen.
- Das Ereignis `daten` trägt die rohe, ungeprüfte `DatenZeile` (E2). `pruefeStand` ruft der Empfänger (C12).
- Zusätzliche Tests über die Gliederung hinaus: der Koppel-Weg (`uebernehme`, deterministischer Chunk), „genau 4 KiB vor angemeldet → verbunden“ als Gegenstück zu „4 KiB + 1“, „Datei repariert“, „kopplung() liefert eine Kopie“, „Hostname, der mit 127. beginnt“.
- Zwei rote Läufe (wie C2): Ein fehlender Export bricht den ganzen Lauf beim Laden ab, deshalb erst die Client-Tests, dann die Adress-Tests.

---

### Task 5: C5 · `@jm/show`: Freigabeliste `VERBUND_EINSTELLUNGEN` und Ausschnitt `showFuerVerbund`

**Spec:** `docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md` Abschnitte 0 Nr. 4, 13.1 (`mitDokument`), 14.1, 14.2, 14.3, 19.2, 22 („Kein Token verlässt den Master“, „Keine Geheimnisse in Settings“).

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b-r2` (Branch `feat/master-link-teil2b-r2`). Alle Pfade unten sind relativ dazu. Voraussetzung: C1–C4 sind committet (Block A); C5 braucht davon nichts, wird aber danach ausgeführt.

**Dateien:**
- Modify: `packages/show/src/index.ts` — neue Exporte am Dateiende, direkt nach `parseShowDeepLink` (Ist `:367-376`). `normalizeToolRef` (`:303-321`) bleibt unverändert: Es übernimmt `settings` ungeprüft, die Freigabeliste erzwingt erst `showFuerVerbund`.
- Test: `packages/iveo/test/selftest.ts`
  - Zeile 30 (Import aus `@jm/show`)
  - neuer Block direkt vor `if (failed > 0) {` (Ist `:763`)

Zeilenangaben gelten für den Stand `5f8ed15ef8` (in diesen Dateien gleich `adda584693`, N33, N36). Maßgeblich ist immer der wortgleiche Vorher-Text.

Die `@jm/show`-Fälle stehen im iveo-Selbsttest, weil `@jm/show` keinen eigenen Testlauf hat und esbuild es dort mitbündelt (Spec 19.2). Testhilfe dort: `ok(cond: boolean, msg: string)`, sie druckt `ok   <msg>` bzw. `FAIL <msg>`, am Ende `ALLE TESTS OK`. Das Bündel `packages/iveo/test/selftest.bundle.mjs` ist in `packages/iveo/.gitignore` und erscheint nicht in `git status`.

**Interfaces:**
- Consumes: keine.
- Produces (exakt so, C8, C11–C19 bauen darauf, Register S-B):
  ```ts
  // packages/show/src/index.ts
  export const VERBUND_EINSTELLUNGEN: Readonly<Record<string, readonly string[]>>;   // Tabelle 14.2 wörtlich, eingefroren
  export interface VerbundAusschnitt { show: Show; lokalGeblieben: string[]; mitDokument: string[] }
  export function showFuerVerbund(show: Show): VerbundAusschnitt;
  ```
  - `show`: Feldreihenfolge `schemaVersion, name, updatedAt, tools, ablauf?, iveo?` wie `migrateShow`; `tools[]` nur `{ appId, settings? }`, `settings` nur mit freigegebenen Schlüsseln und nur, wenn einer übrig ist; `iveo` über eine eigene Freigabeliste mit genau den sieben Feldern event, name, syncedAt, speakers (mit Kennungen), speakerVeraltetSeit, sideEvents, filter — nie `baseUrl` und kein künftiges Feld, bevor es dort steht (Spec 0 Nr. 4, 14.1, 22; Nachbesserung N10). Die Prüfzeile mit der festen Schlüsselliste hält das fest.
  - `lokalGeblieben`: `⟨appId⟩.⟨Schlüssel⟩` jeder nicht freigegebenen Einstellung, in Reihenfolge der Tools und Schlüssel, ohne Doppelte.
  - `mitDokument`: appIds mit nicht-leerem `document` (nach `trim()`), nur Form `[a-z0-9-]{1,64}`, höchstens 64, ohne Doppelte.
  - Die Eingabe bleibt unverändert; das Ergebnis teilt kein Objekt mit ihr; `migrateShow(ergebnis.show)` ergibt dasselbe JSON.

**Regeln für diese Aufgabe:**
- Nicht anfassen: `packages/master-link`, `packages/app-runtime`, `packages/suite-control-protocol`, `packages/companion-jm-suite`, `apps/connect` (G1, G2).
- `@jm/show` bleibt ohne Abhängigkeiten und ohne I/O (Dateikopf `packages/show/src/index.ts:10-11`).
- TDD: erst den Test rot sehen, dann Code.
- Dateien im Arbeitsbaum haben CRLF-Zeilenenden. Änderungen mit dem Edit-Werkzeug (Vorher-Text exakt ersetzen), nicht mit `sed` (G12).
- G11: Weil `packages/show/src` sich ändert, laufen zusätzlich der Timer- und der Rundown-Selbsttest (beide laden `packages/show/src/index.ts` per Typ-Stripping) und `npm run typecheck --workspaces --if-present`.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`packages/iveo/test/selftest.ts`)

Ersetzung 1 (Zeile 30), Vorher:
```ts
import { createShow, hatEigeneTimerListe, loeseDoppelteKennungenAuf, normalizeAblauf, parseShow, serializeShow } from '@jm/show';
```
Nachher:
```ts
import {
  createShow, hatEigeneTimerListe, loeseDoppelteKennungenAuf, migrateShow, normalizeAblauf, parseShow, serializeShow,
  showFuerVerbund, VERBUND_EINSTELLUNGEN, type Show,
} from '@jm/show';
```

Ersetzung 2 (direkt vor dem Dateiende), Vorher:
```ts
if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
```
Nachher:
```ts
// ── @jm/show: Ausschnitt für den Verbund (Teil 2b Release 2, Spec 14, 19.2) ──
{
  /** Jedes Tool aus Tabelle 14.2, dazu Dokumente, Netz-Bindungen, Basis-URL und fremde Schlüssel. */
  const eingabe: Show = migrateShow({
    schemaVersion: 1,
    name: 'COP31 Tag 1',
    updatedAt: '2026-10-08T09:00:00.000Z',
    tools: [
      {
        appId: 'jm-timer',
        network: { host: '10.0.0.5', port: 7777 },
        settings: { timetable: [{ label: 'A', durationMs: 60000 }], durationMs: 300000, token: 'iveo_live_geheim' },
      },
      { appId: 'jm-qa', settings: { speakSeconds: 90, moderation: true, autoTimer: true, autoTitler: false } },
      { appId: 'jm-battle', settings: { rounds: 3, nameA: 'Rot', nameB: 'Blau', crewA: ['a'], crewB: ['b'] } },
      { appId: 'jm-caption', settings: { model: 'small', language: 'de', ndiName: 'CAP' } },
      {
        appId: 'jm-transcribe',
        settings: { model: 'base', language: 'de', task: 'transcribe', formats: ['srt'], outputDir: 'D:/Mitschnitt' },
      },
      {
        appId: 'jm-recorder',
        settings: { dir: 'D:/Aufnahmen', fileName: 'tag1', separateTracks: true, channels: 8, sampleRate: 48000 },
      },
      { appId: 'jm-player', settings: { show: 'C:/Bibliothek/show1', outputDisplayId: 2 } },
      { appId: 'jm-presenter', network: { host: '10.0.0.9', port: 8080 }, settings: { pin: '4711' } },
      { appId: 'jm-connect', settings: { room: 'Saal 2' } },
      { appId: 'jm-rundown', document: 'C:/Shows/Tag1.jmrundown' },
      { appId: 'jm-daw', document: 'C:/Shows/Tag1.jmdaw', settings: { mixer: 'x' } },
      { appId: 'jm-rundown', document: 'C:/Shows/Kopie.jmrundown' },
      { appId: 'jm-titler', document: '   ' },
      { appId: 'JM-Gross', document: 'C:/Shows/x.doc' },
    ],
    ablauf: [{ id: 'a1', label: 'Begrüßung', durationMs: 300000 }],
    iveo: {
      event: 'cop31',
      baseUrl: 'https://iveo.example/api/v1',
      name: 'COP31',
      syncedAt: '2026-10-08T08:00:00.000Z',
      speakers: [{ name: 'Ana Silva', title: 'Ministerin' }],
      speakerVeraltetSeit: '2026-10-08T07:30:00.000Z',
      sideEvents: [{ id: 'P1', title: 'Klima' }],
      filter: { day: '2026-11-10', programId: 'P1' },
    },
  });
  const vorher = JSON.stringify(eingabe);
  const r = showFuerVerbund(eingabe);
  const einstellungen = (appId: string) => r.show.tools.find((t) => t.appId === appId)?.settings;
  const schluessel = (appId: string): string => JSON.stringify(Object.keys(einstellungen(appId) ?? {}));
  const lokal = (...namen: string[]): boolean => namen.every((n) => r.lokalGeblieben.includes(n));

  ok(
    r.show.tools.every((t) => !('document' in t) && !('network' in t)) && !('baseUrl' in (r.show.iveo ?? {})),
    'showFuerVerbund: document, network und iveo.baseUrl fehlen',
  );
  ok(schluessel('jm-timer') === '["timetable","durationMs"]' && lokal('jm-timer.token'), '14.2 jm-timer: timetable, durationMs reisen');
  ok(schluessel('jm-qa') === '["speakSeconds","moderation","autoTimer","autoTitler"]', '14.2 jm-qa: alle vier reisen');
  ok(schluessel('jm-battle') === '["rounds","nameA","nameB","crewA","crewB"]', '14.2 jm-battle: alle fünf reisen');
  ok(schluessel('jm-caption') === '["model","language","ndiName"]', '14.2 jm-caption: alle drei reisen');
  ok(
    schluessel('jm-transcribe') === '["model","language","task","formats"]' && lokal('jm-transcribe.outputDir'),
    '14.2 jm-transcribe: outputDir bleibt lokal',
  );
  ok(
    schluessel('jm-recorder') === '["fileName","separateTracks"]' && lokal('jm-recorder.dir', 'jm-recorder.channels', 'jm-recorder.sampleRate'),
    '14.2 jm-recorder: dir, channels, sampleRate bleiben lokal',
  );
  ok(einstellungen('jm-player') === undefined && lokal('jm-player.show', 'jm-player.outputDisplayId'), '14.2 jm-player: show, outputDisplayId bleiben lokal');
  ok(einstellungen('jm-presenter') === undefined && lokal('jm-presenter.pin'), '14.2 jm-presenter: pin bleibt lokal');
  ok(schluessel('jm-connect') === '["room"]', '14.2 jm-connect: room reist');
  ok(
    JSON.stringify(r.lokalGeblieben) ===
      '["jm-timer.token","jm-transcribe.outputDir","jm-recorder.dir","jm-recorder.channels","jm-recorder.sampleRate",' +
        '"jm-player.show","jm-player.outputDisplayId","jm-presenter.pin","jm-daw.mixer"]',
    'showFuerVerbund: unbekannte Schlüssel (token, mixer) bleiben lokal, lokalGeblieben als ⟨appId⟩.⟨Schlüssel⟩',
  );
  ok(
    !('settings' in r.show.tools.find((t) => t.appId === 'jm-daw')!) && !('settings' in r.show.tools.find((t) => t.appId === 'jm-player')!),
    'showFuerVerbund: Tool ohne freigegebene Settings → settings fehlt',
  );
  ok(JSON.stringify(r.mitDokument) === '["jm-rundown","jm-daw"]', 'showFuerVerbund: mitDokument genau die Tools mit Dokument, ohne Doppelte');
  ok(!r.mitDokument.includes('jm-titler') && !r.mitDokument.includes('JM-Gross'), 'showFuerVerbund: Dokument nur aus Leerzeichen und ungültige appId zählen nicht');
  ok(
    r.show.iveo?.speakerVeraltetSeit === '2026-10-08T07:30:00.000Z'
      && JSON.stringify(Object.keys(r.show.iveo ?? {})) === '["event","name","syncedAt","speakers","speakerVeraltetSeit","sideEvents","filter"]',
    'showFuerVerbund: speakerVeraltetSeit, Speaker, Side Events und Filter reisen',
  );
  ok(
    JSON.stringify(Object.keys(r.show)) === '["schemaVersion","name","updatedAt","tools","ablauf","iveo"]' && r.show.ablauf?.[0]?.id === 'a1',
    'showFuerVerbund: schemaVersion, name, updatedAt und Ablauf mit Kennungen reisen',
  );
  const leer = showFuerVerbund(createShow('Leer'));
  ok(
    !('iveo' in leer.show) && leer.show.tools.length === 0 && leer.lokalGeblieben.length === 0 && leer.mitDokument.length === 0,
    'showFuerVerbund: ohne iveo kein iveo-Feld',
  );
  ok(JSON.stringify(eingabe) === vorher, 'showFuerVerbund: Eingabe bleibt unverändert');
  const timerAus = einstellungen('jm-timer') as { timetable: unknown[] };
  const timerEin = eingabe.tools[0].settings as { timetable: unknown[] };
  timerAus.timetable.push({ label: 'B' });
  ok(
    timerAus.timetable !== timerEin.timetable && timerEin.timetable.length === 1 && r.show.ablauf![0] !== eingabe.ablauf![0]
      && r.show.iveo!.speakers !== eingabe.iveo!.speakers,
    'showFuerVerbund: Ergebnis teilt keine Objekte mit der Eingabe',
  );
  timerAus.timetable.pop();
  ok(JSON.stringify(migrateShow(r.show)) === JSON.stringify(r.show), 'showFuerVerbund: Ergebnis läuft unverändert durch migrateShow');
  ok(JSON.stringify(showFuerVerbund(r.show).show) === JSON.stringify(r.show), 'showFuerVerbund: zweimal angewendet gleich');
  ok(
    JSON.stringify(VERBUND_EINSTELLUNGEN) ===
      '{"jm-timer":["timetable","durationMs"],"jm-qa":["speakSeconds","moderation","autoTimer","autoTitler"],' +
        '"jm-battle":["rounds","nameA","nameB","crewA","crewB"],"jm-caption":["model","language","ndiName"],' +
        '"jm-transcribe":["model","language","task","formats"],"jm-recorder":["fileName","separateTracks"],' +
        '"jm-player":[],"jm-presenter":[],"jm-connect":["room"]}',
    'VERBUND_EINSTELLUNGEN: Tabelle 14.2 wörtlich',
  );
  ok(Object.isFrozen(VERBUND_EINSTELLUNGEN) && Object.isFrozen(VERBUND_EINSTELLUNGEN['jm-timer']), 'VERBUND_EINSTELLUNGEN: eingefroren');
  const fremd = showFuerVerbund(
    migrateShow({ tools: [{ appId: 'constructor', settings: { a: 1 } }, { appId: '__proto__', settings: { b: 2 } }] }),
  );
  ok(
    fremd.show.tools.every((t) => !('settings' in t)) && JSON.stringify(fremd.lokalGeblieben) === '["constructor.a","__proto__.b"]',
    'showFuerVerbund: appId constructor/__proto__ findet keine Freigabe',
  );
}

if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
```

Die Testzeile „Ergebnis teilt keine Objekte“ verändert das Ergebnis kurz (`push`) und stellt es danach wieder her; die folgenden Prüfungen sehen das unveränderte Ergebnis.

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/iveo
```
Erwartet: esbuild bricht beim Bündeln ab, npm meldet einen Fehler-Exitcode:
```
X [ERROR] No matching export in "../show/src/index.ts" for import "showFuerVerbund"

    test/selftest.ts:32:2:
      32 │   showFuerVerbund, VERBUND_EINSTELLUNGEN, type Show,
         ╵   ~~~~~~~~~~~~~~~

X [ERROR] No matching export in "../show/src/index.ts" for import "VERBUND_EINSTELLUNGEN"

    test/selftest.ts:32:19:
      32 │   showFuerVerbund, VERBUND_EINSTELLUNGEN, type Show,
         ╵                    ~~~~~~~~~~~~~~~~~~~~~

2 errors
```

- [ ] **Step 3: Freigabeliste und Ausschnitt anlegen** (`packages/show/src/index.ts`, am Dateiende, Ist `:372-376`)

Vorher:
```ts
    return u.searchParams.get('show') || null;
  } catch {
    return null;
  }
}
```
Nachher:
```ts
    return u.searchParams.get('show') || null;
  } catch {
    return null;
  }
}

// ── Show-Daten über den Verbund (Master-Link Teil 2b, Release 2, Spec 14) ────────────────────────────────────────

/**
 * Freigabeliste (Spec 0 Nr. 4, 14.2): je appId die Einstellungen, die über den Verbund reisen. Alles andere bleibt am
 * Master (Ordner, Audiogeräte, Bildschirme, Bibliotheken, Geheimnisse wie die Presenter-PIN) und steht in
 * `lokalGeblieben`. Ein neuer Schlüssel reist erst nach einem Eintrag hier (Spec 22). Leere Liste = bekannt, nichts reist.
 */
export const VERBUND_EINSTELLUNGEN: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'jm-timer': Object.freeze(['timetable', 'durationMs']),
  'jm-qa': Object.freeze(['speakSeconds', 'moderation', 'autoTimer', 'autoTitler']),
  'jm-battle': Object.freeze(['rounds', 'nameA', 'nameB', 'crewA', 'crewB']),
  'jm-caption': Object.freeze(['model', 'language', 'ndiName']),
  'jm-transcribe': Object.freeze(['model', 'language', 'task', 'formats']),
  'jm-recorder': Object.freeze(['fileName', 'separateTracks']),
  'jm-player': Object.freeze([]),
  'jm-presenter': Object.freeze([]),
  'jm-connect': Object.freeze(['room']),
});

/** Der Ausschnitt einer Show für den Verbund (Spec 14.1) und was am Master bleibt. */
export interface VerbundAusschnitt {
  /** Ohne `iveo.baseUrl`, `tools[].document`, `tools[].network`; Settings nur nach `VERBUND_EINSTELLUNGEN`. */
  show: Show;
  /** `⟨appId⟩.⟨Schlüssel⟩` jeder Einstellung, die am Master bleibt (Logzeile Spec 15.6), ohne Doppelte. */
  lokalGeblieben: string[];
  /** appIds der Tools mit Dokument (Spec 13.1), ohne Pfad und ohne Doppelte. */
  mitDokument: string[];
}

/** Form einer appId in `mitDokument` (Spec 13.2); höchstens 64 Einträge. Sonst verwürfe jedes Tool den ganzen Stand. */
const VERBUND_APPID = /^[a-z0-9-]{1,64}$/;
const VERBUND_MAX_MIT_DOKUMENT = 64;

/**
 * Ausschnitt der offenen Show für den Verbund (Spec 14.1) — aus einer Freigabeliste, nicht aus einer Sperrliste: Ein
 * falsch abgelegtes Feld reist so nie mit (Spec 22). Eingabe ist das Ergebnis von `migrateShow`; sie bleibt unverändert,
 * und der Ausschnitt teilt kein Objekt mit ihr. Feldreihenfolge wie `migrateShow`, also läuft er unverändert hindurch.
 */
export function showFuerVerbund(show: Show): VerbundAusschnitt {
  const m = migrateShow(show);
  const lokal = new Set<string>();
  const mitDokument: string[] = [];
  const tools: ShowToolRef[] = m.tools.map((t) => {
    const hatDokument = typeof t.document === 'string' && t.document.trim() !== '';
    if (hatDokument && VERBUND_APPID.test(t.appId) && !mitDokument.includes(t.appId) && mitDokument.length < VERBUND_MAX_MIT_DOKUMENT) {
      mitDokument.push(t.appId);
    }
    const ref: ShowToolRef = { appId: t.appId };
    // hasOwnProperty: appId „constructor“ oder „__proto__“ darf keine Liste aus Object.prototype finden.
    const erlaubt = Object.prototype.hasOwnProperty.call(VERBUND_EINSTELLUNGEN, t.appId) ? VERBUND_EINSTELLUNGEN[t.appId] : [];
    if (t.settings) {
      const settings: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(t.settings)) {
        if (erlaubt.includes(k)) settings[k] = v;
        else lokal.add(`${t.appId}.${k}`);
      }
      if (Object.keys(settings).length) ref.settings = settings;
    }
    return ref;
  });
  const ausschnitt: Show = {
    schemaVersion: m.schemaVersion,
    name: m.name,
    updatedAt: m.updatedAt,
    tools,
    ...(m.ablauf ? { ablauf: m.ablauf } : {}),
  };
  if (m.iveo) {
    // Auch die Bindung über eine Freigabeliste (Spec 0 Nr. 4, 14.1, 22): jedes Feld ausdrücklich, nie `baseUrl`. Ein
    // neues Feld der Bindung reist erst, wenn es hier steht. Fehlende Felder (undefined) lässt die JSON-Kopie unten weg.
    const { event, name, syncedAt, speakers, speakerVeraltetSeit, sideEvents, filter } = m.iveo;
    ausschnitt.iveo = { event, name, syncedAt, speakers, speakerVeraltetSeit, sideEvents, filter };
  }
  // Tiefe Kopie über JSON: Settings-Werte sind beliebiges JSON; so teilt der Ausschnitt nichts mit der Eingabe.
  return { show: JSON.parse(JSON.stringify(ausschnitt)) as Show, lokalGeblieben: [...lokal], mitDokument };
}
```

Hinweis: `updatedAt` fehlt im Ergebnis, wenn die Show keins trägt (die JSON-Kopie lässt `undefined` weg); `migrateShow` setzt es dann wieder als `undefined`, das JSON bleibt gleich.

- [ ] **Step 4: Test laufen lassen (grün)**

```
npm run selftest -w @jm/iveo
```
Erwartet: keine Zeile mit `FAIL`, letzte Zeile `ALLE TESTS OK`, Exitcode 0, **190** Zeilen, die mit `ok` beginnen (vorher 166, neu 24). Unter anderem:
```
ok   showFuerVerbund: document, network und iveo.baseUrl fehlen
ok   14.2 jm-presenter: pin bleibt lokal
ok   showFuerVerbund: unbekannte Schlüssel (token, mixer) bleiben lokal, lokalGeblieben als ⟨appId⟩.⟨Schlüssel⟩
ok   showFuerVerbund: Ergebnis läuft unverändert durch migrateShow
ok   VERBUND_EINSTELLUNGEN: Tabelle 14.2 wörtlich
ok   showFuerVerbund: appId constructor/__proto__ findet keine Freigabe
```
Zählen (Bash-Werkzeug): `npm run selftest -w @jm/iveo 2>&1 | grep -c "^ok"` → `190`.

- [ ] **Step 5: Timer- und Rundown-Selbsttest (G11, beide laden `@jm/show` per Typ-Stripping)**

```
npm run selftest -w @jm/timer
npm run selftest -w @jm/rundown
```
Erwartet: Timer endet mit `41 passed, 0 failed`. Rundown: zwei Läufe, je `ALLE TESTS OK`, **404** und **81** Zeilen, die mit `ok` beginnen; Exitcode 0.

- [ ] **Step 6: Typecheck aller Workspaces (G11)**

```
npm run typecheck --workspaces --if-present
```
Erwartet: Exitcode 0, keine Zeile mit `error TS`. Laufzeit gemessen 59 s bis 2 min 34 s (drei Runden).

- [ ] **Step 7: Commit** (Bash-Werkzeug; Commit-Text bewusst ohne Umlaute)

```
git add packages/show/src/index.ts packages/iveo/test/selftest.ts
git status --short
```
Erwartet genau:
```
M  packages/iveo/test/selftest.ts
M  packages/show/src/index.ts
```
Dann:
```
git commit -m "feat(show): Ausschnitt fuer den Verbund ueber die Freigabeliste VERBUND_EINSTELLUNGEN (Teil 2b R2)" -m "showFuerVerbund bildet aus der offenen Show den Ausschnitt nach Spec 14.1: ohne iveo.baseUrl, tools[].document und tools[].network; Settings nur nach VERBUND_EINSTELLUNGEN (Tabelle 14.2, eingefroren). lokalGeblieben nennt jede andere Einstellung als appId.Schluessel, mitDokument die Tools mit Dokument. Eingabe bleibt unveraendert, das Ergebnis teilt nichts mit ihr und laeuft unveraendert durch migrateShow (Spec 19.2)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Keine an den Schnittstellen. Ergänzt (E33, E34): `showFuerVerbund` ruft intern `migrateShow` und kopiert über JSON; `mitDokument` nimmt nur gültige appIds (sonst verwürfe jedes Tool den Stand, 13.2) und zählt ein Dokument nur als nicht-leeren String nach `trim()` wie der Rundown (`apps/rundown/src/main/gedaechtnis.ts:260`).
- `jm-player` und `jm-presenter` stehen mit leerer Liste in `VERBUND_EINSTELLUNGEN` (Tabelle 14.2 nennt sie mit „–“). Das ändert nichts am Ergebnis, macht aber sichtbar, dass sie geprüft sind.
- Rundown-Vorher-Zahl: 404 + 81 statt der 485 + 81 der Gliederung (gemessen).

---

### Task 6: C6 · iveo-Kern: `meldeShow` an allen Auslösern (Spec 15.1)

**Spec:** Abschnitte 15.1 („Auslöser“: `showGeoeffnet`, nach jedem erfolgreichen Schreiben an denselben Stellen wie `benachrichtigeAlle()`, `offeneShowGespeichert` mit `null` bei nicht lesbarer Datei), 19.3 „Kern“ erster Punkt; Gliederung E10, Vormerkung 12.

**Arbeitsverzeichnis:** wie C5. Voraussetzung: C5 ist committet.

**Dateien:**
- Modify: `apps/launcher/src/main/iveo-abgleich-kern.ts`
  - `KernAbhaengigkeiten` (Ist `:54-75`, Anker `baseUrlStandard(): string;` `:74`)
  - hinter `benachrichtigeAlle` (Ist `:419-424`): neue Helfer `melde`, `meldeGeschrieben`
  - `showGeoeffnet` (Ist `:536-539`)
  - Schreibstellen vor `benachrichtigeAlle()`: Listen-Abfrage (Ist `:645-650`), Agenda-Abfrage (Ist `:739-744`), Umschalten (Ist `:919-921`)
  - `offeneShowGespeichert` (Ist `:946-950`)
- Test: `apps/launcher/test/iveo-abgleich.test.ts`
  - `interface Umgebung` (Ist `:267-269`), `function umgebung` (Ist `:270-271`), Objekt `u` (Ist `:288-290`), `leseShow` (Ist `:297-298`), `schreibeShow` (Ist `:309-312`), Ende der Kern-Abhängigkeiten (Ist `:322-324`)
  - neuer Block direkt vor `// --- Zusammenfassung ---` (Ist `:1544`)

**Interfaces:**
- Consumes: keine.
- Produces (Register S-B, C9 verdrahtet die Hülle):
  ```ts
  // apps/launcher/src/main/iveo-abgleich-kern.ts — KernAbhaengigkeiten
  /** null = gerade gespeichert und nicht lesbar. Optional: ohne sie liest der Kern nach dem Schreiben nichts zurück (E10). */
  meldeShow?(pfad: string, show: Show | null): void;
  ```
  Der Kern ruft sie: in `showGeoeffnet` mit der geöffneten Show (auch ohne iveo-Bindung und ohne Token); nach jedem erfolgreichen Schreiben (Listen-Abfrage, Agenda-Abfrage, Umschalten) mit der **zurückgelesenen** Datei (`leseShow(pfad)`, also mit dem `updatedAt`, das die Hülle beim Schreiben setzt, `iveo-sync.ts:384-386`; scheitert gerade dieses Zurücklesen, mit der eben geschriebenen Show, nie `null`), jeweils direkt vor `benachrichtigeAlle()`; in `offeneShowGespeichert` mit der gelesenen Show bzw. `null`. Nie nach einer Abfrage ohne Änderung, einem gescheiterten Schreiben oder einem verworfenen Umschalten. Wirft `meldeShow`, läuft der Kern weiter (eine Warnung).

**Regeln für diese Aufgabe:**
- E10: Ohne `meldeShow` liest der Kern nach dem Schreiben **nicht** zurück; die 239 bestehenden Prüfungen bleiben unverändert grün (sie bauen den Kern ohne `meldeShow`).
- Vormerkung 12: Die Agenda-Logzeile („iveo: Side Event abgefragt, …“, Ist `:736`) bleibt, wo sie ist; `meldeShow` kommt dahinter.
- G6: Die Warnung nennt nur den Fehlernamen (`Error`), nie die Meldung des Wurfs.
- TDD, CRLF, Edit-Werkzeug wie C5. Nicht anfassen: G1.

---

- [ ] **Step 1: Prüfstand erweitern** (`apps/launcher/test/iveo-abgleich.test.ts`)

Ersetzung 1 (Ist `:267-271`), Vorher:
```ts
  /** Die nächsten N Lesezugriffe auf Show-Dateien scheitern (null). */
  leseAus: number;
}
/** Show-Datei anlegen, Kern bauen, Show öffnen (wie onShowOpened). */
function umgebung(baue: (iv: NachgebautesIveo) => Show, opt: { ohneToken?: boolean } = {}): Umgebung {
```
Nachher:
```ts
  /** Die nächsten N Lesezugriffe auf Show-Dateien scheitern (null). */
  leseAus: number;
  /** Teil 2b R2 (E10): Lesezugriffe auf Show-Dateien. Ohne meldeShow liest der Kern nach dem Schreiben nicht zurück. */
  lesungen: number;
  /** Teil 2b R2 (Spec 15.1): Meldungen an den Verteiler, nur mit `opt.melde`. */
  gemeldet: Array<{ pfad: string; show: Show | null }>;
  /** Der nächste Aufruf von meldeShow wirft. */
  meldeWirft: boolean;
  /** Nach dem nächsten erfolgreichen Schreiben scheitern so viele Lesezugriffe (Zurücklesen, etwa EBUSY). */
  leseAusNachSchreiben: number;
}
/**
 * Show-Datei anlegen, Kern bauen, Show öffnen (wie onShowOpened). Teil 2b R2: `melde` hängt meldeShow an (Spec 15.1),
 * `schreibZeit` setzt beim Schreiben updatedAt wie die Hülle (serializeShow(show, jetzt), iveo-sync.ts:385).
 */
function umgebung(baue: (iv: NachgebautesIveo) => Show, opt: { ohneToken?: boolean; melde?: boolean; schreibZeit?: string } = {}): Umgebung {
```

Ersetzung 2 (Ist `:288-290`), Vorher:
```ts
    cache: [],
    leseAus: 0,
  };
```
Nachher:
```ts
    cache: [],
    leseAus: 0,
    lesungen: 0,
    gemeldet: [],
    meldeWirft: false,
    leseAusNachSchreiben: 0,
  };
```

Ersetzung 3 (Ist `:297-298`), Vorher:
```ts
    leseShow: (p) => {
      if (u.leseAus > 0) { u.leseAus--; return null; }
```
Nachher:
```ts
    leseShow: (p) => {
      u.lesungen++;
      if (u.leseAus > 0) { u.leseAus--; return null; }
```

Ersetzung 4 (Ist `:309-312`), Vorher:
```ts
      if (u.schreibFehler) return false;
      u.dateien.set(p, serializeShow(show));
      return true;
    },
```
Nachher:
```ts
      if (u.schreibFehler) return false;
      u.dateien.set(p, serializeShow(show, opt.schreibZeit));
      if (u.leseAusNachSchreiben > 0) {
        u.leseAus = u.leseAusNachSchreiben;
        u.leseAusNachSchreiben = 0;
      }
      return true;
    },
```
(`serializeShow(show, undefined)` ist dasselbe wie `serializeShow(show)`: Die bestehenden Prüfungen sehen dieselben Dateien. `leseAusNachSchreiben` lässt gezielt das Zurücklesen nach dem Schreiben scheitern; `leseAus` allein träfe schon das Lesen davor.)

Ersetzung 5 (Ist `:322-324`), Vorher:
```ts
    baseUrlStandard: () => 'https://standard.test/api/v1',
  });
  u.kern.showGeoeffnet(SHOW_PFAD, parseShow(u.dateien.get(SHOW_PFAD)!));
```
Nachher:
```ts
    baseUrlStandard: () => 'https://standard.test/api/v1',
    ...(opt.melde
      ? {
          meldeShow: (pfad: string, show: Show | null) => {
            if (u.meldeWirft) {
              u.meldeWirft = false;
              throw new Error('Verteiler kaputt');
            }
            u.gemeldet.push({ pfad, show });
          },
        }
      : {}),
  });
  u.kern.showGeoeffnet(SHOW_PFAD, parseShow(u.dateien.get(SHOW_PFAD)!));
```

- [ ] **Step 2: Fehlschlagende Tests schreiben** (`apps/launcher/test/iveo-abgleich.test.ts`, vor der Zusammenfassung, Ist `:1544-1545`)

Vorher:
```ts
// --- Zusammenfassung ---
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
```
Nachher:
```ts
// --- Teil 2b R2, Spec 15.1: meldeShow an allen Auslösern; nach dem Schreiben aus der Datei zurückgelesen (E10) ---------
const SCHREIBZEIT = '2026-10-08T12:00:00.000Z';
/** Listen-Show des Tages, P2 in iveo umbenannt: die nächste Abfrage schreibt. */
function listeMitAenderung(opt: Parameters<typeof umgebung>[1] = {}): Umgebung {
  const u = umgebung((iv) => showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA]), opt);
  u.iveo.programme[1] = { ...u.iveo.programme[1], title: 'Side Event Wasser und Meer' };
  u.iveo.geaendert = [u.iveo.programme[1]];
  return u;
}
{
  const ohneIveo = umgebung(() => ({ schemaVersion: 1, name: 'Ohne iveo', tools: [{ appId: 'jm-timer' }] }), { melde: true });
  ck('R2 15.1: showGeoeffnet → meldeShow(pfad, show), auch ohne iveo-Bindung',
    ohneIveo.gemeldet.length === 1 && ohneIveo.gemeldet[0].pfad === SHOW_PFAD && ohneIveo.gemeldet[0].show?.name === 'Ohne iveo');
  const mitIveo = umgebung(agendaP1, { melde: true });
  ck('R2 15.1: … mit iveo-Bindung ist die gemeldete Show die geöffnete',
    mitIveo.gemeldet.length === 1 && JSON.stringify(mitIveo.gemeldet[0].show) === JSON.stringify(datei(mitIveo)));
}
{
  const u = listeMitAenderung({ melde: true, schreibZeit: SCHREIBZEIT });
  await u.kern.abfrage();
  const letzte = u.gemeldet.at(-1);
  ck('R2 15.1: Listen-Abfrage schreibt → meldeShow mit der zurückgelesenen Datei (updatedAt der Hülle)',
    u.gemeldet.length === 2 && letzte?.pfad === SHOW_PFAD && letzte.show?.updatedAt === SCHREIBZEIT
    && JSON.stringify(letzte.show) === JSON.stringify(datei(u)) && letzte.show?.ablauf?.[1]?.label === 'Side Event Wasser und Meer');
  await u.kern.abfrage();
  ck('R2 15.1: Abfrage ohne Änderung (Signatur gleich) → kein meldeShow', u.schreibversuche === 1 && u.gemeldet.length === 2);
}
{
  const u = umgebung(agendaP1, { melde: true, schreibZeit: SCHREIBZEIT });
  u.iveo.agenda.P1 = [...u.iveo.agenda.P1, punkt('P1', 'a4', 'Schlusswort', 4, 5)];
  await u.kern.abfrage();
  ck('R2 15.1: Agenda-Abfrage schreibt → meldeShow mit der Datei',
    u.gemeldet.length === 2 && ids(u.gemeldet[1].show!) === 'a1,a2,a3,a4' && u.gemeldet[1].show?.updatedAt === SCHREIBZEIT);
  const zeileAgenda = u.info.findIndex((z) => z.startsWith('iveo: Side Event abgefragt,'));
  const zeileReload = u.info.findIndex((z) => z.startsWith('iveo: RELOAD →'));
  ck('R2 15.1: … die Logzeile der Agenda-Abfrage steht weiter vor dem RELOAD (Vormerkung 12)', zeileAgenda >= 0 && zeileAgenda < zeileReload);
  const r = await u.kern.umschalten({ programId: 'P2' });
  ck('R2 15.1: Umschalten schreibt → meldeShow', r.ok && u.gemeldet.length === 3 && ids(u.gemeldet[2].show!) === 'b1,b2');
  u.iveo.fehler.agenda = new Error('fetch failed');
  const r2 = await u.kern.umschalten({ programId: 'P1' });
  ck('R2 15.1: Umschalten scheitert → kein meldeShow', !r2.ok && u.gemeldet.length === 3);
  delete u.iveo.fehler.agenda;
  u.iveo.agenda.P2 = [...u.iveo.agenda.P2, punkt('P2', 'b3', 'Abschluss', 3)];
  u.schreibFehler = true;
  await u.kern.abfrage();
  ck('R2 15.1: Schreiben scheitert → kein meldeShow', u.schreibversuche === 3 && u.gemeldet.length === 3);
}
{
  const u = umgebung(agendaP1, { melde: true });
  u.dateien.set(SHOW_PFAD, serializeShow({ ...datei(u), name: 'Umbenannt' }));
  u.kern.offeneShowGespeichert(SHOW_PFAD, false);
  ck('R2 15.1: offeneShowGespeichert, lesbar → meldeShow(pfad, show)',
    u.gemeldet.length === 2 && u.gemeldet[1].pfad === SHOW_PFAD && u.gemeldet[1].show?.name === 'Umbenannt');
  u.leseAus = 1;
  u.kern.offeneShowGespeichert(SHOW_PFAD, false);
  ck('R2 15.1: … nicht lesbar → meldeShow(pfad, null)', u.gemeldet.length === 3 && u.gemeldet[2].pfad === SHOW_PFAD && u.gemeldet[2].show === null);
  u.kern.offeneShowGespeichert('C:/Shows/Andere.jmshow', false);
  ck('R2 15.1: … eine andere Datei gespeichert → kein meldeShow', u.gemeldet.length === 3);
}
{
  const u = listeMitAenderung({ melde: true });
  u.meldeWirft = true;
  await u.kern.abfrage();
  ck('R2 15.1: meldeShow wirft → trotzdem geschrieben, RELOAD hinaus, Status in Ordnung',
    u.schreibversuche === 1 && u.reloads.length === 3 && u.status.every((s) => s.ok));
  ck('R2 15.1: … genau eine Warnung, ohne Text aus dem Wurf',
    JSON.stringify(u.warn.filter((w) => w.startsWith('Verbund:'))) === JSON.stringify(['Verbund: Show-Stand nicht weitergegeben (Error).']));
}
{
  // Geschrieben, aber das Zurücklesen gleich danach scheitert (etwa EBUSY durch einen Virenscanner): Die Datei ist in
  // Ordnung, „nicht-lesbar“ wäre falsch (15.1 kennt null nur in offeneShowGespeichert). Gemeldet wird die geschriebene Show.
  const u = listeMitAenderung({ melde: true });
  u.leseAusNachSchreiben = 1;
  await u.kern.abfrage();
  const letzte = u.gemeldet.at(-1);
  ck('R2 15.1: Zurücklesen nach dem Schreiben scheitert → meldeShow mit der geschriebenen Show, nie null',
    u.schreibversuche === 1 && u.gemeldet.length === 2 && letzte?.show !== null && letzte?.show?.ablauf?.[1]?.label === 'Side Event Wasser und Meer');
}
{
  const ohne = listeMitAenderung();
  const mit = listeMitAenderung({ melde: true });
  await ohne.kern.abfrage();
  await mit.kern.abfrage();
  ck('E10: ohne meldeShow liest der Kern nach dem Schreiben nicht zurück, mit meldeShow genau einmal',
    ohne.schreibversuche === 1 && mit.schreibversuche === 1 && ohne.lesungen === 1 && mit.lesungen === 2 && ohne.gemeldet.length === 0);
}

// --- Zusammenfassung ---
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
```

`listeMitAenderung` nimmt die Optionen von `umgebung` als `Parameters<typeof umgebung>[1]`; C9 erweitert sie dort, ohne den Helfer anzufassen.

- [ ] **Step 3: Tests laufen lassen (rot)**

```
npm run selftest:iveo -w @jm/launcher
```
Erwartet: `iveo-abgleich.test.ts` scheitert, die Kette bricht danach ab (Exitcode 1; die drei anderen Dateien laufen nicht):
```
FAIL  R2 15.1: showGeoeffnet → meldeShow(pfad, show), auch ohne iveo-Bindung
FAIL  R2 15.1: … mit iveo-Bindung ist die gemeldete Show die geöffnete
FAIL  R2 15.1: Listen-Abfrage schreibt → meldeShow mit der zurückgelesenen Datei (updatedAt der Hülle)
FAIL  R2 15.1: Abfrage ohne Änderung (Signatur gleich) → kein meldeShow
FAIL  R2 15.1: Agenda-Abfrage schreibt → meldeShow mit der Datei
FAIL  R2 15.1: Umschalten schreibt → meldeShow
FAIL  R2 15.1: Umschalten scheitert → kein meldeShow
FAIL  R2 15.1: Schreiben scheitert → kein meldeShow
FAIL  R2 15.1: offeneShowGespeichert, lesbar → meldeShow(pfad, show)
FAIL  R2 15.1: … nicht lesbar → meldeShow(pfad, null)
FAIL  R2 15.1: … eine andere Datei gespeichert → kein meldeShow
FAIL  R2 15.1: … genau eine Warnung, ohne Text aus dem Wurf
FAIL  R2 15.1: Zurücklesen nach dem Schreiben scheitert → meldeShow mit der geschriebenen Show, nie null
FAIL  E10: ohne meldeShow liest der Kern nach dem Schreiben nicht zurück, mit meldeShow genau einmal
241 ok, 14 fehlgeschlagen.
```
Schon grün sind „Vormerkung 12“ (die Logzeile steht heute vor dem RELOAD) und „meldeShow wirft → trotzdem geschrieben“ (heute ruft niemand `meldeShow`).

- [ ] **Step 4: Abhängigkeit `meldeShow`** (`apps/launcher/src/main/iveo-abgleich-kern.ts`, Ist `:73-75`)

Vorher:
```ts
  /** Basis-URL, wenn die Show keine trägt (resolveIveoBaseUrl). */
  baseUrlStandard(): string;
}
```
Nachher:
```ts
  /** Basis-URL, wenn die Show keine trägt (resolveIveoBaseUrl). */
  baseUrlStandard(): string;
  /**
   * Teil 2b R2, Spec 15.1: Die offene Show ist geöffnet, geschrieben oder im Editor gespeichert worden — so, wie sie in
   * der Datei steht; `null` = gerade gespeichert und nicht lesbar. Die Hülle reicht sie an den Verteiler. Optional: ohne
   * sie liest der Kern nach dem Schreiben nichts zurück (E10).
   */
  meldeShow?(pfad: string, show: Show | null): void;
}
```

- [ ] **Step 5: Helfer `melde` und `meldeGeschrieben`, `schreibeAblauf` merkt die geschriebene Show**

Ersetzung 1 (direkt hinter `benachrichtigeAlle`, Ist `:423-424`), Vorher:
```ts
    d.log.info(`iveo: RELOAD → ${timer} Timer, ${titler} Titler, ${rundown} Rundown benachrichtigt.`);
  }
```
Nachher:
```ts
    d.log.info(`iveo: RELOAD → ${timer} Timer, ${titler} Titler, ${rundown} Rundown benachrichtigt.`);
  }

  /** Teil 2b R2, Spec 15.1: an den Verteiler melden. Ein Wurf hält den Abgleich nie an; eine Warnung ohne Fremdtext (G6). */
  function melde(pfad: string, show: Show | null): void {
    if (!d.meldeShow) return;
    try {
      d.meldeShow(pfad, show);
    } catch (e) {
      d.log.warn(`Verbund: Show-Stand nicht weitergegeben (${(e as Error | null)?.name || 'Fehler'}).`);
    }
  }
  /** Teil 2b R2 (E10): die zuletzt erfolgreich geschriebene Show, falls das Zurücklesen gleich danach scheitert. */
  let geschriebeneShow: Show | null = null;
  /**
   * E10: nach einem erfolgreichen Schreiben die Datei zurücklesen, mit dem `updatedAt`, das die Hülle beim Schreiben
   * setzt. Scheitert gerade dieses Lesen (etwa EBUSY durch einen Virenscanner), geht die eben geschriebene Show hinaus
   * (ohne das `updatedAt` der Hülle), nie `null`: Die Datei ist geschrieben, „nicht-lesbar“ wäre falsch (15.1 kennt `null`
   * nur in `offeneShowGespeichert`). Den Grund des Lesefehlers hat der Leser der Hülle schon im Log.
   */
  function meldeGeschrieben(pfad: string): void {
    if (!d.meldeShow) return;
    const show = d.leseShow(pfad) ?? geschriebeneShow;
    if (show) melde(pfad, show);
  }
```

Ersetzung 2 (Ende von `schreibeAblauf`, Ist `:485-486`), Vorher:
```ts
    return d.schreibeShow(pfad, show);
  }
```
Nachher:
```ts
    const ok = d.schreibeShow(pfad, show);
    // E10: Scheitert das Zurücklesen gleich danach, meldet meldeGeschrieben diese Show.
    geschriebeneShow = ok ? show : null;
    return ok;
  }
```

- [ ] **Step 6: `showGeoeffnet` meldet jede Show** (Ist `:536-539`)

Vorher:
```ts
  function showGeoeffnet(pfad: string, show: Show): void {
    setzeAuf(pfad, show);
    d.meldeAktiv();
  }
```
Nachher:
```ts
  function showGeoeffnet(pfad: string, show: Show): void {
    setzeAuf(pfad, show);
    // Spec 15.1: jede geöffnete Show, auch ohne iveo-Bindung oder Token.
    melde(pfad, show);
    d.meldeAktiv();
  }
```

- [ ] **Step 7: Nach jedem erfolgreichen Schreiben melden** (drei Stellen, je direkt vor `benachrichtigeAlle()`)

Listen-Abfrage (Ist `:645-650`), Vorher:
```ts
    a.lastSyncIso = snap.fetchedAt;
    a.speakerVeraltetSeit = merker;
    if (speakerWieder) meldeSpeakerWieder();
    statusNachAbfrage(a);
    benachrichtigeAlle();
  }
```
Nachher:
```ts
    a.lastSyncIso = snap.fetchedAt;
    a.speakerVeraltetSeit = merker;
    if (speakerWieder) meldeSpeakerWieder();
    statusNachAbfrage(a);
    meldeGeschrieben(a.path);
    benachrichtigeAlle();
  }
```

Agenda-Abfrage (Ist `:739-744`; die Logzeile `:736` davor bleibt, Vormerkung 12), Vorher:
```ts
    a.sideCtx = ctx;
    a.speakerVeraltetSeit = merker;
    if (speakerWieder) meldeSpeakerWieder();
    statusNachAbfrage(a);
    benachrichtigeAlle();
  }
```
Nachher:
```ts
    a.sideCtx = ctx;
    a.speakerVeraltetSeit = merker;
    if (speakerWieder) meldeSpeakerWieder();
    statusNachAbfrage(a);
    meldeGeschrieben(a.path);
    benachrichtigeAlle();
  }
```

Umschalten (Ist `:919-921`), Vorher:
```ts
      statusNachAbfrage(a);
      benachrichtigeAlle();
      d.meldeAktiv();
```
Nachher:
```ts
      statusNachAbfrage(a);
      meldeGeschrieben(a.path);
      benachrichtigeAlle();
      d.meldeAktiv();
```

- [ ] **Step 8: `offeneShowGespeichert` meldet die gelesene Show oder `null`** (Ist `:946-950`)

Vorher:
```ts
    if (offenePfad === null || pfadSchluessel(pfad) !== pfadSchluessel(offenePfad)) return;
    const vorher = active;
    const show = d.leseShow(offenePfad);
    if (show) {
      const neu = setzeAuf(offenePfad, show);
```
Nachher:
```ts
    if (offenePfad === null || pfadSchluessel(pfad) !== pfadSchluessel(offenePfad)) return;
    const vorher = active;
    const pfadOffen = offenePfad;
    const show = d.leseShow(pfadOffen);
    // Spec 15.1: gespeichert und lesbar → die Show; nicht lesbar → null (der Verteiler meldet „nicht-lesbar“).
    melde(pfadOffen, show);
    if (show) {
      const neu = setzeAuf(pfadOffen, show);
```
`pfadOffen` hält den Pfad fest, bevor `setzeAuf` `offenePfad` neu setzt (gleicher Wert; so liest TypeScript ihn als `string`).

- [ ] **Step 9: Tests laufen lassen (grün)**

```
npm run selftest:iveo -w @jm/launcher
```
Erwartet: vier Zusammenfassungen ohne Fehlschlag, Exitcode 0:
```
255 ok, 0 fehlgeschlagen.
47 ok, 0 fehlgeschlagen.
84 ok, 0 fehlgeschlagen.
6 ok, 0 fehlgeschlagen.
```

- [ ] **Step 10: Typecheck**

```
npm run typecheck -w @jm/launcher
```
Erwartet: keine Fehlermeldung von `tsc`, Exitcode 0.

- [ ] **Step 11: Commit** (Bash-Werkzeug)

```
git add apps/launcher/src/main/iveo-abgleich-kern.ts apps/launcher/test/iveo-abgleich.test.ts
git status --short
```
Erwartet genau:
```
M  apps/launcher/src/main/iveo-abgleich-kern.ts
M  apps/launcher/test/iveo-abgleich.test.ts
```
Dann:
```
git commit -m "feat(launcher): iveo-Kern meldet die offene Show an den Verbund (meldeShow, Teil 2b R2)" -m "Neue optionale Abhaengigkeit meldeShow(pfad, show) nach Spec 15.1: beim Oeffnen jeder Show, nach jedem erfolgreichen Schreiben (Listen-Abfrage, Agenda-Abfrage, Umschalten) mit der zurueckgelesenen Datei (scheitert das Zuruecklesen, mit der geschriebenen Show, nie null) und in offeneShowGespeichert mit der gelesenen Show oder null. Ohne meldeShow liest der Kern nichts zurueck (E10). Ein Wurf haelt den Abgleich nicht an, eine Warnung ohne Fremdtext." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:** keine. Neuer Logtext „Verbund: Show-Stand nicht weitergegeben (⟨Fehlername⟩).“ (E13-Ergänzung, Owner-Freigabe vor dem Release). Nachbesserung N6: Scheitert das Zurücklesen gleich nach dem Schreiben, meldet `meldeGeschrieben` die eben geschriebene Show (`schreibeAblauf` merkt sie), nie `null`; dazu die Testnaht `leseAusNachSchreiben` und eine Prüfung.

---

### Task 7: C7 · iveo-Kern: Side-Event-Liste auffrischen (Z3, Spec 15.4)

**Spec:** Abschnitte 15.4 (alle Punkte), 6.2 letzter Punkt („in Ordnung“ nur ohne Merker, ab Release 2 auch ohne den der Side-Event-Liste), 5.3/7.2 (Signatur, Merker rücken erst nach erfolgreichem Schreiben vor), 19.3 „Kern“; Gliederung E23 (Panel-Cache bleibt).

**Arbeitsverzeichnis:** wie C5. Voraussetzung: C6 ist committet.

**Dateien:**
- Create: `apps/launcher/src/main/iveo-side-events.ts` — `toProgramList` (aus `iveo-sync.ts:108-118` hierher gezogen) und `bildeSideEventListe`, rein, ohne Electron.
- Modify: `apps/launcher/src/main/iveo-sync.ts`
  - Import `programDayKey` (Ist `:35`) entfällt
  - Import der neuen Datei nach `./show-schreiben` (Ist `:72`)
  - `toProgramList` (Ist `:108-118`) entfällt
  - Bindung, Side-Event-Liste (Ist `:290-293`)
- Modify: `apps/launcher/src/main/iveo-abgleich-kern.ts` — Import `@jm/show` (Ist `:16`), Import nach `iveo-huelle-hilfen` und `IveoClientLike` (Ist `:38-44`), Text nach `TEXT_UMSCHALTEN_SPEAKER_VERALTET` (Ist `:108-109`), `ablaufSignatur` (Ist `:210-230`), `abweichungVonDatei` (Ist `:238`), `AktiveShow` (Ist `:327-333`), Merker-Variable (Ist `:347-348`), `statusNachAbfrage` (Ist `:372-379`), `schreibeAblauf` (Ist `:450-470`), `setzeAuf` (Ist `:516-524`), Listen-Abfrage (Ist `:593`, `:612-616`, `:632-634`, `:644-646`), Agenda-Abfrage (Ist `:697-701`, `:714-729`, `:738-740`), Umschalten (Ist `:847`, `:888-890`, `:897-908`, `:913-914`), `offeneShowGespeichert` (Ist `:953-954`).
- Test: `apps/launcher/test/iveo-abgleich.test.ts` — `type Abruf` (Ist `:124`), nachgebauter Client (Ist `:216-221`), Fixture `showMit` (Ist `:246`), Prüfung `:434`, Prüfung „Nr. 13“ (Ist `:820-821`), neuer Block vor `// --- Zusammenfassung ---`.
- Test: `apps/launcher/test/iveo-huelle.test.ts` — Importe (Ist `:6`, `:13`), neuer Block vor der Zusammenfassung (Ist `:207`).

Zeilenangaben gelten für den Stand `5f8ed15ef8` (in diesen Dateien gleich `adda584693`, N33, N36); der Kern ist seit C6 um 40 Zeilen länger (971 → 1011, gemessen am 12.10.2026, N33), die Vorher-Texte liegen deshalb je nach Stelle 0 bis 40 Zeilen weiter hinten. Maßgeblich ist der wortgleiche Vorher-Text.

**Interfaces:**
- Consumes: C6 (`meldeShow`, `melde`, `meldeGeschrieben` im Kern), C5 nicht.
- Produces (Register S-B):
  ```ts
  // apps/launcher/src/main/iveo-side-events.ts (neu, rein)
  export function toProgramList(programs: IveoProgram[]): IveoProgramRef[];                       // unverändert verschoben
  export function bildeSideEventListe(programs: IveoProgram[], filter: IveoProgramFilter): ShowIveoProgramRef[];
  // apps/launcher/src/main/iveo-abgleich-kern.ts
  export type IveoClientLike = Pick<IveoClient, … | 'listPrograms'>;
  export function ablaufSignatur(ablauf, speakers, speakerVeraltetSeit?, sideEvents: ShowIveoProgramRef[] = []): string;
  ```
  `bildeSideEventListe` nimmt den Filter **ohne** `programId` (Typ, Format, Tag, ohne Blocker) und liefert `{ id, title }` in der Reihenfolge von `toProgramList` — dieselbe Liste, die das Binden heute bildet. Die Signatur zählt die Side Events als `[id, title]`, normalisiert wie in der Datei.

**Verhalten, das die Tests festhalten:**
- Listen-Abfrage mit Snapshot und Umschalten auf die Tagesübersicht bilden die Liste neu; Umschalten auf ein Side Event lässt die Liste der Datei.
- Agenda-Abfrage: Zusatzabruf `listProgramsUpdatedSince(event, seListeIso)`; liefert er etwas, `listPrograms(event)` und neue Liste. `seListeIso` beginnt bei `syncedAt` der Show und rückt nach jedem gelungenen Zusatzabruf vor, sobald der Stand in der Datei steht (E36). Scheitert er: Liste der Datei bleibt, die Abfrage läuft weiter, Merker `seListeVeraltetSeit` (nur im Speicher), Status „gestört“ mit dem Text aus 15.4 und Uhrzeit, Warnung beim ersten Fehlschlag und bei jedem neuen Fehlertext. Der nächste gelungene Zusatzabruf löscht den Merker.
- Beide Merker → beide Texte durch „; “ getrennt, `seit` = der frühere (E38).
- Eine Bestands-Show mit veralteter Liste schreibt bei der ersten Abfrage mit Snapshot einmal, danach nicht mehr.

**Regeln für diese Aufgabe:**
- Der Kern bleibt Electron-frei; `iveo-side-events.ts` importiert aus `@shared/types` nur Typen (`import type`), damit `tsx` es ohne Pfad-Alias lädt.
- E23: Der token-freie Panel-Cache (`readCache`/`schreibeCache`) bleibt, wie er ist; aufgefrischt wird nur die Liste in der Show.
- Bewusst geänderte alte Prüfungen (E43), je mit Grund unten: Fixture `showMit`, Prüfung `:434`, Prüfung „Nr. 13“.
- TDD, CRLF, Edit-Werkzeug wie C5. Nicht anfassen: G1.

---

- [ ] **Step 1: Prüfstand und Kern-Tests** (`apps/launcher/test/iveo-abgleich.test.ts`)

Ersetzung 1 (Ist `:124`), Vorher:
```ts
type Abruf = 'geaendert' | 'snapshot' | 'agenda' | 'programm' | 'speakers';
```
Nachher:
```ts
type Abruf = 'geaendert' | 'snapshot' | 'agenda' | 'programm' | 'speakers' | 'programme';
```

Ersetzung 2 (nachgebauter Client, Ist `:216-221`), Vorher:
```ts
    async listSpeakers() {
      await schritt('speakers', '');
      return iv.speakers;
    },
  };
}
```
Nachher:
```ts
    async listSpeakers() {
      await schritt('speakers', '');
      return iv.speakers;
    },
    // Teil 2b R2, Spec 15.4: Zusatzabruf der Agenda-Abfrage für die Side-Event-Liste.
    async listPrograms() {
      await schritt('programme', '');
      return iv.programme;
    },
  };
}
```

Ersetzung 3 (Fixture `showMit`, Ist `:246-247`). Grund: Die Fixture trug P1–P2, das Binden bildet für den Tag aber P1–P3 (P3 liegt am selben Tag, P4 am 11.11.). Mit 15.4 schriebe jede Abfrage mit Snapshot diese veraltete Liste neu, und alte Prüfungen wie „Nr. 2: … Ablauf gleich → nichts geschrieben“ prüften das Falsche. Vorher:
```ts
      sideEvents: [{ id: 'P1', title: 'Side Event Klima' }, { id: 'P2', title: 'Side Event Wasser' }],
      filter,
```
Nachher:
```ts
      // Teil 2b R2 (Spec 15.4): die Liste, die das Binden für den Tag bildet (P1–P3; P4 liegt am 11.11.). Eine kürzere
      // Liste wäre veraltet, und jede Abfrage mit Snapshot schriebe sie neu.
      sideEvents: [{ id: 'P1', title: 'Side Event Klima' }, { id: 'P2', title: 'Side Event Wasser' }, { id: 'P3', title: 'Side Event Wald' }],
      filter,
```

Ersetzung 4 (Ist `:434`, folgt aus Ersetzung 3), Vorher:
```ts
    datei(u).iveo?.filter?.day === TAG && datei(u).iveo?.speakers?.[0]?.name === 'Ana Silva' && datei(u).iveo?.sideEvents?.length === 2);
```
Nachher:
```ts
    datei(u).iveo?.filter?.day === TAG && datei(u).iveo?.speakers?.[0]?.name === 'Ana Silva' && datei(u).iveo?.sideEvents?.length === 3);
```

Ersetzung 5 (Prüfung „Nr. 13“, Ist `:820-821`). Grund: Die Prüfung erkannte den Agenda-Modus daran, dass kein `updated_since` gefragt wurde; seit 15.4 fragt auch die Agenda-Abfrage — aber erst **nach** der Agenda. Vorher:
```ts
  ck('Nr. 13: bei neuer Bindung nutzt die nächste Abfrage den neuen Filter (Agenda von P2)',
    u.iveo.abrufe.includes('agenda:P2') && !u.iveo.abrufe.some((x) => x.startsWith('geaendert:')));
```
Nachher:
```ts
  // Teil 2b R2 (Spec 15.4): Auch die Agenda-Abfrage fragt updated_since — als Zusatzabruf NACH der Agenda.
  ck('Nr. 13: bei neuer Bindung nutzt die nächste Abfrage den neuen Filter (Agenda von P2)',
    u.iveo.abrufe.includes('agenda:P2')
    && u.iveo.abrufe.indexOf('agenda:P2') < u.iveo.abrufe.findIndex((x) => x.startsWith('geaendert:')));
```

Ersetzung 6 (neuer Block hinter dem C6-Block, vor der Zusammenfassung), Vorher:
```ts
    ohne.schreibversuche === 1 && mit.schreibversuche === 1 && ohne.lesungen === 1 && mit.lesungen === 2 && ohne.gemeldet.length === 0);
}

// --- Zusammenfassung ---
```
Nachher:
```ts
    ohne.schreibversuche === 1 && mit.schreibversuche === 1 && ohne.lesungen === 1 && mit.lesungen === 2 && ohne.gemeldet.length === 0);
}

// --- Teil 2b R2, Spec 15.4 (Z3): Side-Event-Liste auffrischen --------------------------------------------------------
const TEXT_SELISTE = 'Side-Event-Liste von iveo nicht abrufbar, Liste aus früherem Stand';
/** Side-Event-Liste der Datei als Text „id:Titel,…“. */
const seListe = (show: Show): string => (show.iveo?.sideEvents ?? []).map((s) => `${s.id}:${s.title}`).join(',');
/** Dieselbe Show mit einer anderen (z. B. veralteten) Side-Event-Liste in der Datei. */
const mitListe = (s: Show, sideEvents: Array<{ id: string; title: string }>): Show => ({ ...s, iveo: { ...s.iveo!, sideEvents } });
const seWarnungen = (u: Umgebung): string[] => u.warn.filter((w) => w.startsWith('iveo: Side-Event-Liste nicht abrufbar'));
{
  const a: ShowAblaufItem[] = [{ id: 'a1', label: 'Begrüßung' }];
  ck('R2 15.4: Signatur — die Side Events zählen (Titel geändert)',
    ablaufSignatur(a, [], undefined, [{ id: 'P1', title: 'A' }]) !== ablaufSignatur(a, [], undefined, [{ id: 'P1', title: 'B' }]));
  ck('R2 15.4: Signatur — Side Events so normalisiert wie die Datei (getrimmt, leerer Titel → id), ohne = leere Liste',
    ablaufSignatur(a, [], undefined, [{ id: ' P1 ', title: '' }]) === ablaufSignatur(a, [], undefined, [{ id: 'P1', title: 'P1' }])
    && ablaufSignatur(a, []) === ablaufSignatur(a, [], undefined, []));
}
{
  const u = umgebung((iv) => showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA]), { melde: true });
  u.iveo.programme[2] = { ...u.iveo.programme[2], title: 'Side Event Wald und Moor' };
  u.iveo.geaendert = [u.iveo.programme[2]];
  await u.kern.abfrage();
  ck('R2 15.4: Listen-Abfrage mit Snapshot bildet die Liste neu, geschrieben, RELOAD, gemeldet',
    seListe(datei(u)) === 'P1:Side Event Klima,P2:Side Event Wasser,P3:Side Event Wald und Moor' && u.reloads.length === 3
    && seListe(u.gemeldet.at(-1)!.show!) === seListe(datei(u)));
}
{
  // Bestands-Show: Die Liste in der Datei ist veraltet (P3 fehlt). Die erste Abfrage mit Snapshot schreibt einmal.
  const u = umgebung((iv) => mitListe(showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA]), [{ id: 'P1', title: 'Side Event Klima' }]));
  u.iveo.geaendert = [u.iveo.programme[3]]; // geändert hat sich nur P4 (anderer Tag): der Ablauf bleibt gleich
  await u.kern.abfrage();
  ck('R2 15.4: Bestands-Show — die erste Abfrage nach dem Update schreibt die Liste einmal, RELOAD',
    u.schreibversuche === 1 && seListe(datei(u)) === 'P1:Side Event Klima,P2:Side Event Wasser,P3:Side Event Wald' && u.reloads.length === 3);
  await u.kern.abfrage();
  ck('R2 15.4: … danach nicht mehr', u.schreibversuche === 1 && u.reloads.length === 3);
}
{
  const u = umgebung((iv) => mitListe(agendaP1(iv), [{ id: 'P1', title: 'Side Event Klima' }]));
  const r = await u.kern.umschalten({ programId: 'P2' });
  ck('R2 15.4: Umschalten auf ein Side Event lässt die Liste der Datei, wie sie ist', r.ok && seListe(datei(u)) === 'P1:Side Event Klima');
  const r2 = await u.kern.umschalten({ day: TAG });
  ck('R2 15.4: Umschalten auf die Tagesübersicht bildet die Liste neu',
    r2.ok && seListe(datei(u)) === 'P1:Side Event Klima,P2:Side Event Wasser,P3:Side Event Wald');
  const r3 = await u.kern.umschalten({ day: '2026-11-11' });
  ck('R2 15.4: … ein anderer Tag → die Liste dieses Tages', r3.ok && seListe(datei(u)) === 'P4:Side Event Ozean');
}
{
  const u = umgebung(agendaP1);
  await u.kern.abfrage();
  const erste = u.iveo.abrufe.filter((x) => x.startsWith('geaendert:'));
  ck('R2 15.4: Agenda-Abfrage fragt zusätzlich updated_since ab syncedAt der Show; liefert es nichts → kein listPrograms',
    JSON.stringify(erste) === JSON.stringify(['geaendert:2026-10-01T08:00:00.000Z']) && !u.iveo.abrufe.includes('programme:')
    && u.schreibversuche === 0);
  u.iveo.programme[1] = { ...u.iveo.programme[1], title: 'Side Event Wasser und Meer' };
  u.iveo.geaendert = [u.iveo.programme[1]];
  await u.kern.abfrage();
  ck('R2 15.4: liefert es etwas → listPrograms, Liste neu, geschrieben, RELOAD',
    u.iveo.abrufe.includes('programme:') && u.schreibversuche === 1 && u.reloads.length === 3
    && seListe(datei(u)) === 'P1:Side Event Klima,P2:Side Event Wasser und Meer,P3:Side Event Wald');
  ck('R2 15.4: … die Logzeile nennt die Side-Event-Liste',
    u.info.includes('iveo: Side Event abgefragt, die Side-Event-Liste weicht von der Datei ab → Show neu geschrieben (3 Punkte).'));
  await u.kern.abfrage();
  const seit = u.iveo.abrufe.filter((x) => x.startsWith('geaendert:')).map((x) => x.slice('geaendert:'.length));
  ck('R2 15.4: … seListeIso rückt nach jedem gelungenen Zusatzabruf vor', seit.length === 3 && seit[1] > seit[0] && seit[2] > seit[1]);
}
{
  const u = umgebung(agendaP1);
  u.iveo.agenda.P1 = [...u.iveo.agenda.P1, punkt('P1', 'a4', 'Schlusswort', 4, 5)];
  u.iveo.fehler.geaendert = new Error('fetch failed');
  await u.kern.abfrage();
  const st = u.status.at(-1);
  ck('R2 15.4: Zusatzabruf scheitert → Liste der Datei bleibt, die Abfrage läuft weiter (Agenda geschrieben)',
    u.schreibversuche === 1 && ids(datei(u)) === 'a1,a2,a3,a4' && seListe(datei(u)) === 'P1:Side Event Klima,P2:Side Event Wasser,P3:Side Event Wald');
  ck('R2 15.4: … Status gestört mit dem Text aus 15.4 und Uhrzeit', st?.ok === false && st.text === TEXT_SELISTE && typeof st.seit === 'string');
  ck('R2 15.4: … eine Warnung mit dem Fehler',
    JSON.stringify(seWarnungen(u)) === JSON.stringify(['iveo: Side-Event-Liste nicht abrufbar (fetch failed), Liste aus der Datei bleibt.']));
  const meldungen = u.status.length;
  await u.kern.abfrage();
  ck('R2 15.4: gleicher Fehlertext → keine zweite Warnung, keine neue Statusmeldung', seWarnungen(u).length === 1 && u.status.length === meldungen);
  delete u.iveo.fehler.geaendert;
  await u.kern.abfrage();
  ck('R2 15.4: nächster Zusatzabruf gelingt → in Ordnung', u.status.at(-1)?.ok === true);
}
{
  // Speichern im Editor (gleiche Bindung) behält den Merker: „seit“ bleibt der erste Fehlschlag (15.4).
  const u = umgebung(agendaP1);
  u.iveo.fehler.geaendert = new Error('fetch failed');
  await u.kern.abfrage();
  const seitVorher = u.status.at(-1)?.seit;
  u.kern.offeneShowGespeichert(SHOW_PFAD, false);
  await u.kern.abfrage();
  const st = u.status.at(-1);
  ck('R2 15.4: Speichern im Editor behält den Merker, „seit“ bleibt der erste Fehlschlag',
    typeof seitVorher === 'string' && st?.ok === false && st.text === TEXT_SELISTE && st.seit === seitVorher);
}
{
  const u = umgebung((iv) => mitMerker(agendaP1(iv)));
  await u.kern.umschalten({ programId: 'P1' }); // Kontext merken; P1 verknüpft keine Speaker, der Merker bleibt
  u.iveo.fehler.speakers = new IveoApiError(500, 'server_error', 'kaputt');
  u.iveo.fehler.geaendert = new Error('fetch failed');
  await u.kern.abfrage();
  const st = u.status.at(-1);
  ck('R2 15.4: beide Merker → beide Texte mit „; “, „seit“ = der frühere',
    st?.ok === false && st.text === `${TEXT_SPEAKER_VERALTET}; ${TEXT_SELISTE}` && st.seit === MERKER);
}

// --- Zusammenfassung ---
```

- [ ] **Step 2: Hüllen-Test für die gemeinsame Liste** (`apps/launcher/test/iveo-huelle.test.ts`)

Ersetzung 1 (Ist `:6`), Vorher:
```ts
import { IveoApiError, IveoClient, type IveoFetchResponse } from '@jm/iveo';
```
Nachher:
```ts
import { IveoApiError, IveoClient, type IveoFetchResponse, type IveoProgram } from '@jm/iveo';
```

Ersetzung 2 (Ist `:13`), Vorher:
```ts
import { leseShowFuerEditor } from '../src/main/show-lesen';
```
Nachher:
```ts
import { leseShowFuerEditor } from '../src/main/show-lesen';
import { bildeSideEventListe, toProgramList } from '../src/main/iveo-side-events';
```

Ersetzung 3 (vor der Zusammenfassung, Ist `:204-207`), Vorher:
```ts
  ck('keine .jmshow-Datei → null, nicht gelesen, eine Warnung', fremd === null && !gelesen && zeilen.length === 3);
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
```
Nachher:
```ts
  ck('keine .jmshow-Datei → null, nicht gelesen, eine Warnung', fremd === null && !gelesen && zeilen.length === 3);
}

console.log('— Side-Event-Liste (Teil 2b R2, Spec 15.4): Binden und Abgleich bilden sie mit derselben Funktion');
{
  const p = (id: string, title: string, extra: Partial<IveoProgram>): IveoProgram => ({ id, event_id: 'e1', title, ...extra });
  const programme: IveoProgram[] = [
    p('B', 'Zweiter Tag', { starts_at_local: '2026-11-11T09:00:00', type_slug: 'side-event' }),
    p('A2', ' Später ', { starts_at_local: '2026-11-10T14:00:00', type_slug: 'side-event' }),
    p('A1', '', { starts_at_local: '2026-11-10T09:00:00', type_slug: 'side-event' }),
    p('X', 'Plenum', { starts_at_local: '2026-11-10T08:00:00', type_slug: 'plenary' }),
    p('Z', 'Blocker Mittag', { starts_at_local: '2026-11-10T12:00:00', type_slug: 'side-event' }),
  ];
  const tag = { day: '2026-11-10', typeSlug: 'side-event', excludeBlockers: true };
  ck('Bindung wie vorher: Tag, Typ, ohne Blocker, nach Startzeit, Titel getrimmt, leerer Titel → „(ohne Titel)“',
    JSON.stringify(bildeSideEventListe(programme, tag)) === '[{"id":"A1","title":"(ohne Titel)"},{"id":"A2","title":"Später"}]');
  ck('programId im Filter zählt nicht: die Liste ist die des Tages',
    JSON.stringify(bildeSideEventListe(programme, { ...tag, programId: 'A2' })) === JSON.stringify(bildeSideEventListe(programme, tag)));
  ck('ohne Filter: alle Programme, nach Tag und Startzeit', bildeSideEventListe(programme, {}).map((x) => x.id).join(',') === 'X,A1,Z,A2,B');
  ck('toProgramList trägt den Tag (Auswahl im Show-Editor)',
    JSON.stringify(toProgramList([programme[0]])) === '[{"id":"B","title":"Zweiter Tag","day":"2026-11-11"}]');
  ck('Statuszeile: beide Merker → beide Texte mit „; “ und die Uhrzeit',
    iveoStatusZeile({
      ok: false,
      text: 'Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand; Side-Event-Liste von iveo nicht abrufbar, Liste aus früherem Stand',
      seit,
    }) === 'iveo-Abgleich gestört: Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand; Side-Event-Liste von iveo nicht abrufbar, Liste aus früherem Stand (seit 14:05)');
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
```
(`seit` ist die Konstante des Abschnitts „Statuszeile im iveo-Panel“, Ist `:112`, 14:05 Ortszeit.)

- [ ] **Step 3: Tests laufen lassen (rot)**

```
npm run selftest:iveo -w @jm/launcher
```
Erwartet: `iveo-abgleich.test.ts` scheitert, die Kette bricht ab (Exitcode 1). Alle alten Prüfungen außer „Nr. 13“ bleiben grün (die Fixture P1–P3 ist für den heutigen Code gleichwertig):
```
FAIL  Nr. 13: bei neuer Bindung nutzt die nächste Abfrage den neuen Filter (Agenda von P2)
FAIL  R2 15.4: Signatur — die Side Events zählen (Titel geändert)
FAIL  R2 15.4: Listen-Abfrage mit Snapshot bildet die Liste neu, geschrieben, RELOAD, gemeldet
FAIL  R2 15.4: Bestands-Show — die erste Abfrage nach dem Update schreibt die Liste einmal, RELOAD
FAIL  R2 15.4: … danach nicht mehr
FAIL  R2 15.4: Umschalten auf die Tagesübersicht bildet die Liste neu
FAIL  R2 15.4: … ein anderer Tag → die Liste dieses Tages
FAIL  R2 15.4: Agenda-Abfrage fragt zusätzlich updated_since ab syncedAt der Show; liefert es nichts → kein listPrograms
FAIL  R2 15.4: liefert es etwas → listPrograms, Liste neu, geschrieben, RELOAD
FAIL  R2 15.4: … die Logzeile nennt die Side-Event-Liste
FAIL  R2 15.4: … seListeIso rückt nach jedem gelungenen Zusatzabruf vor
FAIL  R2 15.4: … Status gestört mit dem Text aus 15.4 und Uhrzeit
FAIL  R2 15.4: … eine Warnung mit dem Fehler
FAIL  R2 15.4: gleicher Fehlertext → keine zweite Warnung, keine neue Statusmeldung
FAIL  R2 15.4: nächster Zusatzabruf gelingt → in Ordnung
FAIL  R2 15.4: Speichern im Editor behält den Merker, „seit“ bleibt der erste Fehlschlag
FAIL  R2 15.4: beide Merker → beide Texte mit „; “, „seit“ = der frühere
257 ok, 17 fehlgeschlagen.
```
Dann die Hülle einzeln:
```
npx tsx apps/launcher/test/iveo-huelle.test.ts
```
Erwartet: Abbruch beim Laden, Exitcode 1:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\launcher\src\main\iveo-side-events' imported from …\apps\launcher\test\iveo-huelle.test.ts
```

- [ ] **Step 4: Gemeinsame Bildung der Liste** (Create `apps/launcher/src/main/iveo-side-events.ts`)

```ts
// ─────────────────────────────────────────────────────────────────────────────
// Side-Event-Liste der Show (Master-Link Teil 2b, Release 2, Spec 15.4) — rein, OHNE Electron.
//
// Binden (iveo-sync.ts) und der Abgleich-Kern (iveo-abgleich-kern.ts: Listen-Abfrage, Tagesübersicht,
// Agenda-Abfrage) bilden die Liste mit DERSELBEN Funktion. Sonst wiche die Liste einer Abfrage von der
// gebundenen ab, und jede Abfrage schriebe und schickte RELOAD (Spec 7.2).
// ─────────────────────────────────────────────────────────────────────────────

import { filterPrograms, programDayKey, type IveoProgram, type IveoProgramFilter } from '@jm/iveo';
import type { ShowIveoProgramRef } from '@jm/show';
import type { IveoProgramRef } from '@shared/types';

/** Leichte Programm-Referenzen (id/title/day) für die Side-Event-Auswahl im Editor, nach Tag und Startzeit sortiert. */
export function toProgramList(programs: IveoProgram[]): IveoProgramRef[] {
  return [...programs]
    .sort((a, b) => {
      const da = programDayKey(a);
      const db = programDayKey(b);
      if (da !== db) return da.localeCompare(db);
      return (a.starts_at_local || a.starts_at || '').localeCompare(b.starts_at_local || b.starts_at || '');
    })
    .map((p) => ({ id: p.id, title: p.title?.trim() || '(ohne Titel)', day: programDayKey(p) }));
}

/**
 * Side Events des Tages, token-frei (Spec 15.4, wie beim Binden): Programme nach dem Filter OHNE `programId`
 * (Typ, Format, Tag, ohne Blocker), daraus `{ id, title }` in der Reihenfolge von `toProgramList`.
 */
export function bildeSideEventListe(programs: IveoProgram[], filter: IveoProgramFilter): ShowIveoProgramRef[] {
  const tagesFilter: IveoProgramFilter = {
    typeSlug: filter.typeSlug,
    formatSlug: filter.formatSlug,
    day: filter.day,
    excludeBlockers: filter.excludeBlockers,
  };
  return toProgramList(filterPrograms(programs, tagesFilter)).map((p) => ({ id: p.id, title: p.title }));
}
```

- [ ] **Step 5: Die Bindung nutzt sie** (`apps/launcher/src/main/iveo-sync.ts`)

Ersetzung 1 (Ist `:34-36`), Vorher:
```ts
  localTimeOfDayMs,
  programDayKey,
  programTaxonomy,
```
Nachher:
```ts
  localTimeOfDayMs,
  programTaxonomy,
```

Ersetzung 2 (Ist `:72`), Vorher:
```ts
import { schreibeShowAtomar, warteSync } from './show-schreiben';
```
Nachher:
```ts
import { schreibeShowAtomar, warteSync } from './show-schreiben';
import { bildeSideEventListe, toProgramList } from './iveo-side-events';
```

Ersetzung 3 (Ist `:108-120`), Vorher:
```ts
/** Leichte Programm-Referenzen (id/title/day) für die Side-Event-Auswahl im Editor. */
function toProgramList(programs: IveoProgram[]): IveoProgramRef[] {
  return [...programs]
    .sort((a, b) => {
      const da = programDayKey(a);
      const db = programDayKey(b);
      if (da !== db) return da.localeCompare(db);
      return (a.starts_at_local || a.starts_at || '').localeCompare(b.starts_at_local || b.starts_at || '');
    })
    .map((p) => ({ id: p.id, title: p.title?.trim() || '(ohne Titel)', day: programDayKey(p) }));
}

// speakerNameMap
```
Nachher:
```ts
// toProgramList und bildeSideEventListe liegen seit Teil 2b R2 (Spec 15.4) in iveo-side-events.ts: Binden und
// Abgleich-Kern bilden die Side-Event-Liste mit derselben Funktion.

// speakerNameMap
```

Ersetzung 4 (Bindung, Ist `:284-294`), Vorher:
```ts
    const dayFilter: IveoProgramFilter = {
      typeSlug: input.typeSlug,
      formatSlug: input.formatSlug,
      day: input.day,
      excludeBlockers: input.excludeBlockers,
    };
    const sideEvents = toProgramList(filterPrograms(snap.programs, dayFilter)).map((p) => ({
      id: p.id,
      title: p.title,
    }));
    const filter: IveoProgramFilter = {
```
Nachher:
```ts
    const dayFilter: IveoProgramFilter = {
      typeSlug: input.typeSlug,
      formatSlug: input.formatSlug,
      day: input.day,
      excludeBlockers: input.excludeBlockers,
    };
    const sideEvents = bildeSideEventListe(snap.programs, dayFilter);
    const filter: IveoProgramFilter = {
```
`filterPrograms`, `IveoProgram` und `IveoProgramRef` bleiben importiert (Liste im Modus A, `resolveSideEvent`, `listSideEvents`).

- [ ] **Step 6: Kern — Importe, Client, Text, Signatur** (`apps/launcher/src/main/iveo-abgleich-kern.ts`)

Ersetzung 1 (Ist `:16`), Vorher:
```ts
import { migrateShow, normalizeAblauf, type Show, type ShowAblaufItem, type ShowIveoSpeaker } from '@jm/show';
```
Nachher:
```ts
import { migrateShow, normalizeAblauf, type Show, type ShowAblaufItem, type ShowIveoProgramRef, type ShowIveoSpeaker } from '@jm/show';
```

Ersetzung 2 (Ist `:38-44`), Vorher:
```ts
import { IVEO_ABRUF_ZEITGRENZE_MS } from './iveo-huelle-hilfen';

/** Die Teilmenge des iveo-Clients, die der Kern braucht. Im Test nachgebaut. */
export type IveoClientLike = Pick<
  IveoClient,
  'listProgramsUpdatedSince' | 'getEventSnapshot' | 'listAgendaItems' | 'getProgram' | 'listSpeakers'
>;
```
Nachher:
```ts
import { IVEO_ABRUF_ZEITGRENZE_MS } from './iveo-huelle-hilfen';
import { bildeSideEventListe } from './iveo-side-events';

/** Die Teilmenge des iveo-Clients, die der Kern braucht. Im Test nachgebaut. */
export type IveoClientLike = Pick<
  IveoClient,
  'listProgramsUpdatedSince' | 'getEventSnapshot' | 'listAgendaItems' | 'getProgram' | 'listSpeakers' | 'listPrograms'
>;
```

Ersetzung 3 (Ist `:108-109`), Vorher:
```ts
/** Teil 2b, Spec 6.3: Antwort beim Umschalten auf die Tagesübersicht, hinter „Umgeschaltet — “. */
const TEXT_UMSCHALTEN_SPEAKER_VERALTET = 'Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand.';
```
Nachher:
```ts
/** Teil 2b, Spec 6.3: Antwort beim Umschalten auf die Tagesübersicht, hinter „Umgeschaltet — “. */
const TEXT_UMSCHALTEN_SPEAKER_VERALTET = 'Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand.';
/**
 * Teil 2b R2, Spec 15.4 (wortgleich): Zusatzabruf der Side-Event-Liste in der Agenda-Abfrage gescheitert. Ohne Präfix und
 * ohne Uhrzeit wie TEXT_SPEAKER_VERALTET; gelten beide Merker, stehen beide Texte durch „; “ getrennt in der Statuszeile.
 */
const TEXT_SELISTE_VERALTET = 'Side-Event-Liste von iveo nicht abrufbar, Liste aus früherem Stand';
```

Ersetzung 4 (`ablaufSignatur`, Ist `:215-230`), Vorher:
```ts
 * nach. Im geltenden Zweig B (M1 = nein) setzt er keine, dann gibt es nichts nachzutragen. Der Merker „Speaker
 * veraltet“ zählt ebenso: Setzen und Löschen schreiben die Show und schicken RELOAD — nur so erfährt der Titler davon.
 */
export function ablaufSignatur(ablauf: ShowAblaufItem[], speakers: ShowIveoSpeaker[], speakerVeraltetSeit?: string): string {
  const punkte = normalizeAblauf(ablauf).map((p) => [
    p.id ?? null,
    p.label,
    p.durationMs ?? null,
    p.note ?? null,
    p.plannedStartMs ?? null,
    p.owner ?? null,
    p.category ?? null,
  ]);
  const sprecher = speakerWieInDerDatei(speakers).map((s) => [s.id ?? null, s.name.trim(), s.title?.trim() || null]);
  return JSON.stringify([punkte, sprecher, speakerVeraltetSeit ?? null]);
}
```
Nachher:
```ts
 * nach. Im geltenden Zweig B (M1 = nein) setzt er keine, dann gibt es nichts nachzutragen. Der Merker „Speaker
 * veraltet“ zählt ebenso: Setzen und Löschen schreiben die Show und schicken RELOAD — nur so erfährt der Titler davon.
 * Teil 2b R2, Spec 15.4: Die Side Events zählen als `[id, title]`, so wie sie in der Datei stehen. Eine geänderte Liste
 * schreibt und benachrichtigt; fehlt der Parameter, gilt die leere Liste.
 */
export function ablaufSignatur(
  ablauf: ShowAblaufItem[],
  speakers: ShowIveoSpeaker[],
  speakerVeraltetSeit?: string,
  sideEvents: ShowIveoProgramRef[] = [],
): string {
  const punkte = normalizeAblauf(ablauf).map((p) => [
    p.id ?? null,
    p.label,
    p.durationMs ?? null,
    p.note ?? null,
    p.plannedStartMs ?? null,
    p.owner ?? null,
    p.category ?? null,
  ]);
  const sprecher = speakerWieInDerDatei(speakers).map((s) => [s.id ?? null, s.name.trim(), s.title?.trim() || null]);
  const seiten = sideEventsWieInDerDatei(sideEvents).map((s) => [s.id, s.title]);
  return JSON.stringify([punkte, sprecher, speakerVeraltetSeit ?? null, seiten]);
}

/** Side Events so, wie sie nach dem Schreiben in der Datei stehen (Normalisierer der Bindung: getrimmt, leerer Titel → id). */
function sideEventsWieInDerDatei(sideEvents: ShowIveoProgramRef[]): ShowIveoProgramRef[] {
  return migrateShow({ iveo: { event: '-', sideEvents } }).iveo?.sideEvents ?? [];
}
```

Ersetzung 5 (Ist `:238`), Vorher:
```ts
  const teile = ['der Ablauf', 'die Speakerliste', 'der Merker „Speaker veraltet“'];
```
Nachher:
```ts
  const teile = ['der Ablauf', 'die Speakerliste', 'der Merker „Speaker veraltet“', 'die Side-Event-Liste'];
```

- [ ] **Step 7: Kern — Merker und Status** (`apps/launcher/src/main/iveo-abgleich-kern.ts`)

Ersetzung 1 (`AktiveShow`, Ist `:330-333`), Vorher:
```ts
   * Er rückt wie lastSig erst nach erfolgreichem Schreiben vor.
   */
  speakerVeraltetSeit?: string;
}
```
Nachher:
```ts
   * Er rückt wie lastSig erst nach erfolgreichem Schreiben vor.
   */
  speakerVeraltetSeit?: string;
  /**
   * Teil 2b R2, Spec 15.4: `updated_since` für den Zusatzabruf der Side-Event-Liste in der Agenda-Abfrage. Anfangs
   * `syncedAt` der Show; rückt nach jedem gelungenen Zusatzabruf vor, dessen Stand in der Datei steht.
   */
  seListeIso: string;
  /** Teil 2b R2, Spec 15.4: Merker „Side-Event-Liste veraltet“ (nur im Speicher), ISO-Zeit des ersten Fehlschlags. */
  seListeVeraltetSeit?: string;
}

/** Ergebnis des Zusatzabrufs der Side-Event-Liste (Spec 15.4); `liste` null = seit `seListeIso` nichts geändert. */
type SeListeAbruf = { ok: true; liste: ShowIveoProgramRef[] | null; ab: string } | { ok: false; fehler: unknown };
```

Ersetzung 2 (Ist `:347-348`), Vorher:
```ts
  /** Zuletzt geloggter Fehlertext der Speakerliste (Spec 6.3): gleichbleibende Wiederholungen nicht erneut loggen. */
  let letzterSpeakerFehler: string | null = null;
```
Nachher:
```ts
  /** Zuletzt geloggter Fehlertext der Speakerliste (Spec 6.3): gleichbleibende Wiederholungen nicht erneut loggen. */
  let letzterSpeakerFehler: string | null = null;
  /** Teil 2b R2, Spec 15.4: zuletzt geloggter Fehlertext des Zusatzabrufs der Side-Event-Liste. */
  let letzterSeListeFehler: string | null = null;
```

Ersetzung 3 (`statusNachAbfrage`, Ist `:372-379`), Vorher:
```ts
  /**
   * Teil 2b, Spec 6.2: Nach einer Abfrage oder einem Umschalten „in Ordnung“ nur ohne Merker. Mit Merker bleibt der
   * Text aus 6.3 stehen, „seit“ = erster Fehlschlag.
   */
  function statusNachAbfrage(a: AktiveShow): void {
    if (a.speakerVeraltetSeit) statusGestoert(TEXT_SPEAKER_VERALTET, undefined, a.speakerVeraltetSeit);
    else statusOk();
  }
```
Nachher:
```ts
  /**
   * Teil 2b, Spec 6.2: Nach einer Abfrage oder einem Umschalten „in Ordnung“ nur ohne Merker. Mit Merker bleibt der
   * Text aus 6.3 stehen, „seit“ = erster Fehlschlag. Teil 2b R2, Spec 15.4: ebenso mit dem Merker „Side-Event-Liste
   * veraltet“; gelten beide, stehen beide Texte durch „; “ getrennt da, „seit“ = der frühere Fehlschlag.
   */
  function statusNachAbfrage(a: AktiveShow): void {
    const texte: string[] = [];
    const seit: string[] = [];
    if (a.speakerVeraltetSeit) {
      texte.push(TEXT_SPEAKER_VERALTET);
      seit.push(a.speakerVeraltetSeit);
    }
    if (a.seListeVeraltetSeit) {
      texte.push(TEXT_SELISTE_VERALTET);
      seit.push(a.seListeVeraltetSeit);
    }
    if (!texte.length) {
      statusOk();
      return;
    }
    const frueher = seit.reduce((x, y) => (Date.parse(y) < Date.parse(x) ? y : x));
    statusGestoert(texte.join('; '), undefined, frueher);
  }
  /** Teil 2b R2, Spec 15.4: Warnung beim ersten Fehlschlag des Zusatzabrufs und bei jedem neuen Fehlertext. */
  function meldeSeListeFehler(e: unknown): void {
    const text = (e as Error)?.message || String(e);
    if (text === letzterSeListeFehler) return;
    letzterSeListeFehler = text;
    d.log.warn(`iveo: Side-Event-Liste nicht abrufbar (${text}), Liste aus der Datei bleibt.`);
  }
  /**
   * Teil 2b R2, Spec 15.4: Zusatzabruf der Agenda-Abfrage. Fragt `listProgramsUpdatedSince(event, seListeIso)`; liefert
   * das etwas, lädt er `listPrograms(event)` und bildet die Liste neu. `ab` (vor dem Abruf genommen) wird das nächste
   * `seListeIso`. Wirft nie: ein Fehlschlag hält die Abfrage nicht an.
   */
  async function seListeZusatzabruf(client: IveoClientLike, a: AktiveShow): Promise<SeListeAbruf> {
    const ab = d.jetztIso();
    try {
      const geaendert = await client.listProgramsUpdatedSince(a.event, a.seListeIso);
      if (!geaendert.length) return { ok: true, liste: null, ab };
      return { ok: true, liste: bildeSideEventListe(await client.listPrograms(a.event), a.filter), ab };
    } catch (e) {
      return { ok: false, fehler: e };
    }
  }
```

- [ ] **Step 8: Kern — `schreibeAblauf` mit Side Events als Parameter, `setzeAuf`**

Ersetzung 1 (`schreibeAblauf`, Ist `:450-470`), Vorher:
```ts
  /**
   * Ablauf + Speaker + token-freie Bindung (inkl. Filter) in die Show schreiben (früher rewriteShowAblauf).
   * SYNCHRON — der Aufrufer prüft direkt davor `istAktuell`. `basis` ist die eben gelesene Datei; ihre
   * Side-Event-Liste bleibt erhalten (fürs Live-Umschalten).
   */
  function schreibeAblauf(
    pfad: string,
    basis: Show,
    w: {
      slug: string;
      baseUrl: string;
      name: string;
      ablauf: ShowAblaufItem[];
      speakers: ShowIveoSpeaker[];
      filter: IveoProgramFilter;
      /** Merker „Speaker veraltet“ (Spec 6.2). Fehlt er, steht er nicht in der Datei. */
      speakerVeraltetSeit?: string;
    },
  ): boolean {
    const sideEvents = basis.iveo?.sideEvents;
    const compact = compactFilter(w.filter);
```
Nachher:
```ts
  /**
   * Ablauf + Speaker + token-freie Bindung (inkl. Filter) in die Show schreiben (früher rewriteShowAblauf).
   * SYNCHRON — der Aufrufer prüft direkt davor `istAktuell`. `basis` ist die eben gelesene Datei. Die Side-Event-Liste
   * kommt als Parameter (Teil 2b R2, Spec 15.4): neu gebildet oder die Liste der Datei (fürs Live-Umschalten).
   */
  function schreibeAblauf(
    pfad: string,
    basis: Show,
    w: {
      slug: string;
      baseUrl: string;
      name: string;
      ablauf: ShowAblaufItem[];
      speakers: ShowIveoSpeaker[];
      filter: IveoProgramFilter;
      /** Merker „Speaker veraltet“ (Spec 6.2). Fehlt er, steht er nicht in der Datei. */
      speakerVeraltetSeit?: string;
      /** Side-Event-Liste (Spec 15.4). Leer → das Feld fehlt in der Datei. */
      sideEvents: ShowIveoProgramRef[];
    },
  ): boolean {
    const sideEvents = w.sideEvents;
    const compact = compactFilter(w.filter);
```
(Der Rest von `schreibeAblauf` bleibt: `...(sideEvents?.length ? { sideEvents } : {})`.)

Ersetzung 2 (`setzeAuf`, Ist `:516-524`), Vorher:
```ts
    active = {
      path: pfad,
      event: binding.event,
      baseUrl: binding.baseUrl || d.baseUrlStandard(),
      lastSyncIso: binding.syncedAt || d.jetztIso(),
      filter: { ...(binding.filter ?? {}) },
      lastSig: ablaufSignatur(show.ablauf ?? [], binding.speakers ?? [], binding.speakerVeraltetSeit),
      speakerVeraltetSeit: binding.speakerVeraltetSeit,
    };
```
Nachher:
```ts
    const seit = binding.syncedAt || d.jetztIso();
    active = {
      path: pfad,
      event: binding.event,
      baseUrl: binding.baseUrl || d.baseUrlStandard(),
      lastSyncIso: seit,
      filter: { ...(binding.filter ?? {}) },
      lastSig: ablaufSignatur(show.ablauf ?? [], binding.speakers ?? [], binding.speakerVeraltetSeit, binding.sideEvents),
      speakerVeraltetSeit: binding.speakerVeraltetSeit,
      seListeIso: seit,
    };
```
Ein Wert für beide Merker: kein zusätzlicher Uhr-Aufruf beim Öffnen.

- [ ] **Step 9: Kern — Listen-Abfrage bildet die Liste neu**

Ersetzung 1 (Ist `:593-594`), Vorher:
```ts
    const listPrograms = filterPrograms(snap.programs, a.filter);
    const optionen: ProgramMapOptions = {
```
Nachher:
```ts
    const listPrograms = filterPrograms(snap.programs, a.filter);
    // Teil 2b R2, Spec 15.4: Mit dem Snapshot wird die Side-Event-Liste neu gebildet, wie beim Binden.
    const sideEvents = bildeSideEventListe(snap.programs, a.filter);
    const optionen: ProgramMapOptions = {
```

Ersetzung 2 (Ist `:612-616`), Vorher:
```ts
    d.schreibeCache(buildShowMetadata(snap, a.baseUrl));
    const sig = ablaufSignatur(ablauf, speakers, merker);
    if (sig === a.lastSig) {
      // 7.2: nichts geändert → nicht schreiben, kein RELOAD; das Abfragefenster rückt trotzdem vor.
      a.lastSyncIso = snap.fetchedAt;
```
Nachher:
```ts
    d.schreibeCache(buildShowMetadata(snap, a.baseUrl));
    const sig = ablaufSignatur(ablauf, speakers, merker, sideEvents);
    if (sig === a.lastSig) {
      // 7.2: nichts geändert → nicht schreiben, kein RELOAD; das Abfragefenster rückt trotzdem vor.
      a.lastSyncIso = snap.fetchedAt;
      a.seListeIso = snap.fetchedAt;
      a.seListeVeraltetSeit = undefined;
```

Ersetzung 3 (Ist `:632-636`), Vorher:
```ts
      filter: a.filter,
      speakerVeraltetSeit: merker,
    });
    if (!ok) {
      // 7.2: kein RELOAD, Merker bleiben → die nächste Abfrage mit demselben iveo-Stand schreibt erneut.
```
Nachher:
```ts
      filter: a.filter,
      speakerVeraltetSeit: merker,
      sideEvents,
    });
    if (!ok) {
      // 7.2: kein RELOAD, Merker bleiben → die nächste Abfrage mit demselben iveo-Stand schreibt erneut.
```

Ersetzung 4 (Ist `:644-646`), Vorher:
```ts
    a.lastSig = sig;
    a.lastSyncIso = snap.fetchedAt;
    a.speakerVeraltetSeit = merker;
```
Nachher:
```ts
    a.lastSig = sig;
    a.lastSyncIso = snap.fetchedAt;
    a.seListeIso = snap.fetchedAt;
    a.seListeVeraltetSeit = undefined;
    a.speakerVeraltetSeit = merker;
```

- [ ] **Step 10: Kern — Agenda-Abfrage mit Zusatzabruf**

Ersetzung 1 (Ist `:697-701`), Vorher:
```ts
      ablauf = [einPunktAblauf(detail, names)];
    }
    // Ab hier kein await mehr: Prüfen und Schreiben stehen direkt hintereinander (7.3).
    if (!istAktuell(a, gen)) return;
    const basis = d.leseShow(a.path);
```
Nachher:
```ts
      ablauf = [einPunktAblauf(detail, names)];
    }
    // Teil 2b R2, Spec 15.4: Zusatzabruf der Side-Event-Liste. Ein Fehlschlag hält die Abfrage nicht an.
    const se = await seListeZusatzabruf(client, a);
    // Ab hier kein await mehr: Prüfen und Schreiben stehen direkt hintereinander (7.3).
    if (!istAktuell(a, gen)) return;
    if (se.ok) {
      // Der nächste gelungene Zusatzabruf löscht den Merker; ein späterer Fehlschlag kommt wieder ins Log.
      letzterSeListeFehler = null;
      a.seListeVeraltetSeit = undefined;
    } else {
      // Die Liste der Datei bleibt; Merker nur im Speicher, „seit“ = erster Fehlschlag.
      meldeSeListeFehler(se.fehler);
      a.seListeVeraltetSeit ??= d.jetztIso();
    }
    const basis = d.leseShow(a.path);
```

Ersetzung 2 (Ist `:714-729`), Vorher:
```ts
    const sig = ablaufSignatur(ablauf, speakers, merker);
    if (sig === a.lastSig) {
      // Die Datei entspricht genau diesem Kontext → merken, sonst lädt jede Abfrage ihn neu.
      a.sideCtx = ctx;
      statusNachAbfrage(a);
      return; // nichts geändert → kein RELOAD
    }
    const ok = schreibeAblauf(a.path, basis, {
      slug: a.event,
      baseUrl: a.baseUrl,
      name: basis.iveo?.name || a.event,
      ablauf,
      speakers,
      filter: a.filter,
      speakerVeraltetSeit: merker,
    });
```
Nachher:
```ts
    // Spec 15.4: neu gebildete Liste, sonst die der Datei (nichts geändert oder Zusatzabruf gescheitert).
    const sideEvents = se.ok && se.liste ? se.liste : basis.iveo?.sideEvents ?? [];
    const sig = ablaufSignatur(ablauf, speakers, merker, sideEvents);
    if (sig === a.lastSig) {
      // Die Datei entspricht genau diesem Kontext → merken, sonst lädt jede Abfrage ihn neu.
      a.sideCtx = ctx;
      if (se.ok) a.seListeIso = se.ab;
      statusNachAbfrage(a);
      return; // nichts geändert → kein RELOAD
    }
    const ok = schreibeAblauf(a.path, basis, {
      slug: a.event,
      baseUrl: a.baseUrl,
      name: basis.iveo?.name || a.event,
      ablauf,
      speakers,
      filter: a.filter,
      speakerVeraltetSeit: merker,
      sideEvents,
    });
```

Ersetzung 3 (Ist `:738-740`), Vorher:
```ts
    a.lastSig = sig;
    a.sideCtx = ctx;
    a.speakerVeraltetSeit = merker;
```
Nachher:
```ts
    a.lastSig = sig;
    a.sideCtx = ctx;
    if (se.ok) a.seListeIso = se.ab;
    a.speakerVeraltetSeit = merker;
```
Die Agenda-Logzeile (Ist `:736`) und `meldeGeschrieben` aus C6 bleiben, wo sie sind.

- [ ] **Step 11: Kern — Umschalten: Tagesübersicht neu, Side Event mit der Liste der Datei**

Ersetzung 1 (Ist `:847-848`), Vorher:
```ts
      let basisFrueh: Show | null = null;
      if (programId) {
```
Nachher:
```ts
      let basisFrueh: Show | null = null;
      /** Teil 2b R2, Spec 15.4: neu gebildete Liste der Tagesübersicht; null = die Liste der Datei bleibt (Side Event). */
      let sideEvents: ShowIveoProgramRef[] | null = null;
      if (programId) {
```

Ersetzung 2 (Ist `:888-890`), Vorher:
```ts
        name = snap.event.name;
        lastSyncIso = snap.fetchedAt;
        d.schreibeCache(buildShowMetadata(snap, a.baseUrl));
```
Nachher:
```ts
        name = snap.event.name;
        lastSyncIso = snap.fetchedAt;
        sideEvents = bildeSideEventListe(snap.programs, filter);
        d.schreibeCache(buildShowMetadata(snap, a.baseUrl));
```

Ersetzung 3 (Ist `:897-908`), Vorher:
```ts
      const speakersNeu = speakers ?? basis?.iveo?.speakers ?? [];
      const geschrieben =
        basis !== null &&
        schreibeAblauf(a.path, basis, {
          slug: a.event,
          baseUrl: a.baseUrl,
          name: name ?? (basis.iveo?.name || a.event),
          ablauf,
          speakers: speakersNeu,
          filter,
          speakerVeraltetSeit: merker,
        });
```
Nachher:
```ts
      const speakersNeu = speakers ?? basis?.iveo?.speakers ?? [];
      const sideEventsNeu = sideEvents ?? basis?.iveo?.sideEvents ?? [];
      const geschrieben =
        basis !== null &&
        schreibeAblauf(a.path, basis, {
          slug: a.event,
          baseUrl: a.baseUrl,
          name: name ?? (basis.iveo?.name || a.event),
          ablauf,
          speakers: speakersNeu,
          filter,
          speakerVeraltetSeit: merker,
          sideEvents: sideEventsNeu,
        });
```

Ersetzung 4 (Ist `:913-914`), Vorher:
```ts
      a.lastSig = ablaufSignatur(ablauf, speakersNeu, merker);
      a.lastSyncIso = lastSyncIso;
```
Nachher:
```ts
      a.lastSig = ablaufSignatur(ablauf, speakersNeu, merker, sideEventsNeu);
      a.lastSyncIso = lastSyncIso;
      if (sideEvents) {
        // Tagesübersicht: Die Liste ist frisch aus dem Snapshot.
        a.seListeIso = lastSyncIso;
        a.seListeVeraltetSeit = undefined;
      }
```

- [ ] **Step 12: Kern — Speichern im Editor behält das Fenster des Zusatzabrufs und den Merker** (Ist `:953-954`)

Vorher:
```ts
        neu.lastSyncIso = vorher.lastSyncIso;
        if (vorher.filter.programId === neu.filter.programId) neu.sideCtx = vorher.sideCtx;
```
Nachher:
```ts
        neu.lastSyncIso = vorher.lastSyncIso;
        neu.seListeIso = vorher.seListeIso;
        // Der Merker liegt nur im Speicher (15.4): „seit“ bleibt der erste Fehlschlag, nicht die Zeit nach dem Speichern.
        neu.seListeVeraltetSeit = vorher.seListeVeraltetSeit;
        if (vorher.filter.programId === neu.filter.programId) neu.sideCtx = vorher.sideCtx;
```

- [ ] **Step 13: Tests laufen lassen (grün)**

```
npm run selftest:iveo -w @jm/launcher
```
Erwartet: vier Zusammenfassungen ohne Fehlschlag, Exitcode 0:
```
274 ok, 0 fehlgeschlagen.
52 ok, 0 fehlgeschlagen.
84 ok, 0 fehlgeschlagen.
6 ok, 0 fehlgeschlagen.
```

- [ ] **Step 14: Typecheck**

```
npm run typecheck -w @jm/launcher
```
Erwartet: Exitcode 0, keine Zeile mit `error TS`.

- [ ] **Step 15: Commit** (Bash-Werkzeug)

```
git add apps/launcher/src/main/iveo-side-events.ts apps/launcher/src/main/iveo-sync.ts apps/launcher/src/main/iveo-abgleich-kern.ts apps/launcher/test/iveo-abgleich.test.ts apps/launcher/test/iveo-huelle.test.ts
git status --short
```
Erwartet genau:
```
M  apps/launcher/src/main/iveo-abgleich-kern.ts
A  apps/launcher/src/main/iveo-side-events.ts
M  apps/launcher/src/main/iveo-sync.ts
M  apps/launcher/test/iveo-abgleich.test.ts
M  apps/launcher/test/iveo-huelle.test.ts
```
Dann:
```
git commit -m "feat(launcher): Side-Event-Liste der Show wird bei Abfragen aufgefrischt (Z3, Teil 2b R2)" -m "Spec 15.4: Listen-Abfrage und Tagesuebersicht bilden die Liste mit dem Snapshot neu, die Agenda-Abfrage fragt zusaetzlich updated_since ab seListeIso und laedt bei Treffern listPrograms. Scheitert der Zusatzabruf, bleibt die Liste der Datei, Merker seListeVeraltet, Status gestoert mit Text und Uhrzeit; beide Merker durch Semikolon getrennt. Die Signatur zaehlt die Side Events, schreibeAblauf bekommt sie als Parameter. Binden und Kern bilden die Liste mit derselben Funktion (iveo-side-events.ts)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- `toProgramList` zieht mit nach `iveo-side-events.ts` (die Bindung braucht es weiter für `programList`); `bildeSideEventListe(programs, filter)` hat die Parameter der heutigen Bildung.
- Entscheidungen E36–E38 (`seListeIso`-Regeln, Merker in `AktiveShow`, gemeinsame Statuszeile). Neuer Logtext „iveo: Side-Event-Liste nicht abrufbar (⟨Fehler⟩), Liste aus der Datei bleibt.“ (E13-Ergänzung).
- Drei alte Prüfungen geändert (Fixture `showMit`, `:434`, „Nr. 13“) — Gründe oben in Step 1.
- Nachbesserung N7: Speichern im Editor (gleiche Bindung) übernimmt auch `seListeVeraltetSeit`; „seit“ bleibt so der erste Fehlschlag (15.4). Eine Prüfung.

---

### Task 8: C8 · Verteiler der Show-Daten (rein, ohne Electron)

**Spec:** Abschnitte 13.1 (Felder, `schluessel`, `mitDokument`, Fassung), 13.2 (Inhalt, den das Tool prüft), 13.3 (Epoche, Folge), 13.4 (900 KiB, 32 Abos), 13.6 (Stau, neuester Stand), 15.1 (Quelle, Start der Rolle, Launcher-Start), 15.2 (Abos nach Sitzung, Launcher-Abo, Grenze, Wiederholung), 15.6 (Logzeilen außer RELOAD), 19.3 Nr. 1–9, 22; Gliederung E5, E8, E9, E11, E13, E29.

**Arbeitsverzeichnis:** wie C5. Voraussetzung: C2, C3 (Block A: `kodiereStand`, `zeilenBytes`, `antwortFassung`, `SHOW_FASSUNG`, `GRENZEN`, `TeilnehmerDaten`, `SendeErgebnis`, `pruefeStand`) und C5 (`showFuerVerbund`) sind committet.

**Dateien:**
- Create: `apps/launcher/src/main/verbund/verteiler.ts`
- Create: `apps/launcher/test/verteiler.test.ts`
- Modify: `apps/launcher/package.json:19` (`selftest:verbund`)

**Interfaces:**
- Consumes:
  ```ts
  // @jm/master-link (Block A, S-A)
  GRENZEN.maxStandZeile /* 921_600 */, GRENZEN.maxAbosJeRechner /* 32 */, SHOW_FASSUNG /* 1 */;
  kodiereStand(t: 'stand' | 'aenderung', s: StandInhalt): string; zeilenBytes(zeile: string): number; antwortFassung(erbeten: number): number;
  type AboInhalt, StandInhalt, DatenGrund, TeilnehmerDaten, SendeErgebnis; kuerzeName(name: string): string; // Teil 1
  // @jm/show (C5)
  showFuerVerbund(show: Show): { show: Show; lokalGeblieben: string[]; mitDokument: string[] };
  ```
- Produces (Register S-B; C9 verdrahtet, C10 und C19 lesen):
  ```ts
  export interface VerteilerServer { sendeDaten(sitzung: number, zeile: string): SendeErgebnis }
  export interface VerteilerAbhaengigkeiten {
    log(stufe: 'info' | 'warn', text: string): void;
    rechnerName(rechnerId: string): string;
    neueEpoche?: () => string;              // Vorgabe crypto.randomUUID
    aufloesen?: (p: string) => string;      // Vorgabe path.resolve
    jetzt?: () => number;                   // Vorgabe Date.now (nur Anzeige „Stand hh:mm“ am Master)
    beiAenderung?: () => void;              // Modal neu melden
  }
  export interface VerteilerStand {
    grund: DatenGrund | null; showName: string | null; dateiName: string | null;
    verteiltAm: number | null; groesseKiB: number | null; epoche: string | null; folge: number | null;
    abos: { sitzung: number; rechnerId: string; appId: string }[];
  }
  export class Verteiler {
    constructor(d: VerteilerAbhaengigkeiten);
    starte(server: VerteilerServer): void;    // neue Epoche, Abos leer, Stand aus der gemerkten Show (sonst keine-show), Folge 0
    stoppe(): void;                           // Abos leer, Epoche null, sendet nichts mehr; die gemerkte Show bleibt
    meldeShow(pfad: string, show: Show | null): void;   // merkt auch ohne laufende Rolle; null = nicht-lesbar
    aufAbo(t: TeilnehmerDaten, abo: AboInhalt): void;
    aufGetrennt(sitzung: number): void;
    aufEntstaut(sitzung: number): void;
    hatAbo(sitzung: number): boolean;
    stand(): VerteilerStand;
    abosAndererRechner(): number;
  }
  export function verbundSchluessel(pfad: string, aufloesen?: (p: string) => string): string;  // 16 Hex, 2a-Spec 4.7
  ```

**Regeln für diese Aufgabe:**
- Ohne Electron, ohne Dateizugriff, ohne Netz. Der Verteiler importiert **nie** `settings.ts` (Electron `safeStorage`) und sieht nie ein Token (Spec 22); Test Nr. 8 baut den Token-Speicher nach.
- E9: Wird dieselbe Show unverändert erneut gemeldet, entsteht keine neue Folge und keine `aenderung`; die Epoche wechselt nur mit `starte()`.
- E5: Stau wird vor dem Schreiben geprüft (Server); der Verteiler überspringt gestaute Abos beim Verteilen und schickt nach `entstaut` den neuesten Stand als `aenderung`, wenn er neuer ist als der zuletzt an diese Sitzung gesendete.
- E29: Ein Abo von einem Tool dieses Rechners wird bedient wie jedes andere; `abosAndererRechner()` zählt es nicht.
- Größe nach E35: UTF-8-Bytes der fertigen `aenderung`-Zeile (Review Focus 1), KiB aufgerundet.
- Logzeilen wörtlich Spec 15.6; Namen aus Datei und Netz laufen durch `kuerzeName` (keine Steuerzeichen im zeilenbasierten Log).
- Der Testlauf hängt an `selftest:verbund` an (Spec 19.6); die CI ruft das Skript schon (`.github/workflows/ci-checks.yml`), dort ändert sich nichts.
- TDD. Neue Dateien schreibt das Write-Werkzeug mit LF (G12); `package.json` mit dem Edit-Werkzeug. Nicht anfassen: G1.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (Create `apps/launcher/test/verteiler.test.ts`)

```ts
// Verteiler der Show-Daten am Master OHNE Electron (tsx): npm run selftest:verbund -w @jm/launcher
// Master-Link Teil 2b Release 2, Spec 13.1–13.4, 13.6, 15.1, 15.2, 15.6, 19.3 Nr. 1–9. Der Server ist nachgebaut: Er
// sammelt die Zeilen je Sitzung und antwortet je Sitzung mit 'gesendet', 'gestaut' oder 'weg'.
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { GRENZEN, pruefeStand, type SendeErgebnis, type StandInhalt, type TeilnehmerDaten } from '@jm/master-link';
import { migrateShow, type Show } from '@jm/show';
import { gedaechtnisSchluessel } from '../../rundown/src/main/gedaechtnis';
import { Verteiler, verbundSchluessel, type VerteilerServer } from '../src/main/verbund/verteiler';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

const PFAD = 'C:/Shows/COP31 Tag 1.jmshow';
const ANDERER_PFAD = 'C:/Shows/COP31 Tag 2.jmshow';

/** Nachgebauter Server: sammelt jede Zeile; `modus` gibt je Sitzung die Antwort vor (Vorgabe 'gesendet'). */
function nachgebauterServer() {
  const zeilen: Array<{ sitzung: number; zeile: string }> = [];
  const modus = new Map<number, SendeErgebnis>();
  const server: VerteilerServer = {
    sendeDaten(sitzung, zeile) {
      const m = modus.get(sitzung) ?? 'gesendet';
      if (m === 'gesendet') zeilen.push({ sitzung, zeile });
      return m;
    },
  };
  return { server, zeilen, modus };
}

/** Eine Zeile → { t, stand } mit geprüftem Inhalt (pruefeStand), wie das Tool sie liest. */
function lies(zeile: string): { t: string; s: StandInhalt | null; einzeilig: boolean } {
  const o = JSON.parse(zeile) as { t: string };
  const p = pruefeStand(o);
  return { t: o.t, s: p.ok ? p.wert : null, einzeilig: zeile.endsWith('\n') && zeile.indexOf('\n') === zeile.length - 1 };
}

function umgebung() {
  const log: string[] = [];
  let epochen = 0;
  let aenderungen = 0;
  const namen = new Map([['B-id', 'Regie-Laptop'], ['C-id', 'Studio-PC'], ['A-id', 'Regie-PC']]);
  const v = new Verteiler({
    log: (stufe, text) => { log.push(`${stufe}: ${text}`); },
    rechnerName: (id) => namen.get(id) ?? id,
    neueEpoche: () => `epoche-${++epochen}`,
    jetzt: () => Date.parse('2026-10-08T10:15:00.000Z'),
    beiAenderung: () => { aenderungen++; },
  });
  const s = nachgebauterServer();
  return { v, log, s, aenderungen: () => aenderungen };
}

function tn(sitzung: number, o: Partial<TeilnehmerDaten> = {}): TeilnehmerDaten {
  const rechnerId = o.rechnerId ?? 'B-id';
  const appId = o.appId ?? 'jm-timer';
  return { sitzung, schluessel: `${rechnerId}\u0000${appId}`, rechnerId, art: 'tool', appId, dieserRechner: false, ...o };
}
const ABO = { art: 'show' as const, fassung: 1 };

function show(name = 'COP31 Tag 1', extra: Partial<Show> = {}): Show {
  return migrateShow({
    schemaVersion: 1,
    name,
    updatedAt: '2026-10-08T09:00:00.000Z',
    tools: [
      { appId: 'jm-timer', settings: { durationMs: 300000 } },
      { appId: 'jm-recorder', settings: { dir: 'D:/Aufnahmen', fileName: 'tag1' } },
      { appId: 'jm-rundown', document: 'C:/Shows/Tag1.jmrundown' },
    ],
    ablauf: [{ id: 'a1', label: 'Begrüßung' }],
    iveo: { event: 'cop31', baseUrl: 'https://iveo.example/api/v1', name: 'COP31', speakers: [{ name: 'Ana Silva' }] },
    ...extra,
  });
}
const an = (zeilen: Array<{ sitzung: number; zeile: string }>, sitzung: number) => zeilen.filter((z) => z.sitzung === sitzung).map((z) => lies(z.zeile));

// --- Nr. 1: Abo → stand mit Epoche und Folge 0 bzw. dem aktuellen Stand -------------------------------------------
{
  const u = umgebung();
  u.v.meldeShow(PFAD, show());
  u.v.starte(u.s.server);
  u.v.aufAbo(tn(1), ABO);
  const [z] = an(u.s.zeilen, 1);
  ck('Nr. 1: Abo → genau eine Zeile „stand“, besteht pruefeStand, eine Zeile mit \\n',
    u.s.zeilen.length === 1 && z.t === 'stand' && z.s !== null && z.einzeilig);
  ck('Nr. 1: … Epoche des Verteilers, Folge 0, Fassung 1, Schlüssel der Show',
    z.s?.epoche === 'epoche-1' && z.s.folge === 0 && z.s.fassung === 1 && z.s.schluessel === verbundSchluessel(PFAD));
  ck('Nr. 1: … der Ausschnitt (ohne baseUrl, Dokument und rechnergebundene Settings), mitDokument',
    (z.s?.show as Show | null)?.name === 'COP31 Tag 1' && !JSON.stringify(z.s?.show).includes('baseUrl')
    && !JSON.stringify(z.s?.show).includes('Aufnahmen') && JSON.stringify(z.s?.mitDokument) === '["jm-rundown"]' && z.s?.grund === undefined);
  u.v.meldeShow(PFAD, show('Zwei'));
  u.v.meldeShow(PFAD, show('Drei'));
  u.v.meldeShow(PFAD, show('Vier'));
  u.v.aufAbo(tn(2, { appId: 'jm-titler' }), ABO);
  const [z2] = an(u.s.zeilen, 2);
  ck('Nr. 1: Abo nach drei Änderungen → stand mit dem aktuellen Stand (Folge 3)',
    z2.t === 'stand' && z2.s?.folge === 3 && (z2.s?.show as Show | null)?.name === 'Vier');
  u.v.aufAbo(tn(3, { appId: 'jm-rundown' }), { art: 'show', fassung: 2 });
  ck('13.1: Abo mit Fassung 2 → stand mit der höchsten bekannten Fassung (1)', an(u.s.zeilen, 3)[0]?.s?.fassung === 1);
}

// --- Nr. 2 und 3: gleiche Show → keine neue Folge; geänderte Show → Folge + 1, aenderung an alle, einmal serialisiert -
{
  const u = umgebung();
  u.v.starte(u.s.server);
  u.v.meldeShow(PFAD, show());
  u.v.aufAbo(tn(1), ABO);
  u.v.aufAbo(tn(2, { rechnerId: 'C-id', appId: 'jm-rundown' }), ABO);
  const vorher = u.s.zeilen.length;
  u.v.meldeShow(PFAD, show());
  ck('Nr. 2 (E9): gleiche Show noch einmal gemeldet → keine neue Folge, keine aenderung',
    u.s.zeilen.length === vorher && u.v.stand().folge === 1);
  u.v.meldeShow(PFAD, show('COP31 Tag 1 neu'));
  const neu = u.s.zeilen.slice(vorher);
  ck('Nr. 3: geänderte Show → Folge + 1, aenderung an beide Abos',
    neu.length === 2 && neu.every((z) => lies(z.zeile).t === 'aenderung' && lies(z.zeile).s?.folge === 2)
    && JSON.stringify(neu.map((z) => z.sitzung).sort()) === '[1,2]');
  ck('Nr. 3: … dieselbe Zeichenkette an alle (einmal serialisiert)', neu[0].zeile === neu[1].zeile);
  ck('Nr. 3: … das Modal wird neu gemeldet', u.aenderungen() > 0);
}

// --- Nr. 4: Ausschnitt über 921 600 Byte → zu-gross; gemessen in Bytes der fertigen Zeile (Review Focus 1) -------------
{
  const u = umgebung();
  u.v.starte(u.s.server);
  u.v.aufAbo(tn(1), ABO);
  // 470 000 × „ä“: unter 921 600 Zeichen, aber über 921 600 Byte (UTF-8 je 2 Byte).
  const gross = show('Groß', { ablauf: [{ id: 'a1', label: 'ä'.repeat(470_000) }] });
  u.v.meldeShow(PFAD, gross);
  const z = an(u.s.zeilen, 1).at(-1)!;
  ck('Nr. 4: zu groß in Bytes (nicht in Zeichen) → show null, grund zu-gross, Schlüssel und mitDokument bleiben',
    JSON.stringify(gross).length < GRENZEN.maxStandZeile && z.t === 'aenderung' && z.s?.show === null && z.s.grund === 'zu-gross'
    && z.s.schluessel === verbundSchluessel(PFAD) && JSON.stringify(z.s.mitDokument) === '["jm-rundown"]');
  const warnung = u.log.find((l) => l.startsWith('warn: Verbund: Show zu groß'));
  const kib = Number(/\((\d+) KiB > 900 KiB\)/.exec(warnung ?? '')?.[1]);
  ck(`Nr. 4: … Warnung wörtlich 15.6 mit KiB (${kib} KiB)`,
    /^warn: Verbund: Show zu groß für den Verbund \(\d+ KiB > 900 KiB\), nicht verteilt\.$/.test(warnung ?? '') && kib > 900 && kib < 1000);
  ck('Nr. 4: … das Modal kennt Name und Größe', u.v.stand().grund === 'zu-gross' && u.v.stand().showName === 'Groß' && u.v.stand().groesseKiB === kib);
  u.v.meldeShow(PFAD, show('Klein', { ablauf: [{ id: 'a1', label: 'a'.repeat(470_000) }] }));
  const z2 = an(u.s.zeilen, 1).at(-1)!;
  ck('Nr. 4: Gegenprobe: 470 000 × „a“ (1 Byte) wird verteilt', z2.s?.show !== null && z2.s?.grund === undefined && z2.s?.folge === 2);
}

// --- Nr. 5: neue Epoche bei Neustart der Rolle; meldeShow vor starte() gemerkt; ohne Show keine-show ------------------
{
  const u = umgebung();
  u.v.starte(u.s.server);
  u.v.aufAbo(tn(1), ABO);
  const z = an(u.s.zeilen, 1)[0];
  ck('Nr. 5: ohne Show → stand mit show null, grund keine-show, schluessel null, mitDokument []',
    z.s?.show === null && z.s.grund === 'keine-show' && z.s.schluessel === null && z.s.mitDokument.length === 0);
  u.v.stoppe();
  u.v.meldeShow(PFAD, show());
  const nachStopp = u.s.zeilen.length;
  u.v.aufAbo(tn(1), ABO);
  ck('Nr. 5: nach stoppe() geht nichts mehr hinaus, auch nicht auf ein Abo', u.s.zeilen.length === nachStopp && !u.v.hatAbo(1));
  u.v.starte(u.s.server);
  u.v.aufAbo(tn(7), ABO);
  const z2 = an(u.s.zeilen, 7)[0];
  ck('Nr. 5: neuer Start → neue Epoche, Folge 0, die vorher gemeldete Show wird verteilt',
    z2.s?.epoche === 'epoche-2' && z2.s.folge === 0 && (z2.s.show as Show | null)?.name === 'COP31 Tag 1');
  ck('Nr. 5: … die Abos der alten Epoche sind weg', !u.v.hatAbo(1) && u.v.hatAbo(7));
}

// --- Nr. 6: launcher-Abo ignoriert; das 33. Abo eines Rechners; wiederholtes Abo -----------------------------------
{
  const u = umgebung();
  u.v.starte(u.s.server);
  u.v.meldeShow(PFAD, show());
  u.v.aufAbo(tn(1, { art: 'launcher', appId: 'jm-launcher' }), ABO);
  u.v.aufAbo(tn(1, { art: 'launcher', appId: 'jm-launcher' }), ABO);
  ck('Nr. 6: Abo eines Launchers → nichts gesendet, kein Abo, eine Logzeile (E13)',
    u.s.zeilen.length === 0 && !u.v.hatAbo(1)
    && u.log.filter((l) => l === 'info: Verbund: Abo von Regie-Laptop/jm-launcher ignoriert, ein Launcher braucht keine Show-Daten.').length === 1);
  for (let i = 10; i < 10 + GRENZEN.maxAbosJeRechner; i++) u.v.aufAbo(tn(i, { appId: `jm-tool-${i}` }), ABO);
  ck('Nr. 6: 32 Abos von Rechner B → 32 Antworten', u.s.zeilen.length === 32 && u.v.stand().abos.length === 32);
  u.v.aufAbo(tn(99, { appId: 'jm-timer' }), ABO);
  u.v.aufAbo(tn(98, { appId: 'jm-titler' }), ABO);
  ck('Nr. 6: das 33. und 34. Abo desselben Rechners → unbeantwortet, eine Warnung je Rechner',
    u.s.zeilen.length === 32 && !u.v.hatAbo(99)
    && u.log.filter((l) => l === 'warn: Verbund: Regie-Laptop hat 32 Abos, weitere werden nicht beantwortet.').length === 1);
  u.v.aufAbo(tn(200, { rechnerId: 'C-id', appId: 'jm-timer' }), ABO);
  ck('Nr. 6: ein anderer Rechner wird weiter beantwortet', u.s.zeilen.length === 33 && u.v.hatAbo(200));
  u.v.aufGetrennt(10);
  u.v.aufAbo(tn(99, { appId: 'jm-timer' }), ABO);
  ck('Nr. 6: nach dem Ende eines Abos wird ein wiederholtes Abo beantwortet', u.v.hatAbo(99) && an(u.s.zeilen, 99).length === 1);
  u.v.aufAbo(tn(99, { appId: 'jm-timer' }), ABO);
  ck('Nr. 6: zweites Abo derselben Sitzung → erneut stand mit dem aktuellen Stand, kein zweites Abo',
    an(u.s.zeilen, 99).length === 2 && an(u.s.zeilen, 99)[1].t === 'stand' && u.v.stand().abos.length === 33);
  ck('Nr. 6: neues Abo: Logzeile wörtlich 15.6', u.log.includes('info: Verbund: Abo von Studio-PC/jm-timer (33 Abos).'));
}

// --- Nr. 7: gestaut → nach entstaut nur der neueste Stand ----------------------------------------------------------
{
  const u = umgebung();
  u.v.starte(u.s.server);
  u.v.meldeShow(PFAD, show());
  u.s.modus.set(5, 'gestaut');
  u.v.aufAbo(tn(5), ABO);
  ck('Nr. 7: Stau beim stand → nichts geschrieben, eine Logzeile wörtlich 15.6',
    u.s.zeilen.length === 0 && u.log.includes('warn: Verbund: Sendung an Regie-Laptop/jm-timer gestaut, der neueste Stand folgt danach.'));
  u.v.meldeShow(PFAD, show('Zwei'));
  u.v.meldeShow(PFAD, show('Drei'));
  ck('Nr. 7: … weitere Stände gehen an eine gestaute Sitzung nicht hinaus, keine zweite Stau-Zeile',
    u.s.zeilen.length === 0 && u.log.filter((l) => l.includes('gestaut')).length === 1);
  u.s.modus.delete(5);
  u.v.aufEntstaut(5);
  const nach = an(u.s.zeilen, 5);
  ck('Nr. 7: entstaut → genau eine Zeile, aenderung mit dem neuesten Stand (Folge 3)',
    nach.length === 1 && nach[0].t === 'aenderung' && nach[0].s?.folge === 3 && (nach[0].s?.show as Show | null)?.name === 'Drei');
  u.v.aufEntstaut(5);
  ck('Nr. 7: noch einmal entstaut, nichts Neueres → nichts', an(u.s.zeilen, 5).length === 1);
  u.s.modus.set(5, 'weg');
  u.v.meldeShow(PFAD, show('Vier'));
  ck('Nr. 7: Antwort weg → das Abo ist entfernt', !u.v.hatAbo(5));
}

// --- Nr. 8: Kein Token in einer gesendeten Zeile (Spec 22) ---------------------------------------------------------
{
  const TOKEN = 'iveo_live_geheimes_token_4711';
  const PIN = 'PIN-geheim-0815';
  // Nachgebauter Token-Speicher des Launchers (settings.ts braucht Electron und wird hier nie geladen).
  const tokenSpeicher = new Map<string, string>([['cop31', TOKEN]]);
  const u = umgebung();
  u.v.starte(u.s.server);
  u.v.aufAbo(tn(1), ABO);
  u.v.meldeShow(PFAD, migrateShow({
    schemaVersion: 1,
    name: 'Mit Geheimnissen',
    tools: [
      { appId: 'jm-presenter', settings: { pin: PIN } },
      { appId: 'jm-timer', settings: { durationMs: 1000, zugang: tokenSpeicher.get('cop31') } },
    ],
    iveo: { event: 'cop31', baseUrl: `https://iveo.example/api/v1?token=${tokenSpeicher.get('cop31')}`, name: 'COP31' },
  }));
  u.v.aufAbo(tn(1), ABO);
  const alle = u.s.zeilen.map((z) => z.zeile).join('');
  ck('Nr. 8: Token (Speicher, unbekanntes Setting, baseUrl) und Presenter-PIN stehen in keiner gesendeten Zeile',
    u.s.zeilen.length === 3 && !alle.includes(TOKEN) && !alle.includes(PIN) && alle.includes('Mit Geheimnissen'));
  ck('Nr. 8: … und in keiner Logzeile', !u.log.join('\n').includes(TOKEN) && !u.log.join('\n').includes(PIN));
}

// --- Nr. 9: Abos hängen an der Sitzung, nicht am Teilnehmer-Schlüssel ----------------------------------------------
{
  const u = umgebung();
  u.v.starte(u.s.server);
  u.v.meldeShow(PFAD, show());
  u.v.aufAbo(tn(1), ABO);
  u.v.aufAbo(tn(2), ABO); // dasselbe Tool (gleicher Schlüssel) hat sich schnell neu angemeldet
  u.v.aufGetrennt(1); // das späte Ende der ersetzten Sitzung
  u.v.meldeShow(PFAD, show('Neu'));
  ck('Nr. 9: getrennt der ersetzten Sitzung löscht nicht das Abo der neuen; die aenderung kommt dort an',
    u.v.hatAbo(2) && !u.v.hatAbo(1) && an(u.s.zeilen, 2).at(-1)?.t === 'aenderung' && an(u.s.zeilen, 1).length === 1);
}

// --- Weitere Regeln aus 13.1, 15.1, 15.6 ----------------------------------------------------------------------------
{
  const u = umgebung();
  u.v.starte(u.s.server);
  u.v.meldeShow(PFAD, show());
  ck('15.6: neuer Stand → Logzeile wörtlich mit „Lokal geblieben“',
    /^info: Verbund: Show „COP31 Tag 1“ verteilt \(Stand 1, \d+ KiB, 0 Abos\)\. Lokal geblieben: jm-recorder\.dir\.$/.test(u.log.at(-1) ?? ''));
  u.v.aufAbo(tn(1), ABO);
  u.v.meldeShow(PFAD, migrateShow({ schemaVersion: 1, name: 'Schlicht', tools: [] }));
  ck('15.6: … ohne lokale Einstellungen „Lokal geblieben: nichts.“, k = Zahl der Abos',
    /^info: Verbund: Show „Schlicht“ verteilt \(Stand 2, 1 KiB, 1 Abos\)\. Lokal geblieben: nichts\.$/.test(u.log.at(-1) ?? ''));
  u.v.meldeShow(PFAD, null);
  const z = an(u.s.zeilen, 1).at(-1)!;
  ck('15.1: gespeicherte Show nicht lesbar → grund nicht-lesbar, Schlüssel der offenen Show, mitDokument []',
    z.t === 'aenderung' && z.s?.show === null && z.s.grund === 'nicht-lesbar' && z.s.schluessel === verbundSchluessel(PFAD) && z.s.mitDokument.length === 0);
  ck('15.6: … Logzeile wörtlich mit dem Dateinamen; das Modal kennt ihn',
    u.log.at(-1) === 'warn: Verbund: Show „COP31 Tag 1.jmshow“ nicht lesbar, nicht verteilt.' && u.v.stand().dateiName === 'COP31 Tag 1.jmshow');
  u.v.meldeShow(ANDERER_PFAD, show());
  const z2 = an(u.s.zeilen, 1).at(-1)!;
  ck('13.1: andere Datei mit gleichem Inhalt → anderer Schlüssel, neuer Stand', z2.s?.schluessel === verbundSchluessel(ANDERER_PFAD) && z2.s.folge === 4);
  ck('Stand fürs Modal: Name, Zeit, Folge, Epoche, Abos',
    JSON.stringify(u.v.stand()) === JSON.stringify({
      grund: null, showName: 'COP31 Tag 1', dateiName: 'COP31 Tag 2.jmshow', verteiltAm: Date.parse('2026-10-08T10:15:00.000Z'),
      groesseKiB: 1, epoche: 'epoche-1', folge: 4, abos: [{ sitzung: 1, rechnerId: 'B-id', appId: 'jm-timer' }],
    }));
}
{
  const u = umgebung();
  u.v.starte(u.s.server);
  u.v.aufAbo(tn(1, { rechnerId: 'A-id', dieserRechner: true }), ABO);
  u.v.aufAbo(tn(2), ABO);
  u.v.aufAbo(tn(3, { rechnerId: 'C-id' }), ABO);
  ck('E29: ein Abo von diesem Rechner wird bedient wie jedes andere', an(u.s.zeilen, 1).length === 1 && u.v.hatAbo(1));
  ck('abosAndererRechner zählt nur Abos fremder Rechner', u.v.abosAndererRechner() === 2);
  u.v.stoppe();
  ck('stoppe → keine Abos mehr, Stand leer', u.v.abosAndererRechner() === 0 && u.v.stand().epoche === null && u.v.stand().abos.length === 0);
}
{
  const roh = 'C:\\Shows\\..\\Shows\\Gala.JMSHOW';
  ck('verbundSchluessel = Gedächtnis-Schlüssel des Rundowns für denselben Pfad (2a-Spec 4.7), 16 Hex',
    verbundSchluessel(roh) === gedaechtnisSchluessel(roh) && /^[0-9a-f]{16}$/.test(verbundSchluessel(roh)));
  ck('verbundSchluessel: Formel sha256(resolve(p).toLowerCase())',
    verbundSchluessel('C:/Shows/Gala.jmshow') === createHash('sha256').update(resolve('C:/Shows/Gala.jmshow').toLowerCase()).digest('hex').slice(0, 16));
  ck('verbundSchluessel: aufloesen ist einsetzbar', verbundSchluessel('x', (p) => `/fest/${p}`) === createHash('sha256').update('/fest/x').digest('hex').slice(0, 16));
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
```

Der Test nutzt `gedaechtnisSchluessel` aus dem Rundown (`apps/rundown/src/main/gedaechtnis.ts`, ohne Electron) als Gegenprobe der Formel; `tsx` lädt es über die relativen Importe, `@jm/show` kommt aus dem Workspace.

- [ ] **Step 2: Testlauf anhängen** (`apps/launcher/package.json:19`)

Vorher:
```json
    "selftest:verbund": "tsx test/verbund.test.ts",
```
Nachher:
```json
    "selftest:verbund": "tsx test/verbund.test.ts && tsx test/verteiler.test.ts",
```

- [ ] **Step 3: Tests laufen lassen (rot)**

```
npm run selftest:verbund -w @jm/launcher
```
Erwartet: `verbund.test.ts` wie bisher `188 ok, 0 fehlgeschlagen.`, danach bricht `verteiler.test.ts` beim Laden ab, Exitcode 1:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\launcher\src\main\verbund\verteiler' imported from …\apps\launcher\test\verteiler.test.ts
```

- [ ] **Step 4: Verteiler anlegen** (Create `apps/launcher/src/main/verbund/verteiler.ts`)

```ts
import { createHash, randomUUID } from 'node:crypto';
import { basename, resolve } from 'node:path';
import {
  antwortFassung, GRENZEN, kodiereStand, kuerzeName, SHOW_FASSUNG, zeilenBytes,
  type AboInhalt, type DatenGrund, type SendeErgebnis, type StandInhalt, type TeilnehmerDaten,
} from '@jm/master-link';
import { showFuerVerbund, type Show } from '@jm/show';

// Verteiler der Show-Daten am Master (Master-Link Teil 2b, Release 2, Spec 13.1–13.4, 13.6, 15.1, 15.2, 15.6) — OHNE
// Electron, per tsx getestet (test/verteiler.test.ts). Quelle ist die offene Show des Launchers, wie sie in der Datei
// steht (der iveo-Kern meldet sie über meldeShow). Die MasterRolle reicht die Server-Ereignisse daten/getrennt/entstaut
// herein und startet bzw. stoppt ihn mit der Rolle (neue Epoche je Start). Er schreibt nie zurück und liest nie ein Token.

/** Was der Verteiler vom Server braucht: Senden an eine Sitzung (Rückdruck: 'gestaut', Sitzung zu: 'weg'). */
export interface VerteilerServer {
  sendeDaten(sitzung: number, zeile: string): SendeErgebnis;
}

export interface VerteilerAbhaengigkeiten {
  log(stufe: 'info' | 'warn', text: string): void;
  /** Anzeigename eines gekoppelten Rechners für die Logzeilen. */
  rechnerName(rechnerId: string): string;
  /** Vorgabe crypto.randomUUID (Spec 13.3). */
  neueEpoche?: () => string;
  /** Vorgabe path.resolve (Schlüssel der Show, 2a-Spec 4.7). */
  aufloesen?: (p: string) => string;
  /** Vorgabe Date.now — nur für die Anzeige „Stand hh:mm“ im Verbund-Modal am Master. */
  jetzt?: () => number;
  /** Abos oder Stand geändert: das Verbund-Modal neu melden. */
  beiAenderung?: () => void;
}

/** Stand fürs Verbund-Modal (Spec 15.5). Alles null, solange der Verteiler nicht läuft. */
export interface VerteilerStand {
  grund: DatenGrund | null;
  showName: string | null;
  dateiName: string | null;
  verteiltAm: number | null;
  groesseKiB: number | null;
  epoche: string | null;
  folge: number | null;
  abos: { sitzung: number; rechnerId: string; appId: string }[];
}

/**
 * Schlüssel der Show am Master (Spec 13.1): die ersten 16 Hex-Zeichen von SHA-256 über den mit `path.resolve`
 * normalisierten, kleingeschriebenen Pfad. Dieselbe Formel wie der Gedächtnis-Schlüssel des Rundowns (2a-Spec 4.7).
 */
export function verbundSchluessel(pfad: string, aufloesen: (p: string) => string = resolve): string {
  return createHash('sha256').update(aufloesen(pfad).toLowerCase()).digest('hex').slice(0, 16);
}

/** Inhalt eines Stands ohne Fassung, Epoche und Folge. */
interface Inhalt {
  schluessel: string | null;
  show: Show | null;
  grund?: DatenGrund;
  mitDokument: string[];
}

interface Aktuell {
  inhalt: Inhalt;
  folge: number;
  /** Serialisierte Form von schluessel, show, grund, mitDokument (Spec 13.3). */
  vergleich: string;
  /** Fertige Zeilen je `t:fassung`: einmal serialisiert, an alle Abos dieselbe Zeichenkette (Spec 13.6). */
  zeilen: Map<string, string>;
  verteiltAm: number;
  showName: string | null;
  dateiName: string | null;
  groesseKiB: number | null;
}

interface Abo {
  sitzung: number;
  rechnerId: string;
  appId: string;
  dieserRechner: boolean;
  fassung: number;
  /** Epoche und Folge des zuletzt an diese Sitzung gesendeten Stands (Spec 15.2). */
  gesendet: { epoche: string; folge: number } | null;
  gestaut: boolean;
}

export class Verteiler {
  private readonly d: VerteilerAbhaengigkeiten;
  private server: VerteilerServer | null = null;
  private epoche: string | null = null;
  private aktuell: Aktuell | null = null;
  /** Die zuletzt gemeldete offene Show — auch ohne laufende Rolle gemerkt (Start der Rolle verteilt sie). */
  private quelle: { pfad: string; show: Show | null } | null = null;
  private readonly abos = new Map<number, Abo>();
  /** Sitzungen eines Launchers, deren ignoriertes Abo schon im Log steht (E13: einmal je Sitzung). */
  private readonly launcherGeloggt = new Set<number>();
  /** Rechner, deren Abo-Grenze schon im Log steht (Spec 15.6: einmal je Rechner, bis wieder Platz ist). */
  private readonly grenzeGeloggt = new Set<string>();

  constructor(d: VerteilerAbhaengigkeiten) {
    this.d = d;
  }

  /** Start der Rolle Master: neue Epoche, Abos leer, Stand aus der gemerkten Show (sonst keine-show). */
  starte(server: VerteilerServer): void {
    this.server = server;
    this.epoche = (this.d.neueEpoche ?? randomUUID)();
    this.aktuell = null;
    this.leere();
    this.aktualisiere();
  }

  /** Ende der Rolle: Abos leer, es geht nichts mehr hinaus. Die gemeldete Show bleibt gemerkt. */
  stoppe(): void {
    this.server = null;
    this.epoche = null;
    this.aktuell = null;
    this.leere();
  }

  /** Spec 15.1: die offene Show, wie sie in der Datei steht; null = gespeichert und nicht lesbar. */
  meldeShow(pfad: string, show: Show | null): void {
    this.quelle = { pfad, show };
    this.aktualisiere();
  }

  /** Spec 15.2: Abo einer angemeldeten Sitzung (Ereignis `daten` des Servers, Inhalt schon mit pruefeAbo geprüft). */
  aufAbo(t: TeilnehmerDaten, abo: AboInhalt): void {
    if (!this.server || !this.aktuell) return;
    if (t.art === 'launcher') {
      if (!this.launcherGeloggt.has(t.sitzung)) {
        this.launcherGeloggt.add(t.sitzung);
        this.d.log('info', `Verbund: Abo von ${this.wer(t)} ignoriert, ein Launcher braucht keine Show-Daten.`);
      }
      return;
    }
    let a = this.abos.get(t.sitzung);
    if (a) {
      // Wiederholtes Abo derselben Sitzung (13.3): erneut den aktuellen Stand.
      a.fassung = antwortFassung(abo.fassung);
    } else {
      if (this.abosVon(t.rechnerId) >= GRENZEN.maxAbosJeRechner) {
        if (!this.grenzeGeloggt.has(t.rechnerId)) {
          this.grenzeGeloggt.add(t.rechnerId);
          this.d.log('warn', `Verbund: ${this.d.rechnerName(t.rechnerId)} hat ${GRENZEN.maxAbosJeRechner} Abos, weitere werden nicht beantwortet.`);
        }
        return;
      }
      a = {
        sitzung: t.sitzung, rechnerId: t.rechnerId, appId: t.appId, dieserRechner: t.dieserRechner,
        fassung: antwortFassung(abo.fassung), gesendet: null, gestaut: false,
      };
      this.abos.set(t.sitzung, a);
      this.d.log('info', `Verbund: Abo von ${this.wer(t)} (${this.abos.size} Abos).`);
      this.d.beiAenderung?.();
    }
    this.sendeAn(a, 'stand');
  }

  /** Spec 13.6/15.2: Ende einer Sitzung (genau einmal je Sitzung) — trifft nur deren eigenes Abo. */
  aufGetrennt(sitzung: number): void {
    this.launcherGeloggt.delete(sitzung);
    const a = this.abos.get(sitzung);
    if (!a) return;
    this.abos.delete(sitzung);
    if (this.abosVon(a.rechnerId) < GRENZEN.maxAbosJeRechner) this.grenzeGeloggt.delete(a.rechnerId);
    this.d.beiAenderung?.();
  }

  /** E5: Nach dem Stau den neuesten Stand als aenderung, wenn er neuer ist als der zuletzt an diese Sitzung gesendete. */
  aufEntstaut(sitzung: number): void {
    const a = this.abos.get(sitzung);
    const s = this.aktuell;
    if (!a || !s || this.epoche === null) return;
    a.gestaut = false;
    const neuer = a.gesendet === null || a.gesendet.epoche !== this.epoche || a.gesendet.folge < s.folge;
    if (neuer) this.sendeAn(a, 'aenderung');
  }

  hatAbo(sitzung: number): boolean {
    return this.abos.has(sitzung);
  }

  /** k der RELOAD-Logzeile (Spec 15.6): Abos von Tools anderer Rechner. */
  abosAndererRechner(): number {
    let k = 0;
    for (const a of this.abos.values()) if (!a.dieserRechner) k++;
    return k;
  }

  stand(): VerteilerStand {
    const s = this.aktuell;
    return {
      grund: s?.inhalt.grund ?? null,
      showName: s?.showName ?? null,
      dateiName: s?.dateiName ?? null,
      verteiltAm: s?.verteiltAm ?? null,
      groesseKiB: s?.groesseKiB ?? null,
      epoche: this.epoche,
      folge: s?.folge ?? null,
      abos: [...this.abos.values()].map((a) => ({ sitzung: a.sitzung, rechnerId: a.rechnerId, appId: a.appId })),
    };
  }

  private leere(): void {
    this.abos.clear();
    this.launcherGeloggt.clear();
    this.grenzeGeloggt.clear();
  }

  private wer(t: { rechnerId: string; appId: string }): string {
    return `${this.d.rechnerName(t.rechnerId)}/${t.appId}`;
  }

  private abosVon(rechnerId: string): number {
    let n = 0;
    for (const a of this.abos.values()) if (a.rechnerId === rechnerId) n++;
    return n;
  }

  /** Spec 13.3: neuer Stand nur, wenn sich schluessel, show, grund oder mitDokument unterscheiden; dann an alle Abos. */
  private aktualisiere(): void {
    if (!this.server || this.epoche === null) return;
    const folge = this.aktuell ? this.aktuell.folge + 1 : 0;
    const n = this.bilde(folge);
    if (this.aktuell && this.aktuell.vergleich === n.vergleich) return;
    this.aktuell = { ...n, folge, zeilen: new Map(), verteiltAm: (this.d.jetzt ?? Date.now)() };
    this.logNeuerStand(n.lokal);
    for (const a of this.abos.values()) {
      // Eine gestaute Sitzung bekommt nach entstaut den neuesten Stand (E5), nicht jeden Zwischenstand.
      if (!a.gestaut) this.sendeAn(a, 'aenderung');
    }
    this.d.beiAenderung?.();
  }

  private bilde(folge: number): Omit<Aktuell, 'folge' | 'zeilen' | 'verteiltAm'> & { lokal: string[] } {
    const q = this.quelle;
    const fertig = (inhalt: Inhalt, x: { showName?: string | null; dateiName?: string | null; groesseKiB?: number | null; lokal?: string[] } = {}) => ({
      inhalt,
      vergleich: JSON.stringify([inhalt.schluessel, inhalt.show, inhalt.grund ?? null, inhalt.mitDokument]),
      showName: x.showName ?? null,
      dateiName: x.dateiName ?? null,
      groesseKiB: x.groesseKiB ?? null,
      lokal: x.lokal ?? [],
    });
    if (!q) return fertig({ schluessel: null, show: null, grund: 'keine-show', mitDokument: [] });
    const schluessel = verbundSchluessel(q.pfad, this.d.aufloesen);
    const dateiName = kuerzeName(basename(q.pfad));
    if (!q.show) return fertig({ schluessel, show: null, grund: 'nicht-lesbar', mitDokument: [] }, { dateiName });
    const a = showFuerVerbund(q.show);
    const showName = kuerzeName(a.show.name);
    const voll: Inhalt = { schluessel, show: a.show, mitDokument: a.mitDokument };
    // Spec 13.4: gemessen in UTF-8-Bytes der fertigen aenderung-Zeile mit '\n' (die stand-Zeile ist 4 Byte kürzer).
    const bytes = zeilenBytes(kodiereStand('aenderung', this.standInhalt(voll, folge, SHOW_FASSUNG)));
    const groesseKiB = Math.ceil(bytes / 1024);
    if (bytes > GRENZEN.maxStandZeile) {
      return fertig({ schluessel, show: null, grund: 'zu-gross', mitDokument: a.mitDokument }, { showName, dateiName, groesseKiB });
    }
    return fertig(voll, { showName, dateiName, groesseKiB, lokal: a.lokalGeblieben });
  }

  private standInhalt(i: Inhalt, folge: number, fassung: number): StandInhalt {
    return {
      art: 'show',
      fassung,
      epoche: this.epoche ?? '',
      folge,
      schluessel: i.schluessel,
      show: i.show as unknown as Record<string, unknown> | null,
      ...(i.grund ? { grund: i.grund } : {}),
      mitDokument: i.mitDokument,
    };
  }

  private logNeuerStand(lokal: string[]): void {
    const s = this.aktuell!;
    if (s.inhalt.grund === 'zu-gross') {
      this.d.log('warn', `Verbund: Show zu groß für den Verbund (${s.groesseKiB} KiB > 900 KiB), nicht verteilt.`);
    } else if (s.inhalt.grund === 'nicht-lesbar') {
      this.d.log('warn', `Verbund: Show „${s.dateiName}“ nicht lesbar, nicht verteilt.`);
    } else if (s.inhalt.show) {
      this.d.log('info', `Verbund: Show „${s.showName}“ verteilt (Stand ${s.folge}, ${s.groesseKiB} KiB, ${this.abos.size} Abos). `
        + `Lokal geblieben: ${lokal.length ? lokal.join(', ') : 'nichts'}.`);
    }
  }

  /** Fertige Zeile je Typ und Fassung, einmal serialisiert. */
  private zeile(t: 'stand' | 'aenderung', fassung: number): string {
    const s = this.aktuell!;
    const k = `${t}:${fassung}`;
    let z = s.zeilen.get(k);
    if (z === undefined) {
      z = kodiereStand(t, this.standInhalt(s.inhalt, s.folge, fassung));
      s.zeilen.set(k, z);
    }
    return z;
  }

  private sendeAn(a: Abo, t: 'stand' | 'aenderung'): void {
    const s = this.aktuell;
    const server = this.server;
    if (!s || !server || this.epoche === null) return;
    const r = server.sendeDaten(a.sitzung, this.zeile(t, a.fassung));
    if (r === 'gesendet') {
      a.gesendet = { epoche: this.epoche, folge: s.folge };
      a.gestaut = false;
    } else if (r === 'gestaut') {
      if (!a.gestaut) {
        a.gestaut = true;
        this.d.log('warn', `Verbund: Sendung an ${this.wer(a)} gestaut, der neueste Stand folgt danach.`);
      }
    } else {
      // Sitzung schon zu: Abo weg (ihr getrennt kommt ebenfalls und findet nichts mehr).
      this.abos.delete(a.sitzung);
      this.d.beiAenderung?.();
    }
  }
}
```

Hinweise zur Umsetzung:
- `aktualisiere()` misst die Kandidaten-Zeile mit der **nächsten** Folge (bei einem unveränderten Ausschnitt wird sie verworfen). Die `stand`-Zeile für ein neues Abo ist 4 Byte kürzer als die gemessene `aenderung`-Zeile.
- `zeile()` serialisiert je Stand und Typ einmal (`Map` je `t:fassung`); alle Abos bekommen dieselbe Zeichenkette (Nr. 3).
- `sendeAn()` entfernt das Abo bei `'weg'`; das spätere `getrennt` derselben Sitzung findet dann nichts mehr.

- [ ] **Step 5: Tests laufen lassen (grün)**

```
npm run selftest:verbund -w @jm/launcher
```
Erwartet: zwei Zusammenfassungen ohne Fehlschlag, Exitcode 0:
```
188 ok, 0 fehlgeschlagen.
44 ok, 0 fehlgeschlagen.
```
`verteiler.test.ts` allein dauert gemessen 1,1 bis 4 s (`npx tsx apps/launcher/test/verteiler.test.ts`; am 12.10.2026 1,1–1,3 s, N33). Die Prüfzeile „Nr. 4: … Warnung wörtlich 15.6 mit KiB“ trägt die gemessene Größe in Klammern (gemessen `919 KiB`).

- [ ] **Step 6: Gegenprobe Review Focus 1 (Bytes, nicht Zeichen)** — nur zur Kontrolle, nicht committen

In `apps/launcher/src/main/verbund/verteiler.ts` vorübergehend ersetzen, Vorher:
```ts
    const bytes = zeilenBytes(kodiereStand('aenderung', this.standInhalt(voll, folge, SHOW_FASSUNG)));
```
Nachher (absichtlich falsch: Zeichen statt Bytes):
```ts
    const bytes = kodiereStand('aenderung', this.standInhalt(voll, folge, SHOW_FASSUNG)).length;
```
```
npx tsx apps/launcher/test/verteiler.test.ts
```
Erwartet (gemessen), Exitcode 1:
```
FAIL  Nr. 4: zu groß in Bytes (nicht in Zeichen) → show null, grund zu-gross, Schlüssel und mitDokument bleiben
FAIL  Nr. 4: … Warnung wörtlich 15.6 mit KiB (NaN KiB)
FAIL  Nr. 4: … das Modal kennt Name und Größe
41 ok, 3 fehlgeschlagen.
```
Dann die Ersetzung zurücknehmen (Vorher/Nachher vertauscht) und erneut laufen lassen: `44 ok, 0 fehlgeschlagen.` Kontrolle, dass der richtige Stand zurück ist: `grep -c "const bytes = zeilenBytes(kodiereStand" apps/launcher/src/main/verbund/verteiler.ts` → `1`.

- [ ] **Step 7: Typecheck**

```
npm run typecheck -w @jm/launcher
```
Erwartet: Exitcode 0 (`verbund/verteiler.ts` liegt in `src/main` und wird von `tsconfig.node.json` geprüft).

- [ ] **Step 8: Commit** (Bash-Werkzeug)

```
git add apps/launcher/src/main/verbund/verteiler.ts apps/launcher/test/verteiler.test.ts apps/launcher/package.json
git status --short
```
Erwartet genau:
```
M  apps/launcher/package.json
A  apps/launcher/src/main/verbund/verteiler.ts
A  apps/launcher/test/verteiler.test.ts
```
Dann:
```
git commit -m "feat(launcher): Verteiler der Show-Daten am Master (Teil 2b R2)" -m "verbund/verteiler.ts ohne Electron nach Spec 13 und 15: Epoche je Start der Rolle, Folge nur bei geaendertem Ausschnitt (serialisierter Vergleich), stand auf jedes Abo, aenderung an alle Abos einmal serialisiert. Abos nach Sitzung, Launcher-Abos ignoriert, hoechstens 32 je Rechner, Stau mit neuestem Stand nach entstaut, ueber 900 KiB in Bytes der fertigen Zeile grund zu-gross, nicht lesbare Show grund nicht-lesbar. Logzeilen nach 15.6. test/verteiler.test.ts haengt an selftest:verbund (Spec 19.3 Nr. 1-9)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Keine an den Schnittstellen. Entscheidungen E35 und E39 (Größe und KiB, gestaute Abos beim Verteilen überspringen, `nicht-lesbar` mit `mitDokument = []`, Abo-Grenze erneut erst nach freiem Platz).
- Zählstände beim Durchspielen des ganzen Plans nachgemessen (mit C1–C4 aus diesem Plan): gleich.

---

### Task 9: C9 · Master-Verdrahtung, RELOAD nur an diesen Rechner, `neuAufsetzen` absichern

**Spec:** Abschnitte 15.1 (Hülle reicht `meldeShow` weiter; Start der Rolle = neue Epoche), 15.2 erster Punkt (MasterRolle reicht `daten`/`getrennt`/`entstaut` weiter und `sendeDaten` zurück, Server bleibt privat), 15.3 (RELOAD nur an diesen Rechner, auch beim Nachholen), 15.6 letzte Zeile (RELOAD-Logzeile), 19.3 „RELOAD-Merker“, 27 O3; Gliederung E7, E12, Vormerkung 9.

**Arbeitsverzeichnis:** wie C5. Voraussetzung: C4 (Block A: `istDieserRechner`, `eigeneAdressen`; Server-Ereignisse und `sendeDaten` aus C3), C6 und C8 sind committet.

**Dateien:**
- Modify: `apps/launcher/src/main/reload-nachholen.ts` (ganzer Merker, Ist `:11-32`; neu `waehleReloadZiele`)
- Modify: `apps/launcher/src/main/health.ts` — Importe (Ist `:19-20`), nach `endpointKey` (Ist `:53-55`), Nachholen (Ist `:76`), `sendControlCommand` (Ist `:188-205`)
- Modify: `apps/launcher/src/main/iveo-abgleich-kern.ts` — `KernAbhaengigkeiten` (hinter `meldeShow` aus C6), `benachrichtigeAlle` (Ist `:418-424`)
- Modify: `apps/launcher/src/main/verbund/master.ts` — Importe (Ist `:3-13`), `MasterAbhaengigkeiten` (Ist `:34-36`), `starteJetzt` (Ist `:189-190`, `:203-204`), `stoppe` (Ist `:392-394`), `neuAufsetzen` (Ist `:481-482`)
- Modify: `apps/launcher/src/main/verbund/kern.ts` — Importe (Ist `:11-12`), `VerbundKernDeps` (Ist `:40-42`), `neuerMaster` (Ist `:123-127`), Rückgabe (Ist `:440-444`)
- Modify: `apps/launcher/src/main/verbund/index.ts` — Importe und Kern (Ist `:3-22`), Dateiende (Ist `:100-102`)
- Modify: `apps/launcher/src/main/iveo-sync.ts` — Import (Ist `:53`), Kern-Abhängigkeiten (Ist `:439`, `:445-447`)
- Test: `apps/launcher/test/reload-nachholen.test.ts` (Import `:3`, neuer Block nach `:32`)
- Test: `apps/launcher/test/iveo-abgleich.test.ts` (`function umgebung` aus C6, Ende der Kern-Abhängigkeiten, neuer Block vor der Zusammenfassung)
- Test: `apps/launcher/test/verbund.test.ts` — Importe (Ist `:15`), Prüfung „neuAufsetzen mit Löschfehler“ (Ist `:440-452`), Prüfung „B5 … behält den Master-Namen“ (Ist `:991-992`), neue Blöcke nach `await ohneId.neuAufsetzen();` (Ist `:1138`)

**Interfaces:**
- Consumes: `istDieserRechner(host, eigeneAdressen, eigenerName?)`, `eigeneAdressen(ni)` (C4); `MasterLinkServer` Ereignisse `daten (t: TeilnehmerDaten, abo: AboInhalt)`, `getrennt (sitzung)`, `entstaut (sitzung)`, Methode `sendeDaten` (C3); `MasterLinkClient.sende` und Ereignis `daten` (C4, nur Tests); `KernAbhaengigkeiten.meldeShow?` (C6); `Verteiler` (C8).
- Produces (Register S-B):
  ```ts
  // apps/launcher/src/main/reload-nachholen.ts
  nachSenden(appId: string, zeile: string, erreicht: number, nurDieserRechner?: boolean): void;
  beiVerbindung(appId: string, aufDiesemRechner?: boolean): string | null;
  export function waehleReloadZiele<T extends { appId: string; host: string; verbunden: boolean }>(
    eintraege: readonly T[], appId: string, istHier: ((host: string) => boolean) | null): T[];
  // apps/launcher/src/main/health.ts
  export function sendControlCommand(appId: string, line: string, opt?: { nurDieserRechner?: boolean }): number;
  // apps/launcher/src/main/iveo-abgleich-kern.ts — KernAbhaengigkeiten
  verbundReload?(): { andereRechner: number } | null;   // null = Rolle nicht Master (Logzeile aus 2a)
  // apps/launcher/src/main/verbund/master.ts — MasterAbhaengigkeiten
  verteiler?: Pick<Verteiler, 'starte' | 'stoppe' | 'aufAbo' | 'aufGetrennt' | 'aufEntstaut' | 'hatAbo'>;
  // apps/launcher/src/main/verbund/kern.ts — VerbundKernDeps (an neuerMaster durchgereicht; `stand` liest C10)
  verteiler?: Pick<Verteiler, 'starte' | 'stoppe' | 'aufAbo' | 'aufGetrennt' | 'aufEntstaut' | 'hatAbo' | 'stand'>;
  // Rückgabe von erzeugeVerbundKern zusätzlich:
  rolle(): VerbundRolle;   // Rolle aus master-link.json (E12)
  // apps/launcher/src/main/verbund/index.ts
  export function meldeShowAnVerbund(pfad: string, show: Show | null): void;
  export function verbundReloadInfo(): { andereRechner: number } | null;   // null, wenn Rolle nicht master (E12)
  ```

**Regeln für diese Aufgabe:**
- Der Server bleibt privat in `MasterRolle` (kein Getter, keine Weitergabe); nach außen gehen nur die drei Ereignisse und `sendeDaten` über ein kleines Objekt `{ sendeDaten }`.
- E12: „Rolle Master läuft“ für den RELOAD-Filter heißt: Rolle in `master-link.json` ist `master` (`kern.rolle()`), nicht der Serverzustand.
- Vormerkung 9: `neuAufsetzen` wirkt nur im Zustand `daten-beschaedigt`; sonst Warnung und Rückkehr ohne Wurf. Zwei alte Prüfungen in `verbund.test.ts` bringen den Master deshalb erst in diesen Zustand (Gründe in Step 3).
- Die sechs alten Prüfungen in `reload-nachholen.test.ts` laufen unverändert (beide neuen Parameter sind optional).
- G15: `health.ts`, `verbund/index.ts` und die Verdrahtung in `iveo-sync.ts` sind Electron-Schicht; sie prüfen Typecheck, `electron-vite build` und der Durchgang C20.
- TDD, CRLF, Edit-Werkzeug wie C5. Nicht anfassen: G1.

---

- [ ] **Step 1: RELOAD-Merker-Tests** (`apps/launcher/test/reload-nachholen.test.ts`)

Ersetzung 1 (`:3`), Vorher:
```ts
import { erzeugeReloadMerker } from '../src/main/reload-nachholen';
```
Nachher:
```ts
import { erzeugeReloadMerker, waehleReloadZiele } from '../src/main/reload-nachholen';
```

Ersetzung 2 (`:31-32`), Vorher:
```ts
  ck('spaeter erreichtes RELOAD loescht den Merker', m.beiVerbindung('jm-rundown') === null);
}
```
Nachher:
```ts
  ck('spaeter erreichtes RELOAD loescht den Merker', m.beiVerbindung('jm-rundown') === null);
}
// Teil 2b R2, Spec 15.3 (O3): In der Rolle Master geht RELOAD nur an diesen Rechner, auch beim Nachholen.
{
  const m = erzeugeReloadMerker();
  m.nachSenden('jm-timer', 'TIMER RELOAD', 0, true);
  ck('15.3: Zeile nur fuer diesen Rechner, niemand erreicht -> Endpunkt eines fremden Rechners holt nicht nach', m.beiVerbindung('jm-timer', false) === null);
  ck('15.3: ... ohne Angabe des Rechners ebenso nicht', m.beiVerbindung('jm-timer') === null);
  ck('15.3: ... ein Endpunkt dieses Rechners holt nach, genau einmal',
    m.beiVerbindung('jm-timer', true) === 'TIMER RELOAD' && m.beiVerbindung('jm-timer', true) === null);
}
{
  const m = erzeugeReloadMerker();
  m.nachSenden('jm-timer', 'TIMER RELOAD', 0);
  ck('15.3: ohne nurDieserRechner wie bisher: auch ein fremder Rechner holt nach', m.beiVerbindung('jm-timer', false) === 'TIMER RELOAD');
}
{
  const eintraege = [
    { appId: 'jm-timer', host: '127.0.0.1', verbunden: true, n: 1 },
    { appId: 'jm-timer', host: '10.0.0.7', verbunden: true, n: 2 },
    { appId: 'jm-timer', host: '10.0.0.5', verbunden: false, n: 3 },
    { appId: 'jm-titler', host: '127.0.0.1', verbunden: true, n: 4 },
  ];
  const hier = (host: string): boolean => host === '127.0.0.1';
  ck('waehleReloadZiele: mit istHier nur verbundene Endpunkte der appId auf diesem Rechner',
    waehleReloadZiele(eintraege, 'jm-timer', hier).map((e) => e.n).join(',') === '1');
  ck('waehleReloadZiele: mit null alle verbundenen der appId (wie bisher)',
    waehleReloadZiele(eintraege, 'jm-timer', null).map((e) => e.n).join(',') === '1,2');
}
```
(Die Datei ist bewusst ohne Umlaute geschrieben wie bisher.)

- [ ] **Step 2: Kern-Test für die RELOAD-Logzeile** (`apps/launcher/test/iveo-abgleich.test.ts`)

Ersetzung 1 (Signatur aus C6), Vorher:
```ts
function umgebung(baue: (iv: NachgebautesIveo) => Show, opt: { ohneToken?: boolean; melde?: boolean; schreibZeit?: string } = {}): Umgebung {
```
Nachher:
```ts
function umgebung(
  baue: (iv: NachgebautesIveo) => Show,
  opt: { ohneToken?: boolean; melde?: boolean; schreibZeit?: string; verbundReload?: () => { andereRechner: number } | null } = {},
): Umgebung {
```

Ersetzung 2 (Ende der Kern-Abhängigkeiten aus C6), Vorher:
```ts
            u.gemeldet.push({ pfad, show });
          },
        }
      : {}),
  });
```
Nachher:
```ts
            u.gemeldet.push({ pfad, show });
          },
        }
      : {}),
    ...(opt.verbundReload ? { verbundReload: opt.verbundReload } : {}),
  });
```

Ersetzung 3 (hinter dem C7-Block, vor der Zusammenfassung), Vorher:
```ts
    st?.ok === false && st.text === `${TEXT_SPEAKER_VERALTET}; ${TEXT_SELISTE}` && st.seit === MERKER);
}

// --- Zusammenfassung ---
```
Nachher:
```ts
    st?.ok === false && st.text === `${TEXT_SPEAKER_VERALTET}; ${TEXT_SELISTE}` && st.seit === MERKER);
}

// --- Teil 2b R2, Spec 15.3/15.6 (E12): RELOAD-Logzeile in der Rolle Master -------------------------------------------
{
  const u = listeMitAenderung({ verbundReload: () => ({ andereRechner: 2 }) });
  await u.kern.abfrage();
  ck('R2 15.6: Rolle Master → RELOAD-Logzeile wörtlich mit den Tools anderer Rechner',
    u.reloads.length === 3
    && u.info.includes('iveo: RELOAD → 1 Timer, 1 Titler, 1 Rundown auf diesem Rechner; 2 Tools anderer Rechner bekommen die Daten über den Verbund.'));
}
{
  const u = listeMitAenderung({ verbundReload: () => null });
  await u.kern.abfrage();
  ck('R2 15.6: Rolle nicht Master (null) → die Logzeile aus 2a', u.info.includes('iveo: RELOAD → 1 Timer, 1 Titler, 1 Rundown benachrichtigt.'));
}
{
  const u = listeMitAenderung({ verbundReload: () => { throw new Error('kaputt'); } });
  await u.kern.abfrage();
  ck('R2 15.6: verbundReload wirft → RELOAD trotzdem hinaus, die Logzeile aus 2a',
    u.reloads.length === 3 && u.info.includes('iveo: RELOAD → 1 Timer, 1 Titler, 1 Rundown benachrichtigt.'));
}

// --- Zusammenfassung ---
```

- [ ] **Step 3: Verbund-Tests** (`apps/launcher/test/verbund.test.ts`)

Ersetzung 1 (Ist `:15`), Vorher:
```ts
import { erzeugeVerbundKern, type VerbundKernDeps } from '../src/main/verbund/kern';
```
Nachher:
```ts
import { migrateShow } from '@jm/show';
import { erzeugeVerbundKern, type VerbundKernDeps } from '../src/main/verbund/kern';
import { Verteiler } from '../src/main/verbund/verteiler';
```

Ersetzung 2 (Ist `:440-452`). Grund: Die Prüfung rief `neuAufsetzen` auf einer nie gestarteten Rolle; das lehnt der Master ab jetzt ab (Vormerkung 9). Sie bringt ihn deshalb erst in „daten-beschaedigt“ (Identität samt `.bak` kaputt) und macht danach wie bisher `identitaet.json` zum Ordner. Vorher:
```ts
  // neuAufsetzen: Löschen scheitert (hier echt: identitaet.json ist ein Ordner → rmSync wirft) → trotzdem starten, dann ablehnen.
  const pN = await freierPort();
  const N = rechner('master', 'Neu-PC');
  mkdirSync(N.speicherDir, { recursive: true });
  const idN = join(N.speicherDir, 'identitaet.json');
  mkdirSync(idN);
  const mN = neuerMaster(N, pN);
  let abgelehntN = false;
  try { await mN.neuAufsetzen(); } catch { abgelehntN = true; }
  ck('neuAufsetzen mit Löschfehler → lehnt ab, der Master steht ehrlich im Fehlerzustand (nicht „startet“/„läuft“)',
    abgelehntN && mN.stand().zustand === 'lausch-fehler' && mN.stand().fehlerCode === 'EISDIR');
  rmSync(idN, { recursive: true });
  await bis(() => mN.stand().zustand === 'laeuft', 5000);
```
Nachher:
```ts
  // neuAufsetzen: Löschen scheitert (hier echt: identitaet.json ist ein Ordner → rmSync wirft) → trotzdem starten, dann ablehnen.
  // Teil 2b R2 (Vormerkung 9): „Verbund neu aufsetzen“ gibt es nur bei beschädigten Verbunddaten — erst dorthin.
  const pN = await freierPort();
  const N = rechner('master', 'Neu-PC');
  mkdirSync(N.speicherDir, { recursive: true });
  const idN = join(N.speicherDir, 'identitaet.json');
  writeFileSync(idN, 'Müll');
  writeFileSync(`${idN}.bak`, 'Müll');
  const mN = neuerMaster(N, pN);
  await mN.starte();
  rmSync(idN);
  mkdirSync(idN);
  let abgelehntN = false;
  try { await mN.neuAufsetzen(); } catch { abgelehntN = true; }
  ck('neuAufsetzen mit Löschfehler → lehnt ab, der Master steht ehrlich im Fehlerzustand (nicht „startet“/„läuft“)',
    abgelehntN && mN.stand().zustand === 'lausch-fehler' && mN.stand().fehlerCode === 'EISDIR');
  rmSync(idN, { recursive: true });
  rmSync(`${idN}.bak`);
  await bis(() => mN.stand().zustand === 'laeuft', 5000);
```
(`rmSync(`${idN}.bak`)`: Das gescheiterte Löschen ließ die kaputte `.bak` liegen; ohne sie startet die Wiederholung mit frischer Identität wie bisher.)

Ersetzung 3 (Ist `:991-992`). Grund wie oben: Die Prüfung rief `neuAufsetzen` auf dem laufenden Master. Sie macht jetzt `verbund.json` samt `.bak` kaputt, startet die Rolle neu (Zustand „daten-beschaedigt“, keine Identität geladen) und prüft wie bisher, dass der Name aus der Selbstkopplung bleibt. Vorher:
```ts
  // „Verbund neu aufsetzen“ behält den bisherigen Master-Namen (statt auf hostname() zurückzufallen).
  await mU.neuAufsetzen();
```
Nachher:
```ts
  // „Verbund neu aufsetzen“ behält den bisherigen Master-Namen (statt auf hostname() zurückzufallen).
  // Teil 2b R2 (Vormerkung 9): nur bei beschädigten Verbunddaten — dorthin wie im Betrieb (verbund.json samt .bak kaputt).
  await mU.stoppe();
  const vbU = join(U.speicherDir, 'verbund.json');
  writeFileSync(vbU, 'Müll');
  writeFileSync(`${vbU}.bak`, 'Müll');
  mU = mkU();
  await mU.starte();
  await mU.neuAufsetzen();
```

Ersetzung 4 (Ist `:1138-1140`), Vorher:
```ts
await ohneId.neuAufsetzen();

await timerA.stoppe();
```
Nachher:
```ts
await ohneId.neuAufsetzen();

// --- Teil 2b R2, Vormerkung 9: „Verbund neu aufsetzen“ nur bei beschädigten Verbunddaten -----------------------------
{
  const pL = await freierPort();
  const L = rechner('master', 'Laeuft-PC');
  const ll = logMitschrift();
  const mL = neuerMaster(L, pL, { log: ll.log });
  await mL.starte();
  const idL = join(L.speicherDir, 'identitaet.json');
  const vorher = readFileSync(idL, 'utf8');
  const fpVorher = L.lies().kopplung!.fingerprint;
  await mL.neuAufsetzen();
  ck('Vormerkung 9: neuAufsetzen im Zustand „läuft“ → nichts gelöscht, der Master läuft mit derselben Identität weiter',
    mL.stand().zustand === 'laeuft' && readFileSync(idL, 'utf8') === vorher && L.lies().kopplung?.fingerprint === fpVorher && !(await verweigert(pL)));
  ck('Vormerkung 9: … eine Warnung', ll.zeilen.includes('warn: Master: „Verbund neu aufsetzen“ nur bei beschädigten Verbunddaten, nichts gelöscht.'));
  await mL.stoppe();
}

// --- Teil 2b R2, Spec 13.3, 15.1, 15.2: MasterRolle reicht die Server-Ereignisse an den Verteiler -----------------------
{
  const pV = await freierPort();
  const V = rechner('master', 'Verteil-PC');
  let epochen = 0;
  const verteiler = new Verteiler({ log, rechnerName: (id) => id, neueEpoche: () => `epoche-${++epochen}` });
  verteiler.meldeShow('C:/Shows/Gala.jmshow', migrateShow({ schemaVersion: 1, name: 'Gala', tools: [] }));
  const mV = neuerMaster(V, pV, { verteiler });
  await mV.starte();
  const daten: Array<Record<string, unknown>> = [];
  const timerV = new MasterLinkClient({
    dateiPfad: V.pfad, teilnehmer: { art: 'tool', appId: 'jm-timer', name: 'JM Timer', version: '0.14.0', pid: 4711 }, fristen: KURZ, suche: null,
  });
  let anmeldungen = 0;
  timerV.on('daten', (n: Record<string, unknown>) => { daten.push(n); });
  timerV.on('angemeldet', () => { anmeldungen++; });
  timerV.starte();
  await bis(() => anmeldungen === 1);
  await warte(300);
  ck('R2 15.2: vor dem Abo bekommt das Tool keine Show-Daten', timerV.zustand().art === 'verbunden' && daten.length === 0);
  timerV.sende({ t: 'abo', art: 'show', fassung: 1 });
  await bis(() => daten.length === 1);
  ck('R2 15.2: MasterRolle mit echtem Server und Verteiler: abo → stand mit Epoche, Folge 0 und der Show',
    daten[0]?.t === 'stand' && daten[0]?.epoche === 'epoche-1' && daten[0]?.folge === 0 && (daten[0]?.show as { name?: string } | null)?.name === 'Gala');
  ck('R2 15.2: … der Verteiler führt das Abo nach der Sitzung', verteiler.stand().abos.length === 1 && verteiler.hatAbo(verteiler.stand().abos[0].sitzung));
  verteiler.meldeShow('C:/Shows/Gala.jmshow', migrateShow({ schemaVersion: 1, name: 'Gala 2', tools: [] }));
  await bis(() => daten.length === 2);
  ck('R2 15.1: geänderte Show → aenderung mit Folge 1 kommt beim Tool an', daten[1]?.t === 'aenderung' && daten[1]?.folge === 1);
  await mV.stoppe();
  ck('R2 15.2: Rolle gestoppt → der Verteiler hat keine Abos und keine Epoche mehr', verteiler.stand().abos.length === 0 && verteiler.stand().epoche === null);
  await mV.starte();
  // Neuabo erst nach der NEUEN Anmeldung (13.3): eine Zeile an die alte, schon geschlossene Verbindung ginge verloren.
  await bis(() => anmeldungen === 2, 5000);
  timerV.sende({ t: 'abo', art: 'show', fassung: 1 });
  await bis(() => daten.length === 3, 3000);
  ck('R2 13.3: Rolle neu gestartet → neue Epoche; das Abo nach der neuen Anmeldung wird beantwortet',
    daten[2]?.t === 'stand' && daten[2]?.epoche === 'epoche-2' && daten[2]?.folge === 0 && (daten[2]?.show as { name?: string } | null)?.name === 'Gala 2');
  await timerV.stoppe();
  ck('R2 15.2: Sitzung zu → getrennt → das Abo ist weg', await bis(() => verteiler.stand().abos.length === 0, 2000));
  await mV.stoppe();
}
{
  // Der Kern reicht den Verteiler an jede neue MasterRolle; rolle() ist die Rolle aus master-link.json (E12).
  const pK = await freierPort();
  const aufrufe: string[] = [];
  const nachgebaut = {
    starte: () => { aufrufe.push('starte'); },
    stoppe: () => { aufrufe.push('stoppe'); },
    aufAbo: () => {},
    aufGetrennt: () => {},
    aufEntstaut: () => {},
    hatAbo: () => false,
    stand: () => ({ grund: null, showName: null, dateiName: null, verteiltAm: null, groesseKiB: null, epoche: null, folge: null, abos: [] }),
  };
  const K = kernRechner('Verteil-Kern', 'master', pK, () => ({ verteiler: nachgebaut }));
  await K.kern.starte();
  ck('R2 15.2: Kern → MasterRolle: der Start der Rolle startet den Verteiler, rolle() = master',
    JSON.stringify(aufrufe) === '["starte"]' && K.kern.rolle() === 'master');
  await K.kern.setzeRolle('aus');
  ck('R2 15.2: … Rolle aus stoppt ihn, rolle() = aus', JSON.stringify(aufrufe) === '["starte","stoppe"]' && K.kern.rolle() === 'aus');
  await K.kern.beende();
}

await timerA.stoppe();
```

- [ ] **Step 4: Tests laufen lassen (rot)**

```
npx tsx apps/launcher/test/reload-nachholen.test.ts
```
Erwartet: Abbruch beim Laden, Exitcode 1:
```
SyntaxError: The requested module '../src/main/reload-nachholen' does not provide an export named 'waehleReloadZiele'
```
```
npx tsx apps/launcher/test/iveo-abgleich.test.ts
```
Erwartet, Exitcode 1:
```
FAIL  R2 15.6: Rolle Master → RELOAD-Logzeile wörtlich mit den Tools anderer Rechner
276 ok, 1 fehlgeschlagen.
```
```
npx tsx apps/launcher/test/verbund.test.ts
```
Erwartet (Laufzeit gemessen etwa 23–30 s, weil zwei Wartefristen ablaufen), Exitcode 1:
```
FAIL  Vormerkung 9: neuAufsetzen im Zustand „läuft“ → nichts gelöscht, der Master läuft mit derselben Identität weiter
FAIL  Vormerkung 9: … eine Warnung
FAIL  R2 15.2: MasterRolle mit echtem Server und Verteiler: abo → stand mit Epoche, Folge 0 und der Show
FAIL  R2 15.2: … der Verteiler führt das Abo nach der Sitzung
FAIL  R2 15.1: geänderte Show → aenderung mit Folge 1 kommt beim Tool an
FAIL  R2 13.3: Rolle neu gestartet → neue Epoche; das Abo nach der neuen Anmeldung wird beantwortet
FAIL  R2 15.2: Kern → MasterRolle: der Start der Rolle startet den Verteiler, rolle() = master
FAIL  R2 15.2: … Rolle aus stoppt ihn, rolle() = aus
191 ok, 8 fehlgeschlagen.
```
Die beiden umgebauten alten Prüfungen (Ersetzung 2 und 3) sind schon grün: Heute setzt `neuAufsetzen` in jedem Zustand neu auf.

- [ ] **Step 5: RELOAD-Merker mit Rechner-Flag und Zielwahl** (`apps/launcher/src/main/reload-nachholen.ts:11-32`)

Vorher:
```ts
export interface ReloadMerker {
  /** Nach jedem Senden aufrufen: `erreicht` = Zahl der erreichten Endpunkte. */
  nachSenden(appId: string, zeile: string, erreicht: number): void;
  /** Bei einer neuen Verbindung zu `appId`: die nachzuholende Zeile (einmalig) oder null. */
  beiVerbindung(appId: string): string | null;
}

export function erzeugeReloadMerker(): ReloadMerker {
  const offen = new Map<string, string>();
  return {
    nachSenden(appId, zeile, erreicht) {
      if (!/ RELOAD$/.test(zeile)) return;
      if (erreicht > 0) offen.delete(appId);
      else offen.set(appId, zeile);
    },
    beiVerbindung(appId) {
      const zeile = offen.get(appId) ?? null;
      offen.delete(appId);
      return zeile;
    },
  };
}
```
Nachher:
```ts
export interface ReloadMerker {
  /**
   * Nach jedem Senden aufrufen: `erreicht` = Zahl der erreichten Endpunkte. `nurDieserRechner` (Teil 2b R2, Spec 15.3):
   * die Zeile galt nur Endpunkten dieses Rechners (Rolle Master) und wird auch nur bei einem solchen nachgeholt.
   */
  nachSenden(appId: string, zeile: string, erreicht: number, nurDieserRechner?: boolean): void;
  /**
   * Bei einer neuen Verbindung zu `appId`: die nachzuholende Zeile (einmalig) oder null. `aufDiesemRechner`: Liegt der
   * Endpunkt auf diesem Rechner? Eine Zeile mit `nurDieserRechner` geht nur dann hinaus und bleibt sonst gemerkt.
   */
  beiVerbindung(appId: string, aufDiesemRechner?: boolean): string | null;
}

export function erzeugeReloadMerker(): ReloadMerker {
  const offen = new Map<string, { zeile: string; nurDieserRechner: boolean }>();
  return {
    nachSenden(appId, zeile, erreicht, nurDieserRechner = false) {
      if (!/ RELOAD$/.test(zeile)) return;
      if (erreicht > 0) offen.delete(appId);
      else offen.set(appId, { zeile, nurDieserRechner });
    },
    beiVerbindung(appId, aufDiesemRechner = false) {
      const e = offen.get(appId);
      if (!e || (e.nurDieserRechner && !aufDiesemRechner)) return null;
      offen.delete(appId);
      return e.zeile;
    },
  };
}

/**
 * Teil 2b R2, Spec 15.3: Ziele einer Steuerzeile — die verbundenen Endpunkte der appId; mit `istHier` nur die auf diesem
 * Rechner (Rolle Master), mit `null` jeder Rechner wie bisher.
 */
export function waehleReloadZiele<T extends { appId: string; host: string; verbunden: boolean }>(
  eintraege: readonly T[],
  appId: string,
  istHier: ((host: string) => boolean) | null,
): T[] {
  return eintraege.filter((e) => e.verbunden && e.appId === appId && (istHier === null || istHier(e.host)));
}
```

- [ ] **Step 6: `sendControlCommand` mit `nurDieserRechner`** (`apps/launcher/src/main/health.ts`)

Ersetzung 1 (Ist `:19-20`), Vorher:
```ts
import type { HealthEntry, ManualEndpoint } from '@shared/types';
import { erzeugeReloadMerker } from './reload-nachholen';
```
Nachher:
```ts
import { hostname, networkInterfaces } from 'node:os';
import { eigeneAdressen, istDieserRechner } from '@jm/master-link';
import type { HealthEntry, ManualEndpoint } from '@shared/types';
import { erzeugeReloadMerker, waehleReloadZiele } from './reload-nachholen';
```

Ersetzung 2 (Ist `:53-55`), Vorher:
```ts
function endpointKey(s: { host: string; port: number }): string {
  return `${s.host}:${s.port}`;
}
```
Nachher:
```ts
function endpointKey(s: { host: string; port: number }): string {
  return `${s.host}:${s.port}`;
}

/**
 * Teil 2b R2, Spec 15.3 (E7): Liegt ein Endpunkt auf diesem Rechner? Loopback, eine Adresse einer eigenen Karte oder
 * der eigene Hostname (mDNS liefert ohne IPv4 den Hostnamen, @jm/discovery). Jeder andere Hostname gilt als fremd.
 */
function istHostHier(host: string): boolean {
  return istDieserRechner(host, eigeneAdressen(networkInterfaces()), hostname());
}
```

Ersetzung 3 (Ist `:76`), Vorher:
```ts
        const nachzuholen = reloadMerker.beiVerbindung(c.svc.appId);
```
Nachher:
```ts
        const nachzuholen = reloadMerker.beiVerbindung(c.svc.appId, istHostHier(c.svc.host));
```

Ersetzung 4 (Ist `:192-205`), Vorher:
```ts
 * laufenden Tools nicht-destruktiv neu laden zu lassen. Best-effort (send ist
 * no-op, wenn eine Verbindung inzwischen weg ist).
 */
export function sendControlCommand(appId: string, line: string): number {
  let sent = 0;
  for (const conn of conns.values()) {
    if (conn.connected && conn.svc.appId === appId) {
      conn.client.send(line);
      sent += 1;
    }
  }
  reloadMerker.nachSenden(appId, line, sent);
  return sent;
}
```
Nachher:
```ts
 * laufenden Tools nicht-destruktiv neu laden zu lassen. Best-effort (send ist
 * no-op, wenn eine Verbindung inzwischen weg ist).
 * Teil 2b R2, Spec 15.3 (O3): `nurDieserRechner` (Rolle Master) → nur Endpunkte dieses Rechners, auch beim Nachholen.
 */
export function sendControlCommand(appId: string, line: string, opt: { nurDieserRechner?: boolean } = {}): number {
  const ziele = waehleReloadZiele(
    [...conns.values()].map((c) => ({ appId: c.svc.appId, host: c.svc.host, verbunden: c.connected, c })),
    appId,
    opt.nurDieserRechner ? istHostHier : null,
  );
  for (const z of ziele) z.c.client.send(line);
  reloadMerker.nachSenden(appId, line, ziele.length, opt.nurDieserRechner === true);
  return ziele.length;
}
```
`sendControlCommand` hat außer `iveo-sync.ts` keinen Aufrufer (`git grep -n sendControlCommand apps/launcher/src` → `health.ts` und `iveo-sync.ts`).

- [ ] **Step 7: Kern — RELOAD-Logzeile in der Rolle Master** (`apps/launcher/src/main/iveo-abgleich-kern.ts`)

Ersetzung 1 (hinter `meldeShow` aus C6), Vorher:
```ts
  meldeShow?(pfad: string, show: Show | null): void;
}
```
Nachher:
```ts
  meldeShow?(pfad: string, show: Show | null): void;
  /**
   * Teil 2b R2, Spec 15.3/15.6 (E12): null = Rolle nicht Master (Logzeile aus 2a); sonst k = Tools anderer Rechner mit
   * Abo für die Logzeile „… auf diesem Rechner; k Tools anderer Rechner …“. Optional.
   */
  verbundReload?(): { andereRechner: number } | null;
}
```

Ersetzung 2 (Ist `:418-424`), Vorher:
```ts
  /** Spec 7.1: an allen drei Stellen geht auch RUNDOWN RELOAD hinaus. */
  function benachrichtigeAlle(): void {
    const timer = d.benachrichtige('jm-timer', 'TIMER RELOAD');
    const titler = d.benachrichtige('jm-titler', 'TITLER RELOAD');
    const rundown = d.benachrichtige('jm-rundown', 'RUNDOWN RELOAD');
    d.log.info(`iveo: RELOAD → ${timer} Timer, ${titler} Titler, ${rundown} Rundown benachrichtigt.`);
  }
```
Nachher:
```ts
  /**
   * Spec 7.1: an allen drei Stellen geht auch RUNDOWN RELOAD hinaus. Teil 2b R2, Spec 15.3/15.6: In der Rolle Master
   * schickt die Hülle nur an diesen Rechner, und die Logzeile nennt die Tools anderer Rechner, die die Daten über den
   * Verbund bekommen. Ein Wurf von verbundReload ändert am RELOAD nichts (Logzeile aus 2a).
   */
  function benachrichtigeAlle(): void {
    let verbund: { andereRechner: number } | null = null;
    try {
      verbund = d.verbundReload?.() ?? null;
    } catch {
      verbund = null;
    }
    const timer = d.benachrichtige('jm-timer', 'TIMER RELOAD');
    const titler = d.benachrichtige('jm-titler', 'TITLER RELOAD');
    const rundown = d.benachrichtige('jm-rundown', 'RUNDOWN RELOAD');
    if (verbund) {
      d.log.info(`iveo: RELOAD → ${timer} Timer, ${titler} Titler, ${rundown} Rundown auf diesem Rechner; `
        + `${verbund.andereRechner} Tools anderer Rechner bekommen die Daten über den Verbund.`);
    } else {
      d.log.info(`iveo: RELOAD → ${timer} Timer, ${titler} Titler, ${rundown} Rundown benachrichtigt.`);
    }
  }
```

- [ ] **Step 8: MasterRolle reicht die Ereignisse an den Verteiler; `neuAufsetzen` nur bei „daten-beschaedigt“** (`apps/launcher/src/main/verbund/master.ts`)

Ersetzung 1 (Ist `:7-12`), Vorher:
```ts
  type BonjourFabrik, type Fristen, type Identitaet, type Karte, type Kopplung, type MasterLinkDatei,
  type NetzwerkInterfaces, type Schluesselpaar, type VerbundDaten,
} from '@jm/master-link';
import type { MasterZustand, VerbundMasterStand, VerbundRechner } from '@shared/types';
import { fehlerCode } from './fehlercode';
import { erzeugeMasterIdentitaet } from './zertifikat';
```
Nachher:
```ts
  type AboInhalt, type BonjourFabrik, type Fristen, type Identitaet, type Karte, type Kopplung, type MasterLinkDatei,
  type NetzwerkInterfaces, type Schluesselpaar, type TeilnehmerDaten, type VerbundDaten,
} from '@jm/master-link';
import type { MasterZustand, VerbundMasterStand, VerbundRechner } from '@shared/types';
import { fehlerCode } from './fehlercode';
import type { Verteiler } from './verteiler';
import { erzeugeMasterIdentitaet } from './zertifikat';
```

Ersetzung 2 (Ist `:34-36`), Vorher:
```ts
  /** Nur Tests: läuft vor jedem Schreiben von identitaet.json/verbund.json durch diese Rolle und darf werfen. Produktion: ungesetzt. */
  vorSchreiben?: (pfad: string) => void;
}
```
Nachher:
```ts
  /** Nur Tests: läuft vor jedem Schreiben von identitaet.json/verbund.json durch diese Rolle und darf werfen. Produktion: ungesetzt. */
  vorSchreiben?: (pfad: string) => void;
  /**
   * Teil 2b R2, Spec 15.2: Verteiler der Show-Daten. Bekommt daten/getrennt/entstaut des Servers und sendet über
   * sendeDaten; der Server bleibt privat. Start der Rolle = neue Epoche (13.3).
   */
  verteiler?: Pick<Verteiler, 'starte' | 'stoppe' | 'aufAbo' | 'aufGetrennt' | 'aufEntstaut' | 'hatAbo'>;
}
```

Ersetzung 3 (Ist `:189-190`), Vorher:
```ts
      server.on('aenderung', () => this.d.beiAenderung());
      await server.starte();
```
Nachher:
```ts
      server.on('aenderung', () => this.d.beiAenderung());
      const v = this.d.verteiler;
      if (v) {
        // Spec 15.2: Abos, Sitzungsende und Stau gehen an den Verteiler (nach Sitzung geführt, 13.6).
        server.on('daten', (t: TeilnehmerDaten, abo: AboInhalt) => v.aufAbo(t, abo));
        server.on('getrennt', (sitzung: number) => v.aufGetrennt(sitzung));
        server.on('entstaut', (sitzung: number) => v.aufEntstaut(sitzung));
      }
      await server.starte();
```

Ersetzung 4 (Ist `:203-204`), Vorher:
```ts
    this.letzterStartFehler = null;
    this.setzeZustand('laeuft', null);
```
Nachher:
```ts
    this.letzterStartFehler = null;
    // Spec 13.3/15.1: neue Epoche je Start der Rolle (Launcher-Start, Rollenwechsel, Identität erneuern, Wiederholung).
    const laufend = this.server;
    if (laufend) this.d.verteiler?.starte({ sendeDaten: (sitzung, zeile) => laufend.sendeDaten(sitzung, zeile) });
    this.setzeZustand('laeuft', null);
```
Zwischen `await server.starte()` und dieser Stelle liegt kein Netz-Ereignis (nur Mikrotasks); ein `abo` kann den Verteiler deshalb nicht vor seinem Start erreichen, und vor `starte()` ignoriert er Abos ohnehin.

Ersetzung 5 (`stoppe`, Ist `:392-394`), Vorher:
```ts
    this.annonce = null;
    this.server = null;
    // Reihenfolge: zuerst den Server anstoßen
```
Nachher:
```ts
    this.annonce = null;
    this.server = null;
    // Spec 15.2: ab hier sendet der Verteiler nichts mehr; die getrennt-Ereignisse beim Schließen finden keine Abos.
    if (server) this.d.verteiler?.stoppe();
    // Reihenfolge: zuerst den Server anstoßen
```

Ersetzung 6 (`neuAufsetzen`, Ist `:481-482`), Vorher:
```ts
  /** Nur bei „Verbunddaten beschädigt“ angeboten: alles verwerfen, neu beginnen. */
  async neuAufsetzen(): Promise<void> {
```
Nachher:
```ts
  /** Nur bei „Verbunddaten beschädigt“ angeboten: alles verwerfen, neu beginnen. */
  async neuAufsetzen(): Promise<void> {
    // Teil 2b R2 (Vormerkung 9 der Teil-1-Schlussprüfung): auch im Main nur in diesem Zustand — ein Fehlaufruf löschte
    // sonst Identität und Verbund, und jeder gekoppelte Rechner müsste neu koppeln.
    if (this.zustand !== 'daten-beschaedigt') {
      this.d.log('warn', 'Master: „Verbund neu aufsetzen“ nur bei beschädigten Verbunddaten, nichts gelöscht.');
      return;
    }
```

- [ ] **Step 9: Kern des Verbunds reicht den Verteiler durch, `rolle()`** (`apps/launcher/src/main/verbund/kern.ts`)

Ersetzung 1 (Ist `:11-12`), Vorher:
```ts
import { MasterRolle, type MasterAbhaengigkeiten } from './master';
import { SlaveRolle, type SlaveAbhaengigkeiten } from './slave';
```
Nachher:
```ts
import { MasterRolle, type MasterAbhaengigkeiten } from './master';
import { SlaveRolle, type SlaveAbhaengigkeiten } from './slave';
import type { Verteiler } from './verteiler';
```

Ersetzung 2 (Ist `:40-42`), Vorher:
```ts
  master?: Partial<MasterAbhaengigkeiten>;
  slave?: Partial<SlaveAbhaengigkeiten>;
}
```
Nachher:
```ts
  master?: Partial<MasterAbhaengigkeiten>;
  slave?: Partial<SlaveAbhaengigkeiten>;
  /**
   * Teil 2b R2, Spec 15.2: Verteiler der Show-Daten. Jede neue MasterRolle bekommt ihn; `stand()` liest das
   * Verbund-Modal (15.5). Ohne ihn verteilt der Master nichts (Tests, Teil-1-Verhalten).
   */
  verteiler?: Pick<Verteiler, 'starte' | 'stoppe' | 'aufAbo' | 'aufGetrennt' | 'aufEntstaut' | 'hatAbo' | 'stand'>;
}
```

Ersetzung 3 (Ist `:123-127`), Vorher:
```ts
      log: d.log,
      netzwerkKarten: d.netzwerkKarten,
      ...d.master,
    });
  }
```
Nachher:
```ts
      log: d.log,
      netzwerkKarten: d.netzwerkKarten,
      ...(d.verteiler ? { verteiler: d.verteiler } : {}),
      ...d.master,
    });
  }
```
(Nur `neuerMaster` hat diese Zeilen; `neuerSlave` endet mit `...d.slave,`.)

Ersetzung 4 (Rückgabe, Ist `:440-444`), Vorher:
```ts
  return {
    setzeMelder: (fn: () => void): void => { melde = fn; },
    starte,
    beende,
    stand,
```
Nachher:
```ts
  return {
    setzeMelder: (fn: () => void): void => { melde = fn; },
    starte,
    beende,
    stand,
    /** Teil 2b R2 (E12): die Rolle aus master-link.json — Grundlage für „RELOAD nur an diesen Rechner“ (15.3). */
    rolle: (): VerbundRolle => datei.rolle,
```

- [ ] **Step 10: Verteiler im Launcher, `meldeShowAnVerbund`, `verbundReloadInfo`** (`apps/launcher/src/main/verbund/index.ts`)

Ersetzung 1 (Ist `:4-22`), Vorher:
```ts
import { masterLinkPfad } from '@jm/master-link';
import type { AppEvent, KoppelAntwort, VerbundRolle, VerbundStand } from '@shared/types';
import { erzeugeVerbundKern } from './kern';

// Verbund des Launchers (Master-Link Teil 1): dünne Electron-Anbindung über dem Kern (kern.ts), der Datei im Speicher,
// Rolle, Reihenfolge der zustandsändernden Aufrufe und Stand OHNE Electron führt und per tsx getestet ist.
// Hier nur, was Electron braucht: Pfade, Log, Änderungsereignis und das Beenden.

const kern = erzeugeVerbundKern({
  dateiPfad: () => masterLinkPfad(app.getPath('appData')),
  speicherDir: () => join(app.getPath('userData'), 'master-link'),
  suiteVersion: () => app.getVersion(),
  log: (stufe, text) => {
    getLog()[stufe](text);
  },
});

export async function starteVerbund(emit: (e: AppEvent) => void): Promise<void> {
  kern.setzeMelder(() => emit({ type: 'verbund-changed' }));
```
Nachher:
```ts
import { masterLinkPfad } from '@jm/master-link';
import type { Show } from '@jm/show';
import type { AppEvent, KoppelAntwort, VerbundRolle, VerbundStand } from '@shared/types';
import { erzeugeVerbundKern } from './kern';
import { Verteiler } from './verteiler';

// Verbund des Launchers (Master-Link Teil 1): dünne Electron-Anbindung über dem Kern (kern.ts), der Datei im Speicher,
// Rolle, Reihenfolge der zustandsändernden Aufrufe und Stand OHNE Electron führt und per tsx getestet ist.
// Hier nur, was Electron braucht: Pfade, Log, Änderungsereignis und das Beenden.

/** Teil 2b R2: Änderungsereignis fürs Verbund-Modal, gesetzt in starteVerbund. */
let meldeVerbund: (() => void) | null = null;

/**
 * Teil 2b R2, Spec 15: Verteiler der Show-Daten. Lebt mit dem Launcher und merkt sich die offene Show auch ohne Rolle
 * Master; jede MasterRolle startet und stoppt ihn (neue Epoche je Start).
 */
const verteiler = new Verteiler({
  log: (stufe, text) => {
    getLog()[stufe](text);
  },
  rechnerName: (id) => kern.stand().master?.rechner.find((r) => r.rechnerId === id)?.name ?? id,
  beiAenderung: () => meldeVerbund?.(),
});

const kern = erzeugeVerbundKern({
  dateiPfad: () => masterLinkPfad(app.getPath('appData')),
  speicherDir: () => join(app.getPath('userData'), 'master-link'),
  suiteVersion: () => app.getVersion(),
  log: (stufe, text) => {
    getLog()[stufe](text);
  },
  verteiler,
});

export async function starteVerbund(emit: (e: AppEvent) => void): Promise<void> {
  kern.setzeMelder(() => emit({ type: 'verbund-changed' }));
  meldeVerbund = () => emit({ type: 'verbund-changed' });
```
`rechnerName` greift erst zur Laufzeit (bei einer Logzeile) auf `kern` zu; dann ist `kern` gesetzt.

Ersetzung 2 (Dateiende, Ist `:100-102`), Vorher:
```ts
export function setzeFesteAdresse(adresse: string | null): VerbundStand {
  return kern.setzeFesteAdresse(adresse);
}
```
Nachher:
```ts
export function setzeFesteAdresse(adresse: string | null): VerbundStand {
  return kern.setzeFesteAdresse(adresse);
}

/** Teil 2b R2, Spec 15.1: die offene Show (wie sie in der Datei steht; null = nicht lesbar) an den Verteiler. */
export function meldeShowAnVerbund(pfad: string, show: Show | null): void {
  verteiler.meldeShow(pfad, show);
}

/**
 * Teil 2b R2, Spec 15.3/15.6 (E12): Rolle Master in master-link.json → RELOAD nur an diesen Rechner, k = Tools anderer
 * Rechner mit Abo; sonst null (alles wie in 2a).
 */
export function verbundReloadInfo(): { andereRechner: number } | null {
  return kern.rolle() === 'master' ? { andereRechner: verteiler.abosAndererRechner() } : null;
}
```

- [ ] **Step 11: Die Hülle verbindet Kern, Verteiler und RELOAD-Filter** (`apps/launcher/src/main/iveo-sync.ts`)

Ersetzung 1 (Ist `:53`), Vorher:
```ts
import { sendControlCommand } from './health';
```
Nachher:
```ts
import { sendControlCommand } from './health';
import { meldeShowAnVerbund, verbundReloadInfo } from './verbund';
```

Ersetzung 2 (Ist `:439`), Vorher:
```ts
      benachrichtige: (appId, zeile) => sendControlCommand(appId, zeile),
```
Nachher:
```ts
      // Teil 2b R2, Spec 15.3 (O3): In der Rolle Master geht RELOAD nur an Tools dieses Rechners.
      benachrichtige: (appId, zeile) => sendControlCommand(appId, zeile, { nurDieserRechner: verbundReloadInfo() !== null }),
```

Ersetzung 3 (Ist `:445-448`), Vorher:
```ts
      baseUrlStandard: () => resolveIveoBaseUrl(),
    });
  }
  return kernInstanz;
```
Nachher:
```ts
      baseUrlStandard: () => resolveIveoBaseUrl(),
      // Teil 2b R2, Spec 15.1: die offene Show an den Verteiler; 15.6: k für die RELOAD-Logzeile.
      meldeShow: (pfad, show) => meldeShowAnVerbund(pfad, show),
      verbundReload: () => verbundReloadInfo(),
    });
  }
  return kernInstanz;
```
`./verbund` importiert `iveo-sync.ts` nicht; es entsteht kein Kreis.

- [ ] **Step 12: Tests laufen lassen (grün)**

```
npm run selftest:iveo -w @jm/launcher
npm run selftest:verbund -w @jm/launcher
```
Erwartet, je Exitcode 0:
```
277 ok, 0 fehlgeschlagen.
52 ok, 0 fehlgeschlagen.
84 ok, 0 fehlgeschlagen.
12 ok, 0 fehlgeschlagen.
```
```
199 ok, 0 fehlgeschlagen.
44 ok, 0 fehlgeschlagen.
```
`selftest:verbund` dauert gemessen etwa 14 bis 20 s; dreimal hintereinander gleich.

- [ ] **Step 13: Typecheck und Build**

```
npm run typecheck -w @jm/launcher
npm run build -w @jm/launcher
```
Erwartet: beide Exitcode 0 (`electron-vite build` bündelt `health.ts`, `verbund/index.ts`, `iveo-sync.ts`; gemessen 4 bis 15 s). Die Ausgabe in `apps/launcher/out` ist in `.gitignore` (`out`).

Der Server bleibt privat (Spec 15.2, Gliederung C9 „Server bleibt privat“). Die Launcher-Tests werden nicht typgeprüft, deshalb hier zwei Befehle statt einer Testzeile (Bash-Werkzeug):
```
grep -c "private server: MasterLinkServer | null = null;" apps/launcher/src/main/verbund/master.ts
grep -rn "\.server\b" apps/launcher/src/main --include=*.ts | grep -v "verbund/master.ts\|verbund/verteiler.ts"
```
Erwartet (gemessen): erste Zeile `1`; der zweite Befehl gibt nichts aus (Exitcode 1). Außer `master.ts` selbst greift kein Main-Modul auf einen `server` zu; der Verteiler hat nur sein eigenes Feld `server` (das kleine Objekt `{ sendeDaten }`). Ein Zugriff von außen auf `MasterRolle.server` bräche zudem den Typecheck (`private`).

- [ ] **Step 14: Commit** (Bash-Werkzeug)

```
git add apps/launcher/src/main/reload-nachholen.ts apps/launcher/src/main/health.ts apps/launcher/src/main/iveo-abgleich-kern.ts apps/launcher/src/main/verbund/master.ts apps/launcher/src/main/verbund/kern.ts apps/launcher/src/main/verbund/index.ts apps/launcher/src/main/iveo-sync.ts apps/launcher/test/reload-nachholen.test.ts apps/launcher/test/iveo-abgleich.test.ts apps/launcher/test/verbund.test.ts
git status --short
```
Erwartet genau:
```
M  apps/launcher/src/main/health.ts
M  apps/launcher/src/main/iveo-abgleich-kern.ts
M  apps/launcher/src/main/iveo-sync.ts
M  apps/launcher/src/main/reload-nachholen.ts
M  apps/launcher/src/main/verbund/index.ts
M  apps/launcher/src/main/verbund/kern.ts
M  apps/launcher/src/main/verbund/master.ts
M  apps/launcher/test/iveo-abgleich.test.ts
M  apps/launcher/test/reload-nachholen.test.ts
M  apps/launcher/test/verbund.test.ts
```
Dann:
```
git commit -m "feat(launcher): Verteiler an der Master-Rolle, RELOAD nur an diesen Rechner (Teil 2b R2)" -m "MasterRolle reicht daten, getrennt und entstaut des Servers an den Verteiler und startet ihn mit neuer Epoche je Start der Rolle; der Server bleibt privat. verbund/index.ts haelt den Verteiler, iveo-sync meldet ihm die offene Show. In der Rolle Master (master-link.json) geht RELOAD nur an Endpunkte dieses Rechners, auch beim Nachholen (Spec 15.3, O3); die Logzeile nennt die Tools anderer Rechner (15.6). neuAufsetzen wirkt nur bei beschaedigten Verbunddaten (Vormerkung 9)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- `VerbundKernDeps.verteiler` schließt `stand` ein (E40; C10 liest es), `MasterAbhaengigkeiten.verteiler` bleibt nach Register ohne. Der Kern bekommt `rolle()` (E12).
- `MasterRolle.stoppe()` stoppt den Verteiler nur mit laufendem Server (E40).
- Zwei alte Prüfungen in `verbund.test.ts` geändert (Vormerkung 9), Gründe in Step 3.
- Neuer Logtext „Master: „Verbund neu aufsetzen“ nur bei beschädigten Verbunddaten, nichts gelöscht.“ (E13-Ergänzung).
- `verbund.test.ts`-Zählstände beim Durchspielen des ganzen Plans nachgemessen (echter Server und Client aus C3/C4): gleich.

---

### Task 10: C10 · Verbund-Modal am Master: „Show im Verbund …“ und je Tool „bezieht Show-Daten“

**Spec:** Abschnitte 15.5 (beide Absätze, Texte wörtlich), 19.3 Nr. 10; Gliederung E20 (Texte als reine Funktionen, das Modal zeichnet alle 2 s neu).

**Arbeitsverzeichnis:** wie C5. Voraussetzung: C9 ist committet.

**Dateien:**
- Modify: `apps/launcher/src/shared/types.ts` — `VerbundTool` (Ist `:477-483`), neu `VerbundShowStand` dahinter, `VerbundMasterStand` (Ist `:521-524`)
- Modify: `apps/launcher/src/main/verbund/master.ts` — `stand()` (Ist `:519`, `:529-532`)
- Modify: `apps/launcher/src/main/verbund/kern.ts` — Import (Ist `:8`), `stand()` (Ist `:238-250`)
- Modify: `apps/launcher/src/renderer/src/lib/verbund-texte.ts` — Import (`:1`), Dateiende (Ist `:137-140`)
- Modify: `apps/launcher/src/renderer/src/components/VerbundMaster.tsx` — Importe (`:1-4`), `jetzt` (Ist `:14-15`), Abschnitt „Gekoppelte Rechner“ (Ist `:59-60`), Tool-Zeilen (Ist `:89-93`)
- Test: `apps/launcher/test/verteiler.test.ts` (Import, neuer Block Nr. 10 vor der Zusammenfassung)
- Test: `apps/launcher/test/verbund.test.ts` (neuer Block hinter dem Kern-Block aus C9)

Die Ist-Zeilen in `master.ts` und `kern.ts` (hier und in Step 5 und 6) gelten für die Basis. C9 verlängert beide Dateien: Im Stand nach C9 stehen die Vorher-Texte zu `stand()` 24 bzw. 7 Zeilen weiter hinten (`master.ts:543`, `:553-556`; `kern.ts:245-257`), der Import in `kern.ts` bleibt bei `:8` (gemessen am 12.10.2026, N33). Maßgeblich ist der wortgleiche Vorher-Text.

**Interfaces:**
- Consumes: `Verteiler.stand(): VerteilerStand`, `Verteiler.hatAbo(sitzung)` (C8), `VerbundKernDeps.verteiler` mit `stand` (C9), `TeilnehmerStand.sitzung` (C3).
- Produces (Register S-B):
  ```ts
  // apps/launcher/src/shared/types.ts
  export interface VerbundShowStand {
    grund: 'keine-show' | 'zu-gross' | 'nicht-lesbar' | null;
    showName: string | null; dateiName: string | null; verteiltAm: number | null; groesseKiB: number | null; bezieher: number;
  }
  // VerbundMasterStand.showImVerbund: VerbundShowStand | null   (null, solange der Verteiler nicht läuft)
  // VerbundTool.bezieht: boolean
  // apps/launcher/src/renderer/src/lib/verbund-texte.ts
  export function verbundShowZeile(s: VerbundShowStand, uhrzeit: (ms: number) => string): { text: string; rot: boolean };
  export function toolDatenText(appId: string, verbundenSeit: number, bezieht: boolean, jetzt: number): string | null;
  export const OHNE_DATEN_NACH_MS = 10_000;
  ```

**Texte (wörtlich Spec 15.5):**
- mit Show: „Show im Verbund: „⟨Show⟩“ · Stand ⟨hh:mm⟩ · ⟨n⟩ Tools beziehen sie“; bei genau einem Bezieher „… · 1 Tool bezieht sie“ (Owner 08.10.2026, N16)
- `keine-show`: „Show im Verbund: keine Show offen“
- `zu-gross`: „Show „⟨Show⟩“ nicht verteilt: zu groß für den Verbund (⟨n⟩ KiB)“ (rot)
- `nicht-lesbar`: „Show „⟨Dateiname⟩“ nicht verteilt: nicht lesbar“ (rot)
- je Tool (Timer, Titler, Rundown): „bezieht Show-Daten“; ohne Abo 10 s nach der Anmeldung „ohne Show-Daten (Update nötig)“; andere Tools nichts.

**Regeln für diese Aufgabe:**
- `verbund-texte.ts` bleibt ohne Laufzeit-Importe (nur `import type`): Der Launcher-Selbsttest lädt die Datei mit `node --experimental-strip-types` (G7).
- `MasterRolle.stand()` kennt die Show nicht und liefert `showImVerbund: null`; der Kern setzt das Feld aus `Verteiler.stand()` (E40).
- Bei den Tools von „dieser Rechner“ zeigt das Modal keine Daten-Zeile (E43): Tools am Master abonnieren nicht (16.1).
- G15: `VerbundMaster.tsx` prüfen Typecheck (web) und `electron-vite build`; die Regeln selbst prüfen die reinen Funktionen.
- TDD, CRLF, Edit-Werkzeug wie C5. Nicht anfassen: G1.

---

- [ ] **Step 1: Fehlschlagende Tests für die Modal-Zeilen** (`apps/launcher/test/verteiler.test.ts`)

Ersetzung 1, Vorher:
```ts
import { Verteiler, verbundSchluessel, type VerteilerServer } from '../src/main/verbund/verteiler';
```
Nachher:
```ts
import { Verteiler, verbundSchluessel, type VerteilerServer } from '../src/main/verbund/verteiler';
import { toolDatenText, verbundShowZeile } from '../src/renderer/src/lib/verbund-texte';
```

Ersetzung 2 (vor der Zusammenfassung), Vorher:
```ts
  ck('verbundSchluessel: aufloesen ist einsetzbar', verbundSchluessel('x', (p) => `/fest/${p}`) === createHash('sha256').update('/fest/x').digest('hex').slice(0, 16));
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
```
Nachher:
```ts
  ck('verbundSchluessel: aufloesen ist einsetzbar', verbundSchluessel('x', (p) => `/fest/${p}`) === createHash('sha256').update('/fest/x').digest('hex').slice(0, 16));
}

// --- Nr. 10: Zeilen des Verbund-Modals am Master (reine Funktionen, Spec 15.5) --------------------------------------
{
  const uhr = (ms: number): string => `U${ms}`;
  const s = { showName: 'COP31 Tag 1', dateiName: 'COP31 Tag 1.jmshow', verteiltAm: 42, groesseKiB: 15, bezieher: 3 };
  const zeile = (x: Parameters<typeof verbundShowZeile>[0]): string => JSON.stringify(verbundShowZeile(x, uhr));
  ck('Nr. 10: mit Show → „Show im Verbund: „⟨Show⟩“ · Stand ⟨hh:mm⟩ · ⟨n⟩ Tools beziehen sie“',
    zeile({ ...s, grund: null }) === JSON.stringify({ text: 'Show im Verbund: „COP31 Tag 1“ · Stand U42 · 3 Tools beziehen sie', rot: false }));
  ck('Nr. 10: genau ein Bezieher → „· 1 Tool bezieht sie“ (Owner 08.10.2026)',
    zeile({ ...s, grund: null, bezieher: 1 }) === JSON.stringify({ text: 'Show im Verbund: „COP31 Tag 1“ · Stand U42 · 1 Tool bezieht sie', rot: false }));
  ck('Nr. 10: keine-show → „Show im Verbund: keine Show offen“',
    zeile({ ...s, grund: 'keine-show', showName: null }) === JSON.stringify({ text: 'Show im Verbund: keine Show offen', rot: false }));
  ck('Nr. 10: zu-gross → rot, mit Showname und KiB',
    zeile({ ...s, grund: 'zu-gross', groesseKiB: 950 })
      === JSON.stringify({ text: 'Show „COP31 Tag 1“ nicht verteilt: zu groß für den Verbund (950 KiB)', rot: true }));
  ck('Nr. 10: nicht-lesbar → rot, mit Dateiname',
    zeile({ ...s, grund: 'nicht-lesbar', showName: null })
      === JSON.stringify({ text: 'Show „COP31 Tag 1.jmshow“ nicht verteilt: nicht lesbar', rot: true }));
  const t0 = 1_000_000;
  const drei = ['jm-timer', 'jm-titler', 'jm-rundown'];
  ck('Nr. 10: Timer, Titler und Rundown mit Abo → „bezieht Show-Daten“', drei.every((a) => toolDatenText(a, t0, true, t0) === 'bezieht Show-Daten'));
  ck('Nr. 10: … ohne Abo 9 s nach der Anmeldung → nichts', drei.every((a) => toolDatenText(a, t0, false, t0 + 9_000) === null));
  ck('Nr. 10: … ohne Abo 10 s nach der Anmeldung → „ohne Show-Daten (Update nötig)“',
    drei.every((a) => toolDatenText(a, t0, false, t0 + 10_000) === 'ohne Show-Daten (Update nötig)'));
  ck('Nr. 10: andere Tools und der Slave-Launcher → nichts', toolDatenText('jm-qa', t0, false, t0 + 60_000) === null
    && toolDatenText('jm-battle', t0, true, t0) === null && toolDatenText('jm-launcher', t0, false, t0 + 60_000) === null);
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
```

- [ ] **Step 2: Fehlschlagender Test für den Stand des Kerns** (`apps/launcher/test/verbund.test.ts`, hinter dem Kern-Block aus C9)

Vorher:
```ts
  ck('R2 15.2: … Rolle aus stoppt ihn, rolle() = aus', JSON.stringify(aufrufe) === '["starte","stoppe"]' && K.kern.rolle() === 'aus');
  await K.kern.beende();
}
```
Nachher:
```ts
  ck('R2 15.2: … Rolle aus stoppt ihn, rolle() = aus', JSON.stringify(aufrufe) === '["starte","stoppe"]' && K.kern.rolle() === 'aus');
  await K.kern.beende();
}
{
  // Spec 15.5: Der Stand des Kerns trägt die Zeile „Show im Verbund …“ und je Tool „bezieht Show-Daten“.
  const pS = await freierPort();
  const verteiler = new Verteiler({ log, rechnerName: (id) => id });
  const K = kernRechner('Modal-PC', 'master', pS, () => ({ verteiler }));
  await K.kern.starte();
  const svb = () => K.kern.stand().master?.showImVerbund;
  ck('R2 15.5: kern.stand() trägt showImVerbund — ohne Show keine-show, 0 Bezieher', svb()?.grund === 'keine-show' && svb()?.bezieher === 0);
  verteiler.meldeShow('C:/Shows/Modal.jmshow', migrateShow({ schemaVersion: 1, name: 'Modal', tools: [] }));
  const tool = new MasterLinkClient({
    dateiPfad: K.pfad, teilnehmer: { art: 'tool', appId: 'jm-rundown', name: 'JM Rundown', version: '0.8.0', pid: 99 }, fristen: KURZ, suche: null,
  });
  let angemeldet = false;
  tool.on('angemeldet', () => { angemeldet = true; });
  tool.starte();
  await bis(() => angemeldet);
  const rundown = () => K.kern.stand().master?.rechner.find((r) => r.dieserRechner)?.tools.find((t) => t.appId === 'jm-rundown');
  await bis(() => rundown() !== undefined);
  ck('R2 15.5: Tool ohne Abo → bezieht false', rundown()?.bezieht === false);
  tool.sende({ t: 'abo', art: 'show', fassung: 1 });
  ck('R2 15.5: … nach dem Abo bezieht true; showImVerbund mit Show, Zeit und 1 Bezieher',
    await bis(() => rundown()?.bezieht === true) && svb()?.grund === null && svb()?.showName === 'Modal'
    && typeof svb()?.verteiltAm === 'number' && svb()?.bezieher === 1);
  await tool.stoppe();
  await K.kern.setzeRolle('aus');
  ck('R2 15.5: Rolle aus → kein Master-Stand', K.kern.stand().master === null);
  await K.kern.beende();
}
```
Der Rundown hier läuft auf dem Master-Rechner selbst (Selbstkopplung); sein Abo wird nach E29 bedient wie jedes andere. Im Modal blendet `VerbundMaster.tsx` die Daten-Zeile für „dieser Rechner“ aus (Step 8), der Stand trägt `bezieht` trotzdem.

- [ ] **Step 3: Tests laufen lassen (rot)**

```
npx tsx apps/launcher/test/verbund.test.ts
```
Erwartet, Exitcode 1:
```
FAIL  R2 15.5: kern.stand() trägt showImVerbund — ohne Show keine-show, 0 Bezieher
FAIL  R2 15.5: Tool ohne Abo → bezieht false
FAIL  R2 15.5: … nach dem Abo bezieht true; showImVerbund mit Show, Zeit und 1 Bezieher
200 ok, 3 fehlgeschlagen.
```
```
npx tsx apps/launcher/test/verteiler.test.ts
```
Erwartet: Abbruch beim Laden, Exitcode 1:
```
SyntaxError: The requested module '../src/renderer/src/lib/verbund-texte' does not provide an export named 'toolDatenText'
```

- [ ] **Step 4: Typen** (`apps/launcher/src/shared/types.ts`)

Ersetzung 1 (Ist `:477-483`), Vorher:
```ts
export interface VerbundTool {
  appId: string;
  name: string;
  version: string;
  art: 'tool' | 'launcher';
  verbundenSeit: number;
}
```
Nachher:
```ts
export interface VerbundTool {
  appId: string;
  name: string;
  version: string;
  art: 'tool' | 'launcher';
  verbundenSeit: number;
  /** Teil 2b R2, Spec 15.5: Das Tool hat ein Abo beim Verteiler („bezieht Show-Daten“). */
  bezieht: boolean;
}

/** Teil 2b R2, Spec 15.5: Zeile „Show im Verbund …“ — was der Verteiler zuletzt verteilt hat. */
export interface VerbundShowStand {
  grund: 'keine-show' | 'zu-gross' | 'nicht-lesbar' | null;
  showName: string | null;
  dateiName: string | null;
  verteiltAm: number | null;
  groesseKiB: number | null;
  /** Zahl der Abos („⟨n⟩ Tools beziehen sie“). */
  bezieher: number;
}
```

Ersetzung 2 (Ist `:521-524`), Vorher:
```ts
  speicherFehler: string | null;
  rechner: VerbundRechner[];
  kopplung: VerbundKopplungsfenster;
}
```
Nachher:
```ts
  speicherFehler: string | null;
  rechner: VerbundRechner[];
  kopplung: VerbundKopplungsfenster;
  /** Teil 2b R2, Spec 15.5: null, solange der Verteiler nicht läuft. Die MasterRolle kennt die Show nicht; der Kern setzt es. */
  showImVerbund: VerbundShowStand | null;
}
```

- [ ] **Step 5: Stand der MasterRolle** (`apps/launcher/src/main/verbund/master.ts`)

Ersetzung 1 (Ist `:519`), Vorher:
```ts
          .map((t) => ({ appId: t.appId, name: t.name, version: t.version, art: t.art, verbundenSeit: t.seit })),
```
Nachher:
```ts
          .map((t) => ({
            appId: t.appId, name: t.name, version: t.version, art: t.art, verbundenSeit: t.seit,
            // Spec 15.5: Abo beim Verteiler, nach Sitzung geführt (13.6).
            bezieht: this.d.verteiler?.hatAbo(t.sitzung) ?? false,
          })),
```

Ersetzung 2 (Ist `:529-532`), Vorher:
```ts
      rechner,
      kopplung: server?.kopplungsStand() ?? LEER_FENSTER,
    };
  }
```
Nachher:
```ts
      rechner,
      kopplung: server?.kopplungsStand() ?? LEER_FENSTER,
      // Spec 15.5: Die Rolle kennt die Show nicht; der Kern (kern.ts, stand()) setzt die Zeile aus dem Verteiler.
      showImVerbund: null,
    };
  }
```

- [ ] **Step 6: Stand des Kerns** (`apps/launcher/src/main/verbund/kern.ts`)

Ersetzung 1 (Ist `:8`), Vorher:
```ts
import type { KoppelAntwort, VerbundRolle, VerbundStand } from '@shared/types';
```
Nachher:
```ts
import type { KoppelAntwort, VerbundRolle, VerbundShowStand, VerbundStand } from '@shared/types';
```

Ersetzung 2 (Ist `:238-250`), Vorher:
```ts
  function stand(): VerbundStand {
    const { karten: liste, karteFehlt } = kartenLage(karten(), datei.netzwerk.karte);
    return {
      rolle: datei.rolle,
      rechnerName: datei.rechner.name,
      karten: liste,
      gewaehlteKarte: datei.netzwerk.karte,
      karteFehlt,
      dateiFehler,
      master: master?.stand() ?? null,
      slave: slave?.stand() ?? null,
    };
  }
```
Nachher:
```ts
  /** Teil 2b R2, Spec 15.5: Zeile „Show im Verbund …“ — nur, solange der Verteiler läuft (Epoche gesetzt). */
  function showImVerbund(): VerbundShowStand | null {
    const v = d.verteiler?.stand();
    if (!v || v.epoche === null) return null;
    return {
      grund: v.grund,
      showName: v.showName,
      dateiName: v.dateiName,
      verteiltAm: v.verteiltAm,
      groesseKiB: v.groesseKiB,
      bezieher: v.abos.length,
    };
  }

  function stand(): VerbundStand {
    const { karten: liste, karteFehlt } = kartenLage(karten(), datei.netzwerk.karte);
    return {
      rolle: datei.rolle,
      rechnerName: datei.rechner.name,
      karten: liste,
      gewaehlteKarte: datei.netzwerk.karte,
      karteFehlt,
      dateiFehler,
      master: master ? { ...master.stand(), showImVerbund: showImVerbund() } : null,
      slave: slave?.stand() ?? null,
    };
  }
```

- [ ] **Step 7: Texte als reine Funktionen** (`apps/launcher/src/renderer/src/lib/verbund-texte.ts`)

Ersetzung 1 (`:1`), Vorher:
```ts
import type { KoppelAntwort, VerbundClientStand, VerbundFehlerCode } from '@shared/types';
```
Nachher:
```ts
import type { KoppelAntwort, VerbundClientStand, VerbundFehlerCode, VerbundShowStand } from '@shared/types';
```

Ersetzung 2 (Dateiende, Ist `:137-140`), Vorher:
```ts
/** C4: dauerhafter Schreibfehler von verbund.json am Master (speicherFehler, Endprüfung B6). */
export function speicherFehlerText(code: string): string {
  return `Verbund nicht gespeichert (${kuerze(code, MAX_CODE)}) — Änderungen gelten nur bis zum Neustart`;
}
```
Nachher:
```ts
/** C4: dauerhafter Schreibfehler von verbund.json am Master (speicherFehler, Endprüfung B6). */
export function speicherFehlerText(code: string): string {
  return `Verbund nicht gespeichert (${kuerze(code, MAX_CODE)}) — Änderungen gelten nur bis zum Neustart`;
}

// ── Teil 2b R2, Spec 15.5: Show-Daten im Verbund-Modal am Master (wörtlich) ──

/**
 * Zeile unter „Gekoppelte Rechner“ je nach `grund` des zuletzt verteilten Stands; `rot` bei zu-gross und nicht-lesbar.
 * Bei genau einem Bezieher „1 Tool bezieht sie“ (Owner 08.10.2026), sonst wörtlich 15.5 „⟨n⟩ Tools beziehen sie“.
 */
export function verbundShowZeile(s: VerbundShowStand, uhrzeit: (ms: number) => string): { text: string; rot: boolean } {
  switch (s.grund) {
    case 'keine-show':
      return { text: 'Show im Verbund: keine Show offen', rot: false };
    case 'zu-gross':
      return { text: `Show „${s.showName ?? ''}“ nicht verteilt: zu groß für den Verbund (${s.groesseKiB ?? 0} KiB)`, rot: true };
    case 'nicht-lesbar':
      return { text: `Show „${s.dateiName ?? ''}“ nicht verteilt: nicht lesbar`, rot: true };
    default:
      return {
        text: `Show im Verbund: „${s.showName ?? ''}“ · Stand ${s.verteiltAm === null ? '–' : uhrzeit(s.verteiltAm)} · ${s.bezieher === 1 ? '1 Tool bezieht sie' : `${s.bezieher} Tools beziehen sie`}`,
        rot: false,
      };
  }
}

/** Die drei Tools, die in 2b Show-Daten anwenden (Spec 15.5); andere zeigen nichts dazu. */
const DATEN_TOOLS: ReadonlySet<string> = new Set(['jm-timer', 'jm-titler', 'jm-rundown']);
/** Spec 15.5: so lange nach der Anmeldung gilt ein fehlendes Abo noch nicht als „Update nötig“. */
export const OHNE_DATEN_NACH_MS = 10_000;

/**
 * Je Tool in der Liste der gekoppelten Rechner (Spec 15.5): mit Abo „bezieht Show-Daten“; ohne Abo 10 s nach der
 * Anmeldung „ohne Show-Daten (Update nötig)“, davor nichts. Andere Tools: null.
 */
export function toolDatenText(appId: string, verbundenSeit: number, bezieht: boolean, jetzt: number): string | null {
  if (!DATEN_TOOLS.has(appId)) return null;
  if (bezieht) return 'bezieht Show-Daten';
  return jetzt - verbundenSeit >= OHNE_DATEN_NACH_MS ? 'ohne Show-Daten (Update nötig)' : null;
}
```

- [ ] **Step 8: Modal** (`apps/launcher/src/renderer/src/components/VerbundMaster.tsx`)

Ersetzung 1 (`:1-4`), Vorher:
```tsx
import { useState } from 'react';
import { Button, cn } from '@jm/ui';
import type { VerbundStand } from '@shared/types';
import { relativ, speicherFehlerText, uhrzeit, zeigeCode } from '@/lib/verbund-texte';
```
Nachher:
```tsx
import { useEffect, useState } from 'react';
import { Button, cn } from '@jm/ui';
import type { VerbundStand } from '@shared/types';
import { relativ, speicherFehlerText, toolDatenText, uhrzeit, verbundShowZeile, zeigeCode } from '@/lib/verbund-texte';
```

Ersetzung 2 (Ist `:14-15`), Vorher:
```tsx
  const [neu, setNeu] = useState(false);
  const jetzt = Date.now();
```
Nachher:
```tsx
  const [neu, setNeu] = useState(false);
  // Teil 2b R2 (E20): alle 2 s neu zeichnen, solange das Modal offen ist — für die 10-s-Regel „ohne Show-Daten“.
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setJetzt(Date.now()), 2000);
    return () => clearInterval(t);
  }, []);
  const showZeile = m.showImVerbund ? verbundShowZeile(m.showImVerbund, uhrzeit) : null;
```

Ersetzung 3 (Ist `:59-60`), Vorher:
```tsx
      <Abschnitt titel="Gekoppelte Rechner">
        {m.rechner.length === 0 ? (
```
Nachher:
```tsx
      <Abschnitt titel="Gekoppelte Rechner">
        {showZeile && (
          <p className={cn('mb-2 text-xs', showZeile.rot ? 'text-[var(--destructive)]' : 'text-[var(--muted-foreground)]')}>
            {showZeile.text}
          </p>
        )}
        {m.rechner.length === 0 ? (
```

Ersetzung 4 (Ist `:89-93`), Vorher:
```tsx
                    {r.tools.map((t) => (
                      <li key={t.appId} className="text-[11px] text-[var(--muted-foreground)]">
                        {t.name} {t.version} · verbunden seit {uhrzeit(t.verbundenSeit)}
                      </li>
                    ))}
```
Nachher:
```tsx
                    {r.tools.map((t) => {
                      // Spec 15.5; Tools auf dem Master-Rechner abonnieren nicht (16.1) — dort keine Zeile dazu.
                      const daten = r.dieserRechner ? null : toolDatenText(t.appId, t.verbundenSeit, t.bezieht, jetzt);
                      return (
                        <li key={t.appId} className="text-[11px] text-[var(--muted-foreground)]">
                          {t.name} {t.version} · verbunden seit {uhrzeit(t.verbundenSeit)}
                          {daten && (
                            <>
                              {' · '}
                              <span className={t.bezieht ? undefined : 'text-[var(--warning)]'}>{daten}</span>
                            </>
                          )}
                        </li>
                      );
                    })}
```
Das Modal wird nur gezeichnet, solange es offen ist; der 2-s-Takt endet mit ihm (`clearInterval` beim Aushängen).

- [ ] **Step 9: Tests laufen lassen (grün)**

```
npm run selftest:verbund -w @jm/launcher
npm run selftest -w @jm/launcher
```
Erwartet, je Exitcode 0:
```
203 ok, 0 fehlgeschlagen.
53 ok, 0 fehlgeschlagen.
```
```
113 ok, 0 fehlgeschlagen.
```
(Der Launcher-Selbsttest unter `node --experimental-strip-types` bleibt bei 113: `verbund-texte.ts` hat weiter nur Typ-Importe.)

- [ ] **Step 10: Gegenprobe Einzahl (nicht committen)**

In `apps/launcher/src/renderer/src/lib/verbund-texte.ts` vorübergehend ``${s.bezieher === 1 ? '1 Tool bezieht sie' : `${s.bezieher} Tools beziehen sie`}`` durch ``${s.bezieher} Tools beziehen sie`` ersetzen (15.5 wörtlich, auch bei einem Bezieher), dann `npx tsx apps/launcher/test/verteiler.test.ts`. Erwartet, Exitcode 1, genau:
```
FAIL  Nr. 10: genau ein Bezieher → „· 1 Tool bezieht sie“ (Owner 08.10.2026)
52 ok, 1 fehlgeschlagen.
```
Zurückbauen; derselbe Lauf zeigt wieder `53 ok, 0 fehlgeschlagen.`

- [ ] **Step 11: Typecheck und Build**

```
npm run typecheck -w @jm/launcher
npm run build -w @jm/launcher
```
Erwartet: beide Exitcode 0 (Typecheck node und web; Build gemessen 4 bis 15 s).

- [ ] **Step 12: Commit** (Bash-Werkzeug)

```
git add apps/launcher/src/shared/types.ts apps/launcher/src/main/verbund/master.ts apps/launcher/src/main/verbund/kern.ts apps/launcher/src/renderer/src/lib/verbund-texte.ts apps/launcher/src/renderer/src/components/VerbundMaster.tsx apps/launcher/test/verteiler.test.ts apps/launcher/test/verbund.test.ts
git status --short
```
Erwartet genau:
```
M  apps/launcher/src/main/verbund/kern.ts
M  apps/launcher/src/main/verbund/master.ts
M  apps/launcher/src/renderer/src/components/VerbundMaster.tsx
M  apps/launcher/src/renderer/src/lib/verbund-texte.ts
M  apps/launcher/src/shared/types.ts
M  apps/launcher/test/verbund.test.ts
M  apps/launcher/test/verteiler.test.ts
```
Dann:
```
git commit -m "feat(launcher): Verbund-Modal zeigt die Show im Verbund und je Tool die Show-Daten (Teil 2b R2)" -m "Spec 15.5: Zeile Show im Verbund unter Gekoppelte Rechner (mit Show, bei genau einem Bezieher 1 Tool bezieht sie nach Owner-Entscheid, keine Show offen, zu gross rot mit KiB, nicht lesbar rot mit Dateiname) und je Timer, Titler, Rundown bezieht Show-Daten bzw. nach 10 s ohne Abo ohne Show-Daten (Update noetig). Texte als reine Funktionen in verbund-texte.ts (verteiler.test.ts Nr. 10), der Kern setzt showImVerbund aus dem Verteiler, die MasterRolle bezieht je Sitzung. Das Modal zeichnet alle 2 s neu (E20)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- `showImVerbund` setzt der Kern, `MasterRolle.stand()` liefert `null` (E40).
- Keine Daten-Zeile bei „dieser Rechner“ (E43); die Regel steht im Aufrufer, `toolDatenText` behält die Register-Signatur. Zusätzlich exportiert: `OHNE_DATEN_NACH_MS`.
- Bei genau einem Bezieher heißt es „1 Tool bezieht sie“ statt 15.5 wörtlich „1 Tools beziehen sie“ (Owner-Antwort vom 08.10.2026 auf Owner-Frage 3, N16); sonst wörtlich „⟨n⟩ Tools beziehen sie“. Eine Prüfung in Nr. 10, Gegenprobe in Step 10 (gemessen: genau diese `FAIL`-Zeile).
- `verbund.test.ts`-Zählstände beim Durchspielen des ganzen Plans nachgemessen (echter Server und Client aus C3/C4): gleich.

---

### Task 11: C11 · `@jm/app-runtime`: Typen, Anzeige V1–V15, Paket-Gerüst und CI-Schritt

**Spec:** 16.2 (Typen; „`@jm/app-runtime` bekommt `@jm/show` als Abhängigkeit“), 16.4 (Anzeige V1–V15, Vorrang V12 vor V15 vor allen anderen, Zusatz L, ⟨S⟩ höchstens 40 Zeichen, V11 für jeden `FehlerCode`, Uhrzeit dieses Rechners), 19.4 erster Punkt, 19.6 (CI-Schritt), 21 (Aufbau); G2, G5, G7, G11, G12, G16; E27.

**Arbeitsverzeichnis:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b-r2`, Branch `feat/master-link-teil2b-r2`. Alle Pfade relativ dazu, Befehle im Worktree-Wurzelordner (Git Bash). Voraussetzung: C1–C10 sind committet. Aus Block A gebraucht: `DatenGrund` (C2) und für den Typecheck die übrigen S-A-Namen.

**Dateien:**
- Commit 1 (G2, eigener Commit):
  - Modify: `packages/app-runtime/package.json:10-16` (Skript `selftest`, Abhängigkeit `@jm/show`, neu `devDependencies` mit `tsx`)
  - Modify: `package-lock.json:17400-17409` (nur der Block `"packages/app-runtime"`; npm zieht ihn nach)
- Commit 2:
  - Create: `packages/app-runtime/src/verbund-typen.ts`
  - Create: `packages/app-runtime/src/verbund-anzeige.ts`
  - Create: `packages/app-runtime/test/verbund.test.ts`
  - Modify: `.github/workflows/ci-checks.yml:92-93` (der 4b-Schritt „App-Laufzeit (Log-Aufräumen, CSP)“, zuletzt im Job `selftests`, wird umbenannt; kein zweiter Schritt, G2, N26)

**Interfaces:**

Consumes (exakt):
```ts
// C2 · packages/master-link/src/show-daten.ts (über packages/master-link/src/index.ts)
export type DatenGrund = 'keine-show' | 'zu-gross' | 'nicht-lesbar';
// bestehend · packages/master-link/src/client.ts und fehler.ts
export type ClientZustand =
  | { art: 'aus' } | { art: 'sucht' } | { art: 'verbindet'; adresse: string }
  | { art: 'verbunden'; adresse: string; seit: number; masterName: string; suite: string }
  | { art: 'fehler'; code: FehlerCode; text: string; errCode?: string };
export type FehlerCode = 'zeit' | 'nicht-gefunden' | 'verweigert' | 'netz' | 'kein-master' | 'zertifikat' | 'uhr'
  | 'protokoll' | 'unbekannt' | 'signatur' | 'ersetzt' | 'datei' | 'sonstig';
export function fehlerText(code: FehlerCode, k: TextKontext): string;   // nur im Test (V11)
// bestehend · packages/show/src/index.ts (nur als Typ)
export interface Show { schemaVersion: number; name: string; updatedAt?: string; tools: ShowToolRef[]; ablauf?: ShowAblaufItem[]; iveo?: ShowIveoBinding }
```

Produces (S-C; über `src/index.ts` erst ab C13 öffentlich):
```ts
// packages/app-runtime/src/verbund-typen.ts — nur Typen, MasterStand und VerbundDaten wörtlich Spec 16.2
export interface MasterStand { masterId: string; masterName: string; epoche: string; folge: number; schluessel: string | null;
  show: Show | null; grund?: DatenGrund; mitDokument: string[]; empfangenAm: number }
export type VerbundDaten = { art: 'einzelplatz' } | ({ art: 'warte' } & MitStand) | ({ art: 'ohne-daten' } & MitStand)
  | ({ art: 'aktuell'; letzter: MasterStand } & MitStand) | ({ art: 'getrennt'; client: ClientZustand } & MitStand)
  | ({ art: 'frueher'; grund: 'entkoppelt' | 'datei' } & MitStand) | { art: 'datei-defekt' };
export interface VerbundKopplung { rolle: 'aus' | 'master' | 'slave'; masterId: string | null; masterName: string | null;
  masterAdresse: string | null; adressen: string[]; letzteAdresse: string | null }
export interface VerbundAnzeige { text: string; farbe: 'gruen' | 'gelb' | 'rot' | 'gedaempft' }
export interface FolgeHandler { anwenden(stand: MasterStand & { show: Show }, neueShow: boolean): void; beiWechsel?(d: VerbundDaten): void }
// packages/app-runtime/src/verbund-anzeige.ts — rein, ohne Electron
export function verbundAnzeige(d: VerbundDaten, uhrzeit?: (ms: number) => string): VerbundAnzeige | null;  // Vorgabe hh:mm, Ortszeit
export function kuerzeShowName(name: string): string;   // höchstens 40 Code Points, sonst 39 + „…“
```
C12 und C13 bauen darauf. C19 (Kette) importiert `verbund-anzeige.ts` per Relativpfad (S-E).

**Regeln:** G2 (nur neue Dateien; `package.json`/`package-lock.json` als eigener Commit; genau ein CI-Schritt für app-runtime: der aus 4b, umbenannt), G5 (V1–V15 wörtlich), G7 (Test mit `tsx`, lädt kein Electron), G11, G12, G16.

**Vorab (gemessen):**
- Alle berührten Dateien liegen im Worktree mit CRLF vor (gezählt auf `adda584693`: `package.json` 19 von 19 Zeilen, `package-lock.json` 17 656 von 17 656, `ci-checks.yml` 124 von 124). npm behält beim Nachziehen die CRLF des Lockfiles (danach 17 660 von 17 660; `package.json` 23 von 23, `ci-checks.yml` nach Step 12 126 von 126).
- `npm install --package-lock-only --ignore-scripts --offline` braucht etwa 1,5 s. `node_modules/tsx` (4.22.4) steht schon im Lockfile, weil `@jm/master-link` und `@jm/titler` es führen; es wird nichts geladen. Geändert wird nur der Block `"packages/app-runtime"`.
- Bis C13 bindet `src/index.ts` die neuen Module nicht ein; `npm run typecheck --workspaces --if-present` sieht sie also noch nicht. Step 10 prüft sie deshalb direkt mit `tsc` und den Optionen der App-`tsconfig.node.json` (`strict`, `isolatedModules`, `moduleResolution: Bundler`, `types: node`). Gegenprobe: ein absichtlicher Typfehler in einer übergebenen Datei ergibt `error TS2322` und Exit-Code 2.
- `test/verbund.test.ts` lädt jedes Modul mit `await import(…)` **innerhalb eines Blocks `{ … }`** (Muster aus R1, Titler-Selbsttest). Fehlt das Modul einer späteren Aufgabe, laufen die Blöcke davor durch, dann bricht der Lauf mit `ERR_MODULE_NOT_FOUND` ab. `packages/app-runtime/package.json` hat `"type": "module"`; `await` auf oberster Ebene geht.
- Ausgabe wie im CSP-Test: `  ok  <Name>` bzw. `FAIL  <Name> — <Detail>`, am Ende `<n> passed, <m> failed`. Die Uhrzeit ist im Test eine feste Funktion (`U<ms>`), damit ⟨hh:mm⟩ nicht von der Zeitzone abhängt; die Vorgabe-Uhrzeit prüft ein eigener Fall mit einer Ortszeit.

---

- [ ] **Step 1: `package.json` erweitern**

In `packages/app-runtime/package.json` ersetzen (Edit-Werkzeug, G12).

Vorher (`packages/app-runtime/package.json`, genau einmal):
```json
  "scripts": {
    "selftest": "node --experimental-strip-types test/selftest.ts"
  },
  "dependencies": {
    "@jm/master-link": "*"
  },
  "peerDependencies": {
```

Nachher:
```json
  "scripts": {
    "selftest": "node --experimental-strip-types test/selftest.ts && tsx test/verbund.test.ts"
  },
  "dependencies": {
    "@jm/master-link": "*",
    "@jm/show": "*"
  },
  "devDependencies": {
    "tsx": "^4.19.2"
  },
  "peerDependencies": {
```

- [ ] **Step 2: Lockfile nachziehen und prüfen**

```bash
npm install --package-lock-only --ignore-scripts --offline
git diff --stat
git diff package-lock.json
```
Erwartet: `npm install` endet mit `found 0 vulnerabilities`, Exit-Code 0. `git diff --stat` nennt genau zwei Dateien: `package-lock.json` mit 6 Zeilen (5 dazu, 1 weg) und `packages/app-runtime/package.json` mit 8 Zeilen (6 dazu, 2 weg). `git diff package-lock.json` zeigt genau diesen einen Abschnitt:
```diff
@@ -17401,7 +17401,11 @@
       "name": "@jm/app-runtime",
       "version": "0.1.1",
       "dependencies": {
-        "@jm/master-link": "*"
+        "@jm/master-link": "*",
+        "@jm/show": "*"
+      },
+      "devDependencies": {
+        "tsx": "^4.19.2"
       },
       "peerDependencies": {
         "electron": ">=30"
```
Meldet npm `ENOTCACHED` oder zeigt der Diff mehr als diesen Abschnitt, hier anhalten und melden (G16); nicht ohne `--offline` wiederholen. (Nachgemessen am 12.10.2026 auf `adda584693` mit dem eingespielten Abschnitt, npm lief in der Kopie nicht: Hunk-Kopf wie oben, `package-lock.json` +5/−1, `packages/app-runtime/package.json` +6/−2, N28.)

- [ ] **Step 3: Lauf zeigt, dass das Skript schon auf den neuen Test zeigt (erwartet rot)**

```bash
npm run selftest -w @jm/app-runtime
```
Erwartet: der CSP-Teil (mit Log-Aufräumen aus Zoom 4b) wie bisher mit `50 passed, 0 failed`, danach bricht `tsx` ab, Exit-Code 1:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\packages\app-runtime\test\verbund.test.ts' imported from …\packages\app-runtime\
```
Das ist so gewollt: Den Test legt Commit 2 an. Die CI ruft das Skript erst mit dem Schritt aus Step 12 auf, der ebenfalls in Commit 2 kommt.

- [ ] **Step 4: Commit 1** (Git Bash; Commit-Text bewusst ohne Umlaute)

```bash
git add packages/app-runtime/package.json package-lock.json
git status --short
```
Erwartet genau:
```
M  package-lock.json
M  packages/app-runtime/package.json
```
Dann:
```bash
git commit -m "chore(app-runtime): @jm/show und tsx fuer den Verbund der Tool-Seite (Teil 2b R2)" -m "Eigener Commit nach dem Plan (G2): Paket und Lockfile getrennt vom Code. selftest ruft danach zusaetzlich tsx test/verbund.test.ts; der Test folgt im naechsten Commit. Lockfile nur im Block packages/app-runtime nachgezogen (npm install --package-lock-only --ignore-scripts --offline)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Failing Test schreiben**

Neue Datei `packages/app-runtime/test/verbund.test.ts`, ganzer Inhalt:
```ts
// Selbsttest Verbund der Tool-Seite (Master-Link Teil 2b, Release 2, Spec 19.4) — ohne Electron, mit tsx:
//   npm run selftest -w @jm/app-runtime      (läuft nach dem CSP-Test aus test/selftest.ts)
//
// Jeder Block lädt seine Module mit `await import(…)` INNERHALB des Blocks. Fehlt das Modul einer
// späteren Aufgabe, laufen die Blöcke davor durch, dann bricht der Lauf mit ERR_MODULE_NOT_FOUND ab.
// Blöcke späterer Aufgaben kommen direkt vor die Zeile „// ── Abschluss“.
// Kein Test lädt Electron (die CI installiert ohne Postinstalls), keiner öffnet einen Socket.

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

// ── C11 · Anzeige V1–V15 (Spec 16.4) ─────────────────────────────────────────
{
  const { verbundAnzeige, kuerzeShowName } = await import('../src/verbund-anzeige');
  const { fehlerText } = await import('@jm/master-link');
  const uhr = (ms: number): string => `U${ms}`; // feste „Uhrzeit“: macht ⟨hh:mm⟩ im Test eindeutig
  const show = (name: string) => ({ schemaVersion: 1, name, tools: [] });
  const A = { masterId: 'M1', masterName: 'Regie-PC', epoche: 'e1', folge: 3, schluessel: 'aaaaaaaaaaaaaaaa', show: show('Gala'), mitDokument: [], empfangenAm: 1000 };
  const L = ' · letzter Stand: Gala U1000';
  const mit = (angewendet: typeof A | null, extra: Record<string, unknown> = {}) => ({ masterName: 'Regie-PC', angewendet, ...extra });
  const zeile = (d: unknown) => verbundAnzeige(d as never, uhr);
  const gleich = (name: string, d: unknown, text: string, farbe: string): void => {
    const a = zeile(d);
    check(name, a !== null && a.text === text && a.farbe === farbe, a);
  };

  check('C11 V1: einzelplatz → keine Anzeige', zeile({ art: 'einzelplatz' }) === null);
  gleich('C11 V2 ohne angewendet', { art: 'warte', ...mit(null) }, 'Verbunden mit Regie-PC · Show wird geladen…', 'gelb');
  gleich('C11 V2 mit angewendet (Zusatz L)', { art: 'warte', ...mit(A) }, `Verbunden mit Regie-PC · Show wird geladen…${L}`, 'gelb');
  gleich('C11 V3 ohne angewendet', { art: 'ohne-daten', ...mit(null) }, 'Regie-PC antwortet nicht auf die Anfrage nach Show-Daten (Launcher-Update am Master nötig?)', 'gelb');
  gleich('C11 V3 mit angewendet', { art: 'ohne-daten', ...mit(A) }, `Regie-PC antwortet nicht auf die Anfrage nach Show-Daten (Launcher-Update am Master nötig?)${L}`, 'gelb');
  const neuer = { ...A, folge: 4, show: show('Gala neu'), empfangenAm: 2000 };
  gleich('C11 V4 mit angewendet: Name und Zeit des ANGEWENDETEN Stands', { art: 'aktuell', letzter: neuer, ...mit(A) }, 'Show vom Master: Gala · Stand U1000', 'gruen');
  gleich('C11 V4 ohne angewendet: Name und Zeit des empfangenen Stands', { art: 'aktuell', letzter: neuer, ...mit(null) }, 'Show vom Master: Gala neu · Stand U2000', 'gruen');
  gleich('C11 V4 angewendet von anderem Master → empfangener Stand', { art: 'aktuell', letzter: { ...neuer, masterId: 'M2' }, ...mit(A) }, 'Show vom Master: Gala neu · Stand U2000', 'gruen');
  const ohne = (grund: string) => ({ ...A, folge: 5, show: null, grund, empfangenAm: 3000 });
  gleich('C11 V5 keine-show, etwas angewendet', { art: 'aktuell', letzter: ohne('keine-show'), ...mit(A) }, `Regie-PC hat keine Show offen${L}`, 'gelb');
  gleich('C11 V6 keine-show, nichts angewendet', { art: 'aktuell', letzter: ohne('keine-show'), ...mit(null) }, 'Regie-PC hat keine Show offen', 'gedaempft');
  gleich('C11 V7 zu-gross mit angewendet', { art: 'aktuell', letzter: ohne('zu-gross'), ...mit(A) }, `Show am Master zu groß für den Verbund${L}`, 'rot');
  gleich('C11 V7 zu-gross ohne angewendet', { art: 'aktuell', letzter: ohne('zu-gross'), ...mit(null) }, 'Show am Master zu groß für den Verbund', 'rot');
  gleich('C11 V8 nicht-lesbar mit angewendet', { art: 'aktuell', letzter: ohne('nicht-lesbar'), ...mit(A) }, `Show am Master nicht lesbar${L}`, 'rot');
  gleich('C11 V8 nicht-lesbar ohne angewendet', { art: 'aktuell', letzter: ohne('nicht-lesbar'), ...mit(null) }, 'Show am Master nicht lesbar', 'rot');
  for (const client of [{ art: 'sucht' }, { art: 'verbindet', adresse: '10.0.0.5' }, { art: 'aus' }]) {
    gleich(`C11 V9 getrennt (${client.art}), etwas angewendet`, { art: 'getrennt', client, ...mit(A) }, `Regie-PC nicht verbunden${L}`, 'gelb');
    gleich(`C11 V10 getrennt (${client.art}), nichts angewendet`, { art: 'getrennt', client, ...mit(null) }, 'Suche Regie-PC…', 'gelb');
  }
  const CODES = ['zeit', 'nicht-gefunden', 'verweigert', 'netz', 'kein-master', 'zertifikat', 'uhr', 'protokoll', 'unbekannt', 'signatur', 'ersetzt', 'datei', 'sonstig'] as const;
  for (const code of CODES) {
    const text = fehlerText(code, { masterName: 'Regie-PC', adresse: '10.0.0.5', errCode: 'EXYZ', suite: '0.14.0', masterProtokoll: 1 });
    const client = { art: 'fehler', code, text };
    gleich(`C11 V11 ${code}: Text des Clients unverändert`, { art: 'getrennt', client, ...mit(null) }, text, 'rot');
    gleich(`C11 V11 ${code}: Text des Clients + Zusatz L`, { art: 'getrennt', client, ...mit(A) }, `${text}${L}`, 'rot');
  }
  check('C11 V11: 13 verschiedene Client-Texte geprüft', new Set(CODES.map((c) => fehlerText(c, { masterName: 'Regie-PC' }))).size === 13);
  gleich('C11 V12 ohne angewendet', { art: 'warte', ...mit(null, { fehler: 'EBUSY' }) }, 'Show vom Master nicht übernommen: EBUSY', 'rot');
  gleich('C11 V12 mit angewendet: „in Benutzung“ statt Zusatz L', { art: 'aktuell', letzter: neuer, ...mit(A, { fehler: 'EBUSY' }) }, 'Show vom Master nicht übernommen: EBUSY · in Benutzung: Gala U1000', 'rot');
  gleich('C11 V13 entkoppelt gelb', { art: 'frueher', grund: 'entkoppelt', ...mit(A) }, `Daten vom früheren Master Regie-PC (nicht mehr gekoppelt)${L}`, 'gelb');
  gleich('C11 V13 datei rot', { art: 'frueher', grund: 'datei', ...mit(A) }, `Kopplungsdatei beschädigt. Neu koppeln.${L}`, 'rot');
  gleich('C11 V14 datei-defekt', { art: 'datei-defekt' }, 'Kopplungsdatei beschädigt. Neu koppeln.', 'rot');
  const verworfen = { grund: 'folge', seit: 5 };
  gleich('C11 V15 ohne angewendet', { art: 'warte', ...mit(null, { verworfen }) }, 'Show-Daten von Regie-PC nicht lesbar (Tool-Update nötig?)', 'rot');
  gleich('C11 V15 mit angewendet', { art: 'aktuell', letzter: neuer, ...mit(A, { verworfen }) }, `Show-Daten von Regie-PC nicht lesbar (Tool-Update nötig?)${L}`, 'rot');

  // Vorrang V12 > V15 > alle anderen, in jeder Lage außer einzelplatz/datei-defekt
  const lagen = [
    { art: 'warte' }, { art: 'ohne-daten' }, { art: 'aktuell', letzter: neuer }, { art: 'aktuell', letzter: ohne('zu-gross') },
    { art: 'getrennt', client: { art: 'sucht' } }, { art: 'getrennt', client: { art: 'fehler', code: 'netz', text: 'Netz weg' } },
    { art: 'frueher', grund: 'entkoppelt' }, { art: 'frueher', grund: 'datei' },
  ];
  check('C11 Vorrang: V12 vor V15 vor allen anderen', lagen.every((l) => zeile({ ...l, ...mit(A, { fehler: 'EBUSY', verworfen }) })?.text.startsWith('Show vom Master nicht übernommen: EBUSY')));
  check('C11 Vorrang: V15 vor allen anderen', lagen.every((l) => zeile({ ...l, ...mit(A, { verworfen }) })?.text.startsWith('Show-Daten von Regie-PC nicht lesbar')));
  const mitZusatz = lagen.filter((l) => l !== lagen[2]); // alle außer V4 (aktuell mit Show)
  check(
    'C11 Zusatz L genau dann, wenn angewendet nicht null (sieben Lagen)',
    mitZusatz.length === 7 && mitZusatz.every((l) => zeile({ ...l, ...mit(A) })!.text.endsWith(L) && !zeile({ ...l, ...mit(null) })!.text.includes(' · letzter Stand: ')),
  );
  check('C11 V4 hat keinen Zusatz L', !zeile({ art: 'aktuell', letzter: neuer, ...mit(A) })!.text.includes('letzter Stand'));

  // ⟨S⟩: höchstens 40 Zeichen (Code Points)
  const n40 = 'A'.repeat(40);
  check('C11 kuerzeShowName: 40 Zeichen bleiben', kuerzeShowName(n40) === n40);
  check('C11 kuerzeShowName: 41 → 39 + …', kuerzeShowName('B'.repeat(41)) === `${'B'.repeat(39)}…`);
  const emoji = `${'C'.repeat(39)}🎬`;
  check('C11 kuerzeShowName: Emoji an Stelle 40 bleibt ganz', kuerzeShowName(emoji) === emoji);
  const emoji41 = `${'C'.repeat(38)}🎬🎤X`;
  check('C11 kuerzeShowName: 41 Code Points mit Emoji → 39 + …, kein halbes Emoji', kuerzeShowName(emoji41) === `${'C'.repeat(38)}🎬…`);
  const lang = { ...A, show: show('D'.repeat(50)) };
  check('C11 lange Shownamen werden in jeder Zeile gekürzt', zeile({ art: 'warte', ...mit(lang) })!.text.endsWith(`${'D'.repeat(39)}… U1000`));
  // Vorgabe-Uhrzeit: hh:mm in Ortszeit dieses Rechners
  const ortszeit = new Date(2026, 9, 8, 9, 5, 0).getTime();
  const v4 = verbundAnzeige({ art: 'aktuell', letzter: { ...A, empfangenAm: ortszeit }, ...mit({ ...A, empfangenAm: ortszeit }) } as never);
  check('C11 Vorgabe-Uhrzeit hh:mm (Ortszeit)', v4?.text === 'Show vom Master: Gala · Stand 09:05', v4);
}

// ── Abschluss ────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 6: Test laufen lassen, er muss scheitern**

```bash
npm run selftest -w @jm/app-runtime
```
Erwartet: `50 passed, 0 failed` aus dem CSP-Teil, dann keine `C11`-Zeile und Abbruch beim Laden, Exit-Code 1:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\packages\app-runtime\src\verbund-anzeige' imported from …\packages\app-runtime\test\verbund.test.ts
```

- [ ] **Step 7: Typen anlegen**

Neue Datei `packages/app-runtime/src/verbund-typen.ts`, ganzer Inhalt:
```ts
// ─────────────────────────────────────────────────────────────────────────────
// Verbund der Tool-Seite: Typen (Master-Link Teil 2b, Release 2, Spec 16.2).
//
// Nur Typen, kein Laufzeitcode. `VerbundDaten` heißt hier wie in Spec 16.2; @jm/master-link
// exportiert einen gleichnamigen ANDEREN Typ (speicher.ts, Teilnehmerliste des Masters).
// Deshalb importiert app-runtime aus @jm/master-link nur einzeln benannte Typen und
// re-exportiert das Paket nie als Ganzes (E27).
// ─────────────────────────────────────────────────────────────────────────────
import type { Show } from '@jm/show';
import type { ClientZustand, DatenGrund } from '@jm/master-link';

/** Ein Stand vom Master, wie das Tool ihn empfangen bzw. angewendet hat (Spec 16.2). */
export interface MasterStand {
  masterId: string;
  masterName: string;
  epoche: string;
  folge: number;
  schluessel: string | null;
  show: Show | null; // nach migrateShow
  grund?: DatenGrund; // 'keine-show' | 'zu-gross' | 'nicht-lesbar', genau dann, wenn show null ist
  mitDokument: string[]; // appIds mit Dokument am Master (13.1)
  empfangenAm: number; // ms, Uhr dieses Rechners (16.4, G13)
}

interface MitStand {
  masterName: string;
  angewendet: MasterStand | null; // zuletzt angewendeter Stand (auch aus dem Zwischenspeicher)
  fehler?: string; // Grund, wenn anwenden zuletzt geworfen hat
  verworfen?: { grund: string; seit: number }; // letzter eingehender Stand ungültig (13.2)
}

export type VerbundDaten =
  | { art: 'einzelplatz' }
  | ({ art: 'warte' } & MitStand) // verbunden, Abo gesendet, noch keine Antwort (≤ 5 s)
  | ({ art: 'ohne-daten' } & MitStand) // verbunden, 5 s ohne Antwort; Abo alle 30 s erneut (13.3)
  | ({ art: 'aktuell'; letzter: MasterStand } & MitStand)
  | ({ art: 'getrennt'; client: ClientZustand } & MitStand)
  | ({ art: 'frueher'; grund: 'entkoppelt' | 'datei' } & MitStand) // Ende des Verbundmodus, Daten stehen noch (16.1)
  | { art: 'datei-defekt' }; // Datei beschädigt, keine Master-Daten im Tool

export interface VerbundKopplung {
  rolle: 'aus' | 'master' | 'slave';
  masterId: string | null;
  masterName: string | null;
  masterAdresse: string | null; // Adresse der laufenden Verbindung, sonst null
  adressen: string[]; // aus dem letzten `angemeldet` (13.7)
  letzteAdresse: string | null; // vom Client: Adresse der letzten Verbindung, sonst aus master-link.json (E6)
}

/** Eine Zeile der Anzeige V2–V15 (16.4); `null` = keine Anzeige (V1). */
export interface VerbundAnzeige {
  text: string;
  farbe: 'gruen' | 'gelb' | 'rot' | 'gedaempft';
}

/** Was ein Tool an `folgeMasterShow` übergibt (16.2). */
export interface FolgeHandler {
  /** Nur mit show !== null. Wirft = nicht angewendet. */
  anwenden(stand: MasterStand & { show: Show }, neueShow: boolean): void;
  beiWechsel?(d: VerbundDaten): void;
}
```

- [ ] **Step 8: Anzeige anlegen**

Neue Datei `packages/app-runtime/src/verbund-anzeige.ts`, ganzer Inhalt:
```ts
// ─────────────────────────────────────────────────────────────────────────────
// Verbund der Tool-Seite: Anzeige V1–V15 (Master-Link Teil 2b, Release 2, Spec 16.4).
//
// Rein, ohne Electron. Dauerhafte Anzeigen lügen, wenn ein Zustand vergessen wurde (#208):
// darum prüft die Funktion den Union-Typ vollständig (`never`), und der Selbsttest prüft
// jede Zeile wörtlich. Vorrang: V12 (fehler) vor V15 (verworfen) vor allen anderen.
// ⟨S⟩ ⟨hh:mm⟩ = Showname (höchstens 40 Zeichen) und Empfangszeit auf der Uhr DIESES Rechners.
// ─────────────────────────────────────────────────────────────────────────────
import type { MasterStand, VerbundAnzeige, VerbundDaten } from './verbund-typen';

const SHOWNAME_MAX = 40;

/** Höchstens 40 Zeichen (Code Points, ein Emoji wird nie zerteilt), sonst 39 + „…“. */
export function kuerzeShowName(name: string): string {
  const zeichen = Array.from(name);
  return zeichen.length <= SHOWNAME_MAX ? name : `${zeichen.slice(0, SHOWNAME_MAX - 1).join('')}…`;
}

function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function verbundAnzeige(d: VerbundDaten, uhrzeit: (ms: number) => string = hhmm): VerbundAnzeige | null {
  if (d.art === 'einzelplatz') return null;
  if (d.art === 'datei-defekt') return { text: 'Kopplungsdatei beschädigt. Neu koppeln.', farbe: 'rot' };

  const sz = (s: MasterStand): string => `${kuerzeShowName(s.show?.name ?? '')} ${uhrzeit(s.empfangenAm)}`;
  const m = d.masterName;
  const a = d.angewendet;
  /** Zusatz L: genau dann, wenn etwas angewendet ist. */
  const L = a ? ` · letzter Stand: ${sz(a)}` : '';

  if (d.fehler !== undefined) {
    return { text: `Show vom Master nicht übernommen: ${d.fehler}${a ? ` · in Benutzung: ${sz(a)}` : ''}`, farbe: 'rot' }; // V12
  }
  if (d.verworfen) return { text: `Show-Daten von ${m} nicht lesbar (Tool-Update nötig?)${L}`, farbe: 'rot' }; // V15

  switch (d.art) {
    case 'warte':
      return { text: `Verbunden mit ${m} · Show wird geladen…${L}`, farbe: 'gelb' }; // V2
    case 'ohne-daten':
      return { text: `${m} antwortet nicht auf die Anfrage nach Show-Daten (Launcher-Update am Master nötig?)${L}`, farbe: 'gelb' }; // V3
    case 'aktuell': {
      const l = d.letzter;
      if (l.show) {
        // V4: Name und Uhrzeit des ANGEWENDETEN Stands; nur ohne angewendeten Stand dieses Masters die des empfangenen.
        const s = a && a.masterId === l.masterId ? a : l;
        return { text: `Show vom Master: ${kuerzeShowName(s.show?.name ?? '')} · Stand ${uhrzeit(s.empfangenAm)}`, farbe: 'gruen' };
      }
      const grund = l.grund ?? 'keine-show';
      switch (grund) {
        case 'keine-show':
          return a ? { text: `${m} hat keine Show offen${L}`, farbe: 'gelb' } : { text: `${m} hat keine Show offen`, farbe: 'gedaempft' }; // V5 / V6
        case 'zu-gross':
          return { text: `Show am Master zu groß für den Verbund${L}`, farbe: 'rot' }; // V7
        case 'nicht-lesbar':
          return { text: `Show am Master nicht lesbar${L}`, farbe: 'rot' }; // V8
        default: {
          const nie: never = grund;
          return nie;
        }
      }
    }
    case 'getrennt':
      if (d.client.art === 'fehler') return { text: `${d.client.text}${L}`, farbe: 'rot' }; // V11
      return a ? { text: `${m} nicht verbunden${L}`, farbe: 'gelb' } : { text: `Suche ${m}…`, farbe: 'gelb' }; // V9 / V10
    case 'frueher':
      return d.grund === 'entkoppelt'
        ? { text: `Daten vom früheren Master ${m} (nicht mehr gekoppelt)${L}`, farbe: 'gelb' } // V13
        : { text: `Kopplungsdatei beschädigt. Neu koppeln.${L}`, farbe: 'rot' }; // V13 (datei)
    default: {
      const nie: never = d;
      return nie;
    }
  }
}
```

- [ ] **Step 9: Test laufen lassen, er muss bestehen**

```bash
npm run selftest -w @jm/app-runtime
```
Erwartet: `50 passed, 0 failed`, danach 64 Zeilen `  ok  C11 …` (von „C11 V1: einzelplatz → keine Anzeige“ bis „C11 Vorgabe-Uhrzeit hh:mm (Ortszeit)“), keine `FAIL`-Zeile, am Ende `64 passed, 0 failed`, Exit-Code 0.

- [ ] **Step 10: Typprüfung**

Die neuen Module direkt (index.ts bindet sie erst in C13 ein):
```bash
npx tsc --noEmit --strict --isolatedModules --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --types node packages/app-runtime/src/verbund-typen.ts packages/app-runtime/src/verbund-anzeige.ts
```
Erwartet: keine Ausgabe, Exit-Code 0.

Dann alle Workspaces (G11):
```bash
npm run typecheck --workspaces --if-present
```
Erwartet: Exit-Code 0, keine Zeile mit `error TS` (Laufzeit unter 3 min, gemessen 55–125 s).

- [ ] **Step 11: Gegenprobe (nicht committen)**

Je eine Änderung in `packages/app-runtime/src/verbund-anzeige.ts` einspielen, `npx tsx packages/app-runtime/test/verbund.test.ts` laufen lassen, zurückbauen:

| Änderung (Vorher → Nachher) | erwartete `FAIL`-Zeilen |
| --- | --- |
| ``? { text: `${m} hat keine Show offen${L}`, farbe: 'gelb' }`` → ``? { text: `${m} hat keine Show offen${L}`, farbe: 'gedaempft' }`` | 1: „C11 V5 keine-show, etwas angewendet“ |
| ``(nicht mehr gekoppelt)${L}` `` → ``(nicht mehr gekoppelt)` `` | 2: „C11 V13 entkoppelt gelb“, „C11 Zusatz L genau dann, wenn angewendet nicht null (sieben Lagen)“ |

Danach zeigt `npx tsx packages/app-runtime/test/verbund.test.ts` wieder `64 passed, 0 failed`.

- [ ] **Step 12: CI-Schritt umbenennen (19.6, G2)**

In `.github/workflows/ci-checks.yml` ersetzen. Seit dem Neuaufsatz auf `main` (12.10.2026, Basis `adda584693` mit Zoom 4b `2df1f79357`, N25) steht der 4b-Schritt „App-Laufzeit (Log-Aufräumen, CSP)“ mit demselben Befehl `npm run selftest -w @jm/app-runtime` schon zuletzt im Job `selftests`. Spec 19.6 verlangt einen neuen Schritt „app-runtime (CSP, Verbund-Anzeige, Abo-Zustand)“ mit diesem Befehl, der beide Teile ausführt; ein zweiter Schritt mit demselben Befehl liefe dieselben Tests doppelt. C11 hängt deshalb keinen an, sondern benennt diesen um, nach dem Muster, das 4b für den Befehl nutzt („App-Laufzeit (…)“; Abweichung im Wortlaut von 19.6, siehe „Abweichungen“ unten, N40). Der Befehl bleibt gleich; seit Step 1 ruft er zusätzlich `tsx test/verbund.test.ts`. Die Schrittzahl bleibt 22 (13 auf `5f8ed15ef8`, dazu Presenter, Appkit, App Designer aus PR #248, UI-Bausteine und Einstellungs-Abschnitte aus PR #250, Steuerprotokoll, Companion-Modul, Companion-Protokoll aktuell und App-Laufzeit aus PR #251).

Vorher (`.github/workflows/ci-checks.yml`, genau einmal):
```yaml
      - name: App-Laufzeit (Log-Aufräumen, CSP)
        run: npm run selftest -w @jm/app-runtime
```

Nachher:
```yaml
      # Master-Link Teil 2b, Release 2 (Spec 19.6): derselbe Befehl prüft auch den Verbund der Tool-Seite
      # (Anzeige V1–V15, Abo-Zustand, Zwischenspeicher) mit tsx, ohne Electron. Genau ein Schritt dafür.
      - name: App-Laufzeit (Log-Aufräumen, CSP, Verbund-Anzeige, Abo-Zustand)
        run: npm run selftest -w @jm/app-runtime
```

Prüfen, dass die Datei gültiges YAML ist, der Schritt zuletzt im Job steht und es im Job genau einen app-runtime-Schritt gibt:
```bash
node -e "const y=require('js-yaml');const d=y.load(require('fs').readFileSync('.github/workflows/ci-checks.yml','utf8'));const s=d.jobs.selftests.steps;console.log(s.length+' Schritte, letzter: '+s.at(-1).name+' | '+s.at(-1).run+' | app-runtime-Schritte: '+s.filter((x)=>x.run==='npm run selftest -w @jm/app-runtime').length)"
```
Erwartet: `22 Schritte, letzter: App-Laufzeit (Log-Aufräumen, CSP, Verbund-Anzeige, Abo-Zustand) | npm run selftest -w @jm/app-runtime | app-runtime-Schritte: 1` (gemessen am 12.10.2026; der Schritt steht in Zeile 94–95, die Datei hat danach 126 von 126 Zeilen mit CRLF). Gegenprobe (in einer Kopie gemessen, N26): Mit dem früheren Anhängen nach „Connect …“ meldet dieselbe Prüfung `23 Schritte, letzter: App-Laufzeit (Log-Aufräumen, CSP) | npm run selftest -w @jm/app-runtime | app-runtime-Schritte: 2`.

- [ ] **Step 13: Commit 2**

```bash
git add .github/workflows/ci-checks.yml packages/app-runtime/src/verbund-typen.ts packages/app-runtime/src/verbund-anzeige.ts packages/app-runtime/test/verbund.test.ts
git status --short
```
Erwartet genau:
```
M  .github/workflows/ci-checks.yml
A  packages/app-runtime/src/verbund-anzeige.ts
A  packages/app-runtime/src/verbund-typen.ts
A  packages/app-runtime/test/verbund.test.ts
```
Dann:
```bash
git commit -m "feat(app-runtime): Verbund-Typen und Anzeige V1-V15 der Tool-Seite (Teil 2b R2)" -m "verbund-typen.ts mit MasterStand und VerbundDaten wie Spec 16.2 (DatenGrund aus @jm/master-link, nur einzeln benannte Typen, E27). verbund-anzeige.ts als reine Funktion mit vollstaendiger Pruefung des Union-Typs: Vorrang V12 vor V15, Zusatz L genau mit angewendetem Stand, Showname hoechstens 40 Code Points, V11 mit dem Text des Clients. Selbsttest test/verbund.test.ts mit tsx (jede Zeile woertlich, V11 fuer alle 13 Fehlercodes). Der CI-Schritt app-runtime aus Zoom 4b heisst jetzt App-Laufzeit (Log-Aufraeumen, CSP, Verbund-Anzeige, Abo-Zustand); genau ein Schritt mit diesem Befehl im Job selftests (Spec 19.6)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst (C11):**
- V4 nennt ⟨S⟩ ⟨hh:mm⟩ des **angewendeten** Stands, wie 16.4 sagt; nur wenn noch nichts von **diesem** Master angewendet ist (Start, Handler noch nicht registriert, oder angewendet ist der Stand eines früheren Masters), die des empfangenen `letzter`. 16.4 schweigt zu diesem Fall; so nennt die grüne Zeile nie die Show eines anderen Masters.
- `grund` ohne Wert bei `show: null` (kann nach `pruefeStand` nicht vorkommen) zeigt wie `keine-show` V5/V6, damit die Funktion für jede Eingabe eine Zeile liefert.
- `MasterStand.grund` hat den Typ `DatenGrund` aus `@jm/master-link`; das ist dieselbe Vereinigung wie in Spec 16.2 (Gliederung S-C).
- **Spec 19.6 im Wortlaut** (N40): 19.6 nennt einen neuen Schritt „app-runtime (CSP, Verbund-Anzeige, Abo-Zustand)“ mit `npm run selftest -w @jm/app-runtime`. Seit Zoom 4b steht der Schritt „App-Laufzeit (Log-Aufräumen, CSP)“ mit demselben Befehl schon im Job `selftests`; ein zweiter Schritt liefe dieselben Tests doppelt. Step 12 benennt ihn deshalb nach dem 4b-Muster um (N22, N26). Der Zweck von 19.6 bleibt: genau ein Schritt, der beide Teile aus 19.4 ausführt, ohne Electron, in der Zeitgrenze von 15 min. Abweichend sind nur der Name und der Weg (Umbenennen statt Anlegen); die Abweichung ist im Kopf (Absatz „Spec“) gemeldet.

---

### Task 12: C12 · `@jm/app-runtime`: Zustandsmaschine `VerbundFolger` (rein, mit übergebener Uhr)

**Spec:** 13.2 (Verwurf, Warnung „je Verbindung einmal je Typ und Fehlergrund“, `verworfen`), 13.3 (Epoche/Folge, neu oder alt, Neuabo nach jeder Anmeldung, Abo-Wiederholung 30 s), 16.1 (wann ein Tool folgt, Verbundmodus, Ende des Verbundmodus, Logzeilen „ignoriert“ höchstens einmal je Minute), 16.2 (`neueShow`, `letzter`/`angewendet`, `fehler` mit fünf Versuchen im Abstand von 1 s, ein Stand ohne Show löscht `fehler`), 16.3 (Zwischenspeicher beim Start immer mit `anwenden(stand, false)`, Zustand danach), 18 (Zustände), 19.4; G3, G6, G13, G14; E16, E17, E19, E29; Review Focus 2–5.

**Arbeitsverzeichnis:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b-r2`, Branch `feat/master-link-teil2b-r2`. Alle Pfade relativ dazu, Befehle im Worktree-Wurzelordner (Git Bash). Voraussetzung: C11 ist committet (zwei Commits).

**Dateien:**
- Create: `packages/app-runtime/src/verbund-daten.ts`
- Modify: `packages/app-runtime/test/verbund.test.ts` (neuer Block direkt vor der Zeile `// ── Abschluss …`)

**Interfaces:**

Consumes (exakt):
```ts
// C2 · @jm/master-link (show-daten.ts, rahmen.ts)
export interface DatenZeile { t: 'abo' | 'stand' | 'aenderung'; [feld: string]: unknown }
export type Nachricht = /* acht Teil-1-Typen */ | DatenZeile;
export interface StandInhalt { art: 'show'; fassung: number; epoche: string; folge: number;
  schluessel: string | null; show: Record<string, unknown> | null; grund?: DatenGrund; mitDokument: string[] }
export type Pruefung<T> = { ok: true; wert: T } | { ok: false; grund: string };   // grund = Feldname aus Tabelle 13.2
export function pruefeStand(o: unknown): Pruefung<StandInhalt>;
export function kodiereAbo(fassung?: number): string;             // '{"t":"abo","art":"show","fassung":1}\n'
// C4 · @jm/master-link (client.ts)
export interface KopplungInfo { rolle: Rolle; masterId: string | null; masterName: string | null; letzteAdresse: string | null; adressen: string[] }
// MasterLinkClient: zustand(): ClientZustand; kopplung(): KopplungInfo | null; sende(n: Nachricht): boolean;
//   Ereignisse 'zustand' (z), 'angemeldet' ({ adresse, adressen, suite, masterName }), 'daten' (n: DatenZeile; immer nach 'angemeldet')
// bestehend · @jm/show
export function migrateShow(raw: unknown): Show;
// C11 · ./verbund-typen, ./verbund-anzeige (nur im Test)
```

Produces (S-C):
```ts
// packages/app-runtime/src/verbund-daten.ts — rein: kein Electron, kein fs
export interface VerbundFristen { antwortMs: number; aboWiederholMs: number; anwendeVersuche: number; anwendePauseMs: number }
export const VERBUND_FRISTEN: Readonly<VerbundFristen>;   // { antwortMs: 5000, aboWiederholMs: 30000, anwendeVersuche: 5, anwendePauseMs: 1000 }
export interface ClientLike {
  zustand(): ClientZustand; kopplung(): KopplungInfo | null; sende(n: Nachricht): boolean;
  on(e: 'zustand' | 'angemeldet' | 'daten', f: (x: any) => void): unknown;
}
export interface Uhr { jetzt(): number; setTimeout(f: () => void, ms: number): unknown; clearTimeout(h: unknown): void }
export interface StandSpeicher { lies(): MasterStand | null; schreibe(s: MasterStand): Promise<boolean>; loesche(): void }
/** Wurf für anwenden, wenn ein Tool einen Stand nicht anwenden kann: V12 und Logzeile zeigen `code` (N3). */
export function nichtAngewendet(code: string): Error & { code: string };
export class VerbundFolger extends EventEmitter {
  constructor(o: { client: ClientLike; speicher: StandSpeicher; log(stufe: 'info' | 'warn', t: string): void;
                   uhr?: Uhr; fristen?: Partial<VerbundFristen>; darfSchreiben?: boolean });
  folge(h: FolgeHandler): void;     // registriert; Zwischenspeicher genau einmal, sobald auch starte() lief (E17); verbunden → Abo jetzt
  starte(): void;                   // Client läuft: Zwischenspeicher lesen, Zuhörer anhängen
  daten(): VerbundDaten;
  imVerbundmodus(): boolean;
  ersetzt(): void;                  // verbundDatenErsetzt (E16)
  kopplung(): VerbundKopplung | null;
  ignoriert(weg: 'reload' | 'deeplink', pfad?: string): void;   // Logzeilen 16.1, höchstens einmal je Minute und Weg (E19)
  stoppe(): void;
  // Ereignis 'wechsel' (d: VerbundDaten) bei jeder Änderung von daten()
}
```
C13 (`verbund.ts`) verdrahtet die Klasse mit dem echten Client und `erzeugeStandSpeicher`; C19 (Kette) nutzt sie mit echtem Client und kurzen `fristen`.

**Regeln:** G3 (Fristen 5 s, 30 s, 5 × 1 s; Drossel 60 s), G6 (Gründe nur als Feldname oder Code, nie Werte aus dem Netz, nie eine Fehlermeldung), G7, G11, G13 (jede Frist ist ein Zeitgeber der übergebenen Uhr; `jetzt()` nur für `empfangenAm` und `verworfen.seit`), G14, G16.

**Ableitung `daten()`** (Gliederung, übernommen): Datei beschädigt (Client `fehler`/`datei`) → `frueher` mit `grund: 'datei'`, wenn etwas angewendet ist, sonst `datei-defekt`. Keine Kopplung oder Rolle nicht `slave` (oder ohne `masterId`) → `frueher` mit `grund: 'entkoppelt'`, wenn etwas angewendet ist, sonst `einzelplatz`. Slave mit Kopplung und Client nicht verbunden → `getrennt`. Verbunden ohne gültige Antwort in dieser Verbindung → `warte` bis 5 s nach dem Abo, dann `ohne-daten`. Sonst `aktuell` mit `letzter`. `imVerbundmodus()` = Slave mit Kopplung, Datei nicht beschädigt, `angewendet.masterId === kopplung.masterId`.

**Vorab (gemessen):**
- Der Test läuft mit einer nachgebauten Uhr: `setTimeout` merkt sich die Zeitgeber, `vor(ms)` stellt die Zeit vor und löst die fälligen der Reihe nach aus. Kein echter Zeitgeber, keine Wartezeit; der ganze Selbsttest (CSP und Verbund) lief nach C12 in 1,3 s (Messung vom 08.10.2026, ohne 4b; mit dem CSP-Teil aus 4b, der einen Kindprozess startet, am 12.10.2026 1,9–2,0 s über `npm run`, N35).
- Der nachgebaute Client ist ein `EventEmitter` mit `zustand()`, `kopplung()`, `sende()`; `verbinde()` meldet erst `zustand` (verbunden), dann `angemeldet`, in dieser Reihenfolge wie `client.ts` (`betreibe`).
- Der Zwischenspeicher im Test schreibt im selben Takt; `await ruhe()` (ein `setImmediate`) lässt die Schreibkette weiterlaufen. Werden mehrere Stände ohne Pause dazwischen angewendet, schreibt der Folger nach dem laufenden nur den neuesten (gemessen `0,1,1`: Folge 0, dann 1, dann der zuletzt angewendete Stand mit Folge 1 der Epoche `e2`).
- `pruefeStand` aus Block A liefert bei genau einem falschen Feld dessen Namen (Tabelle 13.2). Die Tests geben deshalb nur Stände mit genau einem falschen Feld vor, wenn sie den Feldnamen prüfen.

---

- [ ] **Step 1: Failing Test schreiben**

In `packages/app-runtime/test/verbund.test.ts` den folgenden Block **direkt vor** der Zeile `// ── Abschluss ────…` einfügen (nach dem Block aus C11). Sonst wird nichts geändert.

Einfügen in `packages/app-runtime/test/verbund.test.ts` direkt vor der Zeile `// ── Abschluss`:
```ts
// ── C12 · Zustandsmaschine VerbundFolger (Spec 13.2, 13.3, 16.1–16.3, 19.4) ──
{
  const { EventEmitter } = await import('node:events');
  const { VerbundFolger, VERBUND_FRISTEN, nichtAngewendet } = await import('../src/verbund-daten');
  const { verbundAnzeige } = await import('../src/verbund-anzeige');

  /** Uhr mit Zeitgebern, die nur `vor(ms)` auslöst (G13). */
  const testUhr = () => {
    let jetzt = Date.UTC(2026, 9, 8, 8, 0, 0);
    let naechste = 1;
    const zeitgeber = new Map<number, { zeit: number; f: () => void }>();
    return {
      uhr: {
        jetzt: () => jetzt,
        setTimeout: (f: () => void, ms: number) => {
          const id = naechste++;
          zeitgeber.set(id, { zeit: jetzt + ms, f });
          return id;
        },
        clearTimeout: (h: unknown) => void zeitgeber.delete(h as number),
      },
      vor(ms: number): void {
        const ziel = jetzt + ms;
        for (;;) {
          let id = -1;
          let zeit = Infinity;
          for (const [i, t] of zeitgeber) if (t.zeit <= ziel && t.zeit < zeit) [id, zeit] = [i, t.zeit];
          if (id < 0) break;
          const t = zeitgeber.get(id)!;
          zeitgeber.delete(id);
          jetzt = t.zeit;
          t.f();
        }
        jetzt = ziel;
      },
      offen: () => zeitgeber.size,
    };
  };
  const SLAVE = { rolle: 'slave', masterId: 'M1', masterName: 'Regie-PC', letzteAdresse: '10.0.0.5', adressen: ['10.0.0.5', '192.168.1.5'] };
  class TestClient extends EventEmitter {
    z: Record<string, unknown> = { art: 'aus' };
    k: Record<string, unknown> | null = { ...SLAVE };
    gesendet: Record<string, unknown>[] = [];
    zustand() { return this.z; }
    kopplung() { return this.k; }
    sende(n: Record<string, unknown>) {
      if (this.z.art !== 'verbunden') return false;
      this.gesendet.push(n);
      return true;
    }
    setze(z: Record<string, unknown>) {
      this.z = z;
      this.emit('zustand', z);
    }
    verbinde(masterName = 'Regie-PC') {
      this.setze({ art: 'verbunden', adresse: '10.0.0.5', seit: 0, masterName, suite: '0.15.0' });
      this.emit('angemeldet', { adresse: '10.0.0.5', adressen: ['10.0.0.5'], suite: '0.15.0', masterName });
    }
    trenne() { this.setze({ art: 'sucht' }); }
    abos() { return this.gesendet.filter((n) => n.t === 'abo').length; }
  }
  const showVon = (name: string) => ({ schemaVersion: 1, name, tools: [], ablauf: [{ id: 'p1', title: 'Begrüßung' }] });
  const stand = (folge: number, o: { epoche?: string; schluessel?: string | null; name?: string; show?: unknown; grund?: string; t?: string; mitDokument?: string[] } = {}) => {
    const show = o.show !== undefined ? o.show : showVon(o.name ?? 'Gala');
    return {
      t: o.t ?? 'stand', art: 'show', fassung: 1, epoche: o.epoche ?? 'e1', folge,
      schluessel: o.schluessel === undefined ? 'aaaaaaaaaaaaaaaa' : o.schluessel,
      show, ...(show === null ? { grund: o.grund ?? 'keine-show' } : {}), mitDokument: o.mitDokument ?? [],
    };
  };
  const gespeichert = (o: { masterId?: string; masterName?: string; folge?: number; schluessel?: string | null; name?: string } = {}) => ({
    masterId: o.masterId ?? 'M1', masterName: o.masterName ?? 'Regie-PC', epoche: 'alt', folge: o.folge ?? 7,
    schluessel: o.schluessel === undefined ? 'aaaaaaaaaaaaaaaa' : o.schluessel, show: showVon(o.name ?? 'Gala'), mitDokument: [], empfangenAm: 1000,
  });
  const testSpeicher = (start: unknown = null) => {
    const s = {
      inhalt: start as unknown,
      geschrieben: [] as { folge: number; name: string }[],
      geloescht: 0,
      gelesen: 0,
      lies() { s.gelesen++; return s.inhalt as never; },
      async schreibe(st: { folge: number; show: { name: string } }) {
        s.geschrieben.push({ folge: st.folge, name: st.show.name });
        s.inhalt = st;
        return true;
      },
      loesche() { s.geloescht++; s.inhalt = null; },
    };
    return s;
  };
  const testHandler = () => {
    const h = {
      aufrufe: [] as { name: string; folge: number; epoche: string; masterId: string; neueShow: boolean }[],
      wechsel: [] as { art: string }[],
      wirft: null as null | (() => Error),
      anwenden(s: { show: { name: string }; folge: number; epoche: string; masterId: string }, neueShow: boolean) {
        if (h.wirft) throw h.wirft();
        h.aufrufe.push({ name: s.show.name, folge: s.folge, epoche: s.epoche, masterId: s.masterId, neueShow });
      },
      beiWechsel(d: { art: string }) { h.wechsel.push(d); },
    };
    return h;
  };
  const aufbau = (o: { speicher?: ReturnType<typeof testSpeicher>; darfSchreiben?: boolean; kopplung?: Record<string, unknown> | null } = {}) => {
    const u = testUhr();
    const client = new TestClient();
    if (o.kopplung !== undefined) client.k = o.kopplung;
    const speicher = o.speicher ?? testSpeicher();
    const logs: string[] = [];
    const folger = new VerbundFolger({
      client: client as never, speicher: speicher as never, uhr: u.uhr,
      log: (stufe: string, t: string) => void logs.push(`${stufe}: ${t}`),
      ...(o.darfSchreiben === undefined ? {} : { darfSchreiben: o.darfSchreiben }),
    });
    const h = testHandler();
    return { u, client, speicher, logs, folger, h };
  };
  const ruhe = () => new Promise<void>((r) => setImmediate(r)); // ausstehende Schreibvorgänge abwarten
  const text = (f: { daten(): unknown }) => verbundAnzeige(f.daten() as never, () => 'hh:mm')?.text ?? null;

  check('C12 Fristen: 5 s, 30 s, 5 Versuche, 1 s', JSON.stringify(VERBUND_FRISTEN) === '{"antwortMs":5000,"aboWiederholMs":30000,"anwendeVersuche":5,"anwendePauseMs":1000}');

  // Abo, Frist, Wiederholung (13.3)
  {
    const { u, client, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    check('C12 vor der Anmeldung: getrennt, kein Abo', folger.daten().art === 'getrennt' && client.abos() === 0);
    client.verbinde();
    check('C12 angemeldet → genau ein abo {t:abo, art:show, fassung:1}', client.abos() === 1 && JSON.stringify(client.gesendet[0]) === '{"t":"abo","art":"show","fassung":1}');
    check('C12 ohne Antwort: warte', folger.daten().art === 'warte' && text(folger) === 'Verbunden mit Regie-PC · Show wird geladen…');
    u.vor(4999);
    check('C12 nach 4,999 s noch warte', folger.daten().art === 'warte');
    u.vor(1);
    check('C12 nach 5 s ohne-daten (V3)', folger.daten().art === 'ohne-daten' && text(folger)!.startsWith('Regie-PC antwortet nicht'));
    u.vor(24_999);
    check('C12 vor 30 s kein zweites Abo', client.abos() === 1);
    u.vor(1);
    check('C12 nach 30 s zweites Abo', client.abos() === 2);
    u.vor(30_000);
    check('C12 nach 60 s drittes Abo', client.abos() === 3);
    client.emit('daten', stand(0));
    u.vor(120_000);
    check('C12 nach der Antwort keine Wiederholung', client.abos() === 3 && folger.daten().art === 'aktuell');
    check('C12 erster Stand angewendet, neueShow true', h.aufrufe.length === 1 && h.aufrufe[0].neueShow === true && h.aufrufe[0].name === 'Gala');
    check('C12 V4 nach dem ersten Stand', text(folger) === 'Show vom Master: Gala · Stand hh:mm');
    client.trenne();
    u.vor(120_000);
    check('C12 getrennt: keine Abos, solange die Verbindung fehlt', client.abos() === 3 && folger.daten().art === 'getrennt');
  }

  // Nur ein Tool, das folgt, abonniert (15.5); registriert es sich nach der Anmeldung, geht das Abo dann hinaus (E17)
  {
    const { u, client, folger, h } = aufbau();
    folger.starte();
    client.verbinde();
    u.vor(60_000);
    check('C12 ohne folge(): kein Abo, auch nach 60 s (andere Tools beziehen nichts, 15.5)', client.abos() === 0);
    folger.folge(h);
    check('C12 folge() nach der Anmeldung → Abo sofort', client.abos() === 1 && folger.daten().art === 'warte');
    folger.folge(h);
    u.vor(5000);
    check('C12 zweites folge() → kein zweites Abo; die Frist läuft ab dem Abo', client.abos() === 1 && folger.daten().art === 'ohne-daten');
  }

  // Neu oder alt (13.3), neueShow (16.2), Neuabo, Review Focus 2
  {
    const { client, speicher, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(0));
    await ruhe();
    check('C12 Zwischenspeicher nach dem Anwenden geschrieben', JSON.stringify(speicher.geschrieben) === '[{"folge":0,"name":"Gala"}]');
    check('C12 im Verbundmodus nach dem ersten Stand mit Show', folger.imVerbundmodus() === true);
    client.emit('daten', stand(1, { t: 'aenderung', name: 'Gala (geändert)' }));
    check('C12 größere Folge → angewendet, gleicher schluessel → neueShow false', h.aufrufe.length === 2 && h.aufrufe[1].folge === 1 && h.aufrufe[1].neueShow === false);
    client.emit('daten', stand(1, { t: 'aenderung' }));
    check('C12 gleiche Epoche und Folge → nicht angewendet', h.aufrufe.length === 2 && folger.daten().art === 'aktuell');
    client.emit('daten', stand(3, { t: 'aenderung', name: 'Stand 3' }));
    client.emit('daten', stand(2, { t: 'aenderung', name: 'Stand 2 (verspätet)' }));
    const d = folger.daten() as { art: string; letzter: { folge: number } };
    check('C12 älterer Stand nach neuerem → anwenden nicht gerufen (Review Focus 2)', h.aufrufe.length === 3 && h.aufrufe[2].folge === 3);
    check('C12 älterer Stand verdrängt den neueren nicht aus der Anzeige', d.art === 'aktuell' && d.letzter.folge === 3 && text(folger) === 'Show vom Master: Stand 3 · Stand hh:mm');
    client.emit('daten', stand(0, { epoche: 'e2', name: 'Neu gestartet' }));
    check('C12 andere Epoche mit kleinerer Folge → angewendet', h.aufrufe.length === 4 && h.aufrufe[3].epoche === 'e2' && h.aufrufe[3].neueShow === false);
    client.emit('daten', stand(1, { epoche: 'e2', schluessel: 'bbbbbbbbbbbbbbbb', name: 'Andere Show' }));
    check('C12 anderer schluessel → neueShow true', h.aufrufe.length === 5 && h.aufrufe[4].neueShow === true);
    client.trenne();
    check('C12 Verbindung weg → getrennt, Daten bleiben', folger.daten().art === 'getrennt' && folger.imVerbundmodus() === true);
    client.verbinde();
    check('C12 Neuabo nach dem Wiederverbinden', client.abos() === 2 && folger.daten().art === 'warte');
    client.emit('daten', stand(1, { epoche: 'e2', schluessel: 'bbbbbbbbbbbbbbbb', name: 'Andere Show' }));
    check('C12 gleicher Stand nach dem Wiederverbinden nicht erneut angewendet, aktuell', h.aufrufe.length === 5 && folger.daten().art === 'aktuell');
    await ruhe();
    // Fünf Anwendungen ohne Pause dazwischen: geschrieben werden der erste, der zweite (lief schon) und nur der neueste.
    check('C12 Zwischenspeicher: der Reihe nach, Zwischenstände fallen weg, der neueste zuletzt', speicher.geschrieben.map((g) => g.folge).join(',') === '0,1,1' && speicher.geschrieben.at(-1)?.name === 'Andere Show', speicher.geschrieben);
    client.k = { ...SLAVE, masterId: 'M2', masterName: 'Ton-PC' };
    client.verbinde('Ton-PC');
    client.emit('daten', stand(1, { epoche: 'e2', schluessel: 'bbbbbbbbbbbbbbbb', name: 'Andere Show' }));
    check('C12 anderer masterId → angewendet mit neueShow true', h.aufrufe.length === 6 && h.aufrufe[5].masterId === 'M2' && h.aufrufe[5].neueShow === true);
  }

  // anwenden wirft (16.2): fehler, Zwischenspeicher unverändert, bis zu fünf neue Versuche im Abstand von 1 s
  {
    const { u, client, speicher, logs, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(0));
    await ruhe();
    h.wirft = () => Object.assign(new Error('C:\\Shows\\geheim.tsv gesperrt'), { code: 'EBUSY' });
    let versuche = 0;
    const altesAnwenden = h.anwenden;
    h.anwenden = (s, n) => { versuche++; altesAnwenden(s, n); };
    client.emit('daten', stand(1, { t: 'aenderung', name: 'Neu' }));
    const d = folger.daten() as { fehler?: string; angewendet: { folge: number } };
    check('C12 anwenden wirft → fehler = Code, nicht die Meldung', d.fehler === 'EBUSY' && !JSON.stringify(d).includes('geheim'));
    check('C12 anwenden wirft → angewendet bleibt der alte Stand', d.angewendet.folge === 0);
    check('C12 V12 mit „in Benutzung“', text(folger) === 'Show vom Master nicht übernommen: EBUSY · in Benutzung: Gala hh:mm');
    check('C12 nicht im Verbundmodus verloren (alter Stand vom selben Master)', folger.imVerbundmodus() === true);
    u.vor(999);
    check('C12 vor 1 s kein zweiter Versuch', versuche === 1);
    u.vor(1);
    check('C12 nach 1 s zweiter Versuch', versuche === 2);
    u.vor(10_000);
    check('C12 erster Versuch und fünf neue (16.2 „bis zu fünfmal … erneut“), dann keiner mehr', versuche === 6);
    await ruhe();
    check('C12 Zwischenspeicher unverändert, solange anwenden wirft', speicher.geschrieben.length === 1);
    check('C12 Warnungen: erster Fehlschlag und Aufgabe, ohne Meldungstext', logs.filter((l) => l.includes('nicht übernommen')).length === 2 && !logs.join('\n').includes('geheim'));
    client.emit('daten', stand(2, { t: 'aenderung', name: 'Noch neuer' }));
    u.vor(2500);
    check('C12 ein neuerer Stand ersetzt das Ziel: Versuche beginnen neu', versuche === 9);
    h.wirft = null;
    u.vor(1000);
    const nach = folger.daten() as { fehler?: string; angewendet: { folge: number } };
    check('C12 gelingt ein Versuch → fehler weg, angewendet neu', nach.fehler === undefined && nach.angewendet.folge === 2 && h.aufrufe.at(-1)?.name === 'Noch neuer');
    await ruhe();
    check('C12 nach dem gelungenen Versuch geschrieben', speicher.geschrieben.at(-1)?.folge === 2);
    h.wirft = () => Object.assign(new Error('x'), { code: 'EPERM' });
    client.emit('daten', stand(3, { t: 'aenderung' }));
    check('C12 fehler gesetzt', (folger.daten() as { fehler?: string }).fehler === 'EPERM');
    client.emit('daten', stand(4, { t: 'aenderung', show: null, grund: 'keine-show' }));
    u.vor(10_000);
    check('C12 keine-show löscht fehler und beendet die Versuche', (folger.daten() as { fehler?: string }).fehler === undefined && versuche === 11);
    check('C12 V5 nach keine-show mit Zusatz L', text(folger) === 'Regie-PC hat keine Show offen · letzter Stand: Noch neuer hh:mm');
    client.emit('daten', stand(5, { t: 'aenderung', show: null, grund: 'zu-gross' }));
    check('C12 zu-gross → V7', text(folger) === 'Show am Master zu groß für den Verbund · letzter Stand: Noch neuer hh:mm');
  }

  // Ein Tool meldet einen lesbaren Grund mit nichtAngewendet(code) (Titler: Fehlercode der TSV, Rundown: SCHLUESSEL_FEHLT):
  // V12 und die Logzeile zeigen den Code. Ein einfaches Error zeigte nur seinen Typ, nie die Meldung (G6).
  {
    const { client, logs, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    h.wirft = () => nichtAngewendet('EBUSY');
    client.emit('daten', stand(0));
    check('C12 nichtAngewendet(code) → V12 mit dem Code', text(folger) === 'Show vom Master nicht übernommen: EBUSY', text(folger));
    check('C12 … Logzeile mit dem Code', logs.some((l) => l.endsWith('nicht übernommen (EBUSY), neuer Versuch in 1 s.')), logs);
    h.wirft = () => new Error('speakers.tsv nicht schreibbar: EBUSY');
    client.emit('daten', stand(1, { t: 'aenderung' }));
    check('C12 einfaches Error → nur der Fehlertyp, nie die Meldung', (folger.daten() as { fehler?: string }).fehler === 'Error');
  }

  // Ende des Verbunds während der Anwende-Versuche (16.1): kein weiterer Versuch mit einem Stand vom Master
  {
    const { u, client, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    let versuche = 0;
    h.wirft = () => nichtAngewendet('EBUSY');
    const altesAnwenden = h.anwenden;
    h.anwenden = (s, n) => { versuche++; altesAnwenden(s, n); };
    client.emit('daten', stand(0));
    client.k = { ...SLAVE, rolle: 'aus', masterId: null, masterName: null };
    client.setze({ art: 'aus' });
    u.vor(10_000);
    check('C12 Verbund endet während der Versuche → keine weiteren Versuche (16.1)', versuche === 1 && h.aufrufe.length === 0, versuche);
  }
  {
    // Ein Stand aus dem Zwischenspeicher gehört zum Start (16.3) und wird weiter versucht, auch ohne Kopplung.
    const { u, client, folger, h } = aufbau({ speicher: testSpeicher(gespeichert()) });
    let versuche = 0;
    h.wirft = () => nichtAngewendet('EBUSY');
    const altesAnwenden = h.anwenden;
    h.anwenden = (s, n) => { versuche++; altesAnwenden(s, n); };
    folger.folge(h);
    folger.starte();
    client.k = { ...SLAVE, rolle: 'aus', masterId: null, masterName: null };
    client.setze({ art: 'aus' });
    h.wirft = null;
    u.vor(1000);
    check('C12 … ein Stand aus dem Zwischenspeicher wird weiter versucht (16.3)', versuche === 2 && h.aufrufe.length === 1, versuche);
  }
  {
    // Die Kopplung wechselt direkt an einen anderen Master (16.1 „Anderer Master“, kein Ende des Verbunds): Ein Stand des
    // bisherigen Masters wird nicht weiter versucht; erst ein Stand des neuen Masters wird angewendet.
    const { u, client, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    let versuche = 0;
    h.wirft = () => nichtAngewendet('EBUSY');
    const altesAnwenden = h.anwenden;
    h.anwenden = (s, n) => { versuche++; altesAnwenden(s, n); };
    client.emit('daten', stand(0));
    client.k = { ...SLAVE, masterId: 'M2', masterName: 'Ton-PC' };
    client.setze({ art: 'sucht' });
    h.wirft = null;
    u.vor(10_000);
    check('C12 Kopplung wechselt an einen anderen Master → keine weiteren Versuche mit dem Stand des bisherigen (16.1)', versuche === 1 && h.aufrufe.length === 0, versuche);
  }

  // Logzeile „übernommen“: der Showname aus dem Netz einzeilig und gekürzt (G6, kuerzeName aus @jm/master-link)
  {
    const { client, logs, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(0, { name: `Gala\nwarn: gefälscht ${'x'.repeat(300)}` }));
    const zeile = logs.find((l) => l.includes('übernommen (Stand 0')) ?? '';
    check('C12 Logzeile „übernommen“: Showname einzeilig und gekürzt (kuerzeName)', h.aufrufe.length === 1 && zeile !== '' && !zeile.includes('\n') && zeile.length < 200, zeile);
  }

  // ungültiger Stand (13.2): verworfen, Warnung je Verbindung einmal je Typ und Feld
  {
    const { client, logs, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', { ...stand(0), epoche: 'Geheim Epoche' });
    const d = folger.daten() as { verworfen?: { grund: string } };
    check('C12 ungültiger Stand → verworfen mit Feldname', d.verworfen?.grund === 'epoche' && h.aufrufe.length === 0);
    check('C12 V15 ohne angewendet', text(folger) === 'Show-Daten von Regie-PC nicht lesbar (Tool-Update nötig?)');
    client.emit('daten', { ...stand(0), epoche: '' });
    client.emit('daten', { ...stand(0, { t: 'aenderung' }), epoche: '' });
    client.emit('daten', { ...stand(0), schluessel: 'ABC' });
    const warnungen = logs.filter((l) => l.startsWith('warn: Verbund: Show-Daten von „Regie-PC“ verworfen'));
    check('C12 Warnung einmal je Typ und Feld', JSON.stringify(warnungen) === JSON.stringify([
      'warn: Verbund: Show-Daten von „Regie-PC“ verworfen (stand, Feld epoche).',
      'warn: Verbund: Show-Daten von „Regie-PC“ verworfen (aenderung, Feld epoche).',
      'warn: Verbund: Show-Daten von „Regie-PC“ verworfen (stand, Feld schluessel).',
    ]), warnungen);
    check('C12 Warnung ohne Werte aus dem Netz', !logs.join('\n').includes('Geheim'));
    client.trenne();
    client.verbinde();
    client.emit('daten', { ...stand(0), epoche: '' });
    check('C12 neue Verbindung → dieselbe Warnung noch einmal', logs.filter((l) => l.includes('(stand, Feld epoche)')).length === 2);
    client.emit('daten', stand(0));
    check('C12 nächster gültiger Stand löscht verworfen und wird angewendet', (folger.daten() as { verworfen?: unknown }).verworfen === undefined && h.aufrufe.length === 1);
    client.emit('daten', { ...stand(1), show: [1, 2] });
    check('C12 show als Liste → verworfen, alter Stand bleibt (V15 mit Zusatz L)', (folger.daten() as { verworfen?: unknown }).verworfen !== undefined && h.aufrufe.length === 1 && text(folger) === 'Show-Daten von Regie-PC nicht lesbar (Tool-Update nötig?) · letzter Stand: Gala hh:mm');
    client.emit('daten', { t: 'abo', art: 'show', fassung: 1 });
    check('C12 abo vom Master wird nicht als Stand gelesen', h.aufrufe.length === 1);
  }

  // Wann ein Tool folgt (16.1): Rolle master, Datei fehlt, Slave ohne Kopplung, Datei beschädigt
  {
    const { client, folger, h } = aufbau({ kopplung: { ...SLAVE, rolle: 'master', masterId: 'M1' } });
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(0));
    check('C12 Rolle master → einzelplatz, kein Abo, nichts angewendet (E29)', folger.daten().art === 'einzelplatz' && client.abos() === 0 && h.aufrufe.length === 0 && text(folger) === null);
    check('C12 Rolle master → nicht im Verbundmodus', folger.imVerbundmodus() === false);
  }
  {
    const { client, folger, h } = aufbau({ kopplung: null });
    folger.folge(h);
    folger.starte();
    check('C12 Datei fehlt → einzelplatz', folger.daten().art === 'einzelplatz' && folger.kopplung() === null);
    client.k = { ...SLAVE, masterId: null, masterName: null };
    client.verbinde();
    check('C12 Slave ohne Kopplung → einzelplatz, kein Abo', folger.daten().art === 'einzelplatz' && client.abos() === 0);
    client.k = { ...SLAVE, rolle: 'aus' };
    client.setze({ art: 'aus' });
    check('C12 Rolle aus → einzelplatz', folger.daten().art === 'einzelplatz');
  }
  {
    const { client, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.setze({ art: 'fehler', code: 'datei', text: 'Kopplungsdatei beschädigt. Neu koppeln.' });
    check('C12 Datei beschädigt ohne Master-Daten → datei-defekt (V14)', folger.daten().art === 'datei-defekt' && text(folger) === 'Kopplungsdatei beschädigt. Neu koppeln.');
    client.verbinde();
    client.emit('daten', stand(0));
    client.setze({ art: 'fehler', code: 'datei', text: 'Kopplungsdatei beschädigt. Neu koppeln.' });
    const d = folger.daten() as { art: string; grund?: string };
    check('C12 Datei beschädigt mit Master-Daten → frueher(datei), nicht im Verbundmodus', d.art === 'frueher' && d.grund === 'datei' && folger.imVerbundmodus() === false);
    check('C12 V13 datei mit Zusatz L', text(folger) === 'Kopplungsdatei beschädigt. Neu koppeln. · letzter Stand: Gala hh:mm');
  }

  // Ende des Verbundmodus (16.1), verbundDatenErsetzt (E16)
  {
    const { client, speicher, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(0));
    await ruhe();
    client.k = { ...SLAVE, rolle: 'aus', masterId: null, masterName: null };
    client.setze({ art: 'aus' });
    const d = folger.daten() as { art: string; grund?: string; masterName?: string };
    check('C12 Entkoppeln → frueher(entkoppelt) mit dem Namen des früheren Masters', d.art === 'frueher' && d.grund === 'entkoppelt' && d.masterName === 'Regie-PC');
    check('C12 Entkoppeln → Zwischenspeicher bleibt, nicht im Verbundmodus', speicher.geloescht === 0 && speicher.inhalt !== null && folger.imVerbundmodus() === false);
    check('C12 V13 entkoppelt', text(folger) === 'Daten vom früheren Master Regie-PC (nicht mehr gekoppelt) · letzter Stand: Gala hh:mm');
    folger.ersetzt();
    check('C12 ersetzt() → einzelplatz, Zwischenspeicher gelöscht (E16)', folger.daten().art === 'einzelplatz' && speicher.geloescht === 1 && speicher.inhalt === null);
  }
  {
    const { client, speicher, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(0));
    folger.ersetzt();
    const d = folger.daten() as { art: string; angewendet?: unknown };
    check('C12 ersetzt() im Verbund: Art bleibt (Verbindung läuft), angewendet null', d.art === 'aktuell' && d.angewendet === null && folger.imVerbundmodus() === false);
    client.emit('daten', stand(1, { t: 'aenderung' }));
    check('C12 nach ersetzt(): nächster Stand des Masters wieder angewendet, neueShow true', h.aufrufe.length === 2 && h.aufrufe[1].neueShow === true);
    await ruhe();
    check('C12 nach ersetzt(): Zwischenspeicher neu geschrieben', speicher.inhalt !== null);
  }

  // Zwischenspeicher beim Start (16.3, E17), Review Focus 3 und 5
  {
    const { client, speicher, folger, h } = aufbau({ speicher: testSpeicher(gespeichert()) });
    folger.folge(h);
    check('C12 folge() vor starte(): noch nichts angewendet', h.aufrufe.length === 0 && speicher.gelesen === 0);
    folger.starte();
    check('C12 Start: Zwischenspeicher genau einmal mit neueShow false', h.aufrufe.length === 1 && h.aufrufe[0].neueShow === false && h.aufrufe[0].folge === 7);
    await ruhe();
    check('C12 Start: Zwischenspeicher nicht noch einmal geschrieben', speicher.geschrieben.length === 0);
    check('C12 Start, gleicher Master gekoppelt → sofort Verbundmodus', folger.imVerbundmodus() === true);
    check('C12 Start, Master fehlt → V9 mit Zusatz L', text(folger) === 'Regie-PC nicht verbunden · letzter Stand: Gala hh:mm');
    folger.folge(h);
    check('C12 zweites folge() wendet nicht noch einmal an', h.aufrufe.length === 1);
    client.verbinde();
    client.emit('daten', stand(0, { name: 'Andere Show', schluessel: 'cccccccccccccccc' }));
    check('C12 Start mit X, erster Stand Y → neueShow true (Review Focus 3)', h.aufrufe.length === 2 && h.aufrufe[1].neueShow === true && h.aufrufe[1].name === 'Andere Show');
  }
  {
    const s = testSpeicher(gespeichert());
    const { folger, h } = aufbau({ speicher: s });
    folger.starte();
    check('C12 starte() vor folge(): erst nach folge() angewendet', h.aufrufe.length === 0 && s.gelesen === 1);
    folger.folge(h);
    check('C12 starte() vor folge(): genau einmal angewendet', h.aufrufe.length === 1);
  }
  {
    const { folger, h } = aufbau({ speicher: testSpeicher(gespeichert()), kopplung: null });
    folger.folge(h);
    folger.starte();
    check('C12 Start mit Zwischenspeicher ohne Kopplung → frueher', (folger.daten() as { art: string; grund?: string }).grund === 'entkoppelt' && h.aufrufe.length === 1);
  }
  {
    const { client, speicher, folger, h } = aufbau({ speicher: testSpeicher(gespeichert({ masterId: 'M9', masterName: 'Alt-PC', name: 'Alte Show' })) });
    folger.folge(h);
    folger.starte();
    check('C12 Start, anderer Master: angewendet, kein Verbundmodus', h.aufrufe.length === 1 && folger.imVerbundmodus() === false);
    check('C12 Start, anderer Master: Lage folgt der Verbindung, Zusatz L nennt den alten Stand', text(folger) === 'Regie-PC nicht verbunden · letzter Stand: Alte Show hh:mm');
    client.verbinde();
    client.emit('daten', stand(0, { show: null, grund: 'keine-show' }));
    check('C12 anderer Master ohne Show: alter Stand bleibt', h.aufrufe.length === 1 && text(folger) === 'Regie-PC hat keine Show offen · letzter Stand: Alte Show hh:mm');
    client.emit('daten', stand(1, { t: 'aenderung', name: 'Neue Show' }));
    await ruhe();
    check('C12 erster Stand mit Show des neuen Masters ersetzt ihn (neueShow true, gespeichert)', h.aufrufe[1]?.neueShow === true && folger.imVerbundmodus() === true && speicher.geschrieben.at(-1)?.name === 'Neue Show');
  }
  {
    const { folger, h } = aufbau({ speicher: testSpeicher(null) });
    folger.folge(h);
    folger.starte();
    check('C12 Speicher liefert null → wie ohne Zwischenspeicher (Review Focus 5)', h.aufrufe.length === 0 && folger.daten().art === 'getrennt' && text(folger) === 'Suche Regie-PC…');
  }
  {
    const { client, folger, h } = aufbau({ speicher: testSpeicher(gespeichert({ folge: 0 })) });
    folger.starte();
    client.verbinde();
    client.emit('daten', { ...stand(0), epoche: 'alt' });
    check('C12 Live-Stand vor folge(): noch nicht angewendet', h.aufrufe.length === 0);
    folger.folge(h);
    check('C12 Live-Stand gleich dem Zwischenspeicher → nur einmal angewendet', h.aufrufe.length === 1 && h.aufrufe[0].neueShow === false);
    client.emit('daten', stand(1, { epoche: 'alt', t: 'aenderung', name: 'Später' }));
    check('C12 danach weiter wie gewohnt', h.aufrufe.length === 2 && h.aufrufe[1].name === 'Später');
  }
  {
    const { client, folger, h } = aufbau({ speicher: testSpeicher(gespeichert({ folge: 0 })) });
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(4, { name: 'Live' }));
    folger.folge(h);
    check('C12 Live-Stand vor folge(): erst Zwischenspeicher, dann der neuere Live-Stand', h.aufrufe.map((a) => a.name).join(',') === 'Gala,Live');
  }
  {
    const { client, speicher, folger, h } = aufbau({ speicher: testSpeicher(gespeichert()) });
    folger.ersetzt();
    folger.folge(h);
    folger.starte();
    check('C12 ersetzt() vor dem Start: Zwischenspeicher weder gelesen noch angewendet', h.aufrufe.length === 0 && speicher.gelesen === 0 && speicher.geloescht === 1);
    check('C12 ersetzt() vor dem Start: Client läuft weiter (getrennt)', folger.daten().art === 'getrennt' && client.abos() === 0);
  }

  // Review Focus 4: master-link.json neu geschrieben, Rolle und Master gleich
  {
    const { client, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(0));
    const vorher = h.wechsel.length;
    client.k = { ...SLAVE, letzteAdresse: '192.168.1.5', masterName: 'Regie-PC' };
    client.setze({ ...client.z });
    check('C12 Datei geändert, Rolle und Master gleich → bleibt im Verbundmodus (Review Focus 4)', folger.imVerbundmodus() === true && folger.daten().art === 'aktuell');
    check('C12 … kein Neuanwenden, keine V13, kein Wechsel gemeldet', h.aufrufe.length === 1 && !text(folger)!.includes('früheren') && h.wechsel.length === vorher);
    check('C12 … kopplung() zeigt die neue letzteAdresse', folger.kopplung()?.letzteAdresse === '192.168.1.5');
  }

  // G14: darfSchreiben false → nie schreiben
  {
    const { client, speicher, folger, h } = aufbau({ darfSchreiben: false });
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(0));
    folger.ersetzt();
    await ruhe();
    check('C12 darfSchreiben false → kein Schreiben, kein Löschen (G14)', speicher.geschrieben.length === 0 && speicher.geloescht === 0 && h.aufrufe.length === 1);
  }

  // Zwischenspeicher der Reihe nach; ersetzt() während des Schreibens
  {
    const { client, h } = aufbau();
    const reihe: string[] = [];
    let loese: (() => void) | null = null;
    const langsam = {
      geloescht: 0,
      lies: () => null,
      schreibe: (st: { show: { name: string } }) => new Promise<boolean>((r) => {
        reihe.push(`start ${st.show.name}`);
        loese = () => { reihe.push(`ende ${st.show.name}`); r(true); };
      }),
      loesche() { langsam.geloescht++; },
    };
    const f2 = new VerbundFolger({ client: client as never, speicher: langsam as never, uhr: testUhr().uhr, log: () => {} });
    f2.folge(h);
    f2.starte();
    client.verbinde();
    client.emit('daten', stand(0, { name: 'A' }));
    client.emit('daten', stand(1, { name: 'B' }));
    client.emit('daten', stand(2, { name: 'C' }));
    loese!();
    await ruhe();
    loese!();
    await ruhe();
    check('C12 Schreiben der Reihe nach, Zwischenstände fallen weg, der neueste zuletzt', reihe.join(',') === 'start A,ende A,start C,ende C', reihe);
    client.emit('daten', stand(3, { name: 'D' }));
    f2.ersetzt();
    loese!();
    await ruhe();
    check('C12 ersetzt() während des Schreibens → danach wieder gelöscht', langsam.geloescht === 2);
  }

  // kopplung() (16.2), wechsel (16.5), werfender Zuhörer
  {
    const { client, logs, folger, h } = aufbau();
    folger.starte();
    const k0 = folger.kopplung();
    check('C12 kopplung(): Rolle, Master, Adressen, masterAdresse null ohne Verbindung', k0?.rolle === 'slave' && k0.masterId === 'M1' && k0.masterName === 'Regie-PC' && k0.masterAdresse === null && k0.adressen.join(',') === '10.0.0.5,192.168.1.5' && k0.letzteAdresse === '10.0.0.5');
    client.verbinde();
    check('C12 kopplung(): masterAdresse = Adresse der laufenden Verbindung', folger.kopplung()?.masterAdresse === '10.0.0.5');
    const ereignisse: string[] = [];
    folger.on('wechsel', (d: { art: string }) => ereignisse.push(d.art));
    folger.folge(h);
    client.emit('daten', stand(0));
    client.emit('daten', stand(0));
    client.trenne();
    check('C12 wechsel bei jeder Änderung, nicht bei gleichem Stand', ereignisse.join(',') === 'aktuell,getrennt', ereignisse);
    check('C12 beiWechsel des Handlers bekommt dieselben Wechsel', h.wechsel.map((d) => d.art).join(',') === 'aktuell,getrennt');
    h.beiWechsel = () => { throw Object.assign(new Error('kaputt'), { code: 'EKAPUTT' }); };
    client.verbinde();
    client.trenne();
    client.verbinde();
    check('C12 werfender beiWechsel trifft die Zustandsmaschine nicht, eine Logzeile', folger.daten().art === 'warte' && logs.filter((l) => l.includes('Zuhörer von „beiWechsel“ warf (EKAPUTT)')).length === 1);
  }

  // verbundIgnoriert (16.1, E19): höchstens einmal je Minute und Weg
  {
    const { u, client, logs, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(0));
    folger.ignoriert('reload');
    folger.ignoriert('reload');
    folger.ignoriert('deeplink', 'C:\\Shows\\Gala.jmshow');
    const zeilen = logs.filter((l) => l.includes('ignoriert') || l.includes('Deep-Link'));
    check('C12 ignoriert: Texte wörtlich 16.1, je Weg eine Zeile', JSON.stringify(zeilen) === JSON.stringify([
      'info: Verbund: RELOAD ignoriert, die Show-Daten kommen vom Master „Regie-PC“.',
      'info: Verbund: Show-Deep-Link „C:\\Shows\\Gala.jmshow“ liefert hier nur Dokumente, die Show-Daten kommen vom Master „Regie-PC“.',
    ]), zeilen);
    u.vor(59_999);
    folger.ignoriert('reload');
    check('C12 ignoriert: innerhalb 60 s unterdrückt', logs.filter((l) => l.includes('RELOAD ignoriert')).length === 1);
    u.vor(1);
    folger.ignoriert('reload');
    check('C12 ignoriert: nach 60 s wieder eine Zeile', logs.filter((l) => l.includes('RELOAD ignoriert')).length === 2);
  }
}

```

- [ ] **Step 2: Test laufen lassen, er muss scheitern**

```bash
npm run selftest -w @jm/app-runtime
```
Erwartet: `50 passed, 0 failed` aus dem CSP-Teil, danach die 64 Zeilen `  ok  C11 …`, keine `C12`-Zeile, Abbruch beim Laden, Exit-Code 1:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\packages\app-runtime\src\verbund-daten' imported from …\packages\app-runtime\test\verbund.test.ts
```

- [ ] **Step 3: Minimale Implementierung**

Neue Datei `packages/app-runtime/src/verbund-daten.ts`, ganzer Inhalt:
```ts
// ─────────────────────────────────────────────────────────────────────────────
// Verbund der Tool-Seite: Zustandsmaschine (Master-Link Teil 2b, Release 2, Spec 13.2, 13.3, 16.1–16.3).
//
// Rein: kein Electron, kein fs. Client, Zwischenspeicher, Log und Uhr kommen von außen;
// verbund.ts verdrahtet sie im Tool, der Selbsttest mit Attrappen. Jede Frist läuft als
// Zeitgeber der übergebenen Uhr, nie über Date.now()-Differenzen (G13). `jetzt()` liefert nur
// die Empfangszeit für „Stand hh:mm“ (bewusst die Uhr dieses Rechners, 16.4).
//
// • Nach jeder Anmeldung (`angemeldet`) schickt ein Tool, das folgt (Handler registriert), mit Rolle
//   Slave und Kopplung ein `abo` (13.3); registriert es sich erst später, geht das Abo dann hinaus.
//   Andere Tools und Rolle Master schicken keines (15.5, E29). Ohne Antwort nach 5 s gilt
//   `ohne-daten`; das Abo geht alle 30 s erneut, solange die Verbindung steht und keine Antwort kam.
// • Ein gültiger Stand mit Show, der neuer ist (andere Epoche oder größere Folge als der
//   angewendete bzw. der gerade versuchte), wird angewendet. Wirft `anwenden`, gilt `fehler`:
//   bis zu fünf neue Versuche im Abstand von 1 s („erneut“, 16.2), ein neuerer Stand ersetzt das Ziel.
// • Ein ungültiger Stand wird verworfen (`verworfen`), Warnung je Verbindung einmal je Typ und Feld (13.2).
// • Der Zwischenspeicher wird beim Start genau einmal mit `anwenden(stand, false)` angewendet,
//   sobald der Handler registriert ist UND `starte()` lief (16.3, E17).
// • `daten()` leitet die Lage bei jedem Aufruf neu aus Client, Kopplung und den Merkern ab.
// ─────────────────────────────────────────────────────────────────────────────
import { EventEmitter } from 'node:events';
import { migrateShow, type Show } from '@jm/show';
import {
  kodiereAbo,
  kuerzeName,
  pruefeStand,
  type ClientZustand,
  type DatenZeile,
  type KopplungInfo,
  type Nachricht,
} from '@jm/master-link';
import type { FolgeHandler, MasterStand, VerbundDaten, VerbundKopplung } from './verbund-typen';

export interface VerbundFristen {
  antwortMs: number;
  aboWiederholMs: number;
  anwendeVersuche: number;
  anwendePauseMs: number;
}

export const VERBUND_FRISTEN: Readonly<VerbundFristen> = { antwortMs: 5000, aboWiederholMs: 30000, anwendeVersuche: 5, anwendePauseMs: 1000 };

/** „ignoriert“-Zeilen aus 16.1 höchstens einmal je Minute und Weg (E19). */
const IGNORIERT_DROSSEL_MS = 60_000;

export interface ClientLike {
  zustand(): ClientZustand;
  kopplung(): KopplungInfo | null;
  sende(n: Nachricht): boolean;
  on(e: 'zustand' | 'angemeldet' | 'daten', f: (x: any) => void): unknown;
}

export interface Uhr {
  jetzt(): number;
  setTimeout(f: () => void, ms: number): unknown;
  clearTimeout(h: unknown): void;
}

export interface StandSpeicher {
  lies(): MasterStand | null;
  schreibe(s: MasterStand): Promise<boolean>;
  loesche(): void;
}

const ECHTE_UHR: Uhr = {
  jetzt: () => Date.now(),
  setTimeout: (f, ms) => {
    const t = setTimeout(f, ms);
    t.unref?.();
    return t;
  },
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

type MitShow = MasterStand & { show: Show };

interface Ziel {
  stand: MitShow;
  /** null = beim ersten Versuch gegen den dann angewendeten Stand bestimmen. */
  neueShow: boolean | null;
  /** Stand aus dem Zwischenspeicher: nach dem Anwenden nicht noch einmal schreiben. */
  ausSpeicher: boolean;
  /** Verbleibende Aufrufe von anwenden: der erste und bis zu `anwendeVersuche` neue (16.2 „erneut“). */
  rest: number;
}

/** Grund aus einer Ausnahme: err.code, sonst der Fehlertyp — nie die Meldung (G6). */
function grundAus(e: unknown): string {
  const o = (typeof e === 'object' && e !== null ? e : {}) as { code?: unknown; name?: unknown };
  const roh = typeof o.code === 'string' && o.code ? o.code : typeof o.name === 'string' && o.name ? o.name : 'unbekannt';
  return roh.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 40) || 'unbekannt';
}

/**
 * Wurf für `FolgeHandler.anwenden`, wenn ein Tool einen Stand nicht anwenden kann (Spec 16.2): V12 und die Logzeile
 * zeigen `code` (grundAus nimmt `err.code`, nie die Meldung, G6); ein einfaches `Error` ergäbe nur „Error“. `code` aus
 * `[A-Za-z0-9_.-]`, höchstens 40 Zeichen, etwa `EBUSY` oder `SCHLUESSEL_FEHLT`.
 */
export function nichtAngewendet(code: string): Error & { code: string } {
  return Object.assign(new Error(`Stand nicht angewendet (${code})`), { code });
}

/** Vergleichsform für 'wechsel': die Show nur über ihren Namen (ein Stand kann 900 KiB groß sein). */
function signatur(d: VerbundDaten): string {
  return JSON.stringify(d, (k, v: unknown) => (k === 'show' && v && typeof v === 'object' ? (v as { name?: unknown }).name : v));
}

export class VerbundFolger extends EventEmitter {
  private readonly client: ClientLike;
  private readonly speicher: StandSpeicher;
  private readonly logFn: (stufe: 'info' | 'warn', t: string) => void;
  private readonly uhr: Uhr;
  private readonly f: VerbundFristen;
  private readonly darfSchreiben: boolean;
  private handler: FolgeHandler | null = null;
  private gestartet = false;
  private gestoppt = false;
  /** Gelesener Zwischenspeicher, bis er angewendet ist (E17). */
  private vorrat: MasterStand | null = null;
  private vorratErledigt = false;
  private angewendet: MasterStand | null = null;
  /** Zuletzt empfangener gültiger Stand DIESER Verbindung. */
  private letzter: MasterStand | null = null;
  private antwortDa = false;
  private aboInDieserVerbindung = false;
  private fristAbgelaufen = false;
  private fehler: string | undefined;
  private verworfen: { grund: string; seit: number } | undefined;
  private ziel: Ziel | null = null;
  private antwortZeitgeber: unknown = null;
  private wiederholZeitgeber: unknown = null;
  private versuchZeitgeber: unknown = null;
  /** Warnungen dieser Verbindung, je `${t}/${feld}` (13.2). */
  private readonly gewarnt = new Set<string>();
  private readonly gedrosselt = new Map<'reload' | 'deeplink', unknown>();
  private gemeldet = '';
  private wartend: MasterStand | null = null;
  private schreibt = false;
  private schreibGeneration = 0;
  private wurfGeloggt = '';

  constructor(o: {
    client: ClientLike;
    speicher: StandSpeicher;
    log(stufe: 'info' | 'warn', t: string): void;
    uhr?: Uhr;
    fristen?: Partial<VerbundFristen>;
    darfSchreiben?: boolean;
  }) {
    super();
    this.client = o.client;
    this.speicher = o.speicher;
    this.logFn = (stufe, t) => o.log(stufe, t);
    this.uhr = o.uhr ?? ECHTE_UHR;
    this.f = { ...VERBUND_FRISTEN, ...o.fristen };
    this.darfSchreiben = o.darfSchreiben ?? true;
  }

  /** Registriert den Handler des Tools; wendet einen lesbaren Zwischenspeicher an, sobald auch starte() lief (E17). */
  folge(h: FolgeHandler): void {
    if (this.gestoppt) return;
    this.handler = h;
    this.wendeVorratAn();
    this.versuche(); // ein Stand, der vor der Registrierung kam
    this.starteAbo(); // schon verbunden: das Abo geht jetzt hinaus
    this.melde();
  }

  /** Der Client läuft (Sperre der App, whenReady): Zwischenspeicher lesen, Zuhörer anhängen. */
  starte(): void {
    if (this.gestartet || this.gestoppt) return;
    this.gestartet = true;
    this.vorrat = this.vorratErledigt ? null : this.speicher.lies();
    this.client.on('zustand', (z: ClientZustand) => this.aufZustand(z));
    this.client.on('angemeldet', () => this.aufAngemeldet());
    this.client.on('daten', (n: DatenZeile) => this.aufDaten(n));
    this.wendeVorratAn();
    if (this.client.zustand().art === 'verbunden') this.aufAngemeldet();
    this.melde();
  }

  stoppe(): void {
    this.gestoppt = true;
    this.stoppeAboZeitgeber();
    this.beendeVersuche();
    for (const t of this.gedrosselt.values()) this.uhr.clearTimeout(t);
    this.gedrosselt.clear();
  }

  daten(): VerbundDaten {
    const z = this.client.zustand();
    const k = this.client.kopplung();
    const a = this.angewendet;
    if (z.art === 'fehler' && z.code === 'datei') {
      return a ? { art: 'frueher', grund: 'datei', ...this.mitStand(a.masterName) } : { art: 'datei-defekt' };
    }
    if (!this.istSlave(k)) {
      return a ? { art: 'frueher', grund: 'entkoppelt', ...this.mitStand(a.masterName) } : { art: 'einzelplatz' };
    }
    const m = this.mitStand(this.masterName(k));
    if (z.art !== 'verbunden') return { art: 'getrennt', client: z, ...m };
    if (this.letzter) return { art: 'aktuell', letzter: this.letzter, ...m };
    return this.fristAbgelaufen ? { art: 'ohne-daten', ...m } : { art: 'warte', ...m };
  }

  /** Slave mit Kopplung, Datei lesbar, und der angewendete Stand stammt von DIESEM Master (16.1). */
  imVerbundmodus(): boolean {
    const z = this.client.zustand();
    if (z.art === 'fehler' && z.code === 'datei') return false;
    const k = this.client.kopplung();
    return this.istSlave(k) && this.angewendet !== null && this.angewendet.masterId === k.masterId;
  }

  /** verbundDatenErsetzt (E16): Zwischenspeicher löschen, `angewendet` null; aus `frueher` wird `einzelplatz`. */
  ersetzt(): void {
    this.angewendet = null;
    this.vorrat = null;
    this.vorratErledigt = true;
    this.fehler = undefined;
    this.beendeVersuche();
    this.wartend = null;
    this.schreibGeneration++;
    if (this.darfSchreiben) this.speicher.loesche();
    this.melde();
  }

  kopplung(): VerbundKopplung | null {
    const k = this.client.kopplung();
    if (!k) return null;
    const z = this.client.zustand();
    return {
      rolle: k.rolle,
      masterId: k.masterId,
      masterName: k.masterName,
      masterAdresse: z.art === 'verbunden' ? z.adresse : null,
      adressen: [...k.adressen],
      letzteAdresse: k.letzteAdresse,
    };
  }

  /** Logzeilen aus 16.1 für ignoriertes RELOAD bzw. einen Show-Deep-Link, höchstens einmal je Minute und Weg (E19). */
  ignoriert(weg: 'reload' | 'deeplink', pfad?: string): void {
    if (this.gestoppt || this.gedrosselt.has(weg)) return;
    const k = this.client.kopplung();
    const m = this.istSlave(k) ? this.masterName(k) : (this.angewendet?.masterName ?? 'Master');
    this.log(
      'info',
      weg === 'reload'
        ? `Verbund: RELOAD ignoriert, die Show-Daten kommen vom Master „${m}“.`
        : `Verbund: Show-Deep-Link „${pfad ?? ''}“ liefert hier nur Dokumente, die Show-Daten kommen vom Master „${m}“.`,
    );
    this.gedrosselt.set(weg, this.uhr.setTimeout(() => this.gedrosselt.delete(weg), IGNORIERT_DROSSEL_MS));
  }

  // ── Ereignisse des Clients ──────────────────────────────────────────────────

  private aufZustand(z: ClientZustand): void {
    if (this.gestoppt) return;
    if (z.art !== 'verbunden') this.verbindungVorbei();
    // Ende des Verbunds (entkoppelt, Rolle aus oder Master, Datei beschädigt) oder direkt ein anderer Master (16.1
    // „Anderer Master“): Ein Stand des bisherigen Masters wird nicht weiter versucht. Ein Stand aus dem
    // Zwischenspeicher gehört zum Start (16.3) und bleibt im Versuch.
    const k = this.client.kopplung();
    if (this.ziel && !this.ziel.ausSpeicher && (!this.istSlave(k) || this.ziel.stand.masterId !== k.masterId)) this.beendeVersuche();
    this.melde();
  }

  private aufAngemeldet(): void {
    if (this.gestoppt) return;
    this.verbindungVorbei();
    this.gewarnt.clear();
    this.starteAbo();
    this.melde();
  }

  private aufDaten(n: DatenZeile): void {
    if (this.gestoppt || (n.t !== 'stand' && n.t !== 'aenderung')) return;
    const k = this.client.kopplung();
    if (!this.istSlave(k)) return; // ohne Abo schickt der Master nichts; Rolle Master folgt nie (E29)
    this.antwortDa = true;
    this.stoppeAboZeitgeber();
    const masterName = this.masterName(k);
    const p = pruefeStand(n);
    let show: Show | null = null;
    let feld = p.ok ? null : p.grund;
    if (p.ok && p.wert.show) {
      try {
        show = migrateShow(p.wert.show);
      } catch {
        feld = 'show';
      }
    }
    if (!p.ok || feld !== null) {
      const f = feld ?? 'unbekannt';
      this.verworfen = { grund: f, seit: this.uhr.jetzt() };
      const schluessel = `${n.t}/${f}`;
      if (!this.gewarnt.has(schluessel)) {
        this.gewarnt.add(schluessel);
        this.log('warn', `Verbund: Show-Daten von „${masterName}“ verworfen (${n.t}, Feld ${f}).`);
      }
      this.melde();
      return;
    }
    const w = p.wert;
    this.verworfen = undefined;
    const stand: MasterStand = {
      masterId: k.masterId,
      masterName,
      epoche: w.epoche,
      folge: w.folge,
      schluessel: w.schluessel,
      show,
      ...(show ? {} : { grund: w.grund }),
      mitDokument: [...w.mitDokument],
      empfangenAm: this.uhr.jetzt(),
    };
    // Ein älterer Stand derselben Epoche (verspäteter Rest) verdrängt den neueren nicht aus der Anzeige.
    if (!this.letzter || !this.istAelter(stand, this.letzter)) this.letzter = stand;
    if (!stand.show) {
      // Nichts mehr anzuwenden: ein Stand ohne Show löscht `fehler` und beendet die Versuche (16.2).
      this.fehler = undefined;
      this.beendeVersuche();
    } else if (this.istNeu(stand)) {
      this.setzeZiel(stand as MitShow, null, false);
    }
    this.melde();
  }

  // ── Abo ─────────────────────────────────────────────────────────────────────

  /** Einmal je Verbindung, nur wenn das Tool folgt, verbunden ist und Rolle Slave mit Kopplung hat. */
  private starteAbo(): void {
    if (this.gestoppt || this.aboInDieserVerbindung || !this.handler) return;
    if (this.client.zustand().art !== 'verbunden' || !this.istSlave(this.client.kopplung())) return;
    this.aboInDieserVerbindung = true;
    this.sendeAbo();
    this.antwortZeitgeber = this.uhr.setTimeout(() => {
      this.antwortZeitgeber = null;
      this.fristAbgelaufen = true;
      this.melde();
    }, this.f.antwortMs);
  }

  private sendeAbo(): void {
    // Die Zeile kommt aus kodiereAbo (eine Quelle für das Format); sende() nimmt ein Objekt.
    this.client.sende(JSON.parse(kodiereAbo()) as DatenZeile);
    this.wiederholZeitgeber = this.uhr.setTimeout(() => {
      this.wiederholZeitgeber = null;
      if (this.gestoppt || this.antwortDa || this.client.zustand().art !== 'verbunden') return;
      if (!this.istSlave(this.client.kopplung())) return;
      this.sendeAbo();
    }, this.f.aboWiederholMs);
  }

  private stoppeAboZeitgeber(): void {
    if (this.antwortZeitgeber !== null) this.uhr.clearTimeout(this.antwortZeitgeber);
    if (this.wiederholZeitgeber !== null) this.uhr.clearTimeout(this.wiederholZeitgeber);
    this.antwortZeitgeber = null;
    this.wiederholZeitgeber = null;
  }

  /** Ende der Verbindung bzw. neue Anmeldung: alles, was zu EINER Verbindung gehört, zurücksetzen. */
  private verbindungVorbei(): void {
    this.stoppeAboZeitgeber();
    this.letzter = null;
    this.antwortDa = false;
    this.aboInDieserVerbindung = false;
    this.fristAbgelaufen = false;
  }

  // ── Anwenden ────────────────────────────────────────────────────────────────

  private wendeVorratAn(): void {
    if (this.vorratErledigt || !this.gestartet || !this.handler) return;
    this.vorratErledigt = true;
    const v = this.vorrat;
    this.vorrat = null;
    if (!v || !v.show) return;
    const live = this.ziel; // ein Live-Stand, der vor der Registrierung kam
    this.setzeZiel(v as MitShow, false, true);
    if (live && this.istNeu(live.stand)) this.setzeZiel(live.stand, null, false);
  }

  private setzeZiel(stand: MitShow, neueShow: boolean | null, ausSpeicher: boolean): void {
    this.beendeVersuche();
    this.ziel = { stand, neueShow, ausSpeicher, rest: 1 + this.f.anwendeVersuche };
    this.versuche();
  }

  private beendeVersuche(): void {
    if (this.versuchZeitgeber !== null) this.uhr.clearTimeout(this.versuchZeitgeber);
    this.versuchZeitgeber = null;
    this.ziel = null;
  }

  private versuche(): void {
    const z = this.ziel;
    const h = this.handler;
    if (!z || !h || this.gestoppt || this.versuchZeitgeber !== null) return;
    if (z.neueShow === null) z.neueShow = this.istNeueShow(z.stand);
    z.rest--;
    try {
      h.anwenden(z.stand, z.neueShow);
    } catch (e) {
      const grund = grundAus(e);
      const erster = this.fehler !== grund;
      this.fehler = grund;
      if (z.rest > 0) {
        if (erster) this.log('warn', `Verbund: Show vom Master „${z.stand.masterName}“ nicht übernommen (${grund}), neuer Versuch in 1 s.`);
        this.versuchZeitgeber = this.uhr.setTimeout(() => {
          this.versuchZeitgeber = null;
          this.versuche();
          this.melde();
        }, this.f.anwendePauseMs);
      } else {
        this.log('warn', `Verbund: Show vom Master „${z.stand.masterName}“ nicht übernommen (${grund}), weiter erst mit dem nächsten Stand.`);
        this.ziel = null;
      }
      return;
    }
    this.ziel = null;
    this.angewendet = z.stand;
    this.fehler = undefined;
    // Der Showname kommt aus dem Netz: einzeilig und gekürzt ins Log (G6).
    this.log('info', `Verbund: Show „${kuerzeName(z.stand.show.name)}“ vom Master „${z.stand.masterName}“ übernommen (Stand ${z.stand.folge}${z.neueShow ? ', neue Show' : ''}).`);
    if (!z.ausSpeicher) this.schreibeSpaeter(z.stand);
  }

  /** Neu = andere Epoche oder größere Folge als der angewendete UND als der gerade versuchte Stand (13.3). */
  private istNeu(s: MasterStand): boolean {
    const neuerAls = (r: MasterStand | null): boolean =>
      r === null || r.masterId !== s.masterId || r.epoche !== s.epoche || s.folge > r.folge;
    return neuerAls(this.angewendet) && neuerAls(this.ziel?.stand ?? null);
  }

  private istAelter(s: MasterStand, r: MasterStand): boolean {
    return s.masterId === r.masterId && s.epoche === r.epoche && s.folge < r.folge;
  }

  /** neueShow: erster Stand, oder masterId bzw. schluessel weichen vom angewendeten ab (16.2). */
  private istNeueShow(s: MasterStand): boolean {
    const a = this.angewendet;
    return a === null || a.masterId !== s.masterId || a.schluessel !== s.schluessel;
  }

  // ── Zwischenspeicher: der Reihe nach, nur der neueste (16.3, G14) ────────────

  private schreibeSpaeter(s: MasterStand): void {
    if (!this.darfSchreiben) return;
    this.wartend = s;
    if (this.schreibt) return;
    this.schreibt = true;
    void (async () => {
      try {
        while (this.wartend) {
          const naechster = this.wartend;
          this.wartend = null;
          const generation = this.schreibGeneration;
          try {
            await this.speicher.schreibe(naechster);
          } catch {
            /* der Speicher meldet selbst; ein Fehler hier darf die Kette nicht beenden */
          }
          // ersetzt() kam während des Schreibens: die gerade geschriebene Datei gilt nicht mehr.
          if (generation !== this.schreibGeneration) this.speicher.loesche();
        }
      } finally {
        this.schreibt = false;
      }
    })();
  }

  // ── Hilfen ──────────────────────────────────────────────────────────────────

  private istSlave(k: KopplungInfo | null): k is KopplungInfo & { masterId: string } {
    return k !== null && k.rolle === 'slave' && typeof k.masterId === 'string' && k.masterId.length > 0;
  }

  /** ⟨M⟩: der Name aus der laufenden Anmeldung, sonst aus master-link.json. */
  private masterName(k: KopplungInfo): string {
    const z = this.client.zustand();
    return (z.art === 'verbunden' && z.masterName) || k.masterName || 'Master';
  }

  private mitStand(masterName: string): {
    masterName: string;
    angewendet: MasterStand | null;
    fehler?: string;
    verworfen?: { grund: string; seit: number };
  } {
    return {
      masterName,
      angewendet: this.angewendet,
      ...(this.fehler !== undefined ? { fehler: this.fehler } : {}),
      ...(this.verworfen ? { verworfen: { ...this.verworfen } } : {}),
    };
  }

  private melde(): void {
    if (this.gestoppt) return;
    const d = this.daten();
    const s = signatur(d);
    if (s === this.gemeldet) return;
    this.gemeldet = s;
    this.sicher('wechsel', () => this.emit('wechsel', d));
    this.sicher('beiWechsel', () => this.handler?.beiWechsel?.(d));
  }

  /** Ein werfender Zuhörer darf die Zustandsmaschine nicht treffen; je Meldungswechsel eine Logzeile. */
  private sicher(name: string, f: () => void): void {
    try {
      f();
    } catch (e) {
      const schluessel = `${name}/${grundAus(e)}`;
      if (schluessel === this.wurfGeloggt) return;
      this.wurfGeloggt = schluessel;
      this.log('warn', `Verbund: Zuhörer von „${name}“ warf (${grundAus(e)}).`);
    }
  }

  private log(stufe: 'info' | 'warn', t: string): void {
    try {
      this.logFn(stufe, t);
    } catch {
      /* Logging darf nie werfen */
    }
  }
}
```

- [ ] **Step 4: Test laufen lassen, er muss bestehen**

```bash
npm run selftest -w @jm/app-runtime
```
Erwartet: `50 passed, 0 failed`, dann 64 Zeilen `  ok  C11 …` und 110 Zeilen `  ok  C12 …` (von „C12 Fristen: 5 s, 30 s, 5 Versuche, 1 s“ bis „C12 ignoriert: nach 60 s wieder eine Zeile“), keine `FAIL`-Zeile, am Ende `174 passed, 0 failed`, Exit-Code 0.

- [ ] **Step 5: Typprüfung**

```bash
npx tsc --noEmit --strict --isolatedModules --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --types node packages/app-runtime/src/verbund-typen.ts packages/app-runtime/src/verbund-anzeige.ts packages/app-runtime/src/verbund-daten.ts
npm run typecheck --workspaces --if-present
```
Erwartet: der erste Befehl ohne Ausgabe, Exit-Code 0; der zweite Exit-Code 0 ohne `error TS` (die neuen Module sieht er erst ab C13).

- [ ] **Step 6: Gegenprobe (nicht committen)**

Je eine Änderung in `packages/app-runtime/src/verbund-daten.ts` einspielen, `npx tsx packages/app-runtime/test/verbund.test.ts` laufen lassen, zurückbauen:

| Änderung (Vorher → Nachher) | erwartete `FAIL`-Zeilen |
| --- | --- |
| `s.folge > r.folge;` → `s.folge >= r.folge;` | 8, darunter „C12 gleiche Epoche und Folge → nicht angewendet“ und „C12 älterer Stand nach neuerem → anwenden nicht gerufen (Review Focus 2)“ |
| `if (!this.letzter \|\| !this.istAelter(stand, this.letzter)) this.letzter = stand;` → `this.letzter = stand;` | 1: „C12 älterer Stand verdrängt den neueren nicht aus der Anzeige“ |
| die Zeile `if (!this.darfSchreiben) return;` in `schreibeSpaeter` entfernen | 1: „C12 darfSchreiben false → kein Schreiben, kein Löschen (G14)“ |
| `a.masterId !== s.masterId \|\| a.schluessel !== s.schluessel;` → `a.masterId !== s.masterId;` | 2: „C12 anderer schluessel → neueShow true“, „C12 Start mit X, erster Stand Y → neueShow true (Review Focus 3)“ |
| `this.setzeZiel(v as MitShow, false, true);` → `this.setzeZiel(v as MitShow, true, true);` | 2: „C12 Start: Zwischenspeicher genau einmal mit neueShow false“, „C12 Live-Stand gleich dem Zwischenspeicher → nur einmal angewendet“ |
| `if (!this.gewarnt.has(schluessel)) {` → `if (true) {` | 2: „C12 Warnung einmal je Typ und Feld“, „C12 neue Verbindung → dieselbe Warnung noch einmal“ |
| ``Show „${kuerzeName(z.stand.show.name)}“`` → ``Show „${z.stand.show.name}“`` (N5) | 1: „C12 Logzeile „übernommen“: Showname einzeilig und gekürzt (kuerzeName)“ |
| die Zeile `if (this.ziel && !this.ziel.ausSpeicher && (!this.istSlave(k) \|\| this.ziel.stand.masterId !== k.masterId)) this.beendeVersuche();` in `aufZustand` entfernen (N4, N18) | 2: „C12 Verbund endet während der Versuche → keine weiteren Versuche (16.1)“, „C12 Kopplung wechselt an einen anderen Master → keine weiteren Versuche mit dem Stand des bisherigen (16.1)“ |
| `if (this.ziel && !this.ziel.ausSpeicher && (!this.istSlave(k)` → `if (this.ziel && (!this.istSlave(k)` (N4) | 1: „C12 … ein Stand aus dem Zwischenspeicher wird weiter versucht (16.3)“ |
| ` \|\| this.ziel.stand.masterId !== k.masterId)) this.beendeVersuche();` → `)) this.beendeVersuche();` (N18) | 1: „C12 Kopplung wechselt an einen anderen Master → keine weiteren Versuche mit dem Stand des bisherigen (16.1)“ |
| in `nichtAngewendet` `{ code }` → `{ code: undefined as unknown as string }` (N3) | 2: „C12 nichtAngewendet(code) → V12 mit dem Code“, „C12 … Logzeile mit dem Code“ |

Danach zeigt `npx tsx packages/app-runtime/test/verbund.test.ts` wieder `174 passed, 0 failed`.

- [ ] **Step 7: Commit**

```bash
git add packages/app-runtime/src/verbund-daten.ts packages/app-runtime/test/verbund.test.ts
git status --short
```
Erwartet genau:
```
A  packages/app-runtime/src/verbund-daten.ts
M  packages/app-runtime/test/verbund.test.ts
```
Dann:
```bash
git commit -m "feat(app-runtime): Zustandsmaschine VerbundFolger der Tool-Seite (Teil 2b R2)" -m "Rein, mit uebergebener Uhr (G13): Abo nach jeder Anmeldung nur fuer ein Tool, das folgt, mit Rolle Slave und Kopplung; nach 5 s ohne-daten, Abo alle 30 s erneut. Neu = andere Epoche oder groessere Folge als angewendet bzw. gerade versucht; neueShow bei anderem Master oder Schluessel. anwenden wirft -> fehler (Code, nie die Meldung), bis zu fuenf neue Versuche im Abstand von 1 s. Ungueltiger Stand -> verworfen, Warnung je Verbindung einmal je Typ und Feld. Zwischenspeicher beim Start genau einmal mit neueShow false (E17), Schreiben der Reihe nach, nur der neueste, nie ohne Sperre (G14). ersetzt() (E16), kopplung(), Drossel der ignoriert-Zeilen (E19). Versuche mit einem Stand vom Master enden mit dem Verbund oder beim Wechsel an einen anderen Master (16.1)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst (C12):**
- **`VERBUND_FRISTEN` ist `Readonly<VerbundFristen>` statt `as const`** (neues exportiertes Interface `VerbundFristen`). Mit `as const` hätte `Partial<typeof VERBUND_FRISTEN>` nur die Literalwerte 5000, 30000 … zugelassen; C19 braucht kurze Fristen. Werte und Schlüssel sind unverändert.
- **Neue Methode `VerbundFolger.ignoriert(weg, pfad?)`** (E19): Die Drossel braucht die übergebene Uhr und den Namen des Masters; beides hat der Folger. `verbundIgnoriert` in C13 ruft sie nur weiter. Der Test „verbundIgnoriert: zweite Zeile innerhalb 60 s unterdrückt, je Weg getrennt“ steht deshalb hier statt in C13. Die Drossel ist ein Zeitgeber (60 s), keine Zeitdifferenz (G13).
- **Abo nur, wenn das Tool folgt:** Ein Tool schickt `abo` erst, wenn `folge()` gerufen ist; ist es da schon verbunden, geht das Abo sofort hinaus, sonst nach der nächsten Anmeldung (einmal je Verbindung). Grund: `startMasterLink` läuft in jedem Tool mit `masterLink` (25 Apps). Ohne diese Bedingung abonnierten auch Q&A, Battle, Caption usw. und belegten Plätze der Grenze von 32 Abos je Rechner; 15.5 sagt „Andere Tools … wenden in 2b keine Daten an“. Folge für C10/C20: Registriert ein Tool später als 10 s nach seiner Anmeldung, zeigt der Master bis dahin „ohne Show-Daten (Update nötig)“. Block D registriert nach E17 gleich nach dem Start.
- **Ein gerade versuchter Stand zählt beim Vergleich „neu“ mit:** Ein Stand, der nicht neuer ist als das laufende Ziel, ersetzt es nicht. Nach dem fünften neuen Versuch (also dem sechsten Fehlschlag) fällt das Ziel weg (`fehler` bleibt stehen), und der nächste Stand, der neuer ist als der angewendete, wird wieder versucht, auch derselbe nach einem Neuabo. 16.2 sagt nur „Danach versucht es erst der nächste Stand“.
- **Ein älterer Stand derselben Epoche ersetzt `letzter` nicht** (Review Focus 2: die Anzeige bleibt beim neueren). 13.3 regelt nur das Anwenden.
- **⟨M⟩:** der Name aus der laufenden Anmeldung (`hallo`, gekürzt vom Client), sonst `kopplung.masterName`, sonst „Master“. In `frueher` steht der Name, der mit dem angewendeten Stand kam (der frühere Master).
- **Grund in `fehler`:** `err.code`, sonst der Fehlertyp (`TypeError` …), höchstens 40 Zeichen aus `[A-Za-z0-9_.-]`, nie die Meldung (G6). V12 zeigt also etwa „Show vom Master nicht übernommen: EBUSY“. Ein Tool, das einen lesbaren Grund zeigen will, wirft `nichtAngewendet(code)` (neuer Export, über `index.ts` öffentlich, N3); ein einfaches `Error` ergäbe nur „Error“. Titler (C16) und Rundown (C18) werfen so.
- **Ende des Verbunds während der Anwende-Versuche** (N4): `aufZustand` beendet die Versuche, wenn die Kopplung keinen Slave mehr zeigt (entkoppelt, Rolle aus oder Master, Datei beschädigt) und das Ziel ein Stand vom Master ist. Ein Stand aus dem Zwischenspeicher gehört zum Start (16.3) und wird weiter versucht. 16.1 sagt nur, dass nach dem Ende der Einzelplatz-Weg gilt.
- **Direkter Wechsel an einen anderen Master während der Anwende-Versuche** (N18): Ebenso enden die Versuche, wenn die Kopplung weiter einen Slave zeigt, aber mit einer anderen `masterId` als der Stand im Versuch. Sonst könnte ein später gelungener Versuch den Stand des bisherigen Masters noch anwenden und in den Zwischenspeicher schreiben; 16.1 „Anderer Master“ lässt die alten Daten nur stehen, bis der erste Stand des neuen Masters sie ersetzt. Eine Prüfung, rot gegen die Fassung vor N18 (Gegenprobe in Step 6).
- **Showname in der Logzeile „übernommen“** läuft durch `kuerzeName` aus `@jm/master-link` (einzeilig, höchstens 60 Zeichen, N5): Er kommt aus dem Netz, und `migrateShow` säubert ihn nicht.
- **Zwischenspeicher der Reihe nach:** Der Folger schreibt nie zwei Stände gleichzeitig; kommt während des Schreibens ein neuer, folgt danach nur der neueste. Kommt `ersetzt()` während des Schreibens, löscht er die Datei danach noch einmal. `darfSchreiben: false` unterdrückt Schreiben **und** Löschen (G14).
- **`ersetzt()` vor `starte()`** verhindert, dass der Zwischenspeicher später noch angewendet wird (das Tool hat schon eine eigene Show).
- **Ein Stand vor `folge()`** wird gemerkt und nach dem Zwischenspeicher angewendet, wenn er neuer ist. Das ist nur Absicherung: Ohne Abo schickt der Master nichts.
- **Neue Logzeilen ohne Spec-Vorgabe** (E13, Owner-Freigabe vor dem Release): „Verbund: Show „⟨S⟩“ vom Master „⟨M⟩“ übernommen (Stand ⟨Folge⟩[, neue Show]).“ (info); „Verbund: Show vom Master „⟨M⟩“ nicht übernommen (⟨Code⟩), neuer Versuch in 1 s.“ (warn, beim ersten Fehlschlag je Grund); „Verbund: Show vom Master „⟨M⟩“ nicht übernommen (⟨Code⟩), weiter erst mit dem nächsten Stand.“ (warn, nach dem fünften neuen Versuch); „Verbund: Zuhörer von „⟨Name⟩“ warf (⟨Code⟩).“ (warn, einmal je Wechsel). Die Zeile zum ungültigen Stand ist wörtlich E13.

---

### Task 13: C13 · `@jm/app-runtime`: Zwischenspeicher, Electron-Anbindung, IPC und die drei Einfügungen in `index.ts`

**Spec:** 16.1 (Logzeilen „ignoriert“), 16.2 (öffentliche API), 16.3 (`<userData des Tools>/verbund/master-stand.json` mit `fassung: 1`, atomar, bis zu 5 Versuche im Abstand von 50 ms, nicht lesbar → ignoriert mit Warnung), 16.5 (`ipcMain.handle('jmps:verbund-anzeige')`, Wechsel an alle Fenster), 21; G2, G6, G11, G12, G14, G15; E17, E18, E19, E27; Review Focus 5.

**Arbeitsverzeichnis:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b-r2`, Branch `feat/master-link-teil2b-r2`. Alle Pfade relativ dazu, Befehle im Worktree-Wurzelordner (Git Bash). Voraussetzung: C12 ist committet.

**Dateien:**
- Create: `packages/app-runtime/src/verbund-speicher.ts`
- Create: `packages/app-runtime/src/verbund-ipc.ts`
- Create: `packages/app-runtime/src/verbund.ts`
- Modify: `packages/app-runtime/src/index.ts` — genau drei Einfügungen (G2): (a) nach `:48` `export type { CspConfig } from './csp';`, (b) nach `:17` (Import aus `@jm/master-link`), (c) in `startMasterLink` nach `:387` `client.starte();` (Ist-Zeilen auf `adda584693` mit Zoom 4b, N29)
- Modify: `packages/app-runtime/test/verbund.test.ts` (neuer Block direkt vor `// ── Abschluss …`)

**Interfaces:**

Consumes (exakt):
```ts
// C4 · @jm/master-link (adresswahl.ts)
export function eigeneAdressen(ni: NetzwerkInterfaces): string[];   // alle Adressen aller Karten, inkl. intern, ohne Zone
export function istDieserRechner(host: string, eigeneAdressen: readonly string[], eigenerName?: string): boolean;  // Regeln E7
// C2 · @jm/master-link: pruefeStand (Regeln 13.2 auch für den gespeicherten Stand)
// bestehend · @jm/master-link: class MasterLinkClient; @jm/show: migrateShow, Show
// bestehend · packages/app-runtime/src/index.ts: export interface Logger { debug; info; warn; error }
// C11 · verbund-typen.ts, verbund-anzeige.ts (verbundAnzeige)
// C12 · verbund-daten.ts: VerbundFolger, StandSpeicher
```

Produces (S-C):
```ts
// packages/app-runtime/src/verbund-speicher.ts — fs, ohne Electron
export function standDatei(userData: string): string;   // <userData>/verbund/master-stand.json
export function erzeugeStandSpeicher(datei: string, log: (stufe: 'info' | 'warn', t: string) => void,
  umbenennen?: (von: string, nach: string) => void): StandSpeicher;   // Inhalt { fassung: 1, stand }
// packages/app-runtime/src/verbund-ipc.ts — Electron
export const VERBUND_ANZEIGE_KANAL = 'jmps:verbund-anzeige';
export function registriereVerbundIpc(quelle: { daten(): VerbundDaten; on(e: 'wechsel', f: (d: VerbundDaten) => void): unknown }): void;
// packages/app-runtime/src/verbund.ts — Electron; über src/index.ts öffentlich:
export function folgeMasterShow(h: FolgeHandler): void;
export function verbundDaten(): VerbundDaten;              // ohne Client: { art: 'einzelplatz' }
export function imVerbundmodus(): boolean;                 // ohne Client: false
export function verbundDatenErsetzt(): void;               // vor dem Client-Start gemerkt und nachgereicht
export function verbundKopplung(): VerbundKopplung | null;
export function verbundIgnoriert(weg: 'reload' | 'deeplink', pfad?: string): void;
export function istHostDieserRechner(host: string): boolean;   // istDieserRechner mit os.networkInterfaces() und os.hostname()
export function verbundAnClient(client: MasterLinkClient, o: { userData: string; log: Logger }): void;   // nur intern (index.ts)
// packages/app-runtime/src/index.ts — neu öffentlich (Einfügung a):
//   folgeMasterShow, verbundDaten, imVerbundmodus, verbundDatenErsetzt, verbundKopplung, verbundIgnoriert, istHostDieserRechner
//   nichtAngewendet (aus ./verbund-daten, N3), kuerzeName (aus @jm/master-link, für den Rundown, N15)
//   type MasterStand, VerbundDaten, VerbundKopplung, VerbundAnzeige, FolgeHandler
```
Für Block D (Preloads, S-D): Der Renderer liest die Zeile mit `ipcRenderer.invoke('jmps:verbund-anzeige')` → `VerbundAnzeige | null` und bekommt jeden Wechsel als `ipcRenderer.on('jmps:verbund-anzeige', (_e, a) => …)` mit demselben Wert. Ohne laufenden Client (Zweitinstanz, Fehler beim Start) gibt es keinen Handler und `invoke` lehnt ab; der Preload fängt das ab und liefert `null`. `folgeMasterShow` und `verbundDatenErsetzt` dürfen vor dem Client-Start gerufen werden.

**Regeln:** G2 (in `index.ts` genau die Einfügungen a–c, 15 Zeilen, nichts verschoben; alles andere in neuen Dateien), G6 (Warnungen ohne Dateiinhalt, nur Feldname oder Fehlercode), G11, G12 (`index.ts` liegt mit CRLF vor, 660 von 660 Zeilen; nach C13 675 von 675, gemessen am 12.10.2026), G14 (ohne Sperre der App kein Folger; `darfSchreiben` zusätzlich aus `app.hasSingleInstanceLock()`), G15 (`verbund.ts`, `verbund-ipc.ts` und die Einfügungen prüfen Typecheck, Bündel und C20), G16.

**Vorab (gemessen):**
- **Reihenfolge im Tool (E17, Ist-Karte Laufzeit F2):** `initAppRuntime` läuft vor der Sperre; `startMasterLink` baut den Client im ersten `whenReady`-Zuhörer, nur mit Sperre. Einfügung (c) steht direkt nach `client.starte()` (Zusammenführung ZF2): `client.starte()` liest `master-link.json` synchron und meldet bei Rolle Slave oder Master noch im selben Takt `sucht`; erst danach liest der Folger den Zwischenspeicher und hängt seine Zuhörer an. Das synchrone `zustand` verpasst er dabei, aber `starte()` leitet die Lage ohnehin neu ab und meldet sie; `angemeldet` kommt frühestens nach dem TLS-Aufbau. Stünde (c) vor `client.starte()`, liefe ein vorher registrierter Handler mit `kopplung() = null` an: Das Tool zeigte beim Start kurz V13, und Titler oder Rundown gingen über `beiWechsel` auf `frueher` (C19 M prüft das). Den Zwischenspeicher wendet der Folger erst an, wenn auch der Handler registriert ist.
- **`schreibeAtomar` aus `@jm/master-link` wird nicht genutzt (E18):** Es wartet synchron bis zu 2 s (`datei.ts:119-150`). `verbund-speicher.ts` schreibt asynchron (`fs/promises.writeFile`), benennt mit `renameSync` (oder der übergebenen Funktion) um und wartet zwischen den Versuchen mit `setTimeout` 50 ms. Gemessen: viermal `EBUSY`, dann Erfolg → `true` nach 5 Versuchen und mindestens 190 ms; fünfmal `EBUSY` → `false`, eine Warnung, keine Zwischendatei.
- **Lesen:** `readFileSync` auf einen Ordner gleichen Namens ergibt unter Windows `EISDIR` (unter Linux ebenso); der Test lässt `EISDIR`, `EPERM` und `EACCES` gelten. Der gespeicherte Stand wird mit denselben Regeln geprüft wie ein Stand aus dem Netz (`pruefeStand`), dazu `masterId`, `masterName`, `empfangenAm` und Pflicht-`show` (gespeichert wird nur ein angewendeter Stand).
- **Bündel:** siehe Kopf des Blocks; `@jm/show` und `@jm/master-link` werden in jeder App mitgebündelt, die `@jm/app-runtime` bündelt.
- Kein Test lädt `verbund.ts`, `verbund-ipc.ts` oder `index.ts` (Electron). Der Selbsttest prüft `verbund-speicher.ts` mit echtem `fs` im Temp-Ordner und den Neustart auf B mit `VerbundFolger` und echtem Speicher.

---

- [ ] **Step 1: Failing Test schreiben**

In `packages/app-runtime/test/verbund.test.ts` den folgenden Block **direkt vor** der Zeile `// ── Abschluss ────…` einfügen (nach dem Block aus C12). Sonst wird nichts geändert.

Einfügen in `packages/app-runtime/test/verbund.test.ts` direkt vor der Zeile `// ── Abschluss`:
```ts
// ── C13 · Zwischenspeicher master-stand.json (Spec 16.3, E18, Review Focus 5) ─
{
  const { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { EventEmitter } = await import('node:events');
  const { migrateShow } = await import('@jm/show');
  const { erzeugeStandSpeicher, standDatei } = await import('../src/verbund-speicher');
  const { VerbundFolger } = await import('../src/verbund-daten');
  const tmp = mkdtempSync(join(tmpdir(), 'jm-verbund-'));
  try {
    const stand = {
      masterId: 'M1', masterName: 'Regie-PC', epoche: '6f1c2a90-1b2c-4d5e-8f90-a1b2c3d4e5f6', folge: 12, schluessel: '0123456789abcdef',
      show: migrateShow({ schemaVersion: 1, name: 'Gala', updatedAt: '2026-10-08T08:00:00.000Z', tools: [], ablauf: [{ id: 'p1', title: 'Begrüßung' }] }),
      mitDokument: ['jm-rundown'], empfangenAm: 1_760_000_000_000,
    };
    const userData = join(tmp, 'userData');
    const datei = standDatei(userData);
    check('C13 standDatei = <userData>/verbund/master-stand.json', datei === join(userData, 'verbund', 'master-stand.json'));
    const logs: string[] = [];
    const sp = erzeugeStandSpeicher(datei, (stufe, t) => void logs.push(`${stufe}: ${t}`));
    check('C13 ohne Datei → null, keine Warnung', sp.lies() === null && logs.length === 0);
    check('C13 schreiben → true, Ordner verbund angelegt', (await sp.schreibe(stand as never)) === true && existsSync(join(userData, 'verbund')));
    const roh = JSON.parse(readFileSync(datei, 'utf8'));
    check('C13 Datei trägt { fassung: 1, stand }', roh.fassung === 1 && roh.stand.folge === 12 && Object.keys(roh).join(',') === 'fassung,stand');
    check('C13 keine Zwischendatei liegen geblieben', JSON.stringify(readdirSync(join(userData, 'verbund'))) === '["master-stand.json"]');
    check('C13 schreiben und lesen ergibt denselben Stand', JSON.stringify(sp.lies()) === JSON.stringify(stand), sp.lies());

    // Review Focus 5: kaputt, leer, fremd, keine Show → null, EINE Warnung ohne Dateiinhalt
    const faelle: [string, string, string][] = [
      ['halb geschrieben', '{"fassung":1,"stand":{"masterId":"GEHEIM-1","masterName":"GEH', 'kein gültiges JSON'],
      ['leer', '', 'kein gültiges JSON'],
      ['fassung 2', JSON.stringify({ fassung: 2, stand: { ...stand, masterName: 'GEHEIM-2' } }), 'fassung'],
      ['show ist keine Show (Liste)', JSON.stringify({ fassung: 1, stand: { ...stand, show: ['GEHEIM-3'] } }), 'show'],
      ['show fehlt', JSON.stringify({ fassung: 1, stand: { ...stand, show: null } }), 'show'],
      ['masterId fehlt', JSON.stringify({ fassung: 1, stand: { ...stand, masterId: '' } }), 'masterId'],
      ['epoche mit Leerzeichen', JSON.stringify({ fassung: 1, stand: { ...stand, epoche: 'GEHEIM 4' } }), 'epoche'],
      ['folge negativ', JSON.stringify({ fassung: 1, stand: { ...stand, folge: -1 } }), 'folge'],
      ['kein Objekt', '[1,2,3]', 'kein Objekt'],
    ];
    for (const [name, inhalt, grund] of faelle) {
      writeFileSync(datei, inhalt);
      logs.length = 0;
      const ergebnis = sp.lies();
      check(`C13 ${name} → null, eine Warnung (${grund})`, ergebnis === null && logs.length === 1
        && logs[0] === `warn: Verbund: Zwischenspeicher nicht lesbar (${grund}), wird beim nächsten Stand überschrieben.`, logs);
      check(`C13 ${name}: Warnung ohne Dateiinhalt`, !logs.join('\n').includes('GEHEIM'));
    }
    check('C13 der nächste Stand überschreibt die kaputte Datei', (await sp.schreibe(stand as never)) === true && sp.lies()?.folge === 12);
    const ordnerStatt = join(tmp, 'ordner', 'master-stand.json');
    mkdirSync(ordnerStatt, { recursive: true });
    logs.length = 0;
    const sp2 = erzeugeStandSpeicher(ordnerStatt, (stufe, t) => void logs.push(`${stufe}: ${t}`));
    check('C13 Ordner statt Datei → null, Warnung mit Fehlercode', sp2.lies() === null && /^warn: Verbund: Zwischenspeicher nicht lesbar \((EISDIR|EPERM|EACCES)\)/.test(logs[0] ?? ''), logs);

    // Schreiben mit Wiederholung (E18): bis zu 5 Versuche im Abstand von 50 ms bei EPERM/EBUSY/EACCES
    const besetzt = (mal: number, code = 'EBUSY') => {
      const r = { versuche: 0 };
      const f = (von: string, nach: string): void => {
        r.versuche++;
        if (r.versuche <= mal) throw Object.assign(new Error(`${von} ist gesperrt`), { code });
        writeFileSync(nach, readFileSync(von));
        rmSync(von);
      };
      return { r, f };
    };
    const b4 = besetzt(4);
    logs.length = 0;
    const d4 = join(tmp, 'b4', 'master-stand.json');
    const start = Date.now();
    const ok4 = await erzeugeStandSpeicher(d4, (stufe, t) => void logs.push(`${stufe}: ${t}`), b4.f).schreibe(stand as never);
    const dauer = Date.now() - start;
    check('C13 EBUSY viermal, dann ok → true nach fünf Versuchen', ok4 === true && b4.r.versuche === 5 && logs.length === 0, { ok4, versuche: b4.r.versuche, logs });
    check('C13 Abstand zwischen den Versuchen 50 ms (vier Pausen ≥ 190 ms)', dauer >= 190, dauer);
    const b5 = besetzt(5);
    logs.length = 0;
    const d5 = join(tmp, 'b5', 'master-stand.json');
    const ok5 = await erzeugeStandSpeicher(d5, (stufe, t) => void logs.push(`${stufe}: ${t}`), b5.f).schreibe(stand as never);
    check('C13 EBUSY fünfmal → false, eine Warnung mit Code', ok5 === false && b5.r.versuche === 5 && JSON.stringify(logs) === '["warn: Verbund: Zwischenspeicher nicht geschrieben (EBUSY)."]', logs);
    check('C13 gescheitertes Schreiben räumt die Zwischendatei weg', readdirSync(join(tmp, 'b5')).length === 0);
    const bx = besetzt(1, 'ENOENT');
    const okx = await erzeugeStandSpeicher(join(tmp, 'bx', 'master-stand.json'), () => {}, bx.f).schreibe(stand as never);
    check('C13 anderer Fehler (ENOENT) → kein zweiter Versuch', okx === false && bx.r.versuche === 1);
    sp.loesche();
    sp.loesche();
    check('C13 loesche zweimal wirft nicht, danach null', sp.lies() === null && !existsSync(datei));

    // Neustart auf B: Folger mit echtem Speicher (16.3)
    class Client extends EventEmitter {
      z: Record<string, unknown> = { art: 'aus' };
      zustand() { return this.z; }
      kopplung() { return { rolle: 'slave', masterId: 'M1', masterName: 'Regie-PC', letzteAdresse: null, adressen: [] }; }
      sende() { return this.z.art === 'verbunden'; }
    }
    const angewendet: { name: string; neueShow: boolean }[] = [];
    const handler = { anwenden: (s: { show: { name: string } }, neueShow: boolean) => void angewendet.push({ name: s.show.name, neueShow }) };
    const c1 = new Client();
    const f1 = new VerbundFolger({ client: c1 as never, speicher: erzeugeStandSpeicher(datei, () => {}), log: () => {} });
    f1.folge(handler as never);
    f1.starte();
    c1.z = { art: 'verbunden', adresse: '10.0.0.5', seit: 0, masterName: 'Regie-PC', suite: '0.15.0' };
    c1.emit('angemeldet', {});
    c1.emit('daten', { t: 'stand', art: 'show', fassung: 1, epoche: 'e1', folge: 0, schluessel: '0123456789abcdef', show: stand.show, mitDokument: [] });
    // Auf das asynchrone Schreiben warten (Zwischendatei, dann umbenennen): bis die Datei da ist, höchstens 5 s.
    // Eine feste Pause wäre unter Last (CI) zu knapp.
    for (const ende = Date.now() + 5000; !existsSync(datei) && Date.now() < ende; ) await new Promise((r) => setTimeout(r, 10));
    f1.stoppe();
    const c2 = new Client();
    const f2 = new VerbundFolger({ client: c2 as never, speicher: erzeugeStandSpeicher(datei, () => {}), log: () => {} });
    f2.starte();
    f2.folge(handler as never);
    check('C13 Neustart: Stand aus master-stand.json mit neueShow false angewendet', JSON.stringify(angewendet) === '[{"name":"Gala","neueShow":true},{"name":"Gala","neueShow":false}]', angewendet);
    check('C13 Neustart, Master fehlt: Verbundmodus, Daten bleiben', f2.imVerbundmodus() === true && f2.daten().art === 'getrennt');
    f2.stoppe();
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

```

- [ ] **Step 2: Test laufen lassen, er muss scheitern**

```bash
npm run selftest -w @jm/app-runtime
```
Erwartet: `50 passed, 0 failed`, danach 64 Zeilen `  ok  C11 …` und 110 Zeilen `  ok  C12 …`, keine `C13`-Zeile, Abbruch beim Laden, Exit-Code 1:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\packages\app-runtime\src\verbund-speicher' imported from …\packages\app-runtime\test\verbund.test.ts
```

- [ ] **Step 3: Zwischenspeicher anlegen**

Neue Datei `packages/app-runtime/src/verbund-speicher.ts`, ganzer Inhalt:
```ts
// ─────────────────────────────────────────────────────────────────────────────
// Verbund der Tool-Seite: Zwischenspeicher (Master-Link Teil 2b, Release 2, Spec 16.3, E18).
//
// `<userData des Tools>/verbund/master-stand.json` = { fassung: 1, stand } mit dem zuletzt
// angewendeten Stand vom Master. Ohne Electron: den Pfad gibt verbund.ts hinein.
// • Schreiben: asynchron, Zwischendatei und Umbenennen, bis zu 5 Versuche im Abstand von 50 ms
//   bei EPERM/EBUSY/EACCES (Virenscanner, Indexdienst). Bewusst NICHT schreibeAtomar aus
//   @jm/master-link: das wartet synchron bis zu 2 s und hielte den Main-Prozess an (E18).
// • Lesen: tolerant. Fehlt die Datei → null. Ist sie kaputt, leer, fremd (fassung ≠ 1) oder trägt
//   sie keinen gültigen Stand → null und EINE Warnung; die Warnung nennt nie Dateiinhalt (G6),
//   nur einen Feldnamen oder Fehlercode. Der nächste angewendete Stand überschreibt die Datei.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { migrateShow, type Show } from '@jm/show';
import { pruefeStand } from '@jm/master-link';
import type { MasterStand } from './verbund-typen';
import type { StandSpeicher } from './verbund-daten';

const FASSUNG = 1;
const VERSUCHE = 5;
const PAUSE_MS = 50;
const NOCHMAL = new Set(['EPERM', 'EBUSY', 'EACCES']);

/** `<userData>/verbund/master-stand.json` (16.3). */
export function standDatei(userData: string): string {
  return join(userData, 'verbund', 'master-stand.json');
}

/** Nur ein Fehlercode wie ENOENT oder EBUSY, nie ein Fehlertext (der kann Pfade oder Inhalt tragen). */
function codeAus(e: unknown): string {
  const c = (e as { code?: unknown } | null)?.code;
  return typeof c === 'string' && /^[A-Z][A-Z0-9_]*$/.test(c) ? c : 'unbekannt';
}

const istObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Prüft den gespeicherten Stand; liefert ihn oder den Namen des ersten falschen Felds. */
function pruefeGespeichert(roh: unknown): MasterStand | string {
  if (!istObj(roh)) return 'kein Objekt';
  if (roh.fassung !== FASSUNG) return 'fassung';
  const s = roh.stand;
  if (!istObj(s)) return 'stand';
  if (typeof s.masterId !== 'string' || !s.masterId) return 'masterId';
  if (typeof s.masterName !== 'string') return 'masterName';
  if (typeof s.empfangenAm !== 'number' || !Number.isFinite(s.empfangenAm) || s.empfangenAm < 0) return 'empfangenAm';
  if (!istObj(s.show)) return 'show'; // gespeichert wird nur ein angewendeter Stand, also immer mit Show
  // Epoche, Folge, Schlüssel und mitDokument nach denselben Regeln wie ein Stand aus dem Netz (13.2).
  const p = pruefeStand({ art: 'show', fassung: 1, epoche: s.epoche, folge: s.folge, schluessel: s.schluessel, show: s.show, mitDokument: s.mitDokument });
  if (!p.ok) return p.grund;
  let show: Show;
  try {
    show = migrateShow(s.show);
  } catch {
    return 'show';
  }
  return {
    masterId: s.masterId,
    masterName: s.masterName,
    epoche: p.wert.epoche,
    folge: p.wert.folge,
    schluessel: p.wert.schluessel,
    show,
    mitDokument: p.wert.mitDokument,
    empfangenAm: s.empfangenAm,
  };
}

export function erzeugeStandSpeicher(
  datei: string,
  log: (stufe: 'info' | 'warn', t: string) => void,
  umbenennen: (von: string, nach: string) => void = renameSync,
): StandSpeicher {
  const zwischen = `${datei}.tmp`;
  const warne = (t: string): void => {
    try {
      log('warn', t);
    } catch {
      /* Logging darf nie werfen */
    }
  };
  const pause = (): Promise<void> => new Promise((fertig) => setTimeout(fertig, PAUSE_MS));

  return {
    lies(): MasterStand | null {
      let text: string;
      try {
        text = readFileSync(datei, 'utf8');
      } catch (e) {
        if (codeAus(e) !== 'ENOENT') warne(`Verbund: Zwischenspeicher nicht lesbar (${codeAus(e)}), wird beim nächsten Stand überschrieben.`);
        return null;
      }
      let roh: unknown;
      try {
        roh = JSON.parse(text);
      } catch {
        warne('Verbund: Zwischenspeicher nicht lesbar (kein gültiges JSON), wird beim nächsten Stand überschrieben.');
        return null;
      }
      const ergebnis = pruefeGespeichert(roh);
      if (typeof ergebnis === 'string') {
        warne(`Verbund: Zwischenspeicher nicht lesbar (${ergebnis}), wird beim nächsten Stand überschrieben.`);
        return null;
      }
      return ergebnis;
    },

    async schreibe(s: MasterStand): Promise<boolean> {
      const inhalt = `${JSON.stringify({ fassung: FASSUNG, stand: s })}\n`;
      let code = 'unbekannt';
      try {
        mkdirSync(dirname(datei), { recursive: true });
      } catch (e) {
        code = codeAus(e);
        warne(`Verbund: Zwischenspeicher nicht geschrieben (${code}).`);
        return false;
      }
      for (let versuch = 1; versuch <= VERSUCHE; versuch++) {
        try {
          await writeFile(zwischen, inhalt, 'utf8');
          umbenennen(zwischen, datei);
          return true;
        } catch (e) {
          code = codeAus(e);
          if (!NOCHMAL.has(code) || versuch === VERSUCHE) break;
          await pause();
        }
      }
      try {
        rmSync(zwischen, { force: true });
      } catch {
        /* Zwischendatei bleibt liegen — das nächste Schreiben überschreibt sie */
      }
      warne(`Verbund: Zwischenspeicher nicht geschrieben (${code}).`);
      return false;
    },

    loesche(): void {
      for (const p of [datei, zwischen]) {
        try {
          rmSync(p, { force: true });
        } catch {
          /* nicht löschbar (etwa ein Ordner gleichen Namens) — das Lesen verwirft ihn ohnehin */
        }
      }
    },
  };
}
```

- [ ] **Step 4: Test laufen lassen, er muss bestehen**

```bash
npm run selftest -w @jm/app-runtime
```
Erwartet: `50 passed, 0 failed`, dann 64 Zeilen `C11`, 110 Zeilen `C12` und 34 Zeilen `  ok  C13 …` (von „C13 standDatei = <userData>/verbund/master-stand.json“ bis „C13 Neustart, Master fehlt: Verbundmodus, Daten bleiben“), keine `FAIL`-Zeile, am Ende `208 passed, 0 failed`, Exit-Code 0. Danach liegt kein Ordner `jm-verbund-*` mehr im Temp-Verzeichnis (`ls "$TMP" | grep -c jm-verbund-` gibt `0` aus).

- [ ] **Step 5: IPC anlegen**

Neue Datei `packages/app-runtime/src/verbund-ipc.ts`, ganzer Inhalt:
```ts
// ─────────────────────────────────────────────────────────────────────────────
// Verbund der Tool-Seite: IPC zur Anzeige (Master-Link Teil 2b, Release 2, Spec 16.5).
//
// Der Renderer fragt die Zeile mit `ipcRenderer.invoke('jmps:verbund-anzeige')` ab und bekommt
// jeden Wechsel als `jmps:verbund-anzeige`. Die Netzarbeit bleibt im Main, die CSP bleibt unberührt.
// Geprüft über den Typecheck aller Workspaces und den Durchgang (G15), nicht im Selbsttest.
// ─────────────────────────────────────────────────────────────────────────────
import { BrowserWindow, ipcMain } from 'electron';
import { verbundAnzeige } from './verbund-anzeige';
import type { VerbundDaten } from './verbund-typen';

export const VERBUND_ANZEIGE_KANAL = 'jmps:verbund-anzeige';

export function registriereVerbundIpc(quelle: {
  daten(): VerbundDaten;
  on(e: 'wechsel', f: (d: VerbundDaten) => void): unknown;
}): void {
  try {
    ipcMain.handle(VERBUND_ANZEIGE_KANAL, () => verbundAnzeige(quelle.daten()));
  } catch {
    /* schon registriert (zweiter Aufruf) — der erste Handler bleibt */
  }
  quelle.on('wechsel', (d) => {
    const anzeige = verbundAnzeige(d);
    for (const w of BrowserWindow.getAllWindows()) {
      try {
        if (!w.isDestroyed()) w.webContents.send(VERBUND_ANZEIGE_KANAL, anzeige);
      } catch {
        /* Fenster schließt gerade */
      }
    }
  });
}
```

- [ ] **Step 6: Electron-Anbindung anlegen**

Neue Datei `packages/app-runtime/src/verbund.ts`, ganzer Inhalt:
```ts
// ─────────────────────────────────────────────────────────────────────────────
// Verbund der Tool-Seite: Electron-Anbindung (Master-Link Teil 2b, Release 2, Spec 16.1, 16.2, 16.5).
//
// Ein VerbundFolger je Tool-Prozess über dem Master-Link-Client aus index.ts (startMasterLink).
// Der Client entsteht erst in app.whenReady und nur mit Single-Instance-Lock; eine Zweitinstanz
// hat deshalb keinen Folger, kein Abo und schreibt nie master-stand.json (G14).
// Die Tools rufen die öffentlichen Funktionen unten jederzeit — auch bevor der Client läuft:
// `folgeMasterShow` und `verbundDatenErsetzt` werden dann gemerkt und beim Start nachgereicht.
// Die Logik steckt in verbund-daten.ts (rein, mit Tests); hier ist nur Verdrahtung (G15).
// ─────────────────────────────────────────────────────────────────────────────
import { app } from 'electron';
import { hostname, networkInterfaces } from 'node:os';
import { eigeneAdressen, istDieserRechner, type MasterLinkClient } from '@jm/master-link';
import type { Logger } from './index';
import { VerbundFolger } from './verbund-daten';
import { registriereVerbundIpc } from './verbund-ipc';
import { erzeugeStandSpeicher, standDatei } from './verbund-speicher';
import type { FolgeHandler, VerbundDaten, VerbundKopplung } from './verbund-typen';

let folger: VerbundFolger | null = null;
let wartenderHandler: FolgeHandler | null = null;
let ersetztVorDemStart = false;

/** Nur intern (index.ts, startMasterLink): hängt den Folger an den Client, direkt nach client.starte() — erst dann kennt kopplung() die master-link.json; sonst sähe ein früh registriertes Tool beim Start kurz „entkoppelt“ (16.3). Wirft nie. */
export function verbundAnClient(client: MasterLinkClient, o: { userData: string; log: Logger }): void {
  if (folger) return;
  try {
    const log = (stufe: 'info' | 'warn', t: string): void => o.log[stufe](t);
    const f = new VerbundFolger({
      client,
      speicher: erzeugeStandSpeicher(standDatei(o.userData), log),
      log,
      darfSchreiben: app.hasSingleInstanceLock(),
    });
    folger = f;
    registriereVerbundIpc(f);
    if (ersetztVorDemStart) f.ersetzt();
    f.starte();
    if (wartenderHandler) f.folge(wartenderHandler);
  } catch (err) {
    const code = (err as { code?: unknown } | null)?.code;
    o.log.warn(`Verbund: nicht gestartet (${typeof code === 'string' ? code : 'unbekannt'}).`);
  }
}

/** Das Tool folgt der Show des Masters (16.2). Erst aufrufen, wenn das Tool bereit ist (E17). */
export function folgeMasterShow(h: FolgeHandler): void {
  wartenderHandler = h;
  folger?.folge(h);
}

export function verbundDaten(): VerbundDaten {
  return folger?.daten() ?? { art: 'einzelplatz' };
}

/** Grundlage für „RELOAD ignoriert“ und „Show-Deep-Link liefert nur Dokumente“ (16.1). */
export function imVerbundmodus(): boolean {
  return folger?.imVerbundmodus() ?? false;
}

/** Das Tool hat eine eigene Show angewendet: Zwischenspeicher löschen, `frueher` beenden (16.1, E16). */
export function verbundDatenErsetzt(): void {
  if (folger) folger.ersetzt();
  else ersetztVorDemStart = true;
}

/** Für die Wahl des Launchers im Rundown (17.4). null ohne lesbare master-link.json. */
export function verbundKopplung(): VerbundKopplung | null {
  return folger?.kopplung() ?? null;
}

/** Logzeilen aus 16.1, höchstens einmal je Minute und Weg (E19). */
export function verbundIgnoriert(weg: 'reload' | 'deeplink', pfad?: string): void {
  folger?.ignoriert(weg, pfad);
}

/** Läuft `host` auf diesem Rechner? (Loopback, eigene Karte, eigener Hostname; Regeln E7.) */
export function istHostDieserRechner(host: string): boolean {
  let adressen: string[] = [];
  try {
    adressen = eigeneAdressen(networkInterfaces());
  } catch {
    /* ohne Kartenliste zählen nur Loopback und der eigene Name */
  }
  return istDieserRechner(host, adressen, hostname());
}
```

- [ ] **Step 7: Die drei Einfügungen in `src/index.ts` (G2)**

Mit dem Edit-Werkzeug, jede Ersetzung für sich; keine andere Zeile ändern.

(a) Export-Block. Vorher (`packages/app-runtime/src/index.ts`, genau einmal):
```ts
export type { CspConfig } from './csp';
```

Nachher:
```ts
export type { CspConfig } from './csp';
// Master-Link Teil 2b, Release 2 (Spec 16): Tools folgen der Show des Masters. Alles Neue liegt in verbund*.ts.
export {
  folgeMasterShow,
  verbundDaten,
  imVerbundmodus,
  verbundDatenErsetzt,
  verbundKopplung,
  verbundIgnoriert,
  istHostDieserRechner,
} from './verbund';
export { nichtAngewendet } from './verbund-daten';
export { kuerzeName } from '@jm/master-link';
export type { MasterStand, VerbundDaten, VerbundKopplung, VerbundAnzeige, FolgeHandler } from './verbund-typen';
```
(`kuerzeName` säubert und kürzt einen Namen für eine Logzeile; der Rundown braucht es für seine Zeile zum Show-Link im Verbundmodus, C18, N15. Er hat `@jm/master-link` nicht als eigene Abhängigkeit.)

(b) Import. Vorher (`packages/app-runtime/src/index.ts`, genau einmal):
```ts
import { MasterLinkClient, masterLinkPfad, verbundWert, type ClientZustand } from '@jm/master-link';
```

Nachher:
```ts
import { MasterLinkClient, masterLinkPfad, verbundWert, type ClientZustand } from '@jm/master-link';
import { verbundAnClient } from './verbund';
```

(c) Aufruf in `startMasterLink`, direkt nach `client.starte();` (ZF2). Vorher (`packages/app-runtime/src/index.ts`, genau einmal):
```ts
      client.starte();
```

Nachher:
```ts
      client.starte();
      verbundAnClient(client, { userData: app.getPath('userData'), log: info.log });
```

Prüfen, dass nur eingefügt wurde:
```bash
git diff --stat packages/app-runtime/src/index.ts
git diff packages/app-runtime/src/index.ts | grep -c '^-[^-]'
```
Erwartet: `1 file changed, 15 insertions(+)` und `0`.

- [ ] **Step 8: Selbsttest und Typecheck**

```bash
npm run selftest -w @jm/app-runtime
npm run typecheck --workspaces --if-present
```
Erwartet: Selbsttest unverändert `50 passed, 0 failed` und `208 passed, 0 failed` (kein Test lädt `verbund.ts`); Typecheck Exit-Code 0 ohne `error TS` (1–3 min). Ab jetzt prüfen alle 25 Apps, die `@jm/app-runtime` importieren, die neuen Module mit.

Der erste Teil enthält zwei Quelltext-Wächter aus Zoom 4b, die `src/index.ts` lesen: „initAppRuntime plant das Aufräumen nach dem Logger, nur mit dem Lock, der Bericht geht ins Log“ und „… und index.ts räumt nirgends sofort auf (kein raeumeLogsAuf, kein eigener Takt)“. Beide bleiben mit den drei Einfügungen grün (gemessen am 12.10.2026, N29): Der erste liest nur den Text ab `export function initAppRuntime(`, und alle drei Einfügungen stehen davor; keine enthält `raeumeLogsAuf(` oder `LOG_AUFRAEUMEN_TAKT_MS`.

- [ ] **Step 9: Gegenprobe Typecheck (nicht committen)**

In `packages/app-runtime/src/verbund.ts` vorübergehend `return folger?.daten() ?? { art: 'einzelplatz' };` durch `return folger?.daten() ?? { art: 'einzelplatzX' };` ersetzen, dann:
```bash
npm run typecheck -w @jm/timer
```
Erwartet: Exit-Code ungleich 0 mit
```
../../packages/app-runtime/src/verbund.ts(53,3): error TS2322: Type '{ art: "einzelplatzX"; }' is not assignable to type 'VerbundDaten'.
```
Zurückbauen; `npm run typecheck -w @jm/timer` danach Exit-Code 0.

- [ ] **Step 10: Bündel prüfen (G15)**

```bash
npm run build -w @jm/sync
grep -c "jmps:verbund-anzeige" apps/sync/out/main/index.cjs
grep -c 'require("@jm/' apps/sync/out/main/index.cjs
```
Erwartet: Build grün (etwa 2–3 s), dann `1` und `0`. Sync führt `@jm/show` nicht als Abhängigkeit; der Lauf zeigt, dass `@jm/show` und `@jm/master-link` über `@jm/app-runtime` mitgebündelt werden. `apps/sync/out` ist von Git ignoriert (vorher mit `git check-ignore apps/sync/out/main/index.cjs` prüfen; Ausgabe des Pfads = ignoriert).

- [ ] **Step 11: Gegenprobe Zwischenspeicher (nicht committen)**

Je eine Änderung in `packages/app-runtime/src/verbund-speicher.ts`, `npx tsx packages/app-runtime/test/verbund.test.ts`, zurückbauen:

| Änderung (Vorher → Nachher) | erwartete `FAIL`-Zeilen |
| --- | --- |
| `const NOCHMAL = new Set(['EPERM', 'EBUSY', 'EACCES']);` → `const NOCHMAL = new Set(['EPERM', 'EACCES']);` | 3, darunter „C13 EBUSY viermal, dann ok → true nach fünf Versuchen“ |
| die Zeile `if (roh.fassung !== FASSUNG) return 'fassung';` entfernen | 1: „C13 fassung 2 → null, eine Warnung (fassung)“ |
| `const PAUSE_MS = 50;` → `const PAUSE_MS = 0;` | 1: „C13 Abstand zwischen den Versuchen 50 ms (vier Pausen ≥ 190 ms)“ |
| `if (!istObj(s.show)) return 'show';` → `if (Array.isArray(s.show)) return 'show';` | 1: „C13 show fehlt → null, eine Warnung (show)“ |

Danach wieder `208 passed, 0 failed`.

- [ ] **Step 12: Commit**

```bash
git add packages/app-runtime/src/index.ts packages/app-runtime/src/verbund-ipc.ts packages/app-runtime/src/verbund-speicher.ts packages/app-runtime/src/verbund.ts packages/app-runtime/test/verbund.test.ts
git status --short
```
Erwartet genau:
```
M  packages/app-runtime/src/index.ts
A  packages/app-runtime/src/verbund-ipc.ts
A  packages/app-runtime/src/verbund-speicher.ts
A  packages/app-runtime/src/verbund.ts
M  packages/app-runtime/test/verbund.test.ts
```
Dann:
```bash
git commit -m "feat(app-runtime): Zwischenspeicher, Verbund-API und IPC der Tool-Seite (Teil 2b R2)" -m "master-stand.json unter <userData>/verbund mit fassung 1: asynchron, Zwischendatei und Umbenennen, bis zu 5 Versuche im Abstand von 50 ms bei EPERM/EBUSY/EACCES (nicht schreibeAtomar, das synchron bis 2 s wartet, E18); Lesen tolerant mit einer Warnung ohne Dateiinhalt. verbund.ts haengt den VerbundFolger an den Client aus startMasterLink (nur mit Sperre, G14) und fuehrt folgeMasterShow, verbundDaten, imVerbundmodus, verbundDatenErsetzt, verbundKopplung, verbundIgnoriert, istHostDieserRechner. verbund-ipc.ts: jmps:verbund-anzeige. index.ts nur drei Einfuegungen (Zoom Stage 4b), dazu oeffentlich nichtAngewendet (V12 mit Code) und kuerzeName (Logzeile des Rundowns)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst (C13):**
- **Zusätzliche Exporte:** `standDatei(userData)` in `verbund-speicher.ts` (der Pfad aus 16.3 an einer Stelle; der Test prüft ihn), `VERBUND_ANZEIGE_KANAL` und `registriereVerbundIpc(quelle)` in `verbund-ipc.ts` (S-C nannte nur den Kanal). Nach außen (über `index.ts`) geht keiner davon.
- **`nichtAngewendet` im Export-Block (a)** (N3): eine Zeile mehr, also 14 statt 13 eingefügte Zeilen. Die Tools werfen damit, wenn sie einen Stand nicht anwenden können; V12 zeigt den Code.
- **`kuerzeName` im Export-Block (a)** (N15): noch eine Zeile, also 15 eingefügte Zeilen, `index.ts` danach 675 von 675 Zeilen mit CRLF (auf `5f8ed15ef8` waren es 663, N29). Der Rundown säubert damit den Dateinamen in seiner Logzeile zum Show-Link (C18); er hat `@jm/master-link` nicht als eigene Abhängigkeit, und eine neue Abhängigkeit hätte `package.json`, Lockfile und Bündel-Liste des Rundowns berührt (E15). Ein einzeln benannter Export, kein `export *` (E27). Seit dem Neuaufsatz setzen die Einfügungen direkt auf die 4b-Fassung von `index.ts` auf (660 → 675 Zeilen, gemessen am 12.10.2026, N29); die Zusammenführung vom 08.10.2026 mit `85dcba597d` (`git merge-file`, N20) hatte dasselbe Ergebnis vorhergesagt.
- **Neustart-Prüfung wartet auf die Datei** (N12): statt einer festen Pause von 50 ms höchstens 5 s, bis `master-stand.json` da ist. Unter Last (CI) war die feste Pause zu knapp.
- **Der Test zu `verbundIgnoriert`** steht in C12 (die Drossel liegt im reinen Folger, siehe dort).
- **Gemerkt vor dem Client-Start:** `folgeMasterShow` merkt den Handler immer; `verbundDatenErsetzt` vor dem Start setzt einen Merker, der beim Start `ersetzt()` ruft, bevor der Zwischenspeicher gelesen wird. So verliert ein früher Aufruf nichts (E17).
- **`darfSchreiben`** kommt aus `app.hasSingleInstanceLock()`; ohne Sperre entsteht schon gar kein Client (`index.ts:379`), der Wert sichert G14 doppelt ab.
- **`index.ts` exportiert `verbundAnzeige` nicht.** Die Tools lesen die Zeile über IPC; ihr Renderer bindet `@jm/app-runtime` nicht ein (E28). Die Kette C19 importiert `verbund-anzeige.ts` per Relativpfad.
- **`verbundAnClient` wirft nie** (alles in `try`/`catch`, eine Warnung „Verbund: nicht gestartet (⟨Code⟩).“). Sonst bräche die Ausnahme in `startMasterLink` auch den Master-Link-Client ab („Master-Link nicht gestartet“).
- **Neue Logzeile ohne Spec-Vorgabe** (E13, Owner-Freigabe): „Verbund: Zwischenspeicher nicht geschrieben (⟨Code⟩).“ (warn) und „Verbund: nicht gestartet (⟨Code⟩).“ (warn). Die Zeile zum nicht lesbaren Zwischenspeicher ist wörtlich E13; ⟨Grund⟩ ist ein Feldname, „kein gültiges JSON“, „kein Objekt“ oder ein Fehlercode.

---

### Task 14: C14 · Timer: Show anwenden als reine Funktion, dem Master folgen, RELOAD und Deep-Link im Verbundmodus, Pille neben „Sync“

**Spec:** 16.1 (Verbundmodus: Deep-Link liefert nur Dokumente, RELOAD ignoriert, beide Logzeilen gedrosselt; `verbundDatenErsetzt()` nach eigener Show), 16.5 (IPC, Preload, Platz „Pille neben Sync“), 17.1 (Tabelle), 19.5 (Timer). Entscheidungen E14, E16, E17, E28.

**Arbeitsverzeichnis:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b-r2`, Branch `feat/master-link-teil2b-r2`. Alle Pfade relativ dazu. Voraussetzung: C13 ist committet (`@jm/app-runtime` exportiert S-C, `jmps:verbund-anzeige` ist registriert).

**Dateien:**
- Create: `apps/timer/src/shared/show-anwenden.ts` (35 Zeilen)
- Create: `apps/timer/src/shared/verbund.ts` (9 Zeilen, E28)
- Modify: `apps/timer/src/main/index.ts`: `:13-18` (Importe), `:297-298` (Kommentar), `:309-371` (`applyShowFromDeepLink`, `applyShowFromPath`, `reloadCurrentShow`), `:404-406` (`whenReady`: Registrierung nach `loadState()`)
- Modify: `apps/timer/src/preload/index.ts:1-2`, `:44-45`
- Modify: `apps/timer/src/renderer/src/sync/jm.d.ts:1-2`, `:27-28`
- Modify: `apps/timer/src/renderer/src/components/Topbar.tsx:4`, `:57-58`, `:90`
- Modify: `apps/timer/tsconfig.node.json`, `apps/timer/tsconfig.web.json` (je eine Zeile nach `"allowSyntheticDefaultImports": true,`)
- Test: `apps/timer/test/selftest.ts`: `:15` (Import), neuer Block vor `console.log(\`\n${pass} passed, ${fail} failed\`);` am Dateiende

**Interfaces:**
- Consumes (C13, S-C, exakt):
  ```ts
  // '@jm/app-runtime'
  export function folgeMasterShow(h: FolgeHandler): void;
  export function imVerbundmodus(): boolean;
  export function verbundDatenErsetzt(): void;
  export function verbundIgnoriert(weg: 'reload' | 'deeplink', pfad?: string): void;
  export interface FolgeHandler { anwenden(stand: MasterStand & { show: Show }, neueShow: boolean): void; beiWechsel?(d: VerbundDaten): void }
  // IPC 'jmps:verbund-anzeige' → VerbundAnzeige | null; Push gleichen Namens bei jedem Wechsel
  ```
  Bestehend: `reduce`, `Command`, `aktiverPunktVerschwunden` (`src/shared/timer-state.ts`), `ablaufToTimetable`, `parseTimetable` (`src/shared/show-ablauf.ts`), `hatEigeneTimerListe` (`@jm/show`).
- Produces (S-D, exakt):
  ```ts
  // apps/timer/src/shared/show-anwenden.ts
  export type TimerAktion = Extract<Command, { type: 'tt:setAll' | 'tt:replaceItems' | 'setDuration' }>;
  export function timerAktionenAusShow(show: Show, mode: 'initial' | 'reload', eigeneListe: boolean): TimerAktion[];
  // apps/timer/src/shared/verbund.ts (E28)
  export interface VerbundAnzeigeZeile { text: string; farbe: 'gruen' | 'gelb' | 'rot' | 'gedaempft' }
  // Preload window.jm (C20 liest darüber per CDP, Port 9336)
  verbundAnzeige(): Promise<VerbundAnzeigeZeile | null>;
  onVerbundAnzeige(cb: (a: VerbundAnzeigeZeile | null) => void): () => void;
  ```

**Regeln:** G5 (Texte nur aus app-runtime, der Timer erfindet keine), G7 (`src/shared` importiert aus `@jm/show` und `./timer-state` nur Typen; Laufzeitimport von `./show-ablauf.ts` mit Endung), G11, G12, G14, G15, G16.

**Verhalten (Spec 17.1, verbindlich):**
- `timerAktionenAusShow` liefert genau, was `applyShowFromPath` heute ausführt: mit Punkten `tt:setAll` (Modus `initial`) bzw. `tt:replaceItems` (Modus `reload`); nur im Modus `initial` danach `setDuration`, wenn `settings.durationMs` eine Zahl ≥ 0 ist. Punkte kommen aus der eigenen Timer-Liste, wenn `eigeneListe`, sonst aus dem Ablauf. Ohne Punkte kein Punkte-Befehl.
- Verbundweg: `anwenden(stand, neueShow)` → Modus `initial` bei `neueShow`, sonst `reload`. Ein Zwischenspeicher kommt mit `neueShow = false` (C12) und wird damit `reload` (Tabelle 17.1 „Start mit Zwischenspeicher“). `keine-show`/`zu-gross`/`nicht-lesbar` erreichen `anwenden` nie (S-C). `frueher` braucht im Timer nichts (17.1).
- `anwenden` wirft, wenn `dispatch` wirft; app-runtime zeigt dann V12 und versucht es erneut (16.2). Der Datei-Weg fängt den Fehler wie bisher und loggt.
- Im Verbundmodus: Show-Deep-Link → nur `verbundIgnoriert('deeplink', pfad)` (der Timer hat keine Dokumente); `TIMER RELOAD` → `verbundIgnoriert('reload')`, Rückgabe `false`.
- Außerhalb: nach jeder angewendeten eigenen Show (Deep-Link, RELOAD) `verbundDatenErsetzt()` (E16).
- `currentShowPath` bleibt beim Anwenden eines Master-Stands unberührt. Endet der Verbund (`frueher`), liest ein RELOAD die zuletzt eigene Show wie in 2a (16.1 „wirken wieder wie in 2a“).
- Registrierung direkt nach `loadState()` (E17). Der Deep-Link beim Start (`runtime.initialDeepLink`, Ist `:430`) läuft danach und sieht damit `imVerbundmodus()` nach dem Zwischenspeicher.

---

- [ ] **Step 1: Fehlschlagende Tests schreiben** (`apps/timer/test/selftest.ts`)

Ersetzung 1 (Zeile 15), Vorher:
```ts
import { ablaufToTimetable, parseTimetable } from '../src/shared/show-ablauf.ts';
```
Nachher:
```ts
import { ablaufToTimetable, parseTimetable } from '../src/shared/show-ablauf.ts';
import { timerAktionenAusShow, type TimerAktion } from '../src/shared/show-anwenden.ts';
```

Ersetzung 2 (Dateiende, Zeilen 245–246), Vorher:
```ts
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```
Nachher:
```ts
// ── Teil 2b R2 · Show anwenden ohne Electron (Spec 17.1, 19.5 Timer) ───────
// Dieselbe reine Funktion für die gelesene Show-Datei und für einen Stand vom Master.
// Geprüft über reduce (wie der Main die Aktionen mit dispatch ausführt).
{
  const ablauf3 = [
    { id: 'u1', label: 'Begrüßung', durationMs: 5 * MIN },
    { id: 'u2', label: 'Panel', durationMs: 10 * MIN },
    { id: 'u3', label: 'Q&A', durationMs: 5 * MIN },
  ];
  /** Show mit Ablauf und Timer-Eintrag; settings nur mit den übergebenen Feldern. */
  const showMit = (settings: Record<string, unknown>, ablauf: unknown[] = ablauf3) => ({
    ...createShow('Gala'),
    tools: [{ appId: 'jm-timer', settings }],
    ablauf: normalizeAblauf(ablauf),
  });
  const eigene = (s: { tools: { appId: string; settings?: Record<string, unknown> }[] }): boolean =>
    hatEigeneTimerListe(s.tools.find((t) => t.appId === 'jm-timer')?.settings);
  const typen = (a: TimerAktion[]): string => a.map((x) => x.type).join(',');
  const fuehreAus = (s: SyncedState, aktionen: TimerAktion[]): SyncedState => aktionen.reduce((z, a) => reduce(z, a, 2_000_000), s);

  // neueShow → 'initial': tt:setAll und settings.durationMs, wie beim Öffnen einer Show.
  const gala = showMit({ durationMs: 20 * MIN });
  const initial = timerAktionenAusShow(gala, 'initial', eigene(gala));
  ck('R2 17.1 initial: tt:setAll, danach setDuration', typen(initial) === 'tt:setAll,setDuration');
  ck(
    'R2 17.1 initial: Punkte aus dem Ablauf mit Kennung',
    initial[0]?.type === 'tt:setAll' && JSON.stringify(initial[0].items.map((i) => i.id)) === '["u1","u2","u3"]',
  );
  ck('R2 17.1 initial: setDuration mit settings.durationMs', initial[1]?.type === 'setDuration' && initial[1].ms === 20 * MIN);
  const nachInitial = fuehreAus(zustand([item('alt', 5)], 0), initial);
  ck(
    'R2 17.1 initial über reduce: neuer Ablauf, Countdown 20 min steht, nichts aktiv',
    kennungen(nachInitial) === '["u1","u2","u3"]' &&
      nachInitial.countdown.durationMs === 20 * MIN &&
      nachInitial.countdown.startedAtMs === null &&
      nachInitial.timetable.activeIndex === null,
  );

  // gleiche Show, neuer Stand → 'reload': tt:replaceItems, der Countdown bleibt.
  const reload = timerAktionenAusShow(gala, 'reload', eigene(gala));
  ck('R2 17.1 reload: nur tt:replaceItems, kein setDuration', typen(reload) === 'tt:replaceItems');
  const vorher = zustand([item('u1', 5), item('u2', 10), item('u3', 5)], 1);
  const mitEinschub = showMit({ durationMs: 20 * MIN }, [ablauf3[0], { id: 'neu', label: 'Einschub', durationMs: 3 * MIN }, ablauf3[1], ablauf3[2]]);
  const nachReload = fuehreAus(vorher, timerAktionenAusShow(mitEinschub, 'reload', eigene(mitEinschub)));
  ck('R2 17.1 reload über reduce: laufender Countdown bleibt unangetastet', nachReload.countdown === vorher.countdown);
  ck(
    'R2 17.1 reload über reduce: aktiver Punkt folgt seiner Kennung',
    nachReload.timetable.activeIndex === 2 && nachReload.timetable.items[2].id === 'u2',
  );

  // Eigene Timer-Liste hat Vorrang vor dem Ablauf (Teil 2a, Spec 6.1).
  const eigen = showMit({ timetable: [{ label: 'Eigen A', durationMs: MIN }, { label: 'Eigen B', durationMs: 2 * MIN }] });
  const ausListe = timerAktionenAusShow(eigen, 'initial', eigene(eigen));
  ck(
    'R2 17.1 eigene Timer-Liste hat Vorrang vor dem Ablauf',
    ausListe.length === 1 && ausListe[0].type === 'tt:setAll' && JSON.stringify(ausListe[0].items.map((i) => i.label)) === '["Eigen A","Eigen B"]',
  );
  ck(
    'R2 17.1 eigene Timer-Liste: Punkte ohne Kennung (wie parseTimetable)',
    ausListe[0]?.type === 'tt:setAll' && ausListe[0].items.every((i) => !('id' in i)),
  );

  // Ohne Ablauf und ohne Liste: keine Aktion; nur die Countdown-Vorgabe beim Öffnen.
  const leer = { ...createShow('Leer'), tools: [{ appId: 'jm-timer', settings: {} }] };
  ck('R2 17.1 ohne Ablauf und ohne Liste, reload → keine Aktion', timerAktionenAusShow(leer, 'reload', false).length === 0);
  ck('R2 17.1 ohne Ablauf und ohne Liste, initial ohne durationMs → keine Aktion', timerAktionenAusShow(leer, 'initial', false).length === 0);
  ck('R2 17.1 Show ohne Timer-Eintrag und ohne Ablauf → keine Aktion', timerAktionenAusShow(createShow('Ohne'), 'initial', false).length === 0);
  const nurDauer = { ...createShow('Dauer'), tools: [{ appId: 'jm-timer', settings: { durationMs: 7 * MIN } }] };
  ck('R2 17.1 initial ohne Ablauf, mit durationMs → nur setDuration', typen(timerAktionenAusShow(nurDauer, 'initial', false)) === 'setDuration');

  // durationMs nur als Zahl ≥ 0 (wie bisher in applyShowFromPath).
  ck('R2 17.1 durationMs negativ → kein setDuration', typen(timerAktionenAusShow(showMit({ durationMs: -1 }), 'initial', false)) === 'tt:setAll');
  ck('R2 17.1 durationMs als Text → kein setDuration', typen(timerAktionenAusShow(showMit({ durationMs: '600000' }), 'initial', false)) === 'tt:setAll');
  ck('R2 17.1 durationMs NaN → kein setDuration', typen(timerAktionenAusShow(showMit({ durationMs: Number.NaN }), 'initial', false)) === 'tt:setAll');
  const null0 = timerAktionenAusShow(showMit({ durationMs: 0 }), 'initial', false);
  ck('R2 17.1 durationMs 0 → setDuration 0', null0[1]?.type === 'setDuration' && null0[1].ms === 0);

  // Rein: die Show bleibt unverändert.
  const vorJson = JSON.stringify(gala);
  timerAktionenAusShow(gala, 'initial', false);
  timerAktionenAusShow(gala, 'reload', false);
  ck('R2 17.1 die Show bleibt unverändert', JSON.stringify(gala) === vorJson);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```
`zustand`, `item`, `kennungen`, `MIN`, `createShow`, `normalizeAblauf`, `hatEigeneTimerListe`, `reduce`, `SyncedState` sind im Selbsttest schon vorhanden (Importe `:3-16`, Modulebene `:33-35`, `:120-123`).

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/timer
```
Erwartet: Abbruch vor dem ersten `ck`, Exitcode 1:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\timer\src\shared\show-anwenden.ts' imported from …\apps\timer\test\selftest.ts
```

- [ ] **Step 3: `apps/timer/src/shared/show-anwenden.ts` anlegen** (neue Datei, Write-Werkzeug)

```ts
/**
 * Show → Timer-Aktionen (Master-Link Teil 2b, Release 2, Spec 17.1). Liest nichts und führt nichts
 * aus: Der Main ruft die Funktion für eine gelesene Show-Datei (`applyShowFromPath`) und für einen
 * Stand vom Master (`folgeMasterShow`) und führt die Aktionen mit `dispatch` aus.
 *
 * Regel (G7): aus `@jm/show` und `./timer-state` NUR Typen. Der Laufzeitimport von `./show-ablauf.ts`
 * trägt die Endung, damit der Selbsttest (`node --experimental-strip-types`) ihn ohne Pfad-Hilfe
 * auflöst (beide Timer-tsconfigs: `allowImportingTsExtensions`). Ob die Show eine eigene Timer-Liste
 * trägt, rechnet der Aufrufer mit `hatEigeneTimerListe` aus `@jm/show` (dritter Parameter).
 */
import type { Show } from '@jm/show';
import type { Command } from './timer-state';
import { ablaufToTimetable, parseTimetable } from './show-ablauf.ts';

/** Die Befehle, die eine Show im Timer auslöst (Spec 17.1). */
export type TimerAktion = Extract<Command, { type: 'tt:setAll' | 'tt:replaceItems' | 'setDuration' }>;

/**
 * `mode`:
 *  - `'initial'` (Show öffnen, neue Show vom Master): `tt:setAll` — ersetzt den Ablauf und setzt den
 *    Countdown zurück; dazu `setDuration` aus `settings.durationMs` (Zahl ≥ 0).
 *  - `'reload'` (RELOAD, neuer Stand derselben Show, Start mit Zwischenspeicher): `tt:replaceItems` —
 *    tauscht nur die Punkte, ein laufender Countdown bleibt, der aktive Punkt folgt seiner Kennung.
 * `eigeneListe`: Die Show trägt eine eigene Timer-Liste (`hatEigeneTimerListe`); sie hat Vorrang vor
 * dem Ablauf. Ohne Ablauf und ohne Liste kommt kein Punkte-Befehl.
 */
export function timerAktionenAusShow(show: Show, mode: 'initial' | 'reload', eigeneListe: boolean): TimerAktion[] {
  const settings = show.tools.find((t) => t.appId === 'jm-timer')?.settings;
  const items = eigeneListe ? parseTimetable(settings?.timetable) : ablaufToTimetable(show.ablauf);
  const aktionen: TimerAktion[] = [];
  if (items) aktionen.push(mode === 'reload' ? { type: 'tt:replaceItems', items } : { type: 'tt:setAll', items });
  const dauer = settings?.durationMs;
  if (mode === 'initial' && typeof dauer === 'number' && dauer >= 0) aktionen.push({ type: 'setDuration', ms: dauer });
  return aktionen;
}
```

- [ ] **Step 4: Test laufen lassen (grün)**

```
npm run selftest -w @jm/timer
```
Erwartet, Exitcode 0, als letzte Zeilen:
```
  ok  R2 17.1 initial: tt:setAll, danach setDuration
  ok  R2 17.1 initial: Punkte aus dem Ablauf mit Kennung
  ok  R2 17.1 initial: setDuration mit settings.durationMs
  ok  R2 17.1 initial über reduce: neuer Ablauf, Countdown 20 min steht, nichts aktiv
  ok  R2 17.1 reload: nur tt:replaceItems, kein setDuration
  ok  R2 17.1 reload über reduce: laufender Countdown bleibt unangetastet
  ok  R2 17.1 reload über reduce: aktiver Punkt folgt seiner Kennung
  ok  R2 17.1 eigene Timer-Liste hat Vorrang vor dem Ablauf
  ok  R2 17.1 eigene Timer-Liste: Punkte ohne Kennung (wie parseTimetable)
  ok  R2 17.1 ohne Ablauf und ohne Liste, reload → keine Aktion
  ok  R2 17.1 ohne Ablauf und ohne Liste, initial ohne durationMs → keine Aktion
  ok  R2 17.1 Show ohne Timer-Eintrag und ohne Ablauf → keine Aktion
  ok  R2 17.1 initial ohne Ablauf, mit durationMs → nur setDuration
  ok  R2 17.1 durationMs negativ → kein setDuration
  ok  R2 17.1 durationMs als Text → kein setDuration
  ok  R2 17.1 durationMs NaN → kein setDuration
  ok  R2 17.1 durationMs 0 → setDuration 0
  ok  R2 17.1 die Show bleibt unverändert

59 passed, 0 failed
```
(41 vorher + 18 neu.)

- [ ] **Step 5: Typecheck zeigt die `.ts`-Endung (Gegenprobe zu E14)**

```
npm run typecheck -w @jm/timer
```
Erwartet: Exitcode ≠ 0, genau diese Meldung:
```
src/shared/show-anwenden.ts(13,51): error TS5097: An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled.
```

- [ ] **Step 6: `allowImportingTsExtensions` in beiden Timer-tsconfigs** (E14, Präzedenz `apps/connect`, `apps/interpreter`, `apps/switcher`; beide haben schon `"noEmit": true`)

`apps/timer/tsconfig.node.json`, Vorher:
```json
    "allowSyntheticDefaultImports": true,
    "paths": {
```
Nachher:
```json
    "allowSyntheticDefaultImports": true,
    "allowImportingTsExtensions": true,
    "paths": {
```
`apps/timer/tsconfig.web.json` (der Vorher-Text kommt dort ebenfalls genau einmal vor; `src/shared/**` liegt in beiden Konfigurationen), Vorher:
```json
    "allowSyntheticDefaultImports": true,
    "paths": {
```
Nachher:
```json
    "allowSyntheticDefaultImports": true,
    "allowImportingTsExtensions": true,
    "paths": {
```

```
npm run typecheck -w @jm/timer
```
Erwartet: keine Meldung von `tsc`, Exitcode 0.

- [ ] **Step 7: Brücken-Typ `apps/timer/src/shared/verbund.ts` anlegen** (neue Datei, E28)

```ts
/**
 * Verbund-Anzeige über die Preload-Brücke (Master-Link Teil 2b, Release 2, Spec 16.4/16.5).
 * Strukturgleich mit `VerbundAnzeige` aus `@jm/app-runtime`; eigener Typ, damit die Renderer-
 * Typprüfung (tsconfig.web.json) app-runtime mit seinen Electron-Typen nicht einliest (E28).
 */
export interface VerbundAnzeigeZeile {
  text: string;
  farbe: 'gruen' | 'gelb' | 'rot' | 'gedaempft';
}
```

- [ ] **Step 8: Main verdrahten** (`apps/timer/src/main/index.ts`, Edit-Werkzeug, CRLF bleibt)

Ersetzung 1 (Zeilen 13–18), Vorher:
```ts
import { initAppRuntime, getLog } from '@jm/app-runtime';
import { advertise, type Advertiser } from '@jm/discovery';
import { readControlConfig, mdnsSignKey } from '@jm/control-config';
import { hatEigeneTimerListe, parseShow, parseShowDeepLink } from '@jm/show';
import { aktiverPunktVerschwunden } from '@shared/timer-state';
import { ablaufToTimetable, parseTimetable } from '@shared/show-ablauf';
```
Nachher:
```ts
import {
  initAppRuntime,
  getLog,
  folgeMasterShow,
  imVerbundmodus,
  verbundDatenErsetzt,
  verbundIgnoriert,
} from '@jm/app-runtime';
import { advertise, type Advertiser } from '@jm/discovery';
import { readControlConfig, mdnsSignKey } from '@jm/control-config';
import { hatEigeneTimerListe, parseShow, parseShowDeepLink, type Show } from '@jm/show';
import { aktiverPunktVerschwunden } from '@shared/timer-state';
import { timerAktionenAusShow } from '@shared/show-anwenden';
```

Ersetzung 2 (Zeilen 297–298), Vorher:
```ts
// parseTimetable/ablaufToTimetable liegen seit Teil 2a in @shared/show-ablauf (ohne Electron,
// testbar im Selbsttest); ablaufToTimetable gibt dort die Kennung der Ablaufpunkte mit.
```
Nachher:
```ts
// parseTimetable/ablaufToTimetable liegen seit Teil 2a in @shared/show-ablauf (ohne Electron,
// testbar im Selbsttest); ablaufToTimetable gibt dort die Kennung der Ablaufpunkte mit.
// Seit Teil 2b R2 baut @shared/show-anwenden daraus die Befehle (timerAktionenAusShow, Spec 17.1).
```

Ersetzung 3 (Zeilen 309–360, von `function applyShowFromDeepLink` bis zur ersten Zeile im Rumpf von `reloadCurrentShow`), Vorher:
```ts
function applyShowFromDeepLink(url: string): void {
  const showPath = parseShowDeepLink(url);
  if (!showPath) return;
  applyShowFromPath(showPath, 'initial');
}

/**
 * Ablauf aus einer .jmshow anwenden. `mode`:
 *  - 'initial' (Erst-Öffnen): `tt:setAll` — ersetzt Ablauf + setzt Countdown zurück.
 *  - 'reload' (Live-Update, z. B. nach iveo-Poll): `tt:replaceItems` — tauscht nur
 *    die Items, lässt einen laufenden Countdown UNANGETASTET.
 * Merkt sich den Show-Pfad, damit `reloadCurrentShow()` später neu einlesen kann.
 */
function applyShowFromPath(showPath: string, mode: 'initial' | 'reload'): void {
  try {
    const show = parseShow(readFileSync(showPath, 'utf8'));
    const settings = show.tools.find((t) => t.appId === 'jm-timer')?.settings;
    // Eigene Timer-Liste hat Vorrang vor dem Show-Ablauf. Die Prüfung kommt aus @jm/show,
    // damit Timer und Rundown dieselbe Liste meinen (Teil 2a, Spec 6.1/6.2).
    const items = hatEigeneTimerListe(settings)
      ? parseTimetable(settings?.timetable)
      : ablaufToTimetable(show.ablauf);
    if (items) {
      const vorher = getState().timetable;
      const nachher = dispatch({ type: mode === 'reload' ? 'tt:replaceItems' : 'tt:setAll', items }).timetable;
      // Der aktive Punkt folgt seiner Kennung; fehlt sie im neuen Ablauf, hält der Timer
      // die Nummer — das soll im Log stehen, statt still zu passieren.
      if (mode === 'reload' && aktiverPunktVerschwunden(vorher, nachher, items)) {
        getLog().info('Aktiver Punkt im neuen Ablauf nicht mehr vorhanden, Nummer gehalten');
      }
    }
    // Countdown-Vorgabe nur beim Erst-Öffnen anwenden (nicht bei Live-Reload).
    if (
      mode === 'initial' &&
      settings &&
      typeof settings.durationMs === 'number' &&
      settings.durationMs >= 0
    ) {
      dispatch({ type: 'setDuration', ms: settings.durationMs });
    }
    currentShowPath = showPath;
  } catch (err) {
    getLog().error(`Show-Einstellungen konnten nicht geladen werden: ${(err as Error).message}`);
  }
}

/**
 * Aktuelle Show neu einlesen (z. B. wenn der Launcher nach einem iveo-Update ein
 * `TIMER RELOAD` schickt). No-op, wenn keine Show geladen ist. Nicht-destruktiv.
 */
export function reloadCurrentShow(): boolean {
  if (!currentShowPath) {
```
Nachher:
```ts
function applyShowFromDeepLink(url: string): void {
  const showPath = parseShowDeepLink(url);
  if (!showPath) return;
  // Im Verbundmodus kommen Ablauf und Settings nur vom Master (Spec 16.1); der Timer hat
  // keine Dokumente, also bleibt vom Deep-Link nichts übrig (gedrosselte Logzeile).
  if (imVerbundmodus()) {
    verbundIgnoriert('deeplink', showPath);
    return;
  }
  applyShowFromPath(showPath, 'initial');
}

/**
 * Show anwenden (Spec 17.1): dieselbe reine Funktion für eine gelesene Datei und für einen
 * Stand vom Master. `mode`:
 *  - 'initial' (Erst-Öffnen, neue Show vom Master): `tt:setAll` — ersetzt Ablauf + setzt Countdown zurück.
 *  - 'reload' (Live-Update, gleiche Show, Start mit Zwischenspeicher): `tt:replaceItems` — tauscht
 *    nur die Items, lässt einen laufenden Countdown UNANGETASTET.
 * Wirft, wenn `dispatch` wirft; der Aufrufer entscheidet, was das heißt (Datei: Logzeile,
 * Verbund: app-runtime zeigt V12 und versucht es erneut).
 */
function wendeTimerShowAn(show: Show, mode: 'initial' | 'reload'): void {
  const settings = show.tools.find((t) => t.appId === 'jm-timer')?.settings;
  // Eigene Timer-Liste hat Vorrang vor dem Show-Ablauf. Die Prüfung kommt aus @jm/show,
  // damit Timer und Rundown dieselbe Liste meinen (Teil 2a, Spec 6.1/6.2).
  for (const aktion of timerAktionenAusShow(show, mode, hatEigeneTimerListe(settings))) {
    const vorher = getState().timetable;
    const nachher = dispatch(aktion).timetable;
    // Der aktive Punkt folgt seiner Kennung; fehlt sie im neuen Ablauf, hält der Timer
    // die Nummer — das soll im Log stehen, statt still zu passieren.
    if (aktion.type === 'tt:replaceItems' && aktiverPunktVerschwunden(vorher, nachher, aktion.items)) {
      getLog().info('Aktiver Punkt im neuen Ablauf nicht mehr vorhanden, Nummer gehalten');
    }
  }
}

/**
 * Ablauf aus einer .jmshow anwenden (Modus wie `wendeTimerShowAn`). Merkt sich den Show-Pfad,
 * damit `reloadCurrentShow()` später neu einlesen kann. Eine eigene Show ersetzt die Daten
 * eines früheren Masters (Spec 16.1): `verbundDatenErsetzt()` löscht den Zwischenspeicher.
 */
function applyShowFromPath(showPath: string, mode: 'initial' | 'reload'): void {
  try {
    wendeTimerShowAn(parseShow(readFileSync(showPath, 'utf8')), mode);
    currentShowPath = showPath;
    verbundDatenErsetzt();
  } catch (err) {
    getLog().error(`Show-Einstellungen konnten nicht geladen werden: ${(err as Error).message}`);
  }
}

/**
 * Aktuelle Show neu einlesen (z. B. wenn der Launcher nach einem iveo-Update ein
 * `TIMER RELOAD` schickt). No-op, wenn keine Show geladen ist. Nicht-destruktiv.
 * Im Verbundmodus ignoriert (Spec 16.1): die Show-Daten kommen vom Master.
 */
export function reloadCurrentShow(): boolean {
  if (imVerbundmodus()) {
    verbundIgnoriert('reload');
    return false;
  }
  if (!currentShowPath) {
```

Ersetzung 4 (Zeilen 404–406), Vorher:
```ts
  app.whenReady().then(async () => {
    loadState();
    loadAuth();
```
Nachher:
```ts
  app.whenReady().then(async () => {
    loadState();
    // Verbund (Spec 16.1, 17.1): erst nach loadState registrieren (E17). Ein Zwischenspeicher wird
    // dabei angewendet ('reload'), ein Stand mit anderer Show wie „Show öffnen“ ('initial'). Wirft
    // dispatch, zeigt app-runtime V12 und versucht es erneut.
    folgeMasterShow({
      anwenden: (stand, neueShow) => wendeTimerShowAn(stand.show, neueShow ? 'initial' : 'reload'),
    });
    loadAuth();
```
Ein `dispatch` vor `startServer()` ist unkritisch: `dispatch` speichert den Zustand und benachrichtigt Zuhörer; der Socket-Server meldet sich erst in `startServer()` an und sendet seinen Clients dann den aktuellen Zustand.

- [ ] **Step 9: Preload und Renderer-Typ** (E28)

`apps/timer/src/preload/index.ts`, Ersetzung 1 (Zeilen 1–2), Vorher:
```ts
import { contextBridge, ipcRenderer } from 'electron';
import { PRELOAD_SERVER_URL } from '@shared/net';
```
Nachher:
```ts
import { contextBridge, ipcRenderer } from 'electron';
import { PRELOAD_SERVER_URL } from '@shared/net';
import type { VerbundAnzeigeZeile } from '@shared/verbund';
```
Ersetzung 2 (Zeilen 44–45), Vorher:
```ts
  closeWindow: () => ipcRenderer.invoke('window:close') as Promise<void>,
};
```
Nachher:
```ts
  closeWindow: () => ipcRenderer.invoke('window:close') as Promise<void>,
  /** Verbund-Anzeige (Master-Link Teil 2b, Spec 16.4/16.5): V-Zeile oder null (Einzelplatz). */
  verbundAnzeige: () => (ipcRenderer.invoke('jmps:verbund-anzeige') as Promise<VerbundAnzeigeZeile | null>).catch(() => null),
  onVerbundAnzeige: (cb: (a: VerbundAnzeigeZeile | null) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, a: VerbundAnzeigeZeile | null) => cb(a);
    ipcRenderer.on('jmps:verbund-anzeige', listener);
    return () => {
      ipcRenderer.off('jmps:verbund-anzeige', listener);
    };
  },
};
```

`apps/timer/src/renderer/src/sync/jm.d.ts`, Ersetzung 1 (Zeilen 1–2), Vorher:
```ts
declare global {
  interface Window {
```
Nachher:
```ts
import type { VerbundAnzeigeZeile } from '@shared/verbund';

declare global {
  interface Window {
```
Ersetzung 2 (Zeilen 27–28), Vorher:
```ts
      closeWindow: () => Promise<void>;
    };
```
Nachher:
```ts
      closeWindow: () => Promise<void>;
      /** Verbund-Anzeige (Master-Link Teil 2b, Spec 16.4/16.5): V-Zeile oder null (Einzelplatz). */
      verbundAnzeige: () => Promise<VerbundAnzeigeZeile | null>;
      onVerbundAnzeige: (cb: (a: VerbundAnzeigeZeile | null) => void) => () => void;
    };
```
(Die Datei hatte schon `export {};` am Ende; mit dem `import type` bleibt sie ein Modul.)

- [ ] **Step 10: Pille neben „Sync“** (`apps/timer/src/renderer/src/components/Topbar.tsx`, Spec 16.5)

Ersetzung 1 (Zeile 4), Vorher:
```tsx
import { cn, dragRegion, noDragRegion, isElectronMac } from '@jm/ui';
```
Nachher:
```tsx
import { cn, dragRegion, noDragRegion, isElectronMac } from '@jm/ui';
import type { VerbundAnzeigeZeile } from '@shared/verbund';
```
Ersetzung 2 (Zeilen 57–58), Vorher:
```tsx
      <div className="flex items-center gap-2" style={noDragRegion}>
        <SyncPill connected={connected} />
```
Nachher:
```tsx
      <div className="flex items-center gap-2" style={noDragRegion}>
        <VerbundPille />
        <SyncPill connected={connected} />
```
Ersetzung 3 (Zeile 90), Vorher:
```tsx
function SyncPill({ connected }: { connected: boolean }) {
```
Nachher:
```tsx
const VERBUND_FARBE: Record<VerbundAnzeigeZeile['farbe'], string> = {
  gruen: 'border-[var(--success)]/50 text-[var(--success)]',
  gelb: 'border-[var(--warning)]/60 text-[var(--warning)]',
  rot: 'border-[var(--destructive)]/60 text-[var(--destructive)]',
  gedaempft: 'border-[var(--border)] text-[var(--muted-foreground)]',
};

/**
 * Verbund-Anzeige neben „Sync“ (Master-Link Teil 2b, Spec 16.4/16.5): die V-Zeile aus app-runtime,
 * gekürzt mit „…“, voller Text als Tooltip. Am Einzelplatz (null) nichts.
 */
function VerbundPille() {
  const [anzeige, setAnzeige] = useState<VerbundAnzeigeZeile | null>(null);
  useEffect(() => {
    const jm = window.jm;
    if (!jm?.verbundAnzeige) return;
    void jm.verbundAnzeige().then(setAnzeige);
    return jm.onVerbundAnzeige(setAnzeige);
  }, []);
  if (!anzeige) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[var(--radius-sm)] px-2 h-6 max-w-[22rem]',
        'text-[11px] font-semibold border',
        VERBUND_FARBE[anzeige.farbe],
      )}
      title={anzeige.text}
    >
      <span className="truncate">{anzeige.text}</span>
    </span>
  );
}

function SyncPill({ connected }: { connected: boolean }) {
```
`--success`, `--warning`, `--destructive`, `--muted-foreground` kommen aus `packages/ui/src/tokens/colors.css` (hell und dunkel). Grün ist `--success`, nicht `--primary` (das ist Markengelb). Die Fernansicht im Browser (Handy) hat kein `window.jm`; dort bleibt die Pille weg.

- [ ] **Step 11: Selbsttest, Typecheck, Build, Importe**

```
npm run selftest -w @jm/timer
npm run typecheck -w @jm/timer
npm run build -w @jm/timer
grep -c "jmps:verbund-anzeige" apps/timer/out/preload/index.cjs
grep -n "^import" apps/timer/src/shared/show-anwenden.ts apps/timer/src/shared/verbund.ts
```
Erwartet: `59 passed, 0 failed`; Typecheck ohne Meldung, Exitcode 0; `electron-vite build` dreimal `✓ built in …`, Exitcode 0; in der Preload-Ausgabe `3` (invoke, on, off); die Importe genau:
```
apps/timer/src/shared/show-anwenden.ts:11:import type { Show } from '@jm/show';
apps/timer/src/shared/show-anwenden.ts:12:import type { Command } from './timer-state';
apps/timer/src/shared/show-anwenden.ts:13:import { ablaufToTimetable, parseTimetable } from './show-ablauf.ts';
```
(`out/` ist in `apps/timer/.gitignore`.)

- [ ] **Step 12: Commit** (Git Bash, Commit-Text ohne Umlaute)

```
git add apps/timer/src/shared/show-anwenden.ts apps/timer/src/shared/verbund.ts apps/timer/src/main/index.ts apps/timer/src/preload/index.ts apps/timer/src/renderer/src/sync/jm.d.ts apps/timer/src/renderer/src/components/Topbar.tsx apps/timer/tsconfig.node.json apps/timer/tsconfig.web.json apps/timer/test/selftest.ts
git status --short
```
Erwartet genau (dazu ggf. „LF will be replaced by CRLF“ für die neuen Dateien, harmlos):
```
M  apps/timer/src/main/index.ts
M  apps/timer/src/preload/index.ts
M  apps/timer/src/renderer/src/components/Topbar.tsx
M  apps/timer/src/renderer/src/sync/jm.d.ts
A  apps/timer/src/shared/show-anwenden.ts
A  apps/timer/src/shared/verbund.ts
M  apps/timer/test/selftest.ts
M  apps/timer/tsconfig.node.json
M  apps/timer/tsconfig.web.json
```
Dann:
```
git commit -m "feat(timer): Show anwenden als reine Funktion, dem Master folgen (Teil 2b R2, C14)" -m "timerAktionenAusShow liefert tt:setAll bzw. tt:replaceItems und setDuration statt sie auszufuehren; Datei und Stand vom Master nutzen denselben Weg. folgeMasterShow nach loadState: neue Show initial, gleiche Show und Zwischenspeicher reload. Im Verbundmodus werden RELOAD und Show-Deep-Link ignoriert (gedrosselte Logzeile aus app-runtime), nach eigener Show verbundDatenErsetzt. Preload verbundAnzeige/onVerbundAnzeige, Pille neben Sync. Beide tsconfigs: allowImportingTsExtensions." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Keine bei Namen und Signaturen. `wendeTimerShowAn(show, mode)` ist ein neuer privater Helfer im Main (nicht exportiert); er trägt den Dispatch-Teil, den Datei- und Verbundweg teilen.
- **`currentShowPath`** bleibt beim Anwenden eines Master-Stands unverändert. Nach dem Ende des Verbunds (`frueher`) liest ein RELOAD wieder die zuletzt geöffnete eigene Show (wie 2a). Die Spec sagt nur „wirken wieder wie in 2a“.
- `App.tsx`/`Operator.tsx` brauchen keine Änderung: die Pille sitzt in der Topbar, die nur die Bedienoberfläche zeigt.

**Nachgerechnet** (beim Durchspielen des ganzen Plans, mit C11–C13 aus diesem Plan): Step 2 rot wie angegeben, Step 4 `59 passed, 0 failed`, Step 5 genau die TS5097-Meldung, danach Typecheck node und web grün, `electron-vite build` grün, Preload-Zählung 3. Gegenprobe (vom Schreiber gemessen) mit je einem absichtlichen Fehler in `show-anwenden.ts`, alle gefangen:

| Fehler | `FAIL`-Zeilen |
| --- | --- |
| `setDuration` auch bei `reload` | 3 |
| eigene Timer-Liste übergangen | 2 |
| `initial` mit `tt:replaceItems` | 7 |
| `durationMs` 0 verworfen (`> 0`) | 1 |
| `durationMs` ungeprüft übernommen | 3 |

---

### Task 15: C15 · Titler rein: Datenquelle `master`, gemerkte Show in Master-Form, Ordnerwahl gesperrt (O1), Q4

**Spec:** 7.6/7.7 (Bestand), 16.5 (Q4 „Quelle: Show vom Master „⟨S⟩““), 17.2 (Tabelle, Master-Form der gemerkten Show, Text zur gesperrten Ordnerwahl), 27 O1 („Nein, gesperrt“), 19.5 (Titler). Entscheidung E21; Vormerkungen 14 (H4 im Master-Weg, Wortlaut bleibt, FA19) und 16 (`gleicheShow`/`showPfad` im Pfad-Weg bleibt, FA21).

**Arbeitsverzeichnis:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b-r2`, Branch `feat/master-link-teil2b-r2`. Voraussetzung: C14 ist committet (fachlich unabhängig).

**Dateien:**
- Modify: `apps/titler/src/shared/datenquelle.ts`: `:6-30` (Kopf, Typen), `:39-46` (`QuellEreignis`), `:68-73` (`startZustand`), `:95-142` (`quellSchritt`), `:153` (`tsvNichtGeschrieben`), `:163-164` (`logNachMerken`), `:219-220` (`quellZeile`), `:229-233` (Dateiende: `ordnerWahlGesperrt`, `ordnerPatchAbgelehnt`, `verbundEndetFuer`)
- Modify: `apps/titler/src/main/show-quelle.ts`: `:18` (Import), `:26-36` (`leseGemerkteShow`), `:47-48` (`schreibeGemerkteShow`)
- Modify (nur Typ-Brücke, verhaltensgleich): `apps/titler/src/main/index.ts`: `:31-45` (Import aus `@shared/datenquelle`), `:142-144` (neuer Helfer nach `userDataDir`), `:230`, `:240`, `:299-307`
- Test: `apps/titler/test/selftest.ts`: Import `:7-21`, alte Literale `:633-634`, `:674`, `:689`, neuer Block nach dem datenquelle-Block (vor `// ── B12 · show-quelle.ts`), neuer Block nach dem B12-Block (vor `// ── B13 · datalink.ts`)

**Interfaces:**
- Consumes: bestehend `Hinweis`, `hinweisText` (`src/shared/datalink-kern.ts`), `Show`, `ShowIveoSpeaker` (`@jm/show`, nur Typen). `datenquelle.ts` importiert **nichts** aus `@jm/app-runtime`; das Ereignis `masterStand` trägt einfache Felder (`src/shared` liegt auch im Web-Typecheck).
- Produces (S-D, exakt; C16 baut darauf):
  ```ts
  export type DatenQuelleArt = 'show' | 'ordner' | 'frueher' | 'master';
  export interface GemerkteShowPfad { showPfad: string; showName: string; mitSpeakern: boolean }   // heutiges GemerkteShow
  export interface GemerkteShowMaster { quelle: 'master'; masterId: string; schluessel: string | null; showName: string }
  export type GemerkteShow = GemerkteShowPfad | GemerkteShowMaster;
  export function istMasterForm(g: GemerkteShow | null): g is GemerkteShowMaster;   // zusätzlich
  export interface QuellZustand {
    art: DatenQuelleArt; showPfad: string | null; showName: string | null; quellHinweis: Hinweis | null;
    master: { masterId: string; masterName: string; schluessel: string | null } | null;
  }
  export type QuellEreignis =
    | { t: 'gelesen'; weg: QuellWeg; pfad: string; show: Show; gleicheShow: boolean }
    | { t: 'nichtLesbar'; weg: QuellWeg; pfad: string; grund: string; gemerkt: GemerkteShowPfad | null; mitEigenemOrdner: boolean }
    | { t: 'ordnerGewaehlt' } | { t: 'zurueckZumOrdner' }
    | { t: 'masterStand'; masterId: string; masterName: string; schluessel: string | null; show: Show }
    | { t: 'verbundEnde' };
  export function startZustand(gemerkt: GemerkteShow | null, frueher: boolean, gekoppelterMaster: string | null = null): QuellZustand;
  export function ordnerWahlGesperrt(z: QuellZustand): string | null;
  export function ordnerPatchAbgelehnt(neu: string | undefined, vorher: string, z: QuellZustand): string | null;   // zusätzlich (N17): Sperre E22 für einen Config-Patch
  export function verbundEndetFuer(z: QuellZustand, lage: string): boolean;   // zusätzlich (N8): Ende des Verbunds für Quelle master
  // quellZeile: Q4 „Quelle: Show vom Master „⟨S⟩““ bei art 'master'
  // show-quelle.ts: leseGemerkteShow(userData): GemerkteShow | null; schreibeGemerkteShow(userData, wert: GemerkteShow): boolean
  ```

**Regeln:** G5 (Q4 und der Sperrtext wörtlich), G6 (keine Werte aus dem Netz in Logzeilen), G7 (Titler-`src/shared` ohne Laufzeitimporte, nichts aus app-runtime), G11, G12, G16.

**Verhalten (Spec 17.2, verbindlich):**
- **`masterStand` mit Speakern** → Art `master` (wie `show`, liest `iveo-data`), `showPfad` `null`, `showName` = Name der Show, `master` = `{ masterId, masterName, schluessel }`, `tsv` = Speaker, `quellHinweis` H7 bei `speakerVeraltetSeit`, sonst `null`. Gemerkt wird `{ quelle: 'master', masterId, schluessel, showName }`, aber nur, wenn sich etwas ändert: Bei gleicher Show, Art schon `master` und gleichem Namen `merke: bleibt`. Keine Logzeile, keine Vorlage.
- **Gleiche Show** heißt: `z.master` hat dieselbe `masterId` und denselben, nicht leeren `schluessel` (E21). `null` ist nie dieselbe Show.
- **Gleiche Show ohne Speaker** → Art und Liste bleiben, bei Art `master` H7 bzw. H3, sonst kein Hinweis; `merke: bleibt`.
- **Neue Show ohne Speaker** → Art `ordner`, beobachtet den eigenen Ordner, `master` = diese Show (damit ein späterer Stand derselben Show als „gleich“ gilt), `merke: loeschen` (ein Neustart fände sonst die Liste der vorigen Show als Quelle `master`).
- **`verbundEnde`** → nur Art `master` wird `frueher` (Q3), `quellHinweis` `null`, TSV und gemerkte Show bleiben. Andere Arten bleiben unverändert (Ordner, eigene Show).
- **`startZustand` mit Master-Form**: an denselben Master gekoppelt (`gekoppelterMaster === masterId`) → `master`, die TSV gilt; sonst `frueher`. `masterName` ist `''` (die Datei kennt ihn nicht; C16 setzt ihn aus der Kopplung, der erste Stand bringt ihn sicher). Pfad-Form wie bisher.
- **`nichtLesbar`** über Deep-Link/RELOAD setzt H4 jetzt bei Art `show` **und** `master` (der Master-Weg nutzt bei einer nicht schreibbaren TSV `tsvNichtGeschrieben`, Vormerkung 14).
- `ordnerGewaehlt`/`zurueckZumOrdner` setzen `master` auf `null`.
- `ordnerWahlGesperrt(z)`: bei Art `master` der Text aus 17.2 mit `masterName`, sonst `null` (auch bei `ordner` im Verbund: die Show am Master hat dann keine Speaker, die Wahl ist frei).
- `ordnerPatchAbgelehnt(neu, vorher, z)` (E22, N17): die Sperre im Main für `titler:setConfig`. Abgelehnt (Text aus 17.2) nur, wenn der Patch einen `dataFolder` trägt, der sich vom bisherigen unterscheidet, und `ordnerWahlGesperrt(z)` einen Text liefert; sonst `null`. Der Rest des Patches gilt in jedem Fall (C16).
- `verbundEndetFuer(z, lage)` (N8): `true` genau bei Art `master` und einer Lage ohne Master (`frueher`, `einzelplatz`, `datei-defekt`); C16 ruft damit `verbundEnde`. `einzelplatz` und `datei-defekt` kommen, wenn nichts angewendet ist — etwa nach einem Start mit gemerkter Master-Form ohne lesbaren Zwischenspeicher.
- `quellZeile`: Art `master` → Q4 mit dem vollen Showname (die Zeile kürzt die Oberfläche per CSS, `OperatorView.tsx:456`).
- `zurueckKnopf`: K1 nur bei Art `show` (unverändert) — bei `master` also `null`.
- `logNachMerken`: „Show gemerkt: ⟨Pfad⟩“ (7.9) gibt es nur für die Pfad-Form.

---

- [ ] **Step 1: Fehlschlagende Tests schreiben** (`apps/titler/test/selftest.ts`)

Ersetzung 1 (Import, Zeilen 12–21), Vorher:
```ts
  logNachMerken,
  quellSchritt,
  quellZeile,
  startZustand,
  tsvNichtGeschrieben,
  uebergang,
  zurueckKnopf,
  type GemerkteShow,
  type QuellZustand,
} from '../src/shared/datenquelle';
```
Nachher:
```ts
  logNachMerken,
  ordnerPatchAbgelehnt,
  ordnerWahlGesperrt,
  quellSchritt,
  quellZeile,
  startZustand,
  tsvNichtGeschrieben,
  uebergang,
  verbundEndetFuer,
  zurueckKnopf,
  type GemerkteShow,
  type GemerkteShowMaster,
  type QuellZustand,
} from '../src/shared/datenquelle';
```

Ersetzung 2 (alte Literale bekommen das neue Pflichtfeld; Zeilen 633–636, nach Ersetzung 1 die Zeilen 637–640), Vorher:
```ts
  const zShow: QuellZustand = { art: 'show', showPfad: P1, showName: 'Tag 1', quellHinweis: null };
  const zOrdner: QuellZustand = { art: 'ordner', showPfad: null, showName: null, quellHinweis: null };
  const zFrueher = startZustand(null, true);
  const alle = [['show', zShow], ['ordner', zOrdner], ['frueher', zFrueher]] as const;
```
Nachher:
```ts
  const zShow: QuellZustand = { art: 'show', showPfad: P1, showName: 'Tag 1', quellHinweis: null, master: null };
  const zOrdner: QuellZustand = { art: 'ordner', showPfad: null, showName: null, quellHinweis: null, master: null };
  const zFrueher = startZustand(null, true);
  const alle = [['show', zShow], ['ordner', zOrdner], ['frueher', zFrueher]] as const;
```

Ersetzung 3 (Zeile 674, nach Ersetzung 1 Zeile 678), Vorher:
```ts
    const zA: QuellZustand = { art: 'show', showPfad: P1, showName: 'Tag 1', quellHinweis: null };
```
Nachher:
```ts
    const zA: QuellZustand = { art: 'show', showPfad: P1, showName: 'Tag 1', quellHinweis: null, master: null };
```

Ersetzung 4 (Zeile 689, nach Ersetzung 1 Zeile 693; der einzige alte Vergleich über die ganze JSON-Form des Zustands), Vorher:
```ts
  ok(JSON.stringify(startShow) === JSON.stringify({ art: 'show', showPfad: P1, showName: 'Tag 1', quellHinweis: null }), 'startZustand: gemerkte Show mit Speakern → show');
```
Nachher:
```ts
  ok(JSON.stringify(startShow) === JSON.stringify({ art: 'show', showPfad: P1, showName: 'Tag 1', quellHinweis: null, master: null }), 'startZustand: gemerkte Show mit Speakern → show');
```

Ersetzung 5 (Ende des datenquelle-Blocks, vor `// ── B12 · show-quelle.ts`), Vorher:
```ts
  ok(JSON.stringify(logNachMerken(nl6, false)) === JSON.stringify(nl6.log), 'Befund 4: … ohne Schreiben der gemerkten Show bleiben die Logzeilen');
}
```
Nachher:
```ts
  ok(JSON.stringify(logNachMerken(nl6, false)) === JSON.stringify(nl6.log), 'Befund 4: … ohne Schreiben der gemerkten Show bleiben die Logzeilen');
}

// ── R2 · datenquelle: Show vom Master (Spec 17.2, 27 O1, 16.5 Q4; 19.5 Titler) ──
{
  const M1 = 'master-1';
  const S1 = '0123456789abcdef';
  const S2 = 'fedcba9876543210';
  function showMit(name: string, speakers: ShowIveoSpeaker[], speakerVeraltetSeit?: string): Show {
    const iveo: NonNullable<Show['iveo']> = { event: 'cop31' };
    if (speakers.length) iveo.speakers = speakers;
    if (speakerVeraltetSeit) iveo.speakerVeraltetSeit = speakerVeraltetSeit;
    return { ...createShow(name), iveo };
  }
  /** Ereignis „Stand vom Master angewendet“ (der Main reicht die Felder aus dem MasterStand durch). */
  const stand = (show: Show, schluessel: string | null = S1, masterId = M1) =>
    ({ t: 'masterStand', masterId, masterName: 'Regie A', schluessel, show }) as const;
  const zOrdner: QuellZustand = { art: 'ordner', showPfad: null, showName: null, quellHinweis: null, master: null };
  const zShow: QuellZustand = { art: 'show', showPfad: 'C:\\Shows\\Tag1.jmshow', showName: 'Tag 1', quellHinweis: null, master: null };
  const zFrueher = startZustand(null, true);
  const mit = showMit('Gala', [ADA, ALAN]);

  // Stand mit Speakern → master (wie show, Ordner iveo-data), TSV mit @kennung, gemerkt in Master-Form.
  for (const [art, z] of [['ordner', zOrdner], ['show', zShow], ['frueher', zFrueher]] as const) {
    const s = quellSchritt(z, stand(mit));
    ok(
      s.zustand.art === 'master' && s.zustand.showPfad === null && s.zustand.showName === 'Gala' && s.beobachte === 'iveo-data',
      `R2 17.2: Stand mit Speakern, von ${art} → master, liest iveo-data`,
    );
    ok(s.tsv?.length === 2 && s.tsv[1].id === 's-3', `R2 17.2: … von ${art} TSV mit den Speakern (Kennung reist mit)`);
    ok(
      JSON.stringify(s.merke) === JSON.stringify({ t: 'schreiben', wert: { quelle: 'master', masterId: M1, schluessel: S1, showName: 'Gala' } }),
      `R2 17.2: … von ${art} gemerkt in Master-Form`,
    );
    ok(
      JSON.stringify(s.zustand.master) === JSON.stringify({ masterId: M1, masterName: 'Regie A', schluessel: S1 }) && !s.vorlage && s.log.length === 0,
      `R2 17.2: … von ${art} Master im Zustand, keine Vorlage, keine Logzeile`,
    );
  }
  const zMaster = quellSchritt(zOrdner, stand(mit)).zustand;

  // Gleiche Show (masterId + schluessel), neuer Stand mit Speakern → TSV neu, gemerkte Show bleibt.
  const nochmal = quellSchritt(zMaster, stand(showMit('Gala', [ADA])));
  ok(nochmal.zustand.art === 'master' && nochmal.tsv?.length === 1 && nochmal.merke.t === 'bleibt', 'R2 17.2: gleiche Show, neuer Stand mit Speakern → TSV neu, gemerkte Show bleibt');
  const umbenannt = quellSchritt(zMaster, stand(showMit('Gala 2026', [ADA])));
  ok(umbenannt.merke.t === 'schreiben' && umbenannt.zustand.showName === 'Gala 2026', 'R2 17.2: gleiche Show mit neuem Namen → gemerkte Show neu geschrieben');

  // Gleiche Show, keine Speaker → Liste bleibt, H3 (H7 bei Merker).
  const ohne = quellSchritt(zMaster, stand(showMit('Gala', [])));
  ok(ohne.zustand.art === 'master' && ohne.tsv === null && ohne.merke.t === 'bleibt' && ohne.beobachte === 'iveo-data', 'R2 17.2: gleiche Show, keine Speaker → Liste bleibt');
  ok(JSON.stringify(ohne.zustand.quellHinweis) === '{"art":"H3"}', 'R2 17.2: … Hinweis H3');
  const merker = new Date(2026, 9, 8, 10, 15).toISOString();
  ok(quellSchritt(zMaster, stand(showMit('Gala', [], merker))).zustand.quellHinweis?.art === 'H7', 'R2 17.2: gleiche Show ohne Speaker, mit Merker → H7 statt H3');
  const mitMerker = quellSchritt(zOrdner, stand(showMit('Gala', [ADA], merker)));
  ok(JSON.stringify(mitMerker.zustand.quellHinweis) === JSON.stringify({ art: 'H7', seit: merker }), 'R2 17.2: Stand mit Speakern und Merker speakerVeraltetSeit → H7 (der Merker reist mit)');
  ok(quellSchritt(ohne.zustand, stand(mit)).zustand.quellHinweis === null, 'R2 17.2: der nächste Stand mit Speakern nimmt H3 weg');

  // Neue Show, keine Speaker → ordner (anderer Schlüssel oder anderer Master).
  const neueOhne = [
    ['anderer Schlüssel', stand(showMit('Tag 2', []), S2)],
    ['anderer Master', stand(showMit('Gala', []), S1, 'master-2')],
  ] as const;
  for (const [bez, e] of neueOhne) {
    const s = quellSchritt(zMaster, e);
    ok(s.zustand.art === 'ordner' && s.beobachte === 'eigener' && s.tsv === null && s.zustand.quellHinweis === null, `R2 17.2: neue Show ohne Speaker (${bez}) → ordner`);
    ok(s.merke.t === 'loeschen', `R2 17.2: … (${bez}) gemerkte Show gelöscht, ein Neustart zeigt nicht die alte Liste`);
  }
  ok(quellSchritt(zMaster, stand(showMit('Gala', []), null)).zustand.art === 'ordner', 'R2 17.2: Schlüssel null gilt nie als gleiche Show');
  const zNull = quellSchritt(zOrdner, stand(mit, null)).zustand;
  ok(quellSchritt(zNull, stand(showMit('Gala', []), null)).zustand.art === 'ordner', 'R2 17.2: … auch nicht null gegen null');
  const zOrdnerImVerbund = quellSchritt(zMaster, stand(showMit('Tag 2', []), S2)).zustand;
  ok(zOrdnerImVerbund.master?.schluessel === S2, 'R2 17.2: Quelle ordner merkt sich die Show vom Master');
  const ordnerGleich = quellSchritt(zOrdnerImVerbund, stand(showMit('Tag 2', []), S2));
  ok(
    ordnerGleich.zustand.art === 'ordner' && ordnerGleich.zustand.quellHinweis === null && ordnerGleich.beobachte === 'eigener' && ordnerGleich.merke.t === 'bleibt',
    'R2 17.2: Quelle ordner, gleiche Show weiter ohne Speaker → ordner, kein Hinweis',
  );
  const wieder = quellSchritt(zOrdnerImVerbund, stand(showMit('Tag 2', [HEDY]), S2));
  ok(wieder.zustand.art === 'master' && wieder.tsv?.[0].name === 'Hedy' && wieder.beobachte === 'iveo-data', 'R2 17.2: Quelle ordner, danach Stand mit Speakern → master');

  // Ende des Verbundmodus → frueher (Q3), die TSV bleibt; andere Quellen bleiben, wie sie sind.
  const ende = quellSchritt(zMaster, { t: 'verbundEnde' });
  ok(ende.zustand.art === 'frueher' && ende.tsv === null && ende.beobachte === 'iveo-data' && ende.merke.t === 'bleibt', 'R2 17.2: verbundEnde → frueher, TSV bleibt, gemerkte Show bleibt');
  ok(quellZeile(ende.zustand, '', 2) === 'Quelle: Speaker aus einer früheren Show', 'R2 17.2: … Q3');
  for (const [art, z] of [['ordner', zOrdnerImVerbund], ['show', zShow], ['frueher', zFrueher]] as const) {
    const s = quellSchritt(z, { t: 'verbundEnde' });
    ok(
      JSON.stringify(s.zustand) === JSON.stringify(z) && s.tsv === null && s.merke.t === 'bleibt' && s.beobachte === (art === 'ordner' ? 'eigener' : 'iveo-data'),
      `R2 17.2: verbundEnde bei ${art} → unverändert`,
    );
  }
  // Danach ersetzt ein Deep-Link einer eigenen Show die Daten wie in 7.7.
  const eigenePfad = 'C:\\Shows\\Eigen.jmshow';
  const eigen = quellSchritt(ende.zustand, { t: 'gelesen', weg: 'deepLink', pfad: eigenePfad, show: showMit('Eigen', [GRACE]), gleicheShow: false });
  ok(
    eigen.zustand.art === 'show' && eigen.zustand.master === null && eigen.tsv?.[0].name === 'Grace' && eigen.merke.t === 'schreiben' && eigen.vorlage,
    'R2 17.2: nach dem Ende ersetzt ein Deep-Link einer eigenen Show die Daten (7.7)',
  );
  const eigenOhne = quellSchritt(ende.zustand, { t: 'gelesen', weg: 'deepLink', pfad: eigenePfad, show: showMit('Eigen', []), gleicheShow: false });
  ok(eigenOhne.zustand.art === 'ordner' && eigenOhne.zustand.master === null, 'R2 17.2: … ohne Speaker → ordner (7.7)');

  // Start mit show-zuletzt.json in Master-Form.
  const gm: GemerkteShowMaster = { quelle: 'master', masterId: M1, schluessel: S1, showName: 'Gala' };
  const startGleich = startZustand(gm, false, M1);
  ok(
    startGleich.art === 'master' && startGleich.showName === 'Gala' && startGleich.showPfad === null && startGleich.master?.masterId === M1 && startGleich.master.schluessel === S1,
    'R2 17.2: Start, quelle master, gleicher Master gekoppelt → master, die TSV gilt',
  );
  ok(startZustand(gm, false, null).art === 'frueher', 'R2 17.2: Start, quelle master, ungekoppelt → frueher (Q3)');
  ok(startZustand(gm, false, 'master-2').art === 'frueher', 'R2 17.2: Start, quelle master, an einen anderen Master gekoppelt → frueher');
  const ausSpeicher = quellSchritt(startGleich, stand(mit));
  ok(ausSpeicher.zustand.art === 'master' && ausSpeicher.merke.t === 'bleibt', 'R2 17.2: Start, danach Zwischenspeicher derselben Show → master, gemerkte Show bleibt');
  ok(ausSpeicher.zustand.master?.masterName === 'Regie A', 'R2 17.2: … der Stand bringt den Namen des Masters');
  const gp: GemerkteShow = { showPfad: 'C:\\Shows\\Tag1.jmshow', showName: 'Tag 1', mitSpeakern: true };
  ok(startZustand(gp, false, M1).art === 'show' && startZustand(gp, false, M1).master === null, 'R2: Start mit Pfad-Form wie in 7.7, auch wenn gekoppelt');

  // Ende des Verbunds für Quelle master (16.1): jede Lage ohne Master — frueher, einzelplatz, datei-defekt.
  for (const lage of ['frueher', 'einzelplatz', 'datei-defekt']) {
    ok(verbundEndetFuer(zMaster, lage), `R2 16.1: Lage ${lage} beendet den Verbund für Quelle master`);
  }
  ok(
    !['warte', 'ohne-daten', 'aktuell', 'getrennt'].some((lage) => verbundEndetFuer(zMaster, lage)),
    'R2 16.1: laufender Verbund (warte, ohne-daten, aktuell, getrennt) → master bleibt',
  );
  ok(!verbundEndetFuer(zOrdnerImVerbund, 'einzelplatz') && !verbundEndetFuer(zShow, 'frueher') && !verbundEndetFuer(zFrueher, 'einzelplatz'), 'R2 16.1: andere Quellen → kein verbundEnde');
  // Start mit Master-Form, nichts angewendet (Zwischenspeicher fehlt oder kaputt), dann entkoppelt → einzelplatz.
  const endeOhneStand = quellSchritt(startGleich, { t: 'verbundEnde' });
  ok(
    verbundEndetFuer(startGleich, 'einzelplatz') && endeOhneStand.zustand.art === 'frueher' && ordnerWahlGesperrt(endeOhneStand.zustand) === null,
    'R2 16.1: Start mit Master-Form ohne angewendeten Stand, dann entkoppelt → frueher, Ordnerwahl wieder frei',
  );

  // Ordnerwahl gesperrt (O1, Text 17.2 wörtlich), Q4 wörtlich, kein K1.
  ok(
    ordnerWahlGesperrt(zMaster) === 'Im Verbund kommen die Speaker vom Master „Regie A“. Ein eigener Ordner gilt, solange die Show dort keine Speaker hat.',
    'R2 O1: Ordnerwahl bei Quelle master gesperrt, Text 17.2 wörtlich',
  );
  ok(
    ordnerWahlGesperrt(zOrdnerImVerbund) === null && ordnerWahlGesperrt(zShow) === null && ordnerWahlGesperrt(zFrueher) === null && ordnerWahlGesperrt(zOrdner) === null,
    'R2 O1: bei ordner (auch im Verbund), show und frueher frei',
  );
  // Sperre im Main für einen Config-Patch (E22): abgelehnt wird nur ein geänderter dataFolder bei Quelle master.
  const sperrText = ordnerWahlGesperrt(zMaster);
  ok(sperrText !== null && ordnerPatchAbgelehnt('D:\\Eigen', '', zMaster) === sperrText, 'R2 E22: Config-Patch mit neuem dataFolder bei Quelle master → abgelehnt, Text 17.2');
  ok(
    ordnerPatchAbgelehnt(undefined, 'D:\\Alt', zMaster) === null && ordnerPatchAbgelehnt('D:\\Alt', 'D:\\Alt', zMaster) === null,
    'R2 E22: … ohne dataFolder oder mit unverändertem → nicht abgelehnt, der Rest des Patches gilt',
  );
  ok(
    ordnerPatchAbgelehnt('D:\\Eigen', '', zOrdnerImVerbund) === null && ordnerPatchAbgelehnt('', 'D:\\Alt', zShow) === null,
    'R2 E22: bei ordner (auch im Verbund) und show nicht abgelehnt',
  );
  ok(quellZeile(zMaster, 'D:\\Bauchbinden', 2) === 'Quelle: Show vom Master „Gala“', 'R2 Q4 wörtlich');
  ok(zurueckKnopf(zMaster, 'D:\\Bauchbinden') === null, 'R2: kein Knopf K1 bei Quelle master');

  // TSV nicht schreibbar im Master-Weg: Quelle und Liste bleiben, H4 im Wortlaut aus R1 (FA19).
  const zuSchreiben = quellSchritt(zMaster, stand(showMit('Gala', [GRACE])));
  const tsvFehler = tsvNichtGeschrieben(zMaster, zuSchreiben, { weg: 'reload', pfad: '', grund: 'EBUSY', gemerkt: null, mitEigenemOrdner: false });
  ok(
    tsvFehler.zustand.art === 'master' && tsvFehler.tsv === null && tsvFehler.merke.t === 'bleibt' && tsvFehler.zustand.master?.schluessel === S1,
    'R2 17.2: TSV nicht schreibbar → Quelle master und Liste bleiben',
  );
  ok(
    tsvFehler.zustand.quellHinweis !== null &&
      hinweisText(tsvFehler.zustand.quellHinweis) === 'Liste aus früherem Stand: Show nicht lesbar (speakers.tsv nicht schreibbar: EBUSY).',
    'R2 17.2: … Hinweis H4 wie in R1',
  );

  // Ordnerwahl im reinen Teil (der Main sperrt sie vorher, E22): master → ordner, Master vergessen.
  const gewaehlt = quellSchritt(zMaster, { t: 'ordnerGewaehlt' });
  ok(gewaehlt.zustand.art === 'ordner' && gewaehlt.zustand.master === null && gewaehlt.merke.t === 'loeschen', 'R2: ordnerGewaehlt → ordner, Master vergessen');
  // „Show gemerkt“ (7.9) gilt nur für die Pfad-Form.
  ok(logNachMerken(quellSchritt(zOrdner, stand(mit)), false).length === 0, 'R2: logNachMerken bei Master-Form ohne Zeile');
}
```

Ersetzung 6 (Ende des B12-Blocks, vor `// ── B13 · datalink.ts`), Vorher:
```ts
    ok(fehler !== null && fehler.meldung.length > 0, 'Befund 4: … die Meldung fürs Log bleibt erhalten');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
```
Nachher:
```ts
    ok(fehler !== null && fehler.meldung.length > 0, 'Befund 4: … die Meldung fürs Log bleibt erhalten');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ── R2 · show-quelle.ts: gemerkte Show in Master-Form (Spec 17.2) ──
{
  const { mkdtempSync, readFileSync, rmSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const sq = await import('../src/main/show-quelle');
  const tmp = mkdtempSync(join(tmpdir(), 'jmtitler-r2-'));
  try {
    const userData = join(tmp, 'userData');
    const datei = join(userData, 'show-zuletzt.json');
    const wert = { quelle: 'master' as const, masterId: 'master-1', schluessel: '0123456789abcdef', showName: 'Gala' };
    ok(sq.schreibeGemerkteShow(userData, wert) === true, 'R2 show-quelle: Master-Form schreiben → true');
    ok(JSON.stringify(sq.leseGemerkteShow(userData)) === JSON.stringify(wert), 'R2 show-quelle: Master-Form schreiben und lesen');
    const roh = JSON.parse(readFileSync(datei, 'utf8')) as Record<string, unknown>;
    ok(!('showPfad' in roh) && !('mitSpeakern' in roh), 'R2 show-quelle: Master-Form ohne showPfad und mitSpeakern (Titler 0.10 liest „keine gemerkte Show“)');
    const ohneSchluessel = { ...wert, schluessel: null };
    sq.schreibeGemerkteShow(userData, ohneSchluessel);
    ok(JSON.stringify(sq.leseGemerkteShow(userData)) === JSON.stringify(ohneSchluessel), 'R2 show-quelle: schluessel null bleibt null');
    const pfadForm = { showPfad: 'C:\\Shows\\Tag 1.jmshow', showName: 'Tag 1', mitSpeakern: true };
    sq.schreibeGemerkteShow(userData, pfadForm);
    ok(readFileSync(datei, 'utf8') === JSON.stringify(pfadForm, null, 2) + '\n', 'R2 show-quelle: Pfad-Form unverändert geschrieben');
    ok(JSON.stringify(sq.leseGemerkteShow(userData)) === JSON.stringify(pfadForm), 'R2 show-quelle: Pfad-Form unverändert gelesen');
    const kaputt: Array<[string, unknown]> = [
      ['ohne masterId', { quelle: 'master', schluessel: wert.schluessel, showName: 'Gala' }],
      ['mit leerer masterId', { ...wert, masterId: '' }],
      ['Schlüssel in Großbuchstaben', { ...wert, schluessel: '0123456789ABCDEF' }],
      ['Schlüssel zu kurz', { ...wert, schluessel: 'abc' }],
      ['ohne showName', { quelle: 'master', masterId: 'master-1', schluessel: wert.schluessel }],
      ['mit Pfad-Feldern, aber ohne masterId', { ...pfadForm, quelle: 'master' }],
    ];
    for (const [bez, o] of kaputt) {
      writeFileSync(datei, JSON.stringify(o));
      ok(sq.leseGemerkteShow(userData) === null, `R2 show-quelle: Master-Form ${bez} → null`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
```
`ADA`, `ALAN`, `GRACE`, `HEDY`, `createShow`, `hinweisText`, `tsvNichtGeschrieben`, `logNachMerken` sind im Selbsttest schon vorhanden (Modulebene `:159-162` bzw. Importe).

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/titler
```
Erwartet: tsx bricht vor dem ersten `ok` ab, Exitcode 1:
```
SyntaxError: The requested module '../src/shared/datenquelle' does not provide an export named 'ordnerPatchAbgelehnt'
```

- [ ] **Step 3: `apps/titler/src/shared/datenquelle.ts` ändern** (Edit-Werkzeug, CRLF bleibt)

Ersetzung 1 (Kopf und Typen, Zeilen 7–30), Vorher:
```ts
// liest die Show, wendet die Schritte an und schreibt die gemerkte Show (`main/show-quelle.ts`).
// Zur Laufzeit importiert das Modul nichts (nur Typen).
import type { Show, ShowIveoSpeaker } from '@jm/show';
import type { Hinweis } from './datalink-kern';

/** Woher der Titler seine Einträge liest (Spec 7.7). `show` und `frueher` lesen `userData/iveo-data`. */
export type DatenQuelleArt = 'show' | 'ordner' | 'frueher';

/** Inhalt von `<userData>/show-zuletzt.json` (Spec 7.7). */
export interface GemerkteShow {
  showPfad: string;
  showName: string;
  /** War die Datenquelle nach dem Anwenden `show`? */
  mitSpeakern: boolean;
}

export interface QuellZustand {
  art: DatenQuelleArt;
  /** Die Show, mit der der Titler verbunden ist; null ohne. */
  showPfad: string | null;
  showName: string | null;
  /** Hinweis der Datenquelle: nur H3, H4, H7. */
  quellHinweis: Hinweis | null;
}
```
Nachher:
```ts
// liest die Show, wendet die Schritte an und schreibt die gemerkte Show (`main/show-quelle.ts`).
// Release 2 (Spec 17.2): Datenquelle `master` für die Show vom Master im Verbund. Das Ereignis
// `masterStand` trägt einfache Felder; das Modul importiert nichts aus `@jm/app-runtime`.
// Zur Laufzeit importiert das Modul nichts (nur Typen).
import type { Show, ShowIveoSpeaker } from '@jm/show';
import type { Hinweis } from './datalink-kern';

/**
 * Woher der Titler seine Einträge liest (Spec 7.7, 17.2). `show`, `master` und `frueher` lesen
 * `userData/iveo-data`; `master` ist die Show vom Master im Verbund.
 */
export type DatenQuelleArt = 'show' | 'ordner' | 'frueher' | 'master';

/** Inhalt von `<userData>/show-zuletzt.json` für eine eigene Show (Spec 7.7). */
export interface GemerkteShowPfad {
  showPfad: string;
  showName: string;
  /** War die Datenquelle nach dem Anwenden `show`? */
  mitSpeakern: boolean;
}

/**
 * Inhalt von `<userData>/show-zuletzt.json` im Verbundmodus (Spec 17.2): die Show vom Master mit
 * Speakern. `showPfad` und `mitSpeakern` fehlen; ein Titler 0.10 liest das als „keine gemerkte Show“.
 */
export interface GemerkteShowMaster {
  quelle: 'master';
  masterId: string;
  schluessel: string | null;
  showName: string;
}

export type GemerkteShow = GemerkteShowPfad | GemerkteShowMaster;

/** Master-Form der gemerkten Show? */
export function istMasterForm(g: GemerkteShow | null): g is GemerkteShowMaster {
  return g !== null && 'quelle' in g && g.quelle === 'master';
}

export interface QuellZustand {
  art: DatenQuelleArt;
  /** Die Show, mit der der Titler verbunden ist; null ohne (und bei einer Show vom Master). */
  showPfad: string | null;
  showName: string | null;
  /** Hinweis der Datenquelle: nur H3, H4, H7. */
  quellHinweis: Hinweis | null;
  /** Die Show vom Master, zu der die Liste gehört (Spec 17.2); null bei eigener Show oder Ordner. */
  master: { masterId: string; masterName: string; schluessel: string | null } | null;
}
```

Ersetzung 2 (`QuellEreignis`, Zeilen 42–46), Vorher:
```ts
  | { t: 'nichtLesbar'; weg: QuellWeg; pfad: string; grund: string; gemerkt: GemerkteShow | null; mitEigenemOrdner: boolean }
  /** Der Bediener hat einen DataLink-Ordner gewählt. */
  | { t: 'ordnerGewaehlt' }
  /** Knopf „Zurück zum eigenen Ordner“. */
  | { t: 'zurueckZumOrdner' };
```
Nachher:
```ts
  | { t: 'nichtLesbar'; weg: QuellWeg; pfad: string; grund: string; gemerkt: GemerkteShowPfad | null; mitEigenemOrdner: boolean }
  /** Der Bediener hat einen DataLink-Ordner gewählt. */
  | { t: 'ordnerGewaehlt' }
  /** Knopf „Zurück zum eigenen Ordner“. */
  | { t: 'zurueckZumOrdner' }
  /**
   * Ein Stand vom Master mit Show wird angewendet (Spec 17.2). Ob es dieselbe Show ist, bestimmt
   * `quellSchritt` selbst aus `master` im Zustand (masterId + schluessel), nicht der Aufrufer (E21).
   */
  | { t: 'masterStand'; masterId: string; masterName: string; schluessel: string | null; show: Show }
  /** Der Verbundmodus ist zu Ende (app-runtime meldet `frueher`, Spec 16.1). */
  | { t: 'verbundEnde' };
```

Ersetzung 3 (`startZustand`, Zeilen 68–73), Vorher:
```ts
/** Datenquelle beim Start: gemerkte Show mit Speakern → `show`; Übergang → `frueher`; sonst `ordner`. */
export function startZustand(gemerkt: GemerkteShow | null, frueher: boolean): QuellZustand {
  if (gemerkt?.mitSpeakern) return { art: 'show', showPfad: gemerkt.showPfad, showName: gemerkt.showName, quellHinweis: null };
  if (frueher) return { art: 'frueher', showPfad: null, showName: null, quellHinweis: null };
  return { art: 'ordner', showPfad: gemerkt?.showPfad ?? null, showName: gemerkt?.showName ?? null, quellHinweis: null };
}
```
Nachher:
```ts
/**
 * Datenquelle beim Start: gemerkte Show mit Speakern → `show`; Übergang → `frueher`; sonst `ordner`.
 * Master-Form (Spec 17.2): an denselben Master gekoppelt (`gekoppelterMaster` = masterId der
 * Kopplung) → `master`, die vorhandene TSV gilt; sonst `frueher` (Q3). Den Namen des Masters kennt
 * die Datei nicht; er kommt mit dem ersten Stand (Zwischenspeicher oder Netz).
 */
export function startZustand(gemerkt: GemerkteShow | null, frueher: boolean, gekoppelterMaster: string | null = null): QuellZustand {
  if (istMasterForm(gemerkt)) {
    const master = { masterId: gemerkt.masterId, masterName: '', schluessel: gemerkt.schluessel };
    const art: DatenQuelleArt = gekoppelterMaster === gemerkt.masterId ? 'master' : 'frueher';
    return { art, showPfad: null, showName: gemerkt.showName, quellHinweis: null, master };
  }
  if (gemerkt?.mitSpeakern) return { art: 'show', showPfad: gemerkt.showPfad, showName: gemerkt.showName, quellHinweis: null, master: null };
  if (frueher) return { art: 'frueher', showPfad: null, showName: null, quellHinweis: null, master: null };
  return { art: 'ordner', showPfad: gemerkt?.showPfad ?? null, showName: gemerkt?.showName ?? null, quellHinweis: null, master: null };
}
```

Ersetzung 4 (Kopf von `quellSchritt`, Zeilen 95–105), Vorher:
```ts
/** Ein Ereignis der Datenquelle anwenden (Spec 7.6, 7.7). */
export function quellSchritt(z: QuellZustand, e: QuellEreignis): QuellSchritt {
  switch (e.t) {
    case 'gelesen': {
      const speakers = e.show.iveo?.speakers ?? [];
      const seit = e.show.iveo?.speakerVeraltetSeit;
      const h7: Hinweis | null = seit ? { art: 'H7', seit } : null;
      if (speakers.length) {
        // Show mit Speakern → show, TSV neu, H7 bei Merker.
        return angewendet({ art: 'show', showPfad: e.pfad, showName: e.show.name, quellHinweis: h7 }, e.pfad, e.show.name, speakers, e.weg);
      }
```
Nachher:
```ts
/** Gehört die Liste zur Show `schluessel` dieses Masters (Spec 17.2, E21)? Ein Schlüssel null ist nie dieselbe Show. */
function zeigtMasterShow(z: QuellZustand, masterId: string, schluessel: string | null): boolean {
  return z.master !== null && schluessel !== null && z.master.masterId === masterId && z.master.schluessel === schluessel;
}

/** Ein Ereignis der Datenquelle anwenden (Spec 7.6, 7.7, 17.2). */
export function quellSchritt(z: QuellZustand, e: QuellEreignis): QuellSchritt {
  switch (e.t) {
    case 'gelesen': {
      const speakers = e.show.iveo?.speakers ?? [];
      const seit = e.show.iveo?.speakerVeraltetSeit;
      const h7: Hinweis | null = seit ? { art: 'H7', seit } : null;
      if (speakers.length) {
        // Show mit Speakern → show, TSV neu, H7 bei Merker.
        return angewendet({ art: 'show', showPfad: e.pfad, showName: e.show.name, quellHinweis: h7, master: null }, e.pfad, e.show.name, speakers, e.weg);
      }
```

Ersetzung 5 (Rest von `quellSchritt`, Zeilen 112–142), Vorher:
```ts
      // Andere Show ohne Speaker → eigener Ordner; die Show wird gemerkt (RELOAD wirkt weiter).
      return angewendet({ art: 'ordner', showPfad: e.pfad, showName: e.show.name, quellHinweis: null }, e.pfad, e.show.name, null, e.weg);
    }
    case 'nichtLesbar': {
      if (e.weg === 'start') {
        if (e.gemerkt?.mitSpeakern) {
          // Die vorhandene TSV gilt, H4; ein späteres RELOAD versucht es erneut.
          const zustand: QuellZustand = { art: 'show', showPfad: e.pfad, showName: e.gemerkt.showName, quellHinweis: { art: 'H4', grund: e.grund } };
          return { zustand, tsv: null, beobachte: 'iveo-data', merke: BLEIBT, vorlage: false, log: [] };
        }
        const zustand: QuellZustand = { art: 'ordner', showPfad: e.pfad, showName: e.gemerkt?.showName ?? null, quellHinweis: null };
        // Ohne eigenen Ordner gilt keiner (die Liste ist leer, „Kein Datenordner aktiv …“): Die Zeile sagt das.
        const folge = e.mitEigenemOrdner ? 'eigener Ordner gilt' : 'kein eigener Ordner eingetragen';
        return { zustand, tsv: null, beobachte: 'eigener', merke: BLEIBT, vorlage: false, log: [`Gemerkte Show nicht lesbar (${e.grund}), ${folge}.`] };
      }
      // Deep-Link oder RELOAD: Art und Liste bleiben; H4 nur bei Art show.
      const quellHinweis: Hinweis | null = z.art === 'show' ? { art: 'H4', grund: e.grund } : z.quellHinweis;
      return { zustand: { ...z, quellHinweis }, tsv: null, beobachte: beobachteFuer(z.art), merke: BLEIBT, vorlage: false, log: [] };
    }
    case 'ordnerGewaehlt':
    case 'zurueckZumOrdner':
      return {
        zustand: { art: 'ordner', showPfad: null, showName: null, quellHinweis: null },
        tsv: null,
        beobachte: 'eigener',
        merke: { t: 'loeschen' },
        vorlage: false,
        log: [],
      };
  }
}
```
Nachher:
```ts
      // Andere Show ohne Speaker → eigener Ordner; die Show wird gemerkt (RELOAD wirkt weiter).
      return angewendet({ art: 'ordner', showPfad: e.pfad, showName: e.show.name, quellHinweis: null, master: null }, e.pfad, e.show.name, null, e.weg);
    }
    case 'nichtLesbar': {
      if (e.weg === 'start') {
        if (e.gemerkt?.mitSpeakern) {
          // Die vorhandene TSV gilt, H4; ein späteres RELOAD versucht es erneut.
          const zustand: QuellZustand = { art: 'show', showPfad: e.pfad, showName: e.gemerkt.showName, quellHinweis: { art: 'H4', grund: e.grund }, master: null };
          return { zustand, tsv: null, beobachte: 'iveo-data', merke: BLEIBT, vorlage: false, log: [] };
        }
        const zustand: QuellZustand = { art: 'ordner', showPfad: e.pfad, showName: e.gemerkt?.showName ?? null, quellHinweis: null, master: null };
        // Ohne eigenen Ordner gilt keiner (die Liste ist leer, „Kein Datenordner aktiv …“): Die Zeile sagt das.
        const folge = e.mitEigenemOrdner ? 'eigener Ordner gilt' : 'kein eigener Ordner eingetragen';
        return { zustand, tsv: null, beobachte: 'eigener', merke: BLEIBT, vorlage: false, log: [`Gemerkte Show nicht lesbar (${e.grund}), ${folge}.`] };
      }
      // Deep-Link oder RELOAD (und eine nicht schreibbare TSV im Master-Weg): Art und Liste bleiben;
      // H4 nur bei Art show bzw. master.
      const quellHinweis: Hinweis | null = z.art === 'show' || z.art === 'master' ? { art: 'H4', grund: e.grund } : z.quellHinweis;
      return { zustand: { ...z, quellHinweis }, tsv: null, beobachte: beobachteFuer(z.art), merke: BLEIBT, vorlage: false, log: [] };
    }
    case 'ordnerGewaehlt':
    case 'zurueckZumOrdner':
      return {
        zustand: { art: 'ordner', showPfad: null, showName: null, quellHinweis: null, master: null },
        tsv: null,
        beobachte: 'eigener',
        merke: { t: 'loeschen' },
        vorlage: false,
        log: [],
      };
    case 'masterStand': {
      const speakers = e.show.iveo?.speakers ?? [];
      const seit = e.show.iveo?.speakerVeraltetSeit;
      const h7: Hinweis | null = seit ? { art: 'H7', seit } : null;
      const master = { masterId: e.masterId, masterName: e.masterName, schluessel: e.schluessel };
      const gleich = zeigtMasterShow(z, e.masterId, e.schluessel);
      if (speakers.length) {
        // Stand mit Speakern → master (wie show, Ordner iveo-data), TSV neu, H7 bei Merker. Gemerkt wird
        // nur, was sich ändert (Show, Master oder Name); sonst schriebe jeder Stand die Datei neu.
        const zustand: QuellZustand = { art: 'master', showPfad: null, showName: e.show.name, quellHinweis: h7, master };
        const wert: GemerkteShowMaster = { quelle: 'master', masterId: e.masterId, schluessel: e.schluessel, showName: e.show.name };
        const unveraendert = gleich && z.art === 'master' && z.showName === e.show.name;
        return { zustand, tsv: speakers, beobachte: 'iveo-data', merke: unveraendert ? BLEIBT : { t: 'schreiben', wert }, vorlage: false, log: [] };
      }
      if (gleich) {
        // Gleiche Show, keine Speaker: Art und Liste bleiben; bei master H7 bzw. H3.
        const quellHinweis: Hinweis | null = z.art === 'master' ? (h7 ?? { art: 'H3' }) : null;
        return { zustand: { ...z, showName: e.show.name, quellHinweis, master }, tsv: null, beobachte: beobachteFuer(z.art), merke: BLEIBT, vorlage: false, log: [] };
      }
      // Neue Show, keine Speaker → eigener Ordner. Die gemerkte Show wird gelöscht: ein Neustart fände
      // sonst die Liste der vorigen Show als Quelle master.
      return {
        zustand: { art: 'ordner', showPfad: null, showName: e.show.name, quellHinweis: null, master },
        tsv: null,
        beobachte: 'eigener',
        merke: { t: 'loeschen' },
        vorlage: false,
        log: [],
      };
    }
    case 'verbundEnde':
      // Nur die Quelle master endet: frueher (Q3), die TSV bleibt (Spec 17.2). Andere Quellen bleiben.
      if (z.art !== 'master') return { zustand: z, tsv: null, beobachte: beobachteFuer(z.art), merke: BLEIBT, vorlage: false, log: [] };
      return { zustand: { ...z, art: 'frueher', quellHinweis: null }, tsv: null, beobachte: 'iveo-data', merke: BLEIBT, vorlage: false, log: [] };
  }
}
```

Ersetzung 6 (`tsvNichtGeschrieben`, Zeilen 153–154), Vorher:
```ts
  e: { weg: QuellWeg; pfad: string; grund: string; gemerkt: GemerkteShow | null; mitEigenemOrdner: boolean },
): QuellSchritt {
```
Nachher:
```ts
  e: { weg: QuellWeg; pfad: string; grund: string; gemerkt: GemerkteShowPfad | null; mitEigenemOrdner: boolean },
): QuellSchritt {
```

Ersetzung 7 (`logNachMerken`, Zeilen 163–164), Vorher:
```ts
export function logNachMerken(s: QuellSchritt, gespeichert: boolean): string[] {
  if (s.merke.t !== 'schreiben' || gespeichert) return s.log;
```
Nachher:
```ts
export function logNachMerken(s: QuellSchritt, gespeichert: boolean): string[] {
  if (s.merke.t !== 'schreiben' || gespeichert || istMasterForm(s.merke.wert)) return s.log;
```

Ersetzung 8 (`quellZeile`, Zeilen 219–220), Vorher:
```ts
export function quellZeile(z: QuellZustand, ordner: string, anzahl: number): string {
  if (z.art === 'show') return `Quelle: Show „${z.showName ?? ''}“ · ${anzahl} Speaker`;
```
Nachher:
```ts
export function quellZeile(z: QuellZustand, ordner: string, anzahl: number): string {
  if (z.art === 'show') return `Quelle: Show „${z.showName ?? ''}“ · ${anzahl} Speaker`;
  // Q4 (Spec 16.5): die Show vom Master; der volle Name, die Zeile kürzt die Oberfläche.
  if (z.art === 'master') return `Quelle: Show vom Master „${z.showName ?? ''}“`;
```

Ersetzung 9 (Dateiende, Zeilen 230–233), Vorher:
```ts
  if (z.art !== 'show' || !ordner.trim()) return null;
  const name = ordner.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || ordner;
  return `Zurück zum eigenen Ordner (${name})`;
}
```
Nachher:
```ts
  if (z.art !== 'show' || !ordner.trim()) return null;
  const name = ordner.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || ordner;
  return `Zurück zum eigenen Ordner (${name})`;
}

/**
 * Ordnerwahl unter Einstellungen › DataLink (Spec 17.2, Owner O1): Trägt die Show am Master Speaker
 * (Quelle `master`), ist sie gesperrt — Rückgabe ist der Text dazu. Sonst `null` (frei wählbar).
 */
export function ordnerWahlGesperrt(z: QuellZustand): string | null {
  if (z.art !== 'master') return null;
  return `Im Verbund kommen die Speaker vom Master „${z.master?.masterName ?? ''}“. Ein eigener Ordner gilt, solange die Show dort keine Speaker hat.`;
}

/**
 * Sperre im Main für einen Config-Patch (E22): Lehnt der Main den `dataFolder` des Patches ab? Nur wenn er gesetzt
 * ist, sich vom bisherigen Ordner unterscheidet und die Ordnerwahl gesperrt ist; dann der Text aus 17.2 für die
 * Warnung, sonst `null`. Der Rest des Patches gilt in jedem Fall.
 */
export function ordnerPatchAbgelehnt(neu: string | undefined, vorher: string, z: QuellZustand): string | null {
  if (neu === undefined || neu === vorher) return null;
  return ordnerWahlGesperrt(z);
}

/**
 * Endet mit dieser Lage aus app-runtime (`VerbundDaten.art`) der Verbund für die Quelle `master` (Spec 16.1, 17.2)?
 * Ja bei `frueher`, `einzelplatz` und `datei-defekt`: Der Rechner folgt keinem Master mehr — auch dann, wenn noch
 * nichts angewendet ist (Start mit gemerkter Master-Form ohne lesbaren Zwischenspeicher, danach entkoppelt). Sonst
 * bliebe die Ordnerwahl gesperrt, und Q4 nennte eine Show vom Master, der nicht mehr gilt. Die anderen Lagen
 * (`warte`, `ohne-daten`, `aktuell`, `getrennt`) gehören zu einem laufenden Verbund.
 */
export function verbundEndetFuer(z: QuellZustand, lage: string): boolean {
  return z.art === 'master' && (lage === 'frueher' || lage === 'einzelplatz' || lage === 'datei-defekt');
}
```

- [ ] **Step 4: Test laufen lassen (Zwischenstand: nur show-quelle rot)**

```
npm run selftest -w @jm/titler
```
Erwartet: Exitcode 1, 474 `ok`-Zeilen, genau diese drei `FAIL`-Zeilen (alle aus dem neuen show-quelle-Block):
```
FAIL R2 show-quelle: Master-Form schreiben und lesen
FAIL R2 show-quelle: schluessel null bleibt null
FAIL R2 show-quelle: Master-Form mit Pfad-Feldern, aber ohne masterId → null
```

- [ ] **Step 5: `apps/titler/src/main/show-quelle.ts` für beide Formen**

Ersetzung 1 (Zeile 18), Vorher:
```ts
import type { GemerkteShow } from '../shared/datenquelle';
```
Nachher:
```ts
import { istMasterForm, type GemerkteShow } from '../shared/datenquelle';
```
(`datenquelle.ts` hat keine Laufzeitimporte; tsx und electron-vite laden es ohne Weiteres.)

Ersetzung 2 (Zeilen 26–36), Vorher:
```ts
/** Gemerkte Show lesen. `null`, wenn die Datei fehlt, kein gültiges JSON ist oder ein Feld nicht stimmt. */
export function leseGemerkteShow(userData: string): GemerkteShow | null {
  let roh: unknown;
  try {
    roh = JSON.parse(readFileSync(join(userData, GEMERKT_DATEI), 'utf8'));
  } catch {
    return null;
  }
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return null;
  const o = roh as Record<string, unknown>;
  if (typeof o.showPfad !== 'string' || !o.showPfad.trim()) return null;
```
Nachher:
```ts
/** Schlüssel einer Show am Master (Spec 13.2): genau 16 Zeichen [0-9a-f]. */
const MASTER_SCHLUESSEL = /^[0-9a-f]{16}$/;

/**
 * Gemerkte Show lesen. `null`, wenn die Datei fehlt, kein gültiges JSON ist oder ein Feld nicht stimmt.
 * Zwei Formen (Spec 17.2): `{ quelle: 'master', masterId, schluessel, showName }` im Verbundmodus,
 * sonst `{ showPfad, showName, mitSpeakern }`. Eine Datei mit `quelle: 'master'` gilt nie als Pfad-Form.
 */
export function leseGemerkteShow(userData: string): GemerkteShow | null {
  let roh: unknown;
  try {
    roh = JSON.parse(readFileSync(join(userData, GEMERKT_DATEI), 'utf8'));
  } catch {
    return null;
  }
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return null;
  const o = roh as Record<string, unknown>;
  if (o.quelle === 'master') {
    if (typeof o.masterId !== 'string' || !o.masterId.trim()) return null;
    if (o.schluessel !== null && (typeof o.schluessel !== 'string' || !MASTER_SCHLUESSEL.test(o.schluessel))) return null;
    if (typeof o.showName !== 'string') return null;
    return { quelle: 'master', masterId: o.masterId, schluessel: o.schluessel, showName: o.showName };
  }
  if (typeof o.showPfad !== 'string' || !o.showPfad.trim()) return null;
```

Ersetzung 3 (Zeilen 47–48), Vorher:
```ts
    mkdirSync(userData, { recursive: true });
    const inhalt = { showPfad: wert.showPfad, showName: wert.showName, mitSpeakern: wert.mitSpeakern };
```
Nachher:
```ts
    mkdirSync(userData, { recursive: true });
    const inhalt = istMasterForm(wert)
      ? { quelle: 'master', masterId: wert.masterId, schluessel: wert.schluessel, showName: wert.showName }
      : { showPfad: wert.showPfad, showName: wert.showName, mitSpeakern: wert.mitSpeakern };
```

- [ ] **Step 6: Test laufen lassen (grün)**

```
npm run selftest -w @jm/titler 2>&1 | grep -c "^ok "
npm run selftest -w @jm/titler 2>&1 | tail -1
```
Erwartet: `477` (407 vorher + 70 neu) und `ALLE TESTS OK`, Exitcode 0.

- [ ] **Step 7: Typecheck zeigt, wo der Main die neue Union berührt**

```
npm run typecheck -w @jm/titler
```
Erwartet: Exitcode ≠ 0, genau diese vier Meldungen (Zeilen im Ist-Stand):
```
src/main/index.ts(230,69): error TS2322: Type 'GemerkteShow | null' is not assignable to type 'GemerkteShowPfad | null'.
src/main/index.ts(240,76): error TS2322: Type 'GemerkteShow | null' is not assignable to type 'GemerkteShowPfad | null'.
src/main/index.ts(301,30): error TS2339: Property 'showPfad' does not exist on type 'GemerkteShow'.
src/main/index.ts(306,40): error TS2339: Property 'showPfad' does not exist on type 'GemerkteShow'.
```

- [ ] **Step 8: Typ-Brücke im Main** (`apps/titler/src/main/index.ts`, verhaltensgleich für die Pfad-Form; C16 baut `starteDatenquelle` danach aus)

Ersetzung 1 (Import aus `@shared/datenquelle`, Zeilen 31–34), Vorher:
```ts
import {
  eigenerOrdner,
  logNachMerken,
  zeigtShow,
```
Nachher:
```ts
import {
  eigenerOrdner,
  istMasterForm,
  logNachMerken,
  zeigtShow,
```
Ersetzung 2 (Zeilen 41–45), Vorher:
```ts
  type QuellEreignis,
  type QuellSchritt,
  type QuellWeg,
  type QuellZustand,
} from '@shared/datenquelle';
```
Nachher:
```ts
  type GemerkteShowPfad,
  type QuellEreignis,
  type QuellSchritt,
  type QuellWeg,
  type QuellZustand,
} from '@shared/datenquelle';
```
Ersetzung 3 (Zeilen 142–144), Vorher:
```ts
function userDataDir(): string {
  return app.getPath('userData');
}
```
Nachher:
```ts
function userDataDir(): string {
  return app.getPath('userData');
}

/** Gemerkte eigene Show (Pfad-Form) oder null — die Master-Form hat keinen Pfad (Spec 17.2). */
function gemerktePfadShow(userData: string): GemerkteShowPfad | null {
  const g = leseGemerkteShow(userData);
  return istMasterForm(g) ? null : g;
}
```
Ersetzung 4 (Zeile 230), Vorher:
```ts
    ereignis = { t: 'nichtLesbar', weg, pfad, grund: gelesen.grund, gemerkt: leseGemerkteShow(userData), mitEigenemOrdner };
```
Nachher:
```ts
    ereignis = { t: 'nichtLesbar', weg, pfad, grund: gelesen.grund, gemerkt: gemerktePfadShow(userData), mitEigenemOrdner };
```
Ersetzung 5 (Zeile 240), Vorher:
```ts
      s = tsvNichtGeschrieben(quelle, s, { weg, pfad, grund: fehler.grund, gemerkt: leseGemerkteShow(userData), mitEigenemOrdner });
```
Nachher:
```ts
      s = tsvNichtGeschrieben(quelle, s, { weg, pfad, grund: fehler.grund, gemerkt: gemerktePfadShow(userData), mitEigenemOrdner });
```
Ersetzung 6 (Zeilen 299–307), Vorher:
```ts
  quelle = startZustand(gemerkt, ue.frueher);
  // Die gemerkte Show ist die verbundene Show: Ziel von RELOAD und Vergleich „dieselbe Show“.
  currentShowPath = gemerkt?.showPfad ?? null;
  datenquelleGestartet = true;
  const link = deepLink ?? wartenderDeepLink;
  wartenderDeepLink = null;
  if (link && parseShowDeepLink(link)) applyShowFromDeepLink(link);
  else if (gemerkt) oeffneShow(gemerkt.showPfad, 'start');
  else refreshDataWatch();
```
Nachher:
```ts
  quelle = startZustand(gemerkt, ue.frueher);
  // Die gemerkte Show ist die verbundene Show: Ziel von RELOAD und Vergleich „dieselbe Show“.
  // Die Master-Form (Spec 17.2) hat keinen Pfad: kein RELOAD-Ziel, nichts zu lesen.
  const gemerktPfad = istMasterForm(gemerkt) ? null : gemerkt;
  currentShowPath = gemerktPfad?.showPfad ?? null;
  datenquelleGestartet = true;
  const link = deepLink ?? wartenderDeepLink;
  wartenderDeepLink = null;
  if (link && parseShowDeepLink(link)) applyShowFromDeepLink(link);
  else if (gemerktPfad) oeffneShow(gemerktPfad.showPfad, 'start');
  else refreshDataWatch();
```
(`uebergang(…, gemerkt, …)` fragt nur `gemerkt === null` und nimmt die Union unverändert.)

- [ ] **Step 9: Typecheck, Selbsttest, Importe**

```
npm run typecheck -w @jm/titler
npm run selftest -w @jm/titler 2>&1 | grep -c "^ok "
grep -n "^import" apps/titler/src/shared/datenquelle.ts
```
Erwartet: Typecheck ohne Meldung (node und web), Exitcode 0; `477`; die Importe genau:
```
apps/titler/src/shared/datenquelle.ts:11:import type { Show, ShowIveoSpeaker } from '@jm/show';
apps/titler/src/shared/datenquelle.ts:12:import type { Hinweis } from './datalink-kern';
```

- [ ] **Step 10: Commit** (Git Bash, Commit-Text ohne Umlaute)

```
git add apps/titler/src/shared/datenquelle.ts apps/titler/src/main/show-quelle.ts apps/titler/src/main/index.ts apps/titler/test/selftest.ts
git status --short
```
Erwartet genau:
```
M  apps/titler/src/main/index.ts
M  apps/titler/src/main/show-quelle.ts
M  apps/titler/src/shared/datenquelle.ts
M  apps/titler/test/selftest.ts
```
Dann:
```
git commit -m "feat(titler): Datenquelle master und gemerkte Show in Master-Form als reine Regeln (Teil 2b R2, C15)" -m "Ereignisse masterStand und verbundEnde: Stand mit Speakern wird Quelle master (iveo-data, TSV mit Kennung), gleiche Show ohne Speaker behaelt die Liste mit H3/H7, neue Show ohne Speaker schaltet auf den eigenen Ordner und loescht die gemerkte Show, Ende des Verbunds macht aus master frueher; verbundEndetFuer erkennt es an frueher, einzelplatz und datei-defekt. Gleiche Show bestimmt quellSchritt aus masterId und Schluessel. show-zuletzt.json kennt die Master-Form { quelle, masterId, schluessel, showName }; Start damit: gleicher Master gekoppelt master, sonst frueher. ordnerWahlGesperrt (O1) und Q4 woertlich, ordnerPatchAbgelehnt fuer die Sperre im Main (E22). Main nur Typ-Bruecke fuer die Union." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- **`apps/titler/src/main/index.ts` wird schon hier berührt** (Steps 7–8), obwohl das Gerüst die Datei erst in C16 nennt. Grund: `GemerkteShow` wird nach Register eine Union; ohne die Brücke bricht der Typecheck (G11). Die Brücke ändert kein Verhalten der Pfad-Form; eine Master-Form startet bis C16 als `frueher` (ohne Kopplungswissen).
- **Vier alte Testzeilen** bekommen `master: null` (das neue Pflichtfeld aus dem Register). Nur die Zeile aus Ersetzung 4 (vor C15 Zeile 689) ist laufzeitrelevant (Vergleich der ganzen JSON-Form); die drei Literale sind für die Typtreue.
- **`startZustand`**: dritter Parameter mit Vorgabe `= null`. Die Signatur bleibt die des Registers; alte Aufrufe mit zwei Argumenten (Test, Ist-Main) bleiben gültig.
- **`nichtLesbar.gemerkt` und `tsvNichtGeschrieben(…).gemerkt`** sind jetzt `GemerkteShowPfad | null`: Nur eine Pfad-Show kann „nicht lesbar“ sein; die Master-Form hat keinen Pfad.
- **H4 auch bei Art `master`** im Zweig `nichtLesbar` (Deep-Link/RELOAD-Regel): nötig, damit eine nicht schreibbare TSV im Master-Weg über `tsvNichtGeschrieben` H4 zeigt (Vormerkung 14; Wortlaut wie R1, FA19).
- Wo die Spec schweigt, gilt (E53; Owner-Frage 6, vom Owner am 08.10.2026 geschlossen):
  - Gemerkt wird im Master-Weg nur bei Änderung (Show, Master, Name).
  - Neue Show ohne Speaker im Verbund löscht `show-zuletzt.json` (statt einer Master-Form ohne Speaker, die das Register nicht kennt).
  - `verbundEnde` ändert nur die Art `master`; ein eigener Ordner oder eine eigene Show bleiben. `quellHinweis` wird dabei `null` (Q3 trägt keinen Hinweis).
  - Q4 nennt den vollen Showname; die Oberfläche kürzt die Zeile (`truncate`, Tooltip).
- Zusätzlicher Export `istMasterForm` (Typwächter), von `show-quelle.ts` und dem Main genutzt.
- Zusätzlicher Export `verbundEndetFuer` (N8): Die Regel „Ende des Verbunds für Quelle `master`“ ist rein und getestet; C16 hatte sie nur im Main und nur für `frueher`. Ohne angewendeten Stand meldet app-runtime beim Entkoppeln `einzelplatz` (bzw. `datei-defekt`), und der Titler bliebe in Quelle `master`: Q4, gesperrte Ordnerwahl (E22), aber keine V-Zeile.
- Zusätzlicher Export `ordnerPatchAbgelehnt` (N17): Die Regel der Sperre im Main für einen Config-Patch (E22) stand vorher nur in C16 und war ungetestet. Drei Prüfungen; rot zuerst (Step 2 bricht mit genau diesem Namen ab), Gegenproben unten.

**Nachgerechnet** (beim Durchspielen des ganzen Plans): Step 2 rot wie angegeben; Step 4 474 `ok` + genau die drei `FAIL`; Step 6 `477`, „ALLE TESTS OK“ (nach N17 nachgemessen); Step 7 genau die vier Meldungen; Step 9 Typecheck node und web grün. Gegenprobe mit je einem absichtlichen Fehler in `datenquelle.ts`, alle gefangen (die Zeilen ohne N-Verweis hat der Schreiber gemessen; die mit N8, N17 und N21 sind in der zweiten Runde mit genau der genannten Änderung nachgemessen, Befehl `npm run selftest -w @jm/titler`, danach zurückbauen):

| Fehler | `FAIL`-Zeilen |
| --- | --- |
| gleiche Show nur über `masterId` (Schlüssel übergangen) | 5 |
| `verbundEnde` macht jede Quelle zu `frueher` | 2 |
| neue Show ohne Speaker löscht die gemerkte Show nicht | 2 |
| Sperre auch bei `ordner` im Verbund: in `ordnerWahlGesperrt` `if (z.art !== 'master') return null;` → `if (z.master === null) return null;` (N21) | 3: „R2 16.1: Start mit Master-Form ohne angewendeten Stand, dann entkoppelt → frueher, Ordnerwahl wieder frei“, „R2 O1: bei ordner (auch im Verbund), show und frueher frei“, „R2 E22: bei ordner (auch im Verbund) und show nicht abgelehnt“ |
| H4 nicht bei `master` | 1 |
| Start mit Master-Form immer `master` | 2 |
| Namenswechsel nicht gemerkt | 1 |
| Schlüssel `null` gilt als gleich | 1 |
| `verbundEndetFuer` nur bei `frueher` (die Regel vor N8): `(lage === 'frueher' \|\| lage === 'einzelplatz' \|\| lage === 'datei-defekt')` → `(lage === 'frueher')` | 3: „R2 16.1: Lage einzelplatz beendet den Verbund für Quelle master“, „R2 16.1: Lage datei-defekt beendet den Verbund für Quelle master“, „R2 16.1: Start mit Master-Form ohne angewendeten Stand, dann entkoppelt → frueher, Ordnerwahl wieder frei“ |
| E22 lehnt auch einen unveränderten Ordner ab: `if (neu === undefined \|\| neu === vorher) return null;` → `if (neu === undefined) return null;` (N17) | 1: „R2 E22: … ohne dataFolder oder mit unverändertem → nicht abgelehnt, der Rest des Patches gilt“ |
| E22 sperrt unabhängig von der Quelle: in `ordnerPatchAbgelehnt` `return ordnerWahlGesperrt(z);` → `return ordnerWahlGesperrt({ ...z, art: 'master' });` (N17) | 1: „R2 E22: bei ordner (auch im Verbund) und show nicht abgelehnt“ |

---

### Task 16: C16 · Titler: Main (dem Master folgen, Sperre im Main, Deep-Link und RELOAD im Verbund), Abzeichen, gesperrte Ordnerwahl

**Spec:** 16.1 (Verbundmodus, Logzeilen, `verbundDatenErsetzt()`), 16.5 (Abzeichen vor „Suite · ⟨n⟩ verbunden“, Q4), 17.2 (Tabelle, Deep-Link im Verbundmodus nur Vorlage C3, Ende → `frueher`, Sperrtext), 27 O1. Entscheidungen E17, E21, E22, E28. Vormerkungen 14 (H4 im Master-Weg) und 17 (OperatorView-Zweig `ohneOrdner` mitprüfen).

**Arbeitsverzeichnis:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b-r2`, Branch `feat/master-link-teil2b-r2`. Voraussetzung: C13 und C15 sind committet.

**Dateien:**
- Modify: `apps/titler/src/main/index.ts` (Stand nach C15): Importe `:5-6` und `@shared/datenquelle`, `uebernimmDataState` (`status.datenQuelle`), Ende von `oeffneShow` plus neue Funktion `wendeMasterStandAn`, `applyShowFromDeepLink`/`reloadCurrentShow`, `eigenerOrdnerGilt` und `starteDatenquelle` (ganz) plus zwei Helfer, IPC `titler:setConfig`, `titler:pickDataFolder`, `titler:zurueckZumOrdner`
- Modify: `apps/titler/src/shared/types.ts:176` (`TitlerStatus.datenQuelle.ordnerGesperrt?`, neuer Typ `VerbundAnzeigeZeile`, E28), `:313` (`JmtitlerApi`)
- Modify: `apps/titler/src/preload/index.ts:13`, `:87-88`
- Modify: `apps/titler/src/renderer/src/views/OperatorView.tsx:7-9`, `:242`, `:254-257`, `:616-627`, `:633`, `:867-871` (Dateiende)
- Unverändert: `apps/titler/src/renderer/src/jmtitler.d.ts` (nimmt `JmtitlerApi` aus `@shared/types`)

**Interfaces:**
- Consumes (C13, S-C): `folgeMasterShow`, `imVerbundmodus`, `nichtAngewendet` (N3), `verbundDatenErsetzt`, `verbundIgnoriert`, `verbundKopplung` (`VerbundKopplung | null` mit `rolle`, `masterId`, `masterName`), Typ `MasterStand`, IPC `jmps:verbund-anzeige`. Aus C15: `startZustand(gemerkt, frueher, gekoppelterMaster)`, `quellSchritt` mit `masterStand`/`verbundEnde`, `ordnerWahlGesperrt`, `verbundEndetFuer` (N8), `istMasterForm`, `tsvNichtGeschrieben`, `GemerkteShowPfad`.
- Produces (S-D, exakt):
  ```ts
  // apps/titler/src/shared/types.ts (E28)
  export interface VerbundAnzeigeZeile { text: string; farbe: 'gruen' | 'gelb' | 'rot' | 'gedaempft' }
  // TitlerStatus.datenQuelle: { art; zeile; zurueckKnopf; ohneOrdner; ordnerGesperrt?: string }
  // JmtitlerApi / Preload window.jmtitler (C20 liest per CDP, Port 9335):
  verbundAnzeige: () => Promise<VerbundAnzeigeZeile | null>;
  onVerbundAnzeige: (cb: (a: VerbundAnzeigeZeile | null) => void) => () => void;
  ```

**Regeln:** G5, G6 (Logzeilen ohne Netzwerte außer dem Namen, den app-runtime liefert), G11, G12, G14, G15, G16. Zu G15: keine neuen Unit-Tests, die Regeln sind in C15 getestet (`quellSchritt`, `verbundEndetFuer`, `ordnerWahlGesperrt`, seit N17 auch `ordnerPatchAbgelehnt`); hier Typecheck und Build. Der Durchgang C20 prüft am Titler: Stand vom Master anwenden (Prüfung 1), Bauchbinde auf Sendung bei neuer Liste (3), Master weg und neue Epoche (4), Neustart aus dem Zwischenspeicher (5), RELOAD im Verbundmodus (6), Entkoppeln mit V13 und bleibenden Daten (7). **Nicht in C20:** ein Show-Deep-Link (C20 startet ohne, Spec 19.7), also auch die Startreihenfolge E55, und die gesperrte Ordnerwahl (E22). Die stehen als Handprüfung unter „Zusatzprüfungen (nicht in Spec 20)“ in der Abnahme-Datei (C21, N17), dazu die eigene Ordnerwahl nach dem Entkoppeln (E56, N23). Von Hand nicht erreichbar ist die Ablehnung im Main selbst (`titler:pickDataFolder`, `titler:setConfig`, `titler:zurueckZumOrdner`), solange die Oberfläche die Wahl sperrt; sie ist als reine Regel in C15 getestet und hier nur über Typecheck und Build abgesichert (N23).

**Verhalten (verbindlich):**
- **`wendeMasterStandAn(stand)`** (Handler `anwenden`): `quellSchritt(quelle, { t: 'masterStand', … })`; mit TSV: `schreibeSpeakersTsvSicher(iveoData, tsv)`. Scheitert das, gilt `tsvNichtGeschrieben(quelle, s, { weg: 'reload', pfad: '', grund, gemerkt: null, … })` (Quelle und Liste bleiben, H4), und die Funktion **wirft** `nichtAngewendet(⟨Code⟩)` (N3) — app-runtime zeigt V12 „Show vom Master nicht übernommen: ⟨Code⟩“ und versucht es fünfmal im Abstand von 1 s erneut (16.2, „etwa bei EBUSY auf der TSV“). Ein einfaches `Error` ergäbe in V12 nur „Error“ (E49: der Folger nimmt `err.code`, nie die Meldung). `neueShow` wertet der Titler nicht aus (E21).
- **`beiWechsel(d)`**: `verbundEndetFuer(quelle, d.art)` (C15, N8: Quelle `master` und Lage `frueher`, `einzelplatz` oder `datei-defekt`) → `verbundEnde` (Quelle `frueher`, Q3, die TSV bleibt, Ordnerwahl wieder frei).
- **Deep-Link im Verbundmodus**: `verbundIgnoriert('deeplink', pfad)` und nur die Vorlage (`openShowDocument`, C3). **RELOAD im Verbundmodus**: `verbundIgnoriert('reload')`, Rückgabe `false`.
- **Eigene Show außerhalb**: `oeffneShow` ruft nach einer gelesenen und übernommenen Show `verbundDatenErsetzt()` (Deep-Link, RELOAD, Start mit eigener gemerkter Show, E16). Eine nicht lesbare Show oder eine nicht schreibbare TSV ersetzt nichts.
- **Ordnerwahl/Knopf außerhalb des Verbundmodus** rufen ebenfalls `verbundDatenErsetzt()`: Der Bediener wählt damit auch die Daten eines früheren Masters ab; ein Neustart soll sie nicht aus dem Zwischenspeicher zurückholen (Ergänzung zu E16, siehe Abweichungen).
- **Sperre im Main (E22)**: Bei Quelle `master` lehnen `titler:pickDataFolder` (liefert `''` wie „abgebrochen“), `titler:setConfig` mit geändertem `dataFolder` (der Rest des Patches gilt; die Regel ist `ordnerPatchAbgelehnt` aus C15, N17) und `titler:zurueckZumOrdner` ab; je eine Warnung „DataLink: Ordnerwahl abgelehnt. ⟨Text 17.2⟩“ aus einer Stelle (`ordnerWahlAbgelehnt`); der Status bleibt.
- **Start (E17)**: `starteDatenquelle` liest die Kopplung (`verbundKopplung()`), setzt `startZustand(gemerkt, frueher, masterId nur bei Rolle slave)`, übernimmt bei Master-Form den Namen des Masters aus der Kopplung (der Text der Sperre braucht ihn, bevor der erste Stand kommt), startet die gemerkte Pfad-Show bzw. den Datenordner **nur ohne Show-Deep-Link**, registriert dann `folgeMasterShow` (ein Zwischenspeicher wird dabei angewendet) und wendet **erst danach** den Deep-Link an. So liefert ein Deep-Link beim Start im Verbundmodus nur die Vorlage (16.3 „sofort Verbundmodus“); am Einzelplatz ist die Reihenfolge wie bisher (Deep-Link statt gemerkter Show).
- **Anzeige**: Abzeichen vor „Suite · ⟨n⟩ verbunden“ mit der V-Zeile (gekürzt, Tooltip); es trägt den Abstand `ml-auto`, auch leer am Einzelplatz. Einstellungen › DataLink: Eingabe, „Durchsuchen…“ und „✕“ gesperrt, darunter der Text aus 17.2. `iveoActive` gilt auch für Quelle `master`.
- **Vormerkung 17** (OperatorView-Zweig `ohneOrdner`): geprüft, kein Befund — `ohneOrdner` ist `art === 'ordner' && !eigener`; bei Quelle `master` also `false` (die Liste wird gezeigt), bei `ordner` im Verbund ohne eigenen Ordner gilt „Kein Datenordner aktiv …“ zu Recht.

---

- [ ] **Step 1: Main — Importe** (`apps/titler/src/main/index.ts`, Edit-Werkzeug, CRLF bleibt)

Ersetzung 1 (Zeilen 5–6), Vorher:
```ts
import { initAppRuntime, getLog } from '@jm/app-runtime';
import { parseShow, parseShowDeepLink } from '@jm/show';
```
Nachher:
```ts
import {
  initAppRuntime,
  getLog,
  folgeMasterShow,
  imVerbundmodus,
  nichtAngewendet,
  verbundDatenErsetzt,
  verbundIgnoriert,
  verbundKopplung,
  type MasterStand,
} from '@jm/app-runtime';
import { parseShow, parseShowDeepLink, type Show } from '@jm/show';
```
Ersetzung 2 (Import aus `@shared/datenquelle`, Stand nach C15), Vorher:
```ts
  istMasterForm,
  logNachMerken,
  zeigtShow,
```
Nachher:
```ts
  istMasterForm,
  logNachMerken,
  ordnerPatchAbgelehnt,
  ordnerWahlGesperrt,
  verbundEndetFuer,
  zeigtShow,
```

- [ ] **Step 2: Main — Status mit gesperrter Ordnerwahl** (`uebernimmDataState`), Vorher:
```ts
  const eigener = eigenerOrdner(getConfig().dataFolder, iveoDataDir(userDataDir()), path.resolve);
  status.datenQuelle = {
    art: quelle.art,
    zeile: quellZeile(quelle, eigener, d.entries.length),
    zurueckKnopf: zurueckKnopf(quelle, eigener),
    ohneOrdner: quelle.art === 'ordner' && !eigener,
  };
```
Nachher:
```ts
  const eigener = eigenerOrdner(getConfig().dataFolder, iveoDataDir(userDataDir()), path.resolve);
  const gesperrt = ordnerWahlGesperrt(quelle);
  status.datenQuelle = {
    art: quelle.art,
    zeile: quellZeile(quelle, eigener, d.entries.length),
    zurueckKnopf: zurueckKnopf(quelle, eigener),
    ohneOrdner: quelle.art === 'ordner' && !eigener,
    ...(gesperrt ? { ordnerGesperrt: gesperrt } : {}),
  };
```
(`wendeQuellSchrittAn` startet nach jedem Schritt `refreshDataWatch`; dessen erster Rückruf ruft `uebernimmDataState`. Damit steht die Sperre nach jedem Quellwechsel im Status.)

- [ ] **Step 3: Main — eigene Show ersetzt Master-Daten, Stand vom Master anwenden** (Ende von `oeffneShow`), Vorher:
```ts
  currentShowPath = pfad;
  let s = quellSchritt(quelle, ereignis);
  if (s.tsv) {
    // Die TSV vor dem Übernehmen schreiben: Scheitert das, gilt der Schritt nicht (Befund 4) — sonst nennte die
    // Quellzeile die neue Show über der Liste der vorigen. Die Show zählt dann wie nicht lesbar (H4 bei Art show).
    const fehler = schreibeSpeakersTsvSicher(iveoData, s.tsv);
    if (fehler) {
      getLog().error(`iveo: speakers.tsv konnte nicht geschrieben werden: ${fehler.meldung}`);
      s = tsvNichtGeschrieben(quelle, s, { weg, pfad, grund: fehler.grund, gemerkt: gemerktePfadShow(userData), mitEigenemOrdner });
    } else {
      getLog().info(`iveo: ${s.tsv.length} Speaker aus Show in den DataLink übernommen.`);
    }
  }
  return wendeQuellSchrittAn(s);
}
```
Nachher:
```ts
  currentShowPath = pfad;
  let s = quellSchritt(quelle, ereignis);
  let angewendet = ereignis.t === 'gelesen';
  if (s.tsv) {
    // Die TSV vor dem Übernehmen schreiben: Scheitert das, gilt der Schritt nicht (Befund 4) — sonst nennte die
    // Quellzeile die neue Show über der Liste der vorigen. Die Show zählt dann wie nicht lesbar (H4 bei Art show).
    const fehler = schreibeSpeakersTsvSicher(iveoData, s.tsv);
    if (fehler) {
      getLog().error(`iveo: speakers.tsv konnte nicht geschrieben werden: ${fehler.meldung}`);
      s = tsvNichtGeschrieben(quelle, s, { weg, pfad, grund: fehler.grund, gemerkt: gemerktePfadShow(userData), mitEigenemOrdner });
      angewendet = false;
    } else {
      getLog().info(`iveo: ${s.tsv.length} Speaker aus Show in den DataLink übernommen.`);
    }
  }
  const schritt = wendeQuellSchrittAn(s);
  // Eine eigene Show ersetzt die Daten eines früheren Masters (Spec 16.1, E16): Zwischenspeicher weg.
  if (angewendet) verbundDatenErsetzt();
  return schritt;
}

/**
 * Stand vom Master anwenden (Spec 17.2): wie eine gelesene Show, nur mit dem Show-Objekt statt
 * des Pfads. Ob es dieselbe Show ist, entscheidet `quellSchritt` (E21). Ist die `speakers.tsv`
 * nicht schreibbar, bleiben Quelle und Liste mit H4 stehen, und die Funktion wirft
 * `nichtAngewendet(⟨Fehlercode⟩)`: app-runtime zeigt V12 „Show vom Master nicht übernommen: ⟨Fehlercode⟩“
 * und versucht es bis zu fünfmal im Abstand von 1 s erneut (Spec 16.2). Ein einfaches Error
 * zeigte dort nur „Error“ (N3).
 */
function wendeMasterStandAn(stand: MasterStand & { show: Show }): void {
  const iveoData = iveoDataDir(userDataDir());
  const s = quellSchritt(quelle, {
    t: 'masterStand',
    masterId: stand.masterId,
    masterName: stand.masterName,
    schluessel: stand.schluessel,
    show: stand.show,
  });
  if (s.tsv) {
    const fehler = schreibeSpeakersTsvSicher(iveoData, s.tsv);
    if (fehler) {
      getLog().error(`iveo: speakers.tsv konnte nicht geschrieben werden: ${fehler.meldung}`);
      const mitEigenemOrdner = eigenerOrdner(getConfig().dataFolder, iveoData, path.resolve) !== '';
      wendeQuellSchrittAn(tsvNichtGeschrieben(quelle, s, { weg: 'reload', pfad: '', grund: fehler.grund, gemerkt: null, mitEigenemOrdner }));
      throw nichtAngewendet(fehler.grund);
    }
    getLog().info(`iveo: ${s.tsv.length} Speaker aus Show in den DataLink übernommen.`);
  }
  wendeQuellSchrittAn(s);
}
```

- [ ] **Step 4: Main — Deep-Link und RELOAD im Verbundmodus**, Vorher:
```ts
  if (!datenquelleGestartet) {
    wartenderDeepLink = url; // starteDatenquelle holt ihn nach
    return;
  }
  const schritt = oeffneShow(showPath, 'deepLink');
  // C3: die referenzierte Bauchbinden-Vorlage nur beim Deep-Link öffnen (Spec 7.7).
  if (schritt.vorlage) void openShowDocument(showPath);
}

/** Aktuelle Show neu einlesen (Launcher schickt `TITLER RELOAD` nach iveo-Update). */
function reloadCurrentShow(): boolean {
  if (!currentShowPath) {
```
Nachher:
```ts
  if (!datenquelleGestartet) {
    wartenderDeepLink = url; // starteDatenquelle holt ihn nach
    return;
  }
  // Im Verbundmodus liefert ein Show-Deep-Link nur Dokumente (Spec 16.1, 17.2): nur die Vorlage (C3).
  if (imVerbundmodus()) {
    verbundIgnoriert('deeplink', showPath);
    void openShowDocument(showPath);
    return;
  }
  const schritt = oeffneShow(showPath, 'deepLink');
  // C3: die referenzierte Bauchbinden-Vorlage nur beim Deep-Link öffnen (Spec 7.7).
  if (schritt.vorlage) void openShowDocument(showPath);
}

/** Aktuelle Show neu einlesen (Launcher schickt `TITLER RELOAD` nach iveo-Update). */
function reloadCurrentShow(): boolean {
  // Im Verbundmodus kommen die Show-Daten vom Master (Spec 16.1).
  if (imVerbundmodus()) {
    verbundIgnoriert('reload');
    return false;
  }
  if (!currentShowPath) {
```

- [ ] **Step 5: Main — Ordnerwahl, Ende des Verbunds, Start** (`eigenerOrdnerGilt` und `starteDatenquelle` im Stand nach C15), Vorher:
```ts
function eigenerOrdnerGilt(t: 'ordnerGewaehlt' | 'zurueckZumOrdner'): void {
  currentShowPath = null; // gemerkte Show wird gelöscht → ein späteres RELOAD warnt wie früher
  wendeQuellSchrittAn(quellSchritt(quelle, { t }));
}

/**
 * Start der Datenquelle (Spec 7.7): Übergang für ein von einer Show gesetztes iveo-data,
 * gemerkte Show lesen, dann Deep-Link oder — ohne Deep-Link — die gemerkte Show anwenden.
 */
function starteDatenquelle(deepLink: string | null): void {
  const userData = userDataDir();
  const gemerkt = leseGemerkteShow(userData);
  const ue = uebergang(getConfig().dataFolder, iveoDataDir(userData), gemerkt, path.resolve);
  for (const zeile of ue.log) getLog().info(zeile);
  if (ue.dataFolderLeeren) {
    patchConfig({ dataFolder: '' });
    broadcastConfig();
  }
  quelle = startZustand(gemerkt, ue.frueher);
  // Die gemerkte Show ist die verbundene Show: Ziel von RELOAD und Vergleich „dieselbe Show“.
  // Die Master-Form (Spec 17.2) hat keinen Pfad: kein RELOAD-Ziel, nichts zu lesen.
  const gemerktPfad = istMasterForm(gemerkt) ? null : gemerkt;
  currentShowPath = gemerktPfad?.showPfad ?? null;
  datenquelleGestartet = true;
  const link = deepLink ?? wartenderDeepLink;
  wartenderDeepLink = null;
  if (link && parseShowDeepLink(link)) applyShowFromDeepLink(link);
  else if (gemerktPfad) oeffneShow(gemerktPfad.showPfad, 'start');
  else refreshDataWatch();
}
```
Nachher:
```ts
function eigenerOrdnerGilt(t: 'ordnerGewaehlt' | 'zurueckZumOrdner'): void {
  currentShowPath = null; // gemerkte Show wird gelöscht → ein späteres RELOAD warnt wie früher
  wendeQuellSchrittAn(quellSchritt(quelle, { t }));
  // Außerhalb des Verbunds wählt der Bediener damit auch die Daten eines früheren Masters ab:
  // ein Neustart soll sie nicht aus dem Zwischenspeicher zurückholen (Ergänzung zu E16).
  if (!imVerbundmodus()) verbundDatenErsetzt();
}

/**
 * Bei Quelle master (Spec 17.2, O1) ist die Ordnerwahl gesperrt — auch im Main (E22). true = abgelehnt, mit Warnung.
 * `gesperrt` ist der Text aus 17.2 oder null; ohne Angabe gilt `ordnerWahlGesperrt(quelle)` (Dialog, Knopf K1).
 */
function ordnerWahlAbgelehnt(gesperrt: string | null = ordnerWahlGesperrt(quelle)): boolean {
  if (!gesperrt) return false;
  getLog().warn(`DataLink: Ordnerwahl abgelehnt. ${gesperrt}`);
  return true;
}

/**
 * Ende des Verbundmodus (Spec 16.1): Quelle master → frueher (17.2). app-runtime meldet `frueher`, ohne angewendeten
 * Stand aber `einzelplatz` bzw. `datei-defekt`; die reine Regel `verbundEndetFuer` kennt alle drei (N8).
 */
function beiVerbundWechsel(art: string): void {
  if (verbundEndetFuer(quelle, art)) wendeQuellSchrittAn(quellSchritt(quelle, { t: 'verbundEnde' }));
}

/**
 * Start der Datenquelle (Spec 7.7, 17.2): Übergang für ein von einer Show gesetztes iveo-data,
 * gemerkte Show lesen, ohne Deep-Link die gemerkte Show anwenden. Danach dem Master folgen
 * (E17: erst jetzt; ein Zwischenspeicher wird dabei angewendet) und erst dann den Deep-Link:
 * im Verbundmodus liefert er nur die Vorlage (Spec 16.1, 16.3 „sofort Verbundmodus“).
 */
function starteDatenquelle(deepLink: string | null): void {
  const userData = userDataDir();
  const gemerkt = leseGemerkteShow(userData);
  const ue = uebergang(getConfig().dataFolder, iveoDataDir(userData), gemerkt, path.resolve);
  for (const zeile of ue.log) getLog().info(zeile);
  if (ue.dataFolderLeeren) {
    patchConfig({ dataFolder: '' });
    broadcastConfig();
  }
  const kopplung = verbundKopplung();
  const gekoppelterMaster = kopplung?.rolle === 'slave' ? kopplung.masterId : null;
  quelle = startZustand(gemerkt, ue.frueher, gekoppelterMaster);
  // Die Master-Form kennt den Namen des Masters nicht; bis zum ersten Stand gilt der aus der Kopplung (Text O1).
  if (quelle.master && !quelle.master.masterName && kopplung?.masterName && kopplung.masterId === quelle.master.masterId) {
    quelle = { ...quelle, master: { ...quelle.master, masterName: kopplung.masterName } };
  }
  // Die gemerkte Show ist die verbundene Show: Ziel von RELOAD und Vergleich „dieselbe Show“.
  // Die Master-Form (Spec 17.2) hat keinen Pfad: kein RELOAD-Ziel, nichts zu lesen.
  const gemerktPfad = istMasterForm(gemerkt) ? null : gemerkt;
  currentShowPath = gemerktPfad?.showPfad ?? null;
  datenquelleGestartet = true;
  const link = deepLink ?? wartenderDeepLink;
  wartenderDeepLink = null;
  const showLink = link && parseShowDeepLink(link) ? link : null;
  if (!showLink) {
    if (gemerktPfad) oeffneShow(gemerktPfad.showPfad, 'start');
    else refreshDataWatch();
  }
  folgeMasterShow({
    anwenden: (stand) => wendeMasterStandAn(stand),
    beiWechsel: (d) => beiVerbundWechsel(d.art),
  });
  if (showLink) applyShowFromDeepLink(showLink);
}
```

- [ ] **Step 6: Main — Sperre in den drei IPC-Wegen (E22)**

Ersetzung 1 (`titler:setConfig`), Vorher:
```ts
  ipcMain.handle('titler:setConfig', (_e, patch: PartialTitlerConfig) => {
    const before = getConfig().dataFolder;
    patchConfig(patch);
```
Nachher:
```ts
  ipcMain.handle('titler:setConfig', (_e, patch: PartialTitlerConfig) => {
    const before = getConfig().dataFolder;
    // E22: Bei Quelle master bleibt der Ordner, wie er ist — auch ohne Dialog (Config-Patch). Der Rest gilt.
    // Die Regel ist rein und in C15 getestet (ordnerPatchAbgelehnt).
    if (ordnerWahlAbgelehnt(ordnerPatchAbgelehnt(patch.dataFolder, before, quelle))) {
      patch = { ...patch };
      delete patch.dataFolder;
    }
    patchConfig(patch);
```
(Danach prüft die bestehende Zeile `if (patch.dataFolder !== undefined && patch.dataFolder !== before) eigenerOrdnerGilt('ordnerGewaehlt');` den bereinigten Patch und tut nichts.)

Ersetzung 2 (`titler:pickDataFolder`), Vorher:
```ts
  ipcMain.handle('titler:pickDataFolder', async () => {
    const r = await dialog.showOpenDialog({
```
Nachher:
```ts
  ipcMain.handle('titler:pickDataFolder', async () => {
    if (ordnerWahlAbgelehnt()) return ''; // E22: wie „abgebrochen“
    const r = await dialog.showOpenDialog({
```

Ersetzung 3 (`titler:zurueckZumOrdner`), Vorher:
```ts
  ipcMain.handle('titler:zurueckZumOrdner', () => eigenerOrdnerGilt('zurueckZumOrdner'));
```
Nachher:
```ts
  ipcMain.handle('titler:zurueckZumOrdner', () => {
    if (!ordnerWahlAbgelehnt()) eigenerOrdnerGilt('zurueckZumOrdner'); // E22
  });
```

- [ ] **Step 7: Typen** (`apps/titler/src/shared/types.ts`, E28)

Ersetzung 1 (Zeilen 175–177), Vorher:
```ts
  /** Datenquelle des DataLink (Spec 7.7): Art, Zeile Q1–Q3, Knopf K1, „Kein Datenordner aktiv“. */
  datenQuelle: { art: DatenQuelleArt; zeile: string; zurueckKnopf: string | null; ohneOrdner: boolean };
}
```
Nachher:
```ts
  /**
   * Datenquelle des DataLink (Spec 7.7, 17.2): Art, Zeile Q1–Q4, Knopf K1, „Kein Datenordner aktiv“.
   * `ordnerGesperrt`: Text, wenn die Ordnerwahl im Verbund gesperrt ist (Quelle master, Owner O1).
   */
  datenQuelle: { art: DatenQuelleArt; zeile: string; zurueckKnopf: string | null; ohneOrdner: boolean; ordnerGesperrt?: string };
}

/**
 * Verbund-Anzeige über die Preload-Brücke (Master-Link Teil 2b, Spec 16.4/16.5). Strukturgleich mit
 * `VerbundAnzeige` aus `@jm/app-runtime`; eigener Typ, damit die Renderer-Typprüfung app-runtime
 * (Electron-Typen) nicht einliest (E28).
 */
export interface VerbundAnzeigeZeile {
  text: string;
  farbe: 'gruen' | 'gelb' | 'rot' | 'gedaempft';
}
```
Ersetzung 2 (Ende von `JmtitlerApi`, Zeilen 312–314), Vorher:
```ts
  /** Datei-Systempfad eines gedroppten File-Objekts ermitteln (webUtils). */
  pathForFile: (file: File) => string;
}
```
Nachher:
```ts
  /** Datei-Systempfad eines gedroppten File-Objekts ermitteln (webUtils). */
  pathForFile: (file: File) => string;
  /** Verbund-Anzeige (Spec 16.4/16.5): V-Zeile oder null (Einzelplatz). */
  verbundAnzeige: () => Promise<VerbundAnzeigeZeile | null>;
  /** Auf Wechsel der Verbund-Anzeige hören. Liefert Unsubscribe. */
  onVerbundAnzeige: (cb: (a: VerbundAnzeigeZeile | null) => void) => () => void;
}
```

- [ ] **Step 8: Preload** (`apps/titler/src/preload/index.ts`)

Ersetzung 1 (Zeilen 12–14), Vorher:
```ts
  TitlerStatus,
  TitlerTemplateAddRequest,
} from '@shared/types';
```
Nachher:
```ts
  TitlerStatus,
  TitlerTemplateAddRequest,
  VerbundAnzeigeZeile,
} from '@shared/types';
```
Ersetzung 2 (Zeilen 87–88), Vorher:
```ts
  pathForFile: (file: File) => webUtils.getPathForFile(file),
};
```
Nachher:
```ts
  pathForFile: (file: File) => webUtils.getPathForFile(file),
  verbundAnzeige: () => (ipcRenderer.invoke('jmps:verbund-anzeige') as Promise<VerbundAnzeigeZeile | null>).catch(() => null),
  onVerbundAnzeige: (cb) => {
    const listener = (_e: unknown, a: VerbundAnzeigeZeile | null): void => cb(a);
    ipcRenderer.on('jmps:verbund-anzeige', listener);
    return () => ipcRenderer.off('jmps:verbund-anzeige', listener);
  },
};
```

- [ ] **Step 9: Oberfläche** (`apps/titler/src/renderer/src/views/OperatorView.tsx`)

Ersetzung 1 (Zeilen 7–9), Vorher:
```tsx
  type TemplateKind,
  type TitlerConfig,
} from '@shared/types';
```
Nachher:
```tsx
  type TemplateKind,
  type TitlerConfig,
  type VerbundAnzeigeZeile,
} from '@shared/types';
```
Ersetzung 2 (Zeile 242), Vorher:
```tsx
  const iveoActive = datenQuelle?.art === 'show';
```
Nachher:
```tsx
  const iveoActive = datenQuelle?.art === 'show' || datenQuelle?.art === 'master';
  // Ordnerwahl im Verbund gesperrt (Spec 17.2, Owner O1): Text statt Auswahl; der Main lehnt ebenfalls ab.
  const ordnerGesperrt = datenQuelle?.ordnerGesperrt;
```
Ersetzung 3 (Abzeichen vor „Suite · ⟨n⟩ verbunden“, Zeilen 254–257), Vorher:
```tsx
        <span
          className={cn(
            'ml-auto inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] font-extrabold border',
            suiteClients > 0
```
Nachher:
```tsx
        <VerbundAbzeichen />
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] font-extrabold border',
            suiteClients > 0
```
Ersetzung 4 (Einstellungen › DataLink, Zeilen 616–627), Vorher:
```tsx
                  <div className="flex gap-2">
                    <input
                      value={c.dataFolder}
                      onChange={(e) => void setConfig({ dataFolder: e.target.value })}
                      placeholder="Kein Ordner gewählt"
                      spellCheck={false}
                      className="h-9 flex-1 min-w-0 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-xs"
                    />
                    <Button variant="outline" size="sm" onClick={() => void pickFolder()}>
                      Durchsuchen…
                    </Button>
                    {c.dataFolder ? (
```
Nachher:
```tsx
                  <div className="flex gap-2">
                    <input
                      value={c.dataFolder}
                      onChange={(e) => void setConfig({ dataFolder: e.target.value })}
                      placeholder="Kein Ordner gewählt"
                      spellCheck={false}
                      disabled={!!ordnerGesperrt}
                      className="h-9 flex-1 min-w-0 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-xs disabled:opacity-50"
                    />
                    <Button variant="outline" size="sm" onClick={() => void pickFolder()} disabled={!!ordnerGesperrt}>
                      Durchsuchen…
                    </Button>
                    {c.dataFolder && !ordnerGesperrt ? (
```
Ersetzung 5 (Zeile 633), Vorher:
```tsx
                  {/* K1 (Spec 7.7/7.8): nur bei Quelle Show und einem eigenen Ordner, der nicht iveo-data ist */}
```
Nachher:
```tsx
                  {ordnerGesperrt ? (
                    <p className="text-[11px] text-[var(--muted-foreground)]">{ordnerGesperrt}</p>
                  ) : null}
                  {/* K1 (Spec 7.7/7.8): nur bei Quelle Show und einem eigenen Ordner, der nicht iveo-data ist */}
```
Ersetzung 6 (Dateiende, Zeilen 867–871), Vorher:
```tsx
        className="w-full accent-[var(--primary)]"
      />
    </label>
  );
}
```
Nachher:
```tsx
        className="w-full accent-[var(--primary)]"
      />
    </label>
  );
}

const VERBUND_FARBE: Record<VerbundAnzeigeZeile['farbe'], string> = {
  gruen: 'border-[var(--success)]/50 text-[var(--success)]',
  gelb: 'border-[var(--warning)]/60 text-[var(--warning)]',
  rot: 'border-[var(--destructive)]/60 text-[var(--destructive)]',
  gedaempft: 'border-[var(--border)] text-[var(--muted-foreground)]',
};

/**
 * Verbund-Anzeige vor „Suite · ⟨n⟩ verbunden“ (Master-Link Teil 2b, Spec 16.4/16.5): die V-Zeile aus
 * app-runtime, gekürzt mit „…“, voller Text als Tooltip. Trägt den Abstand nach links (`ml-auto`), auch
 * am Einzelplatz (dann leer).
 */
function VerbundAbzeichen(): React.JSX.Element {
  const [anzeige, setAnzeige] = useState<VerbundAnzeigeZeile | null>(null);
  useEffect(() => {
    void window.jmtitler.verbundAnzeige().then(setAnzeige);
    return window.jmtitler.onVerbundAnzeige(setAnzeige);
  }, []);
  if (!anzeige) return <span className="ml-auto" aria-hidden />;
  return (
    <span
      className={cn('ml-auto inline-flex max-w-[24rem] items-center rounded border px-2 py-0.5 text-[11px] font-semibold', VERBUND_FARBE[anzeige.farbe])}
      title={anzeige.text}
    >
      <span className="truncate">{anzeige.text}</span>
    </span>
  );
}
```
(`useState`, `useEffect`, `cn` sind in der Datei schon importiert; `Button` reicht `disabled` an `<button>` durch, `packages/ui/src/components/Button.tsx:35-45`.)

- [ ] **Step 10: Typecheck, Selbsttest, Build**

```
npm run typecheck -w @jm/titler
npm run selftest -w @jm/titler 2>&1 | grep -c "^ok "
npm run build -w @jm/titler
grep -c "jmps:verbund-anzeige" apps/titler/out/preload/index.cjs
grep -c "folgeMasterShow(" apps/titler/src/main/index.ts
```
Erwartet: Typecheck node und web ohne Meldung, Exitcode 0; `477` (unverändert); `electron-vite build` dreimal `✓ built in …`, Exitcode 0; `3` (invoke, on, off); `1` (genau eine Registrierung).

- [ ] **Step 11: Commit** (Git Bash, Commit-Text ohne Umlaute)

```
git add apps/titler/src/main/index.ts apps/titler/src/shared/types.ts apps/titler/src/preload/index.ts apps/titler/src/renderer/src/views/OperatorView.tsx
git status --short
```
Erwartet genau:
```
M  apps/titler/src/main/index.ts
M  apps/titler/src/preload/index.ts
M  apps/titler/src/renderer/src/views/OperatorView.tsx
M  apps/titler/src/shared/types.ts
```
Dann:
```
git commit -m "feat(titler): dem Master folgen, Ordnerwahl im Verbund gesperrt, Verbund-Abzeichen (Teil 2b R2, C16)" -m "folgeMasterShow nach dem Start der Datenquelle: Stand vom Master wird ueber quellSchritt angewendet, eine nicht schreibbare TSV laesst Quelle und Liste mit H4 stehen und wirft nichtAngewendet mit dem Fehlercode (app-runtime zeigt V12 und versucht es erneut). frueher, einzelplatz und datei-defekt beenden die Quelle master (verbundEndetFuer). Im Verbundmodus liefert ein Show-Deep-Link nur die Vorlage, RELOAD wird ignoriert; ein Deep-Link beim Start kommt erst nach der Registrierung. Eigene Show, Ordnerwahl und Knopf ausserhalb des Verbunds rufen verbundDatenErsetzt. Bei Quelle master lehnen pickDataFolder, setConfig.dataFolder (ordnerPatchAbgelehnt) und zurueckZumOrdner ab (E22). Abzeichen vor Suite, Einstellungen zeigen den Sperrtext." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- **Deep-Link beim Start nach der Registrierung.** E17 sagt nur „Titler registriert nach `starteDatenquelle`“. Liefe der Start-Deep-Link vor der Registrierung, wäre `imVerbundmodus()` noch falsch (der Zwischenspeicher ist erst beim Registrieren angewendet), die lokale Show würde angewendet und `verbundDatenErsetzt()` löschte den Zwischenspeicher. Das widerspräche 16.3 („beim Start … sofort Verbundmodus“) und 17.2 („Deep-Link im Verbundmodus: nur die Vorlage“). Die Registrierung liegt deshalb in `starteDatenquelle` zwischen „gemerkte Show/Datenordner“ und „Deep-Link“. Am Einzelplatz bleibt alles wie bisher (der Deep-Link ersetzt die gemerkte Show; ohne Zwischenspeicher tut die Registrierung nichts).
- **Ergänzung zu E16** (E56; Owner-Frage 5, vom Owner am 08.10.2026 geschlossen): Ordnerwahl und Knopf K1 außerhalb des Verbundmodus rufen ebenfalls `verbundDatenErsetzt()`. Ohne das holte ein Neustart nach „entkoppelt, dann eigener Ordner gewählt“ die Speaker des früheren Masters aus dem Zwischenspeicher zurück (C12: der Zwischenspeicher wird beim Start immer angewendet) und verdrängte den gewählten Ordner. Im Verbundmodus (Quelle `ordner`, weil die Master-Show keine Speaker hat) bleibt der Zwischenspeicher.
- **Name des Masters beim Start** aus `verbundKopplung().masterName`: Die Master-Form der gemerkten Show trägt nach Register keinen Namen; der Sperrtext (O1) braucht ihn, bevor der erste Stand kommt.
- **Neuer Logtext ohne Spec-Vorgabe (für E13, Owner-Freigabe vor dem Release):** „DataLink: Ordnerwahl abgelehnt. ⟨Text aus 17.2⟩“. Der Text aus 17.2 selbst ist wörtlich.
- **Grund für V12** beim Wurf: `nichtAngewendet(⟨Fehlercode⟩)`, V12 also „Show vom Master nicht übernommen: ⟨Fehlercode⟩“ (N3). Die frühere Fassung warf `new Error('speakers.tsv nicht schreibbar: …')`; der Folger nimmt aber nur `err.code` oder den Fehlertyp (E49, G6), V12 hätte „…: Error“ gezeigt. Den Zusammenhang mit der TSV zeigt H4 in der Quellzeile.
- **Ende des Verbunds über `verbundEndetFuer`** (N8): auch `einzelplatz` und `datei-defekt` beenden die Quelle `master`, nicht nur `frueher`.
- **Sperre im Main über `ordnerPatchAbgelehnt`** (N17): `titler:setConfig` nimmt die Regel aus C15; `ordnerWahlAbgelehnt(gesperrt)` schreibt die Warnung für alle drei Wege an einer Stelle.
- `apps/titler/src/renderer/src/jmtitler.d.ts` bleibt unverändert (die Brücke kommt über `JmtitlerApi`).

**Nachgerechnet** (beim Durchspielen des ganzen Plans, mit C11–C13 aus diesem Plan): Typecheck node und web grün, Selbsttest `477`, „ALLE TESTS OK“, `electron-vite build` grün, Preload-Zählung `3`, `folgeMasterShow(` einmal, im gebauten Main `Ordnerwahl abgelehnt` genau einmal. Was davon zur Laufzeit C20 prüft und was nur die Abnahme, steht oben unter „Regeln“.

---

### Task 17: C17 · Rundown rein: Gedächtnis und Zeiger mit Master-Schlüssel, `ausShow`, `waehleLauncher`, neu oder gleich

**Spec:** 17.3 (Gedächtnis-Teil: eine Schlüsselfunktion, Inhalt mit `quelle: 'master'`, Zeiger, Übergang, stehender Hinweis; „Show-Deep-Link | Daten ignoriert“), 17.4 (Tabelle), 19.5 (Rundown); #235. Entscheidungen E15, E24, E25.

**Arbeitsverzeichnis:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b-r2`, Branch `feat/master-link-teil2b-r2`. Voraussetzung: C16 ist committet (fachlich unabhängig).

**Dateien:**
- Modify: `apps/rundown/src/shared/ausgangsstand.ts:17-28` (`GedaechtnisInhalt` + Felder; neu `GedaechtnisQuelle`, `Zeiger`)
- Modify: `apps/rundown/src/main/gedaechtnis.ts`: `:25` (Import, Re-Export), `:83-87` (`gedaechtnisSchluesselFuer`, `quelleVon`), `:97-112` (`pruefeGedaechtnis`), `:140-144` (`schreibeGedaechtnis`), `:176-196` (`leseZeiger`, `schreibeZeiger`), `:247-256` (`leseShowSicher` → `ausShow`)
- Modify: `apps/rundown/src/shared/conductor.ts:5` (Import), neuer Abschnitt vor `buildActionLine` (`:26`)
- Modify (nur Typ-Brücke): `apps/rundown/src/main/index.ts:812-814` (`starteOhneDeepLink` übergeht den Master-Zeiger bis C18)
- Test: `apps/rundown/test/gedaechtnis.test.ts`: Importe `:5-22`, neuer Block vor `// ── dateiStand (4.8)` (`:246`)
- Test: `apps/rundown/test/selftest.ts`: Import nach `:3`, neuer Block vor `console.log(failed === 0 …` (`:1876`)

**Interfaces:**
- Consumes: bestehend `gedaechtnisSchluessel`, `ersatzSchluessel`, `hatEigeneTimerListe`, `migrateShow`, `Endpoint` (`src/shared/types.ts`).
- Produces (S-D, exakt; C18 baut darauf):
  ```ts
  // apps/rundown/src/shared/ausgangsstand.ts (definiert), apps/rundown/src/main/gedaechtnis.ts (re-exportiert)
  export type GedaechtnisQuelle = { art: 'pfad'; showPfad: string } | { art: 'master'; masterId: string; schluessel: string };
  export type Zeiger = { showPfad: string; schluessel: string }
    | { quelle: 'master'; masterId: string; masterSchluessel: string; showName: string; schluessel: string };
  // GedaechtnisInhalt + quelle?: 'master'; masterId?: string; masterSchluessel?: string
  // apps/rundown/src/main/gedaechtnis.ts
  export function gedaechtnisSchluesselFuer(q: GedaechtnisQuelle): string;   // master: sha256("master|"+masterId+"|"+schluessel), 16 Hex
  export function leseZeiger(ordner: string): Zeiger | null;
  export function schreibeZeiger(ordner: string, z: Zeiger): boolean;
  export function ausShow(show: Show): Extract<ShowGelesen, { ok: true }>;
  // apps/rundown/src/shared/conductor.ts
  export interface KopplungFuerWahl { rolle: 'aus' | 'master' | 'slave'; masterAdresse: string | null; adressen: string[]; letzteAdresse: string | null }
  export function waehleLauncher(funde: readonly Endpoint[], kopplung: KopplungFuerWahl | null, istHier: (host: string) => boolean): Endpoint | null;
  export function entscheideMasterStand(zeiger: Zeiger | null, stand: { masterId: string; schluessel: string | null }): 'gleich' | 'neu';
  export const HINWEIS_RUNDOWN_DATEI_AM_MASTER: string;   // Text 17.3 wörtlich
  export function mitRundownDokument(mitDokument: readonly string[]): boolean;   // zusätzlich
  export function gleicherShowName(docName: string, showName: string): boolean;  // E25
  // zusätzlich (N9): die Entscheidungen der Ladewege aus C18 als reine Funktionen, hier getestet
  export function dokumentHinweis(vorher: string | null, stand: { masterId: string; mitDokument: readonly string[] }, masterSchluessel: string): { fuer: string | null; zeigen: boolean };
  export type MasterAusgang = 'gedaechtnis' | 'uebergang' | 'leer' | 'bleibt';
  export function masterAusgang(o: { mitGedaechtnis: boolean; ablaufLeer: boolean; docName: string; showName: string }): MasterAusgang;
  // zusätzlich (N15): Show-Deep-Link im Verbundmodus (E24), hier getestet; C18 nutzt es mit kuerzeName
  export function showLinkWeg(imVerbund: boolean, pfad: string, kuerze: (name: string) => string): { weg: 'laden' } | { weg: 'ignorieren'; log: string };
  ```

**Regeln:** G5 (Hinweis wörtlich), G7 (Rundown-`src/shared`: keine `electron`-, `node:`- oder Paket-Laufzeitimporte, zwischen Modulen nur `import type`; `gedaechtnis.ts` liegt in `src/main` und läuft im Test mit dem Endungs-Hook), G11, G12, G16.

**Verhalten (verbindlich):**
- `gedaechtnisSchluesselFuer`: `pfad` → `gedaechtnisSchluessel(showPfad)` (2a, unverändert); `master` → erste 16 Hex-Zeichen von `sha256("master|" + masterId + "|" + schluessel)`.
- `pruefeGedaechtnis`: mit `quelle: 'master'` sind `masterId` (nicht leer) und `masterSchluessel` (16 × `[0-9a-f]`) Pflicht, `showPfad` wird `''`; ohne `quelle` wie 2a (`showPfad` nicht leer); jede andere `quelle` → unlesbar.
- `schreibeGedaechtnis` nimmt den Dateinamen aus `gedaechtnisSchluesselFuer` je nach `quelle` und schreibt **nichts** (Rückgabe `false`), wenn es keine gültige Quelle gibt — weder einen leeren Pfad noch einen Master ohne gültige Kennung (#235).
- Zeiger: Master-Form wird mit `showPfad: ''` geschrieben (ein Rundown 0.6/0.7 verwirft ihn, `leseZeiger` dort verlangt `showPfad`); gelesen nur mit nicht leerer `masterId`, 16-Hex `masterSchluessel` und `schluessel`, `showName` als Text. Pfad-Form unverändert.
- `ausShow(show)`: der reine Teil von `leseShowSicher` (Schlüssel des Ablaufs, eigene Timer-Liste); `leseShowSicher` ruft ihn mit `migrateShow(roh)`.
- `waehleLauncher` nach 17.4: Slave verbunden (`masterAdresse`) → Fund mit dieser Adresse, sonst mit einer aus `adressen`, sonst `{ host: masterAdresse, port: 8736 }`; Slave nicht verbunden → Fund passend zu `letzteAdresse`, sonst `null`; Master → Fund mit `istHier(host)`; Einzelplatz (`null`, Rolle `aus`) → letzter Fund. Adressen vergleicht die Funktion ohne Rücksicht auf Groß/Klein, Klammern, IPv6-Zone und `::ffff:` vor einer IPv4.
- `entscheideMasterStand`: `gleich` genau dann, wenn der Zeiger die Master-Form hat und `masterId` und `masterSchluessel` dem Stand gleichen; ohne Zeiger, mit Pfad-Zeiger oder Schlüssel `null` → `neu`.
- `gleicherShowName`: nach `trim()`, ohne Rücksicht auf Groß/Klein; ein leerer Name gleicht nie.
- `masterAusgang` (N9): Gedächtnis vorhanden → `gedaechtnis`; sonst Show ohne Ablauf → `bleibt` (das Dokument bleibt, 5.2); sonst gleicher Name → `uebergang`, sonst `leer`. C18 `ladeMasterShow` nimmt den Weg daraus.
- `dokumentHinweis` (N9): ohne `jm-rundown` in `mitDokument` → `{ fuer: null, zeigen: false }` (Hinweis weg); sonst `fuer = masterId|masterSchluessel`, `zeigen` genau dann, wenn `fuer` vom vorigen Merker abweicht (einmal je Show). C18 `zeigeDokumentHinweis` nutzt es.
- `showLinkWeg(imVerbund, pfad, kuerze)` (E24, N15): außerhalb des Verbundmodus `{ weg: 'laden' }` (Weg aus 2a); im Verbundmodus `{ weg: 'ignorieren', log }` mit „Verbund: Show-Link „⟨Name⟩“ – der Rundown folgt der Show vom Master und lädt daraus nichts.“, ⟨Name⟩ = letzter Pfadteil (Trenner `\` und `/`) durch `kuerze`. C18 `applyShowFromDeepLink` nutzt es mit `kuerzeName`.

---

- [ ] **Step 1: Fehlschlagende Tests schreiben**

`apps/rundown/test/gedaechtnis.test.ts`, Ersetzung 1 (Zeilen 5–10), Vorher:
```ts
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  dateiStand,
  gedaechtnisSchluessel,
```
Nachher:
```ts
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ausShow,
  dateiStand,
  gedaechtnisSchluessel,
  gedaechtnisSchluesselFuer,
```
Ersetzung 2 (Zeilen 20–22), Vorher:
```ts
  sichereDefektesGedaechtnis,
} from '../src/main/gedaechtnis.ts';
import type { GedaechtnisInhalt } from '../src/shared/ausgangsstand.ts';
```
Nachher:
```ts
  sichereDefektesGedaechtnis,
  type Zeiger,
} from '../src/main/gedaechtnis.ts';
import type { GedaechtnisInhalt } from '../src/shared/ausgangsstand.ts';
```
Ersetzung 3 (Zeilen 246–247), Vorher:
```ts
  // ── dateiStand (4.8) ───────────────────────────────────────────────────────
  const rdPfad = join(tmp, 'eigen.jmrundown');
```
Nachher:
```ts
  // ── Teil 2b R2 · Gedächtnis und Zeiger mit Master-Schlüssel (Spec 17.3, 19.5 Rundown, #235) ──
  const M1 = 'master-1';
  const MS = '0123456789abcdef'; // Schlüssel der Show am Master (13.1)
  eq(gedaechtnisSchluesselFuer({ art: 'pfad', showPfad }), gedaechtnisSchluessel(showPfad), 'R2: gedaechtnisSchluesselFuer pfad = Formel aus 2a');
  const sm = gedaechtnisSchluesselFuer({ art: 'master', masterId: M1, schluessel: MS });
  eq(sm, createHash('sha256').update(`master|${M1}|${MS}`).digest('hex').slice(0, 16), 'R2: master = sha256("master|"+masterId+"|"+schluessel), 16 Hex');
  eq(sm === gedaechtnisSchluesselFuer({ art: 'master', masterId: 'master-2', schluessel: MS }), false, 'R2: anderer Master → anderes Gedächtnis');
  eq(sm === gedaechtnisSchluesselFuer({ art: 'master', masterId: M1, schluessel: 'fedcba9876543210' }), false, 'R2: andere Show am Master → anderes Gedächtnis');

  const mOrdner = join(tmp, 'regie-master');
  const mInhalt: GedaechtnisInhalt = { ...inhalt, showPfad: '', showName: 'Gala', quelle: 'master', masterId: M1, masterSchluessel: MS };
  eq(schreibeGedaechtnis(mOrdner, mInhalt), true, 'R2: Gedächtnis mit quelle master geschrieben');
  eq(readdirSync(mOrdner), [`${sm}.json`], 'R2 #235: Dateiname aus dem Master-Schlüssel, nie aus dem leeren Pfad');
  eq(leseGedaechtnis(mOrdner, sm), { inhalt: mInhalt }, 'R2: Neustart auf B — Gedächtnis mit quelle master gelesen, Aktionen und scharfe Zeile bleiben');
  const kaputteMaster: Array<[string, unknown]> = [
    ['ohne masterId', { ...mInhalt, masterId: undefined }],
    ['mit leerer masterId', { ...mInhalt, masterId: '' }],
    ['mit falschem masterSchluessel', { ...mInhalt, masterSchluessel: 'ABC' }],
    ['mit unbekannter quelle', { ...mInhalt, quelle: 'netz' }],
  ];
  for (const [bez, roh] of kaputteMaster) {
    writeFileSync(join(mOrdner, `${sm}.json`), JSON.stringify(roh));
    eq(leseGedaechtnis(mOrdner, sm), { inhalt: null, fehler: 'unlesbar' }, `R2: Gedächtnis quelle master ${bez} → unlesbar`);
  }
  eq(schreibeGedaechtnis(mOrdner, inhalt), true, 'R2: ohne quelle wie 2a geschrieben');
  eq(leseGedaechtnis(mOrdner, gedaechtnisSchluessel(showPfad)), { inhalt }, 'R2: ohne quelle wie 2a gelesen');
  writeFileSync(join(mOrdner, `${'b'.repeat(16)}.json`), JSON.stringify({ ...inhalt, showPfad: '' }));
  eq(leseGedaechtnis(mOrdner, 'b'.repeat(16)), { inhalt: null, fehler: 'unlesbar' }, 'R2: ohne quelle und ohne showPfad → unlesbar (wie 2a)');
  const dateienVorher = readdirSync(mOrdner).length;
  eq(schreibeGedaechtnis(mOrdner, { ...inhalt, showPfad: '' }), false, 'R2 #235: leerer Pfad ohne quelle → false');
  eq(schreibeGedaechtnis(mOrdner, { ...mInhalt, masterSchluessel: 'kein-hex' }), false, 'R2: quelle master mit ungültigem masterSchluessel → false');
  eq(readdirSync(mOrdner).length, dateienVorher, 'R2 #235: … es entsteht keine Datei');

  const mz: Zeiger = { quelle: 'master', masterId: M1, masterSchluessel: MS, showName: 'Gala', schluessel: sm };
  eq(schreibeZeiger(mOrdner, mz), true, 'R2: Zeiger mit quelle master geschrieben');
  eq(leseZeiger(mOrdner), mz, 'R2: Zeiger mit quelle master gelesen');
  eq(JSON.parse(readFileSync(join(mOrdner, 'zuletzt.json'), 'utf8')).showPfad, '', 'R2: Zeiger master trägt showPfad leer (Rundown 0.7 verwirft ihn)');
  const kaputteZeiger: Array<[string, unknown]> = [
    ['mit leerer masterId', { ...mz, masterId: '', showPfad: '' }],
    ['mit falschem masterSchluessel', { ...mz, masterSchluessel: 'x', showPfad: '' }],
    ['mit falschem schluessel', { ...mz, schluessel: '../../boese', showPfad: '' }],
    ['ohne showName', { quelle: 'master', masterId: M1, masterSchluessel: MS, schluessel: sm, showPfad: '' }],
    ['ohne showPfad und ohne quelle', { schluessel: sm }],
  ];
  for (const [bez, roh] of kaputteZeiger) {
    writeFileSync(join(mOrdner, 'zuletzt.json'), JSON.stringify(roh));
    eq(leseZeiger(mOrdner), null, `R2: Zeiger ${bez} → null`);
  }
  schreibeZeiger(mOrdner, { showPfad, schluessel: s1 });
  eq(leseZeiger(mOrdner), { showPfad, schluessel: s1 }, 'R2: Pfad-Zeiger unverändert');

  // ausShow: der reine Teil von leseShowSicher — für eine Show vom Master ohne Datei.
  const ausDatei = join(tmp, 'Shows', 'Ausshow.jmshow');
  writeFileSync(
    ausDatei,
    JSON.stringify({
      schemaVersion: 1,
      name: 'Gala',
      tools: [{ appId: 'jm-timer', settings: { timetable: [{ label: 'X', durationMs: 1000 }] } }],
      ablauf: [{ id: 'u1', label: 'A' }, { label: 'B' }, { label: 'B' }],
      iveo: { event: 'e1', speakers: [{ id: 's-1', name: 'Ada' }] },
    }),
  );
  const gelesen = leseShowSicher(ausDatei);
  eq(gelesen.ok ? ausShow(gelesen.show) : null, gelesen, 'R2: ausShow liefert dasselbe wie leseShowSicher für dieselbe Show');
  eq(gelesen.ok ? [gelesen.ablaufSchluessel, gelesen.eigeneTimerListe] : null, [['u1', 'ersatz:B', 'ersatz:B#2'], true], 'R2: … Schlüssel und eigene Timer-Liste aus der Show');

  // ── dateiStand (4.8) ───────────────────────────────────────────────────────
  const rdPfad = join(tmp, 'eigen.jmrundown');
```
(`inhalt`, `showPfad`, `s1`, `tmp` stehen am Anfang des `try`-Blocks; der Ordner `Shows` entsteht im Block „Review-Focus 1“ davor.)

`apps/rundown/test/selftest.ts`, Ersetzung 1 (Zeile 3), Vorher:
```ts
import { buildActionLine, clampIndex, mergeEndpoints, navigate } from '../src/shared/conductor.ts';
```
Nachher:
```ts
import { buildActionLine, clampIndex, mergeEndpoints, navigate } from '../src/shared/conductor.ts';
import {
  dokumentHinweis,
  entscheideMasterStand,
  gleicherShowName,
  HINWEIS_RUNDOWN_DATEI_AM_MASTER,
  masterAusgang,
  mitRundownDokument,
  showLinkWeg,
  waehleLauncher,
  type KopplungFuerWahl,
} from '../src/shared/conductor.ts';
```
Ersetzung 2 (Dateiende, Zeilen 1872–1876), Vorher:
```ts
    'Review Focus 3: ein Titler ohne bekannte Fähigkeit bekommt die @-Form nie',
  );
}

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```
Nachher:
```ts
    'Review Focus 3: ein Titler ohne bekannte Fähigkeit bekommt die @-Form nie',
  );
}

// ── Teil 2b R2 · Rundown im Verbund: Launcher-Wahl (17.4), neu oder gleich, Übergang, Hinweis (17.3) ──
{
  const A = { host: '10.0.0.5', port: 8736 }; // Launcher am Master
  const B = { host: '10.0.0.7', port: 8736 }; // eigener Launcher auf B (dieser Rechner)
  const C = { host: 'regie-c', port: 8736 }; // dritter Launcher, per Hostname gefunden
  const hier = (h: string): boolean => h === '10.0.0.7';
  const k = (o: Partial<KopplungFuerWahl>): KopplungFuerWahl => ({ rolle: 'slave', masterAdresse: null, adressen: [], letzteAdresse: null, ...o });

  // Rolle Slave, verbunden: Fund mit masterAdresse oder einer Adresse aus „angemeldet“, sonst direkt :8736.
  eq(waehleLauncher([B, A], k({ masterAdresse: '10.0.0.5' }), hier), A, '17.4 Slave verbunden: Fund mit masterAdresse, nicht der letzte Fund');
  eq(
    waehleLauncher([A, B], k({ masterAdresse: '192.168.1.5', adressen: ['10.0.0.5', '192.168.1.5'] }), hier),
    A,
    '17.4 Slave verbunden: Fund mit einer Adresse aus kopplung.adressen',
  );
  eq(waehleLauncher([B], k({ masterAdresse: '10.0.0.5' }), hier), { host: '10.0.0.5', port: 8736 }, '17.4 Slave verbunden, kein passender Fund → masterAdresse mit Port 8736');
  eq(waehleLauncher([], k({ masterAdresse: '10.0.0.5' }), hier), { host: '10.0.0.5', port: 8736 }, '17.4 Slave verbunden, keine Funde → masterAdresse mit Port 8736');
  eq(
    waehleLauncher([B, { host: '::ffff:10.0.0.5', port: 9000 }], k({ masterAdresse: '10.0.0.5' }), hier),
    { host: '::ffff:10.0.0.5', port: 9000 },
    '17.4 Slave verbunden: ::ffff:-Form ist dieselbe Adresse, der Fund behält seinen Port',
  );
  // Rolle Slave, nicht verbunden: nur ein Fund passend zu letzteAdresse.
  eq(waehleLauncher([B, A], k({ letzteAdresse: '10.0.0.5' }), hier), A, '17.4 Slave nicht verbunden: Fund passend zu letzteAdresse');
  eq(waehleLauncher([B, C], k({ letzteAdresse: '10.0.0.5' }), hier), null, '17.4 Slave nicht verbunden, kein passender Fund → keiner');
  eq(waehleLauncher([B, A], k({}), hier), null, '17.4 Slave nicht verbunden, ohne letzteAdresse → keiner');
  // Rolle Master: der Fund auf diesem Rechner.
  const master = k({ rolle: 'master' });
  eq(waehleLauncher([B, A], master, hier), B, '17.4 Master: Fund auf diesem Rechner, nicht der letzte Fund');
  eq(waehleLauncher([A, C], master, hier), null, '17.4 Master: kein Fund auf diesem Rechner → keiner');
  // Einzelplatz: wie heute der letzte Fund.
  eq(waehleLauncher([A, B], null, hier), B, '17.4 Einzelplatz (keine Kopplungsdatei): der letzte Fund');
  eq(waehleLauncher([B, A], k({ rolle: 'aus' }), hier), A, '17.4 Einzelplatz (Rolle aus): der letzte Fund');
  eq(waehleLauncher([], null, hier), null, '17.4 Einzelplatz ohne Funde → keiner');
  const funde = [B, A];
  waehleLauncher(funde, k({ masterAdresse: '10.0.0.5' }), hier);
  eq(funde, [B, A], '17.4: die Fundliste bleibt unverändert');

  // Neue oder gleiche Show entscheidet der Zeiger (17.3), nicht neueShow.
  const mz = { quelle: 'master' as const, masterId: 'm1', masterSchluessel: '0123456789abcdef', showName: 'Gala', schluessel: 'aaaaaaaaaaaaaaaa' };
  eq(entscheideMasterStand(mz, { masterId: 'm1', schluessel: '0123456789abcdef' }), 'gleich', '17.3: gleicher Master und gleicher Schlüssel → gleich');
  eq(entscheideMasterStand(mz, { masterId: 'm2', schluessel: '0123456789abcdef' }), 'neu', '17.3: anderer Master → neu');
  eq(entscheideMasterStand(mz, { masterId: 'm1', schluessel: 'fedcba9876543210' }), 'neu', '17.3: andere Show am Master → neu');
  eq(entscheideMasterStand(mz, { masterId: 'm1', schluessel: null }), 'neu', '17.3: Schlüssel null → neu');
  eq(entscheideMasterStand(null, { masterId: 'm1', schluessel: '0123456789abcdef' }), 'neu', '17.3: ohne Zeiger → neu');
  eq(
    entscheideMasterStand({ showPfad: 'C:\\Shows\\Gala.jmshow', schluessel: 'aaaaaaaaaaaaaaaa' }, { masterId: 'm1', schluessel: '0123456789abcdef' }),
    'neu',
    '17.3: Zeiger auf eine eigene Show (Pfad) → neu',
  );

  // Übergang: gleicher Name (E25) und stehender Hinweis bei mitDokument mit jm-rundown.
  eq(gleicherShowName('  Gala 2026 ', 'gala 2026'), true, '17.3 Übergang: Name gleich nach trim, ohne Rücksicht auf Groß/Klein');
  eq(gleicherShowName('Gala', 'Gala 2026'), false, '17.3 Übergang: anderer Name → nein');
  eq(gleicherShowName('  ', ''), false, '17.3 Übergang: ein leerer Name gleicht nie');
  eq(mitRundownDokument(['jm-titler', 'jm-rundown']), true, '17.3: mitDokument mit jm-rundown → stehender Hinweis');
  eq(mitRundownDokument(['jm-titler']) || mitRundownDokument([]), false, '17.3: ohne jm-rundown → kein Hinweis');
  eq(
    HINWEIS_RUNDOWN_DATEI_AM_MASTER,
    'Die Rundown-Datei dieser Show liegt am Master und wird hier nicht geladen. Ihre Aktionen fehlen auf diesem Rechner.',
    '17.3: Hinweis wörtlich',
  );

  // Ladeweg einer neuen Show vom Master (17.3, N9): Gedächtnis → Übergang (gleicher Name) → leer; eine Show ohne
  // Ablauf und ohne Gedächtnis lässt das Dokument stehen (wie 2a 5.2).
  const weg = (mitGedaechtnis: boolean, ablaufLeer: boolean, docName: string) => masterAusgang({ mitGedaechtnis, ablaufLeer, docName, showName: 'Gala' });
  eq(weg(true, false, 'Andere'), 'gedaechtnis', '17.3 Ladeweg: Gedächtnis mit Master-Schlüssel zuerst');
  eq(weg(true, true, 'Andere'), 'gedaechtnis', '17.3 Ladeweg: Gedächtnis auch bei einer Show ohne Ablauf');
  eq(weg(false, false, ' gala '), 'uebergang', '17.3 Ladeweg: ohne Gedächtnis, gleicher Name → Übergang');
  eq(weg(false, false, 'Andere'), 'leer', '17.3 Ladeweg: ohne Gedächtnis, anderer Name → leer');
  eq(weg(false, true, 'Gala'), 'bleibt', '17.3 Ladeweg: ohne Ablauf und ohne Gedächtnis → das Dokument bleibt (5.2)');

  // Stehender Hinweis zur Rundown-Datei: einmal je Show (17.3, N9); weggeklickt bleibt er weg, bis eine andere Show kommt.
  const mitDatei = { masterId: 'm1', mitDokument: ['jm-rundown'] };
  const h1 = dokumentHinweis(null, mitDatei, '0123456789abcdef');
  eq(h1, { fuer: 'm1|0123456789abcdef', zeigen: true }, '17.3 Hinweis: erster Stand der Show mit Rundown-Datei → zeigen und loggen');
  eq(dokumentHinweis(h1.fuer, mitDatei, '0123456789abcdef'), { fuer: h1.fuer, zeigen: false }, '17.3 Hinweis: weiterer Stand derselben Show → nicht noch einmal');
  eq(dokumentHinweis(h1.fuer, mitDatei, 'fedcba9876543210').zeigen, true, '17.3 Hinweis: andere Show am Master → wieder zeigen');
  eq(dokumentHinweis(h1.fuer, { masterId: 'm2', mitDokument: ['jm-rundown'] }, '0123456789abcdef').zeigen, true, '17.3 Hinweis: anderer Master → wieder zeigen');
  eq(dokumentHinweis(h1.fuer, { masterId: 'm1', mitDokument: ['jm-titler'] }, '0123456789abcdef'), { fuer: null, zeigen: false }, '17.3 Hinweis: Show ohne Rundown-Datei → entfernen, Merker leer');

  // Show-Deep-Link (17.3 vor 16.1, E24, N15): im Verbundmodus lädt der Rundown daraus nichts, weder Daten noch Dokument,
  // und schreibt eine eigene Logzeile; außerhalb gilt der Weg aus 2a.
  const ohneKuerzen = (n: string): string => n;
  eq(showLinkWeg(false, 'C:\\Shows\\Gala 2026.jmshow', ohneKuerzen), { weg: 'laden' }, '17.3 Show-Link außerhalb des Verbundmodus → laden wie 2a');
  eq(
    showLinkWeg(true, 'C:\\Shows\\Gala 2026.jmshow', ohneKuerzen),
    { weg: 'ignorieren', log: 'Verbund: Show-Link „Gala 2026.jmshow“ – der Rundown folgt der Show vom Master und lädt daraus nichts.' },
    '17.3 Show-Link im Verbundmodus → nichts laden, eigene Logzeile mit dem Dateinamen (E24)',
  );
  eq(
    showLinkWeg(true, '/home/regie/Shows/Gala.jmshow', (n) => `[${n}]`),
    { weg: 'ignorieren', log: 'Verbund: Show-Link „[Gala.jmshow]“ – der Rundown folgt der Show vom Master und lädt daraus nichts.' },
    '17.3 … der Name läuft durch die Kürzung (im Main kuerzeName), auch bei Pfaden mit /',
  );
}

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```

- [ ] **Step 2: Tests laufen lassen (rot)**

```
npm run selftest -w @jm/rundown
node --experimental-strip-types --import ./test/register.mjs test/gedaechtnis.test.ts
```
(den zweiten Befehl im Ordner `apps/rundown`; das Skript `selftest` bricht schon am ersten Lauf ab.) Erwartet, je Exitcode 1:
```
SyntaxError: The requested module '../src/shared/conductor.ts' does not provide an export named 'HINWEIS_RUNDOWN_DATEI_AM_MASTER'
SyntaxError: The requested module '../src/main/gedaechtnis.ts' does not provide an export named 'ausShow'
```

- [ ] **Step 3: Typen in `apps/rundown/src/shared/ausgangsstand.ts`** (Zeilen 17–28), Vorher:
```ts
/** Inhalt von `<userData>/regie/<schlüssel>.json` (4.7). */
export interface GedaechtnisInhalt {
  schemaVersion: 2;
  showPfad: string;
  showName: string;
  /** Aktuelle Zeilen samt Archiv. */
  doc: RundownDoc;
  scharfId: string | null;
  gespeichertAm: string;
  /** Stand der eigenen Rundown-Datei beim letzten Laden oder Speichern (4.8). */
  datei?: DateiStand;
}
```
Nachher:
```ts
/** Inhalt von `<userData>/regie/<schlüssel>.json` (4.7). */
export interface GedaechtnisInhalt {
  schemaVersion: 2;
  /** Pfad der Show; leer bei `quelle: 'master'` (Teil 2b, Spec 17.3). */
  showPfad: string;
  showName: string;
  /** Aktuelle Zeilen samt Archiv. */
  doc: RundownDoc;
  scharfId: string | null;
  gespeichertAm: string;
  /** Stand der eigenen Rundown-Datei beim letzten Laden oder Speichern (4.8). */
  datei?: DateiStand;
  /** Show vom Master (Spec 17.3): dann sind `masterId` (nicht leer) und `masterSchluessel` (16 Hex) Pflicht. */
  quelle?: 'master';
  masterId?: string;
  masterSchluessel?: string;
}

/**
 * Wozu ein Gedächtnis gehört (Spec 17.3): eine Show-Datei (Pfad-Schlüssel aus 2a) oder eine Show am
 * Master (`schluessel` = Schlüssel der Show am Master, 13.1).
 */
export type GedaechtnisQuelle = { art: 'pfad'; showPfad: string } | { art: 'master'; masterId: string; schluessel: string };

/**
 * Zeiger `regie/zuletzt.json` auf die gemerkte Show (4.7, Spec 17.3). `schluessel` ist immer der
 * Schlüssel des Gedächtnisses; die Master-Form trägt in der Datei `showPfad: ''`, damit ein
 * Rundown 0.6/0.7 sie verwirft.
 */
export type Zeiger =
  | { showPfad: string; schluessel: string }
  | { quelle: 'master'; masterId: string; masterSchluessel: string; showName: string; schluessel: string };
```

- [ ] **Step 4: `apps/rundown/src/main/gedaechtnis.ts`** (Edit-Werkzeug, CRLF bleibt)

Ersetzung 1 (Zeile 25), Vorher:
```ts
import type { DateiStand, GedaechtnisInhalt } from '../shared/ausgangsstand';
```
Nachher:
```ts
import type { DateiStand, GedaechtnisInhalt, GedaechtnisQuelle, Zeiger } from '../shared/ausgangsstand';

export type { GedaechtnisQuelle, Zeiger } from '../shared/ausgangsstand';
```
Ersetzung 2 (Zeilen 83–87), Vorher:
```ts
export function gedaechtnisSchluessel(showPfad: string): string {
  return createHash('sha256').update(resolve(showPfad).toLowerCase()).digest('hex').slice(0, 16);
}

function pruefeDateiStand
```
Nachher:
```ts
export function gedaechtnisSchluessel(showPfad: string): string {
  return createHash('sha256').update(resolve(showPfad).toLowerCase()).digest('hex').slice(0, 16);
}

/** 16 Hex-Zeichen: Schlüssel einer Show am Master (13.1) und jedes Gedächtnisses (Dateiname). */
const HEX16 = /^[0-9a-f]{16}$/;

/**
 * Eine Schlüsselfunktion für beide Fälle (Spec 17.3): `pfad` wie 2a (`gedaechtnisSchluessel`),
 * `master` = die ersten 16 Hex-Zeichen von SHA-256 über "master|" + masterId + "|" + schluessel.
 */
export function gedaechtnisSchluesselFuer(q: GedaechtnisQuelle): string {
  if (q.art === 'pfad') return gedaechtnisSchluessel(q.showPfad);
  return createHash('sha256').update(`master|${q.masterId}|${q.schluessel}`).digest('hex').slice(0, 16);
}

/** Quelle eines Gedächtnis-Inhalts (#235): nie aus einem leeren Pfad; null, wenn sie fehlt oder ungültig ist. */
function quelleVon(inhalt: GedaechtnisInhalt): GedaechtnisQuelle | null {
  if (inhalt.quelle === 'master') {
    const { masterId, masterSchluessel } = inhalt;
    if (!masterId || !masterSchluessel || !HEX16.test(masterSchluessel)) return null;
    return { art: 'master', masterId, schluessel: masterSchluessel };
  }
  return inhalt.showPfad ? { art: 'pfad', showPfad: inhalt.showPfad } : null;
}

function pruefeDateiStand
```
Ersetzung 3 (`pruefeGedaechtnis`, Zeilen 97–112), Vorher:
```ts
function pruefeGedaechtnis(roh: unknown): GedaechtnisInhalt | null {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return null;
  const o = roh as Record<string, unknown>;
  if (o.schemaVersion !== 2 || typeof o.showPfad !== 'string' || !o.showPfad) return null;
  if (!o.doc || typeof o.doc !== 'object') return null;
  const datei = pruefeDateiStand(o.datei);
  return {
    schemaVersion: 2,
    showPfad: o.showPfad,
    showName: typeof o.showName === 'string' ? o.showName : '',
    doc: migrate(o.doc, newId),
    scharfId: typeof o.scharfId === 'string' ? o.scharfId : null,
    gespeichertAm: typeof o.gespeichertAm === 'string' ? o.gespeichertAm : '',
    ...(datei ? { datei } : {}),
  };
}
```
Nachher:
```ts
function pruefeGedaechtnis(roh: unknown): GedaechtnisInhalt | null {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return null;
  const o = roh as Record<string, unknown>;
  if (o.schemaVersion !== 2) return null;
  // Show vom Master (Spec 17.3): masterId und masterSchluessel Pflicht, showPfad leer. Ohne quelle wie 2a.
  let master: { quelle: 'master'; masterId: string; masterSchluessel: string } | null = null;
  if (o.quelle === 'master') {
    if (typeof o.masterId !== 'string' || !o.masterId) return null;
    if (typeof o.masterSchluessel !== 'string' || !HEX16.test(o.masterSchluessel)) return null;
    master = { quelle: 'master', masterId: o.masterId, masterSchluessel: o.masterSchluessel };
  } else if (o.quelle !== undefined || typeof o.showPfad !== 'string' || !o.showPfad) {
    return null;
  }
  if (!o.doc || typeof o.doc !== 'object') return null;
  const datei = pruefeDateiStand(o.datei);
  return {
    schemaVersion: 2,
    showPfad: master ? '' : (o.showPfad as string),
    showName: typeof o.showName === 'string' ? o.showName : '',
    doc: migrate(o.doc, newId),
    scharfId: typeof o.scharfId === 'string' ? o.scharfId : null,
    gespeichertAm: typeof o.gespeichertAm === 'string' ? o.gespeichertAm : '',
    ...(datei ? { datei } : {}),
    ...(master ?? {}),
  };
}
```
Ersetzung 4 (`schreibeGedaechtnis`, Zeilen 140–144), Vorher:
```ts
/** Gedächtnis atomar schreiben; der Dateiname kommt aus `inhalt.showPfad`. */
export function schreibeGedaechtnis(ordner: string, inhalt: GedaechtnisInhalt): boolean {
  const schluessel = gedaechtnisSchluessel(inhalt.showPfad);
  return schreibeAtomar(join(ordner, `${schluessel}.json`), JSON.stringify(inhalt, null, 2) + '\n');
}
```
Nachher:
```ts
/**
 * Gedächtnis atomar schreiben; der Dateiname kommt aus `gedaechtnisSchluesselFuer` je nach `quelle`
 * (Spec 17.3). Ohne gültige Quelle (leerer Pfad, Master ohne Kennung) wird nichts geschrieben: Der Hash
 * des Arbeitsordners wäre sonst der Dateiname jeder Master-Show (#235).
 */
export function schreibeGedaechtnis(ordner: string, inhalt: GedaechtnisInhalt): boolean {
  const q = quelleVon(inhalt);
  if (!q) return false;
  return schreibeAtomar(join(ordner, `${gedaechtnisSchluesselFuer(q)}.json`), JSON.stringify(inhalt, null, 2) + '\n');
}
```
Ersetzung 5 (Zeiger, Zeilen 176–196), Vorher:
```ts
/** Zeiger auf die gemerkte Show (`<ordner>/zuletzt.json`, 4.7) oder null. */
export function leseZeiger(ordner: string): { showPfad: string; schluessel: string } | null {
  try {
    const roh = JSON.parse(readFileSync(join(ordner, ZEIGER_DATEI), 'utf8')) as unknown;
    if (!roh || typeof roh !== 'object') return null;
    const o = roh as Record<string, unknown>;
    if (typeof o.showPfad !== 'string' || !o.showPfad) return null;
    // Der Schlüssel landet in einem Dateinamen → nur genau 16 Hex-Zeichen.
    if (typeof o.schluessel !== 'string' || !/^[0-9a-f]{16}$/.test(o.schluessel)) return null;
    return { showPfad: o.showPfad, schluessel: o.schluessel };
  } catch {
    return null;
  }
}

export function schreibeZeiger(ordner: string, z: { showPfad: string; schluessel: string }): boolean {
  return schreibeAtomar(
    join(ordner, ZEIGER_DATEI),
    JSON.stringify({ showPfad: z.showPfad, schluessel: z.schluessel }, null, 2) + '\n',
  );
}
```
Nachher:
```ts
/** Zeiger auf die gemerkte Show (`<ordner>/zuletzt.json`, 4.7; Master-Form Spec 17.3) oder null. */
export function leseZeiger(ordner: string): Zeiger | null {
  try {
    const roh = JSON.parse(readFileSync(join(ordner, ZEIGER_DATEI), 'utf8')) as unknown;
    if (!roh || typeof roh !== 'object') return null;
    const o = roh as Record<string, unknown>;
    // Der Schlüssel landet in einem Dateinamen → nur genau 16 Hex-Zeichen.
    if (typeof o.schluessel !== 'string' || !HEX16.test(o.schluessel)) return null;
    if (o.quelle === 'master') {
      if (typeof o.masterId !== 'string' || !o.masterId) return null;
      if (typeof o.masterSchluessel !== 'string' || !HEX16.test(o.masterSchluessel)) return null;
      if (typeof o.showName !== 'string') return null;
      return { quelle: 'master', masterId: o.masterId, masterSchluessel: o.masterSchluessel, showName: o.showName, schluessel: o.schluessel };
    }
    if (typeof o.showPfad !== 'string' || !o.showPfad) return null;
    return { showPfad: o.showPfad, schluessel: o.schluessel };
  } catch {
    return null;
  }
}

export function schreibeZeiger(ordner: string, z: Zeiger): boolean {
  const inhalt =
    'quelle' in z
      ? { quelle: z.quelle, masterId: z.masterId, masterSchluessel: z.masterSchluessel, showName: z.showName, showPfad: '', schluessel: z.schluessel }
      : { showPfad: z.showPfad, schluessel: z.schluessel };
  return schreibeAtomar(join(ordner, ZEIGER_DATEI), JSON.stringify(inhalt, null, 2) + '\n');
}
```
Ersetzung 6 (Ende von `leseShowSicher`, Zeilen 247–256), Vorher:
```ts
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return { ok: false, grund: 'keine Show-Datei' };
  const show = migrateShow(roh);
  const timerSettings = show.tools.find((t) => t.appId === 'jm-timer')?.settings;
  return {
    ok: true,
    show,
    ablaufSchluessel: ersatzSchluessel(show.ablauf ?? []),
    eigeneTimerListe: hatEigeneTimerListe(timerSettings),
  };
}
```
Nachher:
```ts
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return { ok: false, grund: 'keine Show-Datei' };
  return ausShow(migrateShow(roh));
}

/**
 * Der reine Teil von `leseShowSicher` (Spec 17.3): Schlüssel des Ablaufs (R9, 6.2) und eigene Timer-Liste
 * (6.1) aus einer schon gelesenen Show — etwa einer Show vom Master (nach `migrateShow` in app-runtime).
 */
export function ausShow(show: Show): Extract<ShowGelesen, { ok: true }> {
  const timerSettings = show.tools.find((t) => t.appId === 'jm-timer')?.settings;
  return {
    ok: true,
    show,
    ablaufSchluessel: ersatzSchluessel(show.ablauf ?? []),
    eigeneTimerListe: hatEigeneTimerListe(timerSettings),
  };
}
```

- [ ] **Step 5: Zwischenstand messen**

```
cd apps/rundown && node --experimental-strip-types --import ./test/register.mjs test/gedaechtnis.test.ts | grep -c "^ok "
```
Erwartet: `109` und „ALLE TESTS OK“ (81 vorher + 28 neu); `test/selftest.ts` bleibt mit derselben `SyntaxError` wie in Step 2 rot.

- [ ] **Step 6: `apps/rundown/src/shared/conductor.ts`**

Ersetzung 1 (Zeile 5), Vorher:
```ts
import type { Endpoint, RundownAction, RundownDoc, RundownNav, RundownRow } from './types';
```
Nachher:
```ts
import type { Endpoint, RundownAction, RundownDoc, RundownNav, RundownRow } from './types';
import type { Zeiger } from './ausgangsstand';
```
Ersetzung 2 (vor `buildActionLine`, Zeilen 26–27), Vorher:
```ts
/**
 * Protokollzeile für eine Aktion bauen. Switcher-Verben haben KEINEN Namespace
```
Nachher:
```ts
// ── Teil 2b R2: Rundown im Verbund (Spec 17.3, 17.4) ─────────────────────────

/** Steuerport des Launchers (suite-control-protocol, Rolle `launcher`). */
const LAUNCHER_PORT = 8736;

/**
 * Was die Launcher-Wahl aus der Kopplung braucht (Spec 17.4). Strukturgleich mit einem Ausschnitt von
 * `VerbundKopplung` aus `@jm/app-runtime`; hier ohne Paket-Import (G7). `null` = keine Kopplungsdatei.
 */
export interface KopplungFuerWahl {
  rolle: 'aus' | 'master' | 'slave';
  masterAdresse: string | null;
  adressen: string[];
  letzteAdresse: string | null;
}

/** Adresse vergleichbar machen: Groß/Klein, Klammern, IPv6-Zone und `::ffff:` vor einer IPv4 fallen weg. */
function normAdresse(a: string): string {
  let s = a.trim().toLowerCase();
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  const zone = s.indexOf('%');
  if (zone >= 0) s = s.slice(0, zone);
  if (s.startsWith('::ffff:') && s.includes('.')) s = s.slice('::ffff:'.length);
  return s;
}

function gleicheAdresse(a: string, b: string): boolean {
  return a.trim() !== '' && normAdresse(a) === normAdresse(b);
}

/**
 * Launcher wählen, an den `LAUNCHER …`-Befehle gehen (Spec 17.4, Z2):
 *  - Rolle Slave, verbunden (`masterAdresse`): der Fund mit dieser Adresse, sonst einer mit einer Adresse
 *    aus `adressen`; ohne passenden Fund direkt `masterAdresse` mit Port 8736.
 *  - Rolle Slave, nicht verbunden: der Fund passend zu `letzteAdresse`, sonst keiner.
 *  - Rolle Master: der Fund auf diesem Rechner (`istHier`, im Main `istHostDieserRechner`).
 *  - Einzelplatz (keine Datei, Rolle aus): wie bisher der letzte Fund.
 * Manuelle Endpunkte haben weiter Vorrang (`mergeEndpoints`, im Aufrufer). Ändert die Eingaben nicht.
 */
export function waehleLauncher(
  funde: readonly Endpoint[],
  kopplung: KopplungFuerWahl | null,
  istHier: (host: string) => boolean,
): Endpoint | null {
  if (!kopplung || kopplung.rolle === 'aus') return funde.length ? funde[funde.length - 1] : null;
  if (kopplung.rolle === 'master') return funde.find((f) => istHier(f.host)) ?? null;
  const { masterAdresse, adressen, letzteAdresse } = kopplung;
  if (masterAdresse) {
    const passend =
      funde.find((f) => gleicheAdresse(f.host, masterAdresse)) ?? funde.find((f) => adressen.some((a) => gleicheAdresse(f.host, a)));
    return passend ?? { host: masterAdresse, port: LAUNCHER_PORT };
  }
  if (letzteAdresse) return funde.find((f) => gleicheAdresse(f.host, letzteAdresse)) ?? null;
  return null;
}

/**
 * Neue oder gleiche Show (Spec 17.3): Der Rundown entscheidet über seinen Zeiger (gemerkte Show =
 * masterId + masterSchluessel), nicht über `neueShow` aus app-runtime. Ohne Zeiger, mit einem Zeiger auf
 * eine eigene Show oder ohne Schlüssel im Stand: `neu`.
 */
export function entscheideMasterStand(zeiger: Zeiger | null, stand: { masterId: string; schluessel: string | null }): 'gleich' | 'neu' {
  if (!zeiger || !('quelle' in zeiger) || stand.schluessel === null) return 'neu';
  return zeiger.masterId === stand.masterId && zeiger.masterSchluessel === stand.schluessel ? 'gleich' : 'neu';
}

/** Stehender Hinweis auf B, wenn die Show am Master eine eigene Rundown-Datei trägt (Spec 17.3, wörtlich). */
export const HINWEIS_RUNDOWN_DATEI_AM_MASTER =
  'Die Rundown-Datei dieser Show liegt am Master und wird hier nicht geladen. Ihre Aktionen fehlen auf diesem Rechner.';

/** Trägt die Show am Master eine eigene Rundown-Datei? (`mitDokument` aus dem Stand, Spec 13.1, 17.3) */
export function mitRundownDokument(mitDokument: readonly string[]): boolean {
  return mitDokument.includes('jm-rundown');
}

/**
 * Stehender Hinweis zur Rundown-Datei am Master (Spec 17.3): einmal je Show zeigen und loggen. `fuer` ist der neue
 * Merker (`masterId|masterSchluessel`; `null` = Hinweis entfernen), `zeigen` nur beim ersten Stand dieser Show.
 * Weggeklickt bleibt er so weg, bis eine andere Show kommt.
 */
export function dokumentHinweis(
  vorher: string | null,
  stand: { masterId: string; mitDokument: readonly string[] },
  masterSchluessel: string,
): { fuer: string | null; zeigen: boolean } {
  if (!mitRundownDokument(stand.mitDokument)) return { fuer: null, zeigen: false };
  const fuer = `${stand.masterId}|${masterSchluessel}`;
  return { fuer, zeigen: fuer !== vorher };
}

/** Ausgangsstand einer neuen Show vom Master (Spec 17.3). */
export type MasterAusgang = 'gedaechtnis' | 'uebergang' | 'leer' | 'bleibt';

/**
 * Ladeweg einer neuen Show vom Master (Spec 17.3, wie `ladeAndereShow` ohne eigene Datei): Gedächtnis mit
 * Master-Schlüssel → Übergang (das aktuelle Dokument, wenn sein Name dem der Show gleicht, E25) → leer. Eine Show
 * ohne Ablauf und ohne Gedächtnis lässt das Dokument stehen (`bleibt`, wie 2a 5.2): Es gehört nicht zu ihr.
 */
export function masterAusgang(o: { mitGedaechtnis: boolean; ablaufLeer: boolean; docName: string; showName: string }): MasterAusgang {
  if (o.mitGedaechtnis) return 'gedaechtnis';
  if (o.ablaufLeer) return 'bleibt';
  return gleicherShowName(o.docName, o.showName) ? 'uebergang' : 'leer';
}

/**
 * Übergang (Spec 17.3, E25): Gilt das aktuelle Dokument als Ausgangsstand einer Master-Show ohne Gedächtnis?
 * Ja, wenn sein Name dem Namen der Show gleicht — nach `trim()`, ohne Rücksicht auf Groß/Klein. Leer nie.
 */
export function gleicherShowName(docName: string, showName: string): boolean {
  const a = docName.trim();
  return a !== '' && a.toLowerCase() === showName.trim().toLowerCase();
}

/**
 * Show-Deep-Link im Rundown (Spec 17.3 „Show-Deep-Link | Daten ignoriert“ und „Eigene Rundown-Datei der Show: wird auf
 * B nicht geladen“; die Rundown-eigene Regel geht 16.1 vor, E24): Im Verbundmodus lädt der Rundown aus dem Link nichts,
 * weder Daten noch Dokument. Ein Show-Link kommt oft ohne bewusste Handlung (Launcher, Doppelklick); er darf einen
 * laufenden Rundown nicht auf die erste Zeile setzen, GO-Folgen abbrechen oder das Gedächtnis der Master-Show
 * überschreiben. Statt der 16.1-Zeile eine eigene, wahre Logzeile; ⟨Name⟩ ist der Dateiname des Links, gesäubert und
 * gekürzt über `kuerze` (im Main `kuerzeName`). Außerhalb des Verbundmodus gilt der Weg aus 2a (`laden`).
 */
export function showLinkWeg(
  imVerbund: boolean,
  pfad: string,
  kuerze: (name: string) => string,
): { weg: 'laden' } | { weg: 'ignorieren'; log: string } {
  if (!imVerbund) return { weg: 'laden' };
  const name = pfad.split(/[\\/]/).filter((t) => t !== '').pop() ?? pfad;
  return { weg: 'ignorieren', log: `Verbund: Show-Link „${kuerze(name)}“ – der Rundown folgt der Show vom Master und lädt daraus nichts.` };
}

/**
 * Protokollzeile für eine Aktion bauen. Switcher-Verben haben KEINEN Namespace
```

- [ ] **Step 7: Tests laufen lassen (grün)**

```
npm run selftest -w @jm/rundown 2>&1 | grep -c "^ok "
npm run selftest -w @jm/rundown 2>&1 | grep -c "ALLE TESTS OK"
```
Erwartet: `552` (443 aus `test/selftest.ts` = 404 + 39 neu, 109 aus `test/gedaechtnis.test.ts` = 81 + 28 neu) und `2`, Exitcode 0.

- [ ] **Step 8: Typecheck zeigt den Zeiger als Union im Main**

```
npm run typecheck -w @jm/rundown
```
Erwartet: Exitcode ≠ 0, genau:
```
src/main/index.ts(815,30): error TS2339: Property 'showPfad' does not exist on type 'Zeiger'.
src/main/index.ts(817,22): error TS2339: Property 'showPfad' does not exist on type 'Zeiger'.
src/main/index.ts(822,73): error TS2339: Property 'showPfad' does not exist on type 'Zeiger'.
src/main/index.ts(824,18): error TS2339: Property 'showPfad' does not exist on type 'Zeiger'.
```

- [ ] **Step 9: Typ-Brücke im Main** (`apps/rundown/src/main/index.ts:812-814`; C18 ersetzt sie), Vorher:
```ts
function starteOhneDeepLink(): void {
  const z = leseZeiger(regieOrdner());
  if (!z) return;
```
Nachher:
```ts
function starteOhneDeepLink(): void {
  const z = leseZeiger(regieOrdner());
  // Zeiger mit quelle master (Spec 17.3) kommt mit C18; bis dahin wie Rundown 0.7: ignoriert.
  if (!z || 'quelle' in z) return;
```

- [ ] **Step 10: Typecheck, Importe**

```
npm run typecheck -w @jm/rundown
grep -n "^import" apps/rundown/src/shared/conductor.ts apps/rundown/src/shared/ausgangsstand.ts
```
Erwartet: Typecheck node und web ohne Meldung, Exitcode 0; die Importe genau:
```
apps/rundown/src/shared/conductor.ts:5:import type { Endpoint, RundownAction, RundownDoc, RundownNav, RundownRow } from './types';
apps/rundown/src/shared/conductor.ts:6:import type { Zeiger } from './ausgangsstand';
apps/rundown/src/shared/ausgangsstand.ts:7:import type { RundownDoc } from './types';
```

- [ ] **Step 11: Commit** (Git Bash, Commit-Text ohne Umlaute)

```
git add apps/rundown/src/shared/ausgangsstand.ts apps/rundown/src/main/gedaechtnis.ts apps/rundown/src/shared/conductor.ts apps/rundown/src/main/index.ts apps/rundown/test/gedaechtnis.test.ts apps/rundown/test/selftest.ts
git status --short
```
Erwartet genau:
```
M  apps/rundown/src/main/gedaechtnis.ts
M  apps/rundown/src/main/index.ts
M  apps/rundown/src/shared/ausgangsstand.ts
M  apps/rundown/src/shared/conductor.ts
M  apps/rundown/test/gedaechtnis.test.ts
M  apps/rundown/test/selftest.ts
```
Dann:
```
git commit -m "feat(rundown): Gedaechtnis und Zeiger mit Master-Schluessel, Launcher-Wahl, neu oder gleich (Teil 2b R2, C17)" -m "gedaechtnisSchluesselFuer fuer Pfad und Master (sha256 master|masterId|schluessel). Gedaechtnis mit quelle master verlangt masterId und masterSchluessel; schreibeGedaechtnis nimmt den Dateinamen aus der Quelle und schreibt ohne gueltige Quelle nichts (#235). Zeiger in Master-Form mit leerem showPfad. ausShow als reiner Teil von leseShowSicher. waehleLauncher nach 17.4, entscheideMasterStand ueber den Zeiger, gleicherShowName, Hinweis 17.3 woertlich. masterAusgang, dokumentHinweis und showLinkWeg (Show-Link im Verbundmodus laedt nichts, eigene Logzeile) als reine Regeln fuer C18. Main nur Typ-Bruecke." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- **Ort der Typen `GedaechtnisQuelle` und `Zeiger`:** definiert in `src/shared/ausgangsstand.ts` (neben `GedaechtnisInhalt`), aus `src/main/gedaechtnis.ts` re-exportiert. Grund: `entscheideMasterStand` liegt nach Register in `src/shared/conductor.ts` und braucht `Zeiger`; ein `src/shared`-Modul importiert nach G7 nur Typen aus `src/shared`, nie aus `src/main`. Wer nach Register aus `./gedaechtnis` importiert, bekommt dieselben Typen.
- **Zusätzlicher Export `mitRundownDokument`** für die 19.5-Prüfung „stehender Hinweis bei `mitDokument` mit `jm-rundown`“ als reine Funktion.
- **`apps/rundown/src/main/index.ts` schon hier berührt** (eine Zeile, Steps 8–9): `leseZeiger` liefert nach Register die Union; ohne die Brücke bricht der Typecheck (G11). Bis C18 übergeht der Start einen Master-Zeiger wie Rundown 0.7.
- **`schreibeGedaechtnis` ohne gültige Quelle → `false`** (bisher: Hash von `resolve('')`, also des Arbeitsordners). Kein 2a-Aufrufer übergibt einen leeren Pfad (`sichere()` schreibt nur mit gemerkter Show); C18 stellt das für die Master-Show sicher.
- `gleicherShowName`: ein leerer Name gleicht nie (E25 sagt dazu nichts; ein unbenanntes Dokument soll keine Show übernehmen).
- **Zusätzliche Exporte `masterAusgang` und `dokumentHinweis`** (N9, Nachbesserung): Die Entscheidungen der Ladewege aus C18 (welcher Ausgangsstand, Hinweis einmal je Show) sind reine Funktionen und hier rot zuerst getestet; C18 hat dafür keine eigenen Tests (G15).
- **Zusätzlicher Export `showLinkWeg`** (N15, E24): Die Entscheidung „Show-Link im Verbundmodus → nichts laden, eigene Logzeile; sonst wie 2a“ ist rein und hier mit drei Prüfungen rot zuerst getestet (Step 2 bricht ab, solange die Exporte fehlen). Die Kürzung kommt als Parameter herein, weil `src/shared` keine Paket-Laufzeitimporte hat (G7); im Main ist es `kuerzeName` aus `@jm/app-runtime` (C13).

**Nachgerechnet** (beim Durchspielen des ganzen Plans): Step 2 beide Meldungen wie angegeben; Step 5 `109`, Selbsttest weiter rot; Step 7 `552` (nach N15 nachgemessen), zweimal „ALLE TESTS OK“; Step 8 genau die vier Meldungen; Step 10 Typecheck node und web grün. Gegenprobe mit je einem absichtlichen Fehler, alle gefangen (`FAIL` in `selftest.ts` / `gedaechtnis.test.ts`; die Zeilen ohne N-Verweis hat der Schreiber gemessen, die mit N9 und N15 sind in der zweiten Runde nachgemessen, für N15 mit genau der genannten Änderung in `conductor.ts` und `node --experimental-strip-types apps/rundown/test/selftest.ts`, danach zurückbauen):

| Fehler | selftest | gedaechtnis |
| --- | --- | --- |
| Master-Formel ohne Präfix `master|` | 0 | 1 |
| Dateiname wieder aus `inhalt.showPfad` (2a) | 0 | 2 |
| `masterId` nicht geprüft | 0 | 3 |
| leerer Pfad schreibt doch eine Datei | 0 | 3 |
| Slave verbunden ohne Wahl über `masterAdresse` | 5 | 0 |
| Master nimmt den letzten Fund | 2 | 0 |
| neu/gleich ohne Schlüsselvergleich | 1 | 0 |
| Name mit Groß/Klein verglichen | 1 | 0 |
| ohne `::ffff:`-Angleichung | 1 | 0 |
| Hinweis bei jedem Stand neu (`zeigen: true`, N9) | 1 | 0 |
| Show ohne Ablauf vor dem Gedächtnis geprüft (N9) | 1 | 0 |
| kein Übergang über den Namen (N9) | 1 | 0 |
| im Verbundmodus doch laden: `if (!imVerbund) return { weg: 'laden' };` → `if (imVerbund \|\| !imVerbund) return { weg: 'laden' };` (N15) | 2: „17.3 Show-Link im Verbundmodus → nichts laden, eigene Logzeile mit dem Dateinamen (E24)“, „17.3 … der Name läuft durch die Kürzung (im Main kuerzeName), auch bei Pfaden mit /“ | 0 |
| Name ohne Kürzung: ``„${kuerze(name)}“`` → ``„${name}“`` (N15) | 1: „17.3 … der Name läuft durch die Kürzung (im Main kuerzeName), auch bei Pfaden mit /“ | 0 |
| ganzer Pfad statt Dateiname: die Zeile `const name = pfad.split(…)…` → `const name = pfad;` (N15) | 2: dieselben zwei wie in der ersten N15-Zeile | 0 |

---

### Task 18: C18 · Rundown: Ladewege im Verbund, alle 21 `showPfad`-Stellen (#235), Conductor wählt den Launcher (Z2), V-Zeile

**Spec:** 16.1 (Verbundmodus, Logzeilen, `verbundDatenErsetzt()`), 16.5 (Statusstreifen), 17.3 (Tabelle „Ladewege im Verbundmodus“ mit „Show-Deep-Link | Daten ignoriert“, Übergang, eigene Rundown-Datei, Hinweise), 17.4 (Conductor sammelt Launcher-Funde, Wahl über `waehleLauncher`). Entscheidungen E15, E16, E17, E24 (17.3 vor 16.1), E28.

**Arbeitsverzeichnis:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b-r2`, Branch `feat/master-link-teil2b-r2`. Voraussetzung: C13 und C17 sind committet.

**Dateien:**
- Modify: `apps/rundown/src/main/index.ts` (Stand nach C17): Importe `:4`, `:8`, `:55-70`; Zustand `:95`; `:128` (Conductor) plus Helfer; `:137`, `:157`, `:179-198` (`sichere`), `:244-248` (`case 'reload'`), `:299`, `:319-322` (`vergissShow`) plus zwei neue Funktionen nach `:329`, `:412`, `:423-425` (`openDialog`), `:546-550` (`rundown:new`), `:657` (`ladeAndereShow`), `:786-789` (`applyShowFromDeepLink`), `:812-826` (`starteOhneDeepLink`) plus fünf neue Funktionen nach `:842`, `:917-921` (`whenReady`) (die drei letzten Angaben nach der Typ-Brücke aus C17, eine Zeile weiter als vor C17, N32)
- Modify: `apps/rundown/src/main/conductor.ts:12-13`, `:39-42`, `:53`, `:84-94`
- Modify: `apps/rundown/src/shared/types.ts:165` (neuer Typ `VerbundAnzeigeZeile`, E28), `:199-201` (`JmRundownApi`)
- Modify: `apps/rundown/src/preload/index.ts:2`, `:33-34`
- Modify: `apps/rundown/src/renderer/src/components/ToolLinks.tsx:1-2`, `:21-22`
- Unverändert: `apps/rundown/src/renderer/src/App.tsx` (die V-Zeile abonniert `ToolLinks` selbst), `apps/rundown/src/renderer/src/jmrundown.d.ts` (nimmt `JmRundownApi`)

**Interfaces:**
- Consumes (C13, S-C): `folgeMasterShow`, `imVerbundmodus`, `istHostDieserRechner`, `nichtAngewendet` (N3), `verbundDatenErsetzt`, `verbundIgnoriert`, `verbundKopplung` (`VerbundKopplung | null`: `rolle`, `masterId`, `masterAdresse`, `adressen`, `letzteAdresse`), Typ `MasterStand`, IPC `jmps:verbund-anzeige`. Aus C17: `gedaechtnisSchluesselFuer`, `GedaechtnisQuelle`, `Zeiger`, `leseZeiger`, `schreibeZeiger`, `ausShow`, `schreibeGedaechtnis` (Quelle aus dem Inhalt), `waehleLauncher`, `KopplungFuerWahl`, `entscheideMasterStand`, `HINWEIS_RUNDOWN_DATEI_AM_MASTER`, `masterAusgang` und `dokumentHinweis` (N9; sie nutzen `gleicherShowName` und `mitRundownDokument`), `showLinkWeg` (N15). Aus C13 außerdem `kuerzeName` (über `@jm/app-runtime`, N15).
- Produces (S-D, exakt):
  ```ts
  // apps/rundown/src/shared/types.ts (E28)
  export interface VerbundAnzeigeZeile { text: string; farbe: 'gruen' | 'gelb' | 'rot' | 'gedaempft' }
  // JmRundownApi / Preload window.jmrundown (C20 liest per CDP, Port 9334):
  verbundAnzeige: () => Promise<VerbundAnzeigeZeile | null>;
  onVerbundAnzeige: (cb: (a: VerbundAnzeigeZeile | null) => void) => () => void;
  // apps/rundown/src/main/conductor.ts (intern)
  export interface LauncherWahl { kopplung(): KopplungFuerWahl | null; istHier(host: string): boolean }
  class Conductor { constructor(onChange: () => void, launcherWahl?: LauncherWahl); neuWaehlen(): void }
  ```

**Regeln:** G5 (Texte 17.3 wörtlich: „Show vom Master „⟨S⟩“ übernommen.“ kurz; Hinweis zur Rundown-Datei stehend und als Logzeile), G6, G11, G12, G14, G15, G16. Zu G15: keine neuen Unit-Tests, die Regeln sind in C17 getestet (seit N9 Ladeweg und Hinweis-Merker, seit N15 die Entscheidung zum Show-Link); hier Typecheck und Build. Der Durchgang C20 (vor dem Merge Pflicht, N14) prüft am Rundown: Stand vom Master anwenden (Prüfung 1), neuer Stand derselben Show in höchstens 2 s (2), Master weg und neue Epoche ohne neuen Hinweis (4), Neustart aus dem Zwischenspeicher (5), RELOAD im Verbundmodus (6), Entkoppeln mit V13 und bleibenden Daten (7). **Nicht in C20:** ein Show-Deep-Link, im Lauf und beim Start (C20 startet ohne, Spec 19.7; Startreihenfolge E55), „Öffnen…“/„Neu“ im Verbundmodus, der stehende Hinweis zur Rundown-Datei (die Test-Show trägt keine) und die Launcher-Wahl des Conductors (17.4, Abnahme Schritt 6). Show-Link, Startreihenfolge, „Öffnen…“/„Neu“ im Verbundmodus mit dem stehenden Hinweis und „Neu“ nach dem Entkoppeln (E56) stehen als Handprüfung unter „Zusatzprüfungen (nicht in Spec 20)“ in der Abnahme-Datei (C21, N17, N23).

**Verhalten (Spec 17.3, verbindlich):**
- **Gemerkte Show** ist jetzt eine von zwei Formen: `showPfad` (eigene Show, wie 2a) oder `masterQuelle = { masterId, masterSchluessel }` (Show vom Master). Sie schließen sich aus. Jede Stelle, die „gemerkte Show“ meint, fragt `hatShow()`; jede, die das Gedächtnis meint, `gedaechtnisQuelle()` — nie einen leeren Pfad (#235).
- **Stand vom Master** (`anwenden`): `entscheideMasterStand(aktuellerZeiger(), stand)` — `gleich` → `aktualisiereMasterShow` (wie `reloadShow`: `wendeShowAn`, Position nach R7/4.4, bricht keine GO-Folge ab; Ablauf neu entstanden → wie andere Show); `neu` → `ladeMasterShow` (wie `ladeAndereShow`: Gedächtnis mit Master-Schlüssel → Übergang über den Namen → leer, dann `wendeShowAn`; Show ohne Ablauf und ohne Gedächtnis: das Dokument bleibt wie in 5.2; den Weg wählt `masterAusgang` aus C17; erst rechnen, dann den Zustand setzen, damit ein Wurf nichts halb gemerkt zurücklässt (N9); Zeiger in Master-Form; kurzer Hinweis „Show vom Master „⟨S⟩“ übernommen.“). Die eigene Rundown-Datei der Show wird auf B nie von selbst geladen (eine Kopie lädt der Bediener bewusst mit „Öffnen…“, 17.3). Ein Stand mit Show, aber ohne Schlüssel (laut 13.1 ausgeschlossen) wirft `nichtAngewendet('SCHLUESSEL_FEHLT')` (V12 „Show vom Master nicht übernommen: SCHLUESSEL_FEHLT“, N3).
- **Hinweis zur Rundown-Datei**: `mitDokument` enthält `jm-rundown` → stehender Hinweis mit dem Text aus 17.3 und dieselbe Logzeile, beides einmal je Show (weggeklickt bleibt er weg, bis eine andere Show kommt); ohne → Hinweis entfernt. Die Regel ist `dokumentHinweis` aus C17 (N9).
- **„Öffnen…“ / „Neu“ im Verbundmodus**: Die Show vom Master bleibt gemerkt; die Datei bzw. ein leeres Dokument mit dem Namen der Show wird Ausgangsstand und sofort mit dem zuletzt angewendeten Stand abgeglichen; „Speichern“ schreibt in die geöffnete Datei. Außerhalb wie 2a, und dazu `verbundDatenErsetzt()` (siehe Abweichungen).
- **`RUNDOWN RELOAD` im Verbundmodus**: `verbundIgnoriert('reload')`. **Show-Deep-Link im Verbundmodus** (E24, Auslegung 17.3 vor 16.1, N15): Der Rundown lädt daraus nichts, weder Daten noch Dokument; Position, GO-Folgen und Gedächtnis der Master-Show bleiben. Statt der 16.1-Zeile eine Infozeile „Verbund: Show-Link „⟨Name⟩“ – der Rundown folgt der Show vom Master und lädt daraus nichts.“ (⟨Name⟩ = Dateiname über `kuerzeName`). Die Entscheidung ist `showLinkWeg` aus C17; `verbundIgnoriert('deeplink')` ruft der Rundown nicht. Rückgabe `true`. Eine eigene Rundown-Datei lädt der Bediener mit „Öffnen…“ (17.3).
- **Eigene Show** (`ladeAndereShow` aus Deep-Link, RELOAD oder Start über einen Pfad-Zeiger; der Start-Zweig „Show nicht lesbar“) vergisst die Show vom Master und ruft `verbundDatenErsetzt()` (E16).
- **Start ohne Deep-Link, Zeiger in Master-Form**: Gedächtnis mit Master-Schlüssel laden (Schlüssel aus Ablaufzeilen, iveo aus dem Kontext wie im Zweig „nicht lesbar“). Ohne lesbares Gedächtnis bleibt der Autosave, und der erste Stand lädt die Show wie eine andere (dann greift der Übergang).
- **Reihenfolge beim Start (E17, E24)**: ohne Show-Deep-Link `starteOhneDeepLink()`, dann `folgeMasterShow` (ein Zwischenspeicher wird dabei angewendet), dann erst ein Show-Deep-Link (im Verbundmodus lädt der Rundown also nichts daraus).
- **Conductor (17.4)**: sammelt alle Funde der Rolle `launcher`; gewählt wird über `waehleLauncher(funde, kopplungFuerWahl(), istHostDieserRechner)` bei jedem Fund und bei jedem Verbund-Wechsel (`beiWechsel` → `neuWaehlen()`). Ein Slave ohne Kopplung (`masterId` leer) gilt als Einzelplatz (16.1). Manuelle Endpunkte behalten Vorrang (`mergeEndpoints`). `neuWaehlen()` baut erst nach `start()` Clients (Token/TLS sind dann gelesen). Andere Rollen bleiben bei „zuletzt gefunden“ (FA4).

**Die 21 `showPfad`-Treffer in `apps/rundown/src/main/index.ts`** (`grep -n showPfad`, Stand `5f8ed15ef8`; nach C18 sind es 20 Zeilen: sechs Treffer verlieren `showPfad` (137, 157, 181, 182, 299, 412), fünf neue kommen in Kommentar und Helfern dazu):

| # | Ist-Zeile | Stelle | Behandlung in C18 |
| --- | --- | --- | --- |
| 1 | 95 | `let showPfad` (Zustand) | bleibt; daneben neu `masterQuelle`, `masterShow`, `dokumentHinweisFuer` |
| 2 | 137 | `mitIveo()` | `hatShow()` statt `showPfad !== null` |
| 3 | 157 | `buildState().showGemerkt` | `hatShow()` (Sperren 4.5 gelten auch für die Master-Show) |
| 4 | 181 | `sichere()`: `if (showPfad)` | `const q = gedaechtnisQuelle(); if (q)` |
| 5 | 182 | `sichere()`: Sperre gegen `gedaechtnisSchluessel(showPfad)` | gegen `gedaechtnisSchluesselFuer(q)` |
| 6 | 192 | `sichere()`: Inhalt `showPfad` | `q.art === 'pfad' ? q.showPfad : ''`, dazu `quelle`/`masterId`/`masterSchluessel` bei Master |
| 7 | 299 | `uebernimmBearbeitung`: `if (showPfad)` | `hatShow()` (Absicherung 4.5 auch im Verbund) |
| 8 | 321 | `vergissShow`: `showPfad = null` | bleibt, danach `vergissMaster()` |
| 9 | 412 | `doNav`: `if (showPfad) sichere()` | `hatShow()` (scharfe Zeile ins Gedächtnis der Master-Show) |
| 10 | 448 | `saveDialog`: `showPfad && showRundownDatei && …` | unverändert: bei der Master-Show ist `showRundownDatei` immer `null` (die Datei wird auf B nicht geladen), 4.8 greift dort nicht |
| 11 | 657 | `ladeAndereShow`: `showPfad = pfad` | bleibt, danach `vergissMaster()` (eigene Show ersetzt die Master-Daten) |
| 12 | 659 | `ladeAndereShow`: `schreibeZeiger(…, { showPfad: pfad, schluessel })` | unverändert (Pfad-Form der Union) |
| 13 | 747 | `reloadShow`: `if (!showPfad)` | unverändert: im Verbundmodus wird RELOAD vorher abgefangen; mit Master-Show außerhalb (`frueher`) warnt RELOAD wie 2a ohne eigene Show |
| 14 | 753 | `reloadShow`: `leseShowSicher(showPfad)` | unverändert (nur eigene Show) |
| 15 | 765 | `reloadShow`: `ladeAndereShow(showPfad, g)` | unverändert (`ladeAndereShow` vergisst den Master) |
| 16 | 769 | `reloadShow`: `rundownDateiDerShow(showPfad, …)` | unverändert |
| 17 | 790 | `applyShowFromDeepLink`: gleiche Show über `gedaechtnisSchluessel(showPfad)` | unverändert; im Verbundmodus vorher abgefangen (nichts geladen, E24, `showLinkWeg`); mit Master-Show außerhalb ist `showPfad` `null` → „andere Show“ |
| 18 | 815 | `starteOhneDeepLink`: `leseShowSicher(z.showPfad)` | davor Master-Zeiger → `starteMitMasterZeiger(z)`; Pfad-Zweig unverändert |
| 19 | 817 | `starteOhneDeepLink`: `ladeAndereShow(z.showPfad, g)` | unverändert |
| 20 | 822 | `starteOhneDeepLink`: `gedaechtnisSchluessel(z.showPfad)` | unverändert (Pfad-Zeiger) |
| 21 | 824 | `starteOhneDeepLink`: `showPfad = z.showPfad` | bleibt, danach `vergissMaster()` |

Neue Lesestellen für die Master-Show stehen nur in den neuen Funktionen (`hatShow`, `gedaechtnisQuelle`, `aktuellerZeiger`, `vergissMaster`, `starteMitMasterZeiger`, `ladeMasterShow`, `aktualisiereMasterShow`) und in `openDialog` und `rundown:new`, die im Verbundmodus `masterShow` an `gleicheMitMasterAb` geben; keine davon bildet einen Schlüssel aus einem leeren Pfad. `applyShowFromDeepLink` liest im Verbundmodus nichts von der Master-Show (N15).

---

- [ ] **Step 1: Conductor sammelt Launcher-Funde** (`apps/rundown/src/main/conductor.ts`, Edit-Werkzeug)

Ersetzung 1 (Zeilen 12–13), Vorher:
```ts
import { mergeEndpoints } from '@shared/conductor';
import type { Endpoint, ToolLink } from '@shared/types';
```
Nachher:
```ts
import { mergeEndpoints, waehleLauncher, type KopplungFuerWahl } from '@shared/conductor';
import type { Endpoint, ToolLink } from '@shared/types';

/** Woher die Launcher-Wahl Kopplung und „dieser Rechner“ bekommt (Spec 17.4; im Main aus @jm/app-runtime). */
export interface LauncherWahl {
  kopplung(): KopplungFuerWahl | null;
  istHier(host: string): boolean;
}
```
Ersetzung 2 (Zeilen 39–42), Vorher:
```ts
  /** mDNS-Prüf-Key (secure-Modus, A3 #59) → gefälschte Annoncen werden verworfen. */
  private verifyKey: string | undefined;

  constructor(private readonly onChange: () => void) {}
```
Nachher:
```ts
  /** mDNS-Prüf-Key (secure-Modus, A3 #59) → gefälschte Annoncen werden verworfen. */
  private verifyKey: string | undefined;
  /** Alle Funde der Rolle `launcher` (Spec 17.4, Z2): gewählt wird über `waehleLauncher`, nicht „der letzte“. */
  private launcherFunde: Endpoint[] = [];
  /** start() lief: erst dann darf ein Verbund-Wechsel Clients aufbauen (Token/TLS sind dann gelesen). */
  private gestartet = false;

  constructor(
    private readonly onChange: () => void,
    private readonly launcherWahl?: LauncherWahl,
  ) {}
```
Ersetzung 3 (Zeilen 53–55), Vorher:
```ts
      this.verifyKey = mdnsSignKey(cfg);
    }
    if (this.discovery) return;
```
Nachher:
```ts
      this.verifyKey = mdnsSignKey(cfg);
    }
    this.gestartet = true;
    if (this.discovery) return;
```
Ersetzung 4 (Zeilen 84–94), Vorher:
```ts
    const next: Record<string, Endpoint> = {};
    for (const s of svcs) {
      if (this.isControl(s)) next[s.role] = { host: s.host, port: s.port };
    }
    this.discovered = next;
    this.reconcile();
  }

  /** Verbindungen an die gewünschten Endpunkte (mDNS + Overrides) angleichen. */
  private reconcile(): void {
    const want = mergeEndpoints(this.discovered, this.overrides);
```
Nachher:
```ts
    const next: Record<string, Endpoint> = {};
    const launcher: Endpoint[] = [];
    for (const s of svcs) {
      if (!this.isControl(s)) continue;
      // Launcher: alle Funde sammeln (17.4); andere Rollen bleiben bei „zuletzt gefunden“ (FA4).
      if (s.role === 'launcher') launcher.push({ host: s.host, port: s.port });
      else next[s.role] = { host: s.host, port: s.port };
    }
    this.launcherFunde = launcher;
    this.discovered = next;
    this.reconcile();
  }

  /** Verbund gewechselt (Kopplung, Verbindung zum Master): den Launcher neu wählen (Spec 17.4). */
  neuWaehlen(): void {
    if (this.gestartet) this.reconcile();
  }

  /** Gewählter Launcher: über `waehleLauncher`, ohne Verbund-Anbindung wie bisher der letzte Fund. */
  private launcherEndpunkt(): Endpoint | null {
    if (!this.launcherWahl) return this.launcherFunde[this.launcherFunde.length - 1] ?? null;
    const wahl = this.launcherWahl;
    return waehleLauncher(this.launcherFunde, wahl.kopplung(), (host) => wahl.istHier(host));
  }

  /** Verbindungen an die gewünschten Endpunkte (mDNS + Overrides) angleichen. */
  private reconcile(): void {
    const launcher = this.launcherEndpunkt();
    const want = mergeEndpoints(launcher ? { ...this.discovered, launcher } : this.discovered, this.overrides);
```

- [ ] **Step 2: Main — Importe** (`apps/rundown/src/main/index.ts`)

Ersetzung 1 (Zeile 4), Vorher:
```ts
import { initAppRuntime, getLog } from '@jm/app-runtime';
```
Nachher:
```ts
import {
  initAppRuntime,
  getLog,
  folgeMasterShow,
  imVerbundmodus,
  istHostDieserRechner,
  kuerzeName,
  nichtAngewendet,
  verbundDatenErsetzt,
  verbundIgnoriert,
  verbundKopplung,
  type MasterStand,
} from '@jm/app-runtime';
```
Ersetzung 2 (Zeile 8), Vorher:
```ts
import { buildActionLine, navigate, newId } from '@shared/conductor';
```
Nachher:
```ts
import {
  buildActionLine,
  dokumentHinweis,
  entscheideMasterStand,
  HINWEIS_RUNDOWN_DATEI_AM_MASTER,
  masterAusgang,
  navigate,
  newId,
  showLinkWeg,
  type KopplungFuerWahl,
} from '@shared/conductor';
```
Ersetzung 3 (Zeilen 55–58), Vorher:
```ts
import {
  dateiStand,
  gedaechtnisSchluessel,
  legeGedaechtnisFehlerBei,
```
Nachher:
```ts
import {
  ausShow,
  dateiStand,
  gedaechtnisSchluessel,
  gedaechtnisSchluesselFuer,
  legeGedaechtnisFehlerBei,
```
Ersetzung 4 (Zeilen 68–70), Vorher:
```ts
  sichereDefektesGedaechtnis,
  type ShowGelesen,
} from './gedaechtnis';
```
Nachher:
```ts
  sichereDefektesGedaechtnis,
  type GedaechtnisQuelle,
  type ShowGelesen,
  type Zeiger,
} from './gedaechtnis';
```

- [ ] **Step 3: Main — Zustand, Conductor mit Launcher-Wahl, Helfer** (Treffer 1)

Ersetzung 1 (Zeilen 94–95), Vorher:
```ts
/** Absoluter Pfad der gemerkten Show (5.2) oder null. */
let showPfad: string | null = null;
```
Nachher:
```ts
/** Absoluter Pfad der gemerkten Show (5.2) oder null. */
let showPfad: string | null = null;
/**
 * Gemerkte Show vom Master im Verbund (Teil 2b, Spec 17.3): masterId und Schlüssel der Show am Master.
 * Schließt `showPfad` aus (dann null). Jede Stelle, die „gemerkte Show“ meint, fragt `hatShow()`,
 * jede Stelle, die das Gedächtnis meint, `gedaechtnisQuelle()` (#235).
 */
let masterQuelle: { masterId: string; masterSchluessel: string } | null = null;
/** Zuletzt angewendete Show vom Master: Abgleich für „Öffnen…“ und „Neu“ im Verbundmodus (17.3). */
let masterShow: Show | null = null;
/** Show (masterId|Schlüssel), zu der die Logzeile „Rundown-Datei liegt am Master“ zuletzt geschrieben wurde. */
let dokumentHinweisFuer: string | null = null;
```
Ersetzung 2 (Zeile 128), Vorher:
```ts
const conductor = new Conductor(() => broadcastLinks());
```
Nachher:
```ts
const conductor = new Conductor(() => broadcastLinks(), {
  kopplung: () => kopplungFuerWahl(),
  istHier: (host) => istHostDieserRechner(host),
});

/** Kopplung für die Launcher-Wahl (Spec 17.4). Slave ohne Kopplung gilt als Einzelplatz (16.1). */
function kopplungFuerWahl(): KopplungFuerWahl | null {
  const k = verbundKopplung();
  if (!k || (k.rolle === 'slave' && !k.masterId)) return null;
  return { rolle: k.rolle, masterAdresse: k.masterAdresse, adressen: k.adressen, letzteAdresse: k.letzteAdresse };
}

/** Ist eine Show gemerkt — eine Show-Datei oder die Show vom Master (Spec 17.3)? */
function hatShow(): boolean {
  return showPfad !== null || masterQuelle !== null;
}

/** Wozu das Gedächtnis gehört (Spec 17.3); null ohne gemerkte Show. Nie ein leerer Pfad (#235). */
function gedaechtnisQuelle(): GedaechtnisQuelle | null {
  if (showPfad) return { art: 'pfad', showPfad };
  if (masterQuelle) return { art: 'master', masterId: masterQuelle.masterId, schluessel: masterQuelle.masterSchluessel };
  return null;
}

/** Zeiger der gemerkten Show, wie er im Speicher steht — Grundlage für „neue oder gleiche Show“ (17.3). */
function aktuellerZeiger(): Zeiger | null {
  const q = gedaechtnisQuelle();
  if (!q) return null;
  const schluessel = gedaechtnisSchluesselFuer(q);
  if (q.art === 'pfad') return { showPfad: q.showPfad, schluessel };
  return { quelle: 'master', masterId: q.masterId, masterSchluessel: q.schluessel, showName, schluessel };
}
```
(Die Funktionen sind Deklarationen und damit beim Aufbau des Conductors schon da; aufgerufen werden sie erst später.)

- [ ] **Step 4: Main — Treffer 2–7, 9 und RELOAD im Verbundmodus**

Ersetzung 1 (Treffer 2, Zeile 137), Vorher:
```ts
  return showPfad !== null ? showHatIveo : kontextIstIveo(doc.kontext);
```
Nachher:
```ts
  return hatShow() ? showHatIveo : kontextIstIveo(doc.kontext);
```
Ersetzung 2 (Treffer 3, Zeile 157), Vorher:
```ts
    showGemerkt: showPfad !== null,
```
Nachher:
```ts
    showGemerkt: hatShow(),
```
Ersetzung 3 (Treffer 4–6, `sichere`, Zeilen 179–198), Vorher:
```ts
/** Stand sichern (4.7): mit gemerkter Show ins Gedächtnis, sonst wie bisher in den Autosave. */
function sichere(): void {
  if (showPfad) {
    if (gedaechtnisSperre !== null && gedaechtnisSperre === gedaechtnisSchluessel(showPfad)) {
      // Das Gedächtnis war nicht lesbar: nicht überschreiben, bis ein Lesen wieder gelingt.
      if (!sperreGemeldet) {
        sperreGemeldet = true;
        getLog().warn('Gedächtnis der Show ist gesperrt (nicht lesbar), Stand wird nicht ins Gedächtnis geschrieben.');
      }
      return;
    }
    const ok = schreibeGedaechtnis(regieOrdner(), {
      schemaVersion: 2,
      showPfad,
      showName,
      doc,
      scharfId,
      gespeichertAm: new Date().toISOString(),
      ...(gedaechtnisDatei ? { datei: gedaechtnisDatei } : {}),
    });
```
Nachher:
```ts
/**
 * Stand sichern (4.7): mit gemerkter Show ins Gedächtnis, sonst wie bisher in den Autosave. Das Gedächtnis
 * einer Show vom Master liegt unter dem Master-Schlüssel, mit `quelle: 'master'` und leerem Pfad (17.3).
 */
function sichere(): void {
  const q = gedaechtnisQuelle();
  if (q) {
    if (gedaechtnisSperre !== null && gedaechtnisSperre === gedaechtnisSchluesselFuer(q)) {
      // Das Gedächtnis war nicht lesbar: nicht überschreiben, bis ein Lesen wieder gelingt.
      if (!sperreGemeldet) {
        sperreGemeldet = true;
        getLog().warn('Gedächtnis der Show ist gesperrt (nicht lesbar), Stand wird nicht ins Gedächtnis geschrieben.');
      }
      return;
    }
    const ok = schreibeGedaechtnis(regieOrdner(), {
      schemaVersion: 2,
      showPfad: q.art === 'pfad' ? q.showPfad : '',
      showName,
      doc,
      scharfId,
      gespeichertAm: new Date().toISOString(),
      ...(gedaechtnisDatei ? { datei: gedaechtnisDatei } : {}),
      ...(q.art === 'master' ? { quelle: 'master' as const, masterId: q.masterId, masterSchluessel: q.schluessel } : {}),
    });
```
Ersetzung 4 (`case 'reload'`, Zeilen 244–248), Vorher:
```ts
    case 'reload':
      // Vom Launcher nach einer iveo-Änderung (7.1). Intern wie TIMER RELOAD, nicht
      // im Companion-Katalog. Mehrere binnen 300 ms → ein Abgleich (5.1).
      buendleReload(() => reloadShow());
      break;
```
Nachher:
```ts
    case 'reload':
      // Vom Launcher nach einer iveo-Änderung (7.1). Intern wie TIMER RELOAD, nicht
      // im Companion-Katalog. Mehrere binnen 300 ms → ein Abgleich (5.1).
      // Im Verbundmodus ignoriert: die Show-Daten kommen vom Master (Spec 16.1).
      if (imVerbundmodus()) {
        verbundIgnoriert('reload');
        break;
      }
      buendleReload(() => reloadShow());
      break;
```
Ersetzung 5 (Treffer 7, Zeilen 298–299), Vorher:
```ts
  let rows = next.rows;
  if (showPfad) {
```
Nachher:
```ts
  let rows = next.rows;
  if (hatShow()) {
```
Ersetzung 6 (Treffer 9, Zeilen 411–412), Vorher:
```ts
  // Die scharfe Zeile gehört ins Gedächtnis (4.7); der Autosave kennt sie nicht.
  if (showPfad) sichere();
```
Nachher:
```ts
  // Die scharfe Zeile gehört ins Gedächtnis (4.7); der Autosave kennt sie nicht.
  if (hatShow()) sichere();
```

- [ ] **Step 5: Main — „Öffnen…“/„Neu“, Master vergessen** (Treffer 8)

Ersetzung 1 (Zeilen 319–322), Vorher:
```ts
/** „Öffnen…“ und „Neu“ (5.2): gemerkte Show und Zeiger vergessen; ein folgendes RELOAD warnt. */
function vergissShow(): void {
  showPfad = null;
  showName = '';
```
Nachher:
```ts
/**
 * „Öffnen…“ und „Neu“ außerhalb des Verbundmodus (5.2): gemerkte Show und Zeiger vergessen; ein folgendes
 * RELOAD warnt. Das gilt auch für Daten eines früheren Masters: Zwischenspeicher weg (Ergänzung zu E16).
 */
function vergissShow(): void {
  showPfad = null;
  vergissMaster();
  showName = '';
```
Ersetzung 2 (Ende von `vergissShow`, Zeilen 328–331), Vorher:
```ts
  loescheZeiger(regieOrdner());
}

// ── Verzögerte GO-Feuerung (Issue #80) ───────────────────────────────────────
```
Nachher:
```ts
  loescheZeiger(regieOrdner());
}

/**
 * Eine eigene Show oder ein eigenes Dokument gilt: die Show eines früheren Masters vergessen, ihren
 * Hinweis entfernen und den Zwischenspeicher löschen (`verbundDatenErsetzt`, Spec 16.1, E16).
 */
function vergissMaster(): void {
  masterQuelle = null;
  masterShow = null;
  dokumentHinweisFuer = null;
  hinweise = ohneHinweisText(hinweise, HINWEIS_RUNDOWN_DATEI_AM_MASTER);
  verbundDatenErsetzt();
}

/**
 * „Öffnen…“ und „Neu“ im Verbundmodus (Spec 17.3): Die Show vom Master bleibt gemerkt. Das Dokument wird
 * Ausgangsstand und sofort mit dem angewendeten Stand abgeglichen; „Speichern“ schreibt in `nextPath` (4.8).
 * Bricht ausstehende GO-Folgen ab wie „Öffnen…“ in 2a (5.4).
 */
function gleicheMitMasterAb(start: RundownDoc, nextPath: string | null, show: Show): void {
  cancelPendingFires();
  lastFired = null;
  const ausgang = migrate(start);
  const res = wendeShowAn({ doc: ausgang, scharfId: ersteLebendeZeile(ausgang.rows), show });
  merkeUmbenennungen(res.umbenannt);
  doc = migrate(res.doc);
  scharfId = res.scharfId;
  filePath = nextPath;
  dirty = false;
  rev++;
  abgleichRev = rev;
  sichere();
  broadcast();
}

// ── Verzögerte GO-Feuerung (Issue #80) ───────────────────────────────────────
```
Ersetzung 3 (`openDialog`, Zeilen 422–426), Vorher:
```ts
  try {
    const d = readDoc(r.filePaths[0]);
    vergissShow();
    ersetzeDoc(d, r.filePaths[0]);
  } catch (err) {
```
Nachher:
```ts
  try {
    const d = readDoc(r.filePaths[0]);
    // Im Verbundmodus bleibt die Show vom Master: die Datei wird Ausgangsstand und sofort abgeglichen (17.3).
    if (imVerbundmodus() && masterShow) {
      gleicheMitMasterAb(d, r.filePaths[0], masterShow);
    } else {
      vergissShow();
      ersetzeDoc(d, r.filePaths[0]);
    }
  } catch (err) {
```
Ersetzung 4 (`rundown:new`, Zeilen 546–550), Vorher:
```ts
  ipcMain.handle('rundown:new', () => {
    vergissShow();
    ersetzeDoc(defaultDoc(), null);
    return buildState();
  });
```
Nachher:
```ts
  ipcMain.handle('rundown:new', () => {
    // Im Verbundmodus: leeres Dokument, sofort mit der Show vom Master abgeglichen (17.3).
    if (imVerbundmodus() && masterShow) {
      gleicheMitMasterAb({ schemaVersion: 2, name: masterShow.name, rows: [] }, null, masterShow);
    } else {
      vergissShow();
      ersetzeDoc(defaultDoc(), null);
    }
    return buildState();
  });
```
(`gleicheMitMasterAb` steht vor `registerIpc` und `openDialog`; `merkeUmbenennungen` und `ersteLebendeZeile` sind Deklarationen bzw. Importe und damit verfügbar.)

- [ ] **Step 6: Main — eigene Show vergisst den Master, Deep-Link im Verbundmodus** (Treffer 11, 17)

Ersetzung 1 (`ladeAndereShow`, Zeilen 656–663), Vorher:
```ts
  merkeShowDaten(g);
  showPfad = pfad;
  showRundownDatei = rdPfad;
  if (!schreibeZeiger(regieOrdner(), { showPfad: pfad, schluessel })) {
    getLog().warn('Zeiger auf die gemerkte Show konnte nicht geschrieben werden.');
  }

  if (g.ablaufSchluessel.length === 0 && !rdPfad && !gedaechtnis) {
```
Nachher:
```ts
  merkeShowDaten(g);
  showPfad = pfad;
  showRundownDatei = rdPfad;
  // Eine eigene Show ersetzt die Daten eines früheren Masters (Spec 16.1, E16).
  vergissMaster();
  if (!schreibeZeiger(regieOrdner(), { showPfad: pfad, schluessel })) {
    getLog().warn('Zeiger auf die gemerkte Show konnte nicht geschrieben werden.');
  }

  if (g.ablaufSchluessel.length === 0 && !rdPfad && !gedaechtnis) {
```
Ersetzung 2 (`applyShowFromDeepLink`, Zeilen 785–789), Vorher:
```ts
/** Show-Deep-Link (5.2). Liefert true, wenn es ein Show-Link war. */
function applyShowFromDeepLink(url: string): boolean {
  const roh = parseShowDeepLink(url);
  if (!roh) return false;
  const pfad = path.resolve(roh);
```
Nachher:
```ts
/** Show-Deep-Link (5.2). Liefert true, wenn es ein Show-Link war. */
function applyShowFromDeepLink(url: string): boolean {
  const roh = parseShowDeepLink(url);
  if (!roh) return false;
  // Im Verbundmodus lädt der Rundown aus dem Link nichts, weder Daten noch Dokument (17.3 vor 16.1, E24); die Regel
  // und die eigene Logzeile sind rein und in C17 getestet (showLinkWeg). Die allgemeine 16.1-Zeile „… liefert hier
  // nur Dokumente …“ träfe hier nicht zu: Der Rundown lädt nichts.
  const weg = showLinkWeg(imVerbundmodus(), roh, kuerzeName);
  if (weg.weg === 'ignorieren') {
    getLog().info(weg.log);
    return true;
  }
  const pfad = path.resolve(roh);
```

- [ ] **Step 7: Main — Start über den Master-Zeiger, Stand vom Master anwenden** (Treffer 18, 21; Stand nach C17)

Ersetzung 1 (Anfang von `starteOhneDeepLink` und Zweig „nicht lesbar“), Vorher:
```ts
function starteOhneDeepLink(): void {
  const z = leseZeiger(regieOrdner());
  // Zeiger mit quelle master (Spec 17.3) kommt mit C18; bis dahin wie Rundown 0.7: ignoriert.
  if (!z || 'quelle' in z) return;
  const g = leseShowSicher(z.showPfad);
  if (g.ok) {
    ladeAndereShow(z.showPfad, g);
    return;
  }
  getLog().error(`Gemerkte Show: ${showNichtLesbarText(g.grund)}`);
  hinweis(showNichtLesbarText(g.grund), 'kurz');
  const gedaechtnis = leseGedaechtnisMitMeldung(gedaechtnisSchluessel(z.showPfad));
  if (gedaechtnis) {
    showPfad = z.showPfad;
    showName = gedaechtnis.showName;
```
Nachher:
```ts
function starteOhneDeepLink(): void {
  const z = leseZeiger(regieOrdner());
  if (!z) return;
  if ('quelle' in z) {
    starteMitMasterZeiger(z);
    return;
  }
  const g = leseShowSicher(z.showPfad);
  if (g.ok) {
    ladeAndereShow(z.showPfad, g);
    return;
  }
  getLog().error(`Gemerkte Show: ${showNichtLesbarText(g.grund)}`);
  hinweis(showNichtLesbarText(g.grund), 'kurz');
  const gedaechtnis = leseGedaechtnisMitMeldung(gedaechtnisSchluessel(z.showPfad));
  if (gedaechtnis) {
    showPfad = z.showPfad;
    vergissMaster();
    showName = gedaechtnis.showName;
```
Ersetzung 2 (Ende von `starteOhneDeepLink`, vor `function rendererUrl`), Vorher:
```ts
    ablaufSchluessel = ablaufSchluesselAusZeilen(doc.rows);
    eigeneTimerListe = false;
    showHatIveo = kontextIstIveo(doc.kontext);
    rev++;
    abgleichRev = rev;
  }
  broadcast();
}

function rendererUrl(): string | undefined {
```
Nachher:
```ts
    ablaufSchluessel = ablaufSchluesselAusZeilen(doc.rows);
    eigeneTimerListe = false;
    showHatIveo = kontextIstIveo(doc.kontext);
    rev++;
    abgleichRev = rev;
  }
  broadcast();
}

// ── Verbund (Teil 2b R2, Spec 16, 17.3): Show vom Master ─────────────────────

/**
 * Start ohne Deep-Link, Zeiger mit `quelle: 'master'` (Spec 17.3): Gedächtnis mit Master-Schlüssel laden.
 * Den Stand dazu bringt danach der Zwischenspeicher (wie „neuer Stand, gleiche Show“) oder der nächste Stand;
 * die Anzeige (16.4) sagt, worauf der Rundown wartet. Ohne lesbares Gedächtnis bleibt der Autosave, und der
 * erste Stand lädt die Show wie eine andere (Übergang nach dem Namen).
 */
function starteMitMasterZeiger(z: Extract<Zeiger, { quelle: 'master' }>): void {
  const gedaechtnis = leseGedaechtnisMitMeldung(gedaechtnisSchluesselFuer({ art: 'master', masterId: z.masterId, schluessel: z.masterSchluessel }));
  if (gedaechtnis) {
    masterQuelle = { masterId: z.masterId, masterSchluessel: z.masterSchluessel };
    showName = gedaechtnis.showName || z.showName;
    doc = gedaechtnis.doc;
    const gemerkt = gedaechtnis.scharfId;
    scharfId = gemerkt !== null && doc.rows.some((r) => r.id === gemerkt) ? gemerkt : ersteLebendeZeile(doc.rows);
    // Ohne Stand: Schlüssel aus den lebenden Ablaufzeilen, iveo aus dem Kontext (wie oben, Show nicht lesbar).
    ablaufSchluessel = ablaufSchluesselAusZeilen(doc.rows);
    eigeneTimerListe = false;
    showHatIveo = kontextIstIveo(doc.kontext);
    rev++;
    abgleichRev = rev;
  }
  broadcast();
}

/**
 * Stehender Hinweis, wenn die Show am Master eine eigene Rundown-Datei trägt (Spec 17.3): einmal je Show
 * gezeigt und geloggt (weggeklickt bleibt er weg, bis eine andere Show kommt); ohne Datei entfernt.
 */
function zeigeDokumentHinweis(stand: MasterStand, masterSchluessel: string): void {
  // Die Regel „einmal je Show“ ist rein und in C17 getestet (dokumentHinweis, N9).
  const h = dokumentHinweis(dokumentHinweisFuer, stand, masterSchluessel);
  dokumentHinweisFuer = h.fuer;
  if (h.fuer === null) {
    hinweise = ohneHinweisText(hinweise, HINWEIS_RUNDOWN_DATEI_AM_MASTER);
    return;
  }
  if (!h.zeigen) return;
  getLog().info(HINWEIS_RUNDOWN_DATEI_AM_MASTER);
  if (!hinweise.some((x) => x.text === HINWEIS_RUNDOWN_DATEI_AM_MASTER)) hinweis(HINWEIS_RUNDOWN_DATEI_AM_MASTER, 'stehend');
}

/**
 * Stand mit neuer Show (Spec 17.3, wie `ladeAndereShow`): Ausgangsstand aus dem Gedächtnis mit Master-Schlüssel →
 * Übergang (gleicher Name: der aktuelle Stand) → leer (`masterAusgang`, C17), dann `wendeShowAn`. Die eigene
 * Rundown-Datei der Show wird auf B nicht geladen. Erst wird gerechnet, dann der Zustand gesetzt (N9): Wirft das
 * Rechnen, bleibt alles beim Alten, und der nächste Versuch des Folgers (16.2) lädt die Show wieder als neue — nicht
 * über `entscheideMasterStand` als „gleich“ auf das alte Dokument. Bricht laufende GO-Folgen ab wie bisher (5.4).
 */
function ladeMasterShow(stand: MasterStand & { show: Show }, masterSchluessel: string): void {
  const g = ausShow(stand.show);
  const schluessel = gedaechtnisSchluesselFuer({ art: 'master', masterId: stand.masterId, schluessel: masterSchluessel });
  const gedaechtnis = leseGedaechtnisMitMeldung(schluessel);
  const weg = masterAusgang({
    mitGedaechtnis: gedaechtnis !== null,
    ablaufLeer: g.ablaufSchluessel.length === 0,
    docName: doc.name,
    showName: g.show.name,
  });

  // Rechnen (kann werfen): Ausgangsstand und Abgleich.
  let start: RundownDoc = { schemaVersion: 2, name: g.show.name, rows: [] };
  let startScharf: string | null = null;
  if (weg === 'gedaechtnis' && gedaechtnis) {
    start = gedaechtnis.doc;
    startScharf = gedaechtnis.scharfId;
  } else if (weg === 'uebergang') {
    start = doc;
    startScharf = scharfId;
  }
  const res = weg === 'bleibt' ? null : wendeShowAn({ doc: start, scharfId: startScharf, show: g.show });
  const neuDoc = res ? migrate(res.doc) : null;

  // Ab hier den Zustand setzen: die Show vom Master ist gemerkt.
  merkeShowDaten(g);
  showPfad = null;
  masterQuelle = { masterId: stand.masterId, masterSchluessel };
  masterShow = stand.show;
  showRundownDatei = null;
  gedaechtnisDatei = null;
  const zeiger: Zeiger = { quelle: 'master', masterId: stand.masterId, masterSchluessel, showName: g.show.name, schluessel };
  if (!schreibeZeiger(regieOrdner(), zeiger)) getLog().warn('Zeiger auf die gemerkte Show konnte nicht geschrieben werden.');
  hinweis(`Show vom Master „${g.show.name}“ übernommen.`, 'kurz');
  zeigeDokumentHinweis(stand, masterSchluessel);

  if (!res || !neuDoc) {
    // Wie 5.2 (`bleibt`): Show ohne Ablauf → merken, das aktuelle Dokument bleibt unangetastet und wird NICHT als
    // Gedächtnis dieser Show geschrieben. Bekommt sie einen Ablauf, lädt der nächste Stand sie neu.
    rev++;
    abgleichRev = rev;
    broadcast();
    return;
  }

  dirty = false;
  filePath = null;
  cancelPendingFires();
  lastFired = null;
  merkeUmbenennungen(res.umbenannt);
  doc = neuDoc;
  scharfId = res.scharfId;
  rev++;
  abgleichRev = rev;
  if (start.kontext !== undefined) zeigeAbgleichHinweise(res, g.show);
  sichere();
  broadcast();
}

/**
 * Neuer Stand derselben Show (Spec 17.3, wie `reloadShow`): `wendeShowAn`, Position nach R7 bzw. 4.4, bricht
 * keine GO-Folge ab (5.4). Hatte die Show keinen Ablauf und hat jetzt einen → wie eine andere Show (5.2).
 */
function aktualisiereMasterShow(stand: MasterStand & { show: Show }, masterSchluessel: string): void {
  const g = ausShow(stand.show);
  // Sperre prüfen: ein Lesen, das jetzt gelingt, hebt sie auf (Ruling Fix-Runde 1).
  if (gedaechtnisSperre !== null) leseGedaechtnisMitMeldung(gedaechtnisSperre);
  if (ablaufNeuEntstanden(ablaufSchluessel.length === 0, g.ablaufSchluessel.length)) {
    ladeMasterShow(stand, masterSchluessel);
    return;
  }
  merkeShowDaten(g);
  masterShow = stand.show;
  zeigeDokumentHinweis(stand, masterSchluessel);
  const res = wendeShowAn({ doc, scharfId, show: g.show });
  merkeUmbenennungen(res.umbenannt);
  const neu = migrate(res.doc);
  if (res.scharfId !== scharfId || JSON.stringify(neu) !== JSON.stringify(doc)) {
    doc = neu;
    scharfId = res.scharfId;
    rev++;
    abgleichRev = rev;
    if (filePath) dirty = true;
    sichere();
  }
  zeigeAbgleichHinweise(res, g.show);
  broadcast();
}

/**
 * Stand vom Master anwenden (`folgeMasterShow`, Spec 16.2, 17.3). Neue oder gleiche Show entscheidet der
 * Zeiger (gemerkte Show), nicht `neueShow` — so passt es auch beim Start mit dem Zwischenspeicher. Wirft
 * = nicht angewendet (app-runtime zeigt V12 und versucht es erneut).
 */
function wendeMasterStandAn(stand: MasterStand & { show: Show }): void {
  const masterSchluessel = stand.schluessel;
  // Laut 13.1 ausgeschlossen; V12 zeigt dann „… nicht übernommen: SCHLUESSEL_FEHLT“ (N3).
  if (masterSchluessel === null) throw nichtAngewendet('SCHLUESSEL_FEHLT');
  if (entscheideMasterStand(aktuellerZeiger(), stand) === 'gleich') aktualisiereMasterShow(stand, masterSchluessel);
  else ladeMasterShow(stand, masterSchluessel);
}

function rendererUrl(): string | undefined {
```

- [ ] **Step 8: Main — Reihenfolge beim Start** (Zeilen 917–921 im Stand nach C17), Vorher:
```ts
    registerIpc();
    createMainWindow();
    // Ein Show-Deep-Link hat Vorrang; sonst führt der Zeiger zur gemerkten Show (5.2).
    const perShowLink = runtime.initialDeepLink ? applyShowFromDeepLink(runtime.initialDeepLink) : false;
    if (!perShowLink) starteOhneDeepLink();
```
Nachher:
```ts
    registerIpc();
    createMainWindow();
    // Ein Show-Deep-Link hat Vorrang; sonst führt der Zeiger zur gemerkten Show (5.2). Dem Master folgen
    // (Spec 16, 17.3) erst danach (E17): ein Zwischenspeicher wird dabei angewendet. Der Show-Deep-Link
    // kommt erst nach der Anmeldung beim Verbund: Im Verbundmodus lädt der Rundown so nichts daraus (E24, 17.3, 16.3).
    const link = runtime.initialDeepLink;
    const showLink = link !== null && parseShowDeepLink(link) !== null ? link : null;
    if (!showLink) starteOhneDeepLink();
    folgeMasterShow({
      anwenden: (stand) => wendeMasterStandAn(stand),
      // Kopplung oder Verbindung zum Master gewechselt: Launcher neu wählen (17.4).
      beiWechsel: () => conductor.neuWaehlen(),
    });
    if (showLink) applyShowFromDeepLink(showLink);
```
(Dass `beiWechsel` hier vor `conductor.start()` kommen kann, ist abgesichert: `neuWaehlen()` tut vor `start()` nichts.)

- [ ] **Step 9: Typen und Preload** (E28)

`apps/rundown/src/shared/types.ts`, Ersetzung 1 (Zeilen 165–166), Vorher:
```ts
// ── Preload-API (window.jmrundown) ───────────────────────────────────────────
export interface JmRundownApi {
```
Nachher:
```ts
/**
 * Verbund-Anzeige über die Preload-Brücke (Master-Link Teil 2b, Spec 16.4/16.5). Strukturgleich mit
 * `VerbundAnzeige` aus `@jm/app-runtime`; eigener Typ, damit die Renderer-Typprüfung app-runtime
 * (Electron-Typen) nicht einliest (E28).
 */
export interface VerbundAnzeigeZeile {
  text: string;
  farbe: 'gruen' | 'gelb' | 'rot' | 'gedaempft';
}

// ── Preload-API (window.jmrundown) ───────────────────────────────────────────
export interface JmRundownApi {
```
Ersetzung 2 (Zeilen 199–201), Vorher:
```ts
  save: () => Promise<RundownState>;
  saveAs: () => Promise<RundownState>;
}
```
Nachher:
```ts
  save: () => Promise<RundownState>;
  saveAs: () => Promise<RundownState>;
  /** Verbund-Anzeige (Spec 16.4/16.5): V-Zeile oder null (Einzelplatz). */
  verbundAnzeige: () => Promise<VerbundAnzeigeZeile | null>;
  /** Auf Wechsel der Verbund-Anzeige hören. Liefert Unsubscribe. */
  onVerbundAnzeige: (cb: (a: VerbundAnzeigeZeile | null) => void) => () => void;
}
```

`apps/rundown/src/preload/index.ts`, Ersetzung 1 (Zeile 2), Vorher:
```ts
import type { JmRundownApi, RundownDoc, RundownNav, RundownState, ToolLink } from '@shared/types';
```
Nachher:
```ts
import type { JmRundownApi, RundownDoc, RundownNav, RundownState, ToolLink, VerbundAnzeigeZeile } from '@shared/types';
```
Ersetzung 2 (Zeilen 33–34), Vorher:
```ts
  saveAs: () => ipcRenderer.invoke('rundown:saveAs') as Promise<RundownState>,
};
```
Nachher:
```ts
  saveAs: () => ipcRenderer.invoke('rundown:saveAs') as Promise<RundownState>,
  verbundAnzeige: () => (ipcRenderer.invoke('jmps:verbund-anzeige') as Promise<VerbundAnzeigeZeile | null>).catch(() => null),
  onVerbundAnzeige: (cb) => {
    const listener = (_e: unknown, a: VerbundAnzeigeZeile | null): void => cb(a);
    ipcRenderer.on('jmps:verbund-anzeige', listener);
    return () => ipcRenderer.off('jmps:verbund-anzeige', listener);
  },
};
```

- [ ] **Step 10: V-Zeile im Statusstreifen** (`apps/rundown/src/renderer/src/components/ToolLinks.tsx`, Spec 16.5)

Ersetzung 1 (Zeilen 1–2), Vorher:
```tsx
import { CAPABILITIES } from '@/lib/capabilities';
import type { ToolLink } from '@shared/types';
```
Nachher:
```tsx
import { useEffect, useState } from 'react';
import { CAPABILITIES } from '@/lib/capabilities';
import type { ToolLink, VerbundAnzeigeZeile } from '@shared/types';

const VERBUND_FARBE: Record<VerbundAnzeigeZeile['farbe'], string> = {
  gruen: 'border-[var(--success)]/50 text-[var(--success)]',
  gelb: 'border-[var(--warning)]/60 text-[var(--warning)]',
  rot: 'border-[var(--destructive)]/60 text-[var(--destructive)]',
  gedaempft: 'border-[var(--border)] text-[var(--muted-foreground)]',
};

/**
 * Verbund-Anzeige im Statusstreifen (Master-Link Teil 2b, Spec 16.4/16.5): die V-Zeile aus app-runtime,
 * gekürzt mit „…“, voller Text als Tooltip. Am Einzelplatz (null) nichts.
 */
function VerbundZeile() {
  const [anzeige, setAnzeige] = useState<VerbundAnzeigeZeile | null>(null);
  useEffect(() => {
    void window.jmrundown.verbundAnzeige().then(setAnzeige);
    return window.jmrundown.onVerbundAnzeige(setAnzeige);
  }, []);
  if (!anzeige) return null;
  return (
    <span
      title={anzeige.text}
      className={`inline-flex max-w-[28rem] shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs ${VERBUND_FARBE[anzeige.farbe]}`}
    >
      <span className="truncate">{anzeige.text}</span>
    </span>
  );
}
```
Ersetzung 2 (Zeilen 21–22), Vorher:
```tsx
    <div className="flex items-center gap-2 px-4 py-1.5">
      {links.length === 0 ? (
```
Nachher:
```tsx
    <div className="flex items-center gap-2 px-4 py-1.5">
      <VerbundZeile />
      {links.length === 0 ? (
```

- [ ] **Step 11: Typecheck, Selbsttest, Build, Zählungen**

```
npm run typecheck -w @jm/rundown
npm run selftest -w @jm/rundown 2>&1 | grep -c "^ok "
npm run build -w @jm/rundown
grep -c "jmps:verbund-anzeige" apps/rundown/out/preload/index.cjs
grep -c "folgeMasterShow(" apps/rundown/src/main/index.ts
grep -c "showPfad" apps/rundown/src/main/index.ts
grep -n "gedaechtnisSchluessel(showPfad)\|showPfad,$" apps/rundown/src/main/index.ts
grep -c "verbundIgnoriert('deeplink'" apps/rundown/src/main/index.ts
grep -c "showLinkWeg(" apps/rundown/src/main/index.ts
```
Erwartet: Typecheck node und web ohne Meldung, Exitcode 0; `552` (unverändert); `electron-vite build` dreimal `✓ built in …`, Exitcode 0; `3`; `1`; `20`; die nächste Suche genau eine Zeile, der durch `showPfad &&` geschützte Vergleich „dieselbe Show“ im Deep-Link (Treffer 17) — kein Gedächtnis-Schlüssel und kein Gedächtnis-Inhalt mehr direkt aus `showPfad` (#235):
```
924:  if (showPfad && gedaechtnisSchluessel(pfad) === gedaechtnisSchluessel(showPfad)) {
```
danach `0` (die 16.1-Zeile „… liefert hier nur Dokumente …“ ruft der Rundown nicht, E24) und `1` (der Show-Link geht über die Regel aus C17).

- [ ] **Step 12: Commit** (Git Bash, Commit-Text ohne Umlaute)

```
git add apps/rundown/src/main/conductor.ts apps/rundown/src/main/index.ts apps/rundown/src/shared/types.ts apps/rundown/src/preload/index.ts apps/rundown/src/renderer/src/components/ToolLinks.tsx
git status --short
```
Erwartet genau:
```
M  apps/rundown/src/main/conductor.ts
M  apps/rundown/src/main/index.ts
M  apps/rundown/src/preload/index.ts
M  apps/rundown/src/renderer/src/components/ToolLinks.tsx
M  apps/rundown/src/shared/types.ts
```
Dann:
```
git commit -m "feat(rundown): Show vom Master mit eigenem Gedaechtnis, Launcher-Wahl im Verbund, Verbund-Zeile (Teil 2b R2, C18)" -m "folgeMasterShow nach starteOhneDeepLink: neue oder gleiche Show entscheidet der Zeiger. Neue Show laedt das Gedaechtnis mit Master-Schluessel, Uebergang ueber den Namen, sonst leer; gleiche Show gleicht ab wie RELOAD. Eigene Rundown-Datei der Show bleibt auf B ungeladen, stehender Hinweis einmal je Show. Alle 21 showPfad-Stellen gehen ueber hatShow bzw. gedaechtnisQuelle (#235). RELOAD im Verbundmodus ignoriert; aus einem Show-Deep-Link laedt der Rundown dort nichts, weder Daten noch Dokument, mit eigener Logzeile (showLinkWeg, 17.3 vor 16.1); Oeffnen und Neu gleichen mit der Master-Show ab; Ladeweg und Hinweis ueber masterAusgang und dokumentHinweis, erst rechnen, dann Zustand setzen; eigene Show vergisst den Master (verbundDatenErsetzt). Conductor sammelt Launcher-Funde und waehlt ueber waehleLauncher, neu bei jedem Fund und Verbund-Wechsel." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- **Show-Deep-Link beim Start nach der Registrierung** (wie C16): E17 nennt „nach `starteOhneDeepLink()`“; mit einem Show-Deep-Link läuft `starteOhneDeepLink()` wie bisher nicht, die Registrierung kommt dann direkt vor dem Deep-Link. Sonst wäre `imVerbundmodus()` beim Start-Deep-Link noch falsch, und der Start-Deep-Link ersetzte die Master-Daten (E24 griffe beim Start nicht).
- **Ergänzung zu E16** (E56; Owner-Frage 5, vom Owner am 08.10.2026 geschlossen): „Öffnen…“ und „Neu“ außerhalb des Verbundmodus vergessen auch die Show eines früheren Masters und rufen `verbundDatenErsetzt()` — wie 2a „gemerkte Show und Zeiger vergessen“. Ohne das legte ein Neustart nach „entkoppelt, dann Datei geöffnet“ das Master-Gedächtnis über das geöffnete Dokument (C12 wendet den Zwischenspeicher beim Start immer an).
- **`App.tsx` unverändert**: Die V-Zeile abonniert `ToolLinks` selbst; `App.tsx:163` reicht wie bisher nur `links`.
- **`Conductor`**: zweiter Konstruktor-Parameter `LauncherWahl` und Methode `neuWaehlen()` (nicht im Register, nur Rundown-intern). `neuWaehlen()` baut vor `start()` keine Clients, damit kein Client ohne Token/TLS entsteht (Kommentar `index.ts:921-922`).
- **`kopplungFuerWahl()`**: Ein Slave ohne `masterId` wird als Einzelplatz übergeben (`null`), weil `KopplungFuerWahl` nach Register kein `masterId` trägt, 16.1 diese Lage aber als Einzelplatz führt.
- Wo die Spec schweigt, gilt: „Übergang“ und „leer“ setzen `filePath` auf `null` und `dirty` auf `false` (das Dokument gehört danach zur Master-Show; „Speichern unter …“ legt eine Datei an). Eine Master-Show ohne Ablauf und ohne Gedächtnis lässt das Dokument stehen wie 5.2. Ohne Schlüssel im Stand wirft `anwenden` `nichtAngewendet('SCHLUESSEL_FEHLT')` (V12 „…: SCHLUESSEL_FEHLT“, N3).
- **Nachbesserung (N9):** `ladeMasterShow` rechnet erst (Gedächtnis, Weg aus `masterAusgang`, `wendeShowAn`, `migrate`) und setzt danach Zeiger, `masterQuelle` und `masterShow`; `zeigeDokumentHinweis` nimmt die Regel aus `dokumentHinweis`.
- **Show-Deep-Link im Verbundmodus (N15, ersetzt N1):** Der Rundown lädt daraus nichts, weder Daten noch Dokument (E24, Auslegung 17.3 vor 16.1). Die Fassung aus N1 (Dokument aus dem Link über `gleicheMitMasterAb` abgleichen) brach laufende GO-Folgen ab, setzte die scharfe Zeile auf die erste und überschrieb das Gedächtnis der Master-Show, auch bei einer Kopie derselben Show; sie entfällt. Statt der 16.1-Zeile schreibt der Rundown eine eigene Infozeile (neuer Text, Tabelle „Texte ohne Spec-Vorgabe“); die Regel ist `showLinkWeg` aus C17, der Name läuft durch `kuerzeName` aus `@jm/app-runtime` (C13).
- `apps/rundown/src/renderer/src/jmrundown.d.ts` bleibt unverändert (Brücke über `JmRundownApi`).

**Nachgerechnet** (beim Durchspielen des ganzen Plans, mit C11–C13 aus diesem Plan): Typecheck node und web grün, Selbsttest `552` mit zweimal „ALLE TESTS OK“, `electron-vite build` grün, Preload-Zählung `3`, `folgeMasterShow(` einmal, `showPfad` in 20 Zeilen, die #235-Suche nur mit dem geschützten Deep-Link-Vergleich (Zeile 924, nach N15), `verbundIgnoriert('deeplink'` nicht und `showLinkWeg(` einmal im Main, im gebauten Main der Hinweistext genau einmal (die Konstante) und die neue Show-Link-Zeile genau einmal. Was davon zur Laufzeit C20 prüft und was nur die Abnahme, steht oben unter „Regeln“.

---

### Task 19: C19 · Kette ohne Electron (Spec 18): `verbund-kette.test.ts`

**Spec:** 18 (beide Tabellen), 19.1 letzter Punkt (Teil-1-Client), 19.6 (Zeitgrenze des Jobs), 25 Nr. 11 (nur in der Abnahme nachbaubar); Entscheidungen E9, E16, E17.

Worum es geht, in den Worten der Spec:
- 18: „Netz kurz weg (unter 25 s, die Leitung reißt nicht) | Daten bleiben, die Verbindung hält | V4“ … „Stand ungültig (Prüfung 13.2) | alter Stand bleibt | V15“ (elf Zeilen) und die Tabelle „Gemischte Versionen“ (acht Zeilen).
- 18: „Ein Teil-1-Teilnehmer (Timer 0.12.0, Titler 0.9.0, Launcher 0.12.0) bekommt nie eine 2b-Zeile, weil der Master nur an Abos sendet.“
- 19.1: „Ein Teil-1-Client ohne `abo` bleibt angemeldet und bekommt keine 2b-Zeile“.
- 19.6: „Keiner lädt Electron. Die Zeitgrenze bleibt 15 min.“

Der Kettentest baut jede Zeile, die ohne Electron nachbaubar ist, über die echte Kette nach: am Master `MasterLinkServer` und `Verteiler` (verdrahtet wie `MasterRolle` in C9), am Tool auf Rechner B `MasterLinkClient` mit eigener `master-link.json` im Temp-Ordner, `VerbundFolger`, Zwischenspeicher und `verbundAnzeige`. Ein Handler zählt jedes `anwenden`. Zwischen Tool und Master liegt eine kleine TCP-Weiterleitung („Strecke“), die alle Bytes festhalten kann; so lassen sich „Netz kurz weg“ und „Netz länger weg“ ohne Kabel nachbauen.

| Zeile aus Spec 18 | Abschnitt im Test |
| --- | --- |
| Netz kurz weg (unter 25 s) | D (Stille-Frist hier 2 s) |
| Netz länger weg (Kabel gezogen) | E (Stille-Frist 2 s; die echten 25 s nur in der Abnahme, Spec 25 Nr. 11, Abnahme Schritt 7) |
| Master-Launcher beendet | G |
| Master-Launcher startet ohne Show | H |
| Master öffnet dieselbe Show wieder | I (neue Epoche); dazu C für E9 (unverändert erneut gemeldet: keine `aenderung`) |
| Master öffnet eine andere Show | F |
| Master-Rolle aus | G (für das Tool dasselbe: der Server stoppt) |
| Kopplung an B getrennt | L |
| Tool auf B startet neu, Master fehlt | M |
| Stand nicht anwendbar | J |
| Stand ungültig | K |
| ≤ 0.14 (ohne Verteiler) mit 2b-Tool | N |
| 0.15 mit Timer ≤ 0.13, Titler ≤ 0.10, Rundown ≤ 0.7 | O (keine 2b-Zeile); „RELOAD erreicht B nicht mehr“ prüft C9 (`reload-nachholen.test.ts`) |
| 0.15 mit 2b-Tool | A, B |
| 0.15, Rundown 0.8 und Titler 0.10 auf B | nicht hier: Abruf-Form aus Release 1 (Titler- und Rundown-Selbsttest) |
| beliebig, Tool auf dem Master-Rechner | Q |
| 0.15, Slave-Launcher | P |
| 0.15, Rolle Master, Rechner C ohne Kopplung | nicht hier: RELOAD-Filter (C9) |
| Rolle „aus“ | R |

**Arbeitsverzeichnis:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b-r2`, Branch `feat/master-link-teil2b-r2`. Alle Pfade relativ dazu, Bash. Voraussetzung: C1–C18 sind committet (inhaltlich nötig: C3 Server, C4 Client, C8 Verteiler, C12 `VerbundFolger`, C13 Zwischenspeicher, C11 Anzeige).

**Dateien:**
- Create: `apps/launcher/test/verbund-kette.test.ts`
- Modify: `apps/launcher/package.json` (Skript `selftest:verbund`, Stand nach C8)
- Kein Produktcode. Der Test läuft in der CI im bestehenden Schritt `selftest:verbund` (keine Änderung an `ci-checks.yml`).

**Interfaces:**
- Consumes (Schnittstellen-Register):
  - S-A `@jm/master-link`: `MasterLinkServer` (Ereignisse `daten (t: TeilnehmerDaten, abo: AboInhalt)`, `getrennt (sitzung: number)`, `entstaut (sitzung: number)`; `sendeDaten(sitzung: number, zeile: string): SendeErgebnis`), `MasterLinkClient` (`sende(n: Nachricht): boolean`, `kopplung(): KopplungInfo | null`, Ereignis `daten (n: DatenZeile)`), Typen `AboInhalt`, `DatenZeile`, `Fristen`, `MasterLinkDatei`, `Nachricht`, `TeilnehmerDaten`; aus Teil 1 `fingerprintVonPem`, `masterLinkPfad`, `schreibeMasterLinkDatei`; Testhilfen `baueServer`, `meldeAn`, `neueIdentitaet` aus `packages/master-link/test/aufbau.ts`.
  - S-B: `Verteiler` aus `apps/launcher/src/main/verbund/verteiler.ts` (`constructor(d: VerteilerAbhaengigkeiten)`, `starte(server: VerteilerServer)`, `stoppe()`, `meldeShow(pfad: string, show: Show | null)`, `aufAbo`, `aufGetrennt`, `aufEntstaut`).
  - S-C per Relativpfad, nie über `packages/app-runtime/src/index.ts` (das lädt Electron): `VerbundFolger`, `ClientLike`, `StandSpeicher` aus `verbund-daten.ts`; `verbundAnzeige(d: VerbundDaten, uhrzeit?: (ms: number) => string): VerbundAnzeige | null` aus `verbund-anzeige.ts`; `erzeugeStandSpeicher(datei, log)` aus `verbund-speicher.ts`; Typen `VerbundAnzeige`, `VerbundDaten` aus `verbund-typen.ts`.
  - `migrateShow`, `Show` aus `@jm/show`.
- Produces: keine neue Schnittstelle. `npm run selftest:verbund -w @jm/launcher` führt danach drei Dateien aus.

Regeln für diese Aufgabe:
- G7: `tsx`, kein Electron; die app-runtime-Module nur per Relativpfad.
- G8: Sockets nur auf `127.0.0.1`, Temp-Ordner unter `os.tmpdir()`, kein `%APPDATA%`.
- G12: `apps/launcher/package.json` liegt mit CRLF vor, Änderung mit dem Edit-Werkzeug; die neue Testdatei schreibt das Write-Werkzeug mit LF.
- G16: Eine rote Zeile im grünen Lauf heißt anhalten und melden. Behoben wird in der Aufgabe, der der Code gehört (C3/C4 Transport, C8 Verteiler, C11–C13 app-runtime), mit Test dort. Die Prüfung hier wird nur geändert, wenn sie nachweislich etwas anderes prüft als Spec 18.
- Laufzeit des Tests unter 60 s (19.6: der Job hat 15 min für alle Schritte). Eine Gesamtfrist von 120 s im Test verhindert, dass ein hängender Socket den CI-Lauf blockiert.

- [ ] **Step 1: Test schreiben**

Neue Datei `apps/launcher/test/verbund-kette.test.ts` (ganzer Inhalt):
```ts
// Kette Master → Tool OHNE Electron (2b-Spec 18, 19.1 letzter Punkt): npm run selftest:verbund -w @jm/launcher
// Am Master laufen der echte MasterLinkServer und der Verteiler, verdrahtet wie in MasterRolle (C9). Am Tool auf B
// laufen der echte MasterLinkClient mit master-link.json im Temp-Ordner, VerbundFolger, Zwischenspeicher und
// verbundAnzeige aus @jm/app-runtime. Diese Module kommen per Relativpfad, nie über src/index.ts (das lädt Electron).
// Echte TLS-Sockets nur auf 127.0.0.1, Fristen verkürzt; Laufzeit unter 60 s. Jeder Abschnitt nennt seine Zeile aus Spec 18.
// Nicht nachbaubar und deshalb nicht hier: „bis 25 s grün“ bei gezogenem Kabel (Spec 25 Nr. 11, Abnahme Schritt 7;
// Abschnitt E prüft dasselbe mit verkürzter Stille-Frist), RELOAD an fremde Rechner (C9, reload-nachholen.test.ts),
// Rundown 0.8 mit Titler 0.10 (Abruf-Form aus Release 1).
// Gegenprobe: KETTE_GEGENPROBE=nur-erstes-abo bzw. KETTE_GEGENPROBE=ohne-speicher baut an der Testnaht einen Fehler
// ein (nur das erste Abo geht hinaus bzw. der Zwischenspeicher speichert nichts). Dann müssen die in C19 genannten Zeilen rot werden.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { connect as netConnect, createServer as createNetServer, type AddressInfo, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  fingerprintVonPem, masterLinkPfad, MasterLinkClient, MasterLinkServer, schreibeMasterLinkDatei,
  type AboInhalt, type DatenZeile, type Fristen, type MasterLinkDatei, type Nachricht, type TeilnehmerDaten,
} from '@jm/master-link';
import { migrateShow, type Show } from '@jm/show';
import { baueServer, meldeAn, neueIdentitaet } from '../../../packages/master-link/test/aufbau';
import { verbundAnzeige } from '../../../packages/app-runtime/src/verbund-anzeige';
import { VerbundFolger, type ClientLike, type StandSpeicher } from '../../../packages/app-runtime/src/verbund-daten';
import { erzeugeStandSpeicher } from '../../../packages/app-runtime/src/verbund-speicher';
import type { VerbundAnzeige, VerbundDaten } from '../../../packages/app-runtime/src/verbund-typen';
import { Verteiler } from '../src/main/verbund/verteiler';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean, detail = ''): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}
const abschnitt = (titel: string): void => console.log(`\n── ${titel}`);
const warte = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
async function bis(f: () => boolean, maxMs = 3000): Promise<boolean> {
  const ende = Date.now() + maxMs;
  while (Date.now() < ende) { if (f()) return true; await warte(20); }
  return f();
}
// Gesamtfrist: ein hängender Socket darf den CI-Lauf (15 min) nie blockieren.
setTimeout(() => { console.log('FAIL  Kette: Gesamtfrist 120 s überschritten'); process.exit(1); }, 120_000).unref();

const tempOrdner: string[] = [];
function temp(prefix: string): string {
  const p = mkdtempSync(join(tmpdir(), prefix));
  tempOrdner.push(p);
  return p;
}
process.on('exit', () => {
  for (const p of tempOrdner) {
    try { rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); } catch { /* Windows hält den Ordner noch */ }
  }
});

const GEGENPROBE = process.env.KETTE_GEGENPROBE ?? '';
const MASTER = 'Kette-Master';
// Stille-Frist 2 s (statt 25 s): weit genug weg von den Haltezeiten in D (500 ms) und E (600 ms), auch unter Last in
// der CI (ubuntu-latest, Node 22; Nachbesserung N12).
const SERVER_FRISTEN: Partial<Fristen> = { pulsMs: 200, stilleMs: 2000 };
const CLIENT_FRISTEN: Partial<Fristen> = {
  dateiPruefMs: 50, rueckzugBasisMs: 50, rueckzugMaxMs: 200, tcpMs: 300, tlsHalloMs: 400, angemeldetMs: 400,
  stilleMs: 2000, pulsMs: 200, zertifikatWiederholMs: 300, protokollWiederholMs: 300, ersetztWiederholMs: 400,
  lastMinMs: 100, suchrundeMs: 30,
};
const FOLGER_FRISTEN = { antwortMs: 400, aboWiederholMs: 800, anwendeVersuche: 5, anwendePauseMs: 100 };

// Anzeige-Texte wörtlich aus Spec 16.4; die Uhrzeit ist fest, damit die Texte genau vergleichbar sind.
const UHR = (): string => '12:34';
const L = (s: string): string => ` · letzter Stand: ${s} 12:34`;
const V3 = (s: string): string => `${MASTER} antwortet nicht auf die Anfrage nach Show-Daten (Launcher-Update am Master nötig?)${L(s)}`;
const V4 = (s: string): string => `Show vom Master: ${s} · Stand 12:34`;
const V5 = (s: string): string => `${MASTER} hat keine Show offen${L(s)}`;
const V9 = (s: string): string => `${MASTER} nicht verbunden${L(s)}`;
const V13 = (s: string): string => `Daten vom früheren Master ${MASTER} (nicht mehr gekoppelt)${L(s)}`;
const V15 = (s: string): string => `Show-Daten von ${MASTER} nicht lesbar (Tool-Update nötig?)${L(s)}`;

// ── Shows ────────────────────────────────────────────────────────────────────
const SHOW_DIR = temp('jmkette-show-');
const SHOW_A = join(SHOW_DIR, 'Kette A.jmshow');
const SHOW_B = join(SHOW_DIR, 'Kette B.jmshow');
const A_NAME = 'Kette Show A';
const B_NAME = 'Kette Show B';
function show(name: string, ablauf: string[], speaker: string[] = ['Ada', 'Grace', 'Alan']): Show {
  return migrateShow({
    schemaVersion: 1,
    name,
    updatedAt: '2026-10-08T10:00:00.000Z',
    tools: [{ appId: 'jm-timer', settings: { durationMs: 600_000 } }],
    ablauf: ablauf.map((id) => ({ id, label: `Punkt ${id}`, durationMs: 60_000 })),
    iveo: { event: 'e2e-kette', name, syncedAt: '2026-10-08T10:00:00.000Z', speakers: speaker.map((n) => ({ name: n, title: 'Gast' })), sideEvents: [] },
  });
}

// ── Master: echter Server, Verteiler wie in MasterRolle verdrahtet ──────────
const a = await baueServer({ identitaet: neueIdentitaet(MASTER) }, SERVER_FRISTEN);
const masterLog: string[] = [];
/** Logzeilen der Tools (VerbundFolger, Zwischenspeicher, Client) — nur bei einem Fehlschlag ausgegeben. */
const toolLog: string[] = [];
/** Jedes Ereignis 'daten' (Abo) aller Server dieses Laufs, in Ankunftsfolge. */
const abos: TeilnehmerDaten[] = [];
const aboZahl = (appId: string): number => abos.filter((t) => t.appId === appId).length;
function neuerVerteiler(): Verteiler {
  return new Verteiler({ log: (stufe, text) => masterLog.push(`${stufe}: ${text}`), rechnerName: (id) => a.verbund.finde(id)?.name ?? id });
}
function zaehleAbos(s: MasterLinkServer): void {
  s.on('daten', (t: TeilnehmerDaten) => abos.push(t));
}
/** Wie MasterRolle (C9): daten/getrennt/entstaut an den Verteiler, sendeDaten zurück (der Server ist der VerteilerServer). */
function haengeAn(s: MasterLinkServer, v: Verteiler): void {
  s.on('daten', (t: TeilnehmerDaten, abo: AboInhalt) => v.aufAbo(t, abo));
  s.on('getrennt', (sitzung: number) => v.aufGetrennt(sitzung));
  s.on('entstaut', (sitzung: number) => v.aufEntstaut(sitzung));
}
function neuerServer(): MasterLinkServer {
  return new MasterLinkServer({
    identitaet: a.identitaet, verbund: a.verbund, eigeneRechnerId: a.eigen.rechnerId, suiteVersion: '0.15.0',
    lauschAdressen: ['127.0.0.1'], port: a.port, fristen: SERVER_FRISTEN,
  });
}

// ── Strecke: TCP-Weiterleitung zwischen Tool und Master; „halte“ hält alle Bytes fest (Kabel gezogen, ohne RST) ──
interface Strecke { port: number; halte(an: boolean): void; schliesse(): Promise<void> }
async function baueStrecke(zielPort: number): Promise<Strecke> {
  let halten = false;
  const paare = new Set<{ ein: Socket; aus: Socket; puffer: [Socket, Buffer][] }>();
  const srv = createNetServer((ein) => {
    const aus = netConnect(zielPort, '127.0.0.1');
    const p = { ein, aus, puffer: [] as [Socket, Buffer][] };
    paare.add(p);
    const nach = (ziel: Socket) => (d: Buffer): void => { if (halten) p.puffer.push([ziel, d]); else ziel.write(d); };
    ein.on('data', nach(aus));
    aus.on('data', nach(ein));
    const zu = (): void => { paare.delete(p); ein.destroy(); aus.destroy(); };
    for (const s of [ein, aus]) { s.on('close', zu); s.on('error', zu); }
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  return {
    port: (srv.address() as AddressInfo).port,
    halte(an: boolean): void {
      halten = an;
      if (an) return;
      for (const p of paare) {
        for (const [ziel, d] of p.puffer) if (!ziel.destroyed) ziel.write(d);
        p.puffer = [];
      }
    },
    async schliesse(): Promise<void> {
      for (const p of paare) { p.ein.destroy(); p.aus.destroy(); }
      await new Promise<void>((r) => srv.close(() => r()));
    },
  };
}

// ── Tool auf Rechner B: echter Client, VerbundFolger, Zwischenspeicher; der Handler zählt Anwendungen ──
interface Anwendung { epoche: string; folge: number; neueShow: boolean; name: string; json: string }
interface Werkzeug {
  appId: string;
  client: MasterLinkClient;
  folger: VerbundFolger;
  speicherDatei: string;
  anwendungen: Anwendung[];
  /** Anzeige nach jedem Wechsel (beiWechsel), null = keine Anzeige. */
  verlauf: (VerbundAnzeige | null)[];
  /** Eingegangene stand/aenderung am Client (Ereignis 'daten'). */
  eingang: DatenZeile[];
  /** true: anwenden wirft EBUSY (Spec 18 „Stand nicht anwendbar“). */
  wirft: boolean;
  anzeige(): VerbundAnzeige | null;
  stoppe(): Promise<void>;
}
/** Testnaht der Gegenprobe „nur-erstes-abo“: jedes weitere Abo wird geschluckt (sende meldet trotzdem true). */
function alsClientLike(c: MasterLinkClient): ClientLike {
  if (GEGENPROBE !== 'nur-erstes-abo') return c;
  let abo = 0;
  return {
    zustand: () => c.zustand(),
    kopplung: () => c.kopplung(),
    sende: (n: Nachricht): boolean => (n.t === 'abo' && ++abo > 1 ? true : c.sende(n)),
    on: (e, f) => c.on(e, f),
  };
}
/** Testnaht der Gegenprobe „ohne-speicher“: speichert nichts, liest nichts. */
function speicherFuer(datei: string): StandSpeicher {
  if (GEGENPROBE === 'ohne-speicher') return { lies: () => null, schreibe: async () => true, loesche: () => {} };
  return erzeugeStandSpeicher(datei, (stufe, t) => toolLog.push(`speicher ${stufe}: ${t}`));
}
let pid = 100;
function baueWerkzeug(appId: string, dateiPfad: string, userData: string): Werkzeug {
  const client = new MasterLinkClient({
    dateiPfad, teilnehmer: { art: 'tool', appId, name: appId, version: '0.14.0', pid: pid++ }, fristen: CLIENT_FRISTEN, suche: null,
    log: (stufe, t) => toolLog.push(`${appId} ${stufe}: ${t}`),
  });
  const speicherDatei = join(userData, 'verbund', 'master-stand.json');
  const folger = new VerbundFolger({ client: alsClientLike(client), speicher: speicherFuer(speicherDatei),
    log: (stufe, t) => toolLog.push(`${appId} ${stufe}: ${t}`), fristen: FOLGER_FRISTEN });
  const w: Werkzeug = {
    appId, client, folger, speicherDatei, anwendungen: [], verlauf: [], eingang: [], wirft: false,
    anzeige: () => verbundAnzeige(folger.daten(), UHR),
    async stoppe(): Promise<void> { folger.stoppe(); await client.stoppe(); },
  };
  folger.folge({
    anwenden(stand, neueShow): void {
      w.anwendungen.push({ epoche: stand.epoche, folge: stand.folge, neueShow, name: stand.show.name, json: JSON.stringify(stand.show) });
      if (w.wirft) throw Object.assign(new Error('gesperrt'), { code: 'EBUSY' });
    },
    beiWechsel(d: VerbundDaten): void { w.verlauf.push(verbundAnzeige(d, UHR)); },
  });
  client.on('daten', (n: DatenZeile) => w.eingang.push(n));
  // Reihenfolge wie in app-runtime (C13): verbundAnClient direkt nach client.starte().
  client.starte();
  folger.starte();
  return w;
}
const text = (w: Werkzeug): string => w.anzeige()?.text ?? '—';
const farbe = (w: Werkzeug): string => w.anzeige()?.farbe ?? '—';
const letzte = (w: Werkzeug): Anwendung | undefined => w.anwendungen.at(-1);
function speicherInhalt(w: Werkzeug): { fassung?: number; stand?: { epoche?: string; folge?: number } } | null {
  try { return JSON.parse(readFileSync(w.speicherDatei, 'utf8')); } catch { return null; }
}
/** V9 (gelb) oder V11 (rot, Text des Clients) mit Zusatz L; liest Daten und Anzeige im selben Takt. */
function getrenntMitL(w: Werkzeug, s: string): { ok: boolean; v9: boolean; v11: boolean; detail: string } {
  const d = w.folger.daten();
  const z = verbundAnzeige(d, UHR);
  const v9 = z?.text === V9(s) && z.farbe === 'gelb';
  const v11 = d.art === 'getrennt' && d.client.art === 'fehler' && z?.text === `${d.client.text}${L(s)}` && z.farbe === 'rot';
  return { ok: v9 || v11, v9, v11, detail: `${d.art} · ${z?.farbe ?? '—'} · ${z?.text ?? '—'}` };
}
function dateiSlave(port: number, teil: Partial<MasterLinkDatei> = {}): MasterLinkDatei {
  return {
    version: 1, rolle: 'slave', rechner: { id: a.slave.rechnerId, name: 'Regie-Laptop 2' }, netzwerk: { karte: null },
    kopplung: {
      masterId: a.identitaet.masterId, masterName: MASTER, fingerprint: fingerprintVonPem(a.identitaet.zertifikat),
      zertifikat: a.identitaet.zertifikat, port, adressen: ['127.0.0.1'], letzteAdresse: null, festeAdresse: null, schluessel: a.slave.paar,
    },
    ...teil,
  };
}

const showA1 = show(A_NAME, ['a-1', 'a-2', 'a-3']);
const showA2 = show(A_NAME, ['a-1', 'a-2', 'a-3', 'a-4']);
const showB1 = show(B_NAME, ['b-1', 'b-2']);

abschnitt('A · 0.15 + 2b-Tool → Daten (Spec 18, gemischte Versionen Zeile 3)');
let server: MasterLinkServer = a.server;
const v1 = neuerVerteiler();
v1.meldeShow(SHOW_A, showA1); // vor starte(): wird gemerkt und beim Start verteilt
v1.starte(server);
zaehleAbos(server);
haengeAn(server, v1);
const strecke = await baueStrecke(a.port);
const pfadT = masterLinkPfad(temp('jmkette-app-'));
const userDataT = temp('jmkette-user-');
schreibeMasterLinkDatei(pfadT, dateiSlave(strecke.port));
let T = baueWerkzeug('jm-timer', pfadT, userDataT);
await bis(() => text(T) === V4(A_NAME), 5000);
ck('A · V4 „Show vom Master: … · Stand …“ grün', text(T) === V4(A_NAME) && farbe(T) === 'gruen', `${farbe(T)} · ${text(T)}`);
ck('A · erster Stand angewendet: Folge 0, neueShow true, Show A', T.anwendungen.length === 1 && T.anwendungen[0].folge === 0
  && T.anwendungen[0].neueShow && T.anwendungen[0].name === A_NAME, JSON.stringify(T.anwendungen.map((x) => [x.folge, x.neueShow, x.name])));
ck('A · Abo genau einmal nach der Anmeldung', aboZahl('jm-timer') === 1, `${aboZahl('jm-timer')} Abos`);
ck('A · Antwort auf das Abo ist „stand“', T.eingang.length === 1 && T.eingang[0].t === 'stand', T.eingang.map((n) => n.t).join(','));
ck('A · im Verbundmodus', T.folger.imVerbundmodus());
await bis(() => speicherInhalt(T)?.stand?.folge === 0, 2000);
const sp0 = speicherInhalt(T);
ck('A · Zwischenspeicher geschrieben (fassung 1, Epoche und Folge des Stands)', sp0?.fassung === 1 && sp0.stand?.epoche === T.anwendungen[0]?.epoche
  && sp0.stand?.folge === 0, JSON.stringify(sp0?.stand ? { fassung: sp0.fassung, epoche: sp0.stand.epoche, folge: sp0.stand.folge } : sp0));

abschnitt('B · Änderung am Ablauf → aenderung, Folge + 1, gleiche Show');
v1.meldeShow(SHOW_A, showA2);
await bis(() => T.anwendungen.length === 2, 3000);
ck('B · angewendet mit Folge 1 und neueShow false', T.anwendungen.length === 2 && letzte(T)?.folge === 1 && letzte(T)?.neueShow === false,
  JSON.stringify(T.anwendungen.map((x) => [x.folge, x.neueShow])));
ck('B · kam als „aenderung“', T.eingang.at(-1)?.t === 'aenderung', T.eingang.map((n) => n.t).join(','));
ck('B · der neue Punkt a-4 steht in der angewendeten Show', letzte(T)?.json.includes('"a-4"') === true);

abschnitt('C · Master öffnet dieselbe Show unverändert erneut (E9) → keine aenderung, kein anwenden');
const eingangC = T.eingang.length;
v1.meldeShow(SHOW_A, show(A_NAME, ['a-1', 'a-2', 'a-3', 'a-4']));
await warte(600);
ck('C · keine neue Zeile am Tool', T.eingang.length === eingangC, `${T.eingang.length - eingangC} neue Zeilen`);
ck('C · nicht erneut angewendet', T.anwendungen.length === 2, `${T.anwendungen.length} Anwendungen`);

abschnitt('D · Netz kurz weg, unter der Stille-Frist (Spec 18 Zeile 1) → Daten bleiben, V4');
const abosD = aboZahl('jm-timer');
let immerGruen = true;
strecke.halte(true);
const endeD = Date.now() + 500;
while (Date.now() < endeD) { if (text(T) !== V4(A_NAME) || T.client.zustand().art !== 'verbunden') immerGruen = false; await warte(20); }
strecke.halte(false);
await warte(300);
ck('D · während 500 ms ohne Bytes durchgehend V4 und verbunden', immerGruen && text(T) === V4(A_NAME), text(T));
ck('D · kein neues Abo (die Leitung riss nicht)', aboZahl('jm-timer') === abosD, `${aboZahl('jm-timer') - abosD} neue Abos`);

abschnitt('E · Netz länger weg (Spec 18 Zeile 2, Stille-Frist hier 2 s statt 25 s) → Neuabo, gleicher Stand nicht neu angewendet');
const abosE = aboZahl('jm-timer');
const anwE = T.anwendungen.length;
const verlaufE = T.verlauf.length;
const eingangE = T.eingang.length;
strecke.halte(true);
await warte(600);
ck('E · bis zur Stille-Frist bleibt V4 grün', text(T) === V4(A_NAME) && farbe(T) === 'gruen', `${farbe(T)} · ${text(T)}`);
await bis(() => getrenntMitL(T, A_NAME).ok, 5000);
const gE = getrenntMitL(T, A_NAME);
ck('E · danach V9 bzw. V11 mit Zusatz L', gE.ok, gE.detail);
await warte(1000);
strecke.halte(false);
await bis(() => text(T) === V4(A_NAME), 5000);
const nachE = T.verlauf.slice(verlaufE).map((z) => z?.text ?? '—');
ck('E · nach dem Wiederverbinden wieder V4', text(T) === V4(A_NAME), `${farbe(T)} · ${text(T)}`);
ck('E · dazwischen „Suche/nicht verbunden“ oder Fehler mit Zusatz L', nachE.some((x) => x.endsWith(L(A_NAME))), nachE.join(' | '));
ck('E · Neuabo nach dem Wiederverbinden', aboZahl('jm-timer') > abosE, `${aboZahl('jm-timer') - abosE} neue Abos`);
const standE = T.eingang.slice(eingangE).filter((n) => n.t === 'stand').at(-1);
ck('E · der neue „stand“ trägt dieselbe Epoche und Folge', standE?.epoche === letzte(T)?.epoche && standE?.folge === letzte(T)?.folge,
  JSON.stringify({ stand: standE ? [standE.epoche, standE.folge] : null, angewendet: [letzte(T)?.epoche, letzte(T)?.folge] }));
ck('E · gleicher Stand nicht neu angewendet', T.anwendungen.length === anwE, `${T.anwendungen.length - anwE} neue Anwendungen`);

abschnitt('F · Master öffnet eine andere Show (Spec 18) → neueShow true, V4');
v1.meldeShow(SHOW_B, showB1);
await bis(() => letzte(T)?.name === B_NAME, 3000);
ck('F · Show B angewendet mit neueShow true', letzte(T)?.name === B_NAME && letzte(T)?.neueShow === true, JSON.stringify(letzte(T) && [letzte(T)!.name, letzte(T)!.neueShow]));
await bis(() => text(T) === V4(B_NAME), 2000);
ck('F · V4 mit Show B', text(T) === V4(B_NAME), text(T));

abschnitt('G · Master-Launcher beendet / Master-Rolle aus (Spec 18) → Daten bleiben, kurz V9, dann V11');
const anwG = T.anwendungen.length;
const verlaufG = T.verlauf.length;
await server.stoppe();
v1.stoppe();
await bis(() => { const g = getrenntMitL(T, B_NAME); return g.v11; }, 4000);
const gG = getrenntMitL(T, B_NAME);
ck('G · V11 mit dem Text des Clients und Zusatz L', gG.v11, gG.detail);
const nachG = T.verlauf.slice(verlaufG).map((z) => z?.text ?? '—');
const iV9 = nachG.indexOf(V9(B_NAME));
const iV11 = nachG.findIndex((x) => x !== V9(B_NAME) && x.endsWith(L(B_NAME)));
ck('G · erst V9 „nicht verbunden“, dann V11', iV9 >= 0 && iV11 > iV9, nachG.join(' | '));
ck('G · Daten bleiben (nichts angewendet, nichts verworfen)', T.anwendungen.length === anwG && letzte(T)?.name === B_NAME);
ck('G · bleibt im Verbundmodus (RELOAD bleibt ignoriert)', T.folger.imVerbundmodus());

abschnitt('H · Master-Launcher startet ohne Show (Spec 18) → V5, dann die Show öffnen → V4');
const v2 = neuerVerteiler();
server = neuerServer();
v2.starte(server);
zaehleAbos(server);
haengeAn(server, v2);
await server.starte();
await bis(() => text(T) === V5(B_NAME), 5000);
ck('H · V5 „hat keine Show offen“ mit Zusatz L, gelb', text(T) === V5(B_NAME) && farbe(T) === 'gelb', `${farbe(T)} · ${text(T)}`);
ck('H · Daten bleiben (keine-show wendet nichts an)', T.anwendungen.length === anwG);
v2.meldeShow(SHOW_B, showB1);
await bis(() => T.anwendungen.length === anwG + 1, 3000);
ck('H · Show geöffnet: angewendet mit neueShow false (gleicher Master, gleicher Schlüssel)', T.anwendungen.length === anwG + 1
  && letzte(T)?.neueShow === false && letzte(T)?.name === B_NAME, JSON.stringify(T.anwendungen.slice(anwG).map((x) => [x.name, x.neueShow])));
await bis(() => text(T) === V4(B_NAME), 2000);
ck('H · danach V4', text(T) === V4(B_NAME), text(T));

abschnitt('I · Master öffnet dieselbe Show wieder: neue Epoche (Spec 18) → einmal angewendet, Ergebnis gleich, V4');
const vorI = letzte(T)!;
await server.stoppe();
v2.stoppe();
server = neuerServer();
v2.starte(server); // neue Epoche; die gemerkte Show B wird verteilt
zaehleAbos(server);
haengeAn(server, v2);
await server.starte();
await bis(() => T.anwendungen.length === anwG + 2, 5000);
await warte(300);
ck('I · genau einmal angewendet', T.anwendungen.length === anwG + 2, `${T.anwendungen.length - anwG - 1} Anwendungen`);
ck('I · neue Epoche, neueShow false', letzte(T)?.epoche !== vorI.epoche && letzte(T)?.neueShow === false, JSON.stringify([vorI.epoche, letzte(T)?.epoche, letzte(T)?.neueShow]));
ck('I · Ergebnis gleich (dieselbe Show wie vorher angewendet)', letzte(T)?.json === vorI.json);
await bis(() => text(T) === V4(B_NAME), 2000);
ck('I · V4', text(T) === V4(B_NAME), text(T));

abschnitt('J · Stand nicht anwendbar (Spec 18) → alter Stand bleibt, fünf neue Versuche, V12');
const anwJ = T.anwendungen.length;
const speicherVorJ = existsSync(T.speicherDatei) ? readFileSync(T.speicherDatei, 'utf8') : '';
T.wirft = true;
v2.meldeShow(SHOW_B, show(B_NAME, ['b-1', 'b-2', 'b-3']));
await bis(() => T.anwendungen.length >= anwJ + 1 + FOLGER_FRISTEN.anwendeVersuche, 3000);
await warte(FOLGER_FRISTEN.anwendePauseMs * 4);
ck('J · erster Versuch plus fünf neue (Spec 16.2 „bis zu fünfmal … erneut“)', T.anwendungen.length === anwJ + 1 + FOLGER_FRISTEN.anwendeVersuche,
  `${T.anwendungen.length - anwJ} Aufrufe`);
const zJ = T.anzeige();
ck('J · V12 „Show vom Master nicht übernommen: …“ mit „· in Benutzung: Show B“, rot', zJ?.farbe === 'rot'
  && zJ.text.startsWith('Show vom Master nicht übernommen: ') && zJ.text.endsWith(` · in Benutzung: ${B_NAME} 12:34`), `${zJ?.farbe} · ${zJ?.text}`);
ck('J · Zwischenspeicher unverändert', (existsSync(T.speicherDatei) ? readFileSync(T.speicherDatei, 'utf8') : '') === speicherVorJ);
T.wirft = false;
v2.meldeShow(SHOW_B, show(B_NAME, ['b-1', 'b-2', 'b-3', 'b-4']));
await bis(() => text(T) === V4(B_NAME), 3000);
ck('J · der nächste Stand wird angewendet, Fehler weg, V4', text(T) === V4(B_NAME) && letzte(T)?.json.includes('"b-4"') === true, text(T));

abschnitt('K · Stand ungültig (Spec 18, Prüfung 13.2) → alter Stand bleibt, V15, Leitung bleibt');
const anwK = T.anwendungen.length;
const sitzungT = abos.filter((t) => t.appId === 'jm-timer').at(-1)?.sitzung ?? -1;
const ungueltig = '{"t":"aenderung","art":"show","fassung":1,"epoche":"kein gültiges","folge":99,"schluessel":null,"show":null,"grund":"keine-show","mitDokument":[]}\n';
const ergK = server.sendeDaten(sitzungT, ungueltig);
ck('K · ungültige Zeile ging hinaus', ergK === 'gesendet', ergK);
await bis(() => text(T) === V15(B_NAME), 3000);
ck('K · V15 „Show-Daten von … nicht lesbar (Tool-Update nötig?)“ mit Zusatz L, rot', text(T) === V15(B_NAME) && farbe(T) === 'rot', `${farbe(T)} · ${text(T)}`);
ck('K · nichts angewendet, Leitung steht', T.anwendungen.length === anwK && T.client.zustand().art === 'verbunden', T.client.zustand().art);
v2.meldeShow(SHOW_B, show(B_NAME, ['b-1', 'b-2', 'b-3', 'b-4', 'b-5']));
await bis(() => text(T) === V4(B_NAME), 3000);
ck('K · der nächste gültige Stand löscht den Verwurf, V4', text(T) === V4(B_NAME) && T.anwendungen.length === anwK + 1, text(T));

abschnitt('L · Kopplung an B getrennt (Spec 18) → Verbundmodus endet, Daten bleiben, V13');
const anwL = T.anwendungen.length;
schreibeMasterLinkDatei(pfadT, dateiSlave(strecke.port, { kopplung: null }));
await bis(() => text(T) === V13(B_NAME), 3000);
const dL = T.folger.daten();
ck('L · frueher (entkoppelt), V13 gelb mit Zusatz L', dL.art === 'frueher' && dL.grund === 'entkoppelt' && text(T) === V13(B_NAME) && farbe(T) === 'gelb',
  `${dL.art} · ${farbe(T)} · ${text(T)}`);
ck('L · nicht mehr im Verbundmodus, Daten und Zwischenspeicher bleiben', !T.folger.imVerbundmodus() && T.anwendungen.length === anwL && existsSync(T.speicherDatei));
T.folger.ersetzt(); // das Tool hat eine eigene Show angewendet (16.1)
ck('L · eigene Show → einzelplatz, keine Anzeige, Zwischenspeicher gelöscht', T.folger.daten().art === 'einzelplatz' && T.anzeige() === null
  && !existsSync(T.speicherDatei), `${T.folger.daten().art} · ${text(T)}`);
schreibeMasterLinkDatei(pfadT, dateiSlave(strecke.port));
await bis(() => text(T) === V4(B_NAME), 5000);
ck('L · neu gekoppelt → Stand vom Master gilt wieder als neue Show, V4', text(T) === V4(B_NAME) && letzte(T)?.neueShow === true
  && T.anwendungen.length === anwL + 1, `${text(T)} · ${JSON.stringify(T.anwendungen.slice(anwL).map((x) => x.neueShow))}`);
await bis(() => existsSync(T.speicherDatei), 2000);

abschnitt('M · Tool auf B startet neu, Master fehlt (Spec 18) → Daten aus dem Zwischenspeicher, kurz V9, dann V11');
const zuletztM = letzte(T)!;
await T.stoppe();
await server.stoppe();
v2.stoppe();
T = baueWerkzeug('jm-timer', pfadT, userDataT);
await bis(() => T.anwendungen.length === 1, 2000);
ck('M · Zwischenspeicher angewendet: einmal, neueShow false, dieselbe Show', T.anwendungen.length === 1 && T.anwendungen[0].neueShow === false
  && T.anwendungen[0].json === zuletztM.json, JSON.stringify(T.anwendungen.map((x) => [x.name, x.neueShow])));
await bis(() => getrenntMitL(T, B_NAME).v11, 4000);
const gM = getrenntMitL(T, B_NAME);
ck('M · V11 mit Zusatz L (letzter Stand aus dem Zwischenspeicher)', gM.v11, gM.detail);
const nachM = T.verlauf.map((z) => z?.text ?? '—'); // ab dem Bau des Tools: der Zwischenspeicher wird schon in starte() angewendet
const iV9M = nachM.indexOf(V9(B_NAME));
ck('M · erst V9 „nicht verbunden“, dann V11', iV9M >= 0 && nachM.findIndex((x) => x !== V9(B_NAME) && x.endsWith(L(B_NAME))) > iV9M, nachM.join(' | '));
ck('M · beim Start nie V13 (die Datei ist unverändert gekoppelt, 16.1/16.3)', !nachM.includes(V13(B_NAME)), nachM.join(' | '));
ck('M · im Verbundmodus (gleicher Master)', T.folger.imVerbundmodus());

abschnitt('N · Master ≤ 0.14 ohne Verteiler (Spec 18, gemischte Versionen Zeile 1) → nach der Antwortfrist V3, Abo wiederholt');
server = neuerServer();
zaehleAbos(server); // nur zählen: niemand beantwortet das Abo
await server.starte();
const abosN = aboZahl('jm-timer');
await bis(() => text(T) === V3(B_NAME), 5000);
ck('N · V3 „antwortet nicht auf die Anfrage nach Show-Daten …“ mit Zusatz L, gelb', text(T) === V3(B_NAME) && farbe(T) === 'gelb', `${farbe(T)} · ${text(T)}`);
await bis(() => aboZahl('jm-timer') >= abosN + 2, 3000);
ck('N · Abo wird wiederholt', aboZahl('jm-timer') >= abosN + 2, `${aboZahl('jm-timer') - abosN} Abos`);
const anwN = T.anwendungen.length;
v2.starte(server); // ein Platz wird frei bzw. der Master bekommt das Update: das nächste wiederholte Abo wird beantwortet
haengeAn(server, v2);
await bis(() => text(T) === V4(B_NAME), 3000);
ck('N · das wiederholte Abo wird beantwortet, V4', text(T) === V4(B_NAME) && T.anwendungen.length === anwN + 1, text(T));

abschnitt('O · Teil-1-Tool ohne Abo (Spec 18, gemischte Versionen Zeile 2; 19.1) → angemeldet, keine 2b-Zeile');
const roh = await meldeAn(a, a.slave, 'jm-titler', 4711);
const angemeldet = await roh.naechste('angemeldet', 2000);
const rohPuls = setInterval(() => roh.v.sende({ t: 'puls' }), 200); // ein Teil-1-Tool pulst; sonst trennt die Stille-Frist des Servers
ck('O · Teil-1-Client ist angemeldet', angemeldet !== null);
const anwO = T.anwendungen.length;
v2.meldeShow(SHOW_B, show(B_NAME, ['b-1', 'b-2', 'b-3', 'b-4', 'b-5', 'b-6']));
await bis(() => T.anwendungen.length === anwO + 1, 3000);
await warte(300);
ck('O · das 2b-Tool bekommt die Änderung', T.anwendungen.length === anwO + 1);
ck('O · der Teil-1-Client bekommt keine stand/aenderung und bleibt angemeldet',
  !roh.nachrichten.some((n) => n.t === 'stand' || n.t === 'aenderung') && !roh.beendet(), roh.nachrichten.map((n) => n.t).join(','));
clearInterval(rohPuls);
roh.zu();

abschnitt('P · Slave-Launcher (Spec 18, gemischte Versionen Zeile 6) → sein Abo wird ignoriert');
const pfadL = masterLinkPfad(temp('jmkette-app-'));
schreibeMasterLinkDatei(pfadL, dateiSlave(a.port));
const launcherB = new MasterLinkClient({
  dateiPfad: pfadL, teilnehmer: { art: 'launcher', appId: 'jm-launcher', name: 'JM Production Suite', version: '0.15.0', pid: 4712 }, fristen: CLIENT_FRISTEN, suche: null,
});
const launcherDaten: DatenZeile[] = [];
launcherB.on('daten', (n: DatenZeile) => launcherDaten.push(n));
launcherB.starte();
await bis(() => launcherB.zustand().art === 'verbunden', 3000);
const abosP = aboZahl('jm-launcher');
ck('P · Abo des Slave-Launchers geht hinaus', launcherB.sende({ t: 'abo', art: 'show', fassung: 1 }));
await bis(() => aboZahl('jm-launcher') > abosP, 2000);
await warte(500);
ck('P · der Master hat es bekommen (art launcher), antwortet aber nicht', aboZahl('jm-launcher') === abosP + 1
  && abos.at(-1)?.art === 'launcher' && launcherDaten.length === 0, `${launcherDaten.length} Zeilen am Launcher`);
await launcherB.stoppe();

abschnitt('Q · Tool auf dem Master-Rechner (Spec 16.1, 18 Zeile „beliebig | Tool auf dem Master-Rechner“) → Einzelplatz, kein Abo');
const pfadQ = masterLinkPfad(temp('jmkette-app-'));
const kopplungQ = dateiSlave(a.port).kopplung!;
schreibeMasterLinkDatei(pfadQ, { version: 1, rolle: 'master', rechner: { id: a.eigen.rechnerId, name: 'Regie-PC' }, netzwerk: { karte: null },
  kopplung: { ...kopplungQ, schluessel: a.eigen.paar } });
const Q = baueWerkzeug('jm-rundown', pfadQ, temp('jmkette-user-'));
await bis(() => Q.client.zustand().art === 'verbunden', 3000);
await warte(FOLGER_FRISTEN.antwortMs + 300);
ck('Q · der Client ist am Master angemeldet', Q.client.zustand().art === 'verbunden', Q.client.zustand().art);
ck('Q · einzelplatz, keine Anzeige, nicht im Verbundmodus', Q.folger.daten().art === 'einzelplatz' && Q.anzeige() === null && !Q.folger.imVerbundmodus(),
  `${Q.folger.daten().art} · ${text(Q)}`);
ck('Q · kein Abo von diesem Rechner, nichts angewendet', !abos.some((t) => t.rechnerId === a.eigen.rechnerId) && Q.anwendungen.length === 0);
await Q.stoppe();

abschnitt('R · Rolle „aus“ (Spec 18, gemischte Versionen letzte Zeile) → unverändert, Einzelplatz');
const pfadR = masterLinkPfad(temp('jmkette-app-'));
schreibeMasterLinkDatei(pfadR, dateiSlave(a.port, { rolle: 'aus' }));
const R = baueWerkzeug('jm-qa', pfadR, temp('jmkette-user-'));
await warte(FOLGER_FRISTEN.antwortMs + 300);
ck('R · Client aus, einzelplatz, keine Anzeige, kein Abo', R.client.zustand().art === 'aus' && R.folger.daten().art === 'einzelplatz'
  && R.anzeige() === null && aboZahl('jm-qa') === 0, `${R.client.zustand().art} · ${R.folger.daten().art}`);
await R.stoppe();

await T.stoppe();
await server.stoppe();
v2.stoppe();
await strecke.schliesse();
if (fail > 0) {
  console.log('\nVerteiler-Log (Master):');
  for (const z of masterLog) console.log(`  ${z}`);
  console.log('Tool-Log:');
  for (const z of toolLog) console.log(`  ${z}`);
}
if (GEGENPROBE) console.log(`\nGEGENPROBE ${GEGENPROBE}: rote Zeilen oben sind erwartet (C19).`);
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
```

Was der Test voraussetzt (Register und Spec, keine neuen Namen):
- Die Fristen der Zustandsmaschine kommen über `fristen` (Antwortfrist 400 ms, Abo-Wiederholung 800 ms, fünf Anwende-Versuche im Abstand von 100 ms); die Uhr ist die echte (`uhr` fehlt).
- `beiWechsel` aus dem `FolgeHandler` kommt bei jeder Änderung von `daten()`; daraus entsteht der Verlauf der Anzeige.
- Abschnitt J erwartet nach dem ersten Fehlschlag fünf weitere Aufrufe, zusammen sechs (Spec 16.2: „bis zu fünfmal im Abstand von 1 s erneut“).
- `verbundAnzeige(d, () => '12:34')`: Mit fester Uhrzeit sind alle Texte aus 16.4 wörtlich vergleichbar.

- [ ] **Step 2: Typprüfung der neuen Testdatei**

Die Launcher-Tests liegen in keiner tsconfig (Ist-Karte Durchgang, Abschnitt 1); die CI führt sie nur aus. Darum einmal von Hand, mit den Optionen aus `apps/launcher/tsconfig.node.json`:
```bash
node node_modules/typescript/bin/tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022,DOM --types node --skipLibCheck --esModuleInterop --allowSyntheticDefaultImports --isolatedModules --resolveJsonModule apps/launcher/test/verbund-kette.test.ts; echo "Exit: $?"
```
Erwartet: keine Meldung, `Exit: 0`.

Beim Zusammenführen gemessen: keine Meldung, `Exit: 0`. `fristen` ist in C12 als `Partial<VerbundFristen>` getippt (E45); mit `Partial<typeof VERBUND_FRISTEN>` und `as const` meldete tsc hier `TS2322`.

- [ ] **Step 3: Test allein laufen lassen (grün, unter 60 s)**

Befehl:
```bash
time node node_modules/tsx/dist/cli.mjs apps/launcher/test/verbund-kette.test.ts; echo "Exit: $?"
```
Erwartet: 18 Abschnitte `── A · …` bis `── R · …`, jede Prüfzeile beginnt mit `  ok  `, am Ende
```
63 ok, 0 fehlgeschlagen.
Exit: 0
```
und `real` unter `1m0s` (beim Zusammenführen gemessen: 63 Prüfungen, keine in einer Schleife, 9–10 s; nach N12 mit der Stille-Frist 2 s gemessen 10,4–11 s (am 12.10.2026 10,5–10,6 s, N35), Gegenproben unverändert 29 bzw. 7 `FAIL`).

Bei `FAIL`: Der Test druckt danach das Verteiler-Log und das Tool-Log. Ursache mit `superpowers:systematic-debugging` suchen und nach G16 verfahren. Zwei Stellen sind bekannte Kandidaten:
- `FAIL  M · beim Start nie V13 …`: Der Folger startet vor `client.starte()`. Bis der Client seine Datei gelesen hat, liefert `kopplung()` `null`; ein schon registrierter Handler bekommt den Zwischenspeicher dann mit „keine Kopplung“ (V13, `frueher`). Richtig ist die Reihenfolge aus G2 (c): erst `client.starte()`, dann `verbundAnClient` (ZF2). Beim Zusammenführen gemessen: mit der umgekehrten Reihenfolge genau diese zwei `FAIL`-Zeilen in M, `61 ok, 2 fehlgeschlagen.`
- `FAIL  J · erster Versuch plus fünf neue …` mit `5 Aufrufe`: C12 zählt die Versuche ohne den ersten falsch (Spec 16.2 „bis zu fünfmal … erneut“, ZF1). Behoben wird in C12, nicht hier.

- [ ] **Step 4: Gegenprobe 1 — nur das erste Abo geht hinaus (rot)**

Der Schalter baut den Fehler an der Testnaht ein (`ClientLike`): Jedes Abo nach dem ersten wird verschluckt. Nichts wird geändert oder committet.
```bash
KETTE_GEGENPROBE=nur-erstes-abo node node_modules/tsx/dist/cli.mjs apps/launcher/test/verbund-kette.test.ts 2>&1 | tee "$TEMP/kette-gegenprobe-1.log"; echo "Exit: ${PIPESTATUS[0]}"
```
Erwartet (gemessen; hinter jeder Zeile steht nach „ — “ ihr Detail, hier weggelassen): Abschnitte A–D grün, dann genau diese 29 `FAIL`-Zeilen
```
FAIL  E · nach dem Wiederverbinden wieder V4
FAIL  E · Neuabo nach dem Wiederverbinden
FAIL  E · der neue „stand“ trägt dieselbe Epoche und Folge
FAIL  F · Show B angewendet mit neueShow true
FAIL  F · V4 mit Show B
FAIL  G · V11 mit dem Text des Clients und Zusatz L
FAIL  G · erst V9 „nicht verbunden“, dann V11
FAIL  G · Daten bleiben (nichts angewendet, nichts verworfen)
FAIL  H · V5 „hat keine Show offen“ mit Zusatz L, gelb
FAIL  H · Show geöffnet: angewendet mit neueShow false (gleicher Master, gleicher Schlüssel)
FAIL  H · danach V4
FAIL  I · genau einmal angewendet
FAIL  I · neue Epoche, neueShow false
FAIL  I · V4
FAIL  J · erster Versuch plus fünf neue (Spec 16.2 „bis zu fünfmal … erneut“)
FAIL  J · V12 „Show vom Master nicht übernommen: …“ mit „· in Benutzung: Show B“, rot
FAIL  J · der nächste Stand wird angewendet, Fehler weg, V4
FAIL  K · V15 „Show-Daten von … nicht lesbar (Tool-Update nötig?)“ mit Zusatz L, rot
FAIL  K · der nächste gültige Stand löscht den Verwurf, V4
FAIL  L · frueher (entkoppelt), V13 gelb mit Zusatz L
FAIL  L · neu gekoppelt → Stand vom Master gilt wieder als neue Show, V4
FAIL  M · Zwischenspeicher angewendet: einmal, neueShow false, dieselbe Show
FAIL  M · V11 mit Zusatz L (letzter Stand aus dem Zwischenspeicher)
FAIL  M · erst V9 „nicht verbunden“, dann V11
FAIL  M · im Verbundmodus (gleicher Master)
FAIL  N · V3 „antwortet nicht auf die Anfrage nach Show-Daten …“ mit Zusatz L, gelb
FAIL  N · Abo wird wiederholt
FAIL  N · das wiederholte Abo wird beantwortet, V4
FAIL  O · das 2b-Tool bekommt die Änderung
```
danach `Verteiler-Log (Master):`, `Tool-Log:`, `GEGENPROBE nur-erstes-abo: rote Zeilen oben sind erwartet (C19).`, `34 ok, 29 fehlgeschlagen.` und `Exit: 1`. Bleibt Abschnitt E grün, prüft der Test das Neuabo nicht: anhalten und melden.

- [ ] **Step 5: Gegenprobe 2 — Zwischenspeicher speichert nichts (rot)**

```bash
KETTE_GEGENPROBE=ohne-speicher node node_modules/tsx/dist/cli.mjs apps/launcher/test/verbund-kette.test.ts 2>&1 | tee "$TEMP/kette-gegenprobe-2.log"; echo "Exit: ${PIPESTATUS[0]}"
```
Erwartet (gemessen; Details nach „ — “ weggelassen): genau diese 7 `FAIL`-Zeilen
```
FAIL  A · Zwischenspeicher geschrieben (fassung 1, Epoche und Folge des Stands)
FAIL  L · nicht mehr im Verbundmodus, Daten und Zwischenspeicher bleiben
FAIL  M · Zwischenspeicher angewendet: einmal, neueShow false, dieselbe Show
FAIL  M · V11 mit Zusatz L (letzter Stand aus dem Zwischenspeicher)
FAIL  M · erst V9 „nicht verbunden“, dann V11
FAIL  M · im Verbundmodus (gleicher Master)
FAIL  N · V3 „antwortet nicht auf die Anfrage nach Show-Daten …“ mit Zusatz L, gelb
```
`GEGENPROBE ohne-speicher: rote Zeilen oben sind erwartet (C19).`, `56 ok, 7 fehlgeschlagen.` und `Exit: 1`. Beide Protokolle (`$TEMP/kette-gegenprobe-*.log`) gehören mit ihren `FAIL`-Zeilen wörtlich in den Aufgabenbericht und danach gelöscht: `rm "$TEMP"/kette-gegenprobe-*.log`.

- [ ] **Step 6: Skript `selftest:verbund` erweitern**

Datei `apps/launcher/package.json`. Vorher (eindeutig, Stand nach C8):
```json
    "selftest:verbund": "tsx test/verbund.test.ts && tsx test/verteiler.test.ts",
```
Nachher:
```json
    "selftest:verbund": "tsx test/verbund.test.ts && tsx test/verteiler.test.ts && tsx test/verbund-kette.test.ts",
```

- [ ] **Step 7: Lauf über das Skript (grün)**

Befehl: `npm run selftest:verbund -w @jm/launcher; echo "Exit: $?"`
Erwartet (gemessen, 24,7–27 s, N35): drei Zählzeilen
```
203 ok, 0 fehlgeschlagen.
53 ok, 0 fehlgeschlagen.
63 ok, 0 fehlgeschlagen.
```
und `Exit: 0`.

- [ ] **Step 8: Typecheck und Zeilenenden**

Befehl:
```bash
npm run typecheck -w @jm/launcher; echo "Exit: $?"
node -e "const s=require('fs').readFileSync('apps/launcher/package.json','utf8');console.log((s.match(/\r\n/g)||[]).length+' CRLF / '+(s.match(/\n/g)||[]).length+' LF')"
```
Erwartet: Typecheck ohne Meldung, `Exit: 0`; danach zwei gleiche Zahlen (`61 CRLF / 61 LF` vor C21; die Zahl hängt an den früheren Aufgaben, maßgeblich ist CRLF = LF).

- [ ] **Step 9: Commit**

```bash
git status --short
```
Erwartet genau:
```
 M apps/launcher/package.json
?? apps/launcher/test/verbund-kette.test.ts
```
Zeigt er mehr, nicht committen, sondern melden.
```bash
git add apps/launcher/test/verbund-kette.test.ts apps/launcher/package.json
git status --short
```
Erwartet genau:
```
M  apps/launcher/package.json
A  apps/launcher/test/verbund-kette.test.ts
```
Dann (Commit-Text ohne Umlaute):
```bash
git commit -m "test(launcher): Kette Master-Verteiler-Tool ohne Electron (Teil 2b R2, Spec 18)" -m "Echter MasterLinkServer und Verteiler am Master, echter MasterLinkClient mit VerbundFolger, Zwischenspeicher und Anzeige am Tool, TLS nur auf 127.0.0.1, Fristen verkuerzt. Jede ohne Electron nachbaubare Zeile aus Spec 18 als Abschnitt A bis R, Netz weg ueber eine TCP-Strecke. Gegenprobe ueber KETTE_GEGENPROBE. selftest:verbund fuehrt den Test mit aus." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
1. Am Master laufen `MasterLinkServer` und `Verteiler` direkt, verdrahtet wie `MasterRolle` (`haengeAn`), nicht `MasterRolle` selbst. Die Rolle braucht Identitäts- und Verbunddateien; ihre Verdrahtung prüft C9 in `verbund.test.ts`. Das Gerüst lässt beides zu („`MasterRolle` oder `MasterLinkServer` direkt“).
2. Mehr Zeilen als in der Gerüst-Liste: D und E (Netz kurz bzw. länger weg, über die Strecke), P (Slave-Launcher) und R (Rolle „aus“). Spec 18 nennt sie; ohne Electron sind sie nachbaubar.
3. Gegenprobe über den Schalter `KETTE_GEGENPROBE` (Testnaht `ClientLike` bzw. `StandSpeicher`), weil C19 keinen eigenen Produktcode hat, an dem ein Rot-Lauf zu zeigen wäre. Vorbild ist `E2E_TITLER_DIR` aus R1.
4. Relativimporte ohne `.ts`-Endung, wie die Nachbartests (`verbund.test.ts`); das Register nennt die Dateien mit Endung.
5. `fristen` mit kurzen Werten setzt voraus, dass C12 `Partial<VerbundFristen>` nimmt (E45); so ist es umgesetzt, der Test ist typrein (Step 2).
6. Zusatzprüfung „M · beim Start nie V13“: Sie hält fest, dass der Folger erst nach `client.starte()` startet (G2 c, ZF2; Step 3).
7. Beim Zusammenführen mit dem ganzen Plan gemessen (Steps 2–8): tsc ohne Meldung; `63 ok, 0 fehlgeschlagen.` in 9–10 s; Gegenproben mit 29 bzw. 7 `FAIL`-Zeilen. Zwei Befunde dieses Tests haben den Plan geändert: J (C12 rief `anwenden` fünf- statt sechsmal, ZF1) und M (der Folger startete vor `client.starte()`, ZF2).

---

### Task 20: C20 · Durchgang mit gebauten Tools und Test-Master (19.7, nur nach Owner-Freigabe; erteilt am 08.10.2026)

**Spec:** 19.7 vollständig, 25 Nr. 8 (Port 8738 vorher prüfen); G8 (`%APPDATA%` nur hier und nur nach Freigabe); Entscheidung E26.

Worum es geht, in den Worten der Spec (19.7):
- „Das Skript startet einen `MasterLinkServer` mit Test-Identität auf Port 8738 und den Verteiler mit einer Test-Show.“
- „Es schreibt für die Tools eine `master-link.json` mit Rolle Slave und fester Adresse `127.0.0.1` … Vorher legt es die vorhandene Datei beiseite.“
- „Gestartet werden gebaute Timer, Titler und Rundown ohne Deep-Link, jeweils mit `--remote-debugging-port`.“
- „**Messpunkte:** STATE über den Steuerport; die V-Zeile je Tool per CDP über `verbundAnzeige()` aus dem Preload (16.5); die Hinweise des Rundowns per CDP, gesammelt …; das Bild des Titlers als SHA-256 von `toDataURL()` …, mit der Vorlage `{{name}}`/`{{funktion}}`.“
- Prüfungen: „1. Alle drei zeigen die Test-Show (STATE von Timer, Titler, Rundown) und V4. 2. Änderung am Ablauf → angewendet in höchstens 2 s. 3. Bauchbinde auf Sendung (Bild A), Speakerliste ohne diese Person verteilen → `entry` bleibt **und** Bild gleich A. 4. Server stoppen → Daten bleiben, V9 bzw. V11; Server mit neuer Epoche und gleicher Show starten → V4, und die gesammelten Hinweise des Rundowns enthalten keinen neuen Eintrag. 5. Tool neu starten, ohne Server → Daten aus dem Zwischenspeicher, V9 bzw. V11 mit Zusatz L. 6. Gleichzeitiges RELOAD über den Steuerport → ignoriert, Logzeile. 7. `master-link.json` auf Rolle „aus“ umschreiben → V13 „Daten vom früheren Master …“, Daten bleiben.“

**Arbeitsverzeichnis:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b-r2`, Branch `feat/master-link-teil2b-r2`, Bash. Voraussetzung: C1–C19 sind committet (inhaltlich: C14, C16, C18 mit den Preload-Funktionen `verbundAnzeige()`, C13 Zwischenspeicher, C8 Verteiler).

**Freigabe:** Steps 1–6 laufen ohne Freigabe, sie fassen weder `%APPDATA%` noch Electron an. Ab Step 7 geht es nur weiter, wenn im Ledger der Lauf die Zeile **„Owner-Freigabe C20“** steht. Die schreibt die steuernde Sitzung erst nach der Antwort des Owners; sie erteilt sie nicht selbst (R1-Ruling K3). Der Owner hat den Durchgang am 08.10.2026 freigegeben (Owner-Frage 8, N19); die steuernde Sitzung setzt die Zeile beim Start der Umsetzung, C20 läuft dann ganz. Fehlt die Zeile trotzdem, endet C20 nach Step 6 mit dem Commit des Skripts, und der Lauf (Steps 7–11) wird vor dem Merge nachgeholt (N14). Was der Durchgang nicht erreicht (Show-Link, Startreihenfolge, gesperrte Ordnerwahl), steht als Handprüfung in der Abnahme-Datei (C21, N17).

**Dateien:**
- Create: `apps/launcher/test/e2e-teil2b-verbund.ts`
- Kein Produktcode, nicht in der CI. `apps/rundown/test/e2e-teil2a.mjs` bleibt unverändert (G1, E26).

**Interfaces:**
- Consumes:
  - S-A: `MasterLinkServer` (wie C19, Port `MASTER_PORT` = 8738), `SpeicherVerbund`, `erzeugeSchluesselpaar`, `fingerprintVonPem`, `masterLinkPfad`, `schreibeMasterLinkDatei`, Typen `AboInhalt`, `MasterLinkDatei`, `TeilnehmerDaten`; `neueIdentitaet(name)` aus `packages/master-link/test/aufbau.ts`.
  - S-B: `Verteiler` (`starte`, `stoppe`, `meldeShow`, `aufAbo`, `aufGetrennt`, `aufEntstaut`, `stand(): VerteilerStand` mit `epoche`, `showName`, `abos`).
  - S-D je Tool im Preload: `window.jm.verbundAnzeige()`, `window.jmtitler.verbundAnzeige()`, `window.jmrundown.verbundAnzeige()` → `Promise<{ text, farbe } | null>`; dazu wie in 2a `window.jmrundown.getState()` (`doc.rows`, `hinweise`).
  - Steuerports und STATE: Titler 8726 (`entry`, `entry_index`, `entry_count`, `on_air`), Rundown 8731 (`total`); Timer-Socket 7777 (`state` mit `timetable.items`); Befehle `TIMER RELOAD`, `TITLER RELOAD`, `RUNDOWN RELOAD`, `TITLER RECALL <Name>`, `TITLER TAKE`, `TITLER CLEAR`.
  - Texte: V4, V9, V11, V13 und Zusatz L aus Spec 16.4; die Logzeile „Verbund: RELOAD ignoriert, die Show-Daten kommen vom Master „⟨M⟩“.“ aus 16.1; die Titler-Logzeile A2 aus 2b-Spec 7.9.
- Produces: nur das Skript.

Regeln für diese Aufgabe:
- G8: Nur das Skript legt unter `%APPDATA%` beiseite, schreibt dort und stellt wieder her, und nur ab Step 7 mit Freigabe. Kein Agent liest dort Dateien; das Skript tut es selbst.
- E26: eigene Helfer; `bis()` fängt Ausnahmen, DevTools wertet `error` und `exceptionDetails` aus, jede Prüfzeile hat ein Detail, der Bildvergleich hat die Gegenprobe „Bild A ist nicht das leere Bild“.
- Kein zweiter Worktree und keine Junction in dieser Aufgabe (R1: 50 tote Junctions aus dem Gegenprobe-Worktree).
- G12: neue Datei mit dem Write-Werkzeug (LF).
- Alle Befehle im Worktree-Wurzelverzeichnis, Bash.

Was das Skript beiseitelegt und wiederherstellt (umbenennen nach `<name>.e2e-vorher`, Muster `e2e-teil2a.mjs:62-71` und `:380-421`; bei jedem Ausgang zurück, auch bei Abbruch und Strg+C; liegt noch ein `.e2e-vorher` da, bricht es vor dem Start ab):
- `%APPDATA%\JM Production Suite\master-link.json`
- `%APPDATA%\@jm\timer\state.json`, `%APPDATA%\@jm\timer\verbund`
- `%APPDATA%\@jm\titler\titler-config.json`, `iveo-data`, `show-zuletzt.json`, `verbund`
- `%APPDATA%\@jm\rundown\regie` (Zeiger und Gedächtnis), `rundown.autosave.jmrundown`, `rundown.autosave.v1.jmrundown`, `verbund`

Ports, die vorher frei sein müssen: 8738 (Test-Master), 8736 (Launcher: läuft einer, liest er die geschriebene `master-link.json` mit), 7777 (Timer-Socket), 8724, 8726, 8731 (Steuerports Timer, Titler, Rundown), 9334, 9335, 9336 (DevTools Rundown, Titler, Timer).

- [ ] **Step 1: Skript schreiben**

Neue Datei `apps/launcher/test/e2e-teil2b-verbund.ts` (ganzer Inhalt):
```ts
// ─────────────────────────────────────────────────────────────────────────────
// Durchgang Master-Link Teil 2b, Release 2 (2b-Spec 19.7) mit den GEBAUTEN Tools Timer, Titler und Rundown.
// NICHT in der CI: startet die drei Tools aus diesem Repo als echte Electron-Programme, ohne Deep-Link, und spielt
// selbst den Master: MasterLinkServer mit Test-Identität auf Port 8738 und Verteiler mit einer Test-Show.
// Ein Launcher läuft nicht mit.
//
// Aufruf (Repo-Wurzel, nach `npm run build -w @jm/timer -w @jm/titler -w @jm/rundown`):
//   ELECTRON_EXE=<Pfad zu electron.exe> node node_modules/tsx/dist/cli.mjs apps/launcher/test/e2e-teil2b-verbund.ts
// ELECTRON_EXE ist Pflicht. Ohne sie bricht das Skript ab, bevor es eine Datei oder einen Port anfasst.
//
// Vorher darf kein Launcher, Timer, Titler oder Rundown laufen
// (Ports 8738, 8736, 7777, 8724, 8726, 8731, 9334, 9335, 9336 frei).
// Das Skript legt die Daten, die es verändert, VOR dem Lauf beiseite (umbenennen nach <name>.e2e-vorher) und
// stellt sie in jedem Ausgang wieder her (auch Abbruch und Strg+C):
//   %APPDATA%\JM Production Suite\master-link.json (das Skript schreibt eine eigene: Rolle Slave, Master 127.0.0.1:8738),
//   %APPDATA%\@jm\timer\state.json, %APPDATA%\@jm\timer\verbund,
//   %APPDATA%\@jm\titler\titler-config.json, iveo-data, show-zuletzt.json, verbund,
//   %APPDATA%\@jm\rundown\regie, rundown.autosave.jmrundown, rundown.autosave.v1.jmrundown, verbund.
// Liegt von einem früheren Lauf (auch von e2e-teil2a.mjs) noch eine <name>.e2e-vorher da, bricht es ab.
//
// Messpunkte (19.7): STATE über die Steuerports (Titler 8726, Rundown 8731), den Timer-Ablauf über den
// Timer-Socket 7777, die V-Zeile je Tool per DevTools über verbundAnzeige() aus dem Preload (Timer 9336, Titler 9335,
// Rundown 9334), die Hinweise des Rundowns (gesammelt: kurze verschwinden nach 6 s) und das Vorschaubild des Titlers
// (SHA-256 von toDataURL(), 1,5 s nach jeder Aktion, Gegenprobe „Bild nicht leer“).
// Eigene Helfer statt e2e-teil2a.mjs (Entscheidung E26): bis() fängt Ausnahmen, DevTools wertet `error` aus, jede
// Prüfzeile trägt ein Detail.
// ─────────────────────────────────────────────────────────────────────────────
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { io, type Socket as IoSocket } from 'socket.io-client';
import { controlClientOptions, readControlConfig } from '@jm/control-config';
import {
  erzeugeSchluesselpaar, fingerprintVonPem, MASTER_PORT, masterLinkPfad, MasterLinkServer, schreibeMasterLinkDatei, SpeicherVerbund,
  type AboInhalt, type MasterLinkDatei, type TeilnehmerDaten,
} from '@jm/master-link';
import { migrateShow, type Show } from '@jm/show';
import { SuiteControlClient } from '@jm/suite-control-protocol/client';
import { neueIdentitaet } from '../../../packages/master-link/test/aufbau';
import { Verteiler } from '../src/main/verbund/verteiler';

type Tool = 'timer' | 'titler' | 'rundown';
const TOOLS: Tool[] = ['timer', 'titler', 'rundown'];
const NAME: Record<Tool, string> = { timer: 'Timer', titler: 'Titler', rundown: 'Rundown' };
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ELECTRON = process.env.ELECTRON_EXE ?? '';
const APPDATA = process.env.APPDATA ?? '';
/** userData eines Dev-Starts: Electron nimmt den Paketnamen @jm/<app>. */
const DEV = (app: Tool): string => join(APPDATA, '@jm', app);
const LOG = (app: Tool): string => join(DEV(app), 'logs', 'main.log');
const CDP: Record<Tool, number> = { rundown: 9334, titler: 9335, timer: 9336 };
const STEUER: Record<Tool, number> = { timer: 8724, titler: 8726, rundown: 8731 };
const PORTS: Record<string, number> = {
  master: MASTER_PORT, launcher: 8736, timerSocket: 7777, timer: STEUER.timer, titler: STEUER.titler, rundown: STEUER.rundown,
  rundownDevTools: CDP.rundown, titlerDevTools: CDP.titler, timerDevTools: CDP.timer,
};
const VORHER = '.e2e-vorher';
const SICHERN = [
  masterLinkPfad(APPDATA),
  join(DEV('timer'), 'state.json'),
  join(DEV('timer'), 'verbund'),
  join(DEV('titler'), 'titler-config.json'),
  join(DEV('titler'), 'iveo-data'),
  join(DEV('titler'), 'show-zuletzt.json'),
  join(DEV('titler'), 'verbund'),
  join(DEV('rundown'), 'regie'),
  join(DEV('rundown'), 'rundown.autosave.jmrundown'),
  join(DEV('rundown'), 'rundown.autosave.v1.jmrundown'),
  join(DEV('rundown'), 'verbund'),
];
const MASTER_NAME = 'E2E-Master';
const SHOW_NAME = 'E2E Verbund';
const SHOW_PFAD = join(tmpdir(), 'jm-e2e-2b', 'E2E Verbund.jmshow'); // nur für den Schlüssel; die Datei muss nicht existieren
const RECHNER_B = { id: 'e2e-rechner-b', name: 'E2E-Rechner-B' };
const LABEL: Record<string, string> = { 'v-1': 'Begrüßung', 'v-2': 'Panel', 'v-3': 'Abschluss', 'v-4': 'Ausblick' };
// Einwort-Namen: STATE trennt an Leerzeichen, so liest der Titler-Messpunkt den ganzen Namen.
const FUNKTION: Record<string, string> = { Ada: 'Moderation', Grace: 'Keynote', Alan: 'Panel', Hedy: 'Panel' };
const env: NodeJS.ProcessEnv = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

// ── Kleinkram (E26) ────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
let letzterFehler = '';
/** Wartet, bis f() einen wahren Wert liefert. Eine Ausnahme zählt als „noch nicht“ und wird gemerkt (E26). */
async function bis<T>(f: () => T | Promise<T>, maxMs: number, schrittMs = 200): Promise<T | null> {
  const ende = Date.now() + maxMs;
  for (;;) {
    try {
      const v = await f();
      if (v) return v;
    } catch (e) {
      letzterFehler = (e as Error).message;
    }
    if (Date.now() >= ende) return null;
    await sleep(schrittMs);
  }
}
/** Text für eine Detailzeile; eine Ausnahme wird zum Text statt zum Abbruch. */
async function sicher(f: () => Promise<string> | string): Promise<string> {
  try { return await f(); } catch (e) { return `Fehler: ${(e as Error).message}`; }
}
function portFrei(port: number): Promise<boolean> {
  return new Promise((r) => {
    const s = connect({ port, host: '127.0.0.1' });
    s.once('connect', () => { s.destroy(); r(false); });
    s.once('error', () => r(true));
  });
}
const warteAufPort = (port: number, maxMs: number) => bis(async () => !(await portFrei(port)), maxMs, 300);
const ergebnisse: { name: string; ok: boolean }[] = [];
/** Jede Prüfzeile mit Detail (E26): auch eine grüne Zeile sagt, was gemessen wurde. */
function pruefe(name: string, ok: boolean, detail: string): void {
  ergebnisse.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name} — ${detail || '(leer)'}`);
}
const kurz = (h: string): string => h.slice(0, 12);
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── Logs: nur was seit einer Marke dazukam ─────────────────────────────────────
function logMarke(app: Tool): number {
  return existsSync(LOG(app)) ? statSync(LOG(app)).size : 0;
}
function logAb(app: Tool, marke: number): string {
  if (!existsSync(LOG(app))) return '';
  const buf = readFileSync(LOG(app));
  return (buf.length >= marke ? buf.subarray(marke) : buf).toString('utf8');
}
const letzteZeilen = (t: string, n = 2): string => t.trim().split(/\r?\n/).slice(-n).join(' / ').slice(0, 240) || '(keine neue Zeile)';

// ── Test-Master: Test-Identität aus den Master-Link-Helfern, ein gekoppelter Rechner B ──
const identitaet = neueIdentitaet(MASTER_NAME);
const slavePaar = erzeugeSchluesselpaar();
const verbund = new SpeicherVerbund([
  { rechnerId: 'e2e-master', name: MASTER_NAME, schluessel: erzeugeSchluesselpaar().oeffentlich, gekoppeltAm: 1, zuletztGesehen: null, letzteAdresse: null, dieserRechner: true },
  { rechnerId: RECHNER_B.id, name: RECHNER_B.name, schluessel: slavePaar.oeffentlich, gekoppeltAm: 1, zuletztGesehen: null, letzteAdresse: null, dieserRechner: false },
]);
const masterLog: string[] = [];
const verteiler = new Verteiler({ log: (stufe, text) => masterLog.push(`${stufe}: ${text}`), rechnerName: (id) => verbund.finde(id)?.name ?? id });
let server: MasterLinkServer | null = null;
/** Start der Rolle Master: neuer Server, Verteiler mit neuer Epoche, verdrahtet wie MasterRolle (C9). */
async function starteMaster(): Promise<void> {
  const s = new MasterLinkServer({
    identitaet, verbund, eigeneRechnerId: 'e2e-master', suiteVersion: '0.15.0', lauschAdressen: ['127.0.0.1'], port: MASTER_PORT,
    log: (stufe, text) => masterLog.push(`${stufe}: ${text}`),
  });
  s.on('daten', (t: TeilnehmerDaten, abo: AboInhalt) => verteiler.aufAbo(t, abo));
  s.on('getrennt', (sitzung: number) => verteiler.aufGetrennt(sitzung));
  s.on('entstaut', (sitzung: number) => verteiler.aufEntstaut(sitzung));
  verteiler.starte(s);
  await s.starte();
  server = s;
}
async function stoppeMaster(): Promise<void> {
  const s = server;
  server = null;
  if (s) await s.stoppe();
  verteiler.stoppe();
}
/** master-link.json der Tools: Rechner B, gekoppelt mit dem Test-Master, feste Adresse 127.0.0.1 (19.7). */
function dateiB(rolle: 'slave' | 'aus'): MasterLinkDatei {
  return {
    version: 1, rolle, rechner: { ...RECHNER_B }, netzwerk: { karte: null },
    kopplung: {
      masterId: identitaet.masterId, masterName: MASTER_NAME, fingerprint: fingerprintVonPem(identitaet.zertifikat),
      zertifikat: identitaet.zertifikat, port: MASTER_PORT, adressen: ['127.0.0.1'], letzteAdresse: '127.0.0.1',
      festeAdresse: '127.0.0.1', schluessel: slavePaar,
    },
  };
}
function testShow(ablauf: string[], speaker: string[]): Show {
  return migrateShow({
    schemaVersion: 1,
    name: SHOW_NAME,
    updatedAt: new Date().toISOString(),
    tools: [],
    ablauf: ablauf.map((id) => ({ id, label: LABEL[id], durationMs: 600_000 })),
    iveo: { event: 'e2e-verbund', name: SHOW_NAME, syncedAt: new Date().toISOString(), speakers: speaker.map((name) => ({ name, title: FUNKTION[name] })), sideEvents: [] },
  });
}

// ── Prozesse ───────────────────────────────────────────────────────────────────
const kinder = new Map<Tool, ChildProcess>();
function starteTool(app: Tool): void {
  const p = spawn(ELECTRON, [`--remote-debugging-port=${CDP[app]}`, join(REPO, 'apps', app)], { env, stdio: 'ignore' });
  kinder.set(app, p);
}
async function beendeTool(app: Tool): Promise<void> {
  sitzungen[app]?.schliesse();
  sitzungen[app] = null;
  const p = kinder.get(app);
  kinder.delete(app);
  if (p && p.exitCode === null) {
    const weg = new Promise((r) => p.once('exit', r));
    p.kill();
    await Promise.race([weg, sleep(15_000)]);
  }
  await bis(() => portFrei(STEUER[app]), 15_000, 200);
  await bis(() => portFrei(CDP[app]), 15_000, 200);
}

// ── DevTools (E26: wertet result.exceptionDetails UND error aus) ──────────────
interface CdpAntwort {
  id: number;
  error?: { message: string };
  result?: { result?: { value?: unknown }; exceptionDetails?: { text?: string; exception?: { description?: string } } };
}
interface Sitzung { werte(ausdruck: string, ms?: number): Promise<unknown>; schliesse(): void }
const BRUECKE: Record<Tool, string> = { timer: 'window.jm', titler: 'window.jmtitler', rundown: 'window.jmrundown' };
const FENSTER: Record<Tool, (url: string) => boolean> = {
  timer: (url) => url.includes('view=operator'),
  // Bedienfenster = index.html ohne ?view= (Recall-Board und 2. Bildschirm tragen view=recall bzw. view=output).
  titler: (url) => url.includes('index.html') && !url.includes('view='),
  rundown: (url) => url.includes('index.html'),
};
const BEREIT: Record<Tool, string> = {
  timer: 'typeof window.jm?.verbundAnzeige === "function"',
  titler: 'typeof window.jmtitler?.verbundAnzeige === "function" && document.querySelector("canvas") !== null',
  rundown: 'typeof window.jmrundown?.verbundAnzeige === "function" && typeof window.jmrundown?.getState === "function"',
};
const sitzungen: Record<Tool, Sitzung | null> = { timer: null, titler: null, rundown: null };
async function verbindeDevTools(app: Tool): Promise<void> {
  const name = NAME[app];
  const ziel = await bis(async () => {
    const l = (await (await fetch(`http://127.0.0.1:${CDP[app]}/json/list`)).json()) as { type: string; url: string; webSocketDebuggerUrl: string }[];
    return l.find((t) => t.type === 'page' && FENSTER[app](t.url)) ?? null;
  }, 60_000, 300);
  if (!ziel) throw new Error(`${name}: Fenster per DevTools nicht erreichbar (${letzterFehler || 'keine passende Seite'})`);
  const ws = new WebSocket(ziel.webSocketDebuggerUrl);
  await new Promise<void>((ok, fehler) => {
    ws.addEventListener('open', () => ok(), { once: true });
    ws.addEventListener('error', () => fehler(new Error(`${name}: DevTools-Verbindung scheitert`)), { once: true });
  });
  let naechste = 1;
  const warten = new Map<number, (d: CdpAntwort) => void>();
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(String(m.data)) as CdpAntwort;
    const w = warten.get(d.id);
    if (w) { warten.delete(d.id); w(d); }
  });
  ws.addEventListener('close', () => {
    for (const [id, w] of warten) { warten.delete(id); w({ id, error: { message: 'DevTools-Verbindung geschlossen' } }); }
  });
  const werte = (ausdruck: string, ms = 15_000): Promise<unknown> => new Promise((ok, fehler) => {
    const id = naechste++;
    const t = setTimeout(() => { warten.delete(id); fehler(new Error(`${name}: DevTools-Frist für ${ausdruck.slice(0, 60)}`)); }, ms);
    warten.set(id, (d) => {
      clearTimeout(t);
      if (d.error) fehler(new Error(`${name}: DevTools ${d.error.message}`));
      else if (d.result?.exceptionDetails) {
        const x = d.result.exceptionDetails;
        fehler(new Error(`${name}: ${x.exception?.description ?? x.text ?? 'Fehler im Fenster'}`));
      } else ok(d.result?.result?.value);
    });
    try {
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: ausdruck, returnByValue: true, awaitPromise: true } }));
    } catch (e) {
      clearTimeout(t);
      warten.delete(id);
      fehler(e as Error);
    }
  });
  if (!(await bis(async () => (await werte(BEREIT[app])) === true, 30_000))) {
    throw new Error(`${name}: Preload-Brücke nicht bereit (${letzterFehler || BEREIT[app]})`);
  }
  sitzungen[app] = { werte, schliesse: () => { try { ws.close(); } catch { /* schon zu */ } } };
}
function werte(app: Tool, ausdruck: string): Promise<unknown> {
  const s = sitzungen[app];
  if (!s) return Promise.reject(new Error(`${NAME[app]}: keine DevTools-Sitzung`));
  return s.werte(ausdruck);
}

// ── Messpunkte ─────────────────────────────────────────────────────────────────
interface Anzeige { text: string; farbe: string }
/** V-Zeile des Tools aus dem Preload (16.5). */
async function anzeige(app: Tool): Promise<Anzeige | null> {
  return (await werte(app, `${BRUECKE[app]}.verbundAnzeige()`)) as Anzeige | null;
}
const anzeigeText = (app: Tool): Promise<string> => sicher(async () => { const a = await anzeige(app); return a ? `${a.farbe} · ${a.text}` : 'keine Anzeige'; });
const V4 = new RegExp(`^Show vom Master: ${esc(SHOW_NAME)} · Stand \\d{2}:\\d{2}$`);
const ZUSATZ_L = new RegExp(` · letzter Stand: ${esc(SHOW_NAME)} \\d{2}:\\d{2}$`);
const V13 = new RegExp(`^Daten vom früheren Master ${esc(MASTER_NAME)} \\(nicht mehr gekoppelt\\) · letzter Stand: ${esc(SHOW_NAME)} \\d{2}:\\d{2}$`);
const istV4 = (a: Anzeige | null): boolean => !!a && V4.test(a.text) && a.farbe === 'gruen';
/** V9 (gelb, „⟨M⟩ nicht verbunden“) oder V11 (rot, Text des Clients), jeweils mit Zusatz L. */
const istV9oderV11 = (a: Anzeige | null): boolean => !!a && ZUSATZ_L.test(a.text)
  && ((a.farbe === 'gelb' && a.text.startsWith(`${MASTER_NAME} nicht verbunden · letzter Stand: `)) || a.farbe === 'rot');

interface RundownBlick { doc?: { rows?: { id: string; label: string }[] }; hinweise?: { id: number | string; text: string }[] }
let rdLauf = 0;
/** Hinweise des Rundowns: kurze verschwinden nach 6 s, deshalb bei jedem Blick merken (Schlüssel Lauf + id). */
const gesehen = new Map<string, string>();
async function rdStand(): Promise<RundownBlick> {
  const st = ((await werte('rundown', 'window.jmrundown.getState()')) ?? {}) as RundownBlick;
  for (const h of st.hinweise ?? []) gesehen.set(`${rdLauf}:${h.id}`, h.text);
  return st;
}
const zeilenIds = (st: RundownBlick): string => (st.doc?.rows ?? []).map((r) => r.id).join(',');

async function bildHash(): Promise<string> {
  const daten = await werte('titler', "document.querySelector('canvas').toDataURL()");
  if (typeof daten !== 'string' || !daten.startsWith('data:image/png')) throw new Error('Titler: Vorschau-Canvas liefert kein Bild');
  return createHash('sha256').update(daten).digest('hex');
}
/** Vorlage Bauchbinde mit {{name}} und {{funktion}}: So zeigt das Vorschaubild den abgerufenen Speaker. */
function schreibeTitlerConfig(): void {
  mkdirSync(DEV('titler'), { recursive: true });
  writeFileSync(join(DEV('titler'), 'titler-config.json'), JSON.stringify({ template: 'lowerthird', name: '{{name}}', subtitle: '{{funktion}}' }, null, 2), 'utf8');
}

interface Steuer { sende(z: string): void; kv(): Record<string, string>; bereit(): boolean; trenne(): void }
const steuer: Steuer[] = [];
function steuerClient(port: number, sicherheit: ReturnType<typeof controlClientOptions>): Steuer {
  let kv: Record<string, string> | null = null;
  const c = new SuiteControlClient({
    ...sicherheit, reconnectMs: 500,
    onState: (st) => { kv = Object.fromEntries(Object.entries(st.kv).map(([k, v]) => [k, String(v)])); },
  });
  c.connect('127.0.0.1', port);
  const s: Steuer = { sende: (z) => c.send(z), kv: () => kv ?? {}, bereit: () => kv !== null, trenne: () => c.disconnect() };
  steuer.push(s);
  return s;
}
const titlerKurz = (kv: Record<string, string>): string => `entry „${kv.entry ?? ''}“ Eintrag ${kv.entry_index ?? '?'}/${kv.entry_count ?? '?'}, on_air=${kv.on_air ?? '?'}`;
interface TimerStand { timetable?: { items?: { id?: string; label: string }[]; activeIndex?: number | null } }
let timerStand: TimerStand | null = null;
let timerSocket: IoSocket | null = null;
const timerIds = (): string => (timerStand?.timetable?.items ?? []).map((i) => i.id ?? '-').join(',');

// ── Beiseitelegen / Aufräumen (Muster e2e-teil2a.mjs) ─────────────────────────
const gesichert: string[] = [];
const freigemacht: string[] = []; // Pfade, die der Lauf leer vorfand oder beiseitegelegt hat (nur die darf er am Ende löschen)
let beiseiteGelegt = false;
function legeBeiseite(): void {
  for (const p of SICHERN) {
    if (existsSync(p + VORHER)) {
      console.log(`ABBRUCH vor dem Start: ${p + VORHER} liegt noch da (voriger Lauf?) — erst von Hand zurückbenennen.`);
      process.exit(3);
    }
  }
  beiseiteGelegt = true; // vor der Schleife: scheitert renameSync mittendrin, stellt raeumeAuf die schon verschobenen zurück
  for (const p of SICHERN) {
    if (existsSync(p)) {
      renameSync(p, p + VORHER);
      gesichert.push(p);
    }
    freigemacht.push(p);
  }
}
let aufgeraeumt = false;
async function raeumeAuf(): Promise<void> {
  if (aufgeraeumt) return;
  aufgeraeumt = true;
  try { timerSocket?.close(); } catch { /* schon zu */ }
  for (const s of steuer) s.trenne();
  for (const app of TOOLS) await beendeTool(app).catch(() => {});
  await sleep(2_000); // Windows gibt Dateien erst nach dem Prozessende frei
  await stoppeMaster().catch(() => {});
  if (beiseiteGelegt) {
    for (const p of freigemacht) {
      rmSync(p, { recursive: true, force: true }); // was der Lauf angelegt hat
      if (gesichert.includes(p)) renameSync(p + VORHER, p);
    }
  }
  console.log('aufgeräumt: Prozesse beendet, Test-Master gestoppt, Dev-Daten wiederhergestellt.');
}
process.on('SIGINT', () => { void raeumeAuf().then(() => process.exit(130)); });

async function starteTools(): Promise<void> {
  rdLauf += 1;
  for (const app of TOOLS) starteTool(app);
  for (const app of TOOLS) {
    if (!(await warteAufPort(STEUER[app], 60_000))) throw new Error(`${NAME[app]}: Steuerport ${STEUER[app]} kommt nicht hoch`);
  }
  for (const app of TOOLS) await verbindeDevTools(app);
}
async function wartV4(nr: string): Promise<void> {
  for (const app of TOOLS) {
    const z = await bis(async () => { const a = await anzeige(app); return istV4(a) ? a : null; }, 60_000, 500);
    pruefe(`${nr} · ${NAME[app]}: V4 „Show vom Master: ${SHOW_NAME} · Stand hh:mm“, grün`, !!z, z ? z.text : await anzeigeText(app));
  }
}

// ── Ablauf ─────────────────────────────────────────────────────────────────────
const ABLAUF_1 = ['v-1', 'v-2', 'v-3'];
const ABLAUF_2 = ['v-1', 'v-2', 'v-3', 'v-4'];
const ALLE = ['Ada', 'Grace', 'Alan', 'Hedy'];
const OHNE_ALAN = ['Ada', 'Grace', 'Hedy'];

async function main(): Promise<void> {
  // Vorbedingungen: bis legeBeiseite() fasst das Skript nichts an.
  if (!ELECTRON) {
    console.log('ABBRUCH: ELECTRON_EXE ist nicht gesetzt — Pfad zu einer electron.exe (Electron 33) angeben.');
    process.exit(2);
  }
  if (!existsSync(ELECTRON)) {
    console.log(`ABBRUCH: ${ELECTRON} fehlt — ELECTRON_EXE auf eine vorhandene electron.exe (Electron 33) setzen.`);
    process.exit(2);
  }
  if (!APPDATA) {
    console.log('ABBRUCH: APPDATA ist nicht gesetzt.');
    process.exit(2);
  }
  for (const app of TOOLS) {
    if (!existsSync(join(REPO, 'apps', app, 'out', 'main', 'index.cjs'))) {
      console.log(`ABBRUCH: apps/${app} ist nicht gebaut — erst npm run build -w @jm/${app}.`);
      process.exit(2);
    }
  }
  for (const [name, port] of Object.entries(PORTS)) {
    if (!(await portFrei(port))) {
      console.log(`ABBRUCH: Port ${port} (${name}) belegt — läuft noch ein Launcher, Timer, Titler oder Rundown?`);
      process.exit(2);
    }
  }
  legeBeiseite();
  schreibeTitlerConfig();
  schreibeMasterLinkDatei(masterLinkPfad(APPDATA), dateiB('slave'));
  verteiler.meldeShow(SHOW_PFAD, testShow(ABLAUF_1, ALLE));
  await starteMaster();
  await starteTools();
  const sicherheit = controlClientOptions(readControlConfig(APPDATA));
  const titlerSt = steuerClient(STEUER.titler, sicherheit);
  const rundownSt = steuerClient(STEUER.rundown, sicherheit);
  const timerSt = steuerClient(STEUER.timer, sicherheit);
  timerSocket = io(`http://127.0.0.1:${PORTS.timerSocket}`, { transports: ['websocket'], reconnectionDelay: 500 });
  timerSocket.on('state', (s: TimerStand) => { timerStand = s; });
  await bis(() => titlerSt.bereit() && rundownSt.bereit() && timerSt.bereit(), 15_000);

  console.log('\n— 1 · Alle drei zeigen die Test-Show (STATE) und V4');
  await wartV4('1');
  pruefe('1 · Timer: Ablauf der Test-Show (Timer-Socket)', !!(await bis(() => timerIds() === ABLAUF_1.join(','), 15_000)), timerIds() || 'kein Timer-Zustand');
  pruefe('1 · Titler: STATE entry_count 4 (Speaker der Test-Show)', !!(await bis(() => titlerSt.kv().entry_count === '4', 15_000)), titlerKurz(titlerSt.kv()));
  const st1 = await bis(async () => { const st = await rdStand(); return zeilenIds(st) === ABLAUF_1.join(',') && rundownSt.kv().total === '3' ? st : null; }, 15_000);
  pruefe('1 · Rundown: STATE total 3 und die drei Punkte mit ihren Kennungen', !!st1, `total=${rundownSt.kv().total} · ${await sicher(async () => zeilenIds(await rdStand()))}`);
  const abos1 = verteiler.stand().abos;
  pruefe('1 · Master: drei Tools beziehen die Show', abos1.length === 3, abos1.map((x) => x.appId).join(', ') || 'keine Abos');

  console.log('\n— 2 · Änderung am Ablauf → angewendet in höchstens 2 s');
  const t0 = Date.now();
  verteiler.meldeShow(SHOW_PFAD, testShow(ABLAUF_2, ALLE));
  let tTimer = -1;
  let tRundown = -1;
  await bis(async () => {
    if (tTimer < 0 && timerIds() === ABLAUF_2.join(',')) tTimer = Date.now() - t0;
    if (tRundown < 0 && zeilenIds(await rdStand()) === ABLAUF_2.join(',')) tRundown = Date.now() - t0;
    return tTimer >= 0 && tRundown >= 0;
  }, 5_000, 50);
  pruefe('2 · Timer übernimmt den neuen Punkt v-4 in höchstens 2 s', tTimer >= 0 && tTimer <= 2_000, tTimer >= 0 ? `${tTimer} ms` : `nicht angekommen · ${timerIds()}`);
  pruefe('2 · Rundown übernimmt den neuen Punkt v-4 in höchstens 2 s', tRundown >= 0 && tRundown <= 2_000,
    tRundown >= 0 ? `${tRundown} ms` : `nicht angekommen · ${await sicher(async () => zeilenIds(await rdStand()))}`);

  console.log('\n— 3 · Bauchbinde auf Sendung (Bild A), Speakerliste ohne diese Person → entry bleibt und Bild gleich A');
  titlerSt.sende('TITLER CLEAR');
  await sleep(1_500);
  const bildLeer = await bildHash();
  titlerSt.sende('TITLER RECALL Alan');
  await bis(() => titlerSt.kv().entry === 'Alan', 5_000);
  titlerSt.sende('TITLER TAKE');
  await bis(() => titlerSt.kv().on_air === '1', 10_000);
  await sleep(1_500);
  const bildA = await bildHash();
  const kvA = { ...titlerSt.kv() };
  pruefe('3 · vorher: Alan auf Sendung', kvA.entry === 'Alan' && kvA.on_air === '1', titlerKurz(kvA));
  pruefe('3 · Gegenprobe: Bild A ist nicht das leere Bild', bildA !== bildLeer, `A ${kurz(bildA)} · leer ${kurz(bildLeer)}`);
  titlerSt.sende('TITLER RECALL Grace');
  await sleep(1_500);
  const bildGrace = await bildHash();
  pruefe('3 · Kontrolle: RECALL Grace → Bild ungleich A', bildGrace !== bildA, `${titlerKurz(titlerSt.kv())} · ${kurz(bildGrace)}`);
  titlerSt.sende('TITLER RECALL Alan');
  await sleep(1_500);
  const bildA2 = await bildHash();
  pruefe('3 · Kontrolle: RECALL Alan → Bild wieder gleich A', bildA2 === bildA, `${titlerKurz(titlerSt.kv())} · ${kurz(bildA2)}`);
  const mTitler3 = logMarke('titler');
  verteiler.meldeShow(SHOW_PFAD, testShow(ABLAUF_2, OHNE_ALAN));
  const drei = await bis(() => titlerSt.kv().entry_count === '3', 10_000);
  await sleep(1_500);
  const kv3 = { ...titlerSt.kv() };
  const bild3 = await bildHash();
  pruefe('3 · Liste ohne Alan angekommen (entry_count 3)', !!drei, titlerKurz(kv3));
  pruefe('3 · entry bleibt Alan, auf Sendung gehalten (entry_index 0)', kv3.entry === 'Alan' && kv3.on_air === '1' && kv3.entry_index === '0', titlerKurz(kv3));
  pruefe('3 · Bild gleich A', bild3 === bildA, `${kurz(bild3)} gegen A ${kurz(bildA)}`);
  const log3 = logAb('titler', mTitler3);
  pruefe('3 · Logzeile A2 im Titler-Log', log3.includes('DataLink: aktiver Eintrag „Alan“ nicht mehr in der Liste, auf Sendung gehalten.'), letzteZeilen(log3));
  titlerSt.sende('TITLER CLEAR');
  await sleep(2_000);

  console.log('\n— 4 · Server stoppen → Daten bleiben, V9 bzw. V11; neue Epoche, gleiche Show → V4, keine neuen Hinweise im Rundown');
  const epocheVorher = verteiler.stand().epoche;
  await stoppeMaster();
  for (const app of TOOLS) {
    const z = await bis(async () => { const a = await anzeige(app); return istV9oderV11(a) ? a : null; }, 30_000, 300);
    pruefe(`4 · ${NAME[app]}: V9 bzw. V11 mit „· letzter Stand: ${SHOW_NAME} hh:mm“`, !!z, z ? `${z.farbe} · ${z.text}` : await anzeigeText(app));
  }
  pruefe('4 · Daten bleiben: Timer v-1…v-4', timerIds() === ABLAUF_2.join(','), timerIds() || 'kein Timer-Zustand');
  pruefe('4 · Daten bleiben: Titler mit 3 Speakern', titlerSt.kv().entry_count === '3', titlerKurz(titlerSt.kv()));
  const zeilen4 = await sicher(async () => zeilenIds(await rdStand()));
  pruefe('4 · Daten bleiben: Rundown v-1…v-4', zeilen4 === ABLAUF_2.join(','), zeilen4);
  const hinweiseVorher = new Set(gesehen.keys());
  await starteMaster();
  const epocheNeu = verteiler.stand().epoche;
  pruefe('4 · Master mit neuer Epoche und gleicher Show', epocheNeu !== null && epocheNeu !== epocheVorher && verteiler.stand().showName === SHOW_NAME,
    `${epocheVorher ?? '-'} → ${epocheNeu ?? '-'} · ${verteiler.stand().showName ?? '-'}`);
  await wartV4('4');
  await bis(async () => { await rdStand(); return false; }, 3_000, 250); // drei Sekunden lang Hinweise sammeln
  const neueHinweise = [...gesehen.entries()].filter(([k]) => !hinweiseVorher.has(k)).map(([, t]) => t);
  pruefe('4 · Rundown: keine neuen Hinweise (gleiche Show, kein Kontextwechsel)', neueHinweise.length === 0, neueHinweise.join(' | ') || 'keine');

  console.log('\n— 5 · Tools neu starten, ohne Server → Daten aus dem Zwischenspeicher, V9 bzw. V11 mit Zusatz L');
  await stoppeMaster();
  for (const app of TOOLS) await beendeTool(app);
  for (const app of TOOLS) {
    const datei = join(DEV(app), 'verbund', 'master-stand.json');
    pruefe(`5 · ${NAME[app]}: Zwischenspeicher liegt da`, existsSync(datei), join('@jm', app, 'verbund', 'master-stand.json'));
  }
  timerStand = null;
  await starteTools();
  for (const app of TOOLS) {
    const z = await bis(async () => { const a = await anzeige(app); return istV9oderV11(a) ? a : null; }, 60_000, 500);
    pruefe(`5 · ${NAME[app]}: V9 bzw. V11 mit Zusatz L nach dem Neustart`, !!z, z ? `${z.farbe} · ${z.text}` : await anzeigeText(app));
  }
  pruefe('5 · Timer: Ablauf v-1…v-4 nach dem Neustart', !!(await bis(() => timerIds() === ABLAUF_2.join(','), 15_000)), timerIds() || 'kein Timer-Zustand');
  pruefe('5 · Titler: 3 Speaker nach dem Neustart', !!(await bis(() => titlerSt.kv().entry_count === '3', 15_000)), titlerKurz(titlerSt.kv()));
  const st5 = await bis(async () => zeilenIds(await rdStand()) === ABLAUF_2.join(','), 15_000);
  pruefe('5 · Rundown: v-1…v-4 nach dem Neustart', !!st5, await sicher(async () => zeilenIds(await rdStand())));

  console.log('\n— 6 · Gleichzeitiges RELOAD über den Steuerport → ignoriert, Logzeile');
  await starteMaster();
  await wartV4('6 · vorher');
  await bis(() => titlerSt.bereit() && rundownSt.bereit() && timerSt.bereit(), 15_000);
  const marken = { timer: logMarke('timer'), titler: logMarke('titler'), rundown: logMarke('rundown') };
  const vorher6 = { timer: timerIds(), titler: titlerSt.kv().entry_count, rundown: await sicher(async () => zeilenIds(await rdStand())) };
  timerSt.sende('TIMER RELOAD');
  titlerSt.sende('TITLER RELOAD');
  rundownSt.sende('RUNDOWN RELOAD');
  await sleep(3_000);
  const zeile6 = `Verbund: RELOAD ignoriert, die Show-Daten kommen vom Master „${MASTER_NAME}“.`;
  for (const app of TOOLS) {
    const t = logAb(app, marken[app]);
    pruefe(`6 · ${NAME[app]}: Logzeile „${zeile6}“`, t.includes(zeile6), letzteZeilen(t));
  }
  const nachher6 = { timer: timerIds(), titler: titlerSt.kv().entry_count, rundown: await sicher(async () => zeilenIds(await rdStand())) };
  pruefe('6 · Daten unverändert (Timer, Titler, Rundown)', JSON.stringify(nachher6) === JSON.stringify(vorher6), `${JSON.stringify(vorher6)} → ${JSON.stringify(nachher6)}`);

  console.log('\n— 7 · master-link.json auf Rolle „aus“ → V13 „Daten vom früheren Master …“, Daten bleiben');
  schreibeMasterLinkDatei(masterLinkPfad(APPDATA), dateiB('aus'));
  for (const app of TOOLS) {
    // Die Tools prüfen ihre master-link.json im 5-s-Takt: bis zu 10 s warten.
    const z = await bis(async () => { const a = await anzeige(app); return a && V13.test(a.text) && a.farbe === 'gelb' ? a : null; }, 10_000, 300);
    pruefe(`7 · ${NAME[app]}: V13 „Daten vom früheren Master ${MASTER_NAME} (nicht mehr gekoppelt) · letzter Stand: …“, gelb`, !!z,
      z ? z.text : await anzeigeText(app));
  }
  pruefe('7 · Daten bleiben: Timer v-1…v-4', timerIds() === ABLAUF_2.join(','), timerIds() || 'kein Timer-Zustand');
  pruefe('7 · Daten bleiben: Titler mit 3 Speakern', titlerSt.kv().entry_count === '3', titlerKurz(titlerSt.kv()));
  const zeilen7 = await sicher(async () => zeilenIds(await rdStand()));
  pruefe('7 · Daten bleiben: Rundown v-1…v-4', zeilen7 === ABLAUF_2.join(','), zeilen7);
}

let code = 1;
try {
  await main();
  const fehl = ergebnisse.filter((e) => !e.ok);
  console.log(`\n${ergebnisse.length - fehl.length}/${ergebnisse.length} Prüfungen ok.`);
  code = fehl.length === 0 ? 0 : 1;
} catch (e) {
  console.log(`ABBRUCH: ${(e as Error).message}`);
} finally {
  if (code !== 0 && masterLog.length) {
    console.log('Log des Test-Masters:');
    for (const z of masterLog) console.log(`  ${z}`);
  }
  await raeumeAuf();
}
process.exit(code);
```

Hinweise:
- Bis `legeBeiseite()` fasst `main()` nichts an; vorher prüft es nur `ELECTRON_EXE`, `APPDATA`, die Bauten und die Ports. `control.json` liest das Skript erst danach (anders als `e2e-teil2a.mjs`, das sie schon beim Laden liest).
- Beim Laden entstehen nur die Test-Identität und die Schlüssel im Speicher.
- Prüfung 6 startet vorher den Master wieder: Das RELOAD trifft die Tools im gewöhnlichen Verbundmodus (V4). Den Fall „Master weg, Verbundmodus aus dem Zwischenspeicher“ deckt C12 mit `imVerbundmodus()` ab.
- Der Timer-Ablauf kommt über den Timer-Socket (wie in 2a): Der STATE des Timers nennt nur den aktiven Punkt, und `tt:setAll` setzt keinen.

- [ ] **Step 2: Typprüfung des Skripts**

```bash
node node_modules/typescript/bin/tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022,DOM --types node --skipLibCheck --esModuleInterop --allowSyntheticDefaultImports --isolatedModules --resolveJsonModule apps/launcher/test/e2e-teil2b-verbund.ts; echo "Exit: $?"
```
Erwartet: keine Meldung, `Exit: 0`.

- [ ] **Step 3: Laden prüfen, ohne Start**

Ohne `ELECTRON_EXE` und mit umgeleitetem `APPDATA` bricht das Skript vor jedem Zugriff ab. Das zeigt, dass alle Importe auflösen:
```bash
mkdir -p "$TEMP/jm-e2e-2b-leer"
env -u ELECTRON_EXE APPDATA="$TEMP/jm-e2e-2b-leer" node node_modules/tsx/dist/cli.mjs apps/launcher/test/e2e-teil2b-verbund.ts; echo "Exit: $?"
ls -A "$TEMP/jm-e2e-2b-leer" | wc -l
rmdir "$TEMP/jm-e2e-2b-leer"
```
Erwartet:
```
ABBRUCH: ELECTRON_EXE ist nicht gesetzt — Pfad zu einer electron.exe (Electron 33) angeben.
Exit: 2
0
```
(beim Zusammenführen gemessen, 1–9 s für tsx und das Testzertifikat). Ein zweiter Ladeversuch mit gesetztem `ELECTRON_EXE` unterbleibt: Sind die Tools aus C16/C18 schon gebaut, liefe das Skript bis `legeBeiseite()`.

- [ ] **Step 4: Prüfungen zählen**

Befehl: `grep -c "pruefe(" apps/launcher/test/e2e-teil2b-verbund.ts`
Erwartet: `33` (Definition und 32 Aufrufstellen). Ein Lauf führt 50 Prüfungen aus: Prüfung 1 sieben, 2 zwei, 3 acht, 4 elf, 5 neun, 6 sieben, 7 sechs (die Zeilen je Tool laufen dreimal).

- [ ] **Step 5: Typecheck**

Befehl: `npm run typecheck -w @jm/launcher; echo "Exit: $?"`
Erwartet: keine Meldung, `Exit: 0` (die Testdatei liegt außerhalb der tsconfig; der Lauf ist die Pflichtprüfung aus G11).

- [ ] **Step 6: Commit des Skripts**

```bash
git status --short
```
Erwartet genau `?? apps/launcher/test/e2e-teil2b-verbund.ts`. Sonst nicht committen, sondern melden.
```bash
git add apps/launcher/test/e2e-teil2b-verbund.ts
git status --short
```
Erwartet genau `A  apps/launcher/test/e2e-teil2b-verbund.ts`. Dann:
```bash
git commit -m "test(launcher): Durchgang Show-Daten ueber den Verbund mit gebauten Tools (Teil 2b R2, 19.7)" -m "Test-Master (MasterLinkServer mit Test-Identitaet auf 8738 und Verteiler) und gebaute Timer, Titler, Rundown ohne Deep-Link. Pruefungen 19.7 Nr. 1 bis 7: V-Zeile per DevTools aus dem Preload, STATE, Timer-Socket, Rundown-Hinweise, Titler-Bild mit Gegenprobe nicht leer. Eigene Helfer: bis faengt Ausnahmen, DevTools wertet error aus, jede Pruefzeile mit Detail. Daten unter APPDATA werden beiseitegelegt und wiederhergestellt." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Steht im Ledger keine Zeile „Owner-Freigabe C20“, endet C20 hier. Der Bericht nennt Steps 1–6 und die Bitte um Freigabe mit diesem Text: „C20 bereit für den Durchgang: legt unter %APPDATA% beiseite und stellt wieder her (JM Production Suite\master-link.json; @jm\timer: state.json, verbund; @jm\titler: titler-config.json, iveo-data, show-zuletzt.json, verbund; @jm\rundown: regie, rundown.autosave.jmrundown, rundown.autosave.v1.jmrundown, verbund); braucht die Ports 8738, 8736, 7777, 8724, 8726, 8731, 9334, 9335, 9336 frei; startet Timer, Titler und Rundown aus apps/<tool> mit der electron.exe des Haupt-Checkouts (33.4.11), keinen Launcher; der Test-Master lauscht nur auf 127.0.0.1, die Tools suchen wie immer per mDNS im LAN.“

- [ ] **Step 7: Tools bauen, Electron-Programmdatei wählen (erst mit „Owner-Freigabe C20“)**

```bash
npm run build -w @jm/timer -w @jm/titler -w @jm/rundown
ls apps/timer/out/main/index.cjs apps/titler/out/main/index.cjs apps/rundown/out/main/index.cjs
```
Erwartet: drei Bauten ohne Fehler (`✓ built in …`; die bekannte Chunk-Größen-Warnung des Rundowns ist Rauschen), danach die drei Pfade.

Dem Worktree fehlt `electron.exe` (gemessen am 08.10.2026: `node_modules/electron/dist/electron.exe` fehlt, `npm ci` lief ohne Postinstall). Erst prüfen, dann den Haupt-Checkout nur bei gleicher Version nehmen:
```bash
ls node_modules/electron/dist/electron.exe 2>/dev/null || node -p "require('./node_modules/electron/package.json').version + ' / ' + require('C:/Users/alexk/alexzvn/node_modules/electron/package.json').version"
ls "C:/Users/alexk/alexzvn/node_modules/electron/dist/electron.exe"
```
Erwartet: entweder der Pfad im Worktree, oder `33.4.11 / 33.4.11` (gemessen am 08.10.2026) und der Pfad im Haupt-Checkout. Weichen die Versionen ab und fehlt die Datei im Worktree, lädt `node node_modules/electron/install.js` Electron 33.4.11 aus dem Netz nach; scheitert auch das, hier anhalten und melden.

- [ ] **Step 8: Durchgang (grün)**

Vorher installierte Suite-Programme beenden (das Skript prüft die Ports und bricht sonst mit `ABBRUCH: Port … belegt` ab).
```bash
ELEKTRON="$(pwd -W)/node_modules/electron/dist/electron.exe"
[ -f "$ELEKTRON" ] || ELEKTRON="C:/Users/alexk/alexzvn/node_modules/electron/dist/electron.exe"   # gleiche Version, Step 7
echo "Electron: $ELEKTRON"
ELECTRON_EXE="$ELEKTRON" node node_modules/tsx/dist/cli.mjs apps/launcher/test/e2e-teil2b-verbund.ts 2>&1 | tee "$TEMP/e2e-2b-r2.log"; echo "Exit: ${PIPESTATUS[0]}"
```
Erwartet: `Electron: …/electron.exe`, die Abschnitte `— 1 · …` bis `— 7 · …`, jede Prüfzeile beginnt mit `ok  ` und trägt nach `—` ihr Detail, darunter
```
ok   1 · Timer: V4 „Show vom Master: E2E Verbund · Stand hh:mm“, grün — Show vom Master: E2E Verbund · Stand ⟨hh:mm⟩
ok   2 · Timer übernimmt den neuen Punkt v-4 in höchstens 2 s — ⟨n⟩ ms
ok   3 · Gegenprobe: Bild A ist nicht das leere Bild — A ⟨12 Hex⟩ · leer ⟨12 Hex⟩
ok   3 · entry bleibt Alan, auf Sendung gehalten (entry_index 0) — entry „Alan“ Eintrag 0/3, on_air=1
ok   3 · Bild gleich A — ⟨12 Hex⟩ gegen A ⟨12 Hex⟩
ok   4 · Rundown: keine neuen Hinweise (gleiche Show, kein Kontextwechsel) — keine
ok   6 · Rundown: Logzeile „Verbund: RELOAD ignoriert, die Show-Daten kommen vom Master „E2E-Master“.“ — …
ok   7 · Titler: V13 „Daten vom früheren Master E2E-Master (nicht mehr gekoppelt) · letzter Stand: …“, gelb — Daten vom früheren Master E2E-Master (nicht mehr gekoppelt) · letzter Stand: E2E Verbund ⟨hh:mm⟩
```
am Ende `50/50 Prüfungen ok.`, `aufgeräumt: Prozesse beendet, Test-Master gestoppt, Dev-Daten wiederhergestellt.` und `Exit: 0`. Der Lauf selbst ist beim Zusammenführen nicht gemacht worden (G8, keine Freigabe); die Zahl 50 ist aus dem Code gezählt (Step 4).

Endet der Lauf mit `ABBRUCH: …` statt mit der Zählzeile, ist er nicht durchgelaufen: Meldung und das Log des Test-Masters in den Bericht, Ursache mit `superpowers:systematic-debugging` suchen. Bricht er mit `ABBRUCH vor dem Start: … .e2e-vorher liegt noch da` ab, nichts unter `%APPDATA%` anfassen, sondern der steuernden Sitzung melden.

- [ ] **Step 9: Bei `FEHL`**

Ursache mit `superpowers:systematic-debugging` suchen und in der Aufgabe beheben, der der Code gehört (C14 Timer, C16 Titler, C18 Rundown, C13 app-runtime, C8/C9 Master), mit Test dort; neu bauen (Step 7) und Step 8 wiederholen. Eine Prüfung im Skript wird nur geändert, wenn sie nachweislich etwas anderes prüft als 19.7; das kommt begründet in den Bericht und als eigener Commit nur mit diesem Pfad (`test(launcher): Durchgang … berichtigt`). Ist nur ein Bildvergleich rot und ändert sich der Hash bei gleichem Inhalt, ist das ein Befund für den Bericht; die Prüfung wird nicht aufgeweicht.

- [ ] **Step 10: Bericht**

In den Aufgabenbericht, wörtlich und ungekürzt aus `$TEMP/e2e-2b-r2.log` (R1-Lehre: kein „Auszug“, keine „…“): alle Zeilen ab `— 1 ·`, die Zählzeile, die Zeile `aufgeräumt: …` und der Exit-Code; dazu die Electron-Version aus Step 7. Daraus entsteht der Absatz für den PR-Text. Keine Datei im Repo dafür anlegen.

- [ ] **Step 11: Aufräumen prüfen**

```bash
git status --short
rm "$TEMP/e2e-2b-r2.log"
```
Erwartet: `git status --short` leer (die Bauten unter `out/` sind ignoriert). Das Log erst löschen, wenn seine Zeilen im Bericht stehen (Step 10).

**Abweichungen vom Gerüst:**
1. Port 8736 (Launcher) steht zusätzlich in der Vorabprüfung: Ein laufender Launcher läse die geschriebene `master-link.json` mit und meldete sich als Slave-Launcher am Test-Master an.
2. Der Timer-Ablauf kommt über den Timer-Socket 7777 statt über den STATE des Steuerports (Grund in den Hinweisen zu Step 1). 19.7 sagt „STATE von Timer“; der Socket ist der Zustand des Timers, nur über einen anderen Kanal, wie in 2a.
3. Zusätzliche Prüfzeilen über 19.7 hinaus, damit ein roter Lauf zeigt, woran es lag: in 1 der Master mit drei Abos; in 3 „vorher“, die Gegenprobe „nicht leer“, zwei Kontrollen (RECALL Grace ≠ A, RECALL Alan = A), „Liste ohne Alan angekommen“ und die Logzeile A2; in 4 die neue Epoche; in 5 „Zwischenspeicher liegt da“ je Tool; in 6 „vorher V4“.
4. Prüfung 5 startet alle drei Tools neu, nicht eines: Jedes Tool hat seinen eigenen Zwischenspeicher.
5. Die Beiseitelegen-Liste nennt die Ordner `verbund` statt nur `verbund\master-stand.json`: So verschwinden auch Zwischendateien eines abgebrochenen Schreibvorgangs.
6. Beim Zusammenführen mit dem ganzen Plan gemessen: tsc ohne Meldung; Laden ohne `ELECTRON_EXE` (mit umgeleitetem `APPDATA`) → `ABBRUCH: ELECTRON_EXE ist nicht gesetzt …`, `Exit: 2`, der umgeleitete Ordner bleibt leer; `grep -c "pruefe("` = `33`. Der Schreiber hat zusätzlich mit einer vorhandenen Programmdatei und ohne Bauten `ABBRUCH: apps/timer ist nicht gebaut …`, `Exit: 2` gemessen. Der Durchgang selbst ist beim Planen nicht gelaufen (G8; die Freigabe vom 08.10.2026 gilt für die Umsetzung). In der zweiten Runde (N15–N21) ist das Skript unverändert: angelegt, `tsc` ohne Meldung, `33` × `pruefe(`; das Laden ohne `ELECTRON_EXE` ist dabei nicht wiederholt worden.

---

### Task 21: C21 · Abnahme-Datei, Doku, Versionen, Changelog (Commit erst nach Freigabe der Notes)

**Spec:** 20 (Abnahme, Tabelle wortgleich), 21 (Versionen, Release-Notes, Doku), 24 (FA4), 25 (Nr. 1 und Nr. 4); G9, G10. Gerüst, Abschnitt 8: FA15 und FA17 als Hinweis in der Abnahme; FA15, FA17, FA20 in den „Grenzen“ der Doku.

Worum es geht:
- 20: „`packages/master-link/ABNAHME-2b.md`, je Schritt mit Ergebnisspalte. Rechner A = Master, Rechner B gekoppelt wie in Teil 1.“
- 21: „Launcher **0.15.0**, Timer **0.14.0**, Titler **0.11.0**, Rundown **0.8.0**.“ – „Release-Notes nennen: Tools auf einem zweiten Rechner brauchen das Update, sonst bekommen sie keine Show-Daten und kein RELOAD mehr vom Master. Tools auf einem Rechner **ohne** Kopplung bekommen ebenfalls kein RELOAD mehr vom Master; wer dort Daten braucht, koppelt den Rechner. Nach dem Entkoppeln bleiben die Daten vom Master mit Hinweis stehen, bis eine eigene Show geöffnet wird.“
- 21: „**Doku:** `docs/suite-verbund.md` bekommt den Abschnitt „Show-Daten im Verbund“: was reist, was lokal bleibt, die Anzeige. `docs/jm-show.md:226-229` verweist darauf statt auf „folgt mit Teil 2b“.“ (heute Zeilen 268–269)
- 25 Nr. 4: „Ein Timer auf B wird zurückgesetzt, wenn der Master eine andere Show öffnet. | gewollt … Steht in den Release-Notes.“

**Arbeitsverzeichnis:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b-r2`, Branch `feat/master-link-teil2b-r2`, Bash. Voraussetzung: C1–C20 sind committet. Vom Durchgang C20 liegt entweder der Bericht mit `50/50 Prüfungen ok.` vor oder der Vermerk „Lauf ausstehend, keine Owner-Freigabe“; im zweiten Fall nennt der Bericht von C21 den Durchgang als offen.

**Freigabe:** Die Notes in Step 7 sind ein Entwurf. Committet wird erst, wenn im Ledger die Zeile **„Owner-Freigabe Notes R2“** steht (Step 10). Bis dahin endet C21 mit dem Entwurf im Bericht; die Dateien bleiben geändert und ungestaged im Worktree.

**Dateien:**
- Create: `packages/master-link/ABNAHME-2b.md`
- Modify: `docs/suite-verbund.md:5` (Stand-Satz) und vor `## Rechner geklont oder Ordner kopiert` (`:87`, neuer Abschnitt)
- Modify: `docs/jm-show.md:268-269` (Absatz „Grenzen“)
- Modify: `apps/launcher/package.json:3`, `apps/timer/package.json:3`, `apps/titler/package.json:3`, `apps/rundown/package.json:3`
- Modify: `package-lock.json` (Blöcke `apps/launcher` `:293-295`, `apps/rundown` `:546-548`, `apps/timer` `:704-706`, `apps/titler` `:736-738`; Zeilen gelten vor C11, maßgeblich ist der Vorher-Text)
- Modify: `packages/suite-manifest/changelog.json` (je ein neuer erster Eintrag unter `launcher` `:31-35`, `timer` `:645-649`, `titler` `:1079-1083`, `rundown` `:1379-1383`; Zeilen auf `adda584693` vor C21, N30)
- Nicht anfassen: `packages/suite-manifest/suite.json` (zieht der Bot nach), `.github/workflows/ci-checks.yml` (C11).

**Interfaces:**
- Consumes: grüner Stand C1–C20; Zählstände aus den Berichten; die Texte E13 aus dem Abschnitt „Entscheidungen“.
- Produces: Versionen Launcher 0.15.0, Timer 0.14.0, Titler 0.11.0, Rundown 0.8.0 in `package.json` und `package-lock.json`; vier Changelog-Einträge; die Abnahme-Datei; der Doku-Abschnitt „Show-Daten im Verbund“.

Regeln für diese Aufgabe:
- G9: keine ASCII-Anführungszeichen in den Notes; deutsche „…“ sind erlaubt. JSON vor dem Commit prüfen (Step 8).
- G12: alle geänderten Dateien liegen mit CRLF vor; Änderungen mit dem Edit-Werkzeug, die neue Abnahme-Datei mit dem Write-Werkzeug. Step 8 zählt CRLF und LF.
- M1 gilt weiter als „nein“: Weder Notes noch Doku noch Abnahme sagen iveo-Kennungen in der Show zu.
- Das Datum der Changelog-Einträge ist der Tag der Vorbereitung: `node -e "console.log(new Date().toISOString().slice(0,10))"`. Unten steht `2026-10-08`; ist heute ein anderer Tag, in allen vier Einträgen diesen Tag eintragen.

- [ ] **Step 1: Vorbedingung — die Berichte von C1–C20 nennen grüne Läufe**

Aus den Berichten übernehmen (nicht neu laufen lassen, das macht Step 9): die Zählzeilen von C4 (`@jm/master-link`), C5 (`@jm/iveo`), C10 (`selftest`, `selftest:iveo` des Launchers), C13 (`@jm/app-runtime`), C14 (Timer), C16 (Titler), C18 (Rundown), C19 (`selftest:verbund` mit `63 ok, 0 fehlgeschlagen.`) und von C20 die Zählzeile `50/50 Prüfungen ok.` oder den Vermerk „Lauf ausstehend“. Fehlt ein grüner Lauf, hier nicht weitermachen, sondern melden.

- [ ] **Step 2: `packages/master-link/ABNAHME-2b.md` anlegen (ganzer Inhalt, Tabelle wortgleich mit Spec 20)**

```markdown
# Abnahme Master-Link Teil 2b, Release 2 (Owner, zwei Rechner)

Spec: `docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md`, Abschnitt 20.
Rechner A = Master, Rechner B gekoppelt wie in Teil 1 (`packages/master-link/ABNAHME.md`).

**Voraussetzungen:**
- A und B sind gekoppelt (Teil 1), an A läuft der Launcher als Master.
- An A ist eine iveo-Show mit Speakern und mehreren Side Events zur Hand. In iveo wird nur in Schritt 4 geschrieben, am unveröffentlichten Test-Side-Event wie in der 2a-Abnahme.
- Die Abnahmen 2a (`apps/rundown/ABNAHME-2a.md`) und 2b Release 1 (`apps/titler/ABNAHME-2b-R1.md`) tragen im Repo noch kein Ergebnis (Spec 25 Nr. 1). Sie können im selben Termin davor laufen.

| # | Schritt | Erwartung | Ergebnis / Datum |
| --- | --- | --- | --- |
| 1 | Launcher 0.15.0, Timer 0.14.0, Titler 0.11.0, Rundown 0.8.0 auf A und B. Im Rundown auf B die Endpunkte für Titler und Timer von Hand auf `127.0.0.1` setzen (17.4, FA4). | Versionen sichtbar | |
| 2 | An A eine iveo-Show öffnen. Auf B Timer, Titler und Rundown über die Kachel starten, **ohne** Show auf B. | Alle drei zeigen „Show vom Master: ⟨S⟩ · Stand ⟨hh:mm⟩“ und die Daten der Show. Das Verbund-Modal an A zeigt „… · 3 Tools beziehen sie“ und bei den drei Tools von B „bezieht Show-Daten“. | |
| 3 | An A im Panel ein Side Event umschalten | Auf B wechseln Timer, Titler und Rundown in höchstens 3 s. Der Rundown meldet den Kontextwechsel. | |
| 4 | In iveo am Test-Side-Event einen Agenda-Punkt einfügen (wie 2a-Abnahme) | Auf B nach der Abfrage am Master (höchstens 45 s) plus höchstens 3 s | |
| 5 | Auf B eine Bauchbinde auf Sendung, an A auf ein Side Event umschalten, das die Person nicht verknüpft | Die Person bleibt auf Sendung, mit Hinweis | |
| 6 | Auf B den Launcher starten. Im Rundown auf B ein GO mit „Launcher · Side Event“ | Die Umschaltung passiert an A (Log an A), nicht am Launcher von B | |
| 7 | Netzkabel an B 60 s ziehen, dann wieder stecken | Bis zu 25 s bleibt die Anzeige grün (Stille-Frist aus Teil 1, 16.4). Danach kurz gelb „⟨M⟩ nicht verbunden · letzter Stand …“, dann rot mit dem Text aus Teil 1 (etwa „Netz zum Master nicht erreichbar …“ oder „⟨M⟩ nicht erreichbar: ausgeschaltet …“) und „· letzter Stand …“. Die Daten bleiben. Nach dem Stecken innerhalb von etwa 15 s wieder grün, ohne Hinweis im Rundown. | |
| 8 | Launcher an A beenden; dann ohne Show starten; dann die Show öffnen | erst kurz gelb „nicht verbunden · letzter Stand“, dann rot mit dem Text aus Teil 1 (wie in Teil-1-Abnahme 8a, etwa „⟨M⟩ nicht erreichbar: ausgeschaltet, Launcher oder Master-Modus aus …“) · letzter Stand; dann gelb „hat keine Show offen · letzter Stand“; dann grün | |
| 9 | An A eine andere Show öffnen | Auf B: Timer neu wie beim Öffnen einer Show, Rundown mit der neuen Show, Titler mit der neuen Liste | |
| 10 | Auf B den Titler schließen, Launcher an A beenden, Titler auf B starten | Daten aus dem letzten Stand; kurz gelb „nicht verbunden · letzter Stand …“, dann rot mit dem Text aus Teil 1 · letzter Stand … | |
| 10b | Auf B im Launcher die Kopplung lösen | Timer, Titler und Rundown auf B zeigen „Daten vom früheren Master ⟨M⟩ (nicht mehr gekoppelt) · letzter Stand …“, die Daten bleiben. Danach auf B eine eigene Show öffnen: Die Anzeige verschwindet. Danach B wieder koppeln. | |
| 11 | Show an A mit Timer-Einstellungen und einem Recorder-Ordner öffnen | Timer auf B nutzt die Timer-Liste. Log an A: „Lokal geblieben: jm-recorder.dir …“ | |
| 12 | Auf B einen Timer 0.13.0 laufen lassen (falls zur Hand) | läuft wie bisher, ohne Daten und ohne Absturz | |
| 13 | An A die Rolle „aus“, ein Rechner allein | Show-Start, RELOAD und Anzeigen wie vor 2b | |

**Hinweis zu Schritt 5 (M1 = nein, Spec 23 „Ergebnisse“):** Die iveo-Kennung der Speaker wird weiter nicht in die Show übernommen. Der Titler auf B hält die Person über Datei und Namen (Ersatz-Schlüssel), wie seit Release 1. Schritt 5 bewertet nur: dieselbe Person bleibt auf Sendung, mit Hinweis. Eine Logzeile zu Kennungen wird nicht erwartet.

**Hinweis zu Schritt 2 (Rechnernamen, Folgeaufgabe FA15):** Wird Rechner B umbenannt, zeigt das Verbund-Modal an A den neuen Namen erst nach der nächsten Anmeldung von B. Namen im Modal deshalb erst nach einem Neuverbinden vergleichen; ein alter Name davor ist kein Befund.

**Hinweis zum Merker „Speaker veraltet“ (Folgeaufgabe FA17):** Der Merker reist mit der Show (Spec 14.1). Speichert jemand an A im Show-Editor eine Show, die mit gesetztem Merker geöffnet war, nachdem die Speakerliste wiederkam, zeigen das Side-Events-Panel an A und der Titler auf B bis zur nächsten Abfrage (höchstens 45 s) „… aus früherem Stand“. Das ist der bekannte Rest aus Release 1, kein Befund dieser Abnahme.

**Hinweis zu Schritt 1 (Endpunkte von Hand, Folgeaufgabe FA4):** Titler und Timer wählt der Rundown weiter nach „zuletzt gefunden“ (Owner-Antwort O2). Laufen sie an A und B, könnte ein GO auf B das Tool an A treffen. Deshalb setzt Schritt 1 die Endpunkte im Rundown auf B von Hand auf `127.0.0.1`. Nur „Launcher · Side Event“ wählt der Rundown selbst über die Kopplung (Schritt 6).

## Zusatzprüfungen (nicht in Spec 20)

Diese Punkte stehen nicht in der Tabelle der Spec. Sie prüfen die Verdrahtung im Main von Timer, Titler und Rundown, die weder ein Selbsttest noch der Durchgang C20 erreicht: C20 startet die Tools ohne Show-Link (Spec 19.7), fasst Ordnerwahl, „Öffnen…“ und „Neu“ nicht an, und seine Test-Show trägt keine Rundown-Datei. Die Regeln dahinter sind reine Funktionen mit Tests (`showLinkWeg`, `ordnerWahlGesperrt`, `ordnerPatchAbgelehnt`, `dokumentHinweis`); hier geht es darum, dass der Main sie an der richtigen Stelle und in der richtigen Reihenfolge ruft. Von Hand nicht erreichbar ist die Ablehnung im Main des Titlers selbst (Ordnerdialog, Einstellung, Knopf „Zurück zum eigenen Ordner …“), solange die Oberfläche die Wahl schon sperrt: Sie ist als reine Regel getestet und im Main nur über Typecheck und Build abgesichert. Ergebnis und Datum hinter jedem Punkt eintragen.

1. **Show-Link im Verbund (E24):** Auf B folgen Timer, Titler und Rundown der Show vom Master, im Rundown ist eine Zeile scharf. Auf B eine eigene Show öffnen (im Launcher oder per Doppelklick auf eine `.jmshow`), so dass ein Show-Link an die Tools geht. Erwartung: Der Rundown bleibt auf derselben Zeile, keine GO-Folge bricht ab, kein neuer Hinweis; sein Log nennt „Verbund: Show-Link „⟨Name⟩“ – der Rundown folgt der Show vom Master und lädt daraus nichts.“ (⟨Name⟩ ist der Dateiname der Show.) Timer und Titler behalten die Daten vom Master, der Titler öffnet nur die Vorlage. Ergebnis / Datum:
2. **Start mit Show-Link im Verbund (E55):** Titler und Rundown auf B haben schon einen Stand vom Master bekommen (etwa nach Punkt 1). Beide schließen und mit einer eigenen Show wieder starten (Show-Link beim Start, etwa über den Launcher auf B). Erwartung: Beide zeigen nach dem Start „Show vom Master: ⟨S⟩ · Stand ⟨hh:mm⟩“ mit den Daten des Masters; der Titler übernimmt aus dem Link nur die Vorlage, der Rundown lädt nichts (Logzeile wie in 1). Ergebnis / Datum:
3. **Ordnerwahl im Titler gesperrt (O1, E22):** Trägt die Show an A Speaker, sind auf B im Titler unter Einstellungen › DataLink die Eingabe, „Durchsuchen…“ und „✕“ gesperrt, darunter steht „Im Verbund kommen die Speaker vom Master „⟨M⟩“. Ein eigener Ordner gilt, solange die Show dort keine Speaker hat.“ An A danach eine Show ohne Speaker öffnen: Auf B ist die Wahl wieder frei. Ergebnis / Datum:
4. **Rundown-Datei am Master, „Öffnen…“ und „Neu“ im Verbund (17.3):** An A eine Show öffnen, die für den Rundown eine eigene Rundown-Datei (`.jmrundown`) einträgt; der Rundown auf B folgt ihr. Erwartung: Er zeigt stehend „Die Rundown-Datei dieser Show liegt am Master und wird hier nicht geladen. Ihre Aktionen fehlen auf diesem Rechner.“, sein Log dieselbe Zeile, beides einmal je Show. Danach auf B im Rundown mit „Öffnen…“ eine Kopie dieser Rundown-Datei laden: Der Ablauf bleibt der vom Master, die Aktionen aus der Datei stehen an ihren Zeilen, die Anzeige bleibt „Show vom Master: ⟨S⟩ · Stand ⟨hh:mm⟩“; „Speichern“ schreibt in die geöffnete Datei. Dann „Neu“: der Ablauf vom Master ohne Aktionen, die Anzeige bleibt. Ergebnis / Datum:
5. **Eigene Wahl nach dem Entkoppeln (E56):** B entkoppeln wie in Schritt 10b, aber noch keine eigene Show öffnen; Titler und Rundown zeigen „Daten vom früheren Master ⟨M⟩ (nicht mehr gekoppelt) …“. Im Titler unter Einstellungen › DataLink einen eigenen Ordner wählen, im Rundown „Neu“. Erwartung: In beiden verschwindet die Anzeige. Nach einem Neustart beider Tools erscheint sie nicht wieder; der Titler nimmt den gewählten Ordner, der Rundown zeigt nicht wieder die Show des früheren Masters. Danach B wieder koppeln. Ergebnis / Datum:
```

Prüfen, dass die Tabelle ohne die Ergebnisspalte Zeile für Zeile der Spec gleicht:
```bash
node -e "
const fs=require('fs');
const spec=fs.readFileSync('docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md','utf8').replace(/\r/g,'').split('\n');
const ab=spec.findIndex(z=>z.startsWith('## 20 '));
const soll=[];for(let i=ab;i<spec.length&&!spec[i].startsWith('## 21 ');i++)if(spec[i].startsWith('| '))soll.push(spec[i]);
const ist=fs.readFileSync('packages/master-link/ABNAHME-2b.md','utf8').replace(/\r/g,'').split('\n').filter(z=>z.startsWith('| '));
const ohne=ist.map((z,i)=>i===0?z.replace(' Ergebnis / Datum |',''):i===1?z.replace(/ --- \|$/,''):z.replace(/ \|$/,''));
const fehler=soll.map((z,i)=>z===ohne[i]?null:i).filter(x=>x!==null);
if(soll.length!==16||ist.length!==soll.length||fehler.length)throw new Error('nicht wortgleich: '+JSON.stringify({soll:soll.length,ist:ist.length,fehler}));
console.log('Abnahme-Tabelle wortgleich mit Spec 20: '+(soll.length-2)+' Schritte');"
```
Erwartet: `Abnahme-Tabelle wortgleich mit Spec 20: 14 Schritte` (gemessen; Gegenprobe in der Kopie: „Versionen sichtbar“ → „Version sichtbar“ ergibt `nicht wortgleich: {"soll":16,"ist":16,"fehler":[2]}`).

- [ ] **Step 3: Doku `docs/suite-verbund.md`**

Ersetzung 1, Vorher (eindeutig, Zeile 5):
```markdown
Stand Teil 1: Der Master sieht je Rechner, welche Tools laufen. Show-Daten über das Netz, Fernstart und die Show-Zentrale folgen in den nächsten Teilen.
```
Nachher:
```markdown
Stand Teil 2b: Der Master sieht je Rechner, welche Tools laufen, und verteilt seine offene Show an Timer, Titler und Rundown der gekoppelten Rechner (siehe „Show-Daten im Verbund“). Fernstart und die Show-Zentrale folgen in den nächsten Teilen.
```
Ersetzung 2, Vorher (eindeutig, Zeile 87):
```markdown
## Rechner geklont oder Ordner kopiert
```
Nachher:
```markdown
## Show-Daten im Verbund

Ab Launcher 0.15.0 verteilt der Master die Show, die an ihm offen ist. Timer ab 0.14.0, Titler ab 0.11.0 und Rundown ab 0.8.0 auf einem gekoppelten Rechner holen sie über ihre eigene Verbindung zum Master, auch ohne Launcher auf diesem Rechner, und arbeiten damit wie mit einer geöffneten Show-Datei. Ändert sich die Show am Master, kommt der neue Stand nach wenigen Sekunden an.

**Was reist:** Name der Show, Ablauf mit Kennungen, Speaker, Side Events, der Filter der iveo-Bindung, der Merker „Speaker veraltet“ und diese Einstellungen der Tools:

| Tool | reist | bleibt am Master |
| --- | --- | --- |
| Timer | Timer-Liste, Dauer | – |
| Q&A | Redezeit, Moderation, automatische Kopplung an Timer und Titler | – |
| Battle | Runden, Namen und Crews | – |
| Caption | Modell, Sprache, NDI-Name | – |
| Transcribe | Modell, Sprache, Aufgabe, Formate | Ausgabeordner |
| Recorder | Dateiname, getrennte Spuren | Ordner, Kanäle, Abtastrate |
| Player | – | Bibliothek, Bildschirm |
| Presenter | – | PIN |
| Connect | Raum | – |
| alle anderen | – | alles |

Anwenden tun die Daten bisher nur Timer, Titler und Rundown.

**Was am Master bleibt:** Dokumente der Tools (etwa die eigene Rundown-Datei einer Show; der Rundown auf dem anderen Rechner sagt das mit einem Hinweis), Netzwerk-Angaben der Tools, die iveo-Adresse und jedes Token. Das Log des Masters nennt bei jedem neuen Stand, was lokal geblieben ist.

**Am Master** zeigt das Modal unter „Gekoppelte Rechner“ eine Zeile „Show im Verbund: „⟨Show⟩“ · Stand ⟨hh:mm⟩ · ⟨n⟩ Tools beziehen sie“ (bei einem Tool „· 1 Tool bezieht sie“), ohne offene Show „Show im Verbund: keine Show offen“, in Rot „… nicht verteilt: zu groß für den Verbund (⟨n⟩ KiB)“ oder „… nicht verteilt: nicht lesbar“. Bei Timer, Titler und Rundown der anderen Rechner steht „bezieht Show-Daten“. Steht dort nach 10 s „ohne Show-Daten (Update nötig)“, läuft auf diesem Rechner ein älteres Tool.

**In den Tools** (Timer: neben „Sync“, Titler: vor „Suite · ⟨n⟩ verbunden“, Rundown: im Statusstreifen):

| Anzeige | Bedeutung | Was tun |
| --- | --- | --- |
| Show vom Master: ⟨Show⟩ · Stand ⟨hh:mm⟩ | Daten vom Master, aktuell (grün). Die Uhrzeit ist die Empfangszeit auf diesem Rechner. | — |
| Verbunden mit ⟨Master⟩ · Show wird geladen… | die Anfrage nach Show-Daten läuft | kurz warten |
| ⟨Master⟩ antwortet nicht auf die Anfrage nach Show-Daten (Launcher-Update am Master nötig?) | der Master antwortet 5 s lang nicht; das Tool fragt alle 30 s erneut und arbeitet bis dahin wie ohne Verbund | Launcher am Master auf 0.15.0 bringen |
| ⟨Master⟩ hat keine Show offen | am Master ist keine Show offen | am Master eine Show öffnen |
| Show am Master zu groß für den Verbund | die Show überschreitet 900 KiB | Show verkleinern; das Log des Masters nennt die Größe |
| Show am Master nicht lesbar | die Show-Datei am Master ist gerade nicht lesbar | Show am Master prüfen |
| ⟨Master⟩ nicht verbunden | die Verbindung ist weg, das Tool sucht den Master | kurz warten |
| Suche ⟨Master⟩… | noch keine Verbindung, das Tool sucht | kurz warten |
| roter Fehlertext, etwa „⟨Master⟩ nicht erreichbar: ausgeschaltet, Launcher oder Master-Modus aus …“ | der Master ist nicht erreichbar oder lehnt ab | wie unter „Was die Kopfanzeige sagt“ |
| Show vom Master nicht übernommen: ⟨Fehler⟩ | das Tool konnte den Stand nicht anwenden (etwa EBUSY); es versucht es fünfmal im Abstand von 1 s, danach mit dem nächsten Stand | bleibt es: Logs des Tools ansehen |
| Show-Daten von ⟨Master⟩ nicht lesbar (Tool-Update nötig?) | der Master schickt Daten, die dieses Tool nicht versteht | Tool aktualisieren |
| Daten vom früheren Master ⟨Master⟩ (nicht mehr gekoppelt) | der Rechner ist entkoppelt oder seine Rolle hat sich geändert | eigene Show öffnen oder neu koppeln |
| Kopplungsdatei beschädigt. Neu koppeln. | `master-link.json` ist beschädigt | neu koppeln |

Steht „· letzter Stand: ⟨Show⟩ ⟨hh:mm⟩“ dahinter, arbeitet das Tool mit diesem Stand weiter, auch nach einem Neustart.

**Solange ein Tool dem Master folgt,** kommen Ablauf, Speaker und Einstellungen nur vom Master. Ein Neu-Laden ändert dann nichts, und ein Show-Link ändert die Show-Daten nicht; der Titler übernimmt daraus nur die Vorlage. Im Verbund lädt der Rundown auf einem gekoppelten Rechner aus einem Show-Link nichts; eine eigene Rundown-Datei lässt sich mit „Öffnen…“ laden. Das Log vermerkt beides: ein Neu-Laden höchstens einmal je Minute, einen Show-Link Timer und Titler höchstens einmal je Minute, der Rundown bei jedem Link. Trägt die Show am Master Speaker, ist im Titler die Wahl eines eigenen DataLink-Ordners gesperrt. Öffnet der Master eine andere Show, setzt der Timer seinen Ablauf neu wie beim Öffnen einer Show und setzt dabei den Countdown zurück.

**Neu-Laden nur an diesen Rechner:** Als Master schickt der Launcher das Neu-Laden nach einer iveo-Änderung nur noch an Timer, Titler und Rundown auf seinem eigenen Rechner. Tools auf einem Rechner ohne Kopplung im selben Netz bekommen es nicht mehr; wer dort die Show-Daten braucht, koppelt den Rechner.

**Entkoppeln:** Nach dem Trennen bleiben die Daten vom Master mit Hinweis stehen, auch über einen Neustart, bis im Tool eine eigene Show geöffnet wird. Danach wirken Show-Link und Neu-Laden wieder wie am Einzelplatz.

**Grenzen:**
- Tools auf dem Master-Rechner lesen weiter die Show-Datei und bekommen das Neu-Laden wie bisher.
- Ältere Tools (Timer bis 0.13, Titler bis 0.10, Rundown bis 0.7) auf einem gekoppelten Rechner bekommen weder Show-Daten noch Neu-Laden vom Master.
- Dokumente, Medien und Fotos reisen nicht.
- Titler und Timer wählt der Rundown weiter nach „zuletzt gefunden“. Laufen sie auf beiden Rechnern, im Rundown die Endpunkte von Hand festlegen. Nur „Launcher · Side Event“ geht über die Kopplung an den Master.
- Speaker gleichen Namens unterscheidet der Rundown-Picker weiter nicht; die iveo-Kennung wird noch nicht übernommen.
- Wird ein Rechner umbenannt, zeigt das Modal am Master den neuen Namen erst nach dessen nächster Anmeldung.
- Speichert jemand am Master im Show-Editor eine Show, die mit dem Merker „Speaker veraltet“ geöffnet war, nachdem die Speakerliste wiederkam, zeigen Panel und Titler bis zur nächsten Abfrage (höchstens 45 s) „… aus früherem Stand“.
- Bei gezogenem Kabel bleibt die Anzeige bis zu 25 s grün (Stille-Frist).

## Rechner geklont oder Ordner kopiert
```
Der neue Abschnitt steht nach „Meldungen im Modal“, weil er dieselbe Form hat (Anzeige | Bedeutung | Was tun) und vor den Sonderfällen „Rechner geklont“, „Firewall“ und „Wichtig“.

- [ ] **Step 4: Doku `docs/jm-show.md`, Absatz „Grenzen“**

Vorher (eindeutig, Zeilen 268–269):
```markdown
**Grenzen.** Das gilt am Einzelplatz: Tools auf einem anderen Rechner lesen
weiter ihre eigene Show-Datei (folgt mit Release 2 von Master-Link Teil 2b).
```
Nachher:
```markdown
**Grenzen.** Das gilt am Einzelplatz. Auf einem gekoppelten Rechner folgen
Timer, Titler und Rundown ab Timer 0.14.0, Titler 0.11.0 und Rundown 0.8.0 der
Show, die am Master offen ist (Abschnitt „Show-Daten im Verbund“ in
`docs/suite-verbund.md`); ältere Tools dort lesen weiter ihre eigene Show-Datei.
```
Danach: `grep -c "folgt mit Release 2" docs/jm-show.md` → `0`.

- [ ] **Step 5: Versionen in den vier `package.json`**

`apps/launcher/package.json`, Vorher (Zeilen 2–3):
```json
  "name": "@jm/launcher",
  "version": "0.14.0",
```
Nachher:
```json
  "name": "@jm/launcher",
  "version": "0.15.0",
```
`apps/timer/package.json`, Vorher (Zeilen 2–3):
```json
  "name": "@jm/timer",
  "version": "0.13.0",
```
Nachher:
```json
  "name": "@jm/timer",
  "version": "0.14.0",
```
`apps/titler/package.json`, Vorher (Zeilen 2–3):
```json
  "name": "@jm/titler",
  "version": "0.10.0",
```
Nachher:
```json
  "name": "@jm/titler",
  "version": "0.11.0",
```
`apps/rundown/package.json`, Vorher (Zeilen 2–3):
```json
  "name": "@jm/rundown",
  "version": "0.7.0",
```
Nachher:
```json
  "name": "@jm/rundown",
  "version": "0.8.0",
```

- [ ] **Step 6: Versionen in `package-lock.json`**

Vorher (eindeutig):
```json
    "apps/launcher": {
      "name": "@jm/launcher",
      "version": "0.14.0",
```
Nachher:
```json
    "apps/launcher": {
      "name": "@jm/launcher",
      "version": "0.15.0",
```
Vorher (eindeutig):
```json
    "apps/timer": {
      "name": "@jm/timer",
      "version": "0.13.0",
```
Nachher:
```json
    "apps/timer": {
      "name": "@jm/timer",
      "version": "0.14.0",
```
Vorher (eindeutig):
```json
    "apps/titler": {
      "name": "@jm/titler",
      "version": "0.10.0",
```
Nachher:
```json
    "apps/titler": {
      "name": "@jm/titler",
      "version": "0.11.0",
```
Vorher (eindeutig):
```json
    "apps/rundown": {
      "name": "@jm/rundown",
      "version": "0.7.0",
```
Nachher:
```json
    "apps/rundown": {
      "name": "@jm/rundown",
      "version": "0.8.0",
```
Andere Zeilen mit `0.14.0`, `0.13.0`, `0.10.0` oder `0.7.0` im Lockfile gehören fremden Paketen und bleiben. Der Block `packages/app-runtime` (C11) bleibt unberührt.

- [ ] **Step 7: Changelog `packages/suite-manifest/changelog.json` (Entwurf)**

Ersetzung 1 (`launcher`), Vorher (eindeutig, Zeilen 31–35):
```json
    "app": "launcher",
    "name": "JM Production Suite",
    "entries": [
      {
        "version": "0.14.0",
```
Nachher:
```json
    "app": "launcher",
    "name": "JM Production Suite",
    "entries": [
      {
        "version": "0.15.0",
        "date": "2026-10-08",
        "notes": [
          "Als Master verteilt der Launcher die offene Show an Timer, Titler und Rundown auf den gekoppelten Rechnern: Ablauf, Speaker, Side Events und die freigegebenen Tool-Einstellungen. Dokumente, Netzwerk-Angaben der Tools und rechnergebundene Einstellungen wie Ordner, Bildschirm oder die Presenter-PIN bleiben am Master. Auf den anderen Rechnern braucht es dafür keinen Launcher.",
          "Die Tools auf den gekoppelten Rechnern brauchen dafür das Update auf Timer 0.14.0, Titler 0.11.0 und Rundown 0.8.0. Ältere Tools dort bekommen keine Show-Daten und auch kein Neu-Laden mehr vom Master.",
          "Als Master schickt der Launcher das Neu-Laden nach einer iveo-Änderung nur noch an Timer, Titler und Rundown auf seinem eigenen Rechner. Tools auf einem Rechner ohne Kopplung im selben Netz bekommen es nicht mehr; wer dort die Show-Daten braucht, koppelt den Rechner.",
          "Das Verbund-Modal am Master zeigt, welche Show im Verbund verteilt wird und wie viele Tools sie beziehen. Bei Timer, Titler und Rundown der anderen Rechner steht „bezieht Show-Daten“, bei älteren nach 10 s „ohne Show-Daten (Update nötig)“.",
          "Die Liste der Side Events in der Show folgt jetzt iveo: Der Launcher bildet sie neu, wenn er bei einer Abfrage oder beim Umschalten auf die Tagesübersicht die Programme neu lädt. Scheitert das, bleibt die bisherige Liste, und das Side-Events-Panel meldet eine Störung."
        ]
      },
      {
        "version": "0.14.0",
```
Ersetzung 2 (`timer`), Vorher (eindeutig, Zeilen 645–649 vor Ersetzung 1):
```json
    "app": "timer",
    "name": "JM Timer",
    "entries": [
      {
        "version": "0.13.0",
```
Nachher:
```json
    "app": "timer",
    "name": "JM Timer",
    "entries": [
      {
        "version": "0.14.0",
        "date": "2026-10-08",
        "notes": [
          "Auf einem gekoppelten Rechner folgt der Timer der Show, die am Master offen ist (Master mit Launcher 0.15.0), auch ohne Launcher auf diesem Rechner. Neben „Sync“ steht dann „Show vom Master: … · Stand …“ oder der Zustand der Verbindung.",
          "Öffnet der Master eine andere Show, setzt der Timer seinen Ablauf neu wie beim Öffnen einer Show und setzt dabei den Countdown zurück. Änderungen an derselben Show übernimmt er, ohne den Countdown anzutasten; der aktive Punkt folgt seiner Kennung.",
          "Ist der Master nicht erreichbar oder hat er keine Show offen, bleibt der letzte Stand, auch über einen Neustart des Timers. Solange der Timer dem Master folgt, ändern Neu-Laden und Show-Links seinen Ablauf nicht.",
          "Nach dem Entkoppeln bleibt der Ablauf vom Master mit dem Hinweis „Daten vom früheren Master …“ stehen, bis der Timer eine eigene Show öffnet."
        ]
      },
      {
        "version": "0.13.0",
```
Ersetzung 3 (`titler`), Vorher (eindeutig, Zeilen 1079–1083 vor Ersetzung 1):
```json
    "app": "titler",
    "name": "JM Titler",
    "entries": [
      {
        "version": "0.10.0",
```
Nachher:
```json
    "app": "titler",
    "name": "JM Titler",
    "entries": [
      {
        "version": "0.11.0",
        "date": "2026-10-08",
        "notes": [
          "Auf einem gekoppelten Rechner übernimmt der Titler die Speaker der Show, die am Master offen ist (Master mit Launcher 0.15.0), auch ohne Launcher auf diesem Rechner. Daten / Recall nennt dann die Show vom Master als Quelle, und vor „Suite · … verbunden“ steht der Zustand der Verbindung.",
          "Trägt die Show am Master Speaker, ist die Wahl eines eigenen DataLink-Ordners gesperrt. Ohne Speaker in der Show ist sie frei; kommen danach Speaker, gilt wieder die Liste vom Master.",
          "Fehlt die Person auf Sendung in einer neuen Liste vom Master, bleibt die Bauchbinde stehen, mit Hinweis, wie seit 0.10.0. Gehalten wird weiter über Datei und Namen, weil die iveo-Kennung noch nicht übernommen wird.",
          "Ist der Master nicht erreichbar, bleibt die letzte Liste, auch über einen Neustart. Solange der Titler dem Master folgt, ändert ein Neu-Laden die Speaker nicht, und ein Show-Link übernimmt nur noch die Vorlage.",
          "Nach dem Entkoppeln bleibt die Liste vom Master mit Hinweis stehen, bis eine eigene Show geöffnet wird."
        ]
      },
      {
        "version": "0.10.0",
```
Ersetzung 4 (`rundown`), Vorher (eindeutig, Zeilen 1379–1383 vor Ersetzung 1):
```json
    "app": "rundown",
    "name": "JM Rundown",
    "entries": [
      {
        "version": "0.7.0",
```
Nachher:
```json
    "app": "rundown",
    "name": "JM Rundown",
    "entries": [
      {
        "version": "0.8.0",
        "date": "2026-10-08",
        "notes": [
          "Auf einem gekoppelten Rechner übernimmt der Rundown Ablauf und Speaker der Show, die am Master offen ist (Master mit Launcher 0.15.0), auch ohne Launcher auf diesem Rechner. Seine Aktionen merkt er sich je Show des Masters, auch über einen Neustart. Im Statusstreifen steht „Show vom Master: … · Stand …“ oder der Zustand der Verbindung.",
          "Die eigene Rundown-Datei einer Show lädt der Rundown auf dem anderen Rechner nicht; ein stehender Hinweis sagt das. Ihre Aktionen fehlen dort.",
          "Solange er mit dem Master verbunden ist, schickt der Rundown „Launcher · Side Event“ an den Launcher des Masters, auch wenn auf seinem Rechner ein eigener Launcher läuft.",
          "Im Verbund lädt der Rundown auf einem gekoppelten Rechner aus einem Show-Link nichts; eine eigene Rundown-Datei lässt sich mit „Öffnen…“ laden. Neu-Laden ändert dann nichts am Dokument. Nach dem Entkoppeln bleibt das Dokument, bis eine eigene Show geöffnet wird.",
          "Bekannt: Titler und Timer wählt der Rundown weiter nach dem zuletzt gefundenen. Laufen sie auf beiden Rechnern, im Rundown die Endpunkte von Hand festlegen."
        ]
      },
      {
        "version": "0.7.0",
```
Wo die Pflichtpunkte stehen:
- Spec 21, Update auf dem zweiten Rechner nötig, sonst keine Show-Daten und kein RELOAD: Launcher Punkt 2.
- Spec 21 und O3, kein RELOAD mehr für Rechner ohne Kopplung: Launcher Punkt 3.
- Spec 21, nach dem Entkoppeln bleiben die Daten mit Hinweis: Timer Punkt 4, Titler Punkt 5, Rundown Punkt 4.
- Spec 25 Nr. 4, der Timer auf B wird beim Showwechsel am Master zurückgesetzt: Timer Punkt 2.
- O1, Ordnerwahl im Titler gesperrt: Titler Punkt 2. FA4: Rundown Punkt 5. M1 = nein: Titler Punkt 3.

- [ ] **Step 8: Prüfen (JSON, Versionen, Anführungszeichen, Zeilenenden, Typecheck)**

Befehl:
```bash
node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8'))"; echo "Exit: $?"
node -e "const c=require('./packages/suite-manifest/changelog.json');const l=require('./package-lock.json').packages;const soll={launcher:['0.15.0','0.14.0'],timer:['0.14.0','0.13.0'],titler:['0.11.0','0.10.0'],rundown:['0.8.0','0.7.0']};for(const [app,[v,alt]] of Object.entries(soll)){const e=c.find(x=>x.app===app).entries;if(e[0].version!==v||e[1].version!==alt)throw new Error(app+' changelog '+e[0].version+'/'+e[1].version);if(!/^\d{4}-\d{2}-\d{2}$/.test(e[0].date))throw new Error(app+' Datum');if(e[0].notes.some(n=>n.includes('\"')))throw new Error(app+': ASCII-Anführungszeichen');if(require('./apps/'+app+'/package.json').version!==v)throw new Error(app+' package.json');if(l['apps/'+app].version!==v)throw new Error(app+' package-lock.json');}console.log('Release-Vorbereitung ok')"
node -e "for (const f of ['docs/suite-verbund.md','docs/jm-show.md','apps/launcher/package.json','apps/timer/package.json','apps/titler/package.json','apps/rundown/package.json','package-lock.json','packages/suite-manifest/changelog.json']) { const s=require('fs').readFileSync(f,'utf8'); const cr=(s.match(/\r\n/g)||[]).length, lf=(s.match(/\n/g)||[]).length; console.log((cr===lf?'ok   ':'FEHL ')+f+' '+cr+'/'+lf); }"
npm run typecheck -w @jm/launcher -w @jm/timer -w @jm/titler -w @jm/rundown; echo "Exit: $?"
```
Erwartet: `Exit: 0` nach der JSON-Prüfung; `Release-Vorbereitung ok`; acht Zeilen mit `ok`; der Typecheck ohne Meldung, `Exit: 0`. Gemessen am 12.10.2026 auf `adda584693` (nach C1–C20): `docs/suite-verbund.md 179/179`, `docs/jm-show.md 276/276`, `apps/launcher/package.json 61/61`, `apps/timer/package.json 51/51`, `apps/titler/package.json 50/50`, `apps/rundown/package.json 50/50`, `package-lock.json 17660/17660`, `packages/suite-manifest/changelog.json 1716/1716` (auf `5f8ed15ef8` waren es 17622 und 1686, N28, N30); maßgeblich ist CRLF = LF. Die Gegenprobe der Release-Prüfung ist in der Kopie gemessen: Ein ASCII-Anführungszeichen in einer Launcher-Note ergibt `Error: launcher: ASCII-Anführungszeichen`.

- [ ] **Step 9: Gesamtlauf aller Testläufe und Typecheck aller Workspaces**

Befehle (nacheinander, jeder mit Exit-Code):
```bash
npm run selftest -w @jm/master-link; echo "Exit: $?"
npm run selftest -w @jm/launcher; echo "Exit: $?"
npm run selftest:verbund -w @jm/launcher; echo "Exit: $?"
npm run selftest:iveo -w @jm/launcher; echo "Exit: $?"
npm run selftest -w @jm/iveo; echo "Exit: $?"
npm run selftest -w @jm/timer; echo "Exit: $?"
npm run selftest -w @jm/rundown; echo "Exit: $?"
npm run selftest -w @jm/titler; echo "Exit: $?"
npm run selftest -w @jm/app-runtime; echo "Exit: $?"
npm run typecheck --workspaces --if-present; echo "Exit: $?"
```
Erwartet: jeder Lauf ohne `FAIL`/`FEHL` und mit `Exit: 0`, die Zählstände gleich denen aus Step 1. Gemessen am 12.10.2026 auf `adda584693` (vierte Runde; bis auf app-runtime dieselben Zahlen wie beim Zusammenführen):
```
756 ok, 0 fehlgeschlagen.                          (@jm/master-link, ca. 40 s)
113 ok, 0 fehlgeschlagen.                          (Launcher selftest)
203 / 53 / 63 ok, je 0 fehlgeschlagen.             (selftest:verbund, 24,7–28 s)
277 / 52 / 84 / 12 ok, je 0 fehlgeschlagen.        (selftest:iveo)
190 ok-Zeilen, ALLE TESTS OK                       (@jm/iveo)
59 passed, 0 failed                                (Timer)
443 + 109 ok-Zeilen, zweimal ALLE TESTS OK         (Rundown)
477 ok-Zeilen, ALLE TESTS OK                       (Titler)
50 passed, 0 failed / 208 passed, 0 failed         (app-runtime)
```
Vor R2 waren es 572, 113, 188, 239/47/84/6, 166, 41, 404 + 81, 407, 50 (app-runtime auf `5f8ed15ef8`: 15). `typecheck --workspaces` ohne Fehler (25 Apps importieren app-runtime; 31 Workspaces mit Typecheck, darunter `@jm/ui` und `@jm/settings`; gemessen 55–125 s).

- [ ] **Step 10: Notes zur Freigabe vorlegen, auf „Owner-Freigabe Notes R2“ warten**

In den Aufgabenbericht, für die steuernde Sitzung zur Vorlage beim Owner:
1. die vier Note-Listen aus Step 7 wörtlich, mit dem Datum;
2. die Texte ohne Spec-Vorgabe: alle 20 Zeilen der Tabelle „Texte ohne Spec-Vorgabe“ im Abschnitt „Entscheidungen“ (Stand nach N15/N16: Logzeilen, Statuszeile, V12-Gründe, die neue Zeile des Rundowns zum Show-Link; die Modal-Einzahl hat der Owner am 08.10.2026 schon entschieden und steht nur zur Vollständigkeit dabei), wörtlich wie im Code;
3. der Stand des Durchgangs (C20) und der Hinweis, dass die Abnahme-Datei die Hinweise M1 = nein, FA15, FA17 und FA4 und den Abschnitt „Zusatzprüfungen (nicht in Spec 20)“ trägt.

Ändert der Owner einen Wortlaut, den neuen Text wörtlich in die betroffenen Einträge übernehmen (ohne ASCII-Anführungszeichen) und Step 8 wiederholen. Ohne die Zeile „Owner-Freigabe Notes R2“ im Ledger endet C21 hier, ohne Commit.

- [ ] **Step 11: Commit (erst mit „Owner-Freigabe Notes R2“)**

```bash
git add packages/master-link/ABNAHME-2b.md docs/suite-verbund.md docs/jm-show.md apps/launcher/package.json apps/timer/package.json apps/titler/package.json apps/rundown/package.json package-lock.json packages/suite-manifest/changelog.json
git status --short
```
Erwartet genau diese neun Pfade und sonst nichts:
```
M  apps/launcher/package.json
M  apps/rundown/package.json
M  apps/timer/package.json
M  apps/titler/package.json
M  docs/jm-show.md
M  docs/suite-verbund.md
M  package-lock.json
A  packages/master-link/ABNAHME-2b.md
M  packages/suite-manifest/changelog.json
```
Dann (Commit-Text ohne Umlaute):
```bash
git commit -m "release(suite): Launcher 0.15.0, Timer 0.14.0, Titler 0.11.0, Rundown 0.8.0 - Master-Link Teil 2b, Release 2" -m "Abnahme-Datei packages/master-link/ABNAHME-2b.md nach Spec 20 mit Hinweisen zu M1, FA15, FA17 und FA4 und Zusatzpruefungen (nicht in Spec 20). Abschnitt Show-Daten im Verbund in docs/suite-verbund.md, Verweis in docs/jm-show.md. Versionen in package.json und package-lock.json, Changelog-Eintraege fuer launcher, timer, titler und rundown nach Freigabe der Notes durch den Owner." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 12: Stand melden**

Befehl: `git log --oneline -25` und `git status --short`.
In den Aufgabenbericht: die Commits von C1–C21 und dass `git status --short` leer ist. Was danach mit dem Branch geschieht, steht im Abschnitt „Nach der Umsetzung“ und ist nicht Teil dieser Aufgabe.

**Abweichungen vom Gerüst:**
1. Die Abnahme-Datei trägt über der Tabelle drei Voraussetzungen (gekoppelt, Show mit Speakern und Side Events, offene Abnahmen 2a/R1 nach Spec 25 Nr. 1) und unter der Tabelle die vier Hinweise aus dem Gerüst. Die Tabelle selbst ist wortgleich; geprüft in Step 2. Dahinter steht der Abschnitt „Zusatzprüfungen (nicht in Spec 20)“ mit fünf Handprüfungen (Show-Link im Verbund, Start mit Show-Link, gesperrte Ordnerwahl, N17; Rundown-Datei am Master mit „Öffnen…“/„Neu“ im Verbund, eigene Wahl nach dem Entkoppeln, N23) als nummerierte Liste, damit die Prüfung in Step 2 nur die Tabelle der Spec zählt.
2. `docs/suite-verbund.md` bekommt außer dem neuen Abschnitt auch den Stand-Satz in Zeile 5 („Stand Teil 1 … folgen in den nächsten Teilen“), der sonst Show-Daten als künftig nennte.
3. Die Notes nennen mehr als die Pflichtpunkte, nämlich das, was ein Bediener merkt: die Anzeige je Tool, die Sperre der Ordnerwahl (O1), die nicht geladene Rundown-Datei (17.3), den Show-Link, aus dem der Rundown im Verbund nichts lädt (E24, N15), „Launcher · Side Event“ an den Master (Z2), die Side-Event-Liste (Z3) und die Endpunkte von Hand (FA4).
4. Beim Zusammenführen nach C1–C20 gemessen, in der zweiten Runde (N15–N21) und nach dem Neuaufsatz auf `adda584693` (vierte Runde, N30) wiederholt: alle Vorher-Texte trafen genau einmal; danach gültiges JSON, `Release-Vorbereitung ok`, Abnahme-Tabelle wortgleich (14 Schritte), CRLF = LF in allen acht Dateien. Die Anker in `apps/launcher/package.json` und `package-lock.json` überschneiden sich nicht mit C8, C11 und C19.

---

## Selbstprüfung des Plans

### 1 · Spec-Abdeckung

| Spec | Inhalt | Aufgabe(n) |
| --- | --- | --- |
| 0 Nr. 4–10, 17, 18 | Freigabeliste, RELOAD doppelt abgesichert, Tools am Master ohne Abo, Zwischenspeicher, Antwortfrist, Rundown-Datei auf B, Modal-Zeile, O1, `frueher` | C5, C9, C12, C13, C17, C18, C10, C15/C16, C12 |
| 1 D3, D4 | Tools holen direkt über ihre Verbindung, auch ohne Launcher auf B; folgen immer; letzter Stand bleibt | C12, C13 (Abo aus dem Tool), C14–C18, C19 (ohne Launcher auf B) |
| 12 | Überblick: Abo → Stand → Änderung, vollständiger Ausschnitt, eine Leitung je Tool | C3, C4, C8, C12 |
| 13.1 | Nachrichten, `schluessel`, `mitDokument`, Fassung | C2 (`show-daten.ts`), C8 (`verbundSchluessel`, `antwortFassung`) |
| 13.2 | lockere Prüfer, `pruefeAbo`/`pruefeStand` je Regel, Verwurf mit Warnung je Verbindung, `verworfen` | C2, C3 (ungültiges Abo), C12 |
| 13.3 | Epoche, Folge, Neuabo, Abo-Wiederholung 30 s | C8, C12, C19 (E, I) |
| 13.4 | Grenzen 1 MiB, 900 KiB, 5 s, 32, Stau | C1 (`GRENZEN`), C3, C8, C12 |
| 13.5 | ZeilenLeser je Zeile, Stückliste, Übergabe nach `angemeldet`, lockere Prüfer, `PROTOKOLL` 1, Koppeln ohne Reparatur | C1, C4, C2, C3 (Regressionstest) |
| 13.6 | Sitzungs-Kennung, `sendeDaten`, Stau, `entstaut`, `sendeZeile` | C2, C3, C8 |
| 13.7 | Server- und Client-API, `istDieserRechner` | C3, C4 (E6 weicht ab) |
| 14.1–14.3 | Ausschnitt, Freigabeliste, Größe | C5, C8 |
| 15.1 | Quelle und Auslöser (`meldeShow` an vier Stellen), Epoche je Start der Rolle | C6, C8, C9 |
| 15.2 | Abo-Verwaltung nach Sitzung, Launcher-Abo ignoriert, 32 je Rechner | C8, C9 |
| 15.3 | RELOAD nur an diesen Rechner, auch beim Nachholen | C9 (E12) |
| 15.4 | Side-Event-Liste auffrischen (Z3) | C7 |
| 15.5 | Modal-Zeile und „bezieht Show-Daten“ | C10 |
| 15.6 | Logzeilen | C8 (Verteiler), C9 (RELOAD) |
| 16.1 | Wann ein Tool folgt (E47 weicht ab, vom Owner bestätigt), Verbundmodus, Deep-Link liefert nur Dokumente (Titler die Vorlage; der Rundown lädt nach 17.3 nichts, E24, N15), RELOAD ignoriert, Ende des Verbundmodus (Titler über `verbundEndetFuer`, N8; keine Anwende-Versuche mehr, N4), anderer Master (keine Versuche mit dem Stand des bisherigen, N18), `verbundDatenErsetzt` | C12, C13, C14, C15, C16, C17, C18 |
| 16.2 | API, `neueShow`, `fehler` mit fünf neuen Versuchen, `verworfen`, `@jm/show` als Abhängigkeit | C11, C12 (ZF1), C13 |
| 16.3 | Zwischenspeicher | C12, C13 |
| 16.4 | Anzeige V1–V15 | C11 |
| 16.5 | IPC und Platz in den Tools | C13, C14, C16, C18 |
| 17.1 | Timer | C14 (E14 weicht ab) |
| 17.2 | Titler, O1 | C15, C16 |
| 17.3 | Rundown: Gedächtnis, Zeiger, Ladewege, Übergang, Hinweis, Show-Deep-Link: Daten ignoriert (geht 16.1 vor, E24, `showLinkWeg`) | C17, C18 |
| 17.4 | Zwei Launcher (Z2) | C17, C18 (E15 weicht ab) |
| 18 | Verhalten bei Master weg, Show zu, gemischten Versionen (E9 weicht ab) | C19 (Abschnitte A–R), C20 Prüfungen 4, 5, 7; Kabel 25 s nur Abnahme Schritt 7 (Spec 25 Nr. 11) |
| 19.1 | Tests master-link | C1–C4 |
| 19.2 | Tests `@jm/show` | C5 |
| 19.3 | Verteiler-Tests Nr. 1–10, Kern, RELOAD-Merker | C6, C7, C8, C9, C10 |
| 19.4 | app-runtime-Tests | C11, C12, C13 |
| 19.5 | Tool-Tests | C14, C15, C17 |
| 19.6 | CI-Schritt (genau einer: der Schritt aus Zoom 4b, umbenannt statt neu angelegt, G2, N26; Abweichung im Wortlaut gemeldet, C11 „Abweichungen“, N40), `selftest:verbund` erweitert, kein Electron, 15 min | C11, C8, C19 |
| 19.7 | Durchgang Prüfungen 1–7 | C20 (vom Owner am 08.10.2026 freigegeben; was er nicht erreicht, steht in C16/C18 unter „Regeln“) |
| 20 | Abnahme-Datei (Tabelle wortgleich; darunter „Zusatzprüfungen (nicht in Spec 20)“, N17, N23) | C21 |
| 21 | Aufbau, Versionen, Notes, Doku | C21 (Release selbst: Schlussabschnitt) |
| 22 | Sicherheit: kein Token, Freigabeliste, Begrenzung, eine Richtung | C5 (PIN, `baseUrl`), C8 Nr. 8 (Token in keiner Zeile), C3/C8 (32, 900 KiB, 1 MiB), C3 (`stand` vom Client ignoriert) |
| 24 | Folgeaufgaben FA1–FA10 nicht in 2b; FA4 als Hinweis in Abnahme und Notes | Abschnitt „Bewusst nicht“, C21 |
| 25 | Risiken: Nr. 1 (Abnahmen davor), 4 (Timer-Reset in den Notes), 6 und 11 (Abnahme Schritt 7), 8 (Port 8738) | C21, C20 |
| 27 | O1 gesperrt, O2 = FA4, O3 RELOAD nur an diesen Rechner | C15/C16, C21, C9 |

Keine Lücke gefunden. Nicht im Plan, weil die Spec es so will: FA1–FA10, die Abnahme selbst (Owner), das Release (Schlussabschnitt).

### 2 · Platzhalter-Scan

Gesucht im ganzen Plantext nach `TBD`, `TODO`, `später ausfüllen`, `nach A–D nachmessen`, `Stand-in`, `«`, „ähnlich wie Task“: keine Treffer außer in den Stellen, die beschreiben, wie der Plan entstand (Abschnitt „Wie dieser Plan entstanden ist“, ZF9 und diese Zeile). Jede Code-Änderung steht als vollständiger Vorher/Nachher-Text oder als ganze neue Datei im Plan.

### 3 · Typ-Konsistenz

- Geprüft durch Durchspielen: Alle 282 Operationen der 21 Aufgaben (nach der Nachbesserung 283, auch nach der zweiten und dritten Runde N15–N24 und nach dem Neuaufsatz auf `adda584693`, vierte Runde N25–N42, dort nach N34 zweimal und nach N35–N42 noch einmal ohne Tests mit denselben Bytes) wurden der Reihe nach auf eine frische Kopie angewendet; jeder Vorher-Text kam genau einmal vor. Danach liefen nach jeder Aufgabe der Typecheck der berührten Pakete und, wo die Aufgabe `packages/app-runtime/src` oder `packages/show/src` ändert, `npm run typecheck --workspaces --if-present` ohne `error TS`.
- Namen aus dem Register und den Produces-Blöcken stimmen mit den Code-Blöcken überein; die beim Zusammenführen gefundenen Widersprüche stehen unter „Abweichungen und Entscheidungen bei der Zusammenführung“ (ZF1–ZF10).
- `git add`-Listen: Für jede Aufgabe ist die Menge der Pfade in `git add` gleich der Menge der Dateien, die ihre Steps ändern oder anlegen (C11 zusätzlich `package-lock.json` aus `npm install --package-lock-only`).

### 4 · Review Focus

Die fünf Punkte stehen oben unter „Review Focus“; jeder hat seine Prüfzeile in der genannten Aufgabe (C1, C8, C12, C13, C17), beim Durchspielen grün und, wo eine Gegenprobe dazu gehört (C8 Bytes statt Zeichen, C12 Schlüssel bei `neueShow`, C13 Zwischenspeicher), rot gegen den absichtlichen Fehler.

## Nach der Umsetzung (nur Controller und Owner)

Dieser Abschnitt beschreibt, was nach C21 außerhalb des Plans geschieht. Kein Agent führt davon etwas aus; er ist keine Aufgabe und keine Anweisung.

- **Stand der Owner-Punkte (08.10.2026, N19):** Die mit „Weicht ab“ markierten Entscheidungen (E6, E9, E14, E15, E47) hat der Owner bestätigt, die Modal-Einzahl entschieden (N16) und den Durchgang C20 freigegeben. Offen sind beim Owner nur die Texte ohne Spec-Vorgabe und die Release-Notes (Ledger-Zeile „Owner-Freigabe Notes R2“); erst danach entsteht der Commit von C21. Im Plan offen sind außerdem die Textpunkte der dritten Nachprüfung (Absatz vor N22); sie gehören vor C21, weil drei davon Texte betreffen, die C21 schreibt (N39). Gemeldet ist die Abweichung im Wortlaut von Spec 19.6 (CI-Schritt umbenannt statt neu angelegt, N40). Zur Durchsicht stehen außerdem die Zusammenführungs-Entscheidungen ZF1–ZF10 und die Nachbesserungen N1–N42 bereit (N25–N42: Neuaufsatz und seine Nachprüfung, 12.10.2026).
- **Umsetzung (Owner, 08.10.2026):** per Workflow (subagent-driven) nach Zoom Stage 4b. Vorher, außerhalb der Aufgaben C1–C21, setzt die steuernde Sitzung den Branch auf den dann aktuellen `main` (mit 4b) neu auf und lässt in einem eigenen Durchgang die Anker (Vorher-Texte, Zeilenangaben) und Zählstände der berührten Stellen nachmessen und im Plan nachziehen. **Erledigt am 12.10.2026 (N25):** Basis `adda584693` (darin Zoom 4b, PR #251, `2df1f79357`; UX Welle 0, PR #250, `efcfff3c5a`; Manifest `f118fcd215`; Roadmap PR #252). Nachgemessen und nachgezogen sind C11–C21 und die globalen Abschnitte (vierte Runde, N25–N32), C1–C10 in einem eigenen Messgang (N33); zusammengeführt und zweimal ohne Tests abgespielt (N34); nach einer Nachprüfung Angaben, Spannen und Vermerke nachgezogen (N35–N42). Nicht erledigt sind die Textpunkte der dritten Nachprüfung (Absatz vor N22); sie bleiben offen und gehören vor C21 (N39). Die Berührungspunkte darunter sind am 08.10.2026 lesend mit `git` ermittelt (`main` `b7e959866d`, `feat/zoom-stage4b` `85dcba597d`) und stehen hier als erledigte Liste mit den Werten vom 12.10.2026 (von den 81 Dateien dieses Plans ändert `main` seit `5f8ed15ef8` genau die vier ersten).
  - Erledigt: `.github/workflows/ci-checks.yml` (C11 Step 12, N26): Der Job `selftests` hat auf `adda584693` 22 Schritte (16 auf `b7e959866d`, dazu zwei aus UX Welle 0 und vier aus 4b), der letzte „App-Laufzeit (Log-Aufräumen, CSP)“ mit `run: npm run selftest -w @jm/app-runtime` (Zeilen 92–93). C11 benennt diesen einen Schritt um in „App-Laufzeit (Log-Aufräumen, CSP, Verbund-Anzeige, Abo-Zustand)“ statt einen zweiten anzuhängen; der Job behält 22 Schritte, darin genau ein app-runtime-Schritt (Spec 19.6, gemessen). Die früheren Angaben „17 Schritte“ (N11) und „20 Schritte“ (N20, N22) sind überholt. Mitgezogen sind alle Stellen, die vom Anhängen sprachen (N22): G2, Kopf (Abschnitt zu Zoom 4b und UX Welle 0), Kopf-Tabelle C11, C11 „Dateien“ und „Regeln“, C11 Step 12 (Titel, Einleitung, Vorher/Nachher, YAML-Prüfung mit gemessener Erwartung und Gegenprobe), Commit-Text C11 Step 13, Dateistruktur (CI) und Selbstprüfung 19.6.
  - Erledigt: `package-lock.json` (C11 Step 2, Block `packages/app-runtime`; C21 Step 6, Versionsblöcke; N28): `main` ändert dort +41/−3 Zeilen (17 618 → 17 656; bis `b7e959866d` waren es +2/−2). Der Block `packages/app-runtime` steht jetzt bei `:17400-17409`, Hunk `@@ -17401,7 +17401,11 @@`, nach C11 17 660 Zeilen; die vier App-Blöcke für C21 stehen unverändert bei `:293`, `:546`, `:704`, `:736`. Jeder Vorher-Text genau einmal.
  - Erledigt: `packages/suite-manifest/changelog.json` (C21 Step 7, N30): `main` fügt 30 Zeilen hinzu (16 bis `b7e959866d`, 14 mit Connect 0.3.0). Die Vorher-Texte der vier Einträge stehen jetzt bei `:31-35`, `:645-649`, `:1079-1083`, `:1379-1383`, jeder genau einmal; nach C21 1716 Zeilen.
  - Erledigt: `packages/app-runtime/src/index.ts` (C13 Step 7, drei Einfügungen mit 15 Zeilen, N29): 4b fügt 13 Zeilen ein und löscht eine Leerzeile (netto +12, 660 Zeilen). Die Ist-Zeilen sind jetzt `:17`, `:48`, `:387` (vorher `:16`, `:47`, `:379`), die Sperre in G14 `:376-379`; nach C13 675 von 675 Zeilen (vorher 663), 15 Einfügungen, 0 gelöschte Zeilen, wie die Dreiwege-Zusammenführung mit `85dcba597d` vorhersagte. Die Quelltext-Wächter des 4b-Selbsttests bleiben grün.
  - Erledigt, ohne Textänderung durch R2, aber mit anderen Zählständen (N27): `packages/app-runtime/test/selftest.ts` (nur 4b) und `src/log-aufraeumen.ts` (neu in 4b). Der erste Teil von `npm run selftest -w @jm/app-runtime` zeigt `50 passed` statt `15 passed` (am 12.10.2026 auf `adda584693` gemessen), dahinter `64`, `174` bzw. `208 passed`; nachgezogen in C11–C13, C21 Step 9, Kopf-Tabelle und Testläufe. `packages/app-runtime/package.json` ändert 4b nicht.
  - Nachgeprüft am 12.10.2026: Die Doku-Dateien, die C21 ändert (`docs/suite-verbund.md`, `docs/jm-show.md`), ändern weder `main` noch 4b; `docs/roadmap.md` aus PR #249 und #252 fasst R2 nicht an.
  - Neu seit dem 08.10.2026, ohne Textänderung durch R2 (N31): UX Welle 0 (`packages/ui`, `packages/settings`); `typecheck --workspaces` prüft jetzt 31 Workspaces, darunter `@jm/ui` und `@jm/settings`, Exit 0 nach C11, C12, C13 und C21. Die STATE-Kodierung aus 4b (Leerraum und `%` als `%XX`) berührt R2 nicht.
- Der Durchgang C20 läuft in der Umsetzung ganz, sobald die steuernde Sitzung beim Start die Ledger-Zeile „Owner-Freigabe C20“ gesetzt hat; sein Ergebnis gehört in den PR-Text. Ohne grünen Durchgang geht der Branch nicht in den Merge (N14). Was C20 nicht erreicht (Show-Link im Verbund, Start mit Show-Link, gesperrte Ordnerwahl, Rundown-Datei am Master mit „Öffnen…“/„Neu“, eigene Wahl nach dem Entkoppeln), prüft der Owner von Hand nach dem Abschnitt „Zusatzprüfungen (nicht in Spec 20)“ der Abnahme-Datei (N17); die Tabelle aus Spec 20 bleibt wortgleich.
- Der Branch `feat/master-link-teil2b-r2` geht als PR „Master-Link Teil 2b, Release 2: Show-Daten über den Verbund“ in die Prüfung, mit den Ergebnissen von C19 (Kette, Gegenproben) und C20 (Durchgang) im PR-Text, und danach in `main`.
- **Überholt (12.10.2026, N25):** 4b liegt seit `2df1f79357` auf `main`, und der Branch ist darauf neu aufgesetzt; der Text dahinter bleibt zur Nachvollziehbarkeit stehen. Liegt 4b beim Merge entgegen dem Plan noch nicht auf `main` (lesend mit `git log` prüfbar), gelten die Berührungspunkte oben sinngemäß für die Zusammenführung: In `ci-checks.yml` ist der Textkonflikt sicher und wird zu genau einem app-runtime-Schritt mit dem Namen „App-Laufzeit (Log-Aufräumen, CSP, Verbund-Anzeige, Abo-Zustand)“ aufgelöst.
- Veröffentlicht werden Launcher 0.15.0, Timer 0.14.0 und Rundown 0.8.0 über CI-Tags, der Titler 0.11.0 lokal gebaut und von Hand (`docs/release-titler.md`). `main` liegt vor den Tags auf dem Server, weil der CI-Bump auf `main` schreibt; die Tags gehen einzeln hinaus, weil mehr als drei Tags in einem Push keine Workflows auslösen. `suite.json` zieht der Bot nach.
- Die Abnahme an zwei Rechnern nach `packages/master-link/ABNAHME-2b.md` macht der Owner; die offenen Abnahmen 2a und 2b Release 1 können im selben Termin davor laufen (Spec 25 Nr. 1).
- Die Zusatzbitte des Owners „Zoom-Bridge: Shared Content als eigenständiges Signal“ gehört nicht zu R2; erledigt: Issue #247 (Abschnitt „Bewusst nicht in diesem Plan“).
