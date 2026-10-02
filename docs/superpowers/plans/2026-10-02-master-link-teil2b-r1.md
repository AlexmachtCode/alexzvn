# Master-Link Teil 2b · Release 1 „Titler hält seinen Speaker“ · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine Bauchbinde auf Sendung zeigt nie unbemerkt eine andere Person. Die iveo-Speaker-Kennung reist von iveo über die Show bis in Titler und Rundown. Der Titler hält seinen Eintrag über einen Schlüssel statt über die Nummer. Ein Abruffehler im Launcher gilt nicht mehr als „0 Speaker“. Das gilt am Einzelplatz und ohne Netz-Code.

**Architecture:**
- **Messung zuerst (M1–M3, Spec 23):** Ein Lese-Werkzeug in `@jm/iveo` startet der Owner mit seinem Token. Die Ergebnisse legen fest, ob der Mapper die Kennung übernimmt (M1) und ob er sortiert (M3).
- **`@jm/show` / `@jm/iveo`:**
  - `ShowIveoSpeaker.id` wird normalisiert. Doppelte werden zu `#2`, `#3` über die neue gemeinsame Regel `loeseDoppelteKennungenAuf`, die auch `normalizeAblauf` nutzt.
  - Neu ist `ShowIveoBinding.speakerVeraltetSeit`.
  - Der Mapper setzt `id`.
- **Launcher:** Die Abgleich-Signatur nimmt Kennung und Merker auf, deshalb werden die Kennungen einmal nachgeschrieben. Scheitert `/speakers`:
  - Speaker und „Verantwortlich“ kommen aus der Datei.
  - Der Merker steht in der Show.
  - Die Statuszeile bleibt „gestört“.
  - Jede Listen-Abfrage holt den Snapshot nach, bis die Liste wiederkommt.
- **Titler:** zwei neue reine Module ohne Electron und ohne fs.
  - `datalink-kern.ts`: Tabellen lesen, Schlüssel bilden, Zustandstabelle A1–A11 mit Brücke, Abruf mit `@`-Form, Hinweise H1–H7, Companion-Werte.
  - `datenquelle.ts`: Datenquelle `show`/`ordner`/`frueher`, gemerkte Show, Übergang für `iveo-data`.
  - `show-quelle.ts` hält `show-zuletzt.json` auf der Platte.
  - `datalink.ts` liest nur noch Ordner und ruft den Kern.
  - Die Oberfläche zeigt Quelle, Hinweise, „Zurück zum eigenen Ordner“ und die Board-Karte.
- **Rundown:**
  - Neues Feld `RundownAction.speakerId`.
  - Reine Funktionen in `src/shared/zeilen.ts`.
  - Beim Senden schickt der Main `TITLER RECALL @⟨Kennung⟩ ⟨Name⟩`, wenn der Titler `recall_kennung=1` meldet, sonst den aktuellen Namen.
- **Durchgang:** In `apps/rundown/test/e2e-teil2a.mjs` wird Abschnitt 9 zur Prüfung. Dazu kommen 9b–9e mit Bildvergleich über CDP.

**Tech Stack:** TypeScript (ESM), Electron 33, React 18, Zustand 4. Selbsttests:
- esbuild-Bündel für `@jm/iveo` und den `@jm/show`-Anteil
- `tsx` für den Launcher und den Titler (neu)
- `node --experimental-strip-types` für den Rundown

Der Durchgang läuft mit `tsx`, Electron und dem Chrome-DevTools-Protokoll.

**Spec:** `docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md`, vom Owner freigegeben am 02.10.2026.
- Umfang dieses Plans: Teil A (Abschnitte 5–11) und Abschnitt 23 (M1–M3).
- Teil B (Abschnitte 12–21, Release 2) bekommt einen eigenen Plan. Er beginnt erst, wenn Release 1 gemergt ist (Spec 26).
- Plan und Spec gehören zusammen. Bei Widerspruch gilt die Spec, und die Abweichung wird gemeldet.
- **Ausnahme: Entscheidungen 14 und 18** (Abschnitt „Entscheidungen, wo die Spec schweigt“). Sie weichen bewusst ab: 14 von Spec 7.4 (`hinweis?: string`), 18 von Spec 9.6 („9 wie heute“). Hat der Owner sie bestätigt (siehe „Unklarheiten“), gehen sie der Spec vor, und ein Spec-Prüfer wertet sie nicht als Verstoß. Ohne Bestätigung beginnt B13 nicht, denn Entscheidung 14 trägt B13 und B14. Ebenso beginnt B17 nicht ohne Bestätigung von Entscheidung 18. Lehnt der Owner eine davon ab, wird der Plan für die betroffenen Aufgaben überarbeitet, bevor sie beginnen.

**Arbeitsort:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b`, Branch `feat/master-link-teil2b`, Stand `996f54e2b8`. Alle Pfade sind relativ dazu. Zeilenangaben gelten für diesen Stand; maßgeblich ist immer der wortgleiche Vorher-Text.

**Aufbau:** 18 Aufgaben B1–B18. Jede braucht nur, was davor fertig ist.

| Block | Aufgaben | Inhalt |
| --- | --- | --- |
| 1 | B1–B7 | Messung, `@jm/show`/`@jm/iveo`, Launcher |
| 2 | B8–B11 | Titler-Kern und Datenquelle |
| 3 | B12–B14 | Titler: Datei, Main, Anzeige |
| 4 | B15–B18 | Rundown, Durchgang, Abnahme und Release |

**Messergebnisse M1–M3:** Aufgabe B2 trägt sie in Spec 23 unter „Ergebnisse“ ein und hier (Spec 23: „Die Ergebnisse kommen in diese Spec und in den Plan.“). B4 wählt danach den Zweig im Mapper, B5 die Testdaten.
- Stand: noch nicht gemessen.

**Wie dieser Plan entstanden ist:**
- Ein Gerüst hat die Aufgaben B1–B18, die verbindlichen Schnittstellen und die Entscheidungen unten festgelegt. Vier Schreiber haben die Aufgaben ausformuliert (B1–B7, B8–B11, B12–B14, B15–B18). Jeder hat seine Codeschritte wörtlich aus dem Plantext in eine Kopie des Worktrees (Stand `996f54e2b8`) eingespielt. Die roten und grünen Ausgaben im Plan sind dort gemessen, nicht geschätzt.
- **B1–B7:** Alle Vorher/Nachher-Ersetzungen der Reihe nach eingespielt; jeder Vorher-Text kam genau einmal vor. Der Endstand ist in allen vier Zweigen (M1 ja/nein × M3 ja/nein) grün: iveo `ALLE TESTS OK`, Launcher `194 / 47 / 75 / 6 ok`, Typecheck von Launcher, Titler, Rundown und Timer. Sieben absichtliche Fehler im Launcher-Kern fangen die Tests alle.
- **B8–B11:** Nur aus den Code-Blöcken nachgebaut (`@jm/show` als Stand-in nach der Schnittstelle aus B3): 31, 116, 167 und 256 Zeilen `ok` (Stand nach der Prüfung), `tsc` node und web grün. 37 absichtliche Fehler fangen die Tests alle.
- **B12–B14:** In einer Kopie von `apps/titler` mit B8–B11 und B3: Selbsttest, `typecheck:node`, `typecheck:web` und `electron-vite build` grün. Beim Zusammensetzen des Plans und nach der Prüfung noch einmal wörtlich aus dem Plantext eingespielt: 284, 305 und 321 Zeilen `ok`.
- **B15–B18:** Rundown-Selbsttest 399 `ok` (vorher 338), Typecheck und Build grün, beide Gegenproben je genau ein `FAIL`. B17: `node --check` und das Laden der Module grün; der Durchgang selbst ist nicht gelaufen (G11). B18: `changelog.json` gültig, die Release-Prüfung meldet `Release-Vorbereitung ok`.
- **Beim Zusammensetzen korrigiert:**
  - B13 `rescan` behält die alten Quellen nur noch im selben Ordner (`&& !andererOrdner`), passend zur A7-Regel aus B9. Dazu ein Test, der ohne die Korrektur rot wird.
  - Die Testzahlen in B12–B14 nachgemessen (Endstand damals 320 statt 317; nach der Prüfung 321).
  - Commit-Texte von B15–B18 ohne Umlaute und mit Text, wie im Repo; `git status --short` wird vor dem Commit gelesen.
  - Einheitliche Schritt-Bezeichnung `Step n`, Arbeitsverzeichnis und Voraussetzung in jeder Aufgabe ausgeschrieben.
- **Nach der Prüfung eingearbeitet (02.10.2026):**
  - B9: Ein Ordnerwechsel auf Sendung ohne aktiven Eintrag wählt nicht mehr Eintrag 1 (Spec 7.3 A8). Neuer Test „A8 ohne aktiven Eintrag …“, der gegen den alten Stand rot wird. Die Testzahlen ab B9 steigen um 1.
  - B1/B2: `ids <datei>` und `vergleiche` zählen, welche Kennungen zwischen den beiden M1-Abrufen verschwunden oder neu sind. Ein neuer Speaker gilt damit nicht mehr als „instabil“, Leerraum ist kein Abbruchgrund (Spec 5.1, 8.3). Step 3 führt immer zu M2 (a). Die Ergebnisse kommen auch in diesen Kopf (Step 9). Nachgemessen: iveo-Selbsttest 136 `ok` (vorher 118), Werkzeug ohne Token, ohne Befehl, gegen eine tote Adresse und `vergleiche` wie in B1 Step 7; `ids <datei>` gegen einen nachgebauten iveo-Server.
  - Kopf: Die Entscheidungen 14 und 18 weichen bewusst von der Spec ab und brauchen die Bestätigung des Owners vor B13 bzw. B17.
  - B17: Step 12 prüft `electron.exe` und weicht aus; Step 14 nennt `npm ci --ignore-scripts` für den Gegenprobe-Worktree.
  - G15 nennt die gemessenen Zeilenenden (CRLF im Arbeitsbaum, LF im Index). Der Hinweis „alle berührten Dateien liegen mit LF vor“ traf für diesen Worktree nicht zu.

## Global Constraints

- **G1 Nicht anfassen:**
  - `packages/master-link`, `packages/app-runtime`, `packages/suite-control-protocol`
  - das Companion-Modul `packages/companion-jm-suite`
  - Connect (`apps/connect`). SP8 bleibt bewusst ohne Kennung.
- **G2 Kennung (Speaker-`id`, Titler-Schlüssel):**
  - String, nach `trim()` 1 bis 200 Zeichen, sonst entfällt das Feld. Der Speaker bleibt.
  - Doppelte: Die erste behält ihre Kennung, jede weitere bekommt `#2`, `#3` … (die nächste freie Nummer; „X“, „X“, „X#2“ → „X“, „X#3“, „X#2“). Der Zusatz wird so gekürzt, dass 200 Zeichen nie überschritten werden.
  - Es gibt genau eine Regel dafür: `loeseDoppelteKennungenAuf` aus `@jm/show`.
- **G3 Titler-TSV:**
  - Datei `speakers.tsv`, Kopf `name\tfunktion\ttitle\t@kennung`; die Kennung steht hinten.
  - `@kennung` landet in `DataEntry.key`, nie in `vars` und nie als Label.
  - Ersatz-Schlüssel: `ersatz:<Dateiname>|<Label>` für eine CSV/TSV-Zeile, `ersatz:<Dateiname>` für eine `schlüssel=wert`-Datei. Er wird nur im Titler gebildet und nie geschrieben.
- **G4 Halten nach dem Ende der Sendung:** 1 s (`HALTEN_NACH_SENDUNG_MS = 1000`). Die Ausblendung dauert 450 ms (`apps/titler/src/renderer/src/lib/engine.ts:15`).
- **G5 Companion:**
  - STATE behält `entry`, `entry_index`, `entry_count`.
  - Neu ist `recall_kennung=1`, eine feste Fähigkeit.
  - Neu ist die `@`-Form `TITLER RECALL @⟨Kennung⟩ ⟨Name⟩`.
  - `TITLER RECALL <nr>`, `NEXT` und `PREV` bleiben nummernbasiert.
- **G6 Gemerkte Show:** `<userData>/show-zuletzt.json` mit `{ showPfad, showName, mitSpeakern }`. Sie wird atomar geschrieben: erst eine Zwischendatei, dann umbenennen.
- **G7 Titler-Module:**
  - `src/shared/datalink-kern.ts` und `src/shared/datenquelle.ts` importieren zur Laufzeit nur `@jm/show`, sonst nur `import type`. Kein `electron`, kein `node:`.
  - Der Titler-Selbsttest läuft mit `tsx` und lädt kein Electron, denn die CI installiert ohne Postinstalls.
- **G8 Rundown `src/shared/*.ts`:**
  - Keine `electron`-, `node:`- oder Paket-Laufzeitimporte, zwischen Modulen nur `import type`.
  - `schemaVersion` bleibt 2.
  - `speakerId` ist ein String mit 1 bis 200 Zeichen. `args[0]` behält den Namen.
- **G9 Texte:** wörtlich aus Spec 6.3, 7.8 (H1–H7, Q1–Q3, K1, B1), 7.9, 8.2, 8.4 und 10, mit deutschen Anführungszeichen „…“. `⟨hh:mm⟩` ist die Ortszeit aus `speakerVeraltetSeit`.
- **G10 Logs:** nie ein Token, nie Inhalte aus JSON-Parse-Fehlern. Bei kaputtem JSON steht nur „kein gültiges JSON“.
- **G11 Token und `%APPDATA%`:**
  - Kein Agent liest ein Token oder Dateien in `%APPDATA%`.
  - Messbefehle mit Token startet der Owner in seiner eigenen Konsole (`$env:JMPS_IVEO_TOKEN`).
  - Nur der Durchgang `e2e-teil2a.mjs` legt Dev-Daten unter `%APPDATA%` beiseite und stellt sie danach wieder her. Er läuft in B17 erst nach Freigabe durch die steuernde Sitzung.
- **G12 Versionen und Changelog:**
  - Titler **0.10.0**, Launcher **0.14.0**, Rundown **0.7.0**, jeweils in `package.json` und `package-lock.json`.
  - Changelog `packages/suite-manifest/changelog.json` ohne ASCII-Anführungszeichen in den Texten.
  - Vor dem Commit: `node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8'))"`.
- **G13 Git:**
  - Ein Commit je Aufgabe, deutsch im Stil `feat(titler): …`. Letzte Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - `git add` nur mit expliziten Pfaden, danach `git status --short` lesen.
  - Nie pushen. Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel.
  - Push, PR, Merge, Tags (einzeln pushen) und Release erst nach Freigabe durch den Owner.
- **G14 TDD:** Erst den Test rot sehen, dann den Code schreiben. Jede Aufgabe endet mit `npm run typecheck -w <paket>` grün für jedes berührte App-Paket (`@jm/launcher`, `@jm/titler`, `@jm/rundown`).
- **G15 Zeilenenden:** `core.autocrlf=true`. Im Arbeitsbaum dieses Worktrees liegen die berührten Code-Dateien mit CRLF vor, im Index mit LF (`git ls-files --eol <datei>` zeigt `i/lf w/crlf`, nachgemessen am 02.10.2026 für alle Dateien unter `apps/titler`, `apps/launcher/src` und `/test`, `apps/rundown/src` und `/test`, `packages/show`, `packages/iveo`, `.github`, `docs/jm-show.md`, `changelog.json`, die `package.json` und `package-lock.json`). Die Spec liegt mit LF vor. Änderungen mit dem Edit-Werkzeug machen (Vorher-Text exakt ersetzen), nicht mit `sed`. Neue Dateien schreibt das Write-Werkzeug mit LF; `git add` warnt dann „LF will be replaced by CRLF“, das ist harmlos.

## Testläufe (wie sie wirklich heißen)

| Paket | Befehl | Laufzeit |
| --- | --- | --- |
| `@jm/iveo` (mit `@jm/show`-Fällen und Messkern) | `npm run selftest -w @jm/iveo` | esbuild-Bündel + node |
| `@jm/launcher` | `npm run selftest:iveo -w @jm/launcher` | tsx (iveo-abgleich, iveo-huelle, show-speichern, reload-nachholen) |
| `@jm/titler` (neu ab B8) | `npm run selftest -w @jm/titler` | tsx `test/selftest.ts` |
| `@jm/rundown` | `npm run selftest -w @jm/rundown` | node --experimental-strip-types |
| Typecheck | `npm run typecheck -w @jm/launcher`, `-w @jm/titler`, `-w @jm/rundown` | tsc (node + web) |
| Durchgang (nicht in der CI) | `npm run build -w @jm/launcher -w @jm/timer -w @jm/rundown -w @jm/titler`, dann `ELECTRON_EXE=<electron.exe> node node_modules/tsx/dist/cli.mjs apps/rundown/test/e2e-teil2a.mjs` | Electron + CDP |

## Review Focus (in die Tests der genannten Aufgabe)

1. **Eigene CSV wird beim Speichern kurz leer oder halb gelesen** (Excel). Eine Person aus dieser CSV ist auf Sendung, die Quelle ist `ordner`.
   - Erwartet: Sie wird gehalten (A2, H1) und springt nicht auf Eintrag 1. Kommt ihre Zeile zurück, ist sie wieder aktiv (A5), ohne Hinweis.
   - Ohne Sendung gibt es keinen aktiven Eintrag (A3). Auch nach dem Zurückkommen wird nicht von selbst Eintrag 1 aktiv.
   - Test: **B9**.
2. **Dieselbe Show mit anderer Pfad-Schreibweise** per Deep-Link oder RELOAD (`C:\Shows\Tag1.jmshow` und `c:/shows/tag1.jmshow`).
   - Erwartet: `gleicheShowPfad` gilt, also dieselbe Show. Kein Wechsel auf `ordner`, keine Liste verloren.
   - Test: **B11**.
3. **Rundown kennt die Fähigkeit des Titlers nicht sicher:** Der Titler-Link ist verbunden, aber noch ohne STATE (`state: null`); oder er ist getrennt; oder der STATE kommt von einem Titler 0.9.0 ohne `recall_kennung`.
   - Erwartet: `titlerKannKennung` ist `false`, gesendet wird die Namensform. Ein Titler, der die `@`-Form nicht kennt, bekommt sie nie.
   - Test: **B15**.
4. **Show-Datei beim RELOAD oder Start halb geschrieben (kaputtes JSON) oder gesperrt (EBUSY).**
   - Erwartet: `leseShowSicher` liefert `{ grund: 'kein gültiges JSON' }` bzw. `{ grund: 'EBUSY' }`, nie Dateiinhalt. Die Liste bleibt, H4 steht.
   - Das nächste lesbare RELOAD nimmt H4 wieder weg.
   - Test: **B12** (`leseShowSicher`) und **B11** (H4 weg nach `gelesen`).
5. **Zwei Speaker gleichen Namens mit verschiedenen Kennungen** (`s-7` „Ana Silva“ vorn, `s-9` „Ana Silva“).
   - Erwartet: `@s-9 Ana Silva` trifft genau `s-9`. Der reine Name trifft den ersten, wie beschrieben.
   - Verschwindet `s-9`, während sie auf Sendung ist, wird sie gehalten (A2) und nie auf `s-7` überbrückt.
   - Test: **B10**.

---

## Dateistruktur

**Neu**
- `packages/iveo/tools/messung-2b-kern.ts`: reine Auswertung der Messung M1/M3. Form der Kennung, Leerraum, Doppelte, Mengen- und Reihenfolge-Hash, Abgleich mit dem Launcher-Cache, Mengenvergleich zweier Abrufe.
- `packages/iveo/tools/messung-2b.ts`: Lese-Werkzeug für M1–M3, das der Owner startet. Das Token kommt nur aus `JMPS_IVEO_TOKEN` seiner Konsole und wird nie ausgegeben.
- `apps/titler/src/shared/datalink-kern.ts`: Kern des Titlers ohne Electron und fs. Er enthält:
  - Tabellen und `schlüssel=wert` lesen, Schlüssel bilden, zusammenführen
  - Zustandstabelle A1–A11 mit Brücke
  - Abruf mit `@`-Form, Weiter und Zurück
  - Hinweise H1–H7 mit Vorrang
  - Companion-Werte
- `apps/titler/src/shared/datenquelle.ts`: Regeln aus 7.6 und 7.7 ohne Electron. Datenquelle `show`/`ordner`/`frueher`, Ereignisse, gemerkte Show, Übergang `iveo-data`, Zeilen Q1–Q3, Knopf K1, Pfadvergleich.
- `apps/titler/src/main/show-quelle.ts`: Datei-Ebene ohne Electron. `show-zuletzt.json` atomar lesen, schreiben und löschen; eine Show sicher lesen (Grund ohne Dateiinhalt).
- `apps/titler/src/renderer/src/lib/datalink-anzeige.ts`: reine Anzeige-Helfer für Daten/Recall und Board. Zähler, Board-Hinweis, Karte B1, Sperre von Weiter/Zurück.
- `apps/titler/test/selftest.ts`: Titler-Selbsttest mit tsx und ok/FAIL-Zählung. Er deckt `datalink-kern`, `datenquelle`, `show-quelle`, `iveo-show`, `datalink` und `datalink-anzeige` ab.
- `apps/titler/ABNAHME-2b-R1.md`: Owner-Abnahme für Release 1 nach Spec 10, mit Ergebnisspalte.

**Geändert**
- `packages/show/src/index.ts`: `ShowIveoSpeaker.id`, `ShowIveoBinding.speakerVeraltetSeit`, `loeseDoppelteKennungenAuf`. Der Normalisierer übernimmt beides, `normalizeAblauf` nutzt die gemeinsame Regel.
- `packages/iveo/src/mapper.ts`: `speakersToShowSpeakers` setzt `id`. Rückfälle aus M1 und M3 stehen in B4.
- `packages/iveo/test/selftest.ts`: Fälle aus 9.1 und Messkern.
- `apps/launcher/src/main/iveo-abgleich-kern.ts`:
  - Die Signatur nimmt Kennung und Merker auf.
  - Abruffehler nach 6.2 in Listen-Abfrage, Tagesübersicht, Agenda-Abfrage und beim Umschalten auf ein Side Event.
  - `owner` kommt dann aus der Datei.
- `apps/launcher/test/iveo-abgleich.test.ts`: SP9 (`ANA.id = 'sp1'`) und 9.2 Nr. 1–7 und 9. Der nachgebaute `getEventSnapshot` meldet `onSubError('speakers', …)`.
- `apps/launcher/test/show-speichern.test.ts`: SP10 und 9.2 Nr. 8 (Kennung und Merker überstehen Laden und Speichern).
- `apps/titler/src/main/iveo-show.ts`: ohne Electron. `iveoDataDir(userData)`, `speakersTsvText` mit `@kennung`, `writeSpeakersTsv(dir, speakers)`.
- `apps/titler/src/main/datalink.ts`: liest und beobachtet nur noch Ordner, führt die Dateien zusammen und ruft den Kern. Dazu die 1-s-Uhr nach dem Ende der Sendung.
- `apps/titler/src/main/index.ts`:
  - Datenquelle und gemerkte Show; Übergang beim Start.
  - Deep-Link, RELOAD und Start über die Kachel; die Show schreibt `config.dataFolder` nie mehr.
  - IPC `titler:recallSchluessel` und `titler:zurueckZumOrdner`.
  - On-Air geht an den Kern, Status mit Hinweis und Quelle.
- `apps/titler/src/main/control-server.ts`: `recall_kennung=1` im STATE.
- `apps/titler/src/shared/types.ts`: `TitlerStatus` (`entries` mit `key`, `gehalten`, `hinweis`, `datenQuelle`) und `JmtitlerApi` (`recallSchluessel`, `zurueckZumEigenenOrdner`).
- `apps/titler/src/preload/index.ts`: die zwei neuen Brücken-Funktionen.
- `apps/titler/src/renderer/src/views/OperatorView.tsx`: Quellzeile, stehender Hinweis, „Kein Datenordner aktiv“ nach Datenquelle, Zähler, Knopf K1, iveo-Abschnitt nach Datenquelle, Schlüssel als React-Key, Klick über den Schlüssel.
- `apps/titler/src/renderer/src/views/RecallBoard.tsx`: Hinweis oben (H1/H5/H6), Karte B1, Schlüssel als React-Key, Klick über den Schlüssel.
- `apps/titler/package.json`: Skript `selftest`, devDependency `tsx`; Version 0.10.0 erst in B18.
- `package-lock.json`: `tsx` für den Titler (B8), die drei Versionen (B18).
- `.github/workflows/ci-checks.yml`: Schritt „Titler (DataLink-Schlüssel, Datenquelle)“ im Job `selftests`.
- `apps/rundown/src/shared/types.ts`: `RundownAction.speakerId`.
- `apps/rundown/src/shared/doc-format.ts`: `normAction` übernimmt `speakerId` (1–200 Zeichen).
- `apps/rundown/src/shared/zeilen.ts`: `istSpeakerAbruf`, `aktionAendern`, `loeseSpeakerZiel`, `titlerKannKennung`, `speakerChipArgs`, `speakerOptionen`, `speakerPatch`.
- `apps/rundown/src/main/index.ts`: `argsZumSenden` löst das Speaker-Ziel beim Senden auf.
- `apps/rundown/src/renderer/src/lib/doc.ts`: `updateAction` über `aktionAendern`.
- `apps/rundown/src/renderer/src/components/RowEditor.tsx`: Picker über die Kennung, Vorschau mit aktuellem Namen, Kommentar `:158-159` berichtigt.
- `apps/rundown/src/renderer/src/components/RundownList.tsx` und `apps/rundown/src/renderer/src/App.tsx`: Chip mit aktuellem Namen; `iveoSpeakers` wird durchgereicht.
- `apps/rundown/test/selftest.ts`: 9.4 Nr. 1–5 und Review Focus 3.
- `apps/rundown/test/e2e-teil2a.mjs`:
  - SP7 (Speaker mit `id`)
  - Abschnitt 9 als Prüfung, dazu 9b–9e
  - Titler-CDP auf 9335, `titler-config.json`
  - `show-zuletzt.json` beim Beiseitelegen
  - Schalter `E2E_TITLER_DIR` für die Gegenprobe
- `docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md`: Abschnitt 23 bekommt die Ergebnisse (B2).
- `docs/superpowers/plans/2026-10-02-master-link-teil2b-r1.md` (dieser Plan): Der Kopf-Absatz „Messergebnisse M1–M3“ bekommt die Entscheidungen (B2).
- `docs/jm-show.md`: Absatz „Grenzen“ (`:226-231`) bekommt den Titler-Absatz.
- `apps/launcher/package.json`, `apps/rundown/package.json`: Versionen (B18).
- `packages/suite-manifest/changelog.json`: je ein neuer erster Eintrag für `titler`, `launcher`, `rundown`.

**Durchreicher ohne Codeänderung** (Spec 5.2, 6.2). B3 prüft per Test, dass sie das Feld behalten:
- `apps/launcher/src/renderer/src/lib/show-speichern.ts` (`baueGespeicherteShow` übernimmt `...geladen` bzw. `aktuelleDatei.iveo`)
- `ShowEditorModal.tsx`
- `apps/launcher/src/shared/types.ts:240`
- `apps/launcher/src/main/iveo-sync.ts` (das Binden schreibt keinen Merker)
- `apps/rundown/src/main/index.ts:563`

**Nicht angefasst:** `packages/master-link`, `packages/app-runtime`, `packages/suite-control-protocol`, `packages/companion-jm-suite`, `apps/connect`, `packages/iveo/src/mapper.ts:369` (Cache-Metadaten).

## Bewusst nicht in diesem Plan

- Release 2 / Teil B (Spec 12–21: Protokoll `abo`/`stand`/`aenderung`, Verteiler, RELOAD nur an diesen Rechner, Side-Event-Liste auffrischen (Z3), app-runtime, Verbundmodus, Zwischenspeicher, Abnahme an zwei Rechnern). Er bekommt einen eigenen Plan, der erst nach dem Merge von Release 1 beginnt (Spec 26).
- Folgeaufgaben FA1–FA10 (Spec 24). Das Ergebnis von M2 wird nur für FA5 notiert, Release 1 enthält keinen Code dafür.
- Die 2a-Abnahme selbst: Sie ist kein Code und läuft im selben Termin; B18 verweist in der Abnahme-Datei darauf.
- Connect (SP8) bleibt bewusst ohne Kennung.

## Entscheidungen, wo die Spec schweigt (Owner bzw. Reviewer bitte bestätigen)

1. **A7 („Liste leer → unverändert“) gilt nur bei Quelle `show`/`frueher`** (`leerHalten`) **und nur im selben Ordner.** Wird der eigene Ordner leer gelesen, gilt die normale Tabelle (A2 auf Sendung, sonst A3). Sonst blieben nach dem Löschen der eigenen CSV veraltete Einträge stehen, und H3 („Die Show enthält gerade keine Speaker“) wäre dort falsch. Wechselt die Quelle auf einen leeren Ordner, bleibt die Liste der vorigen Quelle nicht stehen (B9 `neueListe`, B13 `rescan`).
2. **Gleicher Rang H3/H7:** H7 geht vor H3. Bei derselben Show ohne Speaker und mit Merker steht also H7.
3. **A10 ohne bisherigen Eintrag:** Gab es keinen aktiven oder gehaltenen Eintrag, kommt H5 statt H6, denn H6 braucht ein Label.
4. **Klick über einen Schlüssel, der nicht mehr in der Liste steht:** Das wirkt wie ein Abruf ohne Treffer mit `ref = Schlüssel`.
5. **H4 nur bei Datenquelle `show`.** Bei `ordner` ist eine nicht lesbare Show nur eine Logzeile. Der Text „Gemerkte Show nicht lesbar (⟨Grund⟩), eigener Ordner gilt.“ steht nicht in der Spec (dort nur „Logzeile“) und ist hier festgelegt.
6. **Agenda-Abfrage mit Merker:** Die verknüpften Speaker-IDs kommen auch aus dem Programm-Detail. Damit dafür kein zusätzlicher `getProgram`-Abruf nötig ist, merkt `SideKontext` die `detailSpeakerIds`.
7. **Statuszeile 6.3 „(seit ⟨hh:mm⟩)“:** Das Panel setzt sie aus `status.seit` zusammen (`apps/launcher/src/renderer/src/lib/iveo-status.ts:17`). Der Kern setzt `seit` deshalb auf `speakerVeraltetSeit` (neuer Parameter an `statusGestoert`). Der übergebene Text ist ohne Präfix: „Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand“.
8. **Umschalten auf ein Side Event mit gescheiterter Speakerliste:** Die Antwort bleibt wie heute; die Spec gibt nur für die Tagesübersicht einen Text vor.
9. **Label-Vergleich:** „Label exakt“ fasst wie die Brücke Leerraum zusammen (bisher nur Kleinschreibung). Das ist eine kleine Erweiterung.
10. **Ablauf eines nach A10 gehaltenen Eintrags:** Fällt er nach 1 s weg, gibt es keine zusätzliche Logzeile. Die A3/A4-Zeile wäre falsch, denn der Eintrag steht oft noch in der Liste.
11. **Messwerkzeug:** `packages/iveo/tools/messung-2b*.ts` wird eingecheckt, damit die Messung nachvollziehbar ist und FA5 sie wiederverwenden kann. Alternativ ließe es sich nur im Scratchpad halten.
12. **`iveo-show.ts` wird electron-frei**, damit der Selbsttest es ohne Electron laden kann.
13. **Rundown-Vorschau** im RowEditor zeigt für Speaker-Abrufe die Namensform (`loeseSpeakerZiel(…, false)`), unabhängig von der Fähigkeit des Titlers. Der Chip zeigt den aktuellen Namen.
14. **`TitlerStatus.hinweis` ist `{ art, text }` statt `hinweis?: string`** (Spec 7.4 nennt `string`). Das Board zeigt nur H1/H5/H6 und braucht dafür die Art; der Text bleibt wörtlich aus 7.8 (B13, B14). **Weicht von der Spec ab:** Der Owner bestätigt das vor B13 (Kopf, „Ausnahme“).
15. **Start über die gemerkte Show gilt als „dieselbe Show“** (B11, B13). `currentShowPath` steht ab dem Start auf der gemerkten Show. Spec 7.7 sagt nur „wie Deep-Link“; ohne diese Festlegung schaltete eine gemerkte Show, die beim Neustart gerade keine Speaker trägt, auf `ordner`, statt die Liste mit H3 zu halten (7.6).
16. **`parseTable` trimmt nur noch Zellen, nicht ganze Zeilen** (B8). Sonst verschiebt eine leere `@kennung` vorn in einer TSV alle Spalten.
17. **Rundown-Picker bei einem Speaker ohne Kennung** (B15): Trägt eine Aktion ohne `speakerId` genau den Namen eines Speakers ohne Kennung, steht dieser Speaker selbst ausgewählt statt der Zusatzoption „⟨Name⟩ · per Name (nicht gebunden)“. Sonst ließe er sich nie sichtbar auswählen (Bestands-Show vor dem Nachschreiben, oder M1 = nein).
18. **Durchgang Abschnitt 9** (B17): Alan wird per Name abgerufen (`TITLER RECALL Alan` statt `RECALL 3`), und der eingefügte Speaker heißt „Abel“ statt „Neu“ (Spec 9.6 sagt „wie heute“). So bleiben Prüfung und Gegenprobe gültig, auch wenn der Mapper nach M3 sortiert. **Weicht von der Spec ab:** Der Owner bestätigt das vor B17 (Kopf, „Ausnahme“).

Weitere kleine Festlegungen stehen in jeder Aufgabe unter „Abweichungen vom Gerüst“.

## Unklarheiten und Abhängigkeiten von außen

- **Entscheidungen 14 und 18 brauchen die Bestätigung des Owners**, weil sie bewusst von Spec 7.4 bzw. 9.6 abweichen (Kopf, „Ausnahme“). Am besten im selben Termin wie die Messung B2. Die steuernde Sitzung hält die Antwort im Aufgabenbericht von B2 fest: „Entscheidung 14 bestätigt: ja/nein“, „Entscheidung 18 bestätigt: ja/nein“.
- **M1–M3 brauchen den Owner** mit Token auf Prod. M2 (a) setzt eine Speaker-Verknüpfung am unveröffentlichten Test-Side-Event und nimmt sie zurück; das ist ein Owner-Schritt in der iveo-Weboberfläche. M1 (b) und der zweite Teil von M2 (b) gehen nur mit einem unveröffentlichten Test-Speaker, sonst bleiben sie offen (Risiko 10).
- **M1 = nein (Zweig B) ändert Testdaten:** SP9 behält `ANA` ohne `id`. In B17 entstehen die Speaker der Show-Dateien über `speakersToShowSpeakers`, also genau so, wie der Launcher sie schreibt; bei Zweig B ohne Kennung. Der Titler hält dann über Ersatz-Schlüssel.
- **Der Durchgang B17 berührt `%APPDATA%`** (Dev-Pfade von Rundown, Timer, Titler, `master-link.json`). Er legt sie beiseite und stellt sie wieder her. Er braucht `ELECTRON_EXE` und freie Ports.
  - Nach G11 braucht er die Freigabe der steuernden Sitzung bzw. des Owners. Ohne Freigabe hält die Ausführung in B17 an; B18 beginnt erst nach dem Commit von B17.
  - Die Gegenprobe braucht einen zweiten Worktree auf dem Tag `titler-v0.9.0` (vorhanden) mit eigenem `npm ci` und Build; das kostet einige Minuten und Plattenplatz.
- **`npm install -D tsx -w @jm/titler` ändert `package-lock.json`.** Die CI läuft mit `npm ci`, der Lockfile muss also mit eingecheckt werden. Danach in `git diff package-lock.json` prüfen, dass nichts Fremdes mitkommt.
- **`entry` im STATE trennt an Leerzeichen** (`parseSuiteState`). Die Prüfungen im Durchgang nutzen deshalb weiter Einwort-Namen. Das gehört nicht in R1.
- **Bildvergleich:** Die Vorschau animiert ein- und aus (450 ms). Gemessen wird wie in der Spec 1,5 s nach jeder Aktion. Bleibt der Hash bei `lowerthird` ohne Ticker nicht stabil, ist das ein Befund für den Bericht, kein Grund, die Prüfung aufzuweichen.
- **Zeilenangaben** für `e2e-teil2a.mjs` und `OperatorView.tsx` sind ungefähr; maßgeblich ist der Vorher-Text.

## Aufgaben

---

### Task 1: B1 · Messwerkzeug für M1–M3 (`@jm/iveo`), dazu `npm ci`

**Spec:** `docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md` Abschnitt 23 (Messaufgaben M1–M3) und 22 (Sicherheit: kein Token verlässt die Konsole).

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b` (Branch `feat/master-link-teil2b`, Stand `996f54e2b8`). Alle Pfade unten sind relativ dazu.

**Dateien:**
- Create: `packages/iveo/tools/messung-2b-kern.ts` (reine Auswertung: Form, Leerraum, Doppelte, Hashes, Abgleich mit dem Cache, Mengenvergleich zweier Abrufe)
- Create: `packages/iveo/tools/messung-2b.ts` (Lese-Werkzeug, das nur der Owner mit seinem Token startet)
- Modify: `packages/iveo/test/selftest.ts`
  - Import direkt nach Zeile 30 (`import { createShow, … } from '@jm/show';`)
  - neuer Block direkt vor Zeile 588 (`if (failed > 0) {`)

Zeilenangaben gelten für den Stand vor dieser Aufgabe. Maßgeblich ist immer der wortgleiche Vorher-Text.

Der Kern steht im iveo-Selbsttest, weil `@jm/iveo` dort schon gebündelt und geprüft wird (esbuild bündelt `tools/` mit). Testhilfe dort: `ok(cond: boolean, msg: string)`; sie druckt `ok   <msg>` bzw. `FAIL <msg>`, am Ende `ALLE TESTS OK` oder `<n> FEHLGESCHLAGEN` mit Exitcode 1.

**Interfaces:**
- Consumes (aus `packages/iveo/src`, unverändert):
  - `createIveoClient(opts: IveoClientOptions): IveoClient` mit `IveoClientOptions = { token: string; baseUrl?: string; … }`
  - `IveoClient.listSpeakers(event: string): Promise<IveoSpeaker[]>`
  - `IveoClient.listProgramsUpdatedSince(event: string, sinceIso: string): Promise<IveoProgram[]>`
  - `speakerName(s: IveoSpeaker): string`, `normalizeIveoBaseUrl(raw: string | undefined): string`, `class IveoApiError { status: number; code: string }`
- Produces (exakt so, B2 nutzt das Werkzeug):
  ```ts
  // packages/iveo/tools/messung-2b-kern.ts
  export type KennungsForm = 'uuid' | 'ziffern' | 'andere';
  export function kennungsForm(id: string): KennungsForm;
  export interface KennungsBericht {
    anzahl: number;
    formen: Record<KennungsForm, number>;
    mitLeerraum: number;
    doppelte: number;
    mengenHash: string;      // 16 Hex
    reihenfolgeHash: string; // 16 Hex
  }
  export function kennungsBericht(ids: string[]): KennungsBericht;
  export function vergleicheMengen(erste: string[], zweite: string[]): { nurErste: number; nurZweite: number; gleich: boolean };
  export function vergleicheMitCache(api: string[], cache: string[]): { nurApi: number; nurCache: number; gleich: boolean };
  export function leseKennungsListe(text: string): string[] | null; // JSON-Liste aus Texten, sonst null
  ```
  Aufruf durch den Owner: `node node_modules/tsx/dist/cli.mjs packages/iveo/tools/messung-2b.ts --event <slug> --base <url> <ids [datei]|cache|speaker|programme-seit|speaker-seit|vergleiche> …`. `ids <datei>` legt die Kennungen des Abrufs als JSON-Liste beim Owner ab, `vergleiche <datei1> <datei2>` zählt, welche Kennungen nur im ersten bzw. nur im zweiten Abruf stehen (B2, M1 a).

**Regeln für diese Aufgabe:**
- Kein Agent setzt oder liest `JMPS_IVEO_TOKEN`, kein Agent liest Dateien in `%APPDATA%` (G11). Das Werkzeug wird hier nur ohne Token und gegen eine nicht erreichbare Adresse mit einem erfundenen Prüf-Token gestartet.
- Das Werkzeug gibt nie das Token, keine Bio, keine Fotos und keine Namen außer dem gesuchten Test-Speaker aus. Bei kaputtem JSON steht nur „kein gültiges JSON“ (G10).
- Dateien im Arbeitsbaum haben teils CRLF-Zeilenenden (`core.autocrlf=true`). Änderungen mit dem Edit-Werkzeug machen (Vorher-Text exakt ersetzen), nicht mit `sed`.
- Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel, nie pushen.

---

- [ ] **Step 1: Abhängigkeiten installieren** (Worktree-Wurzel)

Der Worktree hat noch keine `node_modules`. Im Bash-Werkzeug (Git Bash):
```
npm ci
```
Erwartet: endet mit `added … packages` und ohne Zeile `npm error`, Exitcode 0. Danach gibt es `node_modules/tsx/dist/cli.mjs` und `node_modules/esbuild`.

Scheitert dabei nur ein nativer Postinstall (etwa der Bau eines Moduls ohne passende Build-Werkzeuge), danach `npm ci --ignore-scripts` ausführen, wie die CI (`.github/workflows/ci-checks.yml:43`). Das reicht für alle Selbsttests und Typprüfungen dieses Plans. Den Fehler in den Aufgabenbericht schreiben. Ohne Postinstall fehlt `node_modules/electron/dist/electron.exe`; B17 Step 12 prüft das vor dem Durchgang und holt die Datei nach.

Ausgangslage prüfen:
```
npm run selftest -w @jm/iveo
```
Erwartet: keine Zeile mit `FAIL`, letzte Zeile `ALLE TESTS OK`, Exitcode 0.

- [ ] **Step 2: Fehlschlagenden Test schreiben** (`packages/iveo/test/selftest.ts`)

Ersetzung 1 (Zeile 30), Vorher:
```ts
import { createShow, hatEigeneTimerListe, normalizeAblauf, parseShow, serializeShow } from '@jm/show';
```
Nachher:
```ts
import { createShow, hatEigeneTimerListe, normalizeAblauf, parseShow, serializeShow } from '@jm/show';
import { kennungsBericht, kennungsForm, leseKennungsListe, vergleicheMengen, vergleicheMitCache } from '../tools/messung-2b-kern';
```

Ersetzung 2 (Zeilen 588–589), Vorher:
```ts
if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
```
Nachher:
```ts
// ── Messung M1/M3 (Teil 2b, Spec 23): Form, Leerraum, Doppelte, Hashes, Abgleich mit dem Launcher-Cache, zwei Abrufe ──
{
  ok(kennungsForm('3f2b8c1e-9a4d-4e2f-8b1a-0c6d5e4f3a21') === 'uuid', 'Messung: UUID erkannt');
  ok(kennungsForm('3F2B8C1E-9A4D-4E2F-8B1A-0C6D5E4F3A21') === 'uuid', 'Messung: UUID auch in Großbuchstaben');
  ok(kennungsForm('17') === 'ziffern', 'Messung: nur Ziffern');
  ok(kennungsForm('ab c') === 'andere', 'Messung: alles andere');
  ok(kennungsForm(' 17') === 'andere', 'Messung: Ziffern mit Leerraum zählen als andere');

  const b = kennungsBericht(['b', 'a', 'a', ' c']);
  ok(b.anzahl === 4 && b.doppelte === 1 && b.mitLeerraum === 1, 'Messung: Anzahl, Doppelte und Leerraum gezählt');
  ok(JSON.stringify(b.formen) === '{"uuid":0,"ziffern":0,"andere":4}', 'Messung: Formen gezählt');

  const ab = kennungsBericht(['a', 'b']);
  const ba = kennungsBericht(['b', 'a']);
  ok(ab.mengenHash === ba.mengenHash, 'Messung: mengenHash hängt nicht an der Reihenfolge');
  ok(ab.reihenfolgeHash !== ba.reihenfolgeHash, 'Messung: reihenfolgeHash hängt an der Reihenfolge');
  ok(
    ab.mengenHash === '7e18f737311b2dc3' && ba.reihenfolgeHash === 'c4a78e5bdf318c85',
    'Messung: Hash = erste 16 Hex-Zeichen von SHA-256 über die mit \\n verbundenen Kennungen',
  );
  ok(kennungsBericht(['a', 'c']).mengenHash !== ab.mengenHash, 'Messung: andere Menge → anderer mengenHash');

  ok(
    JSON.stringify(vergleicheMitCache(['a', 'b'], ['b', 'a'])) === '{"nurApi":0,"nurCache":0,"gleich":true}',
    'Messung: API und Cache gleich',
  );
  ok(
    JSON.stringify(vergleicheMitCache(['a', 'b', 'c'], ['a', 'b'])) === '{"nurApi":1,"nurCache":0,"gleich":false}',
    'Messung: eine Kennung nur in der API → nurApi 1',
  );
  ok(
    JSON.stringify(vergleicheMitCache(['a'], ['a', 'x'])) === '{"nurApi":0,"nurCache":1,"gleich":false}',
    'Messung: eine Kennung nur im Cache → nurCache 1',
  );

  // Zwei Abrufe im Abstand von 10 min (M1 a): ein neuer Speaker ist etwas anderes als eine gewechselte Kennung.
  ok(
    JSON.stringify(vergleicheMengen(['a', 'b', 'c'], ['b', 'c', 'd', 'e'])) === '{"nurErste":1,"nurZweite":2,"gleich":false}',
    'Messung: Mengenvergleich zählt, was nur im ersten und was nur im zweiten Abruf steht',
  );
  ok(
    JSON.stringify(vergleicheMengen(['b', 'a'], ['a', 'b'])) === '{"nurErste":0,"nurZweite":0,"gleich":true}',
    'Messung: gleiche Menge in anderer Reihenfolge → gleich',
  );
  ok(JSON.stringify(leseKennungsListe('["s-1","s 2"]')) === '["s-1","s 2"]', 'Messung: gespeicherte Kennungsliste wird gelesen');
  ok(
    leseKennungsListe('kaputt') === null && leseKennungsListe('{"a":1}') === null && leseKennungsListe('[1,2]') === null,
    'Messung: kein JSON, kein Array oder keine Texte → null',
  );
}

if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
```
Die beiden Hash-Werte sind `sha256("a\nb")` bzw. `sha256("b\na")`, je die ersten 16 Hex-Zeichen (nachgerechnet mit `node:crypto`).

- [ ] **Step 3: Test laufen lassen (rot)**

```
npm run selftest -w @jm/iveo
```
Erwartet: esbuild bricht beim Bündeln ab, der Test läuft gar nicht erst, npm meldet einen Fehler-Exitcode:
```
X [ERROR] Could not resolve "../tools/messung-2b-kern"
1 error
```

- [ ] **Step 4: Kern anlegen** (`packages/iveo/tools/messung-2b-kern.ts`)

Inhalt von `packages/iveo/tools/messung-2b-kern.ts`:
```ts
// ─────────────────────────────────────────────────────────────────────────────
// Messung M1/M3 (Master-Link Teil 2b, Spec 23): reine Auswertung der iveo-Speaker-Kennungen.
// Ohne Netz und ohne Token. Das Lese-Werkzeug messung-2b.ts nutzt sie, der iveo-Selbsttest prüft sie.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';

/** Form einer Kennung: UUID, nur Ziffern oder etwas anderes. */
export type KennungsForm = 'uuid' | 'ziffern' | 'andere';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUR_ZIFFERN = /^\d+$/;

export function kennungsForm(id: string): KennungsForm {
  if (UUID.test(id)) return 'uuid';
  if (NUR_ZIFFERN.test(id)) return 'ziffern';
  return 'andere';
}

export interface KennungsBericht {
  anzahl: number;
  formen: Record<KennungsForm, number>;
  /** Kennungen mit Leerraum (`/\s/`). Der Normalisierer in @jm/show würde sie kürzen. */
  mitLeerraum: number;
  /** Anzahl minus Anzahl verschiedener Kennungen. */
  doppelte: number;
  /** Erste 16 Hex-Zeichen von SHA-256 über die sortierten, mit `\n` verbundenen Kennungen: gleiche Menge? */
  mengenHash: string;
  /** Dasselbe in API-Reihenfolge: gleiche Reihenfolge? */
  reihenfolgeHash: string;
}

function hash16(kennungen: string[]): string {
  return createHash('sha256').update(kennungen.join('\n'), 'utf8').digest('hex').slice(0, 16);
}

export function kennungsBericht(ids: string[]): KennungsBericht {
  const formen: Record<KennungsForm, number> = { uuid: 0, ziffern: 0, andere: 0 };
  for (const id of ids) formen[kennungsForm(id)]++;
  return {
    anzahl: ids.length,
    formen,
    mitLeerraum: ids.filter((id) => /\s/.test(id)).length,
    doppelte: ids.length - new Set(ids).size,
    mengenHash: hash16([...ids].sort()),
    reihenfolgeHash: hash16(ids),
  };
}

/**
 * Mengen-Abgleich zweier Kennungslisten: wie viele Kennungen nur in der ersten bzw. nur in der zweiten stehen.
 * Für M1 (a) zeigt das den Unterschied zwischen „Speaker angelegt oder gelöscht“ und „Kennung gewechselt“.
 */
export function vergleicheMengen(erste: string[], zweite: string[]): { nurErste: number; nurZweite: number; gleich: boolean } {
  const inErster = new Set(erste);
  const inZweiter = new Set(zweite);
  const nurErste = [...inErster].filter((id) => !inZweiter.has(id)).length;
  const nurZweite = [...inZweiter].filter((id) => !inErster.has(id)).length;
  return { nurErste, nurZweite, gleich: nurErste === 0 && nurZweite === 0 };
}

/** Mengen-Abgleich API ↔ Launcher-Cache (`speakers[].id`): wie viele Kennungen nur auf einer Seite stehen. */
export function vergleicheMitCache(api: string[], cache: string[]): { nurApi: number; nurCache: number; gleich: boolean } {
  const v = vergleicheMengen(api, cache);
  return { nurApi: v.nurErste, nurCache: v.nurZweite, gleich: v.gleich };
}

/** Eine mit `ids <datei>` abgelegte Kennungsliste lesen: JSON-Liste aus Texten. Alles andere → null. */
export function leseKennungsListe(text: string): string[] | null {
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    return null;
  }
  return Array.isArray(roh) && roh.every((x) => typeof x === 'string') ? roh : null;
}
```

- [ ] **Step 5: Test laufen lassen (grün)**

```
npm run selftest -w @jm/iveo
```
Erwartet: keine Zeile mit `FAIL`, letzte Zeile `ALLE TESTS OK`, Exitcode 0. Unter anderem:
```
ok   Messung: UUID erkannt
ok   Messung: Anzahl, Doppelte und Leerraum gezählt
ok   Messung: Hash = erste 16 Hex-Zeichen von SHA-256 über die mit \n verbundenen Kennungen
ok   Messung: eine Kennung nur im Cache → nurCache 1
ok   Messung: Mengenvergleich zählt, was nur im ersten und was nur im zweiten Abruf steht
ok   Messung: kein JSON, kein Array oder keine Texte → null
```
(Unter Windows erscheint nach `ALLE TESTS OK` gelegentlich `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING) … async.c` von libuv beim Prozessende. Das ist harmlos, der Exitcode bleibt 0.)

- [ ] **Step 6: Lese-Werkzeug anlegen** (`packages/iveo/tools/messung-2b.ts`)

Inhalt von `packages/iveo/tools/messung-2b.ts`:
```ts
// ─────────────────────────────────────────────────────────────────────────────
// Lese-Werkzeug für die Messaufgaben M1–M3 (Master-Link Teil 2b, Spec 23).
//
// Startet NUR der Owner in seiner eigenen PowerShell im Worktree, mit dem iveo-Token in der Umgebung. Das Token
// an der Eingabeaufforderung eingeben, dann steht es weder in der Befehlszeile noch im Verlauf:
//   $s = Read-Host 'iveo-Token' -AsSecureString
//   $env:JMPS_IVEO_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
//   node node_modules/tsx/dist/cli.mjs packages/iveo/tools/messung-2b.ts --event <slug> --base <url> <befehl> …
// Befehle:
//   ids [datei]                  Anzahl, Formen, Leerraum, Doppelte und Hashes der Speaker-Kennungen (M1 a, M3);
//                                mit [datei] legt es die Kennungen zusätzlich als JSON-Liste dort ab (für vergleiche)
//   vergleiche <datei1> <datei2> zwei mit ids abgelegte Listen: wie viele Kennungen nur in der ersten bzw. nur in der
//                                zweiten stehen (M1 a). Liest nur die beiden Dateien, ruft iveo nicht ab.
//   cache <pfad>                 Kennungen der iveo-Cache-Datei des Launchers gegen die API (M1 a)
//   speaker <name>               id, updated_at und title des Speakers mit genau diesem Anzeigenamen (M1 b)
//   programme-seit <iso> [id]    Programme mit updated_since; ist das Programm dabei? (M2 a)
//   speaker-seit <iso> [name]    /speakers mit updated_since, roh; Status, Anzahl, ist der Speaker dabei? (M2 b)
// Wie alle Befehle startet auch vergleiche nur mit gesetztem JMPS_IVEO_TOKEN; also vor dem Entfernen des Tokens aufrufen.
//
// Liest nur. Ausgegeben werden Zahlen, Hashes, Kennungen und HTTP-Status: nie das Token, keine Bio, keine Fotos,
// keine Namen außer dem gesuchten Test-Speaker und nie Antwortinhalte aus Fehlern. Die mit ids abgelegte Datei
// enthält nur Kennungen; sie bleibt beim Owner und wird nie eingecheckt.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync } from 'node:fs';
import { IveoApiError, createIveoClient, normalizeIveoBaseUrl, speakerName, type IveoSpeaker } from '../src/index';
import { kennungsBericht, leseKennungsListe, vergleicheMengen, vergleicheMitCache } from './messung-2b-kern';

const NUTZUNG =
  'Aufruf: node node_modules/tsx/dist/cli.mjs packages/iveo/tools/messung-2b.ts --event <slug> --base <url> ' +
  '<ids [datei] | vergleiche <datei1> <datei2> | cache <pfad> | speaker <name> | programme-seit <iso> [programmId] | speaker-seit <iso> [name]>';

function abbruch(text: string, code: number): never {
  console.error(text);
  process.exit(code);
}

const token = (process.env.JMPS_IVEO_TOKEN ?? '').trim();
if (!token) abbruch('JMPS_IVEO_TOKEN fehlt (nur in der Owner-Konsole setzen).', 2);

// Optionen --event und --base, danach der Befehl und seine Argumente.
let event = '';
let base = '';
const rest: string[] = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--event') event = (argv[++i] ?? '').trim();
  else if (argv[i] === '--base') base = (argv[++i] ?? '').trim();
  else rest.push(argv[i]);
}
const [befehl, arg1, arg2] = rest;
if (!event || !base || !befehl) abbruch(NUTZUNG, 2);

const client = createIveoClient({ token, baseUrl: base });
const jaNein = (b: boolean): string => (b ? 'ja' : 'nein');

/** Kennungen aus einer API-Antwort; eine fehlende oder leere Kennung zählt als „(ohne)“. */
function kennungen(speakers: Array<{ id?: unknown }>): string[] {
  return speakers.map((s) => (typeof s?.id === 'string' && s.id ? s.id : '(ohne)'));
}

function zeitOderAbbruch(iso: string | undefined): string {
  if (!iso || Number.isNaN(Date.parse(iso))) abbruch(`Zeitpunkt nicht lesbar: ${iso ?? '(fehlt)'} (Beispiel 2026-10-02T08:00:00Z)`, 2);
  return iso;
}

async function ids(datei: string | undefined): Promise<void> {
  const liste = kennungen(await client.listSpeakers(event));
  const b = kennungsBericht(liste);
  console.log(`Anzahl: ${b.anzahl}`);
  console.log(`Formen: uuid ${b.formen.uuid}, ziffern ${b.formen.ziffern}, andere ${b.formen.andere}`);
  console.log(`Mit Leerraum: ${b.mitLeerraum}`);
  console.log(`Doppelte: ${b.doppelte}`);
  console.log(`mengenHash: ${b.mengenHash}`);
  console.log(`reihenfolgeHash: ${b.reihenfolgeHash}`);
  if (datei) {
    // Nur die Kennungen, in API-Reihenfolge; keine Namen. Für den Vergleich zweier Abrufe (vergleiche).
    writeFileSync(datei, JSON.stringify(liste), 'utf8');
    console.log(`Kennungen abgelegt: ${liste.length}`);
  }
}

/** Zwei mit `ids <datei>` abgelegte Listen vergleichen (M1 a). Liest nur die beiden Dateien, kein Netz. */
function vergleiche(datei1: string | undefined, datei2: string | undefined): void {
  if (!datei1 || !datei2) abbruch(NUTZUNG, 2);
  const lies = (pfad: string): string[] => {
    let text: string;
    try {
      text = readFileSync(pfad, 'utf8');
    } catch (e) {
      // Nie Dateiinhalt ausgeben, nur den Fehlercode.
      abbruch(`Kennungsdatei nicht lesbar: ${(e as { code?: string }).code ?? 'unbekannt'}`, 2);
    }
    const liste = leseKennungsListe(text);
    if (!liste) abbruch('Kennungsdatei ohne Kennungsliste (kein gültiges JSON oder keine Liste aus Texten).', 2);
    return liste;
  };
  const v = vergleicheMengen(lies(datei1), lies(datei2));
  console.log(`nurErste: ${v.nurErste}`);
  console.log(`nurZweite: ${v.nurZweite}`);
  console.log(`gleich: ${jaNein(v.gleich)}`);
}

async function cache(pfad: string | undefined): Promise<void> {
  if (!pfad) abbruch(NUTZUNG, 2);
  let roh: unknown;
  try {
    roh = JSON.parse(readFileSync(pfad, 'utf8'));
  } catch (e) {
    // Nie Dateiinhalt ausgeben: bei kaputtem JSON nur „kein gültiges JSON“, sonst nur der Fehlercode.
    const grund = e instanceof SyntaxError ? 'kein gültiges JSON' : ((e as { code?: string }).code ?? 'unbekannt');
    abbruch(`Cache-Datei nicht lesbar: ${grund}`, 2);
  }
  const liste = (roh as { speakers?: unknown } | null)?.speakers;
  if (!Array.isArray(liste)) abbruch('Cache-Datei ohne Speaker-Liste (speakers[]).', 2);
  const v = vergleicheMitCache(kennungen(await client.listSpeakers(event)), kennungen(liste));
  console.log(`nurApi: ${v.nurApi}`);
  console.log(`nurCache: ${v.nurCache}`);
  console.log(`gleich: ${jaNein(v.gleich)}`);
}

async function speaker(name: string | undefined): Promise<void> {
  if (!name) abbruch(NUTZUNG, 2);
  const treffer = (await client.listSpeakers(event)).filter((s) => speakerName(s) === name);
  console.log(`Treffer: ${treffer.length}`);
  for (const s of treffer) {
    console.log(`id: ${s.id}`);
    console.log(`updated_at: ${s.updated_at ?? '(fehlt)'}`);
    console.log(`title: ${s.title ?? '(leer)'}`);
  }
}

async function programmeSeit(iso: string | undefined, programmId: string | undefined): Promise<void> {
  const seit = zeitOderAbbruch(iso);
  const programme = await client.listProgramsUpdatedSince(event, seit);
  console.log(`Anzahl: ${programme.length}`);
  if (programmId) console.log(`Programm ${programmId} dabei: ${jaNein(programme.some((p) => p.id === programmId))}`);
}

/** Roher Abruf, weil der Client /speakers nicht mit updated_since kennt (M2 b). Folgt dem Cursor über alle Seiten. */
async function speakerSeit(iso: string | undefined, name: string | undefined): Promise<void> {
  const seit = zeitOderAbbruch(iso);
  const url =
    `${normalizeIveoBaseUrl(base)}/events/${encodeURIComponent(event)}/speakers` +
    `?limit=200&updated_since=${encodeURIComponent(seit)}`;
  const kopf = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const alle: IveoSpeaker[] = [];
  let cursor: string | null = null;
  for (let seite = 0; seite < 50; seite++) {
    const res = await fetch(cursor ? `${url}&cursor=${encodeURIComponent(cursor)}` : url, { headers: kopf });
    if (seite === 0 || !res.ok) console.log(`HTTP-Status${seite ? ` (Seite ${seite + 1})` : ''}: ${res.status}`);
    if (!res.ok) {
      const fehler = (await res.json().catch(() => null)) as { errors?: Array<{ code?: string }> } | null;
      console.log(`Fehlercode: ${fehler?.errors?.[0]?.code ?? '(keiner)'}`);
      return;
    }
    const antwort = (await res.json()) as { data?: IveoSpeaker[]; meta?: { pagination?: { next_cursor?: string | null } } };
    if (Array.isArray(antwort.data)) alle.push(...antwort.data);
    cursor = antwort.meta?.pagination?.next_cursor ?? null;
    if (!cursor) break;
  }
  console.log(`Anzahl: ${alle.length}`);
  if (name) console.log(`${name} dabei: ${jaNein(alle.some((s) => speakerName(s) === name))}`);
}

try {
  switch (befehl) {
    case 'ids':
      await ids(arg1);
      break;
    case 'vergleiche':
      vergleiche(arg1, arg2);
      break;
    case 'cache':
      await cache(arg1);
      break;
    case 'speaker':
      await speaker(arg1);
      break;
    case 'programme-seit':
      await programmeSeit(arg1, arg2);
      break;
    case 'speaker-seit':
      await speakerSeit(arg1, arg2);
      break;
    default:
      abbruch(NUTZUNG, 2);
  }
} catch (e) {
  // Nie Antwortinhalte: IveoApiError nur mit Status und Code, kaputtes JSON nur als „kein gültiges JSON“.
  const grund =
    e instanceof IveoApiError
      ? `HTTP ${e.status} ${e.code}`
      : e instanceof SyntaxError
        ? 'kein gültiges JSON'
        : (e as Error)?.message || String(e);
  abbruch(`Abbruch: ${grund}`, 1);
}
```

- [ ] **Step 7: Werkzeug ohne echtes Token prüfen** (Bash-Werkzeug, Worktree-Wurzel)

Ohne Token bricht es ab, bevor es irgendetwas abruft:
```
env -u JMPS_IVEO_TOKEN node node_modules/tsx/dist/cli.mjs packages/iveo/tools/messung-2b.ts --event cop31 --base https://iveo.test/api/v1 ids; echo "Exit=$?"
```
Erwartet genau:
```
JMPS_IVEO_TOKEN fehlt (nur in der Owner-Konsole setzen).
Exit=2
```

Mit einem erfundenen Prüf-Token, aber ohne Befehl, kommt die Nutzungszeile:
```
JMPS_IVEO_TOKEN=iveo_live_PRUEFTOKEN node node_modules/tsx/dist/cli.mjs packages/iveo/tools/messung-2b.ts --event cop31 --base https://iveo.test/api/v1; echo "Exit=$?"
```
Erwartet: eine Zeile, die mit `Aufruf: node node_modules/tsx/dist/cli.mjs packages/iveo/tools/messung-2b.ts --event <slug> --base <url>` beginnt, dann `Exit=2`.

Gegen eine Adresse, an der niemand lauscht (Port 9), mit demselben erfundenen Token. Das dauert wegen der drei Wiederholungen des Clients etwa 4 s:
```
JMPS_IVEO_TOKEN=iveo_live_PRUEFTOKEN node node_modules/tsx/dist/cli.mjs packages/iveo/tools/messung-2b.ts --event cop31 --base http://127.0.0.1:9/api/v1 ids > messung-probe.txt 2>&1; echo "Exit=$?"; cat messung-probe.txt; grep -c PRUEFTOKEN messung-probe.txt; rm messung-probe.txt
```
Erwartet:
```
Exit=1
Abbruch: fetch failed
0
```
Die `0` zeigt: das Token steht nirgends in der Ausgabe. Die Probedatei wird gleich wieder gelöscht und nie eingecheckt.

`vergleiche` liest nur zwei Dateien und ruft iveo nicht ab. Geprüft mit zwei erfundenen Listen in einem Temp-Ordner, gegen dieselbe tote Adresse (die Antwort kommt sofort, ohne die Wiederholungen des Clients):
```
D=$(mktemp -d); echo '["s-1","s-2","s-3"]' > "$D/a.json"; echo '["s-2","s-3","s-4","s-5"]' > "$D/b.json"; echo 'kaputt' > "$D/c.json"
JMPS_IVEO_TOKEN=iveo_live_PRUEFTOKEN node node_modules/tsx/dist/cli.mjs packages/iveo/tools/messung-2b.ts --event cop31 --base http://127.0.0.1:9/api/v1 vergleiche "$D/a.json" "$D/b.json"; echo "Exit=$?"
JMPS_IVEO_TOKEN=iveo_live_PRUEFTOKEN node node_modules/tsx/dist/cli.mjs packages/iveo/tools/messung-2b.ts --event cop31 --base http://127.0.0.1:9/api/v1 vergleiche "$D/a.json" "$D/c.json"; echo "Exit=$?"
rm -rf "$D"
```
Erwartet genau:
```
nurErste: 1
nurZweite: 2
gleich: nein
Exit=0
Kennungsdatei ohne Kennungsliste (kein gültiges JSON oder keine Liste aus Texten).
Exit=2
```

Typprüfung des Werkzeugs (es liegt in keiner `tsconfig`, deshalb einmal direkt):
```
node node_modules/typescript/bin/tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --types node --skipLibCheck packages/iveo/tools/messung-2b.ts
```
Erwartet: keine Ausgabe, Exitcode 0.

- [ ] **Step 8: Commit** (Bash-Werkzeug; Commit-Text bewusst ohne Umlaute)

```
git add packages/iveo/tools/messung-2b-kern.ts packages/iveo/tools/messung-2b.ts packages/iveo/test/selftest.ts
git status --short
```
Erwartet genau:
```
M  packages/iveo/test/selftest.ts
A  packages/iveo/tools/messung-2b-kern.ts
A  packages/iveo/tools/messung-2b.ts
```
(Die Bündeldatei `packages/iveo/test/selftest.bundle.mjs` ist per `packages/iveo/.gitignore` ausgeschlossen. `node_modules` ist ignoriert.) Dann:
```
git commit -m "feat(iveo): Messwerkzeug fuer M1-M3 (Teil 2b, Spec 23)" -m "messung-2b-kern.ts wertet Speaker-Kennungen aus: Form (UUID, Ziffern, andere), Leerraum, Doppelte, Mengen- und Reihenfolge-Hash, Abgleich mit dem Launcher-Cache, Mengenvergleich zweier Abrufe. messung-2b.ts ist das Lese-Werkzeug fuer den Owner; das Token kommt nur aus JMPS_IVEO_TOKEN seiner Konsole und wird nie ausgegeben. ids kann die Kennungen beim Owner ablegen, vergleiche zaehlt, welche nur im ersten bzw. nur im zweiten Abruf stehen." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- `--base` ist Pflicht, nicht wahlweise. Ohne Angabe nähme der Client die Staging-Adresse als Standard; gemessen werden muss aber Prod (Spec 23).
- Der Befehl `speaker` druckt zusätzlich `Treffer: <n>`. Kommt der Anzeigename doppelt vor, sieht der Owner das, statt stillschweigend nur den ersten Speaker zu bekommen.
- `speaker-seit` folgt dem Cursor über alle Seiten, damit „Anzahl“ die ganze gefilterte Menge zählt und nicht nur die ersten 200.
- Eine fehlende oder leere Kennung in der API-Antwort zählt als `(ohne)` (Form `andere`). So sieht die Messung auch Speaker ohne Kennung.
- `ids <datei>` und `vergleiche` (nach der Prüfung ergänzt): Zwei Hashes zeigen nur „gleich“ oder „nicht gleich“. Kommt in den 10 min zwischen den Abrufen ein Speaker dazu, wäre ein anderer `mengenHash` von gewechselten Kennungen nicht zu unterscheiden. `vergleiche` zählt deshalb, was nur im ersten und was nur im zweiten Abruf steht. B2 wertet das gegen die Zahl der angelegten und gelöschten Speaker aus. `vergleicheMitCache` nutzt dieselbe Mengenregel (`vergleicheMengen`).
- Step 1 nennt `npm ci --ignore-scripts` als Ausweg, falls nur ein nativer Postinstall scheitert. Die Selbsttests und Typprüfungen brauchen die Postinstalls nicht (wie in der CI). Nur der Durchgang braucht `electron.exe`; B17 Step 12 prüft das und holt die Datei nach.

---

### Task 2: B2 · Messung M1–M3 durchführen und in Spec 23 und den Plan eintragen (Owner-Schritte, kein Produktcode)

**Spec:** `docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md` Abschnitt 23 (Messaufgaben), 25 Risiko 10, 24 FA5, 5.1 und 8.3 (Kennung mit Leerraum).

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b` (Branch `feat/master-link-teil2b`). Alle Pfade unten sind relativ dazu.

**Dateien:**
- Modify: `docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md`, Abschnitt 23: neue Unterüberschrift „Ergebnisse“ nach Zeile 1263 („Release 2 braucht keine weitere Messung vorab. …“). Die Datei hat LF-Zeilenenden.
- Modify: `docs/superpowers/plans/2026-10-02-master-link-teil2b-r1.md` (dieser Plan), Kopf, Absatz „Messergebnisse M1–M3“: die Zeile `- Stand: noch nicht gemessen.` wird durch die Entscheidungen ersetzt (Spec 23: „Die Ergebnisse kommen in diese Spec und in den Plan.“).

**Interfaces:**
- Consumes: das Lese-Werkzeug aus B1, `node node_modules/tsx/dist/cli.mjs packages/iveo/tools/messung-2b.ts --event <slug> --base <url> <befehl> …` mit den Befehlen `ids [datei]`, `vergleiche <datei1> <datei2>`, `cache <pfad>`, `speaker <name>`, `programme-seit <iso> [programmId]`, `speaker-seit <iso> [name]`.
- Produces (stehen danach in Spec 23, „Ergebnisse“, und im Plan-Kopf unter „Messergebnisse M1–M3“; sie steuern die folgenden Aufgaben):
  - `M1 = ja|nein`: steuert B4 Zweig A/B und die Testdaten in B5 (`ANA` mit oder ohne `id: 'sp1'`).
  - `M3 = ja|nein`: steuert B4, Zusatz Sortierung.
  - `M2 = A|B`: nur Folgeaufgabe FA5, kein Code in Release 1.

**Wer was tut:**
- Gemessen wird an einem echten Prod-Event mit dem iveo-Token des Owners. Die Befehle mit Token startet **nur der Owner** in seiner eigenen PowerShell (G11). Der ausführende Agent liest kein Token, setzt kein `JMPS_IVEO_TOKEN`, liest nichts in `%APPDATA%`, öffnet die abgelegten Kennungsdateien nicht und startet keinen dieser Befehle selbst.
- Der Agent gibt dem Owner die Befehle aus diesen Schritten als Text, nimmt die Ausgaben entgegen und trägt sie ein.
- M1 (a), der erste Teil von M2 (b) und M3 lesen nur. M2 (a) setzt am **unveröffentlichten** Test-Side-Event eine Speaker-Verknüpfung und nimmt sie danach zurück. M1 (b) und der zweite Teil von M2 (b) bearbeiten nur einen **unveröffentlichten** Test-Speaker und nehmen die Änderung zurück. Gibt es keinen, entfallen sie (Spec 25, Risiko 10).

**In Spec und Plan kommen nur:** Zahlen, Hashes, HTTP-Status, Uhrzeiten, Ja/Nein und der Event-Slug. Nie ein Token, nie ein Pfad aus `%APPDATA%`, keine Speaker-Namen, keine einzelnen Kennungen.

**Regeln für diese Aufgabe:**
- Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel, nie pushen.
- Spec und Plan mit dem Edit-Werkzeug ändern (Vorher-Text exakt ersetzen).

---

- [ ] **Step 1: Owner-Konsole vorbereiten** (Owner, eigene PowerShell)

Der Agent gibt dem Owner diesen Block. Das Token tippt bzw. fügt der Owner an der Eingabeaufforderung ein; so steht es weder in der Befehlszeile noch im Verlauf der Konsole. Die zwei Werte in spitzen Klammern setzt nur der Owner ein:
```powershell
cd C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b
$s = Read-Host 'iveo-Token des Prod-Events' -AsSecureString
$env:JMPS_IVEO_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
Remove-Variable s
$base = '<Prod-Basis-URL wie im Launcher eingetragen, endet auf /api/v1>'
$ev = '<Event-Slug>'
function m { node node_modules/tsx/dist/cli.mjs packages/iveo/tools/messung-2b.ts --event $ev --base $base @args }
$ids1 = Join-Path $env:TEMP 'm1-ids-1.json'
$ids2 = Join-Path $env:TEMP 'm1-ids-2.json'
```
Der Owner meldet nur den Event-Slug zurück, nicht Token und Basis-URL. Die beiden Kennungsdateien liegen außerhalb des Worktrees, damit sie nie eingecheckt werden; Step 7 löscht sie wieder.

- [ ] **Step 2: M3 und erster Abruf für M1 (a)** (Owner)

Dreimal direkt nacheinander, ohne in iveo etwas zu ändern. Der erste Abruf legt seine Kennungen in `$ids1` ab:
```powershell
Get-Date -Format HH:mm; m ids $ids1; m ids; m ids
```
Erwartet je Aufruf sechs Zeilen, beim ersten zusätzlich `Kennungen abgelegt: <n>`:
```
Anzahl: <n>
Formen: uuid <n>, ziffern <n>, andere <n>
Mit Leerraum: <n>
Doppelte: <n>
mengenHash: <16 Hex>
reihenfolgeHash: <16 Hex>
```
Der Owner gibt alle drei Blöcke und die Uhrzeit weiter.

Auswertung durch den Agenten:
- **M3 = ja**, wenn `reihenfolgeHash` in allen drei Blöcken gleich ist, sonst **nein**.
- Der erste Block ist der erste Abruf für M1 (a).

- [ ] **Step 3: M2 (b), erster Teil** (Owner)

```powershell
m speaker-seit 2099-01-01T00:00:00Z
```
Erwartet: `HTTP-Status: <n>`, danach entweder `Anzahl: <n>` oder `Fehlercode: <code>`.

Auswertung:
- Status 200 und `Anzahl: 0`: iveo filtert **irgendwie**. Ob nach `updated_at`, zeigt Step 5.
- Status 400 oder 422: iveo kennt den Parameter nicht. **M2 = B.**
- Status 200 und `Anzahl` größer 0: iveo filtert nicht. **M2 = B.**

In allen drei Fällen geht es mit Step 4 weiter. M2 (a) wird immer gemessen und steht in der Ergebnistabelle (Spec 23, M2: „Das Ergebnis von (a) steht dabei.“).

- [ ] **Step 4: M2 (a), Owner-Schritt mit Schreibänderung in iveo** (Owner)

1. t0 notieren:
   ```powershell
   (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
   ```
2. In der iveo-Weboberfläche am **unveröffentlichten** Test-Side-Event einen Speaker verknüpfen. 1 min warten.
3. Abrufen, mit t0 aus Punkt 1 und der Programm-ID des Test-Side-Events:
   ```powershell
   m programme-seit <t0> <Programm-ID des Test-Side-Events>
   ```
   Erwartet: `Anzahl: <n>` und `Programm <id> dabei: ja|nein`.
4. Die Verknüpfung in iveo wieder zurücknehmen.

Auswertung: `dabei: ja` heißt, eine neue Speaker-Verknüpfung ändert das `updated_at` des Programms. Das ist nur eine Information für FA5 und ändert keinen Code in Release 1.

- [ ] **Step 5: M1 (b) und M2 (b), zweiter Teil** (Owner; nur mit einem unveröffentlichten Test-Speaker)

Gibt es keinen unveröffentlichten Test-Speaker, entfällt dieser Schritt. Dann gilt M1 (b) = offen und, falls Step 3 „filtert irgendwie“ ergab, vorsichtig **M2 = B** (Spec 23).

1. Vorher lesen und t0 notieren (Name genau wie in iveo angezeigt, mit Anrede):
   ```powershell
   m speaker "<Anzeigename des Test-Speakers>"; (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
   ```
   Erwartet: `Treffer: 1`, dann `id: …`, `updated_at: …`, `title: …`, danach die Uhrzeit t0.
2. In iveo beim Test-Speaker eine Kleinigkeit ändern, etwa die Funktion.
3. Nachher lesen und filtern:
   ```powershell
   m speaker "<Anzeigename des Test-Speakers>"
   m speaker-seit <t0> "<Anzeigename des Test-Speakers>"
   ```
4. Die Änderung in iveo zurücknehmen.

Auswertung:
- **M1 (b) = ja**, wenn `id:` vor und nach dem Bearbeiten gleich ist, sonst **nein**.
- **M2 = A**, wenn Step 3 „Status 200, Anzahl 0“ ergab, hier `… dabei: ja` steht und `Anzahl` kleiner ist als `Anzahl` aus Step 2. Sonst **M2 = B**.

- [ ] **Step 6: M1 (a), Abgleich mit dem Launcher-Cache** (Owner)

1. Im installierten Launcher eine neue, leere Show anlegen (etwa „Messung 2b“), im Show-Editor das Event wählen und „Ablauf übernehmen“ klicken. Das Binden schreibt den Cache (`apps/launcher/src/main/iveo-sync.ts:334`). Speichern ist dafür nicht nötig.
2. Die Cache-Datei liegt unter `<userData des Launchers>\iveo-cache\<Event-Slug>.json`. Sonderzeichen im Slug sind dort `_`. Den Pfad kennt nur der Owner. Direkt nach dem Binden:
   ```powershell
   m cache "<userData des Launchers>\iveo-cache\<Event-Slug>.json"
   ```
   Erwartet:
   ```
   nurApi: 0
   nurCache: 0
   gleich: ja
   ```

Auswertung: `gleich: ja` → der Cache passt. Steht `gleich: nein`, beide Punkte genau einmal wiederholen (erneut „Ablauf übernehmen“, dann sofort `m cache …`). Zwischen Binden und Abruf liegt so kaum Zeit, in der jemand in iveo Speaker anlegt oder löscht. Bleibt es bei `gleich: nein`, gilt der Cache-Abgleich als nicht bestanden.

- [ ] **Step 7: M1 (a), zweiter Abruf und Mengenvergleich** (Owner, mindestens 10 min nach Step 2)

```powershell
Get-Date -Format HH:mm; m ids $ids2
m vergleiche $ids1 $ids2
```
Erwartet: der Block aus Step 2 mit `Kennungen abgelegt: <n>`, danach:
```
nurErste: <n>
nurZweite: <n>
gleich: ja|nein
```
`nurErste` zählt Kennungen, die nur im ersten Abruf stehen (verschwunden), `nurZweite` solche, die nur im zweiten stehen (neu).

Steht `gleich: nein`, fragt der Agent den Owner: Wie viele Speaker wurden in iveo zwischen der Uhrzeit aus Step 2 und jetzt angelegt, wie viele gelöscht (eigene Änderungen und die von Kollegen, etwa laut Änderungsverlauf in iveo)? Der Owner nennt zwei Zahlen oder „nicht feststellbar“.

Danach die Kennungsdateien löschen und das Token aus der Konsole entfernen (`vergleiche` startet wie alle Befehle nur mit gesetztem Token, deshalb erst jetzt):
```powershell
Remove-Item $ids1, $ids2
Remove-Item Env:JMPS_IVEO_TOKEN
```

Auswertung durch den Agenten:
- **Menge gleich**, wenn `vergleiche` `gleich: ja` ergab. Oder wenn `nurZweite` genau der Zahl der angelegten und `nurErste` genau der Zahl der gelöschten Speaker entspricht. Dann erklären die Änderungen in iveo den Unterschied, und keine Kennung hat gewechselt. Passt das nicht oder ist es „nicht feststellbar“, ist die Menge **nicht gleich** (instabil).
- **M1 (a) = ja**, wenn
  - `Doppelte: 0` in beiden Abrufen steht,
  - die Menge gleich ist (Regel oben) und
  - Step 6 `gleich: ja` ergab.

  Sonst **nein**: Das ist „Instabil oder doppelt“ aus Spec 23.
- **Leerraum ist kein Grund für „nein“.** `Mit Leerraum` und die Formen werden nur notiert. Spec 5.1 kürzt Leerraum am Rand. Eine Kennung mit Leerraum in der Mitte sendet der Rundown in der Namensform (Spec 8.3). Reine Ziffern sind kein Hindernis (Spec 23).
- **M1 = ja**, wenn M1 (a) = ja und M1 (b) = ja oder offen. Sonst **M1 = nein**.

- [ ] **Step 8: Ergebnisse in Spec 23 eintragen** (`docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md`, nach Zeile 1263)

Vorher:
```markdown
Release 2 braucht keine weitere Messung vorab. Die Zeiten aus 20 (höchstens 3 s) misst die Abnahme.
```
Nachher (jede Stelle «…» durch den Wert aus dem genannten Schritt ersetzen; in der Spalte „Folge“ bleibt nur die zutreffende Fassung stehen):
```markdown
Release 2 braucht keine weitere Messung vorab. Die Zeiten aus 20 (höchstens 3 s) misst die Abnahme.

### Ergebnisse («Datum TT.MM.JJJJ»)

Gemessen vom Owner am Prod-Event `«Event-Slug»` mit `packages/iveo/tools/messung-2b.ts`. Das Token stand nur in seiner Konsole. Eingetragen sind nur Zahlen, Hashes, HTTP-Status und Ja/Nein.

| # | Messwert | Antwort | Folge |
| --- | --- | --- | --- |
| M1 (a) | `ids` um «Uhrzeit Step 2» und «Uhrzeit Step 7»: Anzahl «n» / «n»; Formen uuid «n», ziffern «n», andere «n»; mit Leerraum «n» / «n» (nur notiert, 5.1/8.3); Doppelte «n» / «n». `vergleiche`: nurErste «n», nurZweite «n»; laut Owner dazwischen angelegt «n», gelöscht «n» bzw. «nicht feststellbar». `cache` nach dem Binden: nurApi «n», nurCache «n», gleich: «ja/nein» («einmal/zweimal» gemessen) | «ja/nein» | siehe M1 |
| M1 (b) | Test-Speaker: `id` vor und nach dem Bearbeiten gleich: «ja/nein/offen, kein Test-Speaker» | «ja/nein/offen» | siehe M1 |
| M1 | (a) und (b) zusammen | «ja/nein» | ja: B4 Zweig A, der Mapper setzt `id`; B5 `ANA` mit `id: 'sp1'`. nein: B4 Zweig B, der Mapper lässt `id` weg; B5 `ANA` ohne `id` |
| M2 (a) | `programme-seit` ab «t0» nach dem Verknüpfen am Test-Side-Event: Anzahl «n», Programm dabei: «ja/nein» | «ja/nein» | Information für FA5 |
| M2 (b) | `speaker-seit 2099-01-01T00:00:00Z`: HTTP-Status «n», «Anzahl n bzw. Fehlercode». Test-Speaker ab «t0»: Anzahl «n», dabei: «ja/nein/offen» | «filtert nach updated_at / filtert nicht / offen» | FA5 Variante «A/B» |
| M3 | `ids` dreimal ohne Änderung: `reihenfolgeHash` dreimal gleich: «ja/nein» | «ja/nein» | ja: keine Sortierung. nein: B4 Zusatz Sortierung (Nachname, Vorname, Kennung) |

**Entscheidungen für den Plan von Release 1:** M1 = «ja/nein» → B4 «Zweig A/Zweig B». M3 = «ja/nein» → B4 «ohne/mit» Zusatz Sortierung. M2 → FA5 Variante «A/B», kein Code in Release 1.
```

Danach prüfen, dass keine «-Stelle übrig ist:
```
grep -c "«" docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md
```
Erwartet: `0`.

- [ ] **Step 9: Entscheidungen in den Plan-Kopf eintragen** (`docs/superpowers/plans/2026-10-02-master-link-teil2b-r1.md`, Absatz „Messergebnisse M1–M3“ im Kopf, Zeilen 53–54)

Der Vorher-Text steht im Kopf genau einmal. Hier ist er eingerückt zitiert, damit das Edit-Werkzeug nur den Kopf trifft; `old_string` und `new_string` also ohne die Einrückung übernehmen.

1. Vorher:
   ```markdown
   **Messergebnisse M1–M3:** Aufgabe B2 trägt sie in Spec 23 unter „Ergebnisse“ ein und hier (Spec 23: „Die Ergebnisse kommen in diese Spec und in den Plan.“). B4 wählt danach den Zweig im Mapper, B5 die Testdaten.
   - Stand: noch nicht gemessen.
   ```
2. Nachher (dieselben Werte wie in Step 8; in jeder «…»-Stelle bleibt nur die zutreffende Fassung):
   ```markdown
   **Messergebnisse M1–M3:** Aufgabe B2 trägt sie in Spec 23 unter „Ergebnisse“ ein und hier (Spec 23: „Die Ergebnisse kommen in diese Spec und in den Plan.“). B4 wählt danach den Zweig im Mapper, B5 die Testdaten.
   - Gemessen am «Datum TT.MM.JJJJ», Einzelwerte in Spec 23 unter „Ergebnisse“:
     - M1 = «ja/nein» → B4 «Zweig A/Zweig B», B5 `ANA` «mit/ohne» `id: 'sp1'`
     - M3 = «ja/nein» → B4 «ohne/mit» Zusatz Sortierung
     - M2 = «A/B» → nur FA5, kein Code in Release 1
   - Die anderen Zweige in B4, B5 und B17 bleiben im Plan stehen, gelten aber nicht.
   ```

Danach prüfen, dass im Kopf-Absatz keine «-Stelle übrig ist (die Vorlagen in dieser Aufgabe behalten ihre «…» bewusst):
```
sed -n '/^\*\*Messergebnisse M1–M3:\*\*/,/^\*\*Wie dieser Plan entstanden ist:\*\*/p' docs/superpowers/plans/2026-10-02-master-link-teil2b-r1.md | grep -c "«"
```
Erwartet: `0`.

- [ ] **Step 10: Diff prüfen** (Bash-Werkzeug)

```
git diff --stat
git diff -U0 -- docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md docs/superpowers/plans/2026-10-02-master-link-teil2b-r1.md | grep '^+' | grep -c "iveo_live_"
git diff -U0 -- docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md docs/superpowers/plans/2026-10-02-master-link-teil2b-r1.md | grep '^+' | grep -ci "appdata"
```
Erwartet:
- `git diff --stat` nennt nur `docs/superpowers/plans/2026-10-02-master-link-teil2b-r1.md` und `docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md`, etwa `2 files changed, 20 insertions(+), 1 deletion(-)`.
- Beide `grep -c`-Zeilen ergeben `0`. Sie lesen nur die hinzugefügten Zeilen, denn der Plan nennt `%APPDATA%` an vielen anderen Stellen.

Dann den Diff lesen (`git diff -- docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md docs/superpowers/plans/2026-10-02-master-link-teil2b-r1.md`): Kein Speaker-Name, keine einzelne Kennung, keine Basis-URL mit Zugangsdaten, kein Pfad.

- [ ] **Step 11: Commit** (Bash-Werkzeug; Commit-Text bewusst ohne Umlaute)

```
git add docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md docs/superpowers/plans/2026-10-02-master-link-teil2b-r1.md
git status --short
```
Erwartet genau:
```
M  docs/superpowers/plans/2026-10-02-master-link-teil2b-r1.md
M  docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md
```
Dann:
```
git commit -m "docs(master-link): Messung M1-M3 fuer Teil 2b" -m "Spec 23 bekommt die Ergebnisse: Form, Eindeutigkeit und Stabilitaet der iveo-Speaker-Kennungen (M1), Filter updated_since (M2), Reihenfolge der Speaker (M3), dazu die Entscheidungen fuer B4 und FA5. Der Plan-Kopf nennt dieselben Entscheidungen. Nur Zahlen, Hashes und Ja/Nein, kein Token, keine Namen." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git show --stat HEAD
```
Erwartet: `git show --stat HEAD` nennt genau die Spec-Datei und die Plan-Datei.

- [ ] **Step 12: Entscheidung an die Folgeaufgaben weitergeben**

Im Aufgabenbericht drei Zeilen, wörtlich so (mit den gemessenen Werten):
```
M1 = ja|nein → B4 Zweig A|B, B5 ANA mit|ohne id
M3 = ja|nein → B4 ohne|mit Zusatz Sortierung
M2 = A|B → nur FA5
```
Hat der Owner im selben Termin die Entscheidungen 14 und 18 beantwortet (Kopf, „Ausnahme“), dazu zwei Zeilen:
```
Entscheidung 14 bestätigt: ja|nein
Entscheidung 18 bestätigt: ja|nein
```

**Abweichungen vom Gerüst:**
- Die Reihenfolge der Owner-Schritte ist so gelegt, dass die drei `ids`-Abrufe für M3 zugleich den ersten Abruf für M1 (a) liefern und der zweite M1-Abruf am Ende mit mindestens 10 min Abstand kommt. Inhaltlich sind es dieselben Messungen wie in Spec 23.
- „Anzahl klein“ in M2 (b) ist hier festgelegt als „kleiner als die Gesamtzahl aus `ids`“, zusammen mit „Test-Speaker dabei: ja“.
- **M1 (a) nach der Prüfung berichtigt:** Gemessen wird an einem echten Prod-Event, und zwischen den Abrufen liegen mindestens 10 min. Ein anderer `mengenHash` allein hieße deshalb nicht „instabil“, denn es kann auch ein Speaker dazugekommen sein. `vergleiche` zählt die Unterschiede, der Owner nennt die Änderungen in iveo, und nur ein ungeklärter Unterschied gilt als instabil. Leerraum ist kein Abbruchgrund (Spec 5.1, 8.3), er wird nur notiert.
- **Step 3 führt immer zu Step 4:** M2 (a) wird in jedem Fall gemessen. Vorher sprang der Fall „filtert irgendwie“ an M2 (a) vorbei, gerade dort, wo Spec 23 das Ergebnis von (a) verlangt.
- **Ergebnisse auch im Plan (Step 9):** Spec 23 verlangt sie in Spec und Plan. Der Plan-Kopf nennt danach, welcher Zweig gilt.
- Commit-Text ohne Umlaute, wie im Repo üblich.

---

### Task 3: B3 · `@jm/show`: Speaker-Kennung, gemeinsame Doppelten-Regel `loeseDoppelteKennungenAuf`, Merker `speakerVeraltetSeit`

**Spec:** `docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md` Abschnitte 5.1 (Das Feld), 5.2 Zeilen SP1 und SP10, 6.2 („Merker in der Show“), 9.1 Nr. 1–3, 5, 6, 9.2 Nr. 8.

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b` (Branch `feat/master-link-teil2b`). Alle Pfade unten sind relativ dazu.

**Dateien:**
- Modify: `packages/show/src/index.ts`
  - Zeilen 72–77 (`export interface ShowIveoSpeaker`)
  - Zeilen 102–104 (`speakers?` in `ShowIveoBinding`, Merker direkt dahinter)
  - Zeile 152 (Kommentar zu `ABLAUF_ID_MAX`)
  - Zeilen 183–210 (`normalizeAblauf`, davor neu `loeseDoppelteKennungenAuf`)
  - Zeilen 237–245 (Speaker in `normalizeIveoBinding`, Merker danach)
- Test: `packages/iveo/test/selftest.ts`
  - Zeile 30 (Import aus `@jm/show`)
  - neuer Block direkt vor `if (failed > 0) {` (nach dem Messungs-Block aus B1)
- Test: `apps/launcher/test/show-speichern.test.ts`
  - Zeile 48 (`ROH.iveo.speakers`, dazu der Merker)
  - Zeilen 69–71 (Block „Laden und Speichern ohne Änderung“)

Zeilenangaben gelten für den Stand nach B1. Maßgeblich ist immer der wortgleiche Vorher-Text.

Die `@jm/show`-Fälle stehen im iveo-Selbsttest, weil `@jm/show` keinen eigenen Testlauf hat und esbuild es dort mitbündelt. Testhilfe dort: `ok(cond: boolean, msg: string)`. Im Launcher-Test heißt sie `ck(name: string, cond: boolean)` und druckt `  ok  <name>` bzw. `FAIL  <name>`, am Ende `<n> ok, <m> fehlgeschlagen.`

**Durchreicher ohne Codeänderung** (Spec 5.2, 6.2): `apps/launcher/src/renderer/src/lib/show-speichern.ts` (`baueGespeicherteShow` übernimmt `geladen.iveo` bzw. `aktuelleDatei.iveo`), `ShowEditorModal.tsx`, `apps/launcher/src/shared/types.ts:240`. Der Launcher-Test in Step 2 beweist, dass Kennung und Merker dort überleben.

**Interfaces:**
- Consumes: keine.
- Produces (exakt so, B4–B18 bauen darauf):
  ```ts
  // packages/show/src/index.ts
  export interface ShowIveoSpeaker { id?: string; name: string; title?: string }
  export interface ShowIveoBinding {
    /* event, baseUrl, name, syncedAt, speakers, */
    speakerVeraltetSeit?: string; // ISO UTC des ersten Fehlschlags
    /* sideEvents, filter */
  }
  /**
   * Erste behält ihre Kennung, jede weitere `<id>#n` mit der nächsten freien Nummer.
   * Alle vorhandenen Kennungen gelten vorab als belegt. Zusatz gekürzt auf 200 Zeichen.
   * Einträge ohne id bleiben unverändert. Neue Objekte entstehen nur für umbenannte;
   * die Eingabe wird nicht verändert.
   */
  export function loeseDoppelteKennungenAuf<T extends { id?: string }>(liste: T[]): T[];
  ```
  Der Normalisierer (`parseShow`, `serializeShow`, `migrateShow`) übernimmt `ShowIveoSpeaker.id`, wenn sie nach `trim()` 1–200 Zeichen lang ist (getrimmt, als erstes Feld), sonst entfällt das Feld und der Speaker bleibt. Doppelte über `loeseDoppelteKennungenAuf`. `speakerVeraltetSeit` bleibt, wenn es ein String ist und `!Number.isNaN(Date.parse(v))` gilt; es steht in der Bindung direkt nach `speakers`.

**Regeln für diese Aufgabe:**
- Nicht anfassen: `packages/master-link`, `packages/app-runtime`, `packages/suite-control-protocol`, `packages/companion-jm-suite`, `apps/connect` (G1).
- TDD: erst den Test rot sehen, dann Code.
- Dateien im Arbeitsbaum haben CRLF-Zeilenenden (`core.autocrlf=true`). Änderungen mit dem Edit-Werkzeug machen (Vorher-Text exakt ersetzen), nicht mit `sed`.
- Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel, nie pushen.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben, `@jm/show`-Teil** (`packages/iveo/test/selftest.ts`)

Ersetzung 1 (Zeile 30), Vorher:
```ts
import { createShow, hatEigeneTimerListe, normalizeAblauf, parseShow, serializeShow } from '@jm/show';
```
Nachher:
```ts
import { createShow, hatEigeneTimerListe, loeseDoppelteKennungenAuf, normalizeAblauf, parseShow, serializeShow } from '@jm/show';
```

Ersetzung 2 (direkt vor dem Ende der Datei), Vorher:
```ts
if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
```
Nachher:
```ts
// ── @jm/show: Speaker-Kennung, loeseDoppelteKennungenAuf, Merker speakerVeraltetSeit (Teil 2b, Spec 5.1, 6.2, 9.1) ──
{
  /** iveo-Bindung so, wie parseShow sie aus einer Datei liest. */
  const binde = (iveo: Record<string, unknown>) =>
    parseShow(JSON.stringify({ schemaVersion: 1, name: 'S', tools: [], iveo: { event: 'cop31', ...iveo } })).iveo;

  // 9.1 Nr. 1: Kennung getrimmt, als erstes Feld; 200 Zeichen bleiben; 201, Nicht-Strings und Leeres entfallen.
  ok(
    JSON.stringify(binde({ speakers: [{ name: 'Ada', id: '  sp-1  ' }] })?.speakers?.[0]) === '{"id":"sp-1","name":"Ada"}',
    '@jm/show: Speaker-Kennung getrimmt, als erstes Feld',
  );
  ok(
    JSON.stringify(binde({ speakers: [{ title: 'Admiral', name: 'Grace', id: 'sp-2' }] })?.speakers) ===
      '[{"id":"sp-2","name":"Grace","title":"Admiral"}]',
    '@jm/show: Feldreihenfolge des Speakers id, name, title',
  );
  ok(
    binde({ speakers: [{ id: 'k'.repeat(200), name: 'Grenze' }] })?.speakers?.[0].id === 'k'.repeat(200),
    '@jm/show: Speaker-Kennung mit 200 Zeichen bleibt',
  );
  const ungueltig =
    binde({
      speakers: [
        { id: 'k'.repeat(201), name: 'Zu lang' },
        { id: 42, name: 'Zahl' },
        { id: '   ', name: 'Leer' },
        { id: null, name: 'Null' },
      ],
    })?.speakers ?? [];
  ok(
    ungueltig.length === 4 && ungueltig.every((s) => !('id' in s)),
    '@jm/show: ungültige Speaker-Kennung entfällt, der Speaker bleibt',
  );

  // 9.1 Nr. 2: Doppelte → #2, #3; schon belegte Nummern werden übersprungen; der Zusatz bleibt in 200 Zeichen.
  const dreimal = binde({ speakers: [{ id: 'X', name: 'a' }, { id: 'X', name: 'b' }, { id: 'X', name: 'c' }] })?.speakers ?? [];
  ok(JSON.stringify(dreimal.map((s) => s.id)) === '["X","X#2","X#3"]', '@jm/show: doppelte Speaker-Kennung → #2, #3');
  const belegt = binde({ speakers: [{ id: 'X', name: 'a' }, { id: 'X', name: 'b' }, { id: 'X#2', name: 'c' }] })?.speakers ?? [];
  ok(JSON.stringify(belegt.map((s) => s.id)) === '["X","X#3","X#2"]', '@jm/show: belegte #2 → nächste freie Nummer (Speaker)');
  const lang = binde({ speakers: [{ id: 'k'.repeat(200), name: 'a' }, { id: 'k'.repeat(200), name: 'b' }] })?.speakers ?? [];
  ok(lang[1]?.id === 'k'.repeat(198) + '#2', '@jm/show: Zusatz #2 kürzt eine 200-Zeichen-Kennung (Speaker)');

  // Die gemeinsame Regel direkt: gleiche Ergebnisse, Eingabe unverändert, neue Objekte nur für umbenannte.
  const eingabe = [{ id: 'X', name: 'a' }, { name: 'ohne' }, { id: 'X', name: 'b' }, { id: 'X#2', name: 'c' }];
  const vorherText = JSON.stringify(eingabe);
  const aufgeloest = loeseDoppelteKennungenAuf(eingabe);
  ok(
    JSON.stringify(aufgeloest.map((s) => s.id ?? '-')) === '["X","-","X#3","X#2"]',
    'loeseDoppelteKennungenAuf: X, X, X#2 → X, X#3, X#2; ohne id bleibt ohne',
  );
  ok(JSON.stringify(eingabe) === vorherText && aufgeloest !== eingabe, 'loeseDoppelteKennungenAuf: verändert die Eingabe nicht');
  ok(
    aufgeloest[0] === eingabe[0] && aufgeloest[1] === eingabe[1] && aufgeloest[2] !== eingabe[2] && aufgeloest[3] === eingabe[3],
    'loeseDoppelteKennungenAuf: neue Objekte nur für umbenannte',
  );
  ok(loeseDoppelteKennungenAuf([]).length === 0, 'loeseDoppelteKennungenAuf: leere Liste → leere Liste');

  // 9.1 Nr. 3: serializeShow → parseShow behält die Kennung; ein Speaker ohne Kennung bleibt ohne.
  const rund = parseShow(
    serializeShow({
      ...createShow('Speaker'),
      iveo: { event: 'cop31', speakers: [{ id: 'sp-1', name: 'Ada', title: 'Moderation' }, { name: 'Ohne Kennung' }] },
    }),
  );
  ok(
    JSON.stringify(rund.iveo?.speakers) === '[{"id":"sp-1","name":"Ada","title":"Moderation"},{"name":"Ohne Kennung"}]',
    '@jm/show: Speaker-Kennung übersteht serializeShow → parseShow',
  );

  // 9.1 Nr. 6: Merker speakerVeraltetSeit — lesbare Zeit bleibt, Unlesbares entfällt, Rundreise und Platz nach speakers.
  const MERKER = '2026-10-02T08:00:00.000Z';
  ok(binde({ speakerVeraltetSeit: MERKER })?.speakerVeraltetSeit === MERKER, '@jm/show: lesbarer Merker bleibt');
  ok(!('speakerVeraltetSeit' in (binde({ speakerVeraltetSeit: 'gestern' }) ?? {})), '@jm/show: unlesbarer Merker entfällt');
  ok(!('speakerVeraltetSeit' in (binde({ speakerVeraltetSeit: 42 }) ?? {})), '@jm/show: Merker als Zahl entfällt');
  const mitMerker = parseShow(
    serializeShow({
      ...createShow('Merker'),
      iveo: {
        event: 'cop31',
        name: 'COP31',
        speakers: [{ id: 'sp-1', name: 'Ada' }],
        speakerVeraltetSeit: MERKER,
        sideEvents: [{ id: 'p1', title: 'A' }],
        filter: { day: '2026-11-10' },
      },
    }),
  );
  ok(mitMerker.iveo?.speakerVeraltetSeit === MERKER, '@jm/show: Merker übersteht serializeShow → parseShow');
  ok(
    JSON.stringify(Object.keys(mitMerker.iveo ?? {})) === '["event","name","speakers","speakerVeraltetSeit","sideEvents","filter"]',
    '@jm/show: Merker steht in der Bindung direkt nach speakers',
  );
  ok(!('speakerVeraltetSeit' in (binde({ speakers: [{ name: 'Ada' }] }) ?? {})), '@jm/show: ohne Merker kein Feld');
}

if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
```
9.1 Nr. 5 („die 2a-Fälle für `normalizeAblauf` laufen unverändert grün“) prüfen die bestehenden Blöcke „Kennung am Ablaufpunkt“ und „Kennungs-Durchlauf“. Sie bleiben, wie sie sind.

- [ ] **Step 2: Fehlschlagenden Test schreiben, Show-Editor** (`apps/launcher/test/show-speichern.test.ts`)

Ersetzung 1 (Zeile 48), Vorher:
```ts
    speakers: [{ name: 'Ada Lovelace', title: 'Moderation' }],
```
Nachher:
```ts
    speakers: [{ id: 'sp-ada', name: 'Ada Lovelace', title: 'Moderation' }],
    speakerVeraltetSeit: '2026-09-29T07:58:00.000Z',
```

Ersetzung 2 (Zeilen 69–71), Vorher:
```ts
  ck('Kennungen bleiben', ergebnis.ablauf?.map((a) => a.id).join(',') === 'aaaa-1,aaaa-2,aaaa-3');
  const ohneDatei = baueGespeicherteShow(geladen, formularAusShow(geladen), null, z.neueId);
  ck('… auch wenn die aktuelle Datei nicht lesbar ist', isDeepStrictEqual(ohneZeit(ohneDatei), ohneZeit(geladen)));
```
Nachher:
```ts
  ck('Kennungen bleiben', ergebnis.ablauf?.map((a) => a.id).join(',') === 'aaaa-1,aaaa-2,aaaa-3');
  // Teil 2b, 9.2 Nr. 8 (SP10): Speaker-Kennung und Merker „Speaker veraltet“ überstehen Laden und Speichern.
  ck('Speaker-Kennung bleibt (9.2 Nr. 8)', ergebnis.iveo?.speakers?.[0].id === 'sp-ada');
  ck('Merker „Speaker veraltet“ bleibt (9.2 Nr. 8)', ergebnis.iveo?.speakerVeraltetSeit === '2026-09-29T07:58:00.000Z');
  const ohneDatei = baueGespeicherteShow(geladen, formularAusShow(geladen), null, z.neueId);
  ck('… auch wenn die aktuelle Datei nicht lesbar ist', isDeepStrictEqual(ohneZeit(ohneDatei), ohneZeit(geladen)));
  ck('… Speaker-Kennung und Merker auch ohne lesbare Datei (9.2 Nr. 8)',
    ohneDatei.iveo?.speakers?.[0].id === 'sp-ada' && ohneDatei.iveo?.speakerVeraltetSeit === '2026-09-29T07:58:00.000Z');
```

- [ ] **Step 3: Tests laufen lassen (rot)**

```
npm run selftest -w @jm/iveo
```
Erwartet: esbuild bricht beim Bündeln ab, npm meldet einen Fehler-Exitcode:
```
X [ERROR] No matching export in "../show/src/index.ts" for import "loeseDoppelteKennungenAuf"
1 error
```

```
npm run selftest:iveo -w @jm/launcher
```
Erwartet: `iveo-abgleich.test.ts` (`140 ok, 0 fehlgeschlagen.`) und `iveo-huelle.test.ts` (`47 ok, 0 fehlgeschlagen.`) laufen grün durch. `show-speichern.test.ts` scheitert, danach bricht die Kette ab (Exitcode 1):
```
FAIL  Speaker-Kennung bleibt (9.2 Nr. 8)
FAIL  Merker „Speaker veraltet“ bleibt (9.2 Nr. 8)
FAIL  … Speaker-Kennung und Merker auch ohne lesbare Datei (9.2 Nr. 8)
72 ok, 3 fehlgeschlagen.
```

- [ ] **Step 4: `ShowIveoSpeaker` um `id` erweitern** (`packages/show/src/index.ts`, Zeilen 72–74)

Vorher:
```ts
export interface ShowIveoSpeaker {
  /** Anzeigename (Anrede + Vor- + Nachname). */
  name: string;
```
Nachher:
```ts
export interface ShowIveoSpeaker {
  /**
   * Speaker-Kennung (Teil 2b, Spec 5.1): die iveo-Speaker-ID. Optional, damit alte Shows weiter laden. Daran hält
   * der Titler seinen Eintrag (Spalte `@kennung`), und der Rundown-Picker speichert sie (`speakerId`).
   */
  id?: string;
  /** Anzeigename (Anrede + Vor- + Nachname). */
  name: string;
```

- [ ] **Step 5: Merker `speakerVeraltetSeit` in `ShowIveoBinding`** (`packages/show/src/index.ts`, Zeilen 102–104)

Vorher:
```ts
  speakers?: ShowIveoSpeaker[];
  /**
   * Side Events des Tages (#11), token-frei (id + Titel) — Grundlage fürs Live-
```
Nachher:
```ts
  speakers?: ShowIveoSpeaker[];
  /**
   * Merker „Speaker veraltet“ (Teil 2b, Spec 6.2): ISO-Zeit (UTC) des ersten Fehlschlags der iveo-Speakerliste.
   * Gesetzt, solange die Speaker aus einem früheren Stand stammen; der Titler zeigt daraus den Hinweis H7.
   * Setzen und Löschen schreibt nur der Launcher-Abgleich. Fehlt im Normalfall.
   */
  speakerVeraltetSeit?: string;
  /**
   * Side Events des Tages (#11), token-frei (id + Titel) — Grundlage fürs Live-
```

- [ ] **Step 6: `loeseDoppelteKennungenAuf` anlegen, `normalizeAblauf` nutzt sie** (`packages/show/src/index.ts`)

Ersetzung 1 (Zeile 152), Vorher:
```ts
/** Höchstlänge einer Kennung (Spec 3.1). Längere fallen beim Lesen weg. */
```
Nachher:
```ts
/** Höchstlänge einer Kennung (Teil 2a Spec 3.1; für Speaker Teil 2b Spec 5.1). Längere fallen beim Lesen weg. */
```

Ersetzung 2 (Zeilen 183–210), Vorher:
```ts
/**
 * Ablauf normalisieren (Teil 2a, Spec 3.1/3.5): je Punkt wie beim Lesen einer Show (ohne Titel
 * fällt er weg, `id` nur als String mit 1–200 Zeichen nach trim), danach doppelte Kennungen
 * über die ganze Liste auflösen. Der erste Punkt behält seine Kennung, jeder weitere bekommt
 * `<id>#2`, `#3` … — jeweils die nächste Nummer, die in der Liste noch frei ist. Kein Array → [].
 * `migrateShow` nutzt sie, also gilt das bei jedem `parseShow` und `serializeShow`.
 */
export function normalizeAblauf(value: unknown): ShowAblaufItem[] {
  if (!Array.isArray(value)) return [];
  const items = (value as unknown[])
    .map(normalizeAblaufItem)
    .filter((a): a is ShowAblaufItem => a !== null);
  // Alle vorhandenen Kennungen vorab als belegt, damit ein umbenannter Doppelter nie die
  // Kennung eines nachfolgenden Punkts übernimmt (z. B. X, X, X#2 → X, X#3, X#2).
  const belegt = new Set<string>();
  for (const it of items) if (it.id !== undefined) belegt.add(it.id);
  const gesehen = new Set<string>();
  return items.map((it) => {
    if (it.id === undefined) return it;
    if (!gesehen.has(it.id)) {
      gesehen.add(it.id);
      return it;
    }
    const id = freieKennung(it.id, belegt);
    belegt.add(id);
    return { ...it, id };
  });
}
```
Nachher:
```ts
/**
 * Doppelte Kennungen einer Liste auflösen (Teil 2a Spec 3.5, Teil 2b Spec 5.1) — die EINE Regel für Ablaufpunkte
 * und Speaker. Erste behält ihre Kennung, jede weitere `<id>#n` mit der nächsten freien Nummer.
 * Alle vorhandenen Kennungen gelten vorab als belegt. Zusatz gekürzt auf 200 Zeichen.
 * Einträge ohne id bleiben unverändert. Neue Objekte entstehen nur für umbenannte;
 * die Eingabe wird nicht verändert.
 */
export function loeseDoppelteKennungenAuf<T extends { id?: string }>(liste: T[]): T[] {
  // Alle vorhandenen Kennungen vorab als belegt, damit ein umbenannter Doppelter nie die
  // Kennung eines nachfolgenden Eintrags übernimmt (z. B. X, X, X#2 → X, X#3, X#2).
  const belegt = new Set<string>();
  for (const it of liste) if (it.id !== undefined) belegt.add(it.id);
  const gesehen = new Set<string>();
  return liste.map((it) => {
    if (it.id === undefined) return it;
    if (!gesehen.has(it.id)) {
      gesehen.add(it.id);
      return it;
    }
    const id = freieKennung(it.id, belegt);
    belegt.add(id);
    return { ...it, id };
  });
}

/**
 * Ablauf normalisieren (Teil 2a, Spec 3.1/3.5): je Punkt wie beim Lesen einer Show (ohne Titel
 * fällt er weg, `id` nur als String mit 1–200 Zeichen nach trim), danach doppelte Kennungen
 * über die ganze Liste auflösen (`loeseDoppelteKennungenAuf`): Der erste Punkt behält seine Kennung,
 * jeder weitere bekommt `<id>#2`, `#3` … — jeweils die nächste Nummer, die in der Liste noch frei ist.
 * Kein Array → []. `migrateShow` nutzt sie, also gilt das bei jedem `parseShow` und `serializeShow`.
 */
export function normalizeAblauf(value: unknown): ShowAblaufItem[] {
  if (!Array.isArray(value)) return [];
  const items = (value as unknown[])
    .map(normalizeAblaufItem)
    .filter((a): a is ShowAblaufItem => a !== null);
  return loeseDoppelteKennungenAuf(items);
}
```
Hinweis: `{ ...it, id }` behält die Feldreihenfolge, weil der Normalisierer `id` bei Ablaufpunkten und Speakern schon an die erste Stelle setzt.

- [ ] **Step 7: Normalisierer übernimmt Speaker-Kennung und Merker** (`packages/show/src/index.ts`, Zeilen 237–245)

Vorher:
```ts
        const name = typeof sp.name === 'string' ? sp.name.trim() : '';
        if (!name) return null;
        const speaker: ShowIveoSpeaker = { name };
        if (typeof sp.title === 'string' && sp.title.trim()) speaker.title = sp.title.trim();
        return speaker;
      })
      .filter((s): s is ShowIveoSpeaker => s !== null);
    if (speakers.length) binding.speakers = speakers;
  }
```
Nachher:
```ts
        const name = typeof sp.name === 'string' ? sp.name.trim() : '';
        if (!name) return null;
        // Kennung wie am Ablaufpunkt (Teil 2b, Spec 5.1): nur als String mit 1–200 Zeichen nach trim, sonst
        // entfällt das Feld (der Speaker bleibt). `id` steht vorn: feste Feldreihenfolge id, name, title.
        const id = typeof sp.id === 'string' ? sp.id.trim() : '';
        const speaker: ShowIveoSpeaker = id && id.length <= ABLAUF_ID_MAX ? { id, name } : { name };
        if (typeof sp.title === 'string' && sp.title.trim()) speaker.title = sp.title.trim();
        return speaker;
      })
      .filter((s): s is ShowIveoSpeaker => s !== null);
    // Doppelte Kennungen → #2, #3 … (dieselbe Regel wie im Ablauf).
    if (speakers.length) binding.speakers = loeseDoppelteKennungenAuf(speakers);
  }
  // Merker „Speaker veraltet“ (Teil 2b, Spec 6.2): nur eine Zeit, die Date.parse lesen kann, sonst entfällt er.
  // Er steht in der Bindung direkt nach `speakers`.
  if (typeof o.speakerVeraltetSeit === 'string' && !Number.isNaN(Date.parse(o.speakerVeraltetSeit))) {
    binding.speakerVeraltetSeit = o.speakerVeraltetSeit;
  }
```

- [ ] **Step 8: Tests laufen lassen (grün)**

```
npm run selftest -w @jm/iveo
```
Erwartet: keine Zeile mit `FAIL`, letzte Zeile `ALLE TESTS OK`, Exitcode 0. Unter anderem:
```
ok   @jm/show: id übernommen, getrimmt, als erstes Feld
ok   @jm/show: belegte #2 → nächste freie Nummer
ok   @jm/show: Speaker-Kennung getrimmt, als erstes Feld
ok   @jm/show: belegte #2 → nächste freie Nummer (Speaker)
ok   loeseDoppelteKennungenAuf: verändert die Eingabe nicht
ok   @jm/show: Merker steht in der Bindung direkt nach speakers
```
Die ersten beiden Zeilen sind 2a-Fälle (9.1 Nr. 5): `normalizeAblauf` verhält sich mit der gemeinsamen Regel unverändert.

```
npm run selftest:iveo -w @jm/launcher
```
Erwartet: vier Zusammenfassungen ohne Fehlschlag, Exitcode 0:
```
140 ok, 0 fehlgeschlagen.
47 ok, 0 fehlgeschlagen.
75 ok, 0 fehlgeschlagen.
6 ok, 0 fehlgeschlagen.
```

- [ ] **Step 9: Typecheck**

`@jm/show` hat kein eigenes `typecheck`-Skript. Deshalb die Verbraucher von `ShowIveoSpeaker` und `ShowIveoBinding`:
```
npm run typecheck -w @jm/launcher
npm run typecheck -w @jm/titler
npm run typecheck -w @jm/rundown
npm run typecheck -w @jm/timer
```
Erwartet: jeweils keine Fehlermeldung von `tsc`, Exitcode 0.

- [ ] **Step 10: Commit** (Bash-Werkzeug; Commit-Text bewusst ohne Umlaute)

```
git add packages/show/src/index.ts packages/iveo/test/selftest.ts apps/launcher/test/show-speichern.test.ts
git status --short
```
Erwartet genau:
```
M  apps/launcher/test/show-speichern.test.ts
M  packages/iveo/test/selftest.ts
M  packages/show/src/index.ts
```
Dann:
```
git commit -m "feat(show): Speaker-Kennung, loeseDoppelteKennungenAuf und Merker speakerVeraltetSeit (Teil 2b)" -m "ShowIveoSpeaker bekommt id (String, 1-200 Zeichen nach trim, als erstes Feld). loeseDoppelteKennungenAuf ist die eine Regel fuer doppelte Kennungen (#2, #3, naechste freie Nummer); normalizeAblauf und der Speaker-Normalisierer nutzen sie. ShowIveoBinding.speakerVeraltetSeit haelt den ersten Fehlschlag der iveo-Speakerliste und steht direkt nach speakers. Der Show-Editor reicht beides unveraendert durch (Test 9.2 Nr. 8)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Keine an den Schnittstellen. `freieKennung` und `ABLAUF_ID_MAX` bleiben modulintern; die 200-Zeichen-Grenze gilt für Speaker-Kennungen genauso (nur der Kommentar zu `ABLAUF_ID_MAX` nennt das jetzt).
- Typecheck zusätzlich für `@jm/timer`, weil der Timer `@jm/show` ebenfalls importiert.

---

### Task 4: B4 · `@jm/iveo` Mapper: Kennung durchreichen (SP2), Rückfälle aus M1/M3

**Spec:** `docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md` Abschnitte 5.2 Zeile SP2, 9.1 Nr. 4, 23 (Spalte „Wenn nein“ für M1 und M3).

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b` (Branch `feat/master-link-teil2b`). Alle Pfade unten sind relativ dazu.

**Dateien:**
- Modify: `packages/iveo/src/mapper.ts`
  - Zeilen 323–337 (`speakersToShowSpeakers` samt Kommentar)
  - nur bei M3 = nein: hinter `speakerName` (Zeilen 319–321) die Hilfe `sortiereSpeaker`
- Test: `packages/iveo/test/selftest.ts`
  - Block `snapshotToShowSpeakers` (Zeilen 356–362)
  - nur bei M3 = nein: neuer Block direkt vor `// ── getEventSnapshot resilient` (Zeile 364)

Zeilenangaben gelten für den Stand nach B3. Maßgeblich ist immer der wortgleiche Vorher-Text.

**Welcher Zweig gilt:** B2 hat die Entscheidung in Spec 23 unter „Ergebnisse“ und im Plan-Kopf unter „Messergebnisse M1–M3“ eingetragen. Diese Aufgabe schreibt alle Fassungen vollständig aus; umgesetzt wird nur, was dort steht:
- **[Zweig A]** M1 = ja (Standard): Der Mapper setzt `id`.
- **[Zweig B]** M1 = nein: Der Mapper lässt `id` weg, wie heute. Nur Test und Kommentar ändern sich.
- **[Sortierung]** nur M3 = nein: Zusätzlich sortiert der Mapper stabil nach Nachname, Vorname, Kennung (`localeCompare` mit `de`). Das gilt mit Zweig A und mit Zweig B.

**Interfaces:**
- Consumes: `ShowIveoSpeaker.id` (B3); M1 und M3 aus Spec 23, „Ergebnisse“ (B2); `kennungVon(raw: unknown): string | undefined` (modulintern in `mapper.ts:135`, aus 2a: trim, leer → `undefined`).
- Produces (exakt so, B5–B7 und der Launcher bauen darauf):
  ```ts
  export function speakersToShowSpeakers(speakers: IveoSpeaker[]): ShowIveoSpeaker[];
  // Zweig A: { id, name, title? } mit id als erstem Feld (getrimmte iveo-Speaker-ID; leere ID → kein id-Feld)
  // Zweig B: { name, title? } wie bisher
  // Sortierung: Ausgabe stabil nach Nachname, Vorname, Kennung
  ```
  `snapshotToShowSpeakers(snap)` ruft `speakersToShowSpeakers(snap.speakers)` und folgt damit ohne eigene Änderung.

**Regeln für diese Aufgabe:**
- Nicht anfassen: `packages/iveo/src/mapper.ts:369` (`buildShowMetadata`, Cache-Metadaten tragen `id` schon).
- TDD: erst den Test rot sehen, dann Code. Ausnahme Zweig B: dort ändert sich kein Verhalten; der Test hält die Entscheidung fest und ist sofort grün.
- Dateien im Arbeitsbaum haben CRLF-Zeilenenden. Änderungen mit dem Edit-Werkzeug machen (Vorher-Text exakt ersetzen), nicht mit `sed`.
- Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel, nie pushen.

---

- [ ] **Step 1: Entscheidung aus Spec 23 lesen**

```
grep -n "Entscheidungen für den Plan von Release 1" docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md
```
Erwartet: genau eine Zeile, etwa `**Entscheidungen für den Plan von Release 1:** M1 = ja → B4 Zweig A. M3 = ja → B4 ohne Zusatz Sortierung. …`. Fehlt die Zeile, ist B2 nicht erledigt: hier anhalten und melden.

Daraus folgt, welche der mit **[Zweig A]**, **[Zweig B]** und **[Sortierung]** markierten Ersetzungen unten gelten. Den gewählten Zweig in den Aufgabenbericht schreiben.

- [ ] **Step 2: Test schreiben** (`packages/iveo/test/selftest.ts`)

**[Zweig A]** (M1 = ja). Ersetzung 1 (Zeilen 356–362), Vorher:
```ts
// ── snapshotToShowSpeakers (Phase 3, Titler) ─────────────────────────────────
{
  const speakers = snapshotToShowSpeakers(snapshot);
  ok(speakers.length === 1 && speakers[0].name === 'Dr. Ana Ferreira', 'snapshotToShowSpeakers: Name');
  ok(speakers[0].title === 'Lead Negotiator', 'snapshotToShowSpeakers: Titel/Funktion');
  ok(!JSON.stringify(speakers).includes('GEHEIM-BIO'), 'snapshotToShowSpeakers: keine Bio (PII)');
}
```
Nachher:
```ts
// ── snapshotToShowSpeakers (Phase 3, Titler; Teil 2b SP2: mit Kennung, Spec 23 M1 = ja) ──────────
{
  const speakers = snapshotToShowSpeakers(snapshot);
  ok(speakers.length === 1 && speakers[0].name === 'Dr. Ana Ferreira', 'snapshotToShowSpeakers: Name');
  ok(speakers[0].title === 'Lead Negotiator', 'snapshotToShowSpeakers: Titel/Funktion');
  ok(!JSON.stringify(speakers).includes('GEHEIM-BIO'), 'snapshotToShowSpeakers: keine Bio (PII)');
  ok(speakers[0].id === 'sp1', 'speakersToShowSpeakers setzt id');
  ok(
    JSON.stringify(speakers[0]) === '{"id":"sp1","name":"Dr. Ana Ferreira","title":"Lead Negotiator"}',
    'speakersToShowSpeakers: id als erstes Feld, dann name und title',
  );
  ok(speakersToShowSpeakers([{ ...snapshot.speakers[0], id: ' sp9 ' }])[0].id === 'sp9', 'speakersToShowSpeakers: Kennung getrimmt');
  ok(!('id' in speakersToShowSpeakers([{ ...snapshot.speakers[0], id: '  ' }])[0]), 'speakersToShowSpeakers: leere ID → kein id-Feld');
  // Die Ausgabe übersteht Schreiben und Lesen unverändert. Sonst wiche die Launcher-Signatur nach jedem Snapshot ab.
  const rund = parseShow(serializeShow({ ...createShow('Speaker'), iveo: { event: 'cop30', speakers } }));
  ok(JSON.stringify(rund.iveo?.speakers) === JSON.stringify(speakers), 'speakersToShowSpeakers: Ausgabe ist ein Fixpunkt des Normalisierers');
}
```

**[Zweig B]** (M1 = nein). Ersetzung 1 (Zeilen 356–362), Vorher:
```ts
// ── snapshotToShowSpeakers (Phase 3, Titler) ─────────────────────────────────
{
  const speakers = snapshotToShowSpeakers(snapshot);
  ok(speakers.length === 1 && speakers[0].name === 'Dr. Ana Ferreira', 'snapshotToShowSpeakers: Name');
  ok(speakers[0].title === 'Lead Negotiator', 'snapshotToShowSpeakers: Titel/Funktion');
  ok(!JSON.stringify(speakers).includes('GEHEIM-BIO'), 'snapshotToShowSpeakers: keine Bio (PII)');
}
```
Nachher:
```ts
// ── snapshotToShowSpeakers (Phase 3, Titler; Teil 2b: ohne Kennung, Spec 23 M1 = nein) ──────────
{
  const speakers = snapshotToShowSpeakers(snapshot);
  ok(speakers.length === 1 && speakers[0].name === 'Dr. Ana Ferreira', 'snapshotToShowSpeakers: Name');
  ok(speakers[0].title === 'Lead Negotiator', 'snapshotToShowSpeakers: Titel/Funktion');
  ok(!JSON.stringify(speakers).includes('GEHEIM-BIO'), 'snapshotToShowSpeakers: keine Bio (PII)');
  ok(speakers.every((s) => !('id' in s)), 'speakersToShowSpeakers ohne Kennung (Spec 23: M1 = nein)');
  const rund = parseShow(serializeShow({ ...createShow('Speaker'), iveo: { event: 'cop30', speakers } }));
  ok(JSON.stringify(rund.iveo?.speakers) === JSON.stringify(speakers), 'speakersToShowSpeakers: Ausgabe ist ein Fixpunkt des Normalisierers');
}
```

**[Sortierung]** (nur M3 = nein, zusätzlich zu Zweig A oder B). Ersetzung 2 (Zeile 364), Vorher:
```ts
// ── getEventSnapshot resilient (Best-Effort-Nebendaten + programsBestEffort) ──
```
Nachher:
```ts
// ── speakersToShowSpeakers sortiert stabil (Teil 2b, Spec 23: M3 = nein) ──────
{
  // Geprüft über die Funktion (title), damit der Test mit und ohne Kennung (M1) gilt.
  const sortiert = speakersToShowSpeakers([
    { id: 's3', event_id: 'e1', first_name: 'Zoe', last_name: 'Adams', title: 'drei' },
    { id: 's2', event_id: 'e1', first_name: 'Anna', last_name: 'Bauer', title: 'zwei' },
    { id: 's1', event_id: 'e1', first_name: 'Anna', last_name: 'Bauer', title: 'eins' },
    { id: 's4', event_id: 'e1', first_name: 'Ute', last_name: 'Ärger', title: 'vier' },
  ]);
  ok(
    sortiert.map((s) => s.title).join(',') === 'drei,vier,eins,zwei',
    'speakersToShowSpeakers sortiert nach Nachname, Vorname, Kennung (Spec 23: M3 = nein)',
  );
}

// ── getEventSnapshot resilient (Best-Effort-Nebendaten + programsBestEffort) ──
```
„Ärger“ steht mit `localeCompare(…, 'de')` hinter „Adams“ und vor „Bauer“; ein reiner Codepunkt-Vergleich stellte es ans Ende. Die beiden „Anna Bauer“ ordnet erst die Kennung: `s1` vor `s2`.

- [ ] **Step 3: Test laufen lassen (rot)**

```
npm run selftest -w @jm/iveo
```
Erwartet in **Zweig A** (ohne Sortierung): genau diese drei Fehlschläge, letzte Zeile `3 FEHLGESCHLAGEN`, Exitcode 1:
```
FAIL speakersToShowSpeakers setzt id
FAIL speakersToShowSpeakers: id als erstes Feld, dann name und title
FAIL speakersToShowSpeakers: Kennung getrimmt
```
Mit **[Sortierung]** kommt `FAIL speakersToShowSpeakers sortiert nach Nachname, Vorname, Kennung (Spec 23: M3 = nein)` dazu (dann `4 FEHLGESCHLAGEN`, in Zweig B `1 FEHLGESCHLAGEN`).

In **Zweig B** ohne Sortierung gibt es kein Rot: Das Verhalten bleibt, wie es ist. Erwartet `ALLE TESTS OK`.

- [ ] **Step 4: Umwandler ändern** (`packages/iveo/src/mapper.ts`)

**[Zweig A]** (M1 = ja). Ersetzung 1 (Zeilen 323–337), Vorher:
```ts
/**
 * Rohe Speaker → sanitisierte Show-Speaker (#11, Phase 3): nur Anzeigename +
 * Funktion (Titel). KEINE PII (Bio/Foto/Social) und kein Token — darf in die
 * portable .jmshow und speist die Titler-DataLink/Recall-Einträge. Speaker ohne
 * Namen werden ausgelassen.
 */
export function speakersToShowSpeakers(speakers: IveoSpeaker[]): ShowIveoSpeaker[] {
  return speakers
    .map((s): ShowIveoSpeaker => {
      const speaker: ShowIveoSpeaker = { name: speakerName(s) };
      if (s.title && s.title.trim()) speaker.title = s.title.trim();
      return speaker;
    })
    .filter((s) => s.name.length > 0);
}
```
Nachher:
```ts
/**
 * Rohe Speaker → sanitisierte Show-Speaker (#11, Phase 3): Kennung, Anzeigename und
 * Funktion (Titel). KEINE PII (Bio/Foto/Social) und kein Token — darf in die
 * portable .jmshow und speist die Titler-DataLink/Recall-Einträge. Speaker ohne
 * Namen werden ausgelassen.
 * Kennung = iveo-Speaker-ID (Teil 2b, SP2; Spec 23: M1 = ja), getrimmt und vorn im Objekt wie am
 * Ablaufpunkt; eine leere ID ergibt kein `id`-Feld. Daran hält der Titler seinen Eintrag.
 */
export function speakersToShowSpeakers(speakers: IveoSpeaker[]): ShowIveoSpeaker[] {
  return speakers
    .map((s): ShowIveoSpeaker => {
      const id = kennungVon(s.id);
      const name = speakerName(s);
      const speaker: ShowIveoSpeaker = id ? { id, name } : { name };
      if (s.title && s.title.trim()) speaker.title = s.title.trim();
      return speaker;
    })
    .filter((s) => s.name.length > 0);
}
```

**[Zweig B]** (M1 = nein). Ersetzung 1 (Zeilen 323–328), Vorher:
```ts
/**
 * Rohe Speaker → sanitisierte Show-Speaker (#11, Phase 3): nur Anzeigename +
 * Funktion (Titel). KEINE PII (Bio/Foto/Social) und kein Token — darf in die
 * portable .jmshow und speist die Titler-DataLink/Recall-Einträge. Speaker ohne
 * Namen werden ausgelassen.
 */
```
Nachher:
```ts
/**
 * Rohe Speaker → sanitisierte Show-Speaker (#11, Phase 3): nur Anzeigename +
 * Funktion (Titel). KEINE PII (Bio/Foto/Social) und kein Token — darf in die
 * portable .jmshow und speist die Titler-DataLink/Recall-Einträge. Speaker ohne
 * Namen werden ausgelassen.
 * Bewusst OHNE Kennung (Teil 2b, Spec 23: M1 = nein — die iveo-Speaker-IDs sind nicht eindeutig oder nicht
 * stabil). Titler und Rundown arbeiten dann mit Ersatz-Schlüsseln bzw. Namen (Spec 7.2, 8.3).
 */
```

**[Sortierung]** (nur M3 = nein, zusätzlich zu Zweig A oder B). Ersetzung 2 (Zeilen 319–321), Vorher:
```ts
export function speakerName(s: IveoSpeaker): string {
  return [s.salutation, s.first_name, s.last_name].map((x) => (x || '').trim()).filter(Boolean).join(' ');
}
```
Nachher:
```ts
export function speakerName(s: IveoSpeaker): string {
  return [s.salutation, s.first_name, s.last_name].map((x) => (x || '').trim()).filter(Boolean).join(' ');
}

/**
 * Speaker stabil nach Nachname, Vorname, Kennung ordnen (Teil 2b, Spec 23: M3 = nein — iveo liefert die Reihenfolge
 * nicht stabil). Damit bleiben `TITLER RECALL <nr>`, Weiter und Zurück verlässlich. Neue Liste, die Eingabe bleibt.
 */
function sortiereSpeaker(speakers: IveoSpeaker[]): IveoSpeaker[] {
  const text = (v: string | null | undefined): string => (v || '').trim();
  return [...speakers].sort(
    (a, b) =>
      text(a.last_name).localeCompare(text(b.last_name), 'de') ||
      text(a.first_name).localeCompare(text(b.first_name), 'de') ||
      text(a.id).localeCompare(text(b.id), 'de'),
  );
}
```

**[Sortierung]** Ersetzung 3 (in `speakersToShowSpeakers`), Vorher:
```ts
  return speakers
    .map((s): ShowIveoSpeaker => {
```
Nachher:
```ts
  return sortiereSpeaker(speakers)
    .map((s): ShowIveoSpeaker => {
```
Der Vorher-Text kommt in `mapper.ts` genau einmal vor, in Zweig A wie in Zweig B.

- [ ] **Step 5: Tests laufen lassen (grün)**

```
npm run selftest -w @jm/iveo
```
Erwartet: keine Zeile mit `FAIL`, letzte Zeile `ALLE TESTS OK`, Exitcode 0. In Zweig A unter anderem:
```
ok   speakersToShowSpeakers setzt id
ok   speakersToShowSpeakers: id als erstes Feld, dann name und title
ok   speakersToShowSpeakers: Ausgabe ist ein Fixpunkt des Normalisierers
ok   speakersToShowSpeakers: eingegrenzte Auswahl
```
In Zweig B steht statt der ersten beiden `ok   speakersToShowSpeakers ohne Kennung (Spec 23: M1 = nein)`. Mit Sortierung zusätzlich `ok   speakersToShowSpeakers sortiert nach Nachname, Vorname, Kennung (Spec 23: M3 = nein)`.

Der Launcher nutzt den Umwandler. Seine Signatur vergleicht Speaker bis B5 nur über Name und Funktion, deshalb bleibt er grün:
```
npm run selftest:iveo -w @jm/launcher
```
Erwartet: `140 ok, 0 fehlgeschlagen.`, `47 ok, 0 fehlgeschlagen.`, `75 ok, 0 fehlgeschlagen.`, `6 ok, 0 fehlgeschlagen.`, Exitcode 0.

- [ ] **Step 6: Typecheck**

`@jm/iveo` hat kein eigenes `typecheck`-Skript; der Launcher ist der einzige Verbraucher (`apps/launcher/package.json`):
```
npm run typecheck -w @jm/launcher
```
Erwartet: keine Fehlermeldung von `tsc`, Exitcode 0.

- [ ] **Step 7: Commit** (Bash-Werkzeug; Commit-Text bewusst ohne Umlaute)

```
git add packages/iveo/src/mapper.ts packages/iveo/test/selftest.ts
git status --short
```
Erwartet genau:
```
M  packages/iveo/src/mapper.ts
M  packages/iveo/test/selftest.ts
```
Dann je nach Zweig, **Zweig A**:
```
git commit -m "feat(iveo): Speaker-Kennung im Umwandler (Teil 2b, SP2)" -m "speakersToShowSpeakers setzt die iveo-Speaker-ID als erstes Feld (getrimmt, leer -> kein id-Feld); snapshotToShowSpeakers folgt mit. Messung M1 in Spec 23: IDs eindeutig und stabil." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
**Zweig B**:
```
git commit -m "test(iveo): Speaker bleiben ohne Kennung nach Messung M1 (Teil 2b)" -m "Spec 23: die iveo-Speaker-IDs sind nicht eindeutig oder nicht stabil. speakersToShowSpeakers setzt deshalb kein id; Titler und Rundown arbeiten mit Ersatz-Schluesseln bzw. Namen. Test und Kommentar halten die Entscheidung fest." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Mit **Sortierung** im ersten `-m` jeweils ` und stabile Sortierung (M3)` anhängen.

**Abweichungen vom Gerüst:**
- Zweig A nimmt die Kennung über die vorhandene Hilfe `kennungVon` (trim, leer → kein Feld) statt roh `s.id`. Damit ist die Ausgabe ein Fixpunkt des Normalisierers aus B3; eine ID mit Leerraum würde sonst nach jedem Snapshot als „geändert“ gelten und Schreiben samt RELOAD auslösen.
- Der Sortier-Test prüft über die Funktion (`title`) statt über die Kennung, damit er auch in Zweig B gilt. Er enthält zusätzlich „Ärger“, das nur mit `localeCompare(…, 'de')` richtig steht.

---

### Task 5: B5 · Launcher: Signatur mit Kennung und Merker, einmaliges Nachschreiben der Kennungen

**Spec:** `docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md` Abschnitte 5.2 Zeilen SP3 und SP9, 5.3 (Signatur und einmaliges Nachschreiben), 6.2 („Die Signatur nimmt es auf“, „Der Kern führt den Merker in `AktiveShow`“), 9.2 Vorweg, Nr. 1 und Nr. 2.

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b` (Branch `feat/master-link-teil2b`). Alle Pfade unten sind relativ dazu.

**Dateien:**
- Modify: `apps/launcher/src/main/iveo-abgleich-kern.ts`
  - Zeile 16 (Import aus `@jm/show`)
  - Zeilen 173–191 (`ablaufSignatur`, dahinter neu `speakerWieInDerDatei`)
  - Zeilen 238–243 (`interface AktiveShow`)
  - Zeilen 290–305 (`schreibeAblauf`)
  - Zeilen 346–348 (`setzeAuf`)
  - Signatur- und Schreibstellen: `:414` und `:428–435` (Listen-Abfrage), `:484` und `:492–499` (Agenda-Abfrage), `:627–638` (Umschalten)
- Test: `apps/launcher/test/iveo-abgleich.test.ts`
  - Zeile 217 (`const ANA`, SP9; nur Zweig A)
  - neuer Block direkt vor `// --- 9.6 Nr. 1: Öffnen + erste Abfrage …` (Zeile 331)

Zeilenangaben gelten für den Stand nach B4. Maßgeblich ist immer der wortgleiche Vorher-Text.

**Zweig aus B2/B4:** Spec 23, „Ergebnisse“ (`grep -n "Entscheidungen für den Plan von Release 1" docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md`), gleichlautend im Plan-Kopf unter „Messergebnisse M1–M3“.
- **[Zweig A]** M1 = ja: `ANA` bekommt `id: 'sp1'` (SP9), passend zum nachgebauten iveo (`:159`). Ohne diese Kennung wiche die Signatur nach jedem Snapshot von der Datei ab, und die 2a-Prüfung „Nr. 2: … nichts geschrieben, kein RELOAD“ würde rot.
- **[Zweig B]** M1 = nein: `ANA` bleibt ohne `id`. Die neuen Tests lesen den Zweig aus `ANA.id` ab (`MIT_KENNUNG`) und erwarten dann, dass nichts nachgeschrieben wird.

**Interfaces:**
- Consumes: `ShowIveoSpeaker.id`, `ShowIveoBinding.speakerVeraltetSeit`, `migrateShow(raw: unknown): Show` aus `@jm/show` (B3); `speakersToShowSpeakers` mit `id` (B4, Zweig A).
- Produces (exakt so, B6 und B7 nutzen genau diese Namen):
  ```ts
  export function ablaufSignatur(ablauf: ShowAblaufItem[], speakers: ShowIveoSpeaker[], speakerVeraltetSeit?: string): string;
  // Ergebnis: JSON.stringify([punkte, sprecher, speakerVeraltetSeit ?? null]),
  // sprecher = Speaker wie in der Datei normalisiert, je [id ?? null, name.trim(), title?.trim() || null]

  // intern im Kern (erzeugeKern):
  interface AktiveShow { /* path, event, baseUrl, lastSyncIso, filter, lastSig, sideCtx */ speakerVeraltetSeit?: string }
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
      speakerVeraltetSeit?: string;
    },
  ): boolean; // schreibt w.speakerVeraltetSeit (falls gesetzt) direkt nach speakers
  ```
  `setzeAuf` liest `binding.speakerVeraltetSeit` in `AktiveShow.speakerVeraltetSeit` und in `lastSig`. In dieser Aufgabe reichen alle Aufrufer `a.speakerVeraltetSeit` unverändert durch; setzen und löschen tun ihn erst B6 und B7.

**Regeln für diese Aufgabe:**
- Der Kern lädt kein `electron` (Selbsttest mit `tsx`, CI ohne Postinstalls).
- Logs nie mit Token (G10).
- TDD: erst den Test rot sehen, dann Code. Die 2a-Fälle bleiben unverändert grün; ein roter 2a-Fall ist ein Fehler im Kern, nicht im Test (Spec 9.2, Vorweg).
- Dateien im Arbeitsbaum haben CRLF-Zeilenenden. Änderungen mit dem Edit-Werkzeug machen (Vorher-Text exakt ersetzen), nicht mit `sed`.
- Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel, nie pushen.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`apps/launcher/test/iveo-abgleich.test.ts`)

**[Zweig A]** (M1 = ja). Ersetzung 1 (Zeile 217), Vorher:
```ts
const ANA: ShowIveoSpeaker = { name: 'Ana Silva', title: 'Ministerin' };
```
Nachher:
```ts
// SP9 (Teil 2b): dieselbe Kennung wie im nachgebauten iveo (sp1). Sonst wiche die Signatur nach jedem Snapshot ab.
const ANA: ShowIveoSpeaker = { id: 'sp1', name: 'Ana Silva', title: 'Ministerin' };
```
**[Ende Zweig]** In Zweig B entfällt Ersetzung 1.

Ersetzung 2 (Zeile 331), Vorher:
```ts
// --- 9.6 Nr. 1: Öffnen + erste Abfrage mit gleichem Stand → kein Schreiben, kein RELOAD -------------------------
```
Nachher:
```ts
// --- Teil 2b, 9.2 Nr. 1 und 2: Signatur mit Speaker-Kennung und Merker, einmaliges Nachschreiben ------------------
/** Spec 23, M1: ja → `ANA` trägt die Kennung `sp1` (SP9); nein → ohne, und der Umwandler setzt keine. */
const MIT_KENNUNG = ANA.id !== undefined;
/** Bestands-Show von vor 2b: derselbe Speaker ohne Kennung (eigenes Fixture für 9.2 Nr. 2). */
const ANA_OHNE_ID: ShowIveoSpeaker = { name: 'Ana Silva', title: 'Ministerin' };
const TEXT_SPEAKER_VERALTET = 'Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand';
const MERKER = '2026-10-01T07:30:00.000Z';
/** Dieselbe Show mit Merker „Speaker veraltet“ in der Datei. */
const mitMerker = (s: Show, seit = MERKER): Show => ({ ...s, iveo: { ...s.iveo!, speakerVeraltetSeit: seit } });
{
  const a: ShowAblaufItem[] = [{ id: 'a1', label: 'Begrüßung', durationMs: 300_000 }];
  ck('Nr. 1 (2b): gleicher Name, andere Kennung → andere Signatur',
    ablaufSignatur(a, [{ id: 'sp1', name: 'Ana Silva' }]) !== ablaufSignatur(a, [{ id: 'sp2', name: 'Ana Silva' }]));
  ck('Nr. 1 (2b): mit und ohne Kennung → andere Signatur',
    ablaufSignatur(a, [{ id: 'sp1', name: 'Ana Silva' }]) !== ablaufSignatur(a, [{ name: 'Ana Silva' }]));
  ck('Nr. 1 (2b): Merker gesetzt oder nicht → andere Signatur',
    ablaufSignatur(a, [ANA], '2026-10-02T08:00:00.000Z') !== ablaufSignatur(a, [ANA]));
  ck('Nr. 1 (2b): ohne Merker = Merker undefined', ablaufSignatur(a, [ANA]) === ablaufSignatur(a, [ANA], undefined));
  ck('Nr. 1 (2b): Speaker so normalisiert wie die Datei (Kennung getrimmt, doppelte → #2, über 200 Zeichen → ohne)',
    ablaufSignatur(a, [{ id: ' sp1 ', name: 'Ana Silva' }]) === ablaufSignatur(a, [{ id: 'sp1', name: 'Ana Silva' }])
    && ablaufSignatur(a, [{ id: 'x', name: 'A' }, { id: 'x', name: 'B' }]) === ablaufSignatur(a, [{ id: 'x', name: 'A' }, { id: 'x#2', name: 'B' }])
    && ablaufSignatur(a, [{ id: 'k'.repeat(201), name: 'A' }]) === ablaufSignatur(a, [{ name: 'A' }]));
}
{
  // 9.2 Nr. 2: Bestands-Show ohne Kennungen. Die erste schreibende Listen-Abfrage trägt sie nach, danach ist Ruhe.
  const u = umgebung((iv) => showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA_OHNE_ID]));
  ck('Nr. 2 (2b): Ausgangslage — Bestands-Show, Speaker ohne Kennung', datei(u).iveo?.speakers?.[0]?.name === 'Ana Silva' && datei(u).iveo?.speakers?.[0]?.id === undefined);
  u.iveo.geaendert = [u.iveo.programme[0]];
  await u.kern.abfrage();
  ck('Nr. 2 (2b): die erste schreibende Listen-Abfrage trägt die Kennungen nach, genau ein RELOAD-Satz (M1 = nein: es gibt keine, nichts geschrieben)',
    MIT_KENNUNG
      ? u.schreibversuche === 1 && datei(u).iveo?.speakers?.[0]?.id === 'sp1' && u.reloads.length === 3
      : u.schreibversuche === 0 && u.reloads.length === 0);
  await u.kern.abfrage();
  ck('Nr. 2 (2b): … danach bleibt die Signatur gleich: kein zweites Schreiben, kein weiteres RELOAD',
    u.schreibversuche === (MIT_KENNUNG ? 1 : 0) && u.reloads.length === (MIT_KENNUNG ? 3 : 0));
}
{
  // Der Merker aus der Datei steht in `active` (setzeAuf) und geht beim Schreiben nicht verloren.
  const u = umgebung((iv) => mitMerker(showMit(agendaAblauf(iv, 'P1'), { day: TAG, programId: 'P1' }, [ANA])));
  const r = await u.kern.umschalten({ programId: 'P2' });
  ck('Merker (2b): Umschalten auf ein Side Event ohne Verknüpfung schreibt den Merker der Datei unverändert mit',
    r.ok && u.schreibversuche === 1 && datei(u).iveo?.speakerVeraltetSeit === MERKER);
}

// --- 9.6 Nr. 1: Öffnen + erste Abfrage mit gleichem Stand → kein Schreiben, kein RELOAD -------------------------
```
`TEXT_SPEAKER_VERALTET` und `mitMerker` braucht diese Aufgabe nur zum Teil; B6 und B7 nutzen sie weiter. Ein Kopf, der sie hier anlegt, hält die Testdatei in einer Reihenfolge.

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest:iveo -w @jm/launcher
```
Erwartet in Zweig A: `iveo-abgleich.test.ts` endet mit Exitcode 1, die Kette bricht danach ab. Genau diese Fehlschläge, alle 2a-Fälle bleiben `ok`:
```
FAIL  Nr. 1 (2b): gleicher Name, andere Kennung → andere Signatur
FAIL  Nr. 1 (2b): mit und ohne Kennung → andere Signatur
FAIL  Nr. 1 (2b): Merker gesetzt oder nicht → andere Signatur
FAIL  Nr. 2 (2b): die erste schreibende Listen-Abfrage trägt die Kennungen nach, genau ein RELOAD-Satz (M1 = nein: es gibt keine, nichts geschrieben)
FAIL  Nr. 2 (2b): … danach bleibt die Signatur gleich: kein zweites Schreiben, kein weiteres RELOAD
FAIL  Merker (2b): Umschalten auf ein Side Event ohne Verknüpfung schreibt den Merker der Datei unverändert mit
143 ok, 6 fehlgeschlagen.
```
In Zweig B fehlen die beiden `Nr. 2 (2b)`-Zeilen (`145 ok, 4 fehlgeschlagen.`).

- [ ] **Step 3: Import** (`apps/launcher/src/main/iveo-abgleich-kern.ts`, Zeile 16)

Vorher:
```ts
import { normalizeAblauf, type Show, type ShowAblaufItem, type ShowIveoSpeaker } from '@jm/show';
```
Nachher:
```ts
import { migrateShow, normalizeAblauf, type Show, type ShowAblaufItem, type ShowIveoSpeaker } from '@jm/show';
```

- [ ] **Step 4: `ablaufSignatur` mit Kennung und Merker** (`apps/launcher/src/main/iveo-abgleich-kern.ts`, Zeilen 173–191)

Vorher:
```ts
/**
 * Signatur eines Ablaufs samt Speakern (Spec 7.2). Gleich = nichts zu schreiben, kein RELOAD. Die Punkte so, wie
 * sie in der Datei stehen (normalizeAblauf), Felder in fester Reihenfolge; dazu die Speaker (Name, Funktion).
 */
export function ablaufSignatur(ablauf: ShowAblaufItem[], speakers: ShowIveoSpeaker[]): string {
  const punkte = normalizeAblauf(ablauf).map((p) => [
    p.id ?? null,
    p.label,
    p.durationMs ?? null,
    p.note ?? null,
    p.plannedStartMs ?? null,
    p.owner ?? null,
    p.category ?? null,
  ]);
  const sprecher = speakers
    .map((s) => [s.name.trim(), s.title?.trim() || null] as const)
    .filter(([name]) => name.length > 0);
  return JSON.stringify([punkte, sprecher]);
}
```
Nachher:
```ts
/**
 * Signatur eines Ablaufs samt Speakern und Merker (Spec 7.2; Teil 2b, Spec 5.3 und 6.2). Gleich = nichts zu
 * schreiben, kein RELOAD. Punkte und Speaker so, wie sie in der Datei stehen (normalizeAblauf bzw. der Normalisierer
 * der Bindung), Felder in fester Reihenfolge. Die Speaker-Kennung zählt: Eine Bestands-Show ohne Kennungen weicht
 * deshalb einmal ab, und die nächste schreibende Abfrage trägt sie nach. Der Merker „Speaker veraltet“ zählt ebenso:
 * Setzen und Löschen schreiben die Show und schicken RELOAD — nur so erfährt der Titler davon.
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

/**
 * Speaker so, wie sie nach dem Schreiben in der Datei stehen: derselbe Normalisierer wie parseShow (Kennung nur mit
 * 1–200 Zeichen nach trim, doppelte → #2, ohne Namen fällt der Speaker weg). Sonst wiche die Signatur einer Liste,
 * die der Normalisierer ändert, nach jedem Abruf von der Datei ab — und jede Abfrage schriebe und schickte RELOAD.
 */
function speakerWieInDerDatei(speakers: ShowIveoSpeaker[]): ShowIveoSpeaker[] {
  return migrateShow({ iveo: { event: '-', speakers } }).iveo?.speakers ?? [];
}
```

- [ ] **Step 5: `AktiveShow` führt den Merker** (`apps/launcher/src/main/iveo-abgleich-kern.ts`, Zeilen 238–243)

Vorher:
```ts
  /**
   * Side-Event-Kontext (Startzeit-Anker, Kategorie, Speakernamen). Die Agenda-Abfrage hat keinen Snapshot; ohne
   * diesen Merker fehlten Startzeit/Kategorie/Verantwortlich. Namen als Array-Paare (klonbar).
   */
  sideCtx?: SideKontext;
}
```
Nachher:
```ts
  /**
   * Side-Event-Kontext (Startzeit-Anker, Kategorie, Speakernamen). Die Agenda-Abfrage hat keinen Snapshot; ohne
   * diesen Merker fehlten Startzeit/Kategorie/Verantwortlich. Namen als Array-Paare (klonbar).
   */
  sideCtx?: SideKontext;
  /**
   * Merker „Speaker veraltet“ (Teil 2b, Spec 6.2): ISO-Zeit des ersten Fehlschlags der iveo-Speakerliste, so wie er in
   * der Datei steht. `setzeAuf` liest ihn aus der Datei (Öffnen, Speichern); ein Neustart verliert ihn deshalb nicht.
   * Er rückt wie lastSig erst nach erfolgreichem Schreiben vor.
   */
  speakerVeraltetSeit?: string;
}
```

- [ ] **Step 6: `schreibeAblauf` schreibt den Merker** (`apps/launcher/src/main/iveo-abgleich-kern.ts`, Zeilen 290–306)

Vorher:
```ts
  function schreibeAblauf(
    pfad: string,
    basis: Show,
    w: { slug: string; baseUrl: string; name: string; ablauf: ShowAblaufItem[]; speakers: ShowIveoSpeaker[]; filter: IveoProgramFilter },
  ): boolean {
    const sideEvents = basis.iveo?.sideEvents;
    const compact = compactFilter(w.filter);
    const show: Show = {
      ...basis,
      ablauf: w.ablauf,
      iveo: {
        event: w.slug,
        baseUrl: w.baseUrl,
        name: w.name,
        syncedAt: d.jetztIso(),
        ...(w.speakers.length ? { speakers: w.speakers } : {}),
        ...(sideEvents?.length ? { sideEvents } : {}),
```
Nachher:
```ts
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
    const show: Show = {
      ...basis,
      ablauf: w.ablauf,
      iveo: {
        event: w.slug,
        baseUrl: w.baseUrl,
        name: w.name,
        syncedAt: d.jetztIso(),
        ...(w.speakers.length ? { speakers: w.speakers } : {}),
        ...(w.speakerVeraltetSeit ? { speakerVeraltetSeit: w.speakerVeraltetSeit } : {}),
        ...(sideEvents?.length ? { sideEvents } : {}),
```

- [ ] **Step 7: `setzeAuf` liest den Merker aus der Datei** (`apps/launcher/src/main/iveo-abgleich-kern.ts`, Zeilen 346–348)

Vorher:
```ts
      filter: { ...(binding.filter ?? {}) },
      lastSig: ablaufSignatur(show.ablauf ?? [], binding.speakers ?? []),
    };
```
Nachher:
```ts
      filter: { ...(binding.filter ?? {}) },
      lastSig: ablaufSignatur(show.ablauf ?? [], binding.speakers ?? [], binding.speakerVeraltetSeit),
      speakerVeraltetSeit: binding.speakerVeraltetSeit,
    };
```

- [ ] **Step 8: Alle Signatur- und Schreibstellen reichen den Merker durch** (`apps/launcher/src/main/iveo-abgleich-kern.ts`)

Ersetzung 1, Listen-Abfrage (Zeilen 414–416), Vorher:
```ts
    const sig = ablaufSignatur(ablauf, speakers);
    if (sig === a.lastSig) {
      // 7.2: nichts geändert → nicht schreiben, kein RELOAD; das Abfragefenster rückt trotzdem vor.
```
Nachher:
```ts
    const sig = ablaufSignatur(ablauf, speakers, a.speakerVeraltetSeit);
    if (sig === a.lastSig) {
      // 7.2: nichts geändert → nicht schreiben, kein RELOAD; das Abfragefenster rückt trotzdem vor.
```

Ersetzung 2, Listen-Abfrage (Zeilen 428–435), Vorher:
```ts
    const ok = schreibeAblauf(a.path, basis, {
      slug: snap.event.slug,
      baseUrl: a.baseUrl,
      name: snap.event.name,
      ablauf,
      speakers,
      filter: a.filter,
    });
```
Nachher:
```ts
    const ok = schreibeAblauf(a.path, basis, {
      slug: snap.event.slug,
      baseUrl: a.baseUrl,
      name: snap.event.name,
      ablauf,
      speakers,
      filter: a.filter,
      speakerVeraltetSeit: a.speakerVeraltetSeit,
    });
```

Ersetzung 3, Agenda-Abfrage (Zeilen 483–486), Vorher:
```ts
    const speakers = basis.iveo?.speakers ?? [];
    const sig = ablaufSignatur(ablauf, speakers);
    if (sig === a.lastSig) {
      // Die Datei entspricht genau diesem Kontext → merken, sonst lädt jede Abfrage ihn neu.
```
Nachher:
```ts
    const speakers = basis.iveo?.speakers ?? [];
    const sig = ablaufSignatur(ablauf, speakers, a.speakerVeraltetSeit);
    if (sig === a.lastSig) {
      // Die Datei entspricht genau diesem Kontext → merken, sonst lädt jede Abfrage ihn neu.
```

Ersetzung 4, Agenda-Abfrage (Zeilen 495–499), Vorher:
```ts
      name: basis.iveo?.name || a.event,
      ablauf,
      speakers,
      filter: a.filter,
    });
```
Nachher:
```ts
      name: basis.iveo?.name || a.event,
      ablauf,
      speakers,
      filter: a.filter,
      speakerVeraltetSeit: a.speakerVeraltetSeit,
    });
```

Ersetzung 5, Umschalten (Zeilen 631–638), Vorher:
```ts
          ablauf,
          speakers: speakersNeu,
          filter,
        });
      if (!geschrieben) return { ok: false, message: TEXT_NICHT_GESCHRIEBEN };
      a.filter = filter;
      a.sideCtx = sideCtx;
      a.lastSig = ablaufSignatur(ablauf, speakersNeu);
```
Nachher:
```ts
          ablauf,
          speakers: speakersNeu,
          filter,
          speakerVeraltetSeit: a.speakerVeraltetSeit,
        });
      if (!geschrieben) return { ok: false, message: TEXT_NICHT_GESCHRIEBEN };
      a.filter = filter;
      a.sideCtx = sideCtx;
      a.lastSig = ablaufSignatur(ablauf, speakersNeu, a.speakerVeraltetSeit);
```

Prüfen, dass keine Stelle ohne Merker übrig ist:
```
grep -n "ablaufSignatur(" apps/launcher/src/main/iveo-abgleich-kern.ts
```
Erwartet: fünf Zeilen. Die Definition (`export function ablaufSignatur(…, speakerVeraltetSeit?: string)`) und vier Aufrufe, jeder mit drittem Argument (`binding.speakerVeraltetSeit` bzw. `a.speakerVeraltetSeit`).

- [ ] **Step 9: Tests laufen lassen (grün)**

```
npm run selftest:iveo -w @jm/launcher
```
Erwartet: vier Zusammenfassungen ohne Fehlschlag, Exitcode 0:
```
149 ok, 0 fehlgeschlagen.
47 ok, 0 fehlgeschlagen.
75 ok, 0 fehlgeschlagen.
6 ok, 0 fehlgeschlagen.
```
Darin unter anderem die 2a-Fälle mit `[ANA]`, die jetzt über die Kennung vergleichen:
```
  ok  Nr. 2: Listen-Modus, Treffer, gefilterter Ablauf gleich → nichts geschrieben, kein RELOAD
  ok  Nr. 2: … Filter, Speaker und Side-Event-Liste bleiben in der Bindung
  ok  Nr. 2 (2b): die erste schreibende Listen-Abfrage trägt die Kennungen nach, genau ein RELOAD-Satz (M1 = nein: es gibt keine, nichts geschrieben)
```

Der iveo-Selbsttest bleibt grün (er nutzt den Kern nicht, B3/B4 sind unberührt):
```
npm run selftest -w @jm/iveo
```
Erwartet: letzte Zeile `ALLE TESTS OK`.

- [ ] **Step 10: Typecheck**

```
npm run typecheck -w @jm/launcher
```
Erwartet: keine Fehlermeldung von `tsc`, Exitcode 0.

- [ ] **Step 11: Commit** (Bash-Werkzeug; Commit-Text bewusst ohne Umlaute)

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
git commit -m "feat(launcher): Abgleich-Signatur mit Speaker-Kennung und Merker (Teil 2b, 5.3)" -m "ablaufSignatur nimmt Kennung und Merker speakerVeraltetSeit auf; die Speaker werden dafuer wie in der Datei normalisiert. Eine Bestands-Show bekommt die Kennungen bei der naechsten schreibenden Abfrage einmal nachgetragen. AktiveShow fuehrt den Merker aus der Datei, schreibeAblauf schreibt ihn direkt nach speakers. Testdaten ANA mit Kennung sp1 (SP9)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- `ablaufSignatur` normalisiert die Speaker vorher wie die Datei (`speakerWieInDerDatei`, über `migrateShow` aus `@jm/show`, also dieselbe einzige Regel). Das Tupel bleibt `[id ?? null, name.trim(), title?.trim() || null]`. Ohne das schriebe eine Liste mit doppelter oder überlanger Kennung bei jeder Abfrage neu und schickte RELOAD, weil die Datei sie anders speichert als der Umwandler sie liefert.
- Der Testkopf legt `MIT_KENNUNG`, `TEXT_SPEAKER_VERALTET`, `MERKER` und `mitMerker` schon hier an (Dateiebene); B6 und B7 nutzen sie weiter. So gilt jeder Test für beide Zweige von M1, ohne zwei Fassungen.
- Zusätzlicher Test „Merker (2b): …“: Er belegt, dass der Merker aus der Datei beim Schreiben durchgereicht wird. Er bleibt auch nach B6 und B7 gültig (Umschalten ohne Verknüpfung lässt den Merker, Spec 6.2).

---

### Task 6: B6 · Launcher: Abruffehler in der Listen-Abfrage und beim Umschalten auf die Tagesübersicht (Merker, owner aus Datei, Statuszeile)

**Spec:** `docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md` Abschnitte 6.1, 6.2 („Merker in der Show“, „Ablauf je Weg“: Scheitert die Speakerliste, Solange der Merker gilt, Gelingt die Speakerliste, Status „in Ordnung“, Erfolgreich 0 Speaker), 6.3 (Texte, wörtlich), 9.2 Nr. 3, 4, 6, 7, 9.

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b` (Branch `feat/master-link-teil2b`). Alle Pfade unten sind relativ dazu.

**Dateien:**
- Modify: `apps/launcher/src/main/iveo-abgleich-kern.ts`
  - Zeilen 30–35 (Import aus `@jm/iveo`)
  - Zeilen 99–100 (Texte, dahinter die zwei neuen aus 6.3)
  - Zeilen 115–118 (`speakerNameMap`, dahinter neu `speakerNamenAusDatei`, `uebernimmOwnerAusDatei`)
  - Zeile 237 (vor `interface AktiveShow` neu der Typ `ListenStand`)
  - Zeile 272 (`let status`, dahinter `letzterSpeakerFehler`)
  - Zeilen 285–291 (`statusGestoert`, dahinter `statusNachAbfrage`, `meldeSpeakerFehler`, `meldeSpeakerWieder`)
  - Zeilen 294–299 (`benachrichtigeAlle`, dahinter `standMitSpeakerliste`, `standOhneSpeakerliste`)
  - Zeilen 419–472 (`abfrageListe`)
  - Zeilen 624–672 (`umschaltenJetzt`: Tagesübersicht und gemeinsamer Schluss)
- Test: `apps/launcher/test/iveo-abgleich.test.ts`
  - Zeilen 20–22 (Import aus dem Kern)
  - Zeilen 180–186 (nachgebauter `getEventSnapshot`)
  - neue Blöcke direkt vor `// --- Zusammenfassung ---` (Zeile 1037)

Zeilenangaben gelten für den Stand nach B5. Maßgeblich ist immer der wortgleiche Vorher-Text.

**Interfaces:**
- Consumes (B5): `ablaufSignatur(ablauf, speakers, speakerVeraltetSeit?)`, `AktiveShow.speakerVeraltetSeit`, `schreibeAblauf(pfad, basis, w)` mit `w.speakerVeraltetSeit`. Aus dem Test-Kopf von B5: `MIT_KENNUNG`, `TEXT_SPEAKER_VERALTET`, `MERKER`, `mitMerker(s: Show, seit?: string): Show`, `ANA` (mit `id: 'sp1'` in Zweig A).
- Consumes (`@jm/iveo`): `type IveoSnapshot`, `type ProgramMapOptions` (`{ stagesById?, includeSubtitle?, withSchedule?, speakerNamesById? }`), `IveoClient.getEventSnapshot(event, now, opts: { onSubError?: (resource: string, err: unknown) => void })`.
- Produces (exakt so, B7 nutzt die internen Namen):
  ```ts
  export function speakerNamenAusDatei(speakers: ShowIveoSpeaker[]): Map<string, string>;   // nur Speaker mit id → Name
  export function uebernimmOwnerAusDatei(ablauf: ShowAblaufItem[], datei: ShowAblaufItem[]): ShowAblaufItem[];

  // intern im Kern, B7 nutzt sie:
  const TEXT_SPEAKER_VERALTET = 'Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand';
  const TEXT_UMSCHALTEN_SPEAKER_VERALTET = 'Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand.';
  function statusGestoert(text: string, roh?: string, seit?: string): void;  // seit gesetzt → status.seit = seit
  function statusNachAbfrage(a: AktiveShow): void;   // Merker → gestört(TEXT_SPEAKER_VERALTET, undefined, a.speakerVeraltetSeit), sonst statusOk()
  function meldeSpeakerFehler(e: unknown): void;     // Warnung bei erstem Fehlschlag oder neuem Fehlertext
  function meldeSpeakerWieder(): void;               // Info-Log, setzt den gemerkten Fehlertext zurück
  ```
  Dazu modulintern `type ListenStand = { ablauf: ShowAblaufItem[]; speakers: ShowIveoSpeaker[]; merker: string | undefined }` und im Kern `standMitSpeakerliste(snap, listPrograms, optionen): ListenStand` sowie `standOhneSpeakerliste(basis, listPrograms, optionen, a): ListenStand`.

**Texte (Spec 6.3, wörtlich):**
- Status im iveo-Panel: „iveo-Abgleich gestört: Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand (seit ⟨hh:mm⟩)“. Das Panel setzt „iveo-Abgleich gestört: “ und „ (seit ⟨hh:mm⟩)“ aus `status.text` und `status.seit` zusammen (`apps/launcher/src/renderer/src/lib/iveo-status.ts:14-18`). Der Kern liefert deshalb `text = TEXT_SPEAKER_VERALTET` und `seit = speakerVeraltetSeit`; ⟨hh:mm⟩ ist damit die Ortszeit aus dem Merker.
- Log (Warnung): „iveo: Speakerliste nicht abrufbar (⟨Fehler⟩), Speaker aus der Datei bleiben.“
- Antwort beim Umschalten auf die Tagesübersicht: „Umgeschaltet — Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand.“
- Log (Info): „iveo: Speakerliste wieder abrufbar, Speaker aktualisiert.“

**Regeln für diese Aufgabe:**
- Der Kern lädt kein `electron`. Logs nie mit Token (G10).
- TDD in zwei Zyklen: erst die reinen Helfer, dann das Verhalten im Kern. Jeweils erst den Test rot sehen.
- Die 2a-Fälle bleiben unverändert grün.
- Dateien im Arbeitsbaum haben CRLF-Zeilenenden. Änderungen mit dem Edit-Werkzeug machen (Vorher-Text exakt ersetzen), nicht mit `sed`.
- Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel, nie pushen.

---

#### Zyklus 1: „Verantwortlich“ aus der Datei (reine Helfer)

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`apps/launcher/test/iveo-abgleich.test.ts`)

Ersetzung 1 (Zeilen 20–22), Vorher:
```ts
import {
  ablaufSignatur, einPunktAblauf, erzeugeKern, toClientError, type IveoClientLike, type IveoKern, type IveoSyncStatus,
} from '../src/main/iveo-abgleich-kern';
```
Nachher:
```ts
import {
  ablaufSignatur, einPunktAblauf, erzeugeKern, speakerNamenAusDatei, toClientError, uebernimmOwnerAusDatei,
  type IveoClientLike, type IveoKern, type IveoSyncStatus,
} from '../src/main/iveo-abgleich-kern';
```

Ersetzung 2 (Zeile 1037), Vorher:
```ts
// --- Zusammenfassung ---
```
Nachher:
```ts
// --- Teil 2b, Spec 6.2: „Verantwortlich“ aus der Datei (reine Helfer) --------------------------------------------
{
  const namen = speakerNamenAusDatei([
    { id: 'sp1', name: 'Ana Silva' },
    { name: 'Ohne Kennung' },
    { id: 'sp2', name: 'Bo Berg', title: 'Moderation' },
  ]);
  ck('speakerNamenAusDatei: nur Speaker mit Kennung, Kennung → Name', JSON.stringify([...namen]) === '[["sp1","Ana Silva"],["sp2","Bo Berg"]]');
  ck('speakerNamenAusDatei: leere Liste → leere Map', speakerNamenAusDatei([]).size === 0);
  const neu: ShowAblaufItem[] = [
    { id: 'P1', label: 'A', owner: 'Ana Silva' },
    { id: 'P2', label: 'B', owner: 'Ana Silva' },
    { id: 'P5', label: 'Neu', owner: 'Ana Silva' },
    { label: 'Ohne Kennung', owner: 'X' },
  ];
  const ausDatei: ShowAblaufItem[] = [{ id: 'P1', label: 'A', owner: 'Dr. Ana Silva (Datei)' }, { id: 'P2', label: 'B' }];
  const r = uebernimmOwnerAusDatei(neu, ausDatei);
  ck('uebernimmOwnerAusDatei: Gegenstück gleicher Kennung → dessen owner', r[0].owner === 'Dr. Ana Silva (Datei)');
  ck('uebernimmOwnerAusDatei: Gegenstück ohne owner → owner entfällt', r[1].id === 'P2' && !('owner' in r[1]));
  ck('uebernimmOwnerAusDatei: neuer Punkt und Punkt ohne Kennung bleiben unverändert', r[2] === neu[2] && r[3] === neu[3]);
  ck('uebernimmOwnerAusDatei: die Eingabe bleibt unverändert', neu[0].owner === 'Ana Silva' && neu[1].owner === 'Ana Silva');
  ck('uebernimmOwnerAusDatei: ein Punkt ohne owner bekommt den der Datei',
    uebernimmOwnerAusDatei([{ id: 'P1', label: 'A' }], ausDatei)[0].owner === 'Dr. Ana Silva (Datei)');
}

// --- Zusammenfassung ---
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest:iveo -w @jm/launcher
```
Erwartet: `iveo-abgleich.test.ts` startet gar nicht, weil der Kern die beiden Funktionen nicht exportiert. Exitcode 1, die Kette bricht ab:
```
SyntaxError: The requested module '../src/main/iveo-abgleich-kern' does not provide an export named 'speakerNamenAusDatei'
```

- [ ] **Step 3: Helfer anlegen** (`apps/launcher/src/main/iveo-abgleich-kern.ts`, Zeilen 115–118)

Vorher:
```ts
/** id → Anzeigename aller Event-Speaker (für „Verantwortlich" am Ablauf-Punkt). */
export function speakerNameMap(speakers: Array<Parameters<typeof speakerName>[0]>): Map<string, string> {
  return new Map(speakers.map((s) => [s.id, speakerName(s)]));
}
```
Nachher:
```ts
/** id → Anzeigename aller Event-Speaker (für „Verantwortlich" am Ablauf-Punkt). */
export function speakerNameMap(speakers: Array<Parameters<typeof speakerName>[0]>): Map<string, string> {
  return new Map(speakers.map((s) => [s.id, speakerName(s)]));
}

/**
 * Teil 2b, Spec 6.2: Kennung → Name aus den Speakern der Show-Datei (wie `speakerNameMap`, nur aus der Datei). Gilt,
 * wenn die iveo-Speakerliste gescheitert ist: Ein neuer Ablaufpunkt bekommt sein „Verantwortlich“ dann aus diesen
 * Namen. Speaker ohne Kennung fehlen, denn über sie gibt es keine Verknüpfung.
 */
export function speakerNamenAusDatei(speakers: ShowIveoSpeaker[]): Map<string, string> {
  const namen = new Map<string, string>();
  for (const s of speakers) if (s.id !== undefined) namen.set(s.id, s.name);
  return namen;
}

/**
 * Teil 2b, Spec 6.2: Ist die iveo-Speakerliste gescheitert, kommt „Verantwortlich“ aus der Datei. Ein Punkt mit
 * Gegenstück gleicher Kennung in der Datei übernimmt dessen `owner`; hat das Gegenstück keinen, entfällt das Feld.
 * Ein neuer Punkt (ohne Gegenstück) und ein Punkt ohne Kennung bleiben, wie sie sind. Neue Liste, die Eingabe bleibt.
 */
export function uebernimmOwnerAusDatei(ablauf: ShowAblaufItem[], datei: ShowAblaufItem[]): ShowAblaufItem[] {
  const ownerJeKennung = new Map<string, string | undefined>();
  for (const p of datei) if (p.id !== undefined && !ownerJeKennung.has(p.id)) ownerJeKennung.set(p.id, p.owner);
  return ablauf.map((p) => {
    if (p.id === undefined || !ownerJeKennung.has(p.id)) return p;
    const owner = ownerJeKennung.get(p.id);
    if (owner) return { ...p, owner };
    const { owner: _ohne, ...rest } = p;
    return rest;
  });
}
```

- [ ] **Step 4: Test laufen lassen (grün)**

```
npm run selftest:iveo -w @jm/launcher
```
Erwartet: vier Zusammenfassungen ohne Fehlschlag, Exitcode 0:
```
156 ok, 0 fehlgeschlagen.
47 ok, 0 fehlgeschlagen.
75 ok, 0 fehlgeschlagen.
6 ok, 0 fehlgeschlagen.
```

#### Zyklus 2: Merker, Speaker und „Verantwortlich“ aus der Datei, Statuszeile

- [ ] **Step 5: Fehlschlagenden Test schreiben** (`apps/launcher/test/iveo-abgleich.test.ts`)

Ersetzung 1, nachgebauter Snapshot (Zeilen 180–186). Er meldet einen Fehler der Speakerliste über `onSubError` und liefert dann eine leere Liste, wie der echte Client (`packages/iveo/src/client.ts:313-320`). Vorher:
```ts
    async getEventSnapshot(event: string, jetzt: string): Promise<IveoSnapshot> {
      await schritt('snapshot', jetzt);
      return {
        event: { id: 'ev-1', slug: event, name: 'COP31', starts_at: null, ends_at: null, timezone: null },
        programs: iv.programme, speakers: iv.speakers, organisations: [], stages: iv.stages, fetchedAt: jetzt,
      };
    },
```
Nachher:
```ts
    async getEventSnapshot(
      event: string,
      jetzt: string,
      opts: { onSubError?: (resource: string, err: unknown) => void } = {},
    ): Promise<IveoSnapshot> {
      await schritt('snapshot', jetzt);
      // Wie der echte Client (packages/iveo/src/client.ts:313-320): Speaker best effort. Ein Fehler meldet onSubError
      // und ergibt eine leere Liste; der Snapshot selbst gelingt (Teil 2b, Spec 6.1).
      let speakers = iv.speakers;
      if (iv.fehler.speakers) {
        opts.onSubError?.('speakers', iv.fehler.speakers);
        speakers = [];
      }
      return {
        event: { id: 'ev-1', slug: event, name: 'COP31', starts_at: null, ends_at: null, timezone: null },
        programs: iv.programme, speakers, organisations: [], stages: iv.stages, fetchedAt: jetzt,
      };
    },
```

Ersetzung 2 (direkt vor dem Ende), Vorher:
```ts
// --- Zusammenfassung ---
```
Nachher:
```ts
// --- Teil 2b, 9.2 Nr. 3, 4, 6, 7, 9: Speakerliste nicht abrufbar ist nicht „0 Speaker“ (Spec 6.2, 6.3) -------------
/** Listen-Show: P1 verknüpft sp1; in der Datei trägt P1 ein eigenes „Verantwortlich“. */
function listenShowMitOwner(iv: NachgebautesIveo): Show {
  iv.programme[0] = { ...iv.programme[0], speaker_ids: ['sp1'] } as IveoProgram;
  const ablauf = listenAblauf(iv, TAG).map((p) => (p.id === 'P1' ? { ...p, owner: 'Dr. Ana Silva (Datei)' } : p));
  return showMit(ablauf, { day: TAG }, [ANA]);
}
/** Neues Programm am selben Tag, mit sp1 verknüpft. */
const P5 = (): IveoProgram =>
  programm('P5', 'Side Event Boden', { starts_at: `${TAG}T15:00:00+00:00`, starts_at_local: `${TAG}T16:00:00`, speaker_ids: ['sp1'] });
const ownerVon = (s: Show, id: string): string | undefined => s.ablauf?.find((p) => p.id === id)?.owner;
const speakerWarnungen = (u: Umgebung): string[] => u.warn.filter((w) => w.startsWith('iveo: Speakerliste nicht abrufbar'));
{
  // Nr. 3: /speakers scheitert im Listen-Modus, eine Programmänderung liegt vor.
  const u = umgebung(listenShowMitOwner);
  u.iveo.fehler.speakers = new IveoApiError(500, 'server_error', 'kaputt');
  u.iveo.programme.push(P5());
  u.iveo.geaendert = [u.iveo.programme[4]];
  await u.kern.abfrage();
  const d1 = datei(u);
  const merker = d1.iveo?.speakerVeraltetSeit;
  ck('Nr. 3: /speakers scheitert, Programmänderung → die Speaker der Datei bleiben', JSON.stringify(d1.iveo?.speakers) === JSON.stringify([ANA]));
  ck('Nr. 3: … jeder Punkt behält seinen owner aus der Datei', ownerVon(d1, 'P1') === 'Dr. Ana Silva (Datei)');
  ck('Nr. 3: … ein neuer Punkt bekommt owner aus den Speakern der Datei (M1 = nein: ohne Kennung keinen)',
    ids(d1) === 'P1,P2,P3,P5' && ownerVon(d1, 'P5') === (MIT_KENNUNG ? 'Ana Silva' : undefined));
  ck('Nr. 3: … der Merker steht in der Datei', typeof merker === 'string' && !Number.isNaN(Date.parse(merker)));
  ck('Nr. 3: … Status „gestört“ mit dem Text aus 6.3, „seit“ = Merker',
    JSON.stringify(u.status.at(-1)) === JSON.stringify({ ok: false, text: TEXT_SPEAKER_VERALTET, seit: merker }));
  ck('Nr. 3: … genau einmal geschrieben, genau ein RELOAD-Satz', u.schreibversuche === 1 && u.reloads.length === 3);
  ck('Nr. 3: … Warnung aus 6.3 im Log, mit dem Fehlertext',
    JSON.stringify(speakerWarnungen(u)) === JSON.stringify(['iveo: Speakerliste nicht abrufbar (kaputt), Speaker aus der Datei bleiben.']));
  ck('Nr. 3: … das Token steht nirgends', ![...u.info, ...u.warn].some((z) => z.includes(TOKEN)) && !JSON.stringify(u.status).includes(TOKEN));

  // Nr. 4: keine Programmänderung, /speakers scheitert weiter.
  u.iveo.geaendert = [];
  const vorher = u.iveo.abrufe.length;
  await u.kern.abfrage();
  ck('Nr. 4: Merker gilt, keine Programmänderung → der Snapshot wird trotzdem geholt',
    u.iveo.abrufe.slice(vorher).some((x) => x.startsWith('snapshot:')));
  ck('Nr. 4: … Fehler bleibt → nichts geschrieben, kein RELOAD, Merker unverändert, keine zweite Warnung',
    u.schreibversuche === 1 && u.reloads.length === 3 && datei(u).iveo?.speakerVeraltetSeit === merker && speakerWarnungen(u).length === 1);
  ck('Nr. 4: … Status bleibt „gestört“', u.status.at(-1)?.ok === false && u.status.at(-1)?.text === TEXT_SPEAKER_VERALTET);

  // Nr. 4: die Liste kommt wieder.
  delete u.iveo.fehler.speakers;
  await u.kern.abfrage();
  ck('Nr. 4: Liste gelingt → Merker weg, geschrieben, RELOAD',
    datei(u).iveo?.speakerVeraltetSeit === undefined && u.schreibversuche === 2 && u.reloads.length === 6);
  ck('Nr. 4: … Status „in Ordnung“, Info-Zeile aus 6.3',
    u.status.at(-1)?.ok === true && u.info.includes('iveo: Speakerliste wieder abrufbar, Speaker aktualisiert.'));
  ck('Nr. 4: … „Verantwortlich“ wieder aus iveo', ownerVon(datei(u), 'P1') === 'Ana Silva');
  const danach = u.iveo.abrufe.length;
  await u.kern.abfrage();
  ck('Nr. 4: … ohne Merker und ohne Programmänderung kein Snapshot mehr', !u.iveo.abrufe.slice(danach).some((x) => x.startsWith('snapshot:')));
}
{
  // Nr. 6: Umschalten auf die Tagesübersicht, die Speakerliste scheitert.
  const u = umgebung(listenShowMitOwner);
  u.iveo.fehler.speakers = new IveoApiError(500, 'server_error', 'kaputt');
  const r = await u.kern.umschalten({ day: TAG });
  const m = datei(u).iveo?.speakerVeraltetSeit;
  ck('Nr. 6: Tagesübersicht mit gescheiterter Speakerliste → Meldung aus 6.3',
    r.ok && r.message === 'Umgeschaltet — Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand.');
  ck('Nr. 6: … Speaker und owner aus der Datei, Merker gesetzt',
    JSON.stringify(datei(u).iveo?.speakers) === JSON.stringify([ANA]) && ownerVon(datei(u), 'P1') === 'Dr. Ana Silva (Datei)' && typeof m === 'string');
  ck('Nr. 6: … Status „gestört“ mit dem Merker als „seit“, Warnung im Log',
    u.status.at(-1)?.text === TEXT_SPEAKER_VERALTET && u.status.at(-1)?.seit === m && speakerWarnungen(u).length === 1);
  delete u.iveo.fehler.speakers;
  const r2 = await u.kern.umschalten({ day: TAG });
  ck('Nr. 6: danach gelingt die Liste → Meldung wie bisher, Merker weg, Status „in Ordnung“',
    r2.ok && r2.message === 'Umgeschaltet (3 Punkte).' && datei(u).iveo?.speakerVeraltetSeit === undefined && u.status.at(-1)?.ok === true);
}
{
  // Nr. 7: iveo meldet erfolgreich 0 Speaker → wie bisher.
  const u = umgebung((iv) => showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA]));
  u.iveo.speakers = [];
  u.iveo.geaendert = [u.iveo.programme[0]];
  await u.kern.abfrage();
  ck('Nr. 7: iveo meldet erfolgreich 0 Speaker → Feld fehlt in der Datei, kein Merker',
    u.schreibversuche === 1 && datei(u).iveo?.speakers === undefined && datei(u).iveo?.speakerVeraltetSeit === undefined);
  ck('Nr. 7: … Status bleibt „in Ordnung“, keine Speaker-Warnung', u.status.length === 0 && speakerWarnungen(u).length === 0);
}
{
  // Nr. 9: Öffnen einer Show mit Merker → die erste Listen-Abfrage holt den Snapshot, auch ohne Programmänderung.
  const u = umgebung((iv) => mitMerker(showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA])));
  await u.kern.abfrage();
  ck('Nr. 9: Show mit Merker geöffnet, keine Programmänderung → die erste Abfrage holt den Snapshot',
    u.iveo.abrufe.some((x) => x.startsWith('snapshot:')));
  ck('Nr. 9: … die Liste gelingt → Merker weg, geschrieben, RELOAD',
    datei(u).iveo?.speakerVeraltetSeit === undefined && u.schreibversuche === 1 && u.reloads.length === 3);
}

// --- Zusammenfassung ---
```

- [ ] **Step 6: Test laufen lassen (rot)**

```
npm run selftest:iveo -w @jm/launcher
```
Erwartet in Zweig A: `iveo-abgleich.test.ts` endet mit Exitcode 1, die Kette bricht ab. Alle 2a- und B5-Fälle bleiben `ok`. Genau diese Fehlschläge:
```
FAIL  Nr. 3: /speakers scheitert, Programmänderung → die Speaker der Datei bleiben
FAIL  Nr. 3: … jeder Punkt behält seinen owner aus der Datei
FAIL  Nr. 3: … ein neuer Punkt bekommt owner aus den Speakern der Datei (M1 = nein: ohne Kennung keinen)
FAIL  Nr. 3: … der Merker steht in der Datei
FAIL  Nr. 3: … Status „gestört“ mit dem Text aus 6.3, „seit“ = Merker
FAIL  Nr. 3: … Warnung aus 6.3 im Log, mit dem Fehlertext
FAIL  Nr. 4: Merker gilt, keine Programmänderung → der Snapshot wird trotzdem geholt
FAIL  Nr. 4: … Fehler bleibt → nichts geschrieben, kein RELOAD, Merker unverändert, keine zweite Warnung
FAIL  Nr. 4: … Status bleibt „gestört“
FAIL  Nr. 4: Liste gelingt → Merker weg, geschrieben, RELOAD
FAIL  Nr. 4: … Status „in Ordnung“, Info-Zeile aus 6.3
FAIL  Nr. 4: … „Verantwortlich“ wieder aus iveo
FAIL  Nr. 6: Tagesübersicht mit gescheiterter Speakerliste → Meldung aus 6.3
FAIL  Nr. 6: … Speaker und owner aus der Datei, Merker gesetzt
FAIL  Nr. 6: … Status „gestört“ mit dem Merker als „seit“, Warnung im Log
FAIL  Nr. 6: danach gelingt die Liste → Meldung wie bisher, Merker weg, Status „in Ordnung“
FAIL  Nr. 9: Show mit Merker geöffnet, keine Programmänderung → die erste Abfrage holt den Snapshot
FAIL  Nr. 9: … die Liste gelingt → Merker weg, geschrieben, RELOAD
161 ok, 18 fehlgeschlagen.
```
Heute schreibt der Kern bei gescheiterter Liste die Show ohne Speaker und ohne „Verantwortlich“ und meldet „in Ordnung“ (Spec 6.1). Genau das zeigen die roten Zeilen.

- [ ] **Step 7: Typen aus `@jm/iveo` importieren** (`apps/launcher/src/main/iveo-abgleich-kern.ts`, Zeilen 30–35)

Vorher:
```ts
  type IveoAgendaItem,
  type IveoClient,
  type IveoProgram,
  type IveoProgramFilter,
  type IveoSpeaker,
} from '@jm/iveo';
```
Nachher:
```ts
  type IveoAgendaItem,
  type IveoClient,
  type IveoProgram,
  type IveoProgramFilter,
  type IveoSnapshot,
  type IveoSpeaker,
  type ProgramMapOptions,
} from '@jm/iveo';
```

- [ ] **Step 8: Texte aus Spec 6.3** (`apps/launcher/src/main/iveo-abgleich-kern.ts`, Zeilen 99–100)

Vorher:
```ts
/** Zeitgrenze je Abruf abgelaufen (Spec 7.0). Erweitert die Abbildung aus 7.6 — Text außerhalb der Spec, Ruling offen. */
const TEXT_ZEITGRENZE = `iveo antwortet nicht innerhalb von ${IVEO_ABRUF_ZEITGRENZE_MS / 1000} s`;
```
Nachher:
```ts
/** Zeitgrenze je Abruf abgelaufen (Spec 7.0). Erweitert die Abbildung aus 7.6 — Text außerhalb der Spec, Ruling offen. */
const TEXT_ZEITGRENZE = `iveo antwortet nicht innerhalb von ${IVEO_ABRUF_ZEITGRENZE_MS / 1000} s`;
/**
 * Teil 2b, Spec 6.3 (wortgleich): Speakerliste nicht abrufbar. Ohne Präfix — „iveo-Abgleich gestört: “ und
 * „ (seit ⟨hh:mm⟩)“ setzt das iveo-Panel aus `status.text` und `status.seit` davor bzw. dahinter (iveo-status.ts).
 */
const TEXT_SPEAKER_VERALTET = 'Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand';
/** Teil 2b, Spec 6.3: Antwort beim Umschalten auf die Tagesübersicht, hinter „Umgeschaltet — “. */
const TEXT_UMSCHALTEN_SPEAKER_VERALTET = 'Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand.';
```

- [ ] **Step 9: Typ `ListenStand`** (`apps/launcher/src/main/iveo-abgleich-kern.ts`, vor `interface AktiveShow`, Zeilen 237–238)

Vorher:
```ts
interface AktiveShow {
  path: string;
```
Nachher:
```ts
/**
 * Ergebnis eines Listen-Snapshots (Listen-Abfrage, Tagesübersicht), so wie es zu schreiben ist: Ablauf, Speaker und
 * Merker „Speaker veraltet“ (Teil 2b, Spec 6.2; `undefined` = kein Merker).
 */
type ListenStand = { ablauf: ShowAblaufItem[]; speakers: ShowIveoSpeaker[]; merker: string | undefined };

interface AktiveShow {
  path: string;
```

- [ ] **Step 10: Statuszeile und Log für die Speakerliste** (`apps/launcher/src/main/iveo-abgleich-kern.ts`)

Ersetzung 1 (Zeile 272), Vorher:
```ts
  let status: IveoSyncStatus = { ok: true };
```
Nachher:
```ts
  let status: IveoSyncStatus = { ok: true };
  /** Zuletzt geloggter Fehlertext der Speakerliste (Spec 6.3): gleichbleibende Wiederholungen nicht erneut loggen. */
  let letzterSpeakerFehler: string | null = null;
```

Ersetzung 2 (Zeilen 285–291), Vorher:
```ts
  function statusGestoert(text: string, roh?: string): void {
    if (!status.ok && status.text === text) return;
    // „seit“ = Beginn der Störung; ein neuer Text innerhalb derselben Störung behält ihn.
    status = { ok: false, text, seit: status.ok ? d.jetztIso() : status.seit };
    d.log.warn(`iveo-Abgleich gestört: ${text}${roh && roh !== text ? ` [${roh}]` : ''}`);
    d.meldeStatus(status);
  }
```
Nachher:
```ts
  /**
   * `seit` gesetzt (Teil 2b, Spec 6.3: der Merker „Speaker veraltet“) → status.seit = seit. Die Statuszeile nennt
   * dann die Zeit des ersten Fehlschlags, auch über einen Neustart hinweg. Ohne `seit` wie in 2a.
   */
  function statusGestoert(text: string, roh?: string, seit?: string): void {
    if (!status.ok && status.text === text && (seit === undefined || status.seit === seit)) return;
    // „seit“ = Beginn der Störung; ein neuer Text innerhalb derselben Störung behält ihn.
    status = { ok: false, text, seit: seit ?? (status.ok ? d.jetztIso() : status.seit) };
    d.log.warn(`iveo-Abgleich gestört: ${text}${roh && roh !== text ? ` [${roh}]` : ''}`);
    d.meldeStatus(status);
  }
  /**
   * Teil 2b, Spec 6.2: Nach einer Abfrage oder einem Umschalten „in Ordnung“ nur ohne Merker. Mit Merker bleibt der
   * Text aus 6.3 stehen, „seit“ = erster Fehlschlag.
   */
  function statusNachAbfrage(a: AktiveShow): void {
    if (a.speakerVeraltetSeit) statusGestoert(TEXT_SPEAKER_VERALTET, undefined, a.speakerVeraltetSeit);
    else statusOk();
  }
  /** Teil 2b, Spec 6.3 (wie 2a-Spec 7.6): Warnung beim ersten Fehlschlag der Speakerliste und bei jedem neuen Text. */
  function meldeSpeakerFehler(e: unknown): void {
    const text = (e as Error)?.message || String(e);
    if (text === letzterSpeakerFehler) return;
    letzterSpeakerFehler = text;
    d.log.warn(`iveo: Speakerliste nicht abrufbar (${text}), Speaker aus der Datei bleiben.`);
  }
  /** Teil 2b, Spec 6.3: Die Speakerliste kam wieder und steht jetzt in der Datei. */
  function meldeSpeakerWieder(): void {
    letzterSpeakerFehler = null;
    d.log.info('iveo: Speakerliste wieder abrufbar, Speaker aktualisiert.');
  }
```

- [ ] **Step 11: Stand eines Listen-Snapshots, mit und ohne Speakerliste** (`apps/launcher/src/main/iveo-abgleich-kern.ts`, hinter `benachrichtigeAlle`, Zeilen 297–299)

Vorher:
```ts
    const rundown = d.benachrichtige('jm-rundown', 'RUNDOWN RELOAD');
    d.log.info(`iveo: RELOAD → ${timer} Timer, ${titler} Titler, ${rundown} Rundown benachrichtigt.`);
  }
```
Nachher:
```ts
    const rundown = d.benachrichtige('jm-rundown', 'RUNDOWN RELOAD');
    d.log.info(`iveo: RELOAD → ${timer} Timer, ${titler} Titler, ${rundown} Rundown benachrichtigt.`);
  }

  /** Stand aus einem Snapshot mit Speakerliste (wie 2a): Speaker und „Verantwortlich“ aus iveo, kein Merker. */
  function standMitSpeakerliste(snap: IveoSnapshot, listPrograms: IveoProgram[], optionen: ProgramMapOptions): ListenStand {
    return {
      ablauf: programsToAblauf(listPrograms, { ...optionen, speakerNamesById: speakerNameMap(snap.speakers) }),
      speakers: snapshotToShowSpeakers(snap),
      merker: undefined,
    };
  }

  /**
   * Teil 2b, Spec 6.2: Stand, wenn die Speakerliste gescheitert ist. Es gelten die Speaker der gelesenen Datei. Der
   * Ablauf wird mit deren Namen gebaut (ein neuer Punkt bekommt so sein „Verantwortlich“), danach übernimmt jeder
   * Punkt mit Gegenstück in der Datei dessen `owner`. Ein schon gesetzter Merker bleibt, sonst gilt jetzt.
   */
  function standOhneSpeakerliste(basis: Show, listPrograms: IveoProgram[], optionen: ProgramMapOptions, a: AktiveShow): ListenStand {
    const speakers = basis.iveo?.speakers ?? [];
    const ablauf = programsToAblauf(listPrograms, { ...optionen, speakerNamesById: speakerNamenAusDatei(speakers) });
    return {
      ablauf: uebernimmOwnerAusDatei(ablauf, basis.ablauf ?? []),
      speakers,
      merker: a.speakerVeraltetSeit ?? d.jetztIso(),
    };
  }
```

- [ ] **Step 12: Listen-Abfrage** (`apps/launcher/src/main/iveo-abgleich-kern.ts`, Zeilen 419–472)

Vorher:
```ts
  /** Listen-Modus (früher pollOnce): nur bei einem `updated_since`-Treffer den Snapshot holen, dann Signatur (7.2). */
  async function abfrageListe(client: IveoClientLike, a: AktiveShow, gen: number): Promise<void> {
    const geaendert = await client.listProgramsUpdatedSince(a.event, a.lastSyncIso);
    if (!geaendert.length) {
      if (istAktuell(a, gen)) statusOk();
      return; // nichts Neues seit dem letzten Abgleich
    }
    // Programme ESSENZIELL (kein programsBestEffort): ein transienter 500 soll den Ablauf nicht mit [] überschreiben.
    const snap = await client.getEventSnapshot(a.event, d.jetztIso(), {
      onSubError: (resource, e) => d.log.warn(`iveo poll: Metadaten „${resource}" übersprungen (${(e as Error).message})`),
    });
    // Ab hier kein await mehr: Prüfen und Schreiben stehen direkt hintereinander (7.3).
    if (!istAktuell(a, gen)) return;
    const listPrograms = filterPrograms(snap.programs, a.filter);
    const ablauf = programsToAblauf(listPrograms, {
      stagesById: new Map(snap.stages.map((s) => [s.id, s])),
      // F3: nur bei eindeutiger Tageszugehörigkeit (s. scheduleSafeForList).
      withSchedule: scheduleSafeForList(a.filter, listPrograms),
      speakerNamesById: speakerNameMap(snap.speakers),
    });
    const speakers = snapshotToShowSpeakers(snap);
    d.schreibeCache(buildShowMetadata(snap, a.baseUrl));
    const sig = ablaufSignatur(ablauf, speakers, a.speakerVeraltetSeit);
    if (sig === a.lastSig) {
      // 7.2: nichts geändert → nicht schreiben, kein RELOAD; das Abfragefenster rückt trotzdem vor.
      a.lastSyncIso = snap.fetchedAt;
      d.log.info(`iveo: ${geaendert.length} Programm(e) geändert, Ablauf unverändert.`);
      statusOk();
      return;
    }
    const basis = d.leseShow(a.path);
    if (!basis) {
      statusGestoert(TEXT_SHOW_NICHT_LESBAR);
      return;
    }
    d.log.info(`iveo: ${geaendert.length} Programm(e) geändert → Ablauf neu (${ablauf.length} Punkte).`);
    const ok = schreibeAblauf(a.path, basis, {
      slug: snap.event.slug,
      baseUrl: a.baseUrl,
      name: snap.event.name,
      ablauf,
      speakers,
      filter: a.filter,
      speakerVeraltetSeit: a.speakerVeraltetSeit,
    });
    if (!ok) {
      // 7.2: kein RELOAD, Merker bleiben → die nächste Abfrage mit demselben iveo-Stand schreibt erneut.
      statusGestoert(TEXT_NICHT_GESCHRIEBEN);
      return;
    }
    a.lastSig = sig;
    a.lastSyncIso = snap.fetchedAt;
    statusOk();
    benachrichtigeAlle();
  }
```
Nachher:
```ts
  /**
   * Listen-Modus (früher pollOnce): nur bei einem `updated_since`-Treffer den Snapshot holen, dann Signatur (7.2).
   * Teil 2b, Spec 6.2: Solange der Merker „Speaker veraltet“ gilt, holt jede Abfrage den Snapshot, bis die
   * Speakerliste wieder kommt. Scheitert sie, gelten Speaker und „Verantwortlich“ der Datei, der Merker bleibt oder
   * ist jetzt. Gelingt sie, entfällt der Merker.
   */
  async function abfrageListe(client: IveoClientLike, a: AktiveShow, gen: number): Promise<void> {
    const geaendert = await client.listProgramsUpdatedSince(a.event, a.lastSyncIso);
    if (!geaendert.length && !a.speakerVeraltetSeit) {
      if (istAktuell(a, gen)) statusOk();
      return; // nichts Neues seit dem letzten Abgleich
    }
    // Programme ESSENZIELL (kein programsBestEffort): ein transienter 500 soll den Ablauf nicht mit [] überschreiben.
    // Speaker best effort, aber ein Fehlschlag ist NICHT „0 Speaker“ (Spec 6.2): er wird hier gemerkt.
    const speakerFehler: unknown[] = [];
    const snap = await client.getEventSnapshot(a.event, d.jetztIso(), {
      onSubError: (resource, e) => {
        if (resource === 'speakers') speakerFehler.push(e);
        else d.log.warn(`iveo poll: Metadaten „${resource}" übersprungen (${(e as Error).message})`);
      },
    });
    // Ab hier kein await mehr: Prüfen und Schreiben stehen direkt hintereinander (7.3).
    if (!istAktuell(a, gen)) return;
    const listPrograms = filterPrograms(snap.programs, a.filter);
    const optionen: ProgramMapOptions = {
      stagesById: new Map(snap.stages.map((s) => [s.id, s])),
      // F3: nur bei eindeutiger Tageszugehörigkeit (s. scheduleSafeForList).
      withSchedule: scheduleSafeForList(a.filter, listPrograms),
    };
    // Spec 6.2: Scheitert die Speakerliste, wird die Datei VOR dem Vergleich gelesen — ihre Speaker und ihr
    // „Verantwortlich“ gelten. Sonst wie in 2a erst, wenn sich etwas geändert hat.
    let basis: Show | null = null;
    if (speakerFehler.length) {
      basis = d.leseShow(a.path);
      if (!basis) {
        statusGestoert(TEXT_SHOW_NICHT_LESBAR);
        return;
      }
      meldeSpeakerFehler(speakerFehler[0]);
    }
    const { ablauf, speakers, merker } = basis
      ? standOhneSpeakerliste(basis, listPrograms, optionen, a)
      : standMitSpeakerliste(snap, listPrograms, optionen);
    d.schreibeCache(buildShowMetadata(snap, a.baseUrl));
    const sig = ablaufSignatur(ablauf, speakers, merker);
    if (sig === a.lastSig) {
      // 7.2: nichts geändert → nicht schreiben, kein RELOAD; das Abfragefenster rückt trotzdem vor.
      a.lastSyncIso = snap.fetchedAt;
      if (geaendert.length) d.log.info(`iveo: ${geaendert.length} Programm(e) geändert, Ablauf unverändert.`);
      statusNachAbfrage(a);
      return;
    }
    if (!basis) basis = d.leseShow(a.path);
    if (!basis) {
      statusGestoert(TEXT_SHOW_NICHT_LESBAR);
      return;
    }
    d.log.info(`iveo: ${geaendert.length} Programm(e) geändert → Ablauf neu (${ablauf.length} Punkte).`);
    const ok = schreibeAblauf(a.path, basis, {
      slug: snap.event.slug,
      baseUrl: a.baseUrl,
      name: snap.event.name,
      ablauf,
      speakers,
      filter: a.filter,
      speakerVeraltetSeit: merker,
    });
    if (!ok) {
      // 7.2: kein RELOAD, Merker bleiben → die nächste Abfrage mit demselben iveo-Stand schreibt erneut.
      statusGestoert(TEXT_NICHT_GESCHRIEBEN);
      return;
    }
    const speakerWieder = a.speakerVeraltetSeit !== undefined && merker === undefined;
    a.lastSig = sig;
    a.lastSyncIso = snap.fetchedAt;
    a.speakerVeraltetSeit = merker;
    if (speakerWieder) meldeSpeakerWieder();
    statusNachAbfrage(a);
    benachrichtigeAlle();
  }
```
Hinweis: `basis` ist vor dem Vergleich nur dann gesetzt, wenn die Speakerliste gescheitert ist. Deshalb entscheidet `basis ? … : …` zwischen den beiden Ständen. Bei gleicher Signatur und gescheiterter Liste ist der Merker unverändert (er steckt in der Signatur), also schreibt ein wiederholter Fehlschlag nicht (Spec 6.2).

- [ ] **Step 13: Umschalten auf die Tagesübersicht** (`apps/launcher/src/main/iveo-abgleich-kern.ts`)

Ersetzung 1 (Zeilen 624–651), Vorher:
```ts
      let name: string | undefined;
      let lastSyncIso = a.lastSyncIso;
      if (programId) {
        const r = await loeseSideEventLeicht(client, a.event, programId);
        if (!r) return { ok: false, message: TEXT_AGENDA_NICHT_ABRUFBAR };
        ({ ablauf, speakers, warning, sideCtx } = r);
        filter = { ...a.filter, programId };
      } else {
        // Tagesübersicht: alle Side Events des Tages (voller Snapshot nötig).
        const day = input.day || a.filter.day;
        const snap = await client.getEventSnapshot(a.event, d.jetztIso(), { onSubError: () => {} });
        filter = { ...a.filter, programId: undefined, day };
        const listPrograms = filterPrograms(snap.programs, filter);
        ablauf = programsToAblauf(listPrograms, {
          stagesById: new Map(snap.stages.map((s) => [s.id, s])),
          // F3: nur bei eindeutiger Tageszugehörigkeit (s. scheduleSafeForList).
          withSchedule: scheduleSafeForList(filter, listPrograms),
          speakerNamesById: speakerNameMap(snap.speakers),
        });
        speakers = snapshotToShowSpeakers(snap);
        name = snap.event.name;
        lastSyncIso = snap.fetchedAt;
        d.schreibeCache(buildShowMetadata(snap, a.baseUrl));
      }
      if (!ablauf.length) return { ok: false, message: 'Side Event nicht auflösbar (leerer Ablauf).' };
      // Ab hier kein await mehr (7.3): Show inzwischen gewechselt oder gespeichert → verwerfen, nichts schreiben.
      if (!istAktuell(a, gen)) return { ok: false, message: TEXT_UMSCHALTEN_VERWORFEN };
      const basis = d.leseShow(a.path);
```
Nachher:
```ts
      let name: string | undefined;
      let lastSyncIso = a.lastSyncIso;
      /** Merker „Speaker veraltet“, wie er nach dem Umschalten in der Datei steht (Teil 2b, Spec 6.2). */
      let merker = a.speakerVeraltetSeit;
      /** Schon gelesene Datei (nur wenn die Speakerliste gescheitert ist); genau sie wird dann auch geschrieben. */
      let basisFrueh: Show | null = null;
      if (programId) {
        const r = await loeseSideEventLeicht(client, a.event, programId);
        if (!r) return { ok: false, message: TEXT_AGENDA_NICHT_ABRUFBAR };
        ({ ablauf, speakers, warning, sideCtx } = r);
        filter = { ...a.filter, programId };
      } else {
        // Tagesübersicht: alle Side Events des Tages (voller Snapshot nötig).
        const day = input.day || a.filter.day;
        // Teil 2b, Spec 6.2: Ein Fehlschlag der Speakerliste ist nicht „0 Speaker“. Er wird gemerkt, nicht verschluckt.
        const speakerFehler: unknown[] = [];
        const snap = await client.getEventSnapshot(a.event, d.jetztIso(), {
          onSubError: (resource, e) => {
            if (resource === 'speakers') speakerFehler.push(e);
          },
        });
        filter = { ...a.filter, programId: undefined, day };
        const listPrograms = filterPrograms(snap.programs, filter);
        const optionen: ProgramMapOptions = {
          stagesById: new Map(snap.stages.map((s) => [s.id, s])),
          // F3: nur bei eindeutiger Tageszugehörigkeit (s. scheduleSafeForList).
          withSchedule: scheduleSafeForList(filter, listPrograms),
        };
        let stand: ListenStand;
        if (speakerFehler.length) {
          // Speaker und „Verantwortlich“ aus der Datei, Merker bleibt oder ist jetzt; die Antwort sagt es (6.3).
          basisFrueh = d.leseShow(a.path);
          if (!basisFrueh) return { ok: false, message: TEXT_NICHT_GESCHRIEBEN };
          meldeSpeakerFehler(speakerFehler[0]);
          stand = standOhneSpeakerliste(basisFrueh, listPrograms, optionen, a);
          warning = TEXT_UMSCHALTEN_SPEAKER_VERALTET;
        } else {
          stand = standMitSpeakerliste(snap, listPrograms, optionen);
        }
        ({ ablauf, speakers, merker } = stand);
        name = snap.event.name;
        lastSyncIso = snap.fetchedAt;
        d.schreibeCache(buildShowMetadata(snap, a.baseUrl));
      }
      if (!ablauf.length) return { ok: false, message: 'Side Event nicht auflösbar (leerer Ablauf).' };
      // Ab hier kein await mehr (7.3): Show inzwischen gewechselt oder gespeichert → verwerfen, nichts schreiben.
      if (!istAktuell(a, gen)) return { ok: false, message: TEXT_UMSCHALTEN_VERWORFEN };
      const basis = basisFrueh ?? d.leseShow(a.path);
```

Ersetzung 2 (Zeilen 661–672), Vorher:
```ts
          speakers: speakersNeu,
          filter,
          speakerVeraltetSeit: a.speakerVeraltetSeit,
        });
      if (!geschrieben) return { ok: false, message: TEXT_NICHT_GESCHRIEBEN };
      a.filter = filter;
      a.sideCtx = sideCtx;
      a.lastSig = ablaufSignatur(ablauf, speakersNeu, a.speakerVeraltetSeit);
      a.lastSyncIso = lastSyncIso;
      d.log.info(`iveo: Side-Event-Umschaltung → ${ablauf.length} Punkte, ${speakersNeu.length} Speaker.`);
      benachrichtigeAlle();
      d.meldeAktiv();
```
Nachher:
```ts
          speakers: speakersNeu,
          filter,
          speakerVeraltetSeit: merker,
        });
      if (!geschrieben) return { ok: false, message: TEXT_NICHT_GESCHRIEBEN };
      const speakerWieder = a.speakerVeraltetSeit !== undefined && merker === undefined;
      a.filter = filter;
      a.sideCtx = sideCtx;
      a.lastSig = ablaufSignatur(ablauf, speakersNeu, merker);
      a.lastSyncIso = lastSyncIso;
      a.speakerVeraltetSeit = merker;
      if (speakerWieder) meldeSpeakerWieder();
      d.log.info(`iveo: Side-Event-Umschaltung → ${ablauf.length} Punkte, ${speakersNeu.length} Speaker.`);
      // Teil 2b, Spec 6.2: „in Ordnung“ nur ohne Merker.
      statusNachAbfrage(a);
      benachrichtigeAlle();
      d.meldeAktiv();
```
Der Zweig „Side Event“ (`programId`) lässt `merker` in dieser Aufgabe unverändert; ihn regelt B7.

- [ ] **Step 14: Tests laufen lassen (grün)**

```
npm run selftest:iveo -w @jm/launcher
```
Erwartet: vier Zusammenfassungen ohne Fehlschlag, Exitcode 0:
```
179 ok, 0 fehlgeschlagen.
47 ok, 0 fehlgeschlagen.
75 ok, 0 fehlgeschlagen.
6 ok, 0 fehlgeschlagen.
```
Darin unter anderem:
```
  ok  Nr. 3: … Status „gestört“ mit dem Text aus 6.3, „seit“ = Merker
  ok  Nr. 4: Merker gilt, keine Programmänderung → der Snapshot wird trotzdem geholt
  ok  Nr. 6: Tagesübersicht mit gescheiterter Speakerliste → Meldung aus 6.3
  ok  Nr. 9: Show mit Merker geöffnet, keine Programmänderung → die erste Abfrage holt den Snapshot
```

- [ ] **Step 15: Typecheck**

```
npm run typecheck -w @jm/launcher
```
Erwartet: keine Fehlermeldung von `tsc`, Exitcode 0.

- [ ] **Step 16: Commit** (Bash-Werkzeug; Commit-Text bewusst ohne Umlaute)

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
git commit -m "feat(launcher): Abruffehler der Speakerliste ist nicht 0 Speaker (Teil 2b, Spec 6)" -m "Listen-Abfrage und Umschalten auf die Tagesuebersicht merken einen Fehlschlag von /speakers: Speaker und Verantwortlich kommen aus der Datei, der Merker speakerVeraltetSeit steht in der Show, die Statuszeile bleibt gestoert. Solange der Merker gilt, holt jede Listen-Abfrage den Snapshot nach, bis die Liste wiederkommt. Texte aus Spec 6.3." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Die Datei wird nur dann **vor** dem Signaturvergleich gelesen, wenn die Speakerliste gescheitert ist (so steht es in Spec 6.2 unter „Scheitert die Speakerliste“). Gelingt sie, bleibt es bei 2a: erst lesen, wenn sich etwas geändert hat. Sonst meldete eine unlesbare Datei ohne jede Änderung „Show-Datei nicht lesbar“.
- Zwei zusätzliche interne Helfer `standMitSpeakerliste` und `standOhneSpeakerliste` (und der Typ `ListenStand`), damit Listen-Abfrage und Tagesübersicht dieselbe Regel nutzen, statt sie zweimal zu schreiben.
- `statusNachAbfrage` ruft `statusGestoert` ohne `roh` auf. Die Spec-Warnung aus 6.3 mit dem Fehlertext schreibt `meldeSpeakerFehler`; `roh` hätte denselben Text ein zweites Mal ins Log gebracht.
- Die Logzeile „… Programm(e) geändert, Ablauf unverändert.“ entfällt, wenn nur der Merker den Snapshot ausgelöst hat (sonst stünde alle 45 s „0 Programm(e) geändert“ im Log).
- `letzterSpeakerFehler` wird beim Öffnen einer anderen Show nicht zurückgesetzt. Eine gleichbleibende Störung erzeugt so auch nach einem Show-Wechsel keine Warnung je Abfrage; jeder neue Fehlertext wird gemeldet.
- Der Test für Nr. 3 prüft über `MIT_KENNUNG` beide Zweige von M1: Ohne Kennungen in der Datei bekommt ein neuer Punkt keinen `owner`.

---

### Task 7: B7 · Launcher: Abruffehler in der Agenda-Abfrage und beim Umschalten auf ein Side Event

**Spec:** `docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md` Abschnitte 6.2 („Agenda-Abfrage mit Merker“, „Gelingt die Speakerliste“, „Status „in Ordnung““, „Umschalten auf ein Side Event“), 9.2 Nr. 5.

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b` (Branch `feat/master-link-teil2b`). Alle Pfade unten sind relativ dazu.

**Dateien:**
- Modify: `apps/launcher/src/main/iveo-abgleich-kern.ts`
  - Zeile 254 (`type SideKontext`)
  - Zeilen 266–272 (`sideKontext`)
  - Zeilen 593–651 (`abfrageAgenda` samt Kommentar)
  - Zeilen 662–715 (`loeseSideEventLeicht`)
  - Zeilen 748–753 (`umschaltenJetzt`, Zweig Side Event)
- Test: `apps/launcher/test/iveo-abgleich.test.ts`, neuer Block direkt vor `// --- Zusammenfassung ---`

Zeilenangaben gelten für den Stand nach B6. Maßgeblich ist immer der wortgleiche Vorher-Text.

**Interfaces:**
- Consumes (B6): `statusGestoert(text, roh?, seit?)`, `statusNachAbfrage(a)`, `meldeSpeakerFehler(e)`, `meldeSpeakerWieder()`, `TEXT_SPEAKER_VERALTET`; im Umschalten die Variable `merker` (B6, vor dem Zweig deklariert als `let merker = a.speakerVeraltetSeit;`) und der gemeinsame Schluss, der `merker` schreibt und danach `statusNachAbfrage(a)` aufruft.
- Consumes (B5): `schreibeAblauf(…, { …, speakerVeraltetSeit })`, `AktiveShow.speakerVeraltetSeit`, `ablaufSignatur(ablauf, speakers, speakerVeraltetSeit?)`.
- Consumes (Test-Kopf aus B5): `MIT_KENNUNG`, `TEXT_SPEAKER_VERALTET`, `MERKER`, `mitMerker`, `ANA` (mit `id: 'sp1'` in Zweig A). Aus B6 der nachgebaute `getEventSnapshot` mit `onSubError`. Bestehende Testhilfen aus 2a in `apps/launcher/test/iveo-abgleich.test.ts`: `umgebung`, `datei`, `punkt`, `showMit`, `agendaAblauf`, `TAG`, `IveoApiError`.
- Produces (exakt so):
  ```ts
  type SideKontext = {
    firstStartMs: number | null;
    category?: string;
    speakerNames?: Array<[string, string]>;
    detailSpeakerIds: string[];
  };
  // loeseSideEventLeicht(client, event, programId): Promise<{
  //   ablauf: ShowAblaufItem[];
  //   speakers: ShowIveoSpeaker[] | null;
  //   warning?: string;
  //   sideCtx?: SideKontext;
  //   speakerAbruf: 'ok' | 'gescheitert' | 'ohne-verknuepfung';
  // } | null>
  ```
  `sideKontext(detail, alleSpeaker?)` setzt `detailSpeakerIds = extractSpeakerIds(detail)` (ohne Detail `[]`). Damit kennt die Agenda-Abfrage die Verknüpfungen auch bei gemerktem Kontext, ohne das Programm erneut zu holen.

**Verhalten (Spec 6.2):**
- Agenda-Abfrage **mit Merker** holt zusätzlich `listSpeakers`, auch bei gemerktem Kontext.
  - Gelingt das: IDs = `detailSpeakerIds` vereinigt mit den IDs der Agenda-Punkte. Gibt es IDs, gelten die verknüpften Speaker (`speakersToShowSpeakers(alle.filter(…))`), sonst die ganze Liste. Der Merker entfällt, `meldeSpeakerWieder()`.
  - Scheitert das mit gemerktem Kontext: Speaker und Merker der Datei bleiben, `meldeSpeakerFehler(e)`, Status bleibt „gestört“.
  - Scheitert das ohne Kontext: Abbruch wie in 2a (`throw`, `abfrage()` meldet „gestört“).
- Agenda-Abfrage **ohne Merker**: wie bisher (Speaker aus der Datei), Status über `statusNachAbfrage(a)`.
- Umschalten auf ein Side Event: `'ok'` → Merker entfällt. `'gescheitert'` → Merker `a.speakerVeraltetSeit ?? d.jetztIso()`. `'ohne-verknuepfung'` → Merker unverändert. Die Antwort beim Umschalten bleibt wie heute.

**Regeln für diese Aufgabe:**
- Der Kern lädt kein `electron`. Logs nie mit Token (G10).
- TDD: erst den Test rot sehen, dann Code. Die 2a-, B5- und B6-Fälle bleiben unverändert grün.
- Dateien im Arbeitsbaum haben CRLF-Zeilenenden. Änderungen mit dem Edit-Werkzeug machen (Vorher-Text exakt ersetzen), nicht mit `sed`.
- Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel, nie pushen.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`apps/launcher/test/iveo-abgleich.test.ts`)

Vorher:
```ts
// --- Zusammenfassung ---
```
Nachher:
```ts
// --- Teil 2b, 9.2 Nr. 5 und Spec 6.2: Agenda-Abfrage mit Merker, Umschalten auf ein Side Event ---------------------
/** Zweiter Speaker im nachgebauten iveo. */
const BO: IveoSpeaker = { id: 'sp2', event_id: 'ev-1', first_name: 'Bo', last_name: 'Berg', title: 'Moderation' };
/** Speaker-Namen der Datei, sortiert: so gilt der Test mit und ohne Zusatz Sortierung (Spec 23, M3). */
const namenIn = (s: Show): string => JSON.stringify((s.iveo?.speakers ?? []).map((sp) => sp.name).sort());
{
  // Nr. 5: Show auf Side Event P1 (ohne Speaker-Verknüpfung) mit Merker in der Datei.
  const u = umgebung((iv) => mitMerker(showMit(agendaAblauf(iv, 'P1'), { day: TAG, programId: 'P1' }, [ANA])));
  u.iveo.fehler.speakers = new IveoApiError(500, 'server_error', 'kaputt');
  await u.kern.abfrage();
  ck('Nr. 5 (a): Merker, Kontext fehlt, Speakerliste scheitert → Abbruch wie in 2a: nichts geschrieben, Status gestört, Merker bleibt',
    u.schreibversuche === 0 && u.reloads.length === 0 && u.status.at(-1)?.ok === false && datei(u).iveo?.speakerVeraltetSeit === MERKER);

  const r = await u.kern.umschalten({ programId: 'P1' });
  ck('Nr. 5 (b): Umschalten auf P1 ohne Verknüpfung → keine Speakerliste geholt, Merker unverändert',
    r.ok && u.iveo.abrufe.filter((x) => x === 'speakers:').length === 1 && datei(u).iveo?.speakerVeraltetSeit === MERKER);
  ck('Nr. 5 (b): … Status „gestört“ mit dem Text aus 6.3', u.status.at(-1)?.text === TEXT_SPEAKER_VERALTET && u.status.at(-1)?.seit === MERKER);

  const vorher = u.iveo.abrufe.length;
  await u.kern.abfrage();
  const neu = u.iveo.abrufe.slice(vorher);
  ck('Nr. 5 (c): Kontext gemerkt → kein Detail-Abruf, aber die Speakerliste wird zusätzlich geholt',
    neu.includes('speakers:') && !neu.includes('programm:P1'));
  ck('Nr. 5 (c): … sie scheitert → Status bleibt „gestört“ (Text aus 6.3, „seit“ = Merker), Merker bleibt, nichts geschrieben',
    u.status.at(-1)?.text === TEXT_SPEAKER_VERALTET && u.status.at(-1)?.seit === MERKER
    && datei(u).iveo?.speakerVeraltetSeit === MERKER && u.schreibversuche === 1);
  ck('Nr. 5 (c): … Warnung aus 6.3 im Log', u.warn.includes('iveo: Speakerliste nicht abrufbar (kaputt), Speaker aus der Datei bleiben.'));

  delete u.iveo.fehler.speakers;
  u.iveo.speakers.push(BO);
  await u.kern.abfrage();
  ck('Nr. 5 (d): Liste gelingt, Side Event ohne Verknüpfung → die ganze Liste geschrieben, Merker weg, RELOAD',
    namenIn(datei(u)) === '["Ana Silva","Bo Berg"]' && datei(u).iveo?.speakerVeraltetSeit === undefined
    && u.schreibversuche === 2 && u.reloads.length === 6);
  ck('Nr. 5 (d): … Status „in Ordnung“, Info-Zeile aus 6.3',
    u.status.at(-1)?.ok === true && u.info.includes('iveo: Speakerliste wieder abrufbar, Speaker aktualisiert.'));
  const danach = u.iveo.abrufe.length;
  await u.kern.abfrage();
  ck('Nr. 5 (d): … ohne Merker holt die Agenda-Abfrage keine Speakerliste mehr, nichts geschrieben',
    !u.iveo.abrufe.slice(danach).includes('speakers:') && u.schreibversuche === 2);
}
{
  // Nr. 5 (e): Ein Agenda-Punkt von P2 verknüpft sp2 → nur die verknüpften Speaker.
  const u = umgebung((iv) => {
    iv.speakers.push(BO);
    iv.agenda.P2 = [{ ...punkt('P2', 'b1', 'Einführung', 1), speaker_ids: ['sp2'] } as IveoAgendaItem, punkt('P2', 'b2', 'Diskussion', 2, 30)];
    return mitMerker(showMit(agendaAblauf(iv, 'P2'), { day: TAG, programId: 'P2' }, [ANA]));
  });
  await u.kern.abfrage();
  ck('Nr. 5 (e): Agenda-Punkt verknüpft sp2 → nur dieser Speaker geschrieben, Merker weg, RELOAD',
    namenIn(datei(u)) === '["Bo Berg"]' && datei(u).iveo?.speakerVeraltetSeit === undefined && u.reloads.length === 3);
}
{
  // Nr. 5 (f): Die Verknüpfung steht nur im Programm-Detail, nicht an den Agenda-Punkten → sie zählt ebenso.
  const u = umgebung((iv) => {
    iv.speakers.push(BO);
    iv.programme[1] = { ...iv.programme[1], speaker_ids: ['sp2'] } as IveoProgram;
    return mitMerker(showMit(agendaAblauf(iv, 'P2'), { day: TAG, programId: 'P2' }, [ANA]));
  });
  await u.kern.abfrage();
  ck('Nr. 5 (f): Verknüpfung nur im Programm-Detail → nur dieser Speaker geschrieben, Merker weg',
    namenIn(datei(u)) === '["Bo Berg"]' && datei(u).iveo?.speakerVeraltetSeit === undefined);
}
{
  // Umschalten auf ein verknüpftes Side Event, die Speakerliste gelingt → Merker weg.
  const u = umgebung((iv) => mitMerker(showMit(agendaAblauf(iv, 'P1'), { day: TAG, programId: 'P1' }, [ANA])));
  u.iveo.agenda.P2 = [{ ...punkt('P2', 'b1', 'Einführung', 1), speaker_ids: ['sp1'] } as IveoAgendaItem];
  const r = await u.kern.umschalten({ programId: 'P2' });
  ck('Umschalten (2b): verknüpftes Side Event, Speakerliste gelingt → Merker weg, Info-Zeile, Status in Ordnung',
    r.ok && datei(u).iveo?.speakerVeraltetSeit === undefined
    && u.info.includes('iveo: Speakerliste wieder abrufbar, Speaker aktualisiert.') && u.status.every((s) => s.ok));
}
{
  // … die Speakerliste scheitert → Merker gesetzt, Status gestört, Antwort wie bisher.
  const u = umgebung((iv) => showMit(agendaAblauf(iv, 'P1'), { day: TAG, programId: 'P1' }, [ANA]));
  u.iveo.agenda.P2 = [{ ...punkt('P2', 'b1', 'Einführung', 1), speaker_ids: ['sp1'] } as IveoAgendaItem];
  u.iveo.fehler.speakers = new IveoApiError(500, 'server_error', 'kaputt');
  const r = await u.kern.umschalten({ programId: 'P2' });
  const m = datei(u).iveo?.speakerVeraltetSeit;
  ck('Umschalten (2b): Speakerliste scheitert → Merker gesetzt, Speaker der Datei bleiben',
    r.ok && typeof m === 'string' && JSON.stringify(datei(u).iveo?.speakers) === JSON.stringify([ANA]));
  ck('Umschalten (2b): … Status „gestört“ mit dem Merker als „seit“, Antwort wie bisher',
    u.status.at(-1)?.text === TEXT_SPEAKER_VERALTET && u.status.at(-1)?.seit === m && r.message === 'Umgeschaltet (1 Punkte).');
}
{
  // … ohne Verknüpfung → keine Speakerliste, Merker unverändert, Status bleibt gestört.
  const u = umgebung((iv) => mitMerker(showMit(agendaAblauf(iv, 'P1'), { day: TAG, programId: 'P1' }, [ANA])));
  const r = await u.kern.umschalten({ programId: 'P2' });
  ck('Umschalten (2b): ohne Verknüpfung → keine Speakerliste geholt, Merker unverändert, Status „gestört“',
    r.ok && !u.iveo.abrufe.includes('speakers:') && datei(u).iveo?.speakerVeraltetSeit === MERKER
    && u.status.at(-1)?.text === TEXT_SPEAKER_VERALTET);
}

// --- Zusammenfassung ---
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest:iveo -w @jm/launcher
```
Erwartet: `iveo-abgleich.test.ts` endet mit Exitcode 1, die Kette bricht ab. Alle 2a-, B5- und B6-Fälle bleiben `ok`. Genau diese Fehlschläge:
```
FAIL  Nr. 5 (a): Merker, Kontext fehlt, Speakerliste scheitert → Abbruch wie in 2a: nichts geschrieben, Status gestört, Merker bleibt
FAIL  Nr. 5 (b): Umschalten auf P1 ohne Verknüpfung → keine Speakerliste geholt, Merker unverändert
FAIL  Nr. 5 (c): Kontext gemerkt → kein Detail-Abruf, aber die Speakerliste wird zusätzlich geholt
FAIL  Nr. 5 (c): … sie scheitert → Status bleibt „gestört“ (Text aus 6.3, „seit“ = Merker), Merker bleibt, nichts geschrieben
FAIL  Nr. 5 (c): … Warnung aus 6.3 im Log
FAIL  Nr. 5 (d): Liste gelingt, Side Event ohne Verknüpfung → die ganze Liste geschrieben, Merker weg, RELOAD
FAIL  Nr. 5 (d): … Status „in Ordnung“, Info-Zeile aus 6.3
FAIL  Nr. 5 (d): … ohne Merker holt die Agenda-Abfrage keine Speakerliste mehr, nichts geschrieben
FAIL  Nr. 5 (e): Agenda-Punkt verknüpft sp2 → nur dieser Speaker geschrieben, Merker weg, RELOAD
FAIL  Nr. 5 (f): Verknüpfung nur im Programm-Detail → nur dieser Speaker geschrieben, Merker weg
FAIL  Umschalten (2b): verknüpftes Side Event, Speakerliste gelingt → Merker weg, Info-Zeile, Status in Ordnung
FAIL  Umschalten (2b): Speakerliste scheitert → Merker gesetzt, Speaker der Datei bleiben
FAIL  Umschalten (2b): … Status „gestört“ mit dem Merker als „seit“, Antwort wie bisher
181 ok, 13 fehlgeschlagen.
```

- [ ] **Step 3: `SideKontext` merkt die Verknüpfungen des Programm-Details** (`apps/launcher/src/main/iveo-abgleich-kern.ts`)

Ersetzung 1 (Zeile 254), Vorher:
```ts
type SideKontext = { firstStartMs: number | null; category?: string; speakerNames?: Array<[string, string]> };
```
Nachher:
```ts
type SideKontext = {
  firstStartMs: number | null;
  category?: string;
  speakerNames?: Array<[string, string]>;
  /**
   * Speaker-IDs aus dem Programm-Detail (Teil 2b, Spec 6.2). Die Agenda-Abfrage holt das Detail nur ohne Kontext; mit
   * Merker braucht sie die Verknüpfungen trotzdem, um die frische Speakerliste wie beim Umschalten einzugrenzen.
   */
  detailSpeakerIds: string[];
};
```

Ersetzung 2 (Zeilen 266–272), Vorher:
```ts
function sideKontext(detail: IveoProgram | null, alleSpeaker?: IveoSpeaker[]): SideKontext {
  return {
    firstStartMs: detail ? localTimeOfDayMs(detail) : null,
    category: ((detail?.format_slug || detail?.type_slug) || '').trim() || undefined,
    speakerNames: alleSpeaker ? [...speakerNameMap(alleSpeaker)] : undefined,
  };
}
```
Nachher:
```ts
function sideKontext(detail: IveoProgram | null, alleSpeaker?: IveoSpeaker[]): SideKontext {
  return {
    firstStartMs: detail ? localTimeOfDayMs(detail) : null,
    category: ((detail?.format_slug || detail?.type_slug) || '').trim() || undefined,
    speakerNames: alleSpeaker ? [...speakerNameMap(alleSpeaker)] : undefined,
    detailSpeakerIds: extractSpeakerIds(detail),
  };
}
```

- [ ] **Step 4: Agenda-Abfrage mit Merker** (`apps/launcher/src/main/iveo-abgleich-kern.ts`, Zeilen 593–651)

Vorher:
```ts
  /**
   * Agenda-Modus (früher pollSideEvent). Spec 7.6: Scheitert die Agenda oder das Nachladen des Side-Event-Kontexts,
   * bricht die Abfrage ab (nichts geschrieben, kein RELOAD, „gestört“). Nur eine erfolgreich LEERE Agenda wird zum
   * 1-Punkt-Ablauf. Speaker und Name kommen aus der Datei (neu eingegrenzt wird nur beim Binden und Umschalten).
   */
  async function abfrageAgenda(client: IveoClientLike, a: AktiveShow, gen: number): Promise<void> {
    const programId = a.filter.programId!;
    const agenda = await client.listAgendaItems(a.event, programId);
    let detail: IveoProgram | null = null;
    let ctx = a.sideCtx;
    if (!ctx) {
      // Nach dem Öffnen einer gespeicherten Show fehlt der Kontext (er entsteht beim Binden/Umschalten). Ohne ihn
      // fehlten Startzeit, Kategorie und Verantwortlich → nachladen; scheitert das, bricht die Abfrage ab (7.6).
      detail = await client.getProgram(a.event, programId);
      // Scheitert die Speakerliste, bricht die Abfrage ab (wie getProgram): sonst entstünde ein Ablauf ohne „Verantwortlich“.
      const alle = sideSpeakerIds(detail, agenda).length ? await client.listSpeakers(a.event) : undefined;
      ctx = sideKontext(detail, alle);
    }
    const names = ctx.speakerNames ? new Map(ctx.speakerNames) : undefined;
    let ablauf = agendaToAblauf(agenda, {
      firstStartMs: ctx.firstStartMs,
      category: ctx.category,
      speakerNamesById: names,
    });
    if (!ablauf.length) {
      // Erfolgreich leere Agenda → das Programm selbst als ein Punkt, wie beim Binden und Umschalten (7.2).
      if (!detail) detail = await client.getProgram(a.event, programId);
      ablauf = [einPunktAblauf(detail, names)];
    }
    // Ab hier kein await mehr: Prüfen und Schreiben stehen direkt hintereinander (7.3).
    if (!istAktuell(a, gen)) return;
    const basis = d.leseShow(a.path);
    if (!basis) {
      statusGestoert(TEXT_SHOW_NICHT_LESBAR);
      return;
    }
    const speakers = basis.iveo?.speakers ?? [];
    const sig = ablaufSignatur(ablauf, speakers, a.speakerVeraltetSeit);
    if (sig === a.lastSig) {
      // Die Datei entspricht genau diesem Kontext → merken, sonst lädt jede Abfrage ihn neu.
      a.sideCtx = ctx;
      statusOk();
      return; // nichts geändert → kein RELOAD
    }
    d.log.info(`iveo: Agenda von Side Event geändert → ${ablauf.length} Punkte neu.`);
    const ok = schreibeAblauf(a.path, basis, {
      slug: a.event,
      baseUrl: a.baseUrl,
      name: basis.iveo?.name || a.event,
      ablauf,
      speakers,
      filter: a.filter,
      speakerVeraltetSeit: a.speakerVeraltetSeit,
    });
    if (!ok) {
      statusGestoert(TEXT_NICHT_GESCHRIEBEN);
      return;
    }
    a.lastSig = sig;
    a.sideCtx = ctx;
    statusOk();
    benachrichtigeAlle();
  }
```
Nachher:
```ts
  /**
   * Agenda-Modus (früher pollSideEvent). Spec 7.6: Scheitert die Agenda oder das Nachladen des Side-Event-Kontexts,
   * bricht die Abfrage ab (nichts geschrieben, kein RELOAD, „gestört“). Nur eine erfolgreich LEERE Agenda wird zum
   * 1-Punkt-Ablauf. Speaker und Name kommen aus der Datei (neu eingegrenzt wird nur beim Binden und Umschalten).
   * Teil 2b, Spec 6.2: Mit Merker „Speaker veraltet“ holt die Abfrage zusätzlich die Speakerliste, auch bei gemerktem
   * Kontext. Gelingt sie, gelten die verknüpften Speaker (ohne Verknüpfung die ganze Liste), und der Merker entfällt.
   * Scheitert sie, bleiben Speaker und Merker der Datei; fehlt zugleich der Kontext, bricht die Abfrage ab wie in 2a.
   */
  async function abfrageAgenda(client: IveoClientLike, a: AktiveShow, gen: number): Promise<void> {
    const programId = a.filter.programId!;
    const agenda = await client.listAgendaItems(a.event, programId);
    let detail: IveoProgram | null = null;
    let ctx = a.sideCtx;
    /** Volle Speakerliste, falls diese Abfrage sie geholt hat (für den Kontext oder wegen des Merkers). */
    let alle: IveoSpeaker[] | undefined;
    if (!ctx) {
      // Nach dem Öffnen einer gespeicherten Show fehlt der Kontext (er entsteht beim Binden/Umschalten). Ohne ihn
      // fehlten Startzeit, Kategorie und Verantwortlich → nachladen; scheitert das, bricht die Abfrage ab (7.6).
      detail = await client.getProgram(a.event, programId);
      // Scheitert die Speakerliste, bricht die Abfrage ab (wie getProgram): sonst entstünde ein Ablauf ohne „Verantwortlich“.
      // Mit Merker wird sie auch ohne Verknüpfung geholt (Spec 6.2); ein Fehlschlag bricht dann ebenso ab.
      alle = sideSpeakerIds(detail, agenda).length || a.speakerVeraltetSeit ? await client.listSpeakers(a.event) : undefined;
      ctx = sideKontext(detail, alle);
    } else if (a.speakerVeraltetSeit) {
      try {
        alle = await client.listSpeakers(a.event);
      } catch (e) {
        // Speaker und Merker der Datei bleiben; der Status bleibt „gestört“ (statusNachAbfrage unten).
        meldeSpeakerFehler(e);
      }
    }
    const names = ctx.speakerNames ? new Map(ctx.speakerNames) : undefined;
    let ablauf = agendaToAblauf(agenda, {
      firstStartMs: ctx.firstStartMs,
      category: ctx.category,
      speakerNamesById: names,
    });
    if (!ablauf.length) {
      // Erfolgreich leere Agenda → das Programm selbst als ein Punkt, wie beim Binden und Umschalten (7.2).
      if (!detail) detail = await client.getProgram(a.event, programId);
      ablauf = [einPunktAblauf(detail, names)];
    }
    // Ab hier kein await mehr: Prüfen und Schreiben stehen direkt hintereinander (7.3).
    if (!istAktuell(a, gen)) return;
    const basis = d.leseShow(a.path);
    if (!basis) {
      statusGestoert(TEXT_SHOW_NICHT_LESBAR);
      return;
    }
    let speakers = basis.iveo?.speakers ?? [];
    let merker = a.speakerVeraltetSeit;
    if (merker && alle) {
      // Spec 6.2: verknüpfte Speaker wie beim Umschalten (Detail und Agenda-Punkte), ohne Verknüpfung die ganze Liste.
      const verknuepft = new Set<string>([...ctx.detailSpeakerIds, ...agenda.flatMap((it) => extractSpeakerIds(it))]);
      speakers = speakersToShowSpeakers(verknuepft.size ? alle.filter((s) => verknuepft.has(s.id)) : alle);
      merker = undefined;
    }
    const sig = ablaufSignatur(ablauf, speakers, merker);
    if (sig === a.lastSig) {
      // Die Datei entspricht genau diesem Kontext → merken, sonst lädt jede Abfrage ihn neu.
      a.sideCtx = ctx;
      statusNachAbfrage(a);
      return; // nichts geändert → kein RELOAD
    }
    d.log.info(`iveo: Agenda von Side Event geändert → ${ablauf.length} Punkte neu.`);
    const ok = schreibeAblauf(a.path, basis, {
      slug: a.event,
      baseUrl: a.baseUrl,
      name: basis.iveo?.name || a.event,
      ablauf,
      speakers,
      filter: a.filter,
      speakerVeraltetSeit: merker,
    });
    if (!ok) {
      statusGestoert(TEXT_NICHT_GESCHRIEBEN);
      return;
    }
    const speakerWieder = a.speakerVeraltetSeit !== undefined && merker === undefined;
    a.lastSig = sig;
    a.sideCtx = ctx;
    a.speakerVeraltetSeit = merker;
    if (speakerWieder) meldeSpeakerWieder();
    statusNachAbfrage(a);
    benachrichtigeAlle();
  }
```

- [ ] **Step 5: `loeseSideEventLeicht` meldet den Speaker-Abruf** (`apps/launcher/src/main/iveo-abgleich-kern.ts`)

Ersetzung 1 (Zeilen 662–666), Vorher:
```ts
  async function loeseSideEventLeicht(
    client: IveoClientLike,
    event: string,
    programId: string,
  ): Promise<{ ablauf: ShowAblaufItem[]; speakers: ShowIveoSpeaker[] | null; warning?: string; sideCtx?: SideKontext } | null> {
```
Nachher:
```ts
  async function loeseSideEventLeicht(
    client: IveoClientLike,
    event: string,
    programId: string,
  ): Promise<{
    ablauf: ShowAblaufItem[];
    speakers: ShowIveoSpeaker[] | null;
    warning?: string;
    sideCtx?: SideKontext;
    /** Teil 2b, Spec 6.2: Speakerliste geholt und gelungen, gescheitert oder ohne Verknüpfung gar nicht geholt. */
    speakerAbruf: 'ok' | 'gescheitert' | 'ohne-verknuepfung';
  } | null> {
```

Ersetzung 2 (Zeilen 684–692), Vorher:
```ts
    let alle: IveoSpeaker[] | undefined;
    if (ids.length) {
      try {
        alle = await client.listSpeakers(event);
        speakers = speakersToShowSpeakers(alle.filter((s) => ids.includes(s.id)));
        d.log.info(`iveo switch: ${ids.length} Speaker verknüpft, ${speakers.length} aufgelöst.`);
      } catch (e) {
        // Liste der Datei bleibt, owner bleibt leer — und kein Kontext merken: die nächste Abfrage lädt vollständig nach.
        vollstaendig = false;
```
Nachher:
```ts
    let alle: IveoSpeaker[] | undefined;
    let speakerAbruf: 'ok' | 'gescheitert' | 'ohne-verknuepfung' = 'ohne-verknuepfung';
    if (ids.length) {
      try {
        alle = await client.listSpeakers(event);
        speakers = speakersToShowSpeakers(alle.filter((s) => ids.includes(s.id)));
        speakerAbruf = 'ok';
        d.log.info(`iveo switch: ${ids.length} Speaker verknüpft, ${speakers.length} aufgelöst.`);
      } catch (e) {
        // Liste der Datei bleibt, owner bleibt leer — und kein Kontext merken: die nächste Abfrage lädt vollständig nach.
        vollstaendig = false;
        speakerAbruf = 'gescheitert';
```

Ersetzung 3 (Zeilen 708–714), Vorher:
```ts
    return {
      ablauf,
      speakers,
      warning,
      // Ohne Detail oder ohne Speakerliste keinen Kontext merken: die nächste Abfrage lädt ihn nach (7.6).
      sideCtx: detail && vollstaendig ? kontext : undefined,
    };
```
Nachher:
```ts
    return {
      ablauf,
      speakers,
      warning,
      // Ohne Detail oder ohne Speakerliste keinen Kontext merken: die nächste Abfrage lädt ihn nach (7.6).
      sideCtx: detail && vollstaendig ? kontext : undefined,
      speakerAbruf,
    };
```

- [ ] **Step 6: Umschalten auf ein Side Event setzt oder löscht den Merker** (`apps/launcher/src/main/iveo-abgleich-kern.ts`, Zeilen 748–753)

Vorher:
```ts
      if (programId) {
        const r = await loeseSideEventLeicht(client, a.event, programId);
        if (!r) return { ok: false, message: TEXT_AGENDA_NICHT_ABRUFBAR };
        ({ ablauf, speakers, warning, sideCtx } = r);
        filter = { ...a.filter, programId };
      } else {
```
Nachher:
```ts
      if (programId) {
        const r = await loeseSideEventLeicht(client, a.event, programId);
        if (!r) return { ok: false, message: TEXT_AGENDA_NICHT_ABRUFBAR };
        ({ ablauf, speakers, warning, sideCtx } = r);
        filter = { ...a.filter, programId };
        // Teil 2b, Spec 6.2: Gelingt die Speakerliste, entfällt der Merker; scheitert sie, wird er gesetzt (ein schon
        // gesetzter bleibt). Ohne Verknüpfung holt das Umschalten keine Liste, der Merker bleibt, wie er ist.
        if (r.speakerAbruf === 'ok') merker = undefined;
        else if (r.speakerAbruf === 'gescheitert') merker = a.speakerVeraltetSeit ?? d.jetztIso();
      } else {
```
Der gemeinsame Schluss aus B6 schreibt `merker`, setzt `a.speakerVeraltetSeit`, ruft bei entfallenem Merker `meldeSpeakerWieder()` und danach `statusNachAbfrage(a)`. Die Antwort (`Umgeschaltet …`) bleibt wie heute.

- [ ] **Step 7: Tests laufen lassen (grün)**

```
npm run selftest:iveo -w @jm/launcher
```
Erwartet: vier Zusammenfassungen ohne Fehlschlag, Exitcode 0:
```
194 ok, 0 fehlgeschlagen.
47 ok, 0 fehlgeschlagen.
75 ok, 0 fehlgeschlagen.
6 ok, 0 fehlgeschlagen.
```
Darin bleiben die 2a-Fälle zum Umschalten mit verknüpften Speakern grün, unter anderem:
```
  ok  Umschalten, Speakerliste nicht ladbar: gelingt, Warnung im Log (ohne Token), Ersatzliste bleibt, kein Verantwortlich
  ok  … die nächste Abfrage lädt Kontext samt Speakern nach und trägt Verantwortlich nach
```

Der iveo-Selbsttest ist unberührt:
```
npm run selftest -w @jm/iveo
```
Erwartet: letzte Zeile `ALLE TESTS OK`.

- [ ] **Step 8: Typecheck**

```
npm run typecheck -w @jm/launcher
```
Erwartet: keine Fehlermeldung von `tsc`, Exitcode 0.

- [ ] **Step 9: Commit** (Bash-Werkzeug; Commit-Text bewusst ohne Umlaute)

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
git commit -m "feat(launcher): Merker Speaker veraltet in Agenda-Abfrage und Side-Event-Umschalten (Teil 2b, Spec 6.2)" -m "Mit Merker holt die Agenda-Abfrage die Speakerliste zusaetzlich, auch bei gemerktem Kontext: gelingt sie, gelten die verknuepften Speaker (sonst die ganze Liste) und der Merker entfaellt; scheitert sie, bleiben Speaker und Merker der Datei. SideKontext merkt dafuer die Verknuepfungen des Programm-Details. Das Umschalten auf ein Side Event setzt oder loescht den Merker nach dem Ergebnis der Speakerliste." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Ohne gemerkten Kontext holt die Agenda-Abfrage bei gesetztem Merker die Speakerliste auch dann, wenn das Side Event keine Speaker verknüpft. Scheitert sie, bricht die Abfrage ab wie in 2a (Spec 6.2: „Fehlt dabei zugleich der Kontext, bricht die Abfrage … ab“). Gelingt sie, entsteht daraus zugleich der Kontext.
- Zusätzlicher Test „Nr. 5 (f)“: Die Verknüpfung steht nur im Programm-Detail. Er belegt, dass `detailSpeakerIds` tatsächlich in die Eingrenzung eingeht (Gerüst-Entscheidung 6).
- Beim Umschalten mit gescheiterter Speakerliste bleibt die bestehende Warnzeile „iveo switch: Speakerliste nicht abrufbar (…) — Verantwortlich wird bei der nächsten Abfrage nachgeladen.“ Die Spec-6.3-Warnung kommt aus der Agenda-Abfrage danach. Die Antwort beim Umschalten bleibt wie heute (Gerüst-Entscheidung 8).

---

### Task 8: B8 · Titler: Tabellen lesen, Schlüssel bilden, TSV mit `@kennung`; Selbsttest (tsx) und CI-Schritt

**Spec:** 7.1 (Aufbau), 7.2 (Schlüssel je Eintrag), 5.2 SP4 und SP5, 9.3 Nr. 1 und 2, 9.5 (CI). Globale Regeln G3, G7, G13, G14, G15.

**Arbeitsverzeichnis:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b`, Branch `feat/master-link-teil2b`. Alle Pfade relativ dazu. Voraussetzung: B1 hat `npm ci` ausgeführt (es gibt `node_modules`), B3 ist committet (`@jm/show` exportiert `loeseDoppelteKennungenAuf`, `ShowIveoSpeaker` hat `id?: string`).

**Dateien:**
- Create: `apps/titler/src/shared/datalink-kern.ts` (erster Teil; B9 und B10 hängen an)
- Modify: `apps/titler/src/main/iveo-show.ts` (ganz ersetzt, 46 → 57 Zeilen)
- Modify: `apps/titler/src/main/index.ts`, Zeile 20 (Import) und Zeile 150 (Aufruf in `applyShowFromPath`)
- Create: `apps/titler/test/selftest.ts` (B9–B14 erweitern die Datei; **Einfügemarke für neue Blöcke ist die Zeile `if (failed > 0) {`**, neue Blöcke stehen direkt davor)
- Modify: `apps/titler/package.json`, Zeilen 8–20 (`scripts`, eine Zeile nach Zeile 16) und `devDependencies` (eine Zeile, durch `npm install`)
- Modify: `package-lock.json`, Eintrag `apps/titler` → `devDependencies` (eine Zeile nach Zeile 759, durch `npm install`)
- Modify: `.github/workflows/ci-checks.yml`, nach Zeile 60 (Schritt hinter „Rundown (Abgleich, Sprung, scharfe Zeile)“)

`apps/titler/src/main/datalink.ts` bleibt bis B13 unverändert. Bis dahin liest der Titler noch über die alten Funktionen dort; der Kern ist bis B13 nur im Selbsttest in Gebrauch.

Zeilenangaben gelten für den Stand `996f54e2b8` plus B1–B7 (keine dieser Aufgaben berührt `apps/titler`, `package-lock.json` oder `ci-checks.yml`). Maßgeblich ist immer der wortgleiche Vorher-Text.

**Interfaces:**
- Consumes:
  - aus `@jm/show` (B3): `export function loeseDoppelteKennungenAuf<T extends { id?: string }>(liste: T[]): T[];` (erste behält ihre Kennung, jede weitere `<id>#n` mit der nächsten freien Nummer, Zusatz gekürzt auf 200 Zeichen, Eingabe unverändert) und `export interface ShowIveoSpeaker { id?: string; name: string; title?: string }`
  - aus `apps/titler/src/shared/vars.ts` (besteht): `export function resolveVars(text: string, vars: Record<string, string>): string;`
- Produces (exakt so, B9–B14 bauen darauf):
  ```ts
  // apps/titler/src/shared/datalink-kern.ts
  export const KENNUNG_SPALTE = '@kennung';
  export const SCHLUESSEL_MAX = 200;
  export interface DataEntry { key: string; label: string; datei: string; vars: Record<string, string> }
  export function ersatzSchluessel(datei: string, label?: string): string;   // 'ersatz:<datei>|<label>' bzw. 'ersatz:<datei>'
  export function istErsatzSchluessel(key: string): boolean;                 // key.startsWith('ersatz:')
  export function parseTable(content: string, datei: string): DataEntry[];
  export function parseKvDatei(content: string, datei: string): DataEntry | null;   // null ohne Variablen
  export function fuehreZusammen(teile: DataEntry[][]): DataEntry[];

  // apps/titler/src/main/iveo-show.ts (kein electron)
  export function iveoDataDir(userData: string): string;                     // join(userData, 'iveo-data')
  export function speakersTsvText(speakers: ShowIveoSpeaker[]): string;
  // Kopf 'name\tfunktion\ttitle\t@kennung', je Zeile '<name>\t<funktion>\t<funktion>\t<id ?? "">', '\n' am Ende
  export function writeSpeakersTsv(dir: string, speakers: ShowIveoSpeaker[]): string;   // schreibt <dir>/speakers.tsv, liefert dir
  ```
- Skript: `"selftest": "tsx test/selftest.ts"` in `apps/titler/package.json`, devDependency `"tsx": "^4.19.2"`.

**Verhalten (Spec 7.2, verbindlich):**
- `parseTable` liest wie bisher `datalink.ts:88-108` (Trenner Tab, sonst `;`, sonst `,`; Kopfzeile = Variablen; Label-Spalte `name`/`label`/`titel`/`title`, sonst die erste Spalte; leere Zeilen und `#`-Zeilen fallen weg). Neu:
  - Die Spalte `@kennung` (Vergleich ohne Groß- und Kleinschreibung) wird zu `key`. Sie steht nie in `vars` und gilt nie als Label-Spalte, auch nicht als Rückfall „erste Spalte“: Rückfall ist die erste Zelle, die nicht die Kennung ist.
  - Fehlt die Spalte oder ist die Zelle leer: `key = 'ersatz:<datei>|<Label>'`.
  - Zeilen werden nicht als Ganzes getrimmt, nur je Zelle. Sonst verschöbe ein Tab am Zeilenanfang (leere `@kennung` vorn) alle Spalten.
- `parseKvDatei`: Variablen wie bisher (`schlüssel=wert` / `schlüssel: wert`, Kommentare `#`, `//`, `;`), `key = 'ersatz:<datei>'`, Label aus `name`/`label`/`titel`/`title`, sonst der Dateiname ohne letzte Endung (Regex, kein `node:path`). Ohne Variablen `null`.
- `fuehreZusammen`: flach in Lesereihenfolge, `key` auf 200 Zeichen gekürzt, Doppelte über `loeseDoppelteKennungenAuf` (`#2`, `#3` …). Gleiche Eingabe → gleiche Schlüssel. Die Eingabe wird nicht verändert.
- Der Kern importiert zur Laufzeit nur `@jm/show` (G7), kein `electron`, kein `node:`.
- `iveo-show.ts` importiert kein `electron` mehr; der userData-Ordner kommt als Parameter herein. Die Spalte `@kennung` steht hinten, eine fehlende Kennung ergibt eine leere Zelle.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (neue Datei `apps/titler/test/selftest.ts`)

Muster wie `packages/iveo/test/selftest.ts` (`ok(cond, msg)`, Abschluss „ALLE TESTS OK“ bzw. „⟨n⟩ FEHLGESCHLAGEN“ mit Exit 1). Genau dieser Inhalt:

```ts
// Titler-Selbsttest ohne Electron (tsx): npm run selftest -w @jm/titler
// Master-Link Teil 2b, Spec 9.3: DataLink-Kern (Schlüssel, aktiver Eintrag, Abruf), Datenquelle und
// Speaker-TSV. Kein Netz, kein Fenster, kein Electron-Import: Die CI installiert ohne Postinstalls
// (Spec 9.5), ein Electron-Import bräche hier ab.
import { join } from 'node:path';
import {
  ersatzSchluessel,
  fuehreZusammen,
  istErsatzSchluessel,
  KENNUNG_SPALTE,
  parseKvDatei,
  parseTable,
  SCHLUESSEL_MAX,
  type DataEntry,
} from '../src/shared/datalink-kern';
import { resolveVars } from '../src/shared/vars';
import { iveoDataDir, speakersTsvText } from '../src/main/iveo-show';

let failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) console.log(`ok   ${msg}`);
  else {
    failed++;
    console.error(`FAIL ${msg}`);
  }
}

// ── datalink-kern: Tabellen lesen, Schlüssel bilden, zusammenführen (Spec 7.2; 9.3 Nr. 1, 2) ──
{
  // Speaker-TSV mit @kennung hinten (SP4).
  const tsv = speakersTsvText([
    { id: 's-1', name: 'Ada Lovelace', title: 'Mathematik' },
    { id: 's-3', name: 'Alan', title: 'Informatik' },
  ]);
  ok(
    tsv === 'name\tfunktion\ttitle\t@kennung\nAda Lovelace\tMathematik\tMathematik\ts-1\nAlan\tInformatik\tInformatik\ts-3\n',
    'speakersTsvText: Kopf name/funktion/title/@kennung, je Speaker eine Zeile, \\n am Ende',
  );
  ok(
    speakersTsvText([{ id: ' s-7 ', name: 'Ana\tSilva', title: 'Leitung\nPresse' }]).split('\n')[1] === 'Ana Silva\tLeitung Presse\tLeitung Presse\ts-7',
    'speakersTsvText: Tab und Zeilenumbruch in Zellen werden zu Leerzeichen, Kennung getrimmt',
  );
  ok(iveoDataDir('userdata') === join('userdata', 'iveo-data'), 'iveoDataDir: <userData>/iveo-data, ohne Electron');

  // Nr. 1: Die Spalte @kennung wird zum Schlüssel, nie zur Variable.
  const liste = parseTable(tsv, 'speakers.tsv');
  ok(liste.length === 2 && liste[0].key === 's-1' && liste[1].key === 's-3', 'Nr. 1: @kennung landet in key');
  ok(
    JSON.stringify(liste[0].vars) === '{"name":"Ada Lovelace","funktion":"Mathematik","title":"Mathematik"}',
    'Nr. 1: @kennung steht nicht in vars',
  );
  ok(liste[0].label === 'Ada Lovelace' && liste[0].datei === 'speakers.tsv', 'Label aus name, datei = Dateiname');
  ok(resolveVars('{{@kennung}}', liste[0].vars) === '{{@kennung}}', 'Nr. 1: {{@kennung}} löst nie auf (kein Platzhalter)');
  ok(resolveVars('{{name}} · {{funktion}}', liste[0].vars) === 'Ada Lovelace · Mathematik', 'name und funktion lösen weiter auf');
  ok(KENNUNG_SPALTE === '@kennung' && SCHLUESSEL_MAX === 200, 'Konstanten KENNUNG_SPALTE und SCHLUESSEL_MAX');

  const gross = parseTable('Name;@Kennung;Firma\nGrace;g-1;Navy\n', 'gaeste.csv');
  ok(
    gross[0].key === 'g-1' && JSON.stringify(gross[0].vars) === '{"Name":"Grace","Firma":"Navy"}' && gross[0].label === 'Grace',
    '@Kennung in anderer Schreibweise ist ebenfalls der Schlüssel',
  );

  // Rundreise: speakersTsvText → parseTable → key === id; ohne id ein Ersatz-Schlüssel.
  const rund = parseTable(
    speakersTsvText([
      { id: 's-1', name: 'Ada Lovelace', title: 'Mathematik' },
      { id: 's-9', name: 'Hedy' },
      { name: 'Ohne Kennung', title: 'Gast' },
    ]),
    'speakers.tsv',
  );
  ok(rund.map((e) => e.key).join(',') === 's-1,s-9,ersatz:speakers.tsv|Ohne Kennung', 'Rundreise: key === id, ohne id Ersatz-Schlüssel');
  ok(rund[1].vars.funktion === '' && rund[1].label === 'Hedy', 'Rundreise: leere Funktion bleibt leer, Kennung verschiebt nichts');

  // Nr. 2: Ersatz-Schlüssel.
  ok(ersatzSchluessel('speakers.tsv', 'Alan') === 'ersatz:speakers.tsv|Alan', 'Nr. 2: ersatzSchluessel für eine Tabellenzeile');
  ok(ersatzSchluessel('gast.txt') === 'ersatz:gast.txt', 'Nr. 2: ersatzSchluessel für eine schlüssel=wert-Datei');
  ok(istErsatzSchluessel('ersatz:gast.txt') && !istErsatzSchluessel('s-1'), 'istErsatzSchluessel');
  const alans = fuehreZusammen([parseTable('name\tfunktion\nAlan\tInformatik\nAlan\tMathematik\nHedy\t\n', 'speakers.tsv')]);
  ok(
    alans.map((e) => e.key).join(',') === 'ersatz:speakers.tsv|Alan,ersatz:speakers.tsv|Alan#2,ersatz:speakers.tsv|Hedy',
    'Nr. 2: ohne Spalte → ersatz:speakers.tsv|Alan, zweiter Alan → #2',
  );
  const gast = parseKvDatei('# Gast der Woche\nname=Dr. Schmidt\nfunktion: Chefarzt\n', 'gast.txt');
  ok(
    gast !== null && gast.key === 'ersatz:gast.txt' && gast.label === 'Dr. Schmidt' && gast.datei === 'gast.txt',
    'Nr. 2: gast.txt mit name=Dr. Schmidt → key ersatz:gast.txt, Label „Dr. Schmidt“',
  );
  ok(JSON.stringify(gast?.vars) === '{"name":"Dr. Schmidt","funktion":"Chefarzt"}', 'schlüssel=wert: Variablen wie bisher');
  ok(parseKvDatei('funktion=Moderation\n', 'moderation.txt')?.label === 'moderation', 'schlüssel=wert ohne name: Label = Dateiname ohne Endung');
  ok(parseKvDatei('funktion=X\n', 'a.b.txt')?.label === 'a.b', 'schlüssel=wert: nur die letzte Endung fällt weg');
  ok(parseKvDatei('# nur Kommentar\n\n', 'leer.txt') === null, 'schlüssel=wert ohne Variablen → null');

  // @kennung als erste Spalte: Das Label kommt aus name, nie aus der Kennung.
  const vorn = parseTable('@kennung,name,firma\nk-1,Hedy,MGM\n,Grace,Navy\n', 'gaeste.csv');
  ok(vorn[0].key === 'k-1' && vorn[0].label === 'Hedy', '@kennung vorn: Label aus name');
  ok(vorn[1].key === 'ersatz:gaeste.csv|Grace' && vorn[1].label === 'Grace', '@kennung vorn und leer → Ersatz-Schlüssel');
  ok(parseTable('@kennung;firma\nk-1;MGM\n', 'firmen.csv')[0].label === 'MGM', '@kennung vorn ohne Label-Spalte: Rückfall ist die erste andere Spalte');
  const tabVorn = parseTable('@kennung\tname\tfunktion\n\tGrace\tNavy\n', 'gaeste.tsv');
  ok(
    tabVorn[0].key === 'ersatz:gaeste.tsv|Grace' && tabVorn[0].vars.name === 'Grace' && tabVorn[0].vars.funktion === 'Navy',
    'TSV mit leerer @kennung vorn: keine Spalte verschiebt sich',
  );

  // Schlüssel über 200 Zeichen werden gekürzt; zusammenführen ist stabil.
  const lang = (label: string): DataEntry => ({ key: 'k'.repeat(250), label, datei: 'lang.csv', vars: {} });
  const eingabe = [[lang('A'), lang('B')], alans];
  const erst = fuehreZusammen(eingabe);
  ok(erst[0].key === 'k'.repeat(200), 'Schlüssel mit 250 Zeichen → 200');
  ok(erst[1].key === 'k'.repeat(198) + '#2', 'doppelter langer Schlüssel: Zusatz #2 bleibt in 200 Zeichen');
  ok(eingabe[0][0].key.length === 250, 'fuehreZusammen verändert die Eingabe nicht');
  const keys = (l: DataEntry[]): string => l.map((e) => e.key).join('|');
  ok(keys(fuehreZusammen(eingabe)) === keys(erst), 'fuehreZusammen zweimal mit gleicher Eingabe → dieselben Schlüssel');
  ok(keys(fuehreZusammen([erst])) === keys(erst), 'fuehreZusammen ist idempotent');
  ok(erst.length === 5 && erst[2].label === 'Alan' && erst[4].label === 'Hedy', 'fuehreZusammen hält die Reihenfolge der Dateien');
}

if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
  process.exit(1);
}
console.log('\nALLE TESTS OK');
```

- [ ] **Step 2: Test laufen lassen (rot: Skript fehlt)**

```
npm run selftest -w @jm/titler
```
Erwartet: npm bricht ab, der Test läuft nicht, Exitcode ungleich 0. Unter anderem:
```
npm error Missing script: "selftest"
```

- [ ] **Step 3: `tsx` als devDependency und Skript `selftest` eintragen** (`apps/titler/package.json`, `package-lock.json`)

```
npm install -D tsx@^4.19.2 -w @jm/titler --ignore-scripts
git diff --stat -- apps/titler/package.json package-lock.json
```
`--ignore-scripts`, damit npm keine nativen Neubauten anderer Workspaces anstößt (`electron-rebuild` in Player, Studio-Control; `install`-Skripte in `packages/ndi`, `audio`, `decklink`, `zoom-bridge`); auf den Lockfile wirkt der Schalter nicht. Erwartet: `tsx` liegt schon gehoben im Wurzel-`node_modules` (4.22.4, vom Launcher). Der Diff zeigt genau:
```
 apps/titler/package.json | 1 +
 package-lock.json        | 1 +
 2 files changed, 2 insertions(+)
```
Die beiden neuen Zeilen stehen in `devDependencies` von `apps/titler/package.json` und im Eintrag `"apps/titler"` → `"devDependencies"` von `package-lock.json`, jeweils zwischen `tailwindcss` und `typescript`:
```json
    "tailwindcss": "^4.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
```
(im Lockfile mit acht Leerzeichen Einzug). Zeigt der Diff mehr (andere Pakete, andere Versionen, ein umgeschriebener Lockfile), dann beide Dateien zurücksetzen (`git checkout -- apps/titler/package.json package-lock.json`) und genau diese eine Zeile in beiden Dateien mit dem Edit-Werkzeug einfügen (Vorher: `"tailwindcss": "^4.0.0",` + nächste Zeile `"typescript": "^5.6.3",`; Nachher wie oben). Danach `npm ls tsx -w @jm/titler`, erwartet `tsx@4.22.4` ohne `invalid`/`missing`.

Dann das Skript eintragen (`apps/titler/package.json`, Zeile 16), Vorher:
```json
    "typecheck": "npm run typecheck:node && npm run typecheck:web",
    "dist": "electron-vite build && electron-builder",
```
Nachher:
```json
    "typecheck": "npm run typecheck:node && npm run typecheck:web",
    "selftest": "tsx test/selftest.ts",
    "dist": "electron-vite build && electron-builder",
```

- [ ] **Step 4: Test laufen lassen (rot: Kern fehlt)**

```
npm run selftest -w @jm/titler
```
Erwartet: tsx bricht vor dem ersten `ok` ab, Exitcode 1:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\titler\src\shared\datalink-kern' imported from …\apps\titler\test\selftest.ts
```

- [ ] **Step 5: `apps/titler/src/shared/datalink-kern.ts` anlegen** (neue Datei, 124 Zeilen)

```ts
// --- JM Titler: DataLink-Kern (Master-Link Teil 2b, Spec 7.1–7.5) ---
//
// Ohne Electron und ohne fs: Tabellen und `schlüssel=wert`-Dateien lesen, je Eintrag einen
// Schlüssel bilden (Spec 7.2) und die Dateien eines Ordners zu einer Liste zusammenführen.
// `main/datalink.ts` liest die Dateien von der Platte und ruft diese Funktionen. Zur Laufzeit
// importiert das Modul nur `@jm/show` — der Selbsttest lädt es mit tsx, ohne Electron.
import { loeseDoppelteKennungenAuf } from '@jm/show';

/** Spalte mit der Speaker-Kennung (Spec 7.2). `@` ist kein Platzhalter-Zeichen, `{{@kennung}}` löst nie auf. */
export const KENNUNG_SPALTE = '@kennung';
/** Höchstlänge eines Schlüssels; längere werden gekürzt (Spec 7.2, wie 2a-Spec 3.5). */
export const SCHLUESSEL_MAX = 200;
/** Spaltennamen/Schlüssel, die als Eintrags-Label (für Recall-by-name) dienen. */
const LABEL_KEYS = ['name', 'label', 'titel', 'title'];

export interface DataEntry {
  /** Kennung aus der Spalte `@kennung`, sonst der Ersatz-Schlüssel (Spec 7.2). */
  key: string;
  /** Anzeige-/Recall-Name des Eintrags. */
  label: string;
  /** Dateiname ohne Ordner. Die Brücke (Spec 7.3) braucht ihn, ein `@kennung`-Schlüssel enthält ihn nicht. */
  datei: string;
  /** Variablen dieses Eintrags (schlüssel → wert), ohne die Spalte `@kennung`. */
  vars: Record<string, string>;
}

/**
 * Ersatz-Schlüssel (Spec 7.2), nur im Titler gebildet, nie geschrieben:
 * `ersatz:<Datei>|<Label>` für eine CSV/TSV-Zeile, `ersatz:<Datei>` für eine `schlüssel=wert`-Datei.
 */
export function ersatzSchluessel(datei: string, label?: string): string {
  return label === undefined ? `ersatz:${datei}` : `ersatz:${datei}|${label}`;
}

/** Ist das ein Ersatz-Schlüssel (und keine Kennung)? */
export function istErsatzSchluessel(key: string): boolean {
  return key.startsWith('ersatz:');
}

/** Eine Datenzeile `key=value` / `key: value` parsen. Kommentare (#, //, ;) raus. */
function parseLine(line: string): [string, string] | null {
  const t = line.trim();
  if (!t || t.startsWith('#') || t.startsWith('//') || t.startsWith(';')) return null;
  let idx = t.indexOf('=');
  if (idx < 0) idx = t.indexOf(':');
  if (idx <= 0) return null;
  const key = t.slice(0, idx).trim();
  let value = t.slice(idx + 1).trim();
  if (value.length >= 2 && ((value[0] === '"' && value.endsWith('"')) || (value[0] === "'" && value.endsWith("'")))) {
    value = value.slice(1, -1);
  }
  return key ? [key, value] : null;
}

function splitDelimited(line: string, delim: string): string[] {
  return line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ''));
}

/**
 * CSV/TSV mit Kopfzeile → Liste von Einträgen (Spalten = Variablen). Die Spalte `@kennung`
 * (ohne Rücksicht auf Groß- und Kleinschreibung) wird zum Schlüssel: Sie steht nicht in `vars`
 * und dient nie als Label, auch nicht als Rückfall. Fehlt sie oder ist sie leer, gilt der
 * Ersatz-Schlüssel `ersatz:<datei>|<Label>`.
 */
export function parseTable(content: string, datei: string): DataEntry[] {
  // Zeilen NICHT als Ganzes trimmen: Ein Tab am Zeilenanfang ist eine leere erste Zelle (z. B. eine
  // leere `@kennung` vorn). Getrimmt wird je Zelle in splitDelimited.
  const rows = content.split(/\r?\n/).filter((r) => r.trim() && !r.trim().startsWith('#'));
  if (rows.length < 2) return []; // nur Kopfzeile oder leer → keine Einträge
  const delim = rows[0].includes('\t') ? '\t' : rows[0].includes(';') ? ';' : ',';
  const header = splitDelimited(rows[0], delim);
  const kennungCol = header.findIndex((h) => h.toLowerCase() === KENNUNG_SPALTE);
  const labelCol = header.findIndex((h, i) => i !== kennungCol && LABEL_KEYS.includes(h.toLowerCase()));
  const out: DataEntry[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = splitDelimited(rows[r], delim);
    if (cells.every((c) => !c)) continue;
    const vars: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) if (header[i] && i !== kennungCol) vars[header[i]] = cells[i] ?? '';
    const ohneKennung = cells.filter((_c, i) => i !== kennungCol);
    const label = ((labelCol >= 0 ? cells[labelCol] : '') || ohneKennung[0] || `#${out.length + 1}`).trim();
    const kennung = kennungCol >= 0 ? (cells[kennungCol] ?? '') : '';
    out.push({ key: kennung || ersatzSchluessel(datei, label), label, datei, vars });
  }
  return out;
}

/**
 * `schlüssel=wert`-Datei → ein Eintrag mit dem Schlüssel `ersatz:<datei>`; `null` ohne Variablen.
 * Label aus name/label/titel/title, sonst der Dateiname ohne Endung.
 */
export function parseKvDatei(content: string, datei: string): DataEntry | null {
  const vars: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const kv = parseLine(line);
    if (kv) vars[kv[0]] = kv[1];
  }
  if (!Object.keys(vars).length) return null;
  let label = '';
  for (const k of Object.keys(vars)) {
    if (LABEL_KEYS.includes(k.toLowerCase()) && vars[k].trim()) {
      label = vars[k].trim();
      break;
    }
  }
  // Dateiname ohne Endung, ohne node:path: „gast.txt“ → „gast“, „a.b.txt“ → „a.b“.
  if (!label) label = datei.replace(/(.)\.[^.]*$/, '$1');
  return { key: ersatzSchluessel(datei), label, datei, vars };
}

/**
 * Die Einträge aller Dateien (in Lesereihenfolge) zu einer Liste zusammenführen. Schlüssel über
 * 200 Zeichen werden gekürzt, doppelte über `loeseDoppelteKennungenAuf` aufgelöst (der erste
 * behält seinen, jeder weitere bekommt `#2`, `#3` …). Gleiche Eingabe → gleiche Schlüssel, also
 * stabil über das Neueinlesen.
 */
export function fuehreZusammen(teile: DataEntry[][]): DataEntry[] {
  const flach = teile
    .flat()
    .map((e) => (e.key.length > SCHLUESSEL_MAX ? { ...e, key: e.key.slice(0, SCHLUESSEL_MAX) } : e));
  return loeseDoppelteKennungenAuf(flach.map((e) => ({ id: e.key, e }))).map((x) =>
    x.id === x.e.key ? x.e : { ...x.e, key: x.id },
  );
}
```
Hinweis: `loeseDoppelteKennungenAuf` arbeitet auf Objekten mit `id`. Deshalb wird jeder Eintrag kurz als `{ id: key, e }` verpackt. Die Funktion erzeugt nur für umbenannte Einträge neue Objekte; alle anderen kommen unverändert zurück.

- [ ] **Step 6: Test laufen lassen (rot: altes `iveo-show.ts` lädt Electron)**

```
npm run selftest -w @jm/titler
```
Erwartet: Abbruch vor dem ersten `ok`, Exitcode 1. Das alte `iveo-show.ts` importiert `app` aus `electron`, und unter Node liefert das Paket `electron` nur den Pfad der Programmdatei:
```
…\apps\titler\src\main\iveo-show.ts:12
import { app } from 'electron';
         ^
SyntaxError: The requested module 'electron' does not provide an export named 'app'
```
(In der CI ohne Postinstalls käme stattdessen `Electron failed to install correctly …`. Beides zeigt dasselbe: Das Modul muss ohne Electron auskommen, G7.)

- [ ] **Step 7: `apps/titler/src/main/iveo-show.ts` ohne Electron, mit `@kennung`** (Datei ganz ersetzen, danach 57 Zeilen)

```ts
// ─────────────────────────────────────────────────────────────────────────────
// iveo → Titler-DataLink (#11, Phase 3; Master-Link Teil 2b, Spec 7.2).
//
// Der Titler holt NIE selbst bei iveo (kein Token hier — single-holder liegt im
// Launcher). Stattdessen trägt die geöffnete .jmshow bereits die sanitisierte,
// token-freie Speaker-Liste (`show.iveo.speakers`). Dieses Modul schreibt sie als
// `speakers.tsv` in einen VERWALTETEN DataLink-Ordner; das bestehende DataLink-/
// Recall-System (#86/#93) macht daraus Bauchbinden-Variablen. Spalten (=Variablen):
// {{name}}, {{funktion}} und {{title}} (Alias von funktion, Abwärtskompatibilität).
// Dazu hinten `@kennung` (Teil 2b): die iveo-Speaker-ID als Schlüssel des Eintrags,
// keine Variable.
//
// Ohne Electron (Teil 2b): Der Aufrufer reicht den userData-Ordner herein, damit der
// Selbsttest das Modul mit tsx laden kann.
// ─────────────────────────────────────────────────────────────────────────────

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ShowIveoSpeaker } from '@jm/show';
import { KENNUNG_SPALTE } from '../shared/datalink-kern';

/** Verwalteter DataLink-Ordner für iveo-Speaker (getrennt von manuellen Dateien). */
export function iveoDataDir(userData: string): string {
  return join(userData, 'iveo-data');
}

/** Tab/Zeilenumbruch aus einem Zellenwert entfernen (TSV-sicher). */
function cell(v: string): string {
  return (v || '').replace(/[\t\r\n]+/g, ' ').trim();
}

/**
 * Inhalt der `speakers.tsv`: Kopf `name\tfunktion\ttitle\t@kennung`, je Speaker eine Zeile,
 * `\n` am Ende. `name` ist das Recall-Label, `funktion` iveos `speaker.title`, `title` ein
 * Alias von funktion (ältere Templates), `@kennung` die iveo-Speaker-ID (leer ohne Kennung).
 *
 * Hinweis: die „Funktion" ist iveos `speaker.title` — ist sie im Event leer, bleibt
 * {{funktion}} leer (Datenlage in iveo, nicht Titler).
 */
export function speakersTsvText(speakers: ShowIveoSpeaker[]): string {
  const header = `name\tfunktion\ttitle\t${KENNUNG_SPALTE}`;
  const rows = speakers.map((s) => {
    const funktion = cell(s.title ?? '');
    return `${cell(s.name)}\t${funktion}\t${funktion}\t${cell(s.id ?? '')}`;
  });
  return [header, ...rows].join('\n') + '\n';
}

/**
 * iveo-Speaker als `speakers.tsv` in `dir` schreiben (Ordner wird angelegt) und `dir`
 * zurückgeben. TSV (Tab) umgeht Komma-in-Namen.
 */
export function writeSpeakersTsv(dir: string, speakers: ShowIveoSpeaker[]): string {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'speakers.tsv'), speakersTsvText(speakers), 'utf8');
  return dir;
}
```
Der Import `../shared/datalink-kern` ist relativ (nicht `@shared/…`), weil tsx die Pfad-Aliase des Titlers nicht kennt (`apps/titler/tsconfig.json` hat nur `references`).

- [ ] **Step 8: Test laufen lassen (grün)**

```
npm run selftest -w @jm/titler
```
Erwartet: 31 Zeilen `ok`, keine Zeile `FAIL`, letzte Zeile `ALLE TESTS OK`, Exitcode 0. Unter anderem:
```
> @jm/titler@0.9.0 selftest
> tsx test/selftest.ts

ok   speakersTsvText: Kopf name/funktion/title/@kennung, je Speaker eine Zeile, \n am Ende
ok   Nr. 1: @kennung landet in key
ok   Nr. 1: {{@kennung}} löst nie auf (kein Platzhalter)
ok   Nr. 2: ohne Spalte → ersatz:speakers.tsv|Alan, zweiter Alan → #2
ok   Nr. 2: gast.txt mit name=Dr. Schmidt → key ersatz:gast.txt, Label „Dr. Schmidt“
ok   TSV mit leerer @kennung vorn: keine Spalte verschiebt sich
ok   Schlüssel mit 250 Zeichen → 200
ok   fuehreZusammen zweimal mit gleicher Eingabe → dieselben Schlüssel

ALLE TESTS OK
```

- [ ] **Step 9: Typecheck zeigt den alten Aufruf (rot)**

```
npm run typecheck -w @jm/titler
```
Erwartet: `typecheck:node` bricht ab, Exitcode 2:
```
src/main/index.ts(150,17): error TS2554: Expected 2 arguments, but got 1.
```

- [ ] **Step 10: `index.ts` reicht den userData-Ordner herein** (`apps/titler/src/main/index.ts`)

Ersetzung 1 (Zeile 20), Vorher:
```ts
import { writeSpeakersTsv } from './iveo-show';
```
Nachher:
```ts
import { iveoDataDir, writeSpeakersTsv } from './iveo-show';
```

Ersetzung 2 (Zeile 150, in `applyShowFromPath`), Vorher:
```ts
    const dir = writeSpeakersTsv(speakers);
```
Nachher:
```ts
    const dir = writeSpeakersTsv(iveoDataDir(app.getPath('userData')), speakers);
```
(`app` ist in Zeile 1 schon aus `electron` importiert.) Das Verhalten des Titlers bleibt gleich bis auf die vierte Spalte `@kennung` in `speakers.tsv`. Das alte `datalink.ts` liest sie bis B13 noch als Variable `@kennung` mit; das ist harmlos, denn `{{@kennung}}` ist kein gültiger Platzhalter (`vars.ts:12`).

- [ ] **Step 11: Typecheck (grün)**

```
npm run typecheck -w @jm/titler
```
Erwartet: `typecheck:node` und `typecheck:web` ohne Meldung von `tsc`, Exitcode 0. (`datalink-kern.ts` liegt in `src/shared` und wird von beiden Konfigurationen geprüft; es braucht keine Node-Typen.)

- [ ] **Step 12: CI-Schritt eintragen** (`.github/workflows/ci-checks.yml`, Zeilen 59–60, Job `selftests`)

Vorher:
```yaml
      - name: Rundown (Abgleich, Sprung, scharfe Zeile)
        run: npm run selftest -w @jm/rundown
```
Nachher:
```yaml
      - name: Rundown (Abgleich, Sprung, scharfe Zeile)
        run: npm run selftest -w @jm/rundown
      # Master-Link Teil 2b (Spec 9.5): DataLink-Kern und Datenquelle des Titlers, mit tsx, ohne Electron.
      - name: Titler (DataLink-Schlüssel, Datenquelle)
        run: npm run selftest -w @jm/titler
```
Prüfen, dass die YAML gültig bleibt (`js-yaml` liegt im Wurzel-`node_modules`):
```
node -e "const y=require('js-yaml');const d=y.load(require('fs').readFileSync('.github/workflows/ci-checks.yml','utf8'));console.log(d.jobs.selftests.steps.map(s=>s.name).filter(Boolean).slice(-2).join(' | '))"
```
Erwartet genau:
```
Rundown (Abgleich, Sprung, scharfe Zeile) | Titler (DataLink-Schlüssel, Datenquelle)
```

- [ ] **Step 13: Commit** (im Bash-Werkzeug / Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add apps/titler/src/shared/datalink-kern.ts apps/titler/src/main/iveo-show.ts apps/titler/src/main/index.ts apps/titler/test/selftest.ts apps/titler/package.json package-lock.json .github/workflows/ci-checks.yml
git status --short
```
Erwartet genau (dazu ggf. Warnungen „LF will be replaced by CRLF“ für die beiden neuen Dateien, harmlos):
```
M  .github/workflows/ci-checks.yml
M  apps/titler/package.json
M  apps/titler/src/main/index.ts
M  apps/titler/src/main/iveo-show.ts
A  apps/titler/src/shared/datalink-kern.ts
A  apps/titler/test/selftest.ts
M  package-lock.json
```
Dann:
```
git commit -m "feat(titler): DataLink-Schluessel je Eintrag, Speaker-TSV mit @kennung, Selbsttest (Teil 2b, B8)" -m "Neuer Kern apps/titler/src/shared/datalink-kern.ts ohne Electron und fs: parseTable legt die Spalte @kennung in DataEntry.key (nie in vars, nie als Label), sonst gilt der Ersatz-Schluessel ersatz:<Datei>|<Label>; parseKvDatei bildet ersatz:<Datei>; fuehreZusammen kuerzt auf 200 Zeichen und loest Doppelte ueber loeseDoppelteKennungenAuf auf. iveo-show.ts ist electron-frei und schreibt @kennung als vierte Spalte. Neuer Selbsttest mit tsx (npm run selftest -w @jm/titler), CI-Schritt im Job selftests." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Der CI-Schritt steht nach den Zeilen 59–60 (`Rundown (Abgleich, Sprung, scharfe Zeile)`), nicht nach 57–58; das sind am Stand `996f54e2b8` die Timer-Zeilen. Maßgeblich ist der Vorher-Text.
- `parseTable` trimmt die Zeilen nicht mehr als Ganzes, nur jede Zelle. Mit der neuen Spalte `@kennung` ist eine leere erste Zelle in einer TSV (eigene Datei mit `@kennung` vorn) ein normaler Fall; das alte `r.trim()` hätte dann alle Spalten um eins nach links verschoben. Für Dateien ohne leere Randzellen ist das Ergebnis gleich wie heute. Test „TSV mit leerer @kennung vorn: keine Spalte verschiebt sich“.
- `iveo-show.ts` importiert `KENNUNG_SPALTE` aus dem Kern, damit Schreiber und Leser denselben Spaltennamen nutzen.
- Drei rote Schritte statt zwei: Nach „Skript fehlt“ und „Kern fehlt“ zeigt Step 6, dass das alte `iveo-show.ts` unter tsx an Electron scheitert. Das ist der Grund für den Umbau nach G7.
- `npm install` mit `--ignore-scripts` (Gerüst: ohne). Der Lockfile wird gleich, aber npm baut keine nativen Module anderer Workspaces neu.
- Gekürzt wird nur in `fuehreZusammen` (wie im Gerüst). `parseTable` liefert lange Schlüssel ungekürzt; `datalink.ts` (B13) ruft immer `fuehreZusammen`.

**Nachgerechnet** (Kopie der Titler-Dateien im Scratchpad, `@jm/show` mit B3 nach dessen Schnittstelle, tsx 4.22.4 und TypeScript aus dem Haupt-Checkout): Step 4 rot mit `ERR_MODULE_NOT_FOUND … datalink-kern`, Step 6 rot mit `does not provide an export named 'app'`, Step 8 grün mit 31 × `ok`; Typecheck Step 9 rot mit genau `src/main/index.ts(150,17): error TS2554: Expected 2 arguments, but got 1.`, Step 11 grün (node und web). Gegenprobe: Je ein absichtlicher Fehler (Kennung in `vars`, Rückfall `cells[0]`, Zeile ganz getrimmt, nicht gekürzt, Doppelte nicht aufgelöst, TSV ohne Kennungsspalte) erzeugt jeweils mindestens eine `FAIL`-Zeile.

---

### Task 9: B9 · Titler-Kern: aktiver Eintrag über den Schlüssel, Zustandstabelle A1–A9, Brücke, Halten nach Sendung, Hinweise H1–H7

**Spec:** 7.3 (Zustandstabelle A1–A9, Brücke), 7.5 (Companion), 7.8 (Texte H1–H7, Vorrang), 7.9 (Log); 9.3 Nr. 3–10, 13–19 und die Gegenprobe; Review Focus 1. Globale Regeln G4, G7, G9, G13–G15.

**Arbeitsverzeichnis:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b`, Branch `feat/master-link-teil2b`. Alle Pfade relativ dazu. Voraussetzung: B8 ist committet.

**Dateien:**
- Modify: `apps/titler/src/shared/datalink-kern.ts`: neuer Teil direkt hinter `fuehreZusammen` (Zeilen 117–124, Dateiende), danach 374 Zeilen
- Test: `apps/titler/test/selftest.ts`
  - Zeilen 5–15 (Importe aus `node:path` und `../src/shared/datalink-kern`)
  - neuer Block direkt vor Zeile 118 (`if (failed > 0) {`)

**Interfaces:**
- Consumes (B8): `DataEntry`, `istErsatzSchluessel`, `parseTable`, `fuehreZusammen` aus `apps/titler/src/shared/datalink-kern.ts`; `speakersTsvText` aus `apps/titler/src/main/iveo-show.ts` (nur im Test); `ShowIveoSpeaker` aus `@jm/show` (B3, nur `import type` im Test).
- Produces (exakt so, B10, B11, B13 und B14 bauen darauf):
  ```ts
  export type Hinweis =
    | { art: 'H1'; label: string } | { art: 'H2'; label: string } | { art: 'H3' }
    | { art: 'H4'; grund: string } | { art: 'H5'; ref: string } | { art: 'H6'; ref: string; label: string }
    | { art: 'H7'; seit: string };
  export function uhrzeit(iso: string): string;
  export function hinweisText(h: Hinweis): string;
  export function hinweisLogZeile(h: Hinweis): string | null;     // nur H3, H7, sonst null
  export function waehleHinweis(...hinweise: Array<Hinweis | null | undefined>): Hinweis | null;
  export const HALTEN_NACH_SENDUNG_MS = 1000;
  export interface Gehalten { key: string; label: string; datei: string; vars: Record<string, string>; grund: 'A2' | 'A10'; ref?: string }
  export interface KernZustand {
    eintraege: DataEntry[];
    aktiv: string | null;
    gehalten: Gehalten | null;
    hinweis: Hinweis | null;   // nur H1, H2, H5, H6
    aufSendung: boolean;
    wegAbMs: number | null;
  }
  export interface KernSchritt { zustand: KernZustand; log: string[] }
  export function leererKern(): KernZustand;
  export function neueListe(z: KernZustand, eintraege: DataEntry[], o: { andererOrdner: boolean; leerHalten: boolean }): KernSchritt;
  export function setzeSendung(z: KernZustand, aufSendung: boolean, jetztMs: number): KernSchritt;
  export function uhrTick(z: KernZustand, jetztMs: number): KernSchritt;
  export interface KernSicht {
    entries: Array<{ key: string; label: string }>;
    activeIndex: number;
    gehalten?: { label: string };
    variables: Record<string, string>;
    hinweis: Hinweis | null;
  }
  export function kernSicht(z: KernZustand): KernSicht;
  export function companionWerte(z: KernZustand): { entry: string; entryIndex: number; entryCount: number };
  ```
  Modulintern (B10 nutzt sie, nicht exportiert): `function normLabel(s: string): string`, `function stelleVon(eintraege: DataEntry[], key: string | null): number`.

**Verhalten (Spec 7.3, 7.5, 7.8, 7.9, verbindlich):**
- **Zustand:** `aktiv` ist ein Schlüssel, nie eine Stelle. `aktiv` und `gehalten` sind nie zugleich gesetzt. Alle Funktionen sind rein; sie geben einen neuen Zustand und die Logzeilen des Schritts zurück und verändern die Eingabe nicht.
- **`neueListe(z, eintraege, o)`** in dieser Reihenfolge:
  1. **A7:** Liste leer, `o.leerHalten` und derselbe Ordner (`!o.andererOrdner`) → unverändert (dasselbe Objekt), kein Log.
  2. **Aktiver Eintrag vorhanden:**
     - Schlüssel in der neuen Liste → **A1**: derselbe Eintrag; Logzeile „DataLink: „⟨Label⟩“ hält seinen Eintrag (jetzt Nr. ⟨n⟩ von ⟨m⟩).“ nur, wenn sich die Stelle geändert hat.
     - sonst **Brücke**: Kandidaten = Einträge derselben `datei` mit gleichem `normLabel` (getrimmt, Leerraum zusammengefasst, klein). Genau ein Kandidat **und** genau einer der beiden Schlüssel ist ein Ersatz-Schlüssel → `aktiv` = Schlüssel des Kandidaten, kein Hinweis, Logzeile „DataLink: „⟨Label⟩“ hält seinen Eintrag, Schlüssel wechselt (⟨alt⟩ → ⟨neu⟩).“
     - sonst `o.andererOrdner` und nicht auf Sendung → **A9**: Eintrag 1 (bei leerer Liste keiner), kein Hinweis, kein Log.
     - sonst auf Sendung → **A2** (auch A8): `gehalten = { key, label, datei, vars (eingefroren), grund: 'A2' }`, Hinweis H1, Logzeile „DataLink: aktiver Eintrag „⟨Label⟩“ nicht mehr in der Liste, auf Sendung gehalten.“
     - sonst → **A3**: kein Eintrag, Hinweis H2, Logzeile „DataLink: aktiver Eintrag „⟨Label⟩“ nicht mehr in der Liste, kein aktiver Eintrag.“
  3. **Gehaltener Eintrag mit `grund 'A2'`:** Schlüssel wieder in der Liste (direkt oder über die Brücke, dann mit Brücken-Logzeile) → **A5**: wieder aktiv, Hinweis und Frist weg. Sonst bleibt er gehalten. Ein mit `grund 'A10'` gehaltener Eintrag wird nie wieder aktiv.
  4. **Weder aktiv noch gehalten:** nur bei `o.andererOrdner` (Ordnerwechsel, auch der erste Start) **und nicht auf Sendung** Eintrag 1 (A9), alter Hinweis weg. Auf Sendung (A8) bleibt es ohne Eintrag: Es gibt keinen Schlüssel, also auch nichts zu halten. Die Variablen bleiben leer wie beim TAKE davor (Spec 7.3: „Ein TAKE ohne aktiven Eintrag zeigt leere Platzhalter“), und ein stehender Hinweis H2/H5 bleibt. Ohne Ordnerwechsel bleibt ebenfalls alles, auch ein Hinweis H2/H5 (Review Focus 1: nach dem Zurückkommen der Zeile wird nicht von selbst Eintrag 1 aktiv).
- **`setzeSendung(z, an, jetzt)`:** `true` → `aufSendung`, `wegAbMs = null`. `false` → bei gehaltenem Eintrag `wegAbMs = jetzt + 1000`; ist schon eine Frist gesetzt, bleibt sie (der Renderer meldet `report-state` bei jeder Zustandsänderung, nicht nur beim Wechsel). Ohne gehaltenen Eintrag keine Frist.
- **`uhrTick(z, jetzt)`:** ab `jetzt >= wegAbMs` kein aktiver und kein gehaltener Eintrag mehr (**A4**). `grund 'A2'` → H2 mit der A3/A4-Logzeile; `grund 'A10'` → H5 mit dem `ref` des gehaltenen Eintrags, ohne Logzeile. Vorher unverändert (dasselbe Objekt).
- **`kernSicht`:** `entries` mit `key` und `label`; `activeIndex` = Stelle des aktiven Schlüssels, sonst −1 (auch bei gehaltenem); `gehalten` nur mit Label; `variables` vom aktiven, sonst vom gehaltenen Eintrag, sonst `{}`.
- **`companionWerte`** (7.5): `entry` = Label des aktiven oder gehaltenen Eintrags, sonst `''`; `entryIndex` = Stelle 1-basiert, bei gehaltenem oder keinem 0; `entryCount` = Länge der Liste.
- **Texte** wörtlich aus 7.8, Logzeilen H3/H7 wörtlich aus 7.9, `⟨hh:mm⟩` = Ortszeit aus `speakerVeraltetSeit` (`uhrzeit`). Vorrang in `waehleHinweis`: H1/H6 > H2/H5 > H4 > H7 > H3; bei gleichem Rang der zuerst übergebene.

---

- [ ] **Step 1: Fehlschlagende Tests schreiben** (`apps/titler/test/selftest.ts`)

Ersetzung 1 (Zeilen 5–15), Vorher:
```ts
import { join } from 'node:path';
import {
  ersatzSchluessel,
  fuehreZusammen,
  istErsatzSchluessel,
  KENNUNG_SPALTE,
  parseKvDatei,
  parseTable,
  SCHLUESSEL_MAX,
  type DataEntry,
} from '../src/shared/datalink-kern';
```
Nachher:
```ts
import { join } from 'node:path';
import type { ShowIveoSpeaker } from '@jm/show';
import {
  companionWerte,
  ersatzSchluessel,
  fuehreZusammen,
  HALTEN_NACH_SENDUNG_MS,
  hinweisLogZeile,
  hinweisText,
  istErsatzSchluessel,
  KENNUNG_SPALTE,
  kernSicht,
  leererKern,
  neueListe,
  parseKvDatei,
  parseTable,
  SCHLUESSEL_MAX,
  setzeSendung,
  uhrTick,
  uhrzeit,
  waehleHinweis,
  type DataEntry,
  type Hinweis,
  type KernZustand,
} from '../src/shared/datalink-kern';
```

Ersetzung 2 (Zeilen 118–119), Vorher:
```ts
if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
```
Nachher (die Hilfen `tsvListe`, `kernMit`, `ADA` … `NEU` und `GLEICH` stehen bewusst auf Modulebene, B10 und B11 nutzen sie):
```ts
// ── Hilfen für die Kern-Fälle (B9, B10) ──
/** Liste wie aus der Speaker-TSV gelesen: speakersTsvText → parseTable → fuehreZusammen. */
function tsvListe(speakers: ShowIveoSpeaker[], datei = 'speakers.tsv'): DataEntry[] {
  return fuehreZusammen([parseTable(speakersTsvText(speakers), datei)]);
}
/** Kernzustand direkt gebaut: Liste, Schlüssel des aktiven Eintrags, auf Sendung. */
function kernMit(eintraege: DataEntry[], aktiv: string | null, aufSendung = false): KernZustand {
  return { ...leererKern(), eintraege, aktiv, aufSendung };
}
const ADA: ShowIveoSpeaker = { id: 's-1', name: 'Ada', title: 'Mathematik' };
const GRACE: ShowIveoSpeaker = { id: 's-2', name: 'Grace', title: 'Navy' };
const ALAN: ShowIveoSpeaker = { id: 's-3', name: 'Alan', title: 'Informatik' };
const HEDY: ShowIveoSpeaker = { id: 's-4', name: 'Hedy', title: 'Film' };
const NEU: ShowIveoSpeaker = { id: 's-5', name: 'Neu', title: 'Gast' };
/** Derselbe Ordner, eigene Dateien (leere Liste wird nicht gehalten). */
const GLEICH = { andererOrdner: false, leerHalten: false };

// ── datalink-kern: aktiver Eintrag über den Schlüssel (Spec 7.3, 7.5, 7.8, 7.9; 9.3 Nr. 3–10, 13–19) ──
{
  const vier = tsvListe([ADA, GRACE, ALAN, HEDY]);
  const fuenf = tsvListe([NEU, ADA, GRACE, ALAN, HEDY]);

  // Nr. 3: Alan bleibt Alan.
  const nr3 = neueListe(kernMit(vier, 's-3', true), fuenf, GLEICH);
  ok(kernSicht(nr3.zustand).activeIndex === 3 && companionWerte(nr3.zustand).entry === 'Alan', 'Nr. 3: „Neu“ davor → aktiv bleibt Alan, jetzt Stelle 4');
  ok(nr3.log.length === 1 && nr3.log[0] === 'DataLink: „Alan“ hält seinen Eintrag (jetzt Nr. 4 von 5).', 'Nr. 3: Logzeile A1 mit neuer Stelle');
  ok(kernSicht(nr3.zustand).variables.name === 'Alan' && nr3.zustand.hinweis === null, 'Nr. 3: Variablen von Alan, kein Hinweis');
  ok(neueListe(nr3.zustand, fuenf, GLEICH).log.length === 0, 'A1 ohne neue Stelle: keine Logzeile');

  // Gegenprobe (9.3): eine Variante, die die Stelle statt des Schlüssels hält, muss an Fall 3 scheitern.
  function neueListeNachStelle(alt: KernZustand, neu: DataEntry[]): KernZustand {
    const stelle = alt.eintraege.findIndex((e) => e.key === alt.aktiv);
    const bleibt = stelle >= 0 && stelle < neu.length ? stelle : 0;
    return { ...alt, eintraege: neu, aktiv: neu.length ? neu[bleibt].key : null };
  }
  const fall3 = (zz: KernZustand): boolean => kernSicht(zz).activeIndex === 3 && companionWerte(zz).entry === 'Alan';
  const variante = neueListeNachStelle(kernMit(vier, 's-3', true), fuenf);
  ok(fall3(nr3.zustand) && !fall3(variante), 'Gegenprobe: der Kern besteht Fall 3, die Variante „Stelle halten“ nicht');
  ok(companionWerte(variante).entry === 'Grace', 'Gegenprobe: … die Variante zeigt Grace statt Alan');

  // Nr. 4: neue Funktion bei gleichem Schlüssel.
  const nr4 = neueListe(nr3.zustand, tsvListe([NEU, ADA, GRACE, { ...ALAN, title: 'Kryptographie' }, HEDY]), GLEICH);
  ok(
    kernSicht(nr4.zustand).activeIndex === 3 && kernSicht(nr4.zustand).variables.funktion === 'Kryptographie',
    'Nr. 4: neue Funktion → derselbe Eintrag, neue Variablen',
  );

  // Nr. 5: Schlüssel fehlt, auf Sendung → A2.
  const ohneAlan = tsvListe([NEU, ADA, GRACE, HEDY]);
  const nr5 = neueListe(kernMit(vier, 's-3', true), ohneAlan, GLEICH);
  const s5 = kernSicht(nr5.zustand);
  ok(s5.activeIndex === -1 && s5.gehalten?.label === 'Alan', 'Nr. 5: auf Sendung → gehalten, kein Eintrag markiert (A2)');
  ok(s5.variables.name === 'Alan' && s5.variables.funktion === 'Informatik', 'Nr. 5: Variablen eingefroren');
  ok(JSON.stringify(s5.hinweis) === '{"art":"H1","label":"Alan"}', 'Nr. 5: Hinweis H1');
  ok(nr5.log.length === 1 && nr5.log[0] === 'DataLink: aktiver Eintrag „Alan“ nicht mehr in der Liste, auf Sendung gehalten.', 'Nr. 5: Logzeile A2');
  ok(nr5.zustand.gehalten?.grund === 'A2' && nr5.zustand.gehalten.key === 's-3', 'Nr. 5: gehalten mit grund A2 und dem Schlüssel');
  const nochmal = neueListe(nr5.zustand, ohneAlan, GLEICH);
  ok(nochmal.zustand.gehalten?.label === 'Alan' && nochmal.zustand.hinweis?.art === 'H1' && nochmal.log.length === 0, 'A2: erneutes Einlesen ohne Alan → bleibt gehalten, keine neue Logzeile');

  // Nr. 6: Schlüssel fehlt, nicht auf Sendung → A3.
  const nr6 = neueListe(kernMit(vier, 's-3', false), ohneAlan, GLEICH);
  const s6 = kernSicht(nr6.zustand);
  ok(s6.activeIndex === -1 && s6.gehalten === undefined && JSON.stringify(s6.variables) === '{}', 'Nr. 6: nicht auf Sendung → kein aktiver Eintrag, leere Variablen (A3)');
  ok(JSON.stringify(s6.hinweis) === '{"art":"H2","label":"Alan"}', 'Nr. 6: Hinweis H2');
  ok(nr6.log.length === 1 && nr6.log[0] === 'DataLink: aktiver Eintrag „Alan“ nicht mehr in der Liste, kein aktiver Eintrag.', 'Nr. 6: Logzeile A3');

  // Nr. 7: gehalten, Sendung endet → 1 s später kein Eintrag (übergebene Uhr).
  ok(HALTEN_NACH_SENDUNG_MS === 1000, 'HALTEN_NACH_SENDUNG_MS = 1000');
  const aus = setzeSendung(nr5.zustand, false, 1000).zustand;
  ok(aus.wegAbMs === 2000 && aus.aufSendung === false, 'Nr. 7: Sendung endet bei 1000 → Frist 2000');
  ok(setzeSendung(aus, false, 1500).zustand.wegAbMs === 2000, 'Nr. 7: eine wiederholte Meldung „nicht auf Sendung“ verschiebt die Frist nicht');
  const t1999 = uhrTick(aus, 1999);
  ok(t1999.zustand.gehalten?.label === 'Alan' && t1999.log.length === 0, 'Nr. 7: bei 1999 noch gehalten');
  const t2000 = uhrTick(aus, 2000);
  const s7 = kernSicht(t2000.zustand);
  ok(s7.gehalten === undefined && s7.activeIndex === -1 && JSON.stringify(s7.variables) === '{}', 'Nr. 7: bei 2000 kein Eintrag mehr (A4)');
  ok(JSON.stringify(s7.hinweis) === '{"art":"H2","label":"Alan"}' && t2000.zustand.wegAbMs === null, 'Nr. 7: … Hinweis H2, Frist weg');
  ok(t2000.log.length === 1 && t2000.log[0] === 'DataLink: aktiver Eintrag „Alan“ nicht mehr in der Liste, kein aktiver Eintrag.', 'Nr. 7: … Logzeile A4');
  const take = setzeSendung(aus, true, 1500).zustand;
  ok(take.wegAbMs === null && uhrTick(take, 5000).zustand.gehalten?.label === 'Alan', 'Nr. 7: TAKE bei 1500 → bleibt gehalten');
  ok(setzeSendung(kernMit(vier, 's-3', true), false, 1000).zustand.wegAbMs === null, 'Ende der Sendung ohne gehaltenen Eintrag: keine Frist');
  ok(uhrTick(nr3.zustand, 99_999).zustand === nr3.zustand, 'uhrTick ohne Frist: unverändert');

  // Nr. 8: gehalten, Schlüssel kommt zurück → A5.
  const nr8 = neueListe(nr5.zustand, fuenf, GLEICH);
  const s8 = kernSicht(nr8.zustand);
  ok(s8.activeIndex === 3 && s8.gehalten === undefined && s8.hinweis === null, 'Nr. 8: Schlüssel zurück → wieder aktiv, Hinweis weg (A5)');
  const nr8b = neueListe(aus, fuenf, GLEICH);
  ok(nr8b.zustand.aktiv === 's-3' && nr8b.zustand.wegAbMs === null, 'Nr. 8: … auch innerhalb der Frist, die Frist entfällt');

  // Nach A10 gehalten (Zustand direkt gebaut, den Abruf gibt es erst in B10): nie wieder aktiv; A4 → H5.
  const a10: KernZustand = {
    ...kernMit(fuenf, null, true),
    gehalten: { key: 's-3', label: 'Alan', datei: 'speakers.tsv', vars: { name: 'Alan' }, grund: 'A10', ref: 'Niemand' },
    hinweis: { art: 'H6', ref: 'Niemand', label: 'Alan' },
  };
  const a10neu = neueListe(a10, fuenf, GLEICH);
  ok(a10neu.zustand.aktiv === null && a10neu.zustand.gehalten?.grund === 'A10', 'A10: beim Neueinlesen nie wieder aktiv, auch wenn der Schlüssel in der Liste steht');
  const a10ende = uhrTick(setzeSendung(a10, false, 0).zustand, 1000);
  ok(a10ende.zustand.gehalten === null && JSON.stringify(a10ende.zustand.hinweis) === '{"art":"H5","ref":"Niemand"}' && a10ende.log.length === 0, 'A4 nach A10: H6 wird zu H5, ohne Logzeile');

  // Nr. 9: Liste komplett ersetzt.
  const nr9 = neueListe(kernMit(vier, 's-3', true), tsvListe([{ id: 's-7', name: 'Zoe' }, ALAN, { id: 's-8', name: 'Max' }]), GLEICH);
  ok(kernSicht(nr9.zustand).activeIndex === 1 && companionWerte(nr9.zustand).entry === 'Alan', 'Nr. 9: Liste ersetzt, Alan an anderer Stelle → Alan');

  // Nr. 10: Liste schrumpft unter die alte Stelle.
  const nr10 = neueListe(nr3.zustand, tsvListe([ADA, ALAN]), GLEICH);
  ok(kernSicht(nr10.zustand).activeIndex === 1 && companionWerte(nr10.zustand).entry === 'Alan', 'Nr. 10: Liste schrumpft unter die alte Stelle → weiter Alan');

  // Nr. 13: Companion-Werte.
  ok(JSON.stringify(companionWerte(nr3.zustand)) === '{"entry":"Alan","entryIndex":4,"entryCount":5}', 'Nr. 13: Companion aktiv');
  ok(JSON.stringify(companionWerte(nr5.zustand)) === '{"entry":"Alan","entryIndex":0,"entryCount":4}', 'Nr. 13: Companion gehalten');
  ok(JSON.stringify(companionWerte(nr6.zustand)) === '{"entry":"","entryIndex":0,"entryCount":4}', 'Nr. 13: Companion keiner');

  // Nr. 14: anderer Ordner (A8/A9), erster Start, A7.
  const gaeste = fuehreZusammen([parseTable('name,firma\nZoe,ACME\nMax,Muster\n', 'gaeste.csv')]);
  const wechsel = { andererOrdner: true, leerHalten: false };
  const nr14 = neueListe(kernMit(vier, 's-3', false), gaeste, wechsel);
  ok(kernSicht(nr14.zustand).activeIndex === 0 && nr14.zustand.hinweis === null && nr14.log.length === 0, 'Nr. 14: anderer Ordner, nicht auf Sendung, Schlüssel fehlt → Eintrag 1 (A9)');
  const a8 = neueListe(kernMit(vier, 's-3', true), gaeste, wechsel);
  ok(a8.zustand.gehalten?.label === 'Alan' && a8.zustand.hinweis?.art === 'H1', 'A8: anderer Ordner auf Sendung, Schlüssel fehlt → gehalten (A2)');
  ok(neueListe(kernMit(vier, 's-3', true), fuenf, wechsel).zustand.aktiv === 's-3', 'A8: anderer Ordner, Schlüssel gefunden → A1');
  ok(kernSicht(neueListe(nr6.zustand, gaeste, wechsel).zustand).activeIndex === 0 && neueListe(nr6.zustand, gaeste, wechsel).zustand.hinweis === null, 'A9 ohne aktiven Eintrag: Eintrag 1, alter Hinweis weg');
  // A8 ohne aktiven Eintrag: Nach A3/A4 ist nichts aktiv, ein TAKE zeigt leere Platzhalter. Ein Ordnerwechsel auf Sendung
  // (Ordnerwahl, K1, andere Show) darf die Bauchbinde nicht ohne Abruf auf Person 1 springen lassen.
  const ohneEintragAuf: KernZustand = { ...kernMit(vier, null, true), hinweis: { art: 'H2', label: 'Alan' } };
  const a8leer = neueListe(ohneEintragAuf, gaeste, wechsel);
  const s8leer = kernSicht(a8leer.zustand);
  ok(
    s8leer.activeIndex === -1 && s8leer.gehalten === undefined && JSON.stringify(s8leer.variables) === '{}' && s8leer.entries.length === 2 &&
      JSON.stringify(a8leer.zustand.hinweis) === '{"art":"H2","label":"Alan"}' && a8leer.log.length === 0,
    'A8 ohne aktiven Eintrag: anderer Ordner auf Sendung → bleibt ohne Eintrag, leere Variablen, Hinweis bleibt',
  );
  ok(kernSicht(neueListe(leererKern(), vier, { andererOrdner: true, leerHalten: true }).zustand).activeIndex === 0, 'erster Start (anderer Ordner, nichts aktiv) → Eintrag 1');
  ok(kernSicht(neueListe(leererKern(), vier, GLEICH).zustand).activeIndex === -1, 'gleicher Ordner, nichts aktiv → bleibt ohne Eintrag');
  const a7 = neueListe(nr3.zustand, [], { andererOrdner: false, leerHalten: true });
  ok(a7.zustand === nr3.zustand && a7.log.length === 0, 'A7: leere Liste bei leerHalten → unverändert');
  const leerWechsel = neueListe(kernMit(vier, 's-3', false), [], { andererOrdner: true, leerHalten: true });
  ok(leerWechsel.zustand.eintraege.length === 0 && leerWechsel.zustand.aktiv === null && leerWechsel.zustand.hinweis === null, 'Wechsel auf einen leeren Ordner: Liste leer, ohne Hinweis (kein A7)');

  // Nr. 15 und 16: Brücke zwischen Ersatz-Schlüssel und Kennung (5.3, 7.3).
  const ohneIds = tsvListe([{ name: 'Ada', title: 'Mathematik' }, { name: 'Alan', title: 'Informatik' }]);
  const mitIds = tsvListe([ADA, ALAN]);
  for (const sendung of [true, false]) {
    const wie = sendung ? 'auf Sendung' : 'ohne Sendung';
    const hin = neueListe(kernMit(ohneIds, 'ersatz:speakers.tsv|Alan', sendung), mitIds, GLEICH);
    ok(hin.zustand.aktiv === 's-3' && hin.zustand.gehalten === null && hin.zustand.hinweis === null, `Nr. 15: Brücke Ersatz → Kennung (${wie}): derselbe Eintrag, neuer Schlüssel, kein Hinweis`);
    ok(hin.log.length === 1 && hin.log[0] === 'DataLink: „Alan“ hält seinen Eintrag, Schlüssel wechselt (ersatz:speakers.tsv|Alan → s-3).', `Nr. 15: … Logzeile Brücke (${wie})`);
    const zurueck = neueListe(kernMit(mitIds, 's-3', sendung), ohneIds, GLEICH);
    ok(zurueck.zustand.aktiv === 'ersatz:speakers.tsv|Alan' && zurueck.zustand.gehalten === null && zurueck.zustand.hinweis === null, `Nr. 16: Brücke Kennung → Ersatz (${wie})`);
    ok(zurueck.log[0] === 'DataLink: „Alan“ hält seinen Eintrag, Schlüssel wechselt (s-3 → ersatz:speakers.tsv|Alan).', `Nr. 16: … Logzeile Brücke (${wie})`);
  }
  const schreibweise = neueListe(kernMit(tsvListe([{ name: 'ALAN   TURING' }]), 'ersatz:speakers.tsv|ALAN   TURING', true), tsvListe([{ id: 's-3', name: 'Alan Turing' }]), GLEICH);
  ok(schreibweise.zustand.aktiv === 's-3', 'Brücke: Label ohne Rücksicht auf Groß-/Kleinschreibung, Leerraum zusammengefasst');

  // Nr. 17: Brücke beim gehaltenen Eintrag → A5.
  const gehaltenErsatz = neueListe(kernMit(ohneIds, 'ersatz:speakers.tsv|Alan', true), tsvListe([{ name: 'Ada' }]), GLEICH).zustand;
  const nr17 = neueListe(gehaltenErsatz, mitIds, GLEICH);
  ok(gehaltenErsatz.gehalten?.key === 'ersatz:speakers.tsv|Alan', 'Nr. 17: Vorbedingung: Alan mit Ersatz-Schlüssel gehalten');
  ok(nr17.zustand.aktiv === 's-3' && nr17.zustand.gehalten === null && nr17.zustand.hinweis === null, 'Nr. 17: Brücke beim gehaltenen Eintrag → wieder aktiv mit der Kennung (A5)');
  ok(nr17.log.length === 1 && nr17.log[0] === 'DataLink: „Alan“ hält seinen Eintrag, Schlüssel wechselt (ersatz:speakers.tsv|Alan → s-3).', 'Nr. 17: … Logzeile Brücke');

  // Nr. 18: kein eindeutiger Kandidat → A2 bzw. A3.
  const doppelt = tsvListe([ADA, ALAN, { id: 's-8', name: 'Alan', title: 'Zweiter' }]);
  const andereDatei = fuehreZusammen([parseTable(speakersTsvText([ADA]), 'speakers.tsv'), parseTable(speakersTsvText([ALAN]), 'gaeste.tsv')]);
  for (const [liste, wo] of [[doppelt, 'Name zweimal in der Datei'], [andereDatei, 'Name nur in einer anderen Datei']] as const) {
    const auf = neueListe(kernMit(ohneIds, 'ersatz:speakers.tsv|Alan', true), liste, GLEICH);
    ok(auf.zustand.aktiv === null && auf.zustand.gehalten?.label === 'Alan' && auf.zustand.hinweis?.art === 'H1', `Nr. 18: ${wo}, auf Sendung → keine Brücke, A2`);
    const ab = neueListe(kernMit(ohneIds, 'ersatz:speakers.tsv|Alan', false), liste, GLEICH);
    ok(ab.zustand.aktiv === null && ab.zustand.gehalten === null && ab.zustand.hinweis?.art === 'H2', `Nr. 18: ${wo}, ohne Sendung → keine Brücke, A3`);
  }

  // Nr. 19: zwei verschiedene Kennungen, gleicher Name → nie überbrücken.
  const andereKennung = tsvListe([ADA, { id: 's-9', name: 'Alan', title: 'Informatik' }]);
  const n19auf = neueListe(kernMit(mitIds, 's-3', true), andereKennung, GLEICH);
  ok(n19auf.zustand.aktiv === null && n19auf.zustand.gehalten?.key === 's-3' && !n19auf.log.some((l) => l.includes('Schlüssel wechselt')), 'Nr. 19: s-3 → s-9 gleicher Name, auf Sendung → keine Brücke, A2');
  const n19ab = neueListe(kernMit(mitIds, 's-3', false), andereKennung, GLEICH);
  ok(n19ab.zustand.aktiv === null && n19ab.zustand.hinweis?.art === 'H2', 'Nr. 19: … ohne Sendung → keine Brücke, A3');

  // Review Focus 1: eigene CSV wird beim Speichern kurz leer oder halb gelesen (Quelle ordner, leerHalten:false).
  const csv = 'name,funktion\nAda,Mathematik\nAlan,Informatik\n';
  const eigene = fuehreZusammen([parseTable(csv, 'gaeste.csv')]);
  const alanCsv = 'ersatz:gaeste.csv|Alan';
  const leerAuf = neueListe(kernMit(eigene, alanCsv, true), fuehreZusammen([parseTable('', 'gaeste.csv')]), GLEICH);
  ok(kernSicht(leerAuf.zustand).activeIndex === -1 && leerAuf.zustand.gehalten?.label === 'Alan' && leerAuf.zustand.hinweis?.art === 'H1', 'Review 1: CSV leer gelesen, auf Sendung → Alan gehalten mit H1, nicht Eintrag 1');
  const halb = neueListe(kernMit(eigene, alanCsv, true), fuehreZusammen([parseTable('name,funktion\nAda,Mathematik\n', 'gaeste.csv')]), GLEICH);
  ok(halb.zustand.gehalten?.label === 'Alan' && companionWerte(halb.zustand).entry === 'Alan' && kernSicht(halb.zustand).activeIndex === -1, 'Review 1: CSV halb gelesen → gehalten, Ada wird nicht aktiv');
  const zurueckAuf = neueListe(leerAuf.zustand, eigene, GLEICH);
  ok(kernSicht(zurueckAuf.zustand).activeIndex === 1 && zurueckAuf.zustand.hinweis === null, 'Review 1: Zeile kommt zurück → Alan wieder aktiv (A5), ohne Hinweis');
  const leerAus = neueListe(kernMit(eigene, alanCsv, false), [], GLEICH);
  ok(kernSicht(leerAus.zustand).activeIndex === -1 && leerAus.zustand.hinweis?.art === 'H2', 'Review 1: ohne Sendung → kein aktiver Eintrag (A3)');
  ok(kernSicht(neueListe(leerAus.zustand, eigene, GLEICH).zustand).activeIndex === -1, 'Review 1: … nach dem Zurückkommen wird nicht von selbst Eintrag 1 aktiv');

  // Hinweise: Texte wörtlich (7.8), Logzeilen (7.9), Vorrang.
  const lokal = new Date(2026, 8, 29, 9, 58).toISOString();
  ok(uhrzeit(lokal) === '09:58', 'uhrzeit: Ortszeit hh:mm');
  ok(uhrzeit('gestern') === '--:--', 'uhrzeit: unlesbar → --:--');
  const H1: Hinweis = { art: 'H1', label: 'Alan' };
  const H2: Hinweis = { art: 'H2', label: 'Alan' };
  const H3: Hinweis = { art: 'H3' };
  const H4: Hinweis = { art: 'H4', grund: 'EBUSY' };
  const H5: Hinweis = { art: 'H5', ref: 'Niemand' };
  const H6: Hinweis = { art: 'H6', ref: 'Niemand', label: 'Alan' };
  const H7: Hinweis = { art: 'H7', seit: lokal };
  ok(hinweisText(H1) === '„Alan“ ist nicht mehr in der Liste. Die Bauchbinde bleibt stehen, bis du sie ausblendest oder einen Eintrag abrufst.', 'H1 wörtlich');
  ok(hinweisText(H2) === '„Alan“ ist nicht mehr in der Liste. Bitte einen Eintrag abrufen.', 'H2 wörtlich');
  ok(hinweisText(H3) === 'Liste aus früherem Stand: Die Show enthält gerade keine Speaker.', 'H3 wörtlich');
  ok(hinweisText(H4) === 'Liste aus früherem Stand: Show nicht lesbar (EBUSY).', 'H4 wörtlich');
  ok(hinweisText(H5) === 'Abruf „Niemand“: nicht in der Liste. Bitte einen Eintrag abrufen.', 'H5 wörtlich');
  ok(hinweisText(H6) === 'Abruf „Niemand“: nicht in der Liste. Auf Sendung bleibt „Alan“, bis du sie ausblendest oder einen Eintrag abrufst.', 'H6 wörtlich');
  ok(hinweisText(H7) === 'Liste aus früherem Stand: Speakerliste von iveo nicht abrufbar (seit 09:58).', 'H7 wörtlich, Ortszeit aus speakerVeraltetSeit');
  ok(hinweisLogZeile(H7) === 'iveo: Show meldet Speakerliste nicht abrufbar seit 09:58, Liste aus früherem Stand.', 'Logzeile H7');
  ok(hinweisLogZeile(H3) === 'iveo: Show ohne Speaker, Liste aus früherem Stand bleibt.', 'Logzeile H3');
  ok([H1, H2, H4, H5, H6].every((h) => hinweisLogZeile(h) === null), 'keine Logzeile für H1, H2, H4, H5, H6');
  ok(waehleHinweis(H3, H7) === H7 && waehleHinweis(H7, H3) === H7, 'Vorrang: H7 vor H3');
  ok(waehleHinweis(H7, H4) === H4, 'Vorrang: H4 vor H7');
  ok(waehleHinweis(H4, H2) === H2 && waehleHinweis(H4, H5) === H5, 'Vorrang: H2/H5 vor H4');
  ok(waehleHinweis(H5, H6) === H6 && waehleHinweis(H2, H1) === H1, 'Vorrang: H1/H6 vor H2/H5');
  ok(waehleHinweis(H1, H6) === H1 && waehleHinweis(H6, H1) === H6, 'gleicher Rang: der zuerst übergebene');
  ok(waehleHinweis(null, undefined) === null && waehleHinweis() === null, 'kein Hinweis → null');
}

if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
```
Hinweis zu `uhrzeit`: Der Test baut die ISO-Zeit aus einer Ortszeit (`new Date(2026, 8, 29, 9, 58)`). So ist das Ergebnis `09:58` in jeder Zeitzone gleich, auch in der CI (UTC).

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/titler
```
Erwartet: tsx bricht vor dem ersten `ok` ab, Exitcode 1. Node nennt einen der fehlenden Namen (nachgemessen: `HALTEN_NACH_SENDUNG_MS`; ein anderer der neuen Namen wie `neueListe` ist ebenso richtig):
```
SyntaxError: The requested module '../src/shared/datalink-kern' does not provide an export named 'HALTEN_NACH_SENDUNG_MS'
```

- [ ] **Step 3: Kern um den aktiven Eintrag erweitern** (`apps/titler/src/shared/datalink-kern.ts`, Zeilen 121–124, das Ende von `fuehreZusammen` und der Datei)

Vorher:
```ts
  return loeseDoppelteKennungenAuf(flach.map((e) => ({ id: e.key, e }))).map((x) =>
    x.id === x.e.key ? x.e : { ...x.e, key: x.id },
  );
}
```
Nachher:
```ts
  return loeseDoppelteKennungenAuf(flach.map((e) => ({ id: e.key, e }))).map((x) =>
    x.id === x.e.key ? x.e : { ...x.e, key: x.id },
  );
}

// ── Aktiver Eintrag über den Schlüssel (Spec 7.3, 7.5, 7.8, 7.9) ─────────────────────────────

/** Stehender Hinweis (Spec 7.8). H1, H2, H5, H6 setzt der Kern, H3, H4, H7 die Datenquelle. */
export type Hinweis =
  | { art: 'H1'; label: string }
  | { art: 'H2'; label: string }
  | { art: 'H3' }
  | { art: 'H4'; grund: string }
  | { art: 'H5'; ref: string }
  | { art: 'H6'; ref: string; label: string }
  | { art: 'H7'; seit: string };

/** Ortszeit `hh:mm` einer ISO-Zeit (H7: `speakerVeraltetSeit`). Unlesbar → `--:--`. */
export function uhrzeit(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Text eines Hinweises, wörtlich aus Spec 7.8. */
export function hinweisText(h: Hinweis): string {
  switch (h.art) {
    case 'H1':
      return `„${h.label}“ ist nicht mehr in der Liste. Die Bauchbinde bleibt stehen, bis du sie ausblendest oder einen Eintrag abrufst.`;
    case 'H2':
      return `„${h.label}“ ist nicht mehr in der Liste. Bitte einen Eintrag abrufen.`;
    case 'H3':
      return 'Liste aus früherem Stand: Die Show enthält gerade keine Speaker.';
    case 'H4':
      return `Liste aus früherem Stand: Show nicht lesbar (${h.grund}).`;
    case 'H5':
      return `Abruf „${h.ref}“: nicht in der Liste. Bitte einen Eintrag abrufen.`;
    case 'H6':
      return `Abruf „${h.ref}“: nicht in der Liste. Auf Sendung bleibt „${h.label}“, bis du sie ausblendest oder einen Eintrag abrufst.`;
    case 'H7':
      return `Liste aus früherem Stand: Speakerliste von iveo nicht abrufbar (seit ${uhrzeit(h.seit)}).`;
  }
}

/** Logzeile zu einem Hinweis der Datenquelle (Spec 7.9): nur H3 und H7, sonst null. */
export function hinweisLogZeile(h: Hinweis): string | null {
  if (h.art === 'H7') return `iveo: Show meldet Speakerliste nicht abrufbar seit ${uhrzeit(h.seit)}, Liste aus früherem Stand.`;
  if (h.art === 'H3') return 'iveo: Show ohne Speaker, Liste aus früherem Stand bleibt.';
  return null;
}

/** Vorrang (Spec 7.8): H1/H6 vor H2/H5 vor H4 vor H7 vor H3. Kleiner = steht vorn. */
const RANG: Record<Hinweis['art'], number> = { H1: 0, H6: 0, H2: 1, H5: 1, H4: 2, H7: 3, H3: 4 };

/** Den einen Hinweis wählen, der steht. Bei gleichem Rang gilt der zuerst übergebene. */
export function waehleHinweis(...hinweise: Array<Hinweis | null | undefined>): Hinweis | null {
  let vorn: Hinweis | null = null;
  for (const h of hinweise) if (h && (vorn === null || RANG[h.art] < RANG[vorn.art])) vorn = h;
  return vorn;
}

/** Halten nach dem Ende der Sendung (Spec 7.3 A4). Deckt die Ausblendung (450 ms, engine.ts:15) ab. */
export const HALTEN_NACH_SENDUNG_MS = 1000;

/** Ein Eintrag, der auf Sendung war und nicht mehr gilt. Seine Variablen bleiben eingefroren (Spec 7.3). */
export interface Gehalten {
  key: string;
  label: string;
  datei: string;
  vars: Record<string, string>;
  /** A2: aus der Liste verschwunden, kommt mit A5 zurück. A10: Abruf ohne Treffer, wird nie wieder aktiv. */
  grund: 'A2' | 'A10';
  /** Nur bei A10: der Abruf ohne Treffer (H6, nach dem Ende der Sendung H5). */
  ref?: string;
}

export interface KernZustand {
  eintraege: DataEntry[];
  /** Schlüssel des aktiven Eintrags, null ohne. Nie zugleich mit `gehalten` gesetzt. */
  aktiv: string | null;
  gehalten: Gehalten | null;
  /** Hinweis des Kerns: nur H1, H2, H5, H6. */
  hinweis: Hinweis | null;
  /** Zuletzt gemeldet: Bauchbinde auf Sendung (`on_air`). */
  aufSendung: boolean;
  /** Ab diesem Zeitpunkt fällt der gehaltene Eintrag weg (Ende der Sendung + 1 s); null = keine Frist. */
  wegAbMs: number | null;
}

/** Neuer Zustand und die Logzeilen dieses Schritts (Spec 7.9). */
export interface KernSchritt {
  zustand: KernZustand;
  log: string[];
}

export function leererKern(): KernZustand {
  return { eintraege: [], aktiv: null, gehalten: null, hinweis: null, aufSendung: false, wegAbMs: null };
}

/** Label-Vergleich für Brücke und Abruf: getrimmt, Leerraum zusammengefasst, klein. */
function normLabel(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

function stelleVon(eintraege: DataEntry[], key: string | null): number {
  return key === null ? -1 : eintraege.findIndex((e) => e.key === key);
}

/**
 * Brücke (Spec 7.3): der Kandidat der neuen Liste aus derselben Datei mit demselben Label — nur bei
 * genau einem Kandidaten und nur, wenn genau einer der beiden Schlüssel ein Ersatz-Schlüssel ist.
 * Zwei verschiedene Kennungen werden nie überbrückt.
 */
function bruecke(alt: { key: string; label: string; datei: string }, eintraege: DataEntry[]): DataEntry | null {
  const kandidaten = eintraege.filter((e) => e.datei === alt.datei && normLabel(e.label) === normLabel(alt.label));
  if (kandidaten.length !== 1) return null;
  return istErsatzSchluessel(alt.key) !== istErsatzSchluessel(kandidaten[0].key) ? kandidaten[0] : null;
}

function brueckenZeile(label: string, alt: string, neu: string): string {
  return `DataLink: „${label}“ hält seinen Eintrag, Schlüssel wechselt (${alt} → ${neu}).`;
}

/**
 * Eine neu eingelesene Liste anwenden (Spec 7.3: A1–A3, A5, A7–A9, Brücke).
 * - `leerHalten`: Eine leere Liste aus demselben Ordner lässt alles unverändert (A7). Der Aufrufer
 *   setzt es bei der Datenquelle Show bzw. frühere Show, nicht beim eigenen Ordner.
 * - `andererOrdner`: Der Ordner hat gewechselt (Quellenwechsel, auch der erste Start).
 */
export function neueListe(
  z: KernZustand,
  eintraege: DataEntry[],
  o: { andererOrdner: boolean; leerHalten: boolean },
): KernSchritt {
  const log: string[] = [];
  if (eintraege.length === 0 && o.leerHalten && !o.andererOrdner) return { zustand: z, log }; // A7
  const aktivWird = (stelle: number): KernZustand => ({
    ...z,
    eintraege,
    aktiv: eintraege[stelle].key,
    gehalten: null,
    hinweis: null,
    wegAbMs: null,
  });

  if (z.aktiv !== null) {
    const altStelle = stelleVon(z.eintraege, z.aktiv);
    const alt = altStelle >= 0 ? z.eintraege[altStelle] : null;
    const stelle = stelleVon(eintraege, z.aktiv);
    if (stelle >= 0) {
      // A1: derselbe Eintrag an seiner neuen Stelle, gezeichnet mit den Variablen der neuen Liste.
      if (stelle !== altStelle) {
        log.push(`DataLink: „${eintraege[stelle].label}“ hält seinen Eintrag (jetzt Nr. ${stelle + 1} von ${eintraege.length}).`);
      }
      return { zustand: { ...z, eintraege }, log };
    }
    const b = alt ? bruecke(alt, eintraege) : null;
    if (alt && b) {
      log.push(brueckenZeile(b.label, alt.key, b.key));
      return { zustand: { ...z, eintraege, aktiv: b.key }, log };
    }
    const label = alt?.label ?? '';
    if (o.andererOrdner && !z.aufSendung) {
      // A9: anderer Ordner, nicht auf Sendung → Eintrag 1 (bei leerer Liste keiner).
      return { zustand: eintraege.length ? aktivWird(0) : { ...z, eintraege, aktiv: null }, log };
    }
    if (z.aufSendung) {
      // A2 (auch A8): auf Sendung gehalten, Variablen eingefroren.
      log.push(`DataLink: aktiver Eintrag „${label}“ nicht mehr in der Liste, auf Sendung gehalten.`);
      const gehalten: Gehalten = { key: z.aktiv, label, datei: alt?.datei ?? '', vars: alt?.vars ?? {}, grund: 'A2' };
      return { zustand: { ...z, eintraege, aktiv: null, gehalten, hinweis: { art: 'H1', label } }, log };
    }
    // A3: kein aktiver Eintrag.
    log.push(`DataLink: aktiver Eintrag „${label}“ nicht mehr in der Liste, kein aktiver Eintrag.`);
    return { zustand: { ...z, eintraege, aktiv: null, hinweis: { art: 'H2', label } }, log };
  }

  if (z.gehalten !== null) {
    const g = z.gehalten;
    if (g.grund === 'A2') {
      let stelle = stelleVon(eintraege, g.key);
      if (stelle < 0) {
        const b = bruecke(g, eintraege);
        if (b) {
          log.push(brueckenZeile(b.label, g.key, b.key));
          stelle = eintraege.indexOf(b);
        }
      }
      if (stelle >= 0) return { zustand: aktivWird(stelle), log }; // A5
    }
    // Weiter gehalten. Ein nach A10 gehaltener Eintrag wird nie wieder aktiv.
    return { zustand: { ...z, eintraege }, log };
  }

  // Ohne aktiven und ohne gehaltenen Eintrag: nur ein Ordnerwechsel (auch der erste Start) ohne Sendung wählt
  // Eintrag 1 (A9). Auf Sendung (A8) bleibt es ohne Eintrag: Die Bauchbinde zeigt weiter leere Platzhalter,
  // statt ohne Abruf auf Person 1 zu springen; ein stehender Hinweis H2/H5 bleibt.
  if (o.andererOrdner && !z.aufSendung && eintraege.length) return { zustand: aktivWird(0), log };
  return { zustand: { ...z, eintraege }, log };
}

/**
 * Sendung gemeldet (`on_air`). Ein TAKE löscht die Frist. Endet die Sendung, fällt ein gehaltener
 * Eintrag `HALTEN_NACH_SENDUNG_MS` später weg (A4); eine wiederholte Meldung verschiebt die Frist nicht.
 */
export function setzeSendung(z: KernZustand, aufSendung: boolean, jetztMs: number): KernSchritt {
  if (aufSendung) return { zustand: { ...z, aufSendung: true, wegAbMs: null }, log: [] };
  const wegAbMs = z.gehalten ? (z.wegAbMs ?? jetztMs + HALTEN_NACH_SENDUNG_MS) : null;
  return { zustand: { ...z, aufSendung: false, wegAbMs }, log: [] };
}

/** Uhr (A4): Ist die Frist erreicht, gibt es keinen aktiven und keinen gehaltenen Eintrag mehr. */
export function uhrTick(z: KernZustand, jetztMs: number): KernSchritt {
  if (z.gehalten === null || z.wegAbMs === null || jetztMs < z.wegAbMs) return { zustand: z, log: [] };
  const g = z.gehalten;
  const leer: KernZustand = { ...z, aktiv: null, gehalten: null, wegAbMs: null };
  // Nach A10 wird H6 zu H5, ohne Logzeile: Der Eintrag steht oft noch in der Liste.
  if (g.grund === 'A10') return { zustand: { ...leer, hinweis: { art: 'H5', ref: g.ref ?? g.label } }, log: [] };
  return {
    zustand: { ...leer, hinweis: { art: 'H2', label: g.label } },
    log: [`DataLink: aktiver Eintrag „${g.label}“ nicht mehr in der Liste, kein aktiver Eintrag.`],
  };
}

/** Was die Fenster sehen (Spec 7.4): Einträge mit Schlüssel, Stelle des aktiven, gehaltener Eintrag. */
export interface KernSicht {
  entries: Array<{ key: string; label: string }>;
  /** Stelle des aktiven Eintrags, −1 ohne (auch bei gehaltenem). */
  activeIndex: number;
  gehalten?: { label: string };
  /** Variablen des aktiven, sonst des gehaltenen Eintrags, sonst leer. */
  variables: Record<string, string>;
  hinweis: Hinweis | null;
}

export function kernSicht(z: KernZustand): KernSicht {
  const activeIndex = stelleVon(z.eintraege, z.aktiv);
  const sicht: KernSicht = {
    entries: z.eintraege.map((e) => ({ key: e.key, label: e.label })),
    activeIndex,
    variables: activeIndex >= 0 ? z.eintraege[activeIndex].vars : (z.gehalten?.vars ?? {}),
    hinweis: z.hinweis,
  };
  if (z.gehalten) sicht.gehalten = { label: z.gehalten.label };
  return sicht;
}

/** Companion-STATE (Spec 7.5): `entry`, `entry_index` (1-basiert, gehalten/keiner 0), `entry_count`. */
export function companionWerte(z: KernZustand): { entry: string; entryIndex: number; entryCount: number } {
  const stelle = stelleVon(z.eintraege, z.aktiv);
  return {
    entry: stelle >= 0 ? z.eintraege[stelle].label : (z.gehalten?.label ?? ''),
    entryIndex: stelle + 1,
    entryCount: z.eintraege.length,
  };
}
```

- [ ] **Step 4: Test laufen lassen (grün)**

```
npm run selftest -w @jm/titler
```
Erwartet: 116 Zeilen `ok` (31 aus B8, 85 neu), keine Zeile `FAIL`, letzte Zeile `ALLE TESTS OK`, Exitcode 0. Unter anderem:
```
ok   Nr. 3: „Neu“ davor → aktiv bleibt Alan, jetzt Stelle 4
ok   Nr. 3: Logzeile A1 mit neuer Stelle
ok   Gegenprobe: der Kern besteht Fall 3, die Variante „Stelle halten“ nicht
ok   Gegenprobe: … die Variante zeigt Grace statt Alan
ok   Nr. 7: TAKE bei 1500 → bleibt gehalten
ok   A8 ohne aktiven Eintrag: anderer Ordner auf Sendung → bleibt ohne Eintrag, leere Variablen, Hinweis bleibt
ok   Nr. 15: Brücke Ersatz → Kennung (auf Sendung): derselbe Eintrag, neuer Schlüssel, kein Hinweis
ok   Nr. 19: s-3 → s-9 gleicher Name, auf Sendung → keine Brücke, A2
ok   Review 1: CSV leer gelesen, auf Sendung → Alan gehalten mit H1, nicht Eintrag 1
ok   Review 1: … nach dem Zurückkommen wird nicht von selbst Eintrag 1 aktiv
ok   H6 wörtlich

ALLE TESTS OK
```

- [ ] **Step 5: Gegenprobe in den Aufgabenbericht** (Spec 9.3 „Gegenprobe“)

Die beiden Zeilen `ok   Gegenprobe: …` aus Step 4 in den Aufgabenbericht übernehmen: Eine Variante, die die Stelle hält (`neueListeNachStelle` im Test, das Verhalten des alten `datalink.ts:185-192`), zeigt in Fall 3 Grace statt Alan und fällt durch die Prüfung von Fall 3; der Kern besteht sie.

- [ ] **Step 6: Typecheck**

```
npm run typecheck -w @jm/titler
```
Erwartet: keine Meldung von `tsc`, Exitcode 0.

- [ ] **Step 7: Commit** (Git Bash, Commit-Text ohne Umlaute)

```
git add apps/titler/src/shared/datalink-kern.ts apps/titler/test/selftest.ts
git status --short
```
Erwartet genau:
```
M  apps/titler/src/shared/datalink-kern.ts
M  apps/titler/test/selftest.ts
```
Dann:
```
git commit -m "feat(titler): aktiver DataLink-Eintrag ueber den Schluessel, Halten auf Sendung, Hinweise H1-H7 (Teil 2b, B9)" -m "Der Kern fuehrt den aktiven Eintrag ueber seinen Schluessel statt ueber die Nummer: A1 an neuer Stelle, A2 auf Sendung gehalten mit eingefrorenen Variablen (H1), A3 ohne Sendung kein Eintrag (H2), A4 eine Sekunde nach dem Ende der Sendung, A5 zurueck, A7 leere Liste aus Show haelt, A9 anderer Ordner ohne Sendung Eintrag 1, auf Sendung nie von selbst. Bruecke zwischen Ersatz-Schluessel und Kennung ueber Datei und Label, nie zwischen zwei Kennungen. Texte H1-H7 und Logzeilen woertlich aus Spec 7.8/7.9, Vorrang, Companion-Werte." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- **A7 nur im selben Ordner:** `neueListe` hält eine leere Liste nur bei `leerHalten` **und** `!andererOrdner`. Wechselt die Quelle auf einen leeren Ordner, bliebe sonst die Liste der vorigen Quelle stehen. Dann greift die normale Tabelle (auf Sendung A2, sonst A9 ohne Eintrag). Test „Wechsel auf einen leeren Ordner: Liste leer, ohne Hinweis (kein A7)“. Die Signatur bleibt.
- Bei einer Brücke steht nur die Brücken-Logzeile, keine zusätzliche A1-Zeile „jetzt Nr. …“.
- `setzeSendung(false)` verschiebt eine schon gesetzte Frist nicht. Der Renderer meldet `titler:report-state` bei jeder Zustandsänderung (`index.ts:452-456`), nicht nur beim Wechsel; sonst liefe die Frist bei jeder Meldung neu an.
- Ohne aktiven und gehaltenen Eintrag nimmt ein Ordnerwechsel einen stehenden Hinweis (H2/H5) mit weg, wenn Eintrag 1 aktiv wird. Das geschieht nur ohne Sendung (A9).
- **Ordnerwechsel auf Sendung ohne aktiven Eintrag (A8):** Das Gerüst wählte hier Eintrag 1, ohne auf die Sendung zu schauen. Nach Spec 7.3 A8 gilt auf Sendung aber nur „Schlüssel gefunden: A1; sonst A2“. Ohne Schlüssel gibt es nichts zu halten, also bleibt es ohne Eintrag mit leeren Variablen, und der Hinweis bleibt. Sonst spränge eine Bauchbinde, die nach A3/A4/A11 mit leeren Platzhaltern auf Sendung steht, bei Ordnerwahl, K1 oder einer anderen Show ohne Abruf auf Person 1. Nach der Prüfung berichtigt, Test „A8 ohne aktiven Eintrag …“. B13 braucht dafür keine Änderung: `startDataWatch` meldet weiter `andererOrdner`, die Sendung kennt der Kern.
- `uhrzeit` liefert für einen unlesbaren Wert `--:--` (in der Spec nicht vorgesehen; `parseShow` lässt nur lesbare Zeiten durch, B3).
- Rot meldet Node den ersten fehlenden Namen in seiner Reihenfolge, gemessen `HALTEN_NACH_SENDUNG_MS` statt `neueListe`.

**Nachgerechnet** (Scratchpad-Kopie wie in B8): Step 2 rot wie angegeben, Step 4 grün mit 116 × `ok`, Typecheck node und web grün. Gegenprobe am Stand nach B9 mit je einem absichtlichen Fehler im Kern, alle gefangen: Brücke ohne Ersatz-Bedingung 2 `FAIL`, Brücke bei mehreren Kandidaten 2, Brücke ohne Datei 2, A7 ohne `leerHalten` 3, kein A9 2, Frist bei jeder Meldung neu 1, Frist mit `<=` 4, A10-Eintrag wird wieder aktiv 1, A3 lässt `aktiv` stehen 4, Vorrang H7/H3 vertauscht 1, Companion-Stelle bei gehaltenem Eintrag 1, A1 ohne Logzeile 1, Ordnerwechsel auf Sendung ohne Eintrag wählt Eintrag 1 (Stand vor der Prüfung) 1.

---

### Task 10: B10 · Titler-Kern: Abruf (Nummer, Schlüssel, Label, Teilstring), `@`-Form, Klick über den Schlüssel, Weiter/Zurück, Abruf ohne Treffer A10/A11

**Spec:** 7.4 (Abruf, `@`-Form, Klick, Weiter/Zurück), 7.3 A6/A10/A11, 7.5 (Nummer außerhalb der Liste = ohne Treffer), 7.8 H5/H6, 7.9 (Logzeile A10/A11); 9.3 Nr. 11, 12, 20, 21; Review Focus 5. Globale Regeln G5, G7, G9, G13–G15.

**Arbeitsverzeichnis:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b`, Branch `feat/master-link-teil2b`. Alle Pfade relativ dazu. Voraussetzung: B9 ist committet.

**Dateien:**
- Modify: `apps/titler/src/shared/datalink-kern.ts`: neuer Teil direkt hinter `companionWerte` (Zeilen 367–374, Dateiende), danach 458 Zeilen
- Test: `apps/titler/test/selftest.ts`
  - Zeilen 20–21 (Import aus `../src/shared/datalink-kern`, drei Namen dazu)
  - neuer Block direkt vor Zeile 344 (`if (failed > 0) {`)

**Interfaces:**
- Consumes (B9, aus `apps/titler/src/shared/datalink-kern.ts`): `KernZustand`, `KernSchritt`, `Hinweis`, `Gehalten`, `leererKern`, `neueListe`, `setzeSendung`, `uhrTick`, `kernSicht`; die modulinternen Hilfen `normLabel(s: string): string` und `stelleVon(eintraege: DataEntry[], key: string | null): number`. Aus B8: `DataEntry`. Im Test die Hilfen aus B9 auf Modulebene: `tsvListe`, `kernMit`, `ADA`, `GRACE`, `ALAN`, `HEDY`, `NEU`, `GLEICH`.
- Produces (exakt so, B13 ruft sie):
  ```ts
  export function rufeAb(z: KernZustand, ref: string): KernSchritt;
  export function rufeSchluesselAb(z: KernZustand, key: string): KernSchritt;
  export function schritt(z: KernZustand, delta: number): KernSchritt;
  ```

**Verhalten (Spec 7.4, 7.3, verbindlich):**
- **`rufeAb(z, ref)`**, `ref` getrimmt; leer → wirkungslos (dasselbe Objekt, kein Log).
  - **`@`-Form** (`ref` beginnt mit `@`): Das erste Wort nach `@` ist die Kennung, der Rest (Leerraum als ein Leerzeichen) der Name. Treffer nur über (1) Schlüssel exakt, ohne Groß- und Kleinschreibung, oder (2) wenn ein Name dabei ist, ein Label genau gleich dem Namen (`normLabel`). Kein Teilstring. `⟨ref⟩` für H5/H6 und die Logzeile ist der Name, ohne Namen die Kennung. Ein `@` ohne Kennung ist wirkungslos.
  - **nur Ziffern** → Nummer (1-basiert). `0` oder größer als die Liste → ohne Treffer (kein Rückfall auf den Schlüssel).
  - **sonst** in dieser Reihenfolge, jeweils erster Treffer: Schlüssel exakt (ohne Groß- und Kleinschreibung), Label exakt (`normLabel`), Label als Teilstring (`normLabel`).
- **Treffer (A6):** `aktiv` = Schlüssel des Treffers; `gehalten`, `hinweis` und `wegAbMs` werden geleert. Kein Log.
- **Ohne Treffer** (auch Nummer außerhalb, leere Liste):
  - auf Sendung (**A10**): der bisher aktive oder gehaltene Eintrag wird mit seinen Variablen gehalten, `grund 'A10'`, `ref`; Hinweis H6 `{ ref, label }`; Logzeile „DataLink: Abruf „⟨ref⟩“ ohne Treffer, auf Sendung gehalten.“ Gab es keinen bisherigen Eintrag: nichts gehalten, H5, Logzeile „… ohne Treffer, kein aktiver Eintrag.“
  - ohne Sendung (**A11**): kein aktiver und kein gehaltener Eintrag, H5 `{ ref }`, Logzeile „DataLink: Abruf „⟨ref⟩“ ohne Treffer, kein aktiver Eintrag.“
  - Ein nach A10 gehaltener Eintrag wird nie wieder aktiv (B9) und wird nach dem Ende der Sendung + 1 s zu H5 (B9, `uhrTick`).
- **`rufeSchluesselAb(z, key)`** (Klick in Liste oder Board): nur der Schlüssel, exakt (`===`). Ohne Treffer wie oben mit `ref = key`. Leerer Schlüssel → wirkungslos.
- **`schritt(z, delta)`** (Weiter/Zurück): leere Liste → unverändert. Ohne aktiven Eintrag, auch bei einem gehaltenen, Eintrag 1; sonst Stelle ± `delta`, begrenzt auf die Liste (kein Umlauf). Wirkt wie A6. Ein nicht endliches `delta` zählt als 0.

---

- [ ] **Step 1: Fehlschlagende Tests schreiben** (`apps/titler/test/selftest.ts`)

Ersetzung 1 (Zeilen 20–21, im Import aus `../src/shared/datalink-kern`), Vorher:
```ts
  parseTable,
  SCHLUESSEL_MAX,
```
Nachher:
```ts
  parseTable,
  rufeAb,
  rufeSchluesselAb,
  schritt,
  SCHLUESSEL_MAX,
```

Ersetzung 2 (Zeilen 344–345), Vorher:
```ts
if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
```
Nachher:
```ts
// ── datalink-kern: Abruf, @-Form, Klick, Weiter/Zurück, ohne Treffer (Spec 7.4, 7.3 A6/A10/A11; 9.3 Nr. 11, 12, 20, 21) ──
{
  const fuenf = tsvListe([NEU, ADA, GRACE, ALAN, HEDY]);
  const frei = kernMit(fuenf, null);

  // Nr. 11: Nummer, Schlüssel, Label exakt, Teilstring — danach hält der Titler den Schlüssel.
  ok(rufeAb(frei, '3').zustand.aktiv === 's-2', 'Nr. 11: „3“ → Nummer 3 (Grace)');
  ok(rufeAb(frei, 'S-4').zustand.aktiv === 's-4', 'Nr. 11: Schlüssel exakt, ohne Groß-/Kleinschreibung');
  ok(rufeAb(frei, '  alan ').zustand.aktiv === 's-3', 'Nr. 11: Label exakt (getrimmt, ohne Groß-/Kleinschreibung)');
  ok(rufeAb(frei, 'ra').zustand.aktiv === 's-2', 'Nr. 11: Label als Teilstring, erster Treffer');
  const vorrang: DataEntry[] = [
    { key: 'k-1', label: 'Beta', datei: 'a.csv', vars: {} },
    { key: 'beta', label: 'Gamma', datei: 'a.csv', vars: {} },
    { key: 'k-3', label: 'Anabel', datei: 'a.csv', vars: {} },
    { key: 'k-4', label: 'Ana', datei: 'a.csv', vars: {} },
  ];
  ok(rufeAb(kernMit(vorrang, null), 'BETA').zustand.aktiv === 'beta', 'Reihenfolge: Schlüssel vor Label');
  ok(rufeAb(kernMit(vorrang, null), 'ana').zustand.aktiv === 'k-4', 'Reihenfolge: Label exakt vor Teilstring');
  const gehalten = neueListe(kernMit(fuenf, 's-3', true), tsvListe([NEU, ADA]), GLEICH).zustand;
  const a6 = rufeAb(setzeSendung(gehalten, false, 0).zustand, '2');
  ok(
    a6.zustand.aktiv === 's-1' && a6.zustand.gehalten === null && a6.zustand.hinweis === null && a6.zustand.wegAbMs === null && a6.log.length === 0,
    'A6: Abruf mit Treffer → gewählter Eintrag; gehalten, Hinweis und Frist weg',
  );

  // Nr. 12: Weiter und Zurück.
  ok(schritt(frei, 1).zustand.aktiv === 's-5' && schritt(frei, -1).zustand.aktiv === 's-5', 'Nr. 12: Weiter und Zurück ohne aktiven Eintrag → Eintrag 1');
  ok(schritt(gehalten, 1).zustand.aktiv === 's-5' && schritt(gehalten, 1).zustand.gehalten === null, 'Nr. 12: … auch bei gehaltenem Eintrag (wirkt wie A6)');
  ok(schritt(kernMit(fuenf, 's-2'), 1).zustand.aktiv === 's-3' && schritt(kernMit(fuenf, 's-2'), -1).zustand.aktiv === 's-1', 'Weiter/Zurück von der Stelle des aktiven Eintrags');
  ok(schritt(kernMit(fuenf, 's-4'), 1).zustand.aktiv === 's-4' && schritt(kernMit(fuenf, 's-5'), -1).zustand.aktiv === 's-5', 'Weiter/Zurück begrenzt auf die Liste, kein Umlauf');
  const leer = kernMit([], null);
  ok(schritt(leer, 1).zustand === leer, 'Weiter bei leerer Liste → unverändert');

  // Nr. 20: Abruf ohne Treffer (unbekannter Name, Nummer 7 bei 5 Einträgen).
  for (const ref of ['Niemand', '7']) {
    const aus = rufeAb(kernMit(fuenf, 's-3', false), ref);
    ok(
      aus.zustand.aktiv === null && aus.zustand.gehalten === null && JSON.stringify(aus.zustand.hinweis) === JSON.stringify({ art: 'H5', ref }),
      `Nr. 20: „${ref}“ ohne Sendung → kein aktiver Eintrag, H5 (A11)`,
    );
    ok(aus.log.length === 1 && aus.log[0] === `DataLink: Abruf „${ref}“ ohne Treffer, kein aktiver Eintrag.`, `Nr. 20: „${ref}“ … Logzeile A11`);
    const auf = rufeAb(kernMit(fuenf, 's-3', true), ref);
    ok(
      auf.zustand.aktiv === null && auf.zustand.gehalten?.label === 'Alan' && auf.zustand.gehalten.grund === 'A10' && auf.zustand.gehalten.ref === ref,
      `Nr. 20: „${ref}“ auf Sendung → Alan gehalten, grund A10 (A10)`,
    );
    ok(JSON.stringify(auf.zustand.hinweis) === JSON.stringify({ art: 'H6', ref, label: 'Alan' }), `Nr. 20: „${ref}“ … Hinweis H6`);
    ok(kernSicht(auf.zustand).variables.name === 'Alan' && kernSicht(auf.zustand).activeIndex === -1, `Nr. 20: „${ref}“ … Variablen eingefroren, nichts markiert`);
    ok(auf.log[0] === `DataLink: Abruf „${ref}“ ohne Treffer, auf Sendung gehalten.`, `Nr. 20: „${ref}“ … Logzeile A10`);
  }
  const leerAus = rufeAb(kernMit([], null, false), '1');
  ok(JSON.stringify(leerAus.zustand.hinweis) === '{"art":"H5","ref":"1"}' && leerAus.zustand.aktiv === null, 'Nr. 20: leere Liste, ohne Sendung → H5');
  const leerAuf = rufeAb(kernMit([], null, true), 'Alan');
  ok(leerAuf.zustand.gehalten === null && leerAuf.zustand.hinweis?.art === 'H5', 'Nr. 20: leere Liste auf Sendung, vorher kein Eintrag → H5, nichts gehalten');
  ok(leerAuf.log[0] === 'DataLink: Abruf „Alan“ ohne Treffer, kein aktiver Eintrag.', 'Nr. 20: … Logzeile „kein aktiver Eintrag“');
  const vonGehalten = rufeAb(gehalten, 'Niemand');
  ok(vonGehalten.zustand.gehalten?.label === 'Alan' && vonGehalten.zustand.gehalten.grund === 'A10' && vonGehalten.zustand.hinweis?.art === 'H6', 'Nr. 20: ein gehaltener Eintrag bleibt bei A10 gehalten, jetzt mit grund A10 und H6');
  const h6 = rufeAb(kernMit(fuenf, 's-3', true), 'Niemand').zustand;
  const wieder = rufeAb(h6, 'Grace');
  ok(wieder.zustand.aktiv === 's-2' && wieder.zustand.hinweis === null && wieder.zustand.gehalten === null, 'Nr. 20: danach ein Abruf mit Treffer → Hinweis weg');
  const ende = setzeSendung(h6, false, 10_000).zustand;
  const h5 = uhrTick(ende, 11_000);
  ok(h5.zustand.gehalten === null && JSON.stringify(h5.zustand.hinweis) === '{"art":"H5","ref":"Niemand"}' && h5.log.length === 0, 'Nr. 20: H6 → H5 nach Ende der Sendung + 1 s, ohne Logzeile');
  ok(neueListe(h6, fuenf, GLEICH).zustand.aktiv === null && neueListe(h6, fuenf, GLEICH).zustand.gehalten?.grund === 'A10', 'A10: beim Neueinlesen nie wieder aktiv, auch wenn der Schlüssel in der Liste steht');

  // Nr. 21: @-Form.
  ok(rufeAb(frei, '@s-3 Alan').zustand.aktiv === 's-3', 'Nr. 21: @-Form, die Kennung trifft');
  ok(rufeAb(frei, '@S-3').zustand.aktiv === 's-3', 'Nr. 21: @-Form ohne Namen, ohne Groß-/Kleinschreibung');
  ok(rufeAb(frei, '@x-404   alan ').zustand.aktiv === 's-3', 'Nr. 21: Kennung fehlt, Name genau gleich → trifft');
  const teil = rufeAb(kernMit(fuenf, 's-1', false), '@x-404 Ala');
  ok(teil.zustand.aktiv === null && JSON.stringify(teil.zustand.hinweis) === '{"art":"H5","ref":"Ala"}', 'Nr. 21: Name nur als Teilstring → kein Treffer (A11), ⟨ref⟩ ist der Name');
  const teilAuf = rufeAb(kernMit(fuenf, 's-1', true), '@x-404 Ala');
  ok(teilAuf.zustand.gehalten?.label === 'Ada' && JSON.stringify(teilAuf.zustand.hinweis) === '{"art":"H6","ref":"Ala","label":"Ada"}', 'Nr. 21: … auf Sendung A10 mit H6');
  ok(JSON.stringify(rufeAb(frei, '@x-404').zustand.hinweis) === '{"art":"H5","ref":"x-404"}', 'Nr. 21: ohne Namen ist ⟨ref⟩ die Kennung');
  const zwanzig: DataEntry[] = Array.from({ length: 20 }, (_v, i) => ({ key: i === 2 ? '17' : `k${i + 1}`, label: `Person ${i + 1}`, datei: 'liste.csv', vars: {} }));
  ok(rufeAb(kernMit(zwanzig, null), '@17').zustand.aktiv === '17', 'Nr. 21: @17 trifft den Schlüssel „17“');
  ok(rufeAb(kernMit(zwanzig, null), '17').zustand.aktiv === 'k17', 'Nr. 21: 17 trifft die Nummer 17');
  ok(rufeAb(frei, '@').zustand === frei, '„@“ allein bleibt wirkungslos');
  ok(JSON.stringify(rufeAb(frei, '0').zustand.hinweis) === '{"art":"H5","ref":"0"}', 'Nummer 0 → ohne Treffer');

  // Klick über den Schlüssel.
  ok(rufeSchluesselAb(frei, 's-4').zustand.aktiv === 's-4', 'Klick: der Schlüssel trifft');
  ok(rufeSchluesselAb(frei, 'S-4').zustand.aktiv === null, 'Klick: nur der Schlüssel exakt');
  const klick = rufeSchluesselAb(kernMit(fuenf, 's-1', false), 'ersatz:speakers.tsv|Weg');
  ok(klick.zustand.aktiv === null && JSON.stringify(klick.zustand.hinweis) === '{"art":"H5","ref":"ersatz:speakers.tsv|Weg"}', 'Ein Schlüssel nicht in der Liste → H5 mit dem Schlüssel');
  const klickAuf = rufeSchluesselAb(kernMit(fuenf, 's-1', true), 'ersatz:speakers.tsv|Weg');
  ok(klickAuf.zustand.gehalten?.label === 'Ada' && klickAuf.zustand.hinweis?.art === 'H6', '… auf Sendung H6, Ada gehalten');
  ok(rufeSchluesselAb(frei, '').zustand === frei, 'Klick mit leerem Schlüssel → unverändert');

  // Leerer ref.
  const vorher = kernMit(fuenf, 's-2', true);
  ok(rufeAb(vorher, '').zustand === vorher && rufeAb(vorher, '   ').zustand === vorher && rufeAb(vorher, '').log.length === 0, 'Leerer ref → Zustand unverändert');

  // Review Focus 5: zwei Speaker gleichen Namens mit verschiedenen Kennungen.
  const ana = tsvListe([{ id: 's-7', name: 'Ana Silva', title: 'Presse' }, { id: 's-9', name: 'Ana Silva', title: 'Technik' }, ADA]);
  const zAna = kernMit(ana, null);
  ok(rufeAb(zAna, '@s-9 Ana Silva').zustand.aktiv === 's-9', 'Review 5: @s-9 Ana Silva trifft genau s-9');
  ok(rufeAb(zAna, 'Ana Silva').zustand.aktiv === 's-7', 'Review 5: der reine Name trifft die erste, s-7');
  const s9 = setzeSendung(rufeAb(zAna, '@s-9 Ana Silva').zustand, true, 0).zustand;
  const weg = neueListe(s9, tsvListe([{ id: 's-7', name: 'Ana Silva', title: 'Presse' }, ADA]), GLEICH);
  ok(weg.zustand.gehalten?.key === 's-9' && weg.zustand.aktiv === null && weg.zustand.hinweis?.art === 'H1', 'Review 5: s-9 verschwindet auf Sendung → gehalten (A2)');
  ok(kernSicht(weg.zustand).variables.funktion === 'Technik' && !weg.log.some((l) => l.includes('Schlüssel wechselt')), 'Review 5: … keine Brücke auf s-7, gezeichnet bleibt s-9');
}

if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/titler
```
Erwartet: tsx bricht vor dem ersten `ok` ab, Exitcode 1:
```
SyntaxError: The requested module '../src/shared/datalink-kern' does not provide an export named 'rufeAb'
```

- [ ] **Step 3: Abruf im Kern** (`apps/titler/src/shared/datalink-kern.ts`, Zeilen 371–374, das Ende von `companionWerte` und der Datei)

Vorher:
```ts
    entryIndex: stelle + 1,
    entryCount: z.eintraege.length,
  };
}
```
Nachher:
```ts
    entryIndex: stelle + 1,
    entryCount: z.eintraege.length,
  };
}

// ── Abruf (Spec 7.4; 7.3 A6, A10, A11) ───────────────────────────────────────────────────────

/** A6: Der gewählte Eintrag wird aktiv. Gehaltener Eintrag, Hinweis und Frist entfallen. */
function waehle(z: KernZustand, stelle: number): KernSchritt {
  return { zustand: { ...z, aktiv: z.eintraege[stelle].key, gehalten: null, hinweis: null, wegAbMs: null }, log: [] };
}

/**
 * Abruf ohne Treffer (A10, A11). Der alte Eintrag bleibt nie still aktiv.
 * - Auf Sendung (A10): Der bisher aktive oder gehaltene Eintrag wird mit seinen Variablen gehalten, H6.
 *   Gab es keinen, bleibt es ohne Eintrag, H5.
 * - Ohne Sendung (A11): kein aktiver und kein gehaltener Eintrag, H5.
 */
function ohneTreffer(z: KernZustand, ref: string): KernSchritt {
  const stelle = stelleVon(z.eintraege, z.aktiv);
  const e = stelle >= 0 ? z.eintraege[stelle] : null;
  const bisher: Gehalten | null = e
    ? { key: e.key, label: e.label, datei: e.datei, vars: e.vars, grund: 'A10', ref }
    : z.gehalten
      ? { ...z.gehalten, grund: 'A10', ref }
      : null;
  if (z.aufSendung && bisher) {
    return {
      zustand: { ...z, aktiv: null, gehalten: bisher, hinweis: { art: 'H6', ref, label: bisher.label }, wegAbMs: null },
      log: [`DataLink: Abruf „${ref}“ ohne Treffer, auf Sendung gehalten.`],
    };
  }
  return {
    zustand: { ...z, aktiv: null, gehalten: null, hinweis: { art: 'H5', ref }, wegAbMs: null },
    log: [`DataLink: Abruf „${ref}“ ohne Treffer, kein aktiver Eintrag.`],
  };
}

/**
 * Eintrag abrufen (Spec 7.4) — Companion, Steuerprotokoll, Rundown. Danach hält der Titler den
 * Schlüssel, nicht die Nummer. Ein leerer `ref` bleibt wirkungslos.
 * - `@⟨Kennung⟩ ⟨Name⟩`: Schlüssel exakt (ohne Groß-/Kleinschreibung), sonst ein Label genau gleich
 *   dem Namen. Kein Teilstring. ⟨ref⟩ in H5/H6 ist der Name, ohne Namen die Kennung.
 * - nur Ziffern: Nummer (1-basiert), außerhalb der Liste = ohne Treffer
 * - sonst: Schlüssel exakt (ohne Groß-/Kleinschreibung), Label exakt, Label als Teilstring
 */
export function rufeAb(z: KernZustand, ref: string): KernSchritt {
  const t = (ref ?? '').trim();
  if (!t) return { zustand: z, log: [] };
  const liste = z.eintraege;
  if (t.startsWith('@')) {
    const [kennung = '', ...rest] = t.slice(1).trim().split(/\s+/);
    if (!kennung) return { zustand: z, log: [] };
    const name = rest.join(' ');
    let stelle = liste.findIndex((e) => e.key.toLowerCase() === kennung.toLowerCase());
    if (stelle < 0 && name) stelle = liste.findIndex((e) => normLabel(e.label) === normLabel(name));
    return stelle >= 0 ? waehle(z, stelle) : ohneTreffer(z, name || kennung);
  }
  if (/^\d+$/.test(t)) {
    const stelle = Number(t) - 1;
    return stelle >= 0 && stelle < liste.length ? waehle(z, stelle) : ohneTreffer(z, t);
  }
  const lc = t.toLowerCase();
  const gesucht = normLabel(t);
  let stelle = liste.findIndex((e) => e.key.toLowerCase() === lc);
  if (stelle < 0) stelle = liste.findIndex((e) => normLabel(e.label) === gesucht);
  if (stelle < 0) stelle = liste.findIndex((e) => normLabel(e.label).includes(gesucht));
  return stelle >= 0 ? waehle(z, stelle) : ohneTreffer(z, t);
}

/** Klick in Liste oder Board (IPC `titler:recallSchluessel`): nur der Schlüssel, exakt. */
export function rufeSchluesselAb(z: KernZustand, key: string): KernSchritt {
  if (!key) return { zustand: z, log: [] };
  const stelle = stelleVon(z.eintraege, key);
  return stelle >= 0 ? waehle(z, stelle) : ohneTreffer(z, key);
}

/**
 * Weiter (+1) / Zurück (−1) von der Stelle des aktiven Eintrags, begrenzt auf die Liste (kein Umlauf).
 * Ohne aktiven Eintrag, auch bei einem gehaltenen, gilt Eintrag 1. Leere Liste → unverändert.
 */
export function schritt(z: KernZustand, delta: number): KernSchritt {
  const n = z.eintraege.length;
  if (!n) return { zustand: z, log: [] };
  const stelle = stelleVon(z.eintraege, z.aktiv);
  const d = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  return waehle(z, stelle < 0 ? 0 : Math.min(n - 1, Math.max(0, stelle + d)));
}
```

- [ ] **Step 4: Test laufen lassen (grün)**

```
npm run selftest -w @jm/titler
```
Erwartet: 167 Zeilen `ok` (116 bis B9, 51 neu), keine Zeile `FAIL`, letzte Zeile `ALLE TESTS OK`, Exitcode 0. Unter anderem:
```
ok   Nr. 11: „3“ → Nummer 3 (Grace)
ok   Nr. 12: Weiter und Zurück ohne aktiven Eintrag → Eintrag 1
ok   Nr. 20: „Niemand“ auf Sendung → Alan gehalten, grund A10 (A10)
ok   Nr. 20: „7“ ohne Sendung → kein aktiver Eintrag, H5 (A11)
ok   Nr. 20: H6 → H5 nach Ende der Sendung + 1 s, ohne Logzeile
ok   Nr. 21: Name nur als Teilstring → kein Treffer (A11), ⟨ref⟩ ist der Name
ok   Nr. 21: @17 trifft den Schlüssel „17“
ok   Review 5: @s-9 Ana Silva trifft genau s-9
ok   Review 5: … keine Brücke auf s-7, gezeichnet bleibt s-9

ALLE TESTS OK
```

- [ ] **Step 5: Typecheck**

```
npm run typecheck -w @jm/titler
```
Erwartet: keine Meldung von `tsc`, Exitcode 0.

- [ ] **Step 6: Commit** (Git Bash, Commit-Text ohne Umlaute)

```
git add apps/titler/src/shared/datalink-kern.ts apps/titler/test/selftest.ts
git status --short
```
Erwartet genau:
```
M  apps/titler/src/shared/datalink-kern.ts
M  apps/titler/test/selftest.ts
```
Dann:
```
git commit -m "feat(titler): DataLink-Abruf ueber Schluessel und @-Form, Abruf ohne Treffer haelt nie still den alten Eintrag (Teil 2b, B10)" -m "rufeAb: Nummer, Schluessel exakt, Label exakt, Teilstring; die @-Form @<Kennung> <Name> trifft nur ueber den Schluessel oder den genauen Namen. Ohne Treffer auf Sendung A10 (bisheriger Eintrag eingefroren gehalten, H6), ohne Sendung A11 (kein Eintrag, H5), jeweils mit Logzeile. rufeSchluesselAb fuer den Klick, schritt fuer Weiter/Zurueck ab Eintrag 1, wenn nichts aktiv ist." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Ersetzung 1 im Test ist bewusst klein (nur `parseTable,` / `SCHLUESSEL_MAX,` mit drei neuen Namen dazwischen) statt des ganzen Import-Blocks; das Ergebnis ist derselbe Import wie im Gerüst vorgesehen.
- In den Fällen, die die Spec offenlässt, gilt:
  - `@` ohne Kennung ist wirkungslos wie ein leerer `ref`.
  - Die Nummer `0` gilt als ohne Treffer.
  - Ein leerer Schlüssel beim Klick ist wirkungslos.
  - Ein nicht endliches `delta` zählt als 0.
- A10 ohne bisherigen Eintrag (auf Sendung, nichts aktiv, nichts gehalten): H5 (Gerüst-Entscheidung 3). Die Logzeile endet dann mit „kein aktiver Eintrag“ statt „auf Sendung gehalten“, denn es wird nichts gehalten; beide Enden stehen so in Spec 7.9.
- „Label exakt“ fasst Leerraum zusammen wie die Brücke (Gerüst-Entscheidung 9). Ohne Rücksicht auf Groß- und Kleinschreibung war es schon vorher.

**Nachgerechnet** (Scratchpad-Kopie wie in B8): Step 2 rot wie angegeben, Step 4 grün mit 167 × `ok`, Typecheck node und web grün. Gegenprobe mit je einem absichtlichen Fehler, alle gefangen:

| Fehler | Ergebnis |
| --- | --- |
| `@`-Form mit Teilstring | 2 `FAIL` |
| Nummer ohne Untergrenze | Absturz `TypeError` bei „Nummer 0“ |
| A11 lässt den aktiven Eintrag stehen | 4 `FAIL` |
| Weiter/Zurück alt (−1 + delta) | 2 `FAIL` |
| Klick ohne Groß-/Kleinschreibung | 1 `FAIL` |
| Label exakt ohne `normLabel` | 1 `FAIL` |
| A10 ohne Rückgriff auf den gehaltenen Eintrag | 1 `FAIL` |

---

### Task 11: B11 · Titler: Datenquelle und gemerkte Show (reine Regeln 7.6/7.7, Übergang iveo-data, Q1–Q3, K1)

**Spec:** 7.6 (Leere Liste), 7.7 (Datenquelle, gemerkte Show, Übergang), 7.8 Q1–Q3 und K1, 7.9 („Show gemerkt“, Übergangs-Zeile), 9.3 „datenquelle“ und Nr. 22; Review Focus 2 und 4 (Quellseite). Globale Regeln G6, G7, G9, G13–G15.

**Arbeitsverzeichnis:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b`, Branch `feat/master-link-teil2b`. Alle Pfade relativ dazu. Voraussetzung: B10 ist committet, B3 hat `ShowIveoBinding.speakerVeraltetSeit`.

**Dateien:**
- Create: `apps/titler/src/shared/datenquelle.ts` (191 Zeilen)
- Test: `apps/titler/test/selftest.ts`
  - Zeilen 5–6 (Importe aus `node:path` und `@jm/show`), dazu der Import aus `../src/shared/datenquelle`
  - neuer Block direkt vor Zeile 451 (`if (failed > 0) {`)

**Interfaces:**
- Consumes:
  - `import type { Hinweis } from './datalink-kern'` (B9)
  - `import type { Show, ShowIveoSpeaker } from '@jm/show'`; `show.iveo.speakers`, `show.iveo.speakerVeraltetSeit` (B3)
  - im Test zusätzlich zur Laufzeit `createShow` aus `@jm/show`, `hinweisText` (B9), die Hilfen `ADA`, `ALAN` (B9, Modulebene)
- Produces (exakt so, B12, B13 und B14 bauen darauf):
  ```ts
  export type DatenQuelleArt = 'show' | 'ordner' | 'frueher';
  export interface GemerkteShow { showPfad: string; showName: string; mitSpeakern: boolean }
  export interface QuellZustand {
    art: DatenQuelleArt;
    showPfad: string | null;
    showName: string | null;
    quellHinweis: Hinweis | null;   // H3, H4, H7
  }
  export type QuellWeg = 'deepLink' | 'reload' | 'start';
  export type QuellEreignis =
    | { t: 'gelesen'; weg: QuellWeg; pfad: string; show: Show; gleicheShow: boolean }
    | { t: 'nichtLesbar'; weg: QuellWeg; pfad: string; grund: string; gemerkt: GemerkteShow | null }
    | { t: 'ordnerGewaehlt' }
    | { t: 'zurueckZumOrdner' };
  export interface QuellSchritt {
    zustand: QuellZustand;
    tsv: ShowIveoSpeaker[] | null;
    beobachte: 'iveo-data' | 'eigener';
    merke: { t: 'schreiben'; wert: GemerkteShow } | { t: 'loeschen' } | { t: 'bleibt' };
    vorlage: boolean;
    log: string[];
  }
  export function startZustand(gemerkt: GemerkteShow | null, frueher: boolean): QuellZustand;
  export function quellSchritt(z: QuellZustand, e: QuellEreignis): QuellSchritt;
  export function uebergang(
    dataFolder: string,
    iveoData: string,
    gemerkt: GemerkteShow | null,
    aufloesen: (p: string) => string,
  ): { dataFolderLeeren: boolean; frueher: boolean; log: string[] };
  export function istIveoDataOrdner(ordner: string, iveoData: string, aufloesen: (p: string) => string): boolean;
  export function eigenerOrdner(dataFolder: string, iveoData: string, aufloesen: (p: string) => string): string;   // '' bei leer oder iveo-data
  export function gleicheShowPfad(a: string, b: string, aufloesen: (p: string) => string): boolean;
  export function quellZeile(z: QuellZustand, ordner: string, anzahl: number): string;
  export function zurueckKnopf(z: QuellZustand, ordner: string): string | null;
  ```

**Verhalten (Spec 7.6, 7.7, verbindlich):**
- **Keine Laufzeitimporte** (G7): nur `import type`. Kein `electron`, kein `node:`; die Pfadauflösung kommt als `aufloesen` herein (in der Produktion `path.resolve`, B13).
- **`QuellZustand.showPfad`/`showName`:** die Show, mit der der Titler verbunden ist (die gemerkte). `null` nach Ordnerwahl oder Knopf.
- **`gelesen`:**
  - **mit Speakern** → `show`, `showPfad`/`showName` dieser Show, `tsv` = Speaker, `beobachte 'iveo-data'`, `quellHinweis` H7 bei `iveo.speakerVeraltetSeit`, sonst `null` (ein H3/H4 von vorher verschwindet).
  - **ohne Speaker, dieselbe Show** (`gleicheShow` oder `weg 'start'`, denn beim Start ist die gelesene Show immer die gemerkte) → Art und Liste unverändert, `tsv null`, `merke bleibt`. Bei Art `show`: H7 bei Merker, sonst H3; bei `ordner`/`frueher` kein Hinweis.
  - **ohne Speaker, andere Show** → `ordner`, `beobachte 'eigener'`, `tsv null`, kein Hinweis; die Show wird gemerkt mit `mitSpeakern: false` (RELOAD wirkt weiter).
  - **gemerkte Show:** mit und ohne Speaker bei `deepLink`/`reload` `merke schreiben { showPfad, showName, mitSpeakern }` (`mitSpeakern` = Art danach `show`), Logzeile „Show gemerkt: ⟨Pfad⟩“. Beim Weg `start` immer `merke bleibt`, kein Log.
  - `vorlage = weg === 'deepLink'` (C3-Import nur beim Deep-Link).
- **`nichtLesbar`:**
  - `weg 'start'`: gemerkte Show `mitSpeakern` → `show` mit H4 `{ grund }`, `beobachte 'iveo-data'` (die vorhandene TSV gilt). Sonst → `ordner`, `beobachte 'eigener'`, Logzeile „Gemerkte Show nicht lesbar (⟨Grund⟩), eigener Ordner gilt.“
  - `deepLink`/`reload`: Art und Liste unverändert, H4 nur bei Art `show`; bei `ordner`/`frueher` bleibt der bisherige `quellHinweis`.
  - Immer `tsv null`, `merke bleibt`, `vorlage false`.
- **`ordnerGewaehlt`, `zurueckZumOrdner`** → `ordner`, `showPfad`/`showName` `null`, kein Hinweis, `beobachte 'eigener'`, `merke loeschen`.
- **`startZustand`:** `gemerkt?.mitSpeakern` → `show` (Pfad und Name der gemerkten Show); sonst `frueher` → `frueher`; sonst `ordner` (mit Pfad und Name der gemerkten Show, falls vorhanden).
- **`uebergang`:** `dataFolder` zeigt auf iveo-data → `dataFolderLeeren: true`, `frueher: gemerkt === null`, Logzeile „DataLink: Ordner iveo-data war von einer Show gesetzt, kein eigener Ordner mehr eingetragen.“ Sonst `{ dataFolderLeeren: false, frueher: false, log: [] }`.
- **Pfade:** `istIveoDataOrdner`, `eigenerOrdner` und `gleicheShowPfad` vergleichen `aufloesen(p).toLowerCase()`; ein leerer Pfad ist nie gleich. `eigenerOrdner` liefert `''` bei leerem `dataFolder` oder iveo-data, sonst `dataFolder` unverändert.
- **`quellZeile`:** `show` → Q1 „Quelle: Show „⟨Showname⟩“ · ⟨n⟩ Speaker“; `frueher` → Q3 „Quelle: Speaker aus einer früheren Show“; `ordner` → Q2 „Quelle: eigener Ordner ⟨Pfad⟩“, ohne eigenen Ordner `''`. `ordner` ist der Rückgabewert von `eigenerOrdner`, `anzahl` die Zahl der Einträge.
- **`zurueckKnopf`:** K1 „Zurück zum eigenen Ordner (⟨Ordnername⟩)“ nur bei Art `show` und nicht leerem eigenem Ordner (der Aufrufer übergibt `eigenerOrdner(…)`, also nie iveo-data). Ordnername = letzter Pfadteil nach `\` oder `/`, ohne `node:path`.

---

- [ ] **Step 1: Fehlschlagende Tests schreiben** (`apps/titler/test/selftest.ts`)

Ersetzung 1 (Zeilen 5–6), Vorher:
```ts
import { join } from 'node:path';
import type { ShowIveoSpeaker } from '@jm/show';
```
Nachher:
```ts
import path, { join } from 'node:path';
import { createShow, type Show, type ShowIveoSpeaker } from '@jm/show';
import {
  eigenerOrdner,
  gleicheShowPfad,
  istIveoDataOrdner,
  quellSchritt,
  quellZeile,
  startZustand,
  uebergang,
  zurueckKnopf,
  type GemerkteShow,
  type QuellZustand,
} from '../src/shared/datenquelle';
```

Ersetzung 2 (Zeilen 451–452), Vorher:
```ts
if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
```
Nachher:
```ts
// ── datenquelle: Datenquelle, gemerkte Show, Übergang, Q1–Q3, K1 (Spec 7.6, 7.7, 7.8; 9.3 „datenquelle“, Nr. 22) ──
{
  // Windows-Pfade auf jeder Plattform gleich aufgelöst (die CI läuft unter Linux). Die Produktion
  // übergibt path.resolve; einen Fall damit gibt es unten bei Review Focus 2.
  const aufloesen = path.win32.resolve;
  const IVEO = 'C:\\Users\\op\\AppData\\Roaming\\JM Titler\\iveo-data';
  const P1 = 'C:\\Shows\\Tag1.jmshow';
  const P2 = 'C:\\Shows\\Tag2.jmshow';
  function showMit(name: string, speakers: ShowIveoSpeaker[], speakerVeraltetSeit?: string): Show {
    const iveo: NonNullable<Show['iveo']> = { event: 'cop31' };
    if (speakers.length) iveo.speakers = speakers;
    if (speakerVeraltetSeit) iveo.speakerVeraltetSeit = speakerVeraltetSeit;
    return { ...createShow(name), iveo };
  }
  const mit = showMit('Tag 1', [ADA, ALAN]);
  const ohne1 = showMit('Tag 1', []);
  const ohne2 = showMit('Tag 2', []);
  const zShow: QuellZustand = { art: 'show', showPfad: P1, showName: 'Tag 1', quellHinweis: null };
  const zOrdner: QuellZustand = { art: 'ordner', showPfad: null, showName: null, quellHinweis: null };
  const zFrueher = startZustand(null, true);
  const alle = [['show', zShow], ['ordner', zOrdner], ['frueher', zFrueher]] as const;

  // 7.7: Show-Deep-Link oder RELOAD, Show mit Speakern → show, gemerkt diese Show.
  for (const [art, z] of alle) {
    for (const weg of ['deepLink', 'reload'] as const) {
      const s = quellSchritt(z, { t: 'gelesen', weg, pfad: P1, show: mit, gleicheShow: art === 'show' });
      ok(s.zustand.art === 'show' && s.zustand.showName === 'Tag 1' && s.zustand.quellHinweis === null && s.beobachte === 'iveo-data', `7.7: ${weg}, Show mit Speakern, von ${art} → show`);
      ok(s.tsv?.length === 2 && s.tsv[1].id === 's-3', `7.7: ${weg} von ${art} … TSV mit den Speakern der Show`);
      ok(
        JSON.stringify(s.merke) === JSON.stringify({ t: 'schreiben', wert: { showPfad: P1, showName: 'Tag 1', mitSpeakern: true } }) && s.log.length === 1 && s.log[0] === `Show gemerkt: ${P1}`,
        `7.7: ${weg} von ${art} … gemerkt mit Speakern, Logzeile „Show gemerkt“`,
      );
      ok(s.vorlage === (weg === 'deepLink'), `7.7: ${weg} von ${art} … Vorlage nur beim Deep-Link`);
    }
  }

  // 7.6/7.7: Show-Deep-Link, andere Show ohne Speaker → ordner, gemerkt ohne Speaker.
  for (const [art, z] of alle) {
    const s = quellSchritt(z, { t: 'gelesen', weg: 'deepLink', pfad: P2, show: ohne2, gleicheShow: false });
    ok(s.zustand.art === 'ordner' && s.beobachte === 'eigener' && s.tsv === null && s.zustand.quellHinweis === null, `7.6/7.7: andere Show ohne Speaker, von ${art} → ordner, keine TSV, kein Hinweis`);
    ok(JSON.stringify(s.merke) === JSON.stringify({ t: 'schreiben', wert: { showPfad: P2, showName: 'Tag 2', mitSpeakern: false } }) && s.vorlage, `7.7: … von ${art} gemerkt ohne Speaker (RELOAD wirkt weiter), Vorlage`);
  }

  // 7.6/7.7: RELOAD oder Show-Deep-Link, dieselbe Show ohne Speaker → unverändert, H3.
  for (const weg of ['reload', 'deepLink'] as const) {
    const s = quellSchritt(zShow, { t: 'gelesen', weg, pfad: P1, show: ohne1, gleicheShow: true });
    ok(s.zustand.art === 'show' && s.tsv === null && s.beobachte === 'iveo-data' && s.merke.t === 'bleibt', `7.6/7.7: ${weg}, dieselbe Show ohne Speaker → show bleibt, alte TSV bleibt`);
    ok(JSON.stringify(s.zustand.quellHinweis) === '{"art":"H3"}' && s.log.length === 0, `7.6/7.7: ${weg} … Hinweis H3`);
  }
  const zOrdnerMitShow = quellSchritt(zOrdner, { t: 'gelesen', weg: 'deepLink', pfad: P2, show: ohne2, gleicheShow: false }).zustand;
  const reloadOrdner = quellSchritt(zOrdnerMitShow, { t: 'gelesen', weg: 'reload', pfad: P2, show: ohne2, gleicheShow: true });
  ok(reloadOrdner.zustand.art === 'ordner' && reloadOrdner.zustand.quellHinweis === null && reloadOrdner.beobachte === 'eigener' && reloadOrdner.merke.t === 'bleibt', '7.7: RELOAD derselben Show ohne Speaker bei ordner → ordner, kein Hinweis');
  const reloadFrueher = quellSchritt(zFrueher, { t: 'gelesen', weg: 'reload', pfad: P1, show: ohne1, gleicheShow: true });
  ok(reloadFrueher.zustand.art === 'frueher' && reloadFrueher.zustand.quellHinweis === null && reloadFrueher.beobachte === 'iveo-data', '7.7: dieselbe Show ohne Speaker bei frueher → frueher, kein Hinweis');

  // 7.7: Start ohne Deep-Link (Kachel, Neustart).
  const gemerktMit: GemerkteShow = { showPfad: P1, showName: 'Tag 1', mitSpeakern: true };
  const gemerktOhne: GemerkteShow = { showPfad: P2, showName: 'Tag 2', mitSpeakern: false };
  const startShow = startZustand(gemerktMit, false);
  ok(JSON.stringify(startShow) === JSON.stringify({ art: 'show', showPfad: P1, showName: 'Tag 1', quellHinweis: null }), 'startZustand: gemerkte Show mit Speakern → show');
  const startOrdner = startZustand(gemerktOhne, false);
  ok(startOrdner.art === 'ordner' && startOrdner.showPfad === P2, 'startZustand: gemerkte Show ohne Speaker → ordner');
  ok(startZustand(null, false).art === 'ordner' && startZustand(null, true).art === 'frueher', 'startZustand: ohne gemerkte Show ordner, nach dem Übergang frueher');
  const st1 = quellSchritt(startShow, { t: 'gelesen', weg: 'start', pfad: P1, show: mit, gleicheShow: false });
  ok(st1.zustand.art === 'show' && st1.tsv?.length === 2 && st1.beobachte === 'iveo-data', '7.7: Start, gemerkte Show lesbar → wie Deep-Link');
  ok(st1.vorlage === false && st1.merke.t === 'bleibt' && st1.log.length === 0, '7.7: … ohne Vorlagen-Import, gemerkte Show unverändert');
  const st2 = quellSchritt(startShow, { t: 'gelesen', weg: 'start', pfad: P1, show: ohne1, gleicheShow: false });
  ok(st2.zustand.art === 'show' && st2.tsv === null && st2.zustand.quellHinweis?.art === 'H3', '7.6: Start, gemerkte Show jetzt ohne Speaker → dieselbe Show, alte TSV bleibt, H3');
  const st3 = quellSchritt(startOrdner, { t: 'gelesen', weg: 'start', pfad: P2, show: ohne2, gleicheShow: false });
  ok(st3.zustand.art === 'ordner' && st3.beobachte === 'eigener' && st3.merke.t === 'bleibt', '7.7: Start, gemerkte Show ohne Speaker lesbar → ordner, unverändert');

  // 7.6/7.7: Start, gemerkte Show nicht lesbar.
  const nl5 = quellSchritt(startShow, { t: 'nichtLesbar', weg: 'start', pfad: P1, grund: 'EBUSY', gemerkt: gemerktMit });
  ok(nl5.zustand.art === 'show' && JSON.stringify(nl5.zustand.quellHinweis) === '{"art":"H4","grund":"EBUSY"}' && nl5.beobachte === 'iveo-data' && nl5.tsv === null, '7.6/7.7: Start, nicht lesbar, mitSpeakern → show mit vorhandener TSV, H4');
  ok(nl5.merke.t === 'bleibt' && nl5.vorlage === false && nl5.zustand.showName === 'Tag 1', '7.7: … gemerkte Show bleibt (ein späteres RELOAD versucht es erneut)');
  const nl6 = quellSchritt(startOrdner, { t: 'nichtLesbar', weg: 'start', pfad: P2, grund: 'ENOENT', gemerkt: gemerktOhne });
  ok(nl6.zustand.art === 'ordner' && nl6.beobachte === 'eigener' && nl6.zustand.quellHinweis === null && nl6.merke.t === 'bleibt', '7.7: Start, nicht lesbar, ohne Speaker → ordner, gemerkte Show bleibt');
  ok(nl6.log.length === 1 && nl6.log[0] === 'Gemerkte Show nicht lesbar (ENOENT), eigener Ordner gilt.', '7.7: … Logzeile');

  // 7.6: RELOAD bzw. Deep-Link nicht lesbar → Art und Liste bleiben, H4 nur bei show.
  for (const [art, z] of alle) {
    const s = quellSchritt(z, { t: 'nichtLesbar', weg: 'reload', pfad: P1, grund: 'kein gültiges JSON', gemerkt: null });
    ok(s.zustand.art === art && s.tsv === null && s.merke.t === 'bleibt' && s.beobachte === (art === 'ordner' ? 'eigener' : 'iveo-data'), `7.6: RELOAD nicht lesbar bei ${art} → Art und Liste bleiben`);
    ok(
      art === 'show' ? JSON.stringify(s.zustand.quellHinweis) === '{"art":"H4","grund":"kein gültiges JSON"}' : s.zustand.quellHinweis === null,
      `7.6: RELOAD nicht lesbar bei ${art} … H4 nur bei show`,
    );
  }

  // 7.7: Ordner gewählt, Knopf „Zurück zum eigenen Ordner“.
  for (const [art, z] of alle) {
    for (const t of ['ordnerGewaehlt', 'zurueckZumOrdner'] as const) {
      const s = quellSchritt(z, { t });
      ok(
        s.zustand.art === 'ordner' && s.zustand.showPfad === null && s.zustand.quellHinweis === null && s.merke.t === 'loeschen' && s.beobachte === 'eigener' && s.tsv === null && !s.vorlage,
        `7.7: ${t} bei ${art} → ordner, gemerkte Show gelöscht`,
      );
    }
  }

  // 7.6 / Nr. 22: Merker speakerVeraltetSeit → H7.
  const merker = new Date(2026, 8, 29, 9, 58).toISOString();
  const mitMerker = quellSchritt(zShow, { t: 'gelesen', weg: 'reload', pfad: P1, show: showMit('Tag 1', [ADA], merker), gleicheShow: true });
  ok(JSON.stringify(mitMerker.zustand.quellHinweis) === JSON.stringify({ art: 'H7', seit: merker }) && mitMerker.tsv?.length === 1, 'Nr. 22: Show mit Merker → Liste gilt, H7');
  ok(
    mitMerker.zustand.quellHinweis !== null && hinweisText(mitMerker.zustand.quellHinweis) === 'Liste aus früherem Stand: Speakerliste von iveo nicht abrufbar (seit 09:58).',
    'Nr. 22: … Text mit Ortszeit',
  );
  ok(quellSchritt(zShow, { t: 'gelesen', weg: 'reload', pfad: P1, show: mit, gleicheShow: true }).zustand.quellHinweis === null, 'Nr. 22: ohne Merker kein H7');
  const merkerOhneSpeaker = quellSchritt(zShow, { t: 'gelesen', weg: 'reload', pfad: P1, show: showMit('Tag 1', [], merker), gleicheShow: true });
  ok(merkerOhneSpeaker.zustand.quellHinweis?.art === 'H7', 'dieselbe Show ohne Speaker, mit Merker → H7 statt H3');

  // Übergang (7.7): config.dataFolder zeigt auf iveo-data.
  const ueb = uebergang(IVEO, IVEO, null, aufloesen);
  ok(ueb.dataFolderLeeren && ueb.frueher, 'Übergang: dataFolder auf iveo-data, keine gemerkte Show → leeren, frueher');
  ok(ueb.log.length === 1 && ueb.log[0] === 'DataLink: Ordner iveo-data war von einer Show gesetzt, kein eigener Ordner mehr eingetragen.', 'Übergang: Logzeile');
  const uebMit = uebergang(`${IVEO}\\`, IVEO, gemerktMit, aufloesen);
  ok(uebMit.dataFolderLeeren && !uebMit.frueher, 'Übergang mit gemerkter Show: leeren, aber nicht frueher');
  ok(JSON.stringify(uebergang('D:\\Bauchbinden', IVEO, null, aufloesen)) === '{"dataFolderLeeren":false,"frueher":false,"log":[]}', 'Übergang: ein eigener Ordner bleibt unberührt');
  ok(!uebergang('', IVEO, null, aufloesen).dataFolderLeeren, 'Übergang: leerer Ordner → nichts zu tun');
  const zUeb = startZustand(null, ueb.frueher);
  ok(zUeb.art === 'frueher' && quellZeile(zUeb, '', 4) === 'Quelle: Speaker aus einer früheren Show', 'Übergang: die alte Liste bleibt sichtbar (Q3)');
  const danach = quellSchritt(zUeb, { t: 'gelesen', weg: 'deepLink', pfad: P2, show: ohne2, gleicheShow: false });
  ok(danach.zustand.art === 'ordner' && danach.beobachte === 'eigener' && danach.tsv === null, 'Übergang, dann andere Show ohne Speaker → ordner, eigener Ordner beobachtet, keine TSV');
  const nachLeeren = eigenerOrdner('', IVEO, aufloesen);
  ok(nachLeeren === '' && quellZeile(danach.zustand, nachLeeren, 0) === '', 'Übergang: … ohne eigenen Ordner leer, nicht die Speaker der vorigen Show');
  ok(eigenerOrdner('c:/users/op/appdata/roaming/jm titler/IVEO-DATA/', IVEO, aufloesen) === '', 'dataFolder von Hand auf iveo-data (andere Schreibweise) → kein eigener Ordner');
  ok(istIveoDataOrdner('c:/users/op/appdata/roaming/jm titler/IVEO-DATA/', IVEO, aufloesen), 'istIveoDataOrdner: Schreibweise egal');
  ok(eigenerOrdner('D:\\Bauchbinden', IVEO, aufloesen) === 'D:\\Bauchbinden', 'eigenerOrdner: ein echter Ordner bleibt');
  ok(!istIveoDataOrdner(`${IVEO}-alt`, IVEO, aufloesen), 'istIveoDataOrdner: ein ähnlicher Name ist nicht iveo-data');

  // Q1–Q3, K1 wörtlich (7.8).
  ok(quellZeile(zShow, 'D:\\Bauchbinden', 12) === 'Quelle: Show „Tag 1“ · 12 Speaker', 'Q1 wörtlich');
  ok(quellZeile(zOrdner, 'D:\\Bauchbinden', 3) === 'Quelle: eigener Ordner D:\\Bauchbinden', 'Q2 wörtlich');
  ok(quellZeile(zFrueher, '', 7) === 'Quelle: Speaker aus einer früheren Show', 'Q3 wörtlich');
  ok(quellZeile(zOrdner, '', 0) === '', 'ordner ohne eigenen Ordner → keine Quellzeile');
  ok(zurueckKnopf(zShow, 'D:\\Bauchbinden\\') === 'Zurück zum eigenen Ordner (Bauchbinden)', 'K1 wörtlich, Ordnername = letzter Pfadteil');
  ok(zurueckKnopf(zShow, '/home/op/Gäste') === 'Zurück zum eigenen Ordner (Gäste)', 'K1: auch mit /');
  ok(
    zurueckKnopf(zShow, '') === null && zurueckKnopf(zOrdner, 'D:\\Bauchbinden') === null && zurueckKnopf(zFrueher, 'D:\\Bauchbinden') === null,
    'K1 nur bei Quelle show und einem eigenen Ordner',
  );

  // Review Focus 2: dieselbe Show in anderer Pfad-Schreibweise.
  ok(gleicheShowPfad('C:\\Shows\\Tag1.jmshow', 'c:/shows/tag1.jmshow', path.win32.resolve), 'Review 2: C:\\Shows\\Tag1.jmshow = c:/shows/tag1.jmshow');
  ok(!gleicheShowPfad(P1, P2, aufloesen) && !gleicheShowPfad('', P1, aufloesen), 'gleicheShowPfad: andere Show bzw. leer → nein');
  ok(gleicheShowPfad(path.resolve('Shows', 'Tag1.jmshow'), path.join('Shows', '.', 'TAG1.jmshow'), path.resolve), 'gleicheShowPfad mit path.resolve: relativ = absolut, Groß-/Kleinschreibung egal');
  const r2 = quellSchritt(zShow, { t: 'gelesen', weg: 'deepLink', pfad: 'c:/shows/tag1.jmshow', show: ohne1, gleicheShow: gleicheShowPfad(P1, 'c:/shows/tag1.jmshow', aufloesen) });
  ok(r2.zustand.art === 'show' && r2.zustand.quellHinweis?.art === 'H3' && r2.tsv === null && r2.beobachte === 'iveo-data', 'Review 2: Deep-Link derselben Show ohne Speaker → bleibt show mit H3, keine Liste verloren');

  // Review Focus 4 (Quellseite): H4, danach nimmt das nächste lesbare RELOAD H4 weg.
  const kaputt = quellSchritt(zShow, { t: 'nichtLesbar', weg: 'reload', pfad: P1, grund: 'kein gültiges JSON', gemerkt: null });
  ok(
    kaputt.zustand.quellHinweis !== null && hinweisText(kaputt.zustand.quellHinweis) === 'Liste aus früherem Stand: Show nicht lesbar (kein gültiges JSON).',
    'Review 4: RELOAD mit halbem JSON → H4, Liste bleibt',
  );
  const geheilt = quellSchritt(kaputt.zustand, { t: 'gelesen', weg: 'reload', pfad: P1, show: mit, gleicheShow: true });
  ok(geheilt.zustand.quellHinweis === null && geheilt.tsv?.length === 2, 'Review 4: das nächste lesbare RELOAD nimmt H4 weg');
  const geheiltOhne = quellSchritt(kaputt.zustand, { t: 'gelesen', weg: 'reload', pfad: P1, show: ohne1, gleicheShow: true });
  ok(geheiltOhne.zustand.quellHinweis?.art === 'H3', 'Review 4: … auch ohne Speaker (dann H3 statt H4)');
}

if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/titler
```
Erwartet: tsx bricht vor dem ersten `ok` ab, Exitcode 1:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\titler\src\shared\datenquelle' imported from …\apps\titler\test\selftest.ts
```

- [ ] **Step 3: `apps/titler/src/shared/datenquelle.ts` anlegen** (neue Datei, 191 Zeilen)

```ts
// --- JM Titler: Datenquelle und gemerkte Show (Master-Link Teil 2b, Spec 7.6, 7.7) ---
//
// Reine Regeln ohne Electron, ohne fs und ohne node:path: Woher der Titler seine Einträge liest
// (Show, eigener Ordner, frühere Show), was beim Lesen einer Show geschieht, wann die gemerkte
// Show geschrieben oder gelöscht wird, der einmalige Übergang für `iveo-data`, Quellzeile und Knopf.
// Die Pfadauflösung kommt als Parameter herein (in der Produktion `path.resolve`). `main/index.ts`
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

/** Wie die Show kam: Show-Deep-Link, RELOAD vom Launcher oder Start ohne Deep-Link (gemerkte Show). */
export type QuellWeg = 'deepLink' | 'reload' | 'start';

export type QuellEreignis =
  /** Show gelesen. `gleicheShow`: derselbe Pfad wie die verbundene Show (`gleicheShowPfad`). */
  | { t: 'gelesen'; weg: QuellWeg; pfad: string; show: Show; gleicheShow: boolean }
  /** Show nicht lesbar; `grund` ohne Dateiinhalt. `gemerkt`: die gemerkte Show (beim Start). */
  | { t: 'nichtLesbar'; weg: QuellWeg; pfad: string; grund: string; gemerkt: GemerkteShow | null }
  /** Der Bediener hat einen DataLink-Ordner gewählt. */
  | { t: 'ordnerGewaehlt' }
  /** Knopf „Zurück zum eigenen Ordner“. */
  | { t: 'zurueckZumOrdner' };

/** Was der Aufrufer nach einem Ereignis tut. */
export interface QuellSchritt {
  zustand: QuellZustand;
  /** Nicht null → `speakers.tsv` in iveo-data mit diesen Speakern neu schreiben. */
  tsv: ShowIveoSpeaker[] | null;
  /** Welcher Ordner beobachtet wird: iveo-data oder der eigene (`config.dataFolder`). */
  beobachte: 'iveo-data' | 'eigener';
  /** Gemerkte Show schreiben, löschen oder lassen. */
  merke: { t: 'schreiben'; wert: GemerkteShow } | { t: 'loeschen' } | { t: 'bleibt' };
  /** Bauchbinden-Vorlage der Show importieren (C3) — nur beim Show-Deep-Link. */
  vorlage: boolean;
  log: string[];
}

const BLEIBT = { t: 'bleibt' } as const;

function beobachteFuer(art: DatenQuelleArt): 'iveo-data' | 'eigener' {
  return art === 'ordner' ? 'eigener' : 'iveo-data';
}

/** Datenquelle beim Start: gemerkte Show mit Speakern → `show`; Übergang → `frueher`; sonst `ordner`. */
export function startZustand(gemerkt: GemerkteShow | null, frueher: boolean): QuellZustand {
  if (gemerkt?.mitSpeakern) return { art: 'show', showPfad: gemerkt.showPfad, showName: gemerkt.showName, quellHinweis: null };
  if (frueher) return { art: 'frueher', showPfad: null, showName: null, quellHinweis: null };
  return { art: 'ordner', showPfad: gemerkt?.showPfad ?? null, showName: gemerkt?.showName ?? null, quellHinweis: null };
}

/** Eine Show wurde angewendet: gemerkte Show schreiben (beim Start bleibt sie, wie sie ist). */
function angewendet(
  zustand: QuellZustand,
  pfad: string,
  name: string,
  tsv: ShowIveoSpeaker[] | null,
  weg: QuellWeg,
): QuellSchritt {
  const vorlage = weg === 'deepLink';
  const beobachte = beobachteFuer(zustand.art);
  if (weg === 'start') return { zustand, tsv, beobachte, merke: BLEIBT, vorlage, log: [] };
  const wert: GemerkteShow = { showPfad: pfad, showName: name, mitSpeakern: zustand.art === 'show' };
  return { zustand, tsv, beobachte, merke: { t: 'schreiben', wert }, vorlage, log: [`Show gemerkt: ${pfad}`] };
}

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
      // Beim Start ist die gelesene Show immer die gemerkte, also dieselbe.
      if (e.gleicheShow || e.weg === 'start') {
        // Dieselbe Show ohne Speaker: Art und TSV bleiben; bei Art show H7 bzw. H3.
        const quellHinweis: Hinweis | null = z.art === 'show' ? (h7 ?? { art: 'H3' }) : null;
        return { zustand: { ...z, quellHinweis }, tsv: null, beobachte: beobachteFuer(z.art), merke: BLEIBT, vorlage: e.weg === 'deepLink', log: [] };
      }
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
        return { zustand, tsv: null, beobachte: 'eigener', merke: BLEIBT, vorlage: false, log: [`Gemerkte Show nicht lesbar (${e.grund}), eigener Ordner gilt.`] };
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

/** Zwei Pfade gleich nach `aufloesen`, ohne Rücksicht auf Groß- und Kleinschreibung (Spec 7.7). Leer → nie gleich. */
function gleicherPfad(a: string, b: string, aufloesen: (p: string) => string): boolean {
  if (!a.trim() || !b.trim()) return false;
  return aufloesen(a).toLowerCase() === aufloesen(b).toLowerCase();
}

/** Zeigt `ordner` auf `userData/iveo-data`? */
export function istIveoDataOrdner(ordner: string, iveoData: string, aufloesen: (p: string) => string): boolean {
  return gleicherPfad(ordner, iveoData, aufloesen);
}

/** Der eigene Ordner des Bedieners: `config.dataFolder`, aber '' wenn leer oder iveo-data (nie ein eigener Ordner). */
export function eigenerOrdner(dataFolder: string, iveoData: string, aufloesen: (p: string) => string): string {
  return !dataFolder.trim() || istIveoDataOrdner(dataFolder, iveoData, aufloesen) ? '' : dataFolder;
}

/** Dieselbe Show trotz anderer Schreibweise (`C:\Shows\Tag1.jmshow` = `c:/shows/tag1.jmshow`)? */
export function gleicheShowPfad(a: string, b: string, aufloesen: (p: string) => string): boolean {
  return gleicherPfad(a, b, aufloesen);
}

/**
 * Übergang beim Start (Spec 7.7): Steht `config.dataFolder` auf iveo-data, hat ein früherer Titler ihn
 * überschrieben. Er wird einmalig geleert; ohne gemerkte Show wird die Datenquelle `frueher`.
 */
export function uebergang(
  dataFolder: string,
  iveoData: string,
  gemerkt: GemerkteShow | null,
  aufloesen: (p: string) => string,
): { dataFolderLeeren: boolean; frueher: boolean; log: string[] } {
  if (!istIveoDataOrdner(dataFolder, iveoData, aufloesen)) return { dataFolderLeeren: false, frueher: false, log: [] };
  return {
    dataFolderLeeren: true,
    frueher: gemerkt === null,
    log: ['DataLink: Ordner iveo-data war von einer Show gesetzt, kein eigener Ordner mehr eingetragen.'],
  };
}

/**
 * Zeile über der Liste (Spec 7.8 Q1–Q3). `ordner` ist der eigene Ordner (`eigenerOrdner`), `anzahl`
 * die Zahl der Einträge. Bei `ordner` ohne eigenen Ordner leer (dann steht „Kein Datenordner aktiv …“).
 */
export function quellZeile(z: QuellZustand, ordner: string, anzahl: number): string {
  if (z.art === 'show') return `Quelle: Show „${z.showName ?? ''}“ · ${anzahl} Speaker`;
  if (z.art === 'frueher') return 'Quelle: Speaker aus einer früheren Show';
  return ordner ? `Quelle: eigener Ordner ${ordner}` : '';
}

/**
 * Knopf K1 (Spec 7.8): nur bei Datenquelle `show` und einem eigenen Ordner. `ordner` ist der eigene
 * Ordner (`eigenerOrdner`, also nie iveo-data). Ordnername = letzter Pfadteil, ohne node:path.
 */
export function zurueckKnopf(z: QuellZustand, ordner: string): string | null {
  if (z.art !== 'show' || !ordner.trim()) return null;
  const name = ordner.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || ordner;
  return `Zurück zum eigenen Ordner (${name})`;
}
```

- [ ] **Step 4: Test laufen lassen (grün)**

```
npm run selftest -w @jm/titler
```
Erwartet: 256 Zeilen `ok` (167 bis B10, 89 neu), keine Zeile `FAIL`, letzte Zeile `ALLE TESTS OK`, Exitcode 0. Unter anderem:
```
ok   7.7: deepLink, Show mit Speakern, von ordner → show
ok   7.6/7.7: andere Show ohne Speaker, von show → ordner, keine TSV, kein Hinweis
ok   7.6/7.7: reload, dieselbe Show ohne Speaker → show bleibt, alte TSV bleibt
ok   7.6/7.7: Start, nicht lesbar, mitSpeakern → show mit vorhandener TSV, H4
ok   7.7: zurueckZumOrdner bei show → ordner, gemerkte Show gelöscht
ok   Nr. 22: Show mit Merker → Liste gilt, H7
ok   Übergang, dann andere Show ohne Speaker → ordner, eigener Ordner beobachtet, keine TSV
ok   Q1 wörtlich
ok   K1 wörtlich, Ordnername = letzter Pfadteil
ok   Review 2: C:\Shows\Tag1.jmshow = c:/shows/tag1.jmshow
ok   Review 4: das nächste lesbare RELOAD nimmt H4 weg

ALLE TESTS OK
```

- [ ] **Step 5: Typecheck**

```
npm run typecheck -w @jm/titler
```
Erwartet: keine Meldung von `tsc`, Exitcode 0. (`datenquelle.ts` liegt in `src/shared` und wird auch mit der Renderer-Konfiguration ohne Node-Typen geprüft.)

- [ ] **Step 6: Keine Laufzeitimporte prüfen** (G7)

```
grep -n "^import" apps/titler/src/shared/datalink-kern.ts apps/titler/src/shared/datenquelle.ts
```
Erwartet genau:
```
apps/titler/src/shared/datalink-kern.ts:7:import { loeseDoppelteKennungenAuf } from '@jm/show';
apps/titler/src/shared/datenquelle.ts:9:import type { Show, ShowIveoSpeaker } from '@jm/show';
apps/titler/src/shared/datenquelle.ts:10:import type { Hinweis } from './datalink-kern';
```

- [ ] **Step 7: Commit** (Git Bash, Commit-Text ohne Umlaute)

```
git add apps/titler/src/shared/datenquelle.ts apps/titler/test/selftest.ts
git status --short
```
Erwartet genau (dazu ggf. die Warnung „LF will be replaced by CRLF“ für die neue Datei, harmlos):
```
A  apps/titler/src/shared/datenquelle.ts
M  apps/titler/test/selftest.ts
```
Dann:
```
git commit -m "feat(titler): Datenquelle show/ordner/frueher und gemerkte Show als reine Regeln (Teil 2b, B11)" -m "datenquelle.ts ohne Laufzeitimporte: Show mit Speakern wird Quelle show und gemerkt, eine andere Show ohne Speaker schaltet auf den eigenen Ordner, dieselbe Show ohne Speaker behaelt die Liste (H3), nicht lesbar H4, Merker speakerVeraltetSeit H7. Start ueber die gemerkte Show ohne Vorlagen-Import. Uebergang: dataFolder auf iveo-data wird einmalig geleert, ohne gemerkte Show Quelle frueher. Pfadvergleich nach aufloesen ohne Gross-/Kleinschreibung, Zeilen Q1-Q3 und Knopf K1 woertlich." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- **Windows-Pfade im Test mit `path.win32.resolve`** statt `path.resolve`. Der Job `selftests` läuft auf `ubuntu-latest`; dort sind `C:\Shows\Tag1.jmshow` und `c:/shows/tag1.jmshow` für `path.resolve` relative Pfade mit verschiedenen Trennern und nie gleich. `path.win32.resolve` löst sie auf jeder Plattform wie Windows auf. Ein zusätzlicher Fall prüft `gleicheShowPfad` mit `path.resolve` und plattformeigenen Pfaden. Die Produktion übergibt weiter `path.resolve` (B13).
- **`weg 'start'` gilt als dieselbe Show**, unabhängig vom übergebenen `gleicheShow`. Beim Start ist die gelesene Show immer die gemerkte. B13 bildet `gleicheShow` aus `currentShowPath`, und der ist beim Start noch `null`. Ohne diese Regel würde eine gemerkte Show, die beim Neustart gerade keine Speaker trägt, als „andere Show ohne Speaker“ auf `ordner` schalten, statt die Liste mit H3 zu halten (7.6).
- In den Fällen, die die Spec offenlässt, gilt:
  - `QuellZustand.showPfad`/`showName` nennen die verbundene Show auch bei Art `ordner` nach „andere Show ohne Speaker“. Nach Ordnerwahl und Knopf sind sie `null`.
  - Bei „dieselbe Show ohne Speaker“ und Art `ordner`/`frueher` steht kein Hinweis.
  - `nichtLesbar` über Deep-Link oder RELOAD erzeugt in `quellSchritt` keine Logzeile; die Lesefehler-Zeile schreibt der Aufrufer (B13).
- `zurueckKnopf` prüft iveo-data nicht selbst. Der Aufrufer übergibt den Rückgabewert von `eigenerOrdner(…)`; der ist für iveo-data immer `''`. Die Signatur aus dem Gerüst hat keinen iveo-data-Parameter.

**Nachgerechnet** (Scratchpad-Kopie wie in B8): Step 2 rot wie angegeben, Step 4 grün mit 256 × `ok`, Typecheck node und web grün (die web-Prüfung von `datalink-kern.ts` und `datenquelle.ts` auch ganz ohne Node-Typen). Gegenprobe mit je einem absichtlichen Fehler, alle gefangen:

| Fehler | `FAIL`-Zeilen |
| --- | --- |
| Start schreibt die gemerkte Show | 1 |
| Start nicht als dieselbe Show | 1 |
| H4 auch bei `ordner` | 2 |
| Pfadvergleich mit Groß-/Kleinschreibung | 5 |
| Übergang immer `frueher` | 1 |
| Vorlage auch beim Start | 1 |
| K1 auch bei `frueher` | 1 |
| kein H7 | 3 |
| andere Show ohne Speaker behält `show` | 5 |
| Ordnerwahl löscht die gemerkte Show nicht | 6 |
| H3 statt H7 | 1 |

---

### Task 12: B12 · Titler: `show-quelle.ts` (gemerkte Show atomar, Show sicher lesen) und Dateitest für `writeSpeakersTsv`

**Spec:** 7.7 („Gemerkte Show: `<userData>/show-zuletzt.json` mit `{ showPfad, showName, mitSpeakern }`. Geschrieben wird atomar (Zwischendatei, dann umbenennen)“), 7.6 („Die gemerkte Show ist beim RELOAD oder Start nicht lesbar → Die alte TSV bleibt, Hinweis H4“), 7.9 (Logzeile „Show gemerkt: ⟨Pfad⟩“ kommt aus B11, nicht hier), G6, G10, Review Focus 4.

**Arbeitsverzeichnis:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b`, Branch `feat/master-link-teil2b`. Alle Pfade relativ dazu. Voraussetzung: B11 ist committet.

**Dateien:**
- Create: `apps/titler/src/main/show-quelle.ts`
- Modify: `apps/titler/test/selftest.ts` (neuer Block direkt vor dem Abschluss der Datei, nach den Blöcken aus B8–B11)

**Interfaces:**

Consumes (aus früheren Aufgaben, exakt):
```ts
// B11 · apps/titler/src/shared/datenquelle.ts (nur als Typ)
export interface GemerkteShow { showPfad: string; showName: string; mitSpeakern: boolean }
// bestehend · @jm/show
export function parseShow(text: string): Show;   // JSON.parse + migrateShow; wirft SyntaxError bei kaputtem JSON
export interface Show { schemaVersion: number; name: string; /* … */ iveo?: ShowIveoBinding }
// B8 · apps/titler/src/main/iveo-show.ts (ohne Electron)
export function iveoDataDir(userData: string): string;                                 // join(userData, 'iveo-data')
export function writeSpeakersTsv(dir: string, speakers: ShowIveoSpeaker[]): string;   // schreibt <dir>/speakers.tsv, liefert dir
// B8 · apps/titler/test/selftest.ts
function ok(cond: boolean, msg: string): void;   // zählt FAIL, Abschluss „ALLE TESTS OK“ bzw. „⟨n⟩ FEHLGESCHLAGEN“
```

Produces (`apps/titler/src/main/show-quelle.ts`, kein `electron`-Import):
```ts
export const GEMERKT_DATEI = 'show-zuletzt.json';
export function leseGemerkteShow(userData: string): GemerkteShow | null;
export function schreibeGemerkteShow(userData: string, wert: GemerkteShow): boolean;
export function loescheGemerkteShow(userData: string): void;
export function leseShowSicher(pfad: string, lese?: (p: string) => string): { show: Show } | { grund: string };
```
B13 ruft alle vier Funktionen mit `userData = app.getPath('userData')` auf.

**Vorab (gemessen an einer Kopie der App, tsx 4.22, Node 24):**
- Erst mit B8–B11 als Stubs nach deren Signaturen, dann mit den ausgeschriebenen Fassungen aus B8–B11 und `@jm/show` mit B3.
- Selbsttest am Ende von B14: 321 × `ok` (256 bis B11, dazu 28 aus B12, 21 aus B13 und 16 aus B14). Nachgemessen beim Zusammensetzen des Plans: Code und Testblöcke von B12–B14 wörtlich aus dem Plantext in eine Kopie mit dem Stand nach B11 eingespielt.
- `typecheck:node`, `typecheck:web` und `electron-vite build` grün.
- `apps/titler/package.json` hat `"type": "module"`. `tsx test/selftest.ts` läuft deshalb als ESM, und `await` auf oberster Ebene geht.
- Die Testblöcke dieser und der folgenden Titler-Aufgaben laden ihre Module mit `await import(…)` **innerhalb eines Blocks `{ … }`**. So überschneiden sich keine Namen mit den Importen, die B8–B11 oben in die Datei geschrieben haben (etwa ein zweites `join` aus `node:path`). Ein fehlendes Modul lässt erst die Blöcke davor laufen und bricht dann mit `ERR_MODULE_NOT_FOUND` ab.
- `renameSync` auf ein Ziel, das ein **Ordner** ist, wirft unter Windows `EPERM` und unter Linux `EISDIR`. Der Test nutzt das, um das Scheitern des Umbenennens auf beiden Systemen zu prüfen.
- `parseShow` wirft bei halbem JSON einen `SyntaxError`, dessen Meldung Teile des Dateiinhalts zitiert. `leseShowSicher` gibt deshalb nur den festen Text „kein gültiges JSON“ weiter (G10). Fehler aus `readFileSync` tragen `code` (`ENOENT`, `EBUSY`, `EISDIR` …). Nur ein solcher Code geht als Grund hinaus, nie `err.message`.
- `show-quelle.ts` importiert `GemerkteShow` relativ (`../shared/datenquelle`, nur `import type`) und `@jm/show` zur Laufzeit. Den Alias `@shared/…` kennt tsx hier nicht; electron-vite löst beide Schreibweisen auf dieselbe Datei auf.

---

- [ ] **Step 1: Failing Test schreiben**

In `apps/titler/test/selftest.ts` den folgenden Block **direkt vor dem Abschluss** einfügen. Der Abschluss aus B8 sind die letzten Zeilen der Datei, beginnend mit `if (failed > 0) {` (dort „⟨n⟩ FEHLGESCHLAGEN“ und `process.exit(1)`, danach `console.log('\nALLE TESTS OK');`). Der Block steht also nach den Blöcken aus B8–B11. Oben in der Datei wird nichts geändert.

```ts
// ── B12 · show-quelle.ts: gemerkte Show (Spec 7.7) und Show sicher lesen (7.6, G10, Review Focus 4) ──
// Importe im Block (await import), damit sich keine Namen mit den Importen aus B8–B11 überschneiden.
{
  const { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const sq = await import('../src/main/show-quelle');
  const iveoShow = await import('../src/main/iveo-show');
  const tmp = mkdtempSync(join(tmpdir(), 'jmtitler-'));
  try {
    // gemerkte Show: Rundreise, atomar, tolerant gelesen
    const userData = join(tmp, 'userData');
    const gemerkt = join(userData, 'show-zuletzt.json');
    ok(sq.GEMERKT_DATEI === 'show-zuletzt.json', 'B12: Datei heißt show-zuletzt.json (G6)');
    ok(sq.leseGemerkteShow(userData) === null, 'B12: ohne Datei → null');
    const wert = { showPfad: 'C:\\Shows\\Tag 1.jmshow', showName: 'Tag 1', mitSpeakern: true };
    ok(sq.schreibeGemerkteShow(userData, wert) === true, 'B12: schreiben → true, Ordner wird angelegt');
    ok(JSON.stringify(sq.leseGemerkteShow(userData)) === JSON.stringify(wert), 'B12: Rundreise schreiben/lesen');
    ok(JSON.stringify(readdirSync(userData)) === JSON.stringify(['show-zuletzt.json']), 'B12: nur show-zuletzt.json, keine .tmp-Datei');
    const wert2 = { showPfad: 'D:\\Gala.jmshow', showName: 'Gala', mitSpeakern: false };
    sq.schreibeGemerkteShow(userData, wert2);
    ok(JSON.stringify(sq.leseGemerkteShow(userData)) === JSON.stringify(wert2), 'B12: zweites Schreiben ersetzt den Stand');
    writeFileSync(gemerkt, '{"showPfad":"C:\\\\Shows\\\\Ta');
    ok(sq.leseGemerkteShow(userData) === null, 'B12: kaputtes JSON → null');
    writeFileSync(gemerkt, JSON.stringify({ ...wert, mitSpeakern: 'ja' }));
    ok(sq.leseGemerkteShow(userData) === null, "B12: mitSpeakern 'ja' → null");
    writeFileSync(gemerkt, JSON.stringify({ ...wert, showPfad: '' }));
    ok(sq.leseGemerkteShow(userData) === null, 'B12: leerer showPfad → null');
    writeFileSync(gemerkt, JSON.stringify({ showPfad: wert.showPfad, mitSpeakern: true }));
    ok(sq.leseGemerkteShow(userData) === null, 'B12: showName fehlt → null');
    writeFileSync(gemerkt, '[1,2]');
    ok(sq.leseGemerkteShow(userData) === null, 'B12: kein Objekt → null');
    sq.schreibeGemerkteShow(userData, wert);
    sq.loescheGemerkteShow(userData);
    ok(sq.leseGemerkteShow(userData) === null && readdirSync(userData).length === 0, 'B12: loescheGemerkteShow → danach null, Datei weg');
    sq.loescheGemerkteShow(userData);
    ok(true, 'B12: zweimal löschen wirft nicht');
    const userData2 = join(tmp, 'userData2');
    mkdirSync(join(userData2, 'show-zuletzt.json'), { recursive: true });
    ok(sq.schreibeGemerkteShow(userData2, wert) === false, 'B12: Umbenennen scheitert (Ziel ist ein Ordner) → false');
    ok(readdirSync(userData2).every((n) => !n.endsWith('.tmp')), 'B12: gescheitertes Schreiben räumt die Zwischendatei weg');

    // Show sicher lesen (Review Focus 4, G10)
    const showPfad = join(tmp, 'Tag1.jmshow');
    writeFileSync(
      showPfad,
      JSON.stringify({ schemaVersion: 1, name: 'Tag 1', tools: [], iveo: { event: 'cop31', speakers: [{ name: 'Ada Lovelace' }] } }),
    );
    const gut = sq.leseShowSicher(showPfad);
    ok('show' in gut && gut.show.name === 'Tag 1', 'B12: gültige Show → show.name');
    ok('show' in gut && gut.show.iveo?.speakers?.[0]?.name === 'Ada Lovelace', 'B12: Speaker der Show gelesen');
    writeFileSync(showPfad, '{"schemaVersion":1,"name":"Geheimname","iveo":{"speakers":[{"name":"Ada Lo');
    const halb = sq.leseShowSicher(showPfad);
    ok('grund' in halb && halb.grund === 'kein gültiges JSON', 'B12: halb geschriebene Show → kein gültiges JSON');
    ok(!JSON.stringify(halb).includes('Geheimname') && !JSON.stringify(halb).includes('Ada'), 'B12: Grund enthält keinen Dateiinhalt (G10)');
    const fehlt = sq.leseShowSicher(join(tmp, 'fehlt.jmshow'));
    ok('grund' in fehlt && fehlt.grund === 'ENOENT', 'B12: fehlende Datei → ENOENT');
    const gesperrt = sq.leseShowSicher(showPfad, () => {
      throw Object.assign(new Error('x'), { code: 'EBUSY' });
    });
    ok('grund' in gesperrt && gesperrt.grund === 'EBUSY', 'B12: gesperrte Datei (EBUSY) → EBUSY (Review Focus 4)');
    const ohneCode = sq.leseShowSicher(showPfad, () => {
      throw new Error('C:\\geheim\\inhalt');
    });
    ok('grund' in ohneCode && ohneCode.grund === 'nicht lesbar', 'B12: Fehler ohne code → nicht lesbar, ohne Fehlertext');
    let gelesenerPfad = '';
    const injiziert = sq.leseShowSicher(showPfad, (p) => {
      gelesenerPfad = p;
      return JSON.stringify({ schemaVersion: 1, name: 'Injiziert', tools: [] });
    });
    ok(gelesenerPfad === showPfad && 'show' in injiziert && injiziert.show.name === 'Injiziert', 'B12: injizierter Leser bekommt den Pfad');

    // writeSpeakersTsv mit echtem fs (B8), Kopf aus G3
    const dir = iveoShow.iveoDataDir(tmp);
    ok(dir === join(tmp, 'iveo-data'), 'B12: iveoDataDir = <userData>/iveo-data');
    ok(iveoShow.writeSpeakersTsv(dir, [{ id: 's-1', name: 'Ada Lovelace', title: 'Moderation' }, { name: 'Grace' }]) === dir, 'B12: writeSpeakersTsv legt den Ordner an und liefert ihn');
    const zeilen = readFileSync(join(dir, 'speakers.tsv'), 'utf8').split('\n');
    ok(zeilen[0] === 'name\tfunktion\ttitle\t@kennung', 'B12: speakers.tsv beginnt mit name\\tfunktion\\ttitle\\t@kennung');
    ok(zeilen[1] === 'Ada Lovelace\tModeration\tModeration\ts-1', 'B12: Kennung steht hinten');
    ok(zeilen[2] === 'Grace\t\t\t' && zeilen[3] === '' && zeilen.length === 4, 'B12: Speaker ohne Kennung → leere Spalte, Zeilenende am Schluss');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
```

- [ ] **Step 2: Test laufen lassen, er muss scheitern**

Im Worktree-Wurzelordner (Git Bash):
```bash
npm run selftest -w @jm/titler
```
Erwartet: Die Blöcke aus B8–B11 laufen mit ihren 256 `ok`-Zeilen durch. Danach bricht der Lauf beim Laden ab, ohne eine `B12:`-Zeile, Exit-Code 1:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\titler\src\main\show-quelle' imported from …\apps\titler\test\selftest.ts
```
npm meldet zusätzlich `npm error code 1`.

- [ ] **Step 3: Minimale Implementierung**

Neue Datei `apps/titler/src/main/show-quelle.ts`, ganzer Inhalt:

```ts
// ─────────────────────────────────────────────────────────────────────────────
// Titler: Show-Quelle auf der Platte (Master-Link Teil 2b, Spec 7.6 und 7.7).
//
// • Gemerkte Show `<userData>/show-zuletzt.json` = { showPfad, showName, mitSpeakern }.
//   Sie übersteht einen Neustart, damit RELOAD auch nach einem Start über die Kachel
//   wirkt. Geschrieben wird atomar: erst `show-zuletzt.json.tmp`, dann umbenennen (G6).
//   Gelesen wird tolerant: fehlt die Datei, ist sie kaputt oder stimmt ein Feld nicht,
//   gilt „keine gemerkte Show“.
// • Show sicher lesen: wirft nie. Der Grund nennt nie Dateiinhalt (G10): bei kaputtem
//   JSON nur „kein gültiges JSON“, sonst nur den Fehlercode (ENOENT, EBUSY …).
//
// Ohne Electron: der Titler-Selbsttest (tsx) lädt das Modul direkt. `userData` gibt
// der Aufrufer (`app.getPath('userData')`) hinein.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseShow, type Show } from '@jm/show';
import type { GemerkteShow } from '../shared/datenquelle';

/** Dateiname der gemerkten Show im userData-Ordner (G6). */
export const GEMERKT_DATEI = 'show-zuletzt.json';

/** Nur ein Fehlercode wie ENOENT oder EBUSY, nie ein Fehlertext (der kann Inhalt tragen). */
const FEHLERCODE = /^[A-Z][A-Z0-9_]*$/;

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
  if (typeof o.showName !== 'string') return null;
  if (typeof o.mitSpeakern !== 'boolean') return null;
  return { showPfad: o.showPfad, showName: o.showName, mitSpeakern: o.mitSpeakern };
}

/** Gemerkte Show atomar schreiben (Zwischendatei, dann umbenennen). `false`, wenn das nicht gelang. */
export function schreibeGemerkteShow(userData: string, wert: GemerkteShow): boolean {
  const ziel = join(userData, GEMERKT_DATEI);
  const zwischen = `${ziel}.tmp`;
  try {
    mkdirSync(userData, { recursive: true });
    const inhalt = { showPfad: wert.showPfad, showName: wert.showName, mitSpeakern: wert.mitSpeakern };
    writeFileSync(zwischen, JSON.stringify(inhalt, null, 2) + '\n', 'utf8');
    renameSync(zwischen, ziel);
    return true;
  } catch {
    try {
      rmSync(zwischen, { force: true });
    } catch {
      /* Zwischendatei ließ sich nicht löschen — egal, das nächste Schreiben überschreibt sie */
    }
    return false;
  }
}

/** Gemerkte Show löschen (Ordnerwahl oder Knopf „Zurück zum eigenen Ordner“). Wirft nie. */
export function loescheGemerkteShow(userData: string): void {
  try {
    rmSync(join(userData, GEMERKT_DATEI), { force: true });
  } catch {
    /* nicht löschbar (z. B. ein Ordner gleichen Namens) — das Lesen verwirft sie ohnehin */
  }
}

/**
 * Show lesen, ohne zu werfen (Spec 7.6, Review Focus 4). Halb geschriebenes JSON →
 * `{ grund: 'kein gültiges JSON' }`, gesperrte oder fehlende Datei → `{ grund: <Fehlercode> }`,
 * sonst `{ grund: 'nicht lesbar' }`. Der Grund enthält nie Dateiinhalt (G10).
 * `lese` ist für Tests austauschbar.
 */
export function leseShowSicher(
  pfad: string,
  lese: (p: string) => string = (p) => readFileSync(p, 'utf8'),
): { show: Show } | { grund: string } {
  try {
    return { show: parseShow(lese(pfad)) };
  } catch (err) {
    if (err instanceof SyntaxError) return { grund: 'kein gültiges JSON' };
    const code = (err as { code?: unknown } | null)?.code;
    if (typeof code === 'string' && FEHLERCODE.test(code)) return { grund: code };
    return { grund: 'nicht lesbar' };
  }
}
```

- [ ] **Step 4: Test laufen lassen, er muss bestehen**

```bash
npm run selftest -w @jm/titler
```
Erwartet: Alle Zeilen aus B8–B11 wie bisher, dazu 28 `ok`-Zeilen mit `B12:`, zusammen 284 (von „B12: Datei heißt show-zuletzt.json (G6)“ bis „B12: Speaker ohne Kennung → leere Spalte, Zeilenende am Schluss“). Keine `FAIL`-Zeile, am Ende `ALLE TESTS OK`, Exit-Code 0. Danach liegt kein Ordner `jmtitler-*` mehr im Temp-Verzeichnis (`ls "$TMP" | grep -c jmtitler-` gibt `0` aus).

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck -w @jm/titler
```
Erwartet: `tsc --noEmit -p tsconfig.node.json` und `tsc --noEmit -p tsconfig.web.json` ohne Ausgabe, Exit-Code 0. `show-quelle.ts` liegt unter `src/main` und wird von `tsconfig.node.json` erfasst. Gegen den Planstand vorab geprüft.

- [ ] **Step 6: Commit** (Git Bash; Commit-Text bewusst ohne Umlaute)

```bash
git add apps/titler/src/main/show-quelle.ts apps/titler/test/selftest.ts
git status --short
```
Erwartet genau:
```
A  apps/titler/src/main/show-quelle.ts
M  apps/titler/test/selftest.ts
```
Dann:
```bash
git commit -m "feat(titler): gemerkte Show atomar, Show sicher lesen (Teil 2b, show-quelle.ts)" -m "show-zuletzt.json mit showPfad, showName, mitSpeakern: erst .tmp schreiben, dann umbenennen; scheitert das, wird die Zwischendatei geloescht und false geliefert. Lesen ist tolerant (fehlt, kaputt, falsches Feld -> null). leseShowSicher wirft nie und nennt nie Dateiinhalt: kein gueltiges JSON bzw. nur der Fehlercode (ENOENT, EBUSY). Selbsttest im Temp-Ordner, dazu writeSpeakersTsv mit echtem fs (Review Focus 4)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: B13 · Titler-Main verdrahten: `datalink.ts` über den Kern, Datenquelle, gemerkte Show, Übergang, IPC, Sendung → Kern, STATE `recall_kennung=1`

**Spec:** 7.1 (Aufbau: `datalink.ts` liest nur noch Ordner, beobachtet und ruft den Kern), 7.3 (A1–A11, A4 mit 1 s), 7.4 (IPC `titler:recallSchluessel`, Status an die Fenster), 7.5 (STATE `entry`/`entry_index`/`entry_count`, neu `recall_kennung=1`), 7.6 und 7.7 (Datenquelle, gemerkte Show, Übergang, Tabelle der Ereignisse), 7.9 (Logzeilen), SP5. Behebt 2.1 Nr. 1, 2, 7, 8, 9: Nummer statt Schlüssel, Abruf hält die Zahl, Show ohne Speaker lässt den DataLink stehen, die Show überschreibt `config.dataFolder`, RELOAD nach Start über die Kachel ignoriert.

**Arbeitsverzeichnis:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b`, Branch `feat/master-link-teil2b`. Alle Pfade relativ dazu. Voraussetzung: B12 ist committet, und der Owner hat Entscheidung 14 bestätigt (`TitlerStatus.hinweis` als `{ art, text }`, Kopf „Ausnahme“). Ohne Bestätigung hier anhalten und der steuernden Sitzung melden.

**Dateien:**
- Modify: `apps/titler/src/main/datalink.ts` (ganz ersetzen)
- Modify: `apps/titler/src/main/index.ts`: `:19-20` (Importe), `:32-43` (`currentShowPath`, `status`), `:100-170` (DataLink, Datenquelle, Deep-Link, RELOAD), `:397-457` (`registerIpc`: `setConfig`, neue IPC, `report-state`), `:482-491` (Start), `:515-516` (Kommentar im Steuerserver-Rückruf)
- Modify: `apps/titler/src/main/control-server.ts:52-65` (`toSuiteState`)
- Modify: `apps/titler/src/shared/types.ts`: Kopf (`import type`), `:165-168` (`TitlerStatus`), `:249-252` (`JmtitlerApi`)
- Modify: `apps/titler/src/preload/index.ts:29-30`
- Modify: `apps/titler/src/renderer/src/views/OperatorView.tsx:498-510` (nur, damit es kompiliert)
- Modify: `apps/titler/src/renderer/src/views/RecallBoard.tsx:19-21`, `:48-51` (nur, damit es kompiliert)
- Modify: `apps/titler/test/selftest.ts` (neuer Block direkt vor dem Abschluss, nach dem Block aus B12)

**Interfaces:**

Consumes (aus früheren Aufgaben, exakt):
```ts
// B8 · apps/titler/src/shared/datalink-kern.ts
export interface DataEntry { key: string; label: string; datei: string; vars: Record<string, string> }
export function parseTable(content: string, datei: string): DataEntry[];
export function parseKvDatei(content: string, datei: string): DataEntry | null;
export function fuehreZusammen(teile: DataEntry[][]): DataEntry[];
// B8 · apps/titler/src/main/iveo-show.ts
export function iveoDataDir(userData: string): string;
export function writeSpeakersTsv(dir: string, speakers: ShowIveoSpeaker[]): string;
// B9 · apps/titler/src/shared/datalink-kern.ts
export type Hinweis =
  | { art: 'H1'; label: string } | { art: 'H2'; label: string } | { art: 'H3' }
  | { art: 'H4'; grund: string } | { art: 'H5'; ref: string } | { art: 'H6'; ref: string; label: string }
  | { art: 'H7'; seit: string };
export function hinweisText(h: Hinweis): string;
export function hinweisLogZeile(h: Hinweis): string | null;     // nur H3, H7
export function waehleHinweis(...hinweise: Array<Hinweis | null | undefined>): Hinweis | null;
export const HALTEN_NACH_SENDUNG_MS = 1000;
export interface Gehalten { key: string; label: string; datei: string; vars: Record<string, string>; grund: 'A2' | 'A10'; ref?: string }
export interface KernZustand { eintraege: DataEntry[]; aktiv: string | null; gehalten: Gehalten | null; hinweis: Hinweis | null; aufSendung: boolean; wegAbMs: number | null }
export interface KernSchritt { zustand: KernZustand; log: string[] }
export function leererKern(): KernZustand;
export function neueListe(z: KernZustand, eintraege: DataEntry[], o: { andererOrdner: boolean; leerHalten: boolean }): KernSchritt;
export function setzeSendung(z: KernZustand, aufSendung: boolean, jetztMs: number): KernSchritt;
export function uhrTick(z: KernZustand, jetztMs: number): KernSchritt;
export interface KernSicht { entries: Array<{ key: string; label: string }>; activeIndex: number; gehalten?: { label: string }; variables: Record<string, string>; hinweis: Hinweis | null }
export function kernSicht(z: KernZustand): KernSicht;
export function companionWerte(z: KernZustand): { entry: string; entryIndex: number; entryCount: number };
// B10 · apps/titler/src/shared/datalink-kern.ts
export function rufeAb(z: KernZustand, ref: string): KernSchritt;
export function rufeSchluesselAb(z: KernZustand, key: string): KernSchritt;
export function schritt(z: KernZustand, delta: number): KernSchritt;
// B11 · apps/titler/src/shared/datenquelle.ts
export type DatenQuelleArt = 'show' | 'ordner' | 'frueher';
export interface GemerkteShow { showPfad: string; showName: string; mitSpeakern: boolean }
export interface QuellZustand { art: DatenQuelleArt; showPfad: string | null; showName: string | null; quellHinweis: Hinweis | null }
export type QuellWeg = 'deepLink' | 'reload' | 'start';
export type QuellEreignis =
  | { t: 'gelesen'; weg: QuellWeg; pfad: string; show: Show; gleicheShow: boolean }
  | { t: 'nichtLesbar'; weg: QuellWeg; pfad: string; grund: string; gemerkt: GemerkteShow | null }
  | { t: 'ordnerGewaehlt' }
  | { t: 'zurueckZumOrdner' };
export interface QuellSchritt {
  zustand: QuellZustand;
  tsv: ShowIveoSpeaker[] | null;
  beobachte: 'iveo-data' | 'eigener';
  merke: { t: 'schreiben'; wert: GemerkteShow } | { t: 'loeschen' } | { t: 'bleibt' };
  vorlage: boolean;
  log: string[];
}
export function startZustand(gemerkt: GemerkteShow | null, frueher: boolean): QuellZustand;
export function quellSchritt(z: QuellZustand, e: QuellEreignis): QuellSchritt;
export function uebergang(dataFolder: string, iveoData: string, gemerkt: GemerkteShow | null, aufloesen: (p: string) => string): { dataFolderLeeren: boolean; frueher: boolean; log: string[] };
export function eigenerOrdner(dataFolder: string, iveoData: string, aufloesen: (p: string) => string): string;   // '' bei leer oder iveo-data
export function gleicheShowPfad(a: string, b: string, aufloesen: (p: string) => string): boolean;
export function quellZeile(z: QuellZustand, ordner: string, anzahl: number): string;
export function zurueckKnopf(z: QuellZustand, ordner: string): string | null;
// B12 · apps/titler/src/main/show-quelle.ts
export function leseGemerkteShow(userData: string): GemerkteShow | null;
export function schreibeGemerkteShow(userData: string, wert: GemerkteShow): boolean;
export function loescheGemerkteShow(userData: string): void;
export function leseShowSicher(pfad: string, lese?: (p: string) => string): { show: Show } | { grund: string };
// bestehend · apps/titler/src/main/control-server.ts
export function updateTitlerData(info: { entry: string; entryIndex: number; entryCount: number }): void;
```
`istIveoDataOrdner` (B11) braucht diese Aufgabe nicht direkt. `eigenerOrdner` nutzt die Regel bereits.

Produces:
```ts
// apps/titler/src/main/datalink.ts (kein electron)
export interface DataState extends KernSicht {
  sources: string[];
  error?: string;
  companion: { entry: string; entryIndex: number; entryCount: number };
}
export function startDataWatch(dir: string, cb: (d: DataState) => void, o: { leerHalten: boolean; log?: (m: string) => void }): void;
export function rescanJetzt(): void;
export function recall(ref: string): void;
export function recallSchluessel(key: string): void;
export function step(delta: number): void;
export function setzeAufSendung(onAir: boolean): void;
export function getDataState(): DataState;
export function stopDataWatch(keepListener?: boolean): void;   // setzt auch den Kern zurück (nur beim Beenden)

// apps/titler/src/shared/types.ts
import type { DatenQuelleArt } from './datenquelle';
export interface TitlerStatus {
  /* ndiActive, connections, suiteClients, variables, dataSources, dataError?: wie bisher */
  entries: Array<{ key: string; label: string }>;
  activeEntry: number;
  gehalten?: { label: string };
  hinweis?: { art: 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6' | 'H7'; text: string };
  datenQuelle: { art: DatenQuelleArt; zeile: string; zurueckKnopf: string | null; ohneOrdner: boolean };
}
// JmtitlerApi neu:
//   recallSchluessel: (key: string) => Promise<void>;
//   zurueckZumEigenenOrdner: () => Promise<void>;
// IPC-Kanäle: 'titler:recallSchluessel', 'titler:zurueckZumOrdner'
// STATE (control-server toSuiteState): kv.recall_kennung = 1
```
B14 nutzt `TitlerStatus.entries`, `activeEntry`, `gehalten`, `hinweis`, `datenQuelle` und `window.jmtitler.recallSchluessel` / `zurueckZumEigenenOrdner`. B17 liest `entry` und `entry_index` aus dem STATE.

**Vorab (gemessen an einer Kopie der App, erst mit Stubs, dann mit den ausgeschriebenen Fassungen aus B8–B11 und `@jm/show` mit B3; Selbsttest, `typecheck:node`, `typecheck:web` und `electron-vite build` grün):**
- **Kernzustand und Ordnerwechsel:** Das alte `startDataWatch` rief `stopDataWatch(true)` und setzte damit den aktiven Eintrag zurück. Neu trennt `schliesseBeobachter()` das Schließen von `fs.watch`/Poll vom Zurücksetzen. `stopDataWatch()` setzt den Kern nur noch beim Beenden zurück (und im Test). So gilt A8/A9: Der Kern gleicht beim Ordnerwechsel über den Schlüssel ab.
- **`andererOrdner`** ist `true`, wenn sich der beobachtete Ordner ändert, auch beim allerersten Aufruf (`zuletztBeobachtet === null`). Damit wird beim ersten Start Eintrag 1 aktiv (B9: „Das gilt auch für den ersten Start“), denn beim Start ist nichts auf Sendung. Auf Sendung wählt ein Ordnerwechsel ohne aktiven Eintrag nie Eintrag 1; das regelt der Kern (B9, A8), `startDataWatch` braucht dafür nichts.
- **A7 nur im selben Ordner:** `rescan` behält die alten Quellen (`sources`) nur, wenn auch der Kern die leere Liste behält (`leerHalten && !andererOrdner`, Regel aus B9). Wechselt die Quelle auf einen leeren Ordner, sind Liste und Quellen leer. Test „B13: Wechsel auf einen leeren Ordner …“; ohne `&& !andererOrdner` wird genau dieser Test rot (nachgemessen beim Zusammensetzen des Plans).
- **1-s-Uhr (A4):** `setzeAufSendung(false)` lässt den Kern `wegAbMs = jetzt + 1000` setzen (B9). `datalink.ts` richtet nach jedem Kern-Schritt einen Timer an `kern.wegAbMs` aus und ruft beim Feuern `uhrTick`. Die Wartezeit ist höchstens `HALTEN_NACH_SENDUNG_MS`, auch wenn die Systemuhr zurückgestellt wird. Node-Timer können eine Millisekunde vor `Date.now()` feuern. Als „jetzt“ gilt deshalb mindestens die Frist selbst. Eine abgelaufene Frist wird nie zweimal geplant.
- **Nur ein Wechsel der Sendung zählt:** Der Renderer meldet `titler:report-state` auch bei NDI-, Vorlagen- und Empfängerwechseln. Ein weiteres „aus“ würde die 1-s-Frist sonst neu starten. `setzeAufSendung` tut nichts, wenn `kern.aufSendung` schon stimmt.
- **Importwege:** `datalink.ts` importiert den Kern relativ (`../shared/datalink-kern`), weil tsx im Selbsttest den Alias `@shared` nicht kennt. `index.ts` nutzt `@shared/…`, wie die übrigen Importe dort. Im gebauten `out/main/index.cjs` steht der Kern trotzdem genau einmal (gemessen, Step 13).
- **`currentShowPath` beim Start:** Mit gemerkter Show steht er von Anfang an auf deren Pfad. Dann wirkt RELOAD auch nach einem Start über die Kachel (behebt 2.1 Nr. 9). `gleicheShowPfad(currentShowPath, pfad, path.resolve)` erkennt beim Start und bei einem Deep-Link derselben Show „dieselbe Show“ (Spec 7.7 „wie Deep-Link“, Review Focus 2).
- **Vorlage (C3)** wird nur beim Deep-Link geöffnet, und nur wenn `schritt.vorlage` gilt. Beim Start über die gemerkte Show (`'start'`) und bei RELOAD nie.
- **`index.ts:6`** bleibt unverändert: `parseShow` braucht weiter `openShowDocument` (C3). `readFileSync` (`:3`) ebenso.
- **`OperatorView.tsx:52-53`** braucht in dieser Aufgabe keine Änderung. Die Konstanten bleiben, nur ihr Typ ändert sich. B14 ergänzt dort `hinweis` und `datenQuelle`.
- **Bis B14** prüft „Daten / Recall“ noch `!c.dataFolder`. Bei Quelle Show ohne eigenen Ordner steht dort deshalb kurz „Kein Datenordner aktiv …“. B14 stellt das auf `datenQuelle.ohneOrdner` um. Zwischen B13 und B14 wird nicht released.
- **Zeilenenden:** Die Arbeitskopie hat CRLF. Das Edit-Werkzeug gleicht das aus. `datalink.ts` wird ganz ersetzt (Write-Werkzeug, LF); Git normalisiert beim `git add`.
- **Zeilenangaben** in `index.ts` gelten für den Stand nach B8. B8 hat nur `:20` (Import `iveoDataDir`) und `:150` (Aufruf `writeSpeakersTsv(iveoDataDir(app.getPath('userData')), speakers)`) geändert. Maßgeblich ist der wortgleiche Vorher-Text. Weicht `:150` davon ab, gilt im Vorher-Text die Zeile, die B8 geschrieben hat.

---

- [ ] **Step 1: Failing Test schreiben**

In `apps/titler/test/selftest.ts` den folgenden Block **direkt vor dem Abschluss** einfügen, also nach dem B12-Block und vor der Zeile `if (failed > 0) {` am Dateiende. Er schreibt echte Dateien in einen Temp-Ordner und wartet 1,1 s auf die Uhr. Die Sendung meldet der Test selbst mit `setzeAufSendung`.

```ts
// ── B13 · datalink.ts über den Kern: echter Ordner, Sendung, 1-s-Uhr (Spec 7.1, 7.3, 7.5, 9.3 Nr. 3/5/7) ──
{
  const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const datalink = await import('../src/main/datalink');
  const tmp = mkdtempSync(join(tmpdir(), 'jmtitler-'));
  const datei = join(tmp, 'speakers.tsv');
  const tsv = (zeilen: string[]): string => ['name\tfunktion\ttitle\t@kennung', ...zeilen].join('\n') + '\n';
  const NEU = 'Neu\tGast\tGast\ts-0';
  const ADA = 'Ada\tMathematik\tMathematik\ts-1';
  const GRACE = 'Grace\tCompiler\tCompiler\ts-2';
  const ALAN = 'Alan\tInformatik\tInformatik\ts-3';
  const HEDY = 'Hedy\tFunk\tFunk\ts-4';
  const logs: string[] = [];
  let meldungen = 0;
  try {
    writeFileSync(datei, tsv([ADA, GRACE, ALAN, HEDY]));
    datalink.startDataWatch(tmp, () => meldungen++, { leerHalten: true, log: (m: string) => logs.push(m) });
    let d = datalink.getDataState();
    ok(meldungen >= 1, 'B13: startDataWatch meldet den Stand an den Rückruf');
    ok(d.entries.map((e) => e.key).join(',') === 's-1,s-2,s-3,s-4', 'B13: Schlüssel kommen aus @kennung');
    ok(d.activeIndex === 0, 'B13: erster Start → Eintrag 1');
    datalink.recallSchluessel('s-2');
    ok(datalink.getDataState().companion.entry === 'Grace', 'B13: recallSchluessel trifft genau den Schlüssel');
    datalink.recall('Alan');
    d = datalink.getDataState();
    ok(d.activeIndex === 2 && d.variables.funktion === 'Informatik', 'B13: recall per Name → Alan aktiv, seine Variablen');
    ok(!('@kennung' in d.variables), 'B13: @kennung steht nicht in den Variablen');
    ok(JSON.stringify(d.companion) === JSON.stringify({ entry: 'Alan', entryIndex: 3, entryCount: 4 }), 'B13: Companion-Werte für Alan (3 von 4)');
    datalink.setzeAufSendung(true);

    // 9.3 Nr. 3 mit echter Datei: „Neu“ kommt davor → Alan bleibt Alan, jetzt Nr. 4
    writeFileSync(datei, tsv([NEU, ADA, GRACE, ALAN, HEDY]));
    datalink.rescanJetzt();
    d = datalink.getDataState();
    ok(JSON.stringify(d.companion) === JSON.stringify({ entry: 'Alan', entryIndex: 4, entryCount: 5 }), 'B13: Alan bleibt Alan, jetzt Nr. 4 von 5');
    ok(logs.includes('DataLink: „Alan“ hält seinen Eintrag (jetzt Nr. 4 von 5).'), 'B13: Logzeile A1 erreicht den Log-Rückruf');

    // 9.3 Nr. 5: Alan fällt weg, auf Sendung → gehalten (A2)
    writeFileSync(datei, tsv([NEU, ADA, GRACE, HEDY]));
    datalink.rescanJetzt();
    d = datalink.getDataState();
    ok(d.gehalten?.label === 'Alan' && d.activeIndex === -1, 'B13: Alan gehalten, kein Eintrag markiert (A2)');
    ok(d.variables.funktion === 'Informatik', 'B13: eingefrorene Variablen von Alan');
    ok(d.companion.entry === 'Alan' && d.companion.entryIndex === 0 && d.companion.entryCount === 4, 'B13: Companion: entry Alan, entry_index 0');
    ok(d.hinweis?.art === 'H1', 'B13: Hinweis H1');
    ok(logs.includes('DataLink: aktiver Eintrag „Alan“ nicht mehr in der Liste, auf Sendung gehalten.'), 'B13: Logzeile A2');

    // 9.3 Nr. 7 mit echter Uhr: Sendung endet → 1 s später kein Eintrag (A4)
    datalink.setzeAufSendung(false);
    ok(datalink.getDataState().gehalten?.label === 'Alan', 'B13: direkt nach dem Ende der Sendung noch gehalten');
    await new Promise((fertig) => setTimeout(fertig, 1100));
    d = datalink.getDataState();
    ok(d.activeIndex === -1 && d.gehalten === undefined, 'B13: 1,1 s nach der Sendung kein aktiver und kein gehaltener Eintrag');
    ok(d.hinweis?.art === 'H2' && Object.keys(d.variables).length === 0, 'B13: Hinweis H2, leere Variablen');
    ok(d.companion.entry === '' && d.companion.entryIndex === 0, 'B13: Companion leer');

    // A7: Quelle Show (leerHalten) und die Datei ist leer → Liste bleibt
    writeFileSync(datei, '');
    datalink.rescanJetzt();
    ok(datalink.getDataState().entries.length === 4, 'B13: leere Datei bei leerHalten → Liste bleibt (A7)');

    // A7 gilt nur im selben Ordner (B9): Wechsel auf einen leeren Ordner leert Liste und Quellen.
    const leer = join(tmp, 'leer');
    mkdirSync(leer);
    datalink.startDataWatch(leer, () => meldungen++, { leerHalten: true, log: (m: string) => logs.push(m) });
    d = datalink.getDataState();
    ok(d.entries.length === 0 && d.sources.length === 0, 'B13: Wechsel auf einen leeren Ordner → keine Einträge, keine Quellen (A7 nur im selben Ordner)');
  } finally {
    datalink.stopDataWatch();
    rmSync(tmp, { recursive: true, force: true });
  }
  ok(datalink.getDataState().entries.length === 0, 'B13: stopDataWatch setzt den Kern zurück');
}
```

- [ ] **Step 2: Test laufen lassen, er muss scheitern**

```bash
npm run selftest -w @jm/titler
```
Erwartet: B8–B12 laufen durch. Dann zeigt der alte `datalink.ts`:
- `ok` für „B13: startDataWatch meldet den Stand an den Rückruf“
- `FAIL` für „B13: Schlüssel kommen aus @kennung“, denn die alten Einträge haben kein `key`
- `ok` für „B13: erster Start → Eintrag 1“

Danach bricht der Lauf ab, Exit-Code 1:
```
TypeError: datalink.recallSchluessel is not a function
```
Das `finally` räumt den Temp-Ordner trotzdem weg.

- [ ] **Step 3: `datalink.ts` ganz ersetzen**

Datei `apps/titler/src/main/datalink.ts`, ganzer neuer Inhalt:

```ts
// --- JM Titler: DataLink-Watchfolder (#86) mit Recall (#93-Folgewunsch) ---
//
// Überwacht einen Ordner auf Datendateien und stellt daraus eine LISTE von
// Einträgen bereit, die einzeln „abgerufen" (recall) werden können — per UI,
// per Companion (RECALL/NEXT/PREV) oder per Steuerprotokoll. Der aktive Eintrag
// liefert die Variablen-Tabelle, aus der die `{{schlüssel}}`-Platzhalter in den
// Textfeldern aufgelöst werden (siehe shared/vars.ts). Vgl. TriCaster DataLink.
//
// Master-Link Teil 2b (Spec 7.1): Dieses Modul liest und beobachtet nur noch den
// Ordner. Dateien lesen, Schlüssel bilden, den aktiven Eintrag über seinen SCHLÜSSEL
// halten (nicht über die Nummer), Abruf und Hinweise macht der reine Kern
// `shared/datalink-kern.ts`. Hier dazu: die Uhr, die einen gehaltenen Eintrag 1 s
// nach dem Ende der Sendung fallen lässt (A4, HALTEN_NACH_SENDUNG_MS über
// `wegAbMs` im Kern).
//
// Quellformate (alle Dateien im Ordner werden alphabetisch zusammengeführt):
//   • CSV/TSV  → tabellarische LISTE: erste Zeile = Spaltennamen (= Variablen),
//                jede weitere Zeile = ein Eintrag; Spalte `@kennung` = Schlüssel.
//   • .txt/.env/.ini/.properties → `schlüssel=wert` / `schlüssel: wert`,
//                die ganze Datei = EIN Eintrag.
//
// Bewusst ohne Zusatz-Dependency (kein chokidar): fs.watch auf das Verzeichnis,
// entprellt, plus ein niederfrequenter mtime-Poll als Sicherheitsnetz gegen
// verschluckte Events (fs.watch ist je nach Plattform unzuverlässig).
// Ohne Electron: der Titler-Selbsttest (tsx) lädt das Modul direkt.
import { existsSync, readdirSync, readFileSync, statSync, watch, type FSWatcher } from 'node:fs';
import { extname, join } from 'node:path';
import {
  companionWerte,
  fuehreZusammen,
  HALTEN_NACH_SENDUNG_MS,
  kernSicht,
  leererKern,
  neueListe,
  parseKvDatei,
  parseTable,
  rufeAb,
  rufeSchluesselAb,
  schritt,
  setzeSendung,
  uhrTick,
  type DataEntry,
  type KernSchritt,
  type KernSicht,
  type KernZustand,
} from '../shared/datalink-kern';

/** Vom Watchfolder akzeptierte Endungen. */
const DATA_EXT = new Set(['.txt', '.env', '.csv', '.tsv', '.ini', '.properties']);

export interface DataState extends KernSicht {
  /** Dateinamen, die beigetragen haben. */
  sources: string[];
  /** Lesefehler (z. B. Ordner fehlt) — sonst undefined. */
  error?: string;
  /** Werte für den Companion-STATE: entry, entry_index, entry_count (Spec 7.5). */
  companion: { entry: string; entryIndex: number; entryCount: number };
}

let watcher: FSWatcher | null = null;
let debounce: NodeJS.Timeout | null = null;
let poll: NodeJS.Timeout | null = null;
let watchedDir = '';
/** Zuletzt beobachteter Ordner; `null` = noch keiner (der erste Start zählt als Ordnerwechsel). */
let zuletztBeobachtet: string | null = null;
let lastSig = '';
/** Quelle Show/früher: eine leer gelesene Liste ändert nichts (A7, Spec 7.6). */
let leerHalten = false;
let kern: KernZustand = leererKern();
let quellen: { sources: string[]; error?: string } = { sources: [] };
let current: DataState = baueState();
let listener: ((d: DataState) => void) | null = null;
let logZeile: ((m: string) => void) | null = null;
/** Uhr für A4: feuert, wenn `kern.wegAbMs` erreicht ist. */
let uhr: NodeJS.Timeout | null = null;
let uhrZiel: number | null = null;
/** Schon abgelaufene Frist — wird nie ein zweites Mal geplant. */
let uhrErledigt: number | null = null;

function baueState(): DataState {
  return { ...kernSicht(kern), sources: quellen.sources, error: quellen.error, companion: companionWerte(kern) };
}

/** Einen Kern-Schritt übernehmen: Zustand, Logzeilen (Spec 7.9), Uhr, Meldung an den Main. */
function anwenden(s: KernSchritt): void {
  kern = s.zustand;
  for (const zeile of s.log) logZeile?.(zeile);
  planeUhr();
  current = baueState();
  listener?.(current);
}

/** Die Uhr an `kern.wegAbMs` ausrichten: planen, verschieben oder abbrechen. */
function planeUhr(): void {
  const ziel = kern.wegAbMs;
  if (ziel === uhrZiel || (ziel !== null && ziel === uhrErledigt)) return;
  if (uhr) clearTimeout(uhr);
  uhr = null;
  uhrZiel = ziel;
  if (ziel === null) return;
  // Höchstens HALTEN_NACH_SENDUNG_MS: eine zurückgestellte Systemuhr verlängert das Halten nicht.
  const warten = Math.min(Math.max(0, ziel - Date.now()), HALTEN_NACH_SENDUNG_MS);
  uhr = setTimeout(uhrLaeuft, warten);
}

function uhrLaeuft(): void {
  const ziel = uhrZiel;
  uhr = null;
  uhrZiel = null;
  uhrErledigt = ziel; // eine abgelaufene Frist wird nie ein zweites Mal geplant
  if (ziel === null) return;
  // Feuert die Uhr, ist die Frist um. Node-Timer können eine Millisekunde vor Date.now()
  // feuern, deshalb gilt mindestens die Frist selbst als „jetzt“.
  anwenden(uhrTick(kern, Math.max(Date.now(), ziel)));
}

/** Ordner scannen: alle Datendateien lesen und über den Kern zu einer Liste zusammenführen. */
function scan(dir: string): { entries: DataEntry[]; sources: string[]; error?: string } {
  if (!dir) return { entries: [], sources: [] };
  if (!existsSync(dir)) return { entries: [], sources: [], error: 'Ordner nicht gefunden' };
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => DATA_EXT.has(extname(f).toLowerCase()));
  } catch (err) {
    return { entries: [], sources: [], error: (err as Error).message };
  }
  files.sort((a, b) => a.localeCompare(b));
  const teile: DataEntry[][] = [];
  const sources: string[] = [];
  for (const f of files) {
    try {
      const content = readFileSync(join(dir, f), 'utf8');
      const ext = extname(f).toLowerCase();
      let es: DataEntry[];
      if (ext === '.csv' || ext === '.tsv') {
        es = parseTable(content, f);
      } else {
        const e = parseKvDatei(content, f);
        es = e ? [e] : [];
      }
      if (es.length) {
        teile.push(es);
        sources.push(f);
      }
    } catch {
      // einzelne Datei korrupt oder gerade gesperrt → überspringen
    }
  }
  return { entries: fuehreZusammen(teile), sources };
}

/** Signatur über Datei-Namen+mtime+Größe für den Poll-Fallback. */
function signature(dir: string): string {
  if (!dir || !existsSync(dir)) return '';
  try {
    return readdirSync(dir)
      .filter((f) => DATA_EXT.has(extname(f).toLowerCase()))
      .sort()
      .map((f) => {
        try {
          const s = statSync(join(dir, f));
          return `${f}:${s.mtimeMs}:${s.size}`;
        } catch {
          return f;
        }
      })
      .join('|');
  } catch {
    return '';
  }
}

function rescan(andererOrdner = false): void {
  const r = scan(watchedDir);
  // A7 (wie neueListe nur im selben Ordner): bleibt die alte Liste stehen, bleiben auch ihre Quellen stehen.
  const behalten = r.entries.length === 0 && leerHalten && !andererOrdner;
  quellen = { sources: behalten ? quellen.sources : r.sources, error: r.error };
  lastSig = signature(watchedDir);
  anwenden(neueListe(kern, r.entries, { andererOrdner, leerHalten }));
}

function scheduleRescan(): void {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => rescan(), 250);
}

function schliesseBeobachter(): void {
  if (debounce) {
    clearTimeout(debounce);
    debounce = null;
  }
  if (poll) {
    clearInterval(poll);
    poll = null;
  }
  if (watcher) {
    try {
      watcher.close();
    } catch {
      /* egal */
    }
    watcher = null;
  }
}

export function getDataState(): DataState {
  return current;
}

/** Eintrag abrufen (Spec 7.4): Nummer, Schlüssel, Label, Teilstring oder `@⟨Kennung⟩ ⟨Name⟩`. */
export function recall(ref: string): void {
  anwenden(rufeAb(kern, ref));
}

/** Klick in Liste oder Board: sucht nur den Schlüssel (Spec 7.4). */
export function recallSchluessel(key: string): void {
  anwenden(rufeSchluesselAb(kern, key));
}

/** Aktiven Eintrag um `delta` verschieben (geklemmt; ohne aktiven Eintrag → Eintrag 1). */
export function step(delta: number): void {
  anwenden(schritt(kern, delta));
}

/**
 * Sendung an den Kern melden (A2/A4). Nur ein Wechsel zählt: der Renderer meldet seinen
 * Zustand auch bei NDI- oder Vorlagen-Änderungen, und jede weitere Meldung „aus“ würde
 * die 1-s-Frist sonst neu starten.
 */
export function setzeAufSendung(onAir: boolean): void {
  if (kern.aufSendung === onAir) return;
  anwenden(setzeSendung(kern, onAir, Date.now()));
}

/** Ordner sofort neu einlesen (für Tests; im Betrieb lesen fs.watch und der Poll). */
export function rescanJetzt(): void {
  if (debounce) {
    clearTimeout(debounce);
    debounce = null;
  }
  rescan();
}

/**
 * Watchfolder (neu) setzen. Leerer Pfad = nichts lesen (leere Liste). `cb` bekommt jeden
 * neuen Stand (und den ersten). Der Kernzustand bleibt bei einem Ordnerwechsel erhalten
 * (A8/A9): der Kern gleicht den aktiven Eintrag über seinen Schlüssel ab.
 * `leerHalten`: Quelle Show/früher (A7). `log`: Logzeilen des Kerns (Spec 7.9).
 */
export function startDataWatch(
  dir: string,
  cb: (d: DataState) => void,
  o: { leerHalten: boolean; log?: (m: string) => void },
): void {
  listener = cb;
  leerHalten = o.leerHalten;
  logZeile = o.log ?? null;
  const ziel = dir || '';
  if (ziel === watchedDir && watcher) {
    rescan(); // gleicher Ordner → nur frisch einlesen
    return;
  }
  schliesseBeobachter();
  const andererOrdner = ziel !== zuletztBeobachtet;
  watchedDir = ziel;
  zuletztBeobachtet = ziel;
  rescan(andererOrdner);
  if (!watchedDir) return;
  try {
    watcher = watch(watchedDir, { persistent: false }, () => scheduleRescan());
  } catch {
    watcher = null; // Ordner fehlt o. Ä. → Poll fängt es ab
  }
  poll = setInterval(() => {
    if (signature(watchedDir) !== lastSig) rescan();
  }, 3000);
}

/** Beobachtung beenden und den Kern zurücksetzen — nur beim Beenden der App (und im Test). */
export function stopDataWatch(keepListener = false): void {
  schliesseBeobachter();
  if (uhr) {
    clearTimeout(uhr);
    uhr = null;
  }
  uhrZiel = null;
  uhrErledigt = null;
  watchedDir = '';
  zuletztBeobachtet = null;
  lastSig = '';
  kern = leererKern();
  quellen = { sources: [] };
  current = baueState();
  if (!keepListener) {
    listener = null;
    logZeile = null;
  }
}
```

- [ ] **Step 4: Test laufen lassen, er muss bestehen**

```bash
npm run selftest -w @jm/titler
```
Erwartet: B8–B12 wie bisher, dazu 21 `ok`-Zeilen mit `B13:`, von „B13: startDataWatch meldet den Stand an den Rückruf“ bis „B13: stopDataWatch setzt den Kern zurück“, zusammen 305. Keine `FAIL`-Zeile, `ALLE TESTS OK`, Exit-Code 0. Der Lauf dauert gut 1 s länger (Uhr). Er endet von selbst: `stopDataWatch()` räumt Poll und Uhr ab.

- [ ] **Step 5: Typecheck zeigt die Aufrufstelle (rot)**

```bash
npm run typecheck:node -w @jm/titler
```
Erwartet, Exit-Code ungleich 0:
```
src/main/index.ts(114,3): error TS2554: Expected 3 arguments, but got 2.
```
Das ist der alte Aufruf `startDataWatch(folder, (d: DataState) => …)` in `refreshDataWatch`. Steps 6–11 ersetzen ihn.

- [ ] **Step 6: `TitlerStatus` und `JmtitlerApi` erweitern** (`apps/titler/src/shared/types.ts`)

Kopf, Vorher:
```ts
// Renderer; die hier persistierte Konfiguration ist nur Inhalt/Stil/Ausgabe.

export type TemplateKind = 'lowerthird' | 'banner' | 'ticker' | 'graphic';
```
Nachher:
```ts
// Renderer; die hier persistierte Konfiguration ist nur Inhalt/Stil/Ausgabe.

import type { DatenQuelleArt } from './datenquelle';

export type TemplateKind = 'lowerthird' | 'banner' | 'ticker' | 'graphic';
```

`TitlerStatus` (`:165-169`), Vorher:
```ts
  /** Labels aller abrufbaren DataLink-Einträge (Recall-Liste). */
  entries: string[];
  /** Index des aktiven Eintrags, -1 wenn keiner. */
  activeEntry: number;
}
```
Nachher:
```ts
  /** Abrufbare DataLink-Einträge (Recall-Liste): Schlüssel (Kennung oder Ersatz, Spec 7.2) und Label. */
  entries: Array<{ key: string; label: string }>;
  /** Stelle des aktiven Eintrags, -1 wenn keiner — auch bei einem gehaltenen (Spec 7.4). */
  activeEntry: number;
  /** Gehaltener Eintrag (A2/A10): auf Sendung, aber nicht mehr in der Liste bzw. nicht mehr aktiv. */
  gehalten?: { label: string };
  /** Stehender Hinweis H1–H7 mit wörtlichem Text (Spec 7.8); bei mehreren gilt der Vorrang. */
  hinweis?: { art: 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6' | 'H7'; text: string };
  /** Datenquelle des DataLink (Spec 7.7): Art, Zeile Q1–Q3, Knopf K1, „Kein Datenordner aktiv“. */
  datenQuelle: { art: DatenQuelleArt; zeile: string; zurueckKnopf: string | null; ohneOrdner: boolean };
}
```

`JmtitlerApi` (`:249-252`), Vorher:
```ts
  /** DataLink-Eintrag abrufen (Nr. oder Name). */
  recallEntry: (ref: string) => Promise<void>;
  /** Aktiven DataLink-Eintrag verschieben (+1 / -1). */
  stepEntry: (delta: number) => Promise<void>;
```
Nachher:
```ts
  /** DataLink-Eintrag abrufen (Nr. oder Name). */
  recallEntry: (ref: string) => Promise<void>;
  /** DataLink-Eintrag über seinen Schlüssel abrufen — Klick in Liste oder Board (Spec 7.4). */
  recallSchluessel: (key: string) => Promise<void>;
  /** Aktiven DataLink-Eintrag verschieben (+1 / -1). */
  stepEntry: (delta: number) => Promise<void>;
  /** Datenquelle zurück auf den eigenen DataLink-Ordner (Knopf K1, Spec 7.7). */
  zurueckZumEigenenOrdner: () => Promise<void>;
```

- [ ] **Step 7: Preload und STATE**

`apps/titler/src/preload/index.ts` (`:29-30`), Vorher:
```ts
  recallEntry: (ref: string) => ipcRenderer.invoke('titler:recall', ref) as Promise<void>,
  stepEntry: (delta: number) => ipcRenderer.invoke('titler:stepEntry', delta) as Promise<void>,
```
Nachher:
```ts
  recallEntry: (ref: string) => ipcRenderer.invoke('titler:recall', ref) as Promise<void>,
  recallSchluessel: (key: string) => ipcRenderer.invoke('titler:recallSchluessel', key) as Promise<void>,
  stepEntry: (delta: number) => ipcRenderer.invoke('titler:stepEntry', delta) as Promise<void>,
  zurueckZumEigenenOrdner: () => ipcRenderer.invoke('titler:zurueckZumOrdner') as Promise<void>,
```

`apps/titler/src/main/control-server.ts`, in `toSuiteState` (`:60-63`), Vorher:
```ts
      entry: dataInfo.entry,
      entry_index: dataInfo.entryIndex,
      entry_count: dataInfo.entryCount,
    },
```
Nachher:
```ts
      entry: dataInfo.entry,
      entry_index: dataInfo.entryIndex,
      entry_count: dataInfo.entryCount,
      // Feste Fähigkeit (Spec 7.5): dieser Titler versteht `TITLER RECALL @⟨Kennung⟩ ⟨Name⟩`.
      // Der Rundown liest daraus, ob er die `@`-Form senden darf (Spec 8.3).
      recall_kennung: 1,
    },
```
`formatSuiteState` schreibt die Zahl als `recall_kennung=1`. Das Companion-Modul übernimmt nur die Variablen seiner Tabelle; `packages/companion-jm-suite` bleibt unberührt (G1).

- [ ] **Step 8: Typecheck zeigt alle Stellen, die die neuen Typen brauchen (rot)**

```bash
npm run typecheck:node -w @jm/titler
npm run typecheck:web -w @jm/titler
```
Erwartet (gemessen), beide mit Exit-Code ungleich 0:
```
src/main/index.ts(35,7): error TS2741: Property 'datenQuelle' is missing in type '{ ndiActive: false; … }' but required in type 'TitlerStatus'.
src/main/index.ts(114,3): error TS2554: Expected 3 arguments, but got 2.
src/main/index.ts(118,5): error TS2322: Type 'string[]' is not assignable to type '{ key: string; label: string; }[]'.
```
```
src/renderer/src/views/OperatorView.tsx(510,60): error TS2322: Type '{ key: string; label: string; }' is not assignable to type 'ReactNode'.
src/renderer/src/views/RecallBoard.tsx(21,36): error TS2339: Property 'toLowerCase' does not exist on type '{ key: string; label: string; }'.
src/renderer/src/views/RecallBoard.tsx(52,17): error TS2322: Type '{ key: string; label: string; }' is not assignable to type 'string'.
src/renderer/src/views/RecallBoard.tsx(61,48): error TS2322: Type '{ key: string; label: string; }' is not assignable to type 'ReactNode'.
```

- [ ] **Step 9: `index.ts` — Importe, `currentShowPath`, Anfangsstatus**

Importe (`:19-20`), Vorher:
```ts
import { startDataWatch, stopDataWatch, recall, step, type DataState } from './datalink';
import { iveoDataDir, writeSpeakersTsv } from './iveo-show';
```
Nachher:
```ts
import {
  recall,
  recallSchluessel,
  setzeAufSendung,
  startDataWatch,
  step,
  stopDataWatch,
  type DataState,
} from './datalink';
import { iveoDataDir, writeSpeakersTsv } from './iveo-show';
import { leseGemerkteShow, leseShowSicher, loescheGemerkteShow, schreibeGemerkteShow } from './show-quelle';
import { hinweisLogZeile, hinweisText, waehleHinweis } from '@shared/datalink-kern';
import {
  eigenerOrdner,
  gleicheShowPfad,
  quellSchritt,
  quellZeile,
  startZustand,
  uebergang,
  zurueckKnopf,
  type QuellEreignis,
  type QuellSchritt,
  type QuellWeg,
  type QuellZustand,
} from '@shared/datenquelle';
```

`:32-43`, Vorher:
```ts
/** Pfad der aktuell geladenen Show (für Live-Reload nach iveo-Update). */
let currentShowPath: string | null = null;

const status: TitlerStatus = {
  ndiActive: false,
  connections: 0,
  suiteClients: 0,
  variables: {},
  dataSources: [],
  entries: [],
  activeEntry: -1,
};
```
Nachher:
```ts
/**
 * Pfad der verbundenen Show (Ziel von RELOAD nach iveo-Update, Vergleich „dieselbe Show“).
 * Beim Start die gemerkte Show (Spec 7.7), danach die zuletzt geöffnete — auch wenn sie
 * gerade nicht lesbar war. Nach Ordnerwahl oder „Zurück zum eigenen Ordner“ null.
 */
let currentShowPath: string | null = null;

const status: TitlerStatus = {
  ndiActive: false,
  connections: 0,
  suiteClients: 0,
  variables: {},
  dataSources: [],
  entries: [],
  activeEntry: -1,
  datenQuelle: { art: 'ordner', zeile: '', zurueckKnopf: null, ohneOrdner: true },
};
```

- [ ] **Step 10: `index.ts` — DataLink, Datenquelle, Deep-Link, RELOAD** (`:100-170`, ein zusammenhängender Block)

Vorher (Stand nach B8, von `/** DataLink-Watchfolder (neu) starten…` bis zum Ende von `reloadCurrentShow`):
```ts
/** DataLink-Watchfolder (neu) starten/aktualisieren — Einträge/Variablen spiegeln. */
function refreshDataWatch(): void {
  const folder = getConfig().dataFolder;
  if (!folder) {
    stopDataWatch();
    status.variables = {};
    status.dataSources = [];
    status.dataError = undefined;
    status.entries = [];
    status.activeEntry = -1;
    broadcastStatus();
    updateTitlerData({ entry: '', entryIndex: 0, entryCount: 0 });
    return;
  }
  startDataWatch(folder, (d: DataState) => {
    status.variables = d.variables;
    status.dataSources = d.sources;
    status.dataError = d.error;
    status.entries = d.entries.map((e) => e.label);
    status.activeEntry = d.activeIndex;
    broadcastStatus();
    updateTitlerData({
      entry: d.activeIndex >= 0 ? d.entries[d.activeIndex].label : '',
      entryIndex: d.activeIndex >= 0 ? d.activeIndex + 1 : 0,
      entryCount: d.entries.length,
    });
  });
}

/**
 * Show-Integration (#11, Phase 3): Wird der Titler per Show-Deep-Link gestartet und
 * trägt die Show eine iveo-Speaker-Liste, materialisieren wir sie als `speakers.tsv`
 * im verwalteten DataLink-Ordner und richten den Watchfolder darauf aus. Das
 * bestehende DataLink/Recall-System füllt daraus die Bauchbinden. Kein Token nötig
 * (die Daten stehen bereits sanitisiert in der Show).
 */
function applyShowFromDeepLink(url: string): void {
  const showPath = parseShowDeepLink(url);
  if (!showPath) return;
  applyShowFromPath(showPath);
  // C3: zusätzlich die referenzierte Bauchbinden-Vorlage (Dokument-Ref) öffnen.
  void openShowDocument(showPath);
}

function applyShowFromPath(showPath: string): void {
  try {
    const show = parseShow(readFileSync(showPath, 'utf8'));
    currentShowPath = showPath;
    const speakers = show.iveo?.speakers ?? [];
    if (!speakers.length) return; // Show ohne iveo-Speaker → DataLink unverändert lassen
    const dir = writeSpeakersTsv(iveoDataDir(app.getPath('userData')), speakers);
    if (getConfig().dataFolder !== dir) patchConfig({ dataFolder: dir });
    refreshDataWatch();
    getLog().info(`iveo: ${speakers.length} Speaker aus Show in den DataLink übernommen.`);
  } catch (err) {
    getLog().error(`Show konnte nicht geladen werden: ${(err as Error).message}`);
  }
}

/** Aktuelle Show neu einlesen (Launcher schickt `TITLER RELOAD` nach iveo-Update). */
function reloadCurrentShow(): boolean {
  if (!currentShowPath) {
    // SICHTBAR statt still — derselbe Fall wie im Timer (Ist-Karte 30.09.2026):
    // der Launcher zählt den Titler als "benachrichtigt", ohne Show-Pfad gibt
    // es aber nichts neu zu lesen.
    getLog().warn('RELOAD empfangen, aber keine Show geladen (nicht per Show gestartet) — nichts neu eingelesen.');
    return false;
  }
  applyShowFromPath(currentShowPath);
  return true;
}
```
Nachher:
```ts
// ── DataLink und Datenquelle (Master-Link Teil 2b, Spec 7.6/7.7) ─────────────
// `config.dataFolder` ist nur noch der Ordner des Bedieners — die Show schreibt ihn nie
// mehr. Woher die Einträge kommen, sagt die Datenquelle: `show` und `frueher` lesen
// `userData/iveo-data` (speakers.tsv aus der Show), `ordner` den eigenen Ordner. Die
// gemerkte Show (`show-zuletzt.json`) übersteht einen Neustart, damit RELOAD auch nach
// einem Start über die Kachel wirkt. Die Regeln stehen rein in `shared/datenquelle.ts`.
let quelle: QuellZustand = startZustand(null, false);
/** Erst nach dem Start (Übergang, gemerkte Show) darf ein Deep-Link die Datenquelle ändern. */
let datenquelleGestartet = false;
/** Deep-Link, der vor dem Start kam (macOS open-url vor whenReady). */
let wartenderDeepLink: string | null = null;

function userDataDir(): string {
  return app.getPath('userData');
}

/** Logzeilen des DataLink-Kerns (Spec 7.9) ins App-Log. */
function logDataLink(zeile: string): void {
  getLog().info(zeile);
}

/** DataLink-Stand in den Status (alle Fenster) und an Companion spiegeln. */
function uebernimmDataState(d: DataState): void {
  status.variables = d.variables;
  status.dataSources = d.sources;
  status.dataError = d.error;
  status.entries = d.entries;
  status.activeEntry = d.activeIndex;
  status.gehalten = d.gehalten;
  const h = waehleHinweis(d.hinweis, quelle.quellHinweis);
  status.hinweis = h ? { art: h.art, text: hinweisText(h) } : undefined;
  const eigener = eigenerOrdner(getConfig().dataFolder, iveoDataDir(userDataDir()), path.resolve);
  status.datenQuelle = {
    art: quelle.art,
    zeile: quellZeile(quelle, eigener, d.entries.length),
    zurueckKnopf: zurueckKnopf(quelle, eigener),
    ohneOrdner: quelle.art === 'ordner' && !eigener,
  };
  broadcastStatus();
  updateTitlerData(d.companion);
}

/**
 * Beobachteten Ordner nach der Datenquelle setzen: `show`/`frueher` → iveo-data (eine leer
 * gelesene Liste ändert nichts, A7), `ordner` → der eigene Ordner ('' = keiner: leere Liste).
 */
function refreshDataWatch(beobachte: 'iveo-data' | 'eigener' = quelle.art === 'ordner' ? 'eigener' : 'iveo-data'): void {
  const iveoData = iveoDataDir(userDataDir());
  if (beobachte === 'iveo-data') {
    startDataWatch(iveoData, uebernimmDataState, { leerHalten: true, log: logDataLink });
  } else {
    const eigener = eigenerOrdner(getConfig().dataFolder, iveoData, path.resolve);
    startDataWatch(eigener, uebernimmDataState, { leerHalten: false, log: logDataLink });
  }
}

/** Einen Schritt der Datenquelle ausführen: TSV, gemerkte Show, Logs, beobachteter Ordner. */
function wendeQuellSchrittAn(s: QuellSchritt): QuellSchritt {
  const vorher = quelle.quellHinweis;
  quelle = s.zustand;
  const userData = userDataDir();
  for (const zeile of s.log) getLog().info(zeile);
  if (s.tsv) {
    try {
      writeSpeakersTsv(iveoDataDir(userData), s.tsv);
      getLog().info(`iveo: ${s.tsv.length} Speaker aus Show in den DataLink übernommen.`);
    } catch (err) {
      getLog().error(`iveo: speakers.tsv konnte nicht geschrieben werden: ${(err as Error).message}`);
    }
  }
  if (s.merke.t === 'schreiben') {
    if (!schreibeGemerkteShow(userData, s.merke.wert)) getLog().warn('Gemerkte Show konnte nicht gespeichert werden.');
  } else if (s.merke.t === 'loeschen') {
    loescheGemerkteShow(userData);
  }
  const neu = quelle.quellHinweis;
  if (neu && JSON.stringify(neu) !== JSON.stringify(vorher)) {
    const zeile = hinweisLogZeile(neu);
    if (zeile) {
      if (neu.art === 'H7') getLog().warn(zeile);
      else getLog().info(zeile);
    }
  }
  refreshDataWatch(s.beobachte);
  return s;
}

/**
 * Show lesen und als Datenquelle anwenden (Deep-Link, RELOAD, Start). Nie mit Dateiinhalt im
 * Log (G10). RELOAD gilt danach dieser Show, auch wenn sie gerade nicht lesbar ist (Spec 7.7).
 */
function oeffneShow(pfad: string, weg: QuellWeg): QuellSchritt {
  const gelesen = leseShowSicher(pfad);
  let ereignis: QuellEreignis;
  if ('show' in gelesen) {
    const gleicheShow = currentShowPath !== null && gleicheShowPfad(currentShowPath, pfad, path.resolve);
    ereignis = { t: 'gelesen', weg, pfad, show: gelesen.show, gleicheShow };
  } else {
    getLog().warn(`Show nicht lesbar (${gelesen.grund}): ${pfad}`);
    ereignis = { t: 'nichtLesbar', weg, pfad, grund: gelesen.grund, gemerkt: leseGemerkteShow(userDataDir()) };
  }
  currentShowPath = pfad;
  return wendeQuellSchrittAn(quellSchritt(quelle, ereignis));
}

/**
 * Show-Integration (#11, Phase 3): Per Show-Deep-Link gestartet → die Show wird zur
 * Datenquelle (Speaker als `speakers.tsv` in userData/iveo-data, Spec 7.7). Kein Token
 * nötig (die Daten stehen bereits sanitisiert in der Show).
 */
function applyShowFromDeepLink(url: string): void {
  const showPath = parseShowDeepLink(url);
  if (!showPath) return;
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
    // SICHTBAR statt still — derselbe Fall wie im Timer (Ist-Karte 30.09.2026):
    // der Launcher zählt den Titler als "benachrichtigt", ohne Show-Pfad gibt
    // es aber nichts neu zu lesen.
    getLog().warn('RELOAD empfangen, aber keine Show geladen (nicht per Show gestartet) — nichts neu eingelesen.');
    return false;
  }
  oeffneShow(currentShowPath, 'reload');
  return true;
}

/** Bediener wählt einen DataLink-Ordner oder drückt „Zurück zum eigenen Ordner“ (Spec 7.7). */
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
  currentShowPath = gemerkt?.showPfad ?? null;
  datenquelleGestartet = true;
  const link = deepLink ?? wartenderDeepLink;
  wartenderDeepLink = null;
  if (link && parseShowDeepLink(link)) applyShowFromDeepLink(link);
  else if (gemerkt) oeffneShow(gemerkt.showPfad, 'start');
  else refreshDataWatch();
}
```
Hinweise zum Block:
- Die Show schreibt `config.dataFolder` nicht mehr; die alte Zeile `patchConfig({ dataFolder: dir })` entfällt.
- Nur `starteDatenquelle` leert `dataFolder` einmalig, wenn `uebergang` das verlangt (Spec 7.7 „Übergang“).
- `quellSchritt(quelle, { t })` mit `t: 'ordnerGewaehlt' | 'zurueckZumOrdner'` typecheckt gegen die Vereinigung `QuellEreignis` (gemessen).

- [ ] **Step 11: `index.ts` — IPC, Sendung, Start, Steuerserver-Kommentar**

In `registerIpc`, Handler `titler:setConfig` (`:400-402`), Vorher:
```ts
    const before = getConfig().dataFolder;
    patchConfig(patch);
    if (patch.dataFolder !== undefined && patch.dataFolder !== before) refreshDataWatch();
```
Nachher:
```ts
    const before = getConfig().dataFolder;
    patchConfig(patch);
    // Spec 7.7: Wählt der Bediener einen DataLink-Ordner, gilt der eigene Ordner (gemerkte Show gelöscht).
    if (patch.dataFolder !== undefined && patch.dataFolder !== before) eigenerOrdnerGilt('ordnerGewaehlt');
```

`:416-417`, Vorher:
```ts
  ipcMain.handle('titler:recall', (_e, ref: string) => recall(ref));
  ipcMain.handle('titler:stepEntry', (_e, delta: number) => step(delta));
```
Nachher:
```ts
  ipcMain.handle('titler:recall', (_e, ref: string) => recall(ref));
  // Klick in Liste oder Board: nur der Schlüssel zählt, nie die Stelle (Spec 7.4).
  ipcMain.handle('titler:recallSchluessel', (_e, key: string) => recallSchluessel(key));
  ipcMain.handle('titler:stepEntry', (_e, delta: number) => step(delta));
  // Knopf K1 „Zurück zum eigenen Ordner“ (Spec 7.7).
  ipcMain.handle('titler:zurueckZumOrdner', () => eigenerOrdnerGilt('zurueckZumOrdner'));
```

`:452-454`, Vorher:
```ts
  ipcMain.handle('titler:report-state', (_e, st: TitlerRemoteState) => {
    updateTitlerState(st);
    lastOnAir = st.onAir;
```
Nachher:
```ts
  ipcMain.handle('titler:report-state', (_e, st: TitlerRemoteState) => {
    updateTitlerState(st);
    lastOnAir = st.onAir;
    // Sendung an den DataLink-Kern: halten nur auf Sendung (A2), 1 s nach dem Ende weg (A4).
    setzeAufSendung(st.onAir);
```

Start in `app.whenReady` (`:485-491`), Vorher:
```ts
    // C3: eine vor dem Fenster eingetroffene Show-Vorlage jetzt nachliefern.
    flushPendingShowFile();
    // DataLink-Watchfolder (#86) starten, falls konfiguriert.
    refreshDataWatch();
    // Per Show gestartet? iveo-Speaker aus der Show in den DataLink übernehmen (#11)
    // + die referenzierte Bauchbinden-Vorlage (C3) laden.
    if (runtime.initialDeepLink) applyShowFromDeepLink(runtime.initialDeepLink);
```
Nachher:
```ts
    // C3: eine vor dem Fenster eingetroffene Show-Vorlage jetzt nachliefern.
    flushPendingShowFile();
    // DataLink (#86) und Datenquelle (Spec 7.7): Übergang, gemerkte Show, Datenordner.
    // Per Show gestartet? Speaker aus der Show (#11) + Bauchbinden-Vorlage (C3); ohne
    // Deep-Link wirkt die gemerkte Show (Start über die Kachel), ohne Vorlagen-Import.
    starteDatenquelle(runtime.initialDeepLink);
```

Steuerserver-Rückruf (`:515-516`), Vorher:
```ts
        // DataLink-Recall im Main behandeln (ändert den aktiven Eintrag, kein
        // Renderer-Push) → true = erledigt.
```
Nachher:
```ts
        // DataLink-Recall im Main behandeln (ändert den aktiven Eintrag, kein
        // Renderer-Push) → true = erledigt. Der Kern versteht Nummer, Name und die
        // `@`-Form `TITLER RECALL @⟨Kennung⟩ ⟨Name⟩`; ohne Treffer gilt A10/A11 (Spec 7.4).
```
Die Aufrufe `recall(rc.ref)`, `step(1)`, `step(-1)`, `reloadCurrentShow()` darunter bleiben wortgleich. `before-quit` ruft weiter `stopDataWatch()`.

Danach:
```bash
npm run typecheck:node -w @jm/titler
```
Erwartet: keine Ausgabe von `tsc`, Exit-Code 0.

- [ ] **Step 12: Renderer, nur damit es kompiliert**

`apps/titler/src/renderer/src/views/OperatorView.tsx` (`:498-501`), Vorher:
```tsx
                            {entries.map((label, i) => (
                              <button
                                key={`${i}-${label}`}
                                onClick={() => void window.jmtitler.recallEntry(String(i + 1))}
```
Nachher:
```tsx
                            {entries.map((e, i) => (
                              <button
                                key={e.key}
                                onClick={() => void window.jmtitler.recallSchluessel(e.key)}
```
und (`:510`), Vorher:
```tsx
                                <span className="truncate">{label || '—'}</span>
```
Nachher:
```tsx
                                <span className="truncate">{e.label || '—'}</span>
```

`apps/titler/src/renderer/src/views/RecallBoard.tsx` (`:19-21`), Vorher:
```tsx
    return entries
      .map((label, i) => ({ label, i }))
      .filter((e) => !t || e.label.toLowerCase().includes(t));
```
Nachher:
```tsx
    return entries
      .map((e, i) => ({ key: e.key, label: e.label, i }))
      .filter((e) => !t || e.label.toLowerCase().includes(t));
```
und (`:48-51`), Vorher:
```tsx
            {filtered.map(({ label, i }) => (
              <button
                key={`${i}-${label}`}
                onClick={() => void window.jmtitler.recallEntry(String(i + 1))}
```
Nachher:
```tsx
            {filtered.map(({ key, label, i }) => (
              <button
                key={key}
                onClick={() => void window.jmtitler.recallSchluessel(key)}
```
Die Board-Suche filtert weiter über `label`, der React-Schlüssel ist der Eintrags-Schlüssel (Spec 7.4).

- [ ] **Step 13: Alles grün — Typecheck, Selbsttest, Build**

```bash
npm run typecheck -w @jm/titler
npm run selftest -w @jm/titler
npm run build -w @jm/titler
grep -o "recall_kennung" apps/titler/out/main/index.cjs | wc -l
grep -o "titler:recallSchluessel" apps/titler/out/main/index.cjs apps/titler/out/preload/index.cjs | wc -l
grep -o "show-zuletzt.json" apps/titler/out/main/index.cjs | wc -l
grep -o "Die Bauchbinde bleibt stehen" apps/titler/out/main/index.cjs | wc -l
```
Erwartet:
- `typecheck`: `tsc` ohne Ausgabe, Exit-Code 0.
- `selftest`: alle Blöcke B8–B13 `ok`, `ALLE TESTS OK`, Exit-Code 0.
- `build`: drei Bündel (main, preload, renderer), je `✓ built in …`, Exit-Code 0.
- Die vier Zählungen ergeben `1`, `2`, `1`, `1`. Die letzte zeigt: Der Kern steht genau einmal im Main-Bündel (H1-Text aus B9), obwohl `index.ts` über `@shared/…` und `datalink.ts` relativ importiert.

`apps/titler/out/` und `*.tsbuildinfo` sind ignoriert.

- [ ] **Step 14: Commit** (Git Bash; Commit-Text bewusst ohne Umlaute)

```bash
git add apps/titler/src/main/datalink.ts apps/titler/src/main/index.ts apps/titler/src/main/control-server.ts apps/titler/src/shared/types.ts apps/titler/src/preload/index.ts apps/titler/src/renderer/src/views/OperatorView.tsx apps/titler/src/renderer/src/views/RecallBoard.tsx apps/titler/test/selftest.ts
git status --short
```
Erwartet genau:
```
M  apps/titler/src/main/control-server.ts
M  apps/titler/src/main/datalink.ts
M  apps/titler/src/main/index.ts
M  apps/titler/src/preload/index.ts
M  apps/titler/src/renderer/src/views/OperatorView.tsx
M  apps/titler/src/renderer/src/views/RecallBoard.tsx
M  apps/titler/src/shared/types.ts
M  apps/titler/test/selftest.ts
```
Dann:
```bash
git commit -m "feat(titler): DataLink ueber den Schluessel-Kern, Datenquelle und gemerkte Show (Teil 2b)" -m "datalink.ts liest nur noch Ordner und ruft den Kern; der aktive Eintrag haelt ueber seinen Schluessel, der Kernzustand bleibt beim Ordnerwechsel, eine Uhr laesst einen gehaltenen Eintrag 1 s nach dem Ende der Sendung fallen. index.ts: Datenquelle show/ordner/frueher, gemerkte Show (show-zuletzt.json), Uebergang fuer ein von einer Show gesetztes iveo-data, die Show schreibt config.dataFolder nicht mehr, RELOAD wirkt nach Start ueber die Kachel. Neue IPC titler:recallSchluessel und titler:zurueckZumOrdner, On-Air geht an den Kern, Status mit Hinweis und Quelle, STATE recall_kennung=1." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: B14 · Titler-Anzeige: Quellzeile, Hinweise, „Zurück zum eigenen Ordner“, Board-Hinweis und Karte B1

**Spec:** 7.8 vollständig:
- H1–H7 stehend in „Daten / Recall“; H1/H5/H6 zusätzlich oben im Board.
- Q1–Q3 als Zeile über der Liste.
- K1 unter Einstellungen › DataLink.
- B1 im Board.
- „Kein Datenordner aktiv“ prüft die Datenquelle.
- Ein gehaltener Eintrag erscheint nicht markiert („Einträge · ⟨n⟩“ ohne Stelle).

Dazu 7.4 (Weiter und Zurück ohne aktiven Eintrag → Eintrag 1, also beide Knöpfe frei) und 7.7 (Knopf „Zurück zum eigenen Ordner“).

**Arbeitsverzeichnis:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b`, Branch `feat/master-link-teil2b`. Alle Pfade relativ dazu. Voraussetzung: B13 ist committet.

**Dateien:**
- Create: `apps/titler/src/renderer/src/lib/datalink-anzeige.ts`
- Modify: `apps/titler/src/renderer/src/views/OperatorView.tsx`:
  - `:13` (Import)
  - `:50-53` (Konstanten)
  - `:235-239` (`iveoActive`, Sperre Weiter/Zurück)
  - `:446-540` („Daten / Recall“: Quellzeile, Hinweis, Bedingung, Zähler, Sperre)
  - `:590-645` (Einstellungen › DataLink: Knopf K1; der Abschnitt iveo nutzt das neue `iveoActive`)
- Modify: `apps/titler/src/renderer/src/views/RecallBoard.tsx` (ganz ersetzen)
- Modify: `apps/titler/test/selftest.ts` (neuer Block direkt vor dem Abschluss, nach dem Block aus B13)

**Interfaces:**

Consumes (aus B13, exakt):
```ts
// apps/titler/src/shared/types.ts
export interface TitlerStatus {
  /* ndiActive, connections, suiteClients, variables, dataSources, dataError? */
  entries: Array<{ key: string; label: string }>;
  activeEntry: number;                                  // -1 ohne aktiven Eintrag, auch bei gehaltenem
  gehalten?: { label: string };
  hinweis?: { art: 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6' | 'H7'; text: string };   // Text wörtlich (hinweisText, B9)
  datenQuelle: { art: DatenQuelleArt; zeile: string; zurueckKnopf: string | null; ohneOrdner: boolean };
}
export interface JmtitlerApi {
  /* … */
  recallSchluessel: (key: string) => Promise<void>;
  stepEntry: (delta: number) => Promise<void>;
  zurueckZumEigenenOrdner: () => Promise<void>;
}
// apps/titler/test/selftest.ts (B8)
function ok(cond: boolean, msg: string): void;
```
`datenQuelle.zeile` ist Q1/Q2/Q3 oder `''` (B11 `quellZeile`), `datenQuelle.zurueckKnopf` ist der K1-Text „Zurück zum eigenen Ordner (⟨Ordnername⟩)“ oder `null` (B11 `zurueckKnopf`). Beide Texte entstehen im Main; die Anzeige gibt sie nur aus.

Produces (`apps/titler/src/renderer/src/lib/datalink-anzeige.ts`, nur `import type`):
```ts
export function zaehlerText(activeEntry: number, anzahl: number): string;    // 'Einträge · 2/5' bzw. 'Einträge · 5'
export function navGesperrt(activeEntry: number, anzahl: number): { zurueck: boolean; weiter: boolean };
export function boardHinweis(h: TitlerStatus['hinweis']): string | null;    // Text nur bei H1, H5, H6
export function b1Text(g: TitlerStatus['gehalten']): string | null;         // 'Auf Sendung, nicht in der Liste: ⟨Label⟩'
```

**Vorab (gemessen an einer Kopie der App mit den ausgeschriebenen Fassungen aus B8–B11, `@jm/show` mit B3 und dem Code aus B12–B13; Selbsttest, `typecheck:node`, `typecheck:web` und `electron-vite build` grün):**
- `datalink-anzeige.ts` importiert `TitlerStatus` nur als Typ über `@shared/types`. tsx entfernt `import type` vollständig. Der Selbsttest lädt das Modul deshalb ohne Alias, React oder Renderer. `tsconfig.web.json` kennt `@shared/*`.
- Die Farbe der Hinweise ist das Token `--warning` aus `@jm/ui`, wie in `apps/launcher/src/renderer/src/components/VerbundTeile.tsx:11`. Der Titler lädt es über `@import "@jm/ui/base.css"` in `globals.css`.
- Der Zähler „Einträge · …“ steht in einem `uppercase`-Span; der Text im Code ist wörtlich „Einträge · 2/5“ bzw. „Einträge · 5“.
- Steht `datenQuelle.ohneOrdner`, zeigt „Daten / Recall“ wie bisher „Kein Datenordner aktiv …“ (Text unverändert, Spec 7.6). Quellzeile und Hinweis stehen darüber, ein H1 bei leerem eigenen Ordner bleibt also sichtbar.
- Das Board zeigt die Karte B1 zwischen Hinweis und Liste. Sie steht auch, wenn die Liste leer ist, denn ein gehaltener Eintrag kann gerade aus einer leer gelesenen Liste kommen.
- Der Abschnitt „iveo“ in den Einstellungen gilt als aktiv bei `datenQuelle.art === 'show'`. Die alte Regex auf `config.dataFolder` greift nicht mehr, denn die Show schreibt den Ordner seit B13 nicht mehr.

---

- [ ] **Step 1: Failing Test schreiben**

In `apps/titler/test/selftest.ts` den folgenden Block **direkt vor dem Abschluss** einfügen, also nach dem B13-Block und vor der Zeile `if (failed > 0) {` am Dateiende:

```ts
// ── B14 · Anzeige-Helfer für Daten / Recall und das Recall-Board (Spec 7.4, 7.8) ──
{
  const a = await import('../src/renderer/src/lib/datalink-anzeige');
  ok(a.zaehlerText(-1, 5) === 'Einträge · 5', 'B14: Zähler ohne aktiven (oder mit gehaltenem) Eintrag: Einträge · 5');
  ok(a.zaehlerText(1, 5) === 'Einträge · 2/5', 'B14: Zähler mit aktivem Eintrag: Einträge · 2/5');
  const frei = a.navGesperrt(-1, 5);
  ok(!frei.zurueck && !frei.weiter, 'B14: ohne aktiven Eintrag sind Weiter und Zurück frei (beide wählen Eintrag 1)');
  const anfang = a.navGesperrt(0, 5);
  ok(anfang.zurueck && !anfang.weiter, 'B14: Eintrag 1 aktiv → nur Zurück gesperrt');
  const ende = a.navGesperrt(4, 5);
  ok(!ende.zurueck && ende.weiter, 'B14: letzter Eintrag aktiv → nur Weiter gesperrt');
  const mitte = a.navGesperrt(2, 5);
  ok(!mitte.zurueck && !mitte.weiter, 'B14: Eintrag in der Mitte → beide frei');
  const h1 = '„Alan“ ist nicht mehr in der Liste. Die Bauchbinde bleibt stehen, bis du sie ausblendest oder einen Eintrag abrufst.';
  const h5 = 'Abruf „Niemand“: nicht in der Liste. Bitte einen Eintrag abrufen.';
  const h6 = 'Abruf „Niemand“: nicht in der Liste. Auf Sendung bleibt „Alan“, bis du sie ausblendest oder einen Eintrag abrufst.';
  ok(a.boardHinweis({ art: 'H1', text: h1 }) === h1, 'B14: Board zeigt H1');
  ok(a.boardHinweis({ art: 'H5', text: h5 }) === h5, 'B14: Board zeigt H5');
  ok(a.boardHinweis({ art: 'H6', text: h6 }) === h6, 'B14: Board zeigt H6');
  ok(a.boardHinweis({ art: 'H2', text: '„Alan“ ist nicht mehr in der Liste. Bitte einen Eintrag abrufen.' }) === null, 'B14: H2 nicht im Board');
  ok(a.boardHinweis({ art: 'H3', text: 'Liste aus früherem Stand: Die Show enthält gerade keine Speaker.' }) === null, 'B14: H3 nicht im Board');
  ok(a.boardHinweis({ art: 'H4', text: 'Liste aus früherem Stand: Show nicht lesbar (EBUSY).' }) === null, 'B14: H4 nicht im Board');
  ok(a.boardHinweis({ art: 'H7', text: 'Liste aus früherem Stand: Speakerliste von iveo nicht abrufbar (seit 09:58).' }) === null, 'B14: H7 nicht im Board');
  ok(a.boardHinweis(undefined) === null, 'B14: ohne Hinweis → null');
  ok(a.b1Text({ label: 'Alan' }) === 'Auf Sendung, nicht in der Liste: Alan', 'B14: Karte B1 wörtlich');
  ok(a.b1Text(undefined) === null, 'B14: ohne gehaltenen Eintrag keine Karte');
}
```

- [ ] **Step 2: Test laufen lassen, er muss scheitern**

```bash
npm run selftest -w @jm/titler
```
Erwartet: B8–B13 laufen durch, einschließlich der etwa 1 s langen Uhr aus B13. Dann bricht der Lauf ohne eine `B14:`-Zeile ab, Exit-Code 1:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\titler\src\renderer\src\lib\datalink-anzeige' imported from …\apps\titler\test\selftest.ts
```

- [ ] **Step 3: Minimale Implementierung**

Neue Datei `apps/titler/src/renderer/src/lib/datalink-anzeige.ts`, ganzer Inhalt:

```ts
// Reine Anzeige-Helfer für „Daten / Recall“ und das Recall-Board (Master-Link Teil 2b,
// Spec 7.4 und 7.8). Nur `import type`: der Titler-Selbsttest (tsx) lädt das Modul ohne
// Renderer, React oder Alias-Auflösung.
import type { TitlerStatus } from '@shared/types';

/**
 * Zähler über der Liste: „Einträge · 2/5“ mit aktivem Eintrag, sonst „Einträge · 5“ — auch
 * bei einem gehaltenen Eintrag, der nicht als Stelle erscheint (Spec 7.8).
 */
export function zaehlerText(activeEntry: number, anzahl: number): string {
  return activeEntry >= 0 && activeEntry < anzahl ? `Einträge · ${activeEntry + 1}/${anzahl}` : `Einträge · ${anzahl}`;
}

/**
 * Sperre für Zurück/Weiter: nur an den Rändern. Ohne aktiven Eintrag (auch bei einem
 * gehaltenen) sind beide frei, denn beide wählen dann Eintrag 1 (Spec 7.4).
 */
export function navGesperrt(activeEntry: number, anzahl: number): { zurueck: boolean; weiter: boolean } {
  if (anzahl <= 0) return { zurueck: true, weiter: true };
  if (activeEntry < 0) return { zurueck: false, weiter: false };
  return { zurueck: activeEntry <= 0, weiter: activeEntry >= anzahl - 1 };
}

/** Hinweis oben im Board: nur H1, H5 und H6 (Spec 7.8), sonst `null`. */
export function boardHinweis(h: TitlerStatus['hinweis']): string | null {
  if (!h) return null;
  return h.art === 'H1' || h.art === 'H5' || h.art === 'H6' ? h.text : null;
}

/** Karte B1 über den Einträgen im Board, nur bei einem gehaltenen Eintrag (Spec 7.8). */
export function b1Text(g: TitlerStatus['gehalten']): string | null {
  return g ? `Auf Sendung, nicht in der Liste: ${g.label}` : null;
}
```

- [ ] **Step 4: Test laufen lassen, er muss bestehen**

```bash
npm run selftest -w @jm/titler
```
Erwartet: B8–B13 wie bisher, dazu 16 `ok`-Zeilen mit `B14:`, zusammen 321, von „B14: Zähler ohne aktiven (oder mit gehaltenem) Eintrag: Einträge · 5“ bis „B14: ohne gehaltenen Eintrag keine Karte“. Keine `FAIL`-Zeile, `ALLE TESTS OK`, Exit-Code 0.

- [ ] **Step 5: `OperatorView.tsx` — Import, Konstanten, `iveoActive`, Sperre**

Import (`:13`), Vorher:
```tsx
import { activeGraphic } from '@/lib/graphic';
```
Nachher:
```tsx
import { activeGraphic } from '@/lib/graphic';
import { navGesperrt, zaehlerText } from '@/lib/datalink-anzeige';
```

Konstanten (`:52-53`), Vorher:
```tsx
  const entries = state?.status.entries ?? [];
  const activeEntry = state?.status.activeEntry ?? -1;
```
Nachher:
```tsx
  const entries = state?.status.entries ?? [];
  const activeEntry = state?.status.activeEntry ?? -1;
  // Master-Link Teil 2b (Spec 7.8): stehender Hinweis H1–H7 und Datenquelle (Q1–Q3, K1).
  const hinweis = state?.status.hinweis;
  const datenQuelle = state?.status.datenQuelle;
```

`iveoActive` (`:235-239`), Vorher:
```tsx
  // iveo speist Speaker automatisch als verwalteten DataLink-Ordner ein (speakers.tsv,
  // #11) — der Titler hält kein Token/Backend. Hier nur ableiten, ob dieser Ordner
  // gerade aktiv ist (beitragende Datei bzw. verwalteter Ordnername).
  const iveoActive =
    dataSources.includes('speakers.tsv') || /[\\/]iveo-data[\\/]?$/.test(c.dataFolder);
```
Nachher:
```tsx
  // iveo speist Speaker über die Datenquelle „Show“ ein (speakers.tsv in userData/iveo-data,
  // #11, Spec 7.7) — der Titler hält kein Token/Backend. `config.dataFolder` ist nur noch
  // der eigene Ordner des Bedieners und sagt darüber nichts mehr.
  const iveoActive = datenQuelle?.art === 'show';
  // Weiter/Zurück: gesperrt nur an den Rändern; ohne aktiven Eintrag beide frei (Spec 7.4).
  const nav = navGesperrt(activeEntry, entries.length);
```
`dataSources` bleibt in Gebrauch (Zeile „Quelle: …“ unter den Variablen).

- [ ] **Step 6: `OperatorView.tsx` — „Daten / Recall“** (`:446-540`, vier Stellen)

Bedingung (`:448-449`), Vorher:
```tsx
                <Collapsible title="Daten / Recall" persistId="titler.recall" defaultOpen>
                  {!c.dataFolder ? (
```
Nachher:
```tsx
                <Collapsible title="Daten / Recall" persistId="titler.recall" defaultOpen>
                  {/* Quelle über der Liste (Q1–Q3) und stehender Hinweis (H1–H7), Spec 7.8 */}
                  {datenQuelle?.zeile ? (
                    <p className="truncate text-[11px] text-[var(--muted-foreground)]" title={datenQuelle.zeile}>
                      {datenQuelle.zeile}
                    </p>
                  ) : null}
                  {hinweis ? (
                    <p
                      role="status"
                      className="rounded-[var(--radius)] border border-[var(--warning)]/50 bg-[var(--warning)]/15 px-3 py-2 text-[11px] text-[var(--foreground)]"
                    >
                      {hinweis.text}
                    </p>
                  ) : null}
                  {datenQuelle?.ohneOrdner ? (
```
Der Absatz „Kein Datenordner aktiv. Im Reiter **Einstellungen › DataLink** …“ darunter bleibt wortgleich.

Zähler (`:463`), Vorher:
```tsx
                              Einträge {activeEntry >= 0 ? `· ${activeEntry + 1}/${entries.length}` : `· ${entries.length}`}
```
Nachher:
```tsx
                              {zaehlerText(activeEntry, entries.length)}
```

Zurück (`:479`), Vorher:
```tsx
                                disabled={activeEntry <= 0}
```
Nachher:
```tsx
                                disabled={nav.zurueck}
```

Weiter (`:489`), Vorher:
```tsx
                                disabled={activeEntry >= entries.length - 1}
```
Nachher:
```tsx
                                disabled={nav.weiter}
```
Die Liste selbst ist seit B13 umgestellt (`key={e.key}`, Klick → `recallSchluessel(e.key)`). Markiert ist nur `i === activeEntry`; ein gehaltener Eintrag hat `activeEntry === -1` und erscheint deshalb nicht markiert.

- [ ] **Step 7: `OperatorView.tsx` — Knopf K1 unter Einstellungen › DataLink** (`:614-619`)

Vorher:
```tsx
                  {dataError ? (
                    <p className="text-[11px] text-[var(--destructive)]">DataLink: {dataError}</p>
                  ) : null}
                </SettingsSection>

                {/* iveo (#11): Status der automatischen Speaker-Übernahme aus der JM Show. */}
```
Nachher:
```tsx
                  {/* K1 (Spec 7.7/7.8): nur bei Quelle Show und einem eigenen Ordner, der nicht iveo-data ist */}
                  {datenQuelle?.zurueckKnopf ? (
                    <Button
                      variant="outline"
                      size="sm"
                      uppercase={false}
                      className="w-full"
                      onClick={() => void window.jmtitler.zurueckZumEigenenOrdner()}
                    >
                      {datenQuelle.zurueckKnopf}
                    </Button>
                  ) : null}
                  {dataError ? (
                    <p className="text-[11px] text-[var(--destructive)]">DataLink: {dataError}</p>
                  ) : null}
                </SettingsSection>

                {/* iveo (#11): Status der automatischen Speaker-Übernahme aus der JM Show. */}
```
Der Abschnitt „iveo“ (`:620-641`) bleibt wortgleich; er nutzt `iveoActive` aus Step 5 und damit die Datenquelle.

- [ ] **Step 8: `RecallBoard.tsx` ganz ersetzen**

Datei `apps/titler/src/renderer/src/views/RecallBoard.tsx`, ganzer neuer Inhalt (enthält die Umstellung aus B13 unverändert):

```tsx
import { useMemo, useState } from 'react';
import { cn, Logo } from '@jm/ui';
import { useTitler } from '@/store/titler';
import { b1Text, boardHinweis } from '@/lib/datalink-anzeige';

/**
 * Recall-Button-Board (#152): ein Raster aus Buttons, je einer pro DataLink-
 * Eintrag (z. B. Personenname). Klick ruft den Eintrag über seinen Schlüssel ab
 * → dessen Variablen füllen die Bauchbinde. Für einen zweiten Bildschirm/Touch
 * gedacht; live-aktualisiert (teilt sich den Zustand mit dem Operator-Fenster).
 * Master-Link Teil 2b (Spec 7.8): oben der Hinweis H1/H5/H6, über den Einträgen
 * die Karte B1 für einen gehaltenen Eintrag.
 */
export function RecallBoard(): React.JSX.Element {
  const state = useTitler((s) => s.state);
  const entries = state?.status.entries ?? [];
  const activeEntry = state?.status.activeEntry ?? -1;
  const hinweis = boardHinweis(state?.status.hinweis);
  const karte = b1Text(state?.status.gehalten);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return entries
      .map((e, i) => ({ key: e.key, label: e.label, i }))
      .filter((e) => !t || e.label.toLowerCase().includes(t));
  }, [entries, q]);

  return (
    <div className="h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="h-14 shrink-0 flex items-center gap-3 px-5 border-b border-[var(--border)]/60">
        <Logo size={22} />
        <span className="text-sm font-extrabold tracking-[0.06em]">RECALL-BOARD</span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          {entries.length} Einträge
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Suchen…"
          spellCheck={false}
          className="ml-auto h-9 w-56 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
        />
      </header>

      {hinweis ? (
        <div
          role="status"
          className="shrink-0 border-b border-[var(--warning)]/50 bg-[var(--warning)]/15 px-5 py-2.5 text-sm font-semibold"
        >
          {hinweis}
        </div>
      ) : null}

      {karte ? (
        <div className="shrink-0 px-4 pt-4">
          <div className="min-h-16 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--warning)] px-3 py-2 flex items-center justify-center text-center text-sm font-bold">
            {karte}
          </div>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <div className="flex-1 grid place-items-center px-6 text-center text-sm text-[var(--muted-foreground)]">
          Keine Einträge. Wähle im Operator-Fenster einen DataLink-Ordner (oder öffne eine iveo-Show mit Speakern).
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto p-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
            {filtered.map(({ key, label, i }) => (
              <button
                key={key}
                onClick={() => void window.jmtitler.recallSchluessel(key)}
                title={label}
                className={cn(
                  'h-16 rounded-[var(--radius-lg)] border px-3 text-sm font-bold leading-tight',
                  'flex items-center justify-center text-center break-words',
                  i === activeEntry
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent ring-2 ring-[var(--primary)]'
                    : 'border-[var(--border)] hover:bg-[var(--highlight)]',
                )}
              >
                <span className="line-clamp-2">{label || '—'}</span>
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
              Kein Eintrag passt zu „{q}".
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Typecheck, Selbsttest, Build**

```bash
npm run typecheck -w @jm/titler
npm run selftest -w @jm/titler
npm run build -w @jm/titler
grep -o "Auf Sendung, nicht in der Liste" apps/titler/out/renderer/assets/*.js | wc -l
grep -o "zurueckZumEigenenOrdner" apps/titler/out/renderer/assets/*.js | wc -l
```
Erwartet:
- `typecheck`: `tsc` (node und web) ohne Ausgabe, Exit-Code 0.
- `selftest`: B8–B14 `ok`, `ALLE TESTS OK`, Exit-Code 0.
- `build`: drei Bündel mit `✓ built in …`, Exit-Code 0.
- Die erste Zählung ergibt `1` (Text B1 aus `datalink-anzeige.ts` im Renderer-Bündel). Die zweite ergibt mindestens `1` (Knopf K1 ruft die Preload-Funktion).

Sichtbar prüfen kann man die Anzeige erst im Durchgang (B17) und in der Owner-Abnahme (B18, Schritte 2, 4, 5, 9, 10, 11b).

- [ ] **Step 10: Commit** (Git Bash; Commit-Text bewusst ohne Umlaute)

```bash
git add apps/titler/src/renderer/src/lib/datalink-anzeige.ts apps/titler/src/renderer/src/views/OperatorView.tsx apps/titler/src/renderer/src/views/RecallBoard.tsx apps/titler/test/selftest.ts
git status --short
```
Erwartet genau:
```
A  apps/titler/src/renderer/src/lib/datalink-anzeige.ts
M  apps/titler/src/renderer/src/views/OperatorView.tsx
M  apps/titler/src/renderer/src/views/RecallBoard.tsx
M  apps/titler/test/selftest.ts
```
Dann:
```bash
git commit -m "feat(titler): Quelle, Hinweise H1-H7, Zurueck zum eigenen Ordner und Board-Karte (Teil 2b)" -m "Daten / Recall zeigt die Quellzeile (Q1-Q3) und den stehenden Hinweis; Kein Datenordner aktiv haengt an der Datenquelle statt an config.dataFolder. Zaehler ohne Stelle bei gehaltenem Eintrag, Weiter/Zurueck nur an den Raendern gesperrt (ohne aktiven Eintrag beide frei). Einstellungen > DataLink: Knopf K1. Recall-Board: Hinweis H1/H5/H6 oben, Karte B1 bei gehaltenem Eintrag. Reine Helfer in datalink-anzeige.ts mit Selbsttest." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: B15 · Rundown rein: `speakerId`, `aktionAendern`, `loeseSpeakerZiel`, `titlerKannKennung`, Chip, Picker-Optionen

**Spec:** 8.1 (Feld, `aktionAendern`), 8.2 (Picker-Optionen), 8.3 (Tabelle „Senden“), 8.4 (Chip), 9.4 Nr. 1–5; Review Focus 3 aus dem Plan-Kopf; G8.

Worum es geht, in den Worten der Spec:
- 8.1: „`RundownAction` bekommt `speakerId?: string`. `normAction` übernimmt es als String mit 1 bis 200 Zeichen.“ – „`args[0]` behält den **Namen**. Er dient der Anzeige und als Rückfall.“ – „`schemaVersion` bleibt 2.“
- 8.1: `aktionAendern` entfernt `speakerId`, wenn „sich Rolle oder Verb ändern“, „im Picker „— Speaker wählen —“ gewählt wird“ oder „`args[0]` sich ändert, ohne dass der Patch eine neue `speakerId` mitbringt“.
- 8.2: Optionen „⟨Name⟩ — ⟨Funktion⟩“ bzw. „⟨Name⟩“, Wert die Kennung, ohne Kennung der Name. Alte Aktion ohne `speakerId`: „⟨Name⟩ · per Name (nicht gebunden)“, „gebunden wird erst durch eine Auswahl, nie stillschweigend“. `speakerId` nicht in der Liste: „⟨args[0]⟩ · nicht in der Speaker-Liste“.
- 8.3 (Tabelle): nicht `titler recall` → `args` unverändert; kein `speakerId` → `args` unverändert; `speakerId` und `recall_kennung=1` → `TITLER RECALL @⟨speakerId⟩ ⟨Name⟩`; `speakerId` mit Leerraum → wie ohne Fähigkeit; ohne Fähigkeit → `TITLER RECALL ⟨aktueller Name zu speakerId⟩`, ohne Treffer `⟨args[0]⟩`.
- 8.4: „Fehlt die Kennung in der Liste: „JM Titler · DataLink-Eintrag abrufen (⟨args[0]⟩, nicht in der Speaker-Liste)““.
- Review Focus 3: verbundener Titler noch ohne STATE, getrennter Titler oder STATE eines Titlers 0.9.0 ohne `recall_kennung` → `titlerKannKennung` ist `false`, gesendet wird die Namensform.

**Arbeitsverzeichnis:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b`, Branch `feat/master-link-teil2b`. Alle Pfade relativ dazu. Voraussetzung: B3 ist committet (`ShowIveoSpeaker.id`).

**Dateien:**
- Modify: `apps/rundown/src/shared/types.ts:26-32` (neues Feld direkt nach `zielId`)
- Modify: `apps/rundown/src/shared/doc-format.ts:34-37` (`normAction`, nach der `zielId`-Zeile)
- Modify: `apps/rundown/src/shared/zeilen.ts:4-5` (Kopf-Import), `:47-50` (neue Funktionen direkt nach `sprungZielTitel`)
- Test: `apps/rundown/test/selftest.ts:33-35` (Importe hinter `import * as abgleichModul …`) und neuer Block direkt vor der Abschlusszeile `console.log(failed === 0 ? …` (heute `:1696`)

**Interfaces:**
- Consumes: `ShowIveoSpeaker.id` aus B3 (`packages/show/src/index.ts`: `export interface ShowIveoSpeaker { id?: string; name: string; title?: string }`). Bestehend: `normAction(raw: unknown, neueId: NeueId): RundownAction` und `migrate(raw: unknown, neueId: NeueId): RundownDoc` (`apps/rundown/src/shared/doc-format.ts`), `buildActionLine(role: string, verb: string, args?: (string | number)[]): string` (`apps/rundown/src/shared/conductor.ts`, im Selbsttest schon importiert, Zeile 3), Typ `RundownAction` (im Selbsttest schon importiert, Zeile 9).
- Produces (exakt so, B16 nutzt die Namen):
```ts
// apps/rundown/src/shared/types.ts
export interface RundownAction { id: string; role: string; verb: string; args: (string | number)[]; enabled: boolean; delayMs?: number; zielId?: string; speakerId?: string }

// apps/rundown/src/shared/zeilen.ts
export function istSpeakerAbruf(a: RundownAction): boolean;   // role 'titler' && verb 'recall'
export function aktionAendern(aktion: RundownAction, patch: Partial<RundownAction>): RundownAction;
export function loeseSpeakerZiel(aktion: RundownAction, speakers: ShowIveoSpeaker[], titlerKannKennung: boolean): (string | number)[];
export function titlerKannKennung(links: Array<{ role: string; connected: boolean; state: Record<string, string> | null }>): boolean;
export const SPEAKER_NICHT_IN_LISTE = 'nicht in der Speaker-Liste';
export function speakerChipArgs(aktion: RundownAction, speakers: ShowIveoSpeaker[]): (string | number)[];
export interface SpeakerOption { wert: string; text: string }
export function speakerOptionen(aktion: RundownAction, speakers: ShowIveoSpeaker[]): { optionen: SpeakerOption[]; gewaehlt: string };
export function speakerPatch(wert: string, speakers: ShowIveoSpeaker[]): Partial<RundownAction> | null;
// ''       → { args: [''], speakerId: undefined }
// 'id:x'   → { speakerId: 'x', args: [Name] }   (Kennung nicht in der Liste → null)
// 'name:n' → { args: ['n'], speakerId: undefined }
// 'alt:' / 'fehlt:' / Unbekanntes → null
```

Regeln für diese Aufgabe:
- G8: `zeilen.ts`, `types.ts` und `doc-format.ts` bekommen keine `electron`-, `node:`- oder Paket-Laufzeitimporte. Aus `@jm/show` kommt nur `import type { ShowIveoSpeaker } from '@jm/show'`. Der Selbsttest läuft mit `node --experimental-strip-types` und importiert mit `../src/shared/<datei>.ts`.
- G15: Die Dateien liegen mit CRLF vor. Alle Änderungen mit dem Edit-Werkzeug (Vorher-Text exakt ersetzen). Trifft ein Vorher-Text nicht, zuerst die Zeilenenden prüfen.
- Alle Befehle im Worktree-Wurzelverzeichnis `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b`.

- [ ] **Step 1: Importe in den Selbsttest einfügen**

Datei `apps/rundown/test/selftest.ts`. Vorher (eindeutig, Zeilen 33–35):
```ts
import * as abgleichModul from '../src/shared/abgleich.ts';

let failed = 0;
```
Nachher:
```ts
import * as abgleichModul from '../src/shared/abgleich.ts';
import {
  aktionAendern,
  istSpeakerAbruf,
  loeseSpeakerZiel,
  SPEAKER_NICHT_IN_LISTE,
  speakerChipArgs,
  speakerOptionen,
  speakerPatch,
  titlerKannKennung,
} from '../src/shared/zeilen.ts';
import { normAction } from '../src/shared/doc-format.ts';
import type { ShowIveoSpeaker } from '@jm/show';

let failed = 0;
```
Die Funktionen kommen als benannte Importe: Fehlt eine, bricht der ganze Selbsttest sofort ab (rot in Step 3). `normAction` wird neben dem vorhandenen `import { migrate } …` (Zeile 11) ein zweites Mal aus `doc-format.ts` importiert; das ist in ESM erlaubt.

- [ ] **Step 2: Fehlschlagende Tests einfügen (9.4 Nr. 1–5, Picker, Review Focus 3)**

Datei `apps/rundown/test/selftest.ts`. Vorher (eindeutig, Abschlusszeile, heute `:1696`):
```ts
console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```
Nachher:
```ts
// ── Teil 2b · Speaker-Aktion über die Kennung (Spec 8.1–8.4, 9.4 Nr. 1–5, Review Focus 3) ──
{
  const neueIdB15 = (p: 'r' | 'a'): string => `${p}-b15`;
  const abruf = (extra: Partial<RundownAction> = {}): RundownAction => ({
    id: 'a-b15',
    role: 'titler',
    verb: 'recall',
    args: ['Alan'],
    enabled: true,
    ...extra,
  });
  const SP: ShowIveoSpeaker[] = [
    { id: 's-1', name: 'Ada', title: 'Moderation' },
    { id: 's-3', name: 'Alan', title: 'Panel' },
    { id: 'id mit leer', name: 'Grace', title: 'Keynote' },
    { name: 'Hedy' },
  ];

  // Nr. 1: normAction übernimmt speakerId nur als String mit 1 bis 200 Zeichen (8.1).
  const roh = (speakerId: unknown): unknown => ({ id: 'a1', role: 'titler', verb: 'recall', args: ['Alan'], enabled: true, speakerId });
  eq(
    normAction(roh('s-3'), neueIdB15),
    { id: 'a1', role: 'titler', verb: 'recall', args: ['Alan'], enabled: true, speakerId: 's-3' },
    'Nr. 1: normAction behält speakerId, args[0] behält den Namen',
  );
  eq('speakerId' in normAction(roh(''), neueIdB15), false, "Nr. 1: speakerId '' entfällt");
  eq('speakerId' in normAction(roh('x'.repeat(201)), neueIdB15), false, 'Nr. 1: speakerId mit 201 Zeichen entfällt');
  eq('speakerId' in normAction(roh(42), neueIdB15), false, 'Nr. 1: speakerId 42 (keine Zeichenkette) entfällt');
  eq(normAction(roh('x'.repeat(200)), neueIdB15).speakerId?.length, 200, 'Nr. 1: speakerId mit 200 Zeichen bleibt');
  const docB15 = migrate(
    JSON.parse(JSON.stringify({ schemaVersion: 2, name: 'B15', rows: [{ id: 'r1', label: 'Z', actions: [abruf({ speakerId: 's-3' })] }] })),
    neueIdB15,
  );
  eq(docB15.rows[0].actions[0].speakerId, 's-3', 'Nr. 1: migrate (setDoc, Autosave, Gedächtnis) behält speakerId');
  eq(docB15.schemaVersion, 2, 'Nr. 1: schemaVersion bleibt 2');

  // istSpeakerAbruf: nur titler recall.
  eq(
    [istSpeakerAbruf(abruf()), istSpeakerAbruf(abruf({ verb: 'take', args: [] })), istSpeakerAbruf(abruf({ role: 'timer', verb: 'goto', args: [2] }))],
    [true, false, false],
    'istSpeakerAbruf: nur titler recall',
  );

  // Nr. 2: loeseSpeakerZiel, jede Zeile der Tabelle 8.3.
  eq(loeseSpeakerZiel(abruf({ role: 'timer', verb: 'goto', args: [2], speakerId: 's-3' }), SP, true), [2], 'Nr. 2: timer goto mit übrig gebliebener speakerId → args unverändert');
  eq(loeseSpeakerZiel(abruf({ verb: 'take', args: [], speakerId: 's-3' }), SP, true), [], 'Nr. 2: titler take mit speakerId → args unverändert');
  eq(loeseSpeakerZiel(abruf(), SP, true), ['Alan'], 'Nr. 2: ohne speakerId, Titler versteht Kennungen → args unverändert');
  eq(loeseSpeakerZiel(abruf(), SP, false), ['Alan'], 'Nr. 2: ohne speakerId, Titler alt → args unverändert');
  eq(loeseSpeakerZiel(abruf({ speakerId: 's-3' }), SP, true), ['@s-3', 'Alan'], 'Nr. 2: speakerId, recall_kennung=1 → @-Form mit Namen');
  eq(loeseSpeakerZiel(abruf({ speakerId: 's-7' }), SP, true), ['@s-7', 'Alan'], 'Nr. 2: speakerId nicht in der Liste, recall_kennung=1 → @-Form mit args[0]');
  eq(loeseSpeakerZiel(abruf({ speakerId: 's-7', args: [''] }), SP, true), ['@s-7'], 'Nr. 2: @-Form ohne Namen, wenn keiner bekannt ist');
  eq(loeseSpeakerZiel(abruf({ speakerId: 'id mit leer', args: ['Grace alt'] }), SP, true), ['Grace'], 'Nr. 2: speakerId mit Leerraum → aktueller Name statt @-Form');
  eq(loeseSpeakerZiel(abruf({ speakerId: 's-3' }), SP, false), ['Alan'], 'Nr. 2: speakerId, Titler meldet es nicht → aktueller Name');
  eq(loeseSpeakerZiel(abruf({ speakerId: 's-7', args: ['Alan'] }), SP, false), ['Alan'], 'Nr. 2: speakerId nicht in der Liste, Titler alt → args[0]');
  eq(loeseSpeakerZiel(abruf({ speakerId: 's-1', args: ['Ada', 'x'] }), SP, false), ['Ada', 'x'], 'Nr. 2: Namensform behält weitere Argumente');
  eq(buildActionLine('titler', 'recall', loeseSpeakerZiel(abruf({ speakerId: 's-3' }), SP, true)), 'TITLER RECALL @s-3 Alan', 'Nr. 2: gesendete Zeile in der @-Form');

  // Nr. 3: Umbenennung in iveo — gesendet wird der NEUE Name.
  const umbenannt: ShowIveoSpeaker[] = SP.map((s) => (s.id === 's-3' ? { ...s, name: 'Alan Turing' } : s));
  eq(loeseSpeakerZiel(abruf({ speakerId: 's-3' }), umbenannt, true), ['@s-3', 'Alan Turing'], 'Nr. 3: Umbenennung, mit Fähigkeit → @s-3 und der neue Name');
  eq(loeseSpeakerZiel(abruf({ speakerId: 's-3' }), umbenannt, false), ['Alan Turing'], 'Nr. 3: Umbenennung, ohne Fähigkeit → nur der neue Name');
  eq(buildActionLine('titler', 'recall', loeseSpeakerZiel(abruf({ speakerId: 's-3' }), umbenannt, false)), 'TITLER RECALL Alan Turing', 'Nr. 3: gesendete Zeile ohne Fähigkeit');

  // Nr. 4: Chip-Text (8.4).
  eq(speakerChipArgs(abruf({ speakerId: 's-3' }), umbenannt), ['Alan Turing'], 'Nr. 4: Chip mit bekannter Kennung → aktueller Name');
  eq(speakerChipArgs(abruf({ speakerId: 's-7' }), SP), ['Alan, nicht in der Speaker-Liste'], 'Nr. 4: Chip mit unbekannter Kennung');
  eq(SPEAKER_NICHT_IN_LISTE, 'nicht in der Speaker-Liste', 'Nr. 4: Zusatz wörtlich aus 8.4');
  eq(
    `JM Titler · DataLink-Eintrag abrufen (${speakerChipArgs(abruf({ speakerId: 's-7' }), SP).join(' ')})`,
    'JM Titler · DataLink-Eintrag abrufen (Alan, nicht in der Speaker-Liste)',
    'Nr. 4: Etikett wie actionLabel es zusammensetzt',
  );
  eq(speakerChipArgs(abruf(), SP), ['Alan'], 'Nr. 4: Chip ohne speakerId → args unverändert');
  eq(speakerChipArgs(abruf({ role: 'timer', verb: 'goto', args: [2], speakerId: 's-3' }), SP), [2], 'Nr. 4: Chip einer anderen Aktion → args unverändert');

  // Nr. 5: aktionAendern entfernt speakerId (8.1).
  const gebunden = abruf({ speakerId: 's-3' });
  const r1 = aktionAendern(gebunden, { role: 'timer', verb: 'start', args: [], zielId: undefined });
  eq(['speakerId' in r1, r1.role, r1.verb], [false, 'timer', 'start'], 'Nr. 5: Rollenwechsel entfernt speakerId');
  const r2 = aktionAendern(gebunden, { verb: 'take', args: [], zielId: undefined });
  eq(['speakerId' in r2, r2.verb], [false, 'take'], 'Nr. 5: Verbwechsel entfernt speakerId');
  const leerPatch = speakerPatch('', SP);
  const r3 = leerPatch ? aktionAendern(gebunden, leerPatch) : gebunden;
  eq(['speakerId' in r3, r3.args], [false, ['']], 'Nr. 5: „— Speaker wählen —“ entfernt speakerId');
  const r4 = aktionAendern(gebunden, { args: ['Grace'] });
  eq(['speakerId' in r4, r4.args], [false, ['Grace']], 'Nr. 5: Hand-Änderung an args[0] entfernt speakerId');
  eq(aktionAendern(gebunden, { args: ['Alan'] }).speakerId, 's-3', 'Nr. 5: gleiches args[0] (Feld verlassen ohne Änderung) behält speakerId');
  eq(aktionAendern(gebunden, { enabled: false }).speakerId, 's-3', 'Nr. 5: andere Felder (aktiviert) behalten speakerId');
  eq(aktionAendern(gebunden, { delayMs: 500 }).speakerId, 's-3', 'Nr. 5: Verzögerung behält speakerId');
  eq(aktionAendern(gebunden, { role: 'titler' }).speakerId, 's-3', 'Nr. 5: dieselbe Rolle noch einmal gesetzt behält speakerId');
  eq('speakerId' in aktionAendern(gebunden, { speakerId: undefined }), false, 'Nr. 5: speakerId undefined im Patch → kein Schlüssel speakerId im Ergebnis');
  const wahl = speakerPatch('id:s-1', SP);
  eq(wahl ? aktionAendern(abruf(), wahl) : null, abruf({ args: ['Ada'], speakerId: 's-1' }), 'Nr. 5: Picker-Auswahl setzt speakerId und den Namen in args[0]');
  const umwahl = speakerPatch('id:s-1', SP);
  eq(umwahl ? aktionAendern(gebunden, umwahl) : null, abruf({ args: ['Ada'], speakerId: 's-1' }), 'Nr. 5: Picker-Auswahl ersetzt eine vorhandene speakerId');
  const ohneId = speakerPatch('name:Hedy', SP);
  const r5 = ohneId ? aktionAendern(gebunden, ohneId) : gebunden;
  eq(['speakerId' in r5, r5.args], [false, ['Hedy']], 'Nr. 5: Auswahl eines Speakers ohne Kennung → Name, keine speakerId');

  // speakerPatch: alle Werte.
  eq(speakerPatch('', SP), { args: [''] }, "speakerPatch '' → args [''] …");
  eq('speakerId' in (speakerPatch('', SP) ?? {}), true, "speakerPatch '' → … mit speakerId: undefined (entfernt die Kennung)");
  eq(speakerPatch('id:s-3', SP), { speakerId: 's-3', args: ['Alan'] }, 'speakerPatch id:s-3 → Kennung und Name');
  eq(speakerPatch('id:id mit leer', SP), { speakerId: 'id mit leer', args: ['Grace'] }, 'speakerPatch: Kennung mit Leerraum bleibt ganz');
  eq(speakerPatch('id:s-7', SP), null, 'speakerPatch: Kennung nicht (mehr) in der Liste → null');
  eq(speakerPatch('name:Hedy', SP), { args: ['Hedy'] }, 'speakerPatch name:Hedy → nur der Name');
  eq([speakerPatch('alt:', SP), speakerPatch('fehlt:', SP), speakerPatch('quatsch', SP)], [null, null, null], 'speakerPatch alt: / fehlt: / Unbekanntes → null');

  // speakerOptionen (8.2).
  const grund = [
    { wert: '', text: '— Speaker wählen —' },
    { wert: 'id:s-1', text: 'Ada — Moderation' },
    { wert: 'id:s-3', text: 'Alan — Panel' },
    { wert: 'id:id mit leer', text: 'Grace — Keynote' },
    { wert: 'name:Hedy', text: 'Hedy' },
  ];
  eq(speakerOptionen(abruf({ args: [''] }), SP), { optionen: grund, gewaehlt: '' }, 'speakerOptionen: neue Aktion → „— Speaker wählen —“, Speaker mit und ohne Kennung');
  eq(speakerOptionen(abruf({ speakerId: 's-3' }), SP), { optionen: grund, gewaehlt: 'id:s-3' }, 'speakerOptionen: gebundene Aktion → ihr Speaker ausgewählt');
  eq(
    speakerOptionen(abruf({ args: ['Alan'] }), SP),
    { optionen: [...grund, { wert: 'alt:', text: 'Alan · per Name (nicht gebunden)' }], gewaehlt: 'alt:' },
    'speakerOptionen: alte Aktion ohne speakerId → „per Name (nicht gebunden)“ ausgewählt, nie stillschweigend gebunden',
  );
  eq(
    speakerOptionen(abruf({ speakerId: 's-7', args: ['Grace'] }), SP),
    { optionen: [...grund, { wert: 'fehlt:', text: 'Grace · nicht in der Speaker-Liste' }], gewaehlt: 'fehlt:' },
    'speakerOptionen: speakerId nicht in der Liste → „nicht in der Speaker-Liste“ ausgewählt',
  );
  eq(speakerOptionen(abruf({ args: ['Hedy'] }), SP), { optionen: grund, gewaehlt: 'name:Hedy' }, 'speakerOptionen: Name eines Speakers ohne Kennung → er selbst ausgewählt');

  // Review Focus 3: titlerKannKennung nur bei verbundenem Titler mit recall_kennung=1.
  eq(titlerKannKennung([]), false, 'Review Focus 3: kein Titler-Link → false');
  eq(titlerKannKennung([{ role: 'titler', connected: true, state: null }]), false, 'Review Focus 3: verbunden, noch ohne STATE → false');
  eq(titlerKannKennung([{ role: 'titler', connected: false, state: { recall_kennung: '1' } }]), false, 'Review Focus 3: getrennt (mit altem STATE) → false');
  eq(titlerKannKennung([{ role: 'titler', connected: true, state: { on_air: '0', entry: 'Alan', entry_index: '3', entry_count: '4' } }]), false, 'Review Focus 3: STATE eines Titlers 0.9.0 ohne recall_kennung → false');
  eq(titlerKannKennung([{ role: 'titler', connected: true, state: { recall_kennung: '0' } }]), false, 'Review Focus 3: recall_kennung=0 → false');
  eq(titlerKannKennung([{ role: 'timer', connected: true, state: { recall_kennung: '1' } }]), false, 'Review Focus 3: andere Rolle → false');
  eq(titlerKannKennung([{ role: 'titler', connected: true, state: { recall_kennung: '1' } }]), true, 'Review Focus 3: verbunden und recall_kennung=1 → true');
  eq(
    buildActionLine('titler', 'recall', loeseSpeakerZiel(gebunden, SP, titlerKannKennung([{ role: 'titler', connected: true, state: null }]))),
    'TITLER RECALL Alan',
    'Review Focus 3: ein Titler ohne bekannte Fähigkeit bekommt die @-Form nie',
  );
}

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```
Was die Fälle festhalten:
- Nr. 1: `normAction` behält `speakerId` mit 1 bis 200 Zeichen, verwirft `''`, 201 Zeichen und die Zahl `42`; `migrate` (der Weg von `setDoc`, Autosave und Gedächtnis) behält sie, `schemaVersion` bleibt 2.
- Nr. 2: jede Zeile der Tabelle 8.3, dazu `timer goto` mit übrig gebliebener `speakerId`.
- Nr. 3: Umbenennung `s-3` „Alan“ → „Alan Turing“: mit Fähigkeit `['@s-3','Alan Turing']`, ohne `['Alan Turing']`.
- Nr. 4: Chip mit bekannter und unbekannter Kennung, dazu das Etikett, wie `actionLabel` (`apps/rundown/src/renderer/src/lib/capabilities.ts:21-24`) es aus Rolle, Verb und `args.join(' ')` zusammensetzt.
- Nr. 5: Rollen- und Verbwechsel, „— Speaker wählen —“ und Hand-Änderung an `args[0]` entfernen `speakerId` (`!('speakerId' in r)`); eine Picker-Auswahl setzt sie. Unveränderte `args[0]`, `enabled`, `delayMs` und dieselbe Rolle behalten sie.
- `speakerOptionen` für neue Aktion, gebundene Aktion, alte Aktion ohne Kennung, fehlende Kennung und einen Speaker ohne Kennung; `speakerPatch` für alle Werte.
- Review Focus 3: `titlerKannKennung` ist nur bei `connected: true` und `state.recall_kennung === '1'` wahr.

- [ ] **Step 3: Selbsttest laufen lassen (rot)**

Run: `npm run selftest -w @jm/rundown`
Expected: Abbruch vor dem ersten Test mit
```
SyntaxError: The requested module '../src/shared/zeilen.ts' does not provide an export named 'SPEAKER_NICHT_IN_LISTE'
```
Node nennt von mehreren fehlenden Namen den in Zeichencode-Reihenfolge ersten; Großbuchstaben kommen vor Kleinbuchstaben, deshalb steht hier `SPEAKER_NICHT_IN_LISTE` und nicht `aktionAendern`. npm meldet danach `Lifecycle script \`selftest\` failed`, Exit-Code 1.

- [ ] **Step 4: Feld `speakerId` in `apps/rundown/src/shared/types.ts`**

Vorher (eindeutig, Zeilen 29–32):
```ts
   * binden“; der Main rechnet daraus erst beim Senden die Nummer aus.
   */
  zielId?: string;
}
```
Nachher:
```ts
   * binden“; der Main rechnet daraus erst beim Senden die Nummer aus.
   */
  zielId?: string;
  /**
   * iveo-Speaker-Kennung eines `titler recall` (Master-Link 2b, Spec 8.1). Gesetzt nur
   * durch eine Auswahl im Speaker-Picker; `args[0]` behält den Namen (Anzeige, Rückfall).
   * Der Main macht daraus erst beim Senden `@<Kennung> <Name>` oder den aktuellen
   * Namen (8.3). 1 bis 200 Zeichen.
   */
  speakerId?: string;
}
```

- [ ] **Step 5: `normAction` übernimmt `speakerId` — `apps/rundown/src/shared/doc-format.ts`**

Vorher (eindeutig, Zeilen 34–37):
```ts
    // Sprungziel (Spec 6.2) nur als nicht leerer String übernehmen.
    ...(typeof o.zielId === 'string' && o.zielId ? { zielId: o.zielId } : {}),
  };
}
```
Nachher:
```ts
    // Sprungziel (Spec 6.2) nur als nicht leerer String übernehmen.
    ...(typeof o.zielId === 'string' && o.zielId ? { zielId: o.zielId } : {}),
    // Speaker-Kennung (Teil 2b, Spec 8.1) nur als String mit 1 bis 200 Zeichen.
    ...(typeof o.speakerId === 'string' && o.speakerId.length >= 1 && o.speakerId.length <= 200
      ? { speakerId: o.speakerId }
      : {}),
  };
}
```
Kein `trim()`: Die Spec verlangt hier nur „String mit 1 bis 200 Zeichen“ (8.1). Die Kennungen aus der Show sind schon getrimmt (B3, 5.1); eine Kennung mit Leerraum sendet `loeseSpeakerZiel` ohnehin in der Namensform.

- [ ] **Step 6: Kopf-Import in `apps/rundown/src/shared/zeilen.ts`**

Vorher (eindeutig, Zeilen 4–5):
```ts
import type { SprungErgebnis } from './sprung';
import type { RundownAction, RundownDoc, RundownRow } from './types';
```
Nachher:
```ts
import type { ShowIveoSpeaker } from '@jm/show';
import type { SprungErgebnis } from './sprung';
import type { RundownAction, RundownDoc, RundownRow } from './types';
```
Nur `import type`: Node entfernt die Zeile beim Typ-Stripping, der Selbsttest lädt `@jm/show` dafür nicht (G8).

- [ ] **Step 7: Neue Funktionen in `apps/rundown/src/shared/zeilen.ts`**

Vorher (eindeutig, Zeilen 47–50):
```ts
/** Titel des Sprung-Ziels für Hinweis und Log; ohne Zeile „Punkt <args[0]>“. */
export function sprungZielTitel(rows: RundownRow[], a: RundownAction): string {
  return rows.find((r) => r.id === a.zielId)?.label ?? `Punkt ${String(a.args[0] ?? '?')}`;
}
```
Nachher:
```ts
/** Titel des Sprung-Ziels für Hinweis und Log; ohne Zeile „Punkt <args[0]>“. */
export function sprungZielTitel(rows: RundownRow[], a: RundownAction): string {
  return rows.find((r) => r.id === a.zielId)?.label ?? `Punkt ${String(a.args[0] ?? '?')}`;
}

// ── Speaker-Abruf über die Kennung (Master-Link 2b, Spec 8.1–8.4) ───────────────

/** `titler recall` — die einzige Aktion, die eine Speaker-Kennung trägt (8.1). */
export function istSpeakerAbruf(a: RundownAction): boolean {
  return a.role === 'titler' && a.verb === 'recall';
}

/**
 * Patch auf eine Aktion anwenden (8.1); `updateAction` im Editor ruft das.
 * Ergebnis `{ ...aktion, ...patch }`. `speakerId` entfällt, wenn
 *  - sich Rolle oder Verb ändern,
 *  - der Patch sie als `undefined` oder `''` trägt („— Speaker wählen —“),
 *  - sich `args[0]` ändert, ohne dass der Patch eine `speakerId` mitbringt
 *    (freie Eingabe: eine von Hand auf „Grace“ geänderte Aktion trägt nicht mehr Alans Kennung).
 * Ein Schlüssel `speakerId: undefined` bleibt nie im Ergebnis stehen.
 */
export function aktionAendern(aktion: RundownAction, patch: Partial<RundownAction>): RundownAction {
  const neu: RundownAction = { ...aktion, ...patch };
  const rolleOderVerb =
    (patch.role !== undefined && patch.role !== aktion.role) || (patch.verb !== undefined && patch.verb !== aktion.verb);
  const geleert = 'speakerId' in patch && !patch.speakerId;
  const nameVonHand =
    patch.args !== undefined && !patch.speakerId && String(patch.args[0] ?? '') !== String(aktion.args[0] ?? '');
  if (rolleOderVerb || geleert || nameVonHand || !neu.speakerId) delete neu.speakerId;
  return neu;
}

/**
 * Argumente eines Speaker-Abrufs zum Sendezeitpunkt (8.3); `argsZumSenden` ruft das nach
 * der Sprung-Auflösung, also für GO, verzögerte Aktionen und den Test-Knopf.
 *  - keine `titler recall`-Aktion oder keine `speakerId` → `args` unverändert
 *  - der Titler versteht die `@`-Form und die Kennung hat keinen Leerraum
 *    → `['@' + Kennung, Name]`, ohne Namen nur `['@' + Kennung]`
 *  - sonst → `[Name, ...args.slice(1)]`
 * Name = aktueller Name zu `speakerId` in `speakers`, ohne Treffer `args[0]`.
 */
export function loeseSpeakerZiel(
  aktion: RundownAction,
  speakers: ShowIveoSpeaker[],
  titlerKannKennung: boolean,
): (string | number)[] {
  const id = aktion.speakerId;
  if (!istSpeakerAbruf(aktion) || !id) return aktion.args;
  const name = speakers.find((s) => s.id === id)?.name ?? String(aktion.args[0] ?? '');
  if (titlerKannKennung && !/\s/.test(id)) return name ? [`@${id}`, name] : [`@${id}`];
  return [name, ...aktion.args.slice(1)];
}

/**
 * Versteht der verbundene Titler die `@`-Form (7.5, 8.3)? Nur ein verbundener Link der
 * Rolle `titler`, dessen STATE `recall_kennung=1` meldet. Noch ohne STATE, getrennt oder
 * ein Titler 0.9.0 ohne diesen Schlüssel → false: gesendet wird dann der Name.
 */
export function titlerKannKennung(
  links: Array<{ role: string; connected: boolean; state: Record<string, string> | null }>,
): boolean {
  return links.some((l) => l.role === 'titler' && l.connected && l.state?.recall_kennung === '1');
}

/** Zusatz an Chip und Picker, wenn die Kennung in der Speaker-Liste fehlt (8.2, 8.4). */
export const SPEAKER_NICHT_IN_LISTE = 'nicht in der Speaker-Liste';

/**
 * Argumente für Chip und Etikett (8.4): bei `speakerId` der aktuelle Name aus `speakers`;
 * fehlt die Kennung dort, `<args[0]>, nicht in der Speaker-Liste`. Ohne `speakerId` oder
 * bei einer anderen Aktion die Argumente unverändert.
 */
export function speakerChipArgs(aktion: RundownAction, speakers: ShowIveoSpeaker[]): (string | number)[] {
  const id = aktion.speakerId;
  if (!istSpeakerAbruf(aktion) || !id) return aktion.args;
  const s = speakers.find((x) => x.id === id);
  return s ? [s.name] : [`${String(aktion.args[0] ?? '')}, ${SPEAKER_NICHT_IN_LISTE}`];
}

/** Eine Option des Speaker-Pickers (8.2): Wert im `<select>` und sichtbarer Text. */
export interface SpeakerOption {
  wert: string;
  text: string;
}

/**
 * Optionen des Speaker-Pickers im Zeilen-Editor und die ausgewählte (8.2).
 * Werte: `''` „— Speaker wählen —“; je Speaker `id:<Kennung>`, ohne Kennung `name:<Name>`;
 * dazu `alt:` (alte Aktion ohne Kennung: nie stillschweigend gebunden) oder `fehlt:`
 * (Kennung nicht in der Liste). `speakerPatch` übersetzt eine Auswahl zurück.
 */
export function speakerOptionen(
  aktion: RundownAction,
  speakers: ShowIveoSpeaker[],
): { optionen: SpeakerOption[]; gewaehlt: string } {
  const optionen: SpeakerOption[] = [{ wert: '', text: '— Speaker wählen —' }];
  for (const s of speakers) {
    optionen.push({ wert: s.id ? `id:${s.id}` : `name:${s.name}`, text: s.title ? `${s.name} — ${s.title}` : s.name });
  }
  const name = String(aktion.args[0] ?? '');
  if (aktion.speakerId) {
    if (speakers.some((s) => s.id === aktion.speakerId)) return { optionen, gewaehlt: `id:${aktion.speakerId}` };
    optionen.push({ wert: 'fehlt:', text: `${name} · ${SPEAKER_NICHT_IN_LISTE}` });
    return { optionen, gewaehlt: 'fehlt:' };
  }
  if (!name) return { optionen, gewaehlt: '' };
  // Ein Speaker ohne Kennung lässt sich nur per Name wählen: Dann steht er selbst ausgewählt.
  if (speakers.some((s) => !s.id && s.name === name)) return { optionen, gewaehlt: `name:${name}` };
  optionen.push({ wert: 'alt:', text: `${name} · per Name (nicht gebunden)` });
  return { optionen, gewaehlt: 'alt:' };
}

/**
 * Auswahl im Speaker-Picker → Patch für `aktionAendern` (8.2); null = Aktion bleibt.
 *  - `''`       → `{ args: [''], speakerId: undefined }` („— Speaker wählen —“)
 *  - `id:<x>`   → `{ speakerId: x, args: [Name] }`; Kennung nicht (mehr) in der Liste → null
 *  - `name:<n>` → `{ args: [n], speakerId: undefined }` (Speaker ohne Kennung)
 *  - `alt:`, `fehlt:` und alles andere → null
 */
export function speakerPatch(wert: string, speakers: ShowIveoSpeaker[]): Partial<RundownAction> | null {
  if (wert === '') return { args: [''], speakerId: undefined };
  if (wert.startsWith('id:')) {
    const id = wert.slice(3);
    const s = speakers.find((x) => x.id === id);
    return s ? { speakerId: id, args: [s.name] } : null;
  }
  if (wert.startsWith('name:')) return { args: [wert.slice(5)], speakerId: undefined };
  return null;
}
```
Hinweise zur Umsetzung:
- Der Parameter `titlerKannKennung` von `loeseSpeakerZiel` heißt wie die exportierte Funktion (Schnittstelle aus dem Gerüst). Innerhalb von `loeseSpeakerZiel` verdeckt er sie; dort wird die Funktion nicht gebraucht.
- `speakerOptionen` wählt für eine Aktion ohne `speakerId`, deren `args[0]` genau der Name eines Speakers **ohne** Kennung ist, diesen Speaker (`name:<Name>`) statt der Zusatzoption `alt:`. Grund: Solch ein Speaker lässt sich nur per Name wählen. Mit `alt:` stünde nach seiner Auswahl wieder „… · per Name (nicht gebunden)“ im Feld und seine eigene Option nie (Bestands-Show vor dem Nachschreiben der Kennungen, 5.3, oder M1 = nein).

- [ ] **Step 8: Selbsttest laufen lassen (grün)**

Run: `npm run selftest -w @jm/rundown`
Expected: alle Zeilen `ok   …`, darunter 61 neue, z. B.
```
ok   Nr. 1: speakerId mit 201 Zeichen entfällt
ok   Nr. 2: speakerId mit Leerraum → aktueller Name statt @-Form
ok   Nr. 3: Umbenennung, mit Fähigkeit → @s-3 und der neue Name
ok   Nr. 4: Chip mit unbekannter Kennung
ok   Nr. 5: Hand-Änderung an args[0] entfernt speakerId
ok   speakerOptionen: alte Aktion ohne speakerId → „per Name (nicht gebunden)“ ausgewählt, nie stillschweigend gebunden
ok   Review Focus 3: verbunden, noch ohne STATE → false
ok   Review Focus 3: ein Titler ohne bekannte Fähigkeit bekommt die @-Form nie
```
Am Ende von `test/selftest.ts` `ALLE TESTS OK`, danach läuft `test/gedaechtnis.test.ts` und endet ebenfalls mit `ALLE TESTS OK`; Exit-Code 0. Kein `FAIL`.

- [ ] **Step 9: Typecheck**

Run: `npm run typecheck -w @jm/rundown`
Expected: `tsc --noEmit -p tsconfig.node.json` und `tsc --noEmit -p tsconfig.web.json` ohne Ausgabe, Exit-Code 0.

- [ ] **Step 10: Gegenprobe (zeigt, dass die Tests die Regeln wirklich prüfen; ohne Commit)**

a) In `apps/rundown/src/shared/zeilen.ts` in `titlerKannKennung` die Bedingung `l.connected && ` entfernen:
```ts
  return links.some((l) => l.role === 'titler' && l.state?.recall_kennung === '1');
```
Run: `npm run selftest -w @jm/rundown`
Expected: genau
```
FAIL Review Focus 3: getrennt (mit altem STATE) → false
  erwartet: false
  bekommen: true
```
und am Ende `1 FEHLER`, Exit-Code 1. Danach die Zeile wieder auf
```ts
  return links.some((l) => l.role === 'titler' && l.connected && l.state?.recall_kennung === '1');
```
setzen.

b) In `aktionAendern` `nameVonHand || ` aus der Bedingung nehmen:
```ts
  if (rolleOderVerb || geleert || !neu.speakerId) delete neu.speakerId;
```
Run: `npm run selftest -w @jm/rundown`
Expected: `FAIL Nr. 5: Hand-Änderung an args[0] entfernt speakerId`, `1 FEHLER`. Danach wieder
```ts
  if (rolleOderVerb || geleert || nameVonHand || !neu.speakerId) delete neu.speakerId;
```
Run: `npm run selftest -w @jm/rundown` → wieder `ALLE TESTS OK`. Das Ergebnis der Gegenprobe kommt in den Aufgabenbericht.

- [ ] **Step 11: Commit**

```bash
git add apps/rundown/src/shared/types.ts apps/rundown/src/shared/doc-format.ts apps/rundown/src/shared/zeilen.ts apps/rundown/test/selftest.ts
git status --short
```
Erwartet genau (eine Warnung „LF will be replaced by CRLF“ ist harmlos, core.autocrlf):
```
M  apps/rundown/src/shared/doc-format.ts
M  apps/rundown/src/shared/types.ts
M  apps/rundown/src/shared/zeilen.ts
M  apps/rundown/test/selftest.ts
```
Dann (Commit-Text bewusst ohne Umlaute):
```bash
git commit -m "feat(rundown): Speaker-Aktion traegt die iveo-Kennung (Teil 2b, 8.1-8.4)" -m "RundownAction.speakerId (1-200 Zeichen, normAction), args[0] behaelt den Namen. Reine Funktionen in zeilen.ts: aktionAendern entfernt die Kennung bei Rollen-, Verb- oder Namensaenderung; loeseSpeakerZiel loest beim Senden auf (@-Form nur, wenn der Titler recall_kennung=1 meldet, sonst der aktuelle Name); dazu titlerKannKennung, speakerChipArgs, speakerOptionen, speakerPatch. Selbsttest 9.4 Nr. 1-5 und Review Focus 3." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
1. Rot-Meldung: Node nennt `SPEAKER_NICHT_IN_LISTE`, nicht `aktionAendern` (gemessen mit Node 24 an einer Kopie des Worktrees: Node meldet von mehreren fehlenden Exporten den in Zeichencode-Reihenfolge ersten). Die Tests importieren benannt statt über `zeilenModul as any`; so prüft der Typ der Importe mit, und ein fehlender Export bricht sofort ab.
2. `speakerOptionen` wählt bei einer Aktion ohne `speakerId` einen Speaker **ohne** Kennung mit genau diesem Namen selbst aus (`name:<Name>`), statt die Zusatzoption `alt:` anzuhängen. Die Spec beschreibt `alt:` für Listen mit Kennungen; ohne Kennung ließe sich der Speaker sonst nie sichtbar auswählen (siehe Step 7).
3. `speakerPatch('id:<x>')` liefert `null`, wenn `x` nicht (mehr) in der Liste steht. Der Name für `args[0]` fehlt dann, und eine Aktion ohne Namen wäre schlechter als die alte.
4. Zusätzlich geprüft: `migrate` behält `speakerId` (sonst verlöre der Main sie bei `setDoc`), und `istSpeakerAbruf`.
5. Geprüft an einer Kopie des Worktrees (Stand `996f54e2b8`, `ShowIveoSpeaker.id` aus B3 nachgebildet): rot wie in Step 3, grün mit 399 `ok`-Zeilen in `test/selftest.ts` (vorher 338), Gedächtnis-Test grün, Typecheck node und web grün, beide Gegenproben wie in Step 10.

---

### Task 16: B16 · Rundown verdrahten: Senden über `loeseSpeakerZiel`, `updateAction` über `aktionAendern`, Picker über die Kennung, Chip mit aktuellem Namen

**Spec:** 8.1 („`updateAction` … ruft sie“), 8.2 (Picker), 8.3 („Die Auflösung läuft in `argsZumSenden` …, also erst beim Senden. Das gilt für GO, verzögerte Aktionen und den Test-Knopf.“), 8.4 (Chip und Vorschau), SP6 aus 5.2 („Wert der Picker-Option … Kennung statt Name“).

Worum es geht:
- `argsZumSenden` (Main) löst nach dem Sprung-Ziel die Speaker-Kennung auf. Ob der Titler die `@`-Form versteht, liest es aus dem STATE der Rolle `titler` im Conductor (`conductor.snapshot()`), zum Sendezeitpunkt.
- Jede Änderung einer Aktion im Editor läuft über `aktionAendern`. Deshalb entfernen `setRole`, `setVerb` und die freie Eingabe (`setArg`) die Kennung von selbst; sie bleiben unverändert.
- Der Picker zeigt `speakerOptionen`, eine Auswahl geht über `speakerPatch`. `alt:` und `fehlt:` ändern nichts.
- Die Vorschau-Zeile im Editor zeigt bei Speaker-Abrufen den aktuellen Namen (Namensform), der Chip in der Liste `speakerChipArgs`.
- Der Kommentar `RowEditor.tsx:158-159` („Programme↔Speaker sind in iveo NICHT verknüpft“) ist überholt (`apps/launcher/src/main/iveo-abgleich-kern.ts:209-212`, `sideSpeakerIds`) und wird berichtigt.

**Arbeitsverzeichnis:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b`, Branch `feat/master-link-teil2b`. Alle Pfade relativ dazu. Voraussetzung: B15 ist committet.

**Dateien:**
- Modify: `apps/rundown/src/main/index.ts:32-39` (Import aus `@shared/zeilen`), `:342-345` (`argsZumSenden`)
- Modify: `apps/rundown/src/renderer/src/lib/doc.ts:5` (Import), `:109-114` (`updateAction`)
- Modify: `apps/rundown/src/renderer/src/components/RowEditor.tsx:4-13` (Import), `:147-150` (Vorschau), `:156-161` (Picker-Kommentar und Bedingung), `:191` (neue Funktion `waehleSpeaker` vor `setArg`), `:260-272` (`select` des Pickers)
- Modify: `apps/rundown/src/renderer/src/components/RundownList.tsx:1-6` (Importe), `:18-29` (Props), `:188-194` (Chip)
- Modify: `apps/rundown/src/renderer/src/App.tsx:198-202` (Prop an `RundownList`)
- Test: kein neuer Test. Die Funktionen sind in B15 vollständig getestet. Hier prüfen Typecheck (rot → grün), Selbsttest und Build.

**Interfaces:**
- Consumes (B15, `apps/rundown/src/shared/zeilen.ts`): `istSpeakerAbruf(a: RundownAction): boolean`, `aktionAendern(aktion: RundownAction, patch: Partial<RundownAction>): RundownAction`, `loeseSpeakerZiel(aktion: RundownAction, speakers: ShowIveoSpeaker[], titlerKannKennung: boolean): (string | number)[]`, `titlerKannKennung(links: Array<{ role: string; connected: boolean; state: Record<string, string> | null }>): boolean`, `speakerChipArgs(aktion: RundownAction, speakers: ShowIveoSpeaker[]): (string | number)[]`, `speakerOptionen(aktion: RundownAction, speakers: ShowIveoSpeaker[]): { optionen: SpeakerOption[]; gewaehlt: string }`, `speakerPatch(wert: string, speakers: ShowIveoSpeaker[]): Partial<RundownAction> | null`.
- Consumes (bestehend): `RundownState.iveoSpeakers: ShowIveoSpeaker[]` (`apps/rundown/src/shared/types.ts:125`); im Main `let iveoSpeakers: ShowIveoSpeaker[]` (`apps/rundown/src/main/index.ts:87`) und `conductor.snapshot(): ToolLink[]` mit `ToolLink = { role; label; host; port; connected; source; state: Record<string, string> | null }` (`apps/rundown/src/main/conductor.ts:140`). `ToolLink[]` passt auf den Parameter von `titlerKannKennung`.
- Produces: neue Prop `RundownList({ …, iveoSpeakers: ShowIveoSpeaker[] })`. Keine neuen Exporte.

Regeln: G8 gilt für `src/shared` (hier nicht geändert). G15: Die fünf Dateien liegen mit CRLF vor, Änderungen mit dem Edit-Werkzeug. Befehle im Worktree-Wurzelverzeichnis.

- [ ] **Step 1: `App.tsx` reicht `iveoSpeakers` an die Liste (macht den Typecheck rot)**

Datei `apps/rundown/src/renderer/src/App.tsx`. Vorher (eindeutig, Zeilen 198–202):
```tsx
            onDoc={aendere}
            sicht={sicht}
          />
        </div>
        <div className="w-[26rem] shrink-0">
```
Nachher:
```tsx
            onDoc={aendere}
            sicht={sicht}
            iveoSpeakers={state.iveoSpeakers ?? []}
          />
        </div>
        <div className="w-[26rem] shrink-0">
```

- [ ] **Step 2: Typecheck laufen lassen (rot)**

Run: `npm run typecheck -w @jm/rundown`
Expected: `typecheck:node` ohne Fehler, dann bricht `typecheck:web` ab mit
```
src/renderer/src/App.tsx(200,13): error TS2322: Type '{ doc: RundownDoc; … sicht: ShowSicht; iveoSpeakers: ShowIveoSpeaker[]; }' is not assignable to type 'IntrinsicAttributes & { doc: RundownDoc; … sicht: ShowSicht; }'.
  Property 'iveoSpeakers' does not exist on type 'IntrinsicAttributes & { doc: RundownDoc; … sicht: ShowSicht; }'.
```
Exit-Code 2 (npm meldet den gescheiterten Lifecycle).

- [ ] **Step 3: `RundownList.tsx` — Importe**

Datei `apps/rundown/src/renderer/src/components/RundownList.tsx`. Vorher (eindeutig, Zeilen 1–6):
```tsx
import { useState } from 'react';
import { loeseSprungZiel } from '@shared/sprung';
import { sendeArgs, sperrenFuer, verschiebeZeilen, zeilenArt, zeilenHinweis, type ShowSicht } from '@shared/zeilen';
import { actionLabel } from '@/lib/capabilities';
import { addRow, duplicateRow, removeRow } from '@/lib/doc';
import type { RundownDoc } from '@shared/types';
```
Nachher:
```tsx
import { useState } from 'react';
import { loeseSprungZiel } from '@shared/sprung';
import {
  istSpeakerAbruf,
  sendeArgs,
  speakerChipArgs,
  sperrenFuer,
  verschiebeZeilen,
  zeilenArt,
  zeilenHinweis,
  type ShowSicht,
} from '@shared/zeilen';
import { actionLabel } from '@/lib/capabilities';
import { addRow, duplicateRow, removeRow } from '@/lib/doc';
import type { ShowIveoSpeaker } from '@jm/show';
import type { RundownDoc } from '@shared/types';
```

- [ ] **Step 4: `RundownList.tsx` — Prop `iveoSpeakers`**

Vorher (eindeutig, Zeilen 18–29):
```tsx
  onDoc,
  sicht,
}: {
  doc: RundownDoc;
  index: number;
  selectedId: string | null;
  onSelect: (rowId: string) => void;
  onSetCue: (rowIndex: number) => void;
  onDoc: (doc: RundownDoc) => void;
  /** Gemerkte Show: Sperren (4.5) und aufgelöste Sprung-Nummern (6.2). */
  sicht: ShowSicht;
}) {
```
Nachher:
```tsx
  onDoc,
  sicht,
  iveoSpeakers,
}: {
  doc: RundownDoc;
  index: number;
  selectedId: string | null;
  onSelect: (rowId: string) => void;
  onSetCue: (rowIndex: number) => void;
  onDoc: (doc: RundownDoc) => void;
  /** Gemerkte Show: Sperren (4.5) und aufgelöste Sprung-Nummern (6.2). */
  sicht: ShowSicht;
  /** iveo-Speaker der Show: Chips von Speaker-Abrufen zeigen den aktuellen Namen zur Kennung (Teil 2b, 8.4). */
  iveoSpeakers: ShowIveoSpeaker[];
}) {
```

- [ ] **Step 5: `RundownList.tsx` — Chip mit aktuellem Namen (8.4)**

Vorher (eindeutig, Zeilen 188–194):
```tsx
                      {actionLabel(
                        a.role,
                        a.verb,
                        sendeArgs(a, (x) => loeseSprungZiel(x, sicht.ablaufSchluessel, sicht.eigeneTimerListe)) ?? [
                          'Ziel entfallen',
                        ],
                      )}
```
Nachher:
```tsx
                      {actionLabel(
                        a.role,
                        a.verb,
                        // Teil 2b (8.4): Speaker-Abruf mit dem aktuellen Namen zur Kennung, sonst die Sendeargumente (6.2).
                        istSpeakerAbruf(a)
                          ? speakerChipArgs(a, iveoSpeakers)
                          : (sendeArgs(a, (x) => loeseSprungZiel(x, sicht.ablaufSchluessel, sicht.eigeneTimerListe)) ?? [
                              'Ziel entfallen',
                            ]),
                      )}
```
Mit `actionLabel` (`lib/capabilities.ts:21-24`) ergibt das bei unbekannter Kennung „JM Titler · DataLink-Eintrag abrufen (Alan, nicht in der Speaker-Liste)“. Ein `titler recall` hat nie ein Sprung-Ziel, deshalb braucht der Speaker-Zweig `sendeArgs` nicht.

- [ ] **Step 6: `lib/doc.ts` — `updateAction` über `aktionAendern` (8.1)**

Datei `apps/rundown/src/renderer/src/lib/doc.ts`. Vorher (eindeutig, Zeile 5):
```ts
import { dupliziereZeile } from '@shared/zeilen';
```
Nachher:
```ts
import { aktionAendern, dupliziereZeile } from '@shared/zeilen';
```
Vorher (eindeutig, Zeilen 109–114):
```ts
  const row = doc.rows.find((r) => r.id === rowId);
  if (!row) return doc;
  return updateRow(doc, rowId, {
    actions: row.actions.map((a) => (a.id === actionId ? { ...a, ...patch } : a)),
  });
}
```
Nachher:
```ts
  const row = doc.rows.find((r) => r.id === rowId);
  if (!row) return doc;
  // Teil 2b (Spec 8.1): aktionAendern entfernt die Speaker-Kennung, wenn Rolle, Verb oder der Name sich ändern.
  return updateRow(doc, rowId, {
    actions: row.actions.map((a) => (a.id === actionId ? aktionAendern(a, patch) : a)),
  });
}
```
Damit entfernen `setRole` und `setVerb` (`RowEditor.tsx:175-181`, Patch mit `role`/`verb`) und `setArg` (`:191-195`, neue `args` ohne `speakerId`) die Kennung, ohne selbst geändert zu werden. `enabled` und `delayMs` lassen sie stehen.

- [ ] **Step 7: Main — Speaker-Kennung beim Senden auflösen (8.3)**

Datei `apps/rundown/src/main/index.ts`. Vorher (eindeutig, Zeilen 32–39):
```ts
import {
  ablaufNeuEntstanden,
  ablaufSchluesselAusZeilen,
  ersteLebendeZeile,
  kontextIstIveo,
  sendeArgs,
  sprungZielTitel,
} from '@shared/zeilen';
```
Nachher:
```ts
import {
  ablaufNeuEntstanden,
  ablaufSchluesselAusZeilen,
  ersteLebendeZeile,
  kontextIstIveo,
  loeseSpeakerZiel,
  sendeArgs,
  sprungZielTitel,
  titlerKannKennung,
} from '@shared/zeilen';
```
Vorher (eindeutig, Zeilen 342–345):
```ts
/** Argumente, mit denen eine Aktion JETZT gesendet würde (6.2); null = Sprung-Ziel entfallen. */
function argsZumSenden(a: RundownAction): (string | number)[] | null {
  return sendeArgs(a, (x) => loeseSprungZiel(x, ablaufSchluessel, eigeneTimerListe));
}
```
Nachher:
```ts
/**
 * Argumente, mit denen eine Aktion JETZT gesendet würde; null = Sprung-Ziel entfallen.
 * Erst das Sprung-Ziel (6.2), dann die Speaker-Kennung (Teil 2b, Spec 8.3): mit
 * `recall_kennung=1` im STATE des Titlers `@<Kennung> <Name>`, sonst der aktuelle Name.
 * Beides erst beim Senden, also für GO, verzögerte Aktionen und den Test-Knopf.
 */
function argsZumSenden(a: RundownAction): (string | number)[] | null {
  const args = sendeArgs(a, (x) => loeseSprungZiel(x, ablaufSchluessel, eigeneTimerListe));
  if (!args) return null;
  return loeseSpeakerZiel({ ...a, args }, iveoSpeakers, titlerKannKennung(conductor.snapshot()));
}
```
`argsZumSenden` wird von `fireOne` (GO, auch verzögert, `:354`) und vom Test-Knopf (`rundown:fireAction`, `:460`) gerufen; beide bekommen die Auflösung damit ohne weitere Änderung. `conductor` ist eine Modul-Konstante (`:126`) und beim ersten Senden längst da.

- [ ] **Step 8: `RowEditor.tsx` — Importe**

Datei `apps/rundown/src/renderer/src/components/RowEditor.tsx`. Vorher (eindeutig, Zeilen 4–13):
```tsx
import {
  ablaufPunkte,
  istSprung,
  sendeArgs,
  sperrenFuer,
  zeilenArt,
  zeilenHinweis,
  type AblaufPunkt,
  type ShowSicht,
} from '@shared/zeilen';
```
Nachher:
```tsx
import {
  ablaufPunkte,
  istSpeakerAbruf,
  istSprung,
  loeseSpeakerZiel,
  sendeArgs,
  speakerOptionen,
  speakerPatch,
  sperrenFuer,
  zeilenArt,
  zeilenHinweis,
  type AblaufPunkt,
  type ShowSicht,
} from '@shared/zeilen';
```

- [ ] **Step 9: `RowEditor.tsx` — Vorschau-Zeile mit aktuellem Namen**

Vorher (eindeutig, Zeilen 147–150):
```tsx
  const cap = capAction(action.role, action.verb);
  // 6.2: Vorschau mit der Nummer, die jetzt gesendet würde; null = Ziel entfallen.
  const sendArgs = sendeArgs(action, (x) => loeseSprungZiel(x, sicht.ablaufSchluessel, sicht.eigeneTimerListe));
  const line = sendArgs ? buildActionLine(action.role, action.verb, sendArgs) : null;
```
Nachher:
```tsx
  const cap = capAction(action.role, action.verb);
  // 6.2: Vorschau mit der Nummer, die jetzt gesendet würde; null = Ziel entfallen.
  // Teil 2b (8.3, 8.4): Ein Speaker-Abruf zeigt den aktuellen Namen zu seiner Kennung, in der
  // Namensform. Ob beim GO die @-Form hinausgeht, entscheidet der Main nach dem STATE des Titlers.
  const sprungArgs = sendeArgs(action, (x) => loeseSprungZiel(x, sicht.ablaufSchluessel, sicht.eigeneTimerListe));
  const sendArgs = sprungArgs ? loeseSpeakerZiel({ ...action, args: sprungArgs }, iveoSpeakers, false) : null;
  const line = sendArgs ? buildActionLine(action.role, action.verb, sendArgs) : null;
```

- [ ] **Step 10: `RowEditor.tsx` — Picker-Bedingung und berichtigter Kommentar**

Vorher (eindeutig, Zeilen 156–161):
```tsx
  // iveo-Komfort (#11): Beim Titler-Recall die Speaker der Show als Dropdown
  // anbieten (Recall PER NAME → stabil gegenüber Umsortierung). Ersetzt für diese
  // Aktion die generische Arg-Eingabe. Programme↔Speaker sind in iveo NICHT
  // verknüpft → die Zuordnung Programmzeile→Speaker trifft bewusst der Operator.
  const speakerPicker =
    action.role === 'titler' && action.verb === 'recall' && iveoSpeakers.length > 0;
```
Nachher:
```tsx
  // iveo-Komfort (#11): Beim Titler-Recall die Speaker der Show als Dropdown anbieten.
  // Ersetzt für diese Aktion die generische Arg-Eingabe. Teil 2b (8.2): Eine Auswahl bindet
  // über die iveo-Kennung (`speakerId`), `args[0]` behält den Namen. iveo verknüpft Programme
  // und Speaker zwar (Side Events, apps/launcher/src/main/iveo-abgleich-kern.ts `sideSpeakerIds`);
  // welche Programmzeile welchen Speaker abruft, entscheidet hier aber der Operator.
  const speakerPicker = istSpeakerAbruf(action) && iveoSpeakers.length > 0;
  const picker = speakerOptionen(action, iveoSpeakers);
```

- [ ] **Step 11: `RowEditor.tsx` — Auswahl über `speakerPatch`**

Vorher (eindeutig, Zeile 191):
```tsx
  function setArg(i: number, value: string | number): void {
```
Nachher:
```tsx
  /** 8.2: Auswahl im Speaker-Picker → Kennung und Name; `alt:`/`fehlt:` lassen die Aktion, wie sie ist. */
  function waehleSpeaker(wert: string): void {
    const patch = speakerPatch(wert, iveoSpeakers);
    if (patch) onDoc(updateAction(doc, rowId, action.id, patch));
  }
  function setArg(i: number, value: string | number): void {
```
Vorher (eindeutig, Zeilen 260–272, das `select` des Speaker-Pickers):
```tsx
            iveo-Speaker (Bauchbinde)
            <select
              value={String(action.args[0] ?? '')}
              onChange={(e) => setArg(0, e.target.value)}
              className={`${input} mt-0.5`}
            >
              <option value="">— Speaker wählen —</option>
              {iveoSpeakers.map((s, i) => (
                <option key={`${s.name}-${i}`} value={s.name}>
                  {s.title ? `${s.name} — ${s.title}` : s.name}
                </option>
              ))}
            </select>
```
Nachher:
```tsx
            iveo-Speaker (Bauchbinde)
            <select
              value={picker.gewaehlt}
              onChange={(e) => waehleSpeaker(e.target.value)}
              className={`${input} mt-0.5`}
            >
              {picker.optionen.map((o, i) => (
                <option key={`${i}-${o.wert}`} value={o.wert}>
                  {o.text}
                </option>
              ))}
            </select>
```
Der React-Schlüssel enthält die Stelle, weil zwei Speaker ohne Kennung denselben Namen und damit denselben Wert `name:<Name>` haben können.

- [ ] **Step 12: Typecheck (grün)**

Run: `npm run typecheck -w @jm/rundown`
Expected: beide `tsc`-Läufe ohne Ausgabe, Exit-Code 0.

- [ ] **Step 13: Selbsttest und Build**

Run: `npm run selftest -w @jm/rundown`
Expected: wie am Ende von B15, letzte Zeilen beider Testdateien `ALLE TESTS OK`, kein `FAIL`, Exit-Code 0.

Run: `npm run build -w @jm/rundown`
Expected: `electron-vite build` baut main, preload und renderer, jeweils `✓ built in …`, Exit-Code 0; danach gibt es `apps/rundown/out/main/index.cjs`.

- [ ] **Step 14: Commit**

```bash
git add apps/rundown/src/main/index.ts apps/rundown/src/renderer/src/lib/doc.ts apps/rundown/src/renderer/src/components/RowEditor.tsx apps/rundown/src/renderer/src/components/RundownList.tsx apps/rundown/src/renderer/src/App.tsx
git status --short
```
Erwartet genau (`apps/rundown/out/` ist von Git ignoriert):
```
M  apps/rundown/src/main/index.ts
M  apps/rundown/src/renderer/src/App.tsx
M  apps/rundown/src/renderer/src/components/RowEditor.tsx
M  apps/rundown/src/renderer/src/components/RundownList.tsx
M  apps/rundown/src/renderer/src/lib/doc.ts
```
Dann (Commit-Text bewusst ohne Umlaute):
```bash
git commit -m "feat(rundown): Speaker-Picker bindet ueber die Kennung, Senden in der @-Form, Chip mit aktuellem Namen (Teil 2b, 8.2-8.4)" -m "argsZumSenden loest nach dem Sprung-Ziel die Speaker-Kennung auf (GO, verzoegerte Aktionen, Test-Knopf); die Faehigkeit des Titlers kommt aus dem STATE im Conductor. updateAction laeuft ueber aktionAendern. Der Picker zeigt speakerOptionen, eine Auswahl geht ueber speakerPatch. Vorschau und Chip zeigen den aktuellen Namen zur Kennung. Kommentar zu Programmen und Speakern in iveo berichtigt." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
1. `lib/capabilities.ts` (Spec 8.4, 11) bleibt unverändert: `actionLabel` bekommt die Chip-Argumente fertig aus `speakerChipArgs`.
2. Die Vorschau im Editor löst erst das Sprung-Ziel und dann die Kennung auf (`sendeArgs` → `loeseSpeakerZiel`), wie `argsZumSenden` im Main. Für einen Speaker-Abruf ist das dasselbe wie `loeseSpeakerZiel(action, iveoSpeakers, false)` aus dem Gerüst.
3. Das Senden in der `@`-Form ist im Durchgang (B17) nicht eigens geprüft; das Gerüst nennt Abschnitt 9 und 9d, die den Titler direkt über `TITLER RECALL` steuern. Abgedeckt sind `loeseSpeakerZiel` und `titlerKannKennung` in B15 und der Weg Picker → GO in der Owner-Abnahme (`apps/titler/ABNAHME-2b-R1.md`, Schritt 7).
4. Geprüft an einer Kopie des Worktrees mit B15: Typecheck rot wie in Step 2, danach node und web grün, Selbsttest grün, `electron-vite build` grün.

---

### Task 17: B17 · Durchgang `e2e-teil2a.mjs`: Abschnitt 9 als Prüfung, 9b–9e mit Bildvergleich, Gegenprobe gegen Titler 0.9.0

**Spec:** 9.6 vollständig, SP7 (5.2); G11 (Token und `%APPDATA%`).

Worum es geht, in den Worten der Spec (9.6):
- „Abschnitt 9 wird von der Messung zur **Prüfung**: … nach dem Einfügen steht weiter „Alan“ auf Sendung (`entry === 'Alan'`, `on_air === '1'`).“
- „Diese Abschnitte [9b–9e] laufen am Ende des Skripts … Davor öffnet das Skript wieder die Show aus Abschnitt 9 (Launcher-Deep-Link) und schaltet auf die Tagesübersicht. Erst dann fügt das Skript dem nachgebauten iveo ein drittes Programm `p-c` hinzu: Side Event mit `speaker_ids: ['s-1', 's-2']` (Ada und Grace, **ohne** Alan) und einem Agenda-Punkt.“
- 9b: „`LAUNCHER SIDEEVENT p-c` → `entry === 'Alan'`, `entry_index === '0'`, Logzeile A2, **und** Bild gleich A“. 9c: „`TITLER CLEAR`, 2 s warten → `entry === ''`. Dann `TITLER TAKE`, 1,5 s warten → Bild ungleich A“. 9d: „Grace abrufen, TAKE, Bild G merken. … die Funktion von Grace ändern **und** `updated_at` von `p-a` hochsetzen … → `entry === 'Grace'` und Bild ungleich G.“
- 9e: „`titler-config.json` mit `template: 'lowerthird'`, `name: '{{name}}'`, `subtitle: '{{funktion}}'`. Der Titler startet mit `--remote-debugging-port=9335`. Messpunkt ist die SHA-256 von `toDataURL()` des Vorschau-Canvas, gelesen über CDP, 1,5 s nach jeder Aktion.“ Kontrolle: „`TITLER RECALL 2` → Bild ungleich A; wieder Alan abrufen → Bild gleich A.“
- „**Gegenprobe:** Abschnitt 9 einmal gegen den gebauten Titler 0.9.0 laufen lassen. Er muss rot werden. Das Ergebnis kommt in den PR-Text.“

**Arbeitsverzeichnis:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b`, Branch `feat/master-link-teil2b`. Alle Pfade relativ dazu. Voraussetzung: B1–B16 sind committet, und der Owner hat Entscheidung 18 bestätigt (Abschnitt 9 mit `TITLER RECALL Alan` und „Abel“, Kopf „Ausnahme“). Ohne Bestätigung hier anhalten und der steuernden Sitzung melden.

**Dateien:**
- Modify: `apps/rundown/test/e2e-teil2a.mjs`
  - `:2`, `:8-15`, `:20-22` (Kopf: Zweck, Gegenprobe, Ports, gesicherte Dateien, Messpunkte, Reihenfolge)
  - `:26`, `:34` (Importe `mkdirSync`, `speakersToShowSpeakers`)
  - `:46-57` (`CDP_TITLER`, `PORTS`, Titler-Ordner, `SICHERN`)
  - `:177-179` (SP7 `speakerListe()`)
  - `:207-208` (`starte` nimmt den Titler-Ordner)
  - `:302` (neu davor: Titler über DevTools, `bildHash`, `schreibeTitlerConfig`)
  - `:343-344` (`raeumeAuf` schließt die Titler-Verbindung)
  - `:368-373`, `:384-385`, `:394-398` (`main()`: Bau-Prüfung, Titler-Config, Titler-Start mit DevTools)
  - `:534-553` (Abschnitt 9)
  - `:715-718` (Ende von `main()`: neue Abschnitte 9b–9d)
- Kein Produktcode, kein Test in der CI (der Durchgang braucht Electron, Fenster und `%APPDATA%`).

**Interfaces:**
- Consumes: gebaute Programme aus B3–B16 (`npm run build -w @jm/launcher -w @jm/timer -w @jm/rundown -w @jm/titler`); vom Titler (B9/B13): STATE `entry` (Label des aktiven oder gehaltenen Eintrags, sonst leer), `entry_index` (1-basiert, gehalten oder keiner 0), `entry_count`, `on_air`; Logzeile A2 aus 7.9 wörtlich `DataLink: aktiver Eintrag „Alan“ nicht mehr in der Liste, auf Sendung gehalten.` in `%APPDATA%\@jm\titler\logs\main.log`; Halten 1 s nach dem Ende der Sendung (G4). Vom Launcher (B5–B7): `LAUNCHER SIDEEVENT [programId]`, STATE `iveo_side_event`, Logzeile `iveo: Live-Polling für Event „…" aktiv`. Aus `@jm/iveo`: `speakersToShowSpeakers(speakers: IveoSpeaker[]): ShowIveoSpeaker[]` (mit `id` nach B4, Zweig A).
- Produces (nur im Skript):
```js
const CDP_TITLER = 9335;
async function verbindeTitler() {}          // DevTools-Verbindung zum Bedienfenster (index.html ohne ?view=)
function tl(ausdruck, ms = 15_000) {}       // Runtime.evaluate im Titler-Fenster → Promise<Wert>
async function bildHash() {}                // SHA-256 (hex) von document.querySelector('canvas').toDataURL()
function schreibeTitlerConfig() {}          // %APPDATA%\@jm\titler\titler-config.json für 9e
```
  Dazu `TITLER_DIR` und `appOrdner(app)` (Schalter `E2E_TITLER_DIR` für die Gegenprobe).

Regeln für diese Aufgabe:
- G11: Der Durchgang legt Dev-Daten unter `%APPDATA%` beiseite und stellt sie wieder her. Er läuft erst nach Freigabe durch die steuernde Sitzung (Step 13). Kein Agent liest dort Dateien; das Skript tut es selbst.
- G15: Die Datei liegt mit CRLF vor; Änderungen mit dem Edit-Werkzeug.
- G13: kein Push; `git worktree add/remove` nur für den Gegenprobe-Ordner aus Step 14, kein Branch-Wechsel im Arbeits-Worktree.
- Alle Befehle im Worktree-Wurzelverzeichnis `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b`, Bash.

- [ ] **Step 1: Kopf des Skripts**

Datei `apps/rundown/test/e2e-teil2a.mjs`. Ersetzung 1, Vorher (eindeutig, Zeile 2):
```js
// Durchgang Master-Link Teil 2a mit den GEBAUTEN Programmen (Spec 9.8, Titler-Messung 6.4).
```
Nachher:
```js
// Durchgang Master-Link Teil 2a/2b mit den GEBAUTEN Programmen (2a-Spec 9.8; 2b-Spec 9.6: Titler hält seinen Speaker).
```
Ersetzung 2, Vorher (eindeutig, Zeilen 8–15):
```js
// tsx, weil das Skript Suite-Pakete als TypeScript-Quelle lädt (Steuer-Client, Show-Format, iveo-Umwandler).
//
// Vorher darf kein Launcher/Timer/Titler/Rundown laufen (Ports 7777, 8724, 8726, 8731, 8736, 8738, 9334 frei).
// Das Skript legt die Daten, die es verändert, VOR dem Lauf beiseite (umbenennen nach <name>.e2e-vorher) und
// stellt sie in jedem Ausgang wieder her (auch Abbruch und Strg+C):
//   %APPDATA%\@jm\rundown\regie, rundown.autosave.jmrundown, rundown.autosave.v1.jmrundown,
//   %APPDATA%\@jm\timer\state.json, %APPDATA%\@jm\titler\titler-config.json, %APPDATA%\@jm\titler\iveo-data,
//   %APPDATA%\JM Production Suite\master-link.json (der Dev-Launcher soll nicht als Master/Slave mitlaufen).
```
Nachher:
```js
// tsx, weil das Skript Suite-Pakete als TypeScript-Quelle lädt (Steuer-Client, Show-Format, iveo-Umwandler).
//
// Gegenprobe (2b-Spec 9.6): Mit E2E_TITLER_DIR=<Ordner apps\titler eines gebauten Titlers 0.9.0> startet das
// Skript den Titler von dort. Abschnitt 9 muss dann rot werden („FEHL 9 · Alan bleibt auf Sendung …“).
//
// Vorher darf kein Launcher/Timer/Titler/Rundown laufen (Ports 7777, 8724, 8726, 8731, 8736, 8738, 9334, 9335 frei).
// Das Skript legt die Daten, die es verändert, VOR dem Lauf beiseite (umbenennen nach <name>.e2e-vorher) und
// stellt sie in jedem Ausgang wieder her (auch Abbruch und Strg+C):
//   %APPDATA%\@jm\rundown\regie, rundown.autosave.jmrundown, rundown.autosave.v1.jmrundown,
//   %APPDATA%\@jm\timer\state.json, %APPDATA%\@jm\titler\titler-config.json, %APPDATA%\@jm\titler\iveo-data,
//   %APPDATA%\@jm\titler\show-zuletzt.json,
//   %APPDATA%\JM Production Suite\master-link.json (der Dev-Launcher soll nicht als Master/Slave mitlaufen).
// Danach schreibt es eine eigene titler-config.json (Vorlage Bauchbinde, {{name}} / {{funktion}}), damit das
// Vorschaubild des Titlers den abgerufenen Speaker zeigt.
```
Ersetzung 3, Vorher (eindeutig, Zeilen 20–22):
```js
// Logzeilen der drei Programme. Den Rundown liest und bedient das Skript über seine Preload-Brücke
// window.jmrundown (Chrome-DevTools-Protokoll auf Port 9334) — derselbe Weg wie der Editor.
// Reihenfolge: 1–7b, dann 9 (Titler hängt an Show 1), zuletzt 8 (wechselt den Rundown auf Show 2).
```
Nachher:
```js
// Logzeilen der drei Programme. Den Rundown liest und bedient das Skript über seine Preload-Brücke
// window.jmrundown (Chrome-DevTools-Protokoll auf Port 9334) — derselbe Weg wie der Editor.
// Titler (2b-Spec 9.6): STATE auf 8726, Titler-Log und das Vorschaubild — SHA-256 von toDataURL() des Canvas im
// Bedienfenster, gelesen über DevTools auf Port 9335, jeweils 1,5 s nach der Aktion (9e).
// Reihenfolge: 1–7b, dann 9 (Titler hängt an Show 1), dann 8 (wechselt den Rundown auf Show 2) und 10–14,
// zuletzt 9b–9d (der Launcher öffnet Show 1 wieder; neues Side Event p-c verknüpft Ada und Grace, nicht Alan).
```

- [ ] **Step 2: Importe**

Vorher (eindeutig, Zeile 26):
```js
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
```
Nachher:
```js
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
```
Vorher (eindeutig, Zeile 34):
```js
import { agendaToAblauf, localTimeOfDayMs } from '@jm/iveo';
```
Nachher:
```js
import { agendaToAblauf, localTimeOfDayMs, speakersToShowSpeakers } from '@jm/iveo';
```

- [ ] **Step 3: DevTools-Port des Titlers, Titler-Ordner, gemerkte Show beiseitelegen**

Vorher (eindeutig, Zeilen 46–57):
```js
const CDP_RUNDOWN = 9334;
const PORTS = { timerSocket: 7777, timer: 8724, titler: 8726, rundown: 8731, launcher: 8736, verbund: 8738, rundownDevTools: CDP_RUNDOWN };
const VORHER = '.e2e-vorher';
const SICHERN = [
  join(DEV('rundown'), 'regie'),
  join(DEV('rundown'), 'rundown.autosave.jmrundown'),
  join(DEV('rundown'), 'rundown.autosave.v1.jmrundown'),
  join(DEV('timer'), 'state.json'),
  join(DEV('titler'), 'titler-config.json'),
  join(DEV('titler'), 'iveo-data'),
  join(APPDATA, 'JM Production Suite', 'master-link.json'),
];
```
Nachher:
```js
const CDP_RUNDOWN = 9334;
const CDP_TITLER = 9335;
const PORTS = { timerSocket: 7777, timer: 8724, titler: 8726, rundown: 8731, launcher: 8736, verbund: 8738, rundownDevTools: CDP_RUNDOWN, titlerDevTools: CDP_TITLER };
/** Titler-Programmordner: für die Gegenprobe (2b-Spec 9.6) aus E2E_TITLER_DIR, sonst wie alle anderen aus diesem Repo. */
const TITLER_DIR = process.env.E2E_TITLER_DIR ? resolve(process.env.E2E_TITLER_DIR) : join(REPO, 'apps', 'titler');
const appOrdner = (app) => (app === 'titler' ? TITLER_DIR : join(REPO, 'apps', app));
const VORHER = '.e2e-vorher';
const SICHERN = [
  join(DEV('rundown'), 'regie'),
  join(DEV('rundown'), 'rundown.autosave.jmrundown'),
  join(DEV('rundown'), 'rundown.autosave.v1.jmrundown'),
  join(DEV('timer'), 'state.json'),
  join(DEV('titler'), 'titler-config.json'),
  join(DEV('titler'), 'iveo-data'),
  join(DEV('titler'), 'show-zuletzt.json'), // gemerkte Show des Titlers (2b-Spec 7.7); sonst bliebe die des Laufs liegen
  join(APPDATA, 'JM Production Suite', 'master-link.json'),
];
```
Die Port-Prüfung in `main()` läuft über alle Werte von `PORTS`; 9335 ist damit eingeschlossen. `show-zuletzt.json` (G6) steht in `SICHERN`, damit `raeumeAuf` die Datei des Laufs löscht und eine vorhandene wiederherstellt.

- [ ] **Step 4: SP7 — Speaker der Show-Dateien mit Kennung**

Vorher (eindeutig, Zeilen 177–179):
```js
function speakerListe() {
  return iveo.speakers.map((s) => ({ name: [s.first_name, s.last_name].filter(Boolean).join(' '), ...(s.title ? { title: s.title } : {}) }));
}
```
Nachher:
```js
/**
 * Speaker der Show-Datei genau so, wie der Launcher sie schreibt (SP7, 2b-Spec 5.2): über denselben Umwandler,
 * also mit Kennung `id` (Zweig A von M1) und in derselben Reihenfolge (M3). So schreibt die erste Abfrage nach
 * dem Öffnen nicht (Abschnitte 1 und 10e), und der Titler bildet seine Schlüssel von Anfang an aus der Kennung.
 */
function speakerListe() {
  return speakersToShowSpeakers(iveo.speakers);
}
```
Warum über den Umwandler statt `id: s.id` von Hand: Sortiert der Mapper nach M3 oder lässt er nach M1 die Kennung weg (Spec 23, Ergebnisse aus B2), schriebe die erste Abfrage nach dem Öffnen die Show neu, und die Prüfungen „1 · Abfragen mit gleichem Stand schreiben nicht“ und „10e“ würden rot. Mit Zweig A (M1 = ja) trägt jeder Speaker `id: s.id`, wie SP7 verlangt.

- [ ] **Step 5: `starte` nimmt den Titler aus `E2E_TITLER_DIR`**

Vorher (eindeutig, Zeilen 207–208):
```js
function starte(app, args = [], schalter = []) {
  const p = spawn(ELECTRON, [...schalter, join(REPO, 'apps', app), ...args], { env, stdio: 'ignore' });
```
Nachher:
```js
function starte(app, args = [], schalter = []) {
  const p = spawn(ELECTRON, [...schalter, appOrdner(app), ...args], { env, stdio: 'ignore' });
```

- [ ] **Step 6: Titler über DevTools, Bild-Messpunkt, Titler-Config**

Vorher (eindeutig, Zeile 302):
```js
// Steuer-Clients (open- oder secure-Modus wie die Tools: control.json in %APPDATA%).
```
Nachher:
```js
// Titler über DevTools (2b-Spec 9.6, 9e): nur lesen, das Vorschaubild im Bedienfenster.
let tlWs = null;
let tlNaechste = 1;
const tlWarten = new Map();
async function verbindeTitler() {
  const ziel = await bis(async () => {
    try {
      const l = await (await fetch(`http://127.0.0.1:${CDP_TITLER}/json/list`)).json();
      // Bedienfenster = index.html ohne ?view= (Recall-Board und 2. Bildschirm tragen view=recall bzw. view=output).
      return l.find((t) => t.type === 'page' && t.url.includes('index.html') && !t.url.includes('view=')) ?? null;
    } catch {
      return null;
    }
  }, 30_000, 300);
  if (!ziel) throw new Error('Titler-Fenster per DevTools nicht erreichbar');
  tlWs = new WebSocket(ziel.webSocketDebuggerUrl);
  await new Promise((r, f) => { tlWs.addEventListener('open', r, { once: true }); tlWs.addEventListener('error', f, { once: true }); });
  tlWs.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    const w = tlWarten.get(d.id);
    if (w) { tlWarten.delete(d.id); w(d); }
  });
  if (!(await bis(async () => (await tl("document.querySelector('canvas') !== null")) === true, 15_000))) {
    throw new Error('Vorschau-Canvas fehlt im Titler-Fenster');
  }
}
function tl(ausdruck, ms = 15_000) {
  return new Promise((ok, fehler) => {
    const id = tlNaechste++;
    const t = setTimeout(() => { tlWarten.delete(id); fehler(new Error(`DevTools-Frist (Titler): ${ausdruck.slice(0, 60)}`)); }, ms);
    tlWarten.set(id, (d) => {
      clearTimeout(t);
      if (d.result?.exceptionDetails) fehler(new Error(d.result.exceptionDetails.exception?.description ?? 'Fehler im Titler-Fenster'));
      else ok(d.result?.result?.value);
    });
    tlWs.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: ausdruck, returnByValue: true, awaitPromise: true } }));
  });
}
/** Messpunkt 9e: SHA-256 (hex) von toDataURL() des Vorschau-Canvas. Der Aufrufer wartet vorher 1,5 s nach der Aktion. */
async function bildHash() {
  const daten = await tl("document.querySelector('canvas').toDataURL()");
  if (typeof daten !== 'string' || !daten.startsWith('data:image/png')) throw new Error('Vorschau-Canvas liefert kein Bild');
  return createHash('sha256').update(daten).digest('hex');
}
/** Vorlage Bauchbinde mit {{name}} und {{funktion}} (9e): So zeigt das Vorschaubild den abgerufenen Speaker. */
function schreibeTitlerConfig() {
  mkdirSync(DEV('titler'), { recursive: true });
  const config = { template: 'lowerthird', name: '{{name}}', subtitle: '{{funktion}}' };
  writeFileSync(join(DEV('titler'), 'titler-config.json'), JSON.stringify(config, null, 2), 'utf8');
}

// Steuer-Clients (open- oder secure-Modus wie die Tools: control.json in %APPDATA%).
```
Hinweise:
- Das Bedienfenster lädt `index.html` ohne `?view=`; Recall-Board und 2. Bildschirm laden `?view=recall` bzw. `?view=output` (`apps/titler/src/main/index.ts:300`, `:352`). Der Vorschau-Canvas ist der einzige Canvas im DOM (`OperatorView.tsx:284`); der Offscreen-Canvas der Engine hängt nicht im DOM.
- Das Schachbrett hinter der Vorschau ist CSS (`.cg-checker`), nicht Teil des Canvas. Nach 1,5 s ist das Einblenden (450 ms) fertig, der Canvas zeigt dann ein ruhiges Bild.
- Der Hash wird in Node gebildet (`createHash` ist schon importiert), nicht im Fenster.

- [ ] **Step 7: Aufräumen schließt die Titler-Verbindung**

Vorher (eindeutig, Zeilen 343–344):
```js
  aufgeraeumt = true;
  try { timerSocket?.close(); } catch { /* schon zu */ }
```
Nachher:
```js
  aufgeraeumt = true;
  try { timerSocket?.close(); } catch { /* schon zu */ }
  try { tlWs?.close(); } catch { /* schon zu */ }
```

- [ ] **Step 8: `main()` — Bau-Prüfung über den Titler-Ordner, Titler-Config, Titler mit DevTools**

Vorher (eindeutig, Zeilen 368–373):
```js
  for (const app of ['launcher', 'timer', 'titler', 'rundown']) {
    if (!existsSync(join(REPO, 'apps', app, 'out', 'main', 'index.cjs'))) {
      console.log(`ABBRUCH: apps/${app} ist nicht gebaut — erst npm run build -w @jm/${app}.`);
      process.exit(2);
    }
  }
```
Nachher:
```js
  for (const app of ['launcher', 'timer', 'titler', 'rundown']) {
    if (!existsSync(join(appOrdner(app), 'out', 'main', 'index.cjs'))) {
      console.log(`ABBRUCH: ${appOrdner(app)} ist nicht gebaut — erst npm run build -w @jm/${app}.`);
      process.exit(2);
    }
  }
  if (process.env.E2E_TITLER_DIR) console.log(`GEGENPROBE: Titler aus ${TITLER_DIR}`);
```
Vorher (eindeutig, Zeilen 384–385):
```js
  legeBeiseite();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
```
Nachher:
```js
  legeBeiseite();
  schreibeTitlerConfig();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
```
`schreibeTitlerConfig()` läuft nach `legeBeiseite()`: Die vorhandene `titler-config.json` liegt dann schon als `.e2e-vorher` daneben und kommt beim Aufräumen zurück.

Vorher (eindeutig, Zeilen 394–398):
```js
  starte('titler', ['--show', SHOW1]);
  await starteRundown(['--show', SHOW1]);
  for (const port of [PORTS.timer, PORTS.titler, PORTS.rundown, PORTS.timerSocket]) {
    if (!(await warteAufPort(port, 60_000))) throw new Error(`Port ${port} kommt nicht hoch`);
  }
```
Nachher:
```js
  starte('titler', ['--show', SHOW1], [`--remote-debugging-port=${CDP_TITLER}`]);
  await starteRundown(['--show', SHOW1]);
  for (const port of [PORTS.timer, PORTS.titler, PORTS.rundown, PORTS.timerSocket]) {
    if (!(await warteAufPort(port, 60_000))) throw new Error(`Port ${port} kommt nicht hoch`);
  }
  await verbindeTitler();
```

- [ ] **Step 9: Abschnitt 9 wird zur Prüfung (mit Messpunkt A und Kontrolle 9e)**

Vorher (eindeutig, Zeilen 534–553):
```js
  console.log('\n— 9 · Titler-Messung (6.4): Bauchbinde auf Sendung, dann ein Speaker davor');
  launcherSt.sende('LAUNCHER SIDEEVENT'); // Tagesübersicht: Listen-Modus, alle Event-Speaker
  await bis(() => launcherSt.kv().iveo_side_event === '', 15_000);
  const vier = await bis(() => Number(titlerSt.kv().entry_count) === 4, 15_000);
  titlerSt.sende('TITLER RECALL 3');
  await bis(() => titlerSt.kv().entry === 'Alan', 5_000);
  titlerSt.sende('TITLER TAKE');
  await bis(() => titlerSt.kv().on_air === '1', 10_000);
  const vorher9 = { ...titlerSt.kv() };
  iveo.speakers.unshift({ id: 's-0', event_id: 'ev-e2e', first_name: 'Neu', last_name: '', title: 'Gast' });
  iveo.programs = iveo.programs.map((p) => (p.id === 'p-a' ? { ...p, updated_at: new Date().toISOString() } : p));
  const fuenf = await bis(() => Number(titlerSt.kv().entry_count) === 5, 15_000);
  await sleep(1_000); // der Titler liest seinen Datenordner entprellt neu
  const nachher9 = { ...titlerSt.kv() };
  console.log(
    `MESSUNG 6.4: auf Sendung vorher „${vorher9.entry}“ (Eintrag ${vorher9.entry_index}/${vorher9.entry_count}, on_air=${vorher9.on_air}), ` +
      `nach dem Einfügen „${nachher9.entry}“ (Eintrag ${nachher9.entry_index}/${nachher9.entry_count}, on_air=${nachher9.on_air}) ` +
      `→ Name wechselt auf Sendung: ${vorher9.entry !== nachher9.entry ? 'JA' : 'nein'}`,
  );
  pruefe('9 · Messung durchgeführt (Bauchbinde auf Sendung, Speaker-Liste von 4 auf 5)', !!vier && !!fuenf && vorher9.on_air === '1');
```
Nachher:
```js
  console.log('\n— 9 · Titler hält seinen Speaker (2b-Spec 9.6): Bauchbinde auf Sendung, dann ein Speaker davor; Bild 9e');
  launcherSt.sende('LAUNCHER SIDEEVENT'); // Tagesübersicht: Listen-Modus, alle Event-Speaker
  await bis(() => launcherSt.kv().iveo_side_event === '', 15_000);
  const vier = await bis(() => Number(titlerSt.kv().entry_count) === 4, 15_000);
  // Abruf über den Namen statt „RECALL 3“: Alans Stelle hängt davon ab, ob der Mapper sortiert (M3).
  titlerSt.sende('TITLER RECALL Alan');
  await bis(() => titlerSt.kv().entry === 'Alan', 5_000);
  titlerSt.sende('TITLER TAKE');
  await bis(() => titlerSt.kv().on_air === '1', 10_000);
  await sleep(1_500); // 9e: Messpunkt 1,5 s nach der Aktion (das Einblenden dauert 450 ms)
  const vorher9 = { ...titlerSt.kv() };
  const bildA = await bildHash(); // Messpunkt A: Alan auf Sendung
  pruefe('9 · vorher: Alan auf Sendung, Liste mit 4 Speakern', !!vier && vorher9.entry === 'Alan' && vorher9.on_air === '1',
    `„${vorher9.entry}“ Eintrag ${vorher9.entry_index}/${vorher9.entry_count}, on_air=${vorher9.on_air}`);
  // „Abel“ steht in der API vorn und sortiert auch nach dem Namen vor Alan: So kommt in jedem Fall ein Speaker davor (M3).
  iveo.speakers.unshift({ id: 's-0', event_id: 'ev-e2e', first_name: 'Abel', last_name: '', title: 'Gast' });
  iveo.programs = iveo.programs.map((p) => (p.id === 'p-a' ? { ...p, updated_at: new Date().toISOString() } : p));
  const fuenf = await bis(() => Number(titlerSt.kv().entry_count) === 5, 15_000);
  await sleep(1_500); // der Titler liest seinen Datenordner entprellt neu; danach 1,5 s wie in 9e
  const nachher9 = { ...titlerSt.kv() };
  console.log(
    `MESSUNG 9: auf Sendung vorher „${vorher9.entry}“ (Eintrag ${vorher9.entry_index}/${vorher9.entry_count}, on_air=${vorher9.on_air}), ` +
      `nach dem Einfügen „${nachher9.entry}“ (Eintrag ${nachher9.entry_index}/${nachher9.entry_count}, on_air=${nachher9.on_air})`,
  );
  pruefe('9 · Alan bleibt auf Sendung, nachdem ein Speaker davor eingefügt wurde (entry Alan, on_air 1)',
    !!fuenf && nachher9.entry === 'Alan' && nachher9.on_air === '1',
    `„${nachher9.entry}“ Eintrag ${nachher9.entry_index}/${nachher9.entry_count}, on_air=${nachher9.on_air}`);
  pruefe('9e · Bild nach dem Einfügen gleich A', (await bildHash()) === bildA);
  // Kontrolle, dass der Messpunkt einen Namenswechsel sehen kann (9e).
  titlerSt.sende('TITLER RECALL 2');
  await sleep(1_500);
  pruefe('9e · Kontrolle: TITLER RECALL 2 → Bild ungleich A', (await bildHash()) !== bildA, `entry „${titlerSt.kv().entry}“`);
  titlerSt.sende('TITLER RECALL Alan');
  await sleep(1_500);
  pruefe('9e · Kontrolle: TITLER RECALL Alan → Bild wieder gleich A', (await bildHash()) === bildA, `entry „${titlerSt.kv().entry}“`);
```
Zwei bewusste Änderungen am Ablauf von „9 wie heute“:
- `TITLER RECALL Alan` statt `TITLER RECALL 3`: Sortiert der Mapper (M3 = nein), steht Alan an Stelle 2, und `RECALL 3` brächte Grace auf Sendung. Ein Titler 0.9.0 löst auch den Namen einmal in eine Nummer auf und hält die Nummer (Spec 2.1 Nr. 2); die Gegenprobe bleibt also rot.
- Der eingefügte Speaker heißt „Abel“ statt „Neu“: Er steht in der API vorn und sortiert auch nach dem Namen vor Alan. „Neu“ landete bei M3 = nein hinter Hedy, nichts verschöbe sich, und die Gegenprobe würde nicht rot.

- [ ] **Step 10: Abschnitte 9b–9d am Ende von `main()`**

Vorher (eindeutig, Zeilen 715–718, Ende von Abschnitt 14 und von `main()`):
```js
      pruefe('14b · die Gedächtnis-Datei ist nach der Freigabe byte-gleich wie vorher', dateiHash(datei) === vorHash && !readFileSync(datei, 'utf8').includes('e2e-gesperrt'));
    }
  }
}
```
Nachher:
```js
      pruefe('14b · die Gedächtnis-Datei ist nach der Freigabe byte-gleich wie vorher', dateiHash(datei) === vorHash && !readFileSync(datei, 'utf8').includes('e2e-gesperrt'));
    }
  }

  console.log('\n— 9b–9d · Titler: Umschalten, Ausblenden, Umbenennen (2b-Spec 9.6), Bild wie in 9e');
  {
    // Vorbereitung: Launcher wieder auf Show 1, Tagesübersicht (Listen-Modus, alle Event-Speaker).
    const mZurueck = logMarke('launcher');
    starte('launcher', [`jmps://open?show=${encodeURIComponent(SHOW1)}`]); // zweite Instanz reicht den Deep-Link weiter
    pruefe('9b · Launcher hat Show 1 wieder geöffnet', await bis(() => logAb('launcher', mZurueck).includes(`Live-Polling für Event „${EVENT}" aktiv`), 20_000));
    launcherSt.sende('LAUNCHER SIDEEVENT');
    await bis(() => launcherSt.kv().iveo_side_event === '', 15_000);
    // Erst jetzt das dritte Side Event: verknüpft Ada und Grace, NICHT Alan (p-a und p-b bleiben ohne Verknüpfung).
    iveo.programs.push({
      id: 'p-c', event_id: 'ev-e2e', type_slug: 'side-event', title: 'Side Event C', starts_at_local: '2026-10-01T16:00:00',
      duration_minutes: 30, updated_at: new Date().toISOString(), speaker_ids: ['s-1', 's-2'],
    });
    iveo.agenda['p-c'] = [{ id: 'c-1', program_id: 'p-c', sort_order: 1, title: 'Gespräch', duration_minutes: 30 }];
    pruefe('9b · Show 1 enthält das neue Side Event p-c (Listen-Abfrage)', await bis(() => readFileSync(SHOW1, 'utf8').includes('"id": "p-c"'), 20_000));
    const alle = iveo.speakers.length;
    pruefe(`9b · Titler-Liste mit allen ${alle} Speakern`, await bis(() => Number(titlerSt.kv().entry_count) === alle, 15_000), `entry_count=${titlerSt.kv().entry_count}`);

    // 9b: Alan auf Sendung, dann auf p-c umschalten — dort fehlt Alan.
    titlerSt.sende('TITLER CLEAR');
    await sleep(2_000);
    titlerSt.sende('TITLER RECALL Alan');
    await bis(() => titlerSt.kv().entry === 'Alan', 5_000);
    titlerSt.sende('TITLER TAKE');
    await bis(() => titlerSt.kv().on_air === '1', 10_000);
    await sleep(1_500);
    pruefe('9b · vorher: Alan auf Sendung, Bild gleich A', titlerSt.kv().entry === 'Alan' && titlerSt.kv().on_air === '1' && (await bildHash()) === bildA);
    const mTitler9b = logMarke('titler');
    launcherSt.sende('LAUNCHER SIDEEVENT p-c');
    const zwei = await bis(() => Number(titlerSt.kv().entry_count) === 2, 20_000);
    await sleep(1_500);
    const kv9b = { ...titlerSt.kv() };
    pruefe('9b · Umschalten auf p-c: Liste mit den 2 verknüpften Speakern', !!zwei, `entry_count=${kv9b.entry_count}`);
    pruefe('9b · Alan bleibt auf Sendung, gehalten (entry Alan, entry_index 0)', kv9b.entry === 'Alan' && kv9b.entry_index === '0' && kv9b.on_air === '1',
      `„${kv9b.entry}“ Eintrag ${kv9b.entry_index}/${kv9b.entry_count}, on_air=${kv9b.on_air}`);
    pruefe('9b · Logzeile A2 im Titler-Log', logAb('titler', mTitler9b).includes('DataLink: aktiver Eintrag „Alan“ nicht mehr in der Liste, auf Sendung gehalten.'));
    pruefe('9b · Bild gleich A (die eingefrorenen Variablen erreichen das Bild)', (await bildHash()) === bildA);

    // 9c: Ausblenden → 1 s später kein Eintrag mehr; ein TAKE zeigt danach leere Platzhalter, nicht Alan.
    titlerSt.sende('TITLER CLEAR');
    await sleep(2_000);
    const kv9c = { ...titlerSt.kv() };
    pruefe('9c · nach dem Ausblenden kein Eintrag mehr (entry leer)', (kv9c.entry ?? '') === '' && kv9c.on_air === '0', `entry „${kv9c.entry}“, on_air=${kv9c.on_air}`);
    titlerSt.sende('TITLER TAKE');
    await sleep(1_500);
    pruefe('9c · TAKE danach zeigt nicht Alan (Bild ungleich A)', (await bildHash()) !== bildA);
    titlerSt.sende('TITLER CLEAR');
    await sleep(1_500);

    // 9d: zurück auf die Tagesübersicht, Grace auf Sendung; in iveo ändert sich ihre Funktion.
    launcherSt.sende('LAUNCHER SIDEEVENT');
    await bis(() => launcherSt.kv().iveo_side_event === '', 15_000);
    pruefe(`9d · Tagesübersicht: wieder alle ${alle} Speaker`, await bis(() => Number(titlerSt.kv().entry_count) === alle, 20_000), `entry_count=${titlerSt.kv().entry_count}`);
    titlerSt.sende('TITLER RECALL Grace');
    await bis(() => titlerSt.kv().entry === 'Grace', 5_000);
    titlerSt.sende('TITLER TAKE');
    await bis(() => titlerSt.kv().on_air === '1', 10_000);
    await sleep(1_500);
    const bildG = await bildHash(); // Messpunkt G: Grace mit der alten Funktion
    pruefe('9d · vorher: Grace auf Sendung', titlerSt.kv().entry === 'Grace' && titlerSt.kv().on_air === '1');
    iveo.speakers = iveo.speakers.map((s) => (s.id === 's-2' ? { ...s, title: 'Keynote (neu)' } : s));
    // Ohne Programmänderung holt der Listen-Modus die Speaker nicht (2b-Spec 2.3 Nr. 4): Muster wie in Abschnitt 9.
    iveo.programs = iveo.programs.map((p) => (p.id === 'p-a' ? { ...p, updated_at: new Date().toISOString() } : p));
    const anders = await bis(async () => (await bildHash()) !== bildG, 20_000, 1_500);
    await sleep(1_500);
    const kv9d = { ...titlerSt.kv() };
    pruefe('9d · Funktion auf Sendung aktualisiert, Name bleibt (entry Grace, Bild ungleich G)',
      !!anders && kv9d.entry === 'Grace' && kv9d.on_air === '1' && (await bildHash()) !== bildG,
      `„${kv9d.entry}“ Eintrag ${kv9d.entry_index}/${kv9d.entry_count}, on_air=${kv9d.on_air}`);
    titlerSt.sende('TITLER CLEAR');
  }
}
```
Was die Abschnitte voraussetzen:
- Abschnitt 8 hat im Launcher Show 2 geöffnet; der Deep-Link öffnet Show 1 wieder. Show 1 steht seit Abschnitt 9 auf der Tagesübersicht.
- `p-c` hat `speaker_ids` im Programm-Detail (`/programs/p-c`); daraus liest der Launcher die Verknüpfung (`extractSpeakerIds`, `packages/iveo/src/mapper.ts:222-240`). `p-a` und `p-b` bleiben ohne Verknüpfung, die Erwartungen der Abschnitte 1–8 ändern sich nicht.
- Der Titler bleibt die ganze Zeit an Show 1 (Deep-Link beim Start); ein RELOAD liest er aus seiner gemerkten Show.

- [ ] **Step 11: Syntax prüfen**

Run: `node --check apps/rundown/test/e2e-teil2a.mjs`
Expected: keine Ausgabe, Exit-Code 0.
Run: `grep -c "pruefe(" apps/rundown/test/e2e-teil2a.mjs`
Expected: `88` (die Definition und 87 Aufrufe; ein Lauf führt 84 davon aus, weil Abschnitt 12 nur einen von zwei Zweigen mit je drei Prüfungen nimmt).

Das Skript nicht ohne Freigabe starten: Schon beim Laden liest es `control.json` aus `%APPDATA%` (G11).

- [ ] **Step 12: Programme bauen, Electron-Programmdatei prüfen**

Run: `npm run build -w @jm/launcher -w @jm/timer -w @jm/rundown -w @jm/titler`
Expected: alle vier ohne Fehler; danach gibt es `apps/<app>/out/main/index.cjs` für launcher, timer, rundown und titler.

Der Durchgang startet die Programme mit `electron.exe`. Diese Datei lädt erst der Postinstall von `electron` herunter. Hat B1 Step 1 auf `npm ci --ignore-scripts` ausweichen müssen, fehlt sie im Worktree. Deshalb zuerst nachsehen:
```bash
ls node_modules/electron/dist/electron.exe
```
Expected: `node_modules/electron/dist/electron.exe`. Dann weiter mit Step 13.

Meldet `ls` stattdessen `No such file or directory`, den Postinstall von Hand nachholen (lädt Electron 33.4.11 aus dem Netz):
```bash
node node_modules/electron/install.js
ls node_modules/electron/dist/electron.exe
```
Expected: keine Fehlermeldung, danach der Pfad.

Scheitert auch das (etwa ohne Netz), nimmt der Durchgang die Electron-Programmdatei des Haupt-Checkouts, aber nur bei gleicher Version:
```bash
node -p "require('./node_modules/electron/package.json').version + ' / ' + require('C:/Users/alexk/alexzvn/node_modules/electron/package.json').version"
ls "C:/Users/alexk/alexzvn/node_modules/electron/dist/electron.exe"
```
Expected: `33.4.11 / 33.4.11` und der Pfad. Steps 15 und 17 nehmen diese Datei dann von selbst, weil sie im Worktree fehlt. Weichen die Versionen ab oder fehlt auch diese Datei, hier anhalten und der steuernden Sitzung melden.

- [ ] **Step 13: Freigabe einholen (G11)**

Der steuernden Sitzung melden: „B17 bereit für den Durchgang: legt Dev-Daten unter %APPDATA% (@jm\rundown, @jm\timer, @jm\titler, JM Production Suite\master-link.json) beiseite und stellt sie wieder her; braucht die Ports 7777, 8724, 8726, 8731, 8736, 8738, 9334, 9335 frei; Gegenprobe legt einen zweiten Worktree auf titler-v0.9.0 unter C:/Users/alexk/AppData/Local/Temp/jm-e2e-titler-090 an.“ Erst mit der Freigabe weitermachen. Ohne Freigabe hier anhalten, Steps 1–12 im Bericht nennen und nicht committen.

- [ ] **Step 14: Gegenprobe vorbereiten — Titler 0.9.0 bauen**

```bash
GEGEN="C:/Users/alexk/AppData/Local/Temp/jm-e2e-titler-090"
git worktree add --detach "$GEGEN" titler-v0.9.0
(cd "$GEGEN" && npm ci && npm run build -w @jm/titler)
ls "$GEGEN/apps/titler/out/main/index.cjs"
```
Expected: `Preparing worktree (detached HEAD …)` und `HEAD is now at …`; `npm ci` endet mit `added … packages`; `electron-vite build` mit `✓ built in …`; `ls` zeigt die Datei. Das dauert einige Minuten (eigenes `node_modules`).

Scheitert `npm ci` dort nur an einem nativen Postinstall, ohne Postinstalls installieren und bauen (der Worktree besteht schon):
```bash
GEGEN="C:/Users/alexk/AppData/Local/Temp/jm-e2e-titler-090"
(cd "$GEGEN" && npm ci --ignore-scripts && npm run build -w @jm/titler)
ls "$GEGEN/apps/titler/out/main/index.cjs"
```
Expected: wie oben, `ls` zeigt die Datei. Für den Bau reicht das. Die Gegenprobe startet den alten Titler mit der Electron-Programmdatei aus Step 12, nicht mit einer aus diesem Worktree; Titler 0.9.0 nutzt dieselbe Electron-Version 33.4.11 (`package-lock.json` am Tag).

- [ ] **Step 15: Gegenprobe laufen lassen (rot)**

Installierte Suite-Programme vorher beenden (das Skript prüft die Ports und bricht sonst mit `ABBRUCH: Port … belegt` ab).
```bash
GEGEN="C:/Users/alexk/AppData/Local/Temp/jm-e2e-titler-090"
ELEKTRON="C:/Users/alexk/alexzvn/.claude/worktrees/master-link-2b/node_modules/electron/dist/electron.exe"
[ -f "$ELEKTRON" ] || ELEKTRON="C:/Users/alexk/alexzvn/node_modules/electron/dist/electron.exe"   # Ausweg aus Step 12 (gleiche Version geprüft)
echo "Electron: $ELEKTRON"
E2E_TITLER_DIR="$GEGEN/apps/titler" ELECTRON_EXE="$ELEKTRON" node node_modules/tsx/dist/cli.mjs apps/rundown/test/e2e-teil2a.mjs 2>&1 | tee "$TEMP/e2e-2b-r1-gegenprobe.log"; echo "Exit: ${PIPESTATUS[0]}"
```
Expected:
- `Electron: …/electron.exe` (der Pfad aus Step 12)
- `GEGENPROBE: Titler aus C:\Users\alexk\AppData\Local\Temp\jm-e2e-titler-090\apps\titler`
- Abschnitte 1–7b grün, dann `ok   9 · vorher: Alan auf Sendung, Liste mit 4 Speakern`
- `FEHL 9 · Alan bleibt auf Sendung, nachdem ein Speaker davor eingefügt wurde (entry Alan, on_air 1) — „Grace“ Eintrag 3/5, on_air=1` (bei M3 = nein `„Ada“ Eintrag 2/5`)
- `FEHL 9e · Bild nach dem Einfügen gleich A`, weitere `FEHL` in 9b–9d
- am Ende `⟨k⟩/84 Prüfungen ok.` mit k < 84, `aufgeräumt: Prozesse beendet, Dev-Daten wiederhergestellt.` und `Exit: 1`

Endet der Lauf mit `ABBRUCH: …` statt mit der Zählzeile, ist die Gegenprobe nicht gelaufen: Meldung in den Bericht, Ursache mit `superpowers:systematic-debugging` suchen. Bricht er mit `ABBRUCH vor dem Start: … .e2e-vorher liegt noch da` ab, nichts in `%APPDATA%` anfassen, sondern der steuernden Sitzung melden.

- [ ] **Step 16: Gegenprobe-Worktree entfernen**

```bash
git worktree remove --force "C:/Users/alexk/AppData/Local/Temp/jm-e2e-titler-090"
git worktree prune
git worktree list
```
Expected: `git worktree list` nennt `jm-e2e-titler-090` nicht mehr.

- [ ] **Step 17: Durchgang gegen den neuen Build (grün)**

```bash
ELEKTRON="C:/Users/alexk/alexzvn/.claude/worktrees/master-link-2b/node_modules/electron/dist/electron.exe"
[ -f "$ELEKTRON" ] || ELEKTRON="C:/Users/alexk/alexzvn/node_modules/electron/dist/electron.exe"   # Ausweg aus Step 12 (gleiche Version geprüft)
echo "Electron: $ELEKTRON"
ELECTRON_EXE="$ELEKTRON" node node_modules/tsx/dist/cli.mjs apps/rundown/test/e2e-teil2a.mjs 2>&1 | tee "$TEMP/e2e-2b-r1.log"; echo "Exit: ${PIPESTATUS[0]}"
```
Expected: zuerst `Electron: …/electron.exe` (der Pfad aus Step 12), dann beginnen alle Prüfzeilen mit `ok  `, darunter
```
ok   9 · Alan bleibt auf Sendung, nachdem ein Speaker davor eingefügt wurde (entry Alan, on_air 1) — „Alan“ Eintrag 4/5, on_air=1
ok   9e · Bild nach dem Einfügen gleich A
ok   9e · Kontrolle: TITLER RECALL 2 → Bild ungleich A — entry „Ada“
ok   9b · Alan bleibt auf Sendung, gehalten (entry Alan, entry_index 0) — „Alan“ Eintrag 0/2, on_air=1
ok   9b · Logzeile A2 im Titler-Log
ok   9c · nach dem Ausblenden kein Eintrag mehr (entry leer) — entry „“, on_air=0
ok   9d · Funktion auf Sendung aktualisiert, Name bleibt (entry Grace, Bild ungleich G) — „Grace“ Eintrag 3/5, on_air=1
```
(bei M3 = nein stehen Alan auf `3/5` und Grace auf `4/5`), dazu die Zeile `MESSUNG 9: …`, am Ende `84/84 Prüfungen ok.`, `aufgeräumt: Prozesse beendet, Dev-Daten wiederhergestellt.` und `Exit: 0`.

Bei `FEHL`: Ursache mit `superpowers:systematic-debugging` suchen und in der Aufgabe beheben, der der Code gehört (B3–B16, mit Test dort), neu bauen (Step 12), Step 17 wiederholen. Eine Prüfung im Skript wird nur geändert, wenn sie nachweislich etwas anderes prüft als Spec 9.6 verlangt; das kommt begründet in den Bericht. Ist nur ein Bildvergleich rot und ändert sich der Hash bei gleichem Inhalt (z. B. zwei Messungen von Alan hintereinander verschieden), ist das ein Befund für den Bericht; die Prüfung wird nicht aufgeweicht (Gerüst, Unklarheiten).

- [ ] **Step 18: Bericht**

In den Aufgabenbericht: aus `$TEMP/e2e-2b-r1.log` alle Zeilen ab `— 9 ·` und die Zählzeile, aus `$TEMP/e2e-2b-r1-gegenprobe.log` alle `FEHL`-Zeilen, die Zeile `MESSUNG 9: …` und die Zählzeile. Ein Satz zur Gegenprobe („Titler 0.9.0: Abschnitt 9 rot, auf Sendung wechselt Alan zu …“) für den PR-Text. Keine Datei im Repo dafür anlegen.

- [ ] **Step 19: Commit**

```bash
git status --short
```
Erwartet genau ` M apps/rundown/test/e2e-teil2a.mjs` (die Builds unter `out/` sind ignoriert, der Durchgang hat aufgeräumt). Zeigt er mehr, nicht committen, sondern melden.
```bash
git add apps/rundown/test/e2e-teil2a.mjs
git status --short
```
Erwartet genau `M  apps/rundown/test/e2e-teil2a.mjs`. Dann (Commit-Text bewusst ohne Umlaute):
```bash
git commit -m "test(rundown): Durchgang prueft, dass der Titler seinen Speaker haelt (Teil 2b, 9.6)" -m "Abschnitt 9 wird von der Messung zur Pruefung (entry Alan, on_air 1 nach dem Einfuegen). Neu 9b-9d: Umschalten auf ein Side Event ohne Alan, Ausblenden, Umbenennen; Bildvergleich ueber die SHA-256 des Vorschau-Canvas (DevTools auf 9335). Speaker der Show-Dateien ueber speakersToShowSpeakers (SP7). Gegenprobe gegen Titler 0.9.0 ueber E2E_TITLER_DIR: Abschnitt 9 rot." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
1. SP7 über `speakersToShowSpeakers` statt `id: s.id` von Hand (Step 4): Die Show-Dateien entsprechen so genau dem, was der Launcher schreibt, in beiden Zweigen von M1 und M3. Mit Zweig A ist das Ergebnis dasselbe wie `id: s.id`.
2. Abschnitt 9 ruft Alan über den Namen ab, und der eingefügte Speaker heißt „Abel“ statt „Neu“ (Step 9). Beides hält den Durchgang und die Gegenprobe unabhängig von M3.
3. Zusätzliche Prüfungen außer den in 9.6 genannten: „9 · vorher“, „9b · Launcher hat Show 1 wieder geöffnet“, „9b · Show 1 enthält das neue Side Event p-c“, „9b · Titler-Liste mit allen … Speakern“, „9b · vorher“, „9b · Umschalten auf p-c: Liste mit den 2 verknüpften Speakern“, „9d · Tagesübersicht: wieder alle … Speaker“, „9d · vorher“. Sie zeigen bei einem roten Lauf, an welcher Vorbedingung es lag.
4. 9e ist kein eigener Abschnitt: Messpunkt A und die Kontrolle `RECALL 2` / `RECALL Alan` stehen in Abschnitt 9, der Bildvergleich in 9b–9d nutzt A bzw. G.
5. Die Zeile `MESSUNG 6.4` heißt jetzt `MESSUNG 9` und steht weiter im Log; sie nennt kein „Name wechselt“ mehr, das prüft jetzt `pruefe`.
6. Geprüft an einer Kopie des Worktrees: alle Vorher-Texte treffen genau einmal (gegen Stand `996f54e2b8`), `node --check` grün, Laden der Module mit tsx grün (Lauf mit umgeleitetem `APPDATA` bis `ABBRUCH: … nicht gebaut`). Der Durchgang selbst ist nicht gelaufen (G11).
7. Step 12 prüft `electron.exe` vor dem Durchgang (nach der Prüfung ergänzt): B1 darf auf `npm ci --ignore-scripts` ausweichen, dann fehlt die Datei im Worktree. Ausweg 1 ist der Postinstall von Hand, Ausweg 2 die Datei des Haupt-Checkouts bei gleicher Version. Steps 15 und 17 nehmen die Datei aus dem Worktree, sonst die des Haupt-Checkouts. Step 14 nennt `npm ci --ignore-scripts` als Ausweg für den Gegenprobe-Worktree, denn dort wird nur gebaut.

---

### Task 18: B18 · Abnahme-Datei R1, Doku „Grenzen“, Versionen, Changelog, Release-Vorbereitung ohne Push

**Spec:** 10 (Abnahme, wortgetreu), 11 (Release: Versionen, Changelog, Release-Notes, Doku, Tags einzeln, alles Weitere erst nach Freigabe); G12, G13.

Worum es geht:
- 10: „`apps/titler/ABNAHME-2b-R1.md`, je Schritt mit Ergebnisspalte. In iveo wird nichts geschrieben.“ – „Die noch offene 2a-Abnahme (`apps/rundown/ABNAHME-2a.md`) läuft im selben Termin, vor den Schritten dieser Tabelle. Release 1 wartet nicht auf sie.“
- 11: „Titler **0.10.0**, Launcher **0.14.0**, Rundown **0.7.0**.“ – „Changelog … ohne ASCII-Anführungszeichen in Texten.“ – „Release-Notes nennen: Rundown 0.7.0 ruft Speaker über die Kennung ab, wenn der Titler 0.10.0 läuft, sonst über den Namen. Der Titler überschreibt den eigenen DataLink-Ordner nicht mehr; ein von einer Show eingetragener Ordner `iveo-data` wird einmalig geleert (7.7). Ein Abruf ohne Treffer lässt nicht mehr den vorherigen Speaker aktiv. Neu für Companion: `TITLER RECALL @⟨Kennung⟩ ⟨Name⟩`.“ – 7.7: „Ein Rückweg auf Titler 0.9.0 findet `dataFolder` leer und zeigt bis zur nächsten Show keine Liste. Das steht in den Release-Notes.“
- 11: „**Doku:** `docs/jm-show.md:226-229` („Grenzen“) bekommt den Titler-Absatz: Die Bauchbinde hält ihre Person. `TITLER RECALL <nr>` bleibt nummernbasiert.“

**Arbeitsverzeichnis:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b`, Branch `feat/master-link-teil2b`. Alle Pfade relativ dazu. Voraussetzung: B1–B17 sind committet.

**Dateien:**
- Create: `apps/titler/ABNAHME-2b-R1.md`
- Modify: `docs/jm-show.md:226-231` (Absatz „Grenzen“; davor neuer Absatz „Titler hält seinen Speaker“)
- Modify: `apps/titler/package.json:2-3`, `apps/launcher/package.json:2-3`, `apps/rundown/package.json:2-3` (Versionen)
- Modify: `package-lock.json:291-293` (launcher), `:544-546` (rundown), `:734-736` (titler)
- Modify: `packages/suite-manifest/changelog.json`: je ein neuer erster Eintrag unter `launcher` (`:22-26`), `titler` (`:1045-1049`), `rundown` (`:1330-1334`)
- Nicht anfassen: `packages/suite-manifest/suite.json` (`latestVersion` zieht nach dem Release der GitHub-Bot nach).

**Interfaces:**
- Consumes: grüner Stand B1–B17; der Bericht aus B17 (Zählzeile des Durchgangs, `FEHL`-Zeilen der Gegenprobe gegen Titler 0.9.0).
- Produces: Titler **0.10.0**, Launcher **0.14.0**, Rundown **0.7.0** in `package.json` und `package-lock.json`; drei Changelog-Einträge; `apps/titler/ABNAHME-2b-R1.md`. Kein Tag, kein Push, kein PR.

Was zu wissen ist:
- G12: keine ASCII-Anführungszeichen (`"`) in den Changelog-Texten; deutsche „…“ sind erlaubt (wie im Eintrag Launcher 0.13.1). Vor dem Commit JSON prüfen (Step 7).
- Zeilennummern im `package-lock.json` gelten für den Stand vor B8. B8 ergänzt beim Titler nur `devDependencies` hinter der Versionszeile; die drei Vorher-Texte unten bleiben eindeutig.
- G15: alle Dateien liegen mit CRLF vor; Änderungen mit dem Edit-Werkzeug. Neue Datei mit dem Write-Werkzeug.
- Das Datum der Changelog-Einträge ist der Tag der Vorbereitung: `node -e "console.log(new Date().toISOString().slice(0,10))"`. Unten steht `2026-10-02`; ist heute ein anderer Tag, in allen drei Einträgen diesen Tag eintragen.

- [ ] **Step 1: Vorbedingung — alles grün**

Run:
```bash
npm run selftest -w @jm/iveo && npm run selftest:iveo -w @jm/launcher && npm run selftest -w @jm/launcher && npm run selftest:verbund -w @jm/launcher && npm run selftest -w @jm/titler && npm run selftest -w @jm/rundown && npm run selftest -w @jm/timer
```
Expected: jeder Lauf ohne `FAIL` und mit Exit-Code 0 (Rundown endet zweimal mit `ALLE TESTS OK`). Der Bericht von B17 nennt `84/84 Prüfungen ok.` und für die Gegenprobe `FEHL 9 · Alan bleibt auf Sendung …`. Fehlt eins davon, hier nicht weitermachen, sondern in der Aufgabe beheben, der der Fehler gehört.

- [ ] **Step 2: `apps/titler/ABNAHME-2b-R1.md` anlegen (ganzer Inhalt, Tabelle wortgetreu nach Spec 10)**

```markdown
# Abnahme Master-Link Teil 2b, Release 1 (Owner, ein Rechner, echtes iveo-Event auf Prod)

Spec: `docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md`, Abschnitt 10.

**Voraussetzungen:**
- Die noch offene 2a-Abnahme (`apps/rundown/ABNAHME-2a.md`) läuft im selben Termin, vor den Schritten dieser Tabelle. Release 1 wartet nicht auf sie.
- In iveo wird nichts geschrieben.
- Schritt 12 nur mit einem unveröffentlichten Test-Speaker.

| # | Schritt | Erwartung | Ergebnis / Datum |
| --- | --- | --- | --- |
| 1 | Launcher 0.14.0, Titler 0.10.0, Rundown 0.7.0 installieren | Versionen im Launcher sichtbar | |
| 2 | Im Titler eine Vorlage mit `{{name}}` und `{{funktion}}` wählen. Eine Bestands-Show mit iveo öffnen (vor dem Update gespeichert, ihre Speaker haben noch keine Kennung). Einen Speaker abrufen, TAKE. Dann im Panel die Tagesübersicht wählen; das schreibt die Kennungen nach (5.3). | Daten / Recall zeigt „Quelle: Show „⟨Show⟩“ · ⟨n⟩ Speaker“. Dieselbe Person bleibt auf Sendung, **kein** Hinweis „nicht mehr in der Liste“ (Brücke, 7.3). Log: „… hält seinen Eintrag, Schlüssel wechselt …“ | |
| 3 | Ein Side Event suchen, mit dem iveo Speaker verknüpft (beim Umschalten kommt **keine** Meldung „verknüpft keine Speaker“). Zurück auf die Tagesübersicht, einen Speaker abrufen, der dort **nicht** verknüpft ist. TAKE. | Bauchbinde zeigt ihn | |
| 4 | Im Panel auf dieses Side Event umschalten | Dieselbe Person bleibt auf Sendung, Hinweis „… ist nicht mehr in der Liste. Die Bauchbinde bleibt stehen …“ | |
| 5 | Ausblenden | Nach etwa 1 s Hinweis „… Bitte einen Eintrag abrufen.“ | |
| 6 | Zurück auf die Tagesübersicht, einen Speaker abrufen, TAKE, dann auf ein Side Event umschalten, das ihn verknüpft | Dieselbe Person bleibt, ohne Hinweis | |
| 7 | Im Rundown an eine Zeile „Titler · Eintrag abrufen“ hängen, im Picker einen Speaker wählen, GO | Die richtige Person wird abgerufen. Chip zeigt den Namen. | |
| 8 | Titler schließen und über die **Kachel** neu starten | Liste und Quelle wie vorher. Die nächste Umschaltung im Panel kommt an. | |
| 9 | Im Titler einen eigenen DataLink-Ordner mit einer CSV wählen | Quelle „eigener Ordner“. Die Show-Liste ist weg. | |
| 10 | Show erneut öffnen, dann „Zurück zum eigenen Ordner“ | erst Quelle Show, dann wieder der eigene Ordner mit der CSV | |
| 11 | Companion: `TITLER RECALL 2` und Weiter | wie bisher über die Nummer | |
| 11b | Companion: `TITLER RECALL Niemand` (ein Name, den die Liste nicht hat), ohne Sendung, dann TAKE | Hinweis „Abruf „Niemand“: nicht in der Liste …“; die Bauchbinde zeigt **nicht** den vorher aktiven Speaker | |
| 12 (optional) | Nur mit einem unveröffentlichten Test-Speaker und im **Listen-Modus** (Tagesübersicht): dessen Funktion in iveo ändern, während er auf Sendung ist, auf die nächste Programmänderung warten. Im Agenda-Modus kommen Speaker-Änderungen nie an (2.3, Nr. 5). | Funktion auf Sendung wechselt, Name bleibt. Zeigt der Titler stattdessen „… ist nicht mehr in der Liste“, hat iveo die ID beim Bearbeiten gewechselt (M1 b). | |
```
Prüfen: `grep -c "^| " apps/titler/ABNAHME-2b-R1.md` → `15` (Kopf, Trennzeile, 13 Schritte: 1–11, 11b, 12).

- [ ] **Step 3: Doku — `docs/jm-show.md`, Absatz „Grenzen“**

Vorher (eindeutig, Zeilen 226–231, Dateiende):
```markdown
**Grenzen.** Das gilt am Einzelplatz: Tools auf einem anderen Rechner lesen
weiter ihre eigene Show-Datei (folgt mit Master-Link Teil 2b). Sprünge aus
Companion (`RUNDOWN GOTO n`, `TIMER GOTO n`) und `TITLER RECALL <nr>` bleiben
nummernbasiert. Wird eine Show-Datei umbenannt oder verschoben, beginnt der
Rundown für sie neu. Ein älterer Rundown (bis 0.5), der eine neue `.jmrundown`
speichert, verliert deren Archiv und Markierungen.
```
Nachher:
```markdown
**Titler hält seinen Speaker.** Seit Titler 0.10.0, Launcher 0.14.0 und
Rundown 0.7.0 trägt jeder Speaker der Show seine iveo-Kennung. Die Bauchbinde
hält ihre Person, nicht ihre Nummer in der Liste: Kommt in iveo ein Speaker
davor dazu oder schaltet der Launcher auf ein anderes Side Event um, bleibt
dieselbe Person auf Sendung, und Korrekturen aus iveo erscheinen sofort. Fehlt
die Person in der neuen Liste, bleibt die Bauchbinde stehen, bis man sie
ausblendet oder einen Eintrag abruft; Daten / Recall zeigt dazu einen Hinweis.
Ein Abruf ohne Treffer lässt nie still den vorherigen Speaker aktiv. Der
Rundown ruft Speaker über die Kennung ab (`TITLER RECALL @⟨Kennung⟩ ⟨Name⟩`),
wenn der Titler das versteht, sonst über den aktuellen Namen. Eine Show
überschreibt den eigenen DataLink-Ordner des Titlers nicht mehr; „Zurück zum
eigenen Ordner“ in den Einstellungen führt zu ihm zurück. Ist die Speakerliste
von iveo nicht abrufbar, behält die Show ihre Speaker; Panel und Titler sagen
dann „aus früherem Stand“.

**Grenzen.** Das gilt am Einzelplatz: Tools auf einem anderen Rechner lesen
weiter ihre eigene Show-Datei (folgt mit Release 2 von Master-Link Teil 2b).
Sprünge aus Companion (`RUNDOWN GOTO n`, `TIMER GOTO n`) sowie
`TITLER RECALL <nr>`, Weiter und Zurück im Titler bleiben nummernbasiert. Wird
eine Show-Datei umbenannt oder verschoben, beginnt der Rundown für sie neu. Ein
älterer Rundown (bis 0.5), der eine neue `.jmrundown` speichert, verliert deren
Archiv und Markierungen.
```
Der Absatz „Grenzen“ bleibt inhaltlich, ergänzt um Weiter/Zurück im Titler; „folgt mit Master-Link Teil 2b“ wird zu „folgt mit Release 2 von Master-Link Teil 2b“, denn Release 1 ändert am Mehrrechner-Betrieb nichts.

- [ ] **Step 4: Versionen in den drei `package.json`**

`apps/titler/package.json`, Vorher (Zeilen 2–3):
```json
  "name": "@jm/titler",
  "version": "0.9.0",
```
Nachher:
```json
  "name": "@jm/titler",
  "version": "0.10.0",
```
`apps/launcher/package.json`, Vorher (Zeilen 2–3):
```json
  "name": "@jm/launcher",
  "version": "0.13.1",
```
Nachher:
```json
  "name": "@jm/launcher",
  "version": "0.14.0",
```
`apps/rundown/package.json`, Vorher (Zeilen 2–3):
```json
  "name": "@jm/rundown",
  "version": "0.6.0",
```
Nachher:
```json
  "name": "@jm/rundown",
  "version": "0.7.0",
```

- [ ] **Step 5: Versionen in `package-lock.json`**

Vorher (eindeutig, Zeilen 291–293):
```json
    "apps/launcher": {
      "name": "@jm/launcher",
      "version": "0.13.1",
```
Nachher:
```json
    "apps/launcher": {
      "name": "@jm/launcher",
      "version": "0.14.0",
```
Vorher (eindeutig, Zeilen 544–546):
```json
    "apps/rundown": {
      "name": "@jm/rundown",
      "version": "0.6.0",
```
Nachher:
```json
    "apps/rundown": {
      "name": "@jm/rundown",
      "version": "0.7.0",
```
Vorher (eindeutig, Zeilen 734–736):
```json
    "apps/titler": {
      "name": "@jm/titler",
      "version": "0.9.0",
```
Nachher:
```json
    "apps/titler": {
      "name": "@jm/titler",
      "version": "0.10.0",
```
Andere Zeilen mit `0.13.1`, `0.6.0` oder `0.9.0` im Lockfile gehören zu fremden Paketen (z. B. `type-fest`, `deep-extend`) und bleiben.

- [ ] **Step 6: Changelog — `packages/suite-manifest/changelog.json`**

Ersetzung 1 (`launcher`), Vorher (eindeutig, Zeilen 22–26):
```json
    "app": "launcher",
    "name": "JM Production Suite",
    "entries": [
      {
        "version": "0.13.1",
```
Nachher:
```json
    "app": "launcher",
    "name": "JM Production Suite",
    "entries": [
      {
        "version": "0.14.0",
        "date": "2026-10-02",
        "notes": [
          "Die Show trägt jetzt die iveo-Kennung jedes Speakers. Titler 0.10.0 und Rundown 0.7.0 halten ihren Speaker darüber, auch wenn sich die Liste verschiebt. Bestehende Shows bekommen die Kennungen einmalig mit der nächsten iveo-Änderung im Ablauf, beim Umschalten im Side-Events-Panel oder beim Binden.",
          "Ist die Speakerliste von iveo nicht abrufbar, behält die Show ihre Speaker, und „Verantwortlich“ im Ablauf bleibt erhalten. Bisher galt ein solcher Fehler als keine Speaker. Das Side-Events-Panel zeigt dann „iveo-Abgleich gestört: Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand“ mit Uhrzeit, der Titler einen Hinweis.",
          "Solange die Speakerliste fehlt, fragt der Launcher bei jeder Abfrage erneut nach. Kommt sie wieder, aktualisiert er die Speaker von selbst, und das Panel meldet den Abgleich wieder in Ordnung."
        ]
      },
      {
        "version": "0.13.1",
```
Ersetzung 2 (`titler`), Vorher (eindeutig, Zeilen 1045–1049):
```json
    "app": "titler",
    "name": "JM Titler",
    "entries": [
      {
        "version": "0.9.0",
```
Nachher:
```json
    "app": "titler",
    "name": "JM Titler",
    "entries": [
      {
        "version": "0.10.0",
        "date": "2026-10-02",
        "notes": [
          "Die Bauchbinde hält ihre Person: Der Titler merkt sich den abgerufenen Speaker über seine iveo-Kennung statt über die Nummer in der Liste. Kommt in iveo ein Speaker davor dazu oder schaltet der Launcher auf ein anderes Side Event um, bleibt dieselbe Person auf Sendung. Korrekturen aus iveo, etwa an der Funktion, erscheinen sofort.",
          "Fehlt die Person auf Sendung in der neuen Liste, bleibt die Bauchbinde stehen, bis sie ausgeblendet oder ein Eintrag abgerufen wird. Daten / Recall und das Recall-Board zeigen dazu einen Hinweis. Nach dem Ausblenden ist kein Eintrag mehr aktiv, ein folgendes Take bringt die Person also nicht zurück.",
          "Ein Abruf ohne Treffer lässt nicht mehr den vorherigen Speaker aktiv, auch nicht eine Nummer außerhalb der Liste. Der Titler zeigt dazu einen Hinweis.",
          "Der Titler überschreibt den eigenen DataLink-Ordner nicht mehr. Speaker aus einer Show liest er getrennt davon, Daten / Recall zeigt die Quelle, und „Zurück zum eigenen Ordner“ in den Einstellungen führt zur eigenen Liste zurück. Steht als DataLink-Ordner noch der Ordner iveo-data, den eine frühere Show eingetragen hat, wird diese Einstellung einmalig geleert; die Speaker dieser Show bleiben bis zur nächsten Show sichtbar.",
          "Der Titler merkt sich die zuletzt angewendete Show. Nach einem Neustart über die Launcher-Kachel sind Liste und Quelle wie vorher, und ein Neu-Laden aus dem Launcher kommt wieder an.",
          "Meldet die Show, dass die Speakerliste von iveo nicht abrufbar war, zeigt der Titler „Liste aus früherem Stand“ mit der Uhrzeit.",
          "Neu für Companion: TITLER RECALL @⟨Kennung⟩ ⟨Name⟩ ruft einen Speaker über seine iveo-Kennung ab, mit dem Namen als Rückfall. TITLER RECALL mit Nummer, Weiter und Zurück bleiben nummernbasiert.",
          "Rundown 0.7.0 ruft Speaker über die Kennung ab, wenn Titler 0.10.0 läuft, sonst über den Namen.",
          "Ein Rückweg auf Titler 0.9.0 zeigt bis zur nächsten Show keine Liste."
        ]
      },
      {
        "version": "0.9.0",
```
Ersetzung 3 (`rundown`), Vorher (eindeutig, Zeilen 1330–1334):
```json
    "app": "rundown",
    "name": "JM Rundown",
    "entries": [
      {
        "version": "0.6.0",
```
Nachher:
```json
    "app": "rundown",
    "name": "JM Rundown",
    "entries": [
      {
        "version": "0.7.0",
        "date": "2026-10-02",
        "notes": [
          "Der Speaker-Picker an einer Aktion „DataLink-Eintrag abrufen“ für den JM Titler bindet jetzt über die iveo-Kennung. Mit Titler 0.10.0 ruft der Rundown den Speaker beim GO über die Kennung ab, mit älteren Titlern über den aktuellen Namen.",
          "Benennt iveo einen Speaker um, zeigen Liste und Vorschau den neuen Namen, und gesendet wird der neue Name. Fehlt die Kennung in der Speakerliste der Show, steht an der Aktion „nicht in der Speaker-Liste“.",
          "Ältere Aktionen ohne Kennung rufen weiter über den Namen ab und stehen im Picker als „per Name (nicht gebunden)“; gebunden wird erst durch eine Auswahl. Wer Rolle, Aktion oder den Namen von Hand ändert, löst die Bindung."
        ]
      },
      {
        "version": "0.6.0",
```
Die Punkte der Release-Notes aus Spec 11 stehen so: Rundown über die Kennung mit Titler 0.10.0 (Titler Punkt 8, Rundown Punkt 1); eigener DataLink-Ordner, `iveo-data` einmalig geleert (Titler Punkt 4); Abruf ohne Treffer (Titler Punkt 3); `TITLER RECALL @⟨Kennung⟩ ⟨Name⟩` (Titler Punkt 7); Rückweg auf 0.9.0 (Titler Punkt 9); Abruffehler der Speakerliste (Launcher Punkt 2).

- [ ] **Step 7: Prüfen (JSON, Versionen, keine ASCII-Anführungszeichen, Typecheck)**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8'))"
node -e "const c=require('./packages/suite-manifest/changelog.json');const soll={launcher:'0.14.0',titler:'0.10.0',rundown:'0.7.0'};for(const [app,v] of Object.entries(soll)){const e=c.find(x=>x.app===app).entries[0];if(e.version!==v)throw new Error(app+' '+e.version);if(e.notes.some(n=>n.includes('\"')))throw new Error(app+': ASCII-Anführungszeichen');}const p=(f)=>require('./'+f).version;const l=require('./package-lock.json').packages;if(p('apps/titler/package.json')!=='0.10.0'||p('apps/launcher/package.json')!=='0.14.0'||p('apps/rundown/package.json')!=='0.7.0')throw new Error('package.json');if(l['apps/titler'].version!=='0.10.0'||l['apps/launcher'].version!=='0.14.0'||l['apps/rundown'].version!=='0.7.0')throw new Error('package-lock.json');console.log('Release-Vorbereitung ok')"
npm run typecheck -w @jm/titler -w @jm/launcher -w @jm/rundown
git diff --stat
```
Expected: erster Befehl ohne Ausgabe und Exit-Code 0 (JSON gültig); zweiter `Release-Vorbereitung ok`; Typecheck aller drei Apps ohne Fehler; `git diff --stat` nennt genau `apps/launcher/package.json`, `apps/rundown/package.json`, `apps/titler/package.json`, `docs/jm-show.md`, `package-lock.json`, `packages/suite-manifest/changelog.json` (die neue Abnahme-Datei ist noch nicht im Index und erscheint erst in Step 8).

- [ ] **Step 8: Commit**

```bash
git add apps/titler/ABNAHME-2b-R1.md docs/jm-show.md apps/titler/package.json apps/launcher/package.json apps/rundown/package.json package-lock.json packages/suite-manifest/changelog.json
git status --short
```
Erwartet genau diese sieben Pfade und sonst nichts:
```
M  apps/launcher/package.json
M  apps/rundown/package.json
A  apps/titler/ABNAHME-2b-R1.md
M  apps/titler/package.json
M  docs/jm-show.md
M  package-lock.json
M  packages/suite-manifest/changelog.json
```
Dann (Commit-Text bewusst ohne Umlaute):
```bash
git commit -m "release(suite): Titler 0.10.0, Launcher 0.14.0, Rundown 0.7.0 - Master-Link Teil 2b, Release 1" -m "Abnahme-Datei apps/titler/ABNAHME-2b-R1.md nach Spec 10 (die 2a-Abnahme laeuft im selben Termin davor), Doku-Absatz Titler haelt seinen Speaker in docs/jm-show.md, Versionen in package.json und package-lock.json, Changelog-Eintraege fuer launcher, titler und rundown. Kein Tag, kein Push." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Stand melden — NICHT pushen**

Run: `git log --oneline -20` und `git status --short`.
Im Aufgabenbericht nennen: die Commits von B1–B18, dass nichts gepusht ist, und die Schritte nach der Freigabe durch den Owner (nicht ausführen):
1. `git push -u origin feat/master-link-teil2b`, PR „Master-Link Teil 2b, Release 1: Titler hält seinen Speaker“ mit dem Ergebnis des Durchgangs (B17) und der Gegenprobe gegen Titler 0.9.0 im PR-Text.
2. Nach dem Merge die Tags **einzeln** pushen (mehr als drei Tags in einem Push lösen keine Workflows aus): `titler-v0.10.0`, dann `launcher-v0.14.0`, dann `rundown-v0.7.0`.
3. Abnahme nach `apps/titler/ABNAHME-2b-R1.md` durch den Owner, im selben Termin nach der 2a-Abnahme (`apps/rundown/ABNAHME-2a.md`).

**Abweichungen vom Gerüst:**
1. Ein Commit für die ganze Aufgabe (G13) statt der zwei Commits von A18 in 2a.
2. Die Release-Notes nennen außer den Punkten aus Spec 11 auch, was ein Bediener merkt: Hinweise im Titler, gemerkte Show nach Neustart über die Kachel, Hinweis „Liste aus früherem Stand“, Picker-Anzeige im Rundown.
3. Der Doku-Absatz steht vor „Grenzen“ als eigener Absatz „Titler hält seinen Speaker“; „Grenzen“ nennt zusätzlich Weiter und Zurück und verweist für den Mehrrechner-Betrieb auf Release 2.
4. Geprüft an Kopien der Dateien (Stand `996f54e2b8`): alle Vorher-Texte treffen genau einmal; nach den Ersetzungen ist `changelog.json` gültiges JSON, die Prüfung aus Step 7 meldet `Release-Vorbereitung ok`, die 13 Tabellenzeilen der Abnahme sind wortgleich mit Spec 10 (plus leere Ergebnisspalte).
