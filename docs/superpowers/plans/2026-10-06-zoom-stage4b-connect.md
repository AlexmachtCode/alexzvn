# Zoom Stage 4b (Betrieb und Auslieferung: JM Connect 0.3.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** JM Connect 0.3.0 tritt nach einem Verbindungsabriss selbst wieder in das Meeting ein und lädt die gemerkten Quellen neu. Entzieht der Host die Aufnahme-Erlaubnis, stoppt Connect sofort alle Zoom-Quellen und lädt sie nach der Wiedererteilung von selbst neu. Companion kann Connect minimal steuern: Status-Variablen, Laden und Entladen per Anzeigename, Versatz. Teilnehmernamen erscheinen nicht mehr im Log, und alle Suite-Apps löschen Logzeilen nach 14 Tagen. Dazu kommen die gesammelten 0.3.0-Randfälle. Der Plan endet mit der Abnahmeliste 0.3.0. Ein Release gehört nicht zum Plan.

**Architecture:**
- **`@jm/zoom-bridge`:** Der native Teil ändert sich gezielt an zwei Stellen. (1) Beim Entzug baut die Bridge alle Abos ab, mit dem neuen Grund `privilegeRevoked`. Der Abbau läuft außerhalb des SDK-Rundrufs, nach demselben Muster wie der Abbau beim Meeting-Ende. (2) Logzeilen enthalten keine Teilnehmernamen mehr. Die Attrappe bildet Entzug, Wiedererteilung, Rückkehr aus `reconnecting`, ein verzögertes Abo, NDI-Namen „(2)“ und Pufferfehler nach. Die Wächter vereinigen ihre Namenslisten, statt sie zu ersetzen.
- **Connect, rein (ohne Electron):** `fristen.ts` (Konstanten), `klartext.ts` (R2/R4/R5/R7, F1–F8, Einordnung `istEndgueltig`, Logtexte ohne Namen, `maskiereNamen`), `soll.ts`/`teilnehmer.ts` (Plätze bis zur Betriebsgröße, Vorschau „(2)“, Ton aus dem Soll), `fernsteuerung.ts` (Befehle deuten), `control-state.ts` (STATE mischen), `shared/zoom-text.ts` (neue Zustandstexte, `zoom_cmd*`, Bild-/Ton-Klartext).
- **Kern (`kern.ts`):** Wiederbeitritts-Folge nach 6.4 mit Zeitgebern und Abbrechen; Entzug ohne Verlust der Soll-Liste; Betriebsgröße im Abgleich; Fernsteuer-Verb `steuerbefehl`; Randfälle; Logzeilen ohne Namen.
- **Hülle, Oberfläche:** IPC `zoomAbbrechen`, `zoom_*`-Verben werden im Main abgefangen, STATE kommt aus zwei Teilen. Die Karte bekommt „Abbrechen“, Klartext statt Rohwerten, „gemerkte Quellen“ mit Grenze und „Versatz nur für diese Sitzung“.
- **Suite:** STATE-Werte werden kodiert (`@jm/suite-control-protocol`). Die Rolle `connect` bekommt die Zoom-Teile. Companion wertet Anzahlen > 0 als wahr, das Modul wird 0.2.0. `@jm/app-runtime` löscht Logzeilen, die älter als 14 Tage sind. Dazu kommen CI-Schritte, das Handbuch und die Abnahmeliste 0.3.0.

**Tech Stack:** TypeScript (ESM), Electron 33, electron-vite 2, electron-builder 24.13.3, React 18 + Tailwind 4, Node ≥ 22.6 (`--experimental-strip-types` für die Selbsttests von Bridge, Steuerprotokoll und app-runtime), `tsx` (Connect-Tests), esbuild (Companion-Sync), Bitfocus-Companion-Modul (ESM, ohne Workspace), C++/MSVC und Zoom-Meeting-SDK 7.1.5.43953 (nur der Bau der Bridge am Entwicklungs-PC, nie in CI), NDI 6.

**Spec:** `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md`, Umfang Abschnitt 18 Zeile „4b · Betrieb und Auslieferung“ plus Nachtrag „Umfang 4b (Connect 0.3.0) – Ergänzungen“ (N4b.1–N4b.3). Ergänzend `docs/superpowers/specs/2026-10-06-connect-zoom-sdk-laden-design.md` (Sperre S10, Laden). Bei Widerspruch gilt die Spec; die Abweichung wird gemeldet.

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\zoom-4b` (Branch `feat/zoom-stage4b`). Alle Pfade relativ dazu.

**Vor Aufgabe 1 (Controller):** Die Plan-Datei liegt beim Schreiben unversioniert im Arbeitsbaum (`git status --short` zeigt `?? docs/superpowers/plans/2026-10-06-zoom-stage4b-connect.md`). Der Controller committet sie vor Aufgabe 1 (`docs(connect): Plan Stage 4b (Connect 0.3.0)`). Erst dann stimmen die Erwartungen „sonst nichts Gestagtes, nichts Ungestagtes“ und „keine Ausgabe“ nach `git status --short` (zum Beispiel Aufgabe 4 Step 9, Aufgabe 16 Step 16), und der Plan-Verweis, den Aufgabe 20 in `docs/roadmap.md` schreibt, ist auch im Commit kein toter Link (Aufgabe 21 Step 3: `Roadmap: []`).

**Wie dieser Plan entstanden ist:**
- Eine **Gliederung** hat Kopf, Global Constraints, Review Focus, Dateistruktur, die Entscheidungen L1–L23, die Texttabelle, die Schnittstellen und den Rahmen jeder Aufgabe festgelegt. Wo in den Aufgaben von „der Gliederung“ die Rede ist, ist dieser Rahmen gemeint; die Abschnitte stehen unten im Plan. Fünf Schreiber haben die Aufgaben in Blöcken ausformuliert: **A** = Aufgaben 1–3 (Bridge-Paket), **B** = 4–7 (Connect, reine Module), **C** = 8–13 (Kern), **D** = 14–16 (Steuerprotokoll, Connect-Hülle, Companion, CI), **E** = 17–21 (app-runtime, Karte, sdk-laden, Handbuch, Abnahme).
- Jeder Schreiber hat seine Aufgaben an einer frischen Kopie des Worktrees (`git archive` von HEAD `051151d614`, `node_modules` als Junctions, `@jm/*` auf die Pakete der Kopie) nachgebaut und jeden Test erst rot, dann grün gemessen. Exporte aus anderen Blöcken standen dabei als Ersatzstücke mit den Namen der Gliederung in der Kopie.
- **Montage:** Der fertige Plan ist als Ganzes auf eine neue frische Kopie nachgespielt: alle damals 254 Vorher/Nachher-Ersetzungen und 7 neuen Dateien der Aufgaben 1–21 der Reihe nach, dazu die zwei Dateien, die ein Befehl erzeugt (`generated/protocol.mjs` in Aufgabe 16, `cookbook.json` in Aufgabe 20). Jeder Vorher-Ausschnitt kam genau einmal vor, nachdem zwei nicht passende Vorher-Ausschnitte und ein Widerspruch zwischen zwei Blöcken aufgelöst waren (Abschnitt „Abweichungen und Entscheidungen der Montage“, MO1–MO3). Jeder Rot- und Grün-Lauf des Plans lief an seiner Stelle; alle Zählstände und Rot-Meldungen in den Aufgaben sind diese Messungen (Windows 11, Node 24.16.0). Zum Schluss ist der fertige Text maschinell noch einmal auf eine zweite frische Kopie gespielt: alle 58 berührten und die 2 erzeugten Dateien waren byte-gleich mit dem gemessenen Stand.
- **Nachbesserung nach dem Review (2026-10-06):** 21 Befunde aus zwei Prüfungen (Spec-Treue, Code und TDD) sind am Code und an der Spec nachgeprüft und eingearbeitet; Abschnitt „Nachbesserung nach dem Review“ am Ende nennt jeden. Danach ist der Plan noch einmal ganz auf eine neue frische Kopie nachgespielt (262 Ersetzungen, 7 neue Dateien, jeder Vorher-Ausschnitt genau einmal), jede geänderte Aufgabe mit Rot- und Grün-Lauf und ihren Gegenproben, die übrigen Aufgaben mit ihren Grün-Läufen, dazu der Gesamtlauf aus Aufgabe 21 und der Typecheck aller 25 Apps. Alle Zählstände im Plan sind diese Messungen (Windows 11, Node 24.16.0). Zum Schluss ist der fertige Text noch einmal maschinell auf eine weitere frische Kopie gespielt: alle 61 berührten und die 2 erzeugten Dateien waren byte-gleich mit dem gemessenen Stand.
- Gemessene Zählstände (Ausgang → Endstand): Bridge `test/selftest.ts` 471 → 498 (Aufgabe 1) → 509 (Aufgabe 2) `ok`; `test/auslieferung.test.mjs` 31 → 41 (Aufgabe 3). Connect `zoom-text` 529 → 660 → 774 → 772 (Aufgaben 4, 5, 8); `zoom-teile` 90 → 111 → 139 (Aufgaben 6, 7); `zoom-kern` 409 → 410 → 442 → 464 → 514 → 539 → 550 → 578 (Aufgabe 8 Step 1, dann Aufgaben 8–13), davor immer 409; `zoom-settings` 33 → 35 (Aufgabe 11); `sdk-laden` 79 → 83 (Aufgabe 19); `control-state` neu 31 (Aufgabe 15); `zoom-laufzeit` 86 unverändert. Steuerprotokoll 41 → 70 → 77, Companion-Modul 36 → 51 → 70, app-runtime 15 → 43 `passed`. Endstand dreimal hintereinander gemessen: `zoom-kern` je 578 ok in 92 bis 100 s (Ausgang 31 s), Bridge je 550 `ok`.
- Nicht ausgeführt: der Bau der echten Bridge (Aufgabe 2 Step 22, braucht SDK und Visual Studio, L17), jeder Lauf unter Linux (CI), die Läufe mit echtem `git` (Commit-Schritte, `git diff --exit-code`; in der Kopie ersetzt durch `git diff --no-index` gegen den HEAD-Blob und durch Prüfsummen) und bei der ersten Montage die Gegenproben (absichtlich eingebaute Fehler); diese haben die Schreiber an ihrem Zwischenstand gemessen, sie stehen am Ende der Aufgaben als „beim Planen gemessen“. Bei der Nachbesserung sind die Gegenproben der Aufgaben 2, 4, 5, 8, 9, 10, 12, 13, 15 und 17 am nachgespielten Stand neu gemessen; die Zahlen dort sind diese Messungen. Ohne `.git` in der Kopie ist auch dort `git` nicht gelaufen; die Commit-Schritte setzen den Commit der Plan-Datei vor Aufgabe 1 voraus („Vor Aufgabe 1“).
- Jede Aufgabe trägt am Ende ihre Abweichungen von der Gliederung.

## Global Constraints

- **G1** SDK-Fassung exakt `7.1.5.43953` (`SDK_FASSUNG`), Bridge meldet `7.1.5 (43953)` (`SDK_FASSUNG_BRIDGE`). Die Prüfung bleibt auch in Tests exakt. Die Attrappe liefert den Wert über `FAKE_SDK_FASSUNG`.
- **G2** Der Laufzeit-Ordner und der Stempel bleiben wie in 4a. Bridge-Dateien liegen im Installer unter `resources\zoom-bridge\`, nie unter `resources\bin\win`.
- **G3** Feste Werte (Spec 5.2), ab Aufgabe 5 in `src/main/zoom/fristen.ts`:
  - `ANMELDE_FRIST_MS` 30 000 · `joinTimeoutMs` 30 000 · `killTimeoutMs` 12 000 · `BEENDEN_FRIST_MS` 15 000 · `ABGLEICH_VERZOEGERUNG_MS` 300 · `ABO_ANTWORT_FRIST_MS` 10 000 · `JWT_GUELTIG_S` 43 200 · `AUFLOESUNG` `'720p'` · `ABBILD_TAKT_MS` 100 · `HINWEISE_MAX` 5.
  - **`WIEDERBEITRITT_PLAN_S` = 2, 5, 10, 20, 30.** Für Tests einspeisbar als `wiederbeitrittPlanMs`.
  - `BETRIEBSGROESSE` 5 und `WIEDERBEITRITT_VERSUCHE` 5 stehen in `shared/zoom-text.ts`.
  - `LOG_FRIST_MS` 14 Tage, `LOG_AUFRAEUMEN_TAKT_MS` 6 h.
  - Die Fristen sind für Tests einspeisbar; die 300 ms bleiben in den Fällen 14/14b unverändert.
- **G4** Anzeigename: Vorgabe „JM Connect“, 1 bis 64 Zeichen nach `trim`. Versatz: ganze Zahl von 0 bis 1000 ms, Vorgabe 0.
- **G5 Geheimnisse und Namen:**
  - Meeting-Nummer und Kenncode stehen nie auf der Platte, nie im STATE, nie im Log. Masken wie in 4a (`•••`).
  - Client-ID und Secret gehen nie an den Kindprozess.
  - **N4b.2:** Keine Logzeile enthält den Anzeigenamen eines Teilnehmers. Kernzeilen nennen die Kennung. Zeilen der Bridge laufen zusätzlich durch `maskiereNamen` (Platzhalter `‹Name›`). Native `emitLog`-Zeilen enthalten keinen Namen.
  - Karte, Abbild und NDI-Name zeigen Namen weiterhin.
  - Die `zoom_*`-Werte im STATE führen keine Namen.
- **G6** Keine Datei aus `<Zoom-SDK>\x64\bin` im Installer. `@jm/zoom-bridge` steht nur in den `devDependencies` von Connect.
- **G7 Nativer Teil:**
  - Nur Aufgabe 2 ändert `packages/zoom-bridge/native/**`, und zwar nur `callbacks.cpp/.h`, `main.cpp`, `video.cpp/.h` und `session.cpp/.h`.
  - `CMakeLists.txt` bleibt unberührt.
  - CI kompiliert kein C++.
  - Gebaut wird `zoom-bridge.exe` nur am Entwicklungs-PC mit `ZOOM_SDK_DIR` und `NDI_SDK_DIR` (L17).
- **G8 Reine Module:**
  - `src/main/zoom/*.ts`, `src/main/control-state.ts` und `src/shared/zoom-text.ts` importieren kein `electron` und keine Aliase. Sie nutzen nur relative Importe und `@jm/zoom-bridge`, Typen per `import type`.
  - `src/shared/*` und `packages/zoom-bridge/src/protocol.ts` haben keine `node:`-Importe.
  - `packages/app-runtime/src/log-aufraeumen.ts` importiert nur `node:fs` und `node:path`. Es läuft unter `node --experimental-strip-types`: kein `enum`, keine Parameter-Properties.
- **G9 Texte:**
  - Wörtlich aus Spec 7, 8, 9 und dem Nachtrag, dazu die Texttabelle 4b dieses Plans (unten).
  - Typografie: deutsche Anführungszeichen „…“, Gedankenstrich „–“ (U+2013) in „JM Connect – Zoom <Name>“, Geviertstrich „—“ (U+2014) wie in der Spec, Auslassungszeichen „…“ (U+2026).
  - Log-Präfixe: `[zoom]`, `[zoom-bridge]`, `[runtime]`.
- **G10 Tests:** Kein Test lädt Electron oder braucht das echte SDK. CI läuft unter Ubuntu mit Node 22 und `npm ci --ignore-scripts`. Fälle, die nur unter Windows laufen, zählen anderswo als „übersprungen“.
- **G11 Nicht anfassen in 4b:**
  - Versionsnummer von Connect (`apps/connect/package.json`), `packages/suite-manifest/**`, `services/release-proxy/**`, Tags, Releases, Katalog, Proxy-Deploy (N4b.4).
  - Ausnahme: Das Companion-Modul geht in Aufgabe 16 auf 0.2.0 (Spec 11.4 Nr. 2, 17.3).
  - Rundown-Code bleibt unverändert (11.5).
- **G12 Testdaten:**
  - Meeting-Nummer nur synthetisch (`'7'.repeat(10)`). Der Kenncode enthält `KENNCODE-PROBE`.
  - Teilnehmernamen nur aus der Attrappe (Anna, Ben, Carla …).
  - STATE-Proben mit erfundenen Namen („Anna Maria Beispiel“).
- **G13 git:**
  - Kein Push, kein Tag, kein Branch-Wechsel, kein bare `git stash`, kein `git reset --hard`, kein `git clean`.
  - `git add` nur mit expliziten Pfaden, danach `git status --short` lesen.
  - Commit-Nachricht deutsch mit ASCII-Umschrift wie die letzten Commits (`feat(connect): …`, `feat(zoom-bridge): …`, `feat(suite-control): …`, `feat(companion): …`, `feat(app-runtime): …`, `docs(connect): …`). Letzte Zeile: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **G14** Dateien im Arbeitsbaum haben CRLF (`core.autocrlf=true`), auch die C++-Dateien. Ersetzt wird mit dem Edit-Werkzeug (Vorher-Text exakt), nicht mit `sed`. Ausnahme: `packages/zoom-bridge/test/auslieferung.test.mjs` hat LF und zwei NUL-Bytes, git hält sie für binär (Aufgabe 3, „Achtung, Zeilenenden“). Neue Dateien schreibt das Write-Werkzeug mit LF; das ist für git gleich (`core.autocrlf`).
- **G15** TDD: erst den Test rot sehen, dann Code schreiben. Jede Aufgabe endet mit grünem Selbsttest jedes berührten Pakets und grünem `npm run typecheck -w @jm/connect` bzw. `-w @jm/zoom-bridge`. Steuerprotokoll und app-runtime haben kein eigenes Typecheck-Skript; sie prüft `npm run typecheck -w @jm/connect` mit, `capabilities.ts` zusätzlich `npm run typecheck -w @jm/rundown` (Aufgabe 14) und `@jm/app-runtime` zusätzlich jede App mit `typecheck`-Skript (Aufgabe 17).
- **G16 Harness-Falle:** In `zoom-kern.test.ts` liest `p.befehle()` die Datei `FAKE_LOGDATEI`, und die schreibt der Kindprozess asynchron. Nach jeder Aktion, die einen Befehl an die Attrappe auslöst, wird erst mit `await bis(() => …)` auf den erwarteten Befehl oder das erwartete Ereignis gewartet, dann `p.befehle()` gelesen. Nie synchron direkt nach dem Senden lesen (4a-Ledger Task 15).
- **G17 Zeitgeber im Kern:**
  - Jeder neue Zeitgeber (Wiederbeitritt, Abgleich, Abo-Frist) läuft über `zeitgeber()` (`unref`).
  - `verlassen`, `abbrechen`, `schliessen` und `beenden` löschen ihn.
  - Nach `beenden` startet keine Bridge mehr (`beendenVersprechen !== null`).
- **G18 Eine Ursache, ein Name:** Der Grund `privilegeRevoked` wird nie mit `command` oder `meetingEnded` vermischt. Jede neue Kern-Meldung hat genau einen Text.
- **G19** Release, Proxy-Deploy, Katalog, Tag, Modul-Release und Anhängen der `.tgz` sind keine Plan-Aufgaben (N4b.4). Der Abschnitt „Nach der Umsetzung (nur Controller und Owner)“ am Ende beschreibt sie nur.

## Testläufe (wie sie wirklich heißen)

| Paket | Befehl | Läuft mit |
| --- | --- | --- |
| `@jm/zoom-bridge` | `npm run selftest -w @jm/zoom-bridge` | `node --experimental-strip-types test/selftest.ts && node test/auslieferung.test.mjs` |
| `@jm/connect` | `npm run selftest -w @jm/connect` | `tsx` je Datei. Endstand 4b: `zoom-text`, `zoom-laufzeit`, `zoom-teile`, `zoom-kern`, `zoom-settings`, `sdk-laden`, **`control-state`** (neu, Aufgabe 15), dann `node test/after-pack.test.mjs` |
| eine Connect-Datei | `npx tsx apps/connect/test/<datei>.test.ts` (aus der Worktree-Wurzel) | tsx |
| `@jm/suite-control-protocol` | `npm run selftest -w @jm/suite-control-protocol` | `node --experimental-strip-types test/selftest.ts` |
| Companion-Modul (kein Workspace) | `node packages/companion-jm-suite/test/selftest.mjs` | Node |
| Companion-Sync | `node scripts/sync-companion-protocol.mjs` (oder `npm run sync` im Modulordner) | esbuild |
| `@jm/app-runtime` | `npm run selftest -w @jm/app-runtime` | `node --experimental-strip-types test/selftest.ts` |
| Typen | `npm run typecheck -w @jm/connect` · `npm run typecheck -w @jm/zoom-bridge` | tsc |
| Bau | `npm run build -w @jm/connect` | electron-vite |
| Bridge nativ (nur Entwicklungs-PC) | `npm run rebuild -w @jm/zoom-bridge` mit `ZOOM_SDK_DIR`, `NDI_SDK_DIR` | CMake/MSVC |
| Handbuch | `npm run cookbook:check` | Wurzel-Skript |

Test-Konventionen wie in 4a:
- Connect: `ck(name, cond)`, `ueberspringe`, Schlusszeile `<pass> ok, <fail> fehlgeschlagen[, <skip> übersprungen].`. Neue Blöcke stehen direkt über `// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──`, mit Kopf `// ── Aufgabe N (4b): … ──`.
- Bridge: `assert(cond, name)`, neue Blöcke vor der Schlusszeile.
- Steuerprotokoll: `eq(actual, expected, msg)` (siehe `packages/suite-control-protocol/test/selftest.ts`); Ausgabe `ok   <Name>` bzw. `FAIL <Name>`, Schluss `ALLE TESTS OK` oder `<n> FEHLER`, ohne Zählzeile. Gezählt wird mit `grep -c "^ok "`.
- Companion: `eq(actual, expected, msg)`; Ausgabe und Zählung wie beim Steuerprotokoll.
- app-runtime: Schluss `<n> passed, <m> failed`.

Bekannter, vorbestehender Wackler (nicht von 4b): Die Gruppe „bridge - gegen die Attrappe“ in `packages/zoom-bridge/test/selftest.ts:852-883` prüft direkt nach `waitFor(inMeeting)`, ohne auf `roster` und `privilege` zu warten. Kommen die Zeilen der Attrappe in zwei Stücken an (beim ersten, kalten Lauf beobachtet), scheitern dort bis zu vier Prüfungen („die Teilnehmerliste ist angekommen“, „die Erlaubnis ist angekommen“, „jedes Ereignis wurde durchgereicht“, „privilege-Ereignis … traegt source“). Ein einzelner Ausreißer in genau dieser Gruppe ist kein Befund der laufenden Aufgabe: einmal neu laufen lassen. Die Ursache (Warten auf `participants.size === 1 && canRecordRaw`) ist ein eigener Nachzug außerhalb von 4b.

Gemessene Zählstände (Windows 11, Node 24.16.0; Ausgang = HEAD `051151d614`, Endstand = alle 21 Aufgaben nachgespielt):

| Lauf | Ausgang | Endstand | zuletzt geändert in |
| --- | --- | --- | --- |
| Bridge `test/selftest.ts` (`  ok`-Zeilen) | 471 | 509 | Aufgabe 2 |
| Bridge `test/auslieferung.test.mjs` (`  ok`-Zeilen) | 31 | 41 | Aufgabe 3 |
| Connect `zoom-text.test.ts` | 529 ok | 772 ok | Aufgabe 8 |
| Connect `zoom-laufzeit.test.ts` | 86 ok | 86 ok | – |
| Connect `zoom-teile.test.ts` | 90 ok | 139 ok | Aufgabe 7 |
| Connect `zoom-kern.test.ts` | 409 ok, 0 übersprungen (31 s) | 578 ok, 0 übersprungen (rund 95 s) | Aufgabe 13 |
| Connect `zoom-settings.test.ts` | 33 ok | 35 ok | Aufgabe 11 |
| Connect `sdk-laden.test.ts` | 79 ok | 83 ok | Aufgabe 19 |
| Connect `control-state.test.ts` | – | 31 ok | Aufgabe 15 (neu) |
| Connect `after-pack.test.mjs` | bestanden | bestanden | – |
| Steuerprotokoll (`ok`-Zeilen) | 41 | 77 | Aufgabe 14 |
| Companion-Modul (`ok`-Zeilen) | 36 | 70 | Aufgabe 16 |
| app-runtime | 15 passed | 43 passed | Aufgabe 17 |
| `npm run cookbook:check` (Windows) | „veraltet“ (rot, CRLF) | „frisch (43 Rezepte)“ | Aufgabe 20 |

## Review Focus

1. **Companion-Taste prellt:** Zwei `CONNECT ZOOM_LOAD Ben` kommen direkt hintereinander, bevor die Bridge `subscribed` meldet. Erwartet: genau **ein** `videoSubscribe` für Ben, keine Quelle „… Ben (2)“, `zoom_cmd=ok`, `zoom_cmd_rejected=0`. Ein offenes Abo zählt als „schon geladen“. → Test in **Aufgabe 13**.
2. **Erlaubnis flattert:** Der Host entzieht und erteilt binnen 0 ms wieder (`FAKE_ERTEILUNG_MS=0`). Reihenfolge wie bei der echten Bridge: `privilege false`, `privilege true`, erst dann der Abbau. Erwartet: Danach läuft jede Soll-Quelle genau einmal, mit unverändertem Ton, ohne „(2)“ und ohne Q8. → Test in **Aufgabe 10**.
3. **Beenden oder Verlassen mitten in einem Versuch:** Connect wird beendet, oder der Bediener verlässt das Meeting, während die Startfolge eines Wiederbeitritts-Versuchs läuft (2. Bridge hängt vor `ready`). Erwartet: keine weitere Bridge, `beenden` kehrt binnen Frist zurück, keine Meldung R2 oder R7. Nach Verlassen: `bereit`, `zoom_alarm=0`. → Test in **Aufgabe 9**.
4. **Vergessen während der Pause:** Der Bediener vergisst oder entlädt eine gemerkte Quelle, während die Erlaubnis entzogen ist oder ein Wiederbeitritt läuft. Erwartet: Nach Wiedererteilung bzw. erfolgreichem Wiederbeitritt kommt genau diese Quelle **nicht** zurück, die anderen schon. → Tests in **Aufgabe 10** (Entzug) und **Aufgabe 8** (Wiederbeitritt).
5. **STATE-Werte mit Sonderzeichen:** Mehrfache Leerzeichen, NBSP, Tab, `%`, `=`, Emoji, leerer Wert. Erwartet: Der Rundweg `formatSuiteState` → `parseSuiteState` ist verlustfrei. Ein leerer Wert bleibt `key=` und wird zu `''`. Zeilen alter Sender ohne Kodierung liest der Parser unverändert. Schlüssel werden nie kodiert. → Test in **Aufgabe 14**.

---

## Dateistruktur

In Klammern die Aufgaben, die eine Datei ändern, in Aufgabenreihenfolge.

**`packages/zoom-bridge`**
- `src/protocol.ts` (geändert, 1): `VideoReason` und `AudioReason` bekommen `'privilegeRevoked'`.
- `test/fake-bridge.mjs` (geändert, 1, 2): Entzug baut ab; neu `FAKE_ERTEILUNG_MS`, `FAKE_VERBINDUNG_ZURUECK_MS`, `FAKE_ABO_VERZOEGERUNG_MS`, `FAKE_PUFFERFEHLER_MS`, `FAKE_NAMENSZEILE` (100 ms nach dem `roster`); NDI-Name „(2)“. Aufgabe 2: das Drehbuch `messy` schreibt zusätzlich eine abgeschnittene `roster`-Zeile.
- `test/selftest.ts` (geändert, 1, 2): Attrappen-Fälle, Quelltext-Wächter für den nativen Teil, kaputte Ereigniszeile ohne Namen im Log.
- `src/bridge.ts` (geändert, 2): eine unlesbare stdout-Zeile, die wie ein Ereignis beginnt, nur mit Länge und Ereignisart ins Log.
- `native/callbacks.cpp`, `native/callbacks.h` (geändert, 2): Merker `g_entzugAbbauOffen` für den Entzugs-Abbau, `callbacksTakePrivilegeRevokedTeardown()`.
- `native/main.cpp` (geändert, 2): Abbau nach `pumpOnce()` und nach dem Meeting-Ende-Block, vor `videoTick()`.
- `native/video.cpp`, `native/video.h` (geändert, 2): `videoPrivilegeRevoked()`, Logzeilen ohne Namen.
- `native/session.cpp`, `native/session.h` (geändert, 2): `sessionStopRawRecording()`.
- `README.md` (geändert, 2 Protokoll und Abschnitte 6/7; 20 Abschnitt 9).
- `package.json` (geändert, 20): nur die Beschreibung.
- `scripts/auslieferung.mjs` (geändert, 3): `sdkNamen` vereinigt, neu `sdkNamenQuellen`.
- `scripts/build-release.mjs` (geändert, 3): Statuszeile aus `sdkNamenQuellen`.
- `test/auslieferung.test.mjs` (geändert, 3; LF und zwei NUL-Bytes, G14).

**`apps/connect`**
- `src/shared/types.ts` (geändert, 4, 18): `ZoomBefehlKennung`, `ZoomBefehlErgebnis`, `ZoomKurz.befehl`, `ZoomSollEintrag.stand` + `'grenze'`, `ZoomAbbild.versatz.nurSitzung`, `ZoomAbbild.abbauLaeuft`; `JmConnectApi.zoomAbbrechen` (18).
- `src/shared/zoom-text.ts` (geändert, 4): `BETRIEBSGROESSE`, `WIEDERBEITRITT_VERSUCHE`, `zoom_cmd*`, Z7/Z7b-Texte für den Entzug (Z7 „Quellen gestoppt“ nur mit gemerkten Quellen), `sdkZeile` mit der Fassung aus dem Abbild, `sollZeile`, `bildText`/`tonText`/`quellenZustandText`, `versatzZeile`, `versatzUebernommen`, `zoomKnoepfe` mit `abbauLaeuft`.
- `src/shared/ipc.ts` (geändert, 18): `zoomAbbrechen`.
- `src/main/zoom/fristen.ts` (neu, 5): Konstanten aus `kern.ts` (Re-Export dort).
- `src/main/zoom/klartext.ts` (geändert, 5; 8 entfernt `UE_*`): R2/R4/R5/R7, `VersuchsAusgang`/`istEndgueltig`, `FT` (F1–F8), `fernLogText`, `quellenFehler` mit `logText`, `maskiereNamen`, `NAME_PLATZHALTER`, Texte aus Konstanten.
- `src/main/zoom/soll.ts`, `src/main/zoom/teilnehmer.ts` (geändert, 6): `plaetze`/Stand `'grenze'`, `ndiVorschau(name, belegt)`, `sollTon`.
- `src/main/zoom/fernsteuerung.ts` (neu, 7): `deuteZoomBefehl`, `ladeZiel`.
- `src/main/zoom/kern.ts` (geändert, 4 und 5 minimal, 8–13): Wiederbeitritt, Entzug, Betriebsgröße, Randfälle, Lognamen, `steuerbefehl`, `abbrechen`.
- `src/utility/ndi-program-receiver.ts`, `src/utility/ndi-guest-sender.ts` (geändert, 12): Logzeilen ohne Quell- und Sendernamen (N4b.2).
- `src/main/control-state.ts` (neu, 15): `mischeState`, `erzeugeStateSpeicher`, `aenderungsMelder`, `RAUM_START`, `leiteSteuerbefehl`.
- `src/main/control-server.ts` (geändert, 15): Raum- und Zoom-Teil, `setZoomControlState`.
- `src/main/zoom.ts` (geändert, 11 Einstellungen; 15 STATE-Push und `zoomSteuerbefehl`; 18 `zoomAbbrechen`-Handler).
- `src/main/settings.ts` (geändert, 11): `setzeZoomVersatzMs` liefert `boolean`, neu `zoomVersatzNurSitzung()`.
- `src/main/index.ts` (geändert, 15): `zoom_*` im `onCommand` über `leiteSteuerbefehl` abzweigen.
- `src/main/zoom/sdk-laden.ts` (geändert, 19): `error`-Zuhörer auf `stderr`, Diagnose in windows-1252.
- `src/preload/index.ts` (geändert, 18): `zoomAbbrechen`.
- `src/renderer/src/zoom/ZoomCard.tsx` (geändert, 18): „Abbrechen“, Nummer leeren, Klartext statt Rohwerten, `sollZeile` (die lokale Renderfunktion heißt jetzt `sollEintrag`), Stand `grenze` gelb, Versatz-Zeile.
- `src/renderer/src/App.tsx` (geändert, 18): Audit-Zeile mit Gast-Kennung statt Namen.
- `package.json` (geändert, 15): `selftest`-Kette um `tsx test/control-state.test.ts` (vor `node test/after-pack.test.mjs`).
- Tests: `test/zoom-text.test.ts` (4, 5, 8), `test/zoom-teile.test.ts` (6, 7), `test/zoom-kern.test.ts` (1, 8–13), `test/zoom-settings.test.ts` (11), `test/sdk-laden.test.ts` (19) geändert; `test/control-state.test.ts` (neu, 15).
- `ABNAHME-0.3.0.md` (neu, 21).

**`packages/suite-control-protocol`** (14)
- `src/index.ts`: `kodiereStateWert`, `dekodiereStateWert`, in `formatSuiteState` und `parseSuiteState`.
- `src/capabilities.ts`: Zoom-Aktionen, -Variablen, -Feedbacks der Rolle `connect`; Kommentar zu `'truthy'`.
- `test/selftest.ts`, `README.md` (STATE-Abschnitt, API-Liste).

**`packages/companion-jm-suite`** (kein Workspace; 16)
- `lib.mjs`: `isTruthy` (positive ganze Zahl).
- `test/selftest.mjs`.
- `generated/protocol.mjs` (neu erzeugt mit `node scripts/sync-companion-protocol.mjs`).
- `package.json`, `companion/manifest.json`: 0.2.0, JM Connect.
- `README.md`: Rolle Connect, Feedback-Regel, Kodierung.

**`packages/app-runtime`** (17)
- `src/log-aufraeumen.ts` (neu): Löschfrist, erst den Kopf lesen, `KUERZEN_MAX_BYTES`.
- `src/index.ts`: Aufruf beim Start und alle 6 h.
- `test/selftest.ts`.

**`packages/cookbook`** (20)
- `src/build.mjs`: liest CRLF wie LF (sonst ist `cookbook:check` unter Windows immer rot).
- `content/tool-manuals/tool-jm-connect.md` (neu).
- `cookbook.json` (neu erzeugt mit `npm run cookbook:build`).

**Wurzel und Doku**
- `.github/workflows/ci-checks.yml` (16): vier Schritte im Job `selftests`.
- `scripts/sync-companion-protocol.mjs` (16): `absWorkingDir` auf die Repo-Wurzel.
- `docs/roadmap.md` (20).

Bewusst unverändert: `apps/rundown/**`, `packages/zoom-bridge/CMakeLists.txt`, `packages/zoom-bridge/cli/**` (geprüft: `steuerung.mjs` zählt keine Gründe wörtlich auf, Aufgabe 1), `apps/connect/electron-builder.yml`, `apps/connect/tools/*` (auch die Statuszeile in `bundle-zoom-bridge.mjs:66`, offener Punkt O3).

## Bewusst NICHT in diesem Plan

- OAuth/OBF für Meetings fremder Konten (N4b.4, Branch `spike/zoom-obf`).
- Release, Versionssprung von Connect, Changelog, `suite.json`, `bump-manifest`, Tag, Proxy-Deploy, Katalog, Anhängen der Modul-`.tgz` (N4b.4, G19). Siehe „Nach der Umsetzung (nur Controller und Owner)“ am Ende.
- 17.2 Nr. 1 (`connected` wird nie gepusht), Nr. 4 (Tray „Raum schließen“), Nr. 7 (Ballast in der `app.asar`): eigene Issues, wie in der Spec.
- Rundown-Release (11.5).
- Textdubletten zwischen `ZoomCard.tsx` und `klartext.ts` (TEXT_S10, Q11, Q13, Q14, Q15; 4a-Ledger K8) und die reine Funktion `trayEintraege`: nicht im Owner-Katalog N4b.3. Die Karte zieht in Aufgabe 18 nur `sollZeile` um.
- Weitere minors aus dem 4a-Ledger ohne N4b.3-Bezug: Drossel mit `Date.now()`, `pruefen()` ohne try/finally, `catch {}` um init/auth, ignorierte Rückgabe von `sende(join)`, `endeMeldung` ohne `detail`, `kindPfad` mit `PATH=''`.

## Entscheidungen des Plans, die die Spec nicht wörtlich trägt (bitte prüfen)

Die Aufgaben verweisen auf diese Liste mit „L<n>“.

- **L1** Neuer Abbau-Grund `privilegeRevoked` für Bild **und** Ton (N4b.1: „Die Form legt der Plan fest“).
  - Die Bridge baut **außerhalb** des Rundrufs `onRecordPrivilegeChanged` ab. Der Rundruf setzt nur einen Merker; `main.cpp` arbeitet ihn direkt nach `pumpOnce()` ab, vor `videoTick()`. Das ist das Muster des Meeting-Endes, siehe den gemessenen Absturz 0xC0000005 bei `unSubscribe()` aus dem Rundruf (`native/main.cpp:398-412`).
  - Reihenfolge des Abbaus: `audioClearSubscribed()`, dann `videoPrivilegeRevoked()` = `videoAbbauAlle("privilegeRevoked", true)` (meldet Ton vor Bild ab, schließt die NDI-Sender), dann `sessionStopRawRecording()`. Das Merkzeichen der Rohdaten-Aufnahme wird immer zurückgesetzt, damit das nächste Abo nach der Wiedererteilung `StartRawRecording` neu ruft.
  - Ob das SDK die Lieferung selbst stoppt und ob `StopRawRecording`/`StartRawRecording` nach einem Entzug fehlerfrei laufen, ist ungemessen (**M18**, Abnahme).
- **L2** Die Attrappe bildet die Reihenfolge der echten Bridge nach:
  - Beim Entzug geht `privilege false` sofort hinaus, der Abbau folgt einen Takt später (`setImmediate`).
  - Mit `FAKE_ERTEILUNG_MS=0` geht `privilege true` synchron direkt nach `privilege false` hinaus, **vor** dem Abbau. So verhält sich die Bridge, wenn beide Rundrufe in derselben Pumprunde kommen.
- **L3** R5 erscheint erst nach dem ersten Abgleich mit Erlaubnis `'ja'` nach einem erfolgreichen Wiederbeitritt.
  - `k` = in diesem Abgleich abonnierte Einträge, `d` = danach offene Soll-Einträge, die auf eine eindeutige Person warten (Stand `wartet`, `doppelname`, `verwaist`). Einträge mit Stand `grenze` (L7) zählen **nicht** in `d`: Sie warten auf keine Person, sondern auf einen Platz, und stehen mit eigenem Text unter „Gemerkte Quellen“ (Nachbesserung; ob R5 sie eigens nennen soll, entscheidet der Owner, O4).
  - Kommt die Erlaubnis nie, gibt es kein R5; Z6/Z7 sagen es.
  - Singular wie L6 aus 4a: „1 Quelle neu geladen“, „1 wartet auf eine eindeutige Person“.
- **L4 (Abweichung von der Spec, Owner entscheidet: O4)** `ended` während eines Versuchs (Z11) ist ein Meeting-Ende nach 6.5 (R6, `bereit`, Soll-Liste leer). Die Spec regelt den Fall anders: Die Einordnung 6.4 zählt „jedes `ended`“ als endgültig, Schritt 2.4 gibt einem endgültigen Ausgang im Versuch den Vorsatz „Wiederbeitritt abgebrochen: “ (Zustand `fehler`, Soll-Liste bleibt), und 6.5 sowie die Auslöser-Tabelle nennen das Meeting-Ende nur für Z10. Der Plan weicht ab, weil ein beendetes Meeting kein abgebrochener Wiederbeitritt ist: Wörtlich stünde „Wiederbeitritt abgebrochen: Meeting beendet: vom Gastgeber beendet.“ in der Karte, und „Erneut beitreten“ lüde danach eine Soll-Liste in ein neu gestartetes Meeting. `statusEreignis` behandelt `ended` in `abriss` schon heute so; Z11 ist ebenfalls `abriss`. Kern-Fall „L4: ended während eines Versuchs …“ (Aufgabe 8) hält das Verhalten fest.
- **L5** Einordnung (6.4), wo die Spec schweigt:
  - Fehler `where:'init'` (B8) und Fehler `where:'join'` mit SDK-Code (CJ) sind endgültig.
  - Ein DLL-Tod in einem Versuch folgt der Spec (6.4 Schritt 2.4): `fehler` mit „Wiederbeitritt abgebrochen: “ + B3–B5. (Die erste Fassung nahm ihn vom Vorsatz aus; nachgebessert, Kern-Fall „DLL-Tod in einem Versuch …“ in Aufgabe 8.)
  - `exited` ohne DLL-Code ist vorübergehend.
  - Ein vorübergehender Fehler beendet den Versuch mit `stop()` der Versuchs-Bridge; danach wird der nächste Versuch geplant.
- **L6** Der Merker `warImMeeting` entfällt. Die Regel aus Ergänzung 0.10 tragen die Zustände: Auslöser gelten nur in `im_meeting` und `abriss` (6.4), und dorthin kommt man nur über ein `inMeeting`.
- **L7** Betriebsgröße:
  - „Belegt“ = bestätigte Quellen der aktiven Generation plus offene Abos (`aboFristen`), ohne Doppelzählung. Das gilt für `laden()` (Q9) und den Abgleich.
  - Der Abgleich lädt nur bis 5. Ein Eintrag ohne Platz bekommt den Stand `'grenze'`, zählt in `sollOffen` und hält damit `zoom_alarm=1`. Vor jedem geplanten Abo prüft der Abgleich die freien Plätze neu, weil in der Wartezeit eines Neu-Ladens ein Laden von Hand oder per Companion einen Platz belegen kann (Nachbesserung).
  - Ein gesendetes, noch unbestätigtes Abo gilt im Abgleich als verbunden (sonst abonnierte er es doppelt, Review Focus 1), im Abbild, in `sollOffen` und für `zoom_alarm` aber als offen (Stand `wartet`), bis `subscribed` kommt oder Q8 (Spec 4, 7.5; Nachbesserung in Aufgabe 13).
  - Laden von Hand bleibt mit Q9 möglich (zweiter Klick), die Fernsteuerung lädt mit F8 auch über 5 (Spec 11.2).
  - Reihenfolge der Plätze: Einfügereihenfolge der Soll-Liste.
- **L8** STATE-Kodierung (17.2 Nr. 3):
  - `formatSuiteState` kodiert in String-Werten jeden Leerraum (`/\s/u`) und `%` als `%XX` (UTF-8). `parseSuiteState` dekodiert Folgen von `%XX`; ungültige Folgen bleiben wörtlich. Zahlen und Booleans sind unverändert.
  - Alle Leser laufen über `parseSuiteState`: Companion (`generated/protocol.mjs`), `client.ts` (Rundown, Launcher/Health).
  - Alte Leser sehen `Anna%20Maria` statt eines abgeschnittenen `Anna`.
  - Befehlszeilen werden nicht kodiert (Spec 0.5: Connect fügt die Argumente mit einem Leerzeichen zusammen).
- **L9** Companion `isTruthy` (17.2 Nr. 2): wahr bei `'1'`, `'an'`, `'true'` **oder einer positiven ganzen Zahl** (`/^[1-9]\d*$/`), also „Anzahl > 0“ ohne neue Variablen. Das gilt für alle truthy-Feedbacks; alle anderen führen heute nur `1`/`0` (`capabilities.ts`, nachgelesen).
- **L10** Löschfrist 14 Tage, zeilengenau (N4b.2). **Owner-Freigabe vor Aufgabe 17 nötig (O11):** N4b.2 sagt nur „Logdateien, die älter als 14 Tage sind, werden gelöscht“; das zeilengenaue Kürzen laufender Dateien geht darüber hinaus und gilt für alle 25 Apps. Lehnt der Owner es ab, bleibt von Aufgabe 17 das Löschen nach `mtime` (Abschnitt „Offene Punkte“, O11).
  - Eine Datei mit `mtime` älter oder gleich 14 Tage wird gelöscht.
  - Eine Datei mit jüngerer `mtime`, deren erste Zeile älter als 14 Tage ist, wird gekürzt: Es bleiben die Zeilen ab der ersten Zeile mit Zeitstempel innerhalb der Frist; Folgezeilen ohne Zeitstempel gehören zur Zeile davor. Geschrieben wird in eine Hilfsdatei, dann umbenannt.
  - Grund: Eine täglich genutzte App erreicht nie 5 MB und rotiert nie. Mit einer Prüfung nur nach Dateialter stünden ihre Zeilen sonst für immer im Log.
  - Wann: beim Start vor dem ersten Schreiben und danach alle 6 h (`unref`).
  - Welche Dateien: nur `main.log*`, `renderer.log*` und `last-crash.json` (diese nach `mtime`).
  - Fehler: je Datei abgefangen (EBUSY, EPERM, ENOENT), nie geworfen; eine `mtime` in der Zukunft wird nie gelöscht.
  - Kosten (Nachbesserung): zuerst nur 64 KB vom Dateianfang; ganz gelesen wird nur eine Datei mit alter erster Zeile und höchstens bis 10 MB (`KUERZEN_MAX_BYTES`), sonst `ZU_GROSS` im Bericht.
- **L11** Logzeilen ohne Namen:
  - Hinweise haben einen eigenen Logtext: Q16/Q17 mit Teilnehmer-Kennung, F1–F8 als `Companion: F3 (zoom_load)`.
  - Bridge-Zeilen laufen durch `maskiereNamen` über alle Namen, die der Kern in dieser Programmsitzung gesehen hat (Teilnehmer und Soll; nur im Arbeitsspeicher, beim Beenden geleert).
  - Der eigene Anzeigename bleibt im Log (Spec 8.7 „Beitritt gestartet (Anzeigename …)“; Bediener, kein Teilnehmer).
  - Die Audit-Zeile für Browser-Gäste (`App.tsx:341`) nennt die Gast-Kennung statt des Namens.
  - Nachbesserung, gefunden im Review: Die Utility-Prozesse schreiben über `ndi-program.ts` und `ndi-guests.ts` ins `main.log`. Der Programm-Empfänger nennt nur fremde NDI-Quellen und von JM Connect die Anzahl, der Gast-Sender seinen Namen nicht mehr (Aufgabe 12). `src/bridge.ts` gibt eine unlesbare Ereigniszeile nur mit Länge und Ereignisart weiter (Aufgabe 2).
- **L12** Meeting-Ende: Mit `ended` gelten die Quellen der aktiven Generation sofort als weg (`n = 0` in Z2, Spec 7.1). Die Bridge baut sie ohnehin selbst ab (`videoMeetingEnded`).
- **L13** S10 gilt auch, solange eine gestoppte Bridge abbaut (`stopps.size > 0`). Das Abbild führt `abbauLaeuft`, damit die Karte gleich sperrt.
- **L14** Versatz nur für die Sitzung (N4b.3 Nr. 4):
  - `einstellungen.setzeVersatzMs` liefert `boolean`.
  - Die Antwort ist `{ ok: false, text: TEXT_A4_SCHREIBFEHLER }` (Muster „Entfernen“, `kern.ts:714-725`). `videoDelay` geht trotzdem hinaus.
  - `abbild.versatz.nurSitzung` zeigt es in der Karte dauerhaft. Ob die Karte eine Antwort übernimmt, entscheidet der reine Helfer `versatzUebernommen` (Aufgabe 4, getestet).
  - Über die Fernsteuerung ist das `zoom_cmd=ok`.
- **L15** Hinweise leeren sich bei `beitreten()` (eingegebene Daten), nicht bei `erneut()`.
- **L16** Texte aus Konstanten (N4b.3 Nr. 8): `fristen.ts` im Main, `BETRIEBSGROESSE` und `WIEDERBEITRITT_VERSUCHE` in `shared/zoom-text.ts`, damit die Karte sie ohne Main-Import nutzen kann. `fristen.ts` reicht `BETRIEBSGROESSE` weiter.
- **L17** Die native Bridge wird nur am Entwicklungs-PC (SDK + Visual Studio) gebaut. Fehlt der Bau, meldet der Implementierer von Aufgabe 2 `DONE_WITH_CONCERNS`, und der Controller baut. Belegt ist das native Verhalten erst durch die Abnahme 0.3.0. Die Quelltext-Wächter (Aufgabe 2) sichern nur die Struktur.
- **L18** Versionen: Connect bleibt im Plan auf der Version im Arbeitsbaum (der Sprung auf 0.3.0 gehört zum Release). Das Companion-Modul geht auf 0.2.0 (Spec 17.3: das erste Release mit Moduländerung liefert 0.2.0; Master-Link 2b hat das Modul nicht angefasst, Ist-Karte Fernsteuerung).
- **L19** Unter macOS beantwortet die Hülle jedes `zoom_*` nur mit einer Logzeile; die `zoom_*`-Schlüssel fehlen im STATE (Spec 7.5, 11.2).
- **L20** `control-state.ts` hält neben `mischeState` den Zwischenstand (`erzeugeStateSpeicher`) und den Melder „nur bei Änderung“ (`aenderungsMelder`). So prüft `control-state.test.ts` „Raum-Push lässt `zoom_*` stehen“ im Ablauf. `control-server.ts` importiert Electron; der Test lädt die echte Datei trotzdem, mit Attrappen für `electron` und `@jm/suite-control-protocol/server` über `registerHooks` (Aufgabe 15, Abweichung 1; Montage MO5). Die Weiche „`zoom_*` an die Zoom-Hülle, alles andere an den Renderer“ liegt als reine Funktion `leiteSteuerbefehl` ebenfalls dort und ist getestet (Nachbesserung).
- **L21** Die Tests der reinen Fernsteuer-Funktionen stehen in `zoom-teile.test.ts`. Neue Datei in der `selftest`-Kette ist nur `control-state.test.ts` (Spec 10.2).
- **L22** Doppelname-Vorschau: Ist eine gleichnamige Person schon geladen, zeigt die Vorschau der zweiten „… (2)“ (Abbild von `uniqueSourceName`, `native/video.cpp:188-201`). Die Attrappe vergibt „(2)“ jetzt ebenso.
- **L23** Neue Messungen: **M18** (Entzug: stoppt das SDK selbst? laufen Abmelden, `StopRawRecording` und nach der Wiedererteilung `StartRawRecording` fehlerfrei?) und **M19** (legt das SDK trotz abgeschalteter Logs Dateien unter `%APPDATA%` an?). Beide gehören in die Abnahme 0.3.0.

## Texttabelle 4b

Aus der Spec wörtlich (8.5, 8.6):

| ID | Wo | Text |
| --- | --- | --- |
| Vorsatz | Meldung | `Wiederbeitritt abgebrochen: ` (existiert schon als `VORSATZ.wiederbeitritt`, `klartext.ts:17-21`) |
| R2 | Meldung (fehler) | „Wiederbeitritt gescheitert ({letzter Grund}). „Erneut beitreten“ versucht es noch einmal.“ — {letzter Grund} = Text der letzten Versuchsmeldung **ohne** Schlusspunkt |
| R4 | Hinweis | „Die Zoom-Bridge ist abgestürzt ({detail}). Connect tritt neu bei.“ |
| R5 | Hinweis | „Wieder im Meeting. {k} Quellen neu geladen, {d} warten auf eine eindeutige Person.“ (Singular L3; `d` ohne Stand `grenze`, L3) |
| R7 | Meldung (fehler) | „Wiederbeitritt abgebrochen.“ |
| F1–F8 | Hinweis | Spec 8.6 wörtlich, jeweils mit Vorsatz „Companion: “ |

Neu (Plan-Vorschlag, Owner prüft):

| Wo | Text |
| --- | --- |
| Z7 bei `entzogen` mit gemerkten Quellen (`sollOffen` > 0), Tray und Kopfzeile | `△ Zoom: Aufnahme-Erlaubnis vom Host entzogen, Quellen gestoppt` |
| Z7 bei `entzogen` mit gemerkten Quellen, Karte | „Aufnahme-Erlaubnis vom Host entzogen, Quellen gestoppt. Erteilt der Host sie im Zoom-Client wieder, lädt Connect die gemerkten Quellen von selbst.“ |
| Z7 bei `entzogen` ohne gemerkte Quelle (`sollOffen` = 0) | unverändert aus 4a: Tray `△ Zoom: im Meeting ohne Aufnahme-Erlaubnis`, Karte „Im Meeting ohne Aufnahme-Erlaubnis. Der Host hat sie entzogen. …“ (Spec 7: kein „Quellen gestoppt“, wenn keine lief oder alle vergessen sind) |
| Z7b bei `entzogen` (n > 0, nur solange die Bridge abbaut), Karte | „Aufnahme-Erlaubnis vom Host entzogen. Connect stoppt {n} Quellen …“ (Singular „1 Quelle“) — Tray-Zeile Z7b bleibt `△ Zoom: {n} Quellen, Aufnahme-Erlaubnis fehlt` |
| Gemerkte Quelle, Stand `grenze` | „{Name} — nicht automatisch geladen (mehr als 5 Zoom-Quellen), bitte von Hand laden“ |
| Gemerkte Quelle, Stand `erlaubnis` (Owner 08.10.2026) | „{Name} — wartet auf die Aufnahme-Erlaubnis“ |
| Gemerkte Quelle, Stand `laedt` (Owner 08.10.2026) | „{Name} — wird geladen …“ |
| Gemerkte Quelle, Stand `wiederbeitritt` (Owner 08.10.2026; Connect nicht im Meeting, Vorrang vor allen anderen Ständen) | „{Name} — wartet auf den Wiederbeitritt“ |
| Versatz nur Sitzung (Antwort und Karte) | `TEXT_A4_SCHREIBFEHLER` = „Nur für diese Sitzung gemerkt — die Einstellungsdatei ließ sich nicht schreiben.“ (vorhanden, `zoom-text.ts:16`) |
| Bild der Quelle (`bildText`) | `subscribed` „Bild: erstes Bild steht aus“ · `live` „Bild läuft“ · `black`+`cameraOff` „Bild schwarz: Kamera aus“ · `black`+`participantLeft` „Bild schwarz: Person weg“ · `black`+`bufferMismatch` „Bild schwarz: fehlerhafte Bilder“ · `black`+jeder andere Grund „Bild schwarz: kein Bild von Zoom“ |
| Ton der Quelle (`tonText`) | `'aus'` „ohne Ton“ · `waiting` „Ton: wartet auf das erste Paket“ · `live` „Ton läuft“ · `silent` „Ton: Stille“ · `off`+`audioUnavailable` „Ton nicht verfügbar“ · `off`+`participantLeft` „Ton aus: Person weg“ · `off` sonst „Ton aus“ |
| Log Q16 | `Bild: fehlerhafte Bilder von Teilnehmer {id} verworfen (videoBufferMismatch).` |
| Log Q17 | `Ton: ein fehlerhaftes Paket von Teilnehmer {id} verworfen (audioBufferMismatch).` |
| Log Fernsteuerung | `Companion: {KENNUNG} ({verb})`, z. B. `Companion: F3 (zoom_load)`, `Companion: OK (zoom_delay)`. Ein ausgeführter Befehl ohne Hinweis loggt `[zoom] Companion: OK (zoom_load)`, ein abgelehnter (und F8) über den Hinweis `[zoom] Hinweis: Companion: F2 (zoom_load)` (Aufgabe 13). Ohne Kern: `[zoom] Companion: {verb} ignoriert (Zoom gibt es nur unter Windows)` bzw. `… (der Zoom-Kern ließ sich nicht anlegen)`; ein Fehler: `[zoom] Fernsteuer-Befehl fehlgeschlagen: {Meldung}` (Aufgabe 15). |
| Namensplatzhalter | `‹Name›` |
| Kern-Log Wiederbeitritt | `[zoom] Wiederbeitritt: Versuch {i} von 5 in {s} s` · `[zoom] Wiederbeitritt: Versuch {i} gescheitert nach {ms} ms (endgültig|vorübergehend)` · `[zoom] Wiederbeitritt: Versuch {i} erfolgreich nach {ms} ms` · `[zoom] Wiederbeitritt abgebrochen` |
| Kern-Log Entzug | `[zoom] Quelle {id} gestoppt (Entzug)` · `[zoom] Abgleich: {n} gemerkte Quellen über der Betriebsgröße, nicht geladen` (auch bei n = 1 im Plural, offener Punkt O5) |
| app-runtime | `[runtime] Logs aufgeräumt: {g} gelöscht, {k} gekürzt (Frist 14 Tage)` (nur wenn etwas geschah) · `[runtime] Log-Aufräumen: {datei} ({code})` (warn; `{code}` = `ZU_GROSS`, wenn eine Datei mit alter erster Zeile größer als 10 MB ist und darum nicht gekürzt wird) |
| Bridge, TypeScript (`onLog`) | `unlesbare Zeile ({n} Zeichen, beginnt mit {"ev":"{art}")` bzw. `… beginnt mit {)` für eine kaputte Ereigniszeile; fremde Zeilen des SDK weiter `unlesbare Zeile: {zeile}` (Aufgabe 2) |
| NDI-Utility-Prozesse | `[ndi-program-receiver] Hinweis „{hinweis}" nicht gefunden. Gesehene NDI-Quellen: {fremde Quellen} (dazu {n} von JM Connect, ohne Namen)` · `[ndi-guest-sender] NDI-Sender aktiv.` (Aufgabe 12) |
| Bridge nativ | `Entzug: Abbau angemeldet, laeuft nach pumpOnce()` · `Entzug: Ton-Abo abmelden (ausserhalb des Rueckrufs)` · `Entzug: Bild-Abos abbauen` · `Entzug: Rohdaten-Aufnahme beenden` · `Entzug: StopRawRecording() meldet SDKError={n}` bzw. `Entzug: StopRawRecording() nicht gerufen - der Rohdaten-Schalter lag nicht` bzw. `Entzug: StopRawRecording() nicht moeglich - kein Aufnahme-Regler` · `Wiederbeitritt {id}: Name ist nicht eindeutig ({t} Teilnehmer, {a} Abos) - kein Umhaengen, die Quelle bleibt schwarz.` · `Wiederbeitritt {id}: kein Abo gehoert zu diesem Gast - kein Umhaengen.` (Aufgabe 2) |


## Schnittstellen zwischen den Aufgaben (Kurzliste)

Gegen diese Namen baut jede Aufgabe. Die genaue Form steht im Block „Interfaces“ der jeweiligen Aufgabe; bei der Montage sind alle zusammen nachgespielt und mit beiden Typechecks geprüft.

- **Aufgabe 1 → 2, 4, 8–13:**
  - Grund `'privilegeRevoked'` in `VideoReason` und `AudioReason`.
  - Attrappen-Stellschrauben `FAKE_ENTZUG_MS` (baut jetzt ab), `FAKE_ERTEILUNG_MS`, `FAKE_VERBINDUNG_ZURUECK_MS`, `FAKE_ABO_VERZOEGERUNG_MS`, `FAKE_PUFFERFEHLER_MS` (ab `subscribed`), `FAKE_NAMENSZEILE` (100 ms nach dem `roster`).
  - NDI-Name „… (2)“ in der Attrappe.
- **Aufgaben 4–7 → 8–18:**
  - `types.ts`: `ZoomBefehlKennung`, `ZoomBefehlErgebnis`, `ZoomKurz.befehl`, Stand `'grenze'`, `ZoomAbbild.versatz.nurSitzung`, `ZoomAbbild.abbauLaeuft`.
  - `zoom-text.ts`: `BETRIEBSGROESSE`, `WIEDERBEITRITT_VERSUCHE`, `ZoomStateKv.zoom_cmd`/`zoom_cmd_rejected`, `sollZeile`, `bildText`, `tonText`, `quellenZustandText`, `versatzZeile`, `versatzUebernommen` (für Aufgabe 18).
  - `fristen.ts`: `ZOOM_FRISTEN`, `WIEDERBEITRITT_PLAN_S` u. a. (Re-Export über `kern.ts`; `kern.ts` importiert `WIEDERBEITRITT_PLAN_S` erst in Aufgabe 8 lokal).
  - `klartext.ts`: `KT.R2/R4/R5/R7`, `VersuchsAusgang`, `istEndgueltig`, `ENDGUELTIGE_FAIL_CODES`, `FT`, `fernLogText`, `quellenFehler(…).logText`, `maskiereNamen`, `NAME_PLATZHALTER`.
  - `soll.ts`: `sollAbbild`/`sollHandlungen` mit `plaetze`. `teilnehmer.ts`: `ndiVorschau(name, belegt)`, `baueTeilnehmer({ …, sollTon })`.
  - `fernsteuerung.ts`: `deuteZoomBefehl`, `ladeZiel`.
- **Aufgaben 8–13 → 15, 18:**
  - `ZoomKern.abbrechen(): void` (Aufgabe 9) und `ZoomKern.steuerbefehl(cmd: { verb: string; args: string[] }): void` (Aufgabe 13).
  - `ZoomKernAbhaengigkeiten.wiederbeitrittPlanMs?` (Aufgabe 8).
  - `einstellungen.setzeVersatzMs(ms): boolean` und `einstellungen.versatzNurSitzung(): boolean` (Aufgabe 11), dazu in `settings.ts` `setzeZoomVersatzMs(ms): boolean` und `zoomVersatzNurSitzung(): boolean`. `zoom.ts:72` wird in Aufgabe 11 zu
    ```ts
            setzeVersatzMs: setzeZoomVersatzMs,
            versatzNurSitzung: zoomVersatzNurSitzung,
    ```
- **Aufgaben 14–16:** Aufgabe 14 liefert `kodiereStateWert`/`dekodiereStateWert` und die Capabilities. Aufgabe 15 liefert `setZoomControlState`, `zoomSteuerbefehl` und die Weiche `leiteSteuerbefehl`. Aufgabe 16 erzeugt das Modul neu und setzt die CI-Schritte.
- **Aufgaben 17–21:** Aufgabe 18 nutzt die Aufgaben 4 (`versatzUebernommen`, `sollZeile`, `quellenZustandText`, `versatzZeile`), 9 und 11. Die Aufgaben 17 und 19 sind unabhängig. Die Aufgaben 20 und 21 beschreiben das Ergebnis aller Aufgaben.

Dateien, die mehrere Aufgaben berühren, alle nacheinander in Aufgabenreihenfolge:
- `kern.ts`: 4 (nur `kurz()`/`abbild()`), 5 (nur die Konstanten, HEAD-Zeilen 85–101) → 8–13.
- `zoom.ts`: 11 (Einstellungen, HEAD-Zeile 72) → 15 (`startZoom`, neuer Export) → 18 (`registriereKanaele`).
- `types.ts`: 4 (Zoom-Typen) → 18 (`JmConnectApi`).
- `zoom-text.test.ts`: 4 → 5 → 8 (entfernt nur die beiden `UE_*`-Zeilen, nach Aufgabe 5 Zeilen 518–519).
- `zoom-kern.test.ts`: 1 (Fall 10b, eine Prüfung) → 8–13. Aufgabe 4 berührt die Datei nicht mehr (Nachbesserung: Z7 ohne gemerkte Quelle behält den alten Text).
- `packages/zoom-bridge/test/selftest.ts` und `test/fake-bridge.mjs`: 1 → 2. `packages/zoom-bridge/README.md`: 2 (Protokoll) → 20 (Abschnitt 9).
- `apps/connect/src/utility/*.ts`: nur 12.

---

## Aufgaben

Reihenfolge: 1 → 21. „Aufgabe N“ im Text ist die Überschrift „Task N“. Jede Aufgabe baut gegen den Stand nach allen vorigen; ihre Vorher-Ausschnitte setzen diesen Stand voraus und kommen dort je genau einmal vor (bei der Montage nachgespielt). Zeilenangaben sind Orientierung, maßgeblich ist immer der wortgleiche Vorher-Text. Abhängigkeiten, die nicht aus der Nummer folgen: keine. Die Aufgaben 8–13 laufen streng nacheinander (alle in `kern.ts` und `zoom-kern.test.ts`).

---

### Task 1: Bridge: Grund `privilegeRevoked`, Attrappe für Entzug, Wiedererteilung, Rückkehr, verzögertes Abo, „(2)“, Pufferfehler

**Spec:** `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md` Nachtrag N4b.1 („Die Attrappe bekommt Stellschrauben für Entzug und Wiedererteilung während laufender Abos“), N4b.2 (Prüfstand „keine Namen im Log“), N4b.3 Nr. 1 (Doppelname „(2)“), Nr. 7 (offenes Abo), Nr. 8 („ein Test für abriss → im_meeting“), 12.1 Nr. 4, 3.2-12 (NDI-Name „ (2)“), 3.2-22 (Pufferfehler je Abo einmal), 3.2-23 (Entzug als `privilege` `broadcast`). Plan-Entscheidungen L1, L2, L22.

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\zoom-4b` (Branch `feat/zoom-stage4b`). Alle Pfade unten relativ dazu.

**Files:**
- Modify: `packages/zoom-bridge/src/protocol.ts`
  - Zeilen 72–73 (Ende von `VideoReason`)
  - Zeilen 106–108 (Ende von `AudioReason`)
- Modify: `packages/zoom-bridge/test/fake-bridge.mjs`
  - Zeilen 174–181 (Kopfliste der Stellschrauben: `FAKE_ENTZUG_MS` bis `FAKE_RUECKKEHR_NAME`)
  - Zeilen 206–217 (`abos`, `abbauen`)
  - Zeilen 232–249 (`roster`, Erlaubnis, Entzug in `imMeetingAnkommen`)
  - Zeilen 318–324 (`FAKE_VERBINDUNG_HAENGT_MS`)
  - Zeilen 397–410 (`videoSubscribe`, `videoUnsubscribe`)
- Test: `packages/zoom-bridge/test/selftest.ts`
  - Zeilen 2227–2242 (`fahreSteuerung` bekommt den Parameter `zeilen`)
  - neuer Block „Attrappe — Stage 4b“ direkt vor der Schlusszeile (Zeile 2398)
- Test: `apps/connect/test/zoom-kern.test.ts`
  - Zeile 1212 (Fall 10b hält das 4a-Verhalten fest; Step 13, Entscheidung der Montage MO1)
- Unverändert (geprüft): `packages/zoom-bridge/cli/steuerung.mjs` zählt keine Gründe wörtlich auf (druckt `${ev.reason}` und prüft nur `rebound`/`reboundByName`, Zeilen 445–460 und 587); `src/state.ts` entfernt jedes `video … unsubscribed` und jedes `audio … off` ohne Blick auf den Grund (Zeilen 254 und 303).

Zeilenangaben gelten für den Stand vor dieser Aufgabe. Innerhalb der Aufgabe verschieben frühere Steps die Zeilen späterer Steps derselben Datei; maßgeblich ist immer der wortgleiche Vorher-Text (in der Kopie je genau einmal vorhanden, gemessen).

**Interfaces:**
- Consumes: keine.
- Produces (für Aufgaben 2, 4, 8–13 verbindlich):
  ```ts
  // packages/zoom-bridge/src/protocol.ts
  export type VideoReason = 'command' | 'frames' | 'cameraOff' | 'participantLeft' | 'rebound' | 'bufferMismatch' | 'meetingEnded' | 'reboundByName' | 'privilegeRevoked';
  export type AudioReason = 'command' | 'audioUnavailable' | 'packets' | 'gap' | 'participantLeft' | 'meetingEnded' | 'rebound' | 'reboundByName' | 'privilegeRevoked';
  ```
  ```text
  Attrappe, Drehbuch FAKE_SCRIPT=steuerung (Namen exakt so):
    FAKE_ENTZUG_MS (geaendert)  so lange nach privilege canRecordRaw:true (die kommt 50 ms nach inMeeting)
          und nur, solange die Attrappe im Meeting ist: canRecordRaw=false, SOFORT
          { ev:'privilege', canRecordRaw:false, source:'broadcast' }, dann in setImmediate der Abbau:
          je Abo (Einfuegereihenfolge) { ev:'audio', state:'off', reason:'privilegeRevoked' } (nur bei
          bestelltem Ton und schon gemeldetem subscribed) direkt vor
          { ev:'video', state:'unsubscribed', reason:'privilegeRevoked' }. Danach keine Abos mehr;
          videoSubscribe -> error videoNoPrivilege (bis zur Wiedererteilung).
    FAKE_ERTEILUNG_MS (neu, nur mit FAKE_ENTZUG_MS)  so lange nach privilege false: canRecordRaw=true und
          { ev:'privilege', canRecordRaw:true, source:'broadcast' } (nur im Meeting). '0' = synchron direkt
          nach privilege false, also VOR dem Abbau (L2): Leitung = privilege false, privilege true,
          dann audio off/unsubscribed. Abgebaut wird auch bei '0'.
    FAKE_VERBINDUNG_ZURUECK_MS (neu, nur mit FAKE_VERBINDUNG_HAENGT_MS)  so lange nach reconnecting (nur im
          Meeting): status connecting, status inMeeting, roster (dieselben Teilnehmer und Kennungen),
          privilege source:'check' (canRecordRaw:true, falls erteilt; sonst canRecordRaw:false requested:true)
          - wie das Original bei JEDEM inMeeting. Abos bleiben, kein video-Ereignis.
    FAKE_ABO_VERZOEGERUNG_MS (neu)  videoSubscribe legt das Abo sofort an (zaehlt fuer
          videoAlreadySubscribed und fuer die Namensvergabe " (2)"), video subscribed und das folgende
          audio waiting/off kommen erst nach der Frist. videoUnsubscribe oder ein Abbau davor:
          nur { ev:'video', state:'unsubscribed', reason:'command' | <Abbaugrund> }, KEIN audio off,
          und subscribed kommt nie.
    FAKE_PUFFERFEHLER_MS (neu)  so lange nach video subscribed je Abo genau einmal
          { ev:'error', where:'video', code:'videoBufferMismatch', id }, bei laufendem Ton dazu
          { ev:'error', where:'audio', code:'audioBufferMismatch', id }. Das Abo bleibt bestehen.
    FAKE_NAMENSZEILE=1 (neu)  100 ms nach dem ersten roster eine stderr-Zeile
          "Namensprobe: Anna, Ben" (alle fremden Teilnehmer, ", "-getrennt; bei FAKE_TEILNEHMER=2).
          Der Abstand ist tragend: stdout und stderr sind zwei Leitungen; ohne ihn kann die Zeile
          beim Kern ankommen, bevor er den roster gelesen hat (Aufgabe 12).
    NDI-Name (neu, wie uniqueSourceName, native/video.cpp:188-201)  traegt ein EIGENES Abo
          "JM Connect – Zoom <Name>" schon (exakter Vergleich), heisst das neue "… (2)", "… (3)" usw.;
          ist der Name wieder frei, bekommt das naechste Abo ihn ohne Zusatz.
    Unveraendert: alle uebrigen Stellschrauben und Drehbuecher. "live" sendet das Drehbuch steuerung
          weiterhin NICHT (Bild bleibt "subscribed").
  ```

**Regeln für diese Aufgabe:** G1 (`FAKE_SDK_FASSUNG` bleibt unberührt), G5 und G12 (Namen nur aus der Attrappe), G13, G14 (alle drei Dateien haben CRLF: Edit-Werkzeug mit exaktem Vorher-Text), G15, G18 (`privilegeRevoked` nie mit `command`/`meetingEnded` vermischt).

---

- [ ] **Step 1: Fehlschlagenden Test schreiben, Teil 1: `fahreSteuerung` sammelt stderr** (`packages/zoom-bridge/test/selftest.ts`, Zeilen 2227–2242)

Vorher:
```ts
 * IMMER stop(). Liefert alle Ereignisse, auch die beim Abbau.
 */
async function fahreSteuerung(
  fakeEnv: Record<string, string>,
  schritte: (b: Bridge, ev: BridgeEvent[]) => Promise<void>,
): Promise<BridgeEvent[]> {
  const ev: BridgeEvent[] = [];
  const b = new Bridge({
    exePath: process.execPath,
    exeArgs: [fake],
    env: { FAKE_SCRIPT: 'steuerung', ...fakeEnv },
    joinTimeoutMs: 5000,
    killTimeoutMs: 3000,
    onEvent: (e) => ev.push(e),
    onLog: () => {},
  });
```
Nachher:
```ts
 * IMMER stop(). Liefert alle Ereignisse, auch die beim Abbau. `zeilen` sammelt
 * auf Wunsch die stderr-Zeilen der Attrappe (Stage 4b, FAKE_NAMENSZEILE).
 */
async function fahreSteuerung(
  fakeEnv: Record<string, string>,
  schritte: (b: Bridge, ev: BridgeEvent[]) => Promise<void>,
  zeilen: string[] = [],
): Promise<BridgeEvent[]> {
  const ev: BridgeEvent[] = [];
  const b = new Bridge({
    exePath: process.execPath,
    exeArgs: [fake],
    env: { FAKE_SCRIPT: 'steuerung', ...fakeEnv },
    joinTimeoutMs: 5000,
    killTimeoutMs: 3000,
    onEvent: (e) => ev.push(e),
    onLog: (l) => zeilen.push(l),
  });
```
Alle bisherigen Aufrufer übergeben zwei Argumente und sammeln damit in ein Wegwerf-Feld, ihr Verhalten ändert sich nicht.

- [ ] **Step 2: Fehlschlagenden Test schreiben, Teil 2: Block „Attrappe — Stage 4b“** (`packages/zoom-bridge/test/selftest.ts`, Schlusszeile, vorher Zeile 2398, nach Step 1 Zeile 2400)

Vorher:
```ts
console.log(failures === 0 ? '\nAlle Selbsttests bestanden.' : `\n${failures} Selbsttest(s) fehlgeschlagen.`);
```
Nachher:
```ts
// --- Stage 4b: Entzug, Wiedererteilung, Rueckkehr, verzoegertes Abo, "(2)", Pufferfehler ---

/** Wie viele Ereignisse `pred` erfuellen. */
const anzahl = (ev: BridgeEvent[], pred: (e: BridgeEvent) => boolean): number => ev.filter(pred).length;

/** Kurz warten (nur dort, wo ein AUSBLEIBEN geprueft wird). */
const warte = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

console.log('\nAttrappe — Stage 4b:');
{
  // Der neue Grund ist ein EIGENER Name (G18). Die beiden Zuweisungen prueft tsc:
  // fehlt 'privilegeRevoked' in VideoReason oder AudioReason, ist der Typecheck rot.
  const bild: PaketVideoReason = 'privilegeRevoked';
  const ton: AudioReason = 'privilegeRevoked';
  let s = initialSession();
  s = reduce(s, enrich({ ev: 'video', id: 7, state: 'subscribed', source: 'JM Connect – Zoom Anna', reason: 'command', rebindable: true } as WireEvent));
  s = reduce(s, enrich({ ev: 'audio', id: 7, state: 'waiting', reason: 'command' } as WireEvent));
  s = reduce(s, enrich({ ev: 'audio', id: 7, state: 'off', reason: ton } as WireEvent));
  s = reduce(s, enrich({ ev: 'video', id: 7, state: 'unsubscribed', source: 'JM Connect – Zoom Anna', reason: bild, rebindable: true } as WireEvent));
  assert(s.videoSubs.size === 0 && s.audioSubs.size === 0,
    'Reducer: video unsubscribed mit privilegeRevoked entfernt das Abo aus Session.videoSubs (audio off ebenso aus audioSubs)');
}
{
  // FAKE_ENTZUG_MS baut ab 4b alle Abos ab (N4b.1, L1/L2): erst privilege false,
  // dann je Abo audio off (falls Ton) vor video unsubscribed, Grund privilegeRevoked.
  const ev = await fahreSteuerung({ FAKE_ENTZUG_MS: '300' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('privilege', { canRecordRaw: true }));
    b.send({ cmd: 'videoSubscribe', id: 16778240, resolution: '720p' });
    b.send({ cmd: 'videoSubscribe', id: 16778241, resolution: '720p', audio: false });
    await bisEreignis(ev, art('video', { id: 16778241, state: 'unsubscribed' }));
    b.send({ cmd: 'videoSubscribe', id: 16778240, resolution: '720p' });
    await bisEreignis(ev, art('error', { code: 'videoNoPrivilege' }));
  });
  const iEntzug = stelle(ev, art('privilege', { canRecordRaw: false, source: 'broadcast' }));
  const iAnnaTon = stelle(ev, art('audio', { id: 16778240, state: 'off', reason: 'privilegeRevoked' }));
  const iAnna = stelle(ev, art('video', { id: 16778240, state: 'unsubscribed', reason: 'privilegeRevoked' }));
  const iBen = stelle(ev, art('video', { id: 16778241, state: 'unsubscribed', reason: 'privilegeRevoked' }));
  assert(stelle(ev, art('video', { id: 16778240, state: 'subscribed' })) >= 0 && stelle(ev, art('video', { id: 16778241, state: 'subscribed' })) >= 0,
    'Entzug: vorher liefen zwei Abos (Anna mit Ton, Ben ohne)');
  assert(iEntzug >= 0 && iAnnaTon > iEntzug && iAnna === iAnnaTon + 1 && iBen > iEntzug,
    'Entzug baut jedes Abo ab: audio off vor video unsubscribed, Grund privilegeRevoked');
  assert(!ev.some(art('audio', { id: 16778241, reason: 'privilegeRevoked' })), '... ein Abo ohne Ton meldet kein audio off');
  assert(ev.filter(art('video', { state: 'unsubscribed' })).every((e) => (e as { reason?: string }).reason === 'privilegeRevoked'),
    '... kein Abbau mit command oder meetingEnded (eine Ursache, ein Name)');
  assert(stelle(ev, art('error', { where: 'video', code: 'videoNoPrivilege', id: 16778240 })) > iAnna,
    'nach dem Entzug: videoSubscribe → videoNoPrivilege');
  assert(anzahl(ev, art('video', { state: 'subscribed' })) === 2, '... und es entsteht kein neues Abo');
}
{
  const ev = await fahreSteuerung({ FAKE_ENTZUG_MS: '300', FAKE_ERTEILUNG_MS: '200' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('privilege', { canRecordRaw: true }));
    b.send({ cmd: 'videoSubscribe', id: 16778240, resolution: '720p' });
    await bisEreignis(ev, art('privilege', { canRecordRaw: true, source: 'broadcast' }));
    b.send({ cmd: 'videoSubscribe', id: 16778240, resolution: '720p' });
    await bisEreignis(ev, () => anzahl(ev, art('video', { id: 16778240, state: 'subscribed' })) === 2);
  });
  const iAbbau = stelle(ev, art('video', { id: 16778240, state: 'unsubscribed', reason: 'privilegeRevoked' }));
  const iErteilung = stelle(ev, art('privilege', { canRecordRaw: true, source: 'broadcast' }));
  const neu = ev.filter(art('video', { id: 16778240, state: 'subscribed' }))[1] as { source?: string } | undefined;
  assert(iAbbau >= 0 && iErteilung > iAbbau, "Wiedererteilung: privilege canRecordRaw:true source:'broadcast' nach dem Abbau (FAKE_ERTEILUNG_MS)");
  assert(ev.indexOf(neu as BridgeEvent) > iErteilung && neu?.source === 'JM Connect – Zoom Anna',
    '... videoSubscribe danach → subscribed, mit demselben NDI-Namen (ohne „(2)“)');
}
{
  // FAKE_ERTEILUNG_MS=0: beide Rundrufe in derselben Pumprunde der Bridge (L2).
  const ev = await fahreSteuerung({ FAKE_ENTZUG_MS: '300', FAKE_ERTEILUNG_MS: '0' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('privilege', { canRecordRaw: true }));
    b.send({ cmd: 'videoSubscribe', id: 16778240, resolution: '720p' });
    await bisEreignis(ev, art('video', { id: 16778240, state: 'unsubscribed' }));
    b.send({ cmd: 'videoSubscribe', id: 16778240, resolution: '720p' });
    await bisEreignis(ev, () => anzahl(ev, art('video', { id: 16778240, state: 'subscribed' })) === 2);
  });
  const iFalsch = stelle(ev, art('privilege', { canRecordRaw: false, source: 'broadcast' }));
  const iWahr = stelle(ev, art('privilege', { canRecordRaw: true, source: 'broadcast' }));
  const iAbbau = stelle(ev, art('video', { id: 16778240, state: 'unsubscribed', reason: 'privilegeRevoked' }));
  assert(iFalsch >= 0 && iWahr === iFalsch + 1 && iAbbau > iWahr, 'FAKE_ERTEILUNG_MS=0: Reihenfolge privilege false, privilege true, dann unsubscribed');
  const neu = ev.filter(art('video', { id: 16778240, state: 'subscribed' }))[1] as { source?: string } | undefined;
  assert(ev.indexOf(neu as BridgeEvent) > iAbbau && neu?.source === 'JM Connect – Zoom Anna', '... danach geht videoSubscribe wieder durch, ohne „(2)“');
}
{
  let mitten = '';
  const ev = await fahreSteuerung({ FAKE_VERBINDUNG_HAENGT_MS: '300', FAKE_VERBINDUNG_ZURUECK_MS: '200' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('privilege', { canRecordRaw: true }));
    b.send({ cmd: 'videoSubscribe', id: 16778240, resolution: '720p' });
    await bisEreignis(ev, () => anzahl(ev, art('roster')) === 2);
    mitten = statusFolge(ev);
    b.send({ cmd: 'videoSubscribe', id: 16778240, resolution: '720p' });
    await bisEreignis(ev, art('error', { code: 'videoAlreadySubscribed' }));
  });
  const iZurueck = ev.findIndex((e, i) => art('status', { status: 'inMeeting' })(e) && i > stelle(ev, art('status', { status: 'reconnecting' })));
  assert(mitten === 'connecting,inMeeting,reconnecting,connecting,inMeeting', 'Rückkehr aus reconnecting: connecting, inMeeting (FAKE_VERBINDUNG_ZURUECK_MS)');
  assert(iZurueck >= 0 && !ev.slice(0, iZurueck).some(art('video', { state: 'unsubscribed' })), '... Abos bestehen: kein unsubscribed bis zur Rückkehr');
  const roster2 = ev.filter(art('roster'))[1] as { list?: Participant[] } | undefined;
  assert(ev.indexOf(roster2 as BridgeEvent) > iZurueck && (roster2?.list ?? []).map((p) => p.id).join(',') === '100,16778240,16778241',
    '... danach wie das Original roster mit denselben Kennungen');
  assert(stelle(ev, art('privilege', { canRecordRaw: true, source: 'check' })) > iZurueck, "... und privilege canRecordRaw:true source:'check'");
  assert(iZurueck >= 0 && stelle(ev, art('error', { code: 'videoAlreadySubscribed', id: 16778240 })) > iZurueck,
    '... das Abo auf Anna lebt noch (videoAlreadySubscribed)');
}
{
  let frueh = true;
  let dauerMs = -1;
  const ev = await fahreSteuerung({ FAKE_ABO_VERZOEGERUNG_MS: '300' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('privilege', { canRecordRaw: true }));
    const start = Date.now();
    b.send({ cmd: 'videoSubscribe', id: 16778240, resolution: '720p' });
    await warte(100);
    frueh = ev.some(art('video', { id: 16778240 }));
    await bisEreignis(ev, art('video', { id: 16778240, state: 'subscribed' }));
    dauerMs = Date.now() - start;
    b.send({ cmd: 'videoSubscribe', id: 16778241, resolution: '720p' });
    b.send({ cmd: 'videoUnsubscribe', id: 16778241 });
    await bisEreignis(ev, art('video', { id: 16778241, state: 'unsubscribed' }));
    await warte(500);
  });
  assert(!frueh && dauerMs >= 250, 'verzögertes Abo: subscribed erst nach der Frist (FAKE_ABO_VERZOEGERUNG_MS)');
  assert(stelle(ev, art('audio', { id: 16778240, state: 'waiting' })) > stelle(ev, art('video', { id: 16778240, state: 'subscribed' })),
    '... der Ton meldet sich erst danach');
  assert(stelle(ev, art('video', { id: 16778241, state: 'unsubscribed', reason: 'command' })) >= 0
      && !ev.some(art('video', { id: 16778241, state: 'subscribed' })) && !ev.some(art('audio', { id: 16778241 })),
    'videoUnsubscribe davor → unsubscribed(command), kein subscribed danach');
}
{
  const ev = await fahreSteuerung({ FAKE_ABO_VERZOEGERUNG_MS: '600', FAKE_ENTZUG_MS: '200' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('privilege', { canRecordRaw: true }));
    b.send({ cmd: 'videoSubscribe', id: 16778240, resolution: '720p' });
    await bisEreignis(ev, art('video', { id: 16778240, state: 'unsubscribed' }));
    await warte(800);
  });
  assert(stelle(ev, art('video', { id: 16778240, state: 'unsubscribed', reason: 'privilegeRevoked' })) >= 0
      && !ev.some(art('video', { id: 16778240, state: 'subscribed' })) && !ev.some(art('audio', { id: 16778240 })),
    'offenes Abo beim Entzug: unsubscribed(privilegeRevoked) ohne audio off, kein subscribed danach');
}
{
  const ev = await fahreSteuerung({ FAKE_DOPPELNAME: '1' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('privilege', { canRecordRaw: true }));
    b.send({ cmd: 'videoSubscribe', id: 16778240, resolution: '720p' });
    b.send({ cmd: 'videoSubscribe', id: 16778241, resolution: '720p' });
    await bisEreignis(ev, art('video', { id: 16778241, state: 'subscribed' }));
    b.send({ cmd: 'videoUnsubscribe', id: 16778240 });
    b.send({ cmd: 'videoSubscribe', id: 16778240, resolution: '720p' });
    await bisEreignis(ev, () => anzahl(ev, art('video', { id: 16778240, state: 'subscribed' })) === 2);
  });
  const quellen = ev.filter(art('video', { state: 'subscribed' })).map((e) => (e as { source?: string }).source);
  assert(quellen[0] === 'JM Connect – Zoom Anna' && quellen[1] === 'JM Connect – Zoom Anna (2)',
    "Doppelname: zweite Quelle heißt '… Anna (2)' (wie uniqueSourceName)");
  assert(quellen[2] === 'JM Connect – Zoom Anna', '... ist der Name wieder frei, bekommt das nächste Abo ihn ohne Zusatz');
}
{
  const ev = await fahreSteuerung({ FAKE_PUFFERFEHLER_MS: '100' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('privilege', { canRecordRaw: true }));
    b.send({ cmd: 'videoSubscribe', id: 16778240, resolution: '720p' });
    b.send({ cmd: 'videoSubscribe', id: 16778241, resolution: '720p', audio: false });
    await bisEreignis(ev, art('error', { code: 'videoBufferMismatch', id: 16778241 }));
    await warte(400);
  });
  assert(anzahl(ev, art('error', { where: 'video', code: 'videoBufferMismatch', id: 16778240 })) === 1
      && anzahl(ev, art('error', { where: 'video', code: 'videoBufferMismatch', id: 16778241 })) === 1,
    'Pufferfehler: je Abo ein videoBufferMismatch mit id');
  assert(anzahl(ev, art('error', { where: 'audio', code: 'audioBufferMismatch', id: 16778240 })) === 1
      && !ev.some(art('error', { code: 'audioBufferMismatch', id: 16778241 })),
    '... audioBufferMismatch nur bei einem Abo mit Ton');
  assert(ev.find(art('error', { code: 'videoBufferMismatch' }))?.name === 'VIDEO_BUFFER_MISMATCH'
      && ev.find(art('error', { code: 'audioBufferMismatch' }))?.name === 'AUDIO_BUFFER_MISMATCH',
    '... mit den Namen VIDEO_BUFFER_MISMATCH und AUDIO_BUFFER_MISMATCH');
}
{
  const zeilen: string[] = [];
  await fahreSteuerung({ FAKE_NAMENSZEILE: '1' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('roster'));
    const ende = Date.now() + 2000;
    while (Date.now() < ende && !zeilen.some((z) => z.startsWith('Namensprobe:'))) await warte(20);
  }, zeilen);
  assert(zeilen.includes('Namensprobe: Anna, Ben'), 'Namensprobe auf stderr nennt die fremden Teilnehmer (FAKE_NAMENSZEILE=1)');
  const ohne: string[] = [];
  await fahreSteuerung({}, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('roster'));
    await warte(200);
  }, ohne);
  assert(ohne.length > 0 && !ohne.some((z) => z.startsWith('Namensprobe')), '... ohne FAKE_NAMENSZEILE keine solche Zeile');
}

console.log(failures === 0 ? '\nAlle Selbsttests bestanden.' : `\n${failures} Selbsttest(s) fehlgeschlagen.`);
```
Hinweise: `initialSession`, `reduce` (Zeile 492), `enrich`, `WireEvent`, `AudioReason`, `PaketVideoReason`, `Participant` (Zeilen 5–36), `Bridge`, `join`, `fake` (Zeilen 845–850) sowie `bisEreignis`, `art`, `stelle`, `statusFolge`, `BEITRITT` und `fahreSteuerung` (Zeilen 2200–2253) sind schon da. Neu sind nur `anzahl` und `warte`; beide Namen kommen in `selftest.ts` bisher nicht vor. Die Zeiten (300 ms Entzug, 200 ms Erteilung/Rückkehr, 300–600 ms Abo-Verzögerung) lassen nach der Erlaubnis (50 ms nach `inMeeting`) sicher Luft für die Abos; geprüft wird nur Reihenfolge und Ausbleiben, nie eine enge Zeitgrenze (Ausnahme: „subscribed erst nach der Frist“ verlangt ≥ 250 ms bei 300 ms Frist).

- [ ] **Step 3: Test laufen lassen (rot)**

```
npm run selftest -w @jm/zoom-bridge
npm run typecheck -w @jm/zoom-bridge
```
Erwartet beim Selbsttest: alle bisherigen Gruppen grün (auch der alte Fall „FAKE_ENTZUG_MS: privilege broadcast canRecordRaw:false nach der Erlaubnis“, der erst nach dem Entzug abonniert), im neuen Block 8 `ok` und 19 `FAIL`, Exitcode ≠ 0; `auslieferung.test.mjs` läuft wegen `&&` nicht mehr:
```
Attrappe — Stage 4b:
  ok  Reducer: video unsubscribed mit privilegeRevoked entfernt das Abo aus Session.videoSubs (audio off ebenso aus audioSubs)
  ok  Entzug: vorher liefen zwei Abos (Anna mit Ton, Ben ohne)
FAIL  Entzug baut jedes Abo ab: audio off vor video unsubscribed, Grund privilegeRevoked
  ok  ... ein Abo ohne Ton meldet kein audio off
FAIL  ... kein Abbau mit command oder meetingEnded (eine Ursache, ein Name)
  ok  nach dem Entzug: videoSubscribe → videoNoPrivilege
  ok  ... und es entsteht kein neues Abo
FAIL  Wiedererteilung: privilege canRecordRaw:true source:'broadcast' nach dem Abbau (FAKE_ERTEILUNG_MS)
FAIL  ... videoSubscribe danach → subscribed, mit demselben NDI-Namen (ohne „(2)“)
FAIL  FAKE_ERTEILUNG_MS=0: Reihenfolge privilege false, privilege true, dann unsubscribed
FAIL  ... danach geht videoSubscribe wieder durch, ohne „(2)“
FAIL  Rückkehr aus reconnecting: connecting, inMeeting (FAKE_VERBINDUNG_ZURUECK_MS)
FAIL  ... Abos bestehen: kein unsubscribed bis zur Rückkehr
FAIL  ... danach wie das Original roster mit denselben Kennungen
FAIL  ... und privilege canRecordRaw:true source:'check'
FAIL  ... das Abo auf Anna lebt noch (videoAlreadySubscribed)
FAIL  verzögertes Abo: subscribed erst nach der Frist (FAKE_ABO_VERZOEGERUNG_MS)
  ok  ... der Ton meldet sich erst danach
FAIL  videoUnsubscribe davor → unsubscribed(command), kein subscribed danach
FAIL  offenes Abo beim Entzug: unsubscribed(privilegeRevoked) ohne audio off, kein subscribed danach
FAIL  Doppelname: zweite Quelle heißt '… Anna (2)' (wie uniqueSourceName)
  ok  ... ist der Name wieder frei, bekommt das nächste Abo ihn ohne Zusatz
FAIL  Pufferfehler: je Abo ein videoBufferMismatch mit id
FAIL  ... audioBufferMismatch nur bei einem Abo mit Ton
FAIL  ... mit den Namen VIDEO_BUFFER_MISMATCH und AUDIO_BUFFER_MISMATCH
FAIL  Namensprobe auf stderr nennt die fremden Teilnehmer (FAKE_NAMENSZEILE=1)
  ok  ... ohne FAKE_NAMENSZEILE keine solche Zeile

19 Selbsttest(s) fehlgeschlagen.
```
(Gemessen: 479 `ok`-Zeilen. Der rote Lauf dauert länger als der grüne, weil die roten Fälle ihre 4-s-Frist abwarten. Die acht `ok` sind Rückfall-Wächter, die schon heute gelten.) Erwartet beim Typecheck, Exitcode 2:
```
test/selftest.ts(2412,9): error TS2322: Type '"privilegeRevoked"' is not assignable to type 'VideoReason'.
test/selftest.ts(2413,9): error TS2322: Type '"privilegeRevoked"' is not assignable to type 'AudioReason'.
```
Der Reducer-Fall ist zur Laufzeit schon grün (`reduce` entfernt jedes `unsubscribed`); rot ist er nur im Typecheck.

- [ ] **Step 4: `VideoReason` bekommt `privilegeRevoked`** (`packages/zoom-bridge/src/protocol.ts`, Zeilen 72–73)

Vorher:
```ts
  // Zuordnung auf einem Namen beruht und nicht auf einer Kennung.
  | 'reboundByName';
```
Nachher:
```ts
  // Zuordnung auf einem Namen beruht und nicht auf einer Kennung.
  | 'reboundByName'
  // Der Host hat die Aufnahme-Erlaubnis entzogen (privilege canRecordRaw:false,
  // source:'broadcast'), und die Bridge baut darum JEDES Abo ab (Stage 4b,
  // N4b.1: "The app must stop accessing content if permission is revoked").
  // Ein EIGENER Name: weder hat der Aufrufer etwas befohlen ('command') noch
  // ist das Meeting zu Ende ('meetingEnded'). Wer 'privilegeRevoked' liest,
  // weiss: das Meeting laeuft weiter, und erteilt der Host die Erlaubnis neu,
  // darf neu abonniert werden. Zwei Ursachen, ein Name - genau das schliesst
  // die Kernregel aus.
  | 'privilegeRevoked';
```

- [ ] **Step 5: `AudioReason` bekommt `privilegeRevoked`** (`packages/zoom-bridge/src/protocol.ts`, vorher Zeilen 106–108, nach Step 4 Zeilen 115–117)

Vorher:
```ts
  | 'meetingEnded'
  | 'rebound'
  | 'reboundByName';
```
Nachher:
```ts
  | 'meetingEnded'
  | 'rebound'
  | 'reboundByName'
  // Beim Entzug der Aufnahme-Erlaubnis meldet sich der Ton mit DEMSELBEN Grund
  // ab wie das Bild (VideoReason oben) - der Ton haengt am Bild-Abo.
  | 'privilegeRevoked';
```
(`| 'meetingEnded'` gefolgt von `| 'rebound'` gibt es nur in `AudioReason`; in `VideoReason` folgt auf `'meetingEnded'` ein Kommentar.)

- [ ] **Step 6: Kopfliste der Stellschrauben** (`packages/zoom-bridge/test/fake-bridge.mjs`, Zeilen 174–181)

Vorher:
```js
  //   FAKE_ENTZUG_MS        so lange nach der Erlaubnis entzieht der Host sie:
  //                         privilege canRecordRaw:false, source:'broadcast'
  //   FAKE_RUECKKEHR_MS     mit FAKE_WIEDERBEITRITT_MS: Abstand zwischen left und
  //                         joined (Vorgabe 0 = sofort, wie bisher)
  //   FAKE_RUECKKEHR_NAME   mit FAKE_WIEDERBEITRITT_MS: Name bei der Rueckkehr
  //                         (Vorgabe: unveraendert). Weicht er ab, haengt die
  //                         Attrappe NICHT um - das Abo bleibt schwarz unter 16778240
  //
```
Nachher:
```js
  //   FAKE_ENTZUG_MS        so lange nach der Erlaubnis entzieht der Host sie:
  //                         privilege canRecordRaw:false, source:'broadcast'. Ab
  //                         Stage 4b baut die Attrappe danach ALLE Abos ab, wie die
  //                         Bridge (native/main.cpp, Abbau nach pumpOnce()): einen
  //                         Takt spaeter (setImmediate), je Abo audio off (falls Ton
  //                         gemeldet) vor video unsubscribed, Grund privilegeRevoked
  //   FAKE_RUECKKEHR_MS     mit FAKE_WIEDERBEITRITT_MS: Abstand zwischen left und
  //                         joined (Vorgabe 0 = sofort, wie bisher)
  //   FAKE_RUECKKEHR_NAME   mit FAKE_WIEDERBEITRITT_MS: Name bei der Rueckkehr
  //                         (Vorgabe: unveraendert). Weicht er ab, haengt die
  //                         Attrappe NICHT um - das Abo bleibt schwarz unter 16778240
  //
  // Stage 4b (JM Connect 0.3.0):
  //   FAKE_ERTEILUNG_MS     nur mit FAKE_ENTZUG_MS: so lange nach dem Entzug erteilt
  //                         der Host die Erlaubnis wieder: privilege canRecordRaw:true,
  //                         source:'broadcast'. 0 = synchron direkt nach privilege
  //                         false, also VOR dem Abbau (beide Rundrufe in derselben
  //                         Pumprunde der Bridge); abgebaut wird trotzdem
  //   FAKE_VERBINDUNG_ZURUECK_MS  nur mit FAKE_VERBINDUNG_HAENGT_MS: so lange nach
  //                         reconnecting verbindet Zoom selbst: connecting, inMeeting,
  //                         dann wie das Original roster und privilege source:'check'.
  //                         Abos und Teilnehmer (samt Kennungen) bleiben
  //   FAKE_ABO_VERZOEGERUNG_MS  videoSubscribe legt das Abo sofort an, meldet video
  //                         subscribed und den Ton aber erst nach so vielen ms. Kommt
  //                         vorher videoUnsubscribe oder ein Abbau, meldet sie nur
  //                         video unsubscribed (command bzw. Abbaugrund), kein audio
  //                         off, und subscribed kommt nie
  //   FAKE_PUFFERFEHLER_MS  so lange nach video subscribed je Abo einmal error
  //                         where:'video' code:'videoBufferMismatch' mit id, bei
  //                         laufendem Ton dazu where:'audio' code:'audioBufferMismatch'
  //   FAKE_NAMENSZEILE=1    100 ms nach dem roster eine stderr-Zeile "Namensprobe: Anna, Ben"
  //                         mit allen fremden Teilnehmern (Pruefstand: JM Connect
  //                         schreibt keine Teilnehmernamen ins Log)
  //   NDI-Name wie uniqueSourceName() (native/video.cpp): traegt ein EIGENES Abo
  //                         "JM Connect – Zoom <Name>" schon, folgen " (2)", " (3)" ...
  //
```

- [ ] **Step 7: Abos merken „offen“; `abbauen` kennt offene Abos** (`packages/zoom-bridge/test/fake-bridge.mjs`, vorher Zeilen 206–217)

Vorher:
```js
    // id -> { source, audio, rebindable, name, tonLaeuft }. audio = Ton bestellt
    // (wie audioOn im Original), tonLaeuft = Ton noch nicht "off" gemeldet.
    const abos = new Map();
    const logDatei = process.env.FAKE_LOGDATEI;

    const abbauen = (grund) => {
      for (const [id, a] of abos) {
        if (a.audio) say({ ev: 'audio', id, state: 'off', reason: grund });
        say({ ev: 'video', id, state: 'unsubscribed', source: a.source, reason: grund, rebindable: a.rebindable });
      }
      abos.clear();
    };
```
Nachher:
```js
    // id -> { source, audio, rebindable, name, tonLaeuft, offen, zeit }. audio = Ton
    // bestellt (wie audioOn im Original), tonLaeuft = Ton gemeldet und noch nicht
    // "off". offen = subscribed noch nicht gemeldet (FAKE_ABO_VERZOEGERUNG_MS),
    // zeit = der Zeitgeber, der es melden wird.
    const abos = new Map();
    const logDatei = process.env.FAKE_LOGDATEI;

    const abbauen = (grund) => {
      for (const [id, a] of abos) {
        // Ein OFFENES Abo hat weder subscribed noch seinen Ton gemeldet: es
        // bekommt nur das unsubscribed, sein verzoegertes subscribed faellt weg.
        if (a.offen) clearTimeout(a.zeit);
        else if (a.audio) say({ ev: 'audio', id, state: 'off', reason: grund });
        say({ ev: 'video', id, state: 'unsubscribed', source: a.source, reason: grund, rebindable: a.rebindable });
      }
      abos.clear();
    };
```

- [ ] **Step 8: Namensprobe, Entzug baut ab, Wiedererteilung** (`packages/zoom-bridge/test/fake-bridge.mjs`, vorher Zeilen 232–249)

Vorher:
```js
      say({ ev: 'roster', list: [...teilnehmer.values()] });
      say({ ev: 'privilege', canRecordRaw: false, source: 'check', requested: true });
      if (privileg === 'ja') {
        setTimeout(() => {
          canRecordRaw = true;
          say({ ev: 'privilege', canRecordRaw: true, source: 'requestAnswer' });
          if (process.env.FAKE_ABSTURZ_MS) {
            setTimeout(() => process.exit(0xc0000005 | 0), Number(process.env.FAKE_ABSTURZ_MS));
          }
          if (process.env.FAKE_ENTZUG_MS) {
            // Der Host entzieht die Erlaubnis (native/callbacks.cpp
            // onRecordPrivilegeChanged): ein unaufgeforderter Rundruf.
            setTimeout(() => {
              canRecordRaw = false;
              say({ ev: 'privilege', canRecordRaw: false, source: 'broadcast' });
            }, Number(process.env.FAKE_ENTZUG_MS));
          }
        }, 50);
```
Nachher:
```js
      say({ ev: 'roster', list: [...teilnehmer.values()] });
      if (process.env.FAKE_NAMENSZEILE === '1') {
        // Pruefstand fuer "keine Teilnehmernamen im Log" (Spec N4b.2): eine
        // stderr-Zeile MIT Namen, wie sie eine Diagnose der Bridge enthalten
        // koennte. JM Connect muss sie maskiert ins Log schreiben. 100 ms Abstand:
        // stdout und stderr sind zwei Leitungen; ohne ihn kann die Zeile beim Kern
        // ankommen, bevor er den roster gelesen hat (Plan Aufgabe 12).
        const fremde = [...teilnehmer.values()].filter((p) => !p.self).map((p) => p.name);
        setTimeout(() => process.stderr.write(`Namensprobe: ${fremde.join(', ')}\n`), 100);
      }
      say({ ev: 'privilege', canRecordRaw: false, source: 'check', requested: true });
      if (privileg === 'ja') {
        setTimeout(() => {
          canRecordRaw = true;
          say({ ev: 'privilege', canRecordRaw: true, source: 'requestAnswer' });
          if (process.env.FAKE_ABSTURZ_MS) {
            setTimeout(() => process.exit(0xc0000005 | 0), Number(process.env.FAKE_ABSTURZ_MS));
          }
          if (process.env.FAKE_ENTZUG_MS) {
            // Der Host entzieht die Erlaubnis (native/callbacks.cpp
            // onRecordPrivilegeChanged): ein unaufgeforderter Rundruf. Ab 4b baut
            // die Bridge danach ALLE Abos ab - nicht im Rundruf, sondern im
            // naechsten Schleifendurchlauf (native/main.cpp, nach pumpOnce()).
            // Die Attrappe bildet das mit setImmediate nach (Plan L1/L2).
            setTimeout(() => {
              if (!imMeeting) return;
              canRecordRaw = false;
              say({ ev: 'privilege', canRecordRaw: false, source: 'broadcast' });
              const erteilung = process.env.FAKE_ERTEILUNG_MS;
              const erteilen = () => {
                if (!imMeeting) return;
                canRecordRaw = true;
                say({ ev: 'privilege', canRecordRaw: true, source: 'broadcast' });
              };
              // 0: beide Rundrufe kamen in derselben Pumprunde - privilege true
              // steht VOR dem Abbau auf der Leitung, abgebaut wird trotzdem.
              if (erteilung === '0') erteilen();
              setImmediate(() => abbauen('privilegeRevoked'));
              if (erteilung !== undefined && erteilung !== '0') setTimeout(erteilen, Number(erteilung));
            }, Number(process.env.FAKE_ENTZUG_MS));
          }
        }, 50);
```

- [ ] **Step 9: Zoom verbindet selbst zurück** (`packages/zoom-bridge/test/fake-bridge.mjs`, vorher Zeilen 318–324)

Vorher:
```js
      if (process.env.FAKE_VERBINDUNG_HAENGT_MS) {
        // Zoom verbindet neu und kommt nie an: reconnecting, dann Stille.
        // imMeeting bleibt true - quit verlaesst darum das Meeting (disconnecting, ended).
        setTimeout(() => {
          say({ ev: 'status', status: 'reconnecting', raw: 7, code: 0 });
        }, Number(process.env.FAKE_VERBINDUNG_HAENGT_MS));
      }
```
Nachher:
```js
      if (process.env.FAKE_VERBINDUNG_HAENGT_MS) {
        // Zoom verbindet neu und kommt nie an: reconnecting, dann Stille.
        // imMeeting bleibt true - quit verlaesst darum das Meeting (disconnecting, ended).
        setTimeout(() => {
          say({ ev: 'status', status: 'reconnecting', raw: 7, code: 0 });
          if (process.env.FAKE_VERBINDUNG_ZURUECK_MS) {
            // ... ausser Zoom kommt selbst zurueck (Stage 4b). Wie das Original bei
            // JEDEM inMeeting (native/callbacks.cpp onMeetingStatusChanged): roster
            // und die Sofortpruefung der Erlaubnis (native/session.cpp
            // checkPrivilege()). Abos und Kennungen bleiben; ob Zoom die
            // Kennungen dabei wechselt, ist ungemessen.
            setTimeout(() => {
              if (!imMeeting) return;
              say({ ev: 'status', status: 'connecting', raw: 1, code: 0 });
              say({ ev: 'status', status: 'inMeeting', raw: 3, code: 0 });
              say({ ev: 'roster', list: [...teilnehmer.values()] });
              if (canRecordRaw) say({ ev: 'privilege', canRecordRaw: true, source: 'check' });
              else say({ ev: 'privilege', canRecordRaw: false, source: 'check', requested: true });
            }, Number(process.env.FAKE_VERBINDUNG_ZURUECK_MS));
          }
        }, Number(process.env.FAKE_VERBINDUNG_HAENGT_MS));
      }
```

- [ ] **Step 10: `videoSubscribe` mit „(2)“, Verzögerung und Pufferfehler; `videoUnsubscribe` kennt offene Abos** (`packages/zoom-bridge/test/fake-bridge.mjs`, vorher Zeilen 397–410)

Vorher:
```js
        const source = `JM Connect – Zoom ${teilnehmer.get(c.id).name}`;
        const audio = c.audio !== false;
        // Wie emitVideo() in native/video.cpp: umhaengbar ueber die persistentId
        // nur, wenn sie nicht leer ist.
        const rebindable = teilnehmer.get(c.id).persistentId !== '';
        abos.set(c.id, { source, audio, rebindable, name: teilnehmer.get(c.id).name, tonLaeuft: audio });
        say({ ev: 'video', id: c.id, state: 'subscribed', source, reason: 'command', rebindable });
        say({ ev: 'audio', id: c.id, state: audio ? 'waiting' : 'off', reason: 'command' });
      } else if (c.cmd === 'videoUnsubscribe') {
        if (!abos.has(c.id)) return say({ ev: 'error', where: 'video', code: 'videoNotSubscribed', id: c.id });
        const a = abos.get(c.id);
        abos.delete(c.id);
        if (a.audio) say({ ev: 'audio', id: c.id, state: 'off', reason: 'command' });
        say({ ev: 'video', id: c.id, state: 'unsubscribed', source: a.source, reason: 'command', rebindable: a.rebindable });
```
Nachher:
```js
        // Wie uniqueSourceName() in native/video.cpp: traegt ein EIGENES Abo den
        // Namen schon (exakter Vergleich), folgen " (2)", " (3)" ...
        const basis = `JM Connect – Zoom ${teilnehmer.get(c.id).name}`;
        let source = basis;
        for (let n = 2; [...abos.values()].some((x) => x.source === source); n++) source = `${basis} (${n})`;
        const audio = c.audio !== false;
        // Wie emitVideo() in native/video.cpp: umhaengbar ueber die persistentId
        // nur, wenn sie nicht leer ist.
        const rebindable = teilnehmer.get(c.id).persistentId !== '';
        const a = { source, audio, rebindable, name: teilnehmer.get(c.id).name, tonLaeuft: false, offen: true, zeit: null };
        abos.set(c.id, a);
        const melden = () => {
          a.offen = false;
          a.tonLaeuft = audio;
          say({ ev: 'video', id: c.id, state: 'subscribed', source, reason: 'command', rebindable });
          say({ ev: 'audio', id: c.id, state: audio ? 'waiting' : 'off', reason: 'command' });
          if (process.env.FAKE_PUFFERFEHLER_MS) {
            // Wie native/video.cpp (Delegate) und audio.cpp: ein falsch
            // ausgelegter Puffer wird je Abo EINMAL gemeldet, mit Kennung.
            setTimeout(() => {
              if (abos.get(c.id) !== a) return;
              say({ ev: 'error', where: 'video', code: 'videoBufferMismatch', id: c.id });
              if (a.tonLaeuft) say({ ev: 'error', where: 'audio', code: 'audioBufferMismatch', id: c.id });
            }, Number(process.env.FAKE_PUFFERFEHLER_MS));
          }
        };
        const verzoegerung = Number(process.env.FAKE_ABO_VERZOEGERUNG_MS ?? '0');
        if (verzoegerung > 0) {
          a.zeit = setTimeout(() => {
            if (abos.get(c.id) === a) melden();
          }, verzoegerung);
        } else melden();
      } else if (c.cmd === 'videoUnsubscribe') {
        if (!abos.has(c.id)) return say({ ev: 'error', where: 'video', code: 'videoNotSubscribed', id: c.id });
        const a = abos.get(c.id);
        abos.delete(c.id);
        // Offen (FAKE_ABO_VERZOEGERUNG_MS): subscribed und Ton waren nie gemeldet.
        if (a.offen) clearTimeout(a.zeit);
        else if (a.audio) say({ ev: 'audio', id: c.id, state: 'off', reason: 'command' });
        say({ ev: 'video', id: c.id, state: 'unsubscribed', source: a.source, reason: 'command', rebindable: a.rebindable });
```
Ohne `FAKE_ABO_VERZOEGERUNG_MS` läuft `melden()` synchron: Ereignisse und Reihenfolge sind dann byte-gleich mit vorher (außer bei einem zweiten Abo mit gleichem NDI-Namen, das jetzt „(2)“ heißt). Die Rückkehr bei `FAKE_WIEDERBEITRITT_MS` (Zeilen 260–299) bleibt unverändert; ein offenes Abo wird dort nicht umgehängt — die Kombination mit `FAKE_ABO_VERZOEGERUNG_MS` ist nicht vorgesehen.

- [ ] **Step 11: Test laufen lassen (grün)**

```
npm run selftest -w @jm/zoom-bridge
```
Erwartet: keine Zeile `FAIL`, Exitcode 0, im neuen Block:
```
Attrappe — Stage 4b:
  ok  Reducer: video unsubscribed mit privilegeRevoked entfernt das Abo aus Session.videoSubs (audio off ebenso aus audioSubs)
  ok  Entzug: vorher liefen zwei Abos (Anna mit Ton, Ben ohne)
  ok  Entzug baut jedes Abo ab: audio off vor video unsubscribed, Grund privilegeRevoked
  ok  ... ein Abo ohne Ton meldet kein audio off
  ok  ... kein Abbau mit command oder meetingEnded (eine Ursache, ein Name)
  ok  nach dem Entzug: videoSubscribe → videoNoPrivilege
  ok  ... und es entsteht kein neues Abo
  ok  Wiedererteilung: privilege canRecordRaw:true source:'broadcast' nach dem Abbau (FAKE_ERTEILUNG_MS)
  ok  ... videoSubscribe danach → subscribed, mit demselben NDI-Namen (ohne „(2)“)
  ok  FAKE_ERTEILUNG_MS=0: Reihenfolge privilege false, privilege true, dann unsubscribed
  ok  ... danach geht videoSubscribe wieder durch, ohne „(2)“
  ok  Rückkehr aus reconnecting: connecting, inMeeting (FAKE_VERBINDUNG_ZURUECK_MS)
  ok  ... Abos bestehen: kein unsubscribed bis zur Rückkehr
  ok  ... danach wie das Original roster mit denselben Kennungen
  ok  ... und privilege canRecordRaw:true source:'check'
  ok  ... das Abo auf Anna lebt noch (videoAlreadySubscribed)
  ok  verzögertes Abo: subscribed erst nach der Frist (FAKE_ABO_VERZOEGERUNG_MS)
  ok  ... der Ton meldet sich erst danach
  ok  videoUnsubscribe davor → unsubscribed(command), kein subscribed danach
  ok  offenes Abo beim Entzug: unsubscribed(privilegeRevoked) ohne audio off, kein subscribed danach
  ok  Doppelname: zweite Quelle heißt '… Anna (2)' (wie uniqueSourceName)
  ok  ... ist der Name wieder frei, bekommt das nächste Abo ihn ohne Zusatz
  ok  Pufferfehler: je Abo ein videoBufferMismatch mit id
  ok  ... audioBufferMismatch nur bei einem Abo mit Ton
  ok  ... mit den Namen VIDEO_BUFFER_MISMATCH und AUDIO_BUFFER_MISMATCH
  ok  Namensprobe auf stderr nennt die fremden Teilnehmer (FAKE_NAMENSZEILE=1)
  ok  ... ohne FAKE_NAMENSZEILE keine solche Zeile

Alle Selbsttests bestanden.
```
danach `auslieferung.test.mjs` wie bisher mit `Alle Auslieferungs-Tests bestanden.` Gemessen (Windows, Node 24.16): 498 + 31 = 529 `ok`-Zeilen. Die bisherigen Gruppen bleiben vollständig grün, auch „FAKE_ENTZUG_MS: privilege broadcast canRecordRaw:false nach der Erlaubnis“ und „... ein folgendes videoSubscribe wird mit videoNoPrivilege abgewiesen“ (Zeilen 2313–2324): dort abonniert der Test erst nach dem Entzug, es gibt nichts abzubauen.

- [ ] **Step 12: Typecheck**

```
npm run typecheck -w @jm/zoom-bridge
npm run typecheck -w @jm/connect
```
Erwartet: beide ohne Fehlermeldung, Exitcode 0. Connect liest `VideoReason`/`AudioReason` nur als Typ (`kern.ts:180-181`, `klartext.ts:280`, `types.ts:107-110`) und hat keine vollständige Fallunterscheidung darüber; der neue Wert bricht dort nichts. (Beim Planen gemessen: `tsc` für `tsconfig.node.json` und `tsconfig.web.json` von Connect gegen das geänderte `protocol.ts`, je Exitcode 0.)

- [ ] **Step 13: Fall 10b an die neue Attrappe anpassen** (`apps/connect/test/zoom-kern.test.ts`, Zeile 1212)

Fall 10b (`apps/connect/test/zoom-kern.test.ts:1206-1218`) hält das 4a-Verhalten fest: Die Quelle läuft nach dem Entzug weiter, die Karte steht in Z7b. Mit der neuen Attrappe baut die Bridge sie ab, ohne diesen Step wäre `npx tsx apps/connect/test/zoom-kern.test.ts` rot (`408 ok, 1 fehlgeschlagen, 0 übersprungen.` mit `FAIL  … Z7b mit „vom Host entzogen“`). Hier ändert sich nur diese eine Prüfung; Aufgabe 8 (Step 1) schreibt den ganzen Fall neu.

Vorher:
```ts
  ck('… Z7b mit „vom Host entzogen“', zoomZ(p.kern.kurz()) === 'Z7b' && String(kartenZeile(p.kern.abbild(), Date.now())).includes('vom Host entzogen'));
```
Nachher:
```ts
  // Ab 4b baut die Attrappe beim Entzug ab wie die Bridge (Grund privilegeRevoked,
  // Aufgabe 1). Aufgabe 8 schreibt diesen Fall neu.
  ck('… die Bridge baut die Quelle ab (privilegeRevoked)', await bis(() => p.kern.kurz().quellen === 0));
```

- [ ] **Step 14: Querprüfung JM Connect**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: keine Zeile `FAIL`, Exitcode 0, Schlusszeile `409 ok, 0 fehlgeschlagen, 0 übersprungen.` (wie vor dieser Aufgabe).

- [ ] **Step 15: Commit** (Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add packages/zoom-bridge/src/protocol.ts packages/zoom-bridge/test/fake-bridge.mjs packages/zoom-bridge/test/selftest.ts apps/connect/test/zoom-kern.test.ts
git status --short
```
Erwartet genau diese gestagten Zeilen:
```
M  apps/connect/test/zoom-kern.test.ts
M  packages/zoom-bridge/src/protocol.ts
M  packages/zoom-bridge/test/fake-bridge.mjs
M  packages/zoom-bridge/test/selftest.ts
```
Dann:
```
git commit -m "feat(zoom-bridge): Abbau-Grund privilegeRevoked; Attrappe fuer Entzug, Wiedererteilung, Rueckkehr, verzoegertes Abo" -m "VideoReason und AudioReason kennen privilegeRevoked (Entzug der Aufnahme-Erlaubnis, eigener Name neben command und meetingEnded). Attrappe: FAKE_ENTZUG_MS baut jetzt alle Abos ab (einen Takt nach privilege false, audio off vor video unsubscribed); neu FAKE_ERTEILUNG_MS (0 = vor dem Abbau), FAKE_VERBINDUNG_ZURUECK_MS (Zoom verbindet selbst zurueck, roster und privilege check wie das Original), FAKE_ABO_VERZOEGERUNG_MS (offenes Abo), FAKE_PUFFERFEHLER_MS, FAKE_NAMENSZEILE; NDI-Name mit (2) wie uniqueSourceName. Connect-Fall 10b prueft jetzt den Abbau beim Entzug (Aufgabe 8 schreibt ihn neu)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Gegenprobe (beim Planen am nachgespielten Stand nach Step 11 gemessen, kein Umsetzungsschritt):** Abbau mit falschem Grund — in `fake-bridge.mjs` `setImmediate(() => abbauen('privilegeRevoked'));` → `setImmediate(() => abbauen('command'));` — macht genau fünf Prüfungen rot: „Entzug baut jedes Abo ab: audio off vor video unsubscribed, Grund privilegeRevoked“, „... kein Abbau mit command oder meetingEnded (eine Ursache, ein Name)“, „Wiedererteilung: privilege canRecordRaw:true source:'broadcast' nach dem Abbau (FAKE_ERTEILUNG_MS)“, „FAKE_ERTEILUNG_MS=0: Reihenfolge privilege false, privilege true, dann unsubscribed“ und „offenes Abo beim Entzug: unsubscribed(privilegeRevoked) ohne audio off, kein subscribed danach“ (`5 Selbsttest(s) fehlgeschlagen.`). Rückbau byte-gleich.

**Abweichungen von der Gliederung:**
1. **Connect-Test Fall 10b in dieser Aufgabe angepasst (Step 13).** Die Gliederung erwartet nur im Bridge-Selbsttest einen Test mit altem `FAKE_ENTZUG_MS`-Verhalten; dort gibt es keinen (der alte Fall abonniert erst nach dem Entzug und bleibt grün). Das alte Verhalten hält aber `apps/connect/test/zoom-kern.test.ts` Fall 10b fest (Zeile 1212). Ohne Step 13 wäre `npm run selftest -w @jm/connect` (und damit CI) von Aufgabe 1 bis Aufgabe 8 rot. Step 13 ändert nur diese eine Prüfung; Aufgabe 4 zieht den Z7-Text nach, Aufgabe 8 schreibt den Fall neu (Montage, Entscheidung M1).
2. **`live` gibt es im Drehbuch `steuerung` weiterhin nicht.** Die Gliederung schreibt bei `FAKE_ABO_VERZOEGERUNG_MS` „(danach `live`)“ und bei `FAKE_PUFFERFEHLER_MS` „so lange nach `live`“. Die Attrappe sendet seit 4a nie `live`; das einzuführen hätte alle 409 Kern-Fälle berührt. `FAKE_PUFFERFEHLER_MS` zählt darum ab `video subscribed`. Für Q16/Q17 im Kern zählt nur das `error`-Ereignis mit `id`.
3. **Offenes Abo beim Abbau ohne `audio off`.** Die Gliederung sagt „meldet die Attrappe `unsubscribed`“; dass dabei kein `audio off` kommt, legt diese Aufgabe fest (der Ton war nie gemeldet). Der Kern ignoriert `audio` ohne bekannte Quelle ohnehin (`kern.ts:1244`).
4. **`FAKE_VERBINDUNG_ZURUECK_MS` sendet nach `inMeeting` zusätzlich `roster` und `privilege` `source:'check'`.** Die Gliederung nennt nur `connecting` und `inMeeting`. Das Original tut beides bei jedem `inMeeting` (`native/callbacks.cpp:78-95`, `native/session.cpp:450-467`). Mit Erlaubnis meldet `privilege` `canRecordRaw:true`; der Kern bleibt dann bei `erlaubnis 'ja'` (keine Änderung, kein zusätzlicher Abgleich). Der `roster` löst im Kern wie jeder `roster` einen Abgleich aus (`kern.ts:987-991`); bei gleichen Kennungen und laufenden Quellen abonniert er nichts.
5. **Entzug und Wiedererteilung nur im Meeting** (`if (!imMeeting) return;`): Endet das Meeting vor dem Zeitgeber, kommt kein `privilege`-Ereignis mehr — wie das Original, dem nach dem Meeting-Ende kein Rundruf mehr kommt. Bisher feuerte `FAKE_ENTZUG_MS` auch nach dem Meeting-Ende; kein Test nutzt diese Kombination.
6. **Zusätzliche Testfälle** über die Gliederung hinaus: „offenes Abo beim Entzug“ (Grundlage für Aufgabe 10 „Entzug während eines offenen Abos“), „Name wieder frei → ohne Zusatz“, `roster`/`privilege check` nach der Rückkehr, „... kein Abbau mit command oder meetingEnded“ (G18) und die Gegenprobe „ohne FAKE_NAMENSZEILE keine solche Zeile“. `fahreSteuerung` bekommt dafür den dritten Parameter `zeilen`.
7. Zeilenangaben gegenüber der Gliederung berichtigt: Entzug `:241-247` → 232–249 (mit `roster` und Namensprobe), `abbauen` `:211` → 206–217, `videoSubscribe` `:394-397` → 397–410; `protocol.ts` `:57-79`/`:100-108` → 72–73/106–108.
8. **`FAKE_NAMENSZEILE` mit 100 ms Abstand nach dem `roster`** (Montage MO3): Ohne Abstand kann die Zeile über stderr beim Kern ankommen, bevor er den `roster` von stdout gelesen hat; der Namens-Test aus Aufgabe 12 würde dann zufällig rot. Die Prüfungen dieser Aufgabe warten bis zu 2 s und bleiben grün (gemessen 498 + 31 `ok`).

---

### Task 2: Bridge nativ: Entzug baut alle Abos ab; Logzeilen ohne Teilnehmernamen

**Spec:** Nachtrag N4b.1 („Soll, Bridge“), N4b.2 („Keine Namen im Log“, Stellen `native/video.cpp` und, bei der Nachbesserung des Plans gefunden, die unlesbare Ereigniszeile in `src/bridge.ts:336`), 3.2-23; Plan L1, L11, L17, L23 (Messung M18).

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\zoom-4b` (Branch `feat/zoom-stage4b`).

**Files:**
- Modify: `packages/zoom-bridge/native/callbacks.cpp` — Zeilen 14–16 (Merker neben `g_meetingEndeOffen`), 246–249 (Ende von `onRecordPrivilegeChanged`)
- Modify: `packages/zoom-bridge/native/callbacks.h` — Zeile 113 (`callbacksTakeMeetingEndTeardown`)
- Modify: `packages/zoom-bridge/native/main.cpp` — Zeilen 419–421 (Ende des Meeting-Ende-Blocks, vor `videoTick()` Zeile 427)
- Modify: `packages/zoom-bridge/native/video.cpp` — Zeilen 522–526 (Kopf von `videoAbbauAlle`), 623–626 (`videoShutdownAll`), 1325–1329 und 1337–1338 (Logzeilen mit `name`)
- Modify: `packages/zoom-bridge/native/video.h` — Zeilen 53–56 (`videoMeetingEnded`)
- Modify: `packages/zoom-bridge/native/session.cpp` — Zeilen 525–527 (`sessionClearRawRecording`)
- Modify: `packages/zoom-bridge/native/session.h` — Zeilen 377–379 (`sessionClearRawRecording`)
- Modify: `packages/zoom-bridge/README.md` — Zeile 284 (`privilege`), 334 (`reason`), 416–418 (Abschnitt 7), 512–513 (Ton-Gründe)
- Modify: `packages/zoom-bridge/src/bridge.ts` — Zeilen 333–338 (`handleLine`: eine unlesbare Zeile, die wie ein Ereignis beginnt, nur mit Länge und Ereignisart ins Log)
- Test: `packages/zoom-bridge/test/selftest.ts` — neuer Block „Nativer Teil — Quelltext-Wächter (Stage 4b)“ vor der Schlusszeile (nach Aufgabe 1 Zeile 2592); Zeilen 979–980 (Gruppe „bridge - kaputte Zeilen reissen nichts ab“, zwei Prüfungen mehr)
- Test: `packages/zoom-bridge/test/fake-bridge.mjs` — Zeilen 72–73 (Drehbuch `messy` schreibt zusätzlich eine abgeschnittene `roster`-Zeile mit Namen)
- Bewusst unverändert: `packages/zoom-bridge/CMakeLists.txt`, `native/audio.*`, `native/emit.*`, `native/ndi_sender.*` (G7).

Zeilenangaben gelten für den Stand nach Aufgabe 1 (die native Seite, das README, `src/bridge.ts` und das Drehbuch `messy` berührt Aufgabe 1 nicht).

**Interfaces:**
- Consumes: Aufgabe 1 — Grund `'privilegeRevoked'` in `VideoReason`/`AudioReason` (die native Seite schreibt den Text `"privilegeRevoked"` auf die Leitung).
- Produces (C++, nur innerhalb von `native/`):
  ```cpp
  // callbacks.h - true genau einmal je Entzug; gesetzt in onRecordPrivilegeChanged(false),
  // genommen in main() nach pumpOnce() und nach dem Meeting-Ende-Abbau.
  bool callbacksTakePrivilegeRevokedTeardown();
  // video.h - alle Abos abbauen, Grund "privilegeRevoked", SDK abmelden, NDI-Sender schliessen.
  // Nie aus einem SDK-Rueckruf. Tut nichts ohne Abos.
  void videoPrivilegeRevoked();
  // session.h - StopRawRecording(), falls der Schalter lag; setzt das Merkzeichen IMMER (zuerst)
  // zurueck; meldet den Rueckgabewert auf stderr.
  SDKError sessionStopRawRecording();
  ```
  Leitung beim Entzug (unverändert dieselbe Form wie beim Meeting-Ende): `{"ev":"privilege","canRecordRaw":false,"source":"broadcast"}`, dann je Abo `{"ev":"audio",…,"state":"off","reason":"privilegeRevoked"}` (nur bei Ton) und `{"ev":"video",…,"state":"unsubscribed","reason":"privilegeRevoked",…}`.
  Neue stderr-Zeilen (Texttabelle 8, „Bridge nativ“): `Entzug: Abbau angemeldet, laeuft nach pumpOnce()` · `Entzug: Ton-Abo abmelden (ausserhalb des Rueckrufs)` · `Entzug: Bild-Abos abbauen` · `Entzug: Rohdaten-Aufnahme beenden` · `Entzug: StopRawRecording() meldet SDKError=<n>` bzw. `Entzug: StopRawRecording() nicht gerufen - der Rohdaten-Schalter lag nicht` bzw. `Entzug: StopRawRecording() nicht moeglich - kein Aufnahme-Regler` · `Wiederbeitritt <id>: Name ist nicht eindeutig (<t> Teilnehmer, <a> Abos) - kein Umhaengen, die Quelle bleibt schwarz.` · `Wiederbeitritt <id>: kein Abo gehoert zu diesem Gast - kein Umhaengen.`
- Produces (TypeScript, `src/bridge.ts`, über `onLog`): Eine unlesbare stdout-Zeile, die (nach führendem Leerraum) mit `{` beginnt, meldet `unlesbare Zeile (<n> Zeichen, beginnt mit {"ev":"<art>")` bzw. `… beginnt mit {)`, ohne ihren Inhalt. Jede andere unlesbare Zeile (fremde Zeilen des SDK, der Normalfall) bleibt wörtlich: `unlesbare Zeile: <zeile>`.

**Regeln für diese Aufgabe:** G7 (nur `callbacks.cpp/.h`, `main.cpp`, `video.cpp/.h`, `session.cpp/.h`; `CMakeLists.txt` unberührt; CI kompiliert kein C++), G5/N4b.2 (keine `emitLog`-Zeile mit Teilnehmernamen, keine kaputte Ereigniszeile im Klartext), G13, G14 (alle Dateien CRLF), G15, G18, L1 (Abbau nie im Rundruf), L17 (Bau nur am Entwicklungs-PC).

---

- [ ] **Step 1: Fehlschlagende Tests schreiben: Quelltext-Wächter und kaputte Ereigniszeile** (`packages/zoom-bridge/test/selftest.ts`, Schlusszeile, nach Aufgabe 1 Zeile 2592)

Vorher:
```ts
console.log(failures === 0 ? '\nAlle Selbsttests bestanden.' : `\n${failures} Selbsttest(s) fehlgeschlagen.`);
```
Nachher:
```ts
// --- Stage 4b: nativer Teil - Quelltext-Waechter ------------------------------------
// Laufen OHNE Compiler und ohne SDK, auch unter Linux (CI). Sie sichern nur die
// STRUKTUR (wer ruft was, in welcher Reihenfolge, was steht im Log); ob die Bridge
// sich am echten SDK so verhaelt, belegt erst die Abnahme 0.3.0 (Messung M18).

import { readFileSync, readdirSync } from 'node:fs';

const nativOrdner = join(testDir, '..', 'native');

/**
 * C++-Quelltext ohne Kommentare: jedes Zeichen eines Kommentars wird ein Leerzeichen,
 * Zeilenumbrueche bleiben (Zeilennummern stimmen weiter). Mit `ohneTexte` werden auch
 * die INHALTE von "..."- und '...'-Literalen geleert (die Anfuehrungszeichen bleiben):
 * ein Wort in einem Logtext ist kein Bezeichner.
 */
function cppOhneKommentare(src: string, ohneTexte = false): string {
  let aus = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') { aus += ' '; i++; }
      continue;
    }
    if (c === '/' && n === '*') {
      const ende = src.indexOf('*/', i + 2);
      const bis = ende < 0 ? src.length : ende + 2;
      aus += src.slice(i, bis).replace(/[^\n]/g, ' ');
      i = bis;
      continue;
    }
    if (c === '"' || c === "'") {
      aus += c;
      i++;
      while (i < src.length && src[i] !== c) {
        const schritt = src[i] === '\\' ? 2 : 1;
        const stueck = src.slice(i, i + schritt);
        aus += ohneTexte ? stueck.replace(/[^\n]/g, ' ') : stueck;
        i += schritt;
      }
      aus += c;
      i++;
      continue;
    }
    aus += c;
    i++;
  }
  return aus;
}

/** Der Rumpf `{ ... }` nach der ersten Fundstelle von `kopf` (Klammern gezaehlt), sonst ''. */
function rumpf(src: string, kopf: string): string {
  const stelleKopf = src.indexOf(kopf);
  if (stelleKopf < 0) return '';
  const auf = src.indexOf('{', stelleKopf + kopf.length);
  if (auf < 0) return '';
  let tiefe = 0;
  for (let i = auf; i < src.length; i++) {
    if (src[i] === '{') tiefe++;
    else if (src[i] === '}' && --tiefe === 0) return src.slice(auf, i + 1);
  }
  return '';
}

const nativ = (datei: string, ohneTexte = false): string =>
  cppOhneKommentare(readFileSync(join(nativOrdner, datei), 'utf8'), ohneTexte);

console.log('\nNativer Teil — Quelltext-Waechter (Stage 4b):');
{
  // N4b.2: keine emitLog-Anweisung fuehrt einen Teilnehmernamen. Je Aufruf
  // `emitLog(` bis zum naechsten `;`, Texte vorher geleert.
  const namensBezeichner = /\b(name|displayName|userName|nameOut)\b|GetUserName/;
  let gefunden = 0;
  const treffer: string[] = [];
  for (const datei of readdirSync(nativOrdner).filter((f) => f.endsWith('.cpp')).sort()) {
    const src = nativ(datei, true);
    const aufruf = /(?<!void\s)\bemitLog\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = aufruf.exec(src)) !== null) {
      gefunden++;
      const anweisung = src.slice(m.index, src.indexOf(';', m.index));
      if (namensBezeichner.test(anweisung)) treffer.push(`${datei}:${src.slice(0, m.index).split('\n').length}`);
    }
  }
  assert(gefunden > 40, 'nativ: der Waechter findet die emitLog-Anweisungen (mehr als 40)');
  assert(treffer.length === 0, 'nativ: keine emitLog-Anweisung führt einen Teilnehmernamen');
  if (treffer.length > 0) console.error(`      Treffer: ${treffer.join(', ')}`);
}
{
  // L1 / Lehre vom 18.08.2026: im Rundruf NUR den Merker setzen - unSubscribe() aus
  // einem SDK-Rueckruf beendete die Bridge mit 0xC0000005.
  const koerper = rumpf(nativ('callbacks.cpp', true), 'void RecordingListener::onRecordPrivilegeChanged(bool bCanRec)');
  assert(/if\s*\(\s*!\s*bCanRec\s*\)\s*\{[^}]*g_entzugAbbauOffen\s*=\s*true/.test(koerper),
    'nativ: onRecordPrivilegeChanged setzt bei false den Merker g_entzugAbbauOffen');
  assert(koerper !== '' && !/\b(videoAbbauAlle|videoPrivilegeRevoked|videoShutdownAll|videoMeetingEnded|videoUnsubscribe|audioClearSubscribed|audioShutdown|unSubscribe|destroyRenderer|StopRawRecording|sessionStopRawRecording)\b/.test(koerper),
    'nativ: onRecordPrivilegeChanged ruft keinen Abbau und kein unSubscribe/StopRawRecording');
}
{
  const main = nativ('main.cpp', true);
  const schleife = main.slice(Math.max(0, main.indexOf('while (!g_quit) {')));
  const iPumpe = schleife.indexOf('pumpOnce(');
  const iEnde = schleife.indexOf('callbacksTakeMeetingEndTeardown(');
  const iEntzug = schleife.indexOf('callbacksTakePrivilegeRevokedTeardown(');
  const iTakt = schleife.indexOf('videoTick(');
  assert(main.includes('while (!g_quit) {') && iPumpe >= 0 && iEnde > iPumpe && iEntzug > iEnde && iTakt > iEntzug,
    'nativ: main.cpp arbeitet den Entzug nach pumpOnce() und vor videoTick() ab (nach dem Meeting-Ende-Abbau)');
  const block = rumpf(schleife, 'if (callbacksTakePrivilegeRevokedTeardown())');
  const iTon = block.indexOf('audioClearSubscribed(');
  const iBild = block.indexOf('videoPrivilegeRevoked(');
  const iRoh = block.indexOf('sessionStopRawRecording(');
  assert(iTon >= 0 && iBild > iTon && iRoh > iBild,
    'nativ: Reihenfolge im Entzug-Block: audioClearSubscribed, videoPrivilegeRevoked, sessionStopRawRecording');
}
{
  const koerper = rumpf(nativ('video.cpp'), 'void videoPrivilegeRevoked()');
  assert(/videoAbbauAlle\(\s*"privilegeRevoked"\s*,\s*true\s*\)/.test(koerper),
    'nativ: videoPrivilegeRevoked baut mit videoAbbauAlle("privilegeRevoked", true) ab');
  const stopp = rumpf(nativ('session.cpp', true), 'SDKError sessionStopRawRecording()');
  const iZurueck = stopp.indexOf('g_rawRecordingOn.exchange(false)');
  const iReturn = stopp.indexOf('return');
  assert(iZurueck >= 0 && iReturn > iZurueck && stopp.includes('StopRawRecording()'),
    'nativ: sessionStopRawRecording setzt das Merkzeichen vor jedem return zurück und ruft StopRawRecording()');
  assert(/\bbool\s+callbacksTakePrivilegeRevokedTeardown\(\s*\)\s*;/.test(nativ('callbacks.h'))
      && /\bvoid\s+videoPrivilegeRevoked\(\s*\)\s*;/.test(nativ('video.h'))
      && /\bSDKError\s+sessionStopRawRecording\(\s*\)\s*;/.test(nativ('session.h')),
    'nativ: callbacks.h, video.h und session.h erklären die drei neuen Funktionen');
}

console.log(failures === 0 ? '\nAlle Selbsttests bestanden.' : `\n${failures} Selbsttest(s) fehlgeschlagen.`);
```
Hinweise: `testDir` und `join` (Zeilen 847–849) sind schon da. `readFileSync` und `readdirSync` werden hier neu importiert; `selftest.ts` importiert sie bisher nicht und nutzt die Namen nicht (nur in Kommentaren, Zeilen 237 und 2118). Ein `import` mitten in der Datei ist hier üblich (Zeilen 492, 845–847, 1585–1588). Die Wächter lesen nur Quelltext: Kommentare werden zu Leerzeichen, für die `emitLog`- und Rumpf-Prüfungen auch die Inhalte von Zeichenketten (ein Wort in einem Logtext ist kein Bezeichner). Die erste Prüfung zählt die gefundenen `emitLog`-Anweisungen (heute 50, nach dieser Aufgabe 57), damit ein kaputter Sucher nicht still „keine Treffer“ meldet.

Zweiter Teil (N4b.2, bei der Nachbesserung des Plans gefunden): `src/bridge.ts` gibt eine stdout-Zeile, die sich nicht als JSON lesen lässt, heute wörtlich an `onLog` weiter (`unlesbare Zeile: ${line}`). Ist das eine zerrissene oder vermischte Ereigniszeile (`roster`, `joined`, `renamed`), stehen die Namen darin im Klartext im Log; `maskiereNamen` im Kern (Aufgabe 12) kennt nur Namen aus lesbaren Ereignissen. Das Drehbuch `messy` schreibt dafür zusätzlich eine abgeschnittene `roster`-Zeile.

Datei `packages/zoom-bridge/test/fake-bridge.mjs` (Drehbuch `messy`, Zeilen 72–73). Vorher:
```js
    process.stdout.write('das hier ist kein json\n');
    say({ ev: 'auth', code: 0 });
```
Nachher:
```js
    process.stdout.write('das hier ist kein json\n');
    // Stage 4b (N4b.2): eine abgeschnittene Ereigniszeile MIT Teilnehmernamen. Die Bruecke darf
    // von ihr nur Laenge und Ereignisart ins Log geben, nie den Inhalt.
    process.stdout.write('{"ev":"roster","list":[{"id":7,"name":"Anna Maria Beispiel","self":false\n');
    say({ ev: 'auth', code: 0 });
```

Datei `packages/zoom-bridge/test/selftest.ts` (Gruppe „bridge - kaputte Zeilen reissen nichts ab“, Zeilen 979–980). Vorher:
```ts
  assert(logs.some((l) => l.includes('das hier ist kein json')), 'die unlesbare Zeile wird ueber onLog gemeldet, nicht nur uebersprungen');
  await b.stop();
```
Nachher:
```ts
  assert(logs.some((l) => l.includes('das hier ist kein json')), 'die unlesbare Zeile wird ueber onLog gemeldet, nicht nur uebersprungen');
  // Stage 4b (N4b.2): Eine kaputte EREIGNIS-Zeile kann Teilnehmernamen tragen. Von ihr stehen nur
  // Laenge und Ereignisart im Log; fremde Zeilen des SDK (oben) bleiben woertlich.
  assert(
    logs.some((l) => /^unlesbare Zeile \(\d+ Zeichen, beginnt mit \{"ev":"roster"\)$/.test(l)),
    'eine kaputte roster-Zeile steht nur mit Laenge und Ereignisart im Log',
  );
  assert(!logs.some((l) => l.includes('Anna Maria')), 'kein Teilnehmername aus der kaputten Zeile im Log (N4b.2)');
  await b.stop();
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/zoom-bridge
```
Erwartet: alle bisherigen Gruppen grün bis auf die zwei neuen Prüfungen in „bridge - kaputte Zeilen reissen nichts ab“, im neuen Block 2 `ok` und 7 `FAIL`, Exitcode ≠ 0:
```
bridge - kaputte Zeilen reissen nichts ab:
  ok  trotz halber Zeile und Muell wird inMeeting erreicht
  ok  die unlesbare Zeile wird ueber onLog gemeldet, nicht nur uebersprungen
FAIL  eine kaputte roster-Zeile steht nur mit Laenge und Ereignisart im Log
FAIL  kein Teilnehmername aus der kaputten Zeile im Log (N4b.2)
…
Nativer Teil — Quelltext-Waechter (Stage 4b):
  ok  nativ: der Waechter findet die emitLog-Anweisungen (mehr als 40)
FAIL  nativ: keine emitLog-Anweisung führt einen Teilnehmernamen
      Treffer: video.cpp:1326, video.cpp:1337
FAIL  nativ: onRecordPrivilegeChanged setzt bei false den Merker g_entzugAbbauOffen
  ok  nativ: onRecordPrivilegeChanged ruft keinen Abbau und kein unSubscribe/StopRawRecording
FAIL  nativ: main.cpp arbeitet den Entzug nach pumpOnce() und vor videoTick() ab (nach dem Meeting-Ende-Abbau)
FAIL  nativ: Reihenfolge im Entzug-Block: audioClearSubscribed, videoPrivilegeRevoked, sessionStopRawRecording
FAIL  nativ: videoPrivilegeRevoked baut mit videoAbbauAlle("privilegeRevoked", true) ab
FAIL  nativ: sessionStopRawRecording setzt das Merkzeichen vor jedem return zurück und ruft StopRawRecording()
FAIL  nativ: callbacks.h, video.h und session.h erklären die drei neuen Funktionen

9 Selbsttest(s) fehlgeschlagen.
```
(Gemessen: 500 `ok`-Zeilen.) `npm run typecheck -w @jm/zoom-bridge` ist schon jetzt grün; rot ist hier nur die Laufzeit.

- [ ] **Step 3: Merker für den Entzug** (`packages/zoom-bridge/native/callbacks.cpp`, Zeilen 14–16)

Vorher:
```cpp
static std::atomic<bool> g_meetingEndeOffen{false};

bool callbacksTakeMeetingEndTeardown() { return g_meetingEndeOffen.exchange(false); }
```
Nachher:
```cpp
static std::atomic<bool> g_meetingEndeOffen{false};

bool callbacksTakeMeetingEndTeardown() { return g_meetingEndeOffen.exchange(false); }

// Dasselbe Muster fuer den ENTZUG der Aufnahme-Erlaubnis (Stage 4b, N4b.1):
// onRecordPrivilegeChanged(false) setzt es, main() nimmt es nach pumpOnce() und
// baut dort ab - nie im Rueckruf (siehe das Meeting-Ende unten, 0xC0000005).
static std::atomic<bool> g_entzugAbbauOffen{false};

bool callbacksTakePrivilegeRevokedTeardown() { return g_entzugAbbauOffen.exchange(false); }
```

- [ ] **Step 4: Der Rundruf setzt bei `false` nur den Merker** (`packages/zoom-bridge/native/callbacks.cpp`, vorher Zeilen 246–249, nach Step 3 Zeilen 253–256)

Vorher:
```cpp
  sessionSetCanRecordRaw(bCanRec);
  emitRaw(std::string("{\"ev\":\"privilege\",\"canRecordRaw\":") + (bCanRec ? "true" : "false") +
          ",\"source\":\"broadcast\"}");
}
```
Nachher:
```cpp
  sessionSetCanRecordRaw(bCanRec);
  emitRaw(std::string("{\"ev\":\"privilege\",\"canRecordRaw\":") + (bCanRec ? "true" : "false") +
          ",\"source\":\"broadcast\"}");
  if (!bCanRec) {
    // ENTZUG (Stage 4b, N4b.1). Zoom verlangt: "The app must stop accessing
    // content if permission is revoked." Bis 4a sperrte der Entzug nur NEUE
    // Abos (videoSubscribe() prueft sessionCanRecordRaw()); laufende sendeten
    // weiter.
    //
    // NICHT HIER ABBAUEN - dieselbe Lehre wie beim Meeting-Ende (18.08.2026):
    // dieser Rueckruf kommt INNERHALB von pumpOnce(), und unSubscribe() aus
    // einem SDK-Rueckruf beendete die Bridge mit 0xC0000005. Nur das
    // Merkzeichen setzen; main() baut nach pumpOnce() ab, im selben
    // Schleifendurchlauf.
    //
    // Kommt die Wiedererteilung in DERSELBEN Pumprunde (true nach false), steht
    // sie schon auf der Leitung, BEVOR abgebaut wird - abgebaut wird trotzdem:
    // die Abos gehoerten zur entzogenen Erlaubnis, neu abonniert der Aufrufer.
    g_entzugAbbauOffen = true;
    emitLog(L"Entzug: Abbau angemeldet, laeuft nach pumpOnce()");
  }
}
```

- [ ] **Step 5: Erklärung in `callbacks.h`** (`packages/zoom-bridge/native/callbacks.h`, Zeile 113)

Vorher:
```cpp
bool callbacksTakeMeetingEndTeardown();
```
Nachher:
```cpp
bool callbacksTakeMeetingEndTeardown();

// NIMMT das Merkzeichen "die Aufnahme-Erlaubnis ist entzogen, die Abos gehoeren
// abgebaut" und LOESCHT es dabei (exchange): true genau einmal je Entzug.
// Gesetzt in onRecordPrivilegeChanged(false), genommen in main() unmittelbar
// NACH pumpOnce() und nach dem Meeting-Ende-Abbau - aus demselben gemessenen
// Grund wie oben nie aus dem Rueckruf (Stage 4b, N4b.1).
bool callbacksTakePrivilegeRevokedTeardown();
```

- [ ] **Step 6: Kopf von `videoAbbauAlle` nennt den dritten Grund** (`packages/zoom-bridge/native/video.cpp`, Zeilen 522–526)

Vorher:
```cpp
// Baut ALLE Abos ab und meldet jedes einzeln mit der uebergebenen Ursache.
// Zwei Aufrufer, zwei WAHRE Ursachen: der Aufrufer hat es befohlen ("command",
// ueber leave/quit/EOF) oder das Meeting ist zu Ende ("meetingEnded"). Ein
// gemeinsamer Rumpf, damit die beiden Wege nicht auseinanderlaufen - der
// Abbau selbst ist in beiden Faellen derselbe.
```
Nachher:
```cpp
// Baut ALLE Abos ab und meldet jedes einzeln mit der uebergebenen Ursache.
// Drei Aufrufer, drei WAHRE Ursachen: der Aufrufer hat es befohlen ("command",
// ueber leave/quit/EOF), das Meeting ist zu Ende ("meetingEnded") oder der Host
// hat die Aufnahme-Erlaubnis entzogen ("privilegeRevoked", Stage 4b). Ein
// gemeinsamer Rumpf, damit die Wege nicht auseinanderlaufen - der Abbau selbst
// ist in allen Faellen derselbe.
```

- [ ] **Step 7: `videoPrivilegeRevoked()`** (`packages/zoom-bridge/native/video.cpp`, vorher Zeilen 623–626, nach Step 6 Zeilen 624–627)

Vorher:
```cpp
// Meeting LEBT noch (leave/quit/EOF) - das SDK gehoert ordentlich abgemeldet.
void videoShutdownAll() {
  videoAbbauAlle("command", true);
}
```
Nachher:
```cpp
// Meeting LEBT noch (leave/quit/EOF) - das SDK gehoert ordentlich abgemeldet.
void videoShutdownAll() {
  videoAbbauAlle("command", true);
}

// Die Aufnahme-Erlaubnis ist ENTZOGEN (Stage 4b, N4b.1). Das Meeting LEBT noch,
// die Renderer sind gueltig: also MIT SDK-Abmeldung wie beim Befehl, aber mit der
// EIGENEN Ursache "privilegeRevoked" (src/protocol.ts). Nur aus main() nach
// pumpOnce() rufen, nie aus einem SDK-Rueckruf (callbacks.h,
// callbacksTakePrivilegeRevokedTeardown). Ob unSubscribe() nach einem Entzug
// fehlerfrei zurueckkehrt, ist UNGEMESSEN (Messung M18); die Abbau-Marken in
// videoAbbauAlle() benennen bei einem Absturz die Zeile.
void videoPrivilegeRevoked() {
  if (g_subs.empty()) return;
  videoAbbauAlle("privilegeRevoked", true);
}
```

- [ ] **Step 8: Logzeile „Name ist nicht eindeutig“ ohne Namen** (`packages/zoom-bridge/native/video.cpp`, vorher Zeilen 1325–1329, nach Step 7 Zeilen 1338–1342)

Vorher:
```cpp
      // einen Fehler haelt.
      emitLog(L"Wiederbeitritt " + std::to_wstring(userId) + L" (" + name +
              L"): Name ist nicht eindeutig (" + std::to_wstring(gleichnamigeTeilnehmer) +
              L" Teilnehmer, " + std::to_wstring(gleichnamigeAbos) +
              L" Abos) - kein Umhaengen, die Quelle bleibt schwarz.");
```
Nachher:
```cpp
      // einen Fehler haelt.
      // OHNE den Namen (Stage 4b, N4b.2): stderr landet im Log von JM Connect,
      // und dort stehen keine Teilnehmernamen - die Kennung genuegt.
      emitLog(L"Wiederbeitritt " + std::to_wstring(userId) +
              L": Name ist nicht eindeutig (" + std::to_wstring(gleichnamigeTeilnehmer) +
              L" Teilnehmer, " + std::to_wstring(gleichnamigeAbos) +
              L" Abos) - kein Umhaengen, die Quelle bleibt schwarz.");
```

- [ ] **Step 9: Logzeile „kein Abo gehoert zu diesem Gast“ ohne Namen** (`packages/zoom-bridge/native/video.cpp`, vorher Zeilen 1337–1338, nach Step 8 Zeilen 1352–1353)

Vorher:
```cpp
      emitLog(L"Wiederbeitritt " + std::to_wstring(userId) + L" (" + name +
              L"): kein Abo gehoert zu diesem Gast - kein Umhaengen.");
```
Nachher:
```cpp
      emitLog(L"Wiederbeitritt " + std::to_wstring(userId) +
              L": kein Abo gehoert zu diesem Gast - kein Umhaengen.");
```
(Die beiden Folgezeilen `emitLog(L"  neu:  " + fingerprint(persistentId));` und `emitLog(L"  Abo " + … + fingerprint(sub->persistentId));` bleiben: `fingerprint()` gibt nur die ersten sechs Zeichen und die Länge der `persistentId` aus, keinen Anzeigenamen (`video.cpp:1233-1238`).)

- [ ] **Step 10: Erklärung in `video.h`** (`packages/zoom-bridge/native/video.h`, Zeilen 53–56)

Vorher:
```cpp
 * Tut nichts, wenn es keine Abos gibt - der Normalfall bei jedem Meeting-Ende
 * ohne Video.
 */
void videoMeetingEnded();
```
Nachher:
```cpp
 * Tut nichts, wenn es keine Abos gibt - der Normalfall bei jedem Meeting-Ende
 * ohne Video.
 */
void videoMeetingEnded();

/**
 * Baut alle Abos ab, weil der Host die AUFNAHME-ERLAUBNIS ENTZOGEN hat (Stage 4b,
 * N4b.1), und meldet jedes einzeln mit reason:"privilegeRevoked" - Ton vor Bild,
 * NDI-Sender zu. Das Meeting lebt noch: die Abos werden beim SDK abgemeldet
 * (unSubscribe()/destroyRenderer()).
 *
 * NIE aus einem SDK-Rueckruf rufen - main() ruft sie nach pumpOnce(), wenn
 * callbacksTakePrivilegeRevokedTeardown() true liefert (callbacks.h). Tut nichts,
 * wenn es keine Abos gibt.
 */
void videoPrivilegeRevoked();
```

- [ ] **Step 11: `sessionStopRawRecording()`** (`packages/zoom-bridge/native/session.cpp`, Zeilen 525–527)

Vorher:
```cpp
void sessionClearRawRecording() {
  g_rawRecordingOn = false;
}
```
Nachher:
```cpp
void sessionClearRawRecording() {
  g_rawRecordingOn = false;
}

SDKError sessionStopRawRecording() {
  // Das Merkzeichen faellt IMMER, und zwar ZUERST: auch wenn StopRawRecording()
  // scheitert oder es keinen Regler mehr gibt, muss das naechste Abo nach der
  // Wiedererteilung StartRawRecording() neu rufen. Ein stehengebliebenes
  // Merkzeichen liesse es glauben, der Schalter liege noch (Stage 4b, L1).
  const bool warAn = g_rawRecordingOn.exchange(false);
  if (!warAn) {
    // Die Zahl wird NICHT erfunden: ohne gelegten Schalter gibt es nichts zu
    // stoppen, und ein "SDKError=0" saehe aus wie ein gemessener Erfolg.
    emitLog(L"Entzug: StopRawRecording() nicht gerufen - der Rohdaten-Schalter lag nicht");
    return SDKERR_SUCCESS;
  }
  IMeetingRecordingController* rec = recordingCtrl();
  if (rec == nullptr) {
    emitLog(L"Entzug: StopRawRecording() nicht moeglich - kein Aufnahme-Regler");
    return SDKERR_SERVICE_FAILED;
  }
  const SDKError err = rec->StopRawRecording();
  // IMMER mit Zahl, auch bei Erfolg: Messung M18 fragt genau diesen Wert ab.
  emitLog(std::wstring(L"Entzug: StopRawRecording() meldet SDKError=") + std::to_wstring(static_cast<int>(err)));
  return err;
}
```
`recordingCtrl()` (Zeile 385), `g_rawRecordingOn` (Zeile 55, `std::atomic<bool>`), `emitLog` (über `emit.h`) und `std::wstring`/`std::to_wstring` (wie Zeile 277) sind in `session.cpp` schon vorhanden.

- [ ] **Step 12: Erklärung in `session.h`** (`packages/zoom-bridge/native/session.h`, Zeilen 377–379)

Vorher:
```cpp
 * Rohdaten seien schon frei.
 */
void sessionClearRawRecording();
```
Nachher:
```cpp
 * Rohdaten seien schon frei.
 */
void sessionClearRawRecording();

/**
 * Legt den Rohdaten-Schalter wieder um (IMeetingRecordingController::
 * StopRawRecording), weil der Host die Aufnahme-Erlaubnis ENTZOGEN hat (Stage 4b,
 * N4b.1) - das Gegenstueck zu sessionStartRawRecording(). Ruft das SDK nur, wenn
 * der Schalter in diesem Meeting gelegt war, und meldet den Rueckgabewert auf
 * stderr (Messung M18).
 *
 * Setzt das Merkzeichen IMMER zurueck, auch wenn StopRawRecording() scheitert:
 * das naechste Abo nach der Wiedererteilung muss StartRawRecording() neu rufen.
 * Nur aus main() nach pumpOnce() rufen (callbacksTakePrivilegeRevokedTeardown).
 *
 * @returns SDKERR_SUCCESS, wenn der Schalter nicht lag; SDKERR_SERVICE_FAILED ohne
 *          Aufnahme-Regler; sonst das, was StopRawRecording() geliefert hat.
 */
SDKError sessionStopRawRecording();
```

- [ ] **Step 13: Abbau in der Hauptschleife** (`packages/zoom-bridge/native/main.cpp`, Zeilen 419–421)

Vorher:
```cpp
      videoMeetingEnded();
      emitLog(L"Meeting-Ende: Abbau zurueckgekehrt, Bruecke laeuft weiter");
    }
```
Nachher:
```cpp
      videoMeetingEnded();
      emitLog(L"Meeting-Ende: Abbau zurueckgekehrt, Bruecke laeuft weiter");
    }
    // ABBAU NACH DEM ENTZUG DER AUFNAHME-ERLAUBNIS (Stage 4b, N4b.1) - dasselbe
    // Muster wie das Meeting-Ende darueber, aus demselben gemessenen Grund
    // ausserhalb des Rueckrufs. NACH dem Meeting-Ende-Block: endete das Meeting
    // in derselben Pumprunde, ist die Karte dort schon OHNE SDK-Abmeldung
    // geleert, und videoPrivilegeRevoked() findet nichts mehr, das es beim SDK
    // abmelden koennte. VOR videoTick(): kein Herzschlag mehr in Quellen, deren
    // Erlaubnis entzogen ist.
    //
    // Reihenfolge wie beim Meeting-Ende: erst der Ton-Lauscher, dann die
    // Bild-Abos (jedes meldet sich einzeln mit privilegeRevoked, Ton vor Bild,
    // NDI-Sender zu), zuletzt der Rohdaten-Schalter. Dessen Merkzeichen faellt
    // IMMER, damit das naechste Abo nach der Wiedererteilung StartRawRecording()
    // neu ruft. Ob das SDK die Lieferung beim Entzug ohnehin selbst einstellt
    // und ob Stop/Start danach fehlerfrei laufen, ist UNGEMESSEN (Messung M18).
    if (callbacksTakePrivilegeRevokedTeardown()) {
      emitLog(L"Entzug: Ton-Abo abmelden (ausserhalb des Rueckrufs)");
      audioClearSubscribed();
      emitLog(L"Entzug: Bild-Abos abbauen");
      videoPrivilegeRevoked();
      emitLog(L"Entzug: Rohdaten-Aufnahme beenden");
      sessionStopRawRecording();
    }
```
`main.cpp` bindet `session.h`, `video.h`, `callbacks.h` und `audio.h` schon ein (Zeilen 20–27). `audioClearSubscribed()` meldet den Ton-Lauscher ab und verlässt den Tonkanal (`audio.cpp:148-176`); das nächste Abo mit Ton tritt nach der Wiedererteilung über `audioEnsureSubscribed()` neu bei.

- [ ] **Step 14: Unlesbare Ereigniszeile ohne Inhalt ins Log** (`packages/zoom-bridge/src/bridge.ts`, Zeilen 333–338)

Vorher:
```ts
    if (wire === null) {
      // Eine kaputte Zeile ist Rauschen, kein Abbruch. Sie wird gemeldet, damit
      // sie nicht unbemerkt bleibt, und dann uebersprungen.
      (this.opts.onLog ?? ((l: string) => console.error(`[zoom-bridge] ${l}`)))(`unlesbare Zeile: ${line}`);
      return;
    }
```
Nachher:
```ts
    if (wire === null) {
      // Eine kaputte Zeile ist Rauschen, kein Abbruch. Sie wird gemeldet, damit
      // sie nicht unbemerkt bleibt, und dann uebersprungen. Beginnt sie wie ein
      // Ereignis ("{"), kann sie Teilnehmernamen tragen (roster, joined,
      // renamed): dann nur Laenge und Ereignisart, nie der Inhalt (Stage 4b,
      // N4b.2). Fremde Zeilen des SDK (der Normalfall) bleiben woertlich.
      const kopf = line.trimStart();
      const meldung = kopf.startsWith('{')
        ? `unlesbare Zeile (${line.length} Zeichen, beginnt mit ${/^\{"ev":"[A-Za-z]+"/.exec(kopf)?.[0] ?? '{'})`
        : `unlesbare Zeile: ${line}`;
      (this.opts.onLog ?? ((l: string) => console.error(`[zoom-bridge] ${l}`)))(meldung);
      return;
    }
```

- [ ] **Step 15: README, Protokoll** (`packages/zoom-bridge/README.md`, Zeile 284)

Vorher:
```markdown
| `privilege` | Stand der Rohdaten-Erlaubnis (`canRecordRaw`, `source`, optional `requested`/`denied`/`timedOut`). |
```
Nachher:
```markdown
| `privilege` | Stand der Rohdaten-Erlaubnis (`canRecordRaw`, `source`, optional `requested`/`denied`/`timedOut`). Entzieht der Host sie (`canRecordRaw:false`, `source:"broadcast"`), baut die Bridge danach alle Abos ab (Grund `privilegeRevoked`, Abschnitt 7). |
```

- [ ] **Step 16: README, Gründe des Bild-Abos** (`packages/zoom-bridge/README.md`, Zeile 334)

Vorher:
```markdown
| `reason` | `command` \| `frames` \| `cameraOff` \| `participantLeft` \| `rebound` \| `reboundByName` \| `bufferMismatch` \| `meetingEnded`. |
```
Nachher:
```markdown
| `reason` | `command` \| `frames` \| `cameraOff` \| `participantLeft` \| `rebound` \| `reboundByName` \| `bufferMismatch` \| `meetingEnded` \| `privilegeRevoked`. |
```

- [ ] **Step 17: README, Abschnitt 7 „Ein Abo überlebt den Entzug … NICHT“** (`packages/zoom-bridge/README.md`, Zeilen 416–418)

Vorher:
```markdown
> Stand des Abos ist mit `meetingEnded` jedoch eindeutig.

**Ein Abo überlebt einen Wiederbeitritt.** Verlässt ein abonnierter Gast das
```
Nachher:
```markdown
> Stand des Abos ist mit `meetingEnded` jedoch eindeutig.

**Ein Abo überlebt den Entzug der Aufnahme-Erlaubnis NICHT** (Stage 4b, JM
Connect 0.3.0). Zoom verlangt: „The app must stop accessing content if
permission is revoked." Kommt `privilege` mit `canRecordRaw:false` und
`source:"broadcast"`, baut die Bridge **alle** Abos ab und meldet jedes
**einzeln** mit `reason:"privilegeRevoked"` — Ton (`audio off`) vor Bild
(`video unsubscribed`), die NDI-Sender schließen, danach wird der
Rohdaten-Schalter (`StopRawRecording()`) zurückgenommen. Ein eigener Grund,
ausdrücklich **nicht** `command` (niemand hat etwas befohlen) und **nicht**
`meetingEnded` (das Meeting läuft weiter). Der Abbau läuft wie beim
Meeting-Ende **nicht** im SDK-Rückruf, sondern in `main()` direkt nach
`pumpOnce()` — ein `unSubscribe()` aus dem Rückruf heraus hat die Bridge am
18.08.2026 mit `0xC0000005` beendet. Kommen Entzug und Wiedererteilung in
derselben Pumprunde, steht `privilege … true` schon vor dem Abbau auf der
Leitung; abgebaut wird trotzdem. Nach der Wiedererteilung abonniert der
Aufrufer neu (JM Connect tut das selbst), `StartRawRecording()` läuft dann
erneut. **Ungemessen** (Messung M18 der Abnahme 0.3.0): ob das SDK die
Lieferung beim Entzug ohnehin selbst einstellt und ob `unSubscribe()`,
`StopRawRecording()` und danach `StartRawRecording()` fehlerfrei laufen —
stderr nennt jeden Schritt (`Entzug: …`) und den Rückgabewert von
`StopRawRecording()`.

**Ein Abo überlebt einen Wiederbeitritt.** Verlässt ein abonnierter Gast das
```

- [ ] **Step 18: README, Gründe des Tons** (`packages/zoom-bridge/README.md`, vorher Zeilen 512–513, nach Step 17 Zeilen 533–534)

Vorher:
```markdown
`gap` (der Stille-Herzschlag hat zugeschlagen), `participantLeft`,
`meetingEnded`, sowie `rebound`/`reboundByName` — der Ton folgt hier
```
Nachher:
```markdown
`gap` (der Stille-Herzschlag hat zugeschlagen), `participantLeft`,
`meetingEnded`, `privilegeRevoked` (der Host hat die Aufnahme-Erlaubnis
entzogen, Abschnitt 7), sowie `rebound`/`reboundByName` — der Ton folgt hier
```

- [ ] **Step 19: Test laufen lassen (grün)**

```
npm run selftest -w @jm/zoom-bridge
```
Erwartet: keine Zeile `FAIL`, Exitcode 0, in der Gruppe der kaputten Zeilen und im neuen Block:
```
bridge - kaputte Zeilen reissen nichts ab:
  ok  trotz halber Zeile und Muell wird inMeeting erreicht
  ok  die unlesbare Zeile wird ueber onLog gemeldet, nicht nur uebersprungen
  ok  eine kaputte roster-Zeile steht nur mit Laenge und Ereignisart im Log
  ok  kein Teilnehmername aus der kaputten Zeile im Log (N4b.2)
…
Nativer Teil — Quelltext-Waechter (Stage 4b):
  ok  nativ: der Waechter findet die emitLog-Anweisungen (mehr als 40)
  ok  nativ: keine emitLog-Anweisung führt einen Teilnehmernamen
  ok  nativ: onRecordPrivilegeChanged setzt bei false den Merker g_entzugAbbauOffen
  ok  nativ: onRecordPrivilegeChanged ruft keinen Abbau und kein unSubscribe/StopRawRecording
  ok  nativ: main.cpp arbeitet den Entzug nach pumpOnce() und vor videoTick() ab (nach dem Meeting-Ende-Abbau)
  ok  nativ: Reihenfolge im Entzug-Block: audioClearSubscribed, videoPrivilegeRevoked, sessionStopRawRecording
  ok  nativ: videoPrivilegeRevoked baut mit videoAbbauAlle("privilegeRevoked", true) ab
  ok  nativ: sessionStopRawRecording setzt das Merkzeichen vor jedem return zurück und ruft StopRawRecording()
  ok  nativ: callbacks.h, video.h und session.h erklären die drei neuen Funktionen

Alle Selbsttests bestanden.
```
Gemessen: 509 + 31 = 540 `ok`-Zeilen. Dieselben Wächter sind beim Planen auch mit LF-Dateien in `native/` gelaufen (wie nach einem Checkout unter Linux): alle neun `ok`.

- [ ] **Step 20: Typecheck**

```
npm run typecheck -w @jm/zoom-bridge
```
Erwartet: keine Ausgabe von `tsc`, Exitcode 0.

- [ ] **Step 21: Commit** (Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add packages/zoom-bridge/native/callbacks.cpp packages/zoom-bridge/native/callbacks.h packages/zoom-bridge/native/main.cpp packages/zoom-bridge/native/video.cpp packages/zoom-bridge/native/video.h packages/zoom-bridge/native/session.cpp packages/zoom-bridge/native/session.h packages/zoom-bridge/README.md packages/zoom-bridge/src/bridge.ts packages/zoom-bridge/test/fake-bridge.mjs packages/zoom-bridge/test/selftest.ts
git status --short
```
Erwartet genau diese gestagten Zeilen:
```
M  packages/zoom-bridge/README.md
M  packages/zoom-bridge/native/callbacks.cpp
M  packages/zoom-bridge/native/callbacks.h
M  packages/zoom-bridge/native/main.cpp
M  packages/zoom-bridge/native/session.cpp
M  packages/zoom-bridge/native/session.h
M  packages/zoom-bridge/native/video.cpp
M  packages/zoom-bridge/native/video.h
M  packages/zoom-bridge/src/bridge.ts
M  packages/zoom-bridge/test/fake-bridge.mjs
M  packages/zoom-bridge/test/selftest.ts
```
Dann:
```
git commit -m "feat(zoom-bridge): Entzug baut alle Abos ab (ausserhalb des Rueckrufs); Logzeilen ohne Teilnehmernamen" -m "onRecordPrivilegeChanged(false) setzt nur einen Merker; main() baut nach pumpOnce() und nach dem Meeting-Ende-Block ab: audioClearSubscribed, videoPrivilegeRevoked (videoAbbauAlle mit privilegeRevoked und SDK-Abmeldung, NDI-Sender zu), sessionStopRawRecording (Merkzeichen faellt immer, Rueckgabewert auf stderr). Die beiden Wiederbeitritt-Zeilen in video.cpp nennen nur noch die Kennung. bridge.ts gibt eine unlesbare Ereigniszeile nur mit Laenge und Ereignisart ins Log, fremde SDK-Zeilen weiter woertlich. Quelltext-Waechter im Selbsttest (ohne Compiler, auch unter Linux). README Abschnitte 6 und 7. Nativ ungemessen: Messung M18 der Abnahme 0.3.0." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Gegenprobe (beim Planen am nachgespielten Stand nach Step 19 gemessen, kein Umsetzungsschritt):**
1. Name zurück in die Logzeile: in `video.cpp` `emitLog(L"Wiederbeitritt " + std::to_wstring(userId) +` / `L": kein Abo …` → `emitLog(L"Wiederbeitritt " + std::to_wstring(userId) + L" (" + name +` / `L"): kein Abo …` → genau ein `FAIL  nativ: keine emitLog-Anweisung führt einen Teilnehmernamen` mit `Treffer: video.cpp:1352`.
2. Entzug-Block in `main.cpp` hinter `videoTick();` verschoben → genau ein `FAIL  nativ: main.cpp arbeitet den Entzug nach pumpOnce() und vor videoTick() ab (nach dem Meeting-Ende-Abbau)`.
3. In `bridge.ts` die Bedingung `kopf.startsWith('{')` durch `false` ersetzt (jede unlesbare Zeile wieder wörtlich) → genau zwei `FAIL` (`eine kaputte roster-Zeile steht nur mit Laenge und Ereignisart im Log`, `kein Teilnehmername aus der kaputten Zeile im Log (N4b.2)`), 507 `ok`-Zeilen.
Rückbau jeweils byte-gleich.

#### Bau auf dem Windows-Entwicklungs-PC — nach dem Commit, ohne neuen Commit (L17)

Das Ergebnis jedes Schritts kommt in den Bericht der Aufgabe. Fehlt das SDK (`ZOOM_SDK_DIR` leer oder ohne `x64\bin\sdk.dll`), endet die Aufgabe hier mit Status `DONE_WITH_CONCERNS` und dem Vermerk „Bau nicht geprüft: ZOOM_SDK_DIR fehlt“; der Controller baut (Abschnitt „Nach der Umsetzung“). Keine EXE aus einem anderen Checkout kopieren. Den SDK-Pfad nennt der Controller (4a-Ledger, Ruling zu den Bau-Schritten); im übergeordneten Ablageordner nichts öffnen oder auflisten.

- [ ] **Step 22: Bridge bauen**

```
echo "ZOOM_SDK_DIR=$ZOOM_SDK_DIR"; echo "NDI_SDK_DIR=$NDI_SDK_DIR"
test -f "$ZOOM_SDK_DIR/x64/bin/sdk.dll" && test -f "$NDI_SDK_DIR/Bin/x64/Processing.NDI.Lib.x64.dll" && echo "Voraussetzungen da"
npm run rebuild -w @jm/zoom-bridge
node --input-type=module -e "import { bridgeExeFrisch } from './packages/zoom-bridge/scripts/auslieferung.mjs'; const r = bridgeExeFrisch('packages/zoom-bridge'); console.log(r.ok ? 'zoom-bridge.exe frisch' : r.text);"
```
Erwartet: `Voraussetzungen da`; der CMake/MSVC-Bau endet ohne Fehler; danach `zoom-bridge.exe frisch` (`packages/zoom-bridge/build/Release/zoom-bridge.exe` ist jünger als jede Datei in `native\` und als `CMakeLists.txt`; `build/` ist über `packages/zoom-bridge/.gitignore` ausgeschlossen). Bricht der Bau mit `C2039` an `StopRawRecording` ab (kein Mitglied von `IMeetingRecordingController`), nicht raten: `DONE_WITH_CONCERNS` mit der Compilermeldung (Annahme dieses Plans: SDK 7.1.5 erklärt `StopRawRecording()` neben `StartRawRecording()` in `meeting_recording_interface.h`; im Repo ungeprüft, weil das SDK dort fehlt). `git status --short` zeigt danach nichts Neues.

Belegt ist das native Verhalten damit noch nicht: Ob der Entzug am echten SDK so abläuft (Abmelden ohne Absturz, `StopRawRecording()` = 0, nach der Wiedererteilung `StartRawRecording()` = 0, Bild und Ton im NDI-Monitor sofort weg), misst erst die Abnahme 0.3.0 (M18, Aufgabe 21).

**Abweichungen von der Gliederung:**
1. **Logzeile von `StopRawRecording()` in `session.cpp`, nicht in `main.cpp`.** Die Gliederung lässt die Wahl („vorhandenen Helfer nutzen oder session-seitig loggen“). `logSdkError` ist nur in `video.cpp` definiert und nirgends erklärt; `sessionStopRawRecording()` loggt darum selbst, und zwar immer mit Zahl, auch bei Erfolg (M18 fragt genau diesen Wert), und unterscheidet „nicht gerufen“ von „gerufen und 0“.
2. **`videoPrivilegeRevoked()` kehrt ohne Abos sofort zurück** (wie `videoMeetingEnded()`), damit ein Entzug ohne Quellen keine „Abbau beginnt (…), 0 Abo(s)“-Zeilen erzeugt. `audioClearSubscribed()` und `sessionStopRawRecording()` laufen trotzdem (beide sind ohne Anmeldung bzw. ohne gelegten Schalter folgenlos und melden das).
3. **Merker-Name `g_entzugAbbauOffen`** (die Gliederung nennt nur die Funktion). Der Wächter prüft den Namen, damit „nur den Merker setzen“ prüfbar ist.
4. **Zusätzliche Wächter** über die Gliederung hinaus: Zählung der gefundenen `emitLog`-Anweisungen (> 40), der Merker im `false`-Zweig, Reihenfolge innerhalb des Entzug-Blocks, `sessionStopRawRecording` setzt das Merkzeichen vor jedem `return` zurück, und die drei Erklärungen in den Headern (ersetzt unter Linux den fehlenden Compiler für diese Frage). Die Reihenfolge-Prüfung verlangt zusätzlich, dass der Entzug-Block **nach** dem Meeting-Ende-Block steht (sonst riefe er nach einem Meeting-Ende in derselben Pumprunde `unSubscribe()` auf Renderer eines beendeten Meetings, die gemessene Absturzursache vom 18.08.).
5. **Kopfkommentar von `videoAbbauAlle`** (Zeilen 522–526) nennt jetzt drei Ursachen; in der Gliederung nicht genannt, sonst stünde dort „Zwei Aufrufer“ falsch.
6. **README:** neben dem Protokoll-Abschnitt (Zeile 334) auch die `privilege`-Zeile in Abschnitt 6 und die Ton-Gründe in Abschnitt 7. Die Tabelle „am echten Meeting gemessen“ (Abschnitt 4) bleibt unberührt: der Entzug ist dort nicht gemessen.
7. Zeilenangaben gegenüber der Gliederung berichtigt: `callbacks.cpp:233-249` → Merker 14–16 und Rundruf 246–249; `main.cpp:398-422` → 419–421; `session.cpp:514-527` → 525–527.
8. **Nachbesserung: `src/bridge.ts` und das Drehbuch `messy`** (Step 1 zweiter Teil, Step 14). Die Stellensuche für N4b.2 hatte die unlesbare stdout-Zeile übersehen: `handleLine` gab sie wörtlich an `onLog`, und eine zerrissene `roster`-Zeile trug so Namen ins Log, die `maskiereNamen` nicht kennen kann. Jetzt steht von einer Zeile, die wie ein Ereignis beginnt, nur Länge und Ereignisart im Log. Fremde Zeilen des SDK bleiben wörtlich, weil sie der Normalfall und die einzige Diagnose dafür sind (Prüfung „die unlesbare Zeile wird ueber onLog gemeldet“ unverändert). Dadurch verschieben sich die Steps 14–21 dieser Aufgabe um eins (Bau jetzt Step 22).

---

### Task 3: Bridge: Wächter-Namenslisten vereinigen statt ersetzen

**Spec:** Nachtrag N4b.3 Nr. 8 („Wächter-Namenslisten vereinigen statt ersetzen“), 10.2 Nr. 5, 10.3, G6; 4a-Ledger Task 4 minor (deferred) zu `auslieferung.mjs:174`, `build-release.mjs:291-294` und `auslieferung.test.mjs` (e).

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\zoom-4b` (Branch `feat/zoom-stage4b`).

**Files:**
- Modify: `packages/zoom-bridge/scripts/auslieferung.mjs` — Zeilen 19–21 (Kommentar zu `SDK_NAMEN_7_1_5`), 206–216 (`sdkNamen`; neu `sdkNamenQuellen`)
- Modify: `packages/zoom-bridge/scripts/build-release.mjs` — Zeilen 41–45 (Import), 264–279 (Wächter und Statuszeile)
- Test: `packages/zoom-bridge/test/auslieferung.test.mjs` — Zeilen 6–19 (Importe), 86–92 (schreibt heute das Ersetzen vor), 137–139 (Ende des `.asar`-Blocks), 225–230 (Ende der Fälle)
- Nicht in dieser Aufgabe (außerhalb `packages/zoom-bridge`): `apps/connect/tools/bundle-zoom-bridge.mjs:66` hat eine eigene Statuszeile mit der alten Regel, siehe Abweichung 2.

**Achtung, Zeilenenden:** `test/auslieferung.test.mjs` hat **LF**, nicht CRLF, und enthält in Zeile 195 zwei echte NUL-Bytes (`b.write('PE<NUL><NUL>', …)`). Git hält die Datei darum für binär (`git ls-files --eol`: `i/-text w/-text`): keine Zeilenend-Umwandlung, und `git diff` zeigt nur `Binary files … differ` — zum Ansehen `git diff --text`. Das Edit-Werkzeug lässt beides unverändert (beim Planen geprüft: danach weiter 0 CRLF und 2 NUL-Bytes). Die anderen beiden Dateien haben CRLF.

**Interfaces:**
- Consumes: keine.
- Produces:
  ```js
  // packages/zoom-bridge/scripts/auslieferung.mjs - Signaturen unveraendert, Bedeutung von sdkBin neu:
  export function sdkNamen(opts?: { sdkBin?: string | null }): Set<string>;
  //   feste Liste SDK_NAMEN_7_1_5 PLUS (falls sdkBin existiert) jeder Dateiname darunter, klein geschrieben
  export function verboteneZoomDateien(ordner, opts?: { sdkBin?: string | null }): string[];   // nutzt sdkNamen
  export function verboteneAsarEintraege(ordner, opts?: { sdkBin?: string | null }): string[]; // nutzt sdkNamen
  // neu:
  export function sdkNamenQuellen(opts?: { sdkBin?: string | null }): string;
  //   'die feste Liste fuer 7.1.5.43953'                                          (ohne sdkBin)
  //   'die feste Liste fuer 7.1.5.43953 (SDK-Ordner <sdkBin> fehlt)'              (Ordner fehlt)
  //   'die feste Liste fuer 7.1.5.43953 und das SDK unter <sdkBin> (<n> Namen)'   (n = verschiedene Namen; "1 Name")
  ```

**Regeln für diese Aufgabe:** G6 (der Wächter darf durch einen falschen `ZOOM_SDK_DIR` nie schwächer werden), G13, G14 (mit der LF-Ausnahme oben), G15.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben, Teil 1: Importe** (`packages/zoom-bridge/test/auslieferung.test.mjs`, Zeilen 6–19)

Vorher:
```js
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  SDK_NAMEN_7_1_5,
  VC_PFLICHT,
  asarEintraege,
  bridgeExeFrisch,
  dateiFassung,
  dateienUnter,
  linkerFassung,
  mindestens,
  sdkNamen,
  verboteneAsarEintraege,
```
Nachher:
```js
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SDK_NAMEN_7_1_5,
  VC_PFLICHT,
  asarEintraege,
  bridgeExeFrisch,
  dateiFassung,
  dateienUnter,
  linkerFassung,
  mindestens,
  sdkNamen,
  sdkNamenQuellen,
  verboteneAsarEintraege,
```

- [ ] **Step 2: Fehlschlagenden Test schreiben, Teil 2: Ordner-Wächter vereinigt** (`packages/zoom-bridge/test/auslieferung.test.mjs`, vorher Zeilen 86–92)

Vorher:
```js
    // Mit sdkBin gilt die ECHTE Liste aus dem SDK-Ordner, nicht die feste.
    const sdkBin = join(temp, 'sdk', 'x64', 'bin');
    datei(join(sdkBin, 'nur-echt.dll'));
    datei(join(ordner, 'nur-echt.dll'));
    const echt = verboteneZoomDateien(ordner, { sdkBin });
    assert(echt.join('|') === 'nur-echt.dll', 'mit sdkBin: meldet nur-echt.dll und nicht mehr sdk.dll');
  }
```
Nachher:
```js
    // Mit sdkBin kommen die Namen des ECHTEN SDK-Ordners zur festen Liste DAZU
    // (Vereinigung, Stage 4b): ein falscher oder fast leerer Ordner schwaecht den
    // Waechter nicht (G6). Dieser Ordner enthaelt absichtlich KEIN sdk.dll.
    const sdkBin = join(temp, 'sdk', 'x64', 'bin');
    datei(join(sdkBin, 'nur-echt.dll'));
    datei(join(sdkBin, 'unter', 'GROSS-ECHT.DLL'));
    datei(join(ordner, 'nur-echt.dll'));
    datei(join(ordner, 'gross-echt.dll'));
    const echt = verboteneZoomDateien(ordner, { sdkBin });
    assert(echt.includes(join('unter', 'sdk.dll')) && echt.includes(join('tief', 'x', 'SDK.DLL')),
      'mit sdkBin ohne sdk.dll: sdk.dll bleibt verboten');
    assert(echt.includes('nur-echt.dll') && echt.includes('gross-echt.dll') && echt.length === 4,
      'mit sdkBin: zusaetzlicher Name aus dem echten Ordner wird gemeldet (rekursiv, ohne Gross-/Kleinschreibung)');
    const leererBin = join(temp, 'sdk-leer', 'x64', 'bin');
    mkdirSync(leererBin, { recursive: true });
    const nurFest = [join('tief', 'x', 'SDK.DLL'), join('unter', 'sdk.dll')].join('|');
    assert(
      verboteneZoomDateien(ordner, { sdkBin: leererBin }).sort().join('|') === nurFest &&
        verboteneZoomDateien(ordner, { sdkBin: null }).sort().join('|') === nurFest &&
        verboteneZoomDateien(ordner, { sdkBin: join(temp, 'gibt es nicht') }).sort().join('|') === nurFest,
      'sdkBin fehlt oder ist leer: feste Liste',
    );
    assert(sdkNamen({ sdkBin }).size === 154 && sdkNamen({ sdkBin: leererBin }).size === 152,
      'sdkNamen mit sdkBin: 152 feste und 2 echte Namen; mit leerem Ordner die 152 festen');
  }
```

- [ ] **Step 3: Fehlschlagenden Test schreiben, Teil 3: `.asar`-Wächter vereinigt** (`packages/zoom-bridge/test/auslieferung.test.mjs`, vorher Zeilen 137–139)

Vorher:
```js
    datei(join(sauber, 'resources', 'irgendwas.zip'));
    assert(verboteneAsarEintraege(sauber).length === 0, 'eine .zip-DATEI ausserhalb einer .asar ist nicht Sache dieses Waechters');
  }
```
Nachher:
```js
    datei(join(sauber, 'resources', 'irgendwas.zip'));
    assert(verboteneAsarEintraege(sauber).length === 0, 'eine .zip-DATEI ausserhalb einer .asar ist nicht Sache dieses Waechters');

    // Dieselbe Vereinigung fuer den INHALT einer .asar (Stage 4b, Spec 10.3).
    const binAsar = join(temp, 'sdk-asar', 'x64', 'bin');
    datei(join(binAsar, 'nur-echt.dll'));
    const leerAsar = join(temp, 'sdk-asar-leer');
    mkdirSync(leerAsar, { recursive: true });
    const mitEcht = join(temp, 'asar-echt');
    baueAsar(join(mitEcht, 'resources', 'app.asar'), {
      irgendwo: { files: { 'SDK.DLL': leer, 'Nur-Echt.dll': leer, 'eigen.js': leer } },
    });
    const relEcht = join('resources', 'app.asar');
    const mit = verboteneAsarEintraege(mitEcht, { sdkBin: binAsar });
    assert(mit.includes(`${relEcht}:irgendwo/SDK.DLL`), '.asar mit sdkBin ohne sdk.dll: SDK.DLL bleibt verboten');
    assert(mit.includes(`${relEcht}:irgendwo/Nur-Echt.dll`) && mit.length === 2,
      '.asar mit sdkBin: zusaetzlicher Name aus dem echten Ordner wird gemeldet (ohne Gross-/Kleinschreibung)');
    assert(
      verboteneAsarEintraege(mitEcht, { sdkBin: leerAsar }).join('|') === `${relEcht}:irgendwo/SDK.DLL` &&
        verboteneAsarEintraege(mitEcht, { sdkBin: null }).join('|') === `${relEcht}:irgendwo/SDK.DLL`,
      '.asar, sdkBin fehlt oder ist leer: feste Liste',
    );
  }
```

- [ ] **Step 4: Fehlschlagenden Test schreiben, Teil 4: Statuszeile** (`packages/zoom-bridge/test/auslieferung.test.mjs`, vorher Zeilen 225–230)

Vorher:
```js
      assert(VC_PFAD_HINWEIS.includes(String.raw`...\VC\Redist\MSVC\<Fassung>\x64\Microsoft.VC14x.CRT`), 'Abbruchtext Laufzeit nicht gefunden nennt den Pfad mit echten Backslashes');
    } finally {
      if (vorher === undefined) delete process.env.VC_CRT_DIR;
      else process.env.VC_CRT_DIR = vorher;
    }
  }
```
Nachher:
```js
      assert(VC_PFAD_HINWEIS.includes(String.raw`...\VC\Redist\MSVC\<Fassung>\x64\Microsoft.VC14x.CRT`), 'Abbruchtext Laufzeit nicht gefunden nennt den Pfad mit echten Backslashes');
    } finally {
      if (vorher === undefined) delete process.env.VC_CRT_DIR;
      else process.env.VC_CRT_DIR = vorher;
    }
  }

  console.log('\nauslieferung — Statuszeile der Waechter (Stage 4b):');
  {
    const fest = 'die feste Liste fuer 7.1.5.43953';
    assert(sdkNamenQuellen() === fest && sdkNamenQuellen({ sdkBin: null }) === fest, 'sdkNamenQuellen ohne sdkBin: nur die feste Liste');
    const bin = join(temp, 'status', 'x64', 'bin');
    datei(join(bin, 'sdk.dll'));
    assert(sdkNamenQuellen({ sdkBin: bin }) === `${fest} und das SDK unter ${bin} (1 Name)`,
      'Statuszeile von build-release nennt beide Quellen');
    const fehlt = join(temp, 'status', 'gibt es nicht');
    assert(sdkNamenQuellen({ sdkBin: fehlt }) === `${fest} (SDK-Ordner ${fehlt} fehlt)`, '... und einen fehlenden SDK-Ordner');
    const bau = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'build-release.mjs'), 'utf8');
    assert(bau.includes('sdkNamenQuellen({ sdkBin })') && !bau.includes('echteListe'),
      'build-release.mjs baut die Statuszeile aus sdkNamenQuellen (keine zweite Kopie der Regel)');
  }
```
`build-release.mjs` selbst lässt sich im Test nicht ausführen (es baut ein Einsatzpaket); die Statuszeile hängt darum an der reinen Funktion `sdkNamenQuellen`, und eine Textprüfung stellt sicher, dass `build-release.mjs` sie benutzt.

- [ ] **Step 5: Test laufen lassen (rot)**

```
node packages/zoom-bridge/test/auslieferung.test.mjs
```
Erwartet, Exitcode 1:
```
SyntaxError: The requested module '../scripts/auslieferung.mjs' does not provide an export named 'sdkNamenQuellen'
```
(Beim Planen zusätzlich mit einem Ersatz-Export `sdkNamenQuellen() { return ''; }` gemessen: 30 `ok`, 11 `FAIL` — alle neuen Prüfungen rot, auch die vier zur Vereinigung; das alte Ersetzen meldet bei einem `sdkBin` ohne `sdk.dll` weder `unter/sdk.dll` noch `SDK.DLL` in der `.asar` und bei einem leeren Ordner gar nichts.)

- [ ] **Step 6: Kommentar zur festen Liste** (`packages/zoom-bridge/scripts/auslieferung.mjs`, Zeilen 19–21)

Vorher:
```js
// fuer den Waechter, wenn ZOOM_SDK_DIR NICHT gesetzt ist. Erzeugt am
// 01.10.2026 aus dem echten SDK (153 Dateien, 152 verschiedene Namen). Ist
// ZOOM_SDK_DIR gesetzt, gilt stattdessen die ECHTE Liste aus dem SDK.
```
Nachher:
```js
// fuer den Waechter, IMMER. Erzeugt am 01.10.2026 aus dem echten SDK (153
// Dateien, 152 verschiedene Namen). Ist ZOOM_SDK_DIR gesetzt, kommen die Namen
// aus dem echten SDK-Ordner DAZU (Vereinigung, Stage 4b - siehe sdkNamen()).
```

- [ ] **Step 7: `sdkNamen` vereinigt; neu `sdkNamenQuellen`** (`packages/zoom-bridge/scripts/auslieferung.mjs`, Zeilen 206–216)

Vorher:
```js
/**
 * Die verbotenen Dateinamen, klein geschrieben: die ECHTE Liste aus `sdkBin`
 * (rekursiv), wenn der Ordner existiert, sonst SDK_NAMEN_7_1_5. Klein, weil
 * Windows-Dateinamen Gross-/Kleinschreibung nicht unterscheiden.
 */
export function sdkNamen(opts = {}) {
  const { sdkBin } = opts;
  const echt = Boolean(sdkBin) && existsSync(sdkBin);
  const namen = echt ? dateienUnter(sdkBin).map((f) => f.split(/[\\/]/).pop()) : SDK_NAMEN_7_1_5;
  return new Set(namen.map((n) => n.toLowerCase()));
}
```
Nachher:
```js
/** Die Dateinamen unter `sdkBin` (rekursiv, ohne Pfad); [] ohne Ordner. */
function echteSdkNamen(sdkBin) {
  if (!sdkBin || !existsSync(sdkBin)) return [];
  return dateienUnter(sdkBin).map((f) => f.split(/[\\/]/).pop());
}

/**
 * Die verbotenen Dateinamen, klein geschrieben: IMMER die feste Liste
 * SDK_NAMEN_7_1_5 und - wenn `sdkBin` existiert - DAZU jeder Dateiname darunter
 * (rekursiv). VEREINIGUNG statt Ersatz (Stage 4b, Spec N4b.3 Nr. 8): zeigt
 * ZOOM_SDK_DIR auf einen falschen oder fast leeren Ordner, darf das den Waechter
 * nicht schwaechen (G6) - frueher liess ein leeres x64\bin alles durch. Klein,
 * weil Windows-Dateinamen Gross-/Kleinschreibung nicht unterscheiden.
 */
export function sdkNamen(opts = {}) {
  const namen = [...SDK_NAMEN_7_1_5, ...echteSdkNamen(opts.sdkBin)];
  return new Set(namen.map((n) => n.toLowerCase()));
}

/**
 * Woher die Namen der Waechter kommen, als Text fuer Statuszeilen
 * (build-release.mjs). Nennt IMMER die feste Liste, dazu den SDK-Ordner samt Zahl
 * seiner Namen - ein leerer Ordner steht dann als "(0 Namen)" da, statt still zu
 * schwaechen. Dieselbe Regel wie sdkNamen(), keine zweite Kopie.
 */
export function sdkNamenQuellen(opts = {}) {
  const { sdkBin } = opts;
  const fest = 'die feste Liste fuer 7.1.5.43953';
  if (!sdkBin) return fest;
  if (!existsSync(sdkBin)) return `${fest} (SDK-Ordner ${sdkBin} fehlt)`;
  const n = new Set(echteSdkNamen(sdkBin).map((x) => x.toLowerCase())).size;
  return `${fest} und das SDK unter ${sdkBin} (${n === 1 ? '1 Name' : `${n} Namen`})`;
}
```
`verboteneZoomDateien` und `verboteneAsarEintraege` rufen `sdkNamen(opts)` schon heute und bleiben unverändert.

- [ ] **Step 8: `build-release.mjs` importiert `sdkNamenQuellen`** (`packages/zoom-bridge/scripts/build-release.mjs`, Zeilen 41–45)

Vorher:
```js
  dateienUnter,
  sdkNamen,
  verboteneZoomDateien,
  waehleVcLaufzeit,
} from './auslieferung.mjs';
```
Nachher:
```js
  dateienUnter,
  sdkNamen,
  sdkNamenQuellen,
  verboteneZoomDateien,
  waehleVcLaufzeit,
} from './auslieferung.mjs';
```

- [ ] **Step 9: Wächter und Statuszeile ohne zweite Kopie der Regel** (`packages/zoom-bridge/scripts/build-release.mjs`, vorher Zeilen 264–279, nach Step 8 Zeilen 265–280)

Vorher:
```js
// Zoom-SDK x64\bin. Gegen die ECHTE Liste, wenn ZOOM_SDK_DIR gesetzt ist -
// sonst gegen die feste Liste oben. Verglichen ohne Gross-/Kleinschreibung,
// weil Windows-Dateinamen sie nicht unterscheiden.
// Liste und Vergleich stehen in auslieferung.mjs - derselbe Waechter prueft den
// Installer von JM Connect (tools/bundle-zoom-bridge.mjs, tools/after-pack.cjs).
const echteListe = sdkBin && existsSync(sdkBin);
const verbotenNamen = sdkNamen({ sdkBin });
const oeffentlicheDateien = dateienUnter(oeffentlich);
const verboten = verboteneZoomDateien(oeffentlich, { sdkBin });
if (verboten.length > 0) {
  abbruch(`Zoom-SDK-Dateien im OEFFENTLICHEN Paket:\n  ${verboten.join('\n  ')}`);
}
schritt(
  `Waechter: keine der ${verbotenNamen.size} Zoom-SDK-Dateinamen im oeffentlichen Paket ` +
    `(geprueft gegen ${echteListe ? `das SDK unter ${sdkBin}` : 'die feste Liste fuer 7.1.5.43953'}).`,
);
```
Nachher:
```js
// Zoom-SDK x64\bin. Gegen die feste Liste oben UND, wenn ZOOM_SDK_DIR gesetzt
// ist, zusaetzlich gegen die echte Liste aus dem SDK (Vereinigung, Stage 4b).
// Verglichen ohne Gross-/Kleinschreibung, weil Windows-Dateinamen sie nicht
// unterscheiden.
// Liste, Vergleich und die Herkunftsangabe der Statuszeile stehen in
// auslieferung.mjs - derselbe Waechter prueft den Installer von JM Connect
// (tools/bundle-zoom-bridge.mjs, tools/after-pack.cjs).
const verbotenNamen = sdkNamen({ sdkBin });
const oeffentlicheDateien = dateienUnter(oeffentlich);
const verboten = verboteneZoomDateien(oeffentlich, { sdkBin });
if (verboten.length > 0) {
  abbruch(`Zoom-SDK-Dateien im OEFFENTLICHEN Paket:\n  ${verboten.join('\n  ')}`);
}
schritt(
  `Waechter: keine der ${verbotenNamen.size} Zoom-SDK-Dateinamen im oeffentlichen Paket ` +
    `(geprueft gegen ${sdkNamenQuellen({ sdkBin })}).`,
);
```
`existsSync` bleibt importiert (weiter genutzt, z. B. Zeile 102). Die ZIP-Gegenprobe (`imZipVerboten`) nutzt weiter `verbotenNamen`, jetzt die Vereinigung.

- [ ] **Step 10: Test laufen lassen (grün)**

```
node packages/zoom-bridge/test/auslieferung.test.mjs
node --check packages/zoom-bridge/scripts/build-release.mjs
```
Erwartet: keine Zeile `FAIL`, Exitcode 0, darunter:
```
auslieferung — Waechter fuer Ordner:
  ok  sauberer Ordner (Bridge, VC-Laufzeit, NDI): keine Treffer
  ok  findet unter/sdk.dll und tief/x/SDK.DLL (ohne Gross-/Kleinschreibung), relativ zum Ordner
  ok  dateienUnter: alle Dateien, rekursiv
  ok  mit sdkBin ohne sdk.dll: sdk.dll bleibt verboten
  ok  mit sdkBin: zusaetzlicher Name aus dem echten Ordner wird gemeldet (rekursiv, ohne Gross-/Kleinschreibung)
  ok  sdkBin fehlt oder ist leer: feste Liste
  ok  sdkNamen mit sdkBin: 152 feste und 2 echte Namen; mit leerem Ordner die 152 festen

auslieferung — Waechter fuer .asar:
  ok  asarEintraege: genau die Datei-Eintraege, mit / getrennt (Ordner = Knoten mit files)
  ok  meldet node_modules/@jm/zoom-bridge/package.json, .../release/x.zip, irgendwo/sdk.dll und irgendwo/paket.zip - je einmal
  ok  .asar nur mit out/main/index.cjs: keine Treffer
  ok  eine .zip-DATEI ausserhalb einer .asar ist nicht Sache dieses Waechters
  ok  .asar mit sdkBin ohne sdk.dll: SDK.DLL bleibt verboten
  ok  .asar mit sdkBin: zusaetzlicher Name aus dem echten Ordner wird gemeldet (ohne Gross-/Kleinschreibung)
  ok  .asar, sdkBin fehlt oder ist leer: feste Liste
…
auslieferung — Statuszeile der Waechter (Stage 4b):
  ok  sdkNamenQuellen ohne sdkBin: nur die feste Liste
  ok  Statuszeile von build-release nennt beide Quellen
  ok  ... und einen fehlenden SDK-Ordner
  ok  build-release.mjs baut die Statuszeile aus sdkNamenQuellen (keine zweite Kopie der Regel)

Alle Auslieferungs-Tests bestanden.
```
Gemessen: 41 `ok` (vorher 31; die alte Prüfung „mit sdkBin: meldet nur-echt.dll und nicht mehr sdk.dll“ entfällt, 11 neue). `node --check` ohne Ausgabe, Exitcode 0.

- [ ] **Step 11: Ganzer Selbsttest, Typecheck, Querprüfung Connect-Wächter**

```
npm run selftest -w @jm/zoom-bridge
npm run typecheck -w @jm/zoom-bridge
node apps/connect/test/after-pack.test.mjs
```
Erwartet: Selbsttest Exitcode 0, keine Zeile `FAIL`, `Alle Selbsttests bestanden.` und `Alle Auslieferungs-Tests bestanden.` (gemessen 509 + 41 = 550 `ok`); `tsc` ohne Ausgabe, Exitcode 0; `after-pack.test.mjs` unverändert grün mit `Alle after-pack-Tests bestanden.` (unter Windows 6 `ok` und 1 übersprungen — vor und nach dieser Aufgabe gleich gemessen; der Test löscht `ZOOM_SDK_DIR` und prüft die feste Liste, die in der Vereinigung immer enthalten ist).

- [ ] **Step 12: Commit** (Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add packages/zoom-bridge/scripts/auslieferung.mjs packages/zoom-bridge/scripts/build-release.mjs packages/zoom-bridge/test/auslieferung.test.mjs
git status --short
```
Erwartet genau diese gestagten Zeilen:
```
M  packages/zoom-bridge/scripts/auslieferung.mjs
M  packages/zoom-bridge/scripts/build-release.mjs
M  packages/zoom-bridge/test/auslieferung.test.mjs
```
Dann:
```
git commit -m "fix(zoom-bridge): Waechter vereinigen feste und echte SDK-Namensliste" -m "sdkNamen liefert immer SDK_NAMEN_7_1_5 und zusaetzlich die Namen aus sdkBin, ohne Gross-/Kleinschreibung. Ein falscher oder leerer ZOOM_SDK_DIR schwaecht damit weder verboteneZoomDateien noch verboteneAsarEintraege (G6). Neu sdkNamenQuellen fuer die Statuszeile von build-release.mjs (feste Liste und SDK-Ordner samt Zahl), statt einer zweiten Kopie der Regel. Tests fuer Ordner und .asar mit sdkBin ohne sdk.dll, mit leerem und fehlendem Ordner." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Gegenprobe (beim Planen am nachgespielten Stand nach Step 10 gemessen, kein Umsetzungsschritt):** Vereinigung zurück auf Ersetzen — in `sdkNamen` `const namen = [...SDK_NAMEN_7_1_5, ...echteSdkNamen(opts.sdkBin)];` → `const echt = echteSdkNamen(opts.sdkBin);` / `const namen = opts.sdkBin && existsSync(opts.sdkBin) ? echt : SDK_NAMEN_7_1_5;` — macht genau sieben Prüfungen rot (`7 Auslieferungs-Test(s) fehlgeschlagen.`): die vier zum Ordner-Wächter („mit sdkBin ohne sdk.dll: sdk.dll bleibt verboten“, „mit sdkBin: zusaetzlicher Name …“, „sdkBin fehlt oder ist leer: feste Liste“, „sdkNamen mit sdkBin: 152 feste und 2 echte Namen …“) und die drei zur `.asar`. Rückbau byte-gleich.

**Abweichungen von der Gliederung:**
1. **Neuer Export `sdkNamenQuellen`.** Die Gliederung sagt „Signaturen unverändert“; die bestehenden Signaturen bleiben es. Für „Statuszeile von build-release nennt beide Quellen“ braucht es eine prüfbare reine Funktion: `build-release.mjs` baut ein ganzes Einsatzpaket und lässt sich im Test nicht ausführen, und `echteListe` war genau die zweite Kopie der Regel, die der 4a-Ledger (Task 4, `build-release.mjs:291-294`) bemängelt. Dafür ändert sich auch der Import (Zeilen 41–45), nicht nur die Statuszeile.
2. **`apps/connect/tools/bundle-zoom-bridge.mjs:66` bleibt außerhalb dieser Aufgabe** und meldet bei gesetztem `ZOOM_SDK_DIR` weiter „geprueft gegen das SDK unter …“, obwohl jetzt die Vereinigung gilt. Der Wächter selbst ist dort richtig (er ruft `verboteneZoomDateien`), nur die Zeile ist ungenau. Vorschlag (bei der Montage nicht übernommen, M7 und offener Punkt O3; `tools/*` bleibt in 4b unverändert): dort `sdkNamenQuellen({ sdkBin })` aus `../../../packages/zoom-bridge/scripts/auslieferung.mjs` verwenden.
3. **Zusätzliche Prüfungen:** Großschreibung im echten Ordner (`GROSS-ECHT.DLL`) und in der `.asar` (`SDK.DLL`, `Nur-Echt.dll`) — damit ist auch der 4a-Ledger-Befund (Task 4, Randfall a/e: „`.asar` mit `sdkBin` ungetestet“, „Eintrag `SDK.DLL` in der `.asar`“) abgedeckt; `sdkBin: null` (so übergibt `build-release.mjs` „kein SDK“); Zählung 154/152 in `sdkNamen`; fehlender SDK-Ordner in der Statuszeile.
4. Zeilenangaben gegenüber der Gliederung berichtigt: `auslieferung.mjs:211-216` → 206–216 (mit Doc-Kommentar), `build-release.mjs:269-278` → 264–279.

---

### Task 4: Connect: Typen und Zustandstexte für 4b (`types.ts`, `zoom-text.ts`)

**Spec:** `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md` 7.2, 7.5 (Satz „`zoom_cmd` und `zoom_cmd_rejected` hängen nicht am Zustand“), 7.6, 8.6 (letzter Absatz), 9 Punkte 7, 8, 9, 11.1; Nachtrag N4b.1 („Aufnahme-Erlaubnis vom Host entzogen, Quellen gestoppt“), N4b.3 Nr. 3 (Stand `grenze`), Nr. 4 (Versatz nur Sitzung), Nr. 8 („S10-Sperre während des Bridge-Abbaus“, „Rohwerte von Bild und Ton“, „Fassung und Fristen … aus den Konstanten“ für Z11, Q9 und die SDK-Zeile). Spec 7 (Grundsatz „jeder Text in jedem Zustand wahr“, Prüfregel 7.6) für Z7 beim Entzug. Plan: L13, L14, L16, Texttabelle 4b (Abschnitt 8).

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\zoom-4b` (Branch `feat/zoom-stage4b`). Alle Pfade relativ dazu.

**Files:**
- Modify: `apps/connect/src/shared/types.ts` — Zeile 98 (`ZoomErlaubnis`, neue Typen dahinter), 144 (`ZoomSollEintrag.stand`), 172 (`ZoomKurz`), 192 und 204 (`ZoomAbbild`)
- Modify: `apps/connect/src/shared/zoom-text.ts` — Zeile 8 (Import), 36–40 (Konstanten, `Q9_ANFANG`), 109–110 (Z7 Tray), 122 (Z11 Tray), 130–143 (Z7/Z7b-Gründe), 183–187 (Z7/Z7b Karte), 198–200 (Z11 Karte), 241–248 (`ZoomStateKv`), 284–286 (`stateKvAus`), 288–293 (`sdkZeile`), 355 und 393 (`zoomKnoepfe`), 406–409 (neue Funktionen dahinter)
- Modify: `apps/connect/src/main/zoom/kern.ts` — **nur** `kurz()` Zeile 336–338 und `abbild()` Zeilen 357 und 363–365
- Test: `apps/connect/test/zoom-text.test.ts` — Zeilen 7–12 (Importe), 27 und 40–42 (Testhilfen), 234–238 (Erlaubnis `entzogen`), 331–332 (STATE-Schlüssel), Ankerzeile 721
- Unverändert: `apps/connect/test/zoom-kern.test.ts` — Fall 10b prüft nach dem Entladen weiter „Der Host hat sie entzogen.“; ohne gemerkte Quelle bleibt dieser Text (Nachbesserung, siehe Abweichungen).

Zeilenangaben gelten für den Stand nach Aufgabe 3; die Dateien dieser Aufgabe stehen dort wie in HEAD `051151d614` (Aufgabe 1 ändert nur `zoom-kern.test.ts`, und die berührt diese Aufgabe nicht mehr). Maßgeblich ist der wortgleiche Vorher-Text.

**Interfaces:**
- Consumes: Aufgabe 1 — `VideoReason` und `AudioReason` aus `@jm/zoom-bridge/protocol` enthalten `'privilegeRevoked'` (die `Record<VideoReason, …>`/`Record<AudioReason, …>` unten brauchen den Wert, sonst meldet `tsc` eine unbekannte Eigenschaft).
- Produces (exakt so, Aufgaben 5–18 bauen darauf):
  ```ts
  // apps/connect/src/shared/types.ts
  export type ZoomBefehlKennung = 'ok' | 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6' | 'f7' | 'f8';
  export interface ZoomBefehlErgebnis { kennung: ZoomBefehlKennung; abgelehnt: boolean }
  // ZoomSollEintrag
  stand: 'wartet' | 'doppelname' | 'verwaist' | 'grenze';
  // ZoomKurz — letzter zoom_*-Befehl (11.2); null vor dem ersten
  befehl: ZoomBefehlErgebnis | null;
  // ZoomAbbild
  versatz: { gewuenschtMs: number; bestaetigtMs: number | null; nurSitzung: boolean };
  abbauLaeuft: boolean;   // eine gestoppte Bridge baut noch ab (S10, L13)

  // apps/connect/src/shared/zoom-text.ts
  export const BETRIEBSGROESSE = 5;            // Typ 5
  export const WIEDERBEITRITT_VERSUCHE = 5;    // Typ 5 (passt zu ZoomAbbild.abriss.versuche: 5)
  export const Q9_ANFANG: string;              // `Mehr als ${BETRIEBSGROESSE} Zoom-Quellen sind nicht gemessen.`
  export interface ZoomStateKv {
    zoom_status: ZoomStatusWert; zoom_sources: number; zoom_live: 0 | 1; zoom_privilege: 0 | 1; zoom_alarm: 0 | 1;
    zoom_cmd: '' | ZoomBefehlKennung; zoom_cmd_rejected: 0 | 1;
  }
  export function stateKvAus(k: ZoomKurz): ZoomStateKv | null;   // zoom_cmd = k.befehl?.kennung ?? '', zoom_cmd_rejected = k.befehl?.abgelehnt ? 1 : 0
  export function sollZeile(e: ZoomSollEintrag): string;          // „{Name} — {Stand}“, vier Stände
  export function bildText(bild: ZoomQuelle['bild'], grund: VideoReason): string;
  export function tonText(ton: ZoomQuelle['ton'], grund: AudioReason | null): string;
  export function quellenZustandText(q: ZoomQuelle): string;     // `${bildText} · ${tonText}`
  export function versatzZeile(a: ZoomAbbild): string[];         // ['bestätigt: N ms' | 'gilt ab dem nächsten Beitritt'] (+ TEXT_A4_SCHREIBFEHLER bei nurSitzung)
  export function versatzUebernommen(r: ZoomErgebnis): boolean;  // ok oder TEXT_A4_SCHREIBFEHLER (L14): die Karte übernimmt den Wert (Aufgabe 18)
  // zoomKnoepfe(a).einrichtungAenderbar ist zusätzlich false, solange a.abbauLaeuft (damit auch sdkLaden 'gesperrt')
  // Z7/Z7b bei 'entzogen' nach der Texttabelle; Z7 sagt „Quellen gestoppt“ nur bei k.sollOffen > 0; Z11 nennt WIEDERBEITRITT_VERSUCHE
  // sdkZeile(a) nennt a.einrichtung.sdk.fassung (ohne Fassung „Zoom-SDK eingerichtet“), kein Literal mehr
  ```
  Der Kern liefert ab hier `kurz().befehl === null`, `abbild().versatz.nurSitzung === false` und `abbild().abbauLaeuft === (stopps.size > 0)`. Aufgabe 11 setzt `nurSitzung` aus den Einstellungen, Aufgabe 13 setzt `befehl`.

**Regeln für diese Aufgabe:**
- `src/shared/*` bleibt rein (G8): kein `electron`, keine `node:`-Importe; aus `@jm/zoom-bridge/protocol` nur `import type`. Der Renderer-tsconfig prüft beide Dateien mit.
- Texte wörtlich aus Spec 7.2 und der Texttabelle 4b (G9): „—“ U+2014, „…“ U+2026, „„…“ “ U+201E/U+201C.
- In `kern.ts` nur die drei genannten Stellen; alles andere gehört zu den Aufgaben 8–13.
- CRLF: alle Ersetzungen mit dem Edit-Werkzeug (G14). Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel, nie pushen.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`apps/connect/test/zoom-text.test.ts`)

Ersetzung 1 (`apps/connect/test/zoom-text.test.ts`, Zeilen 7–12), Vorher:
```ts
import type { AppStatus, ProxyKeySource, ZoomAbbild, ZoomErlaubnis, ZoomKurz, ZoomMangel, ZoomZustand } from '../src/shared/types';
import {
  einrichtungsTextArt, gaesteZeile, kartenZeile, MANGEL_GRUND, Q9_ANFANG, sdkBalken, sdkKnopf, sdkLadenZeile, sdkSchluesselZeile,
  sdkZeile, stateKvAus, TEXT_A4, TEXT_A4_SCHREIBFEHLER, TEXT_A6, TEXT_S11, TEXT_S17, trayTooltip, trayVerlassenAktiv, zoomKnoepfe,
  zoomZ, zoomZeile, zugangZeile, type ZoomStatusWert, type ZoomZ,
} from '../src/shared/zoom-text';
```
Nachher:
```ts
import { readFileSync } from 'node:fs';
import type { AudioReason, VideoReason } from '@jm/zoom-bridge/protocol';
import type {
  AppStatus, ProxyKeySource, ZoomAbbild, ZoomBefehlErgebnis, ZoomErlaubnis, ZoomKurz, ZoomMangel, ZoomQuelle, ZoomSollEintrag, ZoomZustand,
} from '../src/shared/types';
import {
  BETRIEBSGROESSE, bildText, einrichtungsTextArt, gaesteZeile, kartenZeile, MANGEL_GRUND, Q9_ANFANG, quellenZustandText, sdkBalken,
  sdkKnopf, sdkLadenZeile, sdkSchluesselZeile, sdkZeile, sollZeile, stateKvAus, TEXT_A4, TEXT_A4_SCHREIBFEHLER, TEXT_A6, TEXT_S11,
  TEXT_S17, tonText, trayTooltip, trayVerlassenAktiv, versatzUebernommen, versatzZeile, WIEDERBEITRITT_VERSUCHE, zoomKnoepfe, zoomZ,
  zoomZeile, zugangZeile, type ZoomStatusWert, type ZoomZ,
} from '../src/shared/zoom-text';
```

Ersetzung 2 (`apps/connect/test/zoom-text.test.ts`, Zeile 27, Testhilfe `kurz`), Vorher:
```ts
    versuch: null, maengel: [], kopieLaeuft: false, ...z,
```
Nachher:
```ts
    versuch: null, maengel: [], kopieLaeuft: false, befehl: null, ...z,
```

Ersetzung 3 (`apps/connect/test/zoom-text.test.ts`, Zeilen 40–42, Testhilfe `abbild`), Vorher:
```ts
    versatz: { gewuenschtMs: 0, bestaetigtMs: null },
    teilnehmer: [], soll: [], abriss: null, meldung: null, hinweise: [],
    erneutMoeglich: false, pruefungLaeuft: false,
```
Nachher:
```ts
    versatz: { gewuenschtMs: 0, bestaetigtMs: null, nurSitzung: false },
    teilnehmer: [], soll: [], abriss: null, meldung: null, hinweise: [],
    erneutMoeglich: false, pruefungLaeuft: false, abbauLaeuft: false,
```

Ersetzung 4 (`apps/connect/test/zoom-text.test.ts`, Zeilen 234–238, Tabelle `ERLAUBNIS`; der Entzug hat ab 4b eigene Texte), Vorher:
```ts
  entzogen: {
    z0: 'Z7', z2: 'Z7b',
    karte0: 'Im Meeting ohne Aufnahme-Erlaubnis. Der Host hat sie entzogen. Der Host kann sie im Zoom-Client jederzeit erteilen; Connect merkt das von selbst.',
    karte2: 'Die Aufnahme-Erlaubnis fehlt (vom Host entzogen). 2 Quellen bestehen noch. Der Host kann sie im Zoom-Client erteilen.',
  },
```
Nachher:
```ts
  // 4b (N4b.1, Texttabelle): Die Bridge baut beim Entzug ab; n > 0 gibt es nur, solange sie noch abbaut.
  // karte0 gilt ohne gemerkte Quelle (sollOffen 0, Vorgabe der Testhilfe): dann bleibt der bisherige Satz (Spec 7: jeder Text wahr).
  entzogen: {
    z0: 'Z7', z2: 'Z7b',
    karte0: 'Im Meeting ohne Aufnahme-Erlaubnis. Der Host hat sie entzogen. Der Host kann sie im Zoom-Client jederzeit erteilen; Connect merkt das von selbst.',
    karte2: 'Aufnahme-Erlaubnis vom Host entzogen. Connect stoppt 2 Quellen …',
  },
```

Ersetzung 5 (`apps/connect/test/zoom-text.test.ts`, Zeilen 331–332), Vorher:
```ts
  ck('STATE trägt genau die fünf Zoom-Schlüssel (keine Namen, keine Nummer)',
    kv !== null && JSON.stringify(Object.keys(kv).sort()) === '["zoom_alarm","zoom_live","zoom_privilege","zoom_sources","zoom_status"]');
```
Nachher:
```ts
  ck('STATE trägt genau die sieben Zoom-Schlüssel (keine Namen, keine Nummer)',
    kv !== null && JSON.stringify(Object.keys(kv).sort())
      === '["zoom_alarm","zoom_cmd","zoom_cmd_rejected","zoom_live","zoom_privilege","zoom_sources","zoom_status"]');
```

Ersetzung 6 (`apps/connect/test/zoom-text.test.ts`, Zeile 721, die Ankerzeile), Vorher:
```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```
Nachher (Konstanten in Z11/Q9 samt Quelltext-Wächter, Z7/Z7b beim Entzug, `zoom_cmd*` in allen 17 Zeilen von 7.5, gemerkte Quellen, Bild/Ton im Klartext, Versatz-Zeile, Sperre im Abbau):
```ts
// ── Aufgabe 4 (4b): zoom_cmd, Entzug, Grenze, Bild/Ton im Klartext, Versatz, Sperre im Abbau ──
console.log('— 4b: Konstanten in den Statustexten (N4b.3 Nr. 8, L16)');
{
  ck('BETRIEBSGROESSE = 5, WIEDERBEITRITT_VERSUCHE = 5', BETRIEBSGROESSE === 5 && WIEDERBEITRITT_VERSUCHE === 5);
  ck('Z11 (Tray) nennt „von WIEDERBEITRITT_VERSUCHE“',
    zoomZeile(kurz({ zustand: 'abriss', versuch: 3 })) === `△ Zoom: Verbindung verloren, Wiederbeitritt 3 von ${WIEDERBEITRITT_VERSUCHE}`);
  const z11 = abbild({ kurz: { zustand: 'abriss', versuch: 3 }, abriss: { versuch: 3, versuche: WIEDERBEITRITT_VERSUCHE, naechsterUm: null } });
  ck('Z11 (Karte) nennt „von WIEDERBEITRITT_VERSUCHE“',
    kartenZeile(z11, JETZT) === `Verbindung zum Meeting verloren. Wiederbeitritt 3 von ${WIEDERBEITRITT_VERSUCHE} läuft …`);
  ck('Q9_ANFANG nennt BETRIEBSGROESSE', Q9_ANFANG === `Mehr als ${BETRIEBSGROESSE} Zoom-Quellen sind nicht gemessen.`);
  const quelle = readFileSync(new URL('../src/shared/zoom-text.ts', import.meta.url), 'utf8');
  ck('Quelltext-Wächter: zoom-text.ts schreibt „von 5“ und „Mehr als 5“ nicht als Literal',
    !quelle.includes('von 5') && !quelle.includes('Mehr als 5'));
  // N4b.3 Nr. 8 „Fassung aus den Konstanten“: Das Abbild trägt sie schon (kern.ts: fassung = SDK_FASSUNG bei stand 'ok').
  const sdk = abbild().einrichtung.sdk;
  ck('sdkZeile nennt die Fassung aus dem Abbild', sdkZeile(abbild({ einrichtung: { ...abbild().einrichtung, sdk: { ...sdk, fassung: '9.9.9.1' } } }))
    === 'Zoom-SDK 9.9.9.1 eingerichtet');
  ck('… ohne Fassung im Abbild: „Zoom-SDK eingerichtet“', sdkZeile(abbild({ einrichtung: { ...abbild().einrichtung, sdk: { ...sdk, fassung: null } } }))
    === 'Zoom-SDK eingerichtet');
  ck('Quelltext-Wächter: zoom-text.ts schreibt die SDK-Fassung nicht als Literal', !quelle.includes('7.1.5'));
}

console.log('— 4b: Z7/Z7b beim Entzug (N4b.1, Texttabelle 4b)');
{
  const z7 = (e: ZoomErlaubnis, n: number, o = 0): ZoomAbbild =>
    abbild({ kurz: { zustand: 'im_meeting', erlaubnis: e, quellen: n, ohneBild: 0, sollOffen: o } });
  ck('Z7 entzogen mit gemerkten Quellen (o = 2): Tray/Kopfzeile wörtlich',
    zoomZeile(z7('entzogen', 0, 2).kurz) === '△ Zoom: Aufnahme-Erlaubnis vom Host entzogen, Quellen gestoppt');
  ck('Z7 entzogen mit gemerkten Quellen (o = 2): Karte wörtlich', kartenZeile(z7('entzogen', 0, 2), JETZT)
    === 'Aufnahme-Erlaubnis vom Host entzogen, Quellen gestoppt. Erteilt der Host sie im Zoom-Client wieder, lädt Connect die gemerkten Quellen von selbst.');
  ck('Z7 entzogen ohne gemerkte Quelle (o = 0): kein „Quellen gestoppt“, Tray und Karte wie vor 4b (Spec 7: jeder Text wahr)',
    zoomZeile(z7('entzogen', 0).kurz) === '△ Zoom: im Meeting ohne Aufnahme-Erlaubnis'
      && kartenZeile(z7('entzogen', 0), JETZT)
        === 'Im Meeting ohne Aufnahme-Erlaubnis. Der Host hat sie entzogen. Der Host kann sie im Zoom-Client jederzeit erteilen; Connect merkt das von selbst.');
  ck('Z7b entzogen, n = 1: Karte im Singular', kartenZeile(z7('entzogen', 1), JETZT) === 'Aufnahme-Erlaubnis vom Host entzogen. Connect stoppt 1 Quelle …');
  ck('Z7b entzogen, n = 2: Karte wörtlich', kartenZeile(z7('entzogen', 2), JETZT) === 'Aufnahme-Erlaubnis vom Host entzogen. Connect stoppt 2 Quellen …');
  ck('Z7b entzogen: Tray bleibt „{n} Quellen, Aufnahme-Erlaubnis fehlt“',
    zoomZeile(z7('entzogen', 1).kurz) === '△ Zoom: 1 Quelle, Aufnahme-Erlaubnis fehlt'
      && zoomZeile(z7('entzogen', 2).kurz) === '△ Zoom: 2 Quellen, Aufnahme-Erlaubnis fehlt');
  ck('Z7 abgelehnt und abgelaufen: Tray unverändert',
    zoomZeile(z7('abgelehnt', 0).kurz) === '△ Zoom: im Meeting ohne Aufnahme-Erlaubnis'
      && zoomZeile(z7('abgelaufen', 0).kurz) === '△ Zoom: im Meeting ohne Aufnahme-Erlaubnis');
  ck('Z7b abgelehnt, n = 1: Karte unverändert', kartenZeile(z7('abgelehnt', 1), JETZT)
    === 'Die Aufnahme-Erlaubnis fehlt (vom Host abgelehnt). 1 Quelle besteht noch. Der Host kann sie im Zoom-Client erteilen.');
  ck('Z7b abgelaufen, n = 2: Karte unverändert', kartenZeile(z7('abgelaufen', 2), JETZT)
    === 'Die Aufnahme-Erlaubnis fehlt (keine Antwort bekommen). 2 Quellen bestehen noch. Der Host kann sie im Zoom-Client erteilen.');
  ck('Z7b offen, n = 2: Karte unverändert', kartenZeile(z7('offen', 2), JETZT)
    === 'Die Aufnahme-Erlaubnis fehlt (angefragt, noch keine Antwort). 2 Quellen bestehen noch. Der Host kann sie im Zoom-Client erteilen.');
}

console.log('— 4b: 7.5 zoom_cmd und zoom_cmd_rejected (8.6, 11.2), in jedem Zustand gleich');
{
  const BEFEHLE: Array<[ZoomBefehlErgebnis | null, string, 0 | 1]> = [
    [null, '', 0],
    [{ kennung: 'f3', abgelehnt: true }, 'f3', 1],
    [{ kennung: 'f8', abgelehnt: false }, 'f8', 0],
    [{ kennung: 'ok', abgelehnt: false }, 'ok', 0],
  ];
  for (const z of Object.keys(T75) as Array<Exclude<ZoomZ, 'Z0'>>) {
    const [n, k] = T72[z].nk[0];
    for (const [befehl, cmd, abgelehnt] of BEFEHLE) {
      const kv = stateKvAus({ ...lage(z, n, k).kurz, befehl });
      ck(`${z}, befehl ${befehl ? `${befehl.kennung}/${befehl.abgelehnt}` : 'null'}: zoom_cmd=„${cmd}“, zoom_cmd_rejected=${abgelehnt}`,
        kv !== null && kv.zoom_cmd === cmd && kv.zoom_cmd_rejected === abgelehnt);
    }
  }
  ck('Z0 (macOS) mit Befehl: weiterhin keine zoom_*-Schlüssel',
    stateKvAus({ ...lage('Z0', 0, 0).kurz, befehl: { kennung: 'ok', abgelehnt: false } }) === null);
}

console.log('— 4b: Gemerkte Quellen (Spec 9 Punkt 9, Stand grenze)');
{
  const e = (stand: ZoomSollEintrag['stand']): ZoomSollEintrag => ({
    name: 'Anna Maria', ton: true, ndiName: 'JM Connect – Zoom Anna Maria', stand, aboId: stand === 'verwaist' ? 16778240 : null, doppelname: false,
  });
  const SOLL: Record<ZoomSollEintrag['stand'], string> = {
    wartet: 'Anna Maria — wartet auf die Person',
    doppelname: 'Anna Maria — Name doppelt, bitte von Hand laden',
    verwaist: 'Anna Maria — Person weg, Quelle schwarz',
    grenze: 'Anna Maria — nicht automatisch geladen (mehr als 5 Zoom-Quellen), bitte von Hand laden',
  };
  ck('ZoomSollEintrag kennt vier Stände', Object.keys(SOLL).length === 4);
  for (const s of Object.keys(SOLL) as Array<ZoomSollEintrag['stand']>) ck(`sollZeile ${s} wörtlich`, sollZeile(e(s)) === SOLL[s]);
}

console.log('— 4b: Bild und Ton der Quelle im Klartext (Spec 9 Punkt 8, N4b.3 Nr. 8 „Rohwerte“)');
{
  const SCHWARZ: Record<VideoReason, string> = {
    command: 'Bild schwarz: kein Bild von Zoom',
    frames: 'Bild schwarz: kein Bild von Zoom',
    cameraOff: 'Bild schwarz: Kamera aus',
    participantLeft: 'Bild schwarz: Person weg',
    rebound: 'Bild schwarz: kein Bild von Zoom',
    bufferMismatch: 'Bild schwarz: fehlerhafte Bilder',
    meetingEnded: 'Bild schwarz: kein Bild von Zoom',
    reboundByName: 'Bild schwarz: kein Bild von Zoom',
    privilegeRevoked: 'Bild schwarz: kein Bild von Zoom',
  };
  ck('VideoReason hat 9 Werte (mit privilegeRevoked)', Object.keys(SCHWARZ).length === 9);
  for (const g of Object.keys(SCHWARZ) as VideoReason[]) ck(`bildText black/${g}`, bildText('black', g) === SCHWARZ[g]);
  ck('bildText subscribed: „Bild: erstes Bild steht aus“', bildText('subscribed', 'command') === 'Bild: erstes Bild steht aus');
  ck('bildText live: „Bild läuft“, der Grund zählt nicht', bildText('live', 'frames') === 'Bild läuft' && bildText('live', 'rebound') === 'Bild läuft');
  const AUS: Record<AudioReason, string> = {
    command: 'Ton aus',
    audioUnavailable: 'Ton nicht verfügbar',
    packets: 'Ton aus',
    gap: 'Ton aus',
    participantLeft: 'Ton aus: Person weg',
    meetingEnded: 'Ton aus',
    rebound: 'Ton aus',
    reboundByName: 'Ton aus',
    privilegeRevoked: 'Ton aus',
  };
  ck('AudioReason hat 9 Werte (mit privilegeRevoked)', Object.keys(AUS).length === 9);
  for (const g of Object.keys(AUS) as AudioReason[]) ck(`tonText off/${g}`, tonText('off', g) === AUS[g]);
  ck('tonText off ohne Grund: „Ton aus“', tonText('off', null) === 'Ton aus');
  ck('tonText aus (ohne Ton geladen): „ohne Ton“', tonText('aus', null) === 'ohne Ton' && tonText('aus', 'command') === 'ohne Ton');
  ck('tonText waiting: „Ton: wartet auf das erste Paket“', tonText('waiting', 'command') === 'Ton: wartet auf das erste Paket');
  ck('tonText live: „Ton läuft“', tonText('live', 'packets') === 'Ton läuft');
  ck('tonText silent: „Ton: Stille“', tonText('silent', 'gap') === 'Ton: Stille');
  const q: ZoomQuelle = {
    aboId: 16778240, ndiName: 'JM Connect – Zoom Anna', bild: 'black', bildGrund: 'cameraOff', ton: 'off', tonGrund: 'audioUnavailable', fehler: null,
  };
  ck('quellenZustandText: „Bild … · Ton …“', quellenZustandText(q) === 'Bild schwarz: Kamera aus · Ton nicht verfügbar');
  ck('quellenZustandText: frisch ohne Ton geladen',
    quellenZustandText({ ...q, bild: 'subscribed', bildGrund: 'command', ton: 'aus', tonGrund: null }) === 'Bild: erstes Bild steht aus · ohne Ton');
}

console.log('— 4b: Versatz-Zeile (Spec 9 Punkt 7, N4b.3 Nr. 4, L14)');
{
  const v = (bestaetigtMs: number | null, nurSitzung: boolean): ZoomAbbild => abbild({ versatz: { gewuenschtMs: 250, bestaetigtMs, nurSitzung } });
  ck('bestätigt 250 ms', JSON.stringify(versatzZeile(v(250, false))) === JSON.stringify(['bestätigt: 250 ms']));
  ck('bestätigt 0 ms (0 ist ein Wert, kein „fehlt“)', JSON.stringify(versatzZeile(v(0, false))) === JSON.stringify(['bestätigt: 0 ms']));
  ck('ohne Sitzung: „gilt ab dem nächsten Beitritt“', JSON.stringify(versatzZeile(v(null, false))) === JSON.stringify(['gilt ab dem nächsten Beitritt']));
  ck('nur für diese Sitzung: zweite Zeile TEXT_A4_SCHREIBFEHLER',
    JSON.stringify(versatzZeile(v(250, true))) === JSON.stringify(['bestätigt: 250 ms', TEXT_A4_SCHREIBFEHLER]));
  ck('… auch ohne Meeting', JSON.stringify(versatzZeile(v(null, true))) === JSON.stringify(['gilt ab dem nächsten Beitritt', TEXT_A4_SCHREIBFEHLER]));
  // Die Karte übernimmt den Wert bei „ok“ und bei „nur für diese Sitzung“ (L14); jede andere Antwort ist ein Fehler am Feld.
  ck('versatzUebernommen: ok und TEXT_A4_SCHREIBFEHLER gelten, jede andere Antwort nicht',
    versatzUebernommen({ ok: true }) && versatzUebernommen({ ok: false, text: TEXT_A4_SCHREIBFEHLER })
      && !versatzUebernommen({ ok: false, text: 'Bild-Versatz: ganze Zahl von 0 bis 1000 ms.' }) && !versatzUebernommen({ ok: false, text: '' }));
}

console.log('— 4b: Sperre S10 auch während des Abbaus (L13)');
{
  const z2 = abbild({ abbauLaeuft: true, erneutMoeglich: true, meldung: { art: 'warnung', text: 'Meeting beendet: vom Gastgeber beendet.', detail: null } });
  ck('Z2 mit abbauLaeuft: Einrichtung gesperrt, „Zoom-SDK laden“ gesperrt',
    !zoomKnoepfe(z2).einrichtungAenderbar && zoomKnoepfe(z2).sdkLaden === 'gesperrt');
  const z13 = abbild({
    kurz: { zustand: 'fehler' }, abbauLaeuft: true, erneutMoeglich: true, meldung: { art: 'fehler', text: 'Wiederbeitritt abgebrochen.', detail: null },
  });
  ck('Z13 mit abbauLaeuft: Einrichtung gesperrt, „Erneut beitreten“ bleibt',
    !zoomKnoepfe(z13).einrichtungAenderbar && zoomKnoepfe(z13).meldung?.erneut === true);
  ck('Z1a mit abbauLaeuft: Einrichtung gesperrt',
    !zoomKnoepfe(abbild({ kurz: { zustand: 'einrichtung', maengel: ['zugang_fehlt'] }, abbauLaeuft: true })).einrichtungAenderbar);
  ck('ohne Abbau: Z2 und Z13 wie bisher änderbar', zoomKnoepfe(abbild()).einrichtungAenderbar && zoomKnoepfe({ ...z13, abbauLaeuft: false }).einrichtungAenderbar);
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npx tsx apps/connect/test/zoom-text.test.ts
```
Erwartet (gemessen): Exitcode 1, Abbruch beim Laden mit
```
SyntaxError: The requested module '../src/shared/zoom-text' does not provide an export named 'BETRIEBSGROESSE'
```

- [ ] **Step 3: Typen** (`apps/connect/src/shared/types.ts`)

Ersetzung 7 (`apps/connect/src/shared/types.ts`, Zeile 98), Vorher:
```ts
export type ZoomErlaubnis = 'offen' | 'ja' | 'abgelehnt' | 'abgelaufen' | 'entzogen';
```
Nachher:
```ts
export type ZoomErlaubnis = 'offen' | 'ja' | 'abgelehnt' | 'abgelaufen' | 'entzogen';

/** Ergebnis eines zoom_*-Befehls als Kennung (Spec 8.6): 'ok' oder die Hinweis-ID in Kleinbuchstaben. */
export type ZoomBefehlKennung = 'ok' | 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6' | 'f7' | 'f8';
/** `abgelehnt` ist true bei F1–F7. F8 ist eine Warnung, der Befehl wurde ausgeführt (Spec 11.2). */
export interface ZoomBefehlErgebnis { kennung: ZoomBefehlKennung; abgelehnt: boolean }
```

Ersetzung 8 (`apps/connect/src/shared/types.ts`, Zeile 144), Vorher:
```ts
  stand: 'wartet' | 'doppelname' | 'verwaist';
```
Nachher:
```ts
  /** 'grenze': würde abonniert, aber die Betriebsgröße ist erreicht (L7, N4b.3 Nr. 3); zählt als offen. */
  stand: 'wartet' | 'doppelname' | 'verwaist' | 'grenze';
```

Ersetzung 9 (`apps/connect/src/shared/types.ts`, Zeilen 172–173, Ende von `ZoomKurz`), Vorher:
```ts
  kopieLaeuft: boolean;
}
```
Nachher:
```ts
  kopieLaeuft: boolean;
  /** Letzter zoom_*-Befehl der Fernsteuerung (Spec 11.2, 8.6); null vor dem ersten. Hängt nicht am Zustand (7.5). */
  befehl: ZoomBefehlErgebnis | null;
}
```

Ersetzung 10 (`apps/connect/src/shared/types.ts`, Zeile 192), Vorher:
```ts
  versatz: { gewuenschtMs: number; bestaetigtMs: number | null };
```
Nachher:
```ts
  /** `nurSitzung`: Die Einstellungsdatei ließ sich nicht schreiben, der Wert gilt nur bis zum Beenden (N4b.3 Nr. 4, L14). */
  versatz: { gewuenschtMs: number; bestaetigtMs: number | null; nurSitzung: boolean };
```

Ersetzung 11 (`apps/connect/src/shared/types.ts`, Zeilen 204–205, Ende von `ZoomAbbild`), Vorher:
```ts
  pruefungLaeuft: boolean;
}
```
Nachher:
```ts
  pruefungLaeuft: boolean;
  /** Eine gestoppte Bridge baut noch ab (Sperre S10, L13). */
  abbauLaeuft: boolean;
}
```

- [ ] **Step 4: Statustexte** (`apps/connect/src/shared/zoom-text.ts`)

Ersetzung 12 (`apps/connect/src/shared/zoom-text.ts`, Zeile 8), Vorher:
```ts
import type { AppStatus, ProxyKeySource, ZoomAbbild, ZoomErlaubnis, ZoomKurz, ZoomMangel } from './types';
```
Nachher:
```ts
import type { AudioReason, VideoReason } from '@jm/zoom-bridge/protocol';
import type {
  AppStatus, ProxyKeySource, ZoomAbbild, ZoomBefehlKennung, ZoomErgebnis, ZoomErlaubnis, ZoomKurz, ZoomMangel, ZoomQuelle, ZoomSollEintrag,
} from './types';
```

Ersetzung 13 (`apps/connect/src/shared/zoom-text.ts`, Zeilen 36–40; der Kommentar zu `MANGEL_GRUND` stand bisher über `Q9_ANFANG`), Vorher:
```ts
/** Gründe im Kartentext Z1a (Spec 7.2), je Mangel einer. */
/** Anfang von Q9: Main (klartext.ts) und Karte teilen ihn; die Karte macht daraus den zweiten Klick „trotzdem laden“. */
export const Q9_ANFANG = 'Mehr als 5 Zoom-Quellen sind nicht gemessen.';

export const MANGEL_GRUND: Record<ZoomMangel, string> = {
```
Nachher:
```ts
/** Betriebsgröße (Owner-Entscheidung, Spec 5.2): mehr Zoom-Quellen gleichzeitig sind nicht gemessen. Main und Karte teilen sie (L16). */
export const BETRIEBSGROESSE = 5;
/** Höchstens so viele Wiederbeitritts-Versuche nach einem Abriss (Spec 6.4); die Wartezeiten stehen in main/zoom/fristen.ts. */
export const WIEDERBEITRITT_VERSUCHE = 5;

/** Anfang von Q9: Main (klartext.ts) und Karte teilen ihn; die Karte macht daraus den zweiten Klick „trotzdem laden“. */
export const Q9_ANFANG = `Mehr als ${BETRIEBSGROESSE} Zoom-Quellen sind nicht gemessen.`;

/** Gründe im Kartentext Z1a (Spec 7.2), je Mangel einer. */
export const MANGEL_GRUND: Record<ZoomMangel, string> = {
```

Ersetzung 14 (`apps/connect/src/shared/zoom-text.ts`, Zeilen 109–110, `zoomZeile` Z7), Vorher:
```ts
    case 'Z7':
      return '△ Zoom: im Meeting ohne Aufnahme-Erlaubnis';
```
Nachher:
```ts
    case 'Z7':
      // N4b.1: Beim Entzug baut die Bridge alle Abos ab; nach der Wiedererteilung lädt Connect die gemerkten Quellen selbst
      // neu. Ohne gemerkte Quelle (nichts lief, alles vergessen) stimmt „Quellen gestoppt“ nicht: dann der bisherige Text.
      return k.erlaubnis === 'entzogen' && k.sollOffen > 0
        ? '△ Zoom: Aufnahme-Erlaubnis vom Host entzogen, Quellen gestoppt'
        : '△ Zoom: im Meeting ohne Aufnahme-Erlaubnis';
```

Ersetzung 15 (`apps/connect/src/shared/zoom-text.ts`, Zeile 122, `zoomZeile` Z11), Vorher:
```ts
      return `△ Zoom: Verbindung verloren, Wiederbeitritt ${k.versuch} von 5`;
```
Nachher:
```ts
      return `△ Zoom: Verbindung verloren, Wiederbeitritt ${k.versuch} von ${WIEDERBEITRITT_VERSUCHE}`;
```

Ersetzung 16 (`apps/connect/src/shared/zoom-text.ts`, Zeilen 130–143), Vorher:
```ts
/** Z7 (n = 0): der ganze Satz zum Grund. 'offen' ist dort Z6, 'ja' ist Z8. */
const Z7_GRUND: Record<'abgelehnt' | 'abgelaufen' | 'entzogen', string> = {
  abgelehnt: 'Der Host hat abgelehnt.',
  abgelaufen: 'Zoom hat keine Antwort bekommen.',
  entzogen: 'Der Host hat sie entzogen.',
};

/** Z7b (n > 0): der Grund in Klammern. 'ja' ist dort Z9/Z9b. */
const Z7B_GRUND: Record<Exclude<ZoomErlaubnis, 'ja'>, string> = {
  offen: 'angefragt, noch keine Antwort',
  abgelehnt: 'vom Host abgelehnt',
  abgelaufen: 'keine Antwort bekommen',
  entzogen: 'vom Host entzogen',
};
```
Nachher:
```ts
/**
 * Z7 (n = 0): der ganze Satz zum Grund. 'offen' ist dort Z6, 'ja' ist Z8. 'entzogen' mit gemerkten Quellen hat einen
 * eigenen Text (Z7_ENTZOGEN); ohne gemerkte Quelle gilt der Satz hier.
 */
const Z7_GRUND: Record<'abgelehnt' | 'abgelaufen' | 'entzogen', string> = {
  abgelehnt: 'Der Host hat abgelehnt.',
  abgelaufen: 'Zoom hat keine Antwort bekommen.',
  entzogen: 'Der Host hat sie entzogen.',
};

/** Z7b (n > 0): der Grund in Klammern. 'ja' ist dort Z9/Z9b, 'entzogen' hat einen eigenen Text (kartenZeile). */
const Z7B_GRUND: Record<Exclude<ZoomErlaubnis, 'ja' | 'entzogen'>, string> = {
  offen: 'angefragt, noch keine Antwort',
  abgelehnt: 'vom Host abgelehnt',
  abgelaufen: 'keine Antwort bekommen',
};

/**
 * Entzug (N4b.1, Texttabelle 4b): Die Bridge baut alle Abos ab, Connect behält die Soll-Liste und lädt nach
 * der Wiedererteilung selbst neu. n > 0 gibt es dabei nur, solange die Bridge noch abbaut (Z7b); danach steht Z7,
 * und zwar mit diesem Text nur, solange es gemerkte Quellen gibt (sollOffen > 0).
 */
const Z7_ENTZOGEN =
  'Aufnahme-Erlaubnis vom Host entzogen, Quellen gestoppt. Erteilt der Host sie im Zoom-Client wieder, lädt Connect die gemerkten Quellen von selbst.';
```

Ersetzung 17 (`apps/connect/src/shared/zoom-text.ts`, Zeilen 184–187, `kartenZeile` Z7/Z7b), Vorher:
```ts
      // zoomZ liefert Z7 nur für abgelehnt/abgelaufen/entzogen.
      return `Im Meeting ohne Aufnahme-Erlaubnis. ${Z7_GRUND[e as keyof typeof Z7_GRUND]} Der Host kann sie im Zoom-Client jederzeit erteilen; Connect merkt das von selbst.`;
    case 'Z7b':
      return `Die Aufnahme-Erlaubnis fehlt (${Z7B_GRUND[e as keyof typeof Z7B_GRUND]}). ${quellenText(k.quellen)} ${k.quellen === 1 ? 'besteht' : 'bestehen'} noch. Der Host kann sie im Zoom-Client erteilen.`;
```
Nachher:
```ts
      // zoomZ liefert Z7 nur für abgelehnt/abgelaufen/entzogen. „Quellen gestoppt“ nur, wenn es gemerkte Quellen gibt.
      if (e === 'entzogen' && k.sollOffen > 0) return Z7_ENTZOGEN;
      return `Im Meeting ohne Aufnahme-Erlaubnis. ${Z7_GRUND[e as keyof typeof Z7_GRUND]} Der Host kann sie im Zoom-Client jederzeit erteilen; Connect merkt das von selbst.`;
    case 'Z7b':
      if (e === 'entzogen') return `Aufnahme-Erlaubnis vom Host entzogen. Connect stoppt ${quellenText(k.quellen)} …`;
      return `Die Aufnahme-Erlaubnis fehlt (${Z7B_GRUND[e as keyof typeof Z7B_GRUND]}). ${quellenText(k.quellen)} ${k.quellen === 1 ? 'besteht' : 'bestehen'} noch. Der Host kann sie im Zoom-Client erteilen.`;
```

Ersetzung 18 (`apps/connect/src/shared/zoom-text.ts`, Zeilen 198–200, `kartenZeile` Z11), Vorher:
```ts
      if (naechsterUm === null) return `Verbindung zum Meeting verloren. Wiederbeitritt ${k.versuch} von 5 läuft …`;
      const s = Math.max(0, Math.ceil((naechsterUm - jetztMs) / 1000));
      return `Verbindung zum Meeting verloren. Wiederbeitritt ${k.versuch} von 5 in ${s} s.`;
```
Nachher:
```ts
      if (naechsterUm === null) return `Verbindung zum Meeting verloren. Wiederbeitritt ${k.versuch} von ${WIEDERBEITRITT_VERSUCHE} läuft …`;
      const s = Math.max(0, Math.ceil((naechsterUm - jetztMs) / 1000));
      return `Verbindung zum Meeting verloren. Wiederbeitritt ${k.versuch} von ${WIEDERBEITRITT_VERSUCHE} in ${s} s.`;
```

Ersetzung 19 (`apps/connect/src/shared/zoom-text.ts`, Zeilen 241–248), Vorher:
```ts
/** Die fünf Zoom-Schlüssel im STATE (Spec 7.5; zoom_cmd* kommt mit der Fernsteuerung, Plan 4b). */
export interface ZoomStateKv {
  zoom_status: ZoomStatusWert;
  zoom_sources: number;
  zoom_live: 0 | 1;
  zoom_privilege: 0 | 1;
  zoom_alarm: 0 | 1;
}
```
Nachher:
```ts
/** Die sieben Zoom-Schlüssel im STATE (Spec 7.5, 11.1). Keiner führt einen Namen (G5). */
export interface ZoomStateKv {
  zoom_status: ZoomStatusWert;
  zoom_sources: number;
  zoom_live: 0 | 1;
  zoom_privilege: 0 | 1;
  zoom_alarm: 0 | 1;
  /** Ergebnis des letzten zoom_*-Befehls (8.6, 11.2): leer vor dem ersten, sonst 'ok' oder 'f1' … 'f8'. */
  zoom_cmd: '' | ZoomBefehlKennung;
  /** 1 bei F1–F7, sonst 0 (F8 ist eine Warnung, der Befehl wurde ausgeführt). */
  zoom_cmd_rejected: 0 | 1;
}
```

Ersetzung 20 (`apps/connect/src/shared/zoom-text.ts`, Zeilen 284–286, Ende von `stateKvAus`), Vorher:
```ts
    zoom_alarm: s.alarm[k.sollOffen > 0 ? 1 : 0],
  };
}
```
Nachher:
```ts
    zoom_alarm: s.alarm[k.sollOffen > 0 ? 1 : 0],
    // Hängen nicht am Zustand (7.5): der letzte Befehl bleibt stehen, bis der nächste kommt.
    zoom_cmd: k.befehl?.kennung ?? '',
    zoom_cmd_rejected: k.befehl?.abgelehnt ? 1 : 0,
  };
}
```

Ersetzung 21 (`apps/connect/src/shared/zoom-text.ts`, Zeilen 288–293, `sdkZeile`; N4b.3 Nr. 8 „Fassung aus den Konstanten“), Vorher:
```ts
/** SDK-Zeile im Einrichtungsbereich der Karte (Spec 9 Punkt 3). */
export function sdkZeile(a: ZoomAbbild): string {
  if (a.kurz.maengel.includes('sdk_fehlt')) return 'Zoom-SDK: nicht eingerichtet';
  if (a.kurz.maengel.includes('sdk_defekt')) return 'Zoom-SDK: Laufzeit unvollständig';
  return 'Zoom-SDK 7.1.5.43953 eingerichtet';
}
```
Nachher:
```ts
/**
 * SDK-Zeile im Einrichtungsbereich der Karte (Spec 9 Punkt 3). Die Fassung kommt aus dem Abbild: Der Kern setzt sie
 * aus SDK_FASSUNG (N4b.3 Nr. 8, kein Literal; `shared/*` lädt `@jm/zoom-bridge/sdk` nicht, G8).
 */
export function sdkZeile(a: ZoomAbbild): string {
  if (a.kurz.maengel.includes('sdk_fehlt')) return 'Zoom-SDK: nicht eingerichtet';
  if (a.kurz.maengel.includes('sdk_defekt')) return 'Zoom-SDK: Laufzeit unvollständig';
  const f = a.einrichtung.sdk.fassung;
  return f ? `Zoom-SDK ${f} eingerichtet` : 'Zoom-SDK eingerichtet';
}
```

Ersetzung 22 (`apps/connect/src/shared/zoom-text.ts`, Zeile 355), Vorher:
```ts
  /** SDK-Ordner/Zugangsdaten wählen oder entfernen: nur Z1a, Z2 ohne Prüfung, Z13 (sonst Tooltip S10). */
```
Nachher:
```ts
  /** SDK-Ordner/Zugangsdaten wählen oder entfernen: nur Z1a, Z2 ohne Prüfung, Z13 und nie während eines Abbaus (sonst Tooltip S10). */
```

Ersetzung 23 (`apps/connect/src/shared/zoom-text.ts`, Zeile 393), Vorher:
```ts
  const einrichtungAenderbar = z === 'Z1a' || (z === 'Z2' && !a.pruefungLaeuft) || z === 'Z13';
```
Nachher:
```ts
  // L13: S10 gilt auch, solange eine gestoppte Bridge noch abbaut.
  const einrichtungAenderbar = (z === 'Z1a' || (z === 'Z2' && !a.pruefungLaeuft) || z === 'Z13') && !a.abbauLaeuft;
```

Ersetzung 24 (`apps/connect/src/shared/zoom-text.ts`, Zeilen 406–409, Ende der Datei), Vorher:
```ts
    einrichtungOffen: mangel,
    sperrHinweis: mangel,
  };
}
```
Nachher:
```ts
    einrichtungOffen: mangel,
    sperrHinweis: mangel,
  };
}

/** Gemerkte Quellen (Spec 9 Punkt 9, Texttabelle 4b): Text je Stand eines offenen Soll-Eintrags. */
const SOLL_STAND: Record<ZoomSollEintrag['stand'], string> = {
  wartet: 'wartet auf die Person',
  doppelname: 'Name doppelt, bitte von Hand laden',
  verwaist: 'Person weg, Quelle schwarz',
  grenze: `nicht automatisch geladen (mehr als ${BETRIEBSGROESSE} Zoom-Quellen), bitte von Hand laden`,
};

/** Eine Zeile unter „Gemerkte Quellen“: „{Name} — {Stand}“. */
export function sollZeile(e: ZoomSollEintrag): string {
  return `${e.name} — ${SOLL_STAND[e.stand]}`;
}

/** Bild `black` je Grund (Texttabelle 4b). Record über alle Gründe: ein neuer Grund scheitert im Typcheck. */
const BILD_SCHWARZ: Record<VideoReason, string> = {
  command: 'kein Bild von Zoom',
  frames: 'kein Bild von Zoom',
  cameraOff: 'Kamera aus',
  participantLeft: 'Person weg',
  rebound: 'kein Bild von Zoom',
  bufferMismatch: 'fehlerhafte Bilder',
  meetingEnded: 'kein Bild von Zoom',
  reboundByName: 'kein Bild von Zoom',
  privilegeRevoked: 'kein Bild von Zoom',
};

/** Bild-Zustand einer Quelle im Klartext statt Rohwert (N4b.3 Nr. 8). */
export function bildText(bild: ZoomQuelle['bild'], grund: VideoReason): string {
  if (bild === 'subscribed') return 'Bild: erstes Bild steht aus';
  if (bild === 'live') return 'Bild läuft';
  return `Bild schwarz: ${BILD_SCHWARZ[grund]}`;
}

/** Ton `off` je Grund (Texttabelle 4b); nur zwei Gründe haben einen eigenen Text. */
const TON_AUS: Record<AudioReason, string> = {
  command: 'Ton aus',
  audioUnavailable: 'Ton nicht verfügbar',
  packets: 'Ton aus',
  gap: 'Ton aus',
  participantLeft: 'Ton aus: Person weg',
  meetingEnded: 'Ton aus',
  rebound: 'Ton aus',
  reboundByName: 'Ton aus',
  privilegeRevoked: 'Ton aus',
};

/** Ton-Zustand einer Quelle im Klartext; 'aus' = ohne Ton geladen (kein Fehler). */
export function tonText(ton: ZoomQuelle['ton'], grund: AudioReason | null): string {
  switch (ton) {
    case 'aus':
      return 'ohne Ton';
    case 'waiting':
      return 'Ton: wartet auf das erste Paket';
    case 'live':
      return 'Ton läuft';
    case 'silent':
      return 'Ton: Stille';
    case 'off':
      return grund === null ? 'Ton aus' : TON_AUS[grund];
  }
}

/** Bild und Ton einer Quelle in einer Zeile der Teilnehmerliste (Spec 9 Punkt 8). */
export function quellenZustandText(q: ZoomQuelle): string {
  return `${bildText(q.bild, q.bildGrund)} · ${tonText(q.ton, q.tonGrund)}`;
}

/** Zeilen unter dem Feld „Bild-Versatz (ms)“ (Spec 9 Punkt 7); bei `nurSitzung` zusätzlich TEXT_A4_SCHREIBFEHLER (L14). */
export function versatzZeile(a: ZoomAbbild): string[] {
  const zeilen = [a.versatz.bestaetigtMs !== null ? `bestätigt: ${a.versatz.bestaetigtMs} ms` : 'gilt ab dem nächsten Beitritt'];
  if (a.versatz.nurSitzung) zeilen.push(TEXT_A4_SCHREIBFEHLER);
  return zeilen;
}

/**
 * Antwort auf „Bild-Versatz“: Übernimmt die Karte den Wert? Ja bei ok und bei „nur für diese Sitzung gemerkt“ (L14:
 * der Wert gilt, versatzZeile zeigt den Hinweis dauerhaft). Jede andere Antwort ist ein Fehler am Feld.
 */
export function versatzUebernommen(r: ZoomErgebnis): boolean {
  return r.ok || r.text === TEXT_A4_SCHREIBFEHLER;
}
```

- [ ] **Step 5: Der Kern liefert die neuen Felder mit Vorgabewerten** (`apps/connect/src/main/zoom/kern.ts`, nur `kurz()` und `abbild()`)

Ersetzung 25 (`apps/connect/src/main/zoom/kern.ts`, Zeilen 336–338, Ende von `kurz()`), Vorher:
```ts
      kopieLaeuft: kopie !== null || ladung !== null,
    };
  }
```
Nachher:
```ts
      kopieLaeuft: kopie !== null || ladung !== null,
      // Aufgabe 13 (4b) setzt den letzten zoom_*-Befehl; bis dahin gibt es keinen.
      befehl: null,
    };
  }
```

Ersetzung 26 (`apps/connect/src/main/zoom/kern.ts`, Zeile 357), Vorher:
```ts
      versatz: { gewuenschtMs: d.einstellungen.versatzMs(), bestaetigtMs: aktiveSitzung()?.videoDelayMs ?? null },
```
Nachher:
```ts
      // nurSitzung liest ab Aufgabe 11 (4b) einstellungen.versatzNurSitzung().
      versatz: { gewuenschtMs: d.einstellungen.versatzMs(), bestaetigtMs: aktiveSitzung()?.videoDelayMs ?? null, nurSitzung: false },
```

Ersetzung 27 (`apps/connect/src/main/zoom/kern.ts`, Zeilen 363–365, Ende von `abbild()`), Vorher:
```ts
      erneutMoeglich: nummer !== null,
      pruefungLaeuft,
    };
```
Nachher:
```ts
      erneutMoeglich: nummer !== null,
      pruefungLaeuft,
      // L13: Eine gestoppte Bridge baut noch ab; die Karte sperrt die Einrichtung (S10).
      abbauLaeuft: stopps.size > 0,
    };
```

- [ ] **Step 6: Test laufen lassen (grün)**

```
npx tsx apps/connect/test/zoom-text.test.ts
```
Erwartet (gemessen): keine Zeile mit `FAIL`, Exitcode 0, letzte Zeile `660 ok, 0 fehlgeschlagen.` (vorher 529). Unter anderem:
```
  ok  Quelltext-Wächter: zoom-text.ts schreibt „von 5“ und „Mehr als 5“ nicht als Literal
  ok  sdkZeile nennt die Fassung aus dem Abbild
  ok  Z7 entzogen mit gemerkten Quellen (o = 2): Tray/Kopfzeile wörtlich
  ok  Z7 entzogen ohne gemerkte Quelle (o = 0): kein „Quellen gestoppt“, Tray und Karte wie vor 4b (Spec 7: jeder Text wahr)
  ok  Z7b entzogen, n = 1: Karte im Singular
  ok  Z9, befehl f8/false: zoom_cmd=„f8“, zoom_cmd_rejected=0
  ok  sollZeile grenze wörtlich
  ok  bildText black/privilegeRevoked
  ok  nur für diese Sitzung: zweite Zeile TEXT_A4_SCHREIBFEHLER
  ok  versatzUebernommen: ok und TEXT_A4_SCHREIBFEHLER gelten, jede andere Antwort nicht
  ok  Z13 mit abbauLaeuft: Einrichtung gesperrt, „Erneut beitreten“ bleibt
```

Fall 10b im Kern-Test (`zoom-kern.test.ts`, nach Aufgabe 1 Step 13) bleibt grün, ohne Änderung: Nach dem Entladen gibt es keine gemerkte Quelle mehr (`sollOffen` 0), und die Karte zeigt weiter „… Der Host hat sie entzogen. …“.

- [ ] **Step 7: Selbsttest und Typcheck**

```
npm run selftest -w @jm/connect
npm run typecheck -w @jm/connect
```
Erwartet (gemessen): Exitcode 0 für beide. `selftest` endet je Datei mit `660 ok, 0 fehlgeschlagen.` (zoom-text), `86 ok, 0 fehlgeschlagen.` (zoom-laufzeit), `90 ok, 0 fehlgeschlagen.` (zoom-teile), `409 ok, 0 fehlgeschlagen, 0 übersprungen.` (zoom-kern), `33 ok, 0 fehlgeschlagen.` (zoom-settings), `79 ok, 0 fehlgeschlagen, 0 übersprungen.` (sdk-laden) und `Alle after-pack-Tests bestanden.`. `typecheck` ohne Ausgabe von `tsc` außer den beiden npm-Kopfzeilen.

- [ ] **Step 8: Commit** (Git Bash; Commit-Text ohne Umlaute)

```
git add apps/connect/src/shared/types.ts apps/connect/src/shared/zoom-text.ts apps/connect/src/main/zoom/kern.ts apps/connect/test/zoom-text.test.ts
git status --short
```
Erwartet genau:
```
M  apps/connect/src/main/zoom/kern.ts
M  apps/connect/src/shared/types.ts
M  apps/connect/src/shared/zoom-text.ts
M  apps/connect/test/zoom-text.test.ts
```
Dann:
```
git commit -m "feat(connect): Typen und Statustexte fuer 4b (zoom_cmd, Entzug, Grenze, Bild/Ton im Klartext)" -m "types.ts: ZoomBefehlKennung/ZoomBefehlErgebnis, ZoomKurz.befehl, Stand grenze, ZoomAbbild.versatz.nurSitzung und abbauLaeuft. zoom-text.ts: BETRIEBSGROESSE und WIEDERBEITRITT_VERSUCHE als Konstanten (Z11, Q9_ANFANG), SDK-Zeile mit der Fassung aus dem Abbild, STATE mit zoom_cmd und zoom_cmd_rejected, eigene Z7/Z7b-Texte beim Entzug (Quellen gestoppt nur mit gemerkten Quellen), sollZeile mit grenze, Bild und Ton im Klartext, Versatz-Zeile mit nur fuer diese Sitzung samt versatzUebernommen, Sperre S10 auch waehrend eines Abbaus. Der Kern liefert die neuen Felder mit Vorgabewerten." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Gegenprobe — nach dem Commit, ohne neuen Commit**

Je Zeile den Vorher-Text mit dem Edit-Werkzeug ersetzen, `npx tsx apps/connect/test/zoom-text.test.ts` laufen lassen (muss rot werden, Exitcode 1), dann zurück.
1. `zoom_cmd_rejected` aus der Kennung statt aus `abgelehnt` (`zoom-text.ts`): `zoom_cmd_rejected: k.befehl?.abgelehnt ? 1 : 0,` → `zoom_cmd_rejected: k.befehl && k.befehl.kennung !== 'ok' ? 1 : 0,`. Gemessen: `643 ok, 17 fehlgeschlagen.`, je Zeile von 7.5 `FAIL  <Z>, befehl f8/false: zoom_cmd=„f8“, zoom_cmd_rejected=0`.
2. Sperre im Abbau vergessen (`zoom-text.ts`): `|| z === 'Z13') && !a.abbauLaeuft;` → `|| z === 'Z13');`. Gemessen: `657 ok, 3 fehlgeschlagen.` mit `FAIL  Z2 mit abbauLaeuft: …`, `FAIL  Z13 mit abbauLaeuft: …`, `FAIL  Z1a mit abbauLaeuft: Einrichtung gesperrt`.
3. Literal statt Konstante (`zoom-text.ts`, `zoomZeile` Z11): `` Wiederbeitritt ${k.versuch} von ${WIEDERBEITRITT_VERSUCHE}`; `` → `` Wiederbeitritt ${k.versuch} von 5`; ``. Gemessen: `659 ok, 1 fehlgeschlagen.` mit `FAIL  Quelltext-Wächter: zoom-text.ts schreibt „von 5“ und „Mehr als 5“ nicht als Literal`.
4. Entzugs-Text ohne Blick auf gemerkte Quellen (`zoom-text.ts`, `kartenZeile` Z7): `if (e === 'entzogen' && k.sollOffen > 0) return Z7_ENTZOGEN;` → `if (e === 'entzogen') return Z7_ENTZOGEN;`. Gemessen: `658 ok, 2 fehlgeschlagen.` mit `FAIL  entzogen, n=0 → Z7, Kartentext wörtlich` und `FAIL  Z7 entzogen ohne gemerkte Quelle (o = 0): …`.
5. SDK-Fassung wieder als Literal (`zoom-text.ts`, `sdkZeile`): `` return f ? `Zoom-SDK ${f} eingerichtet` : 'Zoom-SDK eingerichtet'; `` → `return 'Zoom-SDK 7.1.5.43953 eingerichtet';`. Gemessen: `657 ok, 3 fehlgeschlagen.` mit `FAIL  sdkZeile nennt die Fassung aus dem Abbild`, `FAIL  … ohne Fassung im Abbild: „Zoom-SDK eingerichtet“` und `FAIL  Quelltext-Wächter: zoom-text.ts schreibt die SDK-Fassung nicht als Literal`.

Danach:
```
git status --short
```
Erwartet: keine Ausgabe.

**Abweichungen von der Gliederung:**
- **Nachbesserung: `zoom-kern.test.ts` bleibt in dieser Aufgabe unberührt.** Die erste Fassung änderte hier Fall 10b (der Z7-Text beim Entzug war neu, auch ohne gemerkte Quelle). Seit Z7 „Quellen gestoppt“ nur bei gemerkten Quellen sagt, bleibt nach dem Entladen der bisherige Text, und Fall 10b ist ohne Änderung grün. Aufgabe 8 Step 1 geht darum vom Wortlaut nach Aufgabe 1 (Step 13) aus; die Ankerzeile von `zoom-kern.test.ts` steht danach auf **2210** statt 2208 (Aufgabe 1 Step 13 macht aus einer Prüfung drei Zeilen).
- Zusätzlich zur Gliederung prüfen zwei Quelltext-Wächter (`readFileSync` auf `src/shared/zoom-text.ts`), dass „von 5“ und „Mehr als 5“ nicht mehr als Literal dastehen. Ohne sie wären die Fälle „Z11 nennt WIEDERBEITRITT_VERSUCHE“ auch mit dem alten Literal grün (5 = 5).
- Der Kommentar „Gründe im Kartentext Z1a“ stand fälschlich über `Q9_ANFANG`; er steht jetzt über `MANGEL_GRUND`.
- `kern.ts` bekommt an den drei Stellen je eine Kommentarzeile (Hinweis auf Aufgabe 11, 13 bzw. L13). Dadurch verschieben sich die Zeilen in `kern.ts` ab 337 um +2, ab 358 um +3 und ab 365 um +5 (vor Aufgabe 5).
- **Nachbesserung: Z7 beim Entzug hängt an `k.sollOffen > 0`.** Ohne gemerkte Quelle (es lief nie eine, oder alle sind vergessen oder entladen) bleiben Tray „△ Zoom: im Meeting ohne Aufnahme-Erlaubnis“ und der bisherige Kartentext „… Der Host hat sie entzogen. …“; „Quellen gestoppt“ und „lädt Connect die gemerkten Quellen von selbst“ wären dort falsch (Spec 7, Prüfregel 7.6). Das Feld `ZoomKurz.sollOffen` gibt es seit 4a (Spec 5.4); ein neues Feld braucht es nicht. Damit entfällt der frühere offene Punkt dazu.
- **Nachbesserung: `sdkZeile` liest die Fassung aus dem Abbild** (N4b.3 Nr. 8; 4a-Ledger, Task 5 minor). Der Kern setzt `einrichtung.sdk.fassung` aus `SDK_FASSUNG`; `shared/*` braucht dafür keinen Import (G8). Ein dritter Quelltext-Wächter prüft, dass „7.1.5“ nicht mehr in `zoom-text.ts` steht.
- **Nachbesserung: `versatzUebernommen`** (für Aufgabe 18): Die Karte entscheidet über diesen reinen Helfer, ob sie einen Versatz übernimmt; so ist die Regel aus L14 hier getestet statt nur im Renderer.

---

### Task 5: Connect: Konstanten und Klartexte (`fristen.ts`, `klartext.ts`)

**Spec:** `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md` 5.2 (Fristen), 6.4 (Tabelle „Einordnung“, Absatz „Unbekannte Codes zählen als vorübergehend“), 8.2 (B7, B16), 8.3 (Vorsatz „Wiederbeitritt abgebrochen: “, CT, CE), 8.4 (Q16, Q17), 8.5 (R2, R4, R5, R7), 8.6 (F1–F8), 8.7; Nachtrag N4b.2 („Keine Namen im Log“: Q16/Q17), N4b.3 Nr. 8 („Fassung und Fristen in den Klartexten aus den Konstanten ableiten“). Plan: G3, L3 (Singular in R5), L5 (Einordnung, wo die Spec schweigt), L11, L16, Texttabelle 4b (Log Q16/Q17, Log Fernsteuerung, Namensplatzhalter).

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\zoom-4b` (Branch `feat/zoom-stage4b`). Alle Pfade relativ dazu.

**Files:**
- Create: `apps/connect/src/main/zoom/fristen.ts`
- Modify: `apps/connect/src/main/zoom/kern.ts` — **nur** Zeilen 85–101 (Konstanten → Import und Weitergabe aus `./fristen`)
- Modify: `apps/connect/src/main/zoom/klartext.ts` — Zeilen 1–8 (Kopf, Importe), 30 (S3), 61 (S15), 80 (B7), 92 (B16), 100–101 (CT, CE), 129–133 (R2/R4/R5/R7, PRUEFUNG_OK), 245–250 (`Einordnung`, `quellenFehler`), 268–273 (Hinweise mit `logText`), 291–294 (neue Exporte dahinter)
- Test: `apps/connect/test/zoom-text.test.ts` — Zeilen 18–21 (Import aus `klartext`), 509 (R-Texte), 516 (Schlüsselprüfung `KT`), 642 und 644–645 (Hinweise mit `logText`), Ankerzeile 887

Zeilenangaben gelten für den Stand nach Aufgabe 4. Maßgeblich ist der wortgleiche Vorher-Text.

**Interfaces:**
- Consumes:
  - Aufgabe 4: `ZoomBefehlKennung` aus `../../shared/types`; `BETRIEBSGROESSE`, `WIEDERBEITRITT_VERSUCHE` aus `../../shared/zoom-text`.
  - Bestehend: `SDK_FASSUNG` (`'7.1.5.43953'`) und `SDK_FASSUNG_BRIDGE` (`'7.1.5 (43953)'`) aus `@jm/zoom-bridge/sdk`; `dllMeldung` (gleiche Datei).
- Produces (exakt so, Aufgaben 7–13 bauen darauf):
  ```ts
  // apps/connect/src/main/zoom/fristen.ts (rein, G8)
  export const ZOOM_FRISTEN = { anmeldeMs: 30_000, joinTimeoutMs: 30_000, killTimeoutMs: 12_000, abgleichMs: 300, aboAntwortMs: 10_000, abbildTaktMs: 100, unsubscribeWarteMs: 2_000 } as const;
  export type ZoomFristen = { [K in keyof typeof ZOOM_FRISTEN]: number };
  export const WIEDERBEITRITT_PLAN_S: readonly number[];   // [2, 5, 10, 20, 30]
  export const BEENDEN_FRIST_MS = 15_000;
  export const JWT_GUELTIG_S = 43_200;
  export const AUFLOESUNG = '720p' as const;
  export const HINWEISE_MAX = 5;
  export const ANZEIGENAME_VORGABE = 'JM Connect';
  export { BETRIEBSGROESSE } from '../../shared/zoom-text';
  // kern.ts reicht ANZEIGENAME_VORGABE, AUFLOESUNG, BEENDEN_FRIST_MS, BETRIEBSGROESSE, HINWEISE_MAX, JWT_GUELTIG_S,
  // WIEDERBEITRITT_PLAN_S, ZOOM_FRISTEN und den Typ ZoomFristen unverändert weiter (dieselben Bindungen).

  // apps/connect/src/main/zoom/klartext.ts
  KT.R2: (letzterGrund: string) => string;   // Schlusspunkt(e) von letzterGrund fallen weg
  KT.R4: (detail: string) => string;
  KT.R5: (k: number, d: number) => string;   // Singular bei 1 (L3)
  KT.R7: string;
  export type VersuchsAusgang =
    | { art: 'failed'; code: number } | { art: 'ended' } | { art: 'auth'; code: number }
    | { art: 'authSofort' } | { art: 'keineAuthAntwort' } | { art: 'init' } | { art: 'ndi' }
    | { art: 'sdkFassung' } | { art: 'spawn' } | { art: 'zugang' }
    | { art: 'exited'; exitCode: number | null }
    | { art: 'joinTimeout' } | { art: 'reconnectTimeout' } | { art: 'joinFehler' };
  export const ENDGUELTIGE_FAIL_CODES: ReadonlySet<number>;    // 4,6,7,8,9,10,12,13,14,16,23,60,61,62,63,64,82,88,89,500–506
  export function istEndgueltig(a: VersuchsAusgang): boolean;   // Tabelle 6.4 + L5
  export const FT: {
    F1: string; F2(name: string): string; F3(name: string, n: number): string;
    F4(grund: 'nicht im Meeting' | 'keine Aufnahme-Erlaubnis' | 'die Person ist im Warteraum'): string;
    F5(name: string): string; F6(arg: string): string; F7(verb: string): string; F8(n: number): string;
  };                                                             // je mit Vorsatz „Companion: “ (Objektliteral)
  export function fernLogText(kennung: ZoomBefehlKennung, verb: string): string;   // 'Companion: F3 (zoom_load)'
  export type Einordnung = { art: 'zeile'; text: string } | { art: 'hinweis'; text: string; logText: string } | { art: 'keine' };
  export function quellenFehler(code: string, name: string, person: string | null, dropped?: number, id?: number): Einordnung;
  export const NAME_PLATZHALTER = '‹Name›';
  export function maskiereNamen(zeile: string, namen: readonly string[]): string;
  // Aus Konstanten statt Literal: KT.S3, KT.S15 (SDK_FASSUNG), KT.B7, KT.PRUEFUNG_OK (SDK_FASSUNG_BRIDGE),
  // KT.B16 (anmeldeMs), KT.CT und KT.CE (joinTimeoutMs), KT.Q9 (über Q9_ANFANG, Aufgabe 4), FT.F8 (BETRIEBSGROESSE).
  // KT.UE_RECONNECT und KT.UE_ABSTURZ bleiben stehen; Aufgabe 8 entfernt sie.
  ```

**Regeln für diese Aufgabe:**
- `fristen.ts` und `klartext.ts` sind rein (G8): kein `electron`, keine Aliase, nur relative Importe und `@jm/zoom-bridge`.
- In `kern.ts` ändern sich **nur** die Konstanten (Zeilen 85–101). `zoom.ts`, `index.ts`, `settings.ts` und `zoom-kern.test.ts` importieren weiter aus `./zoom/kern` bzw. `../src/main/zoom/kern`.
- Kein Hinweistext und keine Logzeile aus dieser Aufgabe nennt einen Teilnehmernamen im Log: Hinweise mit Namen bekommen einen eigenen `logText` (N4b.2, L11).
- CRLF: bestehende Dateien mit dem Edit-Werkzeug (G14). Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel, nie pushen.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`apps/connect/test/zoom-text.test.ts`)

Ersetzung 1 (`apps/connect/test/zoom-text.test.ts`, Zeilen 18–21), Vorher:
```ts
import {
  authMeldung, dllMeldung, endeMeldung, exitCodeAus, failMeldung, failText, fehlerDetail, KT, mangelText, maskiere,
  quellenFehler, spawnMeldung, tonZustand, VORSATZ,
} from '../src/main/zoom/klartext';
```
Nachher:
```ts
import { SDK_FASSUNG, SDK_FASSUNG_BRIDGE } from '@jm/zoom-bridge/sdk';
import * as fristen from '../src/main/zoom/fristen';
import {
  authMeldung, dllMeldung, endeMeldung, ENDGUELTIGE_FAIL_CODES, exitCodeAus, failMeldung, failText, fehlerDetail, fernLogText, FT,
  istEndgueltig, KT, mangelText, maskiere, maskiereNamen, quellenFehler, spawnMeldung, tonZustand, VORSATZ, type VersuchsAusgang,
} from '../src/main/zoom/klartext';
```

Ersetzung 2 (`apps/connect/test/zoom-text.test.ts`, Zeile 509, Tabelle `KT_SOLL`), Vorher:
```ts
    ['R6', KT.R6('vom Gastgeber beendet'), 'Meeting beendet: vom Gastgeber beendet.'],
```
Nachher:
```ts
    ['R6', KT.R6('vom Gastgeber beendet'), 'Meeting beendet: vom Gastgeber beendet.'],
    ['R2', KT.R2('Zoom hat den Beitritt in 30 s weder bestätigt noch abgelehnt. Netzwerk prüfen und erneut versuchen.'),
      'Wiederbeitritt gescheitert (Zoom hat den Beitritt in 30 s weder bestätigt noch abgelehnt. Netzwerk prüfen und erneut versuchen). „Erneut beitreten“ versucht es noch einmal.'],
    ['R4', KT.R4('EXITED_UNEXPECTEDLY exitCode=3'), 'Die Zoom-Bridge ist abgestürzt (EXITED_UNEXPECTEDLY exitCode=3). Connect tritt neu bei.'],
    ['R5', KT.R5(2, 3), 'Wieder im Meeting. 2 Quellen neu geladen, 3 warten auf eine eindeutige Person.'],
    ['R7', KT.R7, 'Wiederbeitritt abgebrochen.'],
```

Ersetzung 3 (`apps/connect/test/zoom-text.test.ts`, Zeile 516; die feste Zahl 73 wird zur Schlüsselgleichheit, so muss Aufgabe 8 beim Entfernen von `UE_*` keine Zahl nachziehen), Vorher:
```ts
  ck('KT hat genau diese 73 Einträge (F1–F8, R2/R4/R5/R7 erst in 4b)', Object.keys(KT).length === 73 && KT_SOLL.length === 73);
```
Nachher:
```ts
  ck('KT und die Tabelle haben dieselben Schlüssel (jeder Text genau einmal wörtlich geprüft)',
    JSON.stringify(Object.keys(KT).sort()) === JSON.stringify(KT_SOLL.map(([id]) => id).sort()));
```

Ersetzung 4 (`apps/connect/test/zoom-text.test.ts`, Zeile 642), Vorher:
```ts
  ck('audioQueueOverflow → Hinweis Q6 mit dropped', JSON.stringify(e('audioQueueOverflow', 'AUDIO_QUEUE_OVERFLOW', null, 37)) === JSON.stringify({ art: 'hinweis', text: 'Ton: 37 Pakete verworfen — dieser PC kommt nicht hinterher.' }));
```
Nachher:
```ts
  ck('audioQueueOverflow → Hinweis Q6 mit dropped, Logtext gleich (kein Name darin)',
    JSON.stringify(e('audioQueueOverflow', 'AUDIO_QUEUE_OVERFLOW', null, 37)) === JSON.stringify({
      art: 'hinweis', text: 'Ton: 37 Pakete verworfen — dieser PC kommt nicht hinterher.', logText: 'Ton: 37 Pakete verworfen — dieser PC kommt nicht hinterher.',
    }));
```

Ersetzung 5 (`apps/connect/test/zoom-text.test.ts`, Zeilen 644–645), Vorher:
```ts
  ck('videoBufferMismatch → Hinweis Q16 (keine Zeile)', JSON.stringify(e('videoBufferMismatch', 'VIDEO_BUFFER_MISMATCH')) === JSON.stringify({ art: 'hinweis', text: KT.Q16('Anna') }));
  ck('audioBufferMismatch → Hinweis Q17 (keine Zeile)', JSON.stringify(e('audioBufferMismatch', 'AUDIO_BUFFER_MISMATCH', 'Ben')) === JSON.stringify({ art: 'hinweis', text: KT.Q17('Ben') }));
```
Nachher:
```ts
  ck('videoBufferMismatch → Hinweis Q16 (keine Zeile), Logtext mit Kennung statt Name',
    JSON.stringify(quellenFehler('videoBufferMismatch', 'VIDEO_BUFFER_MISMATCH', 'Anna', undefined, 16778240)) === JSON.stringify({
      art: 'hinweis', text: KT.Q16('Anna'), logText: 'Bild: fehlerhafte Bilder von Teilnehmer 16778240 verworfen (videoBufferMismatch).',
    }));
  ck('audioBufferMismatch → Hinweis Q17 (keine Zeile), Logtext mit Kennung statt Name',
    JSON.stringify(quellenFehler('audioBufferMismatch', 'AUDIO_BUFFER_MISMATCH', 'Ben', undefined, 16778243)) === JSON.stringify({
      art: 'hinweis', text: KT.Q17('Ben'), logText: 'Ton: ein fehlerhaftes Paket von Teilnehmer 16778243 verworfen (audioBufferMismatch).',
    }));
  const ohneId = quellenFehler('videoBufferMismatch', 'VIDEO_BUFFER_MISMATCH', 'Anna');
  ck('Q16 ohne Kennung im Ereignis: Logtext „Teilnehmer unbekannt“, nie der Name',
    ohneId.art === 'hinweis' && ohneId.logText.includes('Teilnehmer unbekannt') && !ohneId.logText.includes('Anna'));
```

Ersetzung 6 (`apps/connect/test/zoom-text.test.ts`, Zeile 887, die Ankerzeile), Vorher:
```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```
Nachher (Konstanten und ihre Weitergabe über `kern.ts`, Texte aus Konstanten samt Quelltext-Wächter, R-Texte und Vorsatz, die Einordnung als Tabelle, F1–F8, `maskiereNamen`):
```ts
// ── Aufgabe 5 (4b): Konstanten, Wiederbeitritt, Einordnung, Fernsteuer-Hinweise, Logtexte ohne Namen ──
console.log('— 4b: fristen.ts (Spec 5.2, G3) und die Weitergabe über kern.ts');
{
  ck('ZOOM_FRISTEN wie Spec 5.2', JSON.stringify(fristen.ZOOM_FRISTEN) === JSON.stringify({
    anmeldeMs: 30_000, joinTimeoutMs: 30_000, killTimeoutMs: 12_000, abgleichMs: 300, aboAntwortMs: 10_000, abbildTaktMs: 100, unsubscribeWarteMs: 2_000,
  }));
  ck('WIEDERBEITRITT_PLAN_S = 2, 5, 10, 20, 30 (eine Wartezeit je Versuch)',
    JSON.stringify(fristen.WIEDERBEITRITT_PLAN_S) === '[2,5,10,20,30]' && fristen.WIEDERBEITRITT_PLAN_S.length === WIEDERBEITRITT_VERSUCHE);
  ck('übrige Konstanten wie bisher', fristen.BEENDEN_FRIST_MS === 15_000 && fristen.JWT_GUELTIG_S === 43_200 && fristen.AUFLOESUNG === '720p'
    && fristen.HINWEISE_MAX === 5 && fristen.ANZEIGENAME_VORGABE === 'JM Connect');
  ck('fristen.ts reicht BETRIEBSGROESSE aus shared/zoom-text weiter (L16)', fristen.BETRIEBSGROESSE === BETRIEBSGROESSE);
  const kern = await import('../src/main/zoom/kern');
  ck('kern.ts reicht dieselben Konstanten weiter (zoom.ts, index.ts, settings.ts und die Tests importieren von dort)',
    kern.ZOOM_FRISTEN === fristen.ZOOM_FRISTEN && kern.WIEDERBEITRITT_PLAN_S === fristen.WIEDERBEITRITT_PLAN_S
      && kern.BEENDEN_FRIST_MS === fristen.BEENDEN_FRIST_MS && kern.JWT_GUELTIG_S === fristen.JWT_GUELTIG_S
      && kern.BETRIEBSGROESSE === BETRIEBSGROESSE && kern.AUFLOESUNG === fristen.AUFLOESUNG
      && kern.HINWEISE_MAX === fristen.HINWEISE_MAX && kern.ANZEIGENAME_VORGABE === fristen.ANZEIGENAME_VORGABE);
}

console.log('— 4b: Klartexte aus Konstanten statt Literal (N4b.3 Nr. 8)');
{
  const f = fristen.ZOOM_FRISTEN;
  ck('S3 nennt SDK_FASSUNG', KT.S3('7.1.6.1')
    === `Dieses Zoom-SDK hat die Fassung 7.1.6.1. Diese Connect-Fassung braucht genau ${SDK_FASSUNG}. Für eine andere SDK-Fassung braucht es einen neuen Connect-Release.`);
  ck('S15 nennt SDK_FASSUNG', KT.S15 === `Auf dem Proxy liegt kein passendes Zoom-SDK ${SDK_FASSUNG}. Bitte den SDK-Ordner von Hand wählen.`);
  ck('B7 nennt SDK_FASSUNG_BRIDGE', KT.B7('x') === `Die Zoom-Laufzeit meldet die Fassung x, erwartet ist ${SDK_FASSUNG_BRIDGE}. Bitte den SDK-Ordner erneut wählen.`);
  ck('PRUEFUNG_OK nennt SDK_FASSUNG_BRIDGE', KT.PRUEFUNG_OK === `Einrichtung in Ordnung: Zoom-SDK ${SDK_FASSUNG_BRIDGE}, Anmeldung bei Zoom erfolgreich.`);
  ck('B16 nennt anmeldeMs in Sekunden', KT.B16 === `Zoom hat auf die Anmeldung nicht geantwortet (${f.anmeldeMs / 1000} s). Netzwerk prüfen und erneut versuchen.`);
  ck('CT nennt joinTimeoutMs in Sekunden', KT.CT === `Zoom hat den Beitritt in ${f.joinTimeoutMs / 1000} s weder bestätigt noch abgelehnt. Netzwerk prüfen und erneut versuchen.`);
  ck('CE nennt joinTimeoutMs in Sekunden (derselbe Wachhund der Bridge)',
    KT.CE === `Der Host hat zugelassen, aber Zoom hat den Einlass in ${f.joinTimeoutMs / 1000} s nicht abgeschlossen. Netzwerk prüfen und erneut beitreten.`);
  ck('Q9 nennt BETRIEBSGROESSE', KT.Q9(6) === `Mehr als ${BETRIEBSGROESSE} Zoom-Quellen sind nicht gemessen. Noch einmal klicken, um die 6. Quelle trotzdem zu laden.`);
  const quelle = readFileSync(new URL('../src/main/zoom/klartext.ts', import.meta.url), 'utf8');
  ck('Quelltext-Wächter: klartext.ts schreibt die SDK-Fassung nicht als Literal', !quelle.includes('7.1.5'));
  ck('Quelltext-Wächter: B16, CT und CE schreiben „30 s“ nicht als Literal',
    !quelle.includes('nicht geantwortet (30 s)') && !quelle.includes('Beitritt in 30 s') && !quelle.includes('Einlass in 30 s'));
}

console.log('— 4b: 8.5 Wiederbeitritt (R2, R4, R5, R7) und Vorsatz 8.3');
{
  ck('R2: der Schlusspunkt des letzten Grunds fällt weg', KT.R2('Das Meeting ist voll.')
    === 'Wiederbeitritt gescheitert (Das Meeting ist voll). „Erneut beitreten“ versucht es noch einmal.');
  ck('R2: ein Grund ohne Schlusspunkt bleibt, wie er ist', KT.R2('Wiederverbinden fehlgeschlagen (Code 2)')
    === 'Wiederbeitritt gescheitert (Wiederverbinden fehlgeschlagen (Code 2)). „Erneut beitreten“ versucht es noch einmal.');
  ck('R2 mit Csonst als letztem Grund: kein „.)“', KT.R2(failText(11, 'JM Connect'))
    === 'Wiederbeitritt gescheitert (kein Medienserver gefunden (Code 11)). „Erneut beitreten“ versucht es noch einmal.');
  ck('R4 wörtlich', KT.R4('EXITED_UNEXPECTEDLY exitCode=3') === 'Die Zoom-Bridge ist abgestürzt (EXITED_UNEXPECTEDLY exitCode=3). Connect tritt neu bei.');
  ck('R5 (0, 0)', KT.R5(0, 0) === 'Wieder im Meeting. 0 Quellen neu geladen, 0 warten auf eine eindeutige Person.');
  ck('R5 (1, 1) im Singular (L3)', KT.R5(1, 1) === 'Wieder im Meeting. 1 Quelle neu geladen, 1 wartet auf eine eindeutige Person.');
  ck('R5 (2, 3)', KT.R5(2, 3) === 'Wieder im Meeting. 2 Quellen neu geladen, 3 warten auf eine eindeutige Person.');
  ck('R7 wörtlich', KT.R7 === 'Wiederbeitritt abgebrochen.');
  const C63 = 'Das Meeting gehört nicht zum Zoom-Konto dieser App. JM Connect kann nur Meetings im eigenen Zoom-Konto betreten. Bitte das Meeting im eigenen Konto anlegen.';
  ck('Vorsatz „Wiederbeitritt abgebrochen: “ + C63 als ganzer Text', failMeldung(VORSATZ.wiederbeitritt, 63, 'JM Connect').text === `Wiederbeitritt abgebrochen: ${C63}`);
  ck('Vorsatz „Wiederbeitritt abgebrochen: “ + Csonst als ganzer Text',
    failMeldung(VORSATZ.wiederbeitritt, 11, 'JM Connect').text === 'Wiederbeitritt abgebrochen: kein Medienserver gefunden (Code 11).');
}

console.log('— 4b: Einordnung 6.4 (istEndgueltig: Tabelle und L5)');
{
  // Spec 6.4 wörtlich abgeschrieben, NICHT aus ENDGUELTIGE_FAIL_CODES abgeleitet (sonst prüfte der Test sich selbst).
  const ENDGUELTIG = [4, 6, 7, 8, 9, 10, 12, 13, 14, 16, 23, 60, 61, 62, 63, 64, 82, 88, 89, 500, 501, 502, 503, 504, 505, 506];
  for (const code of ENDGUELTIG) ck(`failed ${code}: endgültig`, istEndgueltig({ art: 'failed', code }));
  ck('ENDGUELTIGE_FAIL_CODES hat genau diese 26 Codes', ENDGUELTIGE_FAIL_CODES.size === 26 && ENDGUELTIG.every((c) => ENDGUELTIGE_FAIL_CODES.has(c)));
  for (const code of [1, 2, 3, 5, 11, 15, 0xffff, 4242]) ck(`failed ${code}: vorübergehend`, !istEndgueltig({ art: 'failed', code }));
  for (const code of [6, 8, 9]) ck(`auth ${code}: vorübergehend`, !istEndgueltig({ art: 'auth', code }));
  for (const code of [1, 2, 3, 10, 12]) ck(`auth ${code}: endgültig`, istEndgueltig({ art: 'auth', code }));
  ck('ended: endgültig', istEndgueltig({ art: 'ended' }));
  for (const exitCode of [0xc0000135, 0xc0000139, 0xc000007b]) {
    ck(`exited 0x${exitCode.toString(16).toUpperCase()}: endgültig (DLL-Tod, B3–B5)`, istEndgueltig({ art: 'exited', exitCode }));
  }
  ck('exited 5 und exited ohne Rückgabewert: vorübergehend', !istEndgueltig({ art: 'exited', exitCode: 5 }) && !istEndgueltig({ art: 'exited', exitCode: null }));
  const VORUEBERGEHEND: VersuchsAusgang[] = [{ art: 'joinTimeout' }, { art: 'reconnectTimeout' }, { art: 'keineAuthAntwort' }];
  for (const a of VORUEBERGEHEND) ck(`${a.art}: vorübergehend`, !istEndgueltig(a));
  const ENDGUELTIG_SONST: VersuchsAusgang[] = [
    { art: 'init' }, { art: 'joinFehler' }, { art: 'ndi' }, { art: 'sdkFassung' }, { art: 'spawn' }, { art: 'zugang' }, { art: 'authSofort' },
  ];
  for (const a of ENDGUELTIG_SONST) ck(`${a.art}: endgültig`, istEndgueltig(a));
}

console.log('— 4b: 8.6 Fernsteuer-Hinweise (Vorsatz „Companion: “) und Logtext ohne Namen');
{
  const FT_SOLL: Array<[string, string, string]> = [
    ['F1', FT.F1, 'Companion: kein Anzeigename angegeben.'],
    ['F2', FT.F2('Anna Maria Beispiel'), 'Companion: niemand namens „Anna Maria Beispiel“ im Meeting.'],
    ['F3', FT.F3('Anna', 2), 'Companion: „Anna“ ist nicht eindeutig (2 Personen) — bitte in Connect von Hand laden.'],
    ['F4 nicht im Meeting', FT.F4('nicht im Meeting'), 'Companion: Laden nicht möglich — nicht im Meeting.'],
    ['F4 keine Erlaubnis', FT.F4('keine Aufnahme-Erlaubnis'), 'Companion: Laden nicht möglich — keine Aufnahme-Erlaubnis.'],
    ['F4 Warteraum', FT.F4('die Person ist im Warteraum'), 'Companion: Laden nicht möglich — die Person ist im Warteraum.'],
    ['F5', FT.F5('Ben'), 'Companion: keine geladene Quelle „Ben“.'],
    ['F6', FT.F6('1,5'), 'Companion: Versatz „1,5“ ungültig — erlaubt sind ganze Zahlen von 0 bis 1000.'],
    ['F7', FT.F7('zoom_xyz'), 'Companion: unbekannter Befehl „zoom_xyz“.'],
    ['F8', FT.F8(6), 'Companion: 6. Quelle geladen — mehr als 5 sind nicht gemessen.'],
  ];
  for (const [id, ist, soll] of FT_SOLL) ck(`${id} wörtlich`, ist === soll);
  ck('FT hat genau F1 bis F8', JSON.stringify(Object.keys(FT).sort()) === '["F1","F2","F3","F4","F5","F6","F7","F8"]');
  ck('F8 nennt BETRIEBSGROESSE', FT.F8(7) === `Companion: 7. Quelle geladen — mehr als ${BETRIEBSGROESSE} sind nicht gemessen.`);
  ck('fernLogText: Kennung groß, Verb in Klammern',
    fernLogText('f3', 'zoom_load') === 'Companion: F3 (zoom_load)' && fernLogText('ok', 'zoom_delay') === 'Companion: OK (zoom_delay)');
  ck('fernLogText hat keinen Namensparameter (Kennung und Verb)', fernLogText.length === 2);
}

console.log('— 4b: maskiereNamen (N4b.2, L11): ganze Wörter, längste zuerst');
{
  const P = '‹Name›';
  ck('Platzhalter „‹Name›“ (U+2039, U+203A)', maskiereNamen('Anna', ['Anna']) === P && P.charCodeAt(0) === 0x2039 && P.charCodeAt(5) === 0x203a);
  ck('„Anna, Ben“ → „‹Name›, ‹Name›“', maskiereNamen('Namensprobe: Anna, Ben', ['Anna', 'Ben']) === `Namensprobe: ${P}, ${P}`);
  ck('„Annabell“ bleibt bei Name „Anna“ (nur ganze Wörter)', maskiereNamen('Annabell kommt', ['Anna']) === 'Annabell kommt');
  ck('Ziffer direkt dahinter: „Anna2“ bleibt', maskiereNamen('Anna2', ['Anna']) === 'Anna2');
  ck('Umlaut als Wortteil: „Jörgen“ bleibt bei Name „Jörg“', maskiereNamen('Jörgen', ['Jörg']) === 'Jörgen');
  ck('„Anna Maria“ vor „Anna“ (längste zuerst)', maskiereNamen('Wiederbeitritt 7 (Anna Maria)', ['Anna', 'Anna Maria']) === `Wiederbeitritt 7 (${P})`);
  ck('Name mit „.“, „(“, „)“ wird maskiert', maskiereNamen('Abo für Dr. Ben (Gast) steht', ['Dr. Ben (Gast)']) === `Abo für ${P} steht`);
  ck('„.“ im Namen ist kein Joker: „DrX Ben“ bleibt', maskiereNamen('DrX Ben', ['Dr. Ben']) === 'DrX Ben');
  ck('mehrfach in einer Zeile', maskiereNamen('Ben geht, Ben kommt', ['Ben']) === `${P} geht, ${P} kommt`);
  ck('leere Liste → Zeile unverändert', maskiereNamen('Anna, Ben', []) === 'Anna, Ben');
  ck('Namen unter 2 Zeichen und leere Namen bleiben aus', maskiereNamen('A B Carla', ['A', '', ' ', 'Carla']) === `A B ${P}`);
  ck('NDI-Name: der Name hinter dem Gedankenstrich wird maskiert', maskiereNamen('JM Connect – Zoom Anna (2)', ['Anna']) === `JM Connect – Zoom ${P} (2)`);
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npx tsx apps/connect/test/zoom-text.test.ts
```
Erwartet (gemessen): Exitcode 1, Abbruch beim Laden mit
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\connect\src\main\zoom\fristen' imported from …\apps\connect\test\zoom-text.test.ts
```

- [ ] **Step 3: `fristen.ts` anlegen**

Neue Datei `apps/connect/src/main/zoom/fristen.ts`, vollständig:
```ts
// Feste Werte der Zoom-Anbindung (Spec 5.2, G3) an EINER Stelle. Rein (G8): kein Electron, keine node:-Module.
// kern.ts reicht alle Namen unverändert weiter; zoom.ts, index.ts, settings.ts und die Tests importieren sie darum
// weiter aus './zoom/kern'. klartext.ts leitet die Sekunden in B16, CT und CE hieraus ab (N4b.3 Nr. 8).

/** Spec 5.2. Für Tests einspeisbar (`fristen`); `abgleichMs` bleibt in den Fällen 14/14b bei 300. */
export const ZOOM_FRISTEN = {
  anmeldeMs: 30_000,
  joinTimeoutMs: 30_000,
  killTimeoutMs: 12_000,
  abgleichMs: 300,
  aboAntwortMs: 10_000,
  abbildTaktMs: 100,
  unsubscribeWarteMs: 2_000,
} as const;
export type ZoomFristen = { [K in keyof typeof ZOOM_FRISTEN]: number };

/** Wartezeit vor Wiederbeitritts-Versuch 1 bis 5 in Sekunden (Spec 6.4). Länge = WIEDERBEITRITT_VERSUCHE. */
export const WIEDERBEITRITT_PLAN_S: readonly number[] = [2, 5, 10, 20, 30];
export const BEENDEN_FRIST_MS = 15_000;
export const JWT_GUELTIG_S = 43_200;
export const AUFLOESUNG = '720p' as const;
export const HINWEISE_MAX = 5;
export const ANZEIGENAME_VORGABE = 'JM Connect';

/** Steht in shared/zoom-text.ts, damit die Karte sie ohne Main-Import nutzt (L16). */
export { BETRIEBSGROESSE } from '../../shared/zoom-text';
```

- [ ] **Step 4: `kern.ts` reicht die Konstanten weiter** (nur Zeilen 85–101)

Ersetzung 7 (`apps/connect/src/main/zoom/kern.ts`, Zeilen 85–101), Vorher:
```ts
/** Spec 5.2. Für Tests einspeisbar (`fristen`); `abgleichMs` bleibt in den Fällen 14/14b bei 300. */
export const ZOOM_FRISTEN = {
  anmeldeMs: 30_000,
  joinTimeoutMs: 30_000,
  killTimeoutMs: 12_000,
  abgleichMs: 300,
  aboAntwortMs: 10_000,
  abbildTaktMs: 100,
  unsubscribeWarteMs: 2_000,
} as const;
export type ZoomFristen = { [K in keyof typeof ZOOM_FRISTEN]: number };
export const BEENDEN_FRIST_MS = 15_000;
export const JWT_GUELTIG_S = 43_200;
export const BETRIEBSGROESSE = 5;
export const AUFLOESUNG = '720p' as const;
export const HINWEISE_MAX = 5;
export const ANZEIGENAME_VORGABE = 'JM Connect';
```
Nachher:
```ts
// Feste Werte (Spec 5.2) stehen ab 4b in fristen.ts (rein). kern.ts reicht sie unverändert weiter, damit zoom.ts,
// index.ts, settings.ts und die Tests weiter von hier importieren.
import { AUFLOESUNG, BETRIEBSGROESSE, HINWEISE_MAX, JWT_GUELTIG_S, ZOOM_FRISTEN, type ZoomFristen } from './fristen';
export {
  ANZEIGENAME_VORGABE, AUFLOESUNG, BEENDEN_FRIST_MS, BETRIEBSGROESSE, HINWEISE_MAX, JWT_GUELTIG_S, WIEDERBEITRITT_PLAN_S, ZOOM_FRISTEN,
} from './fristen';
export type { ZoomFristen } from './fristen';
```

- [ ] **Step 5: Klartexte** (`apps/connect/src/main/zoom/klartext.ts`)

Ersetzung 8 (`apps/connect/src/main/zoom/klartext.ts`, Zeilen 1–8), Vorher:
```ts
// Klartexte der Zoom-Anbindung (Spec 8.1–8.5) und ihre Zuordnung zu Codes und Ereignissen.
// Ohne Electron (G8): nur relative Importe und @jm/zoom-bridge. Die Texte stehen WÖRTLICH wie in
// der Spec; Platzhalter {…} sind Funktionsparameter. Die Fernsteuer-Hinweise F1–F8 (8.6) und die
// Wiederbeitritts-Texte R2, R4, R5, R7 kommen mit Plan 4b.
import type { AudioReason, AudioState } from '@jm/zoom-bridge/protocol';
import { authResultName, endReason, failCodeName, failReason } from '@jm/zoom-bridge/protocol';
import type { ZoomMangel } from '../../shared/types';
import { Q9_ANFANG, TEXT_A4, TEXT_A6, TEXT_S11, TEXT_S17 } from '../../shared/zoom-text';
```
Nachher:
```ts
// Klartexte der Zoom-Anbindung (Spec 8.1–8.6) und ihre Zuordnung zu Codes und Ereignissen.
// Ohne Electron (G8): nur relative Importe und @jm/zoom-bridge. Die Texte stehen WÖRTLICH wie in
// der Spec; Platzhalter {…} sind Funktionsparameter. Fassung, Fristen und Betriebsgröße kommen aus
// den Konstanten (N4b.3 Nr. 8). Logzeilen nennen nie den Namen eines Teilnehmers (N4b.2): Hinweise
// mit Namen tragen einen eigenen `logText`, Zeilen der Bridge laufen durch maskiereNamen.
import type { AudioReason, AudioState } from '@jm/zoom-bridge/protocol';
import { authResultName, endReason, failCodeName, failReason } from '@jm/zoom-bridge/protocol';
import { SDK_FASSUNG, SDK_FASSUNG_BRIDGE } from '@jm/zoom-bridge/sdk';
import type { ZoomBefehlKennung, ZoomMangel } from '../../shared/types';
import { BETRIEBSGROESSE, Q9_ANFANG, TEXT_A4, TEXT_A6, TEXT_S11, TEXT_S17 } from '../../shared/zoom-text';
import { ZOOM_FRISTEN } from './fristen';
```

Ersetzung 9 (`apps/connect/src/main/zoom/klartext.ts`, Zeile 30, S3), Vorher:
```ts
    `Dieses Zoom-SDK hat die Fassung ${gefunden}. Diese Connect-Fassung braucht genau 7.1.5.43953. Für eine andere SDK-Fassung braucht es einen neuen Connect-Release.`,
```
Nachher:
```ts
    `Dieses Zoom-SDK hat die Fassung ${gefunden}. Diese Connect-Fassung braucht genau ${SDK_FASSUNG}. Für eine andere SDK-Fassung braucht es einen neuen Connect-Release.`,
```

Ersetzung 10 (`apps/connect/src/main/zoom/klartext.ts`, Zeile 61, S15), Vorher:
```ts
  S15: 'Auf dem Proxy liegt kein passendes Zoom-SDK 7.1.5.43953. Bitte den SDK-Ordner von Hand wählen.',
```
Nachher:
```ts
  S15: `Auf dem Proxy liegt kein passendes Zoom-SDK ${SDK_FASSUNG}. Bitte den SDK-Ordner von Hand wählen.`,
```

Ersetzung 11 (`apps/connect/src/main/zoom/klartext.ts`, Zeile 80, B7), Vorher:
```ts
    `Die Zoom-Laufzeit meldet die Fassung ${x}, erwartet ist 7.1.5 (43953). Bitte den SDK-Ordner erneut wählen.`,
```
Nachher:
```ts
    `Die Zoom-Laufzeit meldet die Fassung ${x}, erwartet ist ${SDK_FASSUNG_BRIDGE}. Bitte den SDK-Ordner erneut wählen.`,
```

Ersetzung 12 (`apps/connect/src/main/zoom/klartext.ts`, Zeile 92, B16), Vorher:
```ts
  B16: 'Zoom hat auf die Anmeldung nicht geantwortet (30 s). Netzwerk prüfen und erneut versuchen.',
```
Nachher:
```ts
  B16: `Zoom hat auf die Anmeldung nicht geantwortet (${ZOOM_FRISTEN.anmeldeMs / 1000} s). Netzwerk prüfen und erneut versuchen.`,
```

Ersetzung 13 (`apps/connect/src/main/zoom/klartext.ts`, Zeilen 100–101, CT und CE), Vorher:
```ts
  CT: 'Zoom hat den Beitritt in 30 s weder bestätigt noch abgelehnt. Netzwerk prüfen und erneut versuchen.',
  CE: 'Der Host hat zugelassen, aber Zoom hat den Einlass in 30 s nicht abgeschlossen. Netzwerk prüfen und erneut beitreten.',
```
Nachher:
```ts
  // CT und CE: beide Wachhunde der Bridge laufen mit joinTimeoutMs (bridge.ts armWatchdog).
  CT: `Zoom hat den Beitritt in ${ZOOM_FRISTEN.joinTimeoutMs / 1000} s weder bestätigt noch abgelehnt. Netzwerk prüfen und erneut versuchen.`,
  CE: `Der Host hat zugelassen, aber Zoom hat den Einlass in ${ZOOM_FRISTEN.joinTimeoutMs / 1000} s nicht abgeschlossen. Netzwerk prüfen und erneut beitreten.`,
```

Ersetzung 14 (`apps/connect/src/main/zoom/klartext.ts`, Zeilen 129–133), Vorher:
```ts
  // 8.5 Abriss (R6; R2, R4, R5, R7 mit Plan 4b)
  R6: (grund: string): string => `Meeting beendet: ${grund}.`,

  // 6.1 Schritt 5: Ergebnis von „Einrichtung prüfen“
  PRUEFUNG_OK: 'Einrichtung in Ordnung: Zoom-SDK 7.1.5 (43953), Anmeldung bei Zoom erfolgreich.',
```
Nachher:
```ts
  // 8.5 Abriss und Wiederbeitritt (6.4)
  R6: (grund: string): string => `Meeting beendet: ${grund}.`,
  /** {letzter Grund} = Text der letzten Versuchsmeldung, ohne ihren Schlusspunkt (sonst „… versuchen.).“). */
  R2: (letzterGrund: string): string =>
    `Wiederbeitritt gescheitert (${letzterGrund.trim().replace(/\.+$/, '')}). „Erneut beitreten“ versucht es noch einmal.`,
  R4: (detail: string): string => `Die Zoom-Bridge ist abgestürzt (${detail}). Connect tritt neu bei.`,
  /** Singular wie L6 aus 4a (L3): „1 Quelle neu geladen“, „1 wartet auf eine eindeutige Person“. */
  R5: (k: number, d: number): string =>
    `Wieder im Meeting. ${k === 1 ? '1 Quelle' : `${k} Quellen`} neu geladen, ${d} ${d === 1 ? 'wartet' : 'warten'} auf eine eindeutige Person.`,
  R7: 'Wiederbeitritt abgebrochen.',

  // 6.1 Schritt 5: Ergebnis von „Einrichtung prüfen“
  PRUEFUNG_OK: `Einrichtung in Ordnung: Zoom-SDK ${SDK_FASSUNG_BRIDGE}, Anmeldung bei Zoom erfolgreich.`,
```

Ersetzung 15 (`apps/connect/src/main/zoom/klartext.ts`, Zeilen 245–250), Vorher:
```ts
/** Wohin ein Fehler gehört: an die Zeile/Quelle, unter „Hinweise“ oder nirgends (8.4). */
export type Einordnung = { art: 'zeile'; text: string } | { art: 'hinweis'; text: string } | { art: 'keine' };

/** `error where:'video'|'audio'` → Einordnung (8.4). `name` = Fehlername aus enrich(), `person` = Anzeigename. */
export function quellenFehler(code: string, name: string, person: string | null, dropped?: number): Einordnung {
  const wer = person ?? 'unbekannt';
```
Nachher:
```ts
/**
 * Wohin ein Fehler gehört: an die Zeile/Quelle, unter „Hinweise“ oder nirgends (8.4). Ein Hinweis trägt
 * zusätzlich `logText`: dieselbe Aussage ohne Teilnehmernamen, mit der Kennung (N4b.2, L11).
 */
export type Einordnung = { art: 'zeile'; text: string } | { art: 'hinweis'; text: string; logText: string } | { art: 'keine' };

/** Logtexte der Hinweise Q16/Q17 (Texttabelle 4b): Kennung statt Name. */
const LOG_Q16 = (kennung: string): string => `Bild: fehlerhafte Bilder von Teilnehmer ${kennung} verworfen (videoBufferMismatch).`;
const LOG_Q17 = (kennung: string): string => `Ton: ein fehlerhaftes Paket von Teilnehmer ${kennung} verworfen (audioBufferMismatch).`;

/**
 * `error where:'video'|'audio'` → Einordnung (8.4). `name` = Fehlername aus enrich(), `person` = Anzeigename
 * (nur für die Karte), `id` = Teilnehmer-Kennung aus dem Ereignis (nur für das Log).
 */
export function quellenFehler(code: string, name: string, person: string | null, dropped?: number, id?: number): Einordnung {
  const wer = person ?? 'unbekannt';
  const kennung = id === undefined ? 'unbekannt' : String(id);
```

Ersetzung 16 (`apps/connect/src/main/zoom/klartext.ts`, Zeilen 268–273), Vorher:
```ts
    case 'audioQueueOverflow':
      return { art: 'hinweis', text: KT.Q6(dropped ?? 0) };
    case 'videoBufferMismatch':
      return { art: 'hinweis', text: KT.Q16(wer) };
    case 'audioBufferMismatch':
      return { art: 'hinweis', text: KT.Q17(wer) };
```
Nachher:
```ts
    case 'audioQueueOverflow':
      return { art: 'hinweis', text: KT.Q6(dropped ?? 0), logText: KT.Q6(dropped ?? 0) };
    case 'videoBufferMismatch':
      return { art: 'hinweis', text: KT.Q16(wer), logText: LOG_Q16(kennung) };
    case 'audioBufferMismatch':
      return { art: 'hinweis', text: KT.Q17(wer), logText: LOG_Q17(kennung) };
```

Ersetzung 17 (`apps/connect/src/main/zoom/klartext.ts`, Zeilen 291–294, Ende der Datei), Vorher:
```ts
  let aus = zeile;
  for (const w of liste) aus = aus.replaceAll(w, '•••');
  return aus;
}
```
Nachher:
```ts
  let aus = zeile;
  for (const w of liste) aus = aus.replaceAll(w, '•••');
  return aus;
}

/** Platzhalter für einen Teilnehmernamen in Logzeilen (N4b.2, Texttabelle 4b). */
export const NAME_PLATZHALTER = '‹Name›';

/**
 * Teilnehmernamen in einer Logzeile durch „‹Name›“ ersetzen (N4b.2, L11). Nur ganze Wörter: davor und dahinter
 * steht kein Buchstabe und keine Ziffer (Unicode), so bleibt „Annabell“ bei „Anna“ stehen. Längste Namen zuerst
 * („Anna Maria“ vor „Anna“). Namen unter 2 Zeichen bleiben aus, sie träfen sonst einzelne Buchstaben jeder Zeile.
 * Groß- und Kleinschreibung zählt: Der Kern übergibt die Namen so, wie Zoom sie meldet.
 */
export function maskiereNamen(zeile: string, namen: readonly string[]): string {
  const liste = [...new Set(namen.map((n) => n.trim()).filter((n) => n.length >= 2))].sort((a, b) => b.length - a.length);
  if (liste.length === 0) return zeile;
  const muster = liste.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return zeile.replace(new RegExp(`(?<![\\p{L}\\p{N}])(?:${muster})(?![\\p{L}\\p{N}])`, 'gu'), NAME_PLATZHALTER);
}

/**
 * Ausgang eines Wiederbeitritts-Versuchs bzw. Auslöser in Z10 (Spec 6.4, Einordnung). Der Kern übersetzt
 * Ereignisse und Startfehler in diese Form; istEndgueltig entscheidet, ob Connect es noch einmal versucht.
 */
export type VersuchsAusgang =
  | { art: 'failed'; code: number } // status failed
  | { art: 'ended' } // status ended
  | { art: 'auth'; code: number } // auth mit Code ≠ 0 (B9–B15)
  | { art: 'authSofort' } // error where:'auth' ohne auth-Ereignis (B18)
  | { art: 'keineAuthAntwort' } // 30 s ohne auth (B16)
  | { art: 'init' } // error where:'init' (B8), L5
  | { art: 'ndi' } // ndiInitFailed (Q7)
  | { art: 'sdkFassung' } // ready.sdkVersion falsch (B7)
  | { art: 'spawn' } // Spawn-Fehler (B1, B2)
  | { art: 'zugang' } // Zugangsdaten fehlen (B17)
  | { art: 'exited'; exitCode: number | null } // error exit exited; DLL-Codes → B3–B5
  | { art: 'joinTimeout' }
  | { art: 'reconnectTimeout' }
  | { art: 'joinFehler' }; // error where:'join' mit SDK-Code (CJ), L5

/** Spec 6.4, Tabelle „Einordnung“: diese Codes von `status failed` sind endgültig. */
export const ENDGUELTIGE_FAIL_CODES: ReadonlySet<number> = new Set([
  4, 6, 7, 8, 9, 10, 12, 13, 14, 16, 23, 60, 61, 62, 63, 64, 82, 88, 89, 500, 501, 502, 503, 504, 505, 506,
]);

/** auth-Codes, die vorübergehend sind (B12: Zoom gerade nicht erreichbar). */
const AUTH_VORUEBERGEHEND: ReadonlySet<number> = new Set([6, 8, 9]);

/**
 * Spec 6.4 „Einordnung“ plus L5: endgültig heißt, Connect versucht es nicht noch einmal. Unbekannte failed-Codes
 * sind vorübergehend (die Versuche sind auf fünf begrenzt). Ein Mangel aus pruefeLaufzeit (S8, S9) ist kein
 * Ausgang: Er führt zum Zustand `einrichtung`.
 */
export function istEndgueltig(a: VersuchsAusgang): boolean {
  switch (a.art) {
    case 'failed':
      return ENDGUELTIGE_FAIL_CODES.has(a.code);
    case 'auth':
      return a.code !== 0 && !AUTH_VORUEBERGEHEND.has(a.code);
    case 'exited':
      return dllMeldung(a.exitCode) !== null;
    case 'keineAuthAntwort':
    case 'joinTimeout':
    case 'reconnectTimeout':
      return false;
    case 'ended':
    case 'authSofort':
    case 'init':
    case 'ndi':
    case 'sdkFassung':
    case 'spawn':
    case 'zugang':
    case 'joinFehler':
      return true;
  }
}

/** Fernsteuer-Hinweise (Spec 8.6) mit Vorsatz „Companion: “. Sie stehen unter „Hinweise“, nie im STATE (11.1). */
export const FT = {
  F1: 'Companion: kein Anzeigename angegeben.',
  F2: (name: string): string => `Companion: niemand namens „${name}“ im Meeting.`,
  F3: (name: string, n: number): string => `Companion: „${name}“ ist nicht eindeutig (${n} Personen) — bitte in Connect von Hand laden.`,
  F4: (grund: 'nicht im Meeting' | 'keine Aufnahme-Erlaubnis' | 'die Person ist im Warteraum'): string =>
    `Companion: Laden nicht möglich — ${grund}.`,
  F5: (name: string): string => `Companion: keine geladene Quelle „${name}“.`,
  F6: (arg: string): string => `Companion: Versatz „${arg}“ ungültig — erlaubt sind ganze Zahlen von 0 bis 1000.`,
  F7: (verb: string): string => `Companion: unbekannter Befehl „${verb}“.`,
  F8: (n: number): string => `Companion: ${n}. Quelle geladen — mehr als ${BETRIEBSGROESSE} sind nicht gemessen.`,
};

/** Logzeile zu einem zoom_*-Befehl (Texttabelle 4b): nur Kennung und Verb, nie ein Name (N4b.2, L11). */
export function fernLogText(kennung: ZoomBefehlKennung, verb: string): string {
  return `Companion: ${kennung.toUpperCase()} (${verb})`;
}
```

- [ ] **Step 6: Test laufen lassen (grün)**

```
npx tsx apps/connect/test/zoom-text.test.ts
```
Erwartet (gemessen): keine Zeile mit `FAIL`, Exitcode 0, letzte Zeile `774 ok, 0 fehlgeschlagen.` (vorher 660). Unter anderem:
```
  ok  kern.ts reicht dieselben Konstanten weiter (zoom.ts, index.ts, settings.ts und die Tests importieren von dort)
  ok  Quelltext-Wächter: klartext.ts schreibt die SDK-Fassung nicht als Literal
  ok  R5 (1, 1) im Singular (L3)
  ok  failed 63: endgültig
  ok  auth 9: vorübergehend
  ok  exited 0xC0000135: endgültig (DLL-Tod, B3–B5)
  ok  F8 wörtlich
  ok  „Anna Maria“ vor „Anna“ (längste zuerst)
  ok  KT und die Tabelle haben dieselben Schlüssel (jeder Text genau einmal wörtlich geprüft)
```

- [ ] **Step 7: Selbsttest und Typcheck**

```
npm run selftest -w @jm/connect
npm run typecheck -w @jm/connect
```
Erwartet (gemessen): Exitcode 0 für beide; `selftest` endet je Datei mit `774 ok, 0 fehlgeschlagen.`, `86 ok, 0 fehlgeschlagen.`, `90 ok, 0 fehlgeschlagen.`, `409 ok, 0 fehlgeschlagen, 0 übersprungen.`, `33 ok, 0 fehlgeschlagen.`, `79 ok, 0 fehlgeschlagen, 0 übersprungen.` und `Alle after-pack-Tests bestanden.`.

- [ ] **Step 8: Commit** (Git Bash; Commit-Text ohne Umlaute)

```
git add apps/connect/src/main/zoom/fristen.ts apps/connect/src/main/zoom/kern.ts apps/connect/src/main/zoom/klartext.ts apps/connect/test/zoom-text.test.ts
git status --short
```
Erwartet genau:
```
A  apps/connect/src/main/zoom/fristen.ts
M  apps/connect/src/main/zoom/kern.ts
M  apps/connect/src/main/zoom/klartext.ts
M  apps/connect/test/zoom-text.test.ts
```
Dann:
```
git commit -m "feat(connect): Klartexte fuer Wiederbeitritt und Fernsteuerung, Einordnung, Logtexte ohne Namen" -m "fristen.ts haelt die festen Werte aus Spec 5.2 samt WIEDERBEITRITT_PLAN_S (2, 5, 10, 20, 30 s); kern.ts reicht sie unveraendert weiter. klartext.ts: R2/R4/R5/R7, VersuchsAusgang und istEndgueltig nach Spec 6.4 (plus L5), F1-F8 mit Vorsatz Companion, fernLogText nur mit Kennung, logText fuer Q16/Q17 mit Teilnehmer-Kennung statt Name, maskiereNamen fuer Bridge-Zeilen. S3, S15, B7, B16, CT, CE und PRUEFUNG_OK leiten Fassung und Fristen aus den Konstanten ab." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Gegenprobe (Spec 12.5) — nach dem Commit, ohne neuen Commit**

Je Zeile den Vorher-Text mit dem Edit-Werkzeug ersetzen, `npx tsx apps/connect/test/zoom-text.test.ts` laufen lassen (muss rot werden, Exitcode 1), dann zurück.
1. 63 ist nicht mehr endgültig (`klartext.ts`, Liste in `ENDGUELTIGE_FAIL_CODES`): `60, 61, 62, 63, 64,` → `60, 61, 62, 64,`. Gemessen: `772 ok, 2 fehlgeschlagen.` mit `FAIL  failed 63: endgültig` und `FAIL  ENDGUELTIGE_FAIL_CODES hat genau diese 26 Codes`.
2. Ohne „längste zuerst“ (`klartext.ts`, `maskiereNamen`): `.filter((n) => n.length >= 2))].sort((a, b) => b.length - a.length);` → `.filter((n) => n.length >= 2))];`. Gemessen: `773 ok, 1 fehlgeschlagen.` mit `FAIL  „Anna Maria“ vor „Anna“ (längste zuerst)`.
3. Ohne Maskierung der Regex-Zeichen (`klartext.ts`): `` const muster = liste.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'); `` → `const muster = liste.join('|');`. Gemessen: `772 ok, 2 fehlgeschlagen.` mit `FAIL  Name mit „.“, „(“, „)“ wird maskiert` und `FAIL  „.“ im Namen ist kein Joker: „DrX Ben“ bleibt`.
4. Q16 loggt den Namen (`klartext.ts`): `logText: LOG_Q16(kennung) }` → `logText: KT.Q16(wer) }`. Gemessen: `772 ok, 2 fehlgeschlagen.` mit `FAIL  videoBufferMismatch → Hinweis Q16 (keine Zeile), Logtext mit Kennung statt Name` und `FAIL  Q16 ohne Kennung im Ereignis: …`.

Danach:
```
git status --short
```
Erwartet: keine Ausgabe.

**Abweichungen von der Gliederung:**
- Die Schlüsselprüfung von `KT` hängt nicht mehr an einer festen Zahl (bisher 73), sondern verlangt dieselben Schlüssel in `KT` und `KT_SOLL`. Nach dieser Aufgabe hat `KT` 77 Einträge. Für Aufgabe 8 heißt das: `UE_RECONNECT`/`UE_ABSTURZ` in `klartext.ts` (jetzt Zeilen 149–150) **und** die beiden `KT_SOLL`-Zeilen in `zoom-text.test.ts` (jetzt Zeilen 518–519, nicht mehr 503–504) gemeinsam entfernen; eine Zahl ist nicht nachzuziehen.
- Drei bestehende Tests der Hinweise (Q6, Q16, Q17) erwarten jetzt zusätzlich `logText`; Q16/Q17 werden mit Teilnehmer-Kennung aufgerufen. Ohne Kennung im Ereignis lautet der Logtext „… von Teilnehmer unbekannt …“.
- Zusätzlich zur Gliederung: `KT.S15` (Zeile 61, „Zoom-SDK 7.1.5.43953“) kommt ebenfalls aus `SDK_FASSUNG`; die Gliederung nennt Zeile 61 in den Dateien, aber nicht in der Liste „Aus Konstanten statt Literal“. Zwei Quelltext-Wächter belegen, dass `klartext.ts` weder „7.1.5“ noch „(30 s)“/„in 30 s“ der Texte B16, CT, CE als Literal enthält (`KT.UE_RECONNECT` darf bis Aufgabe 8 „in 30 s“ behalten, sein Wortlaut ist „Verbindung in 30 s“).
- Zusätzlicher Export `NAME_PLATZHALTER = '‹Name›'` (für den Prüfstand in Aufgabe 12).
- `istEndgueltig({ art: 'auth', code: 0 })` ist `false`: `auth 0` ist ein Erfolg und kommt als Ausgang nicht vor.
- `KT.R2` entfernt nach `trim()` alle Schlusspunkte (`/\.+$/`), nicht nur einen.
- Der Test lädt `../src/main/zoom/kern` per `await import`; das zieht Bridge, Laufzeit und sdk-laden mit (nur Importe, kein Prozessstart). Unter Linux ist das ungemessen (G10).

---

### Task 6: Connect: Soll-Liste mit Plätzen, Vorschau „(2)“, Ton aus dem Soll (`soll.ts`, `teilnehmer.ts`)

**Spec:** `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md` 4 („Normierter Name“, „Doppelname“), 6.3 (Abgleich-Tabelle, Ton-Schalter je Teilnehmer-ID), 3.2-12 (NDI-Name), Nachtrag N4b.1 („Betriebsgröße von höchstens 5“), N4b.3 Nr. 1 (Doppelname „… Anna (2)“), Nr. 2 (Ton-Schalter zeigt den Ton aus dem Soll), Nr. 3 (Grenze auch im Abgleich). Plan: L7, L22.

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\zoom-4b` (Branch `feat/zoom-stage4b`). Alle Pfade relativ dazu.

**Files:**
- Modify: `apps/connect/src/main/zoom/soll.ts` — Zeilen 49–59 (`sollAbbild`, davor neu `plane`) und 72–89 (`sollHandlungen`)
- Modify: `apps/connect/src/main/zoom/teilnehmer.ts` — Zeilen 16–19 (`ndiVorschau`), 41–56 (`baueTeilnehmer`: Kommentar, Parameter, belegte NDI-Namen), 65 (Ton-Vorwahl)
- Test: `apps/connect/test/zoom-teile.test.ts` — Ankerzeile 248

Zeilenangaben gelten für den Stand nach Aufgabe 5 (Aufgaben 4 und 5 berühren diese Dateien nicht). Maßgeblich ist der wortgleiche Vorher-Text.

**Interfaces:**
- Consumes: Aufgabe 4 — Stand `'grenze'` in `ZoomSollEintrag['stand']`.
- Produces (exakt so; Aufgaben 10, 11 und 13 bauen darauf):
  ```ts
  // apps/connect/src/main/zoom/soll.ts
  // plaetze = freie Plätze bis zur Betriebsgröße; Vorgabe Infinity; ≤ 0 heißt „kein Platz“.
  // Nur 'abonnieren' verbraucht einen Platz, 'neuLaden' nicht. Reihenfolge: Einfügereihenfolge der Soll-Liste.
  // Ein Eintrag, der abonniert würde, aber keinen Platz hat: keine Handlung, Stand 'grenze' (zählt in sollOffen).
  export function sollAbbild(soll: SollListe, lage: SollLage, plaetze?: number): ZoomSollEintrag[];
  export function sollHandlungen(soll: SollListe, lage: SollLage, plaetze?: number): SollHandlung[];

  // apps/connect/src/main/zoom/teilnehmer.ts
  /** Wie uniqueSourceName (native/video.cpp:188-201): belegt → „ (2)“, „ (3)“ …; Vergleich genau (mit Groß-/Kleinschreibung). */
  export function ndiVorschau(name: string, belegt?: ReadonlySet<string>): string;
  export function baueTeilnehmer(e: {
    liste: readonly Participant[]; quellen: ReadonlyMap<number, ZoomQuelle>; tonVorwahl: ReadonlyMap<number, boolean>;
    zeilenFehler: ReadonlyMap<number, string>; gastLabels: readonly string[];
    sollTon?: (name: string) => boolean | undefined;   // Ton des Soll-Eintrags zu diesem Namen; der Aufrufer normiert
  }): ZoomParticipant[];
  //   tonVorwahl der Zeile = e.tonVorwahl.get(id) ?? e.sollTon?.(name) ?? true
  //   ndiNameVorschau = ndiVorschau(name, Menge der ndiName aller Quellen in e.quellen)
  ```
  Beide neuen Parameter sind optional; `kern.ts` kompiliert unverändert und verhält sich wie bisher, bis Aufgabe 10 `plaetze` und Aufgabe 11 `sollTon` übergibt. Der Kern bekommt die Vorschau mit „(2)“ schon jetzt (er reicht `aktiveQuellen()` als `quellen` durch).

**Regeln für diese Aufgabe:**
- Beide Dateien bleiben rein (G8): kein `electron`, keine Zeitgeber, kein Zustand.
- Die Zählung der Plätze macht der Kern (L7: bestätigte Quellen der aktiven Generation plus offene Abos, Aufgabe 10); `soll.ts` bekommt nur die Zahl der freien Plätze.
- CRLF: Ersetzungen mit dem Edit-Werkzeug (G14). Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel, nie pushen.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`apps/connect/test/zoom-teile.test.ts`)

Ersetzung 1 (`apps/connect/test/zoom-teile.test.ts`, Zeile 248, die Ankerzeile), Vorher:
```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```
Nachher:
```ts
// ── Aufgabe 6 (4b): Plätze bis zur Betriebsgröße, Vorschau „(2)“, Ton aus dem Soll ──
console.log('— 4b: Soll-Liste mit Plätzen (L7, N4b.3 Nr. 3)');
{
  const t = (id: number, name: string, imWarteraum = false) => ({ id, name, imWarteraum });
  const eintrag = (name: string, aboId: number | null = null, ton = true) => ({ name, ton, ndiName: `JM Connect – Zoom ${name}`, aboId });
  // Drei Einträge ohne Abo, je genau ein Treffer außerhalb des Warteraums: alle drei würden abonniert.
  const drei: SollListe = new Map([['anna', eintrag('Anna')], ['ben', eintrag('Ben', null, false)], ['carla', eintrag('Carla')]]);
  const lage3: SollLage = { teilnehmer: [t(16778240, 'Anna'), t(16778241, 'Ben'), t(16778242, 'Carla')], abos: new Map() };
  ck('plaetze 2 bei drei Einträgen: zwei abonnieren, in der Reihenfolge der Soll-Liste',
    JSON.stringify(sollHandlungen(drei, lage3, 2)) === JSON.stringify([
      { art: 'abonnieren', schluessel: 'anna', id: 16778240, ton: true },
      { art: 'abonnieren', schluessel: 'ben', id: 16778241, ton: false },
    ]));
  ck('… im Abbild: Anna und Ben wartet, Carla grenze (ohne Doppelname, ohne aboId)',
    JSON.stringify(sollAbbild(drei, lage3, 2).map((e) => [e.name, e.stand, e.doppelname, e.aboId]))
      === JSON.stringify([['Anna', 'wartet', false, null], ['Ben', 'wartet', false, null], ['Carla', 'grenze', false, null]]));
  ck('plaetze 0: keine Handlung, alle drei grenze',
    sollHandlungen(drei, lage3, 0).length === 0 && sollAbbild(drei, lage3, 0).every((e) => e.stand === 'grenze'));
  ck('negative plaetze (mehr belegt als die Betriebsgröße) zählen wie 0',
    sollHandlungen(drei, lage3, -1).length === 0 && sollAbbild(drei, lage3, -1).every((e) => e.stand === 'grenze'));
  ck('ohne plaetze: alle drei abonnieren, keiner grenze (Vorgabe unbegrenzt)',
    sollHandlungen(drei, lage3).length === 3 && sollAbbild(drei, lage3).every((e) => e.stand === 'wartet'));

  // neuLaden ersetzt ein Abo, das schon einen Platz belegt: es verbraucht keinen weiteren.
  const mitVerwaist: SollListe = new Map([['anna', eintrag('Anna', 16778200)], ['ben', eintrag('Ben')]]);
  const lageV: SollLage = { teilnehmer: [t(16778250, 'Anna'), t(16778241, 'Ben')], abos: new Map([[16778200, { verwaist: true }]]) };
  ck('neuLaden verbraucht keinen Platz (plaetze 1: neuLaden Anna, abonnieren Ben)',
    JSON.stringify(sollHandlungen(mitVerwaist, lageV, 1).map((h) => h.art)) === JSON.stringify(['neuLaden', 'abonnieren']));
  ck('plaetze 0: neuLaden bleibt, Anna verwaist, Ben grenze',
    JSON.stringify(sollHandlungen(mitVerwaist, lageV, 0).map((h) => h.art)) === JSON.stringify(['neuLaden'])
      && JSON.stringify(sollAbbild(mitVerwaist, lageV, 0).map((e) => [e.name, e.stand])) === JSON.stringify([['Anna', 'verwaist'], ['Ben', 'grenze']]));

  // Wer ohnehin nicht abonniert würde, verbraucht keinen Platz und steht nie auf grenze.
  const gemischt: SollListe = new Map([['anna', eintrag('Anna')], ['ben', eintrag('Ben')], ['carla', eintrag('Carla')], ['dora', eintrag('Dora')]]);
  const lageG: SollLage = { teilnehmer: [t(16778240, 'Anna'), t(16778241, 'anna'), t(16778242, 'Ben', true), t(16778243, 'Dora')], abos: new Map() };
  ck('Doppelname, Warteraum und Abwesende verbrauchen keinen Platz (plaetze 1 → Dora)',
    JSON.stringify(sollHandlungen(gemischt, lageG, 1)) === JSON.stringify([{ art: 'abonnieren', schluessel: 'dora', id: 16778243, ton: true }]));
  ck('… und behalten ihren Stand (doppelname, wartet, wartet, wartet)',
    JSON.stringify(sollAbbild(gemischt, lageG, 1).map((e) => [e.name, e.stand])) === JSON.stringify([['Anna', 'doppelname'], ['Ben', 'wartet'], ['Carla', 'wartet'], ['Dora', 'wartet']]));
}

console.log('— 4b: NDI-Vorschau wie uniqueSourceName (L22, N4b.3 Nr. 1)');
{
  ck('frei → ohne Zusatz', ndiVorschau('Anna', new Set()) === 'JM Connect – Zoom Anna');
  ck('belegt → „ (2)“', ndiVorschau('Anna', new Set(['JM Connect – Zoom Anna'])) === 'JM Connect – Zoom Anna (2)');
  ck('mit „ (2)“ belegt → „ (3)“', ndiVorschau('Anna', new Set(['JM Connect – Zoom Anna', 'JM Connect – Zoom Anna (2)'])) === 'JM Connect – Zoom Anna (3)');
  ck('nur „ (2)“ belegt → ohne Zusatz (die Bridge prüft zuerst den Grundnamen)',
    ndiVorschau('Anna', new Set(['JM Connect – Zoom Anna (2)'])) === 'JM Connect – Zoom Anna');
  ck('Vergleich wie in der Bridge: genau, mit Groß-/Kleinschreibung', ndiVorschau('anna', new Set(['JM Connect – Zoom Anna'])) === 'JM Connect – Zoom anna');
  ck('ohne zweiten Parameter wie bisher', ndiVorschau('Anna') === 'JM Connect – Zoom Anna');
}

console.log('— 4b: baueTeilnehmer: Vorschau der zweiten Anna, Ton aus dem Soll (N4b.3 Nr. 1, 2)');
{
  const liste: Participant[] = [p(16778240, 'Anna'), p(16778241, 'Anna'), p(16778243, 'Ben'), p(16778244, 'Carla')];
  const annaGeladen = new Map([[16778240, quelle(16778240, 'JM Connect – Zoom Anna')]]);
  const zeilen = baueTeilnehmer({
    liste,
    quellen: annaGeladen,
    tonVorwahl: new Map([[16778244, true]]),
    zeilenFehler: new Map(),
    gastLabels: [],
    sollTon: (name) => (name === 'Ben' || name === 'Carla' ? false : undefined),
  });
  const z = (id: number) => zeilen.find((x) => x.id === id);
  ck('erste Anna geladen → Vorschau der zweiten endet auf „ (2)“', z(16778241)?.ndiNameVorschau === 'JM Connect – Zoom Anna (2)');
  ck('sollTon false → tonVorwahl false (Ben)', z(16778243)?.tonVorwahl === false);
  ck('ein eigener Wert in tonVorwahl gewinnt (Carla: true trotz Soll false)', z(16778244)?.tonVorwahl === true);
  ck('kein Soll-Eintrag → Vorgabe true (zweite Anna)', z(16778241)?.tonVorwahl === true);
  const mitGast = baueTeilnehmer({ liste, quellen: annaGeladen, tonVorwahl: new Map(), zeilenFehler: new Map(), gastLabels: ['JM Connect – Zoom Anna (2)'] });
  ck('Kollision prüft die Vorschau mit „ (2)“', mitGast.find((x) => x.id === 16778241)?.kollision === KT.Q10('JM Connect – Zoom Anna (2)'));
  ck('ohne sollTon wie bisher: Vorgabe true', mitGast.every((x) => x.tonVorwahl === true));
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npx tsx apps/connect/test/zoom-teile.test.ts
```
Erwartet (gemessen): Exitcode 1, letzte Zeile `101 ok, 10 fehlgeschlagen.`, darunter
```
FAIL  plaetze 2 bei drei Einträgen: zwei abonnieren, in der Reihenfolge der Soll-Liste
FAIL  … im Abbild: Anna und Ben wartet, Carla grenze (ohne Doppelname, ohne aboId)
FAIL  plaetze 0: keine Handlung, alle drei grenze
FAIL  negative plaetze (mehr belegt als die Betriebsgröße) zählen wie 0
FAIL  plaetze 0: neuLaden bleibt, Anna verwaist, Ben grenze
FAIL  belegt → „ (2)“
FAIL  mit „ (2)“ belegt → „ (3)“
FAIL  erste Anna geladen → Vorschau der zweiten endet auf „ (2)“
FAIL  sollTon false → tonVorwahl false (Ben)
FAIL  Kollision prüft die Vorschau mit „ (2)“
```
(Die übrigen neuen Fälle sind schon vorher grün: Sie halten fest, was ohne Grenze gilt und gelten bleiben muss.)

- [ ] **Step 3: Soll-Liste mit Plätzen** (`apps/connect/src/main/zoom/soll.ts`)

Ersetzung 2 (`apps/connect/src/main/zoom/soll.ts`, Zeilen 49–59), Vorher:
```ts
/**
 * Offene Soll-Einträge fürs Abbild (Spec 6.3, Spalte „Stand“): alles außer „verbunden“.
 * verwaist → 'verwaist' (mit aboId zum Entladen); kein Abo und ≥ 2 Treffer → 'doppelname';
 * sonst 'wartet'. `doppelname` = 2 oder mehr Treffer (auch bei verwaist: rot mit Q11).
 */
export function sollAbbild(soll: SollListe, lage: SollLage): ZoomSollEintrag[] {
  const aus: ZoomSollEintrag[] = [];
  for (const b of bewerte(soll, lage)) {
    if (b.abo === 'verbunden') continue;
    const doppelname = b.treffer.length >= 2;
    const stand: ZoomSollEintrag['stand'] = b.abo === 'verwaist' ? 'verwaist' : doppelname ? 'doppelname' : 'wartet';
```
Nachher:
```ts
/** Je Eintrag: Bewertung, Handlung (oder keine) und ob er an der Betriebsgröße scheitert. */
interface Planung {
  b: Bewertung;
  handlung: SollHandlung | null;
  /** Würde abonniert, aber es ist kein Platz mehr frei (L7). */
  grenze: boolean;
}

/**
 * Handlungen nach Spec 6.3: nur bei GENAU einem Treffer, der nicht im Warteraum ist. Kein Abo → abonnieren;
 * verwaistes Abo → neu laden (altes entladen, neues mit dem Ton des Soll-Eintrags). `plaetze` = freie Plätze
 * bis zur Betriebsgröße (L7, N4b.3 Nr. 3): Nur „abonnieren“ verbraucht einen Platz, „neu laden“ ersetzt ein
 * belegtes Abo. Ohne Platz keine Handlung, der Eintrag steht auf 'grenze'. Reihenfolge der Plätze: die
 * Einfügereihenfolge der Soll-Liste. Werte ≤ 0 heißen „kein Platz“.
 */
function plane(soll: SollListe, lage: SollLage, plaetze: number): Planung[] {
  let frei = plaetze;
  return bewerte(soll, lage).map((b): Planung => {
    if (b.abo === 'verbunden' || b.treffer.length !== 1 || b.treffer[0].imWarteraum) return { b, handlung: null, grenze: false };
    const id = b.treffer[0].id;
    if (b.abo === 'verwaist' && b.eintrag.aboId !== null) {
      return { b, handlung: { art: 'neuLaden', schluessel: b.schluessel, altAboId: b.eintrag.aboId, id, ton: b.eintrag.ton }, grenze: false };
    }
    if (frei <= 0) return { b, handlung: null, grenze: true };
    frei -= 1;
    return { b, handlung: { art: 'abonnieren', schluessel: b.schluessel, id, ton: b.eintrag.ton }, grenze: false };
  });
}

/**
 * Offene Soll-Einträge fürs Abbild (Spec 6.3, Spalte „Stand“): alles außer „verbunden“.
 * verwaist → 'verwaist' (mit aboId zum Entladen); würde abonniert, hat aber keinen Platz → 'grenze';
 * kein Abo und ≥ 2 Treffer → 'doppelname'; sonst 'wartet'. `doppelname` = 2 oder mehr Treffer
 * (auch bei verwaist: rot mit Q11). `plaetze` wie bei sollHandlungen; Vorgabe: unbegrenzt.
 */
export function sollAbbild(soll: SollListe, lage: SollLage, plaetze = Infinity): ZoomSollEintrag[] {
  const aus: ZoomSollEintrag[] = [];
  for (const { b, grenze } of plane(soll, lage, plaetze)) {
    if (b.abo === 'verbunden') continue;
    const doppelname = b.treffer.length >= 2;
    const stand: ZoomSollEintrag['stand'] = b.abo === 'verwaist' ? 'verwaist' : grenze ? 'grenze' : doppelname ? 'doppelname' : 'wartet';
```

Ersetzung 3 (`apps/connect/src/main/zoom/soll.ts`, Zeilen 72–89), Vorher:
```ts
/**
 * Handlungen nach Spec 6.3: nur bei GENAU einem Treffer, der nicht im Warteraum ist.
 * Kein Abo → abonnieren; verwaistes Abo → neu laden (altes entladen, neues mit dem Ton des
 * Soll-Eintrags). Doppelnamen, Warteraum und fehlende Person: nichts.
 */
export function sollHandlungen(soll: SollListe, lage: SollLage): SollHandlung[] {
  const aus: SollHandlung[] = [];
  for (const b of bewerte(soll, lage)) {
    if (b.abo === 'verbunden' || b.treffer.length !== 1 || b.treffer[0].imWarteraum) continue;
    const id = b.treffer[0].id;
    if (b.abo === 'verwaist' && b.eintrag.aboId !== null) {
      aus.push({ art: 'neuLaden', schluessel: b.schluessel, altAboId: b.eintrag.aboId, id, ton: b.eintrag.ton });
    } else {
      aus.push({ art: 'abonnieren', schluessel: b.schluessel, id, ton: b.eintrag.ton });
    }
  }
  return aus;
}
```
Nachher:
```ts
/**
 * Handlungen nach Spec 6.3 (Regeln bei plane): abonnieren bzw. neu laden, höchstens `plaetze`-mal abonnieren.
 * Doppelnamen, Warteraum, fehlende Person und Einträge ohne Platz: nichts. Vorgabe: unbegrenzt.
 */
export function sollHandlungen(soll: SollListe, lage: SollLage, plaetze = Infinity): SollHandlung[] {
  return plane(soll, lage, plaetze).flatMap((x) => (x.handlung ? [x.handlung] : []));
}
```

- [ ] **Step 4: Vorschau mit „(2)“ und Ton aus dem Soll** (`apps/connect/src/main/zoom/teilnehmer.ts`)

Ersetzung 4 (`apps/connect/src/main/zoom/teilnehmer.ts`, Zeilen 16–19), Vorher:
```ts
/** NDI-Name, den die Bridge für diese Person vergeben wird, solange noch keine Quelle läuft. */
export function ndiVorschau(name: string): string {
  return NDI_PRAEFIX + name;
}
```
Nachher:
```ts
/**
 * NDI-Name, den die Bridge für diese Person vergeben wird, solange noch keine Quelle läuft. Wie
 * uniqueSourceName (native/video.cpp:188-201): Ist der Name unter den laufenden Quellen schon belegt,
 * folgen „ (2)“, „ (3)“ … Der Vergleich ist genau wie dort, also mit Groß-/Kleinschreibung.
 */
export function ndiVorschau(name: string, belegt: ReadonlySet<string> = new Set()): string {
  const grund = NDI_PRAEFIX + name;
  let kandidat = grund;
  for (let n = 2; belegt.has(kandidat); n++) kandidat = `${grund} (${n})`;
  return kandidat;
}
```

Ersetzung 5 (`apps/connect/src/main/zoom/teilnehmer.ts`, Zeilen 41–56), Vorher:
```ts
 * solche im Warteraum. `tonVorwahl` gilt je Teilnehmer-ID (Vorgabe true). `kollision` vergleicht den
 * NDI-Namen der Zeile (Quelle, sonst Vorschau) mit den NDI-Namen der Browser-Gäste.
 */
export function baueTeilnehmer(e: {
  liste: readonly Participant[];
  quellen: ReadonlyMap<number, ZoomQuelle>;
  tonVorwahl: ReadonlyMap<number, boolean>;
  zeilenFehler: ReadonlyMap<number, string>;
  gastLabels: readonly string[];
}): ZoomParticipant[] {
  const fremde = e.liste.filter((p) => !p.self);
  const anzahl = new Map<string, number>();
  for (const p of fremde) anzahl.set(normName(p.name), (anzahl.get(normName(p.name)) ?? 0) + 1);
  const zeilen = fremde.map((p): ZoomParticipant => {
    const quelle = e.quellen.get(p.id) ?? null;
    const ndiNameVorschau = ndiVorschau(p.name);
```
Nachher:
```ts
 * solche im Warteraum. `tonVorwahl` gilt je Teilnehmer-ID; ohne eigenen Wert zeigt die Zeile den Ton
 * aus der Soll-Liste (`sollTon`, N4b.3 Nr. 2), sonst true. `ndiNameVorschau` rechnet die NDI-Namen der
 * laufenden Quellen ein („ (2)“, N4b.3 Nr. 1). `kollision` vergleicht den NDI-Namen der Zeile (Quelle,
 * sonst Vorschau) mit den NDI-Namen der Browser-Gäste.
 */
export function baueTeilnehmer(e: {
  liste: readonly Participant[];
  quellen: ReadonlyMap<number, ZoomQuelle>;
  tonVorwahl: ReadonlyMap<number, boolean>;
  zeilenFehler: ReadonlyMap<number, string>;
  gastLabels: readonly string[];
  /** Ton des Soll-Eintrags zu diesem Namen (der Aufrufer normiert); undefined = kein Soll-Eintrag. */
  sollTon?: (name: string) => boolean | undefined;
}): ZoomParticipant[] {
  const fremde = e.liste.filter((p) => !p.self);
  const anzahl = new Map<string, number>();
  for (const p of fremde) anzahl.set(normName(p.name), (anzahl.get(normName(p.name)) ?? 0) + 1);
  const belegt = new Set([...e.quellen.values()].map((q) => q.ndiName));
  const zeilen = fremde.map((p): ZoomParticipant => {
    const quelle = e.quellen.get(p.id) ?? null;
    const ndiNameVorschau = ndiVorschau(p.name, belegt);
```

Ersetzung 6 (`apps/connect/src/main/zoom/teilnehmer.ts`, Zeile 65), Vorher:
```ts
      tonVorwahl: e.tonVorwahl.get(p.id) ?? true,
```
Nachher:
```ts
      tonVorwahl: e.tonVorwahl.get(p.id) ?? e.sollTon?.(p.name) ?? true,
```

- [ ] **Step 5: Test laufen lassen (grün)**

```
npx tsx apps/connect/test/zoom-teile.test.ts
```
Erwartet (gemessen): keine Zeile mit `FAIL`, Exitcode 0, letzte Zeile `111 ok, 0 fehlgeschlagen.` (vorher 90). Unter anderem:
```
  ok  plaetze 2 bei drei Einträgen: zwei abonnieren, in der Reihenfolge der Soll-Liste
  ok  neuLaden verbraucht keinen Platz (plaetze 1: neuLaden Anna, abonnieren Ben)
  ok  mit „ (2)“ belegt → „ (3)“
  ok  erste Anna geladen → Vorschau der zweiten endet auf „ (2)“
  ok  ein eigener Wert in tonVorwahl gewinnt (Carla: true trotz Soll false)
```

- [ ] **Step 6: Selbsttest und Typcheck**

```
npm run selftest -w @jm/connect
npm run typecheck -w @jm/connect
```
Erwartet (gemessen): Exitcode 0 für beide; `selftest` endet je Datei mit `774 ok, 0 fehlgeschlagen.`, `86 ok, 0 fehlgeschlagen.`, `111 ok, 0 fehlgeschlagen.`, `409 ok, 0 fehlgeschlagen, 0 übersprungen.`, `33 ok, 0 fehlgeschlagen.`, `79 ok, 0 fehlgeschlagen, 0 übersprungen.` und `Alle after-pack-Tests bestanden.`.

- [ ] **Step 7: Commit** (Git Bash; Commit-Text ohne Umlaute)

```
git add apps/connect/src/main/zoom/soll.ts apps/connect/src/main/zoom/teilnehmer.ts apps/connect/test/zoom-teile.test.ts
git status --short
```
Erwartet genau:
```
M  apps/connect/src/main/zoom/soll.ts
M  apps/connect/src/main/zoom/teilnehmer.ts
M  apps/connect/test/zoom-teile.test.ts
```
Dann:
```
git commit -m "feat(connect): Soll-Liste kennt die Betriebsgroesse, Vorschau mit (2), Ton aus dem Soll" -m "sollAbbild und sollHandlungen nehmen die freien Plaetze bis zur Betriebsgroesse: nur abonnieren verbraucht einen Platz, neu laden nicht; ein Eintrag ohne Platz steht auf grenze. ndiVorschau rechnet wie uniqueSourceName der Bridge mit belegten Namen und haengt (2), (3) an. baueTeilnehmer zeigt ohne eigene Ton-Vorwahl den Ton aus der Soll-Liste. Beide Parameter sind optional; der Kern nutzt sie ab den Aufgaben 10 und 11." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Gegenprobe — nach dem Commit, ohne neuen Commit**

Je Zeile den Vorher-Text mit dem Edit-Werkzeug ersetzen, `npx tsx apps/connect/test/zoom-teile.test.ts` laufen lassen (muss rot werden, Exitcode 1), dann zurück.
1. `neuLaden` verbraucht einen Platz (`soll.ts`, in `plane`): die zwei Zeilen `const id = b.treffer[0].id;` und `if (b.abo === 'verwaist' && b.eintrag.aboId !== null) {` → dazwischen `if (frei <= 0) return { b, handlung: null, grenze: true };` einfügen und im `if`-Block als erste Zeile `frei -= 1;`. Gemessen: `109 ok, 2 fehlgeschlagen.` mit `FAIL  neuLaden verbraucht keinen Platz (plaetze 1: neuLaden Anna, abonnieren Ben)` und `FAIL  plaetze 0: neuLaden bleibt, Anna verwaist, Ben grenze`.
2. Vorschau ohne belegte Namen (`teilnehmer.ts`): `` for (let n = 2; belegt.has(kandidat); n++) kandidat = `${grund} (${n})`; `` → `void belegt;`. Gemessen: `107 ok, 4 fehlgeschlagen.` (`belegt → „ (2)“`, `mit „ (2)“ belegt → „ (3)“`, `erste Anna geladen → …`, `Kollision prüft die Vorschau mit „ (2)“`).
3. Soll überstimmt die eigene Ton-Vorwahl (`teilnehmer.ts`): `tonVorwahl: e.tonVorwahl.get(p.id) ?? e.sollTon?.(p.name) ?? true,` → `tonVorwahl: e.sollTon?.(p.name) ?? e.tonVorwahl.get(p.id) ?? true,`. Gemessen: `110 ok, 1 fehlgeschlagen.` mit `FAIL  ein eigener Wert in tonVorwahl gewinnt (Carla: true trotz Soll false)`.

Danach:
```
git status --short
```
Erwartet: keine Ausgabe.

**Abweichungen von der Gliederung:**
- `sollAbbild` und `sollHandlungen` teilen sich die neue private Funktion `plane` (eine Stelle für „wer bekommt einen Platz“); so können Abbild (Stand `grenze`) und Handlungen nie auseinanderlaufen.
- Negative `plaetze` zählen wie 0 (der Kern kann mit Q9/F8 über 5 geladen haben, L7).
- `ndiVorschau` vergleicht genau wie `uniqueSourceName` (mit Groß-/Kleinschreibung); ob NDI selbst Groß-/Kleinschreibung unterscheidet, bleibt ungemessen (4a-L3). Die Menge der belegten Namen enthält auch die Quelle der eigenen Zeile; das ändert nichts Sichtbares, weil die Karte die Vorschau nur ohne Quelle zeigt.
- Die Kollisionsprüfung (Q10) nutzt die Vorschau mit „(2)“ jetzt mit (zusätzlicher Testfall).

---

### Task 7: Connect: Fernsteuer-Befehle deuten (`fernsteuerung.ts`, rein)

**Spec:** `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md` 0.5 (Argumente mit einem Leerzeichen zusammengefügt), 4 („Normierter Name“, „Doppelname“), 8.6 (F1, F2, F3, F4 „die Person ist im Warteraum“, F6, F7), 11.2 (Tabelle „Befehl auf der Leitung“), G4 (Versatz 0 bis 1000 ms). Plan: L21 (Tests in `zoom-teile.test.ts`).

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\zoom-4b` (Branch `feat/zoom-stage4b`). Alle Pfade relativ dazu.

**Files:**
- Create: `apps/connect/src/main/zoom/fernsteuerung.ts`
- Test: `apps/connect/test/zoom-teile.test.ts` — Ankerzeile 322

Zeilenangaben gelten für den Stand nach Aufgabe 6. Maßgeblich ist der wortgleiche Vorher-Text.

**Interfaces:**
- Consumes:
  - Aufgabe 5: `FT` und `fernLogText(kennung: ZoomBefehlKennung, verb: string): string` aus `./klartext`.
  - Bestehend: `normName(name: string): string` aus `./teilnehmer`.
- Produces (exakt so; Aufgabe 13 baut darauf):
  ```ts
  // apps/connect/src/main/zoom/fernsteuerung.ts
  export type ZoomFernbefehl =
    | { art: 'laden'; name: string }
    | { art: 'entladen'; name: string }
    | { art: 'versatz'; ms: number }
    | { art: 'abgelehnt'; kennung: 'f1' | 'f6' | 'f7'; text: string; logText: string };
  /** verb ohne Rücksicht auf Groß-/Kleinschreibung; name = args.join(' ').trim(); ms: /^\d+$/ und ≤ 1000. */
  export function deuteZoomBefehl(verb: string, args: readonly string[]): ZoomFernbefehl;
  export type LadeZiel = { art: 'gefunden'; id: number } | { art: 'niemand' } | { art: 'mehrdeutig'; n: number } | { art: 'warteraum'; id: number };
  /** Vergleich über normName, Warteraum zählt mit (wie beim Doppelnamen); die eigene Zeile filtert der Aufrufer. */
  export function ladeZiel(name: string, teilnehmer: ReadonlyArray<{ id: number; name: string; imWarteraum: boolean }>): LadeZiel;
  ```
  Abbildung für Aufgabe 13: `abgelehnt` → Hinweis `text`, Logzeile `logText`, `befehl = { kennung, abgelehnt: true }`; `ladeZiel` `niemand` → F2, `mehrdeutig` → F3 mit `n`, `warteraum` → F4 „die Person ist im Warteraum“, `gefunden` → laden mit der Ton-Vorwahl der Zeile.

**Regeln für diese Aufgabe:**
- Rein (G8): kein `electron`, keine Zeitgeber, kein Zustand, nur relative Importe.
- Der `logText` nennt nie ein Argument (N4b.2): nur Kennung und Verb (`fernLogText`).
- Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel, nie pushen.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`apps/connect/test/zoom-teile.test.ts`)

Der Block lädt das neue Modul per `await import`, wie der Block „Aufgabe 16“ derselben Datei; der Dateikopf bleibt unverändert.

Ersetzung 1 (`apps/connect/test/zoom-teile.test.ts`, Zeile 322, die Ankerzeile), Vorher:
```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```
Nachher:
```ts
// ── Aufgabe 7 (4b): Fernsteuer-Befehle deuten, rein (Spec 11.2, 8.6, 0.5; L21) ──
{
  const { deuteZoomBefehl, ladeZiel } = await import('../src/main/zoom/fernsteuerung');
  const { FT } = await import('../src/main/zoom/klartext');
  const j = (x: unknown): string => JSON.stringify(x);

  console.log('— 4b: deuteZoomBefehl');
  ck('zoom_load [Ben] → laden „Ben“', j(deuteZoomBefehl('zoom_load', ['Ben'])) === j({ art: 'laden', name: 'Ben' }));
  ck('zoom_load [Anna, Maria] → „Anna Maria“ (Argumente mit einem Leerzeichen verbunden)',
    j(deuteZoomBefehl('zoom_load', ['Anna', 'Maria'])) === j({ art: 'laden', name: 'Anna Maria' }));
  for (const args of [[], ['  '], ['', '']]) {
    ck(`zoom_load ${j(args)} → f1 mit FT.F1`,
      j(deuteZoomBefehl('zoom_load', args)) === j({ art: 'abgelehnt', kennung: 'f1', text: FT.F1, logText: 'Companion: F1 (zoom_load)' }));
  }
  ck('zoom_unload [] → f1', j(deuteZoomBefehl('zoom_unload', [])) === j({ art: 'abgelehnt', kennung: 'f1', text: FT.F1, logText: 'Companion: F1 (zoom_unload)' }));
  ck('ZOOM_UNLOAD (Großschrift) [Ben] → entladen „Ben“', j(deuteZoomBefehl('ZOOM_UNLOAD', ['Ben'])) === j({ art: 'entladen', name: 'Ben' }));
  ck('Zoom_Load (gemischt) [Ben] → laden', j(deuteZoomBefehl('Zoom_Load', ['Ben'])) === j({ art: 'laden', name: 'Ben' }));
  ck('zoom_delay [300] → versatz 300', j(deuteZoomBefehl('zoom_delay', ['300'])) === j({ art: 'versatz', ms: 300 }));
  ck('zoom_delay [0] und [1000]: beide Grenzen gültig',
    j(deuteZoomBefehl('zoom_delay', ['0'])) === j({ art: 'versatz', ms: 0 }) && j(deuteZoomBefehl('zoom_delay', ['1000'])) === j({ art: 'versatz', ms: 1000 }));
  const F6: Array<[string[], string]> = [[['1001'], '1001'], [['1,5'], '1,5'], [['1.5'], '1.5'], [['-3'], '-3'], [[], ''], [['3', '00'], '3 00'], [['abc'], 'abc']];
  for (const [args, arg] of F6) {
    ck(`zoom_delay ${j(args)} → f6 mit „${arg}“ im Text`,
      j(deuteZoomBefehl('zoom_delay', args)) === j({ art: 'abgelehnt', kennung: 'f6', text: FT.F6(arg), logText: 'Companion: F6 (zoom_delay)' }));
  }
  ck('zoom_xyz → f7 mit dem Verb',
    j(deuteZoomBefehl('zoom_xyz', ['Anna'])) === j({ art: 'abgelehnt', kennung: 'f7', text: FT.F7('zoom_xyz'), logText: 'Companion: F7 (zoom_xyz)' }));
  ck('ZOOM_XYZ → f7, Verb klein in Text und Log',
    j(deuteZoomBefehl('ZOOM_XYZ', [])) === j({ art: 'abgelehnt', kennung: 'f7', text: FT.F7('zoom_xyz'), logText: 'Companion: F7 (zoom_xyz)' }));
  const abgelehnt = [deuteZoomBefehl('zoom_load', []), deuteZoomBefehl('zoom_delay', ['Anna', 'Maria']), deuteZoomBefehl('zoom_frieda', ['Anna', 'Maria'])];
  ck('logText nennt nie einen Namen aus den Argumenten (N4b.2)',
    abgelehnt.every((b) => b.art === 'abgelehnt' && !b.logText.includes('Anna') && !b.logText.includes('Maria')));

  console.log('— 4b: ladeZiel (Spec 11.2, normierter Name nach Spec 4)');
  const t = (id: number, name: string, imWarteraum = false) => ({ id, name, imWarteraum });
  const liste = [t(16778240, 'Anna'), t(16778241, 'Ben'), t(16778242, 'Carla', true), t(16778243, 'Dora'), t(16778244, 'dora ')];
  ck('genau eine Person → gefunden', j(ladeZiel('Ben', liste)) === j({ art: 'gefunden', id: 16778241 }));
  ck('„anna“ findet „Anna“ (normiert)', j(ladeZiel('anna', liste)) === j({ art: 'gefunden', id: 16778240 }));
  ck('Leerraum normiert: „  Anna “ findet „Anna“', j(ladeZiel('  Anna ', liste)) === j({ art: 'gefunden', id: 16778240 }));
  ck('zwei Personen (Dora, „dora “) → mehrdeutig n = 2', j(ladeZiel('Dora', liste)) === j({ art: 'mehrdeutig', n: 2 }));
  ck('genau eine Person im Warteraum → warteraum', j(ladeZiel('Carla', liste)) === j({ art: 'warteraum', id: 16778242 }));
  ck('niemand mit diesem Namen → niemand', j(ladeZiel('Frieda', liste)) === j({ art: 'niemand' }));
  ck('„Anna Maria“ trifft nicht „Anna“', j(ladeZiel('Anna Maria', liste)) === j({ art: 'niemand' }));
  ck('ein zweiter Ben im Warteraum macht „Ben“ mehrdeutig (Doppelname zählt den Warteraum mit)',
    j(ladeZiel('Ben', [...liste, t(16778245, 'BEN', true)])) === j({ art: 'mehrdeutig', n: 2 }));
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npx tsx apps/connect/test/zoom-teile.test.ts
```
Erwartet (gemessen): Exitcode 1. Die 111 bisherigen Fälle laufen durch (`  ok` je Zeile), dann bricht die Datei ab mit
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\connect\src\main\zoom\fernsteuerung' imported from …\apps\connect\test\zoom-teile.test.ts
```

- [ ] **Step 3: `fernsteuerung.ts` anlegen**

Neue Datei `apps/connect/src/main/zoom/fernsteuerung.ts`, vollständig:
```ts
// Fernsteuer-Befehle für Zoom (Spec 11.2, 8.6) als reine Funktionen. Ohne Electron (G8).
// Der Kern (steuerbefehl) ruft deuteZoomBefehl für jedes zoom_*-Verb und ladeZiel für zoom_load. Was vom
// Zustand abhängt (F4 „nicht im Meeting“/„keine Aufnahme-Erlaubnis“, F5, F8, „schon geladen“), entscheidet
// der Kern; hier steht nur, was ohne Zustand feststeht (F1, F6, F7) und wen ein Name meint (F2, F3, F4 Warteraum).
import { FT, fernLogText } from './klartext';
import { normName } from './teilnehmer';

/** Gedeuteter zoom_*-Befehl. `abgelehnt` trägt den Hinweis (mit Vorsatz „Companion: “) und die Logzeile ohne Namen. */
export type ZoomFernbefehl =
  | { art: 'laden'; name: string }
  | { art: 'entladen'; name: string }
  | { art: 'versatz'; ms: number }
  | { art: 'abgelehnt'; kennung: 'f1' | 'f6' | 'f7'; text: string; logText: string };

/**
 * `verb` ohne Rücksicht auf Groß-/Kleinschreibung (der Parser liefert es klein). Name = args.join(' ').trim():
 * Der Parser trennt an Leerraum, Connect fügt mit einem Leerzeichen zusammen (Spec 0.5, 11.2); den Rest
 * gleicht normName beim Vergleich aus. Versatz: nur Ziffern, höchstens 1000 ms (G4); sonst F6 mit dem Argument.
 */
export function deuteZoomBefehl(verb: string, args: readonly string[]): ZoomFernbefehl {
  const v = verb.toLowerCase();
  const arg = args.join(' ').trim();
  switch (v) {
    case 'zoom_load':
    case 'zoom_unload':
      if (arg === '') return { art: 'abgelehnt', kennung: 'f1', text: FT.F1, logText: fernLogText('f1', v) };
      return v === 'zoom_load' ? { art: 'laden', name: arg } : { art: 'entladen', name: arg };
    case 'zoom_delay':
      if (!/^\d+$/.test(arg) || Number(arg) > 1000) return { art: 'abgelehnt', kennung: 'f6', text: FT.F6(arg), logText: fernLogText('f6', v) };
      return { art: 'versatz', ms: Number(arg) };
    default:
      return { art: 'abgelehnt', kennung: 'f7', text: FT.F7(v), logText: fernLogText('f7', v) };
  }
}

/** Wen `zoom_load <Name>` meint. */
export type LadeZiel = { art: 'gefunden'; id: number } | { art: 'niemand' } | { art: 'mehrdeutig'; n: number } | { art: 'warteraum'; id: number };

/**
 * Vergleich über den normierten Namen (Spec 4), Teilnehmer im Warteraum zählen mit wie beim Doppelnamen:
 * keiner → niemand (F2); zwei oder mehr → mehrdeutig (F3); genau einer im Warteraum → warteraum (F4);
 * genau einer → gefunden. Die eigene Zeile der Bridge filtert der Aufrufer.
 */
export function ladeZiel(name: string, teilnehmer: ReadonlyArray<{ id: number; name: string; imWarteraum: boolean }>): LadeZiel {
  const gesucht = normName(name);
  const treffer = teilnehmer.filter((t) => normName(t.name) === gesucht);
  if (treffer.length === 0) return { art: 'niemand' };
  if (treffer.length > 1) return { art: 'mehrdeutig', n: treffer.length };
  return treffer[0].imWarteraum ? { art: 'warteraum', id: treffer[0].id } : { art: 'gefunden', id: treffer[0].id };
}
```

- [ ] **Step 4: Test laufen lassen (grün)**

```
npx tsx apps/connect/test/zoom-teile.test.ts
```
Erwartet (gemessen): keine Zeile mit `FAIL`, Exitcode 0, letzte Zeile `139 ok, 0 fehlgeschlagen.` (vorher 111). Unter anderem:
```
  ok  zoom_load [Anna, Maria] → „Anna Maria“ (Argumente mit einem Leerzeichen verbunden)
  ok  zoom_delay ["1001"] → f6 mit „1001“ im Text
  ok  ZOOM_XYZ → f7, Verb klein in Text und Log
  ok  logText nennt nie einen Namen aus den Argumenten (N4b.2)
  ok  zwei Personen (Dora, „dora “) → mehrdeutig n = 2
  ok  ein zweiter Ben im Warteraum macht „Ben“ mehrdeutig (Doppelname zählt den Warteraum mit)
```

- [ ] **Step 5: Selbsttest, Typcheck, Bau**

```
npm run selftest -w @jm/connect
npm run typecheck -w @jm/connect
npm run build -w @jm/connect
```
Erwartet (gemessen): Exitcode 0 für alle drei; `selftest` endet je Datei mit `774 ok, 0 fehlgeschlagen.`, `86 ok, 0 fehlgeschlagen.`, `139 ok, 0 fehlgeschlagen.`, `409 ok, 0 fehlgeschlagen, 0 übersprungen.`, `33 ok, 0 fehlgeschlagen.`, `79 ok, 0 fehlgeschlagen, 0 übersprungen.` und `Alle after-pack-Tests bestanden.`. Der Bau endet mit den Bündeln für `out/main`, `out/preload` und `out/renderer` (der Bau nach allen Aufgaben steht in Aufgabe 21, Step 3).

- [ ] **Step 6: Commit** (Git Bash; Commit-Text ohne Umlaute)

```
git add apps/connect/src/main/zoom/fernsteuerung.ts apps/connect/test/zoom-teile.test.ts
git status --short
```
Erwartet genau:
```
A  apps/connect/src/main/zoom/fernsteuerung.ts
M  apps/connect/test/zoom-teile.test.ts
```
Dann:
```
git commit -m "feat(connect): Fernsteuer-Befehle fuer Zoom deuten (rein)" -m "deuteZoomBefehl deutet zoom_load, zoom_unload und zoom_delay ohne Zustand: Name aus den Argumenten mit einem Leerzeichen, Versatz nur als ganze Zahl bis 1000 ms, sonst F1, F6 oder F7 mit Hinweis und einer Logzeile ohne Namen. ladeZiel findet die Person ueber den normierten Namen (gefunden, niemand, mehrdeutig, Warteraum). Der Kern nutzt beides in Aufgabe 13." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Gegenprobe — nach dem Commit, ohne neuen Commit**

Je Zeile den Vorher-Text mit dem Edit-Werkzeug ersetzen, `npx tsx apps/connect/test/zoom-teile.test.ts` laufen lassen (muss rot werden, Exitcode 1), dann zurück.
1. Keine Obergrenze beim Versatz (`fernsteuerung.ts`): `if (!/^\d+$/.test(arg) || Number(arg) > 1000) return` → `if (!/^\d+$/.test(arg)) return`. Gemessen: `138 ok, 1 fehlgeschlagen.` mit `FAIL  zoom_delay ["1001"] → f6 mit „1001“ im Text`.
2. Argumente ohne Leerzeichen verbunden (`fernsteuerung.ts`): `const arg = args.join(' ').trim();` → `const arg = args.join('').trim();`. Gemessen: `137 ok, 2 fehlgeschlagen.` mit `FAIL  zoom_load [Anna, Maria] → „Anna Maria“ …` und `FAIL  zoom_delay ["3","00"] → f6 mit „3 00“ im Text`.
3. Warteraum nicht mitgezählt (`fernsteuerung.ts`): `const treffer = teilnehmer.filter((t) => normName(t.name) === gesucht);` → `const treffer = teilnehmer.filter((t) => !t.imWarteraum && normName(t.name) === gesucht);`. Gemessen: `137 ok, 2 fehlgeschlagen.` mit `FAIL  genau eine Person im Warteraum → warteraum` und `FAIL  ein zweiter Ben im Warteraum macht „Ben“ mehrdeutig (Doppelname zählt den Warteraum mit)`.

Danach:
```
git status --short
```
Erwartet: keine Ausgabe.

**Abweichungen von der Gliederung:**
- `zoom_unload` ohne Namen lehnt ebenfalls mit F1 ab (Spec 8.6 F1 ist nicht auf `zoom_load` beschränkt).
- F6 nennt das Argument so, wie es nach `args.join(' ').trim()` aussieht (`[]` → „“, `['3','00']` → „3 00“).
- F7 nennt das Verb klein (der Parser liefert es ohnehin klein, Spec 0.5).
- `ladeZiel` zählt Teilnehmer im Warteraum für „mehrdeutig“ mit (wie `doppelname` in `baueTeilnehmer`); ein einzelner Treffer im Warteraum ergibt `warteraum` (F4), nicht `gefunden`.
- Der Test lädt die Module per `await import` innerhalb des Blocks (Muster des Blocks „Aufgabe 16“), damit der Dateikopf unverändert bleibt.

---

### Task 8: Kern: Abriss und Wiederbeitritts-Folge (6.4, Teil 1)

**Spec:** 6.4 (Auslöser, Wiederbeitritt Schritte 1–3, Einordnung), 6.5 (Meeting-Ende; während eines Versuchs nach L4, einer gemeldeten Abweichung von 6.4), 6.9, 7.1/7.2 Z10/Z11, 8.5 (R2, R4, R5), 8.7 (Dauer je Versuch), 12.2 Fälle 15, 15b, 15c, 16, 17, 18, 12.5 (Gegenproben 15, 15b, 15c, 17, 19), N4b.3 Nr. 8 („Test für abriss → im_meeting“), Review Focus 4 (Teil Wiederbeitritt). L3, L4, L5, L6. Global Constraints G3, G9, G13–G18.

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\zoom-4b`

**Files:**
- Modify: `apps/connect/src/main/zoom/kern.ts` — Kopfkommentar `:13-14`; Importe `:43-49`, `:50-65`, `:83`; `ZoomKernAbhaengigkeiten` `:144`; `StartErgebnis`/`StartAusgang` `:184-185`; `:222`; Zustand `:253-254` (`warImMeeting` entfällt, L6); `kurz()` `:333`; `abbild()` `:360`; `mangelFolgen` `:439`; `schliessen` `:742`; `stoppeBridge` `:785`; `startBewerten` `:816-832`; `starteBridge` `:838`, `:845`, `:850`, `:910`, `:925`, `:930`; `starteBeitritt` `:1035`; `imMeetingAngekommen` `:1076`; `meetingEnde` `:1088-1089`; `statusEreignis` `:1107-1121`; `fehlerEreignis` `:1148-1165`; `verlassen` `:1178-1183` (neue Folge-Funktionen dahinter); `abgleichen` `:1349-1368`
- Modify: `apps/connect/src/main/zoom/klartext.ts` — `KT.UE_RECONNECT`/`KT.UE_ABSTURZ` mit ihrem Kommentar (`:135-138`) entfernen
- Modify: `apps/connect/test/zoom-text.test.ts` — die beiden `UE_*`-Zeilen am Ende von `KT_SOLL` (nach Aufgabe 5 `:518-519`)
- Modify: `apps/connect/test/zoom-kern.test.ts` — Kopfkommentar `:3`; Import `:23`; `BaueOptionen` `:127-128`; Fabrik `:165-168`; `erzeugeZoomKern` `:246`; Fall 10b `:1210-1217`; `:1095`; die 4a-Blöcke `:1121-1153` (werden Fall 16, 18, 15c); `:1275-1284` (6.9 mit Absturz); `:1366-1385` (wird Fall 15); neuer Block über der Ankerzeile `:2208`

Zeilenangaben in den Aufgaben 8–13 gelten für HEAD `051151d614`, also vor den Aufgaben 1–7. Diese verschieben `kern.ts` und die Tests um einige Zeilen (`kern.ts` nach Aufgabe 5 ab HEAD-Zeile 102 um 5 bis 10 Zeilen früher, `zoom-kern.test.ts` ab Fall 10b um 2 Zeilen später, die Ankerzeile 2208 steht auf 2210). Maßgeblich ist immer der wortgleiche Vorher-Text; jeder kommt im Stand nach der vorigen Aufgabe genau einmal vor (bei der Montage nachgespielt).

**Interfaces:**
- Consumes:
  - Aufgabe 1: `FAKE_VERBINDUNG_ZURUECK_MS`; `FAKE_ENTZUG_MS` baut mit `privilegeRevoked` ab (nur für Schritt 1).
  - Aufgabe 4: `WIEDERBEITRITT_VERSUCHE` (`shared/zoom-text.ts`), Z7-Kartentext bei `entzogen`, Z11-Texte.
  - Aufgabe 5: `WIEDERBEITRITT_PLAN_S` (`fristen.ts`), `KT.R2/R4/R5`, `VORSATZ.wiederbeitritt`, `VersuchsAusgang`, `istEndgueltig`, `failText`.
  - Vorhanden aus 4a (Closure im Kern): `stoppeBridge()`, `scheitert(m)`, `melde`, `hinweis`, `setzeZustand`, `imMeetingAngekommen()`, `zumWarteraum`, `meetingEnde`, `mangelFolgen`, `zeitgeber(ms, fn)`, `laufNr`, `imAbbau`, `abgleichPlanen()`, `sende`.
- Produces:
  ```ts
  // ZoomKernAbhaengigkeiten
  /** Wartezeit vor Versuch 1–5 in ms (Spec 6.4, 12.2). Vorgabe WIEDERBEITRITT_PLAN_S × 1000; Länge = WIEDERBEITRITT_VERSUCHE. */
  wiederbeitrittPlanMs?: readonly number[];
  // Kern intern (Namen verbindlich für die Aufgaben 9–13):
  let folge: { versuch: number; naechsterUm: number | null; zeitgeber: ReturnType<typeof setTimeout> | null; letzte: Meldungstext | null; beginn: number } | null;
  let r5Offen: boolean;                                                // L3
  function starteWiederbeitritt(anlass: Meldungstext | null): void;   // alte Bridge stop(), Versuch 1 planen
  function planeVersuch(i: number): void;                              // versuch i, naechsterUm, Zeitgeber, Zustand abriss
  function versuchStarten(i: number): Promise<void>;                   // Startfolge + join; Zustand bleibt abriss
  function versuchErfolgreich(): void;                                 // im_meeting, r5Offen, Abgleich
  function versuchGescheitert(a: VersuchsAusgang, m: Meldungstext): void;  // einordnen: fehler, nächster Versuch oder R2
  function folgeBeenden(): void;                                       // Zeitgeber löschen, folge = null
  // kurz().versuch = zustand === 'abriss' ? (folge?.versuch ?? null) : null
  // abbild().abriss = zustand === 'abriss' ? { versuch, versuche: WIEDERBEITRITT_VERSUCHE, naechsterUm } : null
  // StartErgebnis/StartAusgang tragen bei ok:false zusätzlich `ausgang: VersuchsAusgang | null` (null bei Mangel/Abbruch)
  ```
  Testgerüst (`zoom-kern.test.ts`, `BaueOptionen`): `wiederbeitrittPlanMs?` (Vorgabe im Gerüst `[30, 30, 30, 30, 30]`) und `ereignis?: (ev, startNr) => BridgeEvent` (ändert ein Ereignis, bevor der Kern es sieht).

**Verhalten (verbindlich, aus der Spec):**
- Auslöser gelten nur für die aktive Bridge in `im_meeting` und in Z10 (`abriss` ohne Folge):
  - `status failed` mit endgültigem Code → `fehler` mit „Verbindung verloren: “ + Text aus 8.3 (wie in 4a), kein zweiter Start.
  - `status failed` sonst → Folge (Anlass = Text aus 8.3 ohne Vorsatz).
  - `error meeting reconnectTimeout` in Z10 → Folge.
  - `error exit exited` mit `0xC0000135`/`0xC0000139`/`0xC000007B` → `fehler` mit B3–B5; jeder andere Rückgabewert → Hinweis R4 und Folge.
- Folge: Schritt 1 stoppt die alte Bridge (ab dann Abbau, 6.9); der Zustand bleibt die ganze Folge über `abriss`. Versuch i wartet `plan[i-1]` ms (Abbild `naechsterUm`), startet dann eine neue Bridge (`starteBridge`, Startfolge 6.2) und sendet `join` mit den Daten im Arbeitsspeicher. Während der Startfolge ist `naechsterUm` null.
- Ausgang eines Versuchs (Z11):
  - `inMeeting` → `im_meeting`, `folge = null`, `r5Offen = true`, Abgleich wie nach jedem Beitritt (Erlaubnis zunächst `offen`).
  - `failed`, `joinTimeout`, `reconnectTimeout`, `exited`, Fehler der Startfolge → `istEndgueltig`. Endgültig: `fehler` mit „Wiederbeitritt abgebrochen: “ + Text, auch beim DLL-Tod (dann mit B3–B5; Spec 6.4 Schritt 2.4 „anderer endgültiger Fehler“). Vorübergehend: Versuchs-Bridge `stop()`, nächster Versuch; nach Versuch 5 `fehler` mit R2 aus dem Text des letzten Versuchs.
  - `ended` → Meeting-Ende 6.5 (L4, Abweichung von der Einordnung 6.4, Owner entscheidet: O4), die Folge endet.
- R5 erscheint beim ersten Abgleich mit Erlaubnis `'ja'` nach dem Erfolg: k = in diesem Abgleich abonnierte Einträge, d = offene Einträge, für die der Abgleich nichts tun konnte (L3).
- Log (8.7, Texttabelle): `[zoom] Wiederbeitritt: Versuch {i} von 5 in {s} s`, `… Versuch {i} gescheitert nach {ms} ms (endgültig|vorübergehend)`, `… Versuch {i} erfolgreich nach {ms} ms`.
- Warteraum und Mangel in einem Versuch, Abbrechen, Verlassen und Beenden während der Folge regelt Aufgabe 9.

- [ ] **Step 1: Ausgangslage — Fall 10b auf das Verhalten nach den Aufgaben 1 und 4 umschreiben**

Seit Aufgabe 1 baut die Attrappe beim Entzug ab, und seit Aufgabe 4 lautet der Z7-Text bei `entzogen` mit gemerkten Quellen anders. Aufgabe 1 (Step 13) hat Fall 10b darum nur so weit angepasst, dass er grün bleibt. Hier wird er ganz neu geschrieben: Die Quelle verschwindet mit dem Entzug, der Soll-Eintrag bleibt, und Karte und STATE sagen es (N4b.1). Nach dem Vergessen gibt es keine gemerkte Quelle mehr, und Z7 sagt wieder „Der Host hat sie entzogen.“ (Aufgabe 4, Spec 7). Der Fall ist schon vor der Umsetzung dieser Aufgabe grün; er hält das Verhalten nach den Aufgaben 1 und 4 fest.

In `apps/connect/test/zoom-kern.test.ts`:

Vorher:
```ts
  ck('Fall 10b: Anna geladen', await bis(() => p.kern.kurz().quellen === 1));
  ck('… Erlaubnis entzogen', await bis(() => p.kern.kurz().erlaubnis === 'entzogen'));
  // Ab 4b baut die Attrappe beim Entzug ab wie die Bridge (Grund privilegeRevoked,
  // Aufgabe 1). Aufgabe 8 schreibt diesen Fall neu.
  ck('… die Bridge baut die Quelle ab (privilegeRevoked)', await bis(() => p.kern.kurz().quellen === 0));
  await p.kern.entladen({ aboId: ANNA });
  await bis(() => p.kern.kurz().quellen === 0);
  const zeileZ7 = String(kartenZeile(p.kern.abbild(), Date.now()));
  ck('… nach dem Entladen Z7 mit „Der Host hat sie entzogen.“, nicht Z6', zoomZ(p.kern.kurz()) === 'Z7' && zeileZ7.includes('Der Host hat sie entzogen.'));
  await p.aufraeumen();
```

Nachher:
```ts
  ck('Fall 10b: Anna geladen', await bis(() => p.kern.kurz().quellen === 1));
  ck('… Erlaubnis entzogen, die Bridge baut die Quelle ab (N4b.1)', await bis(() => p.kern.kurz().erlaubnis === 'entzogen' && p.kern.kurz().quellen === 0));
  const a = p.kern.abbild();
  ck('… Soll-Eintrag bleibt (wartet), Z7 „Aufnahme-Erlaubnis vom Host entzogen, Quellen gestoppt. …“',
    a.soll.length === 1 && a.soll[0].name === 'Anna' && a.soll[0].stand === 'wartet' && zoomZ(a.kurz) === 'Z7'
    && String(kartenZeile(a, Date.now())).startsWith('Aufnahme-Erlaubnis vom Host entzogen, Quellen gestoppt.'));
  ck('… STATE zoom_alarm=1, zoom_sources=0, zoom_privilege=0',
    p.kern.stateKv()?.zoom_alarm === 1 && p.kern.stateKv()?.zoom_sources === 0 && p.kern.stateKv()?.zoom_privilege === 0);
  p.kern.sollVerwerfen({ name: 'Anna' });
  ck('… nach dem Vergessen keine gemerkte Quelle: Z7 „Der Host hat sie entzogen.“ ohne „Quellen gestoppt“ (zoom_alarm bleibt 1, 7.5)',
    zoomZ(p.kern.kurz()) === 'Z7' && String(kartenZeile(p.kern.abbild(), Date.now())).includes('Der Host hat sie entzogen.')
    && !String(kartenZeile(p.kern.abbild(), Date.now())).includes('Quellen gestoppt') && p.kern.stateKv()?.zoom_alarm === 1);
  await p.aufraeumen();
```

- [ ] **Step 2: Lauf (Ausgangslage grün)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: letzte Zeile `410 ok, 0 fehlgeschlagen, 0 übersprungen.`, Exit-Code 0.

- [ ] **Step 3: Testgerüst erweitern (Plan einspeisbar, Ereignis ändern)**

In `apps/connect/test/zoom-kern.test.ts`:

Vorher:
```ts
// Spec 12.2 ohne die 4b-Fälle (15, 15b, 15c, 16–18, 22, 25, Fernsteuer-Teile von 13 und 21).
```

Nachher:
```ts
// Spec 12.2; die Fernsteuer-Fälle (22, Fernsteuer-Teile von 13 und 21) kommen mit Aufgabe 13 (4b).
```

Vorher:
```ts
import { KT } from '../src/main/zoom/klartext';
```

Nachher:
```ts
import { failText, KT, VORSATZ } from '../src/main/zoom/klartext';
```

Vorher:
```ts
  /** Dienste für „Zoom-SDK laden“ (Attrappen); ohne Angabe die echten aus sdk-laden.ts gegen https://proxy.test. */
  sdkLaden?: Partial<SdkLadenDienste>;
}
```

Nachher:
```ts
  /** Dienste für „Zoom-SDK laden“ (Attrappen); ohne Angabe die echten aus sdk-laden.ts gegen https://proxy.test. */
  sdkLaden?: Partial<SdkLadenDienste>;
  /** Wartezeiten vor den Wiederbeitritts-Versuchen 1–5 in ms (Spec 12.2: einspeisbar). Vorgabe hier [30, 30, 30, 30, 30]. */
  wiederbeitrittPlanMs?: readonly number[];
  /**
   * Ändert ein Ereignis der Attrappe, bevor der Kern es sieht (nur Felder, die der Kern aus dem Ereignis liest,
   * z. B. den Code von `failed` oder das `detail` von `exited`). Die Sitzung der Bridge bleibt unberührt.
   */
  ereignis?: (ev: BridgeEvent, startNr: number) => BridgeEvent;
}
```

Vorher:
```ts
      onEvent: (ev, s) => {
        ereignisse.push({ startNr: nr, ev });
        opts.onEvent?.(ev, s);
      },
```

Nachher:
```ts
      onEvent: (roh, s) => {
        const ev = o.ereignis ? o.ereignis(roh, nr) : roh;
        ereignisse.push({ startNr: nr, ev });
        opts.onEvent?.(ev, s);
      },
```

Vorher:
```ts
    fristen: { anmeldeMs: 3000, joinTimeoutMs: 3000, killTimeoutMs: 2000, ...o.fristen },
  });
```

Nachher:
```ts
    fristen: { anmeldeMs: 3000, joinTimeoutMs: 3000, killTimeoutMs: 2000, ...o.fristen },
    wiederbeitrittPlanMs: o.wiederbeitrittPlanMs ?? [30, 30, 30, 30, 30],
  });
```

- [ ] **Step 4: Fehlschlagende Tests — die 4a-Abrissfälle werden Fall 16, 18 und 15c**

Vorher:
```ts
console.log('— Verlassen (Fall 26, Review Focus 2) und Abriss in 4a');
```

Nachher:
```ts
console.log('— Verlassen (Fall 26, Review Focus 2) und Wiederbeitritt (Fall 16, 18, 15c)');
```

Vorher:
```ts
{
  const p = baueKern({ stell: () => ({ FAKE_VERBINDUNG_WEG_MS: '300' }) });
  await insMeeting(p);
  ck('4a: Verbindung weg → fehler', await bis(() => p.kern.kurz().zustand === 'fehler'));
  ck('… „Verbindung verloren: Wiederverbinden fehlgeschlagen (Code 2).“',
    p.kern.abbild().meldung?.text === 'Verbindung verloren: Wiederverbinden fehlgeschlagen (Code 2).');
  ck('… vorher abriss, erneutMoeglich', folge(p).join(',').endsWith('abriss,fehler') && p.kern.abbild().erneutMoeglich);
  await warte(300);
  ck('… kein Wiederbeitritt in 4a (eine Bridge)', p.starts() === 1 && p.kern.kurz().zustand === 'fehler');
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_ABSTURZ_MS: '200' }) });
  await insMeeting(p);
  ck('4a: Absturz im Meeting → fehler', await bis(() => p.kern.kurz().zustand === 'fehler'));
  const absturz = p.ereignisse.find((x) => x.ev.ev === 'error' && (x.ev as { where?: string }).where === 'exit')?.ev as { detail?: string } | undefined;
  ck('… Text „Verbindung verloren: Die Zoom-Bridge ist abgestürzt (…). Details im Log.“',
    absturz !== undefined && p.kern.abbild().meldung?.text === 'Verbindung verloren: ' + KT.UE_ABSTURZ(String(absturz.detail)));
  ck('… erneutMoeglich, eine Bridge', p.kern.abbild().erneutMoeglich && p.starts() === 1);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_VERBINDUNG_HAENGT_MS: '100' }), fristen: { joinTimeoutMs: 300 } });
  await insMeeting(p);
  ck('4a: Neuverbindung hängt → fehler', await bis(() => p.kern.kurz().zustand === 'fehler'));
  const m = p.kern.abbild().meldung;
  ck('… Text Verbindung verloren + UE_RECONNECT, detail RECONNECT_TIMEOUT', m?.text === 'Verbindung verloren: ' + KT.UE_RECONNECT
    && m.detail === 'RECONNECT_TIMEOUT (reconnectTimeout)');
  await warte(400);
  ck('… das ended der stoppenden Bridge ändert nichts (kein R6, weiter fehler)',
    p.kern.kurz().zustand === 'fehler' && p.kern.abbild().meldung?.text === 'Verbindung verloren: ' + KT.UE_RECONNECT);
  await p.aufraeumen();
}
```

Nachher (die Konstanten `ANNA` usw. stehen erst ab `:1166`; hier darum die Kennung als Zahl):
```ts
{
  const p = baueKern({ stell: (n): Record<string, string> => (n === 1 ? { FAKE_VERBINDUNG_WEG_MS: '300' } : { FAKE_BEITRITT_SCHEITERT: '2' }) });
  await insMeeting(p);
  ck('Fall 16: Verbindung weg (Code 2, vorübergehend) → Z10, dann Wiederbeitritt', await bis(() => p.kern.kurz().versuch === 1, 3000)
    && p.kurze.some((k) => k.zustand === 'abriss' && k.versuch === null));
  ck('… nach fünf gescheiterten Versuchen fehler', await bis(() => p.kern.kurz().zustand === 'fehler', 10_000));
  await warte(300);
  ck('… genau fünf weitere Bridges, Versuche 1 bis 5 der Reihe nach', p.starts() === 6
    && JSON.stringify([...new Set(p.kurze.map((k) => k.versuch).filter((v) => v !== null))]) === '[1,2,3,4,5]');
  const m = p.kern.abbild().meldung;
  ck('… Meldung R2 mit dem Grund des letzten Versuchs, erneutMoeglich',
    m?.text === KT.R2(failText(2, 'JM Connect')) && m.detail?.endsWith('(2)') === true && p.kern.abbild().erneutMoeglich);
  ck('… das Log nennt die Dauer jedes Versuchs',
    p.logs.filter((z) => /^\[zoom\] Wiederbeitritt: Versuch [1-5] gescheitert nach \d+ ms \(vorübergehend\)$/.test(z)).length === 5);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: (n): Record<string, string> => (n === 1 ? { FAKE_ABSTURZ_MS: '300' } : {}) });
  await insMeeting(p);
  await p.kern.laden({ id: 16778240, ton: false, trotzBetriebsgroesse: false });
  ck('Fall 18: Absturz im Meeting → Wiederbeitritt', await bis(() => p.kern.kurz().versuch === 1, 3000));
  const absturz = p.ereignisse.find((x) => x.startNr === 1 && x.ev.ev === 'error' && (x.ev as { where?: string }).where === 'exit')?.ev as { detail?: string } | undefined;
  ck('… Hinweis R4 mit dem Detail des Absturzes', absturz !== undefined && p.kern.abbild().hinweise.includes(KT.R4(String(absturz.detail))));
  ck('… wieder im Meeting, Anna ohne Ton neu abonniert', await bis(() => p.kern.kurz().zustand === 'im_meeting', 4000)
    && (await bis(() => p.befehle(2).some((c) => c.cmd === 'videoSubscribe' && c.id === 16778240 && c.audio === false), 2000)));
  ck('… keine Meldung, zwei Bridges', p.kern.abbild().meldung === null && p.starts() === 2);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: (n): Record<string, string> => (n === 1 ? { FAKE_VERBINDUNG_HAENGT_MS: '600' } : {}), fristen: { joinTimeoutMs: 300 } });
  await insMeeting(p);
  await p.kern.laden({ id: 16778240, ton: true, trotzBetriebsgroesse: false });
  ck('Fall 15c: Anna geladen, Zoom verbindet neu (Z10)', (await bis(() => p.kern.kurz().quellen === 1))
    && (await bis(() => p.kern.kurz().zustand === 'abriss', 2000)));
  ck('… der Wachhund (reconnectTimeout) startet den Wiederbeitritt', await bis(() => p.kern.kurz().versuch === 1, 3000));
  ck('… wieder im Meeting, Anna neu abonniert', await bis(() => p.kern.kurz().zustand === 'im_meeting', 4000)
    && (await bis(() => p.befehle(2).some((c) => c.cmd === 'videoSubscribe' && c.id === 16778240), 2000)));
  ck('… das ended der stoppenden Bridge steht nur im Log', p.logs.some((z) => z.startsWith('[zoom] (Abbau) status ended')));
  ck('… kein R6, nie bereit, keine Meldung, Soll-Liste blieb und ist erfüllt', !folge(p).includes('bereit')
    && !p.logs.some((z) => z.includes('Meeting beendet')) && p.kern.abbild().meldung === null
    && (await bis(() => p.kern.kurz().quellen === 1 && p.kern.kurz().sollOffen === 0)));
  await p.aufraeumen();
}
```

- [ ] **Step 5: Fehlschlagende Tests — 6.9 mit Absturz, Fall 15 und der neue Block**

Vorher:
```ts
{
  const p = baueKern({ stell: () => ({ FAKE_ABSTURZ_MS: '400' }) });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  ck('6.9: Quelle geladen, dann stürzt die Bridge ab → fehler', (await bis(() => p.kern.kurz().quellen === 1))
    && (await bis(() => p.kern.kurz().zustand === 'fehler')));
  ck('… ohne unsubscribed verwirft der Kern nach stop() die Quellen dieser Generation (n = 0, zoom_live=0)',
    (await bis(() => p.kern.kurz().quellen === 0)) && p.kern.stateKv()?.zoom_live === 0);
  await p.aufraeumen();
}
```

Nachher:
```ts
{
  const p = baueKern({ stell: () => ({ FAKE_ABSTURZ_MS: '400' }), wiederbeitrittPlanMs: [5000, 30, 30, 30, 30] });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  ck('6.9: Quelle geladen, dann stürzt die Bridge ab → Wiederbeitritt wartet (Z11)', (await bis(() => p.kern.kurz().quellen === 1))
    && (await bis(() => p.kern.kurz().versuch === 1)));
  ck('… ohne unsubscribed verwirft der Kern nach stop() die Quellen dieser Generation (n = 0, zoom_live=0)',
    (await bis(() => p.kern.kurz().quellen === 0)) && p.kern.stateKv()?.zoom_live === 0 && p.starts() === 1);
  await p.aufraeumen();
}
```

Vorher:
```ts
console.log('— Soll-Liste nach „Erneut beitreten“ (4a-Ersatz für Fall 15), Vergessen, Lebenslauf');
{
  const p = baueKern({
    stell: (n): Record<string, string> =>
      n === 1 ? { FAKE_VERBINDUNG_WEG_MS: '800', FAKE_DOPPELNAME: '1', FAKE_TEILNEHMER: '3' } : { FAKE_DOPPELNAME: '1', FAKE_TEILNEHMER: '3' },
  });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  await p.kern.laden({ id: CARLA, ton: false, trotzBetriebsgroesse: false });
  ck('Anna und Carla geladen', await bis(() => p.kern.kurz().quellen === 2));
  ck('Verbindung weg → fehler mit „Verbindung verloren: …“', await bis(() => p.kern.kurz().zustand === 'fehler', 3000)
    && String(p.kern.abbild().meldung?.text).startsWith('Verbindung verloren: '));
  ck('… Soll-Liste bleibt (zwei offene Einträge)', await bis(() => p.kern.kurz().sollOffen === 2));
  ck('erneut() → zweiter Start, im Meeting', ok(await p.kern.erneut()) && (await bis(() => p.kern.kurz().zustand === 'im_meeting' && p.kern.kurz().erlaubnis === 'ja')));
  await warte(600);
  const subs = p.befehle(2).filter((c) => c.cmd === 'videoSubscribe');
  ck('… Abgleich abonniert nur Carla (eindeutig), mit ihrem Ton', subs.length === 1 && subs[0].id === CARLA && subs[0].audio === false);
  const s = p.kern.abbild().soll;
  ck('… Anna steht als doppelname im Abbild, sollOffen 1', s.length === 1 && s[0].name === 'Anna' && s[0].stand === 'doppelname' && s[0].doppelname && p.kern.kurz().sollOffen === 1);
  ck('… STATE zoom_alarm=1 trotz Erlaubnis', p.kern.stateKv()?.zoom_privilege === 1 && p.kern.stateKv()?.zoom_alarm === 1);
  p.kern.sollVerwerfen({ name: 'ANNA ' });
```

Nachher (Fall 15: Der erste Start kennt Anna nur einmal; beim Wiederbeitritt heißen zwei Personen Anna. „Ben“ kann es mit `FAKE_DOPPELNAME=1` nicht geben, die Attrappe benennt den zweiten Gast um):
```ts
console.log('— Wiederbeitritt mit Soll-Liste (Fall 15, R5), Vergessen, Lebenslauf');
{
  const DORA = 16778243;
  const p = baueKern({
    stell: (n): Record<string, string> =>
      n === 1 ? { FAKE_VERBINDUNG_WEG_MS: '800', FAKE_TEILNEHMER: '4' } : { FAKE_DOPPELNAME: '1', FAKE_TEILNEHMER: '4' },
  });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  await p.kern.laden({ id: CARLA, ton: false, trotzBetriebsgroesse: false });
  await p.kern.laden({ id: DORA, ton: true, trotzBetriebsgroesse: false });
  ck('Fall 15: Anna, Carla und Dora geladen', await bis(() => p.kern.kurz().quellen === 3));
  ck('… Verbindung weg → Z10, dann Z11 mit Versuch 1', await bis(() => p.kern.kurz().versuch === 1, 3000)
    && p.kurze.some((k) => k.zustand === 'abriss' && k.versuch === null));
  ck('… wieder im Meeting mit Erlaubnis', await bis(() => p.kern.kurz().zustand === 'im_meeting' && p.kern.kurz().erlaubnis === 'ja', 4000));
  ck('… genau eine zweite Bridge, nach dem Abriss nie startet/tritt_bei, nie Versuch 2', p.starts() === 2
    && folge(p).join(',') === 'startet,tritt_bei,im_meeting,abriss,im_meeting' && !p.kurze.some((k) => (k.versuch ?? 0) > 1));
  await bis(() => p.befehle(2).filter((c) => c.cmd === 'videoSubscribe').length >= 2, 2000);
  await warte(400);
  const subs = p.befehle(2).filter((c) => c.cmd === 'videoSubscribe');
  ck('… die zweite Bridge abonniert jeden eindeutigen Soll-Namen mit seinem Ton (Carla ohne, Dora mit), Anna nicht',
    subs.length === 2 && subs.some((c) => c.id === CARLA && c.audio === false) && subs.some((c) => c.id === DORA && c.audio === true));
  const s = p.kern.abbild().soll;
  ck('… Anna steht als doppelname im Abbild, sollOffen 1', s.length === 1 && s[0].name === 'Anna' && s[0].stand === 'doppelname' && s[0].doppelname && p.kern.kurz().sollOffen === 1);
  ck('… STATE zoom_alarm=1 trotz Erlaubnis', p.kern.stateKv()?.zoom_privilege === 1 && p.kern.stateKv()?.zoom_alarm === 1);
  ck('R5 nach dem ersten Abgleich: „Wieder im Meeting. 2 Quellen neu geladen, 1 wartet …“', p.kern.abbild().hinweise.includes(KT.R5(2, 1)));
  ck('… das Log nennt Plan und Dauer von Versuch 1', p.logs.some((z) => z.startsWith('[zoom] Wiederbeitritt: Versuch 1 von 5 in '))
    && p.logs.some((z) => /^\[zoom\] Wiederbeitritt: Versuch 1 erfolgreich nach \d+ ms$/.test(z)));
  p.kern.sollVerwerfen({ name: 'ANNA ' });
```

Neuer Block direkt über der Ankerzeile:

Vorher:
```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

Nachher:
```ts
// ── Aufgabe 8 (4b): Abriss und Wiederbeitritts-Folge (6.4) ───────────────────
console.log('— Wiederbeitritt: Erlaubnis bleibt aus (15b), endgültiger Code (17), Einordnung in Z10, Zoom verbindet selbst');
{
  const p = baueKern({ stell: (n): Record<string, string> => (n === 1 ? { FAKE_VERBINDUNG_WEG_MS: '600' } : { FAKE_PRIVILEGE: 'offen' }) });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  await bis(() => p.kern.kurz().quellen === 1);
  ck('Fall 15b: nach dem Wiederbeitritt im Meeting', await bis(() => p.starts() === 2 && p.kern.kurz().zustand === 'im_meeting', 4000));
  await warte(500);
  ck('… ohne Erlaubnis: Z6, sollOffen 1, zoom_alarm=1', zoomZ(p.kern.kurz()) === 'Z6' && p.kern.kurz().sollOffen === 1 && p.kern.stateKv()?.zoom_alarm === 1);
  ck('… kein Abo, kein R5', !cmds(p, 2).includes('videoSubscribe') && !p.kern.abbild().hinweise.some((h) => h.startsWith('Wieder im Meeting.')));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: (n): Record<string, string> => (n === 1 ? { FAKE_VERBINDUNG_WEG_MS: '300' } : { FAKE_BEITRITT_SCHEITERT: '63' }) });
  await insMeeting(p);
  ck('Fall 17: endgültiger Code im Versuch → fehler', await bis(() => p.kern.kurz().zustand === 'fehler', 4000));
  await warte(300);
  const m = p.kern.abbild().meldung;
  ck('… die Folge endet nach Versuch 1 (zwei Bridges)', p.starts() === 2);
  ck('… „Wiederbeitritt abgebrochen: “ + C63, detail mit dem Code', m?.text === VORSATZ.wiederbeitritt + failText(63, 'JM Connect') && m.detail?.endsWith('(63)') === true);
  ck('… erneutMoeglich, Log „endgültig“', p.kern.abbild().erneutMoeglich
    && p.logs.some((z) => /^\[zoom\] Wiederbeitritt: Versuch 1 gescheitert nach \d+ ms \(endgültig\)$/.test(z)));
  await p.aufraeumen();
}
{
  const p = baueKern({
    stell: () => ({ FAKE_VERBINDUNG_WEG_MS: '300' }),
    // Die Attrappe meldet bei WEG immer Code 2; hier soll der Kern einen endgültigen Code sehen.
    ereignis: (ev) => (ev.ev === 'status' && (ev as { status?: string }).status === 'failed' ? ({ ...ev, code: 63 } as unknown as BridgeEvent) : ev),
  });
  await insMeeting(p);
  ck('failed mit endgültigem Code in Z10 → fehler', await bis(() => p.kern.kurz().zustand === 'fehler', 3000));
  await warte(300);
  ck('… „Verbindung verloren: “ + C63, kein Versuch, eine Bridge', p.kern.abbild().meldung?.text === VORSATZ.verbindung + failText(63, 'JM Connect')
    && p.starts() === 1 && p.kurze.some((k) => k.zustand === 'abriss' && k.versuch === null) && !p.kurze.some((k) => k.versuch !== null));
  await p.aufraeumen();
}
{
  const p = baueKern({
    stell: () => ({ FAKE_ABSTURZ_MS: '300' }),
    // Plattformunabhängig: Linux kürzt Rückgabewerte auf 8 Bit (Fall 6); der Kern sieht hier den Windows-Wert 0xC0000135.
    ereignis: (ev) => (ev.ev === 'error' && (ev as { where?: string }).where === 'exit'
      ? ({ ...ev, detail: 'Kindprozess unerwartet beendet, exitCode=3221225781' } as unknown as BridgeEvent) : ev),
  });
  await insMeeting(p);
  ck('exited mit 0xC0000135 im Meeting → fehler B3', await bis(() => p.kern.kurz().zustand === 'fehler', 3000) && p.kern.abbild().meldung?.text === KT.B3);
  await warte(300);
  ck('… kein Versuch, kein R4, eine Bridge', p.starts() === 1 && !p.kurze.some((k) => k.versuch !== null) && p.kern.abbild().hinweise.length === 0);
  await p.aufraeumen();
}
{
  const p = baueKern({
    stell: (n): Record<string, string> => (n === 1 ? { FAKE_VERBINDUNG_WEG_MS: '300' } : { FAKE_SOFORT_ENDE: '1' }),
    // Die Versuchs-Bridge stirbt beim Start; der Kern sieht den Windows-Wert 0xC0000135 (plattformunabhängig wie oben).
    ereignis: (ev, n) => (n === 2 && ev.ev === 'error' && (ev as { where?: string }).where === 'exit'
      ? ({ ...ev, detail: 'Kindprozess unerwartet beendet, exitCode=3221225781' } as unknown as BridgeEvent) : ev),
  });
  await insMeeting(p);
  ck('DLL-Tod in einem Versuch → fehler „Wiederbeitritt abgebrochen: “ + B3 (6.4 Schritt 2.4)',
    await bis(() => p.kern.kurz().zustand === 'fehler', 4000) && p.kern.abbild().meldung?.text === VORSATZ.wiederbeitritt + KT.B3);
  await warte(300);
  ck('… die Folge endet nach Versuch 1 (zwei Bridges), Log „endgültig“, erneutMoeglich', p.starts() === 2 && p.kern.abbild().erneutMoeglich
    && p.logs.some((z) => /^\[zoom\] Wiederbeitritt: Versuch 1 gescheitert nach \d+ ms \(endgültig\)$/.test(z)));
  await p.aufraeumen();
}
{
  const p = baueKern({
    stell: (n): Record<string, string> => (n === 1 ? { FAKE_VERBINDUNG_WEG_MS: '600' } : {}),
    // L4: Statt des inMeeting der Versuchs-Bridge sieht der Kern ein ended (der Host beendet das Meeting während des Versuchs).
    ereignis: (ev, n) => (n === 2 && ev.ev === 'status' && (ev as { status?: string }).status === 'inMeeting'
      ? ({ ...ev, status: 'ended', code: 0 } as unknown as BridgeEvent) : ev),
  });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  ck('L4: ended während eines Versuchs → Meeting-Ende (bereit, warnung „Meeting beendet: …“)', (await bis(() => p.kern.kurz().versuch === 1, 3000))
    && (await bis(() => p.kern.kurz().zustand === 'bereit', 4000)) && p.kern.abbild().meldung?.art === 'warnung'
    && String(p.kern.abbild().meldung?.text).startsWith('Meeting beendet: '));
  await warte(300);
  ck('… Soll-Liste leer, erneutMoeglich, kein weiterer Versuch (zwei Bridges)', p.kern.abbild().soll.length === 0 && p.kern.abbild().erneutMoeglich
    && p.starts() === 2 && !p.kurze.some((k) => (k.versuch ?? 0) > 1));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_VERBINDUNG_HAENGT_MS: '600', FAKE_VERBINDUNG_ZURUECK_MS: '300' }), fristen: { joinTimeoutMs: 5000 } });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  await bis(() => p.kern.kurz().quellen === 1);
  ck('abriss → im_meeting: Zoom verbindet neu (Z10, zoom_alarm 1)', await bis(() => p.kern.kurz().zustand === 'abriss', 2000)
    && zoomZ(p.kern.kurz()) === 'Z10' && p.kern.stateKv()?.zoom_alarm === 1);
  ck('… Zoom kommt selbst zurück → im_meeting, zoom_alarm 0', await bis(() => p.kern.kurz().zustand === 'im_meeting', 2000)
    && p.kern.stateKv()?.zoom_alarm === 0);
  await warte(500);
  ck('… eine Bridge, kein neues videoSubscribe, Quelle und Soll unverändert', p.starts() === 1
    && cmds(p, 1).filter((c) => c === 'videoSubscribe').length === 1 && p.kern.kurz().quellen === 1 && p.kern.kurz().sollOffen === 0);
  await p.aufraeumen();
}

console.log('— Wiederbeitritt: Abbild in Z11, Vergessen in der Wartezeit (Review Focus 4)');
{
  const p = baueKern({
    // Die zweite Bridge (envprobe) meldet nie ready: Versuch 1 läuft, bis aufgeräumt wird.
    stell: (n): Record<string, string> => (n === 1 ? { FAKE_VERBINDUNG_WEG_MS: '300' } : { FAKE_SCRIPT: 'envprobe' }),
    wiederbeitrittPlanMs: [600, 30, 30, 30, 30],
  });
  await insMeeting(p);
  ck('Abbild in Z11: Versuch 1 wartet', await bis(() => p.kern.kurz().versuch === 1, 3000));
  const a = p.kern.abbild();
  const jetzt = Date.now();
  ck('… abriss { versuch: 1, versuche: 5, naechsterUm in den nächsten 600 ms }, Countdown in der Karte',
    a.abriss?.versuch === 1 && a.abriss.versuche === 5 && a.abriss.naechsterUm !== null && a.abriss.naechsterUm > jetzt
    && a.abriss.naechsterUm <= jetzt + 600 && zoomZ(a.kurz) === 'Z11' && String(kartenZeile(a, jetzt)).includes('Wiederbeitritt 1 von 5 in '));
  ck('… STATE abriss, alarm 1', p.kern.stateKv()?.zoom_status === 'abriss' && p.kern.stateKv()?.zoom_alarm === 1);
  ck('… während des Versuchs naechsterUm null, Karte „läuft …“', await bis(() => p.starts() === 2 && p.kern.abbild().abriss?.naechsterUm === null, 3000)
    && p.kern.kurz().versuch === 1 && String(kartenZeile(p.kern.abbild(), Date.now())).endsWith('Wiederbeitritt 1 von 5 läuft …'));
  await p.aufraeumen();
}
{
  const p = baueKern({
    stell: (n): Record<string, string> => (n === 1 ? { FAKE_VERBINDUNG_WEG_MS: '600', FAKE_TEILNEHMER: '3' } : { FAKE_TEILNEHMER: '3' }),
    wiederbeitrittPlanMs: [800, 30, 30, 30, 30],
  });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  await p.kern.laden({ id: BEN, ton: true, trotzBetriebsgroesse: false });
  await p.kern.laden({ id: CARLA, ton: true, trotzBetriebsgroesse: false });
  await bis(() => p.kern.kurz().quellen === 3);
  ck('Review Focus 4 (Wiederbeitritt): Z11 wartet', await bis(() => p.kern.kurz().versuch === 1, 3000));
  p.kern.sollVerwerfen({ name: 'Ben' });
  ck('… Ben vergessen, Carla entladen in der Wartezeit', ok(await p.kern.entladen({ aboId: CARLA }))
    && p.kern.abbild().soll.map((s) => s.name).join(',') === 'Anna');
  ck('… nach dem Erfolg kommt nur Anna zurück', await bis(() => p.kern.kurz().zustand === 'im_meeting', 4000)
    && (await bis(() => p.befehle(2).some((c) => c.cmd === 'videoSubscribe'), 2000)) && (await warte(500), true)
    && p.befehle(2).filter((c) => c.cmd === 'videoSubscribe').map((c) => c.id).join(',') === String(ANNA));
  ck('… R5 „1 Quelle neu geladen, 0 warten …“', p.kern.abbild().hinweise.includes(KT.R5(1, 0)));
  await p.aufraeumen();
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

- [ ] **Step 6: Fehlschlagender Test — `KT.UE_*` aus `zoom-text.test.ts`**

In `apps/connect/test/zoom-text.test.ts` (Stand nach Aufgabe 5):

Vorher (die beiden letzten Einträge von `KT_SOLL` und das Ende der Tabelle):
```ts
    ['UE_RECONNECT', KT.UE_RECONNECT, 'Zoom hat die Verbindung in 30 s nicht wiederhergestellt.'],
    ['UE_ABSTURZ', KT.UE_ABSTURZ('exitCode=3'), 'Die Zoom-Bridge ist abgestürzt (exitCode=3). Details im Log.'],
  ];
```

Nachher:
```ts
  ];
```
Eine Zahl muss nicht mitgezogen werden: Seit Aufgabe 5 vergleicht die Prüfung „KT und die Tabelle haben dieselben Schlüssel (jeder Text genau einmal wörtlich geprüft)“ die Schlüsselmengen von `KT` und `KT_SOLL`. Sie wird rot, bis Step 8 die beiden Texte aus `KT` entfernt.

- [ ] **Step 7: Tests laufen lassen (rot)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: `405 ok, 37 fehlgeschlagen, 0 übersprungen.`, Exit-Code 1. Die erste `FAIL`-Zeile:
```
FAIL  Fall 16: Verbindung weg (Code 2, vorübergehend) → Z10, dann Wiederbeitritt
```
Schon grün sind (4a-Verhalten, jetzt festgehalten): „failed mit endgültigem Code in Z10 → fehler“, „exited mit 0xC0000135 im Meeting → fehler B3“, „abriss → im_meeting: Zoom verbindet neu“. Rot sind unter anderem die beiden neuen Fälle „DLL-Tod in einem Versuch …“ und „L4: ended während eines Versuchs …“ (je zwei Prüfungen).

```
npx tsx apps/connect/test/zoom-text.test.ts
```
Erwartet: `771 ok, 1 fehlgeschlagen.` mit `FAIL  KT und die Tabelle haben dieselben Schlüssel (jeder Text genau einmal wörtlich geprüft)` (in `KT` stehen `UE_RECONNECT` und `UE_ABSTURZ` noch).

- [ ] **Step 8: `klartext.ts` — die 4a-Übergangstexte entfernen**

In `apps/connect/src/main/zoom/klartext.ts`:

Vorher:
```ts

  // Nur 4a, in 4b durch den Wiederbeitritt ersetzt: Abriss ohne Wiederbeitritt führt sofort zu
  // `fehler` (Plan-Kopf „Nicht in 4a“). Vorsatz davor ist VORSATZ.verbindung.
  UE_RECONNECT: 'Zoom hat die Verbindung in 30 s nicht wiederhergestellt.',
  UE_ABSTURZ: (detail: string): string => `Die Zoom-Bridge ist abgestürzt (${detail}). Details im Log.`,
};
```

Nachher:
```ts
};
```

- [ ] **Step 9: `kern.ts` — Kopf, Importe, Abhängigkeit, Typen**

In `apps/connect/src/main/zoom/kern.ts`:

Vorher:
```ts
// 4a (Spec 18): KEIN automatischer Wiederbeitritt. Jeder Auslöser aus 6.4, der einen
// Wiederbeitritt starten würde, führt sofort zu `fehler` mit „Erneut beitreten“.
```

Nachher:
```ts
// WIEDERBEITRITT (Spec 6.4): Ein vorübergehender Abriss im Meeting startet bis zu fünf Versuche nach
// WIEDERBEITRITT_PLAN_S, jeder mit einer neuen Bridge; der Zustand bleibt die ganze Folge über `abriss`.
```

Vorher:
```ts
  TEXT_ZUGANG_NUR_SITZUNG_ENTFERNT,
  type ZoomStateKv,
} from '../../shared/zoom-text';
```

Nachher:
```ts
  TEXT_ZUGANG_NUR_SITZUNG_ENTFERNT,
  WIEDERBEITRITT_VERSUCHE,
  type ZoomStateKv,
} from '../../shared/zoom-text';
```

Vorher:
```ts
  failMeldung,
  fehlerDetail,
  mangelText,
```

Nachher:
```ts
  failMeldung,
  failText,
  fehlerDetail,
  istEndgueltig,
  mangelText,
```

Vorher:
```ts
  type Meldungstext,
} from './klartext';
```

Nachher:
```ts
  type Meldungstext,
  type VersuchsAusgang,
} from './klartext';
```

Vorher:
```ts
import { baueTeilnehmer, istVerwaist, ndiVorschau, normName, zaehleQuellen } from './teilnehmer';
```

Nachher (eigene Zeile, weil Aufgabe 5 `WIEDERBEITRITT_PLAN_S` in `kern.ts` nur weiterreicht und nicht lokal importiert):
```ts
import { baueTeilnehmer, istVerwaist, ndiVorschau, normName, zaehleQuellen } from './teilnehmer';
import { WIEDERBEITRITT_PLAN_S } from './fristen';
```

Vorher:
```ts
  fristen?: Partial<ZoomFristen>;
}
```

Nachher:
```ts
  fristen?: Partial<ZoomFristen>;
  /** Wartezeit vor Versuch 1–5 in ms (Spec 6.4, 12.2). Vorgabe WIEDERBEITRITT_PLAN_S × 1000; Länge = WIEDERBEITRITT_VERSUCHE. */
  wiederbeitrittPlanMs?: readonly number[];
}
```

Vorher:
```ts
type StartErgebnis = { ok: true; bridge: BridgeArt; gen: number } | { ok: false; meldung: Meldungstext; mangel: ZoomMangel | null };
type StartAusgang = { ok: true } | { ok: false; meldung: Meldungstext };
```

Nachher:
```ts
/** `ausgang` ordnet einen Fehler der Startfolge für den Wiederbeitritt ein (6.4); null bei Mangel oder Abbruch. */
type StartErgebnis =
  | { ok: true; bridge: BridgeArt; gen: number }
  | { ok: false; meldung: Meldungstext; mangel: ZoomMangel | null; ausgang: VersuchsAusgang | null };
type StartAusgang = { ok: true } | { ok: false; meldung: Meldungstext; ausgang: VersuchsAusgang | null };
```

Vorher:
```ts
  const env = d.env ?? process.env;

```

Nachher:
```ts
  const env = d.env ?? process.env;
  const plan: readonly number[] = d.wiederbeitrittPlanMs ?? WIEDERBEITRITT_PLAN_S.map((s) => s * 1000);

```

- [ ] **Step 10: `kern.ts` — Zustand der Folge, Kurzform, Abbild, `warImMeeting` entfällt (L6)**

Vorher:
```ts
  /** Merker „war im Meeting“ (Ergänzung 0.10); 4b entscheidet daran über den Wiederbeitritt. */
  let warImMeeting = false;
```

Nachher:
```ts
  /**
   * Wiederbeitritts-Folge (6.4), nur in `abriss`: gesetzt heißt Z11. `naechsterUm` nur in der Wartezeit vor einem
   * Versuch, `letzte` = Meldung des letzten gescheiterten Versuchs (R2), `beginn` = Start des laufenden Versuchs.
   * Den früheren Merker „war im Meeting“ (Ergänzung 0.10) tragen die Zustände: Auslöser gelten nur in im_meeting/abriss (L6).
   */
  let folge: { versuch: number; naechsterUm: number | null; zeitgeber: ReturnType<typeof setTimeout> | null; letzte: Meldungstext | null; beginn: number } | null = null;
  /** R5 steht aus: gesetzt beim Erfolg eines Versuchs, verbraucht vom ersten Abgleich mit Erlaubnis 'ja' (L3). */
  let r5Offen = false;
```

Vorher:
```ts
      versuch: null,
```

Nachher:
```ts
      versuch: zustand === 'abriss' ? (folge?.versuch ?? null) : null,
```

Vorher:
```ts
      abriss: zustand === 'abriss' ? { versuch: null, versuche: 5, naechsterUm: null } : null,
```

Nachher:
```ts
      abriss: zustand === 'abriss' ? { versuch: folge?.versuch ?? null, versuche: WIEDERBEITRITT_VERSUCHE, naechsterUm: folge?.naechsterUm ?? null } : null,
```

Vorher (`mangelFolgen`):
```ts
    kenncode = null;
    warImMeeting = false;
  }

  function einrichtungSperre(): ZoomErgebnis {
```

Nachher:
```ts
    kenncode = null;
  }

  function einrichtungSperre(): ZoomErgebnis {
```

Vorher (`schliessen`):
```ts
    kenncode = null;
    warImMeeting = false;
    setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
  }

  /** Spec 6.8 „Meldung quittieren“: in jedem Zustand außer Z13. */
```

Nachher:
```ts
    kenncode = null;
    setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
  }

  /** Spec 6.8 „Meldung quittieren“: in jedem Zustand außer Z13. */
```

Vorher (`starteBeitritt`; ein neuer Beitritt verwirft ein offenes R5):
```ts
    meldung = null;
    warImMeeting = false;
    d.log(`[zoom] Beitritt gestartet (Anzeigename „${name}“)`);
```

Nachher:
```ts
    meldung = null;
    r5Offen = false;
    d.log(`[zoom] Beitritt gestartet (Anzeigename „${name}“)`);
```

Vorher (`imMeetingAngekommen`):
```ts
    erlaubnis = 'offen';
    warImMeeting = true;
    setzeZustand('im_meeting');
```

Nachher:
```ts
    erlaubnis = 'offen';
    setzeZustand('im_meeting');
```

- [ ] **Step 11: `kern.ts` — Startfolge liefert den Ausgang für die Einordnung**

Vorher:
```ts
    if (startBeob !== null && startBeob.gen === gen) startBeob.ende({ ok: false, meldung: ABGEBROCHEN });
```

Nachher:
```ts
    if (startBeob !== null && startBeob.gen === gen) startBeob.ende({ ok: false, meldung: ABGEBROCHEN, ausgang: null });
```

Vorher:
```ts
      if (v !== SDK_FASSUNG_BRIDGE) beob.ende({ ok: false, meldung: { text: KT.B7(v), detail: null } });
      return;
    }
    if (ev.ev === 'auth') {
      const code = (ev as { code: number }).code;
      beob.ende(code === 0 ? { ok: true } : { ok: false, meldung: authMeldung(code) });
      return;
    }
    if (ev.ev !== 'error') return;
    const e = ev as unknown as FehlerEreignis;
    const name = e.name ?? String(e.code);
    if (e.where === 'ndi') beob.ende({ ok: false, meldung: { text: KT.Q7, detail: fehlerDetail(e) } });
    else if (e.where === 'auth') beob.ende({ ok: false, meldung: { text: KT.B18(name), detail: fehlerDetail(e) } });
    else if (e.where === 'init') beob.ende({ ok: false, meldung: { text: e.code === 14 ? KT.B8_14 : KT.B8(name), detail: fehlerDetail(e) } });
    else if (e.where === 'exit') {
      beob.ende({ ok: false, meldung: dllMeldung(exitCodeAus(e.detail)) ?? { text: KT.B6(e.detail ?? fehlerDetail(e)), detail: fehlerDetail(e) } });
    }
```

Nachher:
```ts
      if (v !== SDK_FASSUNG_BRIDGE) beob.ende({ ok: false, meldung: { text: KT.B7(v), detail: null }, ausgang: { art: 'sdkFassung' } });
      return;
    }
    if (ev.ev === 'auth') {
      const code = (ev as { code: number }).code;
      beob.ende(code === 0 ? { ok: true } : { ok: false, meldung: authMeldung(code), ausgang: { art: 'auth', code } });
      return;
    }
    if (ev.ev !== 'error') return;
    const e = ev as unknown as FehlerEreignis;
    const name = e.name ?? String(e.code);
    if (e.where === 'ndi') beob.ende({ ok: false, meldung: { text: KT.Q7, detail: fehlerDetail(e) }, ausgang: { art: 'ndi' } });
    else if (e.where === 'auth') beob.ende({ ok: false, meldung: { text: KT.B18(name), detail: fehlerDetail(e) }, ausgang: { art: 'authSofort' } });
    else if (e.where === 'init') {
      beob.ende({ ok: false, meldung: { text: e.code === 14 ? KT.B8_14 : KT.B8(name), detail: fehlerDetail(e) }, ausgang: { art: 'init' } });
    } else if (e.where === 'exit') {
      const exitCode = exitCodeAus(e.detail);
      beob.ende({
        ok: false,
        meldung: dllMeldung(exitCode) ?? { text: KT.B6(e.detail ?? fehlerDetail(e)), detail: fehlerDetail(e) },
        ausgang: { art: 'exited', exitCode },
      });
    }
```

Vorher:
```ts
    const abgebrochen: StartErgebnis = { ok: false, meldung: ABGEBROCHEN, mangel: null };
```

Nachher:
```ts
    const abgebrochen: StartErgebnis = { ok: false, meldung: ABGEBROCHEN, mangel: null, ausgang: null };
```

Vorher:
```ts
      return { ok: false, meldung: { text: mangelText(lzErg.mangel, mangelDatei()), detail: null }, mangel: lzErg.mangel };
```

Nachher:
```ts
      return { ok: false, meldung: { text: mangelText(lzErg.mangel, mangelDatei()), detail: null }, mangel: lzErg.mangel, ausgang: null };
```

Vorher:
```ts
      return { ok: false, meldung: { text: mangelText(m, null), detail: null }, mangel: m };
```

Nachher:
```ts
      return { ok: false, meldung: { text: mangelText(m, null), detail: null }, mangel: m, ausgang: null };
```

Vorher:
```ts
      beob.ende({ ok: false, meldung: spawnMeldung((e as { code?: string }).code) });
```

Nachher:
```ts
      beob.ende({ ok: false, meldung: spawnMeldung((e as { code?: string }).code), ausgang: { art: 'spawn' } });
```

Vorher:
```ts
      if (!beob.erledigt) anmeldeFrist = zeitgeber(f.anmeldeMs, () => beob.ende({ ok: false, meldung: { text: KT.B16, detail: null } }));
```

Nachher:
```ts
      if (!beob.erledigt) {
        anmeldeFrist = zeitgeber(f.anmeldeMs, () => beob.ende({ ok: false, meldung: { text: KT.B16, detail: null }, ausgang: { art: 'keineAuthAntwort' } }));
      }
```

Vorher:
```ts
      return lauf !== laufNr ? abgebrochen : { ok: false, meldung: a.meldung, mangel: null };
```

Nachher:
```ts
      return lauf !== laufNr ? abgebrochen : { ok: false, meldung: a.meldung, mangel: null, ausgang: a.ausgang };
```

- [ ] **Step 12: `kern.ts` — Meeting-Ende, Auslöser und Ausgänge**

Vorher:
```ts
    const m = endeMeldung(code, d.einstellungen.anzeigename());
    void stoppeBridge();
```

Nachher:
```ts
    const m = endeMeldung(code, d.einstellungen.anzeigename());
    // L4: auch während eines Versuchs ist ended ein Meeting-Ende, die Folge endet.
    folgeBeenden();
    void stoppeBridge();
```

Vorher (`statusEreignis`, ab dem Ende des Beitritts-Zweigs):
```ts
      else if (s === 'failed') scheitert(failMeldung(VORSATZ.beitritt, e.code, name));
      return;
    }
    if (zustand === 'im_meeting' || zustand === 'abriss') {
      if (s === 'reconnecting' || s === 'connecting') {
        if (zustand === 'im_meeting') setzeZustand('abriss');
      } else if (s === 'inMeeting') {
        if (zustand === 'abriss') {
          setzeZustand('im_meeting');
          abgleichPlanen();
        }
      } else if (s === 'waitingRoom' || s === 'waitingForHost') zumWarteraum(s);
      // 4a: kein Wiederbeitritt — jedes failed im Meeting ist endgültig (L1).
      else if (s === 'failed') scheitert(failMeldung(VORSATZ.verbindung, e.code, name));
    }
  }
```

Nachher:
```ts
      else if (s === 'failed') scheitert(failMeldung(VORSATZ.beitritt, e.code, name));
      return;
    }
    if (zustand === 'abriss' && folge !== null) {
      // 6.4 Schritt 2.4: Ausgang des laufenden Versuchs (Z11); connecting und reconnecting ändern nichts.
      if (s === 'inMeeting') versuchErfolgreich();
      else if (s === 'failed') {
        versuchGescheitert({ art: 'failed', code: e.code }, { text: failText(e.code, name), detail: failMeldung(VORSATZ.wiederbeitritt, e.code, name).detail });
      }
      return;
    }
    if (zustand === 'im_meeting' || zustand === 'abriss') {
      if (s === 'reconnecting' || s === 'connecting') {
        if (zustand === 'im_meeting') setzeZustand('abriss');
      } else if (s === 'inMeeting') {
        if (zustand === 'abriss') {
          setzeZustand('im_meeting');
          abgleichPlanen();
        }
      } else if (s === 'waitingRoom' || s === 'waitingForHost') zumWarteraum(s);
      else if (s === 'failed') {
        // 6.4: ein endgültiger Code endet mit „Verbindung verloren: “, jeder andere startet den Wiederbeitritt.
        const m = failMeldung(VORSATZ.verbindung, e.code, name);
        if (istEndgueltig({ art: 'failed', code: e.code })) scheitert(m);
        else starteWiederbeitritt({ text: failText(e.code, name), detail: m.detail });
      }
    }
  }
```

Vorher (`fehlerEreignis`, Rest ab `amBeitreten`):
```ts
    const amBeitreten = zustand === 'tritt_bei' || zustand === 'warteraum';
    const imMeeting = zustand === 'im_meeting' || zustand === 'abriss';
    if (e.where === 'join' && e.code === 'joinTimeout') {
      if (amBeitreten) scheitert({ text: KT.CT, detail: fehlerDetail(e) });
    } else if (e.where === 'join' && typeof e.code === 'number') {
      if (amBeitreten) scheitert({ text: KT.CJ(name), detail: fehlerDetail(e) });
    } else if (e.where === 'meeting' && e.code === 'reconnectTimeout') {
      if (amBeitreten) scheitert({ text: KT.CE, detail: fehlerDetail(e) });
      // 4a: statt Wiederbeitritt (L1).
      else if (zustand === 'abriss') scheitert({ text: VORSATZ.verbindung + KT.UE_RECONNECT, detail: fehlerDetail(e) });
    } else if (e.where === 'exit' && e.code === 'exited') {
      const dll = dllMeldung(exitCodeAus(e.detail));
      const detail = e.detail ?? fehlerDetail(e);
      // Spec 6.2 Schritt 5 und 8.3: im Beitritt gilt CB, nicht B3–B5 — die nennt 8.2 nur für den Tod vor `auth`.
      if (amBeitreten) scheitert({ text: KT.CB(detail), detail: fehlerDetail(e) });
      // 4a: statt Wiederbeitritt (L1).
      else if (imMeeting) scheitert(dll ?? { text: VORSATZ.verbindung + KT.UE_ABSTURZ(detail), detail: fehlerDetail(e) });
    }
  }
```

Nachher:
```ts
    const amBeitreten = zustand === 'tritt_bei' || zustand === 'warteraum';
    // Z11: Fehler der Versuchs-Bridge sind Ausgänge des Versuchs (6.4 Schritt 2.4), keine neuen Auslöser.
    const imVersuch = zustand === 'abriss' && folge !== null;
    const imMeeting = zustand === 'im_meeting' || zustand === 'abriss';
    if (e.where === 'join' && e.code === 'joinTimeout') {
      if (amBeitreten) scheitert({ text: KT.CT, detail: fehlerDetail(e) });
      else if (imVersuch) versuchGescheitert({ art: 'joinTimeout' }, { text: KT.CT, detail: fehlerDetail(e) });
    } else if (e.where === 'join' && typeof e.code === 'number') {
      if (amBeitreten) scheitert({ text: KT.CJ(name), detail: fehlerDetail(e) });
      else if (imVersuch) versuchGescheitert({ art: 'joinFehler' }, { text: KT.CJ(name), detail: fehlerDetail(e) });
    } else if (e.where === 'meeting' && e.code === 'reconnectTimeout') {
      if (amBeitreten) scheitert({ text: KT.CE, detail: fehlerDetail(e) });
      else if (imVersuch) versuchGescheitert({ art: 'reconnectTimeout' }, { text: KT.CT, detail: fehlerDetail(e) });
      // 6.4: In Z10 hat Zoom selbst nicht neu verbunden: Wiederbeitritt.
      else if (zustand === 'abriss') starteWiederbeitritt(null);
    } else if (e.where === 'exit' && e.code === 'exited') {
      const exitCode = exitCodeAus(e.detail);
      const dll = dllMeldung(exitCode);
      const detail = e.detail ?? fehlerDetail(e);
      // Spec 6.2 Schritt 5 und 8.3: im Beitritt gilt CB, nicht B3–B5 — die nennt 8.2 nur für den Tod vor `auth`.
      if (amBeitreten) scheitert({ text: KT.CB(detail), detail: fehlerDetail(e) });
      else if (imVersuch) versuchGescheitert({ art: 'exited', exitCode }, { text: KT.CB(detail), detail: fehlerDetail(e) });
      // 6.4: Die drei DLL-Rückgabewerte sind endgültig (B3–B5); jeder andere Tod im Meeting startet den Wiederbeitritt mit R4.
      else if (imMeeting && dll) scheitert(dll);
      else if (imMeeting) {
        hinweis(KT.R4(detail));
        starteWiederbeitritt(null);
      }
    }
  }
```

- [ ] **Step 13: `kern.ts` — die Folge (nach `verlassen`)**

Vorher (Ende von `verlassen` und Abschnittskopf „Quellen“):
```ts
    meldung = null;
    warImMeeting = false;
    setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
  }

  // ── Quellen (Spec 6.3, 8.4) ──────────────────────────────────────────────
```

Nachher:
```ts
    meldung = null;
    setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
  }

  // ── Wiederbeitritt (Spec 6.4) ────────────────────────────────────────────
  /** Schritt 1: Die alte Bridge stoppen (ab jetzt im Abbau, 6.9), Zustand abriss, Versuch 1 planen. */
  function starteWiederbeitritt(anlass: Meldungstext | null): void {
    if (folge !== null) return;
    void stoppeBridge();
    folge = { versuch: 1, naechsterUm: null, zeitgeber: null, letzte: anlass, beginn: 0 };
    planeVersuch(1);
  }

  /** Schritt 2.1: Versuch i nach plan[i - 1] ms; das Abbild zeigt den Countdown über `naechsterUm`. */
  function planeVersuch(i: number): void {
    if (folge === null) return;
    const ms = plan[i - 1] ?? 0;
    folge.versuch = i;
    folge.naechsterUm = Date.now() + ms;
    d.log(`[zoom] Wiederbeitritt: Versuch ${i} von ${WIEDERBEITRITT_VERSUCHE} in ${ms / 1000} s`);
    folge.zeitgeber = zeitgeber(ms, () => {
      if (folge === null) return;
      folge.zeitgeber = null;
      void versuchStarten(i);
    });
    setzeZustand('abriss');
  }

  /** Schritte 2.2 und 2.3: Startfolge mit neuer Bridge, dann join. Der Zustand bleibt abriss mit versuch i. */
  async function versuchStarten(i: number): Promise<void> {
    if (folge === null) return;
    const lauf = laufNr;
    folge.naechsterUm = null;
    folge.beginn = Date.now();
    abbildGeaendert();
    const r = await starteBridge();
    // Verlassen, Abbrechen oder Beenden während der Startfolge: kein weiterer Schritt, keine Meldung.
    if (folge === null || folge.versuch !== i || lauf !== laufNr || nummer === null) return;
    if (!r.ok) {
      // ausgang null = Mangel aus der Startfolge (5.3); den Weg in die Einrichtung baut Aufgabe 9.
      if (r.ausgang !== null) versuchGescheitert(r.ausgang, r.meldung);
      return;
    }
    if (imAbbau.has(r.gen)) return;
    sende({ cmd: 'join', meetingId: nummer.normiert, passcode: kenncode ?? '', displayName: d.einstellungen.anzeigename() });
  }

  /** Schritt 2.4 „inMeeting“: Erfolg. Der Abgleich lädt die Soll-Liste, sobald die Erlaubnis da ist; danach R5 (L3). */
  function versuchErfolgreich(): void {
    if (folge === null) return;
    d.log(`[zoom] Wiederbeitritt: Versuch ${folge.versuch} erfolgreich nach ${Date.now() - folge.beginn} ms`);
    folgeBeenden();
    r5Offen = true;
    imMeetingAngekommen();
  }

  /** Schritte 2.4 und 3: einordnen. Endgültig → fehler; vorübergehend → nächster Versuch; nach dem letzten R2. */
  function versuchGescheitert(a: VersuchsAusgang, m: Meldungstext): void {
    if (folge === null) return;
    const i = folge.versuch;
    const endgueltig = istEndgueltig(a);
    d.log(`[zoom] Wiederbeitritt: Versuch ${i} gescheitert nach ${Date.now() - folge.beginn} ms (${endgueltig ? 'endgültig' : 'vorübergehend'})`);
    if (endgueltig) {
      folgeBeenden();
      // 6.4 Schritt 2.4: jeder endgültige Fehler im Versuch bekommt „Wiederbeitritt abgebrochen: “, auch der DLL-Tod (dann B3–B5).
      const t = (a.art === 'exited' ? dllMeldung(a.exitCode) : null) ?? m;
      scheitert({ text: VORSATZ.wiederbeitritt + t.text, detail: t.detail });
      return;
    }
    folge.letzte = m;
    if (i >= WIEDERBEITRITT_VERSUCHE) {
      const letzte = folge.letzte;
      folgeBeenden();
      scheitert({ text: KT.R2(letzte.text), detail: letzte.detail });
      return;
    }
    void stoppeBridge();
    planeVersuch(i + 1);
  }

  /** Zeitgeber löschen, Folge vergessen (G17). */
  function folgeBeenden(): void {
    if (folge?.zeitgeber) clearTimeout(folge.zeitgeber);
    folge = null;
  }

  // ── Quellen (Spec 6.3, 8.4) ──────────────────────────────────────────────
```

- [ ] **Step 14: `kern.ts` — R5 im Abgleich (L3)**

Vorher:
```ts
    if (zustand !== 'im_meeting' || erlaubnis !== 'ja') return;
    const gen = aktiveGen;
    for (const h of sollHandlungen(soll, sollLage())) {
      if (gen !== aktiveGen || imAbbau.has(gen) || zustand !== 'im_meeting') return;
```

Nachher:
```ts
    if (zustand !== 'im_meeting' || erlaubnis !== 'ja') return;
    const gen = aktiveGen;
    const lage = sollLage();
    const handlungen = sollHandlungen(soll, lage);
    // L3: R5 nach dem ersten Abgleich mit Erlaubnis nach einem Wiederbeitritt; d = offene Einträge ohne Handlung.
    const r5 = r5Offen;
    r5Offen = false;
    const ohneHandlung = sollAbbild(soll, lage).length - handlungen.length;
    let k = 0;
    for (const h of handlungen) {
      if (gen !== aktiveGen || imAbbau.has(gen) || zustand !== 'im_meeting') return;
```

Vorher:
```ts
      eintrag.aboId = h.id;
      abonniere(h.id, h.ton);
    }
    abbildGeaendert();
  }
```

Nachher:
```ts
      eintrag.aboId = h.id;
      abonniere(h.id, h.ton);
      k += 1;
    }
    if (r5) hinweis(KT.R5(k, ohneHandlung));
    abbildGeaendert();
  }
```

- [ ] **Step 15: Tests laufen lassen (grün)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
npx tsx apps/connect/test/zoom-text.test.ts
```
Erwartet: `442 ok, 0 fehlgeschlagen, 0 übersprungen.` und `772 ok, 0 fehlgeschlagen.`, je Exit-Code 0.

- [ ] **Step 16: Typen prüfen**

```
npm run typecheck -w @jm/connect
```
Erwartet: Exit-Code 0, keine `error TS`-Zeile.

- [ ] **Step 17: Commit** (Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add apps/connect/src/main/zoom/kern.ts apps/connect/src/main/zoom/klartext.ts apps/connect/test/zoom-kern.test.ts apps/connect/test/zoom-text.test.ts
git status --short
```
Die gestagten Zeilen müssen genau diese sein:
```
M  apps/connect/src/main/zoom/kern.ts
M  apps/connect/src/main/zoom/klartext.ts
M  apps/connect/test/zoom-kern.test.ts
M  apps/connect/test/zoom-text.test.ts
```
```
git commit -m "feat(connect): Wiederbeitritt nach Abriss (Folge, Einordnung, R2/R4/R5)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Nicht pushen (G13).

**Gegenprobe (beim Planen gemessen, kein Umsetzungsschritt; Spec 12.5):** Jede Abweichung macht mindestens eine Prüfung rot, danach wird die Datei byte-gleich zurückgesetzt.
- Ereignisse im Abbau ausgewertet (`beiEreignis`: bei `!aktiv` zusätzlich `statusEreignis` für `status`) → Fall 15c: `439 ok, 3 fehlgeschlagen` („… der Wachhund (reconnectTimeout) startet den Wiederbeitritt“, „… wieder im Meeting, Anna neu abonniert“, „… kein R6, nie bereit …“).
- Code 63 als vorübergehend (`ENDGUELTIGE_FAIL_CODES` ohne 63) → Fall 17 und Einordnung in Z10: `437 ok, 5 fehlgeschlagen`.
- Wiederbeitritt bei `ended` (in `im_meeting` → `starteWiederbeitritt`) → Fall 19 und Lebenslauf: `435 ok, 7 fehlgeschlagen`.
- Doppelname abonniert (`soll.ts`: `treffer.length < 1` statt `!== 1`) → Fall 15: `438 ok, 4 fehlgeschlagen`.
- `zoom_alarm` ohne offene Soll-Einträge (Z6 `alarm [0, 0]`) → Fall 15b: `441 ok, 1 fehlgeschlagen`.
- DLL-Tod im Versuch wieder ohne Vorsatz (`versuchGescheitert` wie in der ersten Fassung: `const dll = a.art === 'exited' ? dllMeldung(a.exitCode) : null;` / `scheitert(dll ?? { text: VORSATZ.wiederbeitritt + m.text, detail: m.detail });`) → `441 ok, 1 fehlgeschlagen` („DLL-Tod in einem Versuch …“).

**Abweichungen von der Gliederung:**
- **Schritt 1 (Fall 10b) ist hierher vorgezogen.** Die Gliederung legt die Umschreibung in Aufgabe 10. Den Abbau (Aufgabe 1) hält Aufgabe 1 Step 13 mit einer geänderten Prüfung grün; hier wird der Fall ganz neu geschrieben (Montage MO1; seit der Nachbesserung braucht Aufgabe 4 keine Anpassung mehr). Aufgabe 10 fügt nur neue Prüfungen hinzu.
- **Fall 15 mit Anna, Carla und Dora statt Anna, Ben, Carla:** Mit `FAKE_DOPPELNAME=1` heißt der zweite Gast (16778241) „Anna“; „Ben“ gibt es dann nicht. Der erste Start läuft darum ohne Doppelname mit vier Gästen, der zweite mit Doppelname.
- **Neue Testhilfe `ereignis`** in `BaueOptionen` (die Gliederung nennt nur `wiederbeitrittPlanMs`): Die Attrappe kennt für `FAKE_VERBINDUNG_WEG_MS` nur Code 2 und stirbt mit `0xC0000005`. Über `ereignis` sieht der Kern Code 63 bzw. `exitCode=3221225781` (`0xC0000135`). Damit läuft „exited mit 0xC0000135 im Meeting → B3“ auf jeder Plattform; der Fall wird nicht übersprungen.
- **Auch `:1275-1284` (6.9 „… stürzt die Bridge ab → fehler“) ändert sich;** die Gliederung nennt den Block nicht. Mit langer Wartezeit (`[5000, …]`) prüft er dieselbe Regel 6.9 in Z11.
- **Die 4a-Blöcke `:1121-1153` werden in place zu Fall 16, 18 und 15c**, `:1366-1389` zu Fall 15 (mit R5 und Log). Der neue Block enthält 15b, 17, die Einordnung in Z10, den DLL-Tod, „abriss → im_meeting“, das Abbild in Z11 und Review Focus 4.
- **`zoom-text.test.ts`:** Nur die beiden `UE_*`-Zeilen fallen weg; die Schlüsselprüfung von `KT` (seit Aufgabe 5 ein Mengenvergleich ohne Zahl) braucht keine Änderung (Montage MO2).
- **`WIEDERBEITRITT_PLAN_S` mit eigener Importzeile:** Aufgabe 5 reicht es in `kern.ts` nur weiter und importiert es nicht lokal.
- **Nachbesserung (Review):** zwei Fälle mehr im neuen Block, „DLL-Tod in einem Versuch …“ (L5 folgt jetzt Spec 6.4 Schritt 2.4: Vorsatz auch beim DLL-Tod) und „L4: ended während eines Versuchs …“ (hält die gemeldete Abweichung L4 fest, bis der Owner entscheidet). Fall 10b prüft zusätzlich Z7 ohne gemerkte Quelle (Aufgabe 4, Spec 7). Neu gemessen: rot `405 ok, 37 fehlgeschlagen`, grün `442 ok`; die Gegenproben oben mit diesen Zahlen.
- **Texte für vorübergehende Ausgänge im Versuch:** `joinTimeout` und `reconnectTimeout` → `KT.CT`, `exited` → `KT.CB(detail)`, `join` mit SDK-Code → `KT.CJ(name)`. Es sind vorhandene Texte; sie erscheinen nur als „{letzter Grund}“ in R2 bzw. mit Vorsatz bei endgültigen Ausgängen.

### Task 9: Kern: Wiederbeitritt abbrechen, verlassen, beenden; Warteraum und Mangel im Versuch (6.4, Teil 2)

**Spec:** 6.4 Schritt 2.4 (Warteraum, Mangel), Schritt 4; 6.6 (Wiederbeitritt abbrechen beim Beenden); 6.8 (Abbrechen; Verlassen in Z10/Z11); 5.3 (Mangel); 12.2 Fall 25; Review Focus 3. Global Constraints G13–G17.

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\zoom-4b`

**Files:**
- Modify: `apps/connect/src/main/zoom/kern.ts` (Stand nach Aufgabe 8) — `ZoomKern` (HEAD `:166`, + `abbrechen`); `schliessen` (HEAD `:737`); `statusEreignis` (Z11-Zweig aus Aufgabe 8); `verlassen` (HEAD `:1171-1172`); `versuchStarten` und `folgeBeenden` (aus Aufgabe 8); `beenden` (HEAD `:1395-1396`); Rückgabeobjekt (HEAD `:1443`)
- Modify: `apps/connect/test/zoom-kern.test.ts` — neuer Block über der Ankerzeile

**Interfaces:**
- Consumes: Aufgabe 8 (`folge`, `folgeBeenden`, `versuchStarten`, `versuchGescheitert`, Log-Zeilen); Aufgabe 5 (`KT.R7`); 4a (`scheitert`, `mangelFolgen`, `melde`, `zumWarteraum`, `laufNr`).
- Produces (für Aufgabe 18):
  ```ts
  // ZoomKern
  /**
   * Spec 6.8 „Abbrechen“, nur Z11 (Folge wartet oder läuft): Zeitgeber löschen, Versuchs-Bridge stop(), Zustand
   * fehler mit R7, erneutMoeglich true; Soll-Liste, Nummer und Kenncode bleiben. Sonst wirkungslos.
   */
  abbrechen(): void;
  ```

**Verhalten (verbindlich, aus der Spec):**
- `abbrechen()` nur in `abriss` mit Folge (Z11): `laufNr + 1` (eine laufende Startfolge verwirft ihr Ergebnis), `folgeBeenden()`, Log `[zoom] Wiederbeitritt abgebrochen`, dann `scheitert(R7)` (Versuchs-Bridge `stop()`, Zustand `fehler`). Soll-Liste, Nummer und Kenncode bleiben (`erneutMoeglich: true`). In jedem anderen Zustand, auch in Z10, ohne Wirkung.
- `verlassen()` und `beenden()` löschen die Folge samt Zeitgeber (G17); danach startet kein Versuch mehr eine Bridge. `schliessen()` ebenso (G17; in Z2/Z13 gibt es keine Folge mehr, der Aufruf sichert nur ab).
- Ausgang eines Versuchs `waitingRoom`/`waitingForHost` → angekommen: Log „Versuch {i} erfolgreich nach {ms} ms“, Folge endet, Zustand `warteraum`; ab hier gilt 6.2 Schritt 5.
- Mangel aus der Startfolge eines Versuchs (Einordnung 6.4: endgültig) → Log „Versuch {i} gescheitert nach {ms} ms (endgültig)“, Folge endet, `mangelFolgen()` (Soll-Liste, Nummer, Kenncode leer), Meldung aus der Startfolge (S9 …), Zustand `einrichtung`.

- [ ] **Step 1: Fehlschlagende Tests schreiben**

In `apps/connect/test/zoom-kern.test.ts`:

Vorher:
```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

Nachher:
```ts
// ── Aufgabe 9 (4b): Wiederbeitritt verlassen, beenden, abbrechen; Warteraum und Mangel im Versuch ──
console.log('— Wiederbeitritt verlassen und beenden (Review Focus 3), Warteraum und Mangel im Versuch');
{
  const p = baueKern({
    stell: (n): Record<string, string> => (n === 1 ? { FAKE_VERBINDUNG_WEG_MS: '300' } : { FAKE_BEITRITT_SCHEITERT: '2' }),
    wiederbeitrittPlanMs: [30, 1500, 30, 30, 30],
  });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  ck('Verlassen in der Wartezeit vor Versuch 2: Versuch 2 wartet', await bis(() => p.kern.kurz().versuch === 2, 4000) && p.starts() === 2);
  await p.kern.verlassen();
  ck('… verlaesst → bereit, keine Meldung (kein R7), zoom_alarm=0', p.kern.kurz().zustand === 'bereit' && p.kern.abbild().meldung === null
    && folge(p).slice(-2).join(',') === 'verlaesst,bereit' && p.kern.stateKv()?.zoom_alarm === 0);
  ck('… Soll-Liste, Nummer und Kenncode leer', p.kern.abbild().soll.length === 0 && !p.kern.abbild().erneutMoeglich);
  await warte(1800);
  ck('… auch nach Ablauf der Wartezeit keine weitere Bridge', p.starts() === 2 && p.kern.kurz().zustand === 'bereit' && !p.kern.laeuft());
  await p.aufraeumen();
}
for (const weg of ['beenden', 'verlassen'] as const) {
  const p = baueKern({
    // Die zweite Bridge (envprobe) meldet nie ready: die Startfolge von Versuch 1 hängt.
    stell: (n): Record<string, string> => (n === 1 ? { FAKE_VERBINDUNG_WEG_MS: '300' } : { FAKE_SCRIPT: 'envprobe' }),
    fristen: { anmeldeMs: 20_000 },
  });
  await insMeeting(p);
  ck(`Review Focus 3 (${weg}): die Startfolge von Versuch 1 hängt vor ready`,
    await bis(() => p.starts() === 2 && p.kern.abbild().abriss?.naechsterUm === null, 4000));
  const t0 = Date.now();
  if (weg === 'beenden') await p.kern.beenden(2000);
  else await p.kern.verlassen();
  ck(`… ${weg} kehrt binnen 2 s zurück`, Date.now() - t0 < 2000);
  await warte(300);
  ck(`… keine dritte Bridge, keine Meldung (weder R2 noch R7), nichts läuft`, p.starts() === 2 && p.kern.abbild().meldung === null && !p.kern.laeuft());
  if (weg === 'verlassen') ck('… bereit, zoom_alarm=0', p.kern.kurz().zustand === 'bereit' && p.kern.stateKv()?.zoom_alarm === 0);
  await p.aufraeumen();
}
{
  const p = baueKern({
    stell: (n): Record<string, string> => (n === 1 ? { FAKE_VERBINDUNG_WEG_MS: '300' } : { FAKE_WARTERAUM: '1', FAKE_EINLASS_MS: '200' }),
  });
  await insMeeting(p);
  ck('Warteraum im Versuch → warteraum, die Folge endet', await bis(() => p.kern.kurz().zustand === 'warteraum', 4000));
  ck('… nach dem Einlass im Meeting, nie wieder abriss, zwei Bridges', await bis(() => p.kern.kurz().zustand === 'im_meeting', 3000)
    && folge(p).join(',').endsWith('abriss,warteraum,tritt_bei,im_meeting') && p.starts() === 2);
  ck('… Log: Versuch 1 mit Dauer', p.logs.some((z) => /^\[zoom\] Wiederbeitritt: Versuch 1 erfolgreich nach \d+ ms$/.test(z)));
  await p.aufraeumen();
}
{
  let pruefungen = 0;
  const p = baueKern({
    stell: (n): Record<string, string> => (n === 1 ? { FAKE_VERBINDUNG_WEG_MS: '300' } : { FAKE_BEITRITT_SCHEITERT: '2' }),
    // Aufrufe von pruefe: 1 beim Anlegen des Kerns, 2 Start 1, 3 Versuch 1, 4 Versuch 2 → Mangel.
    laufzeit: { pruefe: () => (++pruefungen >= 4 ? { ok: false, mangel: 'sdk_defekt', datei: 'sdk.dll' } : { ok: true, ordner: 'C:/laufzeit', ersetzt: [] }) },
  });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  ck('Mangel vor Versuch 2 → einrichtung mit S9', await bis(() => p.kern.kurz().zustand === 'einrichtung', 4000)
    && p.kern.abbild().meldung?.text === KT.S9('sdk.dll'));
  ck('… Soll-Liste, Nummer und Kenncode leer, keine Bridge für Versuch 2', p.kern.abbild().soll.length === 0 && !p.kern.abbild().erneutMoeglich
    && p.starts() === 2 && p.kern.kurz().versuch === null);
  await p.aufraeumen();
}

console.log('— Wiederbeitritt abbrechen (Fall 25)');
{
  const p = baueKern({
    stell: (n): Record<string, string> => (n === 1 ? { FAKE_VERBINDUNG_WEG_MS: '300' } : n === 2 ? { FAKE_BEITRITT_SCHEITERT: '2' } : {}),
    wiederbeitrittPlanMs: [30, 800, 30, 30, 30],
  });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  ck('Fall 25: Versuch 1 gescheitert, Versuch 2 wartet', await bis(() => p.kern.kurz().versuch === 2, 4000) && p.starts() === 2);
  p.kern.abbrechen();
  const m = p.kern.abbild().meldung;
  ck('… fehler mit R7, erneutMoeglich, Log', p.kern.kurz().zustand === 'fehler' && m?.text === KT.R7 && p.kern.abbild().erneutMoeglich
    && p.logs.includes('[zoom] Wiederbeitritt abgebrochen'));
  await warte(1200);
  ck('… nach Ablauf der Wartezeit keine weitere Bridge, Soll-Liste blieb', p.starts() === 2 && p.kern.kurz().zustand === 'fehler'
    && p.kern.abbild().soll.map((s) => s.name).join(',') === 'Anna');
  ck('Erneut beitreten nach R7: dritte Bridge, Anna wird wieder abonniert', ok(await p.kern.erneut())
    && (await bis(() => p.kern.kurz().zustand === 'im_meeting', 4000))
    && (await bis(() => p.befehle(3).some((c) => c.cmd === 'videoSubscribe' && c.id === ANNA), 2000)));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_VERBINDUNG_HAENGT_MS: '600' }), fristen: { joinTimeoutMs: 20_000 } });
  await insMeeting(p);
  p.kern.abbrechen();
  ck('abbrechen() in im_meeting wirkungslos', p.kern.kurz().zustand === 'im_meeting' && p.kern.abbild().meldung === null);
  await bis(() => p.kern.kurz().zustand === 'abriss', 2000);
  p.kern.abbrechen();
  ck('… und in Z10 wirkungslos', zoomZ(p.kern.kurz()) === 'Z10' && p.kern.abbild().meldung === null && !p.logs.includes('[zoom] Wiederbeitritt abgebrochen'));
  await p.aufraeumen();
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: 454 `ok`-Zeilen, dann 5 `FAIL`-Zeilen, die erste
```
FAIL  … auch nach Ablauf der Wartezeit keine weitere Bridge
```
(dann „Warteraum im Versuch …“ ×2 und „Mangel vor Versuch 2 …“ ×2), zuletzt Abbruch mit
```
TypeError: p.kern.abbrechen is not a function
```
Exit-Code 1. Die beiden Review-Focus-3-Fälle sind schon grün: Die Prüfung `lauf !== laufNr` in `versuchStarten` und `starteBridge` (Aufgabe 8) verwirft einen laufenden Versuch bereits. Sie bleiben als Regressionsschutz stehen.

- [ ] **Step 3: Schnittstelle und Rückgabeobjekt**

In `apps/connect/src/main/zoom/kern.ts`:

Vorher:
```ts
  verlassen(): Promise<void>;
  laden(
```

Nachher:
```ts
  verlassen(): Promise<void>;
  /**
   * Spec 6.8 „Abbrechen“, nur Z11 (Folge wartet oder läuft): Zeitgeber löschen, Versuchs-Bridge stop(), Zustand
   * fehler mit R7, erneutMoeglich true; Soll-Liste, Nummer und Kenncode bleiben. Sonst wirkungslos.
   */
  abbrechen(): void;
  laden(
```

Vorher:
```ts
    verlassen,
    laden,
```

Nachher:
```ts
    verlassen,
    abbrechen,
    laden,
```

- [ ] **Step 4: Schließen, Verlassen und Beenden löschen die Folge (G17)**

Vorher:
```ts
    if (zustand !== 'bereit' && zustand !== 'fehler') return;
    meldung = null;
    soll.clear();
```

Nachher:
```ts
    if (zustand !== 'bereit' && zustand !== 'fehler') return;
    folgeBeenden();
    meldung = null;
    soll.clear();
```

Vorher:
```ts
    laufNr += 1;
    d.log('[zoom] Meeting verlassen');
```

Nachher:
```ts
    laufNr += 1;
    // 6.8: Wiederbeitritts-Zeitgeber löschen; ein laufender Versuch verwirft sein Ergebnis (laufNr).
    folgeBeenden();
    d.log('[zoom] Meeting verlassen');
```

Vorher:
```ts
      laufNr += 1;
      ladeAbbruch?.abort();
```

Nachher:
```ts
      laufNr += 1;
      // 6.6: Wiederbeitritt abbrechen (G17): kein Versuch startet mehr eine Bridge.
      folgeBeenden();
      ladeAbbruch?.abort();
```

- [ ] **Step 5: Warteraum und Mangel im Versuch**

Vorher:
```ts
    if (zustand === 'abriss' && folge !== null) {
      // 6.4 Schritt 2.4: Ausgang des laufenden Versuchs (Z11); connecting und reconnecting ändern nichts.
      if (s === 'inMeeting') versuchErfolgreich();
      else if (s === 'failed') {
```

Nachher:
```ts
    if (zustand === 'abriss' && folge !== null) {
      // 6.4 Schritt 2.4: Ausgang des laufenden Versuchs (Z11); connecting und reconnecting ändern nichts.
      if (s === 'inMeeting') versuchErfolgreich();
      else if (s === 'waitingRoom' || s === 'waitingForHost') {
        // Angekommen: keine weiteren Versuche, ab hier gilt 6.2 Schritt 5 (Einlass, reconnectTimeout → CE).
        d.log(`[zoom] Wiederbeitritt: Versuch ${folge.versuch} erfolgreich nach ${Date.now() - folge.beginn} ms`);
        folgeBeenden();
        zumWarteraum(s);
      } else if (s === 'failed') {
```

Vorher:
```ts
    if (!r.ok) {
      // ausgang null = Mangel aus der Startfolge (5.3); den Weg in die Einrichtung baut Aufgabe 9.
      if (r.ausgang !== null) versuchGescheitert(r.ausgang, r.meldung);
      return;
    }
```

Nachher:
```ts
    if (!r.ok) {
      if (r.mangel !== null) {
        // Schritt 2.4 „Mangel aus der Startfolge“ (Einordnung: endgültig): Zustand einrichtung (5.3), die Folge endet.
        d.log(`[zoom] Wiederbeitritt: Versuch ${i} gescheitert nach ${Date.now() - folge.beginn} ms (endgültig)`);
        folgeBeenden();
        mangelFolgen();
        melde('fehler', r.meldung);
        setzeZustand('einrichtung');
        return;
      }
      if (r.ausgang !== null) versuchGescheitert(r.ausgang, r.meldung);
      return;
    }
```

- [ ] **Step 6: `abbrechen()`**

Vorher:
```ts
  /** Zeitgeber löschen, Folge vergessen (G17). */
  function folgeBeenden(): void {
    if (folge?.zeitgeber) clearTimeout(folge.zeitgeber);
    folge = null;
  }
```

Nachher:
```ts
  /** Zeitgeber löschen, Folge vergessen (G17). */
  function folgeBeenden(): void {
    if (folge?.zeitgeber) clearTimeout(folge.zeitgeber);
    folge = null;
  }

  /** Spec 6.8 „Abbrechen“ (nur Z11): Zeitgeber weg, Versuchs-Bridge stoppen, fehler mit R7; Soll, Nummer, Kenncode bleiben. */
  function abbrechen(): void {
    if (zustand !== 'abriss' || folge === null) return;
    // Eine laufende Startfolge verwirft ihr Ergebnis (wie Verlassen).
    laufNr += 1;
    folgeBeenden();
    d.log('[zoom] Wiederbeitritt abgebrochen');
    scheitert({ text: KT.R7, detail: null });
  }
```

- [ ] **Step 7: Test laufen lassen (grün)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: `464 ok, 0 fehlgeschlagen, 0 übersprungen.`, Exit-Code 0.

- [ ] **Step 8: Typen prüfen**

```
npm run typecheck -w @jm/connect
```
Erwartet: Exit-Code 0.

- [ ] **Step 9: Commit** (Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add apps/connect/src/main/zoom/kern.ts apps/connect/test/zoom-kern.test.ts
git status --short
```
Die gestagten Zeilen müssen genau diese sein:
```
M  apps/connect/src/main/zoom/kern.ts
M  apps/connect/test/zoom-kern.test.ts
```
```
git commit -m "feat(connect): Wiederbeitritt abbrechen, verlassen und beenden ohne weitere Bridge" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Nicht pushen (G13).

**Gegenprobe (beim Planen gemessen):** `abbrechen()` ohne `folgeBeenden()` → der Zeitgeber von Versuch 2 startet doch eine Bridge: `462 ok, 2 fehlgeschlagen` („… nach Ablauf der Wartezeit keine weitere Bridge, Soll-Liste blieb“, „Erneut beitreten nach R7 …“). Rückbau byte-gleich.

**Abweichungen von der Gliederung:**
- **Review Focus 3 mit dem Drehbuch `envprobe` statt `stuck`.** `stuck` meldet sofort `ready` mit der Fassung „7.1.5 (attrappe)“; der Versuch endete dann mit B7 und hinge nicht. `envprobe` sendet nie `ready`, beantwortet aber `quit`; `anmeldeMs` 20 000 hält die Startfolge offen.
- **„Mangel vor Versuch 2“:** `pruefe` liefert den Mangel ab dem **4.** Aufruf (1 beim Anlegen des Kerns, 2 Start 1, 3 Versuch 1, 4 Versuch 2), nicht „ab dem 2.“.
- **Fall 25 mit Plan `[30, 800, …]` und 1200 ms Wartezeit** statt `[30, 5000, …]` und 300 ms: Nur so startet die Gegenprobe (ohne `folgeBeenden`) die dritte Bridge noch innerhalb des Falls und wird rot.
- **Review Focus 3 ist schon nach Aufgabe 8 grün** (siehe Step 2); die Fälle halten das Verhalten fest.
- **`schliessen()` ruft `folgeBeenden()`** (G17), obwohl in Z2/Z13 keine Folge bestehen kann; kein Test kann den Aufruf belegen.
- **Logzeile beim Mangel:** „… (endgültig)“, weil 6.4 den Mangel unter „endgültig, sonst“ führt; kein neuer Text.

### Task 10: Kern: Entzug stoppt Quellen, Wiedererteilung lädt neu, Betriebsgröße im Abgleich (N4b.1, N4b.3 Nr. 3)

**Spec:** N4b.1 (Soll Connect, Wiedererteilung, Tests), N4b.3 Nr. 3, 6.2 Schritt 6, 6.3 (Abgleich, Laden Schritt 3), L7, Review Focus 2 und 4 (Teil Entzug); 4a-Ledger Task 14 minor 327 (offene Abos zählen) und Task 15 minor 341 (Erlaubnis nach `await`). Global Constraints G16, G18.

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\zoom-4b`

**Files:**
- Modify: `apps/connect/src/main/zoom/kern.ts` (Stand nach Aufgabe 9) — nach `aktiveQuellen` (HEAD `:293-300`) neu `belegteAbos`, `freiePlaetze`; `sollOffen` (HEAD `:320-322`); `starteBridge` S-c (HEAD `:857`); `videoEreignis` (HEAD `:1211`); `laden` (HEAD `:1278-1279`, `:1288-1289`); `abgleichen` (Stand nach Aufgabe 8)
- Modify: `apps/connect/test/zoom-kern.test.ts` — neuer Block über der Ankerzeile

**Interfaces:**
- Consumes: Aufgabe 1 (`FAKE_ENTZUG_MS` baut mit `privilegeRevoked` ab, `FAKE_ERTEILUNG_MS`, `FAKE_ABO_VERZOEGERUNG_MS`); Aufgabe 4 (`BETRIEBSGROESSE`, Stand `'grenze'`); Aufgabe 6 (`sollAbbild`/`sollHandlungen` mit `plaetze`); Aufgabe 8 (`abgleichen` mit R5).
- Produces (intern, für die Aufgaben 11 und 13):
  ```ts
  /** L7: bestätigte Quellen der aktiven Generation ∪ offene Abos (aboFristen), ohne Doppelzählung. */
  function belegteAbos(): Set<number>;
  /** Freie Plätze bis zur Betriebsgröße (N4b.3 Nr. 3): so viele Soll-Einträge darf der Abgleich abonnieren. */
  function freiePlaetze(): number;
  ```

**Verhalten (verbindlich):**
- Baut die Bridge eine Quelle mit Grund `privilegeRevoked` ab, nimmt der Kern sie aus dem Abbild, loggt `[zoom] Quelle {id} gestoppt (Entzug)` und lässt die Soll-Liste stehen. Der Eintrag ist danach offen (`wartet`), `zoom_alarm` steht auf 1 (Z7).
- Wiedererteilung (`entzogen → ja`) plant den Abgleich wie bisher (`privilegEreignis` bleibt unverändert). Der Abgleich lädt mit dem Ton des Soll-Eintrags, höchstens bis zur Betriebsgröße.
- Betriebsgröße (L7): „belegt“ = bestätigte Quellen der aktiven Generation plus offene Abos, ohne Doppelzählung. `laden()` prüft Q9 dagegen; der Abgleich bekommt `freiePlaetze()` als `plaetze`. Ein Eintrag ohne Platz steht als `grenze` und bleibt offen; der Abgleich loggt `[zoom] Abgleich: {n} gemerkte Quellen über der Betriebsgröße, nicht geladen`.
- Offene Abos einer alten Bridge belegen nach einem neuen Start keinen Platz: `starteBridge` leert `aboFristen` mit (Schritt S-c).
- Nach jedem `await` prüfen `laden()` (Schritt 3) und `abgleichen()` (Neu-Laden) auch die Erlaubnis. Ein Entzug in der Wartezeit lädt nichts mehr; `laden()` antwortet dann Q1.
- Nachbesserung (Review): `laden()` prüft nach dem `await` zusätzlich die Abos und die Soll-Liste. Ist die Person inzwischen belegt (zweiter Aufruf, Taste doppelt), antwortet es `ok` ohne zweites Abo; wurde der Eintrag in der Wartezeit entladen oder vergessen, lädt es nichts (`ok: false`, ohne Text). `abgleichen()` prüft vor jedem geplanten Abo die freien Plätze neu, weil in der Wartezeit eines Neu-Ladens ein Laden von Hand oder per Companion einen Platz belegen kann; von selbst lädt der Abgleich so nie mehr als 5. R5 zählt in `d` nur Einträge, die auf eine Person warten, nicht `grenze` (L3).

- [ ] **Step 1: Fehlschlagende Tests schreiben**

In `apps/connect/test/zoom-kern.test.ts`:

Vorher:
```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

Nachher:
```ts
// ── Aufgabe 10 (4b): Entzug stoppt Quellen, Wiedererteilung lädt neu, Betriebsgröße im Abgleich ──
console.log('— Entzug und Wiedererteilung (N4b.1, Review Focus 2 und 4)');
{
  const p = baueKern({ stell: () => ({ FAKE_ENTZUG_MS: '200' }) });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  await p.kern.laden({ id: BEN, ton: true, trotzBetriebsgroesse: false });
  ck('Entzug: zwei Quellen geladen, dann gestoppt', (await bis(() => p.kern.kurz().quellen === 2))
    && (await bis(() => p.kern.kurz().erlaubnis === 'entzogen' && p.kern.kurz().quellen === 0)));
  ck('… das Log nennt jede gestoppte Quelle mit ihrer Kennung',
    p.logs.includes(`[zoom] Quelle ${ANNA} gestoppt (Entzug)`) && p.logs.includes(`[zoom] Quelle ${BEN} gestoppt (Entzug)`));
  ck('… beide Soll-Einträge bleiben (wartet)', p.kern.abbild().soll.map((s) => `${s.name}:${s.stand}`).join(',') === 'Anna:wartet,Ben:wartet');
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_ENTZUG_MS: '200', FAKE_ERTEILUNG_MS: '300' }) });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: false, trotzBetriebsgroesse: false });
  ck('Wiedererteilung: Anna ohne Ton geladen, dann gestoppt', (await bis(() => p.kern.kurz().quellen === 1))
    && (await bis(() => p.kern.kurz().erlaubnis === 'entzogen' && p.kern.kurz().quellen === 0)));
  ck('… nach der Wiedererteilung ein neues videoSubscribe mit audio:false',
    await bis(() => p.befehle(1).filter((c) => c.cmd === 'videoSubscribe').length === 2, 3000)
    && p.befehle(1).filter((c) => c.cmd === 'videoSubscribe')[1].audio === false);
  ck('… die Quelle ist zurück: gleicher NDI-Name, ohne Ton, Alarm aus', await bis(() => zeile(p, ANNA)?.quelle?.ton === 'aus', 2000)
    && zeile(p, ANNA)?.quelle?.ndiName === 'JM Connect – Zoom Anna' && p.kern.kurz().sollOffen === 0 && p.kern.stateKv()?.zoom_alarm === 0);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_ENTZUG_MS: '200', FAKE_ABO_VERZOEGERUNG_MS: '400' }), fristen: { aboAntwortMs: 600 } });
  await insMeeting(p);
  ck('Entzug während eines offenen Abos: Laden gesendet', ok(await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false })));
  ck('… Erlaubnis entzogen', await bis(() => p.kern.kurz().erlaubnis === 'entzogen', 2000));
  await warte(800);
  ck('… keine Quelle, kein Q8, Soll-Eintrag bleibt', p.kern.kurz().quellen === 0 && zeile(p, ANNA)?.fehler === null
    && p.kern.abbild().soll.map((s) => s.name).join(',') === 'Anna');
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_ENTZUG_MS: '200', FAKE_ERTEILUNG_MS: '600' }) });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  ck('Entzug und dann Verlassen: Quelle gestoppt', await bis(() => p.kern.kurz().erlaubnis === 'entzogen' && p.kern.kurz().quellen === 0));
  await p.kern.verlassen();
  ck('… bereit, Soll-Liste leer, zoom_alarm=0', p.kern.kurz().zustand === 'bereit' && p.kern.abbild().soll.length === 0 && p.kern.stateKv()?.zoom_alarm === 0);
  await warte(900);
  ck('… auch nach der späteren Erteilung kein weiteres videoSubscribe', cmds(p, 1).filter((c) => c === 'videoSubscribe').length === 1);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_ENTZUG_MS: '300', FAKE_ERTEILUNG_MS: '0' }) });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: false, trotzBetriebsgroesse: false });
  await p.kern.laden({ id: BEN, ton: true, trotzBetriebsgroesse: false });
  ck('Review Focus 2: zwei Quellen, die Erlaubnis flattert (entzogen, sofort wieder erteilt, dann Abbau)', (await bis(() => p.kern.kurz().quellen === 2))
    && (await bis(() => p.ereignisse.some((x) => x.ev.ev === 'video' && (x.ev as { reason?: string }).reason === 'privilegeRevoked'), 2000)));
  ck('… je Soll-Name genau ein neues videoSubscribe, Ton unverändert', await bis(() => p.befehle(1).filter((c) => c.cmd === 'videoSubscribe').length === 4, 3000)
    && (await warte(500), true) && p.befehle(1).filter((c) => c.cmd === 'videoSubscribe').length === 4
    && JSON.stringify(p.befehle(1).filter((c) => c.cmd === 'videoSubscribe').slice(2).map((c) => [c.id, c.audio]).sort())
      === JSON.stringify([[ANNA, false], [BEN, true]]));
  ck('… beide Quellen laufen wieder, ohne „(2)“, ohne Q8', (await bis(() => p.kern.kurz().quellen === 2, 2000))
    && zeile(p, ANNA)?.quelle?.ton === 'aus' && zeile(p, BEN)?.quelle?.ton !== 'aus'
    && !p.kern.abbild().teilnehmer.some((t) => (t.quelle?.ndiName ?? '').includes(' (2)'))
    && zeile(p, ANNA)?.fehler === null && zeile(p, BEN)?.fehler === null && p.kern.kurz().sollOffen === 0);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_ENTZUG_MS: '200', FAKE_ERTEILUNG_MS: '600' }) });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  await p.kern.laden({ id: BEN, ton: true, trotzBetriebsgroesse: false });
  ck('Review Focus 4 (Entzug): beide gestoppt', (await bis(() => p.kern.kurz().quellen === 2))
    && (await bis(() => p.kern.kurz().erlaubnis === 'entzogen' && p.kern.kurz().quellen === 0)));
  p.kern.sollVerwerfen({ name: 'Ben' });
  ck('… Ben in Z7 vergessen', p.kern.abbild().soll.map((s) => s.name).join(',') === 'Anna');
  ck('… nach der Erteilung kommt nur Anna zurück', await bis(() => p.kern.kurz().erlaubnis === 'ja' && p.kern.kurz().quellen === 1, 3000)
    && (await warte(500), true) && p.befehle(1).filter((c) => c.cmd === 'videoSubscribe').map((c) => c.id).join(',') === `${ANNA},${BEN},${ANNA}`);
  await p.aufraeumen();
}

console.log('— Betriebsgröße im Abgleich und beim Laden (N4b.3 Nr. 3, L7)');
{
  const p = baueKern({ stell: () => ({ FAKE_TEILNEHMER: '6', FAKE_ENTZUG_MS: '1000', FAKE_ERTEILUNG_MS: '300' }) });
  await insMeeting(p);
  const ids = p.kern.abbild().teilnehmer.map((t) => t.id);
  for (const id of ids) await p.kern.laden({ id, ton: true, trotzBetriebsgroesse: true });
  ck('Betriebsgröße im Abgleich: sechs Quellen geladen (trotzBetriebsgroesse)', ids.length === 6 && (await bis(() => p.kern.kurz().quellen === 6)));
  ck('… der Entzug stoppt alle sechs', await bis(() => p.kern.kurz().erlaubnis === 'entzogen' && p.kern.kurz().quellen === 0, 3000));
  ck('… nach der Erteilung genau fünf neue videoSubscribe', await bis(() => p.kern.kurz().erlaubnis === 'ja' && p.kern.kurz().quellen === 5, 3000)
    && (await warte(500), true) && p.befehle(1).filter((c) => c.cmd === 'videoSubscribe').length === 11);
  const s = p.kern.abbild().soll;
  ck('… der sechste Eintrag steht als grenze, sollOffen 1, zoom_alarm=1', s.length === 1 && s[0].name === 'Frieda' && s[0].stand === 'grenze'
    && p.kern.kurz().sollOffen === 1 && p.kern.stateKv()?.zoom_alarm === 1);
  ck('… das Log nennt die Grenze', p.logs.includes('[zoom] Abgleich: 1 gemerkte Quellen über der Betriebsgröße, nicht geladen'));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_TEILNEHMER: '6', FAKE_ABO_VERZOEGERUNG_MS: '300' }) });
  await insMeeting(p);
  const ids = p.kern.abbild().teilnehmer.map((t) => t.id);
  for (const id of ids.slice(0, 3)) await p.kern.laden({ id, ton: true, trotzBetriebsgroesse: false });
  ck('Zwei Laden ohne await: drei Quellen bestätigt', await bis(() => p.kern.kurz().quellen === 3, 2000));
  ck('… die vierte ist offen (gesendet, noch nicht bestätigt)', ok(await p.kern.laden({ id: ids[3], ton: true, trotzBetriebsgroesse: false }))
    && p.kern.kurz().quellen === 3);
  const fuenfte = p.kern.laden({ id: ids[4], ton: true, trotzBetriebsgroesse: false });
  const sechste = p.kern.laden({ id: ids[5], ton: true, trotzBetriebsgroesse: false });
  ck('… genau eines ok, das andere Q9 (offene Abos zählen mit)', ok(await fuenfte) && text(await sechste) === KT.Q9(6));
  ck('… am Ende fünf Quellen', await bis(() => p.kern.kurz().quellen === 5, 2000) && (await warte(400), p.kern.kurz().quellen === 5));
  await p.aufraeumen();
}
{
  const p = baueKern({
    stell: (n): Record<string, string> => (n === 1
      ? { FAKE_TEILNEHMER: '6', FAKE_ABO_VERZOEGERUNG_MS: '3000', FAKE_VERBINDUNG_WEG_MS: '600' }
      : { FAKE_TEILNEHMER: '6' }),
  });
  await insMeeting(p);
  const ids = p.kern.abbild().teilnehmer.map((t) => t.id);
  for (const id of ids.slice(0, 5)) await p.kern.laden({ id, ton: true, trotzBetriebsgroesse: false });
  ck('Offene Abos beim Abriss: fünf gesendet, keins bestätigt', await bis(() => p.befehle(1).filter((c) => c.cmd === 'videoSubscribe').length === 5, 2000)
    && p.kern.kurz().quellen === 0);
  ck('… nach dem Wiederbeitritt abonniert der Abgleich alle fünf (die alten Abos belegen keinen Platz)',
    await bis(() => p.starts() === 2 && p.kern.kurz().zustand === 'im_meeting', 4000)
    && (await bis(() => p.befehle(2).filter((c) => c.cmd === 'videoSubscribe').length === 5, 2000)));
  await p.aufraeumen();
}

console.log('— Erlaubnis nach jedem await neu prüfen (Entzug während des Neu-Ladens)');
for (const weg of ['Abgleich', 'Laden'] as const) {
  const p: Probe = baueKern({
    stell: () => ({ FAKE_WIEDERBEITRITT_MS: '600', FAKE_RUECKKEHR_MS: '200', FAKE_RUECKKEHR_NAME: 'anna', FAKE_ENTZUG_MS: '1300' }),
    // Das videoUnsubscribe für die alte Quelle verschlucken: Neu-Laden wartet dann bis unsubscribeWarteMs auf die Abmeldung,
    // und der Entzug (abbauen in der Attrappe) beendet das Warten.
    sendeFilter: (c) => !(c.cmd === 'videoUnsubscribe' && c.id === ANNA),
    fristen: { unsubscribeWarteMs: 1000 },
  });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  ck(`Entzug während des Neu-Ladens (${weg}): „anna“ kommt zurück`, await bis(() => zeile(p, 16778250) !== undefined, 2000));
  if (weg === 'Laden') {
    const r = await p.kern.laden({ id: 16778250, ton: true, trotzBetriebsgroesse: false });
    ck('… Laden von Hand wartet auf die Abmeldung, der Entzug kommt dazwischen → Q1', text(r) === KT.Q1);
  } else {
    ck('… der Abgleich lädt neu und wartet auf die Abmeldung', await bis(() => p.logs.some((z) => z.includes('wird für Teilnehmer 16778250 neu geladen')), 2000));
  }
  ck('… Erlaubnis entzogen', await bis(() => p.kern.kurz().erlaubnis === 'entzogen', 2000));
  await warte(1200);
  ck('… danach kein videoSubscribe für 16778250', !p.befehle(1).some((c) => c.cmd === 'videoSubscribe' && c.id === 16778250));
  await p.aufraeumen();
}

console.log('— Nach jedem await auch Soll-Liste, Abos und Plätze neu prüfen; R5 mit Grenze (L3, L7)');
{
  const p = baueKern({
    stell: () => ({ FAKE_WIEDERBEITRITT_MS: '600', FAKE_RUECKKEHR_MS: '200', FAKE_RUECKKEHR_NAME: 'anna' }),
    // Die Abmeldung der alten Quelle verschlucken: Laden von Hand wartet dann bis unsubscribeWarteMs.
    sendeFilter: (c) => !(c.cmd === 'videoUnsubscribe' && c.id === ANNA),
    fristen: { unsubscribeWarteMs: 1000 },
  });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  ck('Vergessen, während Laden von Hand auf die Abmeldung wartet: „anna“ kommt zurück', await bis(() => zeile(p, 16778250) !== undefined, 2000));
  const laden = p.kern.laden({ id: 16778250, ton: true, trotzBetriebsgroesse: false });
  await warte(100);
  p.kern.sollVerwerfen({ name: 'Anna' });
  ck('… Laden endet ohne Abo (ok: false, ohne Text)', text(await laden) === '');
  await warte(1300);
  ck('… kein videoSubscribe für 16778250, keine gemerkte Quelle', !p.befehle(1).some((c) => c.cmd === 'videoSubscribe' && c.id === 16778250)
    && p.kern.abbild().soll.length === 0);
  await p.aufraeumen();
}
{
  const p = baueKern({
    stell: () => ({ FAKE_WIEDERBEITRITT_MS: '600', FAKE_RUECKKEHR_MS: '200', FAKE_RUECKKEHR_NAME: 'anna' }),
    sendeFilter: (c) => !(c.cmd === 'videoUnsubscribe' && c.id === ANNA),
    fristen: { unsubscribeWarteMs: 1000 },
  });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  ck('Zweimal Laden derselben Person in der Wartezeit (Taste doppelt): „anna“ kommt zurück', await bis(() => zeile(p, 16778250) !== undefined, 2000));
  const erstes = p.kern.laden({ id: 16778250, ton: true, trotzBetriebsgroesse: false });
  const zweites = p.kern.laden({ id: 16778250, ton: true, trotzBetriebsgroesse: false });
  ck('… beide ok', ok(await erstes) && ok(await zweites));
  await warte(1300);
  ck('… genau ein videoSubscribe für 16778250 (auch mit dem Abgleich)',
    p.befehle(1).filter((c) => c.cmd === 'videoSubscribe' && c.id === 16778250).length === 1);
  await p.aufraeumen();
}
{
  const DORA = 16778243;
  const EMIL = 16778244;
  const FRIEDA = 16778245;
  let doraVerschluckt = false;
  const p = baueKern({
    stell: () => ({ FAKE_TEILNEHMER: '6', FAKE_WIEDERBEITRITT_MS: '1500', FAKE_RUECKKEHR_MS: '200', FAKE_RUECKKEHR_NAME: 'anna' }),
    sendeFilter: (c) => {
      // Annas Abmeldung kommt nie an: Der Abgleich wartet beim Neu-Laden die Frist ab.
      if (c.cmd === 'videoUnsubscribe' && c.id === ANNA) return false;
      // Doras erstes Abo bleibt ohne Antwort (Q8): Sie steht danach als gemerkte Quelle ohne Abo da.
      if (c.cmd === 'videoSubscribe' && c.id === DORA && !doraVerschluckt) {
        doraVerschluckt = true;
        return false;
      }
      return true;
    },
    fristen: { unsubscribeWarteMs: 1000, aboAntwortMs: 300 },
  });
  await insMeeting(p);
  await warte(400);
  for (const id of [ANNA, BEN, CARLA, DORA, FRIEDA]) await p.kern.laden({ id, ton: true, trotzBetriebsgroesse: false });
  ck('Plätze nach einem await neu prüfen: vier Quellen, Dora ohne Antwort (Q8)',
    await bis(() => p.kern.kurz().quellen === 4 && zeile(p, DORA)?.fehler === KT.Q8, 2000));
  ck('… „anna“ kommt zurück, der Abgleich lädt neu und wartet auf die Abmeldung (Dora bekäme den letzten Platz)',
    await bis(() => p.logs.some((z) => z.includes('wird für Teilnehmer 16778250 neu geladen')), 3000));
  ck('… Laden von Hand belegt in der Wartezeit den letzten Platz', ok(await p.kern.laden({ id: EMIL, ton: true, trotzBetriebsgroesse: false })));
  await warte(1300);
  ck('… danach kein videoSubscribe für Dora (der Abgleich lädt nie über 5), Dora steht als grenze',
    !p.befehle(1).some((c) => c.cmd === 'videoSubscribe' && c.id === DORA)
    && p.kern.abbild().soll.some((s) => s.name === 'Dora' && s.stand === 'grenze'));
  await p.aufraeumen();
}
{
  const p = baueKern({
    stell: (n): Record<string, string> => (n === 1 ? { FAKE_TEILNEHMER: '6', FAKE_VERBINDUNG_WEG_MS: '1200' } : { FAKE_TEILNEHMER: '6' }),
  });
  await insMeeting(p);
  const ids = p.kern.abbild().teilnehmer.map((t) => t.id);
  for (const id of ids) await p.kern.laden({ id, ton: true, trotzBetriebsgroesse: true });
  ck('R5 mit Grenze: sechs Quellen geladen, dann Abriss und Wiederbeitritt', ids.length === 6 && (await bis(() => p.kern.kurz().quellen === 6, 2000))
    && (await bis(() => p.starts() === 2 && p.befehle(2).filter((c) => c.cmd === 'videoSubscribe').length === 5, 5000)));
  await warte(400);
  ck('… genau fünf neue Abos; R5 „5 Quellen neu geladen, 0 warten …“ (grenze wartet auf keine Person)',
    p.befehle(2).filter((c) => c.cmd === 'videoSubscribe').length === 5 && p.kern.abbild().hinweise.includes(KT.R5(5, 0)));
  const s = p.kern.abbild().soll;
  ck('… der sechste Eintrag steht als grenze unter „Gemerkte Quellen“, zoom_alarm=1',
    s.length === 1 && s[0].stand === 'grenze' && p.kern.stateKv()?.zoom_alarm === 1);
  await p.aufraeumen();
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

Zeitachse des letzten Falls (relativ zu `inMeeting`): Erlaubnis bei 50 ms; Anna geht bei 600 ms; „anna“ kommt bei 800 ms; Abgleich bzw. Laden von Hand schickt das (verschluckte) `videoUnsubscribe` und wartet bis höchstens 1800 ms; der Entzug kommt bei 50 + 1300 = 1350 ms, und sein Abbau meldet Annas altes Abo ab. Ohne Prüfung der Erlaubnis nach dem `await` geht `videoSubscribe` für 16778250 hinaus.

- [ ] **Step 2: Test laufen lassen (rot)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: `498 ok, 16 fehlgeschlagen, 0 übersprungen.`, Exit-Code 1. Die erste `FAIL`-Zeile:
```
FAIL  … das Log nennt jede gestoppte Quelle mit ihrer Kennung
```
Weitere: Betriebsgröße im Abgleich (3), „Zwei Laden ohne await“ (2), Neu-Laden nach Entzug (Abgleich 1, Laden 2); aus dem nachgebesserten Block „Nach jedem await auch Soll-Liste, Abos und Plätze …“ sieben: Vergessen in der Wartezeit (2), zweimal Laden derselben Person (1), Plätze nach einem await (1), R5 mit Grenze (3; vor dieser Aufgabe abonniert der Wiederbeitritt alle sechs). Schon grün, weil die Connect-Seite der Wiederladung aus 4a stammt und jetzt mit der neuen Attrappe belegt ist: „Wiedererteilung …“, „Entzug während eines offenen Abos …“, „Entzug und dann Verlassen …“, Review Focus 2 und 4. „Offene Abos beim Abriss …“ ist ebenfalls schon grün, weil der Abgleich vor diesem Schritt gar keine Grenze kennt; der Fall wird erst mit der Grenze ohne das Leeren von `aboFristen` rot (siehe Gegenprobe).

- [ ] **Step 3: `belegteAbos` und `freiePlaetze`**

In `apps/connect/src/main/zoom/kern.ts`:

Vorher:
```ts
    return m;
  }

  function teilnehmerAbbild(): ZoomParticipant[] {
```

Nachher:
```ts
    return m;
  }

  /** L7: bestätigte Quellen der aktiven Generation ∪ offene Abos (aboFristen), ohne Doppelzählung. */
  function belegteAbos(): Set<number> {
    const belegt = new Set(aktiveQuellen().keys());
    for (const id of aboFristen.keys()) belegt.add(id);
    return belegt;
  }

  /** Freie Plätze bis zur Betriebsgröße (N4b.3 Nr. 3): so viele Soll-Einträge darf der Abgleich abonnieren. */
  function freiePlaetze(): number {
    return Math.max(0, BETRIEBSGROESSE - belegteAbos().size);
  }

  function teilnehmerAbbild(): ZoomParticipant[] {
```

Vorher:
```ts
  function sollOffen(): ZoomSollEintrag[] {
    return sollAbbild(soll, sollLage());
  }
```

Nachher:
```ts
  function sollOffen(): ZoomSollEintrag[] {
    return sollAbbild(soll, sollLage(), freiePlaetze());
  }
```

- [ ] **Step 4: Startfolge leert offene Abos der alten Bridge**

Vorher:
```ts
    tonAngefragt.clear();
    const ordner = lzErg.ordner;
```

Nachher:
```ts
    tonAngefragt.clear();
    // Offene Abos der alten Bridge belegen keinen Platz mehr (L7); ihre Q8-Frist zählt ohnehin nur in ihrer Generation.
    for (const t of aboFristen.values()) clearTimeout(t);
    aboFristen.clear();
    const ordner = lzErg.ordner;
```

- [ ] **Step 5: Entzug im Video-Ereignis**

Vorher:
```ts
    aboBeantwortet(e.id);
    if (e.state === 'unsubscribed') {
      quellen.delete(e.id);
```

Nachher:
```ts
    aboBeantwortet(e.id);
    if (e.state === 'unsubscribed') {
      // N4b.1: Beim Entzug baut die Bridge jedes Abo ab. Die Soll-Liste bleibt; die Wiedererteilung lädt über den Abgleich neu.
      if (e.reason === 'privilegeRevoked') d.log(`[zoom] Quelle ${e.id} gestoppt (Entzug)`);
      quellen.delete(e.id);
```

- [ ] **Step 6: `laden()` — offene Abos zählen, Erlaubnis nach dem `await`**

Vorher:
```ts
    const n = aktiveQuellen().size;
    if (n >= BETRIEBSGROESSE && !e.trotzBetriebsgroesse) return { ok: false, text: KT.Q9(n + 1) };
```

Nachher:
```ts
    // L7: offene Abos zählen mit, sonst kämen zwei schnelle Klicks (oder Companion) über die Betriebsgröße.
    const n = belegteAbos().size;
    if (n >= BETRIEBSGROESSE && !e.trotzBetriebsgroesse) return { ok: false, text: KT.Q9(n + 1) };
```

Vorher:
```ts
      await abmeldungAbwarten(altQuelle.aboId);
      if (gen !== aktiveGen || imAbbau.has(gen) || zustand !== 'im_meeting') return { ok: false, text: '' };
    }
```

Nachher:
```ts
      await abmeldungAbwarten(altQuelle.aboId);
      if (gen !== aktiveGen || imAbbau.has(gen) || zustand !== 'im_meeting') return { ok: false, text: '' };
      // Nach dem await die Erlaubnis neu prüfen: Ein Entzug in der Wartezeit lädt nichts mehr (N4b.1).
      if (erlaubnis !== 'ja') return { ok: false, text: KT.Q1 };
      // … und Abos und Soll-Liste: Hat ein zweiter Aufruf (Taste doppelt, Companion) die Person in der Wartezeit schon
      // abonniert, ist das erledigt; wurde der Eintrag entladen oder vergessen, lädt nichts mehr.
      if (belegteAbos().has(e.id)) return { ok: true };
      if (soll.get(schluessel) !== alt) return { ok: false, text: '' };
    }
```

- [ ] **Step 7: `abgleichen()` — Plätze, Grenze im Log, Erlaubnis nach dem `await`**

Vorher:
```ts
    const lage = sollLage();
    const handlungen = sollHandlungen(soll, lage);
    // L3: R5 nach dem ersten Abgleich mit Erlaubnis nach einem Wiederbeitritt; d = offene Einträge ohne Handlung.
    const r5 = r5Offen;
    r5Offen = false;
    const ohneHandlung = sollAbbild(soll, lage).length - handlungen.length;
    let k = 0;
    for (const h of handlungen) {
      if (gen !== aktiveGen || imAbbau.has(gen) || zustand !== 'im_meeting') return;
      const eintrag = soll.get(h.schluessel);
      if (!eintrag) continue;
      if (h.art === 'neuLaden') {
        d.log(`[zoom] Abgleich: verwaiste Quelle ${h.altAboId} wird für Teilnehmer ${h.id} neu geladen`);
        sende({ cmd: 'videoUnsubscribe', id: h.altAboId });
        await abmeldungAbwarten(h.altAboId);
        if (gen !== aktiveGen || imAbbau.has(gen) || zustand !== 'im_meeting' || soll.get(h.schluessel) !== eintrag) continue;
```

Nachher:
```ts
    const lage = sollLage();
    // N4b.3 Nr. 3: höchstens bis zur Betriebsgröße; Einträge ohne Platz stehen als 'grenze' und bleiben offen (L7).
    const plaetze = freiePlaetze();
    const handlungen = sollHandlungen(soll, lage, plaetze);
    const offen = sollAbbild(soll, lage, plaetze);
    const ueber = offen.filter((e) => e.stand === 'grenze').length;
    if (ueber > 0) d.log(`[zoom] Abgleich: ${ueber} gemerkte Quellen über der Betriebsgröße, nicht geladen`);
    // L3: R5 nach dem ersten Abgleich mit Erlaubnis nach einem Wiederbeitritt; d = offene Einträge ohne Handlung, die auf
    // eine eindeutige Person warten. 'grenze' wartet auf einen Platz, nicht auf eine Person, und zählt darum nicht.
    const r5 = r5Offen;
    r5Offen = false;
    const ohneHandlung = offen.length - ueber - handlungen.length;
    let k = 0;
    for (const h of handlungen) {
      if (gen !== aktiveGen || imAbbau.has(gen) || zustand !== 'im_meeting' || erlaubnis !== 'ja') return;
      const eintrag = soll.get(h.schluessel);
      if (!eintrag) continue;
      if (h.art === 'neuLaden') {
        d.log(`[zoom] Abgleich: verwaiste Quelle ${h.altAboId} wird für Teilnehmer ${h.id} neu geladen`);
        sende({ cmd: 'videoUnsubscribe', id: h.altAboId });
        await abmeldungAbwarten(h.altAboId);
        // Nach dem await auch die Erlaubnis neu prüfen: Ein Entzug in der Wartezeit lädt nichts mehr (N4b.1).
        if (gen !== aktiveGen || imAbbau.has(gen) || zustand !== 'im_meeting' || erlaubnis !== 'ja' || soll.get(h.schluessel) !== eintrag) continue;
```

Vorher (derselbe Abgleich, Zweig „abonnieren“):
```ts
      } else {
        d.log(`[zoom] Abgleich: Teilnehmer ${h.id} wird abonniert`);
      }
```

Nachher:
```ts
      } else {
        // L7: Nach einem await in dieser Runde (Neu-Laden) kann ein Laden von Hand oder per Companion den Platz belegt
        // haben, den die Planung vorsah. Ohne freien Platz bleibt der Eintrag offen und steht im Abbild als 'grenze'.
        if (freiePlaetze() <= 0) continue;
        d.log(`[zoom] Abgleich: Teilnehmer ${h.id} wird abonniert`);
      }
```

- [ ] **Step 8: Test laufen lassen (grün)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: `514 ok, 0 fehlgeschlagen, 0 übersprungen.`, Exit-Code 0.

- [ ] **Step 9: Typen prüfen**

```
npm run typecheck -w @jm/connect
```
Erwartet: Exit-Code 0.

- [ ] **Step 10: Commit** (Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add apps/connect/src/main/zoom/kern.ts apps/connect/test/zoom-kern.test.ts
git status --short
```
Die gestagten Zeilen müssen genau diese sein:
```
M  apps/connect/src/main/zoom/kern.ts
M  apps/connect/test/zoom-kern.test.ts
```
```
git commit -m "feat(connect): Entzug stoppt Zoom-Quellen, Wiedererteilung laedt neu, Betriebsgroesse im Abgleich" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Nicht pushen (G13).

**Gegenprobe (beim Planen gemessen):**
- `aboFristen` in `starteBridge` nicht leeren → „… nach dem Wiederbeitritt abonniert der Abgleich alle fünf …“: `513 ok, 1 fehlgeschlagen` (die fünf offenen Abos der alten Bridge belegen alle Plätze).
- Im Abgleich nach dem `await` die Erlaubnis nicht prüfen → `512 ok, 2 fehlgeschlagen` („… danach kein videoSubscribe für 16778250“ in beiden Varianten; in der Variante „Laden“ abonniert der parallel laufende Abgleich).
- `belegteAbos` ohne `aboFristen` ist der gemessene Rot-Stand „Zwei Laden ohne await“ (Step 2).
- In `laden()` die beiden Prüfungen nach dem `await` (`belegteAbos().has(e.id)`, `soll.get(schluessel) !== alt`) weglassen → `511 ok, 3 fehlgeschlagen` („… Laden endet ohne Abo …“, „… kein videoSubscribe für 16778250, keine gemerkte Quelle“, „… genau ein videoSubscribe für 16778250 (auch mit dem Abgleich)“).
- Im Abgleich `if (freiePlaetze() <= 0) continue;` weglassen → `513 ok, 1 fehlgeschlagen` („… danach kein videoSubscribe für Dora …“).
- R5 zählt `grenze` mit (`const ohneHandlung = offen.length - handlungen.length;`) → `513 ok, 1 fehlgeschlagen` („… genau fünf neue Abos; R5 „5 Quellen neu geladen, 0 warten …“ …“).

**Abweichungen von der Gliederung:**
- **Fall 10b ist schon in Aufgabe 8 Schritt 1 umgeschrieben** (dort begründet). Hier steht nur der neue Fall „Entzug: zwei Quellen …“ mit der Logzeile je Quelle.
- **`privilegEreignis` bleibt unverändert.** Die Logzeile je gestoppter Quelle steht in `videoEreignis`; die vorhandene Zeile „Aufnahme-Erlaubnis: entzogen“ bleibt.
- **Zusätzlich:** `starteBridge` leert `aboFristen` (sonst belegten offene Abos einer abgerissenen Bridge nach dem Wiederbeitritt bis zu 10 s die Plätze) samt Fall „Offene Abos beim Abriss …“; zusätzlich die Variante „Laden von Hand“ (Laden Schritt 3) im Fall „Erlaubnis nach jedem await“; dort antwortet `laden()` mit Q1.
- **Mehrere Fälle sind vor der Umsetzung schon grün** (siehe Step 2). Sie halten N4b.1 mit der neuen Attrappe fest.
- **Logtext „{n} gemerkte Quellen über der Betriebsgröße“ wörtlich nach der Texttabelle**, auch bei n = 1. Eine Einzahl wäre schöner; das entscheidet der Owner mit der Texttabelle.
- **Nachbesserung (Review):** drei Prüfungen mehr im Kern, je mit eigenem Fall: `laden()` prüft nach dem `await` auch Abos und Soll-Liste (sonst legte ein Laden von Hand eine in der Wartezeit vergessene Quelle neu an, und ein zweiter Aufruf umging die Prell-Sperre); der Abgleich prüft vor jedem geplanten Abo die freien Plätze neu (sonst lud er nach einem Laden von Hand in der Wartezeit eine sechste Quelle); R5 zählt `grenze` nicht in `d` (sonst hieß es nach einem Wiederbeitritt mit sechs gemerkten Quellen „1 wartet auf eine eindeutige Person“). Bekannte Grenze: `fernLaden` (Aufgabe 13) meldet `zoom_cmd=ok`, sobald `laden()` angestoßen ist; bricht `laden()` nach dem Warten auf eine verwaiste Quelle ab (Entzug, Vergessen), bleibt `ok` stehen (offener Punkt O12).

### Task 11: Kern: Randfälle 0.3.0 (N4b.3 Nr. 1, 2, 4, 6, 7, 8)

**Spec:** N4b.3 Nr. 1, 2, 4, 6, 7; Nr. 8 (S10-Sperre im Abbau, Z12 beim Beenden ohne Meeting, Z2 mit n > 0 nach Meeting-Ende); 6.3 (Entladen), 6.7 (Versatz). L12, L13, L14, L15, L22. Global Constraints G4, G16.

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\zoom-4b`

**Files:**
- Modify: `apps/connect/src/main/zoom/kern.ts` (Stand nach Aufgabe 10) — `einstellungen` in den Abhängigkeiten (HEAD `:123-124`); `teilnehmerAbbild` (HEAD `:305`); `abbild()` Versatz-Zeile (nach Aufgabe 4); `einrichtungSperre` (HEAD `:444-445`); `versatz` (HEAD `:729-732`); `beitreten` (HEAD `:1065-1066`); `meetingEnde` (nach Aufgabe 8); `entladen` (HEAD `:1305-1306`); `beenden` (HEAD `:1406-1407`)
- Modify: `apps/connect/src/main/settings.ts:255-261`
- Modify: `apps/connect/src/main/zoom.ts` — Import (HEAD `:23`), `:72`
- Modify: `apps/connect/test/zoom-kern.test.ts` — `BaueOptionen` (nach Aufgabe 8), `:144`, `:216-218`, neuer Block über der Ankerzeile
- Modify: `apps/connect/test/zoom-settings.test.ts:57-58`, `:66-67`

**Interfaces:**
- Consumes: Aufgabe 4 (`ZoomAbbild.versatz.nurSitzung`, `ZoomAbbild.abbauLaeuft`, `TEXT_A4_SCHREIBFEHLER`); Aufgabe 6 (`baueTeilnehmer({ …, sollTon })`, Vorschau mit „(2)“); Aufgabe 1 (`FAKE_ABO_VERZOEGERUNG_MS`, NDI-Name „(2)“); Aufgabe 8 (Wiederbeitritt, `meetingEnde` mit `folgeBeenden`); Aufgabe 10 (`aboFristen` als offene Abos).
- Produces (für die Aufgaben 13, 15 und 18):
  ```ts
  // ZoomKernAbhaengigkeiten.einstellungen
  /** true = in der Einstellungsdatei gespeichert; false = gilt nur für diese Sitzung (Datei nicht schreibbar, L14). */
  setzeVersatzMs(ms: number): boolean;
  /** Der geltende Versatz steht nur im Arbeitsspeicher (N4b.3 Nr. 4). */
  versatzNurSitzung(): boolean;
  // settings.ts
  export function setzeZoomVersatzMs(ms: number): boolean;
  export function zoomVersatzNurSitzung(): boolean;
  // zoom.ts:72 wird zu
  //         setzeVersatzMs: setzeZoomVersatzMs,
  //         versatzNurSitzung: zoomVersatzNurSitzung,
  // versatz(): nur Sitzung → { ok: false, text: TEXT_A4_SCHREIBFEHLER }, videoDelay trotzdem gesendet (L14)
  // abbild().versatz.nurSitzung = einstellungen.versatzNurSitzung()
  ```
  Testgerüst: `BaueOptionen.versatzSpeichernLiefert?: boolean` (Vorgabe true).

**Verhalten (verbindlich):**
- Nr. 6 (L15): `beitreten()` mit eingegebenen Daten leert `hinweise`; `erneut()` behält sie.
- Nr. 7: `entladen()` meldet auch ein gesendetes, noch unbestätigtes Abo (offene `aboFristen`) ab und hebt dessen Frist auf. Ohne Abo geht weiterhin nichts hinaus (sonst `videoNotSubscribed` → Q4).
- Nr. 8 S10 (L13): Die Einrichtung bleibt gesperrt, solange eine gestoppte Bridge abbaut (`stopps.size > 0`); das Abbild zeigt es mit `abbauLaeuft` (Aufgabe 4).
- Nr. 8 Z12: `beenden()` zeigt `verlaesst` nur in einem Meeting-Zustand (Z3–Z11), nicht bei „Einrichtung prüfen“.
- Nr. 8 Z2 (L12): Mit `ended` verwirft der Kern die Quellen der aktiven Generation sofort; jede Kurzform mit `bereit` hat `quellen === 0`.
- Nr. 4 (L14): `versatz()` antwortet bei nicht schreibbarer Datei `{ ok: false, text: TEXT_A4_SCHREIBFEHLER }`, sendet `videoDelay` trotzdem; `abbild().versatz.nurSitzung` sagt es dauerhaft.
- Nr. 2: Ohne eigene Vorwahl zeigt der Ton-Schalter einer Zeile den Ton aus dem Soll-Eintrag gleichen Namens (auch zwischen Abo und `video`-Ereignis und nach „Erneut beitreten“).
- Nr. 1 (L22): Ist die erste Anna geladen, zeigt die Vorschau der zweiten „… (2)“; die Quelle der zweiten heißt so (Attrappe, Aufgabe 1; Vorschau, Aufgabe 6). Hier nur als Kern-Fall festgehalten.

- [ ] **Step 1: Testgerüst — Versatz-Speichern meldet ein Ergebnis**

In `apps/connect/test/zoom-kern.test.ts`:

Vorher:
```ts
  ereignis?: (ev: BridgeEvent, startNr: number) => BridgeEvent;
}
```

Nachher:
```ts
  ereignis?: (ev: BridgeEvent, startNr: number) => BridgeEvent;
  /** Was einstellungen.setzeVersatzMs() meldet; false = Einstellungsdatei nicht schreibbar (nur Sitzung). Vorgabe true. */
  versatzSpeichernLiefert?: boolean;
}
```

Vorher:
```ts
  let sdkSchluesselGeloescht = 0;
  const einst: Probe['einst']
```

Nachher:
```ts
  let sdkSchluesselGeloescht = 0;
  let versatzNurSitzung = false;
  const einst: Probe['einst']
```

Vorher:
```ts
      setzeVersatzMs: (ms) => {
        einst.versatzMs = ms;
      },
```

Nachher:
```ts
      setzeVersatzMs: (ms) => {
        einst.versatzMs = ms;
        versatzNurSitzung = !(o.versatzSpeichernLiefert ?? true);
        return !versatzNurSitzung;
      },
      versatzNurSitzung: () => versatzNurSitzung,
```

- [ ] **Step 2: Fehlschlagende Tests schreiben (Kern)**

Vorher:
```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

Nachher:
```ts
// ── Aufgabe 11 (4b): Randfälle 0.3.0 (N4b.3 Nr. 1, 2, 4, 6, 7, 8) ──────────────
console.log('— Randfälle 0.3.0: Hinweise (Nr. 6), offenes Abo (Nr. 7), Sperre, Z12, Z2 (Nr. 8)');
{
  const p = baueKern({ stell: (n): Record<string, string> => (n === 1 ? { FAKE_ABSTURZ_MS: '300' } : n === 2 ? { FAKE_BEITRITT_SCHEITERT: '63' } : {}) });
  await insMeeting(p);
  ck('Nr. 6: Absturz → R4 unter „Hinweise“, der Versuch scheitert endgültig → fehler', await bis(() => p.kern.kurz().zustand === 'fehler', 4000)
    && p.kern.abbild().hinweise.length === 1 && p.kern.abbild().hinweise[0].startsWith('Die Zoom-Bridge ist abgestürzt ('));
  ck('… erneut() behält die Hinweise (L15)', ok(await p.kern.erneut()) && (await bis(() => p.kern.kurz().zustand === 'im_meeting', 4000))
    && p.kern.abbild().hinweise.length === 1);
  await p.kern.verlassen();
  ck('… ein neuer Beitritt mit eingegebenen Daten leert sie',
    ok(await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' })) && p.kern.abbild().hinweise.length === 0);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_ABO_VERZOEGERUNG_MS: '500' }), fristen: { aboAntwortMs: 800 } });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  ck('Nr. 7: Entladen bei offenem Abo → ok', ok(await p.kern.entladen({ aboId: ANNA })));
  ck('… videoUnsubscribe geht hinaus', await bis(() => p.befehle(1).some((c) => c.cmd === 'videoUnsubscribe' && c.id === ANNA), 2000));
  await warte(1000);
  ck('… am Ende keine Quelle, kein Q8, Soll-Liste leer, nie subscribed', p.kern.kurz().quellen === 0 && zeile(p, ANNA)?.fehler === null
    && p.kern.abbild().soll.length === 0 && !p.ereignisse.some((x) => x.ev.ev === 'video' && (x.ev as { state?: string }).state === 'subscribed'));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_MEETING_ENDE_MS: '400', FAKE_ABGANG_MS: '600' }) });
  await insMeeting(p);
  ck('Nr. 8 (S10 im Abbau): nach dem Meeting-Ende bereit, die Bridge baut noch ab',
    await bis(() => p.kern.kurz().zustand === 'bereit', 3000) && p.kern.laeuft() && p.kern.abbild().abbauLaeuft);
  ck('… Zugangsdaten entfernen → S10, Zugang unverändert', text(p.kern.zugangLoeschen()) === KT.S10
    && p.kern.abbild().einrichtung.zugang.herkunft === 'stored');
  ck('… nach dem Abbau wieder frei', await bis(() => !p.kern.laeuft(), 3000) && !p.kern.abbild().abbauLaeuft && p.kern.einrichtungSperre().ok);
  await p.aufraeumen();
}
{
  const p = baueKern({ skript: 'envprobe', fristen: { anmeldeMs: 20_000 } });
  const lauf = p.kern.pruefen();
  ck('Nr. 8 (Z12 nur mit Meeting): „Einrichtung prüfen“ hängt vor ready', await bis(() => p.starts() === 1 && p.kern.abbild().pruefungLaeuft, 2000));
  await p.kern.beenden(1000);
  ck('… beenden zeigt nie verlaesst', !folge(p).includes('verlaesst') && !p.kurze.some((k) => zoomZ(k) === 'Z12'));
  ck('… die Prüfung liefert ok:false ohne Text, nichts läuft', text(await lauf) === '' && !p.kern.laeuft());
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_MEETING_ENDE_MS: '600' }) });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  ck('Nr. 8 (Z2 nach Meeting-Ende): Anna geladen, dann bereit', (await bis(() => p.kern.kurz().quellen === 1))
    && (await bis(() => p.kern.kurz().zustand === 'bereit', 3000)));
  const bereit = p.kurze.filter((k) => k.zustand === 'bereit');
  ck('… jede Kurzform mit Zustand bereit hat 0 Quellen (L12)', bereit.length > 0 && bereit.every((k) => k.quellen === 0));
  await p.aufraeumen();
}

console.log('— Randfälle 0.3.0: Versatz nur Sitzung (Nr. 4), Ton aus dem Soll (Nr. 2), Doppelname (Nr. 1)');
{
  const p = baueKern({ versatzSpeichernLiefert: false });
  await insMeeting(p);
  const r = p.kern.versatz({ ms: 250 });
  ck('Nr. 4: Datei nicht schreibbar → Antwort TEXT_A4_SCHREIBFEHLER', text(r) === TEXT_A4_SCHREIBFEHLER);
  ck('… videoDelay trotzdem gesendet und bestätigt', await bis(() => p.kern.abbild().versatz.bestaetigtMs === 250, 2000)
    && p.befehle(1).filter((c) => c.cmd === 'videoDelay').at(-1)?.ms === 250);
  ck('… das Abbild sagt „nur für diese Sitzung“, der Wert gilt', p.kern.abbild().versatz.nurSitzung && p.kern.abbild().versatz.gewuenschtMs === 250);
  await p.aufraeumen();
}
{
  const p = baueKern();
  ck('… Datei schreibbar → ok, nurSitzung false', ok(p.kern.versatz({ ms: 100 })) && !p.kern.abbild().versatz.nurSitzung);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: (n): Record<string, string> => (n === 1 ? { FAKE_VERBINDUNG_WEG_MS: '600' } : { FAKE_ABO_VERZOEGERUNG_MS: '800' }) });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: false, trotzBetriebsgroesse: false });
  ck('Nr. 2: Anna ohne Ton geladen, dann Abriss', (await bis(() => p.kern.kurz().quellen === 1)) && (await bis(() => p.kern.kurz().versuch === 1, 3000)));
  ck('… nach dem Wiederbeitritt, vor dem video-Ereignis: Annas Schalter zeigt „ohne Ton“', await bis(() => p.kern.kurz().zustand === 'im_meeting', 4000)
    && (await bis(() => p.befehle(2).some((c) => c.cmd === 'videoSubscribe' && c.id === ANNA), 2000))
    && zeile(p, ANNA)?.quelle === null && zeile(p, ANNA)?.tonVorwahl === false);
  ck('… Ben ohne Soll-Eintrag zeigt die Vorgabe „mit Ton“', zeile(p, BEN)?.tonVorwahl === true);
  await p.aufraeumen();
}
{
  const p = baueKern({
    stell: (n): Record<string, string> => (n === 1 ? { FAKE_VERBINDUNG_WEG_MS: '600' } : n === 2 ? { FAKE_BEITRITT_SCHEITERT: '63' } : { FAKE_ABO_VERZOEGERUNG_MS: '800' }),
  });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: false, trotzBetriebsgroesse: false });
  ck('… ebenso nach „Erneut beitreten“: fehler mit gemerkter Anna', await bis(() => p.kern.kurz().zustand === 'fehler', 4000) && p.kern.abbild().soll.length === 1);
  ck('… nach erneut(), vor dem video-Ereignis: „ohne Ton“', ok(await p.kern.erneut()) && (await bis(() => p.kern.kurz().zustand === 'im_meeting', 4000))
    && (await bis(() => p.befehle(3).some((c) => c.cmd === 'videoSubscribe' && c.id === ANNA), 2000))
    && zeile(p, ANNA)?.quelle === null && zeile(p, ANNA)?.tonVorwahl === false);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_DOPPELNAME: '1' }) });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  ck('Nr. 1: erste Anna geladen, die Vorschau der zweiten endet auf „ (2)“',
    await bis(() => zeile(p, ANNA)?.quelle?.ndiName === 'JM Connect – Zoom Anna') && zeile(p, BEN)?.ndiNameVorschau === 'JM Connect – Zoom Anna (2)');
  await p.kern.laden({ id: BEN, ton: true, trotzBetriebsgroesse: false });
  ck('… beide geladen: die Quelle der zweiten heißt „… Anna (2)“', await bis(() => zeile(p, BEN)?.quelle?.ndiName === 'JM Connect – Zoom Anna (2)'));
  await p.aufraeumen();
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

- [ ] **Step 3: Fehlschlagende Tests schreiben (Einstellungen)**

In `apps/connect/test/zoom-settings.test.ts`:

Vorher:
```ts
s.setzeZoomVersatzMs(300);
ck('Set: Versatz nach gescheitertem Schreiben = neuer Wert', s.zoomVersatzMs() === 300);
```

Nachher:
```ts
const versatzGespeichert = s.setzeZoomVersatzMs(300);
ck('Set: Versatz nach gescheitertem Schreiben = neuer Wert', s.zoomVersatzMs() === 300);
ck('Set: … setzeZoomVersatzMs meldet false, der Versatz gilt nur für diese Sitzung (N4b.3 Nr. 4)',
  versatzGespeichert === false && s.zoomVersatzNurSitzung());
```

Vorher:
```ts
s.setzeZoomVersatzMs(50); s.setzeZoomAnzeigename('Platte');
ck('Set: Schreiben ok → Platte gilt', s.zoomVersatzMs() === 50 && s.zoomAnzeigename() === 'Platte');
```

Nachher:
```ts
const wiederGespeichert = s.setzeZoomVersatzMs(50); s.setzeZoomAnzeigename('Platte');
ck('Set: Schreiben ok → Platte gilt', s.zoomVersatzMs() === 50 && s.zoomAnzeigename() === 'Platte');
ck('Set: … setzeZoomVersatzMs meldet true, nicht mehr nur Sitzung', wiederGespeichert === true && !s.zoomVersatzNurSitzung());
```

- [ ] **Step 4: Tests laufen lassen (rot)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: `529 ok, 10 fehlgeschlagen, 0 übersprungen.`, Exit-Code 1. Die erste `FAIL`-Zeile:
```
FAIL  … ein neuer Beitritt mit eingegebenen Daten leert sie
```
Weitere: Nr. 7 (2), S10 (1: „… Zugangsdaten entfernen → S10 …“), Z12 (1), Z2 (1), Nr. 4 (2), Nr. 2 (2). Schon grün: Nr. 1 (Doppelname „(2)“ liefern die Aufgaben 1 und 6) und „… Datei schreibbar → ok, nurSitzung false“.

```
npx tsx apps/connect/test/zoom-settings.test.ts
```
Erwartet: `33 ok, 2 fehlgeschlagen.` (die beiden neuen Prüfungen).

- [ ] **Step 5: `settings.ts` — Speichern meldet, ob die Datei geschrieben wurde**

In `apps/connect/src/main/settings.ts`:

Vorher:
```ts
export function setzeZoomVersatzMs(ms: number): void {
  const v = gueltigerVersatz(ms);
  if (v === null) return; // der Kern prüft vorher (Q13)
  const next = read();
  next.zoomVersatzMs = v;
  zoomVersatzSitzung = write(next) ? null : v;
}
```

Nachher:
```ts
/** true = in connect-settings.json gespeichert; false = nur für diese Sitzung (Datei nicht schreibbar) oder ungültig. */
export function setzeZoomVersatzMs(ms: number): boolean {
  const v = gueltigerVersatz(ms);
  if (v === null) return false; // der Kern prüft vorher (Q13)
  const next = read();
  next.zoomVersatzMs = v;
  const gespeichert = write(next);
  zoomVersatzSitzung = gespeichert ? null : v;
  return gespeichert;
}

/** Der geltende Versatz steht nur im Arbeitsspeicher (N4b.3 Nr. 4). */
export function zoomVersatzNurSitzung(): boolean {
  return zoomVersatzSitzung !== null;
}
```

- [ ] **Step 6: `zoom.ts` — die Hülle reicht beides an den Kern**

In `apps/connect/src/main/zoom.ts`:

Vorher:
```ts
  zoomVersatzMs,
  zoomZugangLesen,
```

Nachher:
```ts
  zoomVersatzMs,
  zoomVersatzNurSitzung,
  zoomZugangLesen,
```

Vorher:
```ts
        setzeVersatzMs: setzeZoomVersatzMs,
```

Nachher:
```ts
        setzeVersatzMs: setzeZoomVersatzMs,
        versatzNurSitzung: zoomVersatzNurSitzung,
```

- [ ] **Step 7: `kern.ts` — Abhängigkeit, Versatz, Abbild**

In `apps/connect/src/main/zoom/kern.ts`:

Vorher:
```ts
    versatzMs(): number;
    setzeVersatzMs(ms: number): void;
```

Nachher:
```ts
    versatzMs(): number;
    /** true = in der Einstellungsdatei gespeichert; false = gilt nur für diese Sitzung (Datei nicht schreibbar, L14). */
    setzeVersatzMs(ms: number): boolean;
    /** Der geltende Versatz steht nur im Arbeitsspeicher (N4b.3 Nr. 4). */
    versatzNurSitzung(): boolean;
```

Vorher:
```ts
    d.einstellungen.setzeVersatzMs(e.ms);
    sende({ cmd: 'videoDelay', ms: e.ms });
    abbildGeaendert();
    return { ok: true };
```

Nachher:
```ts
    const gespeichert = d.einstellungen.setzeVersatzMs(e.ms);
    sende({ cmd: 'videoDelay', ms: e.ms });
    abbildGeaendert();
    // L14: nur für diese Sitzung gemerkt → ehrliche Antwort (Muster „Entfernen“); der Versatz gilt trotzdem.
    return gespeichert ? { ok: true } : { ok: false, text: TEXT_A4_SCHREIBFEHLER };
```

Vorher (Zeile aus Aufgabe 4, gekürzt auf den eindeutigen Teil):
```ts
bestaetigtMs: aktiveSitzung()?.videoDelayMs ?? null, nurSitzung: false },
```

Nachher:
```ts
bestaetigtMs: aktiveSitzung()?.videoDelayMs ?? null, nurSitzung: d.einstellungen.versatzNurSitzung() },
```

- [ ] **Step 8: `kern.ts` — Ton aus dem Soll, Sperre im Abbau**

Vorher:
```ts
    return baueTeilnehmer({ liste: [...s.participants.values()], quellen: aktiveQuellen(), tonVorwahl, zeilenFehler, gastLabels: d.gastLabels() });
```

Nachher:
```ts
    return baueTeilnehmer({
      liste: [...s.participants.values()],
      quellen: aktiveQuellen(),
      tonVorwahl,
      zeilenFehler,
      gastLabels: d.gastLabels(),
      // N4b.3 Nr. 2: ohne eigene Vorwahl zeigt der Schalter den Ton, mit dem der Abgleich lädt.
      sollTon: (name) => soll.get(normName(name))?.ton,
    });
```

Vorher:
```ts
    const frei = ladeLauf === null
      && ((zustand === 'einrichtung' && kopie === null) || (zustand === 'bereit' && !pruefungLaeuft) || zustand === 'fehler');
```

Nachher:
```ts
    // N4b.3 Nr. 8, L13: auch solange eine gestoppte Bridge noch abbaut (stopps), bleibt die Einrichtung gesperrt.
    const frei = ladeLauf === null && stopps.size === 0
      && ((zustand === 'einrichtung' && kopie === null) || (zustand === 'bereit' && !pruefungLaeuft) || zustand === 'fehler');
```

- [ ] **Step 9: `kern.ts` — Hinweise beim Beitritt, Quellen beim Meeting-Ende, offenes Abo, Z12**

Vorher:
```ts
    soll.clear();
    return starteBeitritt();
  }
```

Nachher:
```ts
    soll.clear();
    // N4b.3 Nr. 6, L15: Hinweise gehören zum letzten Meeting; „Erneut beitreten“ behält sie.
    hinweise.length = 0;
    return starteBeitritt();
  }
```

Vorher:
```ts
    folgeBeenden();
    void stoppeBridge();
    soll.clear();
    melde('warnung', m);
```

Nachher:
```ts
    folgeBeenden();
    void stoppeBridge();
    // L12: Mit ended sind die Quellen der aktiven Generation weg (n = 0 in Z2); die Bridge baut sie ohnehin selbst ab.
    for (const [id, q] of quellen) if (q.gen === aktiveGen) quellen.delete(id);
    soll.clear();
    melde('warnung', m);
```

Vorher:
```ts
    const q = quellen.get(e.aboId);
    const gesendet = q !== undefined && q.gen === aktiveGen && sende({ cmd: 'videoUnsubscribe', id: e.aboId });
```

Nachher:
```ts
    const q = quellen.get(e.aboId);
    // N4b.3 Nr. 7: auch ein gesendetes, noch unbestätigtes Abo (offene Frist) abmelden. Ohne Abo nichts senden (sonst Q4).
    const offen = aboFristen.has(e.aboId);
    const gesendet = ((q !== undefined && q.gen === aktiveGen) || offen) && sende({ cmd: 'videoUnsubscribe', id: e.aboId });
    if (offen) aboBeantwortet(e.aboId);
```

Vorher:
```ts
      if (aktiveBridge !== null) {
        setzeZustand('verlaesst');
```

Nachher:
```ts
      if (aktiveBridge !== null) {
        // N4b.3 Nr. 8: Z12 („verlässt das Meeting …“) nur mit Meeting, nicht bei „Einrichtung prüfen“.
        const imMeetingZustand = zustand === 'startet' || zustand === 'tritt_bei' || zustand === 'warteraum' || zustand === 'im_meeting' || zustand === 'abriss';
        if (imMeetingZustand) setzeZustand('verlaesst');
```

- [ ] **Step 10: Tests laufen lassen (grün)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
npx tsx apps/connect/test/zoom-settings.test.ts
```
Erwartet: `539 ok, 0 fehlgeschlagen, 0 übersprungen.` und `35 ok, 0 fehlgeschlagen.`, je Exit-Code 0.

- [ ] **Step 11: Typen prüfen**

```
npm run typecheck -w @jm/connect
```
Erwartet: Exit-Code 0 (prüft auch `zoom.ts` gegen die neue Abhängigkeit).

- [ ] **Step 12: Commit** (Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add apps/connect/src/main/zoom/kern.ts apps/connect/src/main/settings.ts apps/connect/src/main/zoom.ts apps/connect/test/zoom-kern.test.ts apps/connect/test/zoom-settings.test.ts
git status --short
```
Die gestagten Zeilen müssen genau diese sein:
```
M  apps/connect/src/main/settings.ts
M  apps/connect/src/main/zoom.ts
M  apps/connect/src/main/zoom/kern.ts
M  apps/connect/test/zoom-kern.test.ts
M  apps/connect/test/zoom-settings.test.ts
```
```
git commit -m "fix(connect): Randfaelle 0.3.0 im Zoom-Kern (Hinweise, offenes Abo, Sperre im Abbau, Versatz nur Sitzung, Ton aus dem Soll)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Nicht pushen (G13).

**Gegenprobe:** Jeder neue Zweig ist durch seinen Rot-Lauf belegt (Step 4: zehn `FAIL`, je Randfall mindestens eines); der Rückbau einzelner Zeilen führt genau zu diesen `FAIL`-Zeilen zurück.

**Abweichungen von der Gliederung:**
- **Nr. 2 nur über `sollTon`** (`teilnehmerAbbild`), ohne `tonVorwahl.set` in `abonniere`. Beide gemessenen Lagen (Wiederbeitritt und „Erneut beitreten“, jeweils vor dem `video`-Ereignis) deckt `sollTon` ab; ein zusätzliches `tonVorwahl.set` hätte keine prüfbare Wirkung.
- **`zoom-settings.test.ts` ist zusätzlich berührt** (zwei Prüfungen für `setzeZoomVersatzMs` und `zoomVersatzNurSitzung`), weil `settings.ts` sich ändert.
- **Nr. 1 ist vor der Umsetzung schon grün** (Aufgaben 1 und 6); der Kern-Fall hält es fest.
- **Hinweise leeren nur bei `beitreten()`** (L15), nicht bei Verlassen oder Meeting-Ende.

### Task 12: Kern: Logzeilen ohne Teilnehmernamen (N4b.2, Connect-Teil)

**Spec:** N4b.2 („Keine Namen im Log“, Tests; „Der Plan sucht alle Stellen“), 8.7, L11, G5.

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\zoom-4b`

**Files:**
- Modify: `apps/connect/src/main/zoom/kern.ts` (Stand nach Aufgabe 11) — Import (HEAD `:60`); neuer Speicher nach `aboFristen` (HEAD `:278`); `hinweis` (HEAD `:404-408`); `beiLog` (HEAD `:762-764`) mit neuem `namenMerken`; `beiEreignis` (HEAD `:955-956`); `quellenFehlerEreignis` (HEAD `:1260-1265`); `beenden` (HEAD `:1410-1413`)
- Modify: `apps/connect/src/utility/ndi-program-receiver.ts:78-85` (Diagnose „nicht gefunden“: Quellen von JM Connect nur als Anzahl), `apps/connect/src/utility/ndi-guest-sender.ts:59` (Logzeile ohne Sendernamen) — Nachbesserung, siehe Verhalten
- Modify: `apps/connect/test/zoom-kern.test.ts` — Importe `:6` (`readdirSync`) und (nach Aufgabe 8) Klartext, neuer Block über der Ankerzeile

**Interfaces:**
- Consumes: Aufgabe 5 (`maskiereNamen(zeile, namen)` mit „‹Name›“, `quellenFehler(…, id).logText`); Aufgabe 1 (`FAKE_NAMENSZEILE`, `FAKE_PUFFERFEHLER_MS`); Aufgabe 8 (Wiederbeitritt, R4/R5 ohne Namen).
- Produces (für Aufgabe 13):
  ```ts
  /** Das Abbild bekommt `text`, das Log `logText` (N4b.2: dort nie ein Teilnehmername). */
  function hinweis(text: string, logText = text): void;
  /** L11: Anzeigenamen fremder Teilnehmer, die der Kern in dieser Programmsitzung gesehen hat; nur im Arbeitsspeicher. */
  const gesehenNamen: Set<string>;
  ```
  Testhilfe (`zoom-kern.test.ts`, für Aufgabe 13): `keinTeilnehmernameImLog(p, namen)` und `ATTRAPPEN_NAMEN`.

**Verhalten (verbindlich):**
- Jede stderr-Zeile der Bridge läuft erst durch `maskiereNamen` mit allen Namen, die der Kern in dieser Programmsitzung aus `roster`, `joined` und `renamed` gesehen hat (jede Generation, ohne die eigene Zeile), dann wie bisher durch `maskiere` (Nummer, Kenncode, JWT). `beenden()` leert die Namen am Schluss.
- Q16/Q17 stehen mit dem Namen unter „Hinweise“, im Log mit der Teilnehmer-Kennung (`logText` aus Aufgabe 5).
- Der eigene Anzeigename bleibt im Log („Beitritt gestartet (Anzeigename „JM Connect“)“, Spec 8.7).
- Karte und Abbild zeigen die Namen weiter.
- Nachbesserung (Review, Stellensuche N4b.2): Auch die beiden Utility-Prozesse schreiben über `ndi-program.ts:52-58` bzw. `ndi-guests.ts:52-58` ins `main.log`. Der Programm-Empfänger listete bei nicht gefundener Programmquelle **alle** gesehenen NDI-Quellen, also auch „… (JM Connect – Zoom <Name>)“ jeder geladenen Zoom-Quelle und „… (JM Connect – <Gast>)“, und das bei jedem „Raum öffnen“ und jeder Änderung der Liste. Jetzt nennt er nur fremde Quellen und von JM Connect die Anzahl; die Programmquelle (JM Switcher, vMix …) heißt nie „JM Connect – “. Der Gast-Sender loggt „NDI-Sender aktiv.“ ohne seinen Namen; die Kennung steht schon im Präfix `[guest-sender <key>]`. Ein Quelltext-Wächter hält beides fest (die Utility-Dateien laden `@jm/ndi` und `process.parentPort` und lassen sich im Test nicht ausführen).

- [ ] **Step 1: Fehlschlagende Tests schreiben**

In `apps/connect/test/zoom-kern.test.ts`:

Vorher:
```ts
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
```

Nachher:
```ts
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
```

Vorher:
```ts
import { failText, KT, VORSATZ } from '../src/main/zoom/klartext';
```

Nachher:
```ts
import { failText, KT, quellenFehler, VORSATZ } from '../src/main/zoom/klartext';
```

Vorher:
```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

Nachher:
```ts
// ── Aufgabe 12 (4b): Logzeilen ohne Teilnehmernamen (N4b.2, L11) ─────────────
/** N4b.2: true, wenn keine Logzeile einen dieser Namen als ganzes Wort enthält (ohne Groß-/Kleinschreibung). */
function keinTeilnehmernameImLog(p: Probe, namen: readonly string[]): boolean {
  return !p.logs.some((z) => namen.some((n) => new RegExp(`(?<![\\p{L}\\p{N}])${n}(?![\\p{L}\\p{N}])`, 'iu').test(z)));
}
/** Die Namen der Attrappe (fake-bridge.mjs, Drehbuch steuerung). */
const ATTRAPPEN_NAMEN = ['Anna', 'Ben', 'Carla', 'Dora', 'Emil', 'Frieda'];

console.log('— Logzeilen ohne Teilnehmernamen (N4b.2, L11)');
{
  const p = baueKern({ stell: () => ({ FAKE_NAMENSZEILE: '1' }) });
  await insMeeting(p);
  ck('Namensprobe der Bridge erscheint maskiert: „Namensprobe: ‹Name›, ‹Name›“',
    await bis(() => p.logs.includes('[zoom-bridge] Namensprobe: ‹Name›, ‹Name›'), 2000));
  ck('… keine Logzeile nennt einen Teilnehmernamen', keinTeilnehmernameImLog(p, ATTRAPPEN_NAMEN));
  ck('… der eigene Anzeigename bleibt im Log', p.logs.includes('[zoom] Beitritt gestartet (Anzeigename „JM Connect“)'));
  ck('… Karte und Abbild behalten die Namen', zeile(p, ANNA)?.name === 'Anna' && zeile(p, BEN)?.name === 'Ben');
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_PUFFERFEHLER_MS: '200' }) });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  ck('Q16/Q17: beide Hinweise mit dem Namen im Abbild', await bis(() => p.kern.abbild().hinweise.length === 2, 2000)
    && p.kern.abbild().hinweise.includes(KT.Q16('Anna')) && p.kern.abbild().hinweise.includes(KT.Q17('Anna')));
  const q16 = quellenFehler('videoBufferMismatch', 'VIDEO_BUFFER_MISMATCH', 'Anna', undefined, ANNA);
  const q17 = quellenFehler('audioBufferMismatch', 'AUDIO_BUFFER_MISMATCH', 'Anna', undefined, ANNA);
  ck('… im Log mit der Kennung statt des Namens', q16.art === 'hinweis' && q17.art === 'hinweis'
    && p.logs.includes(`[zoom] Hinweis: ${q16.logText}`) && p.logs.includes(`[zoom] Hinweis: ${q17.logText}`)
    && keinTeilnehmernameImLog(p, ATTRAPPEN_NAMEN));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_WIEDERBEITRITT_MS: '600', FAKE_RUECKKEHR_MS: '200', FAKE_RUECKKEHR_NAME: 'anna', FAKE_NAMENSZEILE: '1' }) });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  ck('Teilnehmer-Rückkehr („anna“ wird neu geladen): kein Name im Log',
    await bis(() => p.befehle(1).some((c) => c.cmd === 'videoSubscribe' && c.id === 16778250), 3000)
    && keinTeilnehmernameImLog(p, [...ATTRAPPEN_NAMEN, 'anna']));
  await p.aufraeumen();
}
{
  const DORA = 16778243;
  const p = baueKern({
    stell: (n): Record<string, string> => (n === 1
      ? { FAKE_VERBINDUNG_WEG_MS: '800', FAKE_TEILNEHMER: '4', FAKE_NAMENSZEILE: '1' }
      : { FAKE_DOPPELNAME: '1', FAKE_TEILNEHMER: '4', FAKE_NAMENSZEILE: '1' }),
  });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  await p.kern.laden({ id: CARLA, ton: false, trotzBetriebsgroesse: false });
  await p.kern.laden({ id: DORA, ton: true, trotzBetriebsgroesse: false });
  ck('Wiederbeitritt (Aufbau Fall 15): R5 erscheint', await bis(() => p.kern.abbild().hinweise.includes(KT.R5(2, 1)), 6000));
  ck('… kein Teilnehmername im Log, auch nicht aus der zweiten Bridge', p.logs.some((z) => z.startsWith('[zoom-bridge] Namensprobe: ‹Name›, ‹Name›, ‹Name›, ‹Name›'))
    && keinTeilnehmernameImLog(p, ATTRAPPEN_NAMEN));
  await p.aufraeumen();
}
{
  // Die Utility-Prozesse (NDI-Gast-Sender, Programm-Empfänger) schreiben über ndi-guests.ts bzw. ndi-program.ts ins main.log.
  // Sie laden @jm/ndi und process.parentPort und lassen sich hier nicht ausführen: Geprüft wird ihr Quelltext.
  const utility = new URL('../src/utility/', import.meta.url);
  const logZeilen = readdirSync(utility).filter((n) => n.endsWith('.ts')).flatMap((n) => readFileSync(new URL(n, utility), 'utf8')
    .split(/\r?\n/).filter((z) => /console\.(log|warn|error)\(/.test(z)).map((z) => `${n}: ${z.trim()}`));
  const verdaechtig = logZeilen.filter((z) => /\bd\.name\b|\blabel\b|\bseen\b|\[\.\.\./.test(z));
  ck('Quelltext-Wächter (N4b.2): keine Logzeile der Utility-Prozesse nennt einen Sender- oder Quellnamen', logZeilen.length > 10 && verdaechtig.length === 0);
  if (verdaechtig.length > 0) console.log(`      Treffer: ${verdaechtig.join(' / ')}`);
  const empfaenger = readFileSync(new URL('ndi-program-receiver.ts', utility), 'utf8');
  ck('… der Programm-Empfänger lässt Quellen von JM Connect aus seiner Diagnose (nur die Anzahl)',
    empfaenger.includes(".filter((s) => !s.includes('JM Connect – '))"));
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: `543 ok, 7 fehlgeschlagen, 0 übersprungen.`, Exit-Code 1. Die erste `FAIL`-Zeile:
```
FAIL  Namensprobe der Bridge erscheint maskiert: „Namensprobe: ‹Name›, ‹Name›“
```
Weitere: „… keine Logzeile nennt einen Teilnehmernamen“, „… im Log mit der Kennung statt des Namens“, „Teilnehmer-Rückkehr …“, „… kein Teilnehmername im Log, auch nicht aus der zweiten Bridge“, „Quelltext-Wächter (N4b.2): keine Logzeile der Utility-Prozesse …“ (mit `Treffer: ndi-guest-sender.ts: console.log('[ndi-guest-sender] NDI-Sender aktiv:', d.name);`) und „… der Programm-Empfänger lässt Quellen von JM Connect aus seiner Diagnose (nur die Anzahl)“.

- [ ] **Step 3: `kern.ts` — Import, Namensspeicher, `hinweis` mit Logtext**

In `apps/connect/src/main/zoom/kern.ts`:

Vorher:
```ts
  maskiere,
  quellenFehler,
```

Nachher:
```ts
  maskiere,
  maskiereNamen,
  quellenFehler,
```

Vorher:
```ts
  const aboFristen = new Map<number, ReturnType<typeof setTimeout>>();
```

Nachher:
```ts
  const aboFristen = new Map<number, ReturnType<typeof setTimeout>>();
  /** L11: Anzeigenamen fremder Teilnehmer, die der Kern in dieser Programmsitzung gesehen hat; nur im Arbeitsspeicher. */
  const gesehenNamen = new Set<string>();
```

Vorher:
```ts
  function hinweis(text: string): void {
    hinweise.push(text);
    while (hinweise.length > HINWEISE_MAX) hinweise.shift();
    d.log(`[zoom] Hinweis: ${text}`);
  }
```

Nachher:
```ts
  /** Das Abbild bekommt `text`, das Log `logText` (N4b.2: dort nie ein Teilnehmername). */
  function hinweis(text: string, logText = text): void {
    hinweise.push(text);
    while (hinweise.length > HINWEISE_MAX) hinweise.shift();
    d.log(`[zoom] Hinweis: ${logText}`);
  }
```

- [ ] **Step 4: `kern.ts` — Bridge-Zeilen maskieren, Namen merken**

Vorher:
```ts
  function beiLog(zeile: string): void {
    d.log(`[zoom-bridge] ${maskiere(zeile, geheimnisse())}`);
  }
```

Nachher:
```ts
  function beiLog(zeile: string): void {
    // N4b.2, L11: erst die Namen der Teilnehmer (‹Name›), dann Nummer, Kenncode und JWT (•••).
    d.log(`[zoom-bridge] ${maskiere(maskiereNamen(zeile, [...gesehenNamen]), geheimnisse())}`);
  }

  /** L11: Namen aus roster, joined und renamed merken (jede Generation), die eigene Zeile nicht. */
  function namenMerken(ev: BridgeEvent): void {
    const e = ev as unknown as { list?: Array<{ name: string; self: boolean }>; p?: { name: string; self: boolean }; name?: unknown };
    if (ev.ev === 'roster') {
      for (const t of e.list ?? []) if (!t.self) gesehenNamen.add(t.name);
    } else if (ev.ev === 'joined') {
      if (e.p && !e.p.self) gesehenNamen.add(e.p.name);
    } else if (ev.ev === 'renamed') {
      if (typeof e.name === 'string') gesehenNamen.add(e.name);
    }
  }
```

Vorher:
```ts
  function beiEreignis(gen: number, ev: BridgeEvent): void {
    const aktiv = gen === aktiveGen && !imAbbau.has(gen);
```

Nachher:
```ts
  function beiEreignis(gen: number, ev: BridgeEvent): void {
    namenMerken(ev);
    const aktiv = gen === aktiveGen && !imAbbau.has(gen);
```

- [ ] **Step 5: `kern.ts` — Q16/Q17 mit Kennung ins Log, Namen beim Beenden vergessen**

Vorher:
```ts
    const einordnung = quellenFehler(String(e.code), e.name ?? String(e.code), person, e.dropped);
    if (einordnung.art === 'keine') return;
    if (einordnung.art === 'hinweis' || id === null) {
      hinweis(einordnung.text);
      return;
    }
```

Nachher:
```ts
    const einordnung = quellenFehler(String(e.code), e.name ?? String(e.code), person, e.dropped, id ?? undefined);
    if (einordnung.art === 'keine') return;
    // N4b.2: Q16/Q17 zeigen den Namen unter „Hinweise“, das Log nennt nur die Kennung (logText).
    if (einordnung.art === 'hinweis') {
      hinweis(einordnung.text, einordnung.logText);
      return;
    }
    if (id === null) {
      hinweis(einordnung.text);
      return;
    }
```

Vorher:
```ts
      soll.clear();
      nummer = null;
      kenncode = null;
      abbildGeaendert();
    })();
    return beendenVersprechen;
```

Nachher:
```ts
      soll.clear();
      nummer = null;
      kenncode = null;
      gesehenNamen.clear();
      abbildGeaendert();
    })();
    return beendenVersprechen;
```

- [ ] **Step 6: Utility-Prozesse — keine Sender- und Quellnamen im Log** (`apps/connect/src/utility/ndi-program-receiver.ts`, Zeilen 78–85)

Vorher:
```ts
  // Diagnose: ALLE gesehenen NDI-Quellnamen ausgeben (damit ein Namens-Mismatch sichtbar wird).
  const list = [...seen].sort().join(' | ') || '(keine)';
  const now = Date.now();
  if (list !== lastMissSeen || now - lastMissAt >= MISS_LOG_GAP_MS) {
    lastMissSeen = list;
    lastMissAt = now;
    console.log(`[ndi-program-receiver] Hinweis „${nameHint}" nicht gefunden. Gesehene NDI-Quellen:`, list);
  }
```

Nachher:
```ts
  // Diagnose: die gesehenen NDI-Quellnamen ausgeben (damit ein Namens-Mismatch sichtbar wird), aber nur fremde. Quellen
  // von JM Connect („… (JM Connect – Zoom <Name>)“, „… (JM Connect – <Gast>)“) tragen Teilnehmer- und Gastnamen und
  // sind nie die Programmquelle: von ihnen steht nur die Anzahl im Log (Spec Zoom Stage 4, N4b.2).
  const fremde = [...seen].filter((s) => !s.includes('JM Connect – ')).sort();
  const eigene = seen.size - fremde.length;
  const anzeige = `${fremde.join(' | ') || '(keine)'}${eigene > 0 ? ` (dazu ${eigene} von JM Connect, ohne Namen)` : ''}`;
  const now = Date.now();
  if (anzeige !== lastMissSeen || now - lastMissAt >= MISS_LOG_GAP_MS) {
    lastMissSeen = anzeige;
    lastMissAt = now;
    console.log(`[ndi-program-receiver] Hinweis „${nameHint}" nicht gefunden. Gesehene NDI-Quellen:`, anzeige);
  }
```

Datei `apps/connect/src/utility/ndi-guest-sender.ts` (Zeile 59). Vorher:
```ts
      console.log('[ndi-guest-sender] NDI-Sender aktiv:', d.name);
```

Nachher:
```ts
      // N4b.2: Der Sendername trägt den Gastnamen. Die Kennung steht schon im Präfix, das ndi-guests.ts voranstellt.
      console.log('[ndi-guest-sender] NDI-Sender aktiv.');
```

- [ ] **Step 7: Test laufen lassen (grün)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: `550 ok, 0 fehlgeschlagen, 0 übersprungen.`, Exit-Code 0.

- [ ] **Step 8: Typen prüfen**

```
npm run typecheck -w @jm/connect
```
Erwartet: Exit-Code 0.

- [ ] **Step 9: Commit** (Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add apps/connect/src/main/zoom/kern.ts apps/connect/src/utility/ndi-program-receiver.ts apps/connect/src/utility/ndi-guest-sender.ts apps/connect/test/zoom-kern.test.ts
git status --short
```
Die gestagten Zeilen müssen genau diese sein:
```
M  apps/connect/src/main/zoom/kern.ts
M  apps/connect/src/utility/ndi-guest-sender.ts
M  apps/connect/src/utility/ndi-program-receiver.ts
M  apps/connect/test/zoom-kern.test.ts
```
```
git commit -m "feat(connect): Logs ohne Teilnehmer- und Gastnamen (Kennung statt Name, Maskierung der Bridge-Zeilen, NDI-Utility-Prozesse)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Nicht pushen (G13).

**Gegenprobe (beim Planen gemessen):** `beiLog` ohne `maskiereNamen` → `546 ok, 4 fehlgeschlagen` (Namensprobe ×2, Teilnehmer-Rückkehr, Wiederbeitritt). Im Programm-Empfänger den Filter wieder entfernen (`const fremde = [...seen].sort();`) → `549 ok, 1 fehlgeschlagen` („… der Programm-Empfänger lässt Quellen von JM Connect aus seiner Diagnose (nur die Anzahl)“). Rückbau byte-gleich.

**Abweichungen von der Gliederung:**
- **`gesehenNamen` nur aus `roster`, `joined` und `renamed`**, nicht zusätzlich aus der Soll-Liste: Jeder Soll-Eintrag stammt aus einem dieser Ereignisse.
- **Teilnehmer-Rückkehr und Wiederbeitritt laufen mit `FAKE_NAMENSZEILE=1`.** Ohne eine Bridge-Zeile mit Namen wären beide Fälle schon vor der Umsetzung grün und belegten nichts.
- **Bedingung an Aufgabe 1 (erfüllt):** `FAKE_NAMENSZEILE` schreibt die Zeile 100 ms nach dem `roster` (Aufgabe 1, Step 8). stdout und stderr sind getrennte Pipes; käme die Zeile vor dem `roster` an, kennte der Kern die Namen noch nicht, und der Fall würde zufällig rot.
- **Nachbesserung: die Utility-Prozesse** (Step 6, außerhalb der Dateiliste der Gliederung). Die erste Stellensuche hatte nur Kern, Bridge und `App.tsx:341` erfasst. Der Programm-Empfänger listete aber alle gesehenen NDI-Quellen samt „JM Connect – Zoom <Name>“ ins `main.log`, und der Gast-Sender loggte seinen Sendernamen mit dem Gastnamen; Abnahme D1 und das Handbuch wären am echten Gerät falsch gewesen. Belegt per Quelltext-Wächter (zwei Prüfungen), weil sich die Utility-Dateien ohne `@jm/ndi` und `process.parentPort` nicht laden lassen. Die unlesbare Ereigniszeile der Bridge regelt Aufgabe 2 (Step 14).

### Task 13: Kern: Fernsteuerung `steuerbefehl` und `zoom_cmd*` (11.2)

**Spec:** 11.2 (Tabelle), 8.6 (F1–F8, `zoom_cmd`), Ergänzung 0.15, 12.2 Fall 22 und die Fernsteuer-Teile von 13 und 21, Review Focus 1, L14, L19. Global Constraints G5 (keine Namen im Log), G16.

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\zoom-4b`

**Files:**
- Modify: `apps/connect/src/main/zoom/kern.ts` (Stand nach Aufgabe 12) — Typ-Import (HEAD `:31-33`); Klartext-Import (HEAD `:58`); `fernsteuerung`-Import vor `:82`; `ZoomKern` (HEAD `:173`); Zustand nach `hinweise` (HEAD `:249`); `sollLage` (HEAD `:313`); `kurz()` (Zeile `befehl` aus Aufgabe 4); neuer Abschnitt vor `// ── Beenden` (HEAD `:1375`); Rückgabeobjekt (HEAD `:1450`)
- Modify: `apps/connect/test/zoom-kern.test.ts` — Kopfkommentar, Importe `:10` und (nach Aufgabe 12) Klartext, `BaueOptionen` (nach Aufgabe 11), Fabrik `:177-179`, neuer Block über der Ankerzeile

**Interfaces:**
- Consumes: Aufgabe 7 (`deuteZoomBefehl`, `ladeZiel`); Aufgabe 5 (`FT`, `fernLogText`); Aufgabe 4 (`ZoomBefehlErgebnis`, `ZoomBefehlKennung`, `stateKvAus` mit `zoom_cmd*`); Aufgabe 10 (`belegteAbos`); Aufgabe 11 (`versatz` mit „nur Sitzung“, `tonVorwahl` aus dem Soll); Aufgabe 12 (`hinweis(text, logText)`, Testhilfen `keinTeilnehmernameImLog`, `ATTRAPPEN_NAMEN`).
- Produces (für Aufgabe 15):
  ```ts
  // ZoomKern
  /** Spec 11.2: Fernsteuer-Verb (verb klein, args wie vom Parser). Setzt kurz().befehl; ruft nie den Renderer. */
  steuerbefehl(cmd: { verb: string; args: string[] }): void;
  // kurz().befehl = Ergebnis des letzten zoom_*-Befehls ({ kennung, abgelehnt }) oder null vor dem ersten;
  // stateKv() führt damit die sieben Schlüssel (zoom_cmd, zoom_cmd_rejected aus Aufgabe 4).
  ```
  Testgerüst: `BaueOptionen.sitzung?: (s: Session, startNr: number) => Session` (ändert die Sitzung, die der Kern liest).

**Verhalten (verbindlich, aus der Spec):**
- `zoom_load <Name …>`: nicht `im_meeting` → F4 „nicht im Meeting“; Erlaubnis ≠ `'ja'` → F4 „keine Aufnahme-Erlaubnis“; `ladeZiel` → F2 (niemand), F3 (mehrdeutig, mit Anzahl), F4 „die Person ist im Warteraum“. Ist die Person schon belegt (bestätigt oder Abo unterwegs, `belegteAbos`) → `ok` ohne Befehl. Sonst `laden({ id, ton: <Ton-Vorwahl der Zeile>, trotzBetriebsgroesse: true })`; waren vorher schon 5 oder mehr belegt → Hinweis F8, `zoom_cmd=f8`, nicht abgelehnt.
- `zoom_unload <Name …>`: alle Quellen und offenen Abos, deren Teilnehmer (sonst Soll-Eintrag) diesen normierten Namen trägt, entladen; sonst den Soll-Eintrag dieses Namens vergessen; nichts davon → F5.
- `zoom_delay <ms>`: wie 6.7 über `versatz()`; „nur für diese Sitzung gemerkt“ zählt als `ok` (L14). Ungültiges Argument → F6 (aus `deuteZoomBefehl`).
- Leeres Argument → F1, unbekanntes `zoom_*` → F7 (aus `deuteZoomBefehl`).
- Jeder Befehl setzt `befehl = { kennung, abgelehnt }` (abgelehnt bei F1–F7) und stößt `abbildGeaendert()` an (die Hülle pusht `zoom_cmd*` über `onKurz`). Ein Hinweis zeigt den Text mit Namen, das Log nur `Companion: {KENNUNG} ({verb})`; ein Befehl ohne Hinweis loggt `[zoom] Companion: OK ({verb})`.
- Ein gesendetes, noch unbestätigtes Abo gilt im Abgleich als verbunden (`sollLage`); sonst abonnierte der 300-ms-Abgleich eine gerade per Companion geladene Person ein zweites Mal (Review Focus 1, gemessen).
- Für das Abbild, `sollOffen` und `zoom_alarm` ist dasselbe Abo noch **offen** (Spec 4: „keine Quelle mit anwesender Person läuft“; 7.5): `sollOffen()` führt den Eintrag mit Stand `wartet`, bis die Bridge `subscribed` meldet oder die Frist Q8 abläuft. Antwortet die Bridge nicht, steht `zoom_alarm` so bis zu 10 s auf 1 statt auf 0 (Nachbesserung; damit ist der frühere offene Punkt O6 entschieden).

- [ ] **Step 1: Testgerüst — Sitzung ändern, Importe, Kopf**

In `apps/connect/test/zoom-kern.test.ts`:

Vorher:
```ts
// Spec 12.2; die Fernsteuer-Fälle (22, Fernsteuer-Teile von 13 und 21) kommen mit Aufgabe 13 (4b).
```

Nachher:
```ts
// Spec 12.2 vollständig, mit den 4b-Fällen (15, 15b, 15c, 16–18, 22, 25, Fernsteuer-Teile von 13 und 21).
```

Vorher:
```ts
import { Bridge, type BridgeEvent, type Command } from '@jm/zoom-bridge';
```

Nachher:
```ts
import { Bridge, type BridgeEvent, type Command, type Session } from '@jm/zoom-bridge';
```

Vorher:
```ts
import { failText, KT, quellenFehler, VORSATZ } from '../src/main/zoom/klartext';
```

Nachher:
```ts
import { failText, FT, KT, quellenFehler, VORSATZ } from '../src/main/zoom/klartext';
```

Vorher:
```ts
  /** Was einstellungen.setzeVersatzMs() meldet; false = Einstellungsdatei nicht schreibbar (nur Sitzung). Vorgabe true. */
  versatzSpeichernLiefert?: boolean;
}
```

Nachher:
```ts
  /** Was einstellungen.setzeVersatzMs() meldet; false = Einstellungsdatei nicht schreibbar (nur Sitzung). Vorgabe true. */
  versatzSpeichernLiefert?: boolean;
  /** Ändert die Sitzung, die der Kern von der Bridge liest (z. B. einen Teilnehmer in den Warteraum setzen). */
  sitzung?: (s: Session, startNr: number) => Session;
}
```

Vorher:
```ts
      get session() {
        return b.session;
      },
```

Nachher:
```ts
      get session() {
        return o.sitzung ? o.sitzung(b.session, nr) : b.session;
      },
```

- [ ] **Step 2: Fehlschlagende Tests schreiben**

Vorher:
```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

Nachher:
```ts
// ── Aufgabe 13 (4b): Fernsteuerung im Kern (11.2; Fall 22, Fernsteuer-Teile von 13 und 21) ──
/** Ein Fernsteuer-Befehl, wie ihn der Steuerserver liefert (verb klein, args an Leerzeichen getrennt). */
function befehl(p: Probe, verb: string, ...args: string[]): void {
  p.kern.steuerbefehl({ verb, args });
}
/** `zoom_cmd/zoom_cmd_rejected` aus dem STATE. */
function cmdKv(p: Probe): string {
  return `${p.kern.stateKv()?.zoom_cmd}/${p.kern.stateKv()?.zoom_cmd_rejected}`;
}

console.log('— Fernsteuerung: zoom_load, zoom_unload, zoom_delay, zoom_cmd (Fall 22, Fernteile von 13 und 21)');
{
  const p = baueKern();
  ck('Fall 22: vor dem ersten Befehl zoom_cmd leer, rejected 0', cmdKv(p) === '/0');
  await insMeeting(p);
  befehl(p, 'zoom_load', 'Ben');
  ck('… zoom_load Ben → zoom_cmd=ok, Quelle Ben', cmdKv(p) === 'ok/0' && (await bis(() => zeile(p, BEN)?.quelle?.ndiName === 'JM Connect – Zoom Ben')));
  befehl(p, 'zoom_load', 'Anna', 'Maria');
  ck('… [„Anna“, „Maria“] sucht „Anna Maria“ → F2, rejected 1', cmdKv(p) === 'f2/1' && p.kern.abbild().hinweise.at(-1) === FT.F2('Anna Maria'));
  befehl(p, 'zoom_unload', 'Ben');
  ck('… zoom_unload Ben → ok, Quelle weg, Soll leer', cmdKv(p) === 'ok/0' && (await bis(() => p.kern.kurz().quellen === 0)) && p.kern.abbild().soll.length === 0);
  befehl(p, 'zoom_load');
  ck('… leeres Argument → F1, rejected 1', cmdKv(p) === 'f1/1' && p.kern.abbild().hinweise.at(-1) === FT.F1);
  befehl(p, 'zoom_xyz');
  ck('… zoom_xyz → F7', cmdKv(p) === 'f7/1' && p.kern.abbild().hinweise.at(-1) === FT.F7('zoom_xyz'));
  befehl(p, 'zoom_delay', '0');
  ck('… danach ein gültiger Befehl → zoom_cmd_rejected=0', cmdKv(p) === 'ok/0');
  ck('… stateKv() führt die sieben Schlüssel', JSON.stringify(Object.keys(p.kern.stateKv() ?? {}).sort())
    === '["zoom_alarm","zoom_cmd","zoom_cmd_rejected","zoom_live","zoom_privilege","zoom_sources","zoom_status"]');
  ck('… das Log nennt Kennung und Verb, nie einen Namen', p.logs.includes('[zoom] Companion: OK (zoom_load)')
    && p.logs.includes('[zoom] Hinweis: Companion: F2 (zoom_load)') && keinTeilnehmernameImLog(p, [...ATTRAPPEN_NAMEN, 'Maria']));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_DOPPELNAME: '1' }) });
  await insMeeting(p);
  befehl(p, 'ZOOM_LOAD', 'anna');
  ck('Fall 13 (Fernteil): zoom_load Anna bei Doppelname → F3 mit 2 Personen, zoom_cmd=f3, rejected 1', cmdKv(p) === 'f3/1'
    && p.kern.abbild().hinweise.at(-1) === FT.F3('anna', 2));
  await warte(300);
  ck('… kein videoSubscribe', !cmds(p, 1).includes('videoSubscribe'));
  await p.aufraeumen();
}
{
  const p = baueKern();
  await insMeeting(p);
  befehl(p, 'zoom_delay', '300');
  ck('Fall 21 (Fernteil): zoom_delay 300 → ok, gespeichert, videoDelay 300', cmdKv(p) === 'ok/0' && p.einst.versatzMs === 300
    && (await bis(() => p.befehle(1).some((c) => c.cmd === 'videoDelay' && c.ms === 300), 2000)));
  befehl(p, 'zoom_delay', '1001');
  ck('… zoom_delay 1001 → F6, nichts gespeichert', cmdKv(p) === 'f6/1' && p.einst.versatzMs === 300 && p.kern.abbild().hinweise.at(-1) === FT.F6('1001'));
  await p.aufraeumen();
}
{
  const p = baueKern({ versatzSpeichernLiefert: false });
  befehl(p, 'zoom_delay', '200');
  ck('… Datei nicht schreibbar: zoom_cmd=ok (L14), das Abbild sagt „nur Sitzung“', cmdKv(p) === 'ok/0' && p.kern.abbild().versatz.nurSitzung);
  await p.aufraeumen();
}

console.log('— Fernsteuerung: F4, F5, F8, mehrere Annas, Soll-Eintrag, Taste prellt (Review Focus 1)');
{
  const p = baueKern({ stell: () => ({ FAKE_PRIVILEGE: 'nein' }) });
  befehl(p, 'zoom_load', 'Ben');
  ck('F4 außerhalb des Meetings: „nicht im Meeting“', cmdKv(p) === 'f4/1' && p.kern.abbild().hinweise.at(-1) === FT.F4('nicht im Meeting'));
  await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  await bis(() => p.kern.kurz().erlaubnis === 'abgelehnt');
  befehl(p, 'zoom_load', 'Ben');
  ck('… ohne Erlaubnis: „keine Aufnahme-Erlaubnis“', cmdKv(p) === 'f4/1' && p.kern.abbild().hinweise.at(-1) === FT.F4('keine Aufnahme-Erlaubnis'));
  await p.aufraeumen();
}
{
  const p = baueKern({
    // Die Attrappe kennt keinen fremden Teilnehmer im Warteraum: Die Sitzung, die der Kern liest, setzt Ben dorthin.
    sitzung: (s) => ({ ...s, participants: new Map([...s.participants].map(([id, t]) => [id, id === BEN ? { ...t, inWaitingRoom: true } : t])) }),
  });
  await insMeeting(p);
  befehl(p, 'zoom_load', 'Ben');
  ck('… Person im Warteraum: „die Person ist im Warteraum“', cmdKv(p) === 'f4/1' && p.kern.abbild().hinweise.at(-1) === FT.F4('die Person ist im Warteraum'));
  await p.aufraeumen();
}
{
  const p = baueKern();
  await insMeeting(p);
  befehl(p, 'zoom_unload', 'Zora');
  ck('F5: zoom_unload ohne Quelle und ohne Soll-Eintrag dieses Namens', cmdKv(p) === 'f5/1' && p.kern.abbild().hinweise.at(-1) === FT.F5('Zora'));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_TEILNEHMER: '6' }) });
  await insMeeting(p);
  const ids = p.kern.abbild().teilnehmer.map((t) => t.id);
  for (const id of ids.slice(0, 5)) await p.kern.laden({ id, ton: true, trotzBetriebsgroesse: false });
  await bis(() => p.kern.kurz().quellen === 5);
  befehl(p, 'zoom_load', 'Frieda');
  ck('F8: zoom_load Frieda bei fünf Quellen → geladen, zoom_cmd=f8, rejected 0', cmdKv(p) === 'f8/0'
    && p.kern.abbild().hinweise.at(-1) === FT.F8(6) && (await bis(() => p.kern.kurz().quellen === 6)));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_DOPPELNAME: '1' }) });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  await p.kern.laden({ id: BEN, ton: true, trotzBetriebsgroesse: false });
  await bis(() => p.kern.kurz().quellen === 2);
  befehl(p, 'zoom_unload', 'Anna');
  ck('zoom_unload Anna bei zwei geladenen Annas → beide entladen, ok', cmdKv(p) === 'ok/0'
    && (await bis(() => p.kern.kurz().quellen === 0)) && p.kern.abbild().soll.length === 0
    && p.befehle(1).filter((c) => c.cmd === 'videoUnsubscribe').length === 2);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_ENTZUG_MS: '200' }) });
  await insMeeting(p);
  await p.kern.laden({ id: BEN, ton: true, trotzBetriebsgroesse: false });
  ck('zoom_unload eines Soll-Eintrags: nach dem Entzug wartet Ben', await bis(() => p.kern.kurz().erlaubnis === 'entzogen' && p.kern.kurz().quellen === 0)
    && p.kern.abbild().soll[0]?.stand === 'wartet');
  befehl(p, 'zoom_unload', 'ben');
  ck('… vergessen, zoom_cmd=ok', cmdKv(p) === 'ok/0' && p.kern.abbild().soll.length === 0);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_ABO_VERZOEGERUNG_MS: '300' }) });
  await insMeeting(p);
  befehl(p, 'zoom_load', 'Ben');
  befehl(p, 'zoom_load', 'Ben');
  ck('Review Focus 1: Taste prellt (zweimal zoom_load Ben vor subscribed) → zoom_cmd=ok, rejected 0', cmdKv(p) === 'ok/0');
  ck('… genau ein videoSubscribe für Ben', await bis(() => (zeile(p, BEN)?.quelle ?? null) !== null, 2000)
    && (await warte(300), true) && p.befehle(1).filter((c) => c.cmd === 'videoSubscribe' && c.id === BEN).length === 1);
  ck('… eine Quelle, ohne „(2)“', p.kern.kurz().quellen === 1 && !(zeile(p, BEN)?.quelle?.ndiName ?? '').includes(' (2)'));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_ABO_VERZOEGERUNG_MS: '600' }) });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  ck('Offenes Abo (gesendet, noch nicht bestätigt) ist noch keine Quelle: Anna wartet unter „Gemerkte Quellen“, sollOffen 1, zoom_alarm=1',
    p.kern.abbild().soll.map((e) => `${e.name}:${e.stand}`).join(',') === 'Anna:wartet' && p.kern.kurz().sollOffen === 1
    && p.kern.stateKv()?.zoom_alarm === 1);
  ck('… mit subscribed: keine gemerkte Quelle mehr, zoom_alarm=0', (await bis(() => p.kern.kurz().quellen === 1, 2000))
    && p.kern.abbild().soll.length === 0 && p.kern.stateKv()?.zoom_alarm === 0);
  await warte(400);
  ck('… der Abgleich nach der Erlaubnis hat Anna nicht ein zweites Mal abonniert',
    p.befehle(1).filter((c) => c.cmd === 'videoSubscribe' && c.id === ANNA).length === 1);
  await p.aufraeumen();
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

- [ ] **Step 3: Test laufen lassen (rot)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: 551 `ok`-Zeilen (die erste neue Prüfung „Fall 22: vor dem ersten Befehl zoom_cmd leer, rejected 0“ ist dank Aufgabe 4 schon grün), dann Abbruch mit
```
TypeError: p.kern.steuerbefehl is not a function
```
Exit-Code 1.

- [ ] **Step 4: `kern.ts` — Importe, Schnittstelle, Zustand, Kurzform**

In `apps/connect/src/main/zoom/kern.ts`:

Vorher:
```ts
import type {
  ProxyKeySource,
  ZoomAbbild,
  ZoomErgebnis,
```

Nachher:
```ts
import type {
  ProxyKeySource,
  ZoomAbbild,
  ZoomBefehlErgebnis,
  ZoomBefehlKennung,
  ZoomErgebnis,
```

Vorher:
```ts
  failText,
  fehlerDetail,
```

Nachher:
```ts
  failText,
  fehlerDetail,
  fernLogText,
  FT,
```

Vorher:
```ts
import { sollAbbild, sollHandlungen, type SollLage, type SollListe } from './soll';
```

Nachher:
```ts
import { deuteZoomBefehl, ladeZiel } from './fernsteuerung';
import { sollAbbild, sollHandlungen, type SollLage, type SollListe } from './soll';
```

Vorher:
```ts
  gastLabelsGeaendert(): void;
  beenden(fristMs: number): Promise<void>;
```

Nachher:
```ts
  gastLabelsGeaendert(): void;
  /** Spec 11.2: Fernsteuer-Verb (verb klein, args wie vom Parser). Setzt kurz().befehl; ruft nie den Renderer. */
  steuerbefehl(cmd: { verb: string; args: string[] }): void;
  beenden(fristMs: number): Promise<void>;
```

Vorher:
```ts
  const hinweise: string[] = [];
```

Nachher:
```ts
  const hinweise: string[] = [];
  /** Ergebnis des letzten zoom_*-Befehls (11.2, zoom_cmd); null vor dem ersten. */
  let befehl: ZoomBefehlErgebnis | null = null;
```

Vorher (Zeile aus Aufgabe 4):
```ts
      befehl: null,
```

Nachher:
```ts
      befehl: befehl ? { ...befehl } : null,
```

Vorher:
```ts
    gastLabelsGeaendert: () => abbildGeaendert(),
    beenden,
```

Nachher:
```ts
    gastLabelsGeaendert: () => abbildGeaendert(),
    steuerbefehl,
    beenden,
```

- [ ] **Step 5: `kern.ts` — ein offenes Abo gilt im Abgleich als verbunden, im Abbild als offen**

Vorher:
```ts
    for (const q of aktiveQuellen().values()) abos.set(q.aboId, { verwaist: istVerwaist(q.aboId, ids, { state: q.bild, reason: q.bildGrund }) });
    return {
```

Nachher:
```ts
    for (const q of aktiveQuellen().values()) abos.set(q.aboId, { verwaist: istVerwaist(q.aboId, ids, { state: q.bild, reason: q.bildGrund }) });
    // Review Focus 1: Ein gesendetes, noch unbestätigtes Abo gilt als verbunden; sonst abonnierte der Abgleich es ein zweites Mal.
    for (const id of aboFristen.keys()) if (!abos.has(id)) abos.set(id, { verwaist: !ids.has(id) });
    return {
```

Vorher (Stand nach Aufgabe 10):
```ts
  function sollOffen(): ZoomSollEintrag[] {
    return sollAbbild(soll, sollLage(), freiePlaetze());
  }
```

Nachher:
```ts
  /**
   * Offene Soll-Einträge fürs Abbild, für sollOffen und zoom_alarm (Spec 4, 7.5). Ein gesendetes, noch unbestätigtes Abo
   * gilt im Abgleich als verbunden (sollLage), ist aber noch keine laufende Quelle: Der Eintrag bleibt offen (wartet), bis
   * die Bridge subscribed meldet oder die Frist Q8 abläuft. Reihenfolge wie die Soll-Liste.
   */
  function sollOffen(): ZoomSollEintrag[] {
    const offen = new Map(sollAbbild(soll, sollLage(), freiePlaetze()).map((e) => [normName(e.name), e]));
    const laeuft = aktiveQuellen();
    const aus: ZoomSollEintrag[] = [];
    for (const [schluessel, s] of soll) {
      const e = offen.get(schluessel);
      if (e) aus.push(e);
      else if (s.aboId !== null && aboFristen.has(s.aboId) && !laeuft.has(s.aboId)) {
        aus.push({ name: s.name, ton: s.ton, ndiName: s.ndiName, stand: 'wartet', aboId: null, doppelname: false });
      }
    }
    return aus;
  }
```

- [ ] **Step 6: `kern.ts` — Fernsteuerung (vor dem Abschnitt „Beenden“)**

Vorher:
```ts
  // ── Beenden (Spec 6.6) ───────────────────────────────────────────────────
```

Nachher:
```ts
  // ── Fernsteuerung (Spec 11.2, 8.6) ───────────────────────────────────────
  /** Name zu einer Quelle oder einem offenen Abo: aus der Sitzung, sonst (verwaist) aus dem Soll-Eintrag. */
  function quellenName(aboId: number): string | null {
    const p = aktiveSitzung()?.participants.get(aboId);
    if (p) return p.name;
    for (const s of soll.values()) if (s.aboId === aboId) return s.name;
    return null;
  }

  /** zoom_load: F4 ohne Meeting oder Erlaubnis, F2/F3/F4 nach dem Ladeziel; schon belegt → nichts; ab der 6. Quelle F8. */
  function fernLaden(name: string): { kennung: ZoomBefehlKennung; text: string | null } {
    if (zustand !== 'im_meeting') return { kennung: 'f4', text: FT.F4('nicht im Meeting') };
    if (erlaubnis !== 'ja') return { kennung: 'f4', text: FT.F4('keine Aufnahme-Erlaubnis') };
    const fremde = [...(aktiveSitzung()?.participants.values() ?? [])]
      .filter((p) => !p.self)
      .map((p) => ({ id: p.id, name: p.name, imWarteraum: p.inWaitingRoom }));
    const ziel = ladeZiel(name, fremde);
    if (ziel.art === 'niemand') return { kennung: 'f2', text: FT.F2(name) };
    if (ziel.art === 'mehrdeutig') return { kennung: 'f3', text: FT.F3(name, ziel.n) };
    if (ziel.art === 'warteraum') return { kennung: 'f4', text: FT.F4('die Person ist im Warteraum') };
    const belegt = belegteAbos();
    // Schon geladen oder das Abo ist unterwegs (Taste doppelt gedrückt, Review Focus 1): nichts tun.
    if (belegt.has(ziel.id)) return { kennung: 'ok', text: null };
    const ton = teilnehmerAbbild().find((t) => t.id === ziel.id)?.tonVorwahl ?? true;
    void laden({ id: ziel.id, ton, trotzBetriebsgroesse: true });
    // Die Fernsteuerung lädt auch über die Betriebsgröße, mit der Warnung F8 (nicht abgelehnt).
    return belegt.size >= BETRIEBSGROESSE ? { kennung: 'f8', text: FT.F8(belegt.size + 1) } : { kennung: 'ok', text: null };
  }

  /** zoom_unload: alle Quellen und offenen Abos mit diesem normierten Namen entladen, sonst den Soll-Eintrag vergessen; nichts → F5. */
  function fernEntladen(name: string): { kennung: ZoomBefehlKennung; text: string | null } {
    const ziel = normName(name);
    const aboIds = [...belegteAbos()].filter((id) => {
      const n = quellenName(id);
      return n !== null && normName(n) === ziel;
    });
    const eintrag = soll.get(ziel);
    const nurSoll = eintrag !== undefined && (eintrag.aboId === null || !aboIds.includes(eintrag.aboId));
    if (aboIds.length === 0 && !nurSoll) return { kennung: 'f5', text: FT.F5(name) };
    for (const id of aboIds) void entladen({ aboId: id });
    if (nurSoll) sollVerwerfen({ name });
    return { kennung: 'ok', text: null };
  }

  function steuerbefehl(cmd: { verb: string; args: string[] }): void {
    const verb = cmd.verb.toLowerCase();
    const b = deuteZoomBefehl(cmd.verb, cmd.args);
    let erg: { kennung: ZoomBefehlKennung; text: string | null } = { kennung: 'ok', text: null };
    if (b.art === 'abgelehnt') erg = { kennung: b.kennung, text: b.text };
    else if (b.art === 'laden') erg = fernLaden(b.name);
    else if (b.art === 'entladen') erg = fernEntladen(b.name);
    // Wie 6.7; „nur für diese Sitzung gemerkt“ zählt über die Fernsteuerung als ausgeführt (L14).
    else versatz({ ms: b.ms });
    // 8.6: F1–F7 sind abgelehnt, F8 ist eine Warnung zu einem ausgeführten Befehl.
    befehl = { kennung: erg.kennung, abgelehnt: erg.kennung !== 'ok' && erg.kennung !== 'f8' };
    // N4b.2: der Hinweis nennt den Namen, das Log nur Kennung und Verb.
    if (erg.text !== null) hinweis(erg.text, fernLogText(erg.kennung, verb));
    else d.log(`[zoom] ${fernLogText(erg.kennung, verb)}`);
    abbildGeaendert();
  }

  // ── Beenden (Spec 6.6) ───────────────────────────────────────────────────
```

- [ ] **Step 7: Test laufen lassen (grün)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: `578 ok, 0 fehlgeschlagen, 0 übersprungen.`, Exit-Code 0.

- [ ] **Step 8: Typen prüfen, ganze Connect-Kette**

```
npm run typecheck -w @jm/connect
npm run selftest -w @jm/connect
```
Erwartet: beide Exit-Code 0; die Kette endet je Datei mit `772 ok, 0 fehlgeschlagen.` (zoom-text), `86 ok, 0 fehlgeschlagen.` (zoom-laufzeit), `139 ok, 0 fehlgeschlagen.` (zoom-teile), `578 ok, 0 fehlgeschlagen, 0 übersprungen.` (zoom-kern), `35 ok, 0 fehlgeschlagen.` (zoom-settings), `79 ok, 0 fehlgeschlagen, 0 übersprungen.` (sdk-laden) und „Alle after-pack-Tests bestanden.“.

- [ ] **Step 9: Commit** (Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add apps/connect/src/main/zoom/kern.ts apps/connect/test/zoom-kern.test.ts
git status --short
```
Die gestagten Zeilen müssen genau diese sein:
```
M  apps/connect/src/main/zoom/kern.ts
M  apps/connect/test/zoom-kern.test.ts
```
```
git commit -m "feat(connect): Zoom-Fernsteuerung im Kern (zoom_load, zoom_unload, zoom_delay, zoom_cmd)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Nicht pushen (G13).

**Gegenprobe (beim Planen gemessen):**
- Step 5 weggelassen (offenes Abo im Abgleich nicht verbunden) → Review Focus 1: `576 ok, 2 fehlgeschlagen` (dazu „… der Abgleich nach der Erlaubnis hat Anna nicht ein zweites Mal abonniert“) („… genau ein videoSubscribe für Ben“; der 300-ms-Abgleich nach der Erlaubnis abonniert Ben ein zweites Mal). So ist der Fehler beim Planen gefunden worden.
- „Schon belegt“ in `fernLaden` nicht geprüft → derselbe Fall: `577 ok, 1 fehlgeschlagen`.
- F8 als abgelehnt gewertet (`abgelehnt: kennung !== 'ok'`) → „F8: … zoom_cmd=f8, rejected 0“: `577 ok, 1 fehlgeschlagen`.
- `sollOffen()` wie vor dieser Aufgabe nur aus `sollAbbild` (das offene Abo fehlt dann im Abbild, weil `sollLage` es als verbunden führt) → `577 ok, 1 fehlgeschlagen` („Offenes Abo (gesendet, noch nicht bestätigt) ist noch keine Quelle: …“).

**Abweichungen von der Gliederung:**
- **Zusätzlich `sollLage`: ein offenes Abo gilt als verbunden** (Step 5). Ohne diese Zeile ist Review Focus 1 rot, auch mit der Prüfung „schon belegt“: Der Abgleich, den die Erlaubnis kurz zuvor geplant hat, sieht Bens Soll-Eintrag ohne bestätigte Quelle und abonniert noch einmal. Dasselbe trifft „Laden von Hand“ in den ersten 300 ms nach einem Beitritt.
- **Nachbesserung: `sollOffen()` führt das offene Abo weiter als offen** (Step 5, zweite Ersetzung). Die erste Fassung ließ `sollLage` auch das Abbild speisen; ein gesendetes, unbestätigtes Abo zählte dann für Stand, `sollOffen` und `zoom_alarm` als verbunden, und `zoom_alarm` stand bis zur Q8-Frist auf 0, obwohl nichts sendete (Spec 4, 7.5). Jetzt gilt das offene Abo nur im Abgleich als verbunden. Eigener Fall „Offenes Abo … ist noch keine Quelle …“; der frühere offene Punkt O6 entfällt.
- **Neue Testhilfe `sitzung`** in `BaueOptionen` für F4 „die Person ist im Warteraum“: Die Attrappe kennt keinen fremden Teilnehmer im Warteraum.
- **Logzeilen:** ein ausgeführter Befehl ohne Hinweis loggt `[zoom] Companion: OK (zoom_load)`; ein abgelehnter (und F8) loggt über `hinweis` `[zoom] Hinweis: Companion: F2 (zoom_load)`. Beide Formen kommen aus `fernLogText` (Texttabelle).

---

### Task 14: Steuerprotokoll: STATE-Werte kodieren, Zoom-Capabilities der Rolle `connect`

**Spec:** `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md` Abschnitte 11.1 (Capabilities wörtlich), 17.2 Nr. 3 (Abnahmekriterium „Anna Maria Beispiel“), 3.4, Ergänzungen 0.4 und 0.5, Plan-Entscheidungen L8 (Kodierung) und L9 (Kommentar zu `'truthy'`), Review Focus 5.

**Files:**
- Modify: `packages/suite-control-protocol/src/index.ts:15-16` (Kopfkommentar), `:92-97` (`serializeValue`, Kommentar von `formatSuiteState`), `:107-122` (`parseSuiteState`)
- Modify: `packages/suite-control-protocol/src/capabilities.ts:62-63` (Kommentar `'truthy'`), `:603-620` (Rolle `connect`, Ende der Aktionen bis Ende der Feedbacks)
- Modify: `packages/suite-control-protocol/README.md:62-63` (STATE-Abschnitt), `:96-97` (API-Liste)
- Test: `packages/suite-control-protocol/test/selftest.ts:21-22` (Importe), nach `:117` (Block Kodierung), vor `:119` (Block Capabilities)

**Interfaces:**
- Consumes: keine.
- Produces:
```ts
// packages/suite-control-protocol/src/index.ts
/** Jeder Leerraum (\s, Unicode) und '%' → %XX (UTF-8-Bytes); alles andere unverändert. */
export function kodiereStateWert(v: string): string;
/** Folgen von %XX → decodeURIComponent; eine ungültige Folge bleibt wörtlich. */
export function dekodiereStateWert(v: string): string;
// serializeValue (intern): boolean → '1'/'0', string → kodiereStateWert(v), sonst String(v)
// formatSuiteState: kodiert nur Text-Werte; Schlüssel und ns bleiben roh
// parseSuiteState: kv[key] = dekodiereStateWert(val); ns ebenso; Schlüssel nie dekodiert
// parseSuiteCommand, formatSuiteCommand, parseState, formatState: unverändert (Befehlszeilen werden nicht kodiert)

// packages/suite-control-protocol/src/capabilities.ts, CAPABILITIES.connect (Spec 11.1 wörtlich)
// actions:   9 wie bisher + zoom_load, zoom_unload, zoom_delay (verb === id)
// variables: 9 wie bisher + zoom_status, zoom_sources, zoom_live, zoom_privilege, zoom_alarm, zoom_cmd, zoom_cmd_rejected
// feedbacks: 3 wie bisher + zoom_live (GREEN/WHITE), zoom_alarm (RED/WHITE), zoom_cmd_rejected (YELLOW/BLACK), alle match 'truthy'
```

**Vorab (für den Umsetzer):**
- Stand: Ausgangsstand `051151d614`; die Aufgaben 1–13 fassen das Steuerprotokoll nicht an. Alle Vorher-Ausschnitte unten kommen je genau einmal vor (geprüft beim Nachspielen des ganzen Plans).
- G14: Die Dateien liegen mit CRLF im Arbeitsbaum. Mit dem Edit-Werkzeug ersetzen, nicht mit `sed`.
- Der Selbsttest läuft mit `node --experimental-strip-types`: kein `enum`, keine Parameter-Properties. Er gibt je Fall `ok   <Name>` bzw. `FAIL <Name>` aus und endet mit `ALLE TESTS OK` oder `<n> FEHLER`; eine Zählzeile gibt es nicht. Gezählt wird darum mit `grep -c "^ok "`.
- Wer die Werte liest: Alle Leser gehen über `parseSuiteState` (`client.ts` für Rundown und Launcher-Health, `generated/protocol.mjs` im Companion-Modul nach Aufgabe 16). Befehlszeilen (`CONNECT ZOOM_LOAD Anna Maria`) bleiben unkodiert; Connect setzt die Argumente selbst wieder zusammen (Ergänzung 0.5).
- `capabilities.ts` prüft kein eigenes Typecheck-Skript. Connect importiert die Datei erst ab Aufgabe 15; hier prüft sie `npm run typecheck -w @jm/rundown` mit (der Rundown importiert `@jm/suite-control-protocol/capabilities`, gemessen: die Datei steht in `tsc --listFiles`). Rundown-Code bleibt unverändert (G11).

#### Zyklus 1: STATE-Werte kodieren (17.2 Nr. 3, Review Focus 5)

- [ ] **Step 1: Ausgangszählstand messen.**

Run (aus der Worktree-Wurzel):
```bash
npm run selftest -w @jm/suite-control-protocol
npm run selftest -w @jm/suite-control-protocol | grep -c "^ok "
```
Expected: letzte Zeile `ALLE TESTS OK`, Exit-Code 0; Zählung `41`.

- [ ] **Step 2: Fehlschlagende Tests schreiben.**

Datei `packages/suite-control-protocol/test/selftest.ts`. Vorher (eindeutig):
```ts
  AUTH_PROTO,
  type SwitcherStateMsg,
```
Nachher:
```ts
  AUTH_PROTO,
  kodiereStateWert,
  dekodiereStateWert,
  type SwitcherStateMsg,
```

Datei `packages/suite-control-protocol/test/selftest.ts`. Vorher (eindeutig, Zeile 117):
```ts
eq(parseSuiteCommand('AUTHREQ scs/1 nonce=x')?.ns, 'authreq', 'AUTHREQ landet in eigenem ns (keine Tool-Rolle)');
```
Nachher:
```ts
eq(parseSuiteCommand('AUTHREQ scs/1 nonce=x')?.ns, 'authreq', 'AUTHREQ landet in eigenem ns (keine Tool-Rolle)');

// ── STATE-Werte kodieren (Zoom Stage 4b, Spec 17.2 Nr. 3, Review Focus 5) ─────
// Der Parser trennt an jedem Leerraum. Ohne Kodierung käme „Anna Maria Beispiel“
// nur als „Anna“ an. Kodiert werden nur Leerraum und '%', nur in String-Werten.
const rund = (wert: string): unknown =>
  parseSuiteState(formatSuiteState({ ns: 'connect', kv: { active_label: wert } }))?.kv.active_label;
eq(
  formatSuiteState({ ns: 'connect', kv: { onair: 1, active_label: 'Anna Maria Beispiel' } }),
  'STATE ns=connect onair=1 active_label=Anna%20Maria%20Beispiel\n',
  'STATE-Kodierung: Leerzeichen im Namen → %20, die Zeile bleibt eine Zeile',
);
eq(rund('Anna Maria Beispiel'), 'Anna Maria Beispiel', 'STATE-Kodierung: „Anna Maria Beispiel“ kommt ganz an (17.2 Nr. 3)');
for (const [name, wert] of [
  ['Prozent', '50% Rabatt'],
  ['Gleichheitszeichen', 'a=b'],
  ['doppeltes Leerzeichen', 'Doppel  Leer'],
  ['Leerzeichen am Rand', ' rand '],
  ['geschütztes Leerzeichen (NBSP)', 'Anna Maria'],
  ['Tabulator', 'Spalte\tWert'],
  ['Zeilenumbruch', 'Zeile1\nZeile2'],
  ['ideographisches Leerzeichen', 'Anna　Maria'],
  ['Emoji', 'Gast 🎤 Bühne'],
  ['wörtliches %20', 'schon%20kodiert'],
  ['Umlaute und Bindestrich', 'Jörg Müller-Lüdenscheidt'],
  ['leer', ''],
] as const) {
  eq(rund(wert), wert, `STATE-Kodierung: Rundweg verlustfrei (${name})`);
}
eq(formatSuiteState({ ns: 'connect', kv: { active_label: '' } }), 'STATE ns=connect active_label=\n', 'STATE-Kodierung: leerer Wert bleibt key=');
eq(parseSuiteState('STATE ns=connect active_label=')?.kv.active_label, '', 'STATE-Kodierung: key= wird zu leerem Text');
eq(
  formatSuiteState({ ns: 'connect', kv: { onair: 2, talkback: true, guests: 0 } }),
  'STATE ns=connect onair=2 talkback=1 guests=0\n',
  'STATE-Kodierung: Zahlen und Booleans unverändert',
);
eq(parseSuiteState('STATE ns=connect onair=2 running=1')?.kv, { onair: '2', running: '1' }, 'STATE-Kodierung: Zahlen aus alten Zeilen unverändert');
eq(
  parseSuiteState('STATE ns=timer block_label=Block-A pct=100% roh=%zz halb=%C2'),
  { ns: 'timer', kv: { block_label: 'Block-A', pct: '100%', roh: '%zz', halb: '%C2' } },
  'STATE-Kodierung: alte Zeile ohne Kodierung, ungültige %-Folgen bleiben wörtlich',
);
eq(formatSuiteState({ ns: 't', kv: { 'k%1': 'x y' } }), 'STATE ns=t k%1=x%20y\n', 'STATE-Kodierung: Schlüssel werden nie kodiert');
eq(parseSuiteState('STATE ns=t a%20b=1')?.kv, { 'a%20b': '1' }, 'STATE-Kodierung: Schlüssel werden nie dekodiert');
eq(kodiereStateWert('Anna Maria'), 'Anna%20Maria', 'kodiereStateWert: Leerzeichen');
eq(kodiereStateWert('100%'), '100%25', 'kodiereStateWert: Prozent');
eq(kodiereStateWert('a b\tc'), 'a%C2%A0b%09c', 'kodiereStateWert: NBSP als UTF-8-Bytes, Tab');
eq(kodiereStateWert('Grüße=🎤'), 'Grüße=🎤', 'kodiereStateWert: alles andere unverändert');
eq(dekodiereStateWert('Anna%20Maria'), 'Anna Maria', 'dekodiereStateWert: %20');
eq(dekodiereStateWert('a%C2%A0b'), 'a b', 'dekodiereStateWert: mehrbytige Folge');
eq(dekodiereStateWert('%E2%82'), '%E2%82', 'dekodiereStateWert: abgeschnittene Folge bleibt wörtlich');
eq(
  parseSuiteCommand('CONNECT ZOOM_LOAD Anna Maria'),
  { ns: 'connect', verb: 'zoom_load', args: ['Anna', 'Maria'] },
  'Befehlszeilen werden nicht kodiert: CONNECT ZOOM_LOAD Anna Maria → zwei Argumente',
);
```

- [ ] **Step 3: Test laufen lassen (rot).**

Run: `npm run selftest -w @jm/suite-control-protocol`
Expected: Abbruch vor dem ersten Fall mit
`SyntaxError: The requested module '../src/index.ts' does not provide an export named 'dekodiereStateWert'` (gemessen; Node nennt einen der beiden fehlenden Namen), Exit-Code 1.

- [ ] **Step 4: Kodierung in `src/index.ts`.** Drei Ersetzungen.

Datei `packages/suite-control-protocol/src/index.ts`. Vorher (eindeutig, Zeilen 15–16):
```ts
//     STATE ns=<rolle> <key>=<value> …       (beliebige key=value-Paare)
//
```
Nachher:
```ts
//     STATE ns=<rolle> <key>=<value> …       (beliebige key=value-Paare)
//     In Text-Werten stehen Leerraum und '%' als %XX (kodiereStateWert),
//     z. B. active_label=Anna%20Maria. Befehlszeilen werden nie kodiert.
//
```

Datei `packages/suite-control-protocol/src/index.ts`. Vorher (eindeutig, Zeilen 92–97):
```ts
function serializeValue(v: StateValue): string {
  if (typeof v === 'boolean') return v ? '1' : '0';
  return String(v);
}

/** Generische Status-Zeile bauen: `STATE ns=<ns> k=v …\n`. */
```
Nachher:
```ts
// ── STATE-Werte kodieren (Zoom Stage 4b, Spec 17.2 Nr. 3) ────────────────────
//
// Der Parser trennt eine STATE-Zeile an jedem Leerraum. Ein Name wie „Anna Maria
// Beispiel“ käme sonst nur als „Anna“ an, ein Zeilenumbruch zerrisse die Zeile.
// formatSuiteState kodiert darum in Text-Werten jeden Leerraum und '%' als %XX
// (UTF-8-Bytes); parseSuiteState dekodiert. Umlaute, '=' und Emoji bleiben, wie
// sie sind. Schlüssel werden nie kodiert. Ein alter Leser ohne Dekodierung zeigt
// „Anna%20Maria“ statt eines abgeschnittenen „Anna“. Zeilen alter Sender liest der
// neue Parser unverändert, solange sie keine gültige %XX-Folge enthalten.

/** Jeder Leerraum (\s, Unicode) und '%' → %XX (UTF-8-Bytes); alles andere unverändert. */
export function kodiereStateWert(v: string): string {
  return v.replace(/[\s%]/gu, (zeichen) => encodeURIComponent(zeichen));
}

/** Folgen von %XX → decodeURIComponent; eine ungültige Folge bleibt wörtlich. */
export function dekodiereStateWert(v: string): string {
  if (!v.includes('%')) return v;
  return v.replace(/(?:%[0-9A-Fa-f]{2})+/g, (folge) => {
    try {
      return decodeURIComponent(folge);
    } catch {
      return folge; // z. B. eine abgeschnittene UTF-8-Folge aus einer alten Zeile
    }
  });
}

function serializeValue(v: StateValue): string {
  if (typeof v === 'boolean') return v ? '1' : '0';
  return typeof v === 'string' ? kodiereStateWert(v) : String(v);
}

/** Generische Status-Zeile bauen: `STATE ns=<ns> k=v …\n`. Text-Werte kodiert (kodiereStateWert). */
```

Datei `packages/suite-control-protocol/src/index.ts`. Vorher (eindeutig, Zeilen 107–122):
```ts
 * es — Legacy-Switcher-Zeile —, bleibt ns ''). Alle übrigen key=value landen in
 * `kv` (Werte als Strings).
 */
export function parseSuiteState(line: string): SuiteState | null {
  const t = line.trim();
  if (!/^STATE\b/i.test(t)) return null;
  let ns = '';
  const kv: Record<string, StateValue> = {};
  for (const tok of t.split(/\s+/).slice(1)) {
    const eq = tok.indexOf('=');
    if (eq <= 0) continue;
    const key = tok.slice(0, eq);
    const val = tok.slice(eq + 1);
    if (key.toLowerCase() === 'ns') ns = val;
    else kv[key] = val;
  }
```
Nachher:
```ts
 * es — Legacy-Switcher-Zeile —, bleibt ns ''). Alle übrigen key=value landen in
 * `kv` (Werte als Strings, dekodiert mit dekodiereStateWert; Schlüssel bleiben roh).
 */
export function parseSuiteState(line: string): SuiteState | null {
  const t = line.trim();
  if (!/^STATE\b/i.test(t)) return null;
  let ns = '';
  const kv: Record<string, StateValue> = {};
  for (const tok of t.split(/\s+/).slice(1)) {
    const eq = tok.indexOf('=');
    if (eq <= 0) continue;
    const key = tok.slice(0, eq);
    const val = dekodiereStateWert(tok.slice(eq + 1));
    if (key.toLowerCase() === 'ns') ns = val;
    else kv[key] = val;
  }
```

- [ ] **Step 5: Test laufen lassen (grün).**

Run:
```bash
npm run selftest -w @jm/suite-control-protocol
npm run selftest -w @jm/suite-control-protocol | grep -c "^ok "
```
Expected: keine Zeile, die mit `FAIL` beginnt, letzte Zeile `ALLE TESTS OK`, Exit-Code 0; Zählung `70` (41 + 29).

- [ ] **Step 6: Gegenprobe (vorübergehend, danach zurücknehmen).**
  - a) In `parseSuiteState` die Zeile `const val = dekodiereStateWert(tok.slice(eq + 1));` durch `const val = tok.slice(eq + 1);` ersetzen und `node --experimental-strip-types packages/suite-control-protocol/test/selftest.ts` laufen lassen. Erwartet und gemessen: `11 FEHLER`, darunter `FAIL STATE-Kodierung: „Anna Maria Beispiel“ kommt ganz an (17.2 Nr. 3)` und zehn `Rundweg verlustfrei`-Fälle (alle außer „Gleichheitszeichen“ und „leer“).
  - b) Zurücksetzen, dann in `serializeValue` die Zeile `return typeof v === 'string' ? kodiereStateWert(v) : String(v);` durch `return String(v);` ersetzen. Erwartet und gemessen: `13 FEHLER` (zusätzlich `… → %20, die Zeile bleibt eine Zeile` und `Schlüssel werden nie kodiert`).
  - Zurücksetzen und Step 5 wiederholen: `ALLE TESTS OK`, Zählung `70`.

#### Zyklus 2: Rolle `connect` mit den Zoom-Teilen (Spec 11.1 wörtlich)

- [ ] **Step 7: Fehlschlagende Tests schreiben.**

Datei `packages/suite-control-protocol/test/selftest.ts`. Vorher (eindeutig, Zeile 119):
```ts
console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```
Nachher:
```ts
// ── Rolle connect: Zoom-Teile (Zoom Stage 4b, Spec 11.1 wörtlich) ────────────
{
  const c = CAPABILITIES.connect;
  const ids = (xs: { id: string }[]): string[] => xs.map((x) => x.id);
  eq(
    ids(c.actions),
    ['go', 'next', 'standby', 'onair', 'off', 'approve', 'talkback', 'slides', 'kick', 'zoom_load', 'zoom_unload', 'zoom_delay'],
    'connect: 9 Raum-Aktionen wie bisher + 3 Zoom-Aktionen',
  );
  eq(
    c.actions.filter((a) => a.id.startsWith('zoom_')),
    [
      { id: 'zoom_load', label: 'Zoom: Person als Quelle laden', verb: 'zoom_load', args: [{ id: 'name', label: 'Anzeigename in Zoom', type: 'string', default: '' }] },
      { id: 'zoom_unload', label: 'Zoom: Quelle entladen', verb: 'zoom_unload', args: [{ id: 'name', label: 'Anzeigename in Zoom', type: 'string', default: '' }] },
      { id: 'zoom_delay', label: 'Zoom: Bild-Versatz setzen', verb: 'zoom_delay', args: [{ id: 'ms', label: 'Versatz (ms)', type: 'number', default: 0, min: 0, max: 1000 }] },
    ],
    'connect: Zoom-Aktionen wörtlich, verb === id',
  );
  eq(
    ids(c.variables),
    ['room', 'connected', 'guests', 'lobby', 'onair', 'active_label', 'standby', 'standby_label', 'talkback',
      'zoom_status', 'zoom_sources', 'zoom_live', 'zoom_privilege', 'zoom_alarm', 'zoom_cmd', 'zoom_cmd_rejected'],
    'connect: 9 Raum-Variablen wie bisher + 7 Zoom-Variablen',
  );
  eq(
    c.variables.filter((v) => v.id.startsWith('zoom_')),
    [
      { id: 'zoom_status', label: 'Zoom: Status (einrichtung/bereit/tritt_bei/warteraum/im_meeting/abriss/verlaesst/fehler)' },
      { id: 'zoom_sources', label: 'Zoom: geladene Quellen (Anzahl)' },
      { id: 'zoom_live', label: 'Zoom: mindestens eine Quelle geladen (1/0)' },
      { id: 'zoom_privilege', label: 'Zoom: Aufnahme-Erlaubnis erteilt (1/0)' },
      { id: 'zoom_alarm', label: 'Zoom: Eingriff nötig (1/0)' },
      { id: 'zoom_cmd', label: 'Zoom: Ergebnis des letzten Zoom-Befehls (ok, f1 … f8)' },
      { id: 'zoom_cmd_rejected', label: 'Zoom: letzter Zoom-Befehl abgelehnt (1/0)' },
    ],
    'connect: Zoom-Variablen wörtlich',
  );
  eq(ids(c.feedbacks), ['onair', 'lobby', 'talkback', 'zoom_live', 'zoom_alarm', 'zoom_cmd_rejected'], 'connect: 3 Raum-Feedbacks wie bisher + 3 Zoom-Feedbacks');
  eq(
    c.feedbacks.filter((f) => f.id.startsWith('zoom_')),
    [
      { id: 'zoom_live', label: 'Connect: Zoom-Quellen geladen', stateKey: 'zoom_live', match: 'truthy', bgcolor: [30, 160, 60], color: [255, 255, 255] },
      { id: 'zoom_alarm', label: 'Connect: Zoom braucht einen Eingriff', stateKey: 'zoom_alarm', match: 'truthy', bgcolor: [200, 30, 30], color: [255, 255, 255] },
      { id: 'zoom_cmd_rejected', label: 'Connect: letzter Zoom-Befehl abgelehnt', stateKey: 'zoom_cmd_rejected', match: 'truthy', bgcolor: [251, 231, 59], color: [0, 0, 0] },
    ],
    'connect: Zoom-Feedbacks wörtlich (GREEN, RED, YELLOW/BLACK), alle truthy',
  );
  eq(KNOWN_ROLES.includes('connect'), true, 'connect ist eine bekannte Rolle');
}

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```

- [ ] **Step 8: Test laufen lassen (rot).**

Run: `npm run selftest -w @jm/suite-control-protocol`
Expected: sechs Zeilen `FAIL connect: …` (alle Fälle des neuen Blocks außer `connect ist eine bekannte Rolle`), Schluss `6 FEHLER`, Exit-Code 1; `ok`-Zeilen: 71.

- [ ] **Step 9: Capabilities der Rolle `connect` (Spec 11.1) und Kommentar zu `'truthy'` (L9).** Zwei Ersetzungen.

Datei `packages/suite-control-protocol/src/capabilities.ts`. Vorher (eindeutig, Zeilen 62–63):
```ts
   *  'truthy'     → an, wenn Schlüssel '1'/true ist (z. B. recording).
   *  'equalsArg'  → an, wenn Schlüssel == Optionswert (z. B. program == Szene n).
```
Nachher:
```ts
   *  'truthy'     → an, wenn der Schlüssel '1', 'an', 'true' oder eine positive ganze
   *                 Zahl ist (Anzahl > 0, z. B. onair=2 Gäste auf Sendung); '0', leer und
   *                 alles andere → aus. Ausgewertet im Companion-Modul (lib.mjs isTruthy).
   *                 Booleans kommen als 1/0 an (formatSuiteState).
   *  'equalsArg'  → an, wenn Schlüssel == Optionswert (z. B. program == Szene n).
```

Datei `packages/suite-control-protocol/src/capabilities.ts`. Vorher (eindeutig, Zeilen 603–620):
```ts
      { id: 'kick', label: 'Gast entfernen', verb: 'kick', args: [{ id: 'guest', label: 'Gast-ID', type: 'string', default: '' }] },
    ],
    variables: [
      { id: 'room', label: 'Raum' },
      { id: 'connected', label: 'SFU verbunden (1/0)' },
      { id: 'guests', label: 'Gäste gesamt' },
      { id: 'lobby', label: 'Im Warteraum' },
      { id: 'onair', label: 'Auf Sendung (Anzahl)' },
      { id: 'active_label', label: 'Aktiver Gast (Name)' },
      { id: 'standby', label: 'Standby-Gast (ID)' },
      { id: 'standby_label', label: 'Standby-Gast (Name)' },
      { id: 'talkback', label: 'Talkback aktiv (1/0)' },
    ],
    feedbacks: [
      { id: 'onair', label: 'Connect: es ist ein Gast auf Sendung', stateKey: 'onair', match: 'truthy', bgcolor: RED, color: WHITE },
      { id: 'lobby', label: 'Connect: Gäste im Warteraum', stateKey: 'lobby', match: 'truthy', bgcolor: YELLOW, color: BLACK },
      { id: 'talkback', label: 'Connect: Talkback aktiv', stateKey: 'talkback', match: 'truthy', bgcolor: YELLOW, color: BLACK },
    ],
```
Nachher:
```ts
      { id: 'kick', label: 'Gast entfernen', verb: 'kick', args: [{ id: 'guest', label: 'Gast-ID', type: 'string', default: '' }] },
      // ── Zoom (Stage 4, #197). Eigene Verben, im Main abgefangen, nie an den DO. Anzeigename statt
      // Teilnehmer-ID, weil Zooms IDs nur innerhalb einer Sitzung gelten. Kein Beitritt per Fernsteuerung.
      // Mehrwortige Namen gehen: Connect setzt die Argumente mit einem Leerzeichen wieder zusammen.
      { id: 'zoom_load', label: 'Zoom: Person als Quelle laden', verb: 'zoom_load',
        args: [{ id: 'name', label: 'Anzeigename in Zoom', type: 'string', default: '' }] },
      { id: 'zoom_unload', label: 'Zoom: Quelle entladen', verb: 'zoom_unload',
        args: [{ id: 'name', label: 'Anzeigename in Zoom', type: 'string', default: '' }] },
      { id: 'zoom_delay', label: 'Zoom: Bild-Versatz setzen', verb: 'zoom_delay',
        args: [{ id: 'ms', label: 'Versatz (ms)', type: 'number', default: 0, min: 0, max: 1000 }] },
    ],
    variables: [
      { id: 'room', label: 'Raum' },
      { id: 'connected', label: 'SFU verbunden (1/0)' },
      { id: 'guests', label: 'Gäste gesamt' },
      { id: 'lobby', label: 'Im Warteraum' },
      { id: 'onair', label: 'Auf Sendung (Anzahl)' },
      { id: 'active_label', label: 'Aktiver Gast (Name)' },
      { id: 'standby', label: 'Standby-Gast (ID)' },
      { id: 'standby_label', label: 'Standby-Gast (Name)' },
      { id: 'talkback', label: 'Talkback aktiv (1/0)' },
      // Zoom (Spec 11.1, 7.5). Ohne Namen: Den Grund eines abgelehnten Befehls zeigt Connect unter „Hinweise“.
      // Unter macOS fehlen die zoom_*-Schlüssel im STATE ganz.
      { id: 'zoom_status', label: 'Zoom: Status (einrichtung/bereit/tritt_bei/warteraum/im_meeting/abriss/verlaesst/fehler)' },
      { id: 'zoom_sources', label: 'Zoom: geladene Quellen (Anzahl)' },
      { id: 'zoom_live', label: 'Zoom: mindestens eine Quelle geladen (1/0)' },
      { id: 'zoom_privilege', label: 'Zoom: Aufnahme-Erlaubnis erteilt (1/0)' },
      { id: 'zoom_alarm', label: 'Zoom: Eingriff nötig (1/0)' },
      { id: 'zoom_cmd', label: 'Zoom: Ergebnis des letzten Zoom-Befehls (ok, f1 … f8)' },
      { id: 'zoom_cmd_rejected', label: 'Zoom: letzter Zoom-Befehl abgelehnt (1/0)' },
    ],
    feedbacks: [
      // onair und lobby sind Anzahlen: 'truthy' leuchtet bei jeder positiven ganzen Zahl (17.2 Nr. 2).
      { id: 'onair', label: 'Connect: es ist ein Gast auf Sendung', stateKey: 'onair', match: 'truthy', bgcolor: RED, color: WHITE },
      { id: 'lobby', label: 'Connect: Gäste im Warteraum', stateKey: 'lobby', match: 'truthy', bgcolor: YELLOW, color: BLACK },
      { id: 'talkback', label: 'Connect: Talkback aktiv', stateKey: 'talkback', match: 'truthy', bgcolor: YELLOW, color: BLACK },
      { id: 'zoom_live', label: 'Connect: Zoom-Quellen geladen', stateKey: 'zoom_live', match: 'truthy', bgcolor: GREEN, color: WHITE },
      { id: 'zoom_alarm', label: 'Connect: Zoom braucht einen Eingriff', stateKey: 'zoom_alarm', match: 'truthy', bgcolor: RED, color: WHITE },
      { id: 'zoom_cmd_rejected', label: 'Connect: letzter Zoom-Befehl abgelehnt', stateKey: 'zoom_cmd_rejected', match: 'truthy', bgcolor: YELLOW, color: BLACK },
    ],
```

- [ ] **Step 10: Test laufen lassen (grün).**

Run:
```bash
npm run selftest -w @jm/suite-control-protocol
npm run selftest -w @jm/suite-control-protocol | grep -c "^ok "
```
Expected: keine `FAIL`-Zeile, `ALLE TESTS OK`, Exit-Code 0; Zählung `77` (70 + 7).

- [ ] **Step 11: README des Steuerprotokolls.** Zwei Ersetzungen.

Datei `packages/suite-control-protocol/README.md`. Vorher (eindeutig, Zeilen 62–63):
````markdown
STATE ns=titler on_air=1 active=2 active_label=Max-Mustermann
```
````
Nachher:
````markdown
STATE ns=titler on_air=1 active=2 active_label=Max-Mustermann
STATE ns=connect onair=1 active_label=Anna%20Maria%20Beispiel
```

**Text-Werte sind kodiert:** `formatSuiteState` schreibt in Text-Werten jeden
Leerraum (Leerzeichen, Tab, Zeilenumbruch, geschütztes Leerzeichen …) und `%`
als `%XX` (UTF-8-Bytes, `kodiereStateWert`); `parseSuiteState` dekodiert
(`dekodiereStateWert`). So kommt „Anna Maria Beispiel“ ganz an, statt am ersten
Leerzeichen abzubrechen. Zahlen, Booleans und Schlüssel bleiben unkodiert.
Zeilen älterer Sender ohne Kodierung liest der Parser unverändert; eine
ungültige `%`-Folge (`100%`) bleibt wörtlich stehen. Ein Leser, der noch den
alten Parser bündelt, zeigt `Anna%20Maria` – erst sein nächstes Release
dekodiert. Befehlszeilen werden **nicht** kodiert: Argumente trennt der Parser
wie bisher am Leerraum (`CONNECT ZOOM_LOAD Anna Maria` → `['Anna', 'Maria']`).
````

Datei `packages/suite-control-protocol/README.md`. Vorher (eindeutig, Zeilen 96–97):
```ts
  formatSuiteState,    // ({ ns, kv }) → "STATE ns=… k=v …\n"  (bool → 1/0)
  parseSuiteState,     // (line) → { ns, kv } | null
```
Nachher:
```ts
  formatSuiteState,    // ({ ns, kv }) → "STATE ns=… k=v …\n"  (bool → 1/0, Text kodiert)
  parseSuiteState,     // (line) → { ns, kv } | null              (Text dekodiert)
  kodiereStateWert,    // (text) → Leerraum und % als %XX
  dekodiereStateWert,  // (text) → %XX-Folgen zurück; ungültige bleiben wörtlich
```

- [ ] **Step 12: Typecheck und Nachbarn, die den Parser bündeln.**

Run:
```bash
npm run typecheck -w @jm/connect
npm run typecheck -w @jm/rundown
npm run selftest -w @jm/rundown
npm run selftest -w @jm/launcher
npm run selftest -w @jm/timer
```
Expected: beide Typechecks ohne Zeile mit `error TS`, Exit-Code 0 (`@jm/connect` prüft `src/index.ts` über `control-server.ts`, `@jm/rundown` prüft `capabilities.ts`). Die drei Selbsttests wie in der CI grün: Rundown `ALLE TESTS OK`, Launcher `113 ok, 0 fehlgeschlagen.`, Timer `41 passed, 0 failed` (gemessen an der Kopie mit dem neuen Parser).

- [ ] **Step 13: Commit.**

```bash
git add packages/suite-control-protocol/src/index.ts packages/suite-control-protocol/src/capabilities.ts packages/suite-control-protocol/test/selftest.ts packages/suite-control-protocol/README.md
git status --short
```
Erwartet genau diese gestagten Zeilen (sonst nichts Gestagtes):
```
M  packages/suite-control-protocol/README.md
M  packages/suite-control-protocol/src/capabilities.ts
M  packages/suite-control-protocol/src/index.ts
M  packages/suite-control-protocol/test/selftest.ts
```
Dann:
```bash
git commit -m "feat(suite-control): STATE-Werte mit Leerraum kodiert; Zoom-Aktionen und -Variablen fuer JM Connect" -m "formatSuiteState schreibt Leerraum und Prozent in Text-Werten als %XX, parseSuiteState dekodiert; Schluessel, Zahlen und Befehlszeilen bleiben unkodiert, alte Zeilen werden unveraendert gelesen. So kommt 'Anna Maria Beispiel' ganz an (Spec 17.2 Nr. 3). Die Rolle connect bekommt zoom_load, zoom_unload, zoom_delay, die sieben zoom_*-Variablen und drei Feedbacks (Spec 11.1); 'truthy' gilt fuer jede positive ganze Zahl (#197)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Nicht pushen.

**Abweichungen von der Gliederung:**
1. **README des Steuerprotokolls** mitgezogen (STATE-Abschnitt mit Beispiel `Anna%20Maria%20Beispiel`, API-Liste). Die Gliederung nennt die Datei nicht.
2. **`ns` wird dekodiert, aber nicht kodiert:** `formatSuiteState` schreibt `ns=<rolle>` roh (Rollen sind einzelne Wörter), `parseSuiteState` dekodiert `ns` wie in der Gliederung verlangt. Für alle Rollen ist das gleichwertig.
3. **`serializeValue`** kodiert nur echte Strings; jeder andere Wert geht wie bisher durch `String(v)`. So bricht ein Renderer-Push mit einem versehentlich fehlenden Wert nicht (`String(undefined)`), statt in `replace` zu werfen.
4. **Typecheck für `capabilities.ts`:** Die Gliederung nennt nur `npm run typecheck -w @jm/connect`. Connect importiert die Datei erst ab Aufgabe 15; darum prüft hier `npm run typecheck -w @jm/rundown` (nur lesend, Rundown bleibt unverändert).
5. **Testumfang über die Gliederung hinaus:** Zeilenumbruch, Leerzeichen am Rand, ideographisches Leerzeichen, wörtliches `%20`, Umlaute, abgeschnittene UTF-8-Folge (`%E2%82`, `halb=%C2`), „Schlüssel nie dekodiert“.

---

### Task 15: Connect-Hülle: STATE aus zwei Teilen, `zoom_*` im Main abfangen

**Spec:** 11.2 (Verben im Main, Code), 11.3 (STATE mischen, Code, „nur bei Änderung eines der sieben Werte“), 12.4 (`control-state.test.ts`), 12.5 („Raum-Push ersetzt alles → `control-state.test.ts`“), Ergänzung 0.3 (Abzweig im Main), 7.5 (macOS ohne `zoom_*`), Plan-Entscheidungen L19, L20.

**Files:**
- Create: `apps/connect/src/main/control-state.ts` (rein, G8)
- Modify: `apps/connect/src/main/control-server.ts:9-20` (Kopf, Importe, `lastState`), `:50-54` (`pushControlState`, neu `setZoomControlState`)
- Modify: `apps/connect/src/main/zoom.ts` (Ausgangsstand-Zeilen; Aufgabe 11 verschiebt sie um ein bis zwei Zeilen): `:13` (Importe), `:34-36` (Melder), `:84` (`onKurz`), `:86-90` (erster Push), `:217-220` (neuer Export `zoomSteuerbefehl` am Dateiende)
- Modify: `apps/connect/src/main/index.ts:15` (Import), `:113-117` (`onCommand`)
- Modify: `apps/connect/package.json:17` (`selftest`)
- Test: `apps/connect/test/control-state.test.ts` (neu)

**Interfaces:**
- Consumes:
```ts
// Aufgabe 4 · apps/connect/src/shared/types.ts und zoom-text.ts
export type ZoomBefehlKennung = 'ok' | 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6' | 'f7' | 'f8';
export interface ZoomBefehlErgebnis { kennung: ZoomBefehlKennung; abgelehnt: boolean }
// ZoomKurz zusätzlich: befehl: ZoomBefehlErgebnis | null;
export interface ZoomStateKv { zoom_status; zoom_sources; zoom_live; zoom_privilege; zoom_alarm; zoom_cmd: '' | ZoomBefehlKennung; zoom_cmd_rejected: 0 | 1 }
export function stateKvAus(k: ZoomKurz): ZoomStateKv | null;
// Aufgabe 13 · apps/connect/src/main/zoom/kern.ts
interface ZoomKern { /* … */ stateKv(): ZoomStateKv | null; steuerbefehl(cmd: { verb: string; args: string[] }): void }
// Aufgabe 14 · @jm/suite-control-protocol
export function formatSuiteState(s: SuiteState): string;   // kodiert Text-Werte
export function parseSuiteState(line: string): SuiteState | null;   // dekodiert
// @jm/suite-control-protocol/capabilities: CAPABILITIES.connect.variables mit den sieben zoom_*-Variablen
```
- Produces:
```ts
// apps/connect/src/main/control-state.ts (rein, G8: keine Importe)
export type Kv = Record<string, string | number | boolean>;
export const RAUM_START: Kv;                                  // { room: '', onair: 0, lobby: 0, guests: 0, talkback: 0 }
export function mischeState(raum: Kv, zoom: Kv): Kv;          // { ...raum, ...zoom }
export interface StateSpeicher { raum(kv: Kv): void; zoom(kv: Kv): void; aktuell(): Kv }
export function erzeugeStateSpeicher(senden: (kv: Kv) => void, raumStart?: Kv): StateSpeicher;
export function aenderungsMelder(senden: (kv: Kv) => void): (kv: Kv | null) => void;   // nur bei geändertem JSON; null → {}
export interface Steuerziele { zoom(cmd: { verb: string; args: string[] }): void; renderer(cmd: { verb: string; args: string[] }): void }
export function leiteSteuerbefehl(cmd: { verb: string; args: string[] }, ziele: Steuerziele): void;   // zoom_* → nur zoom, sonst nur renderer
// apps/connect/src/main/control-server.ts
export function pushControlState(kv: Kv): void;      // Renderer (über IPC wie bisher): ersetzt nur den Raum-Teil
export function setZoomControlState(kv: Kv): void;   // Zoom-Hülle: ersetzt nur den Zoom-Teil
// apps/connect/src/main/zoom.ts
export function zoomSteuerbefehl(cmd: { verb: string; args: string[] }): void;   // ohne Kern (macOS): nur Logzeile (L19)
// apps/connect/src/main/index.ts, onCommand des Steuerservers:
//   leiteSteuerbefehl(cmd, { zoom: zoomSteuerbefehl, renderer: … IPC.controlCommand … }); die Weiche ist rein und getestet
```

**Vorab (für den Umsetzer):**
- Stand: nach Aufgaben 1–14. `control-server.ts` und `index.ts` sind seit dem Ausgangsstand unverändert. In `zoom.ts` hat Aufgabe 11 die Zeile `setzeVersatzMs: setzeZoomVersatzMs,` (Ausgangszeile 72) und den Import aus `./settings` geändert; keiner der Vorher-Ausschnitte unten berührt diese Stellen. Jeder Vorher-Ausschnitt kommt genau einmal vor.
- G14: CRLF im Arbeitsbaum, Edit-Werkzeug.
- `control-server.ts` importiert Electron. Der Test ersetzt `electron` und `@jm/suite-control-protocol/server` per Modul-Hook (`registerHooks` aus `node:module`), genau wie `test/zoom-settings.test.ts` es mit `electron` und `@jm/app-runtime` tut. So prüft der Test die echte Verdrahtung, nicht nur die reine Funktion (Gegenprobe 12.5).
- `zoom.ts` und `index.ts` prüfen Typecheck, Bau und die Bündel-Suche (G10: kein Test lädt Electron). Die Logik dahinter steckt in `aenderungsMelder` (nur bei Änderung melden) und `leiteSteuerbefehl` (Weiche `zoom_*` → Zoom-Hülle, sonst Renderer) und ist getestet.
- Der Kern meldet seinen Anfangszustand nicht über `onKurz` (`kern.ts` setzt `letzteKurz` beim Anlegen). Darum geht der erste Zoom-Teil direkt nach `erzeugeZoomKern` hinaus.
- Unter macOS legt `startZoom` keinen Kern an (L17 aus 4a). Dann ruft niemand `setZoomControlState`, und der STATE trägt keine `zoom_*`-Schlüssel (Spec 7.5, L19).
- Logzeilen nennen das Verb, nie die Argumente; dort stehen Anzeigenamen (G5, N4b.2).

- [ ] **Step 1: Test anlegen.**

Neue Datei `apps/connect/test/control-state.test.ts` (ganzer Inhalt):
```ts
// STATE von JM Connect aus zwei Teilen (Zoom Stage 4b, Spec 11.3, 12.4; Gegenprobe 12.5 „Raum-Push
// ersetzt alles“). Teil 1 prüft die reinen Funktionen aus src/main/control-state.ts, Teil 2 die
// Verdrahtung in control-server.ts. Electron und der TCP-Steuerserver werden dort per Modul-Hook durch
// Attrappen ersetzt (wie in zoom-settings.test.ts). npm run selftest -w @jm/connect
import { registerHooks } from 'node:module';
import { formatSuiteState, parseSuiteState } from '@jm/suite-control-protocol';
import { CAPABILITIES } from '@jm/suite-control-protocol/capabilities';
import { aenderungsMelder, erzeugeStateSpeicher, leiteSteuerbefehl, mischeState, RAUM_START, type Kv } from '../src/main/control-state';
import { stateKvAus } from '../src/shared/zoom-text';
import type { ZoomKurz } from '../src/shared/types';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const gleich = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const zoomSchluessel = (kv: Kv): string[] => Object.keys(kv).filter((s) => s.startsWith('zoom_'));

// Raum-Teil, wie ihn App.tsx meldet (G12: erfundener Name mit Leerzeichen).
const RAUM: Kv = {
  room: 'R1', guests: 3, lobby: 2, onair: 2, active_label: 'Anna Maria Beispiel', standby: 'g7', standby_label: 'Ben', talkback: 0,
};
// Zoom-Teil, wie ihn die Zoom-Hülle aus kern.stateKv() meldet.
const ZOOM: Kv = {
  zoom_status: 'im_meeting', zoom_sources: 2, zoom_live: 1, zoom_privilege: 1, zoom_alarm: 0, zoom_cmd: 'f3', zoom_cmd_rejected: 1,
};

console.log('— Teil 1: mischeState und StateSpeicher (rein)');
{
  ck('mischeState: Raum- und Zoom-Teil nebeneinander', gleich(mischeState(RAUM, ZOOM), { ...RAUM, ...ZOOM }));
  ck('mischeState: leerer Zoom-Teil → nur der Raum-Teil', gleich(mischeState(RAUM, {}), RAUM));

  const gesendet: Kv[] = [];
  const sp = erzeugeStateSpeicher((kv) => gesendet.push(kv));
  ck('vor dem ersten Push: Startwerte des Raums, kein zoom_*', gleich(sp.aktuell(), RAUM_START) && zoomSchluessel(sp.aktuell()).length === 0);
  ck('RAUM_START = room leer, onair/lobby/guests/talkback 0', gleich(RAUM_START, { room: '', onair: 0, lobby: 0, guests: 0, talkback: 0 }));

  sp.zoom(ZOOM);
  sp.raum(RAUM);
  ck('Raum-Push lässt zoom_* stehen', gleich(sp.aktuell(), { ...RAUM, ...ZOOM }));

  sp.zoom({ ...ZOOM, zoom_status: 'abriss', zoom_alarm: 1 });
  ck('Zoom-Push lässt Raum-Werte stehen', sp.aktuell().room === 'R1' && sp.aktuell().active_label === 'Anna Maria Beispiel'
    && sp.aktuell().zoom_status === 'abriss' && sp.aktuell().zoom_alarm === 1);

  sp.zoom({ zoom_status: 'bereit', zoom_sources: 0 });
  ck('zweiter Zoom-Push ersetzt den ersten Zoom-Teil (zoom_cmd weg)',
    gleich(zoomSchluessel(sp.aktuell()), ['zoom_status', 'zoom_sources']) && sp.aktuell().zoom_status === 'bereit');

  sp.raum({ room: 'R2', onair: 0 });
  ck('zweiter Raum-Push ersetzt den ersten Raum-Teil (standby weg), Zoom bleibt',
    sp.aktuell().room === 'R2' && !('standby' in sp.aktuell()) && sp.aktuell().zoom_status === 'bereit');

  sp.zoom({});
  ck('leerer Zoom-Teil (macOS) → nur Raum', gleich(sp.aktuell(), { room: 'R2', onair: 0 }));

  ck('senden bekommt je Push den gemischten Stand', gesendet.length === 6 && gleich(gesendet[1], { ...RAUM, ...ZOOM })
    && gleich(gesendet[5], sp.aktuell()));

  const eingabe: Kv = { room: 'R3' };
  sp.raum(eingabe);
  eingabe.room = 'verändert';
  const stand = sp.aktuell();
  stand.room = 'auch verändert';
  ck('Eingaben und aktuell() sind Kopien', sp.aktuell().room === 'R3');

  const mitStart = erzeugeStateSpeicher(() => {}, { room: 'X' });
  ck('eigene Startwerte für den Raum-Teil', gleich(mitStart.aktuell(), { room: 'X' }));
}

console.log('— Teil 1b: Zoom-Teil nur bei Änderung melden (aenderungsMelder)');
{
  const gemeldet: Kv[] = [];
  const melde = aenderungsMelder((kv) => gemeldet.push(kv));
  melde({ ...ZOOM });
  ck('erster Aufruf meldet immer', gemeldet.length === 1 && gleich(gemeldet[0], ZOOM));
  melde({ ...ZOOM });
  ck('gleicher Inhalt (neues Objekt) → keine zweite Meldung', gemeldet.length === 1);
  melde({ ...ZOOM, zoom_cmd: 'ok', zoom_cmd_rejected: 0 });
  ck('ein Wert geändert (zoom_cmd) → Meldung', gemeldet.length === 2 && gemeldet[1].zoom_cmd === 'ok');
  melde(null);
  ck('null → leerer Teil {}', gemeldet.length === 3 && gleich(gemeldet[2], {}));
  melde(null);
  melde({});
  ck('… und kein zweites Mal', gemeldet.length === 3);
}

console.log('— Teil 1c: Zoom-Schlüssel = Variablen der Rolle connect, Namen mit Leerzeichen kommen ganz an');
{
  const kurz: ZoomKurz = {
    zustand: 'im_meeting', warten: null, erlaubnis: 'ja', quellen: 2, ohneBild: 0, sollOffen: 0,
    versuch: null, maengel: [], kopieLaeuft: false, befehl: { kennung: 'f3', abgelehnt: true },
  };
  const kv = stateKvAus(kurz);
  const variablen = CAPABILITIES.connect.variables.map((v) => v.id).filter((id) => id.startsWith('zoom_'));
  ck('stateKv() führt genau die sieben zoom_*-Variablen der Rolle connect',
    kv !== null && gleich(Object.keys(kv).sort(), [...variablen].sort()) && variablen.length === 7);
  ck('… zoom_cmd=f3, zoom_cmd_rejected=1', kv?.zoom_cmd === 'f3' && kv?.zoom_cmd_rejected === 1);

  const zeile = formatSuiteState({ ns: 'connect', kv: mischeState(RAUM, kv ? { ...kv } : {}) });
  const zurueck = parseSuiteState(zeile);
  ck('STATE-Zeile bleibt eine Zeile', zeile.indexOf('\n') === zeile.length - 1);
  ck('active_label „Anna Maria Beispiel“ kommt über die Leitung ganz an (17.2 Nr. 3)',
    zurueck?.ns === 'connect' && zurueck.kv.active_label === 'Anna Maria Beispiel' && zurueck.kv.zoom_status === 'im_meeting');
}

console.log('— Teil 1d: Weiche für Befehle des Steuerservers (Spec 11.2, Ergänzung 0.3)');
{
  const wege: string[] = [];
  const ziele = {
    zoom: (c: { verb: string; args: string[] }) => wege.push(`zoom ${c.verb} ${c.args.join(' ')}`.trim()),
    renderer: (c: { verb: string; args: string[] }) => wege.push(`renderer ${c.verb} ${c.args.join(' ')}`.trim()),
  };
  leiteSteuerbefehl({ verb: 'zoom_load', args: ['Anna', 'Maria'] }, ziele);
  ck('zoom_load geht nur an die Zoom-Hülle, mit allen Argumenten', gleich(wege, ['zoom zoom_load Anna Maria']));
  wege.length = 0;
  leiteSteuerbefehl({ verb: 'zoom_join', args: ['123'] }, ziele);
  ck('… auch ein unbekanntes zoom_* (nie an Renderer oder DO)', gleich(wege, ['zoom zoom_join 123']));
  wege.length = 0;
  leiteSteuerbefehl({ verb: 'go', args: [] }, ziele);
  leiteSteuerbefehl({ verb: 'onair', args: ['g7'] }, ziele);
  ck('go und onair gehen nur an den Renderer', gleich(wege, ['renderer go', 'renderer onair g7']));
}

console.log('— Teil 2: control-server.ts (Attrappen für Electron und den Steuerserver)');
{
  const g = globalThis as unknown as {
    __srv: { opts: null | { getState(): { ns: string; kv: Kv }; onCommand(c: { ns: string; verb: string; args: string[] }): void }; pushes: { ns: string; kv: Kv }[] };
  };
  g.__srv = { opts: null, pushes: [] };
  const ELECTRON = `export const app = { getPath: () => '.' };`;
  const SERVER = `
export class SuiteControlServer {
  constructor(opts) { globalThis.__srv.opts = opts; }
  start(port) { return Promise.resolve({ ok: true, port }); }
  stop() {}
  pushState(s) { globalThis.__srv.pushes.push(s); }
}`;
  registerHooks({
    resolve(spec, ctx, next) {
      if (spec === 'electron') return { url: 'mock:electron', shortCircuit: true };
      if (spec === '@jm/suite-control-protocol/server') return { url: 'mock:steuerserver', shortCircuit: true };
      return next(spec, ctx);
    },
    load(url, ctx, next) {
      if (url === 'mock:electron') return { format: 'module', source: ELECTRON, shortCircuit: true };
      if (url === 'mock:steuerserver') return { format: 'module', source: SERVER, shortCircuit: true };
      return next(url, ctx);
    },
  });
  const cs = await import('../src/main/control-server');

  // Vor dem Serverstart: beide Teile merken, noch nichts senden.
  cs.pushControlState(RAUM);
  cs.setZoomControlState(ZOOM);
  const befehle: string[] = [];
  const r = await cs.startControlServer({ onCommand: (c) => befehle.push(`${c.verb} ${c.args.join(' ')}`) });
  const opts = g.__srv.opts;
  ck('Start: Port 8737', r.ok === true && r.port === 8737);
  ck('Begrüßungs-STATE (getState) enthält Raum- und Zoom-Teil', opts !== null && gleich(opts.getState(), { ns: 'connect', kv: { ...RAUM, ...ZOOM } }));

  cs.pushControlState({ room: 'R2', onair: 0 });
  const nachRaum = g.__srv.pushes.at(-1);
  ck('Renderer-Push lässt zoom_* stehen (vorher ersetzte er alles)',
    nachRaum?.ns === 'connect' && nachRaum.kv.room === 'R2' && nachRaum.kv.zoom_status === 'im_meeting' && nachRaum.kv.zoom_cmd === 'f3');

  cs.setZoomControlState({ ...ZOOM, zoom_status: 'abriss' });
  const nachZoom = g.__srv.pushes.at(-1);
  ck('Zoom-Push lässt den Raum-Teil stehen', nachZoom?.kv.room === 'R2' && nachZoom.kv.zoom_status === 'abriss');

  cs.setZoomControlState({});
  ck('leerer Zoom-Teil → STATE ohne zoom_*', gleich(g.__srv.pushes.at(-1)?.kv, { room: 'R2', onair: 0 }) && gleich(opts?.getState().kv, { room: 'R2', onair: 0 }));
  ck('jeder Push nach dem Start geht hinaus (3)', g.__srv.pushes.length === 3);

  opts?.onCommand({ ns: 'timer', verb: 'start', args: [] });
  opts?.onCommand({ ns: 'connect', verb: 'zoom_load', args: ['Anna', 'Maria'] });
  ck('nur Befehle mit ns=connect erreichen Connect', gleich(befehle, ['zoom_load Anna Maria']));
  cs.stopControlServer();
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Step 2: Test laufen lassen (rot).**

Run (aus der Worktree-Wurzel): `npx tsx apps/connect/test/control-state.test.ts`
Expected: Abbruch vor dem ersten Fall mit
`Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\connect\src\main\control-state' imported from …\apps\connect\test\control-state.test.ts`, Exit-Code 1.

- [ ] **Step 3: `apps/connect/src/main/control-state.ts` anlegen.**

Neue Datei `apps/connect/src/main/control-state.ts` (ganzer Inhalt):
```ts
// STATE von JM Connect aus zwei Teilen (Spec 11.3): Den Raum-Teil (room, onair, lobby, active_label …)
// meldet der Operator-Renderer, den Zoom-Teil (zoom_status … zoom_cmd_rejected) die Zoom-Hülle. Jeder
// Push ersetzt nur seinen Teil; gesendet wird immer die Mischung. Vorher ersetzte jeder Renderer-Push den
// ganzen STATE und hätte die zoom_*-Werte gelöscht.
// Rein (G8: kein electron, keine Aliase), damit control-state.test.ts den Ablauf prüfen kann.

/** Ein STATE-Teil: key=value-Paare wie in SuiteState.kv. */
export type Kv = Record<string, string | number | boolean>;

/** Startwerte des Raum-Teils, bevor der Renderer zum ersten Mal meldet (wie bisher in control-server.ts). */
export const RAUM_START: Kv = { room: '', onair: 0, lobby: 0, guests: 0, talkback: 0 };

/** Raum-Teil und Zoom-Teil zu einem STATE. Die Schlüssel überschneiden sich nicht (zoom_* gehört nur Zoom). */
export function mischeState(raum: Kv, zoom: Kv): Kv {
  return { ...raum, ...zoom };
}

export interface StateSpeicher {
  /** Renderer-Push: ersetzt nur den Raum-Teil, dann senden. */
  raum(kv: Kv): void;
  /** Zoom-Hülle: ersetzt nur den Zoom-Teil, dann senden. `{}` ohne Zoom-Kern (macOS). */
  zoom(kv: Kv): void;
  /** Der aktuelle gemischte Stand (Kopie). */
  aktuell(): Kv;
}

/** Hält beide Teile und ruft `senden` nach jedem Push mit der Mischung (eine neue Kopie je Aufruf). */
export function erzeugeStateSpeicher(senden: (kv: Kv) => void, raumStart: Kv = RAUM_START): StateSpeicher {
  let raumKv: Kv = { ...raumStart };
  let zoomKv: Kv = {};
  const schicke = (): void => senden(mischeState(raumKv, zoomKv));
  return {
    raum(kv) {
      raumKv = { ...kv };
      schicke();
    },
    zoom(kv) {
      zoomKv = { ...kv };
      schicke();
    },
    aktuell: () => mischeState(raumKv, zoomKv),
  };
}

/**
 * Meldet einen STATE-Teil nur, wenn er sich geändert hat (Vergleich über JSON); der erste Aufruf meldet
 * immer, `null` gilt als leerer Teil `{}`. Für den Zoom-Teil: Spec 11.3 verlangt einen Push bei jeder
 * Änderung eines der sieben zoom_*-Werte, nicht bei jedem Abbild.
 */
export function aenderungsMelder(senden: (kv: Kv) => void): (kv: Kv | null) => void {
  let letzter: string | null = null;
  return (kv) => {
    const teil = kv ?? {};
    const json = JSON.stringify(teil);
    if (json === letzter) return;
    letzter = json;
    senden({ ...teil });
  };
}

/** Die beiden Ziele eines Steuerbefehls (index.ts): die Zoom-Hülle im Main und der Operator-Renderer (→ DO). */
export interface Steuerziele {
  zoom(cmd: { verb: string; args: string[] }): void;
  renderer(cmd: { verb: string; args: string[] }): void;
}

/**
 * Weiche für Befehle des Steuerservers (Spec 11.2, Ergänzung 0.3): zoom_* geht an die Zoom-Hülle im Main, nie an den
 * Renderer oder den DO; alles andere an den Renderer. Der Parser liefert das Verb klein.
 */
export function leiteSteuerbefehl(cmd: { verb: string; args: string[] }, ziele: Steuerziele): void {
  if (cmd.verb.startsWith('zoom_')) ziele.zoom(cmd);
  else ziele.renderer(cmd);
}
```

- [ ] **Step 4: Test laufen lassen (Teil 1 grün, Teil 2 rot).**

Run: `npx tsx apps/connect/test/control-state.test.ts`
Expected: 24 Zeilen `  ok  …` (Teile 1, 1b, 1c, 1d), dann Abbruch in Teil 2 mit `TypeError: cs.setZoomControlState is not a function`, Exit-Code 1.

- [ ] **Step 5: `control-server.ts`: Raum- und Zoom-Teil getrennt.** Zwei Ersetzungen.

Datei `apps/connect/src/main/control-server.ts`. Vorher (eindeutig, Zeilen 9–20):
```ts
// spiegelt ihn und meldet den abgeleiteten STATE via IPC hierher. controlEndpoint:true
// annonciert den Endpunkt per mDNS (TXT ctl=1, Name jm-connect-ctl) → Companion/Health
// finden ihn automatisch.
import { SuiteControlServer } from '@jm/suite-control-protocol/server';
import { app } from 'electron';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';

/** Eigener TCP-Steuerport (nächster nach Launcher 8736). */
export const CONTROL_PORT = 8737;

let server: SuiteControlServer | null = null;
let lastState: SuiteState = { ns: 'connect', kv: { room: '', onair: 0, lobby: 0, guests: 0, talkback: 0 } };
```
Nachher:
```ts
// spiegelt ihn und meldet den abgeleiteten STATE via IPC hierher. controlEndpoint:true
// annonciert den Endpunkt per mDNS (TXT ctl=1, Name jm-connect-ctl) → Companion/Health
// finden ihn automatisch.
//
// Zoom (Stage 4b, Spec 11.3): Die zoom_*-Werte meldet die Zoom-Hülle (setZoomControlState). Raum-Teil
// und Zoom-Teil liegen getrennt (control-state.ts); jeder Push ersetzt nur seinen Teil.
import { SuiteControlServer } from '@jm/suite-control-protocol/server';
import { app } from 'electron';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';
import { erzeugeStateSpeicher, type Kv } from './control-state';

/** Eigener TCP-Steuerport (nächster nach Launcher 8736). */
export const CONTROL_PORT = 8737;

let server: SuiteControlServer | null = null;
const stand = erzeugeStateSpeicher((kv) => {
  lastState = { ns: 'connect', kv };
  server?.pushState(lastState);
});
let lastState: SuiteState = { ns: 'connect', kv: stand.aktuell() };
```

Datei `apps/connect/src/main/control-server.ts`. Vorher (eindeutig, Zeilen 50–54):
```ts
/** Abgeleiteten Zustand (vom Operator-Renderer) an alle Steuer-Clients broadcasten. */
export function pushControlState(kv: Record<string, string | number | boolean>): void {
  lastState = { ns: 'connect', kv };
  server?.pushState(lastState);
}
```
Nachher:
```ts
/** Raum-Teil (vom Operator-Renderer) setzen und den gemischten STATE an alle Steuer-Clients broadcasten. */
export function pushControlState(kv: Kv): void {
  stand.raum(kv);
}

/** Zoom-Teil (von der Zoom-Hülle, nur bei Änderung) setzen und den gemischten STATE broadcasten. */
export function setZoomControlState(kv: Kv): void {
  stand.zoom(kv);
}
```

Hinweis: `stand` ruft `senden` erst beim ersten Push, nie beim Anlegen. Darum darf `let lastState` unter `const stand` stehen.

- [ ] **Step 6: Test laufen lassen (grün).**

Run: `npx tsx apps/connect/test/control-state.test.ts`
Expected: 31 Zeilen `  ok  …`, keine Zeile mit `FAIL`, letzte Zeile `31 ok, 0 fehlgeschlagen.`, Exit-Code 0.

- [ ] **Step 7: Gegenprobe (vorübergehend, danach zurücknehmen).**
  - a) 12.5 „Raum-Push ersetzt alles“: In `control-state.ts`, Methode `raum`, nach `raumKv = { ...kv };` die Zeile `zoomKv = {};` einfügen. Gemessen: `27 ok, 4 fehlgeschlagen.` (`Raum-Push lässt zoom_* stehen`, `zweiter Raum-Push …, Zoom bleibt`, `senden bekommt je Push …`, `Renderer-Push lässt zoom_* stehen …`).
  - b) Alte Verdrahtung: In `control-server.ts` den Körper von `pushControlState` wieder auf `lastState = { ns: 'connect', kv }; server?.pushState(lastState);` setzen. Gemessen: `27 ok, 4 fehlgeschlagen.` (`Begrüßungs-STATE …`, `Renderer-Push lässt zoom_* stehen …`, `Zoom-Push lässt den Raum-Teil stehen`, `leerer Zoom-Teil → STATE ohne zoom_*`).
  - c) „Nur bei Änderung“: In `aenderungsMelder` die Zeile `if (json === letzter) return;` entfernen. Gemessen: `27 ok, 4 fehlgeschlagen.` (die vier Fälle nach dem ersten in Teil 1b).
  - d) Weiche ohne `else` (jeder Befehl ginge zusätzlich an den Renderer und damit an den DO): In `leiteSteuerbefehl` `  else ziele.renderer(cmd);` durch `  ziele.renderer(cmd);` ersetzen. Gemessen: `29 ok, 2 fehlgeschlagen.` (`zoom_load geht nur an die Zoom-Hülle …`, `… auch ein unbekanntes zoom_* …`).
  - Alles zurücksetzen; Step 6 zeigt wieder `31 ok, 0 fehlgeschlagen.`

- [ ] **Step 8: `zoom.ts`: Zoom-Teil melden, `zoomSteuerbefehl`.** Fünf Ersetzungen.

Datei `apps/connect/src/main/zoom.ts`. Vorher (eindeutig):
```ts
import { activeLabels } from './ndi-guests';
```
Nachher:
```ts
import { activeLabels } from './ndi-guests';
import { setZoomControlState } from './control-server';
import { aenderungsMelder } from './control-state';
```

Datei `apps/connect/src/main/zoom.ts`. Vorher (eindeutig):
```ts
let kern: ZoomKern | null = null;
/** Ein offener Ordner-/Datei-Dialog genügt: ein Doppelklick öffnet keinen zweiten. */
let dialogOffen = false;
```
Nachher:
```ts
let kern: ZoomKern | null = null;
/** Ein offener Ordner-/Datei-Dialog genügt: ein Doppelklick öffnet keinen zweiten. */
let dialogOffen = false;
/** Zoom-Teil des STATE an den Steuerserver, nur wenn sich einer der sieben Werte geändert hat (Spec 11.3). */
const meldeZoomTeil = aenderungsMelder(setZoomControlState);

/**
 * Zoom-Teil des STATE melden: die zoom_*-Werte aus kern.stateKv(). Läuft einmal nach dem Anlegen des
 * Kerns und danach bei jeder Änderung der Kurzform (onKurz), nicht bei jedem Abbild. Ohne Kern (macOS)
 * meldet niemand einen Zoom-Teil, dort fehlen die zoom_*-Schlüssel im STATE (Spec 7.5).
 */
function meldeZoomState(): void {
  if (!kern) return;
  const kv = kern.stateKv();
  meldeZoomTeil(kv ? { ...kv } : null);
}
```

Datei `apps/connect/src/main/zoom.ts`. Vorher (eindeutig):
```ts
      onKurz: () => d.onKurz(),
```
Nachher:
```ts
      // Kurzform geändert: AppStatus an Tray und Kopfzeile, und den Zoom-Teil des STATE (nur bei Änderung).
      onKurz: () => {
        d.onKurz();
        meldeZoomState();
      },
```

Datei `apps/connect/src/main/zoom.ts`. Vorher (eindeutig):
```ts
    getLog().error('[zoom] Zoom-Kern ließ sich nicht anlegen:', e instanceof Error ? e.message : e);
    return;
  }
  registriereKanaele(kern, d);
```
Nachher:
```ts
    getLog().error('[zoom] Zoom-Kern ließ sich nicht anlegen:', e instanceof Error ? e.message : e);
    return;
  }
  // Erster STATE-Push: Der Kern meldet seinen Anfangszustand nicht über onKurz.
  meldeZoomState();
  registriereKanaele(kern, d);
```

Datei `apps/connect/src/main/zoom.ts`. Vorher (eindeutig):
```ts
/** Gast-Sender haben sich geändert: Kollisionsprüfung Gast ↔ Zoom neu rechnen (Spec 6.3). */
export function zoomGastLabelsGeaendert(): void {
  kern?.gastLabelsGeaendert();
}
```
Nachher:
```ts
/** Gast-Sender haben sich geändert: Kollisionsprüfung Gast ↔ Zoom neu rechnen (Spec 6.3). */
export function zoomGastLabelsGeaendert(): void {
  kern?.gastLabelsGeaendert();
}

/**
 * Fernsteuer-Verb zoom_* vom Steuerserver (Spec 11.2): geht an den Kern, nie an den Renderer oder den DO.
 * Ohne Kern (macOS) nur eine Logzeile und sonst nichts (L19). Die Logzeile nennt nur das Verb, nie die
 * Argumente, denn dort stehen Anzeigenamen (N4b.2).
 */
export function zoomSteuerbefehl(cmd: { verb: string; args: string[] }): void {
  if (!kern) {
    const grund = process.platform === 'win32' ? 'der Zoom-Kern ließ sich nicht anlegen' : 'Zoom gibt es nur unter Windows';
    getLog().info(`[zoom] Companion: ${cmd.verb} ignoriert (${grund})`);
    return;
  }
  try {
    kern.steuerbefehl({ verb: cmd.verb, args: [...cmd.args] });
  } catch (e) {
    getLog().error('[zoom] Fernsteuer-Befehl fehlgeschlagen:', e instanceof Error ? e.message : e);
  }
}
```

- [ ] **Step 9: `index.ts`: `zoom_*` im Main abzweigen (Spec 11.2, Ergänzung 0.3).** Zwei Ersetzungen.

Datei `apps/connect/src/main/index.ts`. Vorher (eindeutig, Zeile 15):
```ts
import { startZoom, zoomBeenden, zoomGastLabelsGeaendert, zoomLaeuft, zoomVerlassen } from './zoom';
```
Nachher:
```ts
import { startZoom, zoomBeenden, zoomGastLabelsGeaendert, zoomLaeuft, zoomSteuerbefehl, zoomVerlassen } from './zoom';
import { leiteSteuerbefehl } from './control-state';
```

Datei `apps/connect/src/main/index.ts`. Vorher (eindeutig, Zeilen 113–117; die Spec nennt noch `:97-99`):
```ts
    // Steuerprotokoll (Companion/Rundown): Befehle an den Operator-Renderer relayen,
    // der sie über die Raum-WS an den DO schickt.
    const res = await startControlServer({
      onCommand: (cmd) => getMainWindow()?.webContents.send(IPC.controlCommand, { verb: cmd.verb, args: cmd.args }),
    });
```
Nachher:
```ts
    // Steuerprotokoll (Companion/Rundown): zoom_*-Verben gehen an die Zoom-Hülle im Main, nie an den
    // Renderer oder den DO (Spec 11.2, Ergänzung 0.3). Alle anderen Befehle an den Operator-Renderer
    // relayen, der sie über die Raum-WS an den DO schickt.
    const res = await startControlServer({
      onCommand: (cmd) =>
        leiteSteuerbefehl(cmd, {
          zoom: zoomSteuerbefehl,
          renderer: (c) => getMainWindow()?.webContents.send(IPC.controlCommand, { verb: c.verb, args: c.args }),
        }),
    });
```

- [ ] **Step 10: `selftest`-Kette um `control-state.test.ts` (vor `after-pack`).**

Datei `apps/connect/package.json`. Vorher (eindeutig, Ende von Zeile 17):
```json
tsx test/sdk-laden.test.ts && node test/after-pack.test.mjs",
```
Nachher:
```json
tsx test/sdk-laden.test.ts && tsx test/control-state.test.ts && node test/after-pack.test.mjs",
```

- [ ] **Step 11: Typecheck (grün) und Abzweig zählen.**

Run:
```bash
npm run typecheck -w @jm/connect
grep -c "leiteSteuerbefehl(cmd" apps/connect/src/main/index.ts
```
Expected: keine Zeile mit `error TS`, Exit-Code 0; dann `1`.

- [ ] **Step 12: Bau und Bündel-Prüfung.**

Run:
```bash
npm run build -w @jm/connect
grep -cF 'startsWith("zoom_")' apps/connect/out/main/index.cjs
grep -cF 'function leiteSteuerbefehl' apps/connect/out/main/index.cjs
grep -cF 'function aenderungsMelder' apps/connect/out/main/index.cjs
grep -cF 'function mischeState' apps/connect/out/main/index.cjs
grep -cF 'ignoriert (${grund})' apps/connect/out/main/index.cjs
```
Expected: dreimal `✓ built in …` (main, preload, renderer), keine Zeile mit `error`; dann fünfmal `1` (gemessen).

- [ ] **Step 13: Selbsttest (grün).**

Run: `npm run selftest -w @jm/connect`
Expected: alle Dateien der Kette ohne Zeile, die mit `FAIL` beginnt; `zoom-text`, `zoom-laufzeit`, `zoom-teile`, `zoom-kern`, `zoom-settings` und `sdk-laden` mit denselben Zählständen wie nach Aufgabe 13; neu `31 ok, 0 fehlgeschlagen.` (`control-state`); `Alle after-pack-Tests bestanden.`; Exit-Code 0.

- [ ] **Step 14: Commit.**

```bash
git add apps/connect/src/main/control-state.ts apps/connect/src/main/control-server.ts apps/connect/src/main/zoom.ts apps/connect/src/main/index.ts apps/connect/package.json apps/connect/test/control-state.test.ts
git status --short
```
Erwartet genau diese gestagten Zeilen (sonst nichts Gestagtes):
```
M  apps/connect/package.json
M  apps/connect/src/main/control-server.ts
A  apps/connect/src/main/control-state.ts
M  apps/connect/src/main/index.ts
M  apps/connect/src/main/zoom.ts
A  apps/connect/test/control-state.test.ts
```
Dann:
```bash
git commit -m "feat(connect): STATE aus Raum- und Zoom-Teil; zoom_*-Befehle im Main" -m "control-state.ts haelt den Raum-Teil (Renderer) und den Zoom-Teil (Zoom-Huelle) getrennt; jeder Push ersetzt nur seinen Teil, gesendet wird die Mischung (Spec 11.3). Die Zoom-Huelle meldet kern.stateKv() nach dem Anlegen und bei jeder Aenderung eines Werts. zoom_*-Verben zweigen im Main ab und gehen an den Kern, nie an den Renderer oder den DO (Spec 11.2); ohne Kern (macOS) nur eine Logzeile. control-state.test.ts prueft beides, control-server.ts mit Attrappen fuer Electron und den Steuerserver (#197)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Nicht pushen.

**Neue Logzeilen:** `[zoom] Companion: <verb> ignoriert (Zoom gibt es nur unter Windows)` bzw. `… (der Zoom-Kern ließ sich nicht anlegen)` (info, nur ohne Kern), `[zoom] Fernsteuer-Befehl fehlgeschlagen: <Meldung>` (error). Keine nennt Argumente, Namen, Nummer oder Kenncode.

**Abweichungen von der Gliederung:**
1. **`control-server.ts` ist doch testbar** (L20 sagte „nicht testbar“; übernommen, Montage MO5): Teil 2 von `control-state.test.ts` lädt die echte Datei mit Attrappen für `electron` und `@jm/suite-control-protocol/server` über `registerHooks`, wie `zoom-settings.test.ts`. Die Gegenprobe 12.5 trifft so die Stelle, an der der Altfehler saß. `erzeugeStateSpeicher` bleibt trotzdem, wie L20 vorsieht.
2. **Zusätzlich `aenderungsMelder`** in `control-state.ts`: Der Vergleich „JSON von `kern.stateKv()` geändert?“ steht dort statt in `zoom.ts` und ist getestet (Teil 1b, Gegenprobe c). `zoom.ts` ruft ihn im `onKurz` und einmal nach dem Anlegen, wie im Auftrag.
3. **Zusätzliche Exporte** `RAUM_START` und `interface StateSpeicher` (Startwerte stehen nur noch an einer Stelle).
4. **Teil 1c** prüft über Paketgrenzen: Die Schlüssel von `stateKvAus` sind genau die sieben `zoom_*`-Variablen aus `CAPABILITIES.connect`, und eine STATE-Zeile mit Connects echten Schlüsseln bringt „Anna Maria Beispiel“ ganz zurück. Der Test setzt Aufgabe 14 voraus; die Fixture `ZoomKurz` setzt genau die Felder aus Aufgabe 4 voraus (kommt in einer früheren Aufgabe ein Pflichtfeld dazu, muss es hier ergänzt werden).
5. **Logzeile ohne Kern** unterscheidet macOS und „Kern ließ sich nicht anlegen“ (Windows). Sonst stünde unter Windows nach einem Startfehler „nur unter Windows“ im Log.
6. **Zeilenangabe** `index.ts`: Spec nennt `:97-99`, Ist ist `:113-117`.
7. **Nachbesserung: Weiche `leiteSteuerbefehl` in `control-state.ts`** (rein, Teil 1d, Gegenprobe d). Die erste Fassung zweigte `zoom_*` direkt in `index.ts` ab und belegte das nur mit einem Textzähler; ein fehlendes `return` hätte den Befehl zusätzlich an Renderer und DO geschickt, und der Test wäre grün geblieben. `index.ts` ruft jetzt nur noch die Weiche; geprüft sind dort Typecheck, Bau und die Bündel-Suche.

---

### Task 16: Companion-Modul 0.2.0 und CI-Schritte

**Spec:** 11.4 Nr. 1–3, Ergänzung 0.12, 12.6 (CI, „`npm rebuild esbuild`“), 17.2 Nr. 2 (Abnahmekriterium 1/2/5 Gäste) und Nr. 3, 17.3 (Modul 0.2.0, Master-Link 2b), Plan-Entscheidungen L8, L9, L18.

**Files:**
- Modify: `packages/companion-jm-suite/lib.mjs:54-57` (`isTruthy`)
- Test: `packages/companion-jm-suite/test/selftest.mjs:6-8` (Importe), nach `:116` (neue Blöcke)
- Modify: `scripts/sync-companion-protocol.mjs:35` (`absWorkingDir`, Abweichung 1)
- Regenerate: `packages/companion-jm-suite/generated/protocol.mjs` (`node scripts/sync-companion-protocol.mjs`)
- Modify: `packages/companion-jm-suite/package.json:3-5` (Version, Beschreibung)
- Modify: `packages/companion-jm-suite/companion/manifest.json:5-6` (Beschreibung, Version), `:31-33` (`products`)
- Modify: `packages/companion-jm-suite/README.md:4-5`, `:20`, `:31-33`, `:53-54`, `:60`
- Modify: `.github/workflows/ci-checks.yml:67-68` (vier Schritte danach, Job `selftests`)

**Interfaces:**
- Consumes: Aufgabe 14 (`CAPABILITIES.connect` mit den Zoom-Teilen, `formatSuiteState`/`parseSuiteState` mit Kodierung). `npm run selftest -w @jm/app-runtime` existiert schon (`node --experimental-strip-types test/selftest.ts`, gemessen `15 passed, 0 failed`); Aufgabe 17 erweitert ihn, der CI-Schritt läuft auch ohne sie.
- Produces:
```js
// packages/companion-jm-suite/lib.mjs
/** '1', 'an', 'true' oder eine positive ganze Zahl (Anzahl > 0) → true (L9). */
export function isTruthy(v)   // v === 'an' || v === 'true' || (typeof v === 'string' && /^[1-9]\d*$/.test(v))
// packages/companion-jm-suite/generated/protocol.mjs: neu erzeugt, mit Rolle connect (12/16/6),
//   Titler graphic/slot, kodiereStateWert/dekodiereStateWert; Ausgabe unabhängig vom Arbeitsordner
// Modul-Version 0.2.0 (package.json, companion/manifest.json), „JM Connect“ in products und beiden Beschreibungen
```
```yaml
# .github/workflows/ci-checks.yml, Job selftests, nach dem Connect-Schritt
      - name: Steuerprotokoll (STATE-Kodierung, Capabilities)
        run: npm run selftest -w @jm/suite-control-protocol
      - name: Companion-Modul (Zeilenbau, Feedbacks, STATE)
        run: node packages/companion-jm-suite/test/selftest.mjs
      - name: Companion-Protokoll aktuell
        run: npm rebuild esbuild && node scripts/sync-companion-protocol.mjs && git diff --exit-code -- packages/companion-jm-suite/generated/protocol.mjs
      - name: App-Laufzeit (Log-Aufräumen, CSP)
        run: npm run selftest -w @jm/app-runtime
```

**Vorab (für den Umsetzer):**
- Stand: nach Aufgaben 1–15. Das Modul, das Sync-Skript und `ci-checks.yml` sind seit dem Ausgangsstand unverändert; Master-Link 2b hat Steuerprotokoll und Modul nicht angefasst (Ist-Karte). Jeder Vorher-Ausschnitt kommt genau einmal vor.
- Das Modul liegt außerhalb der npm-Workspaces. Sein Selbsttest braucht nur Node (er lädt `generated/protocol.mjs`, `lib.mjs`, `auth.mjs` mit `node:crypto` und neu `node:fs`), kein `@companion-module/base`. Ausgabe je Fall `ok   <Name>` bzw. `FAIL <Name>`, Schluss `ALLE TESTS OK` oder `<n> FEHLER`; gezählt wird mit `grep -c "^ok "`.
- Ausgangszählstand (gemessen): `36` Zeilen `ok`, davon eine `ok   Round-Trip: 86 Actions bauen gültige, parsebare Protokollzeilen`.
- `generated/protocol.mjs` wird nie von Hand bearbeitet. esbuild schreibt sie mit LF; der Arbeitsbaum hat CRLF. Das ist für git gleich (gemessen: `git hash-object --path=…` liefert für LF- und CRLF-Fassung dieselbe Blob-ID), `git diff` zeigt danach nur echte Änderungen.
- **Falle (gemessen):** esbuild schreibt die Quellpfade als Kommentar relativ zum Arbeitsordner. `npm run sync` im Modulordner (Spec 11.4 Nr. 1, README) erzeugte darum `// ../suite-control-protocol/src/index.ts`, der Aufruf aus der Wurzel `// packages/suite-control-protocol/src/index.ts`. Der CI-Schritt „Companion-Protokoll aktuell“ wäre nach einem `npm run sync` rot gewesen. Step 9 setzt `absWorkingDir`.
- **`npm rebuild esbuild` (gemessen unter Windows):** `esbuild@0.21.5`, frisch mit `npm install --ignore-scripts` in einen Scratch-Ordner gelegt, baut ohne Postinstall (`build()` lief durch); ebenso lief der Sync gegen die `node_modules` dieses Worktrees, in denen npm die Postinstall von esbuild nicht ausgeführt hat (`allow-scripts`-Warnung im Installationslog). Unter Linux ist es ungemessen. Der Schritt bleibt als Vorsorge (Spec 12.6). Lokal wird `npm rebuild esbuild` nicht gebraucht und nicht ausgeführt.
- Keine Versionsnummer außer der des Moduls (G11, L18), kein Release, kein `npm run build:local` in dieser Aufgabe (Abschnitt „Nach der Umsetzung“).

#### Zyklus 1: `isTruthy` wertet Anzahlen > 0 als wahr (17.2 Nr. 2, L9)

- [ ] **Step 1: Ausgangszählstand messen.**

Run: `node packages/companion-jm-suite/test/selftest.mjs | grep -c "^ok "`
Expected: `36`.

- [ ] **Step 2: Fehlschlagende Tests schreiben.**

Datei `packages/companion-jm-suite/test/selftest.mjs`. Vorher (eindeutig, Zeile 8):
```js
import { buildCommandLine, matchesRole, isControlService, pickEndpoint } from '../lib.mjs'
```
Nachher:
```js
import { buildCommandLine, matchesRole, isControlService, pickEndpoint, isTruthy } from '../lib.mjs'
```

Datei `packages/companion-jm-suite/test/selftest.mjs`. Vorher (eindeutig, Zeile 116):
```js
eq(normalizeFingerprint('AB:CD:EF:01'), normalizeFingerprint('abcdef01'), 'normalizeFingerprint: beide Seiten vergleichbar')
```
Nachher:
```js
eq(normalizeFingerprint('AB:CD:EF:01'), normalizeFingerprint('abcdef01'), 'normalizeFingerprint: beide Seiten vergleichbar')

// ── isTruthy: Anzahlen > 0 leuchten (Zoom Stage 4b, Spec 17.2 Nr. 2, L9) ────────
// onair und lobby der Rolle connect sind Anzahlen. Bei 2 Gästen auf Sendung blieb
// die Taste bisher dunkel, weil nur '1', 'an' und 'true' als wahr galten.
for (const v of ['1', '2', '5', '17', 'an', 'true']) eq(isTruthy(v), true, `isTruthy(${JSON.stringify(v)}) → an`)
for (const v of ['0', '', '-1', '01', '1.5', '2 ', 'aus', 'false', undefined]) eq(isTruthy(v), false, `isTruthy(${JSON.stringify(v)}) → aus`)
```

- [ ] **Step 3: Test laufen lassen (rot).**

Run: `node packages/companion-jm-suite/test/selftest.mjs`
Expected: `FAIL isTruthy("2") → an`, `FAIL isTruthy("5") → an`, `FAIL isTruthy("17") → an`, Schluss `3 FEHLER`, Exit-Code 1 (48 Zeilen `ok`).

- [ ] **Step 4: `isTruthy` ändern.**

Datei `packages/companion-jm-suite/lib.mjs`. Vorher (eindeutig, Zeilen 54–57):
```js
/** Ein STATE-Feld als Boolean interpretieren (für truthy-Feedbacks). */
export function isTruthy(v) {
  return v === '1' || v === 'an' || v === 'true';
}
```
Nachher:
```js
/**
 * Ein STATE-Feld als Boolean interpretieren (für truthy-Feedbacks): '1', 'an', 'true' oder eine
 * positive ganze Zahl. So leuchten auch Anzahlen wie onair=2 (Gäste auf Sendung) oder lobby=5
 * (Zoom Stage 4b, Spec 17.2 Nr. 2). '0', leer, negativ, mit führender Null oder Leerraum → aus.
 */
export function isTruthy(v) {
  return v === 'an' || v === 'true' || (typeof v === 'string' && /^[1-9]\d*$/.test(v));
}
```
(`buildCommandLine` löst `toggle` weiter mit `'1'`/`'an'`/`'true'` auf; das betrifft nur Schalter wie `talkback`, die `1`/`0` führen.)

- [ ] **Step 5: Test laufen lassen (grün).**

Run:
```bash
node packages/companion-jm-suite/test/selftest.mjs
node packages/companion-jm-suite/test/selftest.mjs | grep -c "^ok "
```
Expected: `ALLE TESTS OK`, Exit-Code 0; Zählung `51` (36 + 15).

#### Zyklus 2: Rolle JM Connect, Titler `graphic`/`slot`, Namen mit Leerzeichen, Modul 0.2.0 (Spec 11.4)

- [ ] **Step 6: Fehlschlagende Tests schreiben.** Drei Ersetzungen.

Datei `packages/companion-jm-suite/test/selftest.mjs`. Vorher (eindeutig, Zeile 6):
```js
import crypto from 'node:crypto'
```
Nachher:
```js
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
```

Datei `packages/companion-jm-suite/test/selftest.mjs`. Vorher (eindeutig, Zeile 7):
```js
import { CAPABILITIES, KNOWN_ROLES, parseSuiteCommand, parseAuthReq, formatAuth, isAuthOk, isAuthFail } from '../generated/protocol.mjs'
```
Nachher:
```js
import { CAPABILITIES, KNOWN_ROLES, parseSuiteCommand, parseSuiteState, formatSuiteState, parseAuthReq, formatAuth, isAuthOk, isAuthFail } from '../generated/protocol.mjs'
```

Datei `packages/companion-jm-suite/test/selftest.mjs`. Vorher (eindeutig, aus Step 2):
```js
for (const v of ['0', '', '-1', '01', '1.5', '2 ', 'aus', 'false', undefined]) eq(isTruthy(v), false, `isTruthy(${JSON.stringify(v)}) → aus`)
```
Nachher:
```js
for (const v of ['0', '', '-1', '01', '1.5', '2 ', 'aus', 'false', undefined]) eq(isTruthy(v), false, `isTruthy(${JSON.stringify(v)}) → aus`)

// ── Rolle JM Connect samt Zoom, Titler graphic/slot (Zoom Stage 4b, Spec 11.4, Ergänzung 0.12) ──
// Kommt erst mit der Neu-Generierung von generated/protocol.mjs ins Modul (npm run sync).
const C = CAPABILITIES.connect
eq(KNOWN_ROLES.includes('connect'), true, 'Rolle connect ist im Modul wählbar (KNOWN_ROLES)')
eq(C?.label ?? null, 'JM Connect', 'Rolle connect heißt „JM Connect“')
eq(C ? [C.actions.length, C.variables.length, C.feedbacks.length] : null, [12, 16, 6], 'connect: 12 Aktionen, 16 Variablen, 6 Feedbacks (9/9/3 + Zoom)')
eq(['zoom_load', 'zoom_unload', 'zoom_delay'].every((id) => C?.actions.some((a) => a.id === id && a.verb === id)), true, 'connect: zoom_load, zoom_unload, zoom_delay')
eq(['graphic', 'slot'].every((id) => CAPABILITIES.titler.actions.some((a) => a.id === id)), true, 'titler: graphic und slot')
const zl = C?.actions.find((a) => a.id === 'zoom_load')
const zeile = zl ? buildCommandLine('connect', zl, { name: 'Anna Maria' }, {}) : null
eq(zeile, 'CONNECT ZOOM_LOAD Anna Maria', 'zoom_load mit „Anna Maria“ → CONNECT ZOOM_LOAD Anna Maria')
const geparst = zeile ? parseSuiteCommand(zeile) : null
eq(geparst ? [geparst.ns, geparst.verb, geparst.args.join(' ')] : null, ['connect', 'zoom_load', 'Anna Maria'], '… Connect liest ns, verb und den ganzen Namen (args.join)')
const zu = C?.actions.find((a) => a.id === 'zoom_unload')
eq(zu ? buildCommandLine('connect', zu, { name: 'Ben' }, {}) : null, 'CONNECT ZOOM_UNLOAD Ben', 'zoom_unload Ben → CONNECT ZOOM_UNLOAD Ben')
const zd = C?.actions.find((a) => a.id === 'zoom_delay')
eq(zd ? buildCommandLine('connect', zd, { ms: 300 }, {}) : null, 'CONNECT ZOOM_DELAY 300', 'zoom_delay 300 → CONNECT ZOOM_DELAY 300')
const go = C?.actions.find((a) => a.id === 'go')
eq(go ? buildCommandLine('connect', go, {}, {}) : null, 'CONNECT GO', 'connect GO (Connect erstmals per Companion steuerbar)')
const st = parseSuiteState('STATE ns=connect onair=2 lobby=0 active_label=Anna%20Maria%20Beispiel zoom_status=im_meeting zoom_cmd=')
eq(st ? [matchesRole('connect', st.ns), st.kv.active_label, st.kv.zoom_cmd] : null, [true, 'Anna Maria Beispiel', ''], 'STATE: „Anna Maria Beispiel“ kommt ganz in der Variable an (17.2 Nr. 3), zoom_cmd leer')
eq(parseSuiteState(formatSuiteState({ ns: 'connect', kv: { standby_label: 'Jörg Müller' } }))?.kv.standby_label, 'Jörg Müller', 'STATE-Rundweg mit Leerzeichen über das Modul-Protokoll')
// Feedbacks wie main.js buildFeedbacks: Abnahmekriterium 17.2 Nr. 2 – 1, 2 und 5 Gäste → an, 0 → aus.
const leuchtet = (id, wert) => {
  const f = C?.feedbacks.find((x) => x.id === id)
  return f ? f.match === 'truthy' && isTruthy(wert) : null
}
for (const id of ['onair', 'lobby', 'zoom_live', 'zoom_alarm', 'zoom_cmd_rejected']) {
  eq(['1', '2', '5', '0'].map((w) => leuchtet(id, w)), [true, true, true, false], `Feedback ${id}: 1, 2, 5 → an; 0 → aus`)
}
// Modul-Kopf (Spec 11.4 Nr. 2): eine Version in package.json und manifest.json, JM Connect genannt.
const lies = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'))
const paket = lies('../package.json')
const manifest = lies('../companion/manifest.json')
eq(manifest.version, paket.version, 'Version in companion/manifest.json = package.json')
eq(
  [manifest.products.includes('JM Connect'), manifest.description.includes('Connect'), paket.description.includes('Connect')],
  [true, true, true],
  'JM Connect in products und in beiden Beschreibungen',
)
```

- [ ] **Step 7: Test laufen lassen (rot).**

Run: `node packages/companion-jm-suite/test/selftest.mjs`
Expected: 18 Zeilen `FAIL …` (alle Fälle des neuen Blocks außer `Version in companion/manifest.json = package.json`: beide stehen noch auf 0.1.0), Schluss `18 FEHLER`, Exit-Code 1; 52 Zeilen `ok`, darunter weiter `Round-Trip: 86 Actions …`.

- [ ] **Step 8: Den Sync-Fehler nachweisen (vor dem Fix, nichts behalten).**

Run (aus der Worktree-Wurzel):
```bash
node scripts/sync-companion-protocol.mjs
head -4 packages/companion-jm-suite/generated/protocol.mjs | tail -1
npm run sync --prefix packages/companion-jm-suite
head -4 packages/companion-jm-suite/generated/protocol.mjs | tail -1
```
Expected (gemessen): erst `// packages/suite-control-protocol/src/index.ts`, nach `npm run sync` im Modulordner `// ../suite-control-protocol/src/index.ts`. Die Datei bleibt bis Step 10 ungestagt; Step 10 erzeugt sie neu.

- [ ] **Step 9: Sync-Skript unabhängig vom Arbeitsordner.**

Datei `scripts/sync-companion-protocol.mjs`. Vorher (eindeutig, Zeilen 35–39):
```js
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outfile: outFile,
```
Nachher:
```js
  // esbuild schreibt die Quellpfade als Kommentare relativ zum Arbeitsordner. Fest auf die Repo-Wurzel,
  // sonst ergäbe `npm run sync` im Modulordner „// ../suite-control-protocol/…“ statt
  // „// packages/suite-control-protocol/…“, und der CI-Schritt „Companion-Protokoll aktuell“ würde rot.
  absWorkingDir: root,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outfile: outFile,
```

- [ ] **Step 10: Protokoll neu erzeugen und Determinismus messen.**

Run:
```bash
node scripts/sync-companion-protocol.mjs
sha256sum packages/companion-jm-suite/generated/protocol.mjs
node scripts/sync-companion-protocol.mjs
sha256sum packages/companion-jm-suite/generated/protocol.mjs
npm run sync --prefix packages/companion-jm-suite
sha256sum packages/companion-jm-suite/generated/protocol.mjs
head -4 packages/companion-jm-suite/generated/protocol.mjs | tail -1
grep -c "kodiereStateWert" packages/companion-jm-suite/generated/protocol.mjs
git diff --stat -- packages/companion-jm-suite/generated/protocol.mjs
```
Expected (gemessen): dreimal `✓ generiert: packages/companion-jm-suite/generated/protocol.mjs` und dreimal **dieselbe** Prüfsumme (zweimal aus der Wurzel, einmal aus dem Modulordner); `// packages/suite-control-protocol/src/index.ts`; `6`; `1 file changed, 108 insertions(+), 4 deletions(-)` (neu: Rolle `connect` samt Zoom, Titler `graphic`/`slot` mit der Wahl `graphic` beim Typ, Kodierung). Die Zeilenzahl hängt am genauen Text der Aufgabe 14; weicht sie ab, zählt das Ergebnis von Step 13.

- [ ] **Step 11: Modul 0.2.0 mit JM Connect (Spec 11.4 Nr. 2).** Drei Ersetzungen.

Datei `packages/companion-jm-suite/package.json`. Vorher (eindeutig, Zeilen 3–5):
```json
  "version": "0.1.0",
  "type": "module",
  "description": "Bitfocus Companion module for the JM Production Suite — one module, all tools (Switcher/Timer/Player/Titler/Presenter/Prompter/Recorder/DAW)",
```
Nachher:
```json
  "version": "0.2.0",
  "type": "module",
  "description": "Bitfocus Companion module for the JM Production Suite — one module, all tools (Switcher/Timer/Player/Titler/Presenter/Prompter/Recorder/DAW/Connect)",
```

Datei `packages/companion-jm-suite/companion/manifest.json`. Vorher (eindeutig, Zeilen 5–6):
```json
  "description": "Steuert die JM Production Suite (Switcher, Timer, Player, Titler, Presenter, Prompter, Recorder, DAW) über TCP. Eine Verbindung je Tool — Rolle wählen, Rest wird automatisch generiert.",
  "version": "0.1.0",
```
Nachher:
```json
  "description": "Steuert die JM Production Suite (Switcher, Timer, Player, Titler, Presenter, Prompter, Recorder, DAW, Connect) über TCP. Eine Verbindung je Tool — Rolle wählen, Rest wird automatisch generiert.",
  "version": "0.2.0",
```

Datei `packages/companion-jm-suite/companion/manifest.json`. Vorher (eindeutig, Zeilen 31–33):
```json
    "JM Audio Recorder",
    "JM DAW"
  ],
```
Nachher:
```json
    "JM Audio Recorder",
    "JM DAW",
    "JM Connect"
  ],
```

Prüfung: `node -p "require('./packages/companion-jm-suite/package.json').version + ' ' + require('./packages/companion-jm-suite/companion/manifest.json').version"` → `0.2.0 0.2.0`.

- [ ] **Step 12: README des Moduls.** Fünf Ersetzungen.

Datei `packages/companion-jm-suite/README.md`. Vorher (eindeutig, Zeilen 4–5):
```markdown
> gibt es **eine** Verbindung je Tool: Rolle wählen (Switcher, Timer, Player,
> Titler, Presenter, Prompter, Recorder, DAW) — Actions, Feedbacks (Button-
```
Nachher:
```markdown
> gibt es **eine** Verbindung je Tool: Rolle wählen (Switcher, Timer, Player,
> Titler, Presenter, Prompter, Recorder, DAW, Connect …) — Actions, Feedbacks (Button-
```

Datei `packages/companion-jm-suite/README.md`. Vorher (eindeutig, Zeile 20):
```markdown
     Prompter 8727, Presenter 8728, Recorder 8729, DAW 8730.
```
Nachher:
```markdown
     Prompter 8727, Presenter 8728, Recorder 8729, DAW 8730, Connect 8737.
```

Datei `packages/companion-jm-suite/README.md`. Vorher (eindeutig, Zeilen 31–33):
```markdown
> Switcher ist der Sonderfall ohne Marker; das Modul erkennt ihn an `role=switcher`.

## Aufbau
```
Nachher:
```markdown
> Switcher ist der Sonderfall ohne Marker; das Modul erkennt ihn an `role=switcher`.

**Feedbacks „an/aus“** leuchten bei `1`, `an`, `true` **und bei jeder positiven
ganzen Zahl** (ab Modul 0.2.0). So leuchtet „Connect: es ist ein Gast auf
Sendung“ auch bei 2 oder 5 Gästen; bei `0` ist die Taste aus.

**Namen mit Leerzeichen** kommen ab Modul 0.2.0 ganz in der Variable an: Das Tool
schreibt Leerraum und `%` im STATE als `%XX` (z. B. `Anna%20Maria`), das Modul
liest es zurück. Ein Tool, das noch ohne diese Kodierung sendet, wird unverändert
gelesen.

## Rolle „JM Connect“ (ab Modul 0.2.0)

Bis Modul 0.1.0 fehlte die Rolle ganz; mit 0.2.0 ist Connect erstmals steuerbar
(Port 8737, mDNS `jm-connect-ctl`).

- **Raum:** GO, NEXT, Standby, Auf Sendung, Aus Sendung, Freigeben, Talkback,
  Folien-Steuerung, Entfernen (Gast-ID); Variablen `room`, `guests`, `lobby`,
  `onair`, `active_label`, `standby`, `standby_label`, `talkback`, `connected`.
- **Zoom (nur Connect unter Windows):**
  - Aktionen „Zoom: Person als Quelle laden“ (`CONNECT ZOOM_LOAD <Anzeigename>`),
    „Zoom: Quelle entladen“ (`CONNECT ZOOM_UNLOAD <Anzeigename>`) und
    „Zoom: Bild-Versatz setzen“ (`CONNECT ZOOM_DELAY <ms>`, 0–1000). Der
    Anzeigename ist der Name in Zoom; Leerzeichen sind erlaubt
    („Anna Maria“). Beitreten oder Verlassen geht nicht per Companion.
  - Variablen `zoom_status`, `zoom_sources`, `zoom_live`, `zoom_privilege`,
    `zoom_alarm`, `zoom_cmd` (Ergebnis des letzten Zoom-Befehls: `ok` oder
    `f1` … `f8`, vor dem ersten Befehl leer) und `zoom_cmd_rejected` (1/0).
  - Feedbacks „Zoom-Quellen geladen“ (grün), „Zoom braucht einen Eingriff“
    (rot) und „letzter Zoom-Befehl abgelehnt“ (gelb). Den Grund einer Ablehnung
    zeigt JM Connect im Fenster unter „Hinweise“.
- Unter macOS sendet Connect keine `zoom_*`-Werte (die Variablen bleiben leer);
  Zoom-Befehle schreibt Connect dort nur ins Log.
- JM Rundown bietet die Zoom-Aktionen erst mit seinem nächsten Release an.

## Aufbau
```

Datei `packages/companion-jm-suite/README.md`. Vorher (eindeutig, Zeilen 53–54):
```markdown
Die generierte Datei ist eingecheckt, damit das Modul ohne Monorepo-Quelle
baubar/verteilbar bleibt.
```
Nachher:
```markdown
Die generierte Datei ist eingecheckt, damit das Modul ohne Monorepo-Quelle
baubar/verteilbar bleibt. `npm run sync` hier und `node scripts/sync-companion-protocol.mjs`
in der Repo-Wurzel erzeugen dieselbe Datei, Byte für Byte. Der CI-Schritt
„Companion-Protokoll aktuell“ erzeugt sie neu und wird rot, sobald die eingecheckte
Datei von den Capabilities abweicht.
```

Datei `packages/companion-jm-suite/README.md`. Vorher (eindeutig, Zeile 60):
```markdown
npm run selftest  # Zeilenbau + Round-Trip + Discovery-Auswahl (ohne Companion-Runtime)
```
Nachher:
```markdown
npm run selftest  # Zeilenbau + Round-Trip + Discovery-Auswahl + Feedbacks/Rolle Connect/STATE (ohne Companion-Runtime)
```

- [ ] **Step 13: Test laufen lassen (grün).**

Run:
```bash
node packages/companion-jm-suite/test/selftest.mjs
node packages/companion-jm-suite/test/selftest.mjs | grep -c "^ok "
node packages/companion-jm-suite/test/selftest.mjs | grep "Round-Trip"
```
Expected: keine `FAIL`-Zeile, `ALLE TESTS OK`, Exit-Code 0; Zählung `70` (51 + 19); `ok   Round-Trip: 100 Actions bauen gültige, parsebare Protokollzeilen` (86 + 12 Connect + 2 Titler).

- [ ] **Step 14: Gegenprobe 17.2 Nr. 2 (vorübergehend, danach zurücknehmen).**

In `lib.mjs` die alte Zeile `return v === '1' || v === 'an' || v === 'true';` einsetzen und `node packages/companion-jm-suite/test/selftest.mjs` laufen lassen. Gemessen: `8 FEHLER` (`isTruthy("2")`, `isTruthy("5")`, `isTruthy("17")` und alle fünf `Feedback …: 1, 2, 5 → an; 0 → aus`). Zurücknehmen; Step 13 zeigt wieder `70`.

- [ ] **Step 15: CI-Schritte (Spec 12.6).**

Datei `.github/workflows/ci-checks.yml`. Vorher (eindeutig, Zeilen 67–68):
```yaml
      - name: Connect (Zoom-Kern gegen die Attrappe, Laufzeit, Statustexte)
        run: npm run selftest -w @jm/connect
```
Nachher:
```yaml
      - name: Connect (Zoom-Kern gegen die Attrappe, Laufzeit, Statustexte)
        run: npm run selftest -w @jm/connect
      # Zoom Stage 4b (Spec 12.6, 17.2 Nr. 2/3, N4b.2). Das Companion-Modul liegt außerhalb der
      # Workspaces; sein Selbsttest braucht nur Node. „npm rebuild esbuild“ ist Vorsorge (Spec 12.6):
      # Unter Windows lief esbuild ohne seine Postinstall, unter Linux nach `npm ci --ignore-scripts`
      # ist das ungemessen.
      - name: Steuerprotokoll (STATE-Kodierung, Capabilities)
        run: npm run selftest -w @jm/suite-control-protocol
      - name: Companion-Modul (Zeilenbau, Feedbacks, STATE)
        run: node packages/companion-jm-suite/test/selftest.mjs
      - name: Companion-Protokoll aktuell
        run: npm rebuild esbuild && node scripts/sync-companion-protocol.mjs && git diff --exit-code -- packages/companion-jm-suite/generated/protocol.mjs
      - name: App-Laufzeit (Log-Aufräumen, CSP)
        run: npm run selftest -w @jm/app-runtime
```

Run (YAML lesen lassen; `js-yaml` liegt als Abhängigkeit von electron-builder in `node_modules`):
```bash
node -e "const y=require('js-yaml');const d=y.load(require('fs').readFileSync('.github/workflows/ci-checks.yml','utf8'));for (const s of d.jobs.selftests.steps.slice(-5)) console.log(s.name+' => '+s.run)"
git diff --stat -- .github/workflows/ci-checks.yml
```
Expected: genau diese fünf Zeilen
```
Connect (Zoom-Kern gegen die Attrappe, Laufzeit, Statustexte) => npm run selftest -w @jm/connect
Steuerprotokoll (STATE-Kodierung, Capabilities) => npm run selftest -w @jm/suite-control-protocol
Companion-Modul (Zeilenbau, Feedbacks, STATE) => node packages/companion-jm-suite/test/selftest.mjs
Companion-Protokoll aktuell => npm rebuild esbuild && node scripts/sync-companion-protocol.mjs && git diff --exit-code -- packages/companion-jm-suite/generated/protocol.mjs
App-Laufzeit (Log-Aufräumen, CSP) => npm run selftest -w @jm/app-runtime
```
und `1 file changed, 12 insertions(+)`. Sichtprüfung im Diff: `- name:` mit sechs Leerzeichen, `run:` mit acht.

- [ ] **Step 16: Stagen, dann die CI-Befehle lokal (ohne `npm rebuild esbuild`).**

```bash
git add packages/companion-jm-suite/lib.mjs packages/companion-jm-suite/test/selftest.mjs packages/companion-jm-suite/generated/protocol.mjs packages/companion-jm-suite/package.json packages/companion-jm-suite/companion/manifest.json packages/companion-jm-suite/README.md scripts/sync-companion-protocol.mjs .github/workflows/ci-checks.yml
npm run selftest -w @jm/suite-control-protocol
node packages/companion-jm-suite/test/selftest.mjs
node scripts/sync-companion-protocol.mjs && git diff --exit-code -- packages/companion-jm-suite/generated/protocol.mjs; echo "Exit $?"
npm run selftest -w @jm/app-runtime
```
Expected: `ALLE TESTS OK` (77 `ok`), `ALLE TESTS OK` (70 `ok`), `✓ generiert: …` und `Exit 0` (kein Unterschied zur gestagten Fassung), `15 passed, 0 failed` (vor Aufgabe 17; danach der Zählstand von Aufgabe 17).

Gegenprobe CI-Wächter (vorübergehend, danach zurücknehmen): In `packages/suite-control-protocol/src/capabilities.ts` das Label `'Zoom: Quelle entladen'` in `'Zoom: Quelle entladen (geändert)'` ändern und erneut `node scripts/sync-companion-protocol.mjs && git diff --exit-code -- packages/companion-jm-suite/generated/protocol.mjs; echo "Exit $?"` laufen lassen. Erwartet: der Diff der einen Zeile und `Exit 1` (gemessen: die neu erzeugte Datei weicht ab). Dann das Label zurücksetzen, `node scripts/sync-companion-protocol.mjs` erneut, und `git diff --exit-code -- packages/companion-jm-suite/generated/protocol.mjs; echo "Exit $?"` zeigt wieder `Exit 0`.

Run: `git status --short`
Expected: genau diese gestagten Zeilen (sonst nichts Gestagtes, nichts Ungestagtes):
```
M  .github/workflows/ci-checks.yml
M  packages/companion-jm-suite/README.md
M  packages/companion-jm-suite/companion/manifest.json
M  packages/companion-jm-suite/generated/protocol.mjs
M  packages/companion-jm-suite/lib.mjs
M  packages/companion-jm-suite/package.json
M  packages/companion-jm-suite/test/selftest.mjs
M  scripts/sync-companion-protocol.mjs
```

- [ ] **Step 17: Commit.**

```bash
git commit -m "feat(companion): Modul 0.2.0 - Rolle JM Connect mit Zoom, Anzahlen als wahr, Namen mit Leerzeichen; CI-Schritte" -m "generated/protocol.mjs neu erzeugt: Die Rolle connect kommt erstmals ins Modul (9 Raum-Aktionen plus zoom_load, zoom_unload, zoom_delay; 16 Variablen; 6 Feedbacks), die Titler-Rolle bekommt graphic und slot, STATE-Werte werden dekodiert (Spec 11.4, 17.2 Nr. 3). isTruthy wertet jede positive ganze Zahl als wahr, onair und lobby leuchten auch bei 2 oder 5 Gaesten (17.2 Nr. 2). Das Sync-Skript schreibt unabhaengig vom Arbeitsordner (npm run sync gab andere Pfadkommentare). CI: Steuerprotokoll, Companion-Modul, Companion-Protokoll aktuell, App-Laufzeit (#197)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Nicht pushen. Kein `npm run build:local`, kein Modul-Release (Abschnitt „Nach der Umsetzung“).

**Abweichungen von der Gliederung:**
1. **`scripts/sync-companion-protocol.mjs` geändert** (`absWorkingDir: root`; übernommen, Montage MO4). Gemessen: Ohne den Fix erzeugen `npm run sync` (Modulordner, so in Spec 11.4 Nr. 1 und im README) und der Aufruf aus der Wurzel (so im CI-Schritt) verschiedene Dateien (`// ../suite-control-protocol/…` gegen `// packages/suite-control-protocol/…`). Der neue CI-Schritt wäre nach jedem `npm run sync` rot gewesen. Mit dem Fix sind beide Wege byte-gleich und zweimal hintereinander byte-gleich (Step 10).
2. **Test des Modul-Kopfs** in `selftest.mjs`: gleiche Version in `package.json` und `manifest.json`, „JM Connect“ in `products` und beiden Beschreibungen. Die Zahl 0.2.0 prüft Step 11 per `node -p`, nicht der Test (sonst müsste jede künftige Modulversion den Test ändern).
3. **Feedback-Fälle für alle sechs Connect-Feedbacks mit `truthy`** über die Capabilities und `isTruthy`, wie `main.js` `buildFeedbacks` sie auswertet. `main.js` selbst lässt sich ohne `@companion-module/base` nicht laden.
4. **CI-Kommentar** über den vier Schritten (Herkunft, Vorsorge `npm rebuild esbuild`). Die vier Schritte selbst stehen wörtlich wie in der Gliederung.
5. **README** des Moduls ausführlicher als in der Gliederung: Feedback-Regel, Kodierung, eigener Abschnitt „Rolle JM Connect“ mit Port und Rundown-Hinweis, Sync-Determinismus, Port 8737 in der Liste.
6. **`npm rebuild esbuild`:** unter Windows gemessen nicht nötig (esbuild 0.21.5 ohne Postinstall lief). Unter Linux ungemessen; der Schritt bleibt als Vorsorge, wie Spec 12.6 es vorsieht.

---

### Task 17: app-runtime: Logzeilen nach 14 Tagen löschen (alle Suite-Apps)

**Spec:** Nachtrag N4b.2, Teil „Löschfrist“ (14 Tage, Regel in `packages/app-runtime`, gilt für alle Suite-Apps ab ihrem nächsten Release, Größenrotation 5 × 5 MB bleibt, ein Fehler beim Löschen verhindert nie den Start, Test mit eingespeister Uhr und Temp-Ordner). Plan: L10, G8, Texttabelle (`[runtime] …`).

**Files:**
- Create: `packages/app-runtime/src/log-aufraeumen.ts`
- Modify: `packages/app-runtime/src/index.ts:15` (Import), `:193` (Hilfsfunktion `meldeAufraeumen` vor `consoleFallback`), `:546-560` (Aufräumen nach `mkdirSync`, vor `createLogger`; Takt alle 6 h)
- Test: `packages/app-runtime/test/selftest.ts:7-8` (Kopf und Importe), `:76-77` (neuer Block vor der Schlusszeile)

**Interfaces:**
- Consumes: keine.
- Produces:
```ts
// packages/app-runtime/src/log-aufraeumen.ts — nur node:fs und node:path, läuft unter node --experimental-strip-types (G8)
export const LOG_FRIST_MS = 14 * 24 * 60 * 60 * 1000;          // 1 209 600 000
export const LOG_AUFRAEUMEN_TAKT_MS = 6 * 60 * 60 * 1000;      // 21 600 000
export const LOG_DATEIMUSTER: RegExp;                           // main.log, renderer.log, je mit .1, .2, …; last-crash.json
export const KUERZEN_MAX_BYTES = 10 * 1024 * 1024;              // größere Dateien nie ganz lesen (doppelte Rotationsgröße)
export interface LogFs {
  readdirSync(ordner: string): string[];
  statSync(datei: string): { mtimeMs: number; size: number; isFile(): boolean };
  rmSync(datei: string, optionen: { force: boolean }): void;
  /** Die ersten `bytes` Bytes (oder weniger): Reicht der Kopf für die Entscheidung, wird die Datei nicht ganz gelesen. */
  leseKopf(datei: string, bytes: number): Uint8Array;
  readFileSync(datei: string): Uint8Array;
  writeFileSync(datei: string, daten: Uint8Array): void;
  renameSync(von: string, nach: string): void;
}
export interface AufraeumBericht { geloescht: string[]; gekuerzt: string[]; fehler: string[] }   // fehler: '<datei> (<code>)'
/** Wirft nie. fs ist je Aufruf einzeln einspeisbar (Tests: EBUSY, EPERM). */
export function raeumeLogsAuf(e: { ordner: string; jetztMs: number; fristMs?: number; fs?: Partial<LogFs> }): AufraeumBericht;
/** info nur, wenn etwas gelöscht oder gekürzt wurde; je Fehler eine Warnung (Texttabelle). */
export function berichtZeilen(b: AufraeumBericht, fristMs?: number): { info: string | null; warn: string[] };
// index.ts (intern): raeumeLogsAuf vor createLogger, Bericht danach ins Log, dann
// setInterval(…, LOG_AUFRAEUMEN_TAKT_MS).unref()
```

**Vorab (für den Umsetzer):**
- Die Aufgabe hängt an keiner anderen Aufgabe und berührt nur `packages/app-runtime`. Die drei Dateien liegen mit CRLF im Arbeitsbaum (G14): ersetzen mit dem Edit-Werkzeug, Vorher-Text exakt. Jeder Vorher-Ausschnitt kommt im Ausgangsstand genau einmal vor (gemessen).
- `index.ts` importiert `electron` und lässt sich im Selbsttest nicht laden. Darum liegt die Regel electron-frei in `log-aufraeumen.ts` (Muster `csp.ts`), und der Selbsttest prüft den Aufrufort in `index.ts` als Quelltext: Eine Regel, die nie gerufen wird, löscht nichts.
- Der Selbsttest hat seine eigene Konvention: `check(name, cond)`, Schlusszeile `<n> passed, <m> failed`. Gemessener Ausgang: `15 passed, 0 failed`.
- Regeln (L10): Datei mit `mtime` älter oder gleich 14 Tage → löschen. Jüngere Logdatei, deren erste Zeile mit Zeitstempel älter ist → kürzen, und zwar byte-genau ab der ersten Zeile, deren Zeitstempel innerhalb der Frist liegt; Zeilen ohne Zeitstempel (Stapel) hängen an der Zeile davor. Geschrieben wird in die Hilfsdatei `<name>.kuerzen`, dann umbenannt. `mtime` in der Zukunft → nie löschen, nie kürzen. `last-crash.json` nur nach `mtime`. Jeder Fehler je Datei landet in `fehler`, nie als Wurf.
- Kosten (Nachbesserung): Das Aufräumen läuft synchron beim Start jeder Suite-App und alle 6 h. Es liest darum zuerst nur 64 KB vom Dateianfang; ist die erste Zeile mit Zeitstempel jung (der Normalfall), bleibt die Datei, ohne ganz gelesen zu werden. Ganz gelesen wird nur eine Datei mit alter erster Zeile, und nur bis `KUERZEN_MAX_BYTES` (10 MB). Eine größere Datei (die Rotation scheiterte dauerhaft, etwa am Virenschutz) bleibt ungekürzt und steht als `main.log (ZU_GROSS)` im Bericht; nach `mtime` gelöscht wird sie weiterhin.
- `npm run typecheck -w @jm/connect` prüft `packages/app-runtime/src/index.ts` und `log-aufraeumen.ts` mit (gemessen mit `tsc --listFiles`). Weil jede Suite-App `@jm/app-runtime` bündelt, prüft Step 7 zusätzlich alle Apps mit `typecheck`-Skript.
- In CI läuft dieser Selbsttest erst mit dem Schritt „App-Laufzeit (Log-Aufräumen, CSP)“ aus Aufgabe 16.

- [ ] **Step 1: Test schreiben.**

Datei `packages/app-runtime/test/selftest.ts`. Ersetzung 1. Vorher (Zeilen 7–8, eindeutig):
```ts
// beim ersten Installer passiert (Raum-WebSocket geblockt). Der Unterschied wird hier festgenagelt.
import { buildCsp } from '../src/csp.ts';
```
Nachher:
```ts
// beim ersten Installer passiert (Raum-WebSocket geblockt). Der Unterschied wird hier festgenagelt.
//
// Dazu die Löschfrist der Logs (Plan Zoom 4b, Aufgabe 17; Spec N4b.2): log-aufraeumen.ts ist wie csp.ts
// frei von Electron und läuft hier gegen Temp-Ordner mit eingespeister Uhr.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCsp } from '../src/csp.ts';
import {
  berichtZeilen,
  KUERZEN_MAX_BYTES,
  LOG_AUFRAEUMEN_TAKT_MS,
  LOG_DATEIMUSTER,
  LOG_FRIST_MS,
  raeumeLogsAuf,
} from '../src/log-aufraeumen.ts';
```

Ersetzung 2. Vorher (Zeilen 76–77, eindeutig):
```ts
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```
Nachher:
```ts
// ── Löschfrist der Logs: 14 Tage (Plan Zoom 4b, Aufgabe 17; Spec N4b.2; L10) ─────────────
// Die Uhr ist eingespeist (JETZT), das Alter jeder Datei setzt utimesSync. JETZT hat ganze Sekunden, damit
// „genau 14 Tage“ auch nach dem Umweg über die mtime des Dateisystems exakt bleibt.
const TAG = 24 * 60 * 60 * 1000;
const JETZT = Date.parse('2026-10-06T12:00:00.000Z');
const vor = (tage: number): number => JETZT - tage * TAG;
/** Eine Logzeile im Format von createLogger (index.ts): ISO-Zeit, Stufe, App-ID, Text. */
const zeile = (ms: number, text: string): string => `${new Date(ms).toISOString()} [INFO] [jm-probe] ${text}\n`;
const temp: string[] = [];
function neuerOrdner(): string {
  const o = mkdtempSync(join(tmpdir(), 'jm-log-aufraeumen-'));
  temp.push(o);
  return o;
}
function lege(ordner: string, name: string, inhalt: string, mtimeMs: number): void {
  const p = join(ordner, name);
  writeFileSync(p, inhalt);
  utimesSync(p, new Date(mtimeMs), new Date(mtimeMs));
}
const lies = (ordner: string, name: string): string => readFileSync(join(ordner, name), 'utf8');
const da = (ordner: string, name: string): boolean => existsSync(join(ordner, name));
const fsFehler = (code: string): Error => Object.assign(new Error(`${code}: Probe`), { code });

{
  check('Frist 14 Tage, Takt 6 Stunden', LOG_FRIST_MS === 14 * TAG && LOG_AUFRAEUMEN_TAKT_MS === 6 * 60 * 60 * 1000);
  check(
    'Dateimuster: main.log, renderer.log, rotierte Dateien, last-crash.json',
    ['main.log', 'main.log.1', 'main.log.4', 'renderer.log', 'renderer.log.12', 'last-crash.json'].every((n) => LOG_DATEIMUSTER.test(n)),
  );
  check(
    '… keine fremde Datei und keine Hilfsdatei',
    ['notizen.txt', 'main.log.0', 'main.logx', 'xmain.log', 'main.log.kuerzen', 'last-crash.json.bak'].every((n) => !LOG_DATEIMUSTER.test(n)),
  );
}

{
  const o = neuerOrdner();
  lege(o, 'main.log.2', zeile(vor(16), 'alt'), vor(15));
  lege(o, 'main.log.1', zeile(vor(15), 'genau 14 Tage'), vor(14));
  const dreizehn = zeile(vor(13), 'jung');
  lege(o, 'main.log.3', dreizehn, vor(13));
  lege(o, 'notizen.txt', 'fremd\n', vor(30));
  const zukunft = zeile(vor(20), 'die Uhr sprang zurück');
  lege(o, 'renderer.log.1', zukunft, JETZT + 2 * TAG);
  const jungerTeil = zeile(vor(2), 'jung 1 mit Stapel') + '    at jung (c.js:3:3)\n' + zeile(vor(1), 'jung 2');
  const gemischt =
    zeile(vor(20), 'alt 1') + zeile(vor(20), 'alt 2 mit Stapel') + '    at alt (a.js:1:1)\n    at alt (b.js:2:2)\n' + jungerTeil;
  lege(o, 'main.log', gemischt, vor(1));
  const nurJung = zeile(vor(2), 'jung 1') + zeile(vor(1), 'jung 2') + '    at jung (d.js:4:4)\n';
  lege(o, 'renderer.log', nurJung, vor(1));
  lege(o, 'last-crash.json', '{"kind":"uncaughtException"}', vor(15));
  lege(o, 'main.log.kuerzen', zeile(vor(1), 'Rest eines harten Endes'), vor(1));

  const b = raeumeLogsAuf({ ordner: o, jetztMs: JETZT });
  check('rotierte Datei 15 Tage → gelöscht', !da(o, 'main.log.2'));
  check('genau 14 Tage → gelöscht', !da(o, 'main.log.1'));
  check('13 Tage → bleibt byte-gleich', lies(o, 'main.log.3') === dreizehn);
  check('fremde Datei notizen.txt, 30 Tage → bleibt', da(o, 'notizen.txt'));
  check('mtime in der Zukunft → bleibt unverändert (auch nicht gekürzt)', lies(o, 'renderer.log.1') === zukunft);
  check('main.log mit Zeilen von vor 20 und 2 Tagen → nur die jungen bleiben, Stapelzeilen beim Vorgänger', lies(o, 'main.log') === jungerTeil);
  check('renderer.log nur mit jungen Zeilen → byte-gleich', lies(o, 'renderer.log') === nurJung);
  check('last-crash.json 15 Tage → gelöscht', !da(o, 'last-crash.json'));
  check('liegengebliebene Hilfsdatei → gelöscht', !da(o, 'main.log.kuerzen'));
  check('nach dem Kürzen bleibt keine Hilfsdatei liegen', !readdirSync(o).some((n) => n.endsWith('.kuerzen')));
  check(
    'Bericht: gelöscht, gekürzt, keine Fehler',
    JSON.stringify([...b.geloescht].sort()) === JSON.stringify(['last-crash.json', 'main.log.1', 'main.log.2', 'main.log.kuerzen'])
      && JSON.stringify(b.gekuerzt) === JSON.stringify(['main.log'])
      && b.fehler.length === 0,
  );
  const b2 = raeumeLogsAuf({ ordner: o, jetztMs: JETZT });
  check(
    'zweiter Lauf: nichts mehr zu tun, main.log unverändert',
    b2.geloescht.length === 0 && b2.gekuerzt.length === 0 && b2.fehler.length === 0 && lies(o, 'main.log') === jungerTeil,
  );
}

{
  const o = neuerOrdner();
  lege(o, 'main.log', zeile(vor(30), 'nur alt'), vor(1));
  const b = raeumeLogsAuf({ ordner: o, jetztMs: JETZT });
  check('jüngere mtime, aber jede Zeile alt → Datei gelöscht', !da(o, 'main.log') && JSON.stringify(b.geloescht) === '["main.log"]');
}

{
  const o = neuerOrdner();
  lege(o, 'main.log.2', zeile(vor(16), 'gesperrt'), vor(15));
  lege(o, 'main.log.3', zeile(vor(16), 'frei'), vor(15));
  let geworfen = false;
  let b = { geloescht: [] as string[], gekuerzt: [] as string[], fehler: [] as string[] };
  try {
    b = raeumeLogsAuf({
      ordner: o,
      jetztMs: JETZT,
      fs: {
        rmSync: (datei, optionen) => {
          if (datei.endsWith('main.log.2')) throw fsFehler('EBUSY');
          rmSync(datei, optionen);
        },
      },
    });
  } catch {
    geworfen = true;
  }
  check('rmSync wirft EBUSY → kein Wurf, Fehler nennt Datei und Code', !geworfen && JSON.stringify(b.fehler) === '["main.log.2 (EBUSY)"]');
  check('… die anderen Dateien sind trotzdem bearbeitet', !da(o, 'main.log.3') && da(o, 'main.log.2'));
}

{
  const o = neuerOrdner();
  const gemischt = zeile(vor(20), 'alt') + zeile(vor(2), 'jung');
  lege(o, 'main.log', gemischt, vor(1));
  const b = raeumeLogsAuf({ ordner: o, jetztMs: JETZT, fs: { renameSync: () => { throw fsFehler('EPERM'); } } });
  check(
    'Umbenennen scheitert (EPERM) → Original unverändert, keine Hilfsdatei, Fehler gemeldet',
    lies(o, 'main.log') === gemischt && !da(o, 'main.log.kuerzen') && JSON.stringify(b.fehler) === '["main.log (EPERM)"]' && b.gekuerzt.length === 0,
  );
}

{
  let geworfen = false;
  let b = { geloescht: [] as string[], gekuerzt: [] as string[], fehler: [] as string[] };
  try {
    b = raeumeLogsAuf({ ordner: join(neuerOrdner(), 'gibt-es-nicht'), jetztMs: JETZT });
  } catch {
    geworfen = true;
  }
  check('Ordner fehlt → kein Wurf, genau ein Fehler mit ENOENT', !geworfen && b.fehler.length === 1 && b.fehler[0].endsWith(' (ENOENT)'));
}

{
  // Normalfall beim Start und alle 6 h: Die erste Zeile ist jung. Dann reicht der Kopf, die Datei wird nicht ganz gelesen.
  const o = neuerOrdner();
  const jung = zeile(vor(1), 'jung').repeat(5000);
  lege(o, 'main.log', jung, vor(1));
  let ganzGelesen = 0;
  const b = raeumeLogsAuf({
    ordner: o,
    jetztMs: JETZT,
    fs: { readFileSync: (datei) => { ganzGelesen += 1; return readFileSync(datei); } },
  });
  check('erste Zeile jung (Datei > 64 KB) → nur der Kopf gelesen, nichts geändert', ganzGelesen === 0 && lies(o, 'main.log') === jung
    && b.gekuerzt.length === 0 && b.fehler.length === 0);
}

{
  // Scheitert die Rotation dauerhaft, wächst main.log weiter. Über KUERZEN_MAX_BYTES wird sie nie ganz gelesen.
  const o = neuerOrdner();
  const gemischt = zeile(vor(20), 'alt') + zeile(vor(2), 'jung');
  lege(o, 'main.log', gemischt, vor(1));
  let ganzGelesen = 0;
  const b = raeumeLogsAuf({
    ordner: o,
    jetztMs: JETZT,
    fs: {
      statSync: (datei) => {
        const st = statSync(datei);
        return { mtimeMs: st.mtimeMs, size: KUERZEN_MAX_BYTES + 1, isFile: () => st.isFile() };
      },
      readFileSync: (datei) => { ganzGelesen += 1; return readFileSync(datei); },
    },
  });
  check('Datei über KUERZEN_MAX_BYTES mit alter erster Zeile → nicht ganz gelesen, nicht gekürzt, Fehler ZU_GROSS',
    ganzGelesen === 0 && lies(o, 'main.log') === gemischt && JSON.stringify(b.fehler) === '["main.log (ZU_GROSS)"]' && b.gekuerzt.length === 0);
  check('KUERZEN_MAX_BYTES = 10 MB (doppelte Rotationsgröße)', KUERZEN_MAX_BYTES === 10 * 1024 * 1024);
}

{
  check('Bericht ohne Änderung → keine Info-Zeile, keine Warnung', JSON.stringify(berichtZeilen({ geloescht: [], gekuerzt: [], fehler: [] })) === '{"info":null,"warn":[]}');
  const z = berichtZeilen({ geloescht: ['main.log.1'], gekuerzt: ['main.log', 'renderer.log'], fehler: ['main.log.2 (EBUSY)'] });
  check('Info-Zeile wörtlich', z.info === '[runtime] Logs aufgeräumt: 1 gelöscht, 2 gekürzt (Frist 14 Tage)');
  check('je Fehler eine Warnung', JSON.stringify(z.warn) === JSON.stringify(['[runtime] Log-Aufräumen: main.log.2 (EBUSY)']));
}

{
  // index.ts importiert electron und lässt sich hier nicht laden. Geprüft wird darum der Aufrufort im Quelltext:
  // Eine Regel, die nie gerufen wird, löscht nichts.
  const quelle = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
  const init = quelle.slice(quelle.indexOf('export function initAppRuntime('));
  const mk = init.indexOf('mkdirSync(logDir');
  const auf = init.indexOf('raeumeLogsAuf(');
  const logger = init.indexOf('createLogger(');
  check('initAppRuntime räumt nach mkdirSync und vor dem ersten Logger auf', mk >= 0 && auf > mk && logger > auf);
  check('… und danach alle 6 Stunden, ohne die App am Leben zu halten', /setInterval\([\s\S]*?LOG_AUFRAEUMEN_TAKT_MS,?\s*\)\.unref\(\)/.test(init));
}

for (const o of temp) {
  try {
    rmSync(o, { recursive: true, force: true });
  } catch {
    /* Windows: eine Datei ist noch offen — der Temp-Ordner bleibt liegen, der Test nicht hängen. */
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Test laufen lassen (rot).**

Run (aus der Worktree-Wurzel): `npm run selftest -w @jm/app-runtime`
Expected: Abbruch vor dem ersten Fall, Exit-Code 1, mit der Zeile
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\packages\app-runtime\src\log-aufraeumen.ts' imported from …\packages\app-runtime\test\selftest.ts
```

- [ ] **Step 3: `packages/app-runtime/src/log-aufraeumen.ts` anlegen (ganzer Inhalt).**

```ts
// Löschfrist der Logs (Spec Zoom Stage 4, Nachtrag N4b.2; Plan 4b, L10): Logdateien und Logzeilen, die
// älter als 14 Tage sind, verschwinden, und zwar in jeder Suite-App, die initAppRuntime ruft. Ohne Electron
// und nur mit node:fs/node:path (Muster csp.ts), damit `node --experimental-strip-types` die Regeln im
// Selbsttest prüft. Darum auch kein `enum` und keine Parameter-Properties.
//
// Regeln:
// - Nur eigene Dateien: main.log, renderer.log (samt Rotation .1, .2, …) und last-crash.json.
// - Alter = mtime. Ab 14 Tagen wird die Datei gelöscht. Eine mtime in der Zukunft (die Uhr sprang) wird nie
//   gelöscht und nie gekürzt.
// - Eine jüngere Logdatei, deren erste Zeile älter ist, wird gekürzt: Es bleiben die Zeilen ab der ersten Zeile
//   mit Zeitstempel innerhalb der Frist. Zeilen ohne Zeitstempel (Stapel) gehören zur Zeile davor. Ohne das
//   stünde bei einer täglich genutzten App, die nie 5 MB erreicht und darum nie rotiert, jede Zeile für immer
//   im Log.
// - Gekürzt wird byte-genau über eine Hilfsdatei `<name>.kuerzen` und Umbenennen. Bleibt sie nach einem harten
//   Ende liegen, löscht sie der nächste Lauf.
// - Jeder Fehler wird je Datei gemeldet, nie geworfen (EBUSY, EPERM, ENOENT): Aufräumen verhindert nie den Start.
import * as nodeFs from 'node:fs';
import path from 'node:path';

export const LOG_FRIST_MS = 14 * 24 * 60 * 60 * 1000;
export const LOG_AUFRAEUMEN_TAKT_MS = 6 * 60 * 60 * 1000;
/** Die Dateien des Loggers in `userData/logs` (index.ts): main.log, renderer.log, Rotation .1–.n, Crash-Marke. */
export const LOG_DATEIMUSTER = /^(?:(?:main|renderer)\.log(?:\.[1-9]\d*)?|last-crash\.json)$/;
/** Hilfsdatei beim Kürzen. */
const HILFSDATEI = /^(?:main|renderer)\.log(?:\.[1-9]\d*)?\.kuerzen$/;
/** Zeitstempel am Zeilenanfang, wie createLogger ihn schreibt: `2026-10-06T12:00:00.000Z `. */
const ZEITSTEMPEL = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z) /;
/** So viel liest das Aufräumen zuerst; ist die erste Zeile darin jung (Normalfall), wird die Datei nicht ganz gelesen. */
const KOPF_BYTES = 64 * 1024;
/** Größere Dateien liest das Aufräumen nie ganz (doppelte Rotationsgröße MAX_BYTES aus index.ts): Die Rotation scheiterte. */
export const KUERZEN_MAX_BYTES = 10 * 1024 * 1024;

/** Die Dateisystem-Aufrufe, einzeln einspeisbar (Tests: EBUSY, EPERM). */
export interface LogFs {
  readdirSync(ordner: string): string[];
  statSync(datei: string): { mtimeMs: number; size: number; isFile(): boolean };
  rmSync(datei: string, optionen: { force: boolean }): void;
  /** Die ersten `bytes` Bytes (oder weniger): Reicht der Kopf für die Entscheidung, wird die Datei nicht ganz gelesen. */
  leseKopf(datei: string, bytes: number): Uint8Array;
  readFileSync(datei: string): Uint8Array;
  writeFileSync(datei: string, daten: Uint8Array): void;
  renameSync(von: string, nach: string): void;
}

export interface AufraeumBericht {
  /** Dateinamen, die gelöscht wurden. */
  geloescht: string[];
  /** Dateinamen, die gekürzt wurden. */
  gekuerzt: string[];
  /** `<datei> (<code>)`; beim nicht lesbaren Ordner dessen Pfad. */
  fehler: string[];
}

const ECHT: LogFs = {
  readdirSync: (ordner) => nodeFs.readdirSync(ordner),
  statSync: (datei) => nodeFs.statSync(datei),
  rmSync: (datei, optionen) => nodeFs.rmSync(datei, optionen),
  leseKopf: (datei, bytes) => {
    const fd = nodeFs.openSync(datei, 'r');
    try {
      const puffer = new Uint8Array(bytes);
      return puffer.subarray(0, nodeFs.readSync(fd, puffer, 0, bytes, 0));
    } finally {
      nodeFs.closeSync(fd);
    }
  },
  readFileSync: (datei) => nodeFs.readFileSync(datei),
  writeFileSync: (datei, daten) => nodeFs.writeFileSync(datei, daten),
  renameSync: (von, nach) => nodeFs.renameSync(von, nach),
};

function fehlerCode(e: unknown): string {
  const code = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
  return typeof code === 'string' && code ? code : 'unbekannt';
}

/**
 * Byte-Versatz, ab dem die Datei bleibt. 0 = nichts kürzen (die erste Zeile mit Zeitstempel ist jung, oder es
 * gibt keinen Zeitstempel). `daten.length` = jede Zeile mit Zeitstempel ist alt.
 */
function schnitt(daten: Uint8Array, grenzeMs: number): number {
  let altGesehen = false;
  let anfang = 0;
  while (anfang < daten.length) {
    const ende = daten.indexOf(0x0a, anfang);
    const naechste = ende === -1 ? daten.length : ende + 1;
    const kopf = String.fromCharCode(...daten.subarray(anfang, Math.min(anfang + 40, naechste)));
    const m = ZEITSTEMPEL.exec(kopf);
    const ms = m ? Date.parse(m[1]) : Number.NaN;
    if (Number.isFinite(ms)) {
      if (ms > grenzeMs) return altGesehen ? anfang : 0;
      altGesehen = true;
    }
    anfang = naechste;
  }
  return altGesehen ? daten.length : 0;
}

/** Räumt `ordner` auf (Regeln oben). Wirft nie. */
export function raeumeLogsAuf(e: { ordner: string; jetztMs: number; fristMs?: number; fs?: Partial<LogFs> }): AufraeumBericht {
  const fs: LogFs = { ...ECHT, ...e.fs };
  const grenzeMs = e.jetztMs - (e.fristMs ?? LOG_FRIST_MS);
  const bericht: AufraeumBericht = { geloescht: [], gekuerzt: [], fehler: [] };
  let namen: string[];
  try {
    namen = fs.readdirSync(e.ordner);
  } catch (err) {
    bericht.fehler.push(`${e.ordner} (${fehlerCode(err)})`);
    return bericht;
  }
  const loesche = (datei: string, name: string): void => {
    fs.rmSync(datei, { force: true });
    bericht.geloescht.push(name);
  };
  const sortiert = [...namen].sort();
  // Liegengebliebene Hilfsdateien zuerst: Das Kürzen unten legt dieselben Namen neu an.
  const reihenfolge = [...sortiert.filter((n) => HILFSDATEI.test(n)), ...sortiert.filter((n) => !HILFSDATEI.test(n))];
  for (const name of reihenfolge) {
    const hilfsdatei = HILFSDATEI.test(name);
    if (!hilfsdatei && !LOG_DATEIMUSTER.test(name)) continue;
    const datei = path.join(e.ordner, name);
    try {
      const st = fs.statSync(datei);
      if (!st.isFile()) continue;
      if (hilfsdatei) {
        loesche(datei, name);
        continue;
      }
      if (st.mtimeMs > e.jetztMs) continue;
      if (st.mtimeMs <= grenzeMs) {
        loesche(datei, name);
        continue;
      }
      if (name === 'last-crash.json') continue;
      // Erst nur den Kopf: Ist seine erste Zeile mit Zeitstempel jung (Normalfall), bleibt die Datei, ohne ganz gelesen zu werden.
      if (schnitt(fs.leseKopf(datei, KOPF_BYTES), grenzeMs) === 0) continue;
      if (st.size > KUERZEN_MAX_BYTES) {
        bericht.fehler.push(`${name} (ZU_GROSS)`);
        continue;
      }
      const daten = fs.readFileSync(datei);
      const ab = schnitt(daten, grenzeMs);
      if (ab === 0) continue;
      if (ab >= daten.length) {
        loesche(datei, name);
        continue;
      }
      const hilfe = `${datei}.kuerzen`;
      try {
        fs.writeFileSync(hilfe, daten.subarray(ab));
        fs.renameSync(hilfe, datei);
      } catch (err) {
        try {
          fs.rmSync(hilfe, { force: true });
        } catch {
          /* bleibt liegen; der nächste Lauf löscht sie */
        }
        throw err;
      }
      bericht.gekuerzt.push(name);
    } catch (err) {
      bericht.fehler.push(`${name} (${fehlerCode(err)})`);
    }
  }
  return bericht;
}

/** Zeilen fürs Log: eine Info-Zeile nur, wenn etwas geschah; je Fehler eine Warnung. */
export function berichtZeilen(b: AufraeumBericht, fristMs: number = LOG_FRIST_MS): { info: string | null; warn: string[] } {
  const tage = Math.round(fristMs / (24 * 60 * 60 * 1000));
  const info =
    b.geloescht.length + b.gekuerzt.length > 0
      ? `[runtime] Logs aufgeräumt: ${b.geloescht.length} gelöscht, ${b.gekuerzt.length} gekürzt (Frist ${tage} Tage)`
      : null;
  return { info, warn: b.fehler.map((f) => `[runtime] Log-Aufräumen: ${f}`) };
}
```

- [ ] **Step 4: Test laufen lassen (rot nur noch am Aufrufort).**

Run: `npm run selftest -w @jm/app-runtime`
Expected: genau diese beiden Zeilen mit `FAIL`, Schluss `41 passed, 2 failed`, Exit-Code 1:
```
FAIL  initAppRuntime räumt nach mkdirSync und vor dem ersten Logger auf
FAIL  … und danach alle 6 Stunden, ohne die App am Leben zu halten
```

- [ ] **Step 5: `index.ts` ruft die Regel beim Start und alle 6 h.**

Datei `packages/app-runtime/src/index.ts`. Ersetzung 1. Vorher (Zeile 15, eindeutig):
```ts
import { buildCsp, type CspConfig } from './csp';
```
Nachher:
```ts
import { buildCsp, type CspConfig } from './csp';
import { berichtZeilen, LOG_AUFRAEUMEN_TAKT_MS, raeumeLogsAuf, type AufraeumBericht } from './log-aufraeumen';
```

Ersetzung 2. Vorher (Zeile 193, eindeutig):
```ts
function consoleFallback(): Logger {
```
Nachher:
```ts
/** Ergebnis des Log-Aufräumens ins Log (log-aufraeumen.ts): eine Info-Zeile, wenn etwas geschah, je Fehler eine Warnung. */
function meldeAufraeumen(log: Logger, b: AufraeumBericht): void {
  const z = berichtZeilen(b);
  if (z.info) log.info(z.info);
  for (const w of z.warn) log.warn(w);
}

function consoleFallback(): Logger {
```

Ersetzung 3. Vorher (Zeilen 549–560, eindeutig):
```ts
  } catch {
    /* notfalls schreibt der Logger einfach nichts */
  }

  const log = createLogger({
    appId: opts.appId,
    logDir,
    fileName: 'main.log',
    level,
    toConsole: isDev,
  });
  defaultLogger = log;
```
Nachher:
```ts
  } catch {
    /* notfalls schreibt der Logger einfach nichts */
  }
  // Löschfrist 14 Tage (Spec Zoom Stage 4, N4b.2): vor dem ersten Schreiben, solange keine Logdatei offen ist.
  // raeumeLogsAuf wirft nie; was schiefging, steht gleich danach im Log.
  const ersterBericht = raeumeLogsAuf({ ordner: logDir, jetztMs: Date.now() });

  const log = createLogger({
    appId: opts.appId,
    logDir,
    fileName: 'main.log',
    level,
    toConsole: isDev,
  });
  defaultLogger = log;
  meldeAufraeumen(log, ersterBericht);
  // Langläufer (Launcher, Connect im Tray) räumen alle 6 h nach. unref: Der Takt hält keine App am Leben.
  setInterval(
    () => meldeAufraeumen(log, raeumeLogsAuf({ ordner: logDir, jetztMs: Date.now() })),
    LOG_AUFRAEUMEN_TAKT_MS,
  ).unref();
```

- [ ] **Step 6: Test laufen lassen (grün).**

Run: `npm run selftest -w @jm/app-runtime`
Expected: keine Zeile mit `FAIL`, Schluss `43 passed, 0 failed`, Exit-Code 0 (15 CSP-Fälle wie bisher, 28 neue).

- [ ] **Step 7: Typen prüfen, auch in jeder App, die `@jm/app-runtime` bündelt.**

Run (aus der Worktree-Wurzel, Git Bash):
```bash
npm run typecheck -w @jm/connect
for n in $(node -e "const fs=require('fs');for(const d of fs.readdirSync('apps')){try{const p=JSON.parse(fs.readFileSync('apps/'+d+'/package.json','utf8'));if(p.scripts&&p.scripts.typecheck)console.log(p.name)}catch{}}"); do npm run typecheck -w "$n" >/dev/null 2>&1 && echo "$n ok" || echo "$n FEHLER"; done
```
Expected: der erste Befehl ohne Zeile mit `error TS`, Exit-Code 0. Die Schleife gibt 25 Zeilen aus, alle mit `ok` (`@jm/app-designer` … `@jm/transcribe`, darunter `@jm/connect` und `@jm/launcher`; gemessen am Probelauf). Steht irgendwo `FEHLER`, diesen Befehl einzeln laufen lassen und die Meldung lesen.

- [ ] **Step 8: Gegenprobe: ohne Kürzen.**

In `packages/app-runtime/src/log-aufraeumen.ts` die Zeile `      const ab = schnitt(daten, grenzeMs);` vorübergehend durch `      const ab = 0 * schnitt(daten, grenzeMs);` ersetzen und `npm run selftest -w @jm/app-runtime` laufen lassen.
Expected (gemessen): `38 passed, 5 failed` mit den Zeilen
```
FAIL  main.log mit Zeilen von vor 20 und 2 Tagen → nur die jungen bleiben, Stapelzeilen beim Vorgänger
FAIL  Bericht: gelöscht, gekürzt, keine Fehler
FAIL  zweiter Lauf: nichts mehr zu tun, main.log unverändert
FAIL  jüngere mtime, aber jede Zeile alt → Datei gelöscht
FAIL  Umbenennen scheitert (EPERM) → Original unverändert, keine Hilfsdatei, Fehler gemeldet
```
Danach die Zeile zurücksetzen und erneut laufen lassen: `43 passed, 0 failed`.
Zwei weitere Gegenproben (gemessen) zum Kopf und zur Obergrenze: die Zeile `      if (schnitt(fs.leseKopf(datei, KOPF_BYTES), grenzeMs) === 0) continue;` weglassen → `42 passed, 1 failed` mit `FAIL  erste Zeile jung (Datei > 64 KB) → nur der Kopf gelesen, nichts geändert`; `if (st.size > KUERZEN_MAX_BYTES) {` → `if (false) {` → `42 passed, 1 failed` mit `FAIL  Datei über KUERZEN_MAX_BYTES mit alter erster Zeile → …`.

- [ ] **Step 9: Commit.**

```bash
git add packages/app-runtime/src/log-aufraeumen.ts packages/app-runtime/src/index.ts packages/app-runtime/test/selftest.ts
git status --short
```
Erwartet genau diese gestagten Zeilen (sonst nichts Gestagtes):
```
M  packages/app-runtime/src/index.ts
A  packages/app-runtime/src/log-aufraeumen.ts
M  packages/app-runtime/test/selftest.ts
```
Dann:
```bash
git commit -m "feat(app-runtime): Logzeilen nach 14 Tagen loeschen (Start und alle 6 h)" -m "log-aufraeumen.ts (ohne Electron): main.log, renderer.log samt Rotation und last-crash.json ab 14 Tagen loeschen; juengere Logdateien zeilengenau kuerzen (Stapelzeilen beim Vorgaenger), ueber eine Hilfsdatei. mtime in der Zukunft nie, Fehler je Datei gemeldet statt geworfen. initAppRuntime raeumt vor dem ersten Schreiben auf und danach alle 6 h (unref); Bericht als [runtime]-Zeile. Gilt fuer jede Suite-App ab ihrem naechsten Release (Spec N4b.2, Plan L10)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen von der Gliederung:**
1. **Zusätzlicher Export `berichtZeilen`:** Er baut die beiden `[runtime]`-Zeilen der Texttabelle rein; so prüft der Selbsttest die Texte wörtlich, `index.ts` loggt nur noch.
2. **Hilfsdateien werden mitgelöscht, und zwar zuerst:** Eine nach hartem Ende liegengebliebene `main.log.kuerzen` passt nicht auf `LOG_DATEIMUSTER` und läge sonst für immer da. Ohne „zuerst“ überschrieb das Kürzen von `main.log` sie, und der spätere Schritt meldete ENOENT; der Selbsttest hat das beim Nachspielen gezeigt.
3. **„Jede Zeile alt, mtime jünger“ löscht die Datei** (zählt als gelöscht), statt eine leere Datei zu schreiben.
4. **Quelltext-Wächter für den Aufrufort** in `index.ts` (zwei Fälle): `index.ts` lässt sich ohne Electron nicht laden.
5. **Testkonvention** `check`/`passed` des vorhandenen Selbsttests statt `eq`.
6. **Typecheck aller 25 Apps** in Step 7, weil die Änderung in jede App gebündelt wird (gemessen: alle grün).
7. **Nachbesserung: erst den Kopf lesen, große Dateien nie ganz** (`leseKopf`, `KUERZEN_MAX_BYTES`, Fehler `ZU_GROSS`; zwei Fälle mit eingespeistem `fs`). Die erste Fassung las jede junge Logdatei synchron ganz ein, beim Start und alle 6 h, bis zu zehn Dateien zu 5 MB; scheiterte die Rotation dauerhaft, lud jeder Start die ganze, wachsende `main.log`.

---

### Task 18: Hülle und Karte: „Abbrechen“, Nummer leeren, Bild und Ton im Klartext, gemerkte Quellen mit Grenze, Versatz nur für die Sitzung

**Spec:** 5.5 (IPC `zoomAbbrechen`), 6.8 (Abbrechen in Z11; „Schließen“), 9 Punkte 6–9, N4b.3 Nr. 4 (Versatz nur für die Sitzung), Nr. 5 („Schließen“ leert die Meeting-Nummer im Feld der Karte), Nr. 8 („Rohwerte von Bild und Ton in der Karte“). Plan: L7 (Stand `grenze`), L11 (Audit-Zeile ohne Gastnamen), L14.

**Files:**
- Modify: `apps/connect/src/shared/ipc.ts:41-42` (Kommentar), `:68` (Kanal `zoomAbbrechen` nach `zoomVerlassen`)
- Modify: `apps/connect/src/shared/types.ts:273` (`JmConnectApi`; Zeile im Ausgangsstand, Aufgabe 4 verschiebt sie)
- Modify: `apps/connect/src/preload/index.ts:89`
- Modify: `apps/connect/src/main/zoom.ts:146-148` (`registriereKanaele`; Aufgaben 11 und 15 ändern andere Stellen dieser Datei)
- Modify: `apps/connect/src/renderer/src/zoom/ZoomCard.tsx:8-20` (Importe), `:54-60` (lokales `sollText` entfällt), `:256`, `:360-364`, `:428-433`, `:446-454`, `:508-512`, `:737-744`, `:767-769`, `:776-780`
- Modify: `apps/connect/src/renderer/src/App.tsx:341`
- Test: keine neue Testdatei. Der Renderer hat keinen Test (G10); die Logik steckt in den Helfern aus Aufgabe 4 und ist dort belegt. Hier: Typecheck rot → grün, Bau, `grep -c` vorher und nachher, Selbsttest unverändert grün.

**Interfaces:**
- Consumes:
```ts
// Aufgabe 9 · kern.ts
export interface ZoomKern { /* … */ abbrechen(): void; /* nur Z11 wirksam, sonst wirkungslos */ }
// Aufgabe 4 · shared/zoom-text.ts
export function sollZeile(e: ZoomSollEintrag): string;          // alle vier Stände, 'grenze' nach der Texttabelle
export function quellenZustandText(q: ZoomQuelle): string;      // `${bildText(…)} · ${tonText(…)}`
export function versatzZeile(a: ZoomAbbild): string[];          // ['bestätigt: N ms' | 'gilt ab dem nächsten Beitritt'] + TEXT_A4_SCHREIBFEHLER bei nurSitzung
// Aufgabe 4 · shared/types.ts
ZoomSollEintrag.stand: 'wartet' | 'doppelname' | 'verwaist' | 'grenze';
// schon im Ausgangsstand vorhanden
export const TEXT_A4_SCHREIBFEHLER: string;                     // 'Nur für diese Sitzung gemerkt — die Einstellungsdatei ließ sich nicht schreiben.'
export function versatzUebernommen(r: ZoomErgebnis): boolean;    // Aufgabe 4: ok oder TEXT_A4_SCHREIBFEHLER → die Karte übernimmt den Wert
zoomKnoepfe(a).abbrechen: boolean;                              // true genau in Z11
// Aufgabe 11 · kern.versatz(): bei nur Sitzung { ok: false, text: TEXT_A4_SCHREIBFEHLER }, videoDelay trotzdem gesendet (L14)
```
- Produces:
```ts
// shared/ipc.ts
IPC.zoomAbbrechen = 'jmc:zoom-abbrechen';                       // invoke → void
// shared/types.ts · JmConnectApi
zoomAbbrechen: () => Promise<void>;
// main/zoom.ts · registriereKanaele
ipcMain.handle(IPC.zoomAbbrechen, (): void => k.abbrechen());
```

**Vorab (für den Umsetzer):**
- Stand: nach den Aufgaben 1–17. Alle Vorher-Ausschnitte kommen genau einmal vor (gemessen am Ausgangsstand; die Aufgaben 4, 11 und 15 ändern in `types.ts` bzw. `zoom.ts` nur andere Stellen). CRLF im Arbeitsbaum (G14): Edit-Werkzeug.
- In `ZoomCard.tsx` heißt der lokale Textbaustein heute `sollText` (Zeilen 54–58), und `sollZeile` ist der Name der lokalen Funktion, die eine Listenzeile rendert (Zeile 446). Weil `sollZeile` jetzt aus `@shared/zoom-text` kommt, heißt die lokale Renderfunktion künftig `sollEintrag`.
- Antwortet `zoomVersatz` mit `TEXT_A4_SCHREIBFEHLER`, gilt der Wert (L14). Das Feld wird darum nicht rot und übernimmt den Wert; den Hinweis zeigt dauerhaft `versatzZeile` unter dem Feld.
- Ein Stand `grenze` erscheint gelb wie die Warnung Q10. Er hat den Knopf „Vergessen“ wie `wartet` und `doppelname`; von Hand geladen wird aus der Teilnehmerliste (Q9, zweiter Klick).
- Beim Planen gegen Ersatzstücke für die Aufgaben 4 und 9 gemessen, bei der Montage am ganz nachgespielten Plan bestätigt (alle Belege unten wie angegeben).

- [ ] **Step 1: Ausgangsbelege.**

Run (aus der Worktree-Wurzel):
```bash
grep -c "zoomAbbrechen: 'jmc:zoom-abbrechen'" apps/connect/src/shared/ipc.ts
grep -c "IPC.zoomAbbrechen" apps/connect/src/preload/index.ts apps/connect/src/main/zoom.ts
grep -c "setNummer('')" apps/connect/src/renderer/src/zoom/ZoomCard.tsx
grep -c "{q.bild}" apps/connect/src/renderer/src/zoom/ZoomCard.tsx
grep -c "function sollText" apps/connect/src/renderer/src/zoom/ZoomCard.tsx
grep -c 'für ${g.name}' apps/connect/src/renderer/src/App.tsx
```
Expected (gemessen): `0`, dann `apps/connect/src/preload/index.ts:0` und `apps/connect/src/main/zoom.ts:0`, dann `0`, `1`, `1`, `1`.

- [ ] **Step 2: API-Typ und Kanal.**

Datei `apps/connect/src/shared/types.ts`. Vorher (Zeile 273, eindeutig):
```ts
  zoomVerlassen: () => Promise<void>;
```
Nachher:
```ts
  zoomVerlassen: () => Promise<void>;
  /** Wiederbeitritt abbrechen (nur Z11, Spec 6.8): Meldung R7, „Erneut beitreten“ behält Nummer, Kenncode und gemerkte Quellen. */
  zoomAbbrechen: () => Promise<void>;
```

Datei `apps/connect/src/shared/ipc.ts`. Ersetzung 1. Vorher (Zeilen 41–42, eindeutig):
```ts
  // ── Zoom (Stage 4a, Spec 5.5). Der Kenncode geht nur mit zoomBeitreten in den Main und kommt nie
  // zurück. `zoomAbbrechen` (Wiederbeitritt abbrechen) kommt erst mit Plan 4b.
```
Nachher:
```ts
  // ── Zoom (Stage 4, Spec 5.5). Der Kenncode geht nur mit zoomBeitreten in den Main und kommt nie
  // zurück.
```

Ersetzung 2. Vorher (Zeile 68, eindeutig):
```ts
  zoomVerlassen: 'jmc:zoom-verlassen',
```
Nachher:
```ts
  zoomVerlassen: 'jmc:zoom-verlassen',
  /** invoke: Wiederbeitritt abbrechen (nur Z11; sonst wirkungslos) → void (Spec 5.5, 6.8). */
  zoomAbbrechen: 'jmc:zoom-abbrechen',
```

- [ ] **Step 3: Typecheck (rot).**

Run: `npm run typecheck -w @jm/connect`
Expected (gemessen): genau ein Fehler, Exit-Code ungleich 0:
```
src/preload/index.ts(33,7): error TS2741: Property 'zoomAbbrechen' is missing in type '{ platform: Platform; … }' but required in type 'JmConnectApi'.
```

- [ ] **Step 4: Preload und Main-Handler.**

Datei `apps/connect/src/preload/index.ts`. Vorher (Zeile 89, eindeutig):
```ts
  zoomVerlassen: () => ipcRenderer.invoke(IPC.zoomVerlassen) as Promise<void>,
```
Nachher:
```ts
  zoomVerlassen: () => ipcRenderer.invoke(IPC.zoomVerlassen) as Promise<void>,
  zoomAbbrechen: () => ipcRenderer.invoke(IPC.zoomAbbrechen) as Promise<void>,
```

Datei `apps/connect/src/main/zoom.ts`. Vorher (Zeilen 146–148, eindeutig):
```ts
  ipcMain.handle(IPC.zoomVerlassen, async (): Promise<void> => {
    await k.verlassen();
  });
```
Nachher:
```ts
  ipcMain.handle(IPC.zoomVerlassen, async (): Promise<void> => {
    await k.verlassen();
  });

  // Spec 6.8: nur in Z11 wirksam (der Kern prüft den Zustand); Nummer, Kenncode und gemerkte Quellen bleiben.
  ipcMain.handle(IPC.zoomAbbrechen, (): void => k.abbrechen());
```

- [ ] **Step 5: Karte und Audit-Zeile.**

Datei `apps/connect/src/renderer/src/zoom/ZoomCard.tsx`. Ersetzung 1 (Importe). Vorher (Zeilen 8–20, eindeutig):
```tsx
import {
  einrichtungsTextArt,
  kartenZeile,
  Q9_ANFANG,
  sdkBalken,
  sdkKnopf,
  sdkLadenZeile,
  sdkSchluesselZeile,
  sdkZeile,
  TEXT_S11,
  zoomKnoepfe,
  zugangZeile,
} from '@shared/zoom-text';
```
Nachher:
```tsx
import {
  einrichtungsTextArt,
  kartenZeile,
  Q9_ANFANG,
  quellenZustandText,
  sdkBalken,
  sdkKnopf,
  sdkLadenZeile,
  sdkSchluesselZeile,
  sdkZeile,
  sollZeile,
  TEXT_S11,
  versatzUebernommen,
  versatzZeile,
  zoomKnoepfe,
  zugangZeile,
} from '@shared/zoom-text';
```

Ersetzung 2 (lokale Textkopie entfällt, der Text kommt aus `sollZeile`). Vorher (Zeilen 54–60, eindeutig):
```tsx
function sollText(e: ZoomSollEintrag): string {
  if (e.stand === 'wartet') return `${e.name} — wartet auf die Person`;
  if (e.stand === 'doppelname') return `${e.name} — Name doppelt, bitte von Hand laden`;
  return `${e.name} — Person weg, Quelle schwarz`;
}

function Kennzeichen(
```
Nachher:
```tsx
function Kennzeichen(
```

Ersetzung 3. Vorher (Zeile 256, eindeutig):
```tsx
  // Countdown der Statuszeile (Z11, kommt mit 4b): nur ticken, solange ein Zeitpunkt ansteht.
```
Nachher:
```tsx
  // Countdown der Statuszeile (Z11): nur ticken, solange ein Zeitpunkt ansteht.
```

Ersetzung 4 (Versatz nur für die Sitzung ist kein Fehler). Vorher (Zeilen 360–364, eindeutig):
```tsx
    void fuehreAus('versatz', null, () => window.jmconnect.zoomVersatz({ ms })).then((r) => {
      if (r.ok) {
        setVersatz(null);
        setVersatzFehler(null);
      } else if (r.text) {
```
Nachher:
```tsx
    void fuehreAus('versatz', null, () => window.jmconnect.zoomVersatz({ ms })).then((r) => {
      // „Nur für diese Sitzung gemerkt“ (L14) ist kein Fehler: Der Wert gilt; dass er einen Neustart nicht
      // übersteht, steht dauerhaft unter dem Feld (versatzZeile). Die Regel steckt getestet in versatzUebernommen.
      if (versatzUebernommen(r)) {
        setVersatz(null);
        setVersatzFehler(null);
      } else if (!r.ok && r.text) {
```

Ersetzung 5 (Klartext statt Rohwerten). Vorher (Zeilen 428–433, eindeutig):
```tsx
          {q ? (
            <>
              {q.ndiName} · Bild {q.bild} ({q.bildGrund}) · Ton {q.ton}
              {q.tonGrund ? ` (${q.tonGrund})` : ''}
            </>
          ) : (
```
Nachher:
```tsx
          {q ? (
            <>
              {q.ndiName} · {quellenZustandText(q)}
            </>
          ) : (
```

Ersetzung 6 (gemerkte Quelle: Text aus `sollZeile`, Stand `grenze` gelb). Vorher (Zeilen 446–454, eindeutig):
```tsx
  const sollZeile = (e: ZoomSollEintrag): JSX.Element => {
    const rot = e.stand === 'doppelname' || (e.stand === 'verwaist' && e.doppelname);
    const ort: Ort = `soll:${e.name}`;
    const text = antwortText(ort);
    const aboId = e.stand === 'verwaist' ? e.aboId : null;
    return (
      <li key={e.name} className="text-xs">
        <div className="flex items-center gap-2">
          <span className={rot ? 'text-red-300' : 'text-neutral-300'}>{sollText(e)}</span>
```
Nachher:
```tsx
  const sollEintrag = (e: ZoomSollEintrag): JSX.Element => {
    const rot = e.stand === 'doppelname' || (e.stand === 'verwaist' && e.doppelname);
    // 'grenze' (L7): nicht automatisch geladen, weil schon 5 Zoom-Quellen laufen. Von Hand laden geht (Q9).
    const farbe = rot ? 'text-red-300' : e.stand === 'grenze' ? 'text-yellow-200' : 'text-neutral-300';
    const ort: Ort = `soll:${e.name}`;
    const text = antwortText(ort);
    const aboId = e.stand === 'verwaist' ? e.aboId : null;
    return (
      <li key={e.name} className="text-xs">
        <div className="flex items-center gap-2">
          <span className={farbe}>{sollZeile(e)}</span>
```

Ersetzung 7 („Schließen“ leert das Nummernfeld). Vorher (Zeilen 508–512, eindeutig):
```tsx
            {mk.schliessen && (
              <button
                onClick={() => void fuehreAus('schliessen', 'karte', () => ohneText(window.jmconnect.zoomSchliessen()))}
                className={RAND}
              >
```
Nachher:
```tsx
            {mk.schliessen && (
              <button
                onClick={() => {
                  // N4b.3 Nr. 5: „Schließen“ leert auch das Nummernfeld der Karte (der Kenncode ist seit dem Klick auf „Beitreten“ leer).
                  setNummer('');
                  void fuehreAus('schliessen', 'karte', () => ohneText(window.jmconnect.zoomSchliessen()));
                }}
                className={RAND}
              >
```

Ersetzung 8 („Abbrechen“ in Z11). Vorher (Zeilen 737–744, eindeutig):
```tsx
      {/* 5 · Laufend (Z3–Z11). Der Z11-Knopf „Abbrechen“ kommt mit Plan 4b. */}
      {kn.verlassen && (
        <div className="mb-3">
          <button disabled={laeuft.has('verlassen')} onClick={verlassen} className={frage ? ROT : RAND}>
            {frage ? (n === 1 ? 'Ja, verlassen (1 Quelle läuft)' : `Ja, verlassen (${n} Quellen laufen)`) : 'Meeting verlassen'}
          </button>
        </div>
      )}
```
Nachher:
```tsx
      {/* 5 · Laufend (Z3–Z11). 6 · Nur in Z11 zusätzlich „Abbrechen“: Wiederbeitritt beenden, die Daten für „Erneut beitreten“ bleiben (Spec 6.8). */}
      {kn.verlassen && (
        <div className="mb-3 flex flex-wrap gap-2">
          <button disabled={laeuft.has('verlassen')} onClick={verlassen} className={frage ? ROT : RAND}>
            {frage ? (n === 1 ? 'Ja, verlassen (1 Quelle läuft)' : `Ja, verlassen (${n} Quellen laufen)`) : 'Meeting verlassen'}
          </button>
          {kn.abbrechen && (
            <button
              disabled={laeuft.has('abbrechen')}
              onClick={() => void fuehreAus('abbrechen', 'karte', () => ohneText(window.jmconnect.zoomAbbrechen()))}
              className={RAND}
            >
              Abbrechen
            </button>
          )}
        </div>
      )}
```

Ersetzung 9 (Versatz-Zeilen). Vorher (Zeilen 767–769, eindeutig):
```tsx
        <p className="mt-1 text-xs text-neutral-500">
          {a.versatz.bestaetigtMs !== null ? `bestätigt: ${a.versatz.bestaetigtMs} ms` : 'gilt ab dem nächsten Beitritt'}
        </p>
```
Nachher:
```tsx
        {/* „bestätigt: … ms“ bzw. „gilt ab dem nächsten Beitritt“; nur für die Sitzung gemerkt zusätzlich gelb (L14). */}
        {versatzZeile(a).map((z, i) => (
          <p key={z} className={`mt-1 text-xs ${i === 0 ? 'text-neutral-500' : 'text-yellow-200'}`}>
            {z}
          </p>
        ))}
```

Ersetzung 10 (Aufruf der umbenannten Renderfunktion). Vorher (Zeilen 776–780, eindeutig):
```tsx
      {/* 9 · Gemerkte Quellen (offene Soll-Einträge, Spec 6.3) */}
      {a.soll.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-xs font-semibold text-neutral-400">Gemerkte Quellen</div>
          <ul className="space-y-1">{a.soll.map((e) => sollZeile(e))}</ul>
```
Nachher:
```tsx
      {/* 9 · Gemerkte Quellen (offene Soll-Einträge, Spec 6.3; Stand 'grenze' über der Betriebsgröße, L7) */}
      {a.soll.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-xs font-semibold text-neutral-400">Gemerkte Quellen</div>
          <ul className="space-y-1">{a.soll.map((e) => sollEintrag(e))}</ul>
```

Datei `apps/connect/src/renderer/src/App.tsx`. Vorher (Zeile 341, eindeutig):
```tsx
                      window.jmconnect.audit('slides', `${g.canAdvance ? 'entzogen' : 'erteilt'} für ${g.name}`);
```
Nachher:
```tsx
                      // Kennung statt Name: Gastnamen gehören nicht ins Log (Spec N4b.2, L11), wie bei „slides“ per Steuerprotokoll.
                      window.jmconnect.audit('slides', `${g.canAdvance ? 'entzogen' : 'erteilt'} für ${g.id}`);
```

- [ ] **Step 6: Typecheck (grün).**

Run: `npm run typecheck -w @jm/connect`
Expected: keine Zeile mit `error TS`, Exit-Code 0 (`typecheck:node` und `typecheck:web`).

- [ ] **Step 7: Bau und Belege im Bündel.**

Run:
```bash
npm run build -w @jm/connect
grep -c "jmc:zoom-abbrechen" apps/connect/out/main/index.cjs apps/connect/out/preload/index.cjs
grep -c "zoomAbbrechen()" apps/connect/out/renderer/assets/index-*.js
```
Expected: `electron-vite build` dreimal `✓ built in …`, Exit-Code 0; dann `apps/connect/out/main/index.cjs:1` und `apps/connect/out/preload/index.cjs:1`; dann `1`.

- [ ] **Step 8: Belege im Quelltext.**

Run:
```bash
grep -c "zoomAbbrechen" apps/connect/src/shared/ipc.ts apps/connect/src/preload/index.ts apps/connect/src/main/zoom.ts
grep -c "setNummer('')" apps/connect/src/renderer/src/zoom/ZoomCard.tsx
grep -c "{q.bild}" apps/connect/src/renderer/src/zoom/ZoomCard.tsx
grep -c "function sollText" apps/connect/src/renderer/src/zoom/ZoomCard.tsx
grep -c 'für ${g.name}' apps/connect/src/renderer/src/App.tsx
grep -c 'für ${g.id}' apps/connect/src/renderer/src/App.tsx
```
Expected (gemessen): `apps/connect/src/shared/ipc.ts:1`, `apps/connect/src/preload/index.ts:1`, `apps/connect/src/main/zoom.ts:1`; dann `1`, `0`, `0`, `0`, `1`.

- [ ] **Step 9: Selbsttest unverändert grün.**

Run: `npm run selftest -w @jm/connect`
Expected: Exit-Code 0, keine Zeile mit `FAIL`; die Zählstände sind die nach Aufgabe 17 (diese Aufgabe ändert keinen Test).

- [ ] **Step 10: Commit.**

```bash
git add apps/connect/src/shared/ipc.ts apps/connect/src/shared/types.ts apps/connect/src/preload/index.ts apps/connect/src/main/zoom.ts apps/connect/src/renderer/src/zoom/ZoomCard.tsx apps/connect/src/renderer/src/App.tsx
git status --short
```
Erwartet genau diese gestagten Zeilen (sonst nichts Gestagtes):
```
M  apps/connect/src/main/zoom.ts
M  apps/connect/src/preload/index.ts
M  apps/connect/src/renderer/src/App.tsx
M  apps/connect/src/renderer/src/zoom/ZoomCard.tsx
M  apps/connect/src/shared/ipc.ts
M  apps/connect/src/shared/types.ts
```
Dann:
```bash
git commit -m "feat(connect): Karte - Wiederbeitritt abbrechen, Nummer leeren, Bild/Ton im Klartext, Grenze, Versatz nur Sitzung" -m "IPC zoomAbbrechen (Spec 5.5, 6.8) in ipc.ts, JmConnectApi, Preload und registriereKanaele; Knopf Abbrechen in Z11. Schliessen leert das Nummernfeld (N4b.3 Nr. 5). Quellenzeile mit quellenZustandText statt Rohwerten, gemerkte Quellen mit sollZeile aus @shared/zoom-text (Stand grenze gelb), Versatz-Zeilen aus versatzZeile; die Antwort nur fuer diese Sitzung gilt als uebernommen (L14). Audit-Zeile slides nennt die Gast-Kennung statt des Namens (N4b.2, L11)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen von der Gliederung:**
1. **Namen in der Karte:** Die lokale Textkopie heißt im Ausgangsstand `sollText` (`ZoomCard.tsx:54-58`), nicht `sollZeile`. `sollZeile` heißt dort die lokale Renderfunktion (`:446`); sie wird zu `sollEintrag`, damit der Import aus `@shared/zoom-text` nicht verdeckt wird.
2. **Antwort `TEXT_A4_SCHREIBFEHLER` beim Versatz** übernimmt den Wert und färbt das Feld nicht rot (sonst stünde neben dem gelben Dauerhinweis eine rote Fehlermeldung für einen gültigen Wert). Nachbesserung: Die Entscheidung trifft `versatzUebernommen` aus Aufgabe 4 und ist dort getestet; die Karte ruft sie nur. Der Fehlerzweig prüft `!r.ok` noch einmal, weil TypeScript `ZoomErgebnis` über einen booleschen Helfer nicht verengt (gemessen: sonst `error TS2339: Property 'text' does not exist on type 'ZoomErgebnis'`). „Schließen“ leert das Nummernfeld über den React-Zustand (`setNummer('')`) und bleibt ohne eigenen Test: Der Renderer hat keinen Test (G10), ein reiner Helfer für einen einzigen Setter-Aufruf prüfte nur sich selbst. Belegt sind Code (Step 8) und Verhalten in der Abnahme (E5, F3).
3. **Stand `grenze` gelb** (wie Q10); die Gliederung legt keine Farbe fest.
4. **Kommentar in `ipc.ts`** nennt `zoomAbbrechen` nicht mehr, damit `grep -c zoomAbbrechen` genau den Kanal zählt (`1`).
5. **Belege im Bündel** (Step 7) zusätzlich zu den Belegen im Quelltext.

---

### Task 19: sdk-laden: `stderr` mit `error`-Zuhörer, Diagnose in windows-1252

**Spec:** Spec 0.2.2 (`docs/superpowers/specs/2026-10-06-connect-zoom-sdk-laden-design.md`, Abschnitt 4.3: Diagnose von tar.exe im Log), dazu die beiden geparkten Punkte aus der 0.2.2-Gesamtprüfung (Ruling „in 4b übernommen“): `kind.stderr` ohne `error`-Zuhörer, Dekodierung `latin1` statt windows-1252 (Ist-Karten `ist-logs.md` Nr. 7, `ist-randfaelle.md`).

**Files:**
- Modify: `apps/connect/src/main/zoom/sdk-laden.ts:50-51` (Typ `KindProzess.stderr`), `:99` (Hilfsfunktion `ansiText` davor), `:288-293` (Lesen von `stderr`)
- Test: `apps/connect/test/sdk-laden.test.ts` (neuer Block direkt über der Ankerzeile `:567`)

**Interfaces:**
- Consumes: keine.
- Produces: keine neuen Exporte. Geändert ist nur der Typ, den Tests einspeisen:
```ts
export interface KindProzess {
  on(ereignis: 'error', f: (e: Error) => void): unknown;
  on(ereignis: 'close', f: (code: number | null) => void): unknown;
  kill(): boolean;
  stderr?: {
    on(ereignis: 'data', f: (d: Buffer | string) => void): unknown;
    on(ereignis: 'error', f: (e: Error) => void): unknown;   // neu
  } | null;
}
// intern: function ansiText(d: Buffer): string  — new TextDecoder('windows-1252'), ohne volle ICU latin1
```

**Vorab (für den Umsetzer):**
- Unabhängig von allen anderen Aufgaben. Beide Dateien liegen mit CRLF im Arbeitsbaum (G14); jeder Vorher-Ausschnitt kommt genau einmal vor (gemessen).
- Ohne Zuhörer wirft Node ein `error`-Ereignis eines Streams als Ausnahme; im Main-Prozess von Connect wäre das ein Absturz. Die Attrappe im Test fängt diesen Wurf selbst, damit der rote Lauf zählt, statt abzubrechen.
- Ein Lesefehler ändert das Ergebnis nicht (das bestimmt `close`), er kommt als Vermerk „(stderr nicht lesbar: <Code>)“ in `ausgabe` und damit in die vorhandene Logzeile `[zoom] Ausgabe von tar.exe: …` (`kern.ts`).
- windows-1252 und latin1 unterscheiden sich nur in 0x80–0x9F (€ „ “ ” ’ …). Gemessen unter Node 24.16 (volle ICU): `new TextDecoder('windows-1252').decode(Uint8Array.from([0x80,0xF6,0x93,0x94,0x84,0x92]))` liefert `€ö“”„’`. Node 22 war am Probelauf nicht vorhanden. Die offiziellen Node-Builds bringen volle ICU mit (Vorgabe seit Node 13), also auch `setup-node` mit Node 22 in CI. Der neue Testfall läuft in CI im Schritt „Connect (…)“ und würde rot, wenn die Kodierung dort fehlte; zur Laufzeit fiele `ansiText` dann auf latin1 zurück statt zu werfen.
- Gemessener Ausgang: `79 ok, 0 fehlgeschlagen, 0 übersprungen.`

- [ ] **Step 1: Test schreiben.**

Datei `apps/connect/test/sdk-laden.test.ts`. Vorher (Zeile 567, eindeutig):
```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```
Nachher:
```ts
// ── Aufgabe 19 (4b): stderr von tar.exe – Lesefehler abfangen, ANSI-Codepage richtig lesen ──
console.log('— Entpacken: Fehler auf stderr, Dekodierung windows-1252 (aus 0.2.2 geparkt)');
{
  // Meldet die stderr-Pipe 'error' und hört niemand zu, wirft Node den Fehler als Ausnahme: im Main-Prozess ein
  // Absturz von Connect. Die Attrappe fängt diesen Wurf selbst, damit der rote Lauf zählt statt abzubrechen.
  const mitStderrFehler = (code: number, geworfen: { ja: boolean }): ((befehl: string, args: readonly string[]) => KindProzess) => () => {
    const k = new EventEmitter() as EventEmitter & { kill(): boolean; stderr: EventEmitter };
    k.stderr = new EventEmitter();
    k.kill = () => true;
    setImmediate(() => {
      try {
        k.stderr.emit('error', Object.assign(new Error('read EPIPE'), { code: 'EPIPE' }));
      } catch {
        geworfen.ja = true;
      }
      k.emit('close', code);
    });
    return k;
  };
  const g1 = { ja: false };
  const r1 = merke(await entpacke({ zip: 'p.zip', ordner: join(tmp, 'aus-14'), signal: sig(), werkzeuge: { ...WIN, starte: mitStderrFehler(1, g1) } }));
  ck('stderr meldet error → kein Wurf', !g1.ja);
  ck('… Exit 1: grund bleibt „Exit 1“, die Diagnose nennt den Lesefehler mit Code',
    JSON.stringify(r1) === '{"ok":false,"art":"entpacken","grund":"Exit 1","ausgabe":"(stderr nicht lesbar: EPIPE)"}');
  const g2 = { ja: false };
  const r2 = merke(await entpacke({ zip: 'p.zip', ordner: join(tmp, 'aus-15'), signal: sig(), werkzeuge: { ...WIN, starte: mitStderrFehler(0, g2) } }));
  ck('… Exit 0 trotz Fehler auf stderr → ok, kein Wurf', r2.ok && !g2.ja);
}
{
  // bsdtar schreibt in der ANSI-Codepage (windows-1252). Dort sind 0x80–0x9F Zeichen (€ „ “ ” ’), in latin1
  // Steuerzeichen. Was hier ankommt, steht wörtlich im Log („[zoom] Ausgabe von tar.exe: …“, kern.ts).
  const bytes = Buffer.concat([Buffer.from('tar.exe: '), Buffer.from([0x80, 0xf6, 0x93, 0x94, 0x0d, 0x0a])]);
  const starte = (): KindProzess => {
    const k = new EventEmitter() as EventEmitter & { kill(): boolean; stderr: EventEmitter };
    k.stderr = new EventEmitter();
    k.kill = () => true;
    setImmediate(() => {
      k.stderr.emit('data', bytes);
      k.emit('close', 1);
    });
    return k;
  };
  const r = merke(await entpacke({ zip: 'p.zip', ordner: join(tmp, 'aus-16'), signal: sig(), werkzeuge: { ...WIN, starte } }));
  ck('Bytes 0x80 0xF6 0x93 0x94 → Euro, ö und zwei Anführungszeichen in der Ausgabe (windows-1252, nicht latin1)',
    !r.ok && r.art === 'entpacken' && r.ausgabe === 'tar.exe: €ö“”');
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

- [ ] **Step 2: Test laufen lassen (rot).**

Run (aus der Worktree-Wurzel): `npx tsx apps/connect/test/sdk-laden.test.ts`
Expected (gemessen): genau diese vier Zeilen mit `FAIL`, Schluss `79 ok, 4 fehlgeschlagen, 0 übersprungen.`, Exit-Code 1:
```
FAIL  stderr meldet error → kein Wurf
FAIL  … Exit 1: grund bleibt „Exit 1“, die Diagnose nennt den Lesefehler mit Code
FAIL  … Exit 0 trotz Fehler auf stderr → ok, kein Wurf
FAIL  Bytes 0x80 0xF6 0x93 0x94 → Euro, ö und zwei Anführungszeichen in der Ausgabe (windows-1252, nicht latin1)
```

- [ ] **Step 3: Implementierung.**

Datei `apps/connect/src/main/zoom/sdk-laden.ts`. Ersetzung 1. Vorher (Zeilen 50–51, eindeutig):
```ts
  /** Die Diagnose von tar.exe; fehlt sie (Attrappe), gibt es eben keine. */
  stderr?: { on(ereignis: 'data', f: (d: Buffer | string) => void): unknown } | null;
```
Nachher:
```ts
  /**
   * Die Diagnose von tar.exe; fehlt sie (Attrappe), gibt es eben keine. 'error' braucht einen Zuhörer: Ohne ihn
   * wirft Node einen Lesefehler der Pipe als Ausnahme, und der Main-Prozess stürzt ab.
   */
  stderr?: {
    on(ereignis: 'data', f: (d: Buffer | string) => void): unknown;
    on(ereignis: 'error', f: (e: Error) => void): unknown;
  } | null;
```

Ersetzung 2. Vorher (Zeile 99, eindeutig):
```ts
function wartezeit(kopf: string | null): number {
```
Nachher:
```ts
/**
 * Text aus der ANSI-Codepage von tar.exe (windows-1252): 0x80–0x9F sind dort €, „, “, ” und andere Zeichen, in
 * latin1 Steuerzeichen. Fehlt die Kodierung (Node ohne volle ICU), bleibt es bei latin1; der Selbsttest
 * (sdk-laden.test.ts) wird dann rot.
 */
function ansiText(d: Buffer): string {
  try {
    return new TextDecoder('windows-1252').decode(d);
  } catch {
    return d.toString('latin1');
  }
}

function wartezeit(kopf: string | null): number {
```

Ersetzung 3. Vorher (Zeilen 288–293, eindeutig):
```ts
    // bsdtar schreibt in der ANSI-Codepage (gemessen: „ö“ im Pfad kommt als 0xF6), latin1 liest das für cp1252
    // richtig. Gelesen wird bis zum Ende, damit die Pipe nie vollläuft; gemerkt nur der Anfang.
    let ausgabe = '';
    kind.stderr?.on('data', (d) => {
      if (ausgabe.length < TAR_AUSGABE_MAX) ausgabe += typeof d === 'string' ? d : d.toString('latin1');
    });
```
Nachher:
```ts
    // bsdtar schreibt in der ANSI-Codepage (gemessen: „ö“ im Pfad kommt als 0xF6). Gelesen wird bis zum Ende,
    // damit die Pipe nie vollläuft; gemerkt nur der Anfang.
    let ausgabe = '';
    kind.stderr?.on('data', (d) => {
      if (ausgabe.length < TAR_AUSGABE_MAX) ausgabe += typeof d === 'string' ? d : ansiText(d);
    });
    // Ein Lesefehler der Pipe darf Connect nicht abstürzen lassen. Er kommt als Vermerk in die Diagnose; das
    // Ergebnis bestimmt weiter 'close'.
    kind.stderr?.on('error', (err) => {
      if (ausgabe.length < TAR_AUSGABE_MAX) ausgabe += ` (stderr nicht lesbar: ${fehlerCode(err)})`;
    });
```

- [ ] **Step 4: Test laufen lassen (grün).**

Run: `npx tsx apps/connect/test/sdk-laden.test.ts`
Expected (gemessen unter Windows): keine Zeile mit `FAIL`, Schluss `83 ok, 0 fehlgeschlagen, 0 übersprungen.`, Exit-Code 0. Unter Linux (CI) überspringt die Datei wie bisher die vier Fälle mit dem echten tar.exe; dort ist `79 ok, 0 fehlgeschlagen, 4 übersprungen.` zu erwarten (abgeleitet, nicht gemessen).

- [ ] **Step 5: Typecheck.**

Run: `npm run typecheck -w @jm/connect`
Expected: keine Zeile mit `error TS`, Exit-Code 0. (Der Standard-Start `spawn(…)` liefert ein `ChildProcess`, dessen `stderr` beide Überladungen erfüllt; gemessen.)

- [ ] **Step 6: Gegenproben.**

(a) In `sdk-laden.ts` in `ansiText` die Zeile `    return new TextDecoder('windows-1252').decode(d);` vorübergehend durch `    return d.toString('latin1');` ersetzen, dann `npx tsx apps/connect/test/sdk-laden.test.ts`.
Expected (gemessen): genau `FAIL  Bytes 0x80 0xF6 0x93 0x94 → Euro, ö und zwei Anführungszeichen in der Ausgabe (windows-1252, nicht latin1)`, Schluss `82 ok, 1 fehlgeschlagen, 0 übersprungen.` Zurücksetzen.

(b) Die Zeile `    kind.stderr?.on('error', (err) => {` vorübergehend durch `    kind.stderr?.on('xerror' as 'error', (err) => {` ersetzen, dann denselben Test.
Expected (gemessen): die drei `FAIL`-Zeilen des stderr-Blocks aus Step 2, Schluss `80 ok, 3 fehlgeschlagen, 0 übersprungen.` Zurücksetzen und erneut laufen lassen: `83 ok, 0 fehlgeschlagen, 0 übersprungen.`

- [ ] **Step 7: Commit.**

```bash
git add apps/connect/src/main/zoom/sdk-laden.ts apps/connect/test/sdk-laden.test.ts
git status --short
```
Erwartet genau diese gestagten Zeilen (sonst nichts Gestagtes):
```
M  apps/connect/src/main/zoom/sdk-laden.ts
M  apps/connect/test/sdk-laden.test.ts
```
Dann:
```bash
git commit -m "fix(connect): tar-Diagnose - stderr-Fehler abgefangen, windows-1252 statt latin1" -m "entpacke() haengt einen error-Zuhoerer an kind.stderr: Ein Lesefehler der Pipe brachte sonst den Main-Prozess zu Fall; er steht jetzt als Vermerk in der Diagnose, das Ergebnis bestimmt weiter close. Die Ausgabe von bsdtar wird als windows-1252 gelesen (0x80-0x9F: Euro, Anfuehrungszeichen), ohne volle ICU als latin1. Beide Punkte aus der 0.2.2-Gesamtpruefung, in 4b uebernommen." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen von der Gliederung:**
1. **Der Lesefehler steht als Vermerk in `ausgabe`** („(stderr nicht lesbar: EPIPE)“). Die Gliederung verlangt eine „Logzeile“; `entpacke` hat keinen Logger, und die vorhandene Logzeile `[zoom] Ausgabe von tar.exe: …` im Kern trägt den Vermerk bei Exit ungleich 0 mit. Bei Exit 0 bleibt es still, wie bei jeder anderen stderr-Ausgabe.
2. **Rückfall auf latin1**, wenn die Kodierung fehlt (`RangeError` beim Anlegen des Decoders): zur Laufzeit kein Absturz, im Test rot.
3. **Node 22 nicht lokal gemessen** (nicht installiert); belegt ist Node 24.16. Die CI misst Node 22 mit diesem Testfall.

---

### Task 20: Handbuch JM Connect und Doku mitziehen

**Spec:** 14 (ganz: Format, Inhalt Punkte 1–10, „Mitzuziehen“), 11.5, 17.2 Nr. 2 und 3 (Companion-Hinweise), N4b.1 (Verhalten beim Entzug), N4b.2 (keine Namen im Log, 14 Tage), Spec 0.2.2 Abschnitte 1 und 4.2 (Zoom-SDK laden nur auf JM-eigenen Rechnern), Nachtrag „Zugangsdaten von Hand“. Texte aus Spec 8 in der Fassung des Codes (`klartext.ts`; S10, B9, B17 und A5 sind seit 0.2.1/0.2.2 neu gefasst) und aus der Texttabelle dieses Plans.

**Files:**
- Modify: `packages/cookbook/src/build.mjs:57`, `:98` (Zeilenenden, siehe Vorab)
- Create: `packages/cookbook/content/tool-manuals/tool-jm-connect.md`
- Regenerate: `packages/cookbook/cookbook.json` (`npm run cookbook:build`)
- Modify: `docs/roadmap.md:29`, `:154`
- Modify: `packages/zoom-bridge/README.md:863-869`, `:877-882` (Abschnitt 9; Zeilen im Ausgangsstand, Aufgabe 2 schiebt sie nach unten)
- Modify: `packages/zoom-bridge/package.json:6` (Beschreibung)

**Interfaces:**
- Consumes: das Verhalten aus den Aufgaben 1–19 (nur beschrieben, kein Code): Wiederbeitritt mit Plan 2, 5, 10, 20, 30 s und „Abbrechen“ (Aufgaben 8, 9, 18), Entzug und Wiedererteilung (Aufgaben 1, 2, 10), Betriebsgröße und Stand `grenze` (Aufgaben 6, 10), Fernsteuerung mit `zoom_cmd*` (Aufgaben 13–16), Modul 0.2.0 mit Anzahlen als wahr und kodierten Namen (Aufgaben 14, 16), Logs ohne Namen und mit Löschfrist (Aufgaben 12, 17, 18), Klartext für Bild und Ton (Aufgaben 4, 18), „(2)“ bei Doppelnamen (Aufgaben 1, 6, 11).
- Produces: `packages/cookbook/content/tool-manuals/tool-jm-connect.md` (Rezept `tool-jm-connect`, Kategorie Tool-Manuals), `cookbook.json` mit 43 Rezepten; `build.mjs` liest CRLF wie LF.

**Vorab (für den Umsetzer):**
- **Kochbuch unter Windows:** Die `.md`-Blobs und `cookbook.json` liegen im Repo mit LF. Mit `core.autocrlf=true` (Systemkonfiguration) stehen sie im Arbeitsbaum mit CRLF. Gemessen am unveränderten Worktree (HEAD `051151d614`): `npm run cookbook:check` meldet „cookbook.json ist veraltet …“. Ein `cookbook:build` unter Windows schrieb zudem 1 456 `\r`-Escapes in die `markdown`-Felder von 13 Best-Practice-Rezepten, und die CI (Ubuntu, LF) hielte das Ergebnis für veraltet. Step 2 lässt `build.mjs` darum CRLF wie LF lesen; LF-Quellen und damit die CI bleiben unberührt.
- Das Rezeptformat übernimmt nur Listenpunkte unter `### …` in „Zutaten“, je eine Liste für „Einrichtung“ (Vorbereitung), „Während“ und „Nachbereitung“, „Profi-Tipps“, eine **zweispaltige** Tabelle unter „Pannenhilfe“ und „Checklisten“ (`recipe-parse.mjs`). Fließtext fällt weg, und der Launcher zeigt die Punkte als reinen Text (kein Fettdruck, keine Backticks). Die zehn Punkte aus Spec 14 sind darum so verteilt: 1 → „Voraussetzungen“ und „Netzwerk & Steuerung“, 2 → „Browser-Gäste (kurz)“, 3 und 4 → „Einrichtung“, 5 → „Während“, 6 → „Nachbereitung“, 7 → „Harte Grenzen“, 8 → „Pannenhilfe“ mit den Spalten „Meldung“ und „Ursache und Abhilfe“, 9 → „Checklisten“, 10 → „Deinstallieren“. Die Zusätze der Gliederung (Wiederbeitritt mit Countdown und „Abbrechen“, Entzug, gemerkte Quellen mit Grenze, Logs, Companion, Rundown) stehen in „Während“, „Netzwerk & Steuerung“, „Logs und Datenschutz“ und „Pannenhilfe“.
- `lastReviewed: 2026-10-06` bestimmt `updatedAt` in `cookbook.json`. Wer das Datum ändert, baut `cookbook.json` neu (Step 6).
- Die Beschreibung von `@jm/zoom-bridge` steht nicht in `package-lock.json` (gemessen: 0 Treffer); der Lockfile bleibt unverändert.
- Ein reiner Doku-Commit löst `ci-checks.yml` nicht aus (`paths-ignore: **/*.md`), wohl aber `cookbook-check.yml` (Pfad `packages/cookbook/**`).

- [ ] **Step 1: Ausgangslage messen (rot unter Windows).**

Run (aus der Worktree-Wurzel): `npm run cookbook:check`
Expected (gemessen): `cookbook.json ist veraltet — bitte \`npm run cookbook:build\` ausführen und committen.`, Exit-Code 1.

- [ ] **Step 2: `build.mjs` liest CRLF wie LF.**

Datei `packages/cookbook/src/build.mjs`. Ersetzung 1. Vorher (Zeile 57, eindeutig):
```js
  const recipe = parseRecipeMarkdown(readFileSync(file, 'utf8'));
```
Nachher:
```js
  // Windows mit core.autocrlf=true checkt die LF-Blobs als CRLF aus. Ohne das Ersetzen landen `\r` in den
  // markdown-Feldern, und die CI (Ubuntu, LF) hält cookbook.json für veraltet. LF-Quellen bleiben unverändert.
  const recipe = parseRecipeMarkdown(readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
```

Ersetzung 2. Vorher (Zeile 98, eindeutig):
```js
  const current = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, 'utf8') : '';
```
Nachher:
```js
  // Ebenso cookbook.json selbst: unter Windows im Arbeitsbaum mit CRLF, im Repo und in der CI mit LF.
  const current = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, 'utf8').replace(/\r\n/g, '\n') : '';
```

- [ ] **Step 3: Ausgangslage grün.**

Run: `npm run cookbook:check`
Expected (gemessen): `cookbook.json ist frisch (42 Rezepte).`, Exit-Code 0. Die 42 vorhandenen Rezepte bauen also unter Windows genau zu der `cookbook.json` im Repo.

- [ ] **Step 4: Handbuch anlegen (ganzer Inhalt).**

Datei `packages/cookbook/content/tool-manuals/tool-jm-connect.md`:

````markdown
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
````

- [ ] **Step 5: Pflichtstellen prüfen.**

Run (aus der Worktree-Wurzel, Git Bash):
```bash
node - <<'EOF'
const md = require('fs').readFileSync('packages/cookbook/content/tool-manuals/tool-jm-connect.md', 'utf8');
const pflicht = {
  S1: 'In diesem Ordner liegt kein Zoom-SDK', S2: 'Das ist die 32-Bit-Fassung des Zoom-SDK', S3: 'Dieses Zoom-SDK hat die Fassung',
  S3b: 'Die Fassung des Zoom-SDK lässt sich nicht lesen', S4: 'die wie eine Connect-Datei heißt', S5: 'Für die Kopie des Zoom-SDK fehlt Platz',
  S6: 'Das Zoom-SDK ließ sich nicht kopieren', S7: 'Die Kopie des Zoom-SDK ist unvollständig', S8: 'Dieser Connect-Installation fehlt die Zoom-Bridge',
  S9: 'Die Zoom-Laufzeit auf diesem PC ist unvollständig',
  S10: 'Während Zoom läuft oder das Zoom-SDK geladen oder kopiert wird, lässt sich die Einrichtung nicht ändern.',
  S11: 'fehlt der SDK-Schlüssel', S12: 'Der Proxy hat den SDK-Schlüssel abgelehnt', S14: 'Der Proxy ist nicht erreichbar',
  S15: 'Auf dem Proxy liegt kein passendes Zoom-SDK', S16c: 'Das geladene Zoom-SDK ließ sich nicht entpacken',
  B1: 'zoom-bridge.exe fehlt im Laufzeit-Ordner', B2: 'Windows hat den Start der Zoom-Bridge verhindert',
  B3_B5: 'Die Zoom-Bridge ist beim Start gestorben: Eine DLL', B6: 'bevor Zoom die Anmeldung beantwortet hat',
  B7: 'Die Zoom-Laufzeit meldet die Fassung', B8: 'Das Zoom-SDK ließ sich nicht starten',
  B8_14: 'Auf diesem PC läuft schon ein anderes Programm mit dem Zoom-Meeting-SDK', B9: 'Client-ID oder Client-Secret stimmen nicht',
  B10: 'Das Anmelde-Token passt nicht', B11: 'Das Zoom-Konto der App darf das Meeting-SDK nicht nutzen', B12: 'Zoom ist gerade nicht erreichbar',
  B13: 'Zoom lässt diese SDK-Fassung nicht mehr zu', B14: 'Zu viele Anmeldungen in kurzer Zeit', B15: '„Zoom hat die Anmeldung abgelehnt (',
  B16: 'Zoom hat auf die Anmeldung nicht geantwortet (30 s)', B17: 'Zugangsdaten fehlen — bitte eintragen oder die Datei wählen.',
  B18: 'Das Zoom-SDK hat die Anmeldung sofort abgewiesen', C4: 'falscher Kenncode.', C8: 'Dieses Meeting gibt es nicht',
  C63: 'Das Meeting gehört nicht zum Zoom-Konto dieser App', C500: 'im Namen eines angemeldeten Nutzers (OBF-Token)',
  CE: 'Zoom hat den Einlass in 30 s nicht abgeschlossen', Q1: 'Keine Aufnahme-Erlaubnis — der Host muss sie im Zoom-Client erteilen.',
  Q7: 'NDI ließ sich in der Zoom-Bridge nicht starten', Q10: 'NDI-Name doppelt: Ein Browser-Gast und diese Zoom-Person', Q11: 'Name doppelt im Meeting',
  R2: 'Wiederbeitritt gescheitert (', R6: 'Meeting beendet: ', R7: '„Wiederbeitritt abgebrochen.“',
  Z7_ENTZUG: 'Aufnahme-Erlaubnis vom Host entzogen, Quellen gestoppt', GRENZE: 'nicht automatisch geladen (mehr als 5 Zoom-Quellen), bitte von Hand laden',
  VERSATZ_SITZUNG: 'Nur für diese Sitzung gemerkt — die Einstellungsdatei ließ sich nicht schreiben.',
  COMPANION_ABGELEHNT: 'letzter Zoom-Befehl abgelehnt', LOGORDNER: 'Logordner öffnen', ABBRECHEN: '„Abbrechen“ beendet die Versuche',
  LOGS_14: 'älter als 14 Tage', LOGS_NAMEN: 'nie mit dem Anzeigenamen', MODUL_020: 'ab Modul 0.2.0',
  RUNDOWN: 'Rundown kennt die Zoom-Aktionen erst ab seinem nächsten Release', DEINSTALL: 'ZoomSDK an. Auch dieser Ordner bleibt',
};
const fehlt = Object.entries(pflicht).filter(([, t]) => !md.includes(t)).map(([k]) => k);
console.log(fehlt.length ? `FEHLT: ${fehlt.join(', ')}` : `${Object.keys(pflicht).length} Pflichtstellen im Handbuch`);
process.exit(fehlt.length ? 1 : 0);
EOF
```
Expected (gemessen): `56 Pflichtstellen im Handbuch`, Exit-Code 0. Gegenprobe (gemessen): Ohne die Tabellenzeile „Wiederbeitritt abgebrochen.“ meldet das Skript `FEHLT: R7`.

- [ ] **Step 6: `cookbook.json` neu bauen und prüfen.**

Run:
```bash
npm run cookbook:check
npm run cookbook:build
npm run cookbook:check
node -e "const c=require('./packages/cookbook/cookbook.json');const r=c.recipes.find((x)=>x.id==='tool-jm-connect');const b=r.blocks;console.log(c.updatedAt, c.recipes.length);console.log(b.ingredients.map((g)=>g.title+':'+g.items.length).join(', '));console.log(b.steps.vor.length, b.steps.waehrend.length, b.steps.nach.length, b.tips.length, b.troubleshooting.length, b.checklists.map((x)=>x.title+':'+x.items.length).join(', '));console.log(JSON.stringify(c).split(String.fromCharCode(92)+'r').length-1, b.troubleshooting.filter((t)=>!t.remedy).length)"
git diff --numstat -- packages/cookbook/cookbook.json
```
Expected (gemessen): erst `cookbook.json ist veraltet …` (Exit 1, das neue Rezept fehlt noch), dann `cookbook.json geschrieben: 43 Rezepte.`, dann `cookbook.json ist frisch (43 Rezepte).`. Die Strukturprüfung gibt genau aus:
```
2026-10-06T00:00:00.000Z 43
Voraussetzungen:7, Netzwerk & Steuerung:8, Browser-Gäste (kurz):4, Harte Grenzen:10, Logs und Datenschutz:4, Deinstallieren:2
7 10 3 6 51 Einrichtung (einmal je PC):4, Vor Live:6, Nach Live:2
0 0
```
(die letzte Zeile: kein `\r` in der ganzen Datei, keine Pannenhilfe-Zeile ohne zweite Spalte). `git diff --numstat` zeigt `380	1	packages/cookbook/cookbook.json`: nur das neue Rezept und `updatedAt`. Zusätzlich gemessen am Probelauf: Mit allen `.md` auf LF umgestellt (wie in der CI) bleibt `cookbook:check` bei „frisch (43 Rezepte)“.

- [ ] **Step 7: Roadmap, Bridge-README und Paketbeschreibung.**

Datei `docs/roadmap.md`. Ersetzung 1. Vorher (Zeile 29, eindeutig):
```markdown
  `zoom_*`-Verben zweigen in `App.tsx` **vor** dem DO-Mapping ab. Passcode/SDK-Secret gehen nie an den Worker.
```
Nachher:
```markdown
  `zoom_*`-Verben zweigt der Main-Prozess ab (`apps/connect/src/main/index.ts`, `onCommand`), bevor sie Renderer oder DO
  erreichen. Passcode/SDK-Secret gehen nie an den Worker.
```

Ersetzung 2. Vorher (Zeile 154, eindeutig):
```markdown
| **4 · Integration + Release** | `ZoomParticipant` in `App.tsx` · Operator-UI (Einwahldaten eintragen, Teilnehmerliste, einzeln als Quelle laden/entladen) · Handbuch mit harten Grenzen · Lizenz-Entscheid: DLLs nachladen (transcribe-Muster) vs. separate Installer-Variante · Release **`connect-v0.2.0`**. | 🔵 |
```
Nachher:
```markdown
| **4 · Integration + Release** | Zoom in **JM Connect** ([Spec](superpowers/specs/2026-10-02-zoom-stage4-connect-design.md)). **4a** ist als `connect-v0.2.0` released (Pre-Release): Einrichtung je PC (SDK-Ordner, Zugangsdaten), Beitritt im eigenen Zoom-Konto, Teilnehmer einzeln als NDI-Quelle, Status in Karte, Kopfzeile und Tray, Paketierung mit zwei Wächtern ([Plan](superpowers/plans/2026-10-02-zoom-stage4a-connect.md)). Danach `connect-v0.2.1` (Zugangsdaten von Hand) und `connect-v0.2.2` (Zoom-SDK auf Knopfdruck laden, nur JM-eigene Rechner, [Spec](superpowers/specs/2026-10-06-connect-zoom-sdk-laden-design.md)). Der Lizenz-Entscheid „DLLs nachladen vs. separate Installer-Variante“ ist durch E2 ersetzt: Zoom-DLLs werden nicht verteilt, jeder Raum-PC richtet das SDK einmal selbst ein. **4b = `connect-v0.3.0`** ([Plan](superpowers/plans/2026-10-06-zoom-stage4b-connect.md)): automatischer Wiederbeitritt nach einem Abriss; Entzug der Aufnahme-Erlaubnis stoppt die Zoom-Quellen sofort, nach der Wiedererteilung lädt Connect sie neu; Companion-Fernsteuerung (Modul 0.2.0: Rolle JM Connect, Anzahlen als wahr, Namen mit Leerzeichen); Logs ohne Teilnehmernamen und 14 Tage Löschfrist in allen Suite-Apps; Handbuch [`tool-jm-connect.md`](../packages/cookbook/content/tool-manuals/tool-jm-connect.md). Owner-Abnahme nach [`ABNAHME-0.3.0.md`](../apps/connect/ABNAHME-0.3.0.md) offen, ebenso die Messungen M2, M5, M8, M17, M18 und M19. | 🟡 |
```

Datei `packages/zoom-bridge/README.md` (Abschnitt 9). Ersetzung 1. Vorher (im Ausgangsstand Zeilen 863–869, eindeutig):
```markdown
- **Keine Anbindung an `apps/connect`.** Aufrufer sind `test/join.mjs`/
  `test/video-limit.mjs` und — seit dem Einsatzpaket (Abschnitt 10) — die
  Konsolen-Start-EXE `zoom-join.exe` mit Start-Skript. Kein UI.
- **Kein Wiederbeitritt der Bridge selbst.** Bricht die Verbindung ab, endet die
  Bridge; sie verbindet sich nicht von selbst neu. (Ein **einzelnes Video-Abo**
  überlebt dagegen einen Wiederbeitritt **desselben Teilnehmers** — siehe
  Abschnitt 7.)
```
Nachher:
```markdown
- **Keine eigene Oberfläche.** Die Bedienung liegt in **JM Connect** (ab 0.2.0,
  Spec `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md`):
  Connect startet die Bridge über die Klasse `Bridge` (`src/bridge.ts`) aus
  seinem Laufzeit-Ordner. Weitere Aufrufer sind `test/join.mjs`/
  `test/video-limit.mjs` und die Konsolen-Start-EXE `zoom-join.exe` des
  Einsatzpakets (Abschnitt 10).
- **Kein Wiederbeitritt der Bridge selbst.** Bricht die Verbindung ab, endet die
  Bridge; sie verbindet sich nicht von selbst neu. Den Wiederbeitritt übernimmt
  JM Connect ab 0.3.0 mit einem **neuen** Bridge-Prozess (Spec Stage 4,
  Abschnitt 6.4). (Ein **einzelnes Video-Abo** überlebt dagegen einen
  Wiederbeitritt **desselben Teilnehmers** — siehe Abschnitt 7.)
```

Ersetzung 2. Vorher (im Ausgangsstand Zeilen 877–882, eindeutig):
```markdown
  die Zoom-DLLs liegen nur im **privaten** Komplett-Paket bei. Die
  Weitergabe-Lizenz der Zoom-DLLs ist weiterhin **ungeklärt** (Stage 4).

Die vier Ton-Punkte oben sind **ausdrücklich nicht** vorgesehen (Spec Abschnitt 10),
keine spätere Stage — der Rest ist Stage 4 (`docs/roadmap.md`): Integration +
Release.
```
Nachher:
```markdown
  die Zoom-DLLs liegen nur im **privaten** Komplett-Paket bei. JM Connect
  verteilt die Zoom-DLLs **nicht** (Owner-Entscheid E2, Spec Stage 4): Der
  Installer bringt nur `zoom-bridge.exe` samt VC-Laufzeit mit. Die Zoom-DLLs
  richtet der Bediener einmal je PC ein (SDK-Ordner aus der JM-Ablage oder
  „Zoom-SDK laden“ auf JM-eigenen Rechnern), und Connect kopiert sie in
  seinen Laufzeit-Ordner `%LOCALAPPDATA%\JM Connect\zoom-laufzeit\`.

Die vier Ton-Punkte oben sind **ausdrücklich nicht** vorgesehen (Spec Abschnitt 10),
keine spätere Stage. Die Einbindung in JM Connect (Stage 4, `docs/roadmap.md`)
ist mit Connect 0.2.0 bis 0.3.0 umgesetzt.
```

Datei `packages/zoom-bridge/package.json`. Vorher (Zeile 6, eindeutig):
```json
  "description": "Zoom-Meeting-SDK-Bruecke (natives Windows-Sidecar) fuer JM Connect — Stage 1+2: Beitritt, Teilnehmer, Aufnahme-Erlaubnis, Video je Teilnehmer als NDI-Quelle",
```
Nachher:
```json
  "description": "Zoom-Meeting-SDK-Bruecke (natives Windows-Sidecar) fuer JM Connect: Beitritt, Teilnehmer, Aufnahme-Erlaubnis, Bild und Ton je Teilnehmer als NDI-Quelle, Bild-Versatz; in JM Connect eingebunden ab 0.2.0 (Stage 4)",
```

- [ ] **Step 8: Verweise prüfen.**

Run (aus der Worktree-Wurzel, Git Bash):
```bash
node - <<'EOF'
const fs = require('fs');
const path = require('path');
function fehlendeLinks(datei, von, bis) {
  const s = fs.readFileSync(datei, 'utf8');
  const a = s.indexOf(von);
  const teil = s.slice(a, bis ? s.indexOf(bis, a) : undefined);
  return [...teil.matchAll(/\]\(([^)#\s]+)\)/g)].map((m) => m[1]).filter((ziel) => !fs.existsSync(path.resolve(path.dirname(datei), ziel)));
}
console.log('Roadmap:', JSON.stringify(fehlendeLinks('docs/roadmap.md', '| **4 · Integration + Release**', '### Harte Grenzen')));
console.log('README 9:', JSON.stringify(fehlendeLinks('packages/zoom-bridge/README.md', '## 9 · Was diese Bridge', '## 10 · Einsatzpaket')));
EOF
node -e "JSON.parse(require('fs').readFileSync('packages/zoom-bridge/package.json','utf8')); console.log('package.json ok')"
```
Expected: `Roadmap: ["../apps/connect/ABNAHME-0.3.0.md"]` (die Abnahmeliste entsteht erst in Aufgabe 21; die Plan-Datei ist seit dem Commit vor Aufgabe 1 eingecheckt, siehe Kopf „Vor Aufgabe 1“), `README 9: []`, `package.json ok`.

- [ ] **Step 9: Bridge-Selbsttest unverändert grün.**

Run: `npm run selftest -w @jm/zoom-bridge`
Expected: Exit-Code 0, `Alle Selbsttests bestanden.` und `Alle Auslieferungs-Tests bestanden.` (nur die Beschreibung in `package.json` hat sich geändert).

- [ ] **Step 10: Commit.**

```bash
git add packages/cookbook/src/build.mjs packages/cookbook/content/tool-manuals/tool-jm-connect.md packages/cookbook/cookbook.json docs/roadmap.md packages/zoom-bridge/README.md packages/zoom-bridge/package.json
git status --short
```
Erwartet genau diese gestagten Zeilen (sonst nichts Gestagtes):
```
M  docs/roadmap.md
A  packages/cookbook/content/tool-manuals/tool-jm-connect.md
M  packages/cookbook/cookbook.json
M  packages/cookbook/src/build.mjs
M  packages/zoom-bridge/README.md
M  packages/zoom-bridge/package.json
```
Dann:
```bash
git commit -m "docs(connect): Handbuch JM Connect (Zoom, Fernsteuerung, Logs); Roadmap und Bridge-README nachgezogen" -m "tool-jm-connect.md nach Spec 14: Zutaten mit Steuerport 8737, Zoom-Befehlen und STATE, Browser-Gaeste kurz, harte Grenzen, Logs (keine Namen, 14 Tage), Einrichtung, Waehrend (Wiederbeitritt mit Countdown und Abbrechen, Entzug, gemerkte Quellen mit Grenze), Pannenhilfe mit 51 Meldungen, Checklisten, Deinstallieren. cookbook.json neu (43 Rezepte). build.mjs liest CRLF wie LF: unter Windows war cookbook:check sonst schon am unveraenderten Stand rot. Roadmap Zeilen 29 und 154, Bridge-README Abschnitt 9 und Paketbeschreibung nachgezogen (Spec 14, Mitzuziehen)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen von der Gliederung:**
1. **`packages/cookbook/src/build.mjs` geändert** (zwei Zeilen, CRLF wie LF lesen; übernommen, Montage MO6). Ohne die Änderung ist `npm run cookbook:check` unter Windows schon am unveränderten Worktree rot, und ein lokaler `cookbook:build` schriebe `\r` in 13 fremde Rezepte, die die CI dann ablehnt. Gemessen vorher rot, nachher grün (42 und 43 Rezepte); die CI (LF) ist davon unberührt.
2. **Zuordnung der Spec-Punkte zum Rezeptformat** (Vorab): Spec 14 Punkt 7 steht als eigene Gruppe „Harte Grenzen“ unter „Zutaten“, Punkt 10 als Gruppe „Deinstallieren“; Punkt 8 als zweispaltige Tabelle, weil der Parser nur zwei Spalten übernimmt.
3. **Pannenhilfe zusätzlich** mit S11, S12, S14, S15, S16/S16b/S16c (Zoom-SDK laden, 0.2.2), Z10/Z11, Q1-Entzug, R7, Stand `grenze`, „Nur für diese Sitzung gemerkt“, Companion-Taste und „Details im Log“; Texte in der Fassung des Codes (S10, B9, B17, A5 neu seit 0.2.1/0.2.2).
4. **Roadmap-Zeile 154** beschreibt den ganzen Stand (0.2.0 bis 0.3.0) und steht auf 🟡; sie verweist schon auf `ABNAHME-0.3.0.md` aus Aufgabe 21 (Step 8 erwartet diesen einen fehlenden Verweis).
5. **Companion-README** (Spec 14, „Mitzuziehen“) ist nicht Teil dieser Aufgabe: Aufgabe 16 zieht sie nach (Dateistruktur).

---

### Task 21: Abschluss: Abnahmeliste 0.3.0, Gesamtlauf

**Spec:** 13 (Abnahme; die Schritte 8, 11, 12, 13, 14, 15, 16, 17, 20, 21 und 23 wörtlich; alle Schritte, die `ABNAHME-0.2.0.md` außerhalb des 4a-Kurztests auf 0.3.0 verschiebt), N4b.1 (Abnahme Entzug), N4b.2 (Abnahme Logs, nachgeholter Schritt 25 aus 0.2.0, Messung `%APPDATA%`), N4b.3 (Randfälle), 16 (M2, M5, M8, M17), 17.2 Nr. 2 und 3 (Abnahmekriterien), Plan L23 (M18, M19), Abschnitt „Testläufe“ dieses Plans.

**Files:**
- Create: `apps/connect/ABNAHME-0.3.0.md`
- Kein Code, keine Versionsnummer (G11, G19).

**Interfaces:**
- Consumes: alle Selbsttests, beide Typechecks, der Bau, der Companion-Sync, der Kochbuch-Check (Abschnitt „Testläufe“) im Stand nach den Aufgaben 1–20.
- Produces: `apps/connect/ABNAHME-0.3.0.md` mit den Gruppen A (Wiederbeitritt), B (Entzug), C (Companion), D (Logs), E (Randfälle), F (Regression Stage 1–3), G (Last und Dauer) und den Messungen M2, M5, M8, M17, M18, M19.

**Vorab (für den Umsetzer):**
- Format wie `ABNAHME-0.2.0.md` und `ABNAHME-0.2.2.md`: Kopf, Regeln, Tabelle „Getesteter Bau“, Voraussetzungen, Tabellen `| # | Schritt | Erwartung | Ergebnis |`, Messungen.
- Meeting-Nummer, Kenncode und echte Teilnehmernamen erscheinen nur als `<Meeting-Nummer>`, `<Kenncode>` und `<Name>` (G12). Der Beispielname „Anna Maria Beispiel“ ist erfunden.
- Die Texte der Erwartungen stammen aus Spec 7, 8 und der Texttabelle dieses Plans (Z7 bei `entzogen`, `grenze`, R5, F2, F6, Bild/Ton-Klartext, `[runtime]`, Bridge-Zeilen „Entzug: …“).
- Der Gesamtlauf (Step 3) ist die Abschlussprüfung des ganzen Plans. Scheitert ein Befehl, wird die Aufgabe nachgebessert, die die Datei zuletzt geändert hat, nicht diese.

- [ ] **Step 1: `apps/connect/ABNAHME-0.3.0.md` anlegen (ganzer Inhalt).**

````markdown
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
| A1 | Netzwerkkabel des Raum-PCs 60 s ziehen, dann wieder stecken | Z10, dann Z11 mit Versuchen; danach wieder im Meeting, eindeutige Quellen kommen mit gleichem NDI-Namen zurück, der Switcher verbindet sich selbst; solange gemerkte Quellen fehlen, steht `zoom_alarm` auf 1; notieren: Zeit bis Bild, musste der Host zulassen oder Erlaubnis neu erteilen (M2) | |
| A2 | Wie A1, dabei die Karte, das Tray und danach das Log ansehen | Karte in Z11 „Verbindung zum Meeting verloren. Wiederbeitritt i von 5 in s s.“ mit herunterzählenden Sekunden, während eines Versuchs „… Wiederbeitritt i von 5 läuft …“; Tray „△ Zoom: Verbindung verloren, Wiederbeitritt i von 5“; nach dem Erfolg unter „Hinweise“ „Wieder im Meeting. k Quellen neu geladen, d warten auf eine eindeutige Person.“ (Einzahl bei 1). Im Log je Versuch „[zoom] Wiederbeitritt: Versuch i …“ mit der Dauer in ms | |
| A3 | Netz nur kurz trennen (Kabel 5 s ziehen) | Z10 „Verbindung unterbrochen. Zoom versucht selbst, neu zu verbinden …“, danach wieder im Meeting **ohne** Z11; die Quellen laufen ohne Handgriff weiter, keine zweite `zoom-bridge.exe` im Task-Manager | |
| A4 | Host schiebt JM Connect in den Warteraum und lässt es wieder zu | „Im Warteraum …“, dann „Trete dem Meeting bei …“, dann wieder im Meeting; **kein** „Verbindung unterbrochen“, kein Wiederbeitritt; notieren, ob die Quellen dabei bestehen bleiben (M17) | |
| A5 | Kabel ziehen, bis Z11 erscheint; dann „Abbrechen“; Kabel stecken; „Erneut beitreten“ | Nach „Abbrechen“ Meldung „Wiederbeitritt abgebrochen.“ mit „Erneut beitreten“ und „Schließen“, keine weitere `zoom-bridge.exe`; „Erneut beitreten“ führt ohne neue Eingabe ins Meeting, die gemerkten Quellen kommen zurück | |
| A6 | Kabel ziehen, bis Z11 erscheint; dann Tray „Zoom-Meeting verlassen“ | Karte „Bereit. Meeting-Nummer und Kenncode eingeben.“, keine Meldung, keine gemerkten Quellen, `zoom_alarm` 0, keine `zoom-bridge.exe` im Task-Manager | |

## B · Entzug der Aufnahme-Erlaubnis (N4b.1)

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| B1 | Zwei Personen laden, eine davon vorher mit „Ton“ aus; beide im NDI-Monitor ansehen und anhören. Dann entzieht der Host im Zoom-Client die Aufnahme-Erlaubnis | Im NDI-Monitor stoppen Bild und Ton beider Quellen **sofort**, die Quellen verschwinden aus der NDI-Liste. Karte „Aufnahme-Erlaubnis vom Host entzogen, Quellen gestoppt. Erteilt der Host sie im Zoom-Client wieder, lädt Connect die gemerkten Quellen von selbst.“; Tray „△ Zoom: Aufnahme-Erlaubnis vom Host entzogen, Quellen gestoppt“; beide Personen unter „Gemerkte Quellen“; `zoom_sources` 0, `zoom_privilege` 0, `zoom_alarm` 1. Im Log „[zoom-bridge] Entzug: Ton-Abo abmelden (ausserhalb des Rueckrufs)“, „… Entzug: Bild-Abos abbauen“, „… Entzug: Rohdaten-Aufnahme beenden“ und je Quelle „[zoom] Quelle … gestoppt (Entzug)“; notieren, ob danach Fehlerzeilen der Bridge folgen (M18) | |
| B2 | Der Host erteilt die Erlaubnis wieder | Beide Quellen kommen von selbst zurück, mit gleichem NDI-Namen und unveränderter Ton-Einstellung (die eine weiter ohne Ton); „Gemerkte Quellen“ leer, `zoom_alarm` 0; notieren, ob die Bridge beim neuen Abo Fehler meldet (M18) | |
| B3 | Entziehen lassen; in Connect eine der beiden gemerkten Quellen „Vergessen“; dann erteilen lassen | Nur die andere Quelle kommt zurück | |
| B4 | Entziehen lassen; in Connect „Meeting verlassen“; danach erteilt der Host die Erlaubnis | Karte „Bereit. …“, keine gemerkten Quellen, `zoom_alarm` 0; es entsteht keine Quelle | |

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
| D3 | Connect beenden. Im Logordner eine Datei `main.log.4` anlegen und auf 15 Tage altern, dazu `renderer.log.3` mit einer Zeile von vor 20 Tagen und einer von gestern (PowerShell unter der Tabelle). Connect starten | `main.log.4` ist weg; `renderer.log.3` enthält nur noch „junge Zeile“; in `main.log` steht eine Zeile „[runtime] Logs aufgeräumt: g gelöscht, k gekürzt (Frist 14 Tage)“ mit g ≥ 1 und k ≥ 1. Auf einem Raum-PC mit älteren Logs (aus 0.1.0 bis 0.2.x) sind beide Zahlen höher; dann sind auch diese Dateien weg bzw. beginnen mit einer Zeile der letzten 14 Tage | |
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
| E2 | Eine Person mit „Ton“ aus laden; Kabel ziehen, bis Z11 erscheint, „Abbrechen“; Kabel stecken, „Erneut beitreten“ | Schon bevor die Quelle wieder läuft, steht der Ton-Schalter dieser Zeile auf aus; die Quelle kommt ohne Ton zurück | |
| E3 | Sechs Personen laden (die sechste mit dem zweiten Klick nach der Warnung); Kabel 60 s ziehen, dann stecken | Nach dem Wiederbeitritt laufen genau 5 Quellen; die sechste steht unter „Gemerkte Quellen“ als „<Name> — nicht automatisch geladen (mehr als 5 Zoom-Quellen), bitte von Hand laden“, `zoom_alarm` 1; von Hand laden: Warnung „Mehr als 5 Zoom-Quellen sind nicht gemessen. …“, der zweite Klick lädt | |
| E4 | Connect beenden; `attrib +R "$env:APPDATA\JM Connect\connect-settings.json"`; Connect starten, beitreten, den Versatz ändern; Connect neu starten; danach `attrib -R "$env:APPDATA\JM Connect\connect-settings.json"` | Nach der Änderung unter dem Feld gelb „Nur für diese Sitzung gemerkt — die Einstellungsdatei ließ sich nicht schreiben.“, das Feld wird nicht rot, im Meeting „bestätigt: … ms“ mit dem neuen Wert; nach dem Neustart zeigt das Feld wieder den alten Wert | |
| E5 | Beitreten mit falschem Kenncode; „Schließen“ | Meldung „Beitritt gescheitert: falscher Kenncode.“; nach „Schließen“ sind Meeting-Nummer und Kenncode in der Karte leer | |
| E6 | Einen Hinweis erzeugen (Companion `zoom_load` mit einem Namen, den es im Meeting nicht gibt); „Meeting verlassen“; mit neu eingegebenen Daten beitreten | Vorher unter „Hinweise“ „Companion: niemand namens „…“ im Meeting.“; nach dem neuen Beitritt ist „Hinweise“ leer | |
| E7 | Bei einer geladenen Person Kamera aus und wieder an, Mikrofon stumm und wieder an | Die Zeile zeigt Bild und Ton im Klartext, zum Beispiel „Bild schwarz: Kamera aus“, „Bild läuft“, „Ton: Stille“, „Ton läuft“; keine Rohwerte wie „black (cameraOff)“ | |
| E8 | Mit fünf geladenen Quellen „Meeting verlassen“ und sofort danach in der Einrichtung auf „SDK-Ordner wählen …“ | Der Knopf ist gesperrt (Tooltip „Während Zoom läuft oder das Zoom-SDK geladen oder kopiert wird, lässt sich die Einrichtung nicht ändern.“), bis der Abbau fertig ist; danach wieder frei | |

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
````

- [ ] **Step 2: Abnahmeliste prüfen.**

Run (aus der Worktree-Wurzel):
```bash
grep -c "^| [A-G][0-9] |" apps/connect/ABNAHME-0.3.0.md
grep -c "^| M[0-9]* |" apps/connect/ABNAHME-0.3.0.md
node -e "const fs=require('fs');const s=fs.readFileSync('docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md','utf8').replace(/\r\n/g,'\n').split('\n');const a=s.indexOf('| # | Schritt | Erwartung |');const ab=fs.readFileSync('apps/connect/ABNAHME-0.3.0.md','utf8').replace(/\r\n/g,'\n');const nr=[8,11,12,13,14,15,16,17,20,21,23];const zeilen=s.slice(a+2,a+27).filter((z)=>nr.includes(Number(z.split('|')[1])));const fehlt=zeilen.filter((z)=>!ab.includes(' | '+z.split(' | ').slice(1).join(' | ').replace(/ \|$/,'')+' | '));console.log(fehlt.length?'ABWEICHEND: '+fehlt.map((z)=>z.slice(0,40)).join(' / '):zeilen.length+' Spec-Schritte wörtlich');process.exit(fehlt.length?1:0)"
```
Expected (gemessen): `35` (A1–A6, B1–B4, C1–C7, D1–D4, E1–E8, F1–F4, G1–G2), `6` (M2, M5, M8, M17, M18, M19), `11 Spec-Schritte wörtlich`. Gegenprobe (gemessen): Steht in A1 „30 s“ statt „60 s“, meldet die dritte Prüfung `ABWEICHEND: | 16 | Netzwerkkabel des Raum-PCs 60 s z` und endet mit Exit-Code 1.

- [ ] **Step 3: Gesamtlauf.**

Run (aus der Worktree-Wurzel, Git Bash), in dieser Reihenfolge:
```bash
npm run selftest -w @jm/zoom-bridge
npm run selftest -w @jm/connect
npm run selftest -w @jm/suite-control-protocol
node packages/companion-jm-suite/test/selftest.mjs
npm run selftest -w @jm/app-runtime
npm run typecheck -w @jm/connect
npm run typecheck -w @jm/zoom-bridge
npm run build -w @jm/connect
node scripts/sync-companion-protocol.mjs && git diff --exit-code -- packages/companion-jm-suite/generated/protocol.mjs
npm run cookbook:check
```
Expected: jeder Befehl mit Exit-Code 0 und ohne Zeile, die mit `FAIL` beginnt oder `error TS` enthält. Die Schlusszeilen im Einzelnen (Ausgang = gemessen vor Aufgabe 1; Endstand = nach der Nachbesserung am ganz nachgespielten Plan gemessen, Windows 11, Node 24.16):

| Prüfung | Erwartete Schlusszeile (Endstand) | Ausgang |
| --- | --- | --- |
| Bridge `test/selftest.ts` | `Alle Selbsttests bestanden.`, 509 Zeilen `  ok` (Aufgabe 2) | 471 |
| Bridge `test/auslieferung.test.mjs` | `Alle Auslieferungs-Tests bestanden.`, 41 Zeilen `  ok` (Aufgabe 3) | 31 |
| Connect `zoom-text.test.ts` | `772 ok, 0 fehlgeschlagen.` (Aufgabe 8) | 529 |
| Connect `zoom-laufzeit.test.ts` | `86 ok, 0 fehlgeschlagen.` (in 4b unverändert) | 86 |
| Connect `zoom-teile.test.ts` | `139 ok, 0 fehlgeschlagen.` (Aufgabe 7) | 90 |
| Connect `zoom-kern.test.ts` | `578 ok, 0 fehlgeschlagen, 0 übersprungen.` (Aufgabe 13) | 409 |
| Connect `zoom-settings.test.ts` | `35 ok, 0 fehlgeschlagen.` (Aufgabe 11) | 33 |
| Connect `sdk-laden.test.ts` | `83 ok, 0 fehlgeschlagen, 0 übersprungen.` (Aufgabe 19) | 79 |
| Connect `control-state.test.ts` | `31 ok, 0 fehlgeschlagen.` (Aufgabe 15, neue Datei) | – |
| Connect `after-pack.test.mjs` | `Alle after-pack-Tests bestanden.` | bestanden |
| Steuerprotokoll | `ALLE TESTS OK`, 77 Zeilen `ok` (Aufgabe 14) | 41 |
| Companion-Modul | `ALLE TESTS OK`, 70 Zeilen `ok` (Aufgabe 16) | 36 |
| app-runtime | `43 passed, 0 failed` (Aufgabe 17) | 15 passed |
| Typecheck Connect, Bridge | keine Zeile mit `error TS` | – |
| Bau | `electron-vite build` dreimal `✓ built in …` | – |
| Companion-Sync | `✓ generiert: packages/companion-jm-suite/generated/protocol.mjs`, danach `git diff --exit-code` ohne Ausgabe | – |
| Kochbuch | `cookbook.json ist frisch (43 Rezepte).` (Aufgabe 20) | rot unter Windows, siehe Aufgabe 20 |

Zusätzlich die Verweise aus Aufgabe 20 Step 8 noch einmal prüfen (dasselbe Skript); jetzt erwartet: `Roadmap: []` und `README 9: []`.

- [ ] **Step 4: Commit.**

```bash
git add apps/connect/ABNAHME-0.3.0.md
git status --short
```
Erwartet genau diese gestagte Zeile (sonst nichts Gestagtes; `out/`, `release/`, `*.tsbuildinfo` und `pkg.tgz` sind gitignoriert):
```
A  apps/connect/ABNAHME-0.3.0.md
```
Dann:
```bash
git commit -m "docs(connect): Abnahmeliste 0.3.0" -m "ABNAHME-0.3.0.md: A Wiederbeitritt (Spec 13 Nr. 16 und 17 woertlich, Countdown, Abbrechen, kurze Unterbrechung, Verlassen in Z11), B Entzug und Wiedererteilung (N4b.1), C Companion 0.2.0 (Nr. 12, 13, 15 woertlich, Anzahlen 1/2/5, Name mit Leerzeichen, zoom_delay, Doppeldruck), D Logs (Schritt 25 aus 0.2.0 nachgeholt, APPDATA-Vergleich, Loeschfrist), E Randfaelle (N4b.3), F Regression Stage 1-3 (Nr. 8, 11, 20, 21 woertlich), G Last und Dauer (Nr. 14 und 23 woertlich); Messungen M2, M5, M8, M17, M18, M19. Gesamtlauf aller Selbsttests, Typechecks, Bau, Companion-Sync und Kochbuch gruen." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Nicht pushen.

**Abweichungen von der Gliederung:**
1. **Nummerierung je Gruppe** (A1 … F4) statt einer fortlaufenden Spalte; die wörtlichen Spec-Schritte prüft Step 2 über Schritt- und Erwartungsspalte.
2. **Zusätzliche Schritte** A2 (Countdown, R5, Logzeilen mit Dauer), A3 (Zoom verbindet selbst, `abriss → im_meeting`, N4b.3 Nr. 8), B3/B4 (Vergessen bzw. Verlassen während des Entzugs, Review Focus 4 und Kern-Fall „Entzug und dann Verlassen“), C7 (Taste prellt, Review Focus 1), F3 (Spec 13 Nr. 20: das Meeting-Ende hat sich mit L12 geändert).
6. **Nachbesserung: Gruppe G und volle Abdeckung.** Die erste Fassung ließ Spec 13 Schritt 14 (gemischte Last, M5, M8, Q10 am echten Gerät) und Schritt 23 (65 min im Meeting) weg, obwohl `ABNAHME-0.2.0.md` beide auf 0.3.0 verschiebt und Spec 18 für 4b die volle Abnahme verlangt. Sie stehen jetzt wörtlich als G1 und G2, M5 und M8 in der Tabelle „Messungen“; der Kopf der Abnahmeliste ordnet jeden verschobenen Schritt seiner Zeile zu. D1 läuft zum Schluss, damit die Log-Suche auch G1 (Browser-Gäste, Rückkanal) erfasst. D3 erwartet keine festen Zahlen mehr: Auf einem Raum-PC mit Logs aus früheren Fassungen löscht und kürzt das erste Aufräumen auch diese.
3. **D3 prüft die Löschfrist an Connect selbst** mit gealterten Dateien (PowerShell unter der Tabelle); D4 hält fest, dass andere Apps erst mit ihrem Release folgen.
4. **Endzählstände im Gesamtlauf** sind am ganz nachgespielten Plan gemessen (alle 21 Aufgaben der Reihe nach auf eine frische Kopie; zuletzt nach der Nachbesserung).
5. **Companion-Sync in der Kopie:** Ohne `.git` ließ sich `git diff --exit-code` dort nicht ausführen. Gemessen: Der Sync läuft (`✓ generiert: …`), zwei Läufe hintereinander sind byte-gleich, und ohne die Capabilities aus Aufgabe 14 weicht das Ergebnis vom eingecheckten Stand ab (dort fehlt die Rolle `connect`, wie erwartet). Unter Windows schreibt der Sync LF; `git diff` vergleicht nach `core.autocrlf` und zeigt dadurch keinen Unterschied.

---

## Abweichungen und Entscheidungen der Montage

Beim Nachspielen des ganzen Plans auf eine frische Kopie traten zwei Vorher-Ausschnitte auf, die nicht passten, und ein Widerspruch zwischen zwei Blöcken. Alle drei sind hier aufgelöst und gemessen; dazu kommen die Abweichungen der Schreiber, die die Montage übernimmt oder nicht übernimmt. Die Punkte heißen MO1–MO9, damit sie sich nicht mit den Messungen M1–M19 (Spec 16, L23) verwechseln lassen.

- **MO1 · Fall 10b in drei Schritten (Aufgaben 1, 4, 8).** Drei Blöcke wollten denselben 4a-Fall anpassen: Block A schlug einen Zwischen-Step in Aufgabe 1 vor (sonst `408 ok, 1 fehlgeschlagen` von Aufgabe 1 bis 10), Block B änderte in Aufgabe 4 den erwarteten Z7-Text, Block C schrieb den Fall in Aufgabe 8 Step 1 ganz neu, mit einem Vorher-Text vom Stand vor A und B (passte bei der Montage nicht). Entscheidung: Aufgabe 1 bekommt Step 13 (eine Prüfung: „die Bridge baut die Quelle ab“), Aufgabe 4 Step 6 bleibt (Z7-Text, Zeile jetzt 1218), Aufgabe 8 Step 1 schreibt den Fall auf dem Stand nach beiden neu. Gemessen: ohne Step 13 `408 ok, 1 fehlgeschlagen` mit `FAIL  … Z7b mit „vom Host entzogen“`, mit Step 13 `409 ok`; in Aufgabe 4 vor Step 6 `408 ok, 1 fehlgeschlagen` (Z7-Text), danach `409 ok`; Aufgabe 8 nach Step 1 `409 ok`. So bleibt `npm run selftest -w @jm/connect` nach jeder Aufgabe grün. **Nachbesserung:** Seit Z7 „Quellen gestoppt“ nur mit gemerkten Quellen sagt (Aufgabe 4, Spec 7), bleibt Fall 10b nach dem Entladen mit dem alten Text grün; Aufgabe 4 Step 6 ist entfallen (die Steps 7–10 heißen jetzt 6–9). Gemessen: nach Aufgabe 4 `409 ok`, Aufgabe 8 nach Step 1 `410 ok` (eine Prüfung mehr: Z7 nach dem Vergessen).
- **MO2 · Schlüsselprüfung von `KT` ohne Zahl (Aufgabe 8, Step 6).** Block C nahm eine Zählprüfung `Object.keys(KT).length === 77` an; Aufgabe 5 hat sie durch einen Vergleich der Schlüsselmengen ersetzt. Die zweite Ersetzung in Aufgabe 8 Step 6 entfällt. Gemessen: rot `766 ok, 1 fehlgeschlagen.` mit `FAIL  KT und die Tabelle haben dieselben Schlüssel (jeder Text genau einmal wörtlich geprüft)`, grün `767 ok`. Aufgabe 8 Step 15 und Aufgabe 13 Step 8 nennen jetzt die gemessenen Zahlen (nach der Nachbesserung 772 statt 531 aus dem Ersatzstand; rot `771 ok, 1 fehlgeschlagen`).
- **MO3 · `FAKE_NAMENSZEILE` 100 ms nach dem `roster` (Aufgabe 1, Step 8).** Block A schrieb die Zeile direkt nach dem `roster`, Block C hat mit 100 ms Abstand gemessen und ihn als tragend gemeldet: stdout und stderr sind zwei Leitungen, ohne Abstand kann die Namensprobe beim Kern vor dem `roster` ankommen, und der Namens-Test aus Aufgabe 12 wird zufällig rot. Die Attrappe schreibt die Zeile jetzt mit `setTimeout(…, 100)`. Gemessen: Bridge-Selbsttest unverändert 498 + 31 `ok` nach Aufgabe 1; `zoom-kern.test.ts` am Endstand dreimal je 578 ok (nach der Nachbesserung).
- **MO4 · `scripts/sync-companion-protocol.mjs` (Aufgabe 16, Step 9) übernommen.** Außerhalb der Dateiliste der Gliederung, aber nötig: Ohne `absWorkingDir` erzeugen `npm run sync` im Modulordner und der Aufruf aus der Wurzel verschiedene Dateien, und der CI-Schritt „Companion-Protokoll aktuell“ wäre nach jedem `npm run sync` rot. Gemessen: vorher `// ../suite-control-protocol/src/index.ts` gegen `// packages/suite-control-protocol/src/index.ts`; nachher dreimal dieselbe SHA-256 (zweimal aus der Wurzel, einmal aus dem Modulordner).
- **MO5 · `control-server.ts` im Test (Aufgabe 15) übernommen.** L20 hielt die Datei für nicht testbar; Block D lädt sie mit Attrappen für `electron` und `@jm/suite-control-protocol/server` (wie `zoom-settings.test.ts`). Die Gegenprobe 12.5 „Raum-Push ersetzt alles“ trifft so die Stelle des Altfehlers. L20 ist entsprechend ergänzt.
- **MO6 · `packages/cookbook/src/build.mjs` liest CRLF wie LF (Aufgabe 20, Step 2) übernommen.** Ohne die Änderung ist `npm run cookbook:check` unter Windows schon am unveränderten Worktree rot (gemessen: „cookbook.json ist veraltet …“), und der Gesamtlauf in Aufgabe 21 könnte nie grün werden. LF-Quellen (CI) bauen unverändert.
- **MO7 · Statuszeile in `apps/connect/tools/bundle-zoom-bridge.mjs:66` nicht übernommen.** Block A schlug vor, sie in Aufgabe 18 oder 20 auf `sdkNamenQuellen` umzustellen. `tools/*` bleibt laut Gliederung in 4b unverändert, und die Zeile ist ungenau, nicht falsch (der Wächter selbst nutzt die Vereinigung). Offener Punkt O3.
- **MO8 · Übrige Abweichungen der Schreiber übernommen,** wie sie am Ende jeder Aufgabe stehen (u. a. `sdkNamenQuellen` als neuer Export in Aufgabe 3, `NAME_PLATZHALTER` in Aufgabe 5, die Testhilfen `ereignis` und `sitzung` im Kern-Test, „offene Abos gelten im Abgleich als verbunden“ in Aufgabe 13 (seit der Nachbesserung nur im Abgleich, nicht im Abbild), `aenderungsMelder` in Aufgabe 15, die README des Steuerprotokolls in Aufgabe 14). Jede ist durch den Gesamtlauf gedeckt.
- **MO9 · Kopfabschnitte nachgezogen:** Dateistruktur, Schnittstellen, Texttabelle (native Logzeilen aus Aufgabe 2, Logzeilen der Fernsteuerung aus den Aufgaben 13 und 15) und L20 nennen jetzt Aufgaben statt Blöcke und den gemessenen Stand. Verweise auf Blöcke, Ersatzstücke und Zählstände von Ersatzständen in den Aufgaben sind ersetzt.

## Nachbesserung nach dem Review (2026-10-06)

Zwei Prüfungen (Spec-Treue; Code und TDD) haben 21 Befunde gemeldet. Jeder ist am Code bzw. an der Spec nachgeprüft. Danach ist der ganze Plan noch einmal auf eine frische Kopie nachgespielt (262 Ersetzungen, 7 neue Dateien), jede geänderte Aufgabe mit Rot, Grün und Gegenproben gemessen.

| # | Befund | Entscheidung | Wo |
| --- | --- | --- | --- |
| R1, R11 | Abnahmeliste ohne Spec 13 Schritt 14 (gemischte Last, M5, M8, Q10) und Schritt 23 (65 min) | übernommen: Gruppe G (G1, G2 wörtlich), M5/M8 in „Messungen“, Prüfliste mit 11 Spec-Schritten, Zuordnung aller verschobenen Schritte im Kopf | Aufgabe 21 |
| R2 | Programm-Empfänger und Gast-Sender schreiben NDI-Namen mit Teilnehmer- und Gastnamen ins `main.log` | übernommen: nur fremde Quellen bzw. keine Namen; Quelltext-Wächter | Aufgabe 12 Step 6 |
| R3 | Z7 „Quellen gestoppt“ auch ohne gemerkte Quelle | übernommen: an `sollOffen > 0` geknüpft; Aufgabe 4 Step 6 (Fall 10b) entfällt | Aufgaben 4, 8 |
| R4 | L4/L5 als „Spec schweigt“ ausgegeben, obwohl 6.4 sie regelt | DLL-Tod im Versuch folgt jetzt der Spec (Vorsatz); L4 bleibt, ausdrücklich als Abweichung für den Owner (O4); Kern-Fälle für beide | Aufgabe 8, L4, L5 |
| R5 | Offenes Abo zählt auch für Abbild, `sollOffen`, `zoom_alarm` als verbunden | übernommen: nur im Abgleich verbunden, im Abbild `wartet`; O6 entfällt | Aufgabe 13 Step 5 |
| R6 | `sdkZeile` mit Literal „7.1.5.43953“ | übernommen: Fassung aus dem Abbild, Wächter | Aufgabe 4 |
| R7 | L10 (Kürzen laufender Dateien) geht über N4b.2 hinaus | übernommen als eigene Owner-Frage O11 (Rückfallweg beschrieben) | L10, O11 |
| R8 | Montage-Kennungen M1–M9 kollidieren mit Messungen | übernommen: MO1–MO9 | Montage, L20, Aufgaben 1, 8, 15, 16, 20 |
| R9 | Plan-Datei unversioniert: Roadmap-Link im Commit tot, `git status` zeigt `??` | übernommen: Controller committet den Plan vor Aufgabe 1 (Kopf „Vor Aufgabe 1“) | Kopf, Aufgabe 20 Step 8 |
| R10 | vorbestehender Wackler im Bridge-Selbsttest | übernommen als Hinweis (Testläufe) und O13; Behebung außerhalb von 4b | Testläufe, O13 |
| R12 | R5 zählt `grenze` als „wartet auf eine eindeutige Person“ | übernommen: `d` ohne `grenze`; Kern-Fall R5(5, 0); ob R5 die Grenze nennt, fragt O4 | Aufgabe 10, L3 |
| R13 | unlesbare stdout-Zeile mit Namen im Log | übernommen: Ereigniszeile nur mit Länge und Art, SDK-Zeilen weiter wörtlich | Aufgabe 2 Step 1, 14 |
| R14 | `laden()` prüft nach dem `await` Soll-Liste und Abos nicht | übernommen: beide Prüfungen, zwei Kern-Fälle; Restgrenze von `fernLaden` als O12 | Aufgabe 10 Step 6 |
| R15 | Abgleich prüft Plätze nur einmal vor der Schleife | übernommen: vor jedem Abo neu, Kern-Fall | Aufgabe 10 Step 7 |
| R16 | Log-Aufräumen liest jede Datei ganz | übernommen: erst 64 KB Kopf, Obergrenze 10 MB (`ZU_GROSS`), zwei Fälle | Aufgabe 17 |
| R17 | D3 erwartet feste Zahlen | übernommen: „mindestens 1 gelöscht, 1 gekürzt“ | Aufgabe 21 (D3) |
| R18 | Handbuch stellt Ungemessenes als Tatsache dar | übernommen: „JM Connect schreibt … nie“; M18/M19 fließen vor dem Release ins Handbuch | Aufgabe 20, „Nach der Umsetzung“ |
| R19 | Weiche `zoom_*` und Versatz-Antwort nur per grep belegt | Weiche als reine Funktion `leiteSteuerbefehl` mit Test und Gegenprobe; Versatz über `versatzUebernommen` (Aufgabe 4, getestet). „Schließen leert die Nummer“ bleibt ohne Unit-Test (ein Setter im Renderer, G10; Abnahme E5, F3) | Aufgaben 4, 15, 18 |
| R20 | bedingter Nebensatz in Aufgabe 8 Step 9 | übernommen: gestrichen | Aufgabe 8 Step 9 |
| R21 | STATE-Kodierung wirkt in allen Apps | übernommen: „Folgen außerhalb von Connect“ | Nach der Umsetzung |

## Offene Punkte (für Controller und Owner)

- **O1 · Nativer Bau ungeprüft.** Aufgabe 2 Step 22 braucht `ZOOM_SDK_DIR` und Visual Studio. Annahme ohne SDK im Repo: `IMeetingRecordingController::StopRawRecording()` existiert in SDK 7.1.5.43953. Bricht der Bau mit `C2039` ab, meldet die Aufgabe `DONE_WITH_CONCERNS` (L17).
- **O2 · M18 und M19** messen erst die Abnahme 0.3.0 (Tabelle „Messungen“ in `ABNAHME-0.3.0.md`, dazu D2): ob der Abbau außerhalb des Rundrufs am echten SDK ohne Absturz läuft, ob `StopRawRecording()`/`StartRawRecording()` nach Entzug und Wiedererteilung 0 melden, ob `audioClearSubscribed()` und ein späteres `JoinVoip()` im selben Meeting gehen, und ob das SDK trotz abgeschalteter Logs Dateien unter `%APPDATA%` anlegt. Das Handbuch (Aufgabe 20) sagt „JM Connect schreibt … nie auf die Platte“ und „stoppt Connect sofort Bild und Ton“; beides hängt am Ergebnis von M19 bzw. M18 und wird vor dem Release danach nachgezogen („Nach der Umsetzung“).
- **O3 · `bundle-zoom-bridge.mjs:66`** meldet bei gesetztem `ZOOM_SDK_DIR` weiter „geprueft gegen das SDK unter …“, obwohl seit Aufgabe 3 die Vereinigung gilt (MO7).
- **O4 · Texte und Entscheidungen zur Freigabe:** alle Zeilen „Neu“ der Texttabelle und L1–L23. Ausdrücklich zu entscheiden:
  - **L4 ist eine Abweichung von der Spec.** `ended` während eines Wiederbeitritts-Versuchs behandelt der Plan als Meeting-Ende (R6, `bereit`, Soll-Liste leer). Spec-wörtlich (6.4 Einordnung „jedes `ended`“ endgültig, Schritt 2.4 Vorsatz, 6.5 nur Z10) wäre es `fehler` mit „Wiederbeitritt abgebrochen: Meeting beendet: …“ und erhaltener Soll-Liste. Bei „Spec wörtlich“ ändern sich Aufgabe 8 (Step 12 `meetingEnde`/`statusEreignis`) und der Kern-Fall „L4: ended während eines Versuchs …“.
  - **R5 und `grenze`** (L3): R5 zählt Einträge über der Betriebsgröße nicht als „wartet“ und nennt sie nicht; sie stehen mit eigenem Text unter „Gemerkte Quellen“. Soll R5 sie eigens nennen (etwa „…, 1 über der Betriebsgröße nicht geladen“)?
  - Erledigt durch die Nachbesserung: Z7 beim Entzug sagt „Quellen gestoppt“ nur noch mit gemerkten Quellen (Aufgabe 4); dafür genügte das vorhandene Feld `ZoomKurz.sollOffen`.
- **O5 · Plural bei n = 1:** „[zoom] Abgleich: 1 gemerkte Quellen über der Betriebsgröße, nicht geladen“ (Texttabelle wörtlich).
- **O6 · erledigt (Nachbesserung, Aufgabe 13):** Ein gesendetes, noch unbestätigtes Abo gilt nur im Abgleich als verbunden; für Abbild, `sollOffen` und `zoom_alarm` bleibt der Eintrag offen (`wartet`), bis `subscribed` kommt oder Q8 (Spec 4, 7.5). Kern-Fall „Offenes Abo … ist noch keine Quelle …“.
- **O7 · Laufzeit:** `zoom-kern.test.ts` braucht am Endstand rund 95 s statt 31 s (Windows, dreimal gemessen); die Gesamtwache der Datei steht auf 180 s. Unter Linux (CI) ungemessen.
- **O8 · Ungemessen unter Linux/Node 22 (CI):** `TextDecoder('windows-1252')` (Aufgabe 19; die offiziellen Node-Builds haben volle ICU, der Fall misst es beim ersten CI-Lauf), `npm rebuild esbuild` (Aufgabe 16; unter Windows nicht nötig), die Quelltext-Wächter der Aufgaben 2, 4 und 12 (lesen Dateien über `import.meta.url`).
- **O9 · Nicht in 4b, aber bemerkt:** Die Kartentexte `TEXT_S10`, `TEXT_Q11`, `TEXT_Q13`, `TEXT_Q14`, `TEXT_Q15` bleiben Dubletten von `KT` („Bewusst NICHT in diesem Plan“). Erledigt durch die Nachbesserung: `sdkZeile` liest die Fassung aus dem Abbild (Aufgabe 4, N4b.3 Nr. 8).
- **O10 · Quelle der Aufgabe 19:** Der 0.2.2-Ledger (`worktrees/master-link-2b/.superpowers/sdd/2026-10-06-connect-zoom-sdk-laden/progress.md`) ist nicht mehr vorhanden. Die beiden geparkten Punkte („`kind.stderr` ohne `error`-Zuhörer“, „stderr `latin1` statt windows-1252“) stammen aus dem Auftrag und den Ist-Karten und sind am Code bestätigt.
- **O11 · L10 vor Aufgabe 17 freigeben (Owner, eigene Frage).** N4b.2 verlangt nur, dass Logdateien nach 14 Tagen gelöscht werden. Der Plan kürzt zusätzlich laufende Dateien (`main.log`, `renderer.log`) zeilengenau über Hilfsdatei und Umbenennen, in allen 25 Apps, alle 6 h. Begründung: Eine täglich genutzte App erreicht nie 5 MB, rotiert nie, und ohne Kürzen stünden ihre Zeilen für immer im Log. Lehnt der Owner das ab, entfallen in Aufgabe 17 `schnitt`, das Kürzen samt Hilfsdatei und die zugehörigen Fälle; das Löschen nach `mtime`, `last-crash.json`, der Aufrufort beim Start und alle 6 h bleiben.
- **O12 · Bekannte Grenze der Fernsteuerung:** `fernLaden` meldet `zoom_cmd=ok`, sobald `laden()` angestoßen ist. Muss `laden()` erst eine verwaiste Quelle abmelden (bis 2 s) und bricht danach ab (Entzug, Vergessen oder Entladen in der Wartezeit), bleibt `ok` stehen; die Karte zeigt den wahren Stand. Ein asynchrones `zoom_cmd` bräuchte einen zweiten STATE-Push nach dem Warten; das Verhalten ist bewusst nicht Teil von 4b.
- **O13 · Vorbestehender Wackler im Bridge-Selbsttest** (Gruppe „bridge - gegen die Attrappe“, `selftest.ts:852-883`, Abschnitt „Testläufe“): wartet nach `inMeeting` nicht auf `roster` und `privilege`. Eigener Nachzug außerhalb von 4b.

## Selbstprüfung des Plans (writing-plans, Abschnitt „Self-Review“)

**1. Spec-Abdeckung.** Jeder Punkt aus Spec 18, Zeile „4b · Betrieb und Auslieferung“, und aus dem Nachtrag „Umfang 4b“ hat eine Aufgabe; eine Lücke, die eine neue Aufgabe verlangt hätte, gab es nicht.

| Spec-Abschnitt | Aufgabe(n) |
| --- | --- |
| 6.4 Abriss und Wiederbeitritt: Auslöser, Folge mit Plan 2/5/10/20/30 s, Einordnung (DLL-Tod im Versuch mit Vorsatz), R2/R4/R5, Warteraum und Mangel im Versuch | 8, 9 (Attrappe: 1; Konstanten und Texte: 4, 5); `ended` im Versuch nach L4, gemeldete Abweichung (O4) |
| 6.8 Abbrechen, Verlassen in Z10/Z11; 6.6 Beenden während eines Versuchs | 9, 18 (Knopf, IPC) |
| 11.1 Capabilities der Rolle `connect` | 14 |
| 11.2 Verben im Main, `zoom_cmd*`, F1–F8 | 7 (deuten), 13 (Kern), 15 (Main, Weiche `leiteSteuerbefehl` getestet) |
| 11.3 STATE mischen | 15 |
| 11.4 Companion-Modul (Sync, Rolle Connect, Titler `graphic`/`slot`, 0.2.0) | 16 |
| 11.5 Rundown (kein Code, Hinweis) | 20 (Handbuch), „Nach der Umsetzung“ |
| 12.2 Fälle 15, 15b, 15c, 16, 17, 18 | 8 |
| 12.2 Fall 25 | 9 |
| 12.2 Fall 22, Fernsteuer-Teile von 13 und 21 | 13 |
| 12.4 `control-state.test.ts` | 15 |
| 12.5 Gegenproben zu 15, 15b, 15c, 17, 19; „Raum-Push ersetzt alles“ | 8, 15 |
| 12.6 CI-Schritte inklusive „Companion-Protokoll aktuell“ | 16 |
| 13 Abnahme (volle Liste für 0.3.0: jeder Schritt, den `ABNAHME-0.2.0.md` auf 0.3.0 verschiebt; Schritte 8, 11–17, 20, 21, 23 wörtlich; Messungen M2, M5, M8, M17 dazu M18, M19) | 21 (Zuordnung im Kopf der Abnahmeliste) |
| 14 Handbuch und „Mitzuziehen“ | 20 (Companion-README: 16) |
| 15 Release | kein Plan-Teil (N4b.4); „Nach der Umsetzung“ |
| 17.2 Nr. 2 (Anzahlen als wahr) | 16 (`isTruthy`), 21 (C4) |
| 17.2 Nr. 3 (Namen mit Leerzeichen im STATE) | 14 (Kodierung), 16 (Modul liest sie), 21 (C5) |
| 17.3 Abstimmung mit Master-Link 2b | 16 (Modul 0.2.0, CI-Schritt), „Nach der Umsetzung“ |
| N4b.1 Entzug stoppt Quellen, Soll bleibt, Wiedererteilung lädt neu (Betriebsgröße) | 1 (Attrappe), 2 (nativ), 4 (Texte), 10 (Kern), 20, 21 (B1–B4) |
| N4b.2 keine Namen im Log | 2 (nativ, unlesbare Ereigniszeile in `bridge.ts`), 5 (`logText`, `maskiereNamen`), 12 (Kern, NDI-Utility-Prozesse), 18 (Audit-Zeile), 21 (D1) |
| N4b.2 Löschfrist 14 Tage, alle Suite-Apps | 17, 21 (D3, D4) |
| N4b.3 Nr. 1 Doppelname „(2)“ | 1, 6, 11 |
| N4b.3 Nr. 2 Ton-Schalter aus dem Soll | 6, 11 |
| N4b.3 Nr. 3 Betriebsgröße im Abgleich, offene Abos zählen | 6, 10 (auch nach einem `await`), 13 (offenes Abo im Abbild offen) |
| N4b.3 Nr. 4 Versatz nur für die Sitzung | 4 (`versatzUebernommen`), 11, 18 |
| N4b.3 Nr. 5 „Schließen“ leert die Nummer | 18 |
| N4b.3 Nr. 6 Hinweise beim neuen Beitritt leer | 11 |
| N4b.3 Nr. 7 Entladen bei offenem Abo | 1, 11 |
| N4b.3 Nr. 8 S10 im Abbau · Z12 ohne Meeting · Z2 mit n > 0 · Rohwerte · Wächter-Namenslisten · abriss → im_meeting · Fassung und Fristen aus Konstanten | 4, 11 · 11 · 11 · 4, 18 · 3 · 1, 8 · 4 (auch `sdkZeile`), 5 |
| N4b.4 nicht in 4b (OAuth/OBF, Release, Proxy, Katalog) | keine Aufgabe; „Nach der Umsetzung“ beschreibt das Release |
| Owner: Betriebsgröße max. 5, Meetings nur im eigenen Konto, Companion minimal (kein Beitritt per Companion) | 6, 10, 13 (F8 über 5 nur per Fernsteuerung, L7); kein Verb für den Beitritt (11.1, 14) |

**2. Platzhalter.** Gesucht nach „TBD“, „TODO“, „später“, „wie Aufgabe N“, `<n>` in erwarteten Ausgaben und nach den Platzhaltern der Montage. Gefunden und ersetzt: die Verweise der Aufgabe 21 auf „Zahl wie am Ende von Aufgabe N“ (jetzt die gemessenen Zahlen), die Zählstände aus Ersatzständen in Aufgabe 8 Step 15 und Aufgabe 13 Step 8, „Block A/B/C/D/E“ und „Abschnitt 9/11“ in Aufgaben und Kopf. `<n>`/`<pass>` stehen nur noch in den allgemeinen Test-Konventionen, „…“ in Codeblöcken nur in gekürzten erwarteten Ausgaben und in UI-Texten der Spec.

**3. Typ- und Namenskonsistenz.** Die Interfaces aller 21 Aufgaben sind gegen die Kurzliste „Schnittstellen“ abgeglichen. Danach ist der Plan als Ganzes nachgespielt, nach der Nachbesserung noch einmal: 262 Ersetzungen und 7 neue Dateien in Aufgabenreihenfolge, jeder Vorher-Text genau einmal; nach jeder Aufgabe die Typechecks und Testläufe ihrer Steps. Ergebnis am Endstand: `npm run typecheck -w @jm/connect` und `-w @jm/zoom-bridge` ohne Fehler, alle 25 Apps mit `typecheck`-Skript grün gegen die geänderte app-runtime (Aufgabe 17), `npm run typecheck -w @jm/rundown` grün (Aufgabe 14), `npm run build -w @jm/connect` grün; alle Selbsttests mit den Zählständen aus „Testläufe“. Die Namen, die spätere Aufgaben nutzen, stimmen überein: `privilegeRevoked`; `BETRIEBSGROESSE`, `WIEDERBEITRITT_VERSUCHE`, `sollZeile`, `bildText`, `tonText`, `quellenZustandText`, `versatzZeile`, `versatzUebernommen`; `WIEDERBEITRITT_PLAN_S`, `ZOOM_FRISTEN`; `KT.R2/R4/R5/R7`, `istEndgueltig`, `FT`, `fernLogText`, `maskiereNamen`; `deuteZoomBefehl`, `ladeZiel`; `wiederbeitrittPlanMs`, `abbrechen()`, `belegteAbos()`, `setzeVersatzMs(): boolean`, `versatzNurSitzung()`, `hinweis(text, logText?)`, `steuerbefehl(cmd)`; `kodiereStateWert`/`dekodiereStateWert`; `mischeState`, `erzeugeStateSpeicher`, `leiteSteuerbefehl`, `setZoomControlState`, `zoomSteuerbefehl`; `isTruthy`; `raeumeLogsAuf`, `KUERZEN_MAX_BYTES`; `IPC.zoomAbbrechen`/`JmConnectApi.zoomAbbrechen`.

**4. Review Focus.** Jede Zeile hat ihren Test in der genannten Aufgabe, am Endstand grün:
- 1 → Aufgabe 13, Prüfung „Review Focus 1: Taste prellt (zweimal zoom_load Ben vor subscribed) → zoom_cmd=ok, rejected 0“ samt „genau ein videoSubscribe für Ben“.
- 2 → Aufgabe 10, Prüfung „Review Focus 2: zwei Quellen, die Erlaubnis flattert (entzogen, sofort wieder erteilt, dann Abbau)“.
- 3 → Aufgabe 9, Block „Wiederbeitritt verlassen und beenden (Review Focus 3)“, beide Wege (`beenden`, `verlassen`).
- 4 → Aufgabe 8 („Review Focus 4 (Wiederbeitritt): Z11 wartet“ und folgende) und Aufgabe 10 („Review Focus 4 (Entzug): beide gestoppt“ und folgende).
- 5 → Aufgabe 14, Block „STATE-Kodierung“ (Rundweg verlustfrei mit Leerraum, NBSP, Tab, `%`, `=`, Emoji, leerem Wert; alte Zeilen; Schlüssel nie kodiert).

**Nicht ausgeführt bei der Montage und der Nachbesserung:** der native Bau (O1), jeder Lauf unter Linux (O8), die Commit-Schritte und `git diff --exit-code` mit echtem `git` (in der Kopie durch Prüfsummen ersetzt: zwei Sync-Läufe byte-gleich, `cookbook.json` mit `git diff --no-index` gegen den HEAD-Blob `380 1`). Die Gegenproben der Schreiber in den Aufgaben 1, 3, 6, 7, 11, 14, 16 und 19 sind nicht wiederholt (diese Aufgaben hat die Nachbesserung nicht geändert); die der übrigen Aufgaben sind neu gemessen.

---

## Nach der Umsetzung (nur Controller und Owner)

Dieser Abschnitt beschreibt, was nach den Aufgaben geschieht. Er enthält keine Aufgabe für ausführende Agenten.

- **Nativer Bau:** Der Controller baut `zoom-bridge.exe` am Entwicklungs-PC mit SDK, sofern Aufgabe 2 ihn nicht schon gebaut hat (L17).
- **Abnahme:** Der Owner nimmt mit einem internen Bau (`npm run dist:dir -w @jm/connect`, Wächter 1 und 2 laufen mit) nach `apps/connect/ABNAHME-0.3.0.md` ab, im eigenen Zoom-Konto. Die Messungen M2, M5, M8, M17, M18 und M19 fließen in die Spec (Abschnitt 16) und in die Roadmap zurück, und vor dem Release auch ins Handbuch (`tool-jm-connect.md`, Aufgabe 20), wo es Verhalten beschreibt: M19 (D2) in „Logs und Datenschutz“ und „Deinstallieren“ (was das Zoom-SDK unter `%APPDATA%\ZoomSDK` ablegt), M18 (B1, B2) in „Harte Grenzen“, „Während“ und die Pannenhilfe-Zeile „Aufnahme-Erlaubnis vom Host entzogen, Quellen gestoppt …“ (stoppt Connect Bild und Ton wirklich sofort?), M5 (G1) in „Harte Grenzen“ (Betriebsgröße). Ändert sich dabei ein Text, läuft `npm run cookbook:build` neu.
- **Release** (nach Freigabe durch den Owner; Vorbild Spec 15, mit 0.3.0 statt 0.2.0):
  - Der Controller hebt `apps/connect/package.json` auf 0.3.0 und ergänzt den Changelog-Eintrag `connect` 0.3.0. Der Eintrag nennt das Companion-Modul 0.2.0 (Connect erstmals steuerbar, Titler `graphic`/`slot`, Anzahlen als wahr, Namen mit Leerzeichen). Im Text stehen keine ASCII-Anführungszeichen, und das JSON wird vor dem Commit validiert.
  - `node scripts/bump-manifest.mjs connect 0.3.0` läuft.
  - Der Controller baut lokal mit `ZOOM_SDK_DIR` und `NDI_SDK_DIR` (`npm run dist:win -w @jm/connect`).
  - Er erzeugt `pkg.tgz` des Moduls mit `npm run build:local` im Modulordner und hängt es als `jm-suite-companion-0.2.0.tgz` an das Release `connect-v0.3.0`.
- **Vor dem Push:**
  - Der Controller prüft den Stand von Master-Link 2b auf `main` (Spec 17.3). Laut Ist-Karte hat 2b Steuerprotokoll und Modul nicht angefasst. Ist 2b vorher gemergt, wird dieser Branch rebased, und `npm run sync` läuft neu; der CI-Schritt „Companion-Protokoll aktuell“ macht ein Vergessen rot.
  - In `.github/workflows/ci-checks.yml` bleiben die Schritte beider Stränge erhalten.
  - Auf `main` steht Connect seit dem Release 0.2.2 auf 0.2.2; nach dem Rebase gilt der Sprung von dort auf 0.3.0.
- **Reihenfolge Release vor Merge** (Lehre „erst releasen, dann mergen“):
  - `MANIFEST_REF` des Proxys wird vorab geprüft.
  - Der Tag `connect-v0.3.0` geht einzeln hinaus.
  - Das Release ist ein Pre-Release mit Installer und Modul-`.tgz`.
  - Danach folgt der Merge. Der Launcher zeigt 0.3.0, und das Handbuch erscheint im Kochbuch.
- **Folgen außerhalb von Connect:**
  - Die Löschfrist von `@jm/app-runtime` wirkt in jeder anderen Suite-App erst mit deren nächstem Release (Abnahme D4).
  - Der Rundown zeigt die Zoom-Aktionen erst mit seinem nächsten Release (Spec 11.5).
  - Die STATE-Kodierung aus Aufgabe 14 (`formatSuiteState` kodiert Leerraum und `%` als `%XX`) kommt mit `@jm/suite-control-protocol` in jede App, die das Paket bündelt (Player, Titler, Studio-Control, Switcher und weitere), und zwar mit deren nächstem Release. Ab dann setzt ein Textwert mit Leerzeichen oder `%` das Companion-Modul ab 0.2.0 voraus: Ältere Module (0.1.x) und der bisherige Rundown zeigen „Kamera%201“ bzw. „100%25“, und `equalsArg`-Feedbacks auf solche Textwerte treffen dort nicht mehr. Der Hinweis gehört in die Release-Notizen jeder betroffenen App (zum Beispiel „braucht das Companion-Modul ab 0.2.0“).
- **Notfallweg:** `zoom-bridge-v0.1.0` bleibt bestehen (F5). Das Einzelpaket enthält die neue Entzugslogik nicht.

