# Zoom Stage 4a (Fundament: Zoom-Bridge in JM Connect) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** JM Connect richtet unter Windows einmal je PC das Zoom-SDK und die Zugangsdaten ein, tritt aus dem Connect-Fenster einem Zoom-Meeting im eigenen Konto bei und lädt einzelne Teilnehmer als NDI-Quelle — mit ehrlichem Status in Karte, Kopfzeile und Tray, sauberem Verlassen und Beenden und ohne eine einzige Zoom-Datei im Installer. Ende: interner Bau für den Owner-Kurztest (Abnahme 1–8, 10, 19, 21, 22, 24). Kein Release.

**Architecture:**
- **`@jm/zoom-bridge`** (nur TypeScript, Skripte, Attrappe; der C++-Teil bleibt unverändert): neues `src/sdk.ts` (SDK-Fassung, PE-Leser, SDK-Ordnersuche); Fehlerkatalog `FAIL_CODE_NAMES`/`failCodeName`/`failReason`/`endReason` in `src/protocol.ts`; neues `scripts/auslieferung.mjs` (Wächter für Dateien **und** `.asar`-Inhalt, VC-Laufzeit-Suche, Frische der EXE), das `build-release.mjs` und die Connect-Paketierung gemeinsam nutzen; Attrappe mit den Stellschrauben aus Spec 12.1 Nr. 4.
- **Connect, rein und ohne Electron** (`src/main/zoom/*.ts`, `src/shared/zoom-text.ts`): `klartext.ts` (alle Texte aus Spec 8), `laufzeit.ts` (Laufzeit-Ordner, Kopie, Stempel, Prüfung, `kindPfad`), `teilnehmer.ts` und `soll.ts` (Teilnehmerzeilen, Kollision, Soll-Liste als reine Funktionen), `kern.ts` (Zustandsmaschine, Bridge-Lebenslauf mit Generationsregel 6.9, Abbild, `stateKv()`), `einstellungen.ts` (Regeln der Zoom-Felder), `zoom-text.ts` (eine Quelle für Tray, Kopfzeile, Kartentext, Knopflogik und STATE-Werte). Alles mit `tsx` gegen die echte `Bridge` und die Attrappe testbar.
- **Connect-Hülle** (`src/main/zoom.ts` + `settings.ts`, `ipc.ts`, `ndi-guests.ts`, `tray.ts`, `index.ts`, Preload): IPC, Dialoge, `safeStorage`, Logordner, asynchrones Beenden. Oberfläche `renderer/src/zoom/ZoomCard.tsx` außerhalb des Raum-Zweigs.
- **Paketierung:** `tools/bundle-zoom-bridge.mjs` (Wächter 1) und `tools/after-pack.cjs` (Wächter 2, auch in die `app.asar`); `@jm/zoom-bridge` steht nur in den `devDependencies`.
- **Nicht in 4a** (Plan 4b): automatischer Wiederbeitritt (6.4), Fernsteuerung (Abschnitt 11, `zoom_cmd*`, STATE-Mischen, Companion), Handbuch, Release. In 4a führt jeder Auslöser, der laut 6.4 einen Wiederbeitritt startet, sofort zu `fehler` mit „Erneut beitreten“.

**Tech Stack:** TypeScript (ESM), Electron 33, electron-vite 2, electron-builder 24.13.3, React 18 + Tailwind 4, Node ≥ 22.6 (`--experimental-strip-types` im Bridge-Selbsttest), `tsx` ^4.19.2 (Connect-Tests), Zoom-Meeting-SDK 7.1.5.43953 (nur zur Laufzeit beim Bediener, nie im Repo oder Installer), NDI 6.

**Spec:** `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md` (vom Owner freigegeben am 02.10.2026), Umfang dieses Plans: Abschnitt 18, Zeile „4a · Fundament“. Plan und Spec gehören zusammen; bei Widerspruch gilt die Spec, und die Abweichung wird gemeldet.

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\suite-sofort-fixes` (Branch `feat/zoom-stage4-connect`). Alle Pfade relativ dazu.

**Wie dieser Plan entstanden ist:**
- Ein Gerüst hat Aufgaben, Dateien und verbindliche Schnittstellen festgelegt. Vier Schreiber haben die Aufgaben in Blöcken ausformuliert: **Block 1** = Aufgaben 1–4 und 19 (Bridge-Paket, Paketierung), **Block 2** = Aufgaben 5–9 (Connect, reine Module), **Block 3** = Aufgaben 10–15 (Kern), **Block 4** = Aufgaben 16–18 und 20 (Hülle, Oberfläche, Abschluss).
- Jeder Schreiber hat seine Aufgaben an einer Kopie des Worktrees im Scratch-Ordner nachgebaut, jeden Test erst rot und dann grün gemessen und alle Vorher-Ausschnitte auf „genau einmal vorhanden“ geprüft. Gemessene Zählstände (Windows, Node 24): Bridge-Selbsttest 405 → 425 → 447 → 471 `ok` plus 24 in `auslieferung.test.mjs`; `zoom-text.test.ts` 319 → 487; `zoom-laufzeit.test.ts` 50 → 79; `zoom-teile.test.ts` 55 (+ 23 ab Aufgabe 16); `zoom-kern.test.ts` 63 → 96 → 152 → 195 → 228 → 252. Die Ergebnisse der Gegenprobe (absichtlich eingebaute Fehler) stehen am Ende der jeweiligen Aufgabe.
- Die Blöcke liefen zunächst gegen Ersatz-Module für die jeweils anderen Blöcke. Bei der Montage wurde darum der fertige Plan als Ganzes nachgespielt: alle 148 Ersetzungen und 20 neuen Dateien der Aufgaben 1–20 der Reihe nach auf eine frische Kopie des Worktrees, danach alle Selbsttests, beide Typechecks und der Bau grün (Abschnitt „Selbstprüfung der Montage“ am Ende).
- Nicht ausgeführt: der Bau der echten Bridge und des Installers (Aufgabe 19 Steps 12–15 und Aufgabe 20 Steps 7–9, braucht SDK und Visual Studio, L14) und ein Lauf der Tests unter Linux.
- Zweite Prüfrunde (05.10.2026), sieben Befunde eingearbeitet: `kern.beenden` wartet auf eine abgebrochene SDK-Kopie, bis `.teil` gelöscht ist (Aufgabe 10/13, Review Focus 3 jetzt im Kern-Test, L24); Z2-Meldungsknöpfe „Erneut/Schließen“ nur zur Meldung des Meeting-Endes (Aufgabe 5); `.zip`-Regel des `.asar`-Wächters mit eigenem Testeintrag (Aufgabe 4); Fall 7 zusätzlich über den Beitritt (Aufgabe 12); erwartete `grep -c`-Ausgabe `1` (Aufgaben 17, 18); Commit-Schritte der Aufgaben 16, 17, 18 und 20 mit `git status --short` vor dem Commit. Danach wurde der ganze Plan erneut nachgespielt; Zählstände und Zeilenangaben unten sind die neu gemessenen.
- Jede Aufgabe trägt am Ende ihre Abweichungen vom Gerüst.

## Global Constraints

- G1 SDK-Fassung exakt `7.1.5.43953` (`SDK_FASSUNG`); die Bridge meldet `7.1.5 (43953)` (`SDK_FASSUNG_BRIDGE`). Die Prüfung bleibt exakt, auch in Tests (die Attrappe liefert den Wert über `FAKE_SDK_FASSUNG`).
- G2 Laufzeit-Ordner `%LOCALAPPDATA%\JM Connect\zoom-laufzeit\7.1.5.43953\`, Stempel `jm-zoom-laufzeit.json` mit `"format": 1`. Bridge-Dateien im Installer unter `resources\zoom-bridge\`, nie unter `resources\bin\win`.
- G3 Feste Werte (Spec 5.2): `ANMELDE_FRIST_MS` 30 000 · `joinTimeoutMs` 30 000 · `killTimeoutMs` 12 000 · `BEENDEN_FRIST_MS` 15 000 · `ABGLEICH_VERZOEGERUNG_MS` 300 · `ABO_ANTWORT_FRIST_MS` 10 000 · `JWT_GUELTIG_S` 43 200 · `BETRIEBSGROESSE` 5 · `AUFLOESUNG` `'720p'` · `ABBILD_TAKT_MS` 100 · `HINWEISE_MAX` 5. Platzreserve der Kopie 100 MB, Warten auf `unsubscribed` beim Neu-Laden höchstens 2 s. Fristen sind für Tests einspeisbar; die 300 ms bleiben in den Fällen 14 und 14b unverändert.
- G4 Anzeigename Vorgabe „JM Connect“, 1 bis 64 Zeichen nach `trim`. Versatz ganze Zahl 0 bis 1000 ms, Vorgabe 0.
- G5 Meeting-Nummer und Kenncode nie auf Platte, nie im STATE, nie im Log; Bridge-Zeilen maskiert mit `•••` (nur nicht-leere Werte: Kenncode, Nummer eingegeben und normiert, JWT). Client-ID/Secret nie an den Kindprozess: `envRemove` = `ZOOM_SDK_CLIENT_ID`, `ZOOM_SDK_CLIENT_SECRET`, `ZOOM_SDK_CREDENTIALS` + `pfadVarianten(env)`. Der Renderer sieht nur Herkunft und die letzten 4 Zeichen der Client-ID.
- G6 Keine Datei aus `<Zoom-SDK>\x64\bin` im Installer; `@jm/zoom-bridge` nur in den `devDependencies` von Connect; `electron-builder.yml` `files` enthält `"!**/node_modules/@jm/zoom-bridge/**"`.
- G7 Nativer Teil unverändert: `packages/zoom-bridge/native/**` und `packages/zoom-bridge/CMakeLists.txt` nicht anfassen.
- G8 `src/main/zoom/*.ts` und `src/shared/zoom-text.ts`: kein `electron`, keine Aliase (`@shared`), nur relative Importe und `@jm/zoom-bridge`; Typen per `import type`. `src/shared/*` und `packages/zoom-bridge/src/protocol.ts` ohne `node:`-Importe und ohne Node-Typen (der Renderer-tsconfig prüft sie mit).
- G9 Texte wörtlich aus Spec 7, 8 und 9: deutsche Anführungszeichen „…“, Gedankenstrich „–“ (U+2013) in „JM Connect – Zoom <Name>“, Geviertstrich „—“ (U+2014), wo die Spec ihn schreibt (Tooltip „JM Connect — …“, Text A4), Auslassung „…“ (U+2026). Log-Präfixe `[zoom]` (Kern) und `[zoom-bridge]` (stderr der Bridge).
- G10 Kein Test lädt Electron oder braucht das echte SDK. CI: Ubuntu, Node 22, `npm ci --ignore-scripts`. Windows-only-Fälle zählen anderswo als „übersprungen“.
- G11 Nicht anfassen in 4a: `packages/suite-control-protocol/**`, `packages/companion-jm-suite/**`, `apps/connect/src/main/control-server.ts`, Versionsnummern, Changelog/Manifest. Kein `zoomAbbrechen`, keine `zoom_*`-Verben im Main, kein `zoom_cmd*`.
- G12 Test-Meeting-Nummer nur synthetisch (`'7'.repeat(10)`), Test-Kenncode enthält `KENNCODE-PROBE`. Keine echten Meeting-Nummern oder Kenncodes, auch nicht als Beispiel.
- G13 git: kein Push, kein Branch-Wechsel, kein bare `git stash`, kein `git reset --hard`, kein `git clean`. `git add` nur mit expliziten Pfaden, danach `git status --short` lesen. Commit-Nachricht deutsch (`feat(zoom-bridge): …`, `feat(connect): …`), letzte Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- G14 Dateien im Arbeitsbaum haben CRLF (`core.autocrlf=true`): mit dem Edit-Werkzeug ersetzen (Vorher-Text exakt), nicht mit `sed`.
- G15 TDD: erst den Test rot sehen, dann Code. Jede Aufgabe endet mit grünem `npm run typecheck -w <paket>` für jedes berührte Paket und grünem Selbsttest.

## Testläufe (wie sie wirklich heißen)

| Paket | Befehl | Läuft mit |
| --- | --- | --- |
| `@jm/zoom-bridge` | `npm run selftest -w @jm/zoom-bridge` | `node --experimental-strip-types test/selftest.ts` + `node test/auslieferung.test.mjs` (ab Aufgabe 4) |
| `@jm/connect` | `npm run selftest -w @jm/connect` | `tsx` je Testdatei; Endstand 4a: `tsx test/zoom-text.test.ts && tsx test/zoom-laufzeit.test.ts && tsx test/zoom-teile.test.ts && tsx test/zoom-kern.test.ts && node test/after-pack.test.mjs` |
| eine Connect-Testdatei | `npx tsx apps/connect/test/<datei>.test.ts` (aus der Worktree-Wurzel) | tsx |
| Typen | `npm run typecheck -w @jm/connect` · `npm run typecheck -w @jm/zoom-bridge` | tsc |
| Bau | `npm run build -w @jm/connect` | electron-vite |

Gemeinsame Test-Konvention Connect (wie `apps/launcher/test/iveo-huelle.test.ts`): `let pass = 0, fail = 0; function ck(name: string, cond: boolean)` mit Ausgabe `  ok  <name>` bzw. `FAIL  <name>`, Schluss `console.log(<pass> ok, <fail> fehlgeschlagen.)` + `process.exit(fail === 0 ? 0 : 1)`; neue Blöcke immer direkt über der Ankerzeile `// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──`. In `zoom-kern.test.ts` zusätzlich `skip` und die Schlusszeile `${pass} ok, ${fail} fehlgeschlagen, ${skip} übersprungen.`. Bridge-Selbsttest: `assert(cond, name)` mit Zähler `failures`, neue Blöcke vor der Schlusszeile `console.log(failures === 0 ? '\nAlle Selbsttests bestanden.' : …)`.

## Review Focus

1. Doppelklick auf „Beitreten“: ein zweiter `beitreten()`, während der erste noch in `startet`/`tritt_bei` steht → `{ ok: false, text: '' }`, die Fabrik baut genau **eine** Bridge, Nummer und Kenncode bleiben die des ersten Aufrufs. → Test in **Aufgabe 12**.
2. Normales „Meeting verlassen“ aus `im_meeting` (die stoppende Bridge meldet beim `quit` selbst `disconnecting` und `ended`) → Zustand `verlaesst`, dann `bereit`; `meldung === null`, kein „Meeting beendet: …“, `erneutMoeglich === false`, `zoom_alarm=0`. → Test in **Aufgabe 13**.
3. Connect wird beendet, während die SDK-Kopie läuft → `richteEin` bricht über das `AbortSignal` ab, `kern.beenden` kehrt erst zurück, wenn `richteEin` sein Ergebnis geliefert hat (höchstens `fristMs`), `<ziel>.teil` ist dann gelöscht, ein vorher eingerichteter Laufzeit-Ordner samt Stempel ist unverändert. → Test in **Aufgabe 10** (Kern mit dem echten `richteEin` über Temp-Ordner); `richteEin` allein belegt Aufgabe 7.
4. Doppelklick „SDK-Ordner wählen …“ während die Kopie läuft → der zweite `sdkWaehlen()` liefert S10, `richteEin` wurde genau einmal aufgerufen. → Test in **Aufgabe 10**.
5. Ungültige Beitrittsdaten: Nummer mit Buchstaben → N0; Anzeigename leer, nur Leerzeichen oder 65 Zeichen → N0b; jeweils keine Bridge gestartet, Zustand unverändert, weder Nummer noch Kenncode im Rückgabetext oder im Log. → Test in **Aufgabe 12**.

---

## Dateistruktur

**`packages/zoom-bridge`** (Bridge-Paket, nur TS/Skripte/Attrappe)
- `src/sdk.ts` (neu, Aufgabe 1) — `SDK_FASSUNG`, `SDK_FASSUNG_BRIDGE`, `peInfo` (Maschinentyp + Dateifassung aus PE), `findeSdkBin`.
- `src/protocol.ts` (geändert, Aufgabe 2) — `FAIL_CODE_NAMES`, `failCodeName`, `FAIL_CODES` ergänzt, `failReason`, `endReason`; `explainStatus` unverändert.
- `src/index.ts` (geändert, Aufgaben 1, 2) — Exporte der neuen Funktionen und der Ton-/Bild-Typen.
- `package.json` (geändert, Aufgaben 1, 4) — Export `./sdk`; `selftest` ruft zusätzlich `test/auslieferung.test.mjs`.
- `test/fake-bridge.mjs` (geändert, Aufgabe 3) — Stellschrauben `FAKE_SDK_FASSUNG`, `FAKE_DOPPELNAME`, `FAKE_NDI_FEHLER`, `FAKE_EINLASS_MS`/`FAKE_EINLASS_HAENGT`, `FAKE_VERBINDUNG_HAENGT_MS`, `FAKE_ENTZUG_MS`, `FAKE_RUECKKEHR_MS`/`FAKE_RUECKKEHR_NAME`, `black`/`participantLeft` beim Weggang, `envprobe` mit `path`.
- `test/selftest.ts` (geändert, Aufgaben 1–3) — Fälle 12.1 Nr. 1–4.
- `scripts/auslieferung.mjs` (neu, Aufgabe 4) — `SDK_NAMEN_7_1_5`, Wächter für Ordner und `.asar`, VC-Laufzeit-Suche, Linker-/Dateifassung, Frische der EXE.
- `scripts/build-release.mjs` (geändert, Aufgabe 4) — importiert diese Teile statt eigener Kopien; Verhalten unverändert.
- `test/auslieferung.test.mjs` (neu, Aufgabe 4) — Wächter und `.asar`-Leser gegen Temp-Ordner.

**`apps/connect`** (JM Connect)
- `package.json` (geändert, Aufgaben 5, 7, 9, 10, 19) — `devDependencies` `@jm/zoom-bridge`, `tsx`; Skripte `selftest`, `prepackage`, `dist:dir`.
- `tsconfig.node.json` (geändert, Aufgabe 5) — `allowImportingTsExtensions: true`, `test/**/*.ts`.
- `electron.vite.config.ts` (geändert, Aufgabe 16) — `@jm/zoom-bridge` in `internalPackages`.
- `electron-builder.yml` (geändert, Aufgabe 19) — `afterPack: tools/after-pack.cjs`, `files` mit `"!**/node_modules/@jm/zoom-bridge/**"`.
- `.gitignore` (geändert, Aufgabe 19) — `resources/zoom-bridge/`.
- `src/shared/types.ts` (geändert, Aufgaben 5, 16) — Zoom-Typen (Spec 5.4 + `ZoomSollEintrag.doppelname`, `ZoomParticipant.fehler`), `AppStatus.zoom`, `JmConnectApi`-Methoden.
- `src/shared/ipc.ts` (geändert, Aufgabe 16) — Zoom-Kanäle (Spec 5.5, ohne `zoomAbbrechen`).
- `src/shared/zoom-text.ts` (neu, Aufgabe 5) — `zoomZ`, `zoomZeile`, `kartenZeile`, `gaesteZeile`, `trayTooltip`, `trayVerlassenAktiv`, `stateKvAus`, `sdkZeile`, `sdkKnopf`, `zugangZeile`, `zoomKnoepfe`, `TEXT_A4`, `TEXT_A6`, `MANGEL_GRUND`: eine Quelle für Tray, Kopfzeile, Karte, STATE.
- `src/main/zoom/klartext.ts` (neu, Aufgabe 6) — alle Klartexte aus Spec 8.1–8.5, Zuordnung der Fehler, Maskierung.
- `src/main/zoom/laufzeit.ts` (neu, Aufgaben 7, 8) — SDK-Ordner prüfen, kopieren, Stempel, Tausch, `pruefeLaufzeit`, eigene Dateien abgleichen, `kindPfad`, `pfadVarianten`.
- `src/main/zoom/teilnehmer.ts` (neu, Aufgabe 9) — `normName`, NDI-Vorschau, Teilnehmerzeilen, Kollision, Quellenzählung (rein).
- `src/main/zoom/soll.ts` (neu, Aufgabe 9) — Soll-Liste: Stand und Handlungen nach der Tabelle in 6.3 (rein).
- `src/main/zoom/kern.ts` (neu, Aufgaben 10–15) — Zustandsmaschine, Startfolge, Bridge-Lebenslauf mit Generationen, Laden/Entladen/Abgleich, Abbild mit Drossel, `stateKv()`.
- `src/main/zoom/einstellungen.ts` (neu, Aufgabe 16) — reine Regeln der Zoom-Felder (Spec 5.6): Rangfolge Umgebung > gespeichert > Sitzung, „unlesbar“, gültiger Anzeigename und Versatz.
- `src/main/zoom.ts` (neu, Aufgabe 16) — Hülle: Kern erzeugen (nur `win32`), IPC-Handler, Dialoge, Logordner, Push an Fenster/Tray.
- `src/main/settings.ts` (geändert, Aufgabe 16) — Zoom-Felder (Spec 5.6) mit `safeStorage`.
- `src/main/ndi-guests.ts` (geändert, Aufgabe 16) — `activeLabels()`.
- `src/main/ipc.ts` (geändert, Aufgaben 5, 16) — `AppStatus.zoom` füllen.
- `src/main/tray.ts` (geändert, Aufgaben 5, 17) — Gäste- und Zoom-Zeile, „Zoom-Meeting verlassen“, Tooltip.
- `src/main/index.ts` (geändert, Aufgabe 17) — Zoom starten, asynchrones Beenden, `session-end`, Gast-Labels melden.
- `src/preload/index.ts` (geändert, Aufgabe 16) — Zoom-Methoden der API.
- `src/renderer/src/zoom/ZoomCard.tsx` (neu, Aufgabe 18) — Zoom-Karte (Spec 9).
- `src/renderer/src/App.tsx` (geändert, Aufgaben 17, 18) — Kopfzeile (Ausgangsstand Zeile 246), Karte nach dem Raum-Abschnitt (nach Ausgangszeile 359).
- `tools/bundle-zoom-bridge.mjs` (neu, Aufgabe 19) — Bridge + VC-Laufzeit nach `resources/zoom-bridge/`, Wächter 1.
- `tools/after-pack.cjs` (neu, Aufgabe 19) — Wächter 2 (Ordner + `.asar`, `zoom-bridge.exe` vorhanden).
- `test/zoom-text.test.ts` (Aufgaben 5, 6), `test/zoom-laufzeit.test.ts` (Aufgaben 7, 8), `test/zoom-teile.test.ts` (Aufgaben 9, 16), `test/zoom-kern.test.ts` (Aufgaben 10–15), `test/after-pack.test.mjs` (Aufgabe 19) — alle neu.
- `ABNAHME-0.2.0.md` (neu, Aufgabe 20) — Abnahmeliste Spec 13 mit Spalte „4a-Kurztest“.

**Wurzel**
- `package-lock.json` (geändert, Aufgabe 5, nur durch `npm install --ignore-scripts`) — `devDependencies` von `apps/connect`.
- `.github/workflows/ci-checks.yml` (geändert, Aufgabe 20) — zwei Schritte im Job `selftests`.

Bewusst unverändert in 4a: `apps/connect/src/main/control-server.ts`, `apps/connect/src/renderer/src/jmconnect.d.ts` (bezieht `JmConnectApi` aus `types.ts`), `packages/suite-control-protocol/**`, `packages/companion-jm-suite/**`, `packages/zoom-bridge/native/**`, `packages/zoom-bridge/CMakeLists.txt`.

## Bewusst NICHT in diesem Plan (gehört zu 4b, Spec 18)

- Automatischer Wiederbeitritt (6.4): `WIEDERBEITRITT_PLAN_S`, Z11 erzeugen, `istEndgueltig`/Einordnung, R2, R4, R5, R7, IPC `zoomAbbrechen` und Karten-Knopf „Abbrechen“; Fälle 15, 15b, 15c, 16–18, 25. Die Texte für Z11 stehen trotzdem schon in `zoom-text.ts` (Abschnitt 7 vollständig); der Kern erzeugt Z11 in 4a nie.
- Fernsteuerung (Abschnitt 11): `capabilities.ts`, `zoom_*`-Verben im Main (`index.ts` `onCommand`), `zoom_cmd`/`zoom_cmd_rejected`, F1–F8, `control-state.ts`/`mischeState`, `setZoomControlState`, `control-state.test.ts`; Fall 22 und die Fernsteuer-Teile von 13 und 21. Folge in 4a: `kern.stateKv()` ist berechnet und getestet, wird aber nicht an Companion gepusht; `zoom_*`-Verben gehen wie heute an den Renderer und verpuffen dort (nicht in dessen `map`).
- Companion-Sync, Modul 0.2.0, CI-Schritt „Companion-Protokoll aktuell“, Altfehler 17.2 Nr. 2/3, Abstimmung mit Master-Link 2b (17.3).
- Handbuch und Doku (Abschnitt 14 inkl. `docs/roadmap.md`, Bridge-README Abschnitt 9, Paketbeschreibung), volle Abnahme, Release (Abschnitt 15: Version 0.2.0, Changelog, `suite.json`, Tag).

## Entscheidungen des Plans, die die Spec nicht wörtlich trägt (bitte prüfen)

Die Aufgaben verweisen mit „L<n>“ auf diese Liste.

- L1 4a-Übergangstexte für Abriss ohne Wiederbeitritt: `failed` → „Verbindung verloren: “ + 8.3-Text (spec-konform); `reconnectTimeout` in Z10 → „Verbindung verloren: Zoom hat die Verbindung in 30 s nicht wiederhergestellt.“; Absturz im Meeting → „Verbindung verloren: Die Zoom-Bridge ist abgestürzt ({detail}). Details im Log.“ Die beiden letzten Texte stehen nicht in der Spec; 4b ersetzt sie durch den Wiederbeitritt.
- L2 Deutsche Kurztexte in `FAIL_CODES` für 11, 14–16, 23, 60–64, 82, 88, 89, 500–506: die Spec verlangt sie, nennt sie aber nicht wörtlich. Vorschlag in Aufgabe 2. Sichtbar werden davon nur 11 und 15 (über Csonst), der Rest nur in `explainStatus` der Konsole.
- L3 Fall 14b „NDI-Name unverändert“: Kommt „Anna“ als „anna“ zurück, baut die Bridge (und die Attrappe) den Namen „JM Connect – Zoom anna“ — er unterscheidet sich in der Groß-/Kleinschreibung. Der Test prüft daher „normiert gleich und ohne ‚ (2)‘“. Ob NDI/der Switcher Groß-/Kleinschreibung unterscheidet, ist ungemessen.
- L4 `ZoomSollEintrag.doppelname: boolean` zusätzlich zu Spec 5.4: sonst kann die Karte „verwaist + Doppelname rot mit Q11“ (Spec 9 Punkt 9) nicht zeigen.
- L5 `ZoomParticipant.fehler: string | null` zusätzlich zu Spec 5.4: Spec 9 Punkt 8 verlangt Zeilenfehler Q2/Q8 auch ohne laufende Quelle; `ZoomQuelle.fehler` reicht dafür nicht.
- L6 Singular in Kartentexten und im Verlassen-Knopf abgeleitet („1 Quelle besteht noch“, „1 Quelle geladen“, „Ja, verlassen (1 Quelle läuft)“); die Spec regelt Singular nur für Tray-/Kopfzeile.
- L7 MB-Rundung (Z1b, S5): MiB; Z1b `Math.round`, S5 gebraucht `Math.ceil`, frei `Math.floor`. Die Spec nennt keine Rundung.
- L8 Die Maskierung sitzt im Kern (`maskiere` aus `klartext.ts`), nicht in der Hülle (Spec 8.7): nur so belegt Fall 3 sie im Kern-Test.
- L9 Aufrufe außerhalb der erlaubten Zustände (zweites `beitreten` während `startet`, `pruefen` außerhalb `bereit`, `laden` außerhalb des Meetings, Dialog abgebrochen, falscher Nutzlast-Typ) antworten mit `{ ok: false, text: '' }`; der Renderer zeigt leere Texte nicht an. Die Spec nennt dafür keinen Text.
- L10 Fall 4b steht in `zoom-laufzeit.test.ts`, weil `kindPfad`/`pfadVarianten` in `laufzeit.ts` liegen (Spec 12.2 führt ihn in der Kern-Tabelle).
- L11 Ein neuer Beitritt mit eingegebenen Daten (nicht „Erneut beitreten“) leert die Soll-Liste; „Erneut beitreten“ behält sie. Die Spec sagt nur, dass sie bei „Erneut“ bleibt.
- L12 Zusätzliche Testdateien `zoom-teile.test.ts` und `after-pack.test.mjs` im `selftest`-Skript (über Spec 10.2 hinaus); `control-state.test.ts` hängt 4b an. `teilnehmer.ts`/`soll.ts` (und in Aufgabe 16 `einstellungen.ts`) sind neue reine Module unter `src/main/zoom/` (Spec 5.1 nennt nur `kern.ts`), damit die reinen Teile getrennt testbar sind.
- L13 Der interne Bau behält Version 0.1.0 (Bump erst im Release, 4b). Abnahme-Schritt 1 „Version sichtbar“ zeigt dann 0.1.0.
- L14 `packages/zoom-bridge/build/Release/zoom-bridge.exe` fehlt im Worktree (liegt nur im Haupt-Checkout). Aufgaben 19/20 brauchen `npm run rebuild -w @jm/zoom-bridge` mit `ZOOM_SDK_DIR` und `NDI_SDK_DIR` auf dem Entwicklungs-PC.
- L15 `bridge.ts` berechnet beim Laden `dirname(fileURLToPath(import.meta.url))`; im CJS-Bündel von electron-vite muss das ersetzt sein (Prüfschritt in Aufgabe 16). Scheitert er, braucht es ein `define` wie `build-release.mjs:310-313`. (Aufgabe 16 hat gemessen: electron-vite 2.3 ersetzt `import.meta.url` selbst, ein `define` ist nicht nötig.)
- L16 Attrappe: Reihenfolge beim Weggang wie das Original (`left`, `video black`, `audio off`); die Spec schreibt „zuerst `audio off`/`video black`“ (gemeint: vor der Rückkehr).
- L17 macOS: Die Hülle legt keinen Kern an und registriert keine Zoom-IPC-Kanäle; `AppStatus.zoom === null`; die Karte rendert nur bei `platform === 'win32'`. Die Spec nennt Z0 nur für Texte.
- L18 Spawn-Fehler außer `ENOENT`/`EACCES`/`EPERM` gehen als B2 mit ihrem Code hinaus.
- L19 Spec 9 Punkt 8 „in `warteraum` leer mit Hinweis“ nennt keinen Hinweistext; die Karte zeigt dort nur die Statuszeile Z5a/Z5b.
- L20 `jmconnect.d.ts` braucht keine Änderung (bezieht `JmConnectApi` aus `types.ts`); Spec 5.1 führt sie als geändert.
- L21 `npm install --ignore-scripts` ändert `package-lock.json`; ohne den Lock-Commit scheitert `npm ci` in der CI.
- L22 Die Aufgaben 10–15 schreiben dieselbe Datei `kern.ts` und dieselbe Testdatei fort; sie müssen in dieser Reihenfolge laufen. Die reinen Teile (Teilnehmer, Soll-Liste, Texte, Laufzeit) liegen deshalb in eigenen Modulen (Aufgaben 5–9).
- L23 Ablageort dieses Plans: `docs/superpowers/plans/2026-10-02-zoom-stage4a-connect.md`.
- L24 `kern.beenden` wartet auf eine abgebrochene SDK-Kopie, bis `richteEin` `<ziel>.teil` gelöscht hat (Spec 6.1), höchstens `fristMs`. Läuft die Frist dabei ab, steht `[zoom] SDK-Kopie nicht rechtzeitig abgebrochen` im Log; die Spec nennt nur die Logzeile für die Bridge (6.6). Das `.teil` einer so abgerissenen Kopie löscht erst die nächste Einrichtung (`richteEin` räumt es vor dem Kopieren weg).

---

## Aufgaben

Reihenfolge: 1 → 20. „Aufgabe N“ im Text ist die Überschrift „Task N“. Abhängigkeiten, die nicht aus der Nummer folgen: Aufgabe 19 baut auf Aufgabe 4 (Wächter) und dem `selftest`-Skript nach Aufgabe 10 auf; Aufgabe 20 braucht Aufgabe 19. Die Vorher-Ausschnitte jeder Aufgabe setzen den Stand nach allen vorigen Aufgaben voraus.

---

### Task 1: Bridge: `src/sdk.ts` (SDK-Fassung, PE-Leser, SDK-Ordnersuche)

**Spec:** `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md` Abschnitte 5.1 (Zeile `packages/zoom-bridge/src/sdk.ts`), 3.3 (SDK im JM-Bestand), 6.1 „SDK-Ordner wählen“ Schritte 3–4, 12.1 Nr. 1–2.

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\suite-sofort-fixes` (Branch `feat/zoom-stage4-connect`). Alle Pfade unten relativ dazu.

**Files:**
- Create: `packages/zoom-bridge/src/sdk.ts`
- Modify: `packages/zoom-bridge/src/index.ts`
  - Zeile 5 (`export { initialSession, … } from './state.ts';`): darunter eine Exportzeile für `./sdk.ts` (Exportblock Zeilen 3–17)
- Modify: `packages/zoom-bridge/package.json`
  - Zeilen 7–12 (`exports`): Eintrag `"./sdk": "./src/sdk.ts"`
- Test: `packages/zoom-bridge/test/selftest.ts`
  - Zeile 24 (`import { withNdiRuntimeOnPath } …`): darunter zwei Importzeilen (Importblock Zeilen 4–27)
  - neuer Block direkt vor der Schlusszeile 2039 (`console.log(failures === 0 ? '\nAlle Selbsttests bestanden.' : …);`)

Zeilenangaben gelten für den Stand vor dieser Aufgabe (Branch-Spitze `5cab469dc6`). Maßgeblich ist immer der wortgleiche Vorher-Text.

Der Bridge-Selbsttest läuft mit `node --experimental-strip-types` (reines Typ-Entfernen, keine Umschreibung): keine Parameter-Properties, keine `enum`, Importe mit `.ts`-Endung. Testhilfe dort: `assert(cond: boolean, name: string)`, Zähler `failures`, Ausgabe `  ok  <name>` bzw. `FAIL  <name>`.

**Interfaces:**
- Consumes: keine (erste Aufgabe).
- Produces (exakt so, Aufgaben 3, 7, 8, 10, 11 bauen darauf):
  ```ts
  // packages/zoom-bridge/src/sdk.ts — einziger Import: join aus 'node:path'; kein fs, kein Buffer
  export const SDK_FASSUNG = '7.1.5.43953';
  export const SDK_FASSUNG_BRIDGE = '7.1.5 (43953)';
  export const PE_MASCHINE_X64 = 0x8664;
  export const PE_MASCHINE_X86 = 0x014c;
  export interface PeInfo { maschine: 'x64' | 'x86' | 'andere'; maschinenTyp: number; fassung: string | null }
  /** Wirft new Error('Keine PE-Datei (Signatur PE\\0\\0 fehlt).') bei Puffer < 0x40, e_lfanew + 6 > Länge oder fehlender Signatur. */
  export function peInfo(buf: Uint8Array): PeInfo;
  /** Prüft der Reihe nach <gewaehlt>\sdk.dll, <gewaehlt>\bin\sdk.dll, <gewaehlt>\x64\bin\sdk.dll; liefert den ORDNER der ersten Fundstelle, sonst null. */
  export function findeSdkBin(gewaehlt: string, gibtEs: (pfad: string) => boolean): string | null;
  // packages/zoom-bridge/src/index.ts zusätzlich:
  export { SDK_FASSUNG, SDK_FASSUNG_BRIDGE, peInfo, findeSdkBin, type PeInfo } from './sdk.ts';
  // packages/zoom-bridge/package.json "exports": "./sdk": "./src/sdk.ts"  (Connect importiert '@jm/zoom-bridge/sdk')
  ```

**Regeln für diese Aufgabe:** Global Constraints G1, G7 (nichts unter `packages/zoom-bridge/native/**`, `CMakeLists.txt`), G13, G14 (CRLF: Änderungen mit dem Edit-Werkzeug, Vorher-Text exakt), G15.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`packages/zoom-bridge/test/selftest.ts`)

Ersetzung 1 (Zeilen 24–25), Vorher:
```ts
import { withNdiRuntimeOnPath } from '../src/ndi-path.ts';
import { tmpdir } from 'node:os';
```
Nachher:
```ts
import { withNdiRuntimeOnPath } from '../src/ndi-path.ts';
import { PE_MASCHINE_X64, PE_MASCHINE_X86, SDK_FASSUNG, SDK_FASSUNG_BRIDGE, findeSdkBin, peInfo } from '../src/sdk.ts';
import * as paket from '../src/index.ts';
import { tmpdir } from 'node:os';
```

Ersetzung 2 (Schlusszeile, Zeile 2039), Vorher:
```ts
console.log(failures === 0 ? '\nAlle Selbsttests bestanden.' : `\n${failures} Selbsttest(s) fehlgeschlagen.`);
```
Nachher:
```ts
// --- Stage 4: SDK-Fassung, PE-Leser, SDK-Ordnersuche (Spec 12.1 Nr. 1-2) -------

console.log('\nsdk — Fassung, PE-Leser, SDK-Ordnersuche (Stage 4):');
{
  /**
   * Kleinste PE-Datei, die peInfo lesen kann: "MZ", e_lfanew = 0x80, dort
   * "PE\0\0" und der Maschinentyp; mit `fassung` zusaetzlich VS_FIXEDFILEINFO
   * (Signatur BD 04 EF FE bei 0x100, dwFileVersionMS bei 0x108, LS bei 0x10c).
   */
  function machePe(maschine: number, fassung: [number, number, number, number] | null): Uint8Array {
    const buf = new Uint8Array(0x200);
    const dv = new DataView(buf.buffer);
    buf.set([0x4d, 0x5a], 0);
    dv.setUint32(0x3c, 0x80, true);
    buf.set([0x50, 0x45, 0, 0], 0x80);
    dv.setUint16(0x84, maschine, true);
    if (fassung) {
      const [a, b, c, d] = fassung;
      buf.set([0xbd, 0x04, 0xef, 0xfe], 0x100);
      dv.setUint32(0x108, ((a << 16) | b) >>> 0, true);
      dv.setUint32(0x10c, ((c << 16) | d) >>> 0, true);
    }
    return buf;
  }
  /** Meldung des geworfenen Fehlers, '' wenn nichts geworfen wurde. */
  const wirft = (f: () => unknown): string => {
    try {
      f();
      return '';
    } catch (e) {
      return (e as Error).message;
    }
  };

  assert(SDK_FASSUNG === '7.1.5.43953', 'SDK_FASSUNG ist 7.1.5.43953');
  assert(SDK_FASSUNG_BRIDGE === '7.1.5 (43953)', 'SDK_FASSUNG_BRIDGE ist "7.1.5 (43953)" (so meldet es ready.sdkVersion)');
  assert(PE_MASCHINE_X64 === 0x8664 && PE_MASCHINE_X86 === 0x014c, 'Maschinentypen: x64 = 0x8664, x86 = 0x014c');

  const x64 = peInfo(machePe(0x8664, [7, 1, 5, 43953]));
  assert(x64.maschine === 'x64' && x64.maschinenTyp === 0x8664 && x64.fassung === '7.1.5.43953', 'x64 + 7.1.5.43953 wird erkannt');
  const x86 = peInfo(machePe(0x014c, [7, 1, 5, 43953]));
  assert(x86.maschine === 'x86' && x86.maschinenTyp === 0x014c, '0x014c ist x86 (32-Bit-SDK, Text S2)');
  const arm = peInfo(machePe(0xaa64, null));
  assert(arm.maschine === 'andere' && arm.maschinenTyp === 0xaa64, 'ein anderer Maschinentyp heisst "andere" und behaelt seinen Wert');
  assert(peInfo(machePe(0x8664, null)).fassung === null, 'ohne Versionsressource: fassung null (Text S3b)');
  assert(peInfo(machePe(0x8664, [65535, 2, 65535, 4])).fassung === '65535.2.65535.4', 'Fassungsteile ueber 32767 werden vorzeichenlos gelesen');

  // Ein Buffer aus readFileSync ist oft ein Ausschnitt mit byteOffset > 0: peInfo
  // muss ab dem Anfang DIESER Datei lesen, nicht ab dem Anfang des Speichers.
  const roh = machePe(0x8664, [7, 1, 5, 43953]);
  const versetzt = new Uint8Array(roh.length + 7);
  versetzt.set(roh, 7);
  assert(peInfo(versetzt.subarray(7)).fassung === '7.1.5.43953', 'ein Ausschnitt mit byteOffset wird richtig gelesen');

  const ohnePe = machePe(0x8664, [7, 1, 5, 43953]);
  ohnePe.set([0x50, 0x58], 0x80); // "PX\0\0"
  assert(wirft(() => peInfo(ohnePe)) === 'Keine PE-Datei (Signatur PE\\0\\0 fehlt).', 'ohne "PE\\0\\0": Fehler mit fester Meldung');
  assert(wirft(() => peInfo(new Uint8Array(0x20))) !== '', 'ein 0x20-Byte-Puffer wirft');
  const zuWeit = machePe(0x8664, null);
  new DataView(zuWeit.buffer).setUint32(0x3c, 0x1fe, true);
  assert(wirft(() => peInfo(zuWeit)) !== '', 'e_lfanew hinter dem Dateiende wirft');

  // findeSdkBin: der Bediener waehlt die SDK-Wurzel, x64 oder x64\bin (Spec 6.1 Schritt 3).
  const w = join(tmpdir(), 'jm-sdk-probe');
  const bin = join(w, 'x64', 'bin');
  const da = (...pfade: string[]) => {
    const s = new Set(pfade);
    return (p: string) => s.has(p);
  };
  const nurBin = da(join(bin, 'sdk.dll'));
  assert(findeSdkBin(w, nurBin) === bin, 'Wurzel gewaehlt -> x64\\bin');
  assert(findeSdkBin(join(w, 'x64'), nurBin) === bin, 'x64 gewaehlt -> x64\\bin');
  assert(findeSdkBin(bin, nurBin) === bin, 'x64\\bin gewaehlt -> derselbe Ordner');
  assert(findeSdkBin(join(w, 'leer'), da()) === null, 'leerer Ordner -> null (Text S1)');
  assert(findeSdkBin(w, da(join(w, 'sdk.dll'), join(bin, 'sdk.dll'))) === w, 'Reihenfolge: sdk.dll direkt im gewaehlten Ordner gewinnt');

  // Die oeffentliche Flaeche: src/index.ts und der Paket-Export "./sdk".
  assert(paket.SDK_FASSUNG === SDK_FASSUNG && paket.SDK_FASSUNG_BRIDGE === SDK_FASSUNG_BRIDGE,
    'src/index.ts exportiert SDK_FASSUNG und SDK_FASSUNG_BRIDGE');
  assert(paket.peInfo === peInfo && paket.findeSdkBin === findeSdkBin, 'src/index.ts exportiert peInfo und findeSdkBin');
  const ueberExport = (await import('@jm/zoom-bridge/sdk')) as { SDK_FASSUNG?: string };
  assert(ueberExport.SDK_FASSUNG === SDK_FASSUNG, 'package.json exportiert "./sdk" (Selbstbezug @jm/zoom-bridge/sdk)');
}

console.log(failures === 0 ? '\nAlle Selbsttests bestanden.' : `\n${failures} Selbsttest(s) fehlgeschlagen.`);
```
Hinweise: `join` kommt aus dem bestehenden Import in Zeile 820 (`import { dirname, join } from 'node:path';`), `tmpdir` aus Zeile 25 — ES-Importe sind gehoben, beide sind im neuen Block verfügbar. `import('@jm/zoom-bridge/sdk')` ist ein Selbstbezug über den Paketnamen: Node löst ihn über das `exports`-Feld der eigenen `package.json` auf (prüft damit den neuen Export, ohne `node_modules`).

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/zoom-bridge
```
Erwartet: Node bricht vor dem ersten Test ab, npm meldet einen Fehler-Exitcode:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\packages\zoom-bridge\src\sdk.ts' imported from …\packages\zoom-bridge\test\selftest.ts
```

- [ ] **Step 3: `src/sdk.ts` anlegen** (`packages/zoom-bridge/src/sdk.ts`, neue Datei)

```ts
// Was JM Connect ueber das Zoom-SDK wissen muss, bevor es eine Datei daraus
// anfasst (Spec Stage 4, Abschnitte 3.3, 5.1, 6.1 Schritte 3-4).
//
// SCHNITT: kein fs, kein Buffer. peInfo() bekommt die Bytes, findeSdkBin() bekommt
// die Frage "gibt es diese Datei?" als Funktion - beides ist darum ohne SDK und
// ohne Windows pruefbar (test/selftest.ts erzeugt die PE-Puffer selbst).
import { join } from 'node:path';

/** Die einzige SDK-Fassung, mit der diese Bridge gebaut und abgenommen ist (E6). */
export const SDK_FASSUNG = '7.1.5.43953';
/** Dieselbe Fassung, wie die Bridge sie im ready-Ereignis meldet (sdkVersion). */
export const SDK_FASSUNG_BRIDGE = '7.1.5 (43953)';

/** IMAGE_FILE_MACHINE_AMD64 im COFF-Kopf. */
export const PE_MASCHINE_X64 = 0x8664;
/** IMAGE_FILE_MACHINE_I386 im COFF-Kopf - das 32-Bit-SDK (Text S2). */
export const PE_MASCHINE_X86 = 0x014c;

export interface PeInfo {
  maschine: 'x64' | 'x86' | 'andere';
  /** Der rohe Wert aus dem COFF-Kopf, fuer Meldungen ueber 'andere'. */
  maschinenTyp: number;
  /** Dateifassung "a.b.c.d" aus VS_FIXEDFILEINFO; null ohne Versionsressource (Text S3b). */
  fassung: string | null;
}

/**
 * Liest Maschinentyp und Dateifassung aus einer PE-Datei (DLL/EXE).
 * Wirft, wenn `buf` keine PE-Datei ist - ein Ordner mit einer kaputten oder
 * fremden sdk.dll ist kein SDK, und "keine Fassung" waere dort eine Luege.
 */
export function peInfo(buf: Uint8Array): PeInfo {
  // byteOffset/byteLength sind TRAGEND: ein Buffer aus readFileSync ist bei
  // kleinen Dateien ein Ausschnitt aus Nodes gemeinsamem Pool - buf.buffer
  // beginnt dann NICHT bei Byte 0 dieser Datei.
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const keinePe = (): Error => new Error('Keine PE-Datei (Signatur PE\\0\\0 fehlt).');
  if (buf.length < 0x40) throw keinePe();
  const peKopf = dv.getUint32(0x3c, true); // e_lfanew
  if (peKopf + 6 > buf.length) throw keinePe();
  if (buf[peKopf] !== 0x50 || buf[peKopf + 1] !== 0x45 || buf[peKopf + 2] !== 0 || buf[peKopf + 3] !== 0) {
    throw keinePe();
  }
  const maschinenTyp = dv.getUint16(peKopf + 4, true);
  const maschine = maschinenTyp === PE_MASCHINE_X64 ? 'x64' : maschinenTyp === PE_MASCHINE_X86 ? 'x86' : 'andere';

  // VS_FIXEDFILEINFO beginnt mit der Signatur 0xFEEF04BD (Bytes BD 04 EF FE);
  // dwFileVersionMS folgt bei +8, dwFileVersionLS bei +12. Gelesen wie
  // scripts/build-release.mjs (dateiFassung): erste Fundstelle in der Datei.
  let fassung: string | null = null;
  for (let i = 0; i + 16 <= buf.length; i++) {
    if (buf[i] === 0xbd && buf[i + 1] === 0x04 && buf[i + 2] === 0xef && buf[i + 3] === 0xfe) {
      const ms = dv.getUint32(i + 8, true);
      const ls = dv.getUint32(i + 12, true);
      fassung = `${ms >>> 16}.${ms & 0xffff}.${ls >>> 16}.${ls & 0xffff}`;
      break;
    }
  }
  return { maschine, maschinenTyp, fassung };
}

/**
 * Sucht sdk.dll unter dem gewaehlten Ordner: direkt darin (der Bediener hat
 * x64\bin gewaehlt), in bin (er hat x64 gewaehlt) oder in x64\bin (er hat die
 * SDK-Wurzel gewaehlt). Liefert den ORDNER der ersten Fundstelle, sonst null
 * (Text S1). `gibtEs` ist im Betrieb existsSync, im Test ein Set.
 */
export function findeSdkBin(gewaehlt: string, gibtEs: (pfad: string) => boolean): string | null {
  for (const ordner of [gewaehlt, join(gewaehlt, 'bin'), join(gewaehlt, 'x64', 'bin')]) {
    if (gibtEs(join(ordner, 'sdk.dll'))) return ordner;
  }
  return null;
}
```

- [ ] **Step 4: Test laufen lassen (noch rot: Export fehlt)**

```
npm run selftest -w @jm/zoom-bridge
```
Erwartet: Die Datei wird gefunden, die PE- und Ordner-Fälle sind grün; rot sind nur die zwei Prüfungen der öffentlichen Fläche, danach bricht der Selbstbezug ab:
```
FAIL  src/index.ts exportiert SDK_FASSUNG und SDK_FASSUNG_BRIDGE
FAIL  src/index.ts exportiert peInfo und findeSdkBin
…
  code: 'ERR_PACKAGE_PATH_NOT_EXPORTED'
```

- [ ] **Step 5: `src/index.ts` exportiert die neuen Namen** (`packages/zoom-bridge/src/index.ts`, Zeilen 5–6)

Vorher:
```ts
export { initialSession, isSettled, reduce, type Session } from './state.ts';
export {
```
Nachher:
```ts
export { initialSession, isSettled, reduce, type Session } from './state.ts';
export { SDK_FASSUNG, SDK_FASSUNG_BRIDGE, peInfo, findeSdkBin, type PeInfo } from './sdk.ts';
export {
```

- [ ] **Step 6: Paket-Export `./sdk`** (`packages/zoom-bridge/package.json`, Zeilen 10–12)

Vorher:
```json
    "./state": "./src/state.ts",
    "./jwt": "./src/jwt.ts"
  },
```
Nachher:
```json
    "./state": "./src/state.ts",
    "./jwt": "./src/jwt.ts",
    "./sdk": "./src/sdk.ts"
  },
```

- [ ] **Step 7: Test laufen lassen (grün)**

```
npm run selftest -w @jm/zoom-bridge
```
Erwartet: keine Zeile `FAIL`, Exitcode 0, am Ende:
```
sdk — Fassung, PE-Leser, SDK-Ordnersuche (Stage 4):
  ok  SDK_FASSUNG ist 7.1.5.43953
  ok  SDK_FASSUNG_BRIDGE ist "7.1.5 (43953)" (so meldet es ready.sdkVersion)
  ok  Maschinentypen: x64 = 0x8664, x86 = 0x014c
  ok  x64 + 7.1.5.43953 wird erkannt
  ok  0x014c ist x86 (32-Bit-SDK, Text S2)
  ok  ein anderer Maschinentyp heisst "andere" und behaelt seinen Wert
  ok  ohne Versionsressource: fassung null (Text S3b)
  ok  Fassungsteile ueber 32767 werden vorzeichenlos gelesen
  ok  ein Ausschnitt mit byteOffset wird richtig gelesen
  ok  ohne "PE\0\0": Fehler mit fester Meldung
  ok  ein 0x20-Byte-Puffer wirft
  ok  e_lfanew hinter dem Dateiende wirft
  ok  Wurzel gewaehlt -> x64\bin
  ok  x64 gewaehlt -> x64\bin
  ok  x64\bin gewaehlt -> derselbe Ordner
  ok  leerer Ordner -> null (Text S1)
  ok  Reihenfolge: sdk.dll direkt im gewaehlten Ordner gewinnt
  ok  src/index.ts exportiert SDK_FASSUNG und SDK_FASSUNG_BRIDGE
  ok  src/index.ts exportiert peInfo und findeSdkBin
  ok  package.json exportiert "./sdk" (Selbstbezug @jm/zoom-bridge/sdk)

Alle Selbsttests bestanden.
```
(Gegen eine Kopie des Pakets vorab gemessen, Windows, Node 24.16: 425 `ok`-Zeilen, vorher 405. Laufzeit rund 13 s.)

- [ ] **Step 8: Typecheck**

```
npm run typecheck -w @jm/zoom-bridge
```
Erwartet: keine Ausgabe von `tsc`, Exitcode 0 (`tsconfig.json` schließt `test/**/*.ts` ein; der Selbstbezug `@jm/zoom-bridge/sdk` wird über `exports` aufgelöst).

- [ ] **Step 9 (nur mit echtem SDK, sonst auslassen): `peInfo` an der echten `sdk.dll`**

Nur wenn `ZOOM_SDK_DIR` auf die SDK-Wurzel 7.1.5.43953 zeigt (Git Bash):
```
node --experimental-strip-types --input-type=module -e "import { readFileSync } from 'node:fs'; import { join } from 'node:path'; import { peInfo } from './packages/zoom-bridge/src/sdk.ts'; console.log(peInfo(readFileSync(join(process.env.ZOOM_SDK_DIR, 'x64', 'bin', 'sdk.dll'))));"
```
Erwartet (Spec 3.3): `{ maschine: 'x64', maschinenTyp: 34404, fassung: '7.1.5.43953' }`. Ohne `ZOOM_SDK_DIR` gilt der Schritt als übersprungen und wird im Bericht so genannt. (Gegenprobe ohne SDK, vorab gemessen: `peInfo` der NDI-DLL `C:\Program Files\NDI\NDI 6 SDK\Bin\x64\Processing.NDI.Lib.x64.dll` liefert `x64` und `6.3.2.0`, `peInfo` einer gebauten `zoom-bridge.exe` liefert `x64` und `fassung: null`.)

- [ ] **Step 10: Commit** (Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add packages/zoom-bridge/src/sdk.ts packages/zoom-bridge/src/index.ts packages/zoom-bridge/package.json packages/zoom-bridge/test/selftest.ts
git status --short
```
Erwartet genau diese gestagten Zeilen (sonst nichts Gestagtes):
```
M  packages/zoom-bridge/package.json
M  packages/zoom-bridge/src/index.ts
A  packages/zoom-bridge/src/sdk.ts
M  packages/zoom-bridge/test/selftest.ts
```
Dann:
```
git commit -m "feat(zoom-bridge): SDK-Fassung, PE-Leser und SDK-Ordnersuche (Stage 4, src/sdk.ts)" -m "SDK_FASSUNG 7.1.5.43953 und SDK_FASSUNG_BRIDGE '7.1.5 (43953)' als einzige Quelle. peInfo liest Maschinentyp und Dateifassung (VS_FIXEDFILEINFO) aus einem Uint8Array, auch aus einem Buffer-Ausschnitt mit byteOffset, und wirft ohne PE-Signatur. findeSdkBin findet sdk.dll unter Wurzel, x64 oder x64\\bin. Export ./sdk fuer JM Connect." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Keine an der Schnittstelle. Zusätzlich getestet (über das Gerüst hinaus): Maschinentyp „andere“ (0xaa64), Fassungsteile über 32767, `Uint8Array`-Ausschnitt mit `byteOffset` (Pflicht, weil `readFileSync` kleine Dateien als Ausschnitt aus dem Pool liefert), `e_lfanew` hinter dem Dateiende, Reihenfolge der Suche, und der Paket-Export über den Selbstbezug `@jm/zoom-bridge/sdk`.
- `PE_MASCHINE_X64`/`PE_MASCHINE_X86` stehen nur in `./sdk`, nicht in `src/index.ts` (wie im Gerüst).
- Der Importblock bekommt zusätzlich `import * as paket from '../src/index.ts';` — Aufgabe 2 nutzt denselben Import für ihre Exportprüfung.

---

### Task 2: Bridge: Fehlerkatalog `FAIL_CODE_NAMES`, `failCodeName`, `failReason`, `endReason`

**Spec:** `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md` Abschnitte 5.1 (Zeile `packages/zoom-bridge/src/protocol.ts`), 3.2-10, 3.2-11, 8.3 (Vorsatz, `meldung.detail`, Zeile „Csonst“), 12.1 Nr. 3.

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\suite-sofort-fixes` (Branch `feat/zoom-stage4-connect`). Alle Pfade unten relativ dazu.

**Files:**
- Modify: `packages/zoom-bridge/src/protocol.ts`
  - Zeilen 431–448 (Kopfkommentar „Status und sein Code“ + `const FAIL_CODES`): davor `FAIL_CODE_NAMES` + `failCodeName`, `FAIL_CODES` ergänzt
  - Zeile 462 (`export function explainStatus(…)`): davor `failReason` und `endReason`; `explainStatus` selbst bleibt unverändert
- Modify: `packages/zoom-bridge/src/index.ts` (Exportblock aus `./protocol.ts`, nach Aufgabe 1 Zeilen 7–18)
- Test: `packages/zoom-bridge/test/selftest.ts`
  - Importliste aus `../src/protocol.ts` (Zeilen 5–23): vier Namen dazu
  - nach `import * as paket from '../src/index.ts';` (aus Aufgabe 1): ein `import type` aus `../src/index.ts`
  - neuer Block direkt vor der Schlusszeile (`console.log(failures === 0 ? '\nAlle Selbsttests bestanden.' : …);`), also hinter dem Block aus Aufgabe 1

Zeilenangaben gelten für den Stand vor Aufgabe 1 (Branch-Spitze `5cab469dc6`); nach Aufgabe 1 verschieben sie sich in `selftest.ts` und `index.ts`. Maßgeblich ist immer der wortgleiche Vorher-Text.

`protocol.ts` bleibt **ohne jeden Import** (G8: der Renderer-tsconfig von Connect prüft die Typen daraus mit). `FAIL_CODES` und `END_REASONS` bleiben unexportiert; ihre deutschen Texte bleiben in ASCII-Umschrift („eingeschraenkt“) wie bisher.

**Interfaces:**
- Consumes: Aufgabe 1 — `src/index.ts` mit der Exportzeile `export { SDK_FASSUNG, … } from './sdk.ts';` und der Testimport `import * as paket from '../src/index.ts';` in `selftest.ts`.
- Produces (exakt so, Aufgaben 5, 6, 11–15 bauen darauf):
  ```ts
  // packages/zoom-bridge/src/protocol.ts
  export const FAIL_CODE_NAMES: Record<number, string>;   // alle 46 Werte von enum MeetingFailCode
  export function failCodeName(code: number): string;      // unbekannt → `MEETING_FAIL_CODE_${code}`, z. B. 4242 → 'MEETING_FAIL_CODE_4242'
  export function failReason(code: number): string;        // FAIL_CODES[code] ?? 'unbekannter Grund' — OHNE Vorsatz
  export function endReason(code: number): string;         // END_REASONS[code] ?? `Grund ${code}` — OHNE Vorsatz
  // explainStatus(status, code) unverändert ('gescheitert: …' / 'beendet: …')
  // packages/zoom-bridge/src/index.ts zusätzlich:
  //   FAIL_CODE_NAMES, failCodeName, failReason, endReason,
  //   type AudioReason, type AudioState, type VideoReason, type VideoState
  //   (authResultName, type UserRoleName waren schon exportiert)
  ```

**Regeln für diese Aufgabe:** Global Constraints G7, G8, G13, G14, G15. Die deutschen Kurztexte für 11, 14–16, 23, 60–64, 82, 88, 89, 500–506 sind ein Vorschlag des Plans (Lücke L2 des Gerüsts); die Spec verlangt sie, nennt sie aber nicht wörtlich. Sichtbar im Connect-Klartext wird davon nur, was über „Csonst“ (Spec 8.3) läuft, also 11 und 15.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`packages/zoom-bridge/test/selftest.ts`)

Ersetzung 1 (Importliste aus `../src/protocol.ts`, Zeilen 8–10), Vorher:
```ts
  enrich,
  explainStatus,
  normalizeMeetingId,
```
Nachher:
```ts
  enrich,
  explainStatus,
  endReason,
  failCodeName,
  failReason,
  FAIL_CODE_NAMES,
  normalizeMeetingId,
```

Ersetzung 2 (die Zeile aus Aufgabe 1 und die folgende), Vorher:
```ts
import * as paket from '../src/index.ts';
import { tmpdir } from 'node:os';
```
Nachher:
```ts
import * as paket from '../src/index.ts';
import type {
  AudioReason as PaketAudioReason,
  AudioState as PaketAudioState,
  VideoReason as PaketVideoReason,
  VideoState as PaketVideoState,
} from '../src/index.ts';
import { tmpdir } from 'node:os';
```

Ersetzung 3 (Schlusszeile), Vorher:
```ts
console.log(failures === 0 ? '\nAlle Selbsttests bestanden.' : `\n${failures} Selbsttest(s) fehlgeschlagen.`);
```
Nachher:
```ts
// --- Stage 4: Fehlerkatalog fuer die Klartexte in JM Connect (Spec 12.1 Nr. 3) ---

console.log('\nprotocol — Fehlerkatalog Stage 4:');
{
  // SDK-Namen woertlich aus meeting_service_interface.h - die vier, an denen
  // die harte Grenze "nur eigenes Zoom-Konto" haengt (E3, Spec 8.3), und 11,
  // der in FAIL_CODES fehlte.
  assert(failCodeName(63) === 'MEETING_FAIL_UNABLE_TO_JOIN_EXTERNAL_MEETING', 'failCodeName(63)');
  assert(failCodeName(11) === 'MEETING_FAIL_NO_MMR', 'failCodeName(11)');
  assert(failCodeName(64) === 'MEETING_FAIL_BLOCKED_BY_ACCOUNT_ADMIN', 'failCodeName(64)');
  assert(failCodeName(82) === 'MEETING_FAIL_NEED_SIGN_IN_FOR_PRIVATE_MEETING', 'failCodeName(82)');
  assert(failCodeName(503) === 'MEETING_FAIL_USER_LEVEL_TOKEN_NOT_HAVE_HOST_ZAK_OBF', 'failCodeName(503)');
  assert(failCodeName(504) === 'MEETING_FAIL_APP_CAN_NOT_ANONYMOUS_JOIN_MEETING', 'failCodeName(504)');
  assert(failCodeName(0) === 'MEETING_SUCCESS' && failCodeName(0xffff) === 'MEETING_FAIL_UNKNOWN', 'failCodeName(0) und (0xffff)');
  assert(failCodeName(4242) === 'MEETING_FAIL_CODE_4242', 'ein unbekannter Code wird nicht gerundet: MEETING_FAIL_CODE_4242');
  const namen = Object.values(FAIL_CODE_NAMES);
  assert(Object.keys(FAIL_CODE_NAMES).length === 46, 'FAIL_CODE_NAMES hat alle 46 Werte von enum MeetingFailCode');
  assert(new Set(namen).size === namen.length, 'kein MeetingFailCode-Name kommt zweimal vor');

  // failReason/endReason: der deutsche Grund OHNE Vorsatz (Spec 8.3 "Csonst").
  assert(failReason(11) === 'kein Medienserver gefunden', 'failReason(11) ist deutsch');
  assert(!failReason(11).startsWith('gescheitert'), 'failReason traegt keinen Vorsatz "gescheitert: "');
  assert(failReason(2) === 'Wiederverbinden fehlgeschlagen', 'failReason(2) wie bisher');
  assert(failReason(9999) === 'unbekannter Grund', 'failReason eines unbekannten Codes: "unbekannter Grund"');
  const neu = [11, 14, 15, 16, 23, 60, 61, 62, 63, 64, 82, 88, 89, 500, 501, 502, 503, 504, 505, 506];
  assert(neu.every((c) => failReason(c) !== 'unbekannter Grund'), 'FAIL_CODES kennt 11, 14-16, 23, 60-64, 82, 88, 89, 500-506');
  assert(endReason(2) === 'vom Gastgeber beendet', 'endReason(2)');
  assert(endReason(99) === 'Grund 99', 'endReason eines unbekannten Grundes: "Grund 99"');

  // explainStatus bleibt, wie es war (Konsole und Bridge-Log lesen es weiter).
  assert(explainStatus('failed', 4) === 'gescheitert: falscher Kenncode', 'explainStatus(failed, 4) unveraendert');
  assert(explainStatus('ended', 2) === 'beendet: vom Gastgeber beendet', 'explainStatus(ended, 2) unveraendert');
  assert(explainStatus('failed', 4242) === 'gescheitert: Fehlerschluessel 4242', 'explainStatus: unbekannter Code wie bisher');

  // Die oeffentliche Flaeche (src/index.ts), aus der JM Connect liest.
  assert(
    paket.FAIL_CODE_NAMES === FAIL_CODE_NAMES && paket.failCodeName === failCodeName && paket.failReason === failReason && paket.endReason === endReason,
    'src/index.ts exportiert FAIL_CODE_NAMES, failCodeName, failReason, endReason',
  );
  const typen: [PaketAudioState, PaketAudioReason, PaketVideoState, PaketVideoReason] = ['off', 'participantLeft', 'black', 'participantLeft'];
  assert(typen.length === 4, 'src/index.ts exportiert die Typen AudioState, AudioReason, VideoState, VideoReason (prueft tsc)');
}

console.log(failures === 0 ? '\nAlle Selbsttests bestanden.' : `\n${failures} Selbsttest(s) fehlgeschlagen.`);
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/zoom-bridge
```
Erwartet: Node bricht beim Binden der Importe ab, npm meldet einen Fehler-Exitcode:
```
SyntaxError: The requested module '../src/protocol.ts' does not provide an export named 'FAIL_CODE_NAMES'
```
Zusätzlich rot (Typen):
```
npm run typecheck -w @jm/zoom-bridge
```
Erwartet u. a.:
```
test/selftest.ts(…): error TS2305: Module '"../src/protocol.ts"' has no exported member 'endReason'.
test/selftest.ts(…): error TS2305: Module '"../src/index.ts"' has no exported member 'AudioReason'.
```

- [ ] **Step 3: `FAIL_CODE_NAMES`, `failCodeName` und `FAIL_CODES` ergänzen** (`packages/zoom-bridge/src/protocol.ts`, Zeilen 433–448)

Vorher:
```ts
// MeetingFailCode bei FAILED, EndMeetingReason bei ENDED. Sonst nichts Verwertbares.
const FAIL_CODES: Record<number, string> = {
  1: 'Verbindungsfehler',
  2: 'Wiederverbinden fehlgeschlagen',
  3: 'MMR-Fehler',
  4: 'falscher Kenncode',
  5: 'Sitzungsfehler',
  6: 'das Meeting ist vorbei',
  7: 'das Meeting hat noch nicht begonnen',
  8: 'dieses Meeting gibt es nicht',
  9: 'das Meeting ist voll',
  10: 'Client zu alt',
  12: 'das Meeting ist gesperrt',
  13: 'das Meeting ist eingeschraenkt',
  0xffff: 'unbekannter Grund',
};
```
Nachher:
```ts
// MeetingFailCode bei FAILED, EndMeetingReason bei ENDED. Sonst nichts Verwertbares.

// Woertlich aus meeting_service_interface.h (enum MeetingFailCode, SDK 7.1.5.43953,
// x64\zoom_sdk_c_sharp_wrap\h, Zeilen 57-150): ALLE 46 Werte, auch die hinter den
// Luecken der Zaehlung. JM Connect nennt den Namen in meldung.detail, etwa
// "MEETING_FAIL_UNABLE_TO_JOIN_EXTERNAL_MEETING (63)" - nie im grossen Text.
export const FAIL_CODE_NAMES: Record<number, string> = {
  0: 'MEETING_SUCCESS',
  1: 'MEETING_FAIL_CONNECTION_ERR',
  2: 'MEETING_FAIL_RECONNECT_ERR',
  3: 'MEETING_FAIL_MMR_ERR',
  4: 'MEETING_FAIL_PASSWORD_ERR',
  5: 'MEETING_FAIL_SESSION_ERR',
  6: 'MEETING_FAIL_MEETING_OVER',
  7: 'MEETING_FAIL_MEETING_NOT_START',
  8: 'MEETING_FAIL_MEETING_NOT_EXIST',
  9: 'MEETING_FAIL_MEETING_USER_FULL',
  10: 'MEETING_FAIL_CLIENT_INCOMPATIBLE',
  11: 'MEETING_FAIL_NO_MMR',
  12: 'MEETING_FAIL_CONFLOCKED',
  13: 'MEETING_FAIL_MEETING_RESTRICTED',
  14: 'MEETING_FAIL_MEETING_RESTRICTED_JBH',
  15: 'MEETING_FAIL_CANNOT_EMIT_WEBREQUEST',
  16: 'MEETING_FAIL_CANNOT_START_TOKENEXPIRE',
  17: 'SESSION_VIDEO_ERR',
  18: 'SESSION_AUDIO_AUTOSTARTERR',
  19: 'MEETING_FAIL_REGISTERWEBINAR_FULL',
  20: 'MEETING_FAIL_REGISTERWEBINAR_HOSTREGISTER',
  21: 'MEETING_FAIL_REGISTERWEBINAR_PANELISTREGISTER',
  22: 'MEETING_FAIL_REGISTERWEBINAR_DENIED_EMAIL',
  23: 'MEETING_FAIL_ENFORCE_LOGIN',
  24: 'CONF_FAIL_ZC_CERTIFICATE_CHANGED',
  27: 'CONF_FAIL_VANITY_NOT_EXIST',
  28: 'CONF_FAIL_JOIN_WEBINAR_WITHSAMEEMAIL',
  29: 'CONF_FAIL_DISALLOW_HOST_MEETING',
  50: 'MEETING_FAIL_WRITE_CONFIG_FILE',
  60: 'MEETING_FAIL_FORBID_TO_JOIN_INTERNAL_MEETING',
  61: 'CONF_FAIL_REMOVED_BY_HOST',
  62: 'MEETING_FAIL_HOST_DISALLOW_OUTSIDE_USER_JOIN',
  63: 'MEETING_FAIL_UNABLE_TO_JOIN_EXTERNAL_MEETING',
  64: 'MEETING_FAIL_BLOCKED_BY_ACCOUNT_ADMIN',
  82: 'MEETING_FAIL_NEED_SIGN_IN_FOR_PRIVATE_MEETING',
  88: 'MEETING_FAIL_NEED_CONFIRM_PLINK',
  89: 'MEETING_FAIL_NEED_INPUT_PLINK',
  500: 'MEETING_FAIL_APP_PRIVILEGE_TOKEN_ERROR',
  501: 'MEETING_FAIL_AUTHORIZED_USER_NOT_INMEETING',
  502: 'MEETING_FAIL_ON_BEHALF_TOKEN_CONFLICT_LOGIN_ERROR',
  503: 'MEETING_FAIL_USER_LEVEL_TOKEN_NOT_HAVE_HOST_ZAK_OBF',
  504: 'MEETING_FAIL_APP_CAN_NOT_ANONYMOUS_JOIN_MEETING',
  505: 'MEETING_FAIL_ON_BEHALF_TOKEN_INVALID',
  506: 'MEETING_FAIL_ON_BEHALF_TOKEN_NOT_MATCH_MEETING',
  1143: 'MEETING_FAIL_JMAK_USER_EMAIL_NOT_MATCH',
  0xffff: 'MEETING_FAIL_UNKNOWN',
};

export function failCodeName(code: number): string {
  // Wie sdkErrorName: NIE auf den naechstaehnlichen runden.
  return FAIL_CODE_NAMES[code] ?? `MEETING_FAIL_CODE_${code}`;
}

// Deutsche Gruende, ohne Vorsatz. 11 fehlte bis Stage 4 ("Fehlerschluessel 11"),
// 14-16, 23, 60-64, 82, 88, 89 und 500-506 kamen mit Stage 4 dazu (Spec 5.1).
const FAIL_CODES: Record<number, string> = {
  1: 'Verbindungsfehler',
  2: 'Wiederverbinden fehlgeschlagen',
  3: 'MMR-Fehler',
  4: 'falscher Kenncode',
  5: 'Sitzungsfehler',
  6: 'das Meeting ist vorbei',
  7: 'das Meeting hat noch nicht begonnen',
  8: 'dieses Meeting gibt es nicht',
  9: 'das Meeting ist voll',
  10: 'Client zu alt',
  11: 'kein Medienserver gefunden',
  12: 'das Meeting ist gesperrt',
  13: 'das Meeting ist eingeschraenkt',
  14: 'das Meeting ist eingeschraenkt (Beitritt vor dem Gastgeber)',
  15: 'Web-Anfrage nicht gesendet',
  16: 'Anmelde-Token abgelaufen',
  23: 'Anmeldung mit Zoom-Konto verlangt',
  60: 'internes Meeting, Beitritt nicht erlaubt',
  61: 'vom Gastgeber entfernt',
  62: 'Gastgeber laesst niemanden von ausserhalb zu',
  63: 'Meeting eines fremden Zoom-Kontos',
  64: 'vom Administrator des Gastgeber-Kontos gesperrt',
  82: 'Anmeldung mit dem Konto des Veranstalters verlangt',
  88: 'Meeting-Link nicht eindeutig',
  89: 'Meeting-Link im Konto nicht vorhanden',
  500: 'Fehler im Beitritts-Token der App',
  501: 'berechtigter Nutzer nicht im Meeting',
  502: 'OBF-Token widerspricht der Anmeldung',
  503: 'Nutzer-Token ohne ZAK/OBF des Gastgebers',
  504: 'App darf nicht anonym beitreten',
  505: 'OBF-Token ungueltig',
  506: 'OBF-Token passt nicht zum Meeting',
  0xffff: 'unbekannter Grund',
};
```

- [ ] **Step 4: `failReason` und `endReason`** (`packages/zoom-bridge/src/protocol.ts`, direkt vor `explainStatus`, ursprünglich Zeile 462)

Vorher:
```ts
export function explainStatus(status: MeetingStatusName, code: number): string {
```
Nachher:
```ts
/**
 * Der deutsche Grund zu einem MeetingFailCode, OHNE Vorsatz - fuer Klartexte, die
 * ihren eigenen Vorsatz tragen ("Beitritt gescheitert: ", Spec 8.3). explainStatus()
 * setzt "gescheitert: " davor und taugt dafuer nicht.
 */
export function failReason(code: number): string {
  return FAIL_CODES[code] ?? 'unbekannter Grund';
}

/** Der deutsche Grund zu einem EndMeetingReason, OHNE Vorsatz (Gegenstueck zu failReason). */
export function endReason(code: number): string {
  return END_REASONS[code] ?? `Grund ${code}`;
}

export function explainStatus(status: MeetingStatusName, code: number): string {
```
`END_REASONS` steht oberhalb (unverändert), `explainStatus` darunter bleibt Zeichen für Zeichen, wie es ist.

- [ ] **Step 5: Exporte in `src/index.ts`** (`packages/zoom-bridge/src/index.ts`, Exportblock aus `./protocol.ts`)

Vorher:
```ts
  authResultName,
  explainStatus,
  type BridgeEvent,
  type Command,
  type MeetingStatusName,
  type Participant,
  type UserRoleName,
  type WireEvent,
} from './protocol.ts';
```
Nachher:
```ts
  authResultName,
  explainStatus,
  FAIL_CODE_NAMES,
  failCodeName,
  failReason,
  endReason,
  type AudioReason,
  type AudioState,
  type BridgeEvent,
  type Command,
  type MeetingStatusName,
  type Participant,
  type UserRoleName,
  type VideoReason,
  type VideoState,
  type WireEvent,
} from './protocol.ts';
```

- [ ] **Step 6: Test laufen lassen (grün)**

```
npm run selftest -w @jm/zoom-bridge
```
Erwartet: keine Zeile `FAIL`, Exitcode 0, am Ende:
```
protocol — Fehlerkatalog Stage 4:
  ok  failCodeName(63)
  ok  failCodeName(11)
  ok  failCodeName(64)
  ok  failCodeName(82)
  ok  failCodeName(503)
  ok  failCodeName(504)
  ok  failCodeName(0) und (0xffff)
  ok  ein unbekannter Code wird nicht gerundet: MEETING_FAIL_CODE_4242
  ok  FAIL_CODE_NAMES hat alle 46 Werte von enum MeetingFailCode
  ok  kein MeetingFailCode-Name kommt zweimal vor
  ok  failReason(11) ist deutsch
  ok  failReason traegt keinen Vorsatz "gescheitert: "
  ok  failReason(2) wie bisher
  ok  failReason eines unbekannten Codes: "unbekannter Grund"
  ok  FAIL_CODES kennt 11, 14-16, 23, 60-64, 82, 88, 89, 500-506
  ok  endReason(2)
  ok  endReason eines unbekannten Grundes: "Grund 99"
  ok  explainStatus(failed, 4) unveraendert
  ok  explainStatus(ended, 2) unveraendert
  ok  explainStatus: unbekannter Code wie bisher
  ok  src/index.ts exportiert FAIL_CODE_NAMES, failCodeName, failReason, endReason
  ok  src/index.ts exportiert die Typen AudioState, AudioReason, VideoState, VideoReason (prueft tsc)

Alle Selbsttests bestanden.
```
Die bestehende Gruppe „protocol — code bedeutet je nach status etwas anderes“ bleibt grün. (Vorab an einer Kopie gemessen, Windows: 447 `ok`-Zeilen.)

- [ ] **Step 7: Typecheck**

```
npm run typecheck -w @jm/zoom-bridge
```
Erwartet: keine Ausgabe von `tsc`, Exitcode 0.

- [ ] **Step 8 (nur mit echtem SDK, sonst auslassen): Namen gegen den SDK-Kopf prüfen**

Nur wenn `ZOOM_SDK_DIR` auf die SDK-Wurzel 7.1.5.43953 zeigt; in Git Bash aus der Worktree-Wurzel:
```
node --experimental-strip-types --input-type=module <<'EOF'
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FAIL_CODE_NAMES } from './packages/zoom-bridge/src/protocol.ts';
const kopf = readFileSync(join(process.env.ZOOM_SDK_DIR, 'x64', 'zoom_sdk_c_sharp_wrap', 'h', 'meeting_service_interface.h'), 'utf8');
const rumpf = /enum\s+MeetingFailCode\s*\{([\s\S]*?)\}/.exec(kopf)[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const sdk = {};
let n = -1;
for (const teil of rumpf.split(',')) {
  const [name, wert] = teil.split('=').map((s) => s.trim());
  if (!name) continue;
  n = wert === undefined ? n + 1 : Number(wert);
  sdk[n] = name;
}
const abweichend = Object.entries(sdk).filter(([k, v]) => FAIL_CODE_NAMES[k] !== v);
const nurBeiUns = Object.keys(FAIL_CODE_NAMES).filter((k) => !(k in sdk));
console.log(`SDK: ${Object.keys(sdk).length} Werte, abweichend: ${JSON.stringify(abweichend)}, nur bei uns: ${JSON.stringify(nurBeiUns)}`);
EOF
```
Erwartet: `SDK: 46 Werte, abweichend: [], nur bei uns: []`. Ohne `ZOOM_SDK_DIR` gilt der Schritt als übersprungen und wird im Bericht so genannt (die Namen stammen dann aus der Spec 5.1 bzw. dem Gerüst).

- [ ] **Step 9: Commit** (Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add packages/zoom-bridge/src/protocol.ts packages/zoom-bridge/src/index.ts packages/zoom-bridge/test/selftest.ts
git status --short
```
Erwartet genau diese gestagten Zeilen:
```
M  packages/zoom-bridge/src/index.ts
M  packages/zoom-bridge/src/protocol.ts
M  packages/zoom-bridge/test/selftest.ts
```
Dann:
```
git commit -m "feat(zoom-bridge): Fehlerkatalog fuer JM Connect - FAIL_CODE_NAMES, failCodeName, failReason, endReason (Stage 4)" -m "FAIL_CODE_NAMES fuehrt alle 46 Werte von enum MeetingFailCode woertlich (63, 64, 503, 504 fuer die Grenze eigenes Zoom-Konto), failCodeName rundet nie (MEETING_FAIL_CODE_<n>). FAIL_CODES bekommt 11 und deutsche Texte fuer 14-16, 23, 60-64, 82, 88, 89, 500-506. failReason/endReason liefern den Grund ohne Vorsatz fuer die Klartexte; explainStatus bleibt unveraendert. index.ts exportiert dazu die Ton- und Bildtypen." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Keine an der Schnittstelle. Zusätzlich getestet: `failCodeName(0)`/`(0xffff)`, dass jeder neue Code in `FAIL_CODES` steht, `explainStatus('failed', 4242)` unverändert mit „Fehlerschluessel“, und die Exporte über `src/index.ts` (Werte zur Laufzeit, Typen über `tsc`).
- Neuer optionaler Prüfschritt 8 (Abgleich gegen den echten SDK-Kopf), weil das SDK im Repo und auf dem Planungs-PC nicht liegt und die 46 Namen sonst nur abgeschrieben, nicht gemessen sind.

---

### Task 3: Bridge: Attrappe mit den Stellschrauben aus 12.1 Nr. 4

**Spec:** `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md` Abschnitte 12.1 Nr. 4, 3.2-17 bis 3.2-23, 5.1 (Zeile `test/fake-bridge.mjs`), 12.5 (Gegenprobe „Abgleich ohne 300-ms-Verzögerung“ braucht `black` beim Weggang und `FAKE_RUECKKEHR_MS`).

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\suite-sofort-fixes` (Branch `feat/zoom-stage4-connect`). Alle Pfade unten relativ dazu.

**Files:**
- Modify: `packages/zoom-bridge/test/fake-bridge.mjs`
  - Zeilen 86–91 (Drehbuch `envprobe`): `path` im Ereignis
  - Zeilen 144–151 (Kopfkommentar der Stellschrauben): Weggang/Rückkehr beschrieben, neuer Abschnitt „Stage 4“
  - Zeile 177 (`const abos = new Map(); …`): Kommentar zu den Feldern
  - Zeilen 196–208 (`imMeetingAnkommen`: Teilnehmer, Erlaubnis): `FAKE_DOPPELNAME`, `FAKE_ENTZUG_MS`
  - Zeilen 219–236 (`if (wiederbeitritt)`): Weggang wie das Original, `FAKE_RUECKKEHR_MS`, `FAKE_RUECKKEHR_NAME`, Umhängen nur bei exakt gleichem, eindeutigem Namen
  - Zeilen 250–255 (Ende von `imMeetingAnkommen`): `FAKE_VERBINDUNG_HAENGT_MS`
  - Zeilen 259–262 (`beitreten`, Warteraum): `FAKE_EINLASS_MS`, `FAKE_EINLASS_HAENGT`
  - Zeile 298 (`init` → `ready`): `FAKE_SDK_FASSUNG`, `FAKE_NDI_FEHLER`
  - Zeile 319 (`videoSubscribe` → `abos.set`): Felder `name`, `tonLaeuft`
- Test: `packages/zoom-bridge/test/selftest.ts` — neuer Block „Attrappe — Stellschrauben Stage 4“ direkt vor der Schlusszeile (hinter dem Block aus Aufgabe 2)

Zeilenangaben gelten für den Stand vor dieser Aufgabe (`fake-bridge.mjs` wird von Aufgabe 1 und 2 nicht berührt). Maßgeblich ist immer der wortgleiche Vorher-Text.

Die übrigen Drehbücher (`join`, `hang`, `admitstuck`, `leftclean`, `messy`, `video`, `stuck`) bleiben unverändert, ebenso alle bisherigen Stellschrauben. `FAKE_SDK_FASSUNG` wirkt nur im Drehbuch `steuerung`.

**Interfaces:**
- Consumes: Aufgabe 1 — `SDK_FASSUNG_BRIDGE` (in `selftest.ts` bereits aus `../src/sdk.ts` importiert).
- Produces (für Aufgaben 10–15 verbindlich):
  ```text
  Umgebungsvariablen der Attrappe, Drehbuch FAKE_SCRIPT=steuerung
    neu:  FAKE_SDK_FASSUNG       ready.sdkVersion (Vorgabe '7.1.5 (attrappe)'; Connect-Tests setzen '7.1.5 (43953)')
          FAKE_NDI_FEHLER=1      direkt nach ready: { ev:'error', where:'ndi', code:'ndiInitFailed' } (vor der auth-Antwort)
          FAKE_DOPPELNAME=1      16778241 heisst ebenfalls 'Anna'
          FAKE_EINLASS_MS        nur mit FAKE_WARTERAUM=1: nach so vielen ms status reconnecting, connecting, inMeeting (+ roster, privilege …)
          FAKE_EINLASS_HAENGT=1  mit FAKE_EINLASS_MS: nur reconnecting, dann Stille
          FAKE_VERBINDUNG_HAENGT_MS  so lange nach dem Ankommen: status reconnecting, dann Stille; quit meldet disconnecting, ended
          FAKE_ENTZUG_MS         so lange nach privilege canRecordRaw:true: { ev:'privilege', canRecordRaw:false, source:'broadcast' }
          FAKE_RUECKKEHR_MS      mit FAKE_WIEDERBEITRITT_MS: Abstand left → joined (Vorgabe 0 = synchron wie bisher)
          FAKE_RUECKKEHR_NAME    mit FAKE_WIEDERBEITRITT_MS: Name bei der Rückkehr (Vorgabe unverändert); abweichend → KEIN Umhängen
    weiter gültig: FAKE_SCRIPT, FAKE_AUTH_CODE, FAKE_PRIVILEGE ('ja'|'offen'|'nein'), FAKE_TEILNEHMER, FAKE_BEITRITT_MS,
          FAKE_MEETING_ENDE_MS, FAKE_SOFORT_ENDE, FAKE_INIT_FEHLER, FAKE_AUTH_SOFORTFEHLER, FAKE_ABSTURZ_MS, FAKE_WARTERAUM,
          FAKE_BEITRITT_SCHEITERT, FAKE_VERBINDUNG_WEG_MS, FAKE_WIEDERBEITRITT_MS, FAKE_ABGANG_MS, FAKE_LOGDATEI, ENV_PROBE_NAMES
  Teilnehmer-IDs: eigene Zeile 100 ('JM Connect', self:true), Fremde ab 16778240 (Anna = host, Ben, Carla …), Rückkehr unter 16778250.
  Weggang mit Abo (FAKE_WIEDERBEITRITT_MS): left → video black/participantLeft (source bleibt, rebindable) → audio off/participantLeft (nur wenn der Ton lief)
  Rückkehr: joined → (nur bei exakt gleichem Namen, je genau ein Teilnehmer und ein Abo) video subscribed/reboundByName → audio waiting/reboundByName
  Drehbuch FAKE_SCRIPT=envprobe: { ev:'envprobe', seen: Record<string, boolean>, path: string | undefined }
  ```

**Regeln für diese Aufgabe:** Global Constraints G7 (die Attrappe folgt dem nativen Teil, der bleibt unverändert), G12 (Test-Meeting-Nummer `'7'.repeat(10)`, Kenncode mit `KENNCODE-PROBE`), G13, G14, G15.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`packages/zoom-bridge/test/selftest.ts`, Schlusszeile)

Vorher:
```ts
console.log(failures === 0 ? '\nAlle Selbsttests bestanden.' : `\n${failures} Selbsttest(s) fehlgeschlagen.`);
```
Nachher:
```ts
// --- Stage 4: Attrappe mit den Stellschrauben aus Spec 12.1 Nr. 4 ---------------

/** Wartet, bis ein Ereignis `pred` erfuellt (Takt 20 ms); false nach `ms`. */
async function bisEreignis(ev: BridgeEvent[], pred: (e: BridgeEvent) => boolean, ms = 4000): Promise<boolean> {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    if (ev.some(pred)) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return false;
}

/** Passt auf ein Ereignis `name`, dessen Felder die Werte aus `felder` tragen. */
const art = (name: string, felder: Record<string, unknown> = {}) => (e: BridgeEvent): boolean =>
  e.ev === name && Object.entries(felder).every(([k, v]) => (e as Record<string, unknown>)[k] === v);

/** Stelle des ersten passenden Ereignisses, sonst -1. */
const stelle = (ev: BridgeEvent[], pred: (e: BridgeEvent) => boolean): number => ev.findIndex(pred);

/** Die Statusfolge, wie sie auf der Leitung stand. */
const statusFolge = (ev: BridgeEvent[]): string =>
  ev.filter((e) => e.ev === 'status').map((e) => (e as { status: string }).status).join(',');

/** Ein Beitritt mit synthetischer Nummer und erfundenem Kenncode (nie echte Werte). */
const BEITRITT = { cmd: 'join', meetingId: '7'.repeat(10), passcode: 'KENNCODE-PROBE-3', displayName: 'JM Connect' } as const;

/**
 * Echte Bridge gegen die Attrappe (Drehbuch "steuerung"), so wie JM Connect sie
 * fuehrt: init und auth senden, auf die Antwort warten, dann `schritte`, am Ende
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
  await b.start();
  try {
    b.send({ cmd: 'init' });
    b.send({ cmd: 'auth', jwt: 'attrappe' });
    await bisEreignis(ev, (e) => e.ev === 'auth' || art('error', { where: 'auth' })(e));
    await schritte(b, ev);
  } finally {
    await b.stop();
  }
  return ev;
}

console.log('\nAttrappe — Stellschrauben Stage 4:');
{
  // FAKE_SDK_FASSUNG: JM Connect prueft die Fassung exakt (G1) - die Attrappe muss sie liefern koennen.
  let ev = await fahreSteuerung({ FAKE_SDK_FASSUNG: '7.1.5 (43953)' }, async () => {});
  const ready = ev.find(art('ready')) as { sdkVersion?: string } | undefined;
  assert(ready?.sdkVersion === SDK_FASSUNG_BRIDGE, 'FAKE_SDK_FASSUNG bestimmt ready.sdkVersion');
  ev = await fahreSteuerung({}, async () => {});
  const vorgabe = ev.find(art('ready')) as { sdkVersion?: string } | undefined;
  assert(vorgabe?.sdkVersion === '7.1.5 (attrappe)', 'ohne FAKE_SDK_FASSUNG bleibt die Vorgabe "7.1.5 (attrappe)"');
}
{
  const ev = await fahreSteuerung({ FAKE_NDI_FEHLER: '1' }, async () => {});
  const iReady = stelle(ev, art('ready'));
  const iNdi = stelle(ev, art('error', { where: 'ndi', code: 'ndiInitFailed' }));
  assert(iReady >= 0 && iNdi === iReady + 1, 'FAKE_NDI_FEHLER: error ndi ndiInitFailed direkt nach ready');
  assert(iNdi >= 0 && stelle(ev, art('auth')) > iNdi, '... also vor der Antwort auf die Anmeldung');
  assert(ev[iNdi]?.name === 'NDI_INIT_FAILED', '... mit dem Namen NDI_INIT_FAILED');
}
{
  const ev = await fahreSteuerung({ FAKE_DOPPELNAME: '1' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('roster'));
  });
  const roster = ev.find(art('roster')) as { list?: Participant[] } | undefined;
  const annas = (roster?.list ?? []).filter((p) => !p.self && p.name === 'Anna').map((p) => p.id);
  assert(annas.join(',') === '16778240,16778241', 'FAKE_DOPPELNAME: 16778240 und 16778241 heissen beide "Anna"');
}
{
  const ev = await fahreSteuerung({ FAKE_WARTERAUM: '1', FAKE_EINLASS_MS: '100' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('status', { status: 'inMeeting' }));
  });
  assert(statusFolge(ev).startsWith('connecting,waitingRoom,reconnecting,connecting,inMeeting'),
    'FAKE_EINLASS_MS: der gemessene Einlass connecting, waitingRoom, reconnecting, connecting, inMeeting');
}
{
  let mitten = '';
  const ev = await fahreSteuerung({ FAKE_WARTERAUM: '1', FAKE_EINLASS_MS: '100', FAKE_EINLASS_HAENGT: '1' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('status', { status: 'reconnecting' }));
    await new Promise((r) => setTimeout(r, 300));
    mitten = statusFolge(ev);
  });
  assert(mitten === 'connecting,waitingRoom,reconnecting', 'FAKE_EINLASS_HAENGT: nach reconnecting kommt nichts mehr');
  assert(statusFolge(ev) === 'connecting,waitingRoom,reconnecting', '... auch beim Beenden nicht (nie im Meeting gewesen)');
}
{
  let mitten = '';
  const ev = await fahreSteuerung({ FAKE_VERBINDUNG_HAENGT_MS: '100' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('status', { status: 'reconnecting' }));
    await new Promise((r) => setTimeout(r, 300));
    mitten = statusFolge(ev);
  });
  assert(mitten === 'connecting,inMeeting,reconnecting', 'FAKE_VERBINDUNG_HAENGT_MS: reconnecting, dann Stille');
  assert(statusFolge(ev) === 'connecting,inMeeting,reconnecting,disconnecting,ended',
    '... beim stop() meldet sie disconnecting und ended (sie war noch "im Meeting")');
}
{
  const ev = await fahreSteuerung({ FAKE_ENTZUG_MS: '100' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('privilege', { source: 'broadcast' }));
    b.send({ cmd: 'videoSubscribe', id: 16778240, resolution: '720p' });
    await bisEreignis(ev, art('error', { code: 'videoNoPrivilege' }));
  });
  const iJa = stelle(ev, art('privilege', { canRecordRaw: true }));
  const iEntzug = stelle(ev, art('privilege', { canRecordRaw: false, source: 'broadcast' }));
  assert(iJa >= 0 && iEntzug > iJa, 'FAKE_ENTZUG_MS: privilege broadcast canRecordRaw:false nach der Erlaubnis');
  assert(stelle(ev, art('error', { where: 'video', code: 'videoNoPrivilege', id: 16778240 })) > iEntzug,
    '... ein folgendes videoSubscribe wird mit videoNoPrivilege abgewiesen');
}
{
  let zwischenMs = -1;
  const ev = await fahreSteuerung({ FAKE_WIEDERBEITRITT_MS: '500', FAKE_RUECKKEHR_MS: '200' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('privilege', { canRecordRaw: true }));
    b.send({ cmd: 'videoSubscribe', id: 16778240, resolution: '720p' });
    await bisEreignis(ev, art('left'));
    const weg = Date.now();
    await bisEreignis(ev, art('joined'));
    zwischenMs = Date.now() - weg;
    await bisEreignis(ev, art('video', { reason: 'reboundByName' }));
  });
  const iLeft = stelle(ev, art('left', { id: 16778240 }));
  const iSchwarz = stelle(ev, art('video', { id: 16778240, state: 'black', reason: 'participantLeft' }));
  const iTonAus = stelle(ev, art('audio', { id: 16778240, state: 'off', reason: 'participantLeft' }));
  assert(iLeft >= 0 && iSchwarz === iLeft + 1 && iTonAus === iSchwarz + 1,
    'Weggang mit Abo: left, video black, audio off (participantLeft) - wie das Original');
  assert((ev[iSchwarz] as { source?: string } | undefined)?.source === 'JM Connect – Zoom Anna', '... die Quelle bleibt bestehen, nur schwarz');
  const iJoined = stelle(ev, art('joined'));
  const zurueck = ev[iJoined] as { p?: Participant } | undefined;
  assert(iJoined > iTonAus && zurueck?.p?.id === 16778250 && zurueck.p.name === 'Anna', 'Anna kommt als 16778250 zurueck');
  assert(zwischenMs >= 150, 'FAKE_RUECKKEHR_MS: zwischen left und joined liegen mindestens 150 ms');
  const iUm = stelle(ev, art('video', { id: 16778250, state: 'subscribed', reason: 'reboundByName' }));
  assert(iUm > iJoined, '... dann haengt sich das Abo um (ERST joined, DANN video reboundByName)');
  assert(stelle(ev, art('audio', { id: 16778250, state: 'waiting', reason: 'reboundByName' })) > iUm,
    '... und der Ton wartet wieder (Grund reboundByName wie im Original)');
}
{
  const ev = await fahreSteuerung({ FAKE_WIEDERBEITRITT_MS: '500', FAKE_RUECKKEHR_NAME: 'anna' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('privilege', { canRecordRaw: true }));
    b.send({ cmd: 'videoSubscribe', id: 16778240, resolution: '720p' });
    await bisEreignis(ev, art('joined'));
    await new Promise((r) => setTimeout(r, 300));
  });
  const zurueck = ev.find(art('joined')) as { p?: Participant } | undefined;
  assert(zurueck?.p?.id === 16778250 && zurueck.p.name === 'anna', 'FAKE_RUECKKEHR_NAME: sie kommt als "anna" zurueck');
  assert(!ev.some(art('video', { reason: 'reboundByName' })), '... und das Abo haengt NICHT um (Name nicht exakt gleich)');
  assert(stelle(ev, art('video', { id: 16778240, state: 'black', reason: 'participantLeft' })) >= 0, '... es bleibt schwarz unter 16778240');
}
{
  // Doppelname und Rueckkehr: "Anna" gibt es danach zweimal (16778241 und 16778250) -
  // das Original haengt dann nicht um ("lieber ein Handgriff als die falsche Person").
  const ev = await fahreSteuerung({ FAKE_WIEDERBEITRITT_MS: '500', FAKE_DOPPELNAME: '1' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('privilege', { canRecordRaw: true }));
    b.send({ cmd: 'videoSubscribe', id: 16778240, resolution: '720p' });
    await bisEreignis(ev, art('joined'));
    await new Promise((r) => setTimeout(r, 300));
  });
  assert(stelle(ev, art('joined')) >= 0 && !ev.some(art('video', { reason: 'reboundByName' })),
    'Doppelname: bei der Rueckkehr haengt die Attrappe NICHT um (Name nicht eindeutig)');
}
{
  // envprobe meldet den PATH, den das Kind bekommt. "Path" (so erbt Windows ihn)
  // muss dafuer weg, sonst stuenden "Path" und "PATH" nebeneinander (Spec 3.2-4).
  const marke = join(tmpdir(), 'jm-envprobe-marke');
  const ev: BridgeEvent[] = [];
  const b = new Bridge({
    exePath: process.execPath,
    exeArgs: [fake],
    env: { FAKE_SCRIPT: 'envprobe', PATH: `${marke}${delimiter}${process.env.PATH ?? ''}` },
    envRemove: Object.keys(process.env).filter((k) => k.toLowerCase() === 'path' && k !== 'PATH'),
    onEvent: (e) => ev.push(e),
  });
  await b.start();
  await bisEreignis(ev, art('envprobe'));
  const probe = ev.find(art('envprobe')) as { path?: string } | undefined;
  assert(typeof probe?.path === 'string' && probe.path.split(delimiter).includes(marke), 'envprobe meldet path: den PATH, den das Kind wirklich bekommt');
  await b.stop();
}

console.log(failures === 0 ? '\nAlle Selbsttests bestanden.' : `\n${failures} Selbsttest(s) fehlgeschlagen.`);
```
Hinweise: `Bridge` (Zeile 818), `fake` (Zeile 823), `join` (Zeile 820), `delimiter` (Zeile 26), `tmpdir` (Zeile 25), `Participant`/`BridgeEvent` (Typimporte Zeilen 20–21) und `SDK_FASSUNG_BRIDGE` (Aufgabe 1) sind schon importiert. Die Namen `bisEreignis`, `art`, `stelle`, `statusFolge`, `BEITRITT`, `fahreSteuerung` kommen in `selftest.ts` bisher nicht vor. `FAKE_WIEDERBEITRITT_MS` ist 500 (nicht 100): die Erlaubnis kommt 50 ms nach dem Ankommen, das Abo muss vor dem Weggang stehen — 500 ms lassen dafür sicher Luft.

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/zoom-bridge
```
Erwartet: alle bisherigen Gruppen grün, im neuen Block 3 `ok` und 21 `FAIL`, Exitcode ≠ 0:
```
Attrappe — Stellschrauben Stage 4:
FAIL  FAKE_SDK_FASSUNG bestimmt ready.sdkVersion
  ok  ohne FAKE_SDK_FASSUNG bleibt die Vorgabe "7.1.5 (attrappe)"
FAIL  FAKE_NDI_FEHLER: error ndi ndiInitFailed direkt nach ready
FAIL  ... also vor der Antwort auf die Anmeldung
FAIL  ... mit dem Namen NDI_INIT_FAILED
FAIL  FAKE_DOPPELNAME: 16778240 und 16778241 heissen beide "Anna"
FAIL  FAKE_EINLASS_MS: der gemessene Einlass connecting, waitingRoom, reconnecting, connecting, inMeeting
FAIL  FAKE_EINLASS_HAENGT: nach reconnecting kommt nichts mehr
FAIL  ... auch beim Beenden nicht (nie im Meeting gewesen)
FAIL  FAKE_VERBINDUNG_HAENGT_MS: reconnecting, dann Stille
FAIL  ... beim stop() meldet sie disconnecting und ended (sie war noch "im Meeting")
FAIL  FAKE_ENTZUG_MS: privilege broadcast canRecordRaw:false nach der Erlaubnis
FAIL  ... ein folgendes videoSubscribe wird mit videoNoPrivilege abgewiesen
FAIL  Weggang mit Abo: left, video black, audio off (participantLeft) - wie das Original
FAIL  ... die Quelle bleibt bestehen, nur schwarz
  ok  Anna kommt als 16778250 zurueck
FAIL  FAKE_RUECKKEHR_MS: zwischen left und joined liegen mindestens 150 ms
  ok  ... dann haengt sich das Abo um (ERST joined, DANN video reboundByName)
FAIL  ... und der Ton wartet wieder (Grund reboundByName wie im Original)
FAIL  FAKE_RUECKKEHR_NAME: sie kommt als "anna" zurueck
FAIL  ... und das Abo haengt NICHT um (Name nicht exakt gleich)
FAIL  ... es bleibt schwarz unter 16778240
FAIL  Doppelname: bei der Rueckkehr haengt die Attrappe NICHT um (Name nicht eindeutig)
FAIL  envprobe meldet path: den PATH, den das Kind wirklich bekommt

21 Selbsttest(s) fehlgeschlagen.
```

- [ ] **Step 3: `envprobe` meldet `path`** (`packages/zoom-bridge/test/fake-bridge.mjs`, Zeilen 89–90)

Vorher:
```js
    for (const n of names) seen[n] = Object.prototype.hasOwnProperty.call(process.env, n);
    say({ ev: 'envprobe', seen });
```
Nachher:
```js
    for (const n of names) seen[n] = Object.prototype.hasOwnProperty.call(process.env, n);
    // path: der PATH, den das Kind WIRKLICH bekommt (Stage 4, Spec 12.1 Nr. 4) -
    // damit prueft JM Connect kindPfad()/pfadVarianten() von der empfangenden Seite.
    say({ ev: 'envprobe', seen, path: process.env.PATH });
```

- [ ] **Step 4: Kopfkommentar der Stellschrauben** (`packages/zoom-bridge/test/fake-bridge.mjs`, Zeilen 144–152)

Vorher:
```js
  //   FAKE_WIEDERBEITRITT_MS  "Anna" (16778240, OHNE persistentId) geht und kommt
  //                         als 16778250 zurueck. Laeuft ein Abo auf sie, haengt
  //                         es sich ueber den Namen um (reboundByName) - in der
  //                         Reihenfolge von native/callbacks.cpp onUserJoin:
  //                         ERST joined, DANN das video-Ereignis.
  //   FAKE_ABGANG_MS        quit braucht so lange, bevor das Meeting verlassen wird
  //   FAKE_LOGDATEI         jede empfangene Befehlszeile auch in diese Datei
  //                         (fuer den Konsolen-Pruefstand, der stderr nicht sieht)
  //
```
Nachher:
```js
  //   FAKE_WIEDERBEITRITT_MS  "Anna" (16778240, OHNE persistentId) geht und kommt
  //                         als 16778250 zurueck. Beim Weggang wie das Original
  //                         (native/callbacks.cpp onUserLeft, native/video.cpp
  //                         videoParticipantLeft): left, dann - falls ein Abo auf
  //                         ihr laeuft - video black (participantLeft), dann, falls
  //                         ihr Ton lief, audio off (participantLeft). Das Abo
  //                         BLEIBT. Bei der Rueckkehr haengt es sich ueber den
  //                         Namen um (reboundByName), wenn der Name EXAKT gleich
  //                         und eindeutig ist (je ein Teilnehmer und ein Abo) - in
  //                         der Reihenfolge von onUserJoin: ERST joined, DANN das
  //                         video-Ereignis.
  //   FAKE_ABGANG_MS        quit braucht so lange, bevor das Meeting verlassen wird
  //   FAKE_LOGDATEI         jede empfangene Befehlszeile auch in diese Datei
  //                         (fuer den Konsolen-Pruefstand, der stderr nicht sieht)
  //
  // Stage 4 (JM Connect, Spec 12.1 Nr. 4):
  //   FAKE_SDK_FASSUNG      sdkVersion im ready-Ereignis (Vorgabe '7.1.5 (attrappe)');
  //                         die Connect-Tests setzen immer '7.1.5 (43953)'
  //   FAKE_NDI_FEHLER=1     direkt nach ready: error where:'ndi' code:'ndiInitFailed',
  //                         also noch VOR der Antwort auf die Anmeldung (native/main.cpp)
  //   FAKE_DOPPELNAME=1     der zweite fremde Teilnehmer (16778241) heisst ebenfalls "Anna"
  //   FAKE_EINLASS_MS       nur mit FAKE_WARTERAUM=1: so lange nach waitingRoom laesst
  //                         der Host ein - gemessene Folge reconnecting, connecting,
  //                         inMeeting
  //   FAKE_EINLASS_HAENGT=1 mit FAKE_EINLASS_MS: nur reconnecting, dann Stille
  //   FAKE_VERBINDUNG_HAENGT_MS  so lange nach dem Beitritt: reconnecting, dann
  //                         Stille. Die Attrappe bleibt "im Meeting", quit meldet
  //                         darum disconnecting und ended
  //   FAKE_ENTZUG_MS        so lange nach der Erlaubnis entzieht der Host sie:
  //                         privilege canRecordRaw:false, source:'broadcast'
  //   FAKE_RUECKKEHR_MS     mit FAKE_WIEDERBEITRITT_MS: Abstand zwischen left und
  //                         joined (Vorgabe 0 = sofort, wie bisher)
  //   FAKE_RUECKKEHR_NAME   mit FAKE_WIEDERBEITRITT_MS: Name bei der Rueckkehr
  //                         (Vorgabe: unveraendert). Weicht er ab, haengt die
  //                         Attrappe NICHT um - das Abo bleibt schwarz unter 16778240
  //
```

- [ ] **Step 5: Abo-Einträge merken Name und Ton** (`packages/zoom-bridge/test/fake-bridge.mjs`, Zeile 177)

Vorher:
```js
    const abos = new Map(); // id -> { source, audio, rebindable }
```
Nachher:
```js
    // id -> { source, audio, rebindable, name, tonLaeuft }. audio = Ton bestellt
    // (wie audioOn im Original), tonLaeuft = Ton noch nicht "off" gemeldet.
    const abos = new Map();
```

- [ ] **Step 6: Doppelname und Entzug der Erlaubnis** (`packages/zoom-bridge/test/fake-bridge.mjs`, Zeilen 196–208)

Vorher:
```js
        if (i === 0 && wiederbeitritt) ueber.persistentId = '';
        teilnehmer.set(16778240 + i, person(16778240 + i, namen[i] ?? `Gast ${i}`, ueber));
      }
      say({ ev: 'roster', list: [...teilnehmer.values()] });
      say({ ev: 'privilege', canRecordRaw: false, source: 'check', requested: true });
      if (privileg === 'ja') {
        setTimeout(() => {
          canRecordRaw = true;
          say({ ev: 'privilege', canRecordRaw: true, source: 'requestAnswer' });
          if (process.env.FAKE_ABSTURZ_MS) {
            setTimeout(() => process.exit(0xc0000005 | 0), Number(process.env.FAKE_ABSTURZ_MS));
          }
        }, 50);
```
Nachher:
```js
        if (i === 0 && wiederbeitritt) ueber.persistentId = '';
        // FAKE_DOPPELNAME: zwei Fremde mit demselben Namen (Spec 4 "Doppelname").
        const name = i === 1 && process.env.FAKE_DOPPELNAME === '1' ? 'Anna' : (namen[i] ?? `Gast ${i}`);
        teilnehmer.set(16778240 + i, person(16778240 + i, name, ueber));
      }
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

- [ ] **Step 7: Weggang und Rückkehr wie das Original** (`packages/zoom-bridge/test/fake-bridge.mjs`, Zeilen 219–236)

Vorher:
```js
      if (wiederbeitritt) {
        setTimeout(() => {
          const alt = teilnehmer.get(16778240);
          teilnehmer.delete(16778240);
          say({ ev: 'left', id: 16778240 });
          const neu = { ...alt, id: 16778250 };
          teilnehmer.set(neu.id, neu);
          // ERST joined, DANN das Umhaengen (native/callbacks.cpp onUserJoin).
          say({ ev: 'joined', p: neu });
          const a = abos.get(16778240);
          if (a) {
            abos.delete(16778240);
            abos.set(neu.id, a);
            say({ ev: 'video', id: neu.id, state: 'subscribed', source: a.source, reason: 'reboundByName', rebindable: a.rebindable });
            if (a.audio) say({ ev: 'audio', id: neu.id, state: 'waiting', reason: 'command' });
          }
        }, Number(wiederbeitritt));
      }
```
Nachher:
```js
      if (wiederbeitritt) {
        setTimeout(() => {
          const alt = teilnehmer.get(16778240);
          teilnehmer.delete(16778240);
          say({ ev: 'left', id: 16778240 });
          // Wie native/video.cpp videoParticipantLeft: das Abo BLEIBT (die Quelle
          // darf nicht wegbrechen), das Bild wird schwarz, der Ton endet - aber
          // nur, wenn er noch lief.
          const weg = abos.get(16778240);
          if (weg) {
            say({ ev: 'video', id: 16778240, state: 'black', source: weg.source, reason: 'participantLeft', rebindable: weg.rebindable });
            if (weg.tonLaeuft) {
              weg.tonLaeuft = false;
              say({ ev: 'audio', id: 16778240, state: 'off', reason: 'participantLeft' });
            }
          }
          const rueckkehr = () => {
            const neu = { ...alt, id: 16778250, name: process.env.FAKE_RUECKKEHR_NAME ?? alt.name };
            teilnehmer.set(neu.id, neu);
            // ERST joined, DANN das Umhaengen (native/callbacks.cpp onUserJoin).
            say({ ev: 'joined', p: neu });
            // Umhaengen nur bei EXAKT gleichem Namen, der unter den Teilnehmern
            // UND unter den Abos genau einmal vorkommt (native/video.cpp:1305-1316).
            const gleichnamigeTeilnehmer = [...teilnehmer.values()].filter((p) => p.name === neu.name).length;
            const kandidaten = [...abos].filter(([id, a]) => id !== neu.id && a.name === neu.name);
            if (gleichnamigeTeilnehmer === 1 && kandidaten.length === 1) {
              const [altId, a] = kandidaten[0];
              abos.delete(altId);
              abos.set(neu.id, a);
              a.tonLaeuft = a.audio;
              say({ ev: 'video', id: neu.id, state: 'subscribed', source: a.source, reason: 'reboundByName', rebindable: a.rebindable });
              // Grund wie das Original (native/video.cpp:1491): der Umhaenge-Grund.
              if (a.audio) say({ ev: 'audio', id: neu.id, state: 'waiting', reason: 'reboundByName' });
            }
          };
          const rueckkehrMs = Number(process.env.FAKE_RUECKKEHR_MS ?? '0');
          if (rueckkehrMs > 0) setTimeout(rueckkehr, rueckkehrMs);
          else rueckkehr();
        }, Number(wiederbeitritt));
      }
```

- [ ] **Step 8: Verbindung hängt nach dem Ankommen** (`packages/zoom-bridge/test/fake-bridge.mjs`, Ende von `imMeetingAnkommen`, Zeilen 250–255)

Vorher:
```js
            abbauen('meetingEnded');
          }, 50);
        }, Number(process.env.FAKE_VERBINDUNG_WEG_MS));
      }
    };
```
Nachher:
```js
            abbauen('meetingEnded');
          }, 50);
        }, Number(process.env.FAKE_VERBINDUNG_WEG_MS));
      }
      if (process.env.FAKE_VERBINDUNG_HAENGT_MS) {
        // Zoom verbindet neu und kommt nie an: reconnecting, dann Stille.
        // imMeeting bleibt true - quit verlaesst darum das Meeting (disconnecting, ended).
        setTimeout(() => {
          say({ ev: 'status', status: 'reconnecting', raw: 7, code: 0 });
        }, Number(process.env.FAKE_VERBINDUNG_HAENGT_MS));
      }
    };
```

- [ ] **Step 9: Einlass aus dem Warteraum** (`packages/zoom-bridge/test/fake-bridge.mjs`, Zeilen 259–262)

Vorher:
```js
      if (process.env.FAKE_WARTERAUM === '1') {
        say({ ev: 'status', status: 'waitingRoom', raw: 8, code: 0 });
        return; // und dann Stille - bis jemand einlaesst oder wir gehen
      }
```
Nachher:
```js
      if (process.env.FAKE_WARTERAUM === '1') {
        say({ ev: 'status', status: 'waitingRoom', raw: 8, code: 0 });
        if (process.env.FAKE_EINLASS_MS) {
          // Der Host laesst ein. GEMESSEN (Owner-Abnahme): reconnecting,
          // connecting, inMeeting (Spec 3.2-19).
          setTimeout(() => {
            say({ ev: 'status', status: 'reconnecting', raw: 7, code: 0 });
            if (process.env.FAKE_EINLASS_HAENGT === '1') return; // und dann Stille
            say({ ev: 'status', status: 'connecting', raw: 1, code: 0 });
            imMeetingAnkommen();
          }, Number(process.env.FAKE_EINLASS_MS));
        }
        return; // und dann Stille - bis jemand einlaesst oder wir gehen
      }
```

- [ ] **Step 10: SDK-Fassung und NDI-Fehler bei `init`** (`packages/zoom-bridge/test/fake-bridge.mjs`, Zeilen 298–299)

Vorher:
```js
        } else say({ ev: 'ready', sdkVersion: '7.1.5 (attrappe)' });
      } else if (c.cmd === 'auth') {
```
Nachher:
```js
        } else {
          say({ ev: 'ready', sdkVersion: process.env.FAKE_SDK_FASSUNG ?? '7.1.5 (attrappe)' });
          if (process.env.FAKE_NDI_FEHLER === '1') say({ ev: 'error', where: 'ndi', code: 'ndiInitFailed' });
        }
      } else if (c.cmd === 'auth') {
```
(Nur diese Stelle im Drehbuch `steuerung`; die anderen `'7.1.5 (attrappe)'`-Zeilen der übrigen Drehbücher bleiben.)

- [ ] **Step 11: `videoSubscribe` merkt Name und Ton** (`packages/zoom-bridge/test/fake-bridge.mjs`, Zeilen 318–319)

Vorher:
```js
        const rebindable = teilnehmer.get(c.id).persistentId !== '';
        abos.set(c.id, { source, audio, rebindable });
```
Nachher:
```js
        const rebindable = teilnehmer.get(c.id).persistentId !== '';
        abos.set(c.id, { source, audio, rebindable, name: teilnehmer.get(c.id).name, tonLaeuft: audio });
```
`abbauen()` und `videoUnsubscribe` bleiben unverändert: sie melden `audio off`, wenn Ton **bestellt** war (`a.audio`) — genau wie `native/video.cpp:469` und `:594` (`if (s->audioOn) emitAudio(…, "off", …)`).

- [ ] **Step 12: Test laufen lassen (grün)**

```
npm run selftest -w @jm/zoom-bridge
```
Erwartet: keine Zeile `FAIL`, Exitcode 0, am Ende:
```
Attrappe — Stellschrauben Stage 4:
  ok  FAKE_SDK_FASSUNG bestimmt ready.sdkVersion
  ok  ohne FAKE_SDK_FASSUNG bleibt die Vorgabe "7.1.5 (attrappe)"
  ok  FAKE_NDI_FEHLER: error ndi ndiInitFailed direkt nach ready
  ok  ... also vor der Antwort auf die Anmeldung
  ok  ... mit dem Namen NDI_INIT_FAILED
  ok  FAKE_DOPPELNAME: 16778240 und 16778241 heissen beide "Anna"
  ok  FAKE_EINLASS_MS: der gemessene Einlass connecting, waitingRoom, reconnecting, connecting, inMeeting
  ok  FAKE_EINLASS_HAENGT: nach reconnecting kommt nichts mehr
  ok  ... auch beim Beenden nicht (nie im Meeting gewesen)
  ok  FAKE_VERBINDUNG_HAENGT_MS: reconnecting, dann Stille
  ok  ... beim stop() meldet sie disconnecting und ended (sie war noch "im Meeting")
  ok  FAKE_ENTZUG_MS: privilege broadcast canRecordRaw:false nach der Erlaubnis
  ok  ... ein folgendes videoSubscribe wird mit videoNoPrivilege abgewiesen
  ok  Weggang mit Abo: left, video black, audio off (participantLeft) - wie das Original
  ok  ... die Quelle bleibt bestehen, nur schwarz
  ok  Anna kommt als 16778250 zurueck
  ok  FAKE_RUECKKEHR_MS: zwischen left und joined liegen mindestens 150 ms
  ok  ... dann haengt sich das Abo um (ERST joined, DANN video reboundByName)
  ok  ... und der Ton wartet wieder (Grund reboundByName wie im Original)
  ok  FAKE_RUECKKEHR_NAME: sie kommt als "anna" zurueck
  ok  ... und das Abo haengt NICHT um (Name nicht exakt gleich)
  ok  ... es bleibt schwarz unter 16778240
  ok  Doppelname: bei der Rueckkehr haengt die Attrappe NICHT um (Name nicht eindeutig)
  ok  envprobe meldet path: den PATH, den das Kind wirklich bekommt

Alle Selbsttests bestanden.
```
Die bestehende Gruppe „steuerung — Wiederbeitritt mit Umhaengen ueber den Namen“ bleibt vollständig grün (synchrone Rückkehr, gleicher Name, ein Abo). Vorab an einer Kopie gemessen (Windows, Node 24.16): 471 `ok`-Zeilen, Laufzeit rund 17 s, dreimal hintereinander stabil.

- [ ] **Step 13: Typecheck**

```
npm run typecheck -w @jm/zoom-bridge
```
Erwartet: keine Ausgabe von `tsc`, Exitcode 0. (`fake-bridge.mjs` prüft `tsc` nicht; `selftest.ts` schon.)

- [ ] **Step 14: Commit** (Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add packages/zoom-bridge/test/fake-bridge.mjs packages/zoom-bridge/test/selftest.ts
git status --short
```
Erwartet genau diese gestagten Zeilen:
```
M  packages/zoom-bridge/test/fake-bridge.mjs
M  packages/zoom-bridge/test/selftest.ts
```
Dann:
```
git commit -m "feat(zoom-bridge): Attrappe mit den Stellschrauben fuer JM Connect (Stage 4, Spec 12.1 Nr. 4)" -m "Neu: FAKE_SDK_FASSUNG, FAKE_NDI_FEHLER, FAKE_DOPPELNAME, FAKE_EINLASS_MS/FAKE_EINLASS_HAENGT, FAKE_VERBINDUNG_HAENGT_MS, FAKE_ENTZUG_MS, FAKE_RUECKKEHR_MS, FAKE_RUECKKEHR_NAME. Weggang mit Abo wie das Original: left, video black, audio off (participantLeft); Umhaengen nur bei exakt gleichem, eindeutigem Namen, Ton wartet mit Grund reboundByName. envprobe meldet zusaetzlich PATH. Alle bisherigen Faelle bleiben gruen." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- **`audio off` bei `videoUnsubscribe` und Abbau:** Das Gerüst sagt „nur bei `tonLaeuft`“. Der native Teil meldet `audio off` dort aber, sobald Ton **bestellt** war (`native/video.cpp:469` `videoUnsubscribe`, `:594` Abbau, jeweils `if (s->audioOn)`), auch nach einem schon gemeldeten `off/participantLeft`. Die Attrappe folgt dem Original („Der Vertrag folgt dem Original“, Kopf von `steuerung`); `tonLaeuft` steuert nur den Weggang (`native/video.cpp:1221-1226`: `if (s->audioOn && s->audioState != "off")`). Für den Kern ist ein zweites `audio off` beim Entladen harmlos.
- **Umhängen nur bei exakt gleichem, eindeutigem Namen:** Bisher hängte die Attrappe jedes Abo auf 16778240 um. Jetzt wie `native/video.cpp:1305-1316` (je genau ein Teilnehmer und ein Abo mit exakt diesem Namen). Ohne das könnten `FAKE_RUECKKEHR_NAME` und `FAKE_DOPPELNAME` + `FAKE_WIEDERBEITRITT_MS` das Original nicht nachstellen (Fälle 14b und 15 in Aufgabe 15). Der bestehende Fall bleibt grün.
- **Ton-Grund beim Umhängen** jetzt `reboundByName` statt `command` (wie `native/video.cpp:1491`, `emitAudio(*s, "waiting", grund)`).
- **Testwerte:** `FAKE_WIEDERBEITRITT_MS=500` statt 100 (sonst nur 50 ms Fenster zwischen Erlaubnis und Weggang für das Abo — flackernd). Zusätzlicher Fall „Doppelname + Rückkehr → kein Umhängen“. Die Spec-Formulierung „zuerst `audio off`/`video black`“ ist als „vor der Rückkehr“ umgesetzt; die Reihenfolge untereinander folgt dem Original (`left`, `black`, `off`), wie Gerüst-Lücke L16.

---

### Task 4: Bridge: `scripts/auslieferung.mjs` (Wächter für Ordner und `.asar`, VC-Laufzeit, Frische)

**Spec:** `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md` Abschnitte 5.1 (Zeilen `scripts/auslieferung.mjs` und `scripts/build-release.mjs`), 3.2-16, 10.2, 10.3 (Regeln für `verboteneAsarEintraege`), 12.1 letzter Absatz, Ergänzung 0.18.

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\suite-sofort-fixes` (Branch `feat/zoom-stage4-connect`). Alle Pfade unten relativ dazu.

**Files:**
- Create: `packages/zoom-bridge/scripts/auslieferung.mjs`
- Create: `packages/zoom-bridge/test/auslieferung.test.mjs`
- Modify: `packages/zoom-bridge/scripts/build-release.mjs`
  - Zeilen 35–38 (Importe): Import aus `./auslieferung.mjs`
  - Zeilen 76–118 (`dateienUnter`, `neuesteAenderung`, `linkerFassung`, `dateiFassung`, `mindestens`): entfernt
  - Zeilen 131–164 (`SDK_NAMEN_7_1_5`): entfernt
  - Zeilen 181–189 (Frische der EXE): über `bridgeExeFrisch`
  - Zeilen 220–256 (`VC_PFLICHT`, `findeVcLaufzeit`, `linker`, `vc`): Import statt eigener Kopie, Wurf von `linkerFassung` über `abbruch`
  - Zeilen 388–399 (Wächter) und 439 (Gegenprobe am ZIP): über `sdkNamen`/`verboteneZoomDateien`
- Modify: `packages/zoom-bridge/package.json` — Skript `selftest`

Zeilenangaben gelten für den Stand vor dieser Aufgabe (`build-release.mjs` wird von Aufgabe 1–3 nicht berührt). Maßgeblich ist immer der wortgleiche Vorher-Text.

Alles in `auslieferung.mjs` **wirft** oder liefert ein Ergebnis, nichts ruft `process.exit()`: ein electron-builder-Haken (Aufgabe 19) kann den Bau nur über eine Ausnahme abbrechen, `build-release.mjs` fängt die Würfe mit seinem bestehenden `abbruch(…)`. Ausgaben und Rückgabewerte von `build-release.mjs` bleiben gleich. Die Datei ist ESM ohne Typen; `tsc` prüft sie nicht (`tsconfig.json` schließt nur `*.ts` ein).

**Interfaces:**
- Consumes: keine.
- Produces (exakt so, Aufgabe 19 baut darauf):
  ```js
  // packages/zoom-bridge/scripts/auslieferung.mjs (ESM, ohne Typen)
  export const SDK_NAMEN_7_1_5;                      // string[] — 152 Namen, wörtlich wie build-release.mjs:135-164
  export const VC_PFLICHT;                           // ['msvcp140.dll','msvcp140_codecvt_ids.dll','vcruntime140.dll','vcruntime140_1.dll']
  export function dateienUnter(dir);                 // string[] relativ zu dir, rekursiv (Trenner des Betriebssystems)
  export function neuesteAenderung(dir);             // number (mtimeMs), rekursiv
  export function linkerFassung(datei);              // [major, minor]; wirft new Error(`${datei} ist keine PE-Datei.`)
  export function dateiFassung(datei);               // [a, b, c, d] | null
  export function mindestens(a, b);                  // boolean: a >= b komponentenweise
  export function findeVcLaufzeit(pkgDir = <packages/zoom-bridge>); // { brauchbar: { dir: string, fassung: number[] }[], kandidaten: string[] }
  export function bridgeExeFrisch(pkgDir);           // { ok: true, exe: string } | { ok: false, text: string }
  export function sdkNamen(opts = {});               // Set<string>, klein; opts.sdkBin?: string | null — echte Liste, wenn der Ordner existiert
  export function verboteneZoomDateien(ordner, opts = {});   // string[] relativ zu ordner
  export function asarEintraege(datei);              // string[] Datei-Einträge mit '/'
  export function verboteneAsarEintraege(ordner, opts = {}); // string[] '<asar relativ zu ordner>:<eintrag>', ohne Dopplungen
  ```

**Regeln für diese Aufgabe:** Global Constraints G6, G7, G13, G14, G15.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`packages/zoom-bridge/test/auslieferung.test.mjs`, neue Datei)

```js
// Selbsttest fuer scripts/auslieferung.mjs (Spec Stage 4, 12.1 letzter Absatz):
// die Waechter gegen Zoom-SDK-Dateien (Ordner UND Inhalt einer .asar), die
// Frische der EXE und die PE-Leser. Alles gegen Temp-Ordner - kein SDK, kein
// Windows, kein Compiler noetig.
//   node packages/zoom-bridge/test/auslieferung.test.mjs
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
  verboteneZoomDateien,
} from '../scripts/auslieferung.mjs';

let failures = 0;
function assert(cond, name) {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}`);
  }
}

const temp = mkdtempSync(join(tmpdir(), 'jm-auslieferung-'));
/** Legt eine Datei samt Ordnern an. */
function datei(pfad, inhalt = '') {
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, inhalt);
}
/**
 * Baut eine .asar, wie electron-builder sie schreibt: 16-Byte-Kopf
 * (UInt32LE 4, Laenge+8, Laenge+4, Laenge), dann das JSON-Inhaltsverzeichnis
 * { files: baum }. Der Dateiinhalt bleibt leer - gelesen wird nur das Verzeichnis.
 */
function baueAsar(pfad, baum) {
  const json = Buffer.from(JSON.stringify({ files: baum }), 'utf8');
  const kopf = Buffer.alloc(16);
  kopf.writeUInt32LE(4, 0);
  kopf.writeUInt32LE(json.length + 8, 4);
  kopf.writeUInt32LE(json.length + 4, 8);
  kopf.writeUInt32LE(json.length, 12);
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, Buffer.concat([kopf, json]));
}
const leer = { size: 0, offset: '0' };

try {
  console.log('auslieferung — SDK-Namensliste:');
  {
    assert(SDK_NAMEN_7_1_5.length === 152, 'SDK_NAMEN_7_1_5 hat 152 Namen (153 Dateien, 152 verschiedene Namen)');
    assert(new Set(SDK_NAMEN_7_1_5.map((n) => n.toLowerCase())).size === 152, '... ohne Doppelte, auch ohne Gross-/Kleinschreibung');
    assert(SDK_NAMEN_7_1_5.includes('sdk.dll') && SDK_NAMEN_7_1_5.includes('zoom_meeting_bridge.dll'), '... mit sdk.dll und zoom_meeting_bridge.dll');
    assert(VC_PFLICHT.join(',') === 'msvcp140.dll,msvcp140_codecvt_ids.dll,vcruntime140.dll,vcruntime140_1.dll', 'VC_PFLICHT: die vier Pflicht-DLLs');
    assert(!SDK_NAMEN_7_1_5.some((n) => VC_PFLICHT.includes(n.toLowerCase())), 'keine VC-Pflicht-DLL steht in der SDK-Liste (sonst sperrte der Waechter die eigene Laufzeit)');
    const fest = sdkNamen();
    assert(fest.has('sdk.dll') && fest.has('cmmlib.dll') && fest.size === 152, 'sdkNamen() ohne sdkBin: die feste Liste, klein geschrieben');
    assert(sdkNamen({ sdkBin: join(temp, 'gibt es nicht') }).size === 152, 'sdkNamen() mit fehlendem sdkBin-Ordner: die feste Liste');
  }

  console.log('\nauslieferung — Waechter fuer Ordner:');
  {
    const ordner = join(temp, 'resources');
    datei(join(ordner, 'zoom-bridge', 'zoom-bridge.exe'));
    datei(join(ordner, 'zoom-bridge', 'msvcp140.dll'));
    datei(join(ordner, 'bin', 'win', 'Processing.NDI.Lib.x64.dll'));
    assert(verboteneZoomDateien(ordner).length === 0, 'sauberer Ordner (Bridge, VC-Laufzeit, NDI): keine Treffer');
    datei(join(ordner, 'unter', 'sdk.dll'));
    datei(join(ordner, 'tief', 'x', 'SDK.DLL'));
    const treffer = verboteneZoomDateien(ordner).sort();
    assert(
      treffer.join('|') === [join('tief', 'x', 'SDK.DLL'), join('unter', 'sdk.dll')].join('|'),
      'findet unter/sdk.dll und tief/x/SDK.DLL (ohne Gross-/Kleinschreibung), relativ zum Ordner',
    );
    assert(dateienUnter(ordner).length === 5, 'dateienUnter: alle Dateien, rekursiv');

    // Mit sdkBin gilt die ECHTE Liste aus dem SDK-Ordner, nicht die feste.
    const sdkBin = join(temp, 'sdk', 'x64', 'bin');
    datei(join(sdkBin, 'nur-echt.dll'));
    datei(join(ordner, 'nur-echt.dll'));
    const echt = verboteneZoomDateien(ordner, { sdkBin });
    assert(echt.join('|') === 'nur-echt.dll', 'mit sdkBin: meldet nur-echt.dll und nicht mehr sdk.dll');
  }

  console.log('\nauslieferung — Waechter fuer .asar:');
  {
    const ordner = join(temp, 'win-unpacked');
    const asar = join(ordner, 'resources', 'app.asar');
    baueAsar(asar, {
      out: { files: { main: { files: { 'index.cjs': leer } } } },
      'package.json': leer,
      node_modules: {
        files: {
          '@jm': {
            files: {
              'zoom-bridge': { files: { 'package.json': leer, release: { files: { 'x.zip': leer } } } },
              ndi: { files: { 'index.js': leer } },
            },
          },
        },
      },
      // paket.zip liegt AUSSERHALB von node_modules/@jm/zoom-bridge/ und heisst nicht wie eine SDK-Datei:
      // nur die .zip-Regel (Spec 10.3, dritte Regel) kann sie melden.
      irgendwo: { files: { 'sdk.dll': { size: 0, unpacked: true }, 'paket.zip': leer } },
    });
    const eintraege = asarEintraege(asar);
    assert(
      eintraege.join('|') ===
        'out/main/index.cjs|package.json|node_modules/@jm/zoom-bridge/package.json|node_modules/@jm/zoom-bridge/release/x.zip|node_modules/@jm/ndi/index.js|irgendwo/sdk.dll|irgendwo/paket.zip',
      'asarEintraege: genau die Datei-Eintraege, mit / getrennt (Ordner = Knoten mit files)',
    );
    const rel = join('resources', 'app.asar');
    const treffer = verboteneAsarEintraege(ordner);
    assert(
      treffer.join('|') ===
        [
          `${rel}:node_modules/@jm/zoom-bridge/package.json`,
          `${rel}:node_modules/@jm/zoom-bridge/release/x.zip`,
          `${rel}:irgendwo/sdk.dll`,
          `${rel}:irgendwo/paket.zip`,
        ].join('|'),
      'meldet node_modules/@jm/zoom-bridge/package.json, .../release/x.zip, irgendwo/sdk.dll und irgendwo/paket.zip - je einmal',
    );

    const sauber = join(temp, 'sauber');
    baueAsar(join(sauber, 'resources', 'app.asar'), { out: { files: { main: { files: { 'index.cjs': leer } } } } });
    assert(verboteneAsarEintraege(sauber).length === 0, '.asar nur mit out/main/index.cjs: keine Treffer');
    datei(join(sauber, 'resources', 'irgendwas.zip'));
    assert(verboteneAsarEintraege(sauber).length === 0, 'eine .zip-DATEI ausserhalb einer .asar ist nicht Sache dieses Waechters');
  }

  console.log('\nauslieferung — Frische der EXE:');
  {
    const pkg = join(temp, 'paket');
    datei(join(pkg, 'native', 'x.cpp'), '// Quelle');
    datei(join(pkg, 'CMakeLists.txt'), '# Bau');
    const exe = join(pkg, 'build', 'Release', 'zoom-bridge.exe');
    let r = bridgeExeFrisch(pkg);
    assert(!r.ok && r.text.includes('fehlt') && r.text.includes('npm run rebuild -w @jm/zoom-bridge'), 'EXE fehlt: ok false, Text nennt "fehlt" und den Bau-Befehl');
    datei(exe, 'MZ');
    const jetzt = Date.now() / 1000;
    utimesSync(exe, jetzt - 3600, jetzt - 3600);
    r = bridgeExeFrisch(pkg);
    assert(!r.ok && r.text.includes('AELTER'), 'EXE aelter als native\\x.cpp: ok false, Text nennt "AELTER"');
    utimesSync(exe, jetzt + 60, jetzt + 60);
    r = bridgeExeFrisch(pkg);
    assert(r.ok && r.exe === exe, 'EXE juenger als native\\ und CMakeLists.txt: ok true mit Pfad');
  }

  console.log('\nauslieferung — PE-Leser und Fassungsvergleich:');
  {
    // PE mit Linker 14.44 (Optional Header ab pe+24, MajorLinkerVersion bei +2)
    // und VS_FIXEDFILEINFO 14.44.35211.0.
    const b = Buffer.alloc(0x200);
    b.write('MZ', 0, 'latin1');
    b.writeUInt32LE(0x80, 0x3c);
    b.write('PE\0\0', 0x80, 'latin1');
    b[0x80 + 24 + 2] = 14;
    b[0x80 + 24 + 3] = 44;
    b.set([0xbd, 0x04, 0xef, 0xfe], 0x100);
    b.writeUInt32LE(((14 << 16) | 44) >>> 0, 0x108);
    b.writeUInt32LE(((35211 << 16) | 0) >>> 0, 0x10c);
    const pe = join(temp, 'pe', 'probe.dll');
    datei(pe, b);
    assert(linkerFassung(pe).join('.') === '14.44', 'linkerFassung liest 14.44');
    assert(dateiFassung(pe)?.join('.') === '14.44.35211.0', 'dateiFassung liest 14.44.35211.0');
    const text = join(temp, 'pe', 'text.txt');
    datei(text, 'kein PE');
    let meldung = '';
    try {
      linkerFassung(text);
    } catch (e) {
      meldung = e.message;
    }
    assert(meldung === `${text} ist keine PE-Datei.`, 'linkerFassung WIRFT bei einer Nicht-PE-Datei (statt process.exit)');
    assert(dateiFassung(text) === null, 'dateiFassung ohne Versionsressource: null');
    assert(mindestens([14, 44, 35211, 0], [14, 44]) && mindestens([14, 50, 0, 0], [14, 44]), 'mindestens: gleich oder neuer -> true');
    assert(!mindestens([14, 29, 30133, 0], [14, 44]), 'mindestens: aelter -> false');
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAlle Auslieferungs-Tests bestanden.' : `\n${failures} Auslieferungs-Test(s) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
node packages/zoom-bridge/test/auslieferung.test.mjs
```
Erwartet: Abbruch vor dem ersten Test, Exitcode 1:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\packages\zoom-bridge\scripts\auslieferung.mjs' imported from …\packages\zoom-bridge\test\auslieferung.test.mjs
```

- [ ] **Step 3: `scripts/auslieferung.mjs` anlegen** (`packages/zoom-bridge/scripts/auslieferung.mjs`, neue Datei)

```js
// Was in eine Auslieferung der Zoom-Bridge darf - und was nie (Spec Stage 4,
// Abschnitte 5.1 und 10). EIN Modul fuer beide Bauwege:
//   - scripts/build-release.mjs (Einsatzpaket der Konsolen-Steuerung)
//   - apps/connect/tools/bundle-zoom-bridge.mjs und tools/after-pack.cjs (JM Connect)
// So gibt es genau EINE Namensliste, EINE VC-Laufzeit-Suche und EINE
// Frische-Pruefung - eine zweite Kopie liefe frueher oder spaeter auseinander.
//
// ALLES HIER WIRFT oder liefert ein Ergebnis, nichts ruft process.exit(): ein
// electron-builder-Haken darf den Bau nur ueber eine Ausnahme abbrechen, und
// build-release.mjs faengt sie mit seinem abbruch().
import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Ordner des Bridge-Pakets (packages/zoom-bridge). */
const PAKET = join(dirname(fileURLToPath(import.meta.url)), '..');

// Die Dateinamen in <Zoom-SDK 7.1.5.43953>\x64\bin, rekursiv, ohne Doppelte -
// fuer den Waechter, wenn ZOOM_SDK_DIR NICHT gesetzt ist. Erzeugt am
// 01.10.2026 aus dem echten SDK (153 Dateien, 152 verschiedene Namen). Ist
// ZOOM_SDK_DIR gesetzt, gilt stattdessen die ECHTE Liste aus dem SDK.
export const SDK_NAMEN_7_1_5 = [
  "amd_ags_x64.dll", "annoter.dll", "aomagent.dll", "aomhost64.exe", "archival.pcm", "asproxy.dll",
  "avcodec_zm-61.dll", "avformat_zm-61.dll", "avutil_zm-59.dll", "cares.dll", "clap-high.pcm",
  "clap-medium.pcm", "clDNN64.dll", "cmmbiz.dll", "CmmBrowserEngine.dll", "Cmmlib.dll", "CptControl.exe",
  "CptInstall.exe", "CptShare.dll", "CptUwpCapture.dll", "crashrpt_lang.ini", "dingdong.pcm",
  "dingdong1.pcm", "directui_license.txt", "double_beep.pcm", "Droplet.pcm", "DuiLib.dll",
  "duilib_license.txt", "dvf.dll", "G Arpeggio.pcm", "G Step.pcm", "Gamelan.pcm", "leave.pcm", "libcml.dll",
  "libcrypto-3-zm.dll", "libcurl.dll", "libmagic.dll", "libmpg123.dll", "libssl-3-zm.dll",
  "localization.xml", "mcm.dll", "mdnsclient.dll", "mdnsresponder.dll", "meeting_chat_chime.pcm",
  "meeting_raisehand_chime.pcm", "mfAdapter.dll", "mkldnn.dll", "msaalib.dll", "mute.pcm",
  "nanosvg_LICENSE.txt", "nydus.dll", "percussion.pcm", "percussion_pause.pcm", "Pizzicato Strings.pcm",
  "record_start.pcm", "record_stop.pcm", "Reed Organ.pcm", "reslib.dll", "ring.pcm", "ringtone.xml",
  "ring_spatial.pcm", "ryzen_ai_vart.dll", "sdk.dll", "sdkExt.dll", "Silent.pcm", "ssb_sdk.dll",
  "swresample_zm-5.dll", "swscale_zm-8.dll", "tp.dll", "turbojpeg.dll", "UIBase.dll", "Ukulele G.pcm",
  "Ukulele.pcm", "unmute.pcm", "util.dll", "Vibraphone.pcm", "viper.dll", "viperex.dll",
  "viper_async_device.dll", "WebView2Loader.dll", "wr_ding.pcm", "XmppDll.dll", "zApp.dll", "zAppRes.dll",
  "zAppUI.dll", "zbt.dll", "zBusinessUIComponent.dll", "zCommonChatRes.dll", "zContext.dll",
  "zCrashReport64.dll", "zCrashReport64.exe", "zcsairhost.exe", "zcscpthost.exe", "zCSCptService.exe",
  "zData.dll", "zEventTracker.dll", "zKBCrypto.dll", "zLang_de.dll", "zLang_es.dll", "zLang_fr.dll",
  "zLang_id.dll", "zLang_it.dll", "zLang_jp.dll", "zLang_korean.dll", "zLang_nl.dll", "zLang_pl.dll",
  "zLang_ptg.dll", "zLang_ru.dll", "zLang_sv.dll", "zLang_tr.dll", "zLang_vi.dll", "zLang_zh_cn.dll",
  "zLang_zh_tw.dll", "zLooper.dll", "zlt.dll", "zmbRecord.dll", "zmbTranscode.dll", "ZMDB.dll", "zmp.dll",
  "zMsgAppCommon.dll", "zm_conf_universal_ui.dll", "zm_conf_universal_ui_plugin.dll", "zNet.dll",
  "zNetUtils.dll", "zoom.manifest", "zoombase_crypto_shared.dll", "ZoomDocConverter.exe", "ZoomProxy.dll",
  "ZoomTask.dll", "ZoomTelemetry.dll", "zoom_meeting_bridge.dll", "zPSApp.dll", "zPTApp.dll", "zSDK.dll",
  "zTelemetryBiz.dll", "zTscoder.exe", "ZUI.dll", "zUIClient.dll", "zUnifyWebViewApp.dll", "zVideoApp.dll",
  "zVideoAppFrame.dll", "zVideoAppPlugin.dll", "zVideoUI.dll", "zVideoUIPlugin.dll", "zVideoUIPluginRes.dll",
  "zWBUI.dll", "zWBUIRes.dll", "zWebService.dll", "zWebview2Agent.exe", "zWinRes.dll", "zzhost.dll",
  "ZZHostIPCSDK.dll",
];

// Die VC-Laufzeit, die zoom-bridge.exe UND die Zoom-DLLs brauchen (gemessen:
// 79 von 119 Dateien in x64\bin + Bridge brauchen msvcp140.dll; dazu einmal
// msvcp140_codecvt_ids.dll). Das Zoom-SDK liefert sie fuer x64 NICHT mit.
export const VC_PFLICHT = ['msvcp140.dll', 'msvcp140_codecvt_ids.dll', 'vcruntime140.dll', 'vcruntime140_1.dll'];

/** Alle Dateien unter `dir`, rekursiv, als Pfade relativ zu `dir`. */
export function dateienUnter(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) for (const q of dateienUnter(p)) out.push(join(e.name, q));
    else out.push(e.name);
  }
  return out;
}

/** Neueste Aenderungszeit unter `dir` (rekursiv). */
export function neuesteAenderung(dir) {
  let max = 0;
  for (const f of dateienUnter(dir)) max = Math.max(max, statSync(join(dir, f)).mtimeMs);
  return max;
}

/** Linker-Fassung einer PE-Datei (Optional Header: MajorLinkerVersion.MinorLinkerVersion). Wirft bei Nicht-PE. */
export function linkerFassung(datei) {
  const b = readFileSync(datei);
  const pe = b.length >= 0x40 ? b.readUInt32LE(0x3c) : -1;
  if (pe < 0 || pe + 28 > b.length || b.toString('latin1', pe, pe + 4) !== 'PE\0\0') {
    throw new Error(`${datei} ist keine PE-Datei.`);
  }
  return [b[pe + 24 + 2], b[pe + 24 + 3]];
}

/** Dateifassung aus VS_FIXEDFILEINFO (Signatur 0xFEEF04BD), als [a, b, c, d]; null ohne Versionsressource. */
export function dateiFassung(datei) {
  const b = readFileSync(datei);
  const i = b.indexOf(Buffer.from([0xbd, 0x04, 0xef, 0xfe]));
  if (i < 0 || i + 16 > b.length) return null;
  const ms = b.readUInt32LE(i + 8);
  const ls = b.readUInt32LE(i + 12);
  return [ms >>> 16, ms & 0xffff, ls >>> 16, ls & 0xffff];
}

/** a >= b, komponentenweise (gleich lange Zahlenlisten). */
export function mindestens(a, b) {
  for (let i = 0; i < b.length; i++) {
    if ((a[i] ?? 0) !== b[i]) return (a[i] ?? 0) > b[i];
  }
  return true;
}

/**
 * Sucht die Visual-C++-Laufzeit (Microsoft.VC14x.CRT mit allen VC_PFLICHT-Dateien):
 * VC_CRT_DIR, die Visual-Studio-Instanz aus build\CMakeCache.txt des Bridge-Pakets
 * und jede Visual-Studio-Installation unter "Program Files". `brauchbar` ist nach
 * Fassung absteigend sortiert; `kandidaten` nennt alle durchsuchten Ordner (fuer
 * die Abbruchmeldung).
 */
export function findeVcLaufzeit(pkgDir = PAKET) {
  const kandidaten = [];
  if (process.env.VC_CRT_DIR) kandidaten.push(process.env.VC_CRT_DIR);
  const cache = join(pkgDir, 'build', 'CMakeCache.txt');
  const vsWurzeln = new Set();
  if (existsSync(cache)) {
    const m = /^CMAKE_GENERATOR_INSTANCE:INTERNAL=(.+)$/m.exec(readFileSync(cache, 'utf8'));
    if (m) vsWurzeln.add(m[1].trim());
  }
  // Nur Ordner, und ein unlesbarer Ordner ist leer statt ein Absturz.
  const ordnerIn = (d) => {
    try {
      return readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  };
  for (const pf of ['C:\\Program Files (x86)\\Microsoft Visual Studio', 'C:\\Program Files\\Microsoft Visual Studio']) {
    for (const jahr of ordnerIn(pf)) for (const ed of ordnerIn(join(pf, jahr))) vsWurzeln.add(join(pf, jahr, ed));
  }
  for (const w of vsWurzeln) {
    const redist = join(w, 'VC', 'Redist', 'MSVC');
    for (const v of ordnerIn(redist)) {
      const x64 = join(redist, v, 'x64');
      for (const d of ordnerIn(x64)) if (/^Microsoft\.VC\d+\.CRT$/i.test(d)) kandidaten.push(join(x64, d));
    }
  }
  const brauchbar = kandidaten
    .filter((d) => VC_PFLICHT.every((f) => existsSync(join(d, f))))
    .map((d) => ({ dir: d, fassung: dateiFassung(join(d, 'msvcp140.dll')) ?? [0, 0, 0, 0] }))
    .sort((a, b) => (mindestens(a.fassung, b.fassung) ? -1 : 1));
  return { brauchbar, kandidaten };
}

/**
 * zoom-bridge.exe muss AUS DEM AKTUELLEN STAND gebaut sein: vorhanden und
 * juenger als jede Datei in native\ und als CMakeLists.txt. Ein Paket mit einer
 * alten .exe saehe aus wie der neue Stand und waere es nicht.
 */
export function bridgeExeFrisch(pkgDir) {
  const exe = join(pkgDir, 'build', 'Release', 'zoom-bridge.exe');
  if (!existsSync(exe)) {
    return { ok: false, text: `${exe} fehlt - erst ZOOM_SDK_DIR und NDI_SDK_DIR setzen und \`npm run rebuild -w @jm/zoom-bridge\`.` };
  }
  const quellenStand = Math.max(neuesteAenderung(join(pkgDir, 'native')), statSync(join(pkgDir, 'CMakeLists.txt')).mtimeMs);
  if (statSync(exe).mtimeMs <= quellenStand) {
    return {
      ok: false,
      text:
        'build\\Release\\zoom-bridge.exe ist AELTER als eine Datei in native\\ oder CMakeLists.txt.\n' +
        '  Erst neu bauen: ZOOM_SDK_DIR und NDI_SDK_DIR setzen, dann `npm run rebuild -w @jm/zoom-bridge`.',
    };
  }
  return { ok: true, exe };
}

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

/** Waechter fuer Ordner: alle Dateien unter `ordner` (relativ), die wie eine Zoom-SDK-Datei heissen. */
export function verboteneZoomDateien(ordner, opts = {}) {
  const namen = sdkNamen(opts);
  return dateienUnter(ordner).filter((f) => namen.has(f.split(/[\\/]/).pop().toLowerCase()));
}

/**
 * Inhaltsverzeichnis einer .asar: liest nur den 16-Byte-Kopf (die JSON-Laenge
 * steht als UInt32LE bei Byte 12) und das JSON ab Byte 16 - nie den Dateiinhalt.
 * Liefert jeden DATEI-Eintrag als Pfad mit "/"; ein Knoten mit "files" ist ein Ordner.
 */
export function asarEintraege(datei) {
  const fd = openSync(datei, 'r');
  try {
    const kopf = Buffer.alloc(16);
    if (readSync(fd, kopf, 0, 16, 0) < 16) throw new Error(`${datei} ist keine .asar (Kopf kuerzer als 16 Byte).`);
    const laenge = kopf.readUInt32LE(12);
    const json = Buffer.alloc(laenge);
    if (readSync(fd, json, 0, laenge, 16) < laenge) throw new Error(`${datei} ist keine .asar (Inhaltsverzeichnis abgeschnitten).`);
    const baum = JSON.parse(json.toString('utf8'));
    const out = [];
    const gehe = (knoten, vorne) => {
      for (const [name, kind] of Object.entries(knoten ?? {})) {
        const pfad = vorne ? `${vorne}/${name}` : name;
        if (kind && typeof kind === 'object' && kind.files && typeof kind.files === 'object') gehe(kind.files, pfad);
        else out.push(pfad);
      }
    };
    gehe(baum.files, '');
    return out;
  } finally {
    closeSync(fd);
  }
}

/**
 * Waechter fuer den INHALT jeder .asar unter `ordner` (Spec 10.3): meldet jeden
 * Eintrag, dessen Name in der SDK-Liste steht, der unter node_modules/@jm/zoom-bridge/
 * liegt (die Bridge wird gebuendelt, ihr Paketordner gehoert nie in die app.asar)
 * oder der auf .zip endet (in ein ZIP sieht kein Namensvergleich hinein).
 * Ergebnis "<asar relativ zu ordner>:<eintrag>", jeder Eintrag hoechstens einmal.
 */
export function verboteneAsarEintraege(ordner, opts = {}) {
  const namen = sdkNamen(opts);
  const treffer = new Set();
  for (const rel of dateienUnter(ordner).filter((f) => /\.asar$/i.test(f))) {
    for (const eintrag of asarEintraege(join(ordner, rel))) {
      const name = eintrag.split('/').pop().toLowerCase();
      if (namen.has(name) || `/${eintrag}`.includes('/node_modules/@jm/zoom-bridge/') || /\.zip$/i.test(eintrag)) {
        treffer.add(`${rel}:${eintrag}`);
      }
    }
  }
  return [...treffer];
}
```
Die Namensliste ist Zeichen für Zeichen die aus `build-release.mjs:135-164` (dort wird sie in Step 7 entfernt).

- [ ] **Step 4: Test laufen lassen (grün)**

```
node packages/zoom-bridge/test/auslieferung.test.mjs
```
Erwartet: Exitcode 0, 24 `ok`, keine Zeile `FAIL`:
```
auslieferung — SDK-Namensliste:
  ok  SDK_NAMEN_7_1_5 hat 152 Namen (153 Dateien, 152 verschiedene Namen)
  ok  ... ohne Doppelte, auch ohne Gross-/Kleinschreibung
  ok  ... mit sdk.dll und zoom_meeting_bridge.dll
  ok  VC_PFLICHT: die vier Pflicht-DLLs
  ok  keine VC-Pflicht-DLL steht in der SDK-Liste (sonst sperrte der Waechter die eigene Laufzeit)
  ok  sdkNamen() ohne sdkBin: die feste Liste, klein geschrieben
  ok  sdkNamen() mit fehlendem sdkBin-Ordner: die feste Liste

auslieferung — Waechter fuer Ordner:
  ok  sauberer Ordner (Bridge, VC-Laufzeit, NDI): keine Treffer
  ok  findet unter/sdk.dll und tief/x/SDK.DLL (ohne Gross-/Kleinschreibung), relativ zum Ordner
  ok  dateienUnter: alle Dateien, rekursiv
  ok  mit sdkBin: meldet nur-echt.dll und nicht mehr sdk.dll

auslieferung — Waechter fuer .asar:
  ok  asarEintraege: genau die Datei-Eintraege, mit / getrennt (Ordner = Knoten mit files)
  ok  meldet node_modules/@jm/zoom-bridge/package.json, .../release/x.zip, irgendwo/sdk.dll und irgendwo/paket.zip - je einmal
  ok  .asar nur mit out/main/index.cjs: keine Treffer
  ok  eine .zip-DATEI ausserhalb einer .asar ist nicht Sache dieses Waechters

auslieferung — Frische der EXE:
  ok  EXE fehlt: ok false, Text nennt "fehlt" und den Bau-Befehl
  ok  EXE aelter als native\x.cpp: ok false, Text nennt "AELTER"
  ok  EXE juenger als native\ und CMakeLists.txt: ok true mit Pfad

auslieferung — PE-Leser und Fassungsvergleich:
  ok  linkerFassung liest 14.44
  ok  dateiFassung liest 14.44.35211.0
  ok  linkerFassung WIRFT bei einer Nicht-PE-Datei (statt process.exit)
  ok  dateiFassung ohne Versionsressource: null
  ok  mindestens: gleich oder neuer -> true
  ok  mindestens: aelter -> false

Alle Auslieferungs-Tests bestanden.
```

- [ ] **Step 5: Gegenprobe am echten Bau (nur Windows, nur lesen)**

Liegt ein gebautes Connect 0.1.0 vor (im Haupt-Checkout `C:\Users\alexk\alexzvn\apps\connect\release\win-unpacked`), den `.asar`-Leser daran messen (Git Bash, aus der Worktree-Wurzel; liest nur):
```
node --input-type=module -e "import { asarEintraege, verboteneAsarEintraege, verboteneZoomDateien } from './packages/zoom-bridge/scripts/auslieferung.mjs'; const wu = 'C:/Users/alexk/alexzvn/apps/connect/release/win-unpacked'; console.log(asarEintraege(wu + '/resources/app.asar').length, verboteneAsarEintraege(wu), verboteneZoomDateien(wu));"
```
Erwartet (vorab gemessen, 02.10.2026): `454 [] []` — das Inhaltsverzeichnis ist lesbar, Connect 0.1.0 hat weder Zoom-Dateien noch `@jm/zoom-bridge` noch ein ZIP. Fehlt der Ordner, Schritt im Bericht als übersprungen nennen.

- [ ] **Step 6: `build-release.mjs` importiert das Modul** (`packages/zoom-bridge/scripts/build-release.mjs`, Zeilen 35–38)

Vorher:
```js
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
```
Nachher:
```js
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
// Gemeinsam mit JM Connect (tools/bundle-zoom-bridge.mjs, tools/after-pack.cjs):
// EINE Namensliste, EINE VC-Suche, EINE Frische-Pruefung (Spec Stage 4, 5.1).
import {
  VC_PFLICHT,
  bridgeExeFrisch,
  dateienUnter,
  findeVcLaufzeit,
  linkerFassung,
  mindestens,
  sdkNamen,
  verboteneZoomDateien,
} from './auslieferung.mjs';

const here = dirname(fileURLToPath(import.meta.url));
```
Der `node:fs`-Import in Zeile 33 bleibt unverändert (`existsSync`, `readdirSync`, `readFileSync`, `statSync` werden weiter gebraucht).

- [ ] **Step 7: Eigene Kopien der Hilfsfunktionen entfernen** (`packages/zoom-bridge/scripts/build-release.mjs`, Zeilen 76–121; der Vorher-Text endet mitten in Zeile 121, die Zeile läuft unverändert weiter)

Vorher:
```js
/** Alle Dateien unter `dir`, rekursiv, als Pfade relativ zu `dir`. */
function dateienUnter(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) for (const q of dateienUnter(p)) out.push(join(e.name, q));
    else out.push(e.name);
  }
  return out;
}

/** Neueste Aenderungszeit unter `dir` (rekursiv). */
function neuesteAenderung(dir) {
  let max = 0;
  for (const f of dateienUnter(dir)) max = Math.max(max, statSync(join(dir, f)).mtimeMs);
  return max;
}

/** Linker-Fassung einer PE-Datei (Optional Header: MajorLinkerVersion.MinorLinkerVersion). */
function linkerFassung(datei) {
  const b = readFileSync(datei);
  const pe = b.readUInt32LE(0x3c);
  if (b.toString('latin1', pe, pe + 4) !== 'PE\0\0') abbruch(`${datei} ist keine PE-Datei.`);
  return [b[pe + 24 + 2], b[pe + 24 + 3]];
}

/** Dateifassung aus VS_FIXEDFILEINFO (Signatur 0xFEEF04BD), als [a, b, c, d]; null ohne Versionsressource. */
function dateiFassung(datei) {
  const b = readFileSync(datei);
  const i = b.indexOf(Buffer.from([0xbd, 0x04, 0xef, 0xfe]));
  if (i < 0) return null;
  const ms = b.readUInt32LE(i + 8);
  const ls = b.readUInt32LE(i + 12);
  return [ms >>> 16, ms & 0xffff, ls >>> 16, ls & 0xffff];
}

/** a >= b, komponentenweise (gleich lange Zahlenlisten). */
function mindestens(a, b) {
  for (let i = 0; i < b.length; i++) {
    if ((a[i] ?? 0) !== b[i]) return (a[i] ?? 0) > b[i];
  }
  return true;
}

/**
 * Textdatei ins Paket schreiben:
```
Nachher:
```js
/**
 * Textdatei ins Paket schreiben:
```

- [ ] **Step 8: Namensliste entfernen** (`packages/zoom-bridge/scripts/build-release.mjs`, Zeilen 131–166)

Vorher:
```js
// Die Dateinamen in <Zoom-SDK 7.1.5.43953>\x64\bin, rekursiv, ohne Doppelte -
// fuer den Waechter, wenn ZOOM_SDK_DIR NICHT gesetzt ist. Erzeugt am
// 01.10.2026 aus dem echten SDK (153 Dateien, 152 verschiedene Namen). Ist
// ZOOM_SDK_DIR gesetzt, gilt stattdessen die ECHTE Liste aus dem SDK.
const SDK_NAMEN_7_1_5 = [
  "amd_ags_x64.dll", "annoter.dll", "aomagent.dll", "aomhost64.exe", "archival.pcm", "asproxy.dll",
  "avcodec_zm-61.dll", "avformat_zm-61.dll", "avutil_zm-59.dll", "cares.dll", "clap-high.pcm",
  "clap-medium.pcm", "clDNN64.dll", "cmmbiz.dll", "CmmBrowserEngine.dll", "Cmmlib.dll", "CptControl.exe",
  "CptInstall.exe", "CptShare.dll", "CptUwpCapture.dll", "crashrpt_lang.ini", "dingdong.pcm",
  "dingdong1.pcm", "directui_license.txt", "double_beep.pcm", "Droplet.pcm", "DuiLib.dll",
  "duilib_license.txt", "dvf.dll", "G Arpeggio.pcm", "G Step.pcm", "Gamelan.pcm", "leave.pcm", "libcml.dll",
  "libcrypto-3-zm.dll", "libcurl.dll", "libmagic.dll", "libmpg123.dll", "libssl-3-zm.dll",
  "localization.xml", "mcm.dll", "mdnsclient.dll", "mdnsresponder.dll", "meeting_chat_chime.pcm",
  "meeting_raisehand_chime.pcm", "mfAdapter.dll", "mkldnn.dll", "msaalib.dll", "mute.pcm",
  "nanosvg_LICENSE.txt", "nydus.dll", "percussion.pcm", "percussion_pause.pcm", "Pizzicato Strings.pcm",
  "record_start.pcm", "record_stop.pcm", "Reed Organ.pcm", "reslib.dll", "ring.pcm", "ringtone.xml",
  "ring_spatial.pcm", "ryzen_ai_vart.dll", "sdk.dll", "sdkExt.dll", "Silent.pcm", "ssb_sdk.dll",
  "swresample_zm-5.dll", "swscale_zm-8.dll", "tp.dll", "turbojpeg.dll", "UIBase.dll", "Ukulele G.pcm",
  "Ukulele.pcm", "unmute.pcm", "util.dll", "Vibraphone.pcm", "viper.dll", "viperex.dll",
  "viper_async_device.dll", "WebView2Loader.dll", "wr_ding.pcm", "XmppDll.dll", "zApp.dll", "zAppRes.dll",
  "zAppUI.dll", "zbt.dll", "zBusinessUIComponent.dll", "zCommonChatRes.dll", "zContext.dll",
  "zCrashReport64.dll", "zCrashReport64.exe", "zcsairhost.exe", "zcscpthost.exe", "zCSCptService.exe",
  "zData.dll", "zEventTracker.dll", "zKBCrypto.dll", "zLang_de.dll", "zLang_es.dll", "zLang_fr.dll",
  "zLang_id.dll", "zLang_it.dll", "zLang_jp.dll", "zLang_korean.dll", "zLang_nl.dll", "zLang_pl.dll",
  "zLang_ptg.dll", "zLang_ru.dll", "zLang_sv.dll", "zLang_tr.dll", "zLang_vi.dll", "zLang_zh_cn.dll",
  "zLang_zh_tw.dll", "zLooper.dll", "zlt.dll", "zmbRecord.dll", "zmbTranscode.dll", "ZMDB.dll", "zmp.dll",
  "zMsgAppCommon.dll", "zm_conf_universal_ui.dll", "zm_conf_universal_ui_plugin.dll", "zNet.dll",
  "zNetUtils.dll", "zoom.manifest", "zoombase_crypto_shared.dll", "ZoomDocConverter.exe", "ZoomProxy.dll",
  "ZoomTask.dll", "ZoomTelemetry.dll", "zoom_meeting_bridge.dll", "zPSApp.dll", "zPTApp.dll", "zSDK.dll",
  "zTelemetryBiz.dll", "zTscoder.exe", "ZUI.dll", "zUIClient.dll", "zUnifyWebViewApp.dll", "zVideoApp.dll",
  "zVideoAppFrame.dll", "zVideoAppPlugin.dll", "zVideoUI.dll", "zVideoUIPlugin.dll", "zVideoUIPluginRes.dll",
  "zWBUI.dll", "zWBUIRes.dll", "zWebService.dll", "zWebview2Agent.exe", "zWinRes.dll", "zzhost.dll",
  "ZZHostIPCSDK.dll",
];

// --- 1. Vorbedingungen
```
Nachher:
```js
// --- 1. Vorbedingungen
```
(Die Zeile `// --- 1. Vorbedingungen ---…` geht danach unverändert weiter; ersetzt wird nur bis „Vorbedingungen“.)

- [ ] **Step 9: Frische der EXE über `bridgeExeFrisch`** (`packages/zoom-bridge/scripts/build-release.mjs`, Zeilen 181–189)

Vorher:
```js
const bridgeExe = join(pkg, 'build', 'Release', 'zoom-bridge.exe');
if (!existsSync(bridgeExe)) abbruch(`${bridgeExe} fehlt - erst ZOOM_SDK_DIR und NDI_SDK_DIR setzen und \`npm run rebuild -w @jm/zoom-bridge\`.`);
const quellenStand = Math.max(neuesteAenderung(join(pkg, 'native')), statSync(join(pkg, 'CMakeLists.txt')).mtimeMs);
if (statSync(bridgeExe).mtimeMs <= quellenStand) {
  abbruch(
    'build\\Release\\zoom-bridge.exe ist AELTER als eine Datei in native\\ oder CMakeLists.txt.\n' +
      '  Erst neu bauen: ZOOM_SDK_DIR und NDI_SDK_DIR setzen, dann `npm run rebuild -w @jm/zoom-bridge`.',
  );
}
```
Nachher:
```js
// Pruefung und Texte stehen in auslieferung.mjs (bridgeExeFrisch) - JM Connect
// prueft beim Packen genau dasselbe.
const frisch = bridgeExeFrisch(pkg);
if (!frisch.ok) abbruch(frisch.text);
const bridgeExe = frisch.exe;
```

- [ ] **Step 10: VC-Laufzeit über das Modul** (`packages/zoom-bridge/scripts/build-release.mjs`, Zeilen 219–256)

Vorher:
```js
// zoom-bridge.exe gebaut hat (die STL ist nur rueckwaerts kompatibel).
const VC_PFLICHT = ['msvcp140.dll', 'msvcp140_codecvt_ids.dll', 'vcruntime140.dll', 'vcruntime140_1.dll'];
function findeVcLaufzeit() {
  const kandidaten = [];
  if (process.env.VC_CRT_DIR) kandidaten.push(process.env.VC_CRT_DIR);
  const cache = join(pkg, 'build', 'CMakeCache.txt');
  const vsWurzeln = new Set();
  if (existsSync(cache)) {
    const m = /^CMAKE_GENERATOR_INSTANCE:INTERNAL=(.+)$/m.exec(readFileSync(cache, 'utf8'));
    if (m) vsWurzeln.add(m[1].trim());
  }
  // Nur Ordner, und ein unlesbarer Ordner ist leer statt ein Absturz.
  const ordnerIn = (d) => {
    try {
      return readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  };
  for (const pf of ['C:\\Program Files (x86)\\Microsoft Visual Studio', 'C:\\Program Files\\Microsoft Visual Studio']) {
    for (const jahr of ordnerIn(pf)) for (const ed of ordnerIn(join(pf, jahr))) vsWurzeln.add(join(pf, jahr, ed));
  }
  for (const w of vsWurzeln) {
    const redist = join(w, 'VC', 'Redist', 'MSVC');
    for (const v of ordnerIn(redist)) {
      const x64 = join(redist, v, 'x64');
      for (const d of ordnerIn(x64)) if (/^Microsoft\.VC\d+\.CRT$/i.test(d)) kandidaten.push(join(x64, d));
    }
  }
  const brauchbar = kandidaten
    .filter((d) => VC_PFLICHT.every((f) => existsSync(join(d, f))))
    .map((d) => ({ dir: d, fassung: dateiFassung(join(d, 'msvcp140.dll')) ?? [0, 0, 0, 0] }))
    .sort((a, b) => (mindestens(a.fassung, b.fassung) ? -1 : 1));
  return { brauchbar, kandidaten };
}
const linker = linkerFassung(bridgeExe);
const vc = findeVcLaufzeit();
const vcLaufzeit = vc.brauchbar[0];
```
Nachher:
```js
// zoom-bridge.exe gebaut hat (die STL ist nur rueckwaerts kompatibel).
// VC_PFLICHT und findeVcLaufzeit stehen in auslieferung.mjs (gemeinsam mit JM Connect).
let linker;
try {
  linker = linkerFassung(bridgeExe);
} catch (e) {
  abbruch(e.message);
}
const vc = findeVcLaufzeit(pkg);
const vcLaufzeit = vc.brauchbar[0];
```
Der Kommentarblock darüber (Zeilen 203–218, „VC-LAUFZEIT, app-lokal …“) und die beiden Abbrüche danach (Zeilen 257–269) bleiben wörtlich.

- [ ] **Step 11: Wächter über `sdkNamen`/`verboteneZoomDateien`** (`packages/zoom-bridge/scripts/build-release.mjs`, Zeilen 388–398)

Vorher:
```js
const echteListe = sdkBin && existsSync(sdkBin);
const sdkNamen = new Set(
  (echteListe ? dateienUnter(sdkBin).map((f) => f.split(/[\\/]/).pop()) : SDK_NAMEN_7_1_5).map((n) => n.toLowerCase()),
);
const oeffentlicheDateien = dateienUnter(oeffentlich);
const verboten = oeffentlicheDateien.filter((f) => sdkNamen.has(f.split(/[\\/]/).pop().toLowerCase()));
if (verboten.length > 0) {
  abbruch(`Zoom-SDK-Dateien im OEFFENTLICHEN Paket:\n  ${verboten.join('\n  ')}`);
}
schritt(
  `Waechter: keine der ${sdkNamen.size} Zoom-SDK-Dateinamen im oeffentlichen Paket ` +
```
Nachher:
```js
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
```

- [ ] **Step 12: Gegenprobe am ZIP** (`packages/zoom-bridge/scripts/build-release.mjs`, Zeile 439)

Vorher:
```js
const imZipVerboten = imZip.filter((p) => sdkNamen.has(p.split('/').pop().toLowerCase()));
```
Nachher:
```js
const imZipVerboten = imZip.filter((p) => verbotenNamen.has(p.split('/').pop().toLowerCase()));
```
Danach darf in `build-release.mjs` kein Bezeichner `neuesteAenderung`, `dateiFassung`, `SDK_NAMEN_7_1_5` und kein `sdkNamen.` (Set-Zugriff) mehr vorkommen:
```
grep -n "neuesteAenderung\|dateiFassung\|SDK_NAMEN_7_1_5\|sdkNamen\.\|function findeVcLaufzeit\|const VC_PFLICHT" packages/zoom-bridge/scripts/build-release.mjs
```
Erwartet: keine Ausgabe, Exitcode 1.

- [ ] **Step 13: `build-release.mjs` prüfen**

```
node --check packages/zoom-bridge/scripts/build-release.mjs
```
Erwartet: keine Ausgabe, Exitcode 0.

Dann der Abbruchweg mit dem gemeinsamen Text — nur solange im Worktree **keine** gebaute EXE liegt (sonst würde das Skript ein Einsatzpaket bauen; Gerüst-Lücke L14: im Worktree fehlt sie):
```
if [ -f packages/zoom-bridge/build/Release/zoom-bridge.exe ]; then echo "EXE vorhanden - Schritt ausgelassen"; else node packages/zoom-bridge/scripts/build-release.mjs; echo "Rueckgabe $?"; fi
```
Erwartet unter Windows (Text unverändert gegenüber vorher):
```
[release] ABBRUCH: C:\Users\alexk\alexzvn\.claude\worktrees\suite-sofort-fixes\packages\zoom-bridge\build\Release\zoom-bridge.exe fehlt - erst ZOOM_SDK_DIR und NDI_SDK_DIR setzen und `npm run rebuild -w @jm/zoom-bridge`.
Rueckgabe 1
```
(Unter Linux kommt stattdessen `[release] ABBRUCH: das Einsatzpaket wird nur unter Windows gebaut.` — ebenfalls Rückgabe 1.) Vorab an einer Kopie des Pakets mit einer echten `zoom-bridge.exe` gemessen: mit frischer EXE läuft das Skript über Frische, NDI-Suche und VC-Laufzeit (14.51.36231 ≥ Linker 14.51) bis zur Node-Lizenzprüfung; mit `touch -d 2020-01-01` auf die EXE bricht es mit dem unveränderten „…ist AELTER als eine Datei in native\ oder CMakeLists.txt.“ ab.

- [ ] **Step 14: `selftest` ruft beide Testdateien** (`packages/zoom-bridge/package.json`, Skript `selftest`)

Vorher:
```json
    "selftest": "node --experimental-strip-types test/selftest.ts",
```
Nachher:
```json
    "selftest": "node --experimental-strip-types test/selftest.ts && node test/auslieferung.test.mjs",
```

- [ ] **Step 15: Ganzer Selbsttest und Typecheck (grün)**

```
npm run selftest -w @jm/zoom-bridge
npm run typecheck -w @jm/zoom-bridge
```
Erwartet: Selbsttest Exitcode 0, keine Zeile `FAIL`, die beiden Schlusszeilen
```
Alle Selbsttests bestanden.
…
Alle Auslieferungs-Tests bestanden.
```
(vorab an einer Kopie gemessen, Windows: 471 + 24 = 495 `ok`-Zeilen); `tsc` ohne Ausgabe, Exitcode 0.

- [ ] **Step 16: Commit** (Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add packages/zoom-bridge/scripts/auslieferung.mjs packages/zoom-bridge/test/auslieferung.test.mjs packages/zoom-bridge/scripts/build-release.mjs packages/zoom-bridge/package.json
git status --short
```
Erwartet genau diese gestagten Zeilen (keine Zeile unter `packages/zoom-bridge/release/` oder `build/`):
```
M  packages/zoom-bridge/package.json
A  packages/zoom-bridge/scripts/auslieferung.mjs
M  packages/zoom-bridge/scripts/build-release.mjs
A  packages/zoom-bridge/test/auslieferung.test.mjs
```
Dann:
```
git commit -m "feat(zoom-bridge): scripts/auslieferung.mjs - Waechter fuer Ordner und .asar, VC-Laufzeit, Frische der EXE (Stage 4)" -m "Aus build-release.mjs herausgezogen und dort importiert (Ausgaben unveraendert): SDK_NAMEN_7_1_5, VC_PFLICHT, dateienUnter, neuesteAenderung, linkerFassung, dateiFassung, mindestens, findeVcLaufzeit. Neu: bridgeExeFrisch, sdkNamen, verboteneZoomDateien, asarEintraege (liest nur Kopf und Inhaltsverzeichnis) und verboteneAsarEintraege (SDK-Namen, node_modules/@jm/zoom-bridge/, .zip). Alles wirft statt process.exit, damit der electron-builder-Haken von JM Connect dasselbe Modul nutzen kann. selftest ruft test/auslieferung.test.mjs mit." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- `linkerFassung` wirft dieselbe Meldung „`<datei>` ist keine PE-Datei.“ auch für Dateien unter 0x40 Byte oder mit PE-Kopf hinter dem Dateiende (vorher: `RangeError` aus `readUInt32LE`). `dateiFassung` liefert `null`, wenn hinter der Signatur keine 16 Byte mehr stehen (vorher: `RangeError`). Für jede echte PE-Datei ist das Verhalten gleich.
- Die Wächter-Stelle in `build-release.mjs` nutzt zusätzlich `verboteneZoomDateien` (nicht nur `sdkNamen`), damit Ordner-Wächter im Einsatzpaket und in Connect derselbe Code sind; die Zahl in der Ausgabe und die ZIP-Gegenprobe laufen über `sdkNamen` (lokale Variable `verbotenNamen`, weil `sdkNamen` jetzt der Funktionsname ist).
- Zusätzliche Tests über das Gerüst hinaus: Länge und Eindeutigkeit der Namensliste, keine VC-Pflicht-DLL in der Liste, `sdkNamen` mit fehlendem `sdkBin`-Ordner, `.zip`-Datei außerhalb einer `.asar`, `linkerFassung`/`dateiFassung`/`mindestens` an einem erzeugten PE; dazu die Gegenprobe an der echten `app.asar` von Connect 0.1.0 (Step 5).
- Die Test-`.asar` enthält zusätzlich `irgendwo/paket.zip` (außerhalb von `node_modules/@jm/zoom-bridge/`, kein SDK-Name). Das `.zip` unter `node_modules/@jm/zoom-bridge/release/` meldet schon die Pfad-Regel; erst `paket.zip` zeigt, ob die dritte Regel aus Spec 10.3 (`/\.zip$/i`) wirkt. Gegenprobe (am nachgespielten Stand nach Aufgabe 4 gemessen): `|| /\.zip$/i.test(eintrag)` in `verboteneAsarEintraege` entfernt → genau ein `FAIL`, `FAIL  meldet node_modules/@jm/zoom-bridge/package.json, .../release/x.zip, irgendwo/sdk.dll und irgendwo/paket.zip - je einmal`.

---

### Task 5: Connect: Test-Gerüst, Zoom-Typen, Statustexte `zoom-text.ts`

**Spec:** `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md` Abschnitte 5.1 (Regel für den Kern, Absätze zu `shared/types.ts`, `tsconfig.node.json` und `package.json`), 5.4 (Typen, wörtlich), 7.1–7.6 (Zustände, Zoom-Zeile, Kartentext, Gäste-Zeile, Tooltip, STATE, Prüfregel), 9 Punkte 2–6 (Knöpfe der Karte), 8.1 (Texte A4, A6), 10.2 (`selftest`), Ergänzung 0.18 (`devDependencies`).

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\suite-sofort-fixes` (Branch `feat/zoom-stage4-connect`). Alle Pfade relativ dazu.

**Files:**
- Modify: `apps/connect/package.json`
  - Zeile 16 (`"typecheck"` in `scripts`, Zeilen 9–23): neues Skript `selftest` dahinter
  - Zeile 38 (`"@electron/rebuild"`) und Zeile 48 (`"tailwindcss"`) in `devDependencies` (Zeilen 37–51)
- Modify: `package-lock.json` (nur durch `npm install`, nie von Hand)
- Modify: `apps/connect/tsconfig.node.json` Zeilen 15–16 (`allowImportingTsExtensions`) und 24–26 (`include`)
- Modify: `apps/connect/src/shared/types.ts`
  - Zeile 1 (Kopfkommentar, darunter der Typ-Import aus der Bridge)
  - Zeilen 51–53 (Ende von `AppStatus`: neues Feld `zoom`)
  - Zeile 70 (`export type TrayCommand`): die Zoom-Typen aus Spec 5.4 direkt davor
- Modify: `apps/connect/src/main/ipc.ts` Zeilen 37–39 (`currentStatus()`, `zoom: null`)
- Modify: `apps/connect/src/main/tray.ts` Zeilen 19–20 (Anfangsstatus, `zoom: null`)
- Create: `apps/connect/src/shared/zoom-text.ts`
- Create (Test): `apps/connect/test/zoom-text.test.ts`

Zeilenangaben gelten für den Stand vor dieser Aufgabe (Aufgaben 1–4 berühren `apps/connect` nicht). Maßgeblich ist immer der wortgleiche Vorher-Text.

**Interfaces:**
- Consumes: Typen `AudioReason`, `AudioState`, `UserRoleName`, `VideoReason`, `VideoState` aus `@jm/zoom-bridge/protocol` (`packages/zoom-bridge/src/protocol.ts:20`, `:51`, `:57`, `:76`, `:100`; dort schon heute exportiert, Aufgabe 2 ändert sie nicht). `ProxyKeySource` aus `apps/connect/src/shared/types.ts:27`.
- Produces (exakt so, Aufgaben 6–18 bauen darauf):
  ```ts
  // apps/connect/src/shared/types.ts — Spec 5.4 wörtlich (ZoomZustand, ZoomMangel, ZoomErlaubnis, ZoomQuelle,
  // ZoomParticipant, ZoomSollEintrag, ZoomKurz, ZoomAbbild, ZoomErgebnis), dazu zwei Zusätze:
  export interface ZoomParticipant { /* … Spec 5.4 … */ fehler: string | null }
  export interface ZoomSollEintrag { name: string; ton: boolean; ndiName: string; stand: 'wartet' | 'doppelname' | 'verwaist'; aboId: number | null; doppelname: boolean }
  export interface AppStatus { /* … bisherige Felder … */ zoom: ZoomKurz | null }

  // apps/connect/src/shared/zoom-text.ts (rein, nur `import type` aus './types')
  export type ZoomZ = 'Z0'|'Z1a'|'Z1b'|'Z2'|'Z3'|'Z4'|'Z5a'|'Z5b'|'Z6'|'Z7'|'Z7b'|'Z8'|'Z9'|'Z9b'|'Z10'|'Z11'|'Z12'|'Z13';
  export const TEXT_A4: string;   // „Nur für diese Sitzung gemerkt — auf diesem Rechner gibt es keinen Schlüsselbund.“
  export const TEXT_A6: string;   // „Kommt aus Umgebungsvariablen (ZOOM_SDK_…) und hat Vorrang.“
  export const MANGEL_GRUND: Record<ZoomMangel, string>;
  export function zoomZ(k: ZoomKurz): ZoomZ;
  export function zoomZeile(k: ZoomKurz | null): string | null;
  export function kartenZeile(a: ZoomAbbild, jetztMs: number): string | null;
  export function gaesteZeile(s: AppStatus): string;
  export function trayTooltip(s: AppStatus): string;
  export function trayVerlassenAktiv(k: ZoomKurz | null): boolean;
  export type ZoomStatusWert = 'einrichtung' | 'bereit' | 'tritt_bei' | 'warteraum' | 'im_meeting' | 'abriss' | 'verlaesst' | 'fehler';
  export interface ZoomStateKv { zoom_status: ZoomStatusWert; zoom_sources: number; zoom_live: 0 | 1; zoom_privilege: 0 | 1; zoom_alarm: 0 | 1 }
  export function stateKvAus(k: ZoomKurz): ZoomStateKv | null;
  export function sdkZeile(a: ZoomAbbild): string;
  export function sdkKnopf(a: ZoomAbbild): 'SDK-Ordner wählen …' | 'Neu wählen …';
  export function zugangZeile(a: ZoomAbbild): string;
  export interface ZoomKnoepfe {
    meldung: { erneut: boolean; schliessen: boolean; ok: boolean; logordner: boolean } | null;
    einrichtungAenderbar: boolean; pruefen: 'aus' | 'bereit' | 'laeuft';
    beitrittSichtbar: boolean; beitretenGesperrt: boolean; verlassen: boolean; abbrechen: boolean;
    einrichtungOffen: boolean; sperrHinweis: boolean;
  }
  export function zoomKnoepfe(a: ZoomAbbild): ZoomKnoepfe;
  ```
  Testdatei `apps/connect/test/zoom-text.test.ts` mit `ck()`, der Ankerzeile `// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──` und der Schlusszeile (gemeinsame Test-Konvention). Aufgabe 6 hängt ihren Block über der Ankerzeile an.
  `npm run selftest -w @jm/connect` existiert ab hier (`"tsx test/zoom-text.test.ts"`); Aufgaben 7, 9, 10 und 19 verlängern das Skript.

**Regeln für diese Aufgabe:**
- `src/shared/types.ts` und `src/shared/zoom-text.ts`: keine `node:`-Importe, keine Laufzeit-Importe aus Paketen, aus der Bridge nur `import type` aus `@jm/zoom-bridge/protocol` (G8). `tsconfig.web.json` prüft beide Dateien mit und bleibt unverändert.
- Texte wörtlich aus Spec 7 und 9 (G9): deutsche Anführungszeichen „…“, Auslassung „…“ (U+2026), Geviertstrich „—“ (U+2014) im Tooltip und in A4, Mittelpunkt „ · “ als Trenner.
- Dateien im Arbeitsbaum haben CRLF: Änderungen mit dem Edit-Werkzeug (Vorher-Text exakt), nicht mit `sed` (G14).
- Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel, nie pushen (G13).

---

- [ ] **Step 1: Testlauf einrichten — `package.json` und `tsconfig.node.json`**

`apps/connect/package.json`, Ersetzung 1 (Zeile 16), Vorher:
```json
    "typecheck": "npm run typecheck:node && npm run typecheck:web",
```
Nachher:
```json
    "typecheck": "npm run typecheck:node && npm run typecheck:web",
    "selftest": "tsx test/zoom-text.test.ts",
```

Ersetzung 2 (Zeile 38), Vorher:
```json
    "@electron/rebuild": "^4.0.4",
```
Nachher:
```json
    "@electron/rebuild": "^4.0.4",
    "@jm/zoom-bridge": "*",
```

Ersetzung 3 (Zeile 48), Vorher:
```json
    "tailwindcss": "^4.0.0",
```
Nachher:
```json
    "tailwindcss": "^4.0.0",
    "tsx": "^4.19.2",
```
Beide Pakete gehören in die `devDependencies`, nicht in die `dependencies` (Spec Ergänzung 0.18): electron-builder kopiert Workspace-Pakete aus den `dependencies` als ganzen Ordner in die `app.asar`, bei der Bridge also auch ein gitignortes Komplett-ZIP mit allen Zoom-Dateien. `tsx` liegt schon gehoben in der Wurzel (`node_modules/tsx`, Version 4.22.x), `@jm/zoom-bridge` ist als Workspace schon verlinkt.

`apps/connect/tsconfig.node.json`, Ersetzung 4 (Zeilen 15–16), Vorher:
```jsonc
    "allowSyntheticDefaultImports": true,
    "paths": {
```
Nachher:
```jsonc
    "allowSyntheticDefaultImports": true,
    // Die Zoom-Bridge (@jm/zoom-bridge) exportiert .ts-Quellen und importiert intern mit
    // `.ts`-Endung (packages/zoom-bridge/src/index.ts). Präzedenz: apps/interpreter/tsconfig.node.json.
    "allowImportingTsExtensions": true,
    "paths": {
```

Ersetzung 5 (Zeilen 24–26), Vorher:
```jsonc
    "src/utility/**/*.ts",
    "src/shared/**/*.ts"
  ]
```
Nachher:
```jsonc
    "src/utility/**/*.ts",
    "src/shared/**/*.ts",
    "test/**/*.ts"
  ]
```
Damit prüft `npm run typecheck -w @jm/connect` auch die Testdateien. `allowImportingTsExtensions` braucht `noEmit` (steht schon in Zeile 14); Aufgabe 10 importiert `@jm/zoom-bridge`, dessen `src/index.ts` mit `.ts`-Endung importiert.

- [ ] **Step 2: Lockdatei nachziehen**

In der Worktree-Wurzel (Git Bash):
```
npm install --ignore-scripts --no-audit --no-fund
git diff --stat package-lock.json
git diff package-lock.json
```
Erwartet: `npm install` endet ohne Fehler, in der Regel mit `up to date in …s` (es kommt kein Paket hinzu: `tsx` liegt schon in der Wurzel, `@jm/zoom-bridge` ist verlinkt). `git diff --stat` zeigt genau `1 file changed, 2 insertions(+)`, und `git diff` zeigt im Block `"apps/connect"` → `"devDependencies"` genau die beiden Zeilen
```
+        "@jm/zoom-bridge": "*",
+        "tsx": "^4.19.2",
```
und keine Zeile mit `-`. Zeigt der Diff mehr, ist die Lockdatei vorher schon auseinandergelaufen: nicht committen, Befund melden. (Gegen eine Kopie aller `package.json` und der Lockdatei vorab geprüft: `npm install --package-lock-only` ändert genau diese zwei Zeilen.) Ohne diesen Lock-Commit scheitert `npm ci` in der CI.

- [ ] **Step 3: Zoom-Typen in `src/shared/types.ts`, `AppStatus.zoom`**

Ersetzung 1 (Zeile 1), Vorher:
```ts
// Geteilte Typen für Main, Preload und Renderer (window.jmconnect-API).
```
Nachher:
```ts
// Geteilte Typen für Main, Preload und Renderer (window.jmconnect-API).
//
// Aus der Zoom-Bridge kommen NUR Typen und nur aus '@jm/zoom-bridge/protocol' (Spec 5.1):
// protocol.ts hat selbst keine Importe, darum prüft tsconfig.web.json diese Datei ohne Änderung mit.
import type { AudioReason, AudioState, UserRoleName, VideoReason, VideoState } from '@jm/zoom-bridge/protocol';
```

Ersetzung 2 (Zeilen 51–53, Ende von `AppStatus`), Vorher:
```ts
  /** Ist ein JM Presenter im LAN erreichbar? (Folien-Kopplung, Welle 6.3c.) */
  presenterLinked: boolean;
}
```
Nachher:
```ts
  /** Ist ein JM Presenter im LAN erreichbar? (Folien-Kopplung, Welle 6.3c.) */
  presenterLinked: boolean;
  /** Zoom-Kurzform für Tray, Kopfzeile und STATE (Spec 5.4); null unter macOS. */
  zoom: ZoomKurz | null;
}
```

Ersetzung 3 (Zeile 70), Vorher:
```ts
export type TrayCommand = { kind: 'show' } | { kind: 'closeRoom' };
```
Nachher (Spec 5.4 Zeile für Zeile übernommen; neu sind nur `ZoomParticipant.fehler` und `ZoomSollEintrag.doppelname`, jeweils mit Begründung im Kommentar):
```ts
// ── Zoom (Stage 4, Spec 5.4 wörtlich; zwei Zusätze: ZoomParticipant.fehler, ZoomSollEintrag.doppelname) ──

export type ZoomZustand =
  | 'nicht_verfuegbar' // macOS
  | 'einrichtung'      // mindestens ein Mangel (ZoomMangel), oder die Kopie läuft
  | 'bereit'           // auch während „Einrichtung prüfen“ (pruefungLaeuft)
  | 'startet'          // Bridge startet, Anmeldung bei Zoom
  | 'tritt_bei'        // join gesendet, oder Einlass aus dem Warteraum (6.2 Schritt 5)
  | 'warteraum'        // waitingRoom oder waitingForHost
  | 'im_meeting'
  | 'abriss'           // Zoom verbindet neu, oder ein Wiederbeitritt von Connect wartet bzw. läuft
  | 'verlaesst'
  | 'fehler';          // endgültig, bis der Bediener handelt

export type ZoomMangel =
  | 'sdk_fehlt'        // nie eingerichtet
  | 'sdk_defekt'       // pruefeLaufzeit Schritt 1–3 gescheitert (S9)
  | 'bridge_fehlt'     // zoom-bridge.exe fehlt in der Installation (S8)
  | 'zugang_fehlt'     // keine Zugangsdaten (B17)
  | 'zugang_unlesbar'; // safeStorage kann sie nicht entschlüsseln (A5)

/** 'entzogen': war 'ja', dann broadcast mit canRecordRaw:false (3.2-23). */
export type ZoomErlaubnis = 'offen' | 'ja' | 'abgelehnt' | 'abgelaufen' | 'entzogen';

/** Ein laufendes Abo der Bridge. */
export interface ZoomQuelle {
  /** Teilnehmer-ID zum Zeitpunkt des Abos. Gilt nur in dieser Sitzung. */
  aboId: number;
  /** Wörtlich aus dem video-Ereignis (`source`). */
  ndiName: string;
  bild: Exclude<VideoState, 'unsubscribed'>;
  bildGrund: VideoReason;
  /** 'aus' = ohne Ton geladen. */
  ton: AudioState | 'aus';
  tonGrund: AudioReason | null;
  /** Klartext des letzten Fehlers dieses Abos (Abschnitt 8.4). */
  fehler: string | null;
}

/** Ein Zoom-Teilnehmer, wie die Zoom-Karte ihn zeigt. Die eigene Zeile der Bridge fehlt. */
export interface ZoomParticipant {
  /** Zooms GetUserID(). Gilt nur in dieser Sitzung. */
  id: number;
  name: string;
  rolle: UserRoleName;
  kamera: 'an' | 'aus' | 'keine';
  imWarteraum: boolean;
  doppelname: boolean;
  /** Ton-Schalter dieser Zeile (je Teilnehmer-ID, nicht je Name). Vorgabe true, nur änderbar ohne Quelle. */
  tonVorwahl: boolean;
  quelle: ZoomQuelle | null;
  /** „JM Connect – Zoom <name>“, solange noch keine Quelle läuft. */
  ndiNameVorschau: string;
  /** Klartext Q10, wenn ein Browser-Gast denselben NDI-Namen führt. */
  kollision: string | null;
  /**
   * Zeilenfehler (Q2, Q4, Q5, Q8), auch ohne laufende Quelle. Zusatz zu Spec 5.4: Spec 9 Punkt 8
   * verlangt Zeilenfehler auch dort, wo noch keine Quelle läuft, und ZoomQuelle.fehler gibt es erst mit Quelle.
   */
  fehler: string | null;
}

/** Ein Eintrag der Soll-Liste, der gerade keinem Teilnehmer zugeordnet ist. */
export interface ZoomSollEintrag {
  name: string;
  ton: boolean;
  /** Zuletzt gemeldeter NDI-Name, sonst die Vorschau. */
  ndiName: string;
  stand: 'wartet' | 'doppelname' | 'verwaist';
  /** Nur bei 'verwaist': das alte Abo, zum Entladen. */
  aboId: number | null;
  /**
   * Zwei oder mehr fremde Teilnehmer tragen diesen normierten Namen. Zusatz zu Spec 5.4: nur so kann
   * die Karte „Person weg, Quelle schwarz“ bei Doppelname rot mit Q11 zeigen (Spec 9 Punkt 9).
   */
  doppelname: boolean;
}

/** Kurzform für Tray, Kopfzeile und STATE. Teil von AppStatus. */
export interface ZoomKurz {
  zustand: ZoomZustand;
  /** Nur bei 'warteraum'. */
  warten: 'warteraum' | 'host' | null;
  /** Nur bei 'im_meeting' gesetzt, sonst null. */
  erlaubnis: ZoomErlaubnis | null;
  /** n: Abos der laufenden Bridge, deren NDI-Sender existiert. 0, wenn keine Bridge läuft. */
  quellen: number;
  /** Davon nicht im Zustand 'live' (black oder subscribed = erstes Bild steht aus). */
  ohneBild: number;
  /** Offene Soll-Einträge (Begriffe, Abschnitt 4). */
  sollOffen: number;
  /** Nur bei 'abriss': null = Zoom verbindet selbst neu, sonst Versuch 1 bis 5. */
  versuch: number | null;
  /** Alle Mängel der Einrichtung. Nicht leer ⇒ Zustand 'einrichtung'. Während einer laufenden Bridge kann kein Mangel entstehen (Sperre S10). */
  maengel: ZoomMangel[];
  kopieLaeuft: boolean;
}

export interface ZoomAbbild {
  kurz: ZoomKurz;
  einrichtung: {
    sdk: {
      stand: 'fehlt' | 'kopiert' | 'ok' | 'defekt';
      fassung: string | null;
      kopie: { dateien: number; dateienGesamt: number; bytes: number; bytesGesamt: number } | null;
      text: string | null;
    };
    zugang: { herkunft: ProxyKeySource; clientIdEnde: string | null; text: string | null };
  };
  anzeigename: string;
  versatz: { gewuenschtMs: number; bestaetigtMs: number | null };
  /** Ohne eigene Zeile. Host und Co-Host zuerst, dann nach Name (de). */
  teilnehmer: ZoomParticipant[];
  soll: ZoomSollEintrag[];
  abriss: { versuch: number | null; versuche: 5; naechsterUm: number | null } | null;
  /** Steht im Meldungsbereich der Karte, in JEDEM Zustand, bis quittiert (Abschnitt 9, Punkt 2). */
  meldung: { art: 'info' | 'warnung' | 'fehler'; text: string; detail: string | null } | null;
  /** Die letzten 5 Hinweise (Fernsteuerung, Ton-Überlauf, verworfene Pakete, Wiederbeitritt). */
  hinweise: string[];
  /** Liegen Nummer und Kenncode noch im Arbeitsspeicher des Main? */
  erneutMoeglich: boolean;
  /** „Einrichtung prüfen“ läuft (Zustand bleibt 'bereit', 6.1). */
  pruefungLaeuft: boolean;
}

export type ZoomErgebnis = { ok: true } | { ok: false; text: string };

export type TrayCommand = { kind: 'show' } | { kind: 'closeRoom' };
```

- [ ] **Step 4: `zoom: null` an den beiden Stellen, die `AppStatus` bauen**

Sonst scheitert der Typcheck am neuen Pflichtfeld. Aufgabe 16 ersetzt `null` in `ipc.ts` durch `zoomKurz()`.

`apps/connect/src/main/ipc.ts` (Zeilen 37–39), Vorher:
```ts
    presenterLinked: presenterConnected(),
  };
}
```
Nachher:
```ts
    presenterLinked: presenterConnected(),
    zoom: null,
  };
}
```

`apps/connect/src/main/tray.ts` (Zeilen 19–20), Vorher:
```ts
  presenterLinked: false,
};
```
Nachher:
```ts
  presenterLinked: false,
  zoom: null,
};
```

Typcheck:
```
npm run typecheck -w @jm/connect
```
Erwartet: keine Fehlermeldung von `tsc`, Exitcode 0. Die Ausgabe besteht nur aus den npm-Kopfzeilen:
```
> @jm/connect@0.1.0 typecheck
> npm run typecheck:node && npm run typecheck:web

> @jm/connect@0.1.0 typecheck:node
> tsc --noEmit -p tsconfig.node.json

> @jm/connect@0.1.0 typecheck:web
> tsc --noEmit -p tsconfig.web.json
```
(`typecheck:web` liest `@jm/zoom-bridge/protocol` über `exports` → `packages/zoom-bridge/src/protocol.ts`; die Datei hat keine Importe, darum genügt das.)

- [ ] **Step 5: Fehlschlagenden Test schreiben** (`apps/connect/test/zoom-text.test.ts`, neu)

Tabellengetrieben nach Spec 7.6. `T72`, `Z_JE_ZUSTAND`, `GRUND_72`, `ERLAUBNIS`, `T75` sind `Record` über `ZoomZ`, `ZoomZustand`, `ZoomMangel` und `ZoomErlaubnis`: Eine neue Zustandsart ohne Tabellenzeile scheitert im Typcheck; die Zählprüfungen im ersten Block fangen sie auch zur Laufzeit (der CI-Schritt `selftest` läuft ohne Typcheck).
```ts
// Zoom-Statustexte und Klartexte OHNE Electron (tsx): npm run selftest -w @jm/connect
// Spec 7.6: tabellengetrieben, jede Zeile aus 7.2, 7.3, 7.4 und 7.5 wörtlich, für jeden Zustand mit
// n ∈ {0, 2} (Singular mit n = 1), g ∈ {0, 1} und o ∈ {0, 1}, soweit 7.1 die Kombination zulässt.
// Die Tabellen sind Record<ZoomZ | ZoomZustand | ZoomErlaubnis | ZoomMangel, …>: eine neue
// Zustandsart ohne Tabellenzeile scheitert im Typcheck, und die Zählprüfungen unten fangen
// denselben Fehler zur Laufzeit (die CI startet diese Datei ohne Typcheck).
import type { AppStatus, ProxyKeySource, ZoomAbbild, ZoomErlaubnis, ZoomKurz, ZoomMangel, ZoomZustand } from '../src/shared/types';
import {
  gaesteZeile, kartenZeile, MANGEL_GRUND, sdkKnopf, sdkZeile, stateKvAus, TEXT_A4, TEXT_A6, trayTooltip,
  trayVerlassenAktiv, zoomKnoepfe, zoomZ, zoomZeile, zugangZeile, type ZoomStatusWert, type ZoomZ,
} from '../src/shared/zoom-text';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

// ── Testhilfen ──
function kurz(z: Partial<ZoomKurz> = {}): ZoomKurz {
  return {
    zustand: 'bereit', warten: null, erlaubnis: null, quellen: 0, ohneBild: 0, sollOffen: 0,
    versuch: null, maengel: [], kopieLaeuft: false, ...z,
  };
}
function abbild(a: Omit<Partial<ZoomAbbild>, 'kurz'> & { kurz?: Partial<ZoomKurz> } = {}): ZoomAbbild {
  const { kurz: kz, ...rest } = a;
  return {
    kurz: kurz(kz),
    einrichtung: {
      sdk: { stand: 'ok', fassung: '7.1.5.43953', kopie: null, text: null },
      zugang: { herkunft: 'stored', clientIdEnde: '1234', text: null },
    },
    anzeigename: 'Regie Süd',
    versatz: { gewuenschtMs: 0, bestaetigtMs: null },
    teilnehmer: [], soll: [], abriss: null, meldung: null, hinweise: [],
    erneutMoeglich: false, pruefungLaeuft: false,
    ...rest,
  };
}
function status(g: number, configured: boolean, zoom: ZoomKurz | null): AppStatus {
  return {
    configured, proxyBase: null, proxyKeySource: 'none', controlPort: 8737, ndiSenders: g,
    programState: 'off', programSource: null, presenterLinked: false, zoom,
  };
}

const JETZT = 1_000_000;
const MIB = 1024 * 1024;

// ── Spec 7.1/7.2: je Zeile die Lage, die zulässigen (n, k) und beide Spalten wörtlich ──
interface Fall72 {
  lage: Partial<ZoomKurz>;
  abbild?: Omit<Partial<ZoomAbbild>, 'kurz'>;
  /** Geprüfte Paare (n, k) — nur, was 7.1 zulässt. */
  nk: Array<[number, number]>;
  tray: (n: number, k: number) => string | null;
  karte: (n: number, k: number) => string | null;
}
const q = (n: number): string => (n === 1 ? '1 Quelle' : `${n} Quellen`);
const T72: Record<ZoomZ, Fall72> = {
  Z0: { lage: { zustand: 'nicht_verfuegbar' }, nk: [[0, 0]], tray: () => null, karte: () => null },
  Z1a: {
    lage: { zustand: 'einrichtung', maengel: ['sdk_fehlt', 'zugang_fehlt'] }, nk: [[0, 0]],
    tray: () => '△ Zoom: Einrichtung unvollständig',
    karte: () => 'Zoom ist nicht vollständig eingerichtet: SDK-Ordner fehlt · Zugangsdaten fehlen.',
  },
  Z1b: {
    lage: { zustand: 'einrichtung', maengel: ['sdk_fehlt'], kopieLaeuft: true },
    abbild: {
      einrichtung: {
        sdk: { stand: 'kopiert', fassung: null, kopie: { dateien: 40, dateienGesamt: 153, bytes: 105_500_000, bytesGesamt: 329_657_415 }, text: null },
        zugang: { herkunft: 'stored', clientIdEnde: '1234', text: null },
      },
    },
    nk: [[0, 0]],
    tray: () => '◌ Zoom: Einrichtung läuft',
    // 105 500 000 B = 100,6 MiB → 101; 329 657 415 B = 314,4 MiB → 314 (Math.round, L7)
    karte: () => 'Zoom-SDK wird kopiert: 40 von 153 Dateien (101 von 314 MB).',
  },
  Z2: { lage: { zustand: 'bereit' }, nk: [[0, 0]], tray: () => '○ Zoom: kein Meeting', karte: () => 'Bereit. Meeting-Nummer und Kenncode eingeben.' },
  Z3: { lage: { zustand: 'startet' }, nk: [[0, 0], [2, 0]], tray: () => '◌ Zoom: meldet sich an …', karte: () => 'Melde mich bei Zoom an …' },
  Z4: { lage: { zustand: 'tritt_bei' }, nk: [[0, 0], [2, 1]], tray: () => '◌ Zoom: tritt dem Meeting bei …', karte: () => 'Trete dem Meeting bei …' },
  Z5a: {
    lage: { zustand: 'warteraum', warten: 'warteraum' }, nk: [[0, 0], [2, 0]],
    tray: () => '◌ Zoom: im Warteraum', karte: () => 'Im Warteraum. Der Host muss „Regie Süd“ zulassen.',
  },
  Z5b: {
    lage: { zustand: 'warteraum', warten: 'host' }, nk: [[0, 0], [2, 0]],
    tray: () => '◌ Zoom: wartet auf den Host', karte: () => 'Das Meeting hat noch nicht begonnen. Warte auf den Host.',
  },
  Z6: {
    lage: { zustand: 'im_meeting', erlaubnis: 'offen' }, nk: [[0, 0]],
    tray: () => '◌ Zoom: im Meeting, Aufnahme-Erlaubnis ausstehend',
    karte: () => 'Im Meeting. Warte auf die Aufnahme-Erlaubnis: Der Host muss sie im Zoom-Client für „Regie Süd“ erteilen.',
  },
  Z7: {
    lage: { zustand: 'im_meeting', erlaubnis: 'abgelehnt' }, nk: [[0, 0]],
    tray: () => '△ Zoom: im Meeting ohne Aufnahme-Erlaubnis',
    karte: () => 'Im Meeting ohne Aufnahme-Erlaubnis. Der Host hat abgelehnt. Der Host kann sie im Zoom-Client jederzeit erteilen; Connect merkt das von selbst.',
  },
  Z7b: {
    lage: { zustand: 'im_meeting', erlaubnis: 'abgelehnt' }, nk: [[2, 0], [2, 2], [1, 1]],
    tray: (n) => `△ Zoom: ${q(n)}, Aufnahme-Erlaubnis fehlt`,
    karte: (n) => n === 1
      ? 'Die Aufnahme-Erlaubnis fehlt (vom Host abgelehnt). 1 Quelle besteht noch. Der Host kann sie im Zoom-Client erteilen.'
      : `Die Aufnahme-Erlaubnis fehlt (vom Host abgelehnt). ${n} Quellen bestehen noch. Der Host kann sie im Zoom-Client erteilen.`,
  },
  Z8: {
    lage: { zustand: 'im_meeting', erlaubnis: 'ja' }, nk: [[0, 0]],
    tray: () => '○ Zoom: im Meeting, keine Quelle geladen', karte: () => 'Im Meeting. Personen unten als Quelle laden.',
  },
  Z9: {
    lage: { zustand: 'im_meeting', erlaubnis: 'ja' }, nk: [[2, 0], [1, 0]],
    tray: (n) => `● Zoom: ${q(n)} geladen`, karte: (n) => `Im Meeting. ${q(n)} geladen.`,
  },
  Z9b: {
    lage: { zustand: 'im_meeting', erlaubnis: 'ja' }, nk: [[2, 1], [2, 2], [1, 1]],
    tray: (n, k) => `● Zoom: ${q(n)} geladen, ${k} ohne Bild`,
    karte: (n, k) => `Im Meeting. ${q(n)} geladen, ${k} davon ohne Bild (Kamera aus, Person weg oder erstes Bild steht noch aus).`,
  },
  Z10: {
    lage: { zustand: 'abriss', versuch: null }, nk: [[0, 0], [2, 2]],
    tray: () => '△ Zoom: Verbindung unterbrochen, Zoom verbindet neu',
    karte: () => 'Verbindung unterbrochen. Zoom versucht selbst, neu zu verbinden …',
  },
  Z11: {
    lage: { zustand: 'abriss', versuch: 2 }, abbild: { abriss: { versuch: 2, versuche: 5, naechsterUm: JETZT + 4200 } },
    nk: [[0, 0], [2, 2]],
    tray: () => '△ Zoom: Verbindung verloren, Wiederbeitritt 2 von 5',
    karte: () => 'Verbindung zum Meeting verloren. Wiederbeitritt 2 von 5 in 5 s.',
  },
  Z12: { lage: { zustand: 'verlaesst' }, nk: [[0, 0], [2, 0]], tray: () => '◌ Zoom: verlässt das Meeting …', karte: () => 'Verlasse das Meeting …' },
  Z13: {
    lage: { zustand: 'fehler' },
    abbild: { meldung: { art: 'fehler', text: 'Beitritt gescheitert: falscher Kenncode.', detail: 'MEETING_FAIL_PASSWORD_ERR (4)' } },
    nk: [[0, 0], [2, 0]],
    tray: () => '✕ Zoom: Fehler, siehe Connect-Fenster', karte: () => 'Beitritt gescheitert: falscher Kenncode.',
  },
};
/** Abbild für Zeile z mit n Quellen, davon k ohne Bild, o offenen Soll-Einträgen. */
function lage(z: ZoomZ, n: number, k: number, o = 0): ZoomAbbild {
  const f = T72[z];
  return abbild({ ...f.abbild, kurz: { ...f.lage, quellen: n, ohneBild: k, sollOffen: o } });
}

// Zustand → mögliche Zeilen (Spec 7.1). Record über ZoomZustand: ein neuer Zustand scheitert im Typcheck.
const Z_JE_ZUSTAND: Record<ZoomZustand, ZoomZ[]> = {
  nicht_verfuegbar: ['Z0'], einrichtung: ['Z1a', 'Z1b'], bereit: ['Z2'], startet: ['Z3'], tritt_bei: ['Z4'],
  warteraum: ['Z5a', 'Z5b'], im_meeting: ['Z6', 'Z7', 'Z7b', 'Z8', 'Z9', 'Z9b'], abriss: ['Z10', 'Z11'],
  verlaesst: ['Z12'], fehler: ['Z13'],
};

console.log('— Vollständigkeit der Tabellen (Spec 7.6)');
{
  const zeilen = Object.keys(T72) as ZoomZ[];
  ck('7.2 hat 18 Zeilen (Z0 bis Z13 mit a/b)', zeilen.length === 18);
  ck('ZoomZustand hat 10 Werte', Object.keys(Z_JE_ZUSTAND).length === 10);
  const ausZustaenden = Object.values(Z_JE_ZUSTAND).flat().sort();
  ck('jede Zeile gehört zu genau einem Zustand', JSON.stringify(ausZustaenden) === JSON.stringify([...zeilen].sort()));
  ck('jeder Zustand führt zu seiner Zeile', zeilen.every((z) => Z_JE_ZUSTAND[T72[z].lage.zustand ?? 'bereit'].includes(z)));
}

console.log('— 7.1/7.2: zoomZ, Tray-/Kopfzeile und Kartentext je Zeile, n ∈ {0, 2}, Singular n = 1');
for (const z of Object.keys(T72) as ZoomZ[]) {
  for (const [n, k] of T72[z].nk) {
    const a = lage(z, n, k);
    ck(`${z} (n=${n}, k=${k}): zoomZ`, zoomZ(a.kurz) === z);
    ck(`${z} (n=${n}, k=${k}): Tray/Kopfzeile wörtlich`, zoomZeile(a.kurz) === T72[z].tray(n, k));
    ck(`${z} (n=${n}, k=${k}): Kartentext wörtlich`, kartenZeile(a, JETZT) === T72[z].karte(n, k));
  }
}
ck('macOS (zoom: null) → keine Zoom-Zeile', zoomZeile(null) === null);

console.log('— 7.2 Sonderfälle: Prüfung, Countdown, Mängel');
{
  const pruef = abbild({ pruefungLaeuft: true });
  ck('Z2 während „Einrichtung prüfen“: Kartentext', kartenZeile(pruef, JETZT) === 'Prüfe die Einrichtung (Anmeldung bei Zoom, ohne Meeting) …');
  ck('Z2 während „Einrichtung prüfen“: Tray bleibt „kein Meeting“', zoomZeile(pruef.kurz) === '○ Zoom: kein Meeting');
  const laeuft = abbild({ kurz: { zustand: 'abriss', versuch: 3 }, abriss: { versuch: 3, versuche: 5, naechsterUm: null } });
  ck('Z11 ohne Wartezeit: „läuft …“', kartenZeile(laeuft, JETZT) === 'Verbindung zum Meeting verloren. Wiederbeitritt 3 von 5 läuft …');
  const vorbei = abbild({ kurz: { zustand: 'abriss', versuch: 1 }, abriss: { versuch: 1, versuche: 5, naechsterUm: JETZT - 500 } });
  ck('Z11 mit abgelaufener Wartezeit: 0 s, nie negativ', kartenZeile(vorbei, JETZT) === 'Verbindung zum Meeting verloren. Wiederbeitritt 1 von 5 in 0 s.');
  const genau = abbild({ kurz: { zustand: 'abriss', versuch: 1 }, abriss: { versuch: 1, versuche: 5, naechsterUm: JETZT + 2000 } });
  ck('Z11 mit genau 2 s: „in 2 s“', kartenZeile(genau, JETZT) === 'Verbindung zum Meeting verloren. Wiederbeitritt 1 von 5 in 2 s.');
  const ohneMeldung = abbild({ kurz: { zustand: 'fehler' } });
  ck('Z13 ohne Meldung: leerer Kartentext', kartenZeile(ohneMeldung, JETZT) === '');
}

// Mängel: Record über ZoomMangel — je Mangel der Grund aus 7.2 (Z1a) wörtlich.
const GRUND_72: Record<ZoomMangel, string> = {
  sdk_fehlt: 'SDK-Ordner fehlt',
  sdk_defekt: 'Zoom-Laufzeit unvollständig, bitte den SDK-Ordner erneut wählen',
  bridge_fehlt: 'Zoom-Bridge fehlt in dieser Installation, bitte JM Connect neu installieren',
  zugang_fehlt: 'Zugangsdaten fehlen',
  zugang_unlesbar: 'Zugangsdaten lassen sich nicht entschlüsseln, bitte die Datei erneut wählen',
};
{
  const alle = Object.keys(GRUND_72) as ZoomMangel[];
  ck('ZoomMangel hat 5 Werte, MANGEL_GRUND trägt alle', alle.length === 5 && Object.keys(MANGEL_GRUND).length === 5);
  for (const m of alle) {
    const a = abbild({ kurz: { zustand: 'einrichtung', maengel: [m] } });
    ck(`Z1a mit ${m}: Kartentext wörtlich`, kartenZeile(a, JETZT) === `Zoom ist nicht vollständig eingerichtet: ${GRUND_72[m]}.`);
  }
  const fuenf = abbild({ kurz: { zustand: 'einrichtung', maengel: alle } });
  ck('Z1a mit allen Mängeln: verbunden mit „ · “ in der gegebenen Reihenfolge',
    kartenZeile(fuenf, JETZT) === `Zoom ist nicht vollständig eingerichtet: ${alle.map((m) => GRUND_72[m]).join(' · ')}.`);
}

// Erlaubnis: Record über ZoomErlaubnis — je Wert die Zeile bei n = 0 und n = 2 und beide Kartentexte.
const ERLAUBNIS: Record<ZoomErlaubnis, { z0: ZoomZ; z2: ZoomZ; karte0: string; karte2: string }> = {
  offen: {
    z0: 'Z6', z2: 'Z7b',
    karte0: 'Im Meeting. Warte auf die Aufnahme-Erlaubnis: Der Host muss sie im Zoom-Client für „Regie Süd“ erteilen.',
    karte2: 'Die Aufnahme-Erlaubnis fehlt (angefragt, noch keine Antwort). 2 Quellen bestehen noch. Der Host kann sie im Zoom-Client erteilen.',
  },
  ja: { z0: 'Z8', z2: 'Z9', karte0: 'Im Meeting. Personen unten als Quelle laden.', karte2: 'Im Meeting. 2 Quellen geladen.' },
  abgelehnt: {
    z0: 'Z7', z2: 'Z7b',
    karte0: 'Im Meeting ohne Aufnahme-Erlaubnis. Der Host hat abgelehnt. Der Host kann sie im Zoom-Client jederzeit erteilen; Connect merkt das von selbst.',
    karte2: 'Die Aufnahme-Erlaubnis fehlt (vom Host abgelehnt). 2 Quellen bestehen noch. Der Host kann sie im Zoom-Client erteilen.',
  },
  abgelaufen: {
    z0: 'Z7', z2: 'Z7b',
    karte0: 'Im Meeting ohne Aufnahme-Erlaubnis. Zoom hat keine Antwort bekommen. Der Host kann sie im Zoom-Client jederzeit erteilen; Connect merkt das von selbst.',
    karte2: 'Die Aufnahme-Erlaubnis fehlt (keine Antwort bekommen). 2 Quellen bestehen noch. Der Host kann sie im Zoom-Client erteilen.',
  },
  entzogen: {
    z0: 'Z7', z2: 'Z7b',
    karte0: 'Im Meeting ohne Aufnahme-Erlaubnis. Der Host hat sie entzogen. Der Host kann sie im Zoom-Client jederzeit erteilen; Connect merkt das von selbst.',
    karte2: 'Die Aufnahme-Erlaubnis fehlt (vom Host entzogen). 2 Quellen bestehen noch. Der Host kann sie im Zoom-Client erteilen.',
  },
};
console.log('— 7.1/7.2 je Erlaubnis (n = 0 und n = 2)');
ck('ZoomErlaubnis hat 5 Werte', Object.keys(ERLAUBNIS).length === 5);
for (const e of Object.keys(ERLAUBNIS) as ZoomErlaubnis[]) {
  const a0 = abbild({ kurz: { zustand: 'im_meeting', erlaubnis: e, quellen: 0 } });
  const a2 = abbild({ kurz: { zustand: 'im_meeting', erlaubnis: e, quellen: 2, ohneBild: 0 } });
  ck(`${e}, n=0 → ${ERLAUBNIS[e].z0}, Kartentext wörtlich`, zoomZ(a0.kurz) === ERLAUBNIS[e].z0 && kartenZeile(a0, JETZT) === ERLAUBNIS[e].karte0);
  ck(`${e}, n=2 → ${ERLAUBNIS[e].z2}, Kartentext wörtlich`, zoomZ(a2.kurz) === ERLAUBNIS[e].z2 && kartenZeile(a2, JETZT) === ERLAUBNIS[e].karte2);
}
ck('im_meeting mit erlaubnis null zählt wie „offen“ (Z6)', zoomZ(kurz({ zustand: 'im_meeting', erlaubnis: null })) === 'Z6');

console.log('— 7.3 Gäste-Zeile');
ck('g = 2 → „● Gäste: 2 NDI-Quellen“', gaesteZeile(status(2, true, null)) === '● Gäste: 2 NDI-Quellen');
ck('g = 1 → Singular „1 NDI-Quelle“', gaesteZeile(status(1, true, null)) === '● Gäste: 1 NDI-Quelle');
ck('g > 0 auch ohne Cloud → Gäste-Zahl', gaesteZeile(status(2, false, null)) === '● Gäste: 2 NDI-Quellen');
ck('g = 0, Cloud eingerichtet', gaesteZeile(status(0, true, null)) === '○ Gäste: keine NDI-Quelle');
ck('g = 0, Cloud nicht eingerichtet', gaesteZeile(status(0, false, null)) === '△ Gäste: Cloud nicht eingerichtet');

console.log('— 7.4 Tooltip, Tabelle wörtlich (g ∈ {0, 1}, n ∈ {0, 2})');
const T74: Array<{ zs: ZoomZ[]; n: number; g0: string; g1: string }> = [
  { zs: ['Z0', 'Z1a', 'Z1b', 'Z2', 'Z3', 'Z4', 'Z5a', 'Z5b', 'Z6', 'Z7', 'Z8', 'Z12'], n: 0, g0: 'JM Connect', g1: 'JM Connect — Zuschaltungen aktiv' },
  { zs: ['Z3', 'Z4', 'Z5a', 'Z5b', 'Z7b', 'Z9', 'Z9b', 'Z12'], n: 2, g0: 'JM Connect — Zuschaltungen aktiv', g1: 'JM Connect — Zuschaltungen aktiv' },
  { zs: ['Z10', 'Z11'], n: 0, g0: 'JM Connect — Zoom-Verbindung unterbrochen', g1: 'JM Connect — Zuschaltungen aktiv · Zoom-Verbindung unterbrochen' },
  { zs: ['Z10', 'Z11'], n: 2, g0: 'JM Connect — Zuschaltungen aktiv · Zoom-Verbindung unterbrochen', g1: 'JM Connect — Zuschaltungen aktiv · Zoom-Verbindung unterbrochen' },
  { zs: ['Z13'], n: 0, g0: 'JM Connect — Zoom-Fehler', g1: 'JM Connect — Zuschaltungen aktiv · Zoom-Fehler' },
  { zs: ['Z13'], n: 2, g0: 'JM Connect — Zuschaltungen aktiv · Zoom-Fehler', g1: 'JM Connect — Zuschaltungen aktiv · Zoom-Fehler' },
];
{
  const abgedeckt = new Set(T74.flatMap((r) => r.zs));
  ck('jede Zeile aus 7.2 steht in der Tooltip-Tabelle', (Object.keys(T72) as ZoomZ[]).every((z) => abgedeckt.has(z)));
  for (const r of T74) {
    for (const z of r.zs) {
      const paar = T72[z].nk.find(([n]) => n === r.n);
      ck(`${z} mit n=${r.n} ist nach 7.1 zulässig`, paar !== undefined);
      if (!paar) continue;
      const k = lage(z, paar[0], paar[1]).kurz;
      ck(`${z}, n=${r.n}, g=0: „${r.g0}“`, trayTooltip(status(0, true, k)) === r.g0);
      ck(`${z}, n=${r.n}, g=1: „${r.g1}“`, trayTooltip(status(1, true, k)) === r.g1);
    }
  }
  ck('macOS (zoom: null), g=0 → „JM Connect“', trayTooltip(status(0, true, null)) === 'JM Connect');
  ck('macOS (zoom: null), g=1 → „JM Connect — Zuschaltungen aktiv“', trayTooltip(status(1, true, null)) === 'JM Connect — Zuschaltungen aktiv');
}

console.log('— 7.3 Tray „Zoom-Meeting verlassen“ aktiv in Z3–Z11');
{
  const aktiv: ZoomZ[] = ['Z3', 'Z4', 'Z5a', 'Z5b', 'Z6', 'Z7', 'Z7b', 'Z8', 'Z9', 'Z9b', 'Z10', 'Z11'];
  for (const z of Object.keys(T72) as ZoomZ[]) {
    const [n, k] = T72[z].nk[0];
    ck(`${z}: Verlassen ${aktiv.includes(z) ? 'aktiv' : 'gesperrt'}`, trayVerlassenAktiv(lage(z, n, k).kurz) === aktiv.includes(z));
  }
  ck('macOS (null): Verlassen gesperrt', trayVerlassenAktiv(null) === false);
}

console.log('— 7.5 STATE je Zustand, o ∈ {0, 1}');
// alarm1 null = „–“ in der Spec-Tabelle (o > 0 kommt in dieser Zeile nicht vor).
const T75: Record<Exclude<ZoomZ, 'Z0'>, { status: ZoomStatusWert; privilege: 0 | 1; alarm0: 0 | 1; alarm1: 0 | 1 | null }> = {
  Z1a: { status: 'einrichtung', privilege: 0, alarm0: 0, alarm1: null },
  Z1b: { status: 'einrichtung', privilege: 0, alarm0: 0, alarm1: null },
  Z2: { status: 'bereit', privilege: 0, alarm0: 0, alarm1: null },
  Z3: { status: 'tritt_bei', privilege: 0, alarm0: 0, alarm1: 1 },
  Z4: { status: 'tritt_bei', privilege: 0, alarm0: 0, alarm1: 1 },
  Z5a: { status: 'warteraum', privilege: 0, alarm0: 0, alarm1: 1 },
  Z5b: { status: 'warteraum', privilege: 0, alarm0: 0, alarm1: 1 },
  Z6: { status: 'im_meeting', privilege: 0, alarm0: 0, alarm1: 1 },
  Z7: { status: 'im_meeting', privilege: 0, alarm0: 1, alarm1: 1 },
  Z7b: { status: 'im_meeting', privilege: 0, alarm0: 1, alarm1: 1 },
  Z8: { status: 'im_meeting', privilege: 1, alarm0: 0, alarm1: 1 },
  Z9: { status: 'im_meeting', privilege: 1, alarm0: 0, alarm1: 1 },
  Z9b: { status: 'im_meeting', privilege: 1, alarm0: 0, alarm1: 1 },
  Z10: { status: 'abriss', privilege: 0, alarm0: 1, alarm1: 1 },
  Z11: { status: 'abriss', privilege: 0, alarm0: 1, alarm1: 1 },
  Z12: { status: 'verlaesst', privilege: 0, alarm0: 0, alarm1: 0 },
  Z13: { status: 'fehler', privilege: 0, alarm0: 1, alarm1: 1 },
};
{
  ck('7.5 hat 17 Zeilen (alle außer Z0)', Object.keys(T75).length === 17);
  ck('Z0 (macOS): keine zoom_*-Schlüssel', stateKvAus(lage('Z0', 0, 0).kurz) === null);
  for (const z of Object.keys(T75) as Array<Exclude<ZoomZ, 'Z0'>>) {
    const soll = T75[z];
    for (const [n, k] of T72[z].nk) {
      for (const o of [0, 1]) {
        const alarm = o === 0 ? soll.alarm0 : soll.alarm1;
        if (alarm === null) continue;
        const kv = stateKvAus(lage(z, n, k, o).kurz);
        ck(`${z} (n=${n}, o=${o}): zoom_status=${soll.status}, sources=${n}, live=${n > 0 ? 1 : 0}, privilege=${soll.privilege}, alarm=${alarm}`,
          kv !== null && kv.zoom_status === soll.status && kv.zoom_sources === n && kv.zoom_live === (n > 0 ? 1 : 0)
          && kv.zoom_privilege === soll.privilege && kv.zoom_alarm === alarm);
      }
    }
  }
  const kv = stateKvAus(lage('Z9', 2, 0, 1).kurz);
  ck('STATE trägt genau die fünf Zoom-Schlüssel (keine Namen, keine Nummer)',
    kv !== null && JSON.stringify(Object.keys(kv).sort()) === '["zoom_alarm","zoom_live","zoom_privilege","zoom_sources","zoom_status"]');
}

console.log('— Einrichtungszeilen (Spec 9 Punkt 3)');
{
  ck('TEXT_A4 wörtlich', TEXT_A4 === 'Nur für diese Sitzung gemerkt — auf diesem Rechner gibt es keinen Schlüsselbund.');
  ck('TEXT_A6 wörtlich', TEXT_A6 === 'Kommt aus Umgebungsvariablen (ZOOM_SDK_…) und hat Vorrang.');
  const ohne = abbild();
  ck('SDK eingerichtet: „Zoom-SDK 7.1.5.43953 eingerichtet“ / „Neu wählen …“',
    sdkZeile(ohne) === 'Zoom-SDK 7.1.5.43953 eingerichtet' && sdkKnopf(ohne) === 'Neu wählen …');
  const fehlt = abbild({ kurz: { zustand: 'einrichtung', maengel: ['sdk_fehlt'] } });
  ck('sdk_fehlt: „Zoom-SDK: nicht eingerichtet“ / „SDK-Ordner wählen …“',
    sdkZeile(fehlt) === 'Zoom-SDK: nicht eingerichtet' && sdkKnopf(fehlt) === 'SDK-Ordner wählen …');
  const defekt = abbild({ kurz: { zustand: 'einrichtung', maengel: ['sdk_defekt'] } });
  ck('sdk_defekt: „Zoom-SDK: Laufzeit unvollständig“ / „Neu wählen …“',
    sdkZeile(defekt) === 'Zoom-SDK: Laufzeit unvollständig' && sdkKnopf(defekt) === 'Neu wählen …');
  const bridge = abbild({ kurz: { zustand: 'einrichtung', maengel: ['bridge_fehlt'] } });
  ck('bridge_fehlt: das SDK selbst gilt als eingerichtet', sdkZeile(bridge) === 'Zoom-SDK 7.1.5.43953 eingerichtet');

  const ZUGANG: Record<ProxyKeySource, string> = {
    stored: 'Zugangsdaten: hinterlegt (Client-ID endet auf ab12)',
    session: TEXT_A4,
    env: TEXT_A6,
    none: 'Zugangsdaten: fehlen',
  };
  for (const h of Object.keys(ZUGANG) as ProxyKeySource[]) {
    const a = abbild({ einrichtung: { sdk: ohne.einrichtung.sdk, zugang: { herkunft: h, clientIdEnde: h === 'none' ? null : 'ab12', text: null } } });
    ck(`Zugangsdaten, Herkunft ${h}: wörtlich`, zugangZeile(a) === ZUGANG[h]);
  }
  const unlesbar = abbild({
    kurz: { zustand: 'einrichtung', maengel: ['zugang_unlesbar'] },
    einrichtung: { sdk: ohne.einrichtung.sdk, zugang: { herkunft: 'none', clientIdEnde: null, text: null } },
  });
  ck('zugang_unlesbar: „Zugangsdaten: lassen sich nicht entschlüsseln“', zugangZeile(unlesbar) === 'Zugangsdaten: lassen sich nicht entschlüsseln');
}

console.log('— Knöpfe der Karte je Lage (Spec 9 Punkte 2–6)');
{
  const fehler = abbild({
    kurz: { zustand: 'fehler' }, erneutMoeglich: true,
    meldung: { art: 'fehler', text: 'Beitritt gescheitert: falscher Kenncode.', detail: 'MEETING_FAIL_PASSWORD_ERR (4)' },
  });
  const kf = zoomKnoepfe(fehler);
  ck('Z13 mit Daten: „Erneut beitreten“ + „Schließen“, kein „OK“',
    JSON.stringify(kf.meldung) === JSON.stringify({ erneut: true, schliessen: true, ok: false, logordner: false }));
  ck('Z13: Beitritt sichtbar, Einrichtung änderbar, nicht „Verlassen“', kf.beitrittSichtbar && kf.einrichtungAenderbar && !kf.verlassen && kf.pruefen === 'aus');
  const kf2 = zoomKnoepfe({ ...fehler, erneutMoeglich: false });
  ck('Z13 ohne Daten: nur „Schließen“', JSON.stringify(kf2.meldung) === JSON.stringify({ erneut: false, schliessen: true, ok: false, logordner: false }));

  const ende = abbild({ erneutMoeglich: true, meldung: { art: 'warnung', text: 'Meeting beendet: vom Gastgeber beendet.', detail: null } });
  ck('Z2 nach Meeting-Ende: „Erneut beitreten“ + „Schließen“',
    JSON.stringify(zoomKnoepfe(ende).meldung) === JSON.stringify({ erneut: true, schliessen: true, ok: false, logordner: false }));

  const info = abbild({ meldung: { art: 'info', text: 'Einrichtung in Ordnung: Zoom-SDK 7.1.5 (43953), Anmeldung bei Zoom erfolgreich.', detail: null } });
  ck('Z2 mit Info-Meldung: nur „OK“', JSON.stringify(zoomKnoepfe(info).meldung) === JSON.stringify({ erneut: false, schliessen: false, ok: true, logordner: false }));
  // Nach einem Meeting-Ende stehen Nummer und Kenncode noch im Speicher; „Einrichtung prüfen“ bleibt in Z2 erlaubt.
  const pruefungNachEnde = abbild({ erneutMoeglich: true, meldung: info.meldung });
  ck('Z2 mit erneutMoeglich und Info-Meldung (Ergebnis von „Einrichtung prüfen“): nur „OK“',
    JSON.stringify(zoomKnoepfe(pruefungNachEnde).meldung) === JSON.stringify({ erneut: false, schliessen: false, ok: true, logordner: false }));
  const pruefFehlerNachEnde = abbild({ erneutMoeglich: true, meldung: { art: 'fehler', text: 'Das Zoom-SDK ließ sich nicht starten (SDKERR_UNINITIALIZE). Details im Log.', detail: null } });
  ck('Z2 mit erneutMoeglich und Fehler-Meldung der Prüfung: „OK“ und „Logordner öffnen“, kein „Erneut“',
    JSON.stringify(zoomKnoepfe(pruefFehlerNachEnde).meldung) === JSON.stringify({ erneut: false, schliessen: false, ok: true, logordner: true }));
  const q7 = abbild({ meldung: { art: 'fehler', text: 'NDI ließ sich in der Zoom-Bridge nicht starten. Details im Log.', detail: null } });
  ck('Text mit „Details im Log“: zusätzlich „Logordner öffnen“', JSON.stringify(zoomKnoepfe(q7).meldung) === JSON.stringify({ erneut: false, schliessen: false, ok: true, logordner: true }));
  const imLog13 = zoomKnoepfe({ ...fehler, meldung: { art: 'fehler', text: 'Das Zoom-SDK ließ sich nicht starten (SDKERR_UNINITIALIZE). Details im Log.', detail: null } });
  ck('Z13 mit „Details im Log“: Logordner-Knopf', imLog13.meldung?.logordner === true && imLog13.meldung.schliessen);
  ck('ohne Meldung: kein Meldungsbereich', zoomKnoepfe(abbild()).meldung === null);
  const imMeetingMitMeldung = zoomKnoepfe(abbild({ kurz: { zustand: 'im_meeting', erlaubnis: 'ja' }, erneutMoeglich: true,
    meldung: { art: 'warnung', text: 'Zoom hat die Anfrage nach der Aufnahme-Erlaubnis nicht angenommen (SDKERR_NO_PERMISSION). Der Host kann sie im Zoom-Client trotzdem erteilen.', detail: null } }));
  ck('Meldung im Meeting (Q12): „OK“, nicht „Erneut“', JSON.stringify(imMeetingMitMeldung.meldung) === JSON.stringify({ erneut: false, schliessen: false, ok: true, logordner: false }));

  const bereit = zoomKnoepfe(abbild());
  ck('Z2: Einrichtung änderbar, „Einrichtung prüfen“ bereit, Beitreten frei',
    bereit.einrichtungAenderbar && bereit.pruefen === 'bereit' && bereit.beitrittSichtbar && !bereit.beitretenGesperrt && !bereit.verlassen);
  const pruefung = zoomKnoepfe(abbild({ pruefungLaeuft: true }));
  ck('Z2 mit laufender Prüfung: Einrichtung gesperrt (S10), „Prüfe …“, Beitreten gesperrt',
    !pruefung.einrichtungAenderbar && pruefung.pruefen === 'laeuft' && pruefung.beitrittSichtbar && pruefung.beitretenGesperrt);

  const z1a = zoomKnoepfe(abbild({ kurz: { zustand: 'einrichtung', maengel: ['zugang_fehlt'] } }));
  ck('Z1a: kein Beitritt, Sperrhinweis, Einrichtung offen und änderbar, keine Prüfung',
    !z1a.beitrittSichtbar && z1a.sperrHinweis && z1a.einrichtungOffen && z1a.einrichtungAenderbar && z1a.pruefen === 'aus');
  const z1b = zoomKnoepfe(abbild({ kurz: { zustand: 'einrichtung', maengel: ['sdk_fehlt'], kopieLaeuft: true } }));
  ck('Z1b: Einrichtung während der Kopie gesperrt', !z1b.einrichtungAenderbar && z1b.sperrHinweis && !z1b.beitrittSichtbar);
  ck('ohne Mängel: Einrichtung eingeklappt, kein Sperrhinweis', !bereit.einrichtungOffen && !bereit.sperrHinweis);

  const imMeeting = zoomKnoepfe(lage('Z9', 2, 0));
  ck('im Meeting: Einrichtung gesperrt (S10), „Meeting verlassen“, kein Beitritt',
    !imMeeting.einrichtungAenderbar && imMeeting.verlassen && !imMeeting.beitrittSichtbar && imMeeting.pruefen === 'aus');
  ck('Z10: „Meeting verlassen“, kein „Abbrechen“', zoomKnoepfe(lage('Z10', 0, 0)).verlassen && !zoomKnoepfe(lage('Z10', 0, 0)).abbrechen);
  ck('Z11: „Meeting verlassen“ und „Abbrechen“', zoomKnoepfe(lage('Z11', 0, 0)).verlassen && zoomKnoepfe(lage('Z11', 0, 0)).abbrechen);
  ck('Z12: kein „Meeting verlassen“ mehr', !zoomKnoepfe(lage('Z12', 0, 0)).verlassen);
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Step 6: Test laufen lassen (rot)**

```
npx tsx apps/connect/test/zoom-text.test.ts
```
Erwartet: Abbruch beim Laden, Exitcode 1, mit
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\connect\src\shared\zoom-text' imported from …\apps\connect\test\zoom-text.test.ts
```

- [ ] **Step 7: `src/shared/zoom-text.ts` schreiben** (neu)

Alle Texte stehen wörtlich in Spec 7.2, 7.3, 7.4 und 9 (Punkt 3); der Tooltip ist der Code aus 7.4. `STATE_JE_Z` ist Tabelle 7.5 Zeile für Zeile (`alarm[0]` bei o = 0, `alarm[1]` bei o > 0). Singular „1 Quelle“ auch in den Kartentexten Z7b/Z9/Z9b (Spec regelt ihn nur für die Tray-Zeile, L6). MB in Z1b = `Math.round(bytes / 1024 / 1024)` (L7).
```ts
// Zoom-Statustexte: EINE Quelle für Tray, Kopfzeile, Zoom-Karte und STATE (Spec 7).
// Grundsatz „Eine dauerhafte Statuszeile lügt leichter“: jeder Text muss in JEDEM Zustand wahr
// sein, in dem er steht. Darum feste Zeilen je Zustand (Z0–Z13, Spec 7.1) und eine einzige
// Zuordnung zoomZ(), aus der alle Funktionen hier lesen.
//
// Rein: keine Laufzeit-Importe, keine node:-Module. Der Renderer-tsconfig prüft diese Datei mit,
// und die Karte (ZoomCard.tsx) nutzt sie direkt.
import type { AppStatus, ProxyKeySource, ZoomAbbild, ZoomErlaubnis, ZoomKurz, ZoomMangel } from './types';

/** Die Zeilen der Zustandstabelle Spec 7.1. */
export type ZoomZ =
  | 'Z0' | 'Z1a' | 'Z1b' | 'Z2' | 'Z3' | 'Z4' | 'Z5a' | 'Z5b' | 'Z6'
  | 'Z7' | 'Z7b' | 'Z8' | 'Z9' | 'Z9b' | 'Z10' | 'Z11' | 'Z12' | 'Z13';

/** Text A4 (Spec 8.1). Steht hier, weil Karte und Kern ihn beide brauchen; klartext.ts übernimmt ihn. */
export const TEXT_A4 = 'Nur für diese Sitzung gemerkt — auf diesem Rechner gibt es keinen Schlüsselbund.';
/** Text A6 (Spec 8.1). */
export const TEXT_A6 = 'Kommt aus Umgebungsvariablen (ZOOM_SDK_…) und hat Vorrang.';

/** Gründe im Kartentext Z1a (Spec 7.2), je Mangel einer. */
export const MANGEL_GRUND: Record<ZoomMangel, string> = {
  sdk_fehlt: 'SDK-Ordner fehlt',
  sdk_defekt: 'Zoom-Laufzeit unvollständig, bitte den SDK-Ordner erneut wählen',
  bridge_fehlt: 'Zoom-Bridge fehlt in dieser Installation, bitte JM Connect neu installieren',
  zugang_fehlt: 'Zugangsdaten fehlen',
  zugang_unlesbar: 'Zugangsdaten lassen sich nicht entschlüsseln, bitte die Datei erneut wählen',
};

/** Spec 7.1: Zustand + Erlaubnis + n + k → Zeile der Tabelle. */
export function zoomZ(k: ZoomKurz): ZoomZ {
  switch (k.zustand) {
    case 'nicht_verfuegbar':
      return 'Z0';
    case 'einrichtung':
      return k.kopieLaeuft ? 'Z1b' : 'Z1a';
    case 'bereit':
      return 'Z2';
    case 'startet':
      return 'Z3';
    case 'tritt_bei':
      return 'Z4';
    case 'warteraum':
      return k.warten === 'host' ? 'Z5b' : 'Z5a';
    case 'im_meeting': {
      // erlaubnis ist in im_meeting immer gesetzt (Spec 5.4); null zählt wie „ausstehend“.
      const e = k.erlaubnis ?? 'offen';
      if (e === 'ja') return k.quellen === 0 ? 'Z8' : k.ohneBild === 0 ? 'Z9' : 'Z9b';
      if (k.quellen > 0) return 'Z7b';
      return e === 'offen' ? 'Z6' : 'Z7';
    }
    case 'abriss':
      return k.versuch === null ? 'Z10' : 'Z11';
    case 'verlaesst':
      return 'Z12';
    case 'fehler':
      return 'Z13';
  }
}

/** „1 Quelle“ / „2 Quellen“ (Spec 7.2: Singular bei 1). */
function quellenText(n: number): string {
  return n === 1 ? '1 Quelle' : `${n} Quellen`;
}

/**
 * Zoom-Zeile für Tray-Menü UND Kopfzeile (Spec 7.2, linke Spalte). null = keine Zeile
 * (kein Zoom auf dieser Plattform).
 */
export function zoomZeile(k: ZoomKurz | null): string | null {
  if (k === null) return null;
  switch (zoomZ(k)) {
    case 'Z0':
      return null;
    case 'Z1a':
      return '△ Zoom: Einrichtung unvollständig';
    case 'Z1b':
      return '◌ Zoom: Einrichtung läuft';
    case 'Z2':
      return '○ Zoom: kein Meeting';
    case 'Z3':
      return '◌ Zoom: meldet sich an …';
    case 'Z4':
      return '◌ Zoom: tritt dem Meeting bei …';
    case 'Z5a':
      return '◌ Zoom: im Warteraum';
    case 'Z5b':
      return '◌ Zoom: wartet auf den Host';
    case 'Z6':
      return '◌ Zoom: im Meeting, Aufnahme-Erlaubnis ausstehend';
    case 'Z7':
      return '△ Zoom: im Meeting ohne Aufnahme-Erlaubnis';
    case 'Z7b':
      return `△ Zoom: ${quellenText(k.quellen)}, Aufnahme-Erlaubnis fehlt`;
    case 'Z8':
      return '○ Zoom: im Meeting, keine Quelle geladen';
    case 'Z9':
      return `● Zoom: ${quellenText(k.quellen)} geladen`;
    case 'Z9b':
      return `● Zoom: ${quellenText(k.quellen)} geladen, ${k.ohneBild} ohne Bild`;
    case 'Z10':
      return '△ Zoom: Verbindung unterbrochen, Zoom verbindet neu';
    case 'Z11':
      return `△ Zoom: Verbindung verloren, Wiederbeitritt ${k.versuch} von 5`;
    case 'Z12':
      return '◌ Zoom: verlässt das Meeting …';
    case 'Z13':
      return '✕ Zoom: Fehler, siehe Connect-Fenster';
  }
}

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

/** Bytes → MB für Z1b, gerundet (MiB, wie Windows rechnet). */
function mb(bytes: number): number {
  return Math.round(bytes / 1024 / 1024);
}

/**
 * Statuszeile der Zoom-Karte (Spec 7.2, rechte Spalte). `jetztMs` nur für den Countdown in Z11.
 * null = keine Karte (Z0).
 */
export function kartenZeile(a: ZoomAbbild, jetztMs: number): string | null {
  const k = a.kurz;
  const e = k.erlaubnis ?? 'offen';
  switch (zoomZ(k)) {
    case 'Z0':
      return null;
    case 'Z1a':
      return `Zoom ist nicht vollständig eingerichtet: ${k.maengel.map((m) => MANGEL_GRUND[m]).join(' · ')}.`;
    case 'Z1b': {
      const c = a.einrichtung.sdk.kopie ?? { dateien: 0, dateienGesamt: 0, bytes: 0, bytesGesamt: 0 };
      return `Zoom-SDK wird kopiert: ${c.dateien} von ${c.dateienGesamt} Dateien (${mb(c.bytes)} von ${mb(c.bytesGesamt)} MB).`;
    }
    case 'Z2':
      return a.pruefungLaeuft
        ? 'Prüfe die Einrichtung (Anmeldung bei Zoom, ohne Meeting) …'
        : 'Bereit. Meeting-Nummer und Kenncode eingeben.';
    case 'Z3':
      return 'Melde mich bei Zoom an …';
    case 'Z4':
      return 'Trete dem Meeting bei …';
    case 'Z5a':
      return `Im Warteraum. Der Host muss „${a.anzeigename}“ zulassen.`;
    case 'Z5b':
      return 'Das Meeting hat noch nicht begonnen. Warte auf den Host.';
    case 'Z6':
      return `Im Meeting. Warte auf die Aufnahme-Erlaubnis: Der Host muss sie im Zoom-Client für „${a.anzeigename}“ erteilen.`;
    case 'Z7':
      // zoomZ liefert Z7 nur für abgelehnt/abgelaufen/entzogen.
      return `Im Meeting ohne Aufnahme-Erlaubnis. ${Z7_GRUND[e as keyof typeof Z7_GRUND]} Der Host kann sie im Zoom-Client jederzeit erteilen; Connect merkt das von selbst.`;
    case 'Z7b':
      return `Die Aufnahme-Erlaubnis fehlt (${Z7B_GRUND[e as keyof typeof Z7B_GRUND]}). ${quellenText(k.quellen)} ${k.quellen === 1 ? 'besteht' : 'bestehen'} noch. Der Host kann sie im Zoom-Client erteilen.`;
    case 'Z8':
      return 'Im Meeting. Personen unten als Quelle laden.';
    case 'Z9':
      return `Im Meeting. ${quellenText(k.quellen)} geladen.`;
    case 'Z9b':
      return `Im Meeting. ${quellenText(k.quellen)} geladen, ${k.ohneBild} davon ohne Bild (Kamera aus, Person weg oder erstes Bild steht noch aus).`;
    case 'Z10':
      return 'Verbindung unterbrochen. Zoom versucht selbst, neu zu verbinden …';
    case 'Z11': {
      const naechsterUm = a.abriss?.naechsterUm ?? null;
      if (naechsterUm === null) return `Verbindung zum Meeting verloren. Wiederbeitritt ${k.versuch} von 5 läuft …`;
      const s = Math.max(0, Math.ceil((naechsterUm - jetztMs) / 1000));
      return `Verbindung zum Meeting verloren. Wiederbeitritt ${k.versuch} von 5 in ${s} s.`;
    }
    case 'Z12':
      return 'Verlasse das Meeting …';
    case 'Z13':
      return a.meldung?.text ?? '';
  }
}

/** Gäste-Zeile im Tray (Spec 7.3, berichtigt): g = NDI-Sender der Gäste inklusive Bildschirm. */
export function gaesteZeile(s: AppStatus): string {
  const g = s.ndiSenders;
  if (g > 0) return `● Gäste: ${g} ${g === 1 ? 'NDI-Quelle' : 'NDI-Quellen'}`;
  if (s.configured) return '○ Gäste: keine NDI-Quelle';
  return '△ Gäste: Cloud nicht eingerichtet';
}

/** Tooltip des Tray-Symbols, das einzige kombinierte Feld (Spec 7.4, Code wörtlich). */
export function trayTooltip(s: AppStatus): string {
  const teile: string[] = [];
  if (s.ndiSenders > 0 || (s.zoom?.quellen ?? 0) > 0) teile.push('Zuschaltungen aktiv');
  if (s.zoom?.zustand === 'abriss') teile.push('Zoom-Verbindung unterbrochen');
  if (s.zoom?.zustand === 'fehler') teile.push('Zoom-Fehler');
  return teile.length ? `JM Connect — ${teile.join(' · ')}` : 'JM Connect';
}

/** Tray „Zoom-Meeting verlassen“ ist aktiv in Z3–Z11 (Spec 7.3). */
export function trayVerlassenAktiv(k: ZoomKurz | null): boolean {
  if (k === null) return false;
  return (
    k.zustand === 'startet' ||
    k.zustand === 'tritt_bei' ||
    k.zustand === 'warteraum' ||
    k.zustand === 'im_meeting' ||
    k.zustand === 'abriss'
  );
}

/** Werte von `zoom_status` (Spec 7.5). Z3 meldet bewusst `tritt_bei`. */
export type ZoomStatusWert = 'einrichtung' | 'bereit' | 'tritt_bei' | 'warteraum' | 'im_meeting' | 'abriss' | 'verlaesst' | 'fehler';

/** Die fünf Zoom-Schlüssel im STATE (Spec 7.5; zoom_cmd* kommt mit der Fernsteuerung, Plan 4b). */
export interface ZoomStateKv {
  zoom_status: ZoomStatusWert;
  zoom_sources: number;
  zoom_live: 0 | 1;
  zoom_privilege: 0 | 1;
  zoom_alarm: 0 | 1;
}

/**
 * Tabelle 7.5 wörtlich: `alarm[0]` gilt bei o = 0, `alarm[1]` bei o > 0 (o = offene Soll-Einträge).
 * In Z1a, Z1b und Z2 ist o immer 0 (ein Mangel bzw. jeder Weg nach Z2 leert die Soll-Liste).
 */
const STATE_JE_Z: Record<Exclude<ZoomZ, 'Z0'>, { status: ZoomStatusWert; privilege: 0 | 1; alarm: readonly [0 | 1, 0 | 1] }> = {
  Z1a: { status: 'einrichtung', privilege: 0, alarm: [0, 0] },
  Z1b: { status: 'einrichtung', privilege: 0, alarm: [0, 0] },
  Z2: { status: 'bereit', privilege: 0, alarm: [0, 0] },
  Z3: { status: 'tritt_bei', privilege: 0, alarm: [0, 1] },
  Z4: { status: 'tritt_bei', privilege: 0, alarm: [0, 1] },
  Z5a: { status: 'warteraum', privilege: 0, alarm: [0, 1] },
  Z5b: { status: 'warteraum', privilege: 0, alarm: [0, 1] },
  Z6: { status: 'im_meeting', privilege: 0, alarm: [0, 1] },
  Z7: { status: 'im_meeting', privilege: 0, alarm: [1, 1] },
  Z7b: { status: 'im_meeting', privilege: 0, alarm: [1, 1] },
  Z8: { status: 'im_meeting', privilege: 1, alarm: [0, 1] },
  Z9: { status: 'im_meeting', privilege: 1, alarm: [0, 1] },
  Z9b: { status: 'im_meeting', privilege: 1, alarm: [0, 1] },
  Z10: { status: 'abriss', privilege: 0, alarm: [1, 1] },
  Z11: { status: 'abriss', privilege: 0, alarm: [1, 1] },
  Z12: { status: 'verlaesst', privilege: 0, alarm: [0, 0] },
  Z13: { status: 'fehler', privilege: 0, alarm: [1, 1] },
};

/** STATE-Werte aus der Kurzform (Spec 7.5). null unter macOS: dort fehlen die zoom_*-Schlüssel ganz. */
export function stateKvAus(k: ZoomKurz): ZoomStateKv | null {
  const z = zoomZ(k);
  if (z === 'Z0') return null;
  const s = STATE_JE_Z[z];
  return {
    zoom_status: s.status,
    zoom_sources: k.quellen,
    zoom_live: k.quellen > 0 ? 1 : 0,
    zoom_privilege: s.privilege,
    zoom_alarm: s.alarm[k.sollOffen > 0 ? 1 : 0],
  };
}

/** SDK-Zeile im Einrichtungsbereich der Karte (Spec 9 Punkt 3). */
export function sdkZeile(a: ZoomAbbild): string {
  if (a.kurz.maengel.includes('sdk_fehlt')) return 'Zoom-SDK: nicht eingerichtet';
  if (a.kurz.maengel.includes('sdk_defekt')) return 'Zoom-SDK: Laufzeit unvollständig';
  return 'Zoom-SDK 7.1.5.43953 eingerichtet';
}

/** Beschriftung des SDK-Knopfs (Spec 9 Punkt 3). */
export function sdkKnopf(a: ZoomAbbild): 'SDK-Ordner wählen …' | 'Neu wählen …' {
  return a.kurz.maengel.includes('sdk_fehlt') ? 'SDK-Ordner wählen …' : 'Neu wählen …';
}

/** Zugangsdaten-Zeile je Herkunft (Spec 9 Punkt 3); `unlesbar` geht vor. */
export function zugangZeile(a: ZoomAbbild): string {
  if (a.kurz.maengel.includes('zugang_unlesbar')) return 'Zugangsdaten: lassen sich nicht entschlüsseln';
  const z = a.einrichtung.zugang;
  const je: Record<ProxyKeySource, string> = {
    stored: `Zugangsdaten: hinterlegt (Client-ID endet auf ${z.clientIdEnde ?? ''})`,
    session: TEXT_A4,
    env: TEXT_A6,
    none: 'Zugangsdaten: fehlen',
  };
  return je[z.herkunft];
}

/** Welche Knöpfe die Karte zeigt bzw. freigibt (Spec 9 Punkte 2–6, Sperre 6.1). */
export interface ZoomKnoepfe {
  /** Knöpfe im Meldungsbereich; null ohne Meldung. */
  meldung: { erneut: boolean; schliessen: boolean; ok: boolean; logordner: boolean } | null;
  /** SDK-Ordner/Zugangsdaten wählen oder entfernen: nur Z1a, Z2 ohne Prüfung, Z13 (sonst Tooltip S10). */
  einrichtungAenderbar: boolean;
  /** „Einrichtung prüfen“: nur in `bereit`; während der Prüfung „Prüfe …“. */
  pruefen: 'aus' | 'bereit' | 'laeuft';
  /** Beitrittsfelder in `bereit` und `fehler`. */
  beitrittSichtbar: boolean;
  /** „Beitreten“ gesperrt, solange „Einrichtung prüfen“ läuft. */
  beitretenGesperrt: boolean;
  /** „Meeting verlassen“ in Z3–Z11. */
  verlassen: boolean;
  /** „Abbrechen“ nur in Z11 (der Knopf selbst kommt mit Plan 4b). */
  abbrechen: boolean;
  /** Einrichtung aufgeklappt, solange Mängel bestehen. */
  einrichtungOffen: boolean;
  /** „Zoom ist gesperrt, bis …“ solange Mängel bestehen. */
  sperrHinweis: boolean;
}

export function zoomKnoepfe(a: ZoomAbbild): ZoomKnoepfe {
  const k = a.kurz;
  const z = zoomZ(k);
  let meldung: ZoomKnoepfe['meldung'] = null;
  if (a.meldung) {
    const logordner = a.meldung.text.includes('Details im Log');
    if (z === 'Z13') meldung = { erneut: a.erneutMoeglich, schliessen: true, ok: false, logordner };
    // Spec 9 Punkt 2: in Z2 nur zur Meldung des Meeting-Endes (R6/C61, 6.5) — sie ist in Z2 die einzige
    // Warnung. Das Ergebnis von „Einrichtung prüfen“ (info/fehler) bekommt „OK“, auch wenn danach
    // Nummer und Kenncode noch im Speicher stehen (erneutMoeglich).
    else if (z === 'Z2' && a.erneutMoeglich && a.meldung.art === 'warnung') meldung = { erneut: true, schliessen: true, ok: false, logordner };
    else meldung = { erneut: false, schliessen: false, ok: true, logordner };
  }
  const mangel = k.maengel.length > 0;
  return {
    meldung,
    einrichtungAenderbar: z === 'Z1a' || (z === 'Z2' && !a.pruefungLaeuft) || z === 'Z13',
    pruefen: k.zustand === 'bereit' ? (a.pruefungLaeuft ? 'laeuft' : 'bereit') : 'aus',
    beitrittSichtbar: k.zustand === 'bereit' || k.zustand === 'fehler',
    beitretenGesperrt: a.pruefungLaeuft,
    verlassen: trayVerlassenAktiv(k),
    abbrechen: z === 'Z11',
    einrichtungOffen: mangel,
    sperrHinweis: mangel,
  };
}
```

- [ ] **Step 8: Test laufen lassen (grün)**

```
npx tsx apps/connect/test/zoom-text.test.ts
```
Erwartet: keine Zeile mit `FAIL`, Exitcode 0, letzte Zeile `319 ok, 0 fehlgeschlagen.` Unter anderem:
```
  ok  7.2 hat 18 Zeilen (Z0 bis Z13 mit a/b)
  ok  Z1b (n=0, k=0): Kartentext wörtlich
  ok  Z7b (n=1, k=1): Tray/Kopfzeile wörtlich
  ok  Z11, n=2, g=0: „JM Connect — Zuschaltungen aktiv · Zoom-Verbindung unterbrochen“
  ok  Z7 (n=0, o=0): zoom_status=im_meeting, sources=0, live=0, privilege=0, alarm=1
  ok  Z2 mit laufender Prüfung: Einrichtung gesperrt (S10), „Prüfe …“, Beitreten gesperrt
```
(Die Zahl 319 ist am nachgespielten Planstand gemessen.)

- [ ] **Step 9: Selbsttest über npm und Typcheck**

```
npm run selftest -w @jm/connect
npm run typecheck -w @jm/connect
```
Erwartet: `selftest` zeigt die Kopfzeilen `> @jm/connect@0.1.0 selftest` / `> tsx test/zoom-text.test.ts`, dann dieselbe Ausgabe wie Step 8 mit `319 ok, 0 fehlgeschlagen.`, Exitcode 0. `typecheck` wie in Step 4 ohne Fehlermeldung, Exitcode 0 (jetzt mit `test/zoom-text.test.ts` und `src/shared/zoom-text.ts` in beiden Projekten).

- [ ] **Step 10: Commit** (im Bash-Werkzeug / Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add apps/connect/package.json package-lock.json apps/connect/tsconfig.node.json apps/connect/src/shared/types.ts apps/connect/src/shared/zoom-text.ts apps/connect/src/main/ipc.ts apps/connect/src/main/tray.ts apps/connect/test/zoom-text.test.ts
git status --short
```
Erwartet genau:
```
M  apps/connect/package.json
M  apps/connect/src/main/ipc.ts
M  apps/connect/src/main/tray.ts
M  apps/connect/src/shared/types.ts
A  apps/connect/src/shared/zoom-text.ts
A  apps/connect/test/zoom-text.test.ts
M  apps/connect/tsconfig.node.json
M  package-lock.json
```
(`tsconfig.*.tsbuildinfo` ist per Wurzel-`.gitignore` ausgeschlossen und erscheint nicht.) Dann:
```
git commit -m "feat(connect): Zoom-Typen, Statustexte und Testlauf (Stage 4a)" -m "Typen aus Spec 5.4 in shared/types.ts (plus ZoomParticipant.fehler und ZoomSollEintrag.doppelname), AppStatus.zoom. shared/zoom-text.ts ist die eine Quelle fuer Tray-Zeile, Kopfzeile, Kartentext, Tooltip, STATE-Werte und Knopflogik (Spec 7, 9). Connect bekommt @jm/zoom-bridge und tsx als devDependencies und den Selbsttest test/zoom-text.test.ts, tabellengetrieben ueber jede Zeile aus 7.2 bis 7.5." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 11: Gegenprobe (Spec 12.5) — nach dem Commit, ohne neuen Commit**

Je Zeile den Vorher-Text in `apps/connect/src/shared/zoom-text.ts` mit dem Edit-Werkzeug ersetzen, `npx tsx apps/connect/test/zoom-text.test.ts` laufen lassen (muss rot werden, Exitcode 1, mit der genannten `FAIL`-Zeile), dann die Ersetzung rückgängig machen.

1. `zoom_privilege` ohne Erlaubnis = 1 (Spec 12.5): `Z7b: { status: 'im_meeting', privilege: 0, alarm: [1, 1] },` → `Z7b: { status: 'im_meeting', privilege: 1, alarm: [1, 1] },`. Erwartet u. a. `FAIL  Z7b (n=2, o=0): zoom_status=im_meeting, sources=2, live=1, privilege=0, alarm=1`.
2. `zoom_alarm` ohne offene Soll-Einträge gerechnet (Spec 12.5): `zoom_alarm: s.alarm[k.sollOffen > 0 ? 1 : 0],` → `zoom_alarm: s.alarm[0],`. Erwartet u. a. `FAIL  Z3 (n=0, o=1): zoom_status=tritt_bei, sources=0, live=0, privilege=0, alarm=1`.
3. Tooltip zählt Zoom-Quellen nicht: `if (s.ndiSenders > 0 || (s.zoom?.quellen ?? 0) > 0) teile.push('Zuschaltungen aktiv');` → `if (s.ndiSenders > 0) teile.push('Zuschaltungen aktiv');`. Erwartet u. a. `FAIL  Z3, n=2, g=0: „JM Connect — Zuschaltungen aktiv“`.
4. Kein Singular: ``return n === 1 ? '1 Quelle' : `${n} Quellen`;`` → ``return `${n} Quellen`;``. Erwartet u. a. `FAIL  Z7b (n=1, k=1): Tray/Kopfzeile wörtlich`.
5. Z2-Knöpfe nur an `erneutMoeglich` (Spec 9 Punkt 2): `else if (z === 'Z2' && a.erneutMoeglich && a.meldung.art === 'warnung') meldung` → `else if (z === 'Z2' && a.erneutMoeglich) meldung`. Erwartet `FAIL  Z2 mit erneutMoeglich und Info-Meldung (Ergebnis von „Einrichtung prüfen“): nur „OK“` und `FAIL  Z2 mit erneutMoeglich und Fehler-Meldung der Prüfung: „OK“ und „Logordner öffnen“, kein „Erneut“`.

Danach:
```
git status --short
```
Erwartet: keine Ausgabe (alles zurückgesetzt).

**Abweichungen vom Gerüst:**
- Zeilenangaben berichtigt: Das Gerüst nennt `types.ts:145-162` (AppStatus) und `tray.ts:150-159`; im Worktree hat `types.ts` 110 Zeilen, `AppStatus` steht in Zeilen 37–53, `TrayCommand` in Zeile 70, der Anfangsstatus in `tray.ts` in Zeilen 11–20 (so auch Spec 3.1 und 5.4: `types.ts:37-53`).
- Testhilfe `abbild(a: Omit<Partial<ZoomAbbild>, 'kurz'> & { kurz?: Partial<ZoomKurz> })` statt `Partial<ZoomAbbild> & { kurz?: Partial<ZoomKurz> }`: In der Schnittmenge wäre `kurz` vom Typ `ZoomKurz & Partial<ZoomKurz>`, also doch vollständig; Teilangaben wie `{ kurz: { zustand: 'fehler' } }` ließen sich nicht übergeben.
- `zoom-text.ts` importiert zusätzlich `ProxyKeySource` (für die vollständige Fallunterscheidung in `zugangZeile`).
- Tabelle 7.5 hat für Z1a, Z1b und Z2 bei o > 0 „–“ (nicht erreichbar, jeder Weg dorthin leert die Soll-Liste). `stateKvAus` liefert dort `zoom_alarm=0`; der Test prüft diese drei Zellen bewusst nicht.
- `kartenZeile` in Z1b ohne `kopie` (sollte nie vorkommen) zeigt „0 von 0 Dateien (0 von 0 MB)“ statt zu werfen.
- `zoomKnoepfe` erkennt in Z2 die Meldung des Meeting-Endes an `art === 'warnung'` (zusätzlich zu `erneutMoeglich`): Nach einem Meeting-Ende bleiben Nummer und Kenncode im Speicher, und „Einrichtung prüfen“ ist in `bereit` erlaubt (Aufgabe 11). Deren Ergebnis (`info` bzw. `fehler`) bekommt laut Spec 9 Punkt 2 „OK“, nicht „Erneut beitreten“/„Schließen“. In Z2 entsteht eine Warnung nur durch das Meeting-Ende (Aufgabe 13, `meetingEnde`); Q12 ist zwar auch eine Warnung, entsteht aber nur in `im_meeting` und wird beim Meeting-Ende bzw. Verlassen ersetzt oder geleert.
- Consumes „Aufgabe 2“: Die fünf Typen exportiert `protocol.ts` schon heute; diese Aufgabe hängt nur am Stand von `protocol.ts`, nicht an den Neuerungen aus Aufgabe 2.

---

### Task 6: Connect: Klartexte `klartext.ts`

**Spec:** `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md` Abschnitte 8.1–8.5 (alle Texte wörtlich), 8.3 Einleitung (Vorsatz, nie `explainStatus`, `detail` = `failCodeName(n) (n)`), 8.4 Absatz zu Q16/Q17, 8.7 (Maskierung nur nicht-leerer Werte), 6.1 „Einrichtung prüfen“ Schritt 5 (Text der Erfolgsmeldung), 6.5 (R6, Grund 1 = C61), 12.4 erster Punkt. F1–F8 (8.6) und R2, R4, R5, R7 gehören zu Plan 4b.

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\suite-sofort-fixes` (Branch `feat/zoom-stage4-connect`). Alle Pfade relativ dazu.

**Files:**
- Create: `apps/connect/src/main/zoom/klartext.ts` (der Ordner `src/main/zoom/` entsteht hier)
- Test: `apps/connect/test/zoom-text.test.ts`
  - Zeilen 10–11 (Ende des Imports aus `../src/shared/zoom-text`): Import aus `klartext` dahinter
  - Zeile 418 (Ankerzeile `// ── ENDE DER FÄLLE …`): neue Blöcke direkt darüber

Zeilenangaben gelten für den Stand nach Aufgabe 5. Maßgeblich ist der wortgleiche Vorher-Text.

**Interfaces:**
- Consumes:
  - Aufgabe 2: `failCodeName(code: number): string`, `failReason(code: number): string`, `endReason(code: number): string` aus `@jm/zoom-bridge/protocol`; dazu das bestehende `authResultName(code: number): string` (`protocol.ts:427`) und die Typen `AudioReason`, `AudioState`.
  - Aufgabe 5: Typ `ZoomMangel` aus `../../shared/types`, `TEXT_A4`, `TEXT_A6` aus `../../shared/zoom-text`.
- Produces (exakt so, Aufgaben 7–15 bauen darauf):
  ```ts
  // apps/connect/src/main/zoom/klartext.ts
  export interface Meldungstext { text: string; detail: string | null }
  export const VORSATZ: { readonly beitritt: 'Beitritt gescheitert: '; readonly wiederbeitritt: 'Wiederbeitritt abgebrochen: '; readonly verbindung: 'Verbindung verloren: ' };
  export type Vorsatz = (typeof VORSATZ)[keyof typeof VORSATZ];
  export const KT: {
    S1: string; S2: string; S3(gefunden: string): string; S3b: string; S4(name: string): string; S5(gebrauchtMb: number, freiMb: number): string;
    S6(grund: string): string; S7(x: number, y: number): string; S8: string; S9(datei: string): string; S10: string;
    A1: string; A2: string; A3(code: string): string; A4: string; A5: string; A6: string;
    B1: string; B2(code: string): string; B3: string; B4: string; B5: string; B6(detail: string): string; B7(x: string): string;
    B8(name: string): string; B8_14: string; B9(result: string): string; B10: string; B11(result: string): string; B12(result: string): string;
    B13: string; B14: string; B15(result: string): string; B16: string; B17: string; B18(name: string): string;
    N0: string; N0b: string; CT: string; CE: string; CJ(name: string): string; CB(detail: string): string;
    Q1: string; Q2: string; Q4(name: string): string; Q5(name: string): string; Q6(dropped: number): string; Q7: string; Q8: string;
    Q9(n: number): string; Q10(ndiName: string): string; Q11: string; Q12(name: string): string; Q13: string; Q14: string; Q15: string;
    Q16(person: string): string; Q17(person: string): string; R6(grund: string): string;
    PRUEFUNG_OK: string; UE_RECONNECT: string; UE_ABSTURZ(detail: string): string;
  };   // im Code als Objektliteral, Platzhalter-Texte als Pfeilfunktionen; 62 Einträge
  export function failText(code: number, anzeigename: string): string;
  export function failMeldung(vorsatz: Vorsatz, code: number, anzeigename: string): Meldungstext;
  export function endeMeldung(code: number, anzeigename: string): Meldungstext;
  export function authMeldung(code: number): Meldungstext;
  export function exitCodeAus(detail: string | undefined): number | null;
  export function dllMeldung(exitCode: number | null): Meldungstext | null;
  export function spawnMeldung(code: string | undefined): Meldungstext;
  export function fehlerDetail(e: { name?: string; code: number | string }): string;
  export function mangelText(m: ZoomMangel, datei: string | null): string;
  export type Einordnung = { art: 'zeile'; text: string } | { art: 'hinweis'; text: string } | { art: 'keine' };
  export function quellenFehler(code: string, name: string, person: string | null, dropped?: number): Einordnung;
  export function tonZustand(state: AudioState, reason: AudioReason): Einordnung;
  export function maskiere(zeile: string, werte: ReadonlyArray<string>): string;
  ```

**Regeln für diese Aufgabe:**
- `src/main/zoom/*.ts`: kein `electron`, keine Aliase wie `@shared`, nur relative Importe und `@jm/zoom-bridge`; Typen per `import type` (G8).
- Texte wörtlich aus Spec 8 (G9). Nach einem Vorsatz steht nur der Text aus 8.3; `explainStatus()` wird für Klartexte nie benutzt (sonst „Beitritt gescheitert: gescheitert: …“). SDK-Namen erscheinen nur in `detail`, nie im großen Text.
- Die beiden 4a-Übergangstexte `UE_RECONNECT` und `UE_ABSTURZ` stehen nicht in der Spec (Gerüst L1). Plan 4b ersetzt sie durch den Wiederbeitritt; der Kommentar im Code sagt das.
- CRLF: Änderungen an bestehenden Dateien mit dem Edit-Werkzeug (G14). Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel, nie pushen.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`apps/connect/test/zoom-text.test.ts`)

Ersetzung 1 (Zeilen 10–11), Vorher:
```ts
  trayVerlassenAktiv, zoomKnoepfe, zoomZ, zoomZeile, zugangZeile, type ZoomStatusWert, type ZoomZ,
} from '../src/shared/zoom-text';
```
Nachher:
```ts
  trayVerlassenAktiv, zoomKnoepfe, zoomZ, zoomZeile, zugangZeile, type ZoomStatusWert, type ZoomZ,
} from '../src/shared/zoom-text';
import {
  authMeldung, dllMeldung, endeMeldung, exitCodeAus, failMeldung, failText, fehlerDetail, KT, mangelText, maskiere,
  quellenFehler, spawnMeldung, tonZustand, VORSATZ,
} from '../src/main/zoom/klartext';
```

Ersetzung 2 (Zeile 418, die Ankerzeile), Vorher:
```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```
Nachher (alle Texte aus 8.1–8.5 mit Beispielwerten, jeder Vorsatz mit eigenem Text und mit Csonst, die ganze C-Tabelle, Zuordnung der Bild-/Ton-Fehler, Maskierung):
```ts
console.log('— Klartexte 8.1–8.5 wörtlich (KT, mit Beispielwerten für die Platzhalter)');
{
  const KT_SOLL: Array<[string, string, string]> = [
    ['S1', KT.S1, 'In diesem Ordner liegt kein Zoom-SDK. Bitte den entpackten SDK-Ordner wählen (der mit dem Unterordner x64\\bin) oder direkt den Ordner x64\\bin.'],
    ['S2', KT.S2, 'Das ist die 32-Bit-Fassung des Zoom-SDK. Bitte den Ordner x64\\bin wählen oder den SDK-Ordner darüber.'],
    ['S3', KT.S3('7.1.6.12345'), 'Dieses Zoom-SDK hat die Fassung 7.1.6.12345. Diese Connect-Fassung braucht genau 7.1.5.43953. Für eine andere SDK-Fassung braucht es einen neuen Connect-Release.'],
    ['S3b', KT.S3b, 'Die Fassung des Zoom-SDK lässt sich nicht lesen. Bitte das unveränderte SDK aus der JM-Ablage wählen.'],
    ['S4', KT.S4('vcruntime140.dll'), 'Im SDK-Ordner liegt eine Datei, die wie eine Connect-Datei heißt (vcruntime140.dll). Das ist kein unverändertes Zoom-SDK.'],
    ['S5', KT.S5(415, 80), 'Für die Kopie des Zoom-SDK fehlt Platz: gebraucht 415 MB, frei 80 MB.'],
    ['S6', KT.S6('EIO'), 'Das Zoom-SDK ließ sich nicht kopieren (EIO). Die bisherige Einrichtung bleibt unverändert.'],
    ['S7', KT.S7(152, 153), 'Die Kopie des Zoom-SDK ist unvollständig (152 von 153 Dateien). Bitte den Ordner erneut wählen.'],
    ['S8', KT.S8, 'Dieser Connect-Installation fehlt die Zoom-Bridge. Bitte JM Connect neu installieren.'],
    ['S9', KT.S9('sdk.dll'), 'Die Zoom-Laufzeit auf diesem PC ist unvollständig (sdk.dll). Bitte den SDK-Ordner erneut wählen.'],
    ['S10', KT.S10, 'Während Zoom läuft oder die Kopie läuft, lassen sich SDK-Ordner und Zugangsdaten nicht ändern.'],
    ['A1', KT.A1, 'Die Datei ist kein gültiges JSON (Inhalt wird absichtlich nicht angezeigt).'],
    ['A2', KT.A2, 'In der Datei fehlen Client-ID oder Client-Secret (erwartet: clientId und clientSecret).'],
    ['A3', KT.A3('ENOENT'), 'Die Datei lässt sich nicht lesen (ENOENT).'],
    ['A4', KT.A4, 'Nur für diese Sitzung gemerkt — auf diesem Rechner gibt es keinen Schlüsselbund.'],
    ['A5', KT.A5, 'Die hinterlegten Zugangsdaten lassen sich unter diesem Windows-Konto nicht entschlüsseln. Bitte die Datei erneut wählen.'],
    ['A6', KT.A6, 'Kommt aus Umgebungsvariablen (ZOOM_SDK_…) und hat Vorrang.'],
    ['B1', KT.B1, 'zoom-bridge.exe fehlt im Laufzeit-Ordner. Bitte den SDK-Ordner erneut wählen.'],
    ['B2', KT.B2('EPERM'), 'Windows hat den Start der Zoom-Bridge verhindert (Virenschutz oder Smart App Control). Detail: EPERM.'],
    ['B3', KT.B3, 'Die Zoom-Bridge ist beim Start gestorben: Eine DLL fehlt (0xC0000135). Mit den Zugangsdaten hat das nichts zu tun. Bitte den SDK-Ordner erneut wählen.'],
    ['B4', KT.B4, 'Die Zoom-Bridge ist beim Start gestorben: Eine DLL ist zu alt oder passt nicht (0xC0000139). Mit den Zugangsdaten hat das nichts zu tun. Bitte den SDK-Ordner erneut wählen.'],
    ['B5', KT.B5, 'Die Zoom-Bridge ist beim Start gestorben: Eine DLL ist kein 64-Bit-Programm oder beschädigt (0xC000007B). Mit den Zugangsdaten hat das nichts zu tun. Bitte den SDK-Ordner erneut wählen.'],
    ['B6', KT.B6('exitCode=1'), 'Die Zoom-Bridge hat sich beendet, bevor Zoom die Anmeldung beantwortet hat (exitCode=1). Details im Log.'],
    ['B7', KT.B7('7.1.6 (99999)'), 'Die Zoom-Laufzeit meldet die Fassung 7.1.6 (99999), erwartet ist 7.1.5 (43953). Bitte den SDK-Ordner erneut wählen.'],
    ['B8', KT.B8('SDKERR_UNINITIALIZE'), 'Das Zoom-SDK ließ sich nicht starten (SDKERR_UNINITIALIZE). Details im Log.'],
    ['B8_14', KT.B8_14, 'Auf diesem PC läuft schon ein anderes Programm mit dem Zoom-Meeting-SDK (zum Beispiel das Einsatzpaket „zoom-join“). Bitte es zuerst beenden.'],
    ['B9', KT.B9('AUTHRET_KEYORSECRETWRONG'), 'Zoom hat die Anmeldung abgelehnt: Client-ID oder Client-Secret stimmen nicht (AUTHRET_KEYORSECRETWRONG). Bitte die Zugangsdaten-Datei prüfen.'],
    ['B10', KT.B10, 'Zoom hat die Anmeldung abgelehnt: Das Anmelde-Token passt nicht (AUTHRET_JWTTOKENWRONG). Meist stimmen die Zugangsdaten nicht, oder die Uhr dieses PCs geht falsch.'],
    ['B11', KT.B11('AUTHRET_ACCOUNTNOTSUPPORT'), 'Das Zoom-Konto der App darf das Meeting-SDK nicht nutzen (AUTHRET_ACCOUNTNOTSUPPORT). Das klärt der Inhaber des Zoom-Kontos.'],
    ['B12', KT.B12('AUTHRET_NETWORKISSUE'), 'Zoom ist gerade nicht erreichbar (AUTHRET_NETWORKISSUE). Netzwerk prüfen und erneut versuchen.'],
    ['B13', KT.B13, 'Zoom lässt diese SDK-Fassung nicht mehr zu (AUTHRET_CLIENT_INCOMPATIBLE). Nötig ist ein neuer Connect-Release mit neuer SDK-Fassung.'],
    ['B14', KT.B14, 'Zu viele Anmeldungen in kurzer Zeit (AUTHRET_LIMIT_EXCEEDED_EXCEPTION). Einige Minuten warten.'],
    ['B15', KT.B15('AUTHRET_UNKNOWN'), 'Zoom hat die Anmeldung abgelehnt (AUTHRET_UNKNOWN).'],
    ['B16', KT.B16, 'Zoom hat auf die Anmeldung nicht geantwortet (30 s). Netzwerk prüfen und erneut versuchen.'],
    ['B17', KT.B17, 'Zugangsdaten fehlen — bitte die Datei wählen.'],
    ['B18', KT.B18('SDKERR_WRONG_USAGE'), 'Das Zoom-SDK hat die Anmeldung sofort abgewiesen (SDKERR_WRONG_USAGE). Mit dem Netzwerk hat das nichts zu tun. Details im Log.'],
    ['N0', KT.N0, 'Die Meeting-Nummer darf nur Ziffern enthalten (Leerzeichen und Bindestriche werden entfernt).'],
    ['N0b', KT.N0b, 'Der Anzeigename muss 1 bis 64 Zeichen lang sein.'],
    ['CT', KT.CT, 'Zoom hat den Beitritt in 30 s weder bestätigt noch abgelehnt. Netzwerk prüfen und erneut versuchen.'],
    ['CE', KT.CE, 'Der Host hat zugelassen, aber Zoom hat den Einlass in 30 s nicht abgeschlossen. Netzwerk prüfen und erneut beitreten.'],
    ['CJ', KT.CJ('SDKERR_INVALID_PARAMETER'), 'Zoom hat den Beitritt nicht angenommen (SDKERR_INVALID_PARAMETER).'],
    ['CB', KT.CB('exitCode=3'), 'Die Zoom-Bridge hat sich während des Beitritts beendet (exitCode=3). Details im Log.'],
    ['Q1', KT.Q1, 'Keine Aufnahme-Erlaubnis — der Host muss sie im Zoom-Client erteilen.'],
    ['Q2', KT.Q2, 'Diese Person ist nicht mehr im Meeting.'],
    ['Q4', KT.Q4('VIDEO_SENDER_FAILED'), 'Die Quelle ließ sich nicht aufbauen (VIDEO_SENDER_FAILED). Details im Log.'],
    ['Q5', KT.Q5('AUDIO_HELPER_MISSING'), 'Ton nicht verfügbar (AUDIO_HELPER_MISSING) — das Bild läuft ohne Ton. Für einen neuen Versuch entladen und neu laden.'],
    ['Q6', KT.Q6(12), 'Ton: 12 Pakete verworfen — dieser PC kommt nicht hinterher.'],
    ['Q7', KT.Q7, 'NDI ließ sich in der Zoom-Bridge nicht starten. Details im Log.'],
    ['Q8', KT.Q8, 'Keine Antwort der Zoom-Bridge auf „Als Quelle laden“.'],
    ['Q9', KT.Q9(6), 'Mehr als 5 Zoom-Quellen sind nicht gemessen. Noch einmal klicken, um die 6. Quelle trotzdem zu laden.'],
    ['Q10', KT.Q10('JM Connect – Zoom Anna'), 'NDI-Name doppelt: Ein Browser-Gast und diese Zoom-Person senden beide als „JM Connect – Zoom Anna“. Im Switcher ist nicht sicher, welche Quelle ankommt. Einen der beiden umbenennen.'],
    ['Q11', KT.Q11, 'Name doppelt im Meeting — nach einem Wiederbeitritt kann Connect diese Quelle nicht von selbst zuordnen.'],
    ['Q12', KT.Q12('SDKERR_NO_PERMISSION'), 'Zoom hat die Anfrage nach der Aufnahme-Erlaubnis nicht angenommen (SDKERR_NO_PERMISSION). Der Host kann sie im Zoom-Client trotzdem erteilen.'],
    ['Q13', KT.Q13, 'Bild-Versatz: erlaubt sind ganze Zahlen von 0 bis 1000 ms.'],
    ['Q14', KT.Q14, 'Zum Umschalten erst entladen.'],
    ['Q15', KT.Q15, 'Erst im Zoom-Client zulassen.'],
    ['Q16', KT.Q16('Anna'), 'Bild: fehlerhafte Bilder von „Anna“ verworfen (videoBufferMismatch). Die Quelle bleibt bestehen; ob wieder Bild kommt, zeigt ihr Bild-Zustand.'],
    ['Q17', KT.Q17('Ben'), 'Ton: ein fehlerhaftes Paket von „Ben“ verworfen (audioBufferMismatch). Der Ton läuft mit dem nächsten gültigen Paket weiter.'],
    ['R6', KT.R6('vom Gastgeber beendet'), 'Meeting beendet: vom Gastgeber beendet.'],
    ['PRUEFUNG_OK', KT.PRUEFUNG_OK, 'Einrichtung in Ordnung: Zoom-SDK 7.1.5 (43953), Anmeldung bei Zoom erfolgreich.'],
    ['UE_RECONNECT', KT.UE_RECONNECT, 'Zoom hat die Verbindung in 30 s nicht wiederhergestellt.'],
    ['UE_ABSTURZ', KT.UE_ABSTURZ('exitCode=3'), 'Die Zoom-Bridge ist abgestürzt (exitCode=3). Details im Log.'],
  ];
  for (const [id, ist, soll] of KT_SOLL) ck(`${id} wörtlich`, ist === soll);
  ck('KT hat genau diese 62 Einträge (F1–F8, R2/R4/R5/R7 erst in 4b)', Object.keys(KT).length === 62 && KT_SOLL.length === 62);
}

console.log('— 8.3: Vorsatz + Text, ganzer Text, nie doppelt „gescheitert:“');
{
  const N = 'JM Connect';
  const C63 = 'Das Meeting gehört nicht zum Zoom-Konto dieser App. JM Connect kann nur Meetings im eigenen Zoom-Konto betreten. Bitte das Meeting im eigenen Konto anlegen.';
  const C500 = 'Zoom verlangt für dieses Meeting einen Beitritt im Namen eines angemeldeten Nutzers (OBF-Token). Das kann JM Connect nicht — nur Meetings im eigenen Zoom-Konto.';
  const faelle: Array<[string, { text: string; detail: string | null }, string]> = [
    ['Beitritt, 63 → C63', failMeldung(VORSATZ.beitritt, 63, N), `Beitritt gescheitert: ${C63}`],
    ['Beitritt, 2 → Csonst', failMeldung(VORSATZ.beitritt, 2, N), 'Beitritt gescheitert: Wiederverbinden fehlgeschlagen (Code 2).'],
    ['Wiederbeitritt, 503 → C500', failMeldung(VORSATZ.wiederbeitritt, 503, N), `Wiederbeitritt abgebrochen: ${C500}`],
    ['Wiederbeitritt, 2 → Csonst', failMeldung(VORSATZ.wiederbeitritt, 2, N), 'Wiederbeitritt abgebrochen: Wiederverbinden fehlgeschlagen (Code 2).'],
    ['Verbindung, 4 → C4', failMeldung(VORSATZ.verbindung, 4, N), 'Verbindung verloren: falscher Kenncode.'],
    ['Verbindung, 2 → Csonst', failMeldung(VORSATZ.verbindung, 2, N), 'Verbindung verloren: Wiederverbinden fehlgeschlagen (Code 2).'],
  ];
  for (const [name, m, soll] of faelle) {
    ck(`${name}: ganzer Text wörtlich`, m.text === soll);
    const nachVorsatz = m.text.slice(m.text.indexOf(': ') + 2);
    ck(`${name}: kein zweites „gescheitert:“`, !m.text.includes('gescheitert: gescheitert') && !nachVorsatz.includes('gescheitert:'));
    ck(`${name}: detail = failCodeName (Code)`, m.detail !== null && /^[A-Z_0-9]+ \(\d+\)$/.test(m.detail));
  }
  ck('detail für 63 wörtlich', failMeldung(VORSATZ.beitritt, 63, N).detail === 'MEETING_FAIL_UNABLE_TO_JOIN_EXTERNAL_MEETING (63)');
  ck('detail für 503 wörtlich', failMeldung(VORSATZ.wiederbeitritt, 503, N).detail === 'MEETING_FAIL_USER_LEVEL_TOKEN_NOT_HAVE_HOST_ZAK_OBF (503)');
  ck('Csonst mit Code 11: failReason deutsch, ohne Vorsatz', failText(11, N) === 'kein Medienserver gefunden (Code 11).');
  const unbekannt = failMeldung(VORSATZ.beitritt, 4242, N);
  ck('unbekannter Code: „unbekannter Grund (Code 4242).“ und MEETING_FAIL_CODE_4242',
    unbekannt.text === 'Beitritt gescheitert: unbekannter Grund (Code 4242).' && unbekannt.detail === 'MEETING_FAIL_CODE_4242 (4242)');
  ck('C61 mit Anzeigename', failText(61, 'Regie Süd') === 'Der Host hat „Regie Süd“ aus dem Meeting entfernt.');

  const C13 = 'Das Meeting ist durch eine Kontoeinstellung eingeschränkt.';
  const C88 = 'Zoom kann die Meeting-Nummer keinem Meeting eindeutig zuordnen. Bitte die Nummer prüfen.';
  const C_83: Record<number, string> = {
    4: 'falscher Kenncode.',
    6: 'Das Meeting ist vorbei.',
    7: 'Das Meeting hat noch nicht begonnen, und Warten auf den Host ist nicht erlaubt.',
    8: 'Dieses Meeting gibt es nicht. Bitte die Nummer prüfen.',
    9: 'Das Meeting ist voll.',
    10: 'Zoom lässt diese SDK-Fassung nicht mehr zu (Client zu alt). Nötig ist ein neuer Connect-Release mit neuer SDK-Fassung.',
    12: 'Das Meeting ist gesperrt.',
    13: C13, 14: C13,
    16: 'Zoom hat das Anmelde-Token als abgelaufen abgewiesen. Meist geht die Uhr dieses PCs falsch.',
    23: 'Das Meeting verlangt eine Anmeldung mit einem Zoom-Konto. JM Connect tritt ohne Anmeldung bei.',
    60: 'Das Meeting ist nur für Mitglieder des Gastgeber-Kontos freigegeben.',
    61: 'Der Host hat „JM Connect“ aus dem Meeting entfernt.',
    62: 'Der Host lässt niemanden von außerhalb seines Zoom-Kontos zu.',
    63: C63,
    64: 'Der Administrator des Gastgeber-Kontos hat diese App gesperrt.',
    82: 'Das Meeting verlangt eine Anmeldung mit dem Konto des Veranstalters. JM Connect tritt ohne Anmeldung bei und kann nur Meetings im eigenen Zoom-Konto betreten.',
    88: C88, 89: C88,
    500: C500, 501: C500, 502: C500, 503: C500, 504: C500, 505: C500, 506: C500,
  };
  for (const [code, soll] of Object.entries(C_83)) ck(`8.3 Code ${code} wörtlich`, failText(Number(code), N) === soll);
}

console.log('— 6.5/8.5: Meeting-Ende (R6 ohne „beendet: “ aus explainStatus, Grund 1 = C61)');
{
  const ende = endeMeldung(2, 'JM Connect');
  ck('Grund 2 → „Meeting beendet: vom Gastgeber beendet.“', ende.text === 'Meeting beendet: vom Gastgeber beendet.' && ende.detail === null);
  ck('Grund 1 → C61 mit Anzeigename', endeMeldung(1, 'JM Connect').text === 'Der Host hat „JM Connect“ aus dem Meeting entfernt.');
  ck('unbekannter Grund → „Meeting beendet: Grund 99.“', endeMeldung(99, 'JM Connect').text === 'Meeting beendet: Grund 99.');
  ck('nie „beendet: beendet“', !endeMeldung(4, 'JM Connect').text.includes('beendet: beendet'));
}

console.log('— 8.2: Anmeldung, DLL-Tod, Spawn');
{
  const a2 = authMeldung(2);
  ck('auth 2 → B9 mit AUTHRET_KEYORSECRETWRONG', a2.text === KT.B9('AUTHRET_KEYORSECRETWRONG') && a2.detail === 'AUTHRET_KEYORSECRETWRONG (2)');
  ck('auth 1 → B9 mit AUTHRET_KEYORSECRETEMPTY', authMeldung(1).text === KT.B9('AUTHRET_KEYORSECRETEMPTY'));
  ck('auth 11 → B10', authMeldung(11).text === KT.B10);
  ck('auth 3 → B11', authMeldung(3).text === KT.B11('AUTHRET_ACCOUNTNOTSUPPORT'));
  ck('auth 4 → B11', authMeldung(4).text === KT.B11('AUTHRET_ACCOUNTNOTENABLESDK'));
  ck('auth 6 → B12', authMeldung(6).text === KT.B12('AUTHRET_SERVICE_BUSY'));
  ck('auth 8 → B12', authMeldung(8).text === KT.B12('AUTHRET_OVERTIME'));
  ck('auth 9 → B12', authMeldung(9).text === KT.B12('AUTHRET_NETWORKISSUE'));
  ck('auth 10 → B13', authMeldung(10).text === KT.B13);
  ck('auth 12 → B14', authMeldung(12).text === KT.B14);
  ck('auth 5 → B15', authMeldung(5).text === KT.B15('AUTHRET_UNKNOWN'));
  ck('auth 99 → B15 mit unbekanntem Namen', authMeldung(99).text === KT.B15('AUTHRET_UNKNOWN_CODE(99)'));

  ck('exitCodeAus liest „exitCode=<n>“', exitCodeAus('EXITED_UNEXPECTEDLY exitCode=3221225781') === 3221225781);
  ck('exitCodeAus: Signal → null', exitCodeAus('Signal=SIGKILL') === null && exitCodeAus(undefined) === null);
  const b3 = dllMeldung(0xc0000135);
  ck('0xC0000135 → B3', b3?.text === KT.B3 && b3.detail === 'STATUS_DLL_NOT_FOUND (0xC0000135)');
  ck('B3 nennt die Zugangsdaten NICHT als Ursache', b3 !== null && b3.text.includes('Mit den Zugangsdaten hat das nichts zu tun') && !b3.text.includes('stimmen nicht'));
  ck('0xC0000139 → B4', dllMeldung(0xc0000139)?.text === KT.B4);
  ck('0xC000007B → B5', dllMeldung(0xc000007b)?.text === KT.B5);
  ck('anderer Rückgabewert / keiner → null', dllMeldung(1) === null && dllMeldung(null) === null);
  ck('Spawn ENOENT → B1', spawnMeldung('ENOENT').text === KT.B1);
  ck('Spawn EACCES → B2 mit Code', spawnMeldung('EACCES').text === KT.B2('EACCES') && spawnMeldung('EACCES').detail === 'EACCES');
  ck('Spawn ohne Code → B2 „unbekannt“', spawnMeldung(undefined).text === KT.B2('unbekannt'));
  ck('fehlerDetail: „NAME (code)“', fehlerDetail({ name: 'SDKERR_UNINITIALIZE', code: 7 }) === 'SDKERR_UNINITIALIZE (7)');
  ck('fehlerDetail ohne Namen', fehlerDetail({ code: 'x' }) === 'unbekannt (x)');
}

console.log('— Mängel → Text (6.2 Schritt 1)');
{
  const MANGEL_TEXT: Record<ZoomMangel, [string | null, string]> = {
    sdk_fehlt: [null, 'Die Zoom-Laufzeit auf diesem PC ist unvollständig (jm-zoom-laufzeit.json). Bitte den SDK-Ordner erneut wählen.'],
    sdk_defekt: ['sdk.dll', 'Die Zoom-Laufzeit auf diesem PC ist unvollständig (sdk.dll). Bitte den SDK-Ordner erneut wählen.'],
    bridge_fehlt: [null, 'Dieser Connect-Installation fehlt die Zoom-Bridge. Bitte JM Connect neu installieren.'],
    zugang_fehlt: [null, 'Zugangsdaten fehlen — bitte die Datei wählen.'],
    zugang_unlesbar: [null, 'Die hinterlegten Zugangsdaten lassen sich unter diesem Windows-Konto nicht entschlüsseln. Bitte die Datei erneut wählen.'],
  };
  for (const m of Object.keys(MANGEL_TEXT) as ZoomMangel[]) {
    ck(`${m} → Text wörtlich`, mangelText(m, MANGEL_TEXT[m][0]) === MANGEL_TEXT[m][1]);
  }
}

console.log('— 8.4: Bild-/Ton-Fehler → Zeile, Hinweis oder nichts');
{
  const e = (code: string, name: string, person: string | null = 'Anna', dropped?: number) => quellenFehler(code, name, person, dropped);
  ck('videoNoPrivilege → Zeile Q1', JSON.stringify(e('videoNoPrivilege', 'VIDEO_NO_PRIVILEGE')) === JSON.stringify({ art: 'zeile', text: KT.Q1 }));
  ck('videoUnknownParticipant → Zeile Q2', JSON.stringify(e('videoUnknownParticipant', 'VIDEO_UNKNOWN_PARTICIPANT')) === JSON.stringify({ art: 'zeile', text: KT.Q2 }));
  ck('videoAlreadySubscribed → nichts (Q3)', e('videoAlreadySubscribed', 'VIDEO_ALREADY_SUBSCRIBED').art === 'keine');
  for (const [code, name] of [['videoRendererFailed', 'VIDEO_RENDERER_FAILED'], ['videoRawRecordingFailed', 'VIDEO_RAW_RECORDING_FAILED'], ['videoSenderFailed', 'VIDEO_SENDER_FAILED']]) {
    ck(`${code} → Zeile Q4(${name})`, JSON.stringify(e(code, name)) === JSON.stringify({ art: 'zeile', text: KT.Q4(name) }));
  }
  for (const [code, name] of [['audioVoipJoinFailed', 'AUDIO_VOIP_JOIN_FAILED'], ['audioHelperMissing', 'AUDIO_HELPER_MISSING'], ['audioSubscribeFailed', 'AUDIO_SUBSCRIBE_FAILED']]) {
    ck(`${code} → Zeile Q5(${name})`, JSON.stringify(e(code, name)) === JSON.stringify({ art: 'zeile', text: KT.Q5(name) }));
  }
  ck('videoBadDelay → Zeile Q13', JSON.stringify(e('videoBadDelay', 'VIDEO_BAD_DELAY')) === JSON.stringify({ art: 'zeile', text: KT.Q13 }));
  ck('audioQueueOverflow → Hinweis Q6 mit dropped', JSON.stringify(e('audioQueueOverflow', 'AUDIO_QUEUE_OVERFLOW', null, 37)) === JSON.stringify({ art: 'hinweis', text: 'Ton: 37 Pakete verworfen — dieser PC kommt nicht hinterher.' }));
  ck('audioQueueOverflow ohne dropped → 0', e('audioQueueOverflow', 'AUDIO_QUEUE_OVERFLOW', null).art === 'hinweis' && JSON.stringify(e('audioQueueOverflow', 'AUDIO_QUEUE_OVERFLOW', null)).includes('Ton: 0 Pakete'));
  ck('videoBufferMismatch → Hinweis Q16 (keine Zeile)', JSON.stringify(e('videoBufferMismatch', 'VIDEO_BUFFER_MISMATCH')) === JSON.stringify({ art: 'hinweis', text: KT.Q16('Anna') }));
  ck('audioBufferMismatch → Hinweis Q17 (keine Zeile)', JSON.stringify(e('audioBufferMismatch', 'AUDIO_BUFFER_MISMATCH', 'Ben')) === JSON.stringify({ art: 'hinweis', text: KT.Q17('Ben') }));
  ck('unbekannter Code → Zeile Q4 mit dem Namen', JSON.stringify(e('videoNeu', 'OWN_UNKNOWN(videoNeu)')) === JSON.stringify({ art: 'zeile', text: KT.Q4('OWN_UNKNOWN(videoNeu)') }));
  ck('Ton off/command (ohne Ton geladen) → kein Fehler', tonZustand('off', 'command').art === 'keine');
  ck('Ton off/audioUnavailable → Zeile Q5', JSON.stringify(tonZustand('off', 'audioUnavailable')) === JSON.stringify({ art: 'zeile', text: KT.Q5('audioUnavailable') }));
  ck('Ton off/participantLeft → kein Zeilenfehler', tonZustand('off', 'participantLeft').art === 'keine');
  ck('Ton live → kein Fehler', tonZustand('live', 'packets').art === 'keine');
}

console.log('— 8.7: Maskierung nur nicht-leerer Werte, längste zuerst');
{
  ck('Kenncode wird zu •••, leerer Wert stört nicht', maskiere('a KENNCODE-PROBE b', ['', 'KENNCODE-PROBE']) === 'a ••• b');
  ck('nur leerer Wert → Zeile unverändert (kein ••• zwischen den Zeichen)', maskiere('abc', ['']) === 'abc');
  const nummer = '7'.repeat(10);
  ck('eingegebene und normierte Nummer beide maskiert',
    maskiere(`join 777-777-7777 und ${nummer}`, [nummer, '777-777-7777']) === 'join ••• und •••');
  ck('längster Wert zuerst (kein Rest vom kürzeren)', maskiere(nummer, ['77', nummer]) === '•••');
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npx tsx apps/connect/test/zoom-text.test.ts
```
Erwartet: Abbruch beim Laden, Exitcode 1, mit
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\connect\src\main\zoom\klartext' imported from …\apps\connect\test\zoom-text.test.ts
```

- [ ] **Step 3: `src/main/zoom/klartext.ts` schreiben** (neu)

`C_TEXTE` ist die Tabelle 8.3 (Text nach dem Vorsatz); C61 braucht den Anzeigenamen und steht darum in `failText`. Csonst nutzt `failReason` aus Aufgabe 2 (deutsch, ohne Vorsatz). `authMeldung` folgt 8.2 (1, 2 → B9; 11 → B10; 3, 4 → B11; 6, 8, 9 → B12; 10 → B13; 12 → B14; sonst B15). `exitCodeAus` und die DLL-Namen in `dllMeldung` sind die aus `packages/zoom-bridge/cli/steuerung.mjs:169-179`.
```ts
// Klartexte der Zoom-Anbindung (Spec 8.1–8.5) und ihre Zuordnung zu Codes und Ereignissen.
// Ohne Electron (G8): nur relative Importe und @jm/zoom-bridge. Die Texte stehen WÖRTLICH wie in
// der Spec; Platzhalter {…} sind Funktionsparameter. Die Fernsteuer-Hinweise F1–F8 (8.6) und die
// Wiederbeitritts-Texte R2, R4, R5, R7 kommen mit Plan 4b.
import type { AudioReason, AudioState } from '@jm/zoom-bridge/protocol';
import { authResultName, endReason, failCodeName, failReason } from '@jm/zoom-bridge/protocol';
import type { ZoomMangel } from '../../shared/types';
import { TEXT_A4, TEXT_A6 } from '../../shared/zoom-text';

/** Text groß in der Karte, Detail klein darunter (technischer Name und Code), Spec 8. */
export interface Meldungstext {
  text: string;
  detail: string | null;
}

/** Vorsätze vor den Texten aus 8.3 (nie zusätzlich der eigene Vorsatz von explainStatus). */
export const VORSATZ = {
  beitritt: 'Beitritt gescheitert: ',
  wiederbeitritt: 'Wiederbeitritt abgebrochen: ',
  verbindung: 'Verbindung verloren: ',
} as const;
export type Vorsatz = (typeof VORSATZ)[keyof typeof VORSATZ];

/** Alle Texte aus 8.1, 8.2, 8.4, 8.5 sowie N0/N0b/CT/CE/CJ/CB aus 8.3. Schlüssel = Spec-ID. */
export const KT = {
  // 8.1 Einrichtung
  S1: 'In diesem Ordner liegt kein Zoom-SDK. Bitte den entpackten SDK-Ordner wählen (der mit dem Unterordner x64\\bin) oder direkt den Ordner x64\\bin.',
  S2: 'Das ist die 32-Bit-Fassung des Zoom-SDK. Bitte den Ordner x64\\bin wählen oder den SDK-Ordner darüber.',
  S3: (gefunden: string): string =>
    `Dieses Zoom-SDK hat die Fassung ${gefunden}. Diese Connect-Fassung braucht genau 7.1.5.43953. Für eine andere SDK-Fassung braucht es einen neuen Connect-Release.`,
  S3b: 'Die Fassung des Zoom-SDK lässt sich nicht lesen. Bitte das unveränderte SDK aus der JM-Ablage wählen.',
  S4: (name: string): string =>
    `Im SDK-Ordner liegt eine Datei, die wie eine Connect-Datei heißt (${name}). Das ist kein unverändertes Zoom-SDK.`,
  S5: (gebrauchtMb: number, freiMb: number): string =>
    `Für die Kopie des Zoom-SDK fehlt Platz: gebraucht ${gebrauchtMb} MB, frei ${freiMb} MB.`,
  S6: (grund: string): string =>
    `Das Zoom-SDK ließ sich nicht kopieren (${grund}). Die bisherige Einrichtung bleibt unverändert.`,
  S7: (x: number, y: number): string =>
    `Die Kopie des Zoom-SDK ist unvollständig (${x} von ${y} Dateien). Bitte den Ordner erneut wählen.`,
  S8: 'Dieser Connect-Installation fehlt die Zoom-Bridge. Bitte JM Connect neu installieren.',
  S9: (datei: string): string =>
    `Die Zoom-Laufzeit auf diesem PC ist unvollständig (${datei}). Bitte den SDK-Ordner erneut wählen.`,
  S10: 'Während Zoom läuft oder die Kopie läuft, lassen sich SDK-Ordner und Zugangsdaten nicht ändern.',
  A1: 'Die Datei ist kein gültiges JSON (Inhalt wird absichtlich nicht angezeigt).',
  A2: 'In der Datei fehlen Client-ID oder Client-Secret (erwartet: clientId und clientSecret).',
  A3: (code: string): string => `Die Datei lässt sich nicht lesen (${code}).`,
  A4: TEXT_A4,
  A5: 'Die hinterlegten Zugangsdaten lassen sich unter diesem Windows-Konto nicht entschlüsseln. Bitte die Datei erneut wählen.',
  A6: TEXT_A6,

  // 8.2 Start und Anmeldung
  B1: 'zoom-bridge.exe fehlt im Laufzeit-Ordner. Bitte den SDK-Ordner erneut wählen.',
  B2: (code: string): string =>
    `Windows hat den Start der Zoom-Bridge verhindert (Virenschutz oder Smart App Control). Detail: ${code}.`,
  B3: 'Die Zoom-Bridge ist beim Start gestorben: Eine DLL fehlt (0xC0000135). Mit den Zugangsdaten hat das nichts zu tun. Bitte den SDK-Ordner erneut wählen.',
  B4: 'Die Zoom-Bridge ist beim Start gestorben: Eine DLL ist zu alt oder passt nicht (0xC0000139). Mit den Zugangsdaten hat das nichts zu tun. Bitte den SDK-Ordner erneut wählen.',
  B5: 'Die Zoom-Bridge ist beim Start gestorben: Eine DLL ist kein 64-Bit-Programm oder beschädigt (0xC000007B). Mit den Zugangsdaten hat das nichts zu tun. Bitte den SDK-Ordner erneut wählen.',
  B6: (detail: string): string =>
    `Die Zoom-Bridge hat sich beendet, bevor Zoom die Anmeldung beantwortet hat (${detail}). Details im Log.`,
  B7: (x: string): string =>
    `Die Zoom-Laufzeit meldet die Fassung ${x}, erwartet ist 7.1.5 (43953). Bitte den SDK-Ordner erneut wählen.`,
  B8: (name: string): string => `Das Zoom-SDK ließ sich nicht starten (${name}). Details im Log.`,
  B8_14: 'Auf diesem PC läuft schon ein anderes Programm mit dem Zoom-Meeting-SDK (zum Beispiel das Einsatzpaket „zoom-join“). Bitte es zuerst beenden.',
  B9: (result: string): string =>
    `Zoom hat die Anmeldung abgelehnt: Client-ID oder Client-Secret stimmen nicht (${result}). Bitte die Zugangsdaten-Datei prüfen.`,
  B10: 'Zoom hat die Anmeldung abgelehnt: Das Anmelde-Token passt nicht (AUTHRET_JWTTOKENWRONG). Meist stimmen die Zugangsdaten nicht, oder die Uhr dieses PCs geht falsch.',
  B11: (result: string): string =>
    `Das Zoom-Konto der App darf das Meeting-SDK nicht nutzen (${result}). Das klärt der Inhaber des Zoom-Kontos.`,
  B12: (result: string): string => `Zoom ist gerade nicht erreichbar (${result}). Netzwerk prüfen und erneut versuchen.`,
  B13: 'Zoom lässt diese SDK-Fassung nicht mehr zu (AUTHRET_CLIENT_INCOMPATIBLE). Nötig ist ein neuer Connect-Release mit neuer SDK-Fassung.',
  B14: 'Zu viele Anmeldungen in kurzer Zeit (AUTHRET_LIMIT_EXCEEDED_EXCEPTION). Einige Minuten warten.',
  B15: (result: string): string => `Zoom hat die Anmeldung abgelehnt (${result}).`,
  B16: 'Zoom hat auf die Anmeldung nicht geantwortet (30 s). Netzwerk prüfen und erneut versuchen.',
  B17: 'Zugangsdaten fehlen — bitte die Datei wählen.',
  B18: (name: string): string =>
    `Das Zoom-SDK hat die Anmeldung sofort abgewiesen (${name}). Mit dem Netzwerk hat das nichts zu tun. Details im Log.`,

  // 8.3 Beitritt (ohne die C-Texte, die liefert failText)
  N0: 'Die Meeting-Nummer darf nur Ziffern enthalten (Leerzeichen und Bindestriche werden entfernt).',
  N0b: 'Der Anzeigename muss 1 bis 64 Zeichen lang sein.',
  CT: 'Zoom hat den Beitritt in 30 s weder bestätigt noch abgelehnt. Netzwerk prüfen und erneut versuchen.',
  CE: 'Der Host hat zugelassen, aber Zoom hat den Einlass in 30 s nicht abgeschlossen. Netzwerk prüfen und erneut beitreten.',
  CJ: (name: string): string => `Zoom hat den Beitritt nicht angenommen (${name}).`,
  CB: (detail: string): string => `Die Zoom-Bridge hat sich während des Beitritts beendet (${detail}). Details im Log.`,

  // 8.4 Im Meeting und an Quellen (Q3 hat keinen Text)
  Q1: 'Keine Aufnahme-Erlaubnis — der Host muss sie im Zoom-Client erteilen.',
  Q2: 'Diese Person ist nicht mehr im Meeting.',
  Q4: (name: string): string => `Die Quelle ließ sich nicht aufbauen (${name}). Details im Log.`,
  Q5: (name: string): string =>
    `Ton nicht verfügbar (${name}) — das Bild läuft ohne Ton. Für einen neuen Versuch entladen und neu laden.`,
  Q6: (dropped: number): string => `Ton: ${dropped} Pakete verworfen — dieser PC kommt nicht hinterher.`,
  Q7: 'NDI ließ sich in der Zoom-Bridge nicht starten. Details im Log.',
  Q8: 'Keine Antwort der Zoom-Bridge auf „Als Quelle laden“.',
  Q9: (n: number): string =>
    `Mehr als 5 Zoom-Quellen sind nicht gemessen. Noch einmal klicken, um die ${n}. Quelle trotzdem zu laden.`,
  Q10: (ndiName: string): string =>
    `NDI-Name doppelt: Ein Browser-Gast und diese Zoom-Person senden beide als „${ndiName}“. Im Switcher ist nicht sicher, welche Quelle ankommt. Einen der beiden umbenennen.`,
  Q11: 'Name doppelt im Meeting — nach einem Wiederbeitritt kann Connect diese Quelle nicht von selbst zuordnen.',
  Q12: (name: string): string =>
    `Zoom hat die Anfrage nach der Aufnahme-Erlaubnis nicht angenommen (${name}). Der Host kann sie im Zoom-Client trotzdem erteilen.`,
  Q13: 'Bild-Versatz: erlaubt sind ganze Zahlen von 0 bis 1000 ms.',
  Q14: 'Zum Umschalten erst entladen.',
  Q15: 'Erst im Zoom-Client zulassen.',
  Q16: (person: string): string =>
    `Bild: fehlerhafte Bilder von „${person}“ verworfen (videoBufferMismatch). Die Quelle bleibt bestehen; ob wieder Bild kommt, zeigt ihr Bild-Zustand.`,
  Q17: (person: string): string =>
    `Ton: ein fehlerhaftes Paket von „${person}“ verworfen (audioBufferMismatch). Der Ton läuft mit dem nächsten gültigen Paket weiter.`,

  // 8.5 Abriss (R6; R2, R4, R5, R7 mit Plan 4b)
  R6: (grund: string): string => `Meeting beendet: ${grund}.`,

  // 6.1 Schritt 5: Ergebnis von „Einrichtung prüfen“
  PRUEFUNG_OK: 'Einrichtung in Ordnung: Zoom-SDK 7.1.5 (43953), Anmeldung bei Zoom erfolgreich.',

  // Nur 4a, in 4b durch den Wiederbeitritt ersetzt: Abriss ohne Wiederbeitritt führt sofort zu
  // `fehler` (Plan-Kopf „Nicht in 4a“). Vorsatz davor ist VORSATZ.verbindung.
  UE_RECONNECT: 'Zoom hat die Verbindung in 30 s nicht wiederhergestellt.',
  UE_ABSTURZ: (detail: string): string => `Die Zoom-Bridge ist abgestürzt (${detail}). Details im Log.`,
};

// ── 8.3: Texte nach dem Vorsatz, je Fehlercode von `status failed` ──
const C13 = 'Das Meeting ist durch eine Kontoeinstellung eingeschränkt.';
const C88 = 'Zoom kann die Meeting-Nummer keinem Meeting eindeutig zuordnen. Bitte die Nummer prüfen.';
const C500 =
  'Zoom verlangt für dieses Meeting einen Beitritt im Namen eines angemeldeten Nutzers (OBF-Token). Das kann JM Connect nicht — nur Meetings im eigenen Zoom-Konto.';
const C_TEXTE: Record<number, string> = {
  4: 'falscher Kenncode.',
  6: 'Das Meeting ist vorbei.',
  7: 'Das Meeting hat noch nicht begonnen, und Warten auf den Host ist nicht erlaubt.',
  8: 'Dieses Meeting gibt es nicht. Bitte die Nummer prüfen.',
  9: 'Das Meeting ist voll.',
  10: 'Zoom lässt diese SDK-Fassung nicht mehr zu (Client zu alt). Nötig ist ein neuer Connect-Release mit neuer SDK-Fassung.',
  12: 'Das Meeting ist gesperrt.',
  13: C13,
  14: C13,
  16: 'Zoom hat das Anmelde-Token als abgelaufen abgewiesen. Meist geht die Uhr dieses PCs falsch.',
  23: 'Das Meeting verlangt eine Anmeldung mit einem Zoom-Konto. JM Connect tritt ohne Anmeldung bei.',
  60: 'Das Meeting ist nur für Mitglieder des Gastgeber-Kontos freigegeben.',
  62: 'Der Host lässt niemanden von außerhalb seines Zoom-Kontos zu.',
  63: 'Das Meeting gehört nicht zum Zoom-Konto dieser App. JM Connect kann nur Meetings im eigenen Zoom-Konto betreten. Bitte das Meeting im eigenen Konto anlegen.',
  64: 'Der Administrator des Gastgeber-Kontos hat diese App gesperrt.',
  82: 'Das Meeting verlangt eine Anmeldung mit dem Konto des Veranstalters. JM Connect tritt ohne Anmeldung bei und kann nur Meetings im eigenen Zoom-Konto betreten.',
  88: C88,
  89: C88,
  500: C500,
  501: C500,
  502: C500,
  503: C500,
  504: C500,
  505: C500,
  506: C500,
};

/** Text nach dem Vorsatz (8.3): eigener Text, C61 mit Anzeigename, sonst Csonst. */
export function failText(code: number, anzeigename: string): string {
  if (code === 61) return `Der Host hat „${anzeigename}“ aus dem Meeting entfernt.`;
  return C_TEXTE[code] ?? `${failReason(code)} (Code ${code}).`;
}

/** `status failed` → Meldung. Nie explainStatus (sonst „Beitritt gescheitert: gescheitert: …“). */
export function failMeldung(vorsatz: Vorsatz, code: number, anzeigename: string): Meldungstext {
  return { text: vorsatz + failText(code, anzeigename), detail: `${failCodeName(code)} (${code})` };
}

/** `status ended` durch den Host (6.5): R6 mit endReason ohne Vorsatz; Grund 1 = C61. */
export function endeMeldung(code: number, anzeigename: string): Meldungstext {
  if (code === 1) return { text: failText(61, anzeigename), detail: null };
  return { text: KT.R6(endReason(code)), detail: null };
}

/** `auth` mit Code ≠ 0 → B9–B15 (8.2). */
export function authMeldung(code: number): Meldungstext {
  const result = authResultName(code);
  const detail = `${result} (${code})`;
  if (code === 1 || code === 2) return { text: KT.B9(result), detail };
  if (code === 11) return { text: KT.B10, detail };
  if (code === 3 || code === 4) return { text: KT.B11(result), detail };
  if (code === 6 || code === 8 || code === 9) return { text: KT.B12(result), detail };
  if (code === 10) return { text: KT.B13, detail };
  if (code === 12) return { text: KT.B14, detail };
  return { text: KT.B15(result), detail };
}

/** Rückgabewert aus der detail-Zeile von bridge.ts („… exitCode=<n>“), wie cli/steuerung.mjs. */
export function exitCodeAus(detail: string | undefined): number | null {
  const m = /exitCode=(\d+)/.exec(detail ?? '');
  return m ? Number(m[1]) : null;
}

/** DLL-Tod beim Start (B3–B5); andere Rückgabewerte → null. Namen wie cli/steuerung.mjs DLL_FEHLER. */
export function dllMeldung(exitCode: number | null): Meldungstext | null {
  if (exitCode === 0xc0000135) return { text: KT.B3, detail: 'STATUS_DLL_NOT_FOUND (0xC0000135)' };
  if (exitCode === 0xc0000139) return { text: KT.B4, detail: 'STATUS_ENTRYPOINT_NOT_FOUND (0xC0000139)' };
  if (exitCode === 0xc000007b) return { text: KT.B5, detail: 'STATUS_INVALID_IMAGE_FORMAT (0xC000007B)' };
  return null;
}

/** Spawn-Fehler von start(): ENOENT → B1, sonst B2 mit dem Code. */
export function spawnMeldung(code: string | undefined): Meldungstext {
  const c = code ?? 'unbekannt';
  if (c === 'ENOENT') return { text: KT.B1, detail: c };
  return { text: KT.B2(c), detail: c };
}

/** „NAME (code)“ für meldung.detail und das Log. */
export function fehlerDetail(e: { name?: string; code: number | string }): string {
  return `${e.name ?? 'unbekannt'} (${e.code})`;
}

/** Text eines Einrichtungsmangels (6.2 Beitritt Schritt 1, 5.3). */
export function mangelText(m: ZoomMangel, datei: string | null): string {
  switch (m) {
    case 'zugang_fehlt':
      return KT.B17;
    case 'sdk_fehlt':
    case 'sdk_defekt':
      return KT.S9(datei ?? 'jm-zoom-laufzeit.json');
    case 'bridge_fehlt':
      return KT.S8;
    case 'zugang_unlesbar':
      return KT.A5;
  }
}

/** Wohin ein Fehler gehört: an die Zeile/Quelle, unter „Hinweise“ oder nirgends (8.4). */
export type Einordnung = { art: 'zeile'; text: string } | { art: 'hinweis'; text: string } | { art: 'keine' };

/** `error where:'video'|'audio'` → Einordnung (8.4). `name` = Fehlername aus enrich(), `person` = Anzeigename. */
export function quellenFehler(code: string, name: string, person: string | null, dropped?: number): Einordnung {
  const wer = person ?? 'unbekannt';
  switch (code) {
    case 'videoNoPrivilege':
      return { art: 'zeile', text: KT.Q1 };
    case 'videoUnknownParticipant':
      return { art: 'zeile', text: KT.Q2 };
    case 'videoAlreadySubscribed':
      return { art: 'keine' }; // Q3: kein Text, das Abbild gleicht sich an
    case 'videoRendererFailed':
    case 'videoRawRecordingFailed':
    case 'videoSenderFailed':
      return { art: 'zeile', text: KT.Q4(name) };
    case 'audioVoipJoinFailed':
    case 'audioHelperMissing':
    case 'audioSubscribeFailed':
      return { art: 'zeile', text: KT.Q5(name) };
    case 'videoBadDelay':
      return { art: 'zeile', text: KT.Q13 };
    case 'audioQueueOverflow':
      return { art: 'hinweis', text: KT.Q6(dropped ?? 0) };
    case 'videoBufferMismatch':
      return { art: 'hinweis', text: KT.Q16(wer) };
    case 'audioBufferMismatch':
      return { art: 'hinweis', text: KT.Q17(wer) };
    default:
      return { art: 'zeile', text: KT.Q4(name) };
  }
}

/** Ton-Zustand einer Quelle: nur `off`/`audioUnavailable` ist ein Fehler (Q5); `off`/`command` ist „ohne Ton geladen“. */
export function tonZustand(state: AudioState, reason: AudioReason): Einordnung {
  if (state === 'off' && reason === 'audioUnavailable') return { art: 'zeile', text: KT.Q5('audioUnavailable') };
  return { art: 'keine' };
}

/**
 * Maskierung für Logzeilen (8.7): jeden NICHT-LEEREN Wert durch „•••“ ersetzen, längste zuerst
 * (sonst bliebe vom normierten Teil einer längeren eingegebenen Nummer ein Rest stehen).
 */
export function maskiere(zeile: string, werte: ReadonlyArray<string>): string {
  const liste = werte.filter((w) => w.length > 0).sort((a, b) => b.length - a.length);
  let aus = zeile;
  for (const w of liste) aus = aus.replaceAll(w, '•••');
  return aus;
}
```

- [ ] **Step 4: Test laufen lassen (grün)**

```
npx tsx apps/connect/test/zoom-text.test.ts
```
Erwartet: keine Zeile, die mit `FAIL` beginnt, Exitcode 0, letzte Zeile `487 ok, 0 fehlgeschlagen.` (319 aus Aufgabe 5 + 168 neu; am nachgespielten Planstand gemessen). Unter anderem:
```
  ok  KT hat genau diese 62 Einträge (F1–F8, R2/R4/R5/R7 erst in 4b)
  ok  Beitritt, 63 → C63: ganzer Text wörtlich
  ok  Wiederbeitritt, 2 → Csonst: kein zweites „gescheitert:“
  ok  detail für 63 wörtlich
  ok  Grund 2 → „Meeting beendet: vom Gastgeber beendet.“
  ok  B3 nennt die Zugangsdaten NICHT als Ursache
  ok  Ton off/command (ohne Ton geladen) → kein Fehler
  ok  nur leerer Wert → Zeile unverändert (kein ••• zwischen den Zeichen)
```
(Zeilen wie `  ok  unbekannter Code: „unbekannter Grund (Code 4242).“ und MEETING_FAIL_CODE_4242` enthalten das Wort `FAIL` im SDK-Namen; maßgeblich sind nur Zeilen, die mit `FAIL` beginnen.)

- [ ] **Step 5: Selbsttest über npm und Typcheck**

```
npm run selftest -w @jm/connect
npm run typecheck -w @jm/connect
```
Erwartet: `selftest` endet mit `487 ok, 0 fehlgeschlagen.`, Exitcode 0. `typecheck` ohne Fehlermeldung von `tsc`, Exitcode 0; die Ausgabe besteht nur aus den npm-Kopfzeilen von `typecheck`, `typecheck:node` (`tsc --noEmit -p tsconfig.node.json`) und `typecheck:web` (`tsc --noEmit -p tsconfig.web.json`).

- [ ] **Step 6: Commit** (im Bash-Werkzeug / Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add apps/connect/src/main/zoom/klartext.ts apps/connect/test/zoom-text.test.ts
git status --short
```
Erwartet genau:
```
A  apps/connect/src/main/zoom/klartext.ts
M  apps/connect/test/zoom-text.test.ts
```
Dann:
```
git commit -m "feat(connect): Zoom-Klartexte aus Spec 8 (Stage 4a)" -m "klartext.ts haelt alle Texte aus 8.1 bis 8.5 woertlich (KT), die Zuordnung von failed-Codes (Vorsatz + Text, detail = failCodeName), Meeting-Ende (R6, Grund 1 = C61), auth-Codes (B9 bis B15), DLL-Tod (B3 bis B5), Spawn-Fehlern, Maengeln sowie Bild- und Ton-Fehlern (Zeile, Hinweis oder nichts) und die Maskierung fuer Logzeilen. Dazu die zwei 4a-Uebergangstexte fuer den Abriss ohne Wiederbeitritt." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Gegenprobe (Spec 12.5) — nach dem Commit, ohne neuen Commit**

Je Zeile den Vorher-Text in `apps/connect/src/main/zoom/klartext.ts` mit dem Edit-Werkzeug ersetzen, `npx tsx apps/connect/test/zoom-text.test.ts` laufen lassen (muss rot werden, Exitcode 1), dann die Ersetzung rückgängig machen.
1. `explainStatus`-Vorsatz im Klartext: ``return C_TEXTE[code] ?? `${failReason(code)} (Code ${code}).`;`` → ``return C_TEXTE[code] ?? `gescheitert: ${failReason(code)} (Code ${code}).`;``. Erwartet u. a. `FAIL  Beitritt, 2 → Csonst: kein zweites „gescheitert:“`.
2. Maskierung ohne Prüfung auf leere Werte: `const liste = werte.filter((w) => w.length > 0).sort((a, b) => b.length - a.length);` → `const liste = [...werte].sort((a, b) => b.length - a.length);`. Erwartet u. a. `FAIL  nur leerer Wert → Zeile unverändert (kein ••• zwischen den Zeichen)`.
3. Ton `off`/`command` als Fehler: `if (state === 'off' && reason === 'audioUnavailable')` → `if (state === 'off')`. Erwartet u. a. `FAIL  Ton off/command (ohne Ton geladen) → kein Fehler`.
4. Q16 als Zeilenfehler: `return { art: 'hinweis', text: KT.Q16(wer) };` → `return { art: 'zeile', text: KT.Q16(wer) };`. Erwartet `FAIL  videoBufferMismatch → Hinweis Q16 (keine Zeile)`.

Danach:
```
git status --short
```
Erwartet: keine Ausgabe.

**Abweichungen vom Gerüst:**
- `KT` ist ein Objektliteral ohne eigene Typangabe; Platzhalter-Texte sind Pfeilfunktionen (`S3: (gefunden: string): string => …`). Für Aufrufer ist das gleichwertig mit der Methodenform im Gerüst (`KT.S3('7.1.6.1')`).
- `quellenFehler` mit `person === null` (Teilnehmer unbekannt) setzt in Q16/Q17 „unbekannt“ ein; die Spec nennt dafür keinen Text.
- `fehlerDetail` ohne `name` liefert `unbekannt (<code>)`; `spawnMeldung` ohne Code liefert B2 mit „unbekannt“. Beides kommt nach `enrich()` bzw. bei Node-Spawn-Fehlern praktisch nicht vor.
- `dllMeldung` setzt `detail` auf `STATUS_DLL_NOT_FOUND (0xC0000135)`, `STATUS_ENTRYPOINT_NOT_FOUND (0xC0000139)` bzw. `STATUS_INVALID_IMAGE_FORMAT (0xC000007B)` (Namen aus `cli/steuerung.mjs:169-173`); die Spec sagt nur „technischer Name und Code“.
- `maskiere` sortiert die Werte absteigend nach Länge vor dem Ersetzen, damit von einer längeren eingegebenen Nummer kein Rest stehen bleibt, wenn ein kürzerer Wert darin vorkommt (Test „längster Wert zuerst“).

---

### Task 7: Connect: Laufzeit-Ordner einrichten (`laufzeit.ts`, Teil 1)

**Spec:** `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md` Abschnitte 5.3 (Layout, Stempel), 6.1 „SDK-Ordner wählen“ Schritte 3–10 und der Absatz darunter (Fehler in 7–10 → S6, Abbruch beim Beenden), 8.1 (S1–S7), 12.3 Nr. 1–4, 7 und 8, Begriffe „Laufzeit-Ordner“, „Eigene Dateien“, „Stempel“ (Abschnitt 4). Review Focus 3, Teil `richteEin` (das Zusammenspiel mit `kern.beenden` belegt Aufgabe 10).

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\suite-sofort-fixes` (Branch `feat/zoom-stage4-connect`). Alle Pfade relativ dazu.

**Files:**
- Create: `apps/connect/src/main/zoom/laufzeit.ts`
- Create (Test): `apps/connect/test/zoom-laufzeit.test.ts`
- Modify: `apps/connect/package.json` Zeile 17 (Skript `selftest`, angelegt in Aufgabe 5)

Zeilenangaben gelten für den Stand nach Aufgabe 6. Maßgeblich ist der wortgleiche Vorher-Text.

**Interfaces:**
- Consumes:
  - Aufgabe 1: `SDK_FASSUNG = '7.1.5.43953'`, `findeSdkBin(gewaehlt: string, gibtEs: (pfad: string) => boolean): string | null`, `peInfo(buf: Uint8Array): { maschine: 'x64' | 'x86' | 'andere'; maschinenTyp: number; fassung: string | null }` (wirft bei Nicht-PE) aus `@jm/zoom-bridge/sdk`.
  - Aufgabe 6: `KT.S1`–`KT.S7` aus `./klartext`.
- Produces (exakt so, Aufgaben 8, 10 und 16 bauen darauf):
  ```ts
  // apps/connect/src/main/zoom/laufzeit.ts
  export const STEMPEL_DATEI = 'jm-zoom-laufzeit.json';
  export const BRIDGE_EXE = 'zoom-bridge.exe';
  export const NDI_DLL = 'Processing.NDI.Lib.x64.dll';
  export const PLATZ_RESERVE_BYTES = 100 * 1024 * 1024;
  export const EIGENE_NAMEN_FEST: readonly string[]; // ['zoom-bridge.exe','Processing.NDI.Lib.x64.dll','msvcp140.dll','msvcp140_codecvt_ids.dll','vcruntime140.dll','vcruntime140_1.dll']
  export interface LaufzeitPfade { basis: string; ressourcen: string }
  export interface Stempel { format: 1; sdkFassung: string; eingerichtetAm: string; sdkDateien: { pfad: string; bytes: number }[]; eigeneDateien: { pfad: string; sha256: string }[] }
  export interface KopieStand { dateien: number; dateienGesamt: number; bytes: number; bytesGesamt: number }
  export type SdkWahl = { ok: true; bin: string; fassung: string; dateien: { pfad: string; bytes: number }[]; bytesGesamt: number } | { ok: false; text: string };
  export interface LaufzeitWerkzeuge { copyFile(von: string, nach: string): Promise<void>; statfs(pfad: string): Promise<{ bavail: number; bsize: number }>; jetzt(): Date }
  export type EinrichtungsErgebnis = { ok: true; ordner: string; stempel: Stempel; aufraeumFehler: string | null } | { ok: false; text: string };
  export function laufzeitOrdner(p: LaufzeitPfade): string;                    // join(p.basis, SDK_FASSUNG)
  export function eigeneQuellen(ressourcen: string): { pfad: string; quelle: string }[];
  export function pruefeSdkOrdner(gewaehlt: string, ressourcen: string): SdkWahl;
  export function richteEin(e: { wahl: Extract<SdkWahl, { ok: true }>; pfade: LaufzeitPfade; fortschritt: (k: KopieStand) => void; signal?: AbortSignal; werkzeuge?: Partial<LaufzeitWerkzeuge> }): Promise<EinrichtungsErgebnis>;
  // modulintern, von Aufgabe 8 mitbenutzt: unter, groesse, sha256, leseStempel, schreibeStempel
  ```
  Testdatei `apps/connect/test/zoom-laufzeit.test.ts` mit den Hilfen `ordner`, `machePe`, `baueSdk`, `baueRessourcen`, `sha`, `wahlVon`, `eingerichtet`, `zweitesSdk`, der Ankerzeile und der Schlusszeile (Temp-Ordner wird nach der Ankerzeile gelöscht). Aufgabe 8 hängt ihre Blöcke über der Ankerzeile an.

**Regeln für diese Aufgabe:**
- `src/main/zoom/laufzeit.ts`: kein `electron` (G8). Node-Module (`node:fs`, `node:path`, `node:crypto`) sind hier erlaubt; die Datei liegt nicht unter `src/shared`.
- Pfade im Stempel und in `SdkWahl.dateien` immer mit „/“, relativ zu `x64\bin` bzw. zum Laufzeit-Ordner; auf der Platte über `join(wurzel, ...pfad.split('/'))`.
- Kein Test braucht das echte SDK oder Windows (G10): Die PE-Dateien erzeugt der Test, Kopierfehler, Platz und Uhr sind eingespeist.
- Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel, nie pushen.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`apps/connect/test/zoom-laufzeit.test.ts`, neu)

Fälle aus Spec 12.3: Nr. 1 (Wurzel, `x64`, `x64/bin` erkannt; leer → S1; x86 → S2; 7.1.6 → S3; ohne Version → S3b), Nr. 7 (eigener Name im SDK → S4), Nr. 2 (Fortschritt, Stempel), Nr. 3 (Kopierfehler bei Datei 5 → S6), Nr. 4 (zu wenig Platz → S5), Nr. 8 (Tausch, Geschwister), dazu S7 und Review Focus 3.
```ts
// Laufzeit-Ordner der Zoom-Bridge OHNE Electron und OHNE echtes SDK (tsx): npm run selftest -w @jm/connect
// Spec 12.3: Temp-Ordner mit erzeugten PE-Dateien. Kopierfehler, Platz und Uhr sind eingespeist.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { KT } from '../src/main/zoom/klartext';
import {
  BRIDGE_EXE, EIGENE_NAMEN_FEST, eigeneQuellen, laufzeitOrdner, NDI_DLL, PLATZ_RESERVE_BYTES, pruefeSdkOrdner, richteEin,
  STEMPEL_DATEI, type KopieStand, type LaufzeitPfade, type SdkWahl, type Stempel,
} from '../src/main/zoom/laufzeit';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

// ── Testhilfen ──
const TEMP = mkdtempSync(join(tmpdir(), 'jmc-laufzeit-'));
let nr = 0;
/** Frischer Unterordner im Temp-Ordner. */
function ordner(name: string): string {
  const d = join(TEMP, `${++nr}-${name}`);
  mkdirSync(d, { recursive: true });
  return d;
}

const X64 = 0x8664;
const X86 = 0x014c;
const F_OK: [number, number, number, number] = [7, 1, 5, 43953];

/** PE-Puffer (eigene Kopie der Hilfe aus Aufgabe 1): 0x200 Bytes, MZ, e_lfanew 0x80, PE\0\0, Maschinentyp, VS_FIXEDFILEINFO bei 0x100. */
function machePe(maschine: number, fassung: [number, number, number, number] | null): Buffer {
  const b = Buffer.alloc(0x200);
  b.write('MZ', 0, 'latin1');
  b.writeUInt32LE(0x80, 0x3c);
  b.write('PE\0\0', 0x80, 'latin1');
  b.writeUInt16LE(maschine, 0x84);
  if (fassung) {
    b.set([0xbd, 0x04, 0xef, 0xfe], 0x100);
    b.writeUInt32LE(((fassung[0] << 16) | fassung[1]) >>> 0, 0x108);
    b.writeUInt32LE(((fassung[2] << 16) | fassung[3]) >>> 0, 0x10c);
  }
  return b;
}

/** Sieben Dateien neben sdk.dll, zwei davon in Unterordnern wie im echten SDK. */
const SDK_DATEIEN = ['CptHost.exe', 'zVideoApp.dll', 'zAudio.dll', 'turbojpeg.dll', 'zmb.dll', 'language/de.txt', 'ringtone/r.pcm'];

/** SDK-Wurzel mit version.txt und x64/bin (sdk.dll + 7 Dateien + `extra`). Liefert die Wurzel. */
function baueSdk(wurzel: string, o: { maschine?: number; fassung?: [number, number, number, number] | null; extra?: string[] } = {}): string {
  const bin = join(wurzel, 'x64', 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(wurzel, 'version.txt'), 'v7.1.5.43953');
  writeFileSync(join(bin, 'sdk.dll'), machePe(o.maschine ?? X64, o.fassung === undefined ? F_OK : o.fassung));
  for (const [i, p] of [...SDK_DATEIEN, ...(o.extra ?? [])].entries()) {
    const f = join(bin, ...p.split('/'));
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, Buffer.alloc(100 + i * 10, 0x41 + i));
  }
  return wurzel;
}

/** Ressourcen wie im Paket: zoom-bridge/zoom-bridge.exe, zoom-bridge/vcruntime140.dll, bin/win/<NDI-DLL>. */
function baueRessourcen(dir: string): string {
  mkdirSync(join(dir, 'zoom-bridge'), { recursive: true });
  mkdirSync(join(dir, 'bin', 'win'), { recursive: true });
  writeFileSync(join(dir, 'zoom-bridge', BRIDGE_EXE), 'bridge-1');
  writeFileSync(join(dir, 'zoom-bridge', 'vcruntime140.dll'), 'vc');
  writeFileSync(join(dir, 'bin', 'win', NDI_DLL), 'ndi');
  return dir;
}

function sha(datei: string): string {
  return createHash('sha256').update(readFileSync(datei)).digest('hex');
}

function wahlVon(w: SdkWahl): Extract<SdkWahl, { ok: true }> {
  if (!w.ok) throw new Error(`Wahl gescheitert: ${w.text}`);
  return w;
}

const ruhig = (): void => {};

/** Ausgangslage: ein fertig eingerichteter Laufzeit-Ordner. */
async function eingerichtet(name: string): Promise<{ pfade: LaufzeitPfade; ziel: string; dir: string }> {
  const dir = ordner(name);
  const pfade: LaufzeitPfade = { basis: join(dir, 'zoom-laufzeit'), ressourcen: baueRessourcen(join(dir, 'res')) };
  const r = await richteEin({ wahl: wahlVon(pruefeSdkOrdner(baueSdk(join(dir, 'sdk')), pfade.ressourcen)), pfade, fortschritt: ruhig });
  if (!r.ok) throw new Error(`Ausgangslage: ${r.text}`);
  return { pfade, ziel: laufzeitOrdner(pfade), dir };
}

/** Zweites SDK neben der Ausgangslage, mit einer zusätzlichen Datei neu.dll (9 Dateien). */
function zweitesSdk(dir: string, pfade: LaufzeitPfade): Extract<SdkWahl, { ok: true }> {
  return wahlVon(pruefeSdkOrdner(baueSdk(join(dir, 'sdk2'), { extra: ['neu.dll'] }), pfade.ressourcen));
}

console.log('— 12.3 Nr. 1 und 7: Ordnerwahl, eigene Dateien');
{
  const d = ordner('wahl');
  const res = baueRessourcen(join(d, 'res'));
  const w = baueSdk(join(d, 'sdk'));
  const bin = join(w, 'x64', 'bin');
  for (const [name, gewaehlt] of [['Wurzel', w], ['x64', join(w, 'x64')], ['x64/bin', bin]]) {
    const r = pruefeSdkOrdner(gewaehlt, res);
    ck(`${name} erkannt, bin = x64/bin, Fassung 7.1.5.43953`, r.ok && r.bin === bin && r.fassung === '7.1.5.43953');
  }
  const r = wahlVon(pruefeSdkOrdner(w, res));
  ck('8 Dateien, Pfade mit „/“, Unterordner mitgezählt',
    r.dateien.length === 8 && r.dateien.some((x) => x.pfad === 'language/de.txt') && r.dateien.some((x) => x.pfad === 'ringtone/r.pcm'));
  ck('bytesGesamt = Summe der Dateigrößen', r.bytesGesamt > 0 && r.bytesGesamt === r.dateien.reduce((s, x) => s + x.bytes, 0));
  ck('version.txt (außerhalb von x64/bin) gehört nicht dazu', !r.dateien.some((x) => x.pfad.includes('version')));

  ck('leerer Ordner → S1', JSON.stringify(pruefeSdkOrdner(ordner('leer'), res)) === JSON.stringify({ ok: false, text: KT.S1 }));
  ck('x86 → S2', JSON.stringify(pruefeSdkOrdner(baueSdk(ordner('x86'), { maschine: X86 }), res)) === JSON.stringify({ ok: false, text: KT.S2 }));
  ck('Fassung 7.1.6.1 → S3', JSON.stringify(pruefeSdkOrdner(baueSdk(ordner('716'), { fassung: [7, 1, 6, 1] }), res)) === JSON.stringify({ ok: false, text: KT.S3('7.1.6.1') }));
  ck('ohne Versionsangabe → S3b', JSON.stringify(pruefeSdkOrdner(baueSdk(ordner('ohne'), { fassung: null }), res)) === JSON.stringify({ ok: false, text: KT.S3b }));
  const kaputt = baueSdk(ordner('kaputt'));
  writeFileSync(join(kaputt, 'x64', 'bin', 'sdk.dll'), 'keine PE-Datei');
  ck('sdk.dll ist keine PE-Datei → S3b', JSON.stringify(pruefeSdkOrdner(kaputt, res)) === JSON.stringify({ ok: false, text: KT.S3b }));

  // Nr. 7: eigener Dateiname im SDK → S4 (nur Dateiname, ohne Groß-/Kleinschreibung, auch in Unterordnern)
  ck('VCRuntime140.dll im SDK → S4', JSON.stringify(pruefeSdkOrdner(baueSdk(ordner('vc'), { extra: ['VCRuntime140.dll'] }), res)) === JSON.stringify({ ok: false, text: KT.S4('VCRuntime140.dll') }));
  ck('zoom-bridge.exe in einem Unterordner des SDK → S4', JSON.stringify(pruefeSdkOrdner(baueSdk(ordner('br'), { extra: ['tief/zoom-bridge.exe'] }), res)) === JSON.stringify({ ok: false, text: KT.S4('zoom-bridge.exe') }));
  ck('EIGENE_NAMEN_FEST: die sechs festen Namen', EIGENE_NAMEN_FEST.length === 6 && EIGENE_NAMEN_FEST.includes('vcruntime140_1.dll') && EIGENE_NAMEN_FEST.includes('msvcp140_codecvt_ids.dll'));

  const q = eigeneQuellen(res);
  ck('eigeneQuellen: Bridge-Ordner flach + NDI-DLL, sortiert', JSON.stringify(q.map((x) => x.pfad)) === JSON.stringify([NDI_DLL, 'vcruntime140.dll', BRIDGE_EXE]));
  ck('eigeneQuellen: quelle zeigt auf die Ressource', q[0].quelle === join(res, 'bin', 'win', NDI_DLL) && q.every((x) => existsSync(x.quelle)));
  ck('eigeneQuellen ohne Ressourcen → leer', eigeneQuellen(join(d, 'gibt-es-nicht')).length === 0);
  ck('laufzeitOrdner = basis/7.1.5.43953', laufzeitOrdner({ basis: 'B', ressourcen: 'R' }) === join('B', '7.1.5.43953'));

  // Ein Name, den nur die Ressourcen kennen (nicht in EIGENE_NAMEN_FEST), zählt ebenfalls.
  writeFileSync(join(res, 'zoom-bridge', 'msvcp140_atomic_wait.dll'), 'x');
  ck('Name aus den Ressourcen im SDK → S4', JSON.stringify(pruefeSdkOrdner(baueSdk(ordner('res-name'), { extra: ['msvcp140_atomic_wait.dll'] }), res)) === JSON.stringify({ ok: false, text: KT.S4('msvcp140_atomic_wait.dll') }));
}

console.log('— 12.3 Nr. 2: Kopie mit Fortschritt, Stempel');
{
  const d = ordner('kopie');
  const pfade: LaufzeitPfade = { basis: join(d, 'zoom-laufzeit'), ressourcen: baueRessourcen(join(d, 'res')) };
  const wahl = wahlVon(pruefeSdkOrdner(baueSdk(join(d, 'sdk')), pfade.ressourcen));
  const staende: KopieStand[] = [];
  const r = await richteEin({ wahl, pfade, fortschritt: (k) => staende.push(k), werkzeuge: { jetzt: () => new Date('2026-10-02T12:00:00.000Z') } });
  const ziel = laufzeitOrdner(pfade);
  ck('Einrichtung ok, Ordner = basis/7.1.5.43953', r.ok && r.ordner === ziel);
  ck('Fortschritt nach jeder Datei: 1 … 8 von 8', staende.length === 8 && staende.every((k, i) => k.dateien === i + 1 && k.dateienGesamt === 8));
  ck('Bytes steigen bis bytesGesamt', staende[7].bytes === wahl.bytesGesamt && staende.every((k, i) => k.bytesGesamt === wahl.bytesGesamt && (i === 0 || k.bytes > staende[i - 1].bytes)));
  ck('alle SDK-Dateien da, auch in Unterordnern', wahl.dateien.every((x) => existsSync(join(ziel, ...x.pfad.split('/')))));
  ck('eigene Dateien da', [BRIDGE_EXE, 'vcruntime140.dll', NDI_DLL].every((n) => existsSync(join(ziel, n))));
  const st = JSON.parse(readFileSync(join(ziel, STEMPEL_DATEI), 'utf8')) as Stempel;
  ck('Stempel: format 1, Fassung, Zeit', st.format === 1 && st.sdkFassung === '7.1.5.43953' && st.eingerichtetAm === '2026-10-02T12:00:00.000Z');
  ck('Stempel: alle SDK-Dateien mit Größe', JSON.stringify(st.sdkDateien) === JSON.stringify(wahl.dateien));
  ck('Stempel: eigene Dateien mit SHA-256',
    JSON.stringify(st.eigeneDateien) === JSON.stringify([NDI_DLL, 'vcruntime140.dll', BRIDGE_EXE].map((p) => ({ pfad: p, sha256: sha(join(ziel, p)) }))));
  ck('Rückgabe trägt denselben Stempel', r.ok && JSON.stringify(r.stempel) === JSON.stringify(st));
  ck('kein .teil, kein .alt übrig', !existsSync(`${ziel}.teil`) && !existsSync(`${ziel}.alt`));
}

console.log('— 12.3 Nr. 3: Kopierfehler bei Datei 5 → S6, vorige Einrichtung unverändert');
{
  const { pfade, ziel, dir } = await eingerichtet('fehler5');
  const vorher = readFileSync(join(ziel, STEMPEL_DATEI));
  let n = 0;
  const r = await richteEin({
    wahl: zweitesSdk(dir, pfade), pfade, fortschritt: ruhig,
    werkzeuge: {
      copyFile: async (von, nach) => {
        if (++n === 5) throw Object.assign(new Error('E/A-Fehler'), { code: 'EIO' });
        copyFileSync(von, nach);
      },
    },
  });
  ck('Ergebnis S6 mit dem Fehlercode', JSON.stringify(r) === JSON.stringify({ ok: false, text: KT.S6('EIO') }));
  ck('.teil gelöscht', !existsSync(`${ziel}.teil`));
  ck('Stempel byte-gleich', readFileSync(join(ziel, STEMPEL_DATEI)).equals(vorher));
  ck('neue Datei nicht in der alten Einrichtung', !existsSync(join(ziel, 'neu.dll')) && existsSync(join(ziel, 'sdk.dll')));
}

console.log('— 12.3 Nr. 4: zu wenig Platz → S5, nichts angelegt');
{
  const d = ordner('platz');
  const pfade: LaufzeitPfade = { basis: join(d, 'lokal', 'JM Connect', 'zoom-laufzeit'), ressourcen: baueRessourcen(join(d, 'res')) };
  const wahl = wahlVon(pruefeSdkOrdner(baueSdk(join(d, 'sdk')), pfade.ressourcen));
  let gefragt = '';
  let kopiert = 0;
  const r = await richteEin({
    wahl, pfade, fortschritt: ruhig,
    werkzeuge: {
      statfs: async (p) => { gefragt = p; return { bavail: 10, bsize: 4096 }; },
      copyFile: async () => { kopiert++; },
    },
  });
  const gebraucht = Math.ceil((wahl.bytesGesamt + PLATZ_RESERVE_BYTES) / (1024 * 1024));
  ck('S5 mit gebraucht 101 MB, frei 0 MB', gebraucht === 101 && JSON.stringify(r) === JSON.stringify({ ok: false, text: KT.S5(101, 0) }));
  ck('statfs am nächsten existierenden Vorfahren (basis gibt es noch nicht)', gefragt === d);
  ck('nichts kopiert, nichts angelegt', kopiert === 0 && !existsSync(pfade.basis));
}

console.log('— 12.3 Nr. 8: zweite Einrichtung ersetzt die erste, Geschwister nur mit gültigem Stempel weg');
{
  const { pfade, ziel, dir } = await eingerichtet('tausch');
  const andere = join(pfade.basis, '7.1.4.1');
  mkdirSync(andere);
  writeFileSync(join(andere, STEMPEL_DATEI), JSON.stringify({ format: 1, sdkFassung: '7.1.4.1', eingerichtetAm: '2026-01-01T00:00:00.000Z', sdkDateien: [], eigeneDateien: [] }));
  const fremd = join(pfade.basis, '7.0.0.1');
  mkdirSync(fremd);
  writeFileSync(join(fremd, 'notiz.txt'), 'nicht von Connect');
  const kaputt = join(pfade.basis, '7.0.0.2');
  mkdirSync(kaputt);
  writeFileSync(join(kaputt, STEMPEL_DATEI), '{ kein JSON');
  const r = await richteEin({ wahl: zweitesSdk(dir, pfade), pfade, fortschritt: ruhig });
  ck('zweite Einrichtung ok', r.ok);
  ck('neue SDK-Datei ist da', existsSync(join(ziel, 'neu.dll')));
  const st = JSON.parse(readFileSync(join(ziel, STEMPEL_DATEI), 'utf8')) as Stempel;
  ck('Stempel nennt 9 SDK-Dateien inkl. neu.dll', st.sdkDateien.length === 9 && st.sdkDateien.some((x) => x.pfad === 'neu.dll'));
  ck('Geschwister 7.1.4.1 mit gültigem Stempel gelöscht', !existsSync(andere));
  ck('Geschwister 7.0.0.1 ohne Stempel bleibt', existsSync(join(fremd, 'notiz.txt')));
  ck('Geschwister mit unlesbarem Stempel bleibt', existsSync(kaputt));
  ck('kein .alt, kein .teil übrig', !existsSync(`${ziel}.alt`) && !existsSync(`${ziel}.teil`));
}

console.log('— 6.1 Schritt 8: Nachprüfung scheitert → S7');
{
  const { pfade, ziel, dir } = await eingerichtet('nachpruefung');
  const vorher = readFileSync(join(ziel, STEMPEL_DATEI));
  let n = 0;
  const r = await richteEin({
    wahl: zweitesSdk(dir, pfade), pfade, fortschritt: ruhig,
    werkzeuge: { copyFile: async (von, nach) => { if (++n === 3) writeFileSync(nach, ''); else copyFileSync(von, nach); } },
  });
  ck('Datei 3 leer kopiert → S7 (8 von 9 Dateien)', JSON.stringify(r) === JSON.stringify({ ok: false, text: KT.S7(8, 9) }));
  ck('.teil gelöscht, alte Einrichtung unverändert', !existsSync(`${ziel}.teil`) && readFileSync(join(ziel, STEMPEL_DATEI)).equals(vorher));

  const r2 = await richteEin({
    wahl: zweitesSdk(ordner('nachpruefung-pe'), pfade), pfade, fortschritt: ruhig,
    werkzeuge: {
      copyFile: async (von, nach) => {
        if (nach.endsWith('sdk.dll')) writeFileSync(nach, machePe(X64, [7, 1, 6, 1])); // gleiche Größe, andere Fassung
        else copyFileSync(von, nach);
      },
    },
  });
  ck('Kopie der sdk.dll mit anderer Fassung → S7 (8 von 9 Dateien)', JSON.stringify(r2) === JSON.stringify({ ok: false, text: KT.S7(8, 9) }));
}

console.log('— Review Focus 3, Teil richteEin: Abbruch während der Kopie (AbortSignal)');
{
  const { pfade, ziel, dir } = await eingerichtet('abbruch');
  const vorher = readFileSync(join(ziel, STEMPEL_DATEI));
  const ac = new AbortController();
  let n = 0;
  const staende: KopieStand[] = [];
  const r = await richteEin({
    wahl: zweitesSdk(dir, pfade), pfade, signal: ac.signal, fortschritt: (k) => staende.push(k),
    werkzeuge: { copyFile: async (von, nach) => { if (++n === 3) ac.abort(); copyFileSync(von, nach); } },
  });
  ck('Ergebnis: abgebrochen (S6)', JSON.stringify(r) === JSON.stringify({ ok: false, text: KT.S6('abgebrochen') }));
  ck('nach Datei 3 keine weitere Datei kopiert', n === 3 && staende.length === 3);
  ck('<ziel>.teil gelöscht', !existsSync(`${ziel}.teil`));
  ck('vorher eingerichteter Ordner und Stempel unverändert',
    readFileSync(join(ziel, STEMPEL_DATEI)).equals(vorher) && !existsSync(join(ziel, 'neu.dll')) && existsSync(join(ziel, 'sdk.dll')));
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
rmSync(TEMP, { recursive: true, force: true });
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npx tsx apps/connect/test/zoom-laufzeit.test.ts
```
Erwartet: Abbruch beim Laden, Exitcode 1, mit
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\connect\src\main\zoom\laufzeit' imported from …\apps\connect\test\zoom-laufzeit.test.ts
```

- [ ] **Step 3: `src/main/zoom/laufzeit.ts` schreiben** (neu)

Ablauf von `richteEin` nach Spec 6.1: (6) Platz am nächsten existierenden Vorfahren von `basis` (`basis` gibt es vor der ersten Einrichtung nicht), Bedarf = Quelle + 100 MB, sonst S5 mit gebraucht `Math.ceil`, frei `Math.floor` in MiB (L7) — dann ist nichts angelegt. (7) `<ziel>.teil` frisch, Datei für Datei, Fortschritt nach jeder Datei, vor jeder Datei und nach der letzten das `AbortSignal` prüfen. (8) Nachprüfen: Zahl, Größen, `peInfo` der kopierten `sdk.dll` → sonst S7. (9) eigene Dateien + Stempel. (10) Tausch über `.alt`; danach Geschwister anderer Fassungen nur mit gültigem Stempel löschen. Jeder Fehler in 6–10 → S6 mit `err.code` (sonst `err.message`), `.teil` gelöscht, vorige Einrichtung unverändert.
```ts
// Laufzeit-Ordner der Zoom-Bridge (Spec 5.3, 6.1): SDK-Ordner prüfen, Datei für Datei nach
// `<ziel>.teil` kopieren, nachprüfen, eigene Dateien und Stempel dazu, dann tauschen.
// Ohne Electron (G8): nur node:-Module, @jm/zoom-bridge und relative Importe.
//
//   %LOCALAPPDATA%\JM Connect\zoom-laufzeit\7.1.5.43953\
//     sdk.dll, … (x64\bin des SDK, mit language\ und ringtone\)
//     zoom-bridge.exe, VC-Laufzeit   eigene Dateien aus <resources>\zoom-bridge\
//     Processing.NDI.Lib.x64.dll     eigene Datei aus <resources>\bin\win\
//     jm-zoom-laufzeit.json          Stempel
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { copyFile as fsCopyFile, statfs as fsStatfs } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { findeSdkBin, peInfo, SDK_FASSUNG } from '@jm/zoom-bridge/sdk';
import { KT } from './klartext';

export const STEMPEL_DATEI = 'jm-zoom-laufzeit.json';
export const BRIDGE_EXE = 'zoom-bridge.exe';
export const NDI_DLL = 'Processing.NDI.Lib.x64.dll';
/** Platzreserve über der Größe der Quelle (Spec 6.1 Schritt 6). */
export const PLATZ_RESERVE_BYTES = 100 * 1024 * 1024;
/** Namen, die Connect selbst mitbringt. Liegt eine solche Datei im SDK-Ordner, ist es kein unverändertes SDK (S4). */
export const EIGENE_NAMEN_FEST: readonly string[] = [
  BRIDGE_EXE,
  NDI_DLL,
  'msvcp140.dll',
  'msvcp140_codecvt_ids.dll',
  'vcruntime140.dll',
  'vcruntime140_1.dll',
];

const MIB = 1024 * 1024;

/** `basis` = …\JM Connect\zoom-laufzeit, `ressourcen` = process.resourcesPath bzw. apps/connect/resources. */
export interface LaufzeitPfade {
  basis: string;
  ressourcen: string;
}

/** Inhalt von jm-zoom-laufzeit.json (Spec 5.3). Pfade mit „/“, relativ zum Laufzeit-Ordner. */
export interface Stempel {
  format: 1;
  sdkFassung: string;
  eingerichtetAm: string;
  sdkDateien: { pfad: string; bytes: number }[];
  eigeneDateien: { pfad: string; sha256: string }[];
}

/** Fortschritt der Kopie, nach jeder Datei (Spec 6.1 Schritt 7). */
export interface KopieStand {
  dateien: number;
  dateienGesamt: number;
  bytes: number;
  bytesGesamt: number;
}

/** Ergebnis der Ordnerwahl (Spec 6.1 Schritte 3–5). `bin` = der Ordner, in dem sdk.dll liegt. */
export type SdkWahl =
  | { ok: true; bin: string; fassung: string; dateien: { pfad: string; bytes: number }[]; bytesGesamt: number }
  | { ok: false; text: string };

/** Einspeisbare Werkzeuge (Tests: Kopierfehler, Platz, Uhr). */
export interface LaufzeitWerkzeuge {
  copyFile(von: string, nach: string): Promise<void>;
  statfs(pfad: string): Promise<{ bavail: number; bsize: number }>;
  jetzt(): Date;
}

export type EinrichtungsErgebnis = { ok: true; ordner: string; stempel: Stempel; aufraeumFehler: string | null } | { ok: false; text: string };

/** Der Laufzeit-Ordner dieser SDK-Fassung. */
export function laufzeitOrdner(p: LaufzeitPfade): string {
  return join(p.basis, SDK_FASSUNG);
}

/** Eigene Dateien: alles aus <ressourcen>/zoom-bridge/ (flach) und die NDI-DLL, sofern vorhanden. Sortiert. */
export function eigeneQuellen(ressourcen: string): { pfad: string; quelle: string }[] {
  const liste: { pfad: string; quelle: string }[] = [];
  const bridgeOrdner = join(ressourcen, 'zoom-bridge');
  if (existsSync(bridgeOrdner)) {
    for (const e of readdirSync(bridgeOrdner, { withFileTypes: true })) {
      if (e.isFile()) liste.push({ pfad: e.name, quelle: join(bridgeOrdner, e.name) });
    }
  }
  const ndi = join(ressourcen, 'bin', 'win', NDI_DLL);
  if (existsSync(ndi)) liste.push({ pfad: NDI_DLL, quelle: ndi });
  return liste.sort((a, b) => (a.pfad < b.pfad ? -1 : a.pfad > b.pfad ? 1 : 0));
}

/** Alle Dateien unter `wurzel`, rekursiv, Pfade mit „/“, sortiert. */
function dateiListe(wurzel: string, unter = ''): { pfad: string; bytes: number }[] {
  const aus: { pfad: string; bytes: number }[] = [];
  for (const e of readdirSync(join(wurzel, unter), { withFileTypes: true })) {
    const rel = unter ? `${unter}/${e.name}` : e.name;
    if (e.isDirectory()) aus.push(...dateiListe(wurzel, rel));
    else if (e.isFile()) aus.push({ pfad: rel, bytes: statSync(join(wurzel, rel)).size });
  }
  return aus.sort((a, b) => (a.pfad < b.pfad ? -1 : a.pfad > b.pfad ? 1 : 0));
}

/** Pfad mit „/“ → Pfad dieses Systems unter `wurzel`. */
function unter(wurzel: string, pfad: string): string {
  return join(wurzel, ...pfad.split('/'));
}

/** Größe einer Datei oder null, wenn sie fehlt. */
function groesse(datei: string): number | null {
  try {
    const s = statSync(datei);
    return s.isFile() ? s.size : null;
  } catch {
    return null;
  }
}

function sha256(datei: string): string {
  return createHash('sha256').update(readFileSync(datei)).digest('hex');
}

/** Stempel lesen; null, wenn er fehlt, kein JSON ist oder nicht `format: 1` hat (Fassung prüft der Aufrufer). */
function leseStempel(ordner: string): Stempel | null {
  try {
    const s = JSON.parse(readFileSync(join(ordner, STEMPEL_DATEI), 'utf8')) as Partial<Stempel> | null;
    if (!s || s.format !== 1 || typeof s.sdkFassung !== 'string') return null;
    if (!Array.isArray(s.sdkDateien) || !Array.isArray(s.eigeneDateien)) return null;
    return s as Stempel;
  } catch {
    return null;
  }
}

function schreibeStempel(ordner: string, s: Stempel): void {
  writeFileSync(join(ordner, STEMPEL_DATEI), `${JSON.stringify(s, null, 2)}\n`);
}

/** Spec 6.1 Schritte 3–5: SDK-Ordner finden und hart prüfen, Dateiliste für Kopie und Stempel. */
export function pruefeSdkOrdner(gewaehlt: string, ressourcen: string): SdkWahl {
  const bin = findeSdkBin(gewaehlt, existsSync);
  if (bin === null) return { ok: false, text: KT.S1 };
  let info: ReturnType<typeof peInfo>;
  try {
    info = peInfo(readFileSync(join(bin, 'sdk.dll')));
  } catch {
    return { ok: false, text: KT.S3b };
  }
  if (info.maschine === 'x86') return { ok: false, text: KT.S2 };
  if (info.fassung === null) return { ok: false, text: KT.S3b };
  if (info.fassung !== SDK_FASSUNG) return { ok: false, text: KT.S3(info.fassung) };
  const dateien = dateiListe(bin);
  const eigene = new Set([...EIGENE_NAMEN_FEST, ...eigeneQuellen(ressourcen).map((q) => q.pfad)].map((n) => n.toLowerCase()));
  for (const d of dateien) {
    const name = d.pfad.split('/').pop() ?? d.pfad;
    if (eigene.has(name.toLowerCase())) return { ok: false, text: KT.S4(name) };
  }
  const bytesGesamt = dateien.reduce((summe, d) => summe + d.bytes, 0);
  return { ok: true, bin, fassung: info.fassung, dateien, bytesGesamt };
}

/** peInfo der Kopie wie bei der Wahl (Spec 6.1 Schritt 8): lesbar, nicht 32 Bit, dieselbe Fassung. */
function sdkDllPasst(datei: string, fassung: string): boolean {
  try {
    const i = peInfo(readFileSync(datei));
    return i.maschine !== 'x86' && i.fassung === fassung;
  } catch {
    return false;
  }
}

/** Freier Platz am nächsten existierenden Vorfahren von `pfad` (basis gibt es vor der ersten Einrichtung nicht). */
async function freierPlatz(pfad: string, w: LaufzeitWerkzeuge): Promise<number> {
  let d = pfad;
  while (!existsSync(d)) {
    const oben = dirname(d);
    if (oben === d) break;
    d = oben;
  }
  const s = await w.statfs(d);
  return s.bavail * s.bsize;
}

/**
 * Spec 6.1 Schritte 6–10. Ein Fehler in 7–10 lässt die bisherige Einrichtung unverändert (S6),
 * `.teil` wird gelöscht. `signal` bricht vor der nächsten Datei ab (Connect wird beendet).
 */
export async function richteEin(e: {
  wahl: Extract<SdkWahl, { ok: true }>;
  pfade: LaufzeitPfade;
  fortschritt: (k: KopieStand) => void;
  signal?: AbortSignal;
  werkzeuge?: Partial<LaufzeitWerkzeuge>;
}): Promise<EinrichtungsErgebnis> {
  const w: LaufzeitWerkzeuge = {
    copyFile: (von, nach) => fsCopyFile(von, nach),
    statfs: (pfad) => fsStatfs(pfad),
    jetzt: () => new Date(),
    ...e.werkzeuge,
  };
  const { wahl, pfade } = e;
  const ziel = laufzeitOrdner(pfade);
  const teil = `${ziel}.teil`;
  const alt = `${ziel}.alt`;
  try {
    // (6) Platz: Quelle + 100 MB, sonst S5 — dann ist noch nichts angelegt.
    const frei = await freierPlatz(pfade.basis, w);
    const bedarf = wahl.bytesGesamt + PLATZ_RESERVE_BYTES;
    if (frei < bedarf) return { ok: false, text: KT.S5(Math.ceil(bedarf / MIB), Math.floor(frei / MIB)) };

    // (7) Kopie nach <ziel>.teil, Datei für Datei, Fortschritt nach jeder Datei.
    rmSync(teil, { recursive: true, force: true });
    mkdirSync(teil, { recursive: true });
    const abgebrochen = (): EinrichtungsErgebnis => {
      rmSync(teil, { recursive: true, force: true });
      return { ok: false, text: KT.S6('abgebrochen') };
    };
    let bytes = 0;
    for (const [i, d] of wahl.dateien.entries()) {
      if (e.signal?.aborted) return abgebrochen();
      const nach = unter(teil, d.pfad);
      mkdirSync(dirname(nach), { recursive: true });
      await w.copyFile(unter(wahl.bin, d.pfad), nach);
      bytes += d.bytes;
      e.fortschritt({ dateien: i + 1, dateienGesamt: wahl.dateien.length, bytes, bytesGesamt: wahl.bytesGesamt });
    }
    if (e.signal?.aborted) return abgebrochen();

    // (8) Nachprüfen: gleiche Zahl, gleiche Größen, peInfo der Kopie (wie bei der Wahl).
    const y = wahl.dateien.length;
    const x = wahl.dateien.filter(
      (d) => groesse(unter(teil, d.pfad)) === d.bytes && (d.pfad !== 'sdk.dll' || sdkDllPasst(join(teil, 'sdk.dll'), wahl.fassung)),
    ).length;
    if (x !== y || dateiListe(teil).length !== y) {
      rmSync(teil, { recursive: true, force: true });
      return { ok: false, text: KT.S7(x, y) };
    }

    // (9) Eigene Dateien dazu, Stempel schreiben.
    const eigeneDateien: Stempel['eigeneDateien'] = [];
    for (const q of eigeneQuellen(pfade.ressourcen)) {
      await w.copyFile(q.quelle, join(teil, q.pfad));
      eigeneDateien.push({ pfad: q.pfad, sha256: sha256(join(teil, q.pfad)) });
    }
    const stempel: Stempel = {
      format: 1,
      sdkFassung: wahl.fassung,
      eingerichtetAm: w.jetzt().toISOString(),
      sdkDateien: wahl.dateien,
      eigeneDateien,
    };
    schreibeStempel(teil, stempel);

    // (10) Tauschen: alt → .alt, .teil → Ziel. Scheitert der zweite Schritt, kommt alt zurück.
    rmSync(alt, { recursive: true, force: true });
    if (existsSync(ziel)) renameSync(ziel, alt);
    try {
      renameSync(teil, ziel);
    } catch (err) {
      if (existsSync(alt) && !existsSync(ziel)) renameSync(alt, ziel);
      throw err;
    }
    // Ab hier ist die neue Einrichtung in Kraft; Aufräumen darf sie nicht mehr kippen.
    try {
      rmSync(alt, { recursive: true, force: true });
      for (const g of readdirSync(pfade.basis, { withFileTypes: true })) {
        if (!g.isDirectory() || g.name === SDK_FASSUNG) continue;
        // Nur Ordner anderer Fassungen mit GÜLTIGEM Stempel: alles andere hat Connect nicht angelegt.
        if (leseStempel(join(pfade.basis, g.name)) !== null) rmSync(join(pfade.basis, g.name), { recursive: true, force: true });
      }
    } catch {
      // Reste stören nicht: pruefeLaufzeit liest nur den Ordner dieser Fassung.
    }
    return { ok: true, ordner: ziel, stempel };
  } catch (err) {
    rmSync(teil, { recursive: true, force: true });
    const x = err as { code?: unknown; message?: unknown };
    return { ok: false, text: KT.S6(typeof x.code === 'string' ? x.code : String(x.message ?? err)) };
  }
}
```

- [ ] **Step 4: Test laufen lassen (grün)**

```
npx tsx apps/connect/test/zoom-laufzeit.test.ts
```
Erwartet: keine Zeile mit `FAIL`, Exitcode 0, letzte Zeile `50 ok, 0 fehlgeschlagen.` (vorab gezählt). Unter anderem:
```
  ok  x64/bin erkannt, bin = x64/bin, Fassung 7.1.5.43953
  ok  VCRuntime140.dll im SDK → S4
  ok  Fortschritt nach jeder Datei: 1 … 8 von 8
  ok  Stempel byte-gleich
  ok  S5 mit gebraucht 101 MB, frei 0 MB
  ok  Geschwister 7.1.4.1 mit gültigem Stempel gelöscht
  ok  Datei 3 leer kopiert → S7 (8 von 9 Dateien)
  ok  <ziel>.teil gelöscht
  ok  vorher eingerichteter Ordner und Stempel unverändert
```

- [ ] **Step 5: `selftest` um die neue Testdatei verlängern** (`apps/connect/package.json`, Zeile 17)

Vorher:
```json
    "selftest": "tsx test/zoom-text.test.ts",
```
Nachher:
```json
    "selftest": "tsx test/zoom-text.test.ts && tsx test/zoom-laufzeit.test.ts",
```

- [ ] **Step 6: Selbsttest über npm und Typcheck**

```
npm run selftest -w @jm/connect
npm run typecheck -w @jm/connect
```
Erwartet: `selftest` läuft beide Dateien nacheinander; die erste endet mit `487 ok, 0 fehlgeschlagen.`, die zweite mit `50 ok, 0 fehlgeschlagen.`, Exitcode 0. `typecheck` ohne Fehlermeldung von `tsc`, Exitcode 0.

- [ ] **Step 7: Commit** (im Bash-Werkzeug / Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add apps/connect/src/main/zoom/laufzeit.ts apps/connect/test/zoom-laufzeit.test.ts apps/connect/package.json
git status --short
```
Erwartet genau:
```
M  apps/connect/package.json
A  apps/connect/src/main/zoom/laufzeit.ts
A  apps/connect/test/zoom-laufzeit.test.ts
```
Dann:
```
git commit -m "feat(connect): Zoom-Laufzeit-Ordner einrichten (Stage 4a)" -m "laufzeit.ts prueft den gewaehlten SDK-Ordner (Wurzel, x64 oder x64/bin; x86, Fassung, Kollision mit eigenen Dateinamen), kopiert Datei fuer Datei nach <ziel>.teil mit Fortschritt, prueft nach, legt VC-Laufzeit, Bridge und NDI-DLL dazu, schreibt den Stempel und tauscht ueber .alt. Fehler und Abbruch lassen die bisherige Einrichtung unveraendert (S6), Geschwister anderer Fassungen gehen nur mit gueltigem Stempel." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Gegenprobe — nach dem Commit, ohne neuen Commit**

Je Zeile den Vorher-Text in `apps/connect/src/main/zoom/laufzeit.ts` mit dem Edit-Werkzeug ersetzen, `npx tsx apps/connect/test/zoom-laufzeit.test.ts` laufen lassen (muss rot werden, Exitcode 1), dann zurück.
1. `.teil` bleibt bei einem Fehler liegen: im letzten `catch` die Zeile `    rmSync(teil, { recursive: true, force: true });` direkt nach `  } catch (err) {` entfernen. Erwartet `FAIL  .teil gelöscht`.
2. Geschwister ohne Stempelprüfung löschen: `if (leseStempel(join(pfade.basis, g.name)) !== null) rmSync(` → `rmSync(`. Erwartet `FAIL  Geschwister 7.0.0.1 ohne Stempel bleibt`.
3. Nachprüfung ohne `peInfo`: `(d.pfad !== 'sdk.dll' || sdkDllPasst(join(teil, 'sdk.dll'), wahl.fassung))` → `true`. Erwartet `FAIL  Kopie der sdk.dll mit anderer Fassung → S7 (8 von 9 Dateien)`.
4. Abbruch nur nach der Schleife (Review Focus 3): in der Schleife `      if (e.signal?.aborted) return abgebrochen();` entfernen. Erwartet `FAIL  nach Datei 3 keine weitere Datei kopiert`.

Danach:
```
git status --short
```
Erwartet: keine Ausgabe.

**Abweichungen vom Gerüst:**
- `richteEin` prüft das `AbortSignal` zusätzlich nach der letzten Datei. Ohne das liefe eine Einrichtung, deren Abbruch während der letzten Datei kam, noch bis zum Tausch durch.
- Nachprüfung der Kopie (Schritt 8): `sdk.dll` muss lesbar sein, darf nicht x86 sein und muss dieselbe Fassung tragen — dieselbe Regel wie bei der Wahl (Spec 6.1 Schritt 4 lehnt nur `0x014c` ab). Die harte x64-Prüfung macht `pruefeLaufzeit` (Aufgabe 8, Spec 5.3 Schritt 3).
- Nach dem Tausch sind das Löschen von `.alt` und der Geschwister Aufräumen: Ein Fehler dort macht eine schon gültige neue Einrichtung nicht nachträglich zu S6.
- Ein Fehler von `statfs` (Schritt 6) läuft wie ein Fehler in 7–10 auf S6 hinaus; die Spec nennt dafür keinen eigenen Text.
- `eigeneQuellen` liefert die Liste nach Dateinamen sortiert, damit der Stempel bei jeder Einrichtung gleich aussieht.
- Die Testhilfe `machePe` gibt einen `Buffer` zurück (Unterklasse von `Uint8Array`, passt zu `peInfo`).

---

### Task 8: Connect: Laufzeit prüfen, eigene Dateien, `kindPfad` (`laufzeit.ts`, Teil 2)

**Spec:** `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md` Abschnitte 5.2 (Aufruf `new Bridge`, `kindPfad`, `pfadVarianten`, Falle 3.2-4), 5.3 („Prüfung beim Programmstart …“ Schritte 1–4 und die Mängel darunter), 12.3 Nr. 5, 6 und 9, 12.2 Fall 4b, 12.5 („`kindPfad` liest nur `env.PATH` → Fall 4b“).

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\suite-sofort-fixes` (Branch `feat/zoom-stage4-connect`). Alle Pfade relativ dazu.

**Files:**
- Modify: `apps/connect/src/main/zoom/laufzeit.ts`
  - Zeile 11 (Import aus `node:fs`): `copyFileSync` dazu
  - Zeilen 275–277 (Ende von `richteEin`, Dateiende): `LaufzeitPruefung`, `pruefeLaufzeit`, `sdkDllIstX64`, `kindPfad`, `pfadVarianten` dahinter
- Test: `apps/connect/test/zoom-laufzeit.test.ts`
  - Zeilen 8–11 (Import aus `../src/main/zoom/laufzeit`)
  - Zeile 266 (Ankerzeile): neue Blöcke direkt darüber

Zeilenangaben gelten für den Stand nach Aufgabe 7. Maßgeblich ist der wortgleiche Vorher-Text.

**Interfaces:**
- Consumes:
  - Aufgabe 7 (modulintern in `laufzeit.ts`): `LaufzeitPfade`, `Stempel`, `STEMPEL_DATEI`, `BRIDGE_EXE`, `eigeneQuellen`, `laufzeitOrdner`, `leseStempel`, `schreibeStempel`, `groesse`, `unter`, `sha256`; im Test `richteEin` und die Hilfen `eingerichtet`, `baueRessourcen`, `machePe`, `sha`, `ordner`.
  - Aufgabe 1: `peInfo`, `SDK_FASSUNG` aus `@jm/zoom-bridge/sdk` (schon importiert).
- Produces (exakt so, Aufgaben 10, 11 und 16 bauen darauf):
  ```ts
  export type LaufzeitPruefung =
    | { ok: true; ordner: string; ersetzt: string[] }
    | { ok: false; mangel: 'sdk_fehlt' }
    | { ok: false; mangel: 'sdk_defekt'; datei: string }
    | { ok: false; mangel: 'bridge_fehlt' };
  export function pruefeLaufzeit(p: LaufzeitPfade): LaufzeitPruefung;   // synchron, wirft nie
  export function kindPfad(env: Record<string, string | undefined>, ordner: string): string;   // '<ordner>;<geerbt>' bzw. '<ordner>'
  export function pfadVarianten(env: Record<string, string | undefined>): string[];           // alle *path*-Schlüssel außer 'PATH'
  ```

**Regeln für diese Aufgabe:**
- `pruefeLaufzeit` läuft beim Programmstart, nach jeder Einrichtung und vor jedem Bridge-Start (Spec 5.3) — synchron und ohne Ausnahme nach außen: jeder Befund wird zu einem Rückgabewert.
- Fall 4b steht in dieser Testdatei, weil `kindPfad`/`pfadVarianten` in `laufzeit.ts` liegen (Gerüst L10); er läuft auch unter Linux.
- CRLF: Ersetzungen mit dem Edit-Werkzeug (G14). Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel, nie pushen.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`apps/connect/test/zoom-laufzeit.test.ts`)

Ersetzung 1 (Zeilen 8–11), Vorher:
```ts
import {
  BRIDGE_EXE, EIGENE_NAMEN_FEST, eigeneQuellen, laufzeitOrdner, NDI_DLL, PLATZ_RESERVE_BYTES, pruefeSdkOrdner, richteEin,
  STEMPEL_DATEI, type KopieStand, type LaufzeitPfade, type SdkWahl, type Stempel,
} from '../src/main/zoom/laufzeit';
```
Nachher:
```ts
import {
  BRIDGE_EXE, EIGENE_NAMEN_FEST, eigeneQuellen, kindPfad, laufzeitOrdner, NDI_DLL, pfadVarianten, PLATZ_RESERVE_BYTES,
  pruefeLaufzeit, pruefeSdkOrdner, richteEin, STEMPEL_DATEI, type KopieStand, type LaufzeitPfade, type SdkWahl, type Stempel,
} from '../src/main/zoom/laufzeit';
```

Ersetzung 2 (Zeile 266, die Ankerzeile), Vorher:
```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```
Nachher:
```ts
console.log('— 12.3 Nr. 9: Programmstart');
{
  const d = ordner('start');
  const leer: LaufzeitPfade = { basis: join(d, 'zoom-laufzeit'), ressourcen: baueRessourcen(join(d, 'res')) };
  ck('kein Laufzeit-Ordner → sdk_fehlt', JSON.stringify(pruefeLaufzeit(leer)) === JSON.stringify({ ok: false, mangel: 'sdk_fehlt' }));
  const { pfade, ziel } = await eingerichtet('start-ok');
  ck('alles in Ordnung → ok, nichts ersetzt', JSON.stringify(pruefeLaufzeit(pfade)) === JSON.stringify({ ok: true, ordner: ziel, ersetzt: [] }));
  rmSync(join(ziel, 'sdk.dll'));
  ck('Stempel da, sdk.dll gelöscht → sdk_defekt (nicht „Bereit“)',
    JSON.stringify(pruefeLaufzeit(pfade)) === JSON.stringify({ ok: false, mangel: 'sdk_defekt', datei: 'sdk.dll' }));
}

console.log('— 12.3 Nr. 5: Prüfung vor dem Start (Schritte 1–3)');
{
  const { pfade, ziel, dir } = await eingerichtet('pruefung');
  const quelle = (p: string): string => join(dir, 'sdk', 'x64', 'bin', ...p.split('/'));
  const defekt = (datei: string): string => JSON.stringify({ ok: false, mangel: 'sdk_defekt', datei });

  rmSync(join(ziel, 'zVideoApp.dll'));
  ck('fehlende SDK-Datei → sdk_defekt mit ihrem Pfad', JSON.stringify(pruefeLaufzeit(pfade)) === defekt('zVideoApp.dll'));
  writeFileSync(join(ziel, 'zVideoApp.dll'), Buffer.alloc(3));
  ck('SDK-Datei mit anderer Größe → sdk_defekt', JSON.stringify(pruefeLaufzeit(pfade)) === defekt('zVideoApp.dll'));
  copyFileSync(quelle('zVideoApp.dll'), join(ziel, 'zVideoApp.dll'));
  writeFileSync(join(ziel, 'zusatz.dat'), 'vom SDK selbst geschrieben');
  ck('zusätzliche Datei → in Ordnung', pruefeLaufzeit(pfade).ok === true);
  rmSync(join(ziel, 'language', 'de.txt'));
  ck('fehlende Datei im Unterordner → Pfad mit „/“', JSON.stringify(pruefeLaufzeit(pfade)) === defekt('language/de.txt'));
  copyFileSync(quelle('language/de.txt'), join(ziel, 'language', 'de.txt'));

  writeFileSync(join(ziel, 'sdk.dll'), machePe(X86, F_OK)); // gleiche Größe, aber 32 Bit
  ck('sdk.dll mit gleicher Größe, aber 32 Bit → sdk_defekt (sdk.dll)', JSON.stringify(pruefeLaufzeit(pfade)) === defekt('sdk.dll'));
  writeFileSync(join(ziel, 'sdk.dll'), machePe(X64, [7, 1, 5, 1]));
  ck('sdk.dll mit anderer Fassung → sdk_defekt (sdk.dll)', JSON.stringify(pruefeLaufzeit(pfade)) === defekt('sdk.dll'));
  writeFileSync(join(ziel, 'sdk.dll'), machePe(X64, F_OK));
  ck('sdk.dll wieder richtig → ok', pruefeLaufzeit(pfade).ok === true);

  const stempelPfad = join(ziel, STEMPEL_DATEI);
  const st = JSON.parse(readFileSync(stempelPfad, 'utf8')) as Stempel;
  writeFileSync(stempelPfad, JSON.stringify({ ...st, sdkFassung: '7.1.6.1' }));
  ck('Stempel mit sdkFassung 7.1.6.1 → sdk_defekt (Stempel)', JSON.stringify(pruefeLaufzeit(pfade)) === defekt(STEMPEL_DATEI));
  writeFileSync(stempelPfad, JSON.stringify({ ...st, format: 2 }));
  ck('Stempel mit format 2 → sdk_defekt (Stempel)', JSON.stringify(pruefeLaufzeit(pfade)) === defekt(STEMPEL_DATEI));
  writeFileSync(stempelPfad, '{ kein JSON');
  ck('Stempel unlesbar → sdk_defekt (Stempel)', JSON.stringify(pruefeLaufzeit(pfade)) === defekt(STEMPEL_DATEI));
  rmSync(stempelPfad);
  ck('Stempel fehlt → sdk_defekt (Stempel)', JSON.stringify(pruefeLaufzeit(pfade)) === defekt(STEMPEL_DATEI));
}

console.log('— 12.3 Nr. 6: eigene Dateien abgleichen (Schritt 4)');
{
  const { pfade, ziel } = await eingerichtet('eigene');
  const exeRes = join(pfade.ressourcen, 'zoom-bridge', BRIDGE_EXE);
  writeFileSync(exeRes, 'bridge-2');
  ck('geänderte zoom-bridge.exe → ersetzt', JSON.stringify(pruefeLaufzeit(pfade)) === JSON.stringify({ ok: true, ordner: ziel, ersetzt: [BRIDGE_EXE] }));
  ck('Inhalt im Laufzeit-Ordner neu', readFileSync(join(ziel, BRIDGE_EXE), 'utf8') === 'bridge-2');
  const st = JSON.parse(readFileSync(join(ziel, STEMPEL_DATEI), 'utf8')) as Stempel;
  ck('Stempel: SHA-256 der neuen EXE', st.eigeneDateien.find((x) => x.pfad === BRIDGE_EXE)?.sha256 === sha(exeRes));
  ck('Stempel: SDK-Teil unverändert', st.sdkFassung === '7.1.5.43953' && st.sdkDateien.length === 8);
  ck('zweiter Aufruf → nichts ersetzt', JSON.stringify(pruefeLaufzeit(pfade)) === JSON.stringify({ ok: true, ordner: ziel, ersetzt: [] }));
  rmSync(join(ziel, NDI_DLL));
  ck('fehlende NDI-DLL im Laufzeit-Ordner → wieder da',
    JSON.stringify(pruefeLaufzeit(pfade)) === JSON.stringify({ ok: true, ordner: ziel, ersetzt: [NDI_DLL] }) && existsSync(join(ziel, NDI_DLL)));
  writeFileSync(join(pfade.ressourcen, 'zoom-bridge', 'vcruntime140_1.dll'), 'vc1');
  const r = pruefeLaufzeit(pfade);
  ck('neue Ressource → kopiert und im Stempel',
    r.ok && JSON.stringify(r.ersetzt) === JSON.stringify(['vcruntime140_1.dll'])
    && (JSON.parse(readFileSync(join(ziel, STEMPEL_DATEI), 'utf8')) as Stempel).eigeneDateien.some((x) => x.pfad === 'vcruntime140_1.dll'));
  rmSync(exeRes);
  ck('Ressource zoom-bridge.exe fehlt → bridge_fehlt', JSON.stringify(pruefeLaufzeit(pfade)) === JSON.stringify({ ok: false, mangel: 'bridge_fehlt' }));
}

console.log('— 12.2 Fall 4b: kindPfad und pfadVarianten (Path-Falle 3.2-4, M6)');
{
  ck('kindPfad({ Path: C:\\A }, L) → L;C:\\A', kindPfad({ Path: 'C:\\A' }, 'L') === 'L;C:\\A');
  ck('kindPfad({ PATH: X }, L) → L;X', kindPfad({ PATH: 'X' }, 'L') === 'L;X');
  ck('kindPfad({}, L) → L', kindPfad({}, 'L') === 'L');
  ck('PATH geht vor Path', kindPfad({ Path: 'Y', PATH: 'X' }, 'L') === 'L;X');
  ck('leerer geerbter Wert → nur der Ordner', kindPfad({ PATH: '' }, 'L') === 'L');
  ck('pfadVarianten({ Path, PATH, path }) → [Path, path]', JSON.stringify(pfadVarianten({ Path: 'a', PATH: 'b', path: 'c' })) === JSON.stringify(['Path', 'path']));
  ck('pfadVarianten ohne andere Schreibweise → []', pfadVarianten({ PATH: 'b', HOME: 'h' }).length === 0);
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npx tsx apps/connect/test/zoom-laufzeit.test.ts
```
Erwartet: Abbruch beim Laden, Exitcode 1, mit
```
SyntaxError: The requested module '../src/main/zoom/laufzeit' does not provide an export named 'kindPfad'
```

- [ ] **Step 3: `copyFileSync` importieren** (`apps/connect/src/main/zoom/laufzeit.ts`, Zeile 11)

Vorher:
```ts
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
```
Nachher:
```ts
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
```

- [ ] **Step 4: `pruefeLaufzeit`, `kindPfad`, `pfadVarianten` anfügen** (`apps/connect/src/main/zoom/laufzeit.ts`, Zeilen 275–277, das Dateiende)

Vorher (eindeutig, das Ende von `richteEin`):
```ts
    return { ok: false, text: KT.S6(typeof x.code === 'string' ? x.code : String(x.message ?? err)) };
  }
}
```
Nachher:
```ts
    return { ok: false, text: KT.S6(typeof x.code === 'string' ? x.code : String(x.message ?? err)) };
  }
}

/** Ergebnis von pruefeLaufzeit (Spec 5.3). `ersetzt` = eigene Dateien, die gerade neu kopiert wurden. */
export type LaufzeitPruefung =
  | { ok: true; ordner: string; ersetzt: string[] }
  | { ok: false; mangel: 'sdk_fehlt' }
  | { ok: false; mangel: 'sdk_defekt'; datei: string }
  | { ok: false; mangel: 'bridge_fehlt' };

/**
 * Prüfung beim Programmstart, nach jeder Einrichtung und vor jedem Bridge-Start (Spec 5.3).
 * Synchron, wirft nie. Kein Ordner → sdk_fehlt. Schritt 1–3 → sdk_defekt (S9 mit `datei`).
 * Schritt 4: ohne <ressourcen>/zoom-bridge/zoom-bridge.exe → bridge_fehlt (S8); sonst jede eigene
 * Datei kopieren, die fehlt oder deren SHA-256 abweicht, und den Stempel nachziehen. So bringt ein
 * Connect-Update eine neue zoom-bridge.exe mit, ohne dass das SDK neu kopiert wird.
 */
export function pruefeLaufzeit(p: LaufzeitPfade): LaufzeitPruefung {
  const ordner = laufzeitOrdner(p);
  if (!existsSync(ordner)) return { ok: false, mangel: 'sdk_fehlt' };

  // (1) Stempel lesbar, format 1, genau diese SDK-Fassung.
  const stempel = leseStempel(ordner);
  if (stempel === null || stempel.sdkFassung !== SDK_FASSUNG) return { ok: false, mangel: 'sdk_defekt', datei: STEMPEL_DATEI };

  // (2) Jede SDK-Datei mit gleicher Größe. Zusätzliche Dateien stören nicht (schreibt das SDK selbst? ungemessen).
  for (const d of stempel.sdkDateien) {
    if (groesse(unter(ordner, d.pfad)) !== d.bytes) return { ok: false, mangel: 'sdk_defekt', datei: d.pfad };
  }

  // (3) sdk.dll: x64 und genau 7.1.5.43953.
  if (!sdkDllIstX64(join(ordner, 'sdk.dll'))) return { ok: false, mangel: 'sdk_defekt', datei: 'sdk.dll' };

  // (4) Eigene Dateien abgleichen.
  if (!existsSync(join(p.ressourcen, 'zoom-bridge', BRIDGE_EXE))) return { ok: false, mangel: 'bridge_fehlt' };
  const ersetzt: string[] = [];
  let datei = STEMPEL_DATEI;
  try {
    const eigeneDateien: Stempel['eigeneDateien'] = [];
    for (const q of eigeneQuellen(p.ressourcen)) {
      datei = q.pfad;
      const soll = sha256(q.quelle);
      const ziel = join(ordner, q.pfad);
      if (!existsSync(ziel) || sha256(ziel) !== soll) {
        copyFileSync(q.quelle, ziel);
        ersetzt.push(q.pfad);
      }
      eigeneDateien.push({ pfad: q.pfad, sha256: soll });
    }
    datei = STEMPEL_DATEI;
    if (JSON.stringify(eigeneDateien) !== JSON.stringify(stempel.eigeneDateien)) schreibeStempel(ordner, { ...stempel, eigeneDateien });
  } catch {
    // Eine eigene Datei ließ sich nicht ersetzen (etwa gesperrt): die Laufzeit ist unvollständig, S9 nennt die Datei.
    return { ok: false, mangel: 'sdk_defekt', datei };
  }
  return { ok: true, ordner, ersetzt };
}

/** Spec 5.3 Schritt 3: sdk.dll ist eine x64-PE-Datei mit genau SDK_FASSUNG. */
function sdkDllIstX64(datei: string): boolean {
  try {
    const i = peInfo(readFileSync(datei));
    return i.maschine === 'x64' && i.fassung === SDK_FASSUNG;
  } catch {
    return false;
  }
}

/**
 * PATH für den Kindprozess (Spec 5.2): Laufzeit-Ordner VOR dem vollständigen geerbten Wert.
 * Windows erbt den Schlüssel oft als „Path“, bridge.ts liest aber nur env.PATH (Falle 3.2-4).
 * Darum jede Schreibweise suchen, „PATH“ zuerst. Trenner fest „;“ (die Bridge gibt es nur unter Windows).
 */
export function kindPfad(env: Record<string, string | undefined>, ordner: string): string {
  const schluessel = Object.keys(env).filter((k) => k.toLowerCase() === 'path');
  const k = schluessel.includes('PATH') ? 'PATH' : schluessel[0];
  const wert = k === undefined ? undefined : env[k];
  return wert ? `${ordner};${wert}` : ordner;
}

/** Alle Schreibweisen von PATH außer „PATH“ selbst, für envRemove (Spec 5.2), in Einfügereihenfolge. */
export function pfadVarianten(env: Record<string, string | undefined>): string[] {
  return Object.keys(env).filter((k) => k !== 'PATH' && k.toLowerCase() === 'path');
}
```
Hinweis: In Schritt (4) wird je eigene Datei der SHA-256 der Quelle einmal gerechnet; der Stempel bekommt denselben Wert, denn nach dem Kopieren (oder ohne Abweichung) ist die Datei im Ordner byte-gleich. Der Stempel wird nur geschrieben, wenn sich `eigeneDateien` geändert hat.

- [ ] **Step 5: Test laufen lassen (grün)**

```
npx tsx apps/connect/test/zoom-laufzeit.test.ts
```
Erwartet: keine Zeile mit `FAIL`, Exitcode 0, letzte Zeile `79 ok, 0 fehlgeschlagen.` (50 aus Aufgabe 7 + 29 neu; vorab gezählt). Unter anderem:
```
  ok  kein Laufzeit-Ordner → sdk_fehlt
  ok  Stempel da, sdk.dll gelöscht → sdk_defekt (nicht „Bereit“)
  ok  fehlende Datei im Unterordner → Pfad mit „/“
  ok  sdk.dll mit gleicher Größe, aber 32 Bit → sdk_defekt (sdk.dll)
  ok  Stempel mit sdkFassung 7.1.6.1 → sdk_defekt (Stempel)
  ok  geänderte zoom-bridge.exe → ersetzt
  ok  zweiter Aufruf → nichts ersetzt
  ok  Ressource zoom-bridge.exe fehlt → bridge_fehlt
  ok  kindPfad({ Path: C:\A }, L) → L;C:\A
  ok  pfadVarianten({ Path, PATH, path }) → [Path, path]
```

- [ ] **Step 6: Selbsttest über npm und Typcheck**

```
npm run selftest -w @jm/connect
npm run typecheck -w @jm/connect
```
Erwartet: `selftest` endet mit `487 ok, 0 fehlgeschlagen.` und `79 ok, 0 fehlgeschlagen.`, Exitcode 0. `typecheck` ohne Fehlermeldung von `tsc`, Exitcode 0.

- [ ] **Step 7: Commit** (im Bash-Werkzeug / Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add apps/connect/src/main/zoom/laufzeit.ts apps/connect/test/zoom-laufzeit.test.ts
git status --short
```
Erwartet genau:
```
M  apps/connect/src/main/zoom/laufzeit.ts
M  apps/connect/test/zoom-laufzeit.test.ts
```
Dann:
```
git commit -m "feat(connect): Zoom-Laufzeit pruefen, eigene Dateien abgleichen, kindPfad (Stage 4a)" -m "pruefeLaufzeit (Spec 5.3) prueft Stempel, Groessen der SDK-Dateien und sdk.dll (x64, 7.1.5.43953) und meldet sdk_fehlt, sdk_defekt mit Datei oder bridge_fehlt. Eigene Dateien (Bridge, VC-Laufzeit, NDI) werden bei Abweichung des SHA-256 ersetzt und der Stempel nachgezogen. kindPfad setzt den Laufzeit-Ordner vor den vollstaendigen geerbten PATH, auch wenn Windows ihn als Path vererbt; pfadVarianten liefert die anderen Schreibweisen fuer envRemove." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Gegenprobe (Spec 12.5) — nach dem Commit, ohne neuen Commit**

Je Zeile den Vorher-Text in `apps/connect/src/main/zoom/laufzeit.ts` mit dem Edit-Werkzeug ersetzen, `npx tsx apps/connect/test/zoom-laufzeit.test.ts` laufen lassen (muss rot werden, Exitcode 1), dann zurück.
1. `kindPfad` liest nur `env.PATH` (Spec 12.5): `const k = schluessel.includes('PATH') ? 'PATH' : schluessel[0];` → `const k = 'PATH';`. Erwartet `FAIL  kindPfad({ Path: C:\A }, L) → L;C:\A`.
2. `PATH` ohne geerbten Wert (Spec 12.5): ``return wert ? `${ordner};${wert}` : ordner;`` → `return ordner;`. Erwartet u. a. `FAIL  kindPfad({ PATH: X }, L) → L;X`.
3. `sdk.dll` nicht auf x64 geprüft: `return i.maschine === 'x64' && i.fassung === SDK_FASSUNG;` → `return i.fassung === SDK_FASSUNG;`. Erwartet `FAIL  sdk.dll mit gleicher Größe, aber 32 Bit → sdk_defekt (sdk.dll)`.
4. Eigene Dateien nur bei Fehlen ersetzt: `if (!existsSync(ziel) || sha256(ziel) !== soll) {` → `if (!existsSync(ziel)) {`. Erwartet `FAIL  geänderte zoom-bridge.exe → ersetzt`.

Danach:
```
git status --short
```
Erwartet: keine Ausgabe.

**Abweichungen vom Gerüst:**
- Lässt sich eine eigene Datei in Schritt (4) nicht ersetzen oder der Stempel nicht schreiben (etwa weil die Datei gesperrt ist), liefert `pruefeLaufzeit` `{ ok: false, mangel: 'sdk_defekt', datei: <Dateiname> }` statt zu werfen. Die Spec nennt für diesen Fall keinen Mangel; S9 („… bitte den SDK-Ordner erneut wählen“) heilt ihn, weil eine neue Einrichtung alle eigenen Dateien frisch kopiert.
- Der Stempel wird nur neu geschrieben, wenn sich `eigeneDateien` geändert hat (sonst bliebe jede Prüfung ein Schreibzugriff).
- Schritt (3) liegt in der modulinternen Hilfe `sdkDllIstX64`.

---

### Task 9: Connect: Teilnehmer und Soll-Liste als reine Funktionen (`teilnehmer.ts`, `soll.ts`)

**Spec:** `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md` Abschnitt 4 (Begriffe „Normierter Name“, „Doppelname“, „Verwaiste Quelle“, „Offener Soll-Eintrag“), 5.4 (`ZoomParticipant`, `ZoomSollEintrag`, Absatz zu `kamera`), 6.3 (Ton-Schalter je Teilnehmer-ID, Abgleich-Tabelle mit allen neun Zeilen, „Treffer“, Kollision Gast ↔ Zoom), 3.2-12 (NDI-Name „JM Connect – Zoom <Anzeigename>“), 8.4 Q10.

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\suite-sofort-fixes` (Branch `feat/zoom-stage4-connect`). Alle Pfade relativ dazu.

**Files:**
- Create: `apps/connect/src/main/zoom/teilnehmer.ts`
- Create: `apps/connect/src/main/zoom/soll.ts`
- Create (Test): `apps/connect/test/zoom-teile.test.ts`
- Modify: `apps/connect/package.json` Zeile 17 (Skript `selftest`)

Zeilenangaben gelten für den Stand nach Aufgabe 8. Maßgeblich ist der wortgleiche Vorher-Text.

**Interfaces:**
- Consumes:
  - Aufgabe 5: Typen `ZoomParticipant`, `ZoomQuelle`, `ZoomSollEintrag` aus `../../shared/types`.
  - Aufgabe 6: `KT.Q10(ndiName: string): string` aus `./klartext`.
  - Bridge: Typen `Participant` (`{ id; name; persistentId; self; videoOn; hasCamera; inWaitingRoom; role }`, `protocol.ts:22-33`) und `UserRoleName` aus `@jm/zoom-bridge/protocol`.
- Produces (exakt so, Aufgaben 10, 12, 14 und 15 bauen darauf):
  ```ts
  // apps/connect/src/main/zoom/teilnehmer.ts
  export const NDI_PRAEFIX = 'JM Connect – Zoom ';   // Gedankenstrich U+2013
  export function normName(name: string): string;
  export function ndiVorschau(name: string): string;
  export function gleicherNdiName(a: string, b: string): boolean;
  export function kameraVon(p: Pick<Participant, 'videoOn' | 'hasCamera'>): 'an' | 'aus' | 'keine';
  export function baueTeilnehmer(e: {
    liste: readonly Participant[]; quellen: ReadonlyMap<number, ZoomQuelle>;
    tonVorwahl: ReadonlyMap<number, boolean>; zeilenFehler: ReadonlyMap<number, string>; gastLabels: readonly string[];
  }): ZoomParticipant[];
  export function zaehleQuellen(quellen: Iterable<ZoomQuelle>): { n: number; k: number };
  export function istVerwaist(aboId: number, teilnehmerIds: ReadonlySet<number>, bild: { state: string; reason: string } | undefined): boolean;

  // apps/connect/src/main/zoom/soll.ts
  export interface SollEintrag { name: string; ton: boolean; ndiName: string; aboId: number | null }
  export type SollListe = Map<string, SollEintrag>;   // Schlüssel: normName(name)
  export interface SollLage {
    teilnehmer: ReadonlyArray<{ id: number; name: string; imWarteraum: boolean }>;   // nur fremde, auch im Warteraum
    abos: ReadonlyMap<number, { verwaist: boolean }>;                               // Abos der AKTIVEN Bridge
  }
  export type SollHandlung =
    | { art: 'abonnieren'; schluessel: string; id: number; ton: boolean }
    | { art: 'neuLaden'; schluessel: string; altAboId: number; id: number; ton: boolean };
  export function sollAbbild(soll: SollListe, lage: SollLage): ZoomSollEintrag[];
  export function sollHandlungen(soll: SollListe, lage: SollLage): SollHandlung[];
  ```

**Regeln für diese Aufgabe:**
- Beide Dateien sind rein (kein `electron`, keine Zeitgeber, kein Zustand): Der Kern hält Soll-Liste, Quellen, Ton-Vorwahl und Zeilenfehler und ruft diese Funktionen bei jedem Abbild bzw. 300 ms nach einer Teilnehmeränderung (Aufgaben 12–15).
- „Treffer“ heißt: fremde Teilnehmer mit diesem normierten Namen, auch im Warteraum (Spec 6.3). Ein `aboId`, das in `lage.abos` fehlt, zählt als „kein Abo“ — eine neue Bridge kennt die Abos der alten nicht.
- Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel, nie pushen.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`apps/connect/test/zoom-teile.test.ts`, neu)

Jede der neun Zeilen der Abgleich-Tabelle 6.3 ist ein eigener Fall, geprüft für `sollAbbild` **und** `sollHandlungen`; dazu „aboId nicht mehr in `abos`“. Teilnehmer-IDs wie in der Attrappe (eigene Zeile 100, Fremde ab 16778240).
```ts
// Teilnehmerzeilen und Soll-Liste als reine Funktionen OHNE Electron (tsx): npm run selftest -w @jm/connect
// Spec 4 (Normierter Name, Doppelname, Verwaiste Quelle), 5.4 (ZoomParticipant), 6.3 (Abgleich-Tabelle, Kollision).
import type { Participant } from '@jm/zoom-bridge/protocol';
import type { ZoomQuelle } from '../src/shared/types';
import { KT } from '../src/main/zoom/klartext';
import { sollAbbild, sollHandlungen, type SollLage, type SollListe } from '../src/main/zoom/soll';
import {
  baueTeilnehmer, gleicherNdiName, istVerwaist, kameraVon, NDI_PRAEFIX, ndiVorschau, normName, zaehleQuellen,
} from '../src/main/zoom/teilnehmer';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

// ── Testhilfen ──
/** Teilnehmer wie im roster der Bridge; IDs wie in der Attrappe (eigene Zeile 100, Fremde ab 16778240). */
function p(id: number, name: string, extra: Partial<Participant> = {}): Participant {
  return { id, name, persistentId: '', self: false, videoOn: true, hasCamera: true, inWaitingRoom: false, role: 'attendee', ...extra };
}
function quelle(aboId: number, ndiName: string, bild: ZoomQuelle['bild'] = 'live'): ZoomQuelle {
  return { aboId, ndiName, bild, bildGrund: 'frames', ton: 'live', tonGrund: 'packets', fehler: null };
}
const LEER = { quellen: new Map<number, ZoomQuelle>(), tonVorwahl: new Map<number, boolean>(), zeilenFehler: new Map<number, string>(), gastLabels: [] as string[] };

console.log('— Normierter Name, NDI-Vorschau, Kamera');
ck('normName: NFC („Ana\\u0301“ = „Aná“)', normName('Aná') === normName('Aná'));
ck('normName: trim, Leerraum zu einem Leerzeichen', normName('  Anna \t  Maria ') === 'anna maria');
ck('normName: klein (de)', normName('ÄRGER') === 'ärger' && normName('Anna') === normName('anna'));
ck('ndiVorschau mit Gedankenstrich U+2013', ndiVorschau('Anna') === 'JM Connect – Zoom Anna' && NDI_PRAEFIX.charCodeAt(11) === 0x2013);
ck('gleicherNdiName ohne Groß-/Kleinschreibung', gleicherNdiName('JM Connect – zoom anna', 'JM Connect – Zoom Anna'));
ck('gleicherNdiName nach NFC', gleicherNdiName('JM Connect – Zoom Aná', 'JM Connect – Zoom Aná'));
ck('gleicherNdiName: anderer Name → nein', !gleicherNdiName('JM Connect – Zoom Anna', 'JM Connect – Zoom Anna (2)'));
ck('kameraVon: videoOn → an', kameraVon({ videoOn: true, hasCamera: true }) === 'an');
ck('kameraVon: hasCamera false → keine', kameraVon({ videoOn: false, hasCamera: false }) === 'keine');
ck('kameraVon: sonst → aus', kameraVon({ videoOn: false, hasCamera: true }) === 'aus');

console.log('— baueTeilnehmer (Spec 5.4, 6.3)');
{
  const liste: Participant[] = [
    p(100, 'JM Connect', { self: true, role: 'host' }),
    p(16778241, 'Zoe', { videoOn: false }),
    p(16778242, 'Ärger', { videoOn: false, hasCamera: false }),
    p(16778243, 'Ben', { role: 'coHost' }),
    p(16778240, 'Anna', { role: 'host' }),
    p(16778244, 'anna', { inWaitingRoom: true }),
  ];
  const zeilen = baueTeilnehmer({
    liste,
    quellen: new Map([[16778243, quelle(16778243, 'JM Connect – Zoom Ben (2)')]]),
    tonVorwahl: new Map([[16778240, false]]),
    zeilenFehler: new Map([[16778241, KT.Q8]]),
    gastLabels: ['JM Connect – zoom anna', 'JM Connect – Zoom Ben (2)'],
  });
  const z = (id: number) => zeilen.find((x) => x.id === id);
  ck('eigene Zeile (self) fehlt', zeilen.length === 5 && z(100) === undefined);
  ck('Reihenfolge: Host, Co-Host, dann nach Name (de)', JSON.stringify(zeilen.map((x) => x.name)) === JSON.stringify(['Anna', 'Ben', 'anna', 'Ärger', 'Zoe']));
  ck('„Anna“ und „anna“ (im Warteraum) sind beide Doppelname', z(16778240)?.doppelname === true && z(16778244)?.doppelname === true);
  ck('eindeutige Namen sind kein Doppelname', z(16778243)?.doppelname === false && z(16778241)?.doppelname === false);
  ck('Ton-Vorwahl je ID: Anna aus, „anna“ bleibt an (Fall 13)', z(16778240)?.tonVorwahl === false && z(16778244)?.tonVorwahl === true);
  ck('Vorgabe der Ton-Vorwahl: an', z(16778241)?.tonVorwahl === true);
  ck('Quelle hängt an der Zeile mit gleicher ID', z(16778243)?.quelle?.aboId === 16778243 && z(16778240)?.quelle === null);
  ck('NDI-Vorschau je Zeile', z(16778241)?.ndiNameVorschau === 'JM Connect – Zoom Zoe');
  ck('Kollision über die Vorschau: Anna trägt Q10 (Fall 23)', z(16778240)?.kollision === KT.Q10('JM Connect – Zoom Anna'));
  ck('Kollision auch für „anna“ im Warteraum', z(16778244)?.kollision === KT.Q10('JM Connect – Zoom anna'));
  ck('Kollision über den NDI-Namen der laufenden Quelle (Ben)', z(16778243)?.kollision === KT.Q10('JM Connect – Zoom Ben (2)'));
  ck('ohne passendes Label keine Kollision', z(16778241)?.kollision === null && z(16778242)?.kollision === null);
  ck('Zeilenfehler aus zeilenFehler (Q8)', z(16778241)?.fehler === KT.Q8 && z(16778240)?.fehler === null);
  ck('Kamera und Warteraum je Zeile', z(16778241)?.kamera === 'aus' && z(16778242)?.kamera === 'keine' && z(16778240)?.kamera === 'an' && z(16778244)?.imWarteraum === true);
  ck('Rolle wird durchgereicht', z(16778240)?.rolle === 'host' && z(16778243)?.rolle === 'coHost' && z(16778241)?.rolle === 'attendee');
  ck('leere Liste → keine Zeilen', baueTeilnehmer({ liste: [], ...LEER }).length === 0);
}

console.log('— zaehleQuellen und istVerwaist');
{
  const n3 = zaehleQuellen([quelle(1, 'a', 'subscribed'), quelle(2, 'b', 'live'), quelle(3, 'c', 'black')]);
  ck('n = alle, k = alle außer live', n3.n === 3 && n3.k === 2);
  ck('keine Quellen → 0/0', JSON.stringify(zaehleQuellen([])) === JSON.stringify({ n: 0, k: 0 }));
  const ids = new Set([16778240]);
  ck('Teilnehmer nicht mehr in der Liste → verwaist (black steht noch aus)', istVerwaist(16778241, ids, undefined));
  ck('black/participantLeft → verwaist', istVerwaist(16778240, ids, { state: 'black', reason: 'participantLeft' }));
  ck('black/cameraOff → nicht verwaist', !istVerwaist(16778240, ids, { state: 'black', reason: 'cameraOff' }));
  ck('Teilnehmer da, live → nicht verwaist', !istVerwaist(16778240, ids, { state: 'live', reason: 'frames' }));
  ck('Teilnehmer da, noch kein Bild-Ereignis → nicht verwaist', !istVerwaist(16778240, ids, undefined));
}

console.log('— Abgleich der Soll-Liste: die neun Zeilen der Tabelle 6.3');
{
  const ANNA = 'anna';
  /** Soll-Liste mit genau einem Eintrag „Anna“ (Ton aus, damit „Ton des Soll-Eintrags“ prüfbar ist). */
  const soll = (aboId: number | null): SollListe => new Map([[ANNA, { name: 'Anna', ton: false, ndiName: 'JM Connect – Zoom Anna', aboId }]]);
  const t = (id: number, name: string, imWarteraum = false) => ({ id, name, imWarteraum });
  const fall = (titel: string, aboId: number | null, lage: SollLage, stand: string | null, doppelname: boolean, handlung: unknown[]) => {
    const abb = sollAbbild(soll(aboId), lage);
    const erwartet = stand === null ? [] : [{
      name: 'Anna', ton: false, ndiName: 'JM Connect – Zoom Anna', stand, aboId: stand === 'verwaist' ? aboId : null, doppelname,
    }];
    ck(`${titel}: Stand`, JSON.stringify(abb) === JSON.stringify(erwartet));
    ck(`${titel}: Handlung`, JSON.stringify(sollHandlungen(soll(aboId), lage)) === JSON.stringify(handlung));
  };
  const abo = (id: number, verwaist: boolean) => new Map([[id, { verwaist }]]);

  fall('1 Abo verbunden', 16778240, { teilnehmer: [t(16778240, 'Anna')], abos: abo(16778240, false) }, null, false, []);
  fall('2 verwaist, 0 Treffer', 16778240, { teilnehmer: [t(16778241, 'Ben')], abos: abo(16778240, true) }, 'verwaist', false, []);
  fall('3 verwaist, genau 1 Treffer (anna) → neu laden', 16778240, { teilnehmer: [t(16778250, 'anna')], abos: abo(16778240, true) }, 'verwaist', false,
    [{ art: 'neuLaden', schluessel: ANNA, altAboId: 16778240, id: 16778250, ton: false }]);
  fall('4 verwaist, 1 Treffer im Warteraum', 16778240, { teilnehmer: [t(16778250, 'Anna', true)], abos: abo(16778240, true) }, 'verwaist', false, []);
  fall('5 verwaist, 2 Treffer → rot mit Q11', 16778240, { teilnehmer: [t(16778250, 'Anna'), t(16778251, 'ANNA ')], abos: abo(16778240, true) }, 'verwaist', true, []);
  fall('6 kein Abo, genau 1 Treffer → abonnieren', null, { teilnehmer: [t(16778240, 'Anna')], abos: new Map() }, 'wartet', false,
    [{ art: 'abonnieren', schluessel: ANNA, id: 16778240, ton: false }]);
  fall('7 kein Abo, 1 Treffer im Warteraum', null, { teilnehmer: [t(16778240, 'Anna', true)], abos: new Map() }, 'wartet', false, []);
  fall('8 kein Abo, 0 Treffer', null, { teilnehmer: [t(16778241, 'Ben')], abos: new Map() }, 'wartet', false, []);
  fall('9 kein Abo, 2 Treffer → nichts, doppelname', null, { teilnehmer: [t(16778240, 'Anna'), t(16778241, 'anna')], abos: new Map() }, 'doppelname', true, []);
  fall('aboId nicht mehr in abos (neue Bridge) → wie „kein Abo“', 16778240, { teilnehmer: [t(16778260, 'Anna')], abos: new Map() }, 'wartet', false,
    [{ art: 'abonnieren', schluessel: ANNA, id: 16778260, ton: false }]);

  // Mehrere Einträge: nur die offenen stehen im Abbild, Reihenfolge der Soll-Liste.
  const mehr: SollListe = new Map([
    ['anna', { name: 'Anna', ton: true, ndiName: 'JM Connect – Zoom Anna', aboId: 16778240 }],
    ['ben', { name: 'Ben', ton: true, ndiName: 'JM Connect – Zoom Ben', aboId: null }],
  ]);
  const lage: SollLage = { teilnehmer: [t(16778240, 'Anna')], abos: abo(16778240, false) };
  ck('nur offene Einträge im Abbild', JSON.stringify(sollAbbild(mehr, lage).map((x) => [x.name, x.stand])) === JSON.stringify([['Ben', 'wartet']]));
  ck('leere Soll-Liste → nichts', sollAbbild(new Map(), lage).length === 0 && sollHandlungen(new Map(), lage).length === 0);
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npx tsx apps/connect/test/zoom-teile.test.ts
```
Erwartet: Abbruch beim Laden, Exitcode 1, mit
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\connect\src\main\zoom\soll' imported from …\apps\connect\test\zoom-teile.test.ts
```

- [ ] **Step 3: `src/main/zoom/teilnehmer.ts` schreiben** (neu)

```ts
// Teilnehmerzeilen der Zoom-Karte als reine Funktionen (Spec 4, 5.4, 6.3). Ohne Electron (G8).
// Der Kern (kern.ts) ruft baueTeilnehmer bei JEDEM Abbild neu auf; so stimmen Doppelname,
// Kollision und Zeilenfehler immer mit der aktuellen Teilnehmerliste überein.
import type { Participant, UserRoleName } from '@jm/zoom-bridge/protocol';
import type { ZoomParticipant, ZoomQuelle } from '../../shared/types';
import { KT } from './klartext';

/** So beginnt der NDI-Name jeder Zoom-Quelle (native/video.cpp:188-201), Gedankenstrich U+2013. */
export const NDI_PRAEFIX = 'JM Connect – Zoom ';

/** Normierter Name (Spec 4): Unicode-NFC, trim, Leerraum zu einem Leerzeichen, klein (de). */
export function normName(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de');
}

/** NDI-Name, den die Bridge für diese Person vergeben wird, solange noch keine Quelle läuft. */
export function ndiVorschau(name: string): string {
  return NDI_PRAEFIX + name;
}

/** Gleicher NDI-Name im Sinne der Kollisionsprüfung (Spec 6.3): nach NFC, ohne Groß-/Kleinschreibung. */
export function gleicherNdiName(a: string, b: string): boolean {
  return a.normalize('NFC').toLocaleLowerCase('de') === b.normalize('NFC').toLocaleLowerCase('de');
}

/** Spec 5.4: videoOn → 'an', sonst hasCamera === false → 'keine', sonst 'aus'. */
export function kameraVon(p: Pick<Participant, 'videoOn' | 'hasCamera'>): 'an' | 'aus' | 'keine' {
  if (p.videoOn) return 'an';
  if (p.hasCamera === false) return 'keine';
  return 'aus';
}

/** Host zuerst, dann Co-Host, dann alle übrigen (Spec 5.4 `teilnehmer`). */
function rang(r: UserRoleName): number {
  return r === 'host' ? 0 : r === 'coHost' ? 1 : 2;
}

/**
 * Teilnehmerzeilen für das Abbild: ohne die eigene Zeile der Bridge, Host und Co-Host zuerst, dann
 * nach Name (de). `doppelname` zählt alle fremden Teilnehmer mit gleichem normierten Namen, auch
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
    const ndiName = quelle?.ndiName ?? ndiNameVorschau;
    return {
      id: p.id,
      name: p.name,
      rolle: p.role,
      kamera: kameraVon(p),
      imWarteraum: p.inWaitingRoom,
      doppelname: (anzahl.get(normName(p.name)) ?? 0) >= 2,
      tonVorwahl: e.tonVorwahl.get(p.id) ?? true,
      quelle,
      ndiNameVorschau,
      kollision: e.gastLabels.some((l) => gleicherNdiName(l, ndiName)) ? KT.Q10(ndiName) : null,
      fehler: e.zeilenFehler.get(p.id) ?? null,
    };
  });
  return zeilen.sort((a, b) => rang(a.rolle) - rang(b.rolle) || a.name.localeCompare(b.name, 'de'));
}

/** n = alle Quellen (NDI-Sender existiert), k = davon nicht 'live' (Spec 5.4 `quellen`/`ohneBild`). */
export function zaehleQuellen(quellen: Iterable<ZoomQuelle>): { n: number; k: number } {
  let n = 0;
  let k = 0;
  for (const q of quellen) {
    n++;
    if (q.bild !== 'live') k++;
  }
  return { n, k };
}

/**
 * Verwaiste Quelle (Spec 4): ihr Teilnehmer steht nicht mehr in der Liste — auch wenn das
 * black-Ereignis noch aussteht — oder ihr Bild meldet black mit Grund participantLeft.
 */
export function istVerwaist(aboId: number, teilnehmerIds: ReadonlySet<number>, bild: { state: string; reason: string } | undefined): boolean {
  if (!teilnehmerIds.has(aboId)) return true;
  return bild?.state === 'black' && bild.reason === 'participantLeft';
}
```

- [ ] **Step 4: `src/main/zoom/soll.ts` schreiben** (neu)

Stand je Zeile der Tabelle 6.3: verbunden → nicht im Abbild; verwaist (0, 1 im Warteraum, 1 außerhalb, ≥ 2 Treffer) → `verwaist`, bei ≥ 2 mit `doppelname: true` (Karte: rot mit Q11); kein Abo und ≥ 2 Treffer → `doppelname`; kein Abo sonst → `wartet`. Handlungen nur bei genau einem Treffer außerhalb des Warteraums: kein Abo → `abonnieren`, verwaist → `neuLaden`, beide mit dem Ton des Soll-Eintrags.
```ts
// Soll-Liste der Zoom-Quellen als reine Funktionen (Spec 6.3, Abgleich-Tabelle). Ohne Electron (G8).
// Die Soll-Liste merkt sich die Quellen, die der Bediener geladen hat, über den normierten Namen.
// Der Kern hält sie und ruft diese Funktionen: sollAbbild bei jedem Abbild (Stand, sollOffen),
// sollHandlungen nur im Zustand im_meeting mit Erlaubnis 'ja', 300 ms nach einer Teilnehmeränderung.
import type { ZoomSollEintrag } from '../../shared/types';
import { normName } from './teilnehmer';

/** Ein Eintrag der Soll-Liste. `aboId` = Teilnehmer-ID des letzten Abos (gilt nur in dessen Sitzung). */
export interface SollEintrag {
  name: string;
  ton: boolean;
  ndiName: string;
  aboId: number | null;
}

/** Schlüssel: normName(name). */
export type SollListe = Map<string, SollEintrag>;

/** Was der Kern über das Meeting weiß, wenn er abgleicht. */
export interface SollLage {
  /** Nur fremde Teilnehmer (ohne die eigene Zeile der Bridge), auch die im Warteraum. */
  teilnehmer: ReadonlyArray<{ id: number; name: string; imWarteraum: boolean }>;
  /** Abos der AKTIVEN Bridge; `verwaist` nach istVerwaist (teilnehmer.ts). */
  abos: ReadonlyMap<number, { verwaist: boolean }>;
}

export type SollHandlung =
  | { art: 'abonnieren'; schluessel: string; id: number; ton: boolean }
  | { art: 'neuLaden'; schluessel: string; altAboId: number; id: number; ton: boolean };

interface Bewertung {
  schluessel: string;
  eintrag: SollEintrag;
  /** Fremde Teilnehmer mit diesem normierten Namen, auch im Warteraum. */
  treffer: ReadonlyArray<{ id: number; name: string; imWarteraum: boolean }>;
  /** 'keins' auch, wenn aboId in lage.abos fehlt: eine neue Bridge kennt die alten Abos nicht. */
  abo: 'verbunden' | 'verwaist' | 'keins';
}

function bewerte(soll: SollListe, lage: SollLage): Bewertung[] {
  return [...soll].map(([schluessel, eintrag]) => {
    const treffer = lage.teilnehmer.filter((t) => normName(t.name) === schluessel);
    const a = eintrag.aboId === null ? undefined : lage.abos.get(eintrag.aboId);
    const abo = a === undefined ? 'keins' : a.verwaist ? 'verwaist' : 'verbunden';
    return { schluessel, eintrag, treffer, abo };
  });
}

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
    aus.push({
      name: b.eintrag.name,
      ton: b.eintrag.ton,
      ndiName: b.eintrag.ndiName,
      stand,
      aboId: stand === 'verwaist' ? b.eintrag.aboId : null,
      doppelname,
    });
  }
  return aus;
}

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

- [ ] **Step 5: Test laufen lassen (grün)**

```
npx tsx apps/connect/test/zoom-teile.test.ts
```
Erwartet: keine Zeile mit `FAIL`, Exitcode 0, letzte Zeile `55 ok, 0 fehlgeschlagen.` (vorab gezählt). Unter anderem:
```
  ok  Reihenfolge: Host, Co-Host, dann nach Name (de)
  ok  „Anna“ und „anna“ (im Warteraum) sind beide Doppelname
  ok  Ton-Vorwahl je ID: Anna aus, „anna“ bleibt an (Fall 13)
  ok  Kollision über die Vorschau: Anna trägt Q10 (Fall 23)
  ok  3 verwaist, genau 1 Treffer (anna) → neu laden: Handlung
  ok  9 kein Abo, 2 Treffer → nichts, doppelname: Stand
  ok  aboId nicht mehr in abos (neue Bridge) → wie „kein Abo“: Handlung
```

- [ ] **Step 6: `selftest` verlängern** (`apps/connect/package.json`, Zeile 17)

Vorher:
```json
    "selftest": "tsx test/zoom-text.test.ts && tsx test/zoom-laufzeit.test.ts",
```
Nachher:
```json
    "selftest": "tsx test/zoom-text.test.ts && tsx test/zoom-laufzeit.test.ts && tsx test/zoom-teile.test.ts",
```

- [ ] **Step 7: Selbsttest über npm und Typcheck**

```
npm run selftest -w @jm/connect
npm run typecheck -w @jm/connect
```
Erwartet: `selftest` läuft drei Dateien; sie enden mit `487 ok, 0 fehlgeschlagen.`, `79 ok, 0 fehlgeschlagen.` und `55 ok, 0 fehlgeschlagen.`, Exitcode 0. `typecheck` ohne Fehlermeldung von `tsc`, Exitcode 0.

- [ ] **Step 8: Commit** (im Bash-Werkzeug / Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add apps/connect/src/main/zoom/teilnehmer.ts apps/connect/src/main/zoom/soll.ts apps/connect/test/zoom-teile.test.ts apps/connect/package.json
git status --short
```
Erwartet genau:
```
M  apps/connect/package.json
A  apps/connect/src/main/zoom/soll.ts
A  apps/connect/src/main/zoom/teilnehmer.ts
A  apps/connect/test/zoom-teile.test.ts
```
Dann:
```
git commit -m "feat(connect): Zoom-Teilnehmerzeilen und Soll-Liste als reine Funktionen (Stage 4a)" -m "teilnehmer.ts baut die Zeilen der Zoom-Karte (ohne eigene Zeile, Host und Co-Host zuerst, Doppelname ueber den normierten Namen auch im Warteraum, Ton-Vorwahl je Teilnehmer-ID, Kollision mit Browser-Gaesten als Q10, Zeilenfehler) und zaehlt Quellen. soll.ts setzt die Abgleich-Tabelle aus Spec 6.3 um: Stand jedes offenen Soll-Eintrags und die Handlungen abonnieren bzw. neu laden nur bei genau einem Treffer ausserhalb des Warteraums." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Gegenprobe (Spec 12.5, Grundlage für Fall 13 und 15) — nach dem Commit, ohne neuen Commit**

Je Zeile den Vorher-Text mit dem Edit-Werkzeug ersetzen, `npx tsx apps/connect/test/zoom-teile.test.ts` laufen lassen (muss rot werden, Exitcode 1), dann zurück.
1. Doppelname wird automatisch abonniert (`soll.ts`): `if (b.abo === 'verbunden' || b.treffer.length !== 1 || b.treffer[0].imWarteraum) continue;` → `if (b.abo === 'verbunden' || b.treffer.length === 0 || b.treffer[0].imWarteraum) continue;`. Erwartet `FAIL  9 kein Abo, 2 Treffer → nichts, doppelname: Handlung`.
2. Verwaiste Quelle bei genau einem Treffer nicht neu geladen (`soll.ts`): `if (b.abo === 'verwaist' && b.eintrag.aboId !== null) {` → `if (b.abo === 'verwaist' && b.eintrag.aboId !== null) { continue;`. Erwartet `FAIL  3 verwaist, genau 1 Treffer (anna) → neu laden: Handlung`.
3. Doppelname ohne den Warteraum gezählt (`teilnehmer.ts`): `for (const p of fremde) anzahl.set(` → `for (const p of fremde.filter((x) => !x.inWaitingRoom)) anzahl.set(`. Erwartet `FAIL  „Anna“ und „anna“ (im Warteraum) sind beide Doppelname`.
4. Verwaist nur über `black` (`teilnehmer.ts`): die Zeile `  if (!teilnehmerIds.has(aboId)) return true;` entfernen. Erwartet `FAIL  Teilnehmer nicht mehr in der Liste → verwaist (black steht noch aus)`.

Danach:
```
git status --short
```
Erwartet: keine Ausgabe.

**Abweichungen vom Gerüst:**
- Stand für „kein Abo, genau ein Treffer außerhalb des Warteraums“: Die Tabelle 6.3 sagt dort „danach verbunden“. Bis das Abo steht (300 ms Abgleich, dann `videoSubscribe`), ist der Eintrag offen; `sollAbbild` meldet ihn als `wartet` — der einzige Stand der Tabelle, der für einen offenen Eintrag ohne Abo und ohne Doppelnamen passt.
- Ebenso bleibt ein verwaister Eintrag mit genau einem Treffer bis zum Neu-Laden `verwaist`.
- `sollHandlungen` liefert `neuLaden` nur, wenn `aboId` gesetzt ist (Typ-Absicherung; „verwaist“ setzt ein Abo voraus).
- `baueTeilnehmer` sortiert stabil: bei gleichem Rang und gleichem Namen bleibt die Reihenfolge der Liste.

---

### Task 10: Kern: Gerüst, Einrichtung, Mängel, Sperre, Abbild-Drossel (`kern.ts`)

**Spec:** 5.2 (feste Werte), 5.3 (Mängel), 5.4 (Typen), 5.6, 6.1 (Sperre S10, „SDK-Ordner wählen“ Schritte 1–11, „Zugangsdaten wählen“, „Entfernen“), 6.1 Absatz unter Schritt 11 und 6.6 (Kopie abbrechen beim Beenden, `.teil` gelöscht), 6.7 (Versatz speichern), 6.8 („Schließen“, „Meldung quittieren“), 7.5 (über `stateKvAus`); Review Focus 3 und 4. Global Constraints G3, G4, G5, G8, G10, G13, G14, G15.

**Files:**
- Create: `apps/connect/src/main/zoom/kern.ts` (416 Zeilen)
- Create: `apps/connect/test/zoom-kern.test.ts` (560 Zeilen; Testgerüst für die Aufgaben 10–15)
- Modify: `apps/connect/package.json` — Skript `selftest` (Stand nach Aufgabe 9)

**Interfaces:**
- Consumes:
  - Aufgabe 1 (`@jm/zoom-bridge/sdk`): `export const SDK_FASSUNG = '7.1.5.43953';`
  - Bestand (`@jm/zoom-bridge`, `src/jwt.ts`, von keiner Aufgabe geändert): `readCredentials(env?: NodeJS.ProcessEnv): { clientId: string; clientSecret: string }` — wirft `Error` mit „kein gueltiges JSON“ (Parse-Fehler, Inhalt wird nicht zitiert), „Zugangsdaten fehlen“ (Felder fehlen) oder den Lesefehler mit `code` (z. B. `ENOENT`); `type Bridge`, `type BridgeOptions`. Der Test nutzt zusätzlich `Bridge`, `type BridgeEvent`, `type Command`.
  - Aufgabe 3 (`packages/zoom-bridge/test/fake-bridge.mjs`, Drehbuch `steuerung`): `FAKE_SDK_FASSUNG` bestimmt `ready.sdkVersion`, `FAKE_LOGDATEI` schreibt jede empfangene Befehlszeile als JSON-Zeile in die Datei.
  - Aufgabe 5 (`apps/connect/src/shared/types.ts`): `ProxyKeySource`, `ZoomZustand`, `ZoomMangel`, `ZoomErlaubnis`, `ZoomQuelle`, `ZoomKurz`, `ZoomAbbild`, `ZoomErgebnis` (Spec 5.4 wörtlich, dazu `ZoomSollEintrag.doppelname: boolean` und `ZoomParticipant.fehler: string | null`). (`apps/connect/src/shared/zoom-text.ts`): `export function stateKvAus(k: ZoomKurz): ZoomStateKv | null;`, `export interface ZoomStateKv { zoom_status; zoom_sources; zoom_live; zoom_privilege; zoom_alarm }`; im Test `export function kartenZeile(a: ZoomAbbild, jetztMs: number): string | null;` und `export function zoomZ(k: ZoomKurz): ZoomZ;`.
  - Aufgabe 6 (`apps/connect/src/main/zoom/klartext.ts`): `KT` (hier `S1`, `S6(grund)`, `S8`, `S9(datei)`, `S10`, `A1`, `A2`, `A3(code)`, `A4`, `A5`, `A6`, `Q13`), `export function mangelText(m: ZoomMangel, datei: string | null): string;`.
  - Aufgaben 7/8 (`apps/connect/src/main/zoom/laufzeit.ts`): `LaufzeitPfade { basis; ressourcen }`, `LaufzeitPruefung` (`{ ok: true; ordner; ersetzt }` | `{ ok: false; mangel: 'sdk_fehlt' }` | `{ ok: false; mangel: 'sdk_defekt'; datei }` | `{ ok: false; mangel: 'bridge_fehlt' }`), `SdkWahl`, `EinrichtungsErgebnis` (`{ ok: true; ordner; stempel; aufraeumFehler: string | null }` | `{ ok: false; text }`), `KopieStand`, `pruefeLaufzeit(p: LaufzeitPfade): LaufzeitPruefung`, `pruefeSdkOrdner(gewaehlt: string, ressourcen: string): SdkWahl`, `richteEin(e: { wahl; pfade; fortschritt: (k: KopieStand) => void; signal?: AbortSignal; werkzeuge?: Partial<LaufzeitWerkzeuge> }): Promise<EinrichtungsErgebnis>`; im Test zusätzlich `laufzeitOrdner(p: LaufzeitPfade): string` und `STEMPEL_DATEI = 'jm-zoom-laufzeit.json'` (Review Focus 3 mit dem echten `richteEin`).
  - Aufgabe 9: `export function zaehleQuellen(quellen: Iterable<ZoomQuelle>): { n: number; k: number };` (`teilnehmer.ts`), `export type SollListe = Map<string, SollEintrag>;` (`soll.ts`).
- Produces (verbindlich für die Aufgaben 11–16; der vollständige Code steht in Step 3):
  ```ts
  // apps/connect/src/main/zoom/kern.ts
  export const ZOOM_FRISTEN = { anmeldeMs: 30_000, joinTimeoutMs: 30_000, killTimeoutMs: 12_000, abgleichMs: 300, aboAntwortMs: 10_000, abbildTaktMs: 100, unsubscribeWarteMs: 2_000 } as const;
  export type ZoomFristen = { [K in keyof typeof ZOOM_FRISTEN]: number };
  export const BEENDEN_FRIST_MS = 15_000; export const JWT_GUELTIG_S = 43_200; export const BETRIEBSGROESSE = 5;
  export const AUFLOESUNG = '720p' as const; export const HINWEISE_MAX = 5; export const ANZEIGENAME_VORGABE = 'JM Connect';
  export type BridgeArt = Pick<Bridge, 'start' | 'send' | 'stop' | 'session'>;
  export type BridgeFabrik = (opts: BridgeOptions, startNr: number) => BridgeArt;
  export interface ZugangDaten { clientId: string; clientSecret: string }
  export interface ZugangStand { daten: ZugangDaten | null; herkunft: ProxyKeySource; unlesbar: boolean }
  export interface LaufzeitDienste { pruefe(p: LaufzeitPfade): LaufzeitPruefung; pruefeOrdner(gewaehlt: string, ressourcen: string): SdkWahl; richteEin(e: Parameters<typeof richteEin>[0]): Promise<EinrichtungsErgebnis> }
  export interface ZoomKernAbhaengigkeiten {
    pfade: LaufzeitPfade;
    zugang: { lesen(): ZugangStand; speichern(d: ZugangDaten): 'stored' | 'session'; loeschen(): void };
    einstellungen: { anzeigename(): string; setzeAnzeigename(n: string): void; versatzMs(): number; setzeVersatzMs(ms: number): void; setzeLaufzeit(v: { dir: string; fassung: string; eingerichtetAm: string }): void };
    gastLabels(): string[];
    log(zeile: string): void;            // fertige Zeile mit Präfix, schon maskiert
    onAbbild(a: ZoomAbbild): void;       // gedrosselt
    onKurz?(k: ZoomKurz): void;          // sofort
    bridgeFabrik?: BridgeFabrik;         // Vorgabe (o) => new Bridge(o)
    laufzeit?: Partial<LaufzeitDienste>; // Vorgabe: echte Funktionen aus laufzeit.ts
    env?: Record<string, string | undefined>; // Vorgabe process.env
    fristen?: Partial<ZoomFristen>;
  }
  export interface ZoomKern {
    abbild(): ZoomAbbild; kurz(): ZoomKurz; stateKv(): ZoomStateKv | null; laeuft(): boolean;
    einrichtungSperre(): ZoomErgebnis; sdkWaehlen(ordner: string): Promise<ZoomErgebnis>;
    zugangWaehlen(datei: string): ZoomErgebnis; zugangLoeschen(): ZoomErgebnis; versatz(e: { ms: number }): ZoomErgebnis;
    schliessen(): void; meldungWeg(): void; gastLabelsGeaendert(): void; beenden(fristMs: number): Promise<void>;
  }
  export function erzeugeZoomKern(d: ZoomKernAbhaengigkeiten): ZoomKern;
  ```
  Innerhalb von `erzeugeZoomKern` (Closure, für 11–15 verbindlich): Zustand `zustand`, `warten`, `erlaubnis`, `maengel`, `laufzeitStand`, `zugang`, `zugangFehler`, `sdkFehler`, `kopie`, `kopieAbbruch`, `kopieLauf: Promise<EinrichtungsErgebnis> | null` (das laufende `richteEin`), `pruefungLaeuft`, `meldung`, `hinweise`, `nummer: { eingabe; normiert } | null`, `kenncode`, `warImMeeting`, `soll: SollListe`, `quellen: Map<number, QuelleIntern>` (`QuelleIntern = ZoomQuelle & { gen }`), `beendenVersprechen`; Funktionen `kurz()`, `abbild()`, `abbildGeaendert()`, `setzeZustand(z)`, `bestimmeMaengel(neu?)`, `mangelDatei()`, `einrichtungSperre()`, `schliessen()`, `mitFrist(p: Promise<unknown>, ms: number): Promise<boolean>` (wartet höchstens `ms` auf `p`, eine Ablehnung zählt als Ende; `true` = rechtzeitig); Modul-Hilfe `zeitgeber(ms, fn)` (`setTimeout` mit `unref`). Ankerzeile für spätere Abschnitte: `  // ── Beenden (Spec 6.6) ───…`.

  Testgerüst `apps/connect/test/zoom-kern.test.ts` (verbindlich für 11–15): `FAKE`, `NUMMER = '7'.repeat(10)`, `KENNCODE = 'KENNCODE-PROBE-71'`, `ck`, `ueberspringe`, `warte`, `bis(pred, ms = 4000)`, `interface Probe` und `baueKern(o?: BaueOptionen): Probe` wie im Gerüst, dazu `Probe.ordner` (Laufzeit-Ordner der `pruefe`-Vorgabe), `Probe.pfade` (die `LaufzeitPfade` des Kerns, für das echte `richteEin`) und die Hilfen `cmds(p, startNr?)`, `folge(p)`, `ok(r)`, `text(r)`; Ankerzeile `// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──`, Schlusszeile `${pass} ok, ${fail} fehlgeschlagen, ${skip} übersprungen.`.

**Verhalten (verbindlich, aus der Spec):**
- `erzeugeZoomKern(d)`: Fristen = `ZOOM_FRISTEN` überschrieben mit `d.fristen`; Laufzeit-Dienste = echte Funktionen aus `laufzeit.ts`, überschrieben mit `d.laufzeit`. Beim Erzeugen genau einmal `pruefe(d.pfade)` und `zugang.lesen()`. **Mängel** in der Reihenfolge Laufzeit-Mangel (`sdk_fehlt`/`sdk_defekt`/`bridge_fehlt`), dann Zugangs-Mangel (`zugang_unlesbar`, wenn keine Daten und `unlesbar`, sonst `zugang_fehlt`, wenn keine Daten). Mit Mängeln Zustand `einrichtung`, sonst `bereit`. Logzeile `[zoom] Zoom-Kern bereit: <zustand> (Mängel: …)`.
- `kurz()` nach Spec 5.4: `warten` nur in `warteraum`, `erlaubnis` nur in `im_meeting`, `quellen`/`ohneBild` über `zaehleQuellen` aller Quellen (auch einer Bridge im Abbau, 7.1), `sollOffen: 0` (Aufgabe 15 füllt), `versuch: null` (4a), `maengel` als Kopie, `kopieLaeuft`.
- `abbild()`: `einrichtung.sdk.stand` = `kopiert` während der Kopie, `fehlt` bei `sdk_fehlt`, `defekt` bei `sdk_defekt`, sonst `ok` (auch bei `bridge_fehlt`: das SDK selbst ist dann in Ordnung); `fassung` = `SDK_FASSUNG` nur bei `ok`; `text` = letzter Fehler der Ordnerwahl bzw. Kopie, sonst `mangelText` bei `sdk_defekt` (S9) und `bridge_fehlt` (S8), sonst `null`. `einrichtung.zugang`: `herkunft`, `clientIdEnde` (letzte 4 Zeichen der Client-ID, nie mehr), `text` = A5 (keine Daten, unlesbar), A4 (`session`), A6 (`env`), sonst letzter Fehler A1–A3, sonst `null`. `versatz.gewuenschtMs` aus den Einstellungen, `bestaetigtMs: null` (Aufgabe 11), `teilnehmer: []` (Aufgabe 12), `soll: []` (Aufgabe 15), `abriss: null` (Aufgabe 13), `erneutMoeglich = (nummer !== null)`.
- `stateKv()` = `stateKvAus(kurz())`.
- **Drossel:** Jede Änderung ruft `abbildGeaendert()`. `onKurz` sofort, wenn sich `JSON.stringify(kurz())` geändert hat. `onAbbild` vorne sofort, danach höchstens alle `abbildTaktMs`; ein Nachzügler-Zeitgeber schickt den **letzten** Stand.
- `setzeZustand(z)` loggt jeden Wechsel als `[zoom] Zustand <alt> → <neu>`, setzt `warten` außerhalb von `warteraum` auf `null` und ruft `abbildGeaendert()`.
- `einrichtungSperre()`: `{ ok: true }` in Z1a (`einrichtung` ohne Kopie), Z2 (`bereit` ohne Prüfung) und Z13 (`fehler`), sonst `{ ok: false, text: KT.S10 }`.
- `sdkWaehlen(ordner)`: Sperre; in Z13 zuerst `schliessen()`; `pruefeOrdner(ordner, d.pfade.ressourcen)` → Fehler: Text merken (Abbild), `{ ok: false, text }`. Sonst **synchron** vor dem ersten `await`: `AbortController`, `kopie` gesetzt (Z1b) — so bekommt ein zweiter Klick S10 (Review Focus 4). `richteEin` mit `fortschritt` (aktualisiert `abbild.einrichtung.sdk.kopie`) und `signal`, sein Versprechen als `kopieLauf` gemerkt; wirft es, S6 mit `err.code ?? err.message`. Danach `kopie`, `kopieAbbruch` und `kopieLauf` auf `null`; Erfolg → `einstellungen.setzeLaufzeit({ dir, fassung, eingerichtetAm })`; in jedem Fall `pruefe` neu, Mängel neu, Zustand `einrichtung`/`bereit`.
- `zugangWaehlen(datei)`: Sperre; Z13 → `schliessen()`; `readCredentials({ ZOOM_SDK_CREDENTIALS: datei })`; Fehlertext enthält „kein gueltiges JSON“ → A1, „Zugangsdaten fehlen“ → A2, sonst A3(`err.code ?? err.name`); weder Inhalt noch Secret gehen in Text oder Log. Erfolg → `zugang.speichern(...)`, Logzeile mit „verschlüsselt“ bzw. „nur für diese Sitzung“, Mängel neu. `zugangLoeschen()`: Sperre; Z13 → `schliessen()`; `zugang.loeschen()`; Mängel neu (Herkunft `env` bleibt ohne Mangel).
- `versatz({ ms })` (Teil 1): ganze Zahl 0–1000, sonst `{ ok: false, text: KT.Q13 }` und nichts gespeichert; gültig → `setzeVersatzMs(ms)`.
- `schliessen()` (6.8, vollständig): nur in `bereit` und `fehler`; `meldung`, Soll-Liste, Nummer, Kenncode, Merker leeren; Zustand `einrichtung` bei Mängeln, sonst `bereit`. `meldungWeg()`: in jedem Zustand außer `fehler` nur `meldung: null`.
- `laeuft()` (Teil 1): Kopie läuft oder Prüfung läuft.
- `beenden(fristMs)` (Teil 1): bricht eine laufende Kopie über das Signal ab und **wartet** auf `kopieLauf`, höchstens `fristMs` (`mitFrist`). `richteEin` endet nach der gerade laufenden Datei und löscht `<ziel>.teil` dabei selbst (Aufgabe 7); ohne dieses Warten ruft `before-quit` (Aufgabe 17) sofort `app.quit()`, der Prozess endet vorher und ein halbes `.teil` bleibt in `%LOCALAPPDATA%` liegen (Spec 6.1: „bricht sie ab und `.teil` wird gelöscht“). Läuft die Frist ab: Logzeile `[zoom] SDK-Kopie nicht rechtzeitig abgebrochen` und weiter (6.6 „Nach `frist` geht es ohne Warten weiter“; das nächste `richteEin` löscht ein liegengebliebenes `.teil` vor der Kopie; L24). Ein zweiter Aufruf liefert dasselbe Versprechen.

- [ ] **Step 1: Testgerüst und Fälle der Aufgabe 10 schreiben (rot)**

Neue Datei `apps/connect/test/zoom-kern.test.ts` mit genau diesem Inhalt:

```ts
// Zoom-Kern OHNE Electron (tsx): echte Bridge gegen die Attrappe packages/zoom-bridge/test/fake-bridge.mjs.
//   npm run selftest -w @jm/connect   ·   einzeln: npx tsx apps/connect/test/zoom-kern.test.ts
// Spec 12.2 ohne die 4b-Fälle (15, 15b, 15c, 16–18, 22, 25, Fernsteuer-Teile von 13 und 21).
// Laufzeit, Zugangsdaten und Einstellungen sind Attrappen; die Bridge-Fabrik setzt FAKE_SDK_FASSUNG
// IMMER auf '7.1.5 (43953)' — die Prüfung im Kern bleibt exakt (G1), nur Fall 7 überschreibt den Wert.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Bridge, type BridgeEvent, type Command } from '@jm/zoom-bridge';
import { SDK_FASSUNG } from '@jm/zoom-bridge/sdk';
import {
  ANZEIGENAME_VORGABE,
  erzeugeZoomKern,
  type BridgeArt,
  type BridgeFabrik,
  type LaufzeitDienste,
  type ZoomFristen,
  type ZoomKern,
  type ZugangDaten,
  type ZugangStand,
} from '../src/main/zoom/kern';
import { KT } from '../src/main/zoom/klartext';
import {
  laufzeitOrdner,
  richteEin,
  STEMPEL_DATEI,
  type EinrichtungsErgebnis,
  type LaufzeitPfade,
  type LaufzeitPruefung,
} from '../src/main/zoom/laufzeit';
import type { ZoomAbbild, ZoomErgebnis, ZoomKurz } from '../src/shared/types';
import { kartenZeile, stateKvAus, zoomZ } from '../src/shared/zoom-text';

const HIER = dirname(fileURLToPath(import.meta.url));
const FAKE = join(HIER, '..', '..', '..', 'packages', 'zoom-bridge', 'test', 'fake-bridge.mjs');
/** Synthetisch (G12) — keine echte Meeting-Nummer. */
const NUMMER = '7'.repeat(10);
const KENNCODE = 'KENNCODE-PROBE-71';

let pass = 0, fail = 0, skip = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
function ueberspringe(name: string): void {
  skip++;
  console.log(`  --  ${name} (übersprungen: nur unter Windows)`);
}
function warte(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
/** Wartet, bis `pred` zutrifft (Takt 20 ms); liefert, ob es rechtzeitig zutraf. */
async function bis(pred: () => boolean, ms = 4000): Promise<boolean> {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    if (pred()) return true;
    await warte(20);
  }
  return pred();
}
// Gesamtwache: hängt ein Fall, endet der Lauf rot statt nie.
const wache = setTimeout(() => {
  console.log('FAIL  Gesamtlaufzeit über 180 s – ein Fall hängt');
  process.exit(1);
}, 180_000);
wache.unref();

interface Probe {
  kern: ZoomKern;
  logs: string[];
  abbilder: ZoomAbbild[];
  kurze: ZoomKurz[];
  starts(): number;
  /** Befehle aus FAKE_LOGDATEI; ohne Argument die aller Starts in Reihenfolge. */
  befehle(startNr?: number): Array<Record<string, unknown>>;
  ereignisse: Array<{ startNr: number; ev: BridgeEvent }>;
  einst: { anzeigename: string; versatzMs: number; laufzeit: { dir: string; fassung: string; eingerichtetAm: string } | null };
  zugangGespeichert: ZugangDaten[];
  richteEinAufrufe(): number;
  /** Laufzeit-Ordner, den die Vorgabe von `pruefe` meldet. */
  ordner: string;
  /** Die Pfade, mit denen der Kern erzeugt ist (für das echte richteEin). */
  pfade: LaufzeitPfade;
  /** kern.beenden(2000), jede gebaute Bridge stoppen, Temp-Ordner löschen. */
  aufraeumen(): Promise<void>;
}
interface BaueOptionen {
  /** Stellschrauben der Attrappe je Start (1., 2., … Bridge). */
  stell?: (startNr: number) => Record<string, string>;
  /** FAKE_SCRIPT, Vorgabe 'steuerung'. */
  skript?: string;
  zugang?: Partial<ZugangStand>;
  speichernLiefert?: 'stored' | 'session';
  laufzeit?: Partial<LaufzeitDienste>;
  fristen?: Partial<ZoomFristen>;
  gastLabels?: () => string[];
  env?: Record<string, string | undefined>;
  /** false = Befehl verschlucken (Q8). */
  sendeFilter?: (cmd: Command) => boolean;
  versatzMs?: number;
  anzeigename?: string;
}

function baueKern(o: BaueOptionen = {}): Probe {
  const tmp = mkdtempSync(join(tmpdir(), 'jm-zoom-kern-'));
  const ordner = join(tmp, 'laufzeit');
  const pfade: LaufzeitPfade = { basis: join(tmp, 'basis'), ressourcen: join(tmp, 'ressourcen') };
  let startZahl = 0;
  let richteEinZahl = 0;
  const bruecken: BridgeArt[] = [];
  const logs: string[] = [];
  const abbilder: ZoomAbbild[] = [];
  const kurze: ZoomKurz[] = [];
  const ereignisse: Probe['ereignisse'] = [];
  const zugangGespeichert: ZugangDaten[] = [];
  const einst: Probe['einst'] = { anzeigename: o.anzeigename ?? ANZEIGENAME_VORGABE, versatzMs: o.versatzMs ?? 0, laufzeit: null };
  let zugang: ZugangStand = {
    daten: { clientId: 'test-id-1234', clientSecret: 'test-secret' },
    herkunft: 'stored',
    unlesbar: false,
    ...o.zugang,
  };
  const fabrik: BridgeFabrik = (opts, nr) => {
    startZahl += 1;
    const b = new Bridge({
      ...opts,
      exePath: process.execPath,
      exeArgs: [FAKE],
      env: {
        ...opts.env,
        FAKE_SCRIPT: o.skript ?? 'steuerung',
        FAKE_SDK_FASSUNG: '7.1.5 (43953)',
        FAKE_LOGDATEI: join(tmp, `befehle-${nr}.log`),
        ...(o.stell?.(nr) ?? {}),
      },
      onEvent: (ev, s) => {
        ereignisse.push({ startNr: nr, ev });
        opts.onEvent?.(ev, s);
      },
    });
    const art: BridgeArt = {
      start: () => b.start(),
      send: (cmd) => {
        if (o.sendeFilter && !o.sendeFilter(cmd)) return;
        b.send(cmd);
      },
      stop: () => b.stop(),
      get session() {
        return b.session;
      },
    };
    bruecken.push(art);
    return art;
  };
  const richteEinVorgabe = o.laufzeit?.richteEin;
  const laufzeit: Partial<LaufzeitDienste> = {
    pruefe: () => ({ ok: true, ordner, ersetzt: [] }),
    ...o.laufzeit,
  };
  if (richteEinVorgabe) {
    laufzeit.richteEin = (e) => {
      richteEinZahl += 1;
      return richteEinVorgabe(e);
    };
  }
  const kern = erzeugeZoomKern({
    pfade,
    zugang: {
      lesen: () => ({ ...zugang }),
      speichern: (dd) => {
        zugangGespeichert.push({ ...dd });
        const herkunft = o.speichernLiefert ?? 'stored';
        if (zugang.herkunft !== 'env') zugang = { daten: { ...dd }, herkunft, unlesbar: false };
        return herkunft;
      },
      loeschen: () => {
        if (zugang.herkunft !== 'env') zugang = { daten: null, herkunft: 'none', unlesbar: false };
      },
    },
    einstellungen: {
      anzeigename: () => einst.anzeigename,
      setzeAnzeigename: (n) => {
        einst.anzeigename = n;
      },
      versatzMs: () => einst.versatzMs,
      setzeVersatzMs: (ms) => {
        einst.versatzMs = ms;
      },
      setzeLaufzeit: (v) => {
        einst.laufzeit = { ...v };
      },
    },
    gastLabels: o.gastLabels ?? (() => []),
    log: (z) => logs.push(z),
    onAbbild: (a) => abbilder.push(a),
    onKurz: (k) => kurze.push(k),
    bridgeFabrik: fabrik,
    laufzeit,
    env: o.env,
    fristen: { anmeldeMs: 3000, joinTimeoutMs: 3000, killTimeoutMs: 2000, ...o.fristen },
  });
  return {
    kern,
    logs,
    abbilder,
    kurze,
    ereignisse,
    einst,
    zugangGespeichert,
    ordner,
    pfade,
    starts: () => startZahl,
    befehle: (startNr) => {
      const nummern = startNr === undefined ? Array.from({ length: startZahl }, (_, i) => i + 1) : [startNr];
      const aus: Array<Record<string, unknown>> = [];
      for (const n of nummern) {
        const datei = join(tmp, `befehle-${n}.log`);
        if (!existsSync(datei)) continue;
        for (const z of readFileSync(datei, 'utf8').split('\n')) if (z.trim()) aus.push(JSON.parse(z) as Record<string, unknown>);
      }
      return aus;
    },
    richteEinAufrufe: () => richteEinZahl,
    aufraeumen: async () => {
      await kern.beenden(2000);
      await Promise.all(bruecken.map((b) => b.stop()));
      try {
        rmSync(tmp, { recursive: true, force: true });
      } catch {
        // Windows: eine Datei ist noch offen — der Temp-Ordner bleibt liegen, der Test nicht hängen.
      }
    },
  };
}

/** Befehlsnamen eines Starts (oder aller Starts). */
function cmds(p: Probe, startNr?: number): string[] {
  return p.befehle(startNr).map((c) => String(c.cmd));
}
/** Zustandsfolge aus den onKurz-Meldungen, ohne direkte Wiederholungen. */
function folge(p: Probe): string[] {
  const aus: string[] = [];
  for (const k of p.kurze) if (aus.at(-1) !== k.zustand) aus.push(k.zustand);
  return aus;
}
const ok = (r: { ok: boolean }): boolean => r.ok;
const text = (r: { ok: true } | { ok: false; text: string }): string | null => (r.ok ? null : r.text);

// ── Aufgabe 10: Einrichtung, Mängel, Sperre, Drossel ─────────────────────────
console.log('— Mängel beim Start (Fall 1, erster Teil)');
{
  const p = baueKern({ zugang: { daten: null, herkunft: 'none' }, laufzeit: { pruefe: () => ({ ok: false, mangel: 'sdk_fehlt' }) } });
  const k = p.kern.kurz();
  ck('Laufzeit fehlt + kein Zugang → einrichtung', k.zustand === 'einrichtung' && zoomZ(k) === 'Z1a');
  ck('… Mängel in der Reihenfolge Laufzeit, Zugang', JSON.stringify(k.maengel) === '["sdk_fehlt","zugang_fehlt"]');
  ck('… STATE zoom_status=einrichtung, zoom_alarm=0', p.kern.stateKv()?.zoom_status === 'einrichtung' && p.kern.stateKv()?.zoom_alarm === 0);
  const a = p.kern.abbild();
  ck('… SDK „fehlt“ ohne Fassung, Zugang „none“ ohne Client-ID', a.einrichtung.sdk.stand === 'fehlt' && a.einrichtung.sdk.fassung === null
    && a.einrichtung.zugang.herkunft === 'none' && a.einrichtung.zugang.clientIdEnde === null);
  ck('… läuft nichts', !p.kern.laeuft());
  ck('… Sperre offen in Z1a', p.kern.einrichtungSperre().ok);
  await p.aufraeumen();
}
{
  const p = baueKern();
  const a = p.kern.abbild();
  ck('alles eingerichtet → bereit ohne Mängel', a.kurz.zustand === 'bereit' && a.kurz.maengel.length === 0 && p.kern.stateKv()?.zoom_status === 'bereit');
  ck('… SDK ok mit 7.1.5.43953, Client-ID endet auf 1234, kein Text',
    a.einrichtung.sdk.stand === 'ok' && a.einrichtung.sdk.fassung === SDK_FASSUNG && a.einrichtung.sdk.text === null
    && a.einrichtung.zugang.herkunft === 'stored' && a.einrichtung.zugang.clientIdEnde === '1234' && a.einrichtung.zugang.text === null);
  ck('… Client-Secret nirgends im Abbild', !JSON.stringify(a).includes('test-secret'));
  ck('… Anzeigename und Versatz aus den Einstellungen, nichts bestätigt',
    a.anzeigename === 'JM Connect' && a.versatz.gewuenschtMs === 0 && a.versatz.bestaetigtMs === null);
  ck('… keine Meldung, kein „Erneut“, keine Teilnehmer, keine Soll-Einträge, kein Abriss',
    a.meldung === null && !a.erneutMoeglich && a.teilnehmer.length === 0 && a.soll.length === 0 && a.abriss === null && !a.pruefungLaeuft);
  ck('… Log nennt den Startzustand', p.logs.some((z) => z.startsWith('[zoom] ') && z.includes('bereit')));
  await p.aufraeumen();
}
{
  const p = baueKern({ zugang: { daten: null, herkunft: 'none', unlesbar: true } });
  ck('Zugang unlesbar → Mangel zugang_unlesbar, Text A5',
    JSON.stringify(p.kern.kurz().maengel) === '["zugang_unlesbar"]' && p.kern.abbild().einrichtung.zugang.text === KT.A5);
  await p.aufraeumen();
}
{
  const p = baueKern({ laufzeit: { pruefe: () => ({ ok: false, mangel: 'sdk_defekt', datei: 'sdk.dll' }) } });
  const a = p.kern.abbild();
  ck('Laufzeit defekt → Stand „defekt“, Text S9 mit Datei', a.einrichtung.sdk.stand === 'defekt' && a.einrichtung.sdk.text === KT.S9('sdk.dll'));
  await p.aufraeumen();
}
{
  const p = baueKern({ laufzeit: { pruefe: () => ({ ok: false, mangel: 'bridge_fehlt' }) } });
  ck('Bridge fehlt → Mangel bridge_fehlt, Text S8',
    JSON.stringify(p.kern.kurz().maengel) === '["bridge_fehlt"]' && p.kern.abbild().einrichtung.sdk.text === KT.S8);
  await p.aufraeumen();
}

console.log('— Zugangsdaten wählen und entfernen (6.1, A1–A6)');
{
  const p = baueKern({ zugang: { daten: null, herkunft: 'none' } });
  const dir = mkdtempSync(join(tmpdir(), 'jm-zoom-zugang-'));
  const kaputt = join(dir, 'kaputt.json');
  writeFileSync(kaputt, '{ "clientId": "x", "clientSecret": GEHEIM-INHALT');
  const r1 = p.kern.zugangWaehlen(kaputt);
  ck('kaputtes JSON → A1', text(r1) === KT.A1);
  ck('… der Inhalt steht weder im Abbild noch im Log',
    !JSON.stringify(p.kern.abbild()).includes('GEHEIM-INHALT') && !p.logs.some((z) => z.includes('GEHEIM-INHALT')));
  const leer = join(dir, 'leer.json');
  writeFileSync(leer, '{}');
  ck('ohne Felder → A2', text(p.kern.zugangWaehlen(leer)) === KT.A2);
  ck('fehlende Datei → A3 mit ENOENT', text(p.kern.zugangWaehlen(join(dir, 'fehlt.json'))) === KT.A3('ENOENT'));
  ck('… der letzte Fehler steht im Abbild, nichts gespeichert',
    p.kern.abbild().einrichtung.zugang.text === KT.A3('ENOENT') && p.zugangGespeichert.length === 0 && p.kern.kurz().zustand === 'einrichtung');
  const gut = join(dir, 'gut.json');
  writeFileSync(gut, '\uFEFF{"clientId":"datei-id-1234","clientSecret":"datei-secret"}');
  const r4 = p.kern.zugangWaehlen(gut);
  ck('gültige Datei mit BOM → ok und gespeichert', ok(r4) && p.zugangGespeichert.length === 1
    && p.zugangGespeichert[0].clientId === 'datei-id-1234' && p.zugangGespeichert[0].clientSecret === 'datei-secret');
  const a = p.kern.abbild();
  ck('… Mangel weg, bereit, Client-ID endet auf 1234, kein Fehlertext',
    a.kurz.zustand === 'bereit' && a.einrichtung.zugang.herkunft === 'stored' && a.einrichtung.zugang.clientIdEnde === '1234' && a.einrichtung.zugang.text === null);
  ck('… Secret weder im Abbild noch im Log', !JSON.stringify(a).includes('datei-secret') && !p.logs.some((z) => z.includes('datei-secret')));
  ck('Entfernen → Mangel zugang_fehlt, einrichtung', ok(p.kern.zugangLoeschen()) && JSON.stringify(p.kern.kurz().maengel) === '["zugang_fehlt"]'
    && p.kern.kurz().zustand === 'einrichtung');
  rmSync(dir, { recursive: true, force: true });
  await p.aufraeumen();
}
{
  const p = baueKern({ zugang: { daten: null, herkunft: 'none' }, speichernLiefert: 'session' });
  const dir = mkdtempSync(join(tmpdir(), 'jm-zoom-zugang-'));
  const gut = join(dir, 'gut.json');
  writeFileSync(gut, '{"clientId":"sitzung-9876","clientSecret":"s"}');
  ck('ohne Schlüsselbund → ok, Herkunft session, Text A4',
    ok(p.kern.zugangWaehlen(gut)) && p.kern.abbild().einrichtung.zugang.herkunft === 'session' && p.kern.abbild().einrichtung.zugang.text === KT.A4);
  rmSync(dir, { recursive: true, force: true });
  await p.aufraeumen();
}
{
  const p = baueKern({ zugang: { daten: { clientId: 'umgebung-5555', clientSecret: 'u' }, herkunft: 'env' } });
  ck('Herkunft Umgebung → Text A6, Client-ID endet auf 5555',
    p.kern.abbild().einrichtung.zugang.text === KT.A6 && p.kern.abbild().einrichtung.zugang.clientIdEnde === '5555');
  ck('… Entfernen lässt keinen Mangel entstehen', ok(p.kern.zugangLoeschen()) && p.kern.kurz().maengel.length === 0 && p.kern.kurz().zustand === 'bereit');
  await p.aufraeumen();
}

console.log('— SDK-Ordner wählen (6.1), Sperre S10, Review Focus 4');
{
  let lzStand: LaufzeitPruefung = { ok: false, mangel: 'sdk_fehlt' };
  let freigabe: (e: EinrichtungsErgebnis) => void = () => {};
  let signal: AbortSignal | undefined;
  const MiB = 1024 * 1024;
  const p = baueKern({
    laufzeit: {
      pruefe: () => lzStand,
      pruefeOrdner: () => ({
        ok: true, bin: 'C:/SDK/x64/bin', fassung: SDK_FASSUNG,
        dateien: [{ pfad: 'sdk.dll', bytes: MiB }, { pfad: 'a.dll', bytes: MiB }, { pfad: 'language/de.txt', bytes: MiB }],
        bytesGesamt: 3 * MiB,
      }),
      richteEin: (e) => {
        signal = e.signal;
        e.fortschritt({ dateien: 1, dateienGesamt: 3, bytes: MiB, bytesGesamt: 3 * MiB });
        return new Promise<EinrichtungsErgebnis>((resolve) => {
          freigabe = resolve;
        });
      },
    },
  });
  ck('vorher: einrichtung (SDK fehlt)', p.kern.kurz().zustand === 'einrichtung');
  const lauf = p.kern.sdkWaehlen('C:/SDK');
  ck('während der Kopie: Z1b, kopieLaeuft, SDK-Stand „kopiert“',
    zoomZ(p.kern.kurz()) === 'Z1b' && p.kern.kurz().kopieLaeuft && p.kern.abbild().einrichtung.sdk.stand === 'kopiert');
  ck('… Kartenzeile mit Fortschritt', kartenZeile(p.kern.abbild(), Date.now()) === 'Zoom-SDK wird kopiert: 1 von 3 Dateien (1 von 3 MB).');
  ck('… laeuft()', p.kern.laeuft());
  ck('… einrichtungSperre() → S10', text(p.kern.einrichtungSperre()) === KT.S10);
  // Ohne Sperre käme hier eine zweite Kopie, die nie endet — darum mit Frist statt blankem await.
  const zweit = await Promise.race([p.kern.sdkWaehlen('C:/SDK'), warte(1000).then((): ZoomErgebnis => ({ ok: false, text: '(keine Antwort)' }))]);
  ck('Review Focus 4: zweiter Klick während der Kopie → S10', text(zweit) === KT.S10);
  ck('… richteEin genau einmal aufgerufen', p.richteEinAufrufe() === 1);
  ck('… Zugangsdaten wählen und entfernen ebenfalls S10',
    text(p.kern.zugangWaehlen('C:/egal.json')) === KT.S10 && text(p.kern.zugangLoeschen()) === KT.S10);
  lzStand = { ok: true, ordner: p.ordner, ersetzt: [] };
  freigabe({
    ok: true, ordner: p.ordner, aufraeumFehler: null,
    stempel: { format: 1, sdkFassung: SDK_FASSUNG, eingerichtetAm: '2026-10-02T10:00:00.000Z', sdkDateien: [], eigeneDateien: [] },
  });
  const r = await lauf;
  ck('nach der Kopie: ok, bereit, keine Mängel', ok(r) && p.kern.kurz().zustand === 'bereit' && p.kern.kurz().maengel.length === 0
    && !p.kern.kurz().kopieLaeuft && p.kern.abbild().einrichtung.sdk.kopie === null);
  ck('… Laufzeit in den Einstellungen', p.einst.laufzeit?.dir === p.ordner && p.einst.laufzeit?.fassung === SDK_FASSUNG
    && p.einst.laufzeit?.eingerichtetAm === '2026-10-02T10:00:00.000Z');
  ck('… Signal nicht abgebrochen, nichts läuft mehr', signal?.aborted === false && !p.kern.laeuft());
  await p.aufraeumen();
}
{
  const p = baueKern({ laufzeit: { pruefeOrdner: () => ({ ok: false, text: KT.S1 }) } });
  const r = await p.kern.sdkWaehlen('C:/leer');
  ck('kein SDK im Ordner → S1, auch als Text im Abbild', text(r) === KT.S1 && p.kern.abbild().einrichtung.sdk.text === KT.S1);
  ck('… Zustand bleibt bereit, keine Kopie', p.kern.kurz().zustand === 'bereit' && !p.kern.kurz().kopieLaeuft);
  await p.aufraeumen();
}
{
  const p = baueKern({
    laufzeit: {
      pruefeOrdner: () => ({ ok: true, bin: 'X', fassung: SDK_FASSUNG, dateien: [{ pfad: 'sdk.dll', bytes: 1 }], bytesGesamt: 1 }),
      richteEin: async () => ({ ok: false, text: KT.S6('EIO') }),
    },
  });
  const r = await p.kern.sdkWaehlen('C:/SDK');
  ck('Kopierfehler → S6, Text im Abbild, bisherige Einrichtung bleibt (bereit)',
    text(r) === KT.S6('EIO') && p.kern.abbild().einrichtung.sdk.text === KT.S6('EIO') && p.kern.kurz().zustand === 'bereit' && p.einst.laufzeit === null);
  await p.aufraeumen();
}
{
  // Diagnose, die jemand anzeigt: der Aufräumfehler aus laufzeit.ts landet im Log, die Einrichtung gilt trotzdem.
  const p = baueKern({
    laufzeit: {
      pruefeOrdner: () => ({ ok: true, bin: 'X', fassung: SDK_FASSUNG, dateien: [{ pfad: 'sdk.dll', bytes: 1 }], bytesGesamt: 1 }),
      richteEin: async () => ({
        ok: true, ordner: 'C:/lz', aufraeumFehler: 'EBUSY',
        stempel: { format: 1, sdkFassung: SDK_FASSUNG, eingerichtetAm: '2026-10-02T10:00:00.000Z', sdkDateien: [], eigeneDateien: [] },
      }),
    },
  });
  const r = await p.kern.sdkWaehlen('C:/SDK');
  ck('Aufräumfehler nach dem Tausch → Logzeile mit Code, Einrichtung trotzdem ok',
    ok(r) && p.logs.some((z) => z.includes('Aufräumen nach der Einrichtung unvollständig (EBUSY)')));
  await p.aufraeumen();
}
{
  let signal: AbortSignal | undefined;
  let freigabe: (e: EinrichtungsErgebnis) => void = () => {};
  const p = baueKern({
    laufzeit: {
      pruefe: () => ({ ok: false, mangel: 'sdk_fehlt' }),
      pruefeOrdner: () => ({ ok: true, bin: 'X', fassung: SDK_FASSUNG, dateien: [{ pfad: 'sdk.dll', bytes: 1 }], bytesGesamt: 1 }),
      richteEin: (e) => {
        signal = e.signal;
        return new Promise<EinrichtungsErgebnis>((resolve) => {
          freigabe = resolve;
        });
      },
    },
  });
  const lauf = p.kern.sdkWaehlen('C:/SDK');
  let beendet = false;
  const b1 = p.kern.beenden(2000);
  const b2 = p.kern.beenden(2000);
  void b1.then(() => {
    beendet = true;
  });
  await warte(200);
  ck('beenden während der Kopie: Signal abgebrochen, wartet auf das Ende der Kopie (Spec 6.1)', signal?.aborted === true && !beendet);
  ck('… zweiter Aufruf bekommt dasselbe Versprechen', b1 === b2);
  const t0 = Date.now();
  freigabe({ ok: false, text: KT.S6('abgebrochen') });
  await b1;
  ck('… kehrt zurück, sobald die Kopie ihr Ergebnis hat (nicht erst nach der Frist)', Date.now() - t0 < 1000);
  ck('… die Kopie endet mit S6, kein „nicht rechtzeitig“ im Log',
    text(await lauf) === KT.S6('abgebrochen') && !p.logs.includes('[zoom] SDK-Kopie nicht rechtzeitig abgebrochen'));
  await p.aufraeumen();
}
{
  const p = baueKern({
    laufzeit: {
      pruefe: () => ({ ok: false, mangel: 'sdk_fehlt' }),
      pruefeOrdner: () => ({ ok: true, bin: 'X', fassung: SDK_FASSUNG, dateien: [{ pfad: 'sdk.dll', bytes: 1 }], bytesGesamt: 1 }),
      // Eine Kopie, die nie fertig wird (hängendes Laufwerk): beenden darf nicht länger als die Frist warten.
      richteEin: () => new Promise<EinrichtungsErgebnis>(() => {}),
    },
  });
  void p.kern.sdkWaehlen('C:/SDK');
  const t0 = Date.now();
  let dauer = -1;
  // warte(600) hält die Ereignisschleife wach: die Frist läuft über einen unref-Zeitgeber.
  await Promise.all([
    p.kern.beenden(300).then(() => {
      dauer = Date.now() - t0;
    }),
    warte(600),
  ]);
  ck('Kopie hängt → beenden kehrt nach der Frist (300 ms) zurück, Log „SDK-Kopie nicht rechtzeitig abgebrochen“',
    dauer >= 250 && dauer < 600 && p.logs.includes('[zoom] SDK-Kopie nicht rechtzeitig abgebrochen'));
  await p.aufraeumen();
}

console.log('— Review Focus 3: Connect wird während der SDK-Kopie beendet (echtes richteEin)');
{
  const quelle = mkdtempSync(join(tmpdir(), 'jm-zoom-sdk-'));
  const dateien = ['a.dll', 'b.dll', 'c.dll', 'd.dll', 'sdk.dll'].map((pfad) => ({ pfad, bytes: 4 }));
  for (const x of dateien) writeFileSync(join(quelle, x.pfad), 'NEU!');
  let kopiert = 0;
  let ergebnisDa = false;
  const p = baueKern({
    laufzeit: {
      pruefe: () => ({ ok: false, mangel: 'sdk_fehlt' }),
      pruefeOrdner: () => ({ ok: true, bin: quelle, fassung: SDK_FASSUNG, dateien, bytesGesamt: 20 }),
      // Das echte richteEin aus laufzeit.ts; jede Datei braucht 150 ms, damit das Beenden mitten in die Kopie fällt.
      richteEin: (e) => {
        const r = richteEin({
          ...e,
          werkzeuge: {
            copyFile: async (von, nach) => {
              copyFileSync(von, nach);
              kopiert += 1;
              await warte(150);
            },
          },
        });
        void r.then(() => {
          ergebnisDa = true;
        });
        return r;
      },
    },
  });
  const ziel = laufzeitOrdner(p.pfade);
  mkdirSync(ziel, { recursive: true });
  writeFileSync(join(ziel, 'sdk.dll'), 'ALT!');
  writeFileSync(join(ziel, STEMPEL_DATEI), JSON.stringify({ format: 1, sdkFassung: SDK_FASSUNG, eingerichtetAm: '2026-01-01T00:00:00.000Z', sdkDateien: [], eigeneDateien: [] }));
  const vorher = readFileSync(join(ziel, STEMPEL_DATEI));
  const lauf = p.kern.sdkWaehlen(quelle);
  ck('Kopie läuft in <ziel>.teil', (await bis(() => kopiert >= 1, 2000)) && existsSync(`${ziel}.teil`));
  await p.kern.beenden(5000);
  ck('Review Focus 3: beenden kehrt erst zurück, wenn richteEin sein Ergebnis geliefert hat', ergebnisDa);
  ck('… <ziel>.teil ist gelöscht', !existsSync(`${ziel}.teil`));
  ck('… nach der laufenden Datei keine weitere kopiert (1 von 5)', kopiert === 1);
  ck('… vorher eingerichteter Ordner und Stempel unverändert',
    readFileSync(join(ziel, STEMPEL_DATEI)).equals(vorher) && readFileSync(join(ziel, 'sdk.dll'), 'utf8') === 'ALT!' && !existsSync(join(ziel, 'a.dll')));
  ck('… sdkWaehlen liefert S6 (abgebrochen)', text(await lauf) === KT.S6('abgebrochen'));
  rmSync(quelle, { recursive: true, force: true });
  await p.aufraeumen();
}

console.log('— Bild-Versatz speichern (6.7), Schließen/Meldung in Z1/Z2 (6.8)');
{
  const p = baueKern();
  ck('Versatz 1001 → Q13, nicht gespeichert', text(p.kern.versatz({ ms: 1001 })) === KT.Q13 && p.einst.versatzMs === 0);
  ck('Versatz 1.5 → Q13, nicht gespeichert', text(p.kern.versatz({ ms: 1.5 })) === KT.Q13 && p.einst.versatzMs === 0);
  ck('Versatz -1 → Q13', text(p.kern.versatz({ ms: -1 })) === KT.Q13);
  ck('Versatz 250 → gespeichert und im Abbild', ok(p.kern.versatz({ ms: 250 })) && p.einst.versatzMs === 250
    && p.kern.abbild().versatz.gewuenschtMs === 250 && p.kern.abbild().versatz.bestaetigtMs === null);
  p.kern.schliessen();
  p.kern.meldungWeg();
  ck('Schließen und Meldung quittieren in Z2 ohne Meldung: bereit, nichts gemerkt',
    p.kern.kurz().zustand === 'bereit' && p.kern.abbild().meldung === null && !p.kern.abbild().erneutMoeglich);
  await p.aufraeumen();
}
{
  const p = baueKern({ zugang: { daten: null, herkunft: 'none' } });
  p.kern.schliessen();
  ck('Schließen in Z1a ändert nichts', p.kern.kurz().zustand === 'einrichtung' && JSON.stringify(p.kern.kurz().maengel) === '["zugang_fehlt"]');
  await p.aufraeumen();
}

console.log('— Abbild-Drossel (ABBILD_TAKT_MS 100)');
{
  const p = baueKern();
  await warte(150);
  const vorher = p.abbilder.length;
  const kurzVorher = p.kurze.length;
  const t0 = Date.now();
  for (let i = 0; i < 30; i++) p.kern.versatz({ ms: i });
  const dauer = Date.now() - t0;
  await warte(250);
  const neu = p.abbilder.slice(vorher);
  ck('30 Änderungen in unter 50 ms', dauer < 50);
  ck('… höchstens 3 Abbilder in 250 ms', neu.length >= 1 && neu.length <= 3);
  ck('… das letzte trägt den letzten Stand (29)', neu.at(-1)?.versatz.gewuenschtMs === 29);
  ck('… Kurzform unverändert → kein onKurz', p.kurze.length === kurzVorher);
  await p.aufraeumen();
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen, ${skip} übersprungen.`);
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Step 2: Test laufen lassen (rot)**

Aus der Worktree-Wurzel:
```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: Abbruch vor dem ersten Fall, Exit-Code ≠ 0, mit
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\connect\src\main\zoom\kern' imported from …\apps\connect\test\zoom-kern.test.ts
```

- [ ] **Step 3: `kern.ts` anlegen (Gerüst, Einrichtung, Drossel)**

Neue Datei `apps/connect/src/main/zoom/kern.ts` mit genau diesem Inhalt:

```ts
// ─────────────────────────────────────────────────────────────────────────────
// Zoom-Kern (Stage 4a, Spec 5.2–7.5) — OHNE Electron, per tsx gegen die echte Bridge und die
// Attrappe getestet (test/zoom-kern.test.ts). zoom.ts ist die dünne Electron-Hülle darüber
// (IPC, Dialoge, safeStorage, Tray). Muster: Master-Link Teil 2a (verbund/kern.ts).
//
// Der Kern hält Zustand, Mängel der Einrichtung, die laufende Bridge samt Generation (6.9),
// Quellen, Soll-Liste und Meldung. Er fasst kein Electron an und liest keine Einstellung selbst.
//
// GEHEIMNISSE (Spec 5.7, 8.7): Meeting-Nummer und Kenncode leben nur in `nummer`/`kenncode`
// und gehen nur in den join-Befehl. Jede stderr-Zeile der Bridge läuft durch `maskiere`.
// Client-ID/Secret gehen nur in buildJwt, nie an den Kindprozess (envRemove).
//
// 4a (Spec 18): KEIN automatischer Wiederbeitritt. Jeder Auslöser aus 6.4, der einen
// Wiederbeitritt starten würde, führt sofort zu `fehler` mit „Erneut beitreten“.
// ─────────────────────────────────────────────────────────────────────────────

import { readCredentials, type Bridge, type BridgeOptions } from '@jm/zoom-bridge';
import { SDK_FASSUNG } from '@jm/zoom-bridge/sdk';
import type {
  ProxyKeySource,
  ZoomAbbild,
  ZoomErgebnis,
  ZoomErlaubnis,
  ZoomKurz,
  ZoomMangel,
  ZoomQuelle,
  ZoomZustand,
} from '../../shared/types';
import { stateKvAus, type ZoomStateKv } from '../../shared/zoom-text';
import { KT, mangelText } from './klartext';
import {
  pruefeLaufzeit,
  pruefeSdkOrdner,
  richteEin,
  type EinrichtungsErgebnis,
  type KopieStand,
  type LaufzeitPfade,
  type LaufzeitPruefung,
  type SdkWahl,
} from './laufzeit';
import type { SollListe } from './soll';
import { zaehleQuellen } from './teilnehmer';

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

export type BridgeArt = Pick<Bridge, 'start' | 'send' | 'stop' | 'session'>;
export type BridgeFabrik = (opts: BridgeOptions, startNr: number) => BridgeArt;
export interface ZugangDaten { clientId: string; clientSecret: string }
export interface ZugangStand { daten: ZugangDaten | null; herkunft: ProxyKeySource; unlesbar: boolean }
export interface LaufzeitDienste {
  pruefe(p: LaufzeitPfade): LaufzeitPruefung;
  pruefeOrdner(gewaehlt: string, ressourcen: string): SdkWahl;
  richteEin(e: Parameters<typeof richteEin>[0]): Promise<EinrichtungsErgebnis>;
}
export interface ZoomKernAbhaengigkeiten {
  pfade: LaufzeitPfade;
  zugang: { lesen(): ZugangStand; speichern(d: ZugangDaten): 'stored' | 'session'; loeschen(): void };
  einstellungen: {
    anzeigename(): string;
    setzeAnzeigename(n: string): void;
    versatzMs(): number;
    setzeVersatzMs(ms: number): void;
    setzeLaufzeit(v: { dir: string; fassung: string; eingerichtetAm: string }): void;
  };
  gastLabels(): string[];
  /** Fertige Zeile mit Präfix, schon maskiert. */
  log(zeile: string): void;
  /** Gedrosselt (höchstens alle `abbildTaktMs`, der letzte Stand kommt immer an). */
  onAbbild(a: ZoomAbbild): void;
  /** Sofort, sobald sich die Kurzform ändert. */
  onKurz?(k: ZoomKurz): void;
  /** Vorgabe: (o) => new Bridge(o). */
  bridgeFabrik?: BridgeFabrik;
  /** Vorgabe: die echten Funktionen aus laufzeit.ts. */
  laufzeit?: Partial<LaufzeitDienste>;
  /** Vorgabe: process.env. */
  env?: Record<string, string | undefined>;
  fristen?: Partial<ZoomFristen>;
}
export interface ZoomKern {
  abbild(): ZoomAbbild;
  kurz(): ZoomKurz;
  stateKv(): ZoomStateKv | null;
  laeuft(): boolean;
  einrichtungSperre(): ZoomErgebnis;
  sdkWaehlen(ordner: string): Promise<ZoomErgebnis>;
  zugangWaehlen(datei: string): ZoomErgebnis;
  zugangLoeschen(): ZoomErgebnis;
  versatz(e: { ms: number }): ZoomErgebnis;
  schliessen(): void;
  meldungWeg(): void;
  gastLabelsGeaendert(): void;
  beenden(fristMs: number): Promise<void>;
}

/** Eine Quelle samt der Generation der Bridge, die sie meldet (6.9). */
interface QuelleIntern extends ZoomQuelle { gen: number }

function zeitgeber(ms: number, fn: () => void): ReturnType<typeof setTimeout> {
  const t = setTimeout(fn, ms);
  t.unref?.();
  return t;
}

export function erzeugeZoomKern(d: ZoomKernAbhaengigkeiten): ZoomKern {
  const f: ZoomFristen = { ...ZOOM_FRISTEN, ...d.fristen };
  const lz: LaufzeitDienste = { pruefe: pruefeLaufzeit, pruefeOrdner: pruefeSdkOrdner, richteEin, ...d.laufzeit };

  // ── Zustand ──────────────────────────────────────────────────────────────
  let zustand: ZoomZustand = 'bereit';
  /** Nur in `warteraum` gesetzt (Spec 6.2 Schritt 5). */
  let warten: 'warteraum' | 'host' | null = null;
  /** Gilt nur in `im_meeting` (Spec 6.2 Schritt 6). */
  let erlaubnis: ZoomErlaubnis = 'offen';
  let maengel: ZoomMangel[] = [];
  let laufzeitStand: LaufzeitPruefung = lz.pruefe(d.pfade);
  let zugang: ZugangStand = { daten: null, herkunft: 'none', unlesbar: false };
  let zugangFehler: string | null = null;
  let sdkFehler: string | null = null;
  let kopie: KopieStand | null = null;
  let kopieAbbruch: AbortController | null = null;
  /** Das laufende richteEin; beenden wartet darauf, damit `.teil` gelöscht ist (Spec 6.1, 6.6). */
  let kopieLauf: Promise<EinrichtungsErgebnis> | null = null;
  let pruefungLaeuft = false;
  let meldung: ZoomAbbild['meldung'] = null;
  const hinweise: string[] = [];
  /** Nur im Arbeitsspeicher (Spec 5.7). */
  let nummer: { eingabe: string; normiert: string } | null = null;
  let kenncode: string | null = null;
  /** Merker „war im Meeting“ (Ergänzung 0.10); 4b entscheidet daran über den Wiederbeitritt. */
  let warImMeeting = false;
  const soll: SollListe = new Map();
  const quellen = new Map<number, QuelleIntern>();
  let beendenVersprechen: Promise<void> | null = null;

  // ── Abbild und Drossel ───────────────────────────────────────────────────
  let letzterPush = 0;
  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  let letzteKurz = '';

  function kurz(): ZoomKurz {
    const { n, k } = zaehleQuellen(quellen.values());
    return {
      zustand,
      warten: zustand === 'warteraum' ? warten : null,
      erlaubnis: zustand === 'im_meeting' ? erlaubnis : null,
      quellen: n,
      ohneBild: k,
      sollOffen: 0,
      versuch: null,
      maengel: [...maengel],
      kopieLaeuft: kopie !== null,
    };
  }

  function abbild(): ZoomAbbild {
    const l = laufzeitStand;
    const stand = kopie !== null ? 'kopiert' : !l.ok && l.mangel === 'sdk_fehlt' ? 'fehlt' : !l.ok && l.mangel === 'sdk_defekt' ? 'defekt' : 'ok';
    const sdkText = sdkFehler ?? (!l.ok && (l.mangel === 'sdk_defekt' || l.mangel === 'bridge_fehlt') ? mangelText(l.mangel, mangelDatei()) : null);
    const zugangText = !zugang.daten && zugang.unlesbar ? KT.A5
      : zugang.herkunft === 'session' ? KT.A4
      : zugang.herkunft === 'env' ? KT.A6
      : zugangFehler;
    const id = zugang.daten?.clientId ?? null;
    return {
      kurz: kurz(),
      einrichtung: {
        sdk: { stand, fassung: stand === 'ok' ? SDK_FASSUNG : null, kopie: kopie ? { ...kopie } : null, text: sdkText },
        zugang: { herkunft: zugang.herkunft, clientIdEnde: id ? id.slice(-4) : null, text: zugangText },
      },
      anzeigename: d.einstellungen.anzeigename(),
      versatz: { gewuenschtMs: d.einstellungen.versatzMs(), bestaetigtMs: null },
      teilnehmer: [],
      soll: [],
      abriss: null,
      meldung: meldung ? { ...meldung } : null,
      hinweise: [...hinweise],
      erneutMoeglich: nummer !== null,
      pruefungLaeuft,
    };
  }

  /** Nach jeder Änderung: Kurzform sofort (bei Änderung), Abbild höchstens alle abbildTaktMs. */
  function abbildGeaendert(): void {
    const k = kurz();
    const kj = JSON.stringify(k);
    if (kj !== letzteKurz) {
      letzteKurz = kj;
      d.onKurz?.(k);
    }
    if (pushTimer !== null) return;
    const rest = letzterPush + f.abbildTaktMs - Date.now();
    if (rest <= 0) {
      letzterPush = Date.now();
      d.onAbbild(abbild());
      return;
    }
    pushTimer = zeitgeber(rest, () => {
      pushTimer = null;
      letzterPush = Date.now();
      d.onAbbild(abbild());
    });
  }

  function setzeZustand(z: ZoomZustand): void {
    if (z !== zustand) {
      d.log(`[zoom] Zustand ${zustand} → ${z}`);
      zustand = z;
    }
    if (z !== 'warteraum') warten = null;
    abbildGeaendert();
  }

  // ── Einrichtung (Spec 5.3, 6.1) ──────────────────────────────────────────
  /** Mängel neu bestimmen: Laufzeit-Mangel zuerst, dann Zugangs-Mangel. */
  function bestimmeMaengel(neu?: LaufzeitPruefung): void {
    if (neu) laufzeitStand = neu;
    zugang = d.zugang.lesen();
    const m: ZoomMangel[] = [];
    if (!laufzeitStand.ok) m.push(laufzeitStand.mangel);
    if (!zugang.daten) m.push(zugang.unlesbar ? 'zugang_unlesbar' : 'zugang_fehlt');
    maengel = m;
  }

  function mangelDatei(): string | null {
    return !laufzeitStand.ok && laufzeitStand.mangel === 'sdk_defekt' ? laufzeitStand.datei : null;
  }

  function einrichtungSperre(): ZoomErgebnis {
    const frei = (zustand === 'einrichtung' && kopie === null) || (zustand === 'bereit' && !pruefungLaeuft) || zustand === 'fehler';
    return frei ? { ok: true } : { ok: false, text: KT.S10 };
  }

  async function sdkWaehlen(ordner: string): Promise<ZoomErgebnis> {
    const sperre = einrichtungSperre();
    if (!sperre.ok) return sperre;
    if (zustand === 'fehler') schliessen();
    sdkFehler = null;
    const wahl = lz.pruefeOrdner(ordner, d.pfade.ressourcen);
    if (!wahl.ok) {
      sdkFehler = wahl.text;
      d.log(`[zoom] SDK-Ordner abgewiesen: ${wahl.text}`);
      abbildGeaendert();
      return { ok: false, text: wahl.text };
    }
    const abbruch = new AbortController();
    kopieAbbruch = abbruch;
    kopie = { dateien: 0, dateienGesamt: wahl.dateien.length, bytes: 0, bytesGesamt: wahl.bytesGesamt };
    d.log(`[zoom] Zoom-SDK ${wahl.fassung} wird kopiert (${wahl.dateien.length} Dateien)`);
    setzeZustand('einrichtung');
    let erg: EinrichtungsErgebnis;
    try {
      kopieLauf = lz.richteEin({
        wahl,
        pfade: d.pfade,
        signal: abbruch.signal,
        fortschritt: (k) => {
          kopie = { ...k };
          abbildGeaendert();
        },
      });
      erg = await kopieLauf;
    } catch (e) {
      erg = { ok: false, text: KT.S6((e as { code?: string }).code ?? (e instanceof Error ? e.message : String(e))) };
    }
    kopie = null;
    kopieAbbruch = null;
    kopieLauf = null;
    if (erg.ok) {
      d.einstellungen.setzeLaufzeit({ dir: erg.ordner, fassung: erg.stempel.sdkFassung, eingerichtetAm: erg.stempel.eingerichtetAm });
      d.log(`[zoom] Zoom-SDK eingerichtet in ${erg.ordner}`);
      if (erg.aufraeumFehler) d.log(`[zoom] Aufräumen nach der Einrichtung unvollständig (${erg.aufraeumFehler})`);
    } else {
      sdkFehler = erg.text;
      d.log(`[zoom] Einrichtung des Zoom-SDK gescheitert: ${erg.text}`);
    }
    bestimmeMaengel(lz.pruefe(d.pfade));
    setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
    return erg.ok ? { ok: true } : { ok: false, text: erg.text };
  }

  function zugangWaehlen(datei: string): ZoomErgebnis {
    const sperre = einrichtungSperre();
    if (!sperre.ok) return sperre;
    if (zustand === 'fehler') schliessen();
    let daten: ZugangDaten;
    try {
      // Mit dieser Umgebung ist die Datei die EINZIGE Quelle (jwt.ts); BOM wird vertragen,
      // ein Parse-Fehler zitiert den Inhalt nicht.
      daten = readCredentials({ ZOOM_SDK_CREDENTIALS: datei });
    } catch (e) {
      const err = e as Error & { code?: string };
      const text = err.message.includes('kein gueltiges JSON') ? KT.A1
        : err.message.includes('Zugangsdaten fehlen') ? KT.A2
        : KT.A3(err.code ?? err.name);
      zugangFehler = text;
      d.log(`[zoom] Zugangsdaten-Datei abgewiesen: ${text}`);
      abbildGeaendert();
      return { ok: false, text };
    }
    zugangFehler = null;
    const herkunft = d.zugang.speichern({ clientId: daten.clientId, clientSecret: daten.clientSecret });
    d.log(`[zoom] Zugangsdaten hinterlegt (${herkunft === 'session' ? 'nur für diese Sitzung' : 'verschlüsselt'})`);
    bestimmeMaengel();
    setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
    return { ok: true };
  }

  function zugangLoeschen(): ZoomErgebnis {
    const sperre = einrichtungSperre();
    if (!sperre.ok) return sperre;
    if (zustand === 'fehler') schliessen();
    d.zugang.loeschen();
    zugangFehler = null;
    d.log('[zoom] Zugangsdaten entfernt');
    bestimmeMaengel();
    setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
    return { ok: true };
  }

  function versatz(e: { ms: number }): ZoomErgebnis {
    if (!Number.isInteger(e.ms) || e.ms < 0 || e.ms > 1000) return { ok: false, text: KT.Q13 };
    d.einstellungen.setzeVersatzMs(e.ms);
    abbildGeaendert();
    return { ok: true };
  }

  /** Spec 6.8 „Schließen“: nur in Z2 und Z13. */
  function schliessen(): void {
    if (zustand !== 'bereit' && zustand !== 'fehler') return;
    meldung = null;
    soll.clear();
    nummer = null;
    kenncode = null;
    warImMeeting = false;
    setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
  }

  /** Spec 6.8 „Meldung quittieren“: in jedem Zustand außer Z13. */
  function meldungWeg(): void {
    if (zustand === 'fehler') return;
    meldung = null;
    abbildGeaendert();
  }

  function laeuft(): boolean {
    return kopie !== null || pruefungLaeuft;
  }

  // ── Beenden (Spec 6.6) ───────────────────────────────────────────────────
  /** Wartet höchstens `ms` auf `p` (eine Ablehnung zählt als Ende); true = `p` war rechtzeitig fertig. */
  async function mitFrist(p: Promise<unknown>, ms: number): Promise<boolean> {
    let frist: ReturnType<typeof setTimeout> | null = null;
    const rechtzeitig = await Promise.race([
      p.then(
        () => true,
        () => true,
      ),
      new Promise<boolean>((resolve) => {
        frist = zeitgeber(ms, () => resolve(false));
      }),
    ]);
    if (frist !== null) clearTimeout(frist);
    return rechtzeitig;
  }

  function beenden(fristMs: number): Promise<void> {
    if (beendenVersprechen !== null) return beendenVersprechen;
    beendenVersprechen = (async () => {
      kopieAbbruch?.abort();
      d.log(`[zoom] Connect wird beendet (Frist ${fristMs} ms)`);
      // Spec 6.1: richteEin bricht nach der laufenden Datei ab und löscht <ziel>.teil selbst. Ohne dieses
      // Warten endet der Prozess vorher (before-quit ruft danach app.quit()) und .teil bliebe liegen.
      if (kopieLauf !== null && !(await mitFrist(kopieLauf, fristMs))) d.log('[zoom] SDK-Kopie nicht rechtzeitig abgebrochen');
      abbildGeaendert();
    })();
    return beendenVersprechen;
  }

  // ── Start ────────────────────────────────────────────────────────────────
  bestimmeMaengel();
  zustand = maengel.length ? 'einrichtung' : 'bereit';
  d.log(`[zoom] Zoom-Kern bereit: ${zustand}${maengel.length ? ` (Mängel: ${maengel.join(', ')})` : ''}`);
  letzteKurz = JSON.stringify(kurz());

  return {
    abbild,
    kurz,
    stateKv: () => stateKvAus(kurz()),
    laeuft,
    einrichtungSperre,
    sdkWaehlen,
    zugangWaehlen,
    zugangLoeschen,
    versatz,
    schliessen,
    meldungWeg,
    gastLabelsGeaendert: () => abbildGeaendert(),
    beenden,
  };
}
```

- [ ] **Step 4: Test laufen lassen (grün)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: keine `FAIL`-Zeile, letzte Zeile
```
63 ok, 0 fehlgeschlagen, 0 übersprungen.
```
Exit-Code 0 (unter Linux dieselbe Zahl; Aufgabe 10 hat keinen Windows-Fall). Meldet tsx `SyntaxError: The requested module '../src/shared/zoom-text' does not provide an export named 'stateKvAus'` oder fehlt ein `KT`-Schlüssel, fehlt Aufgabe 5 bzw. 6 — dann anhalten, nicht am Kern drehen.

- [ ] **Step 5: Selbsttest-Skript erweitern**

In `apps/connect/package.json` (Skript `selftest`, Stand nach Aufgabe 9):

Vorher:
```
"selftest": "tsx test/zoom-text.test.ts && tsx test/zoom-laufzeit.test.ts && tsx test/zoom-teile.test.ts"
```

Nachher:
```
"selftest": "tsx test/zoom-text.test.ts && tsx test/zoom-laufzeit.test.ts && tsx test/zoom-teile.test.ts && tsx test/zoom-kern.test.ts"
```

- [ ] **Step 6: Selbsttest und Typcheck**

```
npm run selftest -w @jm/connect
npm run typecheck -w @jm/connect
```
Erwartet: Selbsttest Exit-Code 0, die letzte Zeile ist die aus Step 4; Typcheck (`typecheck:node` und `typecheck:web`) ohne Fehlermeldung, Exit-Code 0. `tsconfig.node.json` nimmt seit Aufgabe 5 `test/**/*.ts` mit, die Testdatei wird also mitgeprüft.

- [ ] **Step 7: Commit**

```
git add apps/connect/src/main/zoom/kern.ts apps/connect/test/zoom-kern.test.ts apps/connect/package.json
git status --short
```
Die gestagten Zeilen müssen genau diese sein:
```
M  apps/connect/package.json
A  apps/connect/src/main/zoom/kern.ts
A  apps/connect/test/zoom-kern.test.ts
```
```
git commit -m "feat(connect): Zoom-Kern - Einrichtung, Maengel, Sperre und Abbild-Drossel (Stage 4a)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Nicht pushen (G13).

**Gegenprobe (beim Planen am Prototyp gemessen, kein Umsetzungsschritt):** Jede dieser absichtlichen Abweichungen macht mindestens eine Prüfung rot: Sperre ohne Kopie-Prüfung (`einrichtung` ohne `kopie === null`) → Review Focus 4 (vier `FAIL`, der Lauf endet zusätzlich mit Exit-Code 13, weil die zweite Kopie nie fertig wird); `onAbbild` bei jeder Änderung statt gedrosselt → „… höchstens 3 Abbilder in 250 ms“. `onKurz` nur gedrosselt bzw. gar nicht → erst die Zustandsfolgen ab Aufgabe 12 (Fall 2, 9b, Review Focus 2). `beenden` wartet nicht auf die Kopie (die Zeile `if (kopieLauf !== null && !(await mitFrist(kopieLauf, fristMs))) …` entfernt; am nachgespielten Stand nach Aufgabe 10 gemessen) → vier `FAIL`: „beenden während der Kopie: Signal abgebrochen, wartet auf das Ende der Kopie (Spec 6.1)“, „Kopie hängt → beenden kehrt nach der Frist (300 ms) zurück, …“, „Review Focus 3: beenden kehrt erst zurück, wenn richteEin sein Ergebnis geliefert hat“ und „… <ziel>.teil ist gelöscht“.

**Abweichungen vom Gerüst:**
- `Probe` hat zusätzlich `ordner: string` (der Laufzeit-Ordner, den die Vorgabe von `pruefe` meldet); Fall 4 (Aufgabe 11) braucht ihn für die PATH-Prüfung. Dazu die Testhilfen `cmds`, `folge`, `ok`, `text`. `aufraeumen()` stoppt zusätzlich jede Bridge, die die Fabrik gebaut hat (die Fabrik merkt sie sich): Bis Aufgabe 13 stoppt `beenden()` keine Bridge, und kein Fall darf Kindprozesse zurücklassen. Die Gesamtwache (180 s) macht einen hängenden Fall rot, statt den Lauf nie enden zu lassen.
- Aufgabe 10 importiert aus Aufgabe 9 nur `zaehleQuellen` und `SollListe`, nicht `baueTeilnehmer`/`sollAbbild`: Teilnehmer und Soll-Liste bleiben laut Gerüst „hier noch leer“; Aufgabe 12 bzw. 15 importieren sie mit ihrer ersten Nutzung.
- `schliessen()` ist schon hier vollständig (Z2 und Z13, 6.8). Aufgabe 13 ändert daran nichts mehr und belegt nur den Z13-Weg (Fall 19).
- `beenden(fristMs)` nennt die Frist in seiner Logzeile. In Teil 1 gilt sie für das Warten auf die abgebrochene Kopie (`kopieLauf`), in Teil 2 (Aufgabe 13) zusätzlich für die Bridge. Kopie und Bridge laufen nie gleichzeitig (Sperre S10: die Kopie läuft nur aus Z1a/Z2/Z13 heraus, Beitritt und Prüfung nur aus `bereit`/`fehler`), darum wartet `beenden` insgesamt höchstens `fristMs`.
- Das Gerüst ließ `beenden` ausdrücklich **nicht** auf die Kopie warten. Das hält Spec 6.1 („bricht sie ab und `.teil` wird gelöscht“) nicht ein: `before-quit` ruft nach `zoomBeenden` sofort `app.quit()`, die laufende `copyFile` und das Löschen in `richteEin` kämen nicht mehr dran. Jetzt wartet `beenden` auf das Ergebnis von `richteEin` (höchstens `fristMs`, danach Logzeile `[zoom] SDK-Kopie nicht rechtzeitig abgebrochen`, L24). Review Focus 3 ist darum hier im Zusammenspiel mit dem echten `richteEin` belegt; Aufgabe 7 belegt nur `richteEin` allein.
- `einrichtung.sdk.text` nutzt `mangelText` (S9 mit Datei bzw. S8), damit Karte und Beitritts-Ablehnung denselben Text zeigen.

---

### Task 11: Kern: Startfolge, Generationen (6.9), „Einrichtung prüfen“

**Spec:** 5.2 (Prozessmodell, Aufruf `new Bridge({...})`, `kindPfad`/`pfadVarianten`), 5.7 (JWT, Client-ID/Secret nie beim Kind), 6.1 „Einrichtung prüfen“, 6.2 Startfolge S-a bis S-f, 6.7 (bestätigter Versatz), 6.9 (Generationsregel), 8.2 (B1–B18), 8.7 (Log-Regeln, Maskierung); Tests 12.2 Fall 4, 6, 7, 24, 24b, 28. Global Constraints G1, G3, G5, G8, G9, G10, G13, G14, G15.

**Files:**
- Modify: `apps/connect/src/main/zoom/kern.ts` (Stand nach Aufgabe 10), Zeilen 17–18 (Importe der Bridge und der Fassung), 30 (Importe der Klartexte), 31–32 (Importe der Laufzeit), 105–106 (Schnittstelle: pruefen()), 112–119 (Ereignistypen und Startbeobachter), 123 (Fabrik und Umgebung), 150 (Zustand des Bridge-Lebenslaufs), 157 (aktiveSitzung()), 188 (bestätigter Versatz aus der Sitzung), 226–228 (melde()), 245 (mangelFolgen()), 362 (laeuft() kennt die Bridge), 365 (Bridge starten und stoppen, Einrichtung prüfen), 410–411 (pruefen in der öffentlichen Fläche)
- Modify: `apps/connect/test/zoom-kern.test.ts` (Stand nach Aufgabe 10), Zeile 558 (Ankerzeile; der neue Block kommt davor)

Zeilenangaben gelten für den Stand vor dieser Aufgabe; nach früheren Steps derselben Aufgabe verschieben sie sich. Maßgeblich ist immer der wortgleiche Vorher-Text (Edit-Werkzeug, G14).

**Interfaces:**
- Consumes:
  - Aufgabe 10 (`kern.ts`, Closure): `zustand`, `maengel`, `laufzeitStand`, `zugang`, `pruefungLaeuft`, `meldung`, `nummer`, `kenncode`, `warImMeeting`, `soll`, `quellen: Map<number, QuelleIntern>`, `beendenVersprechen`; `kurz()`, `abbild()`, `abbildGeaendert()`, `setzeZustand(z)`, `bestimmeMaengel(neu?: LaufzeitPruefung)`, `mangelDatei()`, `zeitgeber(ms, fn)`; Testgerüst (`baueKern`, `Probe`, `bis`, `cmds`, `text`, `ok`, `ueberspringe`).
  - Aufgabe 8 (`laufzeit.ts`): `export const BRIDGE_EXE = 'zoom-bridge.exe';`, `export function kindPfad(env: Record<string, string | undefined>, ordner: string): string;`, `export function pfadVarianten(env: Record<string, string | undefined>): string[];`.
  - Aufgabe 6 (`klartext.ts`): `export interface Meldungstext { text: string; detail: string | null }`, `authMeldung(code: number): Meldungstext`, `dllMeldung(exitCode: number | null): Meldungstext | null`, `exitCodeAus(detail: string | undefined): number | null`, `spawnMeldung(code: string | undefined): Meldungstext`, `fehlerDetail(e: { name?: string; code: number | string }): string`, `maskiere(zeile: string, werte: ReadonlyArray<string>): string`, `KT.B6(detail)`, `KT.B7(x)`, `KT.B8(name)`, `KT.B8_14`, `KT.B16`, `KT.B18(name)`, `KT.Q7`, `KT.PRUEFUNG_OK`.
  - Aufgabe 3 (Attrappe): `FAKE_SDK_FASSUNG`, `FAKE_NDI_FEHLER=1`, `FAKE_AUTH_CODE`, `FAKE_AUTH_SOFORTFEHLER`, `FAKE_INIT_FEHLER=1`, `FAKE_SOFORT_ENDE`, Drehbuch `envprobe` (Ereignis `{ ev: 'envprobe', seen: Record<string, boolean>, path: string | undefined }`, `ENV_PROBE_NAMES`), Drehbuch `stuck` (meldet `ready` mit `'7.1.5 (attrappe)'`, reagiert auf nichts).
  - Bridge (`@jm/zoom-bridge`): `Bridge` (Wert, Vorgabe-Fabrik), `buildJwt(opts: { clientId; clientSecret; ttlSeconds? }): string`, `type BridgeEvent`, `type Command`, `type Session` (`session.videoDelayMs: number | null`); `type AudioReason`, `type AudioState`, `type VideoReason`, `type VideoState` aus `@jm/zoom-bridge/protocol`; `SDK_FASSUNG_BRIDGE = '7.1.5 (43953)'` aus `@jm/zoom-bridge/sdk`. `Bridge.stop()` liefert `-1`, wenn es hart beenden musste; ein zweiter gleichzeitiger `stop()` bekommt dasselbe Versprechen.
- Produces:
  ```ts
  export interface ZoomKern { /* … Aufgabe 10 … */ pruefen(): Promise<ZoomErgebnis> }
  // intern (Closure von erzeugeZoomKern), für 12–15 verbindlich:
  type FehlerEreignis = { ev: 'error'; where: string; code: number | string; id?: number; dropped?: number; detail?: string; name?: string };
  type VideoEreignis = { ev: 'video'; id: number; state: VideoState; source: string; reason: VideoReason; rebindable: boolean };
  type AudioEreignis = { ev: 'audio'; id: number; state: AudioState; reason: AudioReason };
  type StartErgebnis = { ok: true; bridge: BridgeArt; gen: number } | { ok: false; meldung: Meldungstext; mangel: ZoomMangel | null };
  let aktiveBridge: BridgeArt | null; let aktiveGen: number; const imAbbau: Set<number>; const stopps: Map<number, Promise<void>>;
  let laufNr: number;            // verlassen/beenden zählen hoch → eine ältere Startfolge verwirft ihr Ergebnis
  function aktiveSitzung(): Session | null;   // Sitzung der aktiven Bridge, null im Abbau
  function melde(art: 'info' | 'warnung' | 'fehler', m: Meldungstext): void;
  function mangelFolgen(): void;               // 5.3: Soll-Liste, Nummer, Kenncode, Merker leeren
  function sende(cmd: Command): boolean;       // nur an die aktive Bridge, nie mit Inhalt ins Log
  function starteBridge(): Promise<StartErgebnis>;
  function stoppeBridge(): Promise<void>;      // je Generation genau ein stop(), danach Quellen der Generation weg
  function beiEreignis(gen: number, ev: BridgeEvent): void;
  ```

**Verhalten (verbindlich, aus der Spec):**
- **Höchstens eine Bridge** (5.2): `starteBridge()` wartet zuerst auf jeden laufenden `stop()` (`stopps`). Abbruch, wenn `laufNr` sich inzwischen geändert hat oder `beenden` lief: Ergebnis „abgebrochen“ = `{ ok: false, meldung: { text: '', detail: null }, mangel: null }`.
- **S-a/S-b:** `pruefe(d.pfade)` und `bestimmeMaengel(…)`. Mangel → `{ ok: false, meldung: { text: mangelText(m, datei), detail: null }, mangel: m }` ohne Bridge (Zugang fehlt → B17, unlesbar → A5).
- **S-c:** Generation = `aktiveGen + 1`, `startNr + 1`; Fabrik-Aufruf mit `exePath: join(ordner, 'zoom-bridge.exe')`, `env: { PATH: kindPfad(env, ordner) }`, `envRemove: ['ZOOM_SDK_CLIENT_ID', 'ZOOM_SDK_CLIENT_SECRET', 'ZOOM_SDK_CREDENTIALS', ...pfadVarianten(env)]`, `joinTimeoutMs`, `killTimeoutMs`, `onEvent: (ev) => beiEreignis(gen, ev)`, `onLog: beiLog`. `start()` wirft → `spawnMeldung(err.code)` (B1/B2).
- **S-d:** `init`, `auth { jwt: buildJwt({ clientId, clientSecret, ttlSeconds: JWT_GUELTIG_S }) }`, `videoDelay { ms }` mit dem gespeicherten Versatz (außerhalb 0–1000 → 0). `send` darf werfen, wenn die Bridge schon tot ist; dann entscheidet ihr `exit`-Ereignis.
- **S-e/S-f** (Startbeobachter, es zählt das **erste** entscheidende Ereignis): `ready` mit `sdkVersion !== SDK_FASSUNG_BRIDGE` → B7; `error where:'ndi'` → Q7; `error where:'auth'` → B18(name) sofort; `error where:'init'` → B8(name), Code 14 → B8_14; `error where:'exit'` → `dllMeldung(exitCodeAus(detail))` sonst B6(detail); `auth` 0 → ok, sonst `authMeldung(code)`; nichts bis `anmeldeMs` → B16. Bei jedem Fehler sofort `stoppeBridge()`; `starteBridge` kehrt erst zurück, wenn der `stop()` fertig ist (danach `laeuft() === false`).
- **6.9:** `beiEreignis(gen, ev)`: Fehler-Ereignisse kommen immer ins Log (`[zoom] Fehler where=… code=… name=…`, im Abbau mit `(Abbau) `). Ist `gen` nicht die aktive Generation oder im Abbau: `video … unsubscribed` nimmt die Quelle dieser Generation aus dem Abbild, `audio … off` setzt ihren Ton auf `off`, alles andere nur ins Log (`[zoom] (Abbau) <Kurzbeschreibung>`). `stoppeBridge()` markiert die Generation **beim Aufruf** als im Abbau, beendet einen laufenden Startbeobachter mit „abgebrochen“, ruft `stop()` genau einmal je Generation, loggt `-1` als `[zoom] Zoom-Bridge hart beendet`, sonst `[zoom] Zoom-Bridge beendet (Rückgabewert <n>)`, und verwirft danach alle Quellen dieser Generation.
- **Maskierung (8.7, L8):** jede `onLog`-Zeile → `[zoom-bridge] ` + `maskiere(zeile, [kenncode, nummer.eingabe, nummer.normiert, jwt])`; `maskiere` übergeht leere Werte.
- `pruefen()`: nur in `bereit` ohne laufende Prüfung (sonst `{ ok: false, text: '' }`, L9). `pruefungLaeuft: true`, `meldung: null`, Zustand bleibt `bereit`. Startfolge ohne `join`; Erfolg → `stoppeBridge()` und `meldung { art: 'info', text: KT.PRUEFUNG_OK, detail: null }`, `{ ok: true }`; Fehler → `meldung { art: 'fehler', text, detail }`, `{ ok: false, text }`; Mangel → `mangelFolgen()`, Zustand `einrichtung`. Danach `pruefungLaeuft: false`.
- `abbild().versatz.bestaetigtMs` = `session.videoDelayMs` der aktiven Bridge, sonst `null`. `laeuft()` = Kopie, Prüfung, aktive Bridge oder laufender `stop()`.

- [ ] **Step 1: Fehlschlagende Tests schreiben (Fall 4, 6, 7, 24, 24b, 28, B8, B9, S9, stuck)**

In `apps/connect/test/zoom-kern.test.ts` direkt über der Ankerzeile einfügen.

Vorher:
```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

Nachher:
```ts
// ── Aufgabe 11: Startfolge, Generationen, „Einrichtung prüfen“ ──────────────
console.log('— Einrichtung prüfen (Fall 24, 28), Startfolge S-d');
{
  const p = baueKern({ versatzMs: 120 });
  const lauf = p.kern.pruefen();
  ck('Fall 24: während der Prüfung Zustand bereit, pruefungLaeuft, laeuft()',
    p.kern.kurz().zustand === 'bereit' && p.kern.abbild().pruefungLaeuft && p.kern.laeuft());
  ck('… zweiter Aufruf während der Prüfung → ok:false ohne Text', text(await p.kern.pruefen()) === '');
  ck('… Einrichtung währenddessen gesperrt (S10)', text(p.kern.einrichtungSperre()) === KT.S10);
  const r = await lauf;
  const m = p.kern.abbild().meldung;
  ck('Fall 24: Ergebnis ok, Meldung info mit „7.1.5“', ok(r) && m?.art === 'info' && m.text === KT.PRUEFUNG_OK && m.text.includes('7.1.5'));
  ck('… danach bereit, keine Prüfung, keine Bridge', p.kern.kurz().zustand === 'bereit' && !p.kern.abbild().pruefungLaeuft && !p.kern.laeuft());
  ck('… der Zustand war durchgehend bereit', p.kurze.every((k) => k.zustand === 'bereit'));
  ck('… Befehle init, auth, videoDelay, quit — kein join', cmds(p, 1).join(',') === 'init,auth,videoDelay,quit');
  const c = p.befehle(1);
  ck('… videoDelay mit dem gespeicherten Versatz (120)', c[2].ms === 120);
  const teile = String(c[1].jwt ?? '').split('.');
  const nutzlast = teile.length === 3 ? (JSON.parse(Buffer.from(teile[1], 'base64url').toString('utf8')) as { iat: number; exp: number }) : null;
  ck('… JWT gilt 12 h (JWT_GUELTIG_S)', nutzlast !== null && nutzlast.exp - nutzlast.iat === 43_200);
  ck('… das JWT steht nirgends im Log', !p.logs.some((z) => z.includes(String(c[1].jwt))));
  ck('6.9: Ereignisse der gestoppten Bridge stehen nur im Log', p.logs.includes('[zoom] (Abbau) bye'));
  p.kern.meldungWeg();
  ck('Fall 28: meldungWeg → Meldung weg, Zustand bereit', p.kern.abbild().meldung === null && p.kern.kurz().zustand === 'bereit');
  await p.aufraeumen();
}
{
  const p = baueKern({ versatzMs: 2000 });
  await p.kern.pruefen();
  ck('gespeicherter Versatz außerhalb 0–1000 → videoDelay 0', p.befehle(1)[2]?.cmd === 'videoDelay' && p.befehle(1)[2]?.ms === 0);
  await p.aufraeumen();
}

console.log('— Startfolge: Fehler (Fall 24b, 7, 6, B9, S9) und Umgebung (Fall 4)');
{
  const p = baueKern({ stell: () => ({ FAKE_AUTH_SOFORTFEHLER: '3' }) });
  const t0 = Date.now();
  const r = await p.kern.pruefen();
  ck('Fall 24b: Sofortfehler der Anmeldung → B18 binnen 1 s (nicht B16)',
    text(r) === KT.B18('SDKERR_INVALID_PARAMETER') && Date.now() - t0 < 1000);
  ck('… Meldung fehler, Zustand bereit, Bridge beendet',
    p.kern.abbild().meldung?.art === 'fehler' && p.kern.kurz().zustand === 'bereit' && !p.kern.laeuft());
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_NDI_FEHLER: '1' }) });
  const r = await p.kern.pruefen();
  ck('Fall 24b: ndiInitFailed → Q7, nicht „Einrichtung in Ordnung“', text(r) === KT.Q7 && p.kern.abbild().meldung?.text === KT.Q7);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_SDK_FASSUNG: '7.1.6 (99999)' }) });
  const r = await p.kern.pruefen();
  ck('Fall 7: falsche SDK-Fassung → B7', text(r) === KT.B7('7.1.6 (99999)'));
  ck('… Bridge gestoppt, kein join', !p.kern.laeuft() && !cmds(p).includes('join'));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_AUTH_CODE: '2' }) });
  const r = await p.kern.pruefen();
  ck('Anmeldung abgelehnt (Code 2) → B9 mit AUTHRET_KEYORSECRETWRONG', text(r) === KT.B9('AUTHRET_KEYORSECRETWRONG'));
  ck('… detail AUTHRET_KEYORSECRETWRONG (2)', p.kern.abbild().meldung?.detail === 'AUTHRET_KEYORSECRETWRONG (2)');
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_INIT_FEHLER: '1' }) });
  const r = await p.kern.pruefen();
  ck('init scheitert → B8 (der spätere auth-Fehler ändert nichts)', text(r) === KT.B8('SDKERR_WRONG_USAGE'));
  ck('… der spätere Fehler steht nur als (Abbau) im Log', p.logs.some((z) => z.startsWith('[zoom] (Abbau) Fehler where=auth')));
  await p.aufraeumen();
}
{
  let n = 0;
  const p = baueKern({
    laufzeit: { pruefe: () => (++n === 1 ? { ok: true, ordner: 'C:/laufzeit', ersetzt: [] } : { ok: false, mangel: 'sdk_defekt', datei: 'sdk.dll' }) },
  });
  const r = await p.kern.pruefen();
  ck('Laufzeit vor dem Start defekt → S9, Zustand einrichtung', text(r) === KT.S9('sdk.dll') && p.kern.kurz().zustand === 'einrichtung'
    && JSON.stringify(p.kern.kurz().maengel) === '["sdk_defekt"]');
  ck('… Meldung S9 im Abbild, keine Bridge gestartet', p.kern.abbild().meldung?.text === KT.S9('sdk.dll') && p.starts() === 0);
  await p.aufraeumen();
}
{
  const p = baueKern({ skript: 'stuck', fristen: { killTimeoutMs: 300 } });
  const r = await p.kern.pruefen();
  ck('Drehbuch stuck meldet „7.1.5 (attrappe)“ → B7', text(r) === KT.B7('7.1.5 (attrappe)'));
  ck('… stop() endet per Kill → Log „Zoom-Bridge hart beendet“', p.logs.includes('[zoom] Zoom-Bridge hart beendet') && !p.kern.laeuft());
  await p.aufraeumen();
}
{
  process.env.ZOOM_SDK_CLIENT_SECRET = 'PROBE-SECRET-AUS-DER-UMGEBUNG';
  const geerbt = process.env.PATH ?? '';
  const p = baueKern({
    skript: 'envprobe',
    stell: () => ({ ENV_PROBE_NAMES: 'ZOOM_SDK_CLIENT_ID,ZOOM_SDK_CLIENT_SECRET,ZOOM_SDK_CREDENTIALS' }),
    fristen: { anmeldeMs: 500 },
  });
  const r = await p.kern.pruefen();
  delete process.env.ZOOM_SDK_CLIENT_SECRET;
  const probe = p.ereignisse.find((x) => x.ev.ev === 'envprobe')?.ev as unknown as { seen: Record<string, boolean>; path?: string } | undefined;
  ck('Fall 4: die Attrappe hat ihre Umgebung gemeldet', probe !== undefined);
  ck('… keine der drei ZOOM_SDK_*-Variablen beim Kind',
    probe !== undefined && Object.keys(probe.seen).length === 3 && Object.values(probe.seen).every((v) => v === false));
  const pfad = probe?.path ?? '';
  const i = pfad.indexOf(p.ordner);
  ck('… PATH: Laufzeit-Ordner vor dem geerbten Wert, geerbter Wert vollständig', i >= 0 && pfad.indexOf(geerbt, i + p.ordner.length) > i);
  ck('… ohne Antwort auf die Anmeldung → B16', text(r) === KT.B16);
  await p.aufraeumen();
}
if (process.platform === 'win32') {
  const p = baueKern({ stell: () => ({ FAKE_SOFORT_ENDE: '0xC0000135' }) });
  const r = await p.kern.pruefen();
  ck('Fall 6: DLL-Tod beim Start → B3', text(r) === KT.B3);
  ck('… nennt nicht die Zugangsdaten als Ursache', !String(text(r)).includes('Client-ID oder Client-Secret stimmen nicht'));
  ck('… Bridge abgebaut', !p.kern.laeuft());
  await p.aufraeumen();
} else {
  ueberspringe('Fall 6: DLL-Tod beim Start → B3');
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: die 62 Prüfungen aus Aufgabe 10 `ok`, danach Abbruch mit
```
TypeError: p.kern.pruefen is not a function
```
Exit-Code 1.

- [ ] **Step 3: Importe ergänzen**

In `apps/connect/src/main/zoom/kern.ts`:

Vorher:
```ts
import { readCredentials, type Bridge, type BridgeOptions } from '@jm/zoom-bridge';
import { SDK_FASSUNG } from '@jm/zoom-bridge/sdk';
```

Nachher:
```ts
import { join } from 'node:path';
import {
  Bridge,
  buildJwt,
  readCredentials,
  type BridgeEvent,
  type BridgeOptions,
  type Command,
  type Session,
} from '@jm/zoom-bridge';
import type { AudioReason, AudioState, VideoReason, VideoState } from '@jm/zoom-bridge/protocol';
import { SDK_FASSUNG, SDK_FASSUNG_BRIDGE } from '@jm/zoom-bridge/sdk';
```

Und:

Vorher:
```ts
import { KT, mangelText } from './klartext';
```

Nachher:
```ts
import {
  KT,
  authMeldung,
  dllMeldung,
  exitCodeAus,
  fehlerDetail,
  mangelText,
  maskiere,
  spawnMeldung,
  type Meldungstext,
} from './klartext';
```

Und:

Vorher:
```ts
import {
  pruefeLaufzeit,
```

Nachher:
```ts
import {
  BRIDGE_EXE,
  kindPfad,
  pfadVarianten,
  pruefeLaufzeit,
```

- [ ] **Step 4: Schnittstelle und interne Typen**

Vorher:
```ts
  versatz(e: { ms: number }): ZoomErgebnis;
  schliessen(): void;
```

Nachher:
```ts
  versatz(e: { ms: number }): ZoomErgebnis;
  pruefen(): Promise<ZoomErgebnis>;
  schliessen(): void;
```

Dann die Ereignistypen, den Startbeobachter und `beschreibe()`:

Vorher:
```ts
/** Eine Quelle samt der Generation der Bridge, die sie meldet (6.9). */
interface QuelleIntern extends ZoomQuelle { gen: number }

function zeitgeber(ms: number, fn: () => void): ReturnType<typeof setTimeout> {
  const t = setTimeout(fn, ms);
  t.unref?.();
  return t;
}
```

Nachher:
```ts
type FehlerEreignis = { ev: 'error'; where: string; code: number | string; id?: number; dropped?: number; detail?: string; name?: string };
type VideoEreignis = { ev: 'video'; id: number; state: VideoState; source: string; reason: VideoReason; rebindable: boolean };
type AudioEreignis = { ev: 'audio'; id: number; state: AudioState; reason: AudioReason };
/** Eine Quelle samt der Generation der Bridge, die sie meldet (6.9). */
interface QuelleIntern extends ZoomQuelle { gen: number }
type StartErgebnis = { ok: true; bridge: BridgeArt; gen: number } | { ok: false; meldung: Meldungstext; mangel: ZoomMangel | null };
type StartAusgang = { ok: true } | { ok: false; meldung: Meldungstext };
interface StartBeobachter { gen: number; erledigt: boolean; ende(e: StartAusgang): void }

const ABGEBROCHEN: Meldungstext = { text: '', detail: null };

function zeitgeber(ms: number, fn: () => void): ReturnType<typeof setTimeout> {
  const t = setTimeout(fn, ms);
  t.unref?.();
  return t;
}

/** Kurzbeschreibung eines Ereignisses fürs Log — nie mit Nummer, Kenncode oder JWT (die stehen in keinem Ereignis). */
function beschreibe(ev: BridgeEvent): string {
  const e = ev as unknown as Record<string, unknown>;
  switch (ev.ev) {
    case 'status':
      return `status ${String(e.status)} (Code ${String(e.code)})`;
    case 'video':
    case 'audio':
      return `${ev.ev} ${String(e.id)} ${String(e.state)} (${String(e.reason)})`;
    case 'privilege':
      return `privilege canRecordRaw=${String(e.canRecordRaw)} source=${String(e.source)}`;
    default:
      return ev.ev;
  }
}
```

- [ ] **Step 5: Fabrik, Umgebung und Zustand des Bridge-Lebenslaufs**

Vorher:
```ts
  const lz: LaufzeitDienste = { pruefe: pruefeLaufzeit, pruefeOrdner: pruefeSdkOrdner, richteEin, ...d.laufzeit };
```

Nachher:
```ts
  const lz: LaufzeitDienste = { pruefe: pruefeLaufzeit, pruefeOrdner: pruefeSdkOrdner, richteEin, ...d.laufzeit };
  const fabrik: BridgeFabrik = d.bridgeFabrik ?? ((o) => new Bridge(o));
  const env = d.env ?? process.env;
```

Und:

Vorher:
```ts
  let beendenVersprechen: Promise<void> | null = null;
```

Nachher:
```ts
  let beendenVersprechen: Promise<void> | null = null;

  // ── Bridge-Lebenslauf (Spec 5.2, 6.9) ────────────────────────────────────
  let aktiveBridge: BridgeArt | null = null;
  let aktiveGen = 0;
  const imAbbau = new Set<number>();
  const stopps = new Map<number, Promise<void>>();
  let startNr = 0;
  /** Jeder Abbruch (Verlassen, Beenden) zählt hoch; eine ältere Startfolge verwirft ihr Ergebnis. */
  let laufNr = 0;
  let jwt: string | null = null;
  let startBeob: StartBeobachter | null = null;
```

- [ ] **Step 6: Abbild, Meldung, Mängelfolgen, `laeuft()`**

Vorher:
```ts
  function kurz(): ZoomKurz {
```

Nachher:
```ts
  function aktiveSitzung(): Session | null {
    return aktiveBridge !== null && !imAbbau.has(aktiveGen) ? aktiveBridge.session : null;
  }

  function kurz(): ZoomKurz {
```

Und:

Vorher:
```ts
      versatz: { gewuenschtMs: d.einstellungen.versatzMs(), bestaetigtMs: null },
```

Nachher:
```ts
      versatz: { gewuenschtMs: d.einstellungen.versatzMs(), bestaetigtMs: aktiveSitzung()?.videoDelayMs ?? null },
```

Und:

Vorher:
```ts
    if (z !== 'warteraum') warten = null;
    abbildGeaendert();
  }
```

Nachher:
```ts
    if (z !== 'warteraum') warten = null;
    abbildGeaendert();
  }

  function melde(art: 'info' | 'warnung' | 'fehler', m: Meldungstext): void {
    meldung = { art, text: m.text, detail: m.detail };
    d.log(`[zoom] Meldung (${art}): ${m.text}${m.detail ? ` [${m.detail}]` : ''}`);
  }
```

Und:

Vorher:
```ts
  function einrichtungSperre(): ZoomErgebnis {
```

Nachher:
```ts
  /** Spec 5.3: Ein Mangel leert Soll-Liste, Nummer und Kenncode. */
  function mangelFolgen(): void {
    soll.clear();
    nummer = null;
    kenncode = null;
    warImMeeting = false;
  }

  function einrichtungSperre(): ZoomErgebnis {
```

Und:

Vorher:
```ts
    return kopie !== null || pruefungLaeuft;
```

Nachher:
```ts
    return kopie !== null || pruefungLaeuft || aktiveBridge !== null || stopps.size > 0;
```

- [ ] **Step 7: Bridge starten und stoppen, Ereignisse, „Einrichtung prüfen“**

Der neue Abschnitt kommt direkt vor den Abschnitt „Beenden“:

Vorher:
```ts
  // ── Beenden (Spec 6.6) ───────────────────────────────────────────────────
```

Nachher:
```ts
  // ── Bridge starten und stoppen (Spec 5.2, 6.2 Startfolge, 6.9) ───────────
  function geheimnisse(): string[] {
    return [kenncode ?? '', nummer?.eingabe ?? '', nummer?.normiert ?? '', jwt ?? ''];
  }

  function beiLog(zeile: string): void {
    d.log(`[zoom-bridge] ${maskiere(zeile, geheimnisse())}`);
  }

  /** Sendet an die aktive Bridge (nicht im Abbau). Nie den Inhalt loggen: join trägt Nummer und Kenncode. */
  function sende(cmd: Command): boolean {
    if (aktiveBridge === null || imAbbau.has(aktiveGen)) return false;
    try {
      aktiveBridge.send(cmd);
      return true;
    } catch (e) {
      d.log(`[zoom] Befehl ${cmd.cmd} nicht gesendet: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }

  function stoppeBridge(): Promise<void> {
    const b = aktiveBridge;
    const gen = aktiveGen;
    if (b === null) return Promise.resolve();
    const laufend = stopps.get(gen);
    if (laufend) return laufend;
    imAbbau.add(gen);
    if (startBeob !== null && startBeob.gen === gen) startBeob.ende({ ok: false, meldung: ABGEBROCHEN });
    d.log(`[zoom] Zoom-Bridge ${gen} wird beendet`);
    const p = b
      .stop()
      .then(
        (code) => d.log(code === -1 ? '[zoom] Zoom-Bridge hart beendet' : `[zoom] Zoom-Bridge beendet (Rückgabewert ${code})`),
        (e: unknown) => d.log(`[zoom] Zoom-Bridge ließ sich nicht beenden: ${e instanceof Error ? e.message : String(e)}`),
      )
      .then(() => {
        // 6.9: Kehrt stop() zurück, gehören die Quellen dieser Generation nicht mehr zum Abbild.
        for (const [id, q] of quellen) if (q.gen === gen) quellen.delete(id);
        stopps.delete(gen);
        if (aktiveBridge === b) {
          aktiveBridge = null;
          jwt = null;
        }
        abbildGeaendert();
      });
    stopps.set(gen, p);
    return p;
  }

  function startBewerten(beob: StartBeobachter, ev: BridgeEvent): void {
    if (beob.erledigt) return;
    if (ev.ev === 'ready') {
      const v = String((ev as { sdkVersion?: unknown }).sdkVersion);
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
  }

  /** Spec 6.2 Startfolge S-a bis S-f. Setzt keinen Zustand; jeder Fehler stoppt die Bridge. */
  async function starteBridge(): Promise<StartErgebnis> {
    const lauf = laufNr;
    const abgebrochen: StartErgebnis = { ok: false, meldung: ABGEBROCHEN, mangel: null };
    if (stopps.size > 0) await Promise.all([...stopps.values()]);
    if (lauf !== laufNr || beendenVersprechen !== null) return abgebrochen;
    // S-a, S-b
    const lzErg = lz.pruefe(d.pfade);
    bestimmeMaengel(lzErg);
    if (!lzErg.ok) {
      return { ok: false, meldung: { text: mangelText(lzErg.mangel, mangelDatei()), detail: null }, mangel: lzErg.mangel };
    }
    const daten = zugang.daten;
    if (!daten) {
      const m: ZoomMangel = zugang.unlesbar ? 'zugang_unlesbar' : 'zugang_fehlt';
      return { ok: false, meldung: { text: mangelText(m, null), detail: null }, mangel: m };
    }
    // S-c
    const gen = aktiveGen + 1;
    startNr += 1;
    const ordner = lzErg.ordner;
    const bridge = fabrik(
      {
        exePath: join(ordner, BRIDGE_EXE),
        // PATH immer selbst setzen, INKLUSIVE des geerbten Werts (Falle 3.2-4), und jede andere
        // Schreibweise von PATH entfernen (bridge.ts mischt process.env als einfaches Objekt).
        env: { PATH: kindPfad(env, ordner) },
        envRemove: ['ZOOM_SDK_CLIENT_ID', 'ZOOM_SDK_CLIENT_SECRET', 'ZOOM_SDK_CREDENTIALS', ...pfadVarianten(env)],
        joinTimeoutMs: f.joinTimeoutMs,
        killTimeoutMs: f.killTimeoutMs,
        onEvent: (ev) => beiEreignis(gen, ev),
        onLog: beiLog,
      },
      startNr,
    );
    aktiveBridge = bridge;
    aktiveGen = gen;
    d.log(`[zoom] Zoom-Bridge ${gen} startet`);
    let anmeldeFrist: ReturnType<typeof setTimeout> | null = null;
    const beob: StartBeobachter = { gen, erledigt: false, ende: () => {} };
    const ausgang = new Promise<StartAusgang>((resolve) => {
      beob.ende = (e) => {
        if (beob.erledigt) return;
        beob.erledigt = true;
        if (anmeldeFrist !== null) clearTimeout(anmeldeFrist);
        if (startBeob === beob) startBeob = null;
        // Es zählt der ERSTE Fehler: die Bridge ist ab hier im Abbau, spätere Ereignisse nur noch Log (6.9).
        if (!e.ok && e.meldung.text !== '') void stoppeBridge();
        resolve(e);
      };
    });
    startBeob = beob;
    try {
      await bridge.start();
    } catch (e) {
      beob.ende({ ok: false, meldung: spawnMeldung((e as { code?: string }).code) });
    }
    if (!beob.erledigt) {
      // S-d
      jwt = buildJwt({ clientId: daten.clientId, clientSecret: daten.clientSecret, ttlSeconds: JWT_GUELTIG_S });
      const v = d.einstellungen.versatzMs();
      const ms = Number.isInteger(v) && v >= 0 && v <= 1000 ? v : 0;
      try {
        bridge.send({ cmd: 'init' });
        bridge.send({ cmd: 'auth', jwt });
        bridge.send({ cmd: 'videoDelay', ms });
      } catch {
        // Bridge schon tot: ihr exit-Ereignis kam vorher und hat die Startfolge entschieden.
      }
      // S-f
      if (!beob.erledigt) anmeldeFrist = zeitgeber(f.anmeldeMs, () => beob.ende({ ok: false, meldung: { text: KT.B16, detail: null } }));
    }
    const a = await ausgang;
    if (!a.ok) {
      await stopps.get(gen);
      return lauf !== laufNr ? abgebrochen : { ok: false, meldung: a.meldung, mangel: null };
    }
    if (lauf !== laufNr) return abgebrochen;
    return { ok: true, bridge, gen };
  }

  /** Ereignisse einer Bridge im Abbau oder alter Generation (6.9): nur Quellen abbauen, sonst Log. */
  function abbauEreignis(gen: number, ev: BridgeEvent): void {
    if (ev.ev === 'video' && (ev as unknown as VideoEreignis).state === 'unsubscribed') {
      const id = (ev as unknown as VideoEreignis).id;
      if (quellen.get(id)?.gen === gen) quellen.delete(id);
      return;
    }
    if (ev.ev === 'audio' && (ev as unknown as AudioEreignis).state === 'off') {
      const a = ev as unknown as AudioEreignis;
      const q = quellen.get(a.id);
      if (q && q.gen === gen) {
        q.ton = 'off';
        q.tonGrund = a.reason;
      }
      return;
    }
    if (ev.ev !== 'error') d.log(`[zoom] (Abbau) ${beschreibe(ev)}`);
  }

  function beiEreignis(gen: number, ev: BridgeEvent): void {
    const aktiv = gen === aktiveGen && !imAbbau.has(gen);
    if (ev.ev === 'error') {
      const e = ev as unknown as FehlerEreignis;
      d.log(`[zoom] ${aktiv ? '' : '(Abbau) '}Fehler where=${e.where} code=${String(e.code)} name=${e.name ?? '-'}${e.detail ? ` (${e.detail})` : ''}`);
    }
    if (!aktiv) {
      abbauEreignis(gen, ev);
      abbildGeaendert();
      return;
    }
    if (startBeob !== null && startBeob.gen === gen) startBewerten(startBeob, ev);
    abbildGeaendert();
  }

  /** Spec 6.1 „Einrichtung prüfen“: Startfolge ohne join, Zustand bleibt bereit. */
  async function pruefen(): Promise<ZoomErgebnis> {
    if (zustand !== 'bereit' || pruefungLaeuft) return { ok: false, text: '' };
    const lauf = laufNr;
    pruefungLaeuft = true;
    meldung = null;
    d.log('[zoom] Einrichtung prüfen');
    abbildGeaendert();
    const r = await starteBridge();
    if (r.ok) await stoppeBridge();
    pruefungLaeuft = false;
    if (lauf !== laufNr) {
      abbildGeaendert();
      return { ok: false, text: '' };
    }
    if (r.ok) {
      melde('info', { text: KT.PRUEFUNG_OK, detail: null });
      abbildGeaendert();
      return { ok: true };
    }
    if (r.mangel !== null) mangelFolgen();
    melde('fehler', r.meldung);
    setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
    return { ok: false, text: r.meldung.text };
  }

  // ── Beenden (Spec 6.6) ───────────────────────────────────────────────────
```

- [ ] **Step 8: `pruefen` in die öffentliche Fläche**

Vorher:
```ts
    versatz,
    schliessen,
```

Nachher:
```ts
    versatz,
    pruefen,
    schliessen,
```

- [ ] **Step 9: Test laufen lassen (grün)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: keine `FAIL`-Zeile, letzte Zeile unter Windows
```
96 ok, 0 fehlgeschlagen, 0 übersprungen.
```
unter Linux (CI) `93 ok, 0 fehlgeschlagen, 1 übersprungen.` (Fall 6 nur unter Windows, Zeile `  --  Fall 6: DLL-Tod beim Start → B3 (übersprungen: nur unter Windows)`). Exit-Code 0. Lautet eine Meldung `B7` mit `7.1.5 (attrappe)` in Fällen mit dem Drehbuch `steuerung`, setzt die Attrappe `FAKE_SDK_FASSUNG` nicht (Aufgabe 3) — dann anhalten.

- [ ] **Step 10: Selbsttest und Typcheck**

```
npm run selftest -w @jm/connect
npm run typecheck -w @jm/connect
```
Erwartet: beide Exit-Code 0, keine `FAIL`-Zeile.

- [ ] **Step 11: Commit**

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
git commit -m "feat(connect): Zoom-Kern - Startfolge mit Generationen und Einrichtung pruefen (Stage 4a)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Nicht pushen (G13).

**Gegenprobe (beim Planen am Prototyp gemessen, kein Umsetzungsschritt):** Jede dieser absichtlichen Abweichungen macht mindestens eine Prüfung rot (Spec 12.5): Startfolge meldet nach dem Senden sofort Erfolg, ohne auf `auth` zu warten → Fall 24b (beide), 7, „Anmeldung abgelehnt … B9“, „init scheitert → B8“, „Drehbuch stuck … B7“, Fall 4 (B16), Fall 6, später Fall 5 und 24c (14 `FAIL`); `envRemove` ohne die drei `ZOOM_SDK_*` → Fall 4 „… keine der drei ZOOM_SDK_*-Variablen beim Kind“; `env: { PATH: ordner }` ohne geerbten Wert → Fall 4 „… PATH: Laufzeit-Ordner vor dem geerbten Wert …“; `error where:'auth'` nicht ausgewertet → Fall 24b „… B18 binnen 1 s (nicht B16)“ (später auch 24c); Ereignisse einer Bridge im Abbau wie aktive ausgewertet → „6.9: Ereignisse der gestoppten Bridge stehen nur im Log“ und „… der spätere Fehler steht nur als (Abbau) im Log“ (dazu in Aufgabe 13 „… das ended der stoppenden Bridge steht nur im Log“); Maskierung fehlt → „… das JWT steht nirgends im Log“ (dazu Fall 3 in Aufgabe 12); `pruefen` ohne `stoppeBridge()` → Fall 24 (drei `FAIL`); Quellen nach `stop()` nicht verwerfen → erst Aufgabe 14 („Absturz mit geladener Quelle“). In 4a halten die Zustandsprüfungen (`fehler`, `verlaesst`) ein `ended` der stoppenden Bridge ohnehin fern; die Generationsregel trägt erst beim Wiederbeitritt in 4b (Fall 15c) — darum prüfen die 4a-Fälle sie über das Log.

**Abweichungen vom Gerüst:**
- Zusätzliche interne Hilfen `StartAusgang`, `StartBeobachter`, `ABGEBROCHEN`, `beschreibe()`, `beiLog()`, `geheimnisse()`, `abbauEreignis()`, `startBewerten()`; `starteBridge()` behält die Gerüst-Signatur ohne Parameter, der Abbruch läuft über `laufNr` (Verlassen und Beenden zählen hoch, Aufgabe 13).
- `meldung.detail` bei B7 und B16 ist `null`: Dafür gibt es keinen technischen Namen, und Spec 8.7 verbietet erfundene Werte. B9–B15 tragen `authResultName(code) (code)`, B8/B18/Q7 `fehlerDetail(e)`.
- `audio … off` einer Bridge im Abbau setzt den Ton der Quelle auf `off`; die Quelle selbst verschwindet erst mit `video … unsubscribed` bzw. nach dem `stop()` (Spec 6.9 nennt beides „aus dem Abbild nehmen“, Z12 zählt n über die Bild-Abos).
- Die Abbau-Regel „nach `stop()` alle Quellen dieser Generation verwerfen“ ist hier eingebaut, belegt wird sie in Aufgabe 14 (Absturz mit geladener Quelle): Vorher gibt es keine Quellen.
- `stop()` liefert `-1` wird schon hier belegt (Drehbuch `stuck` meldet die Vorgabe-Fassung der Attrappe → B7 → Abbau per Kill); Fall 20 in Aufgabe 13 belegt es zusätzlich über `beenden`.

---

### Task 12: Kern: Beitritt bis `im_meeting`, Erlaubnis, Geheimnisse

**Spec:** 5.3 (Mangel beim Start), 5.7, 6.1 (Sperre S10 im Meeting), 6.2 Beitritt Schritte 1–4, Schritt 5 (nur `inMeeting`, `failed`, `joinTimeout`, `join`-Fehler, `exited`), Schritt 6 (Erlaubnis-Tabelle), 8.3 (N0, N0b, C-Texte, CT, CJ, CB), 8.4 Q12, 8.7; Tests 12.2 Fall 1 (zweiter Teil), 2, 3, 5, 7 (über den Beitritt), 8, 10 (Erlaubnis), 24c, 27; Review Focus 1 und 5. Global Constraints G4, G5, G9, G12, G13, G14, G15.

**Files:**
- Modify: `apps/connect/src/main/zoom/kern.ts` (Stand nach Aufgabe 11), Zeilen 20–25 (Importe der Bridge), 35–36 (Import des Teilnehmer-Typs), 41–45 (Importe der Klartexte), 65 (Import baueTeilnehmer), 129–130 (Schnittstelle: beitreten() und erneut()), 136 (Ereignistypen status und privilege), 211 (Zustand der Teilnehmerzeilen), 222 (aktiveQuellen() und teilnehmerAbbild()), 254 (Teilnehmer im Abbild), 535 (neue Bridge, neue Teilnehmer-IDs), 627–629 (Ereignisse der aktiven Bridge verteilen), 657 (Beitritt), 703–704 (beitreten und erneut in der öffentlichen Fläche)
- Modify: `apps/connect/test/zoom-kern.test.ts` (Stand nach Aufgabe 11), Zeile 678 (Ankerzeile)

Zeilenangaben gelten für den Stand vor dieser Aufgabe; maßgeblich ist der wortgleiche Vorher-Text (G14).

**Interfaces:**
- Consumes:
  - Aufgabe 11 (Closure): `starteBridge(): Promise<StartErgebnis>`, `stoppeBridge(): Promise<void>`, `sende(cmd: Command): boolean`, `aktiveSitzung(): Session | null`, `melde(art, m)`, `mangelFolgen()`, `laufNr`, `aktiveGen`, `imAbbau`, `startBeob`, `type FehlerEreignis`; `beiEreignis(gen, ev)` endet mit `if (startBeob !== null && startBeob.gen === gen) startBewerten(startBeob, ev);` und `abbildGeaendert();`.
  - Aufgabe 6 (`klartext.ts`): `VORSATZ` (`beitritt: 'Beitritt gescheitert: '`, `verbindung: 'Verbindung verloren: '`), `failMeldung(vorsatz: Vorsatz, code: number, anzeigename: string): Meldungstext` (`detail` = `failCodeName(code) (code)`), `mangelText`, `dllMeldung`, `exitCodeAus`, `fehlerDetail`, `KT.N0`, `KT.N0b`, `KT.CT`, `KT.CJ(name)`, `KT.CB(detail)`, `KT.Q12(name)`.
  - Aufgabe 9 (`teilnehmer.ts`): `baueTeilnehmer(e: { liste: readonly Participant[]; quellen: ReadonlyMap<number, ZoomQuelle>; tonVorwahl: ReadonlyMap<number, boolean>; zeilenFehler: ReadonlyMap<number, string>; gastLabels: readonly string[] }): ZoomParticipant[]` (ohne `self`, Host und Co-Host zuerst).
  - Aufgabe 3 (Attrappe, `steuerung`): `FAKE_BEITRITT_SCHEITERT`, `FAKE_PRIVILEGE` (`'ja'`, `'offen'`, `'nein'`), `FAKE_AUTH_CODE`, `FAKE_AUTH_SOFORTFEHLER`; eigene Zeile 100 („JM Connect“, `self`), Anna 16778240 (Host), Ben 16778241; jede Befehlszeile als `ATTRAPPE empfing: <zeile>` auf stderr.
  - Bridge: `normalizeMeetingId(raw: string): string` (wirft bei Nicht-Ziffern, ohne den Wert zu nennen), `type MeetingStatusName`.
- Produces:
  ```ts
  export interface ZoomKern { /* … */
    beitreten(e: { nummer: string; kenncode: string; anzeigename: string }): Promise<ZoomErgebnis>;
    erneut(): Promise<ZoomErgebnis>;
  }
  // intern, für 13–15 verbindlich:
  type StatusEreignis = { ev: 'status'; status: MeetingStatusName; code: number };
  type PrivilegEreignis = { ev: 'privilege'; canRecordRaw: boolean; source: 'broadcast' | 'requestAnswer' | 'check'; requested?: boolean; denied?: boolean; timedOut?: boolean };
  const tonVorwahl: Map<number, boolean>; const zeilenFehler: Map<number, string>;   // je Teilnehmer-ID, bei jeder neuen Bridge geleert
  function aktiveQuellen(): Map<number, ZoomQuelle>;   // Quellen der aktiven Generation, ohne `gen`
  function teilnehmerAbbild(): ZoomParticipant[];
  function scheitert(m: Meldungstext): void;           // meldung fehler, stoppeBridge(), Zustand fehler
  function imMeetingAngekommen(): void;                // erlaubnis 'offen', Merker, im_meeting
  function statusEreignis(e: StatusEreignis): void;    // Aufgabe 13 ersetzt sie ganz
  function privilegEreignis(e: PrivilegEreignis): void;
  function fehlerEreignis(e: FehlerEreignis): void;    // Aufgabe 13 ersetzt den Teil nach dem Q12-Zweig
  ```

**Verhalten (verbindlich, aus der Spec):**
- `beitreten({ nummer, kenncode, anzeigename })`: in `einrichtung` → `{ ok: false, text: mangelText(ersterMangel, datei) }` (z. B. B17); sonst nur in `bereit` ohne Prüfung oder in `fehler`, sonst `{ ok: false, text: '' }` (L9, deckt Review Focus 1). `normalizeMeetingId` wirft → N0; Anzeigename nach `trim` nicht 1–64 Zeichen → N0b; der Kenncode darf leer sein. Erst danach: Anzeigename speichern, Nummer (eingegeben + normiert) und Kenncode in den Arbeitsspeicher, Soll-Liste leeren (L11). Bei N0/N0b bleibt alles unverändert, keine Bridge, kein Log.
- `starteBeitritt()` (gemeinsam für `beitreten` und `erneut`): `meldung: null`, Merker löschen, Logzeile `[zoom] Beitritt gestartet (Anzeigename „<name>“)`, Zustand `startet`, Startfolge. Abgebrochen (anderes `laufNr`) → `{ ok: false, text: '' }`. Fehler → Mangel: `mangelFolgen()` und Zustand `einrichtung`, sonst Zustand `fehler`; `meldung` (fehler) = Text der Startfolge; Rückgabe `{ ok: false, text }`. Erfolg → `join { meetingId: normiert, passcode: kenncode, displayName: anzeigename }`, Zustand `tritt_bei`, `{ ok: true }`.
- `erneut()`: nur mit Nummer im Arbeitsspeicher und in `bereit` ohne Prüfung oder `fehler`; sonst `{ ok: false, text: '' }`. Soll-Liste bleibt.
- Bis zum ersten `inMeeting` (Zustände `tritt_bei`, `warteraum`): `inMeeting` → `imMeetingAngekommen()` (`erlaubnis: 'offen'`, Merker setzen, `im_meeting`); `failed` → `failMeldung(VORSATZ.beitritt, code, anzeigename)`; `error join joinTimeout` → CT; `error where:'join'` mit Zahl → CJ(name); `error exit exited` → `dllMeldung(...)`, sonst CB(detail). Jeweils `scheitert(...)`: Zustand `fehler`, `stoppeBridge()`, Nummer und Kenncode bleiben (`erneutMoeglich: true`).
- Erlaubnis (6.2 Schritt 6, alle sechs Zeilen): `canRecordRaw: true` → `ja`; `denied` → `abgelehnt`; `timedOut` → `abgelaufen`; `broadcast` + `false` nach `ja` → `entzogen`, sonst unverändert; `check` + `requested` → `offen`. Jeder Wechsel kommt als `[zoom] Aufnahme-Erlaubnis: <wert>` ins Log. `error where:'privilege'` → `meldung { art: 'warnung', text: KT.Q12(name) }`.
- Teilnehmer im Abbild über `baueTeilnehmer` aus der Sitzung der aktiven Bridge (ohne eigene Zeile, Host zuerst); `tonVorwahl` und `zeilenFehler` leeren sich bei jeder neuen Bridge (IDs gelten nur je Sitzung).
- Im Meeting antworten `sdkWaehlen`, `zugangWaehlen` und `zugangLoeschen` mit S10 (die Sperre aus Aufgabe 10 greift, weil der Zustand nicht Z1a/Z2/Z13 ist); die Zugangsdaten bleiben unverändert.

- [ ] **Step 1: Fehlschlagende Tests schreiben (Fall 1, 2, 3, 5, 7, 8, 10, 24c, 27, Review Focus 1 und 5)**

In `apps/connect/test/zoom-kern.test.ts` direkt über der Ankerzeile einfügen.

Vorher:
```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

Nachher:
```ts
// ── Aufgabe 12: Beitritt bis im_meeting, Erlaubnis, Geheimnisse ──────────────
/** Beitritt mit NUMMER und `kenncode`; wartet auf im_meeting mit Erlaubnis „ja“. */
async function insMeeting(p: Probe, kenncode = KENNCODE): Promise<boolean> {
  const r = await p.kern.beitreten({ nummer: NUMMER, kenncode, anzeigename: 'JM Connect' });
  return r.ok && (await bis(() => p.kern.kurz().zustand === 'im_meeting' && p.kern.kurz().erlaubnis === 'ja'));
}

console.log('— Beitritt (Fall 1 zweiter Teil, 2, 5, 8, 24c), Review Focus 1 und 5');
{
  const p = baueKern({ zugang: { daten: null, herkunft: 'none' } });
  const r = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Fall 1: Zugangsdaten fehlen → B17, keine Bridge', text(r) === KT.B17 && p.starts() === 0);
  ck('… Zustand einrichtung, STATE zoom_status=einrichtung', p.kern.kurz().zustand === 'einrichtung' && p.kern.stateKv()?.zoom_status === 'einrichtung');
  ck('… nichts im Arbeitsspeicher', !p.kern.abbild().erneutMoeglich);
  await p.aufraeumen();
}
{
  let n = 0;
  const p = baueKern({
    laufzeit: { pruefe: () => (++n === 1 ? { ok: true, ordner: 'C:/laufzeit', ersetzt: [] } : { ok: false, mangel: 'sdk_defekt', datei: 'sdk.dll' }) },
  });
  const r = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('5.3: Laufzeit beim Beitritt defekt → S9, Zustand einrichtung, keine Bridge',
    text(r) === KT.S9('sdk.dll') && p.kern.kurz().zustand === 'einrichtung' && p.starts() === 0);
  ck('… Nummer und Kenncode verworfen (kein „Erneut“), Meldung S9', !p.kern.abbild().erneutMoeglich && p.kern.abbild().meldung?.text === KT.S9('sdk.dll'));
  await p.aufraeumen();
}
{
  const p = baueKern({ versatzMs: 40 });
  const r = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: '  JM Connect  ' });
  ck('Fall 2: Beitritt angenommen, Anzeigename getrimmt gespeichert', ok(r) && p.einst.anzeigename === 'JM Connect');
  ck('… im_meeting mit Erlaubnis ja', await bis(() => p.kern.kurz().zustand === 'im_meeting' && p.kern.kurz().erlaubnis === 'ja'));
  const c = p.befehle(1);
  ck('… Befehlsfolge init, auth, videoDelay (40), join', c.slice(0, 4).map((x) => x.cmd).join(',') === 'init,auth,videoDelay,join' && c[2].ms === 40);
  ck('… join mit Nummer, Kenncode und Anzeigename', c[3].meetingId === NUMMER && c[3].passcode === KENNCODE && c[3].displayName === 'JM Connect');
  const t = p.kern.abbild().teilnehmer;
  ck('… Teilnehmer ohne eigene Zeile (100), Host zuerst', t.length === 2 && !t.some((x) => x.id === 100) && t[0].id === 16778240 && t[0].rolle === 'host');
  ck('… Zustandsfolge startet → tritt_bei → im_meeting', folge(p).join(',') === 'startet,tritt_bei,im_meeting');
  ck('… STATE im_meeting, privilege 1, alarm 0, erneutMoeglich',
    p.kern.stateKv()?.zoom_status === 'im_meeting' && p.kern.stateKv()?.zoom_privilege === 1 && p.kern.stateKv()?.zoom_alarm === 0 && p.kern.abbild().erneutMoeglich);
  ck('… Log „Beitritt gestartet (Anzeigename „JM Connect“)“', p.logs.includes('[zoom] Beitritt gestartet (Anzeigename „JM Connect“)'));
  ck('Fall 27: im Meeting → Zugang entfernen und SDK wählen → S10', text(p.kern.zugangLoeschen()) === KT.S10 && text(await p.kern.sdkWaehlen('C:/SDK')) === KT.S10);
  ck('… Zugangsdaten unverändert', p.kern.abbild().einrichtung.zugang.herkunft === 'stored' && p.kern.kurz().maengel.length === 0);
  ck('… beitreten und pruefen im Meeting → ok:false ohne Text',
    text(await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' })) === '' && text(await p.kern.pruefen()) === '');
  await p.aufraeumen();
}
{
  const p = baueKern();
  ck('Fall 3: im Meeting', await insMeeting(p));
  const alles = JSON.stringify(p.kern.abbild()) + JSON.stringify(p.kern.stateKv()) + JSON.stringify(p.kern.kurz());
  ck('Fall 3: Nummer und Kenncode weder im Abbild noch in STATE/Kurzform', !alles.includes(NUMMER) && !alles.includes(KENNCODE));
  const kernZeilen = p.logs.filter((z) => z.startsWith('[zoom] '));
  ck('… nicht in [zoom]-Zeilen', kernZeilen.length > 0 && !kernZeilen.some((z) => z.includes(NUMMER) || z.includes(KENNCODE)));
  const echo = p.logs.find((z) => z.startsWith('[zoom-bridge] ATTRAPPE empfing:') && z.includes('"join"'));
  ck('… die Echo-Zeile der Attrappe erscheint nur maskiert', echo !== undefined && echo.includes('•••') && !echo.includes(NUMMER) && !echo.includes(KENNCODE));
  ck('… keine Zeile enthält Nummer, Kenncode oder Secret', !p.logs.some((z) => z.includes(NUMMER) || z.includes(KENNCODE) || z.includes('test-secret')));
  await p.aufraeumen();
}
{
  const p = baueKern();
  ck('Fall 3 (leerer Kenncode): im Meeting', await insMeeting(p, ''));
  ck('… keine Zeile mit „•••“ zwischen Einzelzeichen', !p.logs.some((z) => /•••.•••/.test(z)));
  const echo = p.logs.find((z) => z.startsWith('[zoom-bridge] ATTRAPPE empfing:') && z.includes('"join"'));
  ck('… die Echo-Zeile ist lesbar, die Nummer maskiert', echo !== undefined && echo.includes('"passcode":""') && echo.includes('"meetingId":"•••"'));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_AUTH_CODE: '2' }) });
  const r = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Fall 5: Anmeldung abgelehnt → B9, Zustand fehler', text(r) === KT.B9('AUTHRET_KEYORSECRETWRONG') && p.kern.kurz().zustand === 'fehler');
  ck('… kein join in der Befehlsfolge', !cmds(p).includes('join'));
  ck('… Meldung fehler, erneutMoeglich, STATE alarm 1',
    p.kern.abbild().meldung?.art === 'fehler' && p.kern.abbild().erneutMoeglich && p.kern.stateKv()?.zoom_alarm === 1);
  await p.aufraeumen();
}
{
  // Fall 7 über den Beitritt: nur hier kann „kein join“ rot werden („Einrichtung prüfen“ sendet nie join).
  const p = baueKern({ stell: () => ({ FAKE_SDK_FASSUNG: '7.1.6 (99999)' }) });
  const r = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Fall 7 (Beitritt): falsche SDK-Fassung → B7, Zustand fehler', text(r) === KT.B7('7.1.6 (99999)') && p.kern.kurz().zustand === 'fehler');
  ck('… Bridge gestoppt, kein join in der Befehlsfolge', !p.kern.laeuft() && cmds(p).includes('init') && !cmds(p).includes('join'));
  await p.aufraeumen();
}
for (const code of [63, 503, 504, 4]) {
  const p = baueKern({ stell: () => ({ FAKE_BEITRITT_SCHEITERT: String(code) }) });
  const r = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  await bis(() => p.kern.kurz().zustand === 'fehler');
  const m = p.kern.abbild().meldung;
  const erwartet = code === 63 ? 'Beitritt gescheitert: Das Meeting gehört nicht zum Zoom-Konto dieser App. JM Connect kann nur Meetings im eigenen Zoom-Konto betreten. Bitte das Meeting im eigenen Konto anlegen.'
    : code === 4 ? 'Beitritt gescheitert: falscher Kenncode.'
    : 'Beitritt gescheitert: Zoom verlangt für dieses Meeting einen Beitritt im Namen eines angemeldeten Nutzers (OBF-Token). Das kann JM Connect nicht — nur Meetings im eigenen Zoom-Konto.';
  ck(`Fall 8 (Code ${code}): join gesendet, dann fehler mit dem Klartext`, ok(r) && p.kern.kurz().zustand === 'fehler' && m?.text === erwartet);
  ck(`… detail mit SDK-Namen und Code ${code}`, m?.detail?.endsWith(` (${code})`) === true && m.detail.startsWith('MEETING_FAIL_'));
  await warte(200);
  ck(`… kein zweiter Bridge-Start, erneutMoeglich (Code ${code})`, p.starts() === 1 && p.kern.abbild().erneutMoeglich);
  if (code === 4) {
    const e = await p.kern.erneut();
    ck('erneut() nach fehler: neuer Start mit den Daten im Arbeitsspeicher', ok(e) && p.starts() === 2
      && p.befehle(2).find((c) => c.cmd === 'join')?.meetingId === NUMMER && p.befehle(2).find((c) => c.cmd === 'join')?.passcode === KENNCODE);
  }
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_AUTH_SOFORTFEHLER: '3' }) });
  const t0 = Date.now();
  const r = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Fall 24c: Sofortfehler → fehler mit B18 binnen 1 s', text(r) === KT.B18('SDKERR_INVALID_PARAMETER') && p.kern.kurz().zustand === 'fehler' && Date.now() - t0 < 1000);
  ck('… kein join', !cmds(p).includes('join'));
  await p.aufraeumen();
}
{
  const p = baueKern();
  ck('erneut() ohne gemerkte Nummer → ok:false ohne Text, keine Bridge', text(await p.kern.erneut()) === '' && p.starts() === 0);
  const erster = p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  const zweiter = await p.kern.beitreten({ nummer: NUMMER, kenncode: 'KENNCODE-PROBE-ZWEI', anzeigename: 'Zweiter Name' });
  ck('Review Focus 1: zweiter Klick während startet → ok:false ohne Text', text(zweiter) === '');
  ck('… erster Beitritt läuft weiter', ok(await erster) && (await bis(() => p.kern.kurz().zustand === 'im_meeting')));
  ck('… genau eine Bridge, join mit den Daten des ersten Aufrufs', p.starts() === 1
    && p.befehle(1).filter((c) => c.cmd === 'join').length === 1 && p.befehle(1).find((c) => c.cmd === 'join')?.passcode === KENNCODE
    && p.einst.anzeigename === 'JM Connect');
  await p.aufraeumen();
}
{
  const p = baueKern();
  const r1 = await p.kern.beitreten({ nummer: '12a45', kenncode: KENNCODE, anzeigename: 'JM Connect' });
  const r2 = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: '   ' });
  const r2leer = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: '' });
  const r3 = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'x'.repeat(65) });
  ck('Review Focus 5: Nummer mit Buchstaben → N0', text(r1) === KT.N0);
  ck('… Anzeigename leer oder nur Leerzeichen → N0b, 65 Zeichen → N0b', text(r2) === KT.N0b && text(r2leer) === KT.N0b && text(r3) === KT.N0b);
  ck('… keine Bridge, Zustand unverändert, nichts gespeichert', p.starts() === 0 && p.kern.kurz().zustand === 'bereit'
    && !p.kern.abbild().erneutMoeglich && p.einst.anzeigename === 'JM Connect');
  ck('… weder Nummer noch Kenncode in Text oder Log',
    ![text(r1), text(r2), text(r2leer), text(r3), ...p.logs].some((z) => (z ?? '').includes(NUMMER) || (z ?? '').includes(KENNCODE) || (z ?? '').includes('12a45')));
  ck('… 64 Zeichen sind erlaubt', ok(await p.kern.beitreten({ nummer: NUMMER, kenncode: '', anzeigename: 'x'.repeat(64) })));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_PRIVILEGE: 'nein' }) });
  await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Fall 10: Erlaubnis abgelehnt → Z7', await bis(() => p.kern.kurz().erlaubnis === 'abgelehnt') && zoomZ(p.kern.kurz()) === 'Z7');
  ck('… STATE zoom_alarm=1, zoom_privilege=0', p.kern.stateKv()?.zoom_alarm === 1 && p.kern.stateKv()?.zoom_privilege === 0);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_PRIVILEGE: 'offen' }) });
  await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Erlaubnis angefragt, keine Antwort → Z6, alarm 0',
    await bis(() => p.kern.kurz().zustand === 'im_meeting') && (await warte(200), zoomZ(p.kern.kurz()) === 'Z6') && p.kern.stateKv()?.zoom_alarm === 0);
  await p.aufraeumen();
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: die 95 Prüfungen aus den Aufgaben 10–11 `ok` (unter Linux 92 und 1 übersprungen), danach Abbruch mit
```
TypeError: p.kern.beitreten is not a function
```
Exit-Code 1.

- [ ] **Step 3: Importe ergänzen**

In `apps/connect/src/main/zoom/kern.ts`:

Vorher:
```ts
  buildJwt,
  readCredentials,
  type BridgeEvent,
  type BridgeOptions,
  type Command,
  type Session,
```

Nachher:
```ts
  buildJwt,
  normalizeMeetingId,
  readCredentials,
  type BridgeEvent,
  type BridgeOptions,
  type Command,
  type MeetingStatusName,
  type Session,
```

Und:

Vorher:
```ts
  ZoomMangel,
  ZoomQuelle,
```

Nachher:
```ts
  ZoomMangel,
  ZoomParticipant,
  ZoomQuelle,
```

Und:

Vorher:
```ts
  KT,
  authMeldung,
  dllMeldung,
  exitCodeAus,
  fehlerDetail,
```

Nachher:
```ts
  KT,
  VORSATZ,
  authMeldung,
  dllMeldung,
  exitCodeAus,
  failMeldung,
  fehlerDetail,
```

Und:

Vorher:
```ts
import { zaehleQuellen } from './teilnehmer';
```

Nachher:
```ts
import { baueTeilnehmer, zaehleQuellen } from './teilnehmer';
```

- [ ] **Step 4: Schnittstelle und Ereignistypen**

Vorher:
```ts
  pruefen(): Promise<ZoomErgebnis>;
  schliessen(): void;
```

Nachher:
```ts
  pruefen(): Promise<ZoomErgebnis>;
  beitreten(e: { nummer: string; kenncode: string; anzeigename: string }): Promise<ZoomErgebnis>;
  erneut(): Promise<ZoomErgebnis>;
  schliessen(): void;
```

Und:

Vorher:
```ts
type FehlerEreignis = { ev: 'error'; where: string; code: number | string; id?: number; dropped?: number; detail?: string; name?: string };
```

Nachher:
```ts
type FehlerEreignis = { ev: 'error'; where: string; code: number | string; id?: number; dropped?: number; detail?: string; name?: string };
type StatusEreignis = { ev: 'status'; status: MeetingStatusName; code: number };
type PrivilegEreignis = { ev: 'privilege'; canRecordRaw: boolean; source: 'broadcast' | 'requestAnswer' | 'check'; requested?: boolean; denied?: boolean; timedOut?: boolean };
```

- [ ] **Step 5: Teilnehmerzeilen**

Vorher:
```ts
  let startBeob: StartBeobachter | null = null;
```

Nachher:
```ts
  let startBeob: StartBeobachter | null = null;

  // ── Quellen, Teilnehmerzeilen (Spec 6.3) ─────────────────────────────────
  /** Ton-Schalter je Teilnehmer-ID (nicht je Name), gilt beim Laden. */
  const tonVorwahl = new Map<number, boolean>();
  /** Zeilenfehler ohne laufende Quelle (Q2, Q8 …), je Teilnehmer-ID. */
  const zeilenFehler = new Map<number, string>();
```

Und:

Vorher:
```ts
  function kurz(): ZoomKurz {
```

Nachher:
```ts
  function aktiveQuellen(): Map<number, ZoomQuelle> {
    const m = new Map<number, ZoomQuelle>();
    for (const q of quellen.values()) {
      if (q.gen !== aktiveGen || imAbbau.has(aktiveGen)) continue;
      m.set(q.aboId, { aboId: q.aboId, ndiName: q.ndiName, bild: q.bild, bildGrund: q.bildGrund, ton: q.ton, tonGrund: q.tonGrund, fehler: q.fehler });
    }
    return m;
  }

  function teilnehmerAbbild(): ZoomParticipant[] {
    const s = aktiveSitzung();
    if (!s) return [];
    return baueTeilnehmer({ liste: [...s.participants.values()], quellen: aktiveQuellen(), tonVorwahl, zeilenFehler, gastLabels: d.gastLabels() });
  }

  function kurz(): ZoomKurz {
```

Und:

Vorher:
```ts
      teilnehmer: [],
```

Nachher:
```ts
      teilnehmer: teilnehmerAbbild(),
```

Und (in `starteBridge`):

Vorher:
```ts
    startNr += 1;
```

Nachher:
```ts
    startNr += 1;
    tonVorwahl.clear();
    zeilenFehler.clear();
```

- [ ] **Step 6: Ereignisse der aktiven Bridge verteilen**

In `beiEreignis`:

Vorher:
```ts
    if (startBeob !== null && startBeob.gen === gen) startBewerten(startBeob, ev);
    abbildGeaendert();
  }
```

Nachher:
```ts
    if (startBeob !== null && startBeob.gen === gen) startBewerten(startBeob, ev);
    if (imAbbau.has(gen)) {
      abbildGeaendert();
      return;
    }
    switch (ev.ev) {
      case 'status':
        statusEreignis(ev as unknown as StatusEreignis);
        break;
      case 'privilege':
        privilegEreignis(ev as unknown as PrivilegEreignis);
        break;
      case 'error':
        fehlerEreignis(ev as unknown as FehlerEreignis);
        break;
    }
    abbildGeaendert();
  }
```

- [ ] **Step 7: Beitritt, Statusfolge bis `im_meeting`, Erlaubnis, Fehler**

Der neue Abschnitt kommt direkt vor den Abschnitt „Beenden“:

Vorher:
```ts
  // ── Beenden (Spec 6.6) ───────────────────────────────────────────────────
```

Nachher:
```ts
  // ── Beitritt (Spec 6.2) ──────────────────────────────────────────────────
  function scheitert(m: Meldungstext): void {
    melde('fehler', m);
    void stoppeBridge();
    setzeZustand('fehler');
  }

  async function starteBeitritt(): Promise<ZoomErgebnis> {
    if (nummer === null) return { ok: false, text: '' };
    const lauf = laufNr;
    const name = d.einstellungen.anzeigename();
    meldung = null;
    warImMeeting = false;
    d.log(`[zoom] Beitritt gestartet (Anzeigename „${name}“)`);
    setzeZustand('startet');
    const r = await starteBridge();
    if (lauf !== laufNr) return { ok: false, text: '' };
    if (!r.ok) {
      if (r.mangel !== null) mangelFolgen();
      melde('fehler', r.meldung);
      setzeZustand(r.mangel !== null ? 'einrichtung' : 'fehler');
      return { ok: false, text: r.meldung.text };
    }
    sende({ cmd: 'join', meetingId: nummer.normiert, passcode: kenncode ?? '', displayName: name });
    setzeZustand('tritt_bei');
    return { ok: true };
  }

  async function beitreten(e: { nummer: string; kenncode: string; anzeigename: string }): Promise<ZoomErgebnis> {
    if (zustand === 'einrichtung') return maengel.length ? { ok: false, text: mangelText(maengel[0], mangelDatei()) } : { ok: false, text: '' };
    if (!((zustand === 'bereit' && !pruefungLaeuft) || zustand === 'fehler')) return { ok: false, text: '' };
    let normiert: string;
    try {
      normiert = normalizeMeetingId(e.nummer);
    } catch {
      return { ok: false, text: KT.N0 };
    }
    const name = e.anzeigename.trim();
    if (name.length < 1 || name.length > 64) return { ok: false, text: KT.N0b };
    d.einstellungen.setzeAnzeigename(name);
    nummer = { eingabe: e.nummer, normiert };
    kenncode = e.kenncode;
    soll.clear();
    return starteBeitritt();
  }

  async function erneut(): Promise<ZoomErgebnis> {
    if (nummer === null || !((zustand === 'bereit' && !pruefungLaeuft) || zustand === 'fehler')) return { ok: false, text: '' };
    return starteBeitritt();
  }

  function imMeetingAngekommen(): void {
    erlaubnis = 'offen';
    warImMeeting = true;
    setzeZustand('im_meeting');
  }

  function statusEreignis(e: StatusEreignis): void {
    const s = e.status;
    const name = d.einstellungen.anzeigename();
    if (zustand === 'tritt_bei' || zustand === 'warteraum') {
      if (s === 'inMeeting') imMeetingAngekommen();
      else if (s === 'failed') scheitert(failMeldung(VORSATZ.beitritt, e.code, name));
    }
  }

  /** Spec 6.2 Schritt 6, Tabelle. */
  function privilegEreignis(e: PrivilegEreignis): void {
    const vorher = erlaubnis;
    if (e.canRecordRaw) erlaubnis = 'ja';
    else if (e.denied) erlaubnis = 'abgelehnt';
    else if (e.timedOut) erlaubnis = 'abgelaufen';
    else if (e.source === 'broadcast') {
      if (vorher === 'ja') erlaubnis = 'entzogen';
    } else if (e.source === 'check' && e.requested) erlaubnis = 'offen';
    if (erlaubnis === vorher) return;
    d.log(`[zoom] Aufnahme-Erlaubnis: ${erlaubnis}`);
  }

  function fehlerEreignis(e: FehlerEreignis): void {
    const name = e.name ?? String(e.code);
    if (e.where === 'privilege') {
      melde('warnung', { text: KT.Q12(name), detail: fehlerDetail(e) });
      return;
    }
    if (zustand !== 'tritt_bei' && zustand !== 'warteraum') return;
    if (e.where === 'join' && e.code === 'joinTimeout') scheitert({ text: KT.CT, detail: fehlerDetail(e) });
    else if (e.where === 'join' && typeof e.code === 'number') scheitert({ text: KT.CJ(name), detail: fehlerDetail(e) });
    else if (e.where === 'exit' && e.code === 'exited') {
      scheitert(dllMeldung(exitCodeAus(e.detail)) ?? { text: KT.CB(e.detail ?? fehlerDetail(e)), detail: fehlerDetail(e) });
    }
  }

  // ── Beenden (Spec 6.6) ───────────────────────────────────────────────────
```

- [ ] **Step 8: `beitreten` und `erneut` in die öffentliche Fläche**

Vorher:
```ts
    pruefen,
    schliessen,
```

Nachher:
```ts
    pruefen,
    beitreten,
    erneut,
    schliessen,
```

- [ ] **Step 9: Test laufen lassen (grün)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: keine `FAIL`-Zeile, letzte Zeile unter Windows
```
152 ok, 0 fehlgeschlagen, 0 übersprungen.
```
unter Linux `149 ok, 0 fehlgeschlagen, 1 übersprungen.`, Exit-Code 0. Liefert Fall 8 statt „Beitritt gescheitert: falscher Kenncode.“ einen Text mit „gescheitert: gescheitert“, benutzt `klartext.ts` `explainStatus` (Aufgabe 6) — dann anhalten.

- [ ] **Step 10: Selbsttest und Typcheck**

```
npm run selftest -w @jm/connect
npm run typecheck -w @jm/connect
```
Erwartet: beide Exit-Code 0, keine `FAIL`-Zeile.

- [ ] **Step 11: Commit**

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
git commit -m "feat(connect): Zoom-Kern - Beitritt bis im_meeting, Aufnahme-Erlaubnis, Geheimnisse maskiert (Stage 4a)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Nicht pushen (G13).

**Gegenprobe (beim Planen am Prototyp gemessen, kein Umsetzungsschritt):** Jede dieser absichtlichen Abweichungen macht mindestens eine Prüfung rot: `join` ohne Warten auf `auth` → Fall 5 „… Zustand fehler“ (Spec 12.5) und „erneut() nach fehler …“; Maskierung fehlt → Fall 3 „… die Echo-Zeile der Attrappe erscheint nur maskiert“, „… keine Zeile enthält Nummer, Kenncode oder Secret“ und der Lauf mit leerem Kenncode; Anzeigename-Grenze `>= 64` statt `> 64` → „… 64 Zeichen sind erlaubt“; Mangel aus der Startfolge führt zu `fehler` statt `einrichtung` → „5.3: Laufzeit beim Beitritt defekt …“; `onKurz` nicht sofort → Fall 2 „… Zustandsfolge startet → tritt_bei → im_meeting“; Erlaubnis „entzogen“ nicht erkannt → Fall 10b in Aufgabe 14 (drei `FAIL`).

**Abweichungen vom Gerüst:**
- Zusätzlicher Fall „5.3: Laufzeit beim Beitritt defekt“: Ein Mangel, den erst die Startfolge findet, muss Nummer und Kenncode verwerfen und nach `einrichtung` führen; ohne diesen Fall bliebe der Zweig `mangelFolgen()` in `starteBeitritt` unbelegt.
- `error where:'privilege'` (Q12) und die Tabellenzeile `timedOut` → `abgelaufen` haben keinen Test: Die Attrappe kennt dafür keine Stellschraube (Aufgabe 3). Belegt sind `ja`, `offen` (`check`/`requested`), `abgelehnt` (hier) und `entzogen` (Aufgabe 14, Fall 10b).
- Fall 27 prüft zusätzlich, dass `beitreten` und `pruefen` im Meeting `{ ok: false, text: '' }` liefern (L9) — sonst entstünde eine zweite Bridge (5.2).
- Fall 7 läuft hier ein zweites Mal, über `beitreten` (B7, Zustand `fehler`, Bridge gestoppt, `init` gesendet, aber kein `join`). Aufgabe 11 prüft ihn über „Einrichtung prüfen“; dieser Ablauf sendet nie `join`, dort kann „kein join“ also nicht rot werden.
- `fehlerEreignis` reagiert in Aufgabe 12 nur in `tritt_bei`/`warteraum`; die Zweige für `reconnectTimeout` und Absturz im Meeting folgen in Aufgabe 13, die Bild-/Ton-Fehler in Aufgabe 14.

---

### Task 13: Kern: Warteraum/Einlass, Abriss (4a), Meeting-Ende, Verlassen, Schließen, Beenden

**Spec:** 6.2 Schritt 5 (Warteraum, Einlass, CE), 6.4 Auslöser-Tabelle **mit der 4a-Abweichung** (Spec 18, L1), 6.5, 6.6 (Kernteil von `zoom.beenden`), 6.8 (ohne „Abbrechen“), 6.9; Tests 12.2 Fall 9, 9b, 9c, 19, 20, 26, 28; Review Focus 2. Global Constraints G3, G9, G13, G14, G15.

**Files:**
- Modify: `apps/connect/src/main/zoom/kern.ts` (Stand nach Aufgabe 12), Zeilen 47–48 (Import endeMeldung), 136–137 (Schnittstelle: verlassen()), 286 (Abriss im Abbild), 761–768 (Warteraum, Meeting-Ende, Statusfolge vollständig), 789–795 (Fehler im Meeting (4a) und Verlassen), 816–823 (Beenden mit Bridge und Frist), 845–846 (verlassen in der öffentlichen Fläche)
- Modify: `apps/connect/test/zoom-kern.test.ts` (Stand nach Aufgabe 12), Zeile 831 (Ankerzeile)

Zeilenangaben gelten für den Stand vor dieser Aufgabe; maßgeblich ist der wortgleiche Vorher-Text (G14).

**Interfaces:**
- Consumes:
  - Aufgaben 10/11/12 (Closure): `stoppeBridge()`, `scheitert(m)`, `melde(art, m)`, `imMeetingAngekommen()`, `setzeZustand(z)`, `laufNr`, `aktiveBridge`, `kopieAbbruch`, `kopieLauf`, `mitFrist(p, ms)`, `beendenVersprechen`, `warten`, `soll`, `nummer`, `kenncode`, `meldung`, `warImMeeting`, `maengel`, `zeitgeber(ms, fn)`; `statusEreignis` und der Teil von `fehlerEreignis` nach dem Q12-Zweig (beide wörtlich aus Aufgabe 12) werden hier ersetzt.
  - Aufgabe 6 (`klartext.ts`): `endeMeldung(code: number, anzeigename: string): Meldungstext` (Grund 1 → C61, sonst R6 „Meeting beendet: {endReason}.“, `detail: null`), `failMeldung`, `VORSATZ.verbindung`, `KT.CE`, `KT.UE_RECONNECT` = „Zoom hat die Verbindung in 30 s nicht wiederhergestellt.“, `KT.UE_ABSTURZ(detail)` = „Die Zoom-Bridge ist abgestürzt ({detail}). Details im Log.“, `dllMeldung`, `exitCodeAus`, `fehlerDetail`.
  - Aufgabe 3 (Attrappe): `FAKE_WARTERAUM=1`, `FAKE_EINLASS_MS`, `FAKE_EINLASS_HAENGT=1`, `FAKE_VERBINDUNG_HAENGT_MS`, `FAKE_VERBINDUNG_WEG_MS` (reconnecting, 50 ms später `failed` Code 2), `FAKE_ABSTURZ_MS` (stirbt mit `0xC0000005`), `FAKE_MEETING_ENDE_MS` (`ended` Code 2), `FAKE_ABGANG_MS`, Drehbuch `stuck`; bei `quit` im Meeting meldet die Attrappe `disconnecting` und `ended`.
  - Bridge: der Wachhund meldet `error where:'join' code:'joinTimeout'` bzw. `where:'meeting' code:'reconnectTimeout'` (`name` `RECONNECT_TIMEOUT`) nach `joinTimeoutMs`; ein unerwartetes Prozessende kommt als `error where:'exit' code:'exited'` mit `detail` „Kindprozess unerwartet beendet, exitCode=<n>“.
- Produces:
  ```ts
  export interface ZoomKern { /* … */ verlassen(): Promise<void> }
  // intern, für 14–15 verbindlich:
  function zumWarteraum(s: 'waitingRoom' | 'waitingForHost'): void;
  function meetingEnde(code: number): void;   // 6.5
  // statusEreignis (vollständig, 6.2 Schritt 5 + 6.4 in 4a) enthält den Zweig
  //   } else if (s === 'inMeeting') {
  //     if (zustand === 'abriss') setzeZustand('im_meeting');
  //   } else if …
  // den Aufgabe 15 um abgleichPlanen() erweitert.
  ```

**Verhalten (verbindlich, aus der Spec):**
- In `tritt_bei`/`warteraum`: `waitingRoom` → `warteraum` mit `warten: 'warteraum'`, `waitingForHost` → `warteraum` mit `warten: 'host'`, beides ohne Frist; `reconnecting`/`connecting` in `warteraum` → `tritt_bei` (gemessener Einlass, kein Abriss, kein Alarm); `error meeting reconnectTimeout` → CE, `fehler`.
- Ab `im_meeting`: `reconnecting`/`connecting` → `abriss` (Z10, `versuch: null`, `abbild.abriss = { versuch: null, versuche: 5, naechsterUm: null }`); `inMeeting` in `abriss` → `im_meeting`; `waitingRoom`/`waitingForHost` in `im_meeting`/`abriss` → `warteraum`.
- **4a statt Wiederbeitritt** (L1): `failed` in `im_meeting`/`abriss` → `fehler` mit `failMeldung(VORSATZ.verbindung, code, anzeigename)`; `reconnectTimeout` in `abriss` → `fehler` mit „Verbindung verloren: “ + `KT.UE_RECONNECT`, `detail` `RECONNECT_TIMEOUT (reconnectTimeout)`; `exited` in `im_meeting`/`abriss` → `dllMeldung` (B3–B5), sonst „Verbindung verloren: “ + `KT.UE_ABSTURZ(detail)`. Jeweils über `scheitert`: `stoppeBridge()`, Soll-Liste, Nummer und Kenncode bleiben, `erneutMoeglich: true`, **keine** zweite Bridge.
- `ended` der aktiven Bridge (nicht im Abbau) in `tritt_bei`/`warteraum`/`im_meeting`/`abriss` → `meetingEnde(code)`: `stoppeBridge()`, Soll-Liste leer, `meldung { art: 'warnung', …endeMeldung(code, anzeigename) }`, Zustand `bereit`; Nummer und Kenncode bleiben (`erneutMoeglich: true`). Ein `ended` einer Bridge im Abbau landet nach Aufgabe 11 nur im Log.
- `verlassen()` (Z3–Z11, sonst ohne Wirkung): `laufNr + 1` (eine laufende Startfolge verwirft ihr Ergebnis), Zustand `verlaesst`, `await stoppeBridge()`, dann Soll-Liste, Nummer, Kenncode, `meldung` und Merker leeren und Zustand `bereit` (bei Mängeln `einrichtung`). Kein `fehler`, kein Alarm.
- `schliessen()` (Z2/Z13) und `meldungWeg()` (außer Z13) sind seit Aufgabe 10 vollständig; hier belegt Fall 19 den Weg nach einem Meeting-Ende.
- `beenden(fristMs)` (Teil 2): `laufNr + 1`, Kopie abbrechen und wie in Teil 1 auf `kopieLauf` warten (`mitFrist`, höchstens `fristMs`, L24); mit Bridge: Zustand `verlaesst`, `stoppeBridge()` gegen `fristMs` (`mitFrist`); läuft die Frist ab: `[zoom] Zoom-Bridge nicht rechtzeitig beendet` und weiter. Danach Soll-Liste, Nummer und Kenncode leer. Zweiter Aufruf → dasselbe Versprechen.

- [ ] **Step 1: Fehlschlagende Tests schreiben (Fall 9, 9b, 9c, 19, 20, 26, 28, Review Focus 2, Abriss in 4a)**

In `apps/connect/test/zoom-kern.test.ts` direkt über der Ankerzeile einfügen.

Vorher:
```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

Nachher:
```ts
// ── Aufgabe 13: Warteraum, Abriss (4a), Meeting-Ende, Verlassen, Beenden ─────
console.log('— Warteraum und Einlass (Fall 9, 9b, 9c)');
{
  const p = baueKern({ stell: () => ({ FAKE_WARTERAUM: '1' }), fristen: { joinTimeoutMs: 500 } });
  await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Fall 9: im Warteraum (Z5a)', await bis(() => p.kern.kurz().zustand === 'warteraum') && zoomZ(p.kern.kurz()) === 'Z5a');
  await warte(1000);
  ck('… nach 1 s noch im Warteraum, keine Meldung', p.kern.kurz().zustand === 'warteraum' && p.kern.abbild().meldung === null);
  ck('… STATE warteraum, alarm 0', p.kern.stateKv()?.zoom_status === 'warteraum' && p.kern.stateKv()?.zoom_alarm === 0);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_WARTERAUM: '1', FAKE_EINLASS_MS: '300' }) });
  await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Fall 9b: Einlass → im_meeting', await bis(() => p.kern.kurz().zustand === 'im_meeting'));
  ck('… Folge warteraum → tritt_bei → im_meeting', folge(p).join(',').endsWith('warteraum,tritt_bei,im_meeting'));
  ck('… nie abriss, zoom_alarm nie 1', !folge(p).includes('abriss') && p.kurze.every((k) => stateKvAus(k)?.zoom_alarm !== 1));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_WARTERAUM: '1', FAKE_EINLASS_MS: '300', FAKE_EINLASS_HAENGT: '1' }), fristen: { joinTimeoutMs: 500 } });
  await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Fall 9c: Einlass hängt → fehler', await bis(() => p.kern.kurz().zustand === 'fehler'));
  ck('… mit CE, erneutMoeglich', p.kern.abbild().meldung?.text === KT.CE && p.kern.abbild().erneutMoeglich);
  await p.aufraeumen();
}

console.log('— Meeting-Ende (Fall 19, 28), Beenden (Fall 20)');
{
  const p = baueKern({ stell: () => ({ FAKE_MEETING_ENDE_MS: '400' }) });
  ck('Fall 19: im Meeting', await insMeeting(p));
  ck('… nach dem Ende bereit mit Meldung', await bis(() => p.kern.kurz().zustand === 'bereit' && p.kern.abbild().meldung !== null));
  const a = p.kern.abbild();
  ck('… Meldung genau „Meeting beendet: vom Gastgeber beendet.“ (warnung)', a.meldung?.text === 'Meeting beendet: vom Gastgeber beendet.' && a.meldung.art === 'warnung');
  ck('… erneutMoeglich, Soll-Liste leer', a.erneutMoeglich && a.soll.length === 0 && a.kurz.sollOffen === 0);
  await warte(300);
  ck('… kein Wiederbeitritt (eine Bridge), STATE bereit/alarm 0', p.starts() === 1 && p.kern.stateKv()?.zoom_status === 'bereit' && p.kern.stateKv()?.zoom_alarm === 0);
  p.kern.schliessen();
  ck('… Schließen → Meldung weg, erneutMoeglich false', p.kern.abbild().meldung === null && !p.kern.abbild().erneutMoeglich);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_MEETING_ENDE_MS: '400' }) });
  await insMeeting(p);
  await bis(() => p.kern.abbild().meldung !== null);
  p.kern.meldungWeg();
  ck('Fall 28: meldungWeg nach Meeting-Ende → Meldung weg, Nummer bleibt (erneutMoeglich)', p.kern.abbild().meldung === null && p.kern.abbild().erneutMoeglich);
  ck('… erneut() startet eine neue Bridge', ok(await p.kern.erneut()) && p.starts() === 2);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_ABGANG_MS: '200' }) });
  await insMeeting(p);
  const t0 = Date.now();
  await p.kern.beenden(15_000);
  const dauer = Date.now() - t0;
  ck('Fall 20: beenden → quit gesendet, Ende vor der Frist', cmds(p, 1).includes('quit') && dauer < 15_000 && dauer >= 150);
  ck('… Zustand verlaesst, nichts läuft mehr', p.kern.kurz().zustand === 'verlaesst' && !p.kern.laeuft() && p.kern.kurz().quellen === 0);
  ck('… kein „nicht rechtzeitig“ im Log', !p.logs.includes('[zoom] Zoom-Bridge nicht rechtzeitig beendet'));
  await p.aufraeumen();
}
{
  const p = baueKern({ skript: 'stuck', fristen: { killTimeoutMs: 300 } });
  const lauf = p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  const t0 = Date.now();
  await p.kern.beenden(15_000);
  ck('Fall 20 (stuck): Ende per Kill nach killTimeoutMs', Date.now() - t0 < 2000 && p.logs.includes('[zoom] Zoom-Bridge hart beendet'));
  ck('… der abgebrochene Beitritt liefert ok:false ohne Text', text(await lauf) === '');
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_ABGANG_MS: '5000' }), fristen: { killTimeoutMs: 10_000 } });
  await insMeeting(p);
  const t0 = Date.now();
  await p.kern.beenden(300);
  ck('beenden mit kurzer Frist → kehrt nach der Frist zurück, Log „nicht rechtzeitig“',
    Date.now() - t0 < 1500 && p.logs.includes('[zoom] Zoom-Bridge nicht rechtzeitig beendet'));
  await p.aufraeumen();
}

console.log('— Verlassen (Fall 26, Review Focus 2) und Abriss in 4a');
{
  const p = baueKern();
  await insMeeting(p);
  const vorher = p.kurze.length;
  await p.kern.verlassen();
  const danach = p.kurze.slice(vorher);
  ck('Review Focus 2: Verlassen → verlaesst, dann bereit', danach.map((k) => k.zustand).join(',').startsWith('verlaesst') && p.kern.kurz().zustand === 'bereit');
  ck('… keine Meldung, kein „Meeting beendet“, erneutMoeglich false',
    p.kern.abbild().meldung === null && !p.logs.some((z) => z.includes('Meeting beendet')) && !p.kern.abbild().erneutMoeglich);
  ck('… zoom_alarm blieb 0', danach.every((k) => k.zustand !== 'fehler') && p.kern.stateKv()?.zoom_alarm === 0);
  ck('… das ended der stoppenden Bridge steht nur im Log', p.logs.some((z) => z.startsWith('[zoom] (Abbau) status ended')));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_VERBINDUNG_HAENGT_MS: '200' }), fristen: { joinTimeoutMs: 20_000 } });
  await insMeeting(p);
  ck('Fall 26: Zoom verbindet neu → abriss (Z10)', await bis(() => p.kern.kurz().zustand === 'abriss') && zoomZ(p.kern.kurz()) === 'Z10');
  ck('… Abbild abriss { versuch: null, versuche: 5, naechsterUm: null }, STATE alarm 1',
    JSON.stringify(p.kern.abbild().abriss) === '{"versuch":null,"versuche":5,"naechsterUm":null}' && p.kern.stateKv()?.zoom_alarm === 1);
  await p.kern.verlassen();
  ck('… Verlassen → bereit, keine Meldung, kein fehler, alarm 0', p.kern.kurz().zustand === 'bereit' && p.kern.abbild().meldung === null
    && !folge(p).includes('fehler') && p.kern.stateKv()?.zoom_alarm === 0);
  ck('… Soll-Liste, Nummer und Kenncode leer', p.kern.abbild().soll.length === 0 && !p.kern.abbild().erneutMoeglich);
  await p.aufraeumen();
}
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
{
  const p = baueKern();
  const lauf = p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  await p.kern.verlassen();
  ck('Verlassen während startet → bereit, keine Meldung', p.kern.kurz().zustand === 'bereit' && p.kern.abbild().meldung === null);
  ck('… der Beitritt liefert ok:false ohne Text', text(await lauf) === '');
  await warte(300);
  ck('… auch danach bereit, kein join, eine Bridge', p.kern.kurz().zustand === 'bereit' && !cmds(p).includes('join') && p.starts() === 1);
  await p.aufraeumen();
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: die Prüfungen der Aufgaben 10–12 `ok`, danach 16 `FAIL`-Zeilen, die erste
```
FAIL  Fall 9: im Warteraum (Z5a)
```
(Warteraum, Einlass, Meeting-Ende, Beenden; die Fälle warten dabei bis zu 4 s auf Zustände, die noch nicht kommen), zuletzt Abbruch mit
```
TypeError: p.kern.verlassen is not a function
```
Exit-Code 1.

- [ ] **Step 3: Import und Schnittstelle**

In `apps/connect/src/main/zoom/kern.ts`:

Vorher:
```ts
  dllMeldung,
  exitCodeAus,
```

Nachher:
```ts
  dllMeldung,
  endeMeldung,
  exitCodeAus,
```

Und:

Vorher:
```ts
  erneut(): Promise<ZoomErgebnis>;
  schliessen(): void;
```

Nachher:
```ts
  erneut(): Promise<ZoomErgebnis>;
  verlassen(): Promise<void>;
  schliessen(): void;
```

- [ ] **Step 4: Abriss im Abbild**

Vorher:
```ts
      abriss: null,
```

Nachher:
```ts
      abriss: zustand === 'abriss' ? { versuch: null, versuche: 5, naechsterUm: null } : null,
```

- [ ] **Step 5: Warteraum, Meeting-Ende und die vollständige Statusfolge**

`statusEreignis` aus Aufgabe 12 wird ganz ersetzt:

Vorher:
```ts
  function statusEreignis(e: StatusEreignis): void {
    const s = e.status;
    const name = d.einstellungen.anzeigename();
    if (zustand === 'tritt_bei' || zustand === 'warteraum') {
      if (s === 'inMeeting') imMeetingAngekommen();
      else if (s === 'failed') scheitert(failMeldung(VORSATZ.beitritt, e.code, name));
    }
  }
```

Nachher:
```ts
  function zumWarteraum(s: 'waitingRoom' | 'waitingForHost'): void {
    warten = s === 'waitingRoom' ? 'warteraum' : 'host';
    setzeZustand('warteraum');
  }

  /** Spec 6.5: Meeting-Ende durch den Host (nur aktive Bridge, nicht im Abbau). */
  function meetingEnde(code: number): void {
    const m = endeMeldung(code, d.einstellungen.anzeigename());
    void stoppeBridge();
    soll.clear();
    melde('warnung', m);
    setzeZustand('bereit');
  }

  function statusEreignis(e: StatusEreignis): void {
    const s = e.status;
    const name = d.einstellungen.anzeigename();
    if (s === 'ended') {
      if (zustand === 'tritt_bei' || zustand === 'warteraum' || zustand === 'im_meeting' || zustand === 'abriss') meetingEnde(e.code);
      return;
    }
    if (zustand === 'tritt_bei' || zustand === 'warteraum') {
      if (s === 'waitingRoom' || s === 'waitingForHost') zumWarteraum(s);
      // Gemessener Einlass aus dem Warteraum (3.2-19): kein Abriss, kein Alarm.
      else if ((s === 'reconnecting' || s === 'connecting') && zustand === 'warteraum') setzeZustand('tritt_bei');
      else if (s === 'inMeeting') imMeetingAngekommen();
      else if (s === 'failed') scheitert(failMeldung(VORSATZ.beitritt, e.code, name));
      return;
    }
    if (zustand === 'im_meeting' || zustand === 'abriss') {
      if (s === 'reconnecting' || s === 'connecting') {
        if (zustand === 'im_meeting') setzeZustand('abriss');
      } else if (s === 'inMeeting') {
        if (zustand === 'abriss') setzeZustand('im_meeting');
      } else if (s === 'waitingRoom' || s === 'waitingForHost') zumWarteraum(s);
      // 4a: kein Wiederbeitritt — jedes failed im Meeting ist endgültig (L1).
      else if (s === 'failed') scheitert(failMeldung(VORSATZ.verbindung, e.code, name));
    }
  }
```

- [ ] **Step 6: Fehler im Meeting (4a) und `verlassen()`**

Der Teil von `fehlerEreignis` nach dem Q12-Zweig wird ersetzt, `verlassen()` folgt direkt danach:

Vorher:
```ts
    if (zustand !== 'tritt_bei' && zustand !== 'warteraum') return;
    if (e.where === 'join' && e.code === 'joinTimeout') scheitert({ text: KT.CT, detail: fehlerDetail(e) });
    else if (e.where === 'join' && typeof e.code === 'number') scheitert({ text: KT.CJ(name), detail: fehlerDetail(e) });
    else if (e.where === 'exit' && e.code === 'exited') {
      scheitert(dllMeldung(exitCodeAus(e.detail)) ?? { text: KT.CB(e.detail ?? fehlerDetail(e)), detail: fehlerDetail(e) });
    }
  }
```

Nachher:
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
      if (amBeitreten) scheitert(dll ?? { text: KT.CB(detail), detail: fehlerDetail(e) });
      // 4a: statt Wiederbeitritt (L1).
      else if (imMeeting) scheitert(dll ?? { text: VORSATZ.verbindung + KT.UE_ABSTURZ(detail), detail: fehlerDetail(e) });
    }
  }

  /** Spec 6.8 „Verlassen“: Z3–Z11, ohne Fehler und ohne Alarm. */
  async function verlassen(): Promise<void> {
    if (!(zustand === 'startet' || zustand === 'tritt_bei' || zustand === 'warteraum' || zustand === 'im_meeting' || zustand === 'abriss')) return;
    laufNr += 1;
    d.log('[zoom] Meeting verlassen');
    setzeZustand('verlaesst');
    await stoppeBridge();
    soll.clear();
    nummer = null;
    kenncode = null;
    meldung = null;
    warImMeeting = false;
    setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
  }
```

- [ ] **Step 7: `beenden` mit Bridge und Frist**

Vorher:
```ts
    beendenVersprechen = (async () => {
      kopieAbbruch?.abort();
      d.log(`[zoom] Connect wird beendet (Frist ${fristMs} ms)`);
      // Spec 6.1: richteEin bricht nach der laufenden Datei ab und löscht <ziel>.teil selbst. Ohne dieses
      // Warten endet der Prozess vorher (before-quit ruft danach app.quit()) und .teil bliebe liegen.
      if (kopieLauf !== null && !(await mitFrist(kopieLauf, fristMs))) d.log('[zoom] SDK-Kopie nicht rechtzeitig abgebrochen');
      abbildGeaendert();
    })();
```

Nachher:
```ts
    beendenVersprechen = (async () => {
      laufNr += 1;
      kopieAbbruch?.abort();
      d.log(`[zoom] Connect wird beendet (Frist ${fristMs} ms)`);
      // Spec 6.1: richteEin bricht nach der laufenden Datei ab und löscht <ziel>.teil selbst. Ohne dieses
      // Warten endet der Prozess vorher (before-quit ruft danach app.quit()) und .teil bliebe liegen.
      if (kopieLauf !== null && !(await mitFrist(kopieLauf, fristMs))) d.log('[zoom] SDK-Kopie nicht rechtzeitig abgebrochen');
      // Kopie und Bridge laufen nie gleichzeitig (Sperre S10): insgesamt höchstens fristMs.
      if (aktiveBridge !== null) {
        setzeZustand('verlaesst');
        if (!(await mitFrist(stoppeBridge(), fristMs))) d.log('[zoom] Zoom-Bridge nicht rechtzeitig beendet');
      }
      soll.clear();
      nummer = null;
      kenncode = null;
      abbildGeaendert();
    })();
```

- [ ] **Step 8: `verlassen` in die öffentliche Fläche**

Vorher:
```ts
    erneut,
    schliessen,
```

Nachher:
```ts
    erneut,
    verlassen,
    schliessen,
```

- [ ] **Step 9: Test laufen lassen (grün)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: keine `FAIL`-Zeile, letzte Zeile unter Windows
```
195 ok, 0 fehlgeschlagen, 0 übersprungen.
```
unter Linux `192 ok, 0 fehlgeschlagen, 1 übersprungen.`, Exit-Code 0. Bleibt Fall 9b im Zustand `tritt_bei` hängen statt `im_meeting`, meldet die Attrappe den Einlass nicht (`FAKE_EINLASS_MS`, Aufgabe 3) — dann anhalten.

- [ ] **Step 10: Selbsttest und Typcheck**

```
npm run selftest -w @jm/connect
npm run typecheck -w @jm/connect
```
Erwartet: beide Exit-Code 0, keine `FAIL`-Zeile.

- [ ] **Step 11: Commit**

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
git commit -m "feat(connect): Zoom-Kern - Warteraum, Abriss ohne Wiederbeitritt (4a), Meeting-Ende, Verlassen, Beenden (Stage 4a)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Nicht pushen (G13).

**Gegenprobe (beim Planen am Prototyp gemessen, kein Umsetzungsschritt):** Jede dieser absichtlichen Abweichungen macht mindestens eine Prüfung rot (Spec 12.5): `reconnecting` im Warteraum als Abriss gedeutet → Fall 9b („… Folge warteraum → tritt_bei → im_meeting“, „… nie abriss, zoom_alarm nie 1“) und 9c (CE); `ended` der aktiven Bridge ignoriert → Fall 19 (vier `FAIL`), Fall 28 zweiter Teil und die Lebenslauf-Fälle in Aufgabe 15; `verlassen` ohne `laufNr + 1` → „Verlassen während startet … auch danach bereit, kein join, eine Bridge“; Ereignisse der stoppenden Bridge ausgewertet → „… das ended der stoppenden Bridge steht nur im Log“; `onKurz` nicht sofort → Review Focus 2 („Verlassen → verlaesst, dann bereit“) und „… vorher abriss, erneutMoeglich“.

**Abweichungen vom Gerüst:**
- `failed` im Zustand `warteraum` nach einem früheren `im_meeting` (der Host hat JM Connect in den Warteraum geschoben) trägt den Vorsatz „Beitritt gescheitert: “, wie 6.2 Schritt 5 es für `warteraum` vorschreibt (6.4: „In `tritt_bei` und `warteraum` gelten die Regeln aus 6.2 Schritt 5“).
- Fall 20 mit dem Drehbuch `stuck` ruft `beenden` während `startet`: `stuck` meldet die Vorgabe-Fassung der Attrappe und könnte sonst nie `im_meeting` erreichen. Die Startfolge erzeugt die Bridge synchron vor ihrem ersten `await`; `beenden` trifft also eine laufende Bridge, die auf `quit` nicht reagiert → Kill nach `killTimeoutMs` 300.
- Zusätzlicher Fall „beenden mit kurzer Frist“ (`FAKE_ABGANG_MS=5000`, Frist 300 ms) belegt die Logzeile „nicht rechtzeitig beendet“ (6.6).
- Zusätzlicher Fall 28 (zweiter Teil): `meldungWeg()` nach einem Meeting-Ende lässt Nummer und Kenncode stehen (`erneutMoeglich` bleibt), `erneut()` startet danach eine zweite Bridge.

---

### Task 14: Kern: Quellen, Laden/Entladen, Ton, Versatz an die Bridge, Kollision, Hinweise

**Spec:** 6.3 Laden Schritte 1, 2, 4, 5, 6, Entladen, Ton-Schalter, Kollision; 6.7 (Versatz an die laufende Bridge); 6.9 (Quellen einer gestoppten Generation verwerfen); 8.4 (Q1, Q2, Q4–Q6, Q8, Q9, Q13–Q17); 3.2-22/23; Tests 12.2 Fall 10, 10b, 11, 12, 13 (ohne Fernsteuer-Teil), 21 (ohne Fernsteuer-Teil), 23. Global Constraints G3, G9, G13, G14, G15.

**Files:**
- Modify: `apps/connect/src/main/zoom/kern.ts` (Stand nach Aufgabe 13), Zeilen 53–55 (Importe der Klartexte), 71 (Importe der Teilnehmer-Hilfen), 138–139 (Schnittstelle: laden(), entladen(), ton()), 228 (Zustand der Abos), 329–330 (hinweis()), 448–449 (Versatz an die laufende Bridge), 569 (neue Bridge, keine alten Ton-Wünsche), 673–676 (video- und audio-Ereignisse verteilen), 816–817 (Bild- und Tonfehler zuerst), 856 (Quellen), 914–915 (laden, entladen, ton in der öffentlichen Fläche)
- Modify: `apps/connect/test/zoom-kern.test.ts` (Stand nach Aufgabe 13), Zeile 981 (Ankerzeile)

Zeilenangaben gelten für den Stand vor dieser Aufgabe; maßgeblich ist der wortgleiche Vorher-Text (G14).

**Interfaces:**
- Consumes:
  - Aufgaben 11–13 (Closure): `sende(cmd)`, `aktiveSitzung()`, `aktiveQuellen()`, `quellen: Map<number, QuelleIntern>`, `aktiveGen`, `imAbbau`, `tonVorwahl`, `zeilenFehler`, `soll: SollListe`, `zustand`, `erlaubnis`, `hinweise`, `abbildGeaendert()`, `zeitgeber`, `type VideoEreignis`, `type AudioEreignis`, `type FehlerEreignis`; `beiEreignis` mit dem `switch` aus Aufgabe 12; `fehlerEreignis` beginnt mit `const name = e.name ?? String(e.code);`.
  - Aufgabe 9 (`teilnehmer.ts`): `normName(name: string): string`, `ndiVorschau(name: string): string` (= „JM Connect – Zoom “ + Name); `baueTeilnehmer` setzt `kollision = KT.Q10(ndiName)`, wenn der NDI-Name (Quelle, sonst Vorschau) nach NFC und ohne Groß-/Kleinschreibung einem Gast-Label gleicht.
  - Aufgabe 6 (`klartext.ts`): `quellenFehler(code: string, name: string, person: string | null, dropped?: number): Einordnung` (`{ art: 'zeile' | 'hinweis'; text }` oder `{ art: 'keine' }`), `tonZustand(state: AudioState, reason: AudioReason): Einordnung`, `KT.Q1`, `KT.Q2`, `KT.Q8`, `KT.Q9(n)`, `KT.Q10(ndiName)`, `KT.Q13`, `KT.Q14`, `KT.Q15`.
  - Aufgabe 3 (Attrappe): `FAKE_TEILNEHMER`, `FAKE_DOPPELNAME=1` (16778241 heißt ebenfalls „Anna“), `FAKE_ENTZUG_MS`, `FAKE_PRIVILEGE=nein`, `FAKE_ABSTURZ_MS`; auf `videoSubscribe` antwortet sie mit `video subscribed` (`source` „JM Connect – Zoom <Name>“) und `audio waiting` bzw. `audio off`/`command` ohne Ton, auf `videoUnsubscribe` mit `audio off` (nur bei laufendem Ton) und `video unsubscribed`; `videoDelay` bestätigt sie mit `{ ev: 'videoDelay', ms }`.
- Produces:
  ```ts
  export interface ZoomKern { /* … */
    laden(e: { id: number; ton: boolean; trotzBetriebsgroesse: boolean }): Promise<ZoomErgebnis>;
    entladen(e: { aboId: number }): Promise<ZoomErgebnis>;
    ton(e: { id: number; an: boolean }): ZoomErgebnis;
  }
  // intern, für 15 verbindlich:
  const tonAngefragt: Map<number, boolean>; const aboFristen: Map<number, ReturnType<typeof setTimeout>>;
  function hinweis(text: string): void;                 // höchstens HINWEISE_MAX, neueste am Ende, ins Log
  function abonniere(id: number, ton: boolean): void;   // videoSubscribe 720p + Abo-Frist Q8
  function videoEreignis(e: VideoEreignis): void;       // Aufgabe 15 ergänzt Abmeldung und Soll-Nachführung
  // laden() enthält die Zeilen
  //     const schluessel = normName(p.name);
  //     abonniere(e.id, e.ton);
  // zwischen die Aufgabe 15 Laden Schritt 3 setzt.
  ```

**Verhalten (verbindlich, aus der Spec):**
- Quellen aus Ereignissen der aktiven Generation: `video` `subscribed`/`live`/`black` → `ZoomQuelle` (`aboId`, `ndiName` = `source` wörtlich, `bild`, `bildGrund`, `ton`, `tonGrund`, `fehler`); `unsubscribed` → Quelle weg. `rebound`/`reboundByName` → die Quelle mit gleicher `source` und anderer ID verschwindet, die neue übernimmt Ton und Fehler (Logzeile `[zoom] Quelle <alt> → <neu> umgehängt (<grund>)`). Startwert des Tons: `aus`, wenn ohne Ton geladen, sonst `waiting`.
- Ton: `audio off`/`command` nach Laden ohne Ton → `ton: 'aus'`, `tonGrund: null`; sonst `ton` = Zustand, `tonGrund` = Grund; `tonZustand` → Q5 als `quelle.fehler` (`off`/`audioUnavailable`).
- `laden({ id, ton, trotzBetriebsgroesse })`: außerhalb `im_meeting` → `{ ok: false, text: '' }` (L9); `erlaubnis !== 'ja'` → Q1; Teilnehmer unbekannt (oder die eigene Zeile) → Q2; im Warteraum → Q15; schon ≥ `BETRIEBSGROESSE` Quellen und nicht `trotzBetriebsgroesse` → Q9(n + 1); sonst `videoSubscribe { id, resolution: AUFLOESUNG, audio: ton }`, Soll-Eintrag unter `normName(name)` = `{ name, ton, ndiName: ndiVorschau(name), aboId: id }` setzen/ersetzen, Abo-Frist `aboAntwortMs`: kommt bis dahin weder ein `video`-Ereignis noch ein Fehler mit dieser `id`, trägt die Zeile Q8.
- `entladen({ aboId })`: Soll-Eintrag mit dieser `aboId` entfernen, dann `videoUnsubscribe(aboId)`; weder Quelle noch Soll-Eintrag → Q2.
- `ton({ id, an })`: Quelle vorhanden → Q14; sonst Vorwahl je Teilnehmer-**ID** (nie je Name).
- `versatz` (Teil 3): gültiger Wert → speichern **und**, wenn eine Bridge läuft, `videoDelay { ms }`; `bestaetigtMs` kommt aus der Sitzung (Aufgabe 11). Ungültig → Q13, nichts gesendet.
- `error where:'video'|'audio'` → `quellenFehler(code, name, person, dropped)`: `zeile` → `quelle.fehler` bzw. `zeilenFehler` der ID; `hinweis` (oder ohne ID) → `hinweise` (höchstens 5, neueste am Ende, ins Log); `keine` (Q3) → nichts.
- Kollision: `gastLabels()` bei jedem Abbild (über `baueTeilnehmer`); `gastLabelsGeaendert()` stößt ein Abbild an.
- 6.9: Stürzt die Bridge mit geladener Quelle ab (kein `unsubscribed`), verwirft `stoppeBridge` die Quellen der Generation; `n` geht auf 0.

- [ ] **Step 1: Fehlschlagende Tests schreiben (Fall 10, 10b, 11, 12, 13, 21, 23, Q8, Absturz mit Quelle)**

In `apps/connect/test/zoom-kern.test.ts` direkt über der Ankerzeile einfügen.

Vorher:
```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

Nachher:
```ts
// ── Aufgabe 14: Quellen, Laden/Entladen, Ton, Versatz, Kollision ─────────────
const ANNA = 16778240;
const BEN = 16778241;
const CARLA = 16778242;
function zeile(p: Probe, id: number): ZoomAbbild['teilnehmer'][number] | undefined {
  return p.kern.abbild().teilnehmer.find((t) => t.id === id);
}

console.log('— Laden und Entladen (Fall 10, 10b, 11, 12)');
{
  const p = baueKern({ stell: () => ({ FAKE_PRIVILEGE: 'nein' }) });
  await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  await bis(() => p.kern.kurz().erlaubnis === 'abgelehnt');
  ck('Fall 10: Laden ohne Erlaubnis → Q1, kein videoSubscribe',
    text(await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false })) === KT.Q1 && !cmds(p).includes('videoSubscribe'));
  await p.aufraeumen();
}
{
  const p = baueKern();
  ck('Laden außerhalb des Meetings → ok:false ohne Text', text(await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false })) === '');
  await insMeeting(p);
  ck('Laden eines Unbekannten → Q2', text(await p.kern.laden({ id: 4242, ton: true, trotzBetriebsgroesse: false })) === KT.Q2);
  ck('Ton-Schalter Ben aus (ohne Quelle) → ok, nur Bens Zeile', ok(p.kern.ton({ id: BEN, an: false }))
    && zeile(p, BEN)?.tonVorwahl === false && zeile(p, ANNA)?.tonVorwahl === true);
  const r = await p.kern.laden({ id: BEN, ton: zeile(p, BEN)?.tonVorwahl ?? true, trotzBetriebsgroesse: false });
  const sub = p.befehle(1).find((c) => c.cmd === 'videoSubscribe');
  ck('Fall 11: videoSubscribe mit 720p und Ton nach Schalter (aus)', ok(r) && sub?.id === BEN && sub.resolution === '720p' && sub.audio === false);
  ck('… Quelle „JM Connect – Zoom Ben“, ohne Ton geladen', await bis(() => zeile(p, BEN)?.quelle?.ndiName === 'JM Connect – Zoom Ben')
    && (await bis(() => zeile(p, BEN)?.quelle?.ton === 'aus')));
  ck('… STATE zoom_sources=1, zoom_live=1, Z9b (erstes Bild steht aus)', p.kern.stateKv()?.zoom_sources === 1 && p.kern.stateKv()?.zoom_live === 1
    && zoomZ(p.kern.kurz()) === 'Z9b');
  ck('Ton-Schalter bei geladener Quelle → Q14', text(p.kern.ton({ id: BEN, an: true })) === KT.Q14);
  ck('Entladen → ok', ok(await p.kern.entladen({ aboId: BEN })));
  ck('… Quelle weg, STATE zoom_sources=0, zoom_live=0',
    (await bis(() => p.kern.kurz().quellen === 0)) && p.kern.stateKv()?.zoom_sources === 0 && p.kern.stateKv()?.zoom_live === 0);
  ck('Entladen einer unbekannten Quelle → Q2', text(await p.kern.entladen({ aboId: 4242 })) === KT.Q2);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_ENTZUG_MS: '200' }) });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  ck('Fall 10b: Anna geladen', await bis(() => p.kern.kurz().quellen === 1));
  ck('… Erlaubnis entzogen', await bis(() => p.kern.kurz().erlaubnis === 'entzogen'));
  ck('… Z7b mit „vom Host entzogen“', zoomZ(p.kern.kurz()) === 'Z7b' && String(kartenZeile(p.kern.abbild(), Date.now())).includes('vom Host entzogen'));
  await p.kern.entladen({ aboId: ANNA });
  await bis(() => p.kern.kurz().quellen === 0);
  const zeileZ7 = String(kartenZeile(p.kern.abbild(), Date.now()));
  ck('… nach dem Entladen Z7 mit „Der Host hat sie entzogen.“, nicht Z6', zoomZ(p.kern.kurz()) === 'Z7' && zeileZ7.includes('Der Host hat sie entzogen.'));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_TEILNEHMER: '6' }) });
  await insMeeting(p);
  const ids = p.kern.abbild().teilnehmer.map((t) => t.id);
  for (const id of ids.slice(0, 5)) await p.kern.laden({ id, ton: true, trotzBetriebsgroesse: false });
  ck('Fall 12: fünf Quellen geladen', ids.length === 6 && (await bis(() => p.kern.kurz().quellen === 5)));
  const sechs = await p.kern.laden({ id: ids[5], ton: true, trotzBetriebsgroesse: false });
  ck('… die 6. ohne trotzBetriebsgroesse → Q9 mit „6.“', text(sechs) === KT.Q9(6));
  ck('… mit trotzBetriebsgroesse geladen', ok(await p.kern.laden({ id: ids[5], ton: true, trotzBetriebsgroesse: true }))
    && (await bis(() => p.kern.kurz().quellen === 6)));
  await p.aufraeumen();
}

console.log('— Doppelname, Versatz, Kollision, Q8 (Fall 13, 21, 23)');
{
  const p = baueKern({ stell: () => ({ FAKE_DOPPELNAME: '1' }) });
  await insMeeting(p);
  ck('Fall 13: beide „Anna“ tragen doppelname', zeile(p, ANNA)?.doppelname === true && zeile(p, BEN)?.doppelname === true && zeile(p, BEN)?.name === 'Anna');
  p.kern.ton({ id: BEN, an: false });
  ck('… Ton der einen umschalten ändert die andere nicht', zeile(p, BEN)?.tonVorwahl === false && zeile(p, ANNA)?.tonVorwahl === true);
  await p.aufraeumen();
}
{
  const p = baueKern();
  await insMeeting(p);
  const vorher = cmds(p, 1).filter((c) => c === 'videoDelay').length;
  ck('Fall 21: 1001 → Q13', text(p.kern.versatz({ ms: 1001 })) === KT.Q13);
  ck('… 1.5 → Q13', text(p.kern.versatz({ ms: 1.5 })) === KT.Q13);
  await warte(100);
  ck('… dabei kein videoDelay gesendet, nichts gespeichert', cmds(p, 1).filter((c) => c === 'videoDelay').length === vorher && p.einst.versatzMs === 0);
  ck('… 250 → ok', ok(p.kern.versatz({ ms: 250 })));
  ck('… videoDelay 250 gesendet und bestätigt', await bis(() => p.kern.abbild().versatz.bestaetigtMs === 250)
    && p.befehle(1).filter((c) => c.cmd === 'videoDelay').at(-1)?.ms === 250);
  ck('… gespeichert', p.einst.versatzMs === 250 && p.kern.abbild().versatz.gewuenschtMs === 250);
  await p.aufraeumen();
}
{
  let labels: string[] = [];
  const p = baueKern({ gastLabels: () => labels });
  await insMeeting(p);
  ck('ohne Gast-Label keine Kollision', zeile(p, ANNA)?.kollision === null);
  labels = ['JM Connect – zoom anna'];
  p.kern.gastLabelsGeaendert();
  ck('Fall 23: Gast „JM Connect – zoom anna“ → Annas Zeile trägt Q10', zeile(p, ANNA)?.kollision === KT.Q10('JM Connect – Zoom Anna') && zeile(p, BEN)?.kollision === null);
  const vorher = p.abbilder.length;
  p.kern.gastLabelsGeaendert();
  ck('… gastLabelsGeaendert() stößt ein Abbild an', await bis(() => p.abbilder.length > vorher, 500));
  await p.aufraeumen();
}
{
  const p = baueKern({ sendeFilter: (c) => c.cmd !== 'videoSubscribe', fristen: { aboAntwortMs: 300 } });
  await insMeeting(p);
  ck('Q8: Laden ohne Antwort der Bridge → ok', ok(await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false })));
  ck('… nach aboAntwortMs trägt Annas Zeile Q8', await bis(() => zeile(p, ANNA)?.fehler === KT.Q8, 1500));
  await p.aufraeumen();
}
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

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: die 194 Prüfungen der Aufgaben 10–13 `ok` (unter Linux 191 und 1 übersprungen), danach Abbruch mit
```
TypeError: p.kern.laden is not a function
```
Exit-Code 1.

- [ ] **Step 3: Importe, Schnittstelle, Zustand der Abos**

In `apps/connect/src/main/zoom/kern.ts`:

Vorher:
```ts
  maskiere,
  spawnMeldung,
  type Meldungstext,
```

Nachher:
```ts
  maskiere,
  quellenFehler,
  spawnMeldung,
  tonZustand,
  type Meldungstext,
```

Und:

Vorher:
```ts
import { baueTeilnehmer, zaehleQuellen } from './teilnehmer';
```

Nachher:
```ts
import { baueTeilnehmer, ndiVorschau, normName, zaehleQuellen } from './teilnehmer';
```

Und:

Vorher:
```ts
  verlassen(): Promise<void>;
  schliessen(): void;
```

Nachher:
```ts
  verlassen(): Promise<void>;
  laden(e: { id: number; ton: boolean; trotzBetriebsgroesse: boolean }): Promise<ZoomErgebnis>;
  entladen(e: { aboId: number }): Promise<ZoomErgebnis>;
  ton(e: { id: number; an: boolean }): ZoomErgebnis;
  schliessen(): void;
```

Und:

Vorher:
```ts
  const zeilenFehler = new Map<number, string>();
```

Nachher:
```ts
  const zeilenFehler = new Map<number, string>();
  const tonAngefragt = new Map<number, boolean>();
  const aboFristen = new Map<number, ReturnType<typeof setTimeout>>();
```

- [ ] **Step 4: `hinweis()`, Versatz an die Bridge, neue Bridge ohne alte Ton-Wünsche**

Vorher:
```ts
    d.log(`[zoom] Meldung (${art}): ${m.text}${m.detail ? ` [${m.detail}]` : ''}`);
  }
```

Nachher:
```ts
    d.log(`[zoom] Meldung (${art}): ${m.text}${m.detail ? ` [${m.detail}]` : ''}`);
  }

  function hinweis(text: string): void {
    hinweise.push(text);
    while (hinweise.length > HINWEISE_MAX) hinweise.shift();
    d.log(`[zoom] Hinweis: ${text}`);
  }
```

Und (in `versatz`):

Vorher:
```ts
    d.einstellungen.setzeVersatzMs(e.ms);
    abbildGeaendert();
```

Nachher:
```ts
    d.einstellungen.setzeVersatzMs(e.ms);
    sende({ cmd: 'videoDelay', ms: e.ms });
    abbildGeaendert();
```

Und (in `starteBridge`):

Vorher:
```ts
    zeilenFehler.clear();
```

Nachher:
```ts
    zeilenFehler.clear();
    tonAngefragt.clear();
```

- [ ] **Step 5: `video`/`audio` verteilen, Bild- und Tonfehler zuerst**

In `beiEreignis`:

Vorher:
```ts
      case 'error':
        fehlerEreignis(ev as unknown as FehlerEreignis);
        break;
    }
```

Nachher:
```ts
      case 'error':
        fehlerEreignis(ev as unknown as FehlerEreignis);
        break;
      case 'video':
        videoEreignis(ev as unknown as VideoEreignis);
        break;
      case 'audio':
        audioEreignis(ev as unknown as AudioEreignis);
        break;
    }
```

Und am Anfang von `fehlerEreignis`:

Vorher:
```ts
  function fehlerEreignis(e: FehlerEreignis): void {
    const name = e.name ?? String(e.code);
```

Nachher:
```ts
  function fehlerEreignis(e: FehlerEreignis): void {
    if (e.where === 'video' || e.where === 'audio') {
      quellenFehlerEreignis(e);
      return;
    }
    const name = e.name ?? String(e.code);
```

- [ ] **Step 6: Quellen, Laden, Entladen, Ton**

Der neue Abschnitt kommt direkt vor den Abschnitt „Beenden“:

Vorher:
```ts
  // ── Beenden (Spec 6.6) ───────────────────────────────────────────────────
```

Nachher:
```ts
  // ── Quellen (Spec 6.3, 8.4) ──────────────────────────────────────────────
  function aboBeantwortet(id: number): void {
    const t = aboFristen.get(id);
    if (t === undefined) return;
    clearTimeout(t);
    aboFristen.delete(id);
  }

  function abonniere(id: number, ton: boolean): void {
    zeilenFehler.delete(id);
    tonAngefragt.set(id, ton);
    if (!sende({ cmd: 'videoSubscribe', id, resolution: AUFLOESUNG, audio: ton })) return;
    aboBeantwortet(id);
    const gen = aktiveGen;
    aboFristen.set(
      id,
      zeitgeber(f.aboAntwortMs, () => {
        aboFristen.delete(id);
        if (gen !== aktiveGen || imAbbau.has(gen)) return;
        zeilenFehler.set(id, KT.Q8);
        d.log(`[zoom] Abo ${id}: keine Antwort der Zoom-Bridge`);
        abbildGeaendert();
      }),
    );
  }

  function videoEreignis(e: VideoEreignis): void {
    aboBeantwortet(e.id);
    if (e.state === 'unsubscribed') {
      quellen.delete(e.id);
      return;
    }
    let alt = quellen.get(e.id);
    if (e.reason === 'rebound' || e.reason === 'reboundByName') {
      for (const [id, q] of quellen) {
        if (id === e.id || q.gen !== aktiveGen || q.ndiName !== e.source) continue;
        quellen.delete(id);
        alt = alt ?? q;
        tonAngefragt.set(e.id, tonAngefragt.get(id) ?? true);
        d.log(`[zoom] Quelle ${id} → ${e.id} umgehängt (${e.reason})`);
      }
    }
    zeilenFehler.delete(e.id);
    quellen.set(e.id, {
      gen: aktiveGen,
      aboId: e.id,
      ndiName: e.source,
      bild: e.state,
      bildGrund: e.reason,
      ton: alt?.ton ?? (tonAngefragt.get(e.id) === false ? 'aus' : 'waiting'),
      tonGrund: alt?.tonGrund ?? null,
      fehler: alt?.fehler ?? null,
    });
  }

  function audioEreignis(e: AudioEreignis): void {
    const q = quellen.get(e.id);
    if (!q || q.gen !== aktiveGen) return;
    if (e.state === 'off' && e.reason === 'command' && tonAngefragt.get(e.id) === false) {
      q.ton = 'aus';
      q.tonGrund = null;
    } else {
      q.ton = e.state;
      q.tonGrund = e.reason;
    }
    const t = tonZustand(e.state, e.reason);
    if (t.art === 'zeile') q.fehler = t.text;
  }

  function quellenFehlerEreignis(e: FehlerEreignis): void {
    const id = typeof e.id === 'number' ? e.id : null;
    if (id !== null) aboBeantwortet(id);
    const person = id !== null ? (aktiveSitzung()?.participants.get(id)?.name ?? null) : null;
    const einordnung = quellenFehler(String(e.code), e.name ?? String(e.code), person, e.dropped);
    if (einordnung.art === 'keine') return;
    if (einordnung.art === 'hinweis' || id === null) {
      hinweis(einordnung.text);
      return;
    }
    const q = quellen.get(id);
    if (q && q.gen === aktiveGen) q.fehler = einordnung.text;
    else zeilenFehler.set(id, einordnung.text);
  }

  async function laden(e: { id: number; ton: boolean; trotzBetriebsgroesse: boolean }): Promise<ZoomErgebnis> {
    if (zustand !== 'im_meeting') return { ok: false, text: '' };
    if (erlaubnis !== 'ja') return { ok: false, text: KT.Q1 };
    const s = aktiveSitzung();
    const p = s?.participants.get(e.id);
    if (!s || !p || p.self) return { ok: false, text: KT.Q2 };
    if (p.inWaitingRoom) return { ok: false, text: KT.Q15 };
    const n = aktiveQuellen().size;
    if (n >= BETRIEBSGROESSE && !e.trotzBetriebsgroesse) return { ok: false, text: KT.Q9(n + 1) };
    const schluessel = normName(p.name);
    abonniere(e.id, e.ton);
    soll.set(schluessel, { name: p.name, ton: e.ton, ndiName: ndiVorschau(p.name), aboId: e.id });
    d.log(`[zoom] Quelle laden: Teilnehmer ${e.id}${e.ton ? '' : ' (ohne Ton)'}`);
    abbildGeaendert();
    return { ok: true };
  }

  async function entladen(e: { aboId: number }): Promise<ZoomErgebnis> {
    let vergessen = false;
    for (const [k, s] of soll) {
      if (s.aboId !== e.aboId) continue;
      soll.delete(k);
      vergessen = true;
    }
    const q = quellen.get(e.aboId);
    const gesendet = q !== undefined && q.gen === aktiveGen && sende({ cmd: 'videoUnsubscribe', id: e.aboId });
    if (gesendet || vergessen) d.log(`[zoom] Quelle ${e.aboId} entladen`);
    abbildGeaendert();
    return gesendet || vergessen ? { ok: true } : { ok: false, text: KT.Q2 };
  }

  function ton(e: { id: number; an: boolean }): ZoomErgebnis {
    if (aktiveQuellen().has(e.id)) return { ok: false, text: KT.Q14 };
    tonVorwahl.set(e.id, e.an);
    abbildGeaendert();
    return { ok: true };
  }

  // ── Beenden (Spec 6.6) ───────────────────────────────────────────────────
```

- [ ] **Step 7: `laden`, `entladen`, `ton` in die öffentliche Fläche**

Vorher:
```ts
    verlassen,
    schliessen,
```

Nachher:
```ts
    verlassen,
    laden,
    entladen,
    ton,
    schliessen,
```

- [ ] **Step 8: Test laufen lassen (grün)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: keine `FAIL`-Zeile, letzte Zeile unter Windows
```
228 ok, 0 fehlgeschlagen, 0 übersprungen.
```
unter Linux `225 ok, 0 fehlgeschlagen, 1 übersprungen.`, Exit-Code 0. Tragen in Fall 13 nicht beide „Anna“-Zeilen `doppelname`, fehlt `FAKE_DOPPELNAME` in der Attrappe (Aufgabe 3) oder `baueTeilnehmer` zählt nicht nach `normName` (Aufgabe 9) — dann anhalten.

- [ ] **Step 9: Selbsttest und Typcheck**

```
npm run selftest -w @jm/connect
npm run typecheck -w @jm/connect
```
Erwartet: beide Exit-Code 0, keine `FAIL`-Zeile.

- [ ] **Step 10: Commit**

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
git commit -m "feat(connect): Zoom-Kern - Quellen laden und entladen, Ton, Versatz an die Bridge, Kollision (Stage 4a)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Nicht pushen (G13).

**Gegenprobe (beim Planen am Prototyp gemessen, kein Umsetzungsschritt):** Jede dieser absichtlichen Abweichungen macht mindestens eine Prüfung rot: Ton-Vorwahl je Name statt je Teilnehmer-ID → Fall 13 „… Ton der einen umschalten ändert die andere nicht“ (Spec 12.5); Betriebsgröße nicht geprüft → Fall 12 „… die 6. ohne trotzBetriebsgroesse → Q9“; Erlaubnis „entzogen“ nicht erkannt (Tabelle aus Aufgabe 12) → Fall 10b (drei `FAIL`); Quellen einer gestoppten Generation nicht verworfen (Regel aus Aufgabe 11) → „… ohne unsubscribed verwirft der Kern nach stop() die Quellen dieser Generation“.

**Abweichungen vom Gerüst:**
- Laden der eigenen Zeile (`self`) antwortet wie ein unbekannter Teilnehmer mit Q2; die Karte zeigt die eigene Zeile nie (5.4).
- Q15 (Laden im Warteraum) hat keinen Test: Die Attrappe kennt keine fremden Teilnehmer im Warteraum (Aufgabe 3). Der Zweig ist eine Zeile vor der Betriebsgröße.
- `entladen` eines Soll-Eintrags, dessen Quelle schon weg ist (neue Bridge), antwortet `{ ok: true }` und vergisst den Eintrag; erst wenn weder Quelle noch Eintrag existieren, kommt Q2.
- Zusätzlicher Fall „Absturz mit geladener Quelle“ belegt die Regel aus 6.9 (Quellen der gestoppten Generation verwerfen), die Aufgabe 11 eingebaut hat: Ohne `unsubscribed` stünde `n` sonst dauerhaft auf 1.

---

### Task 15: Kern: Soll-Liste und Abgleich

**Spec:** 4 (Begriffe „Soll-Liste“, „Offener Soll-Eintrag“, „Verwaiste Quelle“), 6.3 (Abgleich der Soll-Liste mit der Tabelle, Laden Schritt 3, Lebenslauf der Soll-Liste), Ergänzung 0.9 und 0.16, 7.5 (`sollOffen` → `zoom_alarm`); Tests 12.2 Fall 14 und 14b; 4a-Ersatz für Fall 15 („Erneut beitreten“ statt Wiederbeitritt). Global Constraints G3 (300 ms bleiben in 14/14b unverändert), G13, G14, G15.

**Files:**
- Modify: `apps/connect/src/main/zoom/kern.ts` (Stand nach Aufgabe 14), Zeilen 39–40 (Import des Soll-Typs), 72–73 (Importe der Soll-Liste), 143–144 (Schnittstelle: sollVerwerfen()), 235 (Zustand des Abgleichs), 261 (sollLage() und sollOffen()), 269 (sollOffen in der Kurzform), 294 (Soll-Einträge im Abbild), 694–697 (Teilnehmeränderungen lösen den Abgleich aus), 780–782 (Abgleich beim Eintritt ins Meeting), 816–818 (Abgleich nach Zooms eigener Neuverbindung), 833–835 (Abgleich nach Erlaubnis „ja“), 909–912 (Abmeldung melden), 919 (Soll-Eintrag folgt dem Umhängen), 932–934 (NDI-Name des Soll-Eintrags), 974–975 (Laden Schritt 3), 1003 (Soll-Liste und Abgleich), 1064–1065 (sollVerwerfen in der öffentlichen Fläche)
- Modify: `apps/connect/test/zoom-kern.test.ts` (Stand nach Aufgabe 14), Zeile 1099 (Ankerzeile)

Zeilenangaben gelten für den Stand vor dieser Aufgabe; maßgeblich ist der wortgleiche Vorher-Text (G14).

**Interfaces:**
- Consumes:
  - Aufgaben 11–14 (Closure): `aktiveSitzung()`, `aktiveQuellen()`, `quellen`, `soll: SollListe`, `abonniere(id, ton)`, `sende(cmd)`, `zeitgeber`, `aktiveGen`, `imAbbau`, `zustand`, `erlaubnis`; `imMeetingAngekommen()`, `statusEreignis` (Zweig `inMeeting` in `abriss` aus Aufgabe 13), `privilegEreignis` (endet mit der Logzeile `Aufnahme-Erlaubnis`), `videoEreignis` und `laden` aus Aufgabe 14, der `switch` in `beiEreignis`.
  - Aufgabe 9 (`soll.ts`): `interface SollEintrag { name; ton; ndiName; aboId: number | null }`, `type SollListe = Map<string, SollEintrag>` (Schlüssel `normName(name)`), `interface SollLage { teilnehmer: ReadonlyArray<{ id; name; imWarteraum }>; abos: ReadonlyMap<number, { verwaist: boolean }> }`, `type SollHandlung = { art: 'abonnieren'; schluessel; id; ton } | { art: 'neuLaden'; schluessel; altAboId; id; ton }`, `sollAbbild(soll: SollListe, lage: SollLage): ZoomSollEintrag[]` (nur offene Einträge: `wartet`, `doppelname`, `verwaist`), `sollHandlungen(soll: SollListe, lage: SollLage): SollHandlung[]` (Tabelle 6.3; eine `aboId`, die in `lage.abos` fehlt, zählt als „kein Abo“). (`teilnehmer.ts`): `istVerwaist(aboId: number, teilnehmerIds: ReadonlySet<number>, bild: { state: string; reason: string } | undefined): boolean`, `normName`.
  - Aufgabe 3 (Attrappe): `FAKE_WIEDERBEITRITT_MS` (Anna 16778240 geht: `left`, `video black`/`participantLeft`, ggf. `audio off`/`participantLeft`), `FAKE_RUECKKEHR_MS` (Abstand bis `joined` 16778250), `FAKE_RUECKKEHR_NAME` (anderer Name → **kein** Umhängen), `FAKE_DOPPELNAME`, `FAKE_TEILNEHMER`, `FAKE_VERBINDUNG_WEG_MS`, `FAKE_MEETING_ENDE_MS`; beim gleichen Namen hängt sie das Abo über `video subscribed`/`reboundByName` unter 16778250 um.
- Produces:
  ```ts
  export interface ZoomKern { /* … */ sollVerwerfen(e: { name: string }): void }
  // intern:
  function sollLage(): SollLage; function sollOffen(): ZoomSollEintrag[];
  function abgleichPlanen(): void;            // Zeitgeber abgleichMs (300), bei jedem Auslöser neu
  function abgleichen(): Promise<void>;
  function abmeldungAbwarten(id: number): Promise<void>;   // höchstens unsubscribeWarteMs (2 s)
  // kurz().sollOffen = sollOffen().length; abbild().soll = sollOffen()
  ```

**Verhalten (verbindlich, aus der Spec):**
- **Stand** jedes Soll-Eintrags rechnet der Kern bei jedem Abbild neu: `abbild.soll = sollAbbild(soll, sollLage())`, `kurz.sollOffen = abbild.soll.length`. `sollLage()`: fremde Teilnehmer der aktiven Sitzung (auch im Warteraum) und je Abo der aktiven Generation `verwaist = istVerwaist(aboId, alleIds, { state: bild, reason: bildGrund })` (Teilnehmer fehlt **oder** `black`/`participantLeft`). Ohne aktive Bridge sind alle Einträge offen (`wartet`).
- **Handlungen** nur in `im_meeting` mit `erlaubnis 'ja'`, `abgleichMs` (300) nach `roster`, `joined`, `left`, `renamed`, nach `inMeeting` (Eintritt und Rückkehr aus Z10) und nach Erlaubnis → `ja`; jeder Auslöser startet den Zeitgeber neu. `abonnieren` → `videoSubscribe` mit dem Ton des Soll-Eintrags, `aboId` des Eintrags = neue ID. `neuLaden` → `videoUnsubscribe(altAboId)`, auf dessen `unsubscribed` warten (höchstens `unsubscribeWarteMs`), dann `videoSubscribe(id)` mit dem Ton des Soll-Eintrags. Doppelnamen werden nie automatisch abonniert.
- **Laden Schritt 3:** Gibt es zum normierten Namen einen Soll-Eintrag mit **verwaister** Quelle (andere ID), zuerst `videoUnsubscribe(alt)` und auf `unsubscribed` warten (höchstens 2 s), dann wie bisher laden — so bleibt der NDI-Name gleich.
- **Umhängen:** `rebound`/`reboundByName` → die `aboId` des Soll-Eintrags folgt der neuen ID; jedes `video`-Ereignis schreibt `source` als `ndiName` in den Eintrag mit dieser `aboId`; `unsubscribed` weckt wartende `abmeldungAbwarten`.
- `sollVerwerfen({ name })`: Eintrag zu `normName(name)` entfernen (Karte „Vergessen“).
- **Lebenslauf** (seit den Aufgaben 10–13 so verdrahtet, hier mit Einträgen belegt): leer bei `verlassen`, `schliessen`, Meeting-Ende, `beenden`, neuem `beitreten` und einem Mangel; bleibt beim 4a-Abriss → `fehler` und bei `erneut()`.

- [ ] **Step 1: Fehlschlagende Tests schreiben (Fall 14, 14b, „Erneut beitreten“ mit Soll-Liste, Vergessen, Lebenslauf)**

In `apps/connect/test/zoom-kern.test.ts` direkt über der Ankerzeile einfügen.

Vorher:
```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

Nachher:
```ts
// ── Aufgabe 15: Soll-Liste und Abgleich ──────────────────────────────────────
console.log('— Teilnehmer-Wiederbeitritt (Fall 14, 14b)');
{
  const p = baueKern({ stell: () => ({ FAKE_WIEDERBEITRITT_MS: '600', FAKE_RUECKKEHR_MS: '200' }) });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  ck('Fall 14: Anna geladen', await bis(() => p.kern.kurz().quellen === 1));
  ck('… beim Weggang black/participantLeft, Soll-Stand verwaist', await bis(() => p.kern.abbild().soll[0]?.stand === 'verwaist', 2000)
    && p.kern.abbild().soll[0]?.aboId === ANNA && p.kern.kurz().sollOffen === 1);
  ck('… danach hängt die Quelle unter 16778250 (reboundByName)', await bis(() => zeile(p, 16778250)?.quelle?.bildGrund === 'reboundByName', 2000));
  await warte(600);
  const c = cmds(p, 1);
  ck('… Connect sendet weder videoUnsubscribe noch ein zweites videoSubscribe',
    !c.includes('videoUnsubscribe') && c.filter((x) => x === 'videoSubscribe').length === 1);
  ck('… eine Quelle, Soll-Liste erfüllt', p.kern.kurz().quellen === 1 && p.kern.kurz().sollOffen === 0);
  await p.aufraeumen();
}
{
  let abgemeldetVorNeuemAbo: boolean | null = null;
  const p: Probe = baueKern({
    stell: () => ({ FAKE_WIEDERBEITRITT_MS: '600', FAKE_RUECKKEHR_MS: '200', FAKE_RUECKKEHR_NAME: 'anna' }),
    // Hält fest, ob das alte Abo schon abgemeldet war, als das neue gesendet wurde (Laden Schritt 3).
    sendeFilter: (c) => {
      if (c.cmd === 'videoSubscribe' && c.id === 16778250) {
        abgemeldetVorNeuemAbo = p.ereignisse.some((x) => x.ev.ev === 'video'
          && (x.ev as { id?: number }).id === 16778240 && (x.ev as { state?: string }).state === 'unsubscribed');
      }
      return true;
    },
  });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: false, trotzBetriebsgroesse: false });
  await bis(() => p.kern.kurz().quellen === 1);
  const alterName = zeile(p, ANNA)?.quelle?.ndiName ?? '';
  ck('Fall 14b: „anna“ kommt zurück', await bis(() => zeile(p, 16778250) !== undefined, 2000));
  ck('… Connect lädt neu: genau ein videoUnsubscribe (16778240) und ein videoSubscribe (16778250)',
    await bis(() => p.befehle(1).some((x) => x.cmd === 'videoSubscribe' && x.id === 16778250), 2000)
    && p.befehle(1).filter((x) => x.cmd === 'videoUnsubscribe').map((x) => x.id).join(',') === '16778240'
    && p.befehle(1).filter((x) => x.cmd === 'videoSubscribe').map((x) => x.id).join(',') === '16778240,16778250');
  ck('… mit dem Ton des Soll-Eintrags (aus)', p.befehle(1).find((x) => x.cmd === 'videoSubscribe' && x.id === 16778250)?.audio === false);
  ck('… das neue Abo erst, nachdem die Bridge das alte abgemeldet hat', abgemeldetVorNeuemAbo === true);
  ck('… neuer NDI-Name normiert gleich dem alten, ohne „ (2)“', await bis(() => zeile(p, 16778250)?.quelle !== null && zeile(p, 16778250)?.quelle !== undefined)
    && (zeile(p, 16778250)?.quelle?.ndiName ?? '').toLocaleLowerCase('de') === alterName.toLocaleLowerCase('de')
    && !(zeile(p, 16778250)?.quelle?.ndiName ?? '').includes(' (2)'));
  ck('… Soll-Liste erfüllt, eine Quelle', p.kern.kurz().sollOffen === 0 && (await bis(() => p.kern.kurz().quellen === 1)));
  await p.aufraeumen();
}

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
  ck('sollVerwerfen(„ANNA “) entfernt den Eintrag, Alarm aus', p.kern.abbild().soll.length === 0 && p.kern.kurz().sollOffen === 0 && p.kern.stateKv()?.zoom_alarm === 0);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_MEETING_ENDE_MS: '800' }) });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  await bis(() => p.kern.kurz().quellen === 1);
  ck('Lebenslauf: Meeting-Ende leert die Soll-Liste', await bis(() => p.kern.kurz().zustand === 'bereit', 3000) && p.kern.kurz().sollOffen === 0
    && p.kern.abbild().soll.length === 0);
  ck('… und nach dem Abbau keine Quelle mehr', await bis(() => p.kern.kurz().quellen === 0));
  ck('… erneut() startet ohne Soll-Einträge (kein Abo)', ok(await p.kern.erneut()) && (await bis(() => p.kern.kurz().erlaubnis === 'ja'))
    && (await warte(500), !cmds(p, 2).includes('videoSubscribe')));
  await p.aufraeumen();
}
{
  const p = baueKern();
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  await bis(() => p.kern.kurz().quellen === 1);
  await p.kern.verlassen();
  ck('Lebenslauf: Verlassen leert die Soll-Liste und die Quellen', p.kern.kurz().sollOffen === 0 && p.kern.kurz().quellen === 0);
  ck('… neuer Beitritt danach ohne Abo', await insMeeting(p) && (await warte(500), !cmds(p, 2).includes('videoSubscribe')));
  await p.aufraeumen();
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: die Prüfungen der Aufgaben 10–14 `ok`, danach 9 `FAIL`-Zeilen, die erste
```
FAIL  … beim Weggang black/participantLeft, Soll-Stand verwaist
```
(Fall 14, 14b und die Soll-Liste nach „Erneut beitreten“), zuletzt Abbruch mit
```
TypeError: p.kern.sollVerwerfen is not a function
```
Exit-Code 1.

- [ ] **Step 3: Importe, Schnittstelle, Zustand des Abgleichs**

In `apps/connect/src/main/zoom/kern.ts`:

Vorher:
```ts
  ZoomQuelle,
  ZoomZustand,
```

Nachher:
```ts
  ZoomQuelle,
  ZoomSollEintrag,
  ZoomZustand,
```

Und:

Vorher:
```ts
import type { SollListe } from './soll';
import { baueTeilnehmer, ndiVorschau, normName, zaehleQuellen } from './teilnehmer';
```

Nachher:
```ts
import { sollAbbild, sollHandlungen, type SollLage, type SollListe } from './soll';
import { baueTeilnehmer, istVerwaist, ndiVorschau, normName, zaehleQuellen } from './teilnehmer';
```

Und:

Vorher:
```ts
  ton(e: { id: number; an: boolean }): ZoomErgebnis;
  schliessen(): void;
```

Nachher:
```ts
  ton(e: { id: number; an: boolean }): ZoomErgebnis;
  sollVerwerfen(e: { name: string }): void;
  schliessen(): void;
```

Und:

Vorher:
```ts
  const aboFristen = new Map<number, ReturnType<typeof setTimeout>>();
```

Nachher:
```ts
  const aboFristen = new Map<number, ReturnType<typeof setTimeout>>();

  // ── Soll-Abgleich (Spec 6.3) ─────────────────────────────────────────────
  let abgleichTimer: ReturnType<typeof setTimeout> | null = null;
  const abmeldeWarter = new Map<number, Array<() => void>>();
```

- [ ] **Step 4: Stand der Soll-Liste in Kurzform und Abbild**

Vorher:
```ts
  function kurz(): ZoomKurz {
```

Nachher:
```ts
  function sollLage(): SollLage {
    const s = aktiveSitzung();
    const alle = s ? [...s.participants.values()] : [];
    const ids = new Set(alle.map((p) => p.id));
    const abos = new Map<number, { verwaist: boolean }>();
    for (const q of aktiveQuellen().values()) abos.set(q.aboId, { verwaist: istVerwaist(q.aboId, ids, { state: q.bild, reason: q.bildGrund }) });
    return {
      teilnehmer: alle.filter((p) => !p.self).map((p) => ({ id: p.id, name: p.name, imWarteraum: p.inWaitingRoom })),
      abos,
    };
  }

  function sollOffen(): ZoomSollEintrag[] {
    return sollAbbild(soll, sollLage());
  }

  function kurz(): ZoomKurz {
```

Und (in `kurz`):

Vorher:
```ts
      sollOffen: 0,
```

Nachher:
```ts
      sollOffen: sollOffen().length,
```

Und (in `abbild`):

Vorher:
```ts
      soll: [],
```

Nachher:
```ts
      soll: sollOffen(),
```

- [ ] **Step 5: Auslöser des Abgleichs**

In `beiEreignis`:

Vorher:
```ts
      case 'audio':
        audioEreignis(ev as unknown as AudioEreignis);
        break;
    }
```

Nachher:
```ts
      case 'audio':
        audioEreignis(ev as unknown as AudioEreignis);
        break;
      case 'roster':
      case 'joined':
      case 'left':
      case 'renamed':
        abgleichPlanen();
        break;
    }
```

In `imMeetingAngekommen`:

Vorher:
```ts
    warImMeeting = true;
    setzeZustand('im_meeting');
  }
```

Nachher:
```ts
    warImMeeting = true;
    setzeZustand('im_meeting');
    abgleichPlanen();
  }
```

In `statusEreignis` (Rückkehr aus Z10):

Vorher:
```ts
      } else if (s === 'inMeeting') {
        if (zustand === 'abriss') setzeZustand('im_meeting');
      } else if (s === 'waitingRoom' || s === 'waitingForHost') zumWarteraum(s);
```

Nachher:
```ts
      } else if (s === 'inMeeting') {
        if (zustand === 'abriss') {
          setzeZustand('im_meeting');
          abgleichPlanen();
        }
      } else if (s === 'waitingRoom' || s === 'waitingForHost') zumWarteraum(s);
```

In `privilegEreignis`:

Vorher:
```ts
    if (erlaubnis === vorher) return;
    d.log(`[zoom] Aufnahme-Erlaubnis: ${erlaubnis}`);
  }
```

Nachher:
```ts
    if (erlaubnis === vorher) return;
    d.log(`[zoom] Aufnahme-Erlaubnis: ${erlaubnis}`);
    if (erlaubnis === 'ja') abgleichPlanen();
  }
```

- [ ] **Step 6: Soll-Eintrag folgt der Quelle**

In `videoEreignis`:

Vorher:
```ts
    if (e.state === 'unsubscribed') {
      quellen.delete(e.id);
      return;
    }
```

Nachher:
```ts
    if (e.state === 'unsubscribed') {
      quellen.delete(e.id);
      abmeldungGesehen(e.id);
      return;
    }
```

Und:

Vorher:
```ts
        tonAngefragt.set(e.id, tonAngefragt.get(id) ?? true);
```

Nachher:
```ts
        tonAngefragt.set(e.id, tonAngefragt.get(id) ?? true);
        // Der Soll-Eintrag folgt der neuen Kennung (Spec 6.3).
        for (const s of soll.values()) if (s.aboId === id) s.aboId = e.id;
```

Und:

Vorher:
```ts
      fehler: alt?.fehler ?? null,
    });
  }
```

Nachher:
```ts
      fehler: alt?.fehler ?? null,
    });
    for (const s of soll.values()) if (s.aboId === e.id) s.ndiName = e.source;
  }
```

- [ ] **Step 7: Laden Schritt 3**

In `laden`:

Vorher:
```ts
    const schluessel = normName(p.name);
    abonniere(e.id, e.ton);
```

Nachher:
```ts
    const schluessel = normName(p.name);
    const gen = aktiveGen;
    // Schritt 3: verwaiste Quelle mit gleichem normierten Namen erst entladen, damit der NDI-Name gleich bleibt.
    const alt = soll.get(schluessel);
    const altQuelle = alt?.aboId != null && alt.aboId !== e.id ? quellen.get(alt.aboId) : undefined;
    if (alt && altQuelle && altQuelle.gen === gen && istVerwaist(altQuelle.aboId, new Set(s.participants.keys()), { state: altQuelle.bild, reason: altQuelle.bildGrund })) {
      d.log(`[zoom] Verwaiste Quelle ${altQuelle.aboId} wird vor dem Laden entladen`);
      sende({ cmd: 'videoUnsubscribe', id: altQuelle.aboId });
      await abmeldungAbwarten(altQuelle.aboId);
      if (gen !== aktiveGen || imAbbau.has(gen) || zustand !== 'im_meeting') return { ok: false, text: '' };
    }
    abonniere(e.id, e.ton);
```

- [ ] **Step 8: Abgleich, Warten auf die Abmeldung, Vergessen**

Der neue Abschnitt kommt direkt vor den Abschnitt „Beenden“:

Vorher:
```ts
  // ── Beenden (Spec 6.6) ───────────────────────────────────────────────────
```

Nachher:
```ts
  // ── Soll-Liste und Abgleich (Spec 6.3) ───────────────────────────────────
  function abmeldungAbwarten(id: number): Promise<void> {
    if (!quellen.has(id)) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const frist = zeitgeber(f.unsubscribeWarteMs, () => resolve());
      const liste = abmeldeWarter.get(id) ?? [];
      liste.push(() => {
        clearTimeout(frist);
        resolve();
      });
      abmeldeWarter.set(id, liste);
    });
  }

  function abmeldungGesehen(id: number): void {
    const liste = abmeldeWarter.get(id);
    if (!liste) return;
    abmeldeWarter.delete(id);
    for (const fertig of liste) fertig();
  }

  /** 300 ms nach roster/joined/left/renamed/inMeeting/Erlaubnis „ja“; jeder Auslöser startet den Zeitgeber neu. */
  function abgleichPlanen(): void {
    if (abgleichTimer !== null) clearTimeout(abgleichTimer);
    abgleichTimer = zeitgeber(f.abgleichMs, () => {
      abgleichTimer = null;
      void abgleichen();
    });
  }

  async function abgleichen(): Promise<void> {
    if (zustand !== 'im_meeting' || erlaubnis !== 'ja') return;
    const gen = aktiveGen;
    for (const h of sollHandlungen(soll, sollLage())) {
      if (gen !== aktiveGen || imAbbau.has(gen) || zustand !== 'im_meeting') return;
      const eintrag = soll.get(h.schluessel);
      if (!eintrag) continue;
      if (h.art === 'neuLaden') {
        d.log(`[zoom] Abgleich: verwaiste Quelle ${h.altAboId} wird für Teilnehmer ${h.id} neu geladen`);
        sende({ cmd: 'videoUnsubscribe', id: h.altAboId });
        await abmeldungAbwarten(h.altAboId);
        if (gen !== aktiveGen || imAbbau.has(gen) || zustand !== 'im_meeting' || soll.get(h.schluessel) !== eintrag) continue;
      } else {
        d.log(`[zoom] Abgleich: Teilnehmer ${h.id} wird abonniert`);
      }
      eintrag.aboId = h.id;
      abonniere(h.id, h.ton);
    }
    abbildGeaendert();
  }

  function sollVerwerfen(e: { name: string }): void {
    if (soll.delete(normName(e.name))) d.log('[zoom] Gemerkte Quelle vergessen');
    abbildGeaendert();
  }

  // ── Beenden (Spec 6.6) ───────────────────────────────────────────────────
```

- [ ] **Step 9: `sollVerwerfen` in die öffentliche Fläche**

Vorher:
```ts
    ton,
    schliessen,
```

Nachher:
```ts
    ton,
    sollVerwerfen,
    schliessen,
```

- [ ] **Step 10: Test laufen lassen (grün)**

```
npx tsx apps/connect/test/zoom-kern.test.ts
```
Erwartet: keine `FAIL`-Zeile, letzte Zeile unter Windows
```
252 ok, 0 fehlgeschlagen, 0 übersprungen.
```
unter Linux `249 ok, 0 fehlgeschlagen, 1 übersprungen.`, Exit-Code 0; Laufzeit der Datei etwa 30 s. Meldet Fall 14 kein `black`/`participantLeft` beim Weggang oder kommt „anna“ in Fall 14b nicht zurück, fehlen `FAKE_RUECKKEHR_MS`/`FAKE_RUECKKEHR_NAME` in der Attrappe (Aufgabe 3) — dann anhalten.

- [ ] **Step 11: Selbsttest und Typcheck**

```
npm run selftest -w @jm/connect
npm run typecheck -w @jm/connect
```
Erwartet: beide Exit-Code 0, keine `FAIL`-Zeile; `npm run selftest -w @jm/connect` endet mit der Zeile aus Step 10.

- [ ] **Step 12: Commit**

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
git commit -m "feat(connect): Zoom-Kern - Soll-Liste und Abgleich nach Teilnehmeraenderungen (Stage 4a)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Nicht pushen (G13).

**Gegenprobe (Spec 12.5, beim Planen am Prototyp gemessen, kein Umsetzungsschritt):** Jede dieser absichtlichen Abweichungen macht mindestens eine Prüfung rot: Abgleich synchron ohne die 300 ms → Fall 14 „… Connect sendet weder videoUnsubscribe noch ein zweites videoSubscribe“ (im Moment von `joined` ist Annas Abo noch verwaist, ein sofortiger Abgleich lädt neu); Neu-Laden ohne Warten auf `unsubscribed` → Fall 14b „… das neue Abo erst, nachdem die Bridge das alte abgemeldet hat“; Soll-Liste beim 4a-Abriss geleert → „Soll-Liste nach Erneut beitreten“ (vier `FAIL`); in `soll.ts` (Aufgabe 9) Doppelnamen automatisch abonniert → „… Abgleich abonniert nur Carla“, „… Anna steht als doppelname“, „… zoom_alarm=1“; verwaiste Quelle bei genau einem Treffer nicht neu geladen → Fall 14b (fünf `FAIL`).

**Abweichungen vom Gerüst:**
- Fall 14b prüft zusätzlich, dass das neue Abo erst gesendet wird, nachdem das `unsubscribed` des verwaisten Abos angekommen ist (aufgezeichnet über `sendeFilter`). Ohne diese Prüfung bliebe das Warten aus Laden Schritt 3 / `neuLaden` unbelegt, weil die Attrappe sofort antwortet und keinen Namenszusatz „ (2)“ kennt.
- Der 4a-Ersatz für Fall 15 lädt Carla **ohne** Ton und prüft, dass der Abgleich nach „Erneut beitreten“ diesen Ton übernimmt (`audio: false`).
- Zwei zusätzliche Lebenslauf-Fälle: Meeting-Ende und Verlassen leeren die Soll-Liste auch mit geladenen Quellen, und ein Beitritt danach abonniert nichts von selbst.

---

### Task 16: Hülle: Einstellungen, zoom.ts, IPC, Preload, Gast-Labels

**Spec:** 5.1 (Zeilen `zoom.ts`, `settings.ts`, `ndi-guests.ts`, `ipc.ts`, `shared/types.ts`/`ipc.ts`, Preload), 5.5 (alle Kanäle außer `zoomAbbrechen`), 5.6 (Felder und Rangfolge), 5.7 (wer welches Geheimnis sieht), 6.1 (Dialoge, Sperre S10 vor dem Dialog, Zugangsdaten wählen/entfernen), 8.7 (Logordner, Präfixe), E4 (Zoom unabhängig vom Cloud-Raum), E7 (Zugangsdaten mit `safeStorage`).

**Files:**
- Create: `apps/connect/src/main/zoom/einstellungen.ts` (reine Regeln für die Zoom-Felder, ohne Electron, getestet — Abweichung 1)
- Create: `apps/connect/src/main/zoom.ts` (Hülle)
- Modify: `apps/connect/src/main/settings.ts:15-16` (Importe), `:21-25` (`Stored`), Dateiende nach `:124` (Zoom-Funktionen)
- Modify: `apps/connect/src/main/ndi-guests.ts:107-109` (`activeLabels()` dahinter)
- Modify: `apps/connect/src/main/ipc.ts:16` (Import), in `currentStatus()` (`:27-39`) die Zeile `zoom: null,` aus Aufgabe 5
- Modify: `apps/connect/src/shared/ipc.ts:38-40` (Zoom-Kanäle vor `} as const;`)
- Modify: `apps/connect/src/shared/types.ts` — Ende von `JmConnectApi` (Ausgangsstand `:108-110`; Aufgabe 5 schiebt die Zeilen nach unten, der Text ist unverändert)
- Modify: `apps/connect/src/preload/index.ts:2` (Typ-Import), `:53-58` (Ende des `api`-Objekts)
- Modify: `apps/connect/electron.vite.config.ts:10-18` (`internalPackages`)
- Test: `apps/connect/test/zoom-teile.test.ts` (neuer Block direkt über der Ankerzeile)

**Interfaces:**

Consumes (exakt so, wie die Aufgaben sie anlegen):
```ts
// Aufgabe 5 · apps/connect/src/shared/types.ts
export type ProxyKeySource = 'none' | 'env' | 'stored' | 'session';          // schon vorhanden
export interface ZoomKurz { /* Spec 5.4 */ }
export interface ZoomAbbild { /* Spec 5.4 */ }
export type ZoomErgebnis = { ok: true } | { ok: false; text: string };
export interface AppStatus { /* … */ zoom: ZoomKurz | null }                  // Aufgabe 5 setzt in ipc.ts `zoom: null,`
// Aufgaben 10–15 · apps/connect/src/main/zoom/kern.ts
export const BEENDEN_FRIST_MS = 15_000;
export const ANZEIGENAME_VORGABE = 'JM Connect';
export interface ZugangDaten { clientId: string; clientSecret: string }
export interface ZugangStand { daten: ZugangDaten | null; herkunft: ProxyKeySource; unlesbar: boolean }
export interface ZoomKernAbhaengigkeiten {
  pfade: LaufzeitPfade;                                   // Aufgabe 7: { basis: string; ressourcen: string }
  zugang: { lesen(): ZugangStand; speichern(d: ZugangDaten): 'stored' | 'session'; loeschen(): void };
  einstellungen: {
    anzeigename(): string; setzeAnzeigename(n: string): void;
    versatzMs(): number; setzeVersatzMs(ms: number): void;
    setzeLaufzeit(v: { dir: string; fassung: string; eingerichtetAm: string }): void;
  };
  gastLabels(): string[];
  log(zeile: string): void;
  onAbbild(a: ZoomAbbild): void;
  onKurz?(k: ZoomKurz): void;
  bridgeFabrik?: BridgeFabrik; laufzeit?: Partial<LaufzeitDienste>; env?: Record<string, string | undefined>; fristen?: Partial<ZoomFristen>;
}
export interface ZoomKern {
  abbild(): ZoomAbbild; kurz(): ZoomKurz; stateKv(): ZoomStateKv | null; laeuft(): boolean;
  einrichtungSperre(): ZoomErgebnis; sdkWaehlen(ordner: string): Promise<ZoomErgebnis>;
  zugangWaehlen(datei: string): ZoomErgebnis; zugangLoeschen(): ZoomErgebnis; versatz(e: { ms: number }): ZoomErgebnis;
  schliessen(): void; meldungWeg(): void; gastLabelsGeaendert(): void; beenden(fristMs: number): Promise<void>;
  pruefen(): Promise<ZoomErgebnis>;                                                         // Aufgabe 11
  beitreten(e: { nummer: string; kenncode: string; anzeigename: string }): Promise<ZoomErgebnis>; erneut(): Promise<ZoomErgebnis>; // 12
  verlassen(): Promise<void>;                                                               // Aufgabe 13
  laden(e: { id: number; ton: boolean; trotzBetriebsgroesse: boolean }): Promise<ZoomErgebnis>;
  entladen(e: { aboId: number }): Promise<ZoomErgebnis>; ton(e: { id: number; an: boolean }): ZoomErgebnis; // 14
  sollVerwerfen(e: { name: string }): void;                                                 // Aufgabe 15
}
export function erzeugeZoomKern(d: ZoomKernAbhaengigkeiten): ZoomKern;
// @jm/zoom-bridge (src/jwt.ts, unverändert)
export function readCredentials(env?: NodeJS.ProcessEnv): { clientId: string; clientSecret: string }; // wirft bei fehlenden Feldern / kaputter Datei, ohne Werte zu zitieren
// @jm/electron-kit, @jm/app-runtime (unverändert)
export function resourcePath(filename: string, devDir: string): string;
export function getLog(): Logger;   // info/warn/error(msg: string, ...rest: unknown[])
```

Produces:
```ts
// apps/connect/src/main/zoom/einstellungen.ts (neu, rein)
export interface GespeicherterZugang { daten: ZugangDaten | null; unlesbar: boolean }
export function gueltigerAnzeigename(v: unknown): string | null;   // 1–64 Zeichen nach trim, sonst null
export function gueltigerVersatz(v: unknown): number | null;       // ganze Zahl 0–1000, sonst null
export function zugangAusUmgebung(env: Record<string, string | undefined>): { daten: ZugangDaten | null; fehler: string | null };
export function zugangAusKlartext(klartext: string | null): GespeicherterZugang;
export function waehleZugang(e: { umgebung: ZugangDaten | null; gespeichert: GespeicherterZugang | null; sitzung: ZugangDaten | null }): ZugangStand;
// apps/connect/src/main/settings.ts
export interface ZoomZugangDaten { clientId: string; clientSecret: string }
export function zoomZugangLesen(): { daten: ZoomZugangDaten | null; herkunft: ProxyKeySource; unlesbar: boolean };
export function zoomZugangSpeichern(d: ZoomZugangDaten): 'stored' | 'session';
export function zoomZugangLoeschen(): void;
export function zoomAnzeigename(): string;
export function setzeZoomAnzeigename(n: string): void;
export function zoomVersatzMs(): number;
export function setzeZoomVersatzMs(ms: number): void;
export function setzeZoomLaufzeit(v: { dir: string; fassung: string; eingerichtetAm: string }): void;
// apps/connect/src/main/zoom.ts
export function startZoom(d: { getWindow: () => BrowserWindow | null; logDir: string; onKurz: () => void }): void;
export function zoomKurz(): ZoomKurz | null;
export function zoomLaeuft(): boolean;
export function zoomBeenden(fristMs: number): Promise<void>;   // ohne Kern: sofort aufgelöst; wirft nie
export function zoomVerlassen(): void;
export function zoomGastLabelsGeaendert(): void;
// apps/connect/src/main/ndi-guests.ts
export function activeLabels(): string[];
// apps/connect/src/shared/ipc.ts (in IPC)
zoomGet: 'jmc:zoom-get', zoom: 'jmc:zoom', zoomSdkWaehlen: 'jmc:zoom-sdk-waehlen', zoomZugangWaehlen: 'jmc:zoom-zugang-waehlen',
zoomZugangLoeschen: 'jmc:zoom-zugang-loeschen', zoomPruefen: 'jmc:zoom-pruefen', zoomBeitreten: 'jmc:zoom-beitreten',
zoomVerlassen: 'jmc:zoom-verlassen', zoomLaden: 'jmc:zoom-laden', zoomEntladen: 'jmc:zoom-entladen', zoomTon: 'jmc:zoom-ton',
zoomSollVerwerfen: 'jmc:zoom-soll-verwerfen', zoomVersatz: 'jmc:zoom-versatz', zoomErneut: 'jmc:zoom-erneut',
zoomSchliessen: 'jmc:zoom-schliessen', zoomMeldungWeg: 'jmc:zoom-meldung-weg', zoomLogordner: 'jmc:zoom-logordner',
// apps/connect/src/shared/types.ts — JmConnectApi zusätzlich (Aufgabe 18 nutzt genau diese Methoden)
zoomGet: () => Promise<ZoomAbbild>;
onZoom: (cb: (a: ZoomAbbild) => void) => () => void;
zoomSdkWaehlen: () => Promise<ZoomErgebnis>;
zoomZugangWaehlen: () => Promise<ZoomErgebnis>;
zoomZugangLoeschen: () => Promise<ZoomErgebnis>;
zoomPruefen: () => Promise<ZoomErgebnis>;
zoomBeitreten: (p: { nummer: string; kenncode: string; anzeigename: string }) => Promise<ZoomErgebnis>;
zoomVerlassen: () => Promise<void>;
zoomLaden: (p: { id: number; ton: boolean; trotzBetriebsgroesse: boolean }) => Promise<ZoomErgebnis>;
zoomEntladen: (p: { aboId: number }) => Promise<ZoomErgebnis>;
zoomTon: (p: { id: number; an: boolean }) => Promise<ZoomErgebnis>;
zoomSollVerwerfen: (p: { name: string }) => Promise<void>;
zoomVersatz: (p: { ms: number }) => Promise<ZoomErgebnis>;
zoomErneut: () => Promise<ZoomErgebnis>;
zoomSchliessen: () => Promise<void>;
zoomMeldungWeg: () => Promise<void>;
zoomLogordner: () => Promise<void>;
```

**Vorab (für den Umsetzer):**
- Stand: nach Aufgaben 1–15. `shared/types.ts` trägt die Zoom-Typen und `AppStatus.zoom` (Aufgabe 5), `main/ipc.ts` hat in `currentStatus()` die Zeile `zoom: null,` (Aufgabe 5), `main/zoom/kern.ts` exportiert `erzeugeZoomKern`, `ZoomKern`, `ZugangDaten`, `ZugangStand`, `ANZEIGENAME_VORGABE`, `BEENDEN_FRIST_MS` (Aufgaben 10–15), `test/zoom-teile.test.ts` folgt der gemeinsamen Test-Konvention mit der Ankerzeile (Aufgabe 9). `settings.ts`, `ndi-guests.ts`, `shared/ipc.ts`, `preload/index.ts` und `electron.vite.config.ts` sind seit dem Ausgangsstand unverändert; alle Vorher-Ausschnitte unten sind wortgleich daraus und kommen je genau einmal vor.
- G14: Die Dateien liegen mit CRLF im Arbeitsbaum. Die Ausschnitte sind mit LF geschrieben; mit dem Edit-Werkzeug ersetzen (es gleicht die Zeilenenden an), nicht mit `sed`. Trifft ein Vorher nicht, zuerst die Zeilenenden prüfen.
- Zoom lebt nur unter Windows (Spec 1, Nicht-Ziele): Ohne `win32` legt `startZoom` keinen Kern an und registriert keinen Zoom-Kanal; `zoomKurz()` liefert dann `null`.
- Electron-Verdrahtung lässt sich in der CI nicht laden (G10). Geprüft wird wie in der Vorbild-Aufgabe A10: die Regeln als reines Modul mit Test (Zyklus 1), die Verdrahtung über Typecheck und Bau (Zyklus 2), das Verhalten im Owner-Kurztest (Aufgabe 20).
- Gegengeprüft an einer Kopie von `apps/connect` mit dem Stand nach Aufgabe 5 und Stubs für Aufgabe 9–15 (Probelauf im Scratchpad): jeder Vorher-Ausschnitt genau einmal, Schritt 2 rot mit `ERR_MODULE_NOT_FOUND`, Schritt 4 grün (23 neue Fälle), Schritt 7 rot mit genau der unten zitierten TS2740-Meldung, Schritt 9 und 17 grün, Bau grün.

#### Zyklus 1: Regeln der Zoom-Einstellungen (rein, getestet)

- [ ] **Step 1: Fehlschlagenden Test-Block einfügen** in `apps/connect/test/zoom-teile.test.ts`, direkt über der Ankerzeile. Der Block lädt seine Module per `await import(…)` (die Datei ist ESM, `apps/connect/package.json` hat `"type": "module"`); so bleibt der Dateikopf aus Aufgabe 9 unberührt. Werte nur synthetisch (G12), `GEHEIM-INHALT` belegt, dass ein Parse-Fehler den Dateiinhalt nicht zitiert (G5).

Datei `apps/connect/test/zoom-teile.test.ts`. Vorher (eindeutig):
```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```
Nachher:
```ts
// ── Aufgabe 16: Zoom-Einstellungen, rein (Spec 5.6, G4, G5) ──
{
  const { gueltigerAnzeigename, gueltigerVersatz, zugangAusUmgebung, zugangAusKlartext, waehleZugang } = await import(
    '../src/main/zoom/einstellungen'
  );
  const fs = await import('node:fs');
  const os = await import('node:os');
  const pfad = await import('node:path');

  // Anzeigename: 1 bis 64 Zeichen nach trim (G4)
  ck('Einst: Anzeigename „JM Connect“ gültig', gueltigerAnzeigename('JM Connect') === 'JM Connect');
  ck('Einst: Anzeigename wird getrimmt', gueltigerAnzeigename('  Regie 1  ') === 'Regie 1');
  ck('Einst: Anzeigename mit 64 Zeichen gültig', gueltigerAnzeigename('x'.repeat(64)) === 'x'.repeat(64));
  ck('Einst: Anzeigename mit 65 Zeichen ungültig', gueltigerAnzeigename('x'.repeat(65)) === null);
  ck('Einst: Anzeigename nur aus Leerzeichen ungültig', gueltigerAnzeigename('   ') === null);
  ck('Einst: Anzeigename ohne Text ungültig', gueltigerAnzeigename(undefined) === null && gueltigerAnzeigename(42) === null);

  // Versatz: ganze Zahl 0 bis 1000 (G4)
  ck(
    'Einst: Versatz 0, 250 und 1000 gültig',
    gueltigerVersatz(0) === 0 && gueltigerVersatz(250) === 250 && gueltigerVersatz(1000) === 1000,
  );
  ck(
    'Einst: Versatz 1001, -1, 1.5, NaN, "250", undefined ungültig',
    [1001, -1, 1.5, Number.NaN, '250', undefined].every((v) => gueltigerVersatz(v) === null),
  );

  // Umgebung (Entwicklungsweg, Herkunft 'env')
  const leer = zugangAusUmgebung({});
  ck('Einst: leere Umgebung → keine Daten, kein Fehler', leer.daten === null && leer.fehler === null);
  const beide = zugangAusUmgebung({ ZOOM_SDK_CLIENT_ID: 'env-id-9876', ZOOM_SDK_CLIENT_SECRET: 'env-secret' });
  ck(
    'Einst: Umgebung mit ID und Secret',
    beide.daten?.clientId === 'env-id-9876' && beide.daten?.clientSecret === 'env-secret' && beide.fehler === null,
  );
  const halb = zugangAusUmgebung({ ZOOM_SDK_CLIENT_ID: 'env-id-9876' });
  ck(
    'Einst: Umgebung nur mit ID → Fehler, der den Wert nicht nennt',
    halb.daten === null && halb.fehler !== null && !halb.fehler.includes('env-id-9876'),
  );
  const ordner = fs.mkdtempSync(pfad.join(os.tmpdir(), 'jmc-zoom-einst-'));
  try {
    const gut = pfad.join(ordner, 'zugang.json');
    fs.writeFileSync(gut, String.fromCharCode(0xfeff) + JSON.stringify({ clientId: 'datei-id-4321', clientSecret: 'datei-secret' }));
    const ausDatei = zugangAusUmgebung({ ZOOM_SDK_CREDENTIALS: gut });
    ck(
      'Einst: Umgebung mit Datei (mit BOM) liefert die Daten',
      ausDatei.daten?.clientId === 'datei-id-4321' && ausDatei.daten?.clientSecret === 'datei-secret',
    );
    const kaputt = pfad.join(ordner, 'kaputt.json');
    fs.writeFileSync(kaputt, '{ "clientSecret": GEHEIM-INHALT');
    const k = zugangAusUmgebung({ ZOOM_SDK_CREDENTIALS: kaputt });
    ck(
      'Einst: kaputte Datei → Fehler, Inhalt nicht zitiert',
      k.daten === null && k.fehler !== null && !k.fehler.includes('GEHEIM-INHALT'),
    );
  } finally {
    fs.rmSync(ordner, { recursive: true, force: true });
  }

  // Inhalt von zoomZugangEnc nach dem Entschlüsseln
  const gelesen = zugangAusKlartext(JSON.stringify({ clientId: 'gesp-id-0002', clientSecret: 'g' }));
  ck(
    'Einst: Klartext gültig',
    gelesen.unlesbar === false && gelesen.daten?.clientId === 'gesp-id-0002' && gelesen.daten?.clientSecret === 'g',
  );
  ck('Einst: nicht entschlüsselbar → unlesbar', zugangAusKlartext(null).unlesbar === true && zugangAusKlartext(null).daten === null);
  ck('Einst: entschlüsselt, aber kein JSON → unlesbar', zugangAusKlartext('{kaputt').unlesbar === true);
  ck('Einst: entschlüsselt, Feld fehlt → unlesbar', zugangAusKlartext('{"clientId":"a"}').unlesbar === true);

  // Rangfolge Umgebung > Gespeichertes > Sitzung (Spec 5.6)
  const U = { clientId: 'env-id-0001', clientSecret: 'u' };
  const G = { clientId: 'gesp-id-0002', clientSecret: 'g' };
  const S = { clientId: 'sitz-id-0003', clientSecret: 's' };
  const r1 = waehleZugang({ umgebung: U, gespeichert: { daten: G, unlesbar: false }, sitzung: S });
  ck('Einst: Umgebung hat Vorrang', r1.herkunft === 'env' && r1.daten === U && r1.unlesbar === false);
  const r2 = waehleZugang({ umgebung: null, gespeichert: { daten: G, unlesbar: false }, sitzung: S });
  ck('Einst: Gespeichertes vor Sitzung', r2.herkunft === 'stored' && r2.daten === G);
  const r3 = waehleZugang({ umgebung: null, gespeichert: null, sitzung: S });
  ck('Einst: nur Sitzung', r3.herkunft === 'session' && r3.daten === S && r3.unlesbar === false);
  const r4 = waehleZugang({ umgebung: null, gespeichert: { daten: null, unlesbar: true }, sitzung: null });
  ck('Einst: unlesbar ohne Ersatz → none + unlesbar', r4.herkunft === 'none' && r4.daten === null && r4.unlesbar === true);
  const r5 = waehleZugang({ umgebung: U, gespeichert: { daten: null, unlesbar: true }, sitzung: null });
  ck('Einst: unlesbar, aber Umgebung da → kein Mangel', r5.herkunft === 'env' && r5.unlesbar === false);
  const r6 = waehleZugang({ umgebung: null, gespeichert: null, sitzung: null });
  ck('Einst: nichts hinterlegt → none', r6.herkunft === 'none' && r6.daten === null && r6.unlesbar === false);
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

- [ ] **Step 2: Test laufen lassen (rot).**

Run (aus der Worktree-Wurzel): `npx tsx apps/connect/test/zoom-teile.test.ts`
Expected: Die Fälle aus Aufgabe 9 laufen durch (`  ok  …`), dann bricht der Lauf ab mit
`Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\connect\src\main\zoom\einstellungen' imported from …\apps\connect\test\zoom-teile.test.ts`, Exit-Code 1.

- [ ] **Step 3: `apps/connect/src/main/zoom/einstellungen.ts` anlegen.** G8: kein `electron`, keine Aliase, Typen per `import type`.

```ts
// Reine Regeln für die Zoom-Felder in connect-settings.json (Spec 5.6): gültige Werte, Zugangsdaten
// aus der Umgebung, Inhalt von zoomZugangEnc, Rangfolge der Herkünfte. Ohne Electron, damit `tsx`
// sie prüfen kann; settings.ts bringt nur Datei, safeStorage und Sitzung dazu.
import { readCredentials } from '@jm/zoom-bridge';
import type { ZugangDaten, ZugangStand } from './kern';

/** Was in zoomZugangEnc steht, nach dem Entschlüsseln. */
export interface GespeicherterZugang {
  daten: ZugangDaten | null;
  /** zoomZugangEnc ist da, lässt sich aber nicht entschlüsseln oder ist kaputt (A5). */
  unlesbar: boolean;
}

/** 1 bis 64 Zeichen nach `trim` (G4), sonst `null`. Der Aufrufer setzt dann die Vorgabe „JM Connect“. */
export function gueltigerAnzeigename(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length >= 1 && t.length <= 64 ? t : null;
}

/** Ganze Zahl 0 bis 1000 (G4), sonst `null`. Der Aufrufer setzt dann 0. */
export function gueltigerVersatz(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1000 ? v : null;
}

/**
 * Zugangsdaten aus der Umgebung: ZOOM_SDK_CLIENT_ID + ZOOM_SDK_CLIENT_SECRET oder ZOOM_SDK_CREDENTIALS
 * (Entwicklungsweg, Herkunft 'env', Spec 5.6). Ohne jede dieser Variablen: keine Daten, kein Fehler.
 * `fehler` nennt nie einen Wert: readCredentials zitiert weder das Secret noch den Dateiinhalt.
 */
export function zugangAusUmgebung(env: Record<string, string | undefined>): { daten: ZugangDaten | null; fehler: string | null } {
  if (!env.ZOOM_SDK_CLIENT_ID && !env.ZOOM_SDK_CLIENT_SECRET && !env.ZOOM_SDK_CREDENTIALS) {
    return { daten: null, fehler: null };
  }
  try {
    const { clientId, clientSecret } = readCredentials(env);
    return { daten: { clientId, clientSecret }, fehler: null };
  } catch (e) {
    return { daten: null, fehler: e instanceof Error ? e.message : String(e) };
  }
}

/** Inhalt von zoomZugangEnc nach dem Entschlüsseln. `klartext === null` heißt: nicht entschlüsselbar. */
export function zugangAusKlartext(klartext: string | null): GespeicherterZugang {
  if (klartext !== null) {
    try {
      const j = JSON.parse(klartext) as { clientId?: unknown; clientSecret?: unknown } | null;
      if (j && typeof j.clientId === 'string' && j.clientId && typeof j.clientSecret === 'string' && j.clientSecret) {
        return { daten: { clientId: j.clientId, clientSecret: j.clientSecret }, unlesbar: false };
      }
    } catch {
      // kaputt → unten „unlesbar“; der Inhalt geht nirgendwohin (G5)
    }
  }
  return { daten: null, unlesbar: true };
}

/** Rangfolge Umgebung > Gespeichertes > Sitzung (Spec 5.6, wie beim Proxy-Key in settings.ts). */
export function waehleZugang(e: {
  umgebung: ZugangDaten | null;
  gespeichert: GespeicherterZugang | null;
  sitzung: ZugangDaten | null;
}): ZugangStand {
  if (e.umgebung) return { daten: e.umgebung, herkunft: 'env', unlesbar: false };
  if (e.gespeichert?.daten) return { daten: e.gespeichert.daten, herkunft: 'stored', unlesbar: false };
  if (e.sitzung) return { daten: e.sitzung, herkunft: 'session', unlesbar: false };
  return { daten: null, herkunft: 'none', unlesbar: e.gespeichert?.unlesbar === true };
}
```

- [ ] **Step 4: Test laufen lassen (grün).**

Run: `npx tsx apps/connect/test/zoom-teile.test.ts`
Expected: 23 neue Zeilen `  ok  Einst: …` (von `Einst: Anzeigename „JM Connect“ gültig` bis `Einst: nichts hinterlegt → none`), keine Zeile mit `FAIL`, letzte Zeile `78 ok, 0 fehlgeschlagen.` (55 aus Aufgabe 9 + 23), Exit-Code 0.

#### Zyklus 2: Verdrahtung (geprüft über Typecheck und Bau)

- [ ] **Step 5: Zoom-Kanäle in `shared/ipc.ts` (Spec 5.5, ohne `zoomAbbrechen`).**

Datei `apps/connect/src/shared/ipc.ts`. Vorher (eindeutig):
```ts
  /** send (Renderer → Main): Folie im JM Presenter blättern (Control-Plane, Welle 6.3c). */
  slideCue: 'jmc:slide-cue',
} as const;
```
Nachher:
```ts
  /** send (Renderer → Main): Folie im JM Presenter blättern (Control-Plane, Welle 6.3c). */
  slideCue: 'jmc:slide-cue',

  // ── Zoom (Stage 4a, Spec 5.5). Der Kenncode geht nur mit zoomBeitreten in den Main und kommt nie
  // zurück. `zoomAbbrechen` (Wiederbeitritt abbrechen) kommt erst mit Plan 4b.
  /** invoke (Renderer → Main): aktuelles Zoom-Abbild → ZoomAbbild. */
  zoomGet: 'jmc:zoom-get',
  /** push (Main → Renderer): Zoom-Abbild (höchstens alle 100 ms). */
  zoom: 'jmc:zoom',
  /** invoke: Ordner-Dialog, dann SDK prüfen und kopieren → ZoomErgebnis. */
  zoomSdkWaehlen: 'jmc:zoom-sdk-waehlen',
  /** invoke: Datei-Dialog für die Zugangsdaten → ZoomErgebnis. */
  zoomZugangWaehlen: 'jmc:zoom-zugang-waehlen',
  /** invoke: hinterlegte Zugangsdaten entfernen → ZoomErgebnis (gesperrt wie die Wahl, S10). */
  zoomZugangLoeschen: 'jmc:zoom-zugang-loeschen',
  /** invoke: „Einrichtung prüfen“ (anmelden ohne Meeting) → ZoomErgebnis; das Ergebnis steht auch als Meldung im Abbild. */
  zoomPruefen: 'jmc:zoom-pruefen',
  /** invoke: { nummer, kenncode, anzeigename } → ZoomErgebnis. */
  zoomBeitreten: 'jmc:zoom-beitreten',
  /** invoke: Meeting verlassen (auch Tray „Zoom-Meeting verlassen“) → void. */
  zoomVerlassen: 'jmc:zoom-verlassen',
  /** invoke: { id, ton, trotzBetriebsgroesse } → ZoomErgebnis. */
  zoomLaden: 'jmc:zoom-laden',
  /** invoke: { aboId } → ZoomErgebnis. */
  zoomEntladen: 'jmc:zoom-entladen',
  /** invoke: { id, an } → ZoomErgebnis (Ton-Vorwahl, nur ohne Quelle). */
  zoomTon: 'jmc:zoom-ton',
  /** invoke: { name } → void (gemerkte Quelle vergessen). */
  zoomSollVerwerfen: 'jmc:zoom-soll-verwerfen',
  /** invoke: { ms } → ZoomErgebnis (Bild-Versatz). */
  zoomVersatz: 'jmc:zoom-versatz',
  /** invoke: Beitritt mit den Daten im Arbeitsspeicher → ZoomErgebnis. */
  zoomErneut: 'jmc:zoom-erneut',
  /** invoke: Meldung weg, Nummer, Kenncode und gemerkte Quellen leeren → void. */
  zoomSchliessen: 'jmc:zoom-schliessen',
  /** invoke: Meldung quittieren → void. */
  zoomMeldungWeg: 'jmc:zoom-meldung-weg',
  /** invoke: Connect-Logordner im Explorer öffnen → void. */
  zoomLogordner: 'jmc:zoom-logordner',
} as const;
```

- [ ] **Step 6: `JmConnectApi` um die Zoom-Methoden erweitern (flaches Muster der bestehenden API).** `ZoomAbbild` und `ZoomErgebnis` stehen seit Aufgabe 5 in derselben Datei.

Datei `apps/connect/src/shared/types.ts`. Vorher (eindeutig):
```ts
  /** Steuerbefehle (Companion/Rundown) empfangen und an den DO relayen. Liefert Unsubscribe. */
  onControlCommand: (cb: (cmd: ControlCommand) => void) => () => void;
}
```
Nachher:
```ts
  /** Steuerbefehle (Companion/Rundown) empfangen und an den DO relayen. Liefert Unsubscribe. */
  onControlCommand: (cb: (cmd: ControlCommand) => void) => () => void;

  // ── Zoom (Stage 4a, Spec 5.5). Nur unter Windows verdrahtet; der Renderer ruft sie nur dort.
  /** Aktuelles Zoom-Abbild. */
  zoomGet: () => Promise<ZoomAbbild>;
  /** Zoom-Abbild abonnieren. Liefert Unsubscribe. */
  onZoom: (cb: (a: ZoomAbbild) => void) => () => void;
  /** Ordner-Dialog, dann SDK prüfen und kopieren. */
  zoomSdkWaehlen: () => Promise<ZoomErgebnis>;
  /** Datei-Dialog für die Zugangsdaten. */
  zoomZugangWaehlen: () => Promise<ZoomErgebnis>;
  zoomZugangLoeschen: () => Promise<ZoomErgebnis>;
  /** „Einrichtung prüfen“: Bridge starten, anmelden, beenden, ohne Meeting. */
  zoomPruefen: () => Promise<ZoomErgebnis>;
  /** Der Kenncode geht nur hier in den Main und kommt nie zurück. */
  zoomBeitreten: (p: { nummer: string; kenncode: string; anzeigename: string }) => Promise<ZoomErgebnis>;
  zoomVerlassen: () => Promise<void>;
  zoomLaden: (p: { id: number; ton: boolean; trotzBetriebsgroesse: boolean }) => Promise<ZoomErgebnis>;
  zoomEntladen: (p: { aboId: number }) => Promise<ZoomErgebnis>;
  zoomTon: (p: { id: number; an: boolean }) => Promise<ZoomErgebnis>;
  zoomSollVerwerfen: (p: { name: string }) => Promise<void>;
  zoomVersatz: (p: { ms: number }) => Promise<ZoomErgebnis>;
  zoomErneut: () => Promise<ZoomErgebnis>;
  zoomSchliessen: () => Promise<void>;
  zoomMeldungWeg: () => Promise<void>;
  zoomLogordner: () => Promise<void>;
}
```

- [ ] **Step 7: Typecheck laufen lassen (rot).**

Run: `npm run typecheck -w @jm/connect`
Expected: `typecheck:node` scheitert mit genau einem Fehler, Exit-Code ≠ 0:
```
src/preload/index.ts(22,7): error TS2740: Type '{ platform: Platform; openRoom: (room?: string | undefined) => Promise<RoomSession>; … }' is missing the following properties from type 'JmConnectApi': zoomGet, onZoom, zoomSdkWaehlen, zoomZugangWaehlen, and 13 more.
```

- [ ] **Step 8: Preload — Typ-Import und die 17 Methoden.** Nutzlasten Feld für Feld weiterreichen, nie das ganze Objekt.

Datei `apps/connect/src/preload/index.ts`. Ersetzung 1. Vorher (Zeile 2, eindeutig):
```ts
import type { AppStatus, ControlCommand, GuestInvite, JmConnectApi, ProxyInfo, RoomSession, ShowInfo, TrayCommand } from '@shared/types';
```
Nachher:
```ts
import type {
  AppStatus,
  ControlCommand,
  GuestInvite,
  JmConnectApi,
  ProxyInfo,
  RoomSession,
  ShowInfo,
  TrayCommand,
  ZoomAbbild,
  ZoomErgebnis,
} from '@shared/types';
```

Ersetzung 2. Vorher (eindeutig):
```ts
  onControlCommand: (cb) => {
    const listener = (_e: unknown, cmd: ControlCommand) => cb(cmd);
    ipcRenderer.on(IPC.controlCommand, listener);
    return () => ipcRenderer.off(IPC.controlCommand, listener);
  },
};
```
Nachher:
```ts
  onControlCommand: (cb) => {
    const listener = (_e: unknown, cmd: ControlCommand) => cb(cmd);
    ipcRenderer.on(IPC.controlCommand, listener);
    return () => ipcRenderer.off(IPC.controlCommand, listener);
  },
  // ── Zoom (Stage 4a, Spec 5.5). Nutzlasten werden Feld für Feld weitergereicht, nichts darüber hinaus.
  zoomGet: () => ipcRenderer.invoke(IPC.zoomGet) as Promise<ZoomAbbild>,
  onZoom: (cb) => {
    const listener = (_e: unknown, a: ZoomAbbild) => cb(a);
    ipcRenderer.on(IPC.zoom, listener);
    return () => ipcRenderer.off(IPC.zoom, listener);
  },
  zoomSdkWaehlen: () => ipcRenderer.invoke(IPC.zoomSdkWaehlen) as Promise<ZoomErgebnis>,
  zoomZugangWaehlen: () => ipcRenderer.invoke(IPC.zoomZugangWaehlen) as Promise<ZoomErgebnis>,
  zoomZugangLoeschen: () => ipcRenderer.invoke(IPC.zoomZugangLoeschen) as Promise<ZoomErgebnis>,
  zoomPruefen: () => ipcRenderer.invoke(IPC.zoomPruefen) as Promise<ZoomErgebnis>,
  zoomBeitreten: (p) =>
    ipcRenderer.invoke(IPC.zoomBeitreten, { nummer: p.nummer, kenncode: p.kenncode, anzeigename: p.anzeigename }) as Promise<ZoomErgebnis>,
  zoomVerlassen: () => ipcRenderer.invoke(IPC.zoomVerlassen) as Promise<void>,
  zoomLaden: (p) =>
    ipcRenderer.invoke(IPC.zoomLaden, { id: p.id, ton: p.ton, trotzBetriebsgroesse: p.trotzBetriebsgroesse }) as Promise<ZoomErgebnis>,
  zoomEntladen: (p) => ipcRenderer.invoke(IPC.zoomEntladen, { aboId: p.aboId }) as Promise<ZoomErgebnis>,
  zoomTon: (p) => ipcRenderer.invoke(IPC.zoomTon, { id: p.id, an: p.an }) as Promise<ZoomErgebnis>,
  zoomSollVerwerfen: (p) => ipcRenderer.invoke(IPC.zoomSollVerwerfen, { name: p.name }) as Promise<void>,
  zoomVersatz: (p) => ipcRenderer.invoke(IPC.zoomVersatz, { ms: p.ms }) as Promise<ZoomErgebnis>,
  zoomErneut: () => ipcRenderer.invoke(IPC.zoomErneut) as Promise<ZoomErgebnis>,
  zoomSchliessen: () => ipcRenderer.invoke(IPC.zoomSchliessen) as Promise<void>,
  zoomMeldungWeg: () => ipcRenderer.invoke(IPC.zoomMeldungWeg) as Promise<void>,
  zoomLogordner: () => ipcRenderer.invoke(IPC.zoomLogordner) as Promise<void>,
};
```

- [ ] **Step 9: Typecheck laufen lassen (grün).**

Run: `npm run typecheck -w @jm/connect`
Expected: keine Zeile mit `error TS`, Exit-Code 0.

- [ ] **Step 10: `settings.ts` — Importe.**

Datei `apps/connect/src/main/settings.ts`. Vorher (Zeilen 15–16, eindeutig):
```ts
import { getLog } from '@jm/app-runtime';
import type { ProxyKeySource } from '@shared/types';
```
Nachher:
```ts
import { getLog } from '@jm/app-runtime';
import type { ProxyKeySource } from '@shared/types';
import { ANZEIGENAME_VORGABE } from './zoom/kern';
import {
  gueltigerAnzeigename,
  gueltigerVersatz,
  waehleZugang,
  zugangAusKlartext,
  zugangAusUmgebung,
  type GespeicherterZugang,
} from './zoom/einstellungen';
```

- [ ] **Step 11: `settings.ts` — Felder in `Stored` (Spec 5.6).**

Vorher (Zeilen 21–25, eindeutig):
```ts
interface Stored {
  proxyUrl?: string;
  /** PROXY_KEY, safeStorage-verschlüsselt, base64. Nie im Klartext. */
  proxyKeyEnc?: string;
}
```
Nachher:
```ts
interface Stored {
  proxyUrl?: string;
  /** PROXY_KEY, safeStorage-verschlüsselt, base64. Nie im Klartext. */
  proxyKeyEnc?: string;
  /** Zoom: safeStorage(JSON { clientId, clientSecret }), base64. Nie im Klartext (Spec 5.6). */
  zoomZugangEnc?: string;
  /** Zoom: Laufzeit-Ordner und Fassung, nach erfolgreicher Einrichtung. */
  zoomLaufzeit?: { dir: string; fassung: string; eingerichtetAm: string };
  /** Zoom: 1 bis 64 Zeichen; fehlt = „JM Connect“. */
  zoomAnzeigename?: string;
  /** Zoom: ganze Zahl 0 bis 1000; fehlt = 0. */
  zoomVersatzMs?: number;
}
```

- [ ] **Step 12: `settings.ts` — Zoom-Funktionen am Dateiende.** Ohne Schlüsselbund nur für die Sitzung, nie Klartext auf der Platte (E7). `zoomZugangEnc` wird einmal entschlüsselt (Spec 6.1) und danach aus dem Zwischenspeicher gelesen; Speichern und Entfernen setzen ihn neu.

Vorher (Dateiende, eindeutig):
```ts
  sessionKey = v;
  if (!warned) {
    warned = true;
    getLog().warn('[connect] safeStorage nicht verfügbar — der Proxy-Key wird nur für diese Sitzung gehalten.');
  }
}
```
Nachher:
```ts
  sessionKey = v;
  if (!warned) {
    warned = true;
    getLog().warn('[connect] safeStorage nicht verfügbar — der Proxy-Key wird nur für diese Sitzung gehalten.');
  }
}

// ── Zoom (Stage 4, Spec 5.6) ────────────────────────────────────────────────────────────────
// Zugangsdaten der Meeting-SDK-App: Umgebung > gespeichert (safeStorage) > Sitzung, wie beim
// Proxy-Key. Die Regeln selbst stehen ohne Electron in zoom/einstellungen.ts (getestet); hier
// kommen nur Datei, safeStorage und die Sitzung dazu. Der Renderer erfährt nie die Werte, nur
// Herkunft und die letzten 4 Zeichen der Client-ID (rechnet der Kern aus, Spec 5.7).

export interface ZoomZugangDaten {
  clientId: string;
  clientSecret: string;
}

/** Nur ohne OS-Schlüsselbund belegt: dann gelten die Zugangsdaten nur für diese Sitzung (A4). */
let zoomSitzung: ZoomZugangDaten | null = null;
/** zoomZugangEnc, EINMAL entschlüsselt (Spec 6.1). `undefined` = noch nicht gelesen, `null` = nichts hinterlegt. */
let zoomGespeichert: GespeicherterZugang | null | undefined;
let zoomUmgebungGewarnt = false;
let zoomSitzungGewarnt = false;

function zoomGespeichertLesen(): GespeicherterZugang | null {
  if (zoomGespeichert === undefined) {
    const enc = read().zoomZugangEnc;
    zoomGespeichert = enc ? zugangAusKlartext(decryptKey(enc)) : null;
  }
  return zoomGespeichert;
}

/** `unlesbar`: zoomZugangEnc ist da, lässt sich aber nicht entschlüsseln (Mangel zugang_unlesbar, A5). */
export function zoomZugangLesen(): { daten: ZoomZugangDaten | null; herkunft: ProxyKeySource; unlesbar: boolean } {
  const umgebung = zugangAusUmgebung(process.env);
  if (umgebung.fehler && !zoomUmgebungGewarnt) {
    zoomUmgebungGewarnt = true;
    getLog().warn('[zoom] Zugangsdaten aus der Umgebung unbrauchbar:', umgebung.fehler);
  }
  return waehleZugang({ umgebung: umgebung.daten, gespeichert: zoomGespeichertLesen(), sitzung: zoomSitzung });
}

export function zoomZugangSpeichern(d: ZoomZugangDaten): 'stored' | 'session' {
  const daten = { clientId: d.clientId, clientSecret: d.clientSecret };
  const next = read();
  if (safeStorage.isEncryptionAvailable()) {
    next.zoomZugangEnc = safeStorage.encryptString(JSON.stringify(daten)).toString('base64');
    write(next);
    zoomSitzung = null;
    zoomGespeichert = { daten, unlesbar: false };
    return 'stored';
  }
  // Ohne Schlüsselbund NIE im Klartext auf die Platte (Spec 5.6, E7). Ein altes, hier nicht
  // entschlüsselbares zoomZugangEnc fliegt raus: die neue Wahl des Bedieners gilt.
  delete next.zoomZugangEnc;
  write(next);
  zoomGespeichert = null;
  zoomSitzung = daten;
  if (!zoomSitzungGewarnt) {
    zoomSitzungGewarnt = true;
    getLog().warn('[zoom] safeStorage nicht verfügbar — die Zoom-Zugangsdaten gelten nur für diese Sitzung.');
  }
  return 'session';
}

export function zoomZugangLoeschen(): void {
  const next = read();
  delete next.zoomZugangEnc;
  write(next);
  zoomSitzung = null;
  zoomGespeichert = null;
}

/** Ungültig oder fehlend → Vorgabe „JM Connect“ (G4). */
export function zoomAnzeigename(): string {
  return gueltigerAnzeigename(read().zoomAnzeigename) ?? ANZEIGENAME_VORGABE;
}

export function setzeZoomAnzeigename(n: string): void {
  const v = gueltigerAnzeigename(n);
  if (v === null) return; // der Kern prüft vorher (N0b); Ungültiges wird nie gespeichert
  const next = read();
  next.zoomAnzeigename = v;
  write(next);
}

/** Ungültig oder fehlend → 0 (G4). */
export function zoomVersatzMs(): number {
  return gueltigerVersatz(read().zoomVersatzMs) ?? 0;
}

export function setzeZoomVersatzMs(ms: number): void {
  const v = gueltigerVersatz(ms);
  if (v === null) return; // der Kern prüft vorher (Q13)
  const next = read();
  next.zoomVersatzMs = v;
  write(next);
}

export function setzeZoomLaufzeit(v: { dir: string; fassung: string; eingerichtetAm: string }): void {
  const next = read();
  next.zoomLaufzeit = { dir: v.dir, fassung: v.fassung, eingerichtetAm: v.eingerichtetAm };
  write(next);
}
```

- [ ] **Step 13: `ndi-guests.ts` — `activeLabels()` für die Kollisionsprüfung.** Das `label` jedes Senders ist der NDI-Name, mit dem `spinUp` den Utility-Prozess startet (`ndi-guests.ts:66`).

Datei `apps/connect/src/main/ndi-guests.ts`. Vorher (Zeilen 107–109, eindeutig):
```ts
export function activeCount(): number {
  return senders.size;
}
```
Nachher:
```ts
export function activeCount(): number {
  return senders.size;
}

/** NDI-Namen aller laufenden Gast-Sender, für die Kollisionsprüfung mit Zoom-Quellen (Spec 6.3, Q10). */
export function activeLabels(): string[] {
  return [...senders.values()].map((s) => s.label);
}
```

- [ ] **Step 14: `apps/connect/src/main/zoom.ts` anlegen (Hülle).** Sperre S10 vor jedem Dialog (Spec 6.1); ein abgebrochener Dialog und jede Nutzlast mit falschem Typ antworten `{ ok: false, text: '' }` (L9, der Renderer zeigt leere Texte nicht). Ein zweiter Dialog öffnet sich nicht, solange einer offen ist. `onAbbild` prüft das Fenster auf `isDestroyed()`, weil der Kern beim Beenden noch Abbilder schicken kann, wenn das Fenster schon zu ist. `zoomBeenden` fängt Fehler ab, damit `before-quit` (Aufgabe 17) nie an einer Ablehnung hängt.

```ts
// Zoom-Hülle (Spec 5.1, 6.1, 8.7): verbindet den Electron-freien Kern (zoom/kern.ts) mit IPC,
// Dialogen, den Einstellungen (safeStorage) und dem Fenster. Der Kern entsteht nur unter Windows;
// unter macOS gibt es weder Kern noch Zoom-Kanäle, und AppStatus.zoom bleibt null (Spec 1).
import { app, dialog, ipcMain, shell, type BrowserWindow, type OpenDialogOptions } from 'electron';
import { join } from 'node:path';
import { getLog } from '@jm/app-runtime';
import { resourcePath } from '@jm/electron-kit';
import { IPC } from '@shared/ipc';
import type { ZoomErgebnis, ZoomKurz } from '@shared/types';
import { erzeugeZoomKern, type ZoomKern } from './zoom/kern';
import { activeLabels } from './ndi-guests';
import {
  setzeZoomAnzeigename,
  setzeZoomLaufzeit,
  setzeZoomVersatzMs,
  zoomAnzeigename,
  zoomVersatzMs,
  zoomZugangLesen,
  zoomZugangLoeschen,
  zoomZugangSpeichern,
} from './settings';

declare const __dirname: string;

/** Antwort auf eine falsche Nutzlast oder einen abgebrochenen Dialog: leerer Text, den zeigt der Renderer nicht. */
const NICHTS: ZoomErgebnis = { ok: false, text: '' };

let kern: ZoomKern | null = null;
/** Ein offener Ordner-/Datei-Dialog genügt: ein Doppelklick öffnet keinen zweiten. */
let dialogOffen = false;

function feld(p: unknown, name: string): unknown {
  return typeof p === 'object' && p !== null ? (p as Record<string, unknown>)[name] : undefined;
}

function ganzeZahl(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

async function waehlePfad(getWindow: () => BrowserWindow | null, opts: OpenDialogOptions): Promise<string | null> {
  if (dialogOffen) return null;
  dialogOffen = true;
  try {
    const w = getWindow();
    const r = w && !w.isDestroyed() ? await dialog.showOpenDialog(w, opts) : await dialog.showOpenDialog(opts);
    return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0];
  } finally {
    dialogOffen = false;
  }
}

export function startZoom(d: { getWindow: () => BrowserWindow | null; logDir: string; onKurz: () => void }): void {
  if (kern || process.platform !== 'win32') return;
  // %LOCALAPPDATA% statt userData (Roaming): 315 MB gehören nicht in ein servergespiegeltes Profil (Spec 0.2).
  const basis = join(process.env.LOCALAPPDATA || join(app.getPath('home'), 'AppData', 'Local'), 'JM Connect', 'zoom-laufzeit');
  const ressourcen = resourcePath('', join(__dirname, '..', '..', 'resources'));
  try {
    kern = erzeugeZoomKern({
      pfade: { basis, ressourcen },
      zugang: { lesen: zoomZugangLesen, speichern: zoomZugangSpeichern, loeschen: zoomZugangLoeschen },
      einstellungen: {
        anzeigename: zoomAnzeigename,
        setzeAnzeigename: setzeZoomAnzeigename,
        versatzMs: zoomVersatzMs,
        setzeVersatzMs: setzeZoomVersatzMs,
        setzeLaufzeit: setzeZoomLaufzeit,
      },
      gastLabels: activeLabels,
      // Der Kern liefert fertige Zeilen: Präfix [zoom]/[zoom-bridge], Geheimnisse schon maskiert (8.7).
      log: (zeile) => getLog().info(zeile),
      onAbbild: (a) => {
        const w = d.getWindow();
        if (w && !w.isDestroyed()) w.webContents.send(IPC.zoom, a);
      },
      onKurz: () => d.onKurz(),
    });
  } catch (e) {
    getLog().error('[zoom] Zoom-Kern ließ sich nicht anlegen:', e instanceof Error ? e.message : e);
    return;
  }
  registriereKanaele(kern, d);
}

function registriereKanaele(k: ZoomKern, d: { getWindow: () => BrowserWindow | null; logDir: string }): void {
  ipcMain.handle(IPC.zoomGet, () => k.abbild());

  // Spec 6.1 „SDK-Ordner wählen“: Sperre S10 VOR dem Dialog; abgebrochen → nichts.
  ipcMain.handle(IPC.zoomSdkWaehlen, async (): Promise<ZoomErgebnis> => {
    const sperre = k.einrichtungSperre();
    if (!sperre.ok) return sperre;
    const ordner = await waehlePfad(d.getWindow, { properties: ['openDirectory'] });
    return ordner === null ? NICHTS : k.sdkWaehlen(ordner);
  });

  // Spec 6.1 „Zugangsdaten wählen“. Den Pfad merkt sich Connect nicht.
  ipcMain.handle(IPC.zoomZugangWaehlen, async (): Promise<ZoomErgebnis> => {
    const sperre = k.einrichtungSperre();
    if (!sperre.ok) return sperre;
    const datei = await waehlePfad(d.getWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Zugangsdaten', extensions: ['json'] }],
    });
    return datei === null ? NICHTS : k.zugangWaehlen(datei);
  });

  ipcMain.handle(IPC.zoomZugangLoeschen, (): ZoomErgebnis => k.zugangLoeschen());
  ipcMain.handle(IPC.zoomPruefen, (): Promise<ZoomErgebnis> => k.pruefen());

  // Der Kenncode kommt nur hier herein und geht nie zurück (Spec 5.5, 5.7).
  ipcMain.handle(IPC.zoomBeitreten, (_e, p: unknown): ZoomErgebnis | Promise<ZoomErgebnis> => {
    const nummer = feld(p, 'nummer');
    const kenncode = feld(p, 'kenncode');
    const anzeigename = feld(p, 'anzeigename');
    if (typeof nummer !== 'string' || typeof kenncode !== 'string' || typeof anzeigename !== 'string') return NICHTS;
    return k.beitreten({ nummer, kenncode, anzeigename });
  });

  ipcMain.handle(IPC.zoomVerlassen, async (): Promise<void> => {
    await k.verlassen();
  });

  ipcMain.handle(IPC.zoomLaden, (_e, p: unknown): ZoomErgebnis | Promise<ZoomErgebnis> => {
    const id = feld(p, 'id');
    const ton = feld(p, 'ton');
    const trotz = feld(p, 'trotzBetriebsgroesse');
    if (!ganzeZahl(id) || typeof ton !== 'boolean' || typeof trotz !== 'boolean') return NICHTS;
    return k.laden({ id, ton, trotzBetriebsgroesse: trotz });
  });

  ipcMain.handle(IPC.zoomEntladen, (_e, p: unknown): ZoomErgebnis | Promise<ZoomErgebnis> => {
    const aboId = feld(p, 'aboId');
    return ganzeZahl(aboId) ? k.entladen({ aboId }) : NICHTS;
  });

  ipcMain.handle(IPC.zoomTon, (_e, p: unknown): ZoomErgebnis => {
    const id = feld(p, 'id');
    const an = feld(p, 'an');
    return ganzeZahl(id) && typeof an === 'boolean' ? k.ton({ id, an }) : NICHTS;
  });

  ipcMain.handle(IPC.zoomSollVerwerfen, (_e, p: unknown): void => {
    const name = feld(p, 'name');
    if (typeof name === 'string') k.sollVerwerfen({ name });
  });

  // Ganzzahl und Bereich 0–1000 prüft der Kern (Q13); hier nur: ist es überhaupt eine Zahl?
  ipcMain.handle(IPC.zoomVersatz, (_e, p: unknown): ZoomErgebnis => {
    const ms = feld(p, 'ms');
    return typeof ms === 'number' ? k.versatz({ ms }) : NICHTS;
  });

  ipcMain.handle(IPC.zoomErneut, (): Promise<ZoomErgebnis> => k.erneut());
  ipcMain.handle(IPC.zoomSchliessen, (): void => k.schliessen());
  ipcMain.handle(IPC.zoomMeldungWeg, (): void => k.meldungWeg());

  // Mehrere Texte verweisen auf „Details im Log“ (Spec 8.7).
  ipcMain.handle(IPC.zoomLogordner, async (): Promise<void> => {
    const fehler = await shell.openPath(d.logDir);
    if (fehler) getLog().warn('[zoom] Logordner ließ sich nicht öffnen:', fehler);
  });
}

/** Kurzform für AppStatus (Tray, Kopfzeile); `null` ohne Kern (macOS). */
export function zoomKurz(): ZoomKurz | null {
  return kern ? kern.kurz() : null;
}

/** Kopie, Prüfung oder Bridge läuft (Spec 6.6: dann wartet before-quit auf zoomBeenden). */
export function zoomLaeuft(): boolean {
  return kern ? kern.laeuft() : false;
}

/** Verlässt das Meeting und baut ab, höchstens `fristMs` lang (Spec 6.6). Ohne Kern sofort erledigt. */
export function zoomBeenden(fristMs: number): Promise<void> {
  if (!kern) return Promise.resolve();
  return kern.beenden(fristMs).catch((e: unknown) => {
    getLog().error('[zoom] Beenden fehlgeschlagen:', e instanceof Error ? e.message : e);
  });
}

/** Tray „Zoom-Meeting verlassen“: wirkt immer als „Verlassen“ nach Spec 6.8. */
export function zoomVerlassen(): void {
  if (!kern) return;
  kern.verlassen().catch((e: unknown) => {
    getLog().error('[zoom] Verlassen fehlgeschlagen:', e instanceof Error ? e.message : e);
  });
}

/** Gast-Sender haben sich geändert: Kollisionsprüfung Gast ↔ Zoom neu rechnen (Spec 6.3). */
export function zoomGastLabelsGeaendert(): void {
  kern?.gastLabelsGeaendert();
}
```

- [ ] **Step 15: `main/ipc.ts` — `AppStatus.zoom` aus dem Kern.**

Datei `apps/connect/src/main/ipc.ts`. Ersetzung 1. Vorher (Zeile 16, eindeutig):
```ts
import { presenterConnected, slideCue } from './presenter-link';
```
Nachher:
```ts
import { presenterConnected, slideCue } from './presenter-link';
import { zoomKurz } from './zoom';
```

Ersetzung 2 (die Zeile aus Aufgabe 5 in `currentStatus()`). Vorher (eindeutig):
```ts
    zoom: null,
```
Nachher:
```ts
    zoom: zoomKurz(),
```

- [ ] **Step 16: `electron.vite.config.ts` — `@jm/zoom-bridge` in `internalPackages`.**

Datei `apps/connect/electron.vite.config.ts`. Vorher (eindeutig):
```ts
  '@jm/show',
  '@jm/suite-control-protocol',
];
```
Nachher:
```ts
  '@jm/show',
  '@jm/suite-control-protocol',
  // Zoom-Bridge (nur TypeScript-Quellen). Steht in den devDependencies und wird darum ohnehin
  // gebündelt; der Eintrag hält das fest, falls sie je in die dependencies wandert (Spec 5.1).
  '@jm/zoom-bridge',
];
```

- [ ] **Step 17: Typecheck (grün).**

Run: `npm run typecheck -w @jm/connect`
Expected: keine Zeile mit `error TS`, Exit-Code 0.

- [ ] **Step 18: Bau und Bündel-Prüfung.**

Run:
```bash
npm run build -w @jm/connect
grep -cF "import.meta" apps/connect/out/main/index.cjs
grep -cF 'require("@jm/zoom-bridge' apps/connect/out/main/index.cjs
grep -cF "jmc:zoom-get" apps/connect/out/preload/index.cjs
grep -cF "jmc:zoom-logordner" apps/connect/out/preload/index.cjs
```
Expected: dreimal `✓ built in …` (main, preload, renderer), keine Zeile mit `error`; dann `0`, `0`, `1`, `1` (bei `0` endet `grep -c` mit Exit-Code 1, das ist hier richtig). Hinweis: Im Main-Bündel stehen die Zoom-Kanäle erst ab Aufgabe 17. Rollup wirft `startZoom` und die ungenutzten Eigenschaften von `IPC` weg, solange `index.ts` `startZoom` nicht aufruft (gemessen im Probelauf: `jmc:zoom-get` im Main-Bündel = 0). Die Prüfung von L15 (`import.meta` = 0 bei gebündelter Bridge) wiederholt Aufgabe 17 Step 15 mit der Bridge im Bündel.

- [ ] **Step 19: Selbsttest (grün).**

Run: `npm run selftest -w @jm/connect`
Expected: die vier Testdateien enden der Reihe nach mit `487 ok, 0 fehlgeschlagen.` (`zoom-text`), `79 ok, 0 fehlgeschlagen.` (`zoom-laufzeit`), `78 ok, 0 fehlgeschlagen.` (`zoom-teile`) und `252 ok, 0 fehlgeschlagen, 0 übersprungen.` (`zoom-kern`; unter Linux `249 ok, 0 fehlgeschlagen, 1 übersprungen.`), keine Zeile, die mit `FAIL` beginnt, Exit-Code 0.

- [ ] **Step 20: Commit.**

```bash
git add apps/connect/src/main/zoom/einstellungen.ts apps/connect/src/main/zoom.ts apps/connect/src/main/settings.ts apps/connect/src/main/ndi-guests.ts apps/connect/src/main/ipc.ts apps/connect/src/shared/ipc.ts apps/connect/src/shared/types.ts apps/connect/src/preload/index.ts apps/connect/electron.vite.config.ts apps/connect/test/zoom-teile.test.ts
git status --short
```
Erwartet genau diese gestagten Zeilen (sonst nichts Gestagtes):
```
M  apps/connect/electron.vite.config.ts
M  apps/connect/src/main/ipc.ts
M  apps/connect/src/main/ndi-guests.ts
M  apps/connect/src/main/settings.ts
A  apps/connect/src/main/zoom.ts
A  apps/connect/src/main/zoom/einstellungen.ts
M  apps/connect/src/preload/index.ts
M  apps/connect/src/shared/ipc.ts
M  apps/connect/src/shared/types.ts
M  apps/connect/test/zoom-teile.test.ts
```
Dann:
```bash
git commit -m "feat(connect): Zoom-Hülle - Einstellungen, IPC-Kanäle, Preload, Gast-Labels" -m "settings.ts hält Zugangsdaten (safeStorage, ohne Schlüsselbund nur für die Sitzung), Anzeigename, Versatz und Laufzeit-Stand; die Regeln dafür stehen ohne Electron in zoom/einstellungen.ts und sind getestet. zoom.ts legt den Kern nur unter Windows an und verdrahtet die 17 Kanäle aus Spec 5.5 (ohne zoomAbbrechen) samt Dialogen und Logordner; Nutzlasten werden geprüft. AppStatus.zoom kommt aus dem Kern, activeLabels() liefert die NDI-Namen der Gast-Sender (#197)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Nicht pushen.

**Neue Logzeilen (für den Owner-Kurztest):** `[zoom] Zugangsdaten aus der Umgebung unbrauchbar: <Meldung von readCredentials>` (Warnung, einmal je Sitzung), `[zoom] safeStorage nicht verfügbar — die Zoom-Zugangsdaten gelten nur für diese Sitzung.` (Warnung), `[zoom] Zoom-Kern ließ sich nicht anlegen: <Meldung>` (Fehler), `[zoom] Logordner ließ sich nicht öffnen: <Meldung>` (Warnung), `[zoom] Beenden fehlgeschlagen: …` und `[zoom] Verlassen fehlgeschlagen: …` (Fehler). Keine davon enthält Client-ID, Secret, Nummer oder Kenncode.

**Abweichungen vom Gerüst:**
1. **Neues reines Modul `apps/connect/src/main/zoom/einstellungen.ts`** mit Test-Block in `zoom-teile.test.ts` (Gerüst nennt für Aufgabe 16 nur Typecheck und Bau). So sind Rangfolge, „unlesbar“, die Vorgaben bei ungültigen Werten und „Parse-Fehler zitiert keinen Inhalt“ ohne Electron belegt (G15 TDD), Muster der Vorbild-Aufgabe A10 (dort `hinweise.ts`/`zeilen.ts`). Der Block steht in `zoom-teile.test.ts`, weil eine neue Testdatei das `selftest`-Skript ändern würde, dessen Endstand Aufgabe 19 festlegt.
2. **Bündel-Prüfung:** Das Gerüst verlangt `jmc:zoom-get` ≥ 1 in `out/main/index.cjs` schon hier. Gemessen am Probelauf ist es 0, solange `index.ts` `startZoom` nicht aufruft (Tree-Shaking). Hier wird darum das Preload-Bündel geprüft; die Main-Prüfung samt `import.meta` = 0 mit gebündelter Bridge steht in Aufgabe 17 Step 15. Ebenfalls gemessen: electron-vite 2.3 ersetzt `import.meta.url` im CJS-Bündel durch `require("url").pathToFileURL(__filename).href` (Plugin `vite:import-meta`); L15 braucht also kein `define`.
3. **Zeilenangaben:** Die Gerüst-Angaben `shared/ipc.ts:22-259`, `types.ts:188-219`, `preload/index.ts:22-58` passen nicht zum Ist-Stand (`shared/ipc.ts` hat 47 Zeilen, `types.ts` 110 vor Aufgabe 5). Oben stehen die echten Stellen; die Vorher-Ausschnitte sind maßgeblich.
4. **`process.env.LOCALAPPDATA || …`** statt `??`: Ein leer gesetztes `LOCALAPPDATA` ergäbe sonst einen relativen Laufzeit-Pfad.
5. **Kleine Zusätze ohne Spec-Text:** Schutz gegen einen zweiten offenen Dialog (`dialogOffen`, Antwort `{ ok: false, text: '' }` nach L9), `isDestroyed()`-Prüfung vor dem Senden des Abbilds, `zoomBeenden` und `zoomVerlassen` fangen Ablehnungen ab und loggen sie. Beim Speichern ohne Schlüsselbund wird ein altes `zoomZugangEnc` gelöscht (sonst stünde nach dem nächsten Start „lassen sich nicht entschlüsseln“, obwohl der Bediener neue Daten gewählt hat).

---

### Task 17: Hülle: Tray, Kopfzeile, Programmstart und Beenden (tray.ts, index.ts, App.tsx-Kopf)

**Spec:** 6.6 (Fenster schließen, Beenden mit `zoomAbgebaut`, `session-end`), 7.2 linke Spalte (Tray-Zeile = Kopfzeile), 7.3 (Gäste-Zeile berichtigt, Menü, Kopfzeile „○ Raum nicht verbunden“), 7.4 (Tooltip), 17.2 Nr. 5 (Tray-Text „Gast/Gäste auf Sendung“ zählte NDI-Sender).

**Files:**
- Modify: `apps/connect/src/main/tray.ts:1-5` (Kopfkommentar, Import), `:10` (neue Variable), `:22-27` (`TrayDeps`), `:33` (`createTray`), `:59-77` (`statusLine()` und `rebuild()`). Zeilenangaben im Ausgangsstand; ab Zeile 20 schiebt Aufgabe 5 alles um eins nach unten (`zoom: null,` im Anfangsstatus).
- Modify: `apps/connect/src/main/index.ts:13-14` (Importe), `:18` (`zoomAbgebaut`), `:51-57` (`session-end`), `:81` (`initNdiGuests`), `:85-89` (`startZoom` nach `registerIpc`), `:109-113` (`onZoomVerlassen`), `:124-132` (`before-quit`)
- Modify: `apps/connect/src/renderer/src/App.tsx:6` (Import), `:246` (Kopfzeile)
- Test: keine neue Testdatei. Die Texte und Regeln (`gaesteZeile`, `zoomZeile`, `trayTooltip`, `trayVerlassenAktiv`) belegt `apps/connect/test/zoom-text.test.ts` aus Aufgabe 5 tabellengetrieben. Hier: Typecheck rot → grün, Bau mit Bündel-Prüfung, Selbsttest.

**Interfaces:**

Consumes:
```ts
// Aufgabe 5 · apps/connect/src/shared/zoom-text.ts
export function gaesteZeile(s: AppStatus): string;              // Spec 7.3
export function zoomZeile(k: ZoomKurz | null): string | null;   // Spec 7.2 linke Spalte; null bei null und bei Z0
export function trayTooltip(s: AppStatus): string;              // Spec 7.4, Code wörtlich
export function trayVerlassenAktiv(k: ZoomKurz | null): boolean; // true in Z3–Z11
// Aufgabe 5 · apps/connect/src/shared/types.ts
export interface AppStatus { /* … */ zoom: ZoomKurz | null }
// Aufgabe 16 · apps/connect/src/main/zoom.ts
export function startZoom(d: { getWindow: () => BrowserWindow | null; logDir: string; onKurz: () => void }): void;
export function zoomLaeuft(): boolean;
export function zoomBeenden(fristMs: number): Promise<void>;   // wirft nie; ohne Kern sofort aufgelöst
export function zoomVerlassen(): void;
export function zoomGastLabelsGeaendert(): void;
// Aufgabe 10 · apps/connect/src/main/zoom/kern.ts
export const BEENDEN_FRIST_MS = 15_000;
// bestehend
export function notifyStatusChanged(): void;                    // apps/connect/src/main/ipc.ts
const runtime: AppRuntime;                                      // apps/connect/src/main/index.ts:22, runtime.logDir
```

Produces:
```ts
// apps/connect/src/main/tray.ts
interface TrayDeps {
  iconPath: string;
  getWindow: () => BrowserWindow | null;
  sendCommand: (cmd: TrayCommand) => void;
  onQuit: () => void;
  onZoomVerlassen: () => void;
}
export function createTray(deps: TrayDeps): void;               // Signatur sonst unverändert
// Tray-Menü (Spec 7.3): Gäste-Zeile, Zoom-Zeile (nur mit status.zoom), Trenner, „Fenster anzeigen“,
// „Raum schließen“, „Zoom-Meeting verlassen“ (nur mit status.zoom, aktiv nach trayVerlassenAktiv), Trenner, „Beenden“
```

**Vorab (für den Umsetzer):**
- Stand: nach Aufgaben 1–16. `tray.ts` hat seit Aufgabe 5 im Anfangsstatus `zoom: null,`; sonst sind `tray.ts`, `index.ts` und `App.tsx` seit dem Ausgangsstand unverändert. Alle Vorher-Ausschnitte unten sind wortgleich daraus und je genau einmal vorhanden (G14: LF-Ausschnitte, Edit-Werkzeug).
- Reihenfolge ist tragend: Step 1 erweitert `TrayDeps` zuerst, damit der Typecheck in Step 2 rot wird (TDD für die Verdrahtung). Zwischen Step 3 und Step 9 ist `index.ts` vollständig typrein; `tray.ts` erst wieder ab Step 11 ohne ungenutzte Hilfsfunktion.
- `before-quit` ist wörtlich Spec 6.6; die Abbau-Aufrufe danach sind die bisherigen sechs.
- Gegengeprüft am Probelauf (Kopie von `apps/connect`, Stand nach Aufgabe 16 mit Stubs für Aufgabe 5 und 10–15): Step 2 rot mit genau der unten zitierten Meldung, Step 14 grün, Bau grün, alle Zählwerte aus Step 15 wie angegeben.

- [ ] **Step 1: `TrayDeps` um `onZoomVerlassen` erweitern** (drei Ersetzungen in `apps/connect/src/main/tray.ts`).

Ersetzung 1. Vorher (eindeutig):
```ts
let onQuit: () => void = () => {};
```
Nachher:
```ts
let onQuit: () => void = () => {};
let onZoomVerlassen: () => void = () => {};
```

Ersetzung 2. Vorher (eindeutig):
```ts
  sendCommand: (cmd: TrayCommand) => void;
  onQuit: () => void;
}
```
Nachher:
```ts
  sendCommand: (cmd: TrayCommand) => void;
  onQuit: () => void;
  /** Tray „Zoom-Meeting verlassen“: wirkt immer als „Verlassen“ nach Spec 6.8 (ohne Fehler, ohne Alarm). */
  onZoomVerlassen: () => void;
}
```

Ersetzung 3. Vorher (eindeutig):
```ts
  onQuit = deps.onQuit;
```
Nachher:
```ts
  onQuit = deps.onQuit;
  onZoomVerlassen = deps.onZoomVerlassen;
```

- [ ] **Step 2: Typecheck laufen lassen (rot).**

Run: `npm run typecheck -w @jm/connect`
Expected: `typecheck:node` scheitert mit genau diesem Fehler, Exit-Code ≠ 0:
```
src/main/index.ts(105,16): error TS2345: Argument of type '{ iconPath: string; getWindow: () => BrowserWindow | null; sendCommand: (cmd: TrayCommand) => void | undefined; onQuit: () => void; }' is not assignable to parameter of type 'TrayDeps'.
  Property 'onZoomVerlassen' is missing in type '{ iconPath: string; getWindow: () => BrowserWindow | null; sendCommand: (cmd: TrayCommand) => void | undefined; onQuit: () => void; }' but required in type 'TrayDeps'.
```

- [ ] **Step 3: `index.ts` — Importe.**

Datei `apps/connect/src/main/index.ts`. Vorher (Zeilen 13–14, eindeutig):
```ts
import { handleShowDeepLink } from './show-open';
import { startPresenterLink, stopPresenterLink } from './presenter-link';
```
Nachher:
```ts
import { handleShowDeepLink } from './show-open';
import { startPresenterLink, stopPresenterLink } from './presenter-link';
import { startZoom, zoomBeenden, zoomGastLabelsGeaendert, zoomLaeuft, zoomVerlassen } from './zoom';
import { BEENDEN_FRIST_MS } from './zoom/kern';
```

- [ ] **Step 4: `index.ts` — Merker `zoomAbgebaut` (Spec 6.6).**

Vorher (eindeutig):
```ts
let isQuitting = false;
```
Nachher:
```ts
let isQuitting = false;
/** Zoom ist abgebaut (Spec 6.6): der zweite before-quit-Durchlauf räumt den Rest ab. */
let zoomAbgebaut = false;
```

- [ ] **Step 5: `index.ts` — `session-end` des Hauptfensters stößt das Beenden an (Spec 6.6).** Fenster schließen bleibt „ins Tray“, Zoom läuft dabei weiter.

Vorher (in `createWindow`, eindeutig):
```ts
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
  return win;
```
Nachher:
```ts
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
  // Windows-Abmeldung oder Herunterfahren: das Zoom-Meeting noch sauber verlassen (Spec 6.6).
  // Ob Windows so lange wartet, ist ungemessen (Spec 17.1).
  win.on('session-end', () => void zoomBeenden(BEENDEN_FRIST_MS));
  return win;
```

- [ ] **Step 6: `index.ts` — Gast-Sender melden ihre Änderung auch an Zoom (Kollision Q10, Spec 6.3).**

Vorher (Zeile 81, eindeutig):
```ts
    initNdiGuests({ getPeer: () => getPeerWindow(), onChange: () => notifyStatusChanged() });
```
Nachher:
```ts
    // Gast-Sender ändern sich → Status pushen und die Kollisionsprüfung Gast ↔ Zoom neu rechnen (Spec 6.3).
    initNdiGuests({
      getPeer: () => getPeerWindow(),
      onChange: () => {
        notifyStatusChanged();
        zoomGastLabelsGeaendert();
      },
    });
```

- [ ] **Step 7: `index.ts` — Zoom nach `registerIpc` starten.** Vor `createWindow`, damit die Zoom-Kanäle stehen, bevor die Karte `zoomGet` ruft. Unabhängig vom Cloud-Raum (E4).

Vorher (eindeutig):
```ts
    registerIpc({
      getWindow: () => getMainWindow(),
      getPeer: () => getPeerWindow(),
      onStatusChange: (s) => setTrayStatus(s),
    });
```
Nachher:
```ts
    registerIpc({
      getWindow: () => getMainWindow(),
      getPeer: () => getPeerWindow(),
      onStatusChange: (s) => setTrayStatus(s),
    });

    // Zoom (Stage 4, nur Windows) – unabhängig vom Cloud-Raum (E4). Jede Änderung der Kurzform geht
    // als AppStatus an Tray und Kopfzeile.
    startZoom({ getWindow: () => getMainWindow(), logDir: runtime.logDir, onKurz: () => notifyStatusChanged() });
```

- [ ] **Step 8: `index.ts` — Tray bekommt „Zoom-Meeting verlassen“.**

Vorher (eindeutig):
```ts
      onQuit: () => {
        isQuitting = true;
        app.quit();
      },
    });
```
Nachher:
```ts
      onQuit: () => {
        isQuitting = true;
        app.quit();
      },
      onZoomVerlassen: () => zoomVerlassen(),
    });
```

- [ ] **Step 9: `index.ts` — asynchrones Beenden, wörtlich nach Spec 6.6.**

Vorher (Zeilen 124–132, eindeutig):
```ts
  app.on('before-quit', () => {
    isQuitting = true;
    tearDownAll();
    stopProgram();
    destroyPeerWindow();
    stopControlServer();
    stopPresenterLink();
    destroyTray();
  });
```
Nachher:
```ts
  // Spec 6.1/6.6: Läuft Zoom (Kopie, Prüfung oder Bridge), wartet das Beenden höchstens
  // BEENDEN_FRIST_MS darauf, dass die Kopie abbricht und `.teil` löscht bzw. die Bridge das Meeting
  // verlässt; erst der zweite Durchlauf räumt ab.
  app.on('before-quit', (e) => {
    isQuitting = true;
    if (!zoomAbgebaut && zoomLaeuft()) {
      e.preventDefault();
      // Ein zweiter Aufruf während des Wartens bekommt dasselbe Versprechen (kern.beenden).
      void zoomBeenden(BEENDEN_FRIST_MS).finally(() => {
        zoomAbgebaut = true;
        app.quit();
      });
      return;
    }
    tearDownAll();
    stopProgram();
    destroyPeerWindow();
    stopControlServer();
    stopPresenterLink();
    destroyTray();
  });
```

- [ ] **Step 10: `tray.ts` — Kopfkommentar und Import der Textquelle.**

Datei `apps/connect/src/main/tray.ts`. Vorher (Zeilen 1–5, eindeutig):
```ts
// System-Tray: hält die App im Hintergrund am Leben (NDI-Sender laufen weiter,
// während das Fenster versteckt ist) und bietet Fenster-anzeigen / Raum-schließen /
// Beenden. Spiegelt den App-Status (Raum offen? Gäste auf Sendung?).
import { Menu, Tray, nativeImage, type BrowserWindow } from 'electron';
import type { AppStatus, TrayCommand } from '@shared/types';
```
Nachher:
```ts
// System-Tray: hält die App im Hintergrund am Leben (NDI-Sender und Zoom laufen weiter,
// während das Fenster versteckt ist) und bietet Fenster anzeigen / Raum schließen /
// Zoom-Meeting verlassen / Beenden. Die beiden Statuszeilen (Gäste, Zoom) und der Tooltip
// kommen aus @shared/zoom-text, derselben Quelle wie die Kopfzeile (Spec 7.2–7.4).
import { Menu, Tray, nativeImage, type BrowserWindow } from 'electron';
import type { AppStatus, TrayCommand } from '@shared/types';
import { gaesteZeile, trayTooltip, trayVerlassenAktiv, zoomZeile } from '@shared/zoom-text';
```

- [ ] **Step 11: `tray.ts` — `statusLine()` entfällt, Menü und Tooltip nach Spec 7.3/7.4.** Die alte Zeile „● N Gast/Gäste auf Sendung“ zählte NDI-Sender, nicht Gäste auf Sendung (17.2 Nr. 5); `gaesteZeile` ersetzt sie.

Vorher (eindeutig):
```ts
function statusLine(): string {
  if (status.ndiSenders > 0) return `● ${status.ndiSenders} Gast/Gäste auf Sendung`;
  if (status.configured) return '○ Bereit';
  return '△ Cloud nicht konfiguriert';
}

function rebuild(): void {
  if (!tray) return;
  const template: Electron.MenuItemConstructorOptions[] = [
    { label: statusLine(), enabled: false },
    { type: 'separator' },
    { label: 'Fenster anzeigen', click: showWindow },
    { label: 'Raum schließen', enabled: status.ndiSenders > 0, click: () => sendCommand({ kind: 'closeRoom' }) },
    { type: 'separator' },
    { label: 'Beenden', click: () => onQuit() },
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
  tray.setToolTip(status.ndiSenders > 0 ? 'JM Connect — Zuschaltungen aktiv' : 'JM Connect');
}
```
Nachher:
```ts
// Menü nach Spec 7.3: Gäste-Zeile, Zoom-Zeile (nur Windows), Trenner, „Fenster anzeigen“,
// „Raum schließen“ (unverändert), „Zoom-Meeting verlassen“ (aktiv in Z3–Z11), Trenner, „Beenden“.
function rebuild(): void {
  if (!tray) return;
  const template: Electron.MenuItemConstructorOptions[] = [{ label: gaesteZeile(status), enabled: false }];
  const zoomText = zoomZeile(status.zoom);
  if (zoomText !== null) template.push({ label: zoomText, enabled: false });
  template.push(
    { type: 'separator' },
    { label: 'Fenster anzeigen', click: showWindow },
    { label: 'Raum schließen', enabled: status.ndiSenders > 0, click: () => sendCommand({ kind: 'closeRoom' }) },
  );
  if (status.zoom !== null) {
    template.push({
      label: 'Zoom-Meeting verlassen',
      enabled: trayVerlassenAktiv(status.zoom),
      click: () => onZoomVerlassen(),
    });
  }
  template.push({ type: 'separator' }, { label: 'Beenden', click: () => onQuit() });
  tray.setContextMenu(Menu.buildFromTemplate(template));
  tray.setToolTip(trayTooltip(status));
}
```

- [ ] **Step 12: `App.tsx` — Import der Zoom-Zeile.**

Datei `apps/connect/src/renderer/src/App.tsx`. Vorher (Zeile 6, eindeutig):
```tsx
import type { AppStatus, GuestInvite, ProxyKeySource, ShowInfo } from '@shared/types';
```
Nachher:
```tsx
import type { AppStatus, GuestInvite, ProxyKeySource, ShowInfo } from '@shared/types';
import { zoomZeile } from '@shared/zoom-text';
```

- [ ] **Step 13: `App.tsx` — Kopfzeile rechts (Spec 7.3 letzter Absatz).** „○ nicht verbunden“ klänge bei laufendem Zoom wie „gar nichts verbunden“; darunter die Zoom-Zeile aus derselben Funktion wie das Tray (unter macOS ist `status.zoom` `null`, dann keine Zeile).

Vorher (eindeutig):
```tsx
          <div>{connected ? '● Raum verbunden' : '○ nicht verbunden'}</div>
        </div>
```
Nachher:
```tsx
          <div>{connected ? '● Raum verbunden' : '○ Raum nicht verbunden'}</div>
          {status?.zoom && <div>{zoomZeile(status.zoom)}</div>}
        </div>
```

- [ ] **Step 14: Typecheck (grün).**

Run: `npm run typecheck -w @jm/connect`
Expected: `typecheck:node` und `typecheck:web` ohne Zeile mit `error TS`, Exit-Code 0. Zusätzlich: `grep -n "statusLine\|Gast/Gäste" apps/connect/src/main/tray.ts` findet nichts (Exit-Code 1).

- [ ] **Step 15: Bau und Bündel-Prüfung (L15 mit gebündelter Bridge).** Erst ab jetzt ruft `index.ts` `startZoom`; damit liegen Hülle, Kern und `bridge.ts` im Main-Bündel.

Run:
```bash
npm run build -w @jm/connect
grep -cF "import.meta" apps/connect/out/main/index.cjs
grep -cF 'require("@jm/zoom-bridge' apps/connect/out/main/index.cjs
grep -cF "jmc:zoom-get" apps/connect/out/main/index.cjs
grep -cF "Bridge laeuft bereits" apps/connect/out/main/index.cjs
grep -cF "zoom-laufzeit" apps/connect/out/main/index.cjs
grep -cF "session-end" apps/connect/out/main/index.cjs
grep -cF "Raum nicht verbunden" apps/connect/out/renderer/assets/index-*.js
```
Expected: dreimal `✓ built in …`, keine Zeile mit `error`; dann der Reihe nach:
- `0` — kein `import.meta` im CJS-Bündel (electron-vite ersetzt `import.meta.url` aus `bridge.ts` durch `require("url").pathToFileURL(__filename).href`; gemessen),
- `0` — die Bridge wird gebündelt, nicht zur Laufzeit geladen (im Installer fehlt `node_modules/@jm/zoom-bridge` absichtlich, G6),
- `1` — die Zoom-Kanäle sind im Main verdrahtet,
- `1` — `bridge.ts` liegt im Bündel (Text aus `Bridge.start()`),
- mindestens `1` — Laufzeit-Pfad aus `zoom.ts`/`laufzeit.ts`,
- `1` — `session-end`-Haken,
- `1` — die Kopfzeile im Renderer-Bündel. Der Platzhalter `index-*.js` trifft genau eine Datei (`out/renderer/assets/` enthält daneben nur `index-<hash>.css`, `peer-*.js` und `protocol-*.js`); bei nur einer Datei gibt `grep -c` keinen Dateinamen aus.

- [ ] **Step 16: Selbsttest (grün).**

Run: `npm run selftest -w @jm/connect`
Expected: die vier Testdateien enden der Reihe nach mit `487 ok, 0 fehlgeschlagen.` (`zoom-text`), `79 ok, 0 fehlgeschlagen.` (`zoom-laufzeit`), `78 ok, 0 fehlgeschlagen.` (`zoom-teile`) und `252 ok, 0 fehlgeschlagen, 0 übersprungen.` (`zoom-kern`; unter Linux `249 ok, 0 fehlgeschlagen, 1 übersprungen.`), keine Zeile, die mit `FAIL` beginnt, Exit-Code 0. Diese Aufgabe ändert keinen Test; die Texte für Tray, Tooltip und Kopfzeile prüft `zoom-text.test.ts`.

- [ ] **Step 17: Commit.**

```bash
git add apps/connect/src/main/tray.ts apps/connect/src/main/index.ts apps/connect/src/renderer/src/App.tsx
git status --short
```
Erwartet genau diese gestagten Zeilen (sonst nichts Gestagtes):
```
M  apps/connect/src/main/index.ts
M  apps/connect/src/main/tray.ts
M  apps/connect/src/renderer/src/App.tsx
```
Dann:
```bash
git commit -m "feat(connect): Tray mit Gäste- und Zoom-Zeile, Kopfzeile, Beenden wartet auf Zoom" -m "Das Tray zeigt die berichtigte Gäste-Zeile und die Zoom-Zeile aus shared/zoom-text (dieselbe Quelle wie die Kopfzeile), dazu Zoom-Meeting verlassen und den kombinierten Tooltip (Spec 7.2-7.4). index.ts startet Zoom nach registerIpc, meldet Gast-Sender an die Kollisionsprüfung, wartet beim Beenden höchstens 15 s auf das Verlassen des Meetings bzw. das Ende einer abgebrochenen SDK-Kopie und reagiert auf session-end (Spec 6.1, 6.6). Kopfzeile: Raum nicht verbunden (#197)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Nicht pushen.

**Sichtprüfung:** im Owner-Kurztest, Abnahme 1 (Tray „△ Zoom: Einrichtung unvollständig“), 19 (Fenster schließen → Tray, Quellen laufen weiter), 21 (Tray → Beenden binnen 15 s, „JM Connect“ verschwindet sofort aus dem Zoom-Client).

**Abweichungen vom Gerüst:**
1. **Bündel-Prüfung erweitert:** Neben `import.meta` = 0 und `jmc:zoom-get` ≥ 1 (aus Aufgabe 16 hierher verschoben, siehe dort Abweichung 2) prüft Step 15, dass `@jm/zoom-bridge` nicht per `require` nachgeladen wird und dass `bridge.ts` wirklich im Bündel liegt. Ohne Bündelung stürzte der gepackte Main beim Start ab, weil `@jm/zoom-bridge` nur in den `devDependencies` steht.
2. **Zeilenangaben:** Die Gerüst-Angabe `tray.ts:161-216` passt nicht zum Ist-Stand (`tray.ts` hat 77 Zeilen, nach Aufgabe 5 78). Oben stehen die echten Stellen; maßgeblich sind die Vorher-Ausschnitte.
3. **Menü als Liste mit `push`** statt als Literal mit bedingten Einträgen: so bleibt jedes Element unter dem Typ `MenuItemConstructorOptions` geprüft, und die Reihenfolge aus Spec 7.3 steht Zeile für Zeile da.

---

### Task 18: Oberfläche: Zoom-Karte (ZoomCard.tsx)

**Spec:** 9 Punkte 1–11 (ohne den Z11-Knopf „Abbrechen“, der kommt mit Plan 4b), UI-Texte wörtlich; dazu 6.1 (Sperre S10 sichtbar als gesperrte Knöpfe), 6.3 (Laden, Q9 als zweiter Klick, Ton-Schalter je Zeile, Doppelname, Kollision), 6.7 (Versatz-Feld), 6.8 (Verlassen, Schließen, Meldung quittieren), 7.2 rechte Spalte (Kartentext über `kartenZeile`), 8.4 (Tooltips Q14, Q15; Q11, Q13 als Text), E4 (Karte außerhalb des Raum-Zweigs).

**Files:**
- Create: `apps/connect/src/renderer/src/zoom/ZoomCard.tsx`
- Modify: `apps/connect/src/renderer/src/App.tsx` — Import nach `import { toDataUrl } from '@/lib/qr';` (Ausgangsstand Zeile 7, nach Aufgabe 17 Zeile 8), Einhängen nach dem Raum-Zweig (Ausgangsstand `:357-361`, Spec 9: „nach Zeile 359“)
- Test: keine neue Testdatei. Die Logik der Karte (welcher Knopf wann, welche Statuszeile) steckt in `zoomKnoepfe`, `kartenZeile`, `sdkZeile`, `sdkKnopf`, `zugangZeile` und ist in `apps/connect/test/zoom-text.test.ts` (Aufgabe 5) belegt. Hier: Typecheck rot → grün, Prüfung der wörtlichen Texte, Bau, Selbsttest.

**Interfaces:**

Consumes:
```ts
// Aufgabe 5 · apps/connect/src/shared/types.ts (Spec 5.4 + Zusätze L4/L5)
export interface ZoomQuelle { aboId: number; ndiName: string; bild: Exclude<VideoState, 'unsubscribed'>; bildGrund: VideoReason; ton: AudioState | 'aus'; tonGrund: AudioReason | null; fehler: string | null }
export interface ZoomParticipant { id: number; name: string; rolle: UserRoleName; kamera: 'an' | 'aus' | 'keine'; imWarteraum: boolean; doppelname: boolean; tonVorwahl: boolean; quelle: ZoomQuelle | null; ndiNameVorschau: string; kollision: string | null; fehler: string | null }
export interface ZoomSollEintrag { name: string; ton: boolean; ndiName: string; stand: 'wartet' | 'doppelname' | 'verwaist'; aboId: number | null; doppelname: boolean }
export interface ZoomAbbild { kurz: ZoomKurz; einrichtung: { sdk: { stand; fassung; kopie: { dateien; dateienGesamt; bytes; bytesGesamt } | null; text: string | null }; zugang: { herkunft: ProxyKeySource; clientIdEnde: string | null; text: string | null } }; anzeigename: string; versatz: { gewuenschtMs: number; bestaetigtMs: number | null }; teilnehmer: ZoomParticipant[]; soll: ZoomSollEintrag[]; abriss: { versuch: number | null; versuche: 5; naechsterUm: number | null } | null; meldung: { art: 'info' | 'warnung' | 'fehler'; text: string; detail: string | null } | null; hinweise: string[]; erneutMoeglich: boolean; pruefungLaeuft: boolean }
export type ZoomErgebnis = { ok: true } | { ok: false; text: string };
// Aufgabe 5 · apps/connect/src/shared/zoom-text.ts
export function kartenZeile(a: ZoomAbbild, jetztMs: number): string | null;
export function sdkZeile(a: ZoomAbbild): string;
export function sdkKnopf(a: ZoomAbbild): 'SDK-Ordner wählen …' | 'Neu wählen …';
export function zugangZeile(a: ZoomAbbild): string;
export interface ZoomKnoepfe {
  meldung: { erneut: boolean; schliessen: boolean; ok: boolean; logordner: boolean } | null;
  einrichtungAenderbar: boolean; pruefen: 'aus' | 'bereit' | 'laeuft';
  beitrittSichtbar: boolean; beitretenGesperrt: boolean; verlassen: boolean; abbrechen: boolean;
  einrichtungOffen: boolean; sperrHinweis: boolean;
}
export function zoomKnoepfe(a: ZoomAbbild): ZoomKnoepfe;
// Aufgabe 16 · window.jmconnect (JmConnectApi)
platform: string;
zoomGet(): Promise<ZoomAbbild>; onZoom(cb: (a: ZoomAbbild) => void): () => void;
zoomSdkWaehlen(): Promise<ZoomErgebnis>; zoomZugangWaehlen(): Promise<ZoomErgebnis>; zoomZugangLoeschen(): Promise<ZoomErgebnis>;
zoomPruefen(): Promise<ZoomErgebnis>;
zoomBeitreten(p: { nummer: string; kenncode: string; anzeigename: string }): Promise<ZoomErgebnis>;
zoomVerlassen(): Promise<void>;
zoomLaden(p: { id: number; ton: boolean; trotzBetriebsgroesse: boolean }): Promise<ZoomErgebnis>;
zoomEntladen(p: { aboId: number }): Promise<ZoomErgebnis>; zoomTon(p: { id: number; an: boolean }): Promise<ZoomErgebnis>;
zoomSollVerwerfen(p: { name: string }): Promise<void>; zoomVersatz(p: { ms: number }): Promise<ZoomErgebnis>;
zoomErneut(): Promise<ZoomErgebnis>; zoomSchliessen(): Promise<void>; zoomMeldungWeg(): Promise<void>; zoomLogordner(): Promise<void>;
```

Produces:
```ts
// apps/connect/src/renderer/src/zoom/ZoomCard.tsx
export function ZoomCard(): JSX.Element;   // keine Props; holt das Abbild selbst (zoomGet + onZoom)
```

**Vorab (für den Umsetzer):**
- Stand: nach Aufgaben 1–17. `App.tsx` trägt seit Aufgabe 17 den Import `zoomZeile` (Zeile 7) und die geänderte Kopfzeile; die beiden Vorher-Ausschnitte unten liegen woanders und sind davon unberührt, je genau einmal vorhanden (G14: LF-Ausschnitte, Edit-Werkzeug).
- Der Renderer importiert `klartext.ts` nicht (das ist Main-Code). Was die Karte selbst schreibt, sind UI-Texte aus Spec 9 und die Tooltip-/Hinweistexte S10, Q11, Q13, Q14, Q15 sowie der Anfang von Q9, alle als Literale wörtlich aus Spec 8. Alle übrigen Texte kommen aus `@shared/zoom-text` oder aus dem Main (`ZoomErgebnis.text`, `abbild.meldung`, `quelle.fehler`, `fehler`, `kollision`, `einrichtung.*.text`, `hinweise`).
- `PttButton`, `GuestActions`, `PhaseBadge` aus `App.tsx` werden **nicht** wiederverwendet (kein Tally, kein Talkback, keine Phasen).
- Leere Antworttexte (`{ ok: false, text: '' }`, L9) zeigt die Karte nicht an. Fehler, die zugleich im Abbild stehen (SDK-Wahl, Zugangsdaten, Prüfergebnis als `meldung`), zeigt sie nur einmal.
- Gesperrte Knöpfe bekommen in Chromium keine Mausereignisse; Tooltips (S10, Q15) sitzen darum an einem umgebenden `<span>`, Q14 am `<label>` des Ton-Schalters.
- Gegengeprüft am Probelauf (Stand nach Aufgabe 17 mit Stubs für Aufgabe 5): Step 2 rot mit genau der zitierten Meldung, Typecheck und Bau grün, Textprüfung „alle 44 Texte da“.

- [ ] **Step 1: Karte in `App.tsx` einhängen (Import und Aufruf).**

Datei `apps/connect/src/renderer/src/App.tsx`. Ersetzung 1. Vorher (eindeutig):
```tsx
import { toDataUrl } from '@/lib/qr';
```
Nachher:
```tsx
import { toDataUrl } from '@/lib/qr';
import { ZoomCard } from './zoom/ZoomCard';
```

Ersetzung 2 (Ende des Raum-Zweigs, Spec 9: außerhalb von `connected`, direkt nach dem Raum-Abschnitt). Vorher (eindeutig):
```tsx
          </ul>
        </>
      )}
    </div>
  );
}
```
Nachher:
```tsx
          </ul>
        </>
      )}

      {/* Zoom (Stage 4a, Spec 9): außerhalb des Raum-Zweigs, unabhängig vom Cloud-Raum (E4), nur unter Windows. */}
      {window.jmconnect.platform === 'win32' && <ZoomCard />}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck laufen lassen (rot).**

Run: `npm run typecheck:web -w @jm/connect`
Expected: genau dieser Fehler, Exit-Code ≠ 0:
```
src/renderer/src/App.tsx(9,26): error TS2307: Cannot find module './zoom/ZoomCard' or its corresponding type declarations.
```

- [ ] **Step 3: `apps/connect/src/renderer/src/zoom/ZoomCard.tsx` anlegen.** Aufbau von oben nach unten wie Spec 9 (1 Titel + Kartentext, 2 Meldungsbereich, 3 Einrichtung, 4 Beitritt, 5 Laufend, 7 Versatz, 8 Teilnehmer, 9 Gemerkte Quellen, 10 Hinweise, 11 Fußzeile; Punkt 6 „Abriss“ ist in 4a nur die Statuszeile, der Countdown tickt über `kartenZeile`).

```tsx
// Zoom-Karte (Spec 9): Einrichtung, Beitritt, Teilnehmer und Quellen. Sie steht in App.tsx außerhalb
// des Raum-Zweigs und erscheint nur unter Windows. Statustexte und Knopflogik kommen aus
// @shared/zoom-text (dieselbe Quelle wie Tray und Kopfzeile), Fehlertexte aus dem Main
// (ZoomErgebnis.text, abbild.meldung). Der Kenncode lebt hier nur bis zum Klick auf „Beitreten“ (Spec 5.7).
// Bewusst NICHT wiederverwendet: PttButton, GuestActions, PhaseBadge (kein Tally, kein Talkback, keine Phasen).
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ZoomAbbild, ZoomErgebnis, ZoomParticipant, ZoomSollEintrag } from '@shared/types';
import { kartenZeile, sdkKnopf, sdkZeile, zoomKnoepfe, zugangZeile } from '@shared/zoom-text';

// Tooltip- und Hinweistexte wörtlich aus Spec 8 und 9 (der Renderer importiert klartext.ts nicht).
const TEXT_S10 = 'Während Zoom läuft oder die Kopie läuft, lassen sich SDK-Ordner und Zugangsdaten nicht ändern.';
const TEXT_Q11 = 'Name doppelt im Meeting — nach einem Wiederbeitritt kann Connect diese Quelle nicht von selbst zuordnen.';
const TEXT_Q13 = 'Bild-Versatz: erlaubt sind ganze Zahlen von 0 bis 1000 ms.';
const TEXT_Q14 = 'Zum Umschalten erst entladen.';
const TEXT_Q15 = 'Erst im Zoom-Client zulassen.';
/** Anfang von Q9: daraus macht die Karte den zweiten Klick („trotzdem laden“, Spec 6.3 Schritt 2). */
const Q9_ANFANG = 'Mehr als 5 Zoom-Quellen sind nicht gemessen.';
const SPERR_HINWEIS = 'Zoom ist gesperrt, bis SDK-Ordner und Zugangsdaten vollständig eingerichtet sind.';
const FUSSZEILE = 'Zoom-Quellen haben kein Tally, kein Talkback und kein Mix-Minus — das sind Grenzen von Zoom.';

/** Wo eine abgelehnte Antwort (ZoomErgebnis.text) erscheint; 'karte' = unter der Statuszeile, auch für unerwartete IPC-Fehler. */
type Ort = 'karte' | 'einrichtung' | 'beitritt' | `zeile:${number}` | `soll:${string}`;
type MeldungsArt = NonNullable<ZoomAbbild['meldung']>['art'];

const KARTE = 'mt-6 rounded-lg border border-neutral-700 bg-neutral-900 p-4';
const INP = 'w-full rounded border bg-neutral-950 px-2 py-1 text-sm text-neutral-100';
const KNOPF = 'rounded px-2 py-1 text-xs font-semibold disabled:opacity-40';
const RAND = `${KNOPF} border border-neutral-700 text-neutral-200 hover:bg-neutral-800`;
const GELB = `${KNOPF} bg-yellow-400 text-neutral-900`;
const ROT = `${KNOPF} bg-red-700 text-white`;
const MELDUNG_FARBE: Record<MeldungsArt, string> = {
  info: 'border-sky-800 bg-sky-950/40 text-sky-100',
  warnung: 'border-yellow-800 bg-yellow-950/40 text-yellow-100',
  fehler: 'border-red-800 bg-red-950/40 text-red-100',
};

/** Für Aufrufe ohne Ergebnis (verlassen, schließen …): einheitlich durch fuehreAus schicken. */
async function ohneText(p: Promise<void>): Promise<ZoomErgebnis> {
  await p;
  return { ok: true };
}

function prozent(teil: number, ganz: number): number {
  return ganz > 0 ? Math.min(100, Math.round((teil / ganz) * 100)) : 0;
}

function sollText(e: ZoomSollEintrag): string {
  if (e.stand === 'wartet') return `${e.name} — wartet auf die Person`;
  if (e.stand === 'doppelname') return `${e.name} — Name doppelt, bitte von Hand laden`;
  return `${e.name} — Person weg, Quelle schwarz`;
}

function Kennzeichen({ children, rot = false }: { children: string; rot?: boolean }): JSX.Element {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${rot ? 'bg-red-900 text-red-100' : 'bg-neutral-800 text-neutral-300'}`}
    >
      {children}
    </span>
  );
}

/** Gesperrte Knöpfe bekommen in Chromium keine Mausereignisse; der Tooltip sitzt darum am Rahmen. */
function MitTooltip({ titel, children }: { titel: string | undefined; children: JSX.Element }): JSX.Element {
  return (
    <span title={titel} className="inline-flex">
      {children}
    </span>
  );
}

export function ZoomCard(): JSX.Element {
  const [abbild, setAbbild] = useState<ZoomAbbild | null>(null);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [jetzt, setJetzt] = useState(() => Date.now());
  const [nummer, setNummer] = useState('');
  const [kenncode, setKenncode] = useState('');
  /** null = noch nicht angefasst, dann gilt der gespeicherte Anzeigename aus dem Abbild. */
  const [anzeigename, setAnzeigename] = useState<string | null>(null);
  /** null = unverändert, dann gilt der gespeicherte Versatz aus dem Abbild. */
  const [versatz, setVersatz] = useState<string | null>(null);
  const [versatzFehler, setVersatzFehler] = useState<string | null>(null);
  const [einrichtungAuf, setEinrichtungAuf] = useState(false);
  const [verlassenFrage, setVerlassenFrage] = useState(false);
  /** Zeile, für die Q9 kam: der nächste Klick dort lädt trotzdem. */
  const [trotzId, setTrotzId] = useState<number | null>(null);
  const [antwort, setAntwort] = useState<{ ort: Ort; text: string } | null>(null);
  /** Laufende Aufrufe (gegen Doppelklicks), je Knopf ein Schlüssel. */
  const [laeuft, setLaeuft] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    let lebt = true;
    window.jmconnect
      .zoomGet()
      .then((a) => {
        // Ein Push, der vor der Antwort kam, ist neuer: nicht überschreiben.
        if (lebt) setAbbild((alt) => alt ?? a);
      })
      .catch((e: unknown) => {
        if (lebt) setLadeFehler(e instanceof Error ? e.message : String(e));
      });
    const aus = window.jmconnect.onZoom((a) => setAbbild(a));
    return () => {
      lebt = false;
      aus();
    };
  }, []);

  // Countdown der Statuszeile (Z11, kommt mit 4b): nur ticken, solange ein Zeitpunkt ansteht.
  const naechsterUm = abbild?.abriss?.naechsterUm ?? null;
  useEffect(() => {
    if (naechsterUm === null) return;
    setJetzt(Date.now());
    const t = setInterval(() => setJetzt(Date.now()), 250);
    return () => clearInterval(t);
  }, [naechsterUm]);

  const knoepfe = useMemo(() => (abbild ? zoomKnoepfe(abbild) : null), [abbild]);
  const verlassenMoeglich = knoepfe?.verlassen ?? false;
  useEffect(() => {
    if (!verlassenMoeglich) setVerlassenFrage(false);
  }, [verlassenMoeglich]);

  /** Führt einen Aufruf aus; ein abgelehnter mit Text erscheint am Ort `ort` (null = nirgends, weil das Abbild ihn zeigt). */
  const fuehreAus = useCallback(
    async (schluessel: string, ort: Ort | null, f: () => Promise<ZoomErgebnis>): Promise<ZoomErgebnis> => {
      setAntwort(null);
      setLaeuft((s) => new Set(s).add(schluessel));
      try {
        const r = await f();
        if (!r.ok && r.text && ort !== null) setAntwort({ ort, text: r.text });
        return r;
      } catch (e) {
        const text = e instanceof Error ? e.message : String(e);
        setAntwort({ ort: ort ?? 'karte', text });
        return { ok: false, text };
      } finally {
        setLaeuft((s) => {
          const n = new Set(s);
          n.delete(schluessel);
          return n;
        });
      }
    },
    [],
  );

  if (!abbild || !knoepfe) {
    return (
      <section className={KARTE}>
        <h2 className="text-sm font-semibold">Zoom-Meeting</h2>
        {ladeFehler && <p className="mt-2 text-xs text-red-300">{ladeFehler}</p>}
      </section>
    );
  }

  const a = abbild;
  const kn = knoepfe;
  const k = a.kurz;
  const sdk = a.einrichtung.sdk;
  const zugang = a.einrichtung.zugang;
  const zugangText = zugangZeile(a);
  const imMeeting = k.zustand === 'im_meeting';
  const n = k.quellen;
  const frage = verlassenFrage && n > 0;
  const einrichtungSichtbar = kn.einrichtungOffen || einrichtungAuf;
  const sperrTitel = kn.einrichtungAenderbar ? undefined : TEXT_S10;
  const zugangEntfernbar =
    zugang.herkunft === 'stored' || zugang.herkunft === 'session' || k.maengel.includes('zugang_unlesbar');
  const antwortText = (ort: Ort): string | null => (antwort && antwort.ort === ort ? antwort.text : null);
  const einrichtungAntwort = antwortText('einrichtung');

  const beitreten = (): void => {
    const code = kenncode;
    setKenncode(''); // Spec 9 Punkt 4: nach dem Klick leert der Renderer das Kenncode-Feld
    const name = anzeigename ?? a.anzeigename;
    void fuehreAus('beitreten', 'beitritt', () =>
      window.jmconnect.zoomBeitreten({ nummer, kenncode: code, anzeigename: name }),
    );
  };

  const verlassen = (): void => {
    if (n > 0 && !verlassenFrage) {
      setVerlassenFrage(true); // erster Klick: „Ja, verlassen (n Quellen laufen)“
      return;
    }
    setVerlassenFrage(false);
    void fuehreAus('verlassen', null, () => ohneText(window.jmconnect.zoomVerlassen()));
  };

  // Spec 6.7: ungültig → Feld rot, Text Q13, nichts gesendet.
  const uebernimmVersatz = (): void => {
    if (versatz === null) return;
    const roh = versatz.trim();
    const ms = Number(roh);
    if (roh === '' || !Number.isInteger(ms) || ms < 0 || ms > 1000) {
      setVersatzFehler(TEXT_Q13);
      return;
    }
    void fuehreAus('versatz', null, () => window.jmconnect.zoomVersatz({ ms })).then((r) => {
      if (r.ok) {
        setVersatz(null);
        setVersatzFehler(null);
      } else if (r.text) {
        setVersatzFehler(r.text);
      }
    });
  };

  const laden = (t: ZoomParticipant): void => {
    const trotz = trotzId === t.id;
    void fuehreAus(`laden:${t.id}`, `zeile:${t.id}`, () =>
      window.jmconnect.zoomLaden({ id: t.id, ton: t.tonVorwahl, trotzBetriebsgroesse: trotz }),
    ).then((r) => setTrotzId(!r.ok && r.text.startsWith(Q9_ANFANG) ? t.id : null));
  };

  const zeile = (t: ZoomParticipant): JSX.Element => {
    const q = t.quelle;
    const ort: Ort = `zeile:${t.id}`;
    const text = antwortText(ort);
    return (
      <li key={t.id} className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{t.name}</span>
          {t.rolle === 'host' && <Kennzeichen>Host</Kennzeichen>}
          {t.rolle === 'coHost' && <Kennzeichen>Co-Host</Kennzeichen>}
          {t.kamera === 'aus' && <Kennzeichen>Kamera aus</Kennzeichen>}
          {t.kamera === 'keine' && <Kennzeichen>keine Kamera</Kennzeichen>}
          {t.imWarteraum && <Kennzeichen>im Warteraum</Kennzeichen>}
          {t.doppelname && <Kennzeichen rot>Name doppelt</Kennzeichen>}
          <span className="ml-auto flex items-center gap-2">
            <label title={q ? TEXT_Q14 : undefined} className="flex items-center gap-1 text-xs text-neutral-300">
              <input
                type="checkbox"
                checked={q ? q.ton !== 'aus' : t.tonVorwahl}
                disabled={q !== null || laeuft.has(`ton:${t.id}`)}
                onChange={(e) => {
                  const an = e.target.checked;
                  void fuehreAus(`ton:${t.id}`, ort, () => window.jmconnect.zoomTon({ id: t.id, an }));
                }}
              />
              Ton
            </label>
            {q ? (
              <button
                disabled={laeuft.has(`entladen:${q.aboId}`)}
                onClick={() =>
                  void fuehreAus(`entladen:${q.aboId}`, ort, () => window.jmconnect.zoomEntladen({ aboId: q.aboId }))
                }
                className={RAND}
              >
                Entladen
              </button>
            ) : (
              <MitTooltip titel={t.imWarteraum ? TEXT_Q15 : undefined}>
                <button
                  disabled={t.imWarteraum || !imMeeting || laeuft.has(`laden:${t.id}`)}
                  onClick={() => laden(t)}
                  className={GELB}
                >
                  Als Quelle laden
                </button>
              </MitTooltip>
            )}
          </span>
        </div>
        <div className="mt-1 text-xs text-neutral-400">
          {q ? (
            <>
              {q.ndiName} · Bild {q.bild} ({q.bildGrund}) · Ton {q.ton}
              {q.tonGrund ? ` (${q.tonGrund})` : ''}
            </>
          ) : (
            <span className="text-neutral-500">wird: {t.ndiNameVorschau}</span>
          )}
        </div>
        {t.doppelname && <p className="mt-1 text-xs text-red-300">{TEXT_Q11}</p>}
        {t.kollision && <p className="mt-1 text-xs text-yellow-200">{t.kollision}</p>}
        {q?.fehler && <p className="mt-1 text-xs text-red-300">{q.fehler}</p>}
        {t.fehler && <p className="mt-1 text-xs text-red-300">{t.fehler}</p>}
        {text && <p className="mt-1 text-xs text-red-300">{text}</p>}
      </li>
    );
  };

  const sollZeile = (e: ZoomSollEintrag): JSX.Element => {
    const rot = e.stand === 'doppelname' || (e.stand === 'verwaist' && e.doppelname);
    const ort: Ort = `soll:${e.name}`;
    const text = antwortText(ort);
    const aboId = e.stand === 'verwaist' ? e.aboId : null;
    return (
      <li key={e.name} className="text-xs">
        <div className="flex items-center gap-2">
          <span className={rot ? 'text-red-300' : 'text-neutral-300'}>{sollText(e)}</span>
          {aboId !== null ? (
            <button
              disabled={laeuft.has(`entladen:${aboId}`)}
              onClick={() => void fuehreAus(`entladen:${aboId}`, ort, () => window.jmconnect.zoomEntladen({ aboId }))}
              className={`${RAND} ml-auto`}
            >
              Entladen
            </button>
          ) : (
            <button
              disabled={laeuft.has(`vergessen:${e.name}`)}
              onClick={() =>
                void fuehreAus(`vergessen:${e.name}`, ort, () => ohneText(window.jmconnect.zoomSollVerwerfen({ name: e.name })))
              }
              className={`${RAND} ml-auto`}
            >
              Vergessen
            </button>
          )}
        </div>
        {e.stand === 'verwaist' && e.doppelname && <p className="mt-0.5 text-red-300">{TEXT_Q11}</p>}
        {text && <p className="mt-0.5 text-red-300">{text}</p>}
      </li>
    );
  };

  const m = a.meldung;
  const mk = kn.meldung;

  return (
    <section className={KARTE}>
      {/* 1 · Titel und Statuszeile (Spec 7.2, Kartentext) */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">Zoom-Meeting</h2>
        <p className="text-right text-xs text-neutral-300">{kartenZeile(a, jetzt) ?? ''}</p>
      </div>
      {antwortText('karte') && <p className="mb-3 text-xs text-red-300">{antwortText('karte')}</p>}

      {/* 2 · Meldungsbereich: in jedem Zustand, bis quittiert */}
      {m && mk && (
        <div className={`mb-3 rounded-lg border p-3 ${MELDUNG_FARBE[m.art]}`}>
          <p className="text-sm font-semibold">{m.text}</p>
          {m.detail && <p className="mt-1 font-mono text-[11px] opacity-80">{m.detail}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {mk.erneut && (
              <button
                disabled={laeuft.has('erneut')}
                onClick={() => void fuehreAus('erneut', 'karte', () => window.jmconnect.zoomErneut())}
                className={GELB}
              >
                Erneut beitreten
              </button>
            )}
            {mk.schliessen && (
              <button
                onClick={() => void fuehreAus('schliessen', 'karte', () => ohneText(window.jmconnect.zoomSchliessen()))}
                className={RAND}
              >
                Schließen
              </button>
            )}
            {mk.ok && (
              <button
                onClick={() => void fuehreAus('ok', 'karte', () => ohneText(window.jmconnect.zoomMeldungWeg()))}
                className={RAND}
              >
                OK
              </button>
            )}
            {mk.logordner && (
              <button
                onClick={() => void fuehreAus('logordner', null, () => ohneText(window.jmconnect.zoomLogordner()))}
                className={RAND}
              >
                Logordner öffnen
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3 · Einrichtung: eingeklappt, sobald es keine Mängel gibt */}
      {!kn.einrichtungOffen && (
        <button onClick={() => setEinrichtungAuf((v) => !v)} className={`${RAND} mb-3`}>
          Einrichtung
        </button>
      )}
      {einrichtungSichtbar && (
        <div className="mb-3 space-y-3 rounded-lg border border-neutral-800 p-3">
          {kn.sperrHinweis && <p className="text-xs text-yellow-200">{SPERR_HINWEIS}</p>}
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">{sdkZeile(a)}</span>
              <MitTooltip titel={sperrTitel}>
                <button
                  disabled={!kn.einrichtungAenderbar || laeuft.has('sdk')}
                  onClick={() => void fuehreAus('sdk', 'einrichtung', () => window.jmconnect.zoomSdkWaehlen())}
                  className={RAND}
                >
                  {sdkKnopf(a)}
                </button>
              </MitTooltip>
            </div>
            {sdk.kopie && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-neutral-800">
                <div className="h-full bg-yellow-400" style={{ width: `${prozent(sdk.kopie.bytes, sdk.kopie.bytesGesamt)}%` }} />
              </div>
            )}
            {sdk.text && <p className="mt-1 text-xs text-red-300">{sdk.text}</p>}
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">{zugangText}</span>
              <span className="flex shrink-0 gap-2">
                <MitTooltip titel={sperrTitel}>
                  <button
                    disabled={!kn.einrichtungAenderbar || laeuft.has('zugang')}
                    onClick={() => void fuehreAus('zugang', 'einrichtung', () => window.jmconnect.zoomZugangWaehlen())}
                    className={RAND}
                  >
                    Datei wählen …
                  </button>
                </MitTooltip>
                {zugangEntfernbar && (
                  <MitTooltip titel={sperrTitel}>
                    <button
                      disabled={!kn.einrichtungAenderbar || laeuft.has('zugang')}
                      onClick={() => void fuehreAus('zugang', 'einrichtung', () => window.jmconnect.zoomZugangLoeschen())}
                      className={RAND}
                    >
                      Entfernen
                    </button>
                  </MitTooltip>
                )}
              </span>
            </div>
            {zugang.text && zugang.text !== zugangText && <p className="mt-1 text-xs text-red-300">{zugang.text}</p>}
          </div>
          {einrichtungAntwort && einrichtungAntwort !== sdk.text && einrichtungAntwort !== zugang.text && (
            <p className="text-xs text-red-300">{einrichtungAntwort}</p>
          )}
          {kn.pruefen !== 'aus' && (
            <button
              disabled={kn.pruefen === 'laeuft' || laeuft.has('pruefen')}
              onClick={() => void fuehreAus('pruefen', null, () => window.jmconnect.zoomPruefen())}
              className={RAND}
            >
              {kn.pruefen === 'laeuft' ? 'Prüfe …' : 'Einrichtung prüfen'}
            </button>
          )}
        </div>
      )}

      {/* 4 · Beitritt (bereit, fehler) */}
      {kn.beitrittSichtbar && (
        <form
          className="mb-3 grid gap-2 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!kn.beitretenGesperrt && !laeuft.has('beitreten')) beitreten();
          }}
        >
          <label className="text-xs text-neutral-400">
            Meeting-Nummer
            <input
              value={nummer}
              onChange={(e) => setNummer(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              className={`${INP} mt-1 border-neutral-700`}
            />
          </label>
          <label className="text-xs text-neutral-400">
            Kenncode
            <input
              type="password"
              value={kenncode}
              onChange={(e) => setKenncode(e.target.value)}
              autoComplete="off"
              className={`${INP} mt-1 border-neutral-700`}
            />
          </label>
          <label className="text-xs text-neutral-400">
            Anzeigename in Zoom
            <input
              value={anzeigename ?? a.anzeigename}
              onChange={(e) => setAnzeigename(e.target.value)}
              autoComplete="off"
              className={`${INP} mt-1 border-neutral-700`}
            />
          </label>
          <div className="flex items-center gap-3 sm:col-span-3">
            <button type="submit" disabled={kn.beitretenGesperrt || laeuft.has('beitreten')} className={GELB}>
              Beitreten
            </button>
            {antwortText('beitritt') && <span className="text-xs text-red-300">{antwortText('beitritt')}</span>}
          </div>
        </form>
      )}

      {/* 5 · Laufend (Z3–Z11). Der Z11-Knopf „Abbrechen“ kommt mit Plan 4b. */}
      {kn.verlassen && (
        <div className="mb-3">
          <button disabled={laeuft.has('verlassen')} onClick={verlassen} className={frage ? ROT : RAND}>
            {frage ? (n === 1 ? 'Ja, verlassen (1 Quelle läuft)' : `Ja, verlassen (${n} Quellen laufen)`) : 'Meeting verlassen'}
          </button>
        </div>
      )}

      {/* 7 · Bild-Versatz (Spec 6.7) */}
      <div className="mb-3">
        <label className="block text-xs text-neutral-400">
          Bild-Versatz (ms)
          <input
            type="number"
            min={0}
            max={1000}
            step={1}
            value={versatz ?? String(a.versatz.gewuenschtMs)}
            onChange={(e) => {
              setVersatz(e.target.value);
              setVersatzFehler(null);
            }}
            onBlur={uebernimmVersatz}
            onKeyDown={(e) => {
              if (e.key === 'Enter') uebernimmVersatz();
            }}
            className={`${INP} mt-1 block w-32 ${versatzFehler ? 'border-red-500' : 'border-neutral-700'}`}
          />
        </label>
        <p className="mt-1 text-xs text-neutral-500">
          {a.versatz.bestaetigtMs !== null ? `bestätigt: ${a.versatz.bestaetigtMs} ms` : 'gilt ab dem nächsten Beitritt'}
        </p>
        {versatzFehler && <p className="mt-1 text-xs text-red-300">{versatzFehler}</p>}
      </div>

      {/* 8 · Teilnehmerliste (ohne eigene Zeile; Host und Co-Host zuerst, sortiert der Kern) */}
      {a.teilnehmer.length > 0 && <ul className="mb-3 space-y-2">{a.teilnehmer.map((t) => zeile(t))}</ul>}

      {/* 9 · Gemerkte Quellen (offene Soll-Einträge, Spec 6.3) */}
      {a.soll.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-xs font-semibold text-neutral-400">Gemerkte Quellen</div>
          <ul className="space-y-1">{a.soll.map((e) => sollZeile(e))}</ul>
        </div>
      )}

      {/* 10 · Hinweise (die letzten 5) */}
      {a.hinweise.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-xs font-semibold text-neutral-400">Hinweise</div>
          <ul className="space-y-0.5 text-xs text-neutral-400">
            {a.hinweise.map((h, i) => (
              <li key={`${i}:${h}`}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 11 · Fußzeile */}
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-800 pt-3 text-[11px] text-neutral-500">
        <span>{FUSSZEILE}</span>
        <button
          onClick={() => void fuehreAus('logordner', null, () => ohneText(window.jmconnect.zoomLogordner()))}
          className={`${RAND} shrink-0`}
        >
          Logordner öffnen
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Typecheck (grün).**

Run: `npm run typecheck -w @jm/connect`
Expected: `typecheck:node` und `typecheck:web` ohne Zeile mit `error TS`, Exit-Code 0.

- [ ] **Step 5: Texte wörtlich und verbotene Bausteine prüfen (G9, Spec 9).**

Run (aus der Worktree-Wurzel):
```bash
node -e "const s=require('fs').readFileSync('apps/connect/src/renderer/src/zoom/ZoomCard.tsx','utf8');const t=['Zoom-Meeting','Erneut beitreten','Schließen','OK','Logordner öffnen','Einrichtung','Datei wählen …','Entfernen','Einrichtung prüfen','Prüfe …','Zoom ist gesperrt, bis SDK-Ordner und Zugangsdaten vollständig eingerichtet sind.','Meeting-Nummer','Kenncode','Anzeigename in Zoom','Beitreten','Meeting verlassen','Ja, verlassen (1 Quelle läuft)','Quellen laufen)','Bild-Versatz (ms)','bestätigt: ','gilt ab dem nächsten Beitritt','Host','Co-Host','Kamera aus','keine Kamera','im Warteraum','Name doppelt','wird: ','Ton','Als Quelle laden','Entladen',' — wartet auf die Person',' — Name doppelt, bitte von Hand laden',' — Person weg, Quelle schwarz','Vergessen','Gemerkte Quellen','Hinweise','Zoom-Quellen haben kein Tally, kein Talkback und kein Mix-Minus — das sind Grenzen von Zoom.','Während Zoom läuft oder die Kopie läuft, lassen sich SDK-Ordner und Zugangsdaten nicht ändern.','Name doppelt im Meeting — nach einem Wiederbeitritt kann Connect diese Quelle nicht von selbst zuordnen.','Bild-Versatz: erlaubt sind ganze Zahlen von 0 bis 1000 ms.','Zum Umschalten erst entladen.','Erst im Zoom-Client zulassen.','Mehr als 5 Zoom-Quellen sind nicht gemessen.'];const f=t.filter((x)=>!s.includes(x));console.log(f.length?'FEHLT: '+f.join(' | '):'alle '+t.length+' Texte da');process.exit(f.length?1:0)"
grep -nE "from '.*klartext|<PttButton|<GuestActions|<PhaseBadge" apps/connect/src/renderer/src/zoom/ZoomCard.tsx
```
Expected: `alle 44 Texte da` (Exit-Code 0); `grep` findet nichts (Exit-Code 1).

- [ ] **Step 6: Bau.**

Run:
```bash
npm run build -w @jm/connect
grep -cF "Als Quelle laden" apps/connect/out/renderer/assets/index-*.js
```
Expected: dreimal `✓ built in …`, keine Zeile mit `error`; danach `1` (der Platzhalter `index-*.js` trifft genau eine Datei, darum gibt `grep -c` keinen Dateinamen aus).

- [ ] **Step 7: Selbsttest (grün).**

Run: `npm run selftest -w @jm/connect`
Expected: die vier Testdateien enden der Reihe nach mit `487 ok, 0 fehlgeschlagen.` (`zoom-text`), `79 ok, 0 fehlgeschlagen.` (`zoom-laufzeit`), `78 ok, 0 fehlgeschlagen.` (`zoom-teile`) und `252 ok, 0 fehlgeschlagen, 0 übersprungen.` (`zoom-kern`; unter Linux `249 ok, 0 fehlgeschlagen, 1 übersprungen.`), keine Zeile, die mit `FAIL` beginnt, Exit-Code 0.

- [ ] **Step 8: Commit.**

```bash
git add apps/connect/src/renderer/src/zoom/ZoomCard.tsx apps/connect/src/renderer/src/App.tsx
git status --short
```
Erwartet genau diese gestagten Zeilen (sonst nichts Gestagtes):
```
M  apps/connect/src/renderer/src/App.tsx
A  apps/connect/src/renderer/src/zoom/ZoomCard.tsx
```
Dann:
```bash
git commit -m "feat(connect): Zoom-Karte - Einrichtung, Beitritt, Teilnehmer, gemerkte Quellen" -m "Eigene Datei ZoomCard.tsx außerhalb des Raum-Zweigs, nur unter Windows (Spec 9 Punkte 1-11 ohne den Z11-Knopf Abbrechen). Statuszeile und Knopflogik aus shared/zoom-text, Fehlertexte aus dem Main; Kenncode-Feld wird nach Beitreten geleert, Q9 wird zum zweiten Klick, Versatz ungültig: Feld rot mit Q13, nichts gesendet. Tooltips S10, Q14, Q15 wörtlich aus Spec 8 (#197)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Nicht pushen.

**Sichtprüfung:** im Owner-Kurztest, Abnahme 1–8, 10, 19 (Aufgabe 20).

**Abweichungen vom Gerüst:**
1. **Q11 als Literal** zusätzlich zu S10/Q13/Q14/Q15: Spec 6.3 verlangt Q11 an beiden Doppelnamen-Zeilen und Spec 9 Punkt 9 an verwaisten Einträgen mit Doppelname; einen Q11-Text liefert das Abbild nicht (`doppelname` ist ein Merker).
2. **Q9 erkennt die Karte am Textanfang** (`Mehr als 5 Zoom-Quellen sind nicht gemessen.`), weil `ZoomErgebnis` keinen Fehlerschlüssel trägt. Der Anfang ist wörtlich Spec 8.4; ändert jemand Q9 in `klartext.ts`, zeigt die Karte den Text weiter an, der zweite Klick lädt dann aber nicht „trotzdem“.
3. **Teilnehmerliste erscheint, sobald `abbild.teilnehmer` nicht leer ist** (der Kern füllt sie nur im Meeting). In `warteraum` ist sie leer und wird ohne eigenen Hinweistext weggelassen (L19).
4. **„Einrichtung prüfen“ wird außerhalb von `bereit` ausgeblendet** (`pruefen === 'aus'`), Spec 9 Punkt 3 sagt „nur in bereit ohne laufende Prüfung“. „Entfernen“ erscheint nur, wenn es etwas zu entfernen gibt (Herkunft `stored`/`session` oder Mangel `zugang_unlesbar`); bei Herkunft `env` gibt es nichts Gespeichertes.
5. **Bild-/Ton-Zustand der Quelle** erscheint als Rohwerte der Bridge (etwa `Bild live (frames) · Ton live (packets)`), weil Spec 9 Punkt 8 dafür keinen Klartext vorgibt.
6. **Zeilenangaben:** Einhängestelle nach dem Raum-Zweig (`App.tsx:357-361` im Ausgangsstand, Spec „nach Zeile 359“); maßgeblich ist der Vorher-Ausschnitt.

---

### Task 19: Paketierung: `bundle-zoom-bridge.mjs`, `after-pack.cjs`, beide Wächter

**Spec:** `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md` Abschnitte 10.1 (was in den Installer kommt), 10.2 (`tools/bundle-zoom-bridge.mjs`, `package.json`, `.gitignore`), 10.3 (Wächter 2, Code wörtlich), 5.1 letzter Absatz (`devDependencies`, `files`-Ausschluss), Ergänzung 0.18, 3.1-12 und 3.1-13.

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\suite-sofort-fixes` (Branch `feat/zoom-stage4-connect`). Alle Pfade unten relativ dazu.

**Files:**
- Create: `apps/connect/tools/bundle-zoom-bridge.mjs`
- Create: `apps/connect/tools/after-pack.cjs`
- Create: `apps/connect/test/after-pack.test.mjs`
- Modify: `apps/connect/electron-builder.yml`
  - Zeilen 10–20 (`files`, `extraResources`, `asar`): Ausschluss `"!**/node_modules/@jm/zoom-bridge/**"`, danach `afterPack: tools/after-pack.cjs`
- Modify: `apps/connect/package.json`
  - Skript `prepackage` (Stand vor Aufgabe 5: Zeile 18) und `dist:dir` (Stand vor Aufgabe 5: Zeile 20)
  - Skript `selftest` (angelegt in Aufgabe 5, erweitert in 7, 9, 10): `&& node test/after-pack.test.mjs` angehängt
- Modify: `apps/connect/.gitignore` — Zeile 6 (`resources/bin/`): darunter `resources/zoom-bridge/`

Zeilenangaben gelten für den Stand vor Aufgabe 5 (Branch-Spitze `5cab469dc6`); `package.json` hat sich seither durch Aufgabe 5 verschoben. Maßgeblich ist immer der wortgleiche Vorher-Text.

Kein Test dieser Aufgabe lädt Electron oder braucht das SDK (G10). Der Wächter-Code steht einmal in `packages/zoom-bridge/scripts/auslieferung.mjs` (Aufgabe 4); `bundle-zoom-bridge.mjs` importiert ihn relativ (`../../../packages/zoom-bridge/scripts/auslieferung.mjs`), `after-pack.cjs` lädt ihn per dynamischem `import()`. electron-builder 24.13.3 lädt einen Haken mit Endung `.cjs` per `require()` und nimmt `module.exports.default`, wenn kein Export `afterPack` existiert (`node_modules/app-builder-lib/out/platformPackager.js:590-627`); ein Pfad ohne führenden Punkt wird gegen das Arbeitsverzeichnis aufgelöst — bei `npm run … -w @jm/connect` ist das `apps/connect`.

**Interfaces:**
- Consumes: Aufgabe 4 — aus `packages/zoom-bridge/scripts/auslieferung.mjs`: `VC_PFLICHT`, `bridgeExeFrisch(pkgDir)`, `findeVcLaufzeit(pkgDir)`, `linkerFassung(datei)`, `mindestens(a, b)`, `verboteneZoomDateien(ordner, { sdkBin })`, `verboteneAsarEintraege(ordner, { sdkBin })`. Aufgabe 5 — `apps/connect/package.json` mit `devDependencies` `@jm/zoom-bridge`, `tsx`; Aufgaben 5, 7, 9, 10 — Skript `selftest` = `tsx test/zoom-text.test.ts && tsx test/zoom-laufzeit.test.ts && tsx test/zoom-teile.test.ts && tsx test/zoom-kern.test.ts`.
- Produces:
  ```js
  // apps/connect/tools/after-pack.cjs (CommonJS)
  exports.default = async function afterPack(context /* { appOutDir: string; electronPlatformName: string } */) /* : Promise<void> */;
  //   wirft new Error(`Zoom-SDK-Dateien im Installer:\n  ${treffer.join('\n  ')}`) bei Treffern in Ordner ODER .asar,
  //   wirft new Error('zoom-bridge.exe fehlt im Installer (prepackage gelaufen?).') unter win32 ohne resources/zoom-bridge/zoom-bridge.exe
  // apps/connect/tools/bundle-zoom-bridge.mjs (ESM, Skript): Rückgabe 0 = gestaged und Wächter 1 sauber
  //   bzw. außerhalb Windows '[bundle-zoom-bridge] Nicht-Windows — übersprungen.'; Rückgabe 1 = Abbruch mit Klartext
  // apps/connect/resources/zoom-bridge/ = zoom-bridge.exe + alle *.dll der VC-Laufzeit (gitignored)
  // apps/connect/package.json (Endstand 4a):
  //   "prepackage": "node tools/bundle-ndi.mjs && node tools/bundle-zoom-bridge.mjs"
  //   "dist:dir":   "electron-vite build && npm run prepackage && electron-builder --dir"
  //   "selftest":   "tsx test/zoom-text.test.ts && tsx test/zoom-laufzeit.test.ts && tsx test/zoom-teile.test.ts && tsx test/zoom-kern.test.ts && node test/after-pack.test.mjs"
  ```

**Regeln für diese Aufgabe:** Global Constraints G2 (Bridge-Dateien nur unter `resources\zoom-bridge\`, nie unter `resources\bin\win`), G6, G7, G10, G11 (keine Versionsnummer anfassen), G13, G14, G15. Keine EXE von anderswo in `packages/zoom-bridge/build/Release/` kopieren — das hebelte die Frische-Prüfung aus.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`apps/connect/test/after-pack.test.mjs`, neue Datei)

```js
// Selbsttest fuer tools/after-pack.cjs - Waechter 2 (Spec Stage 4, 10.3): keine
// Zoom-SDK-Datei im fertigen win-unpacked, auch nicht IN der app.asar, und unter
// Windows liegt resources/zoom-bridge/zoom-bridge.exe dabei. Ohne electron-builder:
// der Haken bekommt ein nachgebautes context-Objekt mit einem Temp-Ordner.
//   node apps/connect/test/after-pack.test.mjs
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const afterPack = require('../tools/after-pack.cjs').default;

// Das Ergebnis darf nicht davon abhaengen, ob auf diesem PC ein SDK liegt:
// ohne ZOOM_SDK_DIR gilt die feste Namensliste fuer 7.1.5.43953.
delete process.env.ZOOM_SDK_DIR;

let failures = 0;
function assert(cond, name) {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}`);
  }
}

/** Legt eine Datei samt Ordnern an. */
function datei(pfad, inhalt = '') {
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, inhalt);
}
/** .asar wie von electron-builder: 16-Byte-Kopf (4, Laenge+8, Laenge+4, Laenge), dann { files: baum }. */
function baueAsar(pfad, baum) {
  const json = Buffer.from(JSON.stringify({ files: baum }), 'utf8');
  const kopf = Buffer.alloc(16);
  kopf.writeUInt32LE(4, 0);
  kopf.writeUInt32LE(json.length + 8, 4);
  kopf.writeUInt32LE(json.length + 4, 8);
  kopf.writeUInt32LE(json.length, 12);
  datei(pfad, Buffer.concat([kopf, json]));
}
const leer = { size: 0, offset: '0' };
const sauberesAsar = { out: { files: { main: { files: { 'index.cjs': leer } } } }, 'package.json': leer };

/** Ein frisches appOutDir mit einer sauberen resources/app.asar. */
function appOutDir() {
  const d = mkdtempSync(join(tmpdir(), 'jm-after-pack-'));
  baueAsar(join(d, 'resources', 'app.asar'), sauberesAsar);
  return d;
}
/** 'ok', wenn der Haken durchlaeuft, sonst die Meldung seines Fehlers. */
async function ergebnis(context) {
  try {
    await afterPack(context);
    return 'ok';
  } catch (e) {
    return e.message;
  }
}

const ordner = [];
try {
  console.log('after-pack — Waechter 2:');
  {
    const d = appOutDir();
    ordner.push(d);
    baueAsar(join(d, 'resources', 'app.asar'), {
      ...sauberesAsar,
      node_modules: { files: { '@jm': { files: { 'zoom-bridge': { files: { 'package.json': leer } } } } } },
    });
    const r = await ergebnis({ appOutDir: d, electronPlatformName: 'linux' });
    assert(r.startsWith('Zoom-SDK-Dateien im Installer:'), 'Bridge-Paketordner IN der app.asar: der Haken wirft "Zoom-SDK-Dateien im Installer"');
    assert(r.includes('node_modules/@jm/zoom-bridge/package.json'), '... und nennt den Eintrag');
  }
  {
    const d = appOutDir();
    ordner.push(d);
    datei(join(d, 'resources', 'app.asar.unpacked', 'x', 'sdk.dll'));
    const r = await ergebnis({ appOutDir: d, electronPlatformName: 'linux' });
    assert(r.startsWith('Zoom-SDK-Dateien im Installer:') && r.includes('sdk.dll'), 'sdk.dll in app.asar.unpacked: der Haken wirft und nennt die Datei');
  }
  {
    const d = appOutDir();
    ordner.push(d);
    assert((await ergebnis({ appOutDir: d, electronPlatformName: 'linux' })) === 'ok', 'sauber, nicht Windows: der Haken laeuft durch');
    assert(
      (await ergebnis({ appOutDir: d, electronPlatformName: 'win32' })) === 'zoom-bridge.exe fehlt im Installer (prepackage gelaufen?).',
      'sauber, Windows, ohne resources/zoom-bridge/zoom-bridge.exe: der Haken wirft',
    );
    datei(join(d, 'resources', 'zoom-bridge', 'zoom-bridge.exe'), 'MZ');
    datei(join(d, 'resources', 'zoom-bridge', 'msvcp140.dll'), 'MZ');
    assert((await ergebnis({ appOutDir: d, electronPlatformName: 'win32' })) === 'ok', 'sauber, Windows, mit EXE und VC-Laufzeit: der Haken laeuft durch');
  }

  console.log('\nbundle-zoom-bridge — ohne Windows:');
  if (process.platform !== 'win32') {
    const r = spawnSync(process.execPath, [join(hier, '..', 'tools', 'bundle-zoom-bridge.mjs')], { encoding: 'utf8' });
    assert(r.status === 0 && r.stdout.includes('[bundle-zoom-bridge] Nicht-Windows — übersprungen.'), 'ausserhalb von Windows: Meldung "übersprungen", Rueckgabe 0');
  } else {
    console.log('  --  ausserhalb von Windows: Meldung "übersprungen", Rueckgabe 0 (übersprungen: nur ohne Windows)');
  }
} finally {
  for (const d of ordner) rmSync(d, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAlle after-pack-Tests bestanden.' : `\n${failures} after-pack-Test(s) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
node apps/connect/test/after-pack.test.mjs
```
Erwartet: Abbruch vor dem ersten Test, Exitcode 1:
```
Error: Cannot find module '../tools/after-pack.cjs'
Require stack:
- …\apps\connect\test\after-pack.test.mjs
```

- [ ] **Step 3: Wächter 2 anlegen** (`apps/connect/tools/after-pack.cjs`, neue Datei — der Code ab `const { existsSync }` ist wörtlich Spec 10.3)

```js
// Waechter 2 (Spec Stage 4, 10.3): electron-builder ruft diesen Haken, nachdem
// release\win-unpacked steht und BEVOR der NSIS-Installer entsteht. Er bricht den
// Bau ab, wenn eine Datei aus <Zoom-SDK>\x64\bin im fertigen Ordner liegt - auch
// in app.asar.unpacked und als Eintrag IN jeder .asar - und unter Windows, wenn
// resources\zoom-bridge\zoom-bridge.exe fehlt. Derselbe Waechter-Code wie im
// Einsatzpaket (packages/zoom-bridge/scripts/auslieferung.mjs), keine zweite Liste.
// CommonJS, weil electron-builder Haken mit der Endung .cjs per require() laedt.
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
exports.default = async function afterPack(context) {
  const modul = join(__dirname, '..', '..', '..', 'packages', 'zoom-bridge', 'scripts', 'auslieferung.mjs');
  const { verboteneZoomDateien, verboteneAsarEintraege } = await import(pathToFileURL(modul).href);
  const sdkBin = process.env.ZOOM_SDK_DIR && join(process.env.ZOOM_SDK_DIR, 'x64', 'bin');
  const treffer = [
    ...verboteneZoomDateien(context.appOutDir, { sdkBin }),   // Dateien im Ordner, auch app.asar.unpacked
    ...verboteneAsarEintraege(context.appOutDir, { sdkBin }), // Einträge IN jeder .asar darunter
  ];
  if (treffer.length) throw new Error(`Zoom-SDK-Dateien im Installer:\n  ${treffer.join('\n  ')}`);
  if (context.electronPlatformName === 'win32' && !existsSync(join(context.appOutDir, 'resources', 'zoom-bridge', 'zoom-bridge.exe'))) {
    throw new Error('zoom-bridge.exe fehlt im Installer (prepackage gelaufen?).');
  }
};
```

- [ ] **Step 4: Test laufen lassen (grün)**

```
node apps/connect/test/after-pack.test.mjs
```
Erwartet unter Windows (Exitcode 0, keine Zeile `FAIL`):
```
after-pack — Waechter 2:
  ok  Bridge-Paketordner IN der app.asar: der Haken wirft "Zoom-SDK-Dateien im Installer"
  ok  ... und nennt den Eintrag
  ok  sdk.dll in app.asar.unpacked: der Haken wirft und nennt die Datei
  ok  sauber, nicht Windows: der Haken laeuft durch
  ok  sauber, Windows, ohne resources/zoom-bridge/zoom-bridge.exe: der Haken wirft
  ok  sauber, Windows, mit EXE und VC-Laufzeit: der Haken laeuft durch

bundle-zoom-bridge — ohne Windows:
  --  ausserhalb von Windows: Meldung "übersprungen", Rueckgabe 0 (übersprungen: nur ohne Windows)

Alle after-pack-Tests bestanden.
```
(Außerhalb Windows läuft statt der `--`-Zeile die Prüfung wirklich: bis Step 6 ist sie `FAIL` — das Skript gibt es noch nicht —, ab Step 6 steht dort `  ok  ausserhalb von Windows: Meldung "übersprungen", Rueckgabe 0`.)

- [ ] **Step 5: Gestagte Bridge-Dateien nicht ins Repo** (`apps/connect/.gitignore`, Zeilen 5–6)

Vorher:
```
# Die Wurzel-.gitignore deckt node_modules/out/release bereits ab.
resources/bin/
```
Nachher:
```
# Die Wurzel-.gitignore deckt node_modules/out/release bereits ab.
resources/bin/
# Von tools/bundle-zoom-bridge.mjs vor dem Packen gestaged (Spec Stage 4, 10.2):
# zoom-bridge.exe und die Visual-C++-Laufzeit. Gebaut bzw. aus Visual Studio kopiert.
resources/zoom-bridge/
```

- [ ] **Step 6: Bridge und VC-Laufzeit stagen, Wächter 1** (`apps/connect/tools/bundle-zoom-bridge.mjs`, neue Datei)

```js
// Staged beim `prepackage` (nach bundle-ndi, vor electron-builder) die Zoom-Bridge
// fuer JM Connect nach resources/zoom-bridge/ (Spec Stage 4, 10.1 und 10.2):
//   1. zoom-bridge.exe aus packages/zoom-bridge/build/Release - frisch gebaut
//   2. die Visual-C++-Laufzeit (alle *.dll aus Microsoft.VC14x.CRT), app-lokal
// KEINE Datei aus <Zoom-SDK>\x64\bin: die waehlt der Bediener einmal je PC (E2).
// Waechter 1 prueft das unten am ganzen resources-Ordner; Waechter 2
// (tools/after-pack.cjs) prueft es noch einmal am fertigen win-unpacked samt app.asar.
//
// Eigener Unterordner, NICHT resources/bin/win: dort setzt @jm/ndi den Ordner vorn
// auf PATH der Gast-Sender (packages/ndi/index.js:30-53) - eine fremde VC-Laufzeit
// dort wuerde in deren Prozesse geladen (Spec 10.1).
//
// resources/zoom-bridge/ ist gitignored und wird bei jedem Lauf frisch gefuellt.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VC_PFLICHT,
  bridgeExeFrisch,
  findeVcLaufzeit,
  linkerFassung,
  mindestens,
  verboteneZoomDateien,
} from '../../../packages/zoom-bridge/scripts/auslieferung.mjs';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(appRoot, '..', '..');
const pkgDir = join(repoRoot, 'packages', 'zoom-bridge');

if (process.platform !== 'win32') {
  console.log('[bundle-zoom-bridge] Nicht-Windows — übersprungen.');
  process.exit(0);
}

function abbruch(msg) {
  console.error(`\n[bundle-zoom-bridge] ABBRUCH: ${msg}`);
  process.exit(1);
}

// 2. Die EXE muss aus dem aktuellen Stand gebaut sein (Texte wie im Einsatzpaket).
const frisch = bridgeExeFrisch(pkgDir);
if (!frisch.ok) abbruch(frisch.text);

// 3. VC-Laufzeit: mindestens die Fassung des Linkers, der die EXE gebaut hat
//    (die STL ist nur rueckwaerts kompatibel).
let linker;
try {
  linker = linkerFassung(frisch.exe);
} catch (e) {
  abbruch(e.message);
}
const vc = findeVcLaufzeit(pkgDir);
const vcLaufzeit = vc.brauchbar[0];
if (!vcLaufzeit) {
  abbruch(
    `Visual-C++-Laufzeit (Microsoft.VC14x.CRT mit ${VC_PFLICHT.join(', ')}) nicht gefunden.\n` +
      `  Gesucht in:\n  ${vc.kandidaten.join('\n  ') || '(keine Visual-Studio-Installation gefunden)'}\n` +
      '  Mit VC_CRT_DIR auf den Ordner ...\\VC\\Redist\\MSVC\\<Fassung>\\x64\\Microsoft.VC14x.CRT zeigen.',
  );
}
if (!mindestens(vcLaufzeit.fassung, linker)) {
  abbruch(
    `Die Visual-C++-Laufzeit ${vcLaufzeit.fassung.join('.')} (${vcLaufzeit.dir}) ist AELTER als der Linker ${linker.join('.')}, ` +
      'der zoom-bridge.exe gebaut hat - die Bridge koennte damit abstuerzen. Die Redist-Dateien desselben Toolsets nehmen (VC_CRT_DIR).',
  );
}

// 4. resources/zoom-bridge/ leeren und fuellen.
const resources = join(appRoot, 'resources');
const ziel = join(resources, 'zoom-bridge');
rmSync(ziel, { recursive: true, force: true });
mkdirSync(ziel, { recursive: true });
copyFileSync(frisch.exe, join(ziel, 'zoom-bridge.exe'));
const vcDateien = readdirSync(vcLaufzeit.dir).filter((f) => /\.dll$/i.test(f));
for (const f of vcDateien) copyFileSync(join(vcLaufzeit.dir, f), join(ziel, f));
console.log(`bundled zoom-bridge.exe → ${join(ziel, 'zoom-bridge.exe')}`);
console.log(
  `bundled VC-Laufzeit ${vcLaufzeit.fassung.join('.')} (Linker der Bridge: ${linker.join('.')}) aus ${vcLaufzeit.dir}: ${vcDateien.join(', ')}`,
);

// 5. Waechter 1: keine Zoom-SDK-Datei irgendwo unter resources/. Mit ZOOM_SDK_DIR
//    gegen die echte Liste, sonst gegen die feste fuer 7.1.5.43953.
const sdkBin = process.env.ZOOM_SDK_DIR ? join(process.env.ZOOM_SDK_DIR, 'x64', 'bin') : null;
const treffer = verboteneZoomDateien(resources, { sdkBin });
if (treffer.length > 0) abbruch(`Zoom-SDK-Dateien in ${resources}:\n  ${treffer.join('\n  ')}`);
console.log(
  `[bundle-zoom-bridge] Waechter 1: keine Zoom-SDK-Datei unter ${resources} ` +
    `(geprueft gegen ${sdkBin && existsSync(sdkBin) ? `das SDK unter ${sdkBin}` : 'die feste Liste fuer 7.1.5.43953'}).`,
);
```
Die Abbruchtexte zur VC-Laufzeit sind wörtlich die aus `packages/zoom-bridge/scripts/build-release.mjs` (dort Zeilen 257–269 vor Aufgabe 4).

- [ ] **Step 7: Kurzprüfung des Skripts**

```
node apps/connect/tools/bundle-zoom-bridge.mjs; echo "Rueckgabe $?"
```
Erwartet, solange `packages/zoom-bridge/build/Release/zoom-bridge.exe` im Worktree fehlt (Windows):
```
[bundle-zoom-bridge] ABBRUCH: C:\Users\alexk\alexzvn\.claude\worktrees\suite-sofort-fixes\packages\zoom-bridge\build\Release\zoom-bridge.exe fehlt - erst ZOOM_SDK_DIR und NDI_SDK_DIR setzen und `npm run rebuild -w @jm/zoom-bridge`.
Rueckgabe 1
```
Liegt die EXE schon frisch da, kommen stattdessen die drei Zeilen `bundled zoom-bridge.exe → …`, `bundled VC-Laufzeit … (Linker der Bridge: …) aus …: …`, `[bundle-zoom-bridge] Waechter 1: keine Zoom-SDK-Datei unter … (geprueft gegen …).` und `Rueckgabe 0`; `git status --short` zeigt `apps/connect/resources/zoom-bridge/` dann **nicht** (Step 5). Außerhalb Windows: `[bundle-zoom-bridge] Nicht-Windows — übersprungen.`, `Rueckgabe 0`. (Vorab an einer Kopie gemessen, Windows: alle drei Wege wie beschrieben; mit einer Datei `resources/bin/win/sdk.dll` bricht Wächter 1 mit `Zoom-SDK-Dateien in …\resources:` und `bin\win\sdk.dll` ab.)

- [ ] **Step 8: electron-builder: Ausschluss und Haken** (`apps/connect/electron-builder.yml`, Zeilen 10–20)

Vorher:
```yaml
files:
  - out/**/*
  - package.json

extraResources:
  - from: resources
    to: .
    filter:
      - "**/*"

asar: true
```
Nachher:
```yaml
files:
  - out/**/*
  - package.json
  # Zweite Absicherung (Spec Stage 4, 5.1 und Ergänzung 0.18): @jm/zoom-bridge steht nur
  # in den devDependencies und wird gebündelt - sein Paketordner (build/, release/ mit dem
  # KOMPLETT-ZIP) gehört nie in die app.asar.
  - "!**/node_modules/@jm/zoom-bridge/**"

extraResources:
  - from: resources
    to: .
    filter:
      - "**/*"

asar: true

# Wächter 2 (Spec Stage 4, 10.3): läuft, wenn release/win-unpacked steht, und vor dem
# NSIS-Installer. Bricht ab bei einer Zoom-SDK-Datei im Ordner oder IN der app.asar und
# unter Windows, wenn resources/zoom-bridge/zoom-bridge.exe fehlt.
afterPack: tools/after-pack.cjs
```
Lesbarkeit prüfen (js-yaml liegt als Abhängigkeit von electron-builder im Wurzel-`node_modules`):
```
node -e "const c = require('js-yaml').load(require('node:fs').readFileSync('apps/connect/electron-builder.yml', 'utf8')); console.log(JSON.stringify({ files: c.files, afterPack: c.afterPack, asar: c.asar }));"
```
Erwartet:
```
{"files":["out/**/*","package.json","!**/node_modules/@jm/zoom-bridge/**"],"afterPack":"tools/after-pack.cjs","asar":true}
```

- [ ] **Step 9: Skripte in `apps/connect/package.json`**

Ersetzung 1, Vorher:
```json
    "prepackage": "node tools/bundle-ndi.mjs",
```
Nachher:
```json
    "prepackage": "node tools/bundle-ndi.mjs && node tools/bundle-zoom-bridge.mjs",
```

Ersetzung 2 (behebt Spec 3.1-13: `dist:dir` rief kein `prepackage`), Vorher:
```json
    "dist:dir": "electron-vite build && electron-builder --dir",
```
Nachher:
```json
    "dist:dir": "electron-vite build && npm run prepackage && electron-builder --dir",
```

Ersetzung 3 (Skript `selftest` aus Aufgabe 5/7/9/10 — nur der Wert, ohne ein eventuell folgendes Komma), Vorher:
```json
"selftest": "tsx test/zoom-text.test.ts && tsx test/zoom-laufzeit.test.ts && tsx test/zoom-teile.test.ts && tsx test/zoom-kern.test.ts"
```
Nachher:
```json
"selftest": "tsx test/zoom-text.test.ts && tsx test/zoom-laufzeit.test.ts && tsx test/zoom-teile.test.ts && tsx test/zoom-kern.test.ts && node test/after-pack.test.mjs"
```
Danach prüfen, dass die Datei gültiges JSON ist und die drei Werte stimmen:
```
node -e "const s = require('./apps/connect/package.json').scripts; console.log(s.prepackage); console.log(s['dist:dir']); console.log(s.selftest);"
```
Erwartet:
```
node tools/bundle-ndi.mjs && node tools/bundle-zoom-bridge.mjs
electron-vite build && npm run prepackage && electron-builder --dir
tsx test/zoom-text.test.ts && tsx test/zoom-laufzeit.test.ts && tsx test/zoom-teile.test.ts && tsx test/zoom-kern.test.ts && node test/after-pack.test.mjs
```

- [ ] **Step 10: Selbsttest und Typecheck von Connect (grün)**

```
npm run selftest -w @jm/connect
npm run typecheck -w @jm/connect
```
Erwartet: Selbsttest Exitcode 0; die vier `tsx`-Dateien enden der Reihe nach mit `487 ok, 0 fehlgeschlagen.`, `79 ok, 0 fehlgeschlagen.`, `78 ok, 0 fehlgeschlagen.` und `252 ok, 0 fehlgeschlagen, 0 übersprungen.` (unter Linux `249 ok, 0 fehlgeschlagen, 1 übersprungen.`), danach die Ausgabe aus Step 4 bis `Alle after-pack-Tests bestanden.`. Typecheck: keine Ausgabe von `tsc` (node und web), Exitcode 0 — diese Aufgabe ändert keine `.ts`-Datei, `tools/*` und `test/*.mjs` liegen außerhalb der tsconfig-`include`.

- [ ] **Step 11: Commit** (Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add apps/connect/tools/bundle-zoom-bridge.mjs apps/connect/tools/after-pack.cjs apps/connect/test/after-pack.test.mjs apps/connect/electron-builder.yml apps/connect/package.json apps/connect/.gitignore
git status --short
```
Erwartet genau diese gestagten Zeilen und **keine** Zeile mit `apps/connect/resources/zoom-bridge`:
```
M  apps/connect/.gitignore
M  apps/connect/electron-builder.yml
M  apps/connect/package.json
A  apps/connect/test/after-pack.test.mjs
A  apps/connect/tools/after-pack.cjs
A  apps/connect/tools/bundle-zoom-bridge.mjs
```
Dann:
```
git commit -m "feat(connect): Zoom-Bridge paketieren - bundle-zoom-bridge.mjs und after-pack.cjs, beide Waechter (Stage 4)" -m "prepackage staged zoom-bridge.exe (frisch gebaut) und die VC-Laufzeit nach resources/zoom-bridge/ und prueft resources mit Waechter 1. electron-builder ruft tools/after-pack.cjs (Waechter 2): keine Zoom-SDK-Datei in win-unpacked, auch nicht in app.asar.unpacked oder als Eintrag IN der app.asar, kein node_modules/@jm/zoom-bridge, kein ZIP; unter Windows muss zoom-bridge.exe dabei sein. files schliesst den Bridge-Paketordner aus, dist:dir ruft jetzt prepackage. Test: test/after-pack.test.mjs im selftest." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

#### Bau auf dem Windows-Entwicklungs-PC — nach dem Commit, ohne neuen Commit

Ergebnis jedes Schritts kommt in den Bericht der Aufgabe. Fehlt das SDK, endet die Aufgabe hier mit dem Vermerk „Bau nicht geprüft: ZOOM_SDK_DIR fehlt“ und einer Rückfrage an den Owner nach dem SDK-Ordner aus der internen JM-Ablage (Gerüst-Lücke L14); keine EXE aus einem anderen Checkout kopieren.

- [ ] **Step 12: Voraussetzungen und Bridge bauen**

```
echo "ZOOM_SDK_DIR=$ZOOM_SDK_DIR"; echo "NDI_SDK_DIR=$NDI_SDK_DIR"
test -f "$ZOOM_SDK_DIR/x64/bin/sdk.dll" && test -f "$NDI_SDK_DIR/Bin/x64/Processing.NDI.Lib.x64.dll" && echo "Voraussetzungen da"
npm run rebuild -w @jm/zoom-bridge
npm run rebuild:native -w @jm/connect
```
Erwartet: `Voraussetzungen da`; der CMake-Bau endet ohne Fehler, danach existiert `packages/zoom-bridge/build/Release/zoom-bridge.exe` (gitignored über `packages/zoom-bridge/.gitignore`); `electron-rebuild` meldet `Rebuild Complete`.

- [ ] **Step 13: Installer-Ordner bauen**

```
npm run dist:dir -w @jm/connect
```
Erwartet: `electron-vite build` ohne Fehler; `bundled jm_ndi.node → …`, `bundled Processing.NDI.Lib.x64.dll → …` (bundle-ndi); `bundled zoom-bridge.exe → …\apps\connect\resources\zoom-bridge\zoom-bridge.exe`, `bundled VC-Laufzeit … (Linker der Bridge: …) aus …`, `[bundle-zoom-bridge] Waechter 1: keine Zoom-SDK-Datei unter …\apps\connect\resources (geprueft gegen das SDK unter …\x64\bin).`; electron-builder `packaging platform=win32 arch=x64 …` und **keine** Zeile mit `⨯` (ein Treffer von Wächter 2 erschiene dort als `Zoom-SDK-Dateien im Installer:`); Exitcode 0.

- [ ] **Step 14: Ergebnis prüfen (L14)**

```
test -f apps/connect/release/win-unpacked/resources/zoom-bridge/zoom-bridge.exe && echo "zoom-bridge.exe im Installer"
ls apps/connect/release/win-unpacked/resources/bin/win
node --input-type=module -e "import { asarEintraege } from './packages/zoom-bridge/scripts/auslieferung.mjs'; const e = asarEintraege('apps/connect/release/win-unpacked/resources/app.asar'); console.log('Eintraege', e.length, 'zoom-bridge', e.filter((x) => x.includes('node_modules/@jm/zoom-bridge/')).length, 'zip', e.filter((x) => /\.zip$/i.test(x)).length);"
grep -c "Bridge laeuft bereits" apps/connect/out/main/index.cjs
node -e "require('./apps/connect/tools/after-pack.cjs').default({ appOutDir: 'apps/connect/release/win-unpacked', electronPlatformName: 'win32' }).then(() => console.log('Waechter 2: sauber'), (e) => { console.error(e.message); process.exit(1); })"
```
Erwartet: `zoom-bridge.exe im Installer`; in `resources/bin/win` nur `Processing.NDI.Lib.x64.dll` und `jm_ndi.node` (keine VC-Laufzeit dort, G2); `Eintraege <n> zoom-bridge 0 zip 0`; `grep -c` ≥ 1 (der Bridge-Code ist in `out/main/index.cjs` gebündelt, nicht als Paketordner kopiert — Ergänzung 0.18); `Waechter 2: sauber`.

- [ ] **Step 15: Gegenprobe Wächter 1**

```
touch apps/connect/resources/bin/win/sdk.dll
node apps/connect/tools/bundle-zoom-bridge.mjs; echo "Rueckgabe $?"
rm apps/connect/resources/bin/win/sdk.dll
```
Erwartet: nach den beiden `bundled …`-Zeilen
```
[bundle-zoom-bridge] ABBRUCH: Zoom-SDK-Dateien in …\apps\connect\resources:
  bin\win\sdk.dll
Rueckgabe 1
```
Danach ist die Datei wieder weg (`ls apps/connect/resources/bin/win` zeigt nur `jm_ndi.node` und `Processing.NDI.Lib.x64.dll`), `git status --short` zeigt nichts unter `apps/connect/resources/`.

**Abweichungen vom Gerüst:**
- `after-pack.test.mjs` prüft zusätzlich den Nicht-Windows-Weg von `bundle-zoom-bridge.mjs` per Kindprozess — nur außerhalb Windows (CI/Ubuntu); unter Windows erscheint die Zeile als übersprungen. Das ersetzt den manuellen Aufruf „unter Nicht-Windows → Exit 0“.
- `bundle-zoom-bridge.mjs` setzt `sdkBin` als `ZOOM_SDK_DIR ? join(…) : null` (die Spec schreibt `ZOOM_SDK_DIR && join(…)`; gleiche Wirkung, `sdkNamen` behandelt beides als „keine echte Liste“) und nennt in der Erfolgszeile, wogegen geprüft wurde. Die Gegenprobe steht als Step 15, weil Wächter 1 sonst nur am sauberen Fall gesehen würde.
- `after-pack.cjs` trägt über dem wörtlichen Spec-Code einen Kopfkommentar; der Code selbst ist unverändert aus Spec 10.3.
- Der Bau (Steps 12–15) läuft nach dem Commit und ohne eigenen Commit, damit fehlendes SDK den Code-Stand nicht blockiert; ohne `ZOOM_SDK_DIR` wird er als „nicht geprüft“ gemeldet.

---

### Task 20: Abschluss: CI-Schritte, Abnahmeliste, interner Bau

**Spec:** 12.6 (zwei neue Schritte im Job `selftests`; der dritte Schritt „Companion-Protokoll aktuell“ gehört zu Plan 4b), 13 (Abnahmeliste, Voraussetzungen und Schritte wörtlich), 16 (Messfragen M1, M3, M7, M9), 18 Zeile „4a · Fundament“, Spalte „Ende“ (interner Bau, Owner-Kurztest: Abnahme 1–8, 10, 19, 21, 22, 24).

**Files:**
- Modify: `.github/workflows/ci-checks.yml:59-60` (zwei Schritte nach dem Rundown-Schritt, Job `selftests`)
- Create: `apps/connect/ABNAHME-0.2.0.md`
- Kein Code, keine Versionsnummer (bleibt 0.1.0, L13), kein Changelog/Manifest (G11).

**Interfaces:**
- Consumes: die `selftest`-Skripte beider Pakete im Endstand von 4a — `@jm/zoom-bridge`: `node --experimental-strip-types test/selftest.ts && node test/auslieferung.test.mjs` (Aufgabe 4); `@jm/connect`: `tsx test/zoom-text.test.ts && tsx test/zoom-laufzeit.test.ts && tsx test/zoom-teile.test.ts && tsx test/zoom-kern.test.ts && node test/after-pack.test.mjs` (Aufgabe 19). Die Paketierung mit beiden Wächtern aus Aufgabe 19 (`prepackage` = `bundle-ndi` + `bundle-zoom-bridge`, `afterPack: tools/after-pack.cjs`). Aus `packages/zoom-bridge/scripts/auslieferung.mjs` (Aufgabe 4): `verboteneZoomDateien(ordner, { sdkBin })`, `verboteneAsarEintraege(ordner, { sdkBin })`, `asarEintraege(datei)`.
- Produces: zwei CI-Schritte im Job `selftests`; `apps/connect/ABNAHME-0.2.0.md`; den Installer `apps/connect/release/JM Connect-0.1.0-win-x64.exe` für den Owner-Kurztest (nicht eingecheckt, `release/` ist gitignoriert) samt SHA-256 im Bericht.

**Vorab (für den Umsetzer):**
- Stand: nach Aufgaben 1–19, alle Selbsttests grün. `ci-checks.yml` ist seit dem Ausgangsstand unverändert (Zeilen 59–60 = Rundown-Schritt); der Vorher-Ausschnitt kommt genau einmal vor. Die Datei liegt mit CRLF im Arbeitsbaum (G14, Edit-Werkzeug).
- `paths-ignore: ["**/*.md"]` in `ci-checks.yml`: ein reiner Doku-Commit löst keine CI aus. Dieser Commit enthält auch die YAML-Datei.
- Die CI läuft unter Ubuntu mit Node 22 und `npm ci --ignore-scripts` (G10). Ob die Bridge-Selbsttests dort durchlaufen, ist M14 und zeigt erst der erste CI-Lauf des PR; in 4a wird nicht gepusht (G13).
- Steps 7–9 (interner Bau) nur auf dem Windows-Entwicklungs-PC mit Visual Studio, CMake, `ZOOM_SDK_DIR` und `NDI_SDK_DIR` (L14: `packages/zoom-bridge/build/Release/zoom-bridge.exe` fehlt im Worktree). Kein Push, kein Tag, kein Release.
- Meeting-Nummer und Kenncode erscheinen in der Abnahmeliste nur als `<Meeting-Nummer>` und `<Kenncode>` (G12).

- [ ] **Step 1: CI — zwei Schritte im Job `selftests` (Spec 12.6, Namen wörtlich).**

Datei `.github/workflows/ci-checks.yml`. Vorher (Zeilen 59–60, eindeutig):
```yaml
      - name: Rundown (Abgleich, Sprung, scharfe Zeile)
        run: npm run selftest -w @jm/rundown
```
Nachher:
```yaml
      - name: Rundown (Abgleich, Sprung, scharfe Zeile)
        run: npm run selftest -w @jm/rundown
      # Zoom Stage 4a (Spec 12.6). Keiner dieser Tests lädt Electron oder braucht das Zoom-SDK.
      - name: Zoom-Bridge (Protokoll, Zustand, Attrappe — ohne SDK)
        run: npm run selftest -w @jm/zoom-bridge
      - name: Connect (Zoom-Kern gegen die Attrappe, Laufzeit, Statustexte)
        run: npm run selftest -w @jm/connect
```

- [ ] **Step 2: YAML lesen lassen und Einrückung prüfen.** `js-yaml` liegt als Abhängigkeit von electron-builder in `node_modules`.

Run (aus der Worktree-Wurzel):
```bash
node -e "const y=require('js-yaml');const d=y.load(require('fs').readFileSync('.github/workflows/ci-checks.yml','utf8'));for (const s of d.jobs.selftests.steps.slice(-3)) console.log(s.name+' => '+s.run)"
git diff --stat -- .github/workflows/ci-checks.yml
```
Expected: genau diese drei Zeilen
```
Rundown (Abgleich, Sprung, scharfe Zeile) => npm run selftest -w @jm/rundown
Zoom-Bridge (Protokoll, Zustand, Attrappe — ohne SDK) => npm run selftest -w @jm/zoom-bridge
Connect (Zoom-Kern gegen die Attrappe, Laufzeit, Statustexte) => npm run selftest -w @jm/connect
```
und `1 file changed, 5 insertions(+)`. Sichtprüfung im Diff: `- name:` mit sechs Leerzeichen, `run:` mit acht, wie die Nachbarschritte.

- [ ] **Step 3: Genau die Befehle der CI lokal laufen lassen.**

Run:
```bash
npm run selftest -w @jm/zoom-bridge
npm run selftest -w @jm/connect
npm run typecheck -w @jm/connect
npm run typecheck -w @jm/zoom-bridge
```
Expected: alle vier mit Exit-Code 0. `@jm/zoom-bridge`: `test/selftest.ts` endet mit `Alle Selbsttests bestanden.` (unter Windows 471 Zeilen `  ok  …`), danach läuft `test/auslieferung.test.mjs` ohne Zeile, die mit `FAIL` beginnt (24 Zeilen `  ok  …`, Schluss `Alle Auslieferungs-Tests bestanden.`). `@jm/connect`: die `tsx`-Dateien enden mit `487 ok, 0 fehlgeschlagen.`, `79 ok, 0 fehlgeschlagen.`, `78 ok, 0 fehlgeschlagen.` und `252 ok, 0 fehlgeschlagen, 0 übersprungen.` (unter Linux `249 ok, 0 fehlgeschlagen, 1 übersprungen.`), `after-pack.test.mjs` ohne `FAIL`. Beide Typechecks ohne Zeile mit `error TS`. Scheitert etwas, hier aufhören und die betroffene Aufgabe nachbessern, nicht diese Aufgabe.

- [ ] **Step 4: `apps/connect/ABNAHME-0.2.0.md` anlegen (ganzer Inhalt).** Voraussetzungen und die 25 Schritte sind wörtlich Spec 13, dazu die Spalten „4a-Kurztest“ und „Ergebnis“; die Messfragen wörtlich Spec 16.

````markdown
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
| 1 | Connect 0.2.0 auf dem Raum-PC installieren | Version sichtbar; Zoom-Karte zeigt „nicht vollständig eingerichtet: SDK-Ordner fehlt · Zugangsdaten fehlen“, „Beitreten“ fehlt, Hinweis zur Sperre; Tray „△ Zoom: Einrichtung unvollständig“ | ja | |
| 2 | SDK-Ordner `x86\bin` wählen | Text S2, nichts kopiert | ja | |
| 3 | SDK-Ordner aus der JM-Ablage wählen | Fortschritt; danach „Zoom-SDK 7.1.5.43953 eingerichtet“; Ordner unter `%LOCALAPPDATA%\JM Connect\zoom-laufzeit\` | ja | |
| 4 | Zugangsdaten-Datei wählen, danach die Datei umbenennen, Connect beenden und **aus dem Launcher** neu starten | „hinterlegt (Client-ID endet auf …)“; bleibt nach dem Neustart hinterlegt. Ab hier läuft Connect aus dem Launcher (Voraussetzung für M6 in Schritt 6) | ja | |
| 5 | „Einrichtung prüfen“ | Meldung „Einrichtung in Ordnung: Zoom-SDK 7.1.5 (43953) …“ im Meldungsbereich, „OK“ quittiert sie; Tray bleibt dabei „○ Zoom: kein Meeting“ — **ohne VC-Redist** (M1, erster Teil); kein Smart-App-Control-Block (M7) | ja | |
| 6 | Beitreten mit `<Meeting-Nummer>` und `<Kenncode>`, Anzeigename Vorgabe | Warteraum (falls an), Host lässt zu: Karte geht von „Im Warteraum …“ auf „Trete dem Meeting bei …“, **nie** „Verbindung unterbrochen“; Erlaubnis-Anfrage beim Host, nach dem Erteilen „Im Meeting. Personen unten als Quelle laden.“; Tray und Kopfzeile wie 7.2. Gelingt der Beitritt mit Connect aus dem Launcher, ist M6 belegt | ja | |
| 7 | Teilnehmerliste ansehen | keine eigene Zeile; Host markiert; Kamera-Zustand stimmt | ja | |
| 8 | Fünf Personen laden, bei einer vorher „Ton“ aus | fünf Quellen „JM Connect – Zoom <Name>“ im Switcher mit Bild, vier mit Ton; Tray „● Zoom: 5 Quellen geladen“. Im Task-Manager (Details, Spalte „Befehlszeile“) **alle** Prozesse aus dem Laufzeit-Ordner notieren: erwartet `zoom-bridge.exe`; jede weitere EXE von dort (zum Beispiel `aomhost64.exe`, `zeebview2Agent.exe`, `zcscpthost.exe`) belegt M1, zweiter Teil. Läuft keine Hilfs-EXE, bleibt M1 Teil 2 offen | ja | |
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
````

- [ ] **Step 5: Abnahmeliste gegen die Spec prüfen.**

Run (aus der Worktree-Wurzel):
```bash
grep -c "^| " apps/connect/ABNAHME-0.2.0.md
grep -c "| ja |" apps/connect/ABNAHME-0.2.0.md
node -e "const fs=require('fs');const s=fs.readFileSync('docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md','utf8').replace(/\r\n/g,'\n').split('\n');const a=s.indexOf('| # | Schritt | Erwartung |');const spec=s.slice(a+2,a+27);const ab=fs.readFileSync('apps/connect/ABNAHME-0.2.0.md','utf8').replace(/\r\n/g,'\n');const f=spec.filter((z)=>!ab.includes(z.replace(/ \|$/,'')+' | '));console.log(f.length?'ABWEICHEND: '+f.join(' / '):spec.length+' Schritte wörtlich');process.exit(f.length?1:0)"
```
Expected: `36` (Tabelle „Getesteter Bau“ 3 Zeilen, Schritte 2 + 25, Messungen 2 + 4), `13` (Schritte 1–8, 10, 19, 21, 22, 24), `25 Schritte wörtlich`.

- [ ] **Step 6: Commit.**

```bash
git add .github/workflows/ci-checks.yml apps/connect/ABNAHME-0.2.0.md
git status --short
```
Erwartet genau diese gestagten Zeilen (sonst nichts Gestagtes):
```
M  .github/workflows/ci-checks.yml
A  apps/connect/ABNAHME-0.2.0.md
```
Dann:
```bash
git commit -m "ci(connect): Zoom-Selbsttests im Job selftests, Abnahmeliste 0.2.0 mit 4a-Kurztest" -m "Zwei Schritte nach dem Rundown-Schritt: Zoom-Bridge (Protokoll, Zustand, Attrappe) und Connect (Zoom-Kern gegen die Attrappe, Laufzeit, Statustexte), beide ohne Electron und ohne SDK (Spec 12.6; Companion-Protokoll folgt mit 4b). ABNAHME-0.2.0.md: Voraussetzungen und 25 Schritte wörtlich aus Spec 13, Spalte 4a-Kurztest (1-8, 10, 19, 21, 22, 24), Messungen M1, M3, M7, M9 (#197)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Nicht pushen.

- [ ] **Step 7: Interner Bau — Voraussetzungen (nur Windows-Entwicklungs-PC).**

Run:
```bash
node -e "console.log(process.platform, Boolean(process.env.ZOOM_SDK_DIR), Boolean(process.env.NDI_SDK_DIR))"
npm run rebuild -w @jm/zoom-bridge
npm run rebuild:native -w @jm/connect
ls -la packages/zoom-bridge/build/Release/zoom-bridge.exe packages/ndi/build/Release/jm_ndi.node
```
Expected: `win32 true true`; der CMake-Bau endet ohne Fehler mit einer Zeile `zoom-bridge.vcxproj -> …\packages\zoom-bridge\build\Release\zoom-bridge.exe`; `electron-rebuild` endet ohne Fehler; beide Dateien sind da und frisch datiert. Steht dort nicht `win32 true true`, hier aufhören: ohne SDK-Ordner und NDI-SDK lässt sich kein Installer bauen (L14).

- [ ] **Step 8: Installer bauen (beide Wächter laufen mit).**

Run: `npm run dist:win -w @jm/connect`
Expected: `electron-vite build` dreimal `✓ built in …`; `prepackage` läuft `bundle-ndi` und `bundle-zoom-bridge` (Aufgabe 19) ohne Abbruch, also auch Wächter 1 ohne Treffer; electron-builder meldet `building        target=nsis` mit `file=release\JM Connect-0.1.0-win-x64.exe`; `afterPack` (Wächter 2) wirft nicht; Exit-Code 0. Bricht ein Wächter ab, steht die Liste der Treffer in der Ausgabe: nicht umgehen, Ursache suchen (G6).

- [ ] **Step 9: Ergebnis prüfen und SHA-256 für den Bericht.**

Run:
```bash
ls -la "apps/connect/release/JM Connect-0.1.0-win-x64.exe" apps/connect/release/win-unpacked/resources/zoom-bridge/
node --input-type=module -e "import { verboteneZoomDateien, verboteneAsarEintraege, asarEintraege } from './packages/zoom-bridge/scripts/auslieferung.mjs'; const o = 'apps/connect/release/win-unpacked'; const sdkBin = process.env.ZOOM_SDK_DIR ? process.env.ZOOM_SDK_DIR + '/x64/bin' : null; console.log(JSON.stringify(verboteneZoomDateien(o, { sdkBin }))); console.log(JSON.stringify(verboteneAsarEintraege(o, { sdkBin }))); console.log(asarEintraege(o + '/resources/app.asar').filter((e) => e.includes('zoom-bridge')).length);"
sha256sum "apps/connect/release/JM Connect-0.1.0-win-x64.exe"
git status --short
```
Expected: der Installer ist da; `resources/zoom-bridge/` enthält `zoom-bridge.exe` und die DLLs der VC-Laufzeit (mindestens `msvcp140.dll`, `msvcp140_codecvt_ids.dll`, `vcruntime140.dll`, `vcruntime140_1.dll`) und **keine** Zoom-Datei; dann `[]`, `[]`, `0` (kein Zoom-SDK-Name im Ordner, nichts Verbotenes in der `app.asar`, kein Eintrag unter `node_modules/@jm/zoom-bridge/`); eine Zeile `<64 Hex-Zeichen>  apps/connect/release/JM Connect-0.1.0-win-x64.exe`; `git status --short` ohne Ausgabe (`release/`, `build/`, `resources/bin/` und `resources/zoom-bridge/` sind gitignoriert).

In den Bericht der Aufgabe: Pfad `apps/connect/release/JM Connect-0.1.0-win-x64.exe`, SHA-256 aus der `sha256sum`-Zeile, Datum des Baus. Der Owner trägt beides beim Kurztest in die Tabelle „Getesteter Bau“ ein und arbeitet die Schritte 1–8, 10, 19, 21, 22, 24 ab. Kein Push, kein Tag, kein Release.

**Abweichungen vom Gerüst:**
1. **YAML-Prüfung mit `js-yaml`** statt nur `readFileSync`: Das Lesen der Datei prüft keine YAML-Struktur; `js-yaml` (über electron-builder im Repo) liest sie und zeigt Namen und Befehle der neuen Schritte.
2. **Tabelle „Getesteter Bau“ und drei Hinweise** am Kopf der Abnahmeliste (interner Bau mit 0.1.0, kein Wiederbeitritt in 4a, keine Meeting-Daten in die Datei). Die Spec-Texte selbst bleiben wörtlich (Step 5 prüft es).
3. **Commit-Präfix `ci(connect)`**: Der Commit ändert nur CI und Doku; G13 nennt `feat(…)` als Beispiel.
4. **Prüfung des fertigen `win-unpacked`** mit den Funktionen aus `auslieferung.mjs` (Step 9) zusätzlich zu den beiden Wächtern im Bau: Sie zeigt das Ergebnis, nicht nur, dass kein Wächter abgebrochen hat.


---

## Selbstprüfung der Montage (writing-plans, Abschnitt „Self-Review“)

**1. Spec-Abdeckung (Spec 18, Zeile „4a · Fundament“).** Jeder Punkt hat eine Aufgabe; eine Lücke, die eine neue Aufgabe verlangt hätte, gab es nicht.

| Punkt aus Spec 18 | Aufgabe(n) |
| --- | --- |
| `sdk.ts`, Fehlerkatalog (`FAIL_CODE_NAMES`, `failReason`, `endReason`) | 1, 2 |
| Attrappe (12.1 Nr. 4) | 3 |
| `auslieferung.mjs` mit `app.asar`-Prüfung | 4 |
| Laufzeit-Ordner und Einrichtung samt Mängeln und Sperre | 7, 8, 10 |
| Kern ohne Wiederbeitritt (Abriss → `fehler` mit „Erneut beitreten“), mit Generationsregel 6.9 | 11, 13 |
| Einlass aus dem Warteraum | 13 |
| Verlassen, Schließen, Meldung (6.8), `stateKv()` ohne `zoom_cmd*` | 10, 13 |
| Hülle, IPC | 16, 17 |
| Oberfläche mit Meldungsbereich | 18 |
| Status Abschnitt 7 vollständig (Zeile, Kartentext, Gäste-Zeile, Tooltip, STATE, Prüfregel) | 5, 17, 18 |
| Beenden (6.6) | 13, 17 |
| Paketierung mit beiden Wächtern | 19 |
| Tests 12.1 | 1–4 |
| Tests 12.3 | 7, 8 |
| `zoom-text.test.ts` aus 12.4 | 5, 6 |
| 12.2 ohne 15, 15b, 15c, 16–18, 22, 25 und ohne die Fernsteuer-Teile von 13 und 21 | 8 (Fall 4b), 10–15 (Fälle 1–14b, 19–21, 23, 24–24c, 26–28) |
| CI-Schritte für Bridge und Connect | 20 |
| Interner Bau, Owner-Kurztest (Abnahme 1–8, 10, 19, 21, 22, 24) | 19 Steps 12–15, 20 |

**2. Platzhalter.** Gesucht nach TBD/TODO/„später“/„wie Aufgabe N“/Auslassungen in Codeblöcken. Gefunden und behoben: ein Verweis „die Kopfzeilen wie in Aufgabe 5 Step 4“ (Aufgabe 6, jetzt ausgeschrieben). Außerdem standen in den Aufgaben 16–20 nur vage erwartete Zählstände (`<n> ok`, `<k> übersprungen`, „… ok“), weil Block 4 gegen Ersatz-Module lief. Sie sind jetzt durch die bei der Montage gemessenen Werte ersetzt. „…“ in Codeblöcken steht nur in gekürzten erwarteten Ausgaben und in UI-Texten der Spec.

**3. Typ- und Namenskonsistenz.** Die Interfaces-Blöcke aller 20 Aufgaben wurden gegeneinander abgeglichen (Consumes ↔ Produces). Danach wurde der fertige Plan als Ganzes nachgespielt: alle 148 Vorher/Nachher-Ersetzungen und alle 20 neuen Dateien der Aufgaben 1–20 der Reihe nach auf eine frische Kopie von `packages/zoom-bridge`, `apps/connect` und `ci-checks.yml`. Dabei liefen die echten Module aus Block 2 und die echte Attrappe aus Aufgabe 3 erstmals zusammen mit dem Kern aus Block 3. Ergebnis (Windows, Node 24.16):
- Jeder Vorher-Ausschnitt kam genau einmal vor.
- Bridge: `test/selftest.ts` 471 `ok`, `Alle Selbsttests bestanden.`; `test/auslieferung.test.mjs` 24 `ok`.
- Connect: `zoom-text` 487, `zoom-laufzeit` 79, `zoom-teile` 78, `zoom-kern` 252 ok, 0 fehlgeschlagen, 0 übersprungen; `after-pack.test.mjs` bestanden.
- Nach der zweiten Prüfrunde (05.10.2026) noch einmal ganz nachgespielt, diesmal mit **jedem** Testbefehl des Plans an seiner Stelle (rot und grün): 148 Ersetzungen und 20 neue Dateien ohne Fehler; rote Schritte rot wie beschrieben (Aufgabe 13: 16 `FAIL`, Aufgabe 15: 9 `FAIL`), grüne Schritte mit den oben genannten Zählständen; Typchecks und Bau grün; `grep -c` auf `index-*.js` liefert `1` (Aufgaben 17, 18). Die Zeilenangaben der Aufgaben 6 und 11–15 sind an diesem Lauf neu bestimmt. Die neuen Gegenproben (Aufgaben 4, 5, 10) sind am jeweiligen Zwischenstand gemessen.
- `tsc` für Connect (node und web) und für die Bridge ohne Fehler.
- `electron-vite build` grün: `import.meta` im Main-Bündel 0, `jmc:zoom-get` in Main und Preload, kein `require("@jm/zoom-bridge")`.
- Aufgabe 20 Steps 2 und 5: die drei CI-Zeilen wie erwartet; Abnahmeliste 36 Tabellenzeilen, 13 × „ja“, „25 Schritte wörtlich“.
- Jeder Commit-Schritt staged alle Dateien, die seine Aufgabe ändert, und endet mit der Co-Authored-By-Zeile.

Die Abweichungen der Attrappe in Aufgabe 3 gegenüber dem Ersatz, gegen den Block 3 gemessen hatte (`audio off` bei jedem bestellten Ton, Grund `reboundByName`, Umhängen nur bei eindeutigem Namen), ändern am Kern-Test nichts. Berichtigt wurde nur Text: In Aufgabe 10 stammt `readCredentials` aus dem Bestand (`src/jwt.ts`), nicht aus Aufgabe 2. In Aufgabe 20 ist der interne Bau Steps 7–9, nicht 6–9 (Step 6 ist der Commit).

**4. Review Focus.** Jede Zeile hat ihren Test in der genannten Aufgabe:
- 1 → Aufgabe 12, Prüfung „Review Focus 1: zweiter Klick während startet“.
- 2 → Aufgabe 13, Prüfung „Review Focus 2: Verlassen → verlaesst, dann bereit“.
- 3 → Aufgabe 10, Block „Review Focus 3: Connect wird während der SDK-Kopie beendet (echtes richteEin)“ (Kern mit dem echten `richteEin` über Temp-Ordner: `beenden` kehrt erst nach dem Ergebnis von `richteEin` zurück, `<ziel>.teil` fehlt, Stempel unverändert); `richteEin` allein belegt Aufgabe 7 („Review Focus 3, Teil richteEin“).
- 4 → Aufgabe 10, Prüfung „Review Focus 4: zweiter Klick während der Kopie → S10“.
- 5 → Aufgabe 12, Prüfung „Review Focus 5: Nummer mit Buchstaben → N0“ und die folgenden.

Bei Zeile 5 fehlte der leere Anzeigename. Er ist jetzt im Test (`r2leer`), ohne dass sich die Zahl der Prüfungen ändert.

**Nicht ausgeführt bei der Montage:** die roten Zwischenstände (die Schreiber haben sie je Aufgabe gemessen; beim Nachspielen der zweiten Prüfrunde liefen sie mit), die älteren Gegenproben, der Bau der echten Bridge und des Installers (L14) und jeder Lauf unter Linux (CI, M14).
