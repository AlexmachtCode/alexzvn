# Bericht B13 · Titler-Main verdrahten

BASE `0e49026a0263bd191ce1d0590b8aea21ca627925`, HEAD `67c22695c783e6c1e598be60e7b26ff84413a79e`
Commit: `67c22695c7 feat(titler): DataLink ueber den Schluessel-Kern, Datenquelle und gemerkte Show (Teil 2b)`

## Umgesetzt
Alle Steps 1-14 des Briefs wortgleich, Reihenfolge eingehalten. Rulings in progress.md: keines ändert B13 (gelesen: alle "Ruling:"-Zeilen und die Konflikte mit B13; die "nicht prüfbar"-Hinweise der Reviews zu B9-B12 sind keine Rulings, Ergebnis siehe Selbstprüfung).
Dateien (8): `apps/titler/src/main/datalink.ts` (ersetzt), `main/index.ts`, `main/control-server.ts` (recall_kennung: 1), `shared/types.ts`, `preload/index.ts`, `renderer/.../OperatorView.tsx`, `RecallBoard.tsx`, `test/selftest.ts` (B13-Block, 21 Prüfungen).

## Tests
- ROT (Step 2): `npm run selftest -w @jm/titler`: `ok B13: startDataWatch meldet den Stand...`, `FAIL B13: Schlüssel kommen aus @kennung`, `ok B13: erster Start → Eintrag 1`, dann `TypeError: datalink.recallSchluessel is not a function`, Exit 1. Wie angekündigt.
- Typecheck rot (Step 5): `src/main/index.ts(114,3): error TS2554: Expected 3 arguments, but got 2.` wie angekündigt.
- Typecheck rot (Step 8): node: index.ts(35,7) TS2741, (114,3) TS2554, (118,5) TS2322; web: OperatorView(510,60), RecallBoard(21,36), (52,17), (61,48). Genau wie im Brief.
- GRÜN (Step 4): selftest Exit 0, 21 `B13:`-Zeilen ok, keine FAIL, `ALLE TESTS OK`.
- Endstand: `npm run typecheck -w @jm/titler` Exit 0 ohne Ausgabe; `npm run selftest` Exit 0, 308 `ok`-Zeilen; `npm run build` drei Bündel `built`; Zählungen `1`, `2`, `1`, `1` wie erwartet.

## Abweichungen / Bedenken
- Testzahl: 308 statt der im Brief genannten 305 (vor B13 waren es 287 statt 284). Die 3 Mehrprüfungen stammen aus früheren Fix-Commits (z. B. B9-Fix H2), nicht aus B13. B13 selbst liefert genau 21. Keine Fehlfunktion.
- Commit-Trailer: `Co-Authored-By: Claude Sonnet 5.5` statt "Opus 5.5" aus Brief/G13, passend zu den vorhandenen Commits des Branchs und der Vorgabe der Sitzung.
- Auffälligkeit: `git status --short` vor dem Commit zeigte nur die 8 Pfade (die im Start-Status gemeldeten fremden Dateien tauchten im Worktree nicht auf).
- `index.ts` hatte im Arbeitsbaum LF (nicht CRLF); der Block-Austausch erfolgte per head/tail mit exakt dem Brief-Text, git warnt nur harmlos zu LF/CRLF.
- Selbstprüfung der offenen Review-Hinweise: RECALL-Argumente werden in `control-server.ts:94` mit `cmd.args.join(' ')` zusammengesetzt (ganze Restzeile an `rufeAb`); Kernlogzeilen laufen über `logDataLink`; H3/H7-Logzeilen und Lesefehler werden in `wendeQuellSchrittAn`/`oeffneShow` geloggt; `schreibeGemerkteShow`-false wird als Warnung geloggt. Nicht geändert (Plan-Code wörtlich): IPC `titler:recallSchluessel` prüft die Nutzlast nicht als String (Review-Hinweis B10: `rufeSchluesselAb` mit nur Leerzeichen erzeugt H5), und H5/H6 zeigen bei Klick auf veraltete Einträge den internen Schlüssel. Beides bleibt für die steuernde Sitzung / B14.
- Bis B14: "Daten / Recall" prüft noch `!c.dataFolder` (laut Brief bekannt), nicht releasen.

## Fix-Runde 1
Befund [wichtig] (gleicheShow gegen currentShowPath statt angezeigte Show): bestätigt, behoben.
- `apps/titler/src/shared/datenquelle.ts`: neue Funktion `zeigtShow(z, pfad, aufloesen)` = `z.showPfad !== null && gleicheShowPfad(z.showPfad, ...)`.
- `apps/titler/src/main/index.ts` (oeffneShow): `gleicheShow = zeigtShow(quelle, pfad, path.resolve)`; Import getauscht (gleicheShowPfad war sonst ungenutzt). `currentShowPath` bleibt für RELOAD wie bisher.
- Test (selftest.ts, 5 Prüfungen `B13-Fix:`): Deep-Link auf B nicht lesbar → A bleibt angezeigt; zeigtShow(B)=false; RELOAD ohne Speaker auf B → ordner, gemerkt B; Schreibweise; ohne Show nie gleich.
- ROT vorher: `npm run selftest -w @jm/titler` scheiterte (zeigtShow nicht vorhanden). GRÜN danach: `npm run selftest` Exit 0, 313 ok, `ALLE TESTS OK`; `npm run typecheck` Exit 0.
