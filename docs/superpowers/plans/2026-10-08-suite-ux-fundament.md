# Suite-UX-Update · Welle 0 „Fundament“ (`@jm/ui`, `@jm/settings`, Galerie) · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die gemeinsamen Bausteine des „Sendepults“ entstehen in `@jm/ui` und im neuen Paket `@jm/settings`, dazu eine
Galerie im Browser. Alles ist rein additiv: Keine App ändert dadurch ihr Aussehen, und alles ist ohne Electron und ohne
Browser getestet.

**Architecture:**
- **Optik-System (Spec 4):** zwei neue Token-Dateien (`signal-colors.css`, `sizes.css`) mit neuen Namen; `base.css` bekommt nur
  zwei `@import`-Zeilen. Ein Bestandsschutz-Test hält die alten Tokens und die neun alten Komponenten bytegleich, ein
  Kontrast-Test rechnet alle neuen Paare aus den oklch-Werten nach (WCAG AA, beide Modi).
- **Reine Logik zuerst:** Statusleisten-Regeln (`lib/status.ts`), Halten-zum-Sprechen (`lib/halten.ts`), Hell/Dunkel-Speicher
  (`lib/theme.ts`), Zahl-/Auswahl-Logik (`lib/eingabe.ts`), feste Texte (`lib/texte.ts`). Alles ohne DOM testbar.
- **Bausteine (Spec 3):** `StatusPill`, `StatusBar`, `TallyButton`, `Field`/`TextInput`/`NumberInput`/`Toggle`/`Select`,
  `ThemeToggle`/`useTheme`, `SettingsPanel`/`PanelAnker`, `AppHeader`, `AppShell`. Rein darstellend, Werte und Rückrufe über
  Props, Klassen nur als Arbiträrklassen auf Tokens.
- **`@jm/settings` (Spec 6):** gemeinsamer Vertrag (`SectionBase`/`SectionStatus` wörtlich aus 6.1, der Status wird im Paket
  **abgeleitet**), Rahmen `SectionFrame`, sieben Abschnitte mit je einer reinen Ableitungsfunktion `…View(props)`, alle
  Statusregeln aus Spec 7 als Kreuzprodukt getestet.
- **Galerie (Spec 3.10):** Vite-Seite in `packages/ui/galerie`, startbar mit `npm run galerie -w @jm/ui` auf `127.0.0.1`, jeder
  Baustein und Abschnitt in jedem Zustand, Dunkel und Hell nebeneinander; eine Klassen-Probe prüft das gebaute CSS, ein
  Galerie-Test im Selbsttest prüft Vollständigkeit und Zustände ohne Bau.
- **CI und Doku:** zwei Schritte im Job „Selbsttests“, `typecheck`-Skripte (vom Job „Typecheck“ automatisch erfasst);
  `docs/ux/suite-ux-roadmap.md` wird Kurzfassung (Spec F3), Lane E in `docs/roadmap.md` wird nachgeführt.

**Tech Stack:** TypeScript 5.9 (ESM, `moduleResolution: Bundler`, `jsx: react-jsx`), React 18.3 (`react-dom/server`
`renderToStaticMarkup`), Tailwind CSS v4 (Arbiträrklassen auf CSS-Variablen), `tsx` 4 für die Selbsttests, Vite 5 mit
`@vitejs/plugin-react` und `@tailwindcss/vite` für die Galerie. CI: Node 22 (Selbsttests), Node 20 (Typecheck),
`npm ci --ignore-scripts`, kein Electron. Gemessen mit Node 24.16, npm 11.17, tsx 4.22.4, TypeScript 5.9.3, React 18.3.1,
Vite 5.4.21, Tailwind 4.3.0.

**Spec:** `docs/superpowers/specs/2026-10-08-suite-ux-update-design.md`, vom Owner freigegeben am 08.10.2026 mit den
Vorgaben UO1–UO8 (UO3 ja, aber Status-Brücken **nicht** in diesem Plan; UO4 ja: `PeersSection`; UO5: keine neuen Kürzel).
- Umfang: Welle 0 **ohne** Pilot (Spec 9.1/9.2): Abschnitte 3 (ohne 3.9), 3.10, 4, 6, 7, 8, 11 (Paket-Teil), 14 F3, dazu Lane E.
- Nicht im Umfang: jede Änderung an `apps/*`, der Titler-Pilot, die Status-Brücken in `@jm/app-runtime` (eigener Plan nach dem
  Merge von Master-Link 2b R2 und Zoom 4b).
- Plan und Spec gehören zusammen. Bei Widerspruch gilt die Spec, und die Abweichung wird gemeldet. Die Auslegungen in
  „Entscheidungen, wo die Spec schweigt“ sind keine Abweichungen; E1–E4 bittet der Plan den Owner zur Kenntnis zu nehmen.
  **Ausnahme:** E24 und E25 stehen ebenfalls dort, sind aber bewusste Abweichungen von Spec 6.2 bzw. 6.1 (je mit Grund);
  sie brauchen die Zustimmung des Owners, und zwar **vor Task 16** (bei der Freigabe dieses Plans): Lehnt er ab, ändern
  sich Tasks 17–22. Alles, was der Owner vor bzw. nach der Umsetzung sieht oder entscheidet, steht am Ende unter
  „Vor der Umsetzung“ und „Nach der Umsetzung“.

**Arbeitsort:** ein eigener Worktree ab dem Spec-Stand `5a14352934` (Branch legt der Controller fest), mit `node_modules`
aus `npm ci --ignore-scripts` (`node_modules/.package-lock.json` existiert). Alle Pfade relativ zur Repo-Wurzel, Befehle im
Bash-Werkzeug (Git Bash), wo nicht anders genannt. Zeilenangaben gelten für `5a14352934` bzw. für den Stand nach der vorigen
Aufgabe; maßgeblich ist immer der wortgleiche Vorher-Text.

**Aufbau:** 25 Aufgaben in vier Blöcken. Jede braucht nur, was davor fertig ist.

| Block | Aufgaben | Inhalt |
| --- | --- | --- |
| A | 1–7 | Werkzeuge, Bestandsschutz, Tokens, Kontrast, reine Logik |
| B | 8–15 | Bausteine in `@jm/ui` |
| C | 16–22 | `@jm/settings`: Vertrag, Rahmen, sieben Abschnitte |
| D | 23–25 | Galerie, CI und Gesamtprüfung, Doku |

**Wie dieser Plan entstanden ist:** Ein Gerüst hat die Aufgaben, die verbindlichen Schnittstellen und die Entscheidungen
festgelegt. Vier Schreiber haben die Blöcke ausformuliert und ihre Schritte in Kopien gemessen, teils gegen Nachbauten der
anderen Blöcke. Beim Zusammensetzen wurde der fertige Plantext maschinell und wörtlich in **eine** frische Kopie des
Spec-Stands eingespielt, Aufgabe für Aufgabe in Planreihenfolge: jede Vorher-Stelle passte genau einmal, nach jeder Aufgabe
liefen Selbsttest und Typprüfung, jede Rot-Meldung und jede Mutationsprobe wurde nachgemessen. Dabei fielen drei Fehler im
Zusammenspiel der Blöcke auf; sie sind im Plantext behoben und unten unter „Beim Zusammensetzen“ (Z1, Z4, Z5) begründet.
Danach hat ein Review den Plan gegen Spec und Code geprüft; die Befunde sind eingearbeitet (je Aufgabe unter
„Nachbesserung nach dem Review“, neue Entscheidungen E23–E26), und der ganze Plantext wurde noch einmal maschinell in
frische Kopien eingespielt, jede geänderte Aufgabe mit ihren Mutationsproben (Ausnahmen unter der Tabelle „Gemessene
Zählstände“). Eine zweite Prüfrunde (Vollständigkeit; neuer Code) fand weitere Restpunkte; sie sind eingearbeitet (je
Aufgabe unter „Zweite Nachbesserung“, neue Entscheidung E27) oder dort begründet abgelehnt, und der Plantext wurde wieder
Aufgabe für Aufgabe in frische Kopien eingespielt. Alle Zahlen in diesem Plan sind die gemessenen (Tabelle „Gemessene
Zählstände“).

**Verweise auf das Gerüst:** Angaben wie „(9.3)“, „Gerüst 9.7“, „nach Abschnitt 9“ oder „wörtlich 9.10“ meinen Abschnitte
des Gerüsts, **nicht** der Spec (Spec 9 ist „Rollout“). Das Gerüst ist nicht Teil dieses Plans; sein Inhalt steht
vollständig in den Aufgaben unter **Interfaces**: 9.1 → Task 1 (Testhilfe), 9.2 und 9.3 → Task 5 (`texte.ts`, `status.ts`),
9.4 → Task 6 (`halten.ts`), 9.5 und 9.6 → Task 7 (`theme.ts`, `eingabe.ts`; `useTheme` → Task 12), 9.7 → Tasks 8–15 (je
Baustein), 9.8 → die Export-Zeilen in `packages/ui/src/index.ts` (Tasks 5, 7–15), 9.9 → Task 16 (Vertrag, `SectionFrame`),
9.10 → Tasks 17–22 (Props je Abschnitt). `<eigener Scratchpad>` in Befehlen ist vor dem Lauf durch den Scratchpad-Ordner
der ausführenden Sitzung zu ersetzen (G16).

## Global Constraints

- **G1 Pfade:** Geändert oder angelegt werden nur:
  - `packages/ui/**` (bestehende Dateien nur nach G2),
  - `packages/settings/**` (neu),
  - `.github/workflows/ci-checks.yml` (ein abgegrenzter Block im Job `selftests`, Task 24),
  - `docs/ux/suite-ux-roadmap.md`, `docs/roadmap.md` (Lane E und eine Verweisstelle, Task 25),
  - `package-lock.json` (nur durch `npm install --ignore-scripts --package-lock-only --offline`, Task 1, 16, 23).
  Nicht angefasst: `apps/*`, `packages/app-runtime`, `packages/master-link`, `packages/suite-control-protocol`,
  `packages/companion-*`, `packages/show`, `packages/control-config` (nur dessen Typ `SuiteControlConfig` wird gelesen).
- **G2 Rein additiv (Spec 4.1):** In `packages/ui` bleiben bytegleich (nach LF-Normalisierung): die neun Komponenten
  `src/components/{Badge,Button,Card,Collapsible,Logo,Modal,SettingsSection,Splitter,Tabs}.tsx`, `src/lib/cn.ts`,
  `src/lib/titlebar.ts`, `src/tokens/colors.css`, `src/tokens/typography.css`. `src/base.css` bekommt nur die zwei Zeilen
  `@import "./tokens/signal-colors.css";` und `@import "./tokens/sizes.css";` direkt nach Zeile 8. `src/index.ts` bekommt nur
  neue Zeilen **am Ende**; Zeilen 1–11 bleiben. `package.json` bekommt nur neue Einträge (`scripts`, `devDependencies`,
  `exports`). Neue CSS definiert nur Custom Properties (neue Namen) und Regeln auf neuen Selektoren (`[data-dichte="kompakt"]`),
  keine Element- oder Klassenregeln, die bestehendes Markup treffen. Der Bestandsschutz-Test (Task 2) prüft das.
- **G3 Klassen:** nur Tailwind-Arbiträrklassen auf Tokens (`bg-[var(--tally-live)]`, `h-[var(--control-h)]`,
  `rounded-[var(--radius-md)]`), keine rohen Farbklassen (`red-*`, `neutral-*`, `white`, `black` …). Jede Klasse steht als
  **vollständiges Literal** im Quelltext (kein `${…}` in einem Klassennamen): Die Apps erzeugen CSS nur für Klassen, die
  Tailwind über `@source "../../../../../packages/ui/src"` im Text findet. Höhen kommen aus `var(--…)`, nicht aus
  überschreibbaren Klassen (`cn` hat kein tailwind-merge). Rundung: Bedienelemente `--radius-md`, Karten/Panel `--radius-lg`
  (Schalter `--radius-full`, Task 11).
- **G4 Umgebung (Spec 3.8):** In `src/` beider Pakete kein `window.jm*`, kein `electron`-, `node:`- oder IPC-Import, kein
  `process.`. `document`, `window`, `navigator` nur hinter `typeof`-Prüfung oder in Effekten/Handlern (in
  `packages/settings/src` gar nicht). `localStorage` nur in `packages/ui/src/lib/theme.ts`, jeder Zugriff in `try/catch`.
  `isElectronMac` nur als Vorgabewert der Prop `mac`.
- **G5 Texte:** wörtlich aus der Spec, deutsche Anführungszeichen „…“, echte Umlaute. Alle festen Texte von `@jm/ui` stehen in
  `src/lib/texte.ts`, die von `@jm/settings` in `src/vertrag.ts` (gemeinsam) und je Abschnitt in dessen `.ts`-Datei
  (`…_TEXTE`). Kein Abschnitt hat eine Prop für Titel, Feldnamen oder Statustexte (Spec 6.1). Zahlen in Texten mit
  `zahlText(n)` (de-DE, Komma, ohne Tausenderpunkt).
- **G6 Statusregeln (Spec 7):** Unbekannt ist `{ state: 'off', text: 'unbekannt' }`, nie `ok`. Angezeigt wird nur
  Gemessenes; eine Prop „gemessen“ ist `undefined`, solange das Tool nichts weiß, und `undefined` wird nie als `0`, `false`
  oder „ok“ gelesen. Abschnitte liefern nur `ok | warn | error | off`, nie `live`. Jede Ableitung wird als vollständiges
  Kreuzprodukt ihrer Eingänge getestet (Schleifen über alle Kombinationen, Erwartung je Kombination aus einer Tabelle).
- **G7 Barrierefreiheit und Kontrast:** Jeder Zustand mit Symbol **und** Text, nie nur Farbe. `--tally-*`/`--status-*` färben
  nur Symbole, Ränder und Flächen, nie Wörter: `text-[var(--tally-…)]`/`text-[var(--status-…)]` steht ausschließlich in
  `STATUS_SYMBOL_KLASSE` (`lib/status.ts`). Text auf der LIVE-Fläche des `TallyButton` und der On-Air-Anzeige ist
  `LIVE_FLAECHE_KLASSE` (weiß, 19 px, extrafett = „große Schrift“); der live-Eintrag der Statusleiste und die
  live-`StatusPill` tragen `LIVE_EINTRAG_KLASSE` (normale Schrift in `--background`, dunkel 4,63, hell 5,43; E14).
  Statussymbole stehen nie auf einer Hover-Fläche `--muted` (E14). Symbole `aria-hidden="true"`, daneben ein
  `sr-only`-Zustandswort.
- **G8 Bewegung (Spec 4.3):** nur `motion-safe:transition-*` mit `duration-150` oder kürzer; kein `animate-*`.
- **G9 Tests:** ohne Electron und ohne Browser: `tsx` + `react-dom/server` `renderToStaticMarkup`. Testhilfe
  `@jm/ui/testhilfe` (Task 1). Ausgabe `ok   <msg>` / `FAIL <msg>`, Abschluss `ALLE TESTS OK` bzw.
  `<Zahl> FEHLGESCHLAGEN` mit Exitcode 1. TDD: erst rot sehen, dann Code. Jede Aufgabe mit Regeln endet mit einer
  **Mutationsprobe** (die genannten absichtlichen Fehler, je einer allein eingebaut, müssen den Selbsttest rot machen; das
  Ergebnis steht im Aufgabenbericht; nichts davon wird committet). Ort je Block (Entscheidung Z3): Block A und Task 23 in
  einer Kopie (Rezept dort), Block B im Plan-Worktree mit sofortigem Zurückbau per Edit-Werkzeug, Block C gegen den Index
  (`git checkout -- <pfad>` holt die gestagte Fassung zurück).
- **G10 Typprüfung:** Jede Aufgabe endet mit `npm run typecheck -w @jm/ui` grün, ab Task 16 zusätzlich
  `npm run typecheck -w @jm/settings`. Task 24 prüft `npm run typecheck --workspaces --if-present` (31 Workspaces; jede App
  prüft die `@jm/ui`-Quellen mit).
- **G11 Zeilenenden:** `core.autocrlf=true`; Repo-Dateien liegen im Arbeitsbaum mit CRLF, im Index mit LF
  (`git ls-files --eol packages/ui` zeigt `i/lf w/crlf`). Bestehende Dateien mit dem Edit-Werkzeug ändern (Vorher-Text exakt),
  nicht mit `sed`; neue Dateien mit dem Write-Werkzeug (LF; die Warnung „LF will be replaced by CRLF“ ist harmlos). Tests
  normalisieren `\r\n` → `\n` vor jedem Vergleich und Hash. `docs/roadmap.md` hat Zeilen bis 4331 Zeichen: punktuell
  ersetzen, nie umbrechen.
- **G12 Abhängigkeiten:** devDependencies mit denselben Spannen wie die Apps: `react` `^18.3.1`, `react-dom` `^18.3.1`,
  `@types/react` `^18.3.12`, `@types/react-dom` `^18.3.1`, `@types/node` `^22.7.5`, `typescript` `^5.6.3`, `tsx` `^4.19.2`;
  nur Galerie (`@jm/ui`): `vite` `^5.4.10`, `@vitejs/plugin-react` `^4.3.3`, `tailwindcss` `^4.0.0`, `@tailwindcss/vite`
  `^4.0.0`. **Von Hand** ins `package.json` eintragen, danach nur
  `npm install --ignore-scripts --package-lock-only --offline` (Z2; `npm install -D …` hebt gemessen die gemeinsamen
  Versionen aller Apps an). Danach `git diff --stat package-lock.json` lesen: Task 1 genau 9 neue Zeilen, Task 16 genau 25,
  Task 23 genau 5 neue und 1 entfernte, keine Version unter `node_modules/…` ändert sich, nichts unter
  `packages/{ui,settings}/node_modules`. `--package-lock-only` schreibt außer `package-lock.json` auch das versteckte,
  git-ignorierte `node_modules/.package-lock.json` (ohne Wirkung auf die Commits); Paketordner unter `node_modules` bleiben
  unberührt. Ab Task 16 nennt das versteckte Lockfile einen Link `node_modules/@jm/settings`, den es auf der Platte noch
  nicht gibt (Review-Befund, dort gemessen: +38 Zeilen). Wer den Link lokal braucht, nimmt `npm ci --ignore-scripts`, nicht
  `npm install` (ob dieses dem versteckten Lockfile vertraut und den Link auslässt, ist nicht gemessen).
  „`npm ls` zeigt je eine Version“ taugt nicht als Prüfung (am Spec-Stand liegt schon
  `vite@8.1.0` unter `astro`); Task 24 prüft stattdessen den Lockfile mit festen Sollwerten.
- **G13 Git:** ein Commit je Aufgabe, Text ASCII, Stil `test(ui): …`, `feat(ui): …`, `feat(settings): …`, `ci: …`,
  `docs(ux): …`, letzte Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git add` nur mit expliziten
  Pfaden, danach `git status --short` lesen (fremde Dateien bleiben ungestaged). Kein bare `git stash`, kein
  `git reset --hard`, kein `git clean`, kein Branch-Wechsel, kein Push.
- **G14 Sicherheit:** Kein Agent liest `%APPDATA%` oder ein Token, startet keine Electron-App und ruft keine Netzdienste.
  Der Vite-Dev-Server läuft nur auf `127.0.0.1:5199`, nur zur Prüfung, und wird danach beendet. Kopien mit Junctions werden
  nur so aufgeräumt: erst jede Junction einzeln (`cmd /c rmdir`), dann der Rest; nie `rm -rf`/`Remove-Item -Recurse` auf
  einen Ordner, in dem noch eine Junction steckt.
- **G15 Parallel-Vorhaben:** Zoom 4b und Master-Link 2b R2 ändern gleichzeitig `packages/app-runtime`,
  `suite-control-protocol`, `companion-*`, `master-link`, `apps/{launcher,timer,titler,rundown,connect}` und das Ende des Jobs
  `selftests`. Dieser Plan berührt keine dieser Dateien; der CI-Block steht als eigener Hunk vor dem Kommentar
  `# Zoom Stage 4a` (Task 24), und Task 25 lässt die Zeilen der Roadmap stehen, die den Stand von 2b R2 und 4b tragen.
- **G16 Variablenkopf für Kopien:** Kopien und Protokolle liegen im **eigenen Scratchpad-Ordner** der ausführenden Sitzung
  (Systemprompt), nie unter `/tmp` und nie im Repo. Shell-Variablen und das Arbeitsverzeichnis überleben im Bash-Werkzeug
  keinen Aufruf; jeder Befehlsblock, der eine Kopie braucht, beginnt deshalb mit `SP='<eigener Scratchpad>'` (vor dem Lauf
  durch den Pfad ersetzen) und `K="$SP/<name>"` und prüft vor jedem Anlegen oder Löschen `[ -d … ]`. Ein leeres oder nicht
  ersetztes `SP` führt so nie zu `mkdir` oder `rm -rf`. Kein `cd -`; Wechsel des Verzeichnisses nur in einer Subshell
  `( cd … && … )`.

## Testläufe (wie sie heißen werden)

| Paket | Befehl | Laufzeit |
| --- | --- | --- |
| `@jm/ui` | `npm run selftest -w @jm/ui` | `tsx test/selftest.ts`, unter 1 s, Endstand 520 `ok` |
| `@jm/settings` | `npm run selftest -w @jm/settings` | `tsx test/selftest.ts`, unter 1 s, Endstand 329 `ok` |
| Typprüfung | `npm run typecheck -w @jm/ui`, `npm run typecheck -w @jm/settings`; Task 24: `npm run typecheck --workspaces --if-present` | `tsc --noEmit -p tsconfig.json`; alle Workspaces 1,5–2 min |
| Galerie | `npm run galerie -w @jm/ui` (Dev-Server `127.0.0.1:5199`), `npm run galerie:bauen -w @jm/ui` (`vite build` nach `galerie/dist`), `npm run galerie:pruefen -w @jm/ui` (Bau + Klassen-Probe) | Vite 5, Bau unter 2 s, nicht in der CI (E21) |
| Klassen-Probe gegen ein anderes CSS | `(cd packages/ui && npx tsx galerie/pruefe-klassen.ts --css <ordner> --ohne-settings)` | Task 24, Titler-Renderer |
| CI-Datei | `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/ci-checks.yml','utf8'))"` | js-yaml (vorhanden) |

**Nachtrag nach der Umsetzung (09.10.2026):** Die Endstände 520/329 sind die des Plantexts. Nach den Abweichungen der
Umsetzung zählt der Branch nach Task 24 601/397 `ok`, nach der Fix-Welle der Gesamtprüfung 605/412 (Abschnitt
„Umsetzung: Abweichungen vom Plantext“ am Ende).

## Review Focus (in die Tests der genannten Aufgabe)

1. **Eine Klasse aus den neuen Bausteinen kommt in einer App nicht im CSS an** (zusammengesetzter Klassenname, Tippfehler im
   Token-Namen, Datei außerhalb von `packages/ui/src`).
   - Erwartet: jede Klasse ist ein vollständiges Literal, jede `var(--…)` ist definiert; die neuen Pflichtklassen stehen im
     gebauten CSS der Galerie und eines echten App-Renderers.
   - Test: **Task 3** (Quellregeln: kein `${` in Klassen, jede `var(--x)` definiert), **Task 16** (Quellregeln settings),
     **Task 23** (`galerie:pruefen`, Galerie-Test prüft die Probe selbst), **Task 24** (Titler-Renderer-Bau in einer Kopie,
     Klassen-Probe mit zwei Gegenproben).
2. **Halten-zum-Sprechen endet ohne `pointerup`:** Zeiger verlässt das Fenster (`pointercancel`/`lostpointercapture`),
   Alt+Tab (`blur`), Leertaste gehalten und Fokus springt weg, `pointerup` **und** `lostpointercapture` nacheinander,
   gehaltenes Enter (der Browser klickte mit jeder Wiederholung erneut; E9),
   Auto-Repeat der Taste, rechte Maustaste, Zustand wechselt beim Halten auf `gesperrt`, `onPress` wirft.
   - Erwartet: `onPress` genau einmal je Druck, `onRelease` danach genau einmal, auch wenn `onPress` geworfen hat.
   - Test: **Task 6** (Logik, Kreuzprodukt 780 Folgen), **Task 9**: Prop-Objekt `tallyKnopfProps` (genau die acht Handler,
     per Spread am `<button>`), `pointercancel` allein und `lostpointercapture` allein bei fehlgeschlagenem Capture,
     Effekt-Körper `haltenBeiZustand` (Wechsel auf `gesperrt` beim Halten) und `haltenBeiAbbau`, neue Rückrufe nach
     erneutem Rendern (`haltenFuerRender`), Verdrahtung im Quelltext; Mutationsproben 9e–9l. Dass React die beiden Effekte
     wirklich ausführt, ist ohne Browser nicht messbar: Owner-Prüfpunkt 2 unter „Nach der Umsetzung“.
3. **Halbes oder fehlendes Wissen in Statusleiste und Abschnitt:** Clientzahl unbekannt, NDI an ohne Rückmeldung, Liste der
   Bildschirme noch nicht geladen, gewähltes Audiogerät verschwunden, Server läuft nicht, aber „0 Clients“.
   - Erwartet: nie `ok`; Text „unbekannt“ bzw. „an (ohne Rückmeldung)“; `0` nur, wenn gemessen; ein verschwundenes Gerät
     bleibt gewählt („nicht verfügbar: …“) und der Abschnitt zeigt „Gerät nicht gefunden, zuletzt: {name}“.
   - Test: **Task 5**, **Task 8**, **Task 11** (`Select`), **Tasks 17–22** (Kreuzprodukt je Abschnitt).
4. **Ein Bestands-Token oder eine Bestands-Komponente ändert sich unbemerkt** (jede App sähe beim nächsten Release anders aus).
   - Erwartet: der Selbsttest wird rot bei jeder Wert- oder Dateiänderung, nennt Datei und Token.
   - Test: **Task 2** (mit Mutationsprobe), Gesamtlauf und Diff-Prüfung **Task 24**.
5. **Kontrast in Hell und Dunkel**, auch auf der neuen Panel-Fläche `--surface-raised`, für Text auf der LIVE-Fläche und
   auf Hover- und Hervorhebungsflächen.
   - Erwartet: jedes Paar erfüllt seine Klasse (Text 4,5 : 1, groß/Grafik 3 : 1); Statusfarben färben nie Wörter; LIVE-Text
     auf dem `TallyButton` ist groß und fett, der live-Eintrag der Statusleiste nutzt `--background` auf `--tally-live`
     (normale Schrift, 4,63/5,43); keine neue Fläche aus `--highlight` (gedämpfte Schrift darauf 3,60 bzw. 4,01, E23;
     bekannte Ausnahme: die Hover-Fläche des Bestands-`Button` in den Abschnitten, Schrift `--foreground` darauf ≥ 11,16);
     auf der Hover-Fläche `--muted` nur Schrift, Ränder in `--tally-ready`/`--tally-selected` und keine Statussymbole
     (`--status-warn` hell darauf 2,91 : 1, E14).
   - Test: **Task 4** (Paare, darunter `--background` auf `--tally-live`, `--foreground` auf `--muted`, die Ränder
     `--tally-ready`/`--tally-selected` auf `--muted`, der Grund-Wert `--status-warn` auf `--muted` und die vier
     `--highlight`-Paare über `--surface-raised`/`--card` als Befund), **Task 5** (`LIVE_FLAECHE_KLASSE`,
     `LIVE_EINTRAG_KLASSE`), **Task 3** (Quellregeln Statusfarbe und „kein `--highlight`“), **Task 16** (dieselbe Regel für
     settings), **Tasks 8, 9, 14** (Render-Prüfung).

## Dateistruktur

**Neu in `packages/ui`**
- `tsconfig.json`: ES2022, ESNext, Bundler, `jsx: react-jsx`, strict, isolatedModules, skipLibCheck, noEmit,
  lib ES2022+DOM+DOM.Iterable, `types: ["node"]`; `include` `src`, `test`, `galerie`, `vite.config.ts` (Task 1) und
  `../settings/src` (Task 23, Z6).
- `src/tokens/signal-colors.css`: `--tally-live`, `--tally-ready`, `--tally-selected`, `--status-warn`, `--status-error`,
  `--status-off`, `--surface-raised` für Dunkel (`:root, .dark`) und Hell (`.light`).
- `src/tokens/sizes.css`: `--header-h`, `--statusbar-h`, `--control-h`, `--control-h-lg`, `--panel-w`; `[data-dichte="kompakt"]`.
- `src/lib/texte.ts`: alle festen Texte von `@jm/ui`, `UNBEKANNT`, `zahlText`.
- `src/lib/status.ts`: Typen aus Spec 3.3, Reihenfolge, Symbole, Symbol-/Randklassen, `LIVE_FLAECHE_KLASSE`,
  `LIVE_EINTRAG_KLASSE`, Uhrzeit.
- `src/lib/halten.ts`: Zustandsmaschine Halten-zum-Sprechen.
- `src/lib/theme.ts`: Hell/Dunkel lesen, schreiben, anwenden und der eine Store des Dokuments (`themeStore`; einziger Ort
  mit `localStorage`).
- `src/lib/useTheme.ts`: Hook über `lib/theme.ts`.
- `src/lib/eingabe.ts`: `parseZahl`, `zahlSchritt`, `starteFrist` (E27), `selectOptionen`, `feldIds`, `beschreibtDurch`.
- `src/components/StatusPill.tsx`, `StatusBar.tsx`, `TallyButton.tsx`, `Field.tsx`, `TextInput.tsx`, `NumberInput.tsx`,
  `Toggle.tsx`, `Select.tsx`, `ThemeToggle.tsx`, `SettingsPanel.tsx` (mit `PanelAnker`), `AppHeader.tsx`, `AppShell.tsx`.
- `test/harness.ts` (Export `@jm/ui/testhilfe`), `test/selftest.ts` (Einstieg; **Einfügemarke für neue Testmodule ist die
  Zeile `abschluss();`**, neue `import`-Zeilen stehen direkt davor).
- Testhilfen nur für Tests: `test/lib/css.ts` (Custom Properties lesen), `test/lib/oklch.ts` (oklch → Luminanz, Kontrast,
  Mischen), `test/lib/quellen.ts` (Dateiliste, Hash, Bestandsliste), `test/lib/markup.ts` (Lesehilfen für das gerenderte
  HTML, Block B; Z7).
- Testmodule: `werkzeug.test.tsx` (1), `bestand.test.ts` (2), `tokens.test.ts` und `quellregeln.test.ts` (3),
  `kontrast.test.ts` (4), `status.test.ts` (5), `halten.test.ts` (6), `theme.test.ts` und `eingabe.test.ts` (7),
  `statusbar.test.tsx` (8), `tally.test.tsx` (9), `field.test.tsx` (10), `toggle-select.test.tsx` (11),
  `themetoggle.test.tsx` (12), `panel.test.tsx` (13), `header.test.tsx` (14), `shell.test.tsx` (15), `galerie.test.tsx` (23).
- `vite.config.ts`, `galerie/index.html`, `galerie/main.tsx`, `galerie/galerie.css`, `galerie/Galerie.tsx`,
  `galerie/beispiele-ui.tsx`, `galerie/beispiele-settings.tsx`, `galerie/ShellSeite.tsx`, `galerie/pruefe-klassen.ts` (23).

**Geändert in `packages/ui`**
- `package.json`: `scripts` (`typecheck`, `selftest`; ab 23 `galerie`, `galerie:bauen`, `galerie:pruefen`), `devDependencies`,
  `exports` (`./testhilfe`, `./tokens/signal-colors.css`, `./tokens/sizes.css`).
- `src/base.css`: zwei `@import`-Zeilen nach Zeile 8 (Task 3).
- `src/index.ts`: 17 neue Export-Zeilen am Ende (Tasks 5, 7, 8–15).

**Neu: `packages/settings`** (`@jm/settings`, privat)
- `package.json`, `tsconfig.json` (wie ui, `include` `src`, `test` und `../ui/src`, Z6).
- `src/index.ts`, `src/vertrag.ts`, `src/SectionFrame.tsx` (mit `Anzeige`), `src/entwurf.ts` (Text-Entwurf, Task 17; Z7).
- `src/abschnitte/ndi-output.ts` + `NdiOutputSection.tsx`, `screen-output.ts` + `ScreenOutputSection.tsx`,
  `remote-control.ts` + `RemoteControlSection.tsx`, `audio-device.ts` + `AudioDeviceSection.tsx`, `iveo.ts` + `IveoSection.tsx`,
  `datalink.ts` + `DataLinkSection.tsx`, `peers.ts` + `PeersSection.tsx`.
- `test/selftest.ts` (Einfügemarke `abschluss();`), `test/hilfe.ts` (Kreuzprodukt, Fall-Text, Zählung gesperrter
  Bedienelemente; Z7), `test/vertrag.test.tsx`, `test/quellregeln.test.ts`, `test/ndi-output.test.tsx`,
  `test/screen-output.test.tsx`, `test/remote-control.test.tsx`, `test/audio-device.test.tsx`, `test/iveo.test.tsx`,
  `test/datalink.test.tsx`, `test/peers.test.tsx`.

**Sonst geändert**
- `.github/workflows/ci-checks.yml`: Block nach Zeile 70 (`run: npm run selftest -w @jm/app-designer`), vor Zeile 71
  (`# Zoom Stage 4a …`).
- `docs/ux/suite-ux-roadmap.md`: Kurzfassung (Spec F3).
- `docs/roadmap.md`: Lane E (Zeilen 336–339 ersetzt, alter Text in einen `<details>`-Block), Abschnitt 5 „Geparkt“ (Zeile 430).
- `package-lock.json`: Eintrag `packages/ui` (devDependencies), Eintrag `packages/settings` (neu), Lock-Eintrag
  `node_modules/@jm/settings` als Link.

**Nicht angefasst:** siehe G1. Keine App bekommt eine `@source`-Zeile für `packages/settings/src` (Sache des Pilot-Plans).

## Bewusst nicht in diesem Plan

- Titler-Pilot (Spec 9.2) und jede Änderung an `apps/*`, auch die `@source`-Zeile für `@jm/settings` in den Apps.
- Status-Brücken (Spec 3.9, UO3): Master-Link-Brücke in `@jm/app-runtime`, Fernsteuerungs-Meldung je Tool.
- Ein Deep-Link `jmps://` auf einen Launcher-Abschnitt (E15): der Knopf „Im Launcher einrichten“ ist ein Rückruf.
- Seitenaufbau je App-Typ (Spec 5) und Funktionslisten (Spec 10): kommen mit den Wellen; dieses Fundament liefert nur die Bausteine.
- Folgeaufgaben F1 (suite-weiter Hell/Dunkel-Schalter), F2 (Status-Leitung), F4 (neue Kürzel).
- Versionen, Changelog, Releases von Apps. Die Pakete werden mit den Apps gebündelt; der erste Release mit den Bausteinen ist
  der Titler-Pilot.
- In `docs/roadmap.md` die Zeilen in Abschnitt 3 „Was läuft wann“, die zugleich den Stand von 2b R2 und 4b tragen
  (Merge-Konflikt; Task 25, „Abweichungen“).

## Entscheidungen, wo die Spec schweigt (Owner bzw. Reviewer bitte zur Kenntnis nehmen)

- **E1 `SectionBase` ist die abgeleitete Sicht.** `SectionStatus` und `SectionBase` stehen wörtlich wie in 6.1. Die Eingabe eines
  Abschnitts ist `SectionInput = Omit<SectionBase, 'status'>` plus Rohdaten; den Status berechnet die reine Funktion
  `…View(props)` im Paket, und `…View extends SectionBase`. Grund: 6 („Werte, Status und Aktionen kommen über Props“), 6.1
  („Texte liegen fest im Paket“) und 6.2 („reine Funktion, die aus den Props … die Statuspille ableitet“) passen nur so
  zusammen; sonst lägen die Statustexte beim Tool, und Regel 7.1 wäre im Paket nicht testbar.
- **E2 „an (ohne Rückmeldung)“ hat den Zustand `warn`** (Spec 7.3 nennt nur den Text). `ok` würde Regel 7.2 verletzen, `off`
  widerspräche „an“.
- **E3 Kontrast-Klassen:** Text 4,5 : 1 (WCAG 1.4.3), große Schrift 3 : 1 (≥ 18,66 px fett), Grafik 3 : 1 (WCAG 1.4.11: Symbole,
  Ränder, Flächen). Gemessen mit den freigegebenen Werten aus 4.2: hell `--tally-ready` 3,68/3,53 und `--status-warn` 3,27/3,14
  (auf Hintergrund/Karte), dunkel `--tally-live` auf Karte 4,30, Weiß (`--brand-fg-on-dark`) auf der LIVE-Fläche dunkel 3,90 und
  hell 5,20 erreichen nur bzw. sicher „groß/Grafik“. Folge ohne Wertänderung: Statusfarben färben nur Symbole/Ränder/Flächen
  (G7), LIVE-Text auf dem `TallyButton` und der On-Air-Anzeige ist 19 px extrafett. Für den live-Eintrag der Statusleiste
  und die live-`StatusPill` ist die dunkle Schrift umgesetzt: `--background` auf `--tally-live` (normale Schrift, dunkel
  4,63, hell 5,43; E14). Alternative für den Owner (nicht umgesetzt): dieselbe dunkle Schrift auch auf dem `TallyButton`.
- **E4 Werte für `--surface-raised`** (Spec 4.3 nennt keine): dunkel `oklch(0.25 0 0)` (zwischen `--card` 0.215 und
  `--secondary` 0.27; `--muted-foreground` darauf 4,95), hell `oklch(1 0 0)` („eine Stufe heller“ als `--card` 0.985).
- **E5 `--tally-selected` hell „mit gelber Kante“:** Der Token-Wert ist `var(--brand-dark)`; die Kante ist eine Regel der
  Komponente (`border-[var(--brand-yellow)]`, z. B. `Toggle` „an“ in Task 11). Die Galerie zeigt die Muster-Kachel.
- **E6 Dichte:** `data-dichte="kompakt"` am Wurzelelement von `AppShell` setzt nur `--header-h: 36px` und `--statusbar-h: 24px`
  (Spec 3.8 nennt nur diese); `--control-h` bleibt 32 px (Spec 3.5).
- **E7 Schmal (< 900 px) per CSS:** Tailwind-Variante `max-[900px]:` (Medienabfrage auf die Fensterbreite), kein JavaScript:
  identisch in Galerie, App und `renderToStaticMarkup`. Die Galerie zeigt die Schmal-Ansicht in einem 800 px breiten `iframe`.
- **E8 Escape im Panel:** `onKeyDown` am Panel: `Escape` und nicht `defaultPrevented` → `onClose()`, `stopPropagation()`,
  `preventDefault()`. Fokus außerhalb → das Panel reagiert nicht, Escape gehört dem Tool. Ein `NumberInput` mit geändertem
  Entwurf verbraucht Escape selbst (verwirft den Entwurf, `stopPropagation`), das Panel bleibt offen. Das Panel ist nicht modal
  (keine Fokusfalle), bekommt `noDragRegion`, und beim Öffnen wandert der Fokus auf das Panel (`tabIndex={-1}`), beim
  Schließen zurück auf das Element, das ihn vorher hatte (⚙ oder Statuseintrag), wenn er im Panel lag.
- **E9 `TallyButton`:**
  - `gesperrt` = `aria-disabled="true"` (bleibt fokussierbar, damit der Grund vorgelesen wird), Grund sichtbar unter dem
    Label, als `title` und per `aria-describedby`; Handler ignorieren alles. Fehlt `disabledReason`, steht
    „gesperrt – kein Grund angegeben“ (macht den Fehler sichtbar, statt ihn zu verschweigen).
  - Halten: Zeiger (nur linke Taste, `setPointerCapture` in `try/catch`) und Tasten Leertaste/Enter (ohne `repeat`).
    Loslassen über dieselbe Quelle; `pointercancel`, `lostpointercapture`, `blur`, Wechsel auf `gesperrt` und Unmount
    brechen ab. `onClick` ist der normale Klick (auch per Tastatur) und kommt unabhängig vom Halten.
  - Ein gehaltenes Enter klickt im Browser mit jeder Wiederholung erneut (mehrfaches „Take“). Deshalb ruft `onKeyDown` bei
    Enter mit `repeat` `preventDefault()`: Nur der erste Druck klickt. Die Leertaste klickt ohnehin erst beim Loslassen.
  - Der Knopf füllt die Breite seines Behälters (`w-full`); die Anordnung (höchstens vier) macht das Tool.
- **E10 `ThemeToggle`** zeigt den **Zustand** („Dunkel“/„Hell“ mit Symbol), `aria-label` „Darstellung: Dunkel. Umschalten auf
  Hell“. Schlüssel `jm-theme`, Werte `dark`/`light`, jeder andere Wert und jeder Fehler → Dunkel. Auf `<html>` steht danach
  genau eine der Klassen `dark`/`light` (Klassenvertrag der 24 `index.html`).
- **E11 `Select` mit fehlendem Wert:** Steht `value` (≠ `''`) nicht in `options`, kommt als erste Option
  „nicht verfügbar: {fehlendLabel ?? value}“ (`disabled`, gewählt). Der Wert springt nie still um. Bei `value === ''` ohne
  passende Option steht „– bitte wählen –“ (bzw. `placeholder`).
- **E12 `NumberInput`:** Entwurf als Text; Enter und Verlassen übernehmen nur eine gültige Zahl im Bereich (kein stilles
  Klemmen); sonst bleibt der Entwurf mit Fehlertext („Bitte eine Zahl eingeben.“, „Bitte eine ganze Zahl eingeben.“,
  „Mindestens {min}.“, „Höchstens {max}.“) direkt unter dem Feld und `aria-invalid`. Escape verwirft. Komma und Punkt als
  Dezimaltrenner. Einheit als Text rechts, per `aria-describedby` verknüpft.
- **E13 `Field`** stellt per Kontext `id`, `aria-describedby` (Reihenfolge Hilfe, Sperre, Fehler), `aria-invalid` und `disabled`
  für `TextInput`/`NumberInput`/`Toggle`/`Select` bereit. Ein Stil für alle Beschriftungen: `text-xs font-semibold`
  Vordergrund; Hilfe `text-[11px]` gedämpft; Fehler „⚠ {text}“ mit ⚠ in Fehlerfarbe; Sperre „Gesperrt: {grund}“.
- **E14 StatusBar:**
  - Ein Eintrag ist nur dann ein Knopf, wenn er `settingsSection` hat **und** die Leiste `onOpenSection` bekommt; `AppShell`
    gibt `onOpenSection` nur weiter, wenn `settings` gesetzt ist.
  - `live` ist rot **gefüllt** mit sichtbarer Kennung „LIVE“ (`LIVE_EINTRAG_KLASSE`: Fläche `--tally-live`, Symbol ■,
    Kennung, Label und Detail in `--background`; normale Schrift, dunkel 4,63, hell 5,43, Task 4), `error` nur rot
    umrandet mit ⚠ (Spec 3.3 „live ■ rot gefüllt“, 4.2 „gefüllt + LIVE gegen Rahmen + ⚠“). Die erste Fassung dieses Plans
    hatte `live` nur umrandet und ohne „LIVE“; das war eine Abweichung von 3.3/4.2 und ist nach dem Review behoben.
  - Die Uhr steht außerhalb der `role="status"`-Region (sonst läse ein Screenreader jede Sekunde vor). `jetzt?: () => Date`
    macht sie testbar. Sie tickt kurz nach jeder vollen Sekunde (`starteUhr` plant jeden Takt neu); ein fester
    1-s-Takt ab dem Einhängen ginge bis zu 1 s nach und übersprünge durch Drift gelegentlich eine Sekunde.
  - Detail: gekürzt, voller Text im `title` (`{label}: {detail}`), unter 900 px nur noch für Screenreader
    (`max-[900px]:sr-only`, nicht `hidden`: ein reiner Anzeige-Eintrag wäre sonst für Screenreader leer); Werte `select-text`.
  - Hover eines Eintrags mit Knopf: Unterstreichung, ohne Fläche (bei `live` bleibt die rote Fläche). Eine Hover-Fläche
    `--muted` drückte das ▲ von `--status-warn` hell auf 2,91 : 1, unter die 3 : 1 für Grafik (Task 4); die erste
    Nachbesserung hatte dort `--muted` gesetzt.
- **E15 Deep-Link „Im Launcher einrichten“** (Spec 6.2 „der Plan prüft, ob der vorhandene Weg das trägt“): **trägt nicht.**
  `jmps://` kennt nur `open?show=` (`showOpenUrl`/`parseShowDeepLink` in `packages/show/src/index.ts:362-376`, Behandlung
  im Launcher `apps/launcher/src/main/index.ts:34-35`). Der Knopf ist der Rückruf `onOpenLauncher?: () => void`;
  ohne Rückruf ist er ausgeblendet (6.1). Den Weg schafft der Pilot-Plan.
- **E16 Modus-Wörter:** „offen“/„gesichert“ (Spec 6.2), unbekannter Modus „unbekannt“. Die Launcher-Vollform nutzt dieselben
  Wörter (heute „Sicher“/„Offen“); ihre Knöpfe behalten den Ist-Wortlaut „Aktivieren“, „Erneuern“, „Deaktivieren“.
- **E17 Sperrgrund und Wechsel-Warnung beim Audiogerät** sind Text-Props je Wahl (wie `SectionBase.locked` ein freier Text).
  Die Spec-Sätze stehen als Konstanten bereit (`AUDIO_TEXTE.sperreEingangOffen`, `AUDIO_TEXTE.wechselStoppt`). Hinweis an den
  Owner: Laut Ist-Karte stoppt ein Wechsel im Interpreter nichts, er wirkt erst nach dem Neustart (`App.tsx:435-449`); welcher
  Satz dort gilt, entscheidet dessen Welle.
- **E18 „Bildschirm fehlt“** wird abgeleitet: gewählte `selectedId` (≠ `null`) fehlt in der gemeldeten Liste `screens`. Die Liste
  kommt aus dem Hauptprozess und ist gemessen; `screens === undefined` heißt „Liste unbekannt“ → `unbekannt`.
- **E19 Testhilfe als Paket-Export** `@jm/ui/testhilfe` (`test/harness.ts`), damit `@jm/settings` dieselbe Zählung nutzt.
  Nur Tests importieren sie.
- **E20 Galerie importiert `@jm/settings` relativ** (`../../settings/src/index`), ohne Paket-Abhängigkeit ui → settings
  (kein Workspace-Kreis). Ihre CSS hat `@source "../src"`, `@source "../../settings/src"` und
  `@source not "./pruefe-klassen.ts"` (die Probe nennt die gesuchten Klassen als Text), dazu `body { overflow: auto }` nur in
  `galerie.css` (`base.css` sperrt das Scrollen). Port 5199, `strictPort`, Host `127.0.0.1`. Ausgabe `galerie/dist` (per
  `.gitignore`-Regel `dist` ignoriert).
- **E21 Klassen-Probe nicht in der CI:** `vite build` unter `npm ci --ignore-scripts` auf Linux ist nicht gemessen (native
  Tailwind-/Rollup-Binaries); die Probe läuft in Task 23 und 24 lokal. In der CI sichern die Quellregeln (Task 3, 16) und der
  Galerie-Test (Task 23) dieselbe Fehlerklasse statisch ab.
- **E22 Toolname im Kopf:** `AppShellProps.tool` ist laut 3.1 der Anzeigename „ohne „JM ““; `AppHeader` zeigt daher
  „JM {tool}“ neben dem Logo (wie die heutigen Zweizeiler „JM XYZ“).
- **E23 Kein `--highlight` in neuen Bausteinen.** `--highlight` (Gelb mit 12 % Deckkraft) ist im Bestand die Hover-Fläche
  von `Button`, `Tabs` und `Modal`. Gedämpfte Schrift darauf erreicht dunkel über `--surface-raised` nur 3,60 : 1, über
  `--card` 4,01 : 1 (Task 4, als Befund festgeschrieben). Die neuen Bausteine nutzen für Hover- und Sperrflächen `--muted`
  (`--foreground` darauf dunkel 14,43, hell 16,80) und heben einen Abschnitt im Panel nur über den Rand `--tally-selected`
  hervor, ohne Fläche. Gelb bleibt so „ausgewählt“ vorbehalten (Spec 4.2). Quellregel 8 in Task 3 und die entsprechende
  Regel in Task 16 verbieten `var(--highlight)` in den neuen Dateien beider Pakete. **Bekannte Ausnahme** (Owner-Liste):
  Die Abschnitte in `@jm/settings` rendern den Bestands-`Button` (`variant="primary"`/`"outline"`/`"ghost"`), dessen
  Hover-Fläche `--highlight` ist (`packages/ui/src/components/Button.tsx`; ändern verbietet Spec 4.1). Die Knopfschrift
  `--foreground` erreicht darauf dunkel 11,16/12,41, hell 18,24/17,55 (Task 4), gedämpfte Schrift steht in diesen Knöpfen
  nicht. Im Panel ist Gelb damit nicht ganz „ausgewählt“ vorbehalten; die Alternative wäre ein eigener Knopf in `@jm/ui`.
  Die Quellregeln sehen das nicht, weil die Klasse in einer Bestandsdatei steht.
- **E24 Felder an einer Capability, die Spec 6.2 ohne `*` nennt, und Zusatzfelder aus Anhang A** (Abweichung, Owner).
  NDI „Ausgabe an/aus“ (`capabilities.toggle`) und Bildschirm „Vollbild“ (`capabilities.fullscreen`) erscheinen nur mit
  ihrer Capability: Laut Anhang A hat kein Tool einen NDI-Schalter in den Einstellungen, Vollbild gibt es nur bei Prompter,
  Player und Presenter; feste Felder wären neue Funktion (Spec 10). Felder, die 6.2 nicht nennt, bilden vorhandene Funktion
  aus Anhang A ab, damit beim Umbau nichts verloren geht: Bildschirm „Ausgabe an/aus“ (Titler, 2. Bildschirm),
  Fernsteuerung „Steuerserver an/aus“ (Switcher), iveo „Speaker“ (Rundown, Connect), Gegenstellen „Aktiv“, „Setzen“,
  „Auto“ und die Erklärung (Stage-Display, `ConnectionsPanel` in Battle, Q&A, Rundown). Fundstellen je Feld in Tasks 17–22
  unter „Abweichungen“.
- **E25 DataLink-Texte kommen vom Tool** (Abweichung von Spec 6.1, Owner). `sourceLine`, `notice` und `backLabel` sind
  fertige Texte des Titlers (Q1–Q3, H1–H7, K1) mit Laufzeitdaten (Ordner- und Personennamen). Master-Link 2b R2 ändert
  genau diese Texte gerade im Titler (`lib/datalink-anzeige.ts`); eine Kopie im Paket liefe sofort auseinander. Die
  Quellregel in Task 16 macht jede Prop der Abschnitts-Props rot, deren Name auf …titel/…title/…text/…texte/…label/…labels
  endet, und jede Prop vom Typ `string`, die nicht als Daten-Prop gelistet ist (Namen, Werte, Pfade und Zeitstempel des
  Tools, z. B. `sourceName`, `folder`, `staleSince`). Ausgenommen sind nur diese drei: `DataLinkSectionProps.sourceLine`,
  `.notice` und `.backLabel`. Ob die Texte ins Paket wandern, entscheidet der Owner; umgesetzt würde es im Titler-Pilot
  nach dem Merge von 2b R2.
- **E26 Pegel je Wahl, nicht je Richtung** (Spec 6.2 „je Wahl Pegelanzeige*“, „jede Wahl hat … optional einen Pegel“). Mit
  `capabilities.level` zeigt jede Wahl einen Pegel, für die das Tool einen gemessenen `levelDb` liefert, auch ein Ausgang;
  `levelDb === undefined` heißt „kein Pegel gemeldet“ und zeigt nichts (Regel 7.3), `-Infinity` zeigt „Pegel: kein
  Signal“. `NaN` und `+Infinity` sind keine Messung und zeigen wie `undefined` nichts; ein Wert zwischen −0,5 und 0 dB
  steht als „Pegel: 0 dB“, nicht „-0 dB“. Die erste Fassung zeigte Pegel nur für Eingänge und erfand für `undefined` „kein
  Signal“.
- **E27 Gemeldet ist nicht übernommen** (Zahlenfeld und Text-Entwurf; Spec 3.5 sagt nicht, was ein Feld zeigt, wenn das
  Tool einen gemeldeten Wert nicht übernimmt). `zahlSchritt` (Task 7, `NumberInput` Task 10) und `textSchritt` (Task 17,
  Quellenname und Hintergrundfarbe der Abschnitte) merken sich den gemeldeten Wert (`gesendet`):
  - Verlassen oder Enter melden ihn nicht noch einmal (sonst versuchte etwa jeder Fokuswechsel einen Neustart des
    Steuerservers erneut); erst eine neue Eingabe meldet wieder.
  - Kommt ein Wert von außen, nachdem gemeldet wurde, zeigt das Feld ihn, auch wenn das Tool ihn anders übernimmt (8081
    statt 8080).
  - Bleibt die Antwort `UEBERNAHME_FRIST_MS` = 2 s aus (`starteFrist`, Effekt im Baustein), steht unter dem Feld
    „⚠ Noch nicht übernommen.“ mit `aria-invalid`. Der getippte Text bleibt stehen, Escape stellt den echten Wert her, eine
    späte Antwort schließt den Entwurf. Der Text ist wahr, ob das Tool ablehnt oder nur langsam ist.
  - Die erste Fassung setzte nach Enter still den neuen Wert ein (abgelehnt stand er trotzdem da). Die erste Nachbesserung
    hielt den Entwurf unsichtbar „geändert“ und meldete ihn bei jedem Verlassen erneut (Review-Befund der zweiten Runde).

## Unklarheiten und Abhängigkeiten von außen

- **Kontrast-Befunde im Bestand** (nicht änderbar in Welle 0, Spec 4.1), gemessen als Text auf Fläche:
  dunkel `--destructive-foreground` auf `--destructive` 3,40; dunkel `--accent-foreground` auf `--accent` (50 % Gelb) 4,08 auf
  Hintergrund / 3,86 auf Karte; hell `--success` als Schrift auf Hintergrund 3,40; hell `--warning` als Schrift auf Hintergrund
  2,54; dunkel `--muted-foreground` auf `--highlight` (Hover-Fläche von `Button`, `Tabs`, `Modal`) über `--surface-raised` 3,60
  und über `--card` 4,01 (E23). Der Test schreibt diese Werte fest (Regressionsschutz in beide Richtungen) und druckt sie als
  „Befund“. Ob und wann
  sie angepasst werden, entscheidet der Owner (frühestens mit der Welle, die die betroffenen Stellen umbaut).
- **E1, E2, E3, E4** sind Auslegungen; der Owner nimmt sie bei der Plan-Freigabe zur Kenntnis. **E24 und E25** sind
  Abweichungen von Spec 6.2 bzw. 6.1 und brauchen seine Zustimmung vor Task 16; lehnt er ab, ändern sich nur Tasks 17–22
  (E24) bzw. Task 21 (E25). Die vollständige Liste steht am Ende unter „Vor der Umsetzung“.
- **Spec 6.2 Interpreter-Satz** (E17) stimmt nicht mit dem Code überein; Klärung in Welle 2. Dazu: `Field` stellt jedem
  Sperrgrund „Gesperrt: “ voran, deshalb lautet `AUDIO_TEXTE.sperreEingangOffen` „solange der Eingang offen ist“ (angezeigt:
  „Gesperrt: solange der Eingang offen ist“; Task 20, „Abweichungen“).
- **Datenquellen fehlen heute** für „Neustart nötig“, „Port belegt“, „letzte Änderung“, „Bühne“, „zuletzt: {name}“, „an“ mit
  Rückmeldung (Titler/Caption). Im Fundament sind das optionale Props; ohne Wert zeigt der Abschnitt nichts davon bzw.
  „unbekannt“. Liefern müssen sie die Pilot- und Wellen-Pläne.
- **Aussehen und Bedienung** (Hover, Fokus-Ring, Uhr-Ticken, Hervorhebung, Halten mit Maus/Touch, Ziehfläche auf dem Mac)
  sind ohne Browser nicht messbar. Jede Aufgabe in Block B nennt unter „Für die Galerie“, was der Owner dort sehen muss.
- Beim Zusammensetzen **geklärt** (früher offen): Die Lockfile-Wirkung aller drei Aufgaben ist gemessen (G12). tsx wendet
  `jsx: react-jsx` nur auf Dateien im `include` der tsconfig im Arbeitsverzeichnis an; deshalb nehmen beide Pakete die Quellen
  des anderen ins `include` (Z6, gemessen in Task 16 und 23). `electron-vite build` des Titlers läuft ohne Electron-Binary
  durch (Task 24, 2,5 s); der Ausweichweg mit eigener Vite-Config ist nicht nötig.

## Beim Zusammensetzen: Abweichungen und Entscheidungen

Der Plantext wurde nach dem Zusammensetzen in einer frischen Kopie des Spec-Stands vollständig durchgespielt (Werkzeug liest
jeden Code-Block und jede Vorher/Nachher-Ersetzung wörtlich aus diesem Text; `@jm/*` der Kopie zeigten auf die Kopie). Dabei
entschieden bzw. berichtigt:

- **Z1 Doppelter Platzhalter-Rückfall in `Select` (Task 7 gegen Task 11).** Block A lässt `selectOptionen` bei `value === ''`
  ohne Platzhalter „– bitte wählen –“ liefern; Block B hatte denselben Rückfall zusätzlich in `Select` gebaut (sein Nachbau von
  Task 7 kannte ihn nicht). Mit dem echten Task 7 war die Zeile in `Select` wirkungslos, die Mutationsprobe 11c blieb grün.
  Entscheidung: der Rückfall steht nur in `selectOptionen`; `Select` reicht `placeholder` durch. Neue Probe 11c: Fehl-Option
  ohne `disabled` → 2 `FAIL` (gemessen).
- **Z2 Lockfile in Task 1, 16 und 23 auf demselben Weg.** Von Hand eintragen, dann
  `npm install --ignore-scripts --package-lock-only --offline`. Block C hatte für Task 16 ein volles `npm install` vorgesehen
  (nicht gemessen); das hätte im Worktree auch `node_modules` umgebaut. Gemessen: 9 / 25 / 5+1− Zeilen, keine Version ändert
  sich. Der Link `node_modules/@jm/settings` entsteht erst beim nächsten `npm ci` (CI); dieser Plan braucht ihn nicht (alle
  Läufe der Tasks 16–25 ohne Link grün). Das versteckte `node_modules/.package-lock.json` nennt ihn nach Task 16 schon
  (G12); lokal deshalb `npm ci --ignore-scripts`, nicht `npm install`.
- **Z3 Ort der Mutationsproben.** Gerüst G9 sagte „in einer Kopie“. Die Blöcke haben es verschieden gelöst, jeweils gemessen:
  Block A in einer Kopie von `packages/ui` (`$SP/jm-ui-probe`, eigener Scratchpad), Block B im Plan-Worktree mit Zurückbau per Edit-Werkzeug,
  Block C gegen den Index (`git checkout -- <pfad>`; eine Kopie von `packages/settings` bräuchte eine zweite Junction),
  Task 23 in einer Kopie mit zwei Junctions (der Bau braucht beide Pakete). Entscheidung: so lassen, G9 nennt die drei Orte.
  Das Kopie-Rezept von Block A ist gehärtet: Die alte Junction wird mit `&&` entfernt, bevor `rm -rf` läuft (vorher `;` –
  scheiterte `rmdir`, liefe `rm -rf` trotzdem; Junction-Falle).
- **Z4 Galerie-Test erkannte den Fehlertext an `'⚠ '`.** Der echte `SectionFrame` setzt ⚠ in ein eigenes `aria-hidden`-Span;
  die sieben Fälle `…-fehlertext` waren rot. Jetzt prüft der Test `data-fehler="true"` (Kennzeichen aus Task 16).
- **Z5 Hinweis der Klassen-Probe verglich Teilstrings.** `pl-2` galt als „auch in ui“, weil `AppHeader` `pl-20` enthält; der
  Hinweis nannte 4 Klassen, die Probe a meldete 5 fehlend. Jetzt werden ganze Wörter verglichen (Hinweis und Probe a
  nannten damals 5, seit der Nachbesserung 6, weil `motion-reduce:transition-none` dazukam).
- **Z6 Gegenseitiges `include`.** `packages/settings/tsconfig.json` nimmt `../ui/src` auf (Task 16), `packages/ui/tsconfig.json`
  `../settings/src` (Task 23). Ohne die Zeilen bricht der jeweilige Selbsttest mit `ReferenceError: React is not defined` ab
  (gemessen). Nebenwirkung: `tsc -p packages/ui` prüft die Abschnitte mit; beide Typprüfungen sind grün.
- **Z7 Zusätzliche Dateien und Exporte** gegenüber dem Gerüst, je in ihrer Aufgabe unter „Abweichungen vom Gerüst“ begründet:
  `packages/ui/test/lib/markup.ts` (8), `packages/settings/test/hilfe.ts` (16), `packages/settings/src/entwurf.ts` (17),
  `packages/ui/test/galerie.test.tsx` (23); nur aus ihrer Datei exportiert `EINGABE_KLASSE`, `verbindeIds`, `zahlTaste`,
  `NumberInputAnsicht` (10), `tallyHandler` (9), `panelTaste` (13), `statusKlick`, `zahnradKlick` (15), `Anzeige` (16); aus
  `@jm/settings` zusätzlich `istGesperrt`, `hatFehler`, `ABSCHNITT_TEXTE.gesperrt`/`bitteWaehlen` (16), `SCREEN_AUTO` (18),
  `PEGEL_MIN_DB`, `AudioWahlView` (20), `peerZeileStatus`, `PeerZeileView` (22). Nach dem Review dazu, damit Bindung und
  Effekt-Körper ohne Browser prüfbar sind (je nur aus ihrer Datei, nicht aus `index.ts`): `LIVE_EINTRAG_KLASSE` (5),
  `erzeugeThemeStore`, `themeStore`, `browserHtml` (7), `starteUhr` (8), `tallyKnopfProps`, `tallyGrund`,
  `haltenFuerRender`, `haltenBeiZustand`, `haltenBeiAbbau` (9), `zahlFeldHandler`, `zahlAnsichtHandler` (10),
  `themeKnopfProps` (12), `panelProps`, `panelFokus`, `panelSprung` (13), `PEERS_TEXTE.setzenFuer`/`autoFuer` (22) und
  die Testhilfe `bewegungsVerstoesse` (16). Nach der zweiten Prüfrunde (E27): `textSchritt`, `textZustandAus`,
  `TextZustand`, `TextEreignis` (17, statt `textAussen`) aus `src/entwurf.ts`; `starteFrist` (7) steht zusätzlich in der
  vorhandenen Export-Zeile von `lib/eingabe` in `src/index.ts`, weil `@jm/settings` ihn braucht. `src/index.ts` bekommt
  weiterhin genau 17 Zeilen.
- **Z8 Gleicher Text an zwei Stellen:** „– bitte wählen –“ steht als `UI_TEXTE.bitteWaehlen` in `@jm/ui` (nicht exportiert)
  und als `ABSCHNITT_TEXTE.bitteWaehlen` in `@jm/settings` (G5: Texte je Paket fest); ebenso „Noch nicht übernommen.“ als
  `UI_TEXTE.nochNichtUebernommen` und `ABSCHNITT_TEXTE.nochNichtUebernommen` (E27). Alle vier sind getestet; wer einen
  Wortlaut ändert, ändert beide Stellen.
- **Z9 Lane E:** Task 25 ersetzt die Phasentabelle nicht, sondern stellt die Wellen-Tabelle davor und lässt den alten Text
  wortgleich in einem `<details>`-Block stehen (Muster der Datei, Owner-Regel „alten Text stehen lassen und widerrufen“).
  Die Zeilen 397–398 (Historie) und Abschnitt 3 „Was läuft wann“ (Konflikt mit 2b R2/4b) bleiben unverändert; das Gerüst
  wollte sie umschreiben.
- **Z10 E3-Wert:** hell `--brand-fg-on-dark` auf `--tally-live` ist 5,20 (das Gerüst nannte 5,43 für reines Weiß).

## Gemessene Zählstände

Gemessen nach der zweiten Nachbesserung (Prüfrunde 2) in frischen Kopien des Spec-Stands: der Plantext maschinell und
wörtlich eingespielt, Aufgabe für Aufgabe in Planreihenfolge; je Aufgabe zuerst jeder rote Zwischenstand (Step mit „rot“),
dann der grüne Endstand mit Typprüfung, danach alle Mutationsproben der Aufgabe je allein (danach zurückgebaut). „Rot“ ist
die erste Meldung des roten Laufs, „ok“ die Zahl der `ok`-Zeilen im grünen Lauf (Gesamtstand des Pakets), „Proben“ die
`FAIL`-Zahl je Mutationsprobe in Planreihenfolge. Nach jeder Aufgabe war `npm run typecheck -w @jm/ui` grün, ab Task 16
auch `-w @jm/settings`. Jede `ok`-Zeile, die der Plan als erwartete Ausgabe nennt (486), und jede `FAIL`-Zeile und
`FAIL`-Zahl, die eine Mutationsprobe der Tasks 3–22 nennt, kam im Lauf ihrer Aufgabe vor (maschinell verglichen).

| Task | Rot | `@jm/ui` ok | `@jm/settings` ok | Proben (FAIL je Probe) |
| --- | --- | --- | --- | --- |
| 1 | `ERR_MODULE_NOT_FOUND …test\harness`; ohne tsconfig `ReferenceError: React is not defined` | 8 | – | 1 |
| 2 | `ERR_MODULE_NOT_FOUND …test\lib\css` | 29 | – | 2, 1, 1, 1 |
| 3 | `ENOENT …signal-colors.css` (nach 29 `ok`), dann 2 `FAIL` | 64 | – | 1, 2; Probedateien 1, 1, 2, 1, 1, 1, 1, 1, 1, 1; 1, 1 |
| 4 | `ERR_MODULE_NOT_FOUND …test\lib\oklch` | 158 | – | 5, 6, 4, 2 |
| 5 | `ERR_MODULE_NOT_FOUND …src\lib\status`, dann 1 `FAIL` | 179 | – | 3, 1, 2, 2, 1, 2 |
| 6 | `ERR_MODULE_NOT_FOUND …src\lib\halten` | 190 | – | 4, 1, 2 |
| 7 | `ERR_MODULE_NOT_FOUND …src\lib\theme`, dann 2 `FAIL` | 234 | – | 2, 2, 1, 4, 1, 1, 2, 1, 1, 1 |
| 8 | `ERR_MODULE_NOT_FOUND …components\StatusBar` | 257 | – | 1, 1, 4, 1, 1, 1, 1, 1 |
| 9 | `ERR_MODULE_NOT_FOUND …components\TallyButton` | 294 | – | 2, 2, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1 |
| 10 | `ERR_MODULE_NOT_FOUND …components\Field` | 319 | – | 1, 1, 2, 1, 1, 1, 1, 1, 1 |
| 11 | `ERR_MODULE_NOT_FOUND …components\Select` | 336 | – | 1, 4, 2, 1 |
| 12 | `ERR_MODULE_NOT_FOUND …components\ThemeToggle` | 344 | – | 3, 1, 2, 1, 1 |
| 13 | `ERR_MODULE_NOT_FOUND …components\SettingsPanel` | 363 | – | 2, 1, 2, 1, 1, 1, 1 |
| 14 | `ERR_MODULE_NOT_FOUND …components\AppHeader` | 375 | – | 1, 1, 1 |
| 15 | `ERR_MODULE_NOT_FOUND …components\AppShell` | 393 | – | 1, 1, 1 |
| 16 | Prüfschritt grün (1 `ok`); Gegenprobe `ReferenceError`; dann `ERR_MODULE_NOT_FOUND …settings\src\index` | 393 | 31, dann 45 | 2, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1 |
| 17 | `ERR_MODULE_NOT_FOUND …settings\src\entwurf` (die frühere Angabe `… 'NDI_TEXTE'` war schon vor dieser Runde überholt) | 393 | 94 | 4, 2, 1, 1, 4, 1, 2, 2, 1, 1, 1, 1, 1 |
| 18 | `… 'SCREEN_TEXTE'` | 393 | 136 | 3, 2, 1, 2, 1, 2, 2, 1, 1 |
| 19 | `… 'REMOTE_TEXTE'` | 393 | 195 | 4, 1, 3, 1, 1, 1, 2, 2, 1; M3 erste Ersetzung allein 1 |
| 20 | `… 'AUDIO_TEXTE'` | 393 | 243 | 5, 3, 1, 3, 1, 1, 1, 1, 4, 2, 1, 1 |
| 21 | `… 'IVEO_TEXTE'` | 393 | 295 | 2, 1, 1, 1, 3, 1, 1, 1 |
| 22 | `… 'PEERS_TEXTE'` | 393 | 329 | 3, 2, 3, 1, 3, 1, 1, 1 |
| 23 | `ERR_MODULE_NOT_FOUND …galerie\Galerie`; dann `ReferenceError` in `NdiOutputSection` nach 404 `ok` | 520 | 329 | g 1, h 1, i 1 (Galerie-Test); a–f wie in der ersten Nachbesserung (a 1, b 15, c 2, d 1, e 1, f `TS2322`); Probe ohne Bau 20 `FAIL`, mit Bau 20 `ok` (CSS 36,83 kB, byte-gleich; Klassen 71/30/6) |
| 24 | CI-Datei 16 → 18 Schritte | 520 | 329 | YAML-Gegenprobe `(74:8)`; alle Workspaces 31 / 0 Fehler; Titler-Probe 19 `ok` (CSS 49,37 kB, byte-gleich), Gegenproben 16 und 2 |
| 25 | – (Doku) | 520 | 329 | Zeilennummern 350 352 397 398 430 → 370 372 419 420; Gegenprobe `details: 2 / 1` (vom Schreiber gemessen) |

Lockfile (abgetrennte Kopie ohne `node_modules`): Task 1 +9 Zeilen, Task 16 +25, Task 23 +5/−1; keine Version geändert.
`--package-lock-only` schreibt zusätzlich das versteckte `node_modules/.package-lock.json` (G12).

Nicht in der zweiten Nachbesserung neu gemessen, weil Code, Tests und gebautes CSS dieser Stellen unverändert sind: die
Proben der Tasks 1, 2 und 6 (wie in der ersten Fassung), Task 23 Step 9 a–f (das Galerie-CSS ist byte-gleich, gleicher
Hash) und Step 11 (Dev-Server), Task 24 Steps 1–4 (CI-Datei, YAML-Gegenprobe), 5.4 und 5.6 (Diff und Lockfile; dieser Plan
ändert keine Abhängigkeit) und die Gegenproben 16 und 2 der Titler-Probe (Titler-CSS byte-gleich), Task 25. Die
Typprüfung aller 31 Workspaces lief diesmal ohne Speicher-Abbruch durch (`Exit=0`, 0 `error TS`); in der ersten
Nachbesserung brach ein Lauf bei `@jm/transcribe` mit „JavaScript heap out of memory“ ab und wurde einzeln nachgeholt.

**Nachtrag nach der Umsetzung (09.10.2026):** Diese Tabelle ist der gemessene Stand des Plantexts und bleibt so stehen.
Die Umsetzung weicht an benannten Stellen davon ab (Rulings des Controllers, Fix-Welle); jede Abweichung, die Zählstände
und die offenen Owner-Fragen stehen im Abschnitt „Umsetzung: Abweichungen vom Plantext“ am Ende.

---

## Aufgaben

## Block A · Fundament: Werkzeuge, Bestandsschutz, Tokens, Kontrast, reine Logik (`@jm/ui`)

**Gemeinsam für Block A (Tasks 1–7):**
- Alle Befehle im Bash-Werkzeug (Git Bash) an der Wurzel des Plan-Worktrees; alle Pfade relativ dazu. `npm run … -w @jm/ui`
  startet im Paketordner `packages/ui`, deshalb sind Pfade in Tests (`leseText('src/…')`) relativ zu `packages/ui`.
- Selbsttest: `npm run selftest -w @jm/ui; echo "Exit=$?"`. Zählstand: `npm run selftest -w @jm/ui 2>&1 | grep -c "^ok "`
  (das `| grep` verschluckt den Exitcode, deshalb immer zuerst den Lauf mit `Exit=` lesen).
- Neue Dateien mit dem Write-Werkzeug (LF), bestehende mit dem Edit-Werkzeug (Vorher-Text exakt; das Edit-Werkzeug behält
  das CRLF der Datei). Die Zeilenangaben gelten für `5a14352934` bzw. für den Stand nach der vorigen Aufgabe; maßgeblich ist
  der wortgleiche Vorher-Text.
- Neue Testmodule hängen sich immer gleich ein: in `packages/ui/test/selftest.ts` Vorher `abschluss();` (kommt genau einmal
  vor, letzte Zeile), Nachher die neue Import-Zeile direkt davor und `abschluss();`.
- **Mutationsproben** laufen in einer Kopie von `packages/ui` (G9), nie im Worktree. Die Kopie liegt im **eigenen
  Scratchpad-Ordner der Sitzung** (Systemprompt), nicht unter `/tmp`: Shell-Variablen überleben im Bash-Werkzeug keinen
  Aufruf, deshalb setzt **jeder** Block `SP` und `K` selbst; `<eigener Scratchpad>` ist vor dem Lauf durch diesen Pfad zu
  ersetzen (Variablenkopf G16). Zeigt `SP` auf keinen vorhandenen Ordner, bricht die Kette ab, bevor etwas angelegt oder
  gelöscht wird. Kopie anlegen (ein Bash-Aufruf an der Worktree-Wurzel; die Junction zeigt auf die `node_modules` des
  Worktrees):
  ```
  SP='<eigener Scratchpad>'; K="$SP/jm-ui-probe"; [ -d "$SP" ] && { [ ! -e "$K/node_modules" ] || MSYS_NO_PATHCONV=1 cmd /c rmdir "$(cygpath -w "$K/node_modules")"; } && [ ! -e "$K/node_modules" ] && [ -z "$(MSYS_NO_PATHCONV=1 cmd /c dir /AL /S /B "$(cygpath -w "$K")" 2>/dev/null)" ] && rm -rf "${K:?}" && mkdir -p "$K/packages" && cp -r packages/ui "$K/packages/ui" && MSYS_NO_PATHCONV=1 cmd /c mklink /J "$(cygpath -w "$K/node_modules")" "$(cygpath -w "$PWD/node_modules")" && cygpath -w "$K"
  ```
  Erwartet: `Verbindung erstellt für …\jm-ui-probe\node_modules <<===>> …\node_modules`, danach der Windows-Pfad der Kopie
  (für das Edit-Werkzeug, im Folgenden `<Kopie>`). Eine alte Junction aus einem abgebrochenen Lauf wird zuerst einzeln
  entfernt; scheitert das, bricht die Kette ab, und `rm -rf` läuft nicht (`&&` statt `;`, Junction-Falle). Vor `rm -rf`
  prüft die Kette außerdem, dass `node_modules` weg ist und `cmd /c dir /AL /S /B` in der alten Kopie keinen Reparsepunkt
  mehr findet (zweite Nachbesserung: `rmdir` meldet nicht jeden Fehlschlag über den Exitcode). `MSYS_NO_PATHCONV=1` ist nötig: Ohne ihn macht Git Bash aus `/J` einen Pfad,
  und `cmd` meldet „Ungültige Option“ (gemessen). Lauf in der Kopie:
  ```
  SP='<eigener Scratchpad>'; K="$SP/jm-ui-probe"; [ -d "$K/packages/ui" ] && (cd "$K/packages/ui" && node ../../node_modules/tsx/dist/cli.mjs test/selftest.ts > ../../lauf.txt 2>&1; echo "Exit=$?"; grep -E "^(FAIL|     )|FEHLGESCHLAGEN|ALLE TESTS OK|Error" ../../lauf.txt)
  ```
  (Die Klammern halten das Arbeitsverzeichnis an der Worktree-Wurzel.)
  Jede Probe einzeln einbauen (Edit-Werkzeug in der Kopie), laufen lassen, Ergebnis notieren, mit dem Edit-Werkzeug
  zurückbauen (Nachher → Vorher), dann die nächste. Am Ende **erst die Junction einzeln entfernen, prüfen, dann den Rest**
  (nie `rm -rf` über eine Junction; eine halb angelegte Kopie ohne Junction räumt das Anlegen oben beim nächsten Lauf mit
  auf):
  ```
  SP='<eigener Scratchpad>'; K="$SP/jm-ui-probe"; [ -d "$K/packages" ] && MSYS_NO_PATHCONV=1 cmd /c rmdir "$(cygpath -w "$K/node_modules")" && [ ! -e "$K/node_modules" ] && rm -rf "${K:?}" && echo "Kopie weg" && ls node_modules/.package-lock.json
  ```
  Erwartet: `Kopie weg`, zuletzt `node_modules/.package-lock.json` (die Worktree-`node_modules` sind unberührt). Ohne
  `Kopie weg` ist nichts gelöscht worden (Junction noch da oder `SP` falsch). Gemessen mit gültigem `SP` (angelegt, Lauf,
  zweites Anlegen über eine stehende Kopie, aufgeräumt) und mit leerem `SP` (keine Ausgabe, nichts gelöscht); nach der
  zweiten Nachbesserung zusätzlich mit halb angelegten Kopien: nur Junction ohne `packages` (Aufräumen tut nichts, das
  nächste Anlegen entfernt die Junction und legt neu an), `packages` ohne Junction (Aufräumen bricht am `rmdir` ab, das
  Anlegen räumt auf) und eine verwaiste Junction mit gelöschtem Ziel (Anlegen bricht vor `rm -rf` ab, nichts gelöscht);
  mit nicht ersetztem `SP` keine Ausgabe.
- Gemessen wurde jeder Schritt dieses Blocks in einer Kopie des Spec-Stands (`git archive 5a14352934`, `node_modules` als
  Junction auf einen Worktree mit `npm ci`), Node 24.16, npm 11.17, tsx 4.22.4, TypeScript 5.9.3, React 18.3.1. Die
  angegebenen Ausgaben sind die gemessenen; nur Pfade sind durch `<worktree>` ersetzt. Danach wurde der Plantext selbst
  (jeder Code-Block und jede Vorher/Nachher-Ersetzung) maschinell in eine zweite frische Kopie eingespielt: dieselbe
  Rot/Grün-Folge in jeder Aufgabe, dieselben Zählstände, alle 38 Dateien unter `packages/ui` gleich, Typprüfung grün.
- Zählstände über den Block: nach Task 1 **8**, Task 2 **29**, Task 3 **64**, Task 4 **158**, Task 5 **179**, Task 6 **190**,
  Task 7 **234** `ok`-Zeilen, je ohne `FAIL`, letzte Zeile `ALLE TESTS OK`. Ein ganzer Lauf dauert unter 1 s.
- Beim Zusammensetzen wurde der ganze Plan (Tasks 1–25) noch einmal maschinell aus diesem Text in eine frische Kopie
  eingespielt (Kopf „Gemessene Zählstände“). Für Block A: jede Vorher-Stelle genau einmal gefunden, dieselben Rot-Meldungen,
  dieselben Zählstände, jede Mutationsprobe mit derselben `FAIL`-Zahl.

---

### Task 1: Werkzeuge für `@jm/ui` (tsconfig, Skripte, devDependencies, Testhilfe)

**Spec:** `docs/superpowers/specs/2026-10-08-suite-ux-update-design.md` Abschnitt 11 (Render-Tests ohne Browser mit
`react-dom/server` `renderToStaticMarkup` unter `tsx`; neue Selbsttests `npm run selftest -w @jm/ui`), 3.8 (ohne Electron
lauffähig). Global Constraints G9, G10, G11, G12. Entscheidung E19 (Testhilfe als Paket-Export).

**Arbeitsverzeichnis/Voraussetzung:** Plan-Worktree, Stand `5a14352934`. `node_modules/.package-lock.json` existiert
(`npm ci --ignore-scripts` ist gelaufen). Keine vorige Aufgabe.

**Dateien:**
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/test/harness.ts` (Testhilfe, Paket-Export `@jm/ui/testhilfe`)
- Create: `packages/ui/test/selftest.ts` (Einstieg; Einfügemarke ist die letzte Zeile `abschluss();`)
- Create: `packages/ui/test/werkzeug.test.tsx`
- Modify: `packages/ui/package.json` Zeilen 7–12 (`exports` bekommt `./testhilfe`, danach neues Feld `scripts`) und
  Zeilen 16–20 (neues Feld `devDependencies` nach `peerDependencies`)
- Modify: `package-lock.json` (nur durch `npm install --ignore-scripts --package-lock-only --offline`; ändert nur den Eintrag
  `"packages/ui"`)

**Interfaces:**
- Consumes: `Badge` aus `packages/ui/src/components/Badge.tsx` (Bestand, unverändert; Props `tone?: 'neutral' | 'success' |
  'warning' | 'muted'`, `children`).
- Produces (Gerüst 9.1, exakt; Block B, C und D bauen darauf):
  ```ts
  // packages/ui/test/harness.ts → Export `@jm/ui/testhilfe`
  import type { ReactElement } from 'react';
  export function ok(cond: boolean, msg: string): void;                  // druckt `ok   <msg>` bzw. `FAIL <msg>`, zählt Fehler
  export function gleich<T>(ist: T, soll: T, msg: string): void;         // JSON-Vergleich; bei FAIL zweite Zeile `     ist: … soll: …`
  export function enthaelt(text: string, teil: string, msg: string): void;
  export function enthaeltNicht(text: string, teil: string, msg: string): void;
  export function render(el: ReactElement): string;                      // renderToStaticMarkup
  export function fehlendeIdVerweise(html: string): string[];            // ids aus aria-describedby/-labelledby/-controls und for=, die im HTML fehlen
  export function pruefeIdVerweise(html: string, msg: string): void;     // ok(fehlendeIdVerweise(html).length === 0, msg)
  export function leseText(pfad: string): string;                        // relativ zum cwd (Paketordner), \r\n → \n
  export function abschluss(): void;                                      // `ALLE TESTS OK` bzw. `<n> FEHLGESCHLAGEN`, dann process.exitCode = 1
  ```
  `packages/ui/package.json`: `"exports"` bekommt `"./testhilfe": "./test/harness.ts"`; Skripte
  `"typecheck": "tsc --noEmit -p tsconfig.json"`, `"selftest": "tsx test/selftest.ts"`.

**Verhalten (verbindlich):**
- Ein Testmodul ist eine Datei mit Blöcken auf oberster Ebene, die `ok`/`gleich`/`enthaelt` rufen; es prüft beim Import.
  `selftest.ts` importiert die Testmodule der Reihe nach (ESM wertet Importe vor dem Rumpf aus) und ruft als letzte Zeile
  `abschluss();`.
- `ok` und `FAIL` gehen beide auf stdout (Reihenfolge im Log bleibt erhalten); Detailzeilen sind mit fünf Leerzeichen
  eingerückt. `abschluss()` setzt `process.exitCode = 1`, beendet den Prozess aber nicht hart.
- `fehlendeIdVerweise` liest nur Attribute mit Leerraum davor (`data-for="x"` zählt nicht), zerlegt Listen an Leerraum und
  liefert jede fehlende ID einmal, in der Reihenfolge des Auftretens.
- `@jm/ui/testhilfe` und `./harness` sind **dieselbe** Datei und damit derselbe Zähler (Node löst den eigenen Paketnamen
  über `exports` auf). `@jm/settings` (Block C) importiert nur `@jm/ui/testhilfe`.
- `tsconfig.json` muss `"jsx": "react-jsx"` haben: Ohne sie übersetzt tsx klassisches JSX, und jeder Render-Test bricht mit
  `ReferenceError: React is not defined` ab (Step 6 zeigt das). `include` nennt `galerie` und `vite.config.ts` schon jetzt
  (entstehen in Task 23); fehlende Einträge stören `tsc` nicht (gemessen).
- devDependencies stehen mit **denselben Spannen wie in den Apps** im `package.json` und werden **von Hand** eingetragen,
  nicht mit `npm install -D …` (siehe Abweichungen: das hebt gemessen die gemeinsamen Versionen aller Apps an).

---

- [ ] **Step 0: Ausgangslage (rot, erwartet)**

```
npm run typecheck -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen):
```
npm error Lifecycle script `typecheck` failed with error:
npm error workspace @jm/ui@0.1.0
npm error location <worktree>\packages\ui
npm error Missing script: "typecheck"
…
Exit=1
```
`npm run selftest -w @jm/ui` endet ebenso mit `npm error Missing script: "selftest"` und `Exit=1`.

- [ ] **Step 1: `package.json` – Export der Testhilfe und Skripte** (Edit-Werkzeug, `packages/ui/package.json`)

Ersetzung 1 (Zeilen 7–12), Vorher:
```json
  "exports": {
    ".": "./src/index.ts",
    "./base.css": "./src/base.css",
    "./tokens/colors.css": "./src/tokens/colors.css",
    "./tokens/typography.css": "./src/tokens/typography.css"
  },
```
Nachher:
```json
  "exports": {
    ".": "./src/index.ts",
    "./base.css": "./src/base.css",
    "./tokens/colors.css": "./src/tokens/colors.css",
    "./tokens/typography.css": "./src/tokens/typography.css",
    "./testhilfe": "./test/harness.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "selftest": "tsx test/selftest.ts"
  },
```

Ersetzung 2 (Zeilen 16–20, jetzt 20–24), Vorher:
```json
  "peerDependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
```
Nachher:
```json
  "peerDependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^22.7.5",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  }
}
```
Die Datei sieht danach so aus (zur Kontrolle, nicht neu schreiben):
```json
{
  "name": "@jm/ui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Geteilte JM-Designsprache: Tokens, Basis-Styles und UI-Komponenten",
  "exports": {
    ".": "./src/index.ts",
    "./base.css": "./src/base.css",
    "./tokens/colors.css": "./src/tokens/colors.css",
    "./tokens/typography.css": "./src/tokens/typography.css",
    "./testhilfe": "./test/harness.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "selftest": "tsx test/selftest.ts"
  },
  "dependencies": {
    "@fontsource-variable/manrope": "^5.1.1"
  },
  "peerDependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^22.7.5",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Lockfile nachziehen und prüfen** (G12)

```
npm install --ignore-scripts --package-lock-only --offline; echo "Exit=$?"
git diff --stat package-lock.json
node -e "const P=require('./package-lock.json').packages;const n=['react','react-dom','@types/react','@types/react-dom','@types/node','typescript','tsx'];console.log('unter packages/ui:',Object.keys(P).filter(k=>k.startsWith('packages/ui/node_modules')).length);console.log(n.map(x=>x+'@'+P['node_modules/'+x].version).join(' '));console.log(JSON.stringify(P['packages/ui'].devDependencies))"
```
Erwartet (gemessen in einer abgetrennten Kopie ohne `node_modules`, gleicher Lockfile-Stand):
```
found 0 vulnerabilities
Exit=0
 package-lock.json | 9 +++++++++
 1 file changed, 9 insertions(+)
unter packages/ui: 0
react@18.3.1 react-dom@18.3.1 @types/react@18.3.30 @types/react-dom@18.3.7 @types/node@22.19.19 typescript@5.9.3 tsx@4.22.4
{"@types/node":"^22.7.5","@types/react":"^18.3.12","@types/react-dom":"^18.3.1","react":"^18.3.1","react-dom":"^18.3.1","tsx":"^4.19.2","typescript":"^5.6.3"}
```
Der Lockfile-Diff ist genau der neue Block `"devDependencies"` im Eintrag `"packages/ui"`; keine Version unter
`node_modules/…` ändert sich, nichts wird unter `packages/ui/node_modules` verschachtelt. `--package-lock-only` schreibt nur
`package-lock.json` und das versteckte `node_modules/.package-lock.json` (G12); Paketordner unter `node_modules` bleiben
unberührt (alle Pakete liegen schon gehoben an der Wurzel), `--offline` verhindert jeden Netzzugriff.
Zeigt der Diff mehr als diese 9 Zeilen (etwa eine gehobene Version von `@types/node` oder `tsx`), ist die Aufgabe nicht
fertig: `git checkout -- package-lock.json`, Spannen in `packages/ui/package.json` mit den Apps vergleichen
(`apps/titler/package.json`), erneut laufen lassen.

Zusatzprüfung (nicht gemessen; nur lesend): `npm ls react react-dom @types/react @types/react-dom @types/node typescript tsx -w @jm/ui`
zeigt unter `@jm/ui@0.1.0 -> .\packages\ui` je Paket die Version aus der Zeile oben und keine Zeile mit `invalid` oder
`UNMET`. (Ein `npm ls` über alle Workspaces zeigt schon am Spec-Stand zwei vite-Versionen, `vite@8.1.0` unter `astro` von
`apps/cookbook-web`, und vier `@types/node`-Versionen unter `electron`, `http-response-object`, `sitemap`; das ist Bestand
und kein Fehler dieser Aufgabe.)

- [ ] **Step 3: Fehlschlagende Tests schreiben**

Inhalt von `packages/ui/test/selftest.ts`:
```ts
// ─────────────────────────────────────────────────────────────────────────────
// Selbsttest @jm/ui: npm run selftest -w @jm/ui (tsx, ohne Browser, ohne Electron).
// Jedes Testmodul prüft beim Import (Blöcke auf oberster Ebene), in der Reihenfolge der Importe.
// Neue Testmodule bekommen eine Import-Zeile direkt vor der letzten Zeile.
// ─────────────────────────────────────────────────────────────────────────────

import { abschluss } from './harness';
import './werkzeug.test';
abschluss();
```

Inhalt von `packages/ui/test/werkzeug.test.tsx`:
```tsx
// Task 1 · Werkzeug: Rendern unter tsx mit jsx react-jsx, Zeilenenden, ID-Verweise, Paket-Export der Testhilfe.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as ueberPaket from '@jm/ui/testhilfe';
import { Badge } from '../src/components/Badge';
import { enthaelt, fehlendeIdVerweise, gleich, leseText, ok, render } from './harness';

{
  const html = render(<Badge tone="success">ok</Badge>);
  enthaelt(html, 'text-[var(--success)]', 'Werkzeug: Badge rendert unter tsx mit jsx react-jsx');
  enthaelt(html, '>ok</span>', 'Werkzeug: Inhalt der Badge steht im HTML');
}

{
  const ordner = mkdtempSync(join(tmpdir(), 'jm-ui-'));
  const datei = join(ordner, 'crlf.txt');
  writeFileSync(datei, 'a\r\nb\r\n');
  const text = leseText(datei);
  rmSync(ordner, { recursive: true, force: true });
  gleich(text, 'a\nb\n', 'Werkzeug: leseText normalisiert CRLF');
  ok(!leseText('src/lib/cn.ts').includes('\r'), 'Werkzeug: leseText liest relativ zum Paketordner (src/lib/cn.ts)');
}

{
  gleich(
    fehlendeIdVerweise('<input aria-describedby="x a"><p id="a"></p>'),
    ['x'],
    'Werkzeug: fehlendeIdVerweise findet fehlende id',
  );
  gleich(
    fehlendeIdVerweise('<input aria-describedby="x a"><p id="a"></p><p id="x"></p>'),
    [],
    'Werkzeug: fehlendeIdVerweise – alle ids vorhanden → leer',
  );
  gleich(
    fehlendeIdVerweise('<label for="f"></label><button aria-controls="p" aria-labelledby="l"></button><input id="f">'),
    ['p', 'l'],
    'Werkzeug: fehlendeIdVerweise prüft for, aria-controls und aria-labelledby',
  );
}

{
  ok(ueberPaket.ok === ok, 'Werkzeug: @jm/ui/testhilfe ist dieselbe Testhilfe (ein Zähler)');
}
```

- [ ] **Step 4: Test laufen lassen (rot)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen): tsx bricht beim Laden ab, weil die Testhilfe fehlt:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '<worktree>\packages\ui\test\harness' imported from <worktree>\packages\ui\test\selftest.ts
…
npm error Lifecycle script `selftest` failed with error:
…
Exit=1
```

- [ ] **Step 5: Testhilfe anlegen** (`packages/ui/test/harness.ts`)

```ts
// ─────────────────────────────────────────────────────────────────────────────
// Testhilfe der Selbsttests von @jm/ui und @jm/settings (Export `@jm/ui/testhilfe`).
// Kein Framework: Jede Prüfung druckt `ok   <msg>` oder `FAIL <msg>`; `abschluss()` druckt am Ende
// `ALLE TESTS OK` bzw. `<n> FEHLGESCHLAGEN` und setzt dann den Exitcode 1.
// Läuft unter tsx in Node, ohne Browser und ohne Electron. Nur Tests importieren diese Datei.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

let fehlgeschlagen = 0;

export function ok(cond: boolean, msg: string): void {
  if (cond) {
    console.log(`ok   ${msg}`);
  } else {
    fehlgeschlagen++;
    console.log(`FAIL ${msg}`);
  }
}

/** Vergleich über JSON.stringify (Reihenfolge der Schlüssel zählt). Bei FAIL eine zweite Zeile mit ist/soll. */
export function gleich<T>(ist: T, soll: T, msg: string): void {
  const a = JSON.stringify(ist);
  const b = JSON.stringify(soll);
  ok(a === b, msg);
  if (a !== b) console.log(`     ist: ${a} soll: ${b}`);
}

export function enthaelt(text: string, teil: string, msg: string): void {
  const da = text.includes(teil);
  ok(da, msg);
  if (!da) console.log(`     fehlt: ${teil}`);
}

export function enthaeltNicht(text: string, teil: string, msg: string): void {
  const da = text.includes(teil);
  ok(!da, msg);
  if (da) console.log(`     gefunden: ${teil}`);
}

/** Rendert ohne Browser (react-dom/server). Effekte laufen dabei nicht. */
export function render(el: ReactElement): string {
  return renderToStaticMarkup(el);
}

const VERWEIS = /\s(aria-describedby|aria-labelledby|aria-controls|for)="([^"]*)"/g;
const ID = /\sid="([^"]*)"/g;

/** IDs, auf die aria-describedby, aria-labelledby, aria-controls oder for= zeigen, die im HTML aber fehlen. */
export function fehlendeIdVerweise(html: string): string[] {
  const vorhanden = new Set<string>();
  for (const m of html.matchAll(ID)) vorhanden.add(m[1]);
  const fehlend: string[] = [];
  for (const m of html.matchAll(VERWEIS)) {
    for (const id of m[2].split(/\s+/)) {
      if (id !== '' && !vorhanden.has(id) && !fehlend.includes(id)) fehlend.push(id);
    }
  }
  return fehlend;
}

export function pruefeIdVerweise(html: string, msg: string): void {
  const fehlend = fehlendeIdVerweise(html);
  ok(fehlend.length === 0, msg);
  if (fehlend.length > 0) console.log(`     fehlende ids: ${fehlend.join(', ')}`);
}

/** Liest eine Datei relativ zum Arbeitsverzeichnis (Paketordner) und macht aus \r\n ein \n. */
export function leseText(pfad: string): string {
  return readFileSync(pfad, 'utf8').replace(/\r\n/g, '\n');
}

export function abschluss(): void {
  if (fehlgeschlagen > 0) {
    console.log(`\n${fehlgeschlagen} FEHLGESCHLAGEN`);
    process.exitCode = 1;
  } else {
    console.log('\nALLE TESTS OK');
  }
}
```

- [ ] **Step 6: Gegenprobe ohne tsconfig (rot, erwartet)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen): Ohne `packages/ui/tsconfig.json` übersetzt tsx klassisches JSX:
```
<worktree>\packages\ui\test\werkzeug.test.tsx:10
  const html = render(<Badge tone="success">ok</Badge>);
                      ^

ReferenceError: React is not defined
…
Exit=1
```

- [ ] **Step 7: `packages/ui/tsconfig.json` anlegen**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["node"],
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src", "test", "galerie", "vite.config.ts"]
}
```

- [ ] **Step 8: Test laufen lassen (grün)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
npm run selftest -w @jm/ui 2>&1 | grep -c "^ok "
```
Erwartet (gemessen):
```
ok   Werkzeug: Badge rendert unter tsx mit jsx react-jsx
ok   Werkzeug: Inhalt der Badge steht im HTML
ok   Werkzeug: leseText normalisiert CRLF
ok   Werkzeug: leseText liest relativ zum Paketordner (src/lib/cn.ts)
ok   Werkzeug: fehlendeIdVerweise findet fehlende id
ok   Werkzeug: fehlendeIdVerweise – alle ids vorhanden → leer
ok   Werkzeug: fehlendeIdVerweise prüft for, aria-controls und aria-labelledby
ok   Werkzeug: @jm/ui/testhilfe ist dieselbe Testhilfe (ein Zähler)

ALLE TESTS OK
Exit=0
8
```

- [ ] **Step 9: Mutationsprobe** (Kopie nach „Gemeinsam für Block A“)

Kopie anlegen. In `<Kopie>\packages\ui\test\werkzeug.test.tsx` (Edit-Werkzeug), Vorher:
```ts
  ok(ueberPaket.ok === ok, 'Werkzeug: @jm/ui/testhilfe ist dieselbe Testhilfe (ein Zähler)');
}
```
Nachher:
```ts
  ok(ueberPaket.ok === ok, 'Werkzeug: @jm/ui/testhilfe ist dieselbe Testhilfe (ein Zähler)');
}

ok(false, 'Mutationsprobe: absichtlich falsch');
```
Lauf in der Kopie. Erwartet (gemessen):
```
Exit=1
FAIL Mutationsprobe: absichtlich falsch
1 FEHLGESCHLAGEN
```
Damit ist belegt: ein einziges `FAIL` setzt den Exitcode 1, die CI wird rot. Kopie aufräumen (Junction zuerst).

- [ ] **Step 10: Typprüfung**

```
npm run typecheck -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen): nur die zwei npm-Kopfzeilen (`> @jm/ui@0.1.0 typecheck`, `> tsc --noEmit -p tsconfig.json`), keine
Fehlerzeile, `Exit=0`. (`tsc` löst `@jm/ui/testhilfe` im Paket selbst über `exports` auf.)

- [ ] **Step 11: Commit** (Commit-Text ASCII)

```
git add packages/ui/package.json packages/ui/tsconfig.json packages/ui/test/harness.ts packages/ui/test/selftest.ts packages/ui/test/werkzeug.test.tsx package-lock.json
git status --short
```
Erwartet (die Warnung „LF will be replaced by CRLF“ ist harmlos; fremde Zeilen mit `??` bleiben ungestaged):
```
M  package-lock.json
M  packages/ui/package.json
A  packages/ui/test/harness.ts
A  packages/ui/test/selftest.ts
A  packages/ui/test/werkzeug.test.tsx
A  packages/ui/tsconfig.json
```
Dann:
```
git commit -m "test(ui): Werkzeuge fuer @jm/ui - tsconfig, Selbsttest mit tsx und renderToStaticMarkup, Testhilfe" -m "@jm/ui bekommt eine eigene Typpruefung (tsconfig mit jsx react-jsx) und einen Selbsttest unter tsx, der mit react-dom/server ohne Browser und ohne Electron rendert. Die Testhilfe (ok, gleich, enthaelt, render, fehlendeIdVerweise, leseText, abschluss) ist als @jm/ui/testhilfe exportiert, damit @jm/settings denselben Zaehler nutzt. devDependencies mit denselben Spannen wie die Apps; das Lockfile aendert nur den Eintrag packages/ui." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- G12 sagt „Eintragen per `npm install -D … -w <paket> --ignore-scripts`“. Gemessen (abgetrennte Kopie, `--package-lock-only
  --offline`): Dieser Befehl hebt die gemeinsamen Wurzel-Versionen für **alle** Apps (`@types/node` 22.19.19 → 22.20.4,
  `@types/react` 18.3.30 → 18.3.31, `tsx` 4.22.4 → 4.23.15) und schreibt `^<neueste>` statt der App-Spannen ins
  `package.json`. Deshalb von Hand eintragen und nur `npm install --ignore-scripts --package-lock-only --offline` laufen
  lassen: gemessen genau 9 neue Zeilen im Eintrag `packages/ui`.
- G12-Prüfung „`npm ls …` zeigt je eine Version“ ist am Spec-Stand schon falsch (vite 8.1.0 unter astro, vier `@types/node`).
  Ersetzt durch die Lockfile-Prüfung in Step 2 (nichts unter `packages/ui/node_modules`, Wurzel-Versionen unverändert).
- Zusätzlicher Testfall „@jm/ui/testhilfe ist dieselbe Testhilfe“ (sichert E19: ein Zähler) und ein Fall für `for`,
  `aria-controls`, `aria-labelledby`. `leseText` wird zusätzlich gegen eine Temp-Datei mit CRLF geprüft, weil die
  Repo-Dateien in der CI (Linux) ohnehin LF haben.

---

### Task 2: Bestandsschutz-Test (alte Tokens und Komponenten bleiben gleich)

**Spec:** Abschnitt 4.1 (rein additiv: bestehende Tokens und Komponenten ändern weder Wert noch Aussehen), 15 (Risiko
„Token-Wert ändert sich“). Global Constraints G2, G11. Review Focus 4.

**Arbeitsverzeichnis/Voraussetzung:** Plan-Worktree nach Task 1 (Selbsttest grün mit 8 `ok`).

**Dateien:**
- Create: `packages/ui/test/lib/css.ts` (Custom Properties aus CSS lesen)
- Create: `packages/ui/test/lib/quellen.ts` (Bestandsliste, Hash, neue Quellen)
- Create: `packages/ui/test/bestand.test.ts`
- Modify: `packages/ui/test/selftest.ts` (Import vor `abschluss();`)

**Interfaces:**
- Consumes: Task 1 `ok`, `gleich`, `leseText` aus `./harness`.
- Produces (intern für Tests; Task 3 und 4 nutzen sie, Block B–D über relative Importe aus `packages/ui/test/lib`):
  ```ts
  // packages/ui/test/lib/css.ts
  export interface CssBlock { selektor: string; werte: Record<string, string> }   // selektor whitespace-normalisiert, z. B. ':root, .dark'
  export function leseCustomProperties(css: string): CssBlock[];                 // Kommentare raus, \r\n → \n, nur --name: wert
  export function tokenTabelle(css: string, selektor: string): Record<string, string>;
  // packages/ui/test/lib/quellen.ts
  export function quellHash(text: string): string;                               // sha256 hex über LF-normalisierten Text
  export const BESTAND_DATEIEN: readonly string[];                               // die 13 Dateien aus G2 (relativ zu packages/ui)
  export const NEUE_BASE_IMPORTE: readonly string[];                             // die zwei Zeilen aus G2
  export function neueQuellen(): string[];                                       // alle Dateien unter src/ außer BESTAND_DATEIEN, base.css, index.ts
  ```

**Verhalten (verbindlich):**
- Die Token-Tabellen stehen **wörtlich** im Test (colors.css Zeilen 2–8, 10–37, 39–65; typography.css Zeilen 3–29) und
  werden Token für Token verglichen: Ein FAIL nennt Block und Token mit Ist- und Soll-Wert. Ein neuer Name in einem
  Bestandsblock ist ebenfalls ein FAIL („neue Tokens gehören in eine neue Datei“).
- Die 13 Dateien aus G2 werden über SHA-256 des LF-normalisierten Textes geprüft (gleich unter Windows mit CRLF und unter
  Linux). Die Hashes sind am Spec-Stand gemessen (Step 5 misst sie nach).
- `base.css` wird ohne genau die zwei Zeilen aus `NEUE_BASE_IMPORTE` gehasht: heute fehlen sie, der Test ist also schon
  jetzt grün und bleibt es nach Task 3. Dass sie an der richtigen Stelle stehen, prüft Task 3.
- `index.ts` Zeilen 1–11 wörtlich; neue Export-Zeilen dürfen nur danach kommen (9.8).
- `package.json`: Name, `private`, `type`, die vier alten Exporte, `dependencies` und `peerDependencies` bleiben (neue
  Einträge sind erlaubt; Version und Beschreibung prüft der Test bewusst nicht).
- `neueQuellen()` liefert sortierte, mit `/` getrennte Pfade relativ zu `packages/ui`; Ordner werden rekursiv gelesen. In
  Task 2 ist die Liste noch leer; ab Task 3 wächst sie mit jeder neuen Datei unter `src/` von selbst mit.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Inhalt von `packages/ui/test/bestand.test.ts`:
```ts
// Task 2 · Bestandsschutz (Spec 4.1, Risiko „Token-Wert ändert sich“): Alte Tokens, die neun alten Komponenten,
// cn/titlebar, base.css (außer den zwei neuen Import-Zeilen), index.ts Zeilen 1–11 und die alten Einträge in
// package.json bleiben, wie sie am Spec-Stand 5a14352934 sind. Jede Änderung macht den Selbsttest rot.
import { tokenTabelle } from './lib/css';
import { BESTAND_DATEIEN, NEUE_BASE_IMPORTE, quellHash } from './lib/quellen';
import { gleich, leseText, ok } from './harness';

/** Vergleicht Token für Token; bei FAIL steht jeder abweichende Token mit Ist- und Soll-Wert darunter. */
function pruefeTabelle(ist: Record<string, string>, soll: Record<string, string>, msg: string): void {
  const abweichungen: string[] = [];
  for (const [name, wert] of Object.entries(soll)) {
    if (ist[name] !== wert) abweichungen.push(`${name}: ist ${ist[name] ?? '(fehlt)'} · soll ${wert}`);
  }
  for (const name of Object.keys(ist)) {
    if (!(name in soll)) abweichungen.push(`${name}: neu im Bestandsblock (neue Tokens gehören in eine neue Datei)`);
  }
  ok(abweichungen.length === 0, msg);
  for (const zeile of abweichungen) console.log(`     ${zeile}`);
}

const colors = leseText('src/tokens/colors.css');
const typography = leseText('src/tokens/typography.css');

// colors.css Zeilen 2–8 (Marke), wörtlich
const MARKE: Record<string, string> = {
  '--brand-yellow': 'oklch(0.922 0.187 99.5)',
  '--brand-yellow-soft': 'oklch(0.922 0.187 99.5 / 0.5)',
  '--brand-yellow-dim': 'oklch(0.922 0.187 99.5 / 0.12)',
  '--brand-dark': 'oklch(0.178 0 0)',
  '--brand-fg-on-dark': 'oklch(0.985 0 0)',
};

// colors.css Zeilen 10–37 (`:root, .dark`, Dunkel ist Standard), wörtlich
const DUNKEL: Record<string, string> = {
  '--background': 'oklch(0.178 0 0)',
  '--foreground': 'oklch(0.985 0 0)',
  '--card': 'oklch(0.215 0 0)',
  '--card-foreground': 'oklch(0.985 0 0)',
  '--popover': 'oklch(0.215 0 0)',
  '--popover-foreground': 'oklch(0.985 0 0)',
  '--primary': 'var(--brand-yellow)',
  '--primary-foreground': 'var(--brand-dark)',
  '--secondary': 'oklch(0.27 0 0)',
  '--secondary-foreground': 'oklch(0.985 0 0)',
  '--muted': 'oklch(0.27 0 0)',
  '--muted-foreground': 'oklch(0.65 0 0)',
  '--accent': 'var(--brand-yellow-soft)',
  '--accent-foreground': 'oklch(0.985 0 0)',
  '--highlight': 'var(--brand-yellow-dim)',
  '--destructive': 'oklch(0.65 0.2 27)',
  '--destructive-foreground': 'oklch(0.985 0 0)',
  '--border': 'oklch(0.30 0 0)',
  '--input': 'oklch(0.27 0 0)',
  '--ring': 'var(--brand-yellow)',
  '--slash': 'var(--brand-yellow)',
  '--sidebar': 'oklch(0.10 0 0)',
  '--success': 'oklch(0.72 0.17 145)',
  '--warning': 'var(--brand-yellow)',
};

// colors.css Zeilen 39–65 (`.light`), wörtlich
const HELL: Record<string, string> = {
  '--background': 'oklch(1 0 0)',
  '--foreground': 'oklch(0.178 0 0)',
  '--card': 'oklch(0.985 0 0)',
  '--card-foreground': 'oklch(0.178 0 0)',
  '--popover': 'oklch(1 0 0)',
  '--popover-foreground': 'oklch(0.178 0 0)',
  '--primary': 'var(--brand-dark)',
  '--primary-foreground': 'var(--brand-fg-on-dark)',
  '--secondary': 'oklch(0.96 0 0)',
  '--secondary-foreground': 'oklch(0.178 0 0)',
  '--muted': 'oklch(0.96 0 0)',
  '--muted-foreground': 'oklch(0.45 0 0)',
  '--accent': 'var(--brand-yellow)',
  '--accent-foreground': 'var(--brand-dark)',
  '--highlight': 'var(--brand-yellow-dim)',
  '--destructive': 'oklch(0.55 0.22 27)',
  '--destructive-foreground': 'oklch(0.985 0 0)',
  '--border': 'oklch(0.90 0 0)',
  '--input': 'oklch(0.92 0 0)',
  '--ring': 'var(--brand-dark)',
  '--slash': 'var(--brand-dark)',
  '--sidebar': 'oklch(0.96 0 0)',
  '--success': 'oklch(0.62 0.17 145)',
  '--warning': 'oklch(0.72 0.15 75)',
};

// typography.css Zeilen 3–29, wörtlich
const TYPOGRAFIE: Record<string, string> = {
  '--text-xs': '12px',
  '--text-sm': '13px',
  '--text-base': '15px',
  '--text-lg': '17px',
  '--text-xl': '20px',
  '--text-2xl': '24px',
  '--text-3xl': '30px',
  '--text-4xl': '40px',
  '--text-5xl': '56px',
  '--tracking-tight': '-0.01em',
  '--tracking-normal': '0',
  '--tracking-wide': '0.06em',
  '--tracking-wider': '0.12em',
  '--tracking-widest': '0.14em',
  '--leading-display': '1.05',
  '--leading-tight': '1.15',
  '--leading-snug': '1.35',
  '--leading-normal': '1.55',
  '--leading-relaxed': '1.7',
  '--radius-sm': '2px',
  '--radius': '4px',
  '--radius-md': '6px',
  '--radius-lg': '8px',
  '--radius-xl': '12px',
  '--radius-full': '9999px',
};

pruefeTabelle(tokenTabelle(colors, ':root'), MARKE, 'Bestand: colors.css :root (Marke) – 5 Werte unverändert');
pruefeTabelle(tokenTabelle(colors, ':root, .dark'), DUNKEL, 'Bestand: colors.css :root, .dark – 24 Werte unverändert');
pruefeTabelle(tokenTabelle(colors, '.light'), HELL, 'Bestand: colors.css .light – 24 Werte unverändert');
pruefeTabelle(tokenTabelle(typography, ':root'), TYPOGRAFIE, 'Bestand: typography.css – 25 Werte unverändert');

// SHA-256 über den LF-normalisierten Text, gemessen am Spec-Stand 5a14352934 (08.10.2026).
const HASHES: Record<string, string> = {
  'src/components/Badge.tsx': '20df0b4c3653242a9af5e72b30efc7b2ab11ab1d2c928d92c206f39f36fcb308',
  'src/components/Button.tsx': 'b0f800ccc306da8cc441ca891869624dbcac08abfa94bc559bdef0d419d2120d',
  'src/components/Card.tsx': 'e3423bb22ac0126a5ba347d14fa7f07670e6989742eed8db23a856b8757127fa',
  'src/components/Collapsible.tsx': 'eb38ea288fa50ebeb2ffe0362b7bf62246288ae4840c6558b57ecf9882e357f9',
  'src/components/Logo.tsx': '74a0bbd7dd77f62e0eeea273cf672d032cc2c8571e45324521563fd7c34225ca',
  'src/components/Modal.tsx': '8d0e0f2bf32e473d45bc71a513f6bb9ed25ee2f1f925f55e3b27d412df28322b',
  'src/components/SettingsSection.tsx': 'b19bc60491399993ed22a7dcd734660bb2d58096d6398af9bf099e5365b254d1',
  'src/components/Splitter.tsx': '854b7a4ddff41593b047568033ae253851be3f7965b8675861426a99606020e0',
  'src/components/Tabs.tsx': 'a07fd0ec082a678876084c5504e3de3c8028ff1bcb5f21e6eb7e7dc74ba36982',
  'src/lib/cn.ts': '3320a516fb4c3a5eca6468a22c1383d866d7ddf4414fb9942d7120afdbc89ed3',
  'src/lib/titlebar.ts': '01566bc4fb19d66a3850cac14a305f315c8d3946de014fa2f8fee19b9bd43637',
  'src/tokens/colors.css': 'dcceb8d5ed1ddf02e11a41e57720b109f42bf2c4cc85f70e891c4623dfab886c',
  'src/tokens/typography.css': '2771a2ee8e8ab2a8b5a8580973ea8a4a86d6ae04d5cf89dd592187cc42f0cd41',
};

gleich(Object.keys(HASHES), [...BESTAND_DATEIEN], 'Bestand: Hash-Liste deckt genau BESTAND_DATEIEN (13 Dateien)');
for (const datei of BESTAND_DATEIEN) {
  const ist = quellHash(leseText(datei));
  ok(ist === HASHES[datei], `Bestand: Quelltext unverändert · ${datei}`);
  if (ist !== HASHES[datei]) console.log(`     Hash ist ${ist}`);
}

{
  const ohneNeue = leseText('src/base.css')
    .split('\n')
    .filter((zeile) => !NEUE_BASE_IMPORTE.includes(zeile))
    .join('\n');
  ok(
    quellHash(ohneNeue) === '1a96bddf767f5e45ce5969be6a163e5a184ef361d9446807137e6fcbcc5c72a0',
    'Bestand: base.css ohne die neuen Import-Zeilen unverändert',
  );
}

gleich(
  leseText('src/index.ts').split('\n').slice(0, 11),
  [
    "export { cn } from './lib/cn';",
    "export { dragRegion, noDragRegion, isElectronMac } from './lib/titlebar';",
    "export { Button } from './components/Button';",
    "export { Card } from './components/Card';",
    "export { Badge } from './components/Badge';",
    "export { Logo } from './components/Logo';",
    "export { Splitter } from './components/Splitter';",
    "export { Collapsible } from './components/Collapsible';",
    "export { Modal } from './components/Modal';",
    "export { SettingsSection } from './components/SettingsSection';",
    "export { Tabs, type TabItem } from './components/Tabs';",
  ],
  'Bestand: index.ts Zeilen 1–11 unverändert',
);

{
  const paket = JSON.parse(leseText('package.json')) as Record<string, unknown>;
  const exporte = paket.exports as Record<string, string>;
  gleich(
    {
      name: paket.name,
      private: paket.private,
      type: paket.type,
      exporte: [exporte['.'], exporte['./base.css'], exporte['./tokens/colors.css'], exporte['./tokens/typography.css']],
      dependencies: paket.dependencies,
      peerDependencies: paket.peerDependencies,
    },
    {
      name: '@jm/ui',
      private: true,
      type: 'module',
      exporte: ['./src/index.ts', './src/base.css', './src/tokens/colors.css', './src/tokens/typography.css'],
      dependencies: { '@fontsource-variable/manrope': '^5.1.1' },
      peerDependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
    },
    'Bestand: package.json – alte Einträge unverändert (Name, Exporte, Abhängigkeiten)',
  );
}
```

`packages/ui/test/selftest.ts`, Vorher:
```ts
abschluss();
```
Nachher:
```ts
import './bestand.test';
abschluss();
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen):
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '<worktree>\packages\ui\test\lib\css' imported from <worktree>\packages\ui\test\bestand.test.ts
…
Exit=1
```

- [ ] **Step 3: Hilfen anlegen**

Inhalt von `packages/ui/test/lib/css.ts`:
```ts
// Liest Custom Properties (`--name: wert;`) aus CSS-Text. Nur für die Selbsttests (Bestand, Tokens, Kontrast).
// Erfasst werden die innersten Blöcke `selektor { … }`; ein umgebendes `@layer base { … }` fällt dabei weg.

export interface CssBlock {
  /** Whitespace-normalisiert, Teile mit „, “ verbunden, z. B. ':root, .dark' */
  selektor: string;
  werte: Record<string, string>;
}

function normalisiereSelektor(roh: string): string {
  return roh
    .split(',')
    .map((teil) => teil.trim().replace(/\s+/g, ' '))
    .join(', ');
}

export function leseCustomProperties(css: string): CssBlock[] {
  const text = css.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const bloecke: CssBlock[] = [];
  for (const block of text.matchAll(/([^{};]*)\{([^{}]*)\}/g)) {
    const werte: Record<string, string> = {};
    for (const wert of block[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      werte[wert[1]] = wert[2].trim().replace(/\s+/g, ' ');
    }
    bloecke.push({ selektor: normalisiereSelektor(block[1]), werte });
  }
  return bloecke;
}

/** Alle Werte der Blöcke mit genau diesem Selektor, in Dateireihenfolge (ein späterer Block überschreibt). */
export function tokenTabelle(css: string, selektor: string): Record<string, string> {
  const gesucht = normalisiereSelektor(selektor);
  const tabelle: Record<string, string> = {};
  for (const block of leseCustomProperties(css)) {
    if (block.selektor === gesucht) Object.assign(tabelle, block.werte);
  }
  return tabelle;
}
```

Inhalt von `packages/ui/test/lib/quellen.ts`:
```ts
// Dateilisten und Hashes für Bestandsschutz (Task 2) und Quellregeln (Task 3). Pfade relativ zu packages/ui.
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';

/** SHA-256 (hex) über den Text mit \n statt \r\n: gleich unter Windows (CRLF im Arbeitsbaum) und Linux (CI). */
export function quellHash(text: string): string {
  return createHash('sha256').update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

/** Spec 4.1 / G2: diese Dateien bleiben bytegleich (nach LF-Normalisierung). */
export const BESTAND_DATEIEN: readonly string[] = [
  'src/components/Badge.tsx',
  'src/components/Button.tsx',
  'src/components/Card.tsx',
  'src/components/Collapsible.tsx',
  'src/components/Logo.tsx',
  'src/components/Modal.tsx',
  'src/components/SettingsSection.tsx',
  'src/components/Splitter.tsx',
  'src/components/Tabs.tsx',
  'src/lib/cn.ts',
  'src/lib/titlebar.ts',
  'src/tokens/colors.css',
  'src/tokens/typography.css',
];

/** Die einzigen zwei Zeilen, die base.css bekommt (Task 3, direkt nach `@import "./tokens/typography.css";`). */
export const NEUE_BASE_IMPORTE: readonly string[] = [
  '@import "./tokens/signal-colors.css";',
  '@import "./tokens/sizes.css";',
];

/** Alle Dateien unter src/ außer dem Bestand, base.css und index.ts, sortiert. Wächst mit jeder neuen Datei mit. */
export function neueQuellen(): string[] {
  const alle: string[] = [];
  const lauf = (ordner: string): void => {
    for (const eintrag of readdirSync(ordner, { withFileTypes: true })) {
      const pfad = `${ordner}/${eintrag.name}`;
      if (eintrag.isDirectory()) lauf(pfad);
      else alle.push(pfad);
    }
  };
  lauf('src');
  const ausgenommen = new Set<string>([...BESTAND_DATEIEN, 'src/base.css', 'src/index.ts']);
  return alle.filter((pfad) => !ausgenommen.has(pfad)).sort();
}
```

- [ ] **Step 4: Test laufen lassen (grün)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
npm run selftest -w @jm/ui 2>&1 | grep -c "^ok "
```
Erwartet (gemessen), nach den 8 Werkzeug-Zeilen:
```
ok   Bestand: colors.css :root (Marke) – 5 Werte unverändert
ok   Bestand: colors.css :root, .dark – 24 Werte unverändert
ok   Bestand: colors.css .light – 24 Werte unverändert
ok   Bestand: typography.css – 25 Werte unverändert
ok   Bestand: Hash-Liste deckt genau BESTAND_DATEIEN (13 Dateien)
ok   Bestand: Quelltext unverändert · src/components/Badge.tsx
ok   Bestand: Quelltext unverändert · src/components/Button.tsx
ok   Bestand: Quelltext unverändert · src/components/Card.tsx
ok   Bestand: Quelltext unverändert · src/components/Collapsible.tsx
ok   Bestand: Quelltext unverändert · src/components/Logo.tsx
ok   Bestand: Quelltext unverändert · src/components/Modal.tsx
ok   Bestand: Quelltext unverändert · src/components/SettingsSection.tsx
ok   Bestand: Quelltext unverändert · src/components/Splitter.tsx
ok   Bestand: Quelltext unverändert · src/components/Tabs.tsx
ok   Bestand: Quelltext unverändert · src/lib/cn.ts
ok   Bestand: Quelltext unverändert · src/lib/titlebar.ts
ok   Bestand: Quelltext unverändert · src/tokens/colors.css
ok   Bestand: Quelltext unverändert · src/tokens/typography.css
ok   Bestand: base.css ohne die neuen Import-Zeilen unverändert
ok   Bestand: index.ts Zeilen 1–11 unverändert
ok   Bestand: package.json – alte Einträge unverändert (Name, Exporte, Abhängigkeiten)

ALLE TESTS OK
Exit=0
29
```

- [ ] **Step 5: Gegenprobe – Hashes nachmessen** (lesend, unabhängig vom Test)

```
for p in src/components/Badge.tsx src/components/Button.tsx src/components/Card.tsx src/components/Collapsible.tsx src/components/Logo.tsx src/components/Modal.tsx src/components/SettingsSection.tsx src/components/Splitter.tsx src/components/Tabs.tsx src/lib/cn.ts src/lib/titlebar.ts src/tokens/colors.css src/tokens/typography.css src/base.css; do node -e "const{createHash}=require('node:crypto');const{readFileSync}=require('node:fs');const p=process.argv[1];console.log(createHash('sha256').update(readFileSync('packages/ui/'+p,'utf8').replace(/\r\n/g,'\n')).digest('hex')+' '+p)" "$p"; done
```
Erwartet (gemessen am Spec-Stand; `base.css` hier noch ohne die Zeilen aus Task 3):
```
20df0b4c3653242a9af5e72b30efc7b2ab11ab1d2c928d92c206f39f36fcb308 src/components/Badge.tsx
b0f800ccc306da8cc441ca891869624dbcac08abfa94bc559bdef0d419d2120d src/components/Button.tsx
e3423bb22ac0126a5ba347d14fa7f07670e6989742eed8db23a856b8757127fa src/components/Card.tsx
eb38ea288fa50ebeb2ffe0362b7bf62246288ae4840c6558b57ecf9882e357f9 src/components/Collapsible.tsx
74a0bbd7dd77f62e0eeea273cf672d032cc2c8571e45324521563fd7c34225ca src/components/Logo.tsx
8d0e0f2bf32e473d45bc71a513f6bb9ed25ee2f1f925f55e3b27d412df28322b src/components/Modal.tsx
b19bc60491399993ed22a7dcd734660bb2d58096d6398af9bf099e5365b254d1 src/components/SettingsSection.tsx
854b7a4ddff41593b047568033ae253851be3f7965b8675861426a99606020e0 src/components/Splitter.tsx
a07fd0ec082a678876084c5504e3de3c8028ff1bcb5f21e6eb7e7dc74ba36982 src/components/Tabs.tsx
3320a516fb4c3a5eca6468a22c1383d866d7ddf4414fb9942d7120afdbc89ed3 src/lib/cn.ts
01566bc4fb19d66a3850cac14a305f315c8d3946de014fa2f8fee19b9bd43637 src/lib/titlebar.ts
dcceb8d5ed1ddf02e11a41e57720b109f42bf2c4cc85f70e891c4623dfab886c src/tokens/colors.css
2771a2ee8e8ab2a8b5a8580973ea8a4a86d6ae04d5cf89dd592187cc42f0cd41 src/tokens/typography.css
1a96bddf767f5e45ce5969be6a163e5a184ef361d9446807137e6fcbcc5c72a0 src/base.css
```
Weicht eine Zeile ab, ist der Worktree nicht auf dem Spec-Stand: anhalten und melden, Hashes nicht anpassen.

- [ ] **Step 6: Mutationsprobe** (Kopie nach „Gemeinsam für Block A“; je eine Probe allein, danach zurückbauen)

1. `<Kopie>\packages\ui\src\tokens\colors.css` (Block `:root, .dark`), Vorher
   `    --success:              oklch(0.72 0.17 145);` → Nachher `    --success:              oklch(0.73 0.17 145);`.
   Erwartet (gemessen):
   ```
   Exit=1
   FAIL Bestand: colors.css :root, .dark – 24 Werte unverändert
        --success: ist oklch(0.73 0.17 145) · soll oklch(0.72 0.17 145)
   FAIL Bestand: Quelltext unverändert · src/tokens/colors.css
        Hash ist 6b62ef259b32f4162ea99b1c8d1dc164e4570d38464bb87e533ede33b66fb7e8
   2 FEHLGESCHLAGEN
   ```
2. `<Kopie>\packages\ui\src\components\Button.tsx`, Vorher `  md: 'h-10 px-4 text-sm',` → Nachher `  md: 'h-11 px-4 text-sm',`.
   Erwartet (gemessen):
   ```
   Exit=1
   FAIL Bestand: Quelltext unverändert · src/components/Button.tsx
        Hash ist 211f93cf951e4fe4e8e83e08dab9c3edc822dba5a80e18376c02439cf83f295a
   1 FEHLGESCHLAGEN
   ```
3. `<Kopie>\packages\ui\src\base.css`: eine Leerzeile direkt vor `body {` einfügen (Vorher: Leerzeile + `body {`;
   Nachher: zwei Leerzeilen + `body {`). Erwartet (gemessen):
   ```
   Exit=1
   FAIL Bestand: base.css ohne die neuen Import-Zeilen unverändert
   1 FEHLGESCHLAGEN
   ```
4. `<Kopie>\packages\ui\src\index.ts`: Zeile 3 und 4 tauschen (`export { Card } …` vor `export { Button } …`).
   Erwartet (gemessen; die `ist:`/`soll:`-Zeile ist hier gekürzt):
   ```
   Exit=1
   FAIL Bestand: index.ts Zeilen 1–11 unverändert
        ist: ["export { cn } from './lib/cn';", … "export { Card } from './components/Card';","export { Button } from './components/Button';", …] soll: [ … ]
   1 FEHLGESCHLAGEN
   ```
Kopie aufräumen (Junction zuerst).

- [ ] **Step 7: Typprüfung**

```
npm run typecheck -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen): keine Fehlerzeile, `Exit=0`.

- [ ] **Step 8: Commit**

```
git add packages/ui/test/bestand.test.ts packages/ui/test/lib/css.ts packages/ui/test/lib/quellen.ts packages/ui/test/selftest.ts
git status --short
```
Erwartet:
```
A  packages/ui/test/bestand.test.ts
A  packages/ui/test/lib/css.ts
A  packages/ui/test/lib/quellen.ts
M  packages/ui/test/selftest.ts
```
Dann:
```
git commit -m "test(ui): Bestandsschutz - alte Tokens und Komponenten bleiben bytegleich" -m "Spec 4.1: Die Token-Tabellen aus colors.css und typography.css stehen woertlich im Test und werden Token fuer Token verglichen; die neun Komponenten, cn, titlebar und beide Token-Dateien werden ueber SHA-256 des LF-normalisierten Textes geprueft, base.css ohne die zwei neuen Import-Zeilen, index.ts in den Zeilen 1-11, package.json in den alten Eintraegen. Mutationsprobe: ein Token-Wert, eine Klasse, eine Leerzeile und eine Exportreihenfolge machen den Test je rot." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Zusätzliche Fälle „Hash-Liste deckt genau BESTAND_DATEIEN“ (wer eine Datei aus der Liste nimmt, fällt auf) und
  „package.json – alte Einträge unverändert“ (G2 sagt: nur neue Einträge). Version und Beschreibung sind ausgenommen.
- Die Tabellen werden Token für Token verglichen statt als Ganzes (Review Focus 4: „nennt Datei und Token“).

---

### Task 3: Neue Tokens (Farben mit fester Bedeutung, Flächen, Größen, Dichte) und Quellregeln

> **Nachtrag nach der Umsetzung:** Die Muster der Quellregeln 1 und 9 unten sind überholt. Umgesetzt sind ein weiteres
> Farbmuster (`ROHE_FARBKLASSE`: alle 26 Paletten aus Tailwind 4.3.0 und weitere Präfixe; `current`/`transparent`
> erlaubt) und statt Regel 9 die Regel `TOKEN_OHNE_VAR`; dazu `--field-border` als achtes Token in `signal-colors.css`
> (Task 10). Maßgeblich ist `packages/ui/test/quellregeln.test.ts` im Branch; Grund und Zählstände stehen unter
> „Umsetzung: Abweichungen vom Plantext“ (T3, T10).

**Spec:** Abschnitt 4.1 (nur neue Namen), 4.2 (Farben mit fester Bedeutung, Werte), 4.3 (Panel-Fläche `--surface-raised`,
Größen, Bewegung ≤ 150 ms und `prefers-reduced-motion`), 3.8 (Dichte kompakt: Kopfzeile 36 px, Statusleiste 24 px; ohne
Electron; `localStorage` nur in `try/catch`). Entscheidungen E4, E5, E6. Global Constraints G2, G3, G4, G7, G8.

**Arbeitsverzeichnis/Voraussetzung:** Plan-Worktree nach Task 2 (Selbsttest grün mit 29 `ok`).

**Dateien:**
- Create: `packages/ui/src/tokens/signal-colors.css`
- Create: `packages/ui/src/tokens/sizes.css`
- Create: `packages/ui/test/tokens.test.ts`
- Create: `packages/ui/test/quellregeln.test.ts`
- Modify: `packages/ui/src/base.css` Zeile 8 (`@import "./tokens/typography.css";`, danach die zwei Zeilen aus G2)
- Modify: `packages/ui/package.json` Zeilen 11–12 (`exports`: zwei neue Einträge vor `./testhilfe`)
- Modify: `packages/ui/test/selftest.ts` (zwei Importe vor `abschluss();`)

**Interfaces:**
- Consumes: Task 1 `ok`, `gleich`, `leseText`; Task 2 `leseCustomProperties`, `tokenTabelle`, `neueQuellen`,
  `NEUE_BASE_IMPORTE`.
- Produces (CSS-Namen; Block B nutzt sie nur als Arbiträrklassen `…-[var(--name)]`):
  - `signal-colors.css` (in `@layer base`): Dunkel `:root, .dark` / Hell `.light` je `--tally-live`, `--tally-ready`,
    `--tally-selected`, `--status-warn`, `--status-error`, `--status-off`, `--surface-raised` mit den Werten aus Spec 4.2
    und E4 (Step 3, wörtlich).
  - `sizes.css` (in `@layer base`): `:root { --header-h: 44px; --statusbar-h: 28px; --control-h: 32px; --control-h-lg: 48px;
    --panel-w: 360px; }` und `[data-dichte="kompakt"] { --header-h: 36px; --statusbar-h: 24px; }`.
  - Paket-Exporte `@jm/ui/tokens/signal-colors.css`, `@jm/ui/tokens/sizes.css`.
  - Quellregeln (gelten ab jetzt für **jede** neue Datei unter `packages/ui/src`, auch für Block B), geprüft am Text **ohne
    Kommentare**:
    1. keine rohen Farbklassen (`bg|text|border|ring|outline|fill|stroke|from|to|via` + `-red|green|…|white|black`);
    2. keine zusammengesetzten Klassen: kein `var(--…${`, kein Utility-Präfix direkt vor `${` und kein `prefix-[…${`
       (IDs wie `` `einstellung-${id}` `` bleiben erlaubt);
    3. jede `var(--name)` ist in `colors.css`, `typography.css`, `signal-colors.css` oder `sizes.css` definiert (nicht
       `--font-sans` aus `base.css`, keine Tailwind-Variablen);
    4. kein `window.jm`, kein Import von `electron`, `electron/…`, `@electron…`, `node:…`, kein `ipcRenderer`, kein `process.`;
    5. `localStorage` nur in `src/lib/theme.ts`;
    6. `text-[var(--tally-…` / `text-[var(--status-…` nur in `src/lib/status.ts`;
    7. `transition` nur als `motion-safe:transition…`, `duration-<n>` nur bis 150, kein `duration-[…]`, kein `animate-`;
    8. kein `var(--highlight)` in neuen Bausteinen (E23);
    9. keine Klammer-Kurzform `…-(--name)`: Tailwind v4 erzeugt `text-(--tally-live)` als `color: var(--tally-live)`
       (gemessen mit 4.3.0), die Regeln 2, 3, 6 und 8 suchen aber nach `var(--`. G3 erlaubt nur `…-[var(--…)]`.

**Verhalten (verbindlich):**
- Neue CSS-Dateien deklarieren **nur** Custom Properties, keine Eigenschaft wie `color:` oder `height:` (G2; Test prüft das).
  Kein neuer Name kommt in `colors.css`/`typography.css` vor, kein alter wird neu definiert. Jede Datei hat **genau** ihre
  Blöcke (`signal-colors.css`: `:root, .dark` und `.light`; `sizes.css`: `:root` und `[data-dichte="kompakt"]`) und keine
  At-Regel außer `@layer`: Eine weitere Regel wie `body { --spacing: … }` setzte zwar nur Custom Properties, änderte aber
  Tailwind-Abstände in jeder App.
- `--status-error` und `--status-off` stehen auch im `.light`-Block: Eine Custom Property mit `var()` wird an dem Element
  aufgelöst, an dem sie deklariert ist. Ohne die Wiederholung erbte ein `.light`-Bereich unter dunklem `<html>` (Galerie,
  Task 23) den dunklen Wert.
- `--tally-selected` ist hell `var(--brand-dark)`; die gelbe Kante ist eine Regel der Komponente, nicht des Tokens (E5).
- `[data-dichte="kompakt"]` ändert nur `--header-h` und `--statusbar-h`; `--control-h` bleibt 32 px (E6).
- `base.css` bekommt nur die zwei `@import`-Zeilen direkt nach Zeile 8, vor `@theme`; über `@jm/ui/base.css` erreichen die
  neuen Tokens alle 24 Apps, ohne dass sich ein bestehender Wert ändert.

---

- [ ] **Step 1: Fehlschlagende Tests schreiben**

Inhalt von `packages/ui/test/tokens.test.ts`:
```ts
// Task 3 · Neue Tokens (Spec 4.2, 4.3, 3.8; E4, E5, E6): Werte wörtlich, nur neue Namen, nur Custom Properties,
// über base.css in jede App eingebunden und als Paket-Export erreichbar.
import { leseCustomProperties, tokenTabelle } from './lib/css';
import { NEUE_BASE_IMPORTE } from './lib/quellen';
import { gleich, leseText, ok } from './harness';

const signal = leseText('src/tokens/signal-colors.css');
const groessen = leseText('src/tokens/sizes.css');

// Spec 4.2 (Farben) und E4 (--surface-raised), wörtlich
const SOLL_DUNKEL: Record<string, string> = {
  '--tally-live': 'oklch(0.62 0.23 27)',
  '--tally-ready': 'oklch(0.72 0.17 145)',
  '--tally-selected': 'var(--brand-yellow)',
  '--status-warn': 'oklch(0.76 0.16 60)',
  '--status-error': 'var(--destructive)',
  '--status-off': 'var(--muted-foreground)',
  '--surface-raised': 'oklch(0.25 0 0)',
};
const SOLL_HELL: Record<string, string> = {
  '--tally-live': 'oklch(0.55 0.22 27)',
  '--tally-ready': 'oklch(0.60 0.17 145)',
  '--tally-selected': 'var(--brand-dark)',
  '--status-warn': 'oklch(0.66 0.16 55)',
  '--status-error': 'var(--destructive)',
  '--status-off': 'var(--muted-foreground)',
  '--surface-raised': 'oklch(1 0 0)',
};

const dunkel = tokenTabelle(signal, ':root, .dark');
const hell = tokenTabelle(signal, '.light');
for (const [name, wert] of Object.entries(SOLL_DUNKEL)) ok(dunkel[name] === wert, `Tokens dunkel: ${name} = ${wert}`);
for (const [name, wert] of Object.entries(SOLL_HELL)) ok(hell[name] === wert, `Tokens hell: ${name} = ${wert}`);
gleich(Object.keys(dunkel), Object.keys(SOLL_DUNKEL), 'Tokens dunkel: genau die 7 neuen Namen');
gleich(Object.keys(hell), Object.keys(SOLL_HELL), 'Tokens hell: genau die 7 neuen Namen');

// Spec 4.3 (Größen) und E6 (Dichte), wörtlich
gleich(
  tokenTabelle(groessen, ':root'),
  { '--header-h': '44px', '--statusbar-h': '28px', '--control-h': '32px', '--control-h-lg': '48px', '--panel-w': '360px' },
  'Tokens: Größen 44/28/32/48/360 px',
);
gleich(
  tokenTabelle(groessen, '[data-dichte="kompakt"]'),
  { '--header-h': '36px', '--statusbar-h': '24px' },
  'Tokens: kompakt setzt nur header-h 36 px und statusbar-h 24 px',
);

{
  const bestand = [leseText('src/tokens/colors.css'), leseText('src/tokens/typography.css')]
    .flatMap((css) => leseCustomProperties(css))
    .flatMap((block) => Object.keys(block.werte));
  const neu = [signal, groessen].flatMap((css) => leseCustomProperties(css)).flatMap((block) => Object.keys(block.werte));
  const doppelt = neu.filter((name) => bestand.includes(name));
  ok(doppelt.length === 0, 'Tokens: keine neue Datei definiert einen Bestandsnamen');
  if (doppelt.length > 0) console.log(`     ${doppelt.join(', ')}`);
}

{
  // G2: neue CSS definiert nur Custom Properties, keine Regeln, die bestehendes Markup umfärben oder umbauen.
  const fremd: string[] = [];
  for (const [datei, css] of [['signal-colors.css', signal], ['sizes.css', groessen]] as const) {
    const ohneKommentare = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const block of ohneKommentare.matchAll(/\{([^{}]*)\}/g)) {
      for (const deklaration of block[1].split(';')) {
        const name = deklaration.split(':')[0].trim();
        if (name !== '' && !name.startsWith('--')) fremd.push(`${datei}: ${name}`);
      }
    }
  }
  ok(fremd.length === 0, 'Tokens: neue CSS-Dateien deklarieren nur Custom Properties');
  for (const zeile of fremd) console.log(`     ${zeile}`);
}

{
  // G2: genau diese Blöcke und keine At-Regel außer @layer. Eine weitere Regel (z. B. `body { --spacing: … }` oder
  // `.rounded-md { --tw-ring-color: … }`) träfe bestehendes Markup in jeder App, obwohl sie nur Custom Properties setzt.
  const selektoren = (css: string): string[] => leseCustomProperties(css).map((block) => block.selektor);
  gleich(selektoren(signal), [':root, .dark', '.light'], 'Tokens: signal-colors.css hat genau die Blöcke „:root, .dark“ und „.light“');
  gleich(selektoren(groessen), [':root', '[data-dichte="kompakt"]'], 'Tokens: sizes.css hat genau die Blöcke „:root“ und „[data-dichte="kompakt"]“');
  const atRegeln = [signal, groessen].flatMap((css) => css.replace(/\/\*[\s\S]*?\*\//g, '').match(/@[\w-]+/g) ?? []);
  gleich(atRegeln, ['@layer', '@layer'], 'Tokens: einzige At-Regel ist @layer (kein @theme, @utility, @custom-variant, @import)');
}

{
  const zeilen = leseText('src/base.css').split('\n');
  const typo = zeilen.indexOf('@import "./tokens/typography.css";');
  const theme = zeilen.findIndex((zeile) => zeile.startsWith('@theme'));
  ok(
    typo >= 0 &&
      JSON.stringify(zeilen.slice(typo + 1, typo + 3)) === JSON.stringify(NEUE_BASE_IMPORTE) &&
      theme > typo + 2,
    'Tokens: base.css importiert signal-colors.css und sizes.css direkt nach typography.css, vor @theme',
  );
}

{
  const exporte = (JSON.parse(leseText('package.json')) as { exports: Record<string, string> }).exports;
  ok(
    exporte['./tokens/signal-colors.css'] === './src/tokens/signal-colors.css' &&
      exporte['./tokens/sizes.css'] === './src/tokens/sizes.css',
    'Tokens: package.json exportiert ./tokens/signal-colors.css und ./tokens/sizes.css',
  );
}
```

Inhalt von `packages/ui/test/quellregeln.test.ts`:
```ts
// Task 3 · Quellregeln für jede neue Datei unter src/ (G3, G4, G7, G8). neueQuellen() findet jede neue Datei von
// selbst; die Regeln wachsen also mit jeder späteren Aufgabe mit. Geprüft wird der Text ohne Kommentare.
import { leseCustomProperties } from './lib/css';
import { neueQuellen } from './lib/quellen';
import { leseText, ok } from './harness';

/** Kommentare entfernen, Zeilennummern bleiben gleich (Blockkommentare werden zu Leerzeichen und Zeilenumbrüchen). */
function ohneKommentare(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (kommentar) => kommentar.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

const quellen = neueQuellen();
const code = quellen.filter((pfad) => /\.tsx?$/.test(pfad));

/** Alle Treffer als `pfad:zeile: treffer`. */
function suche(dateien: readonly string[], muster: RegExp, ausnahme?: string): string[] {
  const global = new RegExp(muster.source, muster.flags.includes('g') ? muster.flags : `${muster.flags}g`);
  const treffer: string[] = [];
  for (const pfad of dateien) {
    if (pfad === ausnahme) continue;
    ohneKommentare(leseText(pfad))
      .split('\n')
      .forEach((zeile, i) => {
        for (const m of zeile.matchAll(global)) treffer.push(`${pfad}:${i + 1}: ${m[0]}`);
      });
  }
  return treffer;
}

function regel(treffer: readonly string[], msg: string): void {
  ok(treffer.length === 0, msg);
  for (const zeile of treffer) console.log(`     ${zeile}`);
}

ok(
  quellen.includes('src/tokens/signal-colors.css') &&
    quellen.includes('src/tokens/sizes.css') &&
    !quellen.includes('src/components/Button.tsx') &&
    !quellen.includes('src/base.css') &&
    !quellen.includes('src/index.ts'),
  'Quellregel: neueQuellen findet die neuen Dateien, nicht den Bestand',
);

const UTILITY =
  'bg|text|border|ring|outline|fill|stroke|h|w|min-h|min-w|max-h|max-w|p[xytrbl]?|m[xytrbl]?|gap|rounded|top|left|right|bottom|inset|z|opacity|duration|leading|tracking|font|grid-cols|col-span';

regel(
  suche(
    code,
    /\b(bg|text|border|ring|outline|fill|stroke|from|to|via)-(red|green|yellow|orange|amber|lime|emerald|neutral|gray|zinc|slate|stone|white|black)\b/,
  ),
  'Quellregel: keine rohen Farbklassen',
);

regel(
  [
    ...suche(code, /var\(--[\w-]*\$\{/),
    ...suche(code, new RegExp(`\\b(${UTILITY})-\\$\\{`)),
    ...suche(code, new RegExp(`\\b(${UTILITY})-\\[[^\\]\\s]*\\$\\{`)),
  ],
  'Quellregel: keine zusammengesetzten Klassen',
);

// Tailwind v4 kennt die Kurzform `bg-(--x)` für `bg-[var(--x)]`. Sie liefe an allen Regeln vorbei, die `var(--` suchen.
regel(suche(code, /\b[\w:-]+-\(\s*--/), 'Quellregel: Tokens nur als …-[var(--…)], keine Kurzform …-(--…) (Tailwind v4)');

{
  const definiert = new Set(
    ['src/tokens/colors.css', 'src/tokens/typography.css', 'src/tokens/signal-colors.css', 'src/tokens/sizes.css']
      .flatMap((pfad) => leseCustomProperties(leseText(pfad)))
      .flatMap((block) => Object.keys(block.werte)),
  );
  const fehlend = suche(quellen, /var\(\s*--[\w-]+/).filter((treffer) => {
    const name = treffer.slice(treffer.lastIndexOf('var(') + 4).trim();
    return !definiert.has(name);
  });
  regel(fehlend, 'Quellregel: jede var(--…) ist definiert');
}

regel(
  [
    ...suche(code, /\bwindow\.jm/),
    ...suche(code, /(from\s+|import\s*\(\s*|require\s*\(\s*)['"](electron|electron\/[^'"]*|@electron[^'"]*|node:[^'"]*)['"]/),
    ...suche(code, /\bipcRenderer\b/),
    ...suche(code, /\bprocess\./),
  ],
  'Quellregel: kein window.jm, kein electron-, node:-Import, kein process.',
);

regel(suche(quellen, /\blocalStorage\b/, 'src/lib/theme.ts'), 'Quellregel: localStorage nur in src/lib/theme.ts');

regel(
  suche(quellen, /text-\[var\(--(tally|status)-/, 'src/lib/status.ts'),
  'Quellregel: Statusfarben als Schrift nur in STATUS_SYMBOL_KLASSE (src/lib/status.ts)',
);

regel(
  suche(code, /var\(--highlight\)/),
  'Quellregel: kein --highlight in neuen Bausteinen (Gelb heißt nur „ausgewählt“; gedämpfte Schrift darauf 3,60 : 1, E23)',
);

regel(
  [
    ...suche(code, /(?<!motion-safe:)\btransition\b/),
    ...suche(code, /\banimate-/),
    ...suche(code, /\bduration-\[/),
    ...suche(code, /\bduration-(\d+)/).filter((treffer) => Number(treffer.slice(treffer.lastIndexOf('-') + 1)) > 150),
  ],
  'Quellregel: Übergänge nur motion-safe und höchstens 150 ms, kein animate-',
);
```

`packages/ui/test/selftest.ts`, Vorher:
```ts
abschluss();
```
Nachher:
```ts
import './tokens.test';
import './quellregeln.test';
abschluss();
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen): die 29 bisherigen `ok`-Zeilen, dann bricht der Lauf ab:
```
Error: ENOENT: no such file or directory, open '<worktree>\packages\ui\src\tokens\signal-colors.css'
…
Exit=1
```

- [ ] **Step 3: Token-Dateien anlegen**

Inhalt von `packages/ui/src/tokens/signal-colors.css`:
```css
/*
 * Farben mit fester Bedeutung und die Panel-Fläche (Suite-UX-Update, Spec 4.2 und 4.3).
 * Rein additiv (Spec 4.1): nur neue Namen; colors.css bleibt unverändert.
 * Dunkel ist Standard (:root, .dark), Hell überschreibt (.light), wie in colors.css.
 * --status-error und --status-off stehen in beiden Blöcken, damit der Verweis im jeweiligen Modus aufgelöst wird,
 * auch in einem .light-Bereich unter einem dunklen html-Element (Galerie).
 * Statusfarben färben nur Symbole, Ränder und Flächen, nie Wörter (Kontrast-Klassen: test/kontrast.test.ts).
 */
@layer base {
  :root,
  .dark {
    --tally-live:     oklch(0.62 0.23 27);
    --tally-ready:    oklch(0.72 0.17 145);
    --tally-selected: var(--brand-yellow);
    --status-warn:    oklch(0.76 0.16 60);
    --status-error:   var(--destructive);
    --status-off:     var(--muted-foreground);
    --surface-raised: oklch(0.25 0 0);
  }

  .light {
    --tally-live:     oklch(0.55 0.22 27);
    --tally-ready:    oklch(0.60 0.17 145);
    --tally-selected: var(--brand-dark);
    --status-warn:    oklch(0.66 0.16 55);
    --status-error:   var(--destructive);
    --status-off:     var(--muted-foreground);
    --surface-raised: oklch(1 0 0);
  }
}
```

Inhalt von `packages/ui/src/tokens/sizes.css`:
```css
/*
 * Größen des Sendepults (Suite-UX-Update, Spec 4.3) und die Dichte „kompakt“ (Spec 3.8). Rein additiv, nur neue Namen.
 * AppShell setzt data-dichte an ihr Wurzelelement. Kompakt ändert nur Kopf- und Statuszeile;
 * Bedienelemente bleiben 32 px hoch (Spec 3.5).
 */
@layer base {
  :root {
    --header-h:     44px;
    --statusbar-h:  28px;
    --control-h:    32px;
    --control-h-lg: 48px;
    --panel-w:      360px;
  }

  [data-dichte="kompakt"] {
    --header-h:    36px;
    --statusbar-h: 24px;
  }
}
```

- [ ] **Step 4: Test laufen lassen (noch rot: Einbindung fehlt)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen):
```
FAIL Tokens: base.css importiert signal-colors.css und sizes.css direkt nach typography.css, vor @theme
FAIL Tokens: package.json exportiert ./tokens/signal-colors.css und ./tokens/sizes.css

2 FEHLGESCHLAGEN
Exit=1
```

- [ ] **Step 5: Einbinden** (Edit-Werkzeug)

`packages/ui/src/base.css` Zeile 8, Vorher:
```css
@import "./tokens/typography.css";
```
Nachher:
```css
@import "./tokens/typography.css";
@import "./tokens/signal-colors.css";
@import "./tokens/sizes.css";
```

`packages/ui/package.json` Zeilen 11–12, Vorher:
```json
    "./tokens/typography.css": "./src/tokens/typography.css",
    "./testhilfe": "./test/harness.ts"
```
Nachher:
```json
    "./tokens/typography.css": "./src/tokens/typography.css",
    "./tokens/signal-colors.css": "./src/tokens/signal-colors.css",
    "./tokens/sizes.css": "./src/tokens/sizes.css",
    "./testhilfe": "./test/harness.ts"
```

- [ ] **Step 6: Test laufen lassen (grün)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
npm run selftest -w @jm/ui 2>&1 | grep -c "^ok "
```
Erwartet (gemessen), nach den 29 Zeilen aus Task 1–2 (der Bestandsschutz bleibt grün, obwohl `base.css` jetzt die zwei
Zeilen hat):
```
ok   Tokens dunkel: --tally-live = oklch(0.62 0.23 27)
ok   Tokens dunkel: --tally-ready = oklch(0.72 0.17 145)
ok   Tokens dunkel: --tally-selected = var(--brand-yellow)
ok   Tokens dunkel: --status-warn = oklch(0.76 0.16 60)
ok   Tokens dunkel: --status-error = var(--destructive)
ok   Tokens dunkel: --status-off = var(--muted-foreground)
ok   Tokens dunkel: --surface-raised = oklch(0.25 0 0)
ok   Tokens hell: --tally-live = oklch(0.55 0.22 27)
ok   Tokens hell: --tally-ready = oklch(0.60 0.17 145)
ok   Tokens hell: --tally-selected = var(--brand-dark)
ok   Tokens hell: --status-warn = oklch(0.66 0.16 55)
ok   Tokens hell: --status-error = var(--destructive)
ok   Tokens hell: --status-off = var(--muted-foreground)
ok   Tokens hell: --surface-raised = oklch(1 0 0)
ok   Tokens dunkel: genau die 7 neuen Namen
ok   Tokens hell: genau die 7 neuen Namen
ok   Tokens: Größen 44/28/32/48/360 px
ok   Tokens: kompakt setzt nur header-h 36 px und statusbar-h 24 px
ok   Tokens: keine neue Datei definiert einen Bestandsnamen
ok   Tokens: neue CSS-Dateien deklarieren nur Custom Properties
ok   Tokens: signal-colors.css hat genau die Blöcke „:root, .dark“ und „.light“
ok   Tokens: sizes.css hat genau die Blöcke „:root“ und „[data-dichte="kompakt"]“
ok   Tokens: einzige At-Regel ist @layer (kein @theme, @utility, @custom-variant, @import)
ok   Tokens: base.css importiert signal-colors.css und sizes.css direkt nach typography.css, vor @theme
ok   Tokens: package.json exportiert ./tokens/signal-colors.css und ./tokens/sizes.css
ok   Quellregel: neueQuellen findet die neuen Dateien, nicht den Bestand
ok   Quellregel: keine rohen Farbklassen
ok   Quellregel: keine zusammengesetzten Klassen
ok   Quellregel: Tokens nur als …-[var(--…)], keine Kurzform …-(--…) (Tailwind v4)
ok   Quellregel: jede var(--…) ist definiert
ok   Quellregel: kein window.jm, kein electron-, node:-Import, kein process.
ok   Quellregel: localStorage nur in src/lib/theme.ts
ok   Quellregel: Statusfarben als Schrift nur in STATUS_SYMBOL_KLASSE (src/lib/status.ts)
ok   Quellregel: kein --highlight in neuen Bausteinen (Gelb heißt nur „ausgewählt“; gedämpfte Schrift darauf 3,60 : 1, E23)
ok   Quellregel: Übergänge nur motion-safe und höchstens 150 ms, kein animate-

ALLE TESTS OK
Exit=0
64
```
(Zusätzlich gemessen, nicht Teil des Plans: ein `vite build` mit `@tailwindcss/vite` über eine CSS mit
`@import "tailwindcss"; @import "<packages/ui>/src/base.css";` enthält alle 12 neuen Namen und die Regel
`[data-dichte=kompakt]{--header-h:36px;--statusbar-h:24px}`. Den Bau in einer echten App prüft Task 24.)

- [ ] **Step 7: Mutationsprobe** (Kopie nach „Gemeinsam für Block A“; je eine Probe allein, danach zurückbauen bzw. die
  Probedatei löschen: `SP='<eigener Scratchpad>'; K="$SP/jm-ui-probe"; [ -d "$K/packages/ui" ] && rm "$K/packages/ui/src/components/Probe.tsx"`)

1. `<Kopie>\packages\ui\src\tokens\sizes.css`: `--panel-w:      360px;` → `--panel-w:      400px;`. Erwartet (gemessen):
   ```
   Exit=1
   FAIL Tokens: Größen 44/28/32/48/360 px
        ist: {…,"--panel-w":"400px"} soll: {…,"--panel-w":"360px"}
   1 FEHLGESCHLAGEN
   ```
2. `<Kopie>\packages\ui\src\tokens\signal-colors.css` (`.light`-Block), Vorher
   `    --status-warn:    oklch(0.66 0.16 55);` + Zeilenumbruch + `    --status-error:   var(--destructive);` → Nachher nur
   `    --status-warn:    oklch(0.66 0.16 55);` (die `--status-error`-Zeile des hellen Blocks fällt weg). Erwartet (gemessen):
   ```
   Exit=1
   FAIL Tokens hell: --status-error = var(--destructive)
   FAIL Tokens hell: genau die 7 neuen Namen
        ist: ["--tally-live","--tally-ready","--tally-selected","--status-warn","--status-off","--surface-raised"] soll: […]
   2 FEHLGESCHLAGEN
   ```
3. Probedatei `<Kopie>\packages\ui\src\components\Probe.tsx` (Write-Werkzeug), je eine Fassung, je ein Lauf:

   | Inhalt von `Probe.tsx` | Erwartet (gemessen) |
   | --- | --- |
   | `export const probe = 'bg-red-500';` | `FAIL Quellregel: keine rohen Farbklassen` · `src/components/Probe.tsx:1: bg-red` · `1 FEHLGESCHLAGEN` |
   | ``export const probe = (x: string) => `bg-[var(--${x})]`;`` | `FAIL Quellregel: keine zusammengesetzten Klassen` (`var(--${`, `bg-[var(--${`) · `1 FEHLGESCHLAGEN` |
   | ``export const probe = (s: string) => `border-[var(--tally-${s})]`;`` | `FAIL Quellregel: keine zusammengesetzten Klassen` und `FAIL Quellregel: jede var(--…) ist definiert` (`var(--tally-`) · `2 FEHLGESCHLAGEN` |
   | `export const probe = 'bg-[var(--tally-lve)]';` | `FAIL Quellregel: jede var(--…) ist definiert` · `src/components/Probe.tsx:1: var(--tally-lve` · `1 FEHLGESCHLAGEN` |
   | `export const probe = () => localStorage.getItem('x');` | `FAIL Quellregel: localStorage nur in src/lib/theme.ts` · `1 FEHLGESCHLAGEN` |
   | `export const probe = 'text-[var(--tally-live)]';` | `FAIL Quellregel: Statusfarben als Schrift nur in STATUS_SYMBOL_KLASSE (src/lib/status.ts)` · `1 FEHLGESCHLAGEN` |
   | `export const probe = 'transition-colors duration-300';` | `FAIL Quellregel: Übergänge nur motion-safe und höchstens 150 ms, kein animate-` (`transition`, `duration-300`) · `1 FEHLGESCHLAGEN` |
   | `export const probe = () => process.env.X;` | `FAIL Quellregel: kein window.jm, kein electron-, node:-Import, kein process.` · `1 FEHLGESCHLAGEN` |
   | `export const probe = 'hover:bg-[var(--highlight)]';` | `FAIL Quellregel: kein --highlight in neuen Bausteinen (…)` · `src/components/Probe.tsx:1: var(--highlight)` · `1 FEHLGESCHLAGEN` |
   | `export const probe = 'text-(--tally-live) hover:bg-(--highlight) h-(--control-hx)';` | `FAIL Quellregel: Tokens nur als …-[var(--…)], keine Kurzform …-(--…) (Tailwind v4)` · `src/components/Probe.tsx:1: text-(--`, `…:1: hover:bg-(--`, `…:1: h-(--` · `1 FEHLGESCHLAGEN`: Statusfarbe als Schrift, `--highlight` und der falsche Token meldet sonst keine Regel |

   Jede Fassung endet mit `Exit=1`. Danach die Probedatei löschen.
4. `<Kopie>\packages\ui\src\tokens\sizes.css`: vor der Zeile `  [data-dichte="kompakt"] {` einen weiteren Block
   `  body { --spacing: 0.3rem; --radius-xs: 0px; }` und eine Leerzeile einfügen (setzt nur Custom Properties, träfe aber
   jede App). Erwartet (gemessen):
   ```
   Exit=1
   FAIL Tokens: sizes.css hat genau die Blöcke „:root“ und „[data-dichte="kompakt"]“
        ist: [":root","body","[data-dichte=\"kompakt\"]"] soll: [":root","[data-dichte=\"kompakt\"]"]
   1 FEHLGESCHLAGEN
   ```
5. `<Kopie>\packages\ui\src\tokens\signal-colors.css`: vor der Zeile `  .light {` den Block
   `  .rounded-md, .bg-card { --tw-ring-color: red; }` und eine Leerzeile einfügen (träfe Ringfarben in jeder App).
   Erwartet (gemessen):
   ```
   Exit=1
   FAIL Tokens: signal-colors.css hat genau die Blöcke „:root, .dark“ und „.light“
        ist: [":root, .dark",".rounded-md, .bg-card",".light"] soll: [":root, .dark",".light"]
   1 FEHLGESCHLAGEN
   ```

Kopie aufräumen (Junction zuerst, Rezept „Gemeinsam für Block A“).

- [ ] **Step 8: Typprüfung**

```
npm run typecheck -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen): keine Fehlerzeile, `Exit=0`.

- [ ] **Step 9: Commit**

```
git add packages/ui/src/tokens/signal-colors.css packages/ui/src/tokens/sizes.css packages/ui/src/base.css packages/ui/package.json packages/ui/test/tokens.test.ts packages/ui/test/quellregeln.test.ts packages/ui/test/selftest.ts
git status --short
```
Erwartet:
```
M  packages/ui/package.json
M  packages/ui/src/base.css
A  packages/ui/src/tokens/signal-colors.css
A  packages/ui/src/tokens/sizes.css
A  packages/ui/test/quellregeln.test.ts
M  packages/ui/test/selftest.ts
A  packages/ui/test/tokens.test.ts
```
Dann:
```
git commit -m "feat(ui): Tokens fuer Tally, Status, Flaechen und Groessen (rein additiv) und Quellregeln" -m "Spec 4.2/4.3/3.8: signal-colors.css (tally-live, tally-ready, tally-selected, status-warn, status-error, status-off, surface-raised fuer Dunkel und Hell) und sizes.css (header-h 44, statusbar-h 28, control-h 32, control-h-lg 48, panel-w 360, kompakt 36/24). base.css bekommt nur die zwei Import-Zeilen, kein bestehender Wert aendert sich. Quellregeln fuer jede neue Datei unter src: nur Arbitraerklassen auf definierten Tokens, keine zusammengesetzten Klassen, kein Electron/Node/process, localStorage nur in theme.ts, Statusfarbe als Schrift nur in status.ts, Uebergaenge nur motion-safe bis 150 ms." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Zusätzliche Fälle „genau die 7 neuen Namen“ (je Modus), „neue CSS-Dateien deklarieren nur Custom Properties“ (G2) und
  „neueQuellen findet die neuen Dateien, nicht den Bestand“ (sonst prüften die Quellregeln eine leere Liste und blieben
  grün).
- Quellregel „zusammengesetzte Klassen“ erweitert um `var(--name-${…}` und `prefix-[…${…}` (gemessen: das Gerüst-Muster
  ließ `` `border-[var(--tally-${s})]` `` durch). Quellregel „Übergänge“ prüft zusätzlich `duration-<n> ≤ 150` und
  `duration-[…]` (G8). Die Umgebungsregel prüft zusätzlich `ipcRenderer`.
- Alle Quellregeln lesen den Text **ohne Kommentare** (Zeilennummern bleiben gleich), damit erklärende Kommentare wie
  „`text-[var(--tally-…)]` nur hier“ oder „kein localStorage“ keinen Fehlalarm auslösen. Ein `//` direkt nach `:` (URL) zählt
  nicht als Kommentar.
- Nachbesserung nach dem Review: Die Selektoren beider Dateien und die At-Regeln sind jetzt exakt festgeschrieben (drei
  Fälle). Gemessen blieb vorher `body { --spacing: 0.3rem; --radius-xs: 0px; }` in `sizes.css` bzw.
  `.rounded-md, .bg-card { --tw-ring-color: red; }` in `signal-colors.css` grün (Probe 4). Neue Quellregel 8 „kein
  `--highlight`“ (E23).
- Zweite Nachbesserung (Prüfrunde 2): Quellregel 9 gegen die Tailwind-v4-Kurzform `…-(--name)`. Vorher kamen
  `text-(--tally-live)` (Statusfarbe als Schrift), `hover:bg-(--highlight)` und `h-(--control-hx)` (Token gibt es nicht)
  an allen Regeln vorbei; Tailwind 4.3.0 erzeugt alle drei (gemessen mit `compile(…).build([…])`). Die letzte Probezeile
  in Step 7 zeigt, dass nur Regel 9 sie meldet.

---

### Task 4: Kontrast-Test aus den oklch-Werten (beide Modi)

**Spec:** Abschnitt 4.2 (Kontrast: Text auf allen Flächen mindestens WCAG AA 4,5 : 1, große Schrift 3 : 1; „der Plan misst
die Paare“), 11 (Kontrast-Test aus den oklch-Werten), 8 (beide Modi). Entscheidung E3. Global Constraint G7. Review Focus 5.

**Arbeitsverzeichnis/Voraussetzung:** Plan-Worktree nach Task 3 (Selbsttest grün mit 64 `ok`).

**Dateien:**
- Create: `packages/ui/test/lib/oklch.ts`
- Create: `packages/ui/test/kontrast.test.ts`
- Modify: `packages/ui/test/selftest.ts` (Import vor `abschluss();`)

**Interfaces:**
- Consumes: Task 1 `ok`, `gleich`, `leseText`; Task 2 `tokenTabelle`; Task 3 `signal-colors.css`.
- Produces (intern für Tests):
  ```ts
  // packages/ui/test/lib/oklch.ts
  export type Rgb = [number, number, number];                      // linear sRGB 0..1, geklemmt
  export function parseFarbe(wert: string): { rgb: Rgb; alpha: number } | null;   // 'oklch(L C h)' oder 'oklch(L C h / a)'
  export function loese(name: string, tabelle: Record<string, string>): string;   // var()-Ketten; Zyklus/unbekannt → Error
  export function mische(vorne: Rgb, alpha: number, hinten: Rgb): Rgb;            // im gamma-kodierten sRGB, Ergebnis linear
  export function luminanz(rgb: Rgb): number;                                     // 0.2126 r + 0.7152 g + 0.0722 b
  export function kontrast(a: Rgb, b: Rgb): number;
  export function modusTabelle(modus: 'dunkel' | 'hell'): Record<string, string>; // :root + :root,.dark (+ .light) aus colors.css und signal-colors.css
  ```

**Verhalten (verbindlich):**
- Rechenweg: oklch → OKLab (a = C·cos h, b = C·sin h) → LMS (je hoch 3) → lineares sRGB (auf 0..1 geklemmt) → Luminanz
  Y → Kontrast (Yhell + 0,05)/(Ydunkel + 0,05). Kein Gamma für Y. Durchscheinende Flächen (`--accent` dunkel = Gelb mit
  50 %) werden wie im Browser im gamma-kodierten sRGB über ihre Unterlage gemischt.
- Klassen (E3): **Text** 4,5 : 1 (WCAG 1.4.3), **groß** 3 : 1 (ab 18,66 px fett), **Grafik** 3 : 1 (WCAG 1.4.11:
  Symbole, Ränder, Flächen). Neue Paare müssen ihre Klasse erfüllen:
  - Text: `--foreground` und `--muted-foreground` auf `--surface-raised`; `--primary-foreground` auf `--tally-selected`;
    `--background` auf `--tally-live` (live-Eintrag der Statusleiste und live-`StatusPill`, E14: dunkel 4,63, hell 5,43);
    `--foreground` auf `--muted` (Hover- und Sperrfläche der neuen Bausteine, E23).
  - Groß: `--brand-fg-on-dark` auf `--tally-live` (Text auf der LIVE-Fläche, dunkel 3,90, hell 5,20).
  - Grafik: `--tally-live`, `--tally-ready`, `--status-warn`, `--status-error`, `--status-off`, `--tally-selected` je auf
    `--background`, `--card`, `--surface-raised`; dazu die Ränder auf der Hover-Fläche `--muted`: `--tally-ready`
    (TallyButton „bereit“) und `--tally-selected` (⚙ bei offenem Panel, Task 14).
- Statussymbole stehen nie auf `--muted`: Das ▲ von `--status-warn` erreichte dort hell nur 2,91 : 1, unter 3 für Grafik.
  Der Test schreibt diesen Wert als Begründung fest (wie einen Befund); die Statusleiste hebt einen Knopf beim Hover deshalb
  nur mit Unterstreichung hervor (E14, Task 8).
- Dass Text auf der LIVE-Fläche wirklich groß und fett ist (`LIVE_FLAECHE_KLASSE`: `text-[19px]`, `font-extrabold`), prüft
  **Task 5** (`status.test.ts`), weil `src/lib/status.ts` erst dort entsteht. Dass Statusfarben nie Wörter färben, prüft die
  Quellregel aus Task 3.
- `--highlight` (Gelb mit 12 %, Hover-Fläche von `Button`, `Tabs`, `Modal`) wird als Bestands-Paar über `--surface-raised`
  und `--card` gemessen: gedämpfte Schrift darauf erreicht dunkel nur 3,60 bzw. 4,01. Die neuen Bausteine nutzen
  `--highlight` deshalb gar nicht (E23, Quellregel 8 in Task 3); Hover und Sperre nutzen `--muted`.
- Bestand (je Modus 14 Text-Paare aus `colors.css` und die vier `--highlight`-Paare über `--surface-raised` bzw. `--card`,
  zusammen 18):
  Paare unter 4,5 sind **Befunde** mit festgeschriebenem Wert (±0,01),
  der Test druckt dazu eine Zeile `Befund: …`. Alle übrigen Bestands-Paare müssen 4,5 erreichen. Ein Befund, der sich
  verbessert oder verschlechtert, macht den Test ebenfalls rot (Regressionsschutz in beide Richtungen; ändern darf die
  Werte nur der Owner, Spec 4.1).

---

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Inhalt von `packages/ui/test/kontrast.test.ts`:
```ts
// Task 4 · Kontrast der Token-Paare in Dunkel und Hell, gerechnet aus den oklch-Werten (Spec 4.2, 11; E3, G7).
// Klassen: Text 4,5 : 1 (WCAG 1.4.3), große Schrift 3 : 1 (ab 18,66 px fett), Grafik 3 : 1 (WCAG 1.4.11: Symbole,
// Ränder, Flächen). Neue Paare müssen ihre Klasse erfüllen. Bestands-Paare unter 4,5 sind Befunde: Ihr Wert ist
// festgeschrieben (±0,01), damit sich nichts unbemerkt verschiebt; ändern darf sie nur der Owner (Spec 4.1).
import { kontrast, loese, mische, modusTabelle, parseFarbe, type Rgb } from './lib/oklch';
import { gleich, ok } from './harness';

const zahl = (n: number): string => n.toFixed(2).replace('.', ',');
const grenzText = (n: number): string => String(n).replace('.', ',');

function farbe(wert: string): { rgb: Rgb; alpha: number } {
  const f = parseFarbe(wert);
  if (!f) throw new Error(`keine oklch-Farbe: ${wert}`);
  return f;
}

/** Fläche eines Tokens; eine durchscheinende Fläche wird über ihre Unterlage gemischt. */
function flaeche(name: string, tabelle: Record<string, string>, unterlage?: string): Rgb {
  const f = farbe(loese(name, tabelle));
  if (f.alpha >= 1) return f.rgb;
  if (unterlage === undefined) throw new Error(`${name} ist durchscheinend, die Unterlage fehlt`);
  return mische(f.rgb, f.alpha, flaeche(unterlage, tabelle));
}

function paar(tabelle: Record<string, string>, vorne: string, hinten: string, unterlage?: string): number {
  const h = flaeche(hinten, tabelle, unterlage);
  const v = farbe(loese(vorne, tabelle));
  return kontrast(v.alpha >= 1 ? v.rgb : mische(v.rgb, v.alpha, h), h);
}

// ── Werkzeug ──
{
  const weiss = farbe('oklch(1 0 0)').rgb;
  ok(Math.abs(kontrast(weiss, farbe('oklch(0 0 0)').rgb) - 21) <= 0.01, 'Kontrast: Referenz Weiß/Schwarz = 21,00');
  ok(Math.abs(kontrast(farbe('oklch(0.178 0 0)').rgb, weiss) - 18.87) <= 0.01, 'Kontrast: oklch(0.178 0 0) auf Weiß = 18,87');
  gleich(
    [parseFarbe('oklch(0.922 0.187 99.5 / 0.5)')?.alpha, parseFarbe('oklch(1 0 0)')?.alpha, parseFarbe('#ffffff'), parseFarbe('var(--x)')],
    [0.5, 1, null, null],
    'Kontrast: parseFarbe liest Alpha und lehnt andere Schreibweisen ab',
  );
  ok(loese('--primary', modusTabelle('dunkel')) === 'oklch(0.922 0.187 99.5)', 'Kontrast: loese folgt var()-Ketten (--primary → --brand-yellow)');
  let zyklus = '';
  let fehlt = '';
  try {
    loese('--a', { '--a': 'var(--b)', '--b': 'var(--a)' });
  } catch (e) {
    zyklus = (e as Error).message;
  }
  try {
    loese('--gibt-es-nicht', {});
  } catch (e) {
    fehlt = (e as Error).message;
  }
  ok(zyklus.startsWith('Zyklus') && fehlt.startsWith('unbekannt'), 'Kontrast: loese meldet Zyklus und unbekannten Namen');
}

// ── Neue Paare (müssen ihre Klasse erfüllen) ──
const GRENZE = { Text: 4.5, groß: 3, Grafik: 3 } as const;
type Klasse = keyof typeof GRENZE;

const NEUE_PAARE: Array<[vorne: string, hinten: string, klasse: Klasse]> = [
  ['--foreground', '--surface-raised', 'Text'],
  ['--muted-foreground', '--surface-raised', 'Text'],
  ['--primary-foreground', '--tally-selected', 'Text'],
  ['--brand-fg-on-dark', '--tally-live', 'groß'],
  // live-Eintrag der Statusleiste und live-StatusPill (E14): normale Schrift in Hintergrundfarbe auf der roten Fläche
  ['--background', '--tally-live', 'Text'],
  // Hover- und Sperrfläche der neuen Bausteine (E23): --muted statt --highlight
  ['--foreground', '--muted', 'Text'],
];
for (const zeichen of ['--tally-live', '--tally-ready', '--status-warn', '--status-error', '--status-off', '--tally-selected']) {
  for (const grund of ['--background', '--card', '--surface-raised']) NEUE_PAARE.push([zeichen, grund, 'Grafik']);
}
// Ränder auf der Hover-Fläche --muted: grüne Kante des TallyButton „bereit“ und Rand des ⚙ bei offenem Panel (Task 9, 14)
NEUE_PAARE.push(['--tally-ready', '--muted', 'Grafik'], ['--tally-selected', '--muted', 'Grafik']);

for (const modus of ['dunkel', 'hell'] as const) {
  const tabelle = modusTabelle(modus);
  for (const [vorne, hinten, klasse] of NEUE_PAARE) {
    const wert = paar(tabelle, vorne, hinten);
    ok(
      wert >= GRENZE[klasse],
      `Kontrast ${modus}: ${vorne} auf ${hinten} ≥ ${grenzText(GRENZE[klasse])} (${klasse}) · ${zahl(wert)}`,
    );
  }
}

// Statussymbole stehen nie auf --muted: das ▲ von --status-warn erreichte dort hell nur 2,91 : 1 (Grafik 3 : 1). Deshalb
// hebt die Statusleiste einen Knopf beim Hover nur mit Unterstreichung hervor (E14, Task 8). Festgeschrieben wie ein
// Befund: Ändert sich der Wert, wird der Test rot, und die Entscheidung ist neu zu prüfen.
{
  const wert = paar(modusTabelle('hell'), '--status-warn', '--muted');
  ok(
    Math.abs(wert - 2.91) <= 0.01,
    `Kontrast hell: --status-warn auf --muted = 2,91, unter 3 (Grafik) – Statussymbole nie auf der Hover-Fläche (E14) · ${zahl(wert)}`,
  );
}

// ── Bestand: Text-Paare aus colors.css ──
const BESTAND: Array<[vorne: string, hinten: string, unterlage?: string]> = [
  ['--foreground', '--background'],
  ['--card-foreground', '--card'],
  ['--popover-foreground', '--popover'],
  ['--primary-foreground', '--primary'],
  ['--secondary-foreground', '--secondary'],
  ['--muted-foreground', '--background'],
  ['--muted-foreground', '--card'],
  ['--muted-foreground', '--secondary'],
  ['--muted-foreground', '--muted'],
  ['--destructive-foreground', '--destructive'],
  ['--accent-foreground', '--accent', '--background'],
  ['--accent-foreground', '--accent', '--card'],
  ['--success', '--background'],
  ['--warning', '--background'],
  // --highlight (Gelb mit 12 %) ist die Hover-Fläche von Button, Tabs und Modal. Gemessen über der Panel-Fläche und
  // der Karte; die neuen Bausteine nutzen es deshalb nicht (E23, Quellregel 8 in Task 3).
  ['--foreground', '--highlight', '--surface-raised'],
  ['--foreground', '--highlight', '--card'],
  ['--muted-foreground', '--highlight', '--surface-raised'],
  ['--muted-foreground', '--highlight', '--card'],
];

// Gemessen am Spec-Stand 5a14352934 (08.10.2026). Nicht änderbar in Welle 0 (Spec 4.1); der Owner entscheidet.
const BEFUND: Record<string, number> = {
  'dunkel: --destructive-foreground auf --destructive': 3.4,
  'dunkel: --accent-foreground auf --accent (über --background)': 4.08,
  'dunkel: --accent-foreground auf --accent (über --card)': 3.86,
  'dunkel: --muted-foreground auf --highlight (über --surface-raised)': 3.6,
  'dunkel: --muted-foreground auf --highlight (über --card)': 4.01,
  'hell: --success auf --background': 3.4,
  'hell: --warning auf --background': 2.54,
};

for (const modus of ['dunkel', 'hell'] as const) {
  const tabelle = modusTabelle(modus);
  for (const [vorne, hinten, unterlage] of BESTAND) {
    const schluessel = `${modus}: ${vorne} auf ${hinten}${unterlage ? ` (über ${unterlage})` : ''}`;
    const wert = paar(tabelle, vorne, hinten, unterlage);
    const befund = BEFUND[schluessel];
    if (befund !== undefined) {
      ok(Math.abs(wert - befund) <= 0.01, `Kontrast Bestand ${schluessel} = ${zahl(befund)} (Befund, festgeschrieben) · ${zahl(wert)}`);
      console.log(`Befund: ${schluessel} ${zahl(wert)} : 1, unter 4,5 für Text`);
    } else {
      ok(wert >= 4.5, `Kontrast Bestand ${schluessel} ≥ 4,5 (Text) · ${zahl(wert)}`);
    }
  }
}
```

`packages/ui/test/selftest.ts`, Vorher:
```ts
abschluss();
```
Nachher:
```ts
import './kontrast.test';
abschluss();
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen):
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '<worktree>\packages\ui\test\lib\oklch' imported from <worktree>\packages\ui\test\kontrast.test.ts
…
Exit=1
```

- [ ] **Step 3: Rechenweg anlegen** (`packages/ui/test/lib/oklch.ts`)

```ts
// Kontrast nach WCAG 2.x aus oklch-Werten, nur für die Selbsttests (Task 4).
// Rechenweg: oklch → OKLab (a = C·cos h, b = C·sin h) → LMS (hoch 3) → lineares sRGB (auf 0..1 geklemmt)
// → Luminanz Y = 0,2126 r + 0,7152 g + 0,0722 b → Kontrast (Yhell + 0,05) / (Ydunkel + 0,05).
// Durchscheinende Farben mischt der Browser im gamma-kodierten sRGB; mische() tut dasselbe.
import { leseText } from '../harness';
import { tokenTabelle } from './css';

/** Lineares sRGB, je Kanal 0..1 (geklemmt). */
export type Rgb = [number, number, number];

const OKLCH = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/;

const klemme = (x: number): number => Math.min(1, Math.max(0, x));

/** 'oklch(L C h)' oder 'oklch(L C h / a)'; alles andere → null. */
export function parseFarbe(wert: string): { rgb: Rgb; alpha: number } | null {
  const m = OKLCH.exec(wert.trim());
  if (!m) return null;
  const L = Number(m[1]);
  const C = Number(m[2]);
  const h = (Number(m[3]) * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb: Rgb = [
    klemme(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s),
    klemme(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s),
    klemme(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s),
  ];
  return { rgb, alpha: m[4] === undefined ? 1 : Number(m[4]) };
}

/** Folgt var()-Ketten bis zu einem Wert ohne var(). Zyklus oder unbekannter Name → Error. */
export function loese(name: string, tabelle: Record<string, string>): string {
  const gesehen: string[] = [];
  let aktuell = name;
  for (;;) {
    if (gesehen.includes(aktuell)) throw new Error(`Zyklus: ${[...gesehen, aktuell].join(' → ')}`);
    gesehen.push(aktuell);
    const wert = tabelle[aktuell];
    if (wert === undefined) throw new Error(`unbekannt: ${aktuell}`);
    const verweis = /^var\(\s*(--[\w-]+)\s*\)$/.exec(wert);
    if (!verweis) return wert;
    aktuell = verweis[1];
  }
}

const kodiere = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const dekodiere = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** `vorne` mit Deckkraft `alpha` über `hinten`, gemischt im gamma-kodierten sRGB; Ergebnis wieder linear. */
export function mische(vorne: Rgb, alpha: number, hinten: Rgb): Rgb {
  return [0, 1, 2].map((i) => dekodiere(kodiere(vorne[i]) * alpha + kodiere(hinten[i]) * (1 - alpha))) as Rgb;
}

export function luminanz(rgb: Rgb): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

export function kontrast(a: Rgb, b: Rgb): number {
  const ya = luminanz(a);
  const yb = luminanz(b);
  return (Math.max(ya, yb) + 0.05) / (Math.min(ya, yb) + 0.05);
}

/** Alle Tokens eines Modus: Marke (:root), Dunkel (:root, .dark), für Hell darüber .light; je aus colors.css und signal-colors.css. */
export function modusTabelle(modus: 'dunkel' | 'hell'): Record<string, string> {
  const colors = leseText('src/tokens/colors.css');
  const signal = leseText('src/tokens/signal-colors.css');
  const tabelle: Record<string, string> = {
    ...tokenTabelle(colors, ':root'),
    ...tokenTabelle(colors, ':root, .dark'),
    ...tokenTabelle(signal, ':root, .dark'),
  };
  if (modus === 'hell') Object.assign(tabelle, tokenTabelle(colors, '.light'), tokenTabelle(signal, '.light'));
  return tabelle;
}
```

- [ ] **Step 4: Test laufen lassen (grün)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
npm run selftest -w @jm/ui 2>&1 | grep -c "^ok "
```
Erwartet (gemessen), nach den 64 Zeilen aus Task 1–3:
```
ok   Kontrast: Referenz Weiß/Schwarz = 21,00
ok   Kontrast: oklch(0.178 0 0) auf Weiß = 18,87
ok   Kontrast: parseFarbe liest Alpha und lehnt andere Schreibweisen ab
ok   Kontrast: loese folgt var()-Ketten (--primary → --brand-yellow)
ok   Kontrast: loese meldet Zyklus und unbekannten Namen
ok   Kontrast dunkel: --foreground auf --surface-raised ≥ 4,5 (Text) · 15,32
ok   Kontrast dunkel: --muted-foreground auf --surface-raised ≥ 4,5 (Text) · 4,95
ok   Kontrast dunkel: --primary-foreground auf --tally-selected ≥ 4,5 (Text) · 14,93
ok   Kontrast dunkel: --brand-fg-on-dark auf --tally-live ≥ 3 (groß) · 3,90
ok   Kontrast dunkel: --background auf --tally-live ≥ 4,5 (Text) · 4,63
ok   Kontrast dunkel: --foreground auf --muted ≥ 4,5 (Text) · 14,43
ok   Kontrast dunkel: --tally-live auf --background ≥ 3 (Grafik) · 4,63
ok   Kontrast dunkel: --tally-live auf --card ≥ 3 (Grafik) · 4,30
ok   Kontrast dunkel: --tally-live auf --surface-raised ≥ 3 (Grafik) · 3,93
ok   Kontrast dunkel: --tally-ready auf --background ≥ 3 (Grafik) · 8,10
ok   Kontrast dunkel: --tally-ready auf --card ≥ 3 (Grafik) · 7,52
ok   Kontrast dunkel: --tally-ready auf --surface-raised ≥ 3 (Grafik) · 6,87
ok   Kontrast dunkel: --status-warn auf --background ≥ 3 (Grafik) · 8,44
ok   Kontrast dunkel: --status-warn auf --card ≥ 3 (Grafik) · 7,83
ok   Kontrast dunkel: --status-warn auf --surface-raised ≥ 3 (Grafik) · 7,16
ok   Kontrast dunkel: --status-error auf --background ≥ 3 (Grafik) · 5,31
ok   Kontrast dunkel: --status-error auf --card ≥ 3 (Grafik) · 4,93
ok   Kontrast dunkel: --status-error auf --surface-raised ≥ 3 (Grafik) · 4,51
ok   Kontrast dunkel: --status-off auf --background ≥ 3 (Grafik) · 5,83
ok   Kontrast dunkel: --status-off auf --card ≥ 3 (Grafik) · 5,42
ok   Kontrast dunkel: --status-off auf --surface-raised ≥ 3 (Grafik) · 4,95
ok   Kontrast dunkel: --tally-selected auf --background ≥ 3 (Grafik) · 14,93
ok   Kontrast dunkel: --tally-selected auf --card ≥ 3 (Grafik) · 13,86
ok   Kontrast dunkel: --tally-selected auf --surface-raised ≥ 3 (Grafik) · 12,66
ok   Kontrast dunkel: --tally-ready auf --muted ≥ 3 (Grafik) · 6,47
ok   Kontrast dunkel: --tally-selected auf --muted ≥ 3 (Grafik) · 11,92
ok   Kontrast hell: --foreground auf --surface-raised ≥ 4,5 (Text) · 18,87
ok   Kontrast hell: --muted-foreground auf --surface-raised ≥ 4,5 (Text) · 7,44
ok   Kontrast hell: --primary-foreground auf --tally-selected ≥ 4,5 (Text) · 18,07
ok   Kontrast hell: --brand-fg-on-dark auf --tally-live ≥ 3 (groß) · 5,20
ok   Kontrast hell: --background auf --tally-live ≥ 4,5 (Text) · 5,43
ok   Kontrast hell: --foreground auf --muted ≥ 4,5 (Text) · 16,80
ok   Kontrast hell: --tally-live auf --background ≥ 3 (Grafik) · 5,43
ok   Kontrast hell: --tally-live auf --card ≥ 3 (Grafik) · 5,20
ok   Kontrast hell: --tally-live auf --surface-raised ≥ 3 (Grafik) · 5,43
ok   Kontrast hell: --tally-ready auf --background ≥ 3 (Grafik) · 3,68
ok   Kontrast hell: --tally-ready auf --card ≥ 3 (Grafik) · 3,53
ok   Kontrast hell: --tally-ready auf --surface-raised ≥ 3 (Grafik) · 3,68
ok   Kontrast hell: --status-warn auf --background ≥ 3 (Grafik) · 3,27
ok   Kontrast hell: --status-warn auf --card ≥ 3 (Grafik) · 3,14
ok   Kontrast hell: --status-warn auf --surface-raised ≥ 3 (Grafik) · 3,27
ok   Kontrast hell: --status-error auf --background ≥ 3 (Grafik) · 5,43
ok   Kontrast hell: --status-error auf --card ≥ 3 (Grafik) · 5,20
ok   Kontrast hell: --status-error auf --surface-raised ≥ 3 (Grafik) · 5,43
ok   Kontrast hell: --status-off auf --background ≥ 3 (Grafik) · 7,44
ok   Kontrast hell: --status-off auf --card ≥ 3 (Grafik) · 7,13
ok   Kontrast hell: --status-off auf --surface-raised ≥ 3 (Grafik) · 7,44
ok   Kontrast hell: --tally-selected auf --background ≥ 3 (Grafik) · 18,87
ok   Kontrast hell: --tally-selected auf --card ≥ 3 (Grafik) · 18,07
ok   Kontrast hell: --tally-selected auf --surface-raised ≥ 3 (Grafik) · 18,87
ok   Kontrast hell: --tally-ready auf --muted ≥ 3 (Grafik) · 3,28
ok   Kontrast hell: --tally-selected auf --muted ≥ 3 (Grafik) · 16,80
ok   Kontrast hell: --status-warn auf --muted = 2,91, unter 3 (Grafik) – Statussymbole nie auf der Hover-Fläche (E14) · 2,91
ok   Kontrast Bestand dunkel: --foreground auf --background ≥ 4,5 (Text) · 18,07
ok   Kontrast Bestand dunkel: --card-foreground auf --card ≥ 4,5 (Text) · 16,78
ok   Kontrast Bestand dunkel: --popover-foreground auf --popover ≥ 4,5 (Text) · 16,78
ok   Kontrast Bestand dunkel: --primary-foreground auf --primary ≥ 4,5 (Text) · 14,93
ok   Kontrast Bestand dunkel: --secondary-foreground auf --secondary ≥ 4,5 (Text) · 14,43
ok   Kontrast Bestand dunkel: --muted-foreground auf --background ≥ 4,5 (Text) · 5,83
ok   Kontrast Bestand dunkel: --muted-foreground auf --card ≥ 4,5 (Text) · 5,42
ok   Kontrast Bestand dunkel: --muted-foreground auf --secondary ≥ 4,5 (Text) · 4,66
ok   Kontrast Bestand dunkel: --muted-foreground auf --muted ≥ 4,5 (Text) · 4,66
ok   Kontrast Bestand dunkel: --destructive-foreground auf --destructive = 3,40 (Befund, festgeschrieben) · 3,40
Befund: dunkel: --destructive-foreground auf --destructive 3,40 : 1, unter 4,5 für Text
ok   Kontrast Bestand dunkel: --accent-foreground auf --accent (über --background) = 4,08 (Befund, festgeschrieben) · 4,08
Befund: dunkel: --accent-foreground auf --accent (über --background) 4,08 : 1, unter 4,5 für Text
ok   Kontrast Bestand dunkel: --accent-foreground auf --accent (über --card) = 3,86 (Befund, festgeschrieben) · 3,86
Befund: dunkel: --accent-foreground auf --accent (über --card) 3,86 : 1, unter 4,5 für Text
ok   Kontrast Bestand dunkel: --success auf --background ≥ 4,5 (Text) · 8,10
ok   Kontrast Bestand dunkel: --warning auf --background ≥ 4,5 (Text) · 14,93
ok   Kontrast Bestand dunkel: --foreground auf --highlight (über --surface-raised) ≥ 4,5 (Text) · 11,16
ok   Kontrast Bestand dunkel: --foreground auf --highlight (über --card) ≥ 4,5 (Text) · 12,41
ok   Kontrast Bestand dunkel: --muted-foreground auf --highlight (über --surface-raised) = 3,60 (Befund, festgeschrieben) · 3,60
Befund: dunkel: --muted-foreground auf --highlight (über --surface-raised) 3,60 : 1, unter 4,5 für Text
ok   Kontrast Bestand dunkel: --muted-foreground auf --highlight (über --card) = 4,01 (Befund, festgeschrieben) · 4,01
Befund: dunkel: --muted-foreground auf --highlight (über --card) 4,01 : 1, unter 4,5 für Text
ok   Kontrast Bestand hell: --foreground auf --background ≥ 4,5 (Text) · 18,87
ok   Kontrast Bestand hell: --card-foreground auf --card ≥ 4,5 (Text) · 18,07
ok   Kontrast Bestand hell: --popover-foreground auf --popover ≥ 4,5 (Text) · 18,87
ok   Kontrast Bestand hell: --primary-foreground auf --primary ≥ 4,5 (Text) · 18,07
ok   Kontrast Bestand hell: --secondary-foreground auf --secondary ≥ 4,5 (Text) · 16,80
ok   Kontrast Bestand hell: --muted-foreground auf --background ≥ 4,5 (Text) · 7,44
ok   Kontrast Bestand hell: --muted-foreground auf --card ≥ 4,5 (Text) · 7,13
ok   Kontrast Bestand hell: --muted-foreground auf --secondary ≥ 4,5 (Text) · 6,62
ok   Kontrast Bestand hell: --muted-foreground auf --muted ≥ 4,5 (Text) · 6,62
ok   Kontrast Bestand hell: --destructive-foreground auf --destructive ≥ 4,5 (Text) · 5,20
ok   Kontrast Bestand hell: --accent-foreground auf --accent (über --background) ≥ 4,5 (Text) · 14,93
ok   Kontrast Bestand hell: --accent-foreground auf --accent (über --card) ≥ 4,5 (Text) · 14,93
ok   Kontrast Bestand hell: --success auf --background = 3,40 (Befund, festgeschrieben) · 3,40
Befund: hell: --success auf --background 3,40 : 1, unter 4,5 für Text
ok   Kontrast Bestand hell: --warning auf --background = 2,54 (Befund, festgeschrieben) · 2,54
Befund: hell: --warning auf --background 2,54 : 1, unter 4,5 für Text
ok   Kontrast Bestand hell: --foreground auf --highlight (über --surface-raised) ≥ 4,5 (Text) · 18,24
ok   Kontrast Bestand hell: --foreground auf --highlight (über --card) ≥ 4,5 (Text) · 17,55
ok   Kontrast Bestand hell: --muted-foreground auf --highlight (über --surface-raised) ≥ 4,5 (Text) · 7,19
ok   Kontrast Bestand hell: --muted-foreground auf --highlight (über --card) ≥ 4,5 (Text) · 6,92

ALLE TESTS OK
Exit=0
158
```
Die Werte stimmen mit den Referenzskripten der Planung überein (`kontrast-referenz.mjs`, `kontrast-extra.mjs`,
`kontrast-bestand.mjs`), mit einer Ausnahme: Hell `--brand-fg-on-dark` auf `--tally-live` ist **5,20**, nicht 5,43
(`--brand-fg-on-dark` ist `oklch(0.985 0 0)`, nicht reines Weiß).

- [ ] **Step 5: Mutationsprobe** (Kopie nach „Gemeinsam für Block A“; je eine Probe allein, danach zurückbauen)

1. `<Kopie>\packages\ui\src\tokens\signal-colors.css` (`.light`): `--tally-ready:    oklch(0.60 0.17 145);` →
   `--tally-ready:    oklch(0.80 0.17 145);`. Erwartet (gemessen):
   ```
   Exit=1
   FAIL Tokens hell: --tally-ready = oklch(0.60 0.17 145)
   FAIL Kontrast hell: --tally-ready auf --background ≥ 3 (Grafik) · 1,76
   FAIL Kontrast hell: --tally-ready auf --card ≥ 3 (Grafik) · 1,69
   FAIL Kontrast hell: --tally-ready auf --surface-raised ≥ 3 (Grafik) · 1,76
   FAIL Kontrast hell: --tally-ready auf --muted ≥ 3 (Grafik) · 1,57
   5 FEHLGESCHLAGEN
   ```
2. `<Kopie>\packages\ui\src\tokens\signal-colors.css` (`:root, .dark`): `--surface-raised: oklch(0.25 0 0);` →
   `--surface-raised: oklch(0.42 0 0);`. Erwartet (gemessen):
   ```
   Exit=1
   FAIL Tokens dunkel: --surface-raised = oklch(0.25 0 0)
   FAIL Kontrast dunkel: --muted-foreground auf --surface-raised ≥ 4,5 (Text) · 2,62
   FAIL Kontrast dunkel: --tally-live auf --surface-raised ≥ 3 (Grafik) · 2,08
   FAIL Kontrast dunkel: --status-error auf --surface-raised ≥ 3 (Grafik) · 2,38
   FAIL Kontrast dunkel: --status-off auf --surface-raised ≥ 3 (Grafik) · 2,62
   FAIL Kontrast Bestand dunkel: --muted-foreground auf --highlight (über --surface-raised) = 3,60 (Befund, festgeschrieben) · 1,99
   6 FEHLGESCHLAGEN
   ```
3. `<Kopie>\packages\ui\test\lib\oklch.ts` (`mische` ohne Gamma), Vorher
   `dekodiere(kodiere(vorne[i]) * alpha + kodiere(hinten[i]) * (1 - alpha))` → Nachher
   `vorne[i] * alpha + hinten[i] * (1 - alpha)`. Erwartet (gemessen):
   ```
   Exit=1
   FAIL Kontrast Bestand dunkel: --accent-foreground auf --accent (über --background) = 4,08 (Befund, festgeschrieben) · 2,27
   FAIL Kontrast Bestand dunkel: --accent-foreground auf --accent (über --card) = 3,86 (Befund, festgeschrieben) · 2,26
   FAIL Kontrast Bestand dunkel: --muted-foreground auf --highlight (über --surface-raised) = 3,60 (Befund, festgeschrieben) · 2,06
   FAIL Kontrast Bestand dunkel: --muted-foreground auf --highlight (über --card) = 4,01 (Befund, festgeschrieben) · 2,13
   4 FEHLGESCHLAGEN
   ```
4. `<Kopie>\packages\ui\src\tokens\signal-colors.css` (`.light`): `--status-warn:    oklch(0.66 0.16 55);` →
   `--status-warn:    oklch(0.60 0.16 55);` (der festgeschriebene Grund-Wert auf `--muted` verschiebt sich). Erwartet (gemessen):
   ```
   Exit=1
   FAIL Tokens hell: --status-warn = oklch(0.66 0.16 55)
   FAIL Kontrast hell: --status-warn auf --muted = 2,91, unter 3 (Grafik) – Statussymbole nie auf der Hover-Fläche (E14) · 3,70
   2 FEHLGESCHLAGEN
   ```
Kopie aufräumen (Junction zuerst).

- [ ] **Step 6: Typprüfung**

```
npm run typecheck -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen): keine Fehlerzeile, `Exit=0`.

- [ ] **Step 7: Commit**

```
git add packages/ui/test/kontrast.test.ts packages/ui/test/lib/oklch.ts packages/ui/test/selftest.ts
git status --short
```
Erwartet:
```
A  packages/ui/test/kontrast.test.ts
A  packages/ui/test/lib/oklch.ts
M  packages/ui/test/selftest.ts
```
Dann:
```
git commit -m "test(ui): Kontrast der Token-Paare in Hell und Dunkel aus den oklch-Werten" -m "Spec 4.2/11: Der Test rechnet oklch ueber OKLab und lineares sRGB in die WCAG-Luminanz um (Referenz Weiss/Schwarz 21,00) und mischt durchscheinende Flaechen im gamma-kodierten sRGB. Neue Paare erfuellen ihre Klasse (Text 4,5, gross 3, Grafik 3) in beiden Modi, auch auf surface-raised; Weiss auf der LIVE-Flaeche erreicht dunkel 3,90 und ist deshalb nur als grosse Schrift erlaubt (E3). Sieben Bestands-Paare unter 4,5 sind als Befund festgeschrieben (darunter gedaempfte Schrift auf --highlight, das die neuen Bausteine deshalb nicht nutzen), alle uebrigen erreichen 4,5." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- E3 und das Gerüst nennen hell `--brand-fg-on-dark` auf `--tally-live` = 5,43; gemessen 5,20 (die 5,43 galten für
  `oklch(1 0 0)`). Die Klasse „groß ≥ 3“ ist in beiden Fällen erfüllt.
- Zusätzliche Werkzeug-Fälle für `parseFarbe` (Alpha, fremde Schreibweisen) und `loese` (Kette, Zyklus, unbekannt), damit
  ein Fehler im Messgerät nicht als Kontrastbefund durchgeht.
- `--success` und `--warning` stehen als Text-Paare auf `--background` in der Bestandsliste (Badge färbt Wörter damit);
  dunkel bestehen sie (8,10 / 14,93), hell sind sie die Befunde 3,40 / 2,54.
- Nachbesserung nach dem Review: Paare `--background` auf `--tally-live` (E14) und `--foreground` auf `--muted` (E23) neu;
  die vier `--highlight`-Paare stehen im Bestand. Der Review hatte nachgerechnet, dass gedämpfte Schrift auf `--highlight`
  über `--surface-raised` nur 3,60 : 1 erreicht, während der Plan volle Abdeckung meldete (Befunde 3,60 und 4,01).
- Zweite Nachbesserung (Prüfrunde 2): Die erste Nachbesserung hatte die Hover-Fläche `--muted` nur mit `--foreground`
  gemessen. Neu sind die Ränder `--tally-ready` und `--tally-selected` auf `--muted` (Grafik, beide Modi) und der
  festgeschriebene Grund-Wert `--status-warn` auf `--muted` hell = 2,91 (Probe 4); die Statusleiste hat deshalb keine
  Hover-Fläche mehr (Task 8). Mit dem Rechenweg dieser Aufgabe nachgerechnet, alle sechs Statusfarben auf `--muted`:
  dunkel 3,70 / 6,47 / 6,74 / 4,24 / 4,66 / 11,92, hell 4,84 / 3,28 / **2,91** / 4,84 / 6,62 / 16,80 (Reihenfolge live,
  ready, warn, error, off, selected).

---

### Task 5: Statuslogik und feste UI-Texte

**Spec:** Abschnitt 3.3 (`StatusState`, `StatusGroup`, `StatusItem` wörtlich; feste Reihenfolge; Symbol und Text je Zustand;
Uhrzeit hh:mm:ss), 7.2 (unbekannt ist nicht ok), 4.2 (LIVE und Fehler unterscheiden sich durch Form und Text). Entscheidungen
E3 (LIVE-Text auf dem `TallyButton` groß), E14 (live-Eintrag mit `LIVE_EINTRAG_KLASSE`), E27 (Text „Noch nicht
übernommen.“). Global Constraints G5, G6, G7.

**Arbeitsverzeichnis/Voraussetzung:** Plan-Worktree nach Task 4 (Selbsttest grün mit 158 `ok`).

**Dateien:**
- Create: `packages/ui/src/lib/texte.ts`
- Create: `packages/ui/src/lib/status.ts`
- Create: `packages/ui/test/status.test.ts`
- Modify: `packages/ui/src/index.ts` nach Zeile 11 (zwei Export-Zeilen aus 9.8)
- Modify: `packages/ui/test/selftest.ts` (Import vor `abschluss();`)

**Interfaces:**
- Consumes: Task 1 `ok`, `gleich`.
- Produces (Gerüst 9.2 und 9.3, exakt):
  ```ts
  // packages/ui/src/lib/texte.ts
  export const UNBEKANNT = 'unbekannt';
  export function zahlText(n: number): string;   // n.toLocaleString('de-DE', { useGrouping: false, maximumFractionDigits: 3 })
  export const UI_TEXTE = { … } as const;        // wörtlich wie in Step 3
  // packages/ui/src/lib/status.ts
  export type StatusState = 'ok' | 'warn' | 'error' | 'off' | 'live';
  export type StatusGroup = 'verbindung' | 'ausgabe' | 'fernsteuerung' | 'tool';
  export interface StatusItem { id: string; group: StatusGroup; label: string; state: StatusState; detail?: string; settingsSection?: string }
  export const STATUS_GRUPPEN: readonly StatusGroup[];                 // ['verbindung', 'ausgabe', 'fernsteuerung', 'tool']
  export const STATUS_SYMBOL: Readonly<Record<StatusState, string>>;   // ok '●', warn '▲', error '⚠', off '○', live '■'
  export const STATUS_SYMBOL_KLASSE: Readonly<Record<StatusState, string>>;   // text-[var(--tally-ready|status-warn|status-error|status-off|background)]
  export const STATUS_RAND_KLASSE: Readonly<Record<StatusState, string>>;     // border-[var(--border|status-warn|status-error|border|tally-live)]
  export const LIVE_EINTRAG_KLASSE: string;   // 'bg-[var(--tally-live)] text-[var(--background)]' (live-Eintrag, live-StatusPill; E14)
  export const LIVE_FLAECHE_KLASSE: string;   // 'bg-[var(--tally-live)] text-[var(--brand-fg-on-dark)] text-[19px] leading-none font-extrabold'
  export function ordneStatus(items: readonly StatusItem[]): StatusItem[];
  export function unbekannt(item: Omit<StatusItem, 'state' | 'detail'>): StatusItem;
  export function formatUhrzeit(d: Date): string;
  export function formatUhrzeitKurz(iso: string | undefined): string | undefined;
  ```
  Neue Zeilen in `packages/ui/src/index.ts` (9.8):
  ```ts
  export { UNBEKANNT, zahlText } from './lib/texte';
  export { type StatusState, type StatusGroup, type StatusItem, STATUS_SYMBOL, ordneStatus, unbekannt, formatUhrzeit, formatUhrzeitKurz } from './lib/status';
  ```
  `UI_TEXTE`, `STATUS_GRUPPEN`, `STATUS_SYMBOL_KLASSE`, `STATUS_RAND_KLASSE` und `LIVE_FLAECHE_KLASSE` stehen bewusst nicht
  im Paket-Index (9.8); die Bausteine in `packages/ui/src/components` importieren sie relativ (`../lib/status`,
  `../lib/texte`).

**Verhalten (verbindlich):**
- `ordneStatus` sortiert stabil nach `STATUS_GRUPPEN`, innerhalb einer Gruppe in Array-Reihenfolge, und gibt ein neues Array
  zurück (Eingabe unverändert). Ein zur Laufzeit unbekannter Gruppenname kommt ans Ende, statt zu verschwinden.
- `unbekannt(item)` liefert `state: 'off'`, `detail: 'unbekannt'` und lässt `id`, `group`, `label`, `settingsSection`
  stehen. Nie `ok` (Spec 7.2).
- `STATUS_SYMBOL_KLASSE` ist die **einzige** Stelle in `@jm/ui` mit Statusfarbe als Schrift (Quellregel aus Task 3);
  Wörter bleiben in Vordergrundfarbe. Ausnahme `live`: Ein live-Eintrag ist rot **gefüllt** (Spec 3.3 „live ■ rot
  gefüllt“, 4.2 „gefüllt + LIVE gegen Rahmen + ⚠“), Symbol und Schrift stehen darauf in Hintergrundfarbe
  (`LIVE_EINTRAG_KLASSE`, normale Schrift: dunkel 4,63, hell 5,43, Task 4; E14).
- `LIVE_FLAECHE_KLASSE` ist „große Schrift“ nach WCAG (≥ 18,66 px und fett), weil Weiß auf `--tally-live` dunkel nur
  3,90 : 1 erreicht (Task 4).
- `formatUhrzeit`/`formatUhrzeitKurz` nutzen Ortszeit, zweistellig; `formatUhrzeitKurz('')`, `('kaputt')`, `(undefined)` →
  `undefined`.
- `zahlText`: deutsches Komma, kein Tausenderpunkt (`65535`), höchstens drei Nachkommastellen.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Inhalt von `packages/ui/test/status.test.ts`:
```ts
// Task 5 · Statuslogik (Spec 3.3, 7.2, 4.2) und feste Texte (G5): Reihenfolge, Symbole, Klassen, „unbekannt“,
// Uhrzeit, zahlText, große Schrift auf der LIVE-Fläche (E3) und die neuen Exporte aus src/index.ts.
import * as ui from '../src/index';
import {
  LIVE_EINTRAG_KLASSE,
  LIVE_FLAECHE_KLASSE,
  STATUS_GRUPPEN,
  STATUS_RAND_KLASSE,
  STATUS_SYMBOL,
  STATUS_SYMBOL_KLASSE,
  formatUhrzeit,
  formatUhrzeitKurz,
  ordneStatus,
  unbekannt,
  type StatusItem,
  type StatusState,
} from '../src/lib/status';
import { UI_TEXTE, UNBEKANNT, zahlText } from '../src/lib/texte';
import { gleich, ok } from './harness';

const ZUSTAENDE: readonly StatusState[] = ['ok', 'warn', 'error', 'off', 'live'];

// ── Reihenfolge (Spec 3.3: verbindung → ausgabe → fernsteuerung → tool, in der Gruppe Array-Reihenfolge) ──
{
  const eintrag = (id: string, group: StatusItem['group']): StatusItem => ({ id, group, label: id, state: 'ok' });
  const eingabe: StatusItem[] = [
    eintrag('t1', 'tool'),
    eintrag('a1', 'ausgabe'),
    eintrag('f1', 'fernsteuerung'),
    eintrag('v1', 'verbindung'),
    eintrag('a2', 'ausgabe'),
    eintrag('t2', 'tool'),
    eintrag('v2', 'verbindung'),
    eintrag('a3', 'ausgabe'),
  ];
  const vorher = JSON.stringify(eingabe);
  const geordnet = ordneStatus(eingabe);
  gleich(
    geordnet.map((item) => item.group),
    ['verbindung', 'verbindung', 'ausgabe', 'ausgabe', 'ausgabe', 'fernsteuerung', 'tool', 'tool'],
    'Status: Gruppenreihenfolge verbindung → ausgabe → fernsteuerung → tool',
  );
  gleich(
    geordnet.map((item) => item.id),
    ['v1', 'v2', 'a1', 'a2', 'a3', 'f1', 't1', 't2'],
    'Status: innerhalb einer Gruppe Array-Reihenfolge (stabil)',
  );
  ok(JSON.stringify(eingabe) === vorher && geordnet !== eingabe, 'Status: ordneStatus verändert die Eingabe nicht');
  gleich(ordneStatus([]), [], 'Status: leere Liste bleibt leer');
  gleich([...STATUS_GRUPPEN], ['verbindung', 'ausgabe', 'fernsteuerung', 'tool'], 'Status: STATUS_GRUPPEN in Spec-Reihenfolge');
}

// ── Symbole und Klassen (Spec 3.3, 4.2; G7: Form statt nur Farbe) ──
{
  gleich(
    ZUSTAENDE.map((z) => STATUS_SYMBOL[z]),
    ['●', '▲', '⚠', '○', '■'],
    'Status: Symbole ok ●, warn ▲, error ⚠, off ○, live ■',
  );
  ok(new Set(ZUSTAENDE.map((z) => STATUS_SYMBOL[z])).size === 5, 'Status: fünf verschiedene Symbole');
  gleich(
    { ...STATUS_SYMBOL_KLASSE },
    {
      ok: 'text-[var(--tally-ready)]',
      warn: 'text-[var(--status-warn)]',
      error: 'text-[var(--status-error)]',
      off: 'text-[var(--status-off)]',
      live: 'text-[var(--background)]',
    },
    'Status: Symbolklassen für alle fünf Zustände (live steht auf der roten Fläche in deren Schriftfarbe)',
  );
  gleich(
    { ...STATUS_RAND_KLASSE },
    {
      ok: 'border-[var(--border)]',
      warn: 'border-[var(--status-warn)]',
      error: 'border-[var(--status-error)]',
      off: 'border-[var(--border)]',
      live: 'border-[var(--tally-live)]',
    },
    'Status: Randklassen für alle fünf Zustände',
  );
  ok(
    STATUS_SYMBOL.live !== STATUS_SYMBOL.error &&
      STATUS_RAND_KLASSE.live !== STATUS_RAND_KLASSE.error &&
      LIVE_EINTRAG_KLASSE.split(' ').includes('bg-[var(--tally-live)]') &&
      !STATUS_RAND_KLASSE.error.includes('bg-'),
    'Status: live und error unterscheiden sich in Symbol und Form (live gefüllt, error nur umrandet; Spec 3.3, 4.2)',
  );
  gleich(
    LIVE_EINTRAG_KLASSE,
    'bg-[var(--tally-live)] text-[var(--background)]',
    'Status: LIVE_EINTRAG_KLASSE füllt rot, Schrift in Hintergrundfarbe (normale Schrift, Kontrast Task 4)',
  );
}

// ── Große Schrift auf der LIVE-Fläche (E3: Weiß auf Rot erreicht dunkel nur 3,90 : 1 → nur groß und fett) ──
{
  const px = /(?:^|\s)text-\[(\d+(?:\.\d+)?)px\](?:\s|$)/.exec(LIVE_FLAECHE_KLASSE);
  ok(
    px !== null &&
      Number(px[1]) >= 18.66 &&
      /(?:^|\s)font-(bold|extrabold|black)(?:\s|$)/.test(LIVE_FLAECHE_KLASSE) &&
      LIVE_FLAECHE_KLASSE.includes('bg-[var(--tally-live)]') &&
      LIVE_FLAECHE_KLASSE.includes('text-[var(--brand-fg-on-dark)]'),
    'Status: LIVE_FLAECHE_KLASSE groß und fett (≥ 18,66 px, bold), Weiß auf --tally-live',
  );
}

// ── Unbekannt ist nicht ok (Spec 7.2) ──
{
  const u = unbekannt({ id: 'master-link', group: 'verbindung', label: 'Master', settingsSection: 'master' });
  gleich(
    u,
    { id: 'master-link', group: 'verbindung', label: 'Master', settingsSection: 'master', state: 'off', detail: 'unbekannt' },
    'Status: unbekannt() → off + „unbekannt“, übrige Felder bleiben',
  );
  ok(u.state !== 'ok' && UNBEKANNT === 'unbekannt', 'Status: unbekannt() ist nie ok');
}

// ── Uhrzeit (Ortszeit, zweistellig) ──
{
  gleich(formatUhrzeit(new Date(2026, 9, 8, 9, 5, 7)), '09:05:07', 'Status: formatUhrzeit 9:05:07 → 09:05:07');
  gleich(formatUhrzeit(new Date(2026, 9, 8, 23, 59, 59)), '23:59:59', 'Status: formatUhrzeit 23:59:59 bleibt');
  gleich(
    [
      formatUhrzeitKurz(new Date(2026, 9, 8, 9, 5, 0).toISOString()),
      formatUhrzeitKurz(''),
      formatUhrzeitKurz('kaputt'),
      formatUhrzeitKurz(undefined),
    ],
    ['09:05', undefined, undefined, undefined],
    'Status: formatUhrzeitKurz ISO → hh:mm, leer, kaputt und undefined → undefined',
  );
}

// ── Texte ──
{
  gleich([zahlText(1.5), zahlText(65535), zahlText(0.1234), zahlText(-2)], ['1,5', '65535', '0,123', '-2'], 'Texte: zahlText 1.5 → 1,5 und 65535 ohne Tausenderpunkt');
  ok(new Set(ZUSTAENDE.map((z) => UI_TEXTE.zustand[z])).size === 5, 'Texte: fünf Zustandswörter verschieden');
  gleich(
    [
      UI_TEXTE.mindestens(1.5),
      UI_TEXTE.hoechstens(65535),
      UI_TEXTE.gesperrt('Show läuft'),
      UI_TEXTE.nichtVerfuegbar('USB-Mikrofon'),
      UI_TEXTE.statusOeffnen('NDI'),
      UI_TEXTE.themeUmschalten(UI_TEXTE.dunkel, UI_TEXTE.hell),
    ],
    [
      'Mindestens 1,5.',
      'Höchstens 65535.',
      'Gesperrt: Show läuft',
      'nicht verfügbar: USB-Mikrofon',
      'NDI: Einstellungen öffnen',
      'Darstellung: Dunkel. Umschalten auf Hell',
    ],
    'Texte: Funktionen setzen Werte ein (Zahlen über zahlText)',
  );
}

// ── Exporte aus src/index.ts (9.8) ──
{
  ok(
    ui.UNBEKANNT === 'unbekannt' &&
      ui.zahlText(2.5) === '2,5' &&
      ui.STATUS_SYMBOL.live === '■' &&
      typeof ui.ordneStatus === 'function' &&
      typeof ui.unbekannt === 'function' &&
      typeof ui.formatUhrzeit === 'function' &&
      typeof ui.formatUhrzeitKurz === 'function',
    'Status: Exporte aus src/index.ts (UNBEKANNT, zahlText, STATUS_SYMBOL, ordneStatus, unbekannt, Uhrzeit)',
  );
}
```

`packages/ui/test/selftest.ts`, Vorher:
```ts
abschluss();
```
Nachher:
```ts
import './status.test';
abschluss();
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen):
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '<worktree>\packages\ui\src\lib\status' imported from <worktree>\packages\ui\test\status.test.ts
…
Exit=1
```

- [ ] **Step 3: Texte und Statuslogik anlegen**

Inhalt von `packages/ui/src/lib/texte.ts`:
```ts
// Feste Texte von @jm/ui (Suite-UX-Update, G5): an einer Stelle, wörtlich aus der Spec, deutsche Anführungszeichen.
// Zahlen in Texten immer über zahlText (de-DE, Komma, ohne Tausenderpunkt).

/** Text für einen Zustand, den das Tool (noch) nicht kennt (Spec 7.2: unbekannt ist nicht ok). */
export const UNBEKANNT = 'unbekannt';

export function zahlText(n: number): string {
  return n.toLocaleString('de-DE', { useGrouping: false, maximumFractionDigits: 3 });
}

export const UI_TEXTE = {
  zustand: { ok: 'in Ordnung', warn: 'Warnung', error: 'Fehler', off: 'aus', live: 'auf Sendung' },
  onAir: 'ON AIR',
  bereit: 'bereit',
  live: 'LIVE',
  einstellungen: 'Einstellungen',
  einstellungenOeffnen: 'Einstellungen öffnen',
  einstellungenSchliessen: 'Einstellungen schließen',
  statusOeffnen: (label: string) => `${label}: Einstellungen öffnen`,
  gesperrtOhneGrund: 'gesperrt – kein Grund angegeben',
  gesperrt: (grund: string) => `Gesperrt: ${grund}`,
  nichtVerfuegbar: (label: string) => `nicht verfügbar: ${label}`,
  bitteWaehlen: '– bitte wählen –',
  zahlFehlt: 'Bitte eine Zahl eingeben.',
  ganzzahlFehlt: 'Bitte eine ganze Zahl eingeben.',
  mindestens: (min: number) => `Mindestens ${zahlText(min)}.`,
  hoechstens: (max: number) => `Höchstens ${zahlText(max)}.`,
  nochNichtUebernommen: 'Noch nicht übernommen.',
  dunkel: 'Dunkel',
  hell: 'Hell',
  themeUmschalten: (jetzt: string, ziel: string) => `Darstellung: ${jetzt}. Umschalten auf ${ziel}`,
  kuerzel: 'Kürzel',
  uhrzeit: 'Uhrzeit',
} as const;
```

Inhalt von `packages/ui/src/lib/status.ts`:
```ts
// Statusleiste: Typen (Spec 3.3 wörtlich), feste Reihenfolge, Symbole und Klassen je Zustand, „unbekannt“, Uhrzeit.
// Reine Logik ohne DOM. Jeder Zustand hat Symbol UND Text (Spec 3.3, 4.2). Die Statusfarben färben nur Symbole,
// Ränder und Flächen, nie Wörter: STATUS_SYMBOL_KLASSE ist die einzige Stelle mit Statusfarbe als Schrift (G7).
import { UNBEKANNT } from './texte';

export type StatusState = 'ok' | 'warn' | 'error' | 'off' | 'live';
export type StatusGroup = 'verbindung' | 'ausgabe' | 'fernsteuerung' | 'tool';
export interface StatusItem {
  id: string;
  group: StatusGroup;
  label: string;
  state: StatusState;
  detail?: string;
  settingsSection?: string;
}

/** Feste Reihenfolge der Gruppen in der Statusleiste (Spec 3.3). */
export const STATUS_GRUPPEN: readonly StatusGroup[] = ['verbindung', 'ausgabe', 'fernsteuerung', 'tool'];

/** Form statt nur Farbe (Spec 3.3): ok ●, warn ▲, error ⚠, off ○, live ■. */
export const STATUS_SYMBOL: Readonly<Record<StatusState, string>> = {
  ok: '●',
  warn: '▲',
  error: '⚠',
  off: '○',
  live: '■',
};

/**
 * Farbe des Symbols je Zustand. Einziger Ort mit Statusfarbe als Schrift-Klasse (Quellregel in Task 3). live steht auf
 * der roten Fläche (LIVE_EINTRAG_KLASSE) und trägt deshalb deren Schriftfarbe.
 */
export const STATUS_SYMBOL_KLASSE: Readonly<Record<StatusState, string>> = {
  ok: 'text-[var(--tally-ready)]',
  warn: 'text-[var(--status-warn)]',
  error: 'text-[var(--status-error)]',
  off: 'text-[var(--status-off)]',
  live: 'text-[var(--background)]',
};

/** Rand je Zustand: error rot umrandet, live rot, warn orange, ok und off neutral (Spec 3.3). */
export const STATUS_RAND_KLASSE: Readonly<Record<StatusState, string>> = {
  ok: 'border-[var(--border)]',
  warn: 'border-[var(--status-warn)]',
  error: 'border-[var(--status-error)]',
  off: 'border-[var(--border)]',
  live: 'border-[var(--tally-live)]',
};

/**
 * Fläche eines live-Eintrags (StatusBar, StatusPill): rot gefüllt, Symbol und Schrift in Hintergrundfarbe (Spec 3.3
 * „live ■ rot gefüllt“, 4.2 „gefüllt + LIVE gegen Rahmen + ⚠“; E14). Normale Schrift genügt: dunkel 4,63, hell 5,43 : 1.
 */
export const LIVE_EINTRAG_KLASSE = 'bg-[var(--tally-live)] text-[var(--background)]';

/**
 * Text auf der roten LIVE-Fläche (TallyButton live, ON AIR im Kopf). Weiß auf --tally-live erreicht dunkel nur
 * 3,90 : 1, also nur „große Schrift“ (≥ 18,66 px fett, WCAG 1.4.3): deshalb 19 px extrafett (E3).
 */
export const LIVE_FLAECHE_KLASSE = 'bg-[var(--tally-live)] text-[var(--brand-fg-on-dark)] text-[19px] leading-none font-extrabold';

/** Stabil nach STATUS_GRUPPEN, innerhalb einer Gruppe in Array-Reihenfolge; die Eingabe bleibt unverändert. */
export function ordneStatus(items: readonly StatusItem[]): StatusItem[] {
  const rang = (gruppe: StatusGroup): number => {
    const i = STATUS_GRUPPEN.indexOf(gruppe);
    return i === -1 ? STATUS_GRUPPEN.length : i;
  };
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rang(a.item.group) - rang(b.item.group) || a.index - b.index)
    .map((eintrag) => eintrag.item);
}

/** Eintrag für einen Zustand, den das Tool nicht kennt: off mit Text „unbekannt“, nie ok (Spec 7.2). */
export function unbekannt(item: Omit<StatusItem, 'state' | 'detail'>): StatusItem {
  return { ...item, state: 'off', detail: UNBEKANNT };
}

const zweistellig = (n: number): string => String(n).padStart(2, '0');

/** hh:mm:ss in Ortszeit (Uhr rechts in der Statusleiste). */
export function formatUhrzeit(d: Date): string {
  return `${zweistellig(d.getHours())}:${zweistellig(d.getMinutes())}:${zweistellig(d.getSeconds())}`;
}

/** hh:mm in Ortszeit aus einem ISO-Zeitpunkt; leer oder ungültig → undefined. */
export function formatUhrzeitKurz(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${zweistellig(d.getHours())}:${zweistellig(d.getMinutes())}`;
}
```

- [ ] **Step 4: Test laufen lassen (noch rot: Index fehlt)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen):
```
FAIL Status: Exporte aus src/index.ts (UNBEKANNT, zahlText, STATUS_SYMBOL, ordneStatus, unbekannt, Uhrzeit)

1 FEHLGESCHLAGEN
Exit=1
```

- [ ] **Step 5: Exporte anhängen** (Edit-Werkzeug, `packages/ui/src/index.ts` Zeile 11)

Vorher:
```ts
export { Tabs, type TabItem } from './components/Tabs';
```
Nachher:
```ts
export { Tabs, type TabItem } from './components/Tabs';
export { UNBEKANNT, zahlText } from './lib/texte';
export { type StatusState, type StatusGroup, type StatusItem, STATUS_SYMBOL, ordneStatus, unbekannt, formatUhrzeit, formatUhrzeitKurz } from './lib/status';
```

- [ ] **Step 6: Test laufen lassen (grün)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
npm run selftest -w @jm/ui 2>&1 | grep -c "^ok "
```
Erwartet (gemessen), nach den 158 Zeilen aus Task 1–4:
```
ok   Status: Gruppenreihenfolge verbindung → ausgabe → fernsteuerung → tool
ok   Status: innerhalb einer Gruppe Array-Reihenfolge (stabil)
ok   Status: ordneStatus verändert die Eingabe nicht
ok   Status: leere Liste bleibt leer
ok   Status: STATUS_GRUPPEN in Spec-Reihenfolge
ok   Status: Symbole ok ●, warn ▲, error ⚠, off ○, live ■
ok   Status: fünf verschiedene Symbole
ok   Status: Symbolklassen für alle fünf Zustände (live steht auf der roten Fläche in deren Schriftfarbe)
ok   Status: Randklassen für alle fünf Zustände
ok   Status: live und error unterscheiden sich in Symbol und Form (live gefüllt, error nur umrandet; Spec 3.3, 4.2)
ok   Status: LIVE_EINTRAG_KLASSE füllt rot, Schrift in Hintergrundfarbe (normale Schrift, Kontrast Task 4)
ok   Status: LIVE_FLAECHE_KLASSE groß und fett (≥ 18,66 px, bold), Weiß auf --tally-live
ok   Status: unbekannt() → off + „unbekannt“, übrige Felder bleiben
ok   Status: unbekannt() ist nie ok
ok   Status: formatUhrzeit 9:05:07 → 09:05:07
ok   Status: formatUhrzeit 23:59:59 bleibt
ok   Status: formatUhrzeitKurz ISO → hh:mm, leer, kaputt und undefined → undefined
ok   Texte: zahlText 1.5 → 1,5 und 65535 ohne Tausenderpunkt
ok   Texte: fünf Zustandswörter verschieden
ok   Texte: Funktionen setzen Werte ein (Zahlen über zahlText)
ok   Status: Exporte aus src/index.ts (UNBEKANNT, zahlText, STATUS_SYMBOL, ordneStatus, unbekannt, Uhrzeit)

ALLE TESTS OK
Exit=0
179
```

- [ ] **Step 7: Mutationsprobe** (Kopie nach „Gemeinsam für Block A“; je eine Probe allein in
  `<Kopie>\packages\ui\src\lib\status.ts`, danach zurückbauen)

1. `['verbindung', 'ausgabe', 'fernsteuerung', 'tool']` → `['ausgabe', 'verbindung', 'fernsteuerung', 'tool']`.
   Erwartet (gemessen): `FAIL Status: Gruppenreihenfolge …`, `FAIL Status: innerhalb einer Gruppe Array-Reihenfolge (stabil)`,
   `FAIL Status: STATUS_GRUPPEN in Spec-Reihenfolge`, `3 FEHLGESCHLAGEN`, `Exit=1`.
2. `|| a.index - b.index` → `|| b.index - a.index` (innerhalb der Gruppe umgekehrt). Erwartet (gemessen):
   ```
   Exit=1
   FAIL Status: innerhalb einer Gruppe Array-Reihenfolge (stabil)
        ist: ["v2","v1","a3","a2","a1","f1","t2","t1"] soll: ["v1","v2","a1","a2","a3","f1","t1","t2"]
   1 FEHLGESCHLAGEN
   ```
3. `state: 'off', detail: UNBEKANNT` → `state: 'ok', detail: UNBEKANNT`. Erwartet (gemessen):
   `FAIL Status: unbekannt() → off + „unbekannt“, übrige Felder bleiben`, `FAIL Status: unbekannt() ist nie ok`,
   `2 FEHLGESCHLAGEN`, `Exit=1`.
4. `  warn: '▲',` → `  warn: '●',`. Erwartet (gemessen): `FAIL Status: Symbole ok ●, warn ▲, error ⚠, off ○, live ■`,
   `FAIL Status: fünf verschiedene Symbole`, `2 FEHLGESCHLAGEN`, `Exit=1`.
5. `text-[19px]` → `text-[15px]`. Erwartet (gemessen):
   `FAIL Status: LIVE_FLAECHE_KLASSE groß und fett (≥ 18,66 px, bold), Weiß auf --tally-live`, `1 FEHLGESCHLAGEN`, `Exit=1`.
6. `LIVE_EINTRAG_KLASSE` ohne Fläche: `'bg-[var(--tally-live)] text-[var(--background)]'` →
   `'text-[var(--background)]'`. Erwartet (gemessen):
   ```
   Exit=1
   FAIL Status: live und error unterscheiden sich in Symbol und Form (live gefüllt, error nur umrandet; Spec 3.3, 4.2)
   FAIL Status: LIVE_EINTRAG_KLASSE füllt rot, Schrift in Hintergrundfarbe (normale Schrift, Kontrast Task 4)
        ist: "text-[var(--background)]" soll: "bg-[var(--tally-live)] text-[var(--background)]"
   2 FEHLGESCHLAGEN
   ```

Kopie aufräumen (Junction zuerst).

- [ ] **Step 8: Typprüfung**

```
npm run typecheck -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen): keine Fehlerzeile, `Exit=0`. (Zusätzlich gemessen: `tsc` nur über `src/index.ts` ohne Node-Typen,
`--types react`, ist fehlerfrei; die neuen Quellen brauchen also nichts aus Node.)

- [ ] **Step 9: Commit**

```
git add packages/ui/src/lib/texte.ts packages/ui/src/lib/status.ts packages/ui/src/index.ts packages/ui/test/status.test.ts packages/ui/test/selftest.ts
git status --short
```
Erwartet:
```
M  packages/ui/src/index.ts
A  packages/ui/src/lib/status.ts
A  packages/ui/src/lib/texte.ts
M  packages/ui/test/selftest.ts
A  packages/ui/test/status.test.ts
```
Dann:
```
git commit -m "feat(ui): Statuslogik (Reihenfolge, Symbole, unbekannt) und feste Texte" -m "Spec 3.3/7.2: StatusState, StatusGroup und StatusItem woertlich, feste Gruppenreihenfolge (stabil), je Zustand ein eigenes Symbol und eine Symbol- und Randklasse; unbekannt() liefert off mit Text unbekannt, nie ok. LIVE_FLAECHE_KLASSE ist grosse fette Schrift, weil Weiss auf Rot dunkel nur 3,90 erreicht. Alle festen Texte von @jm/ui stehen in lib/texte.ts, Zahlen ueber zahlText (de-DE, ohne Tausenderpunkt). Index bekommt nur neue Zeilen am Ende." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Zusätzliche Fälle: leere Liste, `STATUS_GRUPPEN` in Spec-Reihenfolge, „live und error unterscheiden sich in Symbol und
  Rand“, Texte-Funktionen mit Werten, und „Exporte aus src/index.ts“ (sonst wäre die Index-Änderung ungetestet).
- `ordneStatus` behält Einträge mit unbekannter Gruppe (ans Ende) statt sie wegzufiltern.
- Nachbesserung nach dem Review: `LIVE_EINTRAG_KLASSE` (rot gefüllt, Schrift in `--background`) für den live-Eintrag der
  Statusleiste und die live-`StatusPill` (Spec 3.3, 4.2; E14); `STATUS_SYMBOL_KLASSE.live` ist deshalb die Schriftfarbe der
  Fläche. Neue Probe 6 (Fläche fehlt) → 2 `FAIL`.
- Zweite Nachbesserung: `UI_TEXTE.nochNichtUebernommen` „Noch nicht übernommen.“ (E27). Den Wortlaut prüft Task 7
  (`zahlSchritt` mit `frist`); die Zählstände dieser Aufgabe ändern sich dadurch nicht.

---

### Task 6: Halten-zum-Sprechen (onPress/onRelease genau einmal)

**Spec:** Abschnitt 3.4 (`onPress` beim Drücken, `onRelease` beim Loslassen oder Abbrechen; „`onRelease` kommt in jedem Fall
genau einmal, auch wenn der Zeiger das Fenster verlässt“). Entscheidung E9. Review Focus 2.

**Arbeitsverzeichnis/Voraussetzung:** Plan-Worktree nach Task 5 (Selbsttest grün mit 179 `ok`).

**Dateien:**
- Create: `packages/ui/src/lib/halten.ts`
- Create: `packages/ui/test/halten.test.ts`
- Modify: `packages/ui/test/selftest.ts` (Import vor `abschluss();`)

**Interfaces:**
- Consumes: Task 1 `ok`.
- Produces (Gerüst 9.4, exakt; `TallyButton` in Task 9 hält die Steuerung in einer Ref):
  ```ts
  export interface HaltenRueckrufe { onPress?(): void; onRelease?(): void }
  export type HaltenQuelle = 'zeiger' | 'taste';
  export interface HaltenSteuerung {
    readonly gehalten: boolean;
    druecken(quelle: HaltenQuelle): void;   // ohne onPress UND onRelease: nichts; schon gehalten: nichts; sonst gehalten=true, dann onPress (wirft es, bleibt gehalten=true, Fehler wird weitergeworfen)
    loslassen(quelle: HaltenQuelle): void;  // nur wenn mit derselben Quelle gehalten: gehalten=false, dann onRelease genau einmal
    abbrechen(): void;                      // gehalten (egal welche Quelle): gehalten=false, onRelease genau einmal; sonst nichts
    aktualisiere(r: HaltenRueckrufe): void; // neueste Rückrufe übernehmen (Props ändern sich)
  }
  export function erzeugeHalten(r: HaltenRueckrufe): HaltenSteuerung;
  ```

**Verhalten (verbindlich):**
- Erst halten, dann melden: `gehalten` wird vor `onPress` gesetzt. Wirft `onPress`, bleibt der Druck gehalten, und das
  nächste `loslassen`/`abbrechen` ruft `onRelease` (kein hängender Talkback).
- Erst lösen, dann melden: `gehalten` wird vor `onRelease` zurückgesetzt. Wirft `onRelease`, ist trotzdem losgelassen, und
  kein zweites `onRelease` folgt.
- `loslassen` zählt nur über die Quelle, die gedrückt hat (Leertaste gehalten, `pointerup` irgendwo: kein Release);
  `abbrechen` löst immer (pointercancel, lostpointercapture, blur, Wechsel auf „gesperrt“, Unmount).
- Ist nur `onRelease` gesetzt, zählt der Druck trotzdem (das Tool will das Loslassen wissen).
- `aktualisiere` tauscht die Rückrufe aus, ohne den Haltezustand zu ändern; gerufen werden immer die neuesten.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Inhalt von `packages/ui/test/halten.test.ts`:
```ts
// Task 6 · Halten-zum-Sprechen (Spec 3.4, E9, Review Focus 2): onPress und onRelease je Druck genau einmal.
// Loslassen zählt nur über dieselbe Quelle (Zeiger bzw. Taste); abbrechen (pointercancel, lostpointercapture, blur,
// Wechsel auf gesperrt, Unmount) löst immer, aber nie ein zweites Mal.
import { erzeugeHalten, type HaltenQuelle, type HaltenRueckrufe } from '../src/lib/halten';
import { ok } from './harness';

function mitZaehler(): { z: { press: number; release: number }; rueckrufe: HaltenRueckrufe } {
  const z = { press: 0, release: 0 };
  return {
    z,
    rueckrufe: {
      onPress: () => {
        z.press++;
      },
      onRelease: () => {
        z.release++;
      },
    },
  };
}

{
  const { z, rueckrufe } = mitZaehler();
  const h = erzeugeHalten(rueckrufe);
  h.druecken('zeiger');
  const nachErstem = z.press === 1 && z.release === 0 && h.gehalten;
  h.druecken('zeiger');
  h.druecken('taste');
  ok(nachErstem && z.press === 1 && z.release === 0, 'Halten: druecken → onPress einmal; zweites druecken nichts');
}

{
  const { z, rueckrufe } = mitZaehler();
  const h = erzeugeHalten(rueckrufe);
  h.druecken('zeiger');
  h.loslassen('zeiger');
  const nachErstem = z.release === 1 && !h.gehalten;
  h.loslassen('zeiger');
  ok(nachErstem && z.press === 1 && z.release === 1, 'Halten: loslassen → onRelease einmal; zweites loslassen nichts');
}

{
  const { z, rueckrufe } = mitZaehler();
  const h = erzeugeHalten(rueckrufe);
  h.druecken('zeiger');
  h.loslassen('zeiger'); // pointerup
  h.abbrechen(); // lostpointercapture kommt danach
  ok(z.press === 1 && z.release === 1, 'Halten: loslassen + abbrechen (pointerup + lostpointercapture) → ein onRelease');
}

{
  const { z, rueckrufe } = mitZaehler();
  const h = erzeugeHalten(rueckrufe);
  h.abbrechen();
  ok(z.press === 0 && z.release === 0 && !h.gehalten, 'Halten: abbrechen ohne druecken → nichts');
}

{
  const { z, rueckrufe } = mitZaehler();
  const h = erzeugeHalten(rueckrufe);
  h.druecken('taste');
  h.loslassen('zeiger');
  const nochGehalten = h.gehalten && z.release === 0;
  h.abbrechen();
  ok(
    nochGehalten && z.release === 1 && !h.gehalten,
    "Halten: mit Taste gehalten, loslassen('zeiger') löst nicht; abbrechen löst einmal",
  );
}

{
  let release = 0;
  const h = erzeugeHalten({
    onPress: () => {
      throw new Error('Talkback-Fehler');
    },
    onRelease: () => {
      release++;
    },
  });
  let geworfen = '';
  try {
    h.druecken('zeiger');
  } catch (e) {
    geworfen = (e as Error).message;
  }
  const gehaltenNachWurf = h.gehalten;
  h.loslassen('zeiger');
  ok(
    geworfen === 'Talkback-Fehler' && gehaltenNachWurf && release === 1 && !h.gehalten,
    'Halten: onPress wirft → gehalten bleibt true, Fehler weitergeworfen, loslassen ruft onRelease einmal',
  );
}

{
  let release = 0;
  const h = erzeugeHalten({
    onPress: () => undefined,
    onRelease: () => {
      release++;
      throw new Error('Release-Fehler');
    },
  });
  h.druecken('taste');
  let geworfen = false;
  try {
    h.loslassen('taste');
  } catch {
    geworfen = true;
  }
  let zweiterWurf = false;
  try {
    h.abbrechen();
  } catch {
    zweiterWurf = true;
  }
  ok(
    geworfen && !zweiterWurf && release === 1 && !h.gehalten,
    'Halten: onRelease wirft → trotzdem losgelassen, kein zweites onRelease',
  );
}

{
  const h = erzeugeHalten({});
  h.druecken('zeiger');
  ok(!h.gehalten, 'Halten: ohne onPress und onRelease hält nichts');
  let release = 0;
  const nurRelease = erzeugeHalten({
    onRelease: () => {
      release++;
    },
  });
  nurRelease.druecken('zeiger');
  nurRelease.abbrechen();
  ok(release === 1, 'Halten: nur onRelease gesetzt → Druck zählt, onRelease kommt');
}

{
  const alt = mitZaehler();
  const neu = mitZaehler();
  const h = erzeugeHalten(alt.rueckrufe);
  h.druecken('zeiger');
  h.aktualisiere(neu.rueckrufe);
  h.loslassen('zeiger');
  ok(
    alt.z.press === 1 && alt.z.release === 0 && neu.z.release === 1,
    'Halten: aktualisiere – onRelease der neuesten Rückrufe wird gerufen',
  );
}

// Kreuzprodukt: jede Folge aus {druecken zeiger/taste, loslassen zeiger/taste, abbrechen} bis Länge 4 (780 Folgen).
{
  type Schritt = 'dz' | 'dt' | 'lz' | 'lt' | 'ab';
  const SCHRITTE: readonly Schritt[] = ['dz', 'dt', 'lz', 'lt', 'ab'];
  const QUELLE: Record<'z' | 't', HaltenQuelle> = { z: 'zeiger', t: 'taste' };
  const folgen: Schritt[][] = [];
  const baue = (praefix: Schritt[]): void => {
    if (praefix.length > 0) folgen.push(praefix);
    if (praefix.length === 4) return;
    for (const s of SCHRITTE) baue([...praefix, s]);
  };
  baue([]);

  const fehler: string[] = [];
  for (const folge of folgen) {
    const { z, rueckrufe } = mitZaehler();
    const h = erzeugeHalten(rueckrufe);
    let gehaltenVon: HaltenQuelle | null = null; // Erwartung: wer den laufenden Druck begonnen hat
    for (const schritt of folge) {
      const vorher = { ...z };
      const quelle = QUELLE[schritt[1] as 'z' | 't'];
      let erwartetPress = vorher.press;
      let erwartetRelease = vorher.release;
      if (schritt[0] === 'd') {
        h.druecken(quelle);
        if (gehaltenVon === null) {
          erwartetPress++;
          gehaltenVon = quelle;
        }
      } else if (schritt[0] === 'l') {
        h.loslassen(quelle);
        if (gehaltenVon === quelle) {
          erwartetRelease++;
          gehaltenVon = null;
        }
      } else {
        h.abbrechen();
        if (gehaltenVon !== null) {
          erwartetRelease++;
          gehaltenVon = null;
        }
      }
      const offen = z.press - z.release;
      if (
        z.press !== erwartetPress ||
        z.release !== erwartetRelease ||
        offen < 0 ||
        offen > 1 ||
        h.gehalten !== (gehaltenVon !== null)
      ) {
        fehler.push(`${folge.join(' ')} (bei ${schritt}: press ${z.press}, release ${z.release}, gehalten ${h.gehalten})`);
        break;
      }
    }
    h.abbrechen();
    if (z.press !== z.release) fehler.push(`${folge.join(' ')} (nach abbrechen: press ${z.press} ≠ release ${z.release})`);
  }
  ok(fehler.length === 0 && folgen.length === 780, `Halten: Kreuzprodukt Quelle × Abfolge (${folgen.length} Folgen bis Länge 4)`);
  for (const zeile of fehler.slice(0, 5)) console.log(`     ${zeile}`);
}
```

`packages/ui/test/selftest.ts`, Vorher:
```ts
abschluss();
```
Nachher:
```ts
import './halten.test';
abschluss();
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen):
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '<worktree>\packages\ui\src\lib\halten' imported from <worktree>\packages\ui\test\halten.test.ts
…
Exit=1
```

- [ ] **Step 3: Zustandsmaschine anlegen** (`packages/ui/src/lib/halten.ts`)

```ts
// Halten-zum-Sprechen für TallyButton (Spec 3.4, E9): reine Zustandsmaschine ohne DOM.
// Je erfolgreichem Druck kommt onRelease genau einmal: über loslassen mit derselben Quelle oder über abbrechen
// (pointercancel, lostpointercapture, blur, Wechsel auf „gesperrt“, Unmount). Ein hängender Talkback wäre ein Live-Fehler.

export interface HaltenRueckrufe {
  onPress?(): void;
  onRelease?(): void;
}

export type HaltenQuelle = 'zeiger' | 'taste';

export interface HaltenSteuerung {
  readonly gehalten: boolean;
  druecken(quelle: HaltenQuelle): void;
  loslassen(quelle: HaltenQuelle): void;
  abbrechen(): void;
  aktualisiere(r: HaltenRueckrufe): void;
}

export function erzeugeHalten(r: HaltenRueckrufe): HaltenSteuerung {
  let rueckrufe = r;
  let gehaltenVon: HaltenQuelle | null = null;

  const loesen = (): void => {
    gehaltenVon = null;
    rueckrufe.onRelease?.();
  };

  return {
    get gehalten(): boolean {
      return gehaltenVon !== null;
    },
    druecken(quelle: HaltenQuelle): void {
      if (!rueckrufe.onPress && !rueckrufe.onRelease) return;
      if (gehaltenVon !== null) return;
      // Erst halten, dann melden: Wirft onPress, bleibt der Druck gehalten, und onRelease folgt trotzdem.
      gehaltenVon = quelle;
      rueckrufe.onPress?.();
    },
    loslassen(quelle: HaltenQuelle): void {
      if (gehaltenVon === quelle) loesen();
    },
    abbrechen(): void {
      if (gehaltenVon !== null) loesen();
    },
    aktualisiere(neu: HaltenRueckrufe): void {
      rueckrufe = neu;
    },
  };
}
```

- [ ] **Step 4: Test laufen lassen (grün)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
npm run selftest -w @jm/ui 2>&1 | grep -c "^ok "
```
Erwartet (gemessen), nach den 179 Zeilen aus Task 1–5:
```
ok   Halten: druecken → onPress einmal; zweites druecken nichts
ok   Halten: loslassen → onRelease einmal; zweites loslassen nichts
ok   Halten: loslassen + abbrechen (pointerup + lostpointercapture) → ein onRelease
ok   Halten: abbrechen ohne druecken → nichts
ok   Halten: mit Taste gehalten, loslassen('zeiger') löst nicht; abbrechen löst einmal
ok   Halten: onPress wirft → gehalten bleibt true, Fehler weitergeworfen, loslassen ruft onRelease einmal
ok   Halten: onRelease wirft → trotzdem losgelassen, kein zweites onRelease
ok   Halten: ohne onPress und onRelease hält nichts
ok   Halten: nur onRelease gesetzt → Druck zählt, onRelease kommt
ok   Halten: aktualisiere – onRelease der neuesten Rückrufe wird gerufen
ok   Halten: Kreuzprodukt Quelle × Abfolge (780 Folgen bis Länge 4)

ALLE TESTS OK
Exit=0
190
```

- [ ] **Step 5: Mutationsprobe** (Kopie nach „Gemeinsam für Block A“; je eine Probe allein in
  `<Kopie>\packages\ui\src\lib\halten.ts`, danach zurückbauen)

1. `abbrechen` ohne Prüfung: `      if (gehaltenVon !== null) loesen();` → `      loesen();`. Erwartet (gemessen):
   ```
   Exit=1
   FAIL Halten: loslassen + abbrechen (pointerup + lostpointercapture) → ein onRelease
   FAIL Halten: abbrechen ohne druecken → nichts
   FAIL Halten: onRelease wirft → trotzdem losgelassen, kein zweites onRelease
   FAIL Halten: Kreuzprodukt Quelle × Abfolge (780 Folgen bis Länge 4)
        dz dz dz lz (nach abbrechen: press 1 ≠ release 2)
        …
   4 FEHLGESCHLAGEN
   ```
2. Erst melden, dann halten (Vorher zwei Zeilen `      gehaltenVon = quelle;` / `      rueckrufe.onPress?.();`,
   Nachher in umgekehrter Reihenfolge). Erwartet (gemessen):
   ```
   Exit=1
   FAIL Halten: onPress wirft → gehalten bleibt true, Fehler weitergeworfen, loslassen ruft onRelease einmal
   1 FEHLGESCHLAGEN
   ```
3. `loslassen` ohne Quellen-Prüfung: `      if (gehaltenVon === quelle) loesen();` → `      if (gehaltenVon !== null) loesen();`.
   Erwartet (gemessen):
   ```
   Exit=1
   FAIL Halten: mit Taste gehalten, loslassen('zeiger') löst nicht; abbrechen löst einmal
   FAIL Halten: Kreuzprodukt Quelle × Abfolge (780 Folgen bis Länge 4)
        dz dz dz lt (bei lt: press 1, release 1, gehalten false)
        …
   2 FEHLGESCHLAGEN
   ```
Kopie aufräumen (Junction zuerst).

- [ ] **Step 6: Typprüfung**

```
npm run typecheck -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen): keine Fehlerzeile, `Exit=0`.

- [ ] **Step 7: Commit**

```
git add packages/ui/src/lib/halten.ts packages/ui/test/halten.test.ts packages/ui/test/selftest.ts
git status --short
```
Erwartet:
```
A  packages/ui/src/lib/halten.ts
A  packages/ui/test/halten.test.ts
M  packages/ui/test/selftest.ts
```
Dann:
```
git commit -m "feat(ui): Halten-Logik fuer TallyButton - onRelease genau einmal" -m "Spec 3.4: reine Zustandsmaschine fuer Halten-zum-Sprechen. Erst halten, dann onPress melden (wirft onPress, folgt onRelease trotzdem); erst loesen, dann onRelease melden (kein zweites onRelease). Loslassen zaehlt nur ueber die Quelle, die gedrueckt hat; abbrechen (pointercancel, lostpointercapture, blur, gesperrt, Unmount) loest immer. Kreuzprodukt aller 780 Folgen aus druecken/loslassen je Quelle und abbrechen bis Laenge 4 geprueft." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Zusätzliche Fälle „onRelease wirft → trotzdem losgelassen, kein zweites onRelease“ und „nur onRelease gesetzt → Druck
  zählt“. Das Kreuzprodukt prüft je Schritt die erwartete Zahl von `onPress`/`onRelease` aus einer eigenen Erwartung
  (wer hat gedrückt) und am Ende nach einem `abbrechen()` press = release.

---

### Task 7: Hell/Dunkel-Speicher und Eingabe-Logik

**Spec:** Abschnitt 3.5 (Eingaben mit Einheit, Min/Max, `aria-invalid`/`aria-describedby` für Fehler und Sperrgrund), 3.7
(Dunkel ist Standard, Hell setzt `light` auf `<html>`, Schlüssel `jm-theme`, `try/catch`, Fehler → Dunkel), 3.8 (ohne
Electron), 8. Entscheidungen E10, E11, E12, E13. Global Constraint G4.

**Arbeitsverzeichnis/Voraussetzung:** Plan-Worktree nach Task 6 (Selbsttest grün mit 190 `ok`).

**Dateien:**
- Create: `packages/ui/src/lib/theme.ts` (einzige Datei mit `localStorage`)
- Create: `packages/ui/src/lib/eingabe.ts`
- Create: `packages/ui/test/theme.test.ts`
- Create: `packages/ui/test/eingabe.test.ts`
- Modify: `packages/ui/src/index.ts` nach Zeile 13 (zwei Export-Zeilen aus 9.8)
- Modify: `packages/ui/test/selftest.ts` (zwei Importe vor `abschluss();`)

**Interfaces:**
- Consumes: Task 5 `UI_TEXTE`, `zahlText` aus `./texte`; Task 1 `ok`, `gleich`.
- Produces (Gerüst 9.5 ohne `useTheme`, 9.6; exakt):
  ```ts
  // packages/ui/src/lib/theme.ts
  export type Theme = 'dark' | 'light';
  export const THEME_SCHLUESSEL = 'jm-theme';
  export interface ThemeSpeicher { getItem(k: string): string | null; setItem(k: string, v: string): void }
  export function leseTheme(speicher: ThemeSpeicher | null | undefined): Theme;             // Fehler, null, fremder Wert → 'dark'
  export function schreibeTheme(speicher: ThemeSpeicher | null | undefined, t: Theme): boolean; // false bei Fehler, wirft nie
  export function wendeThemeAn(ziel: { classList: { add(c: string): void; remove(c: string): void } } | null | undefined, t: Theme): void; // genau eine von dark/light
  export function browserSpeicher(): ThemeSpeicher | null;  // window.localStorage in try/catch; ohne window → null
  export interface ThemeStore { lies(): Theme; setze(t: Theme): void; abonniere(hoerer: () => void): () => void }
  export interface ThemeUmgebung { speicher(): ThemeSpeicher | null | undefined;
    html(): { classList: { add(c: string): void; remove(c: string): void } } | null | undefined }
  export function erzeugeThemeStore(u: ThemeUmgebung): ThemeStore;   // ein Zustand für das ganze Dokument
  export function browserHtml(): HTMLElement | null;                  // document.documentElement hinter typeof
  export const themeStore: ThemeStore;                                // der Store des Dokuments (useTheme, Task 12)
  // packages/ui/src/lib/eingabe.ts
  export interface ZahlRegeln { min?: number; max?: number; ganzzahl?: boolean }
  export type ZahlErgebnis = { ok: true; wert: number } | { ok: false; fehler: string };
  export function parseZahl(text: string, regeln?: ZahlRegeln): ZahlErgebnis;
  export interface ZahlEntwurf { text: string; fehler?: string; geaendert: boolean; gesendet?: number }   // gesendet: E27
  export type ZahlEreignis = { art: 'tippen'; text: string } | { art: 'uebernehmen' } | { art: 'verwerfen' }
    | { art: 'aussen'; wert: number | null } | { art: 'frist' };
  export function zahlEntwurfAus(wert: number | null): ZahlEntwurf;
  export function zahlSchritt(z: ZahlEntwurf, e: ZahlEreignis, regeln: ZahlRegeln, aktuell: number | null):
    { z: ZahlEntwurf; neuerWert?: number; verbraucht: boolean };
  export const UEBERNAHME_FRIST_MS = 2000;                                             // E27
  export interface FristTakt { setTimeout(f: () => void, ms: number): unknown; clearTimeout(id: unknown): void }
  export function starteFrist(melde: () => void, takt?: FristTakt): () => void;       // Körper des Frist-Effekts
  export interface SelectOption { value: string; label: string }
  export function selectOptionen(options: readonly SelectOption[], value: string,
    opts?: { placeholder?: string; fehlendLabel?: string }): Array<SelectOption & { disabled?: boolean }>;
  export interface FeldIds { input: string; hilfe: string; sperre: string; fehler: string }
  export function feldIds(basis: string): FeldIds;
  export function beschreibtDurch(ids: FeldIds, hat: { hilfe?: boolean; sperre?: boolean; fehler?: boolean; extra?: string[] }): string | undefined;
  ```
  Neue Zeilen in `packages/ui/src/index.ts` (9.8; `starteFrist` zusätzlich für `@jm/settings`, Task 17, E27):
  ```ts
  export { type Theme, THEME_SCHLUESSEL } from './lib/theme';
  export { type SelectOption, parseZahl, starteFrist } from './lib/eingabe';
  ```

**Verhalten (verbindlich):**
- Theme: Nur der exakte Wert `'light'` ergibt Hell; alles andere (fehlt, `'LIGHT'`, `'blau'`, `''`, Fehler beim Lesen) ergibt
  Dunkel. `schreibeTheme` wirft nie. `wendeThemeAn` entfernt die jeweils andere Klasse und setzt die gewünschte; andere
  Klassen auf `<html>` bleiben. `browserSpeicher()` greift auf `window` nur hinter `typeof window` zu (G4).
- `erzeugeThemeStore` (E10; Review-Befund „zwei ThemeToggle zeigen Verschiedenes“): **ein** Zustand für das ganze Dokument.
  Bis zur ersten Wahl liest `lies()` den Speicher (jeder Fehler → Dunkel). `setze(t)` gilt sofort für alle Abonnenten, auch
  wenn der Speicher die Wahl nicht aufnimmt; dazu `schreibeTheme` und `wendeThemeAn` auf `<html>`. `themeStore` ist der Store
  des Dokuments mit `browserSpeicher` und `browserHtml`; `useTheme` (Task 12) liest ihn über `useSyncExternalStore`.
- `parseZahl`: Leerraum außen weg; erlaubt ist nur `/^-?\d+([.,]\d+)?$/` (kein `1e3`, kein Tausenderpunkt); Komma = Punkt.
  Prüfreihenfolge Zahl → ganzzahl → min → max; Fehlertexte aus `UI_TEXTE`. Nie klemmen.
- `zahlSchritt` (E12):
  - `tippen`: Text übernehmen, Fehler weg, `geaendert` = Text weicht vom Text des aktuellen Werts ab.
  - `uebernehmen` (Enter, Verlassen): ungeändert → Text des aktuellen Werts, kein `neuerWert`. Ungültig → Fehler, Text
    bleibt, kein `neuerWert`. Gültig → Text normalisiert (`zahlText`), `neuerWert` nur, wenn er sich vom aktuellen Wert
    unterscheidet (`'1,50'` bei 1,5 löst kein `onChange` aus) und noch nicht gemeldet ist (`gesendet`, E27). Nach einem
    `neuerWert` bleibt der Entwurf **geändert** und merkt sich `gesendet`, bis der Wert von außen zurückkommt (`aussen`):
    Ein zweites Übernehmen desselben Werts (Verlassen nach Enter, abgelehnter Wert) meldet nichts mehr, Escape gehört
    weiter dem Feld (verwirft auf den echten Wert).
  - `verwerfen` (Escape): Text des aktuellen Werts; `verbraucht = geaendert` (nur dann gehört Escape dem Feld, sonst dem
    Panel, E8).
  - `frist` (die Frist nach dem Melden ist um, E27): mit `gesendet` → Fehler „Noch nicht übernommen.“, Text und `gesendet`
    bleiben; ohne `gesendet` nichts.
  - `aussen` (neuer Wert von außen): ein ungeänderter oder schon gemeldeter Entwurf folgt (das Tool hat geantwortet, auch
    mit einem anderen Wert); ein angefangener bleibt stehen (nichts Getipptes geht verloren), außer er entspricht schon dem
    neuen Wert.
- `starteFrist(melde, takt)` (E27): meldet einmal nach `UEBERNAHME_FRIST_MS` = 2000 ms und liefert das Aufräumen; der Takt
  ist austauschbar wie bei `starteUhr` (Task 8), damit der Effekt-Körper ohne Browser prüfbar ist.
- `selectOptionen` (E11): Wert vorhanden → Kopie der Liste. Wert `''` und keine Option `''` → vorn
  `{ value: '', label: placeholder ?? '– bitte wählen –' }`. Wert fehlt → vorn
  `{ value, label: 'nicht verfügbar: {fehlendLabel ?? value}', disabled: true }`. Die Eingabe wird nie verändert.
- `beschreibtDurch` (E13): Reihenfolge Hilfe, Sperre, Fehler, dann `extra`; nichts → `undefined` (kein leeres Attribut).

---

- [ ] **Step 1: Fehlschlagende Tests schreiben**

Inhalt von `packages/ui/test/theme.test.ts`:
```ts
// Task 7 · Hell/Dunkel-Speicher (Spec 3.7, 8; E10): Dunkel ist Standard und Rückfall, Schlüssel jm-theme,
// jeder Zugriff in try/catch, auf <html> steht danach genau eine der Klassen dark/light.
import * as ui from '../src/index';
import {
  THEME_SCHLUESSEL,
  browserHtml,
  browserSpeicher,
  erzeugeThemeStore,
  leseTheme,
  schreibeTheme,
  themeStore,
  wendeThemeAn,
  type ThemeSpeicher,
} from '../src/lib/theme';
import { gleich, ok } from './harness';

function speicher(werte: Record<string, string>): ThemeSpeicher & { werte: Record<string, string> } {
  return {
    werte,
    getItem: (k) => werte[k] ?? null,
    setItem: (k, v) => {
      werte[k] = v;
    },
  };
}

const WIRFT: ThemeSpeicher = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

/** Ergebnis von f oder 'WURF', wenn f wirft (dann wird der Test rot statt abzubrechen). */
function ohneWurf<T>(f: () => T): T | 'WURF' {
  try {
    return f();
  } catch {
    return 'WURF';
  }
}

function ziel(start: string[]): { klassen: Set<string>; classList: { add(c: string): void; remove(c: string): void } } {
  const klassen = new Set(start);
  return {
    klassen,
    classList: {
      add: (c) => {
        klassen.add(c);
      },
      remove: (c) => {
        klassen.delete(c);
      },
    },
  };
}

gleich([leseTheme(null), leseTheme(undefined)], ['dark', 'dark'], 'Theme: kein Speicher → dark');
gleich(ohneWurf(() => leseTheme(WIRFT)), 'dark', 'Theme: getItem wirft → dark, kein Wurf');
gleich(leseTheme(speicher({})), 'dark', 'Theme: nichts gespeichert → dark');
gleich(
  ['light', 'dark', 'LIGHT', 'blau', ''].map((wert) => leseTheme(speicher({ 'jm-theme': wert }))),
  ['light', 'dark', 'dark', 'dark', 'dark'],
  "Theme: 'light' → light; 'dark' → dark; 'LIGHT', 'blau', '' → dark",
);
gleich(ohneWurf(() => schreibeTheme(WIRFT, 'light')), false, 'Theme: schreibeTheme – setItem wirft → false, kein Wurf');
gleich([schreibeTheme(null, 'light'), schreibeTheme(undefined, 'dark')], [false, false], 'Theme: schreibeTheme ohne Speicher → false');
{
  const s = speicher({});
  const ergebnis = schreibeTheme(s, 'light');
  gleich([ergebnis, s.werte, THEME_SCHLUESSEL], [true, { 'jm-theme': 'light' }, 'jm-theme'], 'Theme: schreibeTheme ok → true, Schlüssel jm-theme');
}
{
  const html = ziel(['dark', 'jm-andere']);
  wendeThemeAn(html, 'light');
  const nachHell = [...html.klassen].sort();
  wendeThemeAn(html, 'light');
  const nachZweitemHell = [...html.klassen].sort();
  wendeThemeAn(html, 'dark');
  gleich(
    [nachHell, nachZweitemHell, [...html.klassen].sort()],
    [['jm-andere', 'light'], ['jm-andere', 'light'], ['dark', 'jm-andere']],
    'Theme: wendeThemeAn – aus dark wird light, genau eine Klasse; doppelt angewandt gleich; andere Klassen bleiben',
  );
  const beide = ziel(['dark', 'light']);
  wendeThemeAn(beide, 'dark');
  gleich([...beide.klassen], ['dark'], 'Theme: wendeThemeAn – stehen beide Klassen, bleibt genau eine');
}
gleich(
  [ohneWurf(() => wendeThemeAn(null, 'light')), ohneWurf(() => wendeThemeAn(undefined, 'dark'))],
  [undefined, undefined],
  'Theme: wendeThemeAn(null) wirft nicht',
);
ok(browserSpeicher() === null, 'Theme: browserSpeicher unter Node (ohne window) → null');
{
  const s = speicher({});
  const html = ziel(['dark', 'jm-andere']);
  const store = erzeugeThemeStore({ speicher: () => s, html: () => html });
  const gemeldet = { a: 0, b: 0 };
  const abmelden = store.abonniere(() => {
    gemeldet.a++;
  });
  store.abonniere(() => {
    gemeldet.b++;
  });
  const start = store.lies();
  store.setze('light');
  const nachHell = [store.lies(), s.werte['jm-theme'], [...html.klassen].sort().join(' ')];
  abmelden();
  store.setze('dark');
  gleich(
    [start, ...nachHell, store.lies(), gemeldet.a, gemeldet.b],
    ['dark', 'light', 'light', 'jm-andere light', 'dark', 1, 2],
    'Theme-Store: ein Wert für alle Abonnenten (zwei Schalter zeigen nie Verschiedenes), gemerkt, auf <html>; Abgemeldete hören nichts mehr',
  );
}
{
  const store = erzeugeThemeStore({ speicher: () => WIRFT, html: () => null });
  const start = ohneWurf(() => store.lies());
  const nachWahl = ohneWurf(() => {
    store.setze('light');
    return store.lies();
  });
  gleich([start, nachWahl], ['dark', 'light'], 'Theme-Store: Speicher gesperrt → Start Dunkel, die Wahl gilt trotzdem für das Dokument');
}
gleich([themeStore.lies(), browserHtml()], ['dark', null], 'Theme-Store: der Store des Dokuments liest unter Node Dunkel, ohne <html>');
ok(ui.THEME_SCHLUESSEL === 'jm-theme', 'Theme: Export THEME_SCHLUESSEL aus src/index.ts');
```

Inhalt von `packages/ui/test/eingabe.test.ts`:
```ts
// Task 7 · Eingabe-Logik (Spec 3.5; E11, E12, E13): Zahl prüfen ohne stilles Klemmen, Entwurf mit Enter/Verlassen/
// Escape, Auswahl ohne stilles Umspringen, Feld-IDs und die Reihenfolge in aria-describedby.
import * as ui from '../src/index';
import {
  beschreibtDurch,
  feldIds,
  parseZahl,
  selectOptionen,
  starteFrist,
  UEBERNAHME_FRIST_MS,
  zahlEntwurfAus,
  zahlSchritt,
  type SelectOption,
  type ZahlRegeln,
} from '../src/lib/eingabe';
import { gleich, ok } from './harness';

const FEHLT = { ok: false, fehler: 'Bitte eine Zahl eingeben.' };

// ── parseZahl ──
gleich(['', 'abc', '1e3', '1.2.3', '12a', ','].map((t) => parseZahl(t)), Array(6).fill(FEHLT), "Eingabe: parseZahl '', 'abc', '1e3' u. a. → „Bitte eine Zahl eingeben.“");
gleich(parseZahl(' 42 '), { ok: true, wert: 42 }, "Eingabe: parseZahl ' 42 ' → 42 (Leerraum weg)");
gleich([parseZahl('1,5'), parseZahl('1.5'), parseZahl('-3')], [{ ok: true, wert: 1.5 }, { ok: true, wert: 1.5 }, { ok: true, wert: -3 }], 'Eingabe: parseZahl Komma und Punkt als Dezimaltrenner, Minus erlaubt');
gleich(
  [parseZahl('1.5', { ganzzahl: true }), parseZahl('2', { ganzzahl: true })],
  [{ ok: false, fehler: 'Bitte eine ganze Zahl eingeben.' }, { ok: true, wert: 2 }],
  "Eingabe: parseZahl '1.5' mit ganzzahl → „Bitte eine ganze Zahl eingeben.“",
);
gleich(
  [parseZahl('0', { min: 1 }), parseZahl('0,5', { min: 1.5 }), parseZahl('1', { min: 1 })],
  [{ ok: false, fehler: 'Mindestens 1.' }, { ok: false, fehler: 'Mindestens 1,5.' }, { ok: true, wert: 1 }],
  "Eingabe: parseZahl '0' mit min 1 → „Mindestens 1.“, Grenze selbst gilt",
);
gleich(
  [parseZahl('70000', { max: 65535 }), parseZahl('65535', { max: 65535 })],
  [{ ok: false, fehler: 'Höchstens 65535.' }, { ok: true, wert: 65535 }],
  "Eingabe: parseZahl '70000' mit max 65535 → „Höchstens 65535.“ (kein stilles Klemmen)",
);

// ── Entwurf (NumberInput) ──
const PORT: ZahlRegeln = { min: 1, max: 65535, ganzzahl: true };
gleich([zahlEntwurfAus(null), zahlEntwurfAus(1.5)], [{ text: '', geaendert: false }, { text: '1,5', geaendert: false }], 'Eingabe: zahlEntwurfAus – null → leer, 1.5 → 1,5');
gleich(
  [zahlSchritt(zahlEntwurfAus(5), { art: 'tippen', text: '7' }, {}, 5), zahlSchritt({ text: '7', geaendert: true }, { art: 'tippen', text: '5' }, {}, 5)],
  [
    { z: { text: '7', geaendert: true }, verbraucht: false },
    { z: { text: '5', geaendert: false }, verbraucht: false },
  ],
  'Eingabe: zahlSchritt tippen – Entwurf ändert sich, zurückgetippt ist nichts geändert',
);
gleich(
  zahlSchritt({ text: '8080', geaendert: true }, { art: 'uebernehmen' }, PORT, 8000),
  { z: { text: '8080', geaendert: true, gesendet: 8080 }, neuerWert: 8080, verbraucht: false },
  'Eingabe: zahlSchritt uebernehmen gültig → neuerWert, Entwurf bleibt geändert, bis der Wert zurückkommt',
);
{
  const gemeldet = zahlSchritt({ text: '8080', geaendert: true }, { art: 'uebernehmen' }, PORT, 8000);
  // Das Tool lehnt ab (value bleibt 8000) bzw. übernimmt (value kommt als 8080 zurück).
  const abgelehnt = zahlSchritt(gemeldet.z, { art: 'verwerfen' }, PORT, 8000);
  const angenommen = zahlSchritt(gemeldet.z, { art: 'aussen', wert: 8080 }, PORT, 8080);
  gleich(
    [abgelehnt, angenommen],
    [
      { z: { text: '8000', geaendert: false }, verbraucht: true },
      { z: { text: '8080', geaendert: false }, verbraucht: false },
    ],
    'Eingabe: zahlSchritt nach dem Übernehmen – abgelehnt: Escape verwirft auf den echten Wert und gehört dem Feld; angenommen: der Wert von außen schließt den Entwurf',
  );
}
// E27: gemeldet ist nicht übernommen – nicht doppelt melden, nach der Frist sichtbar, die Antwort des Tools gilt
{
  const gemeldet = zahlSchritt({ text: '8080', geaendert: true }, { art: 'uebernehmen' }, PORT, 8000);
  const nochmal = zahlSchritt(gemeldet.z, { art: 'uebernehmen' }, PORT, 8000);
  const neu = zahlSchritt(zahlSchritt(gemeldet.z, { art: 'tippen', text: '8081' }, PORT, 8000).z, { art: 'uebernehmen' }, PORT, 8000);
  gleich(
    [nochmal, neu.neuerWert],
    [{ z: gemeldet.z, verbraucht: false }, 8081],
    'Eingabe: zahlSchritt – ein gemeldeter Wert wird nicht noch einmal gemeldet (Verlassen nach Enter, Tool lehnt ab); eine neue Eingabe meldet wieder',
  );
  const frist = zahlSchritt(gemeldet.z, { art: 'frist' }, PORT, 8000);
  gleich(
    [frist, zahlSchritt(frist.z, { art: 'uebernehmen' }, PORT, 8000).neuerWert, zahlSchritt(zahlEntwurfAus(8000), { art: 'frist' }, PORT, 8000)],
    [
      { z: { text: '8080', geaendert: true, gesendet: 8080, fehler: 'Noch nicht übernommen.' }, verbraucht: false },
      undefined,
      { z: { text: '8000', geaendert: false }, verbraucht: false },
    ],
    'Eingabe: zahlSchritt frist – ohne Antwort „Noch nicht übernommen.“, der Text bleibt und wird nicht erneut gemeldet; ohne gemeldeten Wert nichts',
  );
  gleich(
    [zahlSchritt(gemeldet.z, { art: 'aussen', wert: 8081 }, PORT, 8081).z, zahlSchritt(frist.z, { art: 'aussen', wert: 8081 }, PORT, 8081).z],
    [{ text: '8081', geaendert: false }, { text: '8081', geaendert: false }],
    'Eingabe: zahlSchritt aussen nach dem Melden – das Feld zeigt den Wert, mit dem das Tool antwortet (auch nach der Frist)',
  );
}
{
  let geplant: { f: () => void; ms: number } | undefined;
  let gemeldet = 0;
  let angehalten: unknown;
  const aufraeumen = starteFrist(() => void gemeldet++, {
    setTimeout: (f, ms) => {
      geplant = { f, ms };
      return 9;
    },
    clearTimeout: (id) => {
      angehalten = id;
    },
  });
  geplant?.f();
  aufraeumen();
  gleich([geplant?.ms, UEBERNAHME_FRIST_MS, gemeldet, angehalten], [2000, 2000, 1, 9], 'Eingabe: starteFrist meldet einmal nach 2 s, das Aufräumen hält die Frist an');
}
gleich(
  zahlSchritt({ text: '70000', geaendert: true }, { art: 'uebernehmen' }, PORT, 8000),
  { z: { text: '70000', fehler: 'Höchstens 65535.', geaendert: true }, verbraucht: false },
  'Eingabe: zahlSchritt uebernehmen ungültig → Fehler, Text bleibt, kein neuerWert',
);
gleich(
  [
    zahlSchritt(zahlEntwurfAus(8000), { art: 'uebernehmen' }, PORT, 8000),
    zahlSchritt({ text: '1,50', geaendert: true }, { art: 'uebernehmen' }, {}, 1.5),
  ],
  [
    { z: { text: '8000', geaendert: false }, verbraucht: false },
    { z: { text: '1,5', geaendert: false }, verbraucht: false },
  ],
  'Eingabe: zahlSchritt uebernehmen ohne Änderung oder mit gleichem Wert → kein neuerWert',
);
gleich(
  zahlSchritt({ text: '70000', fehler: 'Höchstens 65535.', geaendert: true }, { art: 'verwerfen' }, PORT, 8000),
  { z: { text: '8000', geaendert: false }, verbraucht: true },
  'Eingabe: zahlSchritt verwerfen mit Änderung → verbraucht, Text = aktueller Wert',
);
gleich(
  zahlSchritt(zahlEntwurfAus(8000), { art: 'verwerfen' }, PORT, 8000),
  { z: { text: '8000', geaendert: false }, verbraucht: false },
  'Eingabe: zahlSchritt verwerfen ohne Änderung → nicht verbraucht (Escape gehört dem Panel)',
);
gleich(
  [
    zahlSchritt(zahlEntwurfAus(8000), { art: 'aussen', wert: 9000 }, PORT, 8000),
    zahlSchritt(zahlEntwurfAus(8000), { art: 'aussen', wert: null }, PORT, 8000),
    zahlSchritt({ text: '81', geaendert: true }, { art: 'aussen', wert: 9000 }, PORT, 8000),
  ],
  [
    { z: { text: '9000', geaendert: false }, verbraucht: false },
    { z: { text: '', geaendert: false }, verbraucht: false },
    { z: { text: '81', geaendert: true }, verbraucht: false },
  ],
  'Eingabe: zahlSchritt aussen – ohne Änderung übernommen, mit Änderung bleibt der Entwurf',
);

// ── selectOptionen (E11: der Wert springt nie still um) ──
{
  const GERAETE: SelectOption[] = [
    { value: 'mic-1', label: 'Mikrofon 1' },
    { value: 'mic-2', label: 'Mikrofon 2' },
  ];
  const vorher = JSON.stringify(GERAETE);
  const vorhanden = selectOptionen(GERAETE, 'mic-2');
  ok(JSON.stringify(vorhanden) === vorher && vorhanden !== GERAETE, 'Eingabe: selectOptionen – Wert vorhanden → Liste unverändert (Kopie)');
  gleich(
    selectOptionen(GERAETE, '', { placeholder: 'System-Standard' })[0],
    { value: '', label: 'System-Standard' },
    "Eingabe: selectOptionen – '' mit placeholder → erste Option { value: '', label: placeholder }",
  );
  gleich(
    selectOptionen(GERAETE, '')[0],
    { value: '', label: '– bitte wählen –' },
    "Eingabe: selectOptionen – '' ohne placeholder → erste Option „– bitte wählen –“",
  );
  gleich(
    selectOptionen([{ value: '', label: 'Standard' }, ...GERAETE], ''),
    [{ value: '', label: 'Standard' }, ...GERAETE],
    "Eingabe: selectOptionen – '' als echte Option → keine zusätzliche Option",
  );
  gleich(
    [selectOptionen(GERAETE, 'usb-9', { fehlendLabel: 'USB-Mikrofon' }), selectOptionen(GERAETE, 'usb-9')[0]],
    [
      [{ value: 'usb-9', label: 'nicht verfügbar: USB-Mikrofon', disabled: true }, ...GERAETE],
      { value: 'usb-9', label: 'nicht verfügbar: usb-9', disabled: true },
    ],
    'Eingabe: selectOptionen – fehlender Wert → erste Option „nicht verfügbar: …“ disabled, Wert bleibt',
  );
  ok(JSON.stringify(GERAETE) === vorher, 'Eingabe: selectOptionen verändert die Eingabe nie');
}

// ── Feld-IDs und aria-describedby (E13: Reihenfolge Hilfe, Sperre, Fehler, dann extra) ──
{
  const ids = feldIds('port');
  gleich(ids, { input: 'port', hilfe: 'port-hilfe', sperre: 'port-sperre', fehler: 'port-fehler' }, 'Eingabe: feldIds');
  gleich(
    [
      beschreibtDurch(ids, { fehler: true, sperre: true, hilfe: true, extra: ['port-einheit'] }),
      beschreibtDurch(ids, { fehler: true, hilfe: true }),
      beschreibtDurch(ids, { extra: ['port-einheit'] }),
    ],
    ['port-hilfe port-sperre port-fehler port-einheit', 'port-hilfe port-fehler', 'port-einheit'],
    'Eingabe: beschreibtDurch – Reihenfolge Hilfe, Sperre, Fehler, extra',
  );
  gleich(
    [beschreibtDurch(ids, {}), beschreibtDurch(ids, { hilfe: false, extra: [] })],
    [undefined, undefined],
    'Eingabe: beschreibtDurch – nichts → undefined',
  );
}

ok(typeof ui.parseZahl === 'function' && ui.parseZahl('3').ok && typeof ui.starteFrist === 'function', 'Eingabe: Export parseZahl und starteFrist aus src/index.ts');
```

`packages/ui/test/selftest.ts`, Vorher:
```ts
abschluss();
```
Nachher:
```ts
import './theme.test';
import './eingabe.test';
abschluss();
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen):
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '<worktree>\packages\ui\src\lib\theme' imported from <worktree>\packages\ui\test\theme.test.ts
…
Exit=1
```

- [ ] **Step 3: Theme-Speicher und Eingabe-Logik anlegen**

Inhalt von `packages/ui/src/lib/theme.ts`:
```ts
// Hell/Dunkel (Spec 3.7, 8; E10): gemerkt je Tool unter dem Schlüssel jm-theme. Dunkel ist Standard und der Rückfall
// bei jedem Fehler. Auf <html> steht danach genau eine der Klassen dark/light (Klassenvertrag der index.html aller Apps).
// Einzige Datei in @jm/ui mit localStorage (Quellregel in Task 3); jeder Zugriff in try/catch, ohne window kein Speicher.

export type Theme = 'dark' | 'light';

export const THEME_SCHLUESSEL = 'jm-theme';

export interface ThemeSpeicher {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

/** Gespeichertes Theme; fehlender Speicher, Fehler oder ein fremder Wert → 'dark'. */
export function leseTheme(speicher: ThemeSpeicher | null | undefined): Theme {
  if (!speicher) return 'dark';
  try {
    return speicher.getItem(THEME_SCHLUESSEL) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/** Merkt das Theme. false, wenn es nicht gespeichert werden konnte; wirft nie. */
export function schreibeTheme(speicher: ThemeSpeicher | null | undefined, t: Theme): boolean {
  if (!speicher) return false;
  try {
    speicher.setItem(THEME_SCHLUESSEL, t);
    return true;
  } catch {
    return false;
  }
}

/** Setzt genau eine der Klassen dark/light; andere Klassen bleiben. Ohne Ziel passiert nichts. */
export function wendeThemeAn(
  ziel: { classList: { add(c: string): void; remove(c: string): void } } | null | undefined,
  t: Theme,
): void {
  if (!ziel) return;
  ziel.classList.remove(t === 'dark' ? 'light' : 'dark');
  ziel.classList.add(t);
}

/** window.localStorage, wenn erreichbar; ohne window (Node, Tests) oder bei gesperrtem Speicher → null. */
export function browserSpeicher(): ThemeSpeicher | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Ein Hell/Dunkel-Zustand für das ganze Dokument (E10): jeder useTheme-Aufruf liest und setzt denselben Wert. */
export interface ThemeStore {
  lies(): Theme;
  setze(t: Theme): void;
  abonniere(hoerer: () => void): () => void;
}

/** Woher der Store Speicher und <html> nimmt (im Test nachgestellt). */
export interface ThemeUmgebung {
  speicher(): ThemeSpeicher | null | undefined;
  html(): { classList: { add(c: string): void; remove(c: string): void } } | null | undefined;
}

/**
 * Store für Hell/Dunkel: Bis zur ersten Wahl liest er den Speicher (jeder Fehler → Dunkel). Eine Wahl gilt sofort für
 * alle Abonnenten, auch wenn der Speicher sie nicht aufnimmt; sie wird gemerkt und auf <html> gesetzt.
 */
export function erzeugeThemeStore(u: ThemeUmgebung): ThemeStore {
  let gewaehlt: Theme | undefined;
  const hoerer = new Set<() => void>();
  return {
    lies: () => gewaehlt ?? leseTheme(u.speicher()),
    setze(t) {
      gewaehlt = t;
      schreibeTheme(u.speicher(), t);
      wendeThemeAn(u.html(), t);
      for (const h of [...hoerer]) h();
    },
    abonniere(h) {
      hoerer.add(h);
      return () => {
        hoerer.delete(h);
      };
    },
  };
}

/** <html> im Browser; ohne document (Node, Tests) null. */
export function browserHtml(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.documentElement;
}

/** Der Store des Dokuments; useTheme (Task 12) liest ihn über useSyncExternalStore. */
export const themeStore: ThemeStore = erzeugeThemeStore({ speicher: browserSpeicher, html: browserHtml });
```

Inhalt von `packages/ui/src/lib/eingabe.ts`:
```ts
// Reine Logik der Eingaben (Spec 3.5; E11, E12, E13). Ohne DOM testbar; Field, NumberInput und Select nutzen sie.
import { UI_TEXTE, zahlText } from './texte';

// ── Zahlen (NumberInput) ──

export interface ZahlRegeln {
  min?: number;
  max?: number;
  ganzzahl?: boolean;
}

export type ZahlErgebnis = { ok: true; wert: number } | { ok: false; fehler: string };

const ZAHL = /^-?\d+([.,]\d+)?$/;

/** Prüft einen Eingabetext. Komma und Punkt sind Dezimaltrenner. Außerhalb von min/max wird nie geklemmt. */
export function parseZahl(text: string, regeln: ZahlRegeln = {}): ZahlErgebnis {
  const roh = text.trim();
  if (!ZAHL.test(roh)) return { ok: false, fehler: UI_TEXTE.zahlFehlt };
  const wert = Number(roh.replace(',', '.'));
  if (regeln.ganzzahl && !Number.isInteger(wert)) return { ok: false, fehler: UI_TEXTE.ganzzahlFehlt };
  if (regeln.min !== undefined && wert < regeln.min) return { ok: false, fehler: UI_TEXTE.mindestens(regeln.min) };
  if (regeln.max !== undefined && wert > regeln.max) return { ok: false, fehler: UI_TEXTE.hoechstens(regeln.max) };
  return { ok: true, wert };
}

/**
 * Entwurf im Feld: Text, wie getippt; fehler nach einem misslungenen Übernehmen oder nach der Frist; geaendert = weicht vom
 * Wert ab; gesendet = per onChange gemeldet, aber noch nicht als Wert zurückgekommen (E27).
 */
export interface ZahlEntwurf {
  text: string;
  fehler?: string;
  geaendert: boolean;
  gesendet?: number;
}

export type ZahlEreignis =
  | { art: 'tippen'; text: string }
  | { art: 'uebernehmen' } // Enter oder Verlassen
  | { art: 'verwerfen' } // Escape
  | { art: 'aussen'; wert: number | null } // neuer Wert von außen
  | { art: 'frist' }; // die Frist nach dem Melden ist um (E27)

export function zahlEntwurfAus(wert: number | null): ZahlEntwurf {
  return { text: wert === null ? '' : zahlText(wert), geaendert: false };
}

/**
 * Ein Schritt des Entwurfs. neuerWert nur, wenn eine gültige Zahl übernommen wird, die sich vom aktuellen Wert
 * unterscheidet. verbraucht = Escape hat einen geänderten Entwurf verworfen (dann gehört Escape dem Feld, nicht dem Panel).
 */
export function zahlSchritt(
  z: ZahlEntwurf,
  e: ZahlEreignis,
  regeln: ZahlRegeln,
  aktuell: number | null,
): { z: ZahlEntwurf; neuerWert?: number; verbraucht: boolean } {
  if (e.art === 'tippen') {
    return { z: { text: e.text, geaendert: e.text !== zahlEntwurfAus(aktuell).text }, verbraucht: false };
  }
  if (e.art === 'uebernehmen') {
    if (!z.geaendert) return { z: zahlEntwurfAus(aktuell), verbraucht: false };
    const ergebnis = parseZahl(z.text, regeln);
    if (!ergebnis.ok) return { z: { text: z.text, fehler: ergebnis.fehler, geaendert: true }, verbraucht: false };
    if (ergebnis.wert === aktuell) return { z: zahlEntwurfAus(aktuell), verbraucht: false };
    // Schon gemeldet und noch nicht zurück: nicht noch einmal melden (Verlassen nach Enter, abgelehnter Wert; E27).
    if (ergebnis.wert === z.gesendet) return { z, verbraucht: false };
    // Gemeldet ist noch nicht übernommen: Der Entwurf bleibt geändert und merkt sich den Wert, bis er von außen
    // zurückkommt („aussen“); bleibt die Antwort aus, zeigt das Feld nach der Frist „Noch nicht übernommen.“ („frist“).
    // Escape gehört bis dahin weiter dem Feld.
    return { z: { text: zahlText(ergebnis.wert), geaendert: true, gesendet: ergebnis.wert }, neuerWert: ergebnis.wert, verbraucht: false };
  }
  if (e.art === 'verwerfen') {
    return { z: zahlEntwurfAus(aktuell), verbraucht: z.geaendert };
  }
  if (e.art === 'frist') {
    return { z: z.gesendet === undefined || z.fehler ? z : { ...z, fehler: UI_TEXTE.nochNichtUebernommen }, verbraucht: false };
  }
  // aussen: ein ungeänderter oder schon gemeldeter Entwurf folgt dem neuen Wert (das Tool hat geantwortet); ein
  // angefangener bleibt stehen (nichts Getipptes geht verloren)
  if (!z.geaendert || z.gesendet !== undefined || z.text === zahlEntwurfAus(e.wert).text) {
    return { z: zahlEntwurfAus(e.wert), verbraucht: false };
  }
  return { z, verbraucht: false };
}

// ── Frist nach dem Melden (E27) ──

/** So lange wartet ein Feld auf den gemeldeten Wert, bevor es „Noch nicht übernommen.“ zeigt. */
export const UEBERNAHME_FRIST_MS = 2000;

/** Was starteFrist vom Takt braucht (setTimeout/clearTimeout passen). */
export interface FristTakt {
  setTimeout(f: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

const ECHTE_FRIST: FristTakt = {
  setTimeout: (f, ms) => setTimeout(f, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/** Körper des Frist-Effekts: meldet einmal nach UEBERNAHME_FRIST_MS; liefert das Aufräumen (neue Eingabe, Antwort, Abbau). */
export function starteFrist(melde: () => void, takt: FristTakt = ECHTE_FRIST): () => void {
  const id = takt.setTimeout(melde, UEBERNAHME_FRIST_MS);
  return () => takt.clearTimeout(id);
}

// ── Auswahl (Select) ──

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Optionen für ein natives <select>, die den Wert nie still umspringen lassen (E11):
 * - Wert vorhanden → Kopie der Liste.
 * - Wert '' und nicht in der Liste → erste Option { value: '', label: placeholder ?? „– bitte wählen –“ }.
 * - Wert fehlt → erste Option „nicht verfügbar: {fehlendLabel ?? value}“, disabled, damit sie gewählt bleibt.
 */
export function selectOptionen(
  options: readonly SelectOption[],
  value: string,
  opts: { placeholder?: string; fehlendLabel?: string } = {},
): Array<SelectOption & { disabled?: boolean }> {
  const liste = options.map((o) => ({ value: o.value, label: o.label }));
  if (options.some((o) => o.value === value)) return liste;
  if (value === '') return [{ value: '', label: opts.placeholder ?? UI_TEXTE.bitteWaehlen }, ...liste];
  return [{ value, label: UI_TEXTE.nichtVerfuegbar(opts.fehlendLabel ?? value), disabled: true }, ...liste];
}

// ── Feld-IDs (Field) ──

export interface FeldIds {
  input: string;
  hilfe: string;
  sperre: string;
  fehler: string;
}

export function feldIds(basis: string): FeldIds {
  return { input: basis, hilfe: `${basis}-hilfe`, sperre: `${basis}-sperre`, fehler: `${basis}-fehler` };
}

/** aria-describedby in der Reihenfolge Hilfe, Sperre, Fehler, dann extra; nichts → undefined. */
export function beschreibtDurch(
  ids: FeldIds,
  hat: { hilfe?: boolean; sperre?: boolean; fehler?: boolean; extra?: string[] },
): string | undefined {
  const teile: string[] = [];
  if (hat.hilfe) teile.push(ids.hilfe);
  if (hat.sperre) teile.push(ids.sperre);
  if (hat.fehler) teile.push(ids.fehler);
  teile.push(...(hat.extra ?? []));
  return teile.length > 0 ? teile.join(' ') : undefined;
}
```

- [ ] **Step 4: Test laufen lassen (noch rot: Index fehlt)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen):
```
FAIL Theme: Export THEME_SCHLUESSEL aus src/index.ts
FAIL Eingabe: Export parseZahl und starteFrist aus src/index.ts

2 FEHLGESCHLAGEN
Exit=1
```

- [ ] **Step 5: Exporte anhängen** (Edit-Werkzeug, `packages/ui/src/index.ts` Zeile 13)

Vorher:
```ts
export { type StatusState, type StatusGroup, type StatusItem, STATUS_SYMBOL, ordneStatus, unbekannt, formatUhrzeit, formatUhrzeitKurz } from './lib/status';
```
Nachher:
```ts
export { type StatusState, type StatusGroup, type StatusItem, STATUS_SYMBOL, ordneStatus, unbekannt, formatUhrzeit, formatUhrzeitKurz } from './lib/status';
export { type Theme, THEME_SCHLUESSEL } from './lib/theme';
export { type SelectOption, parseZahl, starteFrist } from './lib/eingabe';
```

- [ ] **Step 6: Test laufen lassen (grün)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
npm run selftest -w @jm/ui 2>&1 | grep -c "^ok "
```
Erwartet (gemessen), nach den 190 Zeilen aus Task 1–6:
```
ok   Theme: kein Speicher → dark
ok   Theme: getItem wirft → dark, kein Wurf
ok   Theme: nichts gespeichert → dark
ok   Theme: 'light' → light; 'dark' → dark; 'LIGHT', 'blau', '' → dark
ok   Theme: schreibeTheme – setItem wirft → false, kein Wurf
ok   Theme: schreibeTheme ohne Speicher → false
ok   Theme: schreibeTheme ok → true, Schlüssel jm-theme
ok   Theme: wendeThemeAn – aus dark wird light, genau eine Klasse; doppelt angewandt gleich; andere Klassen bleiben
ok   Theme: wendeThemeAn – stehen beide Klassen, bleibt genau eine
ok   Theme: wendeThemeAn(null) wirft nicht
ok   Theme: browserSpeicher unter Node (ohne window) → null
ok   Theme-Store: ein Wert für alle Abonnenten (zwei Schalter zeigen nie Verschiedenes), gemerkt, auf <html>; Abgemeldete hören nichts mehr
ok   Theme-Store: Speicher gesperrt → Start Dunkel, die Wahl gilt trotzdem für das Dokument
ok   Theme-Store: der Store des Dokuments liest unter Node Dunkel, ohne <html>
ok   Theme: Export THEME_SCHLUESSEL aus src/index.ts
ok   Eingabe: parseZahl '', 'abc', '1e3' u. a. → „Bitte eine Zahl eingeben.“
ok   Eingabe: parseZahl ' 42 ' → 42 (Leerraum weg)
ok   Eingabe: parseZahl Komma und Punkt als Dezimaltrenner, Minus erlaubt
ok   Eingabe: parseZahl '1.5' mit ganzzahl → „Bitte eine ganze Zahl eingeben.“
ok   Eingabe: parseZahl '0' mit min 1 → „Mindestens 1.“, Grenze selbst gilt
ok   Eingabe: parseZahl '70000' mit max 65535 → „Höchstens 65535.“ (kein stilles Klemmen)
ok   Eingabe: zahlEntwurfAus – null → leer, 1.5 → 1,5
ok   Eingabe: zahlSchritt tippen – Entwurf ändert sich, zurückgetippt ist nichts geändert
ok   Eingabe: zahlSchritt uebernehmen gültig → neuerWert, Entwurf bleibt geändert, bis der Wert zurückkommt
ok   Eingabe: zahlSchritt nach dem Übernehmen – abgelehnt: Escape verwirft auf den echten Wert und gehört dem Feld; angenommen: der Wert von außen schließt den Entwurf
ok   Eingabe: zahlSchritt – ein gemeldeter Wert wird nicht noch einmal gemeldet (Verlassen nach Enter, Tool lehnt ab); eine neue Eingabe meldet wieder
ok   Eingabe: zahlSchritt frist – ohne Antwort „Noch nicht übernommen.“, der Text bleibt und wird nicht erneut gemeldet; ohne gemeldeten Wert nichts
ok   Eingabe: zahlSchritt aussen nach dem Melden – das Feld zeigt den Wert, mit dem das Tool antwortet (auch nach der Frist)
ok   Eingabe: starteFrist meldet einmal nach 2 s, das Aufräumen hält die Frist an
ok   Eingabe: zahlSchritt uebernehmen ungültig → Fehler, Text bleibt, kein neuerWert
ok   Eingabe: zahlSchritt uebernehmen ohne Änderung oder mit gleichem Wert → kein neuerWert
ok   Eingabe: zahlSchritt verwerfen mit Änderung → verbraucht, Text = aktueller Wert
ok   Eingabe: zahlSchritt verwerfen ohne Änderung → nicht verbraucht (Escape gehört dem Panel)
ok   Eingabe: zahlSchritt aussen – ohne Änderung übernommen, mit Änderung bleibt der Entwurf
ok   Eingabe: selectOptionen – Wert vorhanden → Liste unverändert (Kopie)
ok   Eingabe: selectOptionen – '' mit placeholder → erste Option { value: '', label: placeholder }
ok   Eingabe: selectOptionen – '' ohne placeholder → erste Option „– bitte wählen –“
ok   Eingabe: selectOptionen – '' als echte Option → keine zusätzliche Option
ok   Eingabe: selectOptionen – fehlender Wert → erste Option „nicht verfügbar: …“ disabled, Wert bleibt
ok   Eingabe: selectOptionen verändert die Eingabe nie
ok   Eingabe: feldIds
ok   Eingabe: beschreibtDurch – Reihenfolge Hilfe, Sperre, Fehler, extra
ok   Eingabe: beschreibtDurch – nichts → undefined
ok   Eingabe: Export parseZahl und starteFrist aus src/index.ts

ALLE TESTS OK
Exit=0
234
```

- [ ] **Step 7: Mutationsprobe** (Kopie nach „Gemeinsam für Block A“; je eine Probe allein, danach zurückbauen)

1. `<Kopie>\packages\ui\src\lib\theme.ts`, `leseTheme` ohne `try`: Vorher
   ```ts
     try {
       return speicher.getItem(THEME_SCHLUESSEL) === 'light' ? 'light' : 'dark';
     } catch {
       return 'dark';
     }
   ```
   Nachher `  return speicher.getItem(THEME_SCHLUESSEL) === 'light' ? 'light' : 'dark';`. Erwartet (gemessen):
   ```
   Exit=1
   FAIL Theme: getItem wirft → dark, kein Wurf
        ist: "WURF" soll: "dark"
   FAIL Theme-Store: Speicher gesperrt → Start Dunkel, die Wahl gilt trotzdem für das Dokument
        ist: ["WURF","light"] soll: ["dark","light"]
   2 FEHLGESCHLAGEN
   ```
2. `<Kopie>\packages\ui\src\lib\eingabe.ts`, `parseZahl` klemmt auf max: Vorher
   `return { ok: false, fehler: UI_TEXTE.hoechstens(regeln.max) };` → Nachher `return { ok: true, wert: regeln.max };`.
   Erwartet (gemessen):
   ```
   Exit=1
   FAIL Eingabe: parseZahl '70000' mit max 65535 → „Höchstens 65535.“ (kein stilles Klemmen)
        ist: [{"ok":true,"wert":65535},{"ok":true,"wert":65535}] soll: [{"ok":false,"fehler":"Höchstens 65535."},{"ok":true,"wert":65535}]
   FAIL Eingabe: zahlSchritt uebernehmen ungültig → Fehler, Text bleibt, kein neuerWert
        ist: {"z":{"text":"65535","geaendert":true},"neuerWert":65535,"verbraucht":false} soll: {"z":{"text":"70000","fehler":"Höchstens 65535.","geaendert":true},"verbraucht":false}
   2 FEHLGESCHLAGEN
   ```
3. `<Kopie>\packages\ui\src\lib\eingabe.ts`, `selectOptionen` lässt den fehlenden Wert weg: Vorher
   `  return [{ value, label: UI_TEXTE.nichtVerfuegbar(opts.fehlendLabel ?? value), disabled: true }, ...liste];` →
   Nachher `  return liste;`. Erwartet (gemessen):
   ```
   Exit=1
   FAIL Eingabe: selectOptionen – fehlender Wert → erste Option „nicht verfügbar: …“ disabled, Wert bleibt
        ist: [[{"value":"mic-1",…},{"value":"mic-2",…}],{"value":"mic-1","label":"Mikrofon 1"}] soll: [[{"value":"usb-9","label":"nicht verfügbar: USB-Mikrofon","disabled":true},…],…]
   1 FEHLGESCHLAGEN
   ```
4. `<Kopie>\packages\ui\src\lib\eingabe.ts`, „gemeldet gilt schon als übernommen“ (alte Fassung): Vorher
   `    return { z: { text: zahlText(ergebnis.wert), geaendert: true, gesendet: ergebnis.wert }, neuerWert: ergebnis.wert, verbraucht: false };` →
   Nachher `    return { z: zahlEntwurfAus(ergebnis.wert), neuerWert: ergebnis.wert, verbraucht: false };`. Erwartet (gemessen):
   ```
   Exit=1
   FAIL Eingabe: zahlSchritt uebernehmen gültig → neuerWert, Entwurf bleibt geändert, bis der Wert zurückkommt
        ist: {"z":{"text":"8080","geaendert":false},"neuerWert":8080,"verbraucht":false} soll: {"z":{"text":"8080","geaendert":true,"gesendet":8080},"neuerWert":8080,"verbraucht":false}
   FAIL Eingabe: zahlSchritt nach dem Übernehmen – abgelehnt: Escape verwirft auf den echten Wert und gehört dem Feld; angenommen: der Wert von außen schließt den Entwurf
   FAIL Eingabe: zahlSchritt – ein gemeldeter Wert wird nicht noch einmal gemeldet (Verlassen nach Enter, Tool lehnt ab); eine neue Eingabe meldet wieder
   FAIL Eingabe: zahlSchritt frist – ohne Antwort „Noch nicht übernommen.“, der Text bleibt und wird nicht erneut gemeldet; ohne gemeldeten Wert nichts
   4 FEHLGESCHLAGEN
   ```
5. `<Kopie>\packages\ui\src\lib\theme.ts`, der Store meldet nichts: Vorher `      for (const h of [...hoerer]) h();` →
   Nachher: Zeile löschen. Erwartet (gemessen):
   ```
   Exit=1
   FAIL Theme-Store: ein Wert für alle Abonnenten (zwei Schalter zeigen nie Verschiedenes), gemerkt, auf <html>; Abgemeldete hören nichts mehr
        ist: ["dark","light","light","jm-andere light","dark",0,0] soll: ["dark","light","light","jm-andere light","dark",1,2]
   1 FEHLGESCHLAGEN
   ```
6. `<Kopie>\packages\ui\src\lib\theme.ts`, der Store vergisst die Wahl bei gesperrtem Speicher: Vorher
   `    lies: () => gewaehlt ?? leseTheme(u.speicher()),` → Nachher `    lies: () => leseTheme(u.speicher()),`.
   Erwartet (gemessen):
   ```
   Exit=1
   FAIL Theme-Store: Speicher gesperrt → Start Dunkel, die Wahl gilt trotzdem für das Dokument
        ist: ["dark","dark"] soll: ["dark","light"]
   1 FEHLGESCHLAGEN
   ```
7. `<Kopie>\packages\ui\src\lib\eingabe.ts`, ein gemeldeter Wert wird bei jedem Verlassen erneut gemeldet (Fassung der
   ersten Nachbesserung, E27): die Zeile `    if (ergebnis.wert === z.gesendet) return { z, verbraucht: false };` löschen.
   Erwartet (gemessen):
   ```
   Exit=1
   FAIL Eingabe: zahlSchritt – ein gemeldeter Wert wird nicht noch einmal gemeldet (Verlassen nach Enter, Tool lehnt ab); eine neue Eingabe meldet wieder
        ist: [{"z":{"text":"8080","geaendert":true,"gesendet":8080},"neuerWert":8080,"verbraucht":false},8081] soll: [{"z":{"text":"8080","geaendert":true,"gesendet":8080},"verbraucht":false},8081]
   FAIL Eingabe: zahlSchritt frist – ohne Antwort „Noch nicht übernommen.“, der Text bleibt und wird nicht erneut gemeldet; ohne gemeldeten Wert nichts
   2 FEHLGESCHLAGEN
   ```
8. `<Kopie>\packages\ui\src\lib\eingabe.ts`, die Frist zeigt nichts: Vorher
   `    return { z: z.gesendet === undefined || z.fehler ? z : { ...z, fehler: UI_TEXTE.nochNichtUebernommen }, verbraucht: false };`
   → Nachher `    return { z, verbraucht: false };`. Erwartet (gemessen):
   ```
   Exit=1
   FAIL Eingabe: zahlSchritt frist – ohne Antwort „Noch nicht übernommen.“, der Text bleibt und wird nicht erneut gemeldet; ohne gemeldeten Wert nichts
   1 FEHLGESCHLAGEN
   ```
9. `<Kopie>\packages\ui\src\lib\eingabe.ts`, die Antwort des Tools wird übergangen (der gemeldete Entwurf bleibt stehen,
   auch wenn 8081 statt 8080 zurückkommt): Vorher `  if (!z.geaendert || z.gesendet !== undefined || z.text === zahlEntwurfAus(e.wert).text) {`
   → Nachher `  if (!z.geaendert || z.text === zahlEntwurfAus(e.wert).text) {`. Erwartet (gemessen):
   ```
   Exit=1
   FAIL Eingabe: zahlSchritt aussen nach dem Melden – das Feld zeigt den Wert, mit dem das Tool antwortet (auch nach der Frist)
        ist: [{"text":"8080","geaendert":true,"gesendet":8080},{"text":"8080","geaendert":true,"gesendet":8080,"fehler":"Noch nicht übernommen."}] soll: [{"text":"8081","geaendert":false},{"text":"8081","geaendert":false}]
   1 FEHLGESCHLAGEN
   ```
10. `<Kopie>\packages\ui\src\lib\eingabe.ts`, die Frist meldet nie: Vorher
    `  const id = takt.setTimeout(melde, UEBERNAHME_FRIST_MS);` → Nachher `  const id = takt.setTimeout(() => undefined, UEBERNAHME_FRIST_MS);`.
    Erwartet (gemessen):
    ```
    Exit=1
    FAIL Eingabe: starteFrist meldet einmal nach 2 s, das Aufräumen hält die Frist an
         ist: [2000,2000,0,9] soll: [2000,2000,1,9]
    1 FEHLGESCHLAGEN
    ```
Kopie aufräumen (Junction zuerst).

- [ ] **Step 8: Typprüfung**

```
npm run typecheck -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen): keine Fehlerzeile, `Exit=0`.

- [ ] **Step 9: Commit**

```
git add packages/ui/src/lib/theme.ts packages/ui/src/lib/eingabe.ts packages/ui/src/index.ts packages/ui/test/theme.test.ts packages/ui/test/eingabe.test.ts packages/ui/test/selftest.ts
git status --short
```
Erwartet:
```
M  packages/ui/src/index.ts
A  packages/ui/src/lib/eingabe.ts
A  packages/ui/src/lib/theme.ts
A  packages/ui/test/eingabe.test.ts
M  packages/ui/test/selftest.ts
A  packages/ui/test/theme.test.ts
```
Dann:
```
git commit -m "feat(ui): Theme-Speicher und Eingabe-Logik (Zahl, Auswahl, Feld-IDs)" -m "Spec 3.7/8: Hell/Dunkel unter jm-theme, jeder Zugriff in try/catch, jeder Fehler und jeder fremde Wert faellt auf Dunkel zurueck; auf html steht danach genau eine der Klassen dark/light. Spec 3.5: parseZahl prueft ohne stilles Klemmen (Komma und Punkt, ganzzahl, min, max), zahlSchritt fuehrt den Entwurf fuer Enter, Verlassen, Escape und neue Werte von aussen, meldet einen Wert nur einmal und zeigt nach der Frist (starteFrist, 2 s) Noch nicht uebernommen; selectOptionen laesst einen fehlenden Wert als nicht verfuegbar gewaehlt, statt still umzuspringen; feldIds und beschreibtDurch fuer aria-describedby in der Reihenfolge Hilfe, Sperre, Fehler." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst (Auslegungen, wo 9.6 schweigt):**
- `selectOptionen` mit Wert `''`, ohne Option `''` und **ohne** `placeholder`: vorn `{ value: '', label: '– bitte wählen –' }`
  (`UI_TEXTE.bitteWaehlen`); sonst zeigte das native `<select>` still die erste Option an (E11).
- `zahlSchritt`: `tippen` setzt `geaendert` nur, wenn der Text vom Text des aktuellen Werts abweicht; `uebernehmen` mit
  gleichem Wert in anderer Schreibweise liefert keinen `neuerWert`; `aussen` überschreibt einen geänderten Entwurf nicht.
- Zusätzliche Fälle: beide Klassen gleichzeitig auf `<html>`, `schreibeTheme` ohne Speicher, `''` als echte Option,
  `fehlendLabel` fehlt, Exporte aus `src/index.ts`.
- Nachbesserung nach dem Review: `erzeugeThemeStore`/`themeStore` (ein Hell/Dunkel-Zustand für das ganze Dokument; vorher
  zeigten zwei `ThemeToggle` nach einem Klick Verschiedenes) und `zahlSchritt` hält den Entwurf nach einem `neuerWert`
  „geändert“, bis der Wert von außen zurückkommt (vorher zeigte das Feld still einen Wert, den das Tool abgelehnt hatte, und
  Escape gehörte dann dem Panel). Neue Proben 4–6; Probe 1 trifft jetzt auch den Store mit gesperrtem Speicher (2 `FAIL`).
- Zweite Nachbesserung (Prüfrunde 2, E27): Der Entwurf merkt sich den gemeldeten Wert (`gesendet`). Vorher meldete jedes
  weitere Verlassen einen abgelehnten Wert erneut (ein Neustart des Steuerservers wurde bei jedem Fokuswechsel neu
  versucht), ein abgelehnter Wert stand ohne Hinweis im Feld, und ein normalisiert zurückkommender Wert (8081 statt 8080)
  ersetzte den Entwurf nicht. Neu: Ereignis `frist` mit „Noch nicht übernommen.“, `aussen` folgt nach dem Melden jeder
  Antwort, `starteFrist` als Körper des Frist-Effekts (Task 10, 17) und im Paket-Index für `@jm/settings`. Neue Proben 7–10,
  Probe 4 an die neue Zeile angepasst. Der Kommentar „zeigt das Feld so keinen Wert, den es nicht gibt“ der ersten
  Nachbesserung stimmte nicht: Der abgelehnte Wert stand weiter sichtbar im Feld.

---

## Block B · Bausteine in `@jm/ui` (Aufgaben 8–15)

Gemeinsam für Block B (gilt für jede Aufgabe dieses Blocks):
- Jede Aufgabe hängt ihre Export-Zeilen aus 9.8 ans Ende von `packages/ui/src/index.ts` und ihr Testmodul als `import`-Zeile direkt vor `abschluss();` in `packages/ui/test/selftest.ts`.
- Gerendert wird nur über `render()` aus der Testhilfe (`./harness`, 9.1). Die Lesehilfen für das erzeugte HTML (`tags`, `attr`, `klassen`, `hatKlassen`, `text`, `ohneVersteckt`, `zwischen`) entstehen in Task 8 in `packages/ui/test/lib/markup.ts` und gelten nur für die Tests dieses Blocks.
- Interaktion wird über reine Handler-Funktionen getestet: `tallyHandler` (9), `zahlTaste` (10), `panelTaste` (13), `statusKlick` und `zahnradKlick` (15). Seit der Nachbesserung auch die **Bindung**: Prop-Bauer liefern alle Props eines Elements, der Baustein reicht sie per Spread durch, und der Test ruft jeden Handler auf (`tallyKnopfProps` 9, `zahlFeldHandler`/`zahlAnsichtHandler` 10, `themeKnopfProps` 12, `panelProps` 13). Die Körper der Effekte sind reine Funktionen mit nachgestellter Uhr bzw. nachgestellten Elementen (`starteUhr` 8, `haltenBeiZustand`/`haltenBeiAbbau`/`haltenFuerRender` 9, `panelFokus`/`panelSprung` 13; Hell/Dunkel über den Store aus Task 7), und ein Quelltext-Test prüft, dass genau diese Aufrufe im Baustein stehen. Ein Quelltext-Test sichert nur den Wortlaut (die Pflichtzeilen stehen da, kein Handler daneben), nicht die Wirkung; deshalb gehören auch Zeilen wie `useRef` für die Halten-Steuerung zu den Pflichtzeilen (Task 9, Probe n), und die Wirkung prüft der Owner. Alles ist nur aus seiner Datei exportiert, **nicht** aus `index.ts`. Dass React die Effekte im Browser wirklich ausführt, misst kein Test unter `renderToStaticMarkup`; das prüft der Owner in der Galerie (Task 23, Owner-Prüfpunkte 1–6 unter „Nach der Umsetzung“). Jede Aufgabe nennt unter „Für die Galerie“, was dort zu sehen sein muss.
- Die Quellregeln aus Task 3 laufen bei jedem Selbsttest über alle neuen Dateien unter `packages/ui/src` mit und müssen grün bleiben (keine rohen Farben, keine zusammengesetzten Klassen, jede `var(--…)` definiert, `text-[var(--tally-…|--status-…)]` nur in `lib/status.ts`, nur `motion-safe:`-Übergänge, kein `localStorage` außerhalb von `lib/theme.ts`).
- Rot heißt in diesem Block: Solange die Komponente fehlt, bricht `tsx` beim Laden der Testmodule ab (`ERR_MODULE_NOT_FOUND`), es läuft gar kein Test, Exit-Code 1.
- Zählweise: Jede Aufgabe nennt die Zahl **ihrer** Zeilen und den Befehl, der genau sie zählt (alle Testnamen eines Moduls beginnen mit einem eigenen Präfix), dazu die Gesamtzahl nach der Aufgabe. Die Gesamtzahlen sind mit dem echten Code aus Block A gemessen (nach der zweiten Nachbesserung): nach Task 8 **257**, 9 **294**, 10 **319**, 11 **336**, 12 **344**, 13 **363**, 14 **375**, 15 **393** `ok`-Zeilen.
- Die Abschnitte „Nachgerechnet“ beschreiben die Messung des Schreibers mit nachgebautem Block A. Beim Zusammensetzen lief jede Aufgabe noch einmal mit dem echten Block A: dieselben Rot-Meldungen, dieselben eigenen `ok`-Zahlen, jede Mutationsprobe rot mit denselben `FAIL`-Zeilen. Einzige Ausnahme war die alte Probe 11c; sie ist ersetzt (Task 11, „Abweichungen“).
- Mutationsprobe (G9) im Plan-Worktree, vor dem Stagen: je eine Ersetzung **allein** einbauen, Selbsttest muss rot werden, Ersetzung mit dem Edit-Werkzeug zurücknehmen (Nachher → Vorher), Selbsttest wieder `ALLE TESTS OK`. Ohne Commit. Das Ergebnis kommt in den Aufgabenbericht. Erst danach wird gestagt; der grüne Lauf nach der letzten Probe und `git status --short` beim Commit zeigen, dass keine Probe stehen geblieben ist (Entscheidung Z3).
- React 18.3 schreibt im Server-Rendering `inputMode` in Kamel-Schreibweise (`inputMode="numeric"`, gemessen) und warnt bei `useLayoutEffect` auf dem Server; die Bausteine nutzen deshalb `useLayoutEffect` nur im Browser (Task 13).
- Commit: `git add` nur mit den genannten Pfaden; `git status --short` zeigt danach genau die genannten gestagten Zeilen. Fremde Dateien (`??`) bleiben ungestaged (G13).

---

### Task 8: `StatusPill` und `StatusBar`

**Spec:** `docs/superpowers/specs/2026-10-08-suite-ux-update-design.md` Abschnitte 3.3 (Reihenfolge, Symbole, Knopf, Uhr, schmale Fenster), 7.1–7.4, 4.2 (Symbol und Text, nie nur Farbe), 4.3 (Bewegung). Entscheidung E14; Regeln G3, G6, G7, G8; Review Focus 3.

**Arbeitsverzeichnis/Voraussetzung:** Wurzel des Worktrees (Branch legt der Controller fest). Tasks 1–7 sind committet: Testhilfe (9.1), Tokens (Task 3), `src/lib/texte.ts` und `src/lib/status.ts` (Task 5). Alle Pfade relativ zur Repo-Wurzel.

**Dateien:**
- Create: `packages/ui/test/lib/markup.ts` (Lesehilfen für die Render-Tests von Block B)
- Create: `packages/ui/test/statusbar.test.tsx`
- Create: `packages/ui/src/components/StatusPill.tsx`
- Create: `packages/ui/src/components/StatusBar.tsx`
- Modify: `packages/ui/test/selftest.ts` (eine `import`-Zeile vor `abschluss();`)
- Modify: `packages/ui/src/index.ts` (zwei Zeilen am Ende)

**Interfaces:**
- Consumes: `UI_TEXTE.zustand`, `UI_TEXTE.statusOeffnen`, `UI_TEXTE.uhrzeit`, `UI_TEXTE.live` (9.2); `StatusState`, `StatusItem`, `STATUS_SYMBOL`, `STATUS_SYMBOL_KLASSE`, `STATUS_RAND_KLASSE`, `LIVE_EINTRAG_KLASSE`, `ordneStatus`, `formatUhrzeit` (9.3); `cn`; Testhilfe `ok`, `gleich`, `render`, `fehlendeIdVerweise`, `pruefeIdVerweise` (9.1).
- Produces (9.7, exakt so; Block C nutzt `StatusPill`, Block D baut die Galerie dagegen):
  ```ts
  // packages/ui/src/components/StatusPill.tsx
  export interface StatusPillProps { state: StatusState; text: string; title?: string; className?: string }
  export function StatusPill(p: StatusPillProps): React.JSX.Element;
  // packages/ui/src/components/StatusBar.tsx
  export interface StatusBarProps {
    items: readonly StatusItem[];
    onOpenSection?(sectionId: string): void;
    jetzt?: () => Date;            // Vorgabe () => new Date(); Uhr tickt per Effekt kurz nach jeder vollen Sekunde
    className?: string;
  }
  export function StatusBar(p: StatusBarProps): React.JSX.Element;
  // nur aus der Datei (Körper des Uhr-Effekts, ohne Browser prüfbar):
  export interface Takt { setTimeout(f: () => void, ms: number): unknown; clearTimeout(id: unknown): void }
  export function starteUhr(jetzt: () => Date, melde: (uhr: string) => void, takt?: Takt): () => void;
  ```
  Pflichtklassen: Wurzel `<footer class="… h-[var(--statusbar-h)] …">`; Detail `max-[900px]:sr-only` und `select-text`; Uhr `tabular`.
  Neue Zeilen in `index.ts` (9.8): `export { StatusPill } from './components/StatusPill';`, `export { StatusBar } from './components/StatusBar';`.

**Verhalten (verbindlich):**
- `StatusPill`: `<span data-state="{state}">` mit Rand `STATUS_RAND_KLASSE[state]` und Schrift `--foreground`; darin das Symbol `<span aria-hidden="true" class="{STATUS_SYMBOL_KLASSE[state]}">`, das Zustandswort `<span class="sr-only">{UI_TEXTE.zustand[state]}: </span>`, dann der Text. Die Statusfarbe färbt nur Symbol und Rand, nie das Wort (G7). `live` ist rot **gefüllt** (`LIVE_EINTRAG_KLASSE`, Schrift in Hintergrundfarbe) und zeigt nach dem Symbol die Kennung „LIVE“ (`aria-hidden`, das Zustandswort liest der Screenreader); `error` bleibt nur umrandet (Spec 3.3, 4.2; E14).
- `StatusBar`: `<footer>` · `<div role="status" aria-live="polite">` mit den Einträgen in der Reihenfolge von `ordneStatus` · rechts außerhalb der Region die Uhr `<span data-uhr class="tabular …">` mit sr-only „Uhrzeit: “ und `hh:mm:ss` aus `jetzt()`. Die Uhr tickt im Browser kurz nach jeder vollen Sekunde; der Effekt ruft nur `starteUhr` (reine Funktion mit eigenem Takt, getestet), die den nächsten Takt jeweils aus `jetzt()` neu plant (ein fester 1-s-Takt ab dem Einhängen ginge bis zu 1 s nach, E14). Sie steht bewusst außerhalb der Live-Region (E14), sonst läse ein Screenreader jede Sekunde vor.
- Eintrag: Symbol (aria-hidden) · bei `live` die Kennung „LIVE“ (aria-hidden) · sr-only Zustandswort · Label · Detail **nur, wenn das Tool eines liefert** (kein „–“, kein Ersatz). Detail `truncate max-[900px]:sr-only select-text` (unter 900 px unsichtbar, aber vorlesbar), `title` = „{label}: {detail}“ nur mit Detail. `live` ist rot **gefüllt** (`LIVE_EINTRAG_KLASSE`): Symbol, Kennung, Label und Detail in Hintergrundfarbe (dunkel 4,63, hell 5,43, normale Schrift; Task 4). Alle anderen Zustände haben Schrift in Vordergrundfarbe, das Detail gedämpft; `error` ist nur rot umrandet (E14).
- Knopf **genau dann**, wenn der Eintrag `settingsSection` hat **und** die Leiste `onOpenSection` bekommt: `<button type="button" aria-label="{label}: Einstellungen öffnen">`, Klick → `onOpenSection(settingsSection)`. Hover: Unterstreichung, ohne Fläche (bei `live` bleibt die rote Fläche); eine Fläche `--muted` drückte das ▲ von `--status-warn` hell auf 2,91 : 1 (Task 4, E14). Damit das aria-label den Zustand nicht verschluckt, zeigt `aria-describedby` auf das sr-only Zustandswort und das Detail (ids per `useId`). Sonst `<span>`.
- Leere Liste: Leiste mit Uhr, leere Region (Zustand ohne Sitzung, Spec 3.8).

**Regeln für diese Aufgabe:** TDD (G9). Neue Dateien mit dem Write-Werkzeug, `selftest.ts` und `index.ts` mit dem Edit-Werkzeug (G11, Arbeitsbaum CRLF). Nur Arbiträrklassen auf Tokens, jede Klasse als vollständiges Literal (G3). Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel, nie pushen (G13).

---

- [ ] **Step 1: Lesehilfen für die Render-Tests anlegen** (`packages/ui/test/lib/markup.ts`, neu)

```ts
// Kleine Lesehilfen für das HTML aus renderToStaticMarkup (nur Tests von Block B).
// Bewusst ohne DOM-Bibliothek: Die Bausteine schreiben aria-hidden immer als erstes Attribut,
// und die gesuchten Elemente sind nicht ineinander verschachtelt (siehe die einzelnen Tests).

function entities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Alle öffnenden Tags eines Elements, z. B. tags(html, 'button') → ['<button type="button" …>', …]. */
export function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}(?=[\\s>/])[^>]*>`, 'g')) ?? [];
}

/** Wert eines Attributs in einem öffnenden Tag (Entities aufgelöst), sonst undefined. */
export function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? entities(m[1]) : undefined;
}

/** Die Klassen eines öffnenden Tags als Liste. */
export function klassen(tag: string): string[] {
  return (attr(tag, 'class') ?? '').split(/\s+/).filter(Boolean);
}

/** true, wenn das Tag ALLE Klassen aus `liste` (durch Leerzeichen getrennt) trägt. */
export function hatKlassen(tag: string, liste: string): boolean {
  const da = new Set(klassen(tag));
  return liste.split(/\s+/).filter(Boolean).every((k) => da.has(k));
}

/** Text ohne Tags (Entities aufgelöst) – so, wie ihn ein Mensch oder Screenreader liest. */
export function text(html: string): string {
  return entities(html.replace(/<[^>]+>/g, ''));
}

/** HTML ohne die aria-hidden-Symbole (`<span aria-hidden="true" …>…</span>`, nicht verschachtelt). */
export function ohneVersteckt(html: string): string {
  return html.replace(/<span aria-hidden="true"[^>]*>[^<]*<\/span>/g, '');
}

/** Der Teil zwischen dem ersten `start` und dem ersten `ende` danach (beide ausgeschlossen); '' wenn nicht gefunden. */
export function zwischen(html: string, start: string, ende: string): string {
  const a = html.indexOf(start);
  if (a < 0) return '';
  const b = html.indexOf(ende, a + start.length);
  return b < 0 ? '' : html.slice(a + start.length, b);
}
```

- [ ] **Step 2: Fehlschlagenden Test schreiben** (`packages/ui/test/statusbar.test.tsx`, neu)

```tsx
// Task 8 · StatusPill und StatusBar (Spec 3.3, 7; E14): Symbol und Zustandswort statt nur Farbe, feste Reihenfolge,
// Knopf nur mit Ziel UND Rückruf, Detail nur wenn geliefert, Uhr außerhalb der Status-Region.
import { StatusBar, starteUhr } from '../src/components/StatusBar';
import { StatusPill } from '../src/components/StatusPill';
import {
  LIVE_EINTRAG_KLASSE,
  STATUS_RAND_KLASSE,
  STATUS_SYMBOL,
  STATUS_SYMBOL_KLASSE,
  type StatusItem,
  type StatusState,
} from '../src/lib/status';
import { UI_TEXTE } from '../src/lib/texte';
import { fehlendeIdVerweise, gleich, leseText, ok, pruefeIdVerweise, render } from './harness';
import { attr, hatKlassen, klassen, ohneVersteckt, tags, text, zwischen } from './lib/markup';

const ZUSTAENDE: StatusState[] = ['ok', 'warn', 'error', 'off', 'live'];
/** Feste Uhr: 08.10.2026, 09:05:07 Ortszeit. */
const UHR = (): Date => new Date(2026, 9, 8, 9, 5, 7);
/** Inhalt der role="status"-Region (sie enthält keine weiteren div). */
const region = (html: string): string => {
  const r = zwischen(html, '<div role="status"', '</div>');
  return r.slice(r.indexOf('>') + 1);
};
/** Öffnendes Tag des Eintrags mit dieser id (span oder button). */
const eintrag = (html: string, id: string): string =>
  tags(html, '(?:span|button)').find((t) => attr(t, 'data-status-id') === id) ?? '';
const symbol = (s: StatusState): string =>
  `<span aria-hidden="true" class="${STATUS_SYMBOL_KLASSE[s]}">${STATUS_SYMBOL[s]}</span>`;

// ── StatusPill ──
for (const s of ZUSTAENDE) {
  const html = render(<StatusPill state={s} text="Probe" />);
  const [wurzel] = tags(html, 'span');
  ok(
    attr(wurzel, 'data-state') === s &&
      hatKlassen(wurzel, `border ${STATUS_RAND_KLASSE[s]} ${s === 'live' ? LIVE_EINTRAG_KLASSE : 'text-[var(--foreground)]'}`) &&
      html.includes(symbol(s)) &&
      html.includes(`<span class="sr-only">${UI_TEXTE.zustand[s]}: </span>`) &&
      text(ohneVersteckt(html)) === `${UI_TEXTE.zustand[s]}: Probe`,
    `StatusPill ${s}: Symbol aria-hidden, sr-only-Zustandswort, Text sichtbar, data-state`,
  );
}
{
  const live = render(<StatusPill state="live" text="Programm" />);
  const fehler = render(<StatusPill state="error" text="Programm" />);
  ok(
    STATUS_SYMBOL.live !== STATUS_SYMBOL.error &&
      STATUS_RAND_KLASSE.live !== STATUS_RAND_KLASSE.error &&
      text(ohneVersteckt(live)) !== text(ohneVersteckt(fehler)) &&
      hatKlassen(tags(live, 'span')[0], 'bg-[var(--tally-live)]') &&
      live.includes(`>${UI_TEXTE.live}<`) &&
      !fehler.includes('bg-[var(--tally-live)]') &&
      !fehler.includes(`>${UI_TEXTE.live}<`),
    'StatusPill: live und error unterscheiden sich in Symbol, Rand, Fläche, Kennung „LIVE“ und Zustandswort (Spec 4.2)',
  );
  const mitTitel = render(<StatusPill state="ok" text="kurz" title="ganzer Text" />);
  ok(attr(tags(mitTitel, 'span')[0], 'title') === 'ganzer Text', 'StatusPill: title wird durchgereicht');
}

// ── StatusBar ──
{
  const gemischt: StatusItem[] = [
    { id: 'werkzeug', group: 'tool', label: 'Werkzeug', state: 'ok' },
    { id: 'companion', group: 'fernsteuerung', label: 'Companion', state: 'off' },
    { id: 'ndi', group: 'ausgabe', label: 'NDI', state: 'live' },
    { id: 'master', group: 'verbindung', label: 'Master', state: 'ok' },
    { id: 'iveo', group: 'verbindung', label: 'iveo', state: 'warn' },
  ];
  const html = render(<StatusBar items={gemischt} jetzt={UHR} />);
  gleich(
    tags(html, '(?:span|button)').map((t) => attr(t, 'data-status-id')).filter((x) => x !== undefined),
    ['master', 'iveo', 'ndi', 'companion', 'werkzeug'],
    'StatusBar: Reihenfolge nach Gruppen (verbindung → ausgabe → fernsteuerung → tool, in der Gruppe wie im Array)',
  );
  const [wurzel] = tags(html, 'footer');
  ok(hatKlassen(wurzel, 'h-[var(--statusbar-h)] shrink-0'), 'StatusBar: Höhe h-[var(--statusbar-h)]');
  const [statusDiv] = tags(html, 'div');
  ok(
    attr(statusDiv, 'role') === 'status' && attr(statusDiv, 'aria-live') === 'polite',
    'StatusBar: Einträge in einer role="status"-Region mit aria-live="polite"',
  );
}

// Spec 7.1: vollständiges Kreuzprodukt 5 Zustände × Detail ja/nein × settingsSection ja/nein × onOpenSection ja/nein.
{
  const fehler: string[] = [];
  let faelle = 0;
  for (const s of ZUSTAENDE) {
    for (const detail of [undefined, 'JM Titler (REGIE-PC)']) {
      for (const ziel of [undefined, 'ndi-ausgabe']) {
        for (const mitRueckruf of [false, true]) {
          faelle++;
          const item: StatusItem = {
            id: 'ndi',
            group: 'ausgabe',
            label: 'NDI',
            state: s,
            ...(detail ? { detail } : {}),
            ...(ziel ? { settingsSection: ziel } : {}),
          };
          const html = render(
            <StatusBar items={[item]} jetzt={UHR} onOpenSection={mitRueckruf ? () => undefined : undefined} />,
          );
          const r = region(html);
          const name = `${s}/${detail ? 'Detail' : 'ohne'}/${ziel ? 'Ziel' : 'ohne'}/${mitRueckruf ? 'Rückruf' : 'ohne'}`;
          const knopfSoll = ziel !== undefined && mitRueckruf;
          const knoepfe = tags(r, 'button');
          if (!r.includes(symbol(s))) fehler.push(`${name}: Symbol fehlt`);
          const gelesen = text(ohneVersteckt(r));
          const soll = `${UI_TEXTE.zustand[s]}: NDI${detail ? ` ${detail}` : ''}`;
          if (gelesen !== soll) fehler.push(`${name}: Text „${gelesen}“ statt „${soll}“`);
          if (knoepfe.length !== (knopfSoll ? 1 : 0)) fehler.push(`${name}: ${knoepfe.length} Knopf/Knöpfe`);
          if (knopfSoll && (attr(knoepfe[0], 'type') !== 'button' || attr(knoepfe[0], 'aria-label') !== 'NDI: Einstellungen öffnen')) {
            fehler.push(`${name}: Knopf ohne type=button oder aria-label`);
          }
          if (!knopfSoll && tags(r, 'span').filter((t) => attr(t, 'data-status-id') === 'ndi').length !== 1) {
            fehler.push(`${name}: Anzeige ist kein span`);
          }
          if (attr(eintrag(r, 'ndi'), 'data-state') !== s) fehler.push(`${name}: data-state`);
          if (fehlendeIdVerweise(html).length > 0) fehler.push(`${name}: fehlende ids ${fehlendeIdVerweise(html).join(',')}`);
        }
      }
    }
  }
  ok(faelle === 40 && fehler.length === 0, 'StatusBar Kreuzprodukt: 5 Zustände × Detail × settingsSection × onOpenSection (40 Fälle)');
  for (const f of fehler.slice(0, 6)) console.log(`     ${f}`);
  if (fehler.length > 6) console.log(`     … und ${fehler.length - 6} weitere`);
}

{
  const html = render(
    <StatusBar items={[{ id: 'ndi', group: 'ausgabe', label: 'NDI', state: 'ok', detail: 'JM Titler (REGIE-PC)' }]} jetzt={UHR} />,
  );
  const detailTag = tags(html, 'span').find((t) => hatKlassen(t, 'truncate'));
  ok(
    attr(eintrag(html, 'ndi'), 'title') === 'NDI: JM Titler (REGIE-PC)' &&
      detailTag !== undefined &&
      hatKlassen(detailTag, 'truncate max-[900px]:sr-only select-text'),
    'StatusBar: Detail gekürzt, title = „{label}: {detail}“, unter 900 px max-[900px]:sr-only (vorlesbar), select-text',
  );
  const ohne = render(<StatusBar items={[{ id: 'ndi', group: 'ausgabe', label: 'NDI', state: 'ok' }]} jetzt={UHR} />);
  ok(attr(eintrag(ohne, 'ndi'), 'title') === undefined, 'StatusBar: ohne Detail kein title');
}

{
  const html = render(
    <StatusBar
      items={[{ id: 'ndi', group: 'ausgabe', label: 'NDI', state: 'error', detail: 'Port belegt', settingsSection: 'ndi-ausgabe' }]}
      onOpenSection={() => undefined}
      jetzt={UHR}
    />,
  );
  const [knopf] = tags(html, 'button');
  ok(attr(knopf, 'aria-label') === 'NDI: Einstellungen öffnen', 'StatusBar: Knopf aria-label „{label}: Einstellungen öffnen“');
  const beschreibung = (attr(knopf, 'aria-describedby') ?? '')
    .split(' ')
    .map((id) => text(zwischen(html, `id="${id}"`, '</span>').replace(/^[^>]*>/, '')))
    .join('');
  ok(beschreibung === 'Fehler: Port belegt', 'StatusBar: Knopf beschreibt Zustandswort und Detail per aria-describedby');
  pruefeIdVerweise(html, 'StatusBar: alle id-Verweise des Knopfs gültig');
}

{
  // E14: Hover nur als Unterstreichung. Auf einer Fläche --muted erreichte das ▲ von --status-warn hell nur 2,91 : 1 (Task 4).
  const html = render(
    <StatusBar items={[{ id: 'iveo', group: 'verbindung', label: 'iveo', state: 'warn', settingsSection: 'iveo' }]} onOpenSection={() => undefined} jetzt={UHR} />,
  );
  const [knopf] = tags(html, 'button');
  ok(
    hatKlassen(knopf, 'hover:underline') && !klassen(knopf).some((k) => k.startsWith('hover:bg-')),
    'StatusBar: Hover eines Knopfs nur als Unterstreichung, ohne Fläche (Statussymbol nie auf --muted, E14)',
  );
}

{
  const html = render(<StatusBar items={[{ id: 'ndi', group: 'ausgabe', label: 'NDI', state: 'ok' }]} jetzt={UHR} />);
  const uhr = tags(html, 'span').find((t) => attr(t, 'data-uhr') !== undefined);
  ok(
    html.includes('09:05:07') && !region(html).includes('09:05:07') && uhr !== undefined && hatKlassen(uhr, 'tabular'),
    'StatusBar: Uhr 09:05:07 aus jetzt(), tabular, außerhalb von role=status',
  );
}

{
  const html = render(<StatusBar items={[]} jetzt={UHR} />);
  ok(
    tags(html, 'footer').length === 1 && html.includes('role="status"') && html.includes('09:05:07') &&
      tags(html, 'button').length === 0 && region(html) === '',
    'StatusBar: leere Liste → Leiste mit Uhr (Zustand ohne Sitzung)',
  );
}

{
  const html = render(
    <StatusBar items={[{ id: 'ndi', group: 'ausgabe', label: 'NDI', state: 'live', detail: 'Programm' }]} jetzt={UHR} />,
  );
  const r = region(html);
  ok(
    hatKlassen(eintrag(html, 'ndi'), `${STATUS_RAND_KLASSE.live} ${LIVE_EINTRAG_KLASSE}`) &&
      !hatKlassen(eintrag(html, 'ndi'), 'text-[var(--foreground)]') &&
      r.includes(symbol('live')) &&
      r.includes(`<span aria-hidden="true" class="font-extrabold tracking-[0.08em]">${UI_TEXTE.live}</span>`) &&
      !r.includes('text-[var(--muted-foreground)]') &&
      !r.includes('text-[var(--brand-fg-on-dark)]'),
    'StatusBar: live-Eintrag rot gefüllt mit ■ und sichtbarem „LIVE“, Schrift und Detail in Hintergrundfarbe (Spec 3.3, 4.2; E14)',
  );
  const fehler = render(
    <StatusBar items={[{ id: 'ndi', group: 'ausgabe', label: 'NDI', state: 'error', detail: 'Port belegt' }]} jetzt={UHR} />,
  );
  ok(
    hatKlassen(eintrag(fehler, 'ndi'), `${STATUS_RAND_KLASSE.error} text-[var(--foreground)]`) &&
      !region(fehler).includes('bg-[var(--tally-live)]') &&
      !region(fehler).includes(`>${UI_TEXTE.live}<`),
    'StatusBar: error-Eintrag nur rot umrandet, ohne Fläche und ohne „LIVE“ (Form statt nur Farbton)',
  );
}

{
  const gemeldet: string[] = [];
  const geplant: Array<{ f: () => void; ms: number }> = [];
  let angehalten: unknown;
  let t = new Date(2026, 9, 8, 9, 5, 7, 300);
  const anhalten = starteUhr(() => t, (u) => void gemeldet.push(u), {
    setTimeout: (f, ms) => {
      geplant.push({ f, ms });
      return geplant.length;
    },
    clearTimeout: (id) => {
      angehalten = id;
    },
  });
  t = new Date(2026, 9, 8, 9, 5, 8, 4);
  geplant[0]?.f();
  anhalten();
  gleich(
    [geplant.map((g) => g.ms), gemeldet, angehalten],
    [[700, 996], ['09:05:08'], 2],
    'StatusBar Uhr: tickt kurz nach der vollen Sekunde (700 ms nach 09:05:07,300), meldet hh:mm:ss aus jetzt() und plant neu; Aufräumen hält den letzten Takt an',
  );
  ok(
    leseText('src/components/StatusBar.tsx').split('useEffect(() => starteUhr(() => jetztRef.current(), setUhr), []);').length === 2,
    'StatusBar Verdrahtung: die Uhr läuft über starteUhr im Effekt (genau einmal)',
  );
}
```
Hinweis: Das Kreuzprodukt ist **ein** `ok` über alle 40 Fälle; bei einem Fehlschlag druckt es höchstens sechs betroffene Fälle und dann „… und n weitere“. Der Text eines Eintrags wird ohne die aria-hidden-Symbole gelesen (`text(ohneVersteckt(…))`), also so, wie ihn ein Screenreader liest: „{Zustandswort}: {Label}[ {Detail}]“ – jedes weitere Wort ist ein Fehler (Gegenmittel zum Ist-Fehler „Bereit“ neben „Startet…“ in `apps/ndi-screen-capture/src/renderer/src/components/StatusBar.tsx:38`).

- [ ] **Step 3: Testmodul einhängen** (`packages/ui/test/selftest.ts`)

Vorher:
```ts
abschluss();
```
Nachher:
```ts
import './statusbar.test';
abschluss();
```

- [ ] **Step 4: Test laufen lassen (rot)**

Run: `npm run selftest -w @jm/ui`
Expected: `tsx` bricht beim Laden ab, kein Test läuft, npm meldet `Lifecycle script \`selftest\` failed`, Exit-Code 1:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\packages\ui\src\components\StatusBar' imported from …\packages\ui\test\statusbar.test.tsx
```

- [ ] **Step 5: `StatusPill` anlegen** (`packages/ui/src/components/StatusPill.tsx`, neu)

```tsx
import { cn } from '../lib/cn';
import { LIVE_EINTRAG_KLASSE, STATUS_RAND_KLASSE, STATUS_SYMBOL, STATUS_SYMBOL_KLASSE, type StatusState } from '../lib/status';
import { UI_TEXTE } from '../lib/texte';

export interface StatusPillProps {
  state: StatusState;
  text: string;
  title?: string;
  className?: string;
}

/**
 * Kleine Zustandsanzeige (Spec 3.3, 4.2): Symbol (Form je Zustand) plus Text, nie nur Farbe. Die Statusfarbe färbt nur
 * Symbol und Rand; das Wort steht in Vordergrundfarbe. Das Zustandswort („Fehler: “ …) liest nur der Screenreader.
 * live ist rot gefüllt mit der Kennung „LIVE“ (E14), error nur umrandet.
 */
export function StatusPill({ state, text, title, className }: StatusPillProps): React.JSX.Element {
  const live = state === 'live';
  return (
    <span
      data-state={state}
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] border px-2 py-0.5',
        'text-[11px] font-semibold',
        live ? LIVE_EINTRAG_KLASSE : 'text-[var(--foreground)]',
        STATUS_RAND_KLASSE[state],
        className,
      )}
    >
      <span aria-hidden="true" className={STATUS_SYMBOL_KLASSE[state]}>
        {STATUS_SYMBOL[state]}
      </span>
      {live ? (
        <span aria-hidden="true" className="font-extrabold tracking-[0.08em]">
          {UI_TEXTE.live}
        </span>
      ) : null}
      <span className="sr-only">{UI_TEXTE.zustand[state]}: </span>
      {text}
    </span>
  );
}
```

- [ ] **Step 6: `StatusBar` anlegen** (`packages/ui/src/components/StatusBar.tsx`, neu)

```tsx
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import {
  LIVE_EINTRAG_KLASSE,
  STATUS_RAND_KLASSE,
  STATUS_SYMBOL,
  STATUS_SYMBOL_KLASSE,
  formatUhrzeit,
  ordneStatus,
  type StatusItem,
} from '../lib/status';
import { UI_TEXTE } from '../lib/texte';

export interface StatusBarProps {
  items: readonly StatusItem[];
  onOpenSection?(sectionId: string): void;
  /** Uhr-Quelle; Vorgabe () => new Date(). Tests setzen eine feste Zeit. */
  jetzt?: () => Date;
  className?: string;
}

const jetztVorgabe = (): Date => new Date();

/** Was starteUhr vom Takt braucht (setTimeout/clearTimeout passen). */
export interface Takt {
  setTimeout(f: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

const ECHTER_TAKT: Takt = {
  setTimeout: (f, ms) => setTimeout(f, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/**
 * Körper des Uhr-Effekts (E14): meldet hh:mm:ss aus jetzt() jeweils kurz nach der vollen Sekunde und plant den nächsten
 * Takt aus jetzt() neu; liefert das Aufräumen. Ein fester 1-s-Takt ab dem Einhängen ginge bis zu 1 s nach und übersprünge
 * durch Drift gelegentlich eine Sekunde. Reine Funktion mit austauschbarem Takt, damit sie ohne Browser prüfbar ist. Nur
 * aus dieser Datei exportiert.
 */
export function starteUhr(jetzt: () => Date, melde: (uhr: string) => void, takt: Takt = ECHTER_TAKT): () => void {
  let id: unknown;
  const plane = (): void => {
    id = takt.setTimeout(() => {
      melde(formatUhrzeit(jetzt()));
      plane();
    }, 1000 - jetzt().getMilliseconds());
  };
  plane();
  return () => takt.clearTimeout(id);
}

/**
 * Statusleiste am unteren Fensterrand (Spec 3.3, 7; E14).
 * - Reihenfolge fest nach Gruppen (ordneStatus), jeder Eintrag mit Symbol UND Zustandswort, nie nur Farbe.
 * - Ein Eintrag ist nur dann ein Knopf, wenn er `settingsSection` hat UND die Leiste `onOpenSection` bekommt.
 * - Ein Detail erscheint nur, wenn das Tool eines liefert (kein Ersatzzeichen). Unter 900 px Fensterbreite nur Symbol
 *   und Label; das volle Detail steht im title.
 * - Die Uhr steht außerhalb der role="status"-Region, sonst läse ein Screenreader jede Sekunde vor.
 */
export function StatusBar({ items, onOpenSection, jetzt = jetztVorgabe, className }: StatusBarProps): React.JSX.Element {
  const jetztRef = useRef(jetzt);
  jetztRef.current = jetzt;
  const [uhr, setUhr] = useState(() => formatUhrzeit(jetzt()));

  useEffect(() => starteUhr(() => jetztRef.current(), setUhr), []);

  return (
    <footer
      className={cn(
        'flex h-[var(--statusbar-h)] shrink-0 items-center gap-2 border-t border-[var(--border)] bg-[var(--card)] px-2',
        'text-[11px] text-[var(--foreground)]',
        className,
      )}
    >
      <div role="status" aria-live="polite" className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        {ordneStatus(items).map((item) => (
          <Eintrag key={item.id} item={item} onOpenSection={onOpenSection} />
        ))}
      </div>
      <span data-uhr="" className="tabular shrink-0 text-[var(--muted-foreground)]">
        <span className="sr-only">{UI_TEXTE.uhrzeit}: </span>
        {uhr}
      </span>
    </footer>
  );
}

function Eintrag({
  item,
  onOpenSection,
}: {
  item: StatusItem;
  onOpenSection?(sectionId: string): void;
}): React.JSX.Element {
  const id = useId();
  const ziel = item.settingsSection;
  const knopf = Boolean(ziel) && onOpenSection !== undefined;
  const zustandId = knopf ? `${id}-zustand` : undefined;
  const detailId = knopf && item.detail ? `${id}-detail` : undefined;
  const titel = item.detail ? `${item.label}: ${item.detail}` : undefined;
  const live = item.state === 'live';
  const klasse = cn(
    'inline-flex h-5 min-w-0 shrink items-center gap-1 rounded-[var(--radius-md)] border px-1.5',
    STATUS_RAND_KLASSE[item.state],
    live ? LIVE_EINTRAG_KLASSE : 'text-[var(--foreground)]',
  );
  const inhalt = (
    <>
      <span aria-hidden="true" className={STATUS_SYMBOL_KLASSE[item.state]}>
        {STATUS_SYMBOL[item.state]}
      </span>
      {live ? (
        <span aria-hidden="true" className="font-extrabold tracking-[0.08em]">
          {UI_TEXTE.live}
        </span>
      ) : null}
      <span id={zustandId} className="sr-only">
        {UI_TEXTE.zustand[item.state]}:{' '}
      </span>
      <span className="font-semibold">{item.label}</span>
      {item.detail ? (
        <>
          {' '}
          <span
            id={detailId}
            className={cn(
              'min-w-0 max-w-[16rem] truncate select-text max-[900px]:sr-only',
              live ? undefined : 'text-[var(--muted-foreground)]',
            )}
          >
            {item.detail}
          </span>
        </>
      ) : null}
    </>
  );

  if (ziel && onOpenSection) {
    return (
      <button
        type="button"
        data-status-id={item.id}
        data-state={item.state}
        title={titel}
        aria-label={UI_TEXTE.statusOeffnen(item.label)}
        aria-describedby={detailId ? `${zustandId} ${detailId}` : zustandId}
        onClick={() => onOpenSection(ziel)}
        className={cn(
          klasse,
          'cursor-pointer',
          // Hover ohne Fläche: auf --muted erreichte das ▲ von --status-warn hell nur 2,91 : 1 (Task 4, E14)
          'hover:underline',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
          'motion-safe:transition-colors motion-safe:duration-150',
        )}
      >
        {inhalt}
      </button>
    );
  }
  return (
    <span data-status-id={item.id} data-state={item.state} title={titel} className={klasse}>
      {inhalt}
    </span>
  );
}
```

- [ ] **Step 7: Exporte anhängen** (`packages/ui/src/index.ts`, Dateiende)

Vorher (die letzte Zeile, die Task 7 angehängt hat):
```ts
export { type SelectOption, parseZahl, starteFrist } from './lib/eingabe';
```
Nachher:
```ts
export { type SelectOption, parseZahl, starteFrist } from './lib/eingabe';
export { StatusPill } from './components/StatusPill';
export { StatusBar } from './components/StatusBar';
```

- [ ] **Step 8: Test laufen lassen (grün)**

Run: `npm run selftest -w @jm/ui`
Expected: keine Zeile mit `FAIL`, letzte Zeile `ALLE TESTS OK`, Exit-Code 0. Die Zeilen dieser Aufgabe:
```
ok   StatusPill ok: Symbol aria-hidden, sr-only-Zustandswort, Text sichtbar, data-state
ok   StatusPill warn: Symbol aria-hidden, sr-only-Zustandswort, Text sichtbar, data-state
ok   StatusPill error: Symbol aria-hidden, sr-only-Zustandswort, Text sichtbar, data-state
ok   StatusPill off: Symbol aria-hidden, sr-only-Zustandswort, Text sichtbar, data-state
ok   StatusPill live: Symbol aria-hidden, sr-only-Zustandswort, Text sichtbar, data-state
ok   StatusPill: live und error unterscheiden sich in Symbol, Rand, Fläche, Kennung „LIVE“ und Zustandswort (Spec 4.2)
ok   StatusPill: title wird durchgereicht
ok   StatusBar: Reihenfolge nach Gruppen (verbindung → ausgabe → fernsteuerung → tool, in der Gruppe wie im Array)
ok   StatusBar: Höhe h-[var(--statusbar-h)]
ok   StatusBar: Einträge in einer role="status"-Region mit aria-live="polite"
ok   StatusBar Kreuzprodukt: 5 Zustände × Detail × settingsSection × onOpenSection (40 Fälle)
ok   StatusBar: Detail gekürzt, title = „{label}: {detail}“, unter 900 px max-[900px]:sr-only (vorlesbar), select-text
ok   StatusBar: ohne Detail kein title
ok   StatusBar: Knopf aria-label „{label}: Einstellungen öffnen“
ok   StatusBar: Knopf beschreibt Zustandswort und Detail per aria-describedby
ok   StatusBar: alle id-Verweise des Knopfs gültig
ok   StatusBar: Hover eines Knopfs nur als Unterstreichung, ohne Fläche (Statussymbol nie auf --muted, E14)
ok   StatusBar: Uhr 09:05:07 aus jetzt(), tabular, außerhalb von role=status
ok   StatusBar: leere Liste → Leiste mit Uhr (Zustand ohne Sitzung)
ok   StatusBar: live-Eintrag rot gefüllt mit ■ und sichtbarem „LIVE“, Schrift und Detail in Hintergrundfarbe (Spec 3.3, 4.2; E14)
ok   StatusBar: error-Eintrag nur rot umrandet, ohne Fläche und ohne „LIVE“ (Form statt nur Farbton)
ok   StatusBar Uhr: tickt kurz nach der vollen Sekunde (700 ms nach 09:05:07,300), meldet hh:mm:ss aus jetzt() und plant neu; Aufräumen hält den letzten Takt an
ok   StatusBar Verdrahtung: die Uhr läuft über starteUhr im Effekt (genau einmal)
```
Zählen: `npm run selftest -w @jm/ui | grep -cE "^ok   (StatusPill|StatusBar)"` → `23`. Gesamt nach dieser Aufgabe (gemessen): `257` `ok`-Zeilen.

- [ ] **Step 9: Typecheck**

Run: `npm run typecheck -w @jm/ui`
Expected: keine Ausgabe von `tsc`, Exit-Code 0.

- [ ] **Step 10: Mutationsprobe (ohne Commit; je eine Änderung allein, danach zurück)**

a) Ersatzzeichen statt „kein Detail“ (Ist-Fehler der NDI-Capture-Statuszeile: Anzeige erfindet etwas):
Vorher (`packages/ui/src/components/StatusBar.tsx`):
```tsx
      ) : null}
    </>
  );
```
Nachher:
```tsx
      ) : (
        <span>–</span>
      )}
    </>
  );
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL StatusBar Kreuzprodukt: 5 Zustände × Detail × settingsSection × onOpenSection (40 Fälle)
     ok/ohne/ohne/ohne: Text „in Ordnung: NDI–“ statt „in Ordnung: NDI“
     ok/ohne/ohne/Rückruf: Text „in Ordnung: NDI–“ statt „in Ordnung: NDI“
     ok/ohne/Ziel/ohne: Text „in Ordnung: NDI–“ statt „in Ordnung: NDI“
     ok/ohne/Ziel/Rückruf: Text „in Ordnung: NDI–“ statt „in Ordnung: NDI“
     warn/ohne/ohne/ohne: Text „Warnung: NDI–“ statt „Warnung: NDI“
     warn/ohne/ohne/Rückruf: Text „Warnung: NDI–“ statt „Warnung: NDI“
     … und 14 weitere
1 FEHLGESCHLAGEN
```

b) Knopf auch ohne `onOpenSection`:
Vorher (`packages/ui/src/components/StatusBar.tsx`):
```tsx
  if (ziel && onOpenSection) {
```
Nachher:
```tsx
  if (ziel) {
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL StatusBar Kreuzprodukt: 5 Zustände × Detail × settingsSection × onOpenSection (40 Fälle)
     ok/ohne/Ziel/ohne: 1 Knopf/Knöpfe
     ok/ohne/Ziel/ohne: Anzeige ist kein span
     ok/Detail/Ziel/ohne: 1 Knopf/Knöpfe
     ok/Detail/Ziel/ohne: Anzeige ist kein span
     warn/ohne/Ziel/ohne: 1 Knopf/Knöpfe
     warn/ohne/Ziel/ohne: Anzeige ist kein span
     … und 14 weitere
1 FEHLGESCHLAGEN
```

c) Uhr in die Status-Region verschoben:
Vorher (`packages/ui/src/components/StatusBar.tsx`):
```tsx
        ))}
      </div>
      <span data-uhr="" className="tabular shrink-0 text-[var(--muted-foreground)]">
        <span className="sr-only">{UI_TEXTE.uhrzeit}: </span>
        {uhr}
      </span>
```
Nachher:
```tsx
        ))}
        <span data-uhr="" className="tabular shrink-0 text-[var(--muted-foreground)]">
          <span className="sr-only">{UI_TEXTE.uhrzeit}: </span>
          {uhr}
        </span>
      </div>
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL StatusBar Kreuzprodukt: 5 Zustände × Detail × settingsSection × onOpenSection (40 Fälle)
     ok/ohne/ohne/ohne: Text „in Ordnung: NDIUhrzeit: 09:05:07“ statt „in Ordnung: NDI“
     ok/ohne/ohne/Rückruf: Text „in Ordnung: NDIUhrzeit: 09:05:07“ statt „in Ordnung: NDI“
     ok/ohne/Ziel/ohne: Text „in Ordnung: NDIUhrzeit: 09:05:07“ statt „in Ordnung: NDI“
     ok/ohne/Ziel/Rückruf: Text „in Ordnung: NDIUhrzeit: 09:05:07“ statt „in Ordnung: NDI“
     ok/Detail/ohne/ohne: Text „in Ordnung: NDI JM Titler (REGIE-PC)Uhrzeit: 09:05:07“ statt „in Ordnung: NDI JM Titler (REGIE-PC)“
     ok/Detail/ohne/Rückruf: Text „in Ordnung: NDI JM Titler (REGIE-PC)Uhrzeit: 09:05:07“ statt „in Ordnung: NDI JM Titler (REGIE-PC)“
     … und 34 weitere
FAIL StatusBar: Uhr 09:05:07 aus jetzt(), tabular, außerhalb von role=status
FAIL StatusBar: leere Liste → Leiste mit Uhr (Zustand ohne Sitzung)
FAIL StatusBar: live-Eintrag rot gefüllt mit ■ und sichtbarem „LIVE“, Schrift und Detail in Hintergrundfarbe (Spec 3.3, 4.2; E14)
4 FEHLGESCHLAGEN
```

d) live-Eintrag ohne Fläche (wie in der ersten Fassung dieses Plans, E14 alt):
Vorher (`packages/ui/src/components/StatusBar.tsx`):
```tsx
    live ? LIVE_EINTRAG_KLASSE : 'text-[var(--foreground)]',
```
Nachher:
```tsx
    'text-[var(--foreground)]',
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL StatusBar: live-Eintrag rot gefüllt mit ■ und sichtbarem „LIVE“, Schrift und Detail in Hintergrundfarbe (Spec 3.3, 4.2; E14)
1 FEHLGESCHLAGEN
```

e) Die Uhr tickt nicht (Effekt fehlt):
Vorher (`packages/ui/src/components/StatusBar.tsx`):
```tsx
  useEffect(() => starteUhr(() => jetztRef.current(), setUhr), []);
```
Nachher: diese Zeile ersatzlos löschen.
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL StatusBar Verdrahtung: die Uhr läuft über starteUhr im Effekt (genau einmal)
1 FEHLGESCHLAGEN
```

f) Detail unter 900 px auch für Screenreader weg (`display:none`):
Vorher (`packages/ui/src/components/StatusBar.tsx`):
```tsx
              'min-w-0 max-w-[16rem] truncate select-text max-[900px]:sr-only',
```
Nachher:
```tsx
              'min-w-0 max-w-[16rem] truncate select-text max-[900px]:hidden',
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL StatusBar: Detail gekürzt, title = „{label}: {detail}“, unter 900 px max-[900px]:sr-only (vorlesbar), select-text
1 FEHLGESCHLAGEN
```

g) Die Uhr tickt in festem 1-s-Takt ab dem Einhängen (geht bis zu 1 s nach):
Vorher (`packages/ui/src/components/StatusBar.tsx`):
```tsx
    }, 1000 - jetzt().getMilliseconds());
```
Nachher:
```tsx
    }, 1000);
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL StatusBar Uhr: tickt kurz nach der vollen Sekunde (700 ms nach 09:05:07,300), meldet hh:mm:ss aus jetzt() und plant neu; Aufräumen hält den letzten Takt an
     ist: [[1000,1000],["09:05:08"],2] soll: [[700,996],["09:05:08"],2]
1 FEHLGESCHLAGEN
```

h) Hover-Fläche `--muted` (Fassung der ersten Nachbesserung):
Vorher (`packages/ui/src/components/StatusBar.tsx`):
```tsx
          'hover:underline',
```
Nachher:
```tsx
          live ? 'hover:underline' : 'hover:bg-[var(--muted)]',
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL StatusBar: Hover eines Knopfs nur als Unterstreichung, ohne Fläche (Statussymbol nie auf --muted, E14)
1 FEHLGESCHLAGEN
```

Nach jeder Probe die Ersetzung zurücknehmen; `npm run selftest -w @jm/ui` → wieder `ALLE TESTS OK`.

- [ ] **Step 11: Commit** (Commit-Text bewusst ohne Umlaute)

```bash
git add packages/ui/test/lib/markup.ts packages/ui/test/statusbar.test.tsx packages/ui/src/components/StatusPill.tsx packages/ui/src/components/StatusBar.tsx packages/ui/test/selftest.ts packages/ui/src/index.ts
git status --short
```
Erwartet genau (eine Warnung „LF will be replaced by CRLF“ ist harmlos, G11):
```
A  packages/ui/src/components/StatusBar.tsx
A  packages/ui/src/components/StatusPill.tsx
M  packages/ui/src/index.ts
A  packages/ui/test/lib/markup.ts
M  packages/ui/test/selftest.ts
A  packages/ui/test/statusbar.test.tsx
```
Dann:
```bash
git commit -m "feat(ui): StatusPill und StatusBar - Symbol und Text, feste Reihenfolge, Uhr" -m "StatusPill zeigt Zustand mit Symbol (aria-hidden), sr-only Zustandswort und Text; live ist rot gefuellt mit LIVE-Kennung und Schrift in Hintergrundfarbe, error nur umrandet. StatusBar ordnet nach Gruppen, Eintrag ist nur mit settingsSection UND onOpenSection ein Knopf (aria-label plus aria-describedby auf Zustand und Detail, Hover nur als Unterstreichung), Detail nur wenn geliefert, gekuerzt und unter 900 px nur noch fuer Screenreader, Uhr ausserhalb der role=status-Region, tickt kurz nach der vollen Sekunde. Selbsttest mit Kreuzprodukt 5 Zustaende x Detail x settingsSection x onOpenSection (40 Faelle)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Für die Galerie (Task 23) muss zu sehen sein:** Die Uhr springt im Gleichtakt mit der Systemuhr weiter (kurz nach jeder vollen Sekunde). Im 800-px-`iframe` zeigen die Einträge nur Symbol und Label; das Detail steht im Tooltip. Ein Eintrag mit Knopf reagiert auf Hover (Unterstreichung, ohne Fläche) und Fokus-Ring, ein Klick öffnet das Panel beim Abschnitt. Ein `live`-Eintrag ist rot gefüllt mit ■ und „LIVE“, die Schrift darauf dunkel (Dunkel) bzw. weiß (Hell); ein `error`-Eintrag daneben ist nur rot umrandet mit ⚠.

**Nachgerechnet** (Kopie `scratchpad\ux-plan\kopie-b`, Stand `5a14352934`; Testhilfe, Tokens, `texte.ts`, `status.ts` und eine Näherung der Quellregeln aus Block A nach Abschnitt 9 nachgebaut; tsx 4.22.4, TypeScript 5.9.3, React 18.3.1, Node 24.16): Step 4 rot mit genau der `ERR_MODULE_NOT_FOUND`-Meldung; Step 8 grün mit 19 `ok`-Zeilen dieser Aufgabe, keine React-Warnung; Typecheck grün; alle drei Mutationsproben rot wie angegeben, danach wieder grün. **Nach der Nachbesserung** (frische Kopie, Plantext Tasks 1–8 maschinell eingespielt): 22 `ok`-Zeilen dieser Aufgabe, gesamt 246, Proben a–f rot mit 1, 1, 4, 1, 1, 1 `FAIL`. Ein Probe-Bau mit `vite build` (`react()`, `tailwindcss()`, `@source "../src"`) enthielt vor der Nachbesserung `h-[var(--statusbar-h)]`, `max-[900px]:hidden` (als `@media not all and (min-width:900px)`; heute `max-[900px]:sr-only`, im Galerie-Bau von Task 23 geprüft), `select-text`, `tabular`, `sr-only`, `motion-safe:transition-colors`. **Zweite Nachbesserung:** frische Kopie, Plantext Tasks 1–8 maschinell eingespielt: Step 4 rot mit derselben `ERR_MODULE_NOT_FOUND`-Meldung, Step 8 grün mit 23 `ok`-Zeilen dieser Aufgabe (gesamt 257), Proben a–h rot mit 1, 1, 4, 1, 1, 1, 1, 1 `FAIL`, Typprüfung grün.

**Abweichungen vom Gerüst:**
1. Neue, nur testinterne Datei `packages/ui/test/lib/markup.ts` (nicht in der Dateistruktur von Abschnitt 5). Sie spart in acht Testmodulen dieselben Lesehilfen.
2. Der Statusknopf hat zusätzlich zum vorgegebenen `aria-label` „{label}: Einstellungen öffnen“ ein `aria-describedby` auf Zustandswort und Detail. Ohne das läse ein Screenreader beim Knopf nur „NDI: Einstellungen öffnen“ und nie den Zustand (G7).
3. Test-Haken als Datenattribute: `data-status-id`, `data-state` (Eintrag), `data-uhr` (Uhr).
4. Nachbesserung nach dem Review: `live` ist jetzt rot gefüllt mit sichtbarem „LIVE“ (Spec 3.3, 4.2; E14 neu, vorher nur
   umrandet), das Detail unter 900 px `sr-only` statt `hidden` (sonst für Screenreader weg), Hover `--muted` statt
   `--highlight` (E23), die Uhr über `starteUhr` (Takt getestet, Verdrahtung im Quelltext geprüft; vorher blieb eine Uhr,
   die nie tickt, grün).
5. Zweite Nachbesserung (Prüfrunde 2): Hover nur noch als Unterstreichung, ohne Fläche (auf `--muted` erreichte das ▲ von
   `--status-warn` hell 2,91 : 1, Task 4; Probe h); die Uhr plant jeden Takt an der vollen Sekunde neu (vorher fester
   1-s-Takt ab dem Einhängen, bis zu 1 s nach; Probe g). `Takt` hat dafür `setTimeout`/`clearTimeout` statt
   `setInterval`/`clearInterval`.

---

### Task 9: `TallyButton`

**Spec:** 3.4 (Zustände, 48 px, Halten-zum-Sprechen, Kürzel-Anzeige), 4.2 (Rot für „auf Sendung“ und „Fehler“ nur durch Form und Text unterschieden, Kontrast). Entscheidungen E3, E9; Review Focus 2 und 5; Regeln G3, G7, G8.

**Arbeitsverzeichnis/Voraussetzung:** Wurzel des Worktrees. Tasks 1–8 sind committet, insbesondere `src/lib/halten.ts` (Task 6, 9.4) und `LIVE_FLAECHE_KLASSE` (Task 5, 9.3).

**Dateien:**
- Create: `packages/ui/test/tally.test.tsx`
- Create: `packages/ui/src/components/TallyButton.tsx`
- Modify: `packages/ui/test/selftest.ts` (eine `import`-Zeile vor `abschluss();`)
- Modify: `packages/ui/src/index.ts` (eine Zeile am Ende)

**Interfaces:**
- Consumes: `erzeugeHalten`, `HaltenSteuerung` (9.4: `gehalten`, `druecken`, `loslassen`, `abbrechen`, `aktualisiere`); `LIVE_FLAECHE_KLASSE` (9.3); `UI_TEXTE.live`, `UI_TEXTE.kuerzel`, `UI_TEXTE.gesperrtOhneGrund` (9.2); `cn`; Lesehilfen aus Task 8.
- Produces (9.7, exakt so):
  ```ts
  // packages/ui/src/components/TallyButton.tsx — Props wörtlich Spec 3.4
  export interface TallyButtonProps {
    state: 'bereit' | 'live' | 'gesperrt';
    label: string;
    shortcut?: string;
    disabledReason?: string;
    onClick?(): void;
    onPress?(): void;
    onRelease?(): void;
  }
  export function TallyButton(p: TallyButtonProps): React.JSX.Element;
  export interface ZeigerEreignisArt { button: number; pointerId: number;
    currentTarget: { setPointerCapture?(id: number): void } | null }
  export interface TastenEreignisArt { key: string; repeat: boolean; preventDefault(): void }
  export interface TallyHandler {
    onClick(): void; onPointerDown(e: ZeigerEreignisArt): void; onPointerUp(): void; onPointerCancel(): void;
    onLostPointerCapture(): void; onKeyDown(e: TastenEreignisArt): void; onKeyUp(e: TastenEreignisArt): void; onBlur(): void;
  }
  // nur aus der Datei, nicht aus index (reine Funktionen, damit Bindung und Effekte ohne Browser prüfbar sind):
  export function tallyHandler(p: TallyButtonProps, halten: HaltenSteuerung): TallyHandler;
  export interface TallyKnopfProps extends TallyHandler { type: 'button'; 'data-state': TallyButtonProps['state'];
    'aria-disabled'?: true; 'aria-describedby'?: string; title?: string; className: string }
  export function tallyKnopfProps(p: TallyButtonProps, halten: HaltenSteuerung, grundId: string): TallyKnopfProps;
  export function tallyGrund(disabledReason: string | undefined): string;   // leer oder fehlend → „gesperrt – kein Grund angegeben“
  export function haltenFuerRender(ref: { current: HaltenSteuerung | null }, r: HaltenRueckrufe): HaltenSteuerung;
  export function haltenBeiZustand(state: TallyButtonProps['state'], halten: HaltenSteuerung): void;   // Effekt-Körper
  export function haltenBeiAbbau(halten: HaltenSteuerung): void;                                       // Aufräum-Körper
  ```
  Pflichtklassen: `min-h-[var(--control-h-lg)]`, `w-full`; `live`: `LIVE_FLAECHE_KLASSE`; `bereit`: `border-[var(--tally-ready)]`.
  Neue Zeile in `index.ts` (9.8): `export { TallyButton, type TallyButtonProps } from './components/TallyButton';`.

**Verhalten (verbindlich):**
- `bereit`: Fläche `--card` (Hover `--muted`, kein Gelb: E23), Rand `--tally-ready` (grüne Kante), Schrift 15 px extrafett in `--foreground`. `live`: Rand und Fläche `--tally-live` mit `LIVE_FLAECHE_KLASSE` (weiß, 19 px, extrafett), davor die Kennung „LIVE“; auf der LIVE-Fläche setzt nichts eine kleinere Schrift, auch das Kürzel nicht (E3: Weiß auf der dunklen LIVE-Fläche erreicht nur „große Schrift“). `gesperrt`: Fläche `--muted`, Schrift `--muted-foreground`, darunter der Grund (11 px).
- `gesperrt` = `aria-disabled="true"` (kein `disabled`, der Knopf bleibt fokussierbar), Grund sichtbar, als `title` und per `aria-describedby`; ohne `disabledReason` **oder mit leerem** `disabledReason` steht „gesperrt – kein Grund angegeben“ (E9, `tallyGrund`).
- `shortcut` als `<kbd>` mit sr-only „Kürzel: “; ohne `shortcut` kein `<kbd>`.
- `tallyHandler` (rein, testbar): Halten startet nur mit `button === 0` (linke Taste bzw. Kontakt) oder Leertaste/Enter ohne `repeat`, und nur wenn noch nicht gehalten (sonst auch kein Pointer-Capture, damit ein späteres `lostpointercapture` kein Halten per Taste beendet). `setPointerCapture` in `try/catch`. Loslassen über dieselbe Quelle; `pointercancel`, `lostpointercapture` und `blur` brechen ab. `onClick` kommt unabhängig vom Halten. Gesperrt: weder `onClick` noch Halten; Loslassen bleibt möglich. Enter mit `repeat` ruft `preventDefault()`: Ein gehaltenes Enter klickte im Browser sonst mit jeder Wiederholung erneut (E9).
- Bindung über reine Funktionen (Review Focus 2): `tallyKnopfProps` liefert **alle** Props des `<button>` (Attribute, Klassen und die acht Handler aus `tallyHandler`); der Baustein reicht sie unverändert per Spread durch und setzt keinen Handler daneben. `haltenFuerRender` erzeugt die Steuerung beim ersten Render in einer Ref und übergibt bei jedem weiteren die neuesten Rückrufe (`aktualisiere`). Die beiden Effekte rufen nur `haltenBeiZustand` (bricht ab, wenn `state` zu `gesperrt` wird) bzw. beim Abbau `haltenBeiAbbau`. Der Test prüft das Prop-Objekt, die Effekt-Körper und am Quelltext, dass genau diese vier Zeilen im Baustein stehen. Dass React die Effekte wirklich ausführt, ist ohne Browser nicht messbar: Owner-Prüfpunkt 2 unter „Nach der Umsetzung“.
- `touch-none select-none`, damit Halten auf Touch nicht in Scrollen übergeht. Der Knopf füllt die Breite seines Behälters; die Anordnung (höchstens vier) macht das Tool.

**Regeln für diese Aufgabe:** wie Task 8 (G9, G11, G3, G13).

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`packages/ui/test/tally.test.tsx`, neu)

```tsx
// Task 9 · TallyButton (Spec 3.4, 4.2; E3, E9, Review Focus 2/5): bereit/live/gesperrt mit Form und Text,
// Halten mit Zeiger und Taste – onRelease genau einmal je Druck, auch bei Abbruch. Geprüft wird das Prop-Objekt, das
// der Baustein per Spread an den <button> hängt, dazu die Effekt-Körper und die Verdrahtung im Quelltext.
import {
  TallyButton,
  haltenBeiAbbau,
  haltenBeiZustand,
  haltenFuerRender,
  tallyKnopfProps,
  type TallyButtonProps,
  type ZeigerEreignisArt,
} from '../src/components/TallyButton';
import { erzeugeHalten, type HaltenSteuerung } from '../src/lib/halten';
import { LIVE_FLAECHE_KLASSE } from '../src/lib/status';
import { UI_TEXTE } from '../src/lib/texte';
import { gleich, leseText, ok, pruefeIdVerweise, render } from './harness';
import { attr, hatKlassen, tags, text, zwischen } from './lib/markup';

/** Text des Elements mit dieser id (öffnendes Tag beginnt mit id="…"; Inhalt ohne weitere Elemente). */
const textVonId = (html: string, id: string): string =>
  text(zwischen(html, `id="${id}"`, '</span>').replace(/^[^>]*>/, ''));

// ── Darstellung ──
{
  const html = render(<TallyButton state="bereit" label="Take" />);
  const [knopf] = tags(html, 'button');
  ok(
    attr(knopf, 'data-state') === 'bereit' &&
      hatKlassen(knopf, 'border-[var(--tally-ready)] bg-[var(--card)] text-[var(--foreground)]') &&
      !html.includes(`>${UI_TEXTE.live}<`) &&
      !html.includes('bg-[var(--tally-live)]') &&
      attr(knopf, 'aria-disabled') === undefined,
    'Tally bereit: neutrale Fläche, Rand border-[var(--tally-ready)], kein „LIVE“',
  );
  ok(
    attr(knopf, 'type') === 'button' && hatKlassen(knopf, 'min-h-[var(--control-h-lg)] w-full'),
    'Tally: type=button, min-h-[var(--control-h-lg)], w-full',
  );
}
{
  const html = render(<TallyButton state="live" label="Take" shortcut="F1" />);
  const [knopf] = tags(html, 'button');
  ok(
    hatKlassen(knopf, LIVE_FLAECHE_KLASSE) && html.includes(`>${UI_TEXTE.live}<`) && text(html).includes('Take'),
    'Tally live: LIVE_FLAECHE_KLASSE, Kennung „LIVE“, Label sichtbar',
  );
  ok(
    !/text-\[\d+px\]|text-xs|text-sm/.test(html.replace(LIVE_FLAECHE_KLASSE, '')),
    'Tally live: keine kleinere Schrift auf der LIVE-Fläche (E3: nur große Schrift, auch das Kürzel)',
  );
}
{
  const html = render(
    <TallyButton state="gesperrt" label="Take" disabledReason="Kein Signal am Eingang" onClick={() => undefined} />,
  );
  const [knopf] = tags(html, 'button');
  ok(
    attr(knopf, 'aria-disabled') === 'true' &&
      attr(knopf, 'disabled') === undefined &&
      attr(knopf, 'title') === 'Kein Signal am Eingang' &&
      textVonId(html, attr(knopf, 'aria-describedby') ?? '-') === 'Kein Signal am Eingang',
    'Tally gesperrt: aria-disabled=true (bleibt fokussierbar), Grund sichtbar, title = Grund, aria-describedby zeigt auf den Grund',
  );
  pruefeIdVerweise(html, 'Tally gesperrt: alle id-Verweise gültig');
}
{
  const html = render(<TallyButton state="gesperrt" label="Take" />);
  ok(
    text(html).includes(UI_TEXTE.gesperrtOhneGrund) && attr(tags(html, 'button')[0], 'title') === UI_TEXTE.gesperrtOhneGrund,
    'Tally gesperrt ohne Grund: „gesperrt – kein Grund angegeben“',
  );
  const leer = render(<TallyButton state="gesperrt" label="Take" disabledReason="" />);
  ok(
    text(leer).includes(UI_TEXTE.gesperrtOhneGrund) && attr(tags(leer, 'button')[0], 'title') === UI_TEXTE.gesperrtOhneGrund,
    'Tally gesperrt mit leerem Grund: ebenfalls „gesperrt – kein Grund angegeben“ (gesperrt nie ohne Grund)',
  );
}
{
  const mit = render(<TallyButton state="bereit" label="Take" shortcut="F1" />);
  ok(
    tags(mit, 'kbd').length === 1 && text(zwischen(mit, '<kbd', '</kbd>').replace(/^[^>]*>/, '')) === 'Kürzel: F1',
    'Tally: shortcut als <kbd> mit sr-only „Kürzel“',
  );
  ok(tags(render(<TallyButton state="bereit" label="Take" />), 'kbd').length === 0, 'Tally: ohne shortcut kein <kbd>');
}

// ── Knopf-Props: genau die acht Handler hängen am <button> (Spread im Baustein) ──
{
  const props = tallyKnopfProps({ state: 'bereit', label: 'Talk' }, erzeugeHalten({}), 'g');
  gleich(
    Object.keys(props).filter((k) => /^on[A-Z]/.test(k)).sort(),
    ['onBlur', 'onClick', 'onKeyDown', 'onKeyUp', 'onLostPointerCapture', 'onPointerCancel', 'onPointerDown', 'onPointerUp'],
    'Tally Knopf-Props: genau die acht Ereignis-Handler',
  );
}

// ── Halten über die Knopf-Props (mit der echten Halten-Logik aus Task 6) ──
function aufbau(teil: Partial<TallyButtonProps> = {}) {
  const z = { click: 0, press: 0, release: 0 };
  const props: TallyButtonProps = {
    state: 'bereit',
    label: 'Talk',
    onClick: () => {
      z.click++;
    },
    onPress: () => {
      z.press++;
    },
    onRelease: () => {
      z.release++;
    },
    ...teil,
  };
  const halten = erzeugeHalten(props);
  return { z, halten, h: tallyKnopfProps(props, halten, 'grund') };
}
let gefangen: number[] = [];
const ziel: ZeigerEreignisArt['currentTarget'] = { setPointerCapture: (id) => void gefangen.push(id) };
const ohneCapture: ZeigerEreignisArt['currentTarget'] = {
  setPointerCapture: () => {
    throw new Error('kein Capture');
  },
};
const zeiger = (button = 0, currentTarget: ZeigerEreignisArt['currentTarget'] = ziel): ZeigerEreignisArt => ({
  button,
  pointerId: 7,
  currentTarget,
});
const taste = (key: string, repeat = false) => ({ key, repeat, preventDefault: () => undefined });

{
  const { z, h } = aufbau();
  h.onPointerDown(zeiger());
  h.onPointerUp();
  gleich([z.press, z.release], [1, 1], 'Tally Halten: Zeiger runter/hoch → onPress und onRelease je einmal');
}
{
  gefangen = [];
  const { z, h } = aufbau();
  h.onPointerDown(zeiger());
  gleich(gefangen, [7], 'Tally Halten: setPointerCapture mit der pointerId');
  h.onPointerCancel();
  h.onLostPointerCapture();
  gleich([z.press, z.release], [1, 1], 'Tally Halten: pointercancel, danach lostpointercapture → ein onRelease');
}
{
  const { z, h } = aufbau();
  h.onPointerDown(zeiger(0, ohneCapture));
  h.onPointerCancel();
  const nachCancel = z.release;
  h.onPointerUp();
  gleich(
    [z.press, nachCancel, z.release],
    [1, 1, 1],
    'Tally Halten: pointercancel allein (Capture fehlgeschlagen, kein lostpointercapture) → sofort onRelease',
  );
}
{
  const { z, h } = aufbau();
  h.onPointerDown(zeiger());
  h.onLostPointerCapture();
  const nachVerlust = z.release;
  h.onPointerUp();
  gleich(
    [z.press, nachVerlust, z.release],
    [1, 1, 1],
    'Tally Halten: lostpointercapture allein (Capture verloren, pointerup kommt nie an) → sofort onRelease',
  );
}
{
  const { z, h } = aufbau();
  h.onPointerDown(zeiger());
  h.onPointerUp();
  h.onLostPointerCapture();
  gleich([z.press, z.release], [1, 1], 'Tally Halten: pointerup und lostpointercapture nacheinander → ein onRelease');
}
{
  const { z, h } = aufbau();
  h.onKeyDown(taste(' '));
  h.onKeyDown(taste(' ', true));
  h.onKeyDown(taste(' ', true));
  const vorKeyup = [z.press, z.release];
  h.onKeyUp(taste(' '));
  gleich([...vorKeyup, z.press, z.release], [1, 0, 1, 1], 'Tally Halten: Leertaste → onPress, Auto-Repeat ignoriert, keyup → onRelease');
}
{
  const { z, h } = aufbau();
  h.onKeyDown(taste('Enter'));
  h.onKeyDown(taste('Enter', true));
  h.onKeyUp(taste('Enter'));
  gleich([z.press, z.release], [1, 1], 'Tally Halten: Enter ebenso');
}
{
  // E9: Ein gehaltenes Enter klickt im Browser mit jeder Wiederholung erneut; nur der erste Druck darf klicken.
  const { z, h } = aufbau();
  let verhindert = 0;
  const druck = (key: string, repeat: boolean) => ({ key, repeat, preventDefault: () => void verhindert++ });
  h.onKeyDown(druck('Enter', false));
  const nachErstem = verhindert;
  h.onKeyDown(druck('Enter', true));
  h.onKeyDown(druck('Enter', true));
  h.onKeyUp(druck('Enter', false));
  h.onKeyDown(druck(' ', false));
  h.onKeyDown(druck(' ', true));
  h.onKeyUp(druck(' ', false));
  gleich(
    [nachErstem, verhindert, z.press, z.release],
    [0, 2, 2, 2],
    'Tally: Enter gehalten – Auto-Repeat ruft preventDefault (kein zweiter Klick), der erste Druck nicht; die Leertaste bleibt unberührt',
  );
}
{
  const { z, h } = aufbau();
  h.onKeyDown(taste(' ', true));
  h.onKeyUp(taste(' '));
  gleich([z.press, z.release], [0, 0], 'Tally Halten: Auto-Repeat allein (Taste war schon gedrückt) startet kein Halten');
}
{
  const { z, h } = aufbau();
  h.onPointerDown(zeiger());
  h.onKeyDown(taste(' '));
  h.onPointerUp();
  h.onKeyDown(taste(' ', true));
  h.onKeyUp(taste(' '));
  gleich([z.press, z.release], [1, 1], 'Tally Halten: Zeiger los, Leertaste noch gehalten – Auto-Repeat drückt nicht neu');
}
{
  const { z, h } = aufbau();
  h.onKeyDown(taste('a'));
  h.onKeyUp(taste('a'));
  gleich([z.press, z.release], [0, 0], 'Tally Halten: andere Taste hält nicht');
}
{
  const { z, h } = aufbau();
  h.onKeyDown(taste(' '));
  h.onBlur();
  const nachBlur = z.release;
  h.onKeyUp(taste(' '));
  gleich([z.press, nachBlur, z.release], [1, 1, 1], 'Tally Halten: Fokusverlust (blur) beim Halten → sofort onRelease, späteres keyup nichts');
  const maus = aufbau();
  maus.h.onPointerDown(zeiger());
  maus.h.onBlur();
  gleich([maus.z.press, maus.z.release], [1, 1], 'Tally Halten: Alt+Tab mit gedrückter Maus (blur) → onRelease');
}
{
  const { z, h } = aufbau();
  h.onPointerDown(zeiger(2));
  h.onPointerUp();
  gleich([z.press, z.release], [0, 0], 'Tally Halten: rechte Maustaste hält nicht');
}
{
  const { z, h, halten } = aufbau();
  h.onPointerDown(zeiger(0, ohneCapture));
  const gehalten = halten.gehalten;
  h.onPointerUp();
  ok(gehalten && z.press === 1 && z.release === 1, 'Tally Halten: setPointerCapture wirft → trotzdem gehalten und losgelassen');
  const ohneZiel = aufbau();
  ohneZiel.h.onPointerDown(zeiger(0, null));
  ohneZiel.h.onPointerUp();
  gleich([ohneZiel.z.press, ohneZiel.z.release], [1, 1], 'Tally Halten: ohne currentTarget trotzdem gehalten und losgelassen');
}
{
  gefangen = [];
  const { z, h } = aufbau();
  h.onKeyDown(taste(' '));
  h.onPointerDown(zeiger());
  h.onPointerUp();
  const mitte = z.release;
  h.onKeyUp(taste(' '));
  gleich(
    [gefangen.length, z.press, mitte, z.release],
    [0, 1, 0, 1],
    'Tally Halten: mit Taste gehalten – Zeiger fängt nicht, pointerup löst nicht, keyup löst einmal',
  );
}
{
  const { z, h } = aufbau({ state: 'gesperrt', disabledReason: 'Kein Signal' });
  h.onClick();
  h.onPointerDown(zeiger());
  h.onPointerUp();
  h.onKeyDown(taste(' '));
  h.onKeyUp(taste(' '));
  gleich([z.click, z.press, z.release], [0, 0, 0], 'Tally gesperrt: weder onClick noch onPress');
}
{
  const { z, h } = aufbau();
  h.onClick();
  gleich([z.click, z.press, z.release], [1, 0, 0], 'Tally: onClick kommt unabhängig vom Halten');
  const nurKlick = aufbau({ onPress: undefined, onRelease: undefined });
  nurKlick.h.onPointerDown(zeiger());
  nurKlick.h.onPointerUp();
  nurKlick.h.onClick();
  gleich([nurKlick.z.click, nurKlick.halten.gehalten], [1, false], 'Tally: nur onClick – Zeiger hält nichts, Klick kommt');
}
{
  let losgelassen = 0;
  const props: TallyButtonProps = {
    state: 'bereit',
    label: 'Talk',
    onPress: () => {
      throw new Error('Talkback nicht erreichbar');
    },
    onRelease: () => {
      losgelassen++;
    },
  };
  const h = tallyKnopfProps(props, erzeugeHalten(props), 'grund');
  let geworfen = false;
  try {
    h.onPointerDown(zeiger());
  } catch {
    geworfen = true;
  }
  h.onPointerUp();
  h.onLostPointerCapture();
  ok(geworfen && losgelassen === 1, 'Tally Halten: onPress wirft → Fehler kommt durch, onRelease trotzdem genau einmal');
}

// ── Effekt-Körper und Neu-Rendern (die Effekte selbst laufen nur im Browser) ──
{
  const z = { press: 0, release: 0 };
  const halten = erzeugeHalten({ onPress: () => void z.press++, onRelease: () => void z.release++ });
  halten.druecken('zeiger');
  haltenBeiZustand('bereit', halten);
  haltenBeiZustand('live', halten);
  const vorSperre = z.release;
  haltenBeiZustand('gesperrt', halten);
  haltenBeiZustand('gesperrt', halten);
  gleich([vorSperre, z.release], [0, 1], 'Tally Halten: Wechsel auf gesperrt beim Halten → onRelease genau einmal; bereit und live brechen nicht ab');
}
{
  const z = { release: 0 };
  const halten = erzeugeHalten({ onRelease: () => void z.release++ });
  halten.druecken('taste');
  haltenBeiAbbau(halten);
  haltenBeiAbbau(halten);
  gleich(z.release, 1, 'Tally Halten: Abbau beim Halten → onRelease genau einmal');
}
{
  const alt = { release: 0 };
  const neu = { release: 0 };
  const ref: { current: HaltenSteuerung | null } = { current: null };
  const erste = haltenFuerRender(ref, { onPress: () => undefined, onRelease: () => void alt.release++ });
  erste.druecken('zeiger');
  const zweite = haltenFuerRender(ref, { onPress: () => undefined, onRelease: () => void neu.release++ });
  zweite.loslassen('zeiger');
  ok(erste === zweite && alt.release === 0 && neu.release === 1, 'Tally Halten: neue Rückrufe nach erneutem Rendern – Loslassen ruft das neueste onRelease');
}

// ── Verdrahtung im Quelltext: Spread, beide Effekte, haltenFuerRender, kein Handler daneben ──
{
  const quelle = leseText('src/components/TallyButton.tsx');
  const baustein = quelle.slice(quelle.indexOf('export function TallyButton('));
  const PFLICHT = [
    'const haltenRef = useRef<HaltenSteuerung | null>(null);',
    'const halten = haltenFuerRender(haltenRef, p);',
    'useEffect(() => haltenBeiZustand(state, halten), [state, halten]);',
    'useEffect(() => () => haltenBeiAbbau(halten), [halten]);',
    '<button {...tallyKnopfProps(p, halten, grundId)}>',
  ];
  const fehlt = PFLICHT.filter((zeile) => baustein.split(zeile).length !== 2);
  const handlerDaneben = baustein.match(/\son[A-Z]\w*=\{/g) ?? [];
  ok(
    fehlt.length === 0 && handlerDaneben.length === 0,
    'Tally Verdrahtung: Knopf-Props per Spread, Effekte für gesperrt und Abbau, neueste Rückrufe – je genau einmal im Baustein',
  );
  for (const zeile of fehlt) console.log(`     fehlt: ${zeile}`);
  for (const zeile of handlerDaneben) console.log(`     Handler neben dem Spread: ${zeile.trim()}`);
}
```
Hinweis zum Blur-Fall: Der Test liest den Zähler **direkt nach** `onBlur` (`nachBlur`). Ein späteres `keyup` würde sonst denselben Endstand liefern und einen leeren `onBlur` verdecken (in der Kopie gemessen: mit `keyup` vor dem Ablesen blieb die Probe 9a grün).

- [ ] **Step 2: Testmodul einhängen** (`packages/ui/test/selftest.ts`)

Vorher:
```ts
abschluss();
```
Nachher:
```ts
import './tally.test';
abschluss();
```

- [ ] **Step 3: Test laufen lassen (rot)**

Run: `npm run selftest -w @jm/ui`
Expected: Exit-Code 1, kein Test läuft:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\packages\ui\src\components\TallyButton' imported from …\packages\ui\test\tally.test.tsx
```

- [ ] **Step 4: `TallyButton` anlegen** (`packages/ui/src/components/TallyButton.tsx`, neu)

```tsx
import { useEffect, useId, useRef } from 'react';
import { cn } from '../lib/cn';
import { erzeugeHalten, type HaltenRueckrufe, type HaltenSteuerung } from '../lib/halten';
import { LIVE_FLAECHE_KLASSE } from '../lib/status';
import { UI_TEXTE } from '../lib/texte';

/** Props wörtlich aus Spec 3.4. */
export interface TallyButtonProps {
  state: 'bereit' | 'live' | 'gesperrt';
  label: string;
  /** Nur Anzeige eines vorhandenen Kürzels (z. B. „F1“); das Kürzel selbst bleibt im Tool. */
  shortcut?: string;
  /** Pflicht bei 'gesperrt': sichtbar, als title und per aria-describedby. */
  disabledReason?: string;
  onClick?(): void;
  onPress?(): void;
  onRelease?(): void;
}

/** Das, was tallyHandler von einem Zeiger-Ereignis braucht (React.PointerEvent passt). */
export interface ZeigerEreignisArt {
  button: number;
  pointerId: number;
  currentTarget: { setPointerCapture?(id: number): void } | null;
}
/** Das, was tallyHandler von einem Tasten-Ereignis braucht (React.KeyboardEvent passt). */
export interface TastenEreignisArt {
  key: string;
  repeat: boolean;
  preventDefault(): void;
}
export interface TallyHandler {
  onClick(): void;
  onPointerDown(e: ZeigerEreignisArt): void;
  onPointerUp(): void;
  onPointerCancel(): void;
  onLostPointerCapture(): void;
  onKeyDown(e: TastenEreignisArt): void;
  onKeyUp(e: TastenEreignisArt): void;
  onBlur(): void;
}
/** Alles, was der <button> bekommt: Attribute, Klassen und die acht Handler aus tallyHandler. */
export interface TallyKnopfProps extends TallyHandler {
  type: 'button';
  'data-state': TallyButtonProps['state'];
  'aria-disabled'?: true;
  'aria-describedby'?: string;
  title?: string;
  className: string;
}

const HALTE_TASTEN = new Set([' ', 'Enter']);

/**
 * Die Ereignis-Verdrahtung des TallyButton als reine Funktion (E9), damit sie ohne Browser testbar ist.
 * - Halten nur mit der linken Taste bzw. Kontakt (button 0) oder Leertaste/Enter ohne Auto-Repeat.
 * - Loslassen über dieselbe Quelle; pointercancel, lostpointercapture und blur brechen ab (onRelease genau einmal).
 * - Gesperrt: nichts startet, nichts klickt; Loslassen bleibt möglich.
 * Nur aus dieser Datei exportiert, nicht aus index.ts.
 */
export function tallyHandler(p: TallyButtonProps, halten: HaltenSteuerung): TallyHandler {
  const gesperrt = p.state === 'gesperrt';
  return {
    onClick() {
      if (!gesperrt) p.onClick?.();
    },
    onPointerDown(e) {
      if (gesperrt || e.button !== 0 || halten.gehalten) return;
      try {
        e.currentTarget?.setPointerCapture?.(e.pointerId);
      } catch {
        // Capture ist optional; ohne sie beendet spätestens blur oder pointercancel das Halten.
      }
      halten.druecken('zeiger');
    },
    onPointerUp() {
      halten.loslassen('zeiger');
    },
    onPointerCancel() {
      halten.abbrechen();
    },
    onLostPointerCapture() {
      halten.abbrechen();
    },
    onKeyDown(e) {
      // Ein gehaltenes Enter klickt im Browser mit jeder Wiederholung erneut (mehrfaches Take); nur der erste Druck zählt.
      if (e.key === 'Enter' && e.repeat) e.preventDefault();
      if (gesperrt || e.repeat || !HALTE_TASTEN.has(e.key)) return;
      halten.druecken('taste');
    },
    onKeyUp(e) {
      if (HALTE_TASTEN.has(e.key)) halten.loslassen('taste');
    },
    onBlur() {
      halten.abbrechen();
    },
  };
}

/** Sichtbarer Sperrgrund: fehlt er oder ist er leer, steht „gesperrt – kein Grund angegeben“ (E9). Nur aus dieser Datei. */
export function tallyGrund(disabledReason: string | undefined): string {
  return disabledReason || UI_TEXTE.gesperrtOhneGrund;
}

const BASIS =
  'flex w-full min-h-[var(--control-h-lg)] flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border-2 ' +
  'px-4 py-2 text-center select-none touch-none ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] ' +
  'motion-safe:transition-colors motion-safe:duration-150';

const FLAECHE: Record<TallyButtonProps['state'], string> = {
  bereit:
    'border-[var(--tally-ready)] bg-[var(--card)] text-[15px] font-extrabold text-[var(--foreground)] hover:bg-[var(--muted)]',
  // E3: Weiß auf der LIVE-Fläche ist nur „große Schrift“ – deshalb trägt die ganze Fläche LIVE_FLAECHE_KLASSE
  // (19 px, extrafett), und nichts darin setzt eine kleinere Schrift.
  live: cn('border-[var(--tally-live)]', LIVE_FLAECHE_KLASSE),
  gesperrt:
    'cursor-not-allowed border-[var(--border)] bg-[var(--muted)] text-[15px] font-extrabold text-[var(--muted-foreground)]',
};

const KUERZEL: Record<TallyButtonProps['state'], string> = {
  bereit: 'rounded-[var(--radius-sm)] border border-[var(--border)] px-1 font-sans text-[11px] font-semibold text-[var(--muted-foreground)]',
  live: 'rounded-[var(--radius-sm)] border border-current px-1 font-sans',
  gesperrt: 'rounded-[var(--radius-sm)] border border-[var(--border)] px-1 font-sans text-[11px] font-semibold text-[var(--muted-foreground)]',
};

/**
 * Alle Props des <button> als reine Funktion (E9): type, data-state, Sperre (aria-disabled, title, aria-describedby),
 * Klassen und die Handler aus tallyHandler. Der Baustein reicht sie unverändert per Spread durch, damit der Test genau
 * das prüft, was am Knopf hängt. Nur aus dieser Datei exportiert.
 */
export function tallyKnopfProps(p: TallyButtonProps, halten: HaltenSteuerung, grundId: string): TallyKnopfProps {
  const gesperrt = p.state === 'gesperrt';
  return {
    type: 'button',
    'data-state': p.state,
    'aria-disabled': gesperrt ? true : undefined,
    'aria-describedby': gesperrt ? grundId : undefined,
    title: gesperrt ? tallyGrund(p.disabledReason) : undefined,
    className: cn(BASIS, FLAECHE[p.state]),
    ...tallyHandler(p, halten),
  };
}

/**
 * Halten-Steuerung je Knopf: beim ersten Render erzeugt, bei jedem weiteren mit den neuesten Rückrufen aktualisiert
 * (ein Loslassen nach einem Neu-Rendern ruft das aktuelle onRelease). Nur aus dieser Datei exportiert.
 */
export function haltenFuerRender(ref: { current: HaltenSteuerung | null }, r: HaltenRueckrufe): HaltenSteuerung {
  if (ref.current === null) {
    ref.current = erzeugeHalten({ onPress: r.onPress, onRelease: r.onRelease });
  } else {
    ref.current.aktualisiere({ onPress: r.onPress, onRelease: r.onRelease });
  }
  return ref.current;
}

/** Körper des Effekts „Zustand gewechselt“: Wird der Knopf beim Halten gesperrt, endet das Halten (onRelease einmal). */
export function haltenBeiZustand(state: TallyButtonProps['state'], halten: HaltenSteuerung): void {
  if (state === 'gesperrt') halten.abbrechen();
}

/** Körper des Aufräumens beim Abbau: ein laufendes Halten endet (onRelease einmal). */
export function haltenBeiAbbau(halten: HaltenSteuerung): void {
  halten.abbrechen();
}

/**
 * Großer Sende-Knopf (Spec 3.4): `bereit` neutral mit grüner Kante, `live` rot gefüllt mit „LIVE“-Kennung, `gesperrt`
 * gedimmt mit sichtbarem Grund. Halten-zum-Sprechen über onPress/onRelease; onRelease kommt in jedem Fall genau einmal,
 * auch beim Wechsel auf `gesperrt` und beim Unmount. Füllt die Breite seines Behälters; die Anordnung macht das Tool.
 * Die Verdrahtung (Spread, zwei Effekte, haltenFuerRender) prüft tally.test.tsx am Quelltext dieser Datei.
 */
export function TallyButton(p: TallyButtonProps): React.JSX.Element {
  const { state, label, shortcut } = p;
  const haltenRef = useRef<HaltenSteuerung | null>(null);
  const halten = haltenFuerRender(haltenRef, p);
  useEffect(() => haltenBeiZustand(state, halten), [state, halten]);
  useEffect(() => () => haltenBeiAbbau(halten), [halten]);
  const grundId = useId();

  return (
    <button {...tallyKnopfProps(p, halten, grundId)}>
      <span className="inline-flex items-center gap-2">
        {state === 'live' ? (
          <span className="rounded-[var(--radius-sm)] border-2 border-current px-1.5 py-0.5 tracking-[0.08em]">
            {UI_TEXTE.live}
          </span>
        ) : null}
        <span>{label}</span>
        {shortcut ? (
          <kbd className={KUERZEL[state]}>
            <span className="sr-only">{UI_TEXTE.kuerzel}: </span>
            {shortcut}
          </kbd>
        ) : null}
      </span>
      {state === 'gesperrt' ? (
        <span id={grundId} className="text-[11px] font-semibold text-[var(--muted-foreground)]">
          {tallyGrund(p.disabledReason)}
        </span>
      ) : null}
    </button>
  );
}
```

- [ ] **Step 5: Export anhängen** (`packages/ui/src/index.ts`, Dateiende)

Vorher:
```ts
export { StatusBar } from './components/StatusBar';
```
Nachher:
```ts
export { StatusBar } from './components/StatusBar';
export { TallyButton, type TallyButtonProps } from './components/TallyButton';
```

- [ ] **Step 6: Test laufen lassen (grün)**

Run: `npm run selftest -w @jm/ui`
Expected: keine Zeile mit `FAIL`, letzte Zeile `ALLE TESTS OK`, Exit-Code 0. Die Zeilen dieser Aufgabe:
```
ok   Tally bereit: neutrale Fläche, Rand border-[var(--tally-ready)], kein „LIVE“
ok   Tally: type=button, min-h-[var(--control-h-lg)], w-full
ok   Tally live: LIVE_FLAECHE_KLASSE, Kennung „LIVE“, Label sichtbar
ok   Tally live: keine kleinere Schrift auf der LIVE-Fläche (E3: nur große Schrift, auch das Kürzel)
ok   Tally gesperrt: aria-disabled=true (bleibt fokussierbar), Grund sichtbar, title = Grund, aria-describedby zeigt auf den Grund
ok   Tally gesperrt: alle id-Verweise gültig
ok   Tally gesperrt ohne Grund: „gesperrt – kein Grund angegeben“
ok   Tally gesperrt mit leerem Grund: ebenfalls „gesperrt – kein Grund angegeben“ (gesperrt nie ohne Grund)
ok   Tally: shortcut als <kbd> mit sr-only „Kürzel“
ok   Tally: ohne shortcut kein <kbd>
ok   Tally Knopf-Props: genau die acht Ereignis-Handler
ok   Tally Halten: Zeiger runter/hoch → onPress und onRelease je einmal
ok   Tally Halten: setPointerCapture mit der pointerId
ok   Tally Halten: pointercancel, danach lostpointercapture → ein onRelease
ok   Tally Halten: pointercancel allein (Capture fehlgeschlagen, kein lostpointercapture) → sofort onRelease
ok   Tally Halten: lostpointercapture allein (Capture verloren, pointerup kommt nie an) → sofort onRelease
ok   Tally Halten: pointerup und lostpointercapture nacheinander → ein onRelease
ok   Tally Halten: Leertaste → onPress, Auto-Repeat ignoriert, keyup → onRelease
ok   Tally Halten: Enter ebenso
ok   Tally: Enter gehalten – Auto-Repeat ruft preventDefault (kein zweiter Klick), der erste Druck nicht; die Leertaste bleibt unberührt
ok   Tally Halten: Auto-Repeat allein (Taste war schon gedrückt) startet kein Halten
ok   Tally Halten: Zeiger los, Leertaste noch gehalten – Auto-Repeat drückt nicht neu
ok   Tally Halten: andere Taste hält nicht
ok   Tally Halten: Fokusverlust (blur) beim Halten → sofort onRelease, späteres keyup nichts
ok   Tally Halten: Alt+Tab mit gedrückter Maus (blur) → onRelease
ok   Tally Halten: rechte Maustaste hält nicht
ok   Tally Halten: setPointerCapture wirft → trotzdem gehalten und losgelassen
ok   Tally Halten: ohne currentTarget trotzdem gehalten und losgelassen
ok   Tally Halten: mit Taste gehalten – Zeiger fängt nicht, pointerup löst nicht, keyup löst einmal
ok   Tally gesperrt: weder onClick noch onPress
ok   Tally: onClick kommt unabhängig vom Halten
ok   Tally: nur onClick – Zeiger hält nichts, Klick kommt
ok   Tally Halten: onPress wirft → Fehler kommt durch, onRelease trotzdem genau einmal
ok   Tally Halten: Wechsel auf gesperrt beim Halten → onRelease genau einmal; bereit und live brechen nicht ab
ok   Tally Halten: Abbau beim Halten → onRelease genau einmal
ok   Tally Halten: neue Rückrufe nach erneutem Rendern – Loslassen ruft das neueste onRelease
ok   Tally Verdrahtung: Knopf-Props per Spread, Effekte für gesperrt und Abbau, neueste Rückrufe – je genau einmal im Baustein
```
Zählen: `npm run selftest -w @jm/ui | grep -cE "^ok   Tally"` → `37`. Gesamt nach dieser Aufgabe (gemessen): `294` `ok`-Zeilen.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck -w @jm/ui`
Expected: keine Ausgabe von `tsc`, Exit-Code 0. (Der Spread `{...tallyKnopfProps(…)}` passt auf `<button>`, weil `React.PointerEvent`/`React.KeyboardEvent` die schmalen Ereignis-Typen erfüllen.)

- [ ] **Step 8: Mutationsprobe (ohne Commit; je eine Änderung allein, danach zurück)**

a) Fokusverlust bricht nicht ab (hängender Talkback nach Alt+Tab):
Vorher (`packages/ui/src/components/TallyButton.tsx`):
```tsx
    onBlur() {
      halten.abbrechen();
    },
```
Nachher:
```tsx
    onBlur() {},
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Tally Halten: Fokusverlust (blur) beim Halten → sofort onRelease, späteres keyup nichts
     ist: [1,0,1] soll: [1,1,1]
FAIL Tally Halten: Alt+Tab mit gedrückter Maus (blur) → onRelease
     ist: [1,0] soll: [1,1]
2 FEHLGESCHLAGEN
```

b) Auto-Repeat nicht geprüft:
Vorher (`packages/ui/src/components/TallyButton.tsx`):
```tsx
if (gesperrt || e.repeat || !HALTE_TASTEN.has(e.key)) return;
```
Nachher:
```tsx
if (gesperrt || !HALTE_TASTEN.has(e.key)) return;
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Tally Halten: Auto-Repeat allein (Taste war schon gedrückt) startet kein Halten
     ist: [1,1] soll: [0,0]
FAIL Tally Halten: Zeiger los, Leertaste noch gehalten – Auto-Repeat drückt nicht neu
     ist: [2,2] soll: [1,1]
2 FEHLGESCHLAGEN
```

c) LIVE-Fläche ohne große Schrift (E3):
Vorher (`packages/ui/src/components/TallyButton.tsx`):
```tsx
  live: cn('border-[var(--tally-live)]', LIVE_FLAECHE_KLASSE),
```
Nachher:
```tsx
  live: 'border-[var(--tally-live)] bg-[var(--tally-live)] text-[var(--brand-fg-on-dark)] leading-none font-extrabold',
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Tally live: LIVE_FLAECHE_KLASSE, Kennung „LIVE“, Label sichtbar
1 FEHLGESCHLAGEN
```

d) Zeiger fängt auch, wenn schon per Taste gehalten wird:
Vorher (`packages/ui/src/components/TallyButton.tsx`):
```tsx
if (gesperrt || e.button !== 0 || halten.gehalten) return;
```
Nachher:
```tsx
if (gesperrt || e.button !== 0) return;
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Tally Halten: mit Taste gehalten – Zeiger fängt nicht, pointerup löst nicht, keyup löst einmal
     ist: [1,1,0,1] soll: [0,1,0,1]
1 FEHLGESCHLAGEN
```

e) `pointercancel` bricht nicht ab (Capture fehlgeschlagen, kein `lostpointercapture` – hängender Talkback):
Vorher (`packages/ui/src/components/TallyButton.tsx`):
```tsx
    onPointerCancel() {
      halten.abbrechen();
    },
```
Nachher:
```tsx
    onPointerCancel() {},
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Tally Halten: pointercancel allein (Capture fehlgeschlagen, kein lostpointercapture) → sofort onRelease
     ist: [1,0,1] soll: [1,1,1]
1 FEHLGESCHLAGEN
```

f) `lostpointercapture` bricht nicht ab:
Vorher (`packages/ui/src/components/TallyButton.tsx`):
```tsx
    onLostPointerCapture() {
      halten.abbrechen();
    },
```
Nachher:
```tsx
    onLostPointerCapture() {},
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Tally Halten: lostpointercapture allein (Capture verloren, pointerup kommt nie an) → sofort onRelease
     ist: [1,0,1] soll: [1,1,1]
1 FEHLGESCHLAGEN
```

g) Knopf ohne die Knopf-Props (Handler von Hand, wie in der ersten Fassung dieses Plans):
Vorher (`packages/ui/src/components/TallyButton.tsx`):
```tsx
    <button {...tallyKnopfProps(p, halten, grundId)}>
```
Nachher:
```tsx
    <button type="button" data-state={state} onClick={() => p.onClick?.()}>
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Tally bereit: neutrale Fläche, Rand border-[var(--tally-ready)], kein „LIVE“
FAIL Tally: type=button, min-h-[var(--control-h-lg)], w-full
FAIL Tally live: LIVE_FLAECHE_KLASSE, Kennung „LIVE“, Label sichtbar
FAIL Tally gesperrt: aria-disabled=true (bleibt fokussierbar), Grund sichtbar, title = Grund, aria-describedby zeigt auf den Grund
FAIL Tally gesperrt ohne Grund: „gesperrt – kein Grund angegeben“
FAIL Tally gesperrt mit leerem Grund: ebenfalls „gesperrt – kein Grund angegeben“ (gesperrt nie ohne Grund)
FAIL Tally Verdrahtung: Knopf-Props per Spread, Effekte für gesperrt und Abbau, neueste Rückrufe – je genau einmal im Baustein
     fehlt: <button {...tallyKnopfProps(p, halten, grundId)}>
     Handler neben dem Spread: onClick={
7 FEHLGESCHLAGEN
```

h) Kein Abbruch beim Wechsel auf `gesperrt` (Effekt fehlt):
Vorher (`packages/ui/src/components/TallyButton.tsx`):
```tsx
  useEffect(() => haltenBeiZustand(state, halten), [state, halten]);
```
Nachher: diese Zeile ersatzlos löschen.
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Tally Verdrahtung: Knopf-Props per Spread, Effekte für gesperrt und Abbau, neueste Rückrufe – je genau einmal im Baustein
     fehlt: useEffect(() => haltenBeiZustand(state, halten), [state, halten]);
1 FEHLGESCHLAGEN
```

i) Kein Abbruch beim Abbau (Unmount während des Haltens):
Vorher (`packages/ui/src/components/TallyButton.tsx`):
```tsx
  useEffect(() => () => haltenBeiAbbau(halten), [halten]);
```
Nachher: diese Zeile ersatzlos löschen.
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Tally Verdrahtung: Knopf-Props per Spread, Effekte für gesperrt und Abbau, neueste Rückrufe – je genau einmal im Baustein
     fehlt: useEffect(() => () => haltenBeiAbbau(halten), [halten]);
1 FEHLGESCHLAGEN
```

j) Alte Rückrufe nach einem Neu-Rendern (`aktualisiere` fehlt):
Vorher (`packages/ui/src/components/TallyButton.tsx`):
```tsx
  } else {
    ref.current.aktualisiere({ onPress: r.onPress, onRelease: r.onRelease });
  }
```
Nachher:
```tsx
  }
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Tally Halten: neue Rückrufe nach erneutem Rendern – Loslassen ruft das neueste onRelease
1 FEHLGESCHLAGEN
```

k) Effekt-Körper bricht beim Sperren nicht ab:
Vorher (`packages/ui/src/components/TallyButton.tsx`):
```tsx
  if (state === 'gesperrt') halten.abbrechen();
```
Nachher:
```tsx
  if (state === 'gesperrt') return;
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Tally Halten: Wechsel auf gesperrt beim Halten → onRelease genau einmal; bereit und live brechen nicht ab
     ist: [0,0] soll: [0,1]
1 FEHLGESCHLAGEN
```

l) Leerer Sperrgrund gilt als Grund:
Vorher (`packages/ui/src/components/TallyButton.tsx`):
```tsx
  return disabledReason || UI_TEXTE.gesperrtOhneGrund;
```
Nachher:
```tsx
  return disabledReason ?? UI_TEXTE.gesperrtOhneGrund;
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Tally gesperrt mit leerem Grund: ebenfalls „gesperrt – kein Grund angegeben“ (gesperrt nie ohne Grund)
1 FEHLGESCHLAGEN
```

m) Gehaltenes Enter klickt mehrfach (Auto-Repeat ohne `preventDefault`):
Vorher (`packages/ui/src/components/TallyButton.tsx`):
```tsx
      if (e.key === 'Enter' && e.repeat) e.preventDefault();
```
Nachher: diese Zeile ersatzlos löschen.
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Tally: Enter gehalten – Auto-Repeat ruft preventDefault (kein zweiter Klick), der erste Druck nicht; die Leertaste bleibt unberührt
     ist: [0,0,2,2] soll: [0,2,2,2]
1 FEHLGESCHLAGEN
```

n) Halten-Steuerung ohne `useRef` (bei jedem Render eine neue; das Aufräumen des alten Effekts beendete ein laufendes Halten
beim ersten Neu-Rendern):
Vorher (`packages/ui/src/components/TallyButton.tsx`):
```tsx
  const haltenRef = useRef<HaltenSteuerung | null>(null);
```
Nachher:
```tsx
  const haltenRef: { current: HaltenSteuerung | null } = { current: null };
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Tally Verdrahtung: Knopf-Props per Spread, Effekte für gesperrt und Abbau, neueste Rückrufe – je genau einmal im Baustein
     fehlt: const haltenRef = useRef<HaltenSteuerung | null>(null);
1 FEHLGESCHLAGEN
```
Die Verdrahtung wird am Quelltext geprüft, also am Wortlaut, nicht an der Wirkung (unter `renderToStaticMarkup` laufen keine
Effekte). Wirkung prüft der Owner (Owner-Prüfpunkt 2).

Nach jeder Probe die Ersetzung zurücknehmen; `npm run selftest -w @jm/ui` → wieder `ALLE TESTS OK`.

- [ ] **Step 9: Commit** (Commit-Text bewusst ohne Umlaute)

```bash
git add packages/ui/test/tally.test.tsx packages/ui/src/components/TallyButton.tsx packages/ui/test/selftest.ts packages/ui/src/index.ts
git status --short
```
Erwartet genau:
```
A  packages/ui/src/components/TallyButton.tsx
M  packages/ui/src/index.ts
M  packages/ui/test/selftest.ts
A  packages/ui/test/tally.test.tsx
```
Dann:
```bash
git commit -m "feat(ui): TallyButton - bereit/live/gesperrt, Halten mit Zeiger und Taste" -m "bereit mit gruener Kante, live rot gefuellt mit LIVE-Kennung in grosser Schrift (LIVE_FLAECHE_KLASSE, auch das Kuerzel), gesperrt mit aria-disabled und sichtbarem Grund. tallyHandler als reine Funktion: Halten nur mit linker Taste oder Leertaste/Enter ohne Auto-Repeat, pointercancel, lostpointercapture und blur brechen ab, onRelease genau einmal je Druck; ein gehaltenes Enter klickt nur einmal. tallyKnopfProps liefert alle Props des Knopfs (Spread), die Effekte rufen nur haltenBeiZustand und haltenBeiAbbau; der Test prueft Prop-Objekt, Effekt-Koerper und die Verdrahtung im Quelltext." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Für die Galerie (Task 23) muss zu sehen sein:** Ein `TallyButton` mit den Zählern „gedrückt“/„losgelassen“ (je `onPress`/`onRelease` +1). Drücken und Halten mit Maus, Leertaste und Enter erhöht „gedrückt“ genau um 1, Loslassen „losgelassen“ genau um 1; langes Halten der Leertaste (Auto-Repeat) zählt nicht mehrfach. Maus gedrückt aus dem Fenster ziehen und dort loslassen, Alt+Tab während des Haltens, Zustand während des Haltens auf `gesperrt` schalten (Knopf „in 2 s sperren (dabei halten)“) und den Knopf während des Haltens ausblenden (Knopf „in 2 s ausblenden (dabei halten)“, danach „wieder einblenden“; Unmount) → jeweils „losgelassen“ +1, danach sind beide Zähler gleich. Rechte Maustaste zählt nicht. Enter lange halten erhöht „Klicks“ genau um 1. Dazu die drei Zustände nebeneinander, `live` mit Kürzel.

**Nachgerechnet** (Kopie wie in Task 8, `halten.ts` nach Task 6 nachgebaut): Step 3 rot wie angegeben; Typecheck grün; vier Mutationsproben rot wie angegeben, danach wieder grün. Im Probe-Bau vorhanden: `min-h-[var(--control-h-lg)]`, `bg-[var(--tally-live)]`, `border-[var(--tally-ready)]`, `text-[19px]`, `touch-none`, `border-current`. **Nachbesserung nach dem Review** (frische Kopie, Plantext Task 1–9 maschinell eingespielt): Step 6 grün mit 36 `ok`-Zeilen dieser Aufgabe (gesamt 282), Proben a–l rot mit 2, 2, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1 `FAIL`. Vorher hatte der Test nur `tallyHandler` als Objekt geprüft; gemessen blieben ein leeres `onPointerCancel`/`onLostPointerCapture`, fehlende Handler im JSX, ein gelöschter Abbruch-Effekt und ein gelöschtes `aktualisiere` jeweils grün. **Zweite Nachbesserung:** frische Kopie, Plantext Tasks 1–9: 37 `ok`-Zeilen dieser Aufgabe (gesamt 294), Proben a–n rot mit 2, 2, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1 `FAIL`, Typprüfung grün.

**Abweichungen vom Gerüst:**
1. `onPointerDown` tut nichts, solange schon gehalten wird (auch kein Pointer-Capture). Grund: Hält jemand per Leertaste und klickt zusätzlich, beendete das spätere `lostpointercapture` sonst das Halten per Taste vorzeitig (Probe 9d).
2. Zusätzliche Testfälle über die Gliederung hinaus: Auto-Repeat ohne vorheriges Drücken, Auto-Repeat nach dem Loslassen des Zeigers, Alt+Tab mit gedrückter Maus, ohne `currentTarget`, `onPress` wirft, `pointercancel` allein und `lostpointercapture` allein, leerer Sperrgrund.
3. Zusätzliche Exporte nur aus der Datei: `tallyKnopfProps`, `TallyKnopfProps`, `tallyGrund`, `haltenFuerRender`, `haltenBeiZustand`, `haltenBeiAbbau`. Grund: Bindung und Effekte sollen ohne Browser prüfbar sein (Review-Befund „Halten-Abdeckung nur über tallyHandler“). Die Effekte selbst bleiben ein Owner-Prüfpunkt.
4. Zweite Nachbesserung (Prüfrunde 2): `TastenEreignisArt` hat `preventDefault()`, `onKeyDown` ruft es bei Enter mit `repeat` (vorher klickte ein gehaltenes Enter auf einem „Take“ mehrfach; Probe m). Die Pflichtzeilen der Verdrahtung enthalten jetzt auch `useRef` für die Halten-Steuerung (vorher blieb `{ current: null }` grün; Probe n).

---

### Task 10: `Field`, `TextInput`, `NumberInput`

**Spec:** 3.5 (Field mit Beschriftung, Hilfe-, Fehler-, Sperrgrundtext; 32 px; `aria-invalid`/`aria-describedby`), 3.8. Entscheidungen E8 (Escape im Zahlenfeld), E12, E13; Regeln G3, G4, G5, G7.

**Arbeitsverzeichnis/Voraussetzung:** Wurzel des Worktrees. Tasks 1–9 sind committet, insbesondere `src/lib/eingabe.ts` (Task 7, 9.6).

**Dateien:**
- Create: `packages/ui/test/field.test.tsx`
- Create: `packages/ui/src/components/Field.tsx`
- Create: `packages/ui/src/components/TextInput.tsx`
- Create: `packages/ui/src/components/NumberInput.tsx`
- Modify: `packages/ui/test/selftest.ts` (eine `import`-Zeile vor `abschluss();`)
- Modify: `packages/ui/src/index.ts` (drei Zeilen am Ende)

**Interfaces:**
- Consumes: `feldIds`, `beschreibtDurch`, `FeldIds`, `zahlEntwurfAus`, `zahlSchritt`, `ZahlEntwurf`, `ZahlEreignis`, `ZahlRegeln` (9.6); `UI_TEXTE.gesperrt` (9.2); `STATUS_SYMBOL`, `STATUS_SYMBOL_KLASSE` (9.3); `cn`.
- Produces (9.7, exakt so; Block C nutzt `Field`, `useFeld`, `TextInput`, `NumberInput`):
  ```ts
  // packages/ui/src/components/Field.tsx
  export interface FieldProps { label: string; hint?: string; error?: string; lockedReason?: string; id?: string;
    className?: string; children: ReactNode }
  export function Field(p: FieldProps): React.JSX.Element;
  export interface FeldKontext { ids: FeldIds; describedBy?: string; invalid: boolean; gesperrt: boolean }
  export function useFeld(): FeldKontext | null;
  // packages/ui/src/components/TextInput.tsx
  export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'size'> {
    value: string; onChange(value: string): void }
  export function TextInput(p: TextInputProps): React.JSX.Element;      // Pflichtklassen h-[var(--control-h)], select-text
  // packages/ui/src/components/NumberInput.tsx
  export interface NumberInputProps { value: number | null; onChange(value: number): void; min?: number; max?: number;
    ganzzahl?: boolean; unit?: string; placeholder?: string; disabled?: boolean; id?: string; className?: string;
    'aria-label'?: string }
  export function NumberInput(p: NumberInputProps): React.JSX.Element;  // Pflichtklassen h-[var(--control-h)], tabular
  ```
  Nur aus der jeweiligen Datei (nicht aus `index.ts`), für die Bausteine dieses Blocks und die Tests:
  ```ts
  // Field.tsx
  export const EINGABE_KLASSE: string;                                       // gemeinsame Klassen aller einzeiligen Eingaben
  export function verbindeIds(...ids: Array<string | undefined>): string | undefined;
  // NumberInput.tsx
  export function zahlTaste(e: { key: string; stopPropagation(): void; preventDefault(): void },
    schritt: (ereignis: ZahlEreignis) => { verbraucht: boolean }): void;     // Enter übernimmt, Escape verwirft (E8)
  export interface NumberInputAnsichtProps extends Omit<NumberInputProps, 'value' | 'onChange' | 'min' | 'max'> {
    entwurf: ZahlEntwurf; onTippen(text: string): void; onUebernehmen(): void;
    onTaste(e: { key: string; stopPropagation(): void; preventDefault(): void }): void }
  export function NumberInputAnsicht(p: NumberInputAnsichtProps): React.JSX.Element;   // reine Darstellung eines Entwurfs
  export function zahlFeldHandler(p: Pick<NumberInputAnsichtProps, 'onTippen' | 'onUebernehmen' | 'onTaste'>): {
    onChange(e: { currentTarget: { value: string } }): void; onBlur(): void;
    onKeyDown(e: { key: string; stopPropagation(): void; preventDefault(): void }): void };   // Handler des <input>
  export function zahlAnsichtHandler(schritt: (e: ZahlEreignis) => { verbraucht: boolean }):
    Pick<NumberInputAnsichtProps, 'onTippen' | 'onUebernehmen' | 'onTaste'>;                  // jedes Ereignis als zahlSchritt
  ```
  Neue Zeilen in `index.ts` (9.8): `export { Field, useFeld } from './components/Field';`, `export { TextInput } from './components/TextInput';`, `export { NumberInput } from './components/NumberInput';`.

**Verhalten (verbindlich):**
- `Field`: Basis-id = `id`-Prop, sonst `useId()`; `feldIds(basis)`. Reihenfolge im DOM: `<label for>` (ein Stil: `text-xs font-semibold`, Vordergrund) · Eingabe · Hilfe (`text-[11px]`, gedämpft) · Sperre „Gesperrt: {grund}“ · Fehler „⚠ {text}“ mit ⚠ in `STATUS_SYMBOL_KLASSE.error` (aria-hidden). `aria-describedby` der Eingabe in der Reihenfolge Hilfe, Sperre, Fehler (`beschreibtDurch`). Fehler → `aria-invalid="true"`; Sperre → `disabled`.
- Eingaben lesen den Kontext über `useFeld()`. Eigene `id` geht vor; `aria-describedby` wird ergänzt, nicht ersetzt; eine Sperre aus dem Field gewinnt immer (auch gegen `disabled={false}` der Eingabe).
- `EINGABE_KLASSE`: Höhe `h-[var(--control-h)]` (Dichte über den Token, nicht über überschreibbare Klassen, G3), `rounded-[var(--radius-md)]`, Fokus-Ring `focus-visible:outline-[var(--ring)]`, `select-text`, Fehlerrand `aria-[invalid=true]:border-[var(--status-error)]`.
- `NumberInput`: Entwurf als Text (`zahlEntwurfAus`), `type="text"` mit `inputMode` `numeric` (ganzzahl) bzw. `decimal`. Tippen, Verlassen (`onBlur` → `uebernehmen`) und Tasten laufen über `zahlSchritt`; nur eine gültige Zahl im Bereich geht an `onChange`. Die Bindung steht in zwei reinen Funktionen: `zahlFeldHandler` liefert `onChange`/`onBlur`/`onKeyDown` des `<input>` (per Spread, kein Handler daneben), `zahlAnsichtHandler` macht aus jedem Ereignis einen `zahlSchritt`; der Test ruft beide auf und prüft die Verdrahtung im Quelltext. Im `Field` übernimmt auch das Zahlenfeld Sperre (`disabled`), Fehler (`aria-invalid`) und Hilfe/Sperre/Fehler in `aria-describedby` (vor der Einheit). Ein ungültiger Entwurf bleibt stehen, mit „⚠ {fehler}“ direkt unter dem Feld und `aria-invalid` (kein stilles Klemmen, E12). Neuer Wert von außen über `zahlSchritt` `'aussen'`. Nach dem Melden wartet das Feld `UEBERNAHME_FRIST_MS` auf den Wert; bleibt er aus, steht dort „⚠ Noch nicht übernommen.“ (Effekt mit `starteFrist` und `zahlSchritt` `'frist'`, E27). Einheit als Text rechts, per `aria-describedby` verknüpft.
- `zahlTaste`: Enter → `uebernehmen`. Escape → `verwerfen`; war der Entwurf geändert (`verbraucht`), dann `stopPropagation()` und `preventDefault()`, damit ein offenes Einstellungs-Panel nicht schließt (E8). Ohne Änderung bleibt Escape frei.

**Regeln für diese Aufgabe:** wie Task 8 (G9, G11, G3, G13).

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`packages/ui/test/field.test.tsx`, neu)

```tsx
// Task 10 · Field, TextInput, NumberInput (Spec 3.5, 3.8; E12, E13): Beschriftung, Hilfe, Sperrgrund und Fehler sind
// per id verknüpft (aria-describedby in fester Reihenfolge), Fehler setzt aria-invalid, Sperre setzt disabled.
import { Field } from '../src/components/Field';
import { NumberInput, NumberInputAnsicht, zahlAnsichtHandler, zahlFeldHandler, zahlTaste } from '../src/components/NumberInput';
import { TextInput } from '../src/components/TextInput';
import { zahlEntwurfAus, zahlSchritt, type ZahlEreignis } from '../src/lib/eingabe';
import { STATUS_SYMBOL_KLASSE } from '../src/lib/status';
import { gleich, leseText, ok, pruefeIdVerweise, render } from './harness';
import { attr, hatKlassen, tags, text, zwischen } from './lib/markup';

const nichts = (): void => undefined;
/** Text des Elements mit dieser id (Inhalt bis zum ersten schließenden Tag `ende`). */
const textVonId = (html: string, id: string, ende = '</p>'): string =>
  text(zwischen(html, `id="${id}"`, ende).replace(/^[^>]*>/, ''));

// ── Field ──
{
  const html = render(
    <Field label="Quellenname" id="ndi-name">
      <TextInput value="JM Titler" onChange={nichts} />
    </Field>,
  );
  const [label] = tags(html, 'label');
  const [input] = tags(html, 'input');
  ok(
    attr(label, 'for') === 'ndi-name' && attr(input, 'id') === 'ndi-name' && text(html) === 'Quellenname',
    'Field: label for = input id',
  );
  ok(hatKlassen(label, 'text-xs font-semibold text-[var(--foreground)]'), 'Field: ein Beschriftungsstil (text-xs, halbfett, Vordergrund)');
  ok(
    attr(input, 'aria-describedby') === undefined && attr(input, 'aria-invalid') === undefined && attr(input, 'disabled') === undefined,
    'Field ohne Hilfe, Sperre, Fehler: keine Verweise, kein aria-invalid, nicht gesperrt',
  );
}
{
  const html = render(
    <Field label="Port" id="port" hint="Standard 8729" lockedReason="Vom Master vorgegeben" error="Port belegt">
      <TextInput value="8729" onChange={nichts} />
    </Field>,
  );
  gleich(
    attr(tags(html, 'input')[0], 'aria-describedby'),
    'port-hilfe port-sperre port-fehler',
    'Field: aria-describedby Reihenfolge Hilfe, Sperre, Fehler',
  );
  pruefeIdVerweise(html, 'Field: alle id-Verweise gültig');
}
{
  const html = render(
    <Field label="Port" id="port" error="Port belegt">
      <TextInput value="8729" onChange={nichts} />
    </Field>,
  );
  ok(
    attr(tags(html, 'input')[0], 'aria-invalid') === 'true' &&
      textVonId(html, 'port-fehler') === '⚠ Port belegt' &&
      html.includes(`<span aria-hidden="true" class="${STATUS_SYMBOL_KLASSE.error}">⚠</span>`),
    'Field Fehler: aria-invalid=true, „⚠ {text}“ mit ⚠ in Fehlerfarbe',
  );
}
{
  const html = render(
    <Field label="Ordner" id="ordner" lockedReason="Vom Master vorgegeben">
      <TextInput value="D:/Show" onChange={nichts} disabled={false} />
    </Field>,
  );
  ok(
    attr(tags(html, 'input')[0], 'disabled') === '' && textVonId(html, 'ordner-sperre') === 'Gesperrt: Vom Master vorgegeben',
    'Field Sperre: disabled + „Gesperrt: {grund}“ (auch gegen disabled={false} der Eingabe)',
  );
  const leer = render(
    <Field label="Ordner" id="ordner" lockedReason="">
      <TextInput value="D:/Show" onChange={nichts} />
    </Field>,
  );
  ok(
    attr(tags(leer, 'input')[0], 'disabled') === undefined && !leer.includes('ordner-sperre') && !leer.includes('Gesperrt'),
    'Field mit leerem Sperrgrund: nicht gesperrt, kein Sperrtext (gesperrt nie ohne Grund)',
  );
}
{
  const html = render(
    <Field label="Name">
      <TextInput value="" onChange={nichts} />
    </Field>,
  );
  const id = attr(tags(html, 'input')[0], 'id') ?? '';
  ok(id !== '' && attr(tags(html, 'label')[0], 'for') === id, 'Field ohne id-Prop: eigene id (useId), label for passt');
}

// ── TextInput ──
{
  const html = render(<TextInput value="x" onChange={nichts} />);
  const [input] = tags(html, 'input');
  ok(
    attr(input, 'type') === 'text' &&
      hatKlassen(
        input,
        'h-[var(--control-h)] rounded-[var(--radius-md)] select-text focus-visible:outline-2 focus-visible:outline-[var(--ring)]',
      ),
    'TextInput: h-[var(--control-h)], Fokus-Ring, select-text',
  );
}
{
  const html = render(<TextInput value="" onChange={nichts} id="suche" aria-label="Suche" placeholder="Name" />);
  const [input] = tags(html, 'input');
  ok(
    attr(input, 'id') === 'suche' && attr(input, 'aria-label') === 'Suche' && attr(input, 'placeholder') === 'Name',
    'TextInput ohne Field: id, aria-label und placeholder durchgereicht',
  );
}

// ── NumberInput ──
{
  const html = render(
    <Field label="Port" id="port" hint="1–65535">
      <NumberInput value={8729} onChange={nichts} unit="TCP" ganzzahl min={1} max={65535} />
    </Field>,
  );
  const [input] = tags(html, 'input');
  ok(
    textVonId(html, 'port-einheit', '</span>') === 'TCP' &&
      (attr(input, 'aria-describedby') ?? '').split(' ').includes('port-einheit'),
    'NumberInput: Einheit sichtbar und in aria-describedby',
  );
  ok(attr(input, 'inputMode') === 'numeric' && attr(input, 'value') === '8729', 'NumberInput: inputMode numeric bei ganzzahl, Startwert 8729');
  ok(hatKlassen(input, 'h-[var(--control-h)] tabular'), 'NumberInput: h-[var(--control-h)], tabular');
  pruefeIdVerweise(html, 'NumberInput in Field: alle id-Verweise gültig');
}
{
  const html = render(
    <Field label="Port" id="p" hint="1–65535" lockedReason="Vom Master vorgegeben" error="Port belegt">
      <NumberInput value={8729} onChange={nichts} unit="TCP" ganzzahl />
    </Field>,
  );
  const [input] = tags(html, 'input');
  gleich(
    [attr(input, 'disabled'), attr(input, 'aria-invalid'), attr(input, 'aria-describedby')],
    ['', 'true', 'p-hilfe p-sperre p-fehler p-einheit'],
    'NumberInput in Field mit Hilfe, Sperre und Fehler: disabled, aria-invalid, aria-describedby Hilfe → Sperre → Fehler → Einheit',
  );
}
{
  const komma = tags(render(<NumberInput value={1.5} onChange={nichts} aria-label="Verzögerung" />), 'input')[0];
  const leer = tags(render(<NumberInput value={null} onChange={nichts} aria-label="Verzögerung" />), 'input')[0];
  ok(
    attr(komma, 'value') === '1,5' && attr(komma, 'inputMode') === 'decimal' && attr(komma, 'aria-label') === 'Verzögerung' &&
      attr(leer, 'value') === '',
    'NumberInput: Startwert zahlText(value) („1,5“), null → leer, inputMode decimal',
  );
}
{
  const html = render(
    <Field label="Port" id="port">
      <NumberInputAnsicht
        entwurf={{ text: 'abc', fehler: 'Bitte eine Zahl eingeben.', geaendert: true }}
        onTippen={nichts}
        onUebernehmen={nichts}
        onTaste={nichts}
        ganzzahl
      />
    </Field>,
  );
  const [input] = tags(html, 'input');
  const fehlerId = (attr(input, 'aria-describedby') ?? '').split(' ').find((id) => id.endsWith('-zahlfehler')) ?? '-';
  ok(
    attr(input, 'value') === 'abc' && attr(input, 'aria-invalid') === 'true' && textVonId(html, fehlerId) === '⚠ Bitte eine Zahl eingeben.',
    'NumberInput ungültiger Entwurf: Text bleibt, aria-invalid, „⚠ Bitte eine Zahl eingeben.“ direkt unter dem Feld',
  );
  pruefeIdVerweise(html, 'NumberInput ungültiger Entwurf: alle id-Verweise gültig');
}
{
  const protokoll: string[] = [];
  const taste = (key: string) => ({
    key,
    stopPropagation: () => void protokoll.push('stop'),
    preventDefault: () => void protokoll.push('prevent'),
  });
  // Mit der echten Entwurfs-Logik (Task 7): Wert 8729, getippt „80“.
  let z = zahlSchritt(zahlEntwurfAus(8729), { art: 'tippen', text: '80' }, {}, 8729).z;
  const schritt = (e: ZahlEreignis) => {
    protokoll.push(e.art);
    const r = zahlSchritt(z, e, {}, 8729);
    z = r.z;
    return r;
  };
  zahlTaste(taste('Escape'), schritt);
  gleich(
    [protokoll, z.text],
    [['verwerfen', 'stop', 'prevent'], '8729'],
    'NumberInput: Escape mit geändertem Entwurf verwirft und verbraucht die Taste (Panel bleibt offen)',
  );
  protokoll.length = 0;
  zahlTaste(taste('Escape'), schritt);
  gleich(protokoll, ['verwerfen'], 'NumberInput: Escape ohne Änderung bleibt frei (Panel darf schließen)');
  protokoll.length = 0;
  zahlTaste(taste('Enter'), schritt);
  zahlTaste(taste('a'), schritt);
  gleich(protokoll, ['uebernehmen'], 'NumberInput: Enter übernimmt, andere Tasten tun nichts');
}

// ── Bindung: die Handler am <input> und der Weg zu zahlSchritt (Effekte laufen nur im Browser) ──
{
  const protokoll: string[] = [];
  const h = zahlFeldHandler({
    onTippen: (t) => void protokoll.push(`tippen ${t}`),
    onUebernehmen: () => void protokoll.push('uebernehmen'),
    onTaste: (e) => void protokoll.push(`taste ${e.key}`),
  });
  h.onChange({ currentTarget: { value: '80' } });
  h.onBlur();
  h.onKeyDown({ key: 'Escape', stopPropagation: nichts, preventDefault: nichts });
  gleich(protokoll, ['tippen 80', 'uebernehmen', 'taste Escape'], 'NumberInput Feld-Handler: Tippen, Verlassen (onBlur) und Tasten (onKeyDown) erreichen die Ansicht');
}
{
  const ereignisse: string[] = [];
  let gestoppt = false;
  const h = zahlAnsichtHandler((e) => {
    ereignisse.push(e.art === 'tippen' ? `tippen ${e.text}` : e.art);
    return { verbraucht: e.art === 'verwerfen' };
  });
  h.onTippen('81');
  h.onUebernehmen();
  h.onTaste({ key: 'Escape', stopPropagation: () => void (gestoppt = true), preventDefault: nichts });
  gleich([ereignisse, gestoppt], [['tippen 81', 'uebernehmen', 'verwerfen'], true], 'NumberInput Ansicht-Handler: jedes Ereignis als zahlSchritt, Escape über zahlTaste');
}
{
  const quelle = leseText('src/components/NumberInput.tsx');
  const fehlt = [
    '{...zahlFeldHandler({ onTippen, onUebernehmen, onTaste })}',
    '{...zahlAnsichtHandler(schritt)}',
    "schrittRef.current({ art: 'aussen', wert: value });",
    "starteFrist(() => schrittRef.current({ art: 'frist' }))",
  ].filter((z) => quelle.split(z).length !== 2);
  const input = quelle.slice(quelle.indexOf('<input'), quelle.indexOf('/>', quelle.indexOf('<input')));
  ok(fehlt.length === 0 && !/\son[A-Z]\w*=\{/.test(input), 'NumberInput Verdrahtung: Handler per Spread, Wert von außen und Frist (E27) im Effekt');
  for (const z of fehlt) console.log(`     fehlt: ${z}`);
}
```

- [ ] **Step 2: Testmodul einhängen** (`packages/ui/test/selftest.ts`)

Vorher:
```ts
abschluss();
```
Nachher:
```ts
import './field.test';
abschluss();
```

- [ ] **Step 3: Test laufen lassen (rot)**

Run: `npm run selftest -w @jm/ui`
Expected: Exit-Code 1, kein Test läuft:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\packages\ui\src\components\Field' imported from …\packages\ui\test\field.test.tsx
```

- [ ] **Step 4: `Field` anlegen** (`packages/ui/src/components/Field.tsx`, neu)

```tsx
import { createContext, useContext, useId, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { beschreibtDurch, feldIds, type FeldIds } from '../lib/eingabe';
import { STATUS_SYMBOL, STATUS_SYMBOL_KLASSE } from '../lib/status';
import { UI_TEXTE } from '../lib/texte';

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  lockedReason?: string;
  /** Basis-id; ohne sie entsteht eine per useId(). */
  id?: string;
  className?: string;
  children: ReactNode;
}

/** Was eine Eingabe im Field erfährt (E13). */
export interface FeldKontext {
  ids: FeldIds;
  describedBy?: string;
  invalid: boolean;
  gesperrt: boolean;
}

const FeldKontextReact = createContext<FeldKontext | null>(null);

/** Kontext des umgebenden Field, sonst null (Eingabe steht allein). */
export function useFeld(): FeldKontext | null {
  return useContext(FeldKontextReact);
}

/**
 * Gemeinsame Klassen aller einzeiligen Eingaben (TextInput, NumberInput, Select): Höhe aus --control-h (Dichte über
 * den Token, nicht über überschreibbare Klassen – cn hat kein tailwind-merge), Fokus-Ring, Fehlerrand bei aria-invalid.
 * Nur aus dieser Datei exportiert, nicht aus index.ts.
 */
export const EINGABE_KLASSE =
  'h-[var(--control-h)] w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--input)] px-2.5 ' +
  'text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] select-text ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)] ' +
  'disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-[var(--status-error)]';

/** id-Listen für aria-describedby zusammenfügen; leer → undefined. Nur aus dieser Datei exportiert. */
export function verbindeIds(...ids: Array<string | undefined>): string | undefined {
  const liste = ids.filter((id): id is string => Boolean(id));
  return liste.length > 0 ? liste.join(' ') : undefined;
}

/**
 * Beschriftete Eingabe (Spec 3.5; E13): Beschriftung, Eingabe, Hilfe, Sperrgrund, Fehler. Stellt den Eingaben id,
 * aria-describedby (Hilfe, Sperre, Fehler), aria-invalid und die Sperre über den Kontext bereit.
 */
export function Field({ label, hint, error, lockedReason, id, className, children }: FieldProps): React.JSX.Element {
  const eigeneId = useId();
  const ids = feldIds(id ?? eigeneId);
  const kontext: FeldKontext = {
    ids,
    describedBy: beschreibtDurch(ids, { hilfe: Boolean(hint), sperre: Boolean(lockedReason), fehler: Boolean(error) }),
    invalid: Boolean(error),
    gesperrt: Boolean(lockedReason),
  };
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={ids.input} className="text-xs font-semibold text-[var(--foreground)]">
        {label}
      </label>
      <FeldKontextReact.Provider value={kontext}>{children}</FeldKontextReact.Provider>
      {hint ? (
        <p id={ids.hilfe} className="text-[11px] text-[var(--muted-foreground)]">
          {hint}
        </p>
      ) : null}
      {lockedReason ? (
        <p id={ids.sperre} className="text-[11px] text-[var(--muted-foreground)]">
          {UI_TEXTE.gesperrt(lockedReason)}
        </p>
      ) : null}
      {error ? (
        <p id={ids.fehler} className="text-[11px] font-semibold text-[var(--foreground)]">
          <span aria-hidden="true" className={STATUS_SYMBOL_KLASSE.error}>
            {STATUS_SYMBOL.error}
          </span>{' '}
          {error}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: `TextInput` anlegen** (`packages/ui/src/components/TextInput.tsx`, neu)

```tsx
import type { InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { EINGABE_KLASSE, useFeld, verbindeIds } from './Field';

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'size'> {
  value: string;
  onChange(value: string): void;
}

/**
 * Einzeiliges Textfeld (Spec 3.5). Im Field übernimmt es id, aria-describedby, aria-invalid und die Sperre; eigene
 * Props gehen bei id vor, aria-describedby wird ergänzt. Eine Sperre aus dem Field kann die Eingabe nicht aufheben.
 */
export function TextInput({
  value,
  onChange,
  id,
  disabled,
  className,
  type = 'text',
  'aria-describedby': eigeneBeschreibung,
  'aria-invalid': eigenesInvalid,
  ...rest
}: TextInputProps): React.JSX.Element {
  const feld = useFeld();
  return (
    <input
      {...rest}
      type={type}
      id={id ?? feld?.ids.input}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      disabled={disabled || feld?.gesperrt || undefined}
      aria-describedby={verbindeIds(feld?.describedBy, eigeneBeschreibung)}
      aria-invalid={eigenesInvalid ?? (feld?.invalid ? true : undefined)}
      className={cn(EINGABE_KLASSE, className)}
    />
  );
}
```

- [ ] **Step 6: `NumberInput` anlegen** (`packages/ui/src/components/NumberInput.tsx`, neu)

```tsx
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { starteFrist, zahlEntwurfAus, zahlSchritt, type ZahlEntwurf, type ZahlEreignis, type ZahlRegeln } from '../lib/eingabe';
import { STATUS_SYMBOL, STATUS_SYMBOL_KLASSE } from '../lib/status';
import { EINGABE_KLASSE, useFeld, verbindeIds } from './Field';

export interface NumberInputProps {
  value: number | null;
  onChange(value: number): void;
  min?: number;
  max?: number;
  ganzzahl?: boolean;
  unit?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * Tastatur im Zahlenfeld (E8, E12): Enter übernimmt; Escape verwirft einen geänderten Entwurf und verbraucht die Taste
 * (stopPropagation + preventDefault), damit ein offenes Einstellungs-Panel dabei nicht schließt. Ohne Änderung bleibt
 * Escape frei. Nur aus dieser Datei exportiert, nicht aus index.ts.
 */
export function zahlTaste(
  e: { key: string; stopPropagation(): void; preventDefault(): void },
  schritt: (ereignis: ZahlEreignis) => { verbraucht: boolean },
): void {
  if (e.key === 'Enter') {
    schritt({ art: 'uebernehmen' });
    return;
  }
  if (e.key !== 'Escape') return;
  if (schritt({ art: 'verwerfen' }).verbraucht) {
    e.stopPropagation();
    e.preventDefault();
  }
}

export interface NumberInputAnsichtProps extends Omit<NumberInputProps, 'value' | 'onChange' | 'min' | 'max'> {
  entwurf: ZahlEntwurf;
  onTippen(text: string): void;
  onUebernehmen(): void;
  onTaste(e: { key: string; stopPropagation(): void; preventDefault(): void }): void;
}

/** Handler des Eingabefelds (E12): Tippen, Verlassen und Tasten gehen an die Ansicht-Rückrufe. Nur aus dieser Datei exportiert. */
export function zahlFeldHandler(p: Pick<NumberInputAnsichtProps, 'onTippen' | 'onUebernehmen' | 'onTaste'>): {
  onChange(e: { currentTarget: { value: string } }): void;
  onBlur(): void;
  onKeyDown(e: { key: string; stopPropagation(): void; preventDefault(): void }): void;
} {
  return {
    onChange: (e) => p.onTippen(e.currentTarget.value),
    onBlur: () => p.onUebernehmen(),
    onKeyDown: (e) => p.onTaste(e),
  };
}

/** Was NumberInput der Ansicht gibt: jedes Ereignis als Schritt des Entwurfs (Escape über zahlTaste). Nur aus dieser Datei. */
export function zahlAnsichtHandler(
  schritt: (e: ZahlEreignis) => { verbraucht: boolean },
): Pick<NumberInputAnsichtProps, 'onTippen' | 'onUebernehmen' | 'onTaste'> {
  return {
    onTippen: (text) => schritt({ art: 'tippen', text }),
    onUebernehmen: () => schritt({ art: 'uebernehmen' }),
    onTaste: (e) => zahlTaste(e, schritt),
  };
}

/**
 * Reine Darstellung des Zahlenfelds aus einem Entwurf (testbar ohne Zustand). Ein ungültiger Entwurf bleibt stehen,
 * mit Fehlertext direkt unter dem Feld und aria-invalid (kein stilles Klemmen). Nur aus dieser Datei exportiert.
 */
export function NumberInputAnsicht({
  entwurf,
  onTippen,
  onUebernehmen,
  onTaste,
  ganzzahl,
  unit,
  placeholder,
  disabled,
  id,
  className,
  'aria-label': ariaLabel,
}: NumberInputAnsichtProps): React.JSX.Element {
  const feld = useFeld();
  const eigeneId = useId();
  const inputId = id ?? feld?.ids.input ?? eigeneId;
  const einheitId = unit ? `${inputId}-einheit` : undefined;
  const fehlerId = entwurf.fehler ? `${inputId}-zahlfehler` : undefined;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          id={inputId}
          inputMode={ganzzahl ? 'numeric' : 'decimal'}
          value={entwurf.text}
          placeholder={placeholder}
          aria-label={ariaLabel}
          disabled={disabled || feld?.gesperrt || undefined}
          aria-invalid={entwurf.fehler || feld?.invalid ? true : undefined}
          aria-describedby={verbindeIds(feld?.describedBy, fehlerId, einheitId)}
          {...zahlFeldHandler({ onTippen, onUebernehmen, onTaste })}
          className={cn(EINGABE_KLASSE, 'tabular')}
        />
        {unit ? (
          <span id={einheitId} className="shrink-0 text-xs text-[var(--muted-foreground)]">
            {unit}
          </span>
        ) : null}
      </div>
      {entwurf.fehler ? (
        <p id={fehlerId} className="text-[11px] font-semibold text-[var(--foreground)]">
          <span aria-hidden="true" className={STATUS_SYMBOL_KLASSE.error}>
            {STATUS_SYMBOL.error}
          </span>{' '}
          {entwurf.fehler}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Zahlenfeld (Spec 3.5; E12): Entwurf als Text, Komma und Punkt als Dezimaltrenner. Enter und Verlassen übernehmen nur
 * eine gültige Zahl im Bereich, sonst bleibt der Entwurf mit Fehlertext. Escape verwirft. Einheit rechts als Text.
 */
export function NumberInput({ value, onChange, min, max, ganzzahl, ...ansicht }: NumberInputProps): React.JSX.Element {
  const [entwurf, setEntwurf] = useState<ZahlEntwurf>(() => zahlEntwurfAus(value));
  const entwurfRef = useRef(entwurf);
  const wertRef = useRef(value);
  wertRef.current = value;
  const regelnRef = useRef<ZahlRegeln>({ min, max, ganzzahl });
  regelnRef.current = { min, max, ganzzahl };
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const schritt = (e: ZahlEreignis): { verbraucht: boolean } => {
    const r = zahlSchritt(entwurfRef.current, e, regelnRef.current, wertRef.current);
    entwurfRef.current = r.z;
    setEntwurf(r.z);
    if (r.neuerWert !== undefined) onChangeRef.current(r.neuerWert);
    return r;
  };
  const schrittRef = useRef(schritt);
  schrittRef.current = schritt;

  // Neuer Wert von außen: ein unveränderter Entwurf folgt, ein angefangener bleibt (zahlSchritt 'aussen').
  useEffect(() => {
    schrittRef.current({ art: 'aussen', wert: value });
  }, [value]);

  // Frist (E27): Kommt ein gemeldeter Wert nicht zurück, zeigt das Feld nach 2 s „Noch nicht übernommen.“.
  useEffect(
    () => (entwurf.gesendet === undefined ? undefined : starteFrist(() => schrittRef.current({ art: 'frist' }))),
    [entwurf.gesendet],
  );

  return (
    <NumberInputAnsicht {...ansicht} ganzzahl={ganzzahl} entwurf={entwurf} {...zahlAnsichtHandler(schritt)} />
  );
}
```

- [ ] **Step 7: Exporte anhängen** (`packages/ui/src/index.ts`, Dateiende)

Vorher:
```ts
export { TallyButton, type TallyButtonProps } from './components/TallyButton';
```
Nachher:
```ts
export { TallyButton, type TallyButtonProps } from './components/TallyButton';
export { Field, useFeld } from './components/Field';
export { TextInput } from './components/TextInput';
export { NumberInput } from './components/NumberInput';
```

- [ ] **Step 8: Test laufen lassen (grün)**

Run: `npm run selftest -w @jm/ui`
Expected: keine Zeile mit `FAIL`, letzte Zeile `ALLE TESTS OK`, Exit-Code 0. Die Zeilen dieser Aufgabe:
```
ok   Field: label for = input id
ok   Field: ein Beschriftungsstil (text-xs, halbfett, Vordergrund)
ok   Field ohne Hilfe, Sperre, Fehler: keine Verweise, kein aria-invalid, nicht gesperrt
ok   Field: aria-describedby Reihenfolge Hilfe, Sperre, Fehler
ok   Field: alle id-Verweise gültig
ok   Field Fehler: aria-invalid=true, „⚠ {text}“ mit ⚠ in Fehlerfarbe
ok   Field Sperre: disabled + „Gesperrt: {grund}“ (auch gegen disabled={false} der Eingabe)
ok   Field mit leerem Sperrgrund: nicht gesperrt, kein Sperrtext (gesperrt nie ohne Grund)
ok   Field ohne id-Prop: eigene id (useId), label for passt
ok   TextInput: h-[var(--control-h)], Fokus-Ring, select-text
ok   TextInput ohne Field: id, aria-label und placeholder durchgereicht
ok   NumberInput: Einheit sichtbar und in aria-describedby
ok   NumberInput: inputMode numeric bei ganzzahl, Startwert 8729
ok   NumberInput: h-[var(--control-h)], tabular
ok   NumberInput in Field: alle id-Verweise gültig
ok   NumberInput in Field mit Hilfe, Sperre und Fehler: disabled, aria-invalid, aria-describedby Hilfe → Sperre → Fehler → Einheit
ok   NumberInput: Startwert zahlText(value) („1,5“), null → leer, inputMode decimal
ok   NumberInput ungültiger Entwurf: Text bleibt, aria-invalid, „⚠ Bitte eine Zahl eingeben.“ direkt unter dem Feld
ok   NumberInput ungültiger Entwurf: alle id-Verweise gültig
ok   NumberInput: Escape mit geändertem Entwurf verwirft und verbraucht die Taste (Panel bleibt offen)
ok   NumberInput: Escape ohne Änderung bleibt frei (Panel darf schließen)
ok   NumberInput: Enter übernimmt, andere Tasten tun nichts
ok   NumberInput Feld-Handler: Tippen, Verlassen (onBlur) und Tasten (onKeyDown) erreichen die Ansicht
ok   NumberInput Ansicht-Handler: jedes Ereignis als zahlSchritt, Escape über zahlTaste
ok   NumberInput Verdrahtung: Handler per Spread, Wert von außen und Frist (E27) im Effekt
```
Zählen: `npm run selftest -w @jm/ui | grep -cE "^ok   (Field|TextInput|NumberInput)"` → `25`. Gesamt nach dieser Aufgabe (gemessen): `319` `ok`-Zeilen.

- [ ] **Step 9: Typecheck**

Run: `npm run typecheck -w @jm/ui`
Expected: keine Ausgabe von `tsc`, Exit-Code 0.

- [ ] **Step 10: Mutationsprobe (ohne Commit; je eine Änderung allein, danach zurück)**

a) Fehler ohne `aria-invalid`:
Vorher (`packages/ui/src/components/TextInput.tsx`):
```tsx
      aria-invalid={eigenesInvalid ?? (feld?.invalid ? true : undefined)}
```
Nachher:
```tsx
      aria-invalid={eigenesInvalid}
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Field Fehler: aria-invalid=true, „⚠ {text}“ mit ⚠ in Fehlerfarbe
1 FEHLGESCHLAGEN
```

b) Sperre ohne `disabled`:
Vorher (`packages/ui/src/components/TextInput.tsx`):
```tsx
      disabled={disabled || feld?.gesperrt || undefined}
```
Nachher:
```tsx
      disabled={disabled || undefined}
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Field Sperre: disabled + „Gesperrt: {grund}“ (auch gegen disabled={false} der Eingabe)
1 FEHLGESCHLAGEN
```

c) Escape im geänderten Zahlenfeld wird nicht verbraucht (Panel schlösse mit):
Vorher (`packages/ui/src/components/NumberInput.tsx`):
```tsx
    e.stopPropagation();
    e.preventDefault();
  }
```
Nachher:
```tsx
  }
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL NumberInput: Escape mit geändertem Entwurf verwirft und verbraucht die Taste (Panel bleibt offen)
     ist: [["verwerfen"],"8729"] soll: [["verwerfen","stop","prevent"],"8729"]
FAIL NumberInput Ansicht-Handler: jedes Ereignis als zahlSchritt, Escape über zahlTaste
     ist: [["tippen 81","uebernehmen","verwerfen"],false] soll: [["tippen 81","uebernehmen","verwerfen"],true]
2 FEHLGESCHLAGEN
```

d) Zahlenfeld übernimmt die Sperre des Field nicht:
Vorher (`packages/ui/src/components/NumberInput.tsx`):
```tsx
          disabled={disabled || feld?.gesperrt || undefined}
```
Nachher:
```tsx
          disabled={disabled || undefined}
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL NumberInput in Field mit Hilfe, Sperre und Fehler: disabled, aria-invalid, aria-describedby Hilfe → Sperre → Fehler → Einheit
     ist: [null,"true","p-hilfe p-sperre p-fehler p-einheit"] soll: ["","true","p-hilfe p-sperre p-fehler p-einheit"]
1 FEHLGESCHLAGEN
```

e) Zahlenfeld übernimmt den Fehler des Field nicht:
Vorher (`packages/ui/src/components/NumberInput.tsx`):
```tsx
          aria-invalid={entwurf.fehler || feld?.invalid ? true : undefined}
```
Nachher:
```tsx
          aria-invalid={entwurf.fehler ? true : undefined}
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL NumberInput in Field mit Hilfe, Sperre und Fehler: disabled, aria-invalid, aria-describedby Hilfe → Sperre → Fehler → Einheit
     ist: ["",null,"p-hilfe p-sperre p-fehler p-einheit"] soll: ["","true","p-hilfe p-sperre p-fehler p-einheit"]
1 FEHLGESCHLAGEN
```

f) Zahlenfeld lässt Hilfe, Sperre und Fehler aus `aria-describedby` weg:
Vorher (`packages/ui/src/components/NumberInput.tsx`):
```tsx
          aria-describedby={verbindeIds(feld?.describedBy, fehlerId, einheitId)}
```
Nachher:
```tsx
          aria-describedby={verbindeIds(fehlerId, einheitId)}
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL NumberInput in Field mit Hilfe, Sperre und Fehler: disabled, aria-invalid, aria-describedby Hilfe → Sperre → Fehler → Einheit
     ist: ["","true","p-einheit"] soll: ["","true","p-hilfe p-sperre p-fehler p-einheit"]
1 FEHLGESCHLAGEN
```

g) Verlassen übernimmt nicht (`onBlur` fehlt in der Bindung):
Vorher (`packages/ui/src/components/NumberInput.tsx`):
```tsx
    onBlur: () => p.onUebernehmen(),
```
Nachher:
```tsx
    onBlur: () => undefined,
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL NumberInput Feld-Handler: Tippen, Verlassen (onBlur) und Tasten (onKeyDown) erreichen die Ansicht
     ist: ["tippen 80","taste Escape"] soll: ["tippen 80","uebernehmen","taste Escape"]
1 FEHLGESCHLAGEN
```

h) Leerer Sperrgrund sperrt:
Vorher (`packages/ui/src/components/Field.tsx`):
```tsx
    gesperrt: Boolean(lockedReason),
```
Nachher:
```tsx
    gesperrt: lockedReason !== undefined,
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Field mit leerem Sperrgrund: nicht gesperrt, kein Sperrtext (gesperrt nie ohne Grund)
1 FEHLGESCHLAGEN
```

i) Ohne Frist-Effekt (ein abgelehnter Wert stünde ohne Hinweis im Feld, E27):
Vorher (`packages/ui/src/components/NumberInput.tsx`):
```tsx
    () => (entwurf.gesendet === undefined ? undefined : starteFrist(() => schrittRef.current({ art: 'frist' }))),
```
Nachher:
```tsx
    () => undefined,
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL NumberInput Verdrahtung: Handler per Spread, Wert von außen und Frist (E27) im Effekt
     fehlt: starteFrist(() => schrittRef.current({ art: 'frist' }))
1 FEHLGESCHLAGEN
```

Nach jeder Probe die Ersetzung zurücknehmen; `npm run selftest -w @jm/ui` → wieder `ALLE TESTS OK`.

- [ ] **Step 11: Commit** (Commit-Text bewusst ohne Umlaute)

```bash
git add packages/ui/test/field.test.tsx packages/ui/src/components/Field.tsx packages/ui/src/components/TextInput.tsx packages/ui/src/components/NumberInput.tsx packages/ui/test/selftest.ts packages/ui/src/index.ts
git status --short
```
Erwartet genau:
```
A  packages/ui/src/components/Field.tsx
A  packages/ui/src/components/NumberInput.tsx
A  packages/ui/src/components/TextInput.tsx
M  packages/ui/src/index.ts
A  packages/ui/test/field.test.tsx
M  packages/ui/test/selftest.ts
```
Dann:
```bash
git commit -m "feat(ui): Field, TextInput und NumberInput mit Fehler- und Sperrgrund-Verknuepfung" -m "Field stellt id, aria-describedby (Hilfe, Sperre, Fehler), aria-invalid und Sperre per Kontext bereit; ein Beschriftungsstil, Fehler als Warnsymbol plus Text. Eingaben 32 px ueber --control-h. NumberInput haelt einen Text-Entwurf: nur gueltige Zahlen im Bereich werden uebernommen, sonst bleibt der Entwurf mit Fehlertext; ein gemeldeter Wert wird nur einmal gemeldet, und kommt er nicht innerhalb von 2 s zurueck, steht Noch nicht uebernommen unter dem Feld; Escape verwirft einen geaenderten Entwurf und verbraucht die Taste (zahlTaste), damit das Einstellungs-Panel offen bleibt." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Für die Galerie (Task 23) muss zu sehen sein:** Ein `NumberInput` „Port“ (1–65535, ganzzahl, Einheit „TCP“): „abc“ tippen und Enter → „⚠ Bitte eine Zahl eingeben.“ unter dem Feld und roter Rand, der Text bleibt stehen; „70000“ → „⚠ Höchstens 65535.“; „1,5“ in einem Dezimalfeld wird als 1,5 übernommen; Escape nach einer Änderung stellt den alten Wert her. Im offenen Panel schließt dieses Escape das Panel **nicht**; ein zweites Escape (ohne Änderung) schließt es. Lehnt das Tool ab (das Galerie-Beispiel „Port“ übernimmt keine Werte unter 1024): „80“ und Enter → nach etwa 2 s „⚠ Noch nicht übernommen.“, der Text bleibt; Tab aus dem Feld meldet nicht erneut; Escape stellt den alten Wert her (E27). Fokus-Ring sichtbar, Felder mit Hilfe, Sperre und Fehler je einmal.

**Nachgerechnet** (Kopie wie in Task 8, `eingabe.ts` nach 9.6 nachgebaut): Step 3 rot wie angegeben; Step 8 grün mit 20 `ok`-Zeilen dieser Aufgabe; Typecheck grün; drei Mutationsproben rot wie angegeben, danach wieder grün. **Nach der Nachbesserung** (frische Kopie, Plantext Tasks 1–10): 25 `ok`-Zeilen dieser Aufgabe, gesamt 307, Proben a–h rot mit 1, 1, 2, 1, 1, 1, 1, 1 `FAIL`. **Zweite Nachbesserung:** frische Kopie, Plantext Tasks 1–10: 25 `ok`-Zeilen dieser Aufgabe (gesamt 319), Proben a–i rot mit 1, 1, 2, 1, 1, 1, 1, 1, 1 `FAIL`, Typprüfung grün. Im Probe-Bau vorhanden: `h-[var(--control-h)]`, `aria-[invalid=true]:border-[var(--status-error)]` (Selektor `[aria-invalid=true]`), `focus-visible:outline-[var(--ring)]` (`outline-color:var(--ring)`), `placeholder:text-[var(--muted-foreground)]`.

**Abweichungen vom Gerüst:**
1. Zusätzliche Exporte nur aus ihrer Datei (nicht aus `index.ts`): `EINGABE_KLASSE` und `verbindeIds` (Field.tsx, gemeinsam für TextInput, NumberInput, Select), `zahlTaste` und `NumberInputAnsicht`/`NumberInputAnsichtProps` (NumberInput.tsx). `zahlTaste` macht die Escape-Regel aus E8 ohne Browser testbar; `NumberInputAnsicht` macht den Fehlerzustand renderbar (unter `renderToStaticMarkup` hat der Entwurf sonst nie einen Fehler).
2. „Eigene Props gehen vor“ gilt für `id`; `aria-describedby` wird ergänzt statt ersetzt, und die Sperre des Field gewinnt gegen `disabled={false}` der Eingabe (eine Sperre darf nicht aus Versehen aufgehoben werden).
3. Nachbesserung nach dem Review: `zahlFeldHandler` und `zahlAnsichtHandler` (nur aus der Datei) machen die Bindung prüfbar; neue Fälle für das Zahlenfeld in einem Field mit Hilfe, Sperre und Fehler und für einen leeren Sperrgrund. Gemessen blieben vorher ein Zahlenfeld ohne Sperre/Fehler/Verweise des Field, ein Feld ohne `onBlur`/`onKeyDown` und `gesperrt: lockedReason !== undefined` grün (Proben d–h).
4. Zweite Nachbesserung (Prüfrunde 2, E27): Effekt „Frist“ über `starteFrist` (Task 7). Die Verdrahtung prüft auch ihn (Probe i). Dass React ihn ausführt, prüft der Owner (Owner-Prüfpunkt 3).

---

### Task 11: `Toggle` und `Select`

**Spec:** 3.5, 6.2 (nie still auf einen Standard springen). Entscheidungen E5 (gelbe Kante), E11, E13; Review Focus 3; Regeln G3, G7.

**Arbeitsverzeichnis/Voraussetzung:** Wurzel des Worktrees. Tasks 1–10 sind committet (`selectOptionen` aus Task 7, `useFeld`/`EINGABE_KLASSE` aus Task 10).

**Dateien:**
- Create: `packages/ui/test/toggle-select.test.tsx`
- Create: `packages/ui/src/components/Toggle.tsx`
- Create: `packages/ui/src/components/Select.tsx`
- Modify: `packages/ui/test/selftest.ts` (eine `import`-Zeile vor `abschluss();`)
- Modify: `packages/ui/src/index.ts` (zwei Zeilen am Ende)

**Interfaces:**
- Consumes: `selectOptionen`, `SelectOption` (9.6; liefert auch den Platzhalter „– bitte wählen –“, Task 7); `useFeld`, `EINGABE_KLASSE` (Task 10); `cn`.
- Produces (9.7, exakt so; Block C nutzt beide):
  ```ts
  // packages/ui/src/components/Toggle.tsx
  export interface ToggleProps { checked: boolean; onChange(next: boolean): void; disabled?: boolean; id?: string;
    className?: string; 'aria-label'?: string }
  export function Toggle(p: ToggleProps): React.JSX.Element;            // <button type="button" role="switch" aria-checked>
  // packages/ui/src/components/Select.tsx
  export interface SelectProps { options: readonly SelectOption[]; value: string; onChange(value: string): void;
    placeholder?: string; fehlendLabel?: string; disabled?: boolean; id?: string; className?: string; 'aria-label'?: string }
  export function Select(p: SelectProps): React.JSX.Element;            // natives <select>, Pflichtklasse h-[var(--control-h)]
  ```
  Neue Zeilen in `index.ts` (9.8): `export { Toggle } from './components/Toggle';`, `export { Select } from './components/Select';`.

**Verhalten (verbindlich):**
- `Toggle`: `<button type="button" role="switch" aria-checked data-state="an|aus">`, Klick → `onChange(!checked)`. Der Zustand steckt in der Form (Knopf rechts = an: `justify-end`, links = aus: `justify-start`), nicht nur in der Farbe. „An“: Fläche `--tally-selected` mit Kante `--brand-yellow` (E5; im Hellmodus dunkle Fläche mit gelber Kante), Knopf `--primary-foreground`. Im Field: id, `aria-describedby`, Sperre wie Task 10.
- `Select`: natives `<select>` mit `EINGABE_KLASSE`; Optionen aus `selectOptionen(options, value, { placeholder, fehlendLabel })`. Ein gewählter Wert, der in `options` fehlt, bleibt als **erste** Option „nicht verfügbar: {fehlendLabel ?? value}“ gewählt und gesperrt (E11) – das native `select` würde sonst still die erste Option zeigen. Bei `value === ''` ohne Option `''` und ohne `placeholder` kommt „– bitte wählen –“ (`UI_TEXTE.bitteWaehlen`, geliefert von `selectOptionen` aus Task 7; `Select` reicht `placeholder` nur durch); gibt es eine Option `''` (etwa „System-Standard“), kommt kein Platzhalter dazu.

**Regeln für diese Aufgabe:** wie Task 8 (G9, G11, G3, G13).

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`packages/ui/test/toggle-select.test.tsx`, neu)

```tsx
// Task 11 · Toggle und Select (Spec 3.5, 6.2; E11, E13): Schalter mit role="switch" und Form statt nur Farbe; Auswahl
// nativ, ein fehlender gespeicherter Wert bleibt sichtbar gewählt („nicht verfügbar: …“) und springt nie still um.
import { Field } from '../src/components/Field';
import { Select } from '../src/components/Select';
import { Toggle } from '../src/components/Toggle';
import { gleich, ok, pruefeIdVerweise, render } from './harness';
import { attr, hatKlassen, tags, text, zwischen } from './lib/markup';

const nichts = (): void => undefined;
const OPTIONEN = [
  { value: 'mic-1', label: 'Mikro 1' },
  { value: 'mic-2', label: 'Mikro 2' },
];
/** Je Option [value, selected, disabled, Text]. */
const optionen = (html: string): Array<[string | undefined, boolean, boolean, string]> =>
  html
    .split('<option')
    .slice(1)
    .map((teil) => {
      const tag = `<option${teil.slice(0, teil.indexOf('>') + 1)}`;
      return [
        attr(tag, 'value'),
        attr(tag, 'selected') !== undefined,
        attr(tag, 'disabled') !== undefined,
        text(teil.slice(teil.indexOf('>') + 1, teil.indexOf('</option>'))),
      ];
    });

// ── Toggle ──
{
  const [an] = tags(render(<Toggle checked onChange={nichts} aria-label="Ausgabe" />), 'button');
  const [aus] = tags(render(<Toggle checked={false} onChange={nichts} aria-label="Ausgabe" />), 'button');
  ok(
    attr(an, 'type') === 'button' && attr(an, 'role') === 'switch' && attr(an, 'aria-checked') === 'true' &&
      attr(an, 'data-state') === 'an' && attr(aus, 'role') === 'switch' && attr(aus, 'aria-checked') === 'false' &&
      attr(aus, 'data-state') === 'aus',
    'Toggle: button type=button role=switch aria-checked true/false, data-state an/aus',
  );
  ok(
    hatKlassen(an, 'justify-end') && hatKlassen(aus, 'justify-start'),
    'Toggle: Knopf-Position als Form (rechts = an, links = aus), nicht nur Farbe',
  );
  ok(
    hatKlassen(an, 'h-[var(--control-h)] border-[var(--brand-yellow)] bg-[var(--tally-selected)]') &&
      attr(an, 'aria-label') === 'Ausgabe',
    'Toggle: h-[var(--control-h)], an = --tally-selected mit gelber Kante, aria-label durchgereicht',
  );
}
{
  const [k] = tags(render(<Toggle checked onChange={nichts} disabled aria-label="Ausgabe" />), 'button');
  ok(attr(k, 'disabled') === '', 'Toggle disabled: disabled-Attribut');
}
{
  const html = render(
    <Field label="Ausgabe" id="ndi-an" lockedReason="Vom Master vorgegeben">
      <Toggle checked onChange={nichts} />
    </Field>,
  );
  const [k] = tags(html, 'button');
  ok(
    attr(tags(html, 'label')[0], 'for') === 'ndi-an' && attr(k, 'id') === 'ndi-an' && attr(k, 'disabled') === '' &&
      attr(k, 'aria-describedby') === 'ndi-an-sperre',
    'Toggle in Field: label for → button id, Sperre setzt disabled und aria-describedby',
  );
  pruefeIdVerweise(html, 'Toggle in Field: alle id-Verweise gültig');
  const mitFehler = tags(
    render(
      <Field label="Ausgabe" id="ndi-an" error="NDI-Laufzeit fehlt">
        <Toggle checked onChange={nichts} />
      </Field>,
    ),
    'button',
  )[0];
  ok(
    attr(mitFehler, 'aria-invalid') === 'true' && attr(mitFehler, 'aria-describedby') === 'ndi-an-fehler',
    'Toggle in Field mit Fehler: aria-invalid=true, aria-describedby auf den Fehler',
  );
}

// ── Select ──
{
  const html = render(<Select options={OPTIONEN} value="mic-2" onChange={nichts} aria-label="Eingang" />);
  gleich(
    optionen(html),
    [
      ['mic-1', false, false, 'Mikro 1'],
      ['mic-2', true, false, 'Mikro 2'],
    ],
    'Select: Optionen aus selectOptionen, gewählter Wert selected',
  );
  const [sel] = tags(html, 'select');
  ok(hatKlassen(sel, 'h-[var(--control-h)] rounded-[var(--radius-md)]') && attr(sel, 'aria-label') === 'Eingang', 'Select: natives <select>, h-[var(--control-h)], aria-label');
}
{
  const mitLabel = render(
    <Select options={OPTIONEN} value="mic-9" fehlendLabel="USB-Mikro (alt)" onChange={nichts} aria-label="Eingang" />,
  );
  gleich(
    optionen(mitLabel),
    [
      ['mic-9', true, true, 'nicht verfügbar: USB-Mikro (alt)'],
      ['mic-1', false, false, 'Mikro 1'],
      ['mic-2', false, false, 'Mikro 2'],
    ],
    'Select fehlender Wert: erste Option „nicht verfügbar: …“ disabled und selected, übrige Liste unverändert',
  );
  const ohneLabel = render(<Select options={OPTIONEN} value="mic-9" onChange={nichts} aria-label="Eingang" />);
  gleich(optionen(ohneLabel)[0], ['mic-9', true, true, 'nicht verfügbar: mic-9'], 'Select fehlender Wert ohne fehlendLabel: „nicht verfügbar: {value}“');
}
{
  const mit = render(<Select options={OPTIONEN} value="" placeholder="Gerät wählen" onChange={nichts} aria-label="Eingang" />);
  gleich(optionen(mit)[0], ['', true, false, 'Gerät wählen'], 'Select: placeholder bei value \'\'');
  const ohne = render(<Select options={OPTIONEN} value="" onChange={nichts} aria-label="Eingang" />);
  gleich(optionen(ohne)[0], ['', true, false, '– bitte wählen –'], 'Select: value \'\' ohne placeholder → „– bitte wählen –“ statt still der ersten Option');
  const standard = render(
    <Select options={[{ value: '', label: 'System-Standard' }, ...OPTIONEN]} value="" onChange={nichts} aria-label="Ausgang" />,
  );
  gleich(
    optionen(standard).map((o) => o[3]),
    ['System-Standard', 'Mikro 1', 'Mikro 2'],
    'Select: gibt es eine Option \'\' (z. B. System-Standard), kommt kein Platzhalter dazu',
  );
}
{
  const html = render(
    <Field label="Eingang" id="eingang" error="Gerät nicht gefunden">
      <Select options={OPTIONEN} value="mic-1" onChange={nichts} />
    </Field>,
  );
  const [sel] = tags(html, 'select');
  ok(
    attr(sel, 'id') === 'eingang' && attr(sel, 'aria-describedby') === 'eingang-fehler' && attr(sel, 'aria-invalid') === 'true',
    'Select in Field: id, aria-describedby und aria-invalid',
  );
  pruefeIdVerweise(html, 'Select in Field: alle id-Verweise gültig');
  const gesperrt = render(
    <Field label="Eingang" id="eingang" lockedReason="Vom Master vorgegeben">
      <Select options={OPTIONEN} value="mic-1" onChange={nichts} />
    </Field>,
  );
  ok(
    attr(tags(gesperrt, 'select')[0], 'disabled') === '' &&
      text(zwischen(gesperrt, 'id="eingang-sperre"', '</p>').replace(/^[^>]*>/, '')) === 'Gesperrt: Vom Master vorgegeben',
    'Select in Field mit Sperre: disabled und Sperrgrund',
  );
}
```

- [ ] **Step 2: Testmodul einhängen** (`packages/ui/test/selftest.ts`)

Vorher:
```ts
abschluss();
```
Nachher:
```ts
import './toggle-select.test';
abschluss();
```

- [ ] **Step 3: Test laufen lassen (rot)**

Run: `npm run selftest -w @jm/ui`
Expected: Exit-Code 1, kein Test läuft (Node nennt das erste fehlende Modul):
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\packages\ui\src\components\Select' imported from …\packages\ui\test\toggle-select.test.tsx
```

- [ ] **Step 4: `Toggle` anlegen** (`packages/ui/src/components/Toggle.tsx`, neu)

```tsx
import { cn } from '../lib/cn';
import { useFeld } from './Field';

export interface ToggleProps {
  checked: boolean;
  onChange(next: boolean): void;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * Schalter an/aus (Spec 3.5): `<button role="switch" aria-checked>`. Der Zustand steckt in der Form (Knopf rechts = an,
 * links = aus) und im aria-checked, nicht nur in der Farbe. „An“ nutzt --tally-selected mit gelber Kante (E5).
 */
export function Toggle({ checked, onChange, disabled, id, className, 'aria-label': ariaLabel }: ToggleProps): React.JSX.Element {
  const feld = useFeld();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id ?? feld?.ids.input}
      aria-label={ariaLabel}
      aria-describedby={feld?.describedBy}
      aria-invalid={feld?.invalid ? true : undefined}
      disabled={disabled || feld?.gesperrt || undefined}
      data-state={checked ? 'an' : 'aus'}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex h-[var(--control-h)] w-14 shrink-0 items-center rounded-[var(--radius-full)] border-2 p-0.5',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
        'disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-colors motion-safe:duration-150',
        checked
          ? 'justify-end border-[var(--brand-yellow)] bg-[var(--tally-selected)]'
          : 'justify-start border-[var(--border)] bg-[var(--input)]',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'block h-6 w-6 rounded-[var(--radius-full)]',
          checked ? 'bg-[var(--primary-foreground)]' : 'bg-[var(--muted-foreground)]',
        )}
      />
    </button>
  );
}
```

- [ ] **Step 5: `Select` anlegen** (`packages/ui/src/components/Select.tsx`, neu)

```tsx
import { cn } from '../lib/cn';
import { selectOptionen, type SelectOption } from '../lib/eingabe';
import { EINGABE_KLASSE, useFeld } from './Field';

export interface SelectProps {
  options: readonly SelectOption[];
  value: string;
  onChange(value: string): void;
  placeholder?: string;
  /** Anzeigename eines gewählten Werts, der in `options` fehlt (z. B. das zuletzt benutzte Gerät). */
  fehlendLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * Natives Auswahlfeld (Spec 3.5; E11). Ein gewählter Wert, der in `options` fehlt, bleibt als erste Option
 * „nicht verfügbar: …“ gewählt und gesperrt – das native select springt sonst still auf eine andere Option.
 * Ein leerer Wert ohne passende Option zeigt „– bitte wählen –“ (oder `placeholder`); das leistet `selectOptionen` (Task 7).
 */
export function Select({
  options,
  value,
  onChange,
  placeholder,
  fehlendLabel,
  disabled,
  id,
  className,
  'aria-label': ariaLabel,
}: SelectProps): React.JSX.Element {
  const feld = useFeld();
  const liste = selectOptionen(options, value, { placeholder, fehlendLabel });
  return (
    <select
      id={id ?? feld?.ids.input}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      aria-label={ariaLabel}
      aria-describedby={feld?.describedBy}
      aria-invalid={feld?.invalid ? true : undefined}
      disabled={disabled || feld?.gesperrt || undefined}
      className={cn(EINGABE_KLASSE, className)}
    >
      {liste.map((o, i) => (
        <option key={i} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 6: Exporte anhängen** (`packages/ui/src/index.ts`, Dateiende)

Vorher:
```ts
export { NumberInput } from './components/NumberInput';
```
Nachher:
```ts
export { NumberInput } from './components/NumberInput';
export { Toggle } from './components/Toggle';
export { Select } from './components/Select';
```

- [ ] **Step 7: Test laufen lassen (grün)**

Run: `npm run selftest -w @jm/ui`
Expected: keine Zeile mit `FAIL`, letzte Zeile `ALLE TESTS OK`, Exit-Code 0. Die Zeilen dieser Aufgabe:
```
ok   Toggle: button type=button role=switch aria-checked true/false, data-state an/aus
ok   Toggle: Knopf-Position als Form (rechts = an, links = aus), nicht nur Farbe
ok   Toggle: h-[var(--control-h)], an = --tally-selected mit gelber Kante, aria-label durchgereicht
ok   Toggle disabled: disabled-Attribut
ok   Toggle in Field: label for → button id, Sperre setzt disabled und aria-describedby
ok   Toggle in Field: alle id-Verweise gültig
ok   Toggle in Field mit Fehler: aria-invalid=true, aria-describedby auf den Fehler
ok   Select: Optionen aus selectOptionen, gewählter Wert selected
ok   Select: natives <select>, h-[var(--control-h)], aria-label
ok   Select fehlender Wert: erste Option „nicht verfügbar: …“ disabled und selected, übrige Liste unverändert
ok   Select fehlender Wert ohne fehlendLabel: „nicht verfügbar: {value}“
ok   Select: placeholder bei value ''
ok   Select: value '' ohne placeholder → „– bitte wählen –“ statt still der ersten Option
ok   Select: gibt es eine Option '' (z. B. System-Standard), kommt kein Platzhalter dazu
ok   Select in Field: id, aria-describedby und aria-invalid
ok   Select in Field: alle id-Verweise gültig
ok   Select in Field mit Sperre: disabled und Sperrgrund
```
Zählen: `npm run selftest -w @jm/ui | grep -cE "^ok   (Toggle|Select)"` → `17`. Gesamt nach dieser Aufgabe (gemessen): `336` `ok`-Zeilen.

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck -w @jm/ui`
Expected: keine Ausgabe von `tsc`, Exit-Code 0.

- [ ] **Step 9: Mutationsprobe (ohne Commit; je eine Änderung allein, danach zurück)**

a) Toggle ohne `role="switch"`:
Vorher (`packages/ui/src/components/Toggle.tsx`):
```tsx
      role="switch"
```
Nachher: diese Zeile ersatzlos löschen.
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Toggle: button type=button role=switch aria-checked true/false, data-state an/aus
1 FEHLGESCHLAGEN
```

b) Select ohne Fehl-Option (Optionen direkt durchgereicht – der Ist-Zustand in Grafiktool und Media-Converter):
Vorher (`packages/ui/src/components/Select.tsx`):
```tsx
  const liste = selectOptionen(options, value, { placeholder, fehlendLabel });
```
Nachher:
```tsx
  const liste: Array<SelectOption & { disabled?: boolean }> = [...options];
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Select fehlender Wert: erste Option „nicht verfügbar: …“ disabled und selected, übrige Liste unverändert
     ist: [["mic-1",false,false,"Mikro 1"],["mic-2",false,false,"Mikro 2"]] soll: [["mic-9",true,true,"nicht verfügbar: USB-Mikro (alt)"],["mic-1",false,false,"Mikro 1"],["mic-2",false,false,"Mikro 2"]]
FAIL Select fehlender Wert ohne fehlendLabel: „nicht verfügbar: {value}“
     ist: ["mic-1",false,false,"Mikro 1"] soll: ["mic-9",true,true,"nicht verfügbar: mic-9"]
FAIL Select: placeholder bei value ''
     ist: ["mic-1",false,false,"Mikro 1"] soll: ["",true,false,"Gerät wählen"]
FAIL Select: value '' ohne placeholder → „– bitte wählen –“ statt still der ersten Option
     ist: ["mic-1",false,false,"Mikro 1"] soll: ["",true,false,"– bitte wählen –"]
4 FEHLGESCHLAGEN
```

c) Fehl-Option nicht gesperrt (ein nicht verfügbares Gerät ließe sich erneut wählen):
Vorher (`packages/ui/src/components/Select.tsx`):
```tsx
        <option key={i} value={o.value} disabled={o.disabled}>
```
Nachher:
```tsx
        <option key={i} value={o.value}>
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Select fehlender Wert: erste Option „nicht verfügbar: …“ disabled und selected, übrige Liste unverändert
     ist: [["mic-9",true,false,"nicht verfügbar: USB-Mikro (alt)"],["mic-1",false,false,"Mikro 1"],["mic-2",false,false,"Mikro 2"]] soll: [["mic-9",true,true,"nicht verfügbar: USB-Mikro (alt)"],["mic-1",false,false,"Mikro 1"],["mic-2",false,false,"Mikro 2"]]
FAIL Select fehlender Wert ohne fehlendLabel: „nicht verfügbar: {value}“
     ist: ["mic-9",true,false,"nicht verfügbar: mic-9"] soll: ["mic-9",true,true,"nicht verfügbar: mic-9"]
2 FEHLGESCHLAGEN
```

d) Schalter übernimmt den Fehler des Field nicht:
Vorher (`packages/ui/src/components/Toggle.tsx`):
```tsx
      aria-invalid={feld?.invalid ? true : undefined}
```
Nachher: diese Zeile ersatzlos löschen.
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Toggle in Field mit Fehler: aria-invalid=true, aria-describedby auf den Fehler
1 FEHLGESCHLAGEN
```

Nach jeder Probe die Ersetzung zurücknehmen; `npm run selftest -w @jm/ui` → wieder `ALLE TESTS OK`.

- [ ] **Step 10: Commit** (Commit-Text bewusst ohne Umlaute)

```bash
git add packages/ui/test/toggle-select.test.tsx packages/ui/src/components/Toggle.tsx packages/ui/src/components/Select.tsx packages/ui/test/selftest.ts packages/ui/src/index.ts
git status --short
```
Erwartet genau:
```
A  packages/ui/src/components/Select.tsx
A  packages/ui/src/components/Toggle.tsx
M  packages/ui/src/index.ts
M  packages/ui/test/selftest.ts
A  packages/ui/test/toggle-select.test.tsx
```
Dann:
```bash
git commit -m "feat(ui): Toggle (role switch) und Select (fehlender Wert bleibt sichtbar)" -m "Toggle ist ein button mit role=switch und aria-checked; der Zustand steckt in der Knopf-Position, an mit --tally-selected und gelber Kante. Select ist nativ; ein gewaehlter Wert, der in den Optionen fehlt, bleibt als erste Option 'nicht verfuegbar: ...' gewaehlt und gesperrt, ein leerer Wert zeigt '- bitte waehlen -' statt still der ersten Option." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Für die Galerie (Task 23) muss zu sehen sein:** `Toggle` an/aus in Dunkel und Hell (hell: dunkle Fläche mit gelber Kante), per Klick und per Leertaste umschaltbar, gesperrt gedimmt. `Select` mit vorhandenem Wert, mit fehlendem Wert („nicht verfügbar: USB-Mikro (alt)“ steht gewählt, der Wert springt beim Öffnen und Schließen nicht um), mit leerem Wert („– bitte wählen –“) und in einem Field mit Fehler und mit Sperre.

**Nachgerechnet** (Kopie wie in Task 8, `selectOptionen` nach 9.6 nachgebaut: Platzhalter nur bei `value === ''`, Fehl-Option zuerst mit `disabled`): Step 3 rot wie angegeben; Step 7 grün mit 16 `ok`-Zeilen dieser Aufgabe; Typecheck grün; Mutationsproben 11a und 11b rot wie angegeben, danach wieder grün (11c ist beim Zusammensetzen neu gemessen, siehe „Abweichungen“). Die Probe 11b zeigt den Ist-Fehler: React markiert bei einem fehlenden Wert **keine** Option als `selected`, der Browser zeigt dann still die erste. Im Probe-Bau vorhanden: `bg-[var(--tally-selected)]`, `border-[var(--brand-yellow)]`, `rounded-[var(--radius-full)]`, `justify-end`.

**Abweichungen vom Gerüst:**
1. Bei `value === ''` ohne passende Option und ohne `placeholder` steht „– bitte wählen –“ (`UI_TEXTE.bitteWaehlen`). E11 regelt nur den fehlenden Wert ≠ `''`; ohne diese Vorgabe zeigte das native `select` bei `''` still die erste Option. Beim Zusammensetzen geändert (Z1): Den Rückfall liefert allein `selectOptionen` (Task 7). Der Schreiber von Block B hatte ihn zusätzlich in `Select` gebaut, weil sein Nachbau von Task 7 ihn nicht kannte. Mit dem echten Task 7 war diese Zeile wirkungslos, und die alte Probe 11c („Kein Platzhalter bei leerem Wert“) blieb grün. Die neue Probe 11c prüft, was nur `Select` leistet: das `disabled` der Fehl-Option (gemessen 2 `FAIL`).
2. Rundung des Schalters `--radius-full` (Schalterform) statt `--radius-md` (G3).
3. Nachbesserung nach dem Review: Fall „`Toggle` in einem Field mit Fehler“ (`aria-invalid`, `aria-describedby` auf den
   Fehler) und Probe 11d; vorher blieb ein Schalter ohne `aria-invalid` grün.

**Nachgerechnet nach der Nachbesserung** (frische Kopie, Plantext Tasks 1–11 maschinell eingespielt): 17 `ok`-Zeilen dieser
Aufgabe, gesamt 324; Proben a–d rot mit 1, 4, 2, 1 `FAIL`. Nach der zweiten Nachbesserung (Tasks 3–10 geändert):
gesamt 336, eigene Zeilen und Proben unverändert.

---

### Task 12: `useTheme` und `ThemeToggle`

**Spec:** 3.7 (Dunkel Standard, Klasse `light` auf `<html>`, `jm-theme` je Tool, `try/catch`), 8, 3.8 (ohne Electron). Entscheidung E10; Regeln G4, G5.

**Arbeitsverzeichnis/Voraussetzung:** Wurzel des Worktrees. Tasks 1–11 sind committet, insbesondere `src/lib/theme.ts` (Task 7, 9.5).

**Dateien:**
- Create: `packages/ui/test/themetoggle.test.tsx`
- Create: `packages/ui/src/lib/useTheme.ts`
- Create: `packages/ui/src/components/ThemeToggle.tsx`
- Modify: `packages/ui/test/selftest.ts` (eine `import`-Zeile vor `abschluss();`)
- Modify: `packages/ui/src/index.ts` (zwei Zeilen am Ende)

**Interfaces:**
- Consumes: `themeStore`, `browserHtml`, `wendeThemeAn`, `Theme`, `THEME_SCHLUESSEL` (9.5); `UI_TEXTE.dunkel`, `UI_TEXTE.hell`, `UI_TEXTE.themeUmschalten` (9.2); `noDragRegion`; `cn`.
- Produces (9.5 und 9.7, exakt so):
  ```ts
  // packages/ui/src/lib/useTheme.ts
  export function useTheme(): { theme: Theme; setTheme(t: Theme): void; toggle(): void };
  // packages/ui/src/components/ThemeToggle.tsx
  export interface ThemeToggleProps { className?: string }
  export function ThemeToggle(p: ThemeToggleProps): React.JSX.Element;  // type="button", style={noDragRegion}
  // nur aus der Datei: alle Props des Knopfs als reine Funktion (Bindung ohne Browser prüfbar)
  export interface ThemeKnopfProps { type: 'button'; style: CSSProperties; onClick(): void; 'data-theme': Theme;
    'aria-label': string; title: string; className: string }
  export function themeKnopfProps(theme: Theme, toggle: () => void, className?: string): ThemeKnopfProps;
  ```
  Neue Zeilen in `index.ts` (9.8): `export { useTheme } from './lib/useTheme';`, `export { ThemeToggle } from './components/ThemeToggle';`.

**Verhalten (verbindlich):**
- `useTheme` liest den **einen** Store des Dokuments (`themeStore`, Task 7) über `useSyncExternalStore` (auch als Server-Snapshot: unter Node und bei jedem Fehler `dark`). Alle Aufrufe teilen den Zustand: Zwei `ThemeToggle` im selben Dokument (Galerie: eine je Spalte) zeigen nie Verschiedenes (Review-Befund). `setTheme`/`toggle` gehen an `themeStore.setze` (merkt, setzt `<html>`, meldet allen). Der Effekt `wendeThemeAn(browserHtml(), theme)` setzt beim Start den gemerkten Wert auf `<html>`. In `useTheme.ts` steht kein Speicherzugriff selbst (Quellregel: nur `lib/theme.ts`).
- `ThemeToggle` zeigt den **Zustand** („Dunkel“ mit ☾ bzw. „Hell“ mit ☀, Symbol aria-hidden), `aria-label` und `title` „Darstellung: {Zustand}. Umschalten auf {Ziel}“ (E10). `type="button"`, `style={noDragRegion}` (liegt in der Ziehfläche der Kopfzeile), Höhe `--control-h`, Hover `--muted` (E23). Alle Props kommen aus `themeKnopfProps` (Spread, kein Handler daneben); der Test ruft dessen `onClick` und prüft die Verdrahtung im Quelltext.

**Regeln für diese Aufgabe:** wie Task 8 (G9, G11, G3, G13). Das Wort für den Browser-Speicher steht in `useTheme.ts` auch nicht im Kommentar (Quellregel aus Task 3).

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`packages/ui/test/themetoggle.test.tsx`, neu)

```tsx
// Task 12 · useTheme und ThemeToggle (Spec 3.7, 8, 3.8; E10): Der Knopf zeigt den ZUSTAND („Dunkel“/„Hell“), das
// aria-label nennt Zustand und Ziel. Ohne Browser bleibt es bei Dunkel; ein gemerktes „light“ wird gelesen.
import { ThemeToggle, themeKnopfProps } from '../src/components/ThemeToggle';
import { THEME_SCHLUESSEL } from '../src/lib/theme';
import { useTheme } from '../src/lib/useTheme';
import { leseText, ok, render } from './harness';
import { attr, hatKlassen, ohneVersteckt, tags, text } from './lib/markup';

{
  const html = render(<ThemeToggle />);
  const [k] = tags(html, 'button');
  ok(
    text(ohneVersteckt(html)) === 'Dunkel' &&
      attr(k, 'aria-label') === 'Darstellung: Dunkel. Umschalten auf Hell' &&
      attr(k, 'title') === 'Darstellung: Dunkel. Umschalten auf Hell' &&
      attr(k, 'data-theme') === 'dark',
    'ThemeToggle unter Node: „Dunkel“, aria-label „Darstellung: Dunkel. Umschalten auf Hell“',
  );
  ok(
    attr(k, 'type') === 'button' && (attr(k, 'style') ?? '').includes('-webkit-app-region:no-drag'),
    'ThemeToggle: type=button, -webkit-app-region:no-drag im style',
  );
  ok(hatKlassen(k, 'h-[var(--control-h)] rounded-[var(--radius-md)]'), 'ThemeToggle: h-[var(--control-h)], rounded-[var(--radius-md)]');
}
{
  function Probe(): React.JSX.Element {
    const t = useTheme();
    return (
      <span data-theme={t.theme}>
        {typeof t.setTheme}/{typeof t.toggle}
      </span>
    );
  }
  let html = '';
  let fehler = '';
  try {
    html = render(<Probe />);
  } catch (e) {
    fehler = String(e);
  }
  ok(fehler === '' && html === '<span data-theme="dark">function/function</span>', 'useTheme ohne window wirft nicht, Vorgabe dark');
}
{
  // Browser-Speicher nachgestellt (nur für diesen Block): gemerktes „light“ → Zustand „Hell“, Ziel „Dunkel“.
  const g = globalThis as unknown as { window?: unknown };
  const speicher = new Map<string, string>([[THEME_SCHLUESSEL, 'light']]);
  g.window = {
    localStorage: {
      getItem: (k: string) => speicher.get(k) ?? null,
      setItem: (k: string, v: string) => void speicher.set(k, v),
    },
  };
  try {
    const html = render(<ThemeToggle />);
    ok(
      text(ohneVersteckt(html)) === 'Hell' && attr(tags(html, 'button')[0], 'aria-label') === 'Darstellung: Hell. Umschalten auf Dunkel',
      'ThemeToggle mit gemerktem „light“: zeigt den Zustand „Hell“, Ziel „Dunkel“',
    );
  } finally {
    delete g.window;
  }
  g.window = {
    get localStorage(): never {
      throw new Error('Speicher gesperrt');
    },
  };
  try {
    ok(text(ohneVersteckt(render(<ThemeToggle />))) === 'Dunkel', 'ThemeToggle: Speicher wirft → Dunkel');
  } finally {
    delete g.window;
  }
}
{
  let umgeschaltet = 0;
  const props = themeKnopfProps('light', () => {
    umgeschaltet++;
  });
  props.onClick();
  ok(
    umgeschaltet === 1 &&
      props.type === 'button' &&
      props['data-theme'] === 'light' &&
      props['aria-label'] === 'Darstellung: Hell. Umschalten auf Dunkel' &&
      props.title === props['aria-label'],
    'ThemeToggle Knopf-Props: Klick schaltet um, Zustand und Ziel im aria-label',
  );
}
{
  const hook = leseText('src/lib/useTheme.ts');
  const knopf = leseText('src/components/ThemeToggle.tsx');
  const fehlt = [
    [hook, 'useSyncExternalStore(themeStore.abonniere, themeStore.lies, themeStore.lies)'],
    [hook, 'useEffect(() => wendeThemeAn(browserHtml(), theme), [theme]);'],
    [knopf, '<button {...themeKnopfProps(theme, toggle, className)}>'],
  ]
    .filter(([quelle, zeile]) => quelle.split(zeile).length !== 2)
    .map(([, zeile]) => zeile);
  ok(
    fehlt.length === 0 && !/\son[A-Z]\w*=\{/.test(knopf),
    'useTheme Verdrahtung: ein Store für alle Aufrufe, <html> im Effekt, Knopf-Props per Spread',
  );
  for (const zeile of fehlt) console.log(`     fehlt: ${zeile}`);
}
```
Hinweis: Der dritte Block stellt `window.localStorage` nur für zwei Render-Aufrufe nach (`globalThis.window`, im `finally` wieder entfernt). So ist der Pfad „gemerktes light“ unter Node prüfbar; `browserSpeicher()` (Task 7) liest `window.localStorage`.

- [ ] **Step 2: Testmodul einhängen** (`packages/ui/test/selftest.ts`)

Vorher:
```ts
abschluss();
```
Nachher:
```ts
import './themetoggle.test';
abschluss();
```

- [ ] **Step 3: Test laufen lassen (rot)**

Run: `npm run selftest -w @jm/ui`
Expected: Exit-Code 1, kein Test läuft:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\packages\ui\src\components\ThemeToggle' imported from …\packages\ui\test\themetoggle.test.tsx
```

- [ ] **Step 4: `useTheme` anlegen** (`packages/ui/src/lib/useTheme.ts`, neu)

```ts
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { browserHtml, themeStore, wendeThemeAn, type Theme } from './theme';

/**
 * Hell/Dunkel je Tool (Spec 3.7, 8; E10). Alle Aufrufe teilen einen Zustand (themeStore aus lib/theme.ts): Zwei Schalter
 * im selben Dokument zeigen nie Verschiedenes. Der Store liest beim ersten Zugriff den gemerkten Wert (jeder Fehler →
 * Dunkel), merkt jede Wahl und setzt sie auf <html>; der Effekt setzt den Startwert auf <html> (Klassenvertrag der
 * index.html). Ohne Browser (Tests, Server-Rendering) bleibt es bei Dunkel und fasst nichts an.
 */
export function useTheme(): { theme: Theme; setTheme(t: Theme): void; toggle(): void } {
  const theme = useSyncExternalStore(themeStore.abonniere, themeStore.lies, themeStore.lies);
  useEffect(() => wendeThemeAn(browserHtml(), theme), [theme]);
  const setTheme = useCallback((t: Theme) => themeStore.setze(t), []);
  const toggle = useCallback(() => themeStore.setze(themeStore.lies() === 'dark' ? 'light' : 'dark'), []);
  return { theme, setTheme, toggle };
}
```

- [ ] **Step 5: `ThemeToggle` anlegen** (`packages/ui/src/components/ThemeToggle.tsx`, neu)

```tsx
import type { CSSProperties } from 'react';
import { cn } from '../lib/cn';
import { UI_TEXTE } from '../lib/texte';
import type { Theme } from '../lib/theme';
import { noDragRegion } from '../lib/titlebar';
import { useTheme } from '../lib/useTheme';

export interface ThemeToggleProps {
  className?: string;
}

/** Alle Props des Schalters (E10). Nur aus dieser Datei exportiert. */
export interface ThemeKnopfProps {
  type: 'button';
  style: CSSProperties;
  onClick(): void;
  'data-theme': Theme;
  'aria-label': string;
  title: string;
  className: string;
}

/**
 * Props des Schalters als reine Funktion: Zustand in data-theme, aria-label und title „Darstellung: {Zustand}. Umschalten
 * auf {Ziel}“, Klick → toggle, noDragRegion (liegt in der Ziehfläche der Kopfzeile). Nur aus dieser Datei exportiert.
 */
export function themeKnopfProps(theme: Theme, toggle: () => void, className?: string): ThemeKnopfProps {
  const dunkel = theme === 'dark';
  const beschreibung = UI_TEXTE.themeUmschalten(dunkel ? UI_TEXTE.dunkel : UI_TEXTE.hell, dunkel ? UI_TEXTE.hell : UI_TEXTE.dunkel);
  return {
    type: 'button',
    style: noDragRegion,
    onClick: () => toggle(),
    'data-theme': theme,
    'aria-label': beschreibung,
    title: beschreibung,
    className: cn(
      'inline-flex h-[var(--control-h)] items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-2.5',
      'text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
      'motion-safe:transition-colors motion-safe:duration-150',
      className,
    ),
  };
}

/**
 * Hell/Dunkel-Schalter für die Kopfzeile (Spec 3.7; E10). Zeigt den ZUSTAND („Dunkel“ ☾ / „Hell“ ☀), nicht das Ziel;
 * aria-label und title nennen beides.
 */
export function ThemeToggle({ className }: ThemeToggleProps): React.JSX.Element {
  const { theme, toggle } = useTheme();
  const dunkel = theme === 'dark';
  const jetzt = dunkel ? UI_TEXTE.dunkel : UI_TEXTE.hell;
  return (
    <button {...themeKnopfProps(theme, toggle, className)}>
      <span aria-hidden="true">{dunkel ? '☾' : '☀'}</span>
      <span>{jetzt}</span>
    </button>
  );
}
```

- [ ] **Step 6: Exporte anhängen** (`packages/ui/src/index.ts`, Dateiende)

Vorher:
```ts
export { Select } from './components/Select';
```
Nachher:
```ts
export { Select } from './components/Select';
export { useTheme } from './lib/useTheme';
export { ThemeToggle } from './components/ThemeToggle';
```

- [ ] **Step 7: Test laufen lassen (grün)**

Run: `npm run selftest -w @jm/ui`
Expected: keine Zeile mit `FAIL`, letzte Zeile `ALLE TESTS OK`, Exit-Code 0. Die Zeilen dieser Aufgabe:
```
ok   ThemeToggle unter Node: „Dunkel“, aria-label „Darstellung: Dunkel. Umschalten auf Hell“
ok   ThemeToggle: type=button, -webkit-app-region:no-drag im style
ok   ThemeToggle: h-[var(--control-h)], rounded-[var(--radius-md)]
ok   useTheme ohne window wirft nicht, Vorgabe dark
ok   ThemeToggle mit gemerktem „light“: zeigt den Zustand „Hell“, Ziel „Dunkel“
ok   ThemeToggle: Speicher wirft → Dunkel
ok   ThemeToggle Knopf-Props: Klick schaltet um, Zustand und Ziel im aria-label
ok   useTheme Verdrahtung: ein Store für alle Aufrufe, <html> im Effekt, Knopf-Props per Spread
```
Zählen: `npm run selftest -w @jm/ui | grep -cE "^ok   (ThemeToggle|useTheme)"` → `8`. Gesamt nach dieser Aufgabe (gemessen): `344` `ok`-Zeilen.

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck -w @jm/ui`
Expected: keine Ausgabe von `tsc`, Exit-Code 0.

- [ ] **Step 9: Mutationsprobe (ohne Commit; je eine Änderung allein, danach zurück)**

a) Beschriftung zeigt das Ziel statt des Zustands (Ist-Fehler der zehn lokalen Knöpfe):
Vorher (`packages/ui/src/components/ThemeToggle.tsx`):
```tsx
      <span>{jetzt}</span>
```
Nachher:
```tsx
      <span>{dunkel ? UI_TEXTE.hell : UI_TEXTE.dunkel}</span>
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL ThemeToggle unter Node: „Dunkel“, aria-label „Darstellung: Dunkel. Umschalten auf Hell“
FAIL ThemeToggle mit gemerktem „light“: zeigt den Zustand „Hell“, Ziel „Dunkel“
FAIL ThemeToggle: Speicher wirft → Dunkel
3 FEHLGESCHLAGEN
```

b) Ohne `noDragRegion` (im Electron-Fenster nicht klickbar):
Vorher (`packages/ui/src/components/ThemeToggle.tsx`):
```tsx
    style: noDragRegion,
```
Nachher: diese Zeile ersatzlos löschen.
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL ThemeToggle: type=button, -webkit-app-region:no-drag im style
1 FEHLGESCHLAGEN
```

c) Ohne Gedächtnis (Ist-Zustand der zehn Knöpfe: immer Dunkel beim Start):
Vorher (`packages/ui/src/lib/useTheme.ts`):
```ts
useSyncExternalStore(themeStore.abonniere, themeStore.lies, themeStore.lies)
```
Nachher:
```ts
useSyncExternalStore(themeStore.abonniere, themeStore.lies, () => 'dark' as const)
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL ThemeToggle mit gemerktem „light“: zeigt den Zustand „Hell“, Ziel „Dunkel“
FAIL useTheme Verdrahtung: ein Store für alle Aufrufe, <html> im Effekt, Knopf-Props per Spread
     fehlt: useSyncExternalStore(themeStore.abonniere, themeStore.lies, themeStore.lies)
2 FEHLGESCHLAGEN
```

d) Klick schaltet nicht um:
Vorher (`packages/ui/src/components/ThemeToggle.tsx`):
```tsx
    onClick: () => toggle(),
```
Nachher:
```tsx
    onClick: () => undefined,
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL ThemeToggle Knopf-Props: Klick schaltet um, Zustand und Ziel im aria-label
1 FEHLGESCHLAGEN
```

e) Jeder Aufruf mit eigenem Zustand (alte Fassung, zwei Schalter zeigten Verschiedenes):
Vorher (`packages/ui/src/lib/useTheme.ts`):
```ts
  const theme = useSyncExternalStore(themeStore.abonniere, themeStore.lies, themeStore.lies);
```
Nachher:
```ts
  const [theme] = useState(themeStore.lies);
```
(dazu `useState` statt `useSyncExternalStore` importieren). Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL useTheme Verdrahtung: ein Store für alle Aufrufe, <html> im Effekt, Knopf-Props per Spread
     fehlt: useSyncExternalStore(themeStore.abonniere, themeStore.lies, themeStore.lies)
1 FEHLGESCHLAGEN
```

Nach jeder Probe die Ersetzung zurücknehmen; `npm run selftest -w @jm/ui` → wieder `ALLE TESTS OK`.

- [ ] **Step 10: Commit** (Commit-Text bewusst ohne Umlaute)

```bash
git add packages/ui/test/themetoggle.test.tsx packages/ui/src/lib/useTheme.ts packages/ui/src/components/ThemeToggle.tsx packages/ui/test/selftest.ts packages/ui/src/index.ts
git status --short
```
Erwartet genau:
```
A  packages/ui/src/components/ThemeToggle.tsx
M  packages/ui/src/index.ts
A  packages/ui/src/lib/useTheme.ts
M  packages/ui/test/selftest.ts
A  packages/ui/test/themetoggle.test.tsx
```
Dann:
```bash
git commit -m "feat(ui): useTheme und ThemeToggle - gemerkt je Tool, Dunkel als Rueckfall" -m "useTheme liest den gemerkten Wert (jm-theme) lazy ueber lib/theme.ts, jeder Fehler ergibt Dunkel; der Effekt setzt genau eine der Klassen dark/light auf html. ThemeToggle zeigt den Zustand (Dunkel/Hell) statt des Ziels, aria-label nennt beides, liegt mit noDragRegion in der Ziehflaeche." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Für die Galerie (Task 23) muss zu sehen sein:** Ein Klick auf den `ThemeToggle` wechselt die Klasse auf `<html>` zwischen `dark` und `light` (Entwicklerwerkzeuge: genau eine der beiden), die Beschriftung zeigt danach den neuen Zustand – **auf beiden** Schaltern der Galerie (je Spalte einer). Nach Neuladen der Seite bleibt der gewählte Modus. Mit gesperrtem Speicher (z. B. privates Fenster mit blockierten Website-Daten) startet die Galerie in Dunkel ohne Fehler in der Konsole, und das Umschalten wirkt trotzdem bis zum Neuladen (Owner-Prüfpunkt 4).

**Nachgerechnet** (Kopie wie in Task 8, `theme.ts` nach 9.5 nachgebaut, `browserSpeicher()` liest `window.localStorage` in `try/catch`): Step 3 rot wie angegeben; Step 7 grün mit 6 `ok`-Zeilen dieser Aufgabe; Typecheck grün; drei Mutationsproben rot wie angegeben, danach wieder grün. **Nach der Nachbesserung** (frische Kopie, Plantext Tasks 1–12): 8 `ok`-Zeilen dieser Aufgabe, gesamt 332, Proben a–e rot mit 3, 1, 2, 1, 1 `FAIL` (nach der zweiten Nachbesserung gesamt 344, sonst gleich). Das React-Server-Rendering schreibt `style={noDragRegion}` als `style="-webkit-app-region:no-drag"` (gemessen).

**Abweichungen vom Gerüst:**
1. Zusätzlicher Testfall mit nachgestelltem `window.localStorage` (gemerktes „light“, Speicher wirft). Die Gliederung sah nur den Fall „unter Node → Dunkel“ vor; der fängt eine Beschriftung, die das Ziel zeigt, nur im Dunkel-Fall und einen Hook ohne Gedächtnis gar nicht (Probe 12c).
2. Nachbesserung nach dem Review: `useTheme` liest den Store `themeStore` (Task 7) über `useSyncExternalStore` statt eines eigenen `useState` je Aufruf (vorher zeigten zwei Schalter nach einem Klick Verschiedenes). `themeKnopfProps` (nur aus der Datei) macht die Bindung prüfbar; gemessen blieben vorher ein Hook, der nichts schreibt oder `<html>` nicht setzt, und ein Knopf ohne `onClick` grün.

---

### Task 13: `SettingsPanel` und `PanelAnker`

**Spec:** 3.1 (Panel rechts neben dem Inhalt, 360 px, unter 900 px über dem Inhalt; Escape nur bei Fokus im Panel), 3.6 (Titel, Schließen-Knopf, Sprung, kurze Hervorhebung), 4.3 (Fläche `--surface-raised`). Entscheidungen E7, E8; Regeln G3, G4, G8.

**Arbeitsverzeichnis/Voraussetzung:** Wurzel des Worktrees. Tasks 1–12 sind committet (`zahlTaste` aus Task 10 wird im Test genutzt).

**Dateien:**
- Create: `packages/ui/test/panel.test.tsx`
- Create: `packages/ui/src/components/SettingsPanel.tsx`
- Modify: `packages/ui/test/selftest.ts` (eine `import`-Zeile vor `abschluss();`)
- Modify: `packages/ui/src/index.ts` (eine Zeile am Ende)

**Interfaces:**
- Consumes: `UI_TEXTE.einstellungen`, `UI_TEXTE.einstellungenSchliessen` (9.2); `noDragRegion`; `cn`; im Test `zahlTaste` (Task 10).
- Produces (9.7, exakt so; Block C nutzt `PanelAnker` in `SectionFrame`):
  ```ts
  // packages/ui/src/components/SettingsPanel.tsx
  export const PANEL_HERVORHEBUNG_MS = 1500;
  export interface SettingsPanelProps { open: boolean; onClose(): void; sectionId?: string; id?: string; children: ReactNode }
  export function SettingsPanel(p: SettingsPanelProps): React.JSX.Element | null;  // zu → null
  export interface PanelAnkerProps { id: string; className?: string; children: ReactNode }
  export function PanelAnker(p: PanelAnkerProps): React.JSX.Element;  // <div id={`einstellung-${id}`} data-section-id={id} data-hervorgehoben="true|false">
  export function useSettingsPanel(): { hervorgehoben?: string };
  export function panelTaste(e: { key: string; defaultPrevented: boolean; stopPropagation(): void; preventDefault(): void },
    onClose: () => void): void;   // nur aus der Datei
  // nur aus der Datei: Props des <aside> und die Körper der beiden Effekte als reine Funktionen
  export interface PanelProps { id?: string; 'aria-label': string; tabIndex: -1; style: CSSProperties;
    onKeyDown(e: PanelTaste): void; className: string }
  export function panelProps(p: { id?: string; onClose(): void }): PanelProps;
  export interface FokusZiel { focus(o?: { preventScroll?: boolean }): void }
  export interface FokusPanel extends FokusZiel { contains(ziel: unknown): boolean }
  export function panelFokus(panel: FokusPanel | null, aktiv: () => FokusZiel | null): () => void;
  export interface ZeitGeber { setTimeout(f: () => void, ms: number): unknown; clearTimeout(id: unknown): void }
  export function panelSprung(sectionId: string | undefined,
    anker: (id: string) => { scrollIntoView(o: { block: 'nearest' }): void } | undefined,
    setze: (id: string | undefined) => void, zeit?: ZeitGeber): (() => void) | undefined;
  ```
  Pflichtklassen: `w-[var(--panel-w)]`, `bg-[var(--surface-raised)]`, `max-[900px]:absolute`.
  Neue Zeile in `index.ts` (9.8): `export { SettingsPanel, PanelAnker, useSettingsPanel } from './components/SettingsPanel';`.

**Verhalten (verbindlich):**
- Zu: nichts gerendert (`null`). Offen: `<aside id aria-label="Einstellungen" tabindex="-1" style={noDragRegion}>` mit Kopf (Überschrift „Einstellungen“, Schließen-Knopf ✕ mit `aria-label` „Einstellungen schließen“) und einem scrollbaren Bereich für die Abschnitte. Breite `--panel-w`, Fläche `--surface-raised`, linker Rand; unter 900 px Fensterbreite `absolute` am rechten Rand über dem Inhalt (E7, reine CSS-Variante `max-[900px]:`).
- Hervorhebung: Beim Öffnen ist `hervorgehoben = sectionId` (schon im ersten Render), ein Effekt scrollt den Anker im eigenen Panel in Sicht (`scrollIntoView({ block: 'nearest' })`, gesucht über `data-section-id`, nicht über die globale id) und löscht die Hervorhebung nach `PANEL_HERVORHEBUNG_MS`. Ändert sich `sectionId` bei offenem Panel, beginnt es neu.
- `PanelAnker`: `<div id="einstellung-{id}" data-section-id data-hervorgehoben>`; hervorgehoben **nur** mit Rand `--tally-selected` (keine Fläche: gedämpfte Schrift auf `--highlight` über der Panel-Fläche erreicht nur 3,60 : 1, E23), sonst durchsichtiger Rand (kein Springen der Größe).
- Bindung über reine Funktionen: `panelProps` liefert alle Props des `<aside>` (Escape über `panelTaste`); der Fokus-Effekt ruft nur `panelFokus`, der Sprung-Effekt nur `panelSprung` (hervorheben, Anker in Sicht, nach `PANEL_HERVORHEBUNG_MS` enden, Aufräumen löscht die Uhr). Der Test prüft die Funktionen mit nachgestellten Elementen und Uhr sowie die Verdrahtung im Quelltext; dass React die Effekte ausführt, ist Owner-Prüfpunkt 5.
- Escape (E8): `onKeyDown` am Panel ruft `panelTaste`: nur `Escape` und nur, wenn nicht `defaultPrevented` → `stopPropagation()`, `preventDefault()`, `onClose()`. Fokus außerhalb → das Panel bekommt die Taste gar nicht, Escape gehört dem Tool.
- Fokus: nicht modal (keine Fokusfalle). Beim Öffnen kommt der Fokus aufs Panel; beim Schließen geht er dorthin zurück, wo er vor dem Öffnen war (⚙ oder Statuseintrag) – nur, wenn er im Panel lag. Das läuft in einem Layout-Effekt (vor dem Entfernen aus dem DOM), auf dem Server im gewöhnlichen Effekt (React 18.3 warnt sonst bei `useLayoutEffect` auf dem Server, gemessen).

**Regeln für diese Aufgabe:** wie Task 8 (G9, G11, G3, G13). `document` nur in Effekten bzw. hinter `typeof` (G4).

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`packages/ui/test/panel.test.tsx`, neu)

```tsx
// Task 13 · SettingsPanel und PanelAnker (Spec 3.1, 3.6, 4.3; E7, E8): Titel und Schließen-Knopf, Sprungziel mit
// Hervorhebung, Escape nur bei Fokus im Panel (und nicht, wenn eine Eingabe die Taste schon verbraucht hat).
import { zahlTaste } from '../src/components/NumberInput';
import {
  PANEL_HERVORHEBUNG_MS,
  PanelAnker,
  SettingsPanel,
  panelFokus,
  panelProps,
  panelSprung,
  panelTaste,
  useSettingsPanel,
} from '../src/components/SettingsPanel';
import { gleich, leseText, ok, render } from './harness';
import { attr, hatKlassen, tags, text, zwischen } from './lib/markup';

const nichts = (): void => undefined;
/** [data-section-id, data-hervorgehoben] aller Anker in Reihenfolge. */
const anker = (html: string): Array<[string | undefined, string | undefined]> =>
  tags(html, 'div')
    .filter((t) => attr(t, 'data-section-id') !== undefined)
    .map((t) => [attr(t, 'data-section-id'), attr(t, 'data-hervorgehoben')]);

{
  const html = render(
    <SettingsPanel open={false} onClose={nichts}>
      <p>Inhalt</p>
    </SettingsPanel>,
  );
  ok(html === '', 'Panel zu → nichts gerendert');
}
{
  const html = render(
    <SettingsPanel open onClose={nichts} id="panel-1">
      <PanelAnker id="ndi">NDI</PanelAnker>
    </SettingsPanel>,
  );
  const [aside] = tags(html, 'aside');
  ok(
    attr(aside, 'aria-label') === 'Einstellungen' && attr(aside, 'id') === 'panel-1' && attr(aside, 'tabindex') === '-1' &&
      text(zwischen(html, '<h2', '</h2>').replace(/^[^>]*>/, '')) === 'Einstellungen',
    'Panel offen: <aside aria-label="Einstellungen" tabindex="-1">, Überschrift „Einstellungen“',
  );
  const [schliessen] = tags(html, 'button');
  ok(
    attr(schliessen, 'type') === 'button' && attr(schliessen, 'aria-label') === 'Einstellungen schließen',
    'Panel: Schließen-Knopf aria-label „Einstellungen schließen“',
  );
  ok(
    hatKlassen(aside, 'w-[var(--panel-w)] bg-[var(--surface-raised)] max-[900px]:absolute shrink-0'),
    'Panel: w-[var(--panel-w)], bg-[var(--surface-raised)], max-[900px]:absolute',
  );
  ok((attr(aside, 'style') ?? '').includes('-webkit-app-region:no-drag'), 'Panel: no-drag im style');
}
{
  const html = render(
    <SettingsPanel open onClose={nichts} sectionId="iveo">
      <PanelAnker id="ndi">a</PanelAnker>
      <PanelAnker id="iveo">b</PanelAnker>
      <PanelAnker id="datalink">c</PanelAnker>
    </SettingsPanel>,
  );
  gleich(
    anker(html),
    [
      ['ndi', 'false'],
      ['iveo', 'true'],
      ['datalink', 'false'],
    ],
    'Panel sectionId → nur dieser Anker data-hervorgehoben=true',
  );
  const iveo = tags(html, 'div').find((t) => attr(t, 'data-section-id') === 'iveo') ?? '';
  ok(hatKlassen(iveo, 'border-[var(--tally-selected)] rounded-[var(--radius-lg)]'), 'Panel: hervorgehobener Anker mit Rand --tally-selected');
  const ohne = render(
    <SettingsPanel open onClose={nichts}>
      <PanelAnker id="ndi">a</PanelAnker>
    </SettingsPanel>,
  );
  gleich(anker(ohne), [['ndi', 'false']], 'Panel ohne sectionId: kein Anker hervorgehoben');
}
{
  const html = render(<PanelAnker id="ndi">x</PanelAnker>);
  const [tag] = tags(html, 'div');
  ok(
    attr(tag, 'id') === 'einstellung-ndi' && attr(tag, 'data-section-id') === 'ndi' && attr(tag, 'data-hervorgehoben') === 'false',
    'PanelAnker ohne Panel: id einstellung-<id>, nicht hervorgehoben',
  );
  function Zeige(): React.JSX.Element {
    return <span>{useSettingsPanel().hervorgehoben ?? '-'}</span>;
  }
  gleich(
    [
      render(<Zeige />),
      render(
        <SettingsPanel open onClose={nichts} sectionId="iveo">
          <Zeige />
        </SettingsPanel>,
      ).includes('<span>iveo</span>'),
    ],
    ['<span>-</span>', true],
    'useSettingsPanel: außerhalb leer, im Panel die hervorgehobene id',
  );
  ok(PANEL_HERVORHEBUNG_MS === 1500, 'Panel: Hervorhebung dauert 1500 ms');
}

// ── Escape (panelTaste) ──
{
  const protokoll: string[] = [];
  const taste = (key: string, defaultPrevented = false) => ({
    key,
    defaultPrevented,
    stopPropagation: () => void protokoll.push('stop'),
    preventDefault: () => void protokoll.push('prevent'),
  });
  const zu = () => void protokoll.push('zu');
  panelTaste(taste('Escape'), zu);
  gleich(protokoll, ['stop', 'prevent', 'zu'], 'panelTaste Escape → stopPropagation, preventDefault, onClose');
  protokoll.length = 0;
  panelTaste(taste('Enter'), zu);
  panelTaste(taste('a'), zu);
  gleich(protokoll, [], 'panelTaste andere Taste → nichts');
  panelTaste(taste('Escape', true), zu);
  gleich(protokoll, [], 'panelTaste defaultPrevented → nichts (Escape gehört schon jemand anderem)');
}
{
  // E8: Ein Zahlenfeld mit geändertem Entwurf verbraucht Escape – das Panel bleibt offen.
  let zu = 0;
  const ereignis = {
    key: 'Escape',
    defaultPrevented: false,
    stopPropagation: nichts,
    preventDefault() {
      ereignis.defaultPrevented = true;
    },
  };
  zahlTaste(ereignis, () => ({ verbraucht: true }));
  panelTaste(ereignis, () => void zu++);
  ok(zu === 0, 'Panel: Escape, das ein Zahlenfeld verbraucht hat, schließt das Panel nicht');
}

// ── Props und Effekt-Körper (die Effekte selbst laufen nur im Browser) ──
{
  let zu = 0;
  const protokoll: string[] = [];
  const props = panelProps({ id: 'p', onClose: () => void zu++ });
  props.onKeyDown({
    key: 'Escape',
    defaultPrevented: false,
    stopPropagation: () => void protokoll.push('stop'),
    preventDefault: () => void protokoll.push('prevent'),
  });
  ok(
    zu === 1 && protokoll.join(' ') === 'stop prevent' && props['aria-label'] === 'Einstellungen' && props.tabIndex === -1 && props.id === 'p',
    'Panel-Props: Escape am Panel schließt (panelTaste), aria-label „Einstellungen“, tabIndex -1, id',
  );
}
{
  const log: string[] = [];
  const ziel = (name: string) => ({ focus: () => void log.push(`fokus ${name}`) });
  const zahnrad = ziel('zahnrad');
  const feldImPanel = ziel('feld');
  const panel = { ...ziel('panel'), contains: (z: unknown) => z === feldImPanel };
  let aktiv: { focus(): void } | null = zahnrad;
  const zurueck = panelFokus(panel, () => aktiv);
  aktiv = feldImPanel;
  zurueck();
  const imPanel = [...log];
  log.length = 0;
  aktiv = zahnrad;
  const zurueck2 = panelFokus(panel, () => aktiv);
  aktiv = ziel('inhalt');
  zurueck2();
  gleich(
    [imPanel, log],
    [['fokus panel', 'fokus zahnrad'], ['fokus panel']],
    'Panel-Fokus: beim Öffnen aufs Panel; beim Schließen zurück zum ⚙ – nur, wenn der Fokus im Panel lag',
  );
}
{
  const gesetzt: Array<string | undefined> = [];
  const gescrollt: string[] = [];
  const uhr: Array<{ f: () => void; ms: number }> = [];
  let geloescht: unknown = 'nichts';
  const zeit = {
    setTimeout: (f: () => void, ms: number) => {
      uhr.push({ f, ms });
      return 42;
    },
    clearTimeout: (id: unknown) => {
      geloescht = id;
    },
  };
  const anker = (id: string) => ({ scrollIntoView: () => void gescrollt.push(id) });
  const aufraeumen = panelSprung('iveo', anker, (id) => void gesetzt.push(id), zeit);
  uhr[0]?.f();
  aufraeumen?.();
  const ohne = panelSprung(undefined, anker, (id) => void gesetzt.push(id), zeit);
  gleich(
    [gesetzt, gescrollt, uhr.map((u) => u.ms), geloescht, ohne],
    [['iveo', undefined, undefined], ['iveo'], [1500], 42, undefined],
    'Panel-Sprung: hervorheben, Anker in Sicht, nach 1500 ms enden; Aufräumen löscht die Uhr; ohne Abschnitt nur zurücksetzen',
  );
}
{
  const quelle = leseText('src/components/SettingsPanel.tsx');
  const fehlt = [
    'useLayoutEffektImBrowser(() => panelFokus(panelRef.current, aktivesElement), []);',
    'useEffect(() => panelSprung(sectionId, (ziel) => ankerIn(panelRef.current, ziel), setHervorgehoben), [sectionId]);',
    '<aside ref={panelRef} {...panelProps({ id, onClose })}>',
  ].filter((zeile) => quelle.split(zeile).length !== 2);
  ok(fehlt.length === 0, 'Panel Verdrahtung: Fokus- und Sprung-Effekt, Panel-Props per Spread (je genau einmal)');
  for (const zeile of fehlt) console.log(`     fehlt: ${zeile}`);
}
```

- [ ] **Step 2: Testmodul einhängen** (`packages/ui/test/selftest.ts`)

Vorher:
```ts
abschluss();
```
Nachher:
```ts
import './panel.test';
abschluss();
```

- [ ] **Step 3: Test laufen lassen (rot)**

Run: `npm run selftest -w @jm/ui`
Expected: Exit-Code 1, kein Test läuft:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\packages\ui\src\components\SettingsPanel' imported from …\packages\ui\test\panel.test.tsx
```

- [ ] **Step 4: `SettingsPanel` anlegen** (`packages/ui/src/components/SettingsPanel.tsx`, neu)

```tsx
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { UI_TEXTE } from '../lib/texte';
import { noDragRegion } from '../lib/titlebar';

/** So lange bleibt der angesprungene Abschnitt hervorgehoben (Spec 3.6 „kurz“). */
export const PANEL_HERVORHEBUNG_MS = 1500;

export interface SettingsPanelProps {
  open: boolean;
  onClose(): void;
  /** Beim Öffnen anzuspringender Abschnitt (id eines PanelAnker). */
  sectionId?: string;
  id?: string;
  children: ReactNode;
}

export interface PanelAnkerProps {
  id: string;
  className?: string;
  children: ReactNode;
}

const PanelKontext = createContext<{ hervorgehoben?: string }>({});

/** Welcher Abschnitt gerade hervorgehoben ist (außerhalb eines Panels: keiner). */
export function useSettingsPanel(): { hervorgehoben?: string } {
  return useContext(PanelKontext);
}

/**
 * Escape im Panel (E8): schließt, wenn die Taste noch niemandem gehört (nicht defaultPrevented), und hält sie vom Tool
 * fern. Hängt am Panel selbst, greift also nur, wenn der Fokus im Panel liegt. Nur aus dieser Datei exportiert.
 */
export function panelTaste(
  e: { key: string; defaultPrevented: boolean; stopPropagation(): void; preventDefault(): void },
  onClose: () => void,
): void {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  e.stopPropagation();
  e.preventDefault();
  onClose();
}

/** Ein Tastenereignis, wie panelTaste es braucht (React.KeyboardEvent passt). */
export type PanelTaste = Parameters<typeof panelTaste>[0];

/** Alle Props des <aside> (E7, E8). Nur aus dieser Datei exportiert. */
export interface PanelProps {
  id?: string;
  'aria-label': string;
  tabIndex: -1;
  style: CSSProperties;
  onKeyDown(e: PanelTaste): void;
  className: string;
}

/** Props des Panels als reine Funktion: aria-label „Einstellungen“, Fokusziel, noDragRegion, Escape über panelTaste. */
export function panelProps(p: { id?: string; onClose(): void }): PanelProps {
  return {
    id: p.id,
    'aria-label': UI_TEXTE.einstellungen,
    tabIndex: -1,
    style: noDragRegion,
    onKeyDown: (e) => panelTaste(e, p.onClose),
    className: cn(
      'flex h-full w-[var(--panel-w)] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface-raised)]',
      'text-[var(--foreground)] outline-none',
      'max-[900px]:absolute max-[900px]:inset-y-0 max-[900px]:right-0 max-[900px]:z-20 max-[900px]:shadow-xl',
    ),
  };
}

/** Was panelFokus von einem Element braucht (HTMLElement passt). */
export interface FokusZiel {
  focus(o?: { preventScroll?: boolean }): void;
}
export interface FokusPanel extends FokusZiel {
  contains(ziel: unknown): boolean;
}

/**
 * Körper des Fokus-Effekts (E8): Fokus beim Öffnen aufs Panel; das Aufräumen gibt ihn dorthin zurück, wo er vorher war
 * (⚙ oder Statuseintrag) – nur, wenn er im Panel lag. Nicht modal. Nur aus dieser Datei exportiert.
 */
export function panelFokus(panel: FokusPanel | null, aktiv: () => FokusZiel | null): () => void {
  const vorher = aktiv();
  panel?.focus({ preventScroll: true });
  return () => {
    if (panel && panel.contains(aktiv())) vorher?.focus();
  };
}

/** Was panelSprung von der Uhr braucht (setTimeout/clearTimeout passen). */
export interface ZeitGeber {
  setTimeout(f: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

const ECHTE_ZEIT: ZeitGeber = {
  setTimeout: (f, ms) => setTimeout(f, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/**
 * Körper des Sprung-Effekts (Spec 3.6): Abschnitt hervorheben, seinen Anker in Sicht holen und die Hervorhebung nach
 * PANEL_HERVORHEBUNG_MS beenden. Liefert das Aufräumen; ein neuer Sprung beginnt von vorn. Nur aus dieser Datei exportiert.
 */
export function panelSprung(
  sectionId: string | undefined,
  anker: (id: string) => { scrollIntoView(o: { block: 'nearest' }): void } | undefined,
  setze: (id: string | undefined) => void,
  zeit: ZeitGeber = ECHTE_ZEIT,
): (() => void) | undefined {
  setze(sectionId);
  if (!sectionId) return undefined;
  anker(sectionId)?.scrollIntoView({ block: 'nearest' });
  const ende = zeit.setTimeout(() => setze(undefined), PANEL_HERVORHEBUNG_MS);
  return () => zeit.clearTimeout(ende);
}

/** Das Element mit dem Fokus (nur aus Effekten gerufen, also nur im Browser). */
function aktivesElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

/** Anker im eigenen Panel über data-section-id (dieselbe globale id kann es in der Galerie zweimal geben). */
function ankerIn(panel: HTMLElement | null, ziel: string): HTMLElement | undefined {
  return Array.from(panel?.querySelectorAll<HTMLElement>('[data-section-id]') ?? []).find((el) => el.dataset.sectionId === ziel);
}

// Fokus-Rückgabe muss laufen, bevor React das Panel aus dem DOM nimmt (sonst liegt der Fokus schon auf <body>);
// auf dem Server gibt es keinen Layout-Effekt, deshalb dort der gewöhnliche Effekt (der dort ebenfalls nicht läuft).
const useLayoutEffektImBrowser = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Seitenpanel „Einstellungen“ (Spec 3.1, 3.6): rechts neben dem Inhalt, 360 px (--panel-w), unter 900 px Fensterbreite
 * über dem Inhalt (E7). Springt beim Öffnen zu `sectionId` und hebt ihn PANEL_HERVORHEBUNG_MS lang hervor. Nicht modal:
 * keine Fokusfalle; der Fokus kommt beim Öffnen aufs Panel und geht beim Schließen dorthin zurück, wo er vorher war
 * (⚙ oder Statuseintrag) – aber nur, wenn er im Panel lag. Zu: nichts gerendert.
 */
export function SettingsPanel(p: SettingsPanelProps): React.JSX.Element | null {
  if (!p.open) return null;
  return <OffenesPanel {...p} />;
}

function OffenesPanel({ onClose, sectionId, id, children }: SettingsPanelProps): React.JSX.Element {
  const panelRef = useRef<HTMLElement>(null);
  const [hervorgehoben, setHervorgehoben] = useState<string | undefined>(sectionId);
  useLayoutEffektImBrowser(() => panelFokus(panelRef.current, aktivesElement), []);
  useEffect(() => panelSprung(sectionId, (ziel) => ankerIn(panelRef.current, ziel), setHervorgehoben), [sectionId]);

  return (
    <aside ref={panelRef} {...panelProps({ id, onClose })}>
      <div className="flex h-[var(--header-h)] shrink-0 items-center gap-2 border-b border-[var(--border)] px-4">
        <h2 className="text-sm font-extrabold">{UI_TEXTE.einstellungen}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={UI_TEXTE.einstellungenSchliessen}
          title={UI_TEXTE.einstellungenSchliessen}
          className={cn(
            'ml-auto inline-flex h-[var(--control-h)] w-[var(--control-h)] items-center justify-center rounded-[var(--radius-md)]',
            'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
            'motion-safe:transition-colors motion-safe:duration-150',
          )}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
      <PanelKontext.Provider value={{ hervorgehoben }}>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">{children}</div>
      </PanelKontext.Provider>
    </aside>
  );
}

/**
 * Sprungziel eines Abschnitts im Panel (id `einstellung-<id>`). Ist er der angesprungene, trägt er kurz einen Rand in
 * --tally-selected („ausgewählt“) und data-hervorgehoben="true" – ohne Fläche, damit gedämpfte Schrift lesbar bleibt (E23).
 */
export function PanelAnker({ id, className, children }: PanelAnkerProps): React.JSX.Element {
  const { hervorgehoben } = useSettingsPanel();
  const an = hervorgehoben !== undefined && hervorgehoben === id;
  return (
    <div
      id={`einstellung-${id}`}
      data-section-id={id}
      data-hervorgehoben={an ? 'true' : 'false'}
      className={cn(
        'scroll-mt-2 rounded-[var(--radius-lg)] border-2 p-2 motion-safe:transition-colors motion-safe:duration-150',
        an ? 'border-[var(--tally-selected)]' : 'border-transparent',
        className,
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Export anhängen** (`packages/ui/src/index.ts`, Dateiende)

Vorher:
```ts
export { ThemeToggle } from './components/ThemeToggle';
```
Nachher:
```ts
export { ThemeToggle } from './components/ThemeToggle';
export { SettingsPanel, PanelAnker, useSettingsPanel } from './components/SettingsPanel';
```

- [ ] **Step 6: Test laufen lassen (grün)**

Run: `npm run selftest -w @jm/ui`
Expected: keine Zeile mit `FAIL`, letzte Zeile `ALLE TESTS OK`, keine Zeile `Warning: useLayoutEffect …`, Exit-Code 0. Die Zeilen dieser Aufgabe:
```
ok   Panel zu → nichts gerendert
ok   Panel offen: <aside aria-label="Einstellungen" tabindex="-1">, Überschrift „Einstellungen“
ok   Panel: Schließen-Knopf aria-label „Einstellungen schließen“
ok   Panel: w-[var(--panel-w)], bg-[var(--surface-raised)], max-[900px]:absolute
ok   Panel: no-drag im style
ok   Panel sectionId → nur dieser Anker data-hervorgehoben=true
ok   Panel: hervorgehobener Anker mit Rand --tally-selected
ok   Panel ohne sectionId: kein Anker hervorgehoben
ok   PanelAnker ohne Panel: id einstellung-<id>, nicht hervorgehoben
ok   useSettingsPanel: außerhalb leer, im Panel die hervorgehobene id
ok   Panel: Hervorhebung dauert 1500 ms
ok   panelTaste Escape → stopPropagation, preventDefault, onClose
ok   panelTaste andere Taste → nichts
ok   panelTaste defaultPrevented → nichts (Escape gehört schon jemand anderem)
ok   Panel: Escape, das ein Zahlenfeld verbraucht hat, schließt das Panel nicht
ok   Panel-Props: Escape am Panel schließt (panelTaste), aria-label „Einstellungen“, tabIndex -1, id
ok   Panel-Fokus: beim Öffnen aufs Panel; beim Schließen zurück zum ⚙ – nur, wenn der Fokus im Panel lag
ok   Panel-Sprung: hervorheben, Anker in Sicht, nach 1500 ms enden; Aufräumen löscht die Uhr; ohne Abschnitt nur zurücksetzen
ok   Panel Verdrahtung: Fokus- und Sprung-Effekt, Panel-Props per Spread (je genau einmal)
```
Zählen: `npm run selftest -w @jm/ui | grep -cE "^ok   (Panel|panelTaste|useSettingsPanel)"` → `19`. Gesamt nach dieser Aufgabe (gemessen): `363` `ok`-Zeilen.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck -w @jm/ui`
Expected: keine Ausgabe von `tsc`, Exit-Code 0.

- [ ] **Step 8: Mutationsprobe (ohne Commit; je eine Änderung allein, danach zurück)**

a) Escape ohne `stopPropagation` (das Tool bekäme dieselbe Taste noch einmal):
Vorher (`packages/ui/src/components/SettingsPanel.tsx`):
```tsx
  e.stopPropagation();
  e.preventDefault();
  onClose();
```
Nachher:
```tsx
  e.preventDefault();
  onClose();
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL panelTaste Escape → stopPropagation, preventDefault, onClose
     ist: ["prevent","zu"] soll: ["stop","prevent","zu"]
FAIL Panel-Props: Escape am Panel schließt (panelTaste), aria-label „Einstellungen“, tabIndex -1, id
2 FEHLGESCHLAGEN
```

b) Panel ohne `noDragRegion`:
Vorher (`packages/ui/src/components/SettingsPanel.tsx`):
```tsx
    style: noDragRegion,
```
Nachher: diese Zeile ersatzlos löschen.
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Panel: no-drag im style
1 FEHLGESCHLAGEN
```

c) `defaultPrevented` nicht beachtet (Escape im geänderten Zahlenfeld schlösse das Panel):
Vorher (`packages/ui/src/components/SettingsPanel.tsx`):
```tsx
  if (e.key !== 'Escape' || e.defaultPrevented) return;
```
Nachher:
```tsx
  if (e.key !== 'Escape') return;
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL panelTaste defaultPrevented → nichts (Escape gehört schon jemand anderem)
     ist: ["stop","prevent","zu"] soll: []
FAIL Panel: Escape, das ein Zahlenfeld verbraucht hat, schließt das Panel nicht
2 FEHLGESCHLAGEN
```

d) Escape am Panel tut nichts (Bindung fehlt):
Vorher (`packages/ui/src/components/SettingsPanel.tsx`):
```tsx
    onKeyDown: (e) => panelTaste(e, p.onClose),
```
Nachher:
```tsx
    onKeyDown: () => undefined,
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Panel-Props: Escape am Panel schließt (panelTaste), aria-label „Einstellungen“, tabIndex -1, id
1 FEHLGESCHLAGEN
```

e) Fokus geht beim Schließen nicht zurück:
Vorher (`packages/ui/src/components/SettingsPanel.tsx`):
```tsx
    if (panel && panel.contains(aktiv())) vorher?.focus();
```
Nachher: diese Zeile ersatzlos löschen.
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Panel-Fokus: beim Öffnen aufs Panel; beim Schließen zurück zum ⚙ – nur, wenn der Fokus im Panel lag
     ist: [["fokus panel"],["fokus panel"]] soll: [["fokus panel","fokus zahnrad"],["fokus panel"]]
1 FEHLGESCHLAGEN
```

f) Hervorhebung endet nie:
Vorher (`packages/ui/src/components/SettingsPanel.tsx`):
```tsx
  const ende = zeit.setTimeout(() => setze(undefined), PANEL_HERVORHEBUNG_MS);
```
Nachher:
```tsx
  const ende = zeit.setTimeout(() => undefined, PANEL_HERVORHEBUNG_MS);
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Panel-Sprung: hervorheben, Anker in Sicht, nach 1500 ms enden; Aufräumen löscht die Uhr; ohne Abschnitt nur zurücksetzen
     ist: [["iveo",null],["iveo"],[1500],42,null] soll: [["iveo",null,null],["iveo"],[1500],42,null]
1 FEHLGESCHLAGEN
```

g) Sprung-Effekt fehlt:
Vorher (`packages/ui/src/components/SettingsPanel.tsx`):
```tsx
  useEffect(() => panelSprung(sectionId, (ziel) => ankerIn(panelRef.current, ziel), setHervorgehoben), [sectionId]);
```
Nachher: diese Zeile ersatzlos löschen.
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Panel Verdrahtung: Fokus- und Sprung-Effekt, Panel-Props per Spread (je genau einmal)
     fehlt: useEffect(() => panelSprung(sectionId, (ziel) => ankerIn(panelRef.current, ziel), setHervorgehoben), [sectionId]);
1 FEHLGESCHLAGEN
```

Nach jeder Probe die Ersetzung zurücknehmen; `npm run selftest -w @jm/ui` → wieder `ALLE TESTS OK`.

- [ ] **Step 9: Commit** (Commit-Text bewusst ohne Umlaute)

```bash
git add packages/ui/test/panel.test.tsx packages/ui/src/components/SettingsPanel.tsx packages/ui/test/selftest.ts packages/ui/src/index.ts
git status --short
```
Erwartet genau:
```
A  packages/ui/src/components/SettingsPanel.tsx
M  packages/ui/src/index.ts
A  packages/ui/test/panel.test.tsx
M  packages/ui/test/selftest.ts
```
Dann:
```bash
git commit -m "feat(ui): SettingsPanel mit Sprungziel, Hervorhebung und Escape nur bei Fokus im Panel" -m "Panel als aside mit Titel und Schliessen-Knopf, 360 px auf --surface-raised, unter 900 px ueber dem Inhalt, noDragRegion. sectionId hebt den PanelAnker 1500 ms hervor und scrollt ihn in Sicht. panelTaste schliesst bei Escape, wenn die Taste noch niemandem gehoert, und haelt sie vom Tool fern. Fokus beim Oeffnen aufs Panel, beim Schliessen zurueck, wenn er im Panel lag." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Für die Galerie (Task 23) muss zu sehen sein:** Öffnen über einen Statuseintrag springt zum Abschnitt und hebt ihn etwa 1,5 s mit gelbem Rand (Hell: dunklem Rand) hervor, ohne Fläche, danach verschwindet der Rand. Escape mit Fokus im Panel schließt es, der Fokus steht danach wieder auf ⚙ bzw. dem Statuseintrag; Escape mit Fokus im Inhalt schließt es nicht. Im 800-px-`iframe` liegt das Panel über dem Inhalt am rechten Rand, Kopf- und Statusleiste bleiben frei. Hinweis für die Galerie: Steht derselbe Abschnitt in der Dunkel- und der Hell-Spalte, gibt es die id `einstellung-<id>` zweimal; das Panel sucht den Anker deshalb nur in sich selbst.

**Nachgerechnet** (Kopie wie in Task 8): Step 3 rot wie angegeben; Step 6 grün mit 15 `ok`-Zeilen dieser Aufgabe und ohne React-Warnung; Typecheck grün; drei Mutationsproben rot wie angegeben, danach wieder grün. **Nach der Nachbesserung** (frische Kopie, Plantext Tasks 1–13): 19 `ok`-Zeilen dieser Aufgabe, gesamt 351, ohne React-Warnung, Proben a–g rot mit 2, 1, 2, 1, 1, 1, 1 `FAIL` (nach der zweiten Nachbesserung gesamt 363, sonst gleich). Gegenprobe zur Warnung: Ein Probe-Render mit `useLayoutEffect` gab unter `renderToStaticMarkup` „Warning: useLayoutEffect does nothing on the server …“ aus; mit der Umschaltung `typeof document` kommt keine. Im Probe-Bau vorhanden: `w-[var(--panel-w)]`, `bg-[var(--surface-raised)]`, `max-[900px]:absolute`, `rounded-[var(--radius-lg)]`, `border-[var(--tally-selected)]`, `scroll-mt-2`.

**Abweichungen vom Gerüst:**
1. Fokus-Rückgabe auf das Element, das vor dem Öffnen den Fokus hatte (⚙ **oder** der Statuseintrag, über den geöffnet wurde), statt fest auf ⚙ (E8). Das ⚙ ist über `aria-controls` nicht verlässlich zu finden, weil es `aria-controls` nur bei offenem Panel trägt (Task 14) und React es beim Schließen vor dem Panel-Abbau entfernt.
2. Der Anker wird im eigenen Panel über `data-section-id` gesucht, nicht per `document.getElementById` (doppelte ids in der Galerie, siehe oben).
3. Nachbesserung nach dem Review: `panelProps`, `panelFokus`, `panelSprung` (nur aus der Datei) machen Bindung und Effekt-Körper prüfbar; gemessen blieben vorher ein Panel ohne `onKeyDown`, eine Hervorhebung ohne Ende und eine gelöschte Fokus-Rückgabe grün (Proben d–g). Die Hervorhebung ist nur noch ein Rand (E23).

---

### Task 14: `AppHeader`

**Spec:** 3.2 (Logo + Toolname, Mitte, On-Air-Anzeige, ThemeToggle, ⚙), 3.8 (Ziehfläche auf macOS, Ampel-Freiraum). Entscheidungen E3 (On-Air-Fläche), E22; Review Focus 5; Regeln G3, G4, G7.

**Arbeitsverzeichnis/Voraussetzung:** Wurzel des Worktrees. Tasks 1–13 sind committet (`ThemeToggle` aus Task 12).

**Dateien:**
- Create: `packages/ui/test/header.test.tsx`
- Create: `packages/ui/src/components/AppHeader.tsx`
- Modify: `packages/ui/test/selftest.ts` (eine `import`-Zeile vor `abschluss();`)
- Modify: `packages/ui/src/index.ts` (eine Zeile am Ende)

**Interfaces:**
- Consumes: `Logo`, `dragRegion`, `noDragRegion`, `isElectronMac` (Bestand); `ThemeToggle` (Task 12); `LIVE_FLAECHE_KLASSE`, `STATUS_SYMBOL`, `STATUS_SYMBOL_KLASSE` (9.3); `UI_TEXTE.onAir`, `UI_TEXTE.bereit`, `UI_TEXTE.einstellungenOeffnen`, `UI_TEXTE.einstellungenSchliessen` (9.2); `cn`.
- Produces (9.7, exakt so):
  ```ts
  // packages/ui/src/components/AppHeader.tsx
  export interface AppHeaderProps {
    tool: string;                                  // ohne „JM “; angezeigt wird „JM {tool}“
    center?: ReactNode;
    onAir?: { live: boolean; label?: string };
    settingsAvailable?: boolean;                   // zeigt ⚙
    settingsOpen?: boolean;
    onSettingsToggle?(): void;
    panelId?: string;                              // aria-controls des ⚙
    mac?: boolean;                                 // Vorgabe isElectronMac
  }
  export function AppHeader(p: AppHeaderProps): React.JSX.Element;   // Pflichtklasse h-[var(--header-h)]; mac → pl-20, sonst pl-4
  ```
  Neue Zeile in `index.ts` (9.8): `export { AppHeader } from './components/AppHeader';`.

**Verhalten (verbindlich):**
- `<header style={dragRegion}>` mit Höhe `--header-h`, Fläche `--card`, Rand unten; links `pl-20` bei `mac` (Ampel bei `hiddenInset`), sonst `pl-4`; `mac` hat die Vorgabe `isElectronMac` (im Browser und unter Node `false`) und ist nur für Tests und Galerie als Prop da.
- Links: `Logo` (22 px) und „JM {tool}“ (E22). Mitte: `center` in einem eigenen Behälter mit `noDragRegion`; der leere Raum daneben bleibt Ziehfläche. Rechts: On-Air-Anzeige, `ThemeToggle`, ⚙.
- Jedes Bedienelement trägt **selbst** `noDragRegion` (⚙, ThemeToggle, Mitte), nicht nur ein umgebender Behälter – sonst verschluckt die Ziehfläche im Electron-Fenster die Klicks.
- On-Air: fehlt `onAir` → keine Anzeige. `live` → Fläche mit `LIVE_FLAECHE_KLASSE`, ■ (aria-hidden) und „ON AIR“ bzw. `label`. Nicht live → „bereit“ mit ● in `STATUS_SYMBOL_KLASSE.ok`, Rand `--tally-ready`, Text in Vordergrundfarbe (nie nur ein grüner Punkt); `label` gilt nur für live.
- ⚙ nur mit `settingsAvailable`: `<button type="button" data-zahnrad aria-expanded aria-label="Einstellungen öffnen|schließen">`, Klick → `onSettingsToggle`. `aria-controls={panelId}` **nur bei offenem Panel** (sonst zeigte es auf eine id, die nicht im DOM steht). Offen: Rand `--tally-selected` („ausgewählt“), Fläche `--muted`; Hover `--muted` (E23).

**Regeln für diese Aufgabe:** wie Task 8 (G9, G11, G3, G13).

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`packages/ui/test/header.test.tsx`, neu)

```tsx
// Task 14 · AppHeader (Spec 3.2, 3.8; E3, E22): Ziehfläche mit Mac-Freiraum, jedes Bedienelement no-drag,
// On-Air-Anzeige mit Form und Text, ⚙ nur mit Einstellungen.
import { AppHeader } from '../src/components/AppHeader';
import { LIVE_FLAECHE_KLASSE, STATUS_SYMBOL_KLASSE } from '../src/lib/status';
import { gleich, ok, render } from './harness';
import { attr, hatKlassen, klassen, ohneVersteckt, tags, text, zwischen } from './lib/markup';

const NO_DRAG = '-webkit-app-region:no-drag';
const nichts = (): void => undefined;
/** Öffnendes Tag und Inhalt der On-Air-Anzeige (sie enthält genau ein inneres span). */
const onAir = (html: string): { tag: string; inhalt: string } => {
  const tag = tags(html, 'span').find((t) => attr(t, 'data-onair') !== undefined) ?? '';
  const ab = html.indexOf(tag) + tag.length;
  const inhalt = html.slice(ab, html.indexOf('</span>', html.indexOf('</span>', ab) + 1));
  return { tag, inhalt };
};

{
  const html = render(<AppHeader tool="Titler" mac={false} />);
  ok(
    tags(html, 'svg').length === 1 && attr(tags(html, 'svg')[0], 'role') === 'img' && text(html).includes('JM Titler'),
    'Header: Logo + „JM {tool}“',
  );
  const [header] = tags(html, 'header');
  ok(
    (attr(header, 'style') ?? '').includes('-webkit-app-region:drag') && hatKlassen(header, 'h-[var(--header-h)] shrink-0'),
    'Header: <header> mit -webkit-app-region:drag und h-[var(--header-h)]',
  );
}
{
  const mac = klassen(tags(render(<AppHeader tool="Titler" mac />), 'header')[0]);
  const win = klassen(tags(render(<AppHeader tool="Titler" mac={false} />), 'header')[0]);
  const vorgabe = klassen(tags(render(<AppHeader tool="Titler" />), 'header')[0]);
  ok(
    mac.includes('pl-20') && !mac.includes('pl-4') && win.includes('pl-4') && !win.includes('pl-20') && vorgabe.includes('pl-4'),
    'Header mac=true → pl-20; mac=false → pl-4; Vorgabe isElectronMac (unter Node false) → pl-4',
  );
}
{
  const html = render(
    <AppHeader
      tool="Titler"
      mac={false}
      center={<span>Show vom Master: Gala · Stand 09:05</span>}
      settingsAvailable
      settingsOpen={false}
      onSettingsToggle={nichts}
    />,
  );
  const knoepfe = tags(html, 'button');
  const mitte = tags(html, 'div').find((t) => attr(t, 'data-bereich') === 'mitte') ?? '';
  ok(
    knoepfe.length === 2 && knoepfe.every((k) => (attr(k, 'style') ?? '').includes(NO_DRAG)) && (attr(mitte, 'style') ?? '').includes(NO_DRAG) &&
      text(html).includes('Show vom Master: Gala · Stand 09:05'),
    'Header: Mitte, ThemeToggle und ⚙ mit no-drag (jeder Knopf einzeln)',
  );
}
{
  const html = render(<AppHeader tool="Titler" mac={false} />);
  ok(
    onAir(html).tag === '' && !text(html).includes('ON AIR') && !text(html).includes('bereit'),
    'Header onAir fehlt → keine On-Air-Anzeige',
  );
}
{
  const html = render(<AppHeader tool="Titler" mac={false} onAir={{ live: true }} />);
  const a = onAir(html);
  ok(
    attr(a.tag, 'data-onair') === 'live' && hatKlassen(a.tag, LIVE_FLAECHE_KLASSE) && text(ohneVersteckt(a.inhalt)) === 'ON AIR' &&
      a.inhalt.includes('<span aria-hidden="true">■</span>'),
    'Header onAir live → LIVE_FLAECHE_KLASSE, ■ und „ON AIR“',
  );
  const mitLabel = onAir(render(<AppHeader tool="Titler" mac={false} onAir={{ live: true, label: 'AUF SENDUNG' }} />));
  ok(text(ohneVersteckt(mitLabel.inhalt)) === 'AUF SENDUNG', 'Header onAir live mit label → label statt „ON AIR“');
}
{
  const html = render(<AppHeader tool="Titler" mac={false} onAir={{ live: false, label: 'AUF SENDUNG' }} />);
  const a = onAir(html);
  ok(
    attr(a.tag, 'data-onair') === 'bereit' &&
      hatKlassen(a.tag, 'border-[var(--tally-ready)] text-[var(--foreground)]') &&
      a.inhalt.includes(`<span aria-hidden="true" class="${STATUS_SYMBOL_KLASSE.ok}">●</span>`) &&
      text(ohneVersteckt(a.inhalt)) === 'bereit' &&
      !html.includes('bg-[var(--tally-live)]'),
    'Header onAir nicht live → „bereit“ mit ● in Symbolklasse ok, Text in Vordergrundfarbe (nie nur Farbe)',
  );
}
{
  const ohne = render(<AppHeader tool="Titler" mac={false} />);
  ok(tags(ohne, 'button').length === 1, 'Header ohne settingsAvailable: kein ⚙ (nur der ThemeToggle)');
  const zu = tags(render(<AppHeader tool="Titler" mac={false} settingsAvailable settingsOpen={false} panelId="p1" onSettingsToggle={nichts} />), 'button');
  const auf = tags(render(<AppHeader tool="Titler" mac={false} settingsAvailable settingsOpen panelId="p1" onSettingsToggle={nichts} />), 'button');
  const zahnradZu = zu.find((t) => attr(t, 'data-zahnrad') !== undefined) ?? '';
  const zahnradAuf = auf.find((t) => attr(t, 'data-zahnrad') !== undefined) ?? '';
  gleich(
    [
      attr(zahnradZu, 'aria-expanded'),
      attr(zahnradZu, 'aria-controls'),
      attr(zahnradZu, 'aria-label'),
      attr(zahnradAuf, 'aria-expanded'),
      attr(zahnradAuf, 'aria-controls'),
      attr(zahnradAuf, 'aria-label'),
    ],
    ['false', undefined, 'Einstellungen öffnen', 'true', 'p1', 'Einstellungen schließen'],
    'Header ⚙: aria-expanded, aria-controls nur bei offenem Panel, aria-label öffnen/schließen',
  );
  ok(attr(zahnradZu, 'type') === 'button' && hatKlassen(zahnradZu, 'h-[var(--control-h)] w-[var(--control-h)]'), 'Header ⚙: type=button, Größe --control-h');
  const zahnradText = zwischen(render(<AppHeader tool="Titler" mac={false} settingsAvailable onSettingsToggle={nichts} />), 'data-zahnrad', '</button>');
  ok(zahnradText.includes('<span aria-hidden="true">⚙</span>'), 'Header ⚙: Symbol aria-hidden (Name kommt aus aria-label)');
}
```

- [ ] **Step 2: Testmodul einhängen** (`packages/ui/test/selftest.ts`)

Vorher:
```ts
abschluss();
```
Nachher:
```ts
import './header.test';
abschluss();
```

- [ ] **Step 3: Test laufen lassen (rot)**

Run: `npm run selftest -w @jm/ui`
Expected: Exit-Code 1, kein Test läuft:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\packages\ui\src\components\AppHeader' imported from …\packages\ui\test\header.test.tsx
```

- [ ] **Step 4: `AppHeader` anlegen** (`packages/ui/src/components/AppHeader.tsx`, neu)

```tsx
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { LIVE_FLAECHE_KLASSE, STATUS_SYMBOL, STATUS_SYMBOL_KLASSE } from '../lib/status';
import { UI_TEXTE } from '../lib/texte';
import { dragRegion, isElectronMac, noDragRegion } from '../lib/titlebar';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

export interface AppHeaderProps {
  /** Anzeigename ohne „JM “; angezeigt wird „JM {tool}“ (E22). */
  tool: string;
  center?: ReactNode;
  onAir?: { live: boolean; label?: string };
  /** zeigt ⚙ */
  settingsAvailable?: boolean;
  settingsOpen?: boolean;
  onSettingsToggle?(): void;
  /** id des Panels für aria-controls des ⚙ (nur gesetzt, solange das Panel offen ist). */
  panelId?: string;
  /** Platz für die Ampel auf macOS; Vorgabe isElectronMac (im Browser und unter Node false). */
  mac?: boolean;
}

/**
 * Kopfzeile (Spec 3.2, 3.8): links Logo und „JM {tool}“, Mitte `center`, rechts On-Air-Anzeige, ThemeToggle und ⚙.
 * Die ganze Zeile ist Fenster-Ziehfläche (dragRegion); jedes Bedienelement und die Mitte tragen selbst noDragRegion,
 * sonst wären sie im Electron-Fenster nicht klickbar. Auf macOS (hiddenInset) 80 px Platz für die Ampel.
 */
export function AppHeader({
  tool,
  center,
  onAir,
  settingsAvailable = false,
  settingsOpen = false,
  onSettingsToggle,
  panelId,
  mac = isElectronMac,
}: AppHeaderProps): React.JSX.Element {
  const zahnradText = settingsOpen ? UI_TEXTE.einstellungenSchliessen : UI_TEXTE.einstellungenOeffnen;
  return (
    <header
      style={dragRegion}
      className={cn(
        'flex h-[var(--header-h)] shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--card)] pr-3',
        mac ? 'pl-20' : 'pl-4',
      )}
    >
      <div className="flex shrink-0 items-center gap-2">
        <Logo size={22} />
        <span className="whitespace-nowrap text-sm font-extrabold tracking-[0.06em] text-[var(--foreground)]">JM {tool}</span>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-center">
        {center ? (
          <div data-bereich="mitte" style={noDragRegion} className="min-w-0 truncate text-xs text-[var(--foreground)]">
            {center}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onAir ? <OnAirAnzeige live={onAir.live} label={onAir.label} /> : null}
        <ThemeToggle />
        {settingsAvailable ? (
          <button
            type="button"
            data-zahnrad=""
            style={noDragRegion}
            onClick={onSettingsToggle}
            aria-expanded={settingsOpen}
            aria-controls={settingsOpen ? panelId : undefined}
            aria-label={zahnradText}
            title={zahnradText}
            className={cn(
              'inline-flex h-[var(--control-h)] w-[var(--control-h)] items-center justify-center rounded-[var(--radius-md)] border',
              'text-base text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
              'motion-safe:transition-colors motion-safe:duration-150',
              settingsOpen ? 'border-[var(--tally-selected)] bg-[var(--muted)]' : 'border-[var(--border)] hover:bg-[var(--muted)]',
            )}
          >
            <span aria-hidden="true">⚙</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}

/**
 * On-Air-Anzeige (Spec 3.2, 4.2; E3): live = rote Fläche mit ■ und „ON AIR“ bzw. label in großer, extrafetter Schrift
 * (LIVE_FLAECHE_KLASSE); sonst „bereit“ mit grünem ● und Text in Vordergrundfarbe. Nie nur Farbe.
 */
function OnAirAnzeige({ live, label }: { live: boolean; label?: string }): React.JSX.Element {
  if (live) {
    return (
      <span
        data-onair="live"
        className={cn('inline-flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-1 tracking-[0.06em]', LIVE_FLAECHE_KLASSE)}
      >
        <span aria-hidden="true">{STATUS_SYMBOL.live}</span>
        {label ?? UI_TEXTE.onAir}
      </span>
    );
  }
  return (
    <span
      data-onair="bereit"
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--tally-ready)] px-2 py-0.5 text-xs font-semibold text-[var(--foreground)]"
    >
      <span aria-hidden="true" className={STATUS_SYMBOL_KLASSE.ok}>
        {STATUS_SYMBOL.ok}
      </span>
      {UI_TEXTE.bereit}
    </span>
  );
}
```

- [ ] **Step 5: Export anhängen** (`packages/ui/src/index.ts`, Dateiende)

Vorher:
```ts
export { SettingsPanel, PanelAnker, useSettingsPanel } from './components/SettingsPanel';
```
Nachher:
```ts
export { SettingsPanel, PanelAnker, useSettingsPanel } from './components/SettingsPanel';
export { AppHeader } from './components/AppHeader';
```

- [ ] **Step 6: Test laufen lassen (grün)**

Run: `npm run selftest -w @jm/ui`
Expected: keine Zeile mit `FAIL`, letzte Zeile `ALLE TESTS OK`, Exit-Code 0. Die Zeilen dieser Aufgabe:
```
ok   Header: Logo + „JM {tool}“
ok   Header: <header> mit -webkit-app-region:drag und h-[var(--header-h)]
ok   Header mac=true → pl-20; mac=false → pl-4; Vorgabe isElectronMac (unter Node false) → pl-4
ok   Header: Mitte, ThemeToggle und ⚙ mit no-drag (jeder Knopf einzeln)
ok   Header onAir fehlt → keine On-Air-Anzeige
ok   Header onAir live → LIVE_FLAECHE_KLASSE, ■ und „ON AIR“
ok   Header onAir live mit label → label statt „ON AIR“
ok   Header onAir nicht live → „bereit“ mit ● in Symbolklasse ok, Text in Vordergrundfarbe (nie nur Farbe)
ok   Header ohne settingsAvailable: kein ⚙ (nur der ThemeToggle)
ok   Header ⚙: aria-expanded, aria-controls nur bei offenem Panel, aria-label öffnen/schließen
ok   Header ⚙: type=button, Größe --control-h
ok   Header ⚙: Symbol aria-hidden (Name kommt aus aria-label)
```
Zählen: `npm run selftest -w @jm/ui | grep -cE "^ok   Header"` → `12`. Gesamt nach dieser Aufgabe (gemessen): `375` `ok`-Zeilen.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck -w @jm/ui`
Expected: keine Ausgabe von `tsc`, Exit-Code 0.

- [ ] **Step 8: Mutationsprobe (ohne Commit; je eine Änderung allein, danach zurück)**

a) ⚙ ohne `noDragRegion`:
Vorher (`packages/ui/src/components/AppHeader.tsx`):
```tsx
            data-zahnrad=""
            style={noDragRegion}
```
Nachher:
```tsx
            data-zahnrad=""
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Header: Mitte, ThemeToggle und ⚙ mit no-drag (jeder Knopf einzeln)
1 FEHLGESCHLAGEN
```

b) „bereit“ nur als grüner Punkt ohne Text:
Vorher (`packages/ui/src/components/AppHeader.tsx`):
```tsx
      </span>
      {UI_TEXTE.bereit}
```
Nachher:
```tsx
      </span>
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Header onAir nicht live → „bereit“ mit ● in Symbolklasse ok, Text in Vordergrundfarbe (nie nur Farbe)
1 FEHLGESCHLAGEN
```

c) Mac-Freiraum ignoriert (Ist-Fehler des Titler-Kopfs):
Vorher (`packages/ui/src/components/AppHeader.tsx`):
```tsx
        mac ? 'pl-20' : 'pl-4',
```
Nachher:
```tsx
        'pl-4',
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Header mac=true → pl-20; mac=false → pl-4; Vorgabe isElectronMac (unter Node false) → pl-4
1 FEHLGESCHLAGEN
```

Nach jeder Probe die Ersetzung zurücknehmen; `npm run selftest -w @jm/ui` → wieder `ALLE TESTS OK`.

- [ ] **Step 9: Commit** (Commit-Text bewusst ohne Umlaute)

```bash
git add packages/ui/test/header.test.tsx packages/ui/src/components/AppHeader.tsx packages/ui/test/selftest.ts packages/ui/src/index.ts
git status --short
```
Erwartet genau:
```
A  packages/ui/src/components/AppHeader.tsx
M  packages/ui/src/index.ts
A  packages/ui/test/header.test.tsx
M  packages/ui/test/selftest.ts
```
Dann:
```bash
git commit -m "feat(ui): AppHeader - Ziehflaeche mit Mac-Freiraum, On-Air-Anzeige, Theme und Zahnrad" -m "Header ist Fenster-Ziehflaeche mit 80 px Ampel-Freiraum auf macOS (mac-Prop, Vorgabe isElectronMac); Mitte, ThemeToggle und Zahnrad tragen je selbst noDragRegion. On-Air live als rote Flaeche mit ON AIR in grosser Schrift, sonst 'bereit' mit gruenem Punkt und Text. Zahnrad nur mit settingsAvailable, aria-expanded, aria-controls nur bei offenem Panel." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Für die Galerie (Task 23) muss zu sehen sein:** Kopfzeilen mit `mac` true und false (80 px Freiraum links sichtbar), mit und ohne `onAir` (live: rote Fläche „ON AIR“; nicht live: „bereit“ mit grünem Punkt), mit und ohne ⚙, ⚙ offen hervorgehoben. Die Ziehfläche selbst ist nur im Electron-Fenster prüfbar (Pilot-Abnahme auf dem Mac).

**Nachgerechnet** (Kopie wie in Task 8): Step 3 rot wie angegeben; Step 6 grün mit 12 `ok`-Zeilen dieser Aufgabe; Typecheck grün; drei Mutationsproben rot wie angegeben, danach wieder grün. Im Probe-Bau vorhanden: `h-[var(--header-h)]`, `pl-20`, `w-[var(--control-h)]`.

**Abweichungen vom Gerüst:**
1. `aria-controls` des ⚙ nur bei offenem Panel (9.7 nennt `panelId` ohne Bedingung). Sonst fänden `pruefeIdVerweise` und Screenreader bei geschlossenem Panel eine id ohne Element.
2. Test-Haken als Datenattribute: `data-zahnrad`, `data-onair="live|bereit"`, `data-bereich="mitte"`.
3. Nachbesserung nach dem Review: ⚙ offen bzw. Hover mit Fläche `--muted` statt `--highlight` (E23); Rand
   `--tally-selected` bleibt das Zeichen für „offen“. Nach der Nachbesserung gemessen: 12 `ok`-Zeilen dieser Aufgabe,
   gesamt 363, Proben a–c rot mit 1, 1, 1 `FAIL` (nach der zweiten Nachbesserung gesamt 375, sonst gleich).

---

### Task 15: `AppShell`

**Spec:** 3.1 (Aufbau, Panel neben dem Inhalt, verdeckt Kopf- und Statusleiste nie, Escape), 3.8 (Dichte, Zustand ohne Sitzung), 4.3 (Bewegung). Entscheidungen E6, E7, E8, E14; Regeln G3, G6, G8.

**Arbeitsverzeichnis/Voraussetzung:** Wurzel des Worktrees. Tasks 1–14 sind committet (`AppHeader`, `StatusBar`, `SettingsPanel`).

**Dateien:**
- Create: `packages/ui/test/shell.test.tsx`
- Create: `packages/ui/src/components/AppShell.tsx`
- Modify: `packages/ui/test/selftest.ts` (eine `import`-Zeile vor `abschluss();`)
- Modify: `packages/ui/src/index.ts` (eine Zeile am Ende)

**Interfaces:**
- Consumes: `AppHeader` (Task 14), `StatusBar` (Task 8), `SettingsPanel` und im Test `PanelAnker` (Task 13), `StatusItem` (9.3).
- Produces (9.7, exakt so):
  ```ts
  // packages/ui/src/components/AppShell.tsx — Props wörtlich Spec 3.1
  export interface AppShellProps {
    tool: string;
    headerCenter?: ReactNode;
    onAir?: { live: boolean; label?: string };
    status: StatusItem[];
    toolbar?: ReactNode;
    settings?: ReactNode;
    settingsOpen: boolean;
    settingsSection?: string;
    onSettingsChange(open: boolean, sectionId?: string): void;
    dichte?: 'normal' | 'kompakt';
    children: ReactNode;
  }
  export function AppShell(p: AppShellProps): React.JSX.Element;
  export function statusKlick(p: Pick<AppShellProps, 'settings' | 'onSettingsChange'>): ((sectionId: string) => void) | undefined;  // nur aus der Datei
  export function zahnradKlick(p: Pick<AppShellProps, 'settingsOpen' | 'onSettingsChange'>): () => void;                           // nur aus der Datei
  ```
  Neue Zeile in `index.ts` (9.8): `export { AppShell, type AppShellProps } from './components/AppShell';`.

**Verhalten (verbindlich):**
- Wurzel `<div data-dichte="normal|kompakt" class="flex h-screen flex-col overflow-hidden …">` (Vorgabe `normal`; die Höhen dazu liefert `sizes.css`, E6). Senkrecht: `AppHeader` · Werkzeugleiste `data-bereich="toolbar"` (nur wenn `toolbar` gesetzt) · Inhaltszeile `data-bereich="inhalt"` (`relative flex min-h-0 flex-1`) mit `<main>` (füllt, `min-h-0`, scrollt) und dem `SettingsPanel` **rechts daneben in derselben Zeile** · `StatusBar`. So verdeckt das Panel Kopf- und Statusleiste nie; unter 900 px liegt es innerhalb der Inhaltszeile über `<main>` (E7).
- `settings` fehlt (`undefined`, `null` oder `false`): kein ⚙, kein Panel (auch bei `settingsOpen`), und `statusKlick` liefert `undefined` → kein Statuseintrag wird zum Knopf (E14).
- Mit `settings`: ⚙ schaltet über `zahnradKlick` (`onSettingsChange(!settingsOpen)`, ohne Abschnitt); ein Statuseintrag mit `settingsSection` ruft `onSettingsChange(true, sectionId)`; das Panel bekommt `sectionId = settingsSection`, `onClose = () => onSettingsChange(false)` und die id, die das ⚙ als `aria-controls` trägt (`useId`).
- Zustand ohne Sitzung: `status={[]}` und keine `settings` ergeben den Rahmen mit Uhr.

**Regeln für diese Aufgabe:** wie Task 8 (G9, G11, G3, G13).

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (`packages/ui/test/shell.test.tsx`, neu)

```tsx
// Task 15 · AppShell (Spec 3.1, 3.8, 4.3; E6, E7, E8, E14): Kopfzeile · Werkzeugleiste · Inhalt mit Panel daneben ·
// Statusleiste. Ohne settings kein ⚙, kein Panel und keine klickbaren Statuseinträge; Rahmen auch ohne Sitzung.
import { AppShell, statusKlick, zahnradKlick, type AppShellProps } from '../src/components/AppShell';
import { PanelAnker } from '../src/components/SettingsPanel';
import type { StatusItem } from '../src/lib/status';
import { gleich, ok, pruefeIdVerweise, render } from './harness';
import { attr, hatKlassen, klassen, tags } from './lib/markup';

const nichts = (): void => undefined;
const STATUS: StatusItem[] = [
  { id: 'ndi', group: 'ausgabe', label: 'NDI', state: 'ok', detail: 'JM Titler', settingsSection: 'ndi' },
  { id: 'master', group: 'verbindung', label: 'Master', state: 'off', detail: 'unbekannt' },
];
const basis = (teil: Partial<AppShellProps> = {}): AppShellProps => ({
  tool: 'Titler',
  status: STATUS,
  settingsOpen: false,
  onSettingsChange: nichts,
  children: <p>Live-Bereich</p>,
  ...teil,
});
const EINSTELLUNGEN = (
  <>
    <PanelAnker id="ndi">NDI-Abschnitt</PanelAnker>
    <PanelAnker id="iveo">iveo-Abschnitt</PanelAnker>
  </>
);
const zahnrad = (html: string): string => tags(html, 'button').find((t) => attr(t, 'data-zahnrad') !== undefined) ?? '';
const statusKnoepfe = (html: string): string[] => tags(html, 'button').filter((t) => attr(t, 'data-status-id') !== undefined);

{
  const html = render(<AppShell {...basis({ toolbar: <span>Werkzeuge</span> })} />);
  const p = ['<header', 'data-bereich="toolbar"', '<main', '<footer'].map((s) => html.indexOf(s));
  ok(p.every((x) => x >= 0) && p[0] < p[1] && p[1] < p[2] && p[2] < p[3], 'Shell: Reihenfolge header → toolbar → main → footer');
  ok(!render(<AppShell {...basis()} />).includes('data-bereich="toolbar"'), 'Shell ohne toolbar: kein Toolbar-Bereich');
}
{
  const normal = tags(render(<AppShell {...basis()} />), 'div')[0];
  const kompakt = tags(render(<AppShell {...basis({ dichte: 'kompakt' })} />), 'div')[0];
  gleich([attr(normal, 'data-dichte'), attr(kompakt, 'data-dichte')], ['normal', 'kompakt'], 'Shell data-dichte normal/kompakt (Vorgabe normal)');
  ok(hatKlassen(normal, 'flex h-screen flex-col overflow-hidden'), 'Shell: Wurzel h-screen flex flex-col');
}
{
  const html = render(<AppShell {...basis({ settingsOpen: true })} />);
  ok(
    zahnrad(html) === '' && !html.includes('<aside') && statusKnoepfe(html).length === 0 && html.includes('data-status-id="ndi"'),
    'Shell settings fehlt: kein ⚙, kein Panel, Statuseinträge ohne Knopf (auch mit settingsSection)',
  );
  const mitFalse = render(<AppShell {...basis({ settings: false, settingsOpen: true })} />);
  ok(zahnrad(mitFalse) === '' && !mitFalse.includes('<aside'), 'Shell settings={false} zählt als fehlend');
}
{
  const html = render(<AppShell {...basis({ settings: EINSTELLUNGEN, settingsOpen: true, settingsSection: 'iveo' })} />);
  const mainEnde = html.indexOf('</main>');
  const asideStart = html.indexOf('<aside');
  const asideEnde = html.indexOf('</aside>') + '</aside>'.length;
  ok(
    mainEnde > 0 && asideStart > mainEnde && html.slice(mainEnde + '</main>'.length, asideStart) === '' &&
      html.slice(asideEnde, html.indexOf('<footer')) === '</div>' && html.indexOf('<header') < asideStart,
    'Shell settingsOpen: Panel rechts neben <main> in der Inhaltszeile, zwischen Kopf- und Statusleiste',
  );
  gleich(
    tags(html, 'div')
      .filter((t) => attr(t, 'data-section-id') !== undefined)
      .map((t) => [attr(t, 'data-section-id'), attr(t, 'data-hervorgehoben')]),
    [
      ['ndi', 'false'],
      ['iveo', 'true'],
    ],
    'Shell settingsSection → Anker hervorgehoben',
  );
  ok(
    attr(zahnrad(html), 'aria-expanded') === 'true' && attr(zahnrad(html), 'aria-controls') === attr(tags(html, 'aside')[0], 'id'),
    'Shell: ⚙ aria-expanded=true, aria-controls = id des Panels',
  );
  ok(statusKnoepfe(html).length === 1, 'Shell mit settings: Statuseintrag mit settingsSection ist ein Knopf, ohne bleibt Anzeige');
  pruefeIdVerweise(html, 'Shell offen: alle id-Verweise gültig');
}
{
  const html = render(<AppShell {...basis({ settings: EINSTELLUNGEN, settingsOpen: false })} />);
  ok(
    !html.includes('<aside') && attr(zahnrad(html), 'aria-expanded') === 'false' && attr(zahnrad(html), 'aria-controls') === undefined,
    'Shell settings zu: kein Panel, ⚙ aria-expanded=false',
  );
  pruefeIdVerweise(html, 'Shell zu: alle id-Verweise gültig');
}
{
  const aufrufe: unknown[][] = [];
  const onSettingsChange = (...a: unknown[]): void => void aufrufe.push(a);
  const klick = statusKlick({ settings: <p>x</p>, onSettingsChange });
  klick?.('ndi');
  gleich([typeof klick, aufrufe], ['function', [[true, 'ndi']]], 'statusKlick → onSettingsChange(true, id)');
  gleich(
    [statusKlick({ settings: undefined, onSettingsChange }), statusKlick({ settings: null, onSettingsChange })],
    [undefined, undefined],
    'statusKlick ohne settings → undefined',
  );
  aufrufe.length = 0;
  zahnradKlick({ settingsOpen: false, onSettingsChange })();
  zahnradKlick({ settingsOpen: true, onSettingsChange })();
  gleich(aufrufe, [[true], [false]], 'zahnradKlick → onSettingsChange(!open), ohne Abschnitt');
}
{
  const html = render(
    <AppShell tool="Studio-Control" status={[]} settingsOpen={false} onSettingsChange={nichts}>
      <p>Anmelden</p>
    </AppShell>,
  );
  ok(
    html.includes('<header') && html.includes('<main') && html.includes('<footer') && html.includes('data-uhr') &&
      !html.includes('<aside') && zahnrad(html) === '' && html.includes('<div role="status" aria-live="polite" class="') &&
      html.includes('JM Studio-Control'),
    'Shell Zustand ohne Sitzung: status [], keine settings → Rahmen mit Uhr',
  );
}
{
  const html = render(
    <AppShell {...basis({ settings: EINSTELLUNGEN, settingsOpen: true, settingsSection: 'ndi', onAir: { live: true }, toolbar: <span>W</span> })} />,
  );
  const alle = tags(html, '[a-z0-9]+').flatMap(klassen);
  const uebergaenge = alle.filter((k) => k.includes('transition'));
  ok(
    uebergaenge.length > 0 && uebergaenge.every((k) => k.startsWith('motion-safe:')) && !alle.some((k) => k.startsWith('animate-')),
    'Shell: Übergänge nur motion-safe, kein animate-',
  );
}
```

- [ ] **Step 2: Testmodul einhängen** (`packages/ui/test/selftest.ts`)

Vorher:
```ts
abschluss();
```
Nachher:
```ts
import './shell.test';
abschluss();
```

- [ ] **Step 3: Test laufen lassen (rot)**

Run: `npm run selftest -w @jm/ui`
Expected: Exit-Code 1, kein Test läuft:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\packages\ui\src\components\AppShell' imported from …\packages\ui\test\shell.test.tsx
```

- [ ] **Step 4: `AppShell` anlegen** (`packages/ui/src/components/AppShell.tsx`, neu)

```tsx
import { useId, type ReactNode } from 'react';
import type { StatusItem } from '../lib/status';
import { AppHeader } from './AppHeader';
import { SettingsPanel } from './SettingsPanel';
import { StatusBar } from './StatusBar';

/** Props wörtlich aus Spec 3.1. */
export interface AppShellProps {
  tool: string;
  headerCenter?: ReactNode;
  onAir?: { live: boolean; label?: string };
  status: StatusItem[];
  toolbar?: ReactNode;
  settings?: ReactNode;
  settingsOpen: boolean;
  settingsSection?: string;
  onSettingsChange(open: boolean, sectionId?: string): void;
  dichte?: 'normal' | 'kompakt';
  children: ReactNode;
}

/** `settings` fehlt = kein ⚙, kein Panel (Spec 3.1). `false` und `null` zählen als fehlend. */
function hatEinstellungen(settings: ReactNode): boolean {
  return settings !== undefined && settings !== null && settings !== false;
}

/**
 * Rückruf der Statusleiste (E14): nur mit `settings` öffnet ein Klick das Panel beim Abschnitt; ohne `settings` gibt es
 * keinen Rückruf, und kein Statuseintrag wird zum Knopf. Nur aus dieser Datei exportiert.
 */
export function statusKlick(
  p: Pick<AppShellProps, 'settings' | 'onSettingsChange'>,
): ((sectionId: string) => void) | undefined {
  if (!hatEinstellungen(p.settings)) return undefined;
  return (sectionId) => p.onSettingsChange(true, sectionId);
}

/** ⚙ schaltet das Panel um, ohne Abschnitt. Nur aus dieser Datei exportiert. */
export function zahnradKlick(p: Pick<AppShellProps, 'settingsOpen' | 'onSettingsChange'>): () => void {
  return () => p.onSettingsChange(!p.settingsOpen);
}

/**
 * Rahmen jedes Tools (Spec 3.1, 3.8): senkrecht Kopfzeile · Werkzeugleiste (nur wenn gesetzt) · Inhalt mit dem
 * Einstellungs-Panel rechts daneben · Statusleiste. Das Panel liegt in der Inhaltszeile und verdeckt Kopf- und
 * Statusleiste deshalb nie; unter 900 px liegt es über dem Inhalt (E7). `dichte` steht als data-dichte an der Wurzel
 * (E6, die Tokens dazu in sizes.css). Funktioniert ohne Sitzung: leere Statusleiste, keine Einstellungen.
 */
export function AppShell(p: AppShellProps): React.JSX.Element {
  const {
    tool,
    headerCenter,
    onAir,
    status,
    toolbar,
    settings,
    settingsOpen,
    settingsSection,
    onSettingsChange,
    dichte = 'normal',
    children,
  } = p;
  const panelId = useId();
  const mitEinstellungen = hatEinstellungen(settings);
  const offen = mitEinstellungen && settingsOpen;

  return (
    <div data-dichte={dichte} className="flex h-screen flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <AppHeader
        tool={tool}
        center={headerCenter}
        onAir={onAir}
        settingsAvailable={mitEinstellungen}
        settingsOpen={offen}
        onSettingsToggle={zahnradKlick(p)}
        panelId={panelId}
      />
      {toolbar ? (
        <div data-bereich="toolbar" className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--card)] px-3 py-1.5">
          {toolbar}
        </div>
      ) : null}
      <div data-bereich="inhalt" className="relative flex min-h-0 flex-1">
        <main className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</main>
        <SettingsPanel open={offen} onClose={() => onSettingsChange(false)} sectionId={settingsSection} id={panelId}>
          {settings}
        </SettingsPanel>
      </div>
      <StatusBar items={status} onOpenSection={statusKlick(p)} />
    </div>
  );
}
```

- [ ] **Step 5: Export anhängen** (`packages/ui/src/index.ts`, Dateiende)

Vorher:
```ts
export { AppHeader } from './components/AppHeader';
```
Nachher:
```ts
export { AppHeader } from './components/AppHeader';
export { AppShell, type AppShellProps } from './components/AppShell';
```

- [ ] **Step 6: Test laufen lassen (grün)**

Run: `npm run selftest -w @jm/ui`
Expected: keine Zeile mit `FAIL`, letzte Zeile `ALLE TESTS OK`, Exit-Code 0. Die Zeilen dieser Aufgabe:
```
ok   Shell: Reihenfolge header → toolbar → main → footer
ok   Shell ohne toolbar: kein Toolbar-Bereich
ok   Shell data-dichte normal/kompakt (Vorgabe normal)
ok   Shell: Wurzel h-screen flex flex-col
ok   Shell settings fehlt: kein ⚙, kein Panel, Statuseinträge ohne Knopf (auch mit settingsSection)
ok   Shell settings={false} zählt als fehlend
ok   Shell settingsOpen: Panel rechts neben <main> in der Inhaltszeile, zwischen Kopf- und Statusleiste
ok   Shell settingsSection → Anker hervorgehoben
ok   Shell: ⚙ aria-expanded=true, aria-controls = id des Panels
ok   Shell mit settings: Statuseintrag mit settingsSection ist ein Knopf, ohne bleibt Anzeige
ok   Shell offen: alle id-Verweise gültig
ok   Shell settings zu: kein Panel, ⚙ aria-expanded=false
ok   Shell zu: alle id-Verweise gültig
ok   statusKlick → onSettingsChange(true, id)
ok   statusKlick ohne settings → undefined
ok   zahnradKlick → onSettingsChange(!open), ohne Abschnitt
ok   Shell Zustand ohne Sitzung: status [], keine settings → Rahmen mit Uhr
ok   Shell: Übergänge nur motion-safe, kein animate-
```
Zählen: `npm run selftest -w @jm/ui | grep -cE "^ok   (Shell|statusKlick|zahnradKlick)"` → `18`. Block B zusammen: `grep -cE "^ok   (StatusPill|StatusBar|Tally|Field|TextInput|NumberInput|Toggle|Select|ThemeToggle|useTheme|Panel|panelTaste|useSettingsPanel|Header|Shell|statusKlick|zahnradKlick)"` → `159`. Gesamt nach dieser Aufgabe (gemessen): `393` `ok`-Zeilen (234 aus Block A + 159).

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck -w @jm/ui`
Expected: keine Ausgabe von `tsc`, Exit-Code 0.

- [ ] **Step 8: Mutationsprobe (ohne Commit; je eine Änderung allein, danach zurück)**

a) Statuseintrag auch ohne `settings` klickbar:
Vorher (`packages/ui/src/components/AppShell.tsx`):
```tsx
      <StatusBar items={status} onOpenSection={statusKlick(p)} />
```
Nachher:
```tsx
      <StatusBar items={status} onOpenSection={(id) => onSettingsChange(true, id)} />
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Shell settings fehlt: kein ⚙, kein Panel, Statuseinträge ohne Knopf (auch mit settingsSection)
1 FEHLGESCHLAGEN
```

b) Panel außerhalb der Inhaltszeile (verdeckte die Statusleiste bzw. schöbe sie weg):
Vorher (`packages/ui/src/components/AppShell.tsx`):
```tsx
        <main className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</main>
        <SettingsPanel open={offen} onClose={() => onSettingsChange(false)} sectionId={settingsSection} id={panelId}>
          {settings}
        </SettingsPanel>
      </div>
```
Nachher:
```tsx
        <main className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
      <SettingsPanel open={offen} onClose={() => onSettingsChange(false)} sectionId={settingsSection} id={panelId}>
        {settings}
      </SettingsPanel>
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL Shell settingsOpen: Panel rechts neben <main> in der Inhaltszeile, zwischen Kopf- und Statusleiste
1 FEHLGESCHLAGEN
```

c) ⚙ öffnet immer, schließt nie:
Vorher (`packages/ui/src/components/AppShell.tsx`):
```tsx
  return () => p.onSettingsChange(!p.settingsOpen);
```
Nachher:
```tsx
  return () => p.onSettingsChange(true);
```
Run: `npm run selftest -w @jm/ui`
Expected (Exit-Code 1):
```
FAIL zahnradKlick → onSettingsChange(!open), ohne Abschnitt
     ist: [[true],[true]] soll: [[true],[false]]
1 FEHLGESCHLAGEN
```

Nach jeder Probe die Ersetzung zurücknehmen; `npm run selftest -w @jm/ui` → wieder `ALLE TESTS OK`.

- [ ] **Step 9: Commit** (Commit-Text bewusst ohne Umlaute)

```bash
git add packages/ui/test/shell.test.tsx packages/ui/src/components/AppShell.tsx packages/ui/test/selftest.ts packages/ui/src/index.ts
git status --short
```
Erwartet genau:
```
A  packages/ui/src/components/AppShell.tsx
M  packages/ui/src/index.ts
M  packages/ui/test/selftest.ts
A  packages/ui/test/shell.test.tsx
```
Dann:
```bash
git commit -m "feat(ui): AppShell - Kopfzeile, Werkzeugleiste, Inhalt mit Einstellungs-Panel, Statusleiste" -m "Senkrechter Rahmen mit data-dichte; das Panel liegt rechts neben main in der Inhaltszeile und verdeckt Kopf- und Statusleiste nie. Ohne settings kein Zahnrad, kein Panel und keine klickbaren Statuseintraege (statusKlick liefert dann undefined); zahnradKlick schaltet ohne Abschnitt um. Rahmen auch ohne Sitzung (leere Statusleiste mit Uhr)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Für die Galerie (Task 23) muss zu sehen sein:** `ShellSeite` in den `iframe`s mit 1200 px und 800 px Breite: Panel zu und offen (1200 px: der Inhalt wird schmaler; 800 px: das Panel liegt über dem Inhalt), Kopf- und Statusleiste bleiben in beiden Fällen ganz sichtbar; `dichte=kompakt` mit 36 px Kopf- und 24 px Statusleiste; Klick auf einen Statuseintrag öffnet das Panel beim Abschnitt; ⚙ öffnet und schließt; der Rahmen ohne Sitzung (leere Statusleiste mit Uhr, kein ⚙).

**Nachgerechnet** (Kopie wie in Task 8): Step 3 rot wie angegeben; Step 6 grün mit 18 `ok`-Zeilen dieser Aufgabe, Block B zusammen 134 `ok`-Zeilen (dazu in der Kopie 7 Zeilen der nachgebauten Quellregeln, Gesamtlauf 141 `ok`, keine React-Warnung); Typecheck grün; drei Mutationsproben rot wie angegeben, danach wieder grün. **Nach der Nachbesserung** (frische Kopie, Plantext Tasks 1–15): 18 `ok`-Zeilen dieser Aufgabe, Block B zusammen 157, gesamt 381, Proben a–c rot mit 1, 1, 1 `FAIL` (nach der zweiten Nachbesserung Block B 159, gesamt 393, Proben gleich). Der Probe-Bau (`vite build` mit `react()` und `tailwindcss()`, CSS `@import "tailwindcss"; @import "../src/base.css"; @source "../src";`) fand alle 42 geprüften Klassen von Block B im CSS, dazu die Definition von `--tally-live` und die Regel `[data-dichte="kompakt"]`.

**Abweichungen vom Gerüst:**
1. `settings={false}` und `settings={null}` zählen wie ein fehlendes `settings` (ein Tool schreibt leicht `settings={bedingung && <…/>}`).
2. Test-Haken als Datenattribute: `data-bereich="toolbar"` und `data-bereich="inhalt"`.

---

## Block C · `@jm/settings` (Tasks 16–22)

Gemeinsam für Block C:
- Jede Abschnitts-Aufgabe liefert `src/abschnitte/<name>.ts` (Props, `…_TEXTE`, View, reine Funktion `…View`) und
  `src/abschnitte/<Name>Section.tsx`, hängt ihre Exporte an `src/index.ts` und ihr Testmodul vor `abschluss();` in
  `test/selftest.ts`.
- Jeder Abschnittstest hat drei Teile: (a) eine Tabelle „Eingang → erwarteter `status`“, über die eine Schleife das
  **vollständige Kreuzprodukt** prüft (eine `ok`-Zeile je Tabelle, bei Abweichung die ersten fünf Fälle mit ist/soll),
  (b) Render-Fälle für `capabilities` (ausblenden, nicht ausgrauen), `locked` (alle Bedienelemente `disabled`, Grund
  sichtbar vor den Feldern) und `error` (Text nach den Feldern), (c) „`abschnittStatusItem` = Statuspille“.
- Die Render-Tests prüfen nur, was `@jm/settings` selbst ausgibt: Texte, `data-gesperrt`/`data-fehler`, vorhandene oder
  ausgeblendete Felder (über ihre Beschriftung `>Name<`), `disabled`, `role="switch"` und die `aria-*`/`for`-Verweise
  über `pruefeIdVerweise`. Auf Klassen von `@jm/ui` prüft Block C nicht.
- Vorrang in jeder Ableitung (wo zutreffend): `error` (SectionInput) → spezifischer Fehler → Warnung → `unbekannt` → ok/off.
- **Mutationsprobe (G9) gegen den Index statt in einer Kopie (Entscheidung Z3):** Eine Kopie von `packages/settings` fände `@jm/ui` nur über
  Junctions. Deshalb stagt jede Aufgabe ihre Dateien zuerst (`git add` mit expliziten Pfaden), baut dann jede Mutation
  allein mit dem Edit-Werkzeug ein, lässt den Selbsttest laufen und holt die Datei mit `git checkout -- <pfad>` aus dem
  Index zurück. Am Ende zeigt `git status --short` nur Einträge mit leerer zweiter Spalte (`A `, `M `), also nichts
  Ungestagtes aus den Proben.
- Gemessen wurde in einer frischen Kopie des Worktree-Stands `5a14352934`, Blöcke A und B nach den Schnittstellen 9.1–9.8
  als Stand-ins nachgebaut (siehe „Nachgerechnet“ je Aufgabe). Beim Zusammensetzen lief jede Aufgabe noch einmal mit dem
  echten Code aus Block A und B (Kopf „Gemessene Zählstände“): dieselben Rot-Meldungen, dieselben Zählstände (damals 1, 30,
  42, 83, 121, 176, 220, 270, 301) und jede Mutation mit genau den genannten `FAIL`-Zeilen. Gegenprobe gegen die echten
  Bausteine: Derselbe Endstand von `packages/settings` lief zusätzlich gegen `packages/ui` aus der Messkopie des
  Block-B-Schreibers (`kopie-b`, Bausteine aus Tasks 8–15 samt deren Grundlagen) – damals 301 × `ok`, `ALLE TESTS OK`, `tsc`
  für `@jm/settings` ohne Meldung. Nach der Nachbesserung (Review) neu gemessen, Plantext Tasks 1–22 maschinell in eine
  frische Kopie: Zählstände 1, 31, 44, 90, 131, 190, 237, 289, 323, jede Mutation rot wie angegeben. Nach der zweiten
  Nachbesserung (Tasks 16, 17, 18, 20, 21 geändert) ebenso: 1, 31, 45, 94, 136, 195, 243, 295, 329.

---

### Task 16: Paket `@jm/settings`: Gerüst, Vertrag, `SectionFrame`, Quellregeln

**Spec:** 6 (neues Paket, nur Typen von `@jm/control-config`), 6.1 (Vertrag, Sperre nie ohne Grund, Texte fest im Paket),
7.2 (unbekannt ≠ ok), 7.4 (nie `live`), 3.8 (ohne Electron), 11 (Selbsttest). Plan: E1, E19, G1, G3–G5, G7, G9–G13.

**Arbeitsverzeichnis/Voraussetzung:** der Worktree dieses Plans, alle Pfade relativ zur Repo-Wurzel. Tasks 1–15 sind
committet; gebraucht werden daraus: `@jm/ui/testhilfe` (Task 1), `UNBEKANNT` und die Status-Typen (Task 5),
`StatusPill` (Task 8), `PanelAnker` (Task 13), die Token-Dateien `signal-colors.css` und `sizes.css` (Task 3) sowie das
bestehende `SettingsSection`.

**Dateien:**
- Create: `packages/settings/package.json`, `packages/settings/tsconfig.json`
- Create: `packages/settings/src/vertrag.ts`, `packages/settings/src/SectionFrame.tsx`, `packages/settings/src/index.ts`
- Create: `packages/settings/test/selftest.ts` (**Einfügemarke für neue Testmodule ist die Zeile `abschluss();`**, neue
  `import`-Zeilen stehen direkt davor), `packages/settings/test/hilfe.ts`, `packages/settings/test/vertrag.test.tsx`,
  `packages/settings/test/quellregeln.test.ts`
- Modify: `package-lock.json` (nur durch `npm install --ignore-scripts --package-lock-only --offline`; neuer
  Workspace-Eintrag `"packages/settings"` und Lock-Eintrag `"node_modules/@jm/settings"` als Link, 25 neue Zeilen)

**Interfaces:**
- Consumes:
  - `@jm/ui` (9.2, 9.3, 9.7): `UNBEKANNT`, `type StatusState`, `type StatusGroup`, `type StatusItem`,
    `StatusPill({ state, text })`, `PanelAnker({ id, children })`, `SettingsSection({ title, right, children })`.
  - `@jm/ui/testhilfe` (9.1): `ok`, `gleich`, `enthaelt`, `enthaeltNicht`, `render`, `pruefeIdVerweise`, `leseText`,
    `abschluss`.
- Produces (exakt 9.9; Zusätze sind markiert):
  ```ts
  // packages/settings/src/vertrag.ts
  export interface SectionStatus { state: StatusState; text: string }                       // Spec 6.1 wörtlich
  export interface SectionBase { id: string; status: SectionStatus; locked?: string; error?: string }  // Spec 6.1 wörtlich
  export type SectionInput = Omit<SectionBase, 'status'>;
  export type AbschnittZustand = Exclude<StatusState, 'live'>;
  export const ABSCHNITT_TEXTE: {
    imLauncherEinrichten: 'Im Launcher einrichten'; anOhneRueckmeldung: 'an (ohne Rückmeldung)'; aus: 'aus';
    gesperrtVomMaster: 'Vom Master vorgegeben';
    gesperrt: (grund: string) => string;            // Zusatz: „Gesperrt: {grund}“
    bitteWaehlen: '– bitte wählen –';               // Zusatz: Platzhalter, wenn '' keine echte Option ist
    nochNichtUebernommen: 'Noch nicht übernommen.'; // Zusatz (E27): Text-Entwurf nach der Frist (Task 17)
  };
  export function st(state: AbschnittZustand, text: string): SectionStatus;   // wirft bei 'live'
  export const STATUS_UNBEKANNT: SectionStatus;                               // { state: 'off', text: 'unbekannt' }, eingefroren
  export function fehlerStatus(detail: string): SectionStatus;               // { state: 'error', text: `Fehler: ${detail}` }
  export function istGesperrt(view: Pick<SectionBase, 'locked'>): boolean;   // Zusatz: leerer Grund zählt nicht
  export function hatFehler(input: Pick<SectionBase, 'error'>): input is { error: string };   // Zusatz: leerer Text zählt nicht
  export function abschnittStatusItem(view: SectionBase, eintrag: { group: StatusGroup; label: string; detail?: string }): StatusItem;
  // packages/settings/src/SectionFrame.tsx
  export interface SectionFrameProps { view: SectionBase; titel: string; children: ReactNode }
  export function SectionFrame(p: SectionFrameProps): React.JSX.Element;
  export interface AnzeigeProps { label: string; children: ReactNode; hinweis?: string }   // Zusatz, nicht in index.ts
  export function Anzeige(p: AnzeigeProps): React.JSX.Element;                               // Nur-Lese-Zeile der Abschnitte
  // packages/settings/test/hilfe.ts (nur Tests)
  export function kreuz<A extends Record<string, readonly unknown[]>>(achsen: A): Array<{ [K in keyof A]: A[K][number] }>;
  export function fallText(f: Record<string, unknown>): string;
  export function statusText(s: SectionStatus): string;                     // `${state} ${text}`
  export function pruefeFaelle<F>(msg: string, faelle: readonly F[], pruefe: (f: F) => string | null): void;
  export function vergleiche(ist: string | undefined, soll: string | undefined): string | null;
  export function bedienelemente(html: string): string[];
  export function sperrZaehlung(html: string): { alle: number; gesperrt: number };
  export function vor(html: string, a: string, b: string): boolean;
  export function nachLetztem(html: string, a: string, b: string): boolean;
  export function bewegungsVerstoesse(html: string): string[];   // transition-Klassen, die reduced-motion nicht abschaltet
  ```
- Skripte in `packages/settings/package.json`: `"typecheck": "tsc --noEmit -p tsconfig.json"`, `"selftest": "tsx test/selftest.ts"`.

**Verhalten (verbindlich):**
- `SectionFrame`: `PanelAnker(id = view.id)` › `SettingsSection(title = titel, right = StatusPill(view.status))` › bei
  gesetztem, nicht leerem `locked` ein `<p data-gesperrt="true">Gesperrt: {locked}</p>` **vor** den Feldern › Felder ›
  bei nicht leerem `error` ein `<p data-fehler="true"><span aria-hidden="true">⚠</span> {error}</p>` **nach** den Feldern.
  Die Fehlerfarbe steht nur im Rand (`border-[var(--status-error)]`), der Text bleibt in Vordergrundfarbe (G7).
- `st('live', …)` wirft zur Laufzeit, auch wenn der Typ umgangen wird (Spec 7.4).
- Das Paket importiert `@jm/control-config` nur per `import type`, nutzt kein `window`, `document`, `navigator`,
  `globalThis`, `process.`, kein `electron` und kein `node:`. Alle festen Texte stehen in `vertrag.ts` bzw. in den
  `…_TEXTE` der Abschnitte; `.tsx`-Dateien enthalten keine Wörter als JSX-Text.
- Die Quellregeln (Step 8) gelten wie in Task 3 auch hier: keine rohen Farben, keine zusammengesetzten Klassen, keine
  Kurzform `…-(--…)`, jede `var(--…)` in `@jm/ui` definiert, Statusfarbe nie als Schrift, kein `--highlight`, Übergänge nur
  `motion-safe` und höchstens 150 ms. Dazu: keine Text-Prop in den Abschnitts-Props (Name auf …titel/…text/…label oder
  `string` außerhalb der Daten-Liste), Ausnahmen nur die drei aus E25.
- **tsconfig mit `../ui/src` im `include`:** tsx wendet die `compilerOptions` einer tsconfig nur auf Dateien an, die
  deren `include` erfasst. Ohne `../ui/src` übersetzt tsx die `@jm/ui`-Komponenten mit dem klassischen JSX-Transform,
  und der Test bricht mit `ReferenceError: React is not defined` ab (gemessen, Step 4). `tsc` prüft die `@jm/ui`-Quellen
  dadurch zusätzlich mit; das tat es über die Importe ohnehin.

---

- [ ] **Step 1: Gerüst anlegen** (zwei neue Dateien)

`packages/settings/package.json`:
```json
{
  "name": "@jm/settings",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Einstellungs-Abschnitte der Suite (Suite-UX-Update, Spec 6): gemeinsamer Vertrag, Rahmen und sieben Abschnitte. Rein darstellend, ohne IPC und ohne Electron.",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "selftest": "tsx test/selftest.ts"
  },
  "dependencies": {
    "@jm/control-config": "*",
    "@jm/ui": "*"
  },
  "peerDependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^22.7.5",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  }
}
```

`packages/settings/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "test", "../ui/src"]
}
```

- [ ] **Step 2: Workspace eintragen und Lockfile prüfen** (`package-lock.json`)

```
npm install --ignore-scripts --package-lock-only --offline; echo "Exit=$?"
git diff --stat -- package-lock.json
git diff -- package-lock.json | grep -c "^-[^-]"
git diff -- package-lock.json | grep -c '"packages/settings": {\|"node_modules/@jm/settings": {'
node -e "const P=require('./package-lock.json').packages;console.log(JSON.stringify(P['node_modules/@jm/settings']));console.log('unter packages/settings:',Object.keys(P).filter(k=>k.startsWith('packages/settings/node_modules')).length);console.log(['react','react-dom','typescript','tsx'].map(x=>x+'@'+P['node_modules/'+x].version).join(' '))"
```
Derselbe Weg wie in Task 1 und Task 23 (G12, Entscheidung Z2): `--package-lock-only` schreibt nur `package-lock.json` und
das versteckte `node_modules/.package-lock.json` (Paketordner bleiben unberührt; der Link `node_modules/@jm/settings`
entsteht erst mit `npm ci --ignore-scripts`), `--offline`
verhindert jeden Netzzugriff, `--ignore-scripts` stößt keine nativen Neubauten an. Erwartet (gemessen in einer abgetrennten
Kopie ohne `node_modules`, Lockfile im Stand nach Task 1):
```
found 0 vulnerabilities
Exit=0
 package-lock.json | 25 +++++++++++++++++++++++++
 1 file changed, 25 insertions(+)
0
2
{"resolved":"packages/settings","link":true}
unter packages/settings: 0
react@18.3.1 react-dom@18.3.1 typescript@5.9.3 tsx@4.22.4
```
Der Diff hat nur Einfügungen: den Eintrag `"packages/settings": {` (Name, Version, `dependencies` `@jm/control-config`/`@jm/ui`,
`devDependencies`, `peerDependencies` wie in `package.json`) und `"node_modules/@jm/settings": {` mit
`"resolved": "packages/settings", "link": true`. Der Link selbst entsteht in `node_modules` erst beim nächsten `npm ci`
(in der CI immer). Dieser Plan braucht ihn nicht: Kein Quelltext und kein Test importiert `@jm/settings` über den
Paketnamen, die Galerie importiert relativ (E20), und `npm run … -w @jm/settings` findet den Workspace über die
`workspaces` der Wurzel (gemessen: alle Läufe von Task 16–25 ohne Link grün). Zeigt der Diff gelöschte Zeilen oder eine
zweite Version eines Pakets: Lockfile zurücksetzen (`git checkout -- package-lock.json`), die Spannen in
`packages/settings/package.json` mit `apps/titler/package.json` abgleichen (G12) und erneut laufen lassen; gelingt das nicht,
ist die Aufgabe nicht fertig (melden).

- [ ] **Step 3: Prüfschritt – tsx übersetzt `@jm/ui`-Quellen aus einem settings-Test** (zwei neue Dateien)

`packages/settings/test/selftest.ts`:
```ts
// @jm/settings – Selbsttest ohne Electron und ohne Browser: npm run selftest -w @jm/settings
// tsx lädt die Testmodule, react-dom/server rendert mit renderToStaticMarkup (Spec 11).
// Einfügemarke: Neue Testmodule kommen als eigene import-Zeile direkt vor den Abschluss-Aufruf in der
// letzten Zeile. ES-Importe laufen vor dem Rumpf, der Abschluss zählt also alle Module mit.
import { abschluss } from '@jm/ui/testhilfe';
import './vertrag.test';
abschluss();
```

`packages/settings/test/vertrag.test.tsx` (erste Fassung, nur der Prüfschritt; Step 5 ersetzt die Datei):
```tsx
// Vertrag der Abschnitte (Spec 6.1, 7.2, 7.4) und Rahmen SectionFrame.
import { StatusPill } from '@jm/ui';
import { enthaelt, render } from '@jm/ui/testhilfe';

// ── Prüfschritt: tsx wendet `jsx: react-jsx` auch auf @jm/ui-Quellen an ──
// Die Komponente liegt in packages/ui/src, außerhalb dieses Pakets. Schlägt das fehl
// („React is not defined“), ist die Ursache zu melden, nicht zu umgehen.
{
  const html = render(<StatusPill state="ok" text="x" />);
  enthaelt(html, 'data-state="ok"', 'tsx: @jm/ui-Komponente aus einem settings-Test rendert');
}
```

```
npm run selftest -w @jm/settings
```
Erwartet (gemessen): genau eine Zeile `ok   tsx: @jm/ui-Komponente aus einem settings-Test rendert`, dann
`ALLE TESTS OK`, Exitcode 0. **Dieser Schritt muss grün sein, bevor es weitergeht.** Ist er rot, die Ausgabe melden
(Datei und Zeile des `ReferenceError`), nicht umgehen.

- [ ] **Step 4: Gegenprobe zum Prüfschritt** (`packages/settings/tsconfig.json`, danach zurück)

Mit dem Edit-Werkzeug, Vorher:
```json
  "include": ["src", "test", "../ui/src"]
```
Nachher:
```json
  "include": ["src", "test"]
```
`npm run selftest -w @jm/settings` → erwartet (gemessen): Abbruch vor der ersten `ok`-Zeile, Exitcode 1:
```
ReferenceError: React is not defined
    at StatusPill (…\packages\ui\src\components\StatusPill.tsx:…)
```
Danach die Zeile wieder auf `"include": ["src", "test", "../ui/src"]` setzen und Step 3 erneut grün sehen. Damit ist die
Unklarheit „tsx und Paket-tsconfig“ (Plan, Unklarheiten) beantwortet: tsx nutzt die tsconfig des Arbeitsverzeichnisses nur
für Dateien in deren `include`; `../ui/src` gehört deshalb hinein.

- [ ] **Step 5: Fehlschlagenden Test für Vertrag und Rahmen schreiben** (`test/hilfe.ts` neu, `test/vertrag.test.tsx` ganz ersetzt)

`packages/settings/test/hilfe.ts` (Testhilfen für alle Abschnittstests):
```ts
// Testhilfen nur für @jm/settings: Kreuzprodukt, Statusvergleich, Bedienelemente im HTML.
import { ok } from '@jm/ui/testhilfe';
import type { SectionStatus } from '../src/index';

type Achsen = Record<string, readonly unknown[]>;
export type Fall<A extends Achsen> = { [K in keyof A]: A[K][number] };

/** Alle Kombinationen der Achsen (vollständiges Kreuzprodukt), in fester Reihenfolge. */
export function kreuz<A extends Achsen>(achsen: A): Array<Fall<A>> {
  let faelle: Array<Record<string, unknown>> = [{}];
  for (const [name, werte] of Object.entries(achsen)) {
    faelle = faelle.flatMap((f) => werte.map((w) => ({ ...f, [name]: w })));
  }
  return faelle as Array<Fall<A>>;
}

/** Ein Fall als lesbare Zeile, `undefined` bleibt sichtbar (JSON ließe es weg). */
export function fallText(f: Record<string, unknown>): string {
  return Object.entries(f)
    .map(([k, v]) => `${k}=${v === undefined ? 'undefined' : JSON.stringify(v)}`)
    .join(' ');
}

/** Status als „state text“, damit ein Vergleich ein einziger String-Vergleich ist. */
export function statusText(s: SectionStatus): string {
  return `${s.state} ${s.text}`;
}

/** Prüft jeden Fall; eine ok-Zeile je Tabelle, bei Abweichung die ersten fünf Fälle mit ist/soll. */
export function pruefeFaelle<F extends Record<string, unknown>>(msg: string, faelle: readonly F[], pruefe: (f: F) => string | null): void {
  const abweichungen: string[] = [];
  for (const f of faelle) {
    const r = pruefe(f);
    if (r !== null) abweichungen.push(`${fallText(f)} → ${r}`);
  }
  ok(abweichungen.length === 0, `${msg} (${faelle.length} Fälle)`);
  for (const z of abweichungen.slice(0, 5)) console.log(`     ${z}`);
  if (abweichungen.length > 5) console.log(`     … und ${abweichungen.length - 5} weitere`);
}

/** Vergleich ist/soll für pruefeFaelle: null bei Gleichheit, sonst „ist: … soll: …“. */
export function vergleiche(ist: string | undefined, soll: string | undefined): string | null {
  return ist === soll ? null : `ist: ${ist ?? 'undefined'} soll: ${soll ?? 'undefined'}`;
}

/** Öffnende Tags aller Bedienelemente (button, input, select, textarea) im HTML. */
export function bedienelemente(html: string): string[] {
  return [...html.matchAll(/<(button|input|select|textarea)\b[^>]*>/g)].map((m) => m[0]);
}

/** Wie viele Bedienelemente es gibt und wie viele davon das Attribut disabled tragen. */
export function sperrZaehlung(html: string): { alle: number; gesperrt: number } {
  const liste = bedienelemente(html);
  return { alle: liste.length, gesperrt: liste.filter((t) => /\sdisabled=""/.test(t)).length };
}

/** Steht `a` im HTML vor `b` (beide vorhanden)? */
export function vor(html: string, a: string, b: string): boolean {
  const i = html.indexOf(a);
  const j = html.indexOf(b);
  return i > -1 && j > -1 && i < j;
}

/** Steht `a` im HTML nach dem letzten `b` (beide vorhanden)? */
export function nachLetztem(html: string, a: string, b: string): boolean {
  const i = html.indexOf(a);
  const j = html.lastIndexOf(b);
  return i > -1 && j > -1 && i > j;
}

/**
 * Übergänge, die `prefers-reduced-motion` nicht abschaltet (Plan G8, Spec 4.3): je Element die `transition…`-Klassen
 * ohne `motion-safe:`, wenn das Element nicht zugleich `motion-reduce:transition-none` trägt (Bestands-`Button`).
 */
export function bewegungsVerstoesse(html: string): string[] {
  const aus: string[] = [];
  for (const m of html.matchAll(/\sclass="([^"]*)"/g)) {
    const klassen = m[1].split(/\s+/);
    const offen = klassen.filter((k) => /^transition(-|$)/.test(k));
    if (offen.length > 0 && !klassen.includes('motion-reduce:transition-none')) aus.push(offen.join(' '));
  }
  return aus;
}
```

`packages/settings/test/vertrag.test.tsx` (ganze Datei):
```tsx
// Vertrag der Abschnitte (Spec 6.1, 7.2, 7.4) und Rahmen SectionFrame.
import { StatusPill } from '@jm/ui';
import { enthaelt, enthaeltNicht, gleich, ok, render } from '@jm/ui/testhilfe';
import {
  ABSCHNITT_TEXTE,
  abschnittStatusItem,
  fehlerStatus,
  hatFehler,
  istGesperrt,
  SectionFrame,
  st,
  STATUS_UNBEKANNT,
  type AbschnittZustand,
  type SectionBase,
} from '../src/index';
import { bewegungsVerstoesse, fallText, kreuz, sperrZaehlung } from './hilfe';

// ── Prüfschritt: tsx wendet `jsx: react-jsx` auch auf @jm/ui-Quellen an ──
// Die Komponente liegt in packages/ui/src, außerhalb dieses Pakets. Schlägt das fehl
// („React is not defined“), ist die Ursache zu melden, nicht zu umgehen.
{
  const html = render(<StatusPill state="ok" text="x" />);
  enthaelt(html, 'data-state="ok"', 'tsx: @jm/ui-Komponente aus einem settings-Test rendert');
}

// ── Vertrag ──
{
  gleich(STATUS_UNBEKANNT, { state: 'off', text: 'unbekannt' }, 'Vertrag: STATUS_UNBEKANNT = off/unbekannt (Spec 7.2)');
  ok(Object.isFrozen(STATUS_UNBEKANNT), 'Vertrag: STATUS_UNBEKANNT ist eingefroren');
  gleich(fehlerStatus('Port 8729 belegt'), { state: 'error', text: 'Fehler: Port 8729 belegt' }, 'Vertrag: fehlerStatus');
  gleich(st('warn', 'startet'), { state: 'warn', text: 'startet' }, 'Vertrag: st baut den Status');
  let geworfen = false;
  try {
    st('live' as AbschnittZustand, 'sendet');
  } catch {
    geworfen = true;
  }
  ok(geworfen, "Vertrag: st() lehnt 'live' zur Laufzeit ab (wirft, Spec 7.4)");
  ok(istGesperrt({ locked: 'Vom Master vorgegeben' }) && !istGesperrt({}) && !istGesperrt({ locked: '' }), 'Vertrag: istGesperrt – leerer Grund zählt nicht');
  ok(hatFehler({ error: 'x' }) && !hatFehler({}) && !hatFehler({ error: '' }), 'Vertrag: hatFehler – leerer Text zählt nicht');
  gleich<unknown>(
    ABSCHNITT_TEXTE,
    {
      imLauncherEinrichten: 'Im Launcher einrichten',
      anOhneRueckmeldung: 'an (ohne Rückmeldung)',
      aus: 'aus',
      gesperrtVomMaster: 'Vom Master vorgegeben',
      bitteWaehlen: '– bitte wählen –',
      nochNichtUebernommen: 'Noch nicht übernommen.',
    },
    'Vertrag: ABSCHNITT_TEXTE wörtlich (ohne Funktionen)',
  );
  ok(ABSCHNITT_TEXTE.gesperrt('Vom Master vorgegeben') === 'Gesperrt: Vom Master vorgegeben', 'Vertrag: Sperrtext „Gesperrt: {grund}“');

  const view: SectionBase = { id: 'ndi', status: { state: 'warn', text: 'an (ohne Rückmeldung)' } };
  gleich(
    abschnittStatusItem(view, { group: 'ausgabe', label: 'NDI' }),
    { id: 'ndi', group: 'ausgabe', label: 'NDI', state: 'warn', detail: 'an (ohne Rückmeldung)', settingsSection: 'ndi' },
    'Vertrag: abschnittStatusItem übernimmt id als settingsSection, state und Text',
  );
  gleich(
    abschnittStatusItem(view, { group: 'ausgabe', label: 'NDI', detail: 'JM Titler (REGIE-PC)' }).detail,
    'JM Titler (REGIE-PC)',
    'Vertrag: abschnittStatusItem – eigenes detail überschreibt den Statustext',
  );
  gleich(
    abschnittStatusItem({ id: 'iveo', status: STATUS_UNBEKANNT }, { group: 'verbindung', label: 'iveo' }).state,
    'off',
    'Vertrag: abschnittStatusItem – unbekannt bleibt off (nie ok)',
  );
}

// ── Testhilfen (test/hilfe.ts), auf die alle Abschnittstests bauen ──
{
  const k = kreuz({ a: [1, 2], b: ['x', undefined, 'z'] } as const);
  gleich(k.length, 6, 'Hilfe: kreuz liefert 2 × 3 = 6 Fälle');
  gleich(fallText(k[1]), 'a=1 b=undefined', 'Hilfe: fallText zeigt undefined');
  gleich(
    sperrZaehlung('<button disabled="">a</button><input disabled=""/><select></select><p>x</p>'),
    { alle: 3, gesperrt: 2 },
    'Hilfe: sperrZaehlung zählt button, input, select',
  );
  gleich(
    bewegungsVerstoesse(
      '<b class="a transition-colors"></b><i class="motion-safe:transition-colors"></i><u class="transition-opacity motion-reduce:transition-none"></u>',
    ),
    ['transition-colors'],
    'Hilfe: bewegungsVerstoesse findet transition ohne motion-safe und ohne motion-reduce:transition-none',
  );
}

// ── SectionFrame ──
const FELD = '<input data-feld="probe"/>';
function rahmen(view: SectionBase): string {
  return render(
    <SectionFrame view={view} titel="Probe-Abschnitt">
      <input data-feld="probe" />
    </SectionFrame>,
  );
}
{
  const html = rahmen({ id: 'probe', status: { state: 'ok', text: 'sendet' } });
  enthaelt(html, '<h3', 'SectionFrame: Titel als h3');
  enthaelt(html, '>Probe-Abschnitt</h3>', 'SectionFrame: Titel steht im h3');
  ok(html.indexOf('</h3>') < html.indexOf('data-state="ok"'), 'SectionFrame: StatusPill rechts neben dem Titel');
  enthaelt(html, '>sendet</span>', 'SectionFrame: Statustext in der Pille');
  enthaelt(html, 'id="einstellung-probe"', 'SectionFrame: Anker einstellung-<id>');
  enthaelt(html, 'data-section-id="probe"', 'SectionFrame: Anker trägt die Abschnitts-id');
  enthaeltNicht(html, 'data-gesperrt', 'SectionFrame: ohne locked kein Sperrtext');
  enthaeltNicht(html, 'data-fehler', 'SectionFrame: ohne error kein Fehlertext');
}
{
  const html = rahmen({ id: 'probe', status: { state: 'off', text: 'aus' }, locked: 'Vom Master vorgegeben' });
  enthaelt(html, '>Gesperrt: Vom Master vorgegeben</p>', 'SectionFrame locked: „Gesperrt: {grund}“ sichtbar');
  ok(html.indexOf('data-gesperrt="true"') > -1 && html.indexOf('data-gesperrt="true"') < html.indexOf(FELD), 'SectionFrame locked: Sperrtext vor den Feldern');
  enthaeltNicht(rahmen({ id: 'probe', status: { state: 'off', text: 'aus' }, locked: '' }), 'data-gesperrt', 'SectionFrame locked: leerer Grund zeigt nichts');
}
{
  const html = rahmen({ id: 'probe', status: fehlerStatus('Port belegt'), error: 'Port 8729 belegt' });
  enthaelt(html, '<span aria-hidden="true">⚠</span> Port 8729 belegt</p>', 'SectionFrame error: „⚠ {text}“, Symbol aria-hidden');
  ok(html.indexOf('data-fehler="true"') > html.indexOf(FELD), 'SectionFrame error: Fehlertext nach den Feldern');
  const beides = rahmen({ id: 'probe', status: fehlerStatus('x'), locked: 'Grund', error: 'Fehlertext' });
  ok(
    beides.indexOf('data-gesperrt') < beides.indexOf(FELD) && beides.indexOf(FELD) < beides.indexOf('data-fehler'),
    'SectionFrame: Reihenfolge Sperrgrund → Felder → Fehlertext',
  );
}
```

```
npm run selftest -w @jm/settings
```
Erwartet (gemessen): Abbruch vor dem ersten Test, Exitcode 1:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\packages\settings\src\index' imported from …\packages\settings\test\vertrag.test.tsx
```

- [ ] **Step 6: Vertrag, Rahmen und Einstieg anlegen** (drei neue Dateien)

`packages/settings/src/vertrag.ts`:
```ts
// --- @jm/settings: gemeinsamer Vertrag der Einstellungs-Abschnitte (Spec 6.1, 7) ---
//
// Ein Abschnitt bekommt Rohdaten (`SectionInput` plus eigene Felder) und leitet daraus in einer
// reinen Funktion `…View(props)` seine Sicht ab. Die Sicht erfüllt `SectionBase` aus Spec 6.1:
// Der Status wird im Paket berechnet, nicht vom Tool geliefert (Plan E1). So liegen alle
// Statustexte fest im Paket (6.1) und die Regeln aus Spec 7 sind hier als Kreuzprodukt testbar.
import { UNBEKANNT, type StatusGroup, type StatusItem, type StatusState } from '@jm/ui';

/** Spec 6.1 wörtlich. */
export interface SectionStatus { state: StatusState; text: string }

/** Spec 6.1 wörtlich: die abgeleitete Sicht eines Abschnitts. */
export interface SectionBase {
  id: string;                  // Sprungziel für StatusItem.settingsSection
  status: SectionStatus;
  locked?: string;             // gesperrt + Grund, z. B. „Vom Master vorgegeben“
  error?: string;              // Fehlertext, immer unter den Feldern
}

/** Eingabe jedes Abschnitts (Plan E1): alles aus SectionBase außer dem Status. */
export type SectionInput = Omit<SectionBase, 'status'>;

/** Spec 7.4: Abschnitte melden nie `live`. */
export type AbschnittZustand = Exclude<StatusState, 'live'>;

/** Feste Texte, die mehrere Abschnitte teilen. */
export const ABSCHNITT_TEXTE = {
  imLauncherEinrichten: 'Im Launcher einrichten',
  anOhneRueckmeldung: 'an (ohne Rückmeldung)',
  aus: 'aus',
  gesperrtVomMaster: 'Vom Master vorgegeben',
  gesperrt: (grund: string) => `Gesperrt: ${grund}`,
  bitteWaehlen: '– bitte wählen –',
  nochNichtUebernommen: 'Noch nicht übernommen.',
} as const;

/** Status eines Abschnitts bauen. Wirft bei `live` (Spec 7.4), auch wenn der Typ umgangen wird. */
export function st(state: AbschnittZustand, text: string): SectionStatus {
  if ((state as StatusState) === 'live') throw new Error('Ein Einstellungs-Abschnitt meldet nie „live“ (Spec 7.4).');
  return { state, text };
}

/** Spec 7.2: Unbekannt ist `off` mit Text „unbekannt“, nie `ok`. */
export const STATUS_UNBEKANNT: SectionStatus = Object.freeze({ state: 'off', text: UNBEKANNT });

/** Fehler aus `SectionInput.error` bzw. ein gemessener Fehler: „Fehler: {detail}“. */
export function fehlerStatus(detail: string): SectionStatus {
  return st('error', `Fehler: ${detail}`);
}

/** Ist der Abschnitt gesperrt? Ein leerer Grund zählt nicht (gesperrt nie ohne Grund). */
export function istGesperrt(view: Pick<SectionBase, 'locked'>): boolean {
  return typeof view.locked === 'string' && view.locked !== '';
}

/** Hat der Abschnitt einen Fehlertext? Ein leerer Text zählt nicht. */
export function hatFehler(input: Pick<SectionBase, 'error'>): input is { error: string } {
  return typeof input.error === 'string' && input.error !== '';
}

/**
 * Statusleisten-Eintrag aus der Sicht eines Abschnitts: gleicher Zustand wie die Statuspille,
 * Detail = Statustext (oder ein eigenes Detail des Tools), Klick springt zum Abschnitt.
 */
export function abschnittStatusItem(
  view: SectionBase,
  eintrag: { group: StatusGroup; label: string; detail?: string },
): StatusItem {
  return {
    id: view.id,
    group: eintrag.group,
    label: eintrag.label,
    state: view.status.state,
    detail: eintrag.detail ?? view.status.text,
    settingsSection: view.id,
  };
}
```

`packages/settings/src/SectionFrame.tsx`:
```tsx
// --- @jm/settings: Rahmen eines Einstellungs-Abschnitts (Spec 6.1) ---
//
// Kopf mit Titel und Statuspille, Sperrgrund VOR den Feldern, Felder, Fehlertext immer NACH den
// Feldern. Der Anker (`einstellung-<id>`) ist das Sprungziel aus der Statusleiste (Spec 3.6).
// Statusfarben färben nur Ränder und Symbole, nie Wörter (Plan G7).
import { PanelAnker, SettingsSection, StatusPill } from '@jm/ui';
import type { ReactNode } from 'react';
import { ABSCHNITT_TEXTE, hatFehler, istGesperrt, type SectionBase } from './vertrag';

export interface SectionFrameProps { view: SectionBase; titel: string; children: ReactNode }

export function SectionFrame({ view, titel, children }: SectionFrameProps): React.JSX.Element {
  return (
    <PanelAnker id={view.id}>
      <SettingsSection title={titel} right={<StatusPill state={view.status.state} text={view.status.text} />}>
        {istGesperrt(view) ? (
          <p data-gesperrt="true" className="border-l-2 border-[var(--border)] pl-2 text-xs text-[var(--muted-foreground)]">
            {ABSCHNITT_TEXTE.gesperrt(view.locked ?? '')}
          </p>
        ) : null}
        <div className="space-y-3">{children}</div>
        {hatFehler(view) ? (
          <p data-fehler="true" className="border-l-2 border-[var(--status-error)] pl-2 text-xs text-[var(--foreground)] select-text">
            <span aria-hidden="true">⚠</span>
            {` ${view.error}`}
          </p>
        ) : null}
      </SettingsSection>
    </PanelAnker>
  );
}

/** Nur-Lese-Zeile eines Abschnitts (Wert, den das Tool meldet): Beschriftung, Wert, optional Hinweis. */
export interface AnzeigeProps { label: string; children: ReactNode; hinweis?: string }

export function Anzeige({ label, children, hinweis }: AnzeigeProps): React.JSX.Element {
  return (
    <div data-anzeige={label} className="space-y-1">
      <p className="text-xs font-semibold text-[var(--foreground)]">{label}</p>
      <div className="text-sm text-[var(--foreground)] select-text break-all">{children}</div>
      {hinweis ? <p className="text-[11px] text-[var(--muted-foreground)]">{hinweis}</p> : null}
    </div>
  );
}
```

`packages/settings/src/index.ts`:
```ts
// @jm/settings – Einstellungs-Abschnitte der Suite (Spec 6). Jede Aufgabe hängt ihre Zeilen am Ende an.
export {
  type SectionStatus,
  type SectionBase,
  type SectionInput,
  type AbschnittZustand,
  ABSCHNITT_TEXTE,
  st,
  STATUS_UNBEKANNT,
  fehlerStatus,
  istGesperrt,
  hatFehler,
  abschnittStatusItem,
} from './vertrag';
export { SectionFrame, type SectionFrameProps } from './SectionFrame';
```

- [ ] **Step 7: Test laufen lassen (grün)**

```
npm run selftest -w @jm/settings
```
Erwartet (gemessen): 31 Zeilen `ok`, keine `FAIL`, letzte Zeile `ALLE TESTS OK`, Exitcode 0. Unter anderem:
```
> @jm/settings@0.1.0 selftest
> tsx test/selftest.ts

ok   tsx: @jm/ui-Komponente aus einem settings-Test rendert
ok   Vertrag: STATUS_UNBEKANNT = off/unbekannt (Spec 7.2)
ok   Vertrag: st() lehnt 'live' zur Laufzeit ab (wirft, Spec 7.4)
ok   Vertrag: abschnittStatusItem übernimmt id als settingsSection, state und Text
ok   Hilfe: kreuz liefert 2 × 3 = 6 Fälle
ok   SectionFrame: Anker einstellung-<id>
ok   SectionFrame locked: Sperrtext vor den Feldern
ok   SectionFrame error: Fehlertext nach den Feldern
ok   SectionFrame: Reihenfolge Sperrgrund → Felder → Fehlertext

ALLE TESTS OK
```

- [ ] **Step 8: Quellregeln für `packages/settings/src`** (`test/quellregeln.test.ts` neu, `test/selftest.ts` eine Zeile)

`packages/settings/test/quellregeln.test.ts`:
```ts
// Statische Quellregeln für packages/settings/src (Plan G3–G5, G7, G8; Spec 3.8, 6, 6.1).
// Wächst automatisch mit: Jede neue Datei unter src/ wird geprüft.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { leseText, ok } from '@jm/ui/testhilfe';

function dateien(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? dateien(join(ordner, e.name)) : /\.tsx?$/.test(e.name) ? [join(ordner, e.name).replace(/\\/g, '/')] : [],
  );
}
const QUELLEN = dateien('src');
const TEXT = new Map(QUELLEN.map((p) => [p, leseText(p)] as const));
const UI_TOKENS = ['colors.css', 'typography.css', 'signal-colors.css', 'sizes.css'];

/** Alle Dateien, in denen `re` außerhalb von Kommentaren trifft (Block- und ganze Zeilenkommentare zählen nicht). */
function treffer(re: RegExp, nur: (p: string) => boolean = () => true): string[] {
  const aus: string[] = [];
  for (const [p, t] of TEXT) {
    if (!nur(p)) continue;
    const code = t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    if (re.test(code)) aus.push(p);
    re.lastIndex = 0;
  }
  return aus;
}
function regel(liste: string[], msg: string): void {
  ok(liste.length === 0, msg);
  if (liste.length > 0) console.log(`     in: ${liste.join(', ')}`);
}

ok(QUELLEN.includes('src/vertrag.ts') && QUELLEN.includes('src/SectionFrame.tsx'), `Quellregel settings: Dateiliste gelesen (${QUELLEN.length} Dateien)`);

regel(
  treffer(/\b(bg|text|border|ring|outline|fill|stroke|from|to|via)-(red|green|yellow|orange|amber|lime|emerald|neutral|gray|zinc|slate|stone|white|black)\b/),
  'Quellregel settings: keine rohen Farbklassen',
);
// Dieselben Muster wie die Quellregeln in packages/ui (Task 3): `var(--…${`, `prefix-${`, `prefix-[…${`.
const UTILITY =
  'bg|text|border|ring|outline|fill|stroke|h|w|min-h|min-w|max-h|max-w|p[xytrbl]?|m[xytrbl]?|gap|rounded|top|left|right|bottom|inset|z|opacity|duration|leading|tracking|font|grid-cols|col-span';
regel(
  [
    ...treffer(/var\(--[\w-]*\$\{/),
    ...treffer(new RegExp(`\\b(${UTILITY})-\\$\\{`)),
    ...treffer(new RegExp(`\\b(${UTILITY})-\\[[^\\]\\s]*\\$\\{`)),
  ],
  'Quellregel settings: keine zusammengesetzten Klassen',
);
// Wie Regel 9 in packages/ui (Task 3): Tailwind v4 kennt die Kurzform `bg-(--x)` für `bg-[var(--x)]`; sie liefe an den
// Regeln vorbei, die `var(--` suchen.
regel(treffer(/\b[\w:-]+-\(\s*--/), 'Quellregel settings: Tokens nur als …-[var(--…)], keine Kurzform …-(--…) (Tailwind v4)');
{
  const definiert = new Set<string>();
  for (const datei of UI_TOKENS) {
    for (const m of leseText(`../ui/src/tokens/${datei}`).matchAll(/(--[a-z0-9-]+)\s*:/g)) definiert.add(m[1]);
  }
  const fehlt: string[] = [];
  for (const [p, t] of TEXT) {
    const code = t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // Wie in packages/ui: der Name bis zum ersten Zeichen, das kein Namenszeichen ist (auch `var(--status-${…}`).
    for (const m of code.matchAll(/var\(\s*(--[\w-]+)/g)) if (!definiert.has(m[1])) fehlt.push(`${p}: ${m[1]}`);
  }
  ok(definiert.has('--control-h') && definiert.has('--status-error'), 'Quellregel settings: Token-Liste aus @jm/ui gelesen (neue Tokens enthalten)');
  regel(fehlt, 'Quellregel settings: jede var(--…) ist in @jm/ui definiert');
}
regel(
  treffer(/\b(window|document|navigator|globalThis)\b|from ['"](electron|node:[^'"]+)['"]|require\(|\bprocess\./),
  'Quellregel settings: kein window/document/navigator/globalThis, kein electron-, node:-Import, kein process. (Spec 3.8)',
);
regel(treffer(/localStorage|sessionStorage/), 'Quellregel settings: kein localStorage');
regel(treffer(/text-\[var\(--(tally|status)-/), 'Quellregel settings: Statusfarben nie als Schrift (nur Symbole, Ränder, Flächen)');
regel(treffer(/var\(--highlight\)/), 'Quellregel settings: kein --highlight (E23)');
regel(
  [
    ...treffer(/\banimate-|(?<!motion-safe:)(?<!motion-reduce:)\btransition(-[a-z]+)?\b(?=[\s'"`])/),
    ...treffer(/motion-reduce:(?!transition-none\b)/),
    // Dauer wie in packages/ui (Task 3, G8): duration-<n> höchstens 150, kein duration-[…]
    ...treffer(/\bduration-\[|\bduration-(?:15[1-9]|1[6-9]\d|[2-9]\d\d|\d{4,})\b/),
  ],
  'Quellregel settings: Übergänge nur motion-safe und höchstens 150 ms (motion-reduce nur als transition-none für den Bestands-Button), kein animate-',
);
regel(treffer(/import\s+(?!type\b)[^;]*from\s+['"]@jm\/control-config['"]/), 'Quellregel settings: @jm/control-config nur per import type');
{
  // Spec 6.1: Texte fest im Paket. Als Text-Prop gilt jede Prop der Abschnitts-Props, deren Name auf
  // titel/title/text/texte/label/labels endet (jeder Typ, also auch `backLabel`), und jede Prop vom Typ string, die
  // nicht in DATEN steht (Namen, Werte, Pfade und Zeitstempel des Tools). Ausgenommen sind nur die drei fertigen Texte
  // der App aus E25. Eine neue string-Prop muss also bewusst als Daten-Prop eingetragen werden.
  const DATEN = new Set([
    'NdiOutputSectionProps.sourceName', 'NdiOutputSectionProps.networkName', 'NdiOutputSectionProps.resolution',
    'NdiOutputSectionProps.fps', 'ScreenOutputSectionProps.background', 'RemoteControlSectionProps.companionModule',
    'IveoSectionProps.eventName', 'IveoSectionProps.stage', 'IveoSectionProps.staleSince',
    'DataLinkSectionProps.folder', 'DataLinkSectionProps.lastChange',
  ]);
  const AUSNAHMEN = new Set(['DataLinkSectionProps.sourceLine', 'DataLinkSectionProps.notice', 'DataLinkSectionProps.backLabel']);
  const mitText: string[] = [];
  for (const [p, t] of TEXT) {
    for (const m of t.matchAll(/export interface (\w+SectionProps) extends SectionInput \{([\s\S]*?)\n\}/g)) {
      for (const prop of m[2].matchAll(/(?:^|[;{\n])\s*(\w+)\??\s*(?::\s*([^;\n]*)|\()/g)) {
        const name = `${m[1]}.${prop[1]}`;
        const nachName = /(titel|title|text|texte|label|labels)$/i.test(prop[1]);
        const freierText = /^string\b/.test((prop[2] ?? '').trim()) && !DATEN.has(name);
        if ((nachName || freierText) && !AUSNAHMEN.has(name)) mitText.push(`${p}: ${name}`);
      }
    }
  }
  regel(mitText, 'Quellregel settings: keine Text-Prop in den Abschnitts-Props (Name …titel/…text/…label oder string außerhalb der Daten-Liste) außer E25 (Spec 6.1)');
}
regel(
  treffer(/(?<![=-])>\s*[A-Za-zÄÖÜäöüß][^<>{}]*[<{]/, (p) => p.endsWith('.tsx')),
  'Quellregel settings: keine festen Texte in .tsx (Texte stehen in vertrag.ts bzw. …_TEXTE)',
);
```

`packages/settings/test/selftest.ts`, Vorher:
```ts
abschluss();
```
Nachher:
```ts
import './quellregeln.test';
abschluss();
```

```
npm run selftest -w @jm/settings
```
Erwartet (gemessen): 45 Zeilen `ok`, keine `FAIL`, `ALLE TESTS OK`, Exitcode 0. Neu unter anderem:
```
ok   Quellregel settings: Dateiliste gelesen (3 Dateien)
ok   Quellregel settings: jede var(--…) ist in @jm/ui definiert
ok   Quellregel settings: @jm/control-config nur per import type
ok   Quellregel settings: Tokens nur als …-[var(--…)], keine Kurzform …-(--…) (Tailwind v4)
ok   Quellregel settings: Übergänge nur motion-safe und höchstens 150 ms (motion-reduce nur als transition-none für den Bestands-Button), kein animate-
ok   Quellregel settings: keine Text-Prop in den Abschnitts-Props (Name …titel/…text/…label oder string außerhalb der Daten-Liste) außer E25 (Spec 6.1)
ok   Quellregel settings: keine festen Texte in .tsx (Texte stehen in vertrag.ts bzw. …_TEXTE)
```
Die Regeln sind hier schon grün, weil der Code sie einhält; dass sie greifen, zeigt die Mutationsprobe (Step 10, M2, M7–M13).

- [ ] **Step 9: Typprüfung**

```
npm run typecheck -w @jm/settings
npm run typecheck -w @jm/ui
```
Erwartet (gemessen): beide ohne Meldung von `tsc`, Exitcode 0.

- [ ] **Step 10: Stagen und Mutationsprobe**

```
git add packages/settings/package.json packages/settings/tsconfig.json packages/settings/src/vertrag.ts packages/settings/src/SectionFrame.tsx packages/settings/src/index.ts packages/settings/test/selftest.ts packages/settings/test/hilfe.ts packages/settings/test/vertrag.test.tsx packages/settings/test/quellregeln.test.ts package-lock.json
```
Dann je Mutation allein: Vorher-Text mit dem Edit-Werkzeug ersetzen, `npm run selftest -w @jm/settings`, Datei mit
`git checkout -- <pfad>` zurückholen. Jede Mutation muss rot werden (Exitcode 1); erwartet sind die gemessenen `FAIL`-Zeilen.

**M1 · Fehlertext vor den Feldern** (`packages/settings/src/SectionFrame.tsx`, zwei Ersetzungen). Erste, Vorher:
```tsx
        <div className="space-y-3">{children}</div>
        {hatFehler(view) ? (
```
Nachher:
```tsx
        {hatFehler(view) ? (
```
Zweite, Vorher:
```tsx
          </p>
        ) : null}
      </SettingsSection>
```
Nachher:
```tsx
          </p>
        ) : null}
        <div className="space-y-3">{children}</div>
      </SettingsSection>
```
Erwartet: `FAIL SectionFrame error: Fehlertext nach den Feldern`, `FAIL SectionFrame: Reihenfolge Sperrgrund → Felder → Fehlertext`.

**M2 · `@jm/control-config` ohne `type`** (`packages/settings/src/vertrag.ts`). Vorher:
```ts
import { UNBEKANNT, type StatusGroup, type StatusItem, type StatusState } from '@jm/ui';
```
Nachher:
```ts
import { UNBEKANNT, type StatusGroup, type StatusItem, type StatusState } from '@jm/ui';
import { type SuiteControlConfig } from '@jm/control-config';
export type Probe = SuiteControlConfig;
```
Erwartet: `FAIL Quellregel settings: @jm/control-config nur per import type`.

**M3 · Unbekannt als ok** (`packages/settings/src/vertrag.ts`). Vorher:
```ts
Object.freeze({ state: 'off', text: UNBEKANNT })
```
Nachher:
```ts
Object.freeze({ state: 'ok', text: UNBEKANNT })
```
Erwartet: `FAIL Vertrag: STATUS_UNBEKANNT = off/unbekannt (Spec 7.2)`, `FAIL Vertrag: abschnittStatusItem – unbekannt bleibt off (nie ok)`.

**M4 · `st()` lässt `live` durch** (`packages/settings/src/vertrag.ts`). Vorher:
```ts
  if ((state as StatusState) === 'live') throw new Error
```
Nachher:
```ts
  if ((state as StatusState) === 'xlive') throw new Error
```
Erwartet: `FAIL Vertrag: st() lehnt 'live' zur Laufzeit ab (wirft, Spec 7.4)`.

**M5 · Leerer Sperrgrund sperrt** (`packages/settings/src/vertrag.ts`). Vorher:
```ts
  return typeof view.locked === 'string' && view.locked !== '';
```
Nachher:
```ts
  return typeof view.locked === 'string';
```
Erwartet: `FAIL Vertrag: istGesperrt – leerer Grund zählt nicht`, `FAIL SectionFrame locked: leerer Grund zeigt nichts`.

**M6 · Statusleisten-Eintrag ohne Sprungziel** (`packages/settings/src/vertrag.ts`). Vorher:
```ts
    detail: eintrag.detail ?? view.status.text,
    settingsSection: view.id,
```
Nachher:
```ts
    detail: eintrag.detail ?? view.status.text,
```
Erwartet: `FAIL Vertrag: abschnittStatusItem übernimmt id als settingsSection, state und Text`.

**M7 · Statusfarbe als Schrift** (`packages/settings/src/SectionFrame.tsx`). Vorher:
```tsx
text-xs text-[var(--foreground)] select-text
```
Nachher:
```tsx
text-xs text-[var(--status-error)] select-text
```
Erwartet: `FAIL Quellregel settings: Statusfarben nie als Schrift (nur Symbole, Ränder, Flächen)`.

**M8 · Fester Text in der `.tsx`** (`packages/settings/src/SectionFrame.tsx`). Vorher:
```tsx
            {ABSCHNITT_TEXTE.gesperrt(view.locked ?? '')}
```
Nachher:
```tsx
            Gesperrt: {view.locked}
```
Erwartet: `FAIL Quellregel settings: keine festen Texte in .tsx (Texte stehen in vertrag.ts bzw. …_TEXTE)`.

**M9 · Zusammengesetzte Klasse im Template-String** (`packages/settings/src/SectionFrame.tsx`; Review-Befund: das alte
Muster ließ sie durch). Vorher:
```tsx
          <p data-fehler="true" className="border-l-2 border-[var(--status-error)] pl-2 text-xs text-[var(--foreground)] select-text">
```
Nachher:
```tsx
          <p data-fehler="true" className={`border-l-2 border-[var(--status-${view.status.state})] pl-2 text-xs text-[var(--foreground)] select-text`}>
```
Erwartet: `FAIL Quellregel settings: keine zusammengesetzten Klassen`, `FAIL Quellregel settings: jede var(--…) ist in @jm/ui definiert`. Detail: `in: src/SectionFrame.tsx: --status-` (der Name endet am `${`).

**M10 · Text-Prop in den Abschnitts-Props** (`packages/settings/src/vertrag.ts`, eine Probe-Schnittstelle am Dateiende).
Vorher:
```ts
    settingsSection: view.id,
  };
}
```
Nachher:
```ts
    settingsSection: view.id,
  };
}
export interface ProbeSectionProps extends SectionInput {
  hinweisText?: string;
}
```
Erwartet: `FAIL Quellregel settings: keine Text-Prop in den Abschnitts-Props (Name …titel/…text/…label oder string außerhalb der Daten-Liste) außer E25 (Spec 6.1)`. Detail: `in: src/vertrag.ts: ProbeSectionProps.hinweisText`.

**M11 · Übergang länger als 150 ms** (`packages/settings/src/SectionFrame.tsx`; zweite Prüfrunde: die Regel prüfte keine
Dauer). Vorher:
```tsx
          <p data-fehler="true" className="border-l-2 border-[var(--status-error)] pl-2 text-xs text-[var(--foreground)] select-text">
```
Nachher:
```tsx
          <p data-fehler="true" className="border-l-2 border-[var(--status-error)] pl-2 text-xs text-[var(--foreground)] select-text motion-safe:transition-colors motion-safe:duration-300">
```
Erwartet: `FAIL Quellregel settings: Übergänge nur motion-safe und höchstens 150 ms (motion-reduce nur als transition-none für den Bestands-Button), kein animate-`. Detail: `in: src/SectionFrame.tsx`.

**M12 · Tailwind-Kurzform `…-(--…)`** (`packages/settings/src/SectionFrame.tsx`). Vorher:
```tsx
          <p data-fehler="true" className="border-l-2 border-[var(--status-error)] pl-2 text-xs text-[var(--foreground)] select-text">
```
Nachher:
```tsx
          <p data-fehler="true" className="border-l-2 border-(--status-error) pl-2 text-xs text-(--status-error) select-text">
```
Erwartet: `FAIL Quellregel settings: Tokens nur als …-[var(--…)], keine Kurzform …-(--…) (Tailwind v4)`, sonst keine Regel (auch `text-(--status-error)` fällt der Regel gegen Statusfarbe als Schrift nicht auf). Detail: `in: src/SectionFrame.tsx`.

**M13 · Freier Text in einer string-Prop ohne verräterischen Namen** (`packages/settings/src/vertrag.ts`; zweite
Prüfrunde: die alte Regel sah nur die Namensendung). Vorher:
```ts
    settingsSection: view.id,
  };
}
```
Nachher:
```ts
    settingsSection: view.id,
  };
}
export interface ProbeSectionProps extends SectionInput {
  meldung?: string;
}
```
Erwartet: `FAIL Quellregel settings: keine Text-Prop in den Abschnitts-Props (Name …titel/…text/…label oder string außerhalb der Daten-Liste) außer E25 (Spec 6.1)`. Detail: `in: src/vertrag.ts: ProbeSectionProps.meldung`.

Nach der letzten Probe:
```
git status --short
npm run selftest -w @jm/settings
```
Erwartet: nur Zeilen mit leerer zweiter Spalte (siehe Step 11) und wieder 45 × `ok`, `ALLE TESTS OK`.

- [ ] **Step 11: Commit** (im Bash-Werkzeug / Git Bash; Commit-Text ohne Umlaute)

```
git add packages/settings/package.json packages/settings/tsconfig.json packages/settings/src/vertrag.ts packages/settings/src/SectionFrame.tsx packages/settings/src/index.ts packages/settings/test/selftest.ts packages/settings/test/hilfe.ts packages/settings/test/vertrag.test.tsx packages/settings/test/quellregeln.test.ts package-lock.json
git status --short
```
Erwartet genau diese gestagten Zeilen (fremde, ungestagte `??`-Zeilen bleiben stehen; Warnungen „LF will be replaced by CRLF“
für neue Dateien sind harmlos):
```
M  package-lock.json
A  packages/settings/package.json
A  packages/settings/src/SectionFrame.tsx
A  packages/settings/src/index.ts
A  packages/settings/src/vertrag.ts
A  packages/settings/test/hilfe.ts
A  packages/settings/test/quellregeln.test.ts
A  packages/settings/test/selftest.ts
A  packages/settings/test/vertrag.test.tsx
A  packages/settings/tsconfig.json
```
Dann:
```
git commit -m "feat(settings): Paket @jm/settings - Vertrag, SectionFrame, Selbsttest" -m "Neues privates Paket packages/settings (Spec 6): SectionStatus und SectionBase woertlich aus Spec 6.1, Status wird im Paket abgeleitet (Plan E1), STATUS_UNBEKANNT ist off, st() wirft bei live (7.4). SectionFrame mit Anker, Statuspille, Sperrgrund vor und Fehlertext nach den Feldern. Selbsttest mit tsx und renderToStaticMarkup, Quellregeln fuer packages/settings/src (nur import type aus @jm/control-config, keine Texte in tsx, keine Statusfarbe als Schrift). tsconfig nimmt ../ui/src ins include, sonst uebersetzt tsx die @jm/ui-Komponenten ohne react-jsx." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- `ABSCHNITT_TEXTE` hat zwei Schlüssel mehr: `gesperrt(grund)` („Gesperrt: {grund}“, sonst stünde der Text als JSX in der
  `.tsx` oder müsste aus dem nicht exportierten `UI_TEXTE` kommen) und `bitteWaehlen` (Platzhalter der Auswahlen, damit ein
  leerer Wert im nativen `<select>` nicht still auf die erste Option springt). Die vier Gerüst-Texte sind unverändert.
- Zusätzlich exportiert: `istGesperrt`, `hatFehler` (leerer Grund bzw. leerer Fehlertext zählen nicht – „gesperrt nie ohne
  Grund“). `Anzeige` (Nur-Lese-Zeile) steht in `SectionFrame.tsx`, nicht in `index.ts`.
- Neue Datei `test/hilfe.ts` (Kreuzprodukt, Fall-Text, Zählung gesperrter Bedienelemente), weil alle sieben Abschnittstests
  sie brauchen. Drei ihrer Funktionen prüft `vertrag.test.tsx` selbst.
- `tsconfig.json` hat `"include": ["src", "test", "../ui/src"]` statt „wie ui, include `src`, `test`“ (Ergebnis des
  Prüfschritts, Step 3/4).
- Die Quellregel zur Umgebung ist strenger als in Task 3: In `packages/settings/src` steht gar kein `window`, `document`,
  `navigator` oder `globalThis` (die Abschnitte sind rein darstellend). Eine Probe mit `(window as any).jmps` rutschte durch
  das Muster `window.jm` (gemessen) – daher das strengere Muster.
- Mutationsprobe gegen den Index statt in einer Kopie (siehe Blockeinleitung).
- Step 2 beim Zusammensetzen auf denselben Lockfile-Weg wie Task 1 und 23 umgestellt (`--package-lock-only --offline`, Z2)
  und gemessen. Der Schreiber hatte ein volles `npm install --ignore-scripts` vorgesehen (nicht gemessen); das hätte im
  Worktree auch `node_modules` umgebaut, ohne dass der Plan den Link braucht.
- Zweite Nachbesserung (Prüfrunde 2): Die Quellregeln dieser Aufgabe sind an die von `packages/ui` angeglichen, wo sie
  auseinandergelaufen waren: Dauer `duration-<n>` ≤ 150 und kein `duration-[…]` (G8; vorher blieb `duration-300` grün,
  M11) und die Kurzform `…-(--…)` (Regel 9 aus Task 3; M12). Die Regel gegen Text-Props erfasst zusätzlich jede
  `string`-Prop außerhalb einer Daten-Liste (vorher sah sie nur die Namensendung, `sourceLine`, `notice` oder eine neue
  `meldung` kamen durch; M13), die Ausnahmen aus E25 stehen ausdrücklich da. `ABSCHNITT_TEXTE.nochNichtUebernommen` (E27,
  Task 17). Eine gemeinsame Regel-Datei für beide Pakete gibt es weiterhin nicht: Die Regeln laufen über verschiedene
  Hilfen (`suche` mit Zeilennummern in `packages/ui`, `treffer` je Datei hier), und `@jm/settings` dürfte Testcode aus
  `packages/ui/test` nur über einen weiteren Paket-Export lesen. Die Regeln stehen deshalb in beiden Dateien, mit derselben
  Wirkung; die Regeln hier verweisen auf Task 3.

**Nachgerechnet** (Kopie `kopie-c2` des Stands `5a14352934`, `node_modules` per Junction auf den Worktree,
`packages/settings/node_modules/@jm/ui` per Junction auf die Kopie-`packages/ui`; dort Block A/B als Stand-ins nach 9.1–9.8:
`test/harness.ts`, `tsconfig.json`, `lib/texte.ts`, `lib/status.ts`, `lib/eingabe.ts`, `StatusPill`, `Field`, `TextInput`,
`NumberInput`, `Toggle`, `Select`, `PanelAnker`, Token-Dateien aus Task 3; tsx 4.22.4, TypeScript 5.9.3, React 18.3.1, Node 24;
alle Code-Schritte wörtlich aus diesem Text eingespielt): Step 3 grün mit 1 × `ok`; Gegenprobe Step 4 rot mit `ReferenceError: React is not defined` in `packages/ui/src/components/StatusPill.tsx:9` (Zeile des Stand-ins); Step 5 rot mit `ERR_MODULE_NOT_FOUND … packages/settings/src/index`; Step 7 grün mit 30 × `ok`; Step 8 grün mit 42 × `ok`; Typprüfung `@jm/settings` und `@jm/ui` ohne Meldung. Mutationsprobe M1–M8 je rot mit genau den genannten Zeilen (2, 1, 2, 1, 2, 1, 1, 1 FAIL), danach wieder 42 × `ok`. Nach der Nachbesserung (Review: Hilfe `bewegungsVerstoesse`, Regeln „kein `--highlight`“, Template-Klassen, Text-Props) neu gemessen in einer frischen Kopie mit dem Plantext der Tasks 1–16: Step 7 grün mit 31 × `ok`, Step 8 grün mit 44 × `ok`, Mutationsprobe M1–M10 je rot (2, 1, 2, 1, 2, 1, 1, 1, 2, 1 FAIL). Vor dem Einspielen ins Gerüst zusätzlich gemessen: Das frühere Muster `window.jm` ließ `(window as any).jmps` durch (grün) – daher die strengere Umgebungsregel. Nicht gemessen: die `git`-Schritte. Step 2 ist beim Zusammensetzen in einer abgetrennten Kopie ohne `node_modules` gemessen (Ausgabe dort). Zweite Nachbesserung: frische Kopie, Plantext Tasks 1–16: Step 8 grün mit 45 × `ok`, Mutationsprobe M1–M13 je rot (2, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1 FAIL), Typprüfung beider Pakete grün. Gegenprobe mit den Quellregeln der ersten Nachbesserung (Test-Datei aus jener Fassung, sonst Endstand): M11, M12 und M13 blieben `ALLE TESTS OK`, die alte Regel ließ sie also durch; ebenso die Kurzform-Probe 3j aus Task 3 gegen die alte Regel dort.

---
### Task 17: `NdiOutputSection`

**Spec:** 6.2 (Zeile NDI-Ausgabe: „Ausgabe an/aus · Quellenname mit Vorschau des Namens im Netz · Auflösung* · Bildrate* ·
Transparenz*“), 7.1–7.4. Plan: E2 („an (ohne Rückmeldung)“ = `warn`), G5, G6, Review Focus 3.

**Arbeitsverzeichnis/Voraussetzung:** wie Task 16; Task 16 committet. Aus Block B: `Field`, `TextInput` (Task 10),
`Toggle`, `Select` (Task 11).

**Dateien:**
- Create: `packages/settings/src/entwurf.ts` (Text-Entwurf, auch Task 18), `packages/settings/src/abschnitte/ndi-output.ts`,
  `packages/settings/src/abschnitte/NdiOutputSection.tsx`, `packages/settings/test/ndi-output.test.tsx`
- Modify: `packages/settings/src/index.ts` (zwei Zeilen am Ende), `packages/settings/test/selftest.ts` (eine Zeile vor `abschluss();`)

**Interfaces:**
- Consumes: 9.9 (`SectionInput`, `SectionBase`, `ABSCHNITT_TEXTE`, `st`, `fehlerStatus`, `hatFehler`, `istGesperrt`,
  `SectionFrame`, `Anzeige`); aus `@jm/ui`: `zahlText`, `starteFrist` (Task 7, E27), `type SelectOption`, `Field({ label, hint, error })`,
  `TextInput({ value, onChange, onBlur, onKeyDown, disabled })`, `Toggle({ checked, onChange, disabled })`,
  `Select({ options, value, placeholder, onChange, disabled })`; Testhilfen aus `test/hilfe.ts`.
- Produces (Props wörtlich 9.10):
  ```ts
  // packages/settings/src/abschnitte/ndi-output.ts
  export interface NdiOutputSectionProps extends SectionInput {
    enabled: boolean; sending?: boolean; starting?: boolean; sourceName: string; networkName?: string; receivers?: number;
    resolution?: string; resolutionOptions?: SelectOption[]; fps?: string; fpsOptions?: SelectOption[]; transparency?: boolean;
    capabilities: { toggle?: boolean; rename?: boolean; resolution?: boolean; fps?: boolean; transparency?: boolean };
    onToggle?(next: boolean): void; onRename?(name: string): void; onResolution?(v: string): void;
    onFps?(v: string): void; onTransparency?(next: boolean): void;
  }
  export const NDI_TEXTE;   // titel 'NDI-Ausgabe'; ausgabe 'Ausgabe'; quellenname 'Quellenname'; aufloesung 'Auflösung';
                            // bildrate 'Bildrate'; transparenz 'Transparenz'; imNetz(name) 'Im Netz: {name}';
                            // keinName 'Kein Quellenname eingetragen.'; sendet 'sendet'; aus 'aus'; startet 'startet';
                            // anOhneRueckmeldung 'an (ohne Rückmeldung)'; anSendetNicht 'an, sendet aber nicht';
                            // ausSendetNoch 'aus, sendet aber noch'; empfaenger(n) '{n} Empfänger'
  export interface NdiOutputView extends SectionBase {
    sichtbar: { ausgabe: boolean; umbenennen: boolean; aufloesung: boolean; bildrate: boolean; transparenz: boolean };
    empfaenger?: string;    // nur wenn receivers eine Zahl ist
    hinweis?: string;       // „Kein Quellenname eingetragen.“ bzw. „Im Netz: {networkName}“
  }
  export function ndiOutputView(p: NdiOutputSectionProps): NdiOutputView;
  // packages/settings/src/abschnitte/NdiOutputSection.tsx
  export function NdiOutputSection(p: NdiOutputSectionProps): React.JSX.Element;
  // packages/settings/src/entwurf.ts (intern, nicht in index.ts; E27)
  export interface TextFeld { value: string; onChange(value: string): void; onBlur(): void; onKeyDown(e: KeyboardEvent<HTMLInputElement>): void }
  export interface TextEntwurf { feld: TextFeld; fehler?: string }          // feld per Spread an TextInput, fehler an Field
  export interface TextZustand { text: string; geaendert: boolean; gesendet?: string; fehler?: string }
  export type TextEreignis = { art: 'tippen'; text: string } | { art: 'uebernehmen' } | { art: 'verwerfen' }
    | { art: 'aussen'; wert: string } | { art: 'frist' };
  export function textZustandAus(wert: string): TextZustand;
  export function textSchritt(z: TextZustand, e: TextEreignis, wert: string, gueltig?: (neu: string) => boolean):
    { z: TextZustand; neu?: string; verbraucht: boolean };                  // dieselben Regeln wie zahlSchritt (Task 7)
  export function useTextEntwurf(wert: string, uebernehmen: (neu: string) => void, gueltig?: (neu: string) => boolean): TextEntwurf;
  ```

**Verhalten (verbindlich):**
- Ableitung, Vorrang von oben: `error` → error „Fehler: {error}“; `starting === true` → warn „startet“;
  `enabled && sending === true` → ok „sendet“; `enabled && sending === false` → error „an, sendet aber nicht“;
  `enabled && sending === undefined` → warn „an (ohne Rückmeldung)“ (E2); `!enabled && sending === true` → warn
  „aus, sendet aber noch“; sonst off „aus“. `sourceName` und `receivers` ändern den Status nie.
- `receivers` erscheint nur als „{n} Empfänger“, wenn es eine Zahl ist (also auch „0 Empfänger“), nie bei `undefined`.
- Hinweis unter dem Quellennamen: leerer Name (auch nur Leerzeichen) → „Kein Quellenname eingetragen.“, sonst mit
  `networkName` → „Im Netz: {networkName}“, sonst keiner.
- Darstellung in fester Reihenfolge: Ausgabe (`Toggle`, nur `capabilities.toggle`; „{n} Empfänger“ als Hilfetext, ohne
  Schalter als eigene Zeile) · Quellenname (`TextInput` mit `capabilities.rename`, sonst Nur-Lese-Zeile) · Auflösung,
  Bildrate (`Select`, nur mit der jeweiligen Capability, Platzhalter „– bitte wählen –“) · Transparenz (`Toggle`, nur mit
  Capability). Fehlende Capability blendet aus, graut nicht aus.
- Der Name gilt erst bei Enter oder beim Verlassen (`useTextEntwurf`): Ein NDI-Sender startet sonst je Tastendruck neu.
  Escape verwirft einen geänderten Entwurf und verbraucht die Taste (`preventDefault`, `stopPropagation`; Plan E8). Die
  Schritte rechnet die reine Funktion `textSchritt` mit denselben Regeln wie `zahlSchritt` in Task 7 (E27):
  - Ein neuer Wert von außen ersetzt einen angefangenen Entwurf **nicht**; er folgt nur, wenn der Entwurf unverändert war,
    schon gemeldet ist (das Tool hat geantwortet) oder schon dem neuen Wert entspricht.
  - Ein geänderter Text wird genau einmal gemeldet; ein zweites Verlassen meldet ihn nicht noch einmal.
  - Bleibt die Antwort `UEBERNAHME_FRIST_MS` aus (Effekt mit `starteFrist`), steht „⚠ Noch nicht übernommen.“ als Fehler
    am Feld (`Field` `error`), der Text bleibt.
  - `gueltig` (Task 18: Farbe `#RRGGBB`) verhindert, dass ein ungültiger Text gemeldet wird.
  Der Zustand liegt wie bei `NumberInput` in einer Ref, die jeder Schritt sofort schreibt; kein Updater liest eine Ref, die
  danach überschrieben wird (Review-Befund der zweiten Runde zur ersten Nachbesserung).
- `capabilities`: Jedes Feld erscheint genau dann, wenn **seine** Capability gesetzt ist (Kreuzprodukt über alle 32
  Kombinationen; dazu je Capability allein ein Render-Fall). Auch „Ausgabe an/aus“ hängt an `capabilities.toggle`, obwohl
  Spec 6.2 es ohne `*` nennt (E24: kein Tool hat heute einen NDI-Schalter in den Einstellungen).
- `locked` → jedes Bedienelement `disabled` (explizit `true`; ohne Sperre `undefined`, damit ein Sperrgrund aus `Field`
  weiter wirkt).

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (neue Datei `packages/settings/test/ndi-output.test.tsx`)

```tsx
// NdiOutputSection (Spec 6.2, 7): Ableitung als Kreuzprodukt, Darstellung je capabilities, Sperre, Fehler.
import { enthaelt, enthaeltNicht, gleich, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { abschnittStatusItem, NDI_TEXTE, NdiOutputSection, ndiOutputView, type NdiOutputSectionProps, type SectionStatus } from '../src/index';
import { textSchritt, textZustandAus } from '../src/entwurf';
import { leseText } from '@jm/ui/testhilfe';
import { bewegungsVerstoesse, kreuz, nachLetztem, pruefeFaelle, sperrZaehlung, statusText, vergleiche, vor } from './hilfe';

const s = (state: SectionStatus['state'], text: string): SectionStatus => ({ state, text });
const AUS = s('off', 'aus');
const STARTET = s('warn', 'startet');
const SENDET = s('ok', 'sendet');
const AN_OHNE = s('warn', 'an (ohne Rückmeldung)');
const AN_NICHT = s('error', 'an, sendet aber nicht');
const AUS_NOCH = s('warn', 'aus, sendet aber noch');
const FEHLER = s('error', 'Fehler: Testfehler');

// Tabelle Eingang → status. Zeile = enabled|sending, Spalte = starting undefined | false | true.
// Ein gesetzter error schlägt jede Zeile (FEHLER). sourceName und receivers ändern den Status nie.
const TABELLE: Record<string, [SectionStatus, SectionStatus, SectionStatus]> = {
  'false|undefined': [AUS, AUS, STARTET],
  'false|false': [AUS, AUS, STARTET],
  'false|true': [AUS_NOCH, AUS_NOCH, STARTET],
  'true|undefined': [AN_OHNE, AN_OHNE, STARTET],
  'true|false': [AN_NICHT, AN_NICHT, STARTET],
  'true|true': [SENDET, SENDET, STARTET],
};
const SPALTE = { undefined: 0, false: 1, true: 2 } as const;

const basis: NdiOutputSectionProps = { id: 'ndi', enabled: true, sourceName: 'JM Titler', capabilities: {} };

{
  const faelle = kreuz({
    enabled: [false, true],
    sending: [undefined, false, true],
    starting: [undefined, false, true],
    error: [undefined, 'Testfehler'],
    sourceName: ['', 'JM Titler'],
    receivers: [undefined, 0, 3],
  } as const);
  pruefeFaelle('NDI Kreuzprodukt: Eingang → status aus der Tabelle', faelle, (f) => {
    const soll = f.error ? FEHLER : TABELLE[`${f.enabled}|${f.sending}`][SPALTE[`${f.starting}`]];
    return vergleiche(statusText(ndiOutputView({ ...basis, ...f }).status), statusText(soll));
  });
  pruefeFaelle('NDI Kreuzprodukt: nie live, unbekanntes Senden nie ok', faelle, (f) => {
    const v = ndiOutputView({ ...basis, ...f });
    if (v.status.state === 'live') return 'live';
    return f.sending !== true && v.status.state === 'ok' ? 'ok ohne gemessenes Senden' : null;
  });
  pruefeFaelle('NDI Kreuzprodukt: Empfänger nur, wenn gemessen; „0 Empfänger“ nur bei 0', faelle, (f) =>
    vergleiche(ndiOutputView({ ...basis, ...f }).empfaenger, f.receivers === undefined ? undefined : `${f.receivers} Empfänger`),
  );
  pruefeFaelle('NDI Kreuzprodukt: Hinweis „Kein Quellenname eingetragen.“ genau bei leerem Namen', faelle, (f) =>
    vergleiche(ndiOutputView({ ...basis, ...f }).hinweis, f.sourceName === '' ? 'Kein Quellenname eingetragen.' : undefined),
  );
}

{
  gleich(ndiOutputView({ ...basis, networkName: 'REGIE-PC (JM Titler)' }).hinweis, 'Im Netz: REGIE-PC (JM Titler)', 'NDI: Vorschau „Im Netz: {name}“ nur mit networkName');
  gleich(ndiOutputView({ ...basis, sourceName: '   ', networkName: 'X' }).hinweis, 'Kein Quellenname eingetragen.', 'NDI: Name nur aus Leerzeichen gilt als leer');
  gleich(ndiOutputView({ ...basis, error: '' }).status, AN_OHNE, 'NDI: leerer error zählt nicht als Fehler');
  gleich(
    [NDI_TEXTE.titel, NDI_TEXTE.ausgabe, NDI_TEXTE.quellenname, NDI_TEXTE.aufloesung, NDI_TEXTE.bildrate, NDI_TEXTE.transparenz],
    ['NDI-Ausgabe', 'Ausgabe', 'Quellenname', 'Auflösung', 'Bildrate', 'Transparenz'],
    'NDI: Titel und Feldnamen wörtlich (Spec 6.2)',
  );
}

// ── Darstellung ──
const alle: NdiOutputSectionProps = {
  ...basis,
  sending: true,
  receivers: 2,
  networkName: 'REGIE-PC (JM Titler)',
  resolution: '1920x1080',
  resolutionOptions: [{ value: '1920x1080', label: '1920 × 1080' }],
  fps: '50',
  fpsOptions: [{ value: '50', label: '50' }],
  transparency: true,
  capabilities: { toggle: true, rename: true, resolution: true, fps: true, transparency: true },
};
{
  const html = render(<NdiOutputSection {...alle} />);
  for (const t of ['>NDI-Ausgabe<', '>Ausgabe<', '>Quellenname<', '>Auflösung<', '>Bildrate<', '>Transparenz<']) {
    enthaelt(html, t, `NDI alle capabilities: ${t}`);
  }
  ok((html.match(/role="switch"/g) ?? []).length === 2, 'NDI alle capabilities: zwei Schalter (Ausgabe, Transparenz) mit role="switch"');
  ok((html.match(/<select/g) ?? []).length === 2, 'NDI alle capabilities: zwei Auswahlen (Auflösung, Bildrate)');
  enthaelt(html, 'value="JM Titler"', 'NDI: Quellenname als Eingabe mit dem Wert');
  enthaelt(html, 'Im Netz: REGIE-PC (JM Titler)', 'NDI: Vorschau des Namens im Netz sichtbar');
  enthaelt(html, '2 Empfänger', 'NDI: gemessene Empfänger sichtbar');
  pruefeIdVerweise(html, 'NDI: alle aria-describedby/for-Verweise zeigen auf vorhandene ids');
  ok(vor(html, '>Ausgabe<', '>Quellenname<') && vor(html, '>Quellenname<', '>Auflösung<') && vor(html, '>Auflösung<', '>Bildrate<') && vor(html, '>Bildrate<', '>Transparenz<'), 'NDI: Felder in fester Reihenfolge');
  gleich(sperrZaehlung(html).gesperrt, 0, 'NDI ohne Sperre: kein Bedienelement disabled');
  gleich(bewegungsVerstoesse(html), [], 'NDI: Übergänge nur motion-safe (G8)');
}
// capabilities (Spec 6.1 „ausblenden, nicht ausgrauen“, Spec 11 „sichtbare Felder je capabilities“)
{
  const FELD = { toggle: 'ausgabe', rename: 'umbenennen', resolution: 'aufloesung', fps: 'bildrate', transparency: 'transparenz' } as const;
  const faelle = kreuz({ toggle: [false, true], rename: [false, true], resolution: [false, true], fps: [false, true], transparency: [false, true] } as const);
  pruefeFaelle('NDI capabilities: jedes Feld genau dann sichtbar, wenn seine eigene Capability gesetzt ist', faelle, (c) => {
    const s = ndiOutputView({ ...basis, capabilities: c }).sichtbar;
    const falsch = (Object.keys(FELD) as Array<keyof typeof FELD>).filter((cap) => s[FELD[cap]] !== c[cap]);
    return falsch.length === 0 ? null : `falsch: ${falsch.join(', ')}`;
  });
  const BESCHRIFTUNG = { toggle: '>Ausgabe<', resolution: '>Auflösung<', fps: '>Bildrate<', transparency: '>Transparenz<' } as const;
  const daneben: string[] = [];
  for (const cap of Object.keys(BESCHRIFTUNG) as Array<keyof typeof BESCHRIFTUNG>) {
    const html = render(<NdiOutputSection {...alle} capabilities={{ [cap]: true } as NdiOutputSectionProps['capabilities']} />);
    for (const [andere, t] of Object.entries(BESCHRIFTUNG)) if (html.includes(t) !== (andere === cap)) daneben.push(`${cap}: ${t}`);
  }
  const nurName = render(<NdiOutputSection {...alle} capabilities={{ rename: true }} />);
  if (!nurName.includes('<input') || nurName.includes('role="switch"') || nurName.includes('<select')) daneben.push('rename: nur das Eingabefeld');
  gleich(daneben, [], 'NDI je Capability allein: genau ihr Feld erscheint, kein anderes');
}
{
  const html = render(<NdiOutputSection {...alle} capabilities={{}} />);
  for (const t of ['>Ausgabe<', '>Auflösung<', '>Bildrate<', '>Transparenz<']) {
    enthaeltNicht(html, t, `NDI ohne capabilities: ${t} ausgeblendet (nicht ausgegraut)`);
  }
  gleich(sperrZaehlung(html), { alle: 0, gesperrt: 0 }, 'NDI ohne capabilities: kein Bedienelement');
  enthaelt(html, '>Quellenname<', 'NDI ohne rename: Quellenname als Anzeige');
  enthaeltNicht(html, '<input', 'NDI ohne rename: kein Eingabefeld');
  enthaelt(html, '>JM Titler</div>', 'NDI ohne rename: Name als Text');
  enthaelt(html, '2 Empfänger', 'NDI ohne toggle: Empfänger trotzdem sichtbar');
}
{
  const html = render(<NdiOutputSection {...alle} receivers={undefined} />);
  enthaeltNicht(html, 'Empfänger', 'NDI receivers undefined: keine Empfängerzahl, auch nicht 0');
  enthaelt(render(<NdiOutputSection {...alle} receivers={0} />), '0 Empfänger', 'NDI receivers 0: „0 Empfänger“');
}
{
  const html = render(<NdiOutputSection {...alle} locked="Vom Master vorgegeben" />);
  const z = sperrZaehlung(html);
  ok(z.alle === 5 && z.gesperrt === 5, `NDI locked: alle Bedienelemente disabled (${z.gesperrt} von ${z.alle})`);
  enthaelt(html, 'Gesperrt: Vom Master vorgegeben', 'NDI locked: Grund sichtbar');
  ok(vor(html, 'data-gesperrt="true"', 'role="switch"'), 'NDI locked: Grund vor den Feldern');
}
{
  const html = render(<NdiOutputSection {...alle} error="NDI-Laufzeit fehlt" />);
  enthaelt(html, 'data-state="error"', 'NDI error: Statuspille error');
  enthaelt(html, 'Fehler: NDI-Laufzeit fehlt', 'NDI error: Statustext „Fehler: {detail}“');
  ok(nachLetztem(html, 'data-fehler="true"', 'role="switch"'), 'NDI error: Fehlertext nach den Feldern');
}
{
  const p: NdiOutputSectionProps = { ...alle, sending: undefined };
  const view = ndiOutputView(p);
  const item = abschnittStatusItem(view, { group: 'ausgabe', label: 'NDI' });
  const html = render(<NdiOutputSection {...p} />);
  ok(
    item.state === view.status.state && html.includes(`data-state="${item.state}"`) && html.includes(`>${item.detail}</span>`),
    'NDI: abschnittStatusItem = Statuspille (Zustand und Text)',
  );
  gleich(item.detail, 'an (ohne Rückmeldung)', 'NDI: Statusleiste zeigt „an (ohne Rückmeldung)“');
}
// Text-Entwurf (E27, dieselben Regeln wie zahlSchritt in Task 7): Wert von außen, einmal melden, Frist, gültig, Escape
{
  const z0 = textZustandAus('JM Titler');
  gleich(
    [
      textSchritt(z0, { art: 'aussen', wert: 'REGIE' }, 'JM Titler').z.text,
      textSchritt({ text: 'JM Tit', geaendert: true }, { art: 'aussen', wert: 'REGIE' }, 'JM Titler').z.text,
      textSchritt({ text: 'REGIE ', geaendert: true }, { art: 'aussen', wert: 'REGIE' }, 'JM Titler').z.text,
    ],
    ['REGIE', 'JM Tit', 'REGIE'],
    'Text-Entwurf: Wert von außen folgt nur ohne angefangenen Entwurf (oder wenn der Entwurf ihm schon entspricht)',
  );
  const gemeldet = textSchritt({ text: 'REGIE', geaendert: true }, { art: 'uebernehmen' }, 'JM Titler');
  const nochmal = textSchritt(gemeldet.z, { art: 'uebernehmen' }, 'JM Titler');
  gleich(
    [gemeldet.neu, gemeldet.z, nochmal.neu],
    ['REGIE', { text: 'REGIE', geaendert: true, gesendet: 'REGIE' }, undefined],
    'Text-Entwurf: Enter oder Verlassen meldet einen geänderten Text genau einmal (kein Neustart je Fokuswechsel)',
  );
  const frist = textSchritt(gemeldet.z, { art: 'frist' }, 'JM Titler');
  gleich(
    [frist.z.fehler, frist.z.text, textSchritt(frist.z, { art: 'aussen', wert: 'REGIE-PC' }, 'REGIE-PC').z, textSchritt(z0, { art: 'frist' }, 'JM Titler').z],
    ['Noch nicht übernommen.', 'REGIE', { text: 'REGIE-PC', geaendert: false }, z0],
    'Text-Entwurf: ohne Antwort nach der Frist „Noch nicht übernommen.“, der Text bleibt; die Antwort des Tools schließt den Entwurf',
  );
  const farbe = (t: string): boolean => /^#[0-9a-fA-F]{6}$/.test(t);
  gleich(
    [
      textSchritt({ text: '#12', geaendert: true }, { art: 'uebernehmen' }, '#000000', farbe).neu,
      textSchritt({ text: 'REG', geaendert: true }, { art: 'verwerfen' }, 'JM Titler'),
      textSchritt(z0, { art: 'verwerfen' }, 'JM Titler').verbraucht,
    ],
    [undefined, { z: { text: 'JM Titler', geaendert: false }, verbraucht: true }, false],
    'Text-Entwurf: ungültiger Text wird nicht gemeldet; Escape verwirft einen geänderten Entwurf und gehört dann dem Feld',
  );
  const entwurf = leseText('src/entwurf.ts');
  const ndi = leseText('src/abschnitte/NdiOutputSection.tsx');
  ok(
    entwurf.split("schrittRef.current({ art: 'aussen', wert });").length === 2 &&
      entwurf.split("starteFrist(() => schrittRef.current({ art: 'frist' }))").length === 2 &&
      ndi.includes('error={name.fehler}') &&
      ndi.includes('<TextInput {...name.feld} disabled={sperre} />'),
    'Text-Entwurf Verdrahtung: Wert von außen und Frist im Effekt, „Noch nicht übernommen.“ als Feldfehler am Quellennamen',
  );
}
```

In `packages/settings/test/selftest.ts` eintragen, Vorher:
```ts
abschluss();
```
Nachher:
```ts
import './ndi-output.test';
abschluss();
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/settings
```
Erwartet (gemessen): Abbruch vor dem ersten Test, Exitcode 1:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\packages\settings\src\entwurf' imported from …\packages\settings\test\ndi-output.test.tsx
```
(Der Test importiert auch `../src/entwurf`, das erst Step 3 anlegt. Die frühere Angabe „does not provide an export named
'NDI_TEXTE'“ stammte aus der Zeit vor diesem Import; gemessen in der zweiten Nachbesserung, mit der Fassung der ersten
Nachbesserung ebenso.)

- [ ] **Step 3: Text-Entwurf `packages/settings/src/entwurf.ts`** (neue Datei)

```ts
// --- @jm/settings: Text-Entwurf für Eingaben, die erst beim Verlassen gelten ---
//
// Ein Quellenname oder eine Farbe soll nicht bei jedem Tastendruck beim Tool ankommen (ein NDI-
// Sender startete sonst je Buchstabe neu). Enter und Verlassen übernehmen, Escape verwirft einen
// geänderten Entwurf und verbraucht die Taste (das Panel bleibt offen, Plan E8). Ein gemeldeter Text
// wird nur einmal gemeldet; kommt er nicht innerhalb der Frist als Wert zurück, steht „Noch nicht
// übernommen.“ am Feld (E27, dieselben Regeln wie zahlSchritt in @jm/ui).
import { starteFrist } from '@jm/ui';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ABSCHNITT_TEXTE } from './vertrag';

/** Props des Eingabefelds (per Spread an TextInput). */
export interface TextFeld {
  value: string;
  onChange(value: string): void;
  onBlur(): void;
  onKeyDown(e: KeyboardEvent<HTMLInputElement>): void;
}

/** feld geht an TextInput, fehler (nach der Frist „Noch nicht übernommen.“) an Field. */
export interface TextEntwurf {
  feld: TextFeld;
  fehler?: string;
}

/** Text wie getippt; geaendert = weicht vom Wert ab; gesendet = gemeldet, aber noch nicht zurückgekommen (E27). */
export interface TextZustand {
  text: string;
  geaendert: boolean;
  gesendet?: string;
  fehler?: string;
}

export type TextEreignis =
  | { art: 'tippen'; text: string }
  | { art: 'uebernehmen' } // Enter oder Verlassen
  | { art: 'verwerfen' } // Escape
  | { art: 'aussen'; wert: string } // neuer Wert von außen
  | { art: 'frist' }; // die Frist nach dem Melden ist um

export function textZustandAus(wert: string): TextZustand {
  return { text: wert, geaendert: false };
}

/**
 * Ein Schritt des Entwurfs (dieselben Regeln wie zahlSchritt in @jm/ui). neu nur, wenn ein geänderter, gültiger Text
 * übernommen wird, der vom Wert abweicht und noch nicht gemeldet ist. verbraucht = Escape hat einen geänderten Entwurf
 * verworfen (dann gehört Escape dem Feld, nicht dem Panel).
 */
export function textSchritt(
  z: TextZustand,
  e: TextEreignis,
  wert: string,
  gueltig: (neu: string) => boolean = () => true,
): { z: TextZustand; neu?: string; verbraucht: boolean } {
  if (e.art === 'tippen') return { z: { text: e.text, geaendert: e.text !== wert }, verbraucht: false };
  if (e.art === 'uebernehmen') {
    const neu = z.text.trim();
    if (!z.geaendert || neu === wert) return { z: textZustandAus(wert), verbraucht: false };
    if (neu === z.gesendet || !gueltig(neu)) return { z, verbraucht: false };
    return { z: { text: z.text, geaendert: true, gesendet: neu }, neu, verbraucht: false };
  }
  if (e.art === 'verwerfen') return { z: textZustandAus(wert), verbraucht: z.geaendert };
  if (e.art === 'frist') {
    return { z: z.gesendet === undefined || z.fehler ? z : { ...z, fehler: ABSCHNITT_TEXTE.nochNichtUebernommen }, verbraucht: false };
  }
  // aussen: ein ungeänderter oder schon gemeldeter Entwurf folgt; ein angefangener bleibt stehen (nichts Getipptes geht verloren)
  if (!z.geaendert || z.gesendet !== undefined || z.text.trim() === e.wert) return { z: textZustandAus(e.wert), verbraucht: false };
  return { z, verbraucht: false };
}

/**
 * Text-Entwurf für ein Feld, das erst bei Enter oder Verlassen gilt. Wie NumberInput (Task 10): Jeder Schritt rechnet
 * textSchritt auf dem Stand in der Ref und schreibt Ref und State sofort; kein Updater liest eine Ref, die danach
 * überschrieben wird.
 */
export function useTextEntwurf(wert: string, uebernehmen: (neu: string) => void, gueltig?: (neu: string) => boolean): TextEntwurf {
  const [z, setZ] = useState<TextZustand>(() => textZustandAus(wert));
  const zRef = useRef(z);
  const wertRef = useRef(wert);
  wertRef.current = wert;
  const rueckrufe = useRef({ uebernehmen, gueltig });
  rueckrufe.current = { uebernehmen, gueltig };

  const schritt = (e: TextEreignis): { verbraucht: boolean } => {
    const r = textSchritt(zRef.current, e, wertRef.current, rueckrufe.current.gueltig);
    zRef.current = r.z;
    setZ(r.z);
    if (r.neu !== undefined) rueckrufe.current.uebernehmen(r.neu);
    return r;
  };
  const schrittRef = useRef(schritt);
  schrittRef.current = schritt;

  useEffect(() => {
    schrittRef.current({ art: 'aussen', wert });
  }, [wert]);
  useEffect(
    () => (z.gesendet === undefined ? undefined : starteFrist(() => schrittRef.current({ art: 'frist' }))),
    [z.gesendet],
  );

  return {
    fehler: z.fehler,
    feld: {
      value: z.text,
      onChange: (text) => schritt({ art: 'tippen', text }),
      onBlur: () => schritt({ art: 'uebernehmen' }),
      onKeyDown: (e) => {
        if (e.key === 'Enter') schritt({ art: 'uebernehmen' });
        else if (e.key === 'Escape' && schritt({ art: 'verwerfen' }).verbraucht) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
    },
  };
}
```

- [ ] **Step 4: Ableitung `packages/settings/src/abschnitte/ndi-output.ts`** (neue Datei)

```ts
// --- @jm/settings: NDI-Ausgabe (Spec 6.2, Regeln 7.1–7.3) ---
//
// Angezeigt wird nur Gemessenes: `sending` und `receivers` kommen aus dem Hauptprozess. Kennt das
// Tool nur seine Einstellung (Titler, Caption heute), steht „an (ohne Rückmeldung)“ (Plan E2: warn).
// Eine unbekannte Empfängerzahl erscheint nie als 0.
import { zahlText, type SelectOption } from '@jm/ui';
import { ABSCHNITT_TEXTE, fehlerStatus, hatFehler, st, type SectionBase, type SectionInput, type SectionStatus } from '../vertrag';

export interface NdiOutputSectionProps extends SectionInput {
  enabled: boolean;                  // Einstellung „Ausgabe an“
  sending?: boolean;                 // gemessen; undefined = keine Rückmeldung
  starting?: boolean;                // gemessen
  sourceName: string;                // '' = leer
  networkName?: string;              // fertiger Name im Netz, nur wenn die App ihn kennt
  receivers?: number;                // gemessen; undefined = unbekannt (nie als 0)
  resolution?: string; resolutionOptions?: SelectOption[];
  fps?: string; fpsOptions?: SelectOption[];
  transparency?: boolean;
  capabilities: { toggle?: boolean; rename?: boolean; resolution?: boolean; fps?: boolean; transparency?: boolean };
  onToggle?(next: boolean): void; onRename?(name: string): void; onResolution?(v: string): void;
  onFps?(v: string): void; onTransparency?(next: boolean): void;
}

export const NDI_TEXTE = {
  titel: 'NDI-Ausgabe',
  ausgabe: 'Ausgabe',
  quellenname: 'Quellenname',
  aufloesung: 'Auflösung',
  bildrate: 'Bildrate',
  transparenz: 'Transparenz',
  imNetz: (name: string) => `Im Netz: ${name}`,
  keinName: 'Kein Quellenname eingetragen.',
  sendet: 'sendet',
  aus: ABSCHNITT_TEXTE.aus,
  startet: 'startet',
  anOhneRueckmeldung: ABSCHNITT_TEXTE.anOhneRueckmeldung,
  anSendetNicht: 'an, sendet aber nicht',
  ausSendetNoch: 'aus, sendet aber noch',
  empfaenger: (n: number) => `${zahlText(n)} Empfänger`,
} as const;

export interface NdiOutputView extends SectionBase {
  sichtbar: { ausgabe: boolean; umbenennen: boolean; aufloesung: boolean; bildrate: boolean; transparenz: boolean };
  empfaenger?: string;               // „{n} Empfänger“, nur wenn receivers gemessen ist
  hinweis?: string;                  // „Kein Quellenname eingetragen.“ bzw. „Im Netz: {name}“
}

function ndiStatus(p: NdiOutputSectionProps): SectionStatus {
  if (hatFehler(p)) return fehlerStatus(p.error);
  if (p.starting === true) return st('warn', NDI_TEXTE.startet);
  if (p.enabled) {
    if (p.sending === true) return st('ok', NDI_TEXTE.sendet);
    if (p.sending === false) return st('error', NDI_TEXTE.anSendetNicht);
    return st('warn', NDI_TEXTE.anOhneRueckmeldung);
  }
  if (p.sending === true) return st('warn', NDI_TEXTE.ausSendetNoch);
  return st('off', NDI_TEXTE.aus);
}

export function ndiOutputView(p: NdiOutputSectionProps): NdiOutputView {
  const c = p.capabilities;
  const name = p.sourceName.trim();
  return {
    id: p.id,
    status: ndiStatus(p),
    locked: p.locked,
    error: p.error,
    sichtbar: {
      ausgabe: c.toggle === true,
      umbenennen: c.rename === true,
      aufloesung: c.resolution === true,
      bildrate: c.fps === true,
      transparenz: c.transparency === true,
    },
    empfaenger: typeof p.receivers === 'number' ? NDI_TEXTE.empfaenger(p.receivers) : undefined,
    hinweis: name === '' ? NDI_TEXTE.keinName : p.networkName ? NDI_TEXTE.imNetz(p.networkName) : undefined,
  };
}
```

- [ ] **Step 5: Komponente `packages/settings/src/abschnitte/NdiOutputSection.tsx`** (neue Datei)

```tsx
// --- @jm/settings: NdiOutputSection (Spec 6.2) ---
import { Field, Select, TextInput, Toggle } from '@jm/ui';
import { useTextEntwurf } from '../entwurf';
import { Anzeige, SectionFrame } from '../SectionFrame';
import { ABSCHNITT_TEXTE, istGesperrt } from '../vertrag';
import { NDI_TEXTE, ndiOutputView, type NdiOutputSectionProps } from './ndi-output';

export function NdiOutputSection(p: NdiOutputSectionProps): React.JSX.Element {
  const view = ndiOutputView(p);
  const sperre = istGesperrt(view) ? true : undefined;
  const name = useTextEntwurf(p.sourceName, (neu) => p.onRename?.(neu));
  return (
    <SectionFrame view={view} titel={NDI_TEXTE.titel}>
      {view.sichtbar.ausgabe ? (
        <Field label={NDI_TEXTE.ausgabe} hint={view.empfaenger}>
          <Toggle checked={p.enabled} onChange={(n) => p.onToggle?.(n)} disabled={sperre} />
        </Field>
      ) : view.empfaenger ? (
        <p className="text-xs text-[var(--muted-foreground)] tabular">{view.empfaenger}</p>
      ) : null}
      {view.sichtbar.umbenennen ? (
        <Field label={NDI_TEXTE.quellenname} hint={view.hinweis} error={name.fehler}>
          <TextInput {...name.feld} disabled={sperre} />
        </Field>
      ) : (
        <Anzeige label={NDI_TEXTE.quellenname} hinweis={view.hinweis}>
          {p.sourceName}
        </Anzeige>
      )}
      {view.sichtbar.aufloesung ? (
        <Field label={NDI_TEXTE.aufloesung}>
          <Select
            options={p.resolutionOptions ?? []}
            value={p.resolution ?? ''}
            placeholder={ABSCHNITT_TEXTE.bitteWaehlen}
            onChange={(v) => p.onResolution?.(v)}
            disabled={sperre}
          />
        </Field>
      ) : null}
      {view.sichtbar.bildrate ? (
        <Field label={NDI_TEXTE.bildrate}>
          <Select
            options={p.fpsOptions ?? []}
            value={p.fps ?? ''}
            placeholder={ABSCHNITT_TEXTE.bitteWaehlen}
            onChange={(v) => p.onFps?.(v)}
            disabled={sperre}
          />
        </Field>
      ) : null}
      {view.sichtbar.transparenz ? (
        <Field label={NDI_TEXTE.transparenz}>
          <Toggle checked={p.transparency === true} onChange={(n) => p.onTransparency?.(n)} disabled={sperre} />
        </Field>
      ) : null}
    </SectionFrame>
  );
}
```

- [ ] **Step 6: Exporte** (`packages/settings/src/index.ts`), Vorher:

```ts
export { SectionFrame, type SectionFrameProps } from './SectionFrame';
```
Nachher:
```ts
export { SectionFrame, type SectionFrameProps } from './SectionFrame';
export { type NdiOutputSectionProps, type NdiOutputView, NDI_TEXTE, ndiOutputView } from './abschnitte/ndi-output';
export { NdiOutputSection } from './abschnitte/NdiOutputSection';
```

- [ ] **Step 7: Test laufen lassen (grün)**

```
npm run selftest -w @jm/settings
```
Erwartet (gemessen): 94 Zeilen `ok` (45 aus Task 16, 49 neu), keine `FAIL`, `ALLE TESTS OK`, Exitcode 0. Neu unter anderem:
```
ok   NDI capabilities: jedes Feld genau dann sichtbar, wenn seine eigene Capability gesetzt ist (32 Fälle)
ok   NDI je Capability allein: genau ihr Feld erscheint, kein anderes
ok   Text-Entwurf: Wert von außen folgt nur ohne angefangenen Entwurf (oder wenn der Entwurf ihm schon entspricht)
ok   Text-Entwurf: Enter oder Verlassen meldet einen geänderten Text genau einmal (kein Neustart je Fokuswechsel)
ok   Text-Entwurf: ohne Antwort nach der Frist „Noch nicht übernommen.“, der Text bleibt; die Antwort des Tools schließt den Entwurf
ok   Text-Entwurf: ungültiger Text wird nicht gemeldet; Escape verwirft einen geänderten Entwurf und gehört dann dem Feld
ok   Text-Entwurf Verdrahtung: Wert von außen und Frist im Effekt, „Noch nicht übernommen.“ als Feldfehler am Quellennamen
ok   NDI Kreuzprodukt: Eingang → status aus der Tabelle (216 Fälle)
ok   NDI Kreuzprodukt: nie live, unbekanntes Senden nie ok (216 Fälle)
ok   NDI Kreuzprodukt: Empfänger nur, wenn gemessen; „0 Empfänger“ nur bei 0 (216 Fälle)
ok   NDI Kreuzprodukt: Hinweis „Kein Quellenname eingetragen.“ genau bei leerem Namen (216 Fälle)
ok   NDI ohne capabilities: >Transparenz< ausgeblendet (nicht ausgegraut)
ok   NDI receivers undefined: keine Empfängerzahl, auch nicht 0
ok   NDI locked: alle Bedienelemente disabled (5 von 5)
ok   NDI error: Fehlertext nach den Feldern
ok   NDI: abschnittStatusItem = Statuspille (Zustand und Text)
```

- [ ] **Step 8: Typprüfung**

```
npm run typecheck -w @jm/settings
npm run typecheck -w @jm/ui
```
Erwartet (gemessen): beide ohne Meldung von `tsc`, Exitcode 0.

- [ ] **Step 9: Stagen und Mutationsprobe**

```
git add packages/settings/src/entwurf.ts packages/settings/src/abschnitte/ndi-output.ts packages/settings/src/abschnitte/NdiOutputSection.tsx packages/settings/src/index.ts packages/settings/test/ndi-output.test.tsx packages/settings/test/selftest.ts
```
Je Mutation allein einbauen, `npm run selftest -w @jm/settings` (muss rot sein), mit `git checkout -- <pfad>` zurückholen.

**M1 · Unbekanntes Senden als ok** (`packages/settings/src/abschnitte/ndi-output.ts`). Vorher:
```ts
    return st('warn', NDI_TEXTE.anOhneRueckmeldung);
```
Nachher:
```ts
    return st('ok', NDI_TEXTE.sendet);
```
Erwartet: `FAIL NDI Kreuzprodukt: Eingang → status aus der Tabelle (216 Fälle)`, `FAIL NDI Kreuzprodukt: nie live, unbekanntes Senden nie ok (216 Fälle)`, `FAIL NDI: leerer error zählt nicht als Fehler`, `FAIL NDI: Statusleiste zeigt „an (ohne Rückmeldung)“`. Die Tabellenzeile druckt dabei die abweichenden Fälle, z. B.:
```
FAIL NDI Kreuzprodukt: Eingang → status aus der Tabelle (216 Fälle)
     enabled=true sending=undefined starting=undefined error=undefined sourceName="" receivers=undefined → ist: ok sendet soll: warn an (ohne Rückmeldung)
```

**M2 · Unbekannte Empfängerzahl als 0** (`packages/settings/src/abschnitte/ndi-output.ts`). Vorher:
```ts
typeof p.receivers === 'number' ? NDI_TEXTE.empfaenger(p.receivers) : undefined
```
Nachher:
```ts
NDI_TEXTE.empfaenger(p.receivers ?? 0)
```
Erwartet: `FAIL NDI Kreuzprodukt: Empfänger nur, wenn gemessen; „0 Empfänger“ nur bei 0 (216 Fälle)`, `FAIL NDI receivers undefined: keine Empfängerzahl, auch nicht 0`.

**M3 · „startet“ überholt den Fehler** (`packages/settings/src/abschnitte/ndi-output.ts`). Vorher:
```ts
  if (hatFehler(p)) return fehlerStatus(p.error);
  if (p.starting === true) return st('warn', NDI_TEXTE.startet);
```
Nachher:
```ts
  if (p.starting === true) return st('warn', NDI_TEXTE.startet);
  if (hatFehler(p)) return fehlerStatus(p.error);
```
Erwartet: `FAIL NDI Kreuzprodukt: Eingang → status aus der Tabelle (216 Fälle)`.

**M4 · „aus“, obwohl noch gesendet wird** (`packages/settings/src/abschnitte/ndi-output.ts`). Vorher:
```ts
  if (p.sending === true) return st('warn', NDI_TEXTE.ausSendetNoch);
  return st('off', NDI_TEXTE.aus);
```
Nachher:
```ts
  return st('off', NDI_TEXTE.aus);
```
Erwartet: `FAIL NDI Kreuzprodukt: Eingang → status aus der Tabelle (216 Fälle)`.

**M5 · Transparenz ohne Capability** (`packages/settings/src/abschnitte/ndi-output.ts`). Vorher:
```ts
      transparenz: c.transparency === true,
```
Nachher:
```ts
      transparenz: true,
```
Erwartet: `FAIL NDI capabilities: jedes Feld genau dann sichtbar, wenn seine eigene Capability gesetzt ist (32 Fälle)`, `FAIL NDI je Capability allein: genau ihr Feld erscheint, kein anderes`, `FAIL NDI ohne capabilities: >Transparenz< ausgeblendet (nicht ausgegraut)`, `FAIL NDI ohne capabilities: kein Bedienelement`.

**M6 · Sperre erreicht die Auflösung nicht** (`packages/settings/src/abschnitte/NdiOutputSection.tsx`). Vorher:
```tsx
            onChange={(v) => p.onResolution?.(v)}
            disabled={sperre}
```
Nachher:
```tsx
            onChange={(v) => p.onResolution?.(v)}
```
Erwartet: `FAIL NDI locked: alle Bedienelemente disabled (4 von 5)`.

**M7 · Leerer Name ohne Hinweis** (`packages/settings/src/abschnitte/ndi-output.ts`). Vorher:
```ts
    hinweis: name === '' ? NDI_TEXTE.keinName : p.networkName
```
Nachher:
```ts
    hinweis: p.networkName
```
Erwartet: `FAIL NDI Kreuzprodukt: Hinweis „Kein Quellenname eingetragen.“ genau bei leerem Namen (216 Fälle)`, `FAIL NDI: Name nur aus Leerzeichen gilt als leer`.

**M8 · Fremde Capability blendet ein Feld ein** (`packages/settings/src/abschnitte/ndi-output.ts`). Vorher:
```ts
      bildrate: c.fps === true,
```
Nachher:
```ts
      bildrate: c.fps === true || c.resolution === true,
```
Erwartet: `FAIL NDI capabilities: jedes Feld genau dann sichtbar, wenn seine eigene Capability gesetzt ist (32 Fälle)`, `FAIL NDI je Capability allein: genau ihr Feld erscheint, kein anderes`.

**M9 · Wert von außen überschreibt den Entwurf** (`packages/settings/src/entwurf.ts`). Vorher:
```ts
  if (!z.geaendert || z.gesendet !== undefined || z.text.trim() === e.wert) return { z: textZustandAus(e.wert), verbraucht: false };
```
Nachher:
```ts
  return { z: textZustandAus(e.wert), verbraucht: false };
```
Erwartet: `FAIL Text-Entwurf: Wert von außen folgt nur ohne angefangenen Entwurf (oder wenn der Entwurf ihm schon entspricht)` mit `ist: ["REGIE","REGIE","REGIE"] soll: ["REGIE","JM Tit","REGIE"]`.

**M10 · Jedes Verlassen meldet erneut** (`packages/settings/src/entwurf.ts`; Fassung der ersten Nachbesserung, E27). Vorher:
```ts
    if (neu === z.gesendet || !gueltig(neu)) return { z, verbraucht: false };
```
Nachher:
```ts
    if (!gueltig(neu)) return { z, verbraucht: false };
```
Erwartet: `FAIL Text-Entwurf: Enter oder Verlassen meldet einen geänderten Text genau einmal (kein Neustart je Fokuswechsel)`.

**M11 · Die Frist zeigt nichts** (`packages/settings/src/entwurf.ts`). Vorher:
```ts
    return { z: z.gesendet === undefined || z.fehler ? z : { ...z, fehler: ABSCHNITT_TEXTE.nochNichtUebernommen }, verbraucht: false };
```
Nachher:
```ts
    return { z, verbraucht: false };
```
Erwartet: `FAIL Text-Entwurf: ohne Antwort nach der Frist „Noch nicht übernommen.“, der Text bleibt; die Antwort des Tools schließt den Entwurf`.

**M12 · „Noch nicht übernommen.“ erreicht das Feld nicht** (`packages/settings/src/abschnitte/NdiOutputSection.tsx`). Vorher:
```tsx
        <Field label={NDI_TEXTE.quellenname} hint={view.hinweis} error={name.fehler}>
```
Nachher:
```tsx
        <Field label={NDI_TEXTE.quellenname} hint={view.hinweis}>
```
Erwartet: `FAIL Text-Entwurf Verdrahtung: Wert von außen und Frist im Effekt, „Noch nicht übernommen.“ als Feldfehler am Quellennamen`.

**M13 · Ungültiger Text wird gemeldet** (`packages/settings/src/entwurf.ts`). Vorher:
```ts
    if (neu === z.gesendet || !gueltig(neu)) return { z, verbraucht: false };
```
Nachher:
```ts
    if (neu === z.gesendet) return { z, verbraucht: false };
```
Erwartet: `FAIL Text-Entwurf: ungültiger Text wird nicht gemeldet; Escape verwirft einen geänderten Entwurf und gehört dann dem Feld`.

Danach `git status --short` (nur `A `/`M `) und `npm run selftest -w @jm/settings` wieder 94 × `ok`.

- [ ] **Step 10: Commit**

```
git add packages/settings/src/entwurf.ts packages/settings/src/abschnitte/ndi-output.ts packages/settings/src/abschnitte/NdiOutputSection.tsx packages/settings/src/index.ts packages/settings/test/ndi-output.test.tsx packages/settings/test/selftest.ts
git status --short
```
Erwartet genau:
```
A  packages/settings/src/abschnitte/NdiOutputSection.tsx
A  packages/settings/src/abschnitte/ndi-output.ts
A  packages/settings/src/entwurf.ts
M  packages/settings/src/index.ts
A  packages/settings/test/ndi-output.test.tsx
M  packages/settings/test/selftest.ts
```
```
git commit -m "feat(settings): NdiOutputSection - nur Gemessenes, Kreuzprodukt" -m "ndiOutputView leitet den Status nur aus Gemessenem ab: sendet nur bei sending true, ohne Rueckmeldung warn 'an (ohne Rueckmeldung)' (Plan E2), dazu 'an, sendet aber nicht' und 'aus, sendet aber noch'; error vor startet. Empfaengerzahl nur, wenn gemessen, nie als 0 erfunden. Felder je capabilities ausgeblendet, locked sperrt alle Bedienelemente, Name gilt erst bei Enter oder Verlassen. Kreuzprodukt 216 Faelle." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Kreuzprodukt mit `starting` in drei Werten (`undefined`/`false`/`true`) statt zwei: 216 statt 144 Fälle. So fällt sowohl
  „`undefined` gilt als startend“ als auch „`false` gilt als startend“ auf.
- Neue interne Datei `src/entwurf.ts` (`useTextEntwurf`, `textSchritt`, `textZustandAus`), auch von Task 18 genutzt;
  nicht in `index.ts`.
- `NdiOutputView` hat zusätzlich `empfaenger?` und `hinweis?` (fertige Texte für die Darstellung und die Galerie).
- „Ausgabe an/aus“ hängt an `capabilities.toggle`, obwohl Spec 6.2 das Feld ohne `*` nennt (E24, Owner-Liste): Laut
  Anhang A hat kein Tool einen NDI-Schalter in den Einstellungen (Titler, Caption: „NDI-Ausgabe (Quellname, Auflösung, fps)“,
  Switcher „NDI-Ausgabe (Quellname)“); bei Caption und NDI-Screen-Capture ist NDI an/aus eine Haupttaste. Ein fester
  Schalter wäre neue Funktion (Spec 10).
- Nachbesserung nach dem Review: Kreuzprodukt über alle Capability-Bits und je Bit ein Render-Fall (vorher blieb
  `bildrate: c.fps || c.resolution` grün, M8); `textAussen` statt `setEntwurf(wert)` (vorher überschrieb ein Wert von
  außen den angefangenen Namen, M9).
- Zweite Nachbesserung (Prüfrunde 2, E27): `textAussen` ist durch die reine Funktion `textSchritt` ersetzt. Gründe: Jedes
  Verlassen meldete einen abgelehnten Namen erneut (ein NDI-Sender wurde bei jedem Fokuswechsel neu gestartet), ein
  abgelehnter Name stand ohne Hinweis im Feld, und der Effekt las im Updater `vorher.current`, das im nächsten Satz
  überschrieben wurde: Lief der Updater erst im nächsten Render (React rechnet ihn nur ohne offene Updates sofort aus),
  folgte ein unveränderter Entwurf einem Wert von außen nicht mehr, und das nächste Verlassen schickte den alten Namen
  zurück. Jetzt rechnet jeder Schritt synchron auf der Ref wie `NumberInput`; dazu Frist und Feldfehler. `useTextEntwurf`
  liefert `{ feld, fehler }`. Neue Proben M10–M13, M9 an den neuen Code angepasst.

**Nachgerechnet:** Gleiche Kopie, Schritte wörtlich nach Task 16 eingespielt: Step 2 rot mit `does not provide an export named 'NDI_TEXTE'` (damals noch ohne den Import von `../src/entwurf`); Typprüfung beider Pakete ohne Meldung; die Detailzeile bei M1 wörtlich wie oben. Nach der Nachbesserung neu gemessen: Step 7 grün mit 90 × `ok`, Mutationsprobe M1–M9 je rot (4, 2, 1, 1, 4, 1, 2, 2, 1 FAIL). Zweite Nachbesserung: frische Kopie, Plantext Tasks 1–17: Step 2 rot mit `ERR_MODULE_NOT_FOUND … settings\src\entwurf` (siehe Step 2), Step 7 grün mit 94 × `ok`, Mutationsprobe M1–M13 je rot (4, 2, 1, 1, 4, 1, 2, 2, 1, 1, 1, 1, 1 FAIL), Typprüfung beider Pakete grün.

---

### Task 18: `ScreenOutputSection`

**Spec:** 6.2 (Zeile Ausgabe auf Bildschirm: „Bildschirm · Vollbild · Hintergrund*“, Status „auf Bildschirm {n}“, „aus“,
„Bildschirm fehlt“), 7.1–7.3. Plan: E18, G5, G6, Review Focus 3.

**Arbeitsverzeichnis/Voraussetzung:** wie Task 16; Tasks 16, 17 committet (Task 17 liefert `src/entwurf.ts`).

**Dateien:**
- Create: `packages/settings/src/abschnitte/screen-output.ts`, `packages/settings/src/abschnitte/ScreenOutputSection.tsx`,
  `packages/settings/test/screen-output.test.tsx`
- Modify: `packages/settings/src/index.ts` (zwei Zeilen am Ende), `packages/settings/test/selftest.ts` (eine Zeile)

**Interfaces:**
- Consumes: 9.9 wie Task 17, `STATUS_UNBEKANNT`; `useTextEntwurf` (Task 17); aus `@jm/ui`: `zahlText`, `UNBEKANNT`, `Field`
  (auch `error`), `Select` (auch `fehlendLabel`), `TextInput`, `Toggle`.
- Produces (Props und `ScreenOption` wörtlich 9.10):
  ```ts
  // packages/settings/src/abschnitte/screen-output.ts
  export interface ScreenOption { id: number; label: string; primary: boolean }
  export interface ScreenOutputSectionProps extends SectionInput {
    enabled: boolean; windowOpen?: boolean; screens?: ScreenOption[]; selectedId: number | null;
    fullscreen?: boolean; background?: string;
    capabilities: { toggle?: boolean; fullscreen?: boolean; background?: boolean };
    onToggle?(next: boolean): void; onSelect?(id: number | null): void; onFullscreen?(next: boolean): void;
    onBackground?(hex: string): void;
  }
  export const SCREEN_TEXTE;  // titel 'Ausgabe auf Bildschirm'; ausgabe 'Ausgabe'; bildschirm 'Bildschirm'; vollbild 'Vollbild';
                              // hintergrund 'Hintergrund'; automatisch 'Automatisch (Hauptmonitor)';
                              // keinBildschirm 'Kein Bildschirm gefunden'; frueherGewaehlt 'zuvor gewählter Bildschirm';
                              // aufBildschirm(n) 'auf Bildschirm {n}'; aus 'aus'; bildschirmFehlt 'Bildschirm fehlt';
                              // anOhneRueckmeldung 'an (ohne Rückmeldung)'; fensterNichtOffen 'an, Fenster nicht offen';
                              // ausFensterOffen 'aus, Fenster noch offen'; hinweis 'Zweiten Bildschirm wählen, damit die
                              // Ausgabe nicht die Bedienoberfläche verdeckt.'; farbeUngueltig 'Farbe als #RRGGBB eingeben.'
  export const SCREEN_AUTO = 'auto';   // Wert der Option „automatisch“
  export interface ScreenOutputView extends SectionBase {
    sichtbar: { ausgabe: boolean; auswahl: boolean; vollbild: boolean; hintergrund: boolean };
    ziel?: number;                         // 1-basierte Position des Zielbildschirms
    optionen: Array<{ value: string; label: string }>;
    auswahlWert: string;                   // SCREEN_AUTO oder String(selectedId) – springt nie still um
    auswahlGesperrt: boolean;              // leere Liste
    hinweis?: string;                      // Tipp, wenn das Ziel der Hauptmonitor ist
  }
  export function screenOutputView(p: ScreenOutputSectionProps): ScreenOutputView;
  // packages/settings/src/abschnitte/ScreenOutputSection.tsx
  export function ScreenOutputSection(p: ScreenOutputSectionProps): React.JSX.Element;
  ```

**Verhalten (verbindlich):**
- Ziel = gewählter Bildschirm (`selectedId`) bzw. bei `null` der mit `primary: true`; Position 1-basiert in `screens`.
- Ableitung, Vorrang von oben: `error` → error; `screens === undefined` → `unbekannt`; `selectedId !== null` und nicht in
  `screens` → error „Bildschirm fehlt“ (E18; auch bei ausgeschalteter Ausgabe, die Einstellung zeigt ins Leere);
  `!enabled` → mit `windowOpen === true` warn „aus, Fenster noch offen“, sonst off „aus“; Ziel nicht bestimmbar
  (automatisch, aber kein Hauptmonitor gemeldet, z. B. leere Liste) → error „Bildschirm fehlt“; `windowOpen === true` →
  ok „auf Bildschirm {n}“; `windowOpen === false` → error „an, Fenster nicht offen“; `windowOpen === undefined` → warn
  „an (ohne Rückmeldung)“.
- Auswahl: erste Option „Automatisch (Hauptmonitor)“ (Wert `auto`), dann die gemeldeten Bildschirme. Eine fehlende
  gewählte id bleibt gewählt; `Select` zeigt sie als „nicht verfügbar: zuvor gewählter Bildschirm“ (E11). Leere Liste →
  einzige Option „Kein Bildschirm gefunden“, Auswahl gesperrt (der Grund steht in der Auswahl). Liste unbekannt → keine
  Auswahl, sondern die Nur-Lese-Zeile „Bildschirm: unbekannt“.
- Hintergrund (nur `capabilities.background`): Text `#RRGGBB`, gilt erst bei Enter/Verlassen und nur, wenn gültig;
  ungültig → Fehlertext „Farbe als #RRGGBB eingeben.“ am Feld (`aria-invalid` über `Field`). Eine gültige, gemeldete Farbe,
  die nicht innerhalb der Frist zurückkommt, zeigt „Noch nicht übernommen.“ (Text-Entwurf aus Task 17, E27).
- Ausgabe- und Vollbild-Schalter nur mit ihrer Capability (E24); `locked` sperrt alle Bedienelemente. Jedes Feld erscheint
  genau dann, wenn **seine** Capability gesetzt ist (Kreuzprodukt über alle 8 Kombinationen, je Capability ein Render-Fall).

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (neue Datei `packages/settings/test/screen-output.test.tsx`)

```tsx
// ScreenOutputSection (Spec 6.2, 7, Plan E18): fehlender Bildschirm wird gemeldet, nie still ersetzt.
import { enthaelt, enthaeltNicht, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import {
  abschnittStatusItem,
  SCREEN_TEXTE,
  ScreenOutputSection,
  screenOutputView,
  type ScreenOption,
  type ScreenOutputSectionProps,
  type SectionStatus,
} from '../src/index';
import { bewegungsVerstoesse, kreuz, nachLetztem, pruefeFaelle, sperrZaehlung, statusText, vergleiche, vor } from './hilfe';

const s = (state: SectionStatus['state'], text: string): SectionStatus => ({ state, text });
const U = s('off', 'unbekannt');
const AUS = s('off', 'aus');
const AUS_OFFEN = s('warn', 'aus, Fenster noch offen');
const FEHLT = s('error', 'Bildschirm fehlt');
const OHNE = s('warn', 'an (ohne Rückmeldung)');
const NICHT_OFFEN = s('error', 'an, Fenster nicht offen');
const AUF_1 = s('ok', 'auf Bildschirm 1');
const AUF_2 = s('ok', 'auf Bildschirm 2');
const FEHLER = s('error', 'Fehler: Testfehler');

const ZWEI: ScreenOption[] = [
  { id: 11, label: 'Monitor 1 · 1920×1080', primary: true },
  { id: 22, label: 'Monitor 2 · 1920×1080', primary: false },
];
const LISTEN = { unbekannt: undefined, leer: [] as ScreenOption[], zwei: ZWEI };
const WAHL = { auto: null, vorhanden: 22, fehlt: 99 };

// Tabelle Eingang → status. Zeile = Liste|Wahl; Spalten = enabled false (windowOpen undefined, false, true),
// dann enabled true (windowOpen undefined, false, true). Ein gesetzter error schlägt alles (FEHLER).
const TABELLE: Record<string, SectionStatus[]> = {
  'unbekannt|auto': [U, U, U, U, U, U],
  'unbekannt|vorhanden': [U, U, U, U, U, U],
  'unbekannt|fehlt': [U, U, U, U, U, U],
  'leer|auto': [AUS, AUS, AUS_OFFEN, FEHLT, FEHLT, FEHLT],
  'leer|vorhanden': [FEHLT, FEHLT, FEHLT, FEHLT, FEHLT, FEHLT],
  'leer|fehlt': [FEHLT, FEHLT, FEHLT, FEHLT, FEHLT, FEHLT],
  'zwei|auto': [AUS, AUS, AUS_OFFEN, OHNE, NICHT_OFFEN, AUF_1],
  'zwei|vorhanden': [AUS, AUS, AUS_OFFEN, OHNE, NICHT_OFFEN, AUF_2],
  'zwei|fehlt': [FEHLT, FEHLT, FEHLT, FEHLT, FEHLT, FEHLT],
};
const SPALTE = (enabled: boolean, windowOpen: boolean | undefined): number =>
  (enabled ? 3 : 0) + (windowOpen === undefined ? 0 : windowOpen ? 2 : 1);

const basis: ScreenOutputSectionProps = { id: 'bildschirm', enabled: true, selectedId: null, capabilities: {} };

{
  const faelle = kreuz({
    enabled: [false, true],
    windowOpen: [undefined, false, true],
    liste: ['unbekannt', 'leer', 'zwei'],
    wahl: ['auto', 'vorhanden', 'fehlt'],
    error: [undefined, 'Testfehler'],
  } as const);
  const props = (f: (typeof faelle)[number]): ScreenOutputSectionProps => ({
    ...basis,
    enabled: f.enabled,
    windowOpen: f.windowOpen,
    screens: LISTEN[f.liste],
    selectedId: WAHL[f.wahl],
    error: f.error,
  });
  pruefeFaelle('Bildschirm Kreuzprodukt: Eingang → status aus der Tabelle', faelle, (f) => {
    const soll = f.error ? FEHLER : TABELLE[`${f.liste}|${f.wahl}`][SPALTE(f.enabled, f.windowOpen)];
    return vergleiche(statusText(screenOutputView(props(f)).status), statusText(soll));
  });
  pruefeFaelle('Bildschirm Kreuzprodukt: Auswahl springt nie still um (Wert bleibt die gewählte id)', faelle, (f) =>
    vergleiche(screenOutputView(props(f)).auswahlWert, f.wahl === 'auto' ? 'auto' : String(WAHL[f.wahl])),
  );
  pruefeFaelle('Bildschirm Kreuzprodukt: ok nur mit gemessen offenem Fenster', faelle, (f) =>
    screenOutputView(props(f)).status.state === 'ok' && f.windowOpen !== true ? 'ok ohne windowOpen === true' : null,
  );
}

{
  gleich(screenOutputView({ ...basis, screens: ZWEI }).hinweis, SCREEN_TEXTE.hinweis, 'Bildschirm: Tipp, wenn das Ziel der Hauptmonitor ist');
  gleich(screenOutputView({ ...basis, screens: ZWEI, selectedId: 22 }).hinweis, undefined, 'Bildschirm: kein Tipp auf dem zweiten Bildschirm');
  gleich(screenOutputView({ ...basis, screens: [] }).optionen, [{ value: 'auto', label: 'Kein Bildschirm gefunden' }], 'Bildschirm leer: einzige Option „Kein Bildschirm gefunden“');
  ok(screenOutputView({ ...basis, screens: [] }).auswahlGesperrt && !screenOutputView({ ...basis, screens: ZWEI }).auswahlGesperrt, 'Bildschirm: Auswahl nur bei leerer Liste gesperrt');
  gleich(
    [SCREEN_TEXTE.titel, SCREEN_TEXTE.bildschirm, SCREEN_TEXTE.vollbild, SCREEN_TEXTE.hintergrund, SCREEN_TEXTE.automatisch],
    ['Ausgabe auf Bildschirm', 'Bildschirm', 'Vollbild', 'Hintergrund', 'Automatisch (Hauptmonitor)'],
    'Bildschirm: Titel, Feldnamen und Automatik-Option wörtlich',
  );
}

// ── Darstellung ──
const alle: ScreenOutputSectionProps = {
  ...basis,
  windowOpen: true,
  screens: ZWEI,
  selectedId: 22,
  fullscreen: true,
  background: '#00B140',
  capabilities: { toggle: true, fullscreen: true, background: true },
};
{
  const html = render(<ScreenOutputSection {...alle} />);
  for (const t of ['>Ausgabe auf Bildschirm<', '>Ausgabe<', '>Bildschirm<', '>Vollbild<', '>Hintergrund<']) enthaelt(html, t, `Bildschirm alle capabilities: ${t}`);
  ok((html.match(/role="switch"/g) ?? []).length === 2, 'Bildschirm alle capabilities: zwei Schalter (Ausgabe, Vollbild)');
  enthaelt(html, '>Automatisch (Hauptmonitor)</option>', 'Bildschirm: feste Option „Automatisch (Hauptmonitor)“');
  enthaelt(html, '>Monitor 2 · 1920×1080</option>', 'Bildschirm: gemeldete Bildschirme als Optionen');
  enthaelt(html, 'value="#00B140"', 'Bildschirm: Hintergrund als Eingabe');
  enthaelt(html, 'auf Bildschirm 2', 'Bildschirm: Status „auf Bildschirm {n}“');
  pruefeIdVerweise(html, 'Bildschirm: alle id-Verweise gültig');
  ok(vor(html, '>Ausgabe<', '>Bildschirm<') && vor(html, '>Bildschirm<', '>Vollbild<') && vor(html, '>Vollbild<', '>Hintergrund<'), 'Bildschirm: Felder in fester Reihenfolge');
  gleich(bewegungsVerstoesse(html), [], 'Bildschirm: Übergänge nur motion-safe (G8)');
}
{
  const FELD = { toggle: 'ausgabe', fullscreen: 'vollbild', background: 'hintergrund' } as const;
  const faelle = kreuz({ toggle: [false, true], fullscreen: [false, true], background: [false, true] } as const);
  pruefeFaelle('Bildschirm capabilities: jedes Feld genau dann sichtbar, wenn seine eigene Capability gesetzt ist', faelle, (c) => {
    const s = screenOutputView({ ...alle, capabilities: c }).sichtbar;
    const falsch = (Object.keys(FELD) as Array<keyof typeof FELD>).filter((cap) => s[FELD[cap]] !== c[cap]);
    return falsch.length === 0 && s.auswahl ? null : `falsch: ${falsch.join(', ') || 'auswahl'}`;
  });
  const BESCHRIFTUNG = { toggle: '>Ausgabe<', fullscreen: '>Vollbild<', background: '>Hintergrund<' } as const;
  const daneben: string[] = [];
  for (const cap of Object.keys(BESCHRIFTUNG) as Array<keyof typeof BESCHRIFTUNG>) {
    const html = render(<ScreenOutputSection {...alle} capabilities={{ [cap]: true } as ScreenOutputSectionProps['capabilities']} />);
    for (const [andere, t] of Object.entries(BESCHRIFTUNG)) if (html.includes(t) !== (andere === cap)) daneben.push(`${cap}: ${t}`);
  }
  gleich(daneben, [], 'Bildschirm je Capability allein: genau ihr Feld erscheint, kein anderes');
}
{
  const html = render(<ScreenOutputSection {...alle} capabilities={{}} />);
  for (const t of ['>Ausgabe<', '>Vollbild<', '>Hintergrund<']) enthaeltNicht(html, t, `Bildschirm ohne capabilities: ${t} ausgeblendet`);
  ok((html.match(/<select/g) ?? []).length === 1 && !html.includes('role="switch"'), 'Bildschirm ohne capabilities: nur die Auswahl bleibt');
}
{
  const html = render(<ScreenOutputSection {...alle} selectedId={99} />);
  enthaelt(html, '>nicht verfügbar: zuvor gewählter Bildschirm</option>', 'Bildschirm fehlt: Auswahl zeigt „nicht verfügbar: …“ statt still den Hauptmonitor');
  enthaelt(html, 'Bildschirm fehlt', 'Bildschirm fehlt: Statustext');
}
{
  const html = render(<ScreenOutputSection {...alle} screens={[]} />);
  ok(/<select[^>]*disabled=""/.test(html), 'Bildschirm leere Liste: Auswahl gesperrt');
  enthaelt(html, 'Kein Bildschirm gefunden', 'Bildschirm leere Liste: Grund in der Auswahl sichtbar');
}
{
  const html = render(<ScreenOutputSection {...alle} screens={undefined} />);
  enthaeltNicht(html, '<select', 'Bildschirm Liste unbekannt: keine Auswahl (nichts Erfundenes)');
  enthaelt(html, '>unbekannt</div>', 'Bildschirm Liste unbekannt: Anzeige „unbekannt“');
}
{
  const html = render(<ScreenOutputSection {...alle} background="grün" />);
  enthaelt(html, 'Farbe als #RRGGBB eingeben.', 'Bildschirm: ungültige Farbe zeigt den Fehlertext am Feld');
  enthaelt(html, 'aria-invalid="true"', 'Bildschirm: ungültige Farbe setzt aria-invalid');
  pruefeIdVerweise(html, 'Bildschirm: Fehlertext per aria-describedby verknüpft');
}
{
  // E27: Der Text-Entwurf meldet nur eine gültige Farbe; „Noch nicht übernommen.“ steht als Feldfehler (Task 17).
  const quelle = leseText('src/abschnitte/ScreenOutputSection.tsx');
  ok(
    quelle.includes("useTextEntwurf(p.background ?? '', (neu) => p.onBackground?.(neu), (neu) => FARBE.test(neu))") &&
      quelle.includes('error={farbeFalsch ? SCREEN_TEXTE.farbeUngueltig : farbe.fehler}') &&
      quelle.includes('<TextInput {...farbe.feld} disabled={sperre} />'),
    'Bildschirm Verdrahtung: Hintergrund wird nur als gültige Farbe gemeldet, „Noch nicht übernommen.“ als Feldfehler (E27)',
  );
}
{
  const html = render(<ScreenOutputSection {...alle} locked="Vom Master vorgegeben" />);
  const z = sperrZaehlung(html);
  ok(z.alle === 4 && z.gesperrt === 4, `Bildschirm locked: alle Bedienelemente disabled (${z.gesperrt} von ${z.alle})`);
  ok(vor(html, 'Gesperrt: Vom Master vorgegeben', 'role="switch"'), 'Bildschirm locked: Grund sichtbar vor den Feldern');
}
{
  const html = render(<ScreenOutputSection {...alle} error="Fenster abgestürzt" />);
  ok(nachLetztem(html, 'data-fehler="true"', '<input'), 'Bildschirm error: Fehlertext nach den Feldern');
  enthaelt(html, 'Fehler: Fenster abgestürzt', 'Bildschirm error: Statustext');
}
{
  const p: ScreenOutputSectionProps = { ...alle, selectedId: 99 };
  const view = screenOutputView(p);
  const item = abschnittStatusItem(view, { group: 'ausgabe', label: 'Bildschirm' });
  const html = render(<ScreenOutputSection {...p} />);
  ok(item.state === 'error' && html.includes(`data-state="${item.state}"`) && html.includes(`>${item.detail}</span>`), 'Bildschirm: abschnittStatusItem = Statuspille (Zustand und Text)');
}
```

In `packages/settings/test/selftest.ts`, Vorher:
```ts
abschluss();
```
Nachher:
```ts
import './screen-output.test';
abschluss();
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/settings
```
Erwartet (gemessen), Exitcode 1:
```
SyntaxError: The requested module '../src/index' does not provide an export named 'SCREEN_TEXTE'
```

- [ ] **Step 3: Ableitung `packages/settings/src/abschnitte/screen-output.ts`** (neue Datei)

```ts
// --- @jm/settings: Ausgabe auf Bildschirm (Spec 6.2, Regeln 7.1–7.3, Plan E18) ---
//
// Heute fallen alle Tools bei einem fehlenden Bildschirm still auf den Hauptmonitor zurück. Der
// Abschnitt meldet das stattdessen: Eine gewählte id, die in der gemeldeten Liste fehlt, ist
// „Bildschirm fehlt“ – und die Auswahl springt nie still um. Ohne Liste gilt „unbekannt“.
import { zahlText } from '@jm/ui';
import { ABSCHNITT_TEXTE, fehlerStatus, hatFehler, st, STATUS_UNBEKANNT, type SectionBase, type SectionInput, type SectionStatus } from '../vertrag';

export interface ScreenOption { id: number; label: string; primary: boolean }

export interface ScreenOutputSectionProps extends SectionInput {
  enabled: boolean;                  // Ausgabe an bzw. Fenster soll offen sein
  windowOpen?: boolean;              // gemessen; undefined = keine Rückmeldung
  screens?: ScreenOption[];          // gemessen; undefined = Liste unbekannt
  selectedId: number | null;         // null = automatisch (Hauptmonitor); Titler/Switcher übersetzen 0 → null
  fullscreen?: boolean; background?: string;
  capabilities: { toggle?: boolean; fullscreen?: boolean; background?: boolean };
  onToggle?(next: boolean): void; onSelect?(id: number | null): void; onFullscreen?(next: boolean): void;
  onBackground?(hex: string): void;
}

export const SCREEN_TEXTE = {
  titel: 'Ausgabe auf Bildschirm',
  ausgabe: 'Ausgabe',
  bildschirm: 'Bildschirm',
  vollbild: 'Vollbild',
  hintergrund: 'Hintergrund',
  automatisch: 'Automatisch (Hauptmonitor)',
  keinBildschirm: 'Kein Bildschirm gefunden',
  frueherGewaehlt: 'zuvor gewählter Bildschirm',
  aufBildschirm: (n: number) => `auf Bildschirm ${zahlText(n)}`,
  aus: ABSCHNITT_TEXTE.aus,
  bildschirmFehlt: 'Bildschirm fehlt',
  anOhneRueckmeldung: ABSCHNITT_TEXTE.anOhneRueckmeldung,
  fensterNichtOffen: 'an, Fenster nicht offen',
  ausFensterOffen: 'aus, Fenster noch offen',
  hinweis: 'Zweiten Bildschirm wählen, damit die Ausgabe nicht die Bedienoberfläche verdeckt.',
  farbeUngueltig: 'Farbe als #RRGGBB eingeben.',
} as const;

/** Wert der Auswahl für „automatisch“ (ids sind Zahlen, dieser Text kollidiert nie). */
export const SCREEN_AUTO = 'auto';

export interface ScreenOutputView extends SectionBase {
  sichtbar: { ausgabe: boolean; auswahl: boolean; vollbild: boolean; hintergrund: boolean };
  ziel?: number;                     // 1-basierte Position des Zielbildschirms in screens; fehlt = keiner
  optionen: Array<{ value: string; label: string }>;
  auswahlWert: string;               // SCREEN_AUTO oder String(selectedId)
  auswahlGesperrt: boolean;          // leere Liste: nichts zu wählen
  hinweis?: string;                  // Tipp, wenn das Ziel der Hauptmonitor ist
}

/** Position (1-basiert) des Zielbildschirms: gewählte id bzw. bei null der Hauptmonitor. 0 = nicht in der Liste. */
function zielPosition(screens: readonly ScreenOption[], selectedId: number | null): number {
  const i = selectedId === null ? screens.findIndex((s) => s.primary) : screens.findIndex((s) => s.id === selectedId);
  return i + 1;
}

function screenStatus(p: ScreenOutputSectionProps): SectionStatus {
  if (hatFehler(p)) return fehlerStatus(p.error);
  if (p.screens === undefined) return STATUS_UNBEKANNT;
  const ziel = zielPosition(p.screens, p.selectedId);
  if (p.selectedId !== null && ziel === 0) return st('error', SCREEN_TEXTE.bildschirmFehlt);
  if (!p.enabled) return p.windowOpen === true ? st('warn', SCREEN_TEXTE.ausFensterOffen) : st('off', SCREEN_TEXTE.aus);
  if (ziel === 0) return st('error', SCREEN_TEXTE.bildschirmFehlt);
  if (p.windowOpen === true) return st('ok', SCREEN_TEXTE.aufBildschirm(ziel));
  if (p.windowOpen === false) return st('error', SCREEN_TEXTE.fensterNichtOffen);
  return st('warn', SCREEN_TEXTE.anOhneRueckmeldung);
}

export function screenOutputView(p: ScreenOutputSectionProps): ScreenOutputView {
  const c = p.capabilities;
  const liste = p.screens ?? [];
  const ziel = p.screens === undefined ? 0 : zielPosition(p.screens, p.selectedId);
  const optionen =
    p.screens !== undefined && liste.length === 0
      ? [{ value: SCREEN_AUTO, label: SCREEN_TEXTE.keinBildschirm }]
      : [{ value: SCREEN_AUTO, label: SCREEN_TEXTE.automatisch }, ...liste.map((s) => ({ value: String(s.id), label: s.label }))];
  return {
    id: p.id,
    status: screenStatus(p),
    locked: p.locked,
    error: p.error,
    sichtbar: {
      ausgabe: c.toggle === true,
      auswahl: p.screens !== undefined,
      vollbild: c.fullscreen === true,
      hintergrund: c.background === true,
    },
    ziel: ziel > 0 ? ziel : undefined,
    optionen,
    auswahlWert: p.selectedId === null ? SCREEN_AUTO : String(p.selectedId),
    auswahlGesperrt: p.screens !== undefined && liste.length === 0,
    hinweis: ziel > 0 && liste[ziel - 1].primary ? SCREEN_TEXTE.hinweis : undefined,
  };
}
```

- [ ] **Step 4: Komponente `packages/settings/src/abschnitte/ScreenOutputSection.tsx`** (neue Datei)

```tsx
// --- @jm/settings: ScreenOutputSection (Spec 6.2) ---
import { Field, Select, TextInput, Toggle, UNBEKANNT } from '@jm/ui';
import { useTextEntwurf } from '../entwurf';
import { Anzeige, SectionFrame } from '../SectionFrame';
import { istGesperrt } from '../vertrag';
import { SCREEN_AUTO, SCREEN_TEXTE, screenOutputView, type ScreenOutputSectionProps } from './screen-output';

const FARBE = /^#[0-9a-fA-F]{6}$/;

export function ScreenOutputSection(p: ScreenOutputSectionProps): React.JSX.Element {
  const view = screenOutputView(p);
  const sperre = istGesperrt(view) ? true : undefined;
  const farbe = useTextEntwurf(p.background ?? '', (neu) => p.onBackground?.(neu), (neu) => FARBE.test(neu));
  const farbeFalsch = farbe.feld.value.trim() !== '' && !FARBE.test(farbe.feld.value.trim());
  return (
    <SectionFrame view={view} titel={SCREEN_TEXTE.titel}>
      {view.sichtbar.ausgabe ? (
        <Field label={SCREEN_TEXTE.ausgabe}>
          <Toggle checked={p.enabled} onChange={(n) => p.onToggle?.(n)} disabled={sperre} />
        </Field>
      ) : null}
      {view.sichtbar.auswahl ? (
        <Field label={SCREEN_TEXTE.bildschirm} hint={view.hinweis}>
          <Select
            options={view.optionen}
            value={view.auswahlWert}
            fehlendLabel={SCREEN_TEXTE.frueherGewaehlt}
            onChange={(v) => p.onSelect?.(v === SCREEN_AUTO ? null : Number(v))}
            disabled={sperre ?? (view.auswahlGesperrt ? true : undefined)}
          />
        </Field>
      ) : (
        <Anzeige label={SCREEN_TEXTE.bildschirm}>{UNBEKANNT}</Anzeige>
      )}
      {view.sichtbar.vollbild ? (
        <Field label={SCREEN_TEXTE.vollbild}>
          <Toggle checked={p.fullscreen === true} onChange={(n) => p.onFullscreen?.(n)} disabled={sperre} />
        </Field>
      ) : null}
      {view.sichtbar.hintergrund ? (
        <Field label={SCREEN_TEXTE.hintergrund} error={farbeFalsch ? SCREEN_TEXTE.farbeUngueltig : farbe.fehler}>
          <TextInput {...farbe.feld} disabled={sperre} />
        </Field>
      ) : null}
    </SectionFrame>
  );
}
```

- [ ] **Step 5: Exporte** (`packages/settings/src/index.ts`), Vorher:

```ts
export { NdiOutputSection } from './abschnitte/NdiOutputSection';
```
Nachher:
```ts
export { NdiOutputSection } from './abschnitte/NdiOutputSection';
export { type ScreenOption, type ScreenOutputSectionProps, type ScreenOutputView, SCREEN_TEXTE, SCREEN_AUTO, screenOutputView } from './abschnitte/screen-output';
export { ScreenOutputSection } from './abschnitte/ScreenOutputSection';
```

- [ ] **Step 6: Test laufen lassen (grün)**

```
npm run selftest -w @jm/settings
```
Erwartet (gemessen): 136 Zeilen `ok` (42 neu), keine `FAIL`, `ALLE TESTS OK`. Neu unter anderem:
```
ok   Bildschirm capabilities: jedes Feld genau dann sichtbar, wenn seine eigene Capability gesetzt ist (8 Fälle)
ok   Bildschirm je Capability allein: genau ihr Feld erscheint, kein anderes
ok   Bildschirm Kreuzprodukt: Eingang → status aus der Tabelle (108 Fälle)
ok   Bildschirm Kreuzprodukt: Auswahl springt nie still um (Wert bleibt die gewählte id) (108 Fälle)
ok   Bildschirm Kreuzprodukt: ok nur mit gemessen offenem Fenster (108 Fälle)
ok   Bildschirm fehlt: Auswahl zeigt „nicht verfügbar: …“ statt still den Hauptmonitor
ok   Bildschirm Liste unbekannt: keine Auswahl (nichts Erfundenes)
ok   Bildschirm: ungültige Farbe zeigt den Fehlertext am Feld
ok   Bildschirm Verdrahtung: Hintergrund wird nur als gültige Farbe gemeldet, „Noch nicht übernommen.“ als Feldfehler (E27)
ok   Bildschirm locked: alle Bedienelemente disabled (4 von 4)
ok   Bildschirm: abschnittStatusItem = Statuspille (Zustand und Text)
```

- [ ] **Step 7: Typprüfung**

```
npm run typecheck -w @jm/settings
npm run typecheck -w @jm/ui
```
Erwartet (gemessen): beide ohne Meldung, Exitcode 0.

- [ ] **Step 8: Stagen und Mutationsprobe**

```
git add packages/settings/src/abschnitte/screen-output.ts packages/settings/src/abschnitte/ScreenOutputSection.tsx packages/settings/src/index.ts packages/settings/test/screen-output.test.tsx packages/settings/test/selftest.ts
```
Je Mutation allein, Selbsttest rot, `git checkout -- <pfad>`.

**M1 · Fehlende id fällt still auf den Hauptmonitor** (`packages/settings/src/abschnitte/screen-output.ts`). Vorher:
```ts
  const i = selectedId === null ? screens.findIndex((s) => s.primary) : screens.findIndex((s) => s.id === selectedId);
```
Nachher:
```ts
  const j = screens.findIndex((s) => s.id === selectedId);
  const i = selectedId === null || j < 0 ? screens.findIndex((s) => s.primary) : j;
```
Erwartet: `FAIL Bildschirm Kreuzprodukt: Eingang → status aus der Tabelle (108 Fälle)`, `FAIL Bildschirm fehlt: Statustext`, `FAIL Bildschirm: abschnittStatusItem = Statuspille (Zustand und Text)`.

**M2 · Fenster ohne Rückmeldung als ok** (`packages/settings/src/abschnitte/screen-output.ts`). Vorher:
```ts
  return st('warn', SCREEN_TEXTE.anOhneRueckmeldung);
```
Nachher:
```ts
  return st('ok', SCREEN_TEXTE.aufBildschirm(ziel));
```
Erwartet: `FAIL Bildschirm Kreuzprodukt: Eingang → status aus der Tabelle (108 Fälle)`, `FAIL Bildschirm Kreuzprodukt: ok nur mit gemessen offenem Fenster (108 Fälle)`.

**M3 · Unbekannte Liste wie leere Liste** (`packages/settings/src/abschnitte/screen-output.ts`). Vorher:
```ts
  if (p.screens === undefined) return STATUS_UNBEKANNT;
  const ziel = zielPosition(p.screens, p.selectedId);
```
Nachher:
```ts
  const ziel = zielPosition(p.screens ?? [], p.selectedId);
```
Erwartet: `FAIL Bildschirm Kreuzprodukt: Eingang → status aus der Tabelle (108 Fälle)`.

**M4 · Auswahl springt bei fehlender id auf „automatisch“** (`packages/settings/src/abschnitte/screen-output.ts`). Vorher:
```ts
    auswahlWert: p.selectedId === null ? SCREEN_AUTO : String(p.selectedId),
```
Nachher:
```ts
    auswahlWert: p.selectedId === null || ziel === 0 ? SCREEN_AUTO : String(p.selectedId),
```
Erwartet: `FAIL Bildschirm Kreuzprodukt: Auswahl springt nie still um (Wert bleibt die gewählte id) (108 Fälle)`, `FAIL Bildschirm fehlt: Auswahl zeigt „nicht verfügbar: …“ statt still den Hauptmonitor`.

**M5 · „aus“ trotz offenem Fenster** (`packages/settings/src/abschnitte/screen-output.ts`). Vorher:
```ts
p.windowOpen === true ? st('warn', SCREEN_TEXTE.ausFensterOffen) : st('off', SCREEN_TEXTE.aus)
```
Nachher:
```ts
st('off', SCREEN_TEXTE.aus)
```
Erwartet: `FAIL Bildschirm Kreuzprodukt: Eingang → status aus der Tabelle (108 Fälle)`.

**M6 · Sperre erreicht den Hintergrund nicht** (`packages/settings/src/abschnitte/ScreenOutputSection.tsx`). Vorher:
```tsx
          <TextInput {...farbe.feld} disabled={sperre} />
```
Nachher:
```tsx
          <TextInput {...farbe.feld} />
```
Erwartet: `FAIL Bildschirm locked: alle Bedienelemente disabled (3 von 4)`, `FAIL Bildschirm Verdrahtung: Hintergrund wird nur als gültige Farbe gemeldet, „Noch nicht übernommen.“ als Feldfehler (E27)`.

**M7 · Fremde Capability blendet den Vollbild-Schalter ein** (`packages/settings/src/abschnitte/screen-output.ts`). Vorher:
```ts
      vollbild: c.fullscreen === true,
```
Nachher:
```ts
      vollbild: c.fullscreen === true || c.toggle === true,
```
Erwartet: `FAIL Bildschirm capabilities: jedes Feld genau dann sichtbar, wenn seine eigene Capability gesetzt ist (8 Fälle)`, `FAIL Bildschirm je Capability allein: genau ihr Feld erscheint, kein anderes`.

**M8 · Eine ungültige Farbe wird gemeldet** (`packages/settings/src/abschnitte/ScreenOutputSection.tsx`; E27). Vorher:
```tsx
  const farbe = useTextEntwurf(p.background ?? '', (neu) => p.onBackground?.(neu), (neu) => FARBE.test(neu));
```
Nachher:
```tsx
  const farbe = useTextEntwurf(p.background ?? '', (neu) => p.onBackground?.(neu));
```
Erwartet: `FAIL Bildschirm Verdrahtung: Hintergrund wird nur als gültige Farbe gemeldet, „Noch nicht übernommen.“ als Feldfehler (E27)`.

**M9 · „Noch nicht übernommen.“ erreicht das Farbfeld nicht** (`packages/settings/src/abschnitte/ScreenOutputSection.tsx`). Vorher:
```tsx
        <Field label={SCREEN_TEXTE.hintergrund} error={farbeFalsch ? SCREEN_TEXTE.farbeUngueltig : farbe.fehler}>
```
Nachher:
```tsx
        <Field label={SCREEN_TEXTE.hintergrund} error={farbeFalsch ? SCREEN_TEXTE.farbeUngueltig : undefined}>
```
Erwartet: `FAIL Bildschirm Verdrahtung: Hintergrund wird nur als gültige Farbe gemeldet, „Noch nicht übernommen.“ als Feldfehler (E27)`.

Danach `git status --short` (nur `A `/`M `) und wieder 136 × `ok`.

- [ ] **Step 9: Commit**

```
git add packages/settings/src/abschnitte/screen-output.ts packages/settings/src/abschnitte/ScreenOutputSection.tsx packages/settings/src/index.ts packages/settings/test/screen-output.test.tsx packages/settings/test/selftest.ts
git status --short
```
Erwartet genau:
```
A  packages/settings/src/abschnitte/ScreenOutputSection.tsx
A  packages/settings/src/abschnitte/screen-output.ts
M  packages/settings/src/index.ts
A  packages/settings/test/screen-output.test.tsx
M  packages/settings/test/selftest.ts
```
```
git commit -m "feat(settings): ScreenOutputSection - fehlender Bildschirm wird gemeldet" -m "screenOutputView: ohne gemeldete Liste unbekannt, eine gewaehlte id ausserhalb der Liste ist 'Bildschirm fehlt' (Plan E18) und bleibt in der Auswahl als 'nicht verfuegbar'. Ok nur bei gemessen offenem Fenster, sonst 'an (ohne Rueckmeldung)' bzw. 'an, Fenster nicht offen'; 'aus, Fenster noch offen' als Warnung. Leere Liste sperrt die Auswahl mit 'Kein Bildschirm gefunden'. Hintergrund nur als gueltiges #RRGGBB. Kreuzprodukt 108 Faelle." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Zwei Statustexte mehr: „aus, Fenster noch offen“ (warn) – sonst hieße ein gemessen offenes Fenster bei ausgeschalteter
  Ausgabe „aus“ (Regel 7.3) – und „Bildschirm fehlt“ auch dann, wenn „automatisch“ gewählt ist, aber kein Hauptmonitor
  gemeldet wird (leere Liste). Ein dritter Text `frueherGewaehlt` beschriftet die fehlende id in der Auswahl; eine
  Electron-`display.id` (z. B. 2779098405) wäre für den Operator bedeutungslos.
- Liste unbekannt → keine Auswahl, sondern eine Nur-Lese-Zeile „unbekannt“ (eine Auswahl ohne Liste erfände „nicht
  verfügbar“).
- Hintergrund als Text `#RRGGBB` mit eigener Prüfung (Text `farbeUngueltig`) statt `type="color"`: Ob `TextInput` (Task 10)
  ein überschriebenes `type` durchreicht, ist nicht festgelegt.
- Zwei Felder hängen an einer Capability, die Spec 6.2 nicht mit `*` markiert (E24, Owner-Liste): „Vollbild“
  (`capabilities.fullscreen`) gibt es laut Anhang A nur bei Prompter („Talent-Monitor: Display, Vollbild öffnen/schließen“),
  Player („Video-Ausgabe: Display-Wahl, Vollbild“) und Presenter; ein fester Schalter wäre bei Titler, Switcher, Timer und
  App Designer neue Funktion (Spec 10). „Ausgabe an/aus“ (`capabilities.toggle`) steht nicht in der Feldliste von 6.2; es
  bildet Titler „Ausgabe auf Bildschirm (Display, Chroma-Farbe, an/aus)“ aus Anhang A ab und verhindert dort Funktionsverlust.
- Nachbesserung nach dem Review: Kreuzprodukt über die drei Capability-Bits und je Bit ein Render-Fall (vorher blieb
  `vollbild: c.fullscreen || c.toggle` grün, M7).
- Zweite Nachbesserung (E27): Die Hintergrundfarbe nutzt den neuen Text-Entwurf aus Task 17. Die Prüfung `FARBE` steht als
  `gueltig` im Entwurf (eine ungültige Farbe wird nicht gemeldet und gilt nicht als „gesendet“), „Noch nicht übernommen.“
  erscheint als Feldfehler, solange die Farbe gültig ist (Proben M8, M9).

**Nachgerechnet:** Gleiche Kopie, nach Task 17: Step 2 rot mit `… export named 'SCREEN_TEXTE'`; Typprüfung ohne Meldung. Nach der Nachbesserung neu gemessen: Step 6 grün mit 131 × `ok`, Mutationsprobe M1–M7 je rot (3, 2, 1, 2, 1, 1, 2 FAIL). Zweite Nachbesserung: Step 6 grün mit 136 × `ok`, Mutationsprobe M1–M9 je rot (3, 2, 1, 2, 1, 2, 2, 1, 1 FAIL).

---

### Task 19: `RemoteControlSection` (Tool und Launcher-Vollform)

**Spec:** 6.2 (Zeile Fernsteuerung und Absatz „Fernsteuerung“: Token nur im Launcher, Vollform `variante: 'launcher'`),
7.1–7.3, UO3 (Brücken nicht hier). Plan: E15 (Knopf = Rückruf), E16 (Modus-Wörter), G5, G6, Review Focus 3.

**Arbeitsverzeichnis/Voraussetzung:** wie Task 16; Tasks 16–18 committet.

**Dateien:**
- Create: `packages/settings/src/abschnitte/remote-control.ts`, `packages/settings/src/abschnitte/RemoteControlSection.tsx`,
  `packages/settings/test/remote-control.test.tsx`
- Modify: `packages/settings/src/index.ts` (zwei Zeilen am Ende), `packages/settings/test/selftest.ts` (eine Zeile)

**Interfaces:**
- Consumes: 9.9 wie Task 18; `import type { SuiteControlConfig } from '@jm/control-config'` (nur Typ,
  `packages/control-config/src/index.ts:17-30`); aus `@jm/ui`: `UNBEKANNT`, `zahlText`, `Button` (bestehend), `Field`,
  `NumberInput({ value, ganzzahl, min, max, onChange, disabled })`, `Toggle`.
- Produces (Props, `ControlMode`, `RemoteControlLauncherProps` wörtlich 9.10):
  ```ts
  // packages/settings/src/abschnitte/remote-control.ts
  export type ControlMode = NonNullable<SuiteControlConfig['mode']>;   // 'open' | 'secure'
  export interface RemoteControlLauncherProps {
    hasToken: boolean; hasTls: boolean; tlsFingerprint?: string; revealedToken?: string; busy: boolean;
    onActivate(): void; onDeactivate(): void; onCopyToken?(): void;
  }
  export interface RemoteControlSectionProps extends SectionInput {
    variante?: 'tool' | 'launcher'; running?: boolean; mode?: ControlMode; port?: number; clients?: number;
    portInUse?: boolean; restartRequired?: boolean; companionModule?: string; enabled?: boolean;
    capabilities: { portEditable?: boolean; enableToggle?: boolean };
    onToggle?(next: boolean): void; onPortChange?(port: number): void; onOpenLauncher?(): void;
    launcher?: RemoteControlLauncherProps;
  }
  export const REMOTE_TEXTE;  // titel 'Fernsteuerung'; steuerung 'Steuerserver'; modus 'Modus'; port 'Port'; verbunden 'Verbunden';
                              // modusOffen 'offen'; modusGesichert 'gesichert'; modusUnbekannt 'unbekannt';
                              // bereitVerbunden(n) 'bereit · {n} verbunden'; bereit 'bereit'; aus 'aus';
                              // neustartNoetig 'Neustart nötig'; portBelegt 'Port belegt';
                              // gesichertUnvollstaendig 'gesichert (unvollständig)';
                              // companion(modul) 'Für ein Stream Deck über Bitfocus Companion: Modul „{modul}“. Dort Host
                              //   (IP dieses Rechners) und Port eintragen.'; imLauncherEinrichten 'Im Launcher einrichten';
                              // aktivieren 'Aktivieren'; erneuern 'Erneuern'; deaktivieren 'Deaktivieren'; token 'Token';
                              // tokenKopieren 'Token kopieren'; tlsFingerabdruck 'TLS-Fingerabdruck';
                              // wirktBeimStart 'Wirkt beim nächsten Start jedes Tools.';
                              // einmaligSichtbar 'Einmalig sichtbar – jetzt in Companion und Clients übernehmen:';
                              // tokenNurBeimErzeugen 'Das Token wird aus Sicherheitsgründen nur beim Erzeugen oder Erneuern angezeigt.'
  export interface RemoteControlView extends SectionBase {
    variante: 'tool' | 'launcher';
    modusText: string;          // „offen“ | „gesichert“ | „unbekannt“
    verbundenText?: string;     // nur bei running === true und gemessener Zahl
    sichtbar: { steuerung; port; portFeld; verbunden; companion; imLauncher; aktionen; deaktivieren; token;
      tokenKopieren; fingerabdruck; tokenHinweis: boolean };
  }
  export function remoteControlView(p: RemoteControlSectionProps): RemoteControlView;
  // packages/settings/src/abschnitte/RemoteControlSection.tsx
  export function RemoteControlSection(p: RemoteControlSectionProps): React.JSX.Element;
  ```

**Verhalten (verbindlich):**
- Ableitung `tool` (Vorgabe), Vorrang von oben: `error` → error; `portInUse === true` → error „Port belegt“;
  `restartRequired === true` → warn „Neustart nötig“; `running === false` → off „aus“; `running === undefined` →
  `unbekannt`; `running === true` → ok „bereit · {n} verbunden“ mit gemessener Zahl, sonst „bereit“. `mode` ändert den
  Tool-Status nie.
- Ableitung `launcher`: `error` → error; `mode === undefined` → `unbekannt`; `secure` mit `hasToken` und `hasTls` → ok
  „gesichert“; `secure` sonst (auch ohne `launcher`-Props) → warn „gesichert (unvollständig)“; `open` → ok „offen“.
- Clientzahl („Verbunden“) erscheint nur bei `running === true` (gemessene Zahl, sonst „unbekannt“) – nie „0 verbunden“
  für einen Server, von dem niemand weiß, ob er läuft (Gegenmittel zum Ist-Fehler Titler „Suite getrennt“).
- Darstellung `tool`, feste Reihenfolge: Steuerserver-Schalter (nur `capabilities.enableToggle`) · Modus (Anzeige
  „offen“/„gesichert“/„unbekannt“, E16) · Port (Anzeige; `NumberInput` ganzzahlig 1–65535 nur mit `portEditable`;
  unbekannt → „unbekannt“) · Verbunden · Companion-Hinweis (nur mit `companionModule`) · Knopf „Im Launcher einrichten“
  (nur mit `onOpenLauncher`, E15).
- Darstellung `launcher`: Modus mit Hinweis „Wirkt beim nächsten Start jedes Tools.“, Knöpfe „Aktivieren“ (offen) bzw.
  „Erneuern“ (gesichert) und „Deaktivieren“ (nur gesichert), gesperrt bei `busy`; mit `revealedToken` ein Kasten
  „Einmalig sichtbar – …“, das Token als Nur-Lese-Zeile und „Token kopieren“ (nur mit `onCopyToken`); TLS-Fingerabdruck,
  wenn bekannt; ohne `revealedToken` bei gesichert mit Token der Hinweis „Das Token wird … angezeigt.“ Kein Port, keine
  Clientzahl, kein Verweis auf den Launcher.
- **Das Token erscheint nur in `variante: 'launcher'`.** In `tool` werden `launcher`-Props weder in der Sicht noch in der
  Darstellung benutzt (zwei Sperren: `remoteControlView` und die Komponente).
- `locked` sperrt jedes Bedienelement (auch „Token kopieren“).
- `capabilities` (nur `tool`): Schalter „Steuerserver“ genau mit `enableToggle`, Port als Zahlenfeld genau mit
  `portEditable` (Kreuzprodukt über die vier Kombinationen, je Capability ein Render-Fall). Die Knöpfe (Bestands-`Button`)
  tragen `motion-reduce:transition-none` (G8).

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (neue Datei `packages/settings/test/remote-control.test.tsx`)

```tsx
// RemoteControlSection (Spec 6.2 Absatz Fernsteuerung, 7, Plan E15, E16): Tool-Anzeige und Launcher-Vollform.
import { enthaelt, enthaeltNicht, gleich, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import {
  abschnittStatusItem,
  REMOTE_TEXTE,
  RemoteControlSection,
  remoteControlView,
  type RemoteControlLauncherProps,
  type RemoteControlSectionProps,
  type SectionStatus,
} from '../src/index';
import { bewegungsVerstoesse, kreuz, nachLetztem, pruefeFaelle, sperrZaehlung, statusText, vergleiche, vor } from './hilfe';

const s = (state: SectionStatus['state'], text: string): SectionStatus => ({ state, text });
const U = s('off', 'unbekannt');
const AUS = s('off', 'aus');
const BEREIT = s('ok', 'bereit');
const BEREIT_0 = s('ok', 'bereit · 0 verbunden');
const BEREIT_2 = s('ok', 'bereit · 2 verbunden');
const BELEGT = s('error', 'Port belegt');
const NEUSTART = s('warn', 'Neustart nötig');
const FEHLER = s('error', 'Fehler: Testfehler');

// Tabelle Tool: Zeile = running|clients, Spalten = (portInUse, restartRequired) in der Folge
// (–, –), (–, true), (true, –), (true, true). error schlägt alles; mode ändert den Tool-Status nie.
const TOOL: Record<string, [SectionStatus, SectionStatus, SectionStatus, SectionStatus]> = {
  'undefined|undefined': [U, NEUSTART, BELEGT, BELEGT],
  'undefined|0': [U, NEUSTART, BELEGT, BELEGT],
  'undefined|2': [U, NEUSTART, BELEGT, BELEGT],
  'false|undefined': [AUS, NEUSTART, BELEGT, BELEGT],
  'false|0': [AUS, NEUSTART, BELEGT, BELEGT],
  'false|2': [AUS, NEUSTART, BELEGT, BELEGT],
  'true|undefined': [BEREIT, NEUSTART, BELEGT, BELEGT],
  'true|0': [BEREIT_0, NEUSTART, BELEGT, BELEGT],
  'true|2': [BEREIT_2, NEUSTART, BELEGT, BELEGT],
};
const SPALTE = (portInUse?: boolean, restartRequired?: boolean): number => (portInUse ? 2 : 0) + (restartRequired ? 1 : 0);

const basis: RemoteControlSectionProps = { id: 'fernsteuerung', capabilities: {} };

{
  const faelle = kreuz({
    running: [undefined, false, true],
    clients: [undefined, 0, 2],
    portInUse: [undefined, true],
    restartRequired: [undefined, true],
    error: [undefined, 'Testfehler'],
    mode: [undefined, 'open', 'secure'],
  } as const);
  pruefeFaelle('Fernsteuerung Tool Kreuzprodukt: Eingang → status aus der Tabelle', faelle, (f) => {
    const soll = f.error ? FEHLER : TOOL[`${f.running}|${f.clients}`][SPALTE(f.portInUse, f.restartRequired)];
    return vergleiche(statusText(remoteControlView({ ...basis, ...f }).status), statusText(soll));
  });
  pruefeFaelle('Fernsteuerung Tool Kreuzprodukt: Clientzahl nur bei running === true, nie erfunden', faelle, (f) =>
    vergleiche(remoteControlView({ ...basis, ...f }).verbundenText, f.running === true && f.clients !== undefined ? String(f.clients) : undefined),
  );
  pruefeFaelle('Fernsteuerung Tool Kreuzprodukt: Modus offen/gesichert/unbekannt', faelle, (f) =>
    vergleiche(remoteControlView({ ...basis, ...f }).modusText, f.mode === 'open' ? 'offen' : f.mode === 'secure' ? 'gesichert' : 'unbekannt'),
  );
}

const OFFEN_OK = s('ok', 'offen');
const GES_OK = s('ok', 'gesichert');
const GES_HALB = s('warn', 'gesichert (unvollständig)');
const nichts = (): void => {};
const launcher = (l: Partial<RemoteControlLauncherProps>): RemoteControlLauncherProps => ({
  hasToken: false,
  hasTls: false,
  busy: false,
  onActivate: nichts,
  onDeactivate: nichts,
  ...l,
});
{
  // Tabelle Launcher: Zeile = mode, Spalten = (hasToken, hasTls) in der Folge (f,f), (f,t), (t,f), (t,t).
  const LAUNCHER: Record<string, [SectionStatus, SectionStatus, SectionStatus, SectionStatus]> = {
    undefined: [U, U, U, U],
    open: [OFFEN_OK, OFFEN_OK, OFFEN_OK, OFFEN_OK],
    secure: [GES_HALB, GES_HALB, GES_HALB, GES_OK],
  };
  const faelle = kreuz({
    mode: [undefined, 'open', 'secure'],
    hasToken: [false, true],
    hasTls: [false, true],
    revealedToken: [undefined, 'tok-123'],
    error: [undefined, 'Testfehler'],
  } as const);
  pruefeFaelle('Fernsteuerung Launcher Kreuzprodukt: Eingang → status aus der Tabelle', faelle, (f) => {
    const p: RemoteControlSectionProps = {
      ...basis,
      variante: 'launcher',
      mode: f.mode,
      error: f.error,
      launcher: launcher({ hasToken: f.hasToken, hasTls: f.hasTls, revealedToken: f.revealedToken }),
    };
    const soll = f.error ? FEHLER : LAUNCHER[`${f.mode}`][(f.hasToken ? 2 : 0) + (f.hasTls ? 1 : 0)];
    return vergleiche(statusText(remoteControlView(p).status), statusText(soll));
  });
  gleich(remoteControlView({ ...basis, variante: 'launcher', mode: 'secure' }).status, GES_HALB, 'Fernsteuerung Launcher ohne launcher-Props: gesichert gilt als unvollständig');
  gleich(remoteControlView(basis).variante, 'tool', 'Fernsteuerung: Vorgabe variante tool');
}

// ── Darstellung Tool ──
const tool: RemoteControlSectionProps = {
  ...basis,
  running: true,
  mode: 'secure',
  port: 8729,
  clients: 2,
  companionModule: 'packages/companion-jm-switcher',
  onOpenLauncher: nichts,
  launcher: launcher({ hasToken: true, hasTls: true, revealedToken: '0000-0000-0000-0000', tlsFingerprint: 'AB:CD', onCopyToken: nichts }),
};
{
  const html = render(<RemoteControlSection {...tool} />);
  for (const t of ['>Fernsteuerung<', '>Modus<', '>gesichert<', '>Port<', '>8729<', '>Verbunden<', '>2<']) enthaelt(html, t, `Fernsteuerung Tool: ${t}`);
  enthaelt(
    html,
    'Für ein Stream Deck über Bitfocus Companion: Modul „packages/companion-jm-switcher“. Dort Host (IP dieses Rechners) und Port eintragen.',
    'Fernsteuerung Tool: Companion-Hinweis mit Modulname',
  );
  enthaelt(html, '>Im Launcher einrichten</button>', 'Fernsteuerung Tool: Knopf „Im Launcher einrichten“ mit Rückruf (E15)');
  enthaelt(html, 'type="button"', 'Fernsteuerung Tool: Knopf ist type="button"');
  enthaeltNicht(html, '0000-0000-0000-0000', 'Fernsteuerung Tool: Token erscheint nie, auch wenn launcher.revealedToken gesetzt ist');
  const v = remoteControlView(tool).sichtbar;
  ok(!v.token && !v.tokenKopieren && !v.fingerabdruck && !v.aktionen && !v.tokenHinweis, 'Fernsteuerung Tool: Sicht gibt kein Launcher-Feld frei (Token, Fingerabdruck, Knöpfe)');
  enthaeltNicht(html, 'AB:CD', 'Fernsteuerung Tool: kein TLS-Fingerabdruck');
  enthaeltNicht(html, 'Aktivieren', 'Fernsteuerung Tool: keine Launcher-Knöpfe');
  enthaeltNicht(html, '<input', 'Fernsteuerung Tool ohne portEditable: Port nur als Anzeige');
  ok(vor(html, '>Modus<', '>Port<') && vor(html, '>Port<', '>Verbunden<') && vor(html, '>Verbunden<', 'Bitfocus') && vor(html, 'Bitfocus', 'Im Launcher einrichten'), 'Fernsteuerung Tool: Felder in fester Reihenfolge (Spec 6.2)');
  gleich(bewegungsVerstoesse(html), [], 'Fernsteuerung Tool: Übergänge nur motion-safe oder mit motion-reduce:transition-none (G8)');
}
{
  const faelle = kreuz({ portEditable: [false, true], enableToggle: [false, true] } as const);
  pruefeFaelle('Fernsteuerung capabilities: Schalter genau mit enableToggle, Zahlenfeld genau mit portEditable', faelle, (c) => {
    const s = remoteControlView({ ...tool, capabilities: c }).sichtbar;
    return s.steuerung === c.enableToggle && s.portFeld === c.portEditable && s.port ? null : `steuerung ${s.steuerung}, portFeld ${s.portFeld}`;
  });
  const nurPort = render(<RemoteControlSection {...tool} enabled capabilities={{ portEditable: true }} />);
  const nurSchalter = render(<RemoteControlSection {...tool} enabled capabilities={{ enableToggle: true }} />);
  ok(
    nurPort.includes('<input') && !nurPort.includes('role="switch"') && nurSchalter.includes('role="switch"') && !nurSchalter.includes('<input'),
    'Fernsteuerung je Capability allein: genau ihr Feld erscheint, kein anderes',
  );
}
{
  const html = render(<RemoteControlSection {...tool} onOpenLauncher={undefined} />);
  enthaeltNicht(html, 'Im Launcher einrichten', 'Fernsteuerung Tool ohne Rückruf: kein Knopf (ausgeblendet, nicht ausgegraut)');
  enthaeltNicht(render(<RemoteControlSection {...tool} companionModule={undefined} />), 'Bitfocus', 'Fernsteuerung Tool ohne companionModule: kein Hinweis');
}
{
  const html = render(<RemoteControlSection {...tool} running={undefined} clients={0} />);
  enthaeltNicht(html, '>Verbunden<', 'Fernsteuerung running unbekannt: kein Feld „Verbunden“');
  enthaeltNicht(html, '0 verbunden', 'Fernsteuerung running unbekannt: nie „0 verbunden“ (Ist-Fehler Titler „Suite getrennt“)');
  enthaelt(html, '>unbekannt</span>', 'Fernsteuerung running unbekannt: Statuspille „unbekannt“');
}
{
  const html = render(<RemoteControlSection {...tool} mode={undefined} port={undefined} />);
  ok((html.match(/>unbekannt<\/div>/g) ?? []).length === 2 && vor(html, '>Modus<', '>unbekannt</div>'), 'Fernsteuerung: unbekannter Modus und Port als „unbekannt“');
}
{
  const html = render(<RemoteControlSection {...tool} enabled capabilities={{ portEditable: true, enableToggle: true }} />);
  enthaelt(html, 'role="switch"', 'Fernsteuerung enableToggle: Schalter');
  enthaelt(html, 'value="8729"', 'Fernsteuerung portEditable: Port als Zahlenfeld');
  pruefeIdVerweise(html, 'Fernsteuerung: alle id-Verweise gültig');
  const gesperrt = render(<RemoteControlSection {...tool} enabled capabilities={{ portEditable: true, enableToggle: true }} locked="Vom Master vorgegeben" />);
  const z = sperrZaehlung(gesperrt);
  ok(z.alle === 3 && z.gesperrt === 3, `Fernsteuerung locked: alle Bedienelemente disabled (${z.gesperrt} von ${z.alle})`);
  ok(vor(gesperrt, 'Gesperrt: Vom Master vorgegeben', 'role="switch"'), 'Fernsteuerung locked: Grund vor den Feldern');
}
{
  const html = render(<RemoteControlSection {...tool} error="Steuerserver abgestürzt" />);
  ok(nachLetztem(html, 'data-fehler="true"', 'Im Launcher einrichten'), 'Fernsteuerung error: Fehlertext nach den Feldern');
  enthaelt(html, 'Fehler: Steuerserver abgestürzt', 'Fernsteuerung error: Statustext');
}

// ── Darstellung Launcher-Vollform ──
{
  const html = render(<RemoteControlSection {...basis} variante="launcher" mode="open" onOpenLauncher={nichts} launcher={launcher({})} />);
  enthaelt(html, '>Aktivieren</button>', 'Launcher offen: Knopf „Aktivieren“');
  enthaeltNicht(html, 'Deaktivieren', 'Launcher offen: kein „Deaktivieren“');
  enthaeltNicht(html, 'Im Launcher einrichten', 'Launcher: kein Verweis auf sich selbst');
  enthaeltNicht(html, '>Port<', 'Launcher: kein Port');
  enthaelt(html, 'Wirkt beim nächsten Start jedes Tools.', 'Launcher: Hinweis „Wirkt beim nächsten Start jedes Tools.“');
}
{
  const l = launcher({ hasToken: true, hasTls: true, revealedToken: '0000-0000-0000-0000', tlsFingerprint: 'AB:CD', onCopyToken: nichts });
  const html = render(<RemoteControlSection {...basis} variante="launcher" mode="secure" launcher={l} />);
  for (const t of ['>Erneuern</button>', '>Deaktivieren</button>', 'Einmalig sichtbar – jetzt in Companion und Clients übernehmen:', '>0000-0000-0000-0000<', '>Token kopieren</button>', '>TLS-Fingerabdruck<', '>AB:CD<']) {
    enthaelt(html, t, `Launcher gesichert, Token frisch: ${t}`);
  }
  enthaeltNicht(html, 'nur beim Erzeugen oder Erneuern', 'Launcher Token frisch: kein „nur beim Erzeugen“-Hinweis');
  const spaeter = render(<RemoteControlSection {...basis} variante="launcher" mode="secure" launcher={{ ...l, revealedToken: undefined }} />);
  enthaeltNicht(spaeter, '0000-0000-0000-0000', 'Launcher später: Token nicht mehr sichtbar');
  enthaeltNicht(spaeter, 'Token kopieren', 'Launcher später: kein „Token kopieren“');
  enthaelt(spaeter, 'Das Token wird aus Sicherheitsgründen nur beim Erzeugen oder Erneuern angezeigt.', 'Launcher später: Hinweis zum Token');
  const busy = sperrZaehlung(render(<RemoteControlSection {...basis} variante="launcher" mode="secure" launcher={{ ...l, busy: true }} />));
  ok(busy.gesperrt === 2, `Launcher busy: Erneuern und Deaktivieren gesperrt (${busy.gesperrt})`);
  const zu = sperrZaehlung(render(<RemoteControlSection {...basis} variante="launcher" mode="secure" launcher={l} locked="Vom Master vorgegeben" />));
  ok(zu.alle === 3 && zu.gesperrt === 3, `Launcher locked: alle Bedienelemente disabled (${zu.gesperrt} von ${zu.alle})`);
  gleich(bewegungsVerstoesse(html), [], 'Launcher: Übergänge nur motion-safe oder mit motion-reduce:transition-none (G8)');
}
{
  const view = remoteControlView({ ...tool, running: undefined });
  const item = abschnittStatusItem(view, { group: 'fernsteuerung', label: 'Companion' });
  const html = render(<RemoteControlSection {...tool} running={undefined} />);
  ok(item.state === 'off' && item.detail === 'unbekannt' && html.includes(`data-state="${item.state}"`) && html.includes(`>${item.detail}</span>`), 'Fernsteuerung: abschnittStatusItem = Statuspille (Zustand und Text)');
  gleich(REMOTE_TEXTE.titel, 'Fernsteuerung', 'Fernsteuerung: Titel wörtlich');
}
```

In `packages/settings/test/selftest.ts`, Vorher:
```ts
abschluss();
```
Nachher:
```ts
import './remote-control.test';
abschluss();
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/settings
```
Erwartet (gemessen), Exitcode 1:
```
SyntaxError: The requested module '../src/index' does not provide an export named 'REMOTE_TEXTE'
```

- [ ] **Step 3: Ableitung `packages/settings/src/abschnitte/remote-control.ts`** (neue Datei)

```ts
// --- @jm/settings: Fernsteuerung (Spec 6.2 Absatz Fernsteuerung, Regeln 7.1–7.3, Plan E15, E16) ---
//
// In einem Tool zeigt der Abschnitt Status, Modus und Port und verweist zum Einrichten auf den
// Launcher (Rückruf `onOpenLauncher`, ohne Rückruf kein Knopf – ein Deep-Link existiert noch nicht,
// E15). Das Token erscheint nur in der Launcher-Vollform. Eine Clientzahl gibt es nur, wenn der
// Steuerserver gemessen läuft – nie „0 verbunden“ für einen Server, von dem niemand weiß, ob er läuft.
import type { SuiteControlConfig } from '@jm/control-config';
import { UNBEKANNT, zahlText } from '@jm/ui';
import { ABSCHNITT_TEXTE, fehlerStatus, hatFehler, st, STATUS_UNBEKANNT, type SectionBase, type SectionInput, type SectionStatus } from '../vertrag';

export type ControlMode = NonNullable<SuiteControlConfig['mode']>;   // 'open' | 'secure'

export interface RemoteControlLauncherProps {
  hasToken: boolean; hasTls: boolean; tlsFingerprint?: string;
  revealedToken?: string;            // nur direkt nach Erzeugen/Erneuern
  busy: boolean;
  onActivate(): void;                // „Aktivieren“ (offen → gesichert) bzw. „Erneuern“ (gesichert)
  onDeactivate(): void;              // „Deaktivieren“
  onCopyToken?(): void;              // „Token kopieren“, nur mit revealedToken
}

export interface RemoteControlSectionProps extends SectionInput {
  variante?: 'tool' | 'launcher';    // Vorgabe 'tool'
  running?: boolean;                 // gemessen; undefined = unbekannt
  mode?: ControlMode;                // undefined = unbekannt
  port?: number;
  clients?: number;                  // gemessen; zählt nur bei running === true
  portInUse?: boolean;
  restartRequired?: boolean;
  companionModule?: string;          // Name des Companion-Moduls für den Hinweis
  enabled?: boolean;                 // nur mit capabilities.enableToggle
  capabilities: { portEditable?: boolean; enableToggle?: boolean };
  onToggle?(next: boolean): void; onPortChange?(port: number): void; onOpenLauncher?(): void;
  launcher?: RemoteControlLauncherProps;   // nur variante 'launcher'; in 'tool' nie gerendert
}

export const REMOTE_TEXTE = {
  titel: 'Fernsteuerung',
  steuerung: 'Steuerserver',
  modus: 'Modus',
  port: 'Port',
  verbunden: 'Verbunden',
  modusOffen: 'offen',
  modusGesichert: 'gesichert',
  modusUnbekannt: UNBEKANNT,
  bereitVerbunden: (n: number) => `bereit · ${zahlText(n)} verbunden`,
  bereit: 'bereit',
  aus: ABSCHNITT_TEXTE.aus,
  neustartNoetig: 'Neustart nötig',
  portBelegt: 'Port belegt',
  gesichertUnvollstaendig: 'gesichert (unvollständig)',
  companion: (modul: string) =>
    `Für ein Stream Deck über Bitfocus Companion: Modul „${modul}“. Dort Host (IP dieses Rechners) und Port eintragen.`,
  imLauncherEinrichten: ABSCHNITT_TEXTE.imLauncherEinrichten,
  aktivieren: 'Aktivieren',
  erneuern: 'Erneuern',
  deaktivieren: 'Deaktivieren',
  token: 'Token',
  tokenKopieren: 'Token kopieren',
  tlsFingerabdruck: 'TLS-Fingerabdruck',
  wirktBeimStart: 'Wirkt beim nächsten Start jedes Tools.',
  einmaligSichtbar: 'Einmalig sichtbar – jetzt in Companion und Clients übernehmen:',
  tokenNurBeimErzeugen: 'Das Token wird aus Sicherheitsgründen nur beim Erzeugen oder Erneuern angezeigt.',
} as const;

export interface RemoteControlView extends SectionBase {
  variante: 'tool' | 'launcher';
  modusText: string;                 // „offen“, „gesichert“ oder „unbekannt“
  verbundenText?: string;            // Zahl, nur bei running === true und gemessener Zahl
  sichtbar: {
    steuerung: boolean; port: boolean; portFeld: boolean; verbunden: boolean; companion: boolean;
    imLauncher: boolean; aktionen: boolean; deaktivieren: boolean; token: boolean; tokenKopieren: boolean;
    fingerabdruck: boolean; tokenHinweis: boolean;
  };
}

function modusText(mode: ControlMode | undefined): string {
  return mode === 'secure' ? REMOTE_TEXTE.modusGesichert : mode === 'open' ? REMOTE_TEXTE.modusOffen : REMOTE_TEXTE.modusUnbekannt;
}

function toolStatus(p: RemoteControlSectionProps): SectionStatus {
  if (hatFehler(p)) return fehlerStatus(p.error);
  if (p.portInUse === true) return st('error', REMOTE_TEXTE.portBelegt);
  if (p.restartRequired === true) return st('warn', REMOTE_TEXTE.neustartNoetig);
  if (p.running === false) return st('off', REMOTE_TEXTE.aus);
  if (p.running === undefined) return STATUS_UNBEKANNT;
  return typeof p.clients === 'number' ? st('ok', REMOTE_TEXTE.bereitVerbunden(p.clients)) : st('ok', REMOTE_TEXTE.bereit);
}

function launcherStatus(p: RemoteControlSectionProps): SectionStatus {
  if (hatFehler(p)) return fehlerStatus(p.error);
  if (p.mode === undefined) return STATUS_UNBEKANNT;
  if (p.mode === 'secure') {
    return p.launcher?.hasToken === true && p.launcher.hasTls === true
      ? st('ok', REMOTE_TEXTE.modusGesichert)
      : st('warn', REMOTE_TEXTE.gesichertUnvollstaendig);
  }
  return st('ok', REMOTE_TEXTE.modusOffen);
}

export function remoteControlView(p: RemoteControlSectionProps): RemoteControlView {
  const variante = p.variante ?? 'tool';
  const tool = variante === 'tool';
  const l = tool ? undefined : p.launcher;
  const token = typeof l?.revealedToken === 'string' && l.revealedToken !== '';
  return {
    id: p.id,
    status: tool ? toolStatus(p) : launcherStatus(p),
    locked: p.locked,
    error: p.error,
    variante,
    modusText: modusText(p.mode),
    verbundenText: tool && p.running === true && typeof p.clients === 'number' ? zahlText(p.clients) : undefined,
    sichtbar: {
      steuerung: tool && p.capabilities.enableToggle === true,
      port: tool,
      portFeld: tool && p.capabilities.portEditable === true,
      verbunden: tool && p.running === true,
      companion: typeof p.companionModule === 'string' && p.companionModule !== '',
      imLauncher: tool && typeof p.onOpenLauncher === 'function',
      aktionen: !tool && l !== undefined,
      deaktivieren: !tool && l !== undefined && p.mode === 'secure',
      token,
      tokenKopieren: token && typeof l?.onCopyToken === 'function',
      fingerabdruck: !tool && typeof l?.tlsFingerprint === 'string' && l.tlsFingerprint !== '',
      tokenHinweis: !tool && !token && p.mode === 'secure' && l?.hasToken === true,
    },
  };
}
```

- [ ] **Step 4: Komponente `packages/settings/src/abschnitte/RemoteControlSection.tsx`** (neue Datei)

```tsx
// --- @jm/settings: RemoteControlSection (Spec 6.2), Tool-Anzeige und Launcher-Vollform ---
import { Button, Field, NumberInput, Toggle, UNBEKANNT, zahlText } from '@jm/ui';
import { Anzeige, SectionFrame } from '../SectionFrame';
import { istGesperrt } from '../vertrag';
import { REMOTE_TEXTE, remoteControlView, type RemoteControlSectionProps } from './remote-control';

export function RemoteControlSection(p: RemoteControlSectionProps): React.JSX.Element {
  const view = remoteControlView(p);
  const gesperrt = istGesperrt(view);
  const sperre = gesperrt ? true : undefined;
  const l = view.variante === 'launcher' ? p.launcher : undefined;
  return (
    <SectionFrame view={view} titel={REMOTE_TEXTE.titel}>
      {view.sichtbar.steuerung ? (
        <Field label={REMOTE_TEXTE.steuerung}>
          <Toggle checked={p.enabled === true} onChange={(n) => p.onToggle?.(n)} disabled={sperre} />
        </Field>
      ) : null}
      <Anzeige label={REMOTE_TEXTE.modus} hinweis={view.variante === 'launcher' ? REMOTE_TEXTE.wirktBeimStart : undefined}>
        {view.modusText}
      </Anzeige>
      {view.sichtbar.portFeld ? (
        <Field label={REMOTE_TEXTE.port}>
          <NumberInput value={p.port ?? null} ganzzahl min={1} max={65535} onChange={(n) => p.onPortChange?.(n)} disabled={sperre} />
        </Field>
      ) : view.sichtbar.port ? (
        <Anzeige label={REMOTE_TEXTE.port}>{typeof p.port === 'number' ? zahlText(p.port) : UNBEKANNT}</Anzeige>
      ) : null}
      {view.sichtbar.verbunden ? <Anzeige label={REMOTE_TEXTE.verbunden}>{view.verbundenText ?? UNBEKANNT}</Anzeige> : null}
      {view.sichtbar.companion ? (
        <p className="text-[11px] text-[var(--muted-foreground)]">{REMOTE_TEXTE.companion(p.companionModule ?? '')}</p>
      ) : null}
      {view.sichtbar.imLauncher ? (
        <Button type="button" variant="outline" size="sm" uppercase={false} className="motion-reduce:transition-none" onClick={() => p.onOpenLauncher?.()} disabled={gesperrt}>
          {REMOTE_TEXTE.imLauncherEinrichten}
        </Button>
      ) : null}
      {view.sichtbar.aktionen && l ? (
        <div className="flex items-center gap-3">
          <Button type="button" variant="primary" size="sm" className="motion-reduce:transition-none" onClick={() => l.onActivate()} disabled={gesperrt || l.busy}>
            {p.mode === 'secure' ? REMOTE_TEXTE.erneuern : REMOTE_TEXTE.aktivieren}
          </Button>
          {view.sichtbar.deaktivieren ? (
            <Button type="button" variant="ghost" size="sm" className="motion-reduce:transition-none" onClick={() => l.onDeactivate()} disabled={gesperrt || l.busy}>
              {REMOTE_TEXTE.deaktivieren}
            </Button>
          ) : null}
        </div>
      ) : null}
      {view.sichtbar.token && l ? (
        <div data-token="true" className="space-y-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--muted)] p-3">
          <p className="text-[11px] text-[var(--muted-foreground)]">{REMOTE_TEXTE.einmaligSichtbar}</p>
          <Anzeige label={REMOTE_TEXTE.token}>{l.revealedToken}</Anzeige>
          {view.sichtbar.tokenKopieren ? (
            <Button type="button" variant="outline" size="sm" uppercase={false} className="motion-reduce:transition-none" onClick={() => l.onCopyToken?.()} disabled={gesperrt}>
              {REMOTE_TEXTE.tokenKopieren}
            </Button>
          ) : null}
        </div>
      ) : null}
      {view.sichtbar.fingerabdruck && l ? <Anzeige label={REMOTE_TEXTE.tlsFingerabdruck}>{l.tlsFingerprint}</Anzeige> : null}
      {view.sichtbar.tokenHinweis ? <p className="text-[11px] text-[var(--muted-foreground)]">{REMOTE_TEXTE.tokenNurBeimErzeugen}</p> : null}
    </SectionFrame>
  );
}
```

- [ ] **Step 5: Exporte** (`packages/settings/src/index.ts`), Vorher:

```ts
export { ScreenOutputSection } from './abschnitte/ScreenOutputSection';
```
Nachher:
```ts
export { ScreenOutputSection } from './abschnitte/ScreenOutputSection';
export { type ControlMode, type RemoteControlLauncherProps, type RemoteControlSectionProps, type RemoteControlView, REMOTE_TEXTE, remoteControlView } from './abschnitte/remote-control';
export { RemoteControlSection } from './abschnitte/RemoteControlSection';
```

- [ ] **Step 6: Test laufen lassen (grün)**

```
npm run selftest -w @jm/settings
```
Erwartet (gemessen): 195 Zeilen `ok` (59 neu), keine `FAIL`, `ALLE TESTS OK`. Neu unter anderem:
```
ok   Fernsteuerung capabilities: Schalter genau mit enableToggle, Zahlenfeld genau mit portEditable (4 Fälle)
ok   Fernsteuerung Tool Kreuzprodukt: Eingang → status aus der Tabelle (216 Fälle)
ok   Fernsteuerung Tool Kreuzprodukt: Clientzahl nur bei running === true, nie erfunden (216 Fälle)
ok   Fernsteuerung Launcher Kreuzprodukt: Eingang → status aus der Tabelle (48 Fälle)
ok   Fernsteuerung Tool: Token erscheint nie, auch wenn launcher.revealedToken gesetzt ist
ok   Fernsteuerung Tool ohne Rückruf: kein Knopf (ausgeblendet, nicht ausgegraut)
ok   Fernsteuerung running unbekannt: nie „0 verbunden“ (Ist-Fehler Titler „Suite getrennt“)
ok   Launcher später: Hinweis zum Token
ok   Launcher locked: alle Bedienelemente disabled (3 von 3)
```

- [ ] **Step 7: Typprüfung**

```
npm run typecheck -w @jm/settings
npm run typecheck -w @jm/ui
```
Erwartet (gemessen): beide ohne Meldung, Exitcode 0 (`tsc` liest dabei `packages/control-config/src/index.ts` als Typquelle mit).

- [ ] **Step 8: Stagen und Mutationsprobe**

```
git add packages/settings/src/abschnitte/remote-control.ts packages/settings/src/abschnitte/RemoteControlSection.tsx packages/settings/src/index.ts packages/settings/test/remote-control.test.tsx packages/settings/test/selftest.ts
```
Je Mutation allein, Selbsttest rot, `git checkout -- <pfad>`.

**M1 · „bereit · 0 verbunden“ bei unbekanntem Server** (`packages/settings/src/abschnitte/remote-control.ts`). Vorher:
```ts
  if (p.running === undefined) return STATUS_UNBEKANNT;
```
Nachher:
```ts
  if (p.running === undefined && p.clients === undefined) return STATUS_UNBEKANNT;
```
Erwartet: `FAIL Fernsteuerung Tool Kreuzprodukt: Eingang → status aus der Tabelle (216 Fälle)`, `FAIL Fernsteuerung running unbekannt: nie „0 verbunden“ (Ist-Fehler Titler „Suite getrennt“)`, `FAIL Fernsteuerung running unbekannt: Statuspille „unbekannt“`, `FAIL Fernsteuerung: abschnittStatusItem = Statuspille (Zustand und Text)`.

**M2 · Clientzahl ohne Prüfung auf `running`** (`packages/settings/src/abschnitte/remote-control.ts`). Vorher:
```ts
tool && p.running === true && typeof p.clients === 'number' ? zahlText(p.clients) : undefined
```
Nachher:
```ts
tool && typeof p.clients === 'number' ? zahlText(p.clients) : undefined
```
Erwartet: `FAIL Fernsteuerung Tool Kreuzprodukt: Clientzahl nur bei running === true, nie erfunden (216 Fälle)`.

**M3 · Token in `tool`** (Sicht und Komponente zugleich, zwei Dateien). `packages/settings/src/abschnitte/remote-control.ts`, Vorher:
```ts
  const l = tool ? undefined : p.launcher;
```
Nachher:
```ts
  const l = p.launcher;
```
`packages/settings/src/abschnitte/RemoteControlSection.tsx`, Vorher:
```tsx
  const l = view.variante === 'launcher' ? p.launcher : undefined;
```
Nachher:
```tsx
  const l = p.launcher;
```
Erwartet: `FAIL Fernsteuerung Tool: Token erscheint nie, auch wenn launcher.revealedToken gesetzt ist`, `FAIL Fernsteuerung Tool: Sicht gibt kein Launcher-Feld frei (Token, Fingerabdruck, Knöpfe)`, `FAIL Fernsteuerung locked: alle Bedienelemente disabled (4 von 4)`. Nur die erste der beiden Ersetzungen allein: `FAIL Fernsteuerung Tool: Sicht gibt kein Launcher-Feld frei (…)` (die Komponente hält das Token dann noch zurück).

**M4 · Knopf „Im Launcher einrichten“ ohne Rückruf** (`packages/settings/src/abschnitte/remote-control.ts`). Vorher:
```ts
      imLauncher: tool && typeof p.onOpenLauncher === 'function',
```
Nachher:
```ts
      imLauncher: tool,
```
Erwartet: `FAIL Fernsteuerung Tool ohne Rückruf: kein Knopf (ausgeblendet, nicht ausgegraut)`.

**M5 · „Neustart nötig“ vor „Port belegt“** (`packages/settings/src/abschnitte/remote-control.ts`). Vorher:
```ts
  if (p.portInUse === true) return st('error', REMOTE_TEXTE.portBelegt);
  if (p.restartRequired === true) return st('warn', REMOTE_TEXTE.neustartNoetig);
```
Nachher:
```ts
  if (p.restartRequired === true) return st('warn', REMOTE_TEXTE.neustartNoetig);
  if (p.portInUse === true) return st('error', REMOTE_TEXTE.portBelegt);
```
Erwartet: `FAIL Fernsteuerung Tool Kreuzprodukt: Eingang → status aus der Tabelle (216 Fälle)`.

**M6 · Launcher: gesichert ohne TLS als ok** (`packages/settings/src/abschnitte/remote-control.ts`). Vorher:
```ts
p.launcher?.hasToken === true && p.launcher.hasTls === true
```
Nachher:
```ts
p.launcher?.hasToken === true
```
Erwartet: `FAIL Fernsteuerung Launcher Kreuzprodukt: Eingang → status aus der Tabelle (48 Fälle)`.

**M7 · Unbekannter Modus als „offen“** (`packages/settings/src/abschnitte/remote-control.ts`). Vorher:
```ts
mode === 'open' ? REMOTE_TEXTE.modusOffen : REMOTE_TEXTE.modusUnbekannt
```
Nachher:
```ts
REMOTE_TEXTE.modusOffen
```
Erwartet: `FAIL Fernsteuerung Tool Kreuzprodukt: Modus offen/gesichert/unbekannt (216 Fälle)`, `FAIL Fernsteuerung: unbekannter Modus und Port als „unbekannt“`.

**M8 · Fremde Capability blendet das Zahlenfeld ein** (`packages/settings/src/abschnitte/remote-control.ts`). Vorher:
```ts
      portFeld: tool && p.capabilities.portEditable === true,
```
Nachher:
```ts
      portFeld: tool && (p.capabilities.portEditable === true || p.capabilities.enableToggle === true),
```
Erwartet: `FAIL Fernsteuerung capabilities: Schalter genau mit enableToggle, Zahlenfeld genau mit portEditable (4 Fälle)`, `FAIL Fernsteuerung je Capability allein: genau ihr Feld erscheint, kein anderes`.

**M9 · Knopf mit Übergang ohne reduced-motion** (`packages/settings/src/abschnitte/RemoteControlSection.tsx`). Vorher:
```tsx
        <Button type="button" variant="outline" size="sm" uppercase={false} className="motion-reduce:transition-none" onClick={() => p.onOpenLauncher?.()} disabled={gesperrt}>
```
Nachher:
```tsx
        <Button type="button" variant="outline" size="sm" uppercase={false} onClick={() => p.onOpenLauncher?.()} disabled={gesperrt}>
```
Erwartet: `FAIL Fernsteuerung Tool: Übergänge nur motion-safe oder mit motion-reduce:transition-none (G8)`. Detail: `ist: ["transition-opacity transition-colors"] soll: []`.

Danach `git status --short` (nur `A `/`M `) und wieder 195 × `ok`.

- [ ] **Step 9: Commit**

```
git add packages/settings/src/abschnitte/remote-control.ts packages/settings/src/abschnitte/RemoteControlSection.tsx packages/settings/src/index.ts packages/settings/test/remote-control.test.tsx packages/settings/test/selftest.ts
git status --short
```
Erwartet genau:
```
A  packages/settings/src/abschnitte/RemoteControlSection.tsx
A  packages/settings/src/abschnitte/remote-control.ts
M  packages/settings/src/index.ts
A  packages/settings/test/remote-control.test.tsx
M  packages/settings/test/selftest.ts
```
```
git commit -m "feat(settings): RemoteControlSection - Tool-Anzeige und Launcher-Vollform" -m "remoteControlView fuer variante tool: Port belegt vor Neustart noetig vor aus, ohne gemessenen Serverzustand unbekannt, Clientzahl nur bei running true (nie '0 verbunden' fuer einen unbekannten Server). Knopf 'Im Launcher einrichten' nur mit Rueckruf (Plan E15). Launcher-Vollform mit Aktivieren/Erneuern/Deaktivieren, Token nur einmalig sichtbar und nur in variante launcher, TLS-Fingerabdruck. @jm/control-config nur per import type. Kreuzprodukt 216 + 48 Faelle." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Texte zusätzlich: `steuerung` „Steuerserver“ (Beschriftung des Schalters mit `capabilities.enableToggle`, die Spec nennt
  keinen) und `token` „Token“ (Beschriftung der einmaligen Token-Zeile). Der Companion-Hinweis steht wörtlich wie im Gerüst.
- „Verbunden“ zeigt bei `running === true` ohne gemessene Zahl „unbekannt“ (Feld bleibt, damit die Reihenfolge stabil ist).
- Kreuzprodukt Launcher (mode × hasToken × hasTls × revealedToken × error, 48 Fälle) zusätzlich zum Tool-Kreuzprodukt.
- Zusatzfeld „Steuerserver“ an/aus (`capabilities.enableToggle`), nicht in der Feldliste von Spec 6.2: bildet Switcher
  „Fernsteuerung (an/aus + Port editierbar, `store/settings.ts:23`)“ aus Anhang A ab, damit der Switcher beim Umbau keine
  Funktion verliert (Spec 10; E24, Owner-Liste).
- Der Beispiel-Token im Test ist `0000-0000-0000-0000` (wie in der Galerie). Der frühere Beispielwert (Wort in Großbuchstaben mit Ziffern, 16 Zeichen, hier bewusst nicht wiederholt) passte auf
  die gitleaks-Standardregel `generic-api-key` (Entropie 3,58 über der Schwelle 3,5; nachgerechnet, gitleaks selbst lokal
  nicht installiert) und hätte den Job `secret-scan` rot machen können.
- Nachbesserung nach dem Review: Kreuzprodukt über die zwei Capability-Bits (M8), `motion-reduce:transition-none` an den
  Bestands-Knöpfen (M9, G8).

**Nachgerechnet:** Gleiche Kopie, nach Task 18: Step 2 rot mit `… export named 'REMOTE_TEXTE'`; Typprüfung ohne Meldung, also löst `import type { SuiteControlConfig } from '@jm/control-config'` auf und `packages/control-config/src/index.ts` besteht die strenge Prüfung mit. Nach der Nachbesserung neu gemessen: Step 6 grün mit 190 × `ok`, Mutationsprobe M1–M9 je rot (4, 1, 3, 1, 1, 1, 2, 2, 1 FAIL); M3 nur mit der ersten Ersetzung: 1 FAIL (Sicht-Test). Nach der zweiten Nachbesserung (Tasks 16–18 geändert): 195 × `ok`, Proben gleich.

---
### Task 20: `AudioDeviceSection`

**Spec:** 6.2 (Zeile Audiogerät und Absatz „Audiogerät“: nur `{ id, label }`, mehrere benannte Wahlen, Richtung, Pegel*,
Sperrgrund, Wechsel-Warnung, „nie still auf den Standard“), 7.1–7.3. Plan: E11, E17, G5, G6, Review Focus 3.

**Arbeitsverzeichnis/Voraussetzung:** wie Task 16; Tasks 16–19 committet.

**Dateien:**
- Create: `packages/settings/src/abschnitte/audio-device.ts`, `packages/settings/src/abschnitte/AudioDeviceSection.tsx`,
  `packages/settings/test/audio-device.test.tsx`
- Modify: `packages/settings/src/index.ts` (zwei Zeilen am Ende), `packages/settings/test/selftest.ts` (eine Zeile)

**Interfaces:**
- Consumes: 9.9 wie Task 18; aus `@jm/ui`: `UNBEKANNT`, `zahlText`, `type SelectOption`, `type StatusState`, `Button`,
  `Field({ label, hint, lockedReason })` (sperrt per Kontext die Auswahl darin), `Select({ options, value, placeholder,
  fehlendLabel, onChange, disabled })`.
- Produces (Props, `AudioDeviceOption`, `AudioChoice` wörtlich 9.10):
  ```ts
  // packages/settings/src/abschnitte/audio-device.ts
  export interface AudioDeviceOption { id: string; label: string }
  export interface AudioChoice {
    key: string; label: string; direction: 'input' | 'output'; devices?: AudioDeviceOption[]; value: string;
    defaultLabel?: string; required?: boolean; lastLabel?: string; levelDb?: number; lockedReason?: string;
    changeWarning?: string; onChange?(id: string): void;
  }
  export interface AudioDeviceSectionProps extends SectionInput {
    choices: AudioChoice[]; capabilities: { level?: boolean; refresh?: boolean }; onRefresh?(): void;
  }
  export const AUDIO_TEXTE;   // titel 'Audiogerät'; nichtGefundenZuletzt(name) 'Gerät nicht gefunden, zuletzt: {name}';
                              // nichtGefunden 'Gerät nicht gefunden'; keinGeraet 'kein Gerät gewählt';
                              // geraeteGewaehlt(n) '{n} Geräte gewählt'; wahlPraefix(wahl, text) '{wahl}: {text}';
                              // keinEingang 'Kein Eingang gefunden'; keinAusgang 'Kein Ausgang gefunden';
                              // pegelWert(db) 'Pegel: {gerundet} dB'; keinSignal 'Pegel: kein Signal';
                              // aktualisieren 'Geräte aktualisieren'; sperreEingangOffen 'solange der Eingang offen ist';
                              // wechselStoppt 'Ein Wechsel stoppt die laufende Verarbeitung'; unbekannt 'unbekannt'
  export const PEGEL_MIN_DB = -60;
  export interface AudioWahlView {
    key: string; label: string; status: SectionStatus; listeBekannt: boolean; optionen: SelectOption[];
    platzhalter?: string; hinweis?: string; pegel?: { text: string; prozent: number };
  }
  export interface AudioDeviceView extends SectionBase { sichtbar: { aktualisieren: boolean }; wahlen: AudioWahlView[] }
  export function audioDeviceView(p: AudioDeviceSectionProps): AudioDeviceView;
  // packages/settings/src/abschnitte/AudioDeviceSection.tsx
  export function AudioDeviceSection(p: AudioDeviceSectionProps): React.JSX.Element;
  ```

**Verhalten (verbindlich):**
- Je Wahl, Vorrang von oben: `devices === undefined` → `unbekannt`; `value !== ''` und in `devices` → ok mit dem
  Gerätenamen; `value !== ''` und nicht in `devices` → error „Gerät nicht gefunden, zuletzt: {lastLabel}“ (ohne
  `lastLabel` „Gerät nicht gefunden“); `value === ''` und `required` → warn „kein Gerät gewählt“; `value === ''` mit
  `defaultLabel` → ok „{defaultLabel}“; sonst off „kein Gerät gewählt“.
- Abschnitt: `error` → error; keine Wahl → off „kein Gerät gewählt“; eine Wahl → deren Status; mehrere → die schlechteste
  (error > warn > off > ok); alle ok → ok „{n} Geräte gewählt“, sonst Zustand und Text der **ersten** schlechtesten Wahl mit
  Präfix „{Wahl}: “.
- Der Wert bleibt immer gewählt: `Select` bekommt `fehlendLabel = lastLabel`, ein fehlendes Gerät steht dort als
  „nicht verfügbar: {lastLabel}“ (E11). `''` ist nur mit `defaultLabel` eine echte Option, sonst Platzhalter
  „– bitte wählen –“.
- Liste unbekannt → statt der Auswahl die Nur-Lese-Zeile „unbekannt“. Leere Liste → Hinweis „Kein Eingang gefunden“ bzw.
  „Kein Ausgang gefunden“; `changeWarning` steht ebenfalls als Hinweis (per `aria-describedby` verknüpft).
- `lockedReason` je Wahl über `Field` (sichtbar „Gesperrt: {grund}“, nur diese Auswahl gesperrt, E17). Abschnitts-`locked`
  sperrt alle Auswahlen und den Knopf.
- Pegel je Wahl (Spec 6.2 „je Wahl Pegelanzeige*“, „jede Wahl hat … optional einen Pegel“), unabhängig von der Richtung:
  nur mit `capabilities.level` **und** einem gemessenen `levelDb` (`undefined` = das Tool liefert für diese Wahl keinen Pegel,
  also keine Anzeige, Spec 7.3; ebenso `NaN` und `+Infinity`, die keine Messung sind). „Pegel: {dB gerundet} dB“ (−0,4 dB
  → „Pegel: 0 dB“, nie „-0“), `-Infinity` → „Pegel: kein Signal“; Balken −60 dB … 0 dB
  (Fläche in `--tally-ready`, `aria-hidden`). So bekommt auch ein Ausgang mit Pegel (Interpreter „Ausgabe“) eine Anzeige.
- Knopf „Geräte aktualisieren“ nur mit `capabilities.refresh` **und** `onRefresh`; er trägt `motion-reduce:transition-none` (G8).
- `capabilities`: Pegel genau mit `level`, Knopf genau mit `refresh` (Kreuzprodukt über die vier Kombinationen, je
  Capability ein Render-Fall).

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (neue Datei `packages/settings/test/audio-device.test.tsx`)

```tsx
// AudioDeviceSection (Spec 6.2 Absatz Audiogerät, 7, Plan E11, E17): nie still auf Standard.
import { enthaelt, enthaeltNicht, gleich, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import {
  abschnittStatusItem,
  AUDIO_TEXTE,
  AudioDeviceSection,
  audioDeviceView,
  type AudioChoice,
  type AudioDeviceSectionProps,
  type SectionStatus,
} from '../src/index';
import { bewegungsVerstoesse, kreuz, nachLetztem, pruefeFaelle, sperrZaehlung, statusText, vergleiche, vor } from './hilfe';

const s = (state: SectionStatus['state'], text: string): SectionStatus => ({ state, text });
const U = s('off', 'unbekannt');
const KEINS_OFF = s('off', 'kein Gerät gewählt');
const KEINS_WARN = s('warn', 'kein Gerät gewählt');
const STANDARD = s('ok', 'System-Standard');
const MIKRO = s('ok', 'Mikro 1');
const FEHLER = s('error', 'Fehler: Testfehler');
type Soll = SectionStatus | 'fehlt';

const LISTEN = {
  unbekannt: undefined,
  leer: [],
  liste: [
    { id: 'mic-1', label: 'Mikro 1' },
    { id: 'mic-2', label: 'Mikro 2' },
  ],
};
const WERTE = { leer: '', vorhanden: 'mic-1', fehlt: 'weg' };

// Tabelle je Wahl: Zeile = Liste|Wert; Spalten = (required, defaultLabel) in der Folge (–, –), (–, gesetzt),
// (true, –), (true, gesetzt). 'fehlt' heißt: „Gerät nicht gefunden, zuletzt: {lastLabel}“ bzw. ohne lastLabel
// „Gerät nicht gefunden“ (error). Eine Wahl allein bestimmt den Abschnitt; error schlägt alles.
const WAHL: Record<string, [Soll, Soll, Soll, Soll]> = {
  'unbekannt|leer': [U, U, U, U],
  'unbekannt|vorhanden': [U, U, U, U],
  'unbekannt|fehlt': [U, U, U, U],
  'leer|leer': [KEINS_OFF, STANDARD, KEINS_WARN, KEINS_WARN],
  'leer|vorhanden': ['fehlt', 'fehlt', 'fehlt', 'fehlt'],
  'leer|fehlt': ['fehlt', 'fehlt', 'fehlt', 'fehlt'],
  'liste|leer': [KEINS_OFF, STANDARD, KEINS_WARN, KEINS_WARN],
  'liste|vorhanden': [MIKRO, MIKRO, MIKRO, MIKRO],
  'liste|fehlt': ['fehlt', 'fehlt', 'fehlt', 'fehlt'],
};

const wahl = (c: Partial<AudioChoice>): AudioChoice => ({ key: 'eingang', label: 'Eingang', direction: 'input', value: '', ...c });
const basis: AudioDeviceSectionProps = { id: 'audio', choices: [], capabilities: {} };

{
  const faelle = kreuz({
    liste: ['unbekannt', 'leer', 'liste'],
    wert: ['leer', 'vorhanden', 'fehlt'],
    required: [undefined, true],
    defaultLabel: [undefined, 'System-Standard'],
    lastLabel: [undefined, 'Altes Mikro'],
    error: [undefined, 'Testfehler'],
  } as const);
  const choice = (f: (typeof faelle)[number]): AudioChoice =>
    wahl({ devices: LISTEN[f.liste], value: WERTE[f.wert], required: f.required, defaultLabel: f.defaultLabel, lastLabel: f.lastLabel });
  pruefeFaelle('Audio Kreuzprodukt (eine Wahl): Eingang → status aus der Tabelle', faelle, (f) => {
    const t = WAHL[`${f.liste}|${f.wert}`][(f.required ? 2 : 0) + (f.defaultLabel ? 1 : 0)];
    const soll = f.error
      ? FEHLER
      : t === 'fehlt'
        ? s('error', f.lastLabel ? `Gerät nicht gefunden, zuletzt: ${f.lastLabel}` : 'Gerät nicht gefunden')
        : t;
    return vergleiche(statusText(audioDeviceView({ ...basis, error: f.error, choices: [choice(f)] }).status), statusText(soll));
  });
  pruefeFaelle('Audio Kreuzprodukt (eine Wahl): Wahl-Status ohne error wie die Tabelle, nie live', faelle, (f) => {
    const w = audioDeviceView({ ...basis, error: f.error, choices: [choice(f)] }).wahlen[0];
    return w.status.state === 'live' ? 'live' : f.liste === 'unbekannt' && w.status.state === 'ok' ? 'ok bei unbekannter Liste' : null;
  });
}

// ── drei Wahlen (Interpreter-Muster) ──
const GERAETE = [
  { id: 'in-1', label: 'Floor-Mikro' },
  { id: 'in-2', label: 'Headset' },
];
const AUSGAENGE = [{ id: 'cable', label: 'CABLE Input' }];
const floor = (c: Partial<AudioChoice> = {}): AudioChoice =>
  wahl({ key: 'floor', label: 'Floor (O-Ton)', devices: GERAETE, value: 'in-1', required: true, ...c });
const dolmetscher = (c: Partial<AudioChoice> = {}): AudioChoice =>
  wahl({ key: 'interpreter', label: 'Dolmetscher', devices: GERAETE, value: 'in-2', required: true, ...c });
const ausgabe = (c: Partial<AudioChoice> = {}): AudioChoice =>
  wahl({ key: 'output', label: 'Ausgabe (virtuelles Kabel)', direction: 'output', devices: AUSGAENGE, value: 'cable', defaultLabel: 'Systemstandard', ...c });
{
  // Je Wahl vier Zustände: ok, unbekannt (off), kein Gerät (warn), fehlt (error).
  const ZUSTAND = {
    ok: {},
    unbekannt: { devices: undefined },
    keins: { value: '', defaultLabel: undefined, required: true },
    fehlt: { value: 'weg', lastLabel: 'Altgerät' },
  } satisfies Record<string, Partial<AudioChoice>>;
  const TEXT = { ok: '', unbekannt: 'unbekannt', keins: 'kein Gerät gewählt', fehlt: 'Gerät nicht gefunden, zuletzt: Altgerät' };
  const STATE = { ok: 'ok', unbekannt: 'off', keins: 'warn', fehlt: 'error' } as const;
  const RANG_SOLL = { ok: 0, unbekannt: 1, keins: 2, fehlt: 3 };
  const NAMEN = ['Floor (O-Ton)', 'Dolmetscher', 'Ausgabe (virtuelles Kabel)'];
  const faelle = kreuz({
    floor: ['ok', 'unbekannt', 'keins', 'fehlt'],
    dolmetscher: ['ok', 'unbekannt', 'keins', 'fehlt'],
    ausgabe: ['ok', 'unbekannt', 'keins', 'fehlt'],
  } as const);
  pruefeFaelle('Audio Kreuzprodukt (drei Wahlen): schlechteste Wahl, Text der ersten davon mit „{Wahl}: “', faelle, (f) => {
    const z = [f.floor, f.dolmetscher, f.ausgabe];
    const view = audioDeviceView({
      ...basis,
      choices: [floor(ZUSTAND[f.floor]), dolmetscher(ZUSTAND[f.dolmetscher]), ausgabe(ZUSTAND[f.ausgabe])],
    });
    const schlimmste = Math.max(...z.map((k) => RANG_SOLL[k]));
    const i = z.findIndex((k) => RANG_SOLL[k] === schlimmste);
    const soll = schlimmste === 0 ? 'ok 3 Geräte gewählt' : `${STATE[z[i]]} ${NAMEN[i]}: ${TEXT[z[i]]}`;
    return vergleiche(statusText(view.status), soll);
  });
  const fall = (choices: AudioChoice[]): string => statusText(audioDeviceView({ ...basis, choices }).status);
  gleich(fall([floor(), dolmetscher(), ausgabe()]), 'ok 3 Geräte gewählt', 'Audio drei Wahlen: alles da → „3 Geräte gewählt“');
  gleich(
    fall([floor(), dolmetscher({ value: 'weg', lastLabel: 'Headset alt' }), ausgabe()]),
    'error Dolmetscher: Gerät nicht gefunden, zuletzt: Headset alt',
    'Audio drei Wahlen: fehlendes Dolmetscher-Gerät',
  );
  gleich(
    fall([floor({ value: '' }), dolmetscher(), ausgabe({ value: 'weg' })]),
    'error Ausgabe (virtuelles Kabel): Gerät nicht gefunden',
    'Audio drei Wahlen: Fehler schlägt Warnung, auch wenn die Warnung weiter vorn steht',
  );
  gleich(fall([floor(), dolmetscher(), ausgabe({ value: '' })]), 'ok 3 Geräte gewählt', 'Audio drei Wahlen: Ausgabe auf Systemstandard ist ok');
  gleich(fall([]), 'off kein Gerät gewählt', 'Audio ohne Wahl: off „kein Gerät gewählt“');
}

{
  gleich(AUDIO_TEXTE.sperreEingangOffen, 'solange der Eingang offen ist', 'Audio: Sperrgrund-Konstante (Anzeige „Gesperrt: solange der Eingang offen ist“)');
  gleich(AUDIO_TEXTE.wechselStoppt, 'Ein Wechsel stoppt die laufende Verarbeitung', 'Audio: Wechsel-Warnung wörtlich aus Spec 6.2');
  gleich(audioDeviceView({ ...basis, capabilities: { level: true }, choices: [floor({ levelDb: -12.4 })] }).wahlen[0].pegel, { text: 'Pegel: -12 dB', prozent: 79 }, 'Audio Pegel: -12,4 dB → „-12 dB“, 79 %');
  gleich(audioDeviceView({ ...basis, capabilities: { level: true }, choices: [floor({ levelDb: -Infinity })] }).wahlen[0].pegel?.text, 'Pegel: kein Signal', 'Audio Pegel: -Infinity → kein Signal');
  gleich(audioDeviceView({ ...basis, capabilities: { level: true }, choices: [floor()] }).wahlen[0].pegel, undefined, 'Audio Pegel: ohne gemessenen Pegel keine Anzeige (nichts Erfundenes, Spec 7.3)');
  gleich(audioDeviceView({ ...basis, capabilities: { level: true }, choices: [ausgabe({ levelDb: -6 })] }).wahlen[0].pegel, { text: 'Pegel: -6 dB', prozent: 90 }, 'Audio Pegel: auch für einen Ausgang, wenn das Tool einen Pegel liefert (Spec 6.2 „je Wahl“)');
  gleich(audioDeviceView({ ...basis, choices: [floor({ levelDb: -6 })] }).wahlen[0].pegel, undefined, 'Audio Pegel: nur mit capabilities.level');
  gleich(
    [
      audioDeviceView({ ...basis, capabilities: { level: true }, choices: [floor({ levelDb: -0.4 })] }).wahlen[0].pegel?.text,
      audioDeviceView({ ...basis, capabilities: { level: true }, choices: [floor({ levelDb: Number.NaN })] }).wahlen[0].pegel,
      audioDeviceView({ ...basis, capabilities: { level: true }, choices: [floor({ levelDb: Number.POSITIVE_INFINITY })] }).wahlen[0].pegel,
    ],
    ['Pegel: 0 dB', undefined, undefined],
    'Audio Pegel: -0,4 dB → „Pegel: 0 dB“ (nicht „-0“); NaN und +Infinity sind keine Messung → kein Pegel (E26)',
  );
}

// ── Darstellung ──
const drei: AudioDeviceSectionProps = {
  ...basis,
  choices: [floor({ levelDb: -12 }), dolmetscher({ levelDb: -Infinity }), ausgabe()],
  capabilities: { level: true, refresh: true },
  onRefresh: () => {},
};
{
  const html = render(<AudioDeviceSection {...drei} />);
  for (const t of ['>Audiogerät<', '>Floor (O-Ton)<', '>Dolmetscher<', '>Ausgabe (virtuelles Kabel)<', '>Geräte aktualisieren</button>']) enthaelt(html, t, `Audio drei Wahlen: ${t}`);
  ok((html.match(/<select/g) ?? []).length === 3, 'Audio drei Wahlen: drei Auswahlen');
  ok(vor(html, '>Floor (O-Ton)<', '>Dolmetscher<') && vor(html, '>Dolmetscher<', '>Ausgabe (virtuelles Kabel)<'), 'Audio: Wahlen in der Reihenfolge des Arrays');
  ok((html.match(/Pegel: /g) ?? []).length === 2, 'Audio: Pegel für die zwei Wahlen mit gemessenem Pegel, keiner für den Ausgang ohne Pegel');
  enthaelt(html, '>Systemstandard</option>', 'Audio: Standard-Option des Ausgangs');
  enthaelt(html, '>3 Geräte gewählt</span>', 'Audio: Statuspille „3 Geräte gewählt“');
  pruefeIdVerweise(html, 'Audio: alle id-Verweise gültig');
  gleich(sperrZaehlung(html).gesperrt, 0, 'Audio ohne Sperre: nichts gesperrt');
  gleich(bewegungsVerstoesse(html), [], 'Audio: Übergänge nur motion-safe oder mit motion-reduce:transition-none (G8)');
}
{
  const faelle = kreuz({ level: [false, true], refresh: [false, true] } as const);
  pruefeFaelle('Audio capabilities: Pegel genau mit level, Knopf genau mit refresh', faelle, (c) => {
    const v = audioDeviceView({ ...drei, capabilities: c });
    const pegel = v.wahlen.map((w) => w.pegel !== undefined);
    return pegel.join() === [c.level, c.level, false].join() && v.sichtbar.aktualisieren === c.refresh
      ? null
      : `pegel ${pegel.join()}, aktualisieren ${v.sichtbar.aktualisieren}`;
  });
  const nurPegel = render(<AudioDeviceSection {...drei} capabilities={{ level: true }} />);
  const nurKnopf = render(<AudioDeviceSection {...drei} capabilities={{ refresh: true }} />);
  ok(
    nurPegel.includes('Pegel: ') && !nurPegel.includes('Geräte aktualisieren') && nurKnopf.includes('Geräte aktualisieren') && !nurKnopf.includes('Pegel'),
    'Audio je Capability allein: genau ihr Feld erscheint, kein anderes',
  );
}
{
  const html = render(<AudioDeviceSection {...drei} capabilities={{}} />);
  enthaeltNicht(html, 'Pegel', 'Audio ohne level: keine Pegelanzeige');
  enthaeltNicht(html, 'Geräte aktualisieren', 'Audio ohne refresh: kein Knopf');
  enthaeltNicht(render(<AudioDeviceSection {...drei} onRefresh={undefined} />), 'Geräte aktualisieren', 'Audio refresh ohne onRefresh: kein Knopf');
}
{
  const html = render(<AudioDeviceSection {...drei} choices={[floor(), dolmetscher({ value: 'weg', lastLabel: 'Headset alt' }), ausgabe()]} />);
  enthaelt(html, 'nicht verfügbar: Headset alt', 'Audio fehlendes Gerät: bleibt gewählt, als „nicht verfügbar: {zuletzt}“');
  enthaelt(html, 'Dolmetscher: Gerät nicht gefunden, zuletzt: Headset alt', 'Audio fehlendes Gerät: Statustext mit Wahl und letztem Namen');
}
{
  const html = render(
    <AudioDeviceSection {...drei} choices={[floor({ devices: [] }), dolmetscher({ devices: undefined }), ausgabe({ devices: [], value: '' })]} />,
  );
  enthaelt(html, 'Kein Eingang gefunden', 'Audio Leerliste Eingang: „Kein Eingang gefunden“');
  enthaelt(html, 'Kein Ausgang gefunden', 'Audio Leerliste Ausgang: „Kein Ausgang gefunden“');
  ok((html.match(/<select/g) ?? []).length === 2, 'Audio Liste unbekannt: für diese Wahl keine Auswahl');
  enthaelt(html, '>unbekannt</div>', 'Audio Liste unbekannt: Anzeige „unbekannt“');
}
{
  const html = render(
    <AudioDeviceSection
      {...drei}
      choices={[floor({ lockedReason: AUDIO_TEXTE.sperreEingangOffen }), dolmetscher({ changeWarning: AUDIO_TEXTE.wechselStoppt }), ausgabe()]}
    />,
  );
  enthaelt(html, 'Gesperrt: solange der Eingang offen ist', 'Audio Sperrgrund je Wahl sichtbar');
  ok((html.match(/<select[^>]*disabled=""/g) ?? []).length === 1, 'Audio Sperrgrund je Wahl: nur diese Auswahl gesperrt');
  enthaelt(html, 'Ein Wechsel stoppt die laufende Verarbeitung', 'Audio Wechsel-Warnung sichtbar');
  pruefeIdVerweise(html, 'Audio Sperrgrund und Warnung per aria-describedby verknüpft');
}
{
  const html = render(<AudioDeviceSection {...drei} locked="Vom Master vorgegeben" />);
  const z = sperrZaehlung(html);
  ok(z.alle === 4 && z.gesperrt === 4, `Audio locked: alle Bedienelemente disabled (${z.gesperrt} von ${z.alle})`);
  ok(vor(html, 'Gesperrt: Vom Master vorgegeben', '<select'), 'Audio locked: Grund vor den Feldern');
}
{
  const html = render(<AudioDeviceSection {...drei} error="Audio-Treiber nicht geladen" />);
  ok(nachLetztem(html, 'data-fehler="true"', '<select'), 'Audio error: Fehlertext nach den Feldern');
}
{
  const p: AudioDeviceSectionProps = { ...drei, choices: [floor({ value: '' }), dolmetscher(), ausgabe()] };
  const view = audioDeviceView(p);
  const item = abschnittStatusItem(view, { group: 'tool', label: 'Audio' });
  const html = render(<AudioDeviceSection {...p} />);
  ok(item.state === 'warn' && html.includes(`data-state="${item.state}"`) && html.includes(`>${item.detail}</span>`), 'Audio: abschnittStatusItem = Statuspille (Zustand und Text)');
}
```

In `packages/settings/test/selftest.ts`, Vorher:
```ts
abschluss();
```
Nachher:
```ts
import './audio-device.test';
abschluss();
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/settings
```
Erwartet (gemessen), Exitcode 1:
```
SyntaxError: The requested module '../src/index' does not provide an export named 'AUDIO_TEXTE'
```

- [ ] **Step 3: Ableitung `packages/settings/src/abschnitte/audio-device.ts`** (neue Datei)

```ts
// --- @jm/settings: Audiogerät (Spec 6.2 Absatz Audiogerät, Regeln 7.1–7.3, Plan E11, E17) ---
//
// Der Abschnitt kennt nur `{ id, label }` (Browser-Geräte und PortAudio übersetzt die App). Ein
// gewähltes Gerät, das in der gemeldeten Liste fehlt, bleibt gewählt: Die Auswahl zeigt
// „nicht verfügbar: …“, der Status „Gerät nicht gefunden, zuletzt: {name}“. Nie still auf Standard.
import { UNBEKANNT, zahlText, type SelectOption, type StatusState } from '@jm/ui';
import { ABSCHNITT_TEXTE, fehlerStatus, hatFehler, st, STATUS_UNBEKANNT, type SectionBase, type SectionInput, type SectionStatus } from '../vertrag';

export interface AudioDeviceOption { id: string; label: string }           // Spec 6.2: nur {id,label}

export interface AudioChoice {
  key: string; label: string; direction: 'input' | 'output';
  devices?: AudioDeviceOption[];     // gemessen; undefined = Liste unbekannt
  value: string;                     // '' = Standard bzw. keine Wahl
  defaultLabel?: string;             // Text der Option '' (z. B. „System-Standard“); fehlt → '' heißt „nicht gewählt“
  required?: boolean;                // '' ist ein Fehlzustand
  lastLabel?: string;                // Name des zuletzt gewählten Geräts
  levelDb?: number;                  // nur mit capabilities.level; undefined = kein Pegel (keine Anzeige), -Infinity = kein Signal
  lockedReason?: string;
  changeWarning?: string;
  onChange?(id: string): void;
}

export interface AudioDeviceSectionProps extends SectionInput {
  choices: AudioChoice[];
  capabilities: { level?: boolean; refresh?: boolean };
  onRefresh?(): void;
}

export const AUDIO_TEXTE = {
  titel: 'Audiogerät',
  nichtGefundenZuletzt: (name: string) => `Gerät nicht gefunden, zuletzt: ${name}`,
  nichtGefunden: 'Gerät nicht gefunden',
  keinGeraet: 'kein Gerät gewählt',
  geraeteGewaehlt: (n: number) => `${zahlText(n)} Geräte gewählt`,
  wahlPraefix: (wahl: string, text: string) => `${wahl}: ${text}`,
  keinEingang: 'Kein Eingang gefunden',
  keinAusgang: 'Kein Ausgang gefunden',
  pegelWert: (db: number) => `Pegel: ${zahlText(Math.round(db) || 0)} dB`,   // || 0: -0,4 dB ergäbe sonst „-0 dB“
  keinSignal: 'Pegel: kein Signal',
  aktualisieren: 'Geräte aktualisieren',
  sperreEingangOffen: 'solange der Eingang offen ist',
  wechselStoppt: 'Ein Wechsel stoppt die laufende Verarbeitung',
  unbekannt: UNBEKANNT,
} as const;

/** Untere Grenze der Pegelanzeige in dB (0 dB = voll). */
export const PEGEL_MIN_DB = -60;

export interface AudioWahlView {
  key: string;
  label: string;
  status: SectionStatus;
  listeBekannt: boolean;             // devices !== undefined
  optionen: SelectOption[];          // '' (mit defaultLabel) + Geräte; ein fehlender Wert ergänzt Select selbst
  platzhalter?: string;              // „– bitte wählen –“, wenn '' keine echte Option ist
  hinweis?: string;                  // Leerliste und Wechsel-Warnung
  pegel?: { text: string; prozent: number };   // nur mit capabilities.level und gemessenem levelDb (jede Richtung)
}

export interface AudioDeviceView extends SectionBase {
  sichtbar: { aktualisieren: boolean };
  wahlen: AudioWahlView[];
}

const RANG: Record<StatusState, number> = { ok: 0, off: 1, warn: 2, error: 3, live: 4 };

function wahlStatus(c: AudioChoice): SectionStatus {
  if (c.devices === undefined) return STATUS_UNBEKANNT;
  if (c.value !== '') {
    const geraet = c.devices.find((d) => d.id === c.value);
    if (geraet) return st('ok', geraet.label || geraet.id);
    return st('error', c.lastLabel ? AUDIO_TEXTE.nichtGefundenZuletzt(c.lastLabel) : AUDIO_TEXTE.nichtGefunden);
  }
  if (c.required === true) return st('warn', AUDIO_TEXTE.keinGeraet);
  if (c.defaultLabel) return st('ok', c.defaultLabel);
  return st('off', AUDIO_TEXTE.keinGeraet);
}

/** Gemessen ist eine endliche Zahl oder -Infinity (kein Signal); NaN und +Infinity sind keine Messung (E26). */
function gemessen(db: number | undefined): db is number {
  return db === -Infinity || (typeof db === 'number' && Number.isFinite(db));
}

function pegel(db: number): { text: string; prozent: number } {
  if (db === -Infinity) return { text: AUDIO_TEXTE.keinSignal, prozent: 0 };
  const prozent = Math.round(Math.min(1, Math.max(0, (db - PEGEL_MIN_DB) / -PEGEL_MIN_DB)) * 100);
  return { text: AUDIO_TEXTE.pegelWert(db), prozent };
}

function wahlView(c: AudioChoice, level: boolean): AudioWahlView {
  const leer = c.devices !== undefined && c.devices.length === 0 ? (c.direction === 'input' ? AUDIO_TEXTE.keinEingang : AUDIO_TEXTE.keinAusgang) : undefined;
  const hinweis = [leer, c.changeWarning].filter((t): t is string => typeof t === 'string' && t !== '').join(' ');
  return {
    key: c.key,
    label: c.label,
    status: wahlStatus(c),
    listeBekannt: c.devices !== undefined,
    optionen: [
      ...(c.defaultLabel ? [{ value: '', label: c.defaultLabel }] : []),
      ...(c.devices ?? []).map((d) => ({ value: d.id, label: d.label || d.id })),
    ],
    platzhalter: c.defaultLabel ? undefined : ABSCHNITT_TEXTE.bitteWaehlen,
    hinweis: hinweis === '' ? undefined : hinweis,
    pegel: level && gemessen(c.levelDb) ? pegel(c.levelDb) : undefined,
  };
}

function audioStatus(p: AudioDeviceSectionProps, wahlen: readonly AudioWahlView[]): SectionStatus {
  if (hatFehler(p)) return fehlerStatus(p.error);
  if (wahlen.length === 0) return st('off', AUDIO_TEXTE.keinGeraet);
  if (wahlen.length === 1) return wahlen[0].status;
  const schlimmste = Math.max(...wahlen.map((w) => RANG[w.status.state]));
  if (schlimmste === RANG.ok) return st('ok', AUDIO_TEXTE.geraeteGewaehlt(wahlen.length));
  const erste = wahlen.find((w) => RANG[w.status.state] === schlimmste) as AudioWahlView;
  return { state: erste.status.state, text: AUDIO_TEXTE.wahlPraefix(erste.label, erste.status.text) };
}

export function audioDeviceView(p: AudioDeviceSectionProps): AudioDeviceView {
  const wahlen = p.choices.map((c) => wahlView(c, p.capabilities.level === true));
  return {
    id: p.id,
    status: audioStatus(p, wahlen),
    locked: p.locked,
    error: p.error,
    sichtbar: { aktualisieren: p.capabilities.refresh === true && typeof p.onRefresh === 'function' },
    wahlen,
  };
}
```

- [ ] **Step 4: Komponente `packages/settings/src/abschnitte/AudioDeviceSection.tsx`** (neue Datei)

```tsx
// --- @jm/settings: AudioDeviceSection (Spec 6.2), mehrere benannte Wahlen ---
import { Button, Field, Select } from '@jm/ui';
import { Anzeige, SectionFrame } from '../SectionFrame';
import { istGesperrt } from '../vertrag';
import { AUDIO_TEXTE, audioDeviceView, type AudioDeviceSectionProps } from './audio-device';

export function AudioDeviceSection(p: AudioDeviceSectionProps): React.JSX.Element {
  const view = audioDeviceView(p);
  const gesperrt = istGesperrt(view);
  const sperre = gesperrt ? true : undefined;
  return (
    <SectionFrame view={view} titel={AUDIO_TEXTE.titel}>
      {view.wahlen.map((w, i) => {
        const c = p.choices[i];
        return (
          <div key={w.key} data-wahl={w.key} className="space-y-1">
            {w.listeBekannt ? (
              <Field label={w.label} hint={w.hinweis} lockedReason={c.lockedReason || undefined}>
                <Select
                  options={w.optionen}
                  value={c.value}
                  placeholder={w.platzhalter}
                  fehlendLabel={c.lastLabel || undefined}
                  onChange={(v) => c.onChange?.(v)}
                  disabled={sperre}
                />
              </Field>
            ) : (
              <Anzeige label={w.label} hinweis={w.hinweis}>
                {AUDIO_TEXTE.unbekannt}
              </Anzeige>
            )}
            {w.pegel ? (
              <div className="space-y-1">
                <p className="text-[11px] text-[var(--muted-foreground)] tabular">{w.pegel.text}</p>
                <div aria-hidden="true" className="h-1.5 rounded-[var(--radius-md)] bg-[var(--secondary)]">
                  <div className="h-full rounded-[var(--radius-md)] bg-[var(--tally-ready)]" style={{ width: `${w.pegel.prozent}%` }} />
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
      {view.sichtbar.aktualisieren ? (
        <Button type="button" variant="outline" size="sm" uppercase={false} className="motion-reduce:transition-none" onClick={() => p.onRefresh?.()} disabled={gesperrt}>
          {AUDIO_TEXTE.aktualisieren}
        </Button>
      ) : null}
    </SectionFrame>
  );
}
```

- [ ] **Step 5: Exporte** (`packages/settings/src/index.ts`), Vorher:

```ts
export { RemoteControlSection } from './abschnitte/RemoteControlSection';
```
Nachher:
```ts
export { RemoteControlSection } from './abschnitte/RemoteControlSection';
export { type AudioDeviceOption, type AudioChoice, type AudioDeviceSectionProps, type AudioDeviceView, type AudioWahlView, AUDIO_TEXTE, PEGEL_MIN_DB, audioDeviceView } from './abschnitte/audio-device';
export { AudioDeviceSection } from './abschnitte/AudioDeviceSection';
```

- [ ] **Step 6: Test laufen lassen (grün)**

```
npm run selftest -w @jm/settings
```
Erwartet (gemessen): 243 Zeilen `ok` (48 neu), keine `FAIL`, `ALLE TESTS OK`. Neu unter anderem:
```
ok   Audio Kreuzprodukt (eine Wahl): Eingang → status aus der Tabelle (144 Fälle)
ok   Audio Kreuzprodukt (drei Wahlen): schlechteste Wahl, Text der ersten davon mit „{Wahl}: “ (64 Fälle)
ok   Audio drei Wahlen: Fehler schlägt Warnung, auch wenn die Warnung weiter vorn steht
ok   Audio fehlendes Gerät: bleibt gewählt, als „nicht verfügbar: {zuletzt}“
ok   Audio Sperrgrund je Wahl: nur diese Auswahl gesperrt
ok   Audio Pegel: -12,4 dB → „-12 dB“, 79 %
ok   Audio Pegel: auch für einen Ausgang, wenn das Tool einen Pegel liefert (Spec 6.2 „je Wahl“)
ok   Audio Pegel: -0,4 dB → „Pegel: 0 dB“ (nicht „-0“); NaN und +Infinity sind keine Messung → kein Pegel (E26)
ok   Audio capabilities: Pegel genau mit level, Knopf genau mit refresh (4 Fälle)
ok   Audio locked: alle Bedienelemente disabled (4 von 4)
```

- [ ] **Step 7: Typprüfung**

```
npm run typecheck -w @jm/settings
npm run typecheck -w @jm/ui
```
Erwartet (gemessen): beide ohne Meldung, Exitcode 0.

- [ ] **Step 8: Stagen und Mutationsprobe**

```
git add packages/settings/src/abschnitte/audio-device.ts packages/settings/src/abschnitte/AudioDeviceSection.tsx packages/settings/src/index.ts packages/settings/test/audio-device.test.tsx packages/settings/test/selftest.ts
```
Je Mutation allein, Selbsttest rot, `git checkout -- <pfad>`.

**M1 · Fehlendes Gerät fällt still auf das erste** (`packages/settings/src/abschnitte/audio-device.ts`). Vorher:
```ts
    const geraet = c.devices.find((d) => d.id === c.value);
```
Nachher:
```ts
    const geraet = c.devices.find((d) => d.id === c.value) ?? c.devices[0];
```
Erwartet: `FAIL Audio Kreuzprodukt (eine Wahl): Eingang → status aus der Tabelle (144 Fälle)`, `FAIL Audio Kreuzprodukt (drei Wahlen): …`, `FAIL Audio drei Wahlen: fehlendes Dolmetscher-Gerät`, `FAIL Audio drei Wahlen: Fehler schlägt Warnung, …`, `FAIL Audio fehlendes Gerät: Statustext mit Wahl und letztem Namen`.

**M2 · Unbekannte Liste als ok** (`packages/settings/src/abschnitte/audio-device.ts`). Vorher:
```ts
  if (c.devices === undefined) return STATUS_UNBEKANNT;
```
Nachher:
```ts
  if (c.devices === undefined) return st('ok', c.lastLabel ?? c.value);
```
Erwartet: `FAIL Audio Kreuzprodukt (eine Wahl): Eingang → status aus der Tabelle (144 Fälle)`, `FAIL Audio Kreuzprodukt (eine Wahl): Wahl-Status ohne error wie die Tabelle, nie live (144 Fälle)`, `FAIL Audio Kreuzprodukt (drei Wahlen): …`.

**M3 · Schwere off/warn vertauscht** (`packages/settings/src/abschnitte/audio-device.ts`). Vorher:
```ts
{ ok: 0, off: 1, warn: 2, error: 3, live: 4 }
```
Nachher:
```ts
{ ok: 0, off: 2, warn: 1, error: 3, live: 4 }
```
Erwartet: `FAIL Audio Kreuzprodukt (drei Wahlen): schlechteste Wahl, Text der ersten davon mit „{Wahl}: “ (64 Fälle)`.

**M4 · `required` ignoriert** (`packages/settings/src/abschnitte/audio-device.ts`). Vorher:
```ts
  if (c.required === true) return st('warn', AUDIO_TEXTE.keinGeraet);
  if (c.defaultLabel) return st('ok', c.defaultLabel);
```
Nachher:
```ts
  if (c.defaultLabel) return st('ok', c.defaultLabel);
```
Erwartet: `FAIL Audio Kreuzprodukt (eine Wahl): …`, `FAIL Audio Kreuzprodukt (drei Wahlen): …`, `FAIL Audio: abschnittStatusItem = Statuspille (Zustand und Text)`.

**M5 · Letzte statt erste betroffene Wahl** (`packages/settings/src/abschnitte/audio-device.ts`). Vorher:
```ts
  const erste = wahlen.find((w) => RANG[w.status.state] === schlimmste) as AudioWahlView;
```
Nachher:
```ts
  const erste = [...wahlen].reverse().find((w) => RANG[w.status.state] === schlimmste) as AudioWahlView;
```
Erwartet: `FAIL Audio Kreuzprodukt (drei Wahlen): schlechteste Wahl, Text der ersten davon mit „{Wahl}: “ (64 Fälle)`.

**M6 · Pegel nur für Eingänge** (`packages/settings/src/abschnitte/audio-device.ts`; die Einschränkung der ersten Fassung,
Review-Befund gegen Spec 6.2). Vorher:
```ts
    pegel: level && gemessen(c.levelDb) ? pegel(c.levelDb) : undefined,
```
Nachher:
```ts
    pegel: level && c.direction === 'input' && gemessen(c.levelDb) ? pegel(c.levelDb) : undefined,
```
Erwartet: `FAIL Audio Pegel: auch für einen Ausgang, wenn das Tool einen Pegel liefert (Spec 6.2 „je Wahl“)`.

**M7 · Abschnitts-Sperre erreicht die Auswahl nicht** (`packages/settings/src/abschnitte/AudioDeviceSection.tsx`). Vorher:
```tsx
                  onChange={(v) => c.onChange?.(v)}
                  disabled={sperre}
```
Nachher:
```tsx
                  onChange={(v) => c.onChange?.(v)}
```
Erwartet: `FAIL Audio locked: alle Bedienelemente disabled (1 von 4)`.

**M8 · Letzter Gerätename nicht an die Auswahl** (`packages/settings/src/abschnitte/AudioDeviceSection.tsx`). Vorher:
```tsx
                  fehlendLabel={c.lastLabel || undefined}
                  onChange={(v) => c.onChange?.(v)}
```
Nachher:
```tsx
                  onChange={(v) => c.onChange?.(v)}
```
Erwartet: `FAIL Audio fehlendes Gerät: bleibt gewählt, als „nicht verfügbar: {zuletzt}“`.

**M9 · Pegel ohne Messwert erfunden** (`packages/settings/src/abschnitte/audio-device.ts`). Vorher:
```ts
    pegel: level && gemessen(c.levelDb) ? pegel(c.levelDb) : undefined,
```
Nachher:
```ts
    pegel: level ? pegel(c.levelDb ?? -Infinity) : undefined,
```
Erwartet: `FAIL Audio Pegel: ohne gemessenen Pegel keine Anzeige (nichts Erfundenes, Spec 7.3)`, `FAIL Audio Pegel: -0,4 dB → „Pegel: 0 dB“ (nicht „-0“); NaN und +Infinity sind keine Messung → kein Pegel (E26)`, `FAIL Audio: Pegel für die zwei Wahlen mit gemessenem Pegel, keiner für den Ausgang ohne Pegel`, `FAIL Audio capabilities: Pegel genau mit level, Knopf genau mit refresh (4 Fälle)`.

**M10 · Fremde Capability blendet den Pegel ein** (`packages/settings/src/abschnitte/audio-device.ts`). Vorher:
```ts
  const wahlen = p.choices.map((c) => wahlView(c, p.capabilities.level === true));
```
Nachher:
```ts
  const wahlen = p.choices.map((c) => wahlView(c, p.capabilities.level === true || p.capabilities.refresh === true));
```
Erwartet: `FAIL Audio capabilities: Pegel genau mit level, Knopf genau mit refresh (4 Fälle)`, `FAIL Audio je Capability allein: genau ihr Feld erscheint, kein anderes`.

**M11 · „-0 dB“** (`packages/settings/src/abschnitte/audio-device.ts`; zweite Prüfrunde). Vorher:
```ts
  pegelWert: (db: number) => `Pegel: ${zahlText(Math.round(db) || 0)} dB`,   // || 0: -0,4 dB ergäbe sonst „-0 dB“
```
Nachher:
```ts
  pegelWert: (db: number) => `Pegel: ${zahlText(Math.round(db))} dB`,
```
Erwartet: `FAIL Audio Pegel: -0,4 dB → „Pegel: 0 dB“ (nicht „-0“); NaN und +Infinity sind keine Messung → kein Pegel (E26)` mit `ist: ["Pegel: -0 dB",null,null]`.

**M12 · NaN und +Infinity gelten als gemessen** (`packages/settings/src/abschnitte/audio-device.ts`; die erste Fassung
zeigte für beide „Pegel: kein Signal“). Vorher:
```ts
  return db === -Infinity || (typeof db === 'number' && Number.isFinite(db));
```
Nachher:
```ts
  return db !== undefined;
```
Erwartet: `FAIL Audio Pegel: -0,4 dB → „Pegel: 0 dB“ (nicht „-0“); NaN und +Infinity sind keine Messung → kein Pegel (E26)` mit `ist: ["Pegel: 0 dB",{"text":"Pegel: 0 dB","prozent":null},{"text":"Pegel: ∞ dB","prozent":100}]`.

Danach `git status --short` (nur `A `/`M `) und wieder 243 × `ok`.

- [ ] **Step 9: Commit**

```
git add packages/settings/src/abschnitte/audio-device.ts packages/settings/src/abschnitte/AudioDeviceSection.tsx packages/settings/src/index.ts packages/settings/test/audio-device.test.tsx packages/settings/test/selftest.ts
git status --short
```
Erwartet genau:
```
A  packages/settings/src/abschnitte/AudioDeviceSection.tsx
A  packages/settings/src/abschnitte/audio-device.ts
M  packages/settings/src/index.ts
A  packages/settings/test/audio-device.test.tsx
M  packages/settings/test/selftest.ts
```
```
git commit -m "feat(settings): AudioDeviceSection - mehrere benannte Wahlen, nie still auf Standard" -m "audioDeviceView je Wahl: unbekannte Liste unbekannt, fehlendes Geraet error 'Geraet nicht gefunden, zuletzt: {name}' und bleibt in der Auswahl als 'nicht verfuegbar' (Plan E11), Pflichtwahl ohne Geraet warn. Abschnitt: schlechteste Wahl mit Praefix, sonst '{n} Geraete gewaehlt'. Sperrgrund je Wahl ueber Field, Wechsel-Warnung als Hinweis (Plan E17), Pegel je Wahl mit capabilities.level und gemessenem levelDb, auch fuer Ausgaenge (Plan E26; NaN und +Infinity zeigen nichts, -0 erscheint als 0 dB). Kreuzprodukt 144 Faelle je Wahl und 64 fuer drei Wahlen (Interpreter)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- `AUDIO_TEXTE.sperreEingangOffen` ist „solange der Eingang offen ist“ statt „Gesperrt, solange der Eingang offen ist“:
  `Field` stellt jedem Sperrgrund „Gesperrt: “ voran (E13), angezeigt wird also „Gesperrt: solange der Eingang offen ist“.
  Mit dem Spec-Wortlaut stünde dort „Gesperrt: Gesperrt, …“. Der Owner entscheidet, ob ihm das Komma der Spec wichtig ist
  (dann bräuchte `Field` einen Sperrgrund ohne Vorsatz).
- Kein Text „Pegel“ allein: die Pegelzeile heißt „Pegel: {n} dB“ bzw. „Pegel: kein Signal“ (zwei Texte statt drei).
- Kreuzprodukt je Wahl zusätzlich über `defaultLabel` und `error` (144 statt 36 Fälle); dazu drei Wahlen als 4³ = 64 Fälle
  (je Wahl ok, unbekannt, kein Gerät, fehlt).
- Ein Gerät mit leerem Namen (Browser ohne Mikrofon-Freigabe) erscheint mit seiner id statt mit leerem Text.
- Hinweis an den Owner (E17, unverändert): Laut Ist-Karte stoppt ein Gerätewechsel im Interpreter nichts, er wirkt erst
  nach dem Neustart. Die Konstante `wechselStoppt` trägt den Spec-Satz; welcher Satz dort gilt, entscheidet Welle 2.
- Nachbesserung nach dem Review (E26): Der Pegel hängt nicht mehr an der Richtung, sondern an einem gemessenen `levelDb`
  (Spec 6.2 „je Wahl“). Die erste Fassung zeigte ihn nur für Eingänge und für `undefined` „Pegel: kein Signal“ (erfunden,
  Regel 7.3). Dazu das Kreuzprodukt über die Capability-Bits (M10) und `motion-reduce:transition-none` am Knopf (G8).
- Zweite Nachbesserung (Prüfrunde 2): `gemessen(levelDb)` lässt nur endliche Zahlen und `-Infinity` zu; `NaN` und
  `+Infinity` zeigten vorher „Pegel: kein Signal“, also etwas nicht Gemessenes (M12). `Math.round(-0,4)` ergibt `-0`, und
  `zahlText(-0)` ergab „-0“ (gemessen, Node 24, `de-DE`); jetzt „Pegel: 0 dB“ (M11). Der Commit-Text sprach noch von
  „Pegel nur fuer Eingaenge“ und ist berichtigt.

**Nachgerechnet:** Gleiche Kopie, nach Task 19: Step 2 rot mit `… export named 'AUDIO_TEXTE'`; Typprüfung ohne Meldung. Nach der Nachbesserung neu gemessen: Step 6 grün mit 237 × `ok`, Mutationsprobe M1–M10 je rot (5, 3, 1, 3, 1, 1, 1, 1, 3, 2 FAIL). Zweite Nachbesserung: Step 6 grün mit 243 × `ok`, Mutationsprobe M1–M12 je rot (5, 3, 1, 3, 1, 1, 1, 1, 4, 2, 1, 1 FAIL).

---

### Task 21: `IveoSection` und `DataLinkSection`

**Spec:** 6.2 (Zeilen iveo und DataLink; „Das iveo-Token bleibt wie heute ausschließlich im Launcher.“; Absatz
iveo-Knopf), 7.1–7.3. Plan: E15, G5, G6.

**Arbeitsverzeichnis/Voraussetzung:** wie Task 16; Tasks 16–20 committet.

**Dateien:**
- Create: `packages/settings/src/abschnitte/iveo.ts`, `packages/settings/src/abschnitte/IveoSection.tsx`,
  `packages/settings/src/abschnitte/datalink.ts`, `packages/settings/src/abschnitte/DataLinkSection.tsx`,
  `packages/settings/test/iveo.test.tsx`, `packages/settings/test/datalink.test.tsx`
- Modify: `packages/settings/src/index.ts` (vier Zeilen am Ende), `packages/settings/test/selftest.ts` (zwei Zeilen)

**Interfaces:**
- Consumes: 9.9 wie Task 18; aus `@jm/ui`: `formatUhrzeitKurz(iso)` (9.3, `hh:mm` Ortszeit, ungültig → `undefined`),
  `zahlText`, `Button`.
- Produces (Props wörtlich 9.10):
  ```ts
  // packages/settings/src/abschnitte/iveo.ts
  export interface IveoSectionProps extends SectionInput {
    bound: boolean; eventName?: string; stage?: string; speakerCount?: number;
    delivery?: 'ok' | 'veraltet'; staleSince?: string; onOpenLauncher?(): void;
  }
  export const IVEO_TEXTE;    // titel 'iveo'; event 'Event'; buehne 'Bühne'; speaker 'Speaker'; verbunden 'verbunden';
                              // verbundenMitEvent(event) 'verbunden · {Event}'; nichtEingerichtet 'nicht eingerichtet';
                              // frueherStand 'Liste aus früherem Stand'; frueherStandSeit(hhmm) 'Liste aus früherem Stand (seit {hh:mm})';
                              // tokenImLauncher 'Das Zugriffstoken bleibt im Launcher.'; imLauncherEinrichten 'Im Launcher einrichten'
  export interface IveoView extends SectionBase {
    sichtbar: { event: boolean; buehne: boolean; speaker: boolean; imLauncher: boolean };
    speakerText?: string;
  }
  export function iveoView(p: IveoSectionProps): IveoView;
  export function IveoSection(p: IveoSectionProps): React.JSX.Element;            // IveoSection.tsx
  // packages/settings/src/abschnitte/datalink.ts
  export interface DataLinkSectionProps extends SectionInput {
    folder: string; folderMissing?: boolean; fileCount?: number; lastChange?: string; sourceLine?: string;
    notice?: string; backLabel?: string; onBack?(): void; onPickFolder?(): void;
  }
  export const DATALINK_TEXTE;  // titel 'DataLink'; ordner 'Ordner'; status 'Status'; ordnerWaehlen 'Ordner wählen …';
                                // eineDatei '1 Datei'; dateien(n, hhmm?) '{n} Dateien · {hh:mm}' bzw. ohne Zeit, n = 1 → '1 Datei';
                                // ordnerFehlt 'Ordner fehlt'; keinOrdner 'kein Ordner'; keineDatei 'keine Datei';
                                // gesperrtVomMaster 'Vom Master vorgegeben'
  export interface DataLinkView extends SectionBase {
    sichtbar: { ordnerWaehlen: boolean; status: boolean; zurueck: boolean };
    ordnerText: string;
  }
  export function dataLinkView(p: DataLinkSectionProps): DataLinkView;
  export function DataLinkSection(p: DataLinkSectionProps): React.JSX.Element;    // DataLinkSection.tsx
  ```

**Verhalten (verbindlich):**
- iveo, Vorrang von oben: `error` → error; `!bound` → off „nicht eingerichtet“; `delivery === 'veraltet'` → warn
  „Liste aus früherem Stand (seit {hh:mm})“ bzw. ohne gültiges `staleSince` ohne Klammer; `delivery === 'ok'` → ok
  „verbunden · {eventName}“ bzw. ohne Eventnamen „verbunden“; `delivery === undefined` → `unbekannt` (eine Show-Bindung
  ist nur ein Zwischenspeicher, gemessen ist sie nicht).
- iveo-Darstellung: Event, Bühne, Speaker als Nur-Lese-Zeilen, je nur wenn gebunden und geliefert (die Bühne liefert heute
  kein Tool); immer der Hinweis „Das Zugriffstoken bleibt im Launcher.“; Knopf „Im Launcher einrichten“ nur mit
  `onOpenLauncher` (E15). **Kein Eingabefeld, kein Token-Feld.**
- DataLink, Vorrang von oben: `error` → error; `folderMissing === true` → error „Ordner fehlt“; `folder === ''` → off
  „kein Ordner“; `fileCount === undefined` → `unbekannt`; `0` → warn „keine Datei“; sonst ok „{n} Dateien · {hh:mm}“
  („1 Datei“ bei eins, ohne gültige `lastChange` ohne Zeit). Nie „0 Dateien“. `locked` ändert den Status nicht.
- DataLink-Darstellung: Ordner (Pfad bzw. „kein Ordner“) · Knopf „Ordner wählen …“ (nur mit `onPickFolder`) · Status mit
  `sourceLine` und `notice` (fertige Texte der App, nur angezeigt; ohne beide entfällt die Zeile) · Knopf `backLabel`
  (Titler K1, nur mit `backLabel` **und** `onBack`). `locked` (typisch „Vom Master vorgegeben“) sperrt beide Knöpfe.
  `sourceLine`, `notice` und `backLabel` sind die einzige Ausnahme von „Texte fest im Paket“ (Spec 6.1; E25, Owner-Liste).
- Alle Knöpfe (Bestands-`Button`) tragen `motion-reduce:transition-none` (G8).

---

- [ ] **Step 1: Fehlschlagende Tests schreiben** (zwei neue Dateien)

`packages/settings/test/iveo.test.tsx`:
```tsx
// IveoSection (Spec 6.2, 7, Plan E15): verbunden nur gemessen, nie ein Token-Feld.
import { enthaelt, enthaeltNicht, gleich, ok, render } from '@jm/ui/testhilfe';
import { abschnittStatusItem, IVEO_TEXTE, IveoSection, iveoView, type IveoSectionProps, type SectionStatus } from '../src/index';
import { bewegungsVerstoesse, kreuz, nachLetztem, pruefeFaelle, sperrZaehlung, statusText, vergleiche, vor } from './hilfe';

const s = (state: SectionStatus['state'], text: string): SectionStatus => ({ state, text });
const U = s('off', 'unbekannt');
const NICHT = s('off', 'nicht eingerichtet');
const V = s('ok', 'verbunden');
const VG = s('ok', 'verbunden · Gala 2026');
const ALT_SEIT = s('warn', 'Liste aus früherem Stand (seit 09:05)');
const ALT = s('warn', 'Liste aus früherem Stand');
const FEHLER = s('error', 'Fehler: Testfehler');

// Ortszeit 09:05, damit formatUhrzeitKurz in jeder Zeitzone „09:05“ liefert.
const SEIT = new Date(2026, 9, 8, 9, 5).toISOString();
const STALE = { gueltig: SEIT, kaputt: 'kaputt', fehlt: undefined };

// Tabelle Eingang → status. Zeile = bound|delivery; Spalten = (staleSince, eventName) in der Folge
// (gültig, –), (gültig, gesetzt), (kaputt, –), (kaputt, gesetzt), (fehlt, –), (fehlt, gesetzt). error schlägt alles.
const TABELLE: Record<string, SectionStatus[]> = {
  'false|undefined': [NICHT, NICHT, NICHT, NICHT, NICHT, NICHT],
  'false|ok': [NICHT, NICHT, NICHT, NICHT, NICHT, NICHT],
  'false|veraltet': [NICHT, NICHT, NICHT, NICHT, NICHT, NICHT],
  'true|undefined': [U, U, U, U, U, U],
  'true|ok': [V, VG, V, VG, V, VG],
  'true|veraltet': [ALT_SEIT, ALT_SEIT, ALT, ALT, ALT, ALT],
};
const STALE_SPALTE = { gueltig: 0, kaputt: 2, fehlt: 4 };

const basis: IveoSectionProps = { id: 'iveo', bound: true };

{
  const faelle = kreuz({
    bound: [false, true],
    delivery: [undefined, 'ok', 'veraltet'],
    stale: ['gueltig', 'kaputt', 'fehlt'],
    eventName: [undefined, 'Gala 2026'],
    error: [undefined, 'Testfehler'],
  } as const);
  const props = (f: (typeof faelle)[number]): IveoSectionProps => ({
    ...basis,
    bound: f.bound,
    delivery: f.delivery,
    staleSince: STALE[f.stale],
    eventName: f.eventName,
    error: f.error,
  });
  pruefeFaelle('iveo Kreuzprodukt: Eingang → status aus der Tabelle', faelle, (f) => {
    const soll = f.error ? FEHLER : TABELLE[`${f.bound}|${f.delivery}`][STALE_SPALTE[f.stale] + (f.eventName ? 1 : 0)];
    return vergleiche(statusText(iveoView(props(f)).status), statusText(soll));
  });
  pruefeFaelle('iveo Kreuzprodukt: ok nur mit gemessener Lieferung', faelle, (f) =>
    iveoView(props(f)).status.state === 'ok' && f.delivery !== 'ok' ? 'ok ohne delivery ok' : null,
  );
}

{
  gleich(
    [IVEO_TEXTE.titel, IVEO_TEXTE.event, IVEO_TEXTE.buehne, IVEO_TEXTE.speaker, IVEO_TEXTE.tokenImLauncher],
    ['iveo', 'Event', 'Bühne', 'Speaker', 'Das Zugriffstoken bleibt im Launcher.'],
    'iveo: Titel, Feldnamen und Token-Hinweis wörtlich',
  );
}

// ── Darstellung ──
const alle: IveoSectionProps = {
  ...basis,
  delivery: 'ok',
  eventName: 'Gala 2026',
  stage: 'Saal 1',
  speakerCount: 12,
  onOpenLauncher: () => {},
};
{
  const html = render(<IveoSection {...alle} />);
  for (const t of ['>iveo<', '>Event<', '>Gala 2026<', '>Bühne<', '>Saal 1<', '>Speaker<', '>12<', 'Das Zugriffstoken bleibt im Launcher.', '>Im Launcher einrichten</button>']) {
    enthaelt(html, t, `iveo alle Angaben: ${t}`);
  }
  enthaelt(html, '>verbunden · Gala 2026</span>', 'iveo: Statuspille „verbunden · {Event}“');
  enthaeltNicht(html, '<input', 'iveo: kein Eingabefeld (das Token bleibt im Launcher)');
  enthaeltNicht(html, '>Token<', 'iveo: kein Token-Feld');
  gleich(sperrZaehlung(html), { alle: 1, gesperrt: 0 }, 'iveo: einziges Bedienelement ist der Knopf');
  ok(vor(html, '>Event<', '>Bühne<') && vor(html, '>Bühne<', '>Speaker<'), 'iveo: Felder in fester Reihenfolge');
  gleich(bewegungsVerstoesse(html), [], 'iveo: Übergänge nur motion-safe oder mit motion-reduce:transition-none (G8)');
}
{
  const html = render(<IveoSection {...alle} stage={undefined} speakerCount={undefined} onOpenLauncher={undefined} />);
  enthaeltNicht(html, '>Bühne<', 'iveo ohne Bühne: Feld ausgeblendet (Bühne ist heute nicht belegt)');
  enthaeltNicht(html, '>Speaker<', 'iveo ohne Speakerzahl: Feld ausgeblendet');
  enthaeltNicht(html, 'Im Launcher einrichten', 'iveo ohne Rückruf: kein Knopf (E15)');
}
{
  const html = render(<IveoSection {...alle} bound={false} />);
  enthaelt(html, '>nicht eingerichtet</span>', 'iveo ungebunden: „nicht eingerichtet“');
  enthaeltNicht(html, 'Gala 2026', 'iveo ungebunden: keine Event-Angaben');
  enthaelt(html, 'Im Launcher einrichten', 'iveo ungebunden: Knopf zum Einrichten bleibt');
}
{
  const html = render(<IveoSection {...alle} locked="Vom Master vorgegeben" />);
  gleich(sperrZaehlung(html), { alle: 1, gesperrt: 1 }, 'iveo locked: Knopf disabled');
  ok(vor(html, 'Gesperrt: Vom Master vorgegeben', '>Event<'), 'iveo locked: Grund vor den Feldern');
}
{
  const html = render(<IveoSection {...alle} error="iveo-Antwort unlesbar" />);
  ok(nachLetztem(html, 'data-fehler="true"', 'Im Launcher einrichten'), 'iveo error: Fehlertext nach den Feldern');
}
{
  const p: IveoSectionProps = { ...alle, delivery: 'veraltet', staleSince: SEIT };
  const item = abschnittStatusItem(iveoView(p), { group: 'verbindung', label: 'iveo' });
  const html = render(<IveoSection {...p} />);
  ok(item.state === 'warn' && html.includes(`data-state="${item.state}"`) && html.includes(`>${item.detail}</span>`), 'iveo: abschnittStatusItem = Statuspille (Zustand und Text)');
}
```

`packages/settings/test/datalink.test.tsx`:
```tsx
// DataLinkSection (Spec 6.2, 7): unbekannte Dateizahl nie als „0 Dateien“, App-Texte nur angezeigt.
import { enthaelt, enthaeltNicht, gleich, ok, render } from '@jm/ui/testhilfe';
import { abschnittStatusItem, DATALINK_TEXTE, DataLinkSection, dataLinkView, type DataLinkSectionProps, type SectionStatus } from '../src/index';
import { bewegungsVerstoesse, kreuz, nachLetztem, pruefeFaelle, sperrZaehlung, statusText, vergleiche, vor } from './hilfe';

const s = (state: SectionStatus['state'], text: string): SectionStatus => ({ state, text });
const U = s('off', 'unbekannt');
const KEIN_ORDNER = s('off', 'kein Ordner');
const FEHLT = s('error', 'Ordner fehlt');
const FEHLER = s('error', 'Fehler: Testfehler');
const ZAEHLEN = 'zählen' as const;

const AENDERUNG = new Date(2026, 9, 8, 9, 5).toISOString();   // Ortszeit 09:05

// Tabelle 1: Zeile = folder|folderMissing. ZAEHLEN heißt: Status aus Tabelle 2.
const ORDNER: Record<string, SectionStatus | typeof ZAEHLEN> = {
  'leer|undefined': KEIN_ORDNER,
  'leer|false': KEIN_ORDNER,
  'leer|true': FEHLT,
  'gesetzt|undefined': ZAEHLEN,
  'gesetzt|false': ZAEHLEN,
  'gesetzt|true': FEHLT,
};
// Tabelle 2: Zeile = fileCount|lastChange.
const ZAEHLUNG: Record<string, SectionStatus> = {
  'undefined|fehlt': U,
  'undefined|gesetzt': U,
  '0|fehlt': s('warn', 'keine Datei'),
  '0|gesetzt': s('warn', 'keine Datei'),
  '1|fehlt': s('ok', '1 Datei'),
  '1|gesetzt': s('ok', '1 Datei · 09:05'),
  '5|fehlt': s('ok', '5 Dateien'),
  '5|gesetzt': s('ok', '5 Dateien · 09:05'),
};

const basis: DataLinkSectionProps = { id: 'datalink', folder: 'D:\\Show\\Daten' };

{
  const faelle = kreuz({
    folder: ['leer', 'gesetzt'],
    folderMissing: [undefined, false, true],
    fileCount: [undefined, 0, 1, 5],
    lastChange: ['fehlt', 'gesetzt'],
    error: [undefined, 'Testfehler'],
    locked: [undefined, 'Vom Master vorgegeben'],
  } as const);
  const props = (f: (typeof faelle)[number]): DataLinkSectionProps => ({
    ...basis,
    folder: f.folder === 'leer' ? '' : basis.folder,
    folderMissing: f.folderMissing,
    fileCount: f.fileCount,
    lastChange: f.lastChange === 'gesetzt' ? AENDERUNG : undefined,
    error: f.error,
    locked: f.locked,
  });
  pruefeFaelle('DataLink Kreuzprodukt: Eingang → status aus den Tabellen (locked ändert den Status nicht)', faelle, (f) => {
    const o = ORDNER[`${f.folder}|${f.folderMissing}`];
    const soll = f.error ? FEHLER : o === ZAEHLEN ? ZAEHLUNG[`${f.fileCount}|${f.lastChange}`] : o;
    return vergleiche(statusText(dataLinkView(props(f)).status), statusText(soll));
  });
  pruefeFaelle('DataLink Kreuzprodukt: nie „0 Dateien“', faelle, (f) => (dataLinkView(props(f)).status.text.includes('0 Dateien') ? 'zeigt 0 Dateien' : null));
}

{
  gleich(
    [DATALINK_TEXTE.titel, DATALINK_TEXTE.ordner, DATALINK_TEXTE.status, DATALINK_TEXTE.ordnerWaehlen, DATALINK_TEXTE.gesperrtVomMaster],
    ['DataLink', 'Ordner', 'Status', 'Ordner wählen …', 'Vom Master vorgegeben'],
    'DataLink: Titel, Feldnamen, Knopf und Sperrgrund wörtlich',
  );
  gleich(DATALINK_TEXTE.dateien(1234), '1234 Dateien', 'DataLink: Zahl ohne Tausenderpunkt');
}

// ── Darstellung ──
const alle: DataLinkSectionProps = {
  ...basis,
  fileCount: 3,
  lastChange: AENDERUNG,
  sourceLine: 'Quelle: eigener Ordner D:\\Show\\Daten',
  notice: '„Ada“ ist nicht mehr in der Liste. Bitte einen Eintrag abrufen.',
  backLabel: 'Zurück zum eigenen Ordner (Daten)',
  onBack: () => {},
  onPickFolder: () => {},
};
{
  const html = render(<DataLinkSection {...alle} />);
  for (const t of ['>DataLink<', '>Ordner<', '>D:\\Show\\Daten<', '>Ordner wählen …</button>', '>Status<', 'Quelle: eigener Ordner', 'ist nicht mehr in der Liste', '>Zurück zum eigenen Ordner (Daten)</button>']) {
    enthaelt(html, t, `DataLink alle Angaben: ${t}`);
  }
  enthaelt(html, '>3 Dateien · 09:05</span>', 'DataLink: Statuspille „{n} Dateien · {hh:mm}“');
  ok(vor(html, '>Ordner<', '>Ordner wählen …<') && vor(html, '>Ordner wählen …<', '>Status<'), 'DataLink: Felder in fester Reihenfolge');
  gleich(bewegungsVerstoesse(html), [], 'DataLink: Übergänge nur motion-safe oder mit motion-reduce:transition-none (G8)');
}
{
  const html = render(<DataLinkSection {...alle} folder="" sourceLine={undefined} notice={undefined} onBack={undefined} onPickFolder={undefined} />);
  enthaelt(html, '>kein Ordner</div>', 'DataLink ohne Ordner: Anzeige „kein Ordner“');
  enthaeltNicht(html, '>Status<', 'DataLink ohne Quellzeile und Hinweis: kein Statusfeld');
  enthaeltNicht(html, 'Zurück zum eigenen Ordner', 'DataLink: Zurück-Knopf nur mit backLabel UND onBack');
  enthaeltNicht(html, 'Ordner wählen', 'DataLink ohne onPickFolder: kein Knopf');
}
{
  const html = render(<DataLinkSection {...alle} locked={DATALINK_TEXTE.gesperrtVomMaster} />);
  const z = sperrZaehlung(html);
  ok(z.alle === 2 && z.gesperrt === 2, `DataLink locked: alle Bedienelemente disabled (${z.gesperrt} von ${z.alle})`);
  enthaelt(html, 'Gesperrt: Vom Master vorgegeben', 'DataLink locked: „Gesperrt: Vom Master vorgegeben“');
  ok(vor(html, 'data-gesperrt="true"', '>Ordner<'), 'DataLink locked: Grund vor den Feldern');
}
{
  const html = render(<DataLinkSection {...alle} error="Datei nicht lesbar" />);
  ok(nachLetztem(html, 'data-fehler="true"', '</button>'), 'DataLink error: Fehlertext nach den Feldern');
}
{
  const p: DataLinkSectionProps = { ...alle, fileCount: undefined };
  const item = abschnittStatusItem(dataLinkView(p), { group: 'tool', label: 'DataLink' });
  const html = render(<DataLinkSection {...p} />);
  ok(item.state === 'off' && item.detail === 'unbekannt' && html.includes(`>${item.detail}</span>`), 'DataLink: abschnittStatusItem = Statuspille (Zustand und Text)');
}
```

In `packages/settings/test/selftest.ts`, Vorher:
```ts
abschluss();
```
Nachher:
```ts
import './iveo.test';
import './datalink.test';
abschluss();
```

- [ ] **Step 2: Tests laufen lassen (rot)**

```
npm run selftest -w @jm/settings
```
Erwartet (gemessen), Exitcode 1:
```
SyntaxError: The requested module '../src/index' does not provide an export named 'IVEO_TEXTE'
```

- [ ] **Step 3: iveo-Ableitung `packages/settings/src/abschnitte/iveo.ts`** (neue Datei)

```ts
// --- @jm/settings: iveo (Spec 6.2, Regeln 7.1–7.3, Plan E15) ---
//
// Das iveo-Token bleibt ausschließlich im Launcher: Der Abschnitt hat kein Token-Feld und keine
// Eingabe. „verbunden“ steht nur, wenn das Tool eine Lieferung gemessen hat (`delivery === 'ok'`);
// eine Show-Bindung allein ist ein Zwischenspeicher, also ohne Messung „unbekannt“.
import { formatUhrzeitKurz, zahlText } from '@jm/ui';
import { ABSCHNITT_TEXTE, fehlerStatus, hatFehler, st, STATUS_UNBEKANNT, type SectionBase, type SectionInput, type SectionStatus } from '../vertrag';

export interface IveoSectionProps extends SectionInput {
  bound: boolean;                    // Show mit iveo-Bindung offen
  eventName?: string; stage?: string; speakerCount?: number;
  delivery?: 'ok' | 'veraltet';      // gemessen; undefined = unbekannt
  staleSince?: string;               // ISO, nur bei 'veraltet'
  onOpenLauncher?(): void;
}

export const IVEO_TEXTE = {
  titel: 'iveo',
  event: 'Event',
  buehne: 'Bühne',
  speaker: 'Speaker',
  verbunden: 'verbunden',
  verbundenMitEvent: (event: string) => `verbunden · ${event}`,
  nichtEingerichtet: 'nicht eingerichtet',
  frueherStand: 'Liste aus früherem Stand',
  frueherStandSeit: (hhmm: string) => `Liste aus früherem Stand (seit ${hhmm})`,
  tokenImLauncher: 'Das Zugriffstoken bleibt im Launcher.',
  imLauncherEinrichten: ABSCHNITT_TEXTE.imLauncherEinrichten,
} as const;

export interface IveoView extends SectionBase {
  sichtbar: { event: boolean; buehne: boolean; speaker: boolean; imLauncher: boolean };
  speakerText?: string;
}

function iveoStatus(p: IveoSectionProps): SectionStatus {
  if (hatFehler(p)) return fehlerStatus(p.error);
  if (!p.bound) return st('off', IVEO_TEXTE.nichtEingerichtet);
  if (p.delivery === 'veraltet') {
    const seit = formatUhrzeitKurz(p.staleSince);
    return st('warn', seit ? IVEO_TEXTE.frueherStandSeit(seit) : IVEO_TEXTE.frueherStand);
  }
  if (p.delivery === 'ok') return st('ok', p.eventName ? IVEO_TEXTE.verbundenMitEvent(p.eventName) : IVEO_TEXTE.verbunden);
  return STATUS_UNBEKANNT;
}

export function iveoView(p: IveoSectionProps): IveoView {
  const da = (t: string | undefined): boolean => p.bound && typeof t === 'string' && t !== '';
  return {
    id: p.id,
    status: iveoStatus(p),
    locked: p.locked,
    error: p.error,
    sichtbar: {
      event: da(p.eventName),
      buehne: da(p.stage),
      speaker: p.bound && typeof p.speakerCount === 'number',
      imLauncher: typeof p.onOpenLauncher === 'function',
    },
    speakerText: p.bound && typeof p.speakerCount === 'number' ? zahlText(p.speakerCount) : undefined,
  };
}
```

- [ ] **Step 4: Komponente `packages/settings/src/abschnitte/IveoSection.tsx`** (neue Datei)

```tsx
// --- @jm/settings: IveoSection (Spec 6.2) – nur Anzeige, nie ein Token-Feld ---
import { Button } from '@jm/ui';
import { Anzeige, SectionFrame } from '../SectionFrame';
import { istGesperrt } from '../vertrag';
import { IVEO_TEXTE, iveoView, type IveoSectionProps } from './iveo';

export function IveoSection(p: IveoSectionProps): React.JSX.Element {
  const view = iveoView(p);
  return (
    <SectionFrame view={view} titel={IVEO_TEXTE.titel}>
      {view.sichtbar.event ? <Anzeige label={IVEO_TEXTE.event}>{p.eventName}</Anzeige> : null}
      {view.sichtbar.buehne ? <Anzeige label={IVEO_TEXTE.buehne}>{p.stage}</Anzeige> : null}
      {view.sichtbar.speaker ? <Anzeige label={IVEO_TEXTE.speaker}>{view.speakerText}</Anzeige> : null}
      <p className="text-[11px] text-[var(--muted-foreground)]">{IVEO_TEXTE.tokenImLauncher}</p>
      {view.sichtbar.imLauncher ? (
        <Button type="button" variant="outline" size="sm" uppercase={false} className="motion-reduce:transition-none" onClick={() => p.onOpenLauncher?.()} disabled={istGesperrt(view)}>
          {IVEO_TEXTE.imLauncherEinrichten}
        </Button>
      ) : null}
    </SectionFrame>
  );
}
```

- [ ] **Step 5: DataLink-Ableitung `packages/settings/src/abschnitte/datalink.ts`** (neue Datei)

```ts
// --- @jm/settings: DataLink (Spec 6.2, Regeln 7.1–7.3) ---
//
// Status aus gemessenen Werten: Ordner fehlt, Dateizahl, letzte Änderung. Eine unbekannte Dateizahl
// ist „unbekannt“, nie „0 Dateien“. Quellzeile und Hinweis (Titler Q1–Q3, H1–H7) sind fertige Texte
// der App und werden nur angezeigt; Titel, Feldnamen und Statustexte liegen hier.
import { formatUhrzeitKurz, zahlText } from '@jm/ui';
import { ABSCHNITT_TEXTE, fehlerStatus, hatFehler, st, STATUS_UNBEKANNT, type SectionBase, type SectionInput, type SectionStatus } from '../vertrag';

export interface DataLinkSectionProps extends SectionInput {
  folder: string;                    // '' = keiner
  folderMissing?: boolean;           // gemessen
  fileCount?: number;                // gemessen; undefined = unbekannt
  lastChange?: string;               // ISO
  sourceLine?: string;               // fertiger Text der App (Titler Q1–Q3), nur angezeigt
  notice?: string;                   // fertiger Hinweis der App (Titler H1–H7), nur angezeigt
  backLabel?: string; onBack?(): void;   // Titler K1; Knopf nur mit beidem
  onPickFolder?(): void;
}

const EINE_DATEI = '1 Datei';

export const DATALINK_TEXTE = {
  titel: 'DataLink',
  ordner: 'Ordner',
  status: 'Status',
  ordnerWaehlen: 'Ordner wählen …',
  eineDatei: EINE_DATEI,
  dateien: (n: number, hhmm?: string) => `${n === 1 ? EINE_DATEI : `${zahlText(n)} Dateien`}${hhmm ? ` · ${hhmm}` : ''}`,
  ordnerFehlt: 'Ordner fehlt',
  keinOrdner: 'kein Ordner',
  keineDatei: 'keine Datei',
  gesperrtVomMaster: ABSCHNITT_TEXTE.gesperrtVomMaster,
} as const;

export interface DataLinkView extends SectionBase {
  sichtbar: { ordnerWaehlen: boolean; status: boolean; zurueck: boolean };
  ordnerText: string;                // Pfad oder „kein Ordner“
}

function dataLinkStatus(p: DataLinkSectionProps): SectionStatus {
  if (hatFehler(p)) return fehlerStatus(p.error);
  if (p.folderMissing === true) return st('error', DATALINK_TEXTE.ordnerFehlt);
  if (p.folder === '') return st('off', DATALINK_TEXTE.keinOrdner);
  if (p.fileCount === undefined) return STATUS_UNBEKANNT;
  if (p.fileCount === 0) return st('warn', DATALINK_TEXTE.keineDatei);
  return st('ok', DATALINK_TEXTE.dateien(p.fileCount, formatUhrzeitKurz(p.lastChange)));
}

export function dataLinkView(p: DataLinkSectionProps): DataLinkView {
  const text = (t: string | undefined): boolean => typeof t === 'string' && t !== '';
  return {
    id: p.id,
    status: dataLinkStatus(p),
    locked: p.locked,
    error: p.error,
    sichtbar: {
      ordnerWaehlen: typeof p.onPickFolder === 'function',
      status: text(p.sourceLine) || text(p.notice),
      zurueck: text(p.backLabel) && typeof p.onBack === 'function',
    },
    ordnerText: p.folder === '' ? DATALINK_TEXTE.keinOrdner : p.folder,
  };
}
```

- [ ] **Step 6: Komponente `packages/settings/src/abschnitte/DataLinkSection.tsx`** (neue Datei)

```tsx
// --- @jm/settings: DataLinkSection (Spec 6.2) ---
import { Button } from '@jm/ui';
import { Anzeige, SectionFrame } from '../SectionFrame';
import { istGesperrt } from '../vertrag';
import { DATALINK_TEXTE, dataLinkView, type DataLinkSectionProps } from './datalink';

export function DataLinkSection(p: DataLinkSectionProps): React.JSX.Element {
  const view = dataLinkView(p);
  const gesperrt = istGesperrt(view);
  return (
    <SectionFrame view={view} titel={DATALINK_TEXTE.titel}>
      <Anzeige label={DATALINK_TEXTE.ordner}>{view.ordnerText}</Anzeige>
      {view.sichtbar.ordnerWaehlen ? (
        <Button type="button" variant="outline" size="sm" uppercase={false} className="motion-reduce:transition-none" onClick={() => p.onPickFolder?.()} disabled={gesperrt}>
          {DATALINK_TEXTE.ordnerWaehlen}
        </Button>
      ) : null}
      {view.sichtbar.status ? (
        <Anzeige label={DATALINK_TEXTE.status} hinweis={p.notice || undefined}>
          {p.sourceLine}
        </Anzeige>
      ) : null}
      {view.sichtbar.zurueck ? (
        <Button type="button" variant="ghost" size="sm" uppercase={false} className="motion-reduce:transition-none" onClick={() => p.onBack?.()} disabled={gesperrt}>
          {p.backLabel}
        </Button>
      ) : null}
    </SectionFrame>
  );
}
```

- [ ] **Step 7: Exporte** (`packages/settings/src/index.ts`), Vorher:

```ts
export { AudioDeviceSection } from './abschnitte/AudioDeviceSection';
```
Nachher:
```ts
export { AudioDeviceSection } from './abschnitte/AudioDeviceSection';
export { type IveoSectionProps, type IveoView, IVEO_TEXTE, iveoView } from './abschnitte/iveo';
export { IveoSection } from './abschnitte/IveoSection';
export { type DataLinkSectionProps, type DataLinkView, DATALINK_TEXTE, dataLinkView } from './abschnitte/datalink';
export { DataLinkSection } from './abschnitte/DataLinkSection';
```

- [ ] **Step 8: Tests laufen lassen (grün)**

```
npm run selftest -w @jm/settings
```
Erwartet (gemessen): 295 Zeilen `ok` (28 iveo, 24 DataLink), keine `FAIL`, `ALLE TESTS OK`. Neu unter anderem:
```
ok   iveo Kreuzprodukt: Eingang → status aus der Tabelle (72 Fälle)
ok   iveo Kreuzprodukt: ok nur mit gemessener Lieferung (72 Fälle)
ok   iveo: kein Eingabefeld (das Token bleibt im Launcher)
ok   iveo ohne Rückruf: kein Knopf (E15)
ok   DataLink Kreuzprodukt: Eingang → status aus den Tabellen (locked ändert den Status nicht) (192 Fälle)
ok   DataLink Kreuzprodukt: nie „0 Dateien“ (192 Fälle)
ok   DataLink: Zurück-Knopf nur mit backLabel UND onBack
ok   DataLink locked: alle Bedienelemente disabled (2 von 2)
```

- [ ] **Step 9: Typprüfung**

```
npm run typecheck -w @jm/settings
npm run typecheck -w @jm/ui
```
Erwartet (gemessen): beide ohne Meldung, Exitcode 0.

- [ ] **Step 10: Stagen und Mutationsprobe**

```
git add packages/settings/src/abschnitte/iveo.ts packages/settings/src/abschnitte/IveoSection.tsx packages/settings/src/abschnitte/datalink.ts packages/settings/src/abschnitte/DataLinkSection.tsx packages/settings/src/index.ts packages/settings/test/iveo.test.tsx packages/settings/test/datalink.test.tsx packages/settings/test/selftest.ts
```
Je Mutation allein, Selbsttest rot, `git checkout -- <pfad>`.

**M1 · iveo ohne Lieferung als verbunden** (`packages/settings/src/abschnitte/iveo.ts`). Vorher:
```ts
  return STATUS_UNBEKANNT;
}
```
Nachher:
```ts
  return st('ok', IVEO_TEXTE.verbunden);
}
```
Erwartet: `FAIL iveo Kreuzprodukt: Eingang → status aus der Tabelle (72 Fälle)`, `FAIL iveo Kreuzprodukt: ok nur mit gemessener Lieferung (72 Fälle)`.

**M2 · Zeit „seit“ fehlt** (`packages/settings/src/abschnitte/iveo.ts`). Vorher:
```ts
seit ? IVEO_TEXTE.frueherStandSeit(seit) : IVEO_TEXTE.frueherStand
```
Nachher:
```ts
IVEO_TEXTE.frueherStand
```
Erwartet: `FAIL iveo Kreuzprodukt: Eingang → status aus der Tabelle (72 Fälle)`.

**M3 · Event auch ohne Bindung** (`packages/settings/src/abschnitte/iveo.ts`). Vorher:
```ts
  const da = (t: string | undefined): boolean => p.bound && typeof t === 'string' && t !== '';
```
Nachher:
```ts
  const da = (t: string | undefined): boolean => typeof t === 'string' && t !== '';
```
Erwartet: `FAIL iveo ungebunden: keine Event-Angaben`.

**M4 · iveo-Knopf ohne Rückruf** (`packages/settings/src/abschnitte/iveo.ts`). Vorher:
```ts
      imLauncher: typeof p.onOpenLauncher === 'function',
```
Nachher:
```ts
      imLauncher: true,
```
Erwartet: `FAIL iveo ohne Rückruf: kein Knopf (E15)`.

**M5 · Unbekannte Dateizahl als „0 Dateien“** (`packages/settings/src/abschnitte/datalink.ts`). Vorher:
```ts
  if (p.fileCount === undefined) return STATUS_UNBEKANNT;
  if (p.fileCount === 0) return st('warn', DATALINK_TEXTE.keineDatei);
  return st('ok', DATALINK_TEXTE.dateien(p.fileCount, formatUhrzeitKurz(p.lastChange)));
```
Nachher:
```ts
  return st('ok', DATALINK_TEXTE.dateien(p.fileCount ?? 0, formatUhrzeitKurz(p.lastChange)));
```
Erwartet: `FAIL DataLink Kreuzprodukt: Eingang → status aus den Tabellen (…) (192 Fälle)`, `FAIL DataLink Kreuzprodukt: nie „0 Dateien“ (192 Fälle)`, `FAIL DataLink: abschnittStatusItem = Statuspille (Zustand und Text)`.

**M6 · „kein Ordner“ vor „Ordner fehlt“** (`packages/settings/src/abschnitte/datalink.ts`). Vorher:
```ts
  if (p.folderMissing === true) return st('error', DATALINK_TEXTE.ordnerFehlt);
  if (p.folder === '') return st('off', DATALINK_TEXTE.keinOrdner);
```
Nachher:
```ts
  if (p.folder === '') return st('off', DATALINK_TEXTE.keinOrdner);
  if (p.folderMissing === true) return st('error', DATALINK_TEXTE.ordnerFehlt);
```
Erwartet: `FAIL DataLink Kreuzprodukt: Eingang → status aus den Tabellen (locked ändert den Status nicht) (192 Fälle)`.

**M7 · Zurück-Knopf ohne Rückruf** (`packages/settings/src/abschnitte/datalink.ts`). Vorher:
```ts
      zurueck: text(p.backLabel) && typeof p.onBack === 'function',
```
Nachher:
```ts
      zurueck: text(p.backLabel),
```
Erwartet: `FAIL DataLink: Zurück-Knopf nur mit backLabel UND onBack`.

**M8 · Sperre erreicht den Zurück-Knopf nicht** (`packages/settings/src/abschnitte/DataLinkSection.tsx`). Vorher:
```tsx
onClick={() => p.onBack?.()} disabled={gesperrt}>
```
Nachher:
```tsx
onClick={() => p.onBack?.()}>
```
Erwartet: `FAIL DataLink locked: alle Bedienelemente disabled (1 von 2)`.

Danach `git status --short` (nur `A `/`M `) und wieder 295 × `ok`.

- [ ] **Step 11: Commit**

```
git add packages/settings/src/abschnitte/iveo.ts packages/settings/src/abschnitte/IveoSection.tsx packages/settings/src/abschnitte/datalink.ts packages/settings/src/abschnitte/DataLinkSection.tsx packages/settings/src/index.ts packages/settings/test/iveo.test.tsx packages/settings/test/datalink.test.tsx packages/settings/test/selftest.ts
git status --short
```
Erwartet genau:
```
A  packages/settings/src/abschnitte/DataLinkSection.tsx
A  packages/settings/src/abschnitte/IveoSection.tsx
A  packages/settings/src/abschnitte/datalink.ts
A  packages/settings/src/abschnitte/iveo.ts
M  packages/settings/src/index.ts
A  packages/settings/test/datalink.test.tsx
A  packages/settings/test/iveo.test.tsx
M  packages/settings/test/selftest.ts
```
```
git commit -m "feat(settings): IveoSection und DataLinkSection" -m "iveoView: ohne Bindung 'nicht eingerichtet', ohne gemessene Lieferung unbekannt, veraltet mit 'seit hh:mm', verbunden nur bei delivery ok. Kein Eingabe- und kein Token-Feld, Knopf 'Im Launcher einrichten' nur mit Rueckruf (Plan E15). dataLinkView: Ordner fehlt vor kein Ordner, unbekannte Dateizahl nie '0 Dateien', '{n} Dateien - hh:mm'. Quellzeile und Hinweis der App nur angezeigt, Zurueck-Knopf nur mit Text und Rueckruf. Kreuzprodukte 72 und 192 Faelle." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Kein Feld „Status“ im iveo-Abschnitt: Der Status steht in der Pille; ein zweites Feld mit demselben Text wäre doppelt.
  Der Text `IVEO_TEXTE.status` entfällt deshalb. Dafür gibt es „verbunden“ ohne Eventnamen.
- Kreuzprodukt iveo zusätzlich über `eventName` (72 statt 36 Fälle).
- `DATALINK_TEXTE.dateien(n, hhmm?)` ist eine Funktion für alle vier Formen („1 Datei“, „1 Datei · hh:mm“,
  „{n} Dateien“, „{n} Dateien · hh:mm“); `eineDatei` bleibt als Konstante.
- Zusatzfeld „Speaker“ im iveo-Abschnitt (Spec 6.2 nennt „Status (verbunden, Event, Bühne)“): Die Speakerzahl ist das, was
  die Tools heute von iveo zeigen (Rundown `state.iveoSpeakers`, Connect „Sprecher aus der Show“, Anhang A). Ohne die Zeile
  ginge diese Anzeige beim Umbau verloren (Spec 10; E24, Owner-Liste).
- `sourceLine`, `notice` und `backLabel` sind fertige Texte der App (Titler Q1–Q3, H1–H7, K1) und damit eine Ausnahme von
  Spec 6.1 („Texte fest im Paket“; E25, Owner-Liste). Gründe: Die Texte enthalten Laufzeitdaten (Ordner- und Personennamen,
  z. B. „„Ada“ ist nicht mehr in der Liste“), und Master-Link 2b R2 ändert gerade genau diese Texte im Titler
  (`lib/datalink-anzeige.ts`, Anhang A); eine Kopie in `@jm/settings` liefe sofort auseinander. Die Quellregel aus Task 16
  lässt in den Abschnitts-Props genau diese drei Text-Props zu (`AUSNAHMEN`); jede andere Prop, deren Name auf …label/…text
  endet, und jede `string`-Prop außerhalb der Daten-Liste macht sie rot (seit der zweiten Nachbesserung, E25). Übernimmt
  der Owner die Texte ins Paket, geschieht das im Titler-Pilot nach dem Merge von 2b R2.

**Nachgerechnet:** Gleiche Kopie, nach Task 20: Step 2 rot mit `… export named 'IVEO_TEXTE'`; Typprüfung ohne Meldung. Mutationsprobe M1–M8 je rot (2, 1, 1, 1, 3, 1, 1, 1 FAIL). Nach der Nachbesserung (Knöpfe mit `motion-reduce:transition-none`, je eine Zeile „Übergänge“) neu gemessen: Step 8 grün mit 289 × `ok`, Proben wie angegeben (2, 1, 1, 1, 3, 1, 1, 1 FAIL). Nach der zweiten Nachbesserung: 295 × `ok`, Proben gleich. Die Uhrzeit-Fälle nutzen eine ISO-Zeit aus Ortszeit 09:05 und sind damit von der Zeitzone unabhängig.

---

### Task 22: `PeersSection` (Gegenstellen, UO4)

**Spec:** 6.2 (Zeile `PeersSection`: „je Rolle: Host · Port · Quelle (gefunden/manuell) · verbunden“, Status „verbunden“,
„nicht gefunden“, „manuell: {host}:{port}“), UO4, 7.1–7.3. Plan: G5, G6.

**Arbeitsverzeichnis/Voraussetzung:** wie Task 16; Tasks 16–21 committet.

**Dateien:**
- Create: `packages/settings/src/abschnitte/peers.ts`, `packages/settings/src/abschnitte/PeersSection.tsx`,
  `packages/settings/test/peers.test.tsx`
- Modify: `packages/settings/src/index.ts` (zwei Zeilen am Ende), `packages/settings/test/selftest.ts` (eine Zeile)

**Interfaces:**
- Consumes: 9.9 wie Task 18; aus `@jm/ui`: `zahlText`, `type StatusState`, `Button`, `Field`, `NumberInput`,
  `StatusPill`, `TextInput` (mit `placeholder`), `Toggle`.
- Produces (Props, `PeerRow` wörtlich 9.10):
  ```ts
  // packages/settings/src/abschnitte/peers.ts
  export interface PeerRow {
    role: string; label: string; host: string; port: number; defaultPort?: number;
    connected?: boolean; source?: 'mdns' | 'manual'; enabled?: boolean;
  }
  export interface PeersSectionProps extends SectionInput {
    peers: PeerRow[]; capabilities: { auto?: boolean; toggle?: boolean };
    onSet?(role: string, host: string, port: number): void; onAuto?(role: string): void;
    onToggle?(role: string, enabled: boolean): void;
  }
  export const PEERS_TEXTE;   // titel 'Gegenstellen'; aktiv 'Aktiv'; host 'Host'; port 'Port'; quelle 'Quelle'; verbunden 'Verbunden';
                              // quelleGefunden 'gefunden'; quelleManuell(host, port) 'manuell: {host}:{port}';
                              // zeileVerbunden 'verbunden'; zeileNichtGefunden 'nicht gefunden';
                              // zeileManuellNichtVerbunden(host, port) 'manuell: {host}:{port} · nicht verbunden'; zeileAus 'aus';
                              // alleVerbunden 'verbunden'; kVonN(k, n) '{k} von {n} verbunden'; keineGegenstellen 'keine Gegenstellen';
                              // setzen 'Setzen'; auto 'Auto'; setzenFuer(label) 'Setzen: {label}'; autoFuer(label) 'Auto: {label}';
                              // platzhalterHost 'leer = automatisch';
                              // erklaerung 'Standard ist automatisch (mDNS). Für ein anderes Subnetz oder blockiertes mDNS Host
                              //   und Port setzen – das überschreibt den Fund. „Auto“ nimmt das wieder zurück.'
  export interface PeerZeileView { role: string; label: string; status: SectionStatus; aktiv: boolean; quelleText?: string }
  export interface PeersView extends SectionBase {
    sichtbar: { auto: boolean; schalter: boolean; erklaerung: boolean };
    zeilen: PeerZeileView[];
  }
  export function peerZeileStatus(r: PeerRow): SectionStatus;
  export function peersView(p: PeersSectionProps): PeersView;
  // packages/settings/src/abschnitte/PeersSection.tsx
  export function PeersSection(p: PeersSectionProps): React.JSX.Element;
  ```

**Verhalten (verbindlich):**
- Je Zeile, Vorrang von oben: `enabled === false` → off „aus“; `connected === undefined` → `unbekannt`; `connected` → ok
  „verbunden“; nicht verbunden mit `source === 'manual'` und Host → warn „manuell: {host}:{port} · nicht verbunden“;
  sonst warn „nicht gefunden“.
- Abschnitt: `error` → error; keine aktive Zeile (`enabled !== false`) → off „keine Gegenstellen“; eine aktive Zeile mit
  Warnung → warn „{k} von {n} verbunden“ (k = verbundene, n = aktive Zeilen; unbekannte zählen in n); sonst eine
  unbekannte → `unbekannt`; sonst ok „verbunden“. Ausgeschaltete Zeilen zählen nie mit.
- Darstellung je Zeile: Name der Gegenstelle · Schalter „Aktiv“ (nur `capabilities.toggle`, Stage-Display-Muster) · Host
  (`TextInput`, Platzhalter „leer = automatisch“ nur mit `capabilities.auto`) · Port (`NumberInput` ganzzahlig 1–65535;
  `port` 0 zeigt `defaultPort`) · Quelle („gefunden“/„manuell: {host}:{port}“, nur mit `source`) · Verbunden
  (Statuspille der Zeile) · Knöpfe „Setzen“ (nur mit `onSet`, übergibt Host und Port der Felder) und „Auto“ (nur mit
  `capabilities.auto` **und** `onAuto`). Die Erklärung steht nur mit `capabilities.auto` über den Zeilen.
- `locked` sperrt alle Felder und Knöpfe aller Zeilen.
- Barrierefreiheit (WCAG 1.3.1, 2.4.6): Jede Zeile ist `role="group"` mit `aria-labelledby` auf den Namen der Gegenstelle
  (id per `useId`), die Knöpfe heißen für den Screenreader „Setzen: {Name}“ bzw. „Auto: {Name}“. Sonst läse ein Screenreader
  dreimal „Host, Eingabefeld“ ohne zu sagen, zu welcher Gegenstelle es gehört. Knöpfe tragen `motion-reduce:transition-none`.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (neue Datei `packages/settings/test/peers.test.tsx`)

```tsx
// PeersSection „Gegenstellen“ (Spec 6.2, UO4, 7): unbekannt ist nicht „nicht gefunden“, Aus zählt nicht mit.
import { enthaelt, enthaeltNicht, gleich, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import {
  abschnittStatusItem,
  PEERS_TEXTE,
  PeersSection,
  peersView,
  peerZeileStatus,
  type PeerRow,
  type PeersSectionProps,
  type SectionStatus,
} from '../src/index';
import { bewegungsVerstoesse, kreuz, nachLetztem, pruefeFaelle, sperrZaehlung, statusText, vergleiche, vor } from './hilfe';

const s = (state: SectionStatus['state'], text: string): SectionStatus => ({ state, text });
const U = s('off', 'unbekannt');
const AUS = s('off', 'aus');
const VERB = s('ok', 'verbunden');
const NG = s('warn', 'nicht gefunden');
const MAN = s('warn', 'manuell: 10.0.0.5:7777 · nicht verbunden');
const KEINE = s('off', 'keine Gegenstellen');
const FEHLER = s('error', 'Fehler: Testfehler');

const zeile = (r: Partial<PeerRow>): PeerRow => ({ role: 'timer', label: 'JM Timer', host: '', port: 7777, ...r });
const basis: PeersSectionProps = { id: 'gegenstellen', peers: [], capabilities: {} };

// Tabelle je Zeile: Zeile = enabled|connected; Spalten = source|host in der Folge
// (mdns, ''), (mdns, gesetzt), (manual, ''), (manual, gesetzt), (undefined, ''), (undefined, gesetzt).
const ZEILE: Record<string, SectionStatus[]> = {
  'undefined|undefined': [U, U, U, U, U, U],
  'undefined|false': [NG, NG, NG, MAN, NG, NG],
  'undefined|true': [VERB, VERB, VERB, VERB, VERB, VERB],
  'true|undefined': [U, U, U, U, U, U],
  'true|false': [NG, NG, NG, MAN, NG, NG],
  'true|true': [VERB, VERB, VERB, VERB, VERB, VERB],
  'false|undefined': [AUS, AUS, AUS, AUS, AUS, AUS],
  'false|false': [AUS, AUS, AUS, AUS, AUS, AUS],
  'false|true': [AUS, AUS, AUS, AUS, AUS, AUS],
};
const QUELLE = { mdns: 0, manual: 2, undefined: 4 };
// Abschnitt mit genau dieser einen Zeile: Zeilen-Status → Abschnitts-Status.
const EINE: Record<string, SectionStatus> = {
  [statusText(U)]: U,
  [statusText(AUS)]: KEINE,
  [statusText(VERB)]: VERB,
  [statusText(NG)]: s('warn', '0 von 1 verbunden'),
  [statusText(MAN)]: s('warn', '0 von 1 verbunden'),
};

{
  const faelle = kreuz({
    enabled: [undefined, true, false],
    connected: [undefined, false, true],
    source: ['mdns', 'manual', undefined],
    host: ['', '10.0.0.5'],
    error: [undefined, 'Testfehler'],
  } as const);
  const row = (f: (typeof faelle)[number]): PeerRow => zeile({ enabled: f.enabled, connected: f.connected, source: f.source, host: f.host });
  const sollZeile = (f: (typeof faelle)[number]): SectionStatus => ZEILE[`${f.enabled}|${f.connected}`][QUELLE[`${f.source}`] + (f.host ? 1 : 0)];
  pruefeFaelle('Gegenstellen Kreuzprodukt je Zeile: Eingang → status aus der Tabelle', faelle, (f) =>
    vergleiche(statusText(peerZeileStatus(row(f))), statusText(sollZeile(f))),
  );
  pruefeFaelle('Gegenstellen Kreuzprodukt eine Zeile: Abschnitt aus der Tabelle, error schlägt alles', faelle, (f) => {
    const soll = f.error ? FEHLER : EINE[statusText(sollZeile(f))];
    return vergleiche(statusText(peersView({ ...basis, error: f.error, peers: [row(f)] }).status), statusText(soll));
  });
}
{
  // Drei Zeilen, je Zeile aus, unbekannt, verbunden oder Warnung (4³ = 64 Fälle). Erwartung hängt nur von der
  // Anzahl je Art ab: Schlüssel = aus·unbekannt·verbunden·warn.
  const ART: Record<string, Partial<PeerRow>> = {
    aus: { enabled: false, connected: true },
    unbekannt: { connected: undefined },
    verbunden: { connected: true },
    warn: { connected: false, source: 'mdns' },
  };
  const DREI: Record<string, string> = {
    '3000': 'off keine Gegenstellen', '2100': 'off unbekannt', '2010': 'ok verbunden', '2001': 'warn 0 von 1 verbunden',
    '1200': 'off unbekannt', '1110': 'off unbekannt', '1101': 'warn 0 von 2 verbunden', '1020': 'ok verbunden',
    '1011': 'warn 1 von 2 verbunden', '1002': 'warn 0 von 2 verbunden', '0300': 'off unbekannt', '0210': 'off unbekannt',
    '0201': 'warn 0 von 3 verbunden', '0120': 'off unbekannt', '0111': 'warn 1 von 3 verbunden', '0102': 'warn 0 von 3 verbunden',
    '0030': 'ok verbunden', '0021': 'warn 2 von 3 verbunden', '0012': 'warn 1 von 3 verbunden', '0003': 'warn 0 von 3 verbunden',
  };
  const ARTEN = ['aus', 'unbekannt', 'verbunden', 'warn'] as const;
  const faelle = kreuz({ a: ARTEN, b: ARTEN, c: ARTEN } as const);
  pruefeFaelle('Gegenstellen Kreuzprodukt drei Zeilen: Abschnitt aus der Tabelle, Aus zählt nicht mit', faelle, (f) => {
    const arten = [f.a, f.b, f.c];
    const schluessel = ARTEN.map((a) => arten.filter((x) => x === a).length).join('');
    const peers = arten.map((a, i) => zeile({ role: `r${i}`, ...ART[a] }));
    return vergleiche(statusText(peersView({ ...basis, peers }).status), DREI[schluessel]);
  });
  gleich(peersView(basis).status, KEINE, 'Gegenstellen ohne Zeilen: „keine Gegenstellen“');
}

// ── Darstellung ──
const rundown: PeersSectionProps = {
  ...basis,
  peers: [
    zeile({ connected: true, source: 'mdns' }),
    zeile({ role: 'titler', label: 'JM Titler', host: '10.0.0.5', port: 7777, connected: false, source: 'manual' }),
    zeile({ role: 'switcher', label: 'JM Switcher', port: 0, defaultPort: 8729, connected: undefined, source: 'mdns' }),
  ],
  capabilities: { auto: true },
  onSet: () => {},
  onAuto: () => {},
};
{
  const html = render(<PeersSection {...rundown} />);
  for (const t of ['>Gegenstellen<', '>JM Timer<', '>JM Titler<', '>JM Switcher<', PEERS_TEXTE.erklaerung, 'placeholder="leer = automatisch"', '>gefunden<', '>manuell: 10.0.0.5:7777<']) {
    enthaelt(html, t, `Gegenstellen Rundown-Muster: ${t}`);
  }
  ok((html.match(/>Setzen<\/button>/g) ?? []).length === 3 && (html.match(/>Auto<\/button>/g) ?? []).length === 3, 'Gegenstellen: je Zeile „Setzen“ und „Auto“');
  ok((html.match(/>Host</g) ?? []).length === 3 && (html.match(/>Port</g) ?? []).length === 3 && (html.match(/>Verbunden</g) ?? []).length === 3, 'Gegenstellen: je Zeile Host, Port, Verbunden');
  enthaelt(html, 'value="10.0.0.5"', 'Gegenstellen: manueller Host im Feld');
  enthaelt(html, 'value="8729"', 'Gegenstellen: Port 0 zeigt den Standardport');
  enthaelt(html, '>1 von 3 verbunden</span>', 'Gegenstellen: Abschnitt „1 von 3 verbunden“ (Warnung schlägt unbekannt, unbekannt zählt in n)');
  ok(vor(html, '>Host<', '>Port<') && vor(html, '>Port<', '>Quelle<') && vor(html, '>Quelle<', '>Verbunden<'), 'Gegenstellen: Felder je Zeile in fester Reihenfolge');
  pruefeIdVerweise(html, 'Gegenstellen: alle id-Verweise gültig (mehrere Zeilen, eindeutige ids)');
  enthaeltNicht(html, 'role="switch"', 'Gegenstellen ohne toggle: kein Schalter');
  const gruppen = [...html.matchAll(/<div role="group" aria-labelledby="([^"]+)"/g)].map((m) => m[1]);
  const namen = gruppen.map((id) => new RegExp(`id="${id}"[^>]*>([^<]*)<`).exec(html)?.[1]);
  gleich(namen, ['JM Timer', 'JM Titler', 'JM Switcher'], 'Gegenstellen: jede Zeile ist eine benannte Gruppe (role="group", aria-labelledby auf den Namen)');
  ok(
    html.includes('aria-label="Setzen: JM Titler"') && html.includes('aria-label="Auto: JM Switcher"'),
    'Gegenstellen: Knöpfe nennen ihre Gegenstelle („Setzen: JM Titler“, „Auto: JM Switcher“)',
  );
  gleich(bewegungsVerstoesse(html), [], 'Gegenstellen: Übergänge nur motion-safe oder mit motion-reduce:transition-none (G8)');
}
{
  const stage: PeersSectionProps = {
    ...basis,
    peers: [
      zeile({ host: '10.0.0.7', connected: true, enabled: true }),
      zeile({ role: 'presenter', label: 'Presenter', host: '10.0.0.8', port: 7790, connected: undefined, enabled: false }),
    ],
    capabilities: { toggle: true },
    onSet: () => {},
    onToggle: () => {},
  };
  const html = render(<PeersSection {...stage} />);
  ok((html.match(/role="switch"/g) ?? []).length === 2, 'Gegenstellen Stage-Muster: je Zeile ein Schalter');
  enthaeltNicht(html, '>Auto</button>', 'Gegenstellen Stage-Muster: kein „Auto“ (ausgeblendet, nicht ausgegraut)');
  enthaeltNicht(html, 'mDNS', 'Gegenstellen Stage-Muster: keine Erklärung zu Auto');
  enthaeltNicht(html, 'placeholder=', 'Gegenstellen Stage-Muster: kein Platzhalter „leer = automatisch“');
  enthaeltNicht(html, '>Quelle<', 'Gegenstellen Stage-Muster: ohne source keine Quelle');
  enthaelt(html, '>verbunden</span>', 'Gegenstellen Stage-Muster: ausgeschaltete Zeile zählt nicht, Abschnitt „verbunden“');
}
{
  const html = render(<PeersSection {...rundown} onSet={undefined} onAuto={undefined} />);
  enthaeltNicht(html, '</button>', 'Gegenstellen ohne Rückrufe: keine Knöpfe');
}
{
  const html = render(<PeersSection {...rundown} locked="Vom Master vorgegeben" />);
  const z = sperrZaehlung(html);
  ok(z.alle === 12 && z.gesperrt === 12, `Gegenstellen locked: alle Bedienelemente disabled (${z.gesperrt} von ${z.alle})`);
  ok(vor(html, 'Gesperrt: Vom Master vorgegeben', '>JM Timer<'), 'Gegenstellen locked: Grund vor den Feldern');
}
{
  const html = render(<PeersSection {...rundown} error="mDNS-Suche abgebrochen" />);
  ok(nachLetztem(html, 'data-fehler="true"', 'data-rolle='), 'Gegenstellen error: Fehlertext nach allen Zeilen');
}
{
  const item = abschnittStatusItem(peersView(rundown), { group: 'verbindung', label: 'Gegenstellen' });
  const html = render(<PeersSection {...rundown} />);
  ok(item.state === 'warn' && html.includes(`>${item.detail}</span>`), 'Gegenstellen: abschnittStatusItem = Statuspille (Zustand und Text)');
}
```

In `packages/settings/test/selftest.ts`, Vorher:
```ts
abschluss();
```
Nachher:
```ts
import './peers.test';
abschluss();
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/settings
```
Erwartet (gemessen), Exitcode 1:
```
SyntaxError: The requested module '../src/index' does not provide an export named 'PEERS_TEXTE'
```

- [ ] **Step 3: Ableitung `packages/settings/src/abschnitte/peers.ts`** (neue Datei)

```ts
// --- @jm/settings: Gegenstellen (Spec 6.2, UO4, Regeln 7.1–7.3) ---
//
// Je Rolle Host, Port, Quelle (gefunden/manuell) und Verbindung. Standard ist automatisch (mDNS),
// ein gesetzter Host überschreibt den Fund, „Auto“ nimmt das zurück (Rundown, Q&A, Battle). Stage-
// Display kennt kein Auto, sondern Ein/Aus je Quelle (`enabled`, ohne `source`). Eine unbekannte
// Verbindung ist „unbekannt“, nie „nicht gefunden“; ausgeschaltete Zeilen zählen nicht mit.
import { zahlText, type StatusState } from '@jm/ui';
import { ABSCHNITT_TEXTE, fehlerStatus, hatFehler, st, STATUS_UNBEKANNT, type SectionBase, type SectionInput, type SectionStatus } from '../vertrag';

export interface PeerRow {
  role: string; label: string;
  host: string;                      // '' = automatisch (mDNS)
  port: number; defaultPort?: number;
  connected?: boolean;               // gemessen; undefined = unbekannt
  source?: 'mdns' | 'manual';        // undefined = Modell ohne Auto (Stage-Display)
  enabled?: boolean;                 // nur mit capabilities.toggle
}

export interface PeersSectionProps extends SectionInput {
  peers: PeerRow[];
  capabilities: { auto?: boolean; toggle?: boolean };
  onSet?(role: string, host: string, port: number): void; onAuto?(role: string): void;
  onToggle?(role: string, enabled: boolean): void;
}

export const PEERS_TEXTE = {
  titel: 'Gegenstellen',
  aktiv: 'Aktiv',
  host: 'Host',
  port: 'Port',
  quelle: 'Quelle',
  verbunden: 'Verbunden',
  quelleGefunden: 'gefunden',
  quelleManuell: (host: string, port: number) => `manuell: ${host}:${zahlText(port)}`,
  zeileVerbunden: 'verbunden',
  zeileNichtGefunden: 'nicht gefunden',
  zeileManuellNichtVerbunden: (host: string, port: number) => `manuell: ${host}:${zahlText(port)} · nicht verbunden`,
  zeileAus: ABSCHNITT_TEXTE.aus,
  alleVerbunden: 'verbunden',
  kVonN: (k: number, n: number) => `${zahlText(k)} von ${zahlText(n)} verbunden`,
  keineGegenstellen: 'keine Gegenstellen',
  setzen: 'Setzen',
  auto: 'Auto',
  setzenFuer: (label: string) => `Setzen: ${label}`,
  autoFuer: (label: string) => `Auto: ${label}`,
  platzhalterHost: 'leer = automatisch',
  erklaerung:
    'Standard ist automatisch (mDNS). Für ein anderes Subnetz oder blockiertes mDNS Host und Port setzen – das überschreibt den Fund. „Auto“ nimmt das wieder zurück.',
} as const;

export interface PeerZeileView {
  role: string;
  label: string;
  status: SectionStatus;
  aktiv: boolean;                    // enabled !== false
  quelleText?: string;               // „gefunden“ bzw. „manuell: {host}:{port}“; ohne source keins
}

export interface PeersView extends SectionBase {
  sichtbar: { auto: boolean; schalter: boolean; erklaerung: boolean };
  zeilen: PeerZeileView[];
}

export function peerZeileStatus(r: PeerRow): SectionStatus {
  if (r.enabled === false) return st('off', PEERS_TEXTE.zeileAus);
  if (r.connected === undefined) return STATUS_UNBEKANNT;
  if (r.connected) return st('ok', PEERS_TEXTE.zeileVerbunden);
  if (r.source === 'manual' && r.host !== '') return st('warn', PEERS_TEXTE.zeileManuellNichtVerbunden(r.host, r.port));
  return st('warn', PEERS_TEXTE.zeileNichtGefunden);
}

function zeileView(r: PeerRow): PeerZeileView {
  return {
    role: r.role,
    label: r.label,
    status: peerZeileStatus(r),
    aktiv: r.enabled !== false,
    quelleText:
      r.source === 'mdns' ? PEERS_TEXTE.quelleGefunden : r.source === 'manual' ? PEERS_TEXTE.quelleManuell(r.host, r.port) : undefined,
  };
}

function peersStatus(p: PeersSectionProps, zeilen: readonly PeerZeileView[]): SectionStatus {
  if (hatFehler(p)) return fehlerStatus(p.error);
  const aktive = zeilen.filter((z) => z.aktiv);
  if (aktive.length === 0) return st('off', PEERS_TEXTE.keineGegenstellen);
  const hat = (state: StatusState): boolean => aktive.some((z) => z.status.state === state);
  if (hat('warn')) return st('warn', PEERS_TEXTE.kVonN(aktive.filter((z) => z.status.state === 'ok').length, aktive.length));
  if (hat('off')) return STATUS_UNBEKANNT;
  return st('ok', PEERS_TEXTE.alleVerbunden);
}

export function peersView(p: PeersSectionProps): PeersView {
  const zeilen = p.peers.map(zeileView);
  const auto = p.capabilities.auto === true;
  return {
    id: p.id,
    status: peersStatus(p, zeilen),
    locked: p.locked,
    error: p.error,
    sichtbar: { auto: auto && typeof p.onAuto === 'function', schalter: p.capabilities.toggle === true, erklaerung: auto },
    zeilen,
  };
}
```

- [ ] **Step 4: Komponente `packages/settings/src/abschnitte/PeersSection.tsx`** (neue Datei)

```tsx
// --- @jm/settings: PeersSection „Gegenstellen“ (Spec 6.2, UO4) ---
import { Button, Field, NumberInput, StatusPill, TextInput, Toggle } from '@jm/ui';
import { useEffect, useId, useState } from 'react';
import { Anzeige, SectionFrame } from '../SectionFrame';
import { istGesperrt } from '../vertrag';
import { PEERS_TEXTE, peersView, type PeerRow, type PeersSectionProps, type PeersView, type PeerZeileView } from './peers';

interface ZeileProps {
  row: PeerRow;
  zeile: PeerZeileView;
  p: PeersSectionProps;
  sichtbar: PeersView['sichtbar'];
  gesperrt: boolean;
}

function startPort(row: PeerRow): number | null {
  return row.port > 0 ? row.port : (row.defaultPort ?? null);
}

function PeerZeile({ row, zeile, p, sichtbar, gesperrt }: ZeileProps): React.JSX.Element {
  const [host, setHost] = useState(row.host);
  const [port, setPort] = useState<number | null>(startPort(row));
  useEffect(() => setHost(row.host), [row.host]);
  useEffect(() => setPort(startPort(row)), [row.port, row.defaultPort]);
  const nameId = useId();
  const sperre = gesperrt ? true : undefined;
  return (
    <div role="group" aria-labelledby={nameId} data-rolle={row.role} className="space-y-2 rounded-[var(--radius-lg)] border border-[var(--border)] p-3">
      <p id={nameId} className="text-sm font-semibold text-[var(--foreground)]">
        {row.label}
      </p>
      {sichtbar.schalter ? (
        <Field label={PEERS_TEXTE.aktiv}>
          <Toggle checked={zeile.aktiv} onChange={(n) => p.onToggle?.(row.role, n)} disabled={sperre} />
        </Field>
      ) : null}
      <Field label={PEERS_TEXTE.host}>
        <TextInput value={host} onChange={setHost} placeholder={sichtbar.auto ? PEERS_TEXTE.platzhalterHost : undefined} disabled={sperre} />
      </Field>
      <Field label={PEERS_TEXTE.port}>
        <NumberInput value={port} ganzzahl min={1} max={65535} onChange={setPort} disabled={sperre} />
      </Field>
      {zeile.quelleText ? <Anzeige label={PEERS_TEXTE.quelle}>{zeile.quelleText}</Anzeige> : null}
      <Anzeige label={PEERS_TEXTE.verbunden}>
        <StatusPill state={zeile.status.state} text={zeile.status.text} />
      </Anzeige>
      {p.onSet || sichtbar.auto ? (
        <div className="flex items-center gap-2">
          {p.onSet ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              uppercase={false}
              className="motion-reduce:transition-none"
              aria-label={PEERS_TEXTE.setzenFuer(row.label)}
              onClick={() => p.onSet?.(row.role, host.trim(), port ?? row.port)}
              disabled={gesperrt}
            >
              {PEERS_TEXTE.setzen}
            </Button>
          ) : null}
          {sichtbar.auto ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              uppercase={false}
              className="motion-reduce:transition-none"
              aria-label={PEERS_TEXTE.autoFuer(row.label)}
              onClick={() => p.onAuto?.(row.role)}
              disabled={gesperrt}
            >
              {PEERS_TEXTE.auto}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PeersSection(p: PeersSectionProps): React.JSX.Element {
  const view = peersView(p);
  const gesperrt = istGesperrt(view);
  return (
    <SectionFrame view={view} titel={PEERS_TEXTE.titel}>
      {view.sichtbar.erklaerung ? <p className="text-[11px] text-[var(--muted-foreground)]">{PEERS_TEXTE.erklaerung}</p> : null}
      {p.peers.map((row, i) => (
        <PeerZeile key={row.role} row={row} zeile={view.zeilen[i]} p={p} sichtbar={view.sichtbar} gesperrt={gesperrt} />
      ))}
    </SectionFrame>
  );
}
```

- [ ] **Step 5: Exporte** (`packages/settings/src/index.ts`), Vorher:

```ts
export { DataLinkSection } from './abschnitte/DataLinkSection';
```
Nachher:
```ts
export { DataLinkSection } from './abschnitte/DataLinkSection';
export { type PeerRow, type PeersSectionProps, type PeersView, type PeerZeileView, PEERS_TEXTE, peersView, peerZeileStatus } from './abschnitte/peers';
export { PeersSection } from './abschnitte/PeersSection';
```

- [ ] **Step 6: Test laufen lassen (grün)**

```
npm run selftest -w @jm/settings
```
Erwartet (gemessen): 329 Zeilen `ok` (34 neu), keine `FAIL`, `ALLE TESTS OK`, Exitcode 0. Neu unter anderem:
```
ok   Gegenstellen Kreuzprodukt je Zeile: Eingang → status aus der Tabelle (108 Fälle)
ok   Gegenstellen Kreuzprodukt eine Zeile: Abschnitt aus der Tabelle, error schlägt alles (108 Fälle)
ok   Gegenstellen Kreuzprodukt drei Zeilen: Abschnitt aus der Tabelle, Aus zählt nicht mit (64 Fälle)
ok   Gegenstellen: Abschnitt „1 von 3 verbunden“ (Warnung schlägt unbekannt, unbekannt zählt in n)
ok   Gegenstellen Stage-Muster: kein „Auto“ (ausgeblendet, nicht ausgegraut)
ok   Gegenstellen locked: alle Bedienelemente disabled (12 von 12)
ok   Gegenstellen: jede Zeile ist eine benannte Gruppe (role="group", aria-labelledby auf den Namen)
```
Außerdem `Quellregel settings: Dateiliste gelesen (18 Dateien)` – die Quellregeln aus Task 16 prüfen jetzt alle 18
Dateien unter `packages/settings/src`.

- [ ] **Step 7: Typprüfung**

```
npm run typecheck -w @jm/settings
npm run typecheck -w @jm/ui
```
Erwartet (gemessen): beide ohne Meldung, Exitcode 0.

- [ ] **Step 8: Stagen und Mutationsprobe**

```
git add packages/settings/src/abschnitte/peers.ts packages/settings/src/abschnitte/PeersSection.tsx packages/settings/src/index.ts packages/settings/test/peers.test.tsx packages/settings/test/selftest.ts
```
Je Mutation allein, Selbsttest rot, `git checkout -- <pfad>`.

**M1 · Unbekannte Verbindung als „nicht gefunden“** (`packages/settings/src/abschnitte/peers.ts`). Vorher:
```ts
  if (r.connected === undefined) return STATUS_UNBEKANNT;
  if (r.connected) return st('ok', PEERS_TEXTE.zeileVerbunden);
```
Nachher:
```ts
  if (r.connected) return st('ok', PEERS_TEXTE.zeileVerbunden);
```
Erwartet: `FAIL Gegenstellen Kreuzprodukt je Zeile: …`, `FAIL Gegenstellen Kreuzprodukt eine Zeile: …`, `FAIL Gegenstellen Kreuzprodukt drei Zeilen: …`.

**M2 · Ausgeschaltete Zeile zählt in „{k} von {n}“** (`packages/settings/src/abschnitte/peers.ts`). Vorher:
```ts
  const aktive = zeilen.filter((z) => z.aktiv);
```
Nachher:
```ts
  const aktive = zeilen.filter((z) => z.aktiv || z.status.state === 'off');
```
Erwartet: `FAIL Gegenstellen Kreuzprodukt eine Zeile: …`, `FAIL Gegenstellen Kreuzprodukt drei Zeilen: Abschnitt aus der Tabelle, Aus zählt nicht mit (64 Fälle)`.

**M3 · „unbekannt“ schlägt die Warnung** (`packages/settings/src/abschnitte/peers.ts`). Vorher:
```ts
  if (hat('warn')) return st('warn', PEERS_TEXTE.kVonN(aktive.filter((z) => z.status.state === 'ok').length, aktive.length));
  if (hat('off')) return STATUS_UNBEKANNT;
```
Nachher:
```ts
  if (hat('off')) return STATUS_UNBEKANNT;
  if (hat('warn')) return st('warn', PEERS_TEXTE.kVonN(aktive.filter((z) => z.status.state === 'ok').length, aktive.length));
```
Erwartet: `FAIL Gegenstellen Kreuzprodukt drei Zeilen: …`, `FAIL Gegenstellen: Abschnitt „1 von 3 verbunden“ (…)`, `FAIL Gegenstellen: abschnittStatusItem = Statuspille (Zustand und Text)`.

**M4 · „manuell“ ohne Host** (`packages/settings/src/abschnitte/peers.ts`). Vorher:
```ts
  if (r.source === 'manual' && r.host !== '') return
```
Nachher:
```ts
  if (r.source === 'manual') return
```
Erwartet: `FAIL Gegenstellen Kreuzprodukt je Zeile: Eingang → status aus der Tabelle (108 Fälle)`.

**M5 · „Auto“ ohne Capability** (`packages/settings/src/abschnitte/peers.ts`). Vorher:
```ts
auto: auto && typeof p.onAuto === 'function',
```
Nachher:
```ts
auto: true,
```
Erwartet: `FAIL Gegenstellen Stage-Muster: kein „Auto“ (…)`, `FAIL Gegenstellen Stage-Muster: kein Platzhalter „leer = automatisch“`, `FAIL Gegenstellen ohne Rückrufe: keine Knöpfe`.

**M6 · Sperre erreicht den Port nicht** (`packages/settings/src/abschnitte/PeersSection.tsx`). Vorher:
```tsx
onChange={setPort} disabled={sperre} />
```
Nachher:
```tsx
onChange={setPort} />
```
Erwartet: `FAIL Gegenstellen locked: alle Bedienelemente disabled (9 von 12)`.

**M7 · Quellregel greift auch in den Abschnitten** (`packages/settings/src/abschnitte/PeersSection.tsx`, rohe Farbklasse). Vorher:
```tsx
border border-[var(--border)] p-3
```
Nachher:
```tsx
border border-red-500 p-3
```
Erwartet: `FAIL Quellregel settings: keine rohen Farbklassen`.

**M8 · Zeile ohne Namen für den Screenreader** (`packages/settings/src/abschnitte/PeersSection.tsx`). Vorher:
```tsx
    <div role="group" aria-labelledby={nameId} data-rolle={row.role}
```
Nachher:
```tsx
    <div data-rolle={row.role}
```
Erwartet: `FAIL Gegenstellen: jede Zeile ist eine benannte Gruppe (role="group", aria-labelledby auf den Namen)`. Detail: `ist: [] soll: ["JM Timer","JM Titler","JM Switcher"]`.

Danach `git status --short` (nur `A `/`M `) und wieder 329 × `ok`.

- [ ] **Step 9: Commit**

```
git add packages/settings/src/abschnitte/peers.ts packages/settings/src/abschnitte/PeersSection.tsx packages/settings/src/index.ts packages/settings/test/peers.test.tsx packages/settings/test/selftest.ts
git status --short
```
Erwartet genau:
```
A  packages/settings/src/abschnitte/PeersSection.tsx
A  packages/settings/src/abschnitte/peers.ts
M  packages/settings/src/index.ts
A  packages/settings/test/peers.test.tsx
M  packages/settings/test/selftest.ts
```
```
git commit -m "feat(settings): PeersSection - Gegenstellen mit Auto und manuellem Host" -m "peersView (UO4): je Rolle unbekannt statt 'nicht gefunden', solange nichts gemessen ist, 'manuell: host:port - nicht verbunden' nur mit gesetztem Host, ausgeschaltete Zeilen (Stage-Display) zaehlen nie mit. Abschnitt '{k} von {n} verbunden' bei einer Warnung, sonst unbekannt bzw. verbunden. Host, Port, Quelle, Verbunden je Zeile, Setzen und Auto nur mit Rueckruf bzw. capability, Schalter nur mit capabilities.toggle. Kreuzprodukt 108 Faelle je Zeile, 64 fuer drei Zeilen." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Text `aktiv` „Aktiv“ zusätzlich (Beschriftung des Ein/Aus-Schalters im Stage-Display-Muster; das Gerüst nennt keinen).
- „manuell: {host}:{port} · nicht verbunden“ nur, wenn ein Host gesetzt ist; `source === 'manual'` mit leerem Host gilt
  als „nicht gefunden“ (sonst stünde „manuell: :7777“).
- Kreuzprodukt je Zeile zusätzlich über `error` (108 statt 54 Fälle, für den Abschnitt mit einer Zeile); drei Zeilen als
  4³ = 64 Fälle mit einer Tabelle über die Anzahl je Art (20 Einträge).
- `peerZeileStatus` und `PeerZeileView` sind zusätzlich exportiert (Galerie und Test).
- Zusatzfelder gegenüber der Feldliste von Spec 6.2 („Host · Port · Quelle · verbunden“), je aus Anhang A: Schalter „Aktiv“
  (Stage-Display „Quellen (an/aus, Host, Port je Timer/Switcher/Presenter)“), Knöpfe „Setzen“ und „Auto“ sowie die Erklärung
  (Battle, Q&A, Rundown: `ConnectionsPanel.tsx`, „Gegenstellen-Overrides (Host/Port je Rolle)“ mit Rückkehr zu mDNS). Ohne
  sie ginge beim Umbau Funktion verloren (Spec 10; E24, Owner-Liste).
- Nachbesserung nach dem Review: Zeilen als benannte Gruppen, Knöpfe mit „Setzen: {Name}“/„Auto: {Name}“ (WCAG 1.3.1,
  2.4.6; Texte `setzenFuer`/`autoFuer` in `PEERS_TEXTE`), `motion-reduce:transition-none` an den Knöpfen.

**Nachgerechnet:** Gleiche Kopie, nach Task 21: Step 2 rot mit `… export named 'PEERS_TEXTE'`; `Quellregel settings: Dateiliste gelesen (18 Dateien)`; Typprüfung ohne Meldung. Nach der Nachbesserung neu gemessen: Step 6 grün mit 323 × `ok`, Mutationsprobe M1–M8 je rot (3, 2, 3, 1, 3, 1, 1, 1 FAIL). Nach der zweiten Nachbesserung: 329 × `ok`, Proben gleich. Endstand der Kopie: `packages/settings/src` byte-gleich mit dem Plantext.

---

## Block D · Galerie, CI und Gesamtprüfung, Doku

### Task 23: Galerie (Vite, ohne Electron) und Klassen-Probe

**Spec:** 3.10 (Galerie: jeder Baustein in jedem Zustand, beide Modi, ohne Electron, `npm run galerie -w @jm/ui`), 8 (Dunkel
und Hell), 3.1 und 3.3 (Schmal-Ansicht unter 900 px), 11 (Render-Tests ohne Browser), 4.1 (rein additiv). Entscheidungen E7,
E20, E21; Global Constraints G3, G9, G11, G12, G14. Review Focus 1.

**Arbeitsverzeichnis/Voraussetzung:** Plan-Worktree, Repo-Wurzel. Tasks 1–22 sind committet: `npm run selftest -w @jm/ui`
und `npm run selftest -w @jm/settings` enden mit `ALLE TESTS OK`, `npm run typecheck -w @jm/ui` und `-w @jm/settings` sind
grün. Befehle im Bash-Werkzeug (Git Bash); PowerShell nur, wo es dasteht. Zeilenangaben gelten für den Stand nach Task 22,
maßgeblich ist immer der wortgleiche Vorher-Text.

**Dateien:**
- Create: `packages/ui/test/galerie.test.tsx` (256 Zeilen)
- Modify: `packages/ui/test/selftest.ts` (eine Import-Zeile direkt vor `abschluss();`)
- Create: `packages/ui/vite.config.ts` (16 Zeilen)
- Create: `packages/ui/galerie/index.html` (12), `galerie/main.tsx` (16), `galerie/galerie.css` (15),
  `galerie/beispiele-ui.tsx` (341), `galerie/beispiele-settings.tsx` (319), `galerie/ShellSeite.tsx` (97),
  `galerie/Galerie.tsx` (83), `galerie/pruefe-klassen.ts` (171), alle unter `packages/ui/`
- Modify: `packages/ui/tsconfig.json` (`include` bekommt `"../settings/src"`)
- Modify: `packages/ui/package.json` (`scripts`: drei Zeilen; `devDependencies`: vier Zeilen)
- Modify: `package-lock.json` (Eintrag `"packages/ui"` → `devDependencies`: vier Zeilen, nur über
  `npm install --ignore-scripts --package-lock-only --offline`)

Nicht angefasst: `packages/ui/src/**` (keine neue Quelle, G2), `packages/settings/**` (die Galerie importiert nur),
`apps/*`. Die Galerie hängt nicht als Paket von `@jm/settings` ab (E20: sonst Workspace-Kreis ui → settings → ui).

**Interfaces:**
- Consumes (Abschnitt 9, unverändert):
  - aus `packages/ui/src/index.ts` (9.8, Props wie 9.7): `AppHeader`, `AppShell`, `Field`, `NumberInput`, `PanelAnker`,
    `Select`, `SettingsPanel`, `StatusBar`, `StatusPill`, `TallyButton`, `TextInput`, `ThemeToggle`, `Toggle`, Typen
    `StatusItem`, `StatusState`, `TallyButtonProps`; aus dem Bestand `Button` (`variant`, `size`, `uppercase`) und
    `SettingsSection` (`title`, `description`).
  - aus `packages/ui/src/lib/texte.ts` (9.2): `UI_TEXTE`.
  - aus `packages/settings/src/index.ts` (9.9, 9.10), relativ importiert: `ABSCHNITT_TEXTE`,
    `AUDIO_TEXTE.sperreEingangOffen`, `AUDIO_TEXTE.wechselStoppt`, `abschnittStatusItem`, `ndiOutputView`,
    `remoteControlView`, `iveoView`, `dataLinkView`, die sieben Komponenten mit ihren Props-Typen sowie `ScreenOption`,
    `AudioChoice`, `AudioDeviceOption`, `PeerRow`, `RemoteControlLauncherProps`.
  - Testhilfe 9.1 über `./harness`: `ok`, `gleich`, `enthaelt`, `enthaeltNicht`, `render`, `pruefeIdVerweise`, `leseText`,
    `abschluss`.
- Produces (nur Galerie, Galerie-Test und Task 24 nutzen das; nichts davon steht in `src/index.ts`):
  ```ts
  // galerie/beispiele-ui.tsx
  export type Modus = 'dark' | 'light';
  export interface Beispiel { name: string; gruppe: string; titel: string; element: ReactElement }
  export function uiBeispiele(modus: Modus): Beispiel[];                 // 35 Beispiele (Namen: UI_NAMEN im Test)
  // galerie/beispiele-settings.tsx
  export const SHELL_ABSCHNITTE: { ndi: NdiOutputSectionProps; fernsteuerung: RemoteControlSectionProps;
    iveo: IveoSectionProps; datalink: DataLinkSectionProps };
  export function settingsBeispiele(modus: Modus): Beispiel[];           // 55 Beispiele, ids mit Präfix `${modus}-`
  // galerie/ShellSeite.tsx
  export interface ShellParameter { modus: 'dark' | 'light'; panel: boolean; dichte: 'normal' | 'kompakt'; sitzung: boolean }
  export function leseShellParameter(p: URLSearchParams): ShellParameter; // fremde Werte → dark, false, normal, mit Sitzung
  export function shellAdresse(p: ShellParameter): string;               // '?ansicht=shell&modus=…&panel=0|1&dichte=…&sitzung=0|1'
  export function ShellSeite(p: ShellParameter): React.JSX.Element;
  // galerie/Galerie.tsx
  export const RAHMEN_ANSICHTEN: ReadonlyArray<{ breite: number; parameter: ShellParameter; titel: string }>;
  export function Galerie(): React.JSX.Element;
  // galerie/pruefe-klassen.ts
  export const NEUE_TOKENS: readonly [...12 Namen];   export const PFLICHTKLASSEN: readonly [...13 Klassen];
  export function selektorText(css: string): string;
  export function hatKlasse(css: string, klasse: string): boolean;
  export function hatToken(css: string, name: string): boolean;
  export function hatSchmalAbfrage(css: string): boolean;
  export function hatKompaktRegel(css: string): boolean;
  export function hatBewegungAbfrage(css: string): boolean;
  export function classNameLiterale(quelltext: string): string[];
  export interface ProbeOptionen { cssOrdner: string; mitSettings: boolean }
  export function pruefeKlassen(o: ProbeOptionen): void;
  ```
  Skripte in `packages/ui/package.json`: `galerie` (`vite`), `galerie:bauen` (`vite build`), `galerie:pruefen`
  (`vite build && tsx galerie/pruefe-klassen.ts`). Task 24 ruft die Probe direkt mit `--css <ordner> --ohne-settings` auf.

**Verhalten (verbindlich):**
- Vite nur auf `127.0.0.1:5199`, `strictPort` (G14). `root` ist `packages/ui/galerie`, aus der URL der Config berechnet
  (unabhängig vom cwd). Bau nach `packages/ui/galerie/dist` (`.gitignore`-Regel `dist`), Vite-Cache unter
  `packages/ui/node_modules/.vite` (Regel `node_modules`). Beides gemessen, siehe Step 12.
- Übersicht: zwei Spalten `<section data-modus="dark" … class="dark …">` und `<section data-modus="light" … class="light …">`.
  Jede Spalte zeigt 35 Baustein-Beispiele und 55 Abschnitts-Beispiele. Jedes Beispiel ist ein
  `<figure data-beispiel="<name>">` mit Bildunterschrift (Zustand in Worten). Darunter folgen fünf `iframe`s auf die
  Rahmen-Seite: 1200 px Dunkel mit offenem Panel, 1200 px Hell mit geschlossenem Panel, 800 px Dunkel kompakt, 800 px Hell
  und 1200 px Dunkel **ohne Sitzung** (leere Statusleiste mit Uhr, kein ⚙, kein Panel; Spec 3.8, Studio-Control vor dem
  Login). Bei 800 px liegt das Panel über dem Inhalt (E7, Medienabfrage auf die iframe-Breite).
- Jeder Abschnitt zeigt diese Zustände: ok, Warnung, Fehler, aus oder unbekannt, gesperrt und Fehlertext. NDI kennt nach
  Task 17 kein „unbekannt“ und zeigt dafür „aus“. Die Fernsteuerung zeigt dazu die Launcher-Vollform: gesichert mit dem
  gerade erzeugten Beispiel-Token `0000-0000-0000-0000`, unvollständig, offen und unbekannt. Beispielwerte enthalten keine
  Geheimnisse: Token und Fingerabdruck bestehen aus Nullen, damit gitleaks im Job `secret-scan` nichts findet.
- ids sind auf der ganzen Seite eindeutig. Abschnitts-ids und Panel-Anker tragen das Präfix der Spalte, z. B. `dark-ndi-ok`
  → Anker `einstellung-dark-ndi-ok`.
- Rahmen-Seite `?ansicht=shell&modus=dark|light&panel=0|1&dichte=normal|kompakt&sitzung=0|1`: `AppShell` füllt das Fenster;
  mit `sitzung=0` ohne Statuseinträge und ohne `settings`. Die Klasse
  `dark`/`light` sitzt auf einem eigenen Wurzel-`div`, weil `ThemeToggle` die Klasse an `<html>` umschaltet und die Ansicht
  fest bleiben soll. Die Statusleiste entsteht aus `abschnittStatusItem(…View(props))`, also aus denselben Ableitungen wie die
  Pillen im Panel.
- Der Galerie-Quelltext (`galerie/*.tsx`, `*.html`, `*.css`, außer `pruefe-klassen.ts`) enthält keine Pflichtklasse aus
  `PFLICHTKLASSEN` und kein `motion-safe`, auch nicht in Kommentaren. Maße und Token-Farben stehen als `style`. Sonst würde
  Tailwind die Klassen aus der Galerie erzeugen, und ein fehlendes `@source "../src"` bliebe unsichtbar (gemessen in Step 9 b).
- `galerie.css`: `@import "tailwindcss"`, `@import "../src/base.css"`, `@source "../src"`, `@source "../../settings/src"`,
  `@source not "./pruefe-klassen.ts"`, `body { overflow: auto }`. Die Klassen-Probe führt ihre gesuchten Klassen als Text;
  ohne das `@source not` erzeugte sie sich diese Klassen selbst (gemessen in Step 9 c).
- `packages/ui/tsconfig.json` nimmt `../settings/src` ins `include` auf. tsx wendet `"jsx": "react-jsx"` nur auf Dateien
  an, die das `include` der tsconfig im cwd erfasst. Ohne diese Zeile bricht der Galerie-Test in den Abschnitten mit
  `ReferenceError: React is not defined` ab (gemessen in Step 4). Für `tsc` ändert sich nichts Wesentliches, weil die
  Galerie die Abschnitte ohnehin importiert.
- Die Klassen-Probe liest alle `*.css` eines Ordners (Vorgabe `galerie/dist/assets`) und prüft:
  - alle 12 Tokens sind definiert,
  - die Regel `[data-dichte="kompakt"]` ist da (minifiziert ohne Anführungszeichen, im unminifizierten electron-vite-CSS mit,
    beides gemessen),
  - die 13 Pflichtklassen stehen als Selektor im CSS (CSS-Escapes entfernt, `h-[var(--control-h-lg)]` zählt nicht als
    `h-[var(--control-h)]`; das Detail der Statusleiste ist seit der Nachbesserung `max-[900px]:sr-only` statt `…:hidden`),
  - die Medienabfrage für `max-[900px]` ist da (minifiziert gemessen als `@media not all and (min-width:900px)`, unminifiziert
    `@media (width < 900px)`),
  - die Medienabfrage für `motion-safe` ist da (`@media (prefers-reduced-motion:no-preference)`),
  - jede Klasse aus `className="…"`-Literalen in `packages/ui/src` steht im CSS, mit Settings auch die aus
    `packages/settings/src`; `group` und `peer` sind ausgenommen.
  Ein `Hinweis:` nennt die Klassen, die nur in `packages/settings/src` stehen (verglichen werden ganze Wörter: `pl-2`
  steckt als Text auch in `pl-20`, ist aber eine andere Klasse). Nur sie zeigen ein fehlendes `@source "../../settings/src"`.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (neue Datei `packages/ui/test/galerie.test.tsx`)

Der Test hält die Vollständigkeit unabhängig vom Galerie-Code fest (Namenslisten), prüft je Abschnitts-Beispiel den Zustand
der Statuspille nach den Regeln aus Task 17–22, je Baustein-Beispiel die sichtbaren Merkmale (Texte aus `UI_TEXTE`,
Pflichtklassen aus 9.7) und dazu die Rahmen-Seite. Außerdem prüft er die Klassen-Probe gegen einen Ausschnitt aus dem echten,
minifizierten Galerie-CSS (gemessen am 08.10.2026) und die statischen Quellregeln der Galerie. Er läuft in der CI mit, die
gebaute Probe nicht (E21). Genau dieser Inhalt:

```tsx
// Task 23 · Galerie (Spec 3.10): jeder Baustein in jedem Zustand, jeder Abschnitt in seinen Zuständen, beide Modi,
// der Rahmen in 1200 und 800 px. Dazu die Klassen-Probe gegen ein Stück echtes, minifiziertes CSS: Die volle Probe
// braucht `vite build` und läuft deshalb nur lokal (E21); hier wird geprüft, dass sie Fehlendes überhaupt erkennt.
import { readdirSync } from 'node:fs';
import type { StatusState } from '../src/lib/status';
import { UI_TEXTE } from '../src/lib/texte';
import { Galerie, RAHMEN_ANSICHTEN } from '../galerie/Galerie';
import { uiBeispiele } from '../galerie/beispiele-ui';
import { settingsBeispiele } from '../galerie/beispiele-settings';
import { leseShellParameter, shellAdresse, ShellSeite, type ShellParameter } from '../galerie/ShellSeite';
import {
  classNameLiterale,
  hatBewegungAbfrage,
  hatKlasse,
  hatKompaktRegel,
  hatSchmalAbfrage,
  hatToken,
  NEUE_TOKENS,
  PFLICHTKLASSEN,
} from '../galerie/pruefe-klassen';
import { enthaelt, enthaeltNicht, gleich, leseText, ok, pruefeIdVerweise, render } from './harness';

// ── Vollständigkeit: diese Namen muss jede Spalte zeigen (Liste unabhängig vom Galerie-Code) ──
const UI_NAMEN = [
  'farben', 'auswahl', 'groessen', 'groessen-kompakt',
  'statuspill-ok', 'statuspill-warn', 'statuspill-error', 'statuspill-off', 'statuspill-live',
  'statusbar-gemischt', 'statusbar-knoepfe', 'statusbar-leer',
  'tally-bereit', 'tally-live', 'tally-gesperrt', 'tally-gesperrt-ohne-grund', 'tally-halten',
  'eingabe-text', 'eingabe-text-fehler', 'eingabe-text-gesperrt', 'eingabe-zahl', 'eingabe-zahl-einheit',
  'eingabe-zahl-ohne-feld', 'eingabe-schalter', 'eingabe-schalter-gesperrt', 'eingabe-auswahl', 'eingabe-auswahl-leer',
  'eingabe-auswahl-fehlt', 'eingabe-auswahl-gesperrt',
  'theme',
  'panel',
  'kopf-live', 'kopf-bereit', 'kopf-mac', 'kopf-panel-offen',
];

// Erwarteter Zustand der Statuspille je Abschnitts-Beispiel (Regeln aus Task 17–22). „unbekannt“ ist off.
const SETTINGS_SOLL: Record<string, Exclude<StatusState, 'live'>> = {
  'ndi-ok': 'ok', 'ndi-warn': 'warn', 'ndi-startet': 'warn', 'ndi-error': 'error', 'ndi-aus': 'off',
  'ndi-ohne-name': 'off', 'ndi-gesperrt': 'ok', 'ndi-fehlertext': 'error',
  'bildschirm-ok': 'ok', 'bildschirm-warn': 'warn', 'bildschirm-error': 'error', 'bildschirm-unbekannt': 'off',
  'bildschirm-aus': 'off', 'bildschirm-keiner': 'off', 'bildschirm-gesperrt': 'ok', 'bildschirm-fehlertext': 'error',
  'fernsteuerung-ok': 'ok', 'fernsteuerung-warn': 'warn', 'fernsteuerung-error': 'error',
  'fernsteuerung-unbekannt': 'off', 'fernsteuerung-aus': 'off', 'fernsteuerung-gesperrt': 'ok',
  'fernsteuerung-fehlertext': 'error', 'fernsteuerung-launcher-gesichert': 'ok',
  'fernsteuerung-launcher-unvollstaendig': 'warn', 'fernsteuerung-launcher-offen': 'ok',
  'fernsteuerung-launcher-unbekannt': 'off',
  'audio-ok': 'ok', 'audio-warn': 'warn', 'audio-error': 'error', 'audio-unbekannt': 'off',
  'audio-drei-wahlen': 'error', 'audio-leer': 'ok', 'audio-gesperrt': 'ok', 'audio-fehlertext': 'error',
  'iveo-ok': 'ok', 'iveo-warn': 'warn', 'iveo-aus': 'off', 'iveo-unbekannt': 'off', 'iveo-gesperrt': 'ok',
  'iveo-fehlertext': 'error',
  'datalink-ok': 'ok', 'datalink-warn': 'warn', 'datalink-error': 'error', 'datalink-unbekannt': 'off',
  'datalink-aus': 'off', 'datalink-gesperrt': 'ok', 'datalink-fehlertext': 'error',
  'gegenstellen-ok': 'ok', 'gegenstellen-warn': 'warn', 'gegenstellen-unbekannt': 'off', 'gegenstellen-aus': 'off',
  'gegenstellen-schalter': 'ok', 'gegenstellen-gesperrt': 'ok', 'gegenstellen-fehlertext': 'error',
};
const ABSCHNITTE = ['ndi', 'bildschirm', 'fernsteuerung', 'audio', 'iveo', 'datalink', 'gegenstellen'];

// Was jedes UI-Beispiel sichtbar machen muss (Texte aus UI_TEXTE, Pflichtklassen aus 9.7).
const UI_PRUEFUNG: Record<string, string[]> = {
  'statuspill-ok': ['data-state="ok"'],
  'statuspill-warn': ['data-state="warn"'],
  'statuspill-error': ['data-state="error"'],
  'statuspill-off': ['data-state="off"'],
  'statuspill-live': ['data-state="live"'],
  'statusbar-gemischt': ['role="status"', 'h-[var(--statusbar-h)]'],
  'statusbar-knoepfe': ['<button', UI_TEXTE.statusOeffnen('NDI')],
  'statusbar-leer': ['role="status"', 'tabular'],
  'tally-bereit': ['border-[var(--tally-ready)]', 'min-h-[var(--control-h-lg)]'],
  'tally-live': [UI_TEXTE.live, 'text-[19px]'],
  'tally-gesperrt': ['aria-disabled="true"', 'Nur im Live-Modus'],
  'tally-gesperrt-ohne-grund': ['aria-disabled="true"', UI_TEXTE.gesperrtOhneGrund],
  'tally-halten': ['in 2 s sperren (dabei halten)', 'in 2 s ausblenden (dabei halten)', 'wieder einblenden'],
  'eingabe-text-fehler': ['aria-invalid="true"'],
  'eingabe-text-gesperrt': ['disabled=""', UI_TEXTE.gesperrt('Vom Master vorgegeben')],
  'eingabe-zahl': ['Werte unter 1024 lehnt dieses Beispiel ab'],
  'eingabe-zahl-einheit': ['>s<'],
  'eingabe-schalter': ['role="switch"'],
  'eingabe-auswahl-leer': [UI_TEXTE.bitteWaehlen],
  'eingabe-auswahl-fehlt': [UI_TEXTE.nichtVerfuegbar('Shure MV7')],
  'theme': [UI_TEXTE.themeUmschalten(UI_TEXTE.dunkel, UI_TEXTE.hell)],
  'panel': ['aria-label="Einstellungen"', 'data-hervorgehoben="true"'],
  'kopf-live': [UI_TEXTE.onAir, 'h-[var(--header-h)]', 'pl-4'],
  'kopf-bereit': [UI_TEXTE.bereit],
  'kopf-mac': ['pl-20'],
  'kopf-panel-offen': ['aria-expanded="true"', 'AUFNAHME'],
};

/** Erste Statuspille im HTML (Toggle nutzt data-state="an|aus" und zählt nicht). */
function ersterZustand(html: string): string | undefined {
  return /data-state="(ok|warn|error|off|live)"/.exec(html)?.[1];
}

// ── Inhalt der Galerie ──
{
  for (const modus of ['dark', 'light'] as const) {
    gleich(uiBeispiele(modus).map((b) => b.name), UI_NAMEN, `Galerie ${modus}: alle ${UI_NAMEN.length} Baustein-Beispiele`);
    gleich(
      settingsBeispiele(modus).map((b) => b.name).sort(),
      Object.keys(SETTINGS_SOLL).sort(),
      `Galerie ${modus}: alle ${Object.keys(SETTINGS_SOLL).length} Abschnitts-Beispiele`,
    );
  }
  for (const a of ABSCHNITTE) {
    const namen = Object.keys(SETTINGS_SOLL).filter((n) => n.startsWith(`${a}-`));
    const zustaende = new Set(namen.map((n) => SETTINGS_SOLL[n]));
    ok(
      ['ok', 'warn', 'error', 'off'].every((z) => zustaende.has(z as 'ok')) &&
        namen.includes(`${a}-gesperrt`) &&
        namen.includes(`${a}-fehlertext`) &&
        (a === 'ndi' || namen.includes(`${a}-unbekannt`)),
      `Galerie: Abschnitt ${a} zeigt ok, Warnung, Fehler, aus/unbekannt, gesperrt und Fehlertext`,
    );
  }

  for (const b of settingsBeispiele('dark')) {
    const html = render(b.element);
    const soll = SETTINGS_SOLL[b.name];
    const zusatz = b.name.endsWith('-unbekannt')
      ? html.includes('unbekannt')
      : b.name.endsWith('-gesperrt')
        ? html.includes('Gesperrt: ')
        : b.name.endsWith('-fehlertext')
          ? html.includes('data-fehler="true"') && html.includes('Fehler: ')
          : true;
    ok(ersterZustand(html) === soll && zusatz, `Abschnitts-Beispiel ${b.name}: Statuspille ${soll}`);
  }
  enthaelt(
    render(settingsBeispiele('dark').find((b) => b.name === 'fernsteuerung-launcher-gesichert')!.element),
    '0000-0000-0000-0000',
    'Launcher-Vollform: das frisch erzeugte Beispiel-Token ist sichtbar',
  );
  const dreiWahlen = render(settingsBeispiele('dark').find((b) => b.name === 'audio-drei-wahlen')!.element);
  ok((dreiWahlen.match(/>Pegel: /g) ?? []).length === 3, 'Abschnitts-Beispiel audio-drei-wahlen: Pegel je Wahl, auch für den Ausgang (E26)');

  for (const b of uiBeispiele('dark')) {
    const pruefung = UI_PRUEFUNG[b.name];
    if (!pruefung) continue;
    const html = render(b.element);
    const fehlt = pruefung.filter((teil) => !html.includes(teil));
    ok(fehlt.length === 0, `Baustein-Beispiel ${b.name}: ${pruefung.join(' · ')}`);
  }
  const panel = render(uiBeispiele('light').find((b) => b.name === 'panel')!.element);
  ok((panel.match(/data-hervorgehoben="true"/g) ?? []).length === 1, 'Panel-Beispiel: genau ein Anker hervorgehoben');

  const html = render(<Galerie />);
  ok(/data-modus="dark"[^>]*class="dark /.test(html) && /data-modus="light"[^>]*class="light /.test(html), 'Galerie: zwei Spalten, .dark und .light');
  const alle = [...UI_NAMEN, ...Object.keys(SETTINGS_SOLL)];
  const nichtZweimal = alle.filter((n) => html.split(`data-beispiel="${n}"`).length - 1 !== 2);
  gleich(nichtZweimal, [], `Galerie: jedes der ${alle.length} Beispiele genau einmal je Spalte`);
  pruefeIdVerweise(html, 'Galerie: alle id-Verweise (for, aria-describedby, aria-controls) gültig');
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  gleich(ids.filter((id, i) => ids.indexOf(id) !== i), [], 'Galerie: keine id doppelt (Anker beider Spalten getrennt)');
  for (const r of RAHMEN_ANSICHTEN) {
    enthaelt(html, `src="${shellAdresse(r.parameter).replace(/&/g, '&amp;')}" width="${r.breite}"`, `Galerie: Rahmen ${r.titel}`);
  }
  gleich(
    RAHMEN_ANSICHTEN.map((r) => `${r.breite}:${r.parameter.modus}:${r.parameter.sitzung ? 'sitzung' : 'ohne'}`).sort(),
    ['1200:dark:ohne', '1200:dark:sitzung', '1200:light:sitzung', '800:dark:sitzung', '800:light:sitzung'],
    'Galerie: Rahmen in 1200 px und 800 px (schmal), je Dunkel und Hell, dazu der Rahmen ohne Sitzung',
  );
}

// ── Rahmen-Seite (AppShell fensterfüllend, für die iframes) ──
{
  gleich(
    leseShellParameter(new URLSearchParams('?ansicht=shell&modus=light&panel=1&dichte=kompakt&sitzung=0')),
    { modus: 'light', panel: true, dichte: 'kompakt', sitzung: false },
    'ShellSeite: Parameter lesen',
  );
  gleich(
    leseShellParameter(new URLSearchParams('?modus=blau&panel=ja&dichte=eng&sitzung=nein')),
    { modus: 'dark', panel: false, dichte: 'normal', sitzung: true },
    'ShellSeite: fremde Werte → Dunkel, Panel zu, normal, mit Sitzung',
  );
  const kombis: ShellParameter[] = [];
  for (const modus of ['dark', 'light'] as const)
    for (const panel of [false, true])
      for (const dichte of ['normal', 'kompakt'] as const)
        for (const sitzung of [false, true]) kombis.push({ modus, panel, dichte, sitzung });
  ok(
    kombis.every((k) => JSON.stringify(leseShellParameter(new URLSearchParams(shellAdresse(k)))) === JSON.stringify(k)),
    'ShellSeite: shellAdresse und leseShellParameter passen für alle 16 Kombinationen zusammen',
  );
  const offen = render(<ShellSeite modus="light" panel dichte="kompakt" sitzung />);
  ok(
    offen.startsWith('<div class="light ') &&
      offen.includes('data-dichte="kompakt"') &&
      offen.includes('aria-label="Einstellungen"') &&
      offen.includes('data-hervorgehoben="true"'),
    'ShellSeite hell, Panel offen, kompakt: Klasse light, data-dichte, Panel mit hervorgehobenem Abschnitt',
  );
  enthaelt(offen, `aria-label="${UI_TEXTE.statusOeffnen('Companion')}"`, 'ShellSeite: Statuseintrag öffnet seinen Abschnitt');
  const zu = render(<ShellSeite modus="dark" panel={false} dichte="normal" sitzung />);
  ok(zu.startsWith('<div class="dark ') && !zu.includes('aria-label="Einstellungen"'), 'ShellSeite dunkel, Panel zu: kein Panel');
  const ohneSitzung = render(<ShellSeite modus="dark" panel dichte="normal" sitzung={false} />);
  ok(
    ohneSitzung.includes('data-uhr') &&
      !ohneSitzung.includes('data-status-id') &&
      !ohneSitzung.includes('data-zahnrad') &&
      !ohneSitzung.includes('aria-label="Einstellungen"'),
    'ShellSeite ohne Sitzung: leere Statusleiste mit Uhr, kein ⚙, kein Panel (Spec 3.8)',
  );
}

// ── Klassen-Probe: erkennt sie Vorhandenes und Fehlendes? (Ausschnitt aus dem gemessenen Galerie-CSS) ──
{
  const css = String.raw`:root,.dark{--tally-live:oklch(62% .23 27);--surface-raised:oklch(25% 0 0)}.h-\[var\(--control-h-lg\)\]{height:var(--control-h-lg)}.h-\[var\(--statusbar-h\)\]{height:var(--statusbar-h)}@media not all and (min-width:900px){.max-\[900px\]\:sr-only{clip-path:inset(50%);white-space:nowrap;border-width:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}}:where(.space-y-2\.5>:not(:last-child)){margin-block-end:0}`;
  ok(hatKlasse(css, 'h-[var(--statusbar-h)]'), 'Probe: findet eine escapte Arbiträrklasse');
  ok(hatKlasse(css, 'max-[900px]:sr-only'), 'Probe: findet eine Klasse mit Variante');
  ok(hatKlasse(css, 'space-y-2.5'), 'Probe: findet eine Klasse in :where(…)');
  ok(!hatKlasse(css, 'h-[var(--control-h)]'), 'Probe: h-[var(--control-h-lg)] zählt nicht als h-[var(--control-h)]');
  ok(!hatKlasse(css, 'h-[var(--header-h)]'), 'Probe: fehlende Klasse wird erkannt');
  ok(hatToken(css, '--tally-live') && !hatToken(css, '--statusbar-h'), 'Probe: Token nur als Definition, nicht als var()');
  ok(
    hatSchmalAbfrage(css) && hatSchmalAbfrage('@media (width < 900px){}') && !hatSchmalAbfrage('@media (width < 1200px){}') && !hatBewegungAbfrage(css),
    'Probe: Medienabfrage schmal (minifiziert und unminifiziert) und motion-safe getrennt erkannt',
  );
  ok(
    hatKompaktRegel('[data-dichte=kompakt]{--header-h:36px}') &&
      hatKompaktRegel('[data-dichte="kompakt"] {\n  --header-h: 36px;\n}') &&
      !hatKompaktRegel('[data-dichte="normal"] {}'),
    'Probe: Dichte-Regel minifiziert (Galerie) und unminifiziert (electron-vite) erkannt',
  );
  gleich(
    classNameLiterale('<b className="a b-[x] group" /><i className={cn("c")} />'),
    ['a', 'b-[x]', 'group'],
    'Probe: classNameLiterale liest nur className="…"',
  );
  ok(NEUE_TOKENS.length === 12 && PFLICHTKLASSEN.length === 13, 'Probe: 12 Token-Namen und 13 Pflichtklassen');
}

// ── Quellregeln der Galerie (statisch, laufen in der CI) ──
{
  const galerieCss = leseText('galerie/galerie.css');
  ok(
    galerieCss.includes('@source "../src";') &&
      galerieCss.includes('@source "../../settings/src";') &&
      galerieCss.includes('@source not "./pruefe-klassen.ts";'),
    'galerie.css: @source auf beide Pakete, Klassen-Probe vom Scan ausgenommen',
  );
  ok(/body\s*\{\s*overflow:\s*auto;\s*\}/.test(galerieCss), 'galerie.css: body scrollt (base.css sperrt das Scrollen)');
  const vite = leseText('vite.config.ts');
  ok(
    vite.includes("host: '127.0.0.1'") && vite.includes('port: 5199') && vite.includes('strictPort: true') && !vite.includes('host: true'),
    'vite.config.ts: nur 127.0.0.1:5199, strictPort',
  );
  const treffer: string[] = [];
  for (const datei of readdirSync('galerie')) {
    if (datei === 'pruefe-klassen.ts' || !/\.(tsx?|html|css)$/.test(datei)) continue;
    const text = leseText(`galerie/${datei}`);
    for (const k of [...PFLICHTKLASSEN, 'motion-safe']) if (text.includes(k)) treffer.push(`${datei}: ${k}`);
  }
  gleich(treffer, [], 'Galerie-Quelltext ohne Pflichtklassen (sonst verdeckte er ein fehlendes @source "../src")');
  enthaeltNicht(leseText('galerie/main.tsx'), 'electron', 'Galerie: kein Electron');
}
```

Einhängen in `packages/ui/test/selftest.ts` (Einfügemarke ist die letzte Zeile), Vorher:
```ts
abschluss();
```
Nachher:
```ts
import './galerie.test';
abschluss();
```

- [ ] **Step 2: Test laufen lassen (rot: Galerie fehlt)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
```
Erwartet: Node löst die Importe vor dem ersten Testblock auf. Deshalb erscheint keine einzige `ok`-Zeile, auch die der
Tasks 1–22 nicht. Danach `Exit=1`:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\packages\ui\galerie\Galerie' imported from …\packages\ui\test\galerie.test.tsx
```

- [ ] **Step 3: Galerie anlegen** (neun neue Dateien unter `packages/ui/`, mit dem Write-Werkzeug; LF, die Warnung
  „LF will be replaced by CRLF“ ist harmlos)

Datei `packages/ui/vite.config.ts`:
```ts
// Galerie von @jm/ui und @jm/settings (Spec 3.10): Vite ohne Electron, nur auf dieser Maschine erreichbar.
//   npm run galerie -w @jm/ui           Dev-Server auf http://127.0.0.1:5199/
//   npm run galerie:bauen -w @jm/ui     Bau nach packages/ui/galerie/dist (per .gitignore „dist“ ignoriert)
//   npm run galerie:pruefen -w @jm/ui   Bau + Klassen-Probe (galerie/pruefe-klassen.ts)
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('./galerie', import.meta.url)),
  plugins: [react(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5199, strictPort: true },
  preview: { host: '127.0.0.1', port: 5199, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
});
```

Datei `packages/ui/galerie/index.html`:
```html
<!doctype html>
<html lang="de" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>JM Galerie · @jm/ui und @jm/settings</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

Datei `packages/ui/galerie/main.tsx`:
```tsx
// Einstieg der Galerie. Ohne Parameter die Übersicht; `?ansicht=shell&…` zeigt nur den Rahmen (für die iframes).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './galerie.css';
import { Galerie } from './Galerie';
import { leseShellParameter, ShellSeite } from './ShellSeite';

const parameter = new URLSearchParams(window.location.search);
const wurzel = document.getElementById('root');
if (wurzel) {
  createRoot(wurzel).render(
    <StrictMode>
      {parameter.get('ansicht') === 'shell' ? <ShellSeite {...leseShellParameter(parameter)} /> : <Galerie />}
    </StrictMode>,
  );
}
```

Datei `packages/ui/galerie/galerie.css`:
```css
/* Galerie (Spec 3.10): Tailwind wie in den Apps, dazu beide Paketquellen. */
@import "tailwindcss";
@import "../src/base.css";

/* Vite-Wurzel ist `galerie`. Klassen außerhalb davon findet Tailwind v4 nur über @source
   (die Apps tun dasselbe mit `@source "../../../../../packages/ui/src"`). */
@source "../src";
@source "../../settings/src";
/* Die Klassen-Probe enthält die gesuchten Klassen als Text. Gescannt, erzeugte sie sich ihre Klassen selbst. */
@source not "./pruefe-klassen.ts";

/* base.css sperrt das Scrollen (feste App-Fenster); die Galerie ist eine lange Seite. */
body {
  overflow: auto;
}
```

Datei `packages/ui/galerie/beispiele-ui.tsx`:
```tsx
// Galerie: jeder Baustein aus @jm/ui in jedem Zustand (Spec 3.10).
// Regel für diese Datei: keine Pflichtklasse der Bausteine (Liste PFLICHTKLASSEN in pruefe-klassen.ts), auch nicht im
// Kommentar, und keine Bewegungs-Variante. Maße und Token-Farben stehen als `style`. Sonst erzeugte Tailwind die Klassen
// aus der Galerie, und die Klassen-Probe sähe ein fehlendes `@source "../src"` nicht (Test „Galerie-Quelltext ohne
// Pflichtklassen“).
import { useState, type CSSProperties, type ReactElement } from 'react';
import {
  AppHeader,
  Button,
  Field,
  NumberInput,
  PanelAnker,
  Select,
  SettingsPanel,
  SettingsSection,
  StatusBar,
  StatusPill,
  TallyButton,
  TextInput,
  ThemeToggle,
  Toggle,
  type StatusItem,
  type StatusState,
  type TallyButtonProps,
} from '../src/index';
import { UI_TEXTE } from '../src/lib/texte';

export type Modus = 'dark' | 'light';
export interface Beispiel {
  /** Eindeutiger Name je Spalte, steht als data-beispiel im HTML. */
  name: string;
  /** Überschrift der Gruppe in der Galerie. */
  gruppe: string;
  /** Bildunterschrift: Zustand in Worten. */
  titel: string;
  element: ReactElement;
}

const nichts = (): void => undefined;

const FARBEN: Array<{ name: string; hinweis: string }> = [
  { name: '--tally-live', hinweis: 'auf Sendung' },
  { name: '--tally-ready', hinweis: 'bereit / ok' },
  { name: '--tally-selected', hinweis: 'ausgewählt' },
  { name: '--status-warn', hinweis: 'Warnung' },
  { name: '--status-error', hinweis: 'Fehler' },
  { name: '--status-off', hinweis: 'aus / unbekannt' },
  { name: '--surface-raised', hinweis: 'Panel-Fläche' },
];
const GROESSEN: Array<{ name: string; normal: string; kompakt: string; breite?: boolean }> = [
  { name: '--header-h', normal: '44 px', kompakt: '36 px' },
  { name: '--statusbar-h', normal: '28 px', kompakt: '24 px' },
  { name: '--control-h', normal: '32 px', kompakt: '32 px' },
  { name: '--control-h-lg', normal: '48 px', kompakt: '48 px' },
  { name: '--panel-w', normal: '360 px', kompakt: '360 px', breite: true },
];

function Farbkacheln(): React.JSX.Element {
  return (
    <ul className="grid grid-cols-2 gap-2">
      {FARBEN.map((f) => (
        <li key={f.name} className="flex items-center gap-2 text-[11px]">
          <span
            aria-hidden="true"
            className="inline-block h-6 w-10 rounded-[var(--radius-md)] border border-[var(--border)]"
            style={{ background: `var(${f.name})` }}
          />
          <code>{f.name}</code>
          <span className="text-[var(--muted-foreground)]">{f.hinweis}</span>
        </li>
      ))}
    </ul>
  );
}

function Auswahlkachel({ modus }: { modus: Modus }): React.JSX.Element {
  // E5: hell ist „ausgewählt“ dunkel mit gelber Kante; die Kante ist eine Regel der Komponente, nicht des Tokens.
  const stil: CSSProperties = {
    background: 'var(--tally-selected)',
    color: 'var(--primary-foreground)',
    border: modus === 'light' ? '2px solid var(--brand-yellow)' : '2px solid transparent',
  };
  return (
    <div className="flex gap-2">
      <span className="rounded-[var(--radius-md)] px-3 py-2 text-xs font-bold" style={stil}>
        Kamera 2 (ausgewählt)
      </span>
      <span className="rounded-[var(--radius-md)] border-2 border-[var(--border)] px-3 py-2 text-xs">Kamera 3</span>
    </div>
  );
}

function Groessen({ kompakt }: { kompakt: boolean }): React.JSX.Element {
  return (
    <div data-dichte={kompakt ? 'kompakt' : undefined} className="space-y-1.5">
      {GROESSEN.map((g) => (
        <div key={g.name} className="flex items-center gap-2 text-[11px]">
          <span
            aria-hidden="true"
            className="inline-block rounded-[var(--radius-sm)] bg-[var(--secondary)]"
            style={g.breite ? { width: `var(${g.name})`, height: 8, maxWidth: '100%' } : { height: `var(${g.name})`, width: 24 }}
          />
          <code>{g.name}</code>
          <span className="text-[var(--muted-foreground)]">{kompakt ? g.kompakt : g.normal}</span>
        </div>
      ))}
    </div>
  );
}

const STATUS_GEMISCHT: StatusItem[] = [
  { id: 'sendung', group: 'tool', label: 'Bauchbinde', state: 'live', detail: 'auf Sendung seit 09:41' },
  { id: 'datalink', group: 'tool', label: 'DataLink', state: 'warn', detail: 'keine Datei im Ordner' },
  { id: 'ndi', group: 'ausgabe', label: 'NDI', state: 'ok', detail: 'sendet · 2 Empfänger' },
  { id: 'master', group: 'verbindung', label: 'Master', state: 'ok', detail: 'verbunden mit REGIE-PC' },
  { id: 'companion', group: 'fernsteuerung', label: 'Companion', state: 'off', detail: 'unbekannt' },
  { id: 'bildschirm', group: 'ausgabe', label: 'Bildschirm', state: 'error', detail: 'Bildschirm fehlt' },
];

function StatusBarMitKnoepfen(): React.JSX.Element {
  const [zuletzt, setZuletzt] = useState('–');
  const items = STATUS_GEMISCHT.map((i) => (i.id === 'sendung' ? i : { ...i, settingsSection: i.id }));
  return (
    <div className="space-y-1">
      <StatusBar items={items} onOpenSection={setZuletzt} />
      <p className="text-[11px] text-[var(--muted-foreground)]">Zuletzt geöffneter Abschnitt: {zuletzt}</p>
    </div>
  );
}

function HaltenProbe(): React.JSX.Element {
  const [zustand, setZustand] = useState<TallyButtonProps['state']>('bereit');
  const [sichtbar, setSichtbar] = useState(true);
  const [zahl, setZahl] = useState({ gedrueckt: 0, losgelassen: 0, klicks: 0 });
  return (
    <div className="space-y-2">
      {sichtbar ? (
        <TallyButton
          state={zustand}
          label="Sprechen (halten)"
          shortcut="Leertaste"
          disabledReason="Zum Ausprobieren gesperrt"
          onPress={() => setZahl((z) => ({ ...z, gedrueckt: z.gedrueckt + 1 }))}
          onRelease={() => setZahl((z) => ({ ...z, losgelassen: z.losgelassen + 1 }))}
          onClick={() => setZahl((z) => ({ ...z, klicks: z.klicks + 1 }))}
        />
      ) : (
        <p className="text-[11px]">Knopf ausgeblendet (Unmount)</p>
      )}
      <p className="tabular text-[11px]">
        gedrückt {zahl.gedrueckt} · losgelassen {zahl.losgelassen} · Klicks {zahl.klicks}
      </p>
      <div className="flex flex-wrap gap-2">
        {(['bereit', 'live', 'gesperrt'] as const).map((z) => (
          <Button key={z} type="button" size="sm" variant="outline" uppercase={false} onClick={() => setZustand(z)}>
            {z}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          uppercase={false}
          onClick={() => window.setTimeout(() => setZustand('gesperrt'), 2000)}
        >
          in 2 s sperren (dabei halten)
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          uppercase={false}
          onClick={() => window.setTimeout(() => setSichtbar(false), 2000)}
        >
          in 2 s ausblenden (dabei halten)
        </Button>
        <Button type="button" size="sm" variant="outline" uppercase={false} onClick={() => setSichtbar(true)}>
          wieder einblenden
        </Button>
      </div>
    </div>
  );
}

function TextBeispiel(p: { fehler?: string; gesperrt?: string }): React.JSX.Element {
  const [wert, setWert] = useState(p.fehler ? '' : 'JM Titler');
  return (
    <Field label="Quellenname" hint="So heißt die Quelle im NDI-Netz." error={p.fehler} lockedReason={p.gesperrt}>
      <TextInput value={wert} onChange={setWert} />
    </Field>
  );
}

function ZahlBeispiel(p: { einheit?: string; ohneFeld?: boolean }): React.JSX.Element {
  const [wert, setWert] = useState<number | null>(p.einheit ? 5 : 8731);
  if (p.ohneFeld) return <NumberInput value={wert} onChange={setWert} min={1} max={65535} ganzzahl aria-label="Port" />;
  return p.einheit ? (
    <Field label="Vorlauf" hint="0 bis 60 Sekunden, Komma erlaubt.">
      <NumberInput value={wert} onChange={setWert} min={0} max={60} unit={p.einheit} />
    </Field>
  ) : (
    <Field
      label="Port"
      hint="1 bis 65535. Enter oder Verlassen übernimmt, Escape verwirft. Werte unter 1024 lehnt dieses Beispiel ab (nach 2 s „Noch nicht übernommen.“)."
    >
      <NumberInput
        value={wert}
        onChange={(n) => {
          if (n >= 1024) setWert(n);
        }}
        min={1}
        max={65535}
        ganzzahl
      />
    </Field>
  );
}

function SchalterBeispiel(p: { gesperrt?: string }): React.JSX.Element {
  const [an, setAn] = useState(true);
  return (
    <Field label="Transparenz" lockedReason={p.gesperrt}>
      <Toggle checked={an} onChange={setAn} />
    </Field>
  );
}

const GERAETE = [
  { value: 'mic-1', label: 'Focusrite USB (Eingang 1/2)' },
  { value: 'mic-2', label: 'Dante Virtual Soundcard' },
];
function AuswahlBeispiel(p: { start: string; gesperrt?: string }): React.JSX.Element {
  const [wert, setWert] = useState(p.start);
  return (
    <Field label="Eingang" lockedReason={p.gesperrt}>
      <Select options={GERAETE} value={wert} onChange={setWert} placeholder={UI_TEXTE.bitteWaehlen} fehlendLabel="Shure MV7" />
    </Field>
  );
}

function PanelBeispiel({ modus }: { modus: Modus }): React.JSX.Element {
  const [offen, setOffen] = useState(true);
  const [abschnitt, setAbschnitt] = useState<string | undefined>(`${modus}-panel-b`);
  const anker = [
    { id: `${modus}-panel-a`, titel: 'Abschnitt A' },
    { id: `${modus}-panel-b`, titel: 'Abschnitt B' },
    { id: `${modus}-panel-c`, titel: 'Abschnitt C' },
  ];
  return (
    <div className="relative flex overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]" style={{ height: 380 }}>
      <div className="flex-1 space-y-2 p-3 text-xs">
        <p>Inhalt (Live-Bedienung)</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" uppercase={false} onClick={() => setOffen(!offen)}>
            {offen ? 'Panel schließen' : 'Panel öffnen'}
          </Button>
          {anker.map((a) => (
            <Button
              key={a.id}
              type="button"
              size="sm"
              variant="ghost"
              uppercase={false}
              onClick={() => {
                setOffen(true);
                setAbschnitt(a.id);
              }}
            >
              zu {a.titel}
            </Button>
          ))}
        </div>
      </div>
      <SettingsPanel open={offen} onClose={() => setOffen(false)} sectionId={abschnitt}>
        {anker.map((a) => (
          <PanelAnker key={a.id} id={a.id}>
            <SettingsSection title={a.titel} description="Escape schließt das Panel, solange der Fokus darin liegt.">
              <p className="text-xs" style={{ minHeight: 80 }}>
                Inhalt von {a.titel}
              </p>
            </SettingsSection>
          </PanelAnker>
        ))}
      </SettingsPanel>
    </div>
  );
}

function Tallys({ children }: { children: ReactElement }): React.JSX.Element {
  return <div style={{ width: 240 }}>{children}</div>;
}

const ZUSTAENDE: Array<{ state: StatusState; text: string }> = [
  { state: 'ok', text: 'verbunden' },
  { state: 'warn', text: 'an (ohne Rückmeldung)' },
  { state: 'error', text: 'Port belegt' },
  { state: 'off', text: 'unbekannt' },
  { state: 'live', text: 'auf Sendung' },
];

export function uiBeispiele(modus: Modus): Beispiel[] {
  const kopfMitte = <span className="text-xs text-[var(--muted-foreground)]">Show: Fachtagung 2026 · vom Master</span>;
  return [
    { name: 'farben', gruppe: 'Tokens', titel: 'Farben mit fester Bedeutung (als Fläche)', element: <Farbkacheln /> },
    { name: 'auswahl', gruppe: 'Tokens', titel: 'Ausgewählt: --tally-selected, hell mit gelber Kante', element: <Auswahlkachel modus={modus} /> },
    { name: 'groessen', gruppe: 'Tokens', titel: 'Größen (Dichte normal)', element: <Groessen kompakt={false} /> },
    { name: 'groessen-kompakt', gruppe: 'Tokens', titel: 'Größen (data-dichte="kompakt")', element: <Groessen kompakt /> },
    ...ZUSTAENDE.map((z) => ({
      name: `statuspill-${z.state}`,
      gruppe: 'StatusPill',
      titel: `${UI_TEXTE.zustand[z.state]}`,
      element: <StatusPill state={z.state} text={z.text} />,
    })),
    { name: 'statusbar-gemischt', gruppe: 'StatusBar', titel: 'Gruppen gemischt übergeben, Leiste ordnet; ohne Knöpfe', element: <StatusBar items={STATUS_GEMISCHT} /> },
    { name: 'statusbar-knoepfe', gruppe: 'StatusBar', titel: 'Einträge mit Abschnitt öffnen das Panel', element: <StatusBarMitKnoepfen /> },
    { name: 'statusbar-leer', gruppe: 'StatusBar', titel: 'Ohne Sitzung: nur die Uhr', element: <StatusBar items={[]} /> },
    { name: 'tally-bereit', gruppe: 'TallyButton', titel: 'bereit', element: <Tallys><TallyButton state="bereit" label="Take" shortcut="Enter" onClick={nichts} /></Tallys> },
    { name: 'tally-live', gruppe: 'TallyButton', titel: 'live', element: <Tallys><TallyButton state="live" label="Bauchbinde 1" shortcut="Enter" onClick={nichts} /></Tallys> },
    { name: 'tally-gesperrt', gruppe: 'TallyButton', titel: 'gesperrt mit Grund', element: <Tallys><TallyButton state="gesperrt" label="Clear" disabledReason="Nur im Live-Modus" onClick={nichts} /></Tallys> },
    { name: 'tally-gesperrt-ohne-grund', gruppe: 'TallyButton', titel: 'gesperrt ohne Grund (Fehler des Tools, sichtbar gemacht)', element: <Tallys><TallyButton state="gesperrt" label="Clear" onClick={nichts} /></Tallys> },
    { name: 'tally-halten', gruppe: 'TallyButton', titel: 'Halten zum Sprechen: Zähler zum Ausprobieren', element: <Tallys><HaltenProbe /></Tallys> },
    { name: 'eingabe-text', gruppe: 'Eingaben', titel: 'Text mit Hilfe', element: <TextBeispiel /> },
    { name: 'eingabe-text-fehler', gruppe: 'Eingaben', titel: 'Text mit Fehler', element: <TextBeispiel fehler="Bitte einen Namen eintragen." /> },
    { name: 'eingabe-text-gesperrt', gruppe: 'Eingaben', titel: 'Text gesperrt', element: <TextBeispiel gesperrt="Vom Master vorgegeben" /> },
    { name: 'eingabe-zahl', gruppe: 'Eingaben', titel: 'Zahl (ganzzahlig, 1–65535)', element: <ZahlBeispiel /> },
    { name: 'eingabe-zahl-einheit', gruppe: 'Eingaben', titel: 'Zahl mit Einheit', element: <ZahlBeispiel einheit="s" /> },
    { name: 'eingabe-zahl-ohne-feld', gruppe: 'Eingaben', titel: 'Zahl ohne Field (aria-label)', element: <ZahlBeispiel ohneFeld /> },
    { name: 'eingabe-schalter', gruppe: 'Eingaben', titel: 'Schalter', element: <SchalterBeispiel /> },
    { name: 'eingabe-schalter-gesperrt', gruppe: 'Eingaben', titel: 'Schalter gesperrt', element: <SchalterBeispiel gesperrt="Während der Sendung gesperrt" /> },
    { name: 'eingabe-auswahl', gruppe: 'Eingaben', titel: 'Auswahl', element: <AuswahlBeispiel start="mic-1" /> },
    { name: 'eingabe-auswahl-leer', gruppe: 'Eingaben', titel: 'Auswahl ohne Wert (Platzhalter)', element: <AuswahlBeispiel start="" /> },
    { name: 'eingabe-auswahl-fehlt', gruppe: 'Eingaben', titel: 'Gewähltes Gerät fehlt: bleibt gewählt', element: <AuswahlBeispiel start="mic-9" /> },
    { name: 'eingabe-auswahl-gesperrt', gruppe: 'Eingaben', titel: 'Auswahl gesperrt', element: <AuswahlBeispiel start="mic-2" gesperrt="Gesperrt, solange der Eingang offen ist" /> },
    { name: 'theme', gruppe: 'ThemeToggle', titel: 'zeigt den Zustand; wirkt auf <html>, die Spalten bleiben fest', element: <ThemeToggle /> },
    { name: 'panel', gruppe: 'SettingsPanel', titel: 'offen, Abschnitt B angesprungen', element: <PanelBeispiel modus={modus} /> },
    { name: 'kopf-live', gruppe: 'AppHeader', titel: 'On Air live, ⚙ vorhanden', element: <AppHeader tool="Titler" center={kopfMitte} onAir={{ live: true }} settingsAvailable settingsOpen={false} onSettingsToggle={nichts} mac={false} /> },
    { name: 'kopf-bereit', gruppe: 'AppHeader', titel: 'On Air bereit', element: <AppHeader tool="Switcher" onAir={{ live: false }} settingsAvailable settingsOpen={false} onSettingsToggle={nichts} mac={false} /> },
    { name: 'kopf-mac', gruppe: 'AppHeader', titel: 'macOS: Platz für die Ampel, ohne On Air und ohne ⚙', element: <AppHeader tool="Copy" mac /> },
    { name: 'kopf-panel-offen', gruppe: 'AppHeader', titel: 'Panel offen, eigenes On-Air-Label', element: <AppHeader tool="Recorder" onAir={{ live: true, label: 'AUFNAHME' }} settingsAvailable settingsOpen onSettingsToggle={nichts} mac={false} /> },
  ];
}
```

Datei `packages/ui/galerie/beispiele-settings.tsx`:
```tsx
// Galerie: jeder Einstellungs-Abschnitt aus @jm/settings in seinen Zuständen (Spec 3.10, 6.2): ok, Warnung, Fehler,
// aus bzw. unbekannt, gesperrt und mit Fehlertext; die Fernsteuerung zusätzlich als Launcher-Vollform.
// Die Abschnitte zeigen feste Zustände, ihre Rückrufe tun nichts. @jm/settings wird relativ importiert (E20): eine
// Paket-Abhängigkeit ui → settings gäbe einen Kreis, denn settings hängt von ui ab.
// Regel wie in beispiele-ui.tsx: keine Pflichtklasse der Bausteine im Text, Maße als `style`.
import type { CSSProperties, ReactElement } from 'react';
import {
  ABSCHNITT_TEXTE,
  AUDIO_TEXTE,
  AudioDeviceSection,
  DataLinkSection,
  IveoSection,
  NdiOutputSection,
  PeersSection,
  RemoteControlSection,
  ScreenOutputSection,
  type AudioChoice,
  type AudioDeviceOption,
  type AudioDeviceSectionProps,
  type DataLinkSectionProps,
  type IveoSectionProps,
  type NdiOutputSectionProps,
  type PeerRow,
  type PeersSectionProps,
  type RemoteControlLauncherProps,
  type RemoteControlSectionProps,
  type ScreenOption,
  type ScreenOutputSectionProps,
} from '../../settings/src/index';
import type { Beispiel, Modus } from './beispiele-ui';

const nichts = (): void => undefined;
const MASTER = ABSCHNITT_TEXTE.gesperrtVomMaster;
/** So breit und so hinterlegt wie im Einstellungs-Panel. */
const PANEL: CSSProperties = { width: 'var(--panel-w)', background: 'var(--surface-raised)', padding: 16, borderRadius: 'var(--radius-lg)' };

// ── NDI-Ausgabe ──
const AUFLOESUNGEN = [
  { value: '1920x1080', label: '1920 × 1080' },
  { value: '1280x720', label: '1280 × 720' },
];
const BILDRATEN = [
  { value: '50', label: '50 fps' },
  { value: '25', label: '25 fps' },
];
function ndi(id: string, extra: Partial<NdiOutputSectionProps>): NdiOutputSectionProps {
  return {
    id,
    enabled: true,
    sending: true,
    sourceName: 'JM Titler',
    networkName: 'REGIE-PC (JM Titler)',
    receivers: 2,
    resolution: '1920x1080',
    resolutionOptions: AUFLOESUNGEN,
    fps: '50',
    fpsOptions: BILDRATEN,
    transparency: true,
    capabilities: { toggle: true, rename: true, resolution: true, fps: true, transparency: true },
    onToggle: nichts,
    onRename: nichts,
    onResolution: nichts,
    onFps: nichts,
    onTransparency: nichts,
    ...extra,
  };
}

// ── Ausgabe auf Bildschirm ──
const BILDSCHIRME: ScreenOption[] = [
  { id: 1, label: 'Bildschirm 1 (2560 × 1440)', primary: true },
  { id: 2, label: 'Bildschirm 2 (1920 × 1080)', primary: false },
];
function bildschirm(id: string, extra: Partial<ScreenOutputSectionProps>): ScreenOutputSectionProps {
  return {
    id,
    enabled: true,
    windowOpen: true,
    screens: BILDSCHIRME,
    selectedId: 2,
    fullscreen: true,
    background: '#00b140',
    capabilities: { toggle: true, fullscreen: true, background: true },
    onToggle: nichts,
    onSelect: nichts,
    onFullscreen: nichts,
    onBackground: nichts,
    ...extra,
  };
}

// ── Fernsteuerung ──
function fernsteuerung(id: string, extra: Partial<RemoteControlSectionProps>): RemoteControlSectionProps {
  return {
    id,
    variante: 'tool',
    running: true,
    mode: 'secure',
    port: 8731,
    clients: 2,
    companionModule: 'jm-suite',
    capabilities: {},
    onOpenLauncher: nichts,
    ...extra,
  };
}
function launcher(extra: Partial<RemoteControlLauncherProps>): RemoteControlLauncherProps {
  // Beispielwerte ohne Geheimnis: Nullen statt eines echten Tokens oder Fingerabdrucks.
  return {
    hasToken: true,
    hasTls: true,
    tlsFingerprint: '00:00:00:00:00:00:00:00',
    busy: false,
    onActivate: nichts,
    onDeactivate: nichts,
    onCopyToken: nichts,
    ...extra,
  };
}
function fernsteuerungLauncher(id: string, extra: Partial<RemoteControlSectionProps>): RemoteControlSectionProps {
  return { id, variante: 'launcher', mode: 'secure', capabilities: {}, launcher: launcher({}), ...extra };
}

// ── Audiogerät ──
const EINGAENGE: AudioDeviceOption[] = [
  { id: 'mic-1', label: 'Focusrite USB (Eingang 1/2)' },
  { id: 'mic-2', label: 'Dante Virtual Soundcard' },
];
const AUSGAENGE: AudioDeviceOption[] = [
  { id: 'out-1', label: 'Lautsprecher (Realtek)' },
  { id: 'out-2', label: 'CABLE Input (VB-Audio)' },
];
function wahl(extra: Partial<AudioChoice>): AudioChoice {
  return {
    key: 'eingang',
    label: 'Eingang',
    direction: 'input',
    devices: EINGAENGE,
    value: 'mic-1',
    defaultLabel: 'System-Standard',
    onChange: nichts,
    ...extra,
  };
}
function audio(id: string, extra: Partial<AudioDeviceSectionProps>): AudioDeviceSectionProps {
  return { id, choices: [wahl({})], capabilities: { refresh: true }, onRefresh: nichts, ...extra };
}

// ── iveo ──
function iveo(id: string, extra: Partial<IveoSectionProps>): IveoSectionProps {
  return {
    id,
    bound: true,
    eventName: 'Fachtagung 2026',
    stage: 'Saal 1',
    speakerCount: 24,
    delivery: 'ok',
    onOpenLauncher: nichts,
    ...extra,
  };
}

// ── DataLink ──
function datalink(id: string, extra: Partial<DataLinkSectionProps>): DataLinkSectionProps {
  return {
    id,
    folder: 'D:\\Shows\\Fachtagung\\daten',
    fileCount: 5,
    lastChange: '2026-10-08T09:41:00',
    onPickFolder: nichts,
    ...extra,
  };
}

// ── Gegenstellen ──
const GEGENSTELLEN: PeerRow[] = [
  { role: 'qa', label: 'JM Q&A', host: '', port: 8733, defaultPort: 8733, connected: true, source: 'mdns' },
  { role: 'battle', label: 'JM Battle', host: '', port: 8734, defaultPort: 8734, connected: true, source: 'mdns' },
];
function gegenstellen(id: string, extra: Partial<PeersSectionProps>): PeersSectionProps {
  return {
    id,
    peers: GEGENSTELLEN,
    capabilities: { auto: true },
    onSet: nichts,
    onAuto: nichts,
    onToggle: nichts,
    ...extra,
  };
}

/** Abschnitte für die Rahmen-Seite (eine Seite, deshalb feste ids). */
export const SHELL_ABSCHNITTE = {
  ndi: ndi('ndi', {}),
  fernsteuerung: fernsteuerung('fernsteuerung', { clients: 1 }),
  iveo: iveo('iveo', { delivery: 'veraltet', staleSince: '2026-10-08T09:12:00' }),
  datalink: datalink('datalink', {}),
};

export function settingsBeispiele(modus: Modus): Beispiel[] {
  // ids je Spalte verschieden: der Anker heißt einstellung-<id>, und eine id darf es nur einmal geben.
  const id = (name: string): string => `${modus}-${name}`;
  const b = (name: string, gruppe: string, titel: string, inhalt: ReactElement): Beispiel => ({
    name,
    gruppe,
    titel,
    element: <div style={PANEL}>{inhalt}</div>,
  });
  const N = 'NDI-Ausgabe';
  const S = 'Ausgabe auf Bildschirm';
  const R = 'Fernsteuerung';
  const A = 'Audiogerät';
  const I = 'iveo';
  const D = 'DataLink';
  const G = 'Gegenstellen';
  return [
    b('ndi-ok', N, 'ok: sendet, 2 Empfänger', <NdiOutputSection {...ndi(id('ndi-ok'), {})} />),
    b('ndi-warn', N, 'Warnung: an, ohne Rückmeldung (Empfänger unbekannt)', <NdiOutputSection {...ndi(id('ndi-warn'), { sending: undefined, receivers: undefined })} />),
    b('ndi-startet', N, 'Warnung: startet', <NdiOutputSection {...ndi(id('ndi-startet'), { starting: true, sending: undefined, receivers: undefined })} />),
    b('ndi-error', N, 'Fehler: an, sendet aber nicht', <NdiOutputSection {...ndi(id('ndi-error'), { sending: false, receivers: undefined })} />),
    b('ndi-aus', N, 'aus', <NdiOutputSection {...ndi(id('ndi-aus'), { enabled: false, sending: false, receivers: undefined })} />),
    b('ndi-ohne-name', N, 'aus, ohne Quellenname (nur Schalter und Name, wie im Titler)', <NdiOutputSection {...ndi(id('ndi-ohne-name'), { enabled: false, sending: false, sourceName: '', networkName: undefined, receivers: undefined, capabilities: { toggle: true, rename: true } })} />),
    b('ndi-gesperrt', N, 'gesperrt', <NdiOutputSection {...ndi(id('ndi-gesperrt'), { locked: MASTER })} />),
    b('ndi-fehlertext', N, 'mit Fehlertext', <NdiOutputSection {...ndi(id('ndi-fehlertext'), { sending: false, receivers: undefined, error: 'NDI-Laufzeit nicht gefunden.' })} />),

    b('bildschirm-ok', S, 'ok: auf Bildschirm 2', <ScreenOutputSection {...bildschirm(id('bildschirm-ok'), {})} />),
    b('bildschirm-warn', S, 'Warnung: an, ohne Rückmeldung', <ScreenOutputSection {...bildschirm(id('bildschirm-warn'), { windowOpen: undefined })} />),
    b('bildschirm-error', S, 'Fehler: gewählter Bildschirm fehlt (bleibt gewählt)', <ScreenOutputSection {...bildschirm(id('bildschirm-error'), { selectedId: 3 })} />),
    b('bildschirm-unbekannt', S, 'unbekannt: Liste noch nicht geladen', <ScreenOutputSection {...bildschirm(id('bildschirm-unbekannt'), { screens: undefined })} />),
    b('bildschirm-aus', S, 'aus', <ScreenOutputSection {...bildschirm(id('bildschirm-aus'), { enabled: false, windowOpen: false })} />),
    b('bildschirm-keiner', S, 'aus, kein Bildschirm gefunden', <ScreenOutputSection {...bildschirm(id('bildschirm-keiner'), { enabled: false, windowOpen: false, screens: [], selectedId: null })} />),
    b('bildschirm-gesperrt', S, 'gesperrt', <ScreenOutputSection {...bildschirm(id('bildschirm-gesperrt'), { locked: MASTER })} />),
    b('bildschirm-fehlertext', S, 'mit Fehlertext', <ScreenOutputSection {...bildschirm(id('bildschirm-fehlertext'), { windowOpen: false, error: 'Ausgabefenster ließ sich nicht öffnen.' })} />),

    b('fernsteuerung-ok', R, 'ok: bereit, 2 verbunden', <RemoteControlSection {...fernsteuerung(id('fernsteuerung-ok'), {})} />),
    b('fernsteuerung-warn', R, 'Warnung: Neustart nötig', <RemoteControlSection {...fernsteuerung(id('fernsteuerung-warn'), { restartRequired: true })} />),
    b('fernsteuerung-error', R, 'Fehler: Port belegt', <RemoteControlSection {...fernsteuerung(id('fernsteuerung-error'), { portInUse: true })} />),
    b('fernsteuerung-unbekannt', R, 'unbekannt: läuft der Server? (keine „0 verbunden“)', <RemoteControlSection {...fernsteuerung(id('fernsteuerung-unbekannt'), { running: undefined, clients: 0 })} />),
    b('fernsteuerung-aus', R, 'aus', <RemoteControlSection {...fernsteuerung(id('fernsteuerung-aus'), { running: false, clients: undefined })} />),
    b('fernsteuerung-gesperrt', R, 'gesperrt, Port änderbar', <RemoteControlSection {...fernsteuerung(id('fernsteuerung-gesperrt'), { locked: MASTER, capabilities: { portEditable: true }, onPortChange: nichts })} />),
    b('fernsteuerung-fehlertext', R, 'mit Fehlertext', <RemoteControlSection {...fernsteuerung(id('fernsteuerung-fehlertext'), { running: false, clients: undefined, error: 'Steuerserver nicht gestartet.' })} />),
    b('fernsteuerung-launcher-gesichert', R, 'Launcher: gesichert, Token gerade erzeugt', <RemoteControlSection {...fernsteuerungLauncher(id('fernsteuerung-launcher-gesichert'), { launcher: launcher({ revealedToken: '0000-0000-0000-0000' }) })} />),
    b('fernsteuerung-launcher-unvollstaendig', R, 'Launcher: gesichert, aber ohne Token', <RemoteControlSection {...fernsteuerungLauncher(id('fernsteuerung-launcher-unvollstaendig'), { launcher: launcher({ hasToken: false }) })} />),
    b('fernsteuerung-launcher-offen', R, 'Launcher: offen', <RemoteControlSection {...fernsteuerungLauncher(id('fernsteuerung-launcher-offen'), { mode: 'open', launcher: launcher({ hasToken: false, hasTls: false, tlsFingerprint: undefined }) })} />),
    b('fernsteuerung-launcher-unbekannt', R, 'Launcher: Modus unbekannt', <RemoteControlSection {...fernsteuerungLauncher(id('fernsteuerung-launcher-unbekannt'), { mode: undefined, launcher: launcher({ busy: true }) })} />),

    b('audio-ok', A, 'ok: ein Eingang', <AudioDeviceSection {...audio(id('audio-ok'), {})} />),
    b('audio-warn', A, 'Warnung: Pflichtwahl leer', <AudioDeviceSection {...audio(id('audio-warn'), { choices: [wahl({ value: '', required: true, defaultLabel: undefined })] })} />),
    b('audio-error', A, 'Fehler: Gerät verschwunden (bleibt gewählt)', <AudioDeviceSection {...audio(id('audio-error'), { choices: [wahl({ value: 'mic-9', lastLabel: 'Shure MV7' })] })} />),
    b('audio-unbekannt', A, 'unbekannt: Geräteliste noch nicht geladen', <AudioDeviceSection {...audio(id('audio-unbekannt'), { choices: [wahl({ devices: undefined })] })} />),
    b(
      'audio-drei-wahlen',
      A,
      'Interpreter-Muster: drei Wahlen, jede mit Pegel (auch der Ausgang), eine fehlt',
      <AudioDeviceSection
        {...audio(id('audio-drei-wahlen'), {
          capabilities: { level: true, refresh: true },
          choices: [
            wahl({ key: 'floor', label: 'Floor', levelDb: -18, changeWarning: AUDIO_TEXTE.wechselStoppt }),
            wahl({ key: 'dolmetscher', label: 'Dolmetscher', value: 'mic-7', lastLabel: 'Sennheiser e835', levelDb: -Infinity }),
            wahl({ key: 'ausgabe', label: 'Ausgabe', direction: 'output', devices: AUSGAENGE, value: 'out-2', levelDb: -12 }),
          ],
        })}
      />,
    ),
    b('audio-leer', A, 'ok: keine Geräte gefunden, Standard gewählt', <AudioDeviceSection {...audio(id('audio-leer'), { choices: [wahl({ devices: [], value: '' })] })} />),
    b('audio-gesperrt', A, 'Wahl gesperrt, solange der Eingang offen ist', <AudioDeviceSection {...audio(id('audio-gesperrt'), { locked: AUDIO_TEXTE.sperreEingangOffen, choices: [wahl({ lockedReason: AUDIO_TEXTE.sperreEingangOffen })] })} />),
    b('audio-fehlertext', A, 'mit Fehlertext', <AudioDeviceSection {...audio(id('audio-fehlertext'), { error: 'Audiogerät ließ sich nicht öffnen.' })} />),

    b('iveo-ok', I, 'ok: verbunden', <IveoSection {...iveo(id('iveo-ok'), {})} />),
    b('iveo-warn', I, 'Warnung: Liste aus früherem Stand', <IveoSection {...iveo(id('iveo-warn'), { delivery: 'veraltet', staleSince: '2026-10-08T09:12:00' })} />),
    b('iveo-aus', I, 'aus: nicht eingerichtet', <IveoSection {...iveo(id('iveo-aus'), { bound: false, eventName: undefined, stage: undefined, speakerCount: undefined, delivery: undefined })} />),
    b('iveo-unbekannt', I, 'unbekannt: keine Rückmeldung', <IveoSection {...iveo(id('iveo-unbekannt'), { delivery: undefined })} />),
    b('iveo-gesperrt', I, 'gesperrt', <IveoSection {...iveo(id('iveo-gesperrt'), { locked: MASTER })} />),
    b('iveo-fehlertext', I, 'mit Fehlertext', <IveoSection {...iveo(id('iveo-fehlertext'), { error: 'Show-Datei nicht lesbar.' })} />),

    b('datalink-ok', D, 'ok: 5 Dateien', <DataLinkSection {...datalink(id('datalink-ok'), {})} />),
    b('datalink-warn', D, 'Warnung: keine Datei', <DataLinkSection {...datalink(id('datalink-warn'), { fileCount: 0, lastChange: undefined })} />),
    b('datalink-error', D, 'Fehler: Ordner fehlt', <DataLinkSection {...datalink(id('datalink-error'), { folderMissing: true, fileCount: undefined, lastChange: undefined })} />),
    b('datalink-unbekannt', D, 'unbekannt: Ordner noch nicht gelesen', <DataLinkSection {...datalink(id('datalink-unbekannt'), { fileCount: undefined, lastChange: undefined })} />),
    b('datalink-aus', D, 'aus: kein Ordner', <DataLinkSection {...datalink(id('datalink-aus'), { folder: '', fileCount: undefined, lastChange: undefined })} />),
    b(
      'datalink-gesperrt',
      D,
      'gesperrt: Show vom Master (Titler-Muster mit Quellzeile, Hinweis, Zurück)',
      <DataLinkSection
        {...datalink(id('datalink-gesperrt'), {
          locked: MASTER,
          sourceLine: 'Quelle: Show vom Master (iveo-Daten)',
          notice: 'Die Liste kommt vom Master. Eigene Dateien sind ausgeblendet.',
          backLabel: 'Zurück zum eigenen Ordner',
          onBack: nichts,
        })}
      />,
    ),
    b('datalink-fehlertext', D, 'mit Fehlertext', <DataLinkSection {...datalink(id('datalink-fehlertext'), { error: 'Ordner nicht lesbar.' })} />),

    b('gegenstellen-ok', G, 'ok: alle verbunden (gefunden per mDNS)', <PeersSection {...gegenstellen(id('gegenstellen-ok'), {})} />),
    b('gegenstellen-warn', G, 'Warnung: manuell gesetzt, nicht verbunden', <PeersSection {...gegenstellen(id('gegenstellen-warn'), { peers: [GEGENSTELLEN[0], { ...GEGENSTELLEN[1], host: '10.0.0.12', connected: false, source: 'manual' }] })} />),
    b('gegenstellen-unbekannt', G, 'unbekannt: keine Rückmeldung', <PeersSection {...gegenstellen(id('gegenstellen-unbekannt'), { peers: [GEGENSTELLEN[0], { ...GEGENSTELLEN[1], connected: undefined }] })} />),
    b('gegenstellen-aus', G, 'aus: keine Gegenstellen', <PeersSection {...gegenstellen(id('gegenstellen-aus'), { peers: [] })} />),
    b(
      'gegenstellen-schalter',
      G,
      'Stage-Display-Muster: ein/aus je Zeile, ohne Auto',
      <PeersSection
        {...gegenstellen(id('gegenstellen-schalter'), {
          capabilities: { toggle: true },
          peers: [
            { role: 'links', label: 'Bühne links', host: '10.0.0.21', port: 7790, enabled: true, connected: true },
            { role: 'rechts', label: 'Bühne rechts', host: '10.0.0.22', port: 7790, enabled: false },
          ],
        })}
      />,
    ),
    b('gegenstellen-gesperrt', G, 'gesperrt', <PeersSection {...gegenstellen(id('gegenstellen-gesperrt'), { locked: MASTER })} />),
    b('gegenstellen-fehlertext', G, 'mit Fehlertext', <PeersSection {...gegenstellen(id('gegenstellen-fehlertext'), { error: 'Suche im Netz nicht möglich.' })} />),
  ];
}
```

Datei `packages/ui/galerie/ShellSeite.tsx`:
```tsx
// Rahmen-Seite der Galerie: eine AppShell fensterfüllend, aufgerufen mit
// `?ansicht=shell&modus=dark|light&panel=0|1&dichte=normal|kompakt`. Die Übersicht bettet sie in iframes mit 1200 px
// und 800 px Breite ein; unter 900 px greift die Schmal-Ansicht (E7: Medienabfrage auf die Fensterbreite, im iframe
// also auf dessen Breite).
import { useState } from 'react';
import { AppShell, TallyButton, type StatusItem } from '../src/index';
import {
  abschnittStatusItem,
  dataLinkView,
  DataLinkSection,
  iveoView,
  IveoSection,
  ndiOutputView,
  NdiOutputSection,
  remoteControlView,
  RemoteControlSection,
} from '../../settings/src/index';
import { SHELL_ABSCHNITTE } from './beispiele-settings';

export interface ShellParameter {
  modus: 'dark' | 'light';
  panel: boolean;
  dichte: 'normal' | 'kompakt';
  /** false = Zustand ohne Sitzung (Spec 3.8): leere Statusleiste mit Uhr, keine Einstellungen, kein ⚙. */
  sitzung: boolean;
}

/** Liest die Parameter der Rahmen-Seite; fremde Werte → Dunkel, Panel zu, normal, mit Sitzung. */
export function leseShellParameter(p: URLSearchParams): ShellParameter {
  return {
    modus: p.get('modus') === 'light' ? 'light' : 'dark',
    panel: p.get('panel') === '1',
    dichte: p.get('dichte') === 'kompakt' ? 'kompakt' : 'normal',
    sitzung: p.get('sitzung') !== '0',
  };
}

/** Adresse der Rahmen-Seite (relativ, für das src eines iframes). */
export function shellAdresse(p: ShellParameter): string {
  return `?ansicht=shell&modus=${p.modus}&panel=${p.panel ? '1' : '0'}&dichte=${p.dichte}&sitzung=${p.sitzung ? '1' : '0'}`;
}

export function ShellSeite(p: ShellParameter): React.JSX.Element {
  const [offen, setOffen] = useState(p.panel);
  const [abschnitt, setAbschnitt] = useState<string | undefined>(p.panel ? SHELL_ABSCHNITTE.fernsteuerung.id : undefined);
  const [live, setLive] = useState(false);
  // Die Statusleiste entsteht aus denselben Ableitungen wie die Pillen im Panel (Spec 6.1, abschnittStatusItem).
  // Ohne Sitzung (Spec 3.8) bleibt sie leer, und es gibt keine Einstellungen.
  const status: StatusItem[] = p.sitzung
    ? [
        abschnittStatusItem(dataLinkView(SHELL_ABSCHNITTE.datalink), { group: 'tool', label: 'DataLink' }),
        abschnittStatusItem(ndiOutputView(SHELL_ABSCHNITTE.ndi), { group: 'ausgabe', label: 'NDI' }),
        abschnittStatusItem(iveoView(SHELL_ABSCHNITTE.iveo), { group: 'verbindung', label: 'iveo' }),
        abschnittStatusItem(remoteControlView(SHELL_ABSCHNITTE.fernsteuerung), { group: 'fernsteuerung', label: 'Companion' }),
      ]
    : [];
  // Die Klasse dark/light sitzt auf dem eigenen Wurzel-div, nicht auf <html>: ThemeToggle in der Kopfzeile schaltet
  // <html> um, die Ansicht soll aber fest im verlangten Modus bleiben.
  return (
    <div className={p.modus === 'light' ? 'light bg-[var(--background)] text-[var(--foreground)]' : 'dark bg-[var(--background)] text-[var(--foreground)]'}>
      <AppShell
        tool="Titler"
        headerCenter={<span className="truncate text-xs text-[var(--muted-foreground)]">Show: Fachtagung 2026 · vom Master</span>}
        onAir={{ live }}
        status={status}
        toolbar={<div className="flex items-center gap-2 px-4 py-2 text-xs text-[var(--muted-foreground)]">Vorlage: Bauchbinde zweizeilig</div>}
        settings={
          p.sitzung ? (
            <>
              <NdiOutputSection {...SHELL_ABSCHNITTE.ndi} />
              <RemoteControlSection {...SHELL_ABSCHNITTE.fernsteuerung} />
              <IveoSection {...SHELL_ABSCHNITTE.iveo} />
              <DataLinkSection {...SHELL_ABSCHNITTE.datalink} />
            </>
          ) : undefined
        }
        settingsOpen={offen}
        settingsSection={abschnitt}
        onSettingsChange={(open, id) => {
          setOffen(open);
          setAbschnitt(id);
        }}
        dichte={p.dichte}
      >
        <div className="grid grid-cols-2 gap-3 p-4" style={{ maxWidth: 640 }}>
          <TallyButton state={live ? 'live' : 'bereit'} label="Take" shortcut="Enter" onClick={() => setLive(true)} />
          <TallyButton
            state={live ? 'bereit' : 'gesperrt'}
            label="Clear"
            disabledReason="Nichts auf Sendung"
            onClick={() => setLive(false)}
          />
        </div>
      </AppShell>
    </div>
  );
}
```

Datei `packages/ui/galerie/Galerie.tsx`:
```tsx
// Galerie (Spec 3.10): jeder Baustein aus @jm/ui und jeder Abschnitt aus @jm/settings, links Dunkel, rechts Hell,
// darunter der ganze Rahmen in 1200 px und 800 px Breite (Schmal-Ansicht, E7).
import { settingsBeispiele } from './beispiele-settings';
import { uiBeispiele, type Beispiel, type Modus } from './beispiele-ui';
import { shellAdresse, type ShellParameter } from './ShellSeite';

export const RAHMEN_ANSICHTEN: ReadonlyArray<{ breite: number; parameter: ShellParameter; titel: string }> = [
  { breite: 1200, parameter: { modus: 'dark', panel: true, dichte: 'normal', sitzung: true }, titel: '1200 px · Dunkel · Panel offen' },
  { breite: 1200, parameter: { modus: 'light', panel: false, dichte: 'normal', sitzung: true }, titel: '1200 px · Hell · Panel zu' },
  { breite: 800, parameter: { modus: 'dark', panel: true, dichte: 'kompakt', sitzung: true }, titel: '800 px · Dunkel · Panel über dem Inhalt · kompakt' },
  { breite: 800, parameter: { modus: 'light', panel: true, dichte: 'normal', sitzung: true }, titel: '800 px · Hell · Panel über dem Inhalt' },
  { breite: 1200, parameter: { modus: 'dark', panel: false, dichte: 'normal', sitzung: false }, titel: '1200 px · Dunkel · ohne Sitzung (leere Statusleiste, kein ⚙)' },
];

/** Gruppen in der Reihenfolge ihres ersten Auftretens. */
function gruppiere(liste: Beispiel[]): Array<[string, Beispiel[]]> {
  const gruppen = new Map<string, Beispiel[]>();
  for (const b of liste) gruppen.set(b.gruppe, [...(gruppen.get(b.gruppe) ?? []), b]);
  return [...gruppen.entries()];
}

function Spalte({ modus }: { modus: Modus }): React.JSX.Element {
  const gruppen = gruppiere([...uiBeispiele(modus), ...settingsBeispiele(modus)]);
  return (
    <section
      data-modus={modus}
      aria-label={modus === 'dark' ? 'Dunkel' : 'Hell'}
      className={modus === 'dark' ? 'dark min-w-0 space-y-8 bg-[var(--background)] p-6 text-[var(--foreground)]' : 'light min-w-0 space-y-8 bg-[var(--background)] p-6 text-[var(--foreground)]'}
    >
      <h2 className="text-sm font-extrabold">{modus === 'dark' ? 'Dunkel (Standard)' : 'Hell'}</h2>
      {gruppen.map(([gruppe, liste]) => (
        <section key={gruppe} className="space-y-3">
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{gruppe}</h3>
          <div className="flex flex-wrap items-start gap-4">
            {liste.map((b) => (
              <figure key={b.name} data-beispiel={b.name} className="m-0 min-w-[240px] max-w-full space-y-1.5">
                <figcaption className="text-[11px] text-[var(--muted-foreground)]">{b.titel}</figcaption>
                {b.element}
              </figure>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}

export function Galerie(): React.JSX.Element {
  return (
    <div className="min-w-[1180px] bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-extrabold">Galerie · @jm/ui und @jm/settings</h1>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          Jeder Baustein in jedem Zustand, links Dunkel, rechts Hell. Die Abschnitte zeigen feste Zustände, ihre Knöpfe
          tun nichts. Unten der Rahmen in 1200 px und 800 px Breite.
        </p>
      </header>
      <div className="grid grid-cols-2">
        <Spalte modus="dark" />
        <Spalte modus="light" />
      </div>
      <section aria-labelledby="galerie-rahmen" className="space-y-4 border-t border-[var(--border)] px-6 py-6">
        <h2 id="galerie-rahmen" className="text-sm font-extrabold">
          Rahmen (AppShell) in 1200 px und 800 px
        </h2>
        <div className="flex flex-wrap gap-6">
          {RAHMEN_ANSICHTEN.map((r) => (
            <figure key={r.titel} className="m-0 space-y-1.5">
              <figcaption className="text-[11px] text-[var(--muted-foreground)]">{r.titel}</figcaption>
              <iframe
                title={r.titel}
                src={shellAdresse(r.parameter)}
                width={r.breite}
                height={560}
                className="rounded-[var(--radius-lg)] border border-[var(--border)]"
              />
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
```

Datei `packages/ui/galerie/pruefe-klassen.ts`:
```ts
// Klassen-Probe (Spec 3.10, Review Focus 1): Kommen die neuen Tokens und die Pflichtklassen der Bausteine im
// gebauten CSS an? Tailwind erzeugt eine Klasse nur, wenn es sie in einer gescannten Datei als Text findet
// (`@source`). Ein Tippfehler, ein zusammengesetzter Klassenname oder eine Datei außerhalb der Quellen fällt erst
// hier auf; im Fenster wäre der Baustein nur still ungestylt.
//
// Aufrufe (Arbeitsverzeichnis packages/ui):
//   npm run galerie:pruefen -w @jm/ui                               Galerie bauen, galerie/dist/assets/*.css prüfen
//   npx tsx galerie/pruefe-klassen.ts --css <ordner> --ohne-settings  CSS eines App-Renderers prüfen (Task 24)
//
// Diese Datei ist in galerie.css per `@source not` vom Tailwind-Scan ausgenommen: Gescannt, erzeugte Tailwind die
// gesuchten Klassen aus den Listen unten selbst, und die Probe bestünde immer.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { abschluss, ok } from '../test/harness';

/** Die zwölf neuen Token-Namen (Spec 4.2, 4.3). */
export const NEUE_TOKENS = [
  '--tally-live',
  '--tally-ready',
  '--tally-selected',
  '--status-warn',
  '--status-error',
  '--status-off',
  '--surface-raised',
  '--header-h',
  '--statusbar-h',
  '--control-h',
  '--control-h-lg',
  '--panel-w',
] as const;

/** Pflichtklassen der Bausteine (Plan 9.7 und G7). */
export const PFLICHTKLASSEN = [
  'h-[var(--statusbar-h)]',
  'h-[var(--header-h)]',
  'h-[var(--control-h)]',
  'min-h-[var(--control-h-lg)]',
  'w-[var(--panel-w)]',
  'bg-[var(--surface-raised)]',
  'bg-[var(--tally-live)]',
  'border-[var(--tally-ready)]',
  'text-[19px]',
  'max-[900px]:sr-only',
  'max-[900px]:absolute',
  'select-text',
  'sr-only',
] as const;

/** Klassen, die Tailwind absichtlich ohne eigene Regel lässt (nur Marker für Varianten). */
const OHNE_EIGENE_REGEL = new Set(['group', 'peer']);

/** Selektoren ohne CSS-Escapes: `.h-\[var\(--x\)\]` → `.h-[var(--x)]`. */
export function selektorText(css: string): string {
  return css.replace(/\\/g, '');
}

/** Steht `klasse` als Klassenselektor im CSS (nicht nur als Anfang einer längeren Klasse)? */
export function hatKlasse(css: string, klasse: string): boolean {
  const flach = selektorText(css);
  const gesucht = `.${klasse}`;
  for (let ab = flach.indexOf(gesucht); ab >= 0; ab = flach.indexOf(gesucht, ab + 1)) {
    const danach = flach.charAt(ab + gesucht.length);
    if (danach === '' || /[\s{,:.>+~)[]/.test(danach)) return true;
  }
  return false;
}

/** Wird `name` im CSS definiert (`--name:`), nicht nur benutzt (`var(--name)`)? */
export function hatToken(css: string, name: string): boolean {
  return new RegExp(`(^|[{;\\s])${name.replace(/[-]/g, '\\-')}:`).test(css);
}

/**
 * Medienabfrage der Variante `max-[900px]:`. Tailwind 4.3 schreibt `@media (width < 900px)`; der Minifizierer im
 * `vite build` macht daraus `@media not all and (min-width:900px)` (gemessen am 08.10.2026). Beide Formen zählen.
 */
export function hatSchmalAbfrage(css: string): boolean {
  const ohne = css.replace(/\s+/g, '');
  return ohne.includes('@media(width<900px)') || ohne.includes('@medianotalland(min-width:900px)');
}

/**
 * Regel der kompakten Dichte. Der Galerie-Bau minifiziert (`[data-dichte=kompakt]{`), der Renderer-Bau der Apps mit
 * electron-vite nicht (`[data-dichte="kompakt"] {`); beides gemessen am 08.10.2026.
 */
export function hatKompaktRegel(css: string): boolean {
  return /\[data-dichte=("?)kompakt\1\]\s*\{/.test(css);
}

/** Medienabfrage der Variante `motion-safe:`. */
export function hatBewegungAbfrage(css: string): boolean {
  return css.replace(/\s+/g, '').includes('@media(prefers-reduced-motion:no-preference)');
}

/** Klassen aus `className="…"`-Literalen (nicht aus `cn(…)` oder Ausdrücken). */
export function classNameLiterale(quelltext: string): string[] {
  const klassen: string[] = [];
  for (const m of quelltext.matchAll(/className="([^"]*)"/g)) klassen.push(...m[1].split(/\s+/).filter(Boolean));
  return klassen;
}

function tsxDateien(ordner: string): string[] {
  return (readdirSync(ordner, { recursive: true }) as string[])
    .filter((d) => d.endsWith('.tsx'))
    .map((d) => join(ordner, d));
}

function klassenAus(ordner: string): Set<string> {
  const menge = new Set<string>();
  for (const datei of tsxDateien(ordner)) {
    for (const k of classNameLiterale(readFileSync(datei, 'utf8'))) if (!OHNE_EIGENE_REGEL.has(k)) menge.add(k);
  }
  return menge;
}

export interface ProbeOptionen {
  /** Ordner mit den gebauten CSS-Dateien. */
  cssOrdner: string;
  /** Auch die Klassen aus packages/settings/src verlangen (Galerie: ja, App ohne @source dorthin: nein). */
  mitSettings: boolean;
}

export function pruefeKlassen(o: ProbeOptionen): void {
  const paket = fileURLToPath(new URL('..', import.meta.url));
  let dateien: string[] = [];
  try {
    dateien = readdirSync(o.cssOrdner).filter((d) => d.endsWith('.css'));
  } catch {
    dateien = [];
  }
  ok(dateien.length > 0, `Klassen-Probe: CSS in ${o.cssOrdner} (${dateien.join(', ') || 'keine Datei'})`);
  const css = dateien.map((d) => readFileSync(join(o.cssOrdner, d), 'utf8')).join('\n');

  const ohneToken = NEUE_TOKENS.filter((t) => !hatToken(css, t));
  ok(ohneToken.length === 0, `Klassen-Probe: ${NEUE_TOKENS.length} neue Tokens definiert${ohneToken.length ? ` – fehlt: ${ohneToken.join(', ')}` : ''}`);
  ok(hatKompaktRegel(css), 'Klassen-Probe: Regel [data-dichte="kompakt"] vorhanden');
  for (const k of PFLICHTKLASSEN) ok(hatKlasse(css, k), `Klassen-Probe: Pflichtklasse ${k}`);
  ok(hatSchmalAbfrage(css), 'Klassen-Probe: Medienabfrage für max-[900px] (Schmal-Ansicht)');
  ok(hatBewegungAbfrage(css), 'Klassen-Probe: Medienabfrage für motion-safe');

  const ui = klassenAus(join(paket, 'src'));
  const uiFehlt = [...ui].filter((k) => !hatKlasse(css, k));
  ok(uiFehlt.length === 0, `Klassen-Probe: ${ui.size} Klassen aus className="…" in packages/ui/src im CSS${uiFehlt.length ? ` – fehlt: ${uiFehlt.join(' ')}` : ''}`);
  if (o.mitSettings) {
    const settings = klassenAus(resolve(paket, '../settings/src'));
    const fehlt = [...settings].filter((k) => !hatKlasse(css, k));
    ok(fehlt.length === 0, `Klassen-Probe: ${settings.size} Klassen aus className="…" in packages/settings/src im CSS${fehlt.length ? ` – fehlt: ${fehlt.join(' ')}` : ''}`);
    // Tailwind scannt Text, nicht nur className: verglichen wird mit dem ganzen Quelltext von ui/src und Galerie.
    const anderswo = [
      ...(readdirSync(join(paket, 'src'), { recursive: true }) as string[]).map((d) => join(paket, 'src', d)),
      ...readdirSync(join(paket, 'galerie')).filter((d) => d !== 'pruefe-klassen.ts').map((d) => join(paket, 'galerie', d)),
    ]
      .filter((d) => /\.(tsx?|html)$/.test(d))
      .map((d) => readFileSync(d, 'utf8'))
      .join('\n');
    // Ganze Wörter vergleichen: „pl-2“ steht als Text auch in „pl-20“, ist aber eine andere Klasse.
    const woerter = new Set(anderswo.split(/[\s"'`]+/));
    const nurSettings = [...settings].filter((k) => !woerter.has(k));
    console.log(`Hinweis: ${nurSettings.length} davon stehen nur in packages/settings/src (${nurSettings.join(' ') || '–'}); nur sie zeigen ein fehlendes @source "../../settings/src".`);
  }
}

const direkt = process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (direkt) {
  const argumente = process.argv.slice(2);
  const i = argumente.indexOf('--css');
  const cssOrdner = i >= 0 && argumente[i + 1] ? resolve(argumente[i + 1]) : fileURLToPath(new URL('./dist/assets', import.meta.url));
  pruefeKlassen({ cssOrdner, mitSettings: !argumente.includes('--ohne-settings') });
  abschluss();
}
```

- [ ] **Step 4: Test laufen lassen (rot: JSX der Abschnitte)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
```
Erwartet: Zuerst laufen die `ok`-Zeilen der Tasks 1–22, danach elf `ok`-Zeilen aus `galerie.test.tsx` (vier Namenslisten,
sieben Abschnitte). Beim ersten Render eines Abschnitts bricht der Lauf ab, `Exit=1`:
```
ReferenceError: React is not defined
    at NdiOutputSection (…\packages\settings\src\abschnitte\NdiOutputSection.tsx:…)
```
Ursache (gemessen): tsx liest die `tsconfig.json` im cwd (`packages/ui`) und wendet `"jsx": "react-jsx"` nur auf Dateien an,
die deren `include` erfasst. `packages/settings/src` liegt außerhalb, also kompiliert tsx dort klassisches JSX.

- [ ] **Step 5: `packages/ui/tsconfig.json` – `include` ergänzen**

Vorher:
```json
  "include": ["src", "test", "galerie", "vite.config.ts"]
```
Nachher:
```json
  "include": ["src", "test", "galerie", "vite.config.ts", "../settings/src"]
```

- [ ] **Step 6: Test laufen lassen (grün)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
```
Erwartet: keine `FAIL`-Zeile, letzte Zeile `ALLE TESTS OK`, `Exit=0`. `galerie.test.tsx` trägt genau 127 `ok`-Zeilen bei:
4 Namenslisten, 7 Abschnitte, 55 Abschnitts-Beispiele, 1 Launcher-Token, 1 Pegel je Wahl, 26 Baustein-Beispiele,
1 Panel-Anker, 10 Seiten- und Rahmenprüfungen, 7 Rahmen-Seite, 10 Probe, 5 Quellregeln und Electron. Gesamtzahl
(gemessen) = 393 nach Task 22 + 127 = **520** `ok`-Zeilen. Unter anderem:
```
ok   Galerie dark: alle 35 Baustein-Beispiele
ok   Galerie dark: alle 55 Abschnitts-Beispiele
ok   Galerie: Abschnitt ndi zeigt ok, Warnung, Fehler, aus/unbekannt, gesperrt und Fehlertext
ok   Abschnitts-Beispiel fernsteuerung-unbekannt: Statuspille off
ok   Launcher-Vollform: das frisch erzeugte Beispiel-Token ist sichtbar
ok   Abschnitts-Beispiel audio-drei-wahlen: Pegel je Wahl, auch für den Ausgang (E26)
ok   Baustein-Beispiel tally-gesperrt-ohne-grund: aria-disabled="true" · gesperrt – kein Grund angegeben
ok   Baustein-Beispiel tally-halten: in 2 s sperren (dabei halten) · in 2 s ausblenden (dabei halten) · wieder einblenden
ok   Baustein-Beispiel eingabe-zahl: Werte unter 1024 lehnt dieses Beispiel ab
ok   Galerie: jedes der 90 Beispiele genau einmal je Spalte
ok   Galerie: keine id doppelt (Anker beider Spalten getrennt)
ok   Galerie: Rahmen in 1200 px und 800 px (schmal), je Dunkel und Hell, dazu der Rahmen ohne Sitzung
ok   ShellSeite hell, Panel offen, kompakt: Klasse light, data-dichte, Panel mit hervorgehobenem Abschnitt
ok   ShellSeite ohne Sitzung: leere Statusleiste mit Uhr, kein ⚙, kein Panel (Spec 3.8)
ok   Probe: h-[var(--control-h-lg)] zählt nicht als h-[var(--control-h)]
ok   Galerie-Quelltext ohne Pflichtklassen (sonst verdeckte er ein fehlendes @source "../src")

ALLE TESTS OK
```
Meldet „Galerie: keine id doppelt“ einen Fehler, rendert ein Abschnitt mehrere Bedienelemente in einem `Field`. Jedes davon
holt sich dann die id des Felds. Gemessen mit einer vorläufigen `PeersSection`, die Host, Port und Schalter in ein `Field`
legte: 2 doppelte ids je Beispiel. Korrigiert wird der Abschnitt aus Task 22, nicht die Galerie. (Mit dem `PeersSection` aus
Task 22 ist der Fall grün, gemessen beim Zusammensetzen.)

- [ ] **Step 7: Skripte und devDependencies** (`packages/ui/package.json`, `package-lock.json`)

Ersetzung 1 (`scripts`), Vorher:
```json
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "selftest": "tsx test/selftest.ts"
  },
```
Nachher:
```json
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "selftest": "tsx test/selftest.ts",
    "galerie": "vite",
    "galerie:bauen": "vite build",
    "galerie:pruefen": "vite build && tsx galerie/pruefe-klassen.ts"
  },
```

Ersetzung 2 (`devDependencies`; G12-Spannen, alphabetisch wie npm schreibt), Vorher:
```json
  "devDependencies": {
    "@types/node": "^22.7.5",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  }
```
Nachher:
```json
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@types/node": "^22.7.5",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwindcss": "^4.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vite": "^5.4.10"
  }
```
Von Hand eintragen, **nicht** mit `npm install -D …`. Gemessen: `npm install -D <paket>@<spanne> -w @jm/ui` löst die
genannten Pakete neu auf. Dabei hebt es die gemeinsamen Wurzel-Versionen aller Apps an (gemessen bei Task 1:
`tsx` 4.22.4 → 4.23.15, `@types/node` 22.19.19 → 22.20.4, `@types/react` 18.3.30 → 18.3.31) und schreibt `^<neueste>` ins
`package.json`. Dann nur den Lockfile nachziehen:
```
npm install --ignore-scripts --package-lock-only --offline; echo "Exit=$?"
git diff --stat package-lock.json
node -e "const P=require('./package-lock.json').packages;console.log(JSON.stringify(P['packages/ui'].devDependencies));console.log(['vite','@vitejs/plugin-react','tailwindcss','@tailwindcss/vite'].map(x=>x+'@'+P['node_modules/'+x].version).join(' '));console.log('unter packages/ui:',Object.keys(P).filter(k=>k.startsWith('packages/ui/node_modules')).length)"
```
Erwartet (gemessen in einer abgetrennten Kopie ohne `node_modules`, Lockfile im Stand nach Task 1):
```
found 0 vulnerabilities
Exit=0
 package-lock.json | 6 +++++-
 1 file changed, 5 insertions(+), 1 deletion(-)
{"@tailwindcss/vite":"^4.0.0","@types/node":"^22.7.5","@types/react":"^18.3.12","@types/react-dom":"^18.3.1","@vitejs/plugin-react":"^4.3.3","react":"^18.3.1","react-dom":"^18.3.1","tailwindcss":"^4.0.0","tsx":"^4.19.2","typescript":"^5.6.3","vite":"^5.4.10"}
vite@5.4.21 @vitejs/plugin-react@4.7.0 tailwindcss@4.3.0 @tailwindcss/vite@4.3.0
unter packages/ui: 0
```
Der Diff ist genau dieser Hunk im Eintrag `"packages/ui"`, sonst nichts:
```diff
       "devDependencies": {
+        "@tailwindcss/vite": "^4.0.0",
         "@types/node": "^22.7.5",
         "@types/react": "^18.3.12",
         "@types/react-dom": "^18.3.1",
+        "@vitejs/plugin-react": "^4.3.3",
         "react": "^18.3.1",
         "react-dom": "^18.3.1",
+        "tailwindcss": "^4.0.0",
         "tsx": "^4.19.2",
-        "typescript": "^5.6.3"
+        "typescript": "^5.6.3",
+        "vite": "^5.4.10"
       },
```
Zeigt der Diff mehr (eine Version unter `node_modules/…`, ein Eintrag unter `packages/ui/node_modules`), ist die Aufgabe nicht
fertig. Dann `git checkout -- package-lock.json`, die Spannen mit `apps/titler/package.json` vergleichen und erneut laufen
lassen. `--package-lock-only` schreibt nur `package-lock.json` und das versteckte `node_modules/.package-lock.json` (G12);
Paketordner unter `node_modules` bleiben unberührt (alle vier Pakete liegen schon gehoben an der Wurzel).

- [ ] **Step 8: Klassen-Probe: erst ohne Bau (rot), dann mit Bau (grün)**

```
(cd packages/ui && npx tsx galerie/pruefe-klassen.ts); echo "Exit=$?"
```
Erwartet ohne `galerie/dist`: 20 `FAIL`-Zeilen, die erste davon `FAIL Klassen-Probe: CSS in …\packages\ui\galerie\dist\assets (keine Datei)`.
Danach eine `Hinweis:`-Zeile, dann `20 FEHLGESCHLAGEN` und `Exit=1`. Die 20 Zeilen sind: CSS-Datei, Tokens, Dichte-Regel,
13 Pflichtklassen, 2 Medienabfragen und 2 className-Zeilen. Die Probe meldet also jeden Punkt, wenn nichts gebaut ist.

```
npm run galerie:pruefen -w @jm/ui; echo "Exit=$?"
```
Erwartet: `vite v5.4.21 building for production...`, danach `✓ built in …ms` mit `dist/index.html`,
`dist/assets/index-<hash>.css` (gemessen 36,83 kB) und `dist/assets/index-<hash>.js`. Dann
20 `ok`-Zeilen, eine `Hinweis:`-Zeile, `ALLE TESTS OK`, `Exit=0`:
```
ok   Klassen-Probe: CSS in …\packages\ui\galerie\dist\assets (index-<hash>.css)
ok   Klassen-Probe: 12 neue Tokens definiert
ok   Klassen-Probe: Regel [data-dichte="kompakt"] vorhanden
ok   Klassen-Probe: Pflichtklasse h-[var(--statusbar-h)]
ok   Klassen-Probe: Pflichtklasse h-[var(--header-h)]
ok   Klassen-Probe: Pflichtklasse h-[var(--control-h)]
ok   Klassen-Probe: Pflichtklasse min-h-[var(--control-h-lg)]
ok   Klassen-Probe: Pflichtklasse w-[var(--panel-w)]
ok   Klassen-Probe: Pflichtklasse bg-[var(--surface-raised)]
ok   Klassen-Probe: Pflichtklasse bg-[var(--tally-live)]
ok   Klassen-Probe: Pflichtklasse border-[var(--tally-ready)]
ok   Klassen-Probe: Pflichtklasse text-[19px]
ok   Klassen-Probe: Pflichtklasse max-[900px]:sr-only
ok   Klassen-Probe: Pflichtklasse max-[900px]:absolute
ok   Klassen-Probe: Pflichtklasse select-text
ok   Klassen-Probe: Pflichtklasse sr-only
ok   Klassen-Probe: Medienabfrage für max-[900px] (Schmal-Ansicht)
ok   Klassen-Probe: Medienabfrage für motion-safe
ok   Klassen-Probe: 71 Klassen aus className="…" in packages/ui/src im CSS
ok   Klassen-Probe: 30 Klassen aus className="…" in packages/settings/src im CSS
Hinweis: 6 davon stehen nur in packages/settings/src (border-l-2 pl-2 break-all h-1.5 bg-[var(--tally-ready)] motion-reduce:transition-none); nur sie zeigen ein fehlendes @source "../../settings/src".

ALLE TESTS OK
```
Die Zahlen 71, 30 und 6 sind nach der Nachbesserung mit dem Code der Tasks 8–22 gemessen. Ändert eine spätere Aufgabe
`className`-Literale, ändern sie sich mit; maßgeblich ist dann, dass keine Zeile `FAIL` zeigt.

- [ ] **Step 9: Mutationsprobe (in einer Kopie, nie im Plan-Worktree)**

Kopie anlegen. Der Arbeitsbaum enthält die noch nicht committeten Dateien dieser Aufgabe, deshalb `git ls-files` statt
`git archive`. Shell-Variablen und das Arbeitsverzeichnis überleben im Bash-Werkzeug keinen Aufruf: **Jeder** Block unten
setzt `SP` und `K` selbst. `SP` ist der eigene Scratchpad-Ordner der Sitzung (Systemprompt); `<eigener Scratchpad>` ist
vor dem Lauf durch diesen Pfad zu ersetzen. Steht dort kein vorhandener Ordner, bricht die Kette mit `[ -d "$SP" ]` ab,
bevor etwas angelegt oder gelöscht wird. Anlegen (Plan-Worktree als Arbeitsverzeichnis):
```
SP='<eigener Scratchpad>'; K="$SP/mutation-23"
[ -d "$SP" ] && [ ! -e "$K" ] && mkdir -p "$K" \
  && git ls-files -co --exclude-standard -z | tar --null -T - -cf - | tar -x -C "$K" \
  && MSYS_NO_PATHCONV=1 cmd /c mklink /J "$(cygpath -w "$K/node_modules")" "$(cygpath -w "$PWD/node_modules")" \
  && mkdir -p "$K/packages/settings/node_modules/@jm" \
  && MSYS_NO_PATHCONV=1 cmd /c mklink /J "$(cygpath -w "$K/packages/settings/node_modules/@jm/ui")" "$(cygpath -w "$K/packages/ui")" \
  && mkdir -p "$K/sicherung" \
  && cp "$K/packages/ui/galerie/galerie.css" "$K/packages/ui/src/components/TallyButton.tsx" "$K/packages/ui/galerie/beispiele-ui.tsx" "$K/packages/ui/galerie/beispiele-settings.tsx" "$K/sicherung/" \
  && (cd "$K" && npm run galerie:pruefen -w @jm/ui | tail -2)
```
`MSYS_NO_PATHCONV=1` ist nötig. Mit `cmd //c mklink /J …` meldet `mklink` in Git Bash
`Ungültige Option - "…\node_modules"`, gemessen. Die zweite Junction sorgt dafür, dass `@jm/ui` aus den Abschnitten auf die
Kopie zeigt und nicht über die Wurzel-`node_modules` auf den Plan-Worktree. `sicherung/` hält die vier Dateien, die die
Proben ändern. Erwartet zuerst `ALLE TESTS OK`.

Dann je ein Fehler allein (Edit-Werkzeug in der Kopie), Lauf mit
`SP='<eigener Scratchpad>'; K="$SP/mutation-23"; [ -d "$K/packages/ui" ] && (cd "$K" && npm run galerie:pruefen -w @jm/ui; echo "Exit=$?")`
(bei e, g, h, i: `selftest`, bei f: `typecheck`), danach die Datei aus der Sicherung zurück, z. B.
`SP='<eigener Scratchpad>'; K="$SP/mutation-23"; [ -d "$K/sicherung" ] && cp "$K/sicherung/galerie.css" "$K/packages/ui/galerie/galerie.css"`:

| Probe | Eingriff in der Kopie | Erwartet (gemessen) |
| --- | --- | --- |
| a | in `packages/ui/galerie/galerie.css` die Zeile `@source "../../settings/src";` löschen | `npm run galerie:pruefen` → genau eine `FAIL`-Zeile mit den Klassen aus dem `Hinweis:` (Step 8), `1 FEHLGESCHLAGEN`. Gemessen: `FAIL Klassen-Probe: 30 Klassen aus className="…" in packages/settings/src im CSS – fehlt: border-l-2 pl-2 break-all h-1.5 bg-[var(--tally-ready)] motion-reduce:transition-none`. Nennt der `Hinweis:` 0 Klassen, kann die Probe ein fehlendes `@source` für settings nicht zeigen; das gehört in den Bericht. |
| b | in `galerie.css` die Zeile `@source "../src";` löschen | Alle Pflichtklassen, die nicht auch in `packages/settings/src` stehen, beide Medienabfragen und die className-Zeile von `packages/ui/src` melden `FAIL`. Gemessen: `15 FEHLGESCHLAGEN` (12 Pflichtklassen, 2 Medienabfragen, className-Zeile); `select-text` blieb grün, weil es auch in einem Abschnitt steht (`SectionFrame`). |
| c | wie b, dazu die Zeile `@source not "./pruefe-klassen.ts";` löschen | Die Pflichtklassen sind wieder „da“, obwohl `../src` nicht gescannt wird; Tailwind erzeugt sie aus der Liste in der Probe selbst. Gemessen: nur `2 FEHLGESCHLAGEN` (motion-safe, className-Zeile). Darum steht das `@source not` da. |
| d | in `packages/ui/src/components/TallyButton.tsx` `min-h-[var(--control-h-lg)]` → `min-h-[var(--control-hlg)]` | `FAIL Klassen-Probe: Pflichtklasse min-h-[var(--control-h-lg)]`, `1 FEHLGESCHLAGEN` |
| e | in `packages/ui/galerie/beispiele-ui.tsx` einen Kommentar `// w-[var(--panel-w)]` ergänzen | `npm run selftest -w @jm/ui` → `FAIL Galerie-Quelltext ohne Pflichtklassen …` mit `ist: ["beispiele-ui.tsx: w-[var(--panel-w)]"]`. Gemessen beim Schreiben, weil der erste Entwurf dieser Datei die Klassen im Kopfkommentar nannte. |
| f | in `beispiele-settings.tsx` `sourceName: 'JM Titler',` → `sourceName: 3,` | `npm run typecheck -w @jm/ui` → `galerie/beispiele-settings.tsx(51,5): error TS2322: Type 'number' is not assignable to type 'string'.` (Zeile mit dem Stand dieses Plans) |
| g | in `beispiele-ui.tsx` den Knopf „in 2 s ausblenden (dabei halten)“ (`<Button` … `</Button>`) löschen | `npm run selftest -w @jm/ui` → `FAIL Baustein-Beispiel tally-halten: in 2 s sperren (dabei halten) · in 2 s ausblenden (dabei halten) · wieder einblenden`, `1 FEHLGESCHLAGEN` (zweite Nachbesserung) |
| h | in `beispiele-settings.tsx` `value: 'out-2', levelDb: -12 }),` → `value: 'out-2' }),` | `npm run selftest -w @jm/ui` → `FAIL Abschnitts-Beispiel audio-drei-wahlen: Pegel je Wahl, auch für den Ausgang (E26)`, `1 FEHLGESCHLAGEN` |
| i | in `beispiele-ui.tsx` den Satz „ Werte unter 1024 lehnt dieses Beispiel ab (nach 2 s „Noch nicht übernommen.“).“ aus dem Hinweis löschen | `npm run selftest -w @jm/ui` → `FAIL Baustein-Beispiel eingabe-zahl: Werte unter 1024 lehnt dieses Beispiel ab`, `1 FEHLGESCHLAGEN` |

Aufräumen, nur so: erst die Junctions einzeln entfernen, dann prüfen, dass keine mehr übrig ist, dann den Rest (ein Aufruf,
eigenes `SP`/`K`, kein `cd -`):
```
SP='<eigener Scratchpad>'; K="$SP/mutation-23"
[ -d "$K" ] \
  && { [ ! -e "$K/packages/settings/node_modules/@jm/ui" ] || MSYS_NO_PATHCONV=1 cmd /c rmdir "$(cygpath -w "$K/packages/settings/node_modules/@jm/ui")"; } \
  && { [ ! -e "$K/node_modules" ] || MSYS_NO_PATHCONV=1 cmd /c rmdir "$(cygpath -w "$K/node_modules")"; } \
  && [ ! -e "$K/node_modules" ] && [ -z "$(MSYS_NO_PATHCONV=1 cmd /c dir /AL /S /B "$(cygpath -w "$K")" 2>/dev/null)" ] \
  && rm -rf "${K:?}" && echo "Kopie weg" && ls node_modules/.package-lock.json
```
Erwartet: `Kopie weg` und `node_modules/.package-lock.json` (Ziel der Junction unberührt). Fehlt `Kopie weg`, ist nichts
gelöscht worden: Dann steht noch eine Junction (`cmd /c dir /AL /S /B <Kopie>` zeigt sie) oder `SP` zeigt nicht auf den
Scratchpad. Ein leeres `K` kann so nie zu `rm -rf` führen, und die Kontrolle bestätigt nichts, was nicht da ist. Jede
Junction wird nur entfernt, wenn sie da ist: So räumt derselbe Block auch eine Kopie auf, deren Anlegen nach der ersten
Junction abgebrochen ist (das Anlegen verweigert eine stehende Kopie). Gemessen mit einer vollständigen Kopie, mit nur der ersten bzw. nur der zweiten Junction (je `Kopie weg`, Ziel der Junctions unberührt) und mit leerem bzw. nicht ersetztem `SP` (keine Ausgabe, nichts gelöscht).

- [ ] **Step 10: Typprüfung**

```
npm run typecheck -w @jm/ui; echo "Exit=$?"
npm run typecheck -w @jm/settings; echo "Exit=$?"
```
Erwartet: zweimal keine Meldung von `tsc`, `Exit=0`. Die erste prüft jetzt auch `galerie/**`, `vite.config.ts`,
`test/galerie.test.tsx` und über das `include` `packages/settings/src`. Die Gegenprobe steht in Step 9 f.

- [ ] **Step 11: Dev-Server kurz prüfen** (Plan-Worktree, nur `127.0.0.1`, danach beenden)

Starten und abfragen (Git Bash):
```
(npm run galerie -w @jm/ui > /dev/null 2>&1 &)
curl --retry 30 --retry-connrefused --retry-delay 1 -s -o /dev/null -w "start: %{http_code}\n" http://127.0.0.1:5199/
curl -s -o /dev/null -w "shell: %{http_code}\n" "http://127.0.0.1:5199/?ansicht=shell&modus=light&panel=1&dichte=kompakt"
curl -s -o /dev/null -w "main.tsx: %{http_code}\n" http://127.0.0.1:5199/main.tsx
curl -s http://127.0.0.1:5199/galerie.css | grep -o "tally-live" | head -1
```
Erwartet (gemessen):
```
start: 200
shell: 200
main.tsx: 200
tally-live
```
Prüfen und beenden (PowerShell-Werkzeug):
```powershell
Get-NetTCPConnection -LocalPort 5199 -State Listen | Select-Object LocalAddress, LocalPort, OwningProcess
Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 5199 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
if ($null -eq (Get-NetTCPConnection -LocalPort 5199 -State Listen -ErrorAction SilentlyContinue)) { 'Port 5199 frei' } else { 'Port 5199 noch belegt' }
```
Erwartet: eine Zeile `127.0.0.1  5199  <pid>` (nur diese Adresse, kein `0.0.0.0`/`::`), dann `Port 5199 frei`. Gegenprobe
im Bash-Werkzeug: `curl -s -o /dev/null -w "%{http_code}\n" --max-time 3 http://127.0.0.1:5199/` → `000`. Nach dem Beenden
bleibt kein `node`/`npm`-Prozess der Galerie übrig (gemessen). Die Sichtprüfung beider Modi und der Schmal-Ansicht macht
der Owner (siehe „Nach der Umsetzung“).

- [ ] **Step 12: Arbeitsbaum prüfen**

```
git status --short
git check-ignore -v packages/ui/galerie/dist packages/ui/node_modules/.vite/deps/x.js
```
Erwartet: `git status --short` zeigt nur die Dateien dieser Aufgabe, also ` M` für `package-lock.json`,
`packages/ui/package.json`, `packages/ui/test/selftest.ts`, `packages/ui/tsconfig.json` und `??` für `packages/ui/galerie/`,
`packages/ui/test/galerie.test.tsx`, `packages/ui/vite.config.ts`. Fremde Dateien dürfen danebenstehen und bleiben ungestaged.
`galerie/dist` und der Vite-Cache tauchen nicht auf:
```
.gitignore:5:dist	packages/ui/galerie/dist
.gitignore:1:node_modules	packages/ui/node_modules/.vite/deps/x.js
```

- [ ] **Step 13: Commit** (Bash-Werkzeug; Commit-Text ASCII)

```
git add package-lock.json packages/ui/package.json packages/ui/tsconfig.json packages/ui/vite.config.ts packages/ui/test/selftest.ts packages/ui/test/galerie.test.tsx packages/ui/galerie/index.html packages/ui/galerie/main.tsx packages/ui/galerie/galerie.css packages/ui/galerie/beispiele-ui.tsx packages/ui/galerie/beispiele-settings.tsx packages/ui/galerie/ShellSeite.tsx packages/ui/galerie/Galerie.tsx packages/ui/galerie/pruefe-klassen.ts
git status --short
```
Erwartet genau (dazu ggf. Warnungen „LF will be replaced by CRLF“ für die neuen Dateien, harmlos; fremde Dateien als `??`
bzw. ` M` darunter bleiben ungestaged):
```
M  package-lock.json
A  packages/ui/galerie/Galerie.tsx
A  packages/ui/galerie/ShellSeite.tsx
A  packages/ui/galerie/beispiele-settings.tsx
A  packages/ui/galerie/beispiele-ui.tsx
A  packages/ui/galerie/galerie.css
A  packages/ui/galerie/index.html
A  packages/ui/galerie/main.tsx
A  packages/ui/galerie/pruefe-klassen.ts
M  packages/ui/package.json
A  packages/ui/test/galerie.test.tsx
M  packages/ui/test/selftest.ts
M  packages/ui/tsconfig.json
A  packages/ui/vite.config.ts
```
Dann:
```
git commit -m "feat(ui): Galerie - alle Bausteine und Abschnitte in jedem Zustand, Hell und Dunkel" -m "Vite-Galerie unter packages/ui/galerie (npm run galerie -w @jm/ui, nur 127.0.0.1:5199, ohne Electron): zwei Spalten dark/light mit 35 Baustein- und 55 Abschnitts-Beispielen, darunter der Rahmen (AppShell) in iframes mit 1200 und 800 px. @jm/settings wird relativ importiert, galerie.css scannt beide Pakete per @source und nimmt die Klassen-Probe aus. Die Klassen-Probe (npm run galerie:pruefen) prueft Tokens, Pflichtklassen, Medienabfragen und alle className-Literale im gebauten CSS; der Galerie-Test (im Selbsttest, also in der CI) prueft Vollstaendigkeit, Zustaende, ids und die Probe selbst. tsconfig nimmt ../settings/src auf, sonst kompiliert tsx dort klassisches JSX." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- `packages/ui/tsconfig.json` bekommt `"../settings/src"` ins `include` (Gerüst: „include passt schon“). Gemessen: Ohne diese
  Zeile kompiliert tsx die Abschnitte mit klassischem JSX, und der Galerie-Test bricht mit `React is not defined` ab. Dieselbe
  Ursache trifft die Gegenrichtung: Ein Test in `packages/settings` rendert `@jm/ui`-Bausteine nur, wenn deren
  `tsconfig.json` `"../ui/src"` im `include` hat. Das gilt für Task 16, Step 1 („Unklarheit tsx“) und ist dort gemessen:
  ohne die Zeile `ReferenceError: React is not defined`, mit ihr korrektes HTML.
- Neu ist `packages/ui/test/galerie.test.tsx` im Selbsttest (Gerüst: nur Klassen-Probe und Sichtprüfung). Damit sichert die
  CI die Vollständigkeit und Korrektheit der Galerie und die Erkennungskraft der Probe, obwohl der Bau selbst nicht in der CI
  läuft (E21).
- Die Klassen-Probe prüft über das Gerüst hinaus `max-[900px]:sr-only` (vorher `…:hidden`, siehe Task 8), `max-[900px]:absolute`, `select-text` (alle aus 9.7),
  die Regel `[data-dichte="kompakt"]` und alle `className="…"`-Literale. Statt einer festen „nur in settings benutzten“
  Klasse ermittelt sie diese Klassen aus dem Quelltext. Grund: 9.9/9.10 legen keine Klasse der Abschnitte fest.
- `galerie.css` hat zusätzlich `@source not "./pruefe-klassen.ts"`. Ohne diese Zeile erzeugt die Probe ihre Klassen selbst
  (Mutation c).
- Lockfile per Handeintrag und `npm install --ignore-scripts --package-lock-only --offline`, nicht per `npm install -D …`
  (G12). Gemessen: Der G12-Befehl hebt Wurzel-Versionen für alle Apps an. Task 1 weicht gleich ab.
- `vite.config.ts` hat zusätzlich `preview` auf `127.0.0.1:5199`, damit auch ein `vite preview` nur lokal lauscht.
- Beim Zusammensetzen mit dem echten Code aus Block A–C gemessen und zwei Stellen berichtigt (Z4, Z5):
  - `galerie.test.tsx` erkannte den Fehlertext eines Abschnitts an `'⚠ '`. Der echte `SectionFrame` (Task 16) setzt das
    Symbol in ein eigenes `<span aria-hidden="true">⚠</span>`, danach folgt ein Leerzeichen außerhalb des Spans. Die
    sieben Fälle `…-fehlertext` waren deshalb rot. Geprüft wird jetzt das Kennzeichen `data-fehler="true"` aus Task 16.
  - `pruefe-klassen.ts` verglich für den `Hinweis:` mit `includes()` auf dem ganzen Quelltext. `pl-2` (nur in
    `SectionFrame`) galt deshalb als „auch in ui“, weil `AppHeader` `pl-20` enthält. Der Hinweis nannte 4 Klassen, die Probe a
    meldete aber 5 als fehlend. Jetzt werden ganze Wörter verglichen; Hinweis und Probe a nennen dieselben Klassen
    (damals 5, seit der Nachbesserung 6).
- Zweite Nachbesserung (Prüfrunde 2): `HaltenProbe` kann den Knopf während des Haltens ausblenden (Owner-Prüfpunkt 2
  verlangte das, die Galerie bot es nicht an); das Port-Beispiel lehnt Werte unter 1024 ab, damit der Owner „Noch nicht
  übernommen.“ sieht (E27, Owner-Prüfpunkt 3); die Wahl „Ausgabe“ im Interpreter-Muster hat einen Pegel (E26: sonst zeigte
  die Galerie das alte Bild „Pegel nur für Eingänge“). Der Galerie-Test prüft alle drei (je eine Zeile mehr). Die
  Aufräum-Kette in Step 9 entfernt jede Junction nur, wenn sie da ist, und räumt so auch eine halb angelegte Kopie auf.

**Nachgerechnet beim Zusammensetzen** (frische Kopie, alle Tasks 1–22 wörtlich aus diesem Plan eingespielt, dann Task 23):
Step 2 rot mit `ERR_MODULE_NOT_FOUND … galerie\Galerie`; Step 4 rot mit `ReferenceError: React is not defined` in
`NdiOutputSection.tsx`; Step 8 ohne Bau 20 `FAIL`, mit Bau 20 `ok`, Bau unter 1,5 s; Typprüfung beider Pakete grün;
Dev-Server `200`/`200`/`200`, nur `127.0.0.1:5199`, danach Port frei und `000`. Nach der Nachbesserung (Tasks 3–22 und
diese Aufgabe geändert) neu gemessen: Step 4 rot nach 392 `ok` (381 + 11), Step 6 grün mit 505 `ok`, CSS 36,83 kB,
Klassen 71/30/6, Mutationen a 1, b 15, c 2, d 1, e 1 `FAIL`, f `error TS2322` in Zeile 51. Die Aufräum-Kette ist mit leerem
und mit gültigem `SP` gemessen (leer: keine Ausgabe, nichts gelöscht; gültig: `Kopie weg`). **Zweite Nachbesserung**
(HaltenProbe mit Ausblenden, Port-Beispiel lehnt Werte unter 1024 ab, Ausgang mit Pegel, drei neue Prüfzeilen im
Galerie-Test, Aufräum-Kette): Step 2 rot wie angegeben, Step 4 rot nach 404 `ok` (393 + 11), Step 6 grün mit 520 `ok` (127 aus diesem Test); Step 8 ohne Bau 20 `FAIL`, mit Bau 20 `ok`, CSS 36,83 kB mit demselben Hash wie vorher (`index-DVXDjJ73.css`), Klassen 71/30/6. Neue Proben im Galerie-Test (je allein, Selbsttest): ohne „in 2 s ausblenden“ 1 `FAIL`, Ausgang ohne Pegel 1 `FAIL`, Port-Beispiel ohne den Hinweis auf die Ablehnung 1 `FAIL`. Die Proben a–f von Step 9 sind nicht neu gemessen: Das gebaute CSS ist byte-gleich, `galerie.css`, `TallyButton.tsx` und die Zeile 51 von `beispiele-settings.tsx` sind unverändert.

**Nachgerechnet vom Schreiber** (Kopie `scratchpad\ux-plan\kopie-d`, Stand `5a14352934`; Testhilfe, Tokens, `texte.ts`, `status.ts`,
`halten.ts`, `theme.ts`, `eingabe.ts`, alle Bausteine aus 9.7 und alle sieben Abschnitte aus 9.9/9.10 als vorläufige
Nachbauten mit den Schnittstellen und Pflichtklassen aus Abschnitt 9; tsx 4.22.4, Vite 5.4.21, Tailwind 4.3.0, Node 24):
- Step 2 rot mit `ERR_MODULE_NOT_FOUND … galerie\Galerie`.
- Step 4 rot mit `ReferenceError: React is not defined at NdiOutputSection` (nach 11 `ok`).
- Step 6 grün mit 122 `ok` aus `galerie.test.tsx` (nach der Nachbesserung 124, siehe oben).
- Step 8 ohne Bau 20 `FAIL`, mit Bau 20 `ok` und der Hinweis „6 … nur in packages/settings/src“ (Bau in 0,6 s,
  CSS 34,36 kB; mit dem echten Code beim Zusammensetzen 5 Klassen und 36,50 kB, nach den Nachbesserungen die Werte oben).
- Mutationen a–f wie in der Tabelle.
- `npm run typecheck -w @jm/ui` und `-w @jm/settings` grün.
- Dev-Server: `200`/`200`/`200`, nur an `127.0.0.1` gebunden, nach `Stop-Process` Port frei und `000`.
- Im Plan-Worktree `ux-update` entstand nichts: `git status --short` leer, kein `node_modules/.vite`. Der Vite-Cache lag in
  `kopie-d/packages/ui/node_modules/.vite`.
- Die Minifizier-Formen sind gemessen: `.h-\[var\(--statusbar-h\)\]{height:var(--statusbar-h)}`,
  `@media not all and (min-width:900px){.max-\[900px\]\:absolute{…}}`, `[data-dichte=kompakt]{--header-h:36px;--statusbar-h:24px}`.
- Nicht gemessen: Sichtprüfung im Browser. Aussehen und Bedienung in der Galerie prüft der Owner.

---

### Task 24: CI-Schritte und Gesamtprüfung

**Spec:** 11 (neue Selbsttests im CI-Job „Selbsttests“), 4.1 (rein additiv), 15 (Risiko „Token-Wert ändert sich“).
Global Constraints G10, G15; Entscheidung E21. Review Focus 1 und 4.

**Arbeitsverzeichnis/Voraussetzung:** Plan-Worktree, Tasks 1–23 committet. `git status --short` zeigt keine Datei dieses
Plans. Fremde, ungestagte Dateien dürfen dastehen.

**Dateien:**
- Modify: `.github/workflows/ci-checks.yml`, sechs neue Zeilen nach Zeile 70 (`run: npm run selftest -w @jm/app-designer`),
  vor Zeile 71 (`# Zoom Stage 4a …`)

Sonst nur Prüfungen. Die Titler-Probe (Prüfung 5) läuft in einer Kopie im Scratchpad. Im Job `typecheck` ändert sich
nichts: `npm run typecheck --workspaces --if-present` nimmt die Skripte `typecheck` beider Pakete von selbst mit.

**Interfaces:**
- Consumes: Skripte `selftest` und `typecheck` von `@jm/ui` und `@jm/settings` (Task 1, 16). Aus Task 23
  `packages/ui/galerie/pruefe-klassen.ts`, Aufruf `npx tsx galerie/pruefe-klassen.ts --css <ordner> --ohne-settings`.
- Produces: zwei Schritte im Job `selftests`, Namen wörtlich „UI-Bausteine (Bestandsschutz, Tokens, Kontrast, Statusleiste,
  Tally)“ und „Einstellungs-Abschnitte (Ableitungen als Kreuzprodukt)“.

**Verhalten (verbindlich):**
- Der Block ist ein eigener Hunk zwischen „App Designer“ und dem Kommentar `# Zoom Stage 4a` (G15). Zoom 4b hängt hinten nach
  „Connect“ an, Master-Link 2b R2 berührt die Datei laut Ist-Karte nicht. Der Jobname „Selbsttests (Master-Link + Launcher)“
  bleibt, sonst gäbe es eine zweite Änderung am Job.
- Kein Bau in der CI (E21): `vite build` unter `npm ci --ignore-scripts` auf Linux ist nicht gemessen. Die Quellregeln
  (Task 3, 16) und der Galerie-Test (Task 23) sichern dieselbe Fehlerklasse statisch ab.

---

- [ ] **Step 1: Prüfbefehl zuerst (rot)**

```
node -e "const y=require('js-yaml');const d=y.load(require('fs').readFileSync('.github/workflows/ci-checks.yml','utf8'));const n=d.jobs.selftests.steps.map(s=>s.name).filter(Boolean);const i=n.indexOf('App Designer (Raster, Variablen im Store)');console.log(n.slice(i,i+4).join(' | '))"
```
Erwartet heute (gemessen am Spec-Stand), die neuen Schritte fehlen:
```
App Designer (Raster, Variablen im Store) | Zoom-Bridge (Protokoll, Zustand, Attrappe — ohne SDK) | Connect (Zoom-Kern gegen die Attrappe, Laufzeit, Statustexte)
```

- [ ] **Step 2: CI-Block eintragen** (`.github/workflows/ci-checks.yml`, Zeilen 69–71, mit dem Edit-Werkzeug; die Datei hat
  im Arbeitsbaum CRLF)

Vorher:
```yaml
      - name: App Designer (Raster, Variablen im Store)
        run: npm run selftest -w @jm/app-designer
      # Zoom Stage 4a (Spec 12.6). Keiner dieser Tests lädt Electron oder braucht das Zoom-SDK.
```
Nachher:
```yaml
      - name: App Designer (Raster, Variablen im Store)
        run: npm run selftest -w @jm/app-designer
      # Suite-UX-Update Welle 0 (Spec 11): Bausteine und Einstellungs-Abschnitte. Render-Tests mit
      # renderToStaticMarkup unter tsx, ohne Browser und ohne Electron.
      - name: UI-Bausteine (Bestandsschutz, Tokens, Kontrast, Statusleiste, Tally)
        run: npm run selftest -w @jm/ui
      - name: Einstellungs-Abschnitte (Ableitungen als Kreuzprodukt)
        run: npm run selftest -w @jm/settings
      # Zoom Stage 4a (Spec 12.6). Keiner dieser Tests lädt Electron oder braucht das Zoom-SDK.
```

- [ ] **Step 3: Prüfbefehl (grün), Hunk und Zeilenenden**

```
node -e "const y=require('js-yaml');const d=y.load(require('fs').readFileSync('.github/workflows/ci-checks.yml','utf8'));const n=d.jobs.selftests.steps.map(s=>s.name).filter(Boolean);const i=n.indexOf('App Designer (Raster, Variablen im Store)');console.log(n.slice(i,i+4).join(' | '));console.log(d.jobs.selftests.steps.length+' Schritte')"
git diff -U0 .github/workflows/ci-checks.yml | grep "^@@"
node -e "const t=require('fs').readFileSync('.github/workflows/ci-checks.yml','utf8');console.log('CRLF',(t.match(/\r\n/g)||[]).length,'Zeilen',(t.match(/\n/g)||[]).length)"
```
Erwartet (gemessen):
```
App Designer (Raster, Variablen im Store) | UI-Bausteine (Bestandsschutz, Tokens, Kontrast, Statusleiste, Tally) | Einstellungs-Abschnitte (Ableitungen als Kreuzprodukt) | Zoom-Bridge (Protokoll, Zustand, Attrappe — ohne SDK)
18 Schritte
@@ -70,0 +71,6 @@ jobs:
CRLF 112 Zeilen 112
```

- [ ] **Step 4: Gegenprobe YAML** (nur im Speicher, die Datei bleibt unverändert)

```
node -e "const y=require('js-yaml');const t=require('fs').readFileSync('.github/workflows/ci-checks.yml','utf8').replace('        run: npm run selftest -w @jm/ui','       run: npm run selftest -w @jm/ui');try{y.load(t);console.log('lädt')}catch(e){console.log(e.message.split('\n')[0])}"
```
Erwartet (gemessen): `bad indentation of a sequence entry (74:8)`. Der Prüfbefehl aus Step 3 erkennt also einen um eine
Stelle verrutschten Schritt.

- [ ] **Step 5: Gesamtprüfung** (sechs Punkte, Ergebnisse in den Aufgabenbericht)

**5.1 CI-Datei:** erledigt in Step 3.

**5.2 Selbsttests beider Pakete**
```
npm run selftest -w @jm/ui; echo "Exit=$?"
npm run selftest -w @jm/settings; echo "Exit=$?"
```
Erwartet (gemessen): keine `FAIL`-Zeile, je `ALLE TESTS OK` und `Exit=0`; `@jm/ui` **520** `ok`-Zeilen (Task 1–15: 393,
dazu 127 aus `galerie.test.tsx`), `@jm/settings` **329** `ok`-Zeilen (Task 16–22). Keine Zeile `Warning:`. Zusätzlich
`npm run galerie:pruefen -w @jm/ui` → 20 `ok`, `ALLE TESTS OK` (Task 23, Step 8).

**5.3 Typprüfung aller Workspaces**
```
SP='<eigener Scratchpad>'; [ -d "$SP" ] && { npm run typecheck --workspaces --if-present > "$SP/typecheck-alle.log" 2>&1; echo "Exit=$?"; grep -c "^> @jm/[^ ]* typecheck$" "$SP/typecheck-alle.log"; grep -c "error TS" "$SP/typecheck-alle.log"; }
```
Erwartet (gemessen in einer Kopie, in der jedes `@jm/*` auf die Pakete der Kopie zeigte, also auch die Apps die neue
`packages/ui` prüften; Dauer 1,5–2 Minuten): `Exit=0`, `31`, `0`. Die 31 Workspaces sind
`@jm/appkit @jm/master-link @jm/media-library @jm/settings @jm/ui @jm/zoom-bridge`, danach die 25 Apps
`app-designer battle caption connect copy daw editor grafiktool interpreter launcher media-converter ndi-screen-capture player
presenter prompter qa recorder rundown stage-display studio-control switcher sync timer titler transcribe`. Vor diesem Plan
waren es 29. Jede App prüft die neuen `@jm/ui`-Quellen mit, auch Bausteine, die sie gar nicht benutzt, weil `src/index.ts`
sie exportiert. Gegenprobe gemessen: ein Typfehler in `StatusPill.tsx` → `npm run typecheck:web -w @jm/titler` meldet
`../../packages/ui/src/components/StatusPill.tsx(…): error TS2551 …`.

**5.4 Bestandsschutz im Gesamtstand**
```
git diff 5a14352934 --stat -- packages/ui/src/components/Badge.tsx packages/ui/src/components/Button.tsx packages/ui/src/components/Card.tsx packages/ui/src/components/Collapsible.tsx packages/ui/src/components/Logo.tsx packages/ui/src/components/Modal.tsx packages/ui/src/components/SettingsSection.tsx packages/ui/src/components/Splitter.tsx packages/ui/src/components/Tabs.tsx packages/ui/src/lib/cn.ts packages/ui/src/lib/titlebar.ts packages/ui/src/tokens/colors.css packages/ui/src/tokens/typography.css
git diff 5a14352934 -U0 -- packages/ui/src/base.css | grep "^[@+][^+]"
git diff 5a14352934 -U0 -- packages/ui/src/index.ts | grep "^@@"
```
Erwartet: der erste Befehl gibt **nichts** aus. Die neun Dateien stehen einzeln da, denn das Verzeichnis
`packages/ui/src/components` enthält jetzt auch die neuen Bausteine und wäre nie leer. Der zweite und dritte (gemessen mit
den Nachbauten):
```
@@ -8,0 +9,2 @@
+@import "./tokens/signal-colors.css";
+@import "./tokens/sizes.css";
@@ -11,0 +12,17 @@ export { Tabs, type TabItem } from './components/Tabs';
```
`base.css` bekommt also nur die zwei Zeilen nach Zeile 8. `index.ts` bekommt nur die 17 Zeilen aus 9.8 am Ende. Der
Bestandsschutz-Test aus Task 2 läuft in 5.2 mit.

**5.5 Titler-Renderer-Bau in einer Kopie** (Review Focus 1: kommen Tokens und Pflichtklassen im CSS eines echten
App-Renderers an?)

Gemessen: `electron-vite build` läuft ohne Electron-Binary durch. Der Ausweichweg mit einer temporären Vite-Config ist
nicht nötig. Kopie aus dem committeten Stand, `K` ist ein neuer Ordner im eigenen Scratchpad (G16; jeder Block setzt `SP`
und `K` selbst). Anlegen und bauen (Plan-Worktree als Arbeitsverzeichnis):
```
SP='<eigener Scratchpad>'; K="$SP/titler-probe"
[ -d "$SP" ] && [ ! -e "$K" ] && mkdir -p "$K" && git archive HEAD | tar -x -C "$K" \
  && MSYS_NO_PATHCONV=1 cmd /c mklink /J "$(cygpath -w "$K/node_modules")" "$(cygpath -w "$PWD/node_modules")" \
  && mkdir -p "$K/apps/titler/node_modules/@jm" \
  && MSYS_NO_PATHCONV=1 cmd /c mklink /J "$(cygpath -w "$K/apps/titler/node_modules/@jm/ui")" "$(cygpath -w "$K/packages/ui")" \
  && (cd "$K" && npm run build -w @jm/titler); echo "Exit=$?"
SP='<eigener Scratchpad>'; K="$SP/titler-probe"
[ -d "$K/packages/ui" ] && (cd "$K/packages/ui" && npx tsx galerie/pruefe-klassen.ts --css ../../apps/titler/out/renderer/assets --ohne-settings); echo "Exit=$?"
```
Die zweite Junction sorgt dafür, dass der Titler `@jm/ui/base.css` aus der Kopie liest und nicht über die Wurzel-
`node_modules`. Der Titler hat kein `@source` für `packages/settings`, deshalb `--ohne-settings`. Erwartet (gemessen):
`electron-vite build` baut `out/main/index.cjs`, `out/main/ndi-sender.cjs`, `out/preload/index.cjs`,
`out/renderer/index.html`, `out/renderer/assets/index-<hash>.css` (49,37 kB, unminifiziert; vor der Nachbesserung 49,02 kB) und
`…/index-<hash>.js`, dann `Exit=0`. Die Probe meldet 19 `ok`, `ALLE TESTS OK`, `Exit=0`:
```
ok   Klassen-Probe: CSS in …\apps\titler\out\renderer\assets (index-<hash>.css)
ok   Klassen-Probe: 12 neue Tokens definiert
ok   Klassen-Probe: Regel [data-dichte="kompakt"] vorhanden
ok   Klassen-Probe: Pflichtklasse h-[var(--statusbar-h)]
…    (die 13 Pflichtklassen wie in Task 23)
ok   Klassen-Probe: Medienabfrage für max-[900px] (Schmal-Ansicht)
ok   Klassen-Probe: Medienabfrage für motion-safe
ok   Klassen-Probe: 71 Klassen aus className="…" in packages/ui/src im CSS

ALLE TESTS OK
```
Gegenproben in derselben Kopie, gemessen:
- Ohne die Zeile `@source "../../../../../packages/ui/src";` in `apps/titler/src/renderer/src/globals.css` meldet die Probe
  nach neuem Bau `16 FEHLGESCHLAGEN`: alle 13 Pflichtklassen, beide Medienabfragen und die className-Zeile.
- Ohne `@import "./tokens/sizes.css";` in `packages/ui/src/base.css` meldet sie `2 FEHLGESCHLAGEN`:
  `… fehlt: --header-h, --statusbar-h, --control-h, --control-h-lg, --panel-w` und die Dichte-Regel.

Das Titler-CSS enthält die neuen Klassen, obwohl der Titler noch keinen neuen Baustein benutzt: Tailwind erzeugt jede Klasse,
die es in `packages/ui/src` findet. Jede der 24 Apps wird dadurch beim nächsten Bau etwas größer, sieht aber gleich aus,
weil keine bestehende Klasse sich ändert. Aufräumen, nur so (ein Aufruf; erst die Junctions, Kontrolle, dann der Rest):
```
SP='<eigener Scratchpad>'; K="$SP/titler-probe"
[ -d "$K" ] \
  && { [ ! -e "$K/apps/titler/node_modules/@jm/ui" ] || MSYS_NO_PATHCONV=1 cmd /c rmdir "$(cygpath -w "$K/apps/titler/node_modules/@jm/ui")"; } \
  && { [ ! -e "$K/node_modules" ] || MSYS_NO_PATHCONV=1 cmd /c rmdir "$(cygpath -w "$K/node_modules")"; } \
  && [ ! -e "$K/node_modules" ] && [ -z "$(MSYS_NO_PATHCONV=1 cmd /c dir /AL /S /B "$(cygpath -w "$K")" 2>/dev/null)" ] \
  && rm -rf "${K:?}" && echo "Kopie weg" && ls node_modules/.package-lock.json
```
Erwartet: `Kopie weg` und `node_modules/.package-lock.json`. Ohne `Kopie weg` ist nichts gelöscht worden (eine Junction
steht noch, `cmd /c dir /AL /S /B <Kopie>` zeigt sie, oder `SP` ist falsch). Jede Junction wird nur entfernt, wenn sie da
ist; so räumt derselbe Block auch eine Kopie auf, deren Anlegen nach der ersten Junction abgebrochen ist.

**5.6 Keine zweite Version durch diesen Plan** (Lockfile-Prüfung wie Task 1, Step 2)
```
node -e "const P=require('./package-lock.json').packages;for(const x of ['react','react-dom','vite','tailwindcss','@tailwindcss/vite','@vitejs/plugin-react','typescript','tsx']){const v=new Set(Object.entries(P).filter(([k])=>k==='node_modules/'+x||k.endsWith('/node_modules/'+x)).map(([,e])=>e.version));console.log(x+': '+[...v].join(', '))}console.log('verschachtelt:',Object.keys(P).filter(k=>/^packages\/(ui|settings)\/node_modules/.test(k)).length);console.log('settings-Link:',JSON.stringify(P['node_modules/@jm/settings']))"
```
Erwartet:
```
react: 18.3.1
react-dom: 18.3.1
vite: 8.1.0, 5.4.21
tailwindcss: 4.3.0
@tailwindcss/vite: 4.3.0
@vitejs/plugin-react: 4.7.0
typescript: 5.9.3
tsx: 4.22.4
verschachtelt: 0
settings-Link: {"resolved":"packages/settings","link":true}
```
Die Versionszeilen sind am Spec-Stand gemessen und dürfen sich nicht ändern. `vite 8.1.0` gehörte schon vorher zu `astro`
unter `apps/cookbook-web` und ist kein Fehler dieses Plans. Die Lockfile-Deltas sind gemessen: Task 1 fügt 9 Zeilen hinzu,
Task 16 25 Zeilen (Link und Eintrag `packages/settings`), Task 23 ändert 5 Zeilen und entfernt 1. Keines ändert eine
Version. `npm ls … --all` am Spec-Stand: `Exit 0`, keine Zeile mit `invalid`, `UNMET` oder `missing`. Wegen
`vite@8.1.0` taugt die Regel „je eine Version“ aus G12 nicht als Prüfung.

- [ ] **Step 6: Commit** (Bash-Werkzeug)

```
git add .github/workflows/ci-checks.yml
git status --short
```
Erwartet genau (fremde Dateien darunter bleiben ungestaged):
```
M  .github/workflows/ci-checks.yml
```
Dann:
```
git commit -m "ci: Selbsttests fuer @jm/ui und @jm/settings" -m "Zwei Schritte im Job selftests (Node 22, npm ci --ignore-scripts, ohne Electron) zwischen App Designer und Zoom-Bridge: npm run selftest -w @jm/ui (Bestandsschutz, Tokens, Kontrast, Bausteine, Galerie-Test) und npm run selftest -w @jm/settings (Ableitungen als Kreuzprodukt). Die typecheck-Skripte beider Pakete nimmt der Job typecheck ueber --workspaces --if-present von selbst mit. Der Galerie-Bau und die Klassen-Probe laufen nur lokal (E21)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Prüfung 4: Das Gerüst nannte das Verzeichnis `packages/ui/src/components`. Dort liegen jetzt auch die neuen Bausteine,
  der Diff wäre nie leer. Deshalb stehen die neun Bestandsdateien einzeln da, und `base.css`/`index.ts` werden über ihre
  Hunks geprüft.
- Prüfung 6: `npm ls … zeigt je eine Version` ist schon am Spec-Stand falsch (`vite@8.1.0` unter `astro`). Ersetzt durch die
  Lockfile-Prüfung mit festen Sollwerten (wie Task 1).
- Prüfung 5: Für die Kopie gilt `MSYS_NO_PATHCONV=1 cmd /c mklink /J`. Das Rezept aus dem Gerüst (`cmd //c mklink /J …`)
  scheitert in Git Bash mit „Ungültige Option“ (gemessen). Dazu kommt eine zweite Junction für `apps/titler/node_modules/@jm/ui`.
- Gegenprobe YAML (Step 4) im Speicher statt in einer Dateikopie: Die Datei wird dabei nie verändert.

**Nachgerechnet** (Kopie `scratchpad\ux-plan\kopie-d`, wie Task 23):
- Step 1 und 3 mit den angegebenen Ausgaben.
- Hunk `@@ -70,0 +71,6 @@` (über `git diff --no-index` gegen den Worktree), 112/112 CRLF nach dem Edit-Werkzeug.
- Step 4 `bad indentation of a sequence entry (74:8)`.
- 5.3: 31 Workspaces, 0 Fehler, 2 min. Die Junctions auf `packages/ui` lagen in den 24 Apps, damit die Apps wirklich die
  neuen Quellen prüfen; Gegenprobe gemessen.
- 5.5: `electron-vite build` grün in 2,9 s, Probe 19 `ok`, Gegenproben 16 bzw. 2 `FAIL`.
- 5.6: Versionszeilen am Worktree `ux-update` gelesen. Lockfile-Deltas in einer abgetrennten Kopie ohne `node_modules` mit
  `--package-lock-only --offline` gemessen.
- 5.2: nur der Galerie-Teil gemessen (122). Die Gesamtzahlen hängen von Block A–C ab.

**Nachgerechnet beim Zusammensetzen** (frische Kopie mit allen Tasks 1–24 aus diesem Plan; jedes `@jm/*` der Kopie zeigte
auf die Kopie): Step 1/3/4 wie angegeben (16 → 18 Schritte, Hunk `@@ -70,0 +71,6 @@`, `CRLF 112 Zeilen 112`, `(74:8)`);
5.2 `@jm/ui` 459 und `@jm/settings` 301 `ok` (Stand vor den Nachbesserungen; heute siehe 5.2); 5.3 `Exit=0`, 31 Workspaces, 0 `error TS`, 1 min 32 s, Gegenprobe
`StatusPill.tsx(24,35): error TS2551` über `typecheck:web -w @jm/titler`; 5.4 alle 13 Bestandsdateien gleich, Hunks
`@@ -8,0 +9,2 @@` und `@@ -11,0 +12,17 @@`; 5.5 `electron-vite build` in 2,5 s, Renderer-CSS 49,02 kB (vor den Nachbesserungen), Probe 19 `ok`,
Gegenproben 16 und 2 `FAIL`; 5.6 in einer abgetrennten Kopie ohne `node_modules`: Lockfile-Deltas 9 / 25 / 5+1−, Sollwerte
wie angegeben.
- Alle Junctions der Kopie einzeln entfernt (26 Stück); das Worktree-`node_modules` war danach unverändert vorhanden.

**Nachgerechnet nach der zweiten Nachbesserung:** 5.2 `@jm/ui` 520 und `@jm/settings` 329 `ok`; 5.3 `Exit=0`, 31 Workspaces, 0 `error TS` (diesmal ohne Speicher-Abbruch); 5.5 `electron-vite build` grün, Renderer-CSS 49,37 kB mit demselben Hash wie vorher (`index-CRgH0p-g.css`), Probe 19 `ok`. Die Gegenproben 16 und 2 sind nicht neu gemessen (das CSS ist byte-gleich). Die Aufräum-Kette aus 5.5 ist mit einer vollständigen und einer halb angelegten Kopie (nur die erste Junction) gemessen: je `Kopie weg`, Ziel der Junctions unberührt; mit leerem `SP` keine Ausgabe, nichts gelöscht.

---

### Task 25: Doku – UX-Roadmap kürzen (F3) und Lane E nachführen

**Spec:** 14 F3 („Alte UX-Roadmap … auf eine Kurzfassung mit Verweis auf diese Spec kürzen (erledigt mit dem ersten
Plan)“), Kopf der Spec (löst die Phasen 2–5 ab, Phase 1 bleibt Grundlage), 9.1 (Wellen), 9.2 (Reihenfolge), 13
(Nicht-Ziele), Anhang B. Global Constraint G11 (punktuell ersetzen, nie umbrechen).

**Arbeitsverzeichnis/Voraussetzung:** Plan-Worktree, Task 24 committet. Der Plan selbst
(`docs/superpowers/plans/2026-10-08-suite-ux-fundament.md`) liegt im Branch. Die Kurzfassung und Lane E verlinken ihn.

**Dateien:**
- Modify: `docs/ux/suite-ux-roadmap.md` (ganz ersetzt, 101 → 39 Zeilen)
- Modify: `docs/roadmap.md`, Lane E (Zeilen 336–339 ersetzt, nach Zeile 368 eine Zeile `</details>` mit Leerzeile davor) und
  Abschnitt 5 „Geparkt“ (Zeile 430)

**Interfaces:** keine (nur Doku). `*.md` löst keine CI aus (`paths-ignore`).

**Verhalten (verbindlich):**
- Die Kurzfassung enthält:
  - den Titel (unverändert),
  - den Verweis auf die Spec und auf Lane E,
  - das Leitprinzip in einem Satz,
  - Phase 1 als erledigt (PR #168, `Collapsible`/`SettingsSection`/`Tabs`, Titler-`OperatorView`),
  - die Phasen 2–5 als abgelöst durch die Wellen (Tabelle aus Spec 9.1, eine Zeile je Welle),
  - den Pfad des Fundament-Plans,
  - die Nicht-Ziele nur per Verweis auf Spec 13.

  Problem-Abschnitt und Pfaddetails der Phasen entfallen. Die ausführliche Fassung bleibt in der Git-Historie.
- Lane E bekommt oben den Stand nach der Spec: Verweis, Wellen-Tabelle mit dem Stand je Welle, Hinweis gegen
  Doppelplanung. Der bisherige Text ab „Stand am 2026-08-07“ bleibt **wortgleich** stehen. Er kommt in einen Block
  `<details><summary>Alte Phasen … stehen gelassen</summary>`, nach dem Muster, das `docs/roadmap.md` schon für die Planung
  vom 2026-08-07 nutzt: Altes Gemessenes wird nicht umgeschrieben, sondern als überholt markiert.
- Der Stand der Zeile „0 · Fundament“ bleibt auch nach dem Merge wahr („umgesetzt in den Aufgaben 1–24; Sichtprüfung über
  die Galerie“). „Gemergt“ trägt der Controller danach nach (siehe „Nach der Umsetzung“).
- Zeilen 397–398 (Abschnitt 3, im Block „Planung vom 2026-08-07 (überholt, stehen gelassen)“) bleiben unverändert. Sie sind
  Historie.

---

- [ ] **Step 1: Prüfbefehle zuerst (Stand vorher)**

```
grep -n "Phase 2\|Phase 4" docs/roadmap.md | cut -d: -f1 | paste -sd' '
grep -c "2026-10-08-suite-ux-update-design.md" docs/ux/suite-ux-roadmap.md docs/roadmap.md
echo "details: $(grep -c '^<details>' docs/roadmap.md) / $(grep -c '^</details>' docs/roadmap.md)"
```
Erwartet (gemessen am Spec-Stand): fünf Treffer (Zeilen 350, 352, 397, 398, 430), keiner verweist auf die Spec. Nur die
Zeilennummern werden verglichen; `cut -c` zählt in Git Bash Bytes und schnitte Umlaut-Zeilen anders ab:
```
350 352 397 398 430
docs/ux/suite-ux-roadmap.md:0
docs/roadmap.md:0
details: 1 / 1
```

- [ ] **Step 2: Kurzfassung schreiben** (`docs/ux/suite-ux-roadmap.md` erst lesen, dann mit dem Write-Werkzeug ganz
  ersetzen; LF, die Warnung „LF will be replaced by CRLF“ ist harmlos)

````markdown
# Suite-UX-Roadmap — übersichtliche Steuerpulte (#165)

> **Kurzfassung, Stand 2026-10-08.** Diese Roadmap ist abgelöst. Maßgeblich ist die Spec
> [`docs/superpowers/specs/2026-10-08-suite-ux-update-design.md`](../superpowers/specs/2026-10-08-suite-ux-update-design.md),
> vom Owner am 2026-10-08 freigegeben (Vorgaben UO1–UO8). Die Einordnung in die Gesamtplanung steht als **Lane E** in
> [`docs/roadmap.md`](../roadmap.md). Die ausführliche Fassung vom 2026-08-07 liegt in der Git-Historie dieser Datei.

## Leitprinzip

**Live-Bedienung sichtbar, Einrichtung weggeräumt.** Es gilt unverändert (Spec Abschnitt 0).

## Phase 1 — erledigt

Fundament und Titler-Pilot, PR #168, gemergt am 2026-07-04:
[`Collapsible`](../../packages/ui/src/components/Collapsible.tsx),
[`SettingsSection`](../../packages/ui/src/components/SettingsSection.tsx) und
[`Tabs`](../../packages/ui/src/components/Tabs.tsx) liegen in `@jm/ui`, die Titler-
[`OperatorView`](../../apps/titler/src/renderer/src/views/OperatorView.tsx) nutzt sie. Die drei Bausteine bleiben in
Gebrauch.

## Phasen 2–5 — abgelöst durch die Wellen der Spec

Die alten Phasen werden nicht mehr einzeln geführt; welche Phase in welche Welle aufgeht, steht in Anhang B der Spec.
Es gelten die Wellen aus Spec Abschnitt 9.1:

| Welle | Inhalt |
|---|---|
| 0 · Fundament + Pilot | `@jm/ui` (Bausteine, Optik-System), neues `@jm/settings`, Galerie; Titler als Pilot |
| 1 · Live-Kern | Switcher, Timer, Rundown, Q&A, Battle |
| 2 · übrige Live-Tools | Connect, Caption, Interpreter, Presenter, Prompter, Stage-Display, Recorder, Player, Studio-Control |
| 3 · Launcher + Werkzeuge | Launcher, Copy, Grafiktool, Media-Converter, Sync, DAW, Editor, Transcribe, App Designer, NDI-Screen-Capture |

Plan für das Fundament (Welle 0 ohne Pilot):
[`docs/superpowers/plans/2026-10-08-suite-ux-fundament.md`](../superpowers/plans/2026-10-08-suite-ux-fundament.md).
Der Titler-Pilot bekommt einen eigenen Plan, nach dem Merge von Master-Link 2b R2 und Zoom 4b (Spec 9.2).

## Nicht-Ziele

Siehe Spec Abschnitt 13.
````

- [ ] **Step 3: Lane E nachführen** (`docs/roadmap.md`, drei Ersetzungen mit dem Edit-Werkzeug, CRLF bleibt erhalten;
  Zeilen nie umbrechen)

Ersetzung 1 (Zeilen 336–339), Vorher:
```markdown
Eigene Roadmap: [`docs/ux/suite-ux-roadmap.md`](ux/suite-ux-roadmap.md). Leitprinzip: **Live-Bedienung
sichtbar, Einrichtung weggeräumt.** Stand am 2026-08-07 **am Code gemessen** (das UX-Dokument selbst war
nicht nachgeführt, und drei seiner fünf Dateipfade zeigen inzwischen ins Leere — alle Apps haben ein
`src/` dazubekommen):
```
Nachher:
```markdown
Spec: [`docs/superpowers/specs/2026-10-08-suite-ux-update-design.md`](superpowers/specs/2026-10-08-suite-ux-update-design.md),
vom Owner am 2026-10-08 freigegeben (Vorgaben UO1–UO8). Sie löst die Phasen 2–5 ab; Phase 1 (PR #168) bleibt die
Grundlage. [`docs/ux/suite-ux-roadmap.md`](ux/suite-ux-roadmap.md) ist nur noch eine Kurzfassung mit Verweis.
Leitprinzip: **Live-Bedienung sichtbar, Einrichtung weggeräumt.**

| Welle | Inhalt | Stand |
|---|---|---|
| 0 · Fundament (ohne Pilot) | `@jm/ui`: Rahmen, Statusleiste, `TallyButton`, Eingaben, Einstellungs-Panel, Hell/Dunkel, neue Tokens; neues `@jm/settings` mit sieben Abschnitten; Galerie; Selbsttests in der CI | Plan [`docs/superpowers/plans/2026-10-08-suite-ux-fundament.md`](superpowers/plans/2026-10-08-suite-ux-fundament.md), umgesetzt in den Aufgaben 1–24; Sichtprüfung über die Galerie (`npm run galerie -w @jm/ui`). Kein eigener Release: die Pakete gehen mit den Apps raus. |
| 0 · Titler-Pilot | Titler im gemeinsamen Rahmen, Status-Brücken in `@jm/app-runtime` (Spec 3.9) | eigener Plan, nach dem Merge von Master-Link 2b R2 und Zoom 4b (Spec 9.2) |
| 1 · Live-Kern | Switcher, Timer, Rundown, Q&A, Battle | nach der Owner-Abnahme des Pilots |
| 2 · übrige Live-Tools | Connect, Caption, Interpreter, Presenter, Prompter, Stage-Display, Recorder, Player, Studio-Control | nach Welle 1; Connect erst nach dem Merge von Zoom 4b |
| 3 · Launcher + Werkzeuge | Launcher, Copy, Grafiktool, Media-Converter, Sync, DAW, Editor, Transcribe, App Designer, NDI-Screen-Capture | nach Welle 2 |

Released wird gesammelt je Welle, nach der Abnahme und nur mit Owner-Freigabe (Spec 9.1, 12).

⚠️ **Nicht doppelt planen:** „Onboarding-Reste D1-Teil-2 (timer/switcher-Primitive auf `@jm/ui`)“ unter *Geparkt*
geht in Welle 1 (Switcher, Timer) auf.

<details>
<summary>Alte Phasen (Stand 2026-08-07, nachgemessen 2026-10-08; durch die Spec abgelöst, stehen gelassen)</summary>

Stand am 2026-08-07 **am Code gemessen** (das UX-Dokument selbst war
nicht nachgeführt, und drei seiner fünf Dateipfade zeigen inzwischen ins Leere — alle Apps haben ein
`src/` dazubekommen):
```

Ersetzung 2 (Zeilen 367–368, Ende des alten Textes; danach folgen wie bisher eine Leerzeile und `---`), Vorher:
```markdown
  verschiedenen Orten, 4 Apps (Connect, Battle, Caption, Interpreter) mit festen dunklen Farben statt Tokens. Danach
  Spec → Plan; `docs/ux/suite-ux-roadmap.md` wird dabei nachgeführt.
```
Nachher:
```markdown
  verschiedenen Orten, 4 Apps (Connect, Battle, Caption, Interpreter) mit festen dunklen Farben statt Tokens. Danach
  Spec → Plan; `docs/ux/suite-ux-roadmap.md` wird dabei nachgeführt.

</details>
```

Ersetzung 3 (Zeile 430, Abschnitt 5 „Geparkt“), Vorher:
```markdown
  Arbeit wie Lane E Phase 2+3** — dort geführt, hier nicht noch einmal.)
```
Nachher:
```markdown
  Arbeit wie Lane E Welle 1 (Switcher, Timer)** — dort geführt, hier nicht noch einmal.)
```

- [ ] **Step 4: Prüfungen (Stand nachher)**

```
grep -n "Phase 2\|Phase 4" docs/roadmap.md | cut -d: -f1 | paste -sd' '
grep -c "2026-10-08-suite-ux-update-design.md" docs/ux/suite-ux-roadmap.md docs/roadmap.md
echo "details: $(grep -c '^<details>' docs/roadmap.md) / $(grep -c '^</details>' docs/roadmap.md)"
node -e "const t=require('fs').readFileSync('docs/roadmap.md','utf8');console.log('CRLF',(t.match(/\r\n/g)||[]).length,'Zeilen',(t.match(/\n/g)||[]).length)"
(cd docs/ux && for z in $(grep -oE '\]\([^)#]+\)' suite-ux-roadmap.md | sed 's/^](//; s/)$//'); do ls "$z" >/dev/null 2>&1 && echo "da    $z" || echo "FEHLT $z"; done)
(cd docs && for z in $(sed -n '334,360p' roadmap.md | grep -oE '\]\([^)#]+\)' | sed 's/^](//; s/)$//'); do ls "$z" >/dev/null 2>&1 && echo "da    $z" || echo "FEHLT $z"; done)
git diff --stat -- docs/roadmap.md docs/ux/suite-ux-roadmap.md
```
Erwartet (gemessen in der Kopie):
- Die vier verbleibenden Phasen-Treffer stehen alle in `<details>`-Blöcken: 370 und 372 im neuen Block „Alte Phasen“,
  419 und 420 im alten Block „Planung vom 2026-08-07“.
- Je einmal der Spec-Verweis.
- `details: 2 / 2`.
- `CRLF 490 Zeilen 490`.
- Jedes Link-Ziel ist `da`, auch `../superpowers/plans/2026-10-08-suite-ux-fundament.md` und
  `superpowers/plans/2026-10-08-suite-ux-fundament.md`, sofern der Plan im Branch liegt (Voraussetzung). Fehlt er, ist das ein
  Befund an den Controller, kein Grund, den Link zu streichen.
- Der Diff zeigt `docs/roadmap.md | 28 ++++++++++++++++++++---` (25 insertions, 3 deletions) und
  `docs/ux/suite-ux-roadmap.md | 110 +++++-----` (24 insertions, 86 deletions).
```
370 372 419 420
docs/ux/suite-ux-roadmap.md:1
docs/roadmap.md:1
details: 2 / 2
CRLF 490 Zeilen 490
```
Gegenprobe (gemessen): fehlt Ersetzung 2, zeigt die Zählung `details: 2 / 1`.

- [ ] **Step 5: Commit** (Bash-Werkzeug)

```
git add docs/ux/suite-ux-roadmap.md docs/roadmap.md
git status --short
```
Erwartet genau (dazu ggf. „LF will be replaced by CRLF“ für die Kurzfassung, harmlos):
```
M  docs/roadmap.md
M  docs/ux/suite-ux-roadmap.md
```
Dann:
```
git commit -m "docs(ux): UX-Roadmap als Kurzfassung (Spec F3), Lane E nachgefuehrt" -m "docs/ux/suite-ux-roadmap.md wird Kurzfassung: Verweis auf die Spec vom 08.10.2026 und Lane E, Leitprinzip, Phase 1 erledigt (PR #168), Phasen 2-5 abgeloest durch die Wellen 0-3, Pfad des Fundament-Plans, Nicht-Ziele per Verweis auf Spec 13. Lane E in docs/roadmap.md: Spec und Wellen-Tabelle oben, der bisherige Phasen-Text bleibt wortgleich in einem details-Block stehen; Geparkt verweist auf Welle 1 statt Phase 2+3." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Die Phasentabelle wird nicht ersetzt. Sie bleibt mit dem ganzen Text „Stand am 2026-08-07 … Spec → Plan“ wortgleich in einem
  `<details>`-Block stehen, die neue Wellen-Tabelle kommt davor. Grund: Owner-Regel „alten Text stehen lassen und
  widerrufen“ und das Muster der Datei selbst („Planung vom 2026-08-07 (überholt, stehen gelassen)“). Damit bleibt auch
  „Brainstorming läuft“ (heute Zeile 360, danach 380) als Historie im Block. Der aktuelle Stand steht oben.
- Zeilen 397–398 („Lane E Phase 2+3“, „Phase 4+5“) bleiben unverändert. Sie stehen im Block „Planung vom 2026-08-07
  (überholt, stehen gelassen)“, eine Ersetzung würde die alte Planung verfälschen.
- Nicht nachgeführt: Abschnitt 3 „Was läuft wann“, Zeilen 378 und 381 („UX-Spur: Brainstorming …“, „UX-Spur nach geklärtem
  Umfang“). Dieselben Zeilen tragen den Stand von Master-Link 2b R2 und Zoom 4b. Eine Änderung hier gäbe beim Merge sicher
  einen Konflikt. Der Controller führt sie nach dem Merge mit nach (siehe „Nach der Umsetzung“).

**Nachgerechnet** (Kopie `scratchpad\ux-plan\kopie-d`, Stand `5a14352934`, Edit-Werkzeug auf die CRLF-Datei):
- Step 1 und 4 mit den angegebenen Ausgaben.
- Die Diff-Zahlen über `git diff --no-index` gegen den Worktree.
- Gegenprobe `details: 2 / 1`.
- Nicht messbar war das Link-Ziel des Plans, weil der Plan beim Messen noch nicht im Worktree lag.

**Nachgerechnet beim Zusammensetzen** (frische Kopie, Tasks 1–25 aus diesem Plan, der Plan selbst unter
`docs/superpowers/plans/` daneben gelegt): Step 1 und Step 4 mit genau den angegebenen Ausgaben, alle zehn Link-Ziele `da`
(auch beide Verweise auf diesen Plan), Diff `docs/roadmap.md | 28` (25+, 3−) und `docs/ux/suite-ux-roadmap.md | 110` (24+, 86−).

---

## Selbstprüfung des Plans

**1. Spec-Abdeckung** (je geforderter Abschnitt; jede Zeile ist durch die Messung beim Zusammensetzen gedeckt)

| Spec | Anforderung | Aufgabe(n) |
| --- | --- | --- |
| 3 | Bausteine rein darstellend, Props wie in der Spec, ohne IPC/`window.*` | 8–15; Quellregeln 3 (G4) |
| 3.1 | `AppShell`: Aufbau senkrecht 44/28 px, Panel 360 px neben dem Inhalt, < 900 px darüber, verdeckt Kopf und Statusleiste nie, Escape nur mit Fokus im Panel | 3 (Größen), 13 (Panel, `panelTaste`), 15 (Aufbau, Probe „Panel außerhalb der Inhaltszeile“) |
| 3.2 | `AppHeader`: Logo + Toolname, Mac-Ampel, Ziehfläche, Bedienelemente `noDragRegion`, Mitte, On-Air mit Text, `ThemeToggle`, ⚙ nur mit `settings` | 14, 15 |
| 3.3 | `StatusBar`/`StatusItem`: feste Gruppenreihenfolge, Symbol + Text je Zustand, Knopf nur mit Ziel, Uhr hh:mm:ss tabellarisch, < 900 px ohne Detail | 5 (Logik), 8 (Kreuzprodukt 40 Fälle) |
| 3.4 | `TallyButton`: 48 px, bereit/live/gesperrt mit Form und Text, Grund Pflicht, Halten mit `onRelease` genau einmal, Kürzel nur Anzeige | 6 (780 Folgen), 9 |
| 3.5 | `Field`, `TextInput`, `NumberInput` (Einheit, Min/Max), `Toggle`, `Select` nativ; 32 px; `aria-invalid`/`aria-describedby` | 7 (Logik, Frist E27), 10, 11; Text-Entwurf 17 |
| 3.6 | `SettingsPanel`: Titel, Schließen, Sprung zum Abschnitt, kurze Hervorhebung | 13 |
| 3.7 | `ThemeToggle`/`useTheme`: Dunkel Standard, `light` auf `<html>`, `jm-theme` in `try/catch`, Fehler → Dunkel | 7, 12 |
| 3.8 | Dichte kompakt 36/24 px; ohne Electron; Zustand ohne Sitzung; Mac-Ziehfläche | 3 (Tokens), 15 (`data-dichte`, Rahmen ohne Sitzung), 14 (`mac`), Quellregeln 3 und 16 |
| 3.9 | Status-Brücken | bewusst nicht (eigener Plan) |
| 3.10 | Galerie: jeder Baustein und Abschnitt in jedem Zustand, beide Modi, ohne Electron, `npm run galerie -w @jm/ui` | 23 (Galerie, Galerie-Test, Klassen-Probe, Dev-Server-Prüfung) |
| 4.1 | Rein additiv, per Test geprüft | 2 (Bestandsschutz), 3 (nur neue Namen, nur Custom Properties), 24 (Diff gegen `5a14352934`) |
| 4.2 | Farben mit fester Bedeutung, Werte beider Modi; LIVE und Fehler durch Form und Text; Kontrast gemessen | 3 (Werte), 4 (Kontrast, auch Hover-Fläche `--muted`), 5 (Symbole, `LIVE_FLAECHE_KLASSE`, `LIVE_EINTRAG_KLASSE`), 8/9/14 (Render) |
| 4.3 | `--surface-raised`, Rundungen, Größen, `.tabular`, Bewegung ≤ 150 ms und `prefers-reduced-motion` | 3 (Tokens, Quellregel Bewegung), G3, G8 |
| 6 | Paket `@jm/settings`, privat, hängt von `@jm/ui` ab, `@jm/control-config` nur über Typen | 16 (Gerüst, Quellregel `import type`) |
| 6.1 | Vertrag wörtlich, Statuspille im Kopf, Fehlertext immer nach den Feldern, gesperrt nie ohne Grund, ausblenden statt ausgrauen, Texte fest | 16 (`SectionFrame`, Quellregeln „keine Prop titel“, „keine Texte in .tsx“), 17–22 (capabilities, locked) |
| 6.2 | Sieben Abschnitte mit Feldern, Statustexten und reiner Ableitungsfunktion; Launcher-Vollform; nur `{id,label}`-Geräte, mehrere benannte Wahlen; iveo-Token nur im Launcher; Deep-Link geprüft | 17–22; E15 |
| 7.1 | Kreuzprodukt je Eintrag | 6, 8, 17–22 (Tabellen über alle Kombinationen) |
| 7.2 | Unbekannt ist nicht ok | 5 (`unbekannt()`), 16 (`STATUS_UNBEKANNT`), 17–22 |
| 7.3 | Nur Gemessenes; „an (ohne Rückmeldung)“ | 17 (E2), 18, 19 (keine „0 verbunden“), 20, 21 (nie „0 Dateien“), 22 |
| 7.4 | `live` nur für Sendezustände | 16 (`st('live')` wirft), 5/8/9/14 (`live` nur für Tally und On-Air) |
| 8 | Hell und Dunkel, Tally-Bedeutungen in beiden Modi | 3 (helle Werte, `.light` wiederholt `var()`), 4 (Kontrast beider Modi), 7/12, 23 (zwei Spalten, Rahmen in beiden Modi) |
| 11 | Render-Tests ohne Browser unter `tsx`, Logiktests, Kontrast-Test, zwei neue Selbsttests im CI-Job „Selbsttests“ | 1 (Werkzeug), 2–23, 4, 24 (CI-Block, YAML geprüft) |
| 14 F3 | UX-Roadmap auf Kurzfassung mit Verweis kürzen; Lane E nachführen | 25 |

**2. Platzhalter-Scan:** Nach „TBD“, „TODO“, „später“, „ähnlich wie Task“, „<n>“-Zählern und offenen Messmarken (auch den
Marken `§§…§§` der Nachbesserung) gesucht: keine. Stehen geblieben sind nur erklärte Pfad- und Wertplatzhalter in Befehlen
und Ausgaben (`<Kopie>`, `<eigener Scratchpad>` nach G16, `<worktree>`, `<hash>`, `<pid>`, `<pfad>`) und
`<n> FEHLGESCHLAGEN` im Kommentar der Testhilfe (dort ist die Zahl gemeint).
Jeder Code-Schritt enthält den vollständigen Code; „Nicht gemessen“ steht nur dort, wo ohne Browser oder Owner nichts zu
messen ist (Sichtprüfung) bzw. bei den `git`-Schritten.

**3. Typ-Konsistenz:** Namen, Signaturen und Props aus den Schnittstellen (Gerüst 9.1–9.10, Lesehilfe im Kopf; je Aufgabe
unter „Interfaces“)
sind beim Zusammensetzen durch das Einspielen geprüft: jede Vorher-Stelle passte genau einmal, `tsc` für `@jm/ui` und
`@jm/settings` war nach jeder Aufgabe ohne Meldung, `npm run typecheck --workspaces --if-present` am Ende über 31 Workspaces
ohne Fehler. Die Exportlisten in `src/index.ts` beider Pakete entsprechen 9.8 bzw. 9.9/9.10 plus den unter Z7 genannten
Zusätzen. Jede `ok`- und `FAIL`-Zeile, die der Plan als erwartete Ausgabe nennt, kam im Lauf der jeweiligen Aufgabe wörtlich
vor (maschinell verglichen).

**4. Review Focus:** Alle fünf Zeilen haben Tests in der genannten Aufgabe (siehe „Review Focus“); keine ist ohne Test.
Zusätzlich geprüft und gedeckt: doppelte ids in der Galerie (Task 23), Escape-Kette Zahlenfeld → Panel → Tool als Logik
und Bindung (`zahlTaste`, `zahlFeldHandler`, `panelTaste`, `panelProps`; Task 10, 13), fehlender Bildschirm bei
ausgeschalteter Ausgabe (Task 18), Token nie in `variante: 'tool'` (Task 19), jedes Feld genau mit seiner eigenen
Capability (Kreuzprodukt über alle Capability-Bits, Tasks 17–20). **Nur im Browser messbar** und deshalb nicht durch Tests
gedeckt: dass React die Effekte ausführt (Uhr, Halten-Abbruch bei Sperre und Abbau, Frist „Noch nicht übernommen.“,
Fokus-Rückgabe, Ende der Hervorhebung, `<html>`-Klasse) und das Aussehen; das sind die Owner-Prüfpunkte 1–6 unter „Nach der
Umsetzung“. Die Owner-Entscheidungen vor Task 16 stehen unter „Vor der Umsetzung“.

## Vor der Umsetzung (nur Controller und Owner)

Dieser Abschnitt ist keine Aufgabe für ausführende Agenten. Der Owner entscheidet bei der Freigabe dieses Plans,
spätestens vor Task 16 (davon hängen Tasks 17–22 ab):

1. **Zustimmung** zu E24 (Felder an einer Capability, die Spec 6.2 ohne `*` nennt, und Zusatzfelder aus Anhang A, je mit
   Fundstelle in Tasks 17–22) und E25 (DataLink-Texte kommen vom Tool). Lehnt er E24 ab, ändern sich Tasks 17–22, lehnt er
   E25 ab, ändert sich Task 21.
2. **Zur Kenntnis:** die Auslegungen E1–E4; E27 (Zahlen- und Textfeld zeigen nach 2 s ohne Antwort des Tools „Noch nicht
   übernommen.“); die sieben Kontrast-Befunde im Bestand („Unklarheiten“); die bekannte Ausnahme aus E23 (die Abschnitte
   rendern den Bestands-`Button`, dessen Hover-Fläche `--highlight` ist; Gelb ist im Panel damit nicht ganz „ausgewählt“
   vorbehalten).
3. **Zur Kenntnis, Wortlaut:** Der Sperrtext lautet „Gesperrt: solange der Eingang offen ist“ statt Spec 6.2 „Gesperrt,
   solange der Eingang offen ist“, weil `Field` jedem Grund „Gesperrt: “ voranstellt (Task 20, „Abweichungen“). Der
   Interpreter-Satz aus Spec 6.2 passt nicht zum Code (E17); geklärt wird er in Welle 2.

**Entschieden (Owner, 08.10.2026):** E24 zugestimmt, E25 zugestimmt, der Text aus E27 „Noch nicht übernommen.“ freigegeben;
E1–E4, die Kontrast-Befunde, die Ausnahme aus E23 und der Sperrtext mit Doppelpunkt sind zur Kenntnis genommen. Umsetzung
per Workflow (subagent-driven), Start nach dem Neustart des Rechners am 08.10.2026.

## Nach der Umsetzung (nur Controller und Owner)

Dieser Abschnitt beschreibt, was nach Task 25 geschieht. Er ist keine Aufgabe für ausführende Agenten.

- Der Controller lässt den ganzen Branch von einem frischen Reviewer prüfen: Spec-Treue, Review Focus 1–5, Bestandsschutz,
  die Entscheidungen Z1–Z10. Befunde gehen als Nachbesserung in diesen Plan.
- Ein Pull Request gegen `main` zeigt in der CI „Typecheck (alle Workspaces)“ und „Selbsttests“ grün; reine Doku-Commits
  lösen keine CI aus (`paths-ignore`). Der Link `node_modules/@jm/settings` entsteht dort durch `npm ci`.
- Der Owner sieht die Galerie (`npm run galerie -w @jm/ui`, `http://127.0.0.1:5199/`) in Dunkel und Hell und in der
  Schmal-Ansicht durch (die Entscheidungen hat er unter „Vor der Umsetzung“ getroffen). Was kein Test ohne Browser messen
  kann, prüft er an diesen Punkten (je mit erwartetem Ergebnis; Einzelheiten unter „Für die Galerie“ der genannten Aufgabe):
  1. **Statusleiste** (Task 8): Die Uhr springt im Gleichtakt mit der Systemuhr weiter (etwa neben der Uhr der Taskleiste),
     ohne eine Sekunde zu überspringen. Ein live-Eintrag ist rot gefüllt mit ■ und „LIVE“, ein error-Eintrag daneben nur
     rot umrandet mit ⚠. Hover über einem Eintrag mit Knopf unterstreicht ihn, ohne Fläche. Im 800-px-Rahmen zeigen die
     Einträge nur Symbol und Label.
  2. **TallyButton** (Task 9): Maus, Leertaste und Enter erhöhen „gedrückt“ und „losgelassen“ je genau um 1; Auto-Repeat
     zählt nicht, und Enter lange halten erhöht „Klicks“ genau um 1. Maus aus dem Fenster ziehen, Alt+Tab, „in 2 s sperren
     (dabei halten)“ und „in 2 s ausblenden (dabei halten)“ → je „losgelassen“ +1, danach sind beide Zähler gleich
     („wieder einblenden“ holt den Knopf zurück). Rechte Maustaste zählt nicht.
  3. **Zahlenfeld im Panel** (Task 10): „abc“ bzw. „70000“ und Enter → Fehlertext unter dem Feld, der Text bleibt. Escape
     nach einer Änderung stellt den alten Wert her und lässt das Panel offen; ein zweites Escape schließt es. Tool lehnt ab
     (E27): Im Port-Beispiel „80“ und Enter → nach etwa 2 s „⚠ Noch nicht übernommen.“, der Text bleibt; Tab aus dem Feld
     meldet nicht erneut; Escape stellt den alten Wert her. Ebenso der Quellenname im NDI-Abschnitt (die Galerie übernimmt
     keine Namen).
  4. **Hell/Dunkel** (Task 12): Ein Klick wechselt `<html>` und **beide** Schalter der Galerie; nach Neuladen bleibt der
     Modus. Mit blockierten Website-Daten startet die Galerie in Dunkel ohne Konsolenfehler, Umschalten wirkt bis zum
     Neuladen.
  5. **Panel** (Task 13): Öffnen über einen Statuseintrag springt zum Abschnitt; der Rand hebt ihn etwa 1,5 s hervor (ohne
     Fläche), dann verschwindet er. Escape mit Fokus im Panel schließt es, der Fokus steht wieder auf ⚙ bzw. dem
     Statuseintrag; Escape mit Fokus im Inhalt schließt es nicht.
  6. **Rahmen** (Task 15, 23): 1200 px mit Panel daneben, 800 px mit Panel über dem Inhalt, kompakt mit 36/24 px, der Rahmen
     ohne Sitzung mit leerer Statusleiste, Uhr und ohne ⚙; Kopf- und Statusleiste bleiben immer ganz sichtbar.

  Nachgetragen nach der Umsetzung (Gesamtprüfung 09.10.2026; Grund je Punkt unter „Umsetzung: Abweichungen vom Plantext“):

  7. **Take ziehen** (Task 9, Ruling T9): „Take“ (Knopf nur mit Klick) drücken, mit gedrückter Maus vom Knopf wegziehen,
     außerhalb loslassen → „Klicks“ bleibt unverändert. Erst danach gilt der Fix (kein Pointer Capture ohne Halten) als
     gemessen; ohne Browser ist nur „kein `setPointerCapture`“ geprüft.
     **Widerrufen (Restpunkte 09.10.2026, R1):** Der Zähler „Klicks“ gehört zum Knopf „Sprechen (halten)“ (HaltenProbe,
     mit `onPress`/`onRelease`, also mit Pointer Capture); im Beispiel mit dem Knopf „Take“ gab es keinen Zähler. Der Text
     oben misst deshalb den falschen Knopf. **Es gilt:** Galerie, Gruppe „TallyButton“, Beispiel „bereit“: Knopf „Take“ (nur
     Klick, ohne Halten) mit dem Zähler „Take-Klicks: n“ darunter.
     (a) „Take“ einmal normal anklicken → „Take-Klicks“ steigt um 1 (der Zähler lebt).
     (b) „Take“ mit der linken Maustaste drücken, mit gedrückter Taste den Zeiger ganz vom Knopf wegziehen, außerhalb des
     Knopfs loslassen → „Take-Klicks“ bleibt gleich. Steigt er, ist der Fix nicht wirksam (Befund).
     Gegenprobe (abgeleitet aus Pointer Events L3, nicht gemessen): dasselbe Ziehen am Knopf „Sprechen (halten)“ erhöht dort
     „Klicks“ um 1, weil dieser Knopf den Zeiger fängt. Bleibt auch dort „Klicks“ gleich, zeigt (b) allein nicht, dass der
     Weg den Fehler hätte zeigen können; ein Befund gegen den Fix ist das nicht.
  8. **Panel-Schalter + Leertaste** (Task 13): Im offenen Panel einen Schalter anklicken, dann Leertaste. Die Galerie hat
     kein Tool-Kürzel; dort schaltet die Leertaste den Schalter (Browser-Standard). In einem Tool mit Leertaste = GO
     (Rundown, Player) geht die Taste nach heutiger Regel ans Tool: GO, und der Schalter schaltet nicht. Ob das so bleibt,
     ist die offene Owner-Frage O1 (unten); geprüft wird es mit dem ersten Tool, das ein Panel und ein Leertasten-Kürzel hat.
     **Nachtrag 09.10.2026:** O1 ist entschieden – es bleibt so (Leertaste auf Schalter oder Knopf im Panel geht ans Tool,
     Escape mit Fokus im Panel schließt immer das Panel). Der Punkt prüft beim ersten solchen Tool, dass es so wirkt.
  9. **800 px: alle Statuseinträge sichtbar** (Task 8, 15): In beiden 800-px-Rahmen steht jeder Statuseintrag ganz da
     (Symbol und Label), keiner ist rechts abgeschnitten oder umgebrochen. Ein fehlender Eintrag ist ein Befund (die
     Leiste schneidet mit `overflow-hidden` ohne Hinweis ab).
  10. **Gegenstellen: Port ungültig** (Fix-Welle, Task 22): In einem Gegenstellen-Beispiel ins Portfeld „abc“ tippen →
      „Setzen“ ist sofort gesperrt, darunter „Setzen geht erst mit einem gültigen Port.“; Escape → der Port steht wieder
      da, „Setzen“ ist frei.

  Nachgetragen nach den Owner-Entscheiden O1–O4 (09.10.2026; Grund unter „Owner-Entscheide O1–O4“):

  11. **Auf Sendung und gesperrt** (O2): Galerie, Gruppe „TallyButton“, Beispiel „auf Sendung und gesperrt“, in Dunkel
      und Hell: rote Fläche mit „LIVE“ und „Kamera 2“, darunter „Während der Überblendung gesperrt“ in derselben großen
      hellen Schrift, in beiden Modi gut lesbar; über dem Knopf zeigt der Mauszeiger „nicht erlaubt“. Dann im Beispiel
      „Halten zum Sprechen“:
      (a) „live + gesperrt“ wählen → der Knopf zeigt „LIVE“ und „Zum Ausprobieren gesperrt“; Maus, Leertaste und Enter
      ändern keinen Zähler.
      (b) „live“ wählen, „in 2 s live sperren (dabei halten)“ anklicken und den Knopf mit der Maus (danach noch einmal
      mit der Leertaste) halten → nach etwa 2 s „losgelassen“ +1, „LIVE“ bleibt sichtbar, danach sind „gedrückt“ und
      „losgelassen“ gleich. Steigt „losgelassen“ nicht, wirkt der Effekt nicht (Befund).
      Wirkt die große Grund-Zeile zu wuchtig, ist das ein Gestaltungsbefund; die Alternativen stehen unter
      „Owner-Entscheide O1–O4“.
- Vor dem Merge entscheidet bzw. bestätigt der Owner die Punkte unter „Umsetzung: Abweichungen vom Plantext“ →
  „Offene Owner-Fragen“ (O1–O4) und nimmt die Owner-Info zum Badge-Kontrast zur Kenntnis. O1 und O2 müssen spätestens vor
  Welle 1 entschieden sein, O3 und O4 vor dem Merge. **Nachtrag 09.10.2026:** O1–O4 sind entschieden (siehe
  „Owner-Entscheide O1–O4“).
- Gemergt wird nach Freigabe durch den Owner. Es gibt **keinen** Release: `@jm/ui` und `@jm/settings` werden mit den Apps
  gebündelt; die Apps sehen unverändert aus (4.1), ihr CSS wird nur etwas größer. Der erste Release mit den neuen Bausteinen
  ist der Titler-Pilot. Er bekommt einen **eigenen Plan nach dem Merge von Master-Link 2b R2 und Zoom 4b**; dort kommen auch
  die Status-Brücken (3.9, UO3), die `@source`-Zeile für `packages/settings/src` im Titler und der Weg für „Im Launcher
  einrichten“ (E15).
- Danach werden `docs/roadmap.md` (Lane E: „Fundament gemergt“; Abschnitt 3 „Was läuft wann“, den Task 25 wegen der
  Parallel-Vorhaben nicht anfasst) und der Roadmap-Index nachgeführt.

## Umsetzung: Abweichungen vom Plantext (Nachtrag 09.10.2026)

Dieser Abschnitt ist ein Nachtrag nach der Umsetzung. Der Plantext oben bleibt als gemessener Stand vor der Umsetzung
stehen (alter Text bleibt, er wird hier widerrufen, nicht umgeschrieben). Umgesetzt wurde per Workflow (subagent-driven)
auf dem Branch `feat/ux-welle0-fundament` ab `43f10e9be7`. Wo die Umsetzung vom Plantext abweicht, hat der Controller
entschieden („Ruling“, Politik „Spec vor Plantext“: ein vom Plan verordneter Befund gegen die Spec wird behoben), und ein
Review hat jede Fix-Runde geprüft; die letzte Runde jeder Aufgabe endete mit 0 offenen Punkten. Das Protokoll der
Umsetzung liegt git-ignoriert unter `.superpowers/sdd/`; die Begründungen stehen deshalb hier. Maßgeblich für den Code ist
der Branch.

### Ablauf-Entscheide K1–K6 (ohne Wirkung auf den Code)

| # | Entscheid |
| --- | --- |
| K1 | Der Scratchpad-Ordner aus G16 (`…/ux-sdd`) fehlte; er wurde vor Task 1 Step 9 einmal angelegt, danach liefen die G16-Ketten unverändert. |
| K2 | Das Bash-Werkzeug startete im Protokoll-Ordner; jeder Befehlsblock des Plans lief als Subshell `( cd <worktree> && … )`. |
| K3 | Es gilt die Dateiliste aus G1, obwohl Spec 9.2 nur `packages/ui` und `packages/settings` nennt (CI-Schritt, Lockfile und Roadmap-Kurzfassung verlangt die Spec selbst; G15 hält Abstand zu 2b R2 und 4b). |
| K4 | Junctions werden in der Plan-Form `MSYS_NO_PATHCONV=1 cmd /c rmdir` einzeln entfernt, erst danach `rm -rf`. |
| K5 | iveo (Task 21) ohne eigenes Feld „Status“: der Status steht in der Kopf-Pille, Event, Bühne und Speaker als Zeilen. |
| K6 | Task 12 Probe e braucht zusätzlich den Import-Tausch `useSyncExternalStore` → `useState`; sonst bricht sie mit `ReferenceError` ab statt mit 1 `FAIL`. |

### Abweichungen im Code (23 Rulings)

| Task | Abweichung (Plantext → Branch) | Grund | Commit(s) |
| --- | --- | --- | --- |
| 3 | Quellregel 1: statt 14 Farbtönen `ROHE_FARBKLASSE` mit allen 26 Paletten aus Tailwind 4.3.0 (auch mauve, olive, mist, taupe) und weiteren Präfixen (border-x/t/r/b/l/s/e, ring-offset, divide, placeholder, decoration, accent, caret, shadow, inset-shadow, inset-ring, drop-shadow); `white`/`black` verboten, `current`/`transparent` erlaubt | `bg-sky-500`, `text-violet-400` u. a. liefen durch (G3); Tasks 9 und 13 brauchen `transparent`/`current` | a40ab380ff, d19c0ee59c |
| 3 | Quellregel 9 („keine Kurzform `-(--…)`“) ersetzt durch `TOKEN_OHNE_VAR` (`/(?<!var)[[(:,]\s*--[a-z]/`): ein Token nach `[ ( : ,` nur als `var(--name)` | Die v3-Form `bg-[--x]` erzeugt mit Tailwind 4.3.0 ungültiges CSS, `bg-(color:--x)` lief an Regel 9 vorbei (gemessen) | a40ab380ff |
| 6 | `halten.ts`: `druecken` merkt sich `onRelease` des Drucks, `loesen` ruft den neuesten, sonst den gemerkten | Fehlte `onRelease` im neuesten Satz während des Haltens, ging das Release zu einem gemeldeten `onPress` verloren (hängender Talkback) | 319a8063fe |
| 7 | Feldtext und Grenzen im Fehlertext über `zahlTextVoll` (ohne Rundung) statt `zahlText` | Das Zahlenfeld zeigte gerundete Werte und konnte sie dann nicht setzen; der Fehlertext nannte eine falsche Grenze | 3dbf7c8722 |
| 8 | Fokusring des Statusknopfs innen (`focus-visible:-outline-offset-2` statt `outline-offset-1`) | Die `overflow-hidden`-Region ist so hoch wie der Knopf und schnitt den Ring ab | 0e01abdd75 |
| 9 | `TallyButton` setzt `setPointerCapture` nur bei echtem Halten (`onPress`/`onRelease`), nicht bei einem reinen Klick-Knopf | Mit Capture käme der Klick auch nach „drücken, wegziehen, loslassen“ (Pointer Events L3, abgeleitet, ohne Browser nicht gemessen; Owner-Prüfpunkt 7) | e7c66efc9e |
| 10 | `NumberInput` verwirft beim Sperren einen angefangenen Entwurf; ein gesperrtes Feld nimmt weder Tippen noch Verlassen an (`zahlSchrittMitSperre`, Sperre per Ref) | Kreuzfall gesperrt × Entwurf: das gesperrte Feld zeigte den ungemeldeten Text und meldete ihn nach dem Entsperren bzw. bei einem blur beim Sperren | 19951cce04 |
| 10 | Neues Token `--field-border` für den Eingaberand (`EINGABE_KLASSE`) statt `--border` | `--border` erreicht auf den Flächen nur 1,2–1,4 : 1, E3 verlangt für Ränder 3 : 1; Owner-Freigabe offen (O3) | 19951cce04 |
| 11 | `Toggle` „aus“: Spur mit `--field-border` statt `--border`; zwei Kontrastpaare mehr (`--muted-foreground` auf `--input` und `--background`) | wie Task 10 (Grafik 3 : 1) | fec9fc9d2a |
| 13 | `panelTaste`: Der Plan stoppte nur Escape. Nach vier Fix-Runden stoppt das Panel Escape (schließt, wenn nicht `defaultPrevented`) und jede Taste, deren Ziel ein Feld ist (INPUT außer Knopf-Typen, SELECT, TEXTAREA, contentEditable), auch mit Strg/Meta/Alt; Knöpfe, Schalter, Links, Panel und Abschnitte lassen alle Tasten zum Tool | Tippen in einem Panel-Feld löste Tool-Kürzel aus (Rundown GO, Presenter Strg+Pfeil, Prompter Alt+Pfeil, Timer Strg+R). Ein Stopp auch auf Knöpfen (Runde 2) verletzte Spec 10 „Kürzel bleiben gleich“. Die Folgen auf Panel-Schaltern und bei Escape sind offene Owner-Frage O1 | 45a17f179c, 2f75cec41e, 6b62a2b34c, ed5a30e4d6 |
| 13 | Der Sprung zu `sectionId` setzt den Fokus auf den angesprungenen `PanelAnker` (`tabIndex={-1}`) | Der Fokus landete unsichtbar auf dem `<aside>` (`outline-none`) statt im Abschnitt | 45a17f179c |
| 15 | Tests sichern die Kernzusage „verdeckt Kopf- und Statusleiste nie“ (Klassen der Inhaltszeile und von `<main>`) | Kein Test prüfte sie | 2a92adbd21 |
| 15 | `onClose={panelSchliessen(p)}` als reiner Prop-Bauer; Tests der Weiterleitungen `onAir`, `headerCenter`, Schließen | Vier Weiterleitungen waren ungetestet; eine leere `onClose` bliebe grün | 2a92adbd21 |
| 16 | Quellregeln in `@jm/settings` übernehmen `ROHE_FARBKLASSE`, `TOKEN_OHNE_VAR` und das Importmuster (auch `import 'electron'`) aus `@jm/ui` | Plantext Task 16 hatte die alten, engen Muster; die Lücke aus Task 3 stünde sonst in settings offen | 5f01ed10d2 |
| 16 | `abschnittStatusItem`: ein eigenes Detail des Tools ersetzt den Statustext nur bei `ok`, sonst `{detail} · {status}` | „unbekannt“, „an (ohne Rückmeldung)“ und „Fehler: …“ verschwanden sonst aus der Statusleiste (Spec 7.2/7.3) | 5f01ed10d2 |
| 19 | Schalter „Steuerserver“ nur bei `typeof enabled === 'boolean'`, sonst Anzeige „unbekannt“ | `enabled === true` las `undefined` als „aus“ (G6) | 13d26ac365 |
| 20 | Audio: gemessen leere Geräteliste mit `value ''` ist nie `ok` (off „kein Gerät gewählt“, Pflichtwahl warn) | Sonst „ok {Systemstandard}“ ohne jedes Gerät | 485785c214 |
| 22 | Erklärung zu Setzen/Auto nur, wenn der Auto-Knopf (`capabilities.auto` und `onAuto`) und `onSet` da sind | Sonst stand die Erklärung ohne die Knöpfe, die sie nennt | a52ae1bed8 |
| 22 | Setzen über `peerSetzen`: kein Aufruf ohne gültigen Port (das `?? row.port` entfällt), Knopf dann gesperrt | Setzen sendete eine Zahl, die das Feld nicht zeigte (Port 0 statt Standardport). Restlücke bei ungültigem Entwurf: F1 unten | a52ae1bed8 |
| 22 | Auto setzt Host und Port des lokalen Entwurfs zurück (`peerAuto`) | Nach Auto blieb ein getippter Host stehen | a52ae1bed8 |
| 22 | Quelle „manuell: …“ nur mit Host | Sonst „manuell: :7777“ neben „nicht gefunden“ | a52ae1bed8 |
| 22 | Verhaltenstests ohne DOM für `peerSetzen`, `peerAuto`, `peerToggle` und die Sperre im Stage-Muster | Die Tests prüften nur das Markup | a52ae1bed8 |
| 23 | Galerie: Zahlenfeld im offenen Panel (`fernsteuerung` mit `portEditable`); in den Fix-Runden dazu „Auswahl mit Fehler“ und Audio ohne Geräte ohne gewählten System-Standard (Ursache in `audio-device.ts` `wahlView`) | Owner-Prüfpunkt 3 war sonst nicht durchführbar; Pille „off“ und Auswahl „System-Standard“ widersprachen sich | 53150dbb00, 10a187fd8c |

### Fix-Welle nach der Gesamtprüfung (09.10.2026)

| # | Befund | Änderung | Commit(s) |
| --- | --- | --- | --- |
| F1 | Setzen (Gegenstellen) schickte bei einem ungültigen Entwurf im Portfeld („abc“, „70000“, leer) den letzten gültigen Port, während unter dem Feld der Fehler stand | `NumberInput` meldet auf Wunsch die Gültigkeit des Entwurfs (`onEntwurfGueltig`, rein: `zahlEntwurfGueltig`, ungültig schon beim Tippen); `peerSetzen` ruft ohne gültigen Port nicht auf; der Knopf ist dann gesperrt mit dem sichtbaren Grund „Setzen geht erst mit einem gültigen Port.“ (`aria-describedby`), auch bei leerem Portfeld; ist der Abschnitt gesperrt, steht nur dessen Grund. Neuer Text: O4 | afae09b29f, 894ccb64ea |
| F2 | Transparenz (NDI) und Vollbild (Bildschirm) zeigten bei gesetzter Capability und nicht gemeldetem Wert den Schalter „aus“ (G6, Spec 7.2) | Anzeige „unbekannt“ statt Schalter, wie der Steuerserver (Task 19) | e24dd60c81 |
| F3 | Text-Entwurf (Quellenname, Hintergrund) kannte keine Sperre: das gesperrte Feld zeigte den ungemeldeten Text, das erste Verlassen nach dem Entsperren meldete ihn (NDI-Sender startet neu) | wie `NumberInput` (Task 10): `textSchrittMitSperre`, Sperre per Ref im Rendern, Verwerfen beim Sperren; `NdiOutputSection` und `ScreenOutputSection` geben die Sperre weiter | 12f3e7c9aa |
| F4 | Ein Sperrgrund nur aus Leerzeichen ergab eine leere Grund-Zeile (`TallyButton`) bzw. „Gesperrt: “ ohne Grund (`Field`, `istGesperrt`) | gilt jetzt als leer: `TallyButton` zeigt „gesperrt – kein Grund angegeben“, `Field` und Abschnitt sind nicht gesperrt (wie bei einem leeren Grund) | 9349628f70, 29a04dcd10 |
| F5 | Nachvollziehbarkeit: Rulings nur im git-ignorierten Protokoll, Zählstände und Task 3 im Plan veraltet, Prüfpunkte fehlten | dieser Abschnitt, die Nachträge bei „Testläufe“, „Gemessene Zählstände“ und Task 3, Owner-Prüfpunkte 7–10, Spec 10 (Panel-Tasten in der Funktionsliste) | Doku-Commit der Fix-Welle |

Restpunkt aus F1 (nicht behoben, kein Live-Risiko): Drückt man „Auto“, während im Portfeld ein ungültiger Entwurf steht,
setzt die Zeile den Port auf den angezeigten Wert zurück; ist das derselbe Wert wie vorher, bleibt der ungültige Entwurf
im Feld stehen (`NumberInput` folgt einem Wert von außen nur ohne angefangenen Entwurf). „Setzen“ bleibt dann mit Grund
gesperrt, Escape stellt den Port her.

### Restpunkte nach der Nachprüfung der Fix-Welle (09.10.2026)

Die Nachprüfung der Fix-Welle fand drei Restpunkte; der Controller hat sie entschieden (Rulings P1–P3). Tests jeweils
zuerst rot, dann grün; jede Prüfung zusätzlich mit einer Mutationsprobe (Eingriff im Code → die neue Prüfung schlägt fehl).

| # | Befund | Änderung | Commit(s) |
| --- | --- | --- | --- |
| R1 | Owner-Prüfpunkt 7 („Take ziehen“) maß am Zähler „Klicks“ der HaltenProbe, deren Knopf `onPress`/`onRelease` hat und damit den Zeiger fängt, also nicht den Fix aus Ruling T9 (kein Pointer Capture ohne Halten); der reine Klick-Knopf „Take“ hatte keinen Zähler | Galerie, Beispiel „bereit“ (`TakeProbe`): unter „Take“ (nur `onClick`) steht „Take-Klicks: n“. Prüfpunkt 7 oben widerrufen und neu beschrieben (Knopf, Ziehen, Ergebnis, Gegenprobe). Galerie-Test: Pflichtmarke „Take-Klicks: 0“ im Beispiel `tally-bereit` und Quellprüfung, dass der Baustein mit dem Zähler kein `onPress`/`onRelease` übergibt | 46e9e3d655 |
| R2 | Bildschirm: Mit `capabilities.background` und nicht gemeldetem `background` stand ein leeres Farbfeld (G6, Spec 7.2) | Anzeige „unbekannt“ statt des Felds, wie Vollbild und Transparenz (F2) | d86f6ddc66 |
| R3 | Gegenstellen: `PeerRow.enabled` undefined galt als „an“ (Schalter „Aktiv“ an, Zeile zählte als aktiv) | Nur mit `capabilities.toggle` (Stage-Display-Muster, das Ein/Aus je Quelle meldet): `enabled` undefined ist „unbekannt“; statt des Schalters steht „Aktiv: unbekannt“, die Zeile zählt nicht in n von „{k} von {n} verbunden“ und lässt weder „verbunden“ noch „keine Gegenstellen“ zu (dann „unbekannt“; sonst läse der Status das fehlende `enabled` als „aus“). `PeerZeileView.aktiv` ist `boolean \| undefined`. Ohne `capabilities.toggle` bleibt ein weggelassenes `enabled` „an“: Rundown, Q&A und Battle kennen kein Aus je Gegenstelle (Spec 6.2 nennt kein Ein/Aus, Anhang A nur beim Stage-Display „Quellen (an/aus …)“, `ConnectionsPanel` und `ToolLink` haben kein `enabled`; `PeerRow`: „nur mit capabilities.toggle“) | 6c48060908 |

Nicht ohne Browser messbar bleibt R1 selbst (ob der Klick nach dem Wegziehen ausbleibt): dafür Owner-Prüfpunkt 7 in
der neuen Fassung. Neue Nutzertexte: keine außer dem Galerie-Zähler „Take-Klicks: n“ (nur Galerie, kein Tool).

### Zählstände

| Stand | `@jm/ui` ok | `@jm/settings` ok | Galerie-Probe | Titler-Probe (Task 24, 5.5) |
| --- | --- | --- | --- | --- |
| Plantext (Tasks 23–25) | 520 | 329 | 20 `ok`, CSS 36,83 kB | 19 `ok`, CSS 49,37 kB |
| nach Task 24 | 601 | 397 | 20 `ok`, CSS 37,03 kB | 19 `ok`, CSS 49,61 kB |
| nach der Fix-Welle | 605 | 412 | 20 `ok`, CSS 37,03 kB | 19 `ok`, CSS 49,61 kB (dieselbe Datei `index-BGcmn55R.css`) |
| nach den Restpunkten R1–R3 | 606 | 419 | 20 `ok`, CSS 37,03 kB (dieselbe Datei `index-MHt1Wgnh.css`, Klassen 71/30) | nicht neu gebaut |
| nach den Owner-Entscheiden O1–O4 | 625 | 419 | 20 `ok`, 13 Tokens, CSS 37,03 kB (dieselbe Datei `index-MHt1Wgnh.css`, Klassen 71/30) | nicht neu gebaut |

Die Differenz zum Plantext kommt nur aus den Rulings oben (zusätzliche Prüfungen; `--field-border` und neue Klassen im
CSS). Typprüfung aller Workspaces nach der Fix-Welle: `Exit=0`, 31 Workspaces, 0 `error TS`.
Nach den Restpunkten R1–R3 ebenso: `Exit=0`, 31 Workspaces, 0 `error TS`.
Nach den Owner-Entscheiden O1–O4 ebenso: `Exit=0`, 31 Workspaces, 0 `error TS`. Die 19 neuen `ok` in `@jm/ui`: 10 im
TallyButton-Test, 4 im Kontrast-Test, 5 im Galerie-Test (O2 und O3).

### Neues Token `--field-border` (Owner-Freigabe O3)

Rand von Eingabefeldern (`EINGABE_KLASSE` in `Field.tsx`) und Spur des ausgeschalteten `Toggle`; rein additiv (G2), in
`signal-colors.css` als achtes Token. Werte: dunkel `oklch(0.58 0 0)`, hell `oklch(0.6 0 0)`. Kontrast (Grafik, 3 : 1
verlangt) dunkel auf `--background`/`--card`/`--surface-raised`/`--input` 4,41/4,09/3,74/3,52, hell 3,95/3,78/3,95/3,12.
Spec 4.2 kennt den Namen nicht; `tokens.test.ts` führt ihn. Noch nicht nachgezogen (darf nach dem Merge folgen, sinnvoll
erst nach der Freigabe): die Farbkachel der Galerie (`FARBEN` in `galerie/beispiele-ui.tsx`) und `NEUE_TOKENS` der
Klassen-Probe (`galerie/pruefe-klassen.ts`, heute 12; der Galerie-Test prüft `NEUE_TOKENS.length === 12`).
**Nachtrag 09.10.2026:** Der Owner hat das Token freigegeben (O3). Farbkachel („Rand von Eingabefeldern“) und
`NEUE_TOKENS` (jetzt 13) sind nachgezogen (3e2c07f845); der Galerie-Test prüft 13 Namen mit `--field-border` und die
Kachel im Beispiel „farben“, die Klassen-Probe die Definition im gebauten CSS.

### Owner-Info: Badge-Kontrast hell

Zur Kenntnis genommen hat der Owner am 08.10. die Bestands-Befunde `--success` bzw. `--warning` auf `--background` hell
mit 3,40 bzw. 2,54 : 1. Der Bestands-`Badge` setzt die Schrift aber auf seine eigene Tönung (`bg-[var(--success)]/12`
bzw. `bg-[var(--warning)]/15`). Darauf gemessen (gleicher Rechenweg wie `kontrast.test.ts`) sind es hell 2,98 bzw. 2,23
über `--background` und `--surface-raised`, 2,87 bzw. 2,14 über `--card`; dunkel bleibt die Klasse erfüllt (6,76 bzw.
10,38 über `--background`, 5,57 bzw. 8,43 über `--surface-raised`). Keine Änderung in diesem Fundament (Bestandsschutz,
Spec 4.1); die Zahlen im Test bleiben die der Paare ohne Tönung.

### Offene Owner-Fragen

**Nachtrag 09.10.2026:** Alle vier sind entschieden (Abschnitt „Owner-Entscheide O1–O4“ unter der Tabelle). Die Tabelle
bleibt als Stand vor dem Entscheid stehen.

| # | Frage | Heute im Branch | Bis wann |
| --- | --- | --- | --- |
| O1 | **Tasten im Panel.** (a) Leertaste auf einem fokussierten Schalter oder Knopf im Panel: Soll sie ans Tool gehen (Rundown, Player: GO; der Schalter schaltet dann nicht, weil das Tool `preventDefault` ruft) oder im Panel bleiben (der Schalter schaltet, kein GO)? (b) Escape mit Fokus im Panel schließt das Panel und erreicht das Tool nie; beim Player ist Escape = Stop. Spec 10 löst Kollisionen „zugunsten des bestehenden Kürzels“, der Baustein hat dafür keinen Schalter. | (a) Taste geht ans Tool (Fix-Runden 3–4 von Task 13: Spec 10 „Kürzel bleiben gleich“); (b) Escape bleibt immer im Panel. Steht als Pflichtpunkt in Spec 10 (Funktionsliste) | vor Welle 1 (Rundown) bzw. Welle 2 (Player); Code je nach Entscheid |
| O2 | **live × gesperrt.** `TallyButton.state` ist genau einer aus „bereit“, „live“, „gesperrt“. Ist eine Quelle auf Sendung und ihr Knopf zugleich gesperrt (z. B. Switcher während einer Überblendung), muss das Tool „gesperrt“ wählen, und die LIVE-Kennung verschwindet. Soll der Baustein „auf Sendung und gesperrt“ zeigen können? | nicht darstellbar | Spec-/Owner-Entscheid vor Welle 1 (Switcher) |
| O3 | **Token `--field-border`** (Name und Werte oben) freigeben. | im Code, ohne Freigabe | vor dem Merge |
| O4 | **Neuer Text** „Setzen geht erst mit einem gültigen Port.“ (Grund am gesperrten „Setzen“, F1) freigeben oder umformulieren. | `PEERS_TEXTE.setzenOhnePort` | vor dem Merge |

### Owner-Entscheide O1–O4 (09.10.2026)

Der Owner hat am 09.10.2026 entschieden; die Form von O2 hat die steuernde Sitzung festgelegt (Ruling, additiv, keine
Bruchstelle). Tests jeweils zuerst rot, dann grün; die neuen Prüfungen von O2 zusätzlich mit Mutationsproben (Eingriff im
Code → die passende Prüfung schlägt fehl).

| # | Entscheid | Umsetzung | Commit |
| --- | --- | --- | --- |
| O1 | **Entschieden: wie umgesetzt.** (a) Die Leertaste auf einem fokussierten Schalter oder Knopf im Panel geht ans Tool (GO bleibt gleich; der Schalter schaltet dann nicht). (b) Escape mit Fokus im Panel schließt immer das Panel | Kein Code. Spec 10 (Pflichtpunkt „Panel-Tasten“) steht auf „entschieden 09.10.2026“; Owner-Prüfpunkt 8 nachgetragen | Doku-Commit |
| O2 | **Entschieden: Der `TallyButton` kann „auf Sendung und gesperrt“ zeigen.** Form: `state` bleibt `'bereit' \| 'live' \| 'gesperrt'`; `'live'` mit `disabledReason` (nicht leer, nicht nur Leerzeichen, dieselbe Regel wie `tallyGrund`) ist auf Sendung UND gesperrt. `'live'` ohne Grund und `'gesperrt'` bleiben unverändert | LIVE-Fläche (`LIVE_FLAECHE_KLASSE`) und Kennung „LIVE“ bleiben, `data-state="live"`; dazu der Grund sichtbar, als `title` und per `aria-describedby`, `aria-disabled="true"` (bleibt fokussierbar), `cursor-not-allowed`. `onClick`, `onPress` und `onRelease` feuern nicht, kein Pointer Capture; ein laufendes Halten lässt sich weiter loslassen. Beim Wechsel live → live + gesperrt endet ein laufendes Halten (`haltenBeiZustand(state, halten, disabledReason)`, der Effekt hängt am Grund). Galerie: Beispiel „auf Sendung und gesperrt“ (beide Modi, Pflichtmarke im Galerie-Test); die HaltenProbe gibt den Grund nur noch bei „gesperrt“ und dem neuen „live + gesperrt“ mit (sonst wäre „live“ seit O2 gesperrt) und hat „in 2 s live sperren (dabei halten)“. Spec 3.4 nachgetragen; Owner-Prüfpunkt 11 | a3af9eef0a |
| O3 | **Freigegeben:** Token `--field-border` (Name und Werte wie im Abschnitt oben) | Farbkachel in der Galerie und `NEUE_TOKENS` (13) nachgezogen, mit Tests | 3e2c07f845 |
| O4 | **Freigegeben:** Text „Setzen geht erst mit einem gültigen Port.“ | Kein Code (`PEERS_TEXTE.setzenOhnePort` bleibt wörtlich) | Doku-Commit |

**Kontrast der Grund-Zeile auf der LIVE-Fläche (O2, gemessen im Kontrast-Test, beide Modi).** Die Grund-Zeile aus
„gesperrt“ (11 px halbfett, `--muted-foreground`) erreicht auf `--tally-live` nur 1,26 (dunkel) bzw. 1,37 : 1 (hell), also
weder Text (4,5) noch Grafik (3). Deshalb trägt die Zeile auf der LIVE-Fläche keine eigene Schrift und Farbe, sie steht in
`LIVE_FLAECHE_KLASSE` (19 px extrafett, `--brand-fg-on-dark`): 3,90 bzw. 5,20 : 1, „groß“ nach E3 (3 : 1). Beide Werte sind
in `kontrast.test.ts` festgeschrieben, und auf der LIVE-Fläche gilt weiter E3: nichts darin setzt eine kleinere Schrift.
Nicht umgesetzt, falls die große Zeile zu wuchtig wirkt (Owner-Prüfpunkt 11): (1) der Grund in normaler Größe in
`--background` wie der live-Eintrag der Statusleiste (4,63 bzw. 5,43 : 1, Text) – dann stünden helle und dunkle Schrift auf
derselben Fläche, und E3 bekäme eine Ausnahme; (2) der Grund unter dem Knopf außerhalb der Fläche – das bräuchte ein
Element neben dem `<button>` und änderte die Anordnung im Tool (der Knopf füllt heute allein seinen Behälter).

**Sperr-Symbol.** Das Ruling nennt „das Sperr-Symbol und den Sperrgrund wie im Zustand `gesperrt`“. Der Zustand
„gesperrt“ hat kein Symbol (gedimmte Fläche und Grund, E9); umgesetzt ist deshalb, was „gesperrt“ zeigt: Grund, Sperre
(`aria-disabled`) und Zeiger, kein neues Zeichen. Ein Schloss-Symbol für „gesperrt“ und „auf Sendung und gesperrt“ wäre eine
eigene Owner-Entscheidung (es änderte auch „gesperrt“).

### Vorgemerkt für die Wellen (aus der Prüfung, keine Aktion vor dem Merge)

Die Prüfung hat weitere kleine Punkte notiert; sie ändern heute kein Verhalten einer App (kein Tool nutzt die Bausteine
vor dem Pilot). Wer einen Baustein in einer Welle einbaut, prüft die passenden Zeilen; nachgemessen sind sie nicht.

| Baustein | Punkt |
| --- | --- |
| `StatusBar` (Task 8) | Einträge ohne `whitespace-nowrap`; eine schmale Leiste schneidet hintere Einträge mit `overflow-hidden` ohne Hinweis ab (Owner-Prüfpunkt 9) |
| `TallyButton` (Task 9) | Leertaste und Enter zählen als dieselbe Quelle, `pointerup` prüft die `pointerId` nicht: ein zweiter Finger oder ein Enter beendet ein Halten früher (sichere Richtung). Ein Knopf mit `onClick` und Halten fängt weiter den Zeiger (Klick nach Wegziehen möglich) |
| `Field`/`NumberInput` (Task 10) | Fehlerzeile und „Noch nicht übernommen.“ ohne `aria-live` |
| `AppHeader` (Task 14) | On-Air-Wechsel ohne `role="status"`; ⚙ mit `aria-expanded` auch ohne `onSettingsToggle` |
| `AppShell` (Task 15) | `settings={liste.length && …}` mit 0 zeigt ⚙ und ein leeres Panel; fallen `settings` bei offenem Panel weg, kommt kein `onSettingsChange(false)`; Werkzeugleiste ohne Umbruch; `h-screen` im mobilen Browser-Tab (Sync-PWA) |
| Text-Entwurf (Task 17) | nach „Noch nicht übernommen.“ kein erneutes Melden ohne Änderung am Text |
| Bildschirm (Task 18) | Tipp „Zweiten Bildschirm wählen …“ auch bei nur einem Bildschirm oder ausgeschalteter Ausgabe; leere Liste mit fehlender Wahl zeigt „nicht verfügbar“ statt „Kein Bildschirm gefunden“ |
| Fernsteuerung (Task 19) | „Aktivieren“ bleibt bei unbekanntem Modus bedienbar; das einmalige Token hängt an `revealedToken`, nicht an `mode === 'secure'` |
| iveo/DataLink (Task 21) | `fileCount`/`speakerCount` ohne `Number.isFinite` (NaN, negativ); Event, Bühne und Speaker stehen bei veralteter Lieferung ohne Kennzeichnung |
| Gegenstellen (Task 22) | Host und Port bleiben ohne `onSet` editierbar; `key={row.role}` vermischt bei doppelten Rollen den Zustand der Zeilen |
