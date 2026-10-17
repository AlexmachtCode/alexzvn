# Suite-UX-Update · Welle 0 „Titler-Pilot“ · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der JM Titler läuft im gemeinsamen Rahmen (`AppShell`), ohne eine Funktion oder Bedienlogik zu verlieren:
- eine Kopfzeile mit der R2-Anzeige „Show vom Master“ in der Mitte, ON AIR, Hell/Dunkel und ⚙;
- ein Live-Bereich mit der CG-Vorschau und vier `TallyButton`s (Take, Clear, ◀ Eintrag, Eintrag ▶);
- die Einstellungen im Panel aus `@jm/settings` plus die tool-eigenen Abschnitte Stil und Grafik-Vorlagen;
- eine Statusleiste, die in keinem Zustand lügt.

Dazu kommen die lesende Master-Link-Brücke in `@jm/app-runtime` (einmal gebaut, in jedem Tool nutzbar) und die lesende
Fernsteuerungs-Meldung des Titlers. Mit dem Release nach diesem Plan wird der Titler 0.12.0; Version und Release sind nicht
Teil der Aufgaben („Nach der Umsetzung“).

**Architecture:**
- **Brücken (Spec 3.9, UO3):**
  - Ein neuer Kanal `jmps:master-link` in `@jm/app-runtime`: das reine Modul `master-link-meldung.ts` und das dünne
    `master-link-ipc.ts`. In `src/index.ts` kommen nur zwei Importzeilen, eine Exportzeile und zwei Aufrufzeilen dazu.
  - Die Brücke hängt am vorhandenen Client und dessen Ereignis `zustand`. Die R2-Zeile `jmps:verbund-anzeige` deckt den
    Link nicht ab (bei Rolle `aus`, `master` oder ohne Kopplungsdatei ist sie immer `null`); sie bleibt allein die V-Zeile
    für `headerCenter` und wird nicht dupliziert (E1).
  - Die Fernsteuerungs-Meldung `{läuft, port, clients, modus, fehler}` des Titlers kommt aus dem vorhandenen Steuerserver
    (Port 8726 fest). Dazu kommt ein lesender Getter `modus()` in `@jm/suite-control-protocol`.
- **Reine Ableitungen zuerst:**
  - `@jm/ui` bekommt die Abbildung Master-Link-Meldung → `StatusItem` und einen Brücken-Hook, der eine späte Antwort nach
    einem Ereignis verwirft.
  - `@jm/settings` bekommt additive Props für DataLink (Pfadfeld, „Ordner entfernen“, externe Quelle, Einträge) und
    Bildschirm (Farbwähler, Standardfarbe).
  - Der Titler bekommt `lib/oberflaeche.ts` (Abschnitts-Props, Statusleiste, Haupttasten, Texte) mit Kreuzprodukt-Tests.
- **Oberfläche in Schritten, nach jedem Schritt lauffähig und ohne Funktionsverlust:**
  1. Rahmen mit Kopfzeile, Statusleiste und Panel, das den alten Einstellungs-Inhalt zeigt (Task 9);
  2. Live-Bereich und Bedienung; Stil und Grafik-Vorlagen ziehen ins Panel (Task 10);
  3. die fünf gemeinsamen Abschnitte aus `@jm/settings` im Panel (Task 11);
  4. Recall-Board (Hell/Dunkel, Ladezustand) und Feinschliff (Task 12).

  Das Ausgabefenster (`?view=output`) bleibt unberührt.
- **Absicherung:**
  - Die Oberflächentests laufen als zweiter `tsx`-Lauf des Titler-Selbsttests mit `tsconfig.test.json` (Render ohne
    Browser, `@jm/ui/testhilfe`); der alte Lauf bleibt mit eigenem Zähler.
  - Die Funktionsliste entsteht vor dem Umbau (Task 1) und wird danach mit einem dauerhaften Test abgehakt (Task 13); dazu
    die Abnahme-Datei für den Owner (Task 14).
  - Eine Klassen-Probe läuft auf dem gebauten Titler-CSS (die `@source`-Zeile für `packages/settings/src`).

**Tech Stack:** TypeScript 5.9, React 18.3 (`react-dom/server` `renderToStaticMarkup`), Tailwind 4 (Arbiträrklassen auf
Tokens, `@source`), Electron 33 (nur Typprüfung und `electron-vite build`, kein Start), zustand 4.5.7, `tsx` 4.22 für die
Selbsttests von Titler, `@jm/ui`, `@jm/settings` und `@jm/app-runtime` (dort `test/verbund.test.ts`); den bestehenden
Selbsttest von app-runtime (`test/selftest.ts`) und den des Steuerprotokolls startet `node --experimental-strip-types`.
Gemessen mit Node 24.16.0, tsx 4.22.4, TypeScript 5.9.3, React 18.3.1, esbuild 0.21.5 unter Windows 11; die CI läuft mit
Node 22 (Selbsttests) und Node 20 (Typprüfung) und `npm ci --ignore-scripts`.

**Spec:** `docs/superpowers/specs/2026-10-08-suite-ux-update-design.md`, vom Owner freigegeben am 08.10.2026 mit UO1–UO8
(UO1: Anhang A gilt; UO3 ja: lesende Status-Brücken; UO5: keine neuen Kürzel).
- Umfang laut Spec 9.1/9.2 „Pilot“: 3.9, 5.1, 6 (Anwendung), 7, 8, 10, 11 (App-Teil), 12 und Anhang A „Titler“.
- Grundlage ist das Fundament (PR #250, Plan `docs/superpowers/plans/2026-10-08-suite-ux-fundament.md`) mit den
  Owner-Entscheiden O1 (Leertaste auf einem Panel-Schalter geht ans Tool, Escape schließt immer das Panel) und O2 (live und
  gesperrt zeigt LIVE und „Gesperrt: {Grund}“).
- Plan und Spec gehören zusammen. Bei Widerspruch gilt die Spec, und die Abweichung wird gemeldet. Die Auslegungen E1–E25
  stehen unter „Entscheidungen“, die echten Owner-Fragen unter „Owner-Fragen“ (OF1–OF14, je mit Vorgabe; vom Owner am
  15.10.2026 alle bestätigt).
- Bedienlogik, Protokolle, Ports, IPC und Hauptprozess bleiben unverändert (U6). Die zwei benannten Ausnahmen N1
  (Master-Link-Brücke) und N2 (Fernsteuerungs-Meldung) und die benannten Änderungen der Bedienlogik L1–L6 stehen in G2.

**Messbasis und Arbeitsort:**
- Geplant und gemessen ist gegen den echten `main` `5e5b234ec3` (Titler 0.11.0, Timer 0.14.0, Rundown 0.8.0, Launcher
  0.15.0; enthält UX Welle 0 = PR #250, Zoom 4b = PR #251, Titler 0.10.1 = PR #253 und Master-Link 2b R2 = PR #254).
  Maßgeblich ist der echte Code, der durch Fix-Runden vom R2-Plan abweicht.
- Ausgeführt wird in einem eigenen Worktree ab diesem Stand, mit `node_modules` aus `npm ci --ignore-scripts`, sodass
  `node_modules/@jm/settings` existiert (Task 7 Step 0 prüft das). Alle Pfade relativ zur Repo-Wurzel, Befehle im
  Bash-Werkzeug (Git Bash).
- Zeilenangaben gelten für `5e5b234ec3` bzw. für den Stand nach der vorigen Aufgabe; maßgeblich ist immer der wortgleiche
  Vorher-Text. Ist `main` vor der Umsetzung weiter, misst der Controller nach („Vor der Umsetzung“).

**Aufbau:** 16 Aufgaben (Tasks 1–16, im Gerüst C1–C16) in vier Blöcken. Jede braucht nur, was davor fertig ist.

| Block | Aufgaben | Inhalt |
| --- | --- | --- |
| A | 1–4 (C1–C4) | Funktionsliste vor dem Umbau, Master-Link-Brücke, Fernsteuerungs-Meldung, Preload und Typen |
| B | 5–8 (C5–C8) | Ableitungen: `@jm/ui` (Master-Eintrag, Brücken-Hook), `@jm/settings` (additive Props), Titler-Testwerkzeug, Titler-Ableitungen |
| C | 9–12 (C9–C12) | Oberfläche: Rahmen mit Statusleiste, Live-Bereich und Bedienung, Panel, Recall-Board und Feinschliff |
| D | 13–16 (C13–C16) | Funktionsliste abhaken, Abnahme-Datei, Doku, Gesamtprüfung |

**Wie dieser Plan entstanden ist:** Ein Gerüst hat Aufgaben, verbindliche Schnittstellen, Entscheidungen und Owner-Fragen
festgelegt. Vier Schreiber haben die Blöcke ausformuliert und ihre Schritte in Kopien von `5e5b234ec3` gemessen, Block B bis
D teils gegen Nachbauten der früheren Blöcke. Beim Zusammensetzen wurde der fertige Plantext maschinell und wörtlich in
**eine** frische Kopie von `5e5b234ec3` eingespielt, Aufgabe für Aufgabe in Planreihenfolge: Jede Vorher-Stelle passte genau
einmal, nach jeder Aufgabe liefen die betroffenen Selbsttests und die Typprüfung, jede Rot-Meldung und jeder Zählstand wurde
nachgemessen und im Plantext auf die Messung gesetzt. Widersprüche zwischen den Blöcken sind im Plantext behoben und unter
„Beim Zusammensetzen: Abweichungen und Entscheidungen der Montage“ (Z1 ff.) begründet. Danach wurde der ganze Plantext
ohne Tests in eine zweite frische Kopie gespielt; alle berührten Dateien waren Byte für Byte gleich. Alle Zahlen in diesem
Plan sind die gemessenen (Tabelle „Gemessene Zählstände“).

Danach haben vier Prüfer den Plan geprüft (Spec-Abdeckung, Code-Treue, TDD und Robustheit, Funktionsliste). Ihre 29
Befunde sind in drei Teilen nachgebessert, je mit neuer Messung der betroffenen Aufgaben und ihrer Gegenproben. Zum
Abschluss ist der ganze Plan noch einmal in einer frischen Kopie von `5e5b234ec3` abgespielt und gemessen worden, dazu ein
zweites Abspielen ohne Tests zum Byte-Vergleich (Abschnitt „Nachbesserung nach der Plan-Prüfung“, NB1–NB31).

Eine unabhängige Nachprüfung hat danach fünf kleine Restlücken gefunden (R1–R5, je eine Prüfung, die einen absichtlichen
Fehler noch durchließ, bzw. eine abgeleitete statt gemessene Wirkung). Sie sind in der letzten Nachbesserung geschlossen,
je mit einer gemessenen Gegenprobe; dazu sind die Owner-Antworten vom 15.10.2026 eingetragen (alle Vorgaben OF1–OF14
bestätigt). Der ganze Plan ist danach noch einmal Aufgabe für Aufgabe in einer frischen Kopie abgespielt und gemessen
worden, mit einem zweiten Abspielen ohne Tests zum Byte-Vergleich (NB32–NB38).

**Verweise auf das Gerüst:** Angaben wie „S-A1“, „S-B4“, „S-C“, „Register“ oder „Ortsregister“ meinen Abschnitte des
Gerüsts, nicht der Spec. Das Gerüst ist nicht Teil dieses Plans; sein Inhalt steht vollständig in den Aufgaben unter
**Interfaces**: S-A1 → Task 2, S-A2 und S-A3 → Task 3, S-A4 → Task 4, S-B1 → Task 5, S-B2 → Task 6, S-B3 → Task 7,
S-B4 → Task 8, S-C → Tasks 9–12, das Ortsregister mit der Ortsvorgabe je Nummer → Task 13. Die Kennungen C1–C16 sind die
Gerüst-Namen der Tasks 1–16 (Task N = CN). `<eigener Scratchpad>` in Befehlen ist vor dem Lauf durch den
Scratchpad-Ordner der ausführenden Sitzung zu ersetzen (G17); `<worktree>` bzw. `<Worktree>` in erwarteten Ausgaben steht
für den Pfad des Plan-Worktrees.

## Global Constraints

- **G1 Pfade.** Geändert oder angelegt werden nur diese Pfade:
  - `apps/titler/src/renderer/src/**`. Byte-gleich bleiben `views/OutputView.tsx`, `views/ImportDialog.tsx`,
    `lib/engine.ts`, `lib/cg.ts`, `lib/graphic.ts`, `lib/psd-import.ts`, `lib/datalink-anzeige.ts`, `store/titler.ts`,
    `App.tsx`, `jmtitler.d.ts`, `main.tsx` und `../index.html`.
  - `apps/titler/src/preload/index.ts` (zwei Felder, ein `import type`) und `apps/titler/src/shared/types.ts` (Typen).
  - Neu `apps/titler/src/shared/fernsteuerung.ts`.
  - `apps/titler/src/main/control-server.ts` und `apps/titler/src/main/index.ts`, nur für die Fernsteuerungs-Meldung (N2).
  - `apps/titler/test/**`, neu `apps/titler/tsconfig.test.json`, und `apps/titler/package.json` (Skripte, eine
    Abhängigkeit; **keine Version**).
  - `packages/app-runtime/src/index.ts` (genau die Einfügungen aus Task 2), neu `src/master-link-meldung.ts` und
    `src/master-link-ipc.ts`, dazu `test/verbund.test.ts` (ein Block vor `// ── Abschluss`).
  - `packages/suite-control-protocol/src/server.ts` (ein lesender Getter) und `test/selftest.ts` (Wächter).
  - Neu `packages/ui/src/lib/master-link.ts`, `bruecke.ts` und `useBrueckenWert.ts`; dazu `src/lib/texte.ts` (eine neue
    Konstante), `src/index.ts` (neue Zeilen nur am Ende), `src/components/StatusPill.tsx` (nur die optionale Prop `kuerzen`,
    Task 9, E18) und `packages/ui/test/**`.
  - `packages/settings/src/abschnitte/{datalink.ts,DataLinkSection.tsx,screen-output.ts,ScreenOutputSection.tsx}`,
    `packages/settings/test/**`, `packages/ui/galerie/beispiele-settings.tsx` und `packages/ui/test/galerie.test.tsx`.
  - `.github/workflows/ci-checks.yml` (zwei Schrittnamen und Kommentare) und `package-lock.json` (eine Zeile, Task 7).
  - Doku: neu `docs/ux/funktionslisten/titler.md` und `docs/ux/ABNAHME-UX-Welle-0.md`; dazu `docs/ux/suite-ux-roadmap.md`,
    `docs/roadmap.md` (eine Zelle in Lane E), `docs/suite-verbund.md`, `docs/release-titler.md`,
    `packages/cookbook/content/tool-manuals/tool-jm-titler.md` und `packages/cookbook/cookbook.json` (nur per
    `cookbook:build`).

  Nicht angefasst werden:
  - `packages/app-runtime/src/verbund*.ts`, `packages/app-runtime/test/selftest.ts`, `packages/master-link/**`,
    `packages/show/**` und `packages/suite-manifest/**`;
  - alle anderen Apps;
  - `apps/titler/src/main/{datalink,show-quelle,iveo-show,library,config}.ts`, `apps/titler/src/main/ndi/**`,
    `apps/titler/src/utility/**` und `apps/titler/src/shared/{datenquelle,datalink-kern,vars,text-kodierung}.ts`.
- **G2 U6: zwei benannte Ausnahmen an IPC und Main, sechs benannte Änderungen der Bedienlogik.** Protokolle, Ports,
  IPC-Kanäle und Hauptprozess bleiben gleich, bis auf zwei Ausnahmen nach Spec 10 (letzter Punkt) und UO3:
  - **N1** Master-Link-Brücke: neuer Kanal `jmps:master-link`, nur lesend.
  - **N2** Fernsteuerungs-Meldung des Titlers: Statusfeld `fernsteuerung` und der Getter `modus()`.

  Port 8726 bleibt Konstante. STATE-Schlüssel, Inhalt von `reportState`, Fernsteuer-Befehle und `titler:*`-Kanäle bleiben
  wortgleich.

  Die Bedienlogik bleibt gleich bis auf diese benannten Änderungen (Spec 10, letzter Punkt). L1, L2, L4 und L6 kommen
  mit den Bausteinen, die Spec 5.1 und 6 vorschreiben, L3 und L5 aus Entscheidungen dieses Plans (E21, E13); keine berührt
  Protokolle, IPC oder Main. Die Nummern beziehen sich auf die Funktionsliste (Task 1).
  - **L1** NDI-Quellenname (E7, OF14): gilt erst bei Enter bzw. beim Verlassen des Felds und ohne Leerzeichen am Anfang
    und Ende (Text-Entwurf aus `@jm/settings`, `trim`); Escape verwirft einen geänderten Entwurf. Heute schreibt jeder
    Tastendruck den Namen, wie getippt. Wirksam wird er wie heute erst beim nächsten Start der Ausgabe (Nr. 50).
  - **L2** DataLink-Ordnerpfad (E10, OF4): ebenso. Heute ist jeder Tastendruck eine Ordnerwahl im Main, die die gemerkte
    Show löscht (Nr. 43, Befund 5).
  - **L3** „Daten / Recall“ bei einem DataLink-Fehler mit noch geltender Liste (E21): Liste, Zähler und Eintrag-Tasten
    bleiben bedienbar; heute blendet der Operator sie aus (Nr. 30).
  - **L4** Haupttasten als `TallyButton` (E12): Ein gehaltenes Enter löst nur einmal aus. Heute löst es auf den nativen
    Knöpfen „● Take (On Air)“, „Clear“, ‹ und › mit jeder Wiederholung erneut aus (Browser-Verhalten, im Kommentar von
    `tallyHandler` belegt; Nr. 7, 8, 33, 34, 94).
  - **L5** Grafik-Vorlagen (E13): Die Kacheln sind per Tab erreichbar und mit Leertaste bzw. Enter wählbar, „Löschen“ ist
    ein sichtbarer Knopf im Panel; heute nur per Maus, „✕“ nur beim Überfahren (Nr. 23, 24).
  - **L6** Hintergrund der Bildschirm-Ausgabe (OF3): neu ist ein Textfeld `#RRGGBB`, das bei Enter bzw. Verlassen nur
    gültige Werte übernimmt; Farbwähler und „Standardfarbe (#00B140)“ wirken sofort wie heute Farbwähler und „Reset“
    (Nr. 57, 58).
- **G3 Ausgabefenster (Spec 5.3).** `?view=output` bleibt ohne AppShell und ohne `useTheme`. `views/OutputView.tsx` und
  `lib/engine.ts` bleiben byte-gleich; das NDI-Bild ändert sich nicht.
- **G4 R2 bleibt wirksam.**
  - `window.jmtitler.verbundAnzeige`/`onVerbundAnzeige` bleiben, denn der Durchgang `apps/launcher/test/e2e-teil2b-verbund.ts`
    braucht sie (`:252`, `:257`, `:319`, `:364`).
  - Die V-Zeile steht in `headerCenter`.
  - Bei Quelle `master` sind „Ordner wählen …“, Pfadfeld und „Ordner entfernen“ sichtbar gesperrt; der Grund steht nach
    OF7. K1 erscheint nur wie in R2, und Q1–Q4 sowie H1–H7 bleiben unverändert.
  - Die CG-Vorschau bleibt das **erste** `<canvas>` im Bedienfenster.
  - Die R2-Zeilen in `packages/app-runtime/src/index.ts` (`:17-18`, Exportblock `:50-62`, `verbundAnClient(client, …)`
    direkt nach `client.starte();`) werden weder verschoben noch geändert.
- **G5 Texte.**
  - Wörtlich aus Spec, Anhang A, den `…_TEXTE` von `@jm/ui` und `@jm/settings` und aus `TITLER_TEXTE` (Task 8).
  - Neue Texte nur aus der Liste OF8 (T1–T11); der Owner hat die Liste am 15.10.2026 wie im Plan freigegeben (OF8).
  - Nur „ “, nie ASCII `"` in Nutzertexten; echte Umlaute; Zahlen mit `zahlText`.
- **G6 Statusregeln (Spec 7).**
  - Unbekannt ist `off` mit „unbekannt“, nie `ok`.
  - Angezeigt wird nur Gemessenes; eine Einstellung allein heißt „an (ohne Rückmeldung)“.
  - `live` steht nur in der On-Air-Anzeige der Kopfzeile, nie in der Statusleiste.
  - Jede Ableitung wird als vollständiges Kreuzprodukt mit einer Erwartungstabelle getestet.
- **G7 Umgebung (Spec 3.8, A.0.7): kein `window.jm*` vorausgesetzt.**
  - In `@jm/ui`, `@jm/settings` und `apps/titler/src/renderer/src/lib/oberflaeche.ts` gibt es kein `window` und kein IPC.
  - Im Titler-Renderer wird `window.jmtitler` nur in Effekten, Handlern und den Funktionskörpern von `lib/bruecken.ts`
    gelesen, dort mit `typeof window`-Wächter. Beim Rendern nie: Die Render-Tests laufen ohne `window`.
  - `localStorage` nur über `@jm/ui` (Theme, `Collapsible`), also immer in try/catch. Der Titler liest und schreibt
    `titler.operator.tab` nicht mehr.
- **G8 Zugeklapptes Panel heißt: Inhalt nicht gemountet.** Effekte und Zustand, die immer laufen müssen, leben in
  `OperatorView`, nie in Panel-Komponenten:
  - Fernsteuer-Befehle, Show-Vorlagen-Import (`onFileOpened`), `reportState` und Monitorliste;
  - der Zustand des Import-Dialogs und die Brücken-Abos.
- **G9 Tests.**
  - TDD: erst Rot sehen. Alles ohne Electron und ohne Browser.
  - Der alte Titler-Selbsttest (`test/selftest.ts`, eigener Zähler `failed`) bleibt ein eigener Lauf. Neue
    Oberflächentests laufen in `test/ui/` mit `@jm/ui/testhilfe` in einem **eigenen** `tsx`-Prozess, nie mit gemischtem
    Zähler.
  - Jede Aufgabe mit Regeln endet mit Gegenproben. Diese Steps haben „Gegenprobe“ im Titel und werden nie committet; die
    `FAIL`-Zeilen je Probe stehen im Plan.
  - Gegenproben laufen im Plan-Worktree mit dem Edit-Werkzeug und werden sofort zurückgebaut (Nachher → Vorher). Danach
    zeigt `git diff --stat` nur die Dateien der Aufgabe. Kein `git checkout`, kein `git stash`.
- **G10 Typprüfung.**
  - Jede Aufgabe endet mit `npm run typecheck -w @jm/titler` (ab Task 7 mit `typecheck:test`).
  - Bei Änderungen in `packages/ui` bzw. `packages/settings` zusätzlich `-w @jm/ui` bzw. `-w @jm/settings`.
  - Bei `packages/app-runtime/src` und `packages/suite-control-protocol/src` läuft
    `npm run typecheck --workspaces --if-present` (31 Workspaces).
  - Nie zwei Workspace-Typprüfungen gleichzeitig (Speicher etwa 4 GB).
- **G11 Zeilenenden.**
  - In einem frisch angelegten Worktree (`core.autocrlf=true`, keine `.gitattributes`) liegen alle Repo-Dateien mit CRLF,
    auch Doku, Spec und Pläne. Ältere Worktrees können einzelne Dateien mit LF haben (im Worktree `ux-update` gemessen:
    76 Dateien `w/lf`, darunter `docs/ux/suite-ux-roadmap.md`, `packages/ui/src/lib/texte.ts`, `packages/ui/test/selftest.ts`
    und `packages/settings/src/abschnitte/datalink.ts`). Maßgeblich ist darum je Datei „nicht gemischt“: Eine geänderte
    Datei behält die Zeilenenden, die sie vorher hatte.
  - Bestehende Dateien ändert das Edit-Werkzeug (Vorher exakt), neue Dateien schreibt das Write-Werkzeug mit LF.
  - Prüfbefehl: Bei geänderten Dateien ist die Zahl der CRLF gleich der Zeilenzahl, bzw. 0 bei LF-Dateien; neue Dateien
    haben 0 CRLF.
  - `docs/roadmap.md` nur punktuell ersetzen, nie umbrechen.
- **G12 Git.**
  - Ein Commit je Aufgabe (Task 16 ohne Commit), Text in ASCII, Stil `feat(titler): …`, `feat(app-runtime): …`,
    `feat(ui): …`, `feat(settings): …`, `feat(suite-control-protocol): …`, `test(titler): …` oder `docs(ux): …`. Letzte
    Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - `git add` nur mit expliziten Pfaden, danach `git status --short` lesen.
  - Kein Push, Tag, Merge, Rebase, Release oder PR; kein bare `git stash`, kein `reset --hard`, kein `clean`, kein
    `checkout`, kein Branch-Wechsel.
- **G13 Sicherheit.**
  - Kein `%APPDATA%`, kein Token, keine Electron-App starten, keine Netzdienste.
  - `electron-vite build` ist erlaubt; es braucht kein Electron-Binary.
  - Die Galerie nur kurz auf `127.0.0.1:5199`, danach beenden.
  - Kein `wrangler`, kein `npm install`/`npm ci` durch Agenten. Den Link `@jm/settings` legt der Controller an.
- **G14 Abhängigkeiten.**
  - Keine neue externe Abhängigkeit.
  - `@jm/settings` wird Workspace-Abhängigkeit `"*"` des Titlers. Die Lock-Zeile kommt per Edit in den Block
    `apps/titler`, zwischen `@jm/ndi` und `@jm/show`.
  - Ein Test prüft den Gleichlauf zwischen `package.json` und dem Lock-Block.
- **G15 Versionen und Changelog** gehören nicht in die Aufgaben, sondern nur nach „Nach der Umsetzung“.
  `apps/titler/package.json:3` bleibt `0.11.0`.
- **G16 Abbruchregel (aus R2).** Weicht ein gemessener Wert von der Erwartung ab (Zählstand, `FAIL`-Zeile, Gegenprobe,
  fehlender Link), hält der Ausführende an und meldet. Test oder Erwartung passt er nicht an.
- **G17 Befehle.**
  - Alle Befehle im Bash-Werkzeug (Git Bash) an der Worktree-Wurzel; Wechsel des Verzeichnisses nur in einer Subshell
    `( cd … && … )`.
  - Ausgaben und Logs gehen in den Scratchpad der Sitzung (`<eigener Scratchpad>`, vor dem Lauf ersetzen), nie nach
    `/tmp` oder ins Repo.
  - Zählstand: zuerst den Lauf mit `echo "Exit=$?"` lesen, dann zählen (`grep -c`); das `| grep` verschluckt den
    Exitcode.

## Testläufe (wie sie heißen werden)

„Vorher“ ist gemessen auf `5e5b234ec3`, „Nach Task 16“ zuletzt in der Abschluss-Messung der letzten Nachbesserung am
15.10.2026 (NB38, Tabelle „Gemessene Zählstände“).

| Paket | Befehl | Vorher | Nach Task 16 |
| --- | --- | --- | --- |
| `@jm/titler` | `npm run selftest -w @jm/titler`; ab Task 7: `tsx test/selftest.ts && tsx --tsconfig tsconfig.test.json test/ui/selftest.ts` | 512 `ok`, „ALLE TESTS OK“ | 538 + 264 = 802 `ok`, zweimal „ALLE TESTS OK“ |
| `@jm/ui` | `npm run selftest -w @jm/ui` | 627 `ok` | 680 `ok` |
| `@jm/settings` | `npm run selftest -w @jm/settings` | 419 `ok` | 463 `ok` |
| `@jm/app-runtime` | `npm run selftest -w @jm/app-runtime` | `50 passed, 0 failed` und `227 passed, 0 failed` | `50 passed, 0 failed` und `254 passed, 0 failed` |
| `@jm/suite-control-protocol` | `npm run selftest -w @jm/suite-control-protocol` | 77 `ok` | 80 `ok` |
| Typprüfung | `npm run typecheck -w @jm/titler` (ab Task 7 mit `typecheck:test`), `-w @jm/ui`, `-w @jm/settings`; bei app-runtime oder Protokoll `npm run typecheck --workspaces --if-present` | Exit 0, 31 Workspaces, 0 `error TS` | Exit 0, 0 `error TS` |
| Klassen-Probe | `npm run build -w @jm/titler`, dann `(cd packages/ui && npx tsx galerie/pruefe-klassen.ts --css ../../apps/titler/out/renderer/assets)` | mit `--ohne-settings` 19 `ok`; ohne den Schalter `1 FEHLGESCHLAGEN` (8 Klassen fehlen) | 20 `ok` |
| Galerie | `npm run galerie:pruefen -w @jm/ui` | 20 `ok` | 20 `ok` |
| Kochbuch | `npm run cookbook:check` | „cookbook.json ist frisch (43 Rezepte).“ | frisch nach `cookbook:build` (Task 15) |
| CI-Datei | `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/ci-checks.yml','utf8'))"` und Zählung | 22 Schritte im Job `selftests` | 22 Schritte |

## Review Focus (in die Tests der genannten Aufgabe)

1. **Die Statusleiste lügt in keinem Zustand.** Belastungsfälle: Brücke fehlt oder hat noch nicht geantwortet; späte
   Antwort nach einem Ereignis; Steuerserver startet nicht gegen 0 Clients; Port belegt; NDI an ohne Senderrückmeldung;
   Empfängerzahl von vor dem Stopp; 2. Bildschirm an ohne Fensterrückmeldung; gewählter Monitor abgezogen; Monitorliste
   noch nicht geladen; iveo-Hinweis von einem Kern-Hinweis verdeckt; Daten aus Show oder Master ohne eigenen Ordner.
   - Erwartet: nie `ok` ohne Messung; „unbekannt“, „an (ohne Rückmeldung)“, „Port belegt“ und „Bildschirm fehlt“ wie in
     Task 8 festgelegt; nie `live`.
   - Test: **Task 5** (Master-Eintrag, Kreuz über 12 Eingänge, `verbindeBruecke`, Hook-Übergang nach einem
     Verbindungsabbruch; der Effekt `hookAbo` übernimmt jede Folgemeldung, auch `null`, der Hook steht wörtlich),
     **Task 3** (Ereignisfolgen der Fernsteuerung), **Task 8** (Kreuz je Eintrag und über die ganze Leiste; iveo bei Quelle
     `master` mit der Achse Master-Link), **Task 9** (Leiste im gerenderten Rahmen; der Server-Render ohne Brücke ergibt
     „unbekannt“; ON AIR nur aus der Engine-Größe `live` und eine abgelehnte Monitorliste als „unbekannt“, beides per
     Quelltext-Wächter, weil der Server-Render nur `live = false` kennt), **Task 10** (Take-Tally aus `live`, Wächter
     `live={live}`), **Task 11** (Panel-Abschnitt „Ausgabe auf Bildschirm“ bei nicht geladener Monitorliste „unbekannt“).
2. **Kein Funktionsverlust gegen die Funktionsliste.** Belastungsfälle: ein Handler hängt nur noch im zugeklappten Panel, ein
   Knopf fehlt, ein gemerkter Zustand verschwindet, eine `persistId` ändert sich, ein Text verweist auf einen Ort, den es
   nicht mehr gibt.
   - Erwartet: Jede der 103 Zeilen hat einen Ort mit Haken; Fernsteuer-Befehle, Show-Vorlagen-Import und `reportState`
     laufen bei geschlossenem Panel; kein Nutzertext nennt „Reiter“ oder „rechts starten“.
   - Test: **Task 13** (jede Zeile mit Ort; der Ort zeigt auf eine vorhandene Datei; das Electron-Standardmenü in Nr. 93
     und 97), **Task 11** (Quelltext: Effekte nur in `OperatorView`, `Einstellungen.tsx` ohne `useEffect`), **Task 10**
     (`persistId` `titler.graphics` und `titler.recall`, keine Ortsangaben alter Art; Banner, Ticker samt Tempo, Vorlage
     ohne Textfelder und der Variablen-Hilfetext gerendert; jedes Feld der Bedienung schreibt in seinen Schlüssel),
     **Task 9** (Quelltext-Wächter: ⚙ und Statuseintrag öffnen das Panel am Abschnitt, die fünf Aktionen gehen an Store und
     Preload; ein Klick lässt sich ohne Browser nicht auslösen).
3. **R2-Anzeige und -Sperren bleiben wirksam.** Belastungsfälle: V-Zeile fehlt im Kopf, Ordnerwahl bei Quelle `master` frei,
   der Durchgang misst ein anderes `<canvas>`, `verbundAnzeige` ist nicht mehr im Preload.
   - Erwartet: Die V-Zeile steht mit Zustand und Tooltip in `headerCenter`; DataLink ist bei `master` gesperrt (R2-Satz),
     alle drei Ordner-Bedienelemente sind gesperrt; das erste `<canvas>` ist die Vorschau mit 960×540.
   - Test: **Task 8** (`dataLinkAbschnitt` bei `master`, `verbundZeileZustand`), **Task 9** (Kopfmitte, erstes `<canvas>`,
     Preload unverändert), **Task 11** (gesperrter Abschnitt gerendert).
4. **Brücke ohne Doppelung zur R2-IPC.** Belastungsfälle: ein zweiter Client, ein Eingriff in `verbund-*.ts`, ein fehlender
   Handler beim ersten `invoke`, am Einzelplatz nie eine Meldung, eine späte Antwort überschreibt ein neueres Ereignis, ein
   4b-Wächter wird rot.
   - Erwartet: Genau ein Client und ein neuer Kanal; die R2-Zeilen bleiben unverschoben; ohne Client kommt die Meldung
     `ohne-client` statt einer Ablehnung; beim Anhängen wird einmal gesendet, und ein Ereignis gewinnt gegen eine späte
     Antwort.
   - Test: **Task 2** (Quelltext-Wächter auf `index.ts` und `master-link-ipc.ts`, 4b-Wächter 50/0, Kreuz V-Zeile ×
     Meldung), **Task 5** (`verbindeBruecke`), **Task 4** (Kanal im Preload = `MASTER_LINK_KANAL`, `verbundAnzeige`
     unverändert).
5. **Tailwind erzeugt die Klassen aus `packages/ui` und `packages/settings` im Titler.** Belastungsfall: die `@source`-Zeile
   für `packages/settings/src` fehlt.
   - Erwartet: Die Klassen-Probe auf dem gebauten Titler-CSS ohne `--ohne-settings` meldet 20 `ok`; die Gegenprobe ohne die
     neue Zeile meldet `1 FEHLGESCHLAGEN`.
   - Test: **Task 7** (Wächter plus Probe), wiederholt in **Task 9–12** und **Task 16**.

## Dateistruktur

**Neu**
- `docs/ux/funktionslisten/titler.md` (Task 1, abgehakt in Task 13) und `docs/ux/ABNAHME-UX-Welle-0.md` (Task 14).
- `packages/app-runtime/src/master-link-meldung.ts` (Task 2, rein, nur `import type`) und
  `packages/app-runtime/src/master-link-ipc.ts` (Task 2, Electron).
- `apps/titler/src/shared/fernsteuerung.ts` (Task 3, rein).
- `packages/ui/src/lib/master-link.ts`, `packages/ui/src/lib/bruecke.ts` und `packages/ui/src/lib/useBrueckenWert.ts`
  (Task 5), mit den Tests `packages/ui/test/master-link.test.ts` und `packages/ui/test/bruecke.test.ts`.
- `apps/titler/tsconfig.test.json`, `apps/titler/test/ui/selftest.ts` (Einstieg, Einfügemarke `abschluss();`),
  `apps/titler/test/ui/hilfe.ts` (Kopie von `kreuz`, `fallText`, `pruefeFaelle` und `vergleiche` aus
  `packages/settings/test/hilfe.ts`) und `apps/titler/test/ui/werkzeug.test.tsx` (alles Task 7).
- `apps/titler/src/renderer/src/lib/oberflaeche.ts` und `apps/titler/test/ui/oberflaeche.test.ts` (Task 8).
- `apps/titler/src/renderer/src/lib/bruecken.ts`, `views/KopfMitte.tsx`, `views/felder.tsx` (die lokalen `Field`, `Labeled`,
  `ColorField` und `Slider`, aus `OperatorView.tsx` verschoben; `Field` und `Labeled` gehen in Task 11 wieder heraus),
  `views/Einstellungen.tsx` (in Task 9 der alte Inhalt, in Task 10 um Stil und Grafik-Vorlagen erweitert, in Task 11 neu
  gebaut), `apps/titler/test/ui/testzustand.ts` (Fixtures und Lesehilfen für Task 9–13) und
  `apps/titler/test/ui/rahmen.test.tsx` (alles Task 9).
- `views/LiveBereich.tsx`, `views/Bedienung.tsx` und `apps/titler/test/ui/live.test.tsx` (Task 10).
- `apps/titler/test/ui/panel.test.tsx` (Task 11), `apps/titler/test/ui/board.test.tsx` (Task 12) und
  `apps/titler/test/ui/funktionsliste.test.ts` (Task 13).

Pfade ohne Präfix liegen unter `apps/titler/src/renderer/src/`.

**Geändert**
- `packages/app-runtime/src/index.ts` (Task 2: zwei Importzeilen nach `:18`, eine Registrierungszeile am Anfang von `los`,
  `sendeMasterLinkWechsel(client);` nach `:402`, eine Exportzeile vor `:64`) und `packages/app-runtime/test/verbund.test.ts`
  (Task 2, Block vor `:936`).
- `packages/suite-control-protocol/src/server.ts` (Task 3, Getter `modus()` nach `status()`) und `test/selftest.ts` (Task 3,
  Wächter).
- `apps/titler/src/main/control-server.ts`, `apps/titler/src/main/index.ts`, `apps/titler/src/shared/types.ts` und
  `apps/titler/test/selftest.ts` (Task 3, 4); `apps/titler/src/preload/index.ts` (Task 4).
- `packages/ui/src/lib/texte.ts`, `packages/ui/src/index.ts` und `packages/ui/test/selftest.ts` (Task 5).
- `packages/settings/src/abschnitte/{datalink.ts,DataLinkSection.tsx,screen-output.ts,ScreenOutputSection.tsx}`, deren
  Tests `packages/settings/test/datalink.test.tsx` und `screen-output.test.tsx`, `packages/settings/test/quellregeln.test.ts`
  (Daten-Prop `backgroundDefault`, Rückruf `onFolderText`), `packages/ui/galerie/beispiele-settings.tsx` und
  `packages/ui/test/galerie.test.tsx` (alles Task 6).
- `apps/titler/package.json`, `package-lock.json`, `apps/titler/src/renderer/src/globals.css` und
  `.github/workflows/ci-checks.yml` (Task 7; den Schrittnamen von app-runtime ändert Task 2).
- `views/OperatorView.tsx` (Task 9–11), `views/RecallBoard.tsx` (Task 12), `apps/titler/test/ui/selftest.ts` (Task 8–13).
- `packages/ui/src/components/StatusPill.tsx` (optionale Prop `kuerzen`) und `packages/ui/test/statusbar.test.tsx` (eine
  Prüfung), beide Task 9.
- Doku (Task 15): siehe G1.

**Unverändert, obwohl naheliegend:**
- `jmtitler.d.ts`: Die Typen kommen über `JmtitlerApi` in `shared/types.ts`, wie bei R2.
- `App.tsx` (Ansichtswahl), `store/titler.ts` (Store, `load` ohne `catch`), `views/ImportDialog.tsx` und
  `views/OutputView.tsx`.
- `index.html`: `class="dark"` bleibt der Startwert.
- `lib/datalink-anzeige.ts`: der Board-Filter B14 bleibt (OF1).

## Bewusst nicht in diesem Plan

- Versionen, Changelog und Release; sie stehen nur in „Nach der Umsetzung“.
- Main-Rückmeldungen außer N1 und N2 (OF6): NDI-Sender (Init, Prozess-Ende, erste `stat`), „Ausgabefenster offen“,
  laufender NDI-Name samt der Vorschau „Im Netz: …“ aus Spec 6.2 (E7), „Neustart nötig“ der Fernsteuerung aus Spec 6.2
  (E6) und die Diagnosen nur im Log (Befund 17 der Funktionsliste). Dazu der Deep-Link „Im Launcher einrichten“ (OF5).
- Eine Änderung am Electron-Standardmenü (OF11; der Main bleibt unverändert, G2).
- Neue Tastenkürzel (UO5, F4), ein Hell/Dunkel-Abgleich zwischen Fenstern bzw. suite-weit (F1), eine gemeinsame
  Status-Leitung (F2).
- Recall-Board und Ausgabefenster im AppShell.
- Folgeaufgaben aus den Befunden der Funktionsliste:
  - Import-Dialog: Escape, Fehleranzeige beim Speichern, Sperre während des Speicherns, stille Lesefehler (Befund 7);
  - „Im Text verwendet“ ohne `slotText` und ohne NFC (Befund 8);
  - Ablageschutz außerhalb der Ablagefläche (Befund 12);
  - „Lädt…“ ohne Ende bei scheiterndem `getState` (der Store bleibt byte-gleich);
  - `user-select: none` (Befund 19).
- Die Brücke in anderen Tools (Preload je Tool in seiner Welle) und die Fernsteuerungs-Meldung anderer Tools.
- Vormerkungen des Fundaments in `@jm/ui` (Fundament-Plan, Abschnitt „Vorgemerkt für die Wellen“) vor Welle 1:
  - TallyButton „Klick nach dem Entsperren“;
  - die Lücke im E3-Wächter `text-base`/`font-*` (`packages/ui/test/tally.test.tsx:49`, `:115`);
  - StatusBar ohne `whitespace-nowrap`, AppHeader-On-Air ohne `role="status"`.

## Entscheidungen, wo Spec und Code schweigen (Owner zur Kenntnis)

- **E1 Eigener Kanal mit rohem Zustand.**
  - `jmps:master-link` liefert `ClientZustand` unverändert oder `{ art: 'ohne-client' }`.
  - `getMasterLinkStatus()` bleibt unverändert (Presence, U6).
  - Die R2-Zeile deckt den Link nicht ab: Bei Rolle `aus`, `master` oder ohne Datei ist sie immer `null`, und ohne
    `folgeMasterShow` bleibt sie dauerhaft auf V2. Sie bleibt allein für `headerCenter`.
  - Kein zweiter Client, kein Eingriff in `verbund-*.ts` oder `@jm/master-link`.
- **E2 Registrierung und erstes Senden.**
  - `registriereMasterLinkAbfrage` steht als erste Zeile in `los` (vor `try`), also in `whenReady` vor der Lock-Prüfung; sie
    hat ein eigenes try/catch, und bei einer doppelten Registrierung bleibt die erste. Grund: Ob `ipcMain.handle` vor
    `whenReady` greift, ist nicht messbar; `los` läuft im ersten `whenReady`-Rückruf, vor dem Fenster des Tools. Auch ohne
    Client antwortet sie mit `ohne-client`.
  - `sendeMasterLinkWechsel(client)` steht direkt nach `verbundAnClient(client, …)`. Es hängt `client.on('zustand', …)` an
    und sendet sofort einmal den aktuellen Stand an alle Fenster, je Fenster mit `isDestroyed` und try/catch. Grund:
    Gemessen am echten `MasterLinkClient` kommt am Einzelplatz nie ein `zustand`-Ereignis; ein werfender Zuhörer bricht am
    Node-EventEmitter die späteren Zuhörer desselben `emit` ab.
  - Damit ist die Brücke unabhängig von der Reihenfolge der `whenReady`-Rückrufe, denn der Renderer abonniert vor der
    Abfrage (E5).
- **E3 Abbildung einmal in `@jm/ui`.**
  - Der strukturelle Typ `MasterLinkMeldung`, `masterLinkStatusItem()` und `MASTER_LINK_TEXTE` liegen in `@jm/ui`.
  - Der Titler hat einen eigenen strukturgleichen Typ `MasterLinkMeldungZeile` (R2-Regel E28). Den Gleichlauf prüfen der
    Preload (app-runtime → Titler) und der Aufruf in `lib/oberflaeche.ts` (Titler → ui).
- **E4 Stufen und Detail des Master-Eintrags.**

  | Meldung | Stufe | Text |
  | --- | --- | --- |
  | `undefined`, `null`, unbekannte Art | `off` | „unbekannt“ |
  | `ohne-client` | `warn` | „nicht gestartet“ |
  | `aus` | `off` | „aus“ |
  | `sucht`, `verbindet` | `warn` | „sucht …“ bzw. „verbindet …“, ohne Adresse (kein Flackern je Kandidat) |
  | `verbunden` | `ok` | „verbunden mit {masterName}“, ohne Namen „verbunden“ |
  | `fehler` (jeder Code, auch `nicht-gefunden`) | `error` | Client-Text, rot wie V11 |

  Kein `settingsSection`, denn es gibt keinen Panel-Abschnitt Master. Die Rolle wird nicht mitgesendet: Auf dem
  Master-Rechner verbindet der Client nur zu `127.0.0.1` (`adresswahl.ts:127`); „verbunden mit ⟨Master⟩“ ist dort wahr,
  denn der eigene Launcher ist der Master.
- **E5 Brücken-Hook.**
  - `verbindeBruecke(quelle, melde)` ist der Kern des Effekts (der Hook ruft sie über `hookAbo`): erst `ereignis`
    abonnieren, dann `abfrage`.
  - Eine Antwort nach einem Ereignis wird verworfen; Ablehnung und Wurf ergeben `null`; nach dem Abmelden passiert nichts
    mehr.
  - `useBrueckenWert(quelle)` liefert `undefined`, solange die Brücke offen ist, und `null` ohne Quelle.
  - Die Quellen sind modulweite Konstanten in `lib/bruecken.ts` mit spätem, gewachtem `window`-Zugriff (`window?.` allein
    wirft in Node einen `ReferenceError`).
  - Der Hook ersetzt auch den Effekt aus R2 `VerbundAbzeichen`; das Verhalten wird nur im Randfall „späte Antwort“
    strenger.
- **E6 Fernsteuerung.**
  - Der Getter `modus()` gilt ab `start()` und ruft `effectiveMode()`. Getestet wird er per Quelltext-Wächter im
    Protokoll-Selbsttest plus einer einmaligen Bündel-Probe, weil `server.ts` unter `--experimental-strip-types` nicht lädt.
  - Ein Fehler mit `EADDRINUSE` setzt nur `portInUse` (Status „Port belegt“, ohne `error`). Andere Startfehler setzen
    `error` (Status „Fehler: …“). Bis zur ersten Meldung gilt „unbekannt“.
  - Der Port kommt aus der Meldung, sonst ist er `STEUER_PORT`.
  - Kein `onOpenLauncher` (OF5). `companionModule: 'jm-suite'` (Modulname wie in der Galerie und in
    `companion/manifest.json`).
  - Statt „Companion“ heißt das Label „Fernsteuerung“ (OF2).
  - `suiteClients` bleibt im Status.
  - `restartRequired` bleibt ungesetzt; „Neustart nötig“ (Spec 6.2) erscheint im Pilot nie. Der angezeigte Modus ist der des
    laufenden Servers: `modus()` liest die in `start()` aufgelöste Konfiguration und ändert sich erst mit dem nächsten Start.
    Die Anzeige stimmt also; es fehlt nur der Hinweis, dass ein im Launcher geänderter Modus erst nach einem Neustart des
    Titlers wirkt. Ihn zu liefern hieße, im Main `control.json` lesend gegen `modus()` zu vergleichen und auf Änderungen der
    Datei zu hören. Das geht über den Getter aus N2 hinaus, deshalb Folgeplan (OF6); dazu ein Hinweis in Abnahme 4e.
- **E7 NDI ohne Senderrückmeldung.**
  - `enabled = ndiActive`, `sending` bleibt ungesetzt (also „an (ohne Rückmeldung)“, warn).
  - `receivers` nur bei `ndiActive && connections > 0`: 0 ist nicht von „noch keine Meldung“ zu unterscheiden, und nach dem
    Stopp stünde sonst die alte Zahl.
  - Fähigkeiten `toggle`, `rename`, `resolution` und `fps`, keine Transparenz.
  - Eine ungerade Breite oder Höhe ergibt `error` „Auflösung sollte gerade sein.“ (bewahrt Nr. 54 der Funktionsliste).
  - Start und Stopp laufen über die vorhandenen Store-Aktionen. Der Quellenname wird beim Enter bzw. Verlassen übernommen
    (Text-Entwurf des Abschnitts, ohne Leerzeichen am Anfang und Ende), nicht mehr je Tastendruck: benannte Änderung L1,
    Owner-Frage OF14.
  - `networkName` bleibt ungesetzt; der Abschnitt zeigt kein „Im Netz: …“ (Spec 6.2 „Vorschau des Namens im Netz“). Den
    fertigen Namen bildet die NDI-Bibliothek im Sender-Prozess aus Rechnername und Quellenname (NDI-Konvention, im Titler nicht
    gemessen). Weder der Renderer noch
    `TitlerStatus` kennt ihn, und ein im Renderer nachgebauter Name wäre nicht gemessen (Spec 7.3). Liefern müsste ihn der
    Main bzw. der Sender-Prozess, deshalb Folgeplan (OF6). Heute zeigt der Titler den Namen im Netz auch nicht; es geht
    nichts verloren.
- **E8 Bildschirm ohne Fensterrückmeldung.**
  - `enabled = secondScreenEnabled`, `windowOpen` bleibt ungesetzt.
  - `screens = displays`: Der Zustand in `OperatorView` startet `undefined` statt `[]`; ein Ladefehler bleibt `undefined`
    („unbekannt“).
  - `selectedId = secondScreenDisplay === 0 ? null : secondScreenDisplay`.
  - Fähigkeiten `toggle` und `background`, dazu `backgroundDefault: '#00B140'` und `backgroundPicker` (OF3; das Textfeld
    ist die benannte Änderung L6).
  - Ein abgezogener Monitor ist „Bildschirm fehlt“; heute fällt die Ausgabe still auf den Primärmonitor.
- **E9 iveo.**
  - `bound = art show | master`. Anhang A nennt nur `show`; seit R2 gehört `master` dazu.
  - `delivery`: Hinweis H3, H4 oder H7 → `veraltet` („Liste aus früherem Stand“); kein Hinweis → `ok` („verbunden“), denn
    die Show sagt ohne `speakerVeraltetSeit`, dass die letzte Lieferung des Launchers gelang (OF12); Kern-Hinweis H1, H2, H5
    oder H6 → `undefined` („unbekannt“), weil er nach `RANG` einen Quell-Hinweis verdecken kann.
  - Bei Quelle `master` ist die Master-Link-Meldung eine Eingangsgröße (Nachbesserung, Prüfbefund robust:1): Die Liste kommt
    über den Link. Nur bei `verbunden` gilt die Regel davor. Bei einer gemessenen Trennung (`ohne-client`, `aus`, `sucht`,
    `verbindet`, `fehler`) ist die Liste der zuletzt empfangene Stand: ohne Hinweis und mit Quell-Hinweis `veraltet`
    („Liste aus früherem Stand“, wie die V-Zeile „nicht verbunden · letzter Stand …“), mit Kern-Hinweis weiter `undefined`.
    Ohne Meldung (Brücke offen), ohne Brücke (`null`) oder bei einer unbekannten Art `undefined` („unbekannt“), nie `ok`.
    Bei `show` hängt nichts am Master-Link.
  - `speakerCount = entries.length` nur bei `bound`. Ohne Event und Bühne, denn der Titler kennt sie nicht.
- **E10 DataLink.**
  - `locked = datenQuelle.ordnerGesperrt` (R2-Satz, OF7); `sourceLine = datenQuelle.zeile`; `notice = hinweis?.text`.
  - `backLabel`/`onBack` = K1.
  - `folderMissing = dataError === 'Ordner nicht gefunden'` (Gleichlauf mit `main/datalink.ts:137` per
    Quelltext-Wächter); sonst `error = dataError`.
  - Neu aus Task 6: `externeQuelle = art show | master | frueher` und `eintraege = entries.length`.
  - `onClearFolder` ist auch bei Sperre gesetzt; der Knopf ist dann sichtbar gesperrt.
  - Pfadfeld mit `capabilities.ordnerText` und `onFolderText` (OF4; Übernahme bei Enter bzw. Verlassen, benannte Änderung
    L2).
- **E11 On-Air ist die Engine-Größe `live`.** Das ist dieselbe Wahrheit wie STATE `on_air` (Ziel der Blende, schaltet beim
  Drücken), auch wenn weder NDI noch der 2. Bildschirm läuft. In der Statusleiste gibt es keine live-Zeile.
- **E12 Haupttasten.**
  - Vier `TallyButton`s: „Take“, „Clear“, „◀ Eintrag“, „Eintrag ▶“ (OF8; Anhang A schreibt „● Take“, ● ist aber das
    ok-Symbol der Statusleiste).
  - Take ist `live` bzw. `bereit` und nie gesperrt; Clear ist immer `bereit`.
  - Die Eintrag-Tasten gibt es bei `entries.length > 0`, auch bei `dataError` (E21). An den Rändern sind sie gesperrt mit
    „Erster Eintrag“ bzw. „Letzter Eintrag“, nach `navGesperrt`.
  - Keine Kürzel (UO5). Ein gehaltenes Enter löst eine Haupttaste nur einmal aus (`TallyButton`, benannte Änderung L4).
  - ‹ und › in „Daten / Recall“ entfallen; „⧉ Board“, Zähler und Liste bleiben.
- **E13 Bedienung und Panel nach Anhang A.**
  - Bedienung rechts: „Vorlage“ und „Inhalt“ immer offen; `Collapsible` „Grafik-Vorlagen“ (`titler.graphics`, nur
    Kacheln) und „Daten / Recall“ (`titler.recall`). Die Kacheln werden `<button type="button">` mit `aria-pressed`; heute
    sind sie per Tastatur nicht erreichbar (Nr. 23; benannte Änderung L5).
  - Panel: iveo, NDI-Ausgabe, Ausgabe auf Bildschirm, Fernsteuerung, DataLink, danach tool-eigen „Stil“ und
    „Grafik-Vorlagen“. Grafik-Vorlagen enthält den Knopf „Datei importieren…“, die Ablagefläche, die Beschreibung (Nr. 20)
    und je Vorlage einen sichtbaren Knopf „Löschen“, ohne Rückfrage wie heute.
- **E14 Der Reiter entfällt.**
  - `Tabs` und `titler.operator.tab` entfallen. Das behebt Nr. 98 (Lesen ohne try/catch).
  - Das Panel startet zu und merkt nichts.
  - `persistId` `titler.style` wird nicht mehr gelesen, denn Stil steht offen im Panel.
- **E15 Hell/Dunkel.**
  - `ThemeToggle` kommt über `AppHeader`.
  - Das Recall-Board übernimmt das gemerkte Theme beim Öffnen (`useTheme()` ohne Schalter).
  - Das Ausgabefenster bleibt unverändert (G3).
  - Kein Abgleich zwischen offenen Fenstern (F1). `index.html` behält `class="dark"`.
- **E16 Titler-Tests in zwei Läufen.**
  - Alt: `tsx test/selftest.ts` mit eigenem Zähler.
  - Neu: `tsx --tsconfig tsconfig.test.json test/ui/selftest.ts`.
  - `tsconfig.test.json` erfasst `test/ui/**`, die Renderer-Quellen, `src/shared/**`, `../../packages/ui/src` und
    `../../packages/settings/src`, nicht `test/selftest.ts`: Der R2-Typfehler `test/selftest.ts:685` (TS2339 `showPfad`) ist
    auf `main` nicht behoben; er bleibt außerhalb der Test-Typprüfung und geht als Befund weiter.
- **E17 Lock-Zeile von Hand** per Edit. Das Vorbild sind die Releases, die die Versionszeile von Hand ändern. Den Beweis
  liefert `npm ci` in der CI.
- **E18 Kopfzeile.**
  - Links nur Logo und „JM Titler“ (Spec 3.2); der Untertitel „Live-CG → NDI“ entfällt.
  - Mitte: `VerbundZeile` = `StatusPill` mit `verbundZeileZustand(farbe)` und `title` = Text, in einer Hülle
    `block min-w-0 max-w-full overflow-hidden`.
  - `VERBUND_FARBE` entfällt: Es färbt Wörter in Statusfarben und nutzt das Gelb `--warning`; beides widerspricht Spec 4.2
    (Warnung orange, Statusfarben nie nur auf Wörtern). Die Abbildung ist gruen → ok, gelb → warn, rot → error,
    gedaempft → off.
  - Gekürzt wird mit „…“, der volle Text steht im Tooltip; so bleibt die R2-Regel wirksam (2b-Spec 16.5, G4). Dafür
    bekommt `StatusPill` in Task 9 die optionale Prop `kuerzen` (Text in eigenem `span` mit `truncate`, Pille höchstens so
    breit wie ihr Platz), additiv nach Spec 4.1: Ohne die Prop bleibt das Markup wie bisher. Ein hart abgeschnittener
    Text könnte falsch lesen lassen („Stand 09:0“ statt „Stand 09:05“).
- **E19 Schmal-Ansicht nur per Zoom.** `minWidth: 960` des Hauptfensters bleibt (Main unverändert); dazu gibt es einen
  Abnahmepunkt.
  - Bei offenem Panel (360 px; ab 900 px Fensterbreite schiebt es den Inhalt) bleibt die Bedienung 400 px breit, denn die
    vier Vorlage-Knöpfe brauchen die Breite. Der Live-Bereich bekommt den Rest.
  - Gerechnet aus den CSS-Breiten (ohne Browser nicht gemessen): Bei 960 px bleiben für Vorschau und Haupttasten etwa
    160 px (960 − 360 − 400 − 40 Rand), bei der Startbreite 1180 px etwa 380 px.
  - Vorschau und Tasten bleiben sichtbar (Spec 5.1). Ob sie bei 960 px bedienbar genug sind, prüft Abnahme 6a. Eine
    schmalere oder umbrechende Bedienung wäre eine Gestaltungsänderung über den Pilot hinaus.
- **E20 Statuseinträge.** Die ids sind zugleich die Panel-Anker.

  | id | Gruppe | Label | Panel-Abschnitt |
  | --- | --- | --- | --- |
  | `master-link` | verbindung | „Master“ | keiner |
  | `iveo` | verbindung | „iveo“ | `iveo` |
  | `ndi` | ausgabe | „NDI“ | `ndi` |
  | `bildschirm` | ausgabe | „Bildschirm“ | `bildschirm` |
  | `fernsteuerung` | fernsteuerung | „Fernsteuerung“ (OF2) | `fernsteuerung` |
  | `datalink` | tool | „DataLink“ | `datalink` |
- **E21 „Daten / Recall“ bei `dataError` mit noch geltender Liste (A7).** Die Fehlerzeile steht oben, die Liste, der
  Zähler und die Eintrag-Tasten bleiben, wie im Board. Heute blendet der Operator die Liste aus (benannte Änderung L3).
- **E22 Recall-Board-Ladezustand.** Solange `state` fehlt, steht „Lädt…“ statt „0 Einträge“ und „Keine Einträge …“
  (Befund 18). Sonst bleibt das Board unverändert, außer dem Anführungszeichen in Nr. 91, `useTheme` und der Warnfarbe
  von Hinweisband und Karte B1 (E25).
- **E23 Eingaben der Bedienung aus `@jm/ui`.**
  - Name, Untertitel, Banner, Ticker und die Slot-Felder werden `Field` + `TextInput` (Spec 3.5); jeder Tastendruck bleibt
    wie heute.
  - `Slider` (Ticker-Tempo, Größe) und `ColorField` (Stil) bleiben lokal in `views/felder.tsx`, weil `@jm/ui` keine
    Entsprechung hat.
  - Das lokale `Field` und `Labeled` entfallen; das löst auch den Namenskonflikt.
- **E24 Hilfetexte der alten Reiter werden durch feste Abschnittstexte ersetzt (Spec 6.1).** Betroffen sind die
  DataLink-Beschreibung (Nr. 42), der iveo-Kasten (Nr. 49, Befund 15), die Beschreibung des 2. Bildschirms (Nr. 55) und
  dessen Tipp (Nr. 60). In der Funktionsliste stehen sie als „ersetzt durch …“.
  - Inhaltlich entfallen damit im Programm zwei Erklärungen: das Dateiformat (CSV mit Kopfzeile = Liste, `schlüssel=wert`
    = ein Eintrag, Platzhalter `{{name}}`; Nr. 42) und der Weg zu iveo (den Titler über eine JM Show mit iveo-Daten
    öffnen; Nr. 49). Beides steht im Handbuch `packages/cookbook/content/tool-manuals/tool-jm-titler.md` (DataLink, iveo);
    die Funktionsliste nennt den Wegfall.
- **E25 Warnfarbe Orange (Spec 4.2).** Gelb `--warning` wird beim Umbau zu Orange `--status-warn`: im Hinweis-Kasten
  H1–H7 der Bedienung (Task 10) sowie in Hinweisband und Karte B1 des Recall-Boards (Task 12, Ausnahme zu E22). Danach
  nutzt keine Datei unter `views/` mehr `--warning` (Test in Task 12). „Im Text verwendet“ bleibt wie heute (Nr. 37):
  Die Platzhalter sind primär bzw. rot, der Tooltip nennt „Variable vorhanden“ bzw. „Variable nicht gefunden“.

## Owner-Fragen (je mit Vorgabe; die Umsetzung blockiert nicht)

Owner-Antwort 15.10.2026: alle Vorgaben OF1–OF14 bestätigt.

Der Owner hat jede Zeile mit „passt“ beantwortet, auch OF8 (Texte T1–T11 wie in der Liste unten) und OF13 (Abnahme mit
dem lokalen Abnahme-Bau vor Merge und Release). Damit gilt in jeder Zeile die Vorgabe, und keine Aufgabe ändert sich; die
Spalten „Wirkung bei Ablehnung“ und „spätestens vor“ bleiben zur Nachvollziehbarkeit stehen. Die Freigabe des Releases
selbst gibt der Owner erst nach der Abnahme („Nach der Umsetzung“, Punkt 8).

| # | Frage | Vorgabe (Empfehlung) | Wirkung bei Ablehnung | spätestens vor | Owner |
| --- | --- | --- | --- | --- | --- |
| OF1 | Recall-Board-Hinweise: Anhang A sagt, das Board „zeigt dieselben Hinweise“. Heute filtert es nach 2b-Spec 7.8 absichtlich auf H1, H5 und H6 plus B1 (Test B14, `apps/titler/test/selftest.ts:1299-1306`). Ist „wie der Operator (H1–H7)“ gemeint? | Der Filter bleibt; „dieselben“ heißt dieselbe Quelle `status.hinweis` mit gleichem Wortlaut. | Task 12 und die B14-Erwartungen ändern sich (H2, H3, H4, H7 im Board). | Task 12 | bestätigt 15.10. |
| OF2 | Label des Steuerserver-Eintrags: „Fernsteuerung“ statt „Companion“ (Spec 3.3 und Anhang A nennen „Companion“)? Die Zahl zählt jeden Steuerclient, auch die Dauerverbindung des Launcher-Health. | „Fernsteuerung“ | Label „Companion“ in `TITLER_TEXTE` (Task 8). | Task 8 | bestätigt 15.10. |
| OF3 | Chroma-Farbwähler und „Reset (#00B140)“ als additive Erweiterung von `ScreenOutputSection` behalten (Farbwähler und Knopf „Standardfarbe (#00B140)“)? Spec 6.1 legt die Felder fest, Spec 10 verbietet Funktionsverlust. | ja | Der Teil Bildschirm in Task 6 entfällt; Nr. 57/58 „ersetzt durch Textfeld #RRGGBB (Owner)“. | Task 6 | bestätigt 15.10. |
| OF4 | DataLink: Ordnerpfad eintippen (künftig Übernahme bei Enter bzw. Verlassen statt je Tastendruck) und „Ordner entfernen“ als additive Erweiterung von `DataLinkSection` behalten? Ohne den Knopf gäbe es keinen Weg mehr, den Ordner zu entfernen. | ja | Die Teile Pfadfeld und Knopf in Task 6 entfallen; Nr. 43/45 „entfällt (Owner)“, ohne Weg zum Entfernen des Ordners. | Task 6 | bestätigt 15.10. |
| OF5 | „Im Launcher einrichten“ (iveo, Fernsteuerung) im Pilot ausblenden? Fundament E15 wies den Weg dem Pilot zu, aber `jmps://` kennt nur `open?show=`. Ein Deep-Link bräuchte Launcher-Main und IPC (U6). | ausgeblendet; der Weg kommt mit dem Launcher in Welle 3 | eigener Plan-Teil mit Launcher-Main, `jmps://`-Weg und Rückruf (U6-Ausnahme) | Task 8 | bestätigt 15.10. |
| OF6 | Folgeplan „Titler-Rückmeldungen“ nach dem Pilot? Er bräuchte Main-Änderungen außerhalb UO3: NDI-Sender (Init-Fehler, Prozess-Ende, erste `stat`), „Ausgabefenster offen“, der Name der NDI-Quelle im Netz (Spec 6.2 „Vorschau des Namens im Netz“, E7), „Neustart nötig“ der Fernsteuerung (Spec 6.2, E6) und die Diagnosen, die nur im Log stehen (Datei unlesbar, Kodierung, NDI-Init, mDNS, RELOAD bzw. Deep-Link im Verbund ignoriert, Ordnerwahl abgelehnt). Bis dahin zeigt die Statusleiste bei NDI an dauerhaft ▲ „an (ohne Rückmeldung)“ (Spec 7.3). | Folgeplan | Main-Änderungen im Pilot (neue benannte U6-Ausnahmen, mehr Aufgaben) | Plan-Freigabe | bestätigt 15.10. |
| OF7 | DataLink-Sperrtext im Verbund: der R2-Satz „Gesperrt: Im Verbund kommen die Speaker vom Master „X“. Ein eigener Ordner gilt, solange die Show dort keine Speaker hat.“ oder Spec 6.2 „Vom Master vorgegeben“? | der R2-Satz; er ist vom Owner für R2 freigegeben und nennt Master und Regel | `locked = DATALINK_TEXTE.gesperrtVomMaster` in Task 8 | Task 8 | bestätigt 15.10. |
| OF8 | Texte ohne Spec-Vorgabe (Liste T1–T11 unten) vor dem Abnahme-Bau freigeben („Nach der Umsetzung“, Punkt 6). | wie in der Liste | Texte in Task 8 bzw. Task 6 ändern | Abnahme-Bau | bestätigt 15.10. |
| OF9 | Reihenfolge: Laufen die offenen Abnahmen 2a, 2b-R1 und 2b (R2) noch auf 0.11.0, bevor der Abnahme-Bau 0.12.0 des Pilots an A und B installiert wird („Nach der Umsetzung“, Punkt 6)? Ab 0.12.0 stimmen deren Ortsangaben nicht mehr (`packages/master-link/ABNAHME-2b.md:42` und `:44` „Einstellungen › DataLink“, `apps/titler/ABNAHME-2b-R1.md:13` „Daten / Recall“). | ja, vorher; sonst nennt die neue Abnahme die neuen Orte | ein Hinweisblock in Task 14 mit der Ortsübersetzung | Abnahme-Bau | bestätigt 15.10. |
| OF10 | macOS: Wird Titler 0.12.0 auch als `.dmg` gebaut und auf dem Mac abgenommen (Spec 15: Ampel und Ziehfläche, „wo das Tool dort ausgeliefert wird“)? Das lokale Release-Verzeichnis enthält nur `.exe`. | nur Windows wie 0.10.1 und 0.11.0; die Mac-Zeilen der Abnahme gelten als „entfällt ohne .dmg“ | Mac-Bau plus Abnahme der Ziehfläche und Ampel auf dem Mac | Abnahme-Bau | bestätigt 15.10. |
| OF11 | Electron-Standardmenü: Der Titler setzt kein Menü, also gelten die Kürzel des Electron-Standardmenüs (Funktionsliste Nr. 93, 97). Strg+R im Bedienfenster lädt den Renderer neu und beendet dabei ON AIR (aus dem Code abgeleitet; gemessen wird es in Abnahme 5c, auf einer Testquelle ohne echte Sendung), Strg+W schließt das Fenster. Soll eine Folgeaufgabe das Menü abschalten oder durch ein eigenes ohne „Neu laden“ ersetzen? | Im Pilot unverändert (Main bleibt, U6); als Punkt im Folgeplan aus OF6. Abnahme 5c misst die Wirkung von Strg+R nach „Take“ auf einer Testquelle (ON AIR, NDI-Ausgabe, Ausgabefenster); das Ergebnis geht in den Folgeplan. | Menü-Änderung im Main schon im Pilot (neue benannte U6-Ausnahme, Funktionsliste Nr. 93 und 97 ändern sich); ohne Menü entfällt auch der Zoom per Strg und Plus, auf den E19 und Abnahme 3 bauen | Plan-Freigabe | bestätigt 15.10. |
| OF12 | iveo bei Quelle `show`: Heißt „verbunden“ dort nur „die Show trägt iveo-Speaker ohne Veraltet-Marke“ (E9)? Der Titler misst keine eigene Lieferung; `@jm/settings` sagt im Kopf von `iveo.ts`, „verbunden“ stehe nur bei gemessener Lieferung. | E9 bleibt: ohne Hinweis ● „verbunden“, denn ohne `speakerVeraltetSeit` sagt die Show, dass die letzte Lieferung des Launchers gelang. | `iveoAbschnitt` liefert bei `show` ohne Hinweis `delivery: undefined` (○ „iveo unbekannt“); die iveo-Tabelle in Task 8 und Abnahme 4b ändern sich | Task 8 | bestätigt 15.10. |
| OF13 | Abnahme vor dem Release (Spec 9.1: „released wird nach der Abnahme der Welle (Abschnitt 12) und nur mit Owner-Freigabe“): Der Owner nimmt mit einem lokalen Abnahme-Bau `JM Titler-0.12.0-win-x64.exe` aus dem Branch ab, an A und B von Hand über die installierte 0.11.0 gesetzt (vorgeschlagener Installationsordner), nicht über den Launcher-Katalog. Erst nach bestandener Abnahme und mit seiner Freigabe folgen Merge, Tag, GitHub-Release und Katalog. Einverstanden? | ja. Der Launcher startet den Titler weiter über die Kachel: Er erkennt ein Tool an der Programmdatei am Installationspfad und vergleicht für Updates mit der zuletzt von ihm installierten Version, bietet bis zum Release also kein Update an (`apps/launcher/src/main/install-state.ts`, `updates.ts`, am Code gelesen). | Release vor der Abnahme wie bei 0.10.1 und 0.11.0; das weicht von Spec 9.1 ab und braucht die ausdrückliche Freigabe des Owners. „Nach der Umsetzung“ Punkt 5 bis 8 und die Voraussetzung der Abnahme-Datei (Task 14) ändern sich. | Task 14 | bestätigt 15.10. |
| OF14 | NDI-Quellenname (L1, E7): Übernahme bei Enter bzw. Verlassen und ohne Leerzeichen am Anfang und Ende, wie der Abschnitt `NdiOutputSection` aus dem Fundament es vorgibt, statt je Tastendruck? Wirksam wird der Name wie heute erst beim nächsten Start der Ausgabe; Escape verwirft einen angefangenen Namen. | ja; der Abschnitt aus `@jm/settings` bleibt, wie er ist (Spec 6). | `NdiOutputSection` bräuchte in Task 6 eine additive Übernahme je Tastendruck (wie OF4 für den Ordnerpfad), oder der Titler behielte ein eigenes Feld neben dem Abschnitt (Task 8 und 11; Spec 6 sieht den Abschnitt vor); Funktionsliste Nr. 50 ändert sich. | Task 6 | bestätigt 15.10. |

**Texte ohne Spec-Vorgabe (OF8; im Plan wörtlich, mit Ort):**
- T1 Master-Eintrag (`MASTER_LINK_TEXTE`, `@jm/ui`, Task 5): „Master“, „aus“, „nicht gestartet“, „sucht …“, „verbindet …“,
  „verbunden“, „verbunden mit {Name}“. Bei `fehler` steht der Client-Text, bei unbekannt `UNBEKANNT`.
- T2 Statuslabels (Task 8): „Master“, „iveo“, „NDI“, „Bildschirm“, „Fernsteuerung“ (OF2), „DataLink“.
- T3 Haupttasten (Task 8): „Take“, „Clear“, „◀ Eintrag“, „Eintrag ▶“. Sperrgründe „Erster Eintrag“ und „Letzter Eintrag“.
- T4 Hinweiszeile bei NDI aus (Task 8): „NDI unter Einstellungen › NDI-Ausgabe starten, damit die transparente Quelle im
  Netz erscheint. Vorschau läuft auch ohne NDI.“ Bei NDI an bleibt der Text unverändert.
- T5 „Daten / Recall“ ohne Ordner (Task 8): der Text von heute (Nr. 29), nur „Im Reiter **Einstellungen › DataLink**“ wird
  zu „Unter **Einstellungen › DataLink**“.
- T6 Bedienung Grafik (Task 8): „Keine Grafik-Vorlage gewählt — unter „Grafik-Vorlagen“ auswählen oder unter
  Einstellungen › Grafik-Vorlagen importieren.“; leer: „Noch keine Vorlagen. Import unter Einstellungen › Grafik-Vorlagen.“
- T7 Panel tool-eigen (Task 8): Titel „Stil“ und „Grafik-Vorlagen“, Knopf „Löschen“ mit `aria-label`
  „Vorlage „{Name}“ löschen“.
- T8 DataLink-Erweiterung (Task 6): „1 Eintrag“, „{n} Einträge“, „keine Einträge“, Feld „Ordnerpfad“, Knopf „Ordner
  entfernen“.
- T9 Bildschirm-Erweiterung (Task 6): Knopf „Standardfarbe ({hex})“, `aria-label` des Farbwählers „Farbe wählen“.
- T10 Fernsteuerung (Task 8): Modulname „jm-suite“ im festen Satz `REMOTE_TEXTE.companion`.
- T11 Recall-Board (Task 12): „Lädt…“ (wie im Operator), solange der Zustand fehlt.
- Berichtigt, nur die Anführungszeichen (Befund 9): `RecallBoard.tsx:89` „Kein Eintrag passt zu „{q}“.“. Der Text aus
  `OperatorView.tsx:386` geht in T6 auf.

## Beim Zusammensetzen: Abweichungen und Entscheidungen der Montage

Der Plantext wurde nach dem Zusammensetzen in einer frischen Kopie von `5e5b234ec3` vollständig durchgespielt: Jeder
Code-Block für eine neue Datei, jede Einfügung und jede Vorher/Nachher-Ersetzung wurde maschinell und wörtlich aus diesem
Text eingespielt, Aufgabe für Aufgabe, mit Halt an jeder Rot-Stelle (243 Operationen, nach der Nachbesserung 250; Fehler 0,
jede Vorher-Stelle genau einmal; `@jm/*` der Kopie zeigten auf die Pakete der Kopie, auch `@jm/settings`). Nach jeder Aufgabe liefen die
betroffenen Selbsttests und die Typprüfung, ab Task 7 auch Bau und Klassen-Probe. Dabei entschieden bzw. berichtigt:

- **Z1 Zählstände über die Blockgrenzen.** Block B und C waren ohne Block A gemessen (alter Titler-Lauf 512, Platzhalter
  „N_alt“ und „N_C8“, Messmarken für den Oberflächen-Lauf), Block D gegen Nachbauten (Titler „627 = 512 + 115“). Mit dem
  echten Task 3 und 4 hat der alte Lauf ab Task 4 **538** `ok` (512 + 21 + 5). Gemessen und eingesetzt, im Stand nach der
  Nachbesserung (NB30): beide Läufe zusammen 552 (Task 7), 590 (Task 8), 614, 648, 672, 684 (Task 9–12) und 799 (Task 13);
  Oberflächen-Lauf 14, 52, 76, 110, 134, 146, 261; Rot-Läufe 121 (Task 11), 141 (Task 12) und 687 (Task 13); `@jm/ui` 670
  nach Task 5, 679 nach Task 6 und 680 nach Task 9. Die Zahlen des Oberflächen-Laufs aus Block C
  stimmten mit den Werten, die Block C gegen den echten Text von Block B gemessen hatte, überein. Keine Messmarke ist übrig.
  Nach der letzten Nachbesserung (NB38) gelten: beide Läufe zusammen 552, 590, 614, 649, 674, 686 (Task 7–12) und 802
  (Task 13); Oberflächen-Lauf 14, 52, 76, 111, 136, 148, 264; Rot-Läufe 122 (Task 11), 143 (Task 12) und 689 (Task 13);
  `@jm/ui` unverändert 670, 679 und 680 (in Task 5 sind drei Prüfungen ersetzt, keine dazugekommen).
- **Z2 Zeilenenden-Prüfung in Block C konnte den Fehler nicht zeigen.** Block C prüfte mit
  `printf … "$(grep -c $'\r$' "$f")"`. In Git Bash 5.3.9 geht das Wagenrücklauf-Zeichen in der Befehlsersetzung verloren,
  das Muster wird `$` und zählt **jede** Zeile: Eine LF-Datei mit 24 Zeilen ergab „CRLF=24“ (gemessen). Die erwarteten
  Werte „CRLF=0“ waren so nicht messbar, und eine versehentlich mit CRLF geschriebene neue Datei wäre nie aufgefallen.
  Entscheidung: In Task 9–12 steht jetzt die Node-Prüfung aus Block B (`datei zeilen crlf einheitlich|GEMISCHT`); die
  erwarteten Ausgaben sind auf deren Form umgestellt und je Aufgabe gemessen.
- **Z3 Gesamtprüfung ohne den Plan selbst (Task 16 Step 6 und 7).** Ob der Controller den Plan auf dem Branch committet,
  steht nicht fest, und seine Länge ändert sich mit jeder Nachbesserung; Block D hatte deshalb Messmarken für Dateizahl und
  `--stat`. Entscheidung: Pfadfilter, `git diff --stat` und das Zeilenenden-Skript lassen den Plan aus (`:(exclude)` bzw.
  Filter im Skript). Gemessen (nach der Nachbesserung, NB30): 63 Dateien (28 neu, 35 geändert),
  `63 files changed, 4313 insertions(+), 776 deletions(-)`,
  neue Dateien alle LF, geänderte nicht gemischt, nur `cookbook.json` mit LF. Nach der letzten Nachbesserung (NB38): weiter
  63 Dateien (28 neu, 35 geändert), jetzt 4429+/776−; die 116 Zeilen mehr sind der Effektkörper `hookAbo` und die neuen
  Tests zu R1 bis R4 (`bruecke.test.ts`, `live.test.tsx`, `panel.test.tsx`, `funktionsliste.test.ts`). Messweg: Die Messkopie hat kein Git; der
  Vergleich lief Datei für Datei mit `git diff --no-index --numstat` gegen `git archive 5e5b234ec3` (Bau-Ausgaben per
  `git check-ignore` aussortiert; `core.autocrlf` normalisiert die Zeilenenden dabei wie im Worktree). Die geänderten
  Skripte liefen zusätzlich lesend im Worktree auf dem sauberen Stand (`Dateien 0, außerhalb G1 0`, `Exit=0`; Gegenprobe
  `außerhalb G1 2`). Die Erwartung zu „geändert mit LF“ nennt jetzt den Stand eines frisch angelegten Worktrees; im
  Worktree `ux-update` kommt `docs/ux/suite-ux-roadmap.md` dazu (dort `w/lf`).
- **Z4 Abweichungen der Blöcke vom Gerüst, übernommen.** `views/felder.tsx` entsteht schon in Task 9 (sonst Kreisimport mit
  `OperatorView.tsx`), Stil und Grafik-Vorlagen ziehen schon in Task 10 ins Panel, `apps/titler/test/ui/testzustand.ts` ist
  eine neue Testhilfe (Task 9), `listDisplays()` bekommt einen Ablehnungs-Zweig (E8). Kopf (Architecture), Dateistruktur
  und die Verweise in Task 9 und 13 sind angepasst. Die Ortsvorgabe der Funktionsliste (Task 13) ist gegen den echten
  Stand nach Task 12 geprüft: Jeder Ort und jede Datei passt, keine Zeile musste geändert werden.
- **Z5 Block C ohne Blockkopf.** Ergänzt: „Gemeinsam für Block C“ mit Arbeitsort, Edit-/Write-Regel, Zählweise je Lauf,
  Render über den Anfangszustand des Stores, Gegenproben, Abschluss je Aufgabe (Typprüfung, Bau, Klassen-Probe) und den
  gemessenen Zählständen.
- **Z6 Herkunftsnotizen der Schreiber.** Hinweise auf Messkopien, Nachbauten, das Abspielwerkzeug und Notizen an andere
  Schreiber („Für Block D“) sind aus dem Plantext genommen oder durch die beim Zusammensetzen gemessenen Werte ersetzt
  (Block-B-Kopf, Task 7, 8, 9, 13–16). Die Herkunft steht nur noch hier und im Kopf unter „Wie dieser Plan entstanden ist“.
- **Z7 CI-Datei.** Nach Task 7 hat `.github/workflows/ci-checks.yml` 128 Zeilen (je eine Kommentarzeile aus Task 2 und 7),
  nicht 127 wie ohne Block A gemessen; der Job `selftests` bleibt bei 22 Schritten.
- **Z8 Gegenproben.** Neu gemessen und gleich geblieben: alle elf aus Task 8 (nach der Nachbesserung 14), die 16 aus
  Task 9–12 (nach der Nachbesserung 33; maschinell gegen den
  Plantext verglichen, jede `FAIL`-Zeile und die Zahl wörtlich), die neun aus Task 13 (Ausgabe wörtlich gleich, danach
  „Liste und Bedienung unverändert“), die aus Task 14 (`false` und 1) und Task 7 Probe 3 (mit dem echten Task 3 und 4
  weiter genau ein Fehler, `TS2339` an `test/selftest.ts:685`). Nicht neu gemessen, weil Code und Tests am Ort der Probe byte-gleich zum Messstand des Schreibers
  waren: Task 1–4 (Block A maß auf `5e5b234ec3` ohne Vorgänger), Task 5 und 6 (Block A ändert `packages/ui` und
  `packages/settings` nicht), Task 7 Proben 1, 2, 4 und 5 (unabhängig von Block A). In der Nachbesserung nach der
  Plan-Prüfung sind alle Gegenproben von Task 1–16 neu gemessen worden, auch diese; 26 sind dazugekommen (NB30). In der
  letzten Nachbesserung sind sieben dazugekommen (Task 5: 14 und 15; Task 10: k und l; Task 11: f; Task 13: 10 und 11),
  Task 5 Probe 9, 12 und 13 zielen auf den neuen Aufbau des Hooks; danach sind alle Gegenproben von Task 1–16 noch einmal
  gemessen und gegen den Plantext bzw. die Logs der Nachbesserung verglichen (NB38): Task 9–12 jetzt 36, Task 13 elf.
- **Z9 Abgleich der erwarteten Ausgaben.** Jede `ok`-Zeile und jede `FAIL`-Zeile eines Rot-Laufs, die der Plan als erwartete
  Ausgabe nennt, kam im Lauf ihrer Aufgabe wörtlich vor (maschinell verglichen; ausgenommen zwei Zeilen mit dem Platzhalter
  `<worktree>`). Die `FAIL`-Zeilen der Gegenproben sind unter Z8 abgedeckt.
- **Z10 Zweites Abspielen.** Der ganze Plantext ohne Tests in eine zweite frische Kopie gespielt (243 Operationen, Fehler 0),
  danach `npm run cookbook:build` wie in Task 15 Step 6: Alle 61 berührten Dateien sind Byte für Byte gleich mit der
  Messkopie, und das Diff-Bild gegen `5e5b234ec3` (Dateilisten, Zeilenzahlen) ist dasselbe. Damit blieb auch keine
  Gegenprobe in der Messkopie stehen. Nach der Nachbesserung wiederholt (NB30): 250 Operationen, Fehler 0; alle 1861
  nicht ignorierten Dateien der zweiten Kopie sind Byte für Byte gleich mit der Messkopie, darunter die 63 berührten. Nach
  der letzten Nachbesserung noch einmal (NB38): 250 Operationen, Fehler 0, `cookbook:build` an derselben Stelle; alle 1861
  nicht ignorierten Dateien gleich, darunter die 63 berührten (Diff-Bild 63 Dateien, 4429+/776−).

## Gemessene Zählstände

Gemessen beim Zusammensetzen am 14.10.2026 und nach der Nachbesserung am 14. und 15.10.2026 neu, jeweils in einer frischen
Kopie von `5e5b234ec3` (Windows 11, Node 24.16.0): der Plantext maschinell und wörtlich eingespielt, Aufgabe für Aufgabe in
Planreihenfolge; je Aufgabe zuerst jeder rote Zwischenstand, dann der grüne Endstand mit Typprüfung und allen Gegenproben.
Die Zählspalten und die CSS-Größen nach Task 9–12 sind im Abschluss der Nachbesserung (NB30) noch einmal nach jeder Aufgabe
gemessen, Zeile 16 ganz. Nach der letzten Nachbesserung (Restlücken R1–R5) ist der ganze Plan noch einmal so gemessen,
Aufgabe für Aufgabe mit jedem roten und grünen Lauf, den Typprüfungen, Bau und Klassen-Probe und allen Gegenproben (NB38);
die Tabelle zeigt diesen Stand. „Rot“ ist die erste Meldung des roten Laufs, die Zählspalten zeigen die `ok`-Zeilen im
grünen Lauf (Gesamtstand des Pakets bzw. Laufs), „Proben“ die `FAIL`-Zahl je Gegenprobe in Planreihenfolge (Herkunft unter
Z8, NB30 und NB38). „–“ heißt: Die Aufgabe berührt den Lauf nicht.

| Task | Rot | Titler alt | Titler Oberfläche | `@jm/ui` | `@jm/settings` | app-runtime | Steuerprotokoll | Typprüfung, Bau | Proben (FAIL je Probe) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| vorher | – | 512 | – | 627 | 419 | 50/0 und 227/0 | 77 | 31 Workspaces `Exit=0` | – |
| 1 | `ENOENT …funktionslisten\titler.md` | – | – | – | – | – | – | Liste 60/12/12/7/1/5/6, 103, Köpfe 10 | je 1 Meldung (5 Proben) |
| 2 | `ERR_MODULE_NOT_FOUND …master-link-meldung`; dann `250 passed, 4 failed` | – | – | – | – | 50/0 und **254/0** | – | alle 31 Workspaces `Exit=0` (95 s); Main 266287 B, Preload 3622 B | 1, 1, 1, 1, 4b-Wächter 1 (49/1), 1, 1; Positivprobe grün (254/0) |
| 3 | Protokoll 78 `ok` + 2 `FAIL`; Titler `ERR_MODULE_NOT_FOUND …fernsteuerung` nach 512, dann 530 + 3 `FAIL` | **533** | – | – | – | – | **80** | Titler `Exit=0`; alle 31 Workspaces `Exit=0` (66 s); Bündel-Probe `open` / `secure secure open open` | 1, 3, 1, 1, 1, 1, 1; Protokoll 1 |
| 4 | 534 + 4 `FAIL`; `typecheck:node` `TS2739`, `Exit=2` | **538** | – | – | – | – | – | `Exit=0`; Preload 4246 B (3 × `jmps:master-link`) | `TS2322` + `TS2345` (2 Fehler), 2, 1, 1 |
| 5 | `ERR_MODULE_NOT_FOUND …ui\src\lib\master-link`; dann 668 + 2 `FAIL` | – | – | **670** | – | – | – | ui `Exit=0` | 3, 2, 1, 2, 1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 1 |
| 6 | settings `SyntaxError … 'farbeGewaehlt'`; ui 9 `FAIL` | – | – | **679** | **463** | – | – | ui, settings `Exit=0`; Galerie 20 `ok` (CSS 37,03 kB) | 3, 3, 1, 4, 1, 1, 1 |
| 7 | `ERR_MODULE_NOT_FOUND … '@/lib'`; dann 10 `ok` + 4 `FAIL` | 538 | **14** | – | – | – | – | `Exit=0` (drei `tsc`); Bau 51,58 kB, Klassen-Probe 20 `ok`; CI 22 Schritte, 128 Zeilen | `ReferenceError`; 1 (Probe) und 1 (Lauf); `TS2339` an `:685`; 1; `TS2322` |
| 8 | `ERR_MODULE_NOT_FOUND … '@/lib'` (alter Lauf grün) | 538 | **52** | – | – | – | – | `Exit=0` | 2, 1, 1, 1, 2, 2, 2, 1, 2, 1, 1, 1, 1, 1 |
| 9 | `ERR_MODULE_NOT_FOUND … '@/lib'` (alter Lauf grün); `@jm/ui` 679 + 1 `FAIL` („StatusPill kuerzen …“) | 538 | **76** | **680** | – | – | – | Titler und ui `Exit=0`; Bau 50,81 kB, Probe 20 `ok` | 1, 3, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1 (a–m); ui 1 (n) |
| 10 | `ERR_MODULE_NOT_FOUND … '@/views'` | 538 | **111** | – | – | – | – | `Exit=0`; Bau 51,18 kB, Probe 20 `ok` | 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1 |
| 11 | 122 `ok` + 14 `FAIL` | 538 | **136** | – | – | – | – | `Exit=0`; Bau 50,67 kB, Probe 20 `ok` | 4, 2, 2, 2, 1, 1 |
| 12 | 143 `ok` + 5 `FAIL` | 538 | **148** | – | – | – | – | `Exit=0`; Bau 50,64 kB, Probe 20 `ok` | 2, 2, 1, 1 |
| 13 | 113 `FAIL` (alle aus dem neuen Test), 689 `ok` | 538 | **264** | – | – | – | – | `Exit=0` | 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 |
| 14 | `fehlt: docs/ux/ABNAHME-UX-Welle-0.md` | – | – | – | – | – | – | Prüfbefehl: 19 Zeilen, 1/4/1/6/4/3, 10 Zusatzprüfungen, CRLF 0, ASCII 0 | im Speicher: Spalten `false`, ASCII 1 |
| 15 | vorher 2 / 1 / 1 · 0 / 0 · 0 | – | – | – | – | – | – | nachher 0 / 0 / 0 · 3 / 1 · 1; Kochbuch frisch (43); numstat 3/2, 1/1, 1/1, 3/1, 9/7, 11/9 | – |
| 16 | – | 538 | 264 (zusammen 802) | 680 | 463 | 50/0 und 254/0 | 80 | alle 31 Workspaces `Exit=0` (75 s), `typecheck:test` läuft mit; Bau (CSS 50,64 kB), Klassen-Probe 20 `ok`; Galerie 20 `ok`; Diff 63 Dateien (28 neu, 35 geändert), 4429+/776−; byte-gleich 33 Pfade, 76 Dateien | Pfadfilter `Dateien 65, außerhalb G1 2`, `Exit=1`; Byte-Vergleich mit `views/OperatorView.tsx` abweichend |

Die Spalte „Typprüfung, Bau“ nennt nach Task 7 bis 12 die Größe des gebauten Titler-CSS nur als Messwert, nicht als
Erwartung; ebenso die Laufzeiten der Typprüfung aller Workspaces, die von Lauf zu Lauf schwanken. Tabelle und Text der
Aufgabe nennen denselben Lauf. Der Titler-Bau braucht kein Electron-Programm (`electron-vite build`).

---

## Aufgaben

## Block A · Funktionsliste und Brücken (C1–C4)

**Gemeinsam für Block A (Tasks 1–4):**
- Alle Befehle im Bash-Werkzeug (Git Bash) an der Wurzel des Plan-Worktrees, alle Pfade relativ dazu (G17). Voraussetzung
  jeder Aufgabe: Die vorige ist committet, ihre Zählstände stimmen.
- Bestehende Dateien ändert das Edit-Werkzeug (Vorher-Text exakt, genau einmal vorhanden; das Werkzeug behält das CRLF der
  Datei). Neue Dateien schreibt das Write-Werkzeug mit LF. Die Vorher-Texte gelten für `5e5b234ec3` nach der jeweils vorigen
  Aufgabe; Zeilenangaben sind Orientierung, maßgeblich ist der wortgleiche Vorher-Text. Eine Einfügung „direkt vor der
  Zeile `…`“ setzt die neuen Zeilen vor die eine Zeile, die mit diesem Text **beginnt**.
- **Ausgaben** gehen in den Scratchpad der Sitzung: `SP='<eigener Scratchpad>'` steht vor jedem Befehl, der eine Datei
  schreibt, und ist vor dem Lauf durch den Pfad aus dem Systemprompt zu ersetzen (G17). Zeigt `SP` auf keinen Ordner,
  bricht der Befehl ab (`[ -d "$SP" ] &&`), ohne etwas zu schreiben.
- **Zeilenenden prüfen (G11):**
  ```
  node -e "for (const f of process.argv.slice(1)) { const t = require('fs').readFileSync(f, 'utf8'); console.log(f, (t.match(/\n/g) || []).length, (t.match(/\r\n/g) || []).length); }" <Dateien>
  ```
  Ausgabe je Datei: Pfad, Zahl der Zeilen, Zahl der CRLF. Geänderte Dateien: beide Zahlen gleich. Neue Dateien: 0 CRLF.
- **Zählweisen:**
  - app-runtime meldet je Lauf `… passed, … failed`, erst `test/selftest.ts` (4b-Wächter, CSP, Log-Aufräumen), dann
    `test/verbund.test.ts`. Die Zeilen heißen `  ok  …` bzw. `FAIL  …` und gehen beide auf stdout.
  - Titler und Steuerprotokoll: `ok`-Zeilen mit `grep -cE '^\s*ok\b'`; `FAIL`-Zeilen gehen dort auf stderr (deshalb `2>&1`).
  - Das `| grep` verschluckt den Exitcode, darum immer zuerst den Lauf mit `echo "Exit=$?"` lesen.
- **Gegenproben** (Steps mit „Gegenprobe“ im Titel) ändern Code nur vorübergehend im Worktree, mit dem Edit-Werkzeug, und
  werden exakt zurückgenommen (Nachher → Vorher), bevor die Aufgabe weitergeht; danach zeigt der Lauf wieder den grünen
  Zählstand und `git diff --stat` nur die Dateien der Aufgabe. Sie werden nie committet (G9).
- **Typprüfung (G10):** Ändert eine Aufgabe `packages/app-runtime/src` oder `packages/suite-control-protocol/src`, läuft
  `npm run typecheck --workspaces --if-present` (31 Workspaces, gemessen 66–95 s, nie parallel zu einer zweiten
  Typprüfung, Speicher etwa 4 GB), sonst `npm run typecheck -w @jm/titler` (gemessen 6 s).
- **Gemessen** wurde jeder Schritt dieses Blocks am 14.10.2026 in einer frischen Kopie des echten `main` `5e5b234ec3`
  (`git archive`, ohne Abspielen eines anderen Plans; `node_modules` als Junctions auf den Worktree, `@jm/*` auf die Pakete
  der Kopie), Windows 11, Node 24.16.0, tsx 4.22.4, TypeScript 5.9.3, esbuild 0.21.5. Der Plantext selbst (jede neue Datei,
  jede Einfügung, jede Vorher/Nachher-Ersetzung) wurde maschinell Schritt für Schritt in die Kopie gespielt; die angegebenen
  Ausgaben sind die gemessenen, Pfade sind durch `<worktree>` ersetzt. `git status --short` ist aus den Operationen
  abgeleitet (die Messkopie hat kein Git). Nach der Nachbesserung der Plan-Prüfung (Befunde funktionsliste:1, code:1,
  code:4) ist der ganze Block noch einmal so gemessen, mit jedem roten und grünen Lauf, beiden Typprüfungen aller
  Workspaces, dem Bau und allen Gegenproben.
- **Zählstände über den Block:** app-runtime `50 passed` + `227 passed` → nach Task 2 `50 passed` + `254 passed`;
  Steuerprotokoll 77 → nach Task 3 80 `ok`; Titler 512 → nach Task 3 533 → nach Task 4 538 `ok`-Zeilen; je ohne `FAIL`.
  Typprüfung aller Workspaces nach Task 2 und Task 3 je `Exit=0`, 0 `error TS` (gemessen 95 s bzw. 66 s). Preload-Bündel
  des Titlers 3622 Byte auf `5e5b234ec3` und nach Task 2, 4246 Byte nach Task 4.

---

### Task 1: C1 · Funktionsliste vor dem Umbau (`docs/ux/funktionslisten/titler.md`)

**Spec:** `docs/superpowers/specs/2026-10-08-suite-ux-update-design.md` Abschnitt 10 (Funktionsliste vor dem Umbau aus dem
Code: jedes Bedienelement mit Handler, jedes Tastaturkürzel, jeder Dialog, jede Einstellung; Pflichtpunkt Panel-Tasten nach
Owner-Entscheid O1; Kürzel bleiben gleich), Anhang A „Titler“, UO5 (keine neuen Kürzel). Global Constraints G5, G11, G12.

**Voraussetzung:** Plan-Worktree auf `5e5b234ec3`. Keine vorige Aufgabe. `docs/ux/` enthält nur `suite-ux-roadmap.md`.

**Dateien:**
- Create: `docs/ux/funktionslisten/titler.md` (LF)

**Interfaces:**
- Consumes: nichts.
- Produces (Vertrag für C13, Block D): Punkte **1–103**, fortlaufend, in sieben Tabellen (Abschnitte `## 1 · ` bis
  `## 7 · `) mit genau dem Kopf
  `| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |`; das Feld „künftig wo“ ist
  in jeder Zeile leer (`| |` am Zeilenende). Zeilen je Abschnitt: 1 → 60 (Nr. 1–60), 2 → 12 (61–72), 3 → 12 (73–84),
  4 → 7 (85–91), 5 → 1 (92), 6 → 5 (93–97), 7 → 6 (98–103). Die Abschnittsköpfe `## 8 · ` (IPC-Übersicht), `## 9 · `
  (Zuordnung zu Spec 6) und `## 10 · ` (Befunde 1–19) haben andere Tabellenköpfe bzw. keine Tabelle und werden nicht
  abgehakt. Pflichtzeilen: **Nr. 93** Tastenkürzel „**Keine eigenen.**“ samt den Kürzeln des Electron-Standardmenüs und
  **Nr. 96** Pflichtpunkt Panel (Leertaste und Escape in einer Zeile).

**Verhalten (verbindlich):**
- Inhalt ist die Ist-Erhebung vom 13.10.2026 am echten `main` `5e5b234ec3` (Titler 0.11.0), Abschnitte 1–10 wörtlich. Der
  Kopf nennt Zweck, Stand, Pfadregel, R2-Kennzeichnung und Zustands-Kürzel, aber keine Namen von Messkopien oder Werkzeugen.
- Nur „ “ als Anführungszeichen außerhalb von Code-Spans; die zwei ASCII-Schlusszeichen aus dem Code (Befund 9) sind in der
  Liste schon als “ wiedergegeben.
- Die Spalte „künftig wo“ füllt erst C13 (nach dem Umbau, mit Haken und Ort).

---

- [ ] **Step 1: Ausgangslage (rot, erwartet)**

```
ls docs/ux
node -e "require('fs').readFileSync('docs/ux/funktionslisten/titler.md', 'utf8')"; echo "Exit=$?"
```
Erwartet (gemessen):
```
suite-ux-roadmap.md
…
Error: ENOENT: no such file or directory, open '<worktree>\docs\ux\funktionslisten\titler.md'
…
Exit=1
```

- [ ] **Step 2: Funktionsliste schreiben** (Write-Werkzeug, LF)

Neue Datei `docs/ux/funktionslisten/titler.md`, ganzer Inhalt:
````markdown
# Funktionsliste JM Titler (Suite-UX-Update, Welle 0 · Titler-Pilot)

Zweck (Spec `docs/superpowers/specs/2026-10-08-suite-ux-update-design.md`, Abschnitt 10 „Kein Funktionsverlust“, und
Anhang A „Titler“): jedes Bedienelement mit Handler, jedes Tastaturkürzel, jeder Dialog und jede Einstellung des Titlers,
erhoben **vor dem Umbau** aus dem Code. Nach dem Umbau bekommt jede Zeile in der Spalte „künftig wo“ einen Haken mit dem
Ort im neuen Aufbau; ein Punkt ohne Haken blockiert die Welle.

- **Stand:** erhoben aus dem Code am 2026-10-13, `main` `5e5b234ec3` (mit PR #250, #251, #253, #254), Titler 0.11.0.
  Nichts ausgeführt, kein Fenster geöffnet. Was nur aus dem Code abgeleitet ist, steht als „abgeleitet“, Unklares als
  „unklar“ bzw. „nicht gemessen“.
- **Gelesen, vollständig:** `apps/titler/src/renderer/**` (`index.html`, `main.tsx`, `App.tsx`, `globals.css`,
  `jmtitler.d.ts`, `vite-env.d.ts`, `store/titler.ts`, `lib/*.ts`, `views/*.tsx`), `preload/index.ts`, `shared/types.ts`,
  `shared/datenquelle.ts`, `shared/vars.ts`, `main/index.ts`, `main/control-server.ts`, `main/library.ts`,
  `main/config.ts`, `main/ndi/sender-process.ts`, `utility/ndi-sender.ts`. Ausschnitte: `shared/datalink-kern.ts`
  (Hinweise, Vorrang), `main/datalink.ts` (Fehler, Log), `shared/text-kodierung.ts` (Kopf), aus `@jm/ui` `Collapsible`,
  `Tabs`, `SettingsSection`, `SettingsPanel` (Tastenregel) und `Button`, aus `@jm/app-runtime` `verbund-ipc.ts`,
  `verbund-anzeige.ts`, `verbund.ts` und `index.ts` (Master-Link-Start).
- **künftig wo** bleibt leer. Die Spalte wird nach dem Umbau gefüllt und abgehakt.
- **Pfade:** ohne Präfix relativ zu `apps/titler/src/renderer/src/`; `main/…`, `preload/…`, `shared/…`, `utility/…` und
  `renderer/…` relativ zu `apps/titler/src/`; `app-runtime/…` = `packages/app-runtime/src/…`, `ui/…` =
  `packages/ui/src/components/…`; alles andere relativ zur Repo-Wurzel. Zeilennummern gelten für `5e5b234ec3`.
- **R2-Kennzeichnung:** „(R2)“ bzw. „R2:“ = mit Master-Link 2b R2 (Commit `1f0bcf9085`, der einzige Renderer-Commit seit
  `adda584693`) neu oder geändert. Ohne Kennzeichnung: älter.
- **Zustands-Kürzel** (Spalte „Zustand (sichtbar/aktiv)“): **imm.** = immer sichtbar, sobald `state` geladen ist ·
  **S** = nur im Reiter „Steuerung“ · **E** = nur im Reiter „Einstellungen“ · **auf** = nur bei aufgeklapptem Abschnitt.
- **Nummerierung:** fortlaufend 1–103 in den Abschnitten 1–7. Die Abschnitte 8 (IPC-Übersicht), 9 (Zuordnung zu Spec 6)
  und 10 (Befunde) haben keine nummerierten Punkte und werden nicht abgehakt.

---

## 1 · Hauptfenster (Operator, ohne `?view=`)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
| 1 | Fenster | Lade-Anzeige „Lädt…“ (ersetzt die ganze Ansicht) | – ; `load()` ohne `catch` (`store/titler.ts:47-48`): scheitert `getState`, bleibt „Lädt…“ stehen (abgeleitet) | solange `state` null ist | `views/OperatorView.tsx:235-237` | |
| 2 | Kopfzeile | Logo, „JM TITLER“, „Live-CG → NDI“ | – (Anzeige) | imm. | `views/OperatorView.tsx:251-256` | |
| 3 | Kopfzeile | Verbund-Abzeichen (V-Zeile V2–V15, Rahmen- und Textfarbe grün/gelb/rot/gedämpft, `max-w-[24rem]`, gekürzt, voller Text als Tooltip) (R2) | `window.jmtitler.verbundAnzeige()` beim Einhängen, `onVerbundAnzeige(setAnzeige)`; IPC `jmps:verbund-anzeige` (invoke + Push an alle Fenster, `app-runtime/verbund-ipc.ts:12-33`); Texte `app-runtime/verbund-anzeige.ts:24-77` | nur wenn eine Zeile kommt; `null` am Einzelplatz (`app-runtime/verbund-anzeige.ts:25`) und wenn das invoke scheitert (`preload/index.ts:89` fängt ab) → dann leerer Abstandshalter mit `ml-auto` | `views/OperatorView.tsx:257`, Komponente `:893-908`, Farben `:881-886` | |
| 4 | Kopfzeile | Pill „Suite · ⟨n⟩ verbunden“ / „Suite getrennt“, Punkt primär/gedämpft, Tooltip „Verbundene Suite-Steuerclients (Companion, Q&A, Battle, System-Zustand)“ (R2: `ml-auto` wanderte ans Abzeichen) | – (Anzeige `status.suiteClients`; gesetzt in `main/index.ts:779-782` aus `onStatus` des Steuerservers, `main/control-server.ts:131`; Port 8726 fest, `main/control-server.ts:27`) | imm.; „getrennt“ bei 0 Clients und ebenso, wenn der Steuerserver nicht startet (nur Log, `main/index.ts:806-810`) | `views/OperatorView.tsx:258-272` | |
| 5 | Kopfzeile | Pill „NDI · ⟨n⟩ Empfänger“ / „NDI aus“ | – (Anzeige `status.ndiActive`, `status.connections`) | imm. | `views/OperatorView.tsx:273-286` | |
| 6 | Live-Bereich | CG-Vorschau (Canvas 960×540 auf Schachbrett `.cg-checker`) | `useTitlerEngine(resolved, ndiActive, previewRef, { graphic })` (`:65`), Takt `setInterval` ≈ 60 Hz (`lib/engine.ts:184`) | imm. | `views/OperatorView.tsx:292-294` | |
| 7 | Live-Bereich | Knopf „● Take (On Air)“, Ring solange `live` | `take()` → `animateTo(1)`; `live` wird sofort true, nicht erst nach der Einblendung (450 ms) (`lib/engine.ts:15`, `:54-58`); Folge: Nr. 80 | imm., nie gesperrt | `views/OperatorView.tsx:296-303` | |
| 8 | Live-Bereich | Knopf „Clear“ | `clear()` → `animateTo(0)` (`lib/engine.ts:59`) | imm., nie gesperrt | `views/OperatorView.tsx:304-306` | |
| 9 | Live-Bereich | Hinweiszeile unter Take/Clear: „NDI-Quelle aktiv — in TriCaster/vMix/OBS …“ bzw. „NDI rechts starten, damit die transparente Quelle im Netz erscheint. Vorschau läuft auch ohne NDI.“ | – (Anzeige aus `ndiActive`) | imm. | `views/OperatorView.tsx:308-312` | |
| 10 | Steuerpult | Reiter „Steuerung“ / „Einstellungen“ (`role="tab"`) | `Tabs` → `setTab`; gemerkt in `localStorage` `titler.operator.tab` (Nr. 98) | imm. | `views/OperatorView.tsx:320`, Zustand `:222-233`, `ui/Tabs.tsx:25-65` | |
| 11 | Steuerung › Vorlage | 4 Knöpfe „Bauchbinde“, „Banner“, „Ticker“, „Grafik“ (aktiver gefüllt) | `setConfig({ template })` → IPC `titler:setConfig` | S | `views/OperatorView.tsx:325-342` (Handler `:330`) | |
| 12 | Steuerung › Inhalt | Feld „Name“ | `setConfig({ name })` je Tastendruck | S, Vorlage Bauchbinde | `views/OperatorView.tsx:348` | |
| 13 | Steuerung › Inhalt | Feld „Untertitel“ | `setConfig({ subtitle })` je Tastendruck | S, Vorlage Bauchbinde | `views/OperatorView.tsx:349` | |
| 14 | Steuerung › Inhalt | Feld „Banner-Text“ | `setConfig({ bannerText })` | S, Vorlage Banner | `views/OperatorView.tsx:353` | |
| 15 | Steuerung › Inhalt | Feld „Ticker-Text“ | `setConfig({ tickerText })` | S, Vorlage Ticker | `views/OperatorView.tsx:357` | |
| 16 | Steuerung › Inhalt | Schieber „Ticker-Tempo“ (0,02–0,30, Schritt 0,01, Wert mit 2 Stellen) | `setConfig({ tickerSpeed })` | S, Vorlage Ticker | `views/OperatorView.tsx:358-365` | |
| 17 | Steuerung › Inhalt | Je Slot der aktiven Grafik-Vorlage ein Feld (Label = Ebenenname; Wert `slotText[key]` oder `defaultText`) | `setConfig({ slotText: { …c.slotText, [key]: v } })` | S, Vorlage Grafik, Vorlage gefunden, ≥ 1 Slot | `views/OperatorView.tsx:375-382` | |
| 18 | Steuerung › Inhalt | Text „Diese Vorlage hat keine Textfelder (reines Standbild).“ | – | S, Vorlage Grafik, Vorlage ohne Slots | `views/OperatorView.tsx:370-373` | |
| 19 | Steuerung › Inhalt | Text „Keine Grafik-Vorlage gewählt — unter „Grafik-Vorlagen“ importieren oder auswählen.“ | – | S, Vorlage Grafik, `activeGraphicId` leer oder nicht in der Library | `views/OperatorView.tsx:384-387` | |
| 20 | Steuerung › Grafik-Vorlagen | Abschnittskopf (auf/zu, `aria-expanded`) und Beschreibung „Bauchbinden aus dem jm Grafiktool oder als .psd importieren. Textebenen werden zu füllbaren Feldern — Variablen bleiben nutzbar.“ | `Collapsible` → `localStorage` `jm.collapsible.titler.graphics` (Nr. 99) | S; Start zu (`defaultOpen={false}`); Beschreibung nur auf | `views/OperatorView.tsx:392-402`, `ui/Collapsible.tsx:26-34,57-70` | |
| 21 | Steuerung › Grafik-Vorlagen | Ablagefläche „oder .psd / .jmtitler hierher ziehen“ (Drag & Drop) | `onDragOver` preventDefault; `onDrop` → `onDropImport` (`:85-93`): erste Datei, `pathForFile(file)` (webUtils) → `readFile(p)` (IPC `titler:readFile`, `main/index.ts:703-709`, Fehler → null → **still nichts**) → `runImport` → `importFileToTemplate` (`lib/psd-import.ts:181-190`) → Import-Dialog (Nr. 61) | S, auf | `views/OperatorView.tsx:403-414` | |
| 22 | Steuerung › Grafik-Vorlagen | Knopf „Datei importieren…“ | `pickImport` (`:79-82`) → `pickImportFile()` (IPC `titler:pickImportFile`, nativer Dialog Nr. 70; Lesefehler im Main ohne `try`, `main/index.ts:700-701`, Renderer ohne `catch` → keine Anzeige, abgeleitet) → `runImport` → Import-Dialog | S, auf | `views/OperatorView.tsx:408-410` | |
| 23 | Steuerung › Grafik-Vorlagen | Kachel je Vorlage (Vorschaubild oder Schachbrett, Name, Tooltip Name; aktive umrandet) | Klick → `selectTemplate` (`:83-84`) = `setConfig({ template: 'graphic', activeGraphicId, slotText: {} })`. Kachel ist ein `div` mit `onClick`, ohne `tabIndex`/`role` → per Tastatur nicht erreichbar | S, auf, ≥ 1 Vorlage | `views/OperatorView.tsx:415-449` (Handler `:420`) | |
| 24 | Steuerung › Grafik-Vorlagen | „✕“ je Kachel (Tooltip „Vorlage löschen“) | `stopPropagation`, `deleteTemplate` (`:94-97`): `tpl.remove(id)` (IPC `titler:tpl-remove`), bei aktiver Vorlage `setConfig({ activeGraphicId: '' })`; **ohne Rückfrage** | S, auf; nur bei Mauszeiger über der Kachel sichtbar (`opacity-0 group-hover:opacity-100`), per Tab erreichbar, aber unsichtbar | `views/OperatorView.tsx:436-445` | |
| 25 | Steuerung › Grafik-Vorlagen | Text „Noch keine Vorlagen importiert.“ | – | S, auf, 0 Vorlagen | `views/OperatorView.tsx:451` | |
| 26 | Steuerung › Daten / Recall | Abschnittskopf (auf/zu) | `Collapsible` → `localStorage` `jm.collapsible.titler.recall` (Nr. 100) | S; Start offen | `views/OperatorView.tsx:457` | |
| 27 | Steuerung › Daten / Recall | Quellzeile Q1–Q4 (gekürzt, Tooltip voll): „Quelle: Show „…“ · ⟨n⟩ Speaker“, „Quelle: Show vom Master „…““ (R2), „Quelle: Speaker aus einer früheren Show“, „Quelle: eigener Ordner ⟨Pfad⟩“ | – (Anzeige `status.datenQuelle.zeile`, `shared/datenquelle.ts:301-307`, gesetzt `main/index.ts:183-189`) | S, auf, Zeile nicht leer (leer bei Ordner ohne eigenen Ordner und bei früher ohne Einträge) | `views/OperatorView.tsx:459-463` | |
| 28 | Steuerung › Daten / Recall | Stehender Hinweis H1–H7 (Warnfarbe, `role="status"`), Texte wörtlich `shared/datalink-kern.ts:152-169` (R2: H3/H4/H7 auch bei Quelle master, `shared/datenquelle.ts:176`, `:203-206`) | – (Anzeige `status.hinweis.text`; ein Hinweis nach Vorrang H1/H6 > H2/H5 > H4 > H7 > H3, `shared/datalink-kern.ts:178-186`, gewählt `main/index.ts:179-180`) | S, auf, Hinweis gesetzt | `views/OperatorView.tsx:464-471` | |
| 29 | Steuerung › Daten / Recall | Text „Kein Datenordner aktiv. Im Reiter **Einstellungen › DataLink** einen Ordner wählen — oder den Titler über eine **JM Show** mit iveo-Daten öffnen. …“ | – | S, auf, `datenQuelle.ohneOrdner` (Quelle ordner ohne eigenen Ordner, `main/index.ts:187`) | `views/OperatorView.tsx:472-476` | |
| 30 | Steuerung › Daten / Recall | Fehlerzeile „DataLink: ⟨Fehler⟩“ (z. B. „Ordner nicht gefunden“, `main/datalink.ts:137`, sonst Ausnahmetext `:142`) | – (Anzeige `status.dataError`) | S, auf, nicht `ohneOrdner`, Fehler gesetzt | `views/OperatorView.tsx:477-478` | |
| 31 | Steuerung › Daten / Recall | Zähler „Einträge · ⟨k⟩/⟨n⟩“ bzw. „Einträge · ⟨n⟩“ | – (`zaehlerText`, `lib/datalink-anzeige.ts:10-12`) | S, auf, kein `ohneOrdner`, kein Fehler, ≥ 1 Eintrag | `views/OperatorView.tsx:485-487` | |
| 32 | Steuerung › Daten / Recall | Knopf „⧉ Board“ (Tooltip „Recall-Button-Board in eigenem Fenster öffnen (#152)“) | `openRecall()` (IPC `titler:openRecall`, `main/index.ts:685` → `createRecallWindow` `:518-553`; vorhandenes Fenster wird nur fokussiert) | wie Nr. 31 | `views/OperatorView.tsx:489-497` | |
| 33 | Steuerung › Daten / Recall | Knopf „‹“ (Tooltip „Vorheriger Eintrag“) | `stepEntry(-1)` (IPC `titler:stepEntry`, `main/index.ts:680`) | wie Nr. 31; gesperrt bei aktivem erstem Eintrag (`navGesperrt`, `lib/datalink-anzeige.ts:18-22`); ohne aktiven Eintrag frei | `views/OperatorView.tsx:498-507` | |
| 34 | Steuerung › Daten / Recall | Knopf „›“ (Tooltip „Nächster Eintrag“) | `stepEntry(1)` | wie Nr. 31; gesperrt bei aktivem letztem Eintrag | `views/OperatorView.tsx:508-517` | |
| 35 | Steuerung › Daten / Recall | Eintragsliste (Nr. + Label oder „—“, aktiver hervorgehoben, `max-h-40` mit Bildlauf) | Klick → `recallSchluessel(e.key)` (IPC `titler:recallSchluessel`, `main/index.ts:677-679`, nur String) | wie Nr. 31 | `views/OperatorView.tsx:520-536` (Handler `:524`) | |
| 36 | Steuerung › Daten / Recall | Variablen des aktiven Eintrags `{{k}}` = Wert (oder „—“) bzw. Hilfetext „Keine Variablen gefunden. Lege im Ordner z. B. eine gaeste.csv …“; Zeile „Quelle: ⟨Dateien⟩“ | – (Anzeige `status.variables`, `status.dataSources`) | S, auf, nicht `ohneOrdner`, kein Fehler (auch bei 0 Einträgen) | `views/OperatorView.tsx:541-560` | |
| 37 | Steuerung › Daten / Recall | „Im Text verwendet:“ mit `{{k}}`, grün = vorhanden, rot = fehlt (Tooltip „Variable vorhanden“ / „Variable nicht gefunden“) | – (berechnet aus `name`, `subtitle`, `bannerText`, `tickerText`, **nicht** aus `slotText`, `:133-139`; Vergleich nur `toLowerCase`, ohne NFC, `:128-132`, `:570-572`) | S, auf, ≥ 1 Platzhalter in diesen vier Feldern (auch bei `ohneOrdner`/Fehler) | `views/OperatorView.tsx:563-578` | |
| 38 | Steuerung › Stil | Abschnittskopf (auf/zu) | `Collapsible` → `localStorage` `jm.collapsible.titler.style` (Nr. 101) | S; Start zu | `views/OperatorView.tsx:582` | |
| 39 | Steuerung › Stil | Knöpfe „Unten“ / „Oben“ | `setConfig({ position })` | S, auf | `views/OperatorView.tsx:583-598` (Handler `:587`) | |
| 40 | Steuerung › Stil | Schieber „Größe“ (0,6–1,6, Schritt 0,05, Wert mit 2 Stellen) | `setConfig({ scale })` | S, auf | `views/OperatorView.tsx:599` | |
| 41 | Steuerung › Stil | Farbwähler „Balken“, „Text“, „Akzent“ (mit Hex-Anzeige) | `setConfig({ colors: { bar } })` bzw. `{ text }`, `{ accent }`; Main merged tief (`main/config.ts:55`) | S, auf | `views/OperatorView.tsx:600-604`, `ColorField` `:822-845` | |
| 42 | Einstellungen › DataLink | Abschnitt mit Beschreibung „Platzhalter {{name}} in den Textfeldern werden aus den Dateien im Ordner gefüllt. … im Reiter **Steuerung** abrufbar …“ | – | E | `views/OperatorView.tsx:610-619` | |
| 43 | Einstellungen › DataLink | Textfeld Ordnerpfad (Platzhalter „Kein Ordner gewählt“) (R2: `disabled` bei `ordnerGesperrt`) | `setConfig({ dataFolder })` **je Tastendruck**; im Main zählt jede Änderung als Ordnerwahl (`main/index.ts:659` → `eigenerOrdnerGilt('ordnerGewaehlt')`, löscht die gemerkte Show, `shared/datenquelle.ts:179-188`); R2/E22: Main verwirft einen geänderten `dataFolder` bei Quelle master (`main/index.ts:650-656`, Warnung nur im Log `:361-365`) | E; gesperrt bei Quelle master | `views/OperatorView.tsx:621-628` | |
| 44 | Einstellungen › DataLink | Knopf „Durchsuchen…“ (R2: `disabled` bei `ordnerGesperrt`) | `pickFolder` (`:207-210`) → `pickDataFolder()` (IPC `titler:pickDataFolder`, nativer Dialog Nr. 69) → `setConfig({ dataFolder })`; R2: Main antwortet bei Sperre `''` wie „abgebrochen“ (`main/index.ts:666`) | E; gesperrt bei Quelle master | `views/OperatorView.tsx:629-631` | |
| 45 | Einstellungen › DataLink | Knopf „✕“ (Tooltip „Watchfolder entfernen“) (R2: ausgeblendet bei `ordnerGesperrt`) | `setConfig({ dataFolder: '' })` | E, Ordner eingetragen, nicht Quelle master | `views/OperatorView.tsx:632-636` | |
| 46 | Einstellungen › DataLink | Text „Im Verbund kommen die Speaker vom Master „⟨Name⟩“. Ein eigener Ordner gilt, solange die Show dort keine Speaker hat.“ (R2) | – (Anzeige `datenQuelle.ordnerGesperrt`, Text `shared/datenquelle.ts:323-326`) | E, Quelle master | `views/OperatorView.tsx:638-640` | |
| 47 | Einstellungen › DataLink | Knopf K1 „Zurück zum eigenen Ordner (⟨Ordnername⟩)“ | `zurueckZumEigenenOrdner()` (IPC `titler:zurueckZumOrdner`; R2/E22: Main lehnt bei Sperre ab, `main/index.ts:682-684`) | E, nur Quelle show und eigener Ordner (`shared/datenquelle.ts:313-317`) | `views/OperatorView.tsx:642-652` | |
| 48 | Einstellungen › DataLink | Fehlerzeile „DataLink: ⟨Fehler⟩“ | – (Anzeige `status.dataError`) | E, Fehler gesetzt | `views/OperatorView.tsx:653-655` | |
| 49 | Einstellungen › iveo | Kasten „iveo aktiv“ + „⟨n⟩ Speaker aus der geöffneten JM Show im DataLink. Aktualisiert sich live nach iveo-Änderungen (verwaltet vom Launcher). Abruf im Reiter **Steuerung › Daten / Recall**.“ bzw. Erklärtext „Kein iveo-Event aktiv. …“ (R2: „aktiv“ auch bei Quelle master) | – (Anzeige; `iveoActive = art show oder master`, `:243`; ⟨n⟩ = `entries.length`) | E | `views/OperatorView.tsx:659-680` | |
| 50 | Einstellungen › Ausgabe (NDI) | Feld „Quellname“ | `setConfig({ ndiName })` je Tastendruck (wirkt beim nächsten NDI-Start) | E | `views/OperatorView.tsx:684` | |
| 51 | Einstellungen › Ausgabe (NDI) | Auswahl „Auflösung“ (1920×1080, 1280×720) | `setConfig({ width, height })` | E | `views/OperatorView.tsx:686-701` | |
| 52 | Einstellungen › Ausgabe (NDI) | Auswahl „fps“ (25, 30, 50, 60) | `setConfig({ fps })` | E | `views/OperatorView.tsx:702-714` | |
| 53 | Einstellungen › Ausgabe (NDI) | Knopf „NDI starten“ / „NDI stoppen“ | Store `startNdi(c.ndiName)` → IPC `titler:ndi-start` (`main/index.ts:710` → `:629-638`), danach lokal `ndiActive: true` (`store/titler.ts:54-58`); `stopNdi` → IPC `titler:ndi-stop` (`main/index.ts:711` → `:640-645`), lokal `ndiActive: false, connections: 0` (`store/titler.ts:59-63`) | E; „starten“ bei NDI aus, „stoppen“ bei NDI an | `views/OperatorView.tsx:716-724` | |
| 54 | Einstellungen › Ausgabe (NDI) | Warnung „Auflösung sollte gerade sein.“ | – | E, Breite oder Höhe ungerade (mit den zwei Auswahlwerten nicht erreichbar; nur über eine von Hand geänderte Config denkbar, nicht gemessen) | `views/OperatorView.tsx:725-727` | |
| 55 | Einstellungen › Ausgabe (2. Bildschirm) | Abschnitt mit Beschreibung „Zeigt die Bauchbinde als Vollbild auf einem zweiten Monitor mit Chroma-Green-Hintergrund — für externe Keyer (vMix/ATEM/TriCaster) ohne NDI.“ | – | E | `views/OperatorView.tsx:731-734` | |
| 56 | Einstellungen › Ausgabe (2. Bildschirm) | Auswahl „Monitor“ („Primär (automatisch)“ + je Monitor „⟨B×H⟩ · intern · primär“) | `setConfig({ secondScreenDisplay })`; Liste aus `listDisplays()` (IPC `titler:listDisplays`, `main/index.ts:686`, Label `:126-142`), neu bei `onDisplaysChanged` (Nr. 81) | E | `views/OperatorView.tsx:735-748` | |
| 57 | Einstellungen › Ausgabe (2. Bildschirm) | Farbwähler „Chroma“ (mit Hex-Anzeige) | `setConfig({ chromaColor })` | E | `views/OperatorView.tsx:750` | |
| 58 | Einstellungen › Ausgabe (2. Bildschirm) | Knopf „Reset“ (Tooltip „Standard-Green (#00B140) zurücksetzen“) | `setConfig({ chromaColor: '#00B140' })` | E | `views/OperatorView.tsx:751-757` | |
| 59 | Einstellungen › Ausgabe (2. Bildschirm) | Knopf „2. Bildschirm einschalten“ / „2. Bildschirm ausschalten“ | `setConfig({ secondScreenEnabled })` → Main öffnet/schließt/versetzt das Ausgabefenster (`reconcileOutputWindow`, `main/index.ts:611-627`, aufgerufen `:662`) | E | `views/OperatorView.tsx:759-767` | |
| 60 | Einstellungen › Ausgabe (2. Bildschirm) | Text „Tipp: Zweitmonitor wählen, damit die Ausgabe nicht die Operator-Oberfläche verdeckt.“ | – | E | `views/OperatorView.tsx:768-770` | |

## 2 · Dialoge und Meldungen

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
| 61 | Import-Dialog (Modal, `z-50`) | Dialog „Bauchbinde importieren“; Kopf „⟨B⟩×⟨H⟩ · ⟨n⟩ Textfeld(er)“ | geöffnet, wenn `importParsed` gesetzt ist (Nr. 21, 22) | nach erfolgreichem Parsen einer .psd/.jmtitler | `views/OperatorView.tsx:778-787`, `views/ImportDialog.tsx:68-153`, Kopf `:74-78` | |
| 62 | Import-Dialog | Klick auf den abgedunkelten Hintergrund | `onCancel` → `setImportParsed(null)`; Klick im Dialog: `stopPropagation` (`:72`). **Auch während des Speicherns aktiv**; das Speichern läuft dann weiter und wählt die Vorlage danach (`onSaved`, abgeleitet) | Dialog offen | `views/ImportDialog.tsx:69` | |
| 63 | Import-Dialog | Knopf „✕“ (Tooltip „Abbrechen“) | `onCancel`; während des Speicherns **nicht** gesperrt | Dialog offen | `views/ImportDialog.tsx:79-85` | |
| 64 | Import-Dialog | Live-Vorschau (Canvas in Vorlagengröße, Platzhalter wörtlich) | `drawCg` im Effekt bei Änderung von Name/Slot-Texten | Dialog offen | `views/ImportDialog.tsx:89-96`, Effekt `:37-44` | |
| 65 | Import-Dialog | Feld „Name der Vorlage“ | `setName` (lokal) | Dialog offen | `views/ImportDialog.tsx:98-105` | |
| 66 | Import-Dialog | Überschrift „Textfelder → Variablen“, Erklärtext „Platzhalter wie {{name}} werden später aus DataLink gefüllt. Feste Texte bleiben stehen.“, je Slot ein Feld (Label + Schlüssel), vorbelegt aus Auto-Mapping (`{{name}}`, `{{subtitle}}`, `{{location}}`, `lib/psd-import.ts:25-36`); bzw. Text „Keine Textebenen gefunden — die Vorlage wird als reines Standbild importiert.“ | `setOverrides` (lokal) | Dialog offen; Text bei 0 Slots | `views/ImportDialog.tsx:107-135` | |
| 67 | Import-Dialog | Knopf „Abbrechen“ | `onCancel` | Dialog offen; gesperrt während des Speicherns | `views/ImportDialog.tsx:139-141` | |
| 68 | Import-Dialog | Knopf „In Library speichern“ / „Speichere…“ | `save` (`:46-66`): PNG + Vorschaubild kodieren, `tpl.add` (IPC `titler:tpl-add`, `main/library.ts:73-91`), dann `onSaved` → Dialog zu + `selectTemplate` (Nr. 23). `try/finally` **ohne catch**: Fehler werden nicht angezeigt, der Dialog bleibt offen | Dialog offen; gesperrt während des Speicherns | `views/ImportDialog.tsx:142-149` | |
| 69 | Nativer Dialog (Main) | „DataLink-Ordner wählen“ (Ordner, Startpfad = eingetragener Ordner) | ausgelöst von Nr. 44 über `titler:pickDataFolder` | kommt bei Quelle master nicht (R2) | `main/index.ts:665-673` | |
| 70 | Nativer Dialog (Main) | „Bauchbinde importieren“ (Datei; Filter „Titler-Import“ psd/jmtitler, „Photoshop“, „JM Titler-Vorlage“, „Alle Dateien“) | ausgelöst von Nr. 22 über `titler:pickImportFile` | immer | `main/index.ts:689-702` | |
| 71 | Meldung `window.alert` | „Import fehlgeschlagen: ⟨Fehler⟩“ (z. B. „Nicht unterstütztes Format — bitte .psd oder .jmtitler wählen.“, `lib/psd-import.ts:189`; „Ungültiges .jmtitler-Bündel …“, `:160`) | `runImport`-catch | nach Nr. 21/22 bei Parse-Fehler | `views/OperatorView.tsx:71-78` | |
| 72 | Meldung `window.alert` | „Show-Vorlage konnte nicht importiert werden: ⟨Fehler⟩“ | catch im Show-Vorlagen-Import (Nr. 79) | nach Show-Deep-Link mit Vorlage | `views/OperatorView.tsx:119-122` | |

Nicht vorhanden (grep über `apps/titler/src`): kein `confirm(`, kein `prompt(`, kein Kontextmenü
(`contextmenu`/`onContextMenu`), kein Doppelklick-Handler, außer Nr. 21 kein Drag-Handler.

## 3 · Abläufe ohne eigenes Bedienelement (im Renderer)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
| 73 | Fernsteuerung (Companion, Port 8726) | Befehle `take`, `clear`, `toggle` | `remote.onCommand` (IPC `titler:remote-cmd`, gesendet `main/control-server.ts:127-128`) → `take()` / `clear()` / je nach `liveRef` | Hauptfenster geladen | `views/OperatorView.tsx:146-158` | |
| 74 | Fernsteuerung | Befehl `template ⟨kind⟩` | `setConfig({ template })` | wie Nr. 73 | `views/OperatorView.tsx:159-161` | |
| 75 | Fernsteuerung | Befehl `text ⟨name⟩ ⟨untertitel⟩` (`_` = Leerzeichen, `-` = leer, `main/control-server.ts:36-39`) | bei Vorlage Grafik mit gefundener Vorlage auf Slot 1/2, sonst `name`/`subtitle` | wie Nr. 73 | `views/OperatorView.tsx:162-179` | |
| 76 | Fernsteuerung | Befehl `graphic ⟨id/nr/name⟩` | Suche ID → Nr. → Name → Teilname, dann wie Nr. 23; ohne Treffer nichts | wie Nr. 73 | `views/OperatorView.tsx:180-191` | |
| 77 | Fernsteuerung | Befehl `slot ⟨key⟩ ⟨text⟩` | `slotText[key] = text` | wie Nr. 73 | `views/OperatorView.tsx:192-197` | |
| 78 | Fernsteuerung (im Main, zur Abgrenzung) | Befehle `recall ⟨ref⟩`, `next`, `prev`, `reload` | im Main erledigt, kein Renderer-Push (`main/index.ts:786-804`); R2: `reload` im Verbundmodus ignoriert (`main/index.ts:329-334`); ohne verbundene Show nur Log-Warnung (`:335-343`) | Steuerserver läuft | `main/control-server.ts:92-101` | |
| 79 | Show-Integration (C3) | Bauchbinden-Vorlage aus einer .jmshow automatisch importieren und als aktive Grafik vorbereiten (nicht on air) | `onFileOpened` (IPC `titler:file-opened`, `main/index.ts:445-453`) → `importFileToTemplate` → `tpl.add` → `setConfig({ template: 'graphic', activeGraphicId, slotText: {} })`; R2: im Verbundmodus liefert ein Show-Deep-Link nur noch diese Vorlage (`main/index.ts:317-322`); Lesefehler der Show nur im Log (`:429`, `:441`) | nach Show-Deep-Link | `views/OperatorView.tsx:99-124` | |
| 80 | Tally / On-Air | Live-Zustand an Main melden | Effekt → `remote.reportState({ onAir, template, ndiActive, connections })` (IPC `titler:report-state`; Main: Companion-STATE `on_air`, `setzeAufSendung`, On-Air an Ausgabefenster, `main/index.ts:719-725`) | bei jeder Änderung | `views/OperatorView.tsx:202-205` | |
| 81 | Monitore | Monitorliste laden und bei Hot-Plug neu laden | `listDisplays()`, `onDisplaysChanged` (IPC `titler:displays-changed`, `main/index.ts:764-772`) | Hauptfenster | `views/OperatorView.tsx:212-218` | |
| 82 | Store (alle Fenster) | Erstladen und Abos | `load` (`store/titler.ts:29-49`): `onStatus` (`titler:status`), `onConfig` (`titler:config`), `onOnAir` (`titler:onair`), `onTplChanged` → `tpl.list` (`titler:tpl-changed`, `titler:tpl-list`), dann `getState` + `tpl.list`; aufgerufen in `App.tsx:8-11` | jedes Fenster | `store/titler.ts:29-49` | |
| 83 | Engine | Frame-Port für NDI empfangen; Vorlagen-Hintergrund nachladen; Cache bei Library-Änderung verwerfen; NDI-Frames auf `fps` gedrosselt senden; Fehler eines Takts werden verschluckt | `window` `message` `jmtitler:frame-port` (`lib/engine.ts:62-71`, Preload `preload/index.ts:20-22`); `tpl.readBg` (IPC `titler:tpl-read-bg`, `:115-141`); `onTplChanged` (`:74-80`); `port.postMessage` (`:155-171`); `try/catch` je Takt (`:176-182`) | Hauptfenster (NDI nur mit Port) und Ausgabefenster (ohne NDI) | `lib/engine.ts:25-189` | |
| 84 | Ansichtswahl | `?view=recall` → Recall-Board, `?view=output` → Ausgabe, sonst Operator | URL-Parameter | Fensterstart | `App.tsx:15-18` | |

## 4 · Recall-Board (`?view=recall`, eigenes Fenster „JM Titler · Recall-Board“, bleibt ohne AppShell)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
| 85 | Board › Kopf | Logo, „RECALL-BOARD“, „⟨n⟩ Einträge“ | – | immer (auch vor dem Laden, dann „0 Einträge“) | `views/RecallBoard.tsx:31-36` | |
| 86 | Board › Kopf | Suchfeld „Suchen…“ (filtert nach Label, nur im Fenster, nicht gemerkt, kein Löschknopf) | `setQ` (lokal) | immer | `views/RecallBoard.tsx:37-43` | |
| 87 | Board | Hinweisband (nur H1, H5, H6, `role="status"`) | – (`boardHinweis`, `lib/datalink-anzeige.ts:25-28`) | Hinweis H1/H5/H6 gesetzt | `views/RecallBoard.tsx:46-53` | |
| 88 | Board | Karte B1 „Auf Sendung, nicht in der Liste: ⟨Label⟩“ | – (`b1Text`, `lib/datalink-anzeige.ts:31-33`, aus `status.gehalten`) | gehaltener Eintrag | `views/RecallBoard.tsx:55-61` | |
| 89 | Board | Text „Keine Einträge. Wähle im Operator-Fenster einen DataLink-Ordner (oder öffne eine iveo-Show mit Speakern).“ | – | 0 Einträge; auch solange `state` noch nicht geladen ist (kein Ladezustand) | `views/RecallBoard.tsx:63-66` | |
| 90 | Board | Knopf je Eintrag (Raster, aktiver gefüllt, Tooltip Label) | `recallSchluessel(key)` (IPC `titler:recallSchluessel`) | ≥ 1 Eintrag (gefiltert) | `views/RecallBoard.tsx:70-85` | |
| 91 | Board | Text „Kein Eintrag passt zu „⟨q⟩“.“ | – | Suche ohne Treffer | `views/RecallBoard.tsx:87-91` | |

## 5 · Ausgabefenster (`?view=output`, „JM Titler · Ausgabe“, nur Abgrenzung, bleibt unverändert, Spec 5.3)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
| 92 | Ausgabe | Vollbild-Canvas in Programmauflösung auf Chroma-Farbe, Mauszeiger aus; keine Bedienelemente | `useTitlerEngine(resolved, false, canvasRef, { bg: chromaColor, graphic })`; On-Air-Push `onAir` → `take()`/`clear()` | `secondScreenEnabled`; Fenster rahmenlos, Vollbild (`main/index.ts:561-605`) | `views/OutputView.tsx:19-57` | |

## 6 · Tastatur (Pflichtpunkt Spec 10)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
| 93 | Tastenkürzel | **Keine eigenen.** Kein `keydown`/`keyup`/`keypress`/`onKey…`/`KeyboardEvent`/`accelerator` in `apps/titler/src` (grep); keine in den genutzten `@jm/ui`-Bausteinen (`Button`, `Tabs`, `Collapsible`, `SettingsSection`, `Logo`, grep). **Aktiv ist aber das Electron-Standardmenü** (Nr. 97; Kürzel abgeleitet aus den Menü-Rollen von Electron, nicht gemessen): Strg+R und Strg+Umschalt+R (neu laden), Strg+Umschalt+I (Entwicklerwerkzeuge), Strg+0, Strg+Plus und Strg+Minus (Zoom), F11 (Vollbild), Strg+M (minimieren), Strg+W (Fenster schließen), Alt (Menüleiste); dazu die Bearbeiten-Kürzel Strg+Z, Strg+Y, Strg+X, Strg+C, Strg+V und Strg+A | Rollen des Electron-Standardmenüs | alle drei Fenster | – | |
| 94 | Tastatur nativ | Tab-Fokus; Leertaste/Enter lösen den fokussierten Knopf aus (Browser-Standard); Pfeiltasten in Auswahl und Schieber. Reiter ohne Pfeiltasten-Wechsel (`ui/Tabs.tsx` ohne Tastenhandler). Vorlagen-Kacheln (Nr. 23) nicht erreichbar, „✕“ (Nr. 24) erreichbar, aber unsichtbar | Browser | überall | – | |
| 95 | Tastatur im Import-Dialog | **Escape schließt den Import-Dialog nicht** (kein Handler); kein Fokusfang | – | Dialog offen | `views/ImportDialog.tsx` (kein Handler) | |
| 96 | Pflichtpunkt Panel | Leertaste/Escape mit Fokus im Panel. **Heute:** kein Panel (Einstellungen sind ein Reiter); ein Feld behält die Taste (Browser); auf Knopf/Schalter wirkt die Taste nativ; Escape hat keine Wirkung (kein Handler im Titler). **Mit `SettingsPanel` (abgeleitet aus `ui/SettingsPanel.tsx:31-62`, nicht gemessen):** Feld (Text, Zahl, Bereich, Auswahl) behält jede Taste; auf Knopf/Schalter geht die Leertaste weiter ans Tool, der Titler hat keinen Tastenhandler, also löst der Knopf/Schalter nativ aus; Escape schließt das Panel (nur wenn nicht `defaultPrevented`) und erreicht den Titler nicht | – | – | Reiter „Einstellungen“ (`views/OperatorView.tsx:607-773`) | |
| 97 | Menü / globale Kürzel | Kein `Menu`/`setApplicationMenu`/`globalShortcut`/`before-input-event` in `apps/titler/src`, `packages/app-runtime/src`, `packages/ui/src` (grep); alle drei Fenster mit `autoHideMenuBar: true` (die Leiste erscheint erst nach Alt). Setzt eine App kein Menü, legt Electron das Standardmenü an (`node_modules/electron/electron.d.ts:8673`, Electron 33.4.11: „The default menu will be created automatically if the app does not set one“); seine Kürzel stehen unter Nr. 93. Wirkung im Titler **aus dem Code abgeleitet, gemessen wird sie in Abnahme 5c** (auf einer Testquelle ohne echte Sendung): Strg+R im Bedienfenster lädt den Renderer neu, `live` beginnt wieder mit `false`, `reportState` meldet „nicht auf Sendung“, das Ausgabefenster blendet aus und das Halten im DataLink endet (`main/index.ts:719-724`) | – | – | `main/index.ts:484`, `:533`, `:577` | |

## 7 · Gemerkte Zustände (localStorage, sonstige Ablage)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
| 98 | localStorage | `titler.operator.tab` (`steuerung`/`einstellungen`): lesen beim Start **ohne try/catch** (`:224`), schreiben bei Wechsel mit try/catch (`:228-232`) | `useState`-Initialisierer + Effekt | Hauptfenster | `views/OperatorView.tsx:222-233` | |
| 99 | localStorage | `jm.collapsible.titler.graphics` (`1`/`0`) | `Collapsible persistId="titler.graphics"` (lesen/schreiben mit try/catch) | Hauptfenster | `views/OperatorView.tsx:394`, `ui/Collapsible.tsx:26-34,57-64` | |
| 100 | localStorage | `jm.collapsible.titler.recall` | `persistId="titler.recall"` | Hauptfenster | `views/OperatorView.tsx:457` | |
| 101 | localStorage | `jm.collapsible.titler.style` | `persistId="titler.style"` | Hauptfenster | `views/OperatorView.tsx:582` | |
| 102 | sonst | Kein `sessionStorage`, kein IndexedDB im Renderer (grep). Recall-Board-Suche nicht gemerkt. Hell/Dunkel: **fest dunkel** (`<html class="dark">`), kein Umschalter, nichts gemerkt | – | – | `renderer/index.html:2` | |
| 103 | Main-Ablage (zur Einordnung) | `<userData>/titler-config.json` (alle `setConfig`-Felder, Nr. 11–17, 39–59); Vorlagen-Library `<userData>/templates` (`index.json`, `<id>.png`, `<id>.thumb.png`); gemerkte Show `<userData>/show-zuletzt.json`; Speaker `<userData>/iveo-data/speakers.tsv`; R2: `<userData>/verbund/master-stand.json` (app-runtime) | – | – | `main/config.ts:7-9`, `main/library.ts:21-32`, `main/show-quelle.ts:21`, `main/iveo-show.ts:23-25`, `app-runtime/verbund-speicher.ts:26-29` | |

## 8 · IPC-Übersicht `window.jmtitler` (Preload `preload/index.ts`)

| Methode | Kanal | Aufrufer im Renderer | R2 |
|---|---|---|---|
| `getState` | `titler:getState` | `store/titler.ts:47` | |
| `setConfig` | `titler:setConfig` | `store/titler.ts:51` (alle `setConfig`-Aufrufe der Ansichten) | Main-Seite geändert (E22, `main/index.ts:649-664`) |
| `pickDataFolder` | `titler:pickDataFolder` | `views/OperatorView.tsx:208` | Main-Seite geändert (E22, `main/index.ts:666`) |
| `recallEntry` | `titler:recall` | **im Renderer ungenutzt** | |
| `recallSchluessel` | `titler:recallSchluessel` | `views/OperatorView.tsx:524`, `views/RecallBoard.tsx:73` | |
| `stepEntry` | `titler:stepEntry` | `views/OperatorView.tsx:503`, `:513` | |
| `zurueckZumEigenenOrdner` | `titler:zurueckZumOrdner` | `views/OperatorView.tsx:648` | Main-Seite geändert (E22, `main/index.ts:682-684`) |
| `openRecall` | `titler:openRecall` | `views/OperatorView.tsx:493` | |
| `listDisplays` / `onDisplaysChanged` | `titler:listDisplays` / `titler:displays-changed` | `views/OperatorView.tsx:215`, `:217` | |
| `onStatus` / `onConfig` / `onOnAir` | `titler:status` / `titler:config` / `titler:onair` | `store/titler.ts:32`, `:38`, `:43` | |
| `ndi.start` / `ndi.stop` | `titler:ndi-start` / `titler:ndi-stop` | `store/titler.ts:55`, `:60` | |
| `ndi.status` | `titler:ndi-status` | **im Renderer ungenutzt** | |
| `remote.onCommand` / `remote.reportState` | `titler:remote-cmd` / `titler:report-state` | `views/OperatorView.tsx:147`, `:204` | |
| `tpl.list` / `tpl.add` / `tpl.remove` / `tpl.readBg` | `titler:tpl-list` / `-add` / `-remove` / `-read-bg` | `store/titler.ts:45`, `:47`; `views/ImportDialog.tsx:54`, `views/OperatorView.tsx:110`; `views/OperatorView.tsx:95`; `lib/engine.ts:123-124` | |
| `onTplChanged` | `titler:tpl-changed` | `store/titler.ts:45`, `lib/engine.ts:75` | |
| `onFileOpened` | `titler:file-opened` | `views/OperatorView.tsx:103` | |
| `pickImportFile` / `readFile` / `pathForFile` | `titler:pickImportFile` / `titler:readFile` / `webUtils.getPathForFile` | `views/OperatorView.tsx:80`, `:90`, `:89` | |
| `verbundAnzeige` / `onVerbundAnzeige` | `jmps:verbund-anzeige` (invoke + Ereignis, Handler in `@jm/app-runtime`) | `views/OperatorView.tsx:896`, `:897` | **R2 neu** |
| `platform` | – | **im Renderer ungenutzt** | |
| (Frame-Port) | `jmtitler:frame-port` per `window.postMessage` | `lib/engine.ts:62-71` | |

## 9 · Einstellungen nach Spec 6 / Anhang A (Zuordnung der Ist-Elemente)

| Abschnitt (Anhang A) | Ist-Elemente | Bemerkung (belegt) |
|---|---|---|
| NDI-Ausgabe | Nr. 50 Quellname, 51 Auflösung, 52 fps, 53 Start/Stopp, 54 Warnung | Start/Stopp liegt heute im Reiter „Einstellungen“; Hinweiszeile Nr. 9 verweist mit „NDI rechts starten“ dorthin |
| Ausgabe auf Bildschirm | Nr. 55 Beschreibung, 56 Monitor, 57 Chroma, 58 Reset, 59 an/aus, 60 Tipp | |
| Fernsteuerung | heute **keine UI**; nur Pill Nr. 4 | Port 8726 fest (`main/control-server.ts:27`); Port steht nicht in `TitlerStatus` (`shared/types.ts:154-180`); Startfehler und mDNS-Fehler nur im Log (`main/index.ts:806-810`, `main/control-server.ts:132-133`) |
| iveo | Nr. 49 | R2: „aktiv“ auch bei Quelle master; Text bleibt „aus der geöffneten JM Show … (verwaltet vom Launcher)“ |
| DataLink | Nr. 42–48; Anzeige Nr. 27–37 liegt in „Daten / Recall“ (Bedienung) | R2: Sperre bei Quelle master (Nr. 43–46) |
| Tool-eigen: Stil | Nr. 38–41 | |
| Tool-eigen: Grafik-Vorlagen-Import | Nr. 20–25, Dialog Nr. 61–68, 70, 71 | Nr. 79 (Show-Vorlage) importiert ohne Dialog |
| Bedienung (keine Einstellung) | Vorlage Nr. 11, Inhalt Nr. 12–19, Recall Nr. 31–35 | Ticker-Tempo (Nr. 16) liegt heute unter „Inhalt“ |

## 10 · Befunde für den Umbau (belegt, ohne Wertung als Fehler)

1. **Recall-Board und Operator zeigen nicht dieselben Hinweise:** Operator zeigt H1–H7 (Nr. 28), aber keine Karte B1;
   das Board zeigt nur H1/H5/H6 (Nr. 87) und B1 (Nr. 88). Anhang A sagt „Das Recall-Board zeigt dieselben Hinweise“.
2. **NDI-Pill nicht gemessen (Spec 7 „nur Gemessenes“):** `status.ndiActive` wird direkt nach dem Fork gesetzt
   (`main/index.ts:635`), ohne Rückmeldung des Senders; scheitert `ndi.init`/`createSender`, steht nur `console.error` im
   Utility-Prozess (`utility/ndi-sender.ts:28-31`), die Pill zeigt dann „NDI · 0 Empfänger“. Die Empfängerzahl kommt nur
   alle 30 gesendeten Frames (`:41-44`). Ein Ende des Utility-Prozesses meldet niemand: `sender-process.ts` hört nur auf
   `message` (`main/ndi/sender-process.ts:26-31`). `ndi.status` (`senderActive`) nutzt der Renderer nicht.
3. **Suite-Pill:** „Suite getrennt“ steht bei 0 Clients und ebenso, wenn der Steuerserver nicht startet (nur Log,
   `main/index.ts:806-810`); unbekannt und getrennt sind nicht unterscheidbar (Spec 7: unbekannt ≠ ok).
4. **Take/Clear haben keinen gesperrten Zustand** und `live` springt beim Klick sofort um (`lib/engine.ts:56`), nicht
   erst nach der Einblendung (450 ms, `:15`).
5. **DataLink-Textfeld schreibt je Tastendruck**; jeder Tastendruck ist im Main eine Ordnerwahl (`main/index.ts:659`,
   löscht die gemerkte Show, `shared/datenquelle.ts:179-188`).
6. **Vorlage löschen ohne Rückfrage**, „✕“ nur bei Mauszeiger sichtbar (Nr. 24); Kacheln selbst per Tastatur nicht
   wählbar (Nr. 23, `div` mit `onClick`).
7. **Import-Dialog:** kein Escape (Nr. 95); Speicherfehler ohne Anzeige (Nr. 68); Hintergrund und „✕“ während des
   Speicherns aktiv (Nr. 62, 63); Lesefehler bei „Datei importieren…“ und beim Ablegen ohne Anzeige (Nr. 21, 22).
8. **„Im Text verwendet“** wertet `slotText` nicht aus und vergleicht ohne NFC (`views/OperatorView.tsx:128-132`,
   `:570-572`), die Auflösung dagegen mit NFC (`shared/vars.ts:14-16`, Titler 0.10.1). Ein zerlegt geschriebener
   Umlaut im Platzhalter würde rot angezeigt, aber aufgelöst (abgeleitet, nicht gemessen).
9. **ASCII-Anführungszeichen in Nutzertexten:** `views/OperatorView.tsx:386` (nach „Grafik-Vorlagen) und
   `views/RecallBoard.tsx:89` (nach „{q}) schließen mit einem ASCII-Zeichen. In dieser Liste sind sie als „ “
   wiedergegeben.
10. **Hell/Dunkel:** fest dunkel (`renderer/index.html:2`), kein Umschalter (Spec 8 bringt das neu). `globals.css`
    wiederholt den Inhalt von `@jm/ui/base.css` und hat rohe Farben nur im Schachbrett `.cg-checker`
    (`globals.css:53-62`); `ImportDialog` nutzt `bg-black/60` (`:69`).
11. **Ungenutzte Preload-Methoden:** `recallEntry`, `ndi.status`, `platform`.
12. **Kein Ablageschutz außerhalb der Ablagefläche:** Drop-Handler nur auf der Fläche (Nr. 21), kein `will-navigate`
    im Titler-Main und in app-runtime (grep). Was ein Drop anderswo bewirkt, ist **nicht gemessen**.
13. **Brücke aus Spec 3.9 (nur Ist):** `jmps:verbund-anzeige` liefert Abfrage + Ereignis an alle Fenster
    (`app-runtime/verbund-ipc.ts:12-33`). Registriert wird sie in jedem Tool mit Master-Link-Client (Standard an,
    `app-runtime/index.ts:627`, `:643-650`), nach `whenReady` und nur mit Single-Instance-Lock
    (`app-runtime/index.ts:387-409` → `verbund.ts:25-44`, `:36`). Geliefert wird die fertige V-Zeile `{ text, farbe }`
    oder `null` am Einzelplatz (`verbund-anzeige.ts:25`). Den rohen Client-Zustand (`aus/sucht/verbindet/verbunden/
    fehler`) gibt es nur im Main (`getMasterLinkStatus()`, `app-runtime/index.ts:414-416`); im Verbund steckt er in
    V9–V11 (`verbund-anzeige.ts:65-67`). Den Kanal nutzen schon drei Preloads: titler, timer, rundown (grep). Für die
    Fernsteuerungs-Meldung hat der Titler `status.suiteClients` (`shared/types.ts:159-160`), aber weder Port noch
    Startergebnis im Status.
14. **Anhang A nennt** `status.datenQuelle.art === 'show'` für iveo; seit R2 gilt „show oder master“ (`:243`).
15. **iveo-Kasten (Nr. 49) bei Quelle master und früher:** bei master steht „aus der geöffneten JM Show … (verwaltet
    vom Launcher)“, die Speaker kommen aber vom Master; bei Quelle früher steht „Kein iveo-Event aktiv“, obwohl die Liste
    Speaker aus einer früheren Show trägt (Q3, Nr. 27). Bei H4/H7 steht „Aktualisiert sich live“. Für eine immer
    sichtbare Statuszeile wäre das je Zustand zu prüfen (Kreuzprodukt).
16. **Texte mit Ortsangaben**, die nach dem Umbau nicht mehr stimmen könnten: Nr. 9 („NDI rechts starten“), Nr. 19
    („unter „Grafik-Vorlagen““), Nr. 29 („Im Reiter Einstellungen › DataLink“), Nr. 42 („im Reiter Steuerung
    abrufbar“), Nr. 49 („Abruf im Reiter Steuerung › Daten / Recall“), Nr. 89 („Wähle im Operator-Fenster …“).
17. **Diagnosen nur im Log** (Spec 7, „jede Diagnose wird angezeigt“): nicht lesbare Datendatei und Nicht-UTF-8-Kodierung
    (`main/datalink.ts:200-212`), Steuerserver-Start (`main/index.ts:806-810`), mDNS (`main/control-server.ts:132-133`),
    NDI-Init (`utility/ndi-sender.ts:28-31`), Show-Vorlage nicht lesbar (`main/index.ts:429`, `:441`), RELOAD ohne Show
    (`:341`), RELOAD/Deep-Link im Verbund ignoriert (`:319`, `:332`), Ordnerwahl abgelehnt (`:363`).
18. **Ladezustände:** Operator bleibt bei scheiterndem `getState` auf „Lädt…“ (Nr. 1, kein `catch`); das Recall-Board
    hat keinen Ladezustand und zeigt vor dem Laden „0 Einträge“ und „Keine Einträge …“ (Nr. 85, 89).
19. **Maße und Fenster:** Hauptfenster 1180×820, mindestens 960×660 (`main/index.ts:475-478`); Steuerpult fest 400 px
    (`views/OperatorView.tsx:318`). Auf macOS `titleBarStyle: 'hiddenInset'` (`main/index.ts:483`), die Kopfzeile hat
    keine Ziehfläche (kein `dragRegion`/`app-region` in `apps/titler/src`, grep). `body` hat `user-select: none`
    (`globals.css:31`): Hinweistexte sind nicht markierbar.
````

- [ ] **Step 3: Prüfung (grün)**

```
node -e '
const roh = require("fs").readFileSync(process.argv[1], "utf8");
const KOPF = "| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |";
const fehler = []; const zeilen = []; const je = {}; const koepfe = [];
let abschnitt = "-"; let tabelle = false;
roh.split("\n").forEach((l, i) => {
  const a = /^## (\d+) · /.exec(l); if (a) { abschnitt = a[1]; koepfe.push(Number(a[1])); }
  if (l === KOPF) { tabelle = true; return; }
  if (!l.startsWith("|")) { tabelle = false; return; }
  if (!tabelle || /^\|[-|]+\|$/.test(l)) return;
  const z = l.split("|").slice(1, -1).map((s) => s.trim());
  if (z.length !== 7) fehler.push(`Zeile ${i + 1}: ${z.length} Spalten`);
  else if (z[6] !== "") fehler.push(`Zeile ${i + 1}: künftig wo nicht leer`);
  zeilen.push(z); je[abschnitt] = (je[abschnitt] ?? 0) + 1;
});
if (zeilen.some((z, k) => Number(z[0]) !== k + 1)) fehler.push("Nummern nicht fortlaufend 1–" + zeilen.length);
if (JSON.stringify(je) !== JSON.stringify({ 1: 60, 2: 12, 3: 12, 4: 7, 5: 1, 6: 5, 7: 6 })) fehler.push("Zeilen je Abschnitt weichen ab");
if (JSON.stringify(koepfe) !== "[1,2,3,4,5,6,7,8,9,10]") fehler.push("Abschnittsköpfe: " + JSON.stringify(koepfe));
const p93 = zeilen[92] ?? []; const p96 = zeilen[95] ?? [];
if (!(p93[1] === "Tastenkürzel" && String(p93[2]).startsWith("**Keine eigenen.**") && String(p93[2]).includes("Standardmenü"))) fehler.push("Pflichtzeile Nr. 93 (Kürzel: keine eigenen, Electron-Standardmenü) fehlt");
if (!(p96[1] === "Pflichtpunkt Panel" && String(p96[2]).includes("Leertaste") && String(p96[2]).includes("Escape"))) fehler.push("Pflichtzeile Nr. 96 (Panel: Leertaste und Escape) fehlt");
const ascii = roh.split("\n").filter((l) => l.replace(/`[^`]*`/g, "").includes(String.fromCharCode(34))).length;
if (ascii) fehler.push(`${ascii} Zeilen mit ASCII-Anführungszeichen außerhalb von Code`);
if (roh.includes("\r")) fehler.push("CRLF statt LF");
console.log("Zeilen je Abschnitt:", JSON.stringify(je), "· Punkte:", zeilen.length, "· Köpfe:", koepfe.length);
console.log(fehler.length ? fehler.join("\n") : "Funktionsliste in Ordnung");
process.exitCode = fehler.length ? 1 : 0;
' docs/ux/funktionslisten/titler.md; echo "Exit=$?"
```
Erwartet (gemessen):
```
Zeilen je Abschnitt: {"1":60,"2":12,"3":12,"4":7,"5":1,"6":5,"7":6} · Punkte: 103 · Köpfe: 10
Funktionsliste in Ordnung
Exit=0
```
Die Prüfung zählt nur Zeilen in Tabellen mit genau dem Kopf `| Nr. | … | künftig wo |`; die Tabellen der Abschnitte 8 und 9
haben andere Köpfe und bleiben außen vor. Die Zelltrennung an `|` setzt voraus, dass keine Zelle ein `|` enthält; eine
solche Zelle zeigt die Prüfung als falsche Spaltenzahl. Dauerhaft prüft die Struktur ab C13 der Test
`apps/titler/test/ui/funktionsliste.test.ts` (Block D).

- [ ] **Step 4: Gegenprobe (nicht committen)**

Je eine Änderung in `docs/ux/funktionslisten/titler.md` (Edit-Werkzeug), Prüfung aus Step 3, zurückbauen:

| Änderung | erwartete Meldung (gemessen), `Exit=1` |
| --- | --- |
| In Nr. 12 (Dateizeile 46) am Zeilenende die leere Zelle samt Trenner löschen (`` `views/OperatorView.tsx:348` \| \| `` → `` `views/OperatorView.tsx:348` \| ``) | `Zeile 46: 6 Spalten` |
| In Nr. 13 (Dateizeile 47) die leere letzte Zelle durch ` x ` füllen | `Zeile 47: künftig wo nicht leer` |
| In Nr. 13 „Untertitel“ in ASCII-Anführungszeichen setzen | `1 Zeilen mit ASCII-Anführungszeichen außerhalb von Code` |
| In Nr. 96 (Dateizeile 158) jedes „Escape“ durch „Esc“ ersetzen | `Pflichtzeile Nr. 96 (Panel: Leertaste und Escape) fehlt` |
| In Nr. 93 (Dateizeile 155) „**Aktiv ist aber das Electron-Standardmenü**“ durch „**Aktiv ist aber das Electron-Menü**“ ersetzen | `Pflichtzeile Nr. 93 (Kürzel: keine eigenen, Electron-Standardmenü) fehlt` |

Danach wieder `Funktionsliste in Ordnung`, `Exit=0`.

- [ ] **Step 5: Zeilenenden**

```
node -e "for (const f of process.argv.slice(1)) { const t = require('fs').readFileSync(f, 'utf8'); console.log(f, (t.match(/\n/g) || []).length, (t.match(/\r\n/g) || []).length); }" docs/ux/funktionslisten/titler.md
```
Erwartet (gemessen): `docs/ux/funktionslisten/titler.md 267 0`.

- [ ] **Step 6: Commit** (Commit-Text ASCII)

```
git add docs/ux/funktionslisten/titler.md
git status --short
```
Erwartet (fremde Zeilen mit `??` bleiben ungestaged):
```
A  docs/ux/funktionslisten/titler.md
```
Dann:
```
git commit -m "docs(ux): Funktionsliste JM Titler vor dem Umbau (Spec 10)" -m "103 Punkte aus dem Code (main 5e5b234ec3, Titler 0.11.0): Hauptfenster, Dialoge und Meldungen, Ablaeufe ohne Bedienelement, Recall-Board, Ausgabefenster, Tastatur mit den Pflichtpunkten Kuerzel (keine eigenen, dazu das Electron-Standardmenue) und Panel-Tasten (Leertaste, Escape, Owner-Entscheid O1), gemerkte Zustaende; dazu IPC-Uebersicht, Zuordnung zu Spec 6 und 19 Befunde. Spalte kuenftig wo bleibt leer bis zum Abhaken nach dem Umbau. Reine Doku, die CI laeuft dafuer nicht (paths-ignore)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- **Pflichtzeilen in der Prüfung:** Step 3 prüft zusätzlich, dass Nr. 93 „**Keine eigenen.**“ mit dem
  Electron-Standardmenü (Kürzel) und Nr. 96 (Leertaste und Escape in einer Zeile) dastehen, und dass die Abschnittsköpfe
  `## 1 · ` bis `## 10 · ` vollständig sind.
- **Electron-Standardmenü in Nr. 93 und 97 (Nachbesserung, Prüfbefund funktionsliste:1):** Der Titler setzt kein Menü, also
  legt Electron 33 sein Standardmenü an (`electron.d.ts:8673`). Dessen Kürzel sind Tastaturkürzel des Titlers im Sinne von
  Spec 10 und stehen deshalb in der Pflichtzeile; sie sind aus den Menü-Rollen abgeleitet, weil das Electron-Programm hier
  nicht installiert ist (`npm ci --ignore-scripts`) und G13 keinen Start erlaubt. Gemessen wird die Wirkung von Strg+R in
  Abnahme 5c (Nr. 97). Das Menü bleibt im Pilot; ob eine Folgeaufgabe es abschaltet, steht im Folgeplan (OF11, vom Owner
  bestätigt).
- **Kopf neu geschrieben, Abschnitte 1–10 wörtlich:** Der Kopf der Ist-Erhebung nannte die Messkopie und das Kopierwerkzeug;
  beides steht nicht in der Liste. Die Lesequellen sind geblieben, ebenso Pfadregel, R2-Kennzeichnung und Zustands-Kürzel
  (Pfadregel ergänzt um `renderer/…`, das Nr. 102 nutzt).
- **Eigener Step für die Zeilenenden** (G11), wie in den anderen Aufgaben.

---

### Task 2: C2 · Master-Link-Brücke in `@jm/app-runtime` (N1)

**Spec:** 3.9 (eine lesende Brücke in `@jm/app-runtime`, Ereignis an den Renderer und Abfrage, einmal gebaut, in jedem Tool
nutzbar), 7.2 (unbekannt ist nicht ok), UO3 (lesende Brücken freigegeben). Global Constraints G2 (Ausnahme N1), G4 (R2-Zeilen
in `index.ts` bleiben), G9, G10, G11, G12. Entscheidungen E1, E2. Review Focus 4.

**Voraussetzung:** Task 1 ist committet. `npm run selftest -w @jm/app-runtime` zeigt `50 passed, 0 failed` und
`227 passed, 0 failed`. `packages/app-runtime/src/index.ts` hat 675 Zeilen mit CRLF, `test/verbund.test.ts` 938.

**Dateien:**
- Create: `packages/app-runtime/src/master-link-meldung.ts` (rein, ohne Electron, nur `import type`)
- Create: `packages/app-runtime/src/master-link-ipc.ts` (Electron)
- Modify: `packages/app-runtime/src/index.ts` — genau vier Einfügungen, keine Zeile geändert oder gelöscht:
  (a) zwei Importzeilen direkt nach `import { verbundAnClient } from './verbund';` (`:18`), (b) Kommentar, Exportzeile und
  Leerzeile direkt vor `export interface AppRuntimeOptions {` (`:64`, also nach dem R2-Exportblock `:50-62`),
  (c) Kommentar und Registrierung als erste Anweisung in `const los = (): void => {` (`:388`), vor `try {` und damit vor
  der Lock-Prüfung `:393`, (d) `sendeMasterLinkWechsel(client);` direkt nach
  `verbundAnClient(client, { userData: app.getPath('userData'), log: info.log });` (`:402`). Zeilenangaben vor der Aufgabe.
- Modify: `packages/app-runtime/test/verbund.test.ts` (ein Block direkt vor der Zeile `// ── Abschluss`, `:936`)
- Modify: `.github/workflows/ci-checks.yml` (Name und Kommentar des app-runtime-Schritts, `:92-94`)

**Interfaces:**
- Consumes: bestehend `ClientZustand` aus `@jm/master-link` (`packages/master-link/src/client.ts:21-26`: `aus` · `sucht` ·
  `verbindet { adresse: string }` · `verbunden { adresse: string; seit: number; masterName: string; suite: string }` ·
  `fehler { code: FehlerCode; text: string; errCode?: string }`), `MasterLinkClient` (`extends EventEmitter`, `zustand()`,
  Ereignis `'zustand'`, `client.ts:268`, `:311`, `:661`); `masterLinkClient` (`index.ts:131`, genau ein Client je
  Prozess); für den Test aus R2 `VerbundFolger` (`src/verbund-daten.ts`) und `verbundAnzeige` (`src/verbund-anzeige.ts`).
- Produces (S-A1, exakt; Task 4 und Block B bauen darauf):
  ```ts
  // packages/app-runtime/src/master-link-meldung.ts  (ohne Electron; nur `import type` aus @jm/master-link; lädt auch unter strip-types)
  import type { ClientZustand } from '@jm/master-link';
  export const MASTER_LINK_KANAL = 'jmps:master-link';
  export type MasterLinkMeldung = ClientZustand | { art: 'ohne-client' };
  /** null oder Wurf von zustand() → { art: 'ohne-client' }; sonst client.zustand() unverändert (gleiches Objekt). */
  export function masterLinkMeldung(client: { zustand(): ClientZustand } | null): MasterLinkMeldung;

  // packages/app-runtime/src/master-link-ipc.ts  (Electron; nur Typprüfung + Quelltext-Wächter, kein Laufzeittest)
  import type { MasterLinkClient } from '@jm/master-link';
  /** ipcMain.handle(MASTER_LINK_KANAL, () => lies()) in try/catch; doppelt → der erste Handler bleibt. Wirft nie. */
  export function registriereMasterLinkAbfrage(lies: () => MasterLinkMeldung): void;
  /** client.on('zustand', …) → an alle Fenster; SOFORT einmal den aktuellen Stand senden; je Fenster isDestroyed + try/catch. Wirft nie. */
  export function sendeMasterLinkWechsel(client: MasterLinkClient): void;
  ```
  `src/index.ts`: `export { MASTER_LINK_KANAL, masterLinkMeldung, type MasterLinkMeldung } from './master-link-meldung';`
  Im Renderer: `ipcRenderer.invoke('jmps:master-link')` → `MasterLinkMeldung` (der Handler antwortet ab `whenReady` immer,
  auch ohne Client); jeder Zustandswechsel des Clients und einmal der Stand beim Anhängen kommen als
  `ipcRenderer.on('jmps:master-link', (_e, m) => …)` an alle Fenster.

**Verhalten (verbindlich):**
- **Ein Client, ein neuer Kanal (E1):** Die Brücke liest den vorhandenen `masterLinkClient` und hängt sich an dessen
  vorhandenes Ereignis `'zustand'`. Kein zweiter Client, kein Eingriff in `verbund*.ts` oder `@jm/master-link`. Die
  R2-Zeile `jmps:verbund-anzeige` bleibt die V-Zeile für `headerCenter`; sie deckt den Link nicht ab: Ohne Slave-Kopplung
  ist sie in jedem Client-Zustand `null` (gemessen, 54 von 72 Fällen im Test unten).
- **Meldung = Zustand unverändert**, dasselbe Objekt; ohne Client oder bei einem Wurf von `zustand()`
  `{ art: 'ohne-client' }` (Zweitinstanz ohne Lock, Wurf beim Bau des Clients). Bewusst nicht `aus`: das hieße „Rolle aus“.
  `getMasterLinkStatus()` bleibt unverändert (meldet ohne Client weiter `aus`; die Presence hängt an derselben Form, U6).
- **Registrierung (E2):** `registriereMasterLinkAbfrage(() => masterLinkMeldung(masterLinkClient));` ist die erste
  Anweisung in `los`, vor `try` und vor der Lock-Prüfung; `los` läuft im ersten `whenReady`-Rückruf (app-runtime
  registriert ihn in `initAppRuntime`, vor dem Fenster des Tools). Die Abfrage liest `masterLinkClient` bei jedem Aufruf neu
  und antwortet deshalb auch in einer Zweitinstanz und nach einem Wurf beim Bau des Clients (`ohne-client` statt
  Ablehnung). Ein zweiter `ipcMain.handle` auf denselben Kanal wirft; das fängt `try/catch` (der erste Handler bleibt). Ob
  `ipcMain.handle` vor `whenReady` greifen würde, ist ohne Electron nicht messbar; deshalb steht die Registrierung in
  `whenReady` (Abnahme-Punkt in C14: Statuseintrag „Master“ zeigt nach dem Start nicht „unbekannt“).
- **Senden beim Anhängen (E2):** `sendeMasterLinkWechsel(client)` steht direkt nach `verbundAnClient(client, …)`. Es hängt
  einen Zuhörer an `'zustand'` und sendet sofort einmal den aktuellen Stand an alle Fenster. Grund (gemessen in der
  Ist-Erhebung, echter `MasterLinkClient` ohne `master-link.json`): Am Einzelplatz kommt nie ein `zustand`-Ereignis
  (Startwert `aus`, `setze` verschluckt Gleiches). Der Zuhörer wirft nie: try/catch je Fenster, denn ein werfender
  Zuhörer bräche die späteren Zuhörer desselben `emit` ab. Weil der Renderer erst abonniert und dann abfragt (E5, Block B),
  ist die Brücke von der Reihenfolge der `whenReady`-Rückrufe unabhängig.
- **R2 bleibt:** `verbundAnClient(client, …)` steht weiter direkt nach `client.starte();` (`verbund.ts:24`), die Zeilen 17
  und 18 bleiben, wo sie sind. Der **Launcher** (`masterLink: false`) bekommt weder Abfrage noch Zuhörer. Die CSP bleibt
  unberührt (IPC, kein Netz im Renderer).
- Kein Test lädt `index.ts` oder `master-link-ipc.ts` (Electron); die Verdrahtung prüfen Quelltext-Wächter, die
  Typprüfung aller Workspaces und der Bau des Titlers (Step 10).

---

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Einfügen in `packages/app-runtime/test/verbund.test.ts` direkt vor der Zeile `// ── Abschluss`:
```ts
// ── UX-Pilot C2 · Master-Link-Meldung (Spec 3.9, UO3; E1, E2; Review Focus 4) ──
{
  const { readFileSync } = await import('node:fs');
  const { EventEmitter } = await import('node:events');
  const { MASTER_LINK_KANAL, masterLinkMeldung } = await import('../src/master-link-meldung');
  const { VerbundFolger } = await import('../src/verbund-daten');
  const { verbundAnzeige } = await import('../src/verbund-anzeige');
  const json = (x: unknown): string => JSON.stringify(x);

  // Die Zustände des Clients (packages/master-link/src/client.ts:21-26), fehler ohne und mit errCode.
  const zustaende: Record<string, unknown>[] = [
    { art: 'aus' },
    { art: 'sucht' },
    { art: 'verbindet', adresse: '10.0.0.5' },
    { art: 'verbunden', adresse: '10.0.0.5', seit: 1_760_000_000_000, masterName: 'Regie-PC', suite: '0.15.0' },
    { art: 'fehler', code: 'nicht-gefunden', text: 'Regie-PC nicht gefunden' },
    { art: 'fehler', code: 'verweigert', text: 'Regie-PC lehnt die Verbindung ab', errCode: 'ECONNREFUSED' },
  ];
  const name = (z: Record<string, unknown>): string => `${String(z.art)}${z.code ? `:${String(z.code)}` : ''}`;

  const ohne = masterLinkMeldung(null);
  check('C2 ohne Client → ohne-client (nie aus)', json(ohne) === '{"art":"ohne-client"}', ohne);
  const wurf = masterLinkMeldung({ zustand: () => { throw new Error('kaputt'); } });
  check('C2 zustand() wirft → ohne-client, die Meldung wirft nie', json(wurf) === '{"art":"ohne-client"}', wurf);
  for (const z of zustaende) {
    const m = masterLinkMeldung({ zustand: () => z as never });
    check(`C2 Client ${name(z)} → Meldung ist der Zustand unverändert (dasselbe Objekt)`, m === z, m);
  }
  const alle = [ohne, ...zustaende];
  check('C2 alle sieben Meldungen sind reine Daten (JSON-Rundreise gleich)',
    alle.length === 7 && alle.every((m) => json(JSON.parse(json(m))) === json(m)));
  check('C2 Kanal jmps:master-link, nicht der Kanal der R2-V-Zeile', MASTER_LINK_KANAL === 'jmps:master-link' && MASTER_LINK_KANAL !== 'jmps:verbund-anzeige');

  // Kreuz gegen die R2-V-Zeile (headerCenter), gerechnet am echten VerbundFolger und an verbundAnzeige:
  // Rolle (keine Datei, aus, master, slave) × Zustand (6) × Verlauf (folgt nicht, folgt, folgt mit angewendetem Stand)
  // = 72 Fälle. Meldung (Statusleiste) und V-Zeile lesen denselben Client und dürfen sich nie widersprechen.
  class KreuzClient extends EventEmitter {
    z: Record<string, unknown> = { art: 'aus' };
    rolle: string | null = null;
    zustand() { return this.z; }
    kopplung() {
      if (this.rolle === null) return null;
      const aus = this.rolle === 'aus';
      return { rolle: this.rolle, masterId: aus ? null : 'M1', masterName: aus ? null : 'Regie-PC', letzteAdresse: null, adressen: [] };
    }
    sende() { return this.z.art === 'verbunden'; }
  }
  const STAND = { t: 'stand', art: 'show', fassung: 1, epoche: 'e1', folge: 1, schluessel: 'aaaaaaaaaaaaaaaa', show: { schemaVersion: 1, name: 'Gala', tools: [] }, mitDokument: [] };
  type Fall = { rolle: string | null; verlauf: string; z: Record<string, unknown>; m: { art: string }; v: { text: string; farbe: string } | null };
  const faelle: Fall[] = [];
  for (const verlauf of ['folgt nicht', 'folgt', 'folgt mit Stand']) {
    for (const rolle of [null, 'aus', 'master', 'slave']) {
      for (const z of zustaende) {
        const c = new KreuzClient();
        c.rolle = rolle;
        const f = new VerbundFolger({
          client: c as never,
          speicher: { lies: () => null, schreibe: async () => true, loesche: () => {} },
          log: () => {},
          uhr: { jetzt: () => 0, setTimeout: () => 0, clearTimeout: () => {} },
          darfSchreiben: false,
        });
        if (verlauf === 'folgt mit Stand') {
          // erst verbunden und ein Stand angewendet, dann wechselt der Client in den Zustand des Falls
          c.z = zustaende[3];
          f.starte();
          f.folge({ anwenden: () => {} } as never);
          c.emit('angemeldet', {});
          c.emit('daten', STAND);
          c.z = z;
          c.emit('zustand', z);
        } else {
          c.z = z;
          f.starte();
          if (verlauf === 'folgt') f.folge({ anwenden: () => {} } as never);
        }
        faelle.push({ rolle, verlauf, z, m: masterLinkMeldung(c as never) as { art: string }, v: verbundAnzeige(f.daten(), () => 'hh:mm') });
        f.stoppe();
      }
    }
  }
  const kurz = (x: Fall): string => `${x.verlauf}/${String(x.rolle)}/${name(x.z)}: ${x.v ? `${x.v.farbe} ${x.v.text}` : 'null'}`;
  check('C2 Kreuz: 72 Fälle (Rolle keine Datei/aus/master/slave × 6 Zustände × folgt nicht/folgt/folgt mit Stand)', faelle.length === 72, faelle.length);
  check('C2 Kreuz: Meldung = Zustand des Clients in jedem Fall', faelle.every((x) => x.m === x.z));
  const verbundenOhne = faelle.filter((x) => x.v !== null && x.v.text.startsWith('Verbunden mit') && x.m.art !== 'verbunden');
  check('C2 Kreuz: keine V-Zeile „Verbunden mit …“ ohne Meldung verbunden', verbundenOhne.length === 0, verbundenOhne.map(kurz));
  const gruen = faelle.filter((x) => x.v?.farbe === 'gruen');
  check('C2 Kreuz: grüne V-Zeile nur bei Meldung verbunden, also nie bei fehler (1 Fall: Slave, folgt mit Stand)',
    gruen.length === 1 && gruen.every((x) => x.m.art === 'verbunden'), gruen.map(kurz));
  const rotOhne = faelle.filter((x) => x.v?.farbe === 'rot' && x.m.art !== 'fehler');
  check('C2 Kreuz: rote V-Zeile nur bei Meldung fehler', rotOhne.length === 0, rotOhne.map(kurz));
  const leer = faelle.filter((x) => x.v === null);
  check('C2 Kreuz: ohne Slave-Kopplung keine V-Zeile (54 Fälle); dort trägt nur die Meldung den Zustand, 45-mal nicht aus (E1)',
    leer.length === 54 && leer.every((x) => x.rolle !== 'slave') && leer.filter((x) => x.m.art !== 'aus').length === 45, leer.length);

  // Quelltext-Wächter: index.ts und master-link-ipc.ts laden Electron und laufen hier nicht.
  const lies = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const anzahl = (t: string, s: string): number => t.split(s).length - 1;
  const index = lies('../src/index.ts');
  const ipc = lies('../src/master-link-ipc.ts');
  const rein = lies('../src/master-link-meldung.ts');
  check('C2 index.ts: genau eine Registrierung, genau ein Anhängen der Brücke, genau ein Client',
    anzahl(index, 'registriereMasterLinkAbfrage(') === 1 && anzahl(index, 'sendeMasterLinkWechsel(') === 1 && anzahl(index, 'new MasterLinkClient(') === 1);
  const sml = index.slice(index.indexOf('function startMasterLink('), index.indexOf('export function getMasterLinkStatus('));
  const reg = sml.indexOf('registriereMasterLinkAbfrage(() => masterLinkMeldung(masterLinkClient));');
  const sperre = sml.indexOf('if (!app.hasSingleInstanceLock()) return;');
  check('C2 Registrierung ist die erste Anweisung in los, vor try und vor der Lock-Prüfung (E2)',
    /\n {2}const los = \(\): void => \{\n( {4}\/\/[^\n]*\n)* {4}registriereMasterLinkAbfrage\(\(\) => masterLinkMeldung\(masterLinkClient\)\);\n {4}try \{\n/.test(sml)
      && reg >= 0 && sperre > reg, { reg, sperre });
  check('C2 R2 bleibt: verbundAnClient direkt nach client.starte(), die Brücke direkt danach am selben Client',
    index.includes("      client.starte();\n      verbundAnClient(client, { userData: app.getPath('userData'), log: info.log });\n      sendeMasterLinkWechsel(client);\n"));
  // Relativ statt per Zeilennummer: Ein späterer Import weiter oben darf den Selbsttest nicht rot machen (G4 gilt für die Umsetzung).
  const r2Importe = "import { MasterLinkClient, masterLinkPfad, verbundWert, type ClientZustand } from '@jm/master-link';\nimport { verbundAnClient } from './verbund';\n";
  const r2Pos = index.indexOf(r2Importe);
  const neuPos = index.indexOf("from './master-link-");
  check('C2 R2-Importe stehen unverändert direkt hintereinander, vor den Importen aus master-link-*.ts',
    r2Pos >= 0 && anzahl(index, r2Importe) === 1 && (neuPos < 0 || neuPos > r2Pos), { r2Pos, neuPos });
  check('C2 index.ts exportiert Kanal, Funktion und Typ der Meldung',
    index.includes("export { MASTER_LINK_KANAL, masterLinkMeldung, type MasterLinkMeldung } from './master-link-meldung';"));
  check('C2 getMasterLinkStatus bleibt unverändert (ohne Client aus, Presence, U6)',
    index.includes("export function getMasterLinkStatus(): ClientZustand {\n  return masterLinkClient?.zustand() ?? { art: 'aus' };\n}"));
  check('C2 index.ts räumt weiter nirgends sofort auf (4b-Wächter gilt auch für die neuen Zeilen)',
    !index.includes('raeumeLogsAuf(') && !index.includes('LOG_AUFRAEUMEN_TAKT_MS'));
  check('C2 master-link-ipc.ts: Abfrage auf MASTER_LINK_KANAL in try/catch',
    /try \{\n\s*ipcMain\.handle\(MASTER_LINK_KANAL, \(\) => lies\(\)\);\n\s*\} catch/.test(ipc));
  check('C2 master-link-ipc.ts: Senden je Fenster mit isDestroyed und try/catch',
    /try \{\n\s*if \(!w\.isDestroyed\(\)\) w\.webContents\.send\(MASTER_LINK_KANAL, m\);\n\s*\} catch/.test(ipc));
  check('C2 master-link-ipc.ts: Zuhörer am Client und sofort einmal der aktuelle Stand (Einzelplatz meldet nie ein Ereignis)',
    ipc.includes("  client.on('zustand', () => sendeAnAlle(masterLinkMeldung(client)));\n  sendeAnAlle(masterLinkMeldung(client));\n"));
  check('C2 master-link-meldung.ts ohne Electron, aus @jm/master-link nur der Typ',
    !rein.includes("from 'electron'") && /^import type \{ ClientZustand \} from '@jm\/master-link';$/m.test(rein) && !/^import (?!type )/m.test(rein));
}

```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/app-runtime; echo "Exit=$?"
```
Erwartet (gemessen): `50 passed, 0 failed`, dann die 227 `ok`-Zeilen aus C11–C13, keine `C2`-Zeile, Abbruch beim Laden:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '<worktree>\packages\app-runtime\src\master-link-meldung' imported from <worktree>\packages\app-runtime\test\verbund.test.ts
…
Exit=1
```

- [ ] **Step 3: Reinen Teil anlegen**

Neue Datei `packages/app-runtime/src/master-link-meldung.ts`, ganzer Inhalt:
```ts
// ─────────────────────────────────────────────────────────────────────────────
// Master-Link-Brücke, reiner Teil (Suite-UX-Update Welle 0, Spec 3.9, UO3). Ohne Electron und nur mit
// `import type`, damit test/verbund.test.ts (tsx) und auch `node --experimental-strip-types` die Datei laden.
//
// Die Meldung ist der Zustand des vorhandenen Clients UNVERÄNDERT (aus | sucht | verbindet | verbunden |
// fehler) oder `ohne-client`: In diesem Prozess läuft kein Client (Zweitinstanz ohne Single-Instance-Lock,
// Wurf beim Bau des Clients), oder zustand() warf. Bewusst nicht `aus`: das hieße „Rolle aus“.
// getMasterLinkStatus() in index.ts bleibt, wie es ist (ohne Client `aus`; die Presence hängt daran, U6).
// ─────────────────────────────────────────────────────────────────────────────
import type { ClientZustand } from '@jm/master-link';

/** IPC-Kanal der Brücke: Abfrage (invoke) und Ereignis an alle Fenster auf demselben Namen. */
export const MASTER_LINK_KANAL = 'jmps:master-link';

export type MasterLinkMeldung = ClientZustand | { art: 'ohne-client' };

/** null oder Wurf von zustand() → { art: 'ohne-client' }; sonst client.zustand() unverändert (gleiches Objekt). */
export function masterLinkMeldung(client: { zustand(): ClientZustand } | null): MasterLinkMeldung {
  if (!client) return { art: 'ohne-client' };
  try {
    return client.zustand();
  } catch {
    return { art: 'ohne-client' };
  }
}
```

- [ ] **Step 4: Electron-Teil anlegen**

Neue Datei `packages/app-runtime/src/master-link-ipc.ts`, ganzer Inhalt:
```ts
// ─────────────────────────────────────────────────────────────────────────────
// Master-Link-Brücke, Electron-Teil (Suite-UX-Update Welle 0, Spec 3.9, UO3).
//
// Abfrage `ipcRenderer.invoke('jmps:master-link')` und Ereignis `jmps:master-link` an alle Fenster, nach dem
// Muster von verbund-ipc.ts (Master-Link 2b R2). Nur lesend: derselbe Client wie Presence und Verbund, keine
// Logik; die CSP bleibt unberührt (IPC, kein Netz im Renderer). Geprüft über die Quelltext-Wächter in
// test/verbund.test.ts, die Typprüfung aller Workspaces und den Bau des Titlers, nicht im Selbsttest.
// ─────────────────────────────────────────────────────────────────────────────
import { BrowserWindow, ipcMain } from 'electron';
import type { MasterLinkClient } from '@jm/master-link';
import { MASTER_LINK_KANAL, masterLinkMeldung, type MasterLinkMeldung } from './master-link-meldung';

/**
 * Abfrage registrieren (index.ts: erste Anweisung in `los`, vor der Lock-Prüfung). `lies` läuft bei jedem
 * Aufruf neu und antwortet ohne Client mit `ohne-client`. Wirft nie; ein zweiter Aufruf lässt den ersten
 * Handler stehen.
 */
export function registriereMasterLinkAbfrage(lies: () => MasterLinkMeldung): void {
  try {
    ipcMain.handle(MASTER_LINK_KANAL, () => lies());
  } catch {
    /* schon registriert (zweiter Aufruf) — der erste Handler bleibt */
  }
}

/** Eine Meldung an alle Fenster, je Fenster mit isDestroyed und try/catch (Muster verbund-ipc.ts). Wirft nie. */
function sendeAnAlle(m: MasterLinkMeldung): void {
  try {
    for (const w of BrowserWindow.getAllWindows()) {
      try {
        if (!w.isDestroyed()) w.webContents.send(MASTER_LINK_KANAL, m);
      } catch {
        /* dieses Fenster schließt gerade; die anderen bekommen die Meldung trotzdem */
      }
    }
  } catch {
    /* keine Fensterliste (Electron beendet gerade) */
  }
}

/**
 * Hängt die Brücke an den Client (index.ts: direkt nach verbundAnClient) und sendet sofort einmal den
 * aktuellen Stand: Am Einzelplatz meldet der Client nie ein `zustand`-Ereignis (Startwert aus, Gleiches wird
 * verschluckt). Der Zuhörer wirft nie: Ein werfender Zuhörer bräche die späteren Zuhörer desselben emit ab.
 */
export function sendeMasterLinkWechsel(client: MasterLinkClient): void {
  client.on('zustand', () => sendeAnAlle(masterLinkMeldung(client)));
  sendeAnAlle(masterLinkMeldung(client));
}
```

- [ ] **Step 5: Test laufen lassen (noch rot: nur die Wächter auf `index.ts`)**

```
npm run selftest -w @jm/app-runtime; echo "Exit=$?"
npm run selftest -w @jm/app-runtime 2>&1 | grep -E "^FAIL"
```
Erwartet (gemessen): `50 passed, 0 failed`, die 227 Zeilen aus C11–C13 und 23 Zeilen `  ok  C2 …` (Meldung, Kreuz und
die Wächter, die die neuen Zeilen in `index.ts` noch nicht brauchen), am Ende `250 passed, 4 failed`, `Exit=1`, genau diese
Zeilen:
```
FAIL  C2 index.ts: genau eine Registrierung, genau ein Anhängen der Brücke, genau ein Client
FAIL  C2 Registrierung ist die erste Anweisung in los, vor try und vor der Lock-Prüfung (E2) — {"reg":-1,"sperre":419}
FAIL  C2 R2 bleibt: verbundAnClient direkt nach client.starte(), die Brücke direkt danach am selben Client
FAIL  C2 index.ts exportiert Kanal, Funktion und Typ der Meldung
```

- [ ] **Step 6: Die vier Einfügungen in `packages/app-runtime/src/index.ts` (G2, G4)**

Mit dem Edit-Werkzeug, jede Ersetzung für sich; keine andere Zeile ändern.

(a) Importe. Vorher (`packages/app-runtime/src/index.ts`, genau einmal):
```ts
import { verbundAnClient } from './verbund';
```

Nachher:
```ts
import { verbundAnClient } from './verbund';
import { masterLinkMeldung } from './master-link-meldung';
import { registriereMasterLinkAbfrage, sendeMasterLinkWechsel } from './master-link-ipc';
```

(b) Export nach dem R2-Exportblock (der Block selbst bleibt unverändert):

Einfügen in `packages/app-runtime/src/index.ts` direkt vor der Zeile `export interface AppRuntimeOptions {`:
```ts
// Suite-UX-Update Welle 0 (Spec 3.9): lesende Master-Link-Brücke, Kanal jmps:master-link. Neues liegt in master-link-*.ts.
export { MASTER_LINK_KANAL, masterLinkMeldung, type MasterLinkMeldung } from './master-link-meldung';

```

(c) Registrierung als erste Anweisung in `los`. Vorher (`packages/app-runtime/src/index.ts`, genau einmal):
```ts
  const los = (): void => {
    try {
```

Nachher:
```ts
  const los = (): void => {
    // Suite-UX-Update Welle 0 (Spec 3.9, E2): Abfrage jmps:master-link vor Lock und Client; ohne Client antwortet sie ohne-client.
    registriereMasterLinkAbfrage(() => masterLinkMeldung(masterLinkClient));
    try {
```

(d) Brücke am selben Client, direkt nach der R2-Zeile. Vorher (`packages/app-runtime/src/index.ts`, genau einmal):
```ts
      verbundAnClient(client, { userData: app.getPath('userData'), log: info.log });
```

Nachher:
```ts
      verbundAnClient(client, { userData: app.getPath('userData'), log: info.log });
      sendeMasterLinkWechsel(client);
```

Prüfen, dass nur eingefügt wurde:
```
git diff --stat packages/app-runtime/src/index.ts
git diff packages/app-runtime/src/index.ts | grep -c '^-[^-]'
```
Erwartet: ` packages/app-runtime/src/index.ts | 8 ++++++++`, `1 file changed, 8 insertions(+)` und `0`. Gemessen in der
Kopie mit `diff` gegen den Stand vor dem Step: genau 8 neue Zeilen (2 Importe; Kommentar, Export und Leerzeile; Kommentar
und Registrierung; Anhängen), keine gelöschte oder geänderte; `index.ts` danach 683 Zeilen, alle mit CRLF.

- [ ] **Step 7: Test laufen lassen (grün)**

```
npm run selftest -w @jm/app-runtime; echo "Exit=$?"
npm run selftest -w @jm/app-runtime 2>&1 | grep -c "  ok  C2 "
```
Erwartet (gemessen): `50 passed, 0 failed`, dann die 227 Zeilen aus C11–C13 und 27 Zeilen `  ok  C2 …` (von „C2 ohne
Client → ohne-client (nie aus)“ bis „C2 master-link-meldung.ts ohne Electron, aus @jm/master-link nur der Typ“), keine
`FAIL`-Zeile, `254 passed, 0 failed`, `Exit=0`; die zweite Zeile zeigt `27`. Die zwei 4b-Wächter in `test/selftest.ts`
(„initAppRuntime plant das Aufräumen nach dem Logger, nur mit dem Lock, der Bericht geht ins Log“ und „… und index.ts räumt
nirgends sofort auf (kein raeumeLogsAuf, kein eigener Takt)“) bleiben `ok`: Keine neue Zeile enthält `raeumeLogsAuf(` oder
`LOG_AUFRAEUMEN_TAKT_MS`, und `createLogger(` steht weiter vor `planeLogAufraeumen(`.

- [ ] **Step 8: CI-Schritt umbenennen** (`.github/workflows/ci-checks.yml`, Job bleibt bei 22 Schritten)

Vorher (`.github/workflows/ci-checks.yml`, genau einmal):
```yaml
      # (Anzeige V1–V15, Abo-Zustand, Zwischenspeicher) mit tsx, ohne Electron. Genau ein Schritt dafür.
      - name: App-Laufzeit (Log-Aufräumen, CSP, Verbund-Anzeige, Abo-Zustand)
```

Nachher:
```yaml
      # (Anzeige V1–V15, Abo-Zustand, Zwischenspeicher) mit tsx, ohne Electron. Genau ein Schritt dafür.
      # Suite-UX-Update Welle 0 (Spec 3.9): im selben Lauf die Master-Link-Meldung (Kanal jmps:master-link).
      - name: App-Laufzeit (Log-Aufräumen, CSP, Verbund-Anzeige, Abo-Zustand, Master-Link-Meldung)
```

Prüfen:
```
node -e "const y=require('js-yaml');const d=y.load(require('fs').readFileSync('.github/workflows/ci-checks.yml','utf8'));console.log(Object.entries(d.jobs).map(([k,v])=>k+' '+v.steps.length).join(', '));console.log(d.jobs.selftests.steps.filter(s=>s.run==='npm run selftest -w @jm/app-runtime').map(s=>s.name).join(' | '))"
```
Erwartet (gemessen):
```
typecheck 4, selftests 22, secret-scan 3, audit 4
App-Laufzeit (Log-Aufräumen, CSP, Verbund-Anzeige, Abo-Zustand, Master-Link-Meldung)
```

- [ ] **Step 9: Gegenprobe (nicht committen)**

Je eine Änderung, `npm run selftest -w @jm/app-runtime 2>&1 | grep -E "^FAIL|passed"`, zurückbauen:

| Datei | Änderung (Vorher → Nachher) | erwartet (gemessen) |
| --- | --- | --- |
| `packages/app-runtime/src/master-link-meldung.ts` | `  if (!client) return { art: 'ohne-client' };` → `  if (!client) return { art: 'aus' };` | `50 passed, 0 failed`; 1 `FAIL`: „C2 ohne Client → ohne-client (nie aus)“ mit Detail `{"art":"aus"}`; `253 passed, 1 failed` |
| `packages/app-runtime/src/master-link-meldung.ts` | im `catch` `    return { art: 'ohne-client' };` → `    return { art: 'aus' };` | 1 `FAIL`: „C2 zustand() wirft → ohne-client, die Meldung wirft nie“ mit Detail `{"art":"aus"}`; `253 passed, 1 failed` |
| `packages/app-runtime/src/master-link-ipc.ts` | die Zeile `  sendeAnAlle(masterLinkMeldung(client));` (Senden beim Anhängen) löschen | 1 `FAIL`: „C2 master-link-ipc.ts: Zuhörer am Client und sofort einmal der aktuelle Stand (Einzelplatz meldet nie ein Ereignis)“; `253 passed, 1 failed` |
| `packages/app-runtime/src/index.ts` | die zwei neuen Zeilen in `los` (Kommentar und Registrierung) direkt hinter die Zeile `      if (!app.hasSingleInstanceLock()) return;` verschieben und dabei wie diese auf sechs Leerzeichen einrücken (sie stehen dann im `try`; wörtlich unter der Tabelle) | 1 `FAIL`: „C2 Registrierung ist die erste Anweisung in los, vor try und vor der Lock-Prüfung (E2)“ mit Detail `{"reg":601,"sperre":419}`; `253 passed, 1 failed` |
| `packages/app-runtime/src/index.ts` | an die Kommentarzeile der Registrierung ` Kein raeumeLogsAuf( hier.` anhängen | erster Lauf: `FAIL  … und index.ts räumt nirgends sofort auf (kein raeumeLogsAuf, kein eigener Takt)`, `49 passed, 1 failed`; `verbund.test.ts` läuft wegen `&&` nicht mehr, `Exit=1` |
| `packages/app-runtime/src/index.ts` | `      sendeMasterLinkWechsel(client);` vor die Zeile `      verbundAnClient(client, …);` setzen | 1 `FAIL`: „C2 R2 bleibt: verbundAnClient direkt nach client.starte(), die Brücke direkt danach am selben Client“; `253 passed, 1 failed` |
| `packages/app-runtime/src/index.ts` | die zwei neuen Importzeilen (`import { masterLinkMeldung } …` und `import { registriereMasterLinkAbfrage, … }`) vor die R2-Zeile `import { MasterLinkClient, …` setzen | 1 `FAIL`: „C2 R2-Importe stehen unverändert direkt hintereinander, vor den Importen aus master-link-*.ts“ mit Detail `{"r2Pos":583,"neuPos":463}`; `253 passed, 1 failed` |

Probe 4 wörtlich (Edit-Werkzeug). Vorher:
```ts
  const los = (): void => {
    // Suite-UX-Update Welle 0 (Spec 3.9, E2): Abfrage jmps:master-link vor Lock und Client; ohne Client antwortet sie ohne-client.
    registriereMasterLinkAbfrage(() => masterLinkMeldung(masterLinkClient));
    try {
      if (masterLinkClient) return;
      // Erst NACH der Sperre der App: whenReady läuft nach dem synchronen requestSingleInstanceLock
      // aller Tools. Zweitinstanz (lock=false) → kein Client (gemessen: sonst Anmeldung in 4–9 ms).
      if (!app.hasSingleInstanceLock()) return;
```
Nachher (nur für diesen Lauf):
```ts
  const los = (): void => {
    try {
      if (masterLinkClient) return;
      // Erst NACH der Sperre der App: whenReady läuft nach dem synchronen requestSingleInstanceLock
      // aller Tools. Zweitinstanz (lock=false) → kein Client (gemessen: sonst Anmeldung in 4–9 ms).
      if (!app.hasSingleInstanceLock()) return;
      // Suite-UX-Update Welle 0 (Spec 3.9, E2): Abfrage jmps:master-link vor Lock und Client; ohne Client antwortet sie ohne-client.
      registriereMasterLinkAbfrage(() => masterLinkMeldung(masterLinkClient));
```
Verschiebt man die zwei Zeilen ohne neuen Einzug (vier Leerzeichen), bleibt die Probe rot, nur das Detail lautet dann
`{"reg":597,"sperre":419}` (gemessen). Die Prüfung der R2-Importe (letzte Zeile der Tabelle) ist relativ: Eine zusätzliche Zeile `// Probe` am
Dateianfang von `index.ts` lässt sie grün (gemessen: `50 passed, 0 failed`, `254 passed, 0 failed`, `Exit=0`), nur die Reihenfolge oder ein Bruch zwischen den zwei
R2-Zeilen macht sie rot.

Danach wieder `50 passed, 0 failed` und `254 passed, 0 failed`.

- [ ] **Step 10: Typprüfung aller Workspaces und Bau des Titlers**

```
SP='<eigener Scratchpad>'; [ -d "$SP" ] && { npm run typecheck --workspaces --if-present > "$SP/tc-c2.txt" 2>&1; echo "Exit=$?"; grep -c "error TS" "$SP/tc-c2.txt"; }
SP='<eigener Scratchpad>'; [ -d "$SP" ] && { npm run build -w @jm/titler > "$SP/build-c2.txt" 2>&1; echo "Exit=$?"; }
wc -c apps/titler/out/main/index.cjs apps/titler/out/preload/index.cjs
node -e '
const t = require("fs").readFileSync("apps/titler/out/main/index.cjs", "utf8");
const los = t.indexOf("const los = () => {");
const reg = t.indexOf("registriereMasterLinkAbfrage(() => masterLinkMeldung(masterLinkClient));", los);
const sperre = t.indexOf("if (!electron.app.hasSingleInstanceLock()) return;", los);
const senden = t.indexOf("sendeMasterLinkWechsel(client);", los);
console.log("Kanal", t.split("jmps:master-link").length - 1, "| handle", t.includes("electron.ipcMain.handle(MASTER_LINK_KANAL, () => lies());"), "| erste Zeile in los", los > 0 && t.slice(los, reg).split("\n").length === 2, "| vor der Lock-Prüfung", sperre > reg, "| Senden danach", senden > sperre);
'
```
Erwartet (gemessen): Typprüfung `Exit=0` und `0` (Lauf 95 s); ab jetzt prüfen alle Apps, die `@jm/app-runtime`
importieren, die zwei neuen Module mit (`master-link-ipc.ts` gegen die Electron-Typen von `ipcMain.handle` und
`webContents.send`; das Paket selbst hat kein `typecheck`-Skript). Bau `Exit=0`, dann
```
266287 apps/titler/out/main/index.cjs
  3622 apps/titler/out/preload/index.cjs
269909 total
Kanal 1 | handle true | erste Zeile in los true | vor der Lock-Prüfung true | Senden danach true
```
Das Main-Bündel wächst von 265435 Byte (`5e5b234ec3`) um 852 Byte; das Preload-Bündel bleibt bei 3622 Byte. Im Bündel ist
die Registrierung die erste Zeile von `los` (der Kommentar fällt weg), vor `if (!electron.app.hasSingleInstanceLock())
return;`, und `sendeMasterLinkWechsel(client);` steht nach der Lock-Prüfung. Ob `ipcMain.handle` an dieser Stelle zur
Laufzeit greift, ist ohne Electron nicht messbar (G13): Abnahme-Punkt in C14. `apps/titler/out` ist von Git ignoriert.

- [ ] **Step 11: Zeilenenden**

```
node -e "for (const f of process.argv.slice(1)) { const t = require('fs').readFileSync(f, 'utf8'); console.log(f, (t.match(/\n/g) || []).length, (t.match(/\r\n/g) || []).length); }" packages/app-runtime/src/index.ts packages/app-runtime/src/master-link-meldung.ts packages/app-runtime/src/master-link-ipc.ts packages/app-runtime/test/verbund.test.ts .github/workflows/ci-checks.yml
```
Erwartet (gemessen): `packages/app-runtime/src/index.ts 683 683`, `packages/app-runtime/src/master-link-meldung.ts 25 0`,
`packages/app-runtime/src/master-link-ipc.ts 49 0`, `packages/app-runtime/test/verbund.test.ts 1071 1071`,
`.github/workflows/ci-checks.yml 127 127`.

- [ ] **Step 12: Commit** (Commit-Text ASCII)

```
git add packages/app-runtime/src/index.ts packages/app-runtime/src/master-link-meldung.ts packages/app-runtime/src/master-link-ipc.ts packages/app-runtime/test/verbund.test.ts .github/workflows/ci-checks.yml
git status --short
```
Erwartet genau (fremde Zeilen mit `??` bleiben ungestaged):
```
M  .github/workflows/ci-checks.yml
M  packages/app-runtime/src/index.ts
A  packages/app-runtime/src/master-link-ipc.ts
A  packages/app-runtime/src/master-link-meldung.ts
M  packages/app-runtime/test/verbund.test.ts
```
Dann:
```
git commit -m "feat(app-runtime): lesende Master-Link-Bruecke jmps:master-link (Suite-UX Welle 0, Spec 3.9)" -m "Neuer IPC-Kanal jmps:master-link: Abfrage und Ereignis an alle Fenster mit dem Zustand des vorhandenen Master-Link-Clients unveraendert; ohne Client ohne-client statt Ablehnung. Die Abfrage steht als erste Anweisung in los (vor Lock-Pruefung), die Bruecke haengt direkt nach verbundAnClient am selben Client und sendet beim Anhaengen einmal den Stand (am Einzelplatz kommt sonst nie ein Ereignis). Kein zweiter Client, kein Eingriff in verbund*.ts oder @jm/master-link; getMasterLinkStatus und die R2-Zeilen bleiben. Test: Kreuz Rolle x Client-Zustand x Verlauf gegen die R2-V-Zeile am echten VerbundFolger (72 Faelle), Quelltext-Waechter. CI-Schritt umbenannt, Job bleibt bei 22 Schritten." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- **Kreuz mit drei Verläufen, 72 statt 48 Fälle:** Zu „folgt nein/ja“ kommt „folgt mit angewendetem Stand“ (Client erst
  verbunden, ein Stand kommt an und wird angewendet, dann wechselt der Client in den Zustand des Falls). Nur dort entsteht
  eine grüne V-Zeile (V4); ohne diesen Verlauf hat das Kreuz keinen grünen Fall (gemessen: 0 von 48), und die Prüfung „nie
  grün bei fehler“ könnte nichts fangen. Gemessen: 54 leere V-Zeilen (alle ohne Slave-Kopplung, 45 davon mit Meldung ungleich
  `aus`), 1 grüne (Slave, verbunden, mit Stand), rot nur bei `fehler`, „Verbunden mit …“ nur bei `verbunden`.
- **Zwei Importzeilen** (je Modul eine): 8 eingefügte Zeilen in `index.ts` (675 → 683).
- **„Meldung = Zustand“ per Identität** (`m === z`) statt `deepStrictEqual`: strenger und genau die Zusage des Registers
  („gleiches Objekt“); die JSON-Rundreise ist ein eigener Fall.
- **`sendeAnAlle` als interner Helfer** in `master-link-ipc.ts` (nicht exportiert), mit einem äußeren try/catch um
  `BrowserWindow.getAllWindows()`, damit die Zusage „wirft nie“ auch beim Beenden gilt.
- **Zusätzliche Wächter und Fälle:** `zustand()` wirft → `ohne-client`; genau ein `new MasterLinkClient(`; kein
  `LOG_AUFRAEUMEN_TAKT_MS`; die R2-Importe unverändert hintereinander und vor den neuen Importen. 27 Prüfungen statt der im
  Gerüst aufgezählten.
- **R2-Importe relativ geprüft (Nachbesserung, Prüfbefund code:4):** Der Test läuft dauerhaft in der CI, und
  `@jm/app-runtime` nutzen 24 Tools. Eine Prüfung per Zeilennummer (`zeilen[16]`, `zeilen[17]`) würde bei jedem späteren
  Import weiter oben rot, obwohl R2 unberührt bleibt; G4 („weder verschoben noch geändert“) ist eine Regel für diese
  Umsetzung, die der Diff in Step 6 (`8 insertions(+)`, `0` gelöschte Zeilen) belegt. Die Prüfung verlangt deshalb nur, dass
  beide R2-Zeilen wörtlich direkt hintereinander und vor den Importen aus `master-link-*.ts` stehen (eigene Gegenprobe).
- **Gegenprobe (a) doppelt:** einmal ohne Client, einmal beim Wurf von `zustand()`.
- **Bau des Titlers schon in C2** (Step 10): Das Gerüst verlangt die Messung von `ipcMain.handle` in `los` „in Typprüfung und
  Bau“; das Main-Bündel zeigt die Registrierung als erste Zeile von `los`. `master-link-meldung.ts` lädt auch unter
  `node --experimental-strip-types` (gemessen: `{"art":"ohne-client"} jmps:master-link`); ein Test dafür in
  `test/selftest.ts` entfällt, weil G1 diese Datei nicht freigibt.
- **Reihenfolge der Steps:** Gegenproben vor der Typprüfung (Abschnitt 10 der Gliederung), damit die Typprüfung den
  zurückgebauten Stand prüft.

---

### Task 3: C3 · Fernsteuerungs-Meldung des Titlers (N2)

**Spec:** 3.9 (je Tool eine lesende Meldung `{läuft, port, clients, modus}` aus dem vorhandenen Steuerserver), 7.2/7.3
(unbekannt ist nicht ok; nur Gemessenes), Anhang A Titler „Companion (`status.suiteClients`, Port 8726 fest)“. Global
Constraints G1, G2 (Ausnahme N2), G9, G10, G11, G12, G16. Entscheidung E6. Review Focus 1.

**Voraussetzung:** Task 2 ist committet. `npm run selftest -w @jm/titler` zeigt 512 `ok`-Zeilen und `ALLE TESTS OK`;
`npm run selftest -w @jm/suite-control-protocol` zeigt 77 `ok`-Zeilen und `ALLE TESTS OK`.

**Dateien:**
- Modify: `packages/suite-control-protocol/src/server.ts` (Getter `modus()` direkt nach `status()`, `:169-171`)
- Modify: `packages/suite-control-protocol/test/selftest.ts` (ein Block direkt vor `console.log(failed === 0 …`, `:226`)
- Create: `apps/titler/src/shared/fernsteuerung.ts` (rein, ohne Importe)
- Modify: `apps/titler/src/shared/types.ts` (Import nach `:9`, Feld `TitlerStatus.fernsteuerung?` nach `suiteClients`,
  `:159-160`)
- Modify: `apps/titler/src/main/control-server.ts` (Import nach `:24`, vierter Parameter nach `:112`, `onStatus` `:130-131`)
- Modify: `apps/titler/src/main/index.ts` (Import nach `:39`, Helfer `meldeFernsteuerung` nach `broadcastStatus`
  `:93-98`, drei Anlässe im Start des Steuerservers `:803-810`)
- Modify: `apps/titler/test/selftest.ts` (ein Block direkt vor `if (failed > 0) {`, `:1398`)

**Interfaces:**
- Consumes: bestehend `SuiteControlStatus { running, port, clients }` und `onStatus` aus
  `packages/suite-control-protocol/src/server.ts` (gemeldet bei Startfehler mit `running: false, port: 0, clients: 0`
  `:197-202`, Start `:226`, jeder Verbindung `:238`, `:247`, `:272` und `stop` `:353-356`), privat `effectiveMode()`
  `:179-182`; `startControlServer(…)` → `{ ok, error?, port? }`, `status`/`broadcastStatus()` im Titler-Main.
- Produces (S-A2, S-A3, exakt; Block B und C bauen darauf):
  ```ts
  // packages/suite-control-protocol/src/server.ts
  class SuiteControlServer { modus(): 'open' | 'secure' }   // öffentlich, nur lesend, direkt nach status(), ruft this.effectiveMode(); gilt ab start(), davor ist resolved leer ('open')
  // apps/titler/src/shared/fernsteuerung.ts  (rein, keine Importe mit Laufzeitwirkung)
  export const STEUER_PORT = 8726;   // Gleichlauf mit CONTROL_PORT (Quelltext-Wächter)
  export interface FernsteuerungMeldung { laeuft: boolean; port: number; clients: number; modus?: 'open' | 'secure'; fehler?: string }
  export type FernsteuerungEreignis =
    | { art: 'status'; running: boolean; port: number; clients: number; modus?: 'open' | 'secure' }
    | { art: 'start'; ok: boolean; error?: string }
    | { art: 'wurf'; text: string };
  export function naechsteFernsteuerung(alt: FernsteuerungMeldung | undefined, e: FernsteuerungEreignis): FernsteuerungMeldung;
  export function portBelegt(m: FernsteuerungMeldung | undefined): boolean;   // fehler enthält 'EADDRINUSE'
  // apps/titler/src/shared/types.ts → TitlerStatus (+)
  fernsteuerung?: FernsteuerungMeldung;   // undefined = noch keine Meldung (Startwert im Main: Feld fehlt)
  ```
  Intern (nur Main): `startControlServer(getWin, onClients?, onLocal?, onMeldung?: (e: FernsteuerungEreignis) => void)`;
  `onStatus` meldet zuerst `{ art: 'status', …st, modus: server?.modus() }` und ruft dann `onClients?.(st.clients)`;
  Helfer `meldeFernsteuerung(e)` in `main/index.ts`.

**Verhalten (verbindlich):**
- **Regeln von `naechsteFernsteuerung`:**
  - `status`: `laeuft = running`; `port = port > 0 ? port : (alt?.port ?? STEUER_PORT)`; `clients = running ? clients : 0`;
    `modus = e.modus ?? alt?.modus`. Mit `running` fällt `fehler` weg, ohne `running` bleibt `alt?.fehler`.
  - `start` mit `ok: true`: `laeuft: true`, kein `fehler`; Port, Clients und Modus vom alten Stand (Port sonst
    `STEUER_PORT`, Clients sonst 0).
  - `start` mit `ok: false`: `laeuft: false`, `clients: 0`, `fehler = error?.trim() || 'unbekannt'`; Port und Modus vom
    alten Stand.
  - `wurf`: wie `start` mit `ok: false`, Text aus `text`.
  - Felder ohne Wert fehlen im Objekt (nie `undefined`), Reihenfolge `laeuft, port, clients, modus, fehler`.
- **`portBelegt`:** `true` genau dann, wenn `fehler` `EADDRINUSE` enthält. Node setzt den Fehlercode an den Anfang der
  Meldung (`listen EADDRINUSE: address already in use …`, Beispieltext im Test; ein belegter Port wurde nicht echt
  gemessen, G13). Jeder andere Startfehler ist „Fehler: …“ (Statusleiste, Block B).
- **Reihenfolge im Server:** Bei Erfolg kommt erst der Status (`running: true`), dann das Start-Ergebnis; bei einem
  Startfehler erst der Status (`running: false`, Port 0), dann das Start-Ergebnis mit dem Fehlertext. Beide Folgen sind
  getestet, ebenso die umgekehrte.
- **Main nur lesend (N2):** Port 8726 bleibt Konstante (`CONTROL_PORT`); Befehle, STATE, `suiteClients` und die drei
  Logzeilen bleiben. Neu: `onStatus` des Steuerservers meldet zuerst `{ art: 'status', …st, modus: server?.modus() }`, dann
  wie bisher `onClients?.(st.clients)`; der Main schreibt `status.fernsteuerung` in einem Helfer fort und sendet
  `titler:status` (Kanal unverändert). Der Startwert im Main hat kein Feld `fernsteuerung` (bis zur ersten Meldung:
  Statuseintrag „unbekannt“, Block B).
- **`modus()`** ist ein lesender Getter, öffentlich, ohne Logik; vor `start()` liefert er `'open'`, weil die Konfiguration
  erst in `start()` gelesen wird. Der Titler liest ihn nur aus `onStatus`, also ab `start()`.
- **Prüfbarkeit des Getters (gemessen):** `packages/suite-control-protocol/test/selftest.ts` läuft mit
  `node --experimental-strip-types`; `server.ts` lädt dort nicht (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX: TypeScript parameter
  property is not supported in strip-only mode`, Konstruktor `:152`). Unter `tsx` scheitert `@jm/discovery` an
  `bonjour-service` („does not provide an export named 'Bonjour'“). Der Selbsttest prüft deshalb den Quelltext; das
  Verhalten prüft Step 5 einmal über ein esbuild-Bündel ohne Socket (wie `test:integration`, nicht in der CI).

---

- [ ] **Step 1: Fehlschlagenden Test im Steuerprotokoll schreiben**

Einfügen in `packages/suite-control-protocol/test/selftest.ts` direkt vor der Zeile `console.log(failed === 0`:
```ts
// Suite-UX-Update Welle 0 (Spec 3.9, N2): lesender Getter modus() für die Fernsteuerungs-Meldung der Tools.
// server.ts lädt dieser Lauf nicht (Parameter-Property im Konstruktor; --experimental-strip-types lehnt sie ab).
// Geprüft wird darum der Quelltext; das Verhalten prüft der Pilot-Plan (Task 3, Step 5) einmal über ein Bündel.
{
  const { readFileSync } = await import('node:fs');
  const q = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  eq(/\n {2}modus\(\): 'open' \| 'secure' \{\n {4}return this\.effectiveMode\(\);\n {2}\}\n/.test(q), true, 'server: modus() ist öffentlich und liefert effectiveMode() unverändert');
  eq(q.split('private effectiveMode(): ').length - 1, 1, 'server: effectiveMode bleibt privat');
  eq(/\n {2}status\(\): SuiteControlStatus \{\n[^\n]*\n {2}\}\n\n( {2}\/\*\*\n( {3}\*[^\n]*\n)* {3}\*\/\n)? {2}modus\(\): /.test(q), true, 'server: modus() steht direkt nach status()');
}

```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/suite-control-protocol; echo "Exit=$?"
```
Erwartet (gemessen): 78 `ok`-Zeilen (die alten 77 und „server: effectiveMode bleibt privat“), dazu auf stderr
```
FAIL server: modus() ist öffentlich und liefert effectiveMode() unverändert
  erwartet: true
  bekommen: false
FAIL server: modus() steht direkt nach status()
  erwartet: true
  bekommen: false

2 FEHLER
Exit=1
```

- [ ] **Step 3: Getter `modus()`** (`packages/suite-control-protocol/src/server.ts`)

Vorher (`packages/suite-control-protocol/src/server.ts`, genau einmal):
```ts
  status(): SuiteControlStatus {
    return { running: this.running, port: this.boundPort, clients: this.clients.size };
  }
```

Nachher:
```ts
  status(): SuiteControlStatus {
    return { running: this.running, port: this.boundPort, clients: this.clients.size };
  }

  /**
   * Wirksamer Modus, nur lesend (Suite-UX-Update Welle 0, Spec 3.9): für die Meldung „Fernsteuerung“ der Tools.
   * Gilt ab start() (dort wird die geteilte Konfig gelesen); davor 'open'.
   */
  modus(): 'open' | 'secure' {
    return this.effectiveMode();
  }
```

- [ ] **Step 4: Test laufen lassen (grün)**

```
npm run selftest -w @jm/suite-control-protocol; echo "Exit=$?"
npm run selftest -w @jm/suite-control-protocol 2>&1 | grep -cE '^\s*ok\b'
```
Erwartet (gemessen): `ALLE TESTS OK`, `Exit=0`, `80`.

- [ ] **Step 5: Verhalten von `modus()` über ein Bündel prüfen (ohne Socket, nichts im Repo)**

```
SP='<eigener Scratchpad>'; [ -d "$SP" ] && { P="$SP/probe-modus"; mkdir -p "$P"; S="$(pwd -W)/packages/suite-control-protocol/src/server.ts"
printf '%s\n' \
  "import { SuiteControlServer } from '$S';" \
  "const neu = (o: Record<string, unknown>) => new SuiteControlServer({ role: 'titler', appId: 'jm-titler', getState: () => ({ ns: 'titler', kv: {} }), onCommand: () => {}, advertiseService: false, ...o } as never);" \
  "const gelesen = (o: Record<string, unknown>) => { const s = neu(o); (s as unknown as { resolve(): void }).resolve(); return s.modus(); };" \
  "console.log('vor start (mode secure):', neu({ mode: 'secure' }).modus());" \
  "console.log('mode secure:', gelesen({ mode: 'secure' }), '| bindHost 0.0.0.0:', gelesen({ bindHost: '0.0.0.0' }), '| bindHost 127.0.0.1:', gelesen({ bindHost: '127.0.0.1' }), '| ohne:', gelesen({}));" \
  > "$P/probe.ts"
npx esbuild "$P/probe.ts" --bundle --platform=node --format=cjs --log-level=warning --outfile="$P/probe.cjs" && node "$P/probe.cjs"; echo "Exit=$?"
rm -r "$P"; }
```
`resolve()` ist der private Schritt aus `start()`, der die Optionen zusammenführt (ohne `appDataDir` liest er keine Datei);
die Probe ruft ihn direkt, damit kein Socket entsteht. Erwartet (gemessen; der Ordner `probe-modus` ist danach wieder weg):
```
vor start (mode secure): open
mode secure: secure | bindHost 0.0.0.0: secure | bindHost 127.0.0.1: open | ohne: open
Exit=0
```

- [ ] **Step 6: Fehlschlagenden Test im Titler schreiben**

Einfügen in `apps/titler/test/selftest.ts` direkt vor der Zeile `if (failed > 0) {`:
```ts
// ── UX-Pilot C3 · Fernsteuerungs-Meldung (Spec 3.9, 7.2; N2, E6) ──
{
  const { readFileSync } = await import('node:fs');
  const { STEUER_PORT, naechsteFernsteuerung, portBelegt } = await import('../src/shared/fernsteuerung');
  type Meldung = ReturnType<typeof naechsteFernsteuerung>;
  type Ereignis = Parameters<typeof naechsteFernsteuerung>[1];
  const folge = (...es: Ereignis[]): Meldung | undefined => es.reduce<Meldung | undefined>((m, e) => naechsteFernsteuerung(m, e), undefined);
  const gleich = (ist: unknown, soll: unknown): boolean => JSON.stringify(ist) === JSON.stringify(soll);
  const BELEGT = 'listen EADDRINUSE: address already in use :::8726';

  ok(STEUER_PORT === 8726, 'Fernsteuerung: STEUER_PORT ist 8726');
  // Port belegt, Reihenfolge wie im Server: erst der Status (running false, Port 0), dann das Start-Ergebnis.
  const belegt = folge({ art: 'status', running: false, port: 0, clients: 0 }, { art: 'start', ok: false, error: BELEGT });
  ok(gleich(belegt, { laeuft: false, port: 8726, clients: 0, fehler: BELEGT }), 'Fernsteuerung: Port belegt → läuft nicht, Port 8726 statt 0, 0 Clients, Fehler wörtlich');
  ok(portBelegt(belegt), 'Fernsteuerung: portBelegt bei EADDRINUSE');
  // Läuft, Reihenfolge wie im Server: Status (running), Start-Ergebnis; danach melden sich zwei Clients.
  const laeuft = folge(
    { art: 'status', running: true, port: 8726, clients: 0, modus: 'secure' },
    { art: 'start', ok: true },
    { art: 'status', running: true, port: 8726, clients: 2, modus: 'secure' },
  );
  ok(gleich(laeuft, { laeuft: true, port: 8726, clients: 2, modus: 'secure' }), 'Fernsteuerung: läuft, 2 Clients, Modus secure, kein Fehler');
  ok(gleich(folge({ art: 'start', ok: true }, { art: 'status', running: true, port: 8726, clients: 2, modus: 'secure' }), laeuft), 'Fernsteuerung: Start-Ergebnis vor dem Status ergibt dasselbe Ende');
  ok(gleich(folge({ art: 'start', ok: true }), { laeuft: true, port: 8726, clients: 0 }), 'Fernsteuerung: nur Start-Ergebnis → läuft, Port 8726, 0 Clients, ohne Modus');
  // Wurf in startControlServer: Fehlertext wörtlich, kein „Port belegt“; ein laufender Status räumt den Fehler weg.
  const wurf = folge({ art: 'wurf', text: 'x' });
  ok(gleich(wurf, { laeuft: false, port: 8726, clients: 0, fehler: 'x' }) && !portBelegt(wurf), 'Fernsteuerung: Wurf → Fehler wörtlich, portBelegt false');
  ok(gleich(naechsteFernsteuerung(wurf, { art: 'status', running: true, port: 8726, clients: 0, modus: 'open' }), { laeuft: true, port: 8726, clients: 0, modus: 'open' }), 'Fernsteuerung: Status running nach Fehler → Fehler weg');
  // Der Fehler bleibt, bis der Server läuft; ohne Text „unbekannt“.
  ok(gleich(naechsteFernsteuerung(belegt, { art: 'status', running: false, port: 0, clients: 0 }), belegt), 'Fernsteuerung: Status ohne running nach Fehler → Fehler bleibt, Port 8726');
  ok(gleich(folge({ art: 'start', ok: false }), { laeuft: false, port: 8726, clients: 0, fehler: 'unbekannt' })
    && folge({ art: 'start', ok: false, error: '  ' })?.fehler === 'unbekannt'
    && folge({ art: 'wurf', text: '' })?.fehler === 'unbekannt', 'Fernsteuerung: Startfehler oder Wurf ohne Text → unbekannt');
  // Modus und Port bleiben; Clients nur bei laufendem Server.
  ok(gleich(naechsteFernsteuerung(laeuft, { art: 'status', running: true, port: 8726, clients: 1 }), { laeuft: true, port: 8726, clients: 1, modus: 'secure' }), 'Fernsteuerung: Status ohne Modus behält den Modus');
  ok(naechsteFernsteuerung(laeuft, { art: 'start', ok: false, error: BELEGT }).clients === 0, 'Fernsteuerung: nach einem Startfehler 0 Clients');
  ok(gleich(naechsteFernsteuerung(laeuft, { art: 'status', running: false, port: 0, clients: 2 }), { laeuft: false, port: 8726, clients: 0, modus: 'secure' }), 'Fernsteuerung: Stopp (running false, Port 0) → 0 Clients, Port und Modus vom alten Stand');
  ok(gleich(naechsteFernsteuerung({ laeuft: true, port: 9000, clients: 1 }, { art: 'status', running: false, port: 0, clients: 0 }), { laeuft: false, port: 9000, clients: 0 }), 'Fernsteuerung: Port 0 übernimmt den zuletzt gemeldeten Port');
  ok(!portBelegt(undefined) && !portBelegt(laeuft), 'Fernsteuerung: portBelegt ohne Meldung und ohne Fehler false');

  // Quelltext-Wächter: Main und Steuerserver melden nur lesend; Port, Befehle, suiteClients und Logzeilen bleiben.
  const lies = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const cs = lies('../src/main/control-server.ts');
  const main = lies('../src/main/index.ts');
  ok(cs.includes('export const CONTROL_PORT = 8726;') && STEUER_PORT === 8726, 'Fernsteuerung: CONTROL_PORT und STEUER_PORT gleich (8726 fest)');
  const meldet = cs.indexOf("onMeldung?.({ art: 'status', ...st, modus: server?.modus() });");
  ok(meldet >= 0 && cs.indexOf('onClients?.(st.clients);') > meldet, 'Fernsteuerung: Steuerserver meldet zuerst den ganzen Status mit Modus, dann die Zahl wie bisher');
  ok(main.split('naechsteFernsteuerung(').length - 1 === 1 && main.split('meldeFernsteuerung(').length - 1 === 4, 'Fernsteuerung: Main schreibt die Meldung an einer Stelle fort, aus drei Anlässen');
  ok(main.includes('(e) => meldeFernsteuerung(e),')
    && main.includes("meldeFernsteuerung({ art: 'start', ok: r.ok, error: r.error });")
    && main.includes("meldeFernsteuerung({ art: 'wurf', text: (err as Error).message });"), 'Fernsteuerung: Anlässe Status, Start-Ergebnis und Wurf');
  const anfang = main.slice(main.indexOf('const status: TitlerStatus = {'), main.indexOf('function buildState('));
  ok(anfang.length > 0 && !anfang.includes('fernsteuerung'), 'Fernsteuerung: Startwert ohne Meldung (bis der Server meldet: unbekannt)');
  ok(main.includes('status.suiteClients = clients;') && main.includes('Titler-Steuerserver nicht gestartet:')
    && main.includes('Titler-Steuerserver fehlgeschlagen:') && main.includes('lauscht auf :${CONTROL_PORT}'), 'Fernsteuerung: suiteClients und die Logzeilen bleiben');
}

```

- [ ] **Step 7: Test laufen lassen (rot)**

```
npm run selftest -w @jm/titler; echo "Exit=$?"
```
Erwartet (gemessen): die 512 `ok`-Zeilen bis „Umlaute: Schlüsselabruf NFC gegen NFD“, dann Abbruch beim Laden:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '<worktree>\apps\titler\src\shared\fernsteuerung' imported from <worktree>\apps\titler\test\selftest.ts
…
Exit=1
```

- [ ] **Step 8: Reine Meldung anlegen**

Neue Datei `apps/titler/src/shared/fernsteuerung.ts`, ganzer Inhalt:
```ts
// ─────────────────────────────────────────────────────────────────────────────
// Fernsteuerungs-Meldung des Titlers (Suite-UX-Update Welle 0, Spec 3.9, UO3; N2 im Pilot-Plan).
//
// Rein, ohne Electron und ohne Importe: Aus den Meldungen des vorhandenen Steuerservers (Port 8726 fest)
// entsteht { laeuft, port, clients, modus?, fehler? } für den Statuseintrag „Fernsteuerung“. Der Main ruft
// naechsteFernsteuerung bei jedem Statuswechsel des Servers, beim Start-Ergebnis und bei einem Wurf; Port,
// Protokoll, Befehle und Bedienlogik bleiben unverändert (nur lesend). `clients` zählt jeden Steuerclient
// (Companion, Launcher-Health, Rundown …), nicht nur Companion.
// ─────────────────────────────────────────────────────────────────────────────

/** Steuerport des Titlers. Gleichlauf mit CONTROL_PORT in main/control-server.ts (Quelltext-Wächter im Selbsttest). */
export const STEUER_PORT = 8726;

export interface FernsteuerungMeldung {
  /** Der Steuerserver lauscht. */
  laeuft: boolean;
  /** Zuletzt gemeldeter Port; ohne Meldung mit Port (Startfehler meldet 0) STEUER_PORT. */
  port: number;
  /** Verbundene Steuerclients aller Art; 0, solange der Server nicht läuft. */
  clients: number;
  /** Wirksamer Modus (SuiteControlServer.modus()); fehlt, solange kein Status mit Modus kam. */
  modus?: 'open' | 'secure';
  /** Startfehler oder Wurf, wörtlich; fällt weg, sobald der Server läuft. */
  fehler?: string;
}

export type FernsteuerungEreignis =
  | { art: 'status'; running: boolean; port: number; clients: number; modus?: 'open' | 'secure' }
  | { art: 'start'; ok: boolean; error?: string }
  | { art: 'wurf'; text: string };

/** Felder ohne Wert fehlen im Objekt (nie undefined); Reihenfolge laeuft, port, clients, modus, fehler. */
function meldung(laeuft: boolean, port: number, clients: number, modus?: 'open' | 'secure', fehler?: string): FernsteuerungMeldung {
  const m: FernsteuerungMeldung = { laeuft, port, clients };
  if (modus !== undefined) m.modus = modus;
  if (fehler !== undefined) m.fehler = fehler;
  return m;
}

/** Fehlertext ohne Leerraum am Rand; leer → „unbekannt“. */
function fehlerText(t: string | undefined): string {
  return t?.trim() || 'unbekannt';
}

export function naechsteFernsteuerung(alt: FernsteuerungMeldung | undefined, e: FernsteuerungEreignis): FernsteuerungMeldung {
  const altPort = alt?.port ?? STEUER_PORT;
  switch (e.art) {
    case 'status':
      return meldung(e.running, e.port > 0 ? e.port : altPort, e.running ? e.clients : 0, e.modus ?? alt?.modus, e.running ? undefined : alt?.fehler);
    case 'start':
      return e.ok
        ? meldung(true, altPort, alt?.clients ?? 0, alt?.modus)
        : meldung(false, altPort, 0, alt?.modus, fehlerText(e.error));
    case 'wurf':
      return meldung(false, altPort, 0, alt?.modus, fehlerText(e.text));
  }
}

/** Port belegt: Der Startfehler enthält EADDRINUSE (Node: „listen EADDRINUSE: address already in use …“). */
export function portBelegt(m: FernsteuerungMeldung | undefined): boolean {
  return m?.fehler?.includes('EADDRINUSE') ?? false;
}
```

- [ ] **Step 9: Test laufen lassen (noch rot: nur die Wächter auf Main und Steuerserver)**

```
npm run selftest -w @jm/titler; echo "Exit=$?"
npm run selftest -w @jm/titler 2>&1 | grep -E "^FAIL"
```
Erwartet (gemessen): 530 `ok`-Zeilen (512, die 15 Prüfungen der Meldung und drei Wächter, die schon heute gelten: gleicher
Port, Startwert ohne Meldung, `suiteClients` und Logzeilen), `3 FEHLGESCHLAGEN`, `Exit=1`, genau:
```
FAIL Fernsteuerung: Steuerserver meldet zuerst den ganzen Status mit Modus, dann die Zahl wie bisher
FAIL Fernsteuerung: Main schreibt die Meldung an einer Stelle fort, aus drei Anlässen
FAIL Fernsteuerung: Anlässe Status, Start-Ergebnis und Wurf
```

- [ ] **Step 10: Statusfeld im Typ** (`apps/titler/src/shared/types.ts`)

Ersetzung 1, Vorher (`apps/titler/src/shared/types.ts`, genau einmal):
```ts
import type { DatenQuelleArt } from './datenquelle';
```

Nachher:
```ts
import type { DatenQuelleArt } from './datenquelle';
import type { FernsteuerungMeldung } from './fernsteuerung';
```

Ersetzung 2, Vorher (`apps/titler/src/shared/types.ts`, genau einmal):
```ts
  /** Anzahl verbundener Suite-Steuerclients (Companion/QA/Battle/Health-Dashboard). */
  suiteClients: number;
```

Nachher:
```ts
  /** Anzahl verbundener Suite-Steuerclients (Companion/QA/Battle/Health-Dashboard). */
  suiteClients: number;
  /**
   * Meldung des Steuerservers (Suite-UX-Update Welle 0, Spec 3.9): läuft, Port, Clients, Modus, Fehler.
   * Fehlt, solange der Server nichts gemeldet hat (Statuseintrag „Fernsteuerung“ dann „unbekannt“).
   */
  fernsteuerung?: FernsteuerungMeldung;
```

- [ ] **Step 11: Steuerserver meldet den ganzen Status** (`apps/titler/src/main/control-server.ts`)

Ersetzung 1, Vorher (`apps/titler/src/main/control-server.ts`, genau einmal):
```ts
import type { TemplateKind, TitlerRemoteCommand, TitlerRemoteState } from '@shared/types';
```

Nachher:
```ts
import type { TemplateKind, TitlerRemoteCommand, TitlerRemoteState } from '@shared/types';
import type { FernsteuerungEreignis } from '@shared/fernsteuerung';
```

Ersetzung 2, Vorher (`apps/titler/src/main/control-server.ts`, genau einmal):
```ts
  onLocal?: (rc: TitlerRemoteCommand) => boolean,
): Promise<{ ok: boolean; error?: string; port?: number }> {
```

Nachher:
```ts
  onLocal?: (rc: TitlerRemoteCommand) => boolean,
  // Suite-UX-Update Welle 0 (Spec 3.9, N2): ganze Statusmeldung mit wirksamem Modus, nur lesend.
  onMeldung?: (e: FernsteuerungEreignis) => void,
): Promise<{ ok: boolean; error?: string; port?: number }> {
```

Ersetzung 3, Vorher (`apps/titler/src/main/control-server.ts`, genau einmal):
```ts
    // Verbundene Suite-Steuerclients (Companion/QA/Battle/Health-Dashboard) → UI.
    onStatus: (st) => onClients?.(st.clients),
```

Nachher:
```ts
    // Verbundene Suite-Steuerclients (Companion/QA/Battle/Health-Dashboard) → UI. Zuerst die ganze Meldung für
    // den Statuseintrag „Fernsteuerung“ (läuft, Port, Clients, Modus; Spec 3.9), dann die Zahl wie bisher.
    onStatus: (st) => {
      onMeldung?.({ art: 'status', ...st, modus: server?.modus() });
      onClients?.(st.clients);
    },
```

- [ ] **Step 12: Main schreibt die Meldung fort** (`apps/titler/src/main/index.ts`)

Ersetzung 1, Vorher (`apps/titler/src/main/index.ts`, genau einmal):
```ts
import { hinweisLogZeile, hinweisText, waehleHinweis } from '@shared/datalink-kern';
```

Nachher:
```ts
import { hinweisLogZeile, hinweisText, waehleHinweis } from '@shared/datalink-kern';
import { naechsteFernsteuerung, type FernsteuerungEreignis } from '@shared/fernsteuerung';
```

Ersetzung 2, Vorher (`apps/titler/src/main/index.ts`, genau einmal):
```ts
function broadcastStatus(): void {
  // An alle Fenster (Operator, Recall-Board, Output) — alle spiegeln den Zustand.
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('titler:status', status);
  }
}
```

Nachher:
```ts
function broadcastStatus(): void {
  // An alle Fenster (Operator, Recall-Board, Output) — alle spiegeln den Zustand.
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('titler:status', status);
  }
}

/** Meldung „Fernsteuerung“ fortschreiben und senden (Suite-UX-Update Welle 0, Spec 3.9, N2; nur lesend). */
function meldeFernsteuerung(e: FernsteuerungEreignis): void {
  status.fernsteuerung = naechsteFernsteuerung(status.fernsteuerung, e);
  broadcastStatus();
}
```

Ersetzung 3, Vorher (`apps/titler/src/main/index.ts`, genau einmal):
```ts
          return false;
        },
      );
      if (!r.ok) getLog().warn(`Titler-Steuerserver nicht gestartet: ${r.error ?? 'unbekannt'}`);
      else getLog().info(`Titler-Steuerserver (Companion) lauscht auf :${CONTROL_PORT}`);
    } catch (err) {
      getLog().warn(`Titler-Steuerserver fehlgeschlagen: ${(err as Error).message}`);
    }
```

Nachher:
```ts
          return false;
        },
        // Suite-UX-Update Welle 0 (Spec 3.9, N2): jeder Statuswechsel des Servers für den Statuseintrag „Fernsteuerung“.
        (e) => meldeFernsteuerung(e),
      );
      meldeFernsteuerung({ art: 'start', ok: r.ok, error: r.error });
      if (!r.ok) getLog().warn(`Titler-Steuerserver nicht gestartet: ${r.error ?? 'unbekannt'}`);
      else getLog().info(`Titler-Steuerserver (Companion) lauscht auf :${CONTROL_PORT}`);
    } catch (err) {
      meldeFernsteuerung({ art: 'wurf', text: (err as Error).message });
      getLog().warn(`Titler-Steuerserver fehlgeschlagen: ${(err as Error).message}`);
    }
```

- [ ] **Step 13: Test laufen lassen (grün)**

```
npm run selftest -w @jm/titler; echo "Exit=$?"
npm run selftest -w @jm/titler 2>&1 | grep -cE '^\s*ok\b'
npm run typecheck -w @jm/titler; echo "Exit=$?"
```
Erwartet (gemessen): `ALLE TESTS OK`, `Exit=0`, `533` (512 + 21 Zeilen `ok   Fernsteuerung: …`); die Typprüfung des
Titlers zeigt nur die npm-Kopfzeilen (`typecheck`, `typecheck:node`, `typecheck:web`), `Exit=0` (6 s). Die volle Typprüfung
folgt in Step 15.

- [ ] **Step 14: Gegenprobe (nicht committen)**

Je eine Änderung, Lauf, zurückbauen:

| Datei | Änderung (Vorher → Nachher) | Lauf | erwartet (gemessen) |
| --- | --- | --- | --- |
| `apps/titler/src/shared/fernsteuerung.ts` | `e.running ? undefined : alt?.fehler` → `alt?.fehler` | Titler-Selbsttest | `1 FEHLGESCHLAGEN`: „Fernsteuerung: Status running nach Fehler → Fehler weg“ |
| `apps/titler/src/shared/fernsteuerung.ts` | `e.port > 0 ? e.port : altPort` → `e.port` | Titler-Selbsttest | `3 FEHLGESCHLAGEN`: „Fernsteuerung: Port belegt → läuft nicht, Port 8726 statt 0, 0 Clients, Fehler wörtlich“, „Fernsteuerung: Stopp (running false, Port 0) → 0 Clients, Port und Modus vom alten Stand“, „Fernsteuerung: Port 0 übernimmt den zuletzt gemeldeten Port“ |
| `apps/titler/src/shared/fernsteuerung.ts` | `e.running ? e.clients : 0` → `e.clients` | Titler-Selbsttest | `1 FEHLGESCHLAGEN`: „Fernsteuerung: Stopp (running false, Port 0) → 0 Clients, Port und Modus vom alten Stand“ |
| `apps/titler/src/shared/fernsteuerung.ts` | `return m?.fehler?.includes('EADDRINUSE') ?? false;` → `return false;` | Titler-Selbsttest | `1 FEHLGESCHLAGEN`: „Fernsteuerung: portBelegt bei EADDRINUSE“ |
| `apps/titler/src/shared/fernsteuerung.ts` | `return t?.trim() \|\| 'unbekannt';` → `return t ?? 'unbekannt';` | Titler-Selbsttest | `1 FEHLGESCHLAGEN`: „Fernsteuerung: Startfehler oder Wurf ohne Text → unbekannt“ |
| `apps/titler/src/main/control-server.ts` | `modus: server?.modus()` → `modus: undefined` | Titler-Selbsttest | `1 FEHLGESCHLAGEN`: „Fernsteuerung: Steuerserver meldet zuerst den ganzen Status mit Modus, dann die Zahl wie bisher“ |
| `apps/titler/src/main/control-server.ts` | die zwei Zeilen in `onStatus` tauschen (erst `onClients?.(st.clients);`, dann `onMeldung?.(…);`) | Titler-Selbsttest | `1 FEHLGESCHLAGEN`: dieselbe Zeile „… meldet zuerst den ganzen Status mit Modus, dann die Zahl wie bisher“ |
| `packages/suite-control-protocol/src/server.ts` | im Getter `return this.effectiveMode();` → `return 'open';` | Steuerprotokoll-Selbsttest und Probe aus Step 5 | `1 FEHLER` („server: modus() ist öffentlich und liefert effectiveMode() unverändert“); Probe: `mode secure: open \| bindHost 0.0.0.0: open \| bindHost 127.0.0.1: open \| ohne: open` |

Danach wieder 533 (Titler) bzw. 80 (Steuerprotokoll) `ok`-Zeilen, `ALLE TESTS OK`.

- [ ] **Step 15: Typprüfung aller Workspaces** (Steuerprotokoll geändert, G10)

```
SP='<eigener Scratchpad>'; [ -d "$SP" ] && { npm run typecheck --workspaces --if-present > "$SP/tc-c3.txt" 2>&1; echo "Exit=$?"; grep -c "error TS" "$SP/tc-c3.txt"; }
```
Erwartet (gemessen): `Exit=0`, `0` (Lauf 66 s). Der Getter wird über die Typprüfung des Titlers (`typecheck:node` schließt
`src/main/control-server.ts` ein, das `server?.modus()` ruft) gegen `server.ts` geprüft; das Steuerprotokoll hat selbst kein
`typecheck`-Skript.

- [ ] **Step 16: Zeilenenden**

```
node -e "for (const f of process.argv.slice(1)) { const t = require('fs').readFileSync(f, 'utf8'); console.log(f, (t.match(/\n/g) || []).length, (t.match(/\r\n/g) || []).length); }" packages/suite-control-protocol/src/server.ts packages/suite-control-protocol/test/selftest.ts apps/titler/src/shared/fernsteuerung.ts apps/titler/src/shared/types.ts apps/titler/src/main/control-server.ts apps/titler/src/main/index.ts apps/titler/test/selftest.ts
```
Erwartet (gemessen): `packages/suite-control-protocol/src/server.ts 384 384`,
`packages/suite-control-protocol/test/selftest.ts 238 238`, `apps/titler/src/shared/fernsteuerung.ts 62 0`,
`apps/titler/src/shared/types.ts 337 337`, `apps/titler/src/main/control-server.ts 162 162`,
`apps/titler/src/main/index.ts 833 833`, `apps/titler/test/selftest.ts 1459 1459`.

- [ ] **Step 17: Commit** (Commit-Text ASCII)

```
git add packages/suite-control-protocol/src/server.ts packages/suite-control-protocol/test/selftest.ts apps/titler/src/shared/fernsteuerung.ts apps/titler/src/shared/types.ts apps/titler/src/main/control-server.ts apps/titler/src/main/index.ts apps/titler/test/selftest.ts
git status --short
```
Erwartet genau (fremde Zeilen mit `??` bleiben ungestaged):
```
M  apps/titler/src/main/control-server.ts
M  apps/titler/src/main/index.ts
A  apps/titler/src/shared/fernsteuerung.ts
M  apps/titler/src/shared/types.ts
M  apps/titler/test/selftest.ts
M  packages/suite-control-protocol/src/server.ts
M  packages/suite-control-protocol/test/selftest.ts
```
Dann:
```
git commit -m "feat(titler): Fernsteuerungs-Meldung laeuft/Port/Clients/Modus/Fehler (Suite-UX Welle 0, Spec 3.9)" -m "Der Steuerserver meldet jetzt zuerst den ganzen Status mit wirksamem Modus (neuer lesender Getter modus() in @jm/suite-control-protocol), dann wie bisher die Client-Zahl. Der Main schreibt daraus status.fernsteuerung fort (reine Funktion naechsteFernsteuerung in shared/fernsteuerung.ts) und sendet titler:status wie bisher. Start-Ergebnis und Wurf tragen den Fehler (Port belegt = EADDRINUSE). Port 8726, Befehle, STATE, suiteClients und Logzeilen bleiben; bis zur ersten Meldung fehlt das Feld (Statuseintrag unbekannt)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- **Helfer `meldeFernsteuerung(e)`** im Main: `naechsteFernsteuerung(` steht einmal, aufgerufen aus drei Anlässen (Status,
  Start-Ergebnis, Wurf). Der Wächter zählt entsprechend 1 und 4 (Definition und drei Aufrufe).
- **Leerer Fehlertext:** `error?.trim() || 'unbekannt'` gilt auch für den Wurf (Register „wie `start` mit `ok: false`“); ein
  Text aus Leerraum wird ebenfalls „unbekannt“ (eigener Fall und eigene Gegenprobe).
- **Zusätzliche Fälle:** Start-Ergebnis vor und nach dem Status, nur Start-Ergebnis, Status ohne Modus behält den Modus,
  Clients nach Startfehler 0, Stopp (`running: false`, Port 0) mit 0 Clients, Port 0 übernimmt den zuletzt gemeldeten Port,
  `portBelegt` ohne Meldung. 21 Prüfungen im Titler, 3 im Steuerprotokoll (77 → 80).
- **Test des Getters als Quelltext-Wächter** im Steuerprotokoll-Selbsttest plus eine einmalige Bündel-Probe (Step 5): Der
  Selbsttest kann `server.ts` nicht laden (gemessen, siehe „Verhalten“), `test:integration` öffnet echte Sockets und läuft
  nicht in der CI. Die Probe schreibt in den Scratchpad (G17), nicht nach `/tmp`.
- **Typprüfung des Titlers schon in Step 13**, die volle Typprüfung nach den Gegenproben (Step 15).
- **Doppelte Sendung:** Ein Statuswechsel des Servers sendet `titler:status` zweimal (über `meldeFernsteuerung`, dann über
  `onClients`); beim zweiten Mal stimmt auch `suiteClients`. Bewusst so, damit `onClients` und `suiteClients` unverändert
  bleiben.

---

### Task 4: C4 · Titler-Preload und Typen für die Master-Link-Brücke

**Spec:** 3.9 (Brücke in jedem Tool nutzbar; Freigabe je Preload), 3.8 und A.0.7 (kein `window.jm*` vorausgesetzt), 7.2
(Ablehnung heißt „unbekannt“). R2-Regel E28 (Renderer-Typ strukturgleich im Tool). Global Constraints G1, G4, G10, G11,
G12. Entscheidung E3. Review Focus 4.

**Voraussetzung:** Task 2 und Task 3 sind committet. Titler-Selbsttest 533 `ok`-Zeilen.

**Dateien:**
- Modify: `apps/titler/src/shared/types.ts` (neuer Typ `MasterLinkMeldungZeile` direkt nach `VerbundAnzeigeZeile`
  `:193-196`; zwei Felder am Ende von `JmtitlerApi`, nach `onVerbundAnzeige` `:336-337`; Zeilen nach Task 3)
- Modify: `apps/titler/src/preload/index.ts` (Typ-Import nach `:15`; zwei Felder nach `onVerbundAnzeige` `:90-95`)
- Modify: `apps/titler/test/selftest.ts` (ein Block direkt vor `if (failed > 0) {`)
- Unverändert: `apps/titler/src/renderer/src/jmtitler.d.ts` (nimmt `JmtitlerApi` aus `@shared/types`, wie R2)

**Interfaces:**
- Consumes (Task 2, S-A1): IPC-Kanal `jmps:master-link` (invoke → `MasterLinkMeldung`, Ereignis an alle Fenster),
  `import type { MasterLinkMeldung } from '@jm/app-runtime'`; für den Wächter `MASTER_LINK_KANAL` aus
  `packages/app-runtime/src/master-link-meldung.ts` (rein).
- Produces (S-A4, exakt; Block C nutzt es über `window.jmtitler`):
  ```ts
  // apps/titler/src/shared/types.ts (+)
  export type MasterLinkMeldungZeile =
    | { art: 'aus' } | { art: 'sucht' } | { art: 'verbindet'; adresse: string }
    | { art: 'verbunden'; adresse: string; seit: number; masterName: string; suite: string }
    | { art: 'fehler'; code: string; text: string; errCode?: string }
    | { art: 'ohne-client' };
  // JmtitlerApi (+), direkt nach onVerbundAnzeige
  masterLink: () => Promise<MasterLinkMeldungZeile | null>;            // invoke('jmps:master-link').catch(() => null)
  onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => () => void;
  ```
  Die Feldtypen `seit: number` und `suite: string` stehen wörtlich so in `packages/master-link/src/client.ts:25`; `code`
  ist dort `FehlerCode` (eine Vereinigung von Texten, also `string` zuweisbar).

**Verhalten (verbindlich):**
- **Freigabe nach dem R2-Muster** (`verbundAnzeige`/`onVerbundAnzeige`): zwei Felder, Kanalname als Text im Preload (kein
  Wert-Import aus `@jm/app-runtime`: das bündelte `index.ts` mit Electron-Main-Code in den Sandbox-Preload). Aus
  `@jm/app-runtime` kommt nur der Typ (`import type`, beim Bündeln entfernt; gemessen am Preload-Bündel, Step 8).
- **`null` heißt „unbekannt“**, nie „aus“: `.catch(() => null)` fängt einen fehlenden Handler (Tool mit
  `masterLink: false`, Aufruf vor `whenReady`) und jede Ablehnung. Die Abbildung auf den Statuseintrag macht `@jm/ui`
  (Block B, C5).
- **Gleichlauf der Typen ohne Laufzeitcode:** Der Preload typisiert Antwort und Ereignis mit `MasterLinkMeldung` aus
  app-runtime und gibt sie an die `JmtitlerApi`-Felder mit `MasterLinkMeldungZeile` weiter. Weicht der Titler-Typ ab,
  meldet `typecheck:node` den Fehler im Preload (Step 7). Der Renderer prüft nur gegen `MasterLinkMeldungZeile` (E28).
- **R2 bleibt:** `verbundAnzeige`/`onVerbundAnzeige` wortgleich (Durchgang `apps/launcher/test/e2e-teil2b-verbund.ts`).

---

- [ ] **Step 1: Fehlschlagenden Wächter schreiben**

Einfügen in `apps/titler/test/selftest.ts` direkt vor der Zeile `if (failed > 0) {`:
```ts
// ── UX-Pilot C4 · Preload: Master-Link-Brücke (Spec 3.9, 3.8, 7.2; E3, R2-Regel E28) ──
{
  const { readFileSync } = await import('node:fs');
  const { MASTER_LINK_KANAL } = await import('../../../packages/app-runtime/src/master-link-meldung');
  const preload = readFileSync(new URL('../src/preload/index.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const kanaele = [...preload.matchAll(/'(jmps:master[^']*)'/g)].map((m) => m[1]);
  ok(kanaele.length === 3 && kanaele.every((k) => k === MASTER_LINK_KANAL), `Preload: Kanal der Master-Link-Brücke dreimal wörtlich ${MASTER_LINK_KANAL} (invoke, on, off)`);
  ok(preload.includes("  masterLink: () => (ipcRenderer.invoke('jmps:master-link') as Promise<MasterLinkMeldung>).catch(() => null),\n"), 'Preload: Abfrage fängt jede Ablehnung zu null ab (Renderer: unbekannt, nicht aus)');
  ok(preload.includes("    ipcRenderer.on('jmps:master-link', listener);\n    return () => ipcRenderer.off('jmps:master-link', listener);\n"), 'Preload: Ereignis mit Abmeldung');
  ok(/^import type \{ MasterLinkMeldung \} from '@jm\/app-runtime';$/m.test(preload) && !/^import \{[^}]*\} from '@jm\/app-runtime'/m.test(preload), 'Preload: aus app-runtime nur der Typ (kein Main-Code im Sandbox-Preload)');
  ok(preload.includes("  verbundAnzeige: () => (ipcRenderer.invoke('jmps:verbund-anzeige') as Promise<VerbundAnzeigeZeile | null>).catch(() => null),\n  onVerbundAnzeige: (cb) => {\n    const listener = (_e: unknown, a: VerbundAnzeigeZeile | null): void => cb(a);\n    ipcRenderer.on('jmps:verbund-anzeige', listener);\n    return () => ipcRenderer.off('jmps:verbund-anzeige', listener);\n  },\n"), 'Preload: R2-Brücke verbundAnzeige/onVerbundAnzeige wortgleich (Durchgang 2b)');
}

```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/titler; echo "Exit=$?"
npm run selftest -w @jm/titler 2>&1 | grep -E "^FAIL"
```
Erwartet (gemessen): 534 `ok`-Zeilen (533 und „Preload: R2-Brücke verbundAnzeige/onVerbundAnzeige wortgleich
(Durchgang 2b)“), `4 FEHLGESCHLAGEN`, `Exit=1`, genau:
```
FAIL Preload: Kanal der Master-Link-Brücke dreimal wörtlich jmps:master-link (invoke, on, off)
FAIL Preload: Abfrage fängt jede Ablehnung zu null ab (Renderer: unbekannt, nicht aus)
FAIL Preload: Ereignis mit Abmeldung
FAIL Preload: aus app-runtime nur der Typ (kein Main-Code im Sandbox-Preload)
```

- [ ] **Step 3: Typen** (`apps/titler/src/shared/types.ts`)

Ersetzung 1, Vorher (`apps/titler/src/shared/types.ts`, genau einmal):
```ts
export interface VerbundAnzeigeZeile {
  text: string;
  farbe: 'gruen' | 'gelb' | 'rot' | 'gedaempft';
}
```

Nachher:
```ts
export interface VerbundAnzeigeZeile {
  text: string;
  farbe: 'gruen' | 'gelb' | 'rot' | 'gedaempft';
}

/**
 * Master-Link-Meldung über die Preload-Brücke (Suite-UX-Update Welle 0, Spec 3.9): Zustand des Clients oder
 * `ohne-client`. Strukturgleich mit `MasterLinkMeldung` aus `@jm/app-runtime`; eigener Typ wie
 * `VerbundAnzeigeZeile` (E28). Den Gleichlauf prüft die Typprüfung des Preloads.
 */
export type MasterLinkMeldungZeile =
  | { art: 'aus' }
  | { art: 'sucht' }
  | { art: 'verbindet'; adresse: string }
  | { art: 'verbunden'; adresse: string; seit: number; masterName: string; suite: string }
  | { art: 'fehler'; code: string; text: string; errCode?: string }
  | { art: 'ohne-client' };
```

Ersetzung 2, Vorher (`apps/titler/src/shared/types.ts`, genau einmal):
```ts
  onVerbundAnzeige: (cb: (a: VerbundAnzeigeZeile | null) => void) => () => void;
}
```

Nachher:
```ts
  onVerbundAnzeige: (cb: (a: VerbundAnzeigeZeile | null) => void) => () => void;
  /** Master-Link-Zustand (Spec 3.9): Meldung oder null (Brücke fehlt oder lehnt ab → „unbekannt“, nicht „aus“). */
  masterLink: () => Promise<MasterLinkMeldungZeile | null>;
  /** Auf Wechsel des Master-Link-Zustands hören (Main → alle Fenster, einmal auch beim Anhängen). Liefert Unsubscribe. */
  onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => () => void;
}
```

- [ ] **Step 4: Typprüfung (rot, erwartet)**

```
npm run typecheck -w @jm/titler; echo "Exit=$?"
```
Erwartet (gemessen): `typecheck:node` bricht ab, `typecheck:web` läuft nicht mehr:
```
src/preload/index.ts(24,7): error TS2739: Type '{ platform: Platform; getState: () => Promise<TitlerState>; setConfig: (patch: PartialTitlerConfig) => Promise<TitlerState>; pickDataFolder: () => Promise<string>; ... 19 more ...; onVerbundAnzeige: (cb: (a: VerbundAnzeigeZeile | null) => void) => () => IpcRenderer; }' is missing the following properties from type 'JmtitlerApi': masterLink, onMasterLink
npm error Lifecycle script `typecheck:node` failed with error:
…
Exit=2
```

- [ ] **Step 5: Preload** (`apps/titler/src/preload/index.ts`)

Ersetzung 1, Vorher (`apps/titler/src/preload/index.ts`, genau einmal):
```ts
} from '@shared/types';
```

Nachher:
```ts
} from '@shared/types';
// Nur der Typ (beim Bündeln entfernt): Ein Wert-Import aus @jm/app-runtime holte Main-Code in den Sandbox-Preload.
import type { MasterLinkMeldung } from '@jm/app-runtime';
```

Ersetzung 2, Vorher (`apps/titler/src/preload/index.ts`, genau einmal):
```ts
    ipcRenderer.on('jmps:verbund-anzeige', listener);
    return () => ipcRenderer.off('jmps:verbund-anzeige', listener);
  },
};
```

Nachher:
```ts
    ipcRenderer.on('jmps:verbund-anzeige', listener);
    return () => ipcRenderer.off('jmps:verbund-anzeige', listener);
  },
  // Suite-UX-Update Welle 0 (Spec 3.9): Master-Link-Zustand lesend. Fehlt der Handler oder lehnt invoke ab, kommt null;
  // der Renderer zeigt dann „unbekannt“ (Spec 7.2), nicht „aus“. MasterLinkMeldung (app-runtime) → MasterLinkMeldungZeile
  // (Titler): Weicht der Titler-Typ ab, meldet die Typprüfung den Fehler hier.
  masterLink: () => (ipcRenderer.invoke('jmps:master-link') as Promise<MasterLinkMeldung>).catch(() => null),
  onMasterLink: (cb) => {
    const listener = (_e: unknown, m: MasterLinkMeldung): void => cb(m);
    ipcRenderer.on('jmps:master-link', listener);
    return () => ipcRenderer.off('jmps:master-link', listener);
  },
};
```

- [ ] **Step 6: Test und Typprüfung (grün)**

```
npm run selftest -w @jm/titler; echo "Exit=$?"
npm run selftest -w @jm/titler 2>&1 | grep -cE '^\s*ok\b'
npm run typecheck -w @jm/titler; echo "Exit=$?"
```
Erwartet (gemessen): `ALLE TESTS OK`, `Exit=0`, `538` (533 + 5 Zeilen `ok   Preload: …`); die Typprüfung zeigt nur die
npm-Kopfzeilen (`typecheck`, `typecheck:node`, `typecheck:web`), `Exit=0`.

- [ ] **Step 7: Gegenprobe (nicht committen)**

Je eine Änderung, Lauf, zurückbauen:

| Datei | Änderung (Vorher → Nachher) | Lauf | erwartet (gemessen) |
| --- | --- | --- | --- |
| `apps/titler/src/shared/types.ts` | in `MasterLinkMeldungZeile` (Zeile `verbunden`) `masterName: string;` → `meisterName: string;` | `npm run typecheck -w @jm/titler` | `Exit=2`, genau zwei Fehler im Preload: `src/preload/index.ts(100,21): error TS2322: Type 'Promise<MasterLinkMeldung \| null>' is not assignable to type 'Promise<MasterLinkMeldungZeile \| null>'.` und `src/preload/index.ts(102,70): error TS2345: Argument of type 'MasterLinkMeldung' is not assignable to parameter of type 'MasterLinkMeldungZeile'.` |
| `apps/titler/src/preload/index.ts` | `ipcRenderer.on('jmps:master-link', listener);` → `ipcRenderer.on('jmps:masterlink', listener);` | Titler-Selbsttest | `2 FEHLGESCHLAGEN`: „Preload: Kanal der Master-Link-Brücke dreimal wörtlich jmps:master-link (invoke, on, off)“, „Preload: Ereignis mit Abmeldung“ |
| `apps/titler/src/preload/index.ts` | `import type { MasterLinkMeldung } from '@jm/app-runtime';` → `import { type MasterLinkMeldung } from '@jm/app-runtime';` | Titler-Selbsttest und Typprüfung | `1 FEHLGESCHLAGEN`: „Preload: aus app-runtime nur der Typ (kein Main-Code im Sandbox-Preload)“; die Typprüfung bleibt grün (`Exit=0`), nur der Wächter fängt diese Form |
| `apps/titler/src/preload/index.ts` | `.catch(() => null)` an der Master-Link-Abfrage entfernen (`as Promise<MasterLinkMeldung>).catch(() => null),` → `as Promise<MasterLinkMeldung>),`) | Titler-Selbsttest und Typprüfung | `1 FEHLGESCHLAGEN`: „Preload: Abfrage fängt jede Ablehnung zu null ab (Renderer: unbekannt, nicht aus)“; die Typprüfung bleibt grün (`Exit=0`), nur der Wächter fängt diesen Fehler |

Danach wieder `538` und Typprüfung `Exit=0`.

- [ ] **Step 8: Bau und Bündel prüfen** (`electron-vite build`, ohne Electron-Binary)

```
SP='<eigener Scratchpad>'; [ -d "$SP" ] && { npm run build -w @jm/titler > "$SP/build-c4.txt" 2>&1; echo "Exit=$?"; }
wc -c apps/titler/out/preload/index.cjs
grep -o "jmps:[a-z-]*" apps/titler/out/preload/index.cjs | sort | uniq -c
grep -o 'require("[^"]*")' apps/titler/out/preload/index.cjs | sort | uniq -c
grep -c "ipcMain\|MasterLinkClient\|planeLogAufraeumen" apps/titler/out/preload/index.cjs
git check-ignore apps/titler/out/preload/index.cjs
```
Erwartet (gemessen):
```
Exit=0
4246 apps/titler/out/preload/index.cjs
      3 jmps:master-link
      3 jmps:verbund-anzeige
      1 require("electron")
0
apps/titler/out/preload/index.cjs
```
Vor Task 4 hatte das Preload-Bündel 3622 Byte und nur `3 jmps:verbund-anzeige` (gemessen auf `5e5b234ec3` und nach
Task 2). +624 Byte sind die zwei Felder samt Kommentaren (electron-vite lässt im Preload Kommentare stehen). `0`: kein Code
aus `@jm/app-runtime` im Preload, der Typ-Import ist beim Bündeln weg. Die letzte Zeile bestätigt, dass `apps/titler/out` von
Git ignoriert wird.

- [ ] **Step 9: Zeilenenden**

```
node -e "for (const f of process.argv.slice(1)) { const t = require('fs').readFileSync(f, 'utf8'); console.log(f, (t.match(/\n/g) || []).length, (t.match(/\r\n/g) || []).length); }" apps/titler/src/shared/types.ts apps/titler/src/preload/index.ts apps/titler/test/selftest.ts
```
Erwartet (gemessen): `apps/titler/src/shared/types.ts 354 354`, `apps/titler/src/preload/index.ts 113 113`,
`apps/titler/test/selftest.ts 1472 1472`.

- [ ] **Step 10: Commit** (Commit-Text ASCII)

```
git add apps/titler/src/shared/types.ts apps/titler/src/preload/index.ts apps/titler/test/selftest.ts
git status --short
```
Erwartet genau (fremde Zeilen mit `??` bleiben ungestaged):
```
M  apps/titler/src/preload/index.ts
M  apps/titler/src/shared/types.ts
M  apps/titler/test/selftest.ts
```
Dann:
```
git commit -m "feat(titler): Preload gibt die Master-Link-Bruecke frei (window.jmtitler.masterLink, Suite-UX Welle 0)" -m "Zwei Felder nach dem Muster der R2-Verbund-Anzeige: masterLink() fragt jmps:master-link ab und faengt jede Ablehnung zu null (Renderer: unbekannt, nicht aus), onMasterLink() hoert auf Wechsel. Eigener Renderer-Typ MasterLinkMeldungZeile (E28); der Preload typisiert mit MasterLinkMeldung aus @jm/app-runtime (nur import type), so prueft typecheck:node den Gleichlauf ohne Laufzeitcode. verbundAnzeige/onVerbundAnzeige bleiben wortgleich." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- **Kommentare:** eine Kommentarzeile beim Typ-Import im Preload (warum nur `import type`), drei Kommentarzeilen bei den
  Feldern; im Typ ein Doc-Kommentar je Feld. Das Preload-Bündel wächst dadurch um 624 statt nur um die zwei Felder.
- **Zusätzliche Gegenproben:** Wert-Import-Form und fehlendes `.catch(() => null)`. Bei beiden bleibt die Typprüfung grün
  (gemessen); nur die Wächter im Selbsttest fangen sie.
- **R2-Felder wortgleich** statt nur vorhanden: Der Wächter vergleicht die sechs Zeilen von `verbundAnzeige` und
  `onVerbundAnzeige` wörtlich.

---

## Block B · Ableitungen und Titler-Testwerkzeug (Aufgaben 5–8)

**Gemeinsam für Block B (Tasks 5–8):**
- Alle Befehle im Bash-Werkzeug (Git Bash) an der Wurzel des Plan-Worktrees, alle Pfade relativ dazu (G17).
  `npm run … -w @jm/ui`, `-w @jm/settings` und `-w @jm/titler` laufen im jeweiligen Paketordner; `leseText('…')` in den Tests
  liest relativ zu `packages/ui`, `packages/settings` bzw. `apps/titler`. Ausgaben gehen nach `<eigener Scratchpad>` (vor dem
  Lauf ersetzen), nie ins Repo.
- Zählweise: `npm run selftest -w @jm/ui 2>&1 | grep -c "^ok "` (ebenso `@jm/settings`). Titler über beide Läufe
  `npm run selftest -w @jm/titler 2>&1 | grep -cE "^\s*ok\b"`, nur der zweite Lauf (Oberfläche, ab C7)
  `(cd apps/titler && npx tsx --tsconfig tsconfig.test.json test/ui/selftest.ts) 2>&1 | grep -c "^ok "`. Das `| grep`
  verschluckt den Exitcode, deshalb immer zuerst den Lauf mit `echo "Exit=$?"` lesen.
- Neue Dateien mit dem Write-Werkzeug (LF), bestehende mit dem Edit-Werkzeug (Vorher-Text exakt, genau einmal in der Datei;
  das Edit-Werkzeug behält die Zeilenenden der Datei). Vorher-Texte gelten für `5e5b234ec3` nach der vorigen Aufgabe;
  Zeilenangaben sind nur Lesehilfe.
- Zeilenenden (G11): Die Prüfzeile je Aufgabe druckt `datei zeilen crlf einheitlich|GEMISCHT`. Erwartet ist für jede Datei
  `einheitlich`, für neue Dateien `0` CRLF. Gemessen ist in einer Kopie aus `git archive` (dort alle Repo-Dateien CRLF); im
  Worktree `ux-update` liegen einige der berührten Dateien mit LF (`git ls-files --eol`: `w/lf`), dort steht dann `0`.
- Testmodule hängen sich so ein: `@jm/ui` als `import`-Zeile direkt vor `abschluss();` in `packages/ui/test/selftest.ts`;
  `@jm/settings` als Blöcke am Ende der vorhandenen Module `datalink.test.tsx` und `screen-output.test.tsx`; die
  Titler-Oberfläche als `import`-Zeile direkt vor `abschluss();` in `apps/titler/test/ui/selftest.ts` (ab C7).
- Gegenproben (G9) im Plan-Worktree vor dem Stagen: je eine Ersetzung **allein** einbauen, Lauf rot mit den genannten
  `FAIL`-Zeilen, Ersetzung genau zurücknehmen, Lauf wieder grün. Nie stagen, nie committen. Der grüne Lauf nach der letzten
  Probe und `git status --short` beim Commit zeigen, dass keine Probe stehen blieb.
- Reine Logik zuerst: C5 und C6 bauen in den Paketen nur Ableitungen und Bausteine, C7 das Testwerkzeug, C8 rechnet daraus die
  Titler-Oberfläche; erst Block C rendert sie in `OperatorView`. Keine dieser Aufgaben fasst `window.jm*`, IPC oder den
  Hauptprozess an (G2, G7).
- Zählstände über den Block (beim Zusammensetzen gemessen, nach Task 1–4):

  | Lauf | vorher (nach Task 4) | nach C5 | nach C6 | nach C7 | nach C8 |
  | --- | --- | --- | --- | --- | --- |
  | `@jm/ui` | 627 | **670** | **679** | 679 | 679 |
  | `@jm/settings` | 419 | 419 | **463** | 463 | 463 |
  | Titler, alter Lauf | 538 | 538 | 538 | 538 | 538 |
  | Titler, Oberflächen-Lauf | – | – | – | **14** | **52** |
  | Titler, beide Läufe zusammen | 538 | 538 | 538 | **552** | **590** |
  | Klassen-Probe Galerie | 20 | 20 | **20** | 20 | 20 |
  | Klassen-Probe Titler-CSS ohne `--ohne-settings` | `1 FEHLGESCHLAGEN` | – | – | **20** `ok` | 20 `ok` |

  Der alte Lauf hat 538 `ok` (512 auf `5e5b234ec3`, dazu 21 aus Task 3 und 5 aus Task 4) und ändert sich in diesem Block
  nicht. Nach der Nachbesserung der Plan-Prüfung (Befunde robust:1, robust:4, robust:6, code:2) ist der Block in einer
  frischen Kopie nach dem neu gemessenen Block A noch einmal ganz gemessen, mit allen Gegenproben: `@jm/ui` hat drei
  Prüfungen mehr (Task 5, Hook-Übergang); im Oberflächen-Lauf bleibt es bei 14 bzw. 52, nur Titel und Fallzahlen des
  iveo- und des NDI-Kreuzes in Task 8 sind neu.
- Vorher-Werte auf `5e5b234ec3`: Galerie-Probe 20 `ok` (30 settings-Klassen), Titler-Bau 50,49 kB CSS, Klassen-Probe darauf
  `1 FEHLGESCHLAGEN` (8 Klassen fehlen, 19 `ok`), mit `--ohne-settings` 19 `ok`.

---

### Task 5: C5 · `@jm/ui`: Statuseintrag „Master“ (`masterLinkStatusItem`) und Brücken-Hook (`useBrueckenWert`)

**Spec:** 3.3 (Label „Master“, `StatusItem` wörtlich, Symbol und Text je Zustand), 3.8 (kein `window.jm*` vorausgesetzt),
3.9 (lesende Master-Link-Brücke, Zustände `aus | sucht | verbindet | verbunden(masterName) | fehler(code)`), 7.1–7.4
(Kreuzprodukt, unbekannt ist nicht ok, nur Gemessenes, `live` nie in der Statusleiste). Entscheidungen E3 (Abbildung einmal
in `@jm/ui`, struktureller Typ), E4 (Stufen; kein Adress-Detail, kein Flackern; `fehler` zeigt den Client-Text in `error`),
E5 (Brücken-Hook: erst abonnieren, dann abfragen; ein Ereignis gewinnt gegen eine späte Antwort), T1 und T2 (Texte, OF8).
Fundament G4/G5 (Index nur am Ende, Bestandsschutz Zeilen 1–11). Global Constraints G5, G6, G7, G9, G10, G11, G12, G16.

**Voraussetzung:** Plan-Worktree nach C4 (Block A). `npm run selftest -w @jm/ui` grün mit **627** `ok`-Zeilen (gemessen auf
`5e5b234ec3`; Block A ändert `packages/ui` nicht). C5 braucht nichts aus Block A: Der Typ `MasterLinkMeldung` ist strukturell
(E3) und liest `@jm/app-runtime` nicht.

**Dateien:**
- Create: `packages/ui/src/lib/master-link.ts` (Typ `MasterLinkMeldung`, `masterLinkStatusItem`)
- Create: `packages/ui/src/lib/bruecke.ts` (`BrueckenQuelle`, `BrueckenStand`, `brueckenSchritt`, `verbindeBruecke`)
- Create: `packages/ui/src/lib/useBrueckenWert.ts` (Hook)
- Create: `packages/ui/test/master-link.test.ts`, `packages/ui/test/bruecke.test.ts`
- Modify: `packages/ui/src/lib/texte.ts` (neue Konstante `MASTER_LINK_TEXTE` am Dateiende)
- Modify: `packages/ui/src/index.ts` (vier Zeilen am Ende, nach `export { AppShell, … }`)
- Modify: `packages/ui/test/selftest.ts` (zwei Import-Zeilen direkt vor `abschluss();`)

**Interfaces:**
- Consumes: Fundament `unbekannt`, `StatusItem` (`src/lib/status.ts`), `UNBEKANNT` (`src/lib/texte.ts`); Testhilfe `ok`,
  `gleich`, `render`, `leseText` (`test/harness.ts`).
- Produces (Register S-B1, exakt):
  ```ts
  // packages/ui/src/lib/master-link.ts
  export type MasterLinkMeldung =
    | { art: 'aus' } | { art: 'sucht' } | { art: 'verbindet' } | { art: 'verbunden'; masterName: string }
    | { art: 'fehler'; code: string; text: string } | { art: 'ohne-client' };
  export function masterLinkStatusItem(m: MasterLinkMeldung | null | undefined): StatusItem;   // id 'master-link', group 'verbindung', label MASTER_LINK_TEXTE.label, ohne settingsSection; Stufen E4
  // packages/ui/src/lib/texte.ts (+)
  export const MASTER_LINK_TEXTE = { label: 'Master', aus: 'aus', ohneClient: 'nicht gestartet', sucht: 'sucht …', verbindet: 'verbindet …', verbunden: 'verbunden', verbundenMit: (name: string) => `verbunden mit ${name}` } as const;
  // packages/ui/src/lib/bruecke.ts
  export interface BrueckenQuelle<T> { abfrage(): Promise<T | null>; ereignis(cb: (wert: T | null) => void): () => void }
  export type BrueckenStand<T> = { art: 'offen' } | { art: 'da'; wert: T | null; durch: 'antwort' | 'ereignis' };
  export function brueckenSchritt<T>(alt: BrueckenStand<T>, e: { art: 'antwort' | 'ereignis'; wert: T | null }): BrueckenStand<T>;   // Antwort nach Ereignis verworfen
  export function verbindeBruecke<T>(quelle: BrueckenQuelle<T>, melde: (wert: T | null) => void): () => void;   // erst ereignis, dann abfrage; Ablehnung/Wurf → null; nach Abmelden still
  // packages/ui/src/lib/useBrueckenWert.ts
  export function useBrueckenWert<T>(quelle: BrueckenQuelle<T> | undefined): T | null | undefined;   // undefined = offen; ohne Quelle null; ruft verbindeBruecke im Effekt
  // dazu, nur für den Test exportiert (nicht über src/index.ts): der Zustandsübergang des Hooks
  export interface HookZustand<T> { fuer: BrueckenQuelle<T> | undefined; wert: T | null | undefined }
  export function hookSchritt<T>(alt: HookZustand<T>, quelle: BrueckenQuelle<T>, wert: T | null): HookZustand<T>;   // jede Meldung ersetzt den Wert
  export function hookWert<T>(z: HookZustand<T>, quelle: BrueckenQuelle<T> | undefined): T | null | undefined;    // ohne Quelle null, andere Quelle undefined
  export function hookAbo<T>(quelle: BrueckenQuelle<T> | undefined, setZ: (schritt: (alt: HookZustand<T>) => HookZustand<T>) => void): (() => void) | undefined;   // Körper des Effekts: jede Meldung über hookSchritt an setZ
  ```
  Neue Zeilen am Ende von `packages/ui/src/index.ts` (Fundament G4: nur neue Zeilen, Zeilen 1–11 bleiben):
  ```ts
  export { type MasterLinkMeldung, masterLinkStatusItem } from './lib/master-link';
  export { MASTER_LINK_TEXTE } from './lib/texte';
  export { type BrueckenQuelle, type BrueckenStand, brueckenSchritt, verbindeBruecke } from './lib/bruecke';
  export { useBrueckenWert } from './lib/useBrueckenWert';
  ```
  Verbraucher: C8 (`statusLeiste` ruft `masterLinkStatusItem` mit `MasterLinkMeldungZeile` aus S-A4), C9
  (`useBrueckenWert` mit den modulweiten Quellen `MASTER_LINK_QUELLE` und `VERBUND_QUELLE` aus `lib/bruecken.ts`).

**Verhalten (verbindlich):**
- `masterLinkStatusItem`: `id` `'master-link'`, `group` `'verbindung'`, `label` „Master“, **kein** `settingsSection` (es gibt
  keinen Abschnitt „Master“ im Panel). Tabelle nach E4 (12 Eingänge, Spec 7.1):

  | Eingang | state | detail |
  | --- | --- | --- |
  | `undefined` (noch keine Antwort) | `off` | „unbekannt“ |
  | `null` (keine Brücke, Ablehnung) | `off` | „unbekannt“ |
  | `ohne-client` | `warn` | „nicht gestartet“ |
  | `aus` | `off` | „aus“ |
  | `sucht` | `warn` | „sucht …“ |
  | `verbindet`, Adresse 1 | `warn` | „verbindet …“ |
  | `verbindet`, Adresse 2 | `warn` | „verbindet …“ |
  | `verbunden`, Name „Regie-PC“ | `ok` | „verbunden mit Regie-PC“ |
  | `verbunden`, Name leer | `ok` | „verbunden“ |
  | `fehler` `nicht-gefunden`, Text „Master nicht gefunden“ | `error` | „Master nicht gefunden“ |
  | `fehler` `datei`, Text „Kopplungsdatei beschädigt. Neu koppeln.“ | `error` | „Kopplungsdatei beschädigt. Neu koppeln.“ |
  | unbekannte Art (neuere app-runtime) | `off` | „unbekannt“ |

  Nie `live`; `ok` nur bei `verbunden`. Zusatzfelder des Clients (`adresse`, `seit`, `suite`, `errCode`) ändern das Item nicht.
  `fehler` ohne Text zeigt den Code.
- Alle Detailtexte kommen aus `MASTER_LINK_TEXTE` bzw. vom Client; kein Text-Literal hinter `detail:` in `master-link.ts`
  (ein Test liest den Quelltext).
- `brueckenSchritt`: Ein Ereignis gilt immer; eine Antwort gilt nur, solange noch kein Ereignis da ist, sonst bleibt der
  Stand **dasselbe Objekt** (verworfen). `null` aus einem Ereignis bleibt `null` (nicht „offen“).
- `verbindeBruecke(quelle, melde)` ist der Kern des Effekts: erst `ereignis` anmelden, dann `abfrage`. Gemeldet wird jeder
  Wert, der nach `brueckenSchritt` gilt, eine späte Antwort nach einem Ereignis also nicht. Ablehnung oder Wurf der Abfrage
  melden `null`. Nach dem Abmelden meldet die Brücke nichts mehr, und die Abmeldung der Quelle läuft genau einmal, auch bei
  doppeltem Aufruf.
- `useBrueckenWert`: ohne Quelle `null`; mit Quelle bis zur ersten Meldung `undefined`; Anmelden und Abfragen nur im Effekt
  über `verbindeBruecke`, nie beim Rendern (G7). Wechselt die Quelle, gilt bis zu deren erster Meldung wieder `undefined`.
  Die Quelle muss stabil sein (modulweite Konstante oder `useMemo`), sonst meldet sich der Hook bei jedem Rendern neu an.
  Den Zustandsübergang rechnen die reinen Funktionen `hookSchritt` (jede Meldung ersetzt den Wert; nach „verbunden“ zeigt
  ein späteres „sucht“ oder „fehler“ also nie mehr den alten Zustand) und `hookWert` (andere Quelle → `undefined`, ohne
  Quelle `null`); den Körper des Effekts `hookAbo` (verbindet die Quelle über `verbindeBruecke` und gibt jede Meldung über
  `hookSchritt` an `setZ`, auch `null` nach einem Wert). Der Hook ruft nur sie (Nachbesserung, Prüfbefund robust:4).
  Ein Verhaltenstest lässt `hookAbo` mit einer Attrappen-Quelle laufen, deren Meldungen der Test von Hand schickt, und liest
  nach jeder Meldung `hookWert`; ein Quelltext-Test prüft den ganzen Hook wörtlich, denn ohne DOM laufen seine Effekte nicht
  (letzte Nachbesserung, Restlücke R1).
- Die Quellregeln des Pakets (Fundament Task 3) gelten für die drei neuen Dateien von selbst (kein `window.jm`, kein
  `localStorage`, kein `process.`, kein Electron-/`node:`-Import).

---

- [ ] **Step 1: Fehlschlagende Tests schreiben** (Create `packages/ui/test/master-link.test.ts`)

```ts
// UX-Pilot C5 · Statuseintrag „Master“ (Spec 3.3, 3.9, 7.1–7.4): Kreuz über 12 Eingänge nach E4, nie live, ok nur bei
// verbunden, kein Flackern bei wechselnder Adresse, unbekannte Art = unbekannt, Texte nur aus MASTER_LINK_TEXTE (E3, E4, T1).
import * as ui from '../src/index';
import { masterLinkStatusItem, type MasterLinkMeldung } from '../src/lib/master-link';
import { MASTER_LINK_TEXTE } from '../src/lib/texte';
import { gleich, leseText, ok } from './harness';

type Eingang = MasterLinkMeldung | null | undefined;

// Titler-Form der Meldung (ClientZustand aus @jm/master-link): Die Adresse wechselt je Kandidat und darf nicht erscheinen.
const VERBINDET_A1 = { art: 'verbindet' as const, adresse: '10.0.0.5:8740' };
const VERBINDET_A2 = { art: 'verbindet' as const, adresse: '10.0.0.7:8740' };
const UNBEKANNTE_ART = { art: 'neu' } as unknown as MasterLinkMeldung;

// Tabelle nach E4: Eingang → {state, detail}.
const FAELLE: ReadonlyArray<[string, Eingang, string, string]> = [
  ['undefined (noch keine Antwort)', undefined, 'off', 'unbekannt'],
  ['null (keine Brücke)', null, 'off', 'unbekannt'],
  ['ohne-client', { art: 'ohne-client' }, 'warn', 'nicht gestartet'],
  ['aus', { art: 'aus' }, 'off', 'aus'],
  ['sucht', { art: 'sucht' }, 'warn', 'sucht …'],
  ['verbindet (Adresse 1)', VERBINDET_A1, 'warn', 'verbindet …'],
  ['verbindet (Adresse 2)', VERBINDET_A2, 'warn', 'verbindet …'],
  ['verbunden mit Namen', { art: 'verbunden', masterName: 'Regie-PC' }, 'ok', 'verbunden mit Regie-PC'],
  ['verbunden ohne Namen', { art: 'verbunden', masterName: '' }, 'ok', 'verbunden'],
  ['fehler nicht-gefunden', { art: 'fehler', code: 'nicht-gefunden', text: 'Master nicht gefunden' }, 'error', 'Master nicht gefunden'],
  ['fehler datei', { art: 'fehler', code: 'datei', text: 'Kopplungsdatei beschädigt. Neu koppeln.' }, 'error', 'Kopplungsdatei beschädigt. Neu koppeln.'],
  ['unbekannte Art (neuere app-runtime)', UNBEKANNTE_ART, 'off', 'unbekannt'],
];

for (const [name, eingang, state, detail] of FAELLE) {
  const item = masterLinkStatusItem(eingang);
  gleich({ state: item.state, detail: item.detail }, { state, detail }, `Master: ${name} → ${state} „${detail}“`);
}

{
  const items = FAELLE.map(([, eingang]) => masterLinkStatusItem(eingang));
  ok(
    items.every((i) => i.id === 'master-link' && i.group === 'verbindung' && i.label === 'Master' && !('settingsSection' in i)),
    'Master: Kopf fest (id master-link, Gruppe verbindung, Label Master), kein Einstellungs-Abschnitt',
  );
  ok(
    items.every((i) => i.state !== 'live') && items.every((i, n) => (i.state === 'ok') === (FAELLE[n][1]?.art === 'verbunden')),
    'Master: nie live, ok genau bei verbunden (Spec 7.2, 7.4)',
  );
}

{
  gleich(masterLinkStatusItem(VERBINDET_A1), masterLinkStatusItem(VERBINDET_A2), 'Master: verbindet mit anderer Adresse ergibt dasselbe Item (kein Flackern)');
  const voll = { art: 'verbunden' as const, adresse: '10.0.0.5:8740', seit: 1000, masterName: 'Regie-PC', suite: 'JM Production Suite' };
  gleich(masterLinkStatusItem(voll), masterLinkStatusItem({ art: 'verbunden', masterName: 'Regie-PC' }), 'Master: Zusatzfelder des Clients (Adresse, seit, suite) erscheinen nicht');
  const mitCode = { art: 'fehler' as const, code: 'verweigert', text: 'Master hat die Verbindung abgelehnt', errCode: 'ECONNREFUSED' };
  gleich(masterLinkStatusItem(mitCode).detail, 'Master hat die Verbindung abgelehnt', 'Master: fehler zeigt den Client-Text, nicht errCode');
  gleich(masterLinkStatusItem({ art: 'fehler', code: 'zeit', text: '' }).detail, 'zeit', 'Master: fehler ohne Text zeigt den Code');
}

{
  gleich(
    [MASTER_LINK_TEXTE.label, MASTER_LINK_TEXTE.aus, MASTER_LINK_TEXTE.ohneClient, MASTER_LINK_TEXTE.sucht, MASTER_LINK_TEXTE.verbindet, MASTER_LINK_TEXTE.verbunden, MASTER_LINK_TEXTE.verbundenMit('Regie-PC')],
    ['Master', 'aus', 'nicht gestartet', 'sucht …', 'verbindet …', 'verbunden', 'verbunden mit Regie-PC'],
    'Master: Texte wörtlich (T1, T2)',
  );
  const texte: string[] = Object.values(MASTER_LINK_TEXTE).map((t) => (typeof t === 'function' ? t('x') : t));
  ok(texte.every((t) => !t.includes('"')), 'Master: keine ASCII-Anführungszeichen in den Texten (G5)');
  const quelle = leseText('src/lib/master-link.ts');
  ok(!/detail:\s*['"`]/.test(quelle), 'Master: kein Text-Literal hinter detail: in master-link.ts (Texte nur aus MASTER_LINK_TEXTE)');
}

{
  ok(
    typeof ui.masterLinkStatusItem === 'function' && ui.MASTER_LINK_TEXTE.label === 'Master',
    'Master: Exporte aus src/index.ts (masterLinkStatusItem, MASTER_LINK_TEXTE)',
  );
}
```

Neue Datei `packages/ui/test/bruecke.test.ts`:
```ts
// UX-Pilot C5 · Brücken-Stand und -Hook (Plan E5): Ein Ereignis gewinnt gegen eine späte Antwort, Ablehnung und Wurf
// melden null, erst anmelden, dann abfragen, nach dem Abmelden nichts mehr; der Hook fasst beim Rendern nichts an (G7).
// Ohne DOM: hookAbo ist der Körper des Effekts (über verbindeBruecke), der Hook ruft ihn nur auf.
import { createElement } from 'react';
import * as ui from '../src/index';
import { brueckenSchritt, verbindeBruecke, type BrueckenQuelle, type BrueckenStand } from '../src/lib/bruecke';
import { hookAbo, hookSchritt, hookWert, useBrueckenWert, type HookZustand } from '../src/lib/useBrueckenWert';
import { gleich, leseText, ok, render } from './harness';

const OFFEN: BrueckenStand<string> = { art: 'offen' };

// ── brueckenSchritt ──
{
  gleich(brueckenSchritt(OFFEN, { art: 'antwort', wert: 'A' }), { art: 'da', wert: 'A', durch: 'antwort' }, 'Brücke: offen + Antwort → da (Antwort)');
  gleich(brueckenSchritt(OFFEN, { art: 'ereignis', wert: 'E' }), { art: 'da', wert: 'E', durch: 'ereignis' }, 'Brücke: offen + Ereignis → da (Ereignis)');
  const nachEreignis: BrueckenStand<string> = { art: 'da', wert: 'E', durch: 'ereignis' };
  ok(brueckenSchritt(nachEreignis, { art: 'antwort', wert: 'A' }) === nachEreignis, 'Brücke: Antwort nach einem Ereignis wird verworfen (Stand bleibt dasselbe Objekt)');
  gleich(
    brueckenSchritt({ art: 'da', wert: 'A', durch: 'antwort' }, { art: 'ereignis', wert: 'E2' }),
    { art: 'da', wert: 'E2', durch: 'ereignis' },
    'Brücke: ein Ereignis nach der Antwort gilt',
  );
  gleich(brueckenSchritt(nachEreignis, { art: 'ereignis', wert: 'E3' }), { art: 'da', wert: 'E3', durch: 'ereignis' }, 'Brücke: jedes weitere Ereignis gilt');
  gleich(brueckenSchritt(OFFEN, { art: 'ereignis', wert: null }), { art: 'da', wert: null, durch: 'ereignis' }, 'Brücke: null aus einem Ereignis bleibt null (nicht offen)');
}

// ── verbindeBruecke (Kern des Effekts) mit einer Attrappen-Quelle, die der Test von Hand steuert ──
// Die Attrappe hält ihren Zuhörer auch nach der Abmeldung fest (wie eine fehlerhafte Quelle): Still bleiben muss die Brücke.
function attrappe(wirft = false) {
  const reihe: string[] = [];
  let zuhoerer: ((wert: string | null) => void) | undefined;
  let loese: (wert: string | null) => void = () => {};
  let verwirf: (fehler: Error) => void = () => {};
  const quelle: BrueckenQuelle<string> = {
    abfrage: () => {
      reihe.push('abfrage');
      if (wirft) throw new Error('kein Handler');
      return new Promise<string | null>((res, rej) => {
        loese = res;
        verwirf = rej;
      });
    },
    ereignis: (cb) => {
      reihe.push('ereignis');
      zuhoerer = cb;
      return () => {
        reihe.push('ab');
      };
    },
  };
  return {
    quelle,
    reihe,
    sende: (wert: string | null) => zuhoerer?.(wert),
    antworte: (wert: string | null) => loese(wert),
    lehneAb: () => verwirf(new Error('abgelehnt')),
  };
}
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

{
  const q = attrappe();
  const gemeldet: Array<string | null> = [];
  verbindeBruecke(q.quelle, (wert) => gemeldet.push(wert));
  gleich(q.reihe, ['ereignis', 'abfrage'], 'Brücke verbinden: erst das Ereignis anmelden, dann abfragen');
  q.sende('E');
  q.antworte('A');
  await tick();
  gleich(gemeldet, ['E'], 'Brücke verbinden: Ereignis vor der Antwort gewinnt, die späte Antwort wird nicht gemeldet');
}
{
  const q = attrappe();
  const gemeldet: Array<string | null> = [];
  verbindeBruecke(q.quelle, (wert) => gemeldet.push(wert));
  q.antworte('A');
  await tick();
  gleich(gemeldet, ['A'], 'Brücke verbinden: Antwort ohne Ereignis gilt');
  q.sende('E2');
  q.sende(null);
  gleich(gemeldet, ['A', 'E2', null], 'Brücke verbinden: spätere Ereignisse gelten, auch null');
}
{
  const q = attrappe();
  const gemeldet: Array<string | null> = [];
  verbindeBruecke(q.quelle, (wert) => gemeldet.push(wert));
  q.lehneAb();
  await tick();
  gleich(gemeldet, [null], 'Brücke verbinden: abgelehnte Abfrage meldet null (nicht offen)');
}
{
  const q = attrappe(true);
  const gemeldet: Array<string | null> = [];
  verbindeBruecke(q.quelle, (wert) => gemeldet.push(wert));
  await tick();
  gleich(gemeldet, [null], 'Brücke verbinden: wirft die Abfrage, meldet null');
}
{
  const q = attrappe();
  const gemeldet: Array<string | null> = [];
  const ab = verbindeBruecke(q.quelle, (wert) => gemeldet.push(wert));
  ab();
  ab();
  q.sende('E');
  q.antworte('A');
  await tick();
  ok(
    gemeldet.length === 0 && q.reihe.filter((r) => r === 'ab').length === 1,
    'Brücke verbinden: nach dem Abmelden nichts mehr gemeldet, Abmeldung der Quelle genau einmal',
  );
}

// ── Hook beim Rendern (renderToStaticMarkup: Effekte laufen nicht) ──
{
  function Probe({ quelle }: { quelle?: BrueckenQuelle<string> }): React.JSX.Element {
    const wert = useBrueckenWert(quelle);
    return createElement('span', null, wert === undefined ? 'offen' : wert === null ? 'null' : wert);
  }
  gleich(render(createElement(Probe, {})), '<span>null</span>', 'Brücken-Hook: ohne Quelle null');
  const q = attrappe();
  gleich(render(createElement(Probe, { quelle: q.quelle })), '<span>offen</span>', 'Brücken-Hook: mit Quelle beim Server-Render undefined (offen)');
  gleich(q.reihe, [], 'Brücken-Hook: beim Rendern weder angemeldet noch abgefragt (nur im Effekt, G7)');
  // Ohne DOM laufen die Effekte des Hooks nicht. Darum steht er hier wörtlich: Er ruft im Effekt nur hookAbo und liefert
  // hookWert. Jeder eigene Übergang im Hook (eine Meldung auslassen, den ersten Wert halten) ändert diesen Text.
  const hook = leseText('src/lib/useBrueckenWert.ts');
  const koerper = /export function useBrueckenWert<T>[\s\S]*?\n\}/.exec(hook)?.[0] ?? '';
  gleich(
    koerper.split('\n').map((z) => z.trim()),
    [
      'export function useBrueckenWert<T>(quelle: BrueckenQuelle<T> | undefined): T | null | undefined {',
      'const [z, setZ] = useState<HookZustand<T>>({ fuer: quelle, wert: undefined });',
      'useEffect(() => hookAbo(quelle, setZ), [quelle]);',
      'return hookWert(z, quelle);',
      '}',
    ],
    'Brücken-Hook: der Hook wörtlich (Effekt nur hookAbo, Rückgabe hookWert; kein eigener Übergang im Hook)',
  );
}

// ── Effekt des Hooks über mehrere Meldungen: hookAbo mit der Attrappe; setZ wendet den Schritt an wie React ──
{
  const q = attrappe();
  let z: HookZustand<string> = { fuer: q.quelle, wert: undefined };
  // String(…), damit undefined und null im Vergleich verschieden bleiben (JSON macht aus beiden null).
  const verlauf: string[] = [String(hookWert(z, q.quelle))];
  const ab = hookAbo(q.quelle, (schritt) => {
    z = schritt(z);
    verlauf.push(String(hookWert(z, q.quelle)));
  });
  q.antworte('verbunden');
  await tick();
  q.sende('sucht');
  q.sende('fehler');
  q.sende(null);
  gleich(
    [q.reihe, verlauf],
    [
      ['ereignis', 'abfrage'],
      ['undefined', 'verbunden', 'sucht', 'fehler', 'null'],
    ],
    'Brücken-Hook (Effekt hookAbo): angemeldet, dann abgefragt; Antwort verbunden, dann sucht, fehler, null: jede Meldung ersetzt den Wert, auch null nach einem Wert',
  );
  const vorAb = verlauf.length;
  ab?.();
  q.sende('spät');
  const ohne: string[] = [];
  gleich(
    [verlauf.length - vorAb, q.reihe.filter((r) => r === 'ab').length, String(hookAbo(undefined, () => void ohne.push('x'))), ohne.length],
    [0, 1, 'undefined', 0],
    'Brücken-Hook (Effekt hookAbo): nach dem Abmelden bleibt der Wert, ohne Quelle meldet er nichts an',
  );
  gleich(
    [hookWert(z, attrappe().quelle), hookWert(z, undefined)].map(String),
    ['undefined', 'null'],
    'Brücken-Hook: neue Quelle → undefined (der Wert der alten Quelle gilt nicht), ohne Quelle null',
  );
}

{
  ok(
    typeof ui.brueckenSchritt === 'function' && typeof ui.verbindeBruecke === 'function' && typeof ui.useBrueckenWert === 'function',
    'Brücke: Exporte aus src/index.ts (brueckenSchritt, verbindeBruecke, useBrueckenWert)',
  );
}
```

Einfügen in `packages/ui/test/selftest.ts` direkt vor der Zeile `abschluss();`:
```ts
import './master-link.test';
import './bruecke.test';
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen; `tsx` bricht beim Laden ab, es läuft kein Test):
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '<worktree>\packages\ui\src\lib\master-link' imported from <worktree>\packages\ui\test\master-link.test.ts
…
Exit=1
```

- [ ] **Step 3: Texte anhängen** (`packages/ui/src/lib/texte.ts`, Dateiende)

Vorher:
```ts
  kuerzel: 'Kürzel',
  uhrzeit: 'Uhrzeit',
} as const;
```
Nachher:
```ts
  kuerzel: 'Kürzel',
  uhrzeit: 'Uhrzeit',
} as const;

/**
 * Statuseintrag „Master“ (Spec 3.3: Label „Master“; Detailtexte T1, Owner-Freigabe OF8). „verbindet …“ ohne Adresse:
 * Der Client wechselt beim Verbinden je Kandidat die Adresse, die Statusleiste soll nicht flackern (E4).
 */
export const MASTER_LINK_TEXTE = {
  label: 'Master',
  aus: 'aus',
  ohneClient: 'nicht gestartet',
  sucht: 'sucht …',
  verbindet: 'verbindet …',
  verbunden: 'verbunden',
  verbundenMit: (name: string) => `verbunden mit ${name}`,
} as const;
```

- [ ] **Step 4: Statuseintrag** (Neue Datei `packages/ui/src/lib/master-link.ts`)

```ts
// Statuseintrag „Master“ aus der lesenden Master-Link-Brücke (Suite-UX-Update, Spec 3.3, 3.9, 7.1–7.4; Plan E3, E4).
// MasterLinkMeldung ist ein struktureller Typ: Er passt zu MasterLinkMeldung aus @jm/app-runtime (ClientZustand oder
// „ohne-client“), ohne app-runtime (Electron-Typen) einzulesen. Zusatzfelder des Clients (adresse, seit, suite, errCode)
// erscheinen nicht: Die Adresse wechselt beim Verbinden je Kandidat, die Statusleiste soll nicht flackern.
// Unbekannt (keine Brücke, noch keine Antwort, unbekannte Art) ist off mit „unbekannt“, nie ok (Spec 7.2); live nie (7.4).
// „ohne-client“ ist warn: Der Tool-Rechner sollte einen Client haben, hat aber keinen gestartet (E4).
import { unbekannt, type StatusItem } from './status';
import { MASTER_LINK_TEXTE } from './texte';

export type MasterLinkMeldung =
  | { art: 'aus' }
  | { art: 'sucht' }
  | { art: 'verbindet' }
  | { art: 'verbunden'; masterName: string }
  | { art: 'fehler'; code: string; text: string }
  | { art: 'ohne-client' };

const KOPF = { id: 'master-link', group: 'verbindung', label: MASTER_LINK_TEXTE.label } as const;

/** Statuseintrag „Master“: Gruppe verbindung, ohne Einstellungs-Abschnitt (im Panel gibt es keinen). */
export function masterLinkStatusItem(m: MasterLinkMeldung | null | undefined): StatusItem {
  if (m === null || m === undefined) return unbekannt(KOPF);
  switch (m.art) {
    case 'ohne-client':
      return { ...KOPF, state: 'warn', detail: MASTER_LINK_TEXTE.ohneClient };
    case 'aus':
      return { ...KOPF, state: 'off', detail: MASTER_LINK_TEXTE.aus };
    case 'sucht':
      return { ...KOPF, state: 'warn', detail: MASTER_LINK_TEXTE.sucht };
    case 'verbindet':
      return { ...KOPF, state: 'warn', detail: MASTER_LINK_TEXTE.verbindet };
    case 'verbunden': {
      const name = typeof m.masterName === 'string' ? m.masterName.trim() : '';
      return { ...KOPF, state: 'ok', detail: name === '' ? MASTER_LINK_TEXTE.verbunden : MASTER_LINK_TEXTE.verbundenMit(name) };
    }
    case 'fehler': {
      // Fertiger Text des Clients, Stufe error für jeden Code, auch nicht-gefunden (E4); ohne Text der Code.
      const text = typeof m.text === 'string' ? m.text.trim() : '';
      return { ...KOPF, state: 'error', detail: text !== '' ? text : m.code };
    }
    default:
      return unbekannt(KOPF);
  }
}
```

- [ ] **Step 5: Brücken-Stand** (Neue Datei `packages/ui/src/lib/bruecke.ts`)

```ts
// Lesende Status-Brücke im Renderer (Suite-UX-Update, Spec 3.8, 3.9, 7.2; Plan E5). Eine Quelle hat eine Abfrage (eine
// Antwort) und ein Ereignis (jede Änderung). Die Antwort kann nach einem Ereignis ankommen, das später entstand; sie ist
// dann älter und wird verworfen. Kein window.jm*: Die App reicht die Quelle herein.

export interface BrueckenQuelle<T> {
  abfrage(): Promise<T | null>;
  ereignis(cb: (wert: T | null) => void): () => void;
}

export type BrueckenStand<T> = { art: 'offen' } | { art: 'da'; wert: T | null; durch: 'antwort' | 'ereignis' };

/** Ein Schritt: Ein Ereignis gilt immer; eine Antwort nur, solange noch kein Ereignis da ist (sonst bleibt der Stand). */
export function brueckenSchritt<T>(alt: BrueckenStand<T>, e: { art: 'antwort' | 'ereignis'; wert: T | null }): BrueckenStand<T> {
  if (e.art === 'antwort' && alt.art === 'da' && alt.durch === 'ereignis') return alt;
  return { art: 'da', wert: e.wert, durch: e.art };
}

/**
 * Kern des Effekts in useBrueckenWert: erst das Ereignis anmelden, dann abfragen (ein Ereignis zwischen Anfrage und
 * Antwort geht so nicht verloren). Gemeldet wird jeder Wert, der nach brueckenSchritt gilt, eine späte Antwort nach einem
 * Ereignis also nicht. Eine Ablehnung oder ein Wurf der Abfrage meldet null. Rückgabe: abmelden; danach meldet die Brücke
 * nichts mehr, und die Abmeldung der Quelle läuft genau einmal.
 */
export function verbindeBruecke<T>(quelle: BrueckenQuelle<T>, melde: (wert: T | null) => void): () => void {
  let aktiv = true;
  let stand: BrueckenStand<T> = { art: 'offen' };
  const schritt = (e: { art: 'antwort' | 'ereignis'; wert: T | null }): void => {
    if (!aktiv) return;
    const neu = brueckenSchritt(stand, e);
    if (neu === stand) return;
    stand = neu;
    melde(e.wert);
  };
  const ab = quelle.ereignis((wert) => schritt({ art: 'ereignis', wert }));
  let antwort: Promise<T | null>;
  try {
    antwort = Promise.resolve(quelle.abfrage());
  } catch {
    antwort = Promise.resolve(null);
  }
  antwort.then(
    (wert) => schritt({ art: 'antwort', wert }),
    () => schritt({ art: 'antwort', wert: null }),
  );
  return () => {
    if (!aktiv) return;
    aktiv = false;
    ab();
  };
}
```

- [ ] **Step 6: Brücken-Hook** (Neue Datei `packages/ui/src/lib/useBrueckenWert.ts`)

```ts
// Hook zur lesenden Status-Brücke (Plan E5): undefined, solange weder Antwort noch Ereignis da ist (die App zeigt dann
// „unbekannt“), null ohne Quelle oder bei Ablehnung, sonst der zuletzt gemeldete Wert. Eine späte Antwort nach einem
// Ereignis meldet verbindeBruecke gar nicht erst. Anmelden und Abfragen nur im Effekt, nie beim Rendern (Render-Tests
// laufen ohne window). Die Quelle muss stabil sein (modulweite Konstante oder useMemo), sonst meldet sich der Hook bei
// jedem Rendern neu an. Den Zustandsübergang rechnen hookSchritt und hookWert, den Körper des Effekts hookAbo: rein und
// ohne DOM getestet; der Hook selbst ruft nur sie.
import { useEffect, useState } from 'react';
import { verbindeBruecke, type BrueckenQuelle } from './bruecke';

/** Was der Hook sich merkt: den zuletzt gemeldeten Wert und die Quelle, für die er gilt. */
export interface HookZustand<T> {
  fuer: BrueckenQuelle<T> | undefined;
  wert: T | null | undefined;
}

/** Zustandsübergang bei einer Meldung: Jede Meldung ersetzt den Wert, auch „sucht“ oder null nach „verbunden“. */
export function hookSchritt<T>(_alt: HookZustand<T>, quelle: BrueckenQuelle<T>, wert: T | null): HookZustand<T> {
  return { fuer: quelle, wert };
}

/** Rückgabe des Hooks: ohne Quelle null; für eine neue Quelle undefined, denn was die alte meldete, gilt nicht mehr. */
export function hookWert<T>(z: HookZustand<T>, quelle: BrueckenQuelle<T> | undefined): T | null | undefined {
  if (!quelle) return null;
  return z.fuer === quelle ? z.wert : undefined;
}

/**
 * Körper des Effekts: verbindet die Quelle (erst anmelden, dann abfragen) und gibt jede Meldung über hookSchritt an setZ
 * weiter, auch „sucht“ oder null nach einem Wert. Ohne Quelle meldet er nichts an. Rückgabe: abmelden.
 */
export function hookAbo<T>(
  quelle: BrueckenQuelle<T> | undefined,
  setZ: (schritt: (alt: HookZustand<T>) => HookZustand<T>) => void,
): (() => void) | undefined {
  if (!quelle) return undefined;
  return verbindeBruecke(quelle, (wert) => setZ((alt) => hookSchritt(alt, quelle, wert)));
}

export function useBrueckenWert<T>(quelle: BrueckenQuelle<T> | undefined): T | null | undefined {
  const [z, setZ] = useState<HookZustand<T>>({ fuer: quelle, wert: undefined });
  useEffect(() => hookAbo(quelle, setZ), [quelle]);
  return hookWert(z, quelle);
}
```

- [ ] **Step 7: Test laufen lassen (noch rot: Exporte fehlen)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen; davor die unveränderten „Befund:“-Zeilen des Kontrast-Tests):
```
FAIL Master: Exporte aus src/index.ts (masterLinkStatusItem, MASTER_LINK_TEXTE)
…
FAIL Brücke: Exporte aus src/index.ts (brueckenSchritt, verbindeBruecke, useBrueckenWert)

2 FEHLGESCHLAGEN
Exit=1
```
Alle übrigen 41 neuen Prüfungen sind hier schon grün (668 `ok`).

- [ ] **Step 8: Exporte anhängen** (`packages/ui/src/index.ts`, letzte Zeile)

Vorher:
```ts
export { AppShell, type AppShellProps } from './components/AppShell';
```
Nachher:
```ts
export { AppShell, type AppShellProps } from './components/AppShell';
export { type MasterLinkMeldung, masterLinkStatusItem } from './lib/master-link';
export { MASTER_LINK_TEXTE } from './lib/texte';
export { type BrueckenQuelle, type BrueckenStand, brueckenSchritt, verbindeBruecke } from './lib/bruecke';
export { useBrueckenWert } from './lib/useBrueckenWert';
```

- [ ] **Step 9: Test laufen lassen (grün)**

```
npm run selftest -w @jm/ui > <eigener Scratchpad>/c5-gruen.txt 2>&1; echo "Exit=$?"
tail -1 <eigener Scratchpad>/c5-gruen.txt
grep -c "^ok " <eigener Scratchpad>/c5-gruen.txt
grep -E "^ok   (Master|Brücke)" <eigener Scratchpad>/c5-gruen.txt
```
Erwartet (gemessen):
```
Exit=0
ALLE TESTS OK
670
ok   Master: undefined (noch keine Antwort) → off „unbekannt“
ok   Master: null (keine Brücke) → off „unbekannt“
ok   Master: ohne-client → warn „nicht gestartet“
ok   Master: aus → off „aus“
ok   Master: sucht → warn „sucht …“
ok   Master: verbindet (Adresse 1) → warn „verbindet …“
ok   Master: verbindet (Adresse 2) → warn „verbindet …“
ok   Master: verbunden mit Namen → ok „verbunden mit Regie-PC“
ok   Master: verbunden ohne Namen → ok „verbunden“
ok   Master: fehler nicht-gefunden → error „Master nicht gefunden“
ok   Master: fehler datei → error „Kopplungsdatei beschädigt. Neu koppeln.“
ok   Master: unbekannte Art (neuere app-runtime) → off „unbekannt“
ok   Master: Kopf fest (id master-link, Gruppe verbindung, Label Master), kein Einstellungs-Abschnitt
ok   Master: nie live, ok genau bei verbunden (Spec 7.2, 7.4)
ok   Master: verbindet mit anderer Adresse ergibt dasselbe Item (kein Flackern)
ok   Master: Zusatzfelder des Clients (Adresse, seit, suite) erscheinen nicht
ok   Master: fehler zeigt den Client-Text, nicht errCode
ok   Master: fehler ohne Text zeigt den Code
ok   Master: Texte wörtlich (T1, T2)
ok   Master: keine ASCII-Anführungszeichen in den Texten (G5)
ok   Master: kein Text-Literal hinter detail: in master-link.ts (Texte nur aus MASTER_LINK_TEXTE)
ok   Master: Exporte aus src/index.ts (masterLinkStatusItem, MASTER_LINK_TEXTE)
ok   Brücke: offen + Antwort → da (Antwort)
ok   Brücke: offen + Ereignis → da (Ereignis)
ok   Brücke: Antwort nach einem Ereignis wird verworfen (Stand bleibt dasselbe Objekt)
ok   Brücke: ein Ereignis nach der Antwort gilt
ok   Brücke: jedes weitere Ereignis gilt
ok   Brücke: null aus einem Ereignis bleibt null (nicht offen)
ok   Brücke verbinden: erst das Ereignis anmelden, dann abfragen
ok   Brücke verbinden: Ereignis vor der Antwort gewinnt, die späte Antwort wird nicht gemeldet
ok   Brücke verbinden: Antwort ohne Ereignis gilt
ok   Brücke verbinden: spätere Ereignisse gelten, auch null
ok   Brücke verbinden: abgelehnte Abfrage meldet null (nicht offen)
ok   Brücke verbinden: wirft die Abfrage, meldet null
ok   Brücke verbinden: nach dem Abmelden nichts mehr gemeldet, Abmeldung der Quelle genau einmal
ok   Brücken-Hook: ohne Quelle null
ok   Brücken-Hook: mit Quelle beim Server-Render undefined (offen)
ok   Brücken-Hook: beim Rendern weder angemeldet noch abgefragt (nur im Effekt, G7)
ok   Brücken-Hook: der Hook wörtlich (Effekt nur hookAbo, Rückgabe hookWert; kein eigener Übergang im Hook)
ok   Brücken-Hook (Effekt hookAbo): angemeldet, dann abgefragt; Antwort verbunden, dann sucht, fehler, null: jede Meldung ersetzt den Wert, auch null nach einem Wert
ok   Brücken-Hook (Effekt hookAbo): nach dem Abmelden bleibt der Wert, ohne Quelle meldet er nichts an
ok   Brücken-Hook: neue Quelle → undefined (der Wert der alten Quelle gilt nicht), ohne Quelle null
ok   Brücke: Exporte aus src/index.ts (brueckenSchritt, verbindeBruecke, useBrueckenWert)
```
`670` = 627 + 43; die 43 Zeilen oben sind alle neu, keine alte Zeile fehlt.
Bestandsschutz („index.ts Zeilen 1–11 unverändert“) und alle Quellregeln bleiben grün; die Quellregeln prüfen die drei
neuen Dateien unter `src/lib` von selbst mit.

- [ ] **Step 10: Gegenproben** (je eine Ersetzung allein, vorübergehend; danach mit dem Edit-Werkzeug zurücknehmen)

Jede Probe allein mit dem Edit-Werkzeug einbauen, `npm run selftest -w @jm/ui; echo "Exit=$?"` laufen lassen, die
`FAIL`-Zeilen mit der Erwartung vergleichen, die Ersetzung genau zurücknehmen (Nachher → Vorher) und wieder
`ALLE TESTS OK` sehen. Nichts davon wird gestagt.

1. `packages/ui/src/lib/master-link.ts`: `  if (m === null || m === undefined) return unbekannt(KOPF);` →
   `  if (m === null || m === undefined) return { ...KOPF, state: 'ok', detail: MASTER_LINK_TEXTE.verbunden };`
   („unbekannt als ok“). Erwartet (gemessen):
   ```
   FAIL Master: undefined (noch keine Antwort) → off „unbekannt“
        ist: {"state":"ok","detail":"verbunden"} soll: {"state":"off","detail":"unbekannt"}
   FAIL Master: null (keine Brücke) → off „unbekannt“
        ist: {"state":"ok","detail":"verbunden"} soll: {"state":"off","detail":"unbekannt"}
   FAIL Master: nie live, ok genau bei verbunden (Spec 7.2, 7.4)
   3 FEHLGESCHLAGEN
   Exit=1
   ```
2. Ebenda in `case 'verbunden'`: `return { ...KOPF, state: 'ok', detail: name === '' ?` →
   `return { ...KOPF, state: name === '' ? 'warn' : 'ok', detail: name === '' ?` („verbunden ohne Namen als warn“). Erwartet
   (gemessen): `FAIL Master: verbunden ohne Namen → ok „verbunden“` mit `ist: {"state":"warn","detail":"verbunden"}`,
   `FAIL Master: nie live, ok genau bei verbunden (Spec 7.2, 7.4)`, `2 FEHLGESCHLAGEN`, `Exit=1`.
3. Ebenda in `case 'ohne-client'`: `state: 'warn'` → `state: 'off'` („ohne-client als off“, widerspricht E4). Erwartet
   (gemessen): `FAIL Master: ohne-client → warn „nicht gestartet“` mit `ist: {"state":"off","detail":"nicht gestartet"}`,
   `1 FEHLGESCHLAGEN`, `Exit=1`.
4. `packages/ui/src/lib/bruecke.ts`: die Zeile
   `  if (e.art === 'antwort' && alt.art === 'da' && alt.durch === 'ereignis') return alt;` entfernen („späte Antwort
   übernommen“). Erwartet (gemessen):
   ```
   FAIL Brücke: Antwort nach einem Ereignis wird verworfen (Stand bleibt dasselbe Objekt)
   FAIL Brücke verbinden: Ereignis vor der Antwort gewinnt, die späte Antwort wird nicht gemeldet
        ist: ["E","A"] soll: ["E"]
   2 FEHLGESCHLAGEN
   Exit=1
   ```
5. `packages/ui/src/lib/master-link.ts`: `detail: MASTER_LINK_TEXTE.sucht` → `detail: 'sucht …'` (Text-Literal statt
   `MASTER_LINK_TEXTE`; die Tabelle bliebe grün). Erwartet (gemessen):
   `FAIL Master: kein Text-Literal hinter detail: in master-link.ts (Texte nur aus MASTER_LINK_TEXTE)`, `1 FEHLGESCHLAGEN`,
   `Exit=1`.
6. `packages/ui/src/lib/bruecke.ts` in `verbindeBruecke`: die Zeile
   `  const ab = quelle.ereignis((wert) => schritt({ art: 'ereignis', wert }));`
   hinter den `try/catch`-Block der Abfrage verschieben (erst abfragen, dann anmelden). Erwartet (gemessen; die zweite
   Meldung kommt aus dem Lauf von `hookAbo`, der dieselbe Reihenfolge sieht):
   ```
   FAIL Brücke verbinden: erst das Ereignis anmelden, dann abfragen
        ist: ["abfrage","ereignis"] soll: ["ereignis","abfrage"]
   FAIL Brücken-Hook (Effekt hookAbo): angemeldet, dann abgefragt; Antwort verbunden, dann sucht, fehler, null: jede Meldung ersetzt den Wert, auch null nach einem Wert
        ist: [["abfrage","ereignis"],["undefined","verbunden","sucht","fehler","null"]] soll: [["ereignis","abfrage"],["undefined","verbunden","sucht","fehler","null"]]
   2 FEHLGESCHLAGEN
   Exit=1
   ```
7. Ebenda den Ablehnungs-Zweig `    () => schritt({ art: 'antwort', wert: null }),` durch `    () => undefined,` ersetzen (eine
   Ablehnung ließe den Eintrag für immer „offen“). Erwartet (gemessen):
   `FAIL Brücke verbinden: abgelehnte Abfrage meldet null (nicht offen)` mit `ist: [] soll: [null]`, `1 FEHLGESCHLAGEN`,
   `Exit=1`.
8. Ebenda in der zurückgegebenen Abmeldung (`return () => { … }`) die Zeile `if (!aktiv) return;` direkt vor
   `aktiv = false;` entfernen (doppeltes Abmelden meldet die Quelle zweimal ab).
   Erwartet (gemessen): `FAIL Brücke verbinden: nach dem Abmelden nichts mehr gemeldet, Abmeldung der Quelle genau einmal`,
   `1 FEHLGESCHLAGEN`, `Exit=1`.
9. `packages/ui/src/lib/useBrueckenWert.ts` in `hookAbo`:
   `  return verbindeBruecke(quelle, (wert) => setZ((alt) => hookSchritt(alt, quelle, wert)));` →
   `  return quelle.ereignis((wert) => setZ((alt) => hookSchritt(alt, quelle, wert)));` (Effekt ohne `verbindeBruecke`,
   also ohne Abfrage und ohne Verwerfen). Erwartet (gemessen):
   ```
   FAIL Brücken-Hook (Effekt hookAbo): angemeldet, dann abgefragt; Antwort verbunden, dann sucht, fehler, null: jede Meldung ersetzt den Wert, auch null nach einem Wert
        ist: [["ereignis"],["undefined","sucht","fehler","null"]] soll: [["ereignis","abfrage"],["undefined","verbunden","sucht","fehler","null"]]
   FAIL Brücken-Hook (Effekt hookAbo): nach dem Abmelden bleibt der Wert, ohne Quelle meldet er nichts an
        ist: [1,1,"undefined",0] soll: [0,1,"undefined",0]
   2 FEHLGESCHLAGEN
   Exit=1
   ```
10. Ebenda in `hookSchritt`: `  return { fuer: quelle, wert };` →
    `  return _alt.fuer === quelle && _alt.wert !== undefined ? _alt : { fuer: quelle, wert };` (der Hook hielte den ersten
    Wert fest und zeigte nach einem Verbindungsabbruch weiter „verbunden“). Erwartet (gemessen):
    ```
    FAIL Brücken-Hook (Effekt hookAbo): angemeldet, dann abgefragt; Antwort verbunden, dann sucht, fehler, null: jede Meldung ersetzt den Wert, auch null nach einem Wert
         ist: [["ereignis","abfrage"],["undefined","verbunden","verbunden","verbunden","verbunden"]] soll: [["ereignis","abfrage"],["undefined","verbunden","sucht","fehler","null"]]
    1 FEHLGESCHLAGEN
    Exit=1
    ```
11. Ebenda in `hookWert`: `  return z.fuer === quelle ? z.wert : undefined;` → `  return z.wert;` (nach einem Quellwechsel
    stünde der Wert der alten Quelle). Erwartet (gemessen):
    `FAIL Brücken-Hook: neue Quelle → undefined (der Wert der alten Quelle gilt nicht), ohne Quelle null` mit
    `ist: ["null","null"] soll: ["undefined","null"]`, `1 FEHLGESCHLAGEN`, `Exit=1`.
12. Ebenda im Hook: `  useEffect(() => hookAbo(quelle, setZ), [quelle]);` →
    `  useEffect(() => hookAbo(quelle, (schritt) => setZ((alt) => (alt.wert !== undefined ? alt : schritt(alt)))), [quelle]);`
    (der Hook umgeht `hookAbo` und hält den ersten Wert). Erwartet (gemessen):
    ```
    FAIL Brücken-Hook: der Hook wörtlich (Effekt nur hookAbo, Rückgabe hookWert; kein eigener Übergang im Hook)
         ist: ["export function useBrueckenWert<T>(quelle: BrueckenQuelle<T> | undefined): T | null | undefined {","const [z, setZ] = useState<HookZustand<T>>({ fuer: quelle, wert: undefined });","useEffect(() => hookAbo(quelle, (schritt) => setZ((alt) => (alt.wert !== undefined ? alt : schritt(alt)))), [quelle]);","return hookWert(z, quelle);","}"] soll: ["export function useBrueckenWert<T>(quelle: BrueckenQuelle<T> | undefined): T | null | undefined {","const [z, setZ] = useState<HookZustand<T>>({ fuer: quelle, wert: undefined });","useEffect(() => hookAbo(quelle, setZ), [quelle]);","return hookWert(z, quelle);","}"]
    1 FEHLGESCHLAGEN
    Exit=1
    ```
13. Ebenda am Ende des Hooks: `  return hookWert(z, quelle);` → `  return z.wert;`. Erwartet (gemessen):
    ```
    FAIL Brücken-Hook: ohne Quelle null
         ist: "<span>offen</span>" soll: "<span>null</span>"
    FAIL Brücken-Hook: der Hook wörtlich (Effekt nur hookAbo, Rückgabe hookWert; kein eigener Übergang im Hook)
         ist: ["export function useBrueckenWert<T>(quelle: BrueckenQuelle<T> | undefined): T | null | undefined {","const [z, setZ] = useState<HookZustand<T>>({ fuer: quelle, wert: undefined });","useEffect(() => hookAbo(quelle, setZ), [quelle]);","return z.wert;","}"] soll: ["export function useBrueckenWert<T>(quelle: BrueckenQuelle<T> | undefined): T | null | undefined {","const [z, setZ] = useState<HookZustand<T>>({ fuer: quelle, wert: undefined });","useEffect(() => hookAbo(quelle, setZ), [quelle]);","return hookWert(z, quelle);","}"]
    2 FEHLGESCHLAGEN
    Exit=1
    ```
14. Ebenda in `hookAbo` (Restlücke R1, die Mutation der Nachprüfung):
    `  return verbindeBruecke(quelle, (wert) => setZ((alt) => hookSchritt(alt, quelle, wert)));` →
    `  return verbindeBruecke(quelle, (wert) => { if (wert !== null) setZ((alt) => hookSchritt(alt, quelle, wert)); });`
    (der Effekt verschluckt das Schließen der Brücke, der Eintrag zeigte weiter den alten Wert). Erwartet (gemessen):
    ```
    FAIL Brücken-Hook (Effekt hookAbo): angemeldet, dann abgefragt; Antwort verbunden, dann sucht, fehler, null: jede Meldung ersetzt den Wert, auch null nach einem Wert
         ist: [["ereignis","abfrage"],["undefined","verbunden","sucht","fehler"]] soll: [["ereignis","abfrage"],["undefined","verbunden","sucht","fehler","null"]]
    1 FEHLGESCHLAGEN
    Exit=1
    ```
15. Ebenda im Hook: `  useEffect(() => hookAbo(quelle, setZ), [quelle]);` →
    `  useEffect(() => hookAbo(quelle, (schritt) => setZ((alt) => (schritt(alt).wert === null ? alt : schritt(alt)))), [quelle]);`
    (derselbe Fehler im Hook statt im Effektkörper). Erwartet (gemessen):
    ```
    FAIL Brücken-Hook: der Hook wörtlich (Effekt nur hookAbo, Rückgabe hookWert; kein eigener Übergang im Hook)
         ist: ["export function useBrueckenWert<T>(quelle: BrueckenQuelle<T> | undefined): T | null | undefined {","const [z, setZ] = useState<HookZustand<T>>({ fuer: quelle, wert: undefined });","useEffect(() => hookAbo(quelle, (schritt) => setZ((alt) => (schritt(alt).wert === null ? alt : schritt(alt)))), [quelle]);","return hookWert(z, quelle);","}"] soll: ["export function useBrueckenWert<T>(quelle: BrueckenQuelle<T> | undefined): T | null | undefined {","const [z, setZ] = useState<HookZustand<T>>({ fuer: quelle, wert: undefined });","useEffect(() => hookAbo(quelle, setZ), [quelle]);","return hookWert(z, quelle);","}"]
    1 FEHLGESCHLAGEN
    Exit=1
    ```

Nach der letzten Probe: `npm run selftest -w @jm/ui 2>&1 | grep -c "^ok "` → `670`, `ALLE TESTS OK`.

- [ ] **Step 11: Typprüfung und Zeilenenden**

```
npm run typecheck -w @jm/ui; echo "Exit=$?"
node -e "for (const f of process.argv.slice(1)) { const t = require('fs').readFileSync(f, 'utf8'); const n = (t.match(/\n/g) || []).length, c = (t.match(/\r\n/g) || []).length; console.log(f, n, c, c === 0 || c === n ? 'einheitlich' : 'GEMISCHT'); }" packages/ui/src/lib/texte.ts packages/ui/src/index.ts packages/ui/test/selftest.ts packages/ui/src/lib/master-link.ts packages/ui/src/lib/bruecke.ts packages/ui/src/lib/useBrueckenWert.ts packages/ui/test/master-link.test.ts packages/ui/test/bruecke.test.ts
```
Erwartet (gemessen): `tsc` ohne Meldung, `Exit=0` (`tsconfig.json` von `@jm/ui` erfasst `src`, `test` und `galerie`, also
auch die beiden Testmodule); dann jede Datei `einheitlich`, die fünf neuen ohne CRLF:
```
packages/ui/src/lib/texte.ts 53 53 einheitlich
packages/ui/src/index.ts 32 32 einheitlich
packages/ui/test/selftest.ts 28 28 einheitlich
packages/ui/src/lib/master-link.ts 44 0 einheitlich
packages/ui/src/lib/bruecke.ts 50 0 einheitlich
packages/ui/src/lib/useBrueckenWert.ts 43 0 einheitlich
packages/ui/test/master-link.test.ts 74 0 einheitlich
packages/ui/test/bruecke.test.ts 183 0 einheitlich
```
Im Worktree `ux-update` liegen `texte.ts` und `test/selftest.ts` mit LF (`git ls-files --eol`: `w/lf`), `index.ts` mit CRLF;
dort steht für die beiden ersten `0`.

- [ ] **Step 12: Commit** (Bash-Werkzeug; Commit-Text ohne Umlaute)

```
git add packages/ui/src/lib/texte.ts packages/ui/src/index.ts packages/ui/test/selftest.ts packages/ui/src/lib/master-link.ts packages/ui/src/lib/bruecke.ts packages/ui/src/lib/useBrueckenWert.ts packages/ui/test/master-link.test.ts packages/ui/test/bruecke.test.ts
git status --short
```
Erwartet genau (fremde `??`-Zeilen bleiben ungestaged):
```
M  packages/ui/src/index.ts
A  packages/ui/src/lib/bruecke.ts
A  packages/ui/src/lib/master-link.ts
M  packages/ui/src/lib/texte.ts
A  packages/ui/src/lib/useBrueckenWert.ts
A  packages/ui/test/bruecke.test.ts
A  packages/ui/test/master-link.test.ts
M  packages/ui/test/selftest.ts
```
Dann:
```
git commit -m "feat(ui): Statuseintrag Master und Bruecken-Hook (UX-Pilot C5)" -m "masterLinkStatusItem bildet die Meldung der Master-Link-Bruecke (ClientZustand oder ohne-client, struktureller Typ) auf einen Statuseintrag ab: unbekannt/null off unbekannt, ohne-client warn nicht gestartet, aus off, sucht/verbindet warn ohne Adresse (kein Flackern), verbunden ok mit Namen, fehler error mit dem Client-Text; nie live, ok nur bei verbunden. verbindeBruecke meldet erst nach dem Abo, dann die Abfrage; eine spaete Antwort nach einem Ereignis wird verworfen (brueckenSchritt), Ablehnung und Wurf melden null, nach dem Abmelden nichts mehr. useBrueckenWert ruft im Effekt nur hookAbo (verbindeBruecke, jede Meldung ueber hookSchritt) und liefert hookWert; hookSchritt, hookWert und hookAbo sind rein und mit einer Attrappen-Quelle getestet (verbunden-sucht-fehler-null, Abmelden, Quellwechsel), der Hook selbst woertlich. Texte in MASTER_LINK_TEXTE, Index nur am Ende ergaenzt." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- `verbindeBruecke` hält den Brücken-Stand selbst und meldet nur Werte, die nach `brueckenSchritt` gelten; der Hook speichert
  nur noch den gemeldeten Wert. So sind „erst anmelden, dann abfragen“, „späte Antwort verworfen“, „Ablehnung = null“ und
  „nach dem Abmelden nichts mehr“ ohne DOM testbar (Muster der Fundament-Effekte, z. B. `starteUhr`). Der Effekt ruft sie
  über `hookAbo`; dass der Effekt erst anmeldet und dann abfragt, zeigt der Lauf von `hookAbo` mit der Attrappe.
- Die Abmeldung ist gegen doppelten Aufruf geschützt (React ruft Aufräumfunktionen im Strict Mode zweimal); die
  Test-Attrappe hält ihren Zuhörer nach der Abmeldung fest, damit der Test die Stille der Brücke prüft und nicht die der
  Attrappe.
- `useBrueckenWert` merkt sich, für welche Quelle der Wert gilt (`fuer`): Wechselt die Quelle, ist der Wert bis zur ersten
  Meldung der neuen Quelle wieder `undefined`, statt kurz den Wert der alten zu zeigen.
- **Nachbesserung (Prüfbefund robust:4):** Der Zustandsübergang des Hooks steht in den reinen Funktionen `hookSchritt` und
  `hookWert` (nur für den Test exportiert, nicht über `src/index.ts`). Vorher prüfte nur ein Regex, dass der Effekt
  `verbindeBruecke` ruft; ein Hook, der den ersten Wert festhält oder nach einem Quellwechsel den alten Wert liefert, blieb
  grün. Jetzt prüft ein Verlaufstest Antwort „verbunden“ → „sucht“ → „fehler“ → `null` und den Quellwechsel, ein
  Quelltext-Test die Verdrahtung im Hook; Gegenproben 10 bis 13 zeigen, dass beide den Fehler fangen.
- **Letzte Nachbesserung (Restlücke R1, NB32):** Der Quelltext-Test prüfte nur Teilstrings; ein Hook, der nach einem Wert
  die Meldung `null` (Brücke geschlossen) verschluckt, blieb grün. Der Körper des Effekts ist jetzt die reine Funktion
  `hookAbo`; der Verhaltenstest lässt sie mit der Attrappe laufen und prüft nach jeder Meldung `hookWert`, auch `null` nach
  einem Wert und die Stille nach dem Abmelden. Der Hook selbst steht im Test wörtlich (ohne DOM laufen seine Effekte nicht).
  Gegenprobe 14 ist die Mutation der Nachprüfung im Effektkörper, 15 derselbe Fehler im Hook; 9, 12 und 13 zielen auf den
  neuen Aufbau.
- Zusätzliche Fälle über die Gliederung hinaus: Zusatzfelder von `verbunden` (Adresse, seit, suite), `fehler` mit `errCode`
  und ohne Text, Ablehnung und Wurf der Abfrage, ein späteres `null`-Ereignis, doppeltes Abmelden; dazu drei Gegenproben
  mehr (`ohne-client` als `off`, Ablehnung bleibt offen, Abmelden nicht einmalig).
- Die Gegenprobe „Text in `master-link.ts` statt `texte.ts`“ fängt ein eigener Quelltext-Test (die Quellregeln des Pakets
  prüfen keine Texte).
- Block A ändert `packages/ui` nicht; die Zählstände dieser Aufgabe sind nach Task 4 gemessen und gleich denen auf
  `5e5b234ec3`.

---

### Task 6: C6 · `@jm/settings`: additive Erweiterungen für DataLink und Bildschirm (OF3, OF4, E10)

**Spec:** 6.1 (Texte fest im Paket, gesperrt nie ohne Grund, Ausblenden statt Ausgrauen über `capabilities`), 6.2 (DataLink,
Ausgabe auf Bildschirm), 7.1–7.3 (Kreuzprodukt, unbekannt ist nicht ok, nur Gemessenes), 10 (kein Funktionsverlust: Pfad von
Hand, „✕“, Farbwähler und „Reset“ des Titlers bleiben erhalten). Entscheidungen E10 (DataLink des Titlers: Daten aus der Show
ohne eigenen Ordner sind nicht „kein Ordner“, Einträge statt Dateien), OF3 (Farbwähler und Standardfarbe), OF4 (Pfadfeld und
„Ordner entfernen“), T8/T9 (Texte, OF8). Fundament E25 (nur drei fertige App-Texte im DataLink), G5. Global Constraints G1,
G5, G6, G9, G10, G11, G12, G16.

**Voraussetzung:** Plan-Worktree nach C5 (`npm run selftest -w @jm/ui` mit **670** `ok`). `npm run selftest -w @jm/settings`
grün mit **419** `ok` (gemessen auf `5e5b234ec3`; C1–C5 ändern `packages/settings` nicht). Lehnt der Owner OF3 bzw. OF4 ab,
entfällt der jeweilige Teil (Bildschirm bzw. Pfadfeld/„Ordner entfernen“) samt Tests, Galerie-Beispiel und Gegenprobe;
`externeQuelle` und `eintraege` (E10) bleiben in jedem Fall.

**Dateien:**
- Modify: `packages/settings/src/abschnitte/datalink.ts` (Props, `DATALINK_TEXTE`, Status, Sicht, neue Aktion `ordnerEntfernen`)
- Modify: `packages/settings/src/abschnitte/DataLinkSection.tsx` (Pfadfeld, Knopf „Ordner entfernen“)
- Modify: `packages/settings/src/abschnitte/screen-output.ts` (Props, `SCREEN_TEXTE`, `FARBE_MUSTER`, Sicht, Aktionen
  `standardfarbe`, `farbeGewaehlt`)
- Modify: `packages/settings/src/abschnitte/ScreenOutputSection.tsx` (Farbwähler neben dem Textfeld, Knopf „Standardfarbe“)
- Modify: `packages/settings/test/datalink.test.tsx`, `packages/settings/test/screen-output.test.tsx` (Blöcke am Ende, je eine
  Import-Zeile)
- Modify: `packages/settings/test/quellregeln.test.ts` (`backgroundDefault` als Daten-Prop, `onFolderText` als Rückruf)
- Modify: `packages/ui/galerie/beispiele-settings.tsx` (drei Beispiele), `packages/ui/test/galerie.test.tsx` (Soll-Zustände und
  Marken der drei Beispiele)
- Nicht geändert: `packages/settings/src/index.ts` (die Typen sind dieselben Exporte, nur breiter; die neuen Aktionen sind wie
  `peerSetzen` reine Funktionen der Abschnittsdatei, die Tests importieren sie relativ).

**Interfaces:**
- Consumes: Fundament `useTextEntwurf` (`src/entwurf.ts`), `istGesperrt` (`src/vertrag.ts`), `Field`, `TextInput`, `Button`
  aus `@jm/ui`; Testhilfen `kreuz`, `pruefeFaelle`, `sperrZaehlung`, `vor`, `bewegungsVerstoesse` (`test/hilfe.ts`).
- Produces (Register S-B2, additiv; alte Aufrufer bleiben unverändert und ihre Tabellen grün):
  ```ts
  // DataLinkSectionProps (+)
  externeQuelle?: boolean;                 // gemessen: Daten kommen nicht aus dem eigenen Ordner → nie „kein Ordner“
  eintraege?: number;                      // gemessen: abrufbare Einträge; gesetzt → „{n} Einträge“/„keine Einträge“ statt Dateizahl
  onClearFolder?(): void;                  // Knopf „Ordner entfernen“, nur mit Ordner; bei locked sichtbar gesperrt   [OF4]
  capabilities?: { ordnerText?: boolean }; onFolderText?(pfad: string): void;   // Pfadfeld, Text-Entwurf, Übernahme Enter/Verlassen, bei locked gesperrt   [OF4]
  // DATALINK_TEXTE (+): eintrag '1 Eintrag', eintraege (n) => `${zahlText(n)} Einträge`, keineEintraege 'keine Einträge', ordnerpfad 'Ordnerpfad', ordnerEntfernen 'Ordner entfernen'
  // DataLinkView.sichtbar (+): ordnerEntfernen: boolean; ordnerFeld: boolean
  // ScreenOutputSectionProps (+)   [OF3]
  backgroundDefault?: string;              // gültiges #RRGGBB; Knopf „Standardfarbe ({hex})“ → onBackground(backgroundDefault)
  capabilities.backgroundPicker?: boolean; // <input type="color"> neben dem Textfeld, gleiche Übernahme; nur neben gemeldetem Wert
  // SCREEN_TEXTE (+): standardfarbe (hex) => `Standardfarbe (${hex})`, farbeWaehlen 'Farbe wählen'
  // ScreenOutputView.sichtbar (+): standardfarbe: boolean; farbwaehler: boolean
  ```
  Reine Aktionen nur in ihren Dateien (Muster `peerSetzen` aus dem Fundament; nicht in `src/index.ts`):
  ```ts
  export function ordnerEntfernen(p: DataLinkSectionProps): boolean;                   // datalink.ts: meldet onClearFolder nur mit Ordner und ohne Sperre
  export const FARBE_MUSTER: RegExp;                                                   // screen-output.ts: /^#[0-9a-fA-F]{6}$/
  export function standardfarbe(p: ScreenOutputSectionProps): boolean;                 // screen-output.ts: onBackground(backgroundDefault), nur gültig und ohne Sperre
  export function farbeGewaehlt(p: ScreenOutputSectionProps, hex: string): boolean;    // screen-output.ts: onBackground(hex), nur gültig und ohne Sperre
  ```
  DataLink-Status mit den neuen Props, in dieser Reihenfolge: 1. Fehler; 2. Ordner fehlt; 3. `folder === ''` und nicht
  `externeQuelle` → „kein Ordner“; 4. Zahl (`eintraege` vor `fileCount`) unbekannt → „unbekannt“; 5. 0 → warn „keine Einträge“
  bzw. „keine Datei“; 6. sonst ok „{n} Einträge“ bzw. „{n} Dateien · hh:mm“.
  Verbraucher: C8 (`dataLinkAbschnitt`, `bildschirmAbschnitt` setzen die neuen Props), C11 (Panel rendert die Abschnitte).

**Verhalten (verbindlich):**
- DataLink-Status (neue Reihenfolge, nur mit den neuen Props anders): Fehler → Ordner fehlt → (`folder === ''` und
  `externeQuelle !== true`) „kein Ordner“ → `eintraege` gesetzt: 0 warn „keine Einträge“, 1 ok „1 Eintrag“, n ok „{n} Einträge“
  (ohne Uhrzeit) → sonst wie bisher die Dateizahl (unbekannt → „unbekannt“, 0 warn „keine Datei“, ok „{n} Dateien · hh:mm“).
  Ohne `externeQuelle` und `eintraege` gilt jede alte Erwartung unverändert (die alte Kreuztabelle bleibt Wort für Wort).
- Pfadfeld „Ordnerpfad“ nur mit `capabilities.ordnerText === true` **und** `onFolderText`; es ersetzt dann die Anzeige
  „Ordner“ (kein Wert doppelt) und steht wie alle Felder im `PanelAnker` des Abschnitts (Sprungziel aus der Statusleiste).
  Übernahme über den Text-Entwurf des Pakets (Enter oder Verlassen, Escape verwirft, nicht je Tastendruck; Befund 5 der
  Funktionsliste entfällt damit); bei `locked` sichtbar gesperrt, gesperrt meldet es nichts.
- „Ordner entfernen“ nur mit gesetztem Ordner **und** `onClearFolder`; bei `locked` sichtbar, aber gesperrt (wie „Ordner
  wählen …“). Die Aktion `ordnerEntfernen` meldet nur ohne Sperre und mit Ordner.
- Bildschirm: Farbwähler (`<input type="color">`, `aria-label` „Farbe wählen“) neben dem Textfeld nur mit
  `capabilities.background` **und** `backgroundPicker` **und** gemeldetem Wert; Knopf „Standardfarbe ({hex})“ nur mit
  `capabilities.background`, gemeldetem Wert und gültigem `backgroundDefault` (#RRGGBB). Beide gesperrt bei `locked`; beide
  melden nur gültige Farben über `onBackground`. Ein ungültiger Text im Feld bleibt Fehlertext; der Farbwähler zeigt dann
  `#000000`. Der Status des Abschnitts ändert sich durch die neuen Props nicht.
- Die Quellregeln des Pakets bleiben grün: `backgroundDefault` steht als Daten-Prop in der Liste, `onFolderText` ist ein
  Rückruf (Name endet auf „Text“, trägt aber keinen Text).

---

- [ ] **Step 1: Fehlschlagende Tests für die Abschnitte schreiben** (`packages/settings/test/datalink.test.tsx`)

Vorher:
```tsx
import { enthaelt, enthaeltNicht, gleich, ok, render } from '@jm/ui/testhilfe';
import { abschnittStatusItem, DATALINK_TEXTE, DataLinkSection, dataLinkView, type DataLinkSectionProps, type SectionStatus } from '../src/index';
```
Nachher:
```tsx
import { enthaelt, enthaeltNicht, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { abschnittStatusItem, DATALINK_TEXTE, DataLinkSection, dataLinkView, type DataLinkSectionProps, type SectionStatus } from '../src/index';
import { ordnerEntfernen } from '../src/abschnitte/datalink';
```

Vorher:
```tsx
  ok(item.state === 'off' && item.detail === 'unbekannt' && html.includes(`>${item.detail}</span>`), 'DataLink: abschnittStatusItem = Statuspille (Zustand und Text)');
}
```
Nachher:
```tsx
  ok(item.state === 'off' && item.detail === 'unbekannt' && html.includes(`>${item.detail}</span>`), 'DataLink: abschnittStatusItem = Statuspille (Zustand und Text)');
}

// ── Erweiterung für den Titler (UX-Pilot C6, E10, OF4): fremde Quelle, Einträge, Pfadfeld, „Ordner entfernen“ ──
// Tabelle 3: Zeile = folder|folderMissing|externeQuelle. ZAEHLEN heißt: Status aus Tabelle 4 (Einträge) bzw., wenn
// eintraege fehlt, aus Tabelle 2 (Dateien). Ohne die neuen Props gelten Tabelle 1 und 2 (Kreuz oben, unverändert).
const ORDNER_EXTERN: Record<string, SectionStatus | typeof ZAEHLEN> = {
  'leer|undefined|undefined': KEIN_ORDNER,
  'leer|undefined|false': KEIN_ORDNER,
  'leer|undefined|true': ZAEHLEN,
  'leer|false|undefined': KEIN_ORDNER,
  'leer|false|false': KEIN_ORDNER,
  'leer|false|true': ZAEHLEN,
  'leer|true|undefined': FEHLT,
  'leer|true|false': FEHLT,
  'leer|true|true': FEHLT,
  'gesetzt|undefined|undefined': ZAEHLEN,
  'gesetzt|undefined|false': ZAEHLEN,
  'gesetzt|undefined|true': ZAEHLEN,
  'gesetzt|false|undefined': ZAEHLEN,
  'gesetzt|false|false': ZAEHLEN,
  'gesetzt|false|true': ZAEHLEN,
  'gesetzt|true|undefined': FEHLT,
  'gesetzt|true|false': FEHLT,
  'gesetzt|true|true': FEHLT,
};
// Tabelle 4: Zeile = eintraege. DATEIEN heißt: eintraege nicht gemeldet, Tabelle 2 gilt.
const DATEIEN = 'dateien' as const;
const EINTRAEGE: Record<string, SectionStatus | typeof DATEIEN> = {
  undefined: DATEIEN,
  '0': s('warn', 'keine Einträge'),
  '1': s('ok', '1 Eintrag'),
  '5': s('ok', '5 Einträge'),
};

{
  const faelle = kreuz({
    folder: ['leer', 'gesetzt'],
    folderMissing: [undefined, false, true],
    externeQuelle: [undefined, false, true],
    eintraege: [undefined, 0, 1, 5],
    fileCount: [undefined, 0, 1, 5],
    lastChange: ['fehlt', 'gesetzt'],
    error: [undefined, 'Testfehler'],
  } as const);
  const props = (f: (typeof faelle)[number]): DataLinkSectionProps => ({
    ...basis,
    folder: f.folder === 'leer' ? '' : basis.folder,
    folderMissing: f.folderMissing,
    externeQuelle: f.externeQuelle,
    eintraege: f.eintraege,
    fileCount: f.fileCount,
    lastChange: f.lastChange === 'gesetzt' ? AENDERUNG : undefined,
    error: f.error,
  });
  pruefeFaelle('DataLink erweitert Kreuzprodukt: externeQuelle und eintraege → status aus Tabelle 3, 4 und 2', faelle, (f) => {
    const o = ORDNER_EXTERN[`${f.folder}|${f.folderMissing}|${f.externeQuelle}`];
    const e = EINTRAEGE[String(f.eintraege)];
    const soll = f.error ? FEHLER : o !== ZAEHLEN ? o : e !== DATEIEN ? e : ZAEHLUNG[`${f.fileCount}|${f.lastChange}`];
    return vergleiche(statusText(dataLinkView(props(f)).status), statusText(soll));
  });
  pruefeFaelle('DataLink erweitert: nie „0 Einträge“ oder „0 Dateien“', faelle, (f) =>
    /(^|\D)0 (Einträge|Dateien)/.test(dataLinkView(props(f)).status.text) ? 'zeigt 0' : null,
  );
  pruefeFaelle('DataLink erweitert: ok nur mit gemessener Zahl über 0 (Einträge vor Dateien)', faelle, (f) => {
    const zahl = f.eintraege !== undefined ? f.eintraege : f.fileCount;
    return dataLinkView(props(f)).status.state === 'ok' && !(typeof zahl === 'number' && zahl > 0) ? 'ok ohne Zahl' : null;
  });
}

{
  gleich(
    [DATALINK_TEXTE.eintrag, DATALINK_TEXTE.eintraege(5), DATALINK_TEXTE.eintraege(1234), DATALINK_TEXTE.keineEintraege, DATALINK_TEXTE.ordnerpfad, DATALINK_TEXTE.ordnerEntfernen],
    ['1 Eintrag', '5 Einträge', '1234 Einträge', 'keine Einträge', 'Ordnerpfad', 'Ordner entfernen'],
    'DataLink erweitert: Texte wörtlich (T8), Zahl ohne Tausenderpunkt',
  );
}

const erweitert: DataLinkSectionProps = { ...alle, onClearFolder: () => {}, capabilities: { ordnerText: true }, onFolderText: () => {} };
{
  const html = render(<DataLinkSection {...erweitert} />);
  for (const t of ['>Ordnerpfad</label>', 'value="D:\\Show\\Daten"', 'placeholder="kein Ordner"', '>Ordner entfernen</button>']) {
    enthaelt(html, t, `DataLink erweitert: ${t}`);
  }
  enthaeltNicht(html, 'data-anzeige="Ordner"', 'DataLink Pfadfeld: ersetzt die Anzeige „Ordner“ (kein Wert doppelt)');
  ok(
    vor(html, '>Ordnerpfad<', '>Ordner wählen …<') &&
      vor(html, '>Ordner wählen …<', '>Ordner entfernen<') &&
      vor(html, '>Ordner entfernen<', '>Status<') &&
      vor(html, '>Status<', '>Zurück zum eigenen Ordner (Daten)<'),
    'DataLink erweitert: Felder in fester Reihenfolge (Pfad, wählen, entfernen, Status, Zurück)',
  );
  pruefeIdVerweise(html, 'DataLink Pfadfeld: id-Verweise gültig');
  ok(html.startsWith('<div id="einstellung-datalink"') && html.includes('>Ordnerpfad</label>'), 'DataLink Pfadfeld: steht im Panel-Anker des Abschnitts (Sprung aus der Statusleiste)');
  gleich(bewegungsVerstoesse(html), [], 'DataLink erweitert: Übergänge nur motion-safe oder mit motion-reduce:transition-none (G8)');
}
{
  const faelle = kreuz({
    folder: ['', 'D:\\Show\\Daten'],
    ordnerText: [undefined, false, true],
    feldRueckruf: [false, true],
    entfernenRueckruf: [false, true],
  } as const);
  pruefeFaelle(
    'DataLink erweitert: Pfadfeld genau mit capabilities.ordnerText UND onFolderText, „Ordner entfernen“ genau mit Ordner UND onClearFolder',
    faelle,
    (f) => {
      const p: DataLinkSectionProps = {
        ...alle,
        folder: f.folder,
        capabilities: f.ordnerText === undefined ? undefined : { ordnerText: f.ordnerText },
        onFolderText: f.feldRueckruf ? () => {} : undefined,
        onClearFolder: f.entfernenRueckruf ? () => {} : undefined,
      };
      const v = dataLinkView(p).sichtbar;
      const html = render(<DataLinkSection {...p} />);
      const feld = f.ordnerText === true && f.feldRueckruf;
      const entfernen = f.folder !== '' && f.entfernenRueckruf;
      return vergleiche(
        `${v.ordnerFeld}/${html.includes('>Ordnerpfad<')}/${v.ordnerEntfernen}/${html.includes('>Ordner entfernen<')}`,
        `${feld}/${feld}/${entfernen}/${entfernen}`,
      );
    },
  );
}
{
  const html = render(<DataLinkSection {...erweitert} locked="Im Verbund kommen die Speaker vom Master „Regie-PC“." />);
  const z = sperrZaehlung(html);
  ok(z.alle === 4 && z.gesperrt === 4, `DataLink erweitert locked: Pfadfeld, Ordner wählen, Ordner entfernen und Zurück disabled (${z.gesperrt} von ${z.alle})`);
  enthaelt(html, 'Gesperrt: Im Verbund kommen die Speaker vom Master „Regie-PC“.', 'DataLink erweitert locked: Grund des Tools wörtlich');
}
{
  // Aktion ohne DOM (Muster peerSetzen): der Knopf ruft genau ordnerEntfernen(p).
  const aufrufe: string[] = [];
  const mit: DataLinkSectionProps = { ...erweitert, onClearFolder: () => aufrufe.push('entfernt') };
  ok(ordnerEntfernen(mit) === true && aufrufe.length === 1, 'DataLink Ordner entfernen: Aufruf gemeldet');
  ok(ordnerEntfernen({ ...mit, locked: 'Vom Master vorgegeben' }) === false && aufrufe.length === 1, 'DataLink Ordner entfernen: gesperrt kein Aufruf');
  ok(ordnerEntfernen({ ...mit, locked: '   ' }) === true && aufrufe.length === 2, 'DataLink Ordner entfernen: ein Grund nur aus Leerzeichen sperrt nicht (istGesperrt)');
  ok(ordnerEntfernen({ ...mit, folder: '' }) === false && aufrufe.length === 2, 'DataLink Ordner entfernen: ohne Ordner kein Aufruf');
  ok(ordnerEntfernen({ ...alle }) === false, 'DataLink Ordner entfernen ohne onClearFolder: kein Aufruf, kein Absturz');
  const quelle = leseText('src/abschnitte/DataLinkSection.tsx');
  ok(
    quelle.includes('onClick={() => ordnerEntfernen(p)}') &&
      quelle.includes('useTextEntwurf(p.folder, (neu) => p.onFolderText?.(neu), undefined, gesperrt)') &&
      quelle.includes('<TextInput {...pfad.feld}'),
    'DataLink Verdrahtung: „Ordner entfernen“ ruft ordnerEntfernen, das Pfadfeld meldet über den Text-Entwurf (nicht je Tastendruck), die Sperre geht an den Entwurf',
  );
}
{
  // Titler-Muster: Daten aus der Show, kein eigener Ordner (E10).
  const html = render(<DataLinkSection id="datalink" folder="" externeQuelle eintraege={5} sourceLine="Quelle: Show „Gala“ · 5 Speaker" onPickFolder={() => {}} />);
  enthaelt(html, '>5 Einträge</span>', 'DataLink Show ohne eigenen Ordner: Statuspille „5 Einträge“ statt „kein Ordner“');
  enthaelt(html, '>kein Ordner</div>', 'DataLink Show ohne eigenen Ordner: die Anzeige „Ordner“ bleibt ehrlich „kein Ordner“');
  const item = abschnittStatusItem(dataLinkView({ id: 'datalink', folder: '', externeQuelle: true, eintraege: 0 }), { group: 'tool', label: 'DataLink' });
  gleich({ state: item.state, detail: item.detail }, { state: 'warn', detail: 'keine Einträge' }, 'DataLink Show ohne Einträge: Statuseintrag warn „keine Einträge“');
}
```

Datei `packages/settings/test/screen-output.test.tsx`, Vorher:
```tsx
import { bewegungsVerstoesse, kreuz, nachLetztem, pruefeFaelle, sperrZaehlung, statusText, vergleiche, vor } from './hilfe';
```
Nachher:
```tsx
import { bewegungsVerstoesse, kreuz, nachLetztem, pruefeFaelle, sperrZaehlung, statusText, vergleiche, vor } from './hilfe';
import { farbeGewaehlt, standardfarbe } from '../src/abschnitte/screen-output';
```

Vorher:
```tsx
  ok(item.state === 'error' && html.includes(`data-state="${item.state}"`) && html.includes(`>${item.detail}</span>`), 'Bildschirm: abschnittStatusItem = Statuspille (Zustand und Text)');
}
```
Nachher:
```tsx
  ok(item.state === 'error' && html.includes(`data-state="${item.state}"`) && html.includes(`>${item.detail}</span>`), 'Bildschirm: abschnittStatusItem = Statuspille (Zustand und Text)');
}

// ── Erweiterung für den Titler (UX-Pilot C6, OF3): Farbwähler neben dem Textfeld und Knopf „Standardfarbe“ ──
const mitFarbe: ScreenOutputSectionProps = { ...alle, backgroundDefault: '#00B140', capabilities: { ...alle.capabilities, backgroundPicker: true } };
{
  gleich([SCREEN_TEXTE.standardfarbe('#00B140'), SCREEN_TEXTE.farbeWaehlen], ['Standardfarbe (#00B140)', 'Farbe wählen'], 'Bildschirm erweitert: Texte wörtlich (T9)');
  const html = render(<ScreenOutputSection {...mitFarbe} />);
  enthaelt(html, 'type="color"', 'Bildschirm erweitert: Farbwähler (input type=color)');
  enthaelt(html, 'aria-label="Farbe wählen"', 'Bildschirm erweitert: Farbwähler beschriftet (aria-label)');
  enthaelt(html, '>Standardfarbe (#00B140)</button>', 'Bildschirm erweitert: Knopf „Standardfarbe (#00B140)“');
  ok(
    vor(html, '>Hintergrund<', 'type="color"') && vor(html, 'value="#00B140"', 'type="color"') && vor(html, 'type="color"', '>Standardfarbe'),
    'Bildschirm erweitert: Textfeld, Farbwähler, Standardfarbe in dieser Reihenfolge',
  );
  pruefeIdVerweise(html, 'Bildschirm erweitert: id-Verweise gültig');
  gleich(bewegungsVerstoesse(html), [], 'Bildschirm erweitert: Übergänge nur motion-safe oder mit motion-reduce:transition-none (G8)');
}
{
  const faelle = kreuz({
    background: [false, true],
    backgroundPicker: [undefined, false, true],
    wert: [undefined, '#00B140'],
    standard: [undefined, '#00B140', 'grün'],
  } as const);
  pruefeFaelle(
    'Bildschirm erweitert: Farbwähler genau mit background, backgroundPicker und gemeldetem Wert; Standardfarbe genau mit background, gemeldetem Wert und gültiger Standardfarbe',
    faelle,
    (f) => {
      const p: ScreenOutputSectionProps = { ...alle, background: f.wert, backgroundDefault: f.standard, capabilities: { background: f.background, backgroundPicker: f.backgroundPicker } };
      const v = screenOutputView(p).sichtbar;
      const html = render(<ScreenOutputSection {...p} />);
      const waehler = f.background && f.backgroundPicker === true && f.wert !== undefined;
      const standard = f.background && f.wert !== undefined && f.standard === '#00B140';
      return vergleiche(
        `${v.farbwaehler}/${html.includes('type="color"')}/${v.standardfarbe}/${html.includes('>Standardfarbe')}`,
        `${waehler}/${waehler}/${standard}/${standard}`,
      );
    },
  );
}
{
  const html = render(<ScreenOutputSection {...mitFarbe} locked="Vom Master vorgegeben" />);
  const z = sperrZaehlung(html);
  ok(z.alle === 6 && z.gesperrt === 6, `Bildschirm erweitert locked: auch Farbwähler und Standardfarbe disabled (${z.gesperrt} von ${z.alle})`);
}
{
  const html = render(<ScreenOutputSection {...mitFarbe} background="grün" />);
  enthaelt(html, 'Farbe als #RRGGBB eingeben.', 'Bildschirm erweitert: ungültige Farbe bleibt Fehlertext am Feld');
  ok(/<input type="color"[^>]*value="#000000"/.test(html), 'Bildschirm erweitert: Farbwähler zeigt bei ungültiger Farbe #000000 statt eines ungültigen Werts');
}
{
  const faelle = kreuz({
    enabled: [false, true],
    windowOpen: [undefined, false, true],
    liste: ['unbekannt', 'leer', 'zwei'],
    wahl: ['auto', 'vorhanden', 'fehlt'],
    error: [undefined, 'Testfehler'],
  } as const);
  pruefeFaelle('Bildschirm erweitert: Status mit Farbwähler und Standardfarbe wie in der Tabelle oben', faelle, (f) => {
    const p: ScreenOutputSectionProps = { ...mitFarbe, enabled: f.enabled, windowOpen: f.windowOpen, screens: LISTEN[f.liste], selectedId: WAHL[f.wahl], error: f.error };
    const soll = f.error ? FEHLER : TABELLE[`${f.liste}|${f.wahl}`][SPALTE(f.enabled, f.windowOpen)];
    return vergleiche(statusText(screenOutputView(p).status), statusText(soll));
  });
}
{
  // Aktionen ohne DOM (Muster peerSetzen): Knopf und Farbwähler rufen genau diese Funktionen.
  const farben: string[] = [];
  const mit: ScreenOutputSectionProps = { ...mitFarbe, onBackground: (hex) => farben.push(hex) };
  ok(standardfarbe(mit) === true && farben.join() === '#00B140', 'Bildschirm Standardfarbe: meldet onBackground(backgroundDefault)');
  ok(standardfarbe({ ...mit, locked: 'Vom Master vorgegeben' }) === false && farben.length === 1, 'Bildschirm Standardfarbe: gesperrt kein Aufruf');
  ok(
    standardfarbe({ ...mit, backgroundDefault: 'grün' }) === false && standardfarbe({ ...mit, backgroundDefault: undefined }) === false && farben.length === 1,
    'Bildschirm Standardfarbe: ohne gültige Standardfarbe kein Aufruf',
  );
  ok(standardfarbe({ ...mitFarbe, onBackground: undefined }) === false, 'Bildschirm Standardfarbe ohne onBackground: kein Aufruf, kein Absturz');
  ok(farbeGewaehlt(mit, '#12ab34') === true && farben.at(-1) === '#12ab34', 'Bildschirm Farbwähler: meldet die gewählte Farbe');
  ok(
    farbeGewaehlt(mit, 'rot') === false && farbeGewaehlt({ ...mit, locked: 'Vom Master vorgegeben' }, '#000000') === false && farben.length === 2,
    'Bildschirm Farbwähler: ungültig oder gesperrt kein Aufruf',
  );
  const quelle = leseText('src/abschnitte/ScreenOutputSection.tsx');
  ok(
    quelle.includes('onChange={(e) => farbeGewaehlt(p, e.currentTarget.value)}') && quelle.includes('onClick={() => standardfarbe(p)}'),
    'Bildschirm Verdrahtung: der Farbwähler ruft farbeGewaehlt, der Knopf ruft standardfarbe',
  );
}
```

Datei `packages/settings/test/quellregeln.test.ts`, Vorher:
```ts
    'DataLinkSectionProps.folder', 'DataLinkSectionProps.lastChange',
  ]);
  const AUSNAHMEN = new Set(['DataLinkSectionProps.sourceLine', 'DataLinkSectionProps.notice', 'DataLinkSectionProps.backLabel']);
```
Nachher:
```ts
    'DataLinkSectionProps.folder', 'DataLinkSectionProps.lastChange',
    'ScreenOutputSectionProps.backgroundDefault',
  ]);
  const AUSNAHMEN = new Set(['DataLinkSectionProps.sourceLine', 'DataLinkSectionProps.notice', 'DataLinkSectionProps.backLabel']);
  // Rückrufe, deren Name auf …Text endet, ohne Text darin (UX-Pilot C6: das Pfadfeld meldet den getippten Pfad).
  const RUECKRUFE = new Set(['DataLinkSectionProps.onFolderText']);
```
Vorher:
```ts
        if ((nachName || freierText) && !AUSNAHMEN.has(name)) mitText.push(`${p}: ${name}`);
```
Nachher:
```ts
        if ((nachName || freierText) && !AUSNAHMEN.has(name) && !RUECKRUFE.has(name)) mitText.push(`${p}: ${name}`);
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/settings; echo "Exit=$?"
```
Erwartet (gemessen; `tsx` bricht beim Verknüpfen der Module ab, es läuft kein Test):
```
<worktree>\packages\settings\test\screen-output.test.tsx:13
import { farbeGewaehlt, standardfarbe } from '../src/abschnitte/screen-output';
         ^
SyntaxError: The requested module '../src/abschnitte/screen-output' does not provide an export named 'farbeGewaehlt'
…
Exit=1
```

- [ ] **Step 3: Galerie-Test für die drei Titler-Beispiele** (`packages/ui/test/galerie.test.tsx`)

Vorher:
```tsx
  'bildschirm-aus': 'off', 'bildschirm-keiner': 'off', 'bildschirm-gesperrt': 'ok', 'bildschirm-fehlertext': 'error',
```
Nachher:
```tsx
  'bildschirm-aus': 'off', 'bildschirm-keiner': 'off', 'bildschirm-gesperrt': 'ok', 'bildschirm-fehlertext': 'error',
  'bildschirm-farbwaehler': 'ok',
```
Vorher:
```tsx
  'datalink-aus': 'off', 'datalink-gesperrt': 'ok', 'datalink-fehlertext': 'error',
```
Nachher:
```tsx
  'datalink-aus': 'off', 'datalink-gesperrt': 'ok', 'datalink-fehlertext': 'error',
  'datalink-show': 'ok', 'datalink-pfadfeld': 'ok',
```

Einfügen in `packages/ui/test/galerie.test.tsx` direkt vor der Zeile `// ── Rahmen-Seite (AppShell fensterfüllend, für die iframes) ──`:
```tsx
// ── Titler-Muster aus UX-Pilot C6 (Erweiterungen DataLink und Bildschirm), je Modus ──
{
  const MARKEN: Record<string, string[]> = {
    'datalink-show': ['>12 Einträge</span>', '>kein Ordner</div>', 'Quelle: Show „Fachtagung“ · 12 Speaker'],
    'datalink-pfadfeld': ['>Ordnerpfad</label>', '>Ordner entfernen</button>'],
    'bildschirm-farbwaehler': ['type="color"', 'aria-label="Farbe wählen"', '>Standardfarbe (#00B140)</button>'],
  };
  for (const modus of ['dark', 'light'] as const) {
    for (const [name, marken] of Object.entries(MARKEN)) {
      const beispiel = settingsBeispiele(modus).find((b) => b.name === name);
      const html = beispiel ? render(beispiel.element) : '';
      const fehlt = marken.filter((m) => !html.includes(m));
      ok(beispiel !== undefined && fehlt.length === 0, `Galerie ${modus}: Beispiel ${name} zeigt ${marken.join(' · ')}`);
    }
  }
}

```

- [ ] **Step 4: Galerie-Test laufen lassen (rot)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen):
```
FAIL Galerie dark: alle 58 Abschnitts-Beispiele
     ist: [… 55 Namen ohne bildschirm-farbwaehler, datalink-pfadfeld, datalink-show …] soll: [… 58 Namen …]
FAIL Galerie light: alle 58 Abschnitts-Beispiele
     ist: […] soll: […]
FAIL Galerie: jedes der 95 Beispiele genau einmal je Spalte
     ist: ["bildschirm-farbwaehler","datalink-show","datalink-pfadfeld"] soll: []
FAIL Galerie dark: Beispiel datalink-show zeigt >12 Einträge</span> · >kein Ordner</div> · Quelle: Show „Fachtagung“ · 12 Speaker
FAIL Galerie dark: Beispiel datalink-pfadfeld zeigt >Ordnerpfad</label> · >Ordner entfernen</button>
FAIL Galerie dark: Beispiel bildschirm-farbwaehler zeigt type="color" · aria-label="Farbe wählen" · >Standardfarbe (#00B140)</button>
FAIL Galerie light: Beispiel datalink-show zeigt >12 Einträge</span> · >kein Ordner</div> · Quelle: Show „Fachtagung“ · 12 Speaker
FAIL Galerie light: Beispiel datalink-pfadfeld zeigt >Ordnerpfad</label> · >Ordner entfernen</button>
FAIL Galerie light: Beispiel bildschirm-farbwaehler zeigt type="color" · aria-label="Farbe wählen" · >Standardfarbe (#00B140)</button>

9 FEHLGESCHLAGEN
Exit=1
```
(Die beiden `ist:`/`soll:`-Zeilen sind hier gekürzt; gemessen stehen dort die vollen Namenslisten.)

- [ ] **Step 5: DataLink-Logik erweitern** (`packages/settings/src/abschnitte/datalink.ts`)

Vorher:
```ts
import { ABSCHNITT_TEXTE, fehlerStatus, hatFehler, st, STATUS_UNBEKANNT, type SectionBase, type SectionInput, type SectionStatus } from '../vertrag';
```
Nachher:
```ts
import { ABSCHNITT_TEXTE, fehlerStatus, hatFehler, istGesperrt, st, STATUS_UNBEKANNT, type SectionBase, type SectionInput, type SectionStatus } from '../vertrag';
```
Vorher:
```ts
  backLabel?: string; onBack?(): void;   // Titler K1; Knopf nur mit beidem
  onPickFolder?(): void;
}
```
Nachher:
```ts
  backLabel?: string; onBack?(): void;   // Titler K1; Knopf nur mit beidem
  onPickFolder?(): void;
  // Erweiterung für den Titler (UX-Pilot C6, E10, OF4), additiv: ohne diese Props gilt alles wie bisher.
  externeQuelle?: boolean;           // gemessen: Daten kommen nicht aus dem eigenen Ordner → nicht „kein Ordner“
  eintraege?: number;                // gemessen: abrufbare Einträge; gesetzt → „{n} Einträge“ statt Dateizahl
  onClearFolder?(): void;            // Knopf „Ordner entfernen“ (nur mit Ordner; gesperrt wie „Ordner wählen …“)
  capabilities?: { ordnerText?: boolean };
  onFolderText?(pfad: string): void; // Pfadfeld (Text-Entwurf, Übernahme bei Enter/Verlassen), nur mit ordnerText
}
```
Vorher:
```ts
  keineDatei: 'keine Datei',
  gesperrtVomMaster: ABSCHNITT_TEXTE.gesperrtVomMaster,
} as const;
```
Nachher:
```ts
  keineDatei: 'keine Datei',
  gesperrtVomMaster: ABSCHNITT_TEXTE.gesperrtVomMaster,
  // UX-Pilot C6 (T8)
  eintrag: '1 Eintrag',
  eintraege: (n: number) => `${zahlText(n)} Einträge`,
  keineEintraege: 'keine Einträge',
  ordnerpfad: 'Ordnerpfad',
  ordnerEntfernen: 'Ordner entfernen',
} as const;
```
Vorher:
```ts
  sichtbar: { ordnerWaehlen: boolean; status: boolean; zurueck: boolean };
```
Nachher:
```ts
  sichtbar: { ordnerWaehlen: boolean; status: boolean; zurueck: boolean; ordnerEntfernen: boolean; ordnerFeld: boolean };
```
Vorher:
```ts
  if (p.folder === '') return st('off', DATALINK_TEXTE.keinOrdner);
  if (p.fileCount === undefined) return STATUS_UNBEKANNT;
```
Nachher:
```ts
  // Daten aus fremder Quelle (Titler: Show, Master, frühere Show) brauchen keinen eigenen Ordner (E10).
  if (p.folder === '' && p.externeQuelle !== true) return st('off', DATALINK_TEXTE.keinOrdner);
  // Gemessene Einträge gehen vor der Dateizahl; 0 ist eine Messung („keine Einträge“), nie ok.
  if (p.eintraege !== undefined) {
    if (p.eintraege === 0) return st('warn', DATALINK_TEXTE.keineEintraege);
    return st('ok', p.eintraege === 1 ? DATALINK_TEXTE.eintrag : DATALINK_TEXTE.eintraege(p.eintraege));
  }
  if (p.fileCount === undefined) return STATUS_UNBEKANNT;
```
Vorher:
```ts
      zurueck: text(p.backLabel) && typeof p.onBack === 'function',
    },
```
Nachher:
```ts
      zurueck: text(p.backLabel) && typeof p.onBack === 'function',
      ordnerEntfernen: p.folder !== '' && typeof p.onClearFolder === 'function',
      ordnerFeld: p.capabilities?.ordnerText === true && typeof p.onFolderText === 'function',
    },
```
Vorher:
```ts
    ordnerText: p.folder === '' ? DATALINK_TEXTE.keinOrdner : p.folder,
  };
}
```
Nachher:
```ts
    ordnerText: p.folder === '' ? DATALINK_TEXTE.keinOrdner : p.folder,
  };
}

/**
 * „Ordner entfernen“ (Muster peerSetzen): meldet onClearFolder nur mit Ordner und ohne Sperre. Rückgabe: gemeldet?
 * Der Knopf ruft genau diese Funktion; der Test prüft die Wirkung ohne DOM.
 */
export function ordnerEntfernen(p: DataLinkSectionProps): boolean {
  if (istGesperrt(p) || p.folder === '' || typeof p.onClearFolder !== 'function') return false;
  p.onClearFolder();
  return true;
}
```

- [ ] **Step 6: DataLink-Abschnitt: Pfadfeld und „Ordner entfernen“** (`packages/settings/src/abschnitte/DataLinkSection.tsx`)

Vorher:
```tsx
import { Button } from '@jm/ui';
import { Anzeige, SectionFrame } from '../SectionFrame';
import { istGesperrt } from '../vertrag';
import { DATALINK_TEXTE, dataLinkView, type DataLinkSectionProps } from './datalink';
```
Nachher:
```tsx
import { Button, Field, TextInput } from '@jm/ui';
import { useTextEntwurf } from '../entwurf';
import { Anzeige, SectionFrame } from '../SectionFrame';
import { istGesperrt } from '../vertrag';
import { DATALINK_TEXTE, dataLinkView, ordnerEntfernen, type DataLinkSectionProps } from './datalink';
```
Vorher:
```tsx
  const gesperrt = istGesperrt(view);
  return (
    <SectionFrame view={view} titel={DATALINK_TEXTE.titel}>
      <Anzeige label={DATALINK_TEXTE.ordner}>{view.ordnerText}</Anzeige>
```
Nachher:
```tsx
  const gesperrt = istGesperrt(view);
  // Pfadfeld (UX-Pilot C6, OF4): Übernahme erst bei Enter oder Verlassen, nicht je Tastendruck; gesperrt meldet es nichts.
  const pfad = useTextEntwurf(p.folder, (neu) => p.onFolderText?.(neu), undefined, gesperrt);
  return (
    <SectionFrame view={view} titel={DATALINK_TEXTE.titel}>
      {view.sichtbar.ordnerFeld ? (
        <Field label={DATALINK_TEXTE.ordnerpfad} error={pfad.fehler}>
          <TextInput {...pfad.feld} placeholder={DATALINK_TEXTE.keinOrdner} spellCheck={false} disabled={gesperrt ? true : undefined} />
        </Field>
      ) : (
        <Anzeige label={DATALINK_TEXTE.ordner}>{view.ordnerText}</Anzeige>
      )}
```
Vorher:
```tsx
          {DATALINK_TEXTE.ordnerWaehlen}
        </Button>
      ) : null}
```
Nachher:
```tsx
          {DATALINK_TEXTE.ordnerWaehlen}
        </Button>
      ) : null}
      {view.sichtbar.ordnerEntfernen ? (
        <Button type="button" variant="ghost" size="sm" uppercase={false} className="motion-reduce:transition-none" onClick={() => ordnerEntfernen(p)} disabled={gesperrt}>
          {DATALINK_TEXTE.ordnerEntfernen}
        </Button>
      ) : null}
```

- [ ] **Step 7: Bildschirm-Logik erweitern** (`packages/settings/src/abschnitte/screen-output.ts`)

Vorher:
```ts
import { ABSCHNITT_TEXTE, fehlerStatus, hatFehler, st, STATUS_UNBEKANNT, type SectionBase, type SectionInput, type SectionStatus } from '../vertrag';
```
Nachher:
```ts
import { ABSCHNITT_TEXTE, fehlerStatus, hatFehler, istGesperrt, st, STATUS_UNBEKANNT, type SectionBase, type SectionInput, type SectionStatus } from '../vertrag';
```
Vorher:
```ts
  fullscreen?: boolean; background?: string;
  capabilities: { toggle?: boolean; fullscreen?: boolean; background?: boolean };
```
Nachher:
```ts
  fullscreen?: boolean; background?: string;
  backgroundDefault?: string;        // UX-Pilot C6 (OF3): Knopf „Standardfarbe ({hex})“ setzt diese Farbe
  // backgroundPicker (UX-Pilot C6, OF3): Farbwähler neben dem Textfeld
  capabilities: { toggle?: boolean; fullscreen?: boolean; background?: boolean; backgroundPicker?: boolean };
```
Vorher:
```ts
  farbeUngueltig: 'Farbe als #RRGGBB eingeben.',
} as const;
```
Nachher:
```ts
  farbeUngueltig: 'Farbe als #RRGGBB eingeben.',
  // UX-Pilot C6 (T9)
  standardfarbe: (hex: string) => `Standardfarbe (${hex})`,
  farbeWaehlen: 'Farbe wählen',
} as const;
```
Vorher:
```ts
export const SCREEN_AUTO = 'auto';
```
Nachher:
```ts
export const SCREEN_AUTO = 'auto';

/** Gültige Hintergrundfarbe #RRGGBB (Textfeld, Farbwähler, Standardfarbe). */
export const FARBE_MUSTER = /^#[0-9a-fA-F]{6}$/;
```
Vorher:
```ts
  sichtbar: { ausgabe: boolean; auswahl: boolean; vollbild: boolean; hintergrund: boolean };
```
Nachher:
```ts
  sichtbar: { ausgabe: boolean; auswahl: boolean; vollbild: boolean; hintergrund: boolean; standardfarbe: boolean; farbwaehler: boolean };
```
Vorher:
```ts
      hintergrund: c.background === true,
    },
```
Nachher:
```ts
      hintergrund: c.background === true,
      // Nur neben einem gemeldeten Wert: ohne ihn steht „unbekannt“ und keine Eingabe (G6).
      standardfarbe: c.background === true && typeof p.background === 'string' && FARBE_MUSTER.test(p.backgroundDefault ?? ''),
      farbwaehler: c.background === true && c.backgroundPicker === true && typeof p.background === 'string',
    },
```
Vorher:
```ts
    hinweis: ziel > 0 && liste[ziel - 1].primary ? SCREEN_TEXTE.hinweis : undefined,
  };
}
```
Nachher:
```ts
    hinweis: ziel > 0 && liste[ziel - 1].primary ? SCREEN_TEXTE.hinweis : undefined,
  };
}

/** „Standardfarbe ({hex})“ (Muster peerSetzen): meldet backgroundDefault nur ohne Sperre und als gültige Farbe. */
export function standardfarbe(p: ScreenOutputSectionProps): boolean {
  const hex = p.backgroundDefault ?? '';
  if (istGesperrt(p) || !FARBE_MUSTER.test(hex) || typeof p.onBackground !== 'function') return false;
  p.onBackground(hex);
  return true;
}

/** Farbwähler: meldet die gewählte Farbe nur ohne Sperre und als #RRGGBB. */
export function farbeGewaehlt(p: ScreenOutputSectionProps, hex: string): boolean {
  if (istGesperrt(p) || !FARBE_MUSTER.test(hex) || typeof p.onBackground !== 'function') return false;
  p.onBackground(hex);
  return true;
}
```

- [ ] **Step 8: Bildschirm-Abschnitt: Farbwähler und „Standardfarbe“** (`packages/settings/src/abschnitte/ScreenOutputSection.tsx`)

Vorher:
```tsx
import { Field, Select, TextInput, Toggle, UNBEKANNT } from '@jm/ui';
import { useTextEntwurf } from '../entwurf';
import { Anzeige, SectionFrame } from '../SectionFrame';
import { istGesperrt } from '../vertrag';
import { SCREEN_AUTO, SCREEN_TEXTE, screenOutputView, type ScreenOutputSectionProps } from './screen-output';

const FARBE = /^#[0-9a-fA-F]{6}$/;
```
Nachher:
```tsx
import { Button, Field, Select, TextInput, Toggle, UNBEKANNT } from '@jm/ui';
import { useTextEntwurf } from '../entwurf';
import { Anzeige, SectionFrame } from '../SectionFrame';
import { istGesperrt } from '../vertrag';
import { farbeGewaehlt, FARBE_MUSTER, SCREEN_AUTO, SCREEN_TEXTE, screenOutputView, standardfarbe, type ScreenOutputSectionProps } from './screen-output';

const FARBE = FARBE_MUSTER;
```
Vorher:
```tsx
          <Field label={SCREEN_TEXTE.hintergrund} error={farbeFalsch ? SCREEN_TEXTE.farbeUngueltig : farbe.fehler}>
            <TextInput {...farbe.feld} disabled={sperre} />
          </Field>
```
Nachher:
```tsx
          <>
            <Field label={SCREEN_TEXTE.hintergrund} error={farbeFalsch ? SCREEN_TEXTE.farbeUngueltig : farbe.fehler}>
              <div className="flex items-center gap-2">
                <TextInput {...farbe.feld} disabled={sperre} />
                {view.sichtbar.farbwaehler ? (
                  <input
                    type="color"
                    aria-label={SCREEN_TEXTE.farbeWaehlen}
                    title={SCREEN_TEXTE.farbeWaehlen}
                    value={FARBE.test(p.background) ? p.background : '#000000'}
                    onChange={(e) => farbeGewaehlt(p, e.currentTarget.value)}
                    disabled={sperre}
                    className="h-[var(--control-h)] w-10 shrink-0 cursor-pointer rounded-[var(--radius-md)] border border-[var(--field-border)] bg-[var(--input)] p-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                ) : null}
              </div>
            </Field>
            {view.sichtbar.standardfarbe ? (
              <Button type="button" variant="outline" size="sm" uppercase={false} className="motion-reduce:transition-none" onClick={() => standardfarbe(p)} disabled={gesperrt}>
                {SCREEN_TEXTE.standardfarbe(p.backgroundDefault ?? '')}
              </Button>
            ) : null}
          </>
```

- [ ] **Step 9: Test laufen lassen (`@jm/settings` grün)**

```
npm run selftest -w @jm/settings; echo "Exit=$?"
npm run selftest -w @jm/settings 2>&1 | grep -c "^ok "
npm run selftest -w @jm/settings 2>&1 | grep -cE "^ok   (DataLink erweitert|DataLink Pfadfeld|DataLink Ordner entfernen|DataLink Verdrahtung|DataLink Show|Bildschirm erweitert|Bildschirm Standardfarbe|Bildschirm Farbwähler|Bildschirm Verdrahtung: der Farbwähler)"
```
Erwartet (gemessen): `ALLE TESTS OK`, `Exit=0`, dann `463` (419 + 44) und `44`. Die 44 neuen Zeilen (Fallzahlen in
Klammern):
```
ok   Bildschirm erweitert: Texte wörtlich (T9)
ok   Bildschirm erweitert: Farbwähler (input type=color)
ok   Bildschirm erweitert: Farbwähler beschriftet (aria-label)
ok   Bildschirm erweitert: Knopf „Standardfarbe (#00B140)“
ok   Bildschirm erweitert: Textfeld, Farbwähler, Standardfarbe in dieser Reihenfolge
ok   Bildschirm erweitert: id-Verweise gültig
ok   Bildschirm erweitert: Übergänge nur motion-safe oder mit motion-reduce:transition-none (G8)
ok   Bildschirm erweitert: Farbwähler genau mit background, backgroundPicker und gemeldetem Wert; Standardfarbe genau mit background, gemeldetem Wert und gültiger Standardfarbe (36 Fälle)
ok   Bildschirm erweitert locked: auch Farbwähler und Standardfarbe disabled (6 von 6)
ok   Bildschirm erweitert: ungültige Farbe bleibt Fehlertext am Feld
ok   Bildschirm erweitert: Farbwähler zeigt bei ungültiger Farbe #000000 statt eines ungültigen Werts
ok   Bildschirm erweitert: Status mit Farbwähler und Standardfarbe wie in der Tabelle oben (108 Fälle)
ok   Bildschirm Standardfarbe: meldet onBackground(backgroundDefault)
ok   Bildschirm Standardfarbe: gesperrt kein Aufruf
ok   Bildschirm Standardfarbe: ohne gültige Standardfarbe kein Aufruf
ok   Bildschirm Standardfarbe ohne onBackground: kein Aufruf, kein Absturz
ok   Bildschirm Farbwähler: meldet die gewählte Farbe
ok   Bildschirm Farbwähler: ungültig oder gesperrt kein Aufruf
ok   Bildschirm Verdrahtung: der Farbwähler ruft farbeGewaehlt, der Knopf ruft standardfarbe
ok   DataLink erweitert Kreuzprodukt: externeQuelle und eintraege → status aus Tabelle 3, 4 und 2 (1152 Fälle)
ok   DataLink erweitert: nie „0 Einträge“ oder „0 Dateien“ (1152 Fälle)
ok   DataLink erweitert: ok nur mit gemessener Zahl über 0 (Einträge vor Dateien) (1152 Fälle)
ok   DataLink erweitert: Texte wörtlich (T8), Zahl ohne Tausenderpunkt
ok   DataLink erweitert: >Ordnerpfad</label>
ok   DataLink erweitert: value="D:\Show\Daten"
ok   DataLink erweitert: placeholder="kein Ordner"
ok   DataLink erweitert: >Ordner entfernen</button>
ok   DataLink Pfadfeld: ersetzt die Anzeige „Ordner“ (kein Wert doppelt)
ok   DataLink erweitert: Felder in fester Reihenfolge (Pfad, wählen, entfernen, Status, Zurück)
ok   DataLink Pfadfeld: id-Verweise gültig
ok   DataLink Pfadfeld: steht im Panel-Anker des Abschnitts (Sprung aus der Statusleiste)
ok   DataLink erweitert: Übergänge nur motion-safe oder mit motion-reduce:transition-none (G8)
ok   DataLink erweitert: Pfadfeld genau mit capabilities.ordnerText UND onFolderText, „Ordner entfernen“ genau mit Ordner UND onClearFolder (24 Fälle)
ok   DataLink erweitert locked: Pfadfeld, Ordner wählen, Ordner entfernen und Zurück disabled (4 von 4)
ok   DataLink erweitert locked: Grund des Tools wörtlich
ok   DataLink Ordner entfernen: Aufruf gemeldet
ok   DataLink Ordner entfernen: gesperrt kein Aufruf
ok   DataLink Ordner entfernen: ein Grund nur aus Leerzeichen sperrt nicht (istGesperrt)
ok   DataLink Ordner entfernen: ohne Ordner kein Aufruf
ok   DataLink Ordner entfernen ohne onClearFolder: kein Aufruf, kein Absturz
ok   DataLink Verdrahtung: „Ordner entfernen“ ruft ordnerEntfernen, das Pfadfeld meldet über den Text-Entwurf (nicht je Tastendruck), die Sperre geht an den Entwurf
ok   DataLink Show ohne eigenen Ordner: Statuspille „5 Einträge“ statt „kein Ordner“
ok   DataLink Show ohne eigenen Ordner: die Anzeige „Ordner“ bleibt ehrlich „kein Ordner“
ok   DataLink Show ohne Einträge: Statuseintrag warn „keine Einträge“
```
Die alten Zeilen bleiben Wort für Wort grün, darunter „DataLink Kreuzprodukt: Eingang → status aus den Tabellen (locked ändert
den Status nicht) (192 Fälle)“, „DataLink locked: alle Bedienelemente disabled (2 von 2)“, „Bildschirm locked: alle
Bedienelemente disabled (4 von 4)“, „Bildschirm Verdrahtung: …“ (der Text-Entwurf der Farbe ist unverändert verdrahtet) und
„Quellregel settings: keine Text-Prop in den Abschnitts-Props …“.

- [ ] **Step 10: Galerie-Beispiele** (`packages/ui/galerie/beispiele-settings.tsx`)

Vorher:
```tsx
    b('bildschirm-fehlertext', S, 'mit Fehlertext', <ScreenOutputSection {...bildschirm(id('bildschirm-fehlertext'), { windowOpen: false, error: 'Ausgabefenster ließ sich nicht öffnen.' })} />),
```
Nachher:
```tsx
    b('bildschirm-fehlertext', S, 'mit Fehlertext', <ScreenOutputSection {...bildschirm(id('bildschirm-fehlertext'), { windowOpen: false, error: 'Ausgabefenster ließ sich nicht öffnen.' })} />),
    b('bildschirm-farbwaehler', S, 'Titler-Muster: Farbwähler und „Standardfarbe“', <ScreenOutputSection {...bildschirm(id('bildschirm-farbwaehler'), { backgroundDefault: '#00B140', capabilities: { toggle: true, fullscreen: true, background: true, backgroundPicker: true } })} />),
```
Vorher:
```tsx
    b('datalink-fehlertext', D, 'mit Fehlertext', <DataLinkSection {...datalink(id('datalink-fehlertext'), { error: 'Ordner nicht lesbar.' })} />),
```
Nachher:
```tsx
    b('datalink-fehlertext', D, 'mit Fehlertext', <DataLinkSection {...datalink(id('datalink-fehlertext'), { error: 'Ordner nicht lesbar.' })} />),
    b('datalink-show', D, 'Titler-Muster: Daten aus der Show, kein eigener Ordner (Einträge statt Dateien)', <DataLinkSection {...datalink(id('datalink-show'), { folder: '', fileCount: undefined, lastChange: undefined, externeQuelle: true, eintraege: 12, sourceLine: 'Quelle: Show „Fachtagung“ · 12 Speaker' })} />),
    b('datalink-pfadfeld', D, 'Titler-Muster: Pfadfeld und „Ordner entfernen“', <DataLinkSection {...datalink(id('datalink-pfadfeld'), { capabilities: { ordnerText: true }, onFolderText: nichts, onClearFolder: nichts })} />),
```

- [ ] **Step 11: Test laufen lassen (`@jm/ui` grün)**

```
npm run selftest -w @jm/ui; echo "Exit=$?"
npm run selftest -w @jm/ui 2>&1 | grep -c "^ok "
```
Erwartet (gemessen): `ALLE TESTS OK`, `Exit=0`, dann `679` (670 + 9). Neu bzw. geändert:
```
ok   Galerie dark: alle 58 Abschnitts-Beispiele
ok   Galerie light: alle 58 Abschnitts-Beispiele
ok   Abschnitts-Beispiel bildschirm-farbwaehler: Statuspille ok
ok   Abschnitts-Beispiel datalink-show: Statuspille ok
ok   Abschnitts-Beispiel datalink-pfadfeld: Statuspille ok
ok   Galerie: jedes der 95 Beispiele genau einmal je Spalte
ok   Galerie dark: Beispiel datalink-show zeigt >12 Einträge</span> · >kein Ordner</div> · Quelle: Show „Fachtagung“ · 12 Speaker
ok   Galerie dark: Beispiel datalink-pfadfeld zeigt >Ordnerpfad</label> · >Ordner entfernen</button>
ok   Galerie dark: Beispiel bildschirm-farbwaehler zeigt type="color" · aria-label="Farbe wählen" · >Standardfarbe (#00B140)</button>
ok   Galerie light: Beispiel datalink-show zeigt >12 Einträge</span> · >kein Ordner</div> · Quelle: Show „Fachtagung“ · 12 Speaker
ok   Galerie light: Beispiel datalink-pfadfeld zeigt >Ordnerpfad</label> · >Ordner entfernen</button>
ok   Galerie light: Beispiel bildschirm-farbwaehler zeigt type="color" · aria-label="Farbe wählen" · >Standardfarbe (#00B140)</button>
```
(Die Zeilen „alle 58 Abschnitts-Beispiele“ und „jedes der 95 Beispiele“ hießen vorher „alle 55“ bzw. „jedes der 92“.)

- [ ] **Step 12: Klassen-Probe der Galerie**

```
npm run galerie:pruefen -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen; Vite baut in etwa 1 s, CSS 37,03 kB): 20 `ok`-Zeilen, `ALLE TESTS OK`, `Exit=0`, darunter
```
ok   Klassen-Probe: CSS in <worktree>\packages\ui\galerie\dist\assets (index-….css)
ok   Klassen-Probe: 71 Klassen aus className="…" in packages/ui/src im CSS
ok   Klassen-Probe: 39 Klassen aus className="…" in packages/settings/src im CSS
Hinweis: 6 davon stehen nur in packages/settings/src (border-l-2 pl-2 break-all h-1.5 bg-[var(--tally-ready)] motion-reduce:transition-none); nur sie zeigen ein fehlendes @source "../../settings/src".
```
Die neuen Klassen des Farbwählers (`w-10`, `shrink-0`, `cursor-pointer`, `p-0.5`, `disabled:cursor-not-allowed`,
`disabled:opacity-60`, …) erzeugt Tailwind über `@source "../../settings/src"`; die Probe verlangt jede Klasse aus
`className="…"` in `packages/settings/src` im gebauten CSS.
Der Bau schreibt nur nach `packages/ui/galerie/dist` (per `.gitignore` ignoriert); `git status --short` zeigt dort nichts.

- [ ] **Step 13: Gegenproben** (je eine Ersetzung allein, vorübergehend; danach mit dem Edit-Werkzeug zurücknehmen)

Jede Probe allein mit dem Edit-Werkzeug einbauen, `npm run selftest -w @jm/settings; echo "Exit=$?"` laufen lassen, die
`FAIL`-Zeilen mit der Erwartung vergleichen, die Ersetzung genau zurücknehmen und wieder `ALLE TESTS OK` sehen (463 `ok`).
Nichts davon wird gestagt.

1. `packages/settings/src/abschnitte/datalink.ts`: `if (p.folder === '' && p.externeQuelle !== true) return` →
   `if (p.folder === '') return` (externeQuelle wirkungslos). Erwartet (gemessen):
   ```
   FAIL DataLink erweitert Kreuzprodukt: externeQuelle und eintraege → status aus Tabelle 3, 4 und 2 (1152 Fälle)
        folder="leer" folderMissing=undefined externeQuelle=true eintraege=undefined fileCount=undefined lastChange="fehlt" error=undefined → ist: off kein Ordner soll: off unbekannt
        …
        … und 59 weitere
   FAIL DataLink Show ohne eigenen Ordner: Statuspille „5 Einträge“ statt „kein Ordner“
        fehlt: >5 Einträge</span>
   FAIL DataLink Show ohne Einträge: Statuseintrag warn „keine Einträge“
        ist: {"state":"off","detail":"kein Ordner"} soll: {"state":"warn","detail":"keine Einträge"}
   3 FEHLGESCHLAGEN
   Exit=1
   ```
2. Ebenda `if (p.eintraege === 0) return st('warn', DATALINK_TEXTE.keineEintraege);` → `… st('ok', …)` (0 Einträge als ok).
   Erwartet (gemessen): `FAIL DataLink erweitert Kreuzprodukt: … (1152 Fälle)` mit
   `ist: ok keine Einträge soll: warn keine Einträge` (64 Fälle),
   `FAIL DataLink erweitert: ok nur mit gemessener Zahl über 0 (Einträge vor Dateien) (1152 Fälle)` mit `ok ohne Zahl`,
   `FAIL DataLink Show ohne Einträge: Statuseintrag warn „keine Einträge“`, `3 FEHLGESCHLAGEN`, `Exit=1`.
3. `packages/settings/src/abschnitte/DataLinkSection.tsx`: `onClick={() => ordnerEntfernen(p)} disabled={gesperrt}>` →
   `onClick={() => ordnerEntfernen(p)}>` („Ordner entfernen“ bei `locked` frei). Erwartet (gemessen):
   `FAIL DataLink erweitert locked: Pfadfeld, Ordner wählen, Ordner entfernen und Zurück disabled (3 von 4)`,
   `1 FEHLGESCHLAGEN`, `Exit=1`.
4. `packages/settings/src/abschnitte/screen-output.ts` in `standardfarbe`: die Zeile `  p.onBackground(hex);` entfernen
   (Knopf meldet nichts). Die Zeile steht auch in `farbeGewaehlt`; eindeutig ist der Vorher-Text erst mit den zwei Zeilen
   davor (Edit-Werkzeug). Vorher:
   ```ts
     const hex = p.backgroundDefault ?? '';
     if (istGesperrt(p) || !FARBE_MUSTER.test(hex) || typeof p.onBackground !== 'function') return false;
     p.onBackground(hex);
   ```
   Nachher (nur für diesen Lauf):
   ```ts
     const hex = p.backgroundDefault ?? '';
     if (istGesperrt(p) || !FARBE_MUSTER.test(hex) || typeof p.onBackground !== 'function') return false;
   ```
   Erwartet (gemessen):
   ```
   FAIL Bildschirm Standardfarbe: meldet onBackground(backgroundDefault)
   FAIL Bildschirm Standardfarbe: gesperrt kein Aufruf
   FAIL Bildschirm Standardfarbe: ohne gültige Standardfarbe kein Aufruf
   FAIL Bildschirm Farbwähler: ungültig oder gesperrt kein Aufruf
   4 FEHLGESCHLAGEN
   Exit=1
   ```
   (Die drei Folgezeilen zählen die Aufrufe weiter; ohne den ersten Aufruf stimmt jede Zählung nicht mehr.)
5. `packages/settings/test/quellregeln.test.ts`: ` && !RUECKRUFE.has(name))` → `)` (Rückruf-Ausnahme fehlt). Erwartet
   (gemessen): `FAIL Quellregel settings: keine Text-Prop in den Abschnitts-Props (…) außer E25 (Spec 6.1)` mit
   `     in: src/abschnitte/datalink.ts: DataLinkSectionProps.onFolderText`, `1 FEHLGESCHLAGEN`, `Exit=1`. (So zeigt die Regel,
   dass sie den neuen Namen sieht; die Ausnahme ist nötig, nicht nur geduldet.)
6. `packages/settings/src/abschnitte/screen-output.ts`:
   `farbwaehler: c.background === true && c.backgroundPicker === true && typeof p.background === 'string',` →
   `farbwaehler: c.background === true && c.backgroundPicker === true,` (Farbwähler ohne gemeldeten Wert). Erwartet (gemessen):
   `FAIL Bildschirm erweitert: Farbwähler genau mit …` mit drei Fällen
   `background=true backgroundPicker=true wert=undefined … → ist: true/false/false/false soll: false/false/false/false`,
   `1 FEHLGESCHLAGEN`, `Exit=1`.
7. `packages/settings/src/abschnitte/DataLinkSection.tsx`: `spellCheck={false} disabled={gesperrt ? true : undefined} />` →
   `spellCheck={false} />` (Pfadfeld bei `locked` frei). Erwartet (gemessen):
   `FAIL DataLink erweitert locked: Pfadfeld, Ordner wählen, Ordner entfernen und Zurück disabled (3 von 4)`,
   `1 FEHLGESCHLAGEN`, `Exit=1`.

Nach der letzten Probe: `npm run selftest -w @jm/settings 2>&1 | grep -c "^ok "` → `463`, `ALLE TESTS OK`.

- [ ] **Step 14: Typprüfung und Zeilenenden**

```
npm run typecheck -w @jm/settings; echo "Exit=$?"
npm run typecheck -w @jm/ui; echo "Exit=$?"
node -e "for (const f of process.argv.slice(1)) { const t = require('fs').readFileSync(f, 'utf8'); const n = (t.match(/\n/g) || []).length, c = (t.match(/\r\n/g) || []).length; console.log(f, n, c, c === 0 || c === n ? 'einheitlich' : 'GEMISCHT'); }" packages/settings/src/abschnitte/datalink.ts packages/settings/src/abschnitte/DataLinkSection.tsx packages/settings/src/abschnitte/screen-output.ts packages/settings/src/abschnitte/ScreenOutputSection.tsx packages/settings/test/datalink.test.tsx packages/settings/test/screen-output.test.tsx packages/settings/test/quellregeln.test.ts packages/ui/galerie/beispiele-settings.tsx packages/ui/test/galerie.test.tsx
```
Erwartet (gemessen): beide `tsc` ohne Meldung, `Exit=0`; dann jede Datei `einheitlich` (alle geändert, keine neu). In der
Messkopie liegen alle neun mit CRLF:
```
packages/settings/src/abschnitte/datalink.ts 93 93 einheitlich
packages/settings/src/abschnitte/DataLinkSection.tsx 44 44 einheitlich
packages/settings/src/abschnitte/screen-output.ts 122 122 einheitlich
packages/settings/src/abschnitte/ScreenOutputSection.tsx 76 76 einheitlich
packages/settings/test/datalink.test.tsx 271 271 einheitlich
packages/settings/test/screen-output.test.tsx 283 283 einheitlich
packages/settings/test/quellregeln.test.ts 133 133 einheitlich
packages/ui/galerie/beispiele-settings.tsx 322 322 einheitlich
packages/ui/test/galerie.test.tsx 318 318 einheitlich
```
Im Worktree `ux-update` liegen sieben davon mit LF (`git ls-files --eol`: `w/lf` bei `datalink.ts`, `DataLinkSection.tsx`,
`datalink.test.tsx`, `screen-output.test.tsx`, `quellregeln.test.ts`, `beispiele-settings.tsx` und `galerie.test.tsx`); dort
steht in der dritten Spalte `0`. Maßgeblich ist `einheitlich`: Das Edit-Werkzeug behält die Zeilenenden der Datei.

- [ ] **Step 15: Commit** (Bash-Werkzeug; Commit-Text ohne Umlaute)

```
git add packages/settings/src/abschnitte/datalink.ts packages/settings/src/abschnitte/DataLinkSection.tsx packages/settings/src/abschnitte/screen-output.ts packages/settings/src/abschnitte/ScreenOutputSection.tsx packages/settings/test/datalink.test.tsx packages/settings/test/screen-output.test.tsx packages/settings/test/quellregeln.test.ts packages/ui/galerie/beispiele-settings.tsx packages/ui/test/galerie.test.tsx
git status --short
```
Erwartet genau (fremde `??`-Zeilen bleiben ungestaged):
```
M  packages/settings/src/abschnitte/DataLinkSection.tsx
M  packages/settings/src/abschnitte/ScreenOutputSection.tsx
M  packages/settings/src/abschnitte/datalink.ts
M  packages/settings/src/abschnitte/screen-output.ts
M  packages/settings/test/datalink.test.tsx
M  packages/settings/test/quellregeln.test.ts
M  packages/settings/test/screen-output.test.tsx
M  packages/ui/galerie/beispiele-settings.tsx
M  packages/ui/test/galerie.test.tsx
```
Dann:
```
git commit -m "feat(settings): DataLink mit fremder Quelle, Eintraegen, Pfadfeld und Ordner entfernen; Bildschirm mit Farbwaehler und Standardfarbe (UX-Pilot C6)" -m "Additiv fuer den Titler-Pilot (E10, OF3, OF4): externeQuelle macht aus einem leeren eigenen Ordner kein kein Ordner, eintraege zeigt n Eintraege bzw. keine Eintraege statt der Dateizahl. Pfadfeld (capabilities.ordnerText + onFolderText) uebernimmt ueber den Text-Entwurf bei Enter/Verlassen, Ordner entfernen nur mit Ordner, beide gesperrt wie Ordner waehlen. Bildschirm: Farbwaehler neben dem Textfeld und Knopf Standardfarbe, nur neben einem gemeldeten Wert, gesperrt bei locked, meldet nur gueltige Farben. Alte Kreuztabellen unveraendert; Aktionen als reine Funktionen getestet; drei Galerie-Beispiele." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Neue reine Aktionen `ordnerEntfernen` (`datalink.ts`), `standardfarbe` und `farbeGewaehlt` (`screen-output.ts`) samt
  `FARBE_MUSTER`: Gegenprobe „Standardfarbe ruft `onBackground` nicht“ verlangt einen Handler-Test ohne DOM (Muster
  `peerSetzen`). Sie stehen nur in ihren Dateien, nicht in `packages/settings/src/index.ts` (G1 nennt den Index nicht). Ein
  Quelltext-Test sichert, dass Knopf und Farbwähler genau sie aufrufen. `ScreenOutputSection.tsx` nimmt `FARBE` aus
  `FARBE_MUSTER` (eine Regel statt zwei gleicher); der Verdrahtungs-Test des Fundaments bleibt wortgleich grün.
- `quellregeln.test.ts` bekommt außer der Daten-Prop `backgroundDefault` die Menge `RUECKRUFE` mit
  `DataLinkSectionProps.onFolderText`: Die Regel wertet jeden Prop-Namen auf „…Text“ als Text-Prop, auch einen Rückruf
  (Gegenprobe 5 zeigt den Fund). Der Registername bleibt so, wie C8 und Block C ihn erwarten.
- Standardfarbe und Farbwähler erscheinen nur neben einem **gemeldeten** Wert (wie das Textfeld seit dem Fundament, G6);
  `backgroundDefault` muss eine gültige Farbe sein. Bei ungültigem Text im Feld zeigt der Farbwähler `#000000`, weil ein
  `<input type="color">` nur `#rrggbb` annimmt.
- Neu, über die Gliederung hinaus: Kreuz „Pfadfeld/Ordner entfernen sichtbar“ (24 Fälle, gerendert), „Status mit den neuen
  Bildschirm-Props wie die alte Tabelle“ (108 Fälle), „nie 0 Einträge/Dateien“, „ok nur mit Zahl über 0“ (je 1152 Fälle).
- Galerie: drei Beispiele (`datalink-show`, `datalink-pfadfeld`, `bildschirm-farbwaehler`) mit Soll-Zustand `ok` und
  Marken je Modus; alle Abschnitte zeigen weiter ok, Warnung, Fehler, aus/unbekannt, gesperrt, Fehlertext.
- Die Gliederung verlangt das Pfadfeld „immer im `PanelAnker`“: Das sichert ein eigener Test (der Abschnitt beginnt mit dem
  Anker `einstellung-datalink`, das Feld steht darin). Dazu Gegenprobe 7 (Pfadfeld bei `locked` frei).
- `packages/ui` und `packages/settings` sind auf `5e5b234ec3` byte-gleich mit dem Stand der früheren Vorlage; jede Vorher-Stelle
  und jeder Zählstand ist trotzdem auf `5e5b234ec3` neu gemessen (Block A ändert beide Pakete nicht).

---


### Task 7: C7 · Titler-Testwerkzeug: `tsconfig.test.json`, Oberflächentests als zweiter `tsx`-Lauf, `@jm/settings`, `@source`

**Spec:** 11 (Render-Tests ohne Browser mit `renderToStaticMarkup` unter `tsx`; Selbsttest der App), 3.10 und Fundament RF1
(Klassen nur über `@source`), 6 (der Titler nutzt `@jm/settings`), Fundament „Nach der Umsetzung“ (`@source` für
`packages/settings/src` im Pilot). Entscheidungen E16 (zwei Läufe, `tsconfig.test.json` erfasst nur `test/ui/**`), E17
(Lock-Zeile von Hand). Ist-Karten: Bau/Doku 3, 4, 6, 7, 8 (gemessen: ohne eigenes tsconfig scheitern Aliase und JSX, der Link
`node_modules/@jm/settings` fehlt im Worktree, die `@source`-Zeile fehlt), UI-API 6–8 und 10 (Klassen-Probe, Render-Test unter
`tsx --tsconfig`, eigener Zähler des alten Selbsttests). Global Constraints G1, G9, G10, G11, G12, G13, G14, G15, G16.

**Voraussetzung:** Plan-Worktree nach C6 (C5 und C6 zuerst, damit die Klassen-Probe die neuen `@jm/settings`-Klassen
sieht). `npm run selftest -w @jm/titler` grün (Stand nach C4). Den Link prüft Step 0.

**Dateien:**
- Create: `apps/titler/tsconfig.test.json` (Register S-B3)
- Create: `apps/titler/test/ui/selftest.ts` (Einstieg des zweiten Laufs, Einfügemarke `abschluss();`)
- Create: `apps/titler/test/ui/hilfe.ts` (Kopie von `kreuz`, `fallText`, `pruefeFaelle`, `vergleiche` aus
  `packages/settings/test/hilfe.ts`; die Paket-Testhilfen sind nicht exportiert)
- Create: `apps/titler/test/ui/werkzeug.test.tsx` (Werkzeug und Verdrahtung)
- Modify: `apps/titler/package.json` (Skripte `typecheck:test`, `typecheck`, `selftest`; Abhängigkeit `@jm/settings`
  zwischen `@jm/ndi` und `@jm/show`; keine Version, G15)
- Modify: `package-lock.json` (eine Zeile `"@jm/settings": "*",` im Block `apps/titler`, zwischen `:742` und `:743`)
- Modify: `apps/titler/src/renderer/src/globals.css` (zweite `@source`-Zeile direkt nach `:3`)
- Modify: `.github/workflows/ci-checks.yml` (Name des Titler-Schritts `:62` und eine Kommentarzeile; der Job bleibt bei 22
  Schritten)

**Interfaces:**
- Consumes: `@jm/ui/testhilfe` (`ok`, `gleich`, `enthaelt`, `render`, `pruefeIdVerweise`, `leseText`, `abschluss`),
  `TallyButton` (`@jm/ui`), `NdiOutputSection` (`@jm/settings`), `zaehlerText` (`@/lib/datalink-anzeige`), `DEFAULT_CONFIG`
  (`@shared/types`).
- Produces (Register S-B3, exakt):
  - `apps/titler/tsconfig.test.json`:
    ```json
    { "extends": "./tsconfig.web.json",
      "compilerOptions": { "composite": false, "types": ["node"] },
      "include": ["test/ui/**/*.ts", "test/ui/**/*.tsx", "src/renderer/src/**/*.ts", "src/renderer/src/**/*.tsx",
                  "src/shared/**/*.ts", "../../packages/ui/src", "../../packages/settings/src"] }
    ```
  - Skripte: `"selftest": "tsx test/selftest.ts && tsx --tsconfig tsconfig.test.json test/ui/selftest.ts"`,
    `"typecheck:test": "tsc --noEmit -p tsconfig.test.json"`,
    `"typecheck": "npm run typecheck:node && npm run typecheck:web && npm run typecheck:test"`.
  - Testmodule hängen sich in `apps/titler/test/ui/selftest.ts` ein: die neue `import`-Zeile direkt vor der Zeile
    `abschluss();` (C8, C9–C13).
  - Testhilfen: `@jm/ui/testhilfe` (ein Zähler je Lauf) sowie `apps/titler/test/ui/hilfe.ts`:
    ```ts
    export type Fall<A extends Record<string, readonly unknown[]>> = { [K in keyof A]: A[K][number] };
    export function kreuz<A extends Record<string, readonly unknown[]>>(achsen: A): Array<Fall<A>>;
    export function fallText(f: Record<string, unknown>): string;
    export function pruefeFaelle<F extends Record<string, unknown>>(msg: string, faelle: readonly F[], pruefe: (f: F) => string | null): void;
    export function vergleiche(ist: string | undefined, soll: string | undefined): string | null;
    ```
  - Module, die `test/selftest.ts` (alter Lauf, ohne `tsconfig.test.json`) lädt, importieren Werte nur relativ; über die
    Aliase `@/` und `@shared/` nur `import type`.
  - Lauf von Hand: `(cd apps/titler && npx tsx --tsconfig tsconfig.test.json test/ui/selftest.ts)`.

**Verhalten (verbindlich):**
- `npm run selftest -w @jm/titler` führt zwei Prozesse nacheinander aus: den alten Selbsttest (eigener Zähler, Schlusszeile
  „ALLE TESTS OK“ oder `process.exit(1)`) und die Oberflächentests (`abschluss()` der Testhilfe, `process.exitCode = 1` bei
  Fehlern). Scheitert der erste, läuft der zweite nicht (`&&`); beide setzen den Exitcode, die CI sieht beide.
- `tsconfig.test.json` erfasst `test/ui/**`, aber nicht `test/selftest.ts`: Dort steht der R2-Typfehler
  `test/selftest.ts(685,…): error TS2339: Property 'showPfad' does not exist on type 'GemerkteShow'` (Befund an R2, E16);
  `typecheck:test` bliebe sonst dauerhaft rot. `tsx` prüft keine Typen, der alte Lauf ist davon nicht berührt.
- Ohne `--tsconfig tsconfig.test.json` scheitert der zweite Lauf (kein `jsx`, keine Pfade `@/…`, `@shared/…`); mit
  `tsconfig.web.json` gehen die Aliase, aber nicht das JSX der Pakete; nur mit `tsconfig.test.json` rendern Titler-, `@jm/ui`-
  und `@jm/settings`-JSX unter Node.
- `@jm/settings` steht in `apps/titler/package.json` und im Lock-Block `apps/titler` in alphabetischer Reihenfolge (zwischen
  `@jm/ndi` und `@jm/show`); der Test vergleicht beide Listen. Den Link `node_modules/@jm/settings` legt `npm ci` an (CI;
  im Plan-Worktree der Controller, G13).
- `globals.css` scannt `packages/settings/src` mit `@source`; sonst fehlen Klassen der Abschnitte im gebauten CSS (Review
  Focus 5).

---

- [ ] **Step 0: Vorprüfung: Link `node_modules/@jm/settings` und Ausgangswert des alten Laufs** (kein Code)

```
test -d node_modules/@jm/settings/src && echo LINK-OK || echo LINK-FEHLT
node -e "console.log(require('fs').realpathSync('node_modules/@jm/settings'))"
(cd apps/titler && npx tsx test/selftest.ts) > <eigener Scratchpad>/c7-alt-vorher.txt 2>&1; echo "Exit=$?"
grep -cE "^\s*ok\b" <eigener Scratchpad>/c7-alt-vorher.txt
```
Erwartet (gemessen in der Kopie): `LINK-OK`, dann `<worktree>\packages\settings`, dann `Exit=0` und die Zahl der `ok`-Zeilen
des alten Laufs nach C4: `538` (512 auf `5e5b234ec3`, dazu 21 aus Task 3 und 5 aus Task 4). Der alte Lauf ändert sich
in C7 und C8 nicht. Bei `LINK-FEHLT` hier anhalten und melden (G16): Der Link entsteht nur durch `npm ci --ignore-scripts`, und das
ist Sache des Controllers (G13). Ohne ihn bricht jeder Import über den Paketnamen mit `ERR_MODULE_NOT_FOUND` ab.

- [ ] **Step 1: Fehlschlagende Werkzeug-Tests schreiben** (Create `apps/titler/test/ui/werkzeug.test.tsx`)

```tsx
// UX-Pilot C7 · Werkzeug der Titler-Oberflächentests (Spec 11): tsx mit tsconfig.test.json rendert JSX aus @jm/ui und
// @jm/settings, löst die Aliase @/ und @shared/ auf und zählt mit EINEM Zähler (@jm/ui/testhilfe). Dazu statische Wächter
// der Verdrahtung, die in der CI mitlaufen: Skripte, Abhängigkeit samt Lock-Zeile, @source für @jm/settings.
// Arbeitsverzeichnis ist apps/titler (npm run selftest -w @jm/titler); leseText liest relativ dazu.
import { NdiOutputSection } from '@jm/settings';
import { TallyButton } from '@jm/ui';
import { enthaelt, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { zaehlerText } from '@/lib/datalink-anzeige';
import { DEFAULT_CONFIG } from '@shared/types';
import { fallText, kreuz, pruefeFaelle, vergleiche } from './hilfe';

{
  const html = render(<TallyButton state="live" label="Take" onClick={() => {}} />);
  enthaelt(html, 'data-state="live"', 'Werkzeug: TallyButton aus @jm/ui rendert unter tsx (live)');
  enthaelt(html, '>LIVE<', 'Werkzeug: TallyButton live zeigt die Kennung LIVE');
}
{
  const html = render(<NdiOutputSection id="ndi" enabled sourceName="JM Titler" capabilities={{ toggle: true, rename: true }} />);
  enthaelt(html, 'an (ohne Rückmeldung)', 'Werkzeug: NdiOutputSection aus @jm/settings rendert unter tsx (an, ohne Rückmeldung)');
  pruefeIdVerweise(html, 'Werkzeug: id-Verweise im gerenderten Abschnitt gültig');
}
{
  gleich(zaehlerText(1, 5), 'Einträge · 2/5', 'Werkzeug: Alias @/ lädt einen Wert aus dem Renderer (lib/datalink-anzeige)');
  gleich(DEFAULT_CONFIG.ndiName, 'JM Titler', 'Werkzeug: Alias @shared/ lädt einen Wert (shared/types)');
}
{
  const faelle = kreuz({ a: [1, 2], b: ['x', 'y', 'z'] } as const);
  gleich(faelle.map(fallText), ['a=1 b="x"', 'a=1 b="y"', 'a=1 b="z"', 'a=2 b="x"', 'a=2 b="y"', 'a=2 b="z"'], 'Werkzeug: kreuz bildet das volle Kreuzprodukt in fester Reihenfolge');
  gleich([fallText({ a: undefined }), vergleiche('a', 'a'), vergleiche('a', undefined)], ['a=undefined', null, 'ist: a soll: undefined'], 'Werkzeug: fallText zeigt undefined, vergleiche meldet ist/soll');
  pruefeFaelle('Werkzeug: pruefeFaelle schreibt eine Zeile je Tabelle', faelle, (f) => (f.a > 0 ? null : 'nie'));
}
{
  const paket = JSON.parse(leseText('package.json'));
  gleich(
    paket.scripts.selftest,
    'tsx test/selftest.ts && tsx --tsconfig tsconfig.test.json test/ui/selftest.ts',
    'Werkzeug: selftest ruft beide Läufe (alter Selbsttest mit eigenem Zähler, dann die Oberfläche)',
  );
  ok(
    paket.scripts.typecheck === 'npm run typecheck:node && npm run typecheck:web && npm run typecheck:test' &&
      paket.scripts['typecheck:test'] === 'tsc --noEmit -p tsconfig.test.json',
    'Werkzeug: typecheck prüft auch die Oberflächentests (typecheck:test ist verkettet, sonst sähe die CI sie nicht)',
  );
  ok(paket.dependencies['@jm/settings'] === '*', 'Werkzeug: @jm/settings ist Abhängigkeit des Titlers');
  const lock = JSON.parse(leseText('../../package-lock.json'));
  gleich(lock.packages['apps/titler'].dependencies, paket.dependencies, 'Werkzeug: Abhängigkeiten in package.json und im Lock-Block apps/titler gleich');
}
{
  const css = leseText('src/renderer/src/globals.css');
  ok(
    css.includes('@source "../../../../../packages/ui/src";') && css.includes('@source "../../../../../packages/settings/src";'),
    'Werkzeug: globals.css scannt @jm/ui und @jm/settings (@source), sonst fehlen Klassen der Einstellungs-Abschnitte',
  );
}
```

Neue Datei `apps/titler/test/ui/hilfe.ts`:
```ts
// Testhilfen der Titler-Oberflächentests (UX-Pilot C7): lokale Kopie von kreuz, fallText, pruefeFaelle und vergleiche aus
// packages/settings/test/hilfe.ts (dort nicht exportiert). Gezählt wird mit der @jm/ui-Testhilfe (ein Zähler je Lauf).
import { ok } from '@jm/ui/testhilfe';

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
```

Neue Datei `apps/titler/test/ui/selftest.ts`:
```ts
// Titler-Oberflächentests (Suite-UX-Update Welle 0, Spec 11): Render ohne Browser und reine Ableitungen, mit
// @jm/ui/testhilfe in einem eigenen tsx-Lauf mit tsconfig.test.json (jsx, Aliase @/ und @shared/). Der alte Selbsttest
// test/selftest.ts hat einen eigenen Zähler und läuft vorher als eigener Prozess (package.json, selftest).
// Einfügemarke: neue Testmodule als eigene import-Zeile direkt vor der Zeile `abschluss();`.
import { abschluss } from '@jm/ui/testhilfe';
import './werkzeug.test';
abschluss();
```

- [ ] **Step 2: Lauf ohne eigenes tsconfig (rot)**

```
(cd apps/titler && npx tsx test/ui/selftest.ts); echo "Exit=$?"
```
Erwartet (gemessen):
```
node:internal/modules/package_json_reader:301
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/lib' imported from <worktree>\apps\titler\test\ui\werkzeug.test.tsx
…
Exit=1
```
Ohne `--tsconfig` nimmt `tsx` `apps/titler/tsconfig.json`; das hat nur `references`, also weder Pfade noch `jsx`.

- [ ] **Step 3: Test-tsconfig anlegen** (Create `apps/titler/tsconfig.test.json`)

```json
{
  "extends": "./tsconfig.web.json",
  "compilerOptions": { "composite": false, "types": ["node"] },
  "include": [
    "test/ui/**/*.ts",
    "test/ui/**/*.tsx",
    "src/renderer/src/**/*.ts",
    "src/renderer/src/**/*.tsx",
    "src/shared/**/*.ts",
    "../../packages/ui/src",
    "../../packages/settings/src"
  ]
}
```

- [ ] **Step 4: Lauf mit dem Test-tsconfig (noch rot: Verdrahtung fehlt)**

```
(cd apps/titler && npx tsx --tsconfig tsconfig.test.json test/ui/selftest.ts); echo "Exit=$?"
```
Erwartet (gemessen):
```
ok   Werkzeug: TallyButton aus @jm/ui rendert unter tsx (live)
ok   Werkzeug: TallyButton live zeigt die Kennung LIVE
ok   Werkzeug: NdiOutputSection aus @jm/settings rendert unter tsx (an, ohne Rückmeldung)
ok   Werkzeug: id-Verweise im gerenderten Abschnitt gültig
ok   Werkzeug: Alias @/ lädt einen Wert aus dem Renderer (lib/datalink-anzeige)
ok   Werkzeug: Alias @shared/ lädt einen Wert (shared/types)
ok   Werkzeug: kreuz bildet das volle Kreuzprodukt in fester Reihenfolge
ok   Werkzeug: fallText zeigt undefined, vergleiche meldet ist/soll
ok   Werkzeug: pruefeFaelle schreibt eine Zeile je Tabelle (6 Fälle)
FAIL Werkzeug: selftest ruft beide Läufe (alter Selbsttest mit eigenem Zähler, dann die Oberfläche)
     ist: "tsx test/selftest.ts" soll: "tsx test/selftest.ts && tsx --tsconfig tsconfig.test.json test/ui/selftest.ts"
FAIL Werkzeug: typecheck prüft auch die Oberflächentests (typecheck:test ist verkettet, sonst sähe die CI sie nicht)
FAIL Werkzeug: @jm/settings ist Abhängigkeit des Titlers
ok   Werkzeug: Abhängigkeiten in package.json und im Lock-Block apps/titler gleich
FAIL Werkzeug: globals.css scannt @jm/ui und @jm/settings (@source), sonst fehlen Klassen der Einstellungs-Abschnitte

4 FEHLGESCHLAGEN
Exit=1
```
Das Rendern und die Aliase gehen jetzt; rot ist nur noch die Verdrahtung. („gleich“ stimmt hier, weil beide Listen noch ohne
`@jm/settings` sind.)

- [ ] **Step 5: Skripte und Abhängigkeit** (`apps/titler/package.json`)

Vorher:
```json
    "typecheck": "npm run typecheck:node && npm run typecheck:web",
    "selftest": "tsx test/selftest.ts",
```
Nachher:
```json
    "typecheck:test": "tsc --noEmit -p tsconfig.test.json",
    "typecheck": "npm run typecheck:node && npm run typecheck:web && npm run typecheck:test",
    "selftest": "tsx test/selftest.ts && tsx --tsconfig tsconfig.test.json test/ui/selftest.ts",
```
Vorher:
```json
    "@jm/ndi": "*",
    "@jm/show": "*",
```
Nachher:
```json
    "@jm/ndi": "*",
    "@jm/settings": "*",
    "@jm/show": "*",
```

- [ ] **Step 6: Lock-Zeile von Hand** (`package-lock.json`, Block `apps/titler`; E17)

Vorher:
```json
        "@jm/ndi": "*",
        "@jm/show": "*",
        "@jm/suite-control-protocol": "*",
        "@jm/ui": "*",
        "ag-psd": "^30.1.1",
```
Nachher:
```json
        "@jm/ndi": "*",
        "@jm/settings": "*",
        "@jm/show": "*",
        "@jm/suite-control-protocol": "*",
        "@jm/ui": "*",
        "ag-psd": "^30.1.1",
```
Prüfen (Gleichlauf und gültiges JSON):
```
node -e "const l = require('./package-lock.json'); const p = require('./apps/titler/package.json').dependencies; console.log(JSON.stringify(l.packages['apps/titler'].dependencies) === JSON.stringify(p) ? 'gleich' : 'ANDERS', Object.keys(p).length, l.packages['node_modules/@jm/settings'].resolved)"
```
Erwartet (gemessen): `gleich 12 packages/settings`. (`npm install --package-lock-only` läuft im Plan nicht, E17; ob `npm ci` die Zeile ohne
weiteren Nachtrag annimmt, zeigt erst die CI, siehe „Nach der Umsetzung“.)

- [ ] **Step 7: `@source` für `@jm/settings`** (`apps/titler/src/renderer/src/globals.css`, direkt nach `:3`)

Vorher:
```css
@source "../../../../../packages/ui/src";
```
Nachher:
```css
@source "../../../../../packages/ui/src";
@source "../../../../../packages/settings/src";
```

- [ ] **Step 8: CI-Schrittname** (`.github/workflows/ci-checks.yml`; kein neuer Schritt)

Vorher:
```yaml
      # Master-Link Teil 2b (Spec 9.5): DataLink-Kern und Datenquelle des Titlers, mit tsx, ohne Electron.
      - name: Titler (DataLink-Schlüssel, Datenquelle)
```
Nachher:
```yaml
      # Master-Link Teil 2b (Spec 9.5): DataLink-Kern und Datenquelle des Titlers, mit tsx, ohne Electron.
      # Suite-UX-Update Welle 0 (Spec 11): derselbe Befehl startet danach die Oberflächentests (Render ohne Browser).
      - name: Titler (DataLink-Schlüssel, Datenquelle, Oberfläche)
```

- [ ] **Step 9: Selbsttest grün (beide Läufe)**

```
npm run selftest -w @jm/titler > <eigener Scratchpad>/c7-gruen.txt 2>&1; echo "Exit=$?"
grep -E "^> |ALLE TESTS OK|FEHLGESCHLAGEN" <eigener Scratchpad>/c7-gruen.txt
grep -cE "^\s*ok\b" <eigener Scratchpad>/c7-gruen.txt
(cd apps/titler && npx tsx --tsconfig tsconfig.test.json test/ui/selftest.ts) 2>&1 | grep -c "^ok "
```
Erwartet (gemessen):
```
Exit=0
> @jm/titler@0.11.0 selftest
> tsx test/selftest.ts && tsx --tsconfig tsconfig.test.json test/ui/selftest.ts
ALLE TESTS OK
ALLE TESTS OK
552
14
```
`552` = 538 (alter Lauf nach Task 4) + 14 Zeilen des neuen Laufs; die letzte Zahl zählt nur den neuen Lauf. Zwei
Schlusszeilen `ALLE TESTS OK`, je Lauf eine.

- [ ] **Step 10: Typprüfung (mit `typecheck:test`)**

```
npm run typecheck -w @jm/titler; echo "Exit=$?"
```
Erwartet (gemessen): drei `tsc`-Läufe (`typecheck:node`, `typecheck:web`, `typecheck:test`) ohne Meldung, `Exit=0`.

- [ ] **Step 11: Bau und Klassen-Probe auf dem Titler-CSS** (Review Focus 5)

```
npm run build -w @jm/titler; echo "Exit=$?"
(cd packages/ui && npx tsx galerie/pruefe-klassen.ts --css ../../apps/titler/out/renderer/assets); echo "Exit=$?"
```
Erwartet (gemessen): `electron-vite build` ohne Fehler (main, preload, renderer; das Electron-Programm wird dafür nicht
gebraucht), Renderer-CSS 51,58 kB, `Exit=0`; dann 20 `ok`-Zeilen ohne `--ohne-settings`:
```
ok   Klassen-Probe: CSS in <worktree>\apps\titler\out\renderer\assets (index-….css)
ok   Klassen-Probe: 13 neue Tokens definiert
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
ok   Klassen-Probe: 39 Klassen aus className="…" in packages/settings/src im CSS
Hinweis: 6 davon stehen nur in packages/settings/src (border-l-2 pl-2 break-all h-1.5 bg-[var(--tally-ready)] motion-reduce:transition-none); nur sie zeigen ein fehlendes @source "../../settings/src".

ALLE TESTS OK
Exit=0
```
Vor C7 meldet dieselbe Probe auf `5e5b234ec3` ohne den Schalter `1 FEHLGESCHLAGEN` (Ist-Karte Bau/Doku 7). Der Bau schreibt
nur nach `apps/titler/out/` (per `.gitignore` ignoriert). Das Preload-Bündel bleibt bei 4246 Byte wie nach
Task 4.

- [ ] **Step 12: Gegenproben** (vorübergehend; jede genau zurücknehmen)

Nichts davon wird gestagt. Nach jeder Probe die Änderung genau zurücknehmen (Nachher → Vorher) und den jeweiligen grünen Lauf
wiederholen.

1. **Ohne Test-tsconfig:** Der Lauf aus Step 2 ist die erste Gegenprobe (`ERR_MODULE_NOT_FOUND` für `@/lib`). Dazu mit dem
   Renderer-tsconfig, das `test/ui` nicht erfasst:
   ```
   (cd apps/titler && npx tsx --tsconfig tsconfig.web.json test/ui/selftest.ts); echo "Exit=$?"
   ```
   Erwartet (gemessen): Die Aliase gehen, JSX nicht:
   ```
   <worktree>\apps\titler\test\ui\werkzeug.test.tsx:13
     const html = render(<TallyButton state="live" label="Take" onClick={() => {}} />);
                         ^

   ReferenceError: React is not defined
   …
   Exit=1
   ```
   (`tsx` wendet `jsx` nur auf Dateien im `include` des gewählten tsconfig an; Ist-Karte UI-API 7.)
2. **`@source` für `@jm/settings` fehlt:** in `apps/titler/src/renderer/src/globals.css` die neue Zeile
   `@source "../../../../../packages/settings/src";` entfernen, `npm run build -w @jm/titler`, dann die Probe aus Step 11.
   Erwartet (gemessen): Renderer-CSS 50,49 kB, 19 `ok`, `Exit=1`:
   ```
   FAIL Klassen-Probe: 39 Klassen aus className="…" in packages/settings/src im CSS – fehlt: border-l-2 pl-2 space-y-3 break-all bg-[var(--secondary)] bg-[var(--tally-ready)] motion-reduce:transition-none p-3 w-10
   Hinweis: 6 davon stehen nur in packages/settings/src (border-l-2 pl-2 break-all h-1.5 bg-[var(--tally-ready)] motion-reduce:transition-none); nur sie zeigen ein fehlendes @source "../../settings/src".
   1 FEHLGESCHLAGEN
   ```
   Der Oberflächen-Lauf fängt dasselbe ohne Bau:
   `FAIL Werkzeug: globals.css scannt @jm/ui und @jm/settings (@source), sonst fehlen Klassen der Einstellungs-Abschnitte`,
   `1 FEHLGESCHLAGEN`, `Exit=1`. Zeile zurück, **neu bauen**, Probe wieder 20 `ok`.
3. **`typecheck:test` über alle Tests** (Beleg für E16): in `apps/titler/tsconfig.test.json` `"test/ui/**/*.ts",` und
   `"test/ui/**/*.tsx",` durch `"test/**/*.ts",` und `"test/**/*.tsx",` ersetzen, dann `npm run typecheck:test -w @jm/titler`.
   Erwartet (gemessen), `Exit=2`, genau ein Fehler:
   ```
   test/selftest.ts(685,113): error TS2339: Property 'showPfad' does not exist on type 'GemerkteShow'.
   ```
   Block A fügt in `test/selftest.ts` nur Blöcke vor `if (failed > 0) {` (`:1398`) ein; die Stelle `:685` bleibt.
4. **Lock-Zeile fehlt:** in `package-lock.json` die Zeile `        "@jm/settings": "*",` im Block `apps/titler` entfernen, dann
   `(cd apps/titler && npx tsx --tsconfig tsconfig.test.json test/ui/selftest.ts); echo "Exit=$?"`. Erwartet (gemessen):
   `FAIL Werkzeug: Abhängigkeiten in package.json und im Lock-Block apps/titler gleich` mit
   `ist: {…"@jm/ndi":"*","@jm/show":"*",…} soll: {…"@jm/ndi":"*","@jm/settings":"*","@jm/show":"*",…}`, `1 FEHLGESCHLAGEN`,
   `Exit=1`.
5. **Typfehler in einem Oberflächentest** (Beleg, dass `typecheck:test` gebraucht wird): ans Ende von
   `apps/titler/test/ui/werkzeug.test.tsx` die Zeile `const typFehler: number = 'a';` anhängen, dann
   `npm run typecheck -w @jm/titler; echo "Exit=$?"`. Erwartet (gemessen): `typecheck:node` und `typecheck:web` ohne Meldung
   (sie erfassen `test/ui` nicht), dann
   ```
   test/ui/werkzeug.test.tsx(55,7): error TS2322: Type 'string' is not assignable to type 'number'.
   …
   Exit=2
   ```
   Zeile wieder entfernen; `typecheck` wieder `Exit=0`.

- [ ] **Step 13: CI-Datei, Schrittzahl, Zeilenenden**

```
node -e "const y = require('js-yaml').load(require('fs').readFileSync('.github/workflows/ci-checks.yml', 'utf8')); console.log(Object.entries(y.jobs).map(([k, j]) => k + ' ' + j.steps.length).join(', ')); console.log(y.jobs.selftests.steps.filter((s) => s.run === 'npm run selftest -w @jm/titler').map((s) => s.name).join())"
node -e "for (const f of process.argv.slice(1)) { const t = require('fs').readFileSync(f, 'utf8'); const n = (t.match(/\n/g) || []).length, c = (t.match(/\r\n/g) || []).length; console.log(f, n, c, c === 0 || c === n ? 'einheitlich' : 'GEMISCHT'); }" apps/titler/package.json package-lock.json apps/titler/src/renderer/src/globals.css .github/workflows/ci-checks.yml apps/titler/tsconfig.test.json apps/titler/test/ui/selftest.ts apps/titler/test/ui/hilfe.ts apps/titler/test/ui/werkzeug.test.tsx
```
Erwartet (gemessen):
```
typecheck 4, selftests 22, secret-scan 3, audit 4
Titler (DataLink-Schlüssel, Datenquelle, Oberfläche)
apps/titler/package.json 52 52 einheitlich
package-lock.json 17661 17661 einheitlich
apps/titler/src/renderer/src/globals.css 63 63 einheitlich
.github/workflows/ci-checks.yml 128 128 einheitlich
apps/titler/tsconfig.test.json 13 0 einheitlich
apps/titler/test/ui/selftest.ts 7 0 einheitlich
apps/titler/test/ui/hilfe.ts 39 0 einheitlich
apps/titler/test/ui/werkzeug.test.tsx 54 0 einheitlich
```
Maßgeblich: geänderte Dateien `einheitlich` (im Worktree alle vier `w/crlf`), neue ohne CRLF, Job `selftests` mit 22
Schritten. `ci-checks.yml` hat nach Task 2 127 Zeilen, nach dieser Aufgabe 128 (je eine Kommentarzeile).

- [ ] **Step 14: Commit** (Bash-Werkzeug; Commit-Text ohne Umlaute)

```
git add apps/titler/test/ui/werkzeug.test.tsx apps/titler/test/ui/hilfe.ts apps/titler/test/ui/selftest.ts apps/titler/tsconfig.test.json apps/titler/package.json package-lock.json apps/titler/src/renderer/src/globals.css .github/workflows/ci-checks.yml
git status --short
```
Erwartet genau (fremde `??`-Zeilen bleiben ungestaged):
```
M  .github/workflows/ci-checks.yml
M  apps/titler/package.json
M  apps/titler/src/renderer/src/globals.css
A  apps/titler/test/ui/hilfe.ts
A  apps/titler/test/ui/selftest.ts
A  apps/titler/test/ui/werkzeug.test.tsx
A  apps/titler/tsconfig.test.json
M  package-lock.json
```
Dann:
```
git commit -m "test(titler): Oberflaechentests als zweiter tsx-Lauf, @jm/settings und @source (UX-Pilot C7)" -m "tsconfig.test.json (extends tsconfig.web.json, include test/ui, Renderer, shared, packages/ui/src, packages/settings/src) gibt tsx jsx und die Aliase @/ und @shared/; selftest ruft danach test/ui/selftest.ts mit @jm/ui/testhilfe (eigener Zaehler je Lauf), Testhilfen kreuz/fallText/pruefeFaelle/vergleiche in test/ui/hilfe.ts. typecheck verkettet typecheck:test, nur test/ui (der R2-Typfehler in test/selftest.ts:685 bleibt draussen, Befund an R2). @jm/settings als Abhaengigkeit, Lock-Zeile von Hand, Gleichlauf im Test. globals.css scannt packages/settings/src; Klassen-Probe auf dem gebauten Titler-CSS ohne --ohne-settings gruen. CI-Schrittname ergaenzt, Job bleibt bei 22 Schritten." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Step 0 misst außer dem Link auch den Ausgangswert des alten Laufs. Die Gliederung nennt 512; das ist der Stand vor Block A.
  Nach Task 3 und 4 sind es 538 (beim Zusammensetzen gemessen).
- Der Gleichlauf von `package.json` und Lock-Block steht zusätzlich als Test im Oberflächen-Lauf (läuft in der CI mit), nicht
  nur als `node -e` im Plan. Ebenso die Skripte und die `@source`-Zeile (statische Wächter, wie `galerie.test.tsx` für die
  Galerie).
- Der Werkzeug-Test prüft `kreuz`, `fallText`, `vergleiche` und `pruefeFaelle` aus `test/ui/hilfe.ts` einmal selbst; C8 nutzt
  sie nur.
- Der CI-Schritt bekommt eine zweite Kommentarzeile statt einer geänderten: Die vorhandene Zeile nennt Teil 2b und bleibt
  wörtlich.
- C7 nutzt aus Block A nichts. Gegenprobe 3 ist mit Block A nachgemessen: `test/selftest.ts` bekommt in Task 3 und 4 nur
  Blöcke vor `if (failed > 0) {`, `typecheck:test` über `test/**` meldet weiter genau den einen Fehler an `:685`.

---

### Task 8: C8 · Titler-Ableitungen: Abschnitts-Props, Statusleiste, Haupttasten, Texte (`lib/oberflaeche.ts`)

**Spec:** 5.1 (Live-Tool: Statusleiste, höchstens vier Haupttasten), 6 (Abschnitte aus `@jm/settings`, `locked`,
ausblenden statt ausgrauen), 7.1–7.4 (Kreuzprodukt je Eintrag, unbekannt ist nicht ok, nur Gemessenes, `live` nie in der
Statusleiste), Anhang A „Titler“ (Statuseinträge, Haupttasten, Einstellungen). Entscheidungen E4 (Master-Stufen), E6
(Fernsteuerung), E7 (NDI ohne Senderrückmeldung), E8 (Bildschirm ohne Fensterrückmeldung), E9 (iveo), E10 (DataLink), E11
(On-Air nicht in der Leiste), E12 (Haupttasten), E18 (V-Zeile als `StatusPill`), E20 (ids, Gruppen, Labels), OF2
(„Fernsteuerung“), OF5 (kein „Im Launcher einrichten“), OF7 (R2-Sperrsatz), OF8 (Texte T2–T7, T10, T11). Global Constraints
G5, G6, G7, G9, G10, G11, G12, G16. Review Focus 1 und 3.

**Voraussetzung:** Plan-Worktree nach C7: `npm run selftest -w @jm/titler` grün mit zwei Läufen (Oberflächen-Lauf **14**
`ok`, alter Lauf **538**). Aus Block A gebraucht (Register, exakt): `apps/titler/src/shared/fernsteuerung.ts` mit
`STEUER_PORT`, `FernsteuerungMeldung`, `portBelegt` und `TitlerStatus.fernsteuerung?` (C3, S-A3); `MasterLinkMeldungZeile`
in `apps/titler/src/shared/types.ts` (C4, S-A4). Aus C5 `masterLinkStatusItem`, aus C6 die neuen Props von DataLink und
Bildschirm, aus C7 `test/ui/hilfe.ts` und der Oberflächen-Lauf.

**Dateien:**
- Create: `apps/titler/src/renderer/src/lib/oberflaeche.ts` (rein, ohne `window`)
- Create: `apps/titler/test/ui/oberflaeche.test.ts`
- Modify: `apps/titler/test/ui/selftest.ts` (Import-Zeile direkt vor `abschluss();`)

**Interfaces:**
- Consumes:
  ```ts
  // S-A3 (C3) · apps/titler/src/shared/fernsteuerung.ts und shared/types.ts
  export const STEUER_PORT = 8726;
  export interface FernsteuerungMeldung { laeuft: boolean; port: number; clients: number; modus?: 'open' | 'secure'; fehler?: string }
  export function portBelegt(m: FernsteuerungMeldung | undefined): boolean;   // fehler enthält 'EADDRINUSE'
  // TitlerStatus (+): fernsteuerung?: FernsteuerungMeldung   (undefined = noch keine Meldung)
  // S-A4 (C4) · apps/titler/src/shared/types.ts
  export type MasterLinkMeldungZeile =
    | { art: 'aus' } | { art: 'sucht' } | { art: 'verbindet'; adresse: string }
    | { art: 'verbunden'; adresse: string; seit: number; masterName: string; suite: string }
    | { art: 'fehler'; code: string; text: string; errCode?: string }
    | { art: 'ohne-client' };
  // S-B1 (C5): masterLinkStatusItem(m) aus @jm/ui · S-B2 (C6): externeQuelle, eintraege, onClearFolder,
  // capabilities.ordnerText, onFolderText (DataLink), backgroundDefault, capabilities.backgroundPicker (Bildschirm)
  // S-B3 (C7): kreuz, pruefeFaelle, vergleiche aus test/ui/hilfe.ts; Einfügemarke abschluss(); in test/ui/selftest.ts
  // Bestand: navGesperrt(activeEntry, anzahl) aus @/lib/datalink-anzeige; im Test ordnerWahlGesperrt, quellZeile,
  // zurueckKnopf aus @shared/datenquelle (dieselben Funktionen, mit denen der Main die Datenquelle meldet)
  ```
- Produces (Register S-B4, exakt; die Texte stehen wörtlich in Step 3):
  ```ts
  // apps/titler/src/renderer/src/lib/oberflaeche.ts
  export const ABSCHNITT = { iveo: 'iveo', ndi: 'ndi', bildschirm: 'bildschirm', fernsteuerung: 'fernsteuerung', datalink: 'datalink', stil: 'stil', vorlagen: 'vorlagen' } as const;
  export interface OberflaechenStand {
    config: TitlerConfig; status: TitlerStatus;
    displays: DisplayInfo[] | undefined;                    // undefined = Liste noch nicht geladen (E8)
    masterLink: MasterLinkMeldungZeile | null | undefined;  // aus useBrueckenWert (undefined offen, null ohne Brücke)
  }
  export interface TitlerAktionen {
    setConfig(patch: PartialTitlerConfig): void; startNdi(name: string): void; stopNdi(): void;
    pickFolder(): void; zurueckZumEigenenOrdner(): void;
  }
  export function iveoAbschnitt(s: OberflaechenStand): IveoSectionProps;
  export function ndiAbschnitt(s: OberflaechenStand, a: TitlerAktionen): NdiOutputSectionProps;
  export function bildschirmAbschnitt(s: OberflaechenStand, a: TitlerAktionen): ScreenOutputSectionProps;
  export function fernsteuerungAbschnitt(s: OberflaechenStand): RemoteControlSectionProps;
  export function dataLinkAbschnitt(s: OberflaechenStand, a: TitlerAktionen): DataLinkSectionProps;
  export function statusLeiste(s: OberflaechenStand): StatusItem[];   // Reihenfolge master-link, iveo, ndi, bildschirm, fernsteuerung, datalink (E20)
  export function verbundZeileZustand(farbe: VerbundAnzeigeZeile['farbe']): StatusState;   // gruen ok, gelb warn, rot error, gedaempft off
  export interface TasteZustand { state: 'bereit' | 'live' | 'gesperrt'; disabledReason?: string }
  export function hauptTasten(live: boolean, activeEntry: number, anzahl: number):
    { take: TasteZustand; clear: TasteZustand; eintrag: { zurueck: TasteZustand; weiter: TasteZustand } | null };
  export const TITLER_TEXTE = {
    take, clear, zurueck, weiter, ersterEintrag, letzterEintrag,
    hinweisNdiAn, hinweisNdiAus, keinOrdner, keineGrafik, keineVorlagen,
    stil, vorlagen, loeschen, loeschenAria: (name: string) => string,
    laedt, aufloesungUngerade, companionModul,
    label: { iveo, ndi, bildschirm, fernsteuerung, datalink },
  } as const;   // Werte wörtlich in Step 3 und in der Tabelle unten
  ```
  `TITLER_TEXTE` (OF8; Herkunft je Schlüssel):

  | Schlüssel | Text | Herkunft |
  | --- | --- | --- |
  | `take`, `clear`, `zurueck`, `weiter` | „Take“, „Clear“, „◀ Eintrag“, „Eintrag ▶“ | T3 |
  | `ersterEintrag`, `letzterEintrag` | „Erster Eintrag“, „Letzter Eintrag“ | T3 |
  | `hinweisNdiAn` | „NDI-Quelle aktiv — in TriCaster/vMix/OBS als Eingang über das vorhandene Programm legen (Alpha/Key).“ | heutiger Text Nr. 9 (NDI an), wörtlich |
  | `hinweisNdiAus` | „NDI unter Einstellungen › NDI-Ausgabe starten, damit die transparente Quelle im Netz erscheint. Vorschau läuft auch ohne NDI.“ | T4 |
  | `keinOrdner` | „Kein Datenordner aktiv. Unter Einstellungen › DataLink einen Ordner wählen — oder den Titler über eine JM Show mit iveo-Daten öffnen. Abrufbare Einträge erscheinen dann hier.“ | T5 (Nr. 29, „Im Reiter“ → „Unter“) |
  | `keineGrafik` | „Keine Grafik-Vorlage gewählt — unter „Grafik-Vorlagen“ auswählen oder unter Einstellungen › Grafik-Vorlagen importieren.“ | T6a |
  | `keineVorlagen` | „Noch keine Vorlagen. Import unter Einstellungen › Grafik-Vorlagen.“ | T6b |
  | `stil`, `vorlagen`, `loeschen` | „Stil“, „Grafik-Vorlagen“, „Löschen“ | T7 |
  | `loeschenAria(name)` | „Vorlage „{name}“ löschen“ | T7 |
  | `laedt` | „Lädt…“ | T11 (wie heute im Operator) |
  | `aufloesungUngerade` | „Auflösung sollte gerade sein.“ | heutiger Text Nr. 54 |
  | `companionModul` | „jm-suite“ | T10 |
  | `label.*` | „iveo“, „NDI“, „Bildschirm“, „Fernsteuerung“, „DataLink“ | T2, OF2 |

  Verbraucher: C9 (`statusLeiste`, `verbundZeileZustand`, Panel-Anker aus `ABSCHNITT`), C10 (`hauptTasten`, `TITLER_TEXTE`),
  C11 (die fünf `…Abschnitt`-Funktionen, `ABSCHNITT.stil`/`.vorlagen`, `TITLER_TEXTE.stil`/`.vorlagen`/`.loeschen…`), C12
  (`TITLER_TEXTE.laedt`).

**Verhalten (verbindlich):**
- **Statusleiste** in fester Reihenfolge, ids = Panel-Anker (E20):

  | id | Gruppe | Label | Quelle | Abschnitt |
  | --- | --- | --- | --- | --- |
  | `master-link` | verbindung | Master | `masterLinkStatusItem(masterLink)` | – |
  | `iveo` | verbindung | iveo | `iveoView(iveoAbschnitt)` | `iveo` |
  | `ndi` | ausgabe | NDI | `ndiOutputView(ndiAbschnitt)`, Detail „{n} Empfänger“ | `ndi` |
  | `bildschirm` | ausgabe | Bildschirm | `screenOutputView(bildschirmAbschnitt)` | `bildschirm` |
  | `fernsteuerung` | fernsteuerung | Fernsteuerung | `remoteControlView(fernsteuerungAbschnitt)` | `fernsteuerung` |
  | `datalink` | tool | DataLink | `dataLinkView(dataLinkAbschnitt)` | `datalink` |

  Nie `live` (On-Air steht im Kopf, E11). Statusleiste und Panel nutzen dieselben Ableitungen (eine Wahrheit); für die Leiste
  bekommen die Ableitungen ein No-op-Aktionsobjekt.
- **Master (E4):** die 12 Eingänge aus C5 mit denselben Stufen, in der Titler-Form `MasterLinkMeldungZeile`.
- **iveo (E9):** gebunden bei Datenquelle `show` oder `master`; kein Hinweis → `delivery: 'ok'` („verbunden“), Quell-Hinweis
  H3/H4/H7 → `'veraltet'` („Liste aus früherem Stand“), Kern-Hinweis H1/H2/H5/H6 → `undefined` („unbekannt“: er kann nach
  `RANG` einen Quell-Hinweis verdecken). Bei Quelle `master` ist die Master-Link-Meldung eine Eingangsgröße: nur mit
  `verbunden` gilt die Regel davor; bei `ohne-client`, `aus`, `sucht`, `verbindet` und `fehler` werden „verbunden“ und der
  Quell-Hinweis zu `'veraltet'` (der Kern-Hinweis bleibt „unbekannt“); bei offener Brücke, ohne Brücke oder einer unbekannten
  Art „unbekannt“. Das Kreuz hat dafür die Achse Master-Link (9 Werte, 576 Fälle). `speakerCount` = Zahl der Einträge nur
  gebunden; kein Event, keine Bühne, kein Launcher-Knopf (OF5).
- **NDI (E7):** `enabled = ndiActive`; `sending` nie gesetzt (→ „an (ohne Rückmeldung)“); `receivers` nur bei
  `ndiActive && connections > 0`; Fähigkeiten `toggle`, `rename`, `resolution`, `fps` (keine Transparenz); Auflösungen
  1920×1080 und 1280×720, Bildraten 25/30/50/60 wie bisher; ungerade Breite oder Höhe → `error` „Auflösung sollte gerade
  sein.“ (das Kreuz prüft beide je für sich). `networkName` bleibt ungesetzt (E7, OF6).
  Schalter an ruft `startNdi(config.ndiName)`, aus `stopNdi()`; Name, Auflösung, Bildrate über `setConfig`, fremde Werte werden
  ignoriert. Ein leerer Name zeigt den Abschnitts-Hinweis „Kein Quellenname eingetragen.“.
- **Bildschirm (E8):** `enabled = secondScreenEnabled`; `windowOpen` nie gesetzt; `screens` aus der Monitorliste, `undefined`
  bis zur ersten Antwort; `selectedId` 0 → `null`; Fähigkeiten `toggle`, `background`, `backgroundPicker`;
  `backgroundDefault` = `DEFAULT_CONFIG.chromaColor` (#00B140). `onSelect(null)` → `secondScreenDisplay: 0`.
- **Fernsteuerung (E6, OF2, OF5):** ohne Meldung „unbekannt“; `laeuft` false ohne Fehler „aus“; Fehler mit `EADDRINUSE` →
  nur `portInUse` („Port belegt“, kein `error`); anderer Fehler → `error` („Fehler: …“); läuft → „bereit · {n} verbunden“.
  Port aus der Meldung (über 0), sonst `STEUER_PORT`; Modus aus der Meldung (der des laufenden Servers); `companionModule`
  „jm-suite“; kein Port-Feld, kein „Im Launcher einrichten“, kein `restartRequired` („Neustart nötig“ erst mit OF6, E6).
- **DataLink (E10, OF4, OF7):** `folder` = eigener Ordner (`config.dataFolder`); `dataError` „Ordner nicht gefunden“ (Text aus
  `main/datalink.ts:137`) → `folderMissing`, jeder andere → `error`; `externeQuelle` bei `show`, `master`, `frueher`;
  `eintraege` = Zahl der Einträge; Quellzeile Q1–Q4 und Hinweis H1–H7 als fertige Texte; K1 nur mit Text aus dem Main;
  `locked` = R2-Satz `datenQuelle.ordnerGesperrt` wörtlich; Pfadfeld an; `onClearFolder` (→ `setConfig({ dataFolder: '' })`)
  ist auch bei Sperre gesetzt, dann ist der Knopf sichtbar gesperrt (C6) und meldet nichts.
- **V-Zeile (E18):** `verbundZeileZustand` bildet gruen/gelb/rot/gedaempft auf ok/warn/error/off ab; eine unbekannte Farbe ist
  `off`; nie `live`.
- **Haupttasten (E12):** Take `live` genau bei live, sonst `bereit`, nie gesperrt; Clear immer `bereit`; ◀/▶ Eintrag nur mit
  mindestens einem Eintrag, sonst `null`; an den Rändern gesperrt mit „Erster Eintrag“ bzw. „Letzter Eintrag“ (wie
  `navGesperrt`, ohne aktiven Eintrag beide frei). Keine Kürzel (UO5).
- `lib/oberflaeche.ts` liest kein `window`, kein `localStorage`, kein IPC (G7); ein Test liest den Quelltext.

---

- [ ] **Step 1: Fehlschlagende Tests schreiben** (Create `apps/titler/test/ui/oberflaeche.test.ts`)

```ts
// UX-Pilot C8 · Titler-Ableitungen (Spec 5.1, 6, 7.1–7.4, Anhang A „Titler“): Statusleiste als Kreuzprodukt je Eintrag mit
// Erwartungstabelle (E4, E6–E10, E20), V-Zeile (E18), Abschnitts-Props, Haupttasten (E12), Aktionen, Texte (OF8).
// Ohne window und ohne Electron (G7).
import { ndiOutputView, remoteControlView } from '@jm/settings';
import { ordneStatus, type StatusItem } from '@jm/ui';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import { ordnerWahlGesperrt, quellZeile, zurueckKnopf, type QuellZustand } from '@shared/datenquelle';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import { DEFAULT_CONFIG, type DisplayInfo, type MasterLinkMeldungZeile, type TitlerConfig, type TitlerStatus, type VerbundAnzeigeZeile } from '@shared/types';
import {
  ABSCHNITT,
  bildschirmAbschnitt,
  dataLinkAbschnitt,
  fernsteuerungAbschnitt,
  hauptTasten,
  iveoAbschnitt,
  ndiAbschnitt,
  statusLeiste,
  TITLER_TEXTE,
  verbundZeileZustand,
  type OberflaechenStand,
  type TasteZustand,
  type TitlerAktionen,
} from '@/lib/oberflaeche';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';

// ── Fixtures ──
const STATUS: TitlerStatus = {
  ndiActive: false,
  connections: 0,
  suiteClients: 0,
  variables: {},
  dataSources: [],
  entries: [],
  activeEntry: -1,
  datenQuelle: { art: 'ordner', zeile: '', zurueckKnopf: null, ohneOrdner: true },
};
const PRIMAER: DisplayInfo = { id: 11, label: '2560×1440 (primär)', bounds: { x: 0, y: 0, width: 2560, height: 1440 }, size: { width: 2560, height: 1440 }, scaleFactor: 1, primary: true, internal: false };
const ZWEITER: DisplayInfo = { id: 22, label: '1920×1080', bounds: { x: 2560, y: 0, width: 1920, height: 1080 }, size: { width: 1920, height: 1080 }, scaleFactor: 1, primary: false, internal: false };

interface Teil {
  config?: Partial<TitlerConfig>;
  status?: Partial<TitlerStatus>;
  displays?: DisplayInfo[] | undefined;
  masterLink?: MasterLinkMeldungZeile | null | undefined;
}
function stand(teil: Teil = {}): OberflaechenStand {
  return {
    config: { ...DEFAULT_CONFIG, ...teil.config },
    status: { ...STATUS, ...teil.status },
    displays: 'displays' in teil ? teil.displays : [PRIMAER, ZWEITER],
    masterLink: 'masterLink' in teil ? teil.masterLink : { art: 'aus' },
  };
}
const eintraege = (n: number): TitlerStatus['entries'] => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, label: `Person ${i + 1}` }));
const eintrag = (s: OberflaechenStand, id: string): StatusItem => statusLeiste(s).find((i) => i.id === id) as StatusItem;
const sd = (i: StatusItem): string => `${i.state} ${i.detail ?? ''}`;
const KEINE: TitlerAktionen = { setConfig: () => {}, startNdi: () => {}, stopNdi: () => {}, pickFolder: () => {}, zurueckZumEigenenOrdner: () => {} };
function aufzeichner(): { log: unknown[]; a: TitlerAktionen } {
  const log: unknown[] = [];
  return {
    log,
    a: {
      setConfig: (p) => log.push(['setConfig', p]),
      startNdi: (n) => log.push(['startNdi', n]),
      stopNdi: () => log.push(['stopNdi']),
      pickFolder: () => log.push(['pickFolder']),
      zurueckZumEigenenOrdner: () => log.push(['zurueck']),
    },
  };
}

// ── Master (die 12 Eingänge aus C5 in der Titler-Form, über statusLeiste; E4) ──
{
  const faelle: Array<{ name: string; m: MasterLinkMeldungZeile | null | undefined; soll: string }> = [
    { name: 'undefined', m: undefined, soll: 'off unbekannt' },
    { name: 'null', m: null, soll: 'off unbekannt' },
    { name: 'ohne-client', m: { art: 'ohne-client' }, soll: 'warn nicht gestartet' },
    { name: 'aus', m: { art: 'aus' }, soll: 'off aus' },
    { name: 'sucht', m: { art: 'sucht' }, soll: 'warn sucht …' },
    { name: 'verbindet a1', m: { art: 'verbindet', adresse: '10.0.0.5:8740' }, soll: 'warn verbindet …' },
    { name: 'verbindet a2', m: { art: 'verbindet', adresse: '10.0.0.7:8740' }, soll: 'warn verbindet …' },
    { name: 'verbunden', m: { art: 'verbunden', adresse: '10.0.0.5:8740', seit: 1000, masterName: 'Regie-PC', suite: 'JM Production Suite' }, soll: 'ok verbunden mit Regie-PC' },
    { name: 'verbunden ohne Namen', m: { art: 'verbunden', adresse: '10.0.0.5:8740', seit: 1000, masterName: '', suite: 'JM Production Suite' }, soll: 'ok verbunden' },
    { name: 'fehler nicht-gefunden', m: { art: 'fehler', code: 'nicht-gefunden', text: 'Master nicht gefunden', errCode: 'ETIMEDOUT' }, soll: 'error Master nicht gefunden' },
    { name: 'fehler datei', m: { art: 'fehler', code: 'datei', text: 'Kopplungsdatei beschädigt. Neu koppeln.' }, soll: 'error Kopplungsdatei beschädigt. Neu koppeln.' },
    { name: 'unbekannte Art', m: { art: 'neu' } as unknown as MasterLinkMeldungZeile, soll: 'off unbekannt' },
  ];
  pruefeFaelle('Statusleiste Master: 12 Eingänge → Zustand und Detail wie C5, Gruppe verbindung, ohne Abschnitt', faelle, (f) => {
    const i = eintrag(stand({ masterLink: f.m }), 'master-link');
    return vergleiche(sd(i), f.soll) ?? (i.group !== 'verbindung' || i.label !== 'Master' || i.settingsSection !== undefined ? 'Kopf falsch' : null);
  });
}

// ── iveo (E9): bei Quelle master ist die Master-Link-Meldung eine Eingangsgröße ──
{
  const LINK: Record<string, MasterLinkMeldungZeile | null | undefined> = {
    offen: undefined,
    keine: null,
    ohne: { art: 'ohne-client' },
    aus: { art: 'aus' },
    sucht: { art: 'sucht' },
    verbindet: { art: 'verbindet', adresse: '10.0.0.5:8740' },
    fehler: { art: 'fehler', code: 'verweigert', text: 'Master antwortet nicht auf 8738. Ist der Master-Modus dort eingeschaltet?' },
    verbunden: { art: 'verbunden', adresse: '10.0.0.5:8740', seit: 1, masterName: 'Regie-PC', suite: 'JM Production Suite' },
    neu: { art: 'neu' } as unknown as MasterLinkMeldungZeile,
  };
  const faelle = kreuz({
    art: ['ordner', 'frueher', 'show', 'master'],
    hinweis: ['–', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7'],
    entries: [0, 3],
    link: ['offen', 'keine', 'ohne', 'aus', 'sucht', 'verbindet', 'fehler', 'verbunden', 'neu'],
  } as const);
  // Tabelle: Zeile = Datenquelle (bei master je Master-Link-Meldung), Spalte = kein Hinweis | Quell-Hinweis H3/H4/H7 |
  // Kern-Hinweis H1/H2/H5/H6. Ohne Bindung und bei Quelle show ändert die Meldung nichts.
  const NICHT: [string, string, string] = ['off nicht eingerichtet', 'off nicht eingerichtet', 'off nicht eingerichtet'];
  const LIEFERT: [string, string, string] = ['ok verbunden', 'warn Liste aus früherem Stand', 'off unbekannt'];
  const GETRENNT: [string, string, string] = ['warn Liste aus früherem Stand', 'warn Liste aus früherem Stand', 'off unbekannt'];
  const OFFEN: [string, string, string] = ['off unbekannt', 'off unbekannt', 'off unbekannt'];
  const IVEO: Record<string, [string, string, string]> = {
    ordner: NICHT,
    frueher: NICHT,
    show: LIEFERT,
    'master|verbunden': LIEFERT,
    'master|ohne': GETRENNT,
    'master|aus': GETRENNT,
    'master|sucht': GETRENNT,
    'master|verbindet': GETRENNT,
    'master|fehler': GETRENNT,
    'master|offen': OFFEN,
    'master|keine': OFFEN,
    'master|neu': OFFEN,
  };
  const spalte = (h: string): number => (h === '–' ? 0 : ['H3', 'H4', 'H7'].includes(h) ? 1 : 2);
  const props = (f: (typeof faelle)[number]): OberflaechenStand =>
    stand({
      masterLink: LINK[f.link],
      status: {
        datenQuelle: { art: f.art, zeile: '', zurueckKnopf: null, ohneOrdner: false },
        hinweis: f.hinweis === '–' ? undefined : { art: f.hinweis, text: `Hinweis ${f.hinweis}` },
        entries: eintraege(f.entries),
      },
    });
  pruefeFaelle('Statusleiste iveo Kreuzprodukt: Datenquelle × Hinweis × Einträge × Master-Link → Tabelle (E9; bei master ok nur mit verbundenem Link)', faelle, (f) =>
    vergleiche(sd(eintrag(props(f), 'iveo')), IVEO[f.art === 'master' ? `master|${f.link}` : f.art][spalte(f.hinweis)]),
  );
  pruefeFaelle('iveo-Abschnitt: Speakerzahl = Einträge nur bei Show und Master; kein Event, keine Bühne, kein Launcher-Knopf (OF5)', faelle, (f) => {
    const p = iveoAbschnitt(props(f));
    const soll = f.art === 'show' || f.art === 'master' ? f.entries : undefined;
    return vergleiche(`${p.speakerCount}/${p.eventName}/${p.stage}/${p.onOpenLauncher}`, `${soll}/undefined/undefined/undefined`);
  });
}

// ── NDI (E7) ──
{
  const faelle = kreuz({ ndiActive: [false, true], connections: [0, 2], ndiName: ['', 'JM Titler'], aufloesung: ['1920x1080', '1921x1080', '1920x1081'] } as const);
  // Tabelle: Zeile = Auflösung|an|Empfänger (der Name ändert den Status nicht); ungerade Breite und ungerade Höhe je für sich.
  const MASS: Record<string, { width: number; height: number }> = {
    '1920x1080': { width: 1920, height: 1080 },
    '1921x1080': { width: 1921, height: 1080 },
    '1920x1081': { width: 1920, height: 1081 },
  };
  const NDI: Record<string, string> = {
    '1920x1080|false|0': 'off aus',
    '1920x1080|false|2': 'off aus',
    '1920x1080|true|0': 'warn an (ohne Rückmeldung)',
    '1920x1080|true|2': 'warn 2 Empfänger · an (ohne Rückmeldung)',
    '1921x1080|false|0': 'error Fehler: Auflösung sollte gerade sein.',
    '1921x1080|false|2': 'error Fehler: Auflösung sollte gerade sein.',
    '1921x1080|true|0': 'error Fehler: Auflösung sollte gerade sein.',
    '1921x1080|true|2': 'error 2 Empfänger · Fehler: Auflösung sollte gerade sein.',
    '1920x1081|false|0': 'error Fehler: Auflösung sollte gerade sein.',
    '1920x1081|false|2': 'error Fehler: Auflösung sollte gerade sein.',
    '1920x1081|true|0': 'error Fehler: Auflösung sollte gerade sein.',
    '1920x1081|true|2': 'error 2 Empfänger · Fehler: Auflösung sollte gerade sein.',
  };
  const props = (f: (typeof faelle)[number]): OberflaechenStand =>
    stand({ config: { ndiName: f.ndiName, ...MASS[f.aufloesung] }, status: { ndiActive: f.ndiActive, connections: f.connections } });
  pruefeFaelle('Statusleiste NDI Kreuzprodukt: an/aus × Empfänger × Name × Auflösung → Tabelle (E7)', faelle, (f) =>
    vergleiche(sd(eintrag(props(f), 'ndi')), NDI[`${f.aufloesung}|${f.ndiActive}|${f.connections}`]),
  );
  pruefeFaelle('Statusleiste NDI: nie ok, sending nie gesetzt, Empfänger nur bei an und über 0 (keine Rückmeldung des Senders)', faelle, (f) => {
    const p = ndiAbschnitt(props(f), KEINE);
    const i = eintrag(props(f), 'ndi');
    const soll = f.ndiActive && f.connections > 0 ? f.connections : undefined;
    return i.state === 'ok' || p.sending !== undefined || p.receivers !== soll ? `state ${i.state} sending ${p.sending} receivers ${p.receivers}` : null;
  });
  pruefeFaelle('NDI-Abschnitt: leerer Quellenname zeigt „Kein Quellenname eingetragen.“', faelle, (f) =>
    vergleiche(ndiOutputView(ndiAbschnitt(props(f), KEINE)).hinweis, f.ndiName === '' ? 'Kein Quellenname eingetragen.' : undefined),
  );
}

// ── Bildschirm (E8) ──
{
  const LISTEN: Record<string, DisplayInfo[] | undefined> = { unbekannt: undefined, leer: [], primaer: [PRIMAER], zwei: [PRIMAER, ZWEITER] };
  const faelle = kreuz({ enabled: [false, true], liste: ['unbekannt', 'leer', 'primaer', 'zwei'], wahl: [0, 22, 9999] } as const);
  // Tabelle: Zeile = Monitorliste|Wahl (0 = automatisch, 22 = zweiter Monitor, 9999 = abgezogen), Spalten = aus, an.
  const BILDSCHIRM: Record<string, [string, string]> = {
    'unbekannt|0': ['off unbekannt', 'off unbekannt'],
    'unbekannt|22': ['off unbekannt', 'off unbekannt'],
    'unbekannt|9999': ['off unbekannt', 'off unbekannt'],
    'leer|0': ['off aus', 'error Bildschirm fehlt'],
    'leer|22': ['error Bildschirm fehlt', 'error Bildschirm fehlt'],
    'leer|9999': ['error Bildschirm fehlt', 'error Bildschirm fehlt'],
    'primaer|0': ['off aus', 'warn an (ohne Rückmeldung)'],
    'primaer|22': ['error Bildschirm fehlt', 'error Bildschirm fehlt'],
    'primaer|9999': ['error Bildschirm fehlt', 'error Bildschirm fehlt'],
    'zwei|0': ['off aus', 'warn an (ohne Rückmeldung)'],
    'zwei|22': ['off aus', 'warn an (ohne Rückmeldung)'],
    'zwei|9999': ['error Bildschirm fehlt', 'error Bildschirm fehlt'],
  };
  const props = (f: (typeof faelle)[number]): OberflaechenStand =>
    stand({ config: { secondScreenEnabled: f.enabled, secondScreenDisplay: f.wahl }, displays: LISTEN[f.liste] });
  pruefeFaelle('Statusleiste Bildschirm Kreuzprodukt: an/aus × Monitorliste × Wahl → Tabelle (E8)', faelle, (f) =>
    vergleiche(sd(eintrag(props(f), 'bildschirm')), BILDSCHIRM[`${f.liste}|${f.wahl}`][f.enabled ? 1 : 0]),
  );
  pruefeFaelle('Statusleiste Bildschirm: nie ok, windowOpen nie gesetzt, Wahl 0 = automatisch (null)', faelle, (f) => {
    const p = bildschirmAbschnitt(props(f), KEINE);
    const state = eintrag(props(f), 'bildschirm').state;
    return state === 'ok' || p.windowOpen !== undefined || p.selectedId !== (f.wahl === 0 ? null : f.wahl) ? `state ${state} windowOpen ${p.windowOpen} selectedId ${p.selectedId}` : null;
  });
}

// ── Fernsteuerung (E6, OF2, OF5) ──
{
  const MELDUNG: Record<string, FernsteuerungMeldung | undefined> = {
    keine: undefined,
    aus: { laeuft: false, port: 8726, clients: 0 },
    belegt: { laeuft: false, port: 8726, clients: 0, fehler: 'listen EADDRINUSE: address already in use :::8726' },
    fehler: { laeuft: false, port: 8726, clients: 0, fehler: 'listen EACCES: permission denied 0.0.0.0:8726' },
    bereit0: { laeuft: true, port: 8726, clients: 0 },
    bereit3: { laeuft: true, port: 8726, clients: 3 },
  };
  const FERN: Record<string, string> = {
    keine: 'off unbekannt',
    aus: 'off aus',
    belegt: 'error Port belegt',
    fehler: 'error Fehler: listen EACCES: permission denied 0.0.0.0:8726',
    bereit0: 'ok bereit · 0 verbunden',
    bereit3: 'ok bereit · 3 verbunden',
  };
  const faelle = kreuz({ meldung: ['keine', 'aus', 'belegt', 'fehler', 'bereit0', 'bereit3'], modus: [undefined, 'open', 'secure'] } as const);
  const props = (f: (typeof faelle)[number]): OberflaechenStand => {
    const m = MELDUNG[f.meldung];
    return stand({ status: { fernsteuerung: m === undefined ? undefined : { ...m, modus: f.modus } } });
  };
  pruefeFaelle('Statusleiste Fernsteuerung Kreuzprodukt: Meldung × Modus → Tabelle (E6; „Port belegt“ nur bei EADDRINUSE)', faelle, (f) =>
    vergleiche(sd(eintrag(props(f), 'fernsteuerung')), FERN[f.meldung]),
  );
  pruefeFaelle('Fernsteuerung-Abschnitt: Port 8726, Modus aus der Meldung, Modul jm-suite, kein Port-Feld, kein „Im Launcher einrichten“ (OF5)', faelle, (f) => {
    const p = fernsteuerungAbschnitt(props(f));
    const v = remoteControlView(p);
    const modus = f.meldung === 'keine' ? 'unbekannt' : f.modus === 'secure' ? 'gesichert' : f.modus === 'open' ? 'offen' : 'unbekannt';
    return vergleiche(
      `${p.port}/${v.modusText}/${p.companionModule}/${p.onOpenLauncher}/${v.sichtbar.imLauncher}/${v.sichtbar.portFeld}/${v.sichtbar.companion}/${p.error === undefined || !p.portInUse}`,
      `8726/${modus}/jm-suite/undefined/false/false/true/true`,
    );
  });
  gleich(
    [fernsteuerungAbschnitt(stand({ status: { fernsteuerung: { laeuft: true, port: 9000, clients: 1 } } })).port, fernsteuerungAbschnitt(stand({ status: { fernsteuerung: { laeuft: false, port: 0, clients: 0 } } })).port],
    [9000, 8726],
    'Fernsteuerung-Abschnitt: Port aus der Meldung, ohne gültigen Port STEUER_PORT (E6)',
  );
}

// ── DataLink (E10, OF4, OF7): Datenquelle so gerechnet wie im Main (uebernimmDataState) ──
const R2_SATZ = 'Im Verbund kommen die Speaker vom Master „Regie-PC“. Ein eigener Ordner gilt, solange die Show dort keine Speaker hat.';
{
  const ORDNER = 'D:\\Daten';
  const faelle = kreuz({
    art: ['ordner', 'frueher', 'show', 'master'],
    dataFolder: ['', ORDNER],
    dataError: [undefined, 'Ordner nicht gefunden', 'EACCES: permission denied, scandir'],
    entries: [0, 5],
  } as const);
  const quelle = (art: QuellZustand['art']): QuellZustand => ({
    art,
    showPfad: art === 'show' ? 'D:\\Shows\\Gala.jmshow' : null,
    showName: art === 'show' || art === 'master' ? 'Gala' : null,
    quellHinweis: null,
    master: art === 'master' ? { masterId: 'M1', masterName: 'Regie-PC', schluessel: null } : null,
  });
  const props = (f: (typeof faelle)[number]): OberflaechenStand => {
    const q = quelle(f.art);
    const gesperrt = ordnerWahlGesperrt(q);
    return stand({
      config: { dataFolder: f.dataFolder },
      status: {
        dataError: f.dataError,
        entries: eintraege(f.entries),
        hinweis: { art: 'H3', text: 'Liste aus früherem Stand: Die Show enthält gerade keine Speaker.' },
        datenQuelle: {
          art: f.art,
          zeile: quellZeile(q, f.dataFolder, f.entries),
          zurueckKnopf: zurueckKnopf(q, f.dataFolder),
          ohneOrdner: f.art === 'ordner' && f.dataFolder === '',
          ...(gesperrt ? { ordnerGesperrt: gesperrt } : {}),
        },
      },
    });
  };
  // Tabelle: Fehler gehen vor; ohne Fehler „kein Ordner“ nur bei eigener Quelle ohne Ordner, sonst die Zahl der Einträge.
  const FEHLERBILD: Record<string, string | null> = {
    undefined: null,
    'Ordner nicht gefunden': 'error Ordner fehlt',
    'EACCES: permission denied, scandir': 'error Fehler: EACCES: permission denied, scandir',
  };
  const NACH_ZAHL: Record<string, string> = { '0': 'warn keine Einträge', '5': 'ok 5 Einträge' };
  pruefeFaelle('Statusleiste DataLink Kreuzprodukt: Quelle × eigener Ordner × Fehler × Einträge → Tabelle (E10)', faelle, (f) => {
    const soll = FEHLERBILD[String(f.dataError)] ?? (f.art === 'ordner' && f.dataFolder === '' ? 'off kein Ordner' : NACH_ZAHL[String(f.entries)]);
    return vergleiche(sd(eintrag(props(f), 'datalink')), soll);
  });
  pruefeFaelle('DataLink-Abschnitt: Sperre = R2-Satz nur bei Master, K1 genau mit Text aus dem Main, Quellzeile und Hinweis durchgereicht, Entfernen und Pfadfeld immer (OF4, OF7)', faelle, (f) => {
    const s = props(f);
    const p = dataLinkAbschnitt(s, KEINE);
    const k1 = s.status.datenQuelle.zurueckKnopf;
    const ist = `${p.locked}/${p.backLabel}/${typeof p.onBack}/${p.sourceLine}/${p.notice}/${typeof p.onClearFolder}/${p.capabilities?.ordnerText}/${typeof p.onFolderText}/${p.externeQuelle}/${p.eintraege}/${p.folder}`;
    const soll = `${f.art === 'master' ? R2_SATZ : undefined}/${k1 ?? undefined}/${k1 ? 'function' : 'undefined'}/${s.status.datenQuelle.zeile}/${s.status.hinweis?.text}/function/true/function/${f.art !== 'ordner'}/${f.entries}/${f.dataFolder}`;
    return vergleiche(ist, soll);
  });
  {
    const p = dataLinkAbschnitt(props({ art: 'master', dataFolder: ORDNER, dataError: undefined, entries: 5 }), KEINE);
    ok(p.locked === R2_SATZ && p.backLabel === undefined && typeof p.onClearFolder === 'function', 'DataLink bei Master: gesperrt mit dem R2-Satz, ohne K1, „Ordner entfernen“ bleibt (sichtbar gesperrt)');
    const show = dataLinkAbschnitt(props({ art: 'show', dataFolder: '', dataError: undefined, entries: 5 }), KEINE);
    ok(show.externeQuelle === true && show.folder === '' && show.eintraege === 5, 'DataLink bei Show ohne eigenen Ordner: fremde Quelle mit 5 Einträgen (statt „kein Ordner“)');
  }
  ok(leseText('src/main/datalink.ts').includes("error: 'Ordner nicht gefunden'"), 'DataLink: main/datalink.ts meldet weiter „Ordner nicht gefunden“ (Gleichlauf mit folderMissing)');
}

// ── Statusleiste gesamt ──
{
  const MELDUNG: Record<string, FernsteuerungMeldung | undefined> = {
    keine: undefined,
    belegt: { laeuft: false, port: 8726, clients: 0, fehler: 'listen EADDRINUSE: address already in use :::8726' },
    bereit3: { laeuft: true, port: 8726, clients: 3, modus: 'secure' },
  };
  const MASTER: Record<string, MasterLinkMeldungZeile | null | undefined> = {
    offen: undefined,
    keine: null,
    ohne: { art: 'ohne-client' },
    verbunden: { art: 'verbunden', adresse: '10.0.0.5:8740', seit: 1, masterName: 'Regie-PC', suite: 'JM Production Suite' },
    fehler: { art: 'fehler', code: 'verweigert', text: 'Master antwortet nicht auf 8738. Ist der Master-Modus dort eingeschaltet?' },
  };
  const faelle = kreuz({
    master: ['offen', 'keine', 'ohne', 'verbunden', 'fehler'],
    ndiActive: [false, true],
    fern: ['keine', 'belegt', 'bereit3'],
    art: ['ordner', 'show', 'master'],
    liste: ['unbekannt', 'zwei'],
    secondScreenEnabled: [false, true],
  } as const);
  const props = (f: (typeof faelle)[number]): OberflaechenStand =>
    stand({
      masterLink: MASTER[f.master],
      displays: f.liste === 'zwei' ? [PRIMAER, ZWEITER] : undefined,
      config: { secondScreenEnabled: f.secondScreenEnabled },
      status: {
        ndiActive: f.ndiActive,
        connections: f.ndiActive ? 2 : 0,
        fernsteuerung: MELDUNG[f.fern],
        entries: eintraege(f.art === 'ordner' ? 0 : 4),
        datenQuelle: { art: f.art, zeile: '', zurueckKnopf: null, ohneOrdner: f.art === 'ordner', ...(f.art === 'master' ? { ordnerGesperrt: R2_SATZ } : {}) },
      },
    });
  const IDS = ['master-link', 'iveo', 'ndi', 'bildschirm', 'fernsteuerung', 'datalink'];
  pruefeFaelle('Statusleiste gesamt: Reihenfolge master-link, iveo, ndi, bildschirm, fernsteuerung, datalink, ids eindeutig, schon nach Gruppen geordnet', faelle, (f) => {
    const leiste = statusLeiste(props(f));
    const ids = leiste.map((i) => i.id).join();
    return vergleiche(ids, IDS.join()) ?? (new Set(leiste.map((i) => i.id)).size !== leiste.length ? 'ids doppelt' : null) ?? vergleiche(ordneStatus(leiste).map((i) => i.id).join(), ids);
  });
  pruefeFaelle('Statusleiste gesamt: jeder Eintrag außer Master springt in seinen Abschnitt (settingsSection = id aus ABSCHNITT)', faelle, (f) => {
    const falsch = statusLeiste(props(f)).filter((i) =>
      i.id === 'master-link' ? i.settingsSection !== undefined : i.settingsSection !== i.id || !(Object.values(ABSCHNITT) as string[]).includes(i.id),
    );
    return falsch.length === 0 ? null : `falsch: ${falsch.map((i) => i.id).join()}`;
  });
  pruefeFaelle('Statusleiste gesamt: nie live (Spec 7.4, E11)', faelle, (f) => (statusLeiste(props(f)).some((i) => i.state === 'live') ? 'live' : null));
  gleich(
    statusLeiste(stand()).map((i) => `${i.group}:${i.label}`),
    ['verbindung:Master', 'verbindung:iveo', 'ausgabe:NDI', 'ausgabe:Bildschirm', 'fernsteuerung:Fernsteuerung', 'tool:DataLink'],
    'Statusleiste: Gruppen und Labels (T2, OF2)',
  );
}

// ── V-Zeile in der Kopfmitte (E18) ──
{
  const FARBEN: Array<[VerbundAnzeigeZeile['farbe'], string]> = [['gruen', 'ok'], ['gelb', 'warn'], ['rot', 'error'], ['gedaempft', 'off']];
  gleich(FARBEN.map(([f]) => verbundZeileZustand(f)), FARBEN.map(([, z]) => z), 'V-Zeile: gruen ok, gelb warn, rot error, gedaempft off (E18)');
  gleich(verbundZeileZustand('lila' as unknown as VerbundAnzeigeZeile['farbe']), 'off', 'V-Zeile: unbekannte Farbe ist off, nie ok und nie live');
}

// ── Haupttasten (E12) ──
{
  const faelle = kreuz({ live: [false, true], activeEntry: [-1, 0, 2, 4], anzahl: [0, 1, 5] } as const);
  // Tabelle ◀/▶ Eintrag: Zeile = Anzahl|aktiver Eintrag → null (keine Tasten) oder [zurück, weiter].
  const NAV: Record<string, [string, string] | null> = {
    '0|-1': null, '0|0': null, '0|2': null, '0|4': null,
    '1|-1': ['frei', 'frei'], '1|0': ['erster', 'letzter'], '1|2': ['frei', 'letzter'], '1|4': ['frei', 'letzter'],
    '5|-1': ['frei', 'frei'], '5|0': ['erster', 'frei'], '5|2': ['frei', 'frei'], '5|4': ['frei', 'letzter'],
  };
  const kurz = (t: TasteZustand): string =>
    t.state === 'bereit' && t.disabledReason === undefined ? 'frei'
      : t.state === 'gesperrt' && t.disabledReason === 'Erster Eintrag' ? 'erster'
        : t.state === 'gesperrt' && t.disabledReason === 'Letzter Eintrag' ? 'letzter'
          : `${t.state}:${t.disabledReason}`;
  pruefeFaelle('Haupttasten Kreuzprodukt: ◀/▶ Eintrag nur mit Einträgen, an den Rändern gesperrt mit Grund → Tabelle', faelle, (f) => {
    const h = hauptTasten(f.live, f.activeEntry, f.anzahl);
    return vergleiche(JSON.stringify(h.eintrag === null ? null : [kurz(h.eintrag.zurueck), kurz(h.eintrag.weiter)]), JSON.stringify(NAV[`${f.anzahl}|${f.activeEntry}`]));
  });
  pruefeFaelle('Haupttasten: Take live genau bei live, sonst bereit, nie gesperrt; Clear immer bereit', faelle, (f) => {
    const h = hauptTasten(f.live, f.activeEntry, f.anzahl);
    return vergleiche(`${h.take.state}/${h.take.disabledReason}/${h.clear.state}/${h.clear.disabledReason}`, `${f.live ? 'live' : 'bereit'}/undefined/bereit/undefined`);
  });
  pruefeFaelle('Haupttasten: jede gesperrte Taste hat einen nicht leeren Grund', faelle, (f) => {
    const h = hauptTasten(f.live, f.activeEntry, f.anzahl);
    const alle = [h.take, h.clear, ...(h.eintrag ? [h.eintrag.zurueck, h.eintrag.weiter] : [])];
    return alle.some((t) => t.state === 'gesperrt' && !t.disabledReason?.trim()) ? 'gesperrt ohne Grund' : null;
  });
}

// ── Aktionen (ohne DOM: die Rückrufe der Abschnitts-Props, mit Aufrufzähler) ──
{
  const { log, a } = aufzeichner();
  const p = ndiAbschnitt(stand({ config: { ndiName: 'Regie Titler' } }), a);
  p.onToggle?.(true);
  p.onToggle?.(false);
  p.onRename?.('Bühne');
  p.onResolution?.('1280x720');
  p.onResolution?.('999x1');
  p.onFps?.('50');
  p.onFps?.('47');
  gleich(
    log,
    [['startNdi', 'Regie Titler'], ['stopNdi'], ['setConfig', { ndiName: 'Bühne' }], ['setConfig', { width: 1280, height: 720 }], ['setConfig', { fps: 50 }]],
    'Aktionen NDI: Schalter startet mit dem Quellenname bzw. stoppt; Name, Auflösung, Bildrate als Config; fremde Werte ignoriert',
  );
  gleich(
    [p.capabilities, p.resolution, p.fps, p.resolutionOptions?.map((o) => o.value), p.fpsOptions?.map((o) => o.value), p.transparency],
    [{ toggle: true, rename: true, resolution: true, fps: true }, '1920x1080', '30', ['1920x1080', '1280x720'], ['25', '30', '50', '60'], undefined],
    'NDI-Abschnitt: Fähigkeiten ohne Transparenz, Auflösungen und Bildraten wie bisher',
  );
}
{
  const { log, a } = aufzeichner();
  const p = bildschirmAbschnitt(stand(), a);
  p.onToggle?.(true);
  p.onSelect?.(null);
  p.onSelect?.(22);
  p.onBackground?.('#123456');
  gleich(
    log,
    [['setConfig', { secondScreenEnabled: true }], ['setConfig', { secondScreenDisplay: 0 }], ['setConfig', { secondScreenDisplay: 22 }], ['setConfig', { chromaColor: '#123456' }]],
    'Aktionen Bildschirm: an/aus, automatisch = 0, Monitor-id, Chroma-Farbe',
  );
  gleich(
    [p.background, p.backgroundDefault, p.capabilities, p.screens?.map((s) => `${s.id}:${s.primary}`)],
    ['#00B140', '#00B140', { toggle: true, background: true, backgroundPicker: true }, ['11:true', '22:false']],
    'Bildschirm-Abschnitt: Chroma-Farbe, Standardfarbe #00B140, Farbwähler, Monitorliste',
  );
}
{
  const { log, a } = aufzeichner();
  const mitK1 = stand({
    config: { dataFolder: 'D:\\Show\\Daten' },
    status: { datenQuelle: { art: 'show', zeile: 'Quelle: Show „Gala“ · 5 Speaker', zurueckKnopf: 'Zurück zum eigenen Ordner (Daten)', ohneOrdner: false } },
  });
  const p = dataLinkAbschnitt(mitK1, a);
  p.onPickFolder?.();
  p.onClearFolder?.();
  p.onFolderText?.('E:\\Neu');
  p.onBack?.();
  gleich(log, [['pickFolder'], ['setConfig', { dataFolder: '' }], ['setConfig', { dataFolder: 'E:\\Neu' }], ['zurueck']], 'Aktionen DataLink: Ordner wählen, entfernen, Pfad von Hand, K1');
}

// ── Texte und Quelltext ──
{
  const texte = Object.values(TITLER_TEXTE).flatMap((t) => (typeof t === 'string' ? [t] : typeof t === 'function' ? [t('X')] : Object.values(t)));
  ok(texte.every((t) => !t.includes('"')), 'Titler-Texte: keine ASCII-Anführungszeichen (G5)');
  gleich(
    [TITLER_TEXTE.take, TITLER_TEXTE.clear, TITLER_TEXTE.zurueck, TITLER_TEXTE.weiter, TITLER_TEXTE.ersterEintrag, TITLER_TEXTE.letzterEintrag],
    ['Take', 'Clear', '◀ Eintrag', 'Eintrag ▶', 'Erster Eintrag', 'Letzter Eintrag'],
    'Titler-Texte: Haupttasten und Gründe wörtlich (T3; ohne „●“, keine Kürzel)',
  );
  gleich(
    [TITLER_TEXTE.hinweisNdiAn, TITLER_TEXTE.hinweisNdiAus],
    [
      'NDI-Quelle aktiv — in TriCaster/vMix/OBS als Eingang über das vorhandene Programm legen (Alpha/Key).',
      'NDI unter Einstellungen › NDI-Ausgabe starten, damit die transparente Quelle im Netz erscheint. Vorschau läuft auch ohne NDI.',
    ],
    'Titler-Texte: Hinweiszeile bei NDI an (wie bisher, Nr. 9) und aus (T4)',
  );
  gleich(
    [TITLER_TEXTE.keinOrdner, TITLER_TEXTE.keineGrafik, TITLER_TEXTE.keineVorlagen],
    [
      'Kein Datenordner aktiv. Unter Einstellungen › DataLink einen Ordner wählen — oder den Titler über eine JM Show mit iveo-Daten öffnen. Abrufbare Einträge erscheinen dann hier.',
      'Keine Grafik-Vorlage gewählt — unter „Grafik-Vorlagen“ auswählen oder unter Einstellungen › Grafik-Vorlagen importieren.',
      'Noch keine Vorlagen. Import unter Einstellungen › Grafik-Vorlagen.',
    ],
    'Titler-Texte: Daten / Recall ohne Ordner (T5) und Grafik (T6a, T6b) nennen die neuen Orte',
  );
  gleich(
    [TITLER_TEXTE.stil, TITLER_TEXTE.vorlagen, TITLER_TEXTE.loeschen, TITLER_TEXTE.loeschenAria('Gala-Insert'), TITLER_TEXTE.laedt, TITLER_TEXTE.aufloesungUngerade, TITLER_TEXTE.companionModul],
    ['Stil', 'Grafik-Vorlagen', 'Löschen', 'Vorlage „Gala-Insert“ löschen', 'Lädt…', 'Auflösung sollte gerade sein.', 'jm-suite'],
    'Titler-Texte: Panel tool-eigen (T7), Laden (T11), ungerade Auflösung (Nr. 54), Companion-Modul (T10)',
  );
  ok(texte.every((t) => !/Reiter|rechts starten/.test(t)), 'Titler-Texte: kein Verweis auf Reiter oder „rechts starten“ (Befund 16)');
  gleich(Object.values(ABSCHNITT), ['iveo', 'ndi', 'bildschirm', 'fernsteuerung', 'datalink', 'stil', 'vorlagen'], 'Abschnitts-ids (E20)');
  const code = leseText('src/renderer/src/lib/oberflaeche.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok(!/\bwindow\b|\blocalStorage\b|\bipcRenderer\b|from ['"]electron['"]/.test(code), 'Quelltext: lib/oberflaeche.ts ohne window, localStorage, IPC und Electron (G7)');
}
```

Einfügen in `apps/titler/test/ui/selftest.ts` direkt vor der Zeile `abschluss();`:
```ts
import './oberflaeche.test';
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/titler; echo "Exit=$?"
```
Erwartet (gemessen; der alte Lauf bleibt grün, der zweite bricht beim Laden ab, weil `@/lib/oberflaeche` fehlt):
```
> tsx test/selftest.ts && tsx --tsconfig tsconfig.test.json test/ui/selftest.ts
…
ALLE TESTS OK
node:internal/modules/package_json_reader:301
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/lib' imported from <worktree>\apps\titler\test\ui\oberflaeche.test.ts
…
Exit=1
```

- [ ] **Step 3: Ableitungen** (Neue Datei `apps/titler/src/renderer/src/lib/oberflaeche.ts`)

```ts
// Titler-Oberfläche: reine Ableitungen (UX-Pilot C8; Spec 5.1, 6, 7.1–7.4, Anhang A „Titler“). Aus dem Stand des Titlers
// (Konfiguration, Status, Monitorliste, Master-Link-Meldung) entstehen die Props der Einstellungs-Abschnitte, die
// Statusleiste, der Zustand der V-Zeile und die Zustände der vier Haupttasten. Kein window, kein IPC, kein localStorage
// (G7): Die Aktionen kommen als Objekt herein, die Tests laufen ohne Browser. Statusleiste und Panel nutzen dieselben
// Ableitungen (eine Wahrheit).
// Regeln: E4 Master, E6 Fernsteuerung, E7 NDI, E8 Bildschirm, E9 iveo, E10 DataLink, E12 Haupttasten, E18 V-Zeile, E20 ids.
import {
  abschnittStatusItem,
  dataLinkView,
  iveoView,
  ndiOutputView,
  remoteControlView,
  screenOutputView,
  type DataLinkSectionProps,
  type IveoSectionProps,
  type NdiOutputSectionProps,
  type RemoteControlSectionProps,
  type ScreenOutputSectionProps,
} from '@jm/settings';
import { masterLinkStatusItem, type SelectOption, type StatusItem, type StatusState } from '@jm/ui';
import { portBelegt, STEUER_PORT } from '@shared/fernsteuerung';
import {
  DEFAULT_CONFIG,
  type DisplayInfo,
  type MasterLinkMeldungZeile,
  type PartialTitlerConfig,
  type TitlerConfig,
  type TitlerStatus,
  type VerbundAnzeigeZeile,
} from '@shared/types';
import { navGesperrt } from '@/lib/datalink-anzeige';

/** Abschnitts-ids = Panel-Anker (`einstellung-{id}`) = settingsSection der Statuseinträge (E20). */
export const ABSCHNITT = {
  iveo: 'iveo',
  ndi: 'ndi',
  bildschirm: 'bildschirm',
  fernsteuerung: 'fernsteuerung',
  datalink: 'datalink',
  stil: 'stil',
  vorlagen: 'vorlagen',
} as const;

/** Feste Texte des Titlers (G5; Freigabe OF8: T2 Labels, T3 Haupttasten, T4 bis T7, T10, T11; dazu zwei heutige Texte). */
export const TITLER_TEXTE = {
  take: 'Take',
  clear: 'Clear',
  zurueck: '◀ Eintrag',
  weiter: 'Eintrag ▶',
  ersterEintrag: 'Erster Eintrag',
  letzterEintrag: 'Letzter Eintrag',
  /** Hinweiszeile bei NDI an: wörtlich der heutige Text (Funktionsliste Nr. 9). */
  hinweisNdiAn: 'NDI-Quelle aktiv — in TriCaster/vMix/OBS als Eingang über das vorhandene Programm legen (Alpha/Key).',
  hinweisNdiAus: 'NDI unter Einstellungen › NDI-Ausgabe starten, damit die transparente Quelle im Netz erscheint. Vorschau läuft auch ohne NDI.',
  keinOrdner:
    'Kein Datenordner aktiv. Unter Einstellungen › DataLink einen Ordner wählen — oder den Titler über eine JM Show mit iveo-Daten öffnen. Abrufbare Einträge erscheinen dann hier.',
  keineGrafik: 'Keine Grafik-Vorlage gewählt — unter „Grafik-Vorlagen“ auswählen oder unter Einstellungen › Grafik-Vorlagen importieren.',
  keineVorlagen: 'Noch keine Vorlagen. Import unter Einstellungen › Grafik-Vorlagen.',
  stil: 'Stil',
  vorlagen: 'Grafik-Vorlagen',
  loeschen: 'Löschen',
  loeschenAria: (name: string) => `Vorlage „${name}“ löschen`,
  laedt: 'Lädt…',
  /** Bisheriger Hinweis bei ungerader Auflösung (Funktionsliste Nr. 54), jetzt Fehlertext des NDI-Abschnitts (E7). */
  aufloesungUngerade: 'Auflösung sollte gerade sein.',
  companionModul: 'jm-suite',
  label: { iveo: 'iveo', ndi: 'NDI', bildschirm: 'Bildschirm', fernsteuerung: 'Fernsteuerung', datalink: 'DataLink' },
} as const;

export interface OberflaechenStand {
  config: TitlerConfig;
  status: TitlerStatus;
  /** Monitorliste aus listDisplays; undefined = noch nicht geladen (dann „unbekannt“, nie eine leere Liste, E8). */
  displays: DisplayInfo[] | undefined;
  /** Meldung der Master-Link-Brücke aus useBrueckenWert: undefined = offen, null = keine Brücke (beides „unbekannt“). */
  masterLink: MasterLinkMeldungZeile | null | undefined;
}

/** Was die Abschnitte auslösen; OperatorView reicht Store und window.jmtitler herein. */
export interface TitlerAktionen {
  setConfig(patch: PartialTitlerConfig): void;
  startNdi(name: string): void;
  stopNdi(): void;
  pickFolder(): void;
  zurueckZumEigenenOrdner(): void;
}

export interface TasteZustand {
  state: 'bereit' | 'live' | 'gesperrt';
  disabledReason?: string;
}

/** Text des Hauptprozesses für einen fehlenden DataLink-Ordner (main/datalink.ts, scan); ein Test hält beide gleich. */
const ORDNER_NICHT_GEFUNDEN = 'Ordner nicht gefunden';

/** Auflösungen und Bildraten wie bisher in der Bedienung (Wert `{w}x{h}` bzw. fps). */
const AUFLOESUNGEN: SelectOption[] = [
  { value: '1920x1080', label: '1920×1080' },
  { value: '1280x720', label: '1280×720' },
];
const BILDRATEN: SelectOption[] = [25, 30, 50, 60].map((f) => ({ value: String(f), label: String(f) }));

/** Quell-Hinweise der Show (H3, H4, H7): Die Liste stammt aus einem früheren Stand. H1/H2/H5/H6 setzt der DataLink-Kern. */
const QUELL_HINWEIS: ReadonlySet<string> = new Set(['H3', 'H4', 'H7']);

/** Gemessene Trennung vom Master: Bei Quelle master gilt dann die Liste aus dem zuletzt empfangenen Stand (E9). */
const LINK_GETRENNT: ReadonlySet<string> = new Set(['ohne-client', 'aus', 'sucht', 'verbindet', 'fehler']);

/** iveo (E9): gebunden bei Datenquelle Show oder Master; die Lieferung leitet sich aus dem stehenden Hinweis ab. */
export function iveoAbschnitt(s: OberflaechenStand): IveoSectionProps {
  const art = s.status.datenQuelle.art;
  const bound = art === 'show' || art === 'master';
  const h = s.status.hinweis;
  // Kein Hinweis: Die Show lieferte → ok. Quell-Hinweis: Liste aus früherem Stand. Ein Kern-Hinweis steht im Vorrang vor
  // einem Quell-Hinweis (RANG im Kern) und kann ihn verdecken: dann ist die Lieferung unbekannt.
  const nachHinweis = h === undefined ? 'ok' : QUELL_HINWEIS.has(h.art) ? 'veraltet' : undefined;
  // Bei Quelle master kommt die Liste über den Master-Link (N1): verbunden → wie der Hinweis; getrennt → Liste aus früherem
  // Stand (ein Kern-Hinweis bleibt unbekannt); Brücke offen, ohne Brücke oder unbekannte Art → unbekannt, nie ok (Spec 7.2).
  const m = s.masterLink;
  const link = m?.art === 'verbunden' ? 'verbunden' : m && LINK_GETRENNT.has(m.art) ? 'getrennt' : 'unbekannt';
  const ueberMaster = link === 'verbunden' ? nachHinweis : link === 'getrennt' && nachHinweis !== undefined ? 'veraltet' : undefined;
  return {
    id: ABSCHNITT.iveo,
    bound,
    speakerCount: bound ? s.status.entries.length : undefined,
    delivery: !bound ? undefined : art === 'master' ? ueberMaster : nachHinweis,
  };
}

/** NDI-Ausgabe (E7): Der Hauptprozess meldet nur „Kindprozess gestartet“, keine Rückmeldung des Senders. */
export function ndiAbschnitt(s: OberflaechenStand, a: TitlerAktionen): NdiOutputSectionProps {
  const c = s.config;
  const st = s.status;
  return {
    id: ABSCHNITT.ndi,
    enabled: st.ndiActive,
    sourceName: c.ndiName,
    // Die Empfängerzahl kommt erst nach 30 gesendeten Bildern; 0 ist nicht von „noch keine Meldung“ zu unterscheiden,
    // und nach dem Stopp stünde sonst die alte Zahl hinter „aus“.
    receivers: st.ndiActive && st.connections > 0 ? st.connections : undefined,
    resolution: `${c.width}x${c.height}`,
    resolutionOptions: AUFLOESUNGEN,
    fps: String(c.fps),
    fpsOptions: BILDRATEN,
    capabilities: { toggle: true, rename: true, resolution: true, fps: true },
    error: c.width % 2 !== 0 || c.height % 2 !== 0 ? TITLER_TEXTE.aufloesungUngerade : undefined,
    onToggle: (an) => (an ? a.startNdi(c.ndiName) : a.stopNdi()),
    onRename: (name) => a.setConfig({ ndiName: name }),
    onResolution: (wert) => {
      const m = /^(\d+)x(\d+)$/.exec(wert);
      if (m && AUFLOESUNGEN.some((o) => o.value === wert)) a.setConfig({ width: Number(m[1]), height: Number(m[2]) });
    },
    onFps: (wert) => {
      if (BILDRATEN.some((o) => o.value === wert)) a.setConfig({ fps: Number(wert) });
    },
  };
}

/** Ausgabe auf Bildschirm (E8): Ob das Ausgabefenster offen ist, meldet kein Kanal → „an (ohne Rückmeldung)“. */
export function bildschirmAbschnitt(s: OberflaechenStand, a: TitlerAktionen): ScreenOutputSectionProps {
  const c = s.config;
  return {
    id: ABSCHNITT.bildschirm,
    enabled: c.secondScreenEnabled,
    screens: s.displays?.map((d) => ({ id: d.id, label: d.label, primary: d.primary })),
    selectedId: c.secondScreenDisplay === 0 ? null : c.secondScreenDisplay,
    background: c.chromaColor,
    backgroundDefault: DEFAULT_CONFIG.chromaColor,
    capabilities: { toggle: true, background: true, backgroundPicker: true },
    onToggle: (an) => a.setConfig({ secondScreenEnabled: an }),
    onSelect: (id) => a.setConfig({ secondScreenDisplay: id ?? 0 }),
    onBackground: (hex) => a.setConfig({ chromaColor: hex }),
  };
}

/** Fernsteuerung (E6): Meldung des Steuerservers (S-A3); Einrichten nur im Launcher (OF5, ohne Knopf). */
export function fernsteuerungAbschnitt(s: OberflaechenStand): RemoteControlSectionProps {
  const m = s.status.fernsteuerung;
  // EADDRINUSE nur als portInUse: Der Fehler ginge im Abschnitt vor und verdeckte „Port belegt“ (E6).
  const belegt = portBelegt(m);
  return {
    id: ABSCHNITT.fernsteuerung,
    running: m?.laeuft,
    mode: m?.modus,
    port: m !== undefined && m.port > 0 ? m.port : STEUER_PORT,
    clients: m?.clients,
    portInUse: belegt,
    error: m?.fehler !== undefined && !belegt ? m.fehler : undefined,
    companionModule: TITLER_TEXTE.companionModul,
    capabilities: {},
  };
}

/** DataLink (E10): eigener Ordner, Datenquelle (Q1–Q4, K1), Hinweis H1–H7, Sperre im Verbund (R2-Satz wörtlich, OF7). */
export function dataLinkAbschnitt(s: OberflaechenStand, a: TitlerAktionen): DataLinkSectionProps {
  const st = s.status;
  const q = st.datenQuelle;
  const fehlt = st.dataError === ORDNER_NICHT_GEFUNDEN;
  return {
    id: ABSCHNITT.datalink,
    folder: s.config.dataFolder,
    folderMissing: fehlt,
    error: st.dataError && !fehlt ? st.dataError : undefined,
    // Show, Master und frühere Show liefern Einträge ohne eigenen Ordner: kein „kein Ordner“.
    externeQuelle: q.art !== 'ordner',
    eintraege: st.entries.length,
    sourceLine: q.zeile,
    notice: st.hinweis?.text,
    backLabel: q.zurueckKnopf ?? undefined,
    onBack: q.zurueckKnopf ? () => a.zurueckZumEigenenOrdner() : undefined,
    locked: q.ordnerGesperrt,
    onPickFolder: () => a.pickFolder(),
    // Auch bei Sperre gesetzt: Der Knopf bleibt sichtbar gesperrt (C6), der Main lehnt den Patch ohnehin ab (R2).
    onClearFolder: () => a.setConfig({ dataFolder: '' }),
    capabilities: { ordnerText: true },
    onFolderText: (pfad) => a.setConfig({ dataFolder: pfad }),
  };
}

const KEINE_AKTION: TitlerAktionen = {
  setConfig: () => {},
  startNdi: () => {},
  stopNdi: () => {},
  pickFolder: () => {},
  zurueckZumEigenenOrdner: () => {},
};

/** Statusleiste in fester Reihenfolge (Anhang A, E20): master-link, iveo, ndi, bildschirm, fernsteuerung, datalink. */
export function statusLeiste(s: OberflaechenStand): StatusItem[] {
  const L = TITLER_TEXTE.label;
  const ndi = ndiOutputView(ndiAbschnitt(s, KEINE_AKTION));
  return [
    masterLinkStatusItem(s.masterLink),
    abschnittStatusItem(iveoView(iveoAbschnitt(s)), { group: 'verbindung', label: L.iveo }),
    abschnittStatusItem(ndi, { group: 'ausgabe', label: L.ndi, detail: ndi.empfaenger }),
    abschnittStatusItem(screenOutputView(bildschirmAbschnitt(s, KEINE_AKTION)), { group: 'ausgabe', label: L.bildschirm }),
    abschnittStatusItem(remoteControlView(fernsteuerungAbschnitt(s)), { group: 'fernsteuerung', label: L.fernsteuerung }),
    abschnittStatusItem(dataLinkView(dataLinkAbschnitt(s, KEINE_AKTION)), { group: 'tool', label: L.datalink }),
  ];
}

const VERBUND_ZUSTAND: Readonly<Record<VerbundAnzeigeZeile['farbe'], StatusState>> = {
  gruen: 'ok',
  gelb: 'warn',
  rot: 'error',
  gedaempft: 'off',
};

/** V-Zeile „Show vom Master“ als StatusPill (E18): Farbe der R2-Anzeige → Zustand; unbekannt → off, nie live. */
export function verbundZeileZustand(farbe: VerbundAnzeigeZeile['farbe']): StatusState {
  return Object.prototype.hasOwnProperty.call(VERBUND_ZUSTAND, farbe) ? VERBUND_ZUSTAND[farbe] : 'off';
}

/**
 * Haupttasten (E12, Anhang A): Take zeigt live und ist nie gesperrt, Clear ist nie gesperrt; ◀/▶ Eintrag nur mit Einträgen,
 * an den Rändern gesperrt mit Grund (wie navGesperrt: ohne aktiven Eintrag beide frei). Keine Kürzel (UO5).
 */
export function hauptTasten(
  live: boolean,
  activeEntry: number,
  anzahl: number,
): { take: TasteZustand; clear: TasteZustand; eintrag: { zurueck: TasteZustand; weiter: TasteZustand } | null } {
  const taste = (gesperrt: boolean, grund: string): TasteZustand => (gesperrt ? { state: 'gesperrt', disabledReason: grund } : { state: 'bereit' });
  const nav = navGesperrt(activeEntry, anzahl);
  return {
    take: { state: live ? 'live' : 'bereit' },
    clear: { state: 'bereit' },
    eintrag: anzahl > 0 ? { zurueck: taste(nav.zurueck, TITLER_TEXTE.ersterEintrag), weiter: taste(nav.weiter, TITLER_TEXTE.letzterEintrag) } : null,
  };
}
```

- [ ] **Step 4: Test laufen lassen (grün)**

```
npm run selftest -w @jm/titler > <eigener Scratchpad>/c8-gruen.txt 2>&1; echo "Exit=$?"
grep -E "^> |ALLE TESTS OK|FEHLGESCHLAGEN" <eigener Scratchpad>/c8-gruen.txt
grep -cE "^\s*ok\b" <eigener Scratchpad>/c8-gruen.txt
(cd apps/titler && npx tsx --tsconfig tsconfig.test.json test/ui/selftest.ts) > <eigener Scratchpad>/c8-ui.txt 2>&1; echo "Exit=$?"
grep -c "^ok " <eigener Scratchpad>/c8-ui.txt
grep -E "^ok   (Statusleiste|iveo-|NDI-|Bildschirm-|Fernsteuerung-|DataLink|V-Zeile|Haupttasten|Aktionen|Titler-Texte|Abschnitts-ids|Quelltext)" <eigener Scratchpad>/c8-ui.txt
```
Erwartet (gemessen):
```
Exit=0
> @jm/titler@0.11.0 selftest
> tsx test/selftest.ts && tsx --tsconfig tsconfig.test.json test/ui/selftest.ts
ALLE TESTS OK
ALLE TESTS OK
590
Exit=0
52
ok   Statusleiste Master: 12 Eingänge → Zustand und Detail wie C5, Gruppe verbindung, ohne Abschnitt (12 Fälle)
ok   Statusleiste iveo Kreuzprodukt: Datenquelle × Hinweis × Einträge × Master-Link → Tabelle (E9; bei master ok nur mit verbundenem Link) (576 Fälle)
ok   iveo-Abschnitt: Speakerzahl = Einträge nur bei Show und Master; kein Event, keine Bühne, kein Launcher-Knopf (OF5) (576 Fälle)
ok   Statusleiste NDI Kreuzprodukt: an/aus × Empfänger × Name × Auflösung → Tabelle (E7) (24 Fälle)
ok   Statusleiste NDI: nie ok, sending nie gesetzt, Empfänger nur bei an und über 0 (keine Rückmeldung des Senders) (24 Fälle)
ok   NDI-Abschnitt: leerer Quellenname zeigt „Kein Quellenname eingetragen.“ (24 Fälle)
ok   Statusleiste Bildschirm Kreuzprodukt: an/aus × Monitorliste × Wahl → Tabelle (E8) (24 Fälle)
ok   Statusleiste Bildschirm: nie ok, windowOpen nie gesetzt, Wahl 0 = automatisch (null) (24 Fälle)
ok   Statusleiste Fernsteuerung Kreuzprodukt: Meldung × Modus → Tabelle (E6; „Port belegt“ nur bei EADDRINUSE) (18 Fälle)
ok   Fernsteuerung-Abschnitt: Port 8726, Modus aus der Meldung, Modul jm-suite, kein Port-Feld, kein „Im Launcher einrichten“ (OF5) (18 Fälle)
ok   Fernsteuerung-Abschnitt: Port aus der Meldung, ohne gültigen Port STEUER_PORT (E6)
ok   Statusleiste DataLink Kreuzprodukt: Quelle × eigener Ordner × Fehler × Einträge → Tabelle (E10) (48 Fälle)
ok   DataLink-Abschnitt: Sperre = R2-Satz nur bei Master, K1 genau mit Text aus dem Main, Quellzeile und Hinweis durchgereicht, Entfernen und Pfadfeld immer (OF4, OF7) (48 Fälle)
ok   DataLink bei Master: gesperrt mit dem R2-Satz, ohne K1, „Ordner entfernen“ bleibt (sichtbar gesperrt)
ok   DataLink bei Show ohne eigenen Ordner: fremde Quelle mit 5 Einträgen (statt „kein Ordner“)
ok   DataLink: main/datalink.ts meldet weiter „Ordner nicht gefunden“ (Gleichlauf mit folderMissing)
ok   Statusleiste gesamt: Reihenfolge master-link, iveo, ndi, bildschirm, fernsteuerung, datalink, ids eindeutig, schon nach Gruppen geordnet (360 Fälle)
ok   Statusleiste gesamt: jeder Eintrag außer Master springt in seinen Abschnitt (settingsSection = id aus ABSCHNITT) (360 Fälle)
ok   Statusleiste gesamt: nie live (Spec 7.4, E11) (360 Fälle)
ok   Statusleiste: Gruppen und Labels (T2, OF2)
ok   V-Zeile: gruen ok, gelb warn, rot error, gedaempft off (E18)
ok   V-Zeile: unbekannte Farbe ist off, nie ok und nie live
ok   Haupttasten Kreuzprodukt: ◀/▶ Eintrag nur mit Einträgen, an den Rändern gesperrt mit Grund → Tabelle (24 Fälle)
ok   Haupttasten: Take live genau bei live, sonst bereit, nie gesperrt; Clear immer bereit (24 Fälle)
ok   Haupttasten: jede gesperrte Taste hat einen nicht leeren Grund (24 Fälle)
ok   Aktionen NDI: Schalter startet mit dem Quellenname bzw. stoppt; Name, Auflösung, Bildrate als Config; fremde Werte ignoriert
ok   NDI-Abschnitt: Fähigkeiten ohne Transparenz, Auflösungen und Bildraten wie bisher
ok   Aktionen Bildschirm: an/aus, automatisch = 0, Monitor-id, Chroma-Farbe
ok   Bildschirm-Abschnitt: Chroma-Farbe, Standardfarbe #00B140, Farbwähler, Monitorliste
ok   Aktionen DataLink: Ordner wählen, entfernen, Pfad von Hand, K1
ok   Titler-Texte: keine ASCII-Anführungszeichen (G5)
ok   Titler-Texte: Haupttasten und Gründe wörtlich (T3; ohne „●“, keine Kürzel)
ok   Titler-Texte: Hinweiszeile bei NDI an (wie bisher, Nr. 9) und aus (T4)
ok   Titler-Texte: Daten / Recall ohne Ordner (T5) und Grafik (T6a, T6b) nennen die neuen Orte
ok   Titler-Texte: Panel tool-eigen (T7), Laden (T11), ungerade Auflösung (Nr. 54), Companion-Modul (T10)
ok   Titler-Texte: kein Verweis auf Reiter oder „rechts starten“ (Befund 16)
ok   Abschnitts-ids (E20)
ok   Quelltext: lib/oberflaeche.ts ohne window, localStorage, IPC und Electron (G7)
```
Zweiter Lauf: 52 `ok` (14 aus C7 + 38 neu). Gesamt über beide Läufe: 538 + 52 = 590.

- [ ] **Step 5: Gegenproben** (je eine Ersetzung allein in `apps/titler/src/renderer/src/lib/oberflaeche.ts`, vorübergehend; danach zurücknehmen)

Jede Probe allein mit dem Edit-Werkzeug einbauen, dann
```
(cd apps/titler && npx tsx --tsconfig tsconfig.test.json test/ui/selftest.ts); echo "Exit=$?"
```
laufen lassen, die `FAIL`-Zeilen mit der Erwartung vergleichen, genau zurücknehmen und wieder grün sehen (52 `ok`). Nichts
davon wird gestagt. Die ersten sieben Proben nennt die Gliederung, 8 bis 11 kommen dazu, 12 bis 14 aus der Nachbesserung
(Prüfbefunde robust:1 und robust:6).

1. **„sendet“ ohne Messung:** nach `    enabled: st.ndiActive,` die Zeile `    sending: st.ndiActive ? true : undefined,` einfügen.
   Erwartet (gemessen; mit `npm run selftest -w @jm/titler` bleibt der alte Lauf `ALLE TESTS OK`):
   ```
   FAIL Statusleiste NDI Kreuzprodukt: an/aus × Empfänger × Name × Auflösung → Tabelle (E7) (24 Fälle)
        ndiActive=true connections=0 ndiName="" aufloesung="1920x1080" → ist: ok sendet soll: warn an (ohne Rückmeldung)
        ndiActive=true connections=0 ndiName="JM Titler" aufloesung="1920x1080" → ist: ok sendet soll: warn an (ohne Rückmeldung)
        ndiActive=true connections=2 ndiName="" aufloesung="1920x1080" → ist: ok 2 Empfänger soll: warn 2 Empfänger · an (ohne Rückmeldung)
        ndiActive=true connections=2 ndiName="JM Titler" aufloesung="1920x1080" → ist: ok 2 Empfänger soll: warn 2 Empfänger · an (ohne Rückmeldung)
   FAIL Statusleiste NDI: nie ok, sending nie gesetzt, Empfänger nur bei an und über 0 (keine Rückmeldung des Senders) (24 Fälle)
        ndiActive=true connections=0 ndiName="" aufloesung="1920x1080" → state ok sending true receivers undefined
        …
        … und 7 weitere
   2 FEHLGESCHLAGEN
   Exit=1
   ```
2. **Leere Monitorliste vor der ersten Antwort:** `    screens: s.displays?.map(` → `    screens: (s.displays ?? []).map(`.
   Erwartet (gemessen): `FAIL Statusleiste Bildschirm Kreuzprodukt: an/aus × Monitorliste × Wahl → Tabelle (E8) (24 Fälle)`
   mit u. a. `enabled=false liste="unbekannt" wahl=0 → ist: off aus soll: off unbekannt` und
   `enabled=true liste="unbekannt" wahl=0 → ist: error Bildschirm fehlt soll: off unbekannt` (6 Fälle), `1 FEHLGESCHLAGEN`,
   `Exit=1`.
3. **Kern-Hinweis als ok:** `QUELL_HINWEIS.has(h.art) ? 'veraltet' : undefined;` → `QUELL_HINWEIS.has(h.art) ? 'veraltet' : 'ok';`.
   Erwartet (gemessen): `FAIL Statusleiste iveo Kreuzprodukt: Datenquelle × Hinweis × Einträge × Master-Link → Tabelle (E9; bei
   master ok nur mit verbundenem Link) (576 Fälle)` mit
   `art="show" hinweis="H1" entries=0 link="offen" → ist: ok verbunden soll: off unbekannt` und `… und 115 weitere` (120 Fälle:
   bei Show und bei Master mit verbundenem Link je Kern-Hinweis „ok verbunden“, bei getrenntem Link je Kern-Hinweis „Liste aus
   früherem Stand“ statt „unbekannt“), `1 FEHLGESCHLAGEN`, `Exit=1`.
4. **Keine Meldung als „aus“:** `    running: m?.laeuft,` → `    running: m?.laeuft ?? false,`. Erwartet (gemessen):
   `FAIL Statusleiste Fernsteuerung Kreuzprodukt: Meldung × Modus → Tabelle (E6; „Port belegt“ nur bei EADDRINUSE) (18 Fälle)`
   mit `meldung="keine" modus=undefined → ist: off aus soll: off unbekannt` (3 Fälle), `1 FEHLGESCHLAGEN`, `Exit=1`.
5. **Sperrgrund ersetzt:** `    locked: q.ordnerGesperrt,` → `    locked: q.ordnerGesperrt ? 'Vom Master vorgegeben' : undefined,`.
   Erwartet (gemessen; Fallzeilen gekürzt):
   ```
   FAIL DataLink-Abschnitt: Sperre = R2-Satz nur bei Master, K1 genau mit Text aus dem Main, Quellzeile und Hinweis durchgereicht, Entfernen und Pfadfeld immer (OF4, OF7) (48 Fälle)
        art="master" dataFolder="" dataError=undefined entries=0 → ist: Vom Master vorgegeben/undefined/undefined/Quelle: Show vom Master „Gala“/… soll: Im Verbund kommen die Speaker vom Master „Regie-PC“. Ein eigener Ordner gilt, …
        …
        … und 7 weitere
   FAIL DataLink bei Master: gesperrt mit dem R2-Satz, ohne K1, „Ordner entfernen“ bleibt (sichtbar gesperrt)
   2 FEHLGESCHLAGEN
   Exit=1
   ```
   (12 Fälle: alle mit Quelle `master`.)
6. **Empfänger auch bei NDI aus:** `    receivers: st.ndiActive && st.connections > 0 ? st.connections : undefined,` →
   `    receivers: st.connections > 0 ? st.connections : undefined,`. Erwartet (gemessen):
   ```
   FAIL Statusleiste NDI Kreuzprodukt: an/aus × Empfänger × Name × Auflösung → Tabelle (E7) (24 Fälle)
        ndiActive=false connections=2 ndiName="" aufloesung="1920x1080" → ist: off 2 Empfänger · aus soll: off aus
        …
   FAIL Statusleiste NDI: nie ok, sending nie gesetzt, Empfänger nur bei an und über 0 (keine Rückmeldung des Senders) (24 Fälle)
        ndiActive=false connections=2 ndiName="" aufloesung="1920x1080" → state off sending undefined receivers 2
        …
   2 FEHLGESCHLAGEN
   Exit=1
   ```
7. **EADDRINUSE zusätzlich als `error`:** `    error: m?.fehler !== undefined && !belegt ? m.fehler : undefined,` →
   `    error: m?.fehler,`. Erwartet (gemessen):
   ```
   FAIL Statusleiste Fernsteuerung Kreuzprodukt: Meldung × Modus → Tabelle (E6; „Port belegt“ nur bei EADDRINUSE) (18 Fälle)
        meldung="belegt" modus=undefined → ist: error Fehler: listen EADDRINUSE: address already in use :::8726 soll: error Port belegt
        …
   FAIL Fernsteuerung-Abschnitt: Port 8726, Modus aus der Meldung, Modul jm-suite, kein Port-Feld, kein „Im Launcher einrichten“ (OF5) (18 Fälle)
        meldung="belegt" modus=undefined → ist: 8726/unbekannt/jm-suite/undefined/false/false/true/false soll: 8726/unbekannt/jm-suite/undefined/false/false/true/true
        …
   2 FEHLGESCHLAGEN
   Exit=1
   ```
8. **◀ Eintrag am ersten Eintrag frei:** `taste(nav.zurueck, TITLER_TEXTE.ersterEintrag)` → `taste(false, TITLER_TEXTE.ersterEintrag)`.
   Erwartet (gemessen): `FAIL Haupttasten Kreuzprodukt: … (24 Fälle)` mit
   `live=false activeEntry=0 anzahl=1 → ist: ["frei","letzter"] soll: ["erster","letzter"]` (4 Fälle), `1 FEHLGESCHLAGEN`.
9. **„Ordner entfernen“ nur ohne Sperre:** `    onClearFolder: () => a.setConfig({ dataFolder: '' }),` →
   `    onClearFolder: q.ordnerGesperrt ? undefined : () => a.setConfig({ dataFolder: '' }),` (der Knopf verschwände bei Quelle
   `master`, statt sichtbar gesperrt zu sein). Erwartet (gemessen):
   `FAIL DataLink-Abschnitt: Sperre = R2-Satz nur bei Master, … (48 Fälle)` mit 12 Fällen
   (`…/undefined/true/function/…` statt `…/function/true/function/…`) und
   `FAIL DataLink bei Master: gesperrt mit dem R2-Satz, ohne K1, „Ordner entfernen“ bleibt (sichtbar gesperrt)`,
   `2 FEHLGESCHLAGEN`.
10. **Port immer fest:** `    port: m !== undefined && m.port > 0 ? m.port : STEUER_PORT,` → `    port: STEUER_PORT,`. Erwartet
    (gemessen): `FAIL Fernsteuerung-Abschnitt: Port aus der Meldung, ohne gültigen Port STEUER_PORT (E6)` mit
    `ist: [8726,8726] soll: [9000,8726]`, `1 FEHLGESCHLAGEN`.
11. **V-Zeile gelb als ok:** `  gelb: 'warn',` → `  gelb: 'ok',`. Erwartet (gemessen):
    ```
    FAIL V-Zeile: gruen ok, gelb warn, rot error, gedaempft off (E18)
         ist: ["ok","ok","error","off"] soll: ["ok","warn","error","off"]
    1 FEHLGESCHLAGEN
    Exit=1
    ```
12. **iveo bei Master ohne Blick auf den Link** (der Widerspruch zur V-Zeile, Prüfbefund robust:1):
    `    delivery: !bound ? undefined : art === 'master' ? ueberMaster : nachHinweis,` →
    `    delivery: !bound ? undefined : nachHinweis,`. Erwartet (gemessen):
    ```
    FAIL Statusleiste iveo Kreuzprodukt: Datenquelle × Hinweis × Einträge × Master-Link → Tabelle (E9; bei master ok nur mit verbundenem Link) (576 Fälle)
         art="master" hinweis="–" entries=0 link="offen" → ist: ok verbunden soll: off unbekannt
         art="master" hinweis="–" entries=0 link="keine" → ist: ok verbunden soll: off unbekannt
         art="master" hinweis="–" entries=0 link="ohne" → ist: ok verbunden soll: warn Liste aus früherem Stand
         art="master" hinweis="–" entries=0 link="aus" → ist: ok verbunden soll: warn Liste aus früherem Stand
         art="master" hinweis="–" entries=0 link="sucht" → ist: ok verbunden soll: warn Liste aus früherem Stand
         … und 29 weitere
    1 FEHLGESCHLAGEN
    Exit=1
    ```
    (34 Fälle: Master mit getrenntem Link ohne Hinweis, dazu offene, fehlende oder unbekannte Brücke ohne Hinweis und mit
    Quell-Hinweis.)
13. **Offene oder fehlende Brücke als Trennung:** `m && LINK_GETRENNT.has(m.art) ? 'getrennt'` →
    `!m || LINK_GETRENNT.has(m.art) ? 'getrennt'`. Erwartet (gemessen): `FAIL Statusleiste iveo Kreuzprodukt: … (576 Fälle)` mit
    `art="master" hinweis="–" entries=0 link="offen" → ist: warn Liste aus früherem Stand soll: off unbekannt` und
    `… und 11 weitere` (16 Fälle: `offen` und `keine` ohne Hinweis und mit Quell-Hinweis), `1 FEHLGESCHLAGEN`, `Exit=1`.
14. **Ungerade Höhe übersehen:** `    error: c.width % 2 !== 0 || c.height % 2 !== 0 ? TITLER_TEXTE.aufloesungUngerade : undefined,`
    → `    error: c.width % 2 !== 0 ? TITLER_TEXTE.aufloesungUngerade : undefined,` (Prüfbefund robust:6). Erwartet (gemessen): `FAIL Statusleiste NDI Kreuzprodukt: … (24 Fälle)` mit
    `ndiActive=false connections=0 ndiName="" aufloesung="1920x1081" → ist: off aus soll: error Fehler: Auflösung sollte gerade sein.`
    und `… und 3 weitere` (8 Fälle, alle mit `1920x1081`), `1 FEHLGESCHLAGEN`, `Exit=1`.

- [ ] **Step 6: Typprüfung und Zeilenenden**

```
npm run typecheck -w @jm/titler; echo "Exit=$?"
node -e "for (const f of process.argv.slice(1)) { const t = require('fs').readFileSync(f, 'utf8'); const n = (t.match(/\n/g) || []).length, c = (t.match(/\r\n/g) || []).length; console.log(f, n, c, c === 0 || c === n ? 'einheitlich' : 'GEMISCHT'); }" apps/titler/src/renderer/src/lib/oberflaeche.ts apps/titler/test/ui/oberflaeche.test.ts apps/titler/test/ui/selftest.ts
```
Erwartet (gemessen): drei `tsc`-Läufe ohne Meldung, `Exit=0` (`typecheck:web` prüft `lib/oberflaeche.ts` gegen die echten
Typen aus `@jm/settings`, `@jm/ui` und `shared/`, `typecheck:test` die Tests); dann:
```
apps/titler/src/renderer/src/lib/oberflaeche.ts 270 0 einheitlich
apps/titler/test/ui/oberflaeche.test.ts 510 0 einheitlich
apps/titler/test/ui/selftest.ts 8 0 einheitlich
```
(`test/ui/selftest.ts` ist seit C7 neu und bleibt LF; die Einfügung behält das.)

- [ ] **Step 7: Commit** (Bash-Werkzeug; Commit-Text ohne Umlaute)

```
git add apps/titler/test/ui/oberflaeche.test.ts apps/titler/test/ui/selftest.ts apps/titler/src/renderer/src/lib/oberflaeche.ts
git status --short
```
Erwartet genau (fremde `??`-Zeilen bleiben ungestaged):
```
A  apps/titler/src/renderer/src/lib/oberflaeche.ts
A  apps/titler/test/ui/oberflaeche.test.ts
M  apps/titler/test/ui/selftest.ts
```
Dann:
```
git commit -m "feat(titler): Ableitungen fuer Statusleiste, Einstellungs-Abschnitte und Haupttasten (UX-Pilot C8)" -m "lib/oberflaeche.ts leitet aus Config, Status, Monitorliste und Master-Link-Meldung die Props der fuenf Abschnitte aus @jm/settings, die Statusleiste (master-link, iveo, ndi, bildschirm, fernsteuerung, datalink), den Zustand der V-Zeile und die Haupttasten ab. NDI und Bildschirm ohne Rueckmeldung nie ok, Empfaenger nur bei laufendem NDI, Monitorliste vor der ersten Antwort unbekannt, iveo bei Kern-Hinweis unbekannt und bei Quelle master nur mit verbundenem Master-Link verbunden (getrennt: Liste aus frueherem Stand), ungerade Breite oder Hoehe als Fehler, Port belegt nur bei EADDRINUSE, DataLink aus Show oder Master ohne eigenen Ordner mit Eintraegen, Sperre im Verbund mit dem R2-Satz und Ordner entfernen sichtbar gesperrt. Take nie gesperrt, Eintrag-Tasten an den Raendern mit Grund. TITLER_TEXTE mit den Texten aus OF8. Kreuzprodukt je Eintrag mit Erwartungstabelle, Aktionen ohne DOM, ohne window." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- `oberflaeche.ts` importiert außer den Typen aus dem Register auch Werte: die Sichten und `abschnittStatusItem` aus
  `@jm/settings`, `masterLinkStatusItem` aus `@jm/ui`, `portBelegt`/`STEUER_PORT` aus `@shared/fernsteuerung`,
  `DEFAULT_CONFIG` aus `@shared/types` und `navGesperrt` aus `@/lib/datalink-anzeige`. Das alte `test/selftest.ts` lädt das
  Modul nicht; die Regel „über Aliase nur `import type`“ aus S-B3 gilt deshalb hier nicht.
- DataLink-Kreuz: Die Gliederung nennt die Achsen art × ohneOrdner × dataError × entries × ordnerGesperrt × dataFolder. Der
  Test rechnet `ohneOrdner`, `ordnerGesperrt`, Quellzeile und K1 mit den echten Funktionen aus `shared/datenquelle.ts`
  (`quellZeile`, `zurueckKnopf`, `ordnerWahlGesperrt`) aus art und dataFolder; so bleiben nur gültige Kombinationen
  (4 × 2 × 3 × 2 = 48). Der R2-Satz steht im Test zusätzlich wörtlich; ändert R2 ihn, schlägt der Test an.
- Die Texte `hinweisNdiAn` (Nr. 9) und `aufloesungUngerade` (Nr. 54) sind gegen `views/OperatorView.tsx:310` und `:726` auf
  `5e5b234ec3` gemessen und stehen im Test als Literal, nicht als Quelltext-Lesung: Block C verschiebt sie aus `OperatorView`.
  `keinOrdner` (T5) ist reiner Text; die Hervorhebungen von heute (`<b>Einstellungen › DataLink</b>`, `<b>JM Show</b>`) setzt
  Block C beim Rendern, falls gewünscht.
- Zusätzliche Prüfungen über die Gliederung hinaus: Port aus der Meldung, „schon nach Gruppen geordnet“ (`ordneStatus` ändert
  nichts), Gruppen und Labels, „kein Verweis auf Reiter oder rechts starten“ (Befund 16), der Gleichlauf „Ordner nicht
  gefunden“ mit `main/datalink.ts:137` (Quelltext), dazu die Gegenproben 8 bis 11.
- **Nachbesserung nach der Plan-Prüfung:** Das iveo-Kreuz hat die Achse Master-Link (9 Werte, 576 Fälle; Prüfbefund
  robust:1): Bei Quelle `master` zeigte die Statusleiste vorher „ok verbunden“, auch wenn der Link `fehler`, `sucht`, `aus`
  oder `ohne-client` meldete, während die R2-V-Zeile im selben Zustand den alten Stand gelb bzw. rot zeigte. Das NDI-Kreuz
  prüft die ungerade Höhe für sich (`1920x1081`, 24 Fälle; robust:6). Gegenproben 12 bis 14 dazu.
- Der Master-Eintrag wird über `statusLeiste` mit der Titler-Form `MasterLinkMeldungZeile` geprüft (Zusatzfelder `adresse`,
  `seit`, `suite`, `errCode`); damit ist auch der strukturelle Gleichlauf S-A4 → S-B1 belegt (`typecheck:web`).
- C8 setzt aus Block A nur die Register-Namen voraus (`shared/fernsteuerung.ts` mit `STEUER_PORT`, `FernsteuerungMeldung`,
  `portBelegt`; `TitlerStatus.fernsteuerung?` und `MasterLinkMeldungZeile` in `shared/types.ts`). Beim Zusammensetzen mit
  dem echten Task 3 und 4 gemessen: alter Lauf 538, zweiter Lauf 52, `typecheck -w @jm/titler` `Exit=0`, alle elf
  Gegenproben mit denselben `FAIL`-Zeilen. Nach der Nachbesserung neu gemessen: weiter 52 bzw. 590 `ok`, alle 14 Gegenproben mit
  der genannten `FAIL`-Zahl (2, 1, 1, 1, 2, 2, 2, 1, 2, 1, 1, 1, 1, 1); in Probe 1, 3 und 6 haben sich nur Fallzahlen geändert.

---

## Block C · Oberfläche (Aufgaben 9–12)

**Gemeinsam für Block C (Tasks 9–12):**
- Alle Befehle im Bash-Werkzeug (Git Bash) an der Wurzel des Plan-Worktrees, alle Pfade relativ dazu (G17). Ausgaben gehen
  nach `<eigener Scratchpad>` (vor dem Lauf ersetzen), nie ins Repo. Voraussetzung jeder Aufgabe: Die vorige ist
  committet, ihre Zählstände stimmen.
- Neue Dateien mit dem Write-Werkzeug (LF), bestehende mit dem Edit-Werkzeug (Vorher-Text exakt, genau einmal in der Datei;
  das Edit-Werkzeug behält die Zeilenenden der Datei). Vorher-Texte gelten für `5e5b234ec3` nach der vorigen Aufgabe;
  Zeilenangaben sind nur Lesehilfe.
- Zählweise: `npm run selftest -w @jm/titler` startet zwei Läufe (alter Lauf `tsx test/selftest.ts`, danach der
  Oberflächen-Lauf `tsx --tsconfig tsconfig.test.json test/ui/selftest.ts`), jeder endet grün mit „ALLE TESTS OK“. Gezählt
  wird je Lauf getrennt: alter Lauf `grep -cE "^\s*ok\b"`, Oberflächen-Lauf `grep -c "^ok "`. Das `| grep` verschluckt den
  Exitcode, deshalb immer zuerst den Lauf mit `echo "Exit=$?"` lesen.
- Der Oberflächen-Lauf rendert ohne Browser und ohne `window` (`renderToStaticMarkup`); das ganze Bedienfenster rendert über
  den Anfangszustand des Stores (`mitStore` in `apps/titler/test/ui/testzustand.ts`), weil zustand 4.5.7 beim Server-Render
  `getInitialState()` liest und `setState` dort nicht wirkt.
- Gegenproben (G9) im Plan-Worktree vor dem Stagen: je eine Ersetzung **allein** mit dem Edit-Werkzeug einbauen, den
  Oberflächen-Lauf laufen lassen, die `FAIL`-Zeilen mit der Erwartung vergleichen, die Ersetzung genau zurücknehmen und
  wieder „ALLE TESTS OK“ sehen. Nie stagen, nie committen.
- Jede Aufgabe endet mit `npm run typecheck -w @jm/titler` (drei `tsc`-Läufe: `typecheck:node`, `typecheck:web`,
  `typecheck:test`), dem Bau `npm run build -w @jm/titler` und der Klassen-Probe auf dem gebauten Titler-CSS (Review Focus 5).
  Task 9 ändert dazu `@jm/ui` (`StatusPill`, E18) und prüft deshalb auch `npm run typecheck -w @jm/ui` und den Selbsttest
  von `@jm/ui` (G10).
- Zählstände über den Block (in der letzten Nachbesserung gemessen, 15.10.2026): alter Lauf 538 `ok` in jeder
  Aufgabe; Oberflächen-Lauf nach Task 8 52, nach Task 9 76, nach Task 10 111, nach Task 11 136, nach Task 12 148 `ok`
  (beide Läufe zusammen 590, 614, 649, 674, 686); `@jm/ui` 679 vor und 680 nach Task 9; Klassen-Probe 20 `ok` nach jeder
  Aufgabe.
- Gemessen wurde die Nachbesserung wie der übrige Plan: frische Kopie des echten `main` `5e5b234ec3`, Plantext maschinell
  eingespielt bis Task 12 (Fehler 0, jede Vorher-Stelle genau einmal), nach jeder Aufgabe jeder rote und grüne Lauf, die
  Typprüfungen, Bau und Klassen-Probe und alle Gegenproben dieses Blocks (jede Datei danach Byte für Byte zurück).

---

### Task 9: C9 · Rahmen: AppShell, Kopfzeile, Statusleiste, Panel mit dem alten Einstellungs-Inhalt

**Spec:** 3.1 (AppShell), 3.2 (Kopfzeile), 3.3 (Statusleiste), 3.8 (kein `window.jm*` vorausgesetzt), 3.9 (lesende
Brücken), 5.1 (Seitenaufbau Live-Tool: Kopfzeile, Statusleiste, Einstellungen im Panel), 7 (Statusregeln), 8 (Hell/Dunkel
über `ThemeToggle` in der Kopfzeile), 9.2 (R2-Anzeige in `headerCenter`), A.0/5 (Mac-Ziehfläche über `AppHeader`).
Entscheidungen E5 (Brücken-Quellen), E8 (Monitorliste startet `undefined`), E11 (On-Air = Engine-Größe `live`), E14 (der
Reiter entfällt), E15 (Hell/Dunkel), E18 (Kopfzeile, V-Zeile als `StatusPill`), E20 (Statuseinträge). Global Constraints
G1, G2, G4, G6, G7, G8, G9, G10, G11, G12, G16. Review Focus 1, 2 und 3.

**Voraussetzung:** Plan-Worktree nach C8: `npm run selftest -w @jm/titler` grün mit beiden Läufen (alter Lauf **538**
`ok`, Oberflächen-Lauf **52** `ok`, Task 8 Step 4); `npm run selftest -w @jm/ui` grün mit 679 `ok` (Task 6). Aus
Block A und B gebraucht, wörtlich nach dem
Register: `window.jmtitler.masterLink`/`onMasterLink` und `MasterLinkMeldungZeile` (S-A4), `TitlerStatus.fernsteuerung?`
(S-A3), `useBrueckenWert` und `BrueckenQuelle` aus `@jm/ui` (S-B1), der zweite `tsx`-Lauf mit der Einfügemarke
`abschluss();` (S-B3), `statusLeiste`, `verbundZeileZustand`, `OberflaechenStand` und `TitlerAktionen` aus
`lib/oberflaeche.ts` (S-B4).

**Dateien:**
- Create: `apps/titler/src/renderer/src/lib/bruecken.ts` (Brücken-Quellen `MASTER_LINK_QUELLE`, `VERBUND_QUELLE`)
- Create: `apps/titler/src/renderer/src/views/KopfMitte.tsx` (`VerbundZeile`)
- Modify: `packages/ui/src/components/StatusPill.tsx` (optionale Prop `kuerzen`, additiv; E18) und
  `packages/ui/test/statusbar.test.tsx` (eine Prüfung direkt vor `// ── StatusBar ──`)
- Create: `apps/titler/src/renderer/src/views/felder.tsx` (die lokalen `Field`, `Labeled`, `ColorField` und `Slider`,
  unverändert aus `OperatorView.tsx` verschoben)
- Create: `apps/titler/src/renderer/src/views/Einstellungen.tsx` (Panel-Inhalt; in C9 der Inhalt des alten Reiters
  „Einstellungen“, Werte aus dem Stand, Handler aus den Aktionen)
- Modify: `apps/titler/src/renderer/src/views/OperatorView.tsx` (AppShell, Brücken, Panel-Zustand; alte Kopfzeile, Pillen,
  Reiter, `VerbundAbzeichen`, `VERBUND_FARBE` und die lokalen Felder entfallen)
- Create: `apps/titler/test/ui/testzustand.ts` (Fixtures, Store-Render, HTML-Lesehilfen für C9–C12)
- Create: `apps/titler/test/ui/rahmen.test.tsx`
- Modify: `apps/titler/test/ui/selftest.ts` (Import-Zeile direkt vor `abschluss();`)

**Interfaces:**
- Consumes:
  ```ts
  // S-A4 (C4) · apps/titler/src/shared/types.ts (JmtitlerApi, direkt nach onVerbundAnzeige)
  masterLink: () => Promise<MasterLinkMeldungZeile | null>;
  onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => () => void;
  // R2 (unverändert): verbundAnzeige(): Promise<VerbundAnzeigeZeile | null>; onVerbundAnzeige(cb): () => void
  // S-B1 (C5) · @jm/ui
  export interface BrueckenQuelle<T> { abfrage(): Promise<T | null>; ereignis(cb: (wert: T | null) => void): () => void }
  export function useBrueckenWert<T>(quelle: BrueckenQuelle<T> | undefined): T | null | undefined;
  // S-B4 (C8) · apps/titler/src/renderer/src/lib/oberflaeche.ts
  export interface OberflaechenStand { config: TitlerConfig; status: TitlerStatus; displays: DisplayInfo[] | undefined; masterLink: MasterLinkMeldungZeile | null | undefined }
  export interface TitlerAktionen { setConfig(patch: PartialTitlerConfig): void; startNdi(name: string): void; stopNdi(): void; pickFolder(): void; zurueckZumEigenenOrdner(): void }
  export function statusLeiste(s: OberflaechenStand): StatusItem[];
  export function verbundZeileZustand(farbe: VerbundAnzeigeZeile['farbe']): StatusState;
  // Fundament · @jm/ui: AppShell (Props Spec 3.1), StatusPill; @jm/ui/testhilfe: ok, gleich, enthaelt, enthaeltNicht,
  // render, pruefeIdVerweise, leseText
  ```
- Produces in `@jm/ui` (additiv, Spec 4.1):
  ```ts
  // packages/ui/src/components/StatusPill.tsx
  export interface StatusPillProps { state: StatusState; text: string; title?: string; className?: string; kuerzen?: boolean }
  // kuerzen: Text in <span class="min-w-0 truncate">, Pille zusätzlich min-w-0 max-w-full; ohne kuerzen Markup wie bisher
  ```
- Produces (Register S-C, exakt; C10–C12 und Block D bauen darauf):
  ```ts
  // apps/titler/src/renderer/src/lib/bruecken.ts  (modulweit; window nur im Funktionskörper, hinter typeof window)
  export const MASTER_LINK_QUELLE: BrueckenQuelle<MasterLinkMeldungZeile>;   // ohne window/Preload: abfrage → null, ereignis → () => {}
  export const VERBUND_QUELLE: BrueckenQuelle<VerbundAnzeigeZeile>;
  // apps/titler/src/renderer/src/views/KopfMitte.tsx
  export function VerbundZeile(p: { anzeige: VerbundAnzeigeZeile | null | undefined }): React.JSX.Element | null;   // StatusPill + title; null/undefined → null
  // apps/titler/src/renderer/src/views/Einstellungen.tsx  (C9-Form; C10 erweitert die Props auf die Register-Form)
  export function Einstellungen(p: { stand: OberflaechenStand; aktionen: TitlerAktionen }): React.JSX.Element;
  // apps/titler/src/renderer/src/views/felder.tsx  (bis C11 auch Field und Labeled)
  export function Field(…): React.JSX.Element; export function Labeled(…): React.JSX.Element;
  export function ColorField(…): React.JSX.Element; export function Slider(…): React.JSX.Element;   // Props wie bisher
  // apps/titler/test/ui/testzustand.ts  (nur Tests)
  export function basisStatus(z?: Partial<TitlerStatus>): TitlerStatus;          // frischer Titler: kein Ordner, kein NDI, keine Steuerserver-Meldung
  export function basisConfig(z?: Partial<TitlerConfig>): TitlerConfig;
  export function basisStand(z?: Partial<OberflaechenStand>): OberflaechenStand; // displays und masterLink undefined (wie beim Server-Render)
  export function protokollAktionen(log: string[]): TitlerAktionen;              // schreibt jeden Aufruf mit
  export function eintraege(n: number): TitlerStatus['entries'];
  export const VORLAGEN: GraphicTemplate[]; export const MONITORE: DisplayInfo[];
  export function mitStore<T>(state: TitlerState | null, f: () => T): T;         // Render des ganzen Fensters über getInitialState()
  export function ohneKommentare(q: string): string; export function tags(html: string, name: string): string[];
  export function attr(tag: string | undefined, name: string): string | undefined; export function text(html: string): string;
  export function statusEintraege(html: string): Array<[string | undefined, string | undefined, string | undefined]>;
  export function bereich(html: string, marke: string): string;                  // Element mit data-titler="{marke}" samt Inhalt
  ```
  `OperatorView` hält ab hier: `panelOffen` und `panelAbschnitt` (aus `onSettingsChange`), `displays`
  (`DisplayInfo[] | undefined`, Start `undefined`), `importParsed`, die zwei Brücken über
  `useBrueckenWert(MASTER_LINK_QUELLE)` und `useBrueckenWert(VERBUND_QUELLE)` (vor dem frühen `return` für „Lädt…“).

**Verhalten (verbindlich):**
- `OperatorView` rendert `AppShell` mit `tool="Titler"`, `headerCenter={<VerbundZeile anzeige={verbund} />}`,
  `onAir={{ live }}` (E11: dieselbe Engine-Größe wie Companion-STATE `on_air`), `status={statusLeiste(stand)}`,
  `settings={<Einstellungen stand={stand} aktionen={aktionen} />}`, `settingsOpen={panelOffen}`,
  `settingsSection={panelAbschnitt}` und `onSettingsChange` (setzt beides). Das Panel startet zu und merkt nichts (E14).
- Kopfzeile: links Logo und „JM Titler“ aus `AppHeader`, der Untertitel „Live-CG → NDI“ entfällt (E18); rechts ON AIR,
  Hell/Dunkel (`ThemeToggle`, gemerkt unter `jm-theme`, E15) und ⚙. Mitte: `VerbundZeile` – die R2-Zeile als `StatusPill`
  mit `verbundZeileZustand(farbe)` (gruen ok, gelb warn, rot error, gedaempft off), `title` = voller Text und `kuerzen`
  (der Text endet bei Platzmangel mit „…“, 2b-Spec 16.5, G4), in einer Hülle `block min-w-0 max-w-full overflow-hidden`;
  ohne Zeile (Einzelplatz, Brücke offen, kein Preload) nichts.
- `StatusPill` bekommt dafür die optionale Prop `kuerzen` (E18): Der Text steht dann in `<span class="min-w-0 truncate">`,
  die Pille trägt zusätzlich `min-w-0 max-w-full`. Ohne die Prop bleibt das Markup Zeichen für Zeichen wie bisher (Spec 4.1;
  die Prüfungen der Pille in `packages/ui/test/statusbar.test.tsx` bleiben grün).
- Statusleiste: genau `statusLeiste(stand)` mit `stand = { config, status, displays, masterLink }` – dieselbe Ableitung wie
  das Panel (Spec 6.1). Ohne Brücke (Server-Render, Test) bleibt der Master-Eintrag „unbekannt“, nie `ok`.
- Brücken (E5): `MASTER_LINK_QUELLE` und `VERBUND_QUELLE` sind modulweite Konstanten in `lib/bruecken.ts`; `window.jmtitler`
  steht dort genau einmal, hinter `typeof window === 'undefined'`. Ohne `window` oder ohne Preload-Methode: Abfrage `null`,
  Ereignis liefert eine Abmeldung und meldet nie. Der R2-Effekt aus `VerbundAbzeichen` geht im Hook auf. Der Preload bleibt
  unverändert; ein Quelltext-Test hält `verbundAnzeige`/`onVerbundAnzeige` (R2-Durchgang) und `masterLink`/`onMasterLink`
  (S-A4) fest (Review Focus 3).
- `displays` startet `undefined` (Statusleiste „unbekannt“ statt leerer Liste); ein abgelehnter `listDisplays()` setzt
  `undefined` (E8).
- Was der Server-Render nicht zeigen kann, hält ein Quelltext-Wächter in `rahmen.test.tsx` fest: ON AIR aus der
  Engine-Größe `live` (`onAir={{ live }}`, E11; ohne Browser ist `live` immer false), das Öffnen des Panels über ⚙ und
  Statuseintrag (`settingsOpen`, `settingsSection`, `setPanelOffen(offen)`, `setPanelAbschnitt(abschnitt)`), die fünf
  Aktionen an Store und Preload und der Ablehnungs-Zweig von `listDisplays()`.
- Weg sind: die alte Kopfzeile mit beiden Pillen („Suite …“, „NDI …“), `Tabs`/`TABS`/`TabKey`, der Reiter-Zustand mit
  `titler.operator.tab` (behebt Nr. 98), `VerbundAbzeichen`, `VERBUND_FARBE` und `suiteClients` im Renderer.
- G8: `remote.onCommand`, `onFileOpened`, `reportState` und `listDisplays` bleiben Effekte in `OperatorView`. Der alte
  Inhalt des Reiters „Steuerung“ (Vorschau, Take/Clear, Vorlage, Inhalt, Grafik-Vorlagen, Daten / Recall, Stil) bleibt in
  C9 als `children`; die CG-Vorschau bleibt das erste `<canvas>` (R2-Durchgang `:257`, `:364`).
- `Einstellungen.tsx` trägt den Inhalt des alten Reiters „Einstellungen“ wortgleich (DataLink, iveo, Ausgabe (NDI), Ausgabe
  (2. Bildschirm)); Werte aus `stand`, Handler aus `aktionen` (`window.jmtitler.zurueckZumEigenenOrdner()` wird
  `aktionen.zurueckZumEigenenOrdner()`). Kein `window`, kein `useEffect` (G7, G8). Ab C11 bauen die Abschnitte aus
  `@jm/settings` das Panel neu.

---

- [ ] **Step 1: Testhilfen** (Neue Datei `apps/titler/test/ui/testzustand.ts`)

```ts
// Testhilfen der Titler-Oberflächentests C9–C12 (UX-Pilot): feste Titler-Zustände für Render-Tests, der Render des ganzen
// Bedienfensters über den Anfangszustand des Stores und kleine Lesehilfen für das HTML aus renderToStaticMarkup.
import {
  DEFAULT_CONFIG,
  type DisplayInfo,
  type GraphicTemplate,
  type TitlerConfig,
  type TitlerState,
  type TitlerStatus,
} from '@shared/types';
import type { OberflaechenStand, TitlerAktionen } from '@/lib/oberflaeche';
import { useTitler } from '@/store/titler';

/** Status eines frisch gestarteten Titlers: kein Ordner, kein NDI, keine Meldung des Steuerservers. */
export function basisStatus(z: Partial<TitlerStatus> = {}): TitlerStatus {
  return {
    ndiActive: false,
    connections: 0,
    suiteClients: 0,
    variables: {},
    dataSources: [],
    entries: [],
    activeEntry: -1,
    datenQuelle: { art: 'ordner', zeile: '', zurueckKnopf: null, ohneOrdner: true },
    ...z,
  };
}

export function basisConfig(z: Partial<TitlerConfig> = {}): TitlerConfig {
  return { ...DEFAULT_CONFIG, ...z };
}

/** Stand für lib/oberflaeche.ts: Monitorliste und Master-Link noch offen (undefined), wie beim Server-Render. */
export function basisStand(z: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return { config: basisConfig(), status: basisStatus(), displays: undefined, masterLink: undefined, ...z };
}

/** Aktionen, die jeden Aufruf mitschreiben (für Prop-Bauer und Knöpfe ohne DOM). */
export function protokollAktionen(log: string[]): TitlerAktionen {
  return {
    setConfig: (patch) => void log.push(`setConfig ${JSON.stringify(patch)}`),
    startNdi: (name) => void log.push(`startNdi ${name}`),
    stopNdi: () => void log.push('stopNdi'),
    pickFolder: () => void log.push('pickFolder'),
    zurueckZumEigenenOrdner: () => void log.push('zurueckZumEigenenOrdner'),
  };
}

/** n Einträge „Person 1“ … mit Schlüsseln k0 … */
export function eintraege(n: number): TitlerStatus['entries'] {
  return Array.from({ length: n }, (_, i) => ({ key: `k${i}`, label: `Person ${i + 1}` }));
}

/** Zwei Grafik-Vorlagen: eine mit zwei Textfeldern, ein reines Standbild (für Bedienung und Panel, C10/C11). */
export const VORLAGEN: GraphicTemplate[] = [
  {
    id: 'v1',
    name: 'Bauchbinde rot',
    width: 1920,
    height: 1080,
    createdAt: 1,
    slots: [
      { key: 'name', label: 'Name-Ebene', x: 0, y: 0, w: 10, h: 10, fontFamily: 'Manrope', fontSize: 40, fontWeight: 700, color: '#fff', align: 'left', lineHeight: 1.2, defaultText: '{{name}}' },
      { key: 'rolle', label: 'Rolle-Ebene', x: 0, y: 0, w: 10, h: 10, fontFamily: 'Manrope', fontSize: 30, fontWeight: 400, color: '#fff', align: 'left', lineHeight: 1.2, defaultText: 'Moderation' },
    ],
  },
  { id: 'v2', name: 'Standbild', width: 1920, height: 1080, createdAt: 2, slots: [] },
];

export const MONITORE: DisplayInfo[] = [
  { id: 1, label: '1920×1080 · primär', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, size: { width: 1920, height: 1080 }, scaleFactor: 1, primary: true, internal: false },
  { id: 2, label: '1920×1080', bounds: { x: 1920, y: 0, width: 1920, height: 1080 }, size: { width: 1920, height: 1080 }, scaleFactor: 1, primary: false, internal: false },
];

/**
 * Führt f mit einem Store-Zustand aus. Beim Server-Render liest zustand 4.5.7 den Anfangszustand (getInitialState); ein
 * setState wirkt dort nicht. Deshalb wird dessen `state` für die Dauer von f gesetzt und danach zurückgestellt.
 */
export function mitStore<T>(state: TitlerState | null, f: () => T): T {
  const anfang = useTitler.getInitialState();
  const vorher = anfang.state;
  anfang.state = state;
  try {
    return f();
  } finally {
    anfang.state = vorher;
  }
}

/** Quelltext ohne Kommentare (Zeilen- und Blockkommentare, auch JSX-Kommentare), für Prüfungen am Code. */
export function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function entities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Alle öffnenden Tags eines Elements, z. B. tags(html, 'button'). */
export function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}(?=[\\s>/])[^>]*>`, 'g')) ?? [];
}

/** Wert eines Attributs in einem öffnenden Tag (Entities aufgelöst), sonst undefined. */
export function attr(tag: string | undefined, name: string): string | undefined {
  const m = tag?.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? entities(m[1]) : undefined;
}

/** Text ohne Tags (Entities aufgelöst). */
export function text(html: string): string {
  return entities(html.replace(/<[^>]+>/g, ''));
}

/** Statuseinträge der Leiste in Reihenfolge: [id, Zustand, Tooltip „Label: Detail“]. */
export function statusEintraege(html: string): Array<[string | undefined, string | undefined, string | undefined]> {
  return [...html.matchAll(/<(?:button|span)\s[^>]*data-status-id="[^"]*"[^>]*>/g)].map((m) => [
    attr(m[0], 'data-status-id'),
    attr(m[0], 'data-state'),
    attr(m[0], 'title'),
  ]);
}

/** Das Element mit diesem data-titler-Wert samt Inhalt (Ende am passenden schließenden Tag gleichen Namens). */
export function bereich(html: string, marke: string): string {
  const m = new RegExp(`<(\\w+)\\s[^>]*data-titler="${marke}"[^>]*>`).exec(html);
  if (!m) return '';
  const name = m[1];
  const re = new RegExp(`<${name}(?=[\\s>/])[^>]*>|</${name}>`, 'g');
  re.lastIndex = m.index;
  let tiefe = 0;
  for (let t = re.exec(html); t; t = re.exec(html)) {
    tiefe += t[0].startsWith('</') ? -1 : 1;
    if (tiefe === 0) return html.slice(m.index, t.index + t[0].length);
  }
  return html.slice(m.index);
}
```

- [ ] **Step 2: Fehlschlagenden Test schreiben** (Neue Datei `apps/titler/test/ui/rahmen.test.tsx`)

```tsx
// UX-Pilot C9 · Rahmen des Titlers (Spec 3.1–3.3, 3.8, 3.9, 5.1, 7, 8; E5, E11, E14, E15, E18, E20): AppShell mit
// Kopfzeile (V-Zeile in der Mitte, ON AIR, Hell/Dunkel, ⚙), Statusleiste aus lib/oberflaeche.ts und einem Panel, das beim
// Start zu ist. Render ohne Browser und ohne window: Die Brücken bleiben offen, der Master-Eintrag zeigt „unbekannt“.
import { enthaelt, enthaeltNicht, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import type { MasterLinkMeldungZeile, VerbundAnzeigeZeile } from '@shared/types';
import { MASTER_LINK_QUELLE, VERBUND_QUELLE } from '@/lib/bruecken';
import { Einstellungen } from '@/views/Einstellungen';
import { VerbundZeile } from '@/views/KopfMitte';
import { OperatorView } from '@/views/OperatorView';
import {
  attr,
  basisConfig,
  basisStand,
  basisStatus,
  mitStore,
  ohneKommentare,
  protokollAktionen,
  statusEintraege,
  tags,
  text,
} from './testzustand';

// ── Brücken-Quellen (lib/bruecken.ts) ──
{
  ok(typeof window === 'undefined', 'Rahmen: Der Testlauf hat kein window (wie der Server-Render)');
  let ergebnis: unknown;
  try {
    const antworten = [await MASTER_LINK_QUELLE.abfrage(), await VERBUND_QUELLE.abfrage()];
    let gemeldet = 0;
    const ab = [MASTER_LINK_QUELLE.ereignis(() => void gemeldet++), VERBUND_QUELLE.ereignis(() => void gemeldet++)];
    for (const f of ab) f();
    ergebnis = [antworten, ab.map((f) => typeof f), gemeldet];
  } catch (e) {
    ergebnis = String(e);
  }
  gleich(ergebnis, [[null, null], ['function', 'function'], 0], 'Brücken ohne window: Abfrage null, Ereignis gibt eine Abmeldung und meldet nichts (G7)');
}
{
  // Mit nachgestelltem Preload: Jede Quelle nimmt ihren eigenen Kanal (Abfrage und Ereignis), nie den der anderen.
  const log: string[] = [];
  const meldung: MasterLinkMeldungZeile = { art: 'verbunden', adresse: '10.0.0.5:8723', seit: 1, masterName: 'Regie-PC', suite: 's' };
  const zeile: VerbundAnzeigeZeile = { text: 'Show vom Master: Probe · Stand 09:05', farbe: 'gruen' };
  const g = globalThis as { window?: unknown };
  g.window = {
    jmtitler: {
      masterLink: async () => (log.push('masterLink'), meldung),
      onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => (log.push('onMasterLink'), cb(meldung), () => void log.push('ab masterLink')),
      verbundAnzeige: async () => (log.push('verbundAnzeige'), zeile),
      onVerbundAnzeige: (cb: (a: VerbundAnzeigeZeile | null) => void) => (log.push('onVerbundAnzeige'), cb(zeile), () => void log.push('ab verbund')),
    },
  };
  try {
    const ereignisse: unknown[] = [];
    const ab1 = MASTER_LINK_QUELLE.ereignis((w) => void ereignisse.push(w));
    const ab2 = VERBUND_QUELLE.ereignis((w) => void ereignisse.push(w));
    const antworten = [await MASTER_LINK_QUELLE.abfrage(), await VERBUND_QUELLE.abfrage()];
    ab1();
    ab2();
    gleich(
      [log, ereignisse, antworten],
      [
        ['onMasterLink', 'onVerbundAnzeige', 'masterLink', 'verbundAnzeige', 'ab masterLink', 'ab verbund'],
        [meldung, zeile],
        [meldung, zeile],
      ],
      'Brücken mit Preload: MASTER_LINK_QUELLE nimmt masterLink/onMasterLink, VERBUND_QUELLE verbundAnzeige/onVerbundAnzeige',
    );
  } finally {
    delete g.window;
  }
}

// ── Kopfzeile Mitte (VerbundZeile, E18) ──
{
  const faelle = [
    ['gruen', 'ok'],
    ['gelb', 'warn'],
    ['rot', 'error'],
    ['gedaempft', 'off'],
  ] as const;
  const ist = faelle.map(([farbe]) => {
    const html = render(<VerbundZeile anzeige={{ text: `V-Zeile ${farbe}`, farbe }} />);
    const pille = tags(html, 'span').find((t) => attr(t, 'data-state') !== undefined);
    return [attr(pille, 'data-state'), attr(pille, 'title'), text(html).endsWith(`V-Zeile ${farbe}`)];
  });
  gleich(
    ist,
    faelle.map(([farbe, zustand]) => [zustand, `V-Zeile ${farbe}`, true]),
    'VerbundZeile: gruen/gelb/rot/gedaempft → StatusPill ok/warn/error/off mit Text und Tooltip (E18)',
  );
  gleich(
    [render(<VerbundZeile anzeige={null} />), render(<VerbundZeile anzeige={undefined} />)],
    ['', ''],
    'VerbundZeile: ohne V-Zeile (Einzelplatz, Brücke offen) nichts',
  );
  const alle = faelle.map(([farbe]) => render(<VerbundZeile anzeige={{ text: 'x', farbe }} />)).join('');
  ok(
    !/--warning|text-\[var\(--(success|destructive|warning)\)\]/.test(alle) && alle.includes('overflow-hidden'),
    'VerbundZeile: keine Statusfarbe auf Wörtern, kein Gelb --warning (Spec 4.2); die Hülle schneidet ab (overflow-hidden)',
  );
  const lang = 'Show vom Master: Jahresgala mit langem Namen · Stand 09:05';
  const kurz = render(<VerbundZeile anzeige={{ text: lang, farbe: 'gelb' }} />);
  const pille = tags(kurz, 'span').find((t) => attr(t, 'data-state') !== undefined);
  ok(
    kurz.includes(`<span class="min-w-0 truncate">${lang}</span>`) && (attr(pille, 'class') ?? '').includes('max-w-full') && attr(pille, 'title') === lang,
    'VerbundZeile: kürzt mit „…“ (truncate am Text, Pille höchstens so breit wie ihr Platz), der volle Text steht im Tooltip (2b-Spec 16.5, G4)',
  );
}

// ── Bedienfenster im Rahmen (Server-Render über den Anfangszustand des Stores) ──
{
  const html = mitStore({ config: basisConfig(), status: basisStatus() }, () => render(<OperatorView />));
  const [zahnrad] = tags(html, 'button').filter((t) => attr(t, 'data-zahnrad') !== undefined);
  const [thema] = tags(html, 'button').filter((t) => attr(t, 'data-theme') !== undefined);
  ok(
    html.includes('data-bereich="inhalt"') && text(html).includes('JM Titler') && !html.includes('Live-CG') && !html.includes('JM TITLER'),
    'Rahmen: AppShell mit „JM Titler“, ohne alte Kopfzeile (kein „Live-CG → NDI“, E18)',
  );
  gleich(
    [attr(thema, 'aria-label'), attr(zahnrad, 'aria-label'), attr(zahnrad, 'aria-expanded')],
    ['Darstellung: Dunkel. Umschalten auf Hell', 'Einstellungen öffnen', 'false'],
    'Kopfzeile rechts: Hell/Dunkel (E15) und ⚙ „Einstellungen öffnen“',
  );
  ok(
    html.includes('data-onair="bereit"') && !html.includes('<aside') && !html.includes('role="tab"'),
    'Rahmen beim Start: ON AIR zeigt „bereit“ (E11), Panel zu (E14), keine Reiter mehr',
  );
  gleich(
    statusEintraege(html),
    [
      ['master-link', 'off', 'Master: unbekannt'],
      ['iveo', 'off', 'iveo: nicht eingerichtet'],
      ['ndi', 'off', 'NDI: aus'],
      ['bildschirm', 'off', 'Bildschirm: unbekannt'],
      ['fernsteuerung', 'off', 'Fernsteuerung: unbekannt'],
      ['datalink', 'off', 'DataLink: kein Ordner'],
    ],
    'Statusleiste im Rahmen: Reihenfolge E20; ohne Brücke, Monitorliste und Steuerserver-Meldung „unbekannt“, nie ok (Spec 7.2)',
  );
  enthaeltNicht(html, 'Suite getrennt', 'Rahmen: die alte Pille „Suite …“ ist weg (ersetzt durch Statusleiste › Fernsteuerung)');
  enthaeltNicht(html, 'NDI ·', 'Rahmen: die alte Pille „NDI · …“ ist weg (ersetzt durch Statusleiste › NDI)');
  const [vorschau] = tags(html, 'canvas');
  gleich([attr(vorschau, 'width'), attr(vorschau, 'height')], ['960', '540'], 'Rahmen: das erste <canvas> ist die CG-Vorschau 960×540 (R2-Durchgang)');
  pruefeIdVerweise(html, 'Rahmen: id-Verweise im Bedienfenster gültig');
}
{
  const html = mitStore(null, () => render(<OperatorView />));
  enthaelt(html, 'Lädt…', 'Rahmen: ohne Zustand weiter „Lädt…“ (Nr. 1 unverändert)');
}

// ── Panel-Inhalt (views/Einstellungen.tsx) ──
{
  const log: string[] = [];
  const stand = basisStand({
    status: basisStatus({
      datenQuelle: { art: 'show', zeile: 'Quelle: Show „Probe“ · 3 Speaker', zurueckKnopf: 'Zurück zum eigenen Ordner (Daten)', ohneOrdner: false },
    }),
  });
  const html = render(<Einstellungen stand={stand} aktionen={protokollAktionen(log)} />);
  ok(
    ['DataLink', 'iveo', 'Zurück zum eigenen Ordner (Daten)'].every((t) => text(html).includes(t)) && log.length === 0,
    'Panel-Inhalt: DataLink, iveo und K1 rendern ohne window; Rendern löst keine Aktion aus',
  );
  const quelle = ohneKommentare(leseText('src/renderer/src/views/Einstellungen.tsx'));
  ok(!quelle.includes('window') && !quelle.includes('useEffect'), 'Panel-Inhalt: views/Einstellungen.tsx ohne window und ohne useEffect (G7, G8)');
}

// ── Quelltext ──
{
  const quelle = leseText('src/renderer/src/views/OperatorView.tsx');
  const fehlt = [
    'useBrueckenWert(MASTER_LINK_QUELLE)',
    'useBrueckenWert(VERBUND_QUELLE)',
    'headerCenter={<VerbundZeile anzeige={verbund} />}',
    'status={statusLeiste(stand)}',
    'useState<DisplayInfo[] | undefined>(undefined)',
    'window.jmtitler.remote.onCommand(',
    'window.jmtitler.onFileOpened(',
    'window.jmtitler.remote.reportState(',
    'window.jmtitler.listDisplays()',
    '.then(setDisplays, () => setDisplays(undefined))',
  ].filter((z) => !quelle.includes(z));
  ok(
    fehlt.length === 0,
    'Quelltext OperatorView: Brücken, Kopfmitte, Statusleiste, Monitorliste offen (auch nach einem Ladefehler, E8); die Effekte bleiben hier (G8)',
  );
  for (const z of fehlt) console.log(`     fehlt: ${z}`);
  // Was der Server-Render nicht zeigen kann (live = true, ein Klick auf ⚙, einen Statuseintrag oder einen Knopf im Panel),
  // hält der Quelltext fest (Review Focus 1 und 2).
  const onAir = ['const { live, take, clear } = useTitlerEngine(resolved, ndiActive, previewRef, { graphic });', 'onAir={{ live }}'].filter(
    (z) => !quelle.includes(z),
  );
  ok(onAir.length === 0, 'Quelltext OperatorView: ON AIR folgt nur der Engine-Größe live (E11; der Server-Render kennt nur live = false)');
  for (const z of onAir) console.log(`     fehlt: ${z}`);
  const panel = [
    'settingsOpen={panelOffen}',
    'settingsSection={panelAbschnitt}',
    'setPanelOffen(offen);',
    'setPanelAbschnitt(abschnitt);',
    'aktionen={aktionen}',
    'setConfig: (patch) => void setConfig(patch),',
    'startNdi: (name) => void startNdi(name),',
    'stopNdi: () => void stopNdi(),',
    'pickFolder: () => void pickFolder(),',
    'zurueckZumEigenenOrdner: () => void window.jmtitler.zurueckZumEigenenOrdner(),',
  ].filter((z) => !quelle.includes(z));
  ok(
    panel.length === 0,
    'Quelltext OperatorView: ⚙ und Statuseintrag öffnen das Panel am Abschnitt, die Aktionen des Panels gehen an Store und Preload (Review Focus 2)',
  );
  for (const z of panel) console.log(`     fehlt: ${z}`);
  const verboten = ['localStorage', 'titler.operator.tab', 'Tabs', 'VerbundAbzeichen', 'VERBUND_FARBE', 'suiteClients'].filter((z) =>
    quelle.includes(z),
  );
  ok(verboten.length === 0, 'Quelltext OperatorView: kein Reiter, kein localStorage, keine alte Kopfzeile (E14, E18)');
  for (const z of verboten) console.log(`     gefunden: ${z}`);
  const bruecken = ohneKommentare(leseText('src/renderer/src/lib/bruecken.ts'));
  ok(
    bruecken.includes("typeof window === 'undefined' ? undefined : window.jmtitler") && (bruecken.match(/window\.jmtitler/g) ?? []).length === 1,
    'Quelltext lib/bruecken.ts: window.jmtitler genau einmal, hinter dem typeof-Wächter (E5)',
  );
  const preload = leseText('src/preload/index.ts');
  ok(
    preload.includes("verbundAnzeige: () => (ipcRenderer.invoke('jmps:verbund-anzeige')") &&
      preload.includes('onVerbundAnzeige: (cb) => {') &&
      preload.includes('masterLink: ') &&
      preload.includes('onMasterLink: '),
    'Quelltext Preload: verbundAnzeige und onVerbundAnzeige (R2-Durchgang, G4) sowie masterLink und onMasterLink (S-A4) stehen da',
  );
}
```

Einfügen in `apps/titler/test/ui/selftest.ts` direkt vor der Zeile `abschluss();`:
```ts
import './rahmen.test';
```

Die Kürzung der V-Zeile (E18) braucht die neue Prop `kuerzen` von `StatusPill`; ihre Prüfung kommt zu den Prüfungen der
Pille.

Einfügen in `packages/ui/test/statusbar.test.tsx` direkt vor der Zeile `// ── StatusBar ──`:
```tsx
{
  // UX-Pilot C9 (2b-Spec 16.5, G4): kuerzen legt den Text in ein eigenes span mit truncate, damit er bei Platzmangel mit
  // „…“ endet; die Pille wird höchstens so breit wie ihr Platz. Ohne kuerzen bleibt das Markup wie bisher.
  const satz = 'Show vom Master: Jahresgala mit langem Namen · Stand 09:05';
  const kurz = render(<StatusPill state="warn" text={satz} title={satz} kuerzen />);
  const ohne = render(<StatusPill state="warn" text={satz} title={satz} />);
  const [wurzel] = tags(kurz, 'span');
  ok(
    hatKlassen(wurzel, 'min-w-0 max-w-full') &&
      attr(wurzel, 'title') === satz &&
      kurz.includes(`<span class="min-w-0 truncate">${satz}</span>`) &&
      !ohne.includes('truncate') &&
      !ohne.includes('max-w-full'),
    'StatusPill kuerzen: Text mit „…“ gekürzt (truncate), Pille höchstens so breit wie ihr Platz, voller Text im title; ohne kuerzen unverändert',
  );
}

```

- [ ] **Step 3: Tests laufen lassen (rot)**

```
npm run selftest -w @jm/titler > <eigener Scratchpad>/c9-rot.txt 2>&1; echo "Exit=$?"
grep -E "ERR_MODULE_NOT_FOUND|^Error" <eigener Scratchpad>/c9-rot.txt
npm run selftest -w @jm/ui > <eigener Scratchpad>/c9-ui-rot.txt 2>&1; echo "Exit=$?"
grep -c "^ok" <eigener Scratchpad>/c9-ui-rot.txt; grep -E "^FAIL|FEHLGESCHLAGEN" <eigener Scratchpad>/c9-ui-rot.txt
```
Erwartet (gemessen): `Exit=1`; der alte Lauf ist grün (538 `ok`), der Oberflächen-Lauf bricht beim Laden ab:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/lib' imported from <Worktree>\apps\titler\test\ui\rahmen.test.tsx
```
(`<Worktree>` steht für den Pfad des Plan-Worktrees.) `lib/bruecken.ts` und die Ansichten gibt es noch nicht; `tsx` meldet den
Alias-Teil `@/lib` als Paketnamen. Dann `@jm/ui`: `Exit=1`, **679** `ok` und genau diese `FAIL`:
```
FAIL StatusPill kuerzen: Text mit „…“ gekürzt (truncate), Pille höchstens so breit wie ihr Platz, voller Text im title; ohne kuerzen unverändert
1 FEHLGESCHLAGEN
```

- [ ] **Step 4: Brücken-Quellen** (Neue Datei `apps/titler/src/renderer/src/lib/bruecken.ts`)

```ts
// Lesende Brücken des Titlers für useBrueckenWert (UX-Pilot C9; Spec 3.8, 3.9; E5): die Master-Link-Meldung
// (`jmps:master-link`) und die V-Zeile aus Master-Link 2b R2 (`jmps:verbund-anzeige`). Modulweite Konstanten, damit der
// Hook eine stabile Quelle bekommt. window.jmtitler wird nur in den Funktionskörpern gelesen und nur hinter typeof window:
// Render-Tests und Server-Render laufen ohne window, dort würfe schon `window?.` einen ReferenceError. Fehlt der Preload
// oder eine seiner Methoden, antwortet die Abfrage null und das Ereignis meldet nie (G7).
import type { BrueckenQuelle } from '@jm/ui';
import type { JmtitlerApi, MasterLinkMeldungZeile, VerbundAnzeigeZeile } from '@shared/types';

/** Die Preload-Brücke, wenn es sie gibt; ohne window (Node, Test) oder ohne Preload undefined. */
function preload(): Partial<JmtitlerApi> | undefined {
  return typeof window === 'undefined' ? undefined : window.jmtitler;
}

/** Master-Link-Meldung (Spec 3.9): Abfrage beim Einhängen, danach jedes Ereignis. */
export const MASTER_LINK_QUELLE: BrueckenQuelle<MasterLinkMeldungZeile> = {
  abfrage: () => preload()?.masterLink?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.onMasterLink?.(cb) ?? (() => {}),
};

/** V-Zeile „Show vom Master: … · Stand …“ (Master-Link 2b R2) für die Kopfzeile Mitte. */
export const VERBUND_QUELLE: BrueckenQuelle<VerbundAnzeigeZeile> = {
  abfrage: () => preload()?.verbundAnzeige?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.onVerbundAnzeige?.(cb) ?? (() => {}),
};
```

- [ ] **Step 5: `StatusPill` kürzt auf Wunsch** (`packages/ui/src/components/StatusPill.tsx`, additiv nach Spec 4.1, E18)

Vier Ersetzungen. Ohne `kuerzen` bleibt das gerenderte Markup Zeichen für Zeichen wie bisher.
Datei `packages/ui/src/components/StatusPill.tsx`, Vorher:
```tsx
  title?: string;
  className?: string;
}
```
Nachher:
```tsx
  title?: string;
  className?: string;
  /**
   * true: Der Text steht in einem eigenen span mit truncate und endet bei Platzmangel mit „…“; die Pille wird höchstens so
   * breit wie ihr Platz (UX-Pilot C9, V-Zeile des Titlers nach 2b-Spec 16.5). Ohne die Prop bleibt das Markup wie bisher.
   */
  kuerzen?: boolean;
}
```
Vorher:
```tsx
export function StatusPill({ state, text, title, className }: StatusPillProps): React.JSX.Element {
```
Nachher:
```tsx
export function StatusPill({ state, text, title, className, kuerzen }: StatusPillProps): React.JSX.Element {
```
Vorher:
```tsx
        'text-[11px] font-semibold',
```
Nachher:
```tsx
        'text-[11px] font-semibold',
        kuerzen && 'min-w-0 max-w-full',
```
Vorher:
```tsx
      <span className="sr-only">{UI_TEXTE.zustand[state]}: </span>
      {text}
```
Nachher:
```tsx
      <span className="sr-only">{UI_TEXTE.zustand[state]}: </span>
      {kuerzen ? <span className="min-w-0 truncate">{text}</span> : text}
```
Dann `@jm/ui` grün und typgeprüft:
```
npm run selftest -w @jm/ui > <eigener Scratchpad>/c9-ui.txt 2>&1; echo "Exit=$?"
grep -c "^ok" <eigener Scratchpad>/c9-ui.txt; grep "^ok   StatusPill kuerzen" <eigener Scratchpad>/c9-ui.txt
npm run typecheck -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen): `Exit=0`, **680** `ok` (vorher 679, dazu diese eine), „ALLE TESTS OK“:
```
ok   StatusPill kuerzen: Text mit „…“ gekürzt (truncate), Pille höchstens so breit wie ihr Platz, voller Text im title; ohne kuerzen unverändert
```
und die Typprüfung `Exit=0` ohne Meldung.

- [ ] **Step 6: Kopfzeile Mitte** (Neue Datei `apps/titler/src/renderer/src/views/KopfMitte.tsx`)

```tsx
// Kopfzeile Mitte des Titlers (UX-Pilot C9; Spec 3.2, 5.1, 9.2; E18): die V-Zeile aus Master-Link 2b R2 („Show vom
// Master: … · Stand …“) als StatusPill. Die Farbe der Zeile wird zum Zustand (Symbol und Rand), das Wort bleibt in
// Vordergrundfarbe (Spec 4.2). In der schmalen Mitte endet der Text mit „…“ (kuerzen, 2b-Spec 16.5); der volle Text steht
// im Tooltip.
import { StatusPill } from '@jm/ui';
import type { VerbundAnzeigeZeile } from '@shared/types';
import { verbundZeileZustand } from '@/lib/oberflaeche';

/** V-Zeile oder nichts (Einzelplatz, Brücke noch offen oder ohne Preload). */
export function VerbundZeile({ anzeige }: { anzeige: VerbundAnzeigeZeile | null | undefined }): React.JSX.Element | null {
  if (!anzeige) return null;
  return (
    <span data-titler="verbund" className="block min-w-0 max-w-full overflow-hidden">
      <StatusPill state={verbundZeileZustand(anzeige.farbe)} text={anzeige.text} title={anzeige.text} kuerzen />
    </span>
  );
}
```

- [ ] **Step 7: Lokale Felder verschieben** (Neue Datei `apps/titler/src/renderer/src/views/felder.tsx`)

Der Inhalt ist der Block `function Field` bis zum Ende von `function Slider` aus `OperatorView.tsx` (heute `:792-879`),
jeweils mit `export`; Step 9 entfernt ihn dort.
```tsx
// Lokale Eingaben des Titlers, unverändert aus OperatorView.tsx verschoben (UX-Pilot C9): Einstellungen.tsx und die
// Bedienung nutzen sie gemeinsam. Field und Labeled entfallen in C11 (Panel aus @jm/settings, Inhalt aus @jm/ui); Slider
// und ColorField bleiben, weil @jm/ui dafür keinen Baustein hat (E23).

export function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}): React.JSX.Element {
  return (
    <label className="block">
      <div className="text-sm font-semibold mb-1">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
      />
    </label>
  );
}

export function Labeled({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label className="block flex-1">
      <div className="text-sm font-semibold mb-1">{label}</div>
      {children}
    </label>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}): React.JSX.Element {
  return (
    <label className="flex-1">
      <div className="text-[11px] font-semibold mb-1 text-[var(--muted-foreground)]">{label}</div>
      <div className="flex items-center gap-2 h-9 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-7 rounded cursor-pointer bg-transparent border-0 p-0"
        />
        <span className="text-[11px] tabular text-[var(--muted-foreground)] uppercase">{value}</span>
      </div>
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}): React.JSX.Element {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between text-sm mb-1">
        <span className="font-semibold">{label}</span>
        <span className="tabular text-[var(--muted-foreground)]">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--primary)]"
      />
    </label>
  );
}
```

- [ ] **Step 8: Panel-Inhalt mit dem alten Reiter „Einstellungen“** (Neue Datei `apps/titler/src/renderer/src/views/Einstellungen.tsx`)

Der JSX-Teil ist der Zweig `) : (` des alten Reiters (heute `OperatorView.tsx:608-772`), um zehn Leerzeichen
ausgerückt; geändert sind nur der Kommentar über DataLink und der K1-Handler.
```tsx
// Inhalt des Einstellungs-Panels (UX-Pilot C9; Spec 3.1, 3.6): vorerst der Inhalt des bisherigen Reiters
// „Einstellungen“, unverändert bis auf die Herkunft der Werte (Stand) und der Handler (Aktionen). Ab C11 bauen die
// Abschnitte aus @jm/settings das Panel neu. Kein window und kein Effekt hier (G7, G8): Das Panel ist nur offen
// gemountet; was immer laufen muss, bleibt in OperatorView.
import { Button, SettingsSection } from '@jm/ui';
import type { OberflaechenStand, TitlerAktionen } from '@/lib/oberflaeche';
import { ColorField, Field, Labeled } from './felder';

const RESOLUTIONS = [
  { label: '1920×1080', w: 1920, h: 1080 },
  { label: '1280×720', w: 1280, h: 720 },
];
const FPS = [25, 30, 50, 60];

export function Einstellungen({ stand, aktionen }: { stand: OberflaechenStand; aktionen: TitlerAktionen }): React.JSX.Element {
  const c = stand.config;
  const { ndiActive, entries, dataError, datenQuelle } = stand.status;
  const displays = stand.displays ?? [];
  const { setConfig, pickFolder, startNdi, stopNdi } = aktionen;
  // iveo speist Speaker über die Datenquelle „Show“ ein (speakers.tsv in userData/iveo-data,
  // #11, Spec 7.7) — der Titler hält kein Token/Backend. `config.dataFolder` ist nur noch
  // der eigene Ordner des Bedieners und sagt darüber nichts mehr.
  const iveoActive = datenQuelle.art === 'show' || datenQuelle.art === 'master';
  // Ordnerwahl im Verbund gesperrt (Spec 17.2, Owner O1): Text statt Auswahl; der Main lehnt ebenfalls ab.
  const ordnerGesperrt = datenQuelle.ordnerGesperrt;

  return (
    <div className="space-y-5">
      {/* DataLink (#86): Datenquelle konfigurieren (Abruf in der Bedienung unter „Daten / Recall“). */}
      <SettingsSection
        title="DataLink"
        description={
          <>
            Platzhalter <code className="text-[var(--primary)]">{'{{name}}'}</code> in den Textfeldern
            werden aus den Dateien im Ordner gefüllt. CSV mit Kopfzeile = Liste (je Zeile ein Eintrag,
            im Reiter <b>Steuerung</b> abrufbar); <code>schlüssel=wert</code>-Datei = ein Eintrag.
          </>
        }
      >
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
            <Button variant="ghost" size="sm" uppercase={false} onClick={() => void setConfig({ dataFolder: '' })} title="Watchfolder entfernen">
              ✕
            </Button>
          ) : null}
        </div>
        {ordnerGesperrt ? (
          <p className="text-[11px] text-[var(--muted-foreground)]">{ordnerGesperrt}</p>
        ) : null}
        {/* K1 (Spec 7.7/7.8): nur bei Quelle Show und einem eigenen Ordner, der nicht iveo-data ist */}
        {datenQuelle?.zurueckKnopf ? (
          <Button
            variant="outline"
            size="sm"
            uppercase={false}
            className="w-full"
            onClick={() => aktionen.zurueckZumEigenenOrdner()}
          >
            {datenQuelle.zurueckKnopf}
          </Button>
        ) : null}
        {dataError ? (
          <p className="text-[11px] text-[var(--destructive)]">DataLink: {dataError}</p>
        ) : null}
      </SettingsSection>

      {/* iveo (#11): Status der automatischen Speaker-Übernahme aus der JM Show. */}
      <SettingsSection title="iveo">
        {iveoActive ? (
          <div className="rounded-[var(--radius)] border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--primary)' }} />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--primary)]">
                iveo aktiv
              </span>
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              {entries.length} Speaker aus der geöffneten JM Show im DataLink. Aktualisiert sich live nach
              iveo-Änderungen (verwaltet vom Launcher). Abruf im Reiter <b>Steuerung › Daten / Recall</b>.
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Kein iveo-Event aktiv. iveo-Speaker werden automatisch zu Bauchbinden-Variablen, sobald der
            Titler über eine <b>JM Show</b> mit iveo-Daten geöffnet wird — Verwaltung und Zugriffstoken
            bleiben im Launcher (der Titler speichert kein Token).
          </p>
        )}
      </SettingsSection>

      {/* Ausgabe (NDI) */}
      <SettingsSection title="Ausgabe (NDI)">
        <Field label="Quellname" value={c.ndiName} onChange={(v) => void setConfig({ ndiName: v })} />
        <div className="flex gap-2">
          <Labeled label="Auflösung">
            <select
              value={`${c.width}x${c.height}`}
              onChange={(e) => {
                const r = RESOLUTIONS.find((x) => `${x.w}x${x.h}` === e.target.value);
                if (r) void setConfig({ width: r.w, height: r.h });
              }}
              className="h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2 text-sm font-semibold"
            >
              {RESOLUTIONS.map((r) => (
                <option key={r.label} value={`${r.w}x${r.h}`}>
                  {r.label}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="fps">
            <select
              value={String(c.fps)}
              onChange={(e) => void setConfig({ fps: Number(e.target.value) })}
              className="h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2 text-sm font-semibold tabular"
            >
              {FPS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Labeled>
        </div>
        {ndiActive ? (
          <Button variant="destructive" className="w-full" onClick={() => void stopNdi()}>
            NDI stoppen
          </Button>
        ) : (
          <Button variant="primary" className="w-full" onClick={() => void startNdi(c.ndiName)}>
            NDI starten
          </Button>
        )}
        {c.width % 2 !== 0 || c.height % 2 !== 0 ? (
          <p className="text-[11px] text-[var(--destructive)]">Auflösung sollte gerade sein.</p>
        ) : null}
      </SettingsSection>

      {/* Ausgabe (2. Bildschirm, #161) */}
      <SettingsSection
        title="Ausgabe (2. Bildschirm)"
        description="Zeigt die Bauchbinde als Vollbild auf einem zweiten Monitor mit Chroma-Green-Hintergrund — für externe Keyer (vMix/ATEM/TriCaster) ohne NDI."
      >
        <Labeled label="Monitor">
          <select
            value={String(c.secondScreenDisplay)}
            onChange={(e) => void setConfig({ secondScreenDisplay: Number(e.target.value) })}
            className="h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2 text-sm font-semibold"
          >
            <option value="0">Primär (automatisch)</option>
            {displays.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.label}
              </option>
            ))}
          </select>
        </Labeled>
        <div className="flex gap-3 items-end">
          <ColorField label="Chroma" value={c.chromaColor} onChange={(v) => void setConfig({ chromaColor: v })} />
          <button
            onClick={() => void setConfig({ chromaColor: '#00B140' })}
            className="h-9 shrink-0 rounded-[var(--radius)] border border-[var(--border)] px-3 text-xs hover:bg-[var(--highlight)]"
            title="Standard-Green (#00B140) zurücksetzen"
          >
            Reset
          </button>
        </div>
        {c.secondScreenEnabled ? (
          <Button variant="destructive" className="w-full" onClick={() => void setConfig({ secondScreenEnabled: false })}>
            2. Bildschirm ausschalten
          </Button>
        ) : (
          <Button variant="primary" className="w-full" onClick={() => void setConfig({ secondScreenEnabled: true })}>
            2. Bildschirm einschalten
          </Button>
        )}
        <p className="text-[11px] text-[var(--muted-foreground)]">
          Tipp: Zweitmonitor wählen, damit die Ausgabe nicht die Operator-Oberfläche verdeckt.
        </p>
      </SettingsSection>
    </div>
  );
}
```

- [ ] **Step 9: `OperatorView` auf AppShell umbauen** (`apps/titler/src/renderer/src/views/OperatorView.tsx`)

Zwölf Ersetzungen, in dieser Reihenfolge; jede Vorher-Stelle kommt im jeweiligen Stand genau einmal vor. Der Inhalt des
alten Reiters „Steuerung“ bleibt in diesem Schritt wortgleich stehen (Einrückung unverändert, C10 ersetzt ihn).
Vorher:
```tsx
import { Button, cn, Collapsible, Logo, SettingsSection, Tabs, type TabItem } from '@jm/ui';
```
Nachher:
```tsx
import { AppShell, Button, cn, Collapsible, SettingsSection, useBrueckenWert } from '@jm/ui';
```
Vorher:
```tsx
  type TitlerConfig,
  type VerbundAnzeigeZeile,
```
Nachher:
```tsx
  type TitlerConfig,
```
Vorher:
```tsx
import { ImportDialog } from './ImportDialog';
```
Nachher:
```tsx
import { MASTER_LINK_QUELLE, VERBUND_QUELLE } from '@/lib/bruecken';
import { statusLeiste, type OberflaechenStand, type TitlerAktionen } from '@/lib/oberflaeche';
import { ImportDialog } from './ImportDialog';
import { Einstellungen } from './Einstellungen';
import { ColorField, Field, Slider } from './felder';
import { VerbundZeile } from './KopfMitte';
```
Vorher:
```tsx

const RESOLUTIONS = [
  { label: '1920×1080', w: 1920, h: 1080 },
  { label: '1280×720', w: 1280, h: 720 },
];
const FPS = [25, 30, 50, 60];

// Reiter des Steuerpults (#165): Live-Steuerung getrennt von Einstellungen, damit
// das Namensfeld nicht in einer langen Sektionsliste untergeht.
type TabKey = 'steuerung' | 'einstellungen';
const TABS: TabItem<TabKey>[] = [
  { key: 'steuerung', label: 'Steuerung' },
  { key: 'einstellungen', label: 'Einstellungen' },
];

```
Nachher:
```tsx

```
Vorher:
```tsx
  const connections = state?.status.connections ?? 0;
  const suiteClients = state?.status.suiteClients ?? 0;
```
Nachher:
```tsx
  const connections = state?.status.connections ?? 0;
```
Vorher:
```tsx
  // Monitore für die Zweitbildschirm-Auswahl (#161) — bei Hot-Plug aktualisieren.
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  useEffect(() => {
    const refresh = (): void => void window.jmtitler.listDisplays().then(setDisplays);
```
Nachher:
```tsx
  // Monitore für die Zweitbildschirm-Auswahl (#161) — bei Hot-Plug aktualisieren. undefined = Liste noch nicht
  // geladen oder nicht ladbar: Statusleiste und Panel zeigen dann „unbekannt“, nie eine leere Liste (E8).
  const [displays, setDisplays] = useState<DisplayInfo[] | undefined>(undefined);
  useEffect(() => {
    const refresh = (): void => void window.jmtitler.listDisplays().then(setDisplays, () => setDisplays(undefined));
```
Vorher:
```tsx
  // Reiter des Steuerpults (#165) — letzte Wahl merken, damit der Operator dort
  // weitermacht, wo er war (Live vs. Einrichten).
  const [tab, setTab] = useState<TabKey>(() => {
    if (typeof window === 'undefined') return 'steuerung';
    const v = window.localStorage.getItem('titler.operator.tab');
    return v === 'einstellungen' ? 'einstellungen' : 'steuerung';
  });
  useEffect(() => {
    try {
      window.localStorage.setItem('titler.operator.tab', tab);
    } catch {
      /* localStorage optional */
    }
  }, [tab]);
```
Nachher:
```tsx
  // Einstellungs-Panel (Spec 3.1, 3.6): zu beim Start, nichts gemerkt (E14); offen über ⚙ oder einen Statuseintrag.
  const [panelOffen, setPanelOffen] = useState(false);
  const [panelAbschnitt, setPanelAbschnitt] = useState<string | undefined>(undefined);
  // Lesende Brücken (Spec 3.9, E5): undefined, bis eine Antwort oder ein Ereignis da ist; ohne Preload null.
  const masterLink = useBrueckenWert(MASTER_LINK_QUELLE);
  const verbund = useBrueckenWert(VERBUND_QUELLE);
```
Vorher:
```tsx
  // iveo speist Speaker über die Datenquelle „Show“ ein (speakers.tsv in userData/iveo-data,
  // #11, Spec 7.7) — der Titler hält kein Token/Backend. `config.dataFolder` ist nur noch
  // der eigene Ordner des Bedieners und sagt darüber nichts mehr.
  const iveoActive = datenQuelle?.art === 'show' || datenQuelle?.art === 'master';
  // Ordnerwahl im Verbund gesperrt (Spec 17.2, Owner O1): Text statt Auswahl; der Main lehnt ebenfalls ab.
  const ordnerGesperrt = datenQuelle?.ordnerGesperrt;
  // Weiter/Zurück: gesperrt nur an den Rändern; ohne aktiven Eintrag beide frei (Spec 7.4).
  const nav = navGesperrt(activeEntry, entries.length);

  return (
    <div className="h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="h-14 shrink-0 flex items-center gap-3 px-6 border-b border-[var(--border)]/60">
        <Logo size={24} />
        <span className="text-sm font-extrabold tracking-[0.06em]">JM TITLER</span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          Live-CG → NDI
        </span>
        <VerbundAbzeichen />
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] font-extrabold border',
            suiteClients > 0
              ? 'border-[var(--primary)]/40 text-[var(--primary)]'
              : 'border-[var(--border)] text-[var(--muted-foreground)]',
          )}
          title="Verbundene Suite-Steuerclients (Companion, Q&A, Battle, System-Zustand)"
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: suiteClients > 0 ? 'var(--primary)' : 'var(--muted-foreground)' }}
          />
          {suiteClients > 0 ? `Suite · ${suiteClients} verbunden` : 'Suite getrennt'}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] font-extrabold border',
            ndiActive
              ? 'border-[var(--primary)]/40 text-[var(--primary)]'
              : 'border-[var(--border)] text-[var(--muted-foreground)]',
          )}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: ndiActive ? 'var(--primary)' : 'var(--muted-foreground)' }}
          />
          {ndiActive ? `NDI · ${connections} Empfänger` : 'NDI aus'}
        </span>
      </header>

      <div className="flex-1 min-h-0 flex">
```
Nachher:
```tsx
  // Weiter/Zurück: gesperrt nur an den Rändern; ohne aktiven Eintrag beide frei (Spec 7.4).
  const nav = navGesperrt(activeEntry, entries.length);
  // Ein Stand für Statusleiste und Panel (lib/oberflaeche.ts, Spec 6.1): beide zeigen dieselbe Ableitung.
  const stand: OberflaechenStand = { config, status: state.status, displays, masterLink };
  // window.jmtitler nur in den Rückrufen, nie beim Rendern (G7).
  const aktionen: TitlerAktionen = {
    setConfig: (patch) => void setConfig(patch),
    startNdi: (name) => void startNdi(name),
    stopNdi: () => void stopNdi(),
    pickFolder: () => void pickFolder(),
    zurueckZumEigenenOrdner: () => void window.jmtitler.zurueckZumEigenenOrdner(),
  };

  return (
    <AppShell
      tool="Titler"
      headerCenter={<VerbundZeile anzeige={verbund} />}
      onAir={{ live }}
      status={statusLeiste(stand)}
      settings={<Einstellungen stand={stand} aktionen={aktionen} />}
      settingsOpen={panelOffen}
      settingsSection={panelAbschnitt}
      onSettingsChange={(offen, abschnitt) => {
        setPanelOffen(offen);
        setPanelAbschnitt(abschnitt);
      }}
    >
      <div className="flex h-full min-h-0">
```
Vorher:
```tsx
        {/* Steuerpult (#165): Live-Steuerung und Einstellungen in Reitern getrennt;
            das Namensfeld bleibt im Reiter „Steuerung" oben immer sichtbar, der Rest
            ist ausklappbar bzw. in „Einstellungen" gebündelt. */}
        <div className="w-[400px] shrink-0 overflow-auto border-l border-[var(--border)]/60">
          <div className="p-5 space-y-4">
            <Tabs items={TABS} value={tab} onChange={setTab} />

            {tab === 'steuerung' ? (
```
Nachher:
```tsx
        {/* Steuerpult (#165): die Bedienung; die Einstellungen stehen im Panel (⚙ oder Statuseintrag, E14). */}
        <div className="w-[400px] shrink-0 overflow-auto border-l border-[var(--border)]/60">
          <div className="p-5 space-y-4">
```
Vorher:
```tsx
              </div>
            ) : (
              <div className="space-y-5">
                {/* DataLink (#86): Datenquelle konfigurieren (Abruf im Reiter „Steuerung"). */}
                <SettingsSection
                  title="DataLink"
                  description={
                    <>
                      Platzhalter <code className="text-[var(--primary)]">{'{{name}}'}</code> in den Textfeldern
                      werden aus den Dateien im Ordner gefüllt. CSV mit Kopfzeile = Liste (je Zeile ein Eintrag,
                      im Reiter <b>Steuerung</b> abrufbar); <code>schlüssel=wert</code>-Datei = ein Eintrag.
                    </>
                  }
                >
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
                      <Button variant="ghost" size="sm" uppercase={false} onClick={() => void setConfig({ dataFolder: '' })} title="Watchfolder entfernen">
                        ✕
                      </Button>
                    ) : null}
                  </div>
                  {ordnerGesperrt ? (
                    <p className="text-[11px] text-[var(--muted-foreground)]">{ordnerGesperrt}</p>
                  ) : null}
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
                <SettingsSection title="iveo">
                  {iveoActive ? (
                    <div className="rounded-[var(--radius)] border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-3 py-2.5 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--primary)' }} />
                        <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--primary)]">
                          iveo aktiv
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        {entries.length} Speaker aus der geöffneten JM Show im DataLink. Aktualisiert sich live nach
                        iveo-Änderungen (verwaltet vom Launcher). Abruf im Reiter <b>Steuerung › Daten / Recall</b>.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[var(--muted-foreground)]">
                      Kein iveo-Event aktiv. iveo-Speaker werden automatisch zu Bauchbinden-Variablen, sobald der
                      Titler über eine <b>JM Show</b> mit iveo-Daten geöffnet wird — Verwaltung und Zugriffstoken
                      bleiben im Launcher (der Titler speichert kein Token).
                    </p>
                  )}
                </SettingsSection>

                {/* Ausgabe (NDI) */}
                <SettingsSection title="Ausgabe (NDI)">
                  <Field label="Quellname" value={c.ndiName} onChange={(v) => void setConfig({ ndiName: v })} />
                  <div className="flex gap-2">
                    <Labeled label="Auflösung">
                      <select
                        value={`${c.width}x${c.height}`}
                        onChange={(e) => {
                          const r = RESOLUTIONS.find((x) => `${x.w}x${x.h}` === e.target.value);
                          if (r) void setConfig({ width: r.w, height: r.h });
                        }}
                        className="h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2 text-sm font-semibold"
                      >
                        {RESOLUTIONS.map((r) => (
                          <option key={r.label} value={`${r.w}x${r.h}`}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </Labeled>
                    <Labeled label="fps">
                      <select
                        value={String(c.fps)}
                        onChange={(e) => void setConfig({ fps: Number(e.target.value) })}
                        className="h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2 text-sm font-semibold tabular"
                      >
                        {FPS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </Labeled>
                  </div>
                  {ndiActive ? (
                    <Button variant="destructive" className="w-full" onClick={() => void stopNdi()}>
                      NDI stoppen
                    </Button>
                  ) : (
                    <Button variant="primary" className="w-full" onClick={() => void startNdi(c.ndiName)}>
                      NDI starten
                    </Button>
                  )}
                  {c.width % 2 !== 0 || c.height % 2 !== 0 ? (
                    <p className="text-[11px] text-[var(--destructive)]">Auflösung sollte gerade sein.</p>
                  ) : null}
                </SettingsSection>

                {/* Ausgabe (2. Bildschirm, #161) */}
                <SettingsSection
                  title="Ausgabe (2. Bildschirm)"
                  description="Zeigt die Bauchbinde als Vollbild auf einem zweiten Monitor mit Chroma-Green-Hintergrund — für externe Keyer (vMix/ATEM/TriCaster) ohne NDI."
                >
                  <Labeled label="Monitor">
                    <select
                      value={String(c.secondScreenDisplay)}
                      onChange={(e) => void setConfig({ secondScreenDisplay: Number(e.target.value) })}
                      className="h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2 text-sm font-semibold"
                    >
                      <option value="0">Primär (automatisch)</option>
                      {displays.map((d) => (
                        <option key={d.id} value={String(d.id)}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </Labeled>
                  <div className="flex gap-3 items-end">
                    <ColorField label="Chroma" value={c.chromaColor} onChange={(v) => void setConfig({ chromaColor: v })} />
                    <button
                      onClick={() => void setConfig({ chromaColor: '#00B140' })}
                      className="h-9 shrink-0 rounded-[var(--radius)] border border-[var(--border)] px-3 text-xs hover:bg-[var(--highlight)]"
                      title="Standard-Green (#00B140) zurücksetzen"
                    >
                      Reset
                    </button>
                  </div>
                  {c.secondScreenEnabled ? (
                    <Button variant="destructive" className="w-full" onClick={() => void setConfig({ secondScreenEnabled: false })}>
                      2. Bildschirm ausschalten
                    </Button>
                  ) : (
                    <Button variant="primary" className="w-full" onClick={() => void setConfig({ secondScreenEnabled: true })}>
                      2. Bildschirm einschalten
                    </Button>
                  )}
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    Tipp: Zweitmonitor wählen, damit die Ausgabe nicht die Operator-Oberfläche verdeckt.
                  </p>
                </SettingsSection>
              </div>
            )}
```
Nachher:
```tsx
              </div>
```
Vorher:
```tsx
      ) : null}
    </div>
```
Nachher:
```tsx
      ) : null}
    </AppShell>
```
Vorher:
```tsx

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}): React.JSX.Element {
  return (
    <label className="block">
      <div className="text-sm font-semibold mb-1">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
      />
    </label>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label className="block flex-1">
      <div className="text-sm font-semibold mb-1">{label}</div>
      {children}
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}): React.JSX.Element {
  return (
    <label className="flex-1">
      <div className="text-[11px] font-semibold mb-1 text-[var(--muted-foreground)]">{label}</div>
      <div className="flex items-center gap-2 h-9 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-7 rounded cursor-pointer bg-transparent border-0 p-0"
        />
        <span className="text-[11px] tabular text-[var(--muted-foreground)] uppercase">{value}</span>
      </div>
    </label>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}): React.JSX.Element {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between text-sm mb-1">
        <span className="font-semibold">{label}</span>
        <span className="tabular text-[var(--muted-foreground)]">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
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
Nachher:
```tsx

```

- [ ] **Step 10: Test laufen lassen (grün)**

```
npm run selftest -w @jm/titler; echo "Exit=$?"
(cd apps/titler && npx tsx test/selftest.ts) 2>&1 | grep -cE "^\s*ok\b"
(cd apps/titler && npx tsx --tsconfig tsconfig.test.json test/ui/selftest.ts) > <eigener Scratchpad>/c9-ui.txt 2>&1; echo "Exit=$?"
grep -c "^ok " <eigener Scratchpad>/c9-ui.txt
grep -A30 "^ok   Rahmen: Der Testlauf hat kein window" <eigener Scratchpad>/c9-ui.txt
```
Erwartet (gemessen): `Exit=0`, alter Lauf 538, Oberflächen-Lauf `Exit=0` mit **76** `ok` (= 52 + 24), am Ende
„ALLE TESTS OK“. Die 24 neuen Zeilen:
```
ok   Rahmen: Der Testlauf hat kein window (wie der Server-Render)
ok   Brücken ohne window: Abfrage null, Ereignis gibt eine Abmeldung und meldet nichts (G7)
ok   Brücken mit Preload: MASTER_LINK_QUELLE nimmt masterLink/onMasterLink, VERBUND_QUELLE verbundAnzeige/onVerbundAnzeige
ok   VerbundZeile: gruen/gelb/rot/gedaempft → StatusPill ok/warn/error/off mit Text und Tooltip (E18)
ok   VerbundZeile: ohne V-Zeile (Einzelplatz, Brücke offen) nichts
ok   VerbundZeile: keine Statusfarbe auf Wörtern, kein Gelb --warning (Spec 4.2); die Hülle schneidet ab (overflow-hidden)
ok   VerbundZeile: kürzt mit „…“ (truncate am Text, Pille höchstens so breit wie ihr Platz), der volle Text steht im Tooltip (2b-Spec 16.5, G4)
ok   Rahmen: AppShell mit „JM Titler“, ohne alte Kopfzeile (kein „Live-CG → NDI“, E18)
ok   Kopfzeile rechts: Hell/Dunkel (E15) und ⚙ „Einstellungen öffnen“
ok   Rahmen beim Start: ON AIR zeigt „bereit“ (E11), Panel zu (E14), keine Reiter mehr
ok   Statusleiste im Rahmen: Reihenfolge E20; ohne Brücke, Monitorliste und Steuerserver-Meldung „unbekannt“, nie ok (Spec 7.2)
ok   Rahmen: die alte Pille „Suite …“ ist weg (ersetzt durch Statusleiste › Fernsteuerung)
ok   Rahmen: die alte Pille „NDI · …“ ist weg (ersetzt durch Statusleiste › NDI)
ok   Rahmen: das erste <canvas> ist die CG-Vorschau 960×540 (R2-Durchgang)
ok   Rahmen: id-Verweise im Bedienfenster gültig
ok   Rahmen: ohne Zustand weiter „Lädt…“ (Nr. 1 unverändert)
ok   Panel-Inhalt: DataLink, iveo und K1 rendern ohne window; Rendern löst keine Aktion aus
ok   Panel-Inhalt: views/Einstellungen.tsx ohne window und ohne useEffect (G7, G8)
ok   Quelltext OperatorView: Brücken, Kopfmitte, Statusleiste, Monitorliste offen (auch nach einem Ladefehler, E8); die Effekte bleiben hier (G8)
ok   Quelltext OperatorView: ON AIR folgt nur der Engine-Größe live (E11; der Server-Render kennt nur live = false)
ok   Quelltext OperatorView: ⚙ und Statuseintrag öffnen das Panel am Abschnitt, die Aktionen des Panels gehen an Store und Preload (Review Focus 2)
ok   Quelltext OperatorView: kein Reiter, kein localStorage, keine alte Kopfzeile (E14, E18)
ok   Quelltext lib/bruecken.ts: window.jmtitler genau einmal, hinter dem typeof-Wächter (E5)
ok   Quelltext Preload: verbundAnzeige und onVerbundAnzeige (R2-Durchgang, G4) sowie masterLink und onMasterLink (S-A4) stehen da
ALLE TESTS OK
```

- [ ] **Step 11: Typprüfung**

```
npm run typecheck -w @jm/titler; echo "Exit=$?"
npm run typecheck -w @jm/ui; echo "Exit=$?"
```
Erwartet (gemessen): drei `tsc`-Läufe (`typecheck:node`, `typecheck:web`, `typecheck:test`) ohne Meldung, `Exit=0`; danach
`@jm/ui` (G10, wegen `StatusPill`) ohne Meldung, `Exit=0`. Die zwei Läufe nacheinander, nie gleichzeitig.

- [ ] **Step 12: Bau und Klassen-Probe**

```
npm run build -w @jm/titler; echo "Exit=$?"
(cd packages/ui && npx tsx galerie/pruefe-klassen.ts --css ../../apps/titler/out/renderer/assets) | grep -cE "^ok"
```
Erwartet (gemessen): Bau `Exit=0`; Klassen-Probe `20` (Review Focus 5 bleibt grün). Die Größe des Renderer-CSS ändert sich
um wenige Hundert Byte (in der Nachbesserung gemessen: 50,81 kB) und ist keine Erwartung.

- [ ] **Step 13: Gegenproben** (je eine Ersetzung allein mit dem Edit-Werkzeug, Oberflächen-Lauf, danach zurück; nicht committen)

Lauf je Probe:
```
(cd apps/titler && npx tsx --tsconfig tsconfig.test.json test/ui/selftest.ts) 2>&1 | grep -E "^FAIL|^     |FEHLGESCHLAGEN"; echo "Exit=${PIPESTATUS[0]}"
```
a) `headerCenter` weggelassen:
Datei `apps/titler/src/renderer/src/views/OperatorView.tsx`, Probe:
```tsx
      headerCenter={<VerbundZeile anzeige={verbund} />}
```
wird zu:
```tsx
(Zeile entfernt)
```
Erwartet (gemessen):
```
Exit=1
FAIL Quelltext OperatorView: Brücken, Kopfmitte, Statusleiste, Monitorliste offen (auch nach einem Ladefehler, E8); die Effekte bleiben hier (G8)
     fehlt: headerCenter={<VerbundZeile anzeige={verbund} />}
1 FEHLGESCHLAGEN
```
b) Statusleiste aus der alten Pill-Logik (`suiteClients > 0`):
Datei `apps/titler/src/renderer/src/views/OperatorView.tsx`, Probe:
```tsx
      status={statusLeiste(stand)}
```
wird zu:
```tsx
      status={[{ id: 'fernsteuerung', group: 'fernsteuerung', label: 'Suite', state: state.status.suiteClients > 0 ? 'ok' : 'off' }]}
```
Erwartet (gemessen):
```
Exit=1
FAIL Statusleiste im Rahmen: Reihenfolge E20; ohne Brücke, Monitorliste und Steuerserver-Meldung „unbekannt“, nie ok (Spec 7.2)
     ist: [["fernsteuerung","off",null]] soll: [["master-link","off","Master: unbekannt"],["iveo","off","iveo: nicht eingerichtet"],["ndi","off","NDI: aus"],["bildschirm","off","Bildschirm: unbekannt"],["fernsteuerung","off","Fernsteuerung: unbekannt"],["datalink","off","DataLink: kein Ordner"]]
FAIL Quelltext OperatorView: Brücken, Kopfmitte, Statusleiste, Monitorliste offen (auch nach einem Ladefehler, E8); die Effekte bleiben hier (G8)
     fehlt: status={statusLeiste(stand)}
FAIL Quelltext OperatorView: kein Reiter, kein localStorage, keine alte Kopfzeile (E14, E18)
     gefunden: suiteClients
3 FEHLGESCHLAGEN
```
c) Ein `<canvas>` vor der Vorschau:
Datei `apps/titler/src/renderer/src/views/OperatorView.tsx`, Probe:
```tsx
      <div className="flex h-full min-h-0">
```
wird zu:
```tsx
      <canvas width={1} height={1} />
      <div className="flex h-full min-h-0">
```
Erwartet (gemessen):
```
Exit=1
FAIL Rahmen: das erste <canvas> ist die CG-Vorschau 960×540 (R2-Durchgang)
     ist: ["1","1"] soll: ["960","540"]
1 FEHLGESCHLAGEN
```
d) `window` ohne `typeof`-Wächter in `lib/bruecken.ts` (ohne `window` wirft das einen `ReferenceError`):
Datei `apps/titler/src/renderer/src/lib/bruecken.ts`, Probe:
```ts
  return typeof window === 'undefined' ? undefined : window.jmtitler;
```
wird zu:
```ts
  return window.jmtitler;
```
Erwartet (gemessen):
```
Exit=1
FAIL Brücken ohne window: Abfrage null, Ereignis gibt eine Abmeldung und meldet nichts (G7)
     ist: "ReferenceError: window is not defined" soll: [[null,null],["function","function"],0]
FAIL Quelltext lib/bruecken.ts: window.jmtitler genau einmal, hinter dem typeof-Wächter (E5)
2 FEHLGESCHLAGEN
```
e) Panel beim Start offen (E14):
Datei `apps/titler/src/renderer/src/views/OperatorView.tsx`, Probe:
```tsx
  const [panelOffen, setPanelOffen] = useState(false);
```
wird zu:
```tsx
  const [panelOffen, setPanelOffen] = useState(true);
```
Erwartet (gemessen):
```
Exit=1
FAIL Kopfzeile rechts: Hell/Dunkel (E15) und ⚙ „Einstellungen öffnen“
     ist: ["Darstellung: Dunkel. Umschalten auf Hell","Einstellungen schließen","true"] soll: ["Darstellung: Dunkel. Umschalten auf Hell","Einstellungen öffnen","false"]
FAIL Rahmen beim Start: ON AIR zeigt „bereit“ (E11), Panel zu (E14), keine Reiter mehr
2 FEHLGESCHLAGEN
```
f) bis l) Verdrahtung, die der Server-Render nicht zeigen kann (ON AIR mit `live = true`, Klick auf ⚙, auf einen
Statuseintrag oder einen Knopf im Panel, eine abgelehnte Monitorliste). Je eine Zeile allein in
`apps/titler/src/renderer/src/views/OperatorView.tsx` ersetzen:

| Probe | Zeile vorher | wird zu | `fehlt:` |
| --- | --- | --- | --- |
| f) ON AIR tot | `      onAir={{ live }}` | `      onAir={{ live: false }}` | `onAir={{ live }}` |
| g) ⚙ öffnet nie | `        setPanelOffen(offen);` | `        setPanelOffen(false);` | `setPanelOffen(offen);` |
| h) Statuseintrag ohne Abschnitt | `        setPanelAbschnitt(abschnitt);` | `        setPanelAbschnitt(undefined);` | `setPanelAbschnitt(abschnitt);` |
| i) Ordnerwahl tot | `    pickFolder: () => void pickFolder(),` | `    pickFolder: () => undefined,` | `pickFolder: () => void pickFolder(),` |
| j) NDI ohne Namen | `    startNdi: (name) => void startNdi(name),` | `    startNdi: () => void startNdi(''),` | `startNdi: (name) => void startNdi(name),` |
| k) K1 tot | `    zurueckZumEigenenOrdner: () => void window.jmtitler.zurueckZumEigenenOrdner(),` | `    zurueckZumEigenenOrdner: () => undefined,` | `zurueckZumEigenenOrdner: () => void window.jmtitler.zurueckZumEigenenOrdner(),` |
| l) Ladefehler als leere Liste | `.then(setDisplays, () => setDisplays(undefined))` | `.then(setDisplays, () => setDisplays([]))` | `.then(setDisplays, () => setDisplays(undefined))` |

Erwartet (gemessen) je Probe: `Exit=1`, genau eine `FAIL`-Zeile, darunter `     fehlt: ` mit dem Text der letzten Spalte,
dann `1 FEHLGESCHLAGEN`. Die `FAIL`-Zeile ist
- bei f) `FAIL Quelltext OperatorView: ON AIR folgt nur der Engine-Größe live (E11; der Server-Render kennt nur live = false)`;
- bei g) bis k) `FAIL Quelltext OperatorView: ⚙ und Statuseintrag öffnen das Panel am Abschnitt, die Aktionen des Panels gehen an Store und Preload (Review Focus 2)`;
- bei l) `FAIL Quelltext OperatorView: Brücken, Kopfmitte, Statusleiste, Monitorliste offen (auch nach einem Ladefehler, E8); die Effekte bleiben hier (G8)`.

m) Kürzung der V-Zeile weggelassen (E18):
Datei `apps/titler/src/renderer/src/views/KopfMitte.tsx`, Probe:
```tsx
      <StatusPill state={verbundZeileZustand(anzeige.farbe)} text={anzeige.text} title={anzeige.text} kuerzen />
```
wird zu:
```tsx
      <StatusPill state={verbundZeileZustand(anzeige.farbe)} text={anzeige.text} title={anzeige.text} />
```
Erwartet (gemessen):
```
Exit=1
FAIL VerbundZeile: kürzt mit „…“ (truncate am Text, Pille höchstens so breit wie ihr Platz), der volle Text steht im Tooltip (2b-Spec 16.5, G4)
1 FEHLGESCHLAGEN
```
n) `StatusPill` ohne eigenes `span` für den Text (im `@jm/ui`-Lauf
`npm run selftest -w @jm/ui 2>&1 | grep -E "^FAIL|^     |FEHLGESCHLAGEN"; echo "Exit=${PIPESTATUS[0]}"`):
Datei `packages/ui/src/components/StatusPill.tsx`, Probe:
```tsx
      {kuerzen ? <span className="min-w-0 truncate">{text}</span> : text}
```
wird zu:
```tsx
      {text}
```
Erwartet (gemessen):
```
Exit=1
FAIL StatusPill kuerzen: Text mit „…“ gekürzt (truncate), Pille höchstens so breit wie ihr Platz, voller Text im title; ohne kuerzen unverändert
1 FEHLGESCHLAGEN
```
Nach jeder Probe zurückbauen (Nachher → Vorher); danach zeigt `git diff --stat` nur die Dateien dieser Aufgabe.

- [ ] **Step 14: Zeilenenden prüfen**

```
node -e "for (const f of process.argv.slice(1)) { const t = require('fs').readFileSync(f, 'utf8'); const n = (t.match(/\n/g) || []).length, c = (t.match(/\r\n/g) || []).length; console.log(f, n, c, c === 0 || c === n ? 'einheitlich' : 'GEMISCHT'); }" apps/titler/src/renderer/src/views/OperatorView.tsx apps/titler/src/renderer/src/lib/bruecken.ts apps/titler/src/renderer/src/views/KopfMitte.tsx apps/titler/src/renderer/src/views/felder.tsx apps/titler/src/renderer/src/views/Einstellungen.tsx apps/titler/test/ui/testzustand.ts apps/titler/test/ui/rahmen.test.tsx apps/titler/test/ui/selftest.ts packages/ui/src/components/StatusPill.tsx packages/ui/test/statusbar.test.tsx
```
Erwartet (gemessen):
```
apps/titler/src/renderer/src/views/OperatorView.tsx 578 578 einheitlich
apps/titler/src/renderer/src/lib/bruecken.ts 24 0 einheitlich
apps/titler/src/renderer/src/views/KopfMitte.tsx 17 0 einheitlich
apps/titler/src/renderer/src/views/felder.tsx 92 0 einheitlich
apps/titler/src/renderer/src/views/Einstellungen.tsx 194 0 einheitlich
apps/titler/test/ui/testzustand.ts 142 0 einheitlich
apps/titler/test/ui/rahmen.test.tsx 230 0 einheitlich
apps/titler/test/ui/selftest.ts 9 0 einheitlich
packages/ui/src/components/StatusPill.tsx 49 49 einheitlich
packages/ui/test/statusbar.test.tsx 268 268 einheitlich
```

- [ ] **Step 15: Commit**

```
git add apps/titler/src/renderer/src/lib/bruecken.ts apps/titler/src/renderer/src/views/Einstellungen.tsx apps/titler/src/renderer/src/views/KopfMitte.tsx apps/titler/src/renderer/src/views/OperatorView.tsx apps/titler/src/renderer/src/views/felder.tsx apps/titler/test/ui/rahmen.test.tsx apps/titler/test/ui/selftest.ts apps/titler/test/ui/testzustand.ts packages/ui/src/components/StatusPill.tsx packages/ui/test/statusbar.test.tsx
git status --short
```
Erwartet:
```
A  apps/titler/src/renderer/src/lib/bruecken.ts
A  apps/titler/src/renderer/src/views/Einstellungen.tsx
A  apps/titler/src/renderer/src/views/KopfMitte.tsx
M  apps/titler/src/renderer/src/views/OperatorView.tsx
A  apps/titler/src/renderer/src/views/felder.tsx
A  apps/titler/test/ui/rahmen.test.tsx
M  apps/titler/test/ui/selftest.ts
A  apps/titler/test/ui/testzustand.ts
M  packages/ui/src/components/StatusPill.tsx
M  packages/ui/test/statusbar.test.tsx
```
Dann:
```
git commit -m "feat(titler): Rahmen im AppShell - Kopfzeile mit V-Zeile, Statusleiste, Einstellungs-Panel" -m "UX-Pilot C9 (Spec 3.1-3.3, 3.9, 5.1, 7, 8): OperatorView rendert AppShell mit JM Titler, der R2-Zeile als StatusPill in der Kopfmitte, ON AIR, Hell/Dunkel und Zahnrad; die Statusleiste kommt aus statusLeiste (lib/oberflaeche.ts), das Panel zeigt vorerst den Inhalt des alten Reiters Einstellungen. Die V-Zeile kuerzt mit Auslassungszeichen ueber die neue, optionale StatusPill-Prop kuerzen (@jm/ui, additiv). Lesende Bruecken MASTER_LINK_QUELLE und VERBUND_QUELLE als modulweite Konstanten mit typeof-window-Waechter. Weg sind die alte Kopfzeile mit beiden Pillen, die Reiter samt titler.operator.tab, VerbundAbzeichen und VERBUND_FARBE. Effekte bleiben in OperatorView (G8); die CG-Vorschau bleibt das erste canvas. Render-Tests ohne Browser, Quelltext-Waechter fuer ON AIR, Panel, Aktionen und Monitorliste, Gegenproben a-n." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- `views/felder.tsx` entsteht schon in C9 statt in C11: Der alte Reiter-Inhalt in `Einstellungen.tsx` braucht `Field`,
  `Labeled` und `ColorField`, die bis C9 lokal in `OperatorView.tsx` stehen; ein Import aus `OperatorView.tsx` wäre ein
  Kreisimport. C11 nimmt `Field` und `Labeled` wieder heraus. Nr. 16, 40 und 41 der Funktionsliste (Task 13) nennen
  `views/felder.tsx`.
- Neue Testhilfe `apps/titler/test/ui/testzustand.ts` (nicht im Gerüst): Fixtures, Store-Render über `getInitialState()`
  und HTML-Lesehilfen, die C10–C12 mitnutzen. `VORLAGEN`, `MONITORE` und `bereich` stehen schon hier, damit spätere Aufgaben
  die Datei nicht mehr ändern.
- `listDisplays()` bekommt einen Ablehnungs-Zweig (`() => setDisplays(undefined)`); vorher war die Ablehnung unbehandelt.
- Gegenprobe e) (Panel beim Start offen) ist zusätzlich.
- Nachbesserung nach der Plan-Prüfung (Befunde robust:2, robust:3, robust:5, spec:7):
  - drei Quelltext-Wächter für das, was der Server-Render nicht zeigen kann (ON AIR aus `live`, Panel über ⚙ und
    Statuseintrag samt den fünf Aktionen, Ablehnungs-Zweig der Monitorliste), mit den Gegenproben f) bis l);
  - die V-Zeile kürzt mit „…“ statt hart abzuschneiden (E18). Dafür ändert C9 `@jm/ui` additiv (`StatusPill` mit
    `kuerzen`, eine Prüfung in `statusbar.test.tsx`, Step 5) und G1 nennt die Datei; Gegenproben m) und n).
- Zählstände (in der Nachbesserung gemessen): Oberflächen-Lauf 76 `ok` (52 aus Task 8 + 24), alter Lauf 538, `@jm/ui` 680;
  ebenso die Rot-Meldungen, die Gegenproben a–n und die Zeilenenden.

---
### Task 10: C10 · Live-Bereich und Bedienung

**Spec:** 3.4 (TallyButton), 5.1 (Live-Bereich mit höchstens vier Haupttasten, Nebenbereiche als `Collapsible` mit
`persistId`), Anhang A „Titler“ („Immer sichtbar“, „Haupttasten“, „Kürzel: keine“), UO5 (keine neuen Kürzel), 10 (kein
Funktionsverlust). Entscheidungen E12 (Haupttasten), E13 (Bedienung und Panel nach Anhang A; Kacheln als `<button>`), E21
(„Daten / Recall“ bei `dataError` mit noch geltender Liste), E23 (Eingaben aus `@jm/ui`). Texte T3–T7 (OF8). Global
Constraints G1, G4, G5, G7, G8, G9, G10, G11, G12. Review Focus 2.

**Voraussetzung:** Plan-Worktree nach C9: `npm run selftest -w @jm/titler` grün (Oberflächen-Lauf 76 `ok`),
`npm run selftest -w @jm/ui` grün (680 `ok`).

**Dateien:**
- Create: `apps/titler/src/renderer/src/views/LiveBereich.tsx` (`LiveBereich`, Prop-Bauer `liveTasten`)
- Create: `apps/titler/src/renderer/src/views/Bedienung.tsx` (Vorlage, Inhalt, Grafik-Vorlagen, Daten / Recall)
- Modify: `apps/titler/src/renderer/src/views/Einstellungen.tsx` (Props in der Register-Form; dahinter die tool-eigenen
  Abschnitte „Stil“ und „Grafik-Vorlagen“, die aus der Bedienung ins Panel ziehen)
- Modify: `apps/titler/src/renderer/src/views/OperatorView.tsx` (Inhalt = `LiveBereich` + `Bedienung`; `take`, `clear` und
  `stepEntry` unverändert verdrahtet, Kacheln über `selectTemplate`, Import und Löschen ans Panel)
- Create: `apps/titler/test/ui/live.test.tsx`
- Modify: `apps/titler/test/ui/rahmen.test.tsx` (`Einstellungen` mit den neuen Props) und `apps/titler/test/ui/selftest.ts`

**Interfaces:**
- Consumes: S-B4 `hauptTasten(live, activeEntry, anzahl)`, `TITLER_TEXTE` (`take`, `clear`, `zurueck`, `weiter`,
  `ersterEintrag`, `letzterEintrag`, `hinweisNdiAn`, `hinweisNdiAus`, `keinOrdner`, `keineGrafik`, `keineVorlagen`, `stil`,
  `vorlagen`, `loeschen`, `loeschenAria`), `ABSCHNITT.stil`, `ABSCHNITT.vorlagen`; aus `@jm/ui` `TallyButton`,
  `TallyButtonProps`, `Field`, `TextInput`, `Collapsible`, `SettingsSection`, `PanelAnker`; C9 `testzustand.ts`.
- Produces (Register S-C, exakt):
  ```ts
  // apps/titler/src/renderer/src/views/LiveBereich.tsx  (Behälter data-titler="live", Vorschau zuerst, Tasten in data-titler="haupttasten", Zeile data-titler="hinweiszeile")
  export interface LiveBereichProps { previewRef: RefObject<HTMLCanvasElement>; live: boolean; ndiActive: boolean; activeEntry: number; anzahl: number; onTake(): void; onClear(): void; onSchritt(delta: -1 | 1): void }
  export function LiveBereich(p: LiveBereichProps): React.JSX.Element;
  export function liveTasten(p: LiveBereichProps): TallyButtonProps[];   // 2 oder 4 Einträge; LiveBereich rendert genau diese
  // apps/titler/src/renderer/src/views/Bedienung.tsx  (data-titler="bedienung")
  export interface BedienungProps { config: TitlerConfig; status: TitlerStatus; templates: GraphicTemplate[]; setConfig(patch: PartialTitlerConfig): void; onSelectTemplate(t: GraphicTemplate): void; onOpenBoard(): void; onRecall(key: string): void }
  export function Bedienung(p: BedienungProps): React.JSX.Element;
  // apps/titler/src/renderer/src/views/Einstellungen.tsx  (Register-Form ab hier; C11 baut den Inhalt neu)
  export interface EinstellungenProps { stand: OberflaechenStand; aktionen: TitlerAktionen; templates: GraphicTemplate[]; activeGraphicId: string; onPickImport(): void; onDropImport(e: React.DragEvent): void; onDeleteTemplate(t: GraphicTemplate): void }
  export function Einstellungen(p: EinstellungenProps): React.JSX.Element;
  ```
  `LiveBereichProps` ist `Parameters<typeof LiveBereich>[0]` aus dem Register, nur benannt.

**Verhalten (verbindlich):**
- Live-Bereich (immer sichtbar): zuerst die CG-Vorschau (`.cg-checker` mit `<canvas>` 960×540, das erste `<canvas>` im
  Fenster), darunter `data-titler="haupttasten"` mit genau den `TallyButton`s aus `liveTasten`, darunter die Hinweiszeile
  `data-titler="hinweiszeile"`: bei NDI an `TITLER_TEXTE.hinweisNdiAn` (Text von heute, Nr. 9), sonst `hinweisNdiAus` (T4).
- Haupttasten (E12): „Take“ (`live` bei On-Air, sonst `bereit`, nie gesperrt) → `take`; „Clear“ (`bereit`) → `clear`; nur
  mit mindestens einem Eintrag „◀ Eintrag“ → `stepEntry(-1)` und „Eintrag ▶“ → `stepEntry(1)`, an den Rändern gesperrt mit
  „Erster Eintrag“ bzw. „Letzter Eintrag“ (wie `navGesperrt`); ohne aktiven Eintrag beide frei. Kein `shortcut`, kein Halten
  (UO5). ‹ und › in „Daten / Recall“ entfallen.
- Bedienung (rechts, 400 px wie bisher): „Vorlage“ und „Inhalt“ als `SettingsSection`, immer offen; „Grafik-Vorlagen“
  (`Collapsible`, `persistId="titler.graphics"`, Start zu) nur mit den Kacheln zum Wählen – jede Kachel ist ein
  `<button type="button" aria-pressed>` (E13, per Tab erreichbar); „Daten / Recall“ (`persistId="titler.recall"`, Start
  offen) mit Quellzeile, Hinweis, „⧉ Board“, Zähler, Liste, Variablen und „Im Text verwendet“ wie bisher. Der aktive
  Eintrag der Liste trägt zusätzlich `aria-current="true"` (bisher nur Farbe und Fettung). Der Hinweis-Kasten H1–H7 wird
  orange (`--status-warn` statt Gelb `--warning`, Spec 4.2, E25).
- Abgesichert sind auch die Zweige, die der Bauchbinden-Fall nicht zeigt: Banner (Feld „Banner-Text“), Ticker (Feld
  „Ticker-Text“, Schieber „Ticker-Tempo“ 0,02–0,3 in 0,01), Grafik-Vorlage ohne Textfelder (Text von heute, Nr. 18) und
  „Daten / Recall“ ohne Variablen (Hilfetext von heute, Nr. 36). Im Quelltext von `OperatorView` hängt das Take-Tally an
  `live={live}` (E11; ohne Browser ist `live` immer false).
- Inhalt (E23): Name, Untertitel, Banner-Text, Ticker-Text und die Slot-Felder sind `Field` + `TextInput` aus `@jm/ui`;
  jeder Tastendruck geht wie bisher an `setConfig`, je Feld mit seinem Schlüssel (`name`, `subtitle`, `bannerText`,
  `tickerText`, `slotText`). „Ticker-Tempo“ bleibt der lokale `Slider` (`tickerSpeed`).
- E21: Bei `dataError` steht „DataLink: {Fehler}“ oben; Zähler, „⧉ Board“, Liste (und die Eintrag-Tasten im Live-Bereich)
  bleiben, solange es Einträge gibt; die Variablen-Box entfällt bei Fehler wie bisher.
- Texte: Nr. 29 wird `TITLER_TEXTE.keinOrdner` (T5), Nr. 19 `keineGrafik` (T6a), Nr. 25 `keineVorlagen` (T6b). In
  `OperatorView.tsx`, `Bedienung.tsx` und `LiveBereich.tsx` kein „Reiter“ und kein „rechts starten“ mehr (Befund 16).
- Panel: Hinter dem alten Inhalt stehen jetzt „Stil“ (`PanelAnker id="stil"`, Lage, Größe, drei Farben; das
  `Collapsible` mit `titler.style` entfällt, E14) und „Grafik-Vorlagen“ (`PanelAnker id="vorlagen"`, Beschreibung Nr. 20,
  „Datei importieren…“, Ablagefläche, je Vorlage ein sichtbarer Knopf „Löschen“ mit `aria-label` „Vorlage „{Name}“
  löschen“, ohne Rückfrage wie heute). Import-Handler und Dialog-Zustand bleiben in `OperatorView` (G8).
- `Bedienung.tsx`, `LiveBereich.tsx` und `Einstellungen.tsx` lesen kein `window` und haben keine Effekte; die Rückrufe
  (`stepEntry`, `openRecall`, `recallSchluessel`, `pickImport`, `onDropImport`, `deleteTemplate`) setzt `OperatorView`.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (Neue Datei `apps/titler/test/ui/live.test.tsx`)

```tsx
// UX-Pilot C10 · Live-Bereich und Bedienung (Spec 3.4, 5.1, Anhang A „Titler“; E12, E13, E21, E23): Vorschau und
// höchstens vier Haupttasten immer sichtbar, daneben Vorlage, Inhalt, Grafik-Vorlagen und Daten / Recall. Stil, Import und
// Löschen ziehen ins Panel. Render ohne Browser; die gemerkten Collapsibles über einen nachgestellten localStorage.
import { createRef, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Field, TextInput } from '@jm/ui';
import { enthaelt, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import type { GraphicTemplate, TitlerConfig } from '@shared/types';
import { TITLER_TEXTE } from '@/lib/oberflaeche';
import { Bedienung, type BedienungProps } from '@/views/Bedienung';
import { Einstellungen } from '@/views/Einstellungen';
import { Slider } from '@/views/felder';
import { LiveBereich, liveTasten, type LiveBereichProps } from '@/views/LiveBereich';
import { attr, basisConfig, basisStand, basisStatus, bereich, ohneKommentare, protokollAktionen, tags, text, VORLAGEN } from './testzustand';

const nichts = (): void => undefined;
function live(z: Partial<LiveBereichProps> = {}): LiveBereichProps {
  return {
    previewRef: createRef<HTMLCanvasElement>(),
    live: false,
    ndiActive: false,
    activeEntry: -1,
    anzahl: 0,
    onTake: nichts,
    onClear: nichts,
    onSchritt: nichts,
    ...z,
  };
}
function bedienung(z: Partial<BedienungProps> = {}): BedienungProps {
  return {
    config: basisConfig(),
    status: basisStatus(),
    templates: [],
    setConfig: nichts,
    onSelectTemplate: nichts,
    onOpenBoard: nichts,
    onRecall: nichts,
    ...z,
  };
}
/** Rendert mit einem nachgestellten localStorage (Collapsible liest ihn nur mit window); danach ist window wieder weg. */
function mitSpeicher(werte: Record<string, string>, f: () => string): string {
  const g = globalThis as { window?: unknown };
  g.window = { localStorage: { getItem: (k: string) => werte[k] ?? null, setItem: nichts } };
  try {
    return f();
  } finally {
    delete g.window;
  }
}
/** Titel und aria-expanded der Collapsibles in Reihenfolge. */
function klappen(html: string): string[] {
  return [...html.matchAll(/<button type="button" aria-expanded="(true|false)"[^>]*>[\s\S]*?<span[^>]*>([^<]*)<\/span>/g)].map(
    (m) => `${m[2]}:${m[1]}`,
  );
}

// ── Haupttasten (liveTasten) ──
{
  const T = TITLER_TEXTE;
  const zeile = (p: LiveBereichProps): string[] =>
    liveTasten(p).map((t) => `${t.label}:${t.state}${t.disabledReason ? `(${t.disabledReason})` : ''}`);
  gleich(
    [
      zeile(live()),
      zeile(live({ live: true })),
      zeile(live({ anzahl: 3, activeEntry: 0 })),
      zeile(live({ anzahl: 3, activeEntry: 2, live: true })),
      zeile(live({ anzahl: 3, activeEntry: -1 })),
      zeile(live({ anzahl: 1, activeEntry: 0 })),
    ],
    [
      [`${T.take}:bereit`, `${T.clear}:bereit`],
      [`${T.take}:live`, `${T.clear}:bereit`],
      [`${T.take}:bereit`, `${T.clear}:bereit`, `${T.zurueck}:gesperrt(${T.ersterEintrag})`, `${T.weiter}:bereit`],
      [`${T.take}:live`, `${T.clear}:bereit`, `${T.zurueck}:bereit`, `${T.weiter}:gesperrt(${T.letzterEintrag})`],
      [`${T.take}:bereit`, `${T.clear}:bereit`, `${T.zurueck}:bereit`, `${T.weiter}:bereit`],
      [`${T.take}:bereit`, `${T.clear}:bereit`, `${T.zurueck}:gesperrt(${T.ersterEintrag})`, `${T.weiter}:gesperrt(${T.letzterEintrag})`],
    ],
    'liveTasten: Take und Clear immer, ◀/▶ Eintrag nur mit Einträgen, an den Rändern gesperrt mit Grund; Take nie gesperrt (E12)',
  );
  const log: string[] = [];
  const tasten = liveTasten(
    live({
      anzahl: 3,
      activeEntry: 1,
      onTake: () => void log.push('take'),
      onClear: () => void log.push('clear'),
      onSchritt: (d) => void log.push(`schritt ${d}`),
    }),
  );
  for (const t of tasten) t.onClick?.();
  gleich(log, ['take', 'clear', 'schritt -1', 'schritt 1'], 'liveTasten: Klick ruft onTake, onClear, onSchritt(-1), onSchritt(1)');
  ok(tasten.every((t) => t.shortcut === undefined && t.onPress === undefined), 'liveTasten: keine Kürzel, kein Halten (UO5)');
}

// ── Live-Bereich gerendert ──
{
  const aus = render(<LiveBereich {...live({ anzahl: 3, activeEntry: 0 })} />);
  const an = render(<LiveBereich {...live({ ndiActive: true })} />);
  ok(
    /^<div data-titler="live"[^>]*><div [^>]*cg-checker[^>]*><canvas /.test(aus),
    'LiveBereich: die Vorschau ist das erste Kind des Live-Bereichs, darin zuerst das <canvas>',
  );
  const [vorschau] = tags(aus, 'canvas');
  gleich([attr(vorschau, 'width'), attr(vorschau, 'height')], ['960', '540'], 'LiveBereich: Vorschau 960×540 wie bisher');
  const tastenTeil = bereich(aus, 'haupttasten');
  gleich(
    [tags(tastenTeil, 'button').length, (tastenTeil.match(/ data-state="/g) ?? []).length, aus.includes('<kbd')],
    [4, 4, false],
    'LiveBereich: vier TallyButtons in data-titler="haupttasten", kein <kbd> (höchstens vier, keine Kürzel)',
  );
  gleich(
    [text(bereich(aus, 'hinweiszeile')), text(bereich(an, 'hinweiszeile'))],
    [TITLER_TEXTE.hinweisNdiAus, TITLER_TEXTE.hinweisNdiAn],
    'LiveBereich: Hinweiszeile bei NDI aus (T4) bzw. an (wie bisher)',
  );
  pruefeIdVerweise(aus, 'LiveBereich: id-Verweise gültig (Sperrgrund per aria-describedby)');
}

// ── Bedienung: Vorlage und Inhalt ──
{
  const html = render(<Bedienung {...bedienung()} />);
  ok(
    /<h3[^>]*>Vorlage<\/h3>/.test(html) && /<h3[^>]*>Inhalt<\/h3>/.test(html) && html.startsWith('<div data-titler="bedienung"'),
    'Bedienung: „Vorlage“ und „Inhalt“ immer offen (SettingsSection, kein Collapsible)',
  );
  gleich(klappen(html), ['Grafik-Vorlagen:false', 'Daten / Recall:true'], 'Bedienung: Collapsibles „Grafik-Vorlagen“ (zu) und „Daten / Recall“ (offen) wie bisher');
  const labels = (h: string): string[] => [...h.matchAll(/<label for="[^"]+"[^>]*>([^<]*)<\/label>/g)].map((m) => m[1]);
  gleich(labels(html), ['Name', 'Untertitel'], 'Bedienung › Inhalt: Bauchbinde mit Name und Untertitel aus @jm/ui (Field + TextInput, E23)');
  pruefeIdVerweise(html, 'Bedienung: id-Verweise gültig (Beschriftung → Eingabe)');
  const grafik = render(
    <Bedienung
      {...bedienung({ config: basisConfig({ template: 'graphic', activeGraphicId: 'v1', slotText: { name: 'Anna' } }), templates: VORLAGEN })}
    />,
  );
  gleich(labels(grafik), ['Name-Ebene', 'Rolle-Ebene'], 'Bedienung › Inhalt: Grafik-Vorlage mit einem Feld je Slot');
  gleich(
    tags(grafik, 'input').map((t) => attr(t, 'value')),
    ['Anna', 'Moderation'],
    'Bedienung › Inhalt: Slot-Wert aus slotText, sonst Vorgabetext',
  );
  const ohne = render(<Bedienung {...bedienung({ config: basisConfig({ template: 'graphic', activeGraphicId: '' }) })} />);
  enthaelt(ohne, TITLER_TEXTE.keineGrafik, 'Bedienung › Inhalt: ohne gewählte Grafik-Vorlage der Hinweis T6');
  const standbild = render(<Bedienung {...bedienung({ config: basisConfig({ template: 'graphic', activeGraphicId: 'v2' }), templates: VORLAGEN })} />);
  enthaelt(text(standbild), 'Diese Vorlage hat keine Textfelder (reines Standbild).', 'Bedienung › Inhalt: Grafik-Vorlage ohne Textfelder mit dem Hinweis von heute (Nr. 18)');
  const banner = render(<Bedienung {...bedienung({ config: basisConfig({ template: 'banner', bannerText: 'Eilmeldung' }) })} />);
  const ticker = render(<Bedienung {...bedienung({ config: basisConfig({ template: 'ticker', tickerText: 'Lauftext', tickerSpeed: 0.12 }) })} />);
  const [tempo] = tags(ticker, 'input').filter((t) => attr(t, 'type') === 'range');
  gleich(
    [
      labels(banner),
      tags(banner, 'input').map((t) => attr(t, 'value')),
      labels(ticker),
      text(ticker).includes('Ticker-Tempo'),
      ['min', 'max', 'step', 'value'].map((a) => attr(tempo, a)),
    ],
    [['Banner-Text'], ['Eilmeldung'], ['Ticker-Text'], true, ['0.02', '0.3', '0.01', '0.12']],
    'Bedienung › Inhalt: Banner mit Feld „Banner-Text“, Ticker mit Feld „Ticker-Text“ und Schieber „Ticker-Tempo“ 0,02–0,3 in 0,01 (Nr. 14–16)',
  );
}

// ── Bedienung: Verdrahtung der Felder (onChange → setConfig mit dem richtigen Schlüssel) ──
// Ohne Browser lässt sich nicht tippen. Darum ruft ein Fänger Bedienung beim Server-Render auf (ihre useMemo laufen dort)
// und hält den Baum fest, den sie zurückgibt; darin stehen die Felder mit ihren onChange, die der Test selbst aufruft.
{
  function felder(config: TitlerConfig, templates: GraphicTemplate[] = []): string[] {
    const patches: string[] = [];
    let baum: ReactNode = null;
    function Faenger(): React.JSX.Element {
      const el = Bedienung(bedienung({ config, templates, setConfig: (patch) => void patches.push(JSON.stringify(patch)) }));
      baum = el;
      return el;
    }
    render(<Faenger />);
    const aus: string[] = [];
    const geh = (n: ReactNode): void => {
      if (Array.isArray(n)) {
        n.forEach(geh);
        return;
      }
      if (!isValidElement(n)) return;
      const props = n.props as { label?: string; children?: ReactNode; onChange?: (v: number) => void };
      const kind = props.children;
      let ruf: (() => void) | undefined;
      if (n.type === Field && isValidElement(kind) && kind.type === TextInput) {
        const eingabe = kind as ReactElement<{ onChange(v: string): void }>;
        ruf = () => eingabe.props.onChange('Neu');
      } else if (n.type === Slider) {
        ruf = () => props.onChange?.(0.25);
      }
      if (ruf) {
        const vorher = patches.length;
        ruf();
        aus.push(`${props.label}: ${patches.slice(vorher).join(' ') || 'nichts'}`);
      }
      geh(kind);
    };
    geh(baum);
    return aus;
  }
  gleich(
    [
      ...felder(basisConfig()),
      ...felder(basisConfig({ template: 'banner' })),
      ...felder(basisConfig({ template: 'ticker' })),
      ...felder(basisConfig({ template: 'graphic', activeGraphicId: 'v1', slotText: { name: 'Anna' } }), VORLAGEN),
    ],
    [
      'Name: {"name":"Neu"}',
      'Untertitel: {"subtitle":"Neu"}',
      'Banner-Text: {"bannerText":"Neu"}',
      'Ticker-Text: {"tickerText":"Neu"}',
      'Ticker-Tempo: {"tickerSpeed":0.25}',
      'Name-Ebene: {"slotText":{"name":"Neu"}}',
      'Rolle-Ebene: {"slotText":{"name":"Anna","rolle":"Neu"}}',
    ],
    'Bedienung › Inhalt: jedes Feld schreibt beim Tippen in seinen Schlüssel (Name, Untertitel, Banner-Text, Ticker-Text, Ticker-Tempo, Slots; E23)',
  );
}

// ── Bedienung: Grafik-Vorlagen (Kacheln) und gemerkte Collapsibles ──
{
  const offen = { 'jm.collapsible.titler.graphics': '1', 'jm.collapsible.titler.recall': '0' };
  const html = mitSpeicher(offen, () =>
    render(<Bedienung {...bedienung({ config: basisConfig({ activeGraphicId: 'v2' }), templates: VORLAGEN })} />),
  );
  gleich(
    [klappen(html), klappen(mitSpeicher({}, () => render(<Bedienung {...bedienung()} />)))],
    [
      ['Grafik-Vorlagen:true', 'Daten / Recall:false'],
      ['Grafik-Vorlagen:false', 'Daten / Recall:true'],
    ],
    'Bedienung: Collapsibles merken sich unter jm.collapsible.titler.graphics und …titler.recall (persistId wie bisher)',
  );
  const kacheln = tags(html, 'button').filter((t) => VORLAGEN.some((v) => attr(t, 'title') === v.name));
  gleich(
    kacheln.map((t) => [attr(t, 'type'), attr(t, 'aria-pressed'), attr(t, 'title')]),
    [
      ['button', 'false', 'Bauchbinde rot'],
      ['button', 'true', 'Standbild'],
    ],
    'Bedienung › Grafik-Vorlagen: Kacheln sind <button type="button"> mit aria-pressed (per Tastatur wählbar, E13)',
  );
  ok(
    !html.includes('Datei importieren') && !html.includes(TITLER_TEXTE.loeschen) && !html.includes('hierher ziehen'),
    'Bedienung › Grafik-Vorlagen: nur wählen; Import und Löschen liegen im Panel',
  );
  const leer = mitSpeicher(offen, () => render(<Bedienung {...bedienung()} />));
  enthaelt(leer, TITLER_TEXTE.keineVorlagen, 'Bedienung › Grafik-Vorlagen: ohne Vorlagen der Hinweis T6');
}

// ── Bedienung: Daten / Recall ──
{
  const status = basisStatus({
    entries: [
      { key: 'a', label: 'Anna Berg' },
      { key: 'b', label: 'Ben Kurz' },
      { key: 'c', label: '' },
    ],
    activeEntry: 1,
    variables: { name: 'Ben Kurz' },
    dataSources: ['speakers.tsv'],
    hinweis: { art: 'H3', text: 'Hinweis H3 wörtlich' },
    datenQuelle: { art: 'show', zeile: 'Quelle: Show „Probe“ · 3 Speaker', zurueckKnopf: null, ohneOrdner: false },
  });
  const html = render(<Bedienung {...bedienung({ status, config: basisConfig({ name: '{{name}}' }) })} />);
  ok(
    ['Quelle: Show „Probe“ · 3 Speaker', 'Hinweis H3 wörtlich', 'Einträge · 2/3', '⧉ Board', 'Anna Berg', 'Ben Kurz', 'Im Text verwendet:', '{{name}}', 'Quelle: speakers.tsv'].every(
      (t) => text(html).includes(t),
    ) && !/>[‹›]</.test(html),
    'Bedienung › Daten / Recall: Quellzeile, Hinweis, Zähler, ⧉ Board, Liste, Variablen, „Im Text verwendet“; ‹ und › entfallen (E12)',
  );
  gleich(tags(html, 'button').length, 4 + 2 + 1 + 3, 'Bedienung › Daten / Recall: Knöpfe = 4 Vorlagen + 2 Collapsibles + ⧉ Board + 3 Einträge');
  gleich(
    [...html.matchAll(/<button type="button"( aria-current="true")? class="[^"]*"><span class="tabular[^"]*">(\d+)<\/span>/g)].map((m) => `${m[2]}:${m[1] ? 'aktiv' : '-'}`),
    ['1:-', '2:aktiv', '3:-'],
    'Bedienung › Daten / Recall: der aktive Eintrag trägt aria-current, nicht nur Farbe und Fettung',
  );
  const kasten = tags(html, 'p').find((t) => attr(t, 'role') === 'status');
  ok(
    (attr(kasten, 'class') ?? '').includes('border-[var(--status-warn)]/50 bg-[var(--status-warn)]/15') && !html.includes('--warning'),
    'Bedienung › Daten / Recall: Hinweis-Kasten in Orange (--status-warn), kein Gelb --warning (Spec 4.2, E25)',
  );
  enthaelt(
    text(render(<Bedienung {...bedienung({ status: { ...status, variables: {} } })} />)),
    'Keine Variablen gefunden. Lege im Ordner z. B. eine gaeste.csv mit Kopfzeile',
    'Bedienung › Daten / Recall: ohne Variablen der Hilfetext von heute (Nr. 36)',
  );
  const fehler = render(<Bedienung {...bedienung({ status: { ...status, dataError: 'EACCES: permission denied' } })} />);
  ok(
    text(fehler).includes('DataLink: EACCES: permission denied') &&
      text(fehler).includes('Anna Berg') &&
      text(fehler).includes('⧉ Board') &&
      !text(fehler).includes('Quelle: speakers.tsv'),
    'Bedienung › Daten / Recall: bei Fehler mit noch geltender Liste stehen Fehlerzeile und Liste zugleich (E21)',
  );
  enthaelt(render(<Bedienung {...bedienung()} />), TITLER_TEXTE.keinOrdner, 'Bedienung › Daten / Recall: ohne Datenordner der Hinweis T5');
}

// ── Panel: Stil und Grafik-Vorlagen ziehen mit um ──
{
  const html = render(
    <Einstellungen
      stand={basisStand()}
      aktionen={protokollAktionen([])}
      templates={VORLAGEN}
      activeGraphicId="v1"
      onPickImport={nichts}
      onDropImport={nichts}
      onDeleteTemplate={nichts}
    />,
  );
  ok(
    html.includes('id="einstellung-stil"') &&
      html.includes('id="einstellung-vorlagen"') &&
      text(html).includes('Datei importieren…') &&
      text(html).includes('hierher ziehen'),
    'Panel: Abschnitte „Stil“ und „Grafik-Vorlagen“ mit Anker, Import-Knopf und Ablagefläche',
  );
  gleich(
    tags(html, 'button')
      .filter((t) => attr(t, 'aria-label')?.startsWith('Vorlage „'))
      .map((t) => attr(t, 'aria-label')),
    VORLAGEN.map((v) => TITLER_TEXTE.loeschenAria(v.name)),
    'Panel › Grafik-Vorlagen: je Vorlage ein Knopf „Löschen“ mit aria-label (T7)',
  );
  ok(!html.includes('opacity-0'), 'Panel › Grafik-Vorlagen: „Löschen“ immer sichtbar (kein opacity-0, E13)');
}

// ── Quelltext ──
{
  const op = leseText('src/renderer/src/views/OperatorView.tsx');
  const fehlt = [
    'live={live}',
    'onTake={take}',
    'onClear={clear}',
    'onSchritt={(delta) => void window.jmtitler.stepEntry(delta)}',
    'onSelectTemplate={selectTemplate}',
    'onOpenBoard={() => void window.jmtitler.openRecall()}',
    'onRecall={(key) => void window.jmtitler.recallSchluessel(key)}',
    'onPickImport={() => void pickImport()}',
    'onDropImport={onDropImport}',
    'onDeleteTemplate={(tpl) => void deleteTemplate(tpl)}',
  ].filter((z) => !op.includes(z));
  ok(
    fehlt.length === 0,
    'Quelltext OperatorView: Haupttasten mit Take-Tally aus live (E11), Kacheln, Recall, Board, Import und Löschen unverändert verdrahtet',
  );
  for (const z of fehlt) console.log(`     fehlt: ${z}`);
  const bed = ohneKommentare(leseText('src/renderer/src/views/Bedienung.tsx'));
  ok(
    bed.includes('persistId="titler.graphics"') && bed.includes('persistId="titler.recall"') && !bed.includes('titler.style') && !bed.includes('window'),
    'Quelltext Bedienung: persistId titler.graphics und titler.recall, kein titler.style, kein window',
  );
  const alt = ['views/OperatorView.tsx', 'views/Bedienung.tsx', 'views/LiveBereich.tsx'].filter((d) =>
    /Reiter|rechts starten/.test(leseText(`src/renderer/src/${d}`)),
  );
  ok(alt.length === 0, 'Texte: kein „Reiter“ und kein „rechts starten“ in OperatorView, Bedienung, LiveBereich (Befund 16)');
  for (const d of alt) console.log(`     gefunden in: ${d}`);
}
```

Einfügen in `apps/titler/test/ui/selftest.ts` direkt vor der Zeile `abschluss();`:
```ts
import './live.test';
```

- [ ] **Step 2: Rahmen-Test auf die neuen Panel-Props** (`apps/titler/test/ui/rahmen.test.tsx`)

Vorher:
```tsx
  const html = render(<Einstellungen stand={stand} aktionen={protokollAktionen(log)} />);
```
Nachher:
```tsx
  const html = render(
    <Einstellungen
      stand={stand}
      aktionen={protokollAktionen(log)}
      templates={[]}
      activeGraphicId=""
      onPickImport={() => void log.push('onPickImport')}
      onDropImport={() => void log.push('onDropImport')}
      onDeleteTemplate={() => void log.push('onDeleteTemplate')}
    />,
  );
```

- [ ] **Step 3: Test laufen lassen (rot)**

```
npm run selftest -w @jm/titler > <eigener Scratchpad>/c10-rot.txt 2>&1; echo "Exit=$?"
grep -E "ERR_MODULE_NOT_FOUND|^Error" <eigener Scratchpad>/c10-rot.txt
```
Erwartet (gemessen): `Exit=1`; der alte Lauf grün, der Oberflächen-Lauf bricht beim Laden ab:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/views' imported from <Worktree>\apps\titler\test\ui\live.test.tsx
```

- [ ] **Step 4: Live-Bereich** (Neue Datei `apps/titler/src/renderer/src/views/LiveBereich.tsx`)

```tsx
// Live-Bereich des Titlers (UX-Pilot C10; Spec 3.4, 5.1, Anhang A „Titler“; E11, E12): immer sichtbar die CG-Vorschau,
// darunter die Haupttasten als TallyButtons (Take, Clear, mit Einträgen ◀ Eintrag und Eintrag ▶) und die Hinweiszeile.
// Rein darstellend: Zustände kommen aus hauptTasten (lib/oberflaeche.ts), Aktionen über Props. Keine Kürzel (UO5).
import type { RefObject } from 'react';
import { TallyButton, type TallyButtonProps } from '@jm/ui';
import { hauptTasten, TITLER_TEXTE } from '@/lib/oberflaeche';

export interface LiveBereichProps {
  previewRef: RefObject<HTMLCanvasElement>;
  /** On-Air aus der Engine (E11): Take zeigt LIVE, solange die Grafik eingeblendet ist bzw. wird. */
  live: boolean;
  ndiActive: boolean;
  activeEntry: number;
  anzahl: number;
  onTake(): void;
  onClear(): void;
  onSchritt(delta: -1 | 1): void;
}

/** Die Haupttasten als Props (2 ohne, 4 mit Einträgen); LiveBereich rendert genau diese. Ohne DOM prüfbar. */
export function liveTasten(p: LiveBereichProps): TallyButtonProps[] {
  const t = hauptTasten(p.live, p.activeEntry, p.anzahl);
  const tasten: TallyButtonProps[] = [
    { ...t.take, label: TITLER_TEXTE.take, onClick: () => p.onTake() },
    { ...t.clear, label: TITLER_TEXTE.clear, onClick: () => p.onClear() },
  ];
  if (t.eintrag) {
    tasten.push({ ...t.eintrag.zurueck, label: TITLER_TEXTE.zurueck, onClick: () => p.onSchritt(-1) });
    tasten.push({ ...t.eintrag.weiter, label: TITLER_TEXTE.weiter, onClick: () => p.onSchritt(1) });
  }
  return tasten;
}

export function LiveBereich(p: LiveBereichProps): React.JSX.Element {
  return (
    <div data-titler="live" className="flex min-w-0 flex-1 flex-col gap-4 p-5">
      <div className="cg-checker grid min-h-0 flex-1 place-items-center overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
        <canvas ref={p.previewRef} width={960} height={540} className="h-full w-full object-contain" />
      </div>
      <div data-titler="haupttasten" className="grid grid-cols-2 gap-3">
        {liveTasten(p).map((taste) => (
          <TallyButton key={taste.label} {...taste} />
        ))}
      </div>
      <p data-titler="hinweiszeile" className="-mt-1 text-[11px] text-[var(--muted-foreground)]">
        {p.ndiActive ? TITLER_TEXTE.hinweisNdiAn : TITLER_TEXTE.hinweisNdiAus}
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Bedienung** (Neue Datei `apps/titler/src/renderer/src/views/Bedienung.tsx`)

Vorlage, Inhalt, Grafik-Vorlagen und Daten / Recall aus dem alten Reiter „Steuerung“; geändert sind nur die Punkte aus
„Verhalten (verbindlich)“.
```tsx
// Bedienung des Titlers neben dem Live-Bereich (UX-Pilot C10; Spec 5.1, Anhang A „Titler“; E12, E13, E21, E23): „Vorlage“
// und „Inhalt“ immer offen, „Grafik-Vorlagen“ (Kacheln zum Wählen) und „Daten / Recall“ als Collapsible mit den
// bisherigen persistId (gemerkt je Arbeitsplatz). Rein darstellend: Werte und Rückrufe über Props, kein window, keine
// Effekte (G7, G8). Import, Löschen und Stil liegen im Einstellungs-Panel.
import { useMemo } from 'react';
import { Button, cn, Collapsible, Field, SettingsSection, TextInput } from '@jm/ui';
import type { GraphicTemplate, PartialTitlerConfig, TemplateKind, TitlerConfig, TitlerStatus } from '@shared/types';
import { usedVars } from '@shared/vars';
import { zaehlerText } from '@/lib/datalink-anzeige';
import { TITLER_TEXTE } from '@/lib/oberflaeche';
import { Slider } from './felder';

const TEMPLATES: { key: TemplateKind; label: string }[] = [
  { key: 'lowerthird', label: 'Bauchbinde' },
  { key: 'banner', label: 'Banner' },
  { key: 'ticker', label: 'Ticker' },
  { key: 'graphic', label: 'Grafik' },
];

export interface BedienungProps {
  config: TitlerConfig;
  status: TitlerStatus;
  templates: GraphicTemplate[];
  setConfig(patch: PartialTitlerConfig): void;
  onSelectTemplate(t: GraphicTemplate): void;
  onOpenBoard(): void;
  onRecall(key: string): void;
}

export function Bedienung(p: BedienungProps): React.JSX.Element {
  const c = p.config;
  const { variables, dataSources, dataError, entries, activeEntry, hinweis, datenQuelle } = p.status;
  const activeTemplate = p.templates.find((t) => t.id === c.activeGraphicId);

  // Vorhandene Variablen (klein geschrieben) + im Text referenzierte Schlüssel
  // für die Variablen-Sektion (Treffer/Fehler markieren).
  const lowerVars = useMemo(() => {
    const m: Record<string, true> = {};
    for (const k of Object.keys(variables)) m[k.toLowerCase()] = true;
    return m;
  }, [variables]);
  const referenced = useMemo(() => {
    const set = new Set<string>();
    for (const t of [c.name, c.subtitle, c.bannerText, c.tickerText]) {
      for (const k of usedVars(t)) set.add(k);
    }
    return [...set];
  }, [c.name, c.subtitle, c.bannerText, c.tickerText]);

  return (
    <div data-titler="bedienung" className="w-[400px] shrink-0 overflow-auto border-l border-[var(--border)]/60">
      <div className="space-y-5 p-5">
        <SettingsSection title="Vorlage">
          <div className="flex gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={c.template === t.key}
                onClick={() => p.setConfig({ template: t.key })}
                className={cn(
                  'flex-1 h-9 rounded-[var(--radius)] text-xs font-extrabold uppercase tracking-wide border',
                  c.template === t.key
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent'
                    : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--highlight)]',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </SettingsSection>

        {/* Inhalt — Namensfeld: immer sichtbar, nicht ausklappbar (#165); jeder Tastendruck geht wie bisher an setConfig */}
        <SettingsSection title="Inhalt">
          {c.template === 'lowerthird' && (
            <>
              <Field label="Name">
                <TextInput value={c.name} onChange={(v) => p.setConfig({ name: v })} />
              </Field>
              <Field label="Untertitel">
                <TextInput value={c.subtitle} onChange={(v) => p.setConfig({ subtitle: v })} />
              </Field>
            </>
          )}
          {c.template === 'banner' && (
            <Field label="Banner-Text">
              <TextInput value={c.bannerText} onChange={(v) => p.setConfig({ bannerText: v })} />
            </Field>
          )}
          {c.template === 'ticker' && (
            <>
              <Field label="Ticker-Text">
                <TextInput value={c.tickerText} onChange={(v) => p.setConfig({ tickerText: v })} />
              </Field>
              <Slider
                label="Ticker-Tempo"
                value={c.tickerSpeed}
                min={0.02}
                max={0.3}
                step={0.01}
                onChange={(v) => p.setConfig({ tickerSpeed: v })}
              />
            </>
          )}
          {c.template === 'graphic' &&
            (activeTemplate ? (
              activeTemplate.slots.length === 0 ? (
                <p className="text-[11px] text-[var(--muted-foreground)]">Diese Vorlage hat keine Textfelder (reines Standbild).</p>
              ) : (
                activeTemplate.slots.map((s) => (
                  <Field key={s.key} label={s.label}>
                    <TextInput
                      value={c.slotText[s.key] ?? s.defaultText}
                      onChange={(v) => p.setConfig({ slotText: { ...c.slotText, [s.key]: v } })}
                    />
                  </Field>
                ))
              )
            ) : (
              <p className="text-[11px] text-[var(--muted-foreground)]">{TITLER_TEXTE.keineGrafik}</p>
            ))}
        </SettingsSection>

        {/* Grafik-Vorlagen (#162): wählen per Kachel; Import und Löschen unter Einstellungen › Grafik-Vorlagen (E13) */}
        <Collapsible title="Grafik-Vorlagen" persistId="titler.graphics" defaultOpen={false}>
          {p.templates.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {p.templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={t.id === c.activeGraphicId}
                  onClick={() => p.onSelectTemplate(t)}
                  className={cn(
                    'relative overflow-hidden rounded-[var(--radius)] border text-left',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
                    t.id === c.activeGraphicId
                      ? 'border-[var(--primary)] ring-1 ring-[var(--primary)]'
                      : 'border-[var(--border)] hover:bg-[var(--highlight)]',
                  )}
                  title={t.name}
                >
                  {t.thumbDataUrl ? (
                    <img src={t.thumbDataUrl} alt="" className="cg-checker w-full h-20 object-contain" />
                  ) : (
                    <div className="cg-checker w-full h-20" />
                  )}
                  <span className="block truncate px-2 py-1 text-[11px] font-semibold">{t.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-[var(--muted-foreground)]">{TITLER_TEXTE.keineVorlagen}</p>
          )}
        </Collapsible>

        {/* Daten / Recall (#86/#152): Live-Abruf der DataLink-Einträge; den Ordner wählt Einstellungen › DataLink. */}
        <Collapsible title="Daten / Recall" persistId="titler.recall" defaultOpen>
          {/* Quelle über der Liste (Q1–Q3) und stehender Hinweis (H1–H7), Spec 7.8 */}
          {datenQuelle?.zeile ? (
            <p className="truncate text-[11px] text-[var(--muted-foreground)]" title={datenQuelle.zeile}>
              {datenQuelle.zeile}
            </p>
          ) : null}
          {/* Warnfarbe Orange statt Gelb (Spec 4.2, E25) */}
          {hinweis ? (
            <p
              role="status"
              className="rounded-[var(--radius)] border border-[var(--status-warn)]/50 bg-[var(--status-warn)]/15 px-3 py-2 text-[11px] text-[var(--foreground)]"
            >
              {hinweis.text}
            </p>
          ) : null}
          {datenQuelle?.ohneOrdner ? (
            <p className="text-[11px] text-[var(--muted-foreground)]">{TITLER_TEXTE.keinOrdner}</p>
          ) : (
            <>
              {/* Fehler oben; eine noch geltende Liste bleibt darunter abrufbar, wie im Board (E21) */}
              {dataError ? <p className="text-[11px] text-[var(--destructive)]">DataLink: {dataError}</p> : null}
              {/* Abrufbare Einträge (Recall); ◀/▶ Eintrag stehen als Haupttasten im Live-Bereich (E12) */}
              {entries.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
                      {zaehlerText(activeEntry, entries.length)}
                    </span>
                    <div className="ml-auto flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        uppercase={false}
                        onClick={() => p.onOpenBoard()}
                        title="Recall-Button-Board in eigenem Fenster öffnen (#152)"
                      >
                        ⧉ Board
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-auto rounded-[var(--radius)] border border-[var(--border)]/60 divide-y divide-[var(--border)]/40">
                    {entries.map((e, i) => (
                      <button
                        key={e.key}
                        type="button"
                        aria-current={i === activeEntry ? 'true' : undefined}
                        onClick={() => p.onRecall(e.key)}
                        className={cn(
                          'flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-xs',
                          i === activeEntry
                            ? 'bg-[var(--primary)]/15 text-[var(--foreground)] font-bold'
                            : 'hover:bg-[var(--highlight)] text-[var(--muted-foreground)]',
                        )}
                      >
                        <span className="tabular text-[10px] w-5 shrink-0 text-[var(--muted-foreground)]">{i + 1}</span>
                        <span className="truncate">{e.label || '—'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Variablen des aktiven Eintrags */}
              {dataError ? null : (
                <div className="rounded-[var(--radius)] border border-[var(--border)]/60 divide-y divide-[var(--border)]/40">
                  {Object.keys(variables).length === 0 ? (
                    <p className="px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
                      Keine Variablen gefunden. Lege im Ordner z. B. eine <code>gaeste.csv</code> mit Kopfzeile
                      <code>name,funktion</code> an — oder eine <code>daten.txt</code> mit <code>name=Dr. Schmidt</code>.
                    </p>
                  ) : (
                    Object.entries(variables).map(([k, v]) => (
                      <div key={k} className="flex items-baseline gap-2 px-3 py-1.5 text-xs">
                        <code className="font-bold text-[var(--primary)] shrink-0">{`{{${k}}}`}</code>
                        <span className="truncate text-[var(--muted-foreground)]">{v || '—'}</span>
                      </div>
                    ))
                  )}
                  {dataSources.length > 0 ? (
                    <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                      Quelle: {dataSources.join(', ')}
                    </p>
                  ) : null}
                </div>
              )}
            </>
          )}
          {referenced.length > 0 ? (
            <p className="text-[11px] text-[var(--muted-foreground)] flex flex-wrap items-baseline gap-x-1">
              <span>Im Text verwendet:</span>
              {referenced.map((k) => (
                <code
                  key={k}
                  className={cn(k.toLowerCase() in lowerVars ? 'text-[var(--primary)]' : 'text-[var(--destructive)]')}
                  title={k.toLowerCase() in lowerVars ? 'Variable vorhanden' : 'Variable nicht gefunden'}
                >
                  {`{{${k}}}`}
                </code>
              ))}
            </p>
          ) : null}
        </Collapsible>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Panel um „Stil“ und „Grafik-Vorlagen“ erweitern** (`apps/titler/src/renderer/src/views/Einstellungen.tsx`)

Vorher:
```tsx
// Inhalt des Einstellungs-Panels (UX-Pilot C9; Spec 3.1, 3.6): vorerst der Inhalt des bisherigen Reiters
// „Einstellungen“, unverändert bis auf die Herkunft der Werte (Stand) und der Handler (Aktionen). Ab C11 bauen die
// Abschnitte aus @jm/settings das Panel neu. Kein window und kein Effekt hier (G7, G8): Das Panel ist nur offen
// gemountet; was immer laufen muss, bleibt in OperatorView.
import { Button, SettingsSection } from '@jm/ui';
import type { OberflaechenStand, TitlerAktionen } from '@/lib/oberflaeche';
import { ColorField, Field, Labeled } from './felder';
```
Nachher:
```tsx
// Inhalt des Einstellungs-Panels (UX-Pilot C9, C10; Spec 3.1, 3.6): vorerst der Inhalt des bisherigen Reiters
// „Einstellungen“, unverändert bis auf die Herkunft der Werte (Stand) und der Handler (Aktionen); dahinter seit C10 die
// tool-eigenen Abschnitte „Stil“ und „Grafik-Vorlagen“ (Anhang A, E13). Ab C11 bauen die Abschnitte aus @jm/settings das
// Panel neu. Kein window und kein Effekt hier (G7, G8): Das Panel ist nur offen gemountet; was immer laufen muss, bleibt
// in OperatorView.
import { Button, cn, PanelAnker, SettingsSection } from '@jm/ui';
import type { GraphicTemplate } from '@shared/types';
import { ABSCHNITT, TITLER_TEXTE, type OberflaechenStand, type TitlerAktionen } from '@/lib/oberflaeche';
import { ColorField, Field, Labeled, Slider } from './felder';
```
Vorher:
```tsx
export function Einstellungen({ stand, aktionen }: { stand: OberflaechenStand; aktionen: TitlerAktionen }): React.JSX.Element {
```
Nachher:
```tsx
export interface EinstellungenProps {
  stand: OberflaechenStand;
  aktionen: TitlerAktionen;
  templates: GraphicTemplate[];
  activeGraphicId: string;
  onPickImport(): void;
  onDropImport(e: React.DragEvent): void;
  onDeleteTemplate(t: GraphicTemplate): void;
}

export function Einstellungen({
  stand,
  aktionen,
  templates,
  activeGraphicId,
  onPickImport,
  onDropImport,
  onDeleteTemplate,
}: EinstellungenProps): React.JSX.Element {
```
Vorher:
```tsx
      </SettingsSection>
    </div>
```
Nachher:
```tsx
      </SettingsSection>

      {/* Stil (tool-eigen, Anhang A): Lage, Größe, Farben; bisher in der Bedienung unter „Stil“ */}
      <PanelAnker id={ABSCHNITT.stil}>
        <SettingsSection title={TITLER_TEXTE.stil}>
          <div className="flex gap-2">
            {(['bottom', 'top'] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={c.position === p}
                onClick={() => void setConfig({ position: p })}
                className={cn(
                  'flex-1 h-9 rounded-[var(--radius)] text-xs font-bold border',
                  c.position === p
                    ? 'bg-[var(--accent)] text-[var(--foreground)] border-transparent'
                    : 'border-[var(--border)] hover:bg-[var(--highlight)]',
                )}
              >
                {p === 'bottom' ? 'Unten' : 'Oben'}
              </button>
            ))}
          </div>
          <Slider label="Größe" value={c.scale} min={0.6} max={1.6} step={0.05} onChange={(v) => void setConfig({ scale: v })} />
          <div className="flex gap-3">
            <ColorField label="Balken" value={c.colors.bar} onChange={(v) => void setConfig({ colors: { bar: v } })} />
            <ColorField label="Text" value={c.colors.text} onChange={(v) => void setConfig({ colors: { text: v } })} />
            <ColorField label="Akzent" value={c.colors.accent} onChange={(v) => void setConfig({ colors: { accent: v } })} />
          </div>
        </SettingsSection>
      </PanelAnker>

      {/* Grafik-Vorlagen (#162, tool-eigen): Import aus jm Grafiktool / PSD; je Vorlage ein sichtbarer Knopf „Löschen“ (E13) */}
      <PanelAnker id={ABSCHNITT.vorlagen}>
        <SettingsSection
          title={TITLER_TEXTE.vorlagen}
          description={
            <>
              Bauchbinden aus dem jm Grafiktool oder als <code>.psd</code> importieren. Textebenen werden zu
              füllbaren Feldern — Variablen bleiben nutzbar.
            </>
          }
        >
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDropImport}
            className="rounded-[var(--radius)] border border-dashed border-[var(--border)] px-3 py-3 text-center"
          >
            <Button variant="outline" size="sm" onClick={() => onPickImport()}>
              Datei importieren…
            </Button>
            <p className="mt-1.5 text-[10px] text-[var(--muted-foreground)]">oder .psd / .jmtitler hierher ziehen</p>
          </div>
          {templates.length > 0 ? (
            <ul className="rounded-[var(--radius)] border border-[var(--border)]/60 divide-y divide-[var(--border)]/40">
              {templates.map((t) => (
                <li key={t.id} className="flex items-center gap-2 px-3 py-1.5">
                  <span className={cn('truncate text-xs', t.id === activeGraphicId && 'font-bold')} title={t.name}>
                    {t.name}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    uppercase={false}
                    className="ml-auto shrink-0"
                    aria-label={TITLER_TEXTE.loeschenAria(t.name)}
                    title={TITLER_TEXTE.loeschenAria(t.name)}
                    onClick={() => onDeleteTemplate(t)}
                  >
                    {TITLER_TEXTE.loeschen}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </SettingsSection>
      </PanelAnker>
    </div>
```

- [ ] **Step 7: Inhalt auf Live-Bereich und Bedienung umstellen** (`apps/titler/src/renderer/src/views/OperatorView.tsx`)

Vorher:
```tsx
import { AppShell, Button, cn, Collapsible, SettingsSection, useBrueckenWert } from '@jm/ui';
import {
  DEFAULT_CONFIG,
  type DisplayInfo,
  type GraphicTemplate,
  type TemplateKind,
  type TitlerConfig,
} from '@shared/types';
import { resolveConfigVars, usedVars } from '@shared/vars';
```
Nachher:
```tsx
import { AppShell, useBrueckenWert } from '@jm/ui';
import { DEFAULT_CONFIG, type DisplayInfo, type GraphicTemplate, type TitlerConfig } from '@shared/types';
import { resolveConfigVars } from '@shared/vars';
```
Vorher:
```tsx
import { activeGraphic } from '@/lib/graphic';
import { navGesperrt, zaehlerText } from '@/lib/datalink-anzeige';
```
Nachher:
```tsx
import { activeGraphic } from '@/lib/graphic';
```
Vorher:
```tsx
import { ImportDialog } from './ImportDialog';
import { Einstellungen } from './Einstellungen';
import { ColorField, Field, Slider } from './felder';
import { VerbundZeile } from './KopfMitte';

const TEMPLATES: { key: TemplateKind; label: string }[] = [
  { key: 'lowerthird', label: 'Bauchbinde' },
  { key: 'banner', label: 'Banner' },
  { key: 'ticker', label: 'Ticker' },
  { key: 'graphic', label: 'Grafik' },
];

```
Nachher:
```tsx
import { Bedienung } from './Bedienung';
import { Einstellungen } from './Einstellungen';
import { ImportDialog } from './ImportDialog';
import { VerbundZeile } from './KopfMitte';
import { LiveBereich } from './LiveBereich';

```
Vorher:
```tsx
  const dataSources = state?.status.dataSources ?? [];
  const dataError = state?.status.dataError;
  const entries = state?.status.entries ?? [];
  const activeEntry = state?.status.activeEntry ?? -1;
  // Master-Link Teil 2b (Spec 7.8): stehender Hinweis H1–H7 und Datenquelle (Q1–Q3, K1).
  const hinweis = state?.status.hinweis;
  const datenQuelle = state?.status.datenQuelle;
```
Nachher:
```tsx
  const entries = state?.status.entries ?? [];
  const activeEntry = state?.status.activeEntry ?? -1;
```
Vorher:
```tsx
  const [importParsed, setImportParsed] = useState<{ name: string; template: ParsedTemplate } | null>(null);
  const activeTemplate = templates.find((t) => t.id === config.activeGraphicId);
```
Nachher:
```tsx
  const [importParsed, setImportParsed] = useState<{ name: string; template: ParsedTemplate } | null>(null);
```
Vorher:
```tsx

  // Vorhandene Variablen (klein geschrieben) + im Text referenzierte Schlüssel
  // für die Variablen-Sektion (Treffer/Fehler markieren).
  const lowerVars = useMemo(() => {
    const m: Record<string, true> = {};
    for (const k of Object.keys(variables)) m[k.toLowerCase()] = true;
    return m;
  }, [variables]);
  const referenced = useMemo(() => {
    const set = new Set<string>();
    for (const t of [config.name, config.subtitle, config.bannerText, config.tickerText]) {
      for (const k of usedVars(t)) set.add(k);
    }
    return [...set];
  }, [config.name, config.subtitle, config.bannerText, config.tickerText]);

```
Nachher:
```tsx

```
Vorher:
```tsx
  }
  const c = config;

  // Weiter/Zurück: gesperrt nur an den Rändern; ohne aktiven Eintrag beide frei (Spec 7.4).
  const nav = navGesperrt(activeEntry, entries.length);
```
Nachher:
```tsx
  }
```
Vorher:
```tsx
      settings={<Einstellungen stand={stand} aktionen={aktionen} />}
```
Nachher:
```tsx
      settings={
        <Einstellungen
          stand={stand}
          aktionen={aktionen}
          templates={templates}
          activeGraphicId={config.activeGraphicId}
          onPickImport={() => void pickImport()}
          onDropImport={onDropImport}
          onDeleteTemplate={(tpl) => void deleteTemplate(tpl)}
        />
      }
```
Vorher:
```tsx
        {/* Programm-Vorschau + Take/Clear */}
        <div className="flex-1 min-w-0 flex flex-col p-5 gap-4">
          <div className="cg-checker flex-1 min-h-0 rounded-[var(--radius-lg)] border border-[var(--border)] overflow-hidden grid place-items-center">
            <canvas ref={previewRef} width={960} height={540} className="w-full h-full object-contain" />
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="lg"
              className={cn('flex-1', live && 'ring-2 ring-[var(--primary)]')}
              onClick={take}
            >
              ● Take (On Air)
            </Button>
            <Button variant="outline" size="lg" className="flex-1" onClick={clear}>
              Clear
            </Button>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] -mt-1">
            {ndiActive
              ? 'NDI-Quelle aktiv — in TriCaster/vMix/OBS als Eingang über das vorhandene Programm legen (Alpha/Key).'
              : 'NDI rechts starten, damit die transparente Quelle im Netz erscheint. Vorschau läuft auch ohne NDI.'}
          </p>
        </div>

        {/* Steuerpult (#165): die Bedienung; die Einstellungen stehen im Panel (⚙ oder Statuseintrag, E14). */}
        <div className="w-[400px] shrink-0 overflow-auto border-l border-[var(--border)]/60">
          <div className="p-5 space-y-4">
              <div className="space-y-5">
                {/* Vorlage */}
                <SettingsSection title="Vorlage">
                  <div className="flex gap-2">
                    {TEMPLATES.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => void setConfig({ template: t.key })}
                        className={cn(
                          'flex-1 h-9 rounded-[var(--radius)] text-xs font-extrabold uppercase tracking-wide border',
                          c.template === t.key
                            ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent'
                            : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--highlight)]',
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </SettingsSection>

                {/* Inhalt — Namensfeld: immer sichtbar, nicht ausklappbar (#165) */}
                <SettingsSection title="Inhalt">
                  {c.template === 'lowerthird' && (
                    <>
                      <Field label="Name" value={c.name} onChange={(v) => void setConfig({ name: v })} />
                      <Field label="Untertitel" value={c.subtitle} onChange={(v) => void setConfig({ subtitle: v })} />
                    </>
                  )}
                  {c.template === 'banner' && (
                    <Field label="Banner-Text" value={c.bannerText} onChange={(v) => void setConfig({ bannerText: v })} />
                  )}
                  {c.template === 'ticker' && (
                    <>
                      <Field label="Ticker-Text" value={c.tickerText} onChange={(v) => void setConfig({ tickerText: v })} />
                      <Slider
                        label="Ticker-Tempo"
                        value={c.tickerSpeed}
                        min={0.02}
                        max={0.3}
                        step={0.01}
                        onChange={(v) => void setConfig({ tickerSpeed: v })}
                      />
                    </>
                  )}
                  {c.template === 'graphic' &&
                    (activeTemplate ? (
                      activeTemplate.slots.length === 0 ? (
                        <p className="text-[11px] text-[var(--muted-foreground)]">
                          Diese Vorlage hat keine Textfelder (reines Standbild).
                        </p>
                      ) : (
                        activeTemplate.slots.map((s) => (
                          <Field
                            key={s.key}
                            label={s.label}
                            value={c.slotText[s.key] ?? s.defaultText}
                            onChange={(v) => void setConfig({ slotText: { ...c.slotText, [s.key]: v } })}
                          />
                        ))
                      )
                    ) : (
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        Keine Grafik-Vorlage gewählt — unter „Grafik-Vorlagen" importieren oder auswählen.
                      </p>
                    ))}
                </SettingsSection>

                {/* Grafik-Vorlagen (#162): Import aus jm Grafiktool / PSD */}
                <Collapsible
                  title="Grafik-Vorlagen"
                  persistId="titler.graphics"
                  defaultOpen={false}
                  description={
                    <>
                      Bauchbinden aus dem jm Grafiktool oder als <code>.psd</code> importieren. Textebenen werden zu
                      füllbaren Feldern — Variablen bleiben nutzbar.
                    </>
                  }
                >
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDropImport}
                    className="rounded-[var(--radius)] border border-dashed border-[var(--border)] px-3 py-3 text-center"
                  >
                    <Button variant="outline" size="sm" onClick={() => void pickImport()}>
                      Datei importieren…
                    </Button>
                    <p className="mt-1.5 text-[10px] text-[var(--muted-foreground)]">
                      oder .psd / .jmtitler hierher ziehen
                    </p>
                  </div>
                  {templates.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {templates.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => selectTemplate(t)}
                          className={cn(
                            'group relative rounded-[var(--radius)] border overflow-hidden cursor-pointer',
                            t.id === config.activeGraphicId
                              ? 'border-[var(--primary)] ring-1 ring-[var(--primary)]'
                              : 'border-[var(--border)] hover:bg-[var(--highlight)]',
                          )}
                          title={t.name}
                        >
                          {t.thumbDataUrl ? (
                            <img src={t.thumbDataUrl} alt={t.name} className="cg-checker w-full h-20 object-contain" />
                          ) : (
                            <div className="cg-checker w-full h-20" />
                          )}
                          <div className="flex items-center gap-1 px-2 py-1">
                            <span className="truncate text-[11px] font-semibold">{t.name}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void deleteTemplate(t);
                              }}
                              className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 text-[var(--destructive)] text-xs"
                              title="Vorlage löschen"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[var(--muted-foreground)]">Noch keine Vorlagen importiert.</p>
                  )}
                </Collapsible>

                {/* Daten / Recall (#86/#152): Live-Abruf der DataLink-Einträge.
                    Der Datenordner selbst wird im Reiter „Einstellungen" gewählt. */}
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
                    <p className="text-[11px] text-[var(--muted-foreground)]">
                      Kein Datenordner aktiv. Im Reiter <b>Einstellungen › DataLink</b> einen Ordner wählen — oder den
                      Titler über eine <b>JM Show</b> mit iveo-Daten öffnen. Abrufbare Einträge erscheinen dann hier.
                    </p>
                  ) : dataError ? (
                    <p className="text-[11px] text-[var(--destructive)]">DataLink: {dataError}</p>
                  ) : (
                    <>
                      {/* Abrufbare Einträge (Recall) */}
                      {entries.length > 0 ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
                              {zaehlerText(activeEntry, entries.length)}
                            </span>
                            <div className="ml-auto flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                uppercase={false}
                                onClick={() => void window.jmtitler.openRecall()}
                                title="Recall-Button-Board in eigenem Fenster öffnen (#152)"
                              >
                                ⧉ Board
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                uppercase={false}
                                disabled={nav.zurueck}
                                onClick={() => void window.jmtitler.stepEntry(-1)}
                                title="Vorheriger Eintrag"
                              >
                                ‹
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                uppercase={false}
                                disabled={nav.weiter}
                                onClick={() => void window.jmtitler.stepEntry(1)}
                                title="Nächster Eintrag"
                              >
                                ›
                              </Button>
                            </div>
                          </div>
                          <div className="max-h-40 overflow-auto rounded-[var(--radius)] border border-[var(--border)]/60 divide-y divide-[var(--border)]/40">
                            {entries.map((e, i) => (
                              <button
                                key={e.key}
                                onClick={() => void window.jmtitler.recallSchluessel(e.key)}
                                className={cn(
                                  'flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-xs',
                                  i === activeEntry
                                    ? 'bg-[var(--primary)]/15 text-[var(--foreground)] font-bold'
                                    : 'hover:bg-[var(--highlight)] text-[var(--muted-foreground)]',
                                )}
                              >
                                <span className="tabular text-[10px] w-5 shrink-0 text-[var(--muted-foreground)]">{i + 1}</span>
                                <span className="truncate">{e.label || '—'}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {/* Variablen des aktiven Eintrags */}
                      <div className="rounded-[var(--radius)] border border-[var(--border)]/60 divide-y divide-[var(--border)]/40">
                        {Object.keys(variables).length === 0 ? (
                          <p className="px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
                            Keine Variablen gefunden. Lege im Ordner z. B. eine <code>gaeste.csv</code> mit Kopfzeile
                            <code>name,funktion</code> an — oder eine <code>daten.txt</code> mit <code>name=Dr. Schmidt</code>.
                          </p>
                        ) : (
                          Object.entries(variables).map(([k, v]) => (
                            <div key={k} className="flex items-baseline gap-2 px-3 py-1.5 text-xs">
                              <code className="font-bold text-[var(--primary)] shrink-0">{`{{${k}}}`}</code>
                              <span className="truncate text-[var(--muted-foreground)]">{v || '—'}</span>
                            </div>
                          ))
                        )}
                        {dataSources.length > 0 ? (
                          <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                            Quelle: {dataSources.join(', ')}
                          </p>
                        ) : null}
                      </div>
                    </>
                  )}
                  {referenced.length > 0 ? (
                    <p className="text-[11px] text-[var(--muted-foreground)] flex flex-wrap items-baseline gap-x-1">
                      <span>Im Text verwendet:</span>
                      {referenced.map((k) => (
                        <code
                          key={k}
                          className={cn(
                            k.toLowerCase() in lowerVars ? 'text-[var(--primary)]' : 'text-[var(--destructive)]',
                          )}
                          title={k.toLowerCase() in lowerVars ? 'Variable vorhanden' : 'Variable nicht gefunden'}
                        >
                          {`{{${k}}}`}
                        </code>
                      ))}
                    </p>
                  ) : null}
                </Collapsible>

                {/* Stil */}
                <Collapsible title="Stil" persistId="titler.style" defaultOpen={false}>
                  <div className="flex gap-2">
                    {(['bottom', 'top'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => void setConfig({ position: p })}
                        className={cn(
                          'flex-1 h-9 rounded-[var(--radius)] text-xs font-bold border',
                          c.position === p
                            ? 'bg-[var(--accent)] text-[var(--foreground)] border-transparent'
                            : 'border-[var(--border)] hover:bg-[var(--highlight)]',
                        )}
                      >
                        {p === 'bottom' ? 'Unten' : 'Oben'}
                      </button>
                    ))}
                  </div>
                  <Slider label="Größe" value={c.scale} min={0.6} max={1.6} step={0.05} onChange={(v) => void setConfig({ scale: v })} />
                  <div className="flex gap-3">
                    <ColorField label="Balken" value={c.colors.bar} onChange={(v) => void setConfig({ colors: { bar: v } })} />
                    <ColorField label="Text" value={c.colors.text} onChange={(v) => void setConfig({ colors: { text: v } })} />
                    <ColorField label="Akzent" value={c.colors.accent} onChange={(v) => void setConfig({ colors: { accent: v } })} />
                  </div>
                </Collapsible>
              </div>
          </div>
        </div>
```
Nachher:
```tsx
        <LiveBereich
          previewRef={previewRef}
          live={live}
          ndiActive={ndiActive}
          activeEntry={activeEntry}
          anzahl={entries.length}
          onTake={take}
          onClear={clear}
          onSchritt={(delta) => void window.jmtitler.stepEntry(delta)}
        />
        <Bedienung
          config={config}
          status={state.status}
          templates={templates}
          setConfig={(patch) => void setConfig(patch)}
          onSelectTemplate={selectTemplate}
          onOpenBoard={() => void window.jmtitler.openRecall()}
          onRecall={(key) => void window.jmtitler.recallSchluessel(key)}
        />
```

- [ ] **Step 8: Test laufen lassen (grün)**

```
npm run selftest -w @jm/titler; echo "Exit=$?"
(cd apps/titler && npx tsx --tsconfig tsconfig.test.json test/ui/selftest.ts) > <eigener Scratchpad>/c10-ui.txt 2>&1; echo "Exit=$?"
grep -c "^ok " <eigener Scratchpad>/c10-ui.txt
grep -E "^ok   (liveTasten|LiveBereich|Bedienung|Panel:|Panel ›|Quelltext (OperatorView: Haupt|Bedienung)|Texte: kein)" <eigener Scratchpad>/c10-ui.txt
```
Erwartet (gemessen): `Exit=0` (beide Läufe), alter Lauf 538, Oberflächen-Lauf **111** `ok` (= 76 + 35),
„ALLE TESTS OK“. Die 35 neuen Zeilen:
```
ok   liveTasten: Take und Clear immer, ◀/▶ Eintrag nur mit Einträgen, an den Rändern gesperrt mit Grund; Take nie gesperrt (E12)
ok   liveTasten: Klick ruft onTake, onClear, onSchritt(-1), onSchritt(1)
ok   liveTasten: keine Kürzel, kein Halten (UO5)
ok   LiveBereich: die Vorschau ist das erste Kind des Live-Bereichs, darin zuerst das <canvas>
ok   LiveBereich: Vorschau 960×540 wie bisher
ok   LiveBereich: vier TallyButtons in data-titler="haupttasten", kein <kbd> (höchstens vier, keine Kürzel)
ok   LiveBereich: Hinweiszeile bei NDI aus (T4) bzw. an (wie bisher)
ok   LiveBereich: id-Verweise gültig (Sperrgrund per aria-describedby)
ok   Bedienung: „Vorlage“ und „Inhalt“ immer offen (SettingsSection, kein Collapsible)
ok   Bedienung: Collapsibles „Grafik-Vorlagen“ (zu) und „Daten / Recall“ (offen) wie bisher
ok   Bedienung › Inhalt: Bauchbinde mit Name und Untertitel aus @jm/ui (Field + TextInput, E23)
ok   Bedienung: id-Verweise gültig (Beschriftung → Eingabe)
ok   Bedienung › Inhalt: Grafik-Vorlage mit einem Feld je Slot
ok   Bedienung › Inhalt: Slot-Wert aus slotText, sonst Vorgabetext
ok   Bedienung › Inhalt: ohne gewählte Grafik-Vorlage der Hinweis T6
ok   Bedienung › Inhalt: Grafik-Vorlage ohne Textfelder mit dem Hinweis von heute (Nr. 18)
ok   Bedienung › Inhalt: Banner mit Feld „Banner-Text“, Ticker mit Feld „Ticker-Text“ und Schieber „Ticker-Tempo“ 0,02–0,3 in 0,01 (Nr. 14–16)
ok   Bedienung › Inhalt: jedes Feld schreibt beim Tippen in seinen Schlüssel (Name, Untertitel, Banner-Text, Ticker-Text, Ticker-Tempo, Slots; E23)
ok   Bedienung: Collapsibles merken sich unter jm.collapsible.titler.graphics und …titler.recall (persistId wie bisher)
ok   Bedienung › Grafik-Vorlagen: Kacheln sind <button type="button"> mit aria-pressed (per Tastatur wählbar, E13)
ok   Bedienung › Grafik-Vorlagen: nur wählen; Import und Löschen liegen im Panel
ok   Bedienung › Grafik-Vorlagen: ohne Vorlagen der Hinweis T6
ok   Bedienung › Daten / Recall: Quellzeile, Hinweis, Zähler, ⧉ Board, Liste, Variablen, „Im Text verwendet“; ‹ und › entfallen (E12)
ok   Bedienung › Daten / Recall: Knöpfe = 4 Vorlagen + 2 Collapsibles + ⧉ Board + 3 Einträge
ok   Bedienung › Daten / Recall: der aktive Eintrag trägt aria-current, nicht nur Farbe und Fettung
ok   Bedienung › Daten / Recall: Hinweis-Kasten in Orange (--status-warn), kein Gelb --warning (Spec 4.2, E25)
ok   Bedienung › Daten / Recall: ohne Variablen der Hilfetext von heute (Nr. 36)
ok   Bedienung › Daten / Recall: bei Fehler mit noch geltender Liste stehen Fehlerzeile und Liste zugleich (E21)
ok   Bedienung › Daten / Recall: ohne Datenordner der Hinweis T5
ok   Panel: Abschnitte „Stil“ und „Grafik-Vorlagen“ mit Anker, Import-Knopf und Ablagefläche
ok   Panel › Grafik-Vorlagen: je Vorlage ein Knopf „Löschen“ mit aria-label (T7)
ok   Panel › Grafik-Vorlagen: „Löschen“ immer sichtbar (kein opacity-0, E13)
ok   Quelltext OperatorView: Haupttasten mit Take-Tally aus live (E11), Kacheln, Recall, Board, Import und Löschen unverändert verdrahtet
ok   Quelltext Bedienung: persistId titler.graphics und titler.recall, kein titler.style, kein window
ok   Texte: kein „Reiter“ und kein „rechts starten“ in OperatorView, Bedienung, LiveBereich (Befund 16)
```

- [ ] **Step 9: Typprüfung**

```
npm run typecheck -w @jm/titler; echo "Exit=$?"
```
Erwartet (gemessen): drei `tsc`-Läufe ohne Meldung, `Exit=0`.

- [ ] **Step 10: Bau und Klassen-Probe**

```
npm run build -w @jm/titler; echo "Exit=$?"
(cd packages/ui && npx tsx galerie/pruefe-klassen.ts --css ../../apps/titler/out/renderer/assets) | grep -cE "^ok"
```
Erwartet (gemessen): Bau `Exit=0`; Klassen-Probe `20`.

- [ ] **Step 11: Gegenproben** (je eine Ersetzung allein mit dem Edit-Werkzeug, Oberflächen-Lauf, danach zurück; nicht committen)

Lauf je Probe wie in C9 Step 13.

a) „◀ Eintrag“ an Position 0 frei:
Datei `apps/titler/src/renderer/src/views/LiveBereich.tsx`, Probe:
```tsx
    tasten.push({ ...t.eintrag.zurueck, label: TITLER_TEXTE.zurueck, onClick: () => p.onSchritt(-1) });
```
wird zu:
```tsx
    tasten.push({ state: 'bereit', label: TITLER_TEXTE.zurueck, onClick: () => p.onSchritt(-1) });
```
Erwartet (gemessen):
```
Exit=1
FAIL liveTasten: Take und Clear immer, ◀/▶ Eintrag nur mit Einträgen, an den Rändern gesperrt mit Grund; Take nie gesperrt (E12)
     ist: [["Take:bereit","Clear:bereit"],["Take:live","Clear:bereit"],["Take:bereit","Clear:bereit","◀ Eintrag:bereit","Eintrag ▶:bereit"],["Take:live","Clear:bereit","◀ Eintrag:bereit","Eintrag ▶:gesperrt(Letzter Eintrag)"],["Take:bereit","Clear:bereit","◀ Eintrag:bereit","Eintrag ▶:bereit"],["Take:bereit","Clear:bereit","◀ Eintrag:bereit","Eintrag ▶:gesperrt(Letzter Eintrag)"]] soll: [["Take:bereit","Clear:bereit"],["Take:live","Clear:bereit"],["Take:bereit","Clear:bereit","◀ Eintrag:gesperrt(Erster Eintrag)","Eintrag ▶:bereit"],["Take:live","Clear:bereit","◀ Eintrag:bereit","Eintrag ▶:gesperrt(Letzter Eintrag)"],["Take:bereit","Clear:bereit","◀ Eintrag:bereit","Eintrag ▶:bereit"],["Take:bereit","Clear:bereit","◀ Eintrag:gesperrt(Erster Eintrag)","Eintrag ▶:gesperrt(Letzter Eintrag)"]]
1 FEHLGESCHLAGEN
```
b) `persistId` `titler.recall2`:
Datei `apps/titler/src/renderer/src/views/Bedienung.tsx`, Probe:
```tsx
persistId="titler.recall"
```
wird zu:
```tsx
persistId="titler.recall2"
```
Erwartet (gemessen):
```
Exit=1
FAIL Bedienung: Collapsibles merken sich unter jm.collapsible.titler.graphics und …titler.recall (persistId wie bisher)
     ist: [["Grafik-Vorlagen:true","Daten / Recall:true"],["Grafik-Vorlagen:false","Daten / Recall:true"]] soll: [["Grafik-Vorlagen:true","Daten / Recall:false"],["Grafik-Vorlagen:false","Daten / Recall:true"]]
FAIL Quelltext Bedienung: persistId titler.graphics und titler.recall, kein titler.style, kein window
2 FEHLGESCHLAGEN
```
c) Eine fünfte Taste:
Datei `apps/titler/src/renderer/src/views/LiveBereich.tsx`, Probe:
```tsx
        {liveTasten(p).map((taste) => (
```
wird zu:
```tsx
        <TallyButton state="bereit" label="Extra" />
        {liveTasten(p).map((taste) => (
```
Erwartet (gemessen):
```
Exit=1
FAIL LiveBereich: vier TallyButtons in data-titler="haupttasten", kein <kbd> (höchstens vier, keine Kürzel)
     ist: [5,5,false] soll: [4,4,false]
1 FEHLGESCHLAGEN
```
d) Liste bei `dataError` ausgeblendet (wie vor E21):
Datei `apps/titler/src/renderer/src/views/Bedienung.tsx`, Probe:
```tsx
              {entries.length > 0 ? (
```
wird zu:
```tsx
              {entries.length > 0 && !dataError ? (
```
Erwartet (gemessen):
```
Exit=1
FAIL Bedienung › Daten / Recall: bei Fehler mit noch geltender Liste stehen Fehlerzeile und Liste zugleich (E21)
1 FEHLGESCHLAGEN
```
e) Take-Tally an NDI statt an der Engine-Größe `live`:
Datei `apps/titler/src/renderer/src/views/OperatorView.tsx`, Probe:
```tsx
          live={live}
```
wird zu:
```tsx
          live={ndiActive}
```
Erwartet (gemessen):
```
Exit=1
FAIL Quelltext OperatorView: Haupttasten mit Take-Tally aus live (E11), Kacheln, Recall, Board, Import und Löschen unverändert verdrahtet
     fehlt: live={live}
1 FEHLGESCHLAGEN
```
f) Hinweis-Kasten wieder gelb:
Datei `apps/titler/src/renderer/src/views/Bedienung.tsx`, Probe:
```tsx
border border-[var(--status-warn)]/50 bg-[var(--status-warn)]/15
```
wird zu:
```tsx
border border-[var(--warning)]/50 bg-[var(--warning)]/15
```
Erwartet (gemessen):
```
Exit=1
FAIL Bedienung › Daten / Recall: Hinweis-Kasten in Orange (--status-warn), kein Gelb --warning (Spec 4.2, E25)
1 FEHLGESCHLAGEN
```
g) Aktiver Eintrag ohne `aria-current`:
Datei `apps/titler/src/renderer/src/views/Bedienung.tsx`, Probe:
```tsx
                        aria-current={i === activeEntry ? 'true' : undefined}
```
wird zu:
```tsx
(Zeile entfernt)
```
Erwartet (gemessen):
```
Exit=1
FAIL Bedienung › Daten / Recall: der aktive Eintrag trägt aria-current, nicht nur Farbe und Fettung
     ist: ["1:-","2:-","3:-"] soll: ["1:-","2:aktiv","3:-"]
1 FEHLGESCHLAGEN
```
h) Banner-Zweig weggelassen (Nr. 14):
Datei `apps/titler/src/renderer/src/views/Bedienung.tsx`, Probe:
```tsx
          {c.template === 'banner' && (
```
wird zu:
```tsx
          {c.template === 'bannerX' && (
```
Erwartet (gemessen; `tsx` prüft keine Typen, der Vergleich mit einem unbekannten Namen ist nur zur Laufzeit falsch):
```
Exit=1
FAIL Bedienung › Inhalt: Banner mit Feld „Banner-Text“, Ticker mit Feld „Ticker-Text“ und Schieber „Ticker-Tempo“ 0,02–0,3 in 0,01 (Nr. 14–16)
     ist: [[],[],["Ticker-Text"],true,["0.02","0.3","0.01","0.12"]] soll: [["Banner-Text"],["Eilmeldung"],["Ticker-Text"],true,["0.02","0.3","0.01","0.12"]]
FAIL Bedienung › Inhalt: jedes Feld schreibt beim Tippen in seinen Schlüssel (Name, Untertitel, Banner-Text, Ticker-Text, Ticker-Tempo, Slots; E23)
     ist: ["Name: {\"name\":\"Neu\"}","Untertitel: {\"subtitle\":\"Neu\"}","Ticker-Text: {\"tickerText\":\"Neu\"}","Ticker-Tempo: {\"tickerSpeed\":0.25}","Name-Ebene: {\"slotText\":{\"name\":\"Neu\"}}","Rolle-Ebene: {\"slotText\":{\"name\":\"Anna\",\"rolle\":\"Neu\"}}"] soll: ["Name: {\"name\":\"Neu\"}","Untertitel: {\"subtitle\":\"Neu\"}","Banner-Text: {\"bannerText\":\"Neu\"}","Ticker-Text: {\"tickerText\":\"Neu\"}","Ticker-Tempo: {\"tickerSpeed\":0.25}","Name-Ebene: {\"slotText\":{\"name\":\"Neu\"}}","Rolle-Ebene: {\"slotText\":{\"name\":\"Anna\",\"rolle\":\"Neu\"}}"]
2 FEHLGESCHLAGEN
```
i) Text „Diese Vorlage hat keine Textfelder …“ weggelassen (Nr. 18):
Datei `apps/titler/src/renderer/src/views/Bedienung.tsx`, Probe:
```tsx
                <p className="text-[11px] text-[var(--muted-foreground)]">Diese Vorlage hat keine Textfelder (reines Standbild).</p>
```
wird zu:
```tsx
                <p className="text-[11px] text-[var(--muted-foreground)]" />
```
Erwartet (gemessen):
```
Exit=1
FAIL Bedienung › Inhalt: Grafik-Vorlage ohne Textfelder mit dem Hinweis von heute (Nr. 18)
     fehlt: Diese Vorlage hat keine Textfelder (reines Standbild).
1 FEHLGESCHLAGEN
```
j) Variablen-Hilfetext weggelassen (Nr. 36):
Datei `apps/titler/src/renderer/src/views/Bedienung.tsx`, Probe:
```tsx
                      Keine Variablen gefunden. Lege im Ordner z. B. eine <code>gaeste.csv</code> mit Kopfzeile
```
wird zu:
```tsx
                      Lege im Ordner z. B. eine <code>gaeste.csv</code> mit Kopfzeile
```
Erwartet (gemessen):
```
Exit=1
FAIL Bedienung › Daten / Recall: ohne Variablen der Hilfetext von heute (Nr. 36)
     fehlt: Keine Variablen gefunden. Lege im Ordner z. B. eine gaeste.csv mit Kopfzeile
1 FEHLGESCHLAGEN
```
k) Feld „Banner-Text“ schreibt in den falschen Schlüssel (Restlücke R3):
Datei `apps/titler/src/renderer/src/views/Bedienung.tsx`, Probe:
```tsx
              <TextInput value={c.bannerText} onChange={(v) => p.setConfig({ bannerText: v })} />
```
wird zu:
```tsx
              <TextInput value={c.bannerText} onChange={(v) => p.setConfig({ subtitle: v })} />
```
Erwartet (gemessen):
```
Exit=1
FAIL Bedienung › Inhalt: jedes Feld schreibt beim Tippen in seinen Schlüssel (Name, Untertitel, Banner-Text, Ticker-Text, Ticker-Tempo, Slots; E23)
     ist: ["Name: {\"name\":\"Neu\"}","Untertitel: {\"subtitle\":\"Neu\"}","Banner-Text: {\"subtitle\":\"Neu\"}","Ticker-Text: {\"tickerText\":\"Neu\"}","Ticker-Tempo: {\"tickerSpeed\":0.25}","Name-Ebene: {\"slotText\":{\"name\":\"Neu\"}}","Rolle-Ebene: {\"slotText\":{\"name\":\"Anna\",\"rolle\":\"Neu\"}}"] soll: ["Name: {\"name\":\"Neu\"}","Untertitel: {\"subtitle\":\"Neu\"}","Banner-Text: {\"bannerText\":\"Neu\"}","Ticker-Text: {\"tickerText\":\"Neu\"}","Ticker-Tempo: {\"tickerSpeed\":0.25}","Name-Ebene: {\"slotText\":{\"name\":\"Neu\"}}","Rolle-Ebene: {\"slotText\":{\"name\":\"Anna\",\"rolle\":\"Neu\"}}"]
1 FEHLGESCHLAGEN
```
l) Schieber „Ticker-Tempo“ schreibt nichts (Restlücke R3):
Datei `apps/titler/src/renderer/src/views/Bedienung.tsx`, Probe:
```tsx
                onChange={(v) => p.setConfig({ tickerSpeed: v })}
```
wird zu:
```tsx
                onChange={() => undefined}
```
Erwartet (gemessen):
```
Exit=1
FAIL Bedienung › Inhalt: jedes Feld schreibt beim Tippen in seinen Schlüssel (Name, Untertitel, Banner-Text, Ticker-Text, Ticker-Tempo, Slots; E23)
     ist: ["Name: {\"name\":\"Neu\"}","Untertitel: {\"subtitle\":\"Neu\"}","Banner-Text: {\"bannerText\":\"Neu\"}","Ticker-Text: {\"tickerText\":\"Neu\"}","Ticker-Tempo: nichts","Name-Ebene: {\"slotText\":{\"name\":\"Neu\"}}","Rolle-Ebene: {\"slotText\":{\"name\":\"Anna\",\"rolle\":\"Neu\"}}"] soll: ["Name: {\"name\":\"Neu\"}","Untertitel: {\"subtitle\":\"Neu\"}","Banner-Text: {\"bannerText\":\"Neu\"}","Ticker-Text: {\"tickerText\":\"Neu\"}","Ticker-Tempo: {\"tickerSpeed\":0.25}","Name-Ebene: {\"slotText\":{\"name\":\"Neu\"}}","Rolle-Ebene: {\"slotText\":{\"name\":\"Anna\",\"rolle\":\"Neu\"}}"]
1 FEHLGESCHLAGEN
```
Nach jeder Probe zurückbauen; danach zeigt `git diff --stat` nur die Dateien dieser Aufgabe.

- [ ] **Step 12: Zeilenenden prüfen**

```
node -e "for (const f of process.argv.slice(1)) { const t = require('fs').readFileSync(f, 'utf8'); const n = (t.match(/\n/g) || []).length, c = (t.match(/\r\n/g) || []).length; console.log(f, n, c, c === 0 || c === n ? 'einheitlich' : 'GEMISCHT'); }" apps/titler/src/renderer/src/views/Bedienung.tsx apps/titler/src/renderer/src/views/Einstellungen.tsx apps/titler/src/renderer/src/views/LiveBereich.tsx apps/titler/src/renderer/src/views/OperatorView.tsx apps/titler/test/ui/live.test.tsx apps/titler/test/ui/rahmen.test.tsx apps/titler/test/ui/selftest.ts
```
Erwartet (gemessen):
```
apps/titler/src/renderer/src/views/Bedienung.tsx 265 0 einheitlich
apps/titler/src/renderer/src/views/Einstellungen.tsx 291 0 einheitlich
apps/titler/src/renderer/src/views/LiveBereich.tsx 50 0 einheitlich
apps/titler/src/renderer/src/views/OperatorView.tsx 255 255 einheitlich
apps/titler/test/ui/live.test.tsx 361 0 einheitlich
apps/titler/test/ui/rahmen.test.tsx 240 0 einheitlich
apps/titler/test/ui/selftest.ts 10 0 einheitlich
```

- [ ] **Step 13: Commit**

```
git add apps/titler/src/renderer/src/views/Bedienung.tsx apps/titler/src/renderer/src/views/Einstellungen.tsx apps/titler/src/renderer/src/views/LiveBereich.tsx apps/titler/src/renderer/src/views/OperatorView.tsx apps/titler/test/ui/live.test.tsx apps/titler/test/ui/rahmen.test.tsx apps/titler/test/ui/selftest.ts
git status --short
```
Erwartet:
```
A  apps/titler/src/renderer/src/views/Bedienung.tsx
M  apps/titler/src/renderer/src/views/Einstellungen.tsx
A  apps/titler/src/renderer/src/views/LiveBereich.tsx
M  apps/titler/src/renderer/src/views/OperatorView.tsx
A  apps/titler/test/ui/live.test.tsx
M  apps/titler/test/ui/rahmen.test.tsx
M  apps/titler/test/ui/selftest.ts
```
Dann:
```
git commit -m "feat(titler): Live-Bereich mit vier Haupttasten und Bedienung nach Anhang A" -m "UX-Pilot C10 (Spec 3.4, 5.1, Anhang A Titler; E12, E13, E21, E23): Die CG-Vorschau bleibt das erste canvas, darunter Take, Clear und mit Eintraegen Zurueck/Weiter als TallyButtons (Raender gesperrt mit Grund, keine Kuerzel) und die Hinweiszeile. Die Bedienung zeigt Vorlage und Inhalt (Field und TextInput aus @jm/ui) immer offen, Grafik-Vorlagen als Kacheln (button mit aria-pressed) und Daten / Recall mit den bisherigen persistId; bei Fehler bleibt eine noch geltende Liste stehen; der aktive Eintrag traegt aria-current, der Hinweis-Kasten ist orange (status-warn). Stil und Grafik-Vorlagen-Import mit sichtbarem Loeschen ziehen ins Panel. Tests auch fuer Banner, Ticker, Vorlage ohne Textfelder, Variablen-Hilfetext, die Verdrahtung jedes Felds (onChange auf den richtigen Schluessel) und das Take-Tally aus live. Gegenproben a-l." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Die tool-eigenen Panel-Abschnitte „Stil“ und „Grafik-Vorlagen“ entstehen schon in C10 (Gerüst: C11). Sonst wären Stil,
  Import und Löschen zwischen C10 und C11 nicht erreichbar (Funktionsverlust nach einem Zwischenschritt); C11 baut nur die
  fünf gemeinsamen Abschnitte neu und lässt diese beiden stehen. Die Props von `Einstellungen` haben deshalb schon ab C10
  die Register-Form, und `rahmen.test.tsx` übergibt sie (Step 2).
- Der Test „kein „Reiter“, kein „rechts starten““ prüft in C10 `OperatorView.tsx`, `Bedienung.tsx` und `LiveBereich.tsx`:
  `Einstellungen.tsx` trägt bis C11 die alten Texte Nr. 42 und Nr. 49. C11 prüft alle `views/*.tsx`.
- Die vier Vorlagen-Knöpfe und die Lage-Knöpfe im Stil bekommen `type="button"` und `aria-pressed` wie die Kacheln.
- Das Vorschaubild einer Kachel hat `alt=""` (der Name steht sichtbar daneben und im `title`).
- Nachbesserung nach der Plan-Prüfung (Befunde robust:2, robust:8, spec:2, funktionsliste:2): Wächter `live={live}`,
  `aria-current` am aktiven Eintrag, Hinweis-Kasten in `--status-warn` (E25) und Render-Tests für Banner, Ticker, Vorlage
  ohne Textfelder und den Variablen-Hilfetext; Gegenproben e) bis j).
- Letzte Nachbesserung (Restlücke R3, NB34): Gerendert war nur, dass die Felder da sind; ein Feld, das in den falschen
  Schlüssel schreibt oder gar nicht, blieb grün. Der Test ruft jetzt das `onChange` jedes Felds der Bedienung auf (Name,
  Untertitel, Banner-Text, Ticker-Text, Ticker-Tempo, die zwei Slots einer Grafik-Vorlage) und vergleicht den Patch an
  `setConfig`; ohne Browser über den Baum, den `Bedienung` zurückgibt. Gegenproben k) und l).
- Zählstand (in der letzten Nachbesserung gemessen): Oberflächen-Lauf 111 `ok` (76 + 35), ebenso die Gegenproben a–l.

---
### Task 11: C11 · Einstellungs-Panel aus `@jm/settings` und tool-eigene Abschnitte

**Spec:** 3.6 (Panel, Sprung aus der Statusleiste), 5.1 (Einstellungen im Panel), 6 (Abschnitte aus `@jm/settings`,
`locked`, ausblenden statt ausgrauen), 10 (Pflichtpunkt Panel-Tasten, Owner-Entscheid O1), Anhang A „Titler“ ›
„Einstellungen“. Entscheidungen E6–E10 (Abschnitts-Props aus C8), E13 (tool-eigene Abschnitte), E20 (ids = Anker), E24
(feste Abschnittstexte statt der Hilfetexte der alten Reiter); OF3, OF4, OF5, OF7. Global Constraints G1, G5, G7, G8, G9,
G10, G11, G12. Review Focus 2, 3 und 5.

**Voraussetzung:** Plan-Worktree nach C10: `npm run selftest -w @jm/titler` grün (Oberflächen-Lauf 111 `ok`). Aus C6
die additiven Props von `DataLinkSection` (`externeQuelle`, `eintraege`, `onClearFolder`, `capabilities.ordnerText`,
`onFolderText`) und `ScreenOutputSection` (`backgroundDefault`, `capabilities.backgroundPicker`), aus C8 die fünf
`…Abschnitt`-Funktionen.

**Dateien:**
- Modify: `apps/titler/src/renderer/src/views/Einstellungen.tsx` (neu gebaut: fünf Abschnitte aus `@jm/settings`, danach
  „Stil“ und „Grafik-Vorlagen“ unverändert aus C10)
- Modify: `apps/titler/src/renderer/src/views/felder.tsx` (`Field` und `Labeled` entfallen; `Slider` und `ColorField`
  bleiben)
- Create: `apps/titler/test/ui/panel.test.tsx`
- Modify: `apps/titler/test/ui/selftest.ts` (Import-Zeile direkt vor `abschluss();`)

**Interfaces:**
- Consumes:
  ```ts
  // S-B4 (C8) · lib/oberflaeche.ts
  export function iveoAbschnitt(s: OberflaechenStand): IveoSectionProps;
  export function ndiAbschnitt(s: OberflaechenStand, a: TitlerAktionen): NdiOutputSectionProps;
  export function bildschirmAbschnitt(s: OberflaechenStand, a: TitlerAktionen): ScreenOutputSectionProps;
  export function fernsteuerungAbschnitt(s: OberflaechenStand): RemoteControlSectionProps;
  export function dataLinkAbschnitt(s: OberflaechenStand, a: TitlerAktionen): DataLinkSectionProps;
  export const ABSCHNITT; export const TITLER_TEXTE; export function statusLeiste(s: OberflaechenStand): StatusItem[];
  // @jm/settings: IveoSection, NdiOutputSection, ScreenOutputSection, RemoteControlSection, DataLinkSection (je mit
  // SectionFrame → PanelAnker id = props.id); Fundament: panelTaste aus packages/ui/src/components/SettingsPanel.tsx (O1)
  // @shared/datenquelle: ordnerWahlGesperrt (der R2-Satz, mit dem der Main datenQuelle.ordnerGesperrt setzt)
  ```
- Produces (Register S-C, exakt): `Einstellungen(p: EinstellungenProps)` wie in C10, jetzt ohne `useEffect` und ohne
  `window`, mit den Abschnitten in der Folge iveo, NDI-Ausgabe, Ausgabe auf Bildschirm, Fernsteuerung, DataLink, Stil,
  Grafik-Vorlagen; `views/felder.tsx` exportiert nur noch `Slider` und `ColorField`.

**Verhalten (verbindlich):**
- Jeder gemeinsame Abschnitt bekommt genau die Props aus C8 (`<IveoSection {...iveoAbschnitt(stand)} />` usw.): dieselbe
  Ableitung wie die Statusleiste, eine Wahrheit (Spec 6.1). Die Anker `einstellung-{id}` setzen die Abschnitte selbst
  (`SectionFrame` → `PanelAnker`); jedes `settingsSection` der Statusleiste (iveo, ndi, bildschirm, fernsteuerung,
  datalink) findet seinen Anker, der Master-Eintrag springt nicht (E4).
- DataLink (E10, OF4, OF7): Bei Quelle `master` steht „Gesperrt: “ + R2-Satz wörtlich; Pfadfeld, „Ordner wählen …“ und
  „Ordner entfernen“ stehen sichtbar gesperrt da. Bei Quelle `show` mit eigenem Ordner gibt es K1. Der Pfad wird bei Enter
  bzw. Verlassen übernommen, nicht je Tastendruck (Befund 5 entfällt). Ein DataLink-Fehler steht im Abschnitt, auf den der
  Statuseintrag springt: „Fehler: …“ im Kopf und ⚠ mit dem Text unter den Feldern; „Ordner nicht gefunden“ heißt dort
  „Ordner fehlt“ (E10, gerendert geprüft).
- Fernsteuerung (E6, OF2, OF5): Status, Modus, Port (8726 bzw. gemeldet), „Verbunden“ nur bei laufendem Server, der feste
  Companion-Satz mit „jm-suite“; kein „Im Launcher einrichten“.
- iveo (E9, OF5): „Das Zugriffstoken bleibt im Launcher.“, kein Token-Feld, kein Launcher-Knopf. NDI (E7): Schalter
  „Ausgabe“, Quellenname (Übernahme bei Enter/Verlassen), Auflösung, Bildrate. Bildschirm (E8, OF3): Schalter, Auswahl,
  Hintergrund mit Farbwähler, „Standardfarbe (#00B140)“; der Tipp kommt aus dem Abschnitt (E24). Solange die Monitorliste
  nicht geladen ist (`displays` undefined), zeigt der Abschnitt „unbekannt“ statt einer leeren Auswahl (E8, gerendert
  geprüft).
- Die Hilfetexte der alten Reiter (Nr. 42, 49, 55, 60) entfallen zugunsten der festen Abschnittstexte (E24); damit steht in
  keiner `views/*.tsx` mehr „Reiter“ oder „rechts starten“. Das Dateiformat des DataLink und den Weg zu iveo erklärt danach
  nur noch das Handbuch (E24, Funktionsliste Nr. 42 und 49).
- G8: `Einstellungen.tsx` hat kein `useEffect` und kein `window.`; Fernsteuer-Befehle, Show-Vorlagen-Import, `reportState`
  und Monitorliste bleiben in `OperatorView.tsx` und laufen bei zugeklapptem Panel.
- Pflichtpunkt Panel (Nr. 96, O1): Der NDI-Schalter ist ein `<button role="switch">`. Der Titler hat keinen Tastenhandler
  (`keydown`, `onKeyDown`, `globalShortcut`, `before-input-event` kommen in `apps/titler/src` nicht vor); `panelTaste` lässt
  die Leertaste auf einem Schalter unberührt (sie löst ihn nativ aus), Escape schließt das Panel, ein Textfeld behält die
  Leertaste.

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (Neue Datei `apps/titler/test/ui/panel.test.tsx`)

```tsx
// UX-Pilot C11 · Einstellungs-Panel (Spec 3.6, 5.1, 6, 10; Anhang A „Titler“ › Einstellungen; E6–E10, E13, E24; OF3,
// OF4, OF5, OF7): fünf Abschnitte aus @jm/settings mit den Props aus lib/oberflaeche.ts, dahinter „Stil“ und
// „Grafik-Vorlagen“. Jeder Statuseintrag mit Panel-Abschnitt findet seinen Anker. Render ohne Browser und ohne window.
import { readdirSync } from 'node:fs';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { ordnerWahlGesperrt, type QuellZustand } from '@shared/datenquelle';
import { statusLeiste, TITLER_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';
import { Einstellungen } from '@/views/Einstellungen';
import { panelTaste } from '../../../../packages/ui/src/components/SettingsPanel';
import { attr, basisConfig, basisStand, basisStatus, eintraege, MONITORE, ohneKommentare, protokollAktionen, tags, text, VORLAGEN } from './testzustand';

const nichts = (): void => undefined;
function panel(stand: OberflaechenStand, log: string[] = []): string {
  return render(
    <Einstellungen
      stand={stand}
      aktionen={protokollAktionen(log)}
      templates={VORLAGEN}
      activeGraphicId="v1"
      onPickImport={() => void log.push('onPickImport')}
      onDropImport={() => void log.push('onDropImport')}
      onDeleteTemplate={(t) => void log.push(`onDeleteTemplate ${t.id}`)}
    />,
  );
}
/** Der Abschnitt mit dem Anker einstellung-{id}: vom Anker bis zum nächsten Anker (bzw. bis zum Ende). */
function abschnitt(html: string, id: string): string {
  const a = html.indexOf(`id="einstellung-${id}"`);
  if (a < 0) return '';
  const b = html.indexOf('id="einstellung-', a + 1);
  return html.slice(a, b < 0 ? undefined : b);
}
const titel = (html: string): string[] => [...html.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]);
const MASTER: QuellZustand = { art: 'master', showPfad: null, showName: 'Gala', quellHinweis: null, master: { masterId: 'm1', masterName: 'Regie-PC', schluessel: null } };

// ── Reihenfolge und Anker ──
{
  const log: string[] = [];
  const stand = basisStand({ displays: MONITORE });
  const html = panel(stand, log);
  gleich(
    titel(html),
    ['iveo', 'NDI-Ausgabe', 'Ausgabe auf Bildschirm', 'Fernsteuerung', 'DataLink', TITLER_TEXTE.stil, TITLER_TEXTE.vorlagen],
    'Panel: Abschnitte iveo, NDI-Ausgabe, Ausgabe auf Bildschirm, Fernsteuerung, DataLink, Stil, Grafik-Vorlagen (Anhang A)',
  );
  const ziele = statusLeiste(stand)
    .map((i) => i.settingsSection)
    .filter((z): z is string => typeof z === 'string');
  gleich(
    ziele.filter((z) => !html.includes(`id="einstellung-${z}"`)),
    [],
    'Panel: jeder Statuseintrag mit Abschnitt (iveo, ndi, bildschirm, fernsteuerung, datalink) findet seinen Anker (E20)',
  );
  gleich(ziele.length, 5, 'Panel: fünf Statuseinträge springen ins Panel, der Master-Eintrag nicht (E4)');
  pruefeIdVerweise(html, 'Panel: id-Verweise gültig (Beschriftungen, Hinweise, Sperrgründe)');
  gleich(log, [], 'Panel: Rendern löst keine Aktion aus');
}

// ── Verbund: DataLink gesperrt bei Quelle master (R2-Satz, OF7), K1 bei Quelle show ──
{
  const satz = ordnerWahlGesperrt(MASTER) ?? '';
  const master = basisStand({
    config: basisConfig({ dataFolder: 'D:\\Daten' }),
    status: basisStatus({
      entries: eintraege(3),
      datenQuelle: { art: 'master', zeile: 'Quelle: Show vom Master „Gala“', zurueckKnopf: null, ohneOrdner: false, ordnerGesperrt: satz },
    }),
  });
  const dl = abschnitt(panel(master), 'datalink');
  ok(
    satz.startsWith('Im Verbund kommen die Speaker vom Master „Regie-PC“.') && text(dl).includes(`Gesperrt: ${satz}`),
    'Panel › DataLink bei Quelle master: „Gesperrt: Im Verbund kommen die Speaker vom Master „…“ …“ (R2-Satz wörtlich, OF7)',
  );
  const bedien = [...tags(dl, 'button'), ...tags(dl, 'input')];
  gleich(
    [bedien.length, bedien.filter((t) => attr(t, 'disabled') !== undefined).length],
    [3, 3],
    'Panel › DataLink bei Quelle master: Ordnerpfad, „Ordner wählen …“ und „Ordner entfernen“ stehen da und sind gesperrt',
  );
  const show = basisStand({
    config: basisConfig({ dataFolder: 'D:\\Daten' }),
    status: basisStatus({
      entries: eintraege(3),
      datenQuelle: { art: 'show', zeile: 'Quelle: Show „Probe“ · 3 Speaker', zurueckKnopf: 'Zurück zum eigenen Ordner (Daten)', ohneOrdner: false },
    }),
  });
  const log: string[] = [];
  const k1 = render(
    <Einstellungen
      stand={show}
      aktionen={protokollAktionen(log)}
      templates={[]}
      activeGraphicId=""
      onPickImport={nichts}
      onDropImport={nichts}
      onDeleteTemplate={nichts}
    />,
  );
  const knopf = tags(abschnitt(k1, 'datalink'), 'button').filter((t) => attr(t, 'disabled') === undefined);
  ok(
    text(abschnitt(k1, 'datalink')).includes('Zurück zum eigenen Ordner (Daten)') && knopf.length === 3 && !text(k1).includes('Gesperrt:'),
    'Panel › DataLink bei Quelle show mit eigenem Ordner: K1 „Zurück zum eigenen Ordner (…)“, nichts gesperrt',
  );
  // Der Statuseintrag DataLink springt bei einem Fehler hierher: Der Abschnitt zeigt ihn im Kopf und unter den Feldern (E10).
  const mitFehler = (dataError: string): unknown => {
    const dl = abschnitt(panel(basisStand({ config: basisConfig({ dataFolder: 'D:\\Daten' }), status: basisStatus({ dataError, datenQuelle: { art: 'ordner', zeile: '', zurueckKnopf: null, ohneOrdner: false } }) })), 'datalink');
    const pille = tags(dl, 'span').find((t) => attr(t, 'data-state') !== undefined);
    const zeile = /<p data-fehler="true"[^>]*>([\s\S]*?)<\/p>/.exec(dl);
    return [attr(pille, 'data-state'), text(dl).includes(dataError === 'Ordner nicht gefunden' ? 'Ordner fehlt' : `Fehler: ${dataError}`), zeile ? text(zeile[1]) : null];
  };
  gleich(
    [mitFehler('EACCES: permission denied'), mitFehler('Ordner nicht gefunden')],
    [
      ['error', true, '⚠ EACCES: permission denied'],
      ['error', true, null],
    ],
    'Panel › DataLink mit Fehler: „Fehler: …“ im Kopf und ⚠ mit dem Text unter den Feldern; „Ordner nicht gefunden“ als „Ordner fehlt“ (E10)',
  );
}

// ── Abschnitte im Einzelnen ──
{
  const stand = basisStand({
    displays: MONITORE,
    status: basisStatus({ fernsteuerung: { laeuft: true, port: 8726, clients: 2, modus: 'open' } }),
  });
  const html = panel(stand);
  const fs = text(abschnitt(html, 'fernsteuerung'));
  ok(
    fs.includes('8726') && fs.includes('„jm-suite“') && fs.includes('bereit · 2 verbunden') && !fs.includes('Im Launcher einrichten'),
    'Panel › Fernsteuerung: Port 8726, Companion-Modul „jm-suite“, „bereit · 2 verbunden“, ohne „Im Launcher einrichten“ (E6, OF5)',
  );
  const iv = abschnitt(html, 'iveo');
  ok(
    text(iv).includes('Das Zugriffstoken bleibt im Launcher.') && tags(iv, 'input').length === 0 && !text(iv).includes('Im Launcher einrichten'),
    'Panel › iveo: „Das Zugriffstoken bleibt im Launcher.“, kein Token-Feld, kein Launcher-Knopf (E9, OF5)',
  );
  const ndi = abschnitt(html, 'ndi');
  const labels = (h: string): string[] => [...h.matchAll(/<label for="[^"]+"[^>]*>([^<]*)<\/label>/g)].map((m) => m[1]);
  gleich(
    [labels(ndi), tags(ndi, 'button').map((t) => attr(t, 'role'))],
    [['Ausgabe', 'Quellenname', 'Auflösung', 'Bildrate'], ['switch']],
    'Panel › NDI-Ausgabe: Schalter „Ausgabe“, Quellenname, Auflösung, Bildrate (E7)',
  );
  const bs = abschnitt(html, 'bildschirm');
  ok(
    labels(bs).join('|') === 'Ausgabe|Bildschirm|Hintergrund' &&
      tags(bs, 'input').some((t) => attr(t, 'type') === 'color') &&
      text(bs).includes('Standardfarbe (#00B140)') &&
      tags(bs, 'option').length === 3,
    'Panel › Ausgabe auf Bildschirm: Schalter, Auswahl (automatisch + 2 Monitore), Hintergrund mit Farbwähler, „Standardfarbe (#00B140)“ (E8, OF3)',
  );
  const stil = abschnitt(html, 'stil');
  ok(
    ['Unten', 'Oben', 'Größe', 'Balken', 'Text', 'Akzent'].every((t) => text(stil).includes(t)) &&
      tags(stil, 'input').filter((t) => attr(t, 'type') === 'color').length === 3 &&
      tags(stil, 'input').filter((t) => attr(t, 'type') === 'range').length === 1,
    'Panel › Stil: „Unten“, „Oben“, Größe und drei Farben (Nr. 38–41)',
  );
  const gv = abschnitt(html, 'vorlagen');
  ok(
    text(gv).includes('Datei importieren…') &&
      text(gv).includes('oder .psd / .jmtitler hierher ziehen') &&
      text(gv).includes('Textebenen werden zu füllbaren Feldern') &&
      !gv.includes('opacity-0'),
    'Panel › Grafik-Vorlagen: „Datei importieren…“, Ablagefläche, Beschreibung (Nr. 20); „Löschen“ sichtbar (kein opacity-0, E13)',
  );
  gleich(
    tags(gv, 'button')
      .filter((t) => attr(t, 'aria-label')?.startsWith('Vorlage „'))
      .map((t) => attr(t, 'aria-label')),
    VORLAGEN.map((v) => TITLER_TEXTE.loeschenAria(v.name)),
    'Panel › Grafik-Vorlagen: je Vorlage „Löschen“ mit aria-label „Vorlage „{Name}“ löschen“ (T7)',
  );
}

// ── Ausgabe auf Bildschirm, solange die Monitorliste nicht geladen ist (displays undefined, E8): „unbekannt“, keine Liste ──
{
  const bs = abschnitt(panel(basisStand({ displays: undefined })), 'bildschirm');
  const pille = tags(bs, 'span').find((t) => attr(t, 'data-state') !== undefined);
  gleich(
    [attr(pille, 'data-state'), text(bs).includes('unbekannt'), tags(bs, 'select').length, text(bs).includes('Kein Bildschirm gefunden')],
    ['off', true, 0, false],
    'Panel › Ausgabe auf Bildschirm bei nicht geladener Monitorliste: „unbekannt“ statt einer leeren Liste (E8, Spec 7.2)',
  );
}

// ── Aktionen aus dem Panel (ohne DOM über die Props der Abschnitte geprüft in C8; hier: Rendern ruft nichts) ──
{
  const log: string[] = [];
  panel(basisStand({ status: basisStatus({ ndiActive: true, connections: 2 }) }), log);
  gleich(log, [], 'Panel mit NDI an: Rendern ruft weder startNdi noch stopNdi noch setConfig');
}

// ── G8 und Texte ──
{
  const einst = ohneKommentare(leseText('src/renderer/src/views/Einstellungen.tsx'));
  ok(!einst.includes('useEffect') && !einst.includes('window.'), 'Quelltext Einstellungen: ohne useEffect und ohne window. (G7, G8)');
  const op = leseText('src/renderer/src/views/OperatorView.tsx');
  gleich(
    ['window.jmtitler.remote.onCommand(', 'window.jmtitler.onFileOpened(', 'window.jmtitler.remote.reportState(', 'window.jmtitler.listDisplays()'].filter(
      (z) => !op.includes(z),
    ),
    [],
    'Quelltext OperatorView: Fernsteuer-Befehle, Show-Vorlagen-Import, reportState und Monitorliste laufen auch bei zugeklapptem Panel (G8)',
  );
  const views = readdirSync('src/renderer/src/views').filter((d) => d.endsWith('.tsx'));
  const alt = views.filter((d) => /Reiter|rechts starten|titler\.style|titler\.operator\.tab/.test(ohneKommentare(leseText(`src/renderer/src/views/${d}`))));
  gleich(alt, [], 'Texte: in views/*.tsx kein „Reiter“, kein „rechts starten“, kein titler.style, kein titler.operator.tab (Befund 16, E14)');
  const felder = leseText('src/renderer/src/views/felder.tsx');
  ok(
    felder.includes('export function Slider(') && felder.includes('export function ColorField(') && !felder.includes('function Field(') && !felder.includes('function Labeled('),
    'Quelltext felder.tsx: nur noch Slider und ColorField (Field und Labeled entfallen, E23)',
  );
}

// ── Pflichtpunkt Panel (Nr. 96): Leertaste und Escape mit Fokus im Panel (O1) ──
{
  const ndi = abschnitt(panel(basisStand()), 'ndi');
  const [schalter] = tags(ndi, 'button');
  ok(attr(schalter, 'role') === 'switch' && attr(schalter, 'type') === 'button', 'Pflichtpunkt Panel: der NDI-Schalter ist ein <button role="switch">');
  const quellen = (d: string): string[] =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? quellen(`${d}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${d}/${e.name}`] : []));
  const tasten = quellen('src').filter((d) => /keydown|onKeyDown|globalShortcut|before-input-event/.test(leseText(d)));
  gleich(tasten, [], 'Pflichtpunkt Panel: apps/titler/src hat keinen Tastenhandler (kein keydown, onKeyDown, globalShortcut, before-input-event)');
  const ereignis = (key: string, ziel: unknown, log: string[]) => ({
    key,
    defaultPrevented: false,
    target: ziel,
    stopPropagation: () => void log.push('stop'),
    preventDefault: () => void log.push('prevent'),
  });
  const knopf = { tagName: 'BUTTON', type: 'button' };
  const leer: string[] = [];
  panelTaste(ereignis(' ', knopf, leer), () => void leer.push('zu'));
  const esc: string[] = [];
  panelTaste(ereignis('Escape', knopf, esc), () => void esc.push('zu'));
  const feld: string[] = [];
  panelTaste(ereignis(' ', { tagName: 'INPUT', type: 'text' }, feld), () => void feld.push('zu'));
  gleich(
    [leer, esc, feld],
    [[], ['stop', 'prevent', 'zu'], ['stop']],
    'Pflichtpunkt Panel: Leertaste auf dem Schalter bleibt unberührt (löst ihn nativ aus), Escape schließt das Panel, ein Textfeld behält die Leertaste (O1)',
  );
}
```

Einfügen in `apps/titler/test/ui/selftest.ts` direkt vor der Zeile `abschluss();`:
```ts
import './panel.test';
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
(cd apps/titler && npx tsx --tsconfig tsconfig.test.json test/ui/selftest.ts) > <eigener Scratchpad>/c11-rot.txt 2>&1; echo "Exit=$?"
grep -c "^ok " <eigener Scratchpad>/c11-rot.txt
grep -E "^FAIL|^     |FEHLGESCHLAGEN" <eigener Scratchpad>/c11-rot.txt
```
Erwartet (gemessen): `Exit=1`, **122** `ok` (= 111 + 11: Stil, Grafik-Vorlagen, id-Verweise und die
Quelltext-Prüfungen gelten schon) und diese vierzehn `FAIL`:
```
FAIL Panel: Abschnitte iveo, NDI-Ausgabe, Ausgabe auf Bildschirm, Fernsteuerung, DataLink, Stil, Grafik-Vorlagen (Anhang A)
     ist: ["DataLink","iveo","Ausgabe (NDI)","Ausgabe (2. Bildschirm)","Stil","Grafik-Vorlagen"] soll: ["iveo","NDI-Ausgabe","Ausgabe auf Bildschirm","Fernsteuerung","DataLink","Stil","Grafik-Vorlagen"]
FAIL Panel: jeder Statuseintrag mit Abschnitt (iveo, ndi, bildschirm, fernsteuerung, datalink) findet seinen Anker (E20)
     ist: ["iveo","ndi","bildschirm","fernsteuerung","datalink"] soll: []
FAIL Panel › DataLink bei Quelle master: „Gesperrt: Im Verbund kommen die Speaker vom Master „…“ …“ (R2-Satz wörtlich, OF7)
FAIL Panel › DataLink bei Quelle master: Ordnerpfad, „Ordner wählen …“ und „Ordner entfernen“ stehen da und sind gesperrt
     ist: [0,0] soll: [3,3]
FAIL Panel › DataLink bei Quelle show mit eigenem Ordner: K1 „Zurück zum eigenen Ordner (…)“, nichts gesperrt
FAIL Panel › DataLink mit Fehler: „Fehler: …“ im Kopf und ⚠ mit dem Text unter den Feldern; „Ordner nicht gefunden“ als „Ordner fehlt“ (E10)
     ist: [[null,false,null],[null,false,null]] soll: [["error",true,"⚠ EACCES: permission denied"],["error",true,null]]
FAIL Panel › Fernsteuerung: Port 8726, Companion-Modul „jm-suite“, „bereit · 2 verbunden“, ohne „Im Launcher einrichten“ (E6, OF5)
FAIL Panel › iveo: „Das Zugriffstoken bleibt im Launcher.“, kein Token-Feld, kein Launcher-Knopf (E9, OF5)
FAIL Panel › NDI-Ausgabe: Schalter „Ausgabe“, Quellenname, Auflösung, Bildrate (E7)
     ist: [[],[]] soll: [["Ausgabe","Quellenname","Auflösung","Bildrate"],["switch"]]
FAIL Panel › Ausgabe auf Bildschirm: Schalter, Auswahl (automatisch + 2 Monitore), Hintergrund mit Farbwähler, „Standardfarbe (#00B140)“ (E8, OF3)
FAIL Panel › Ausgabe auf Bildschirm bei nicht geladener Monitorliste: „unbekannt“ statt einer leeren Liste (E8, Spec 7.2)
     ist: [null,false,0,false] soll: ["off",true,0,false]
FAIL Texte: in views/*.tsx kein „Reiter“, kein „rechts starten“, kein titler.style, kein titler.operator.tab (Befund 16, E14)
     ist: ["Einstellungen.tsx"] soll: []
FAIL Quelltext felder.tsx: nur noch Slider und ColorField (Field und Labeled entfallen, E23)
FAIL Pflichtpunkt Panel: der NDI-Schalter ist ein <button role="switch">
14 FEHLGESCHLAGEN
```

- [ ] **Step 3: Panel aus `@jm/settings` bauen** (`apps/titler/src/renderer/src/views/Einstellungen.tsx`)

Vorher:
```tsx
// Inhalt des Einstellungs-Panels (UX-Pilot C9, C10; Spec 3.1, 3.6): vorerst der Inhalt des bisherigen Reiters
// „Einstellungen“, unverändert bis auf die Herkunft der Werte (Stand) und der Handler (Aktionen); dahinter seit C10 die
// tool-eigenen Abschnitte „Stil“ und „Grafik-Vorlagen“ (Anhang A, E13). Ab C11 bauen die Abschnitte aus @jm/settings das
// Panel neu. Kein window und kein Effekt hier (G7, G8): Das Panel ist nur offen gemountet; was immer laufen muss, bleibt
// in OperatorView.
import { Button, cn, PanelAnker, SettingsSection } from '@jm/ui';
import type { GraphicTemplate } from '@shared/types';
import { ABSCHNITT, TITLER_TEXTE, type OberflaechenStand, type TitlerAktionen } from '@/lib/oberflaeche';
import { ColorField, Field, Labeled, Slider } from './felder';

const RESOLUTIONS = [
  { label: '1920×1080', w: 1920, h: 1080 },
  { label: '1280×720', w: 1280, h: 720 },
];
const FPS = [25, 30, 50, 60];

```
Nachher:
```tsx
// Einstellungs-Panel des Titlers (UX-Pilot C11; Spec 3.6, 5.1, 6, Anhang A „Titler“ › Einstellungen): die fünf
// gemeinsamen Abschnitte aus @jm/settings (iveo, NDI-Ausgabe, Ausgabe auf Bildschirm, Fernsteuerung, DataLink) mit den
// Props aus lib/oberflaeche.ts – dieselben Ableitungen wie die Statusleiste, also eine Wahrheit (Spec 6.1) –, dahinter
// die tool-eigenen Abschnitte „Stil“ und „Grafik-Vorlagen“ (E13). Jeder Abschnitt ist ein Sprungziel (PanelAnker, id wie
// das settingsSection des Statuseintrags, E20). Kein window und kein Effekt (G7, G8): Das Panel ist nur offen gemountet;
// Fernsteuerung, Show-Vorlagen-Import, reportState und Monitorliste bleiben in OperatorView.
import { DataLinkSection, IveoSection, NdiOutputSection, RemoteControlSection, ScreenOutputSection } from '@jm/settings';
import { Button, cn, PanelAnker, SettingsSection } from '@jm/ui';
import type { GraphicTemplate } from '@shared/types';
import {
  ABSCHNITT,
  bildschirmAbschnitt,
  dataLinkAbschnitt,
  fernsteuerungAbschnitt,
  iveoAbschnitt,
  ndiAbschnitt,
  TITLER_TEXTE,
  type OberflaechenStand,
  type TitlerAktionen,
} from '@/lib/oberflaeche';
import { ColorField, Slider } from './felder';

```
Vorher:
```tsx
  const { ndiActive, entries, dataError, datenQuelle } = stand.status;
  const displays = stand.displays ?? [];
  const { setConfig, pickFolder, startNdi, stopNdi } = aktionen;
  // iveo speist Speaker über die Datenquelle „Show“ ein (speakers.tsv in userData/iveo-data,
  // #11, Spec 7.7) — der Titler hält kein Token/Backend. `config.dataFolder` ist nur noch
  // der eigene Ordner des Bedieners und sagt darüber nichts mehr.
  const iveoActive = datenQuelle.art === 'show' || datenQuelle.art === 'master';
  // Ordnerwahl im Verbund gesperrt (Spec 17.2, Owner O1): Text statt Auswahl; der Main lehnt ebenfalls ab.
  const ordnerGesperrt = datenQuelle.ordnerGesperrt;
```
Nachher:
```tsx
  const { setConfig } = aktionen;
```
Vorher:
```tsx
      {/* DataLink (#86): Datenquelle konfigurieren (Abruf in der Bedienung unter „Daten / Recall“). */}
      <SettingsSection
        title="DataLink"
        description={
          <>
            Platzhalter <code className="text-[var(--primary)]">{'{{name}}'}</code> in den Textfeldern
            werden aus den Dateien im Ordner gefüllt. CSV mit Kopfzeile = Liste (je Zeile ein Eintrag,
            im Reiter <b>Steuerung</b> abrufbar); <code>schlüssel=wert</code>-Datei = ein Eintrag.
          </>
        }
      >
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
            <Button variant="ghost" size="sm" uppercase={false} onClick={() => void setConfig({ dataFolder: '' })} title="Watchfolder entfernen">
              ✕
            </Button>
          ) : null}
        </div>
        {ordnerGesperrt ? (
          <p className="text-[11px] text-[var(--muted-foreground)]">{ordnerGesperrt}</p>
        ) : null}
        {/* K1 (Spec 7.7/7.8): nur bei Quelle Show und einem eigenen Ordner, der nicht iveo-data ist */}
        {datenQuelle?.zurueckKnopf ? (
          <Button
            variant="outline"
            size="sm"
            uppercase={false}
            className="w-full"
            onClick={() => aktionen.zurueckZumEigenenOrdner()}
          >
            {datenQuelle.zurueckKnopf}
          </Button>
        ) : null}
        {dataError ? (
          <p className="text-[11px] text-[var(--destructive)]">DataLink: {dataError}</p>
        ) : null}
      </SettingsSection>

      {/* iveo (#11): Status der automatischen Speaker-Übernahme aus der JM Show. */}
      <SettingsSection title="iveo">
        {iveoActive ? (
          <div className="rounded-[var(--radius)] border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--primary)' }} />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--primary)]">
                iveo aktiv
              </span>
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              {entries.length} Speaker aus der geöffneten JM Show im DataLink. Aktualisiert sich live nach
              iveo-Änderungen (verwaltet vom Launcher). Abruf im Reiter <b>Steuerung › Daten / Recall</b>.
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Kein iveo-Event aktiv. iveo-Speaker werden automatisch zu Bauchbinden-Variablen, sobald der
            Titler über eine <b>JM Show</b> mit iveo-Daten geöffnet wird — Verwaltung und Zugriffstoken
            bleiben im Launcher (der Titler speichert kein Token).
          </p>
        )}
      </SettingsSection>

      {/* Ausgabe (NDI) */}
      <SettingsSection title="Ausgabe (NDI)">
        <Field label="Quellname" value={c.ndiName} onChange={(v) => void setConfig({ ndiName: v })} />
        <div className="flex gap-2">
          <Labeled label="Auflösung">
            <select
              value={`${c.width}x${c.height}`}
              onChange={(e) => {
                const r = RESOLUTIONS.find((x) => `${x.w}x${x.h}` === e.target.value);
                if (r) void setConfig({ width: r.w, height: r.h });
              }}
              className="h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2 text-sm font-semibold"
            >
              {RESOLUTIONS.map((r) => (
                <option key={r.label} value={`${r.w}x${r.h}`}>
                  {r.label}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="fps">
            <select
              value={String(c.fps)}
              onChange={(e) => void setConfig({ fps: Number(e.target.value) })}
              className="h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2 text-sm font-semibold tabular"
            >
              {FPS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Labeled>
        </div>
        {ndiActive ? (
          <Button variant="destructive" className="w-full" onClick={() => void stopNdi()}>
            NDI stoppen
          </Button>
        ) : (
          <Button variant="primary" className="w-full" onClick={() => void startNdi(c.ndiName)}>
            NDI starten
          </Button>
        )}
        {c.width % 2 !== 0 || c.height % 2 !== 0 ? (
          <p className="text-[11px] text-[var(--destructive)]">Auflösung sollte gerade sein.</p>
        ) : null}
      </SettingsSection>

      {/* Ausgabe (2. Bildschirm, #161) */}
      <SettingsSection
        title="Ausgabe (2. Bildschirm)"
        description="Zeigt die Bauchbinde als Vollbild auf einem zweiten Monitor mit Chroma-Green-Hintergrund — für externe Keyer (vMix/ATEM/TriCaster) ohne NDI."
      >
        <Labeled label="Monitor">
          <select
            value={String(c.secondScreenDisplay)}
            onChange={(e) => void setConfig({ secondScreenDisplay: Number(e.target.value) })}
            className="h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2 text-sm font-semibold"
          >
            <option value="0">Primär (automatisch)</option>
            {displays.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.label}
              </option>
            ))}
          </select>
        </Labeled>
        <div className="flex gap-3 items-end">
          <ColorField label="Chroma" value={c.chromaColor} onChange={(v) => void setConfig({ chromaColor: v })} />
          <button
            onClick={() => void setConfig({ chromaColor: '#00B140' })}
            className="h-9 shrink-0 rounded-[var(--radius)] border border-[var(--border)] px-3 text-xs hover:bg-[var(--highlight)]"
            title="Standard-Green (#00B140) zurücksetzen"
          >
            Reset
          </button>
        </div>
        {c.secondScreenEnabled ? (
          <Button variant="destructive" className="w-full" onClick={() => void setConfig({ secondScreenEnabled: false })}>
            2. Bildschirm ausschalten
          </Button>
        ) : (
          <Button variant="primary" className="w-full" onClick={() => void setConfig({ secondScreenEnabled: true })}>
            2. Bildschirm einschalten
          </Button>
        )}
        <p className="text-[11px] text-[var(--muted-foreground)]">
          Tipp: Zweitmonitor wählen, damit die Ausgabe nicht die Operator-Oberfläche verdeckt.
        </p>
      </SettingsSection>

```
Nachher:
```tsx
      <IveoSection {...iveoAbschnitt(stand)} />
      <NdiOutputSection {...ndiAbschnitt(stand, aktionen)} />
      <ScreenOutputSection {...bildschirmAbschnitt(stand, aktionen)} />
      <RemoteControlSection {...fernsteuerungAbschnitt(stand)} />
      <DataLinkSection {...dataLinkAbschnitt(stand, aktionen)} />

```

- [ ] **Step 4: `Field` und `Labeled` aus den lokalen Feldern nehmen** (`apps/titler/src/renderer/src/views/felder.tsx`)

Vorher:
```tsx
// Lokale Eingaben des Titlers, unverändert aus OperatorView.tsx verschoben (UX-Pilot C9): Einstellungen.tsx und die
// Bedienung nutzen sie gemeinsam. Field und Labeled entfallen in C11 (Panel aus @jm/settings, Inhalt aus @jm/ui); Slider
// und ColorField bleiben, weil @jm/ui dafür keinen Baustein hat (E23).

export function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}): React.JSX.Element {
  return (
    <label className="block">
      <div className="text-sm font-semibold mb-1">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
      />
    </label>
  );
}

export function Labeled({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label className="block flex-1">
      <div className="text-sm font-semibold mb-1">{label}</div>
      {children}
    </label>
  );
}

```
Nachher:
```tsx
// Lokale Eingaben des Titlers (UX-Pilot C9, C11): Slider (Ticker-Tempo, Größe) und Farbfeld (Stil), unverändert aus
// OperatorView.tsx verschoben; @jm/ui hat dafür keinen Baustein (E23). Field und Labeled sind mit C11 entfallen: Der Inhalt
// nutzt Field und TextInput aus @jm/ui, das Panel die Abschnitte aus @jm/settings.

```

- [ ] **Step 5: Test laufen lassen (grün)**

```
npm run selftest -w @jm/titler; echo "Exit=$?"
(cd apps/titler && npx tsx --tsconfig tsconfig.test.json test/ui/selftest.ts) > <eigener Scratchpad>/c11-ui.txt 2>&1; echo "Exit=$?"
grep -c "^ok " <eigener Scratchpad>/c11-ui.txt
grep -E "^ok   (Panel|Pflichtpunkt|Quelltext (Einstellungen|OperatorView: Fern|felder)|Texte: in views)" <eigener Scratchpad>/c11-ui.txt
```
Erwartet (gemessen): `Exit=0` (beide Läufe), alter Lauf 538, Oberflächen-Lauf **136** `ok` (= 111 + 25),
„ALLE TESTS OK“. Die Auswahl zeigt die 25 neuen Zeilen, dazu drei Panel-Zeilen aus C10 und am Ende die zwei Zeilen
„Panel-Inhalt“ aus C9 (sie kommen wegen des `await` in `rahmen.test.tsx` nach den übrigen Modulen):
```
ok   Panel: Abschnitte „Stil“ und „Grafik-Vorlagen“ mit Anker, Import-Knopf und Ablagefläche
ok   Panel › Grafik-Vorlagen: je Vorlage ein Knopf „Löschen“ mit aria-label (T7)
ok   Panel › Grafik-Vorlagen: „Löschen“ immer sichtbar (kein opacity-0, E13)
ok   Panel: Abschnitte iveo, NDI-Ausgabe, Ausgabe auf Bildschirm, Fernsteuerung, DataLink, Stil, Grafik-Vorlagen (Anhang A)
ok   Panel: jeder Statuseintrag mit Abschnitt (iveo, ndi, bildschirm, fernsteuerung, datalink) findet seinen Anker (E20)
ok   Panel: fünf Statuseinträge springen ins Panel, der Master-Eintrag nicht (E4)
ok   Panel: id-Verweise gültig (Beschriftungen, Hinweise, Sperrgründe)
ok   Panel: Rendern löst keine Aktion aus
ok   Panel › DataLink bei Quelle master: „Gesperrt: Im Verbund kommen die Speaker vom Master „…“ …“ (R2-Satz wörtlich, OF7)
ok   Panel › DataLink bei Quelle master: Ordnerpfad, „Ordner wählen …“ und „Ordner entfernen“ stehen da und sind gesperrt
ok   Panel › DataLink bei Quelle show mit eigenem Ordner: K1 „Zurück zum eigenen Ordner (…)“, nichts gesperrt
ok   Panel › DataLink mit Fehler: „Fehler: …“ im Kopf und ⚠ mit dem Text unter den Feldern; „Ordner nicht gefunden“ als „Ordner fehlt“ (E10)
ok   Panel › Fernsteuerung: Port 8726, Companion-Modul „jm-suite“, „bereit · 2 verbunden“, ohne „Im Launcher einrichten“ (E6, OF5)
ok   Panel › iveo: „Das Zugriffstoken bleibt im Launcher.“, kein Token-Feld, kein Launcher-Knopf (E9, OF5)
ok   Panel › NDI-Ausgabe: Schalter „Ausgabe“, Quellenname, Auflösung, Bildrate (E7)
ok   Panel › Ausgabe auf Bildschirm: Schalter, Auswahl (automatisch + 2 Monitore), Hintergrund mit Farbwähler, „Standardfarbe (#00B140)“ (E8, OF3)
ok   Panel › Stil: „Unten“, „Oben“, Größe und drei Farben (Nr. 38–41)
ok   Panel › Grafik-Vorlagen: „Datei importieren…“, Ablagefläche, Beschreibung (Nr. 20); „Löschen“ sichtbar (kein opacity-0, E13)
ok   Panel › Grafik-Vorlagen: je Vorlage „Löschen“ mit aria-label „Vorlage „{Name}“ löschen“ (T7)
ok   Panel › Ausgabe auf Bildschirm bei nicht geladener Monitorliste: „unbekannt“ statt einer leeren Liste (E8, Spec 7.2)
ok   Panel mit NDI an: Rendern ruft weder startNdi noch stopNdi noch setConfig
ok   Quelltext Einstellungen: ohne useEffect und ohne window. (G7, G8)
ok   Quelltext OperatorView: Fernsteuer-Befehle, Show-Vorlagen-Import, reportState und Monitorliste laufen auch bei zugeklapptem Panel (G8)
ok   Texte: in views/*.tsx kein „Reiter“, kein „rechts starten“, kein titler.style, kein titler.operator.tab (Befund 16, E14)
ok   Quelltext felder.tsx: nur noch Slider und ColorField (Field und Labeled entfallen, E23)
ok   Pflichtpunkt Panel: der NDI-Schalter ist ein <button role="switch">
ok   Pflichtpunkt Panel: apps/titler/src hat keinen Tastenhandler (kein keydown, onKeyDown, globalShortcut, before-input-event)
ok   Pflichtpunkt Panel: Leertaste auf dem Schalter bleibt unberührt (löst ihn nativ aus), Escape schließt das Panel, ein Textfeld behält die Leertaste (O1)
ok   Panel-Inhalt: DataLink, iveo und K1 rendern ohne window; Rendern löst keine Aktion aus
ok   Panel-Inhalt: views/Einstellungen.tsx ohne window und ohne useEffect (G7, G8)
```

- [ ] **Step 6: Typprüfung**

```
npm run typecheck -w @jm/titler; echo "Exit=$?"
```
Erwartet (gemessen): drei `tsc`-Läufe ohne Meldung, `Exit=0`.

- [ ] **Step 7: Bau und Klassen-Probe** (Review Focus 5)

```
npm run build -w @jm/titler; echo "Exit=$?"
(cd packages/ui && npx tsx galerie/pruefe-klassen.ts --css ../../apps/titler/out/renderer/assets); echo "Exit=$?"
```
Erwartet (gemessen): Bau `Exit=0`; die Klassen-Probe (ohne `--ohne-settings`) endet mit
```
ok   Klassen-Probe: 39 Klassen aus className="…" in packages/settings/src im CSS
ALLE TESTS OK
```
und `Exit=0`, zusammen 20 `ok`. Jetzt rendert der Titler die Abschnitte aus `@jm/settings` wirklich; ohne die
`@source`-Zeile aus C7 fehlten ihre Klassen.

- [ ] **Step 8: Gegenproben** (je eine Ersetzung allein mit dem Edit-Werkzeug, Oberflächen-Lauf, danach zurück; nicht committen)

Lauf je Probe wie in C9 Step 13.

a) Anker `ndi` fehlt (Abschnitt NDI-Ausgabe weggelassen):
Datei `apps/titler/src/renderer/src/views/Einstellungen.tsx`, Probe:
```tsx
      <NdiOutputSection {...ndiAbschnitt(stand, aktionen)} />
```
wird zu:
```tsx
(Zeile entfernt)
```
Erwartet (gemessen):
```
Exit=1
FAIL Panel: Abschnitte iveo, NDI-Ausgabe, Ausgabe auf Bildschirm, Fernsteuerung, DataLink, Stil, Grafik-Vorlagen (Anhang A)
     ist: ["iveo","Ausgabe auf Bildschirm","Fernsteuerung","DataLink","Stil","Grafik-Vorlagen"] soll: ["iveo","NDI-Ausgabe","Ausgabe auf Bildschirm","Fernsteuerung","DataLink","Stil","Grafik-Vorlagen"]
FAIL Panel: jeder Statuseintrag mit Abschnitt (iveo, ndi, bildschirm, fernsteuerung, datalink) findet seinen Anker (E20)
     ist: ["ndi"] soll: []
FAIL Panel › NDI-Ausgabe: Schalter „Ausgabe“, Quellenname, Auflösung, Bildrate (E7)
     ist: [[],[]] soll: [["Ausgabe","Quellenname","Auflösung","Bildrate"],["switch"]]
FAIL Pflichtpunkt Panel: der NDI-Schalter ist ein <button role="switch">
4 FEHLGESCHLAGEN
```
b) `locked` bei Quelle `master` weggelassen:
Datei `apps/titler/src/renderer/src/views/Einstellungen.tsx`, Probe:
```tsx
      <DataLinkSection {...dataLinkAbschnitt(stand, aktionen)} />
```
wird zu:
```tsx
      <DataLinkSection {...dataLinkAbschnitt(stand, aktionen)} locked={undefined} />
```
Erwartet (gemessen):
```
Exit=1
FAIL Panel › DataLink bei Quelle master: „Gesperrt: Im Verbund kommen die Speaker vom Master „…“ …“ (R2-Satz wörtlich, OF7)
FAIL Panel › DataLink bei Quelle master: Ordnerpfad, „Ordner wählen …“ und „Ordner entfernen“ stehen da und sind gesperrt
     ist: [3,0] soll: [3,3]
2 FEHLGESCHLAGEN
```
c) `useEffect` in `Einstellungen.tsx`:
Datei `apps/titler/src/renderer/src/views/Einstellungen.tsx`, Probe:
```tsx
import { ColorField, Slider } from './felder';
```
wird zu:
```tsx
import { ColorField, Slider } from './felder';
import { useEffect } from 'react';
void useEffect;
```
Erwartet (gemessen):
```
Exit=1
FAIL Quelltext Einstellungen: ohne useEffect und ohne window. (G7, G8)
FAIL Panel-Inhalt: views/Einstellungen.tsx ohne window und ohne useEffect (G7, G8)
2 FEHLGESCHLAGEN
```
d) „Löschen“ nur bei Mauszeiger sichtbar (wie bisher das ✕):
Datei `apps/titler/src/renderer/src/views/Einstellungen.tsx`, Probe:
```tsx
                    className="ml-auto shrink-0"
```
wird zu:
```tsx
                    className="ml-auto shrink-0 opacity-0 group-hover:opacity-100"
```
Erwartet (gemessen):
```
Exit=1
FAIL Panel › Grafik-Vorlagen: „Löschen“ immer sichtbar (kein opacity-0, E13)
FAIL Panel › Grafik-Vorlagen: „Datei importieren…“, Ablagefläche, Beschreibung (Nr. 20); „Löschen“ sichtbar (kein opacity-0, E13)
2 FEHLGESCHLAGEN
```
e) DataLink-Fehler kommt nicht im Abschnitt an:
Datei `apps/titler/src/renderer/src/views/Einstellungen.tsx`, Probe:
```tsx
      <DataLinkSection {...dataLinkAbschnitt(stand, aktionen)} />
```
wird zu:
```tsx
      <DataLinkSection {...dataLinkAbschnitt(stand, aktionen)} error={undefined} folderMissing={false} />
```
Erwartet (gemessen):
```
Exit=1
FAIL Panel › DataLink mit Fehler: „Fehler: …“ im Kopf und ⚠ mit dem Text unter den Feldern; „Ordner nicht gefunden“ als „Ordner fehlt“ (E10)
     ist: [["warn",false,null],["warn",false,null]] soll: [["error",true,"⚠ EACCES: permission denied"],["error",true,null]]
1 FEHLGESCHLAGEN
```
f) Nicht geladene Monitorliste im Panel als leere Liste (Restlücke R4, Mutation K4 der Prüfung):
Datei `apps/titler/src/renderer/src/views/Einstellungen.tsx`, Probe:
```tsx
      <ScreenOutputSection {...bildschirmAbschnitt(stand, aktionen)} />
```
wird zu:
```tsx
      <ScreenOutputSection {...bildschirmAbschnitt({ ...stand, displays: stand.displays ?? [] }, aktionen)} />
```
Erwartet (gemessen):
```
Exit=1
FAIL Panel › Ausgabe auf Bildschirm bei nicht geladener Monitorliste: „unbekannt“ statt einer leeren Liste (E8, Spec 7.2)
     ist: ["off",false,1,true] soll: ["off",true,0,false]
1 FEHLGESCHLAGEN
```
Nach jeder Probe zurückbauen; danach zeigt `git diff --stat` nur die Dateien dieser Aufgabe.

- [ ] **Step 9: Zeilenenden prüfen**

```
node -e "for (const f of process.argv.slice(1)) { const t = require('fs').readFileSync(f, 'utf8'); const n = (t.match(/\n/g) || []).length, c = (t.match(/\r\n/g) || []).length; console.log(f, n, c, c === 0 || c === n ? 'einheitlich' : 'GEMISCHT'); }" apps/titler/src/renderer/src/views/Einstellungen.tsx apps/titler/src/renderer/src/views/felder.tsx apps/titler/test/ui/panel.test.tsx apps/titler/test/ui/selftest.ts
```
Erwartet (gemessen):
```
apps/titler/src/renderer/src/views/Einstellungen.tsx 131 0 einheitlich
apps/titler/src/renderer/src/views/felder.tsx 62 0 einheitlich
apps/titler/test/ui/panel.test.tsx 245 0 einheitlich
apps/titler/test/ui/selftest.ts 11 0 einheitlich
```

- [ ] **Step 10: Commit**

```
git add apps/titler/src/renderer/src/views/Einstellungen.tsx apps/titler/src/renderer/src/views/felder.tsx apps/titler/test/ui/panel.test.tsx apps/titler/test/ui/selftest.ts
git status --short
```
Erwartet:
```
M  apps/titler/src/renderer/src/views/Einstellungen.tsx
M  apps/titler/src/renderer/src/views/felder.tsx
A  apps/titler/test/ui/panel.test.tsx
M  apps/titler/test/ui/selftest.ts
```
Dann:
```
git commit -m "feat(titler): Einstellungs-Panel aus @jm/settings mit Stil und Grafik-Vorlagen" -m "UX-Pilot C11 (Spec 3.6, 5.1, 6, 10; Anhang A Titler; E6-E10, E13, E24; OF3, OF4, OF5, OF7): Das Panel zeigt iveo, NDI-Ausgabe, Ausgabe auf Bildschirm, Fernsteuerung und DataLink aus @jm/settings mit den Props aus lib/oberflaeche.ts (dieselbe Ableitung wie die Statusleiste), danach Stil und Grafik-Vorlagen. Jeder Statuseintrag findet seinen Anker; DataLink ist im Verbund mit dem R2-Satz gesperrt. Field und Labeled entfallen aus views/felder.tsx. Pflichtpunkt Panel: NDI-Schalter als button role=switch, kein Tastenhandler im Titler, panelTaste geprueft. Ein DataLink-Fehler steht im Abschnitt, auf den der Statuseintrag springt; solange die Monitorliste nicht geladen ist, zeigt Ausgabe auf Bildschirm unbekannt statt einer leeren Liste. Gegenproben a-f." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- `OperatorView.tsx` ändert sich in C11 nicht: `Field`, `Labeled`, `ColorField` und `Slider` sind schon in C9 nach
  `views/felder.tsx` gezogen; C11 streicht dort `Field` und `Labeled`.
- „Stil“ und „Grafik-Vorlagen“ stehen seit C10 im Panel (siehe C10); C11 prüft sie mit (Reihenfolge, Anker, „Löschen“).
- Der Pflichtpunkt Panel wird zusätzlich am Verhalten geprüft: `panelTaste` aus
  `packages/ui/src/components/SettingsPanel.tsx` (relativer Import im Test; der Baustein exportiert sie nicht über
  `index.ts`) mit Leertaste auf einem Schalter, Escape und Leertaste in einem Textfeld.
- Der Test „kein „Reiter“ …“ prüft jetzt alle `views/*.tsx` ohne Kommentare und zusätzlich `titler.style` und
  `titler.operator.tab` (E14).
- Nachbesserung nach der Plan-Prüfung (Befund robust:7): Der DataLink-Abschnitt wird mit einem Fehler und mit „Ordner
  nicht gefunden“ gerendert; Gegenprobe e). Die Hilfetexte Nr. 42 und 49 nennen den inhaltlichen Wegfall (E24).
- Letzte Nachbesserung (Restlücke R4, NB35): Der Panel-Abschnitt „Ausgabe auf Bildschirm“ wird auch mit nicht geladener
  Monitorliste (`displays` undefined) gerendert und muss „unbekannt“ zeigen, nicht die Auswahl „Kein Bildschirm gefunden“;
  Gegenprobe f) ist die Mutation K4 der Prüfung (`stand.displays ?? []` nur im Panel), die vorher grün blieb.
- Zählstände (in der letzten Nachbesserung gemessen): Oberflächen-Lauf rot 122 `ok` (111 + 11), grün 136 `ok` (111 + 25);
  ebenso die vierzehn `FAIL`-Zeilen und die Gegenproben a–f.

---
### Task 12: C12 · Recall-Board, Hell/Dunkel in den Zusatzfenstern, Feinschliff

**Spec:** 8 (Hell/Dunkel gemerkt je Arbeitsplatz), Anhang A „Titler“ › „Besonderheiten“ (Zusatzfenster ohne AppShell;
das Recall-Board zeigt dieselben Hinweise, OF1), 5.3 (Ausgabefenster unverändert), 7.2 (unbekannt ist nicht „0“), G5
(keine ASCII-Anführungszeichen in Nutzertexten). Entscheidungen E15 (Board übernimmt das gemerkte Theme), E22
(Board-Ladezustand), T11. Global Constraints G1, G3, G5, G9, G10, G11, G12.

**Voraussetzung:** Plan-Worktree nach C11: `npm run selftest -w @jm/titler` grün (Oberflächen-Lauf 136 `ok`). C12
braucht fachlich nur C9 (`testzustand.ts`); der Test rendert zur ASCII-Prüfung aber auch Live-Bereich, Bedienung und Panel
aus C10 und C11.

**Dateien:**
- Modify: `apps/titler/src/renderer/src/views/RecallBoard.tsx` (`useTheme()` ohne Schalter; „Lädt…“, solange `state`
  fehlt; „Kein Eintrag passt zu „{q}“.“ mit „ “; Hinweisband und Karte B1 in `--status-warn`, E25)
- Create: `apps/titler/test/ui/board.test.tsx`
- Modify: `apps/titler/test/ui/selftest.ts` (Import-Zeile direkt vor `abschluss();`)

**Interfaces:**
- Consumes: `useTheme` aus `@jm/ui` (Fundament: liest `jm-theme`, setzt `dark`/`light` auf `<html>`, ohne Browser „dark“);
  `TITLER_TEXTE.laedt` (T11); `boardHinweis` und `b1Text` aus `lib/datalink-anzeige.ts` (unverändert); C9 `testzustand.ts`.
- Produces: keine neue Schnittstelle. `RecallBoard()` bleibt ohne Props und ohne AppShell.

**Verhalten (verbindlich):**
- Das Recall-Board (`?view=recall`) ruft `useTheme()` (ohne `ThemeToggle`): Es übernimmt beim Öffnen Hell/Dunkel des
  Arbeitsplatzes; einen Abgleich zwischen offenen Fenstern gibt es nicht (E15, F1).
- Solange `state` fehlt, zeigt das Board nur „Lädt…“ (`TITLER_TEXTE.laedt`, wie das Bedienfenster) statt „0 Einträge“ und
  „Keine Einträge …“ (E22, Befund 18). Danach unverändert: Kopf mit „RECALL-BOARD“, Zahl und Suche, Hinweisband nur bei
  H1, H5, H6 (Board-Filter bleibt, OF1-Vorgabe; B14 im alten Lauf bleibt grün), Karte B1, Raster, Suche.
- Nr. 91: „Kein Eintrag passt zu „{q}“.“ schließt mit „ (Befund 9).
- Hinweisband und Karte B1 werden orange (`--status-warn` statt Gelb `--warning`, Spec 4.2, E25, Ausnahme zu E22). Danach
  nutzt keine Datei unter `views/` mehr `--warning`; das prüft der Test über alle `views/*.tsx` (ohne Kommentare).
- Das Ausgabefenster (`?view=output`) bleibt ohne AppShell und ohne `useTheme`: `views/OutputView.tsx`, `lib/engine.ts`
  und `views/ImportDialog.tsx` sind byte-gleich mit `main` `5e5b234ec3` (SHA-256 über den Text mit LF, im Test
  festgeschrieben; G1, G3). Die Hashes sichern den Pilot. Ändert eine spätere Aufgabe eine der drei Dateien gewollt (etwa
  die Folgeaufgaben zum Import-Dialog, Befund 7), setzt sie die Hashes in derselben Änderung neu; das sagen ein Kommentar
  im Test und eine Zeile unter dem `FAIL` („Nach der Umsetzung“ Punkt 9).
- In `views/*.tsx` schließt kein „ mit einem ASCII-Zeichen `"`, und gerenderte Textknoten von Bedienfenster, Board,
  Live-Bereich, Bedienung und Panel enthalten kein `&quot;` (G5).

---

- [ ] **Step 1: Fehlschlagenden Test schreiben** (Neue Datei `apps/titler/test/ui/board.test.tsx`)

```tsx
// UX-Pilot C12 · Recall-Board, Hell/Dunkel in den Zusatzfenstern, Feinschliff (Spec 5.3, 7.2, 8; Anhang A „Titler“ ›
// Besonderheiten; E15, E22; OF1): Das Board bleibt ohne AppShell, zeigt beim Laden „Lädt…“ statt „0 Einträge“, übernimmt
// das gemerkte Theme und behält seinen Hinweis-Filter. Das Ausgabefenster bleibt byte-gleich. Keine ASCII-Anführungszeichen
// in Nutzertexten. Render ohne Browser über den Anfangszustand des Stores.
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { enthaelt, enthaeltNicht, gleich, leseText, ok, render } from '@jm/ui/testhilfe';
import type { TitlerStatus } from '@shared/types';
import { TITLER_TEXTE } from '@/lib/oberflaeche';
import { Bedienung } from '@/views/Bedienung';
import { Einstellungen } from '@/views/Einstellungen';
import { LiveBereich } from '@/views/LiveBereich';
import { OperatorView } from '@/views/OperatorView';
import { RecallBoard } from '@/views/RecallBoard';
import { basisConfig, basisStand, basisStatus, eintraege, mitStore, MONITORE, ohneKommentare, protokollAktionen, text, VORLAGEN } from './testzustand';

const nichts = (): void => undefined;
const board = (status: TitlerStatus | null): string =>
  mitStore(status ? { config: basisConfig(), status } : null, () => render(<RecallBoard />));

// ── Board ohne AppShell, Laden ──
{
  const html = board(basisStatus({ entries: eintraege(3), activeEntry: 1 }));
  ok(
    !html.includes('data-bereich="inhalt"') && !html.includes('data-status-id') && text(html).includes('RECALL-BOARD') && text(html).includes('3 Einträge'),
    'Recall-Board: bleibt ohne AppShell (keine Statusleiste, kein Panel), Kopf mit „RECALL-BOARD“ und Zahl (Anhang A)',
  );
  const laden = board(null);
  ok(
    text(laden).includes(TITLER_TEXTE.laedt) && !text(laden).includes('0 Einträge') && !text(laden).includes('Keine Einträge'),
    'Recall-Board beim Laden: „Lädt…“ statt „0 Einträge“ und „Keine Einträge …“ (E22)',
  );
  enthaelt(text(board(basisStatus())), 'Keine Einträge.', 'Recall-Board geladen ohne Einträge: weiter „Keine Einträge. …“ (Nr. 89)');
}

// ── Board-Hinweis: nur H1, H5, H6 und die Karte B1 (OF1-Vorgabe, Spec 7.8) ──
{
  const arten = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7'] as const;
  const gezeigt = arten.filter((art) => text(board(basisStatus({ entries: eintraege(2), hinweis: { art, text: `Hinweis ${art}` } }))).includes(`Hinweis ${art}`));
  gleich(gezeigt, ['H1', 'H5', 'H6'], 'Recall-Board: Hinweis nur bei H1, H5, H6 (Board-Filter bleibt, OF1)');
  enthaelt(
    text(board(basisStatus({ entries: eintraege(2), gehalten: { label: 'Dr. Weiß' } }))),
    'Auf Sendung, nicht in der Liste: Dr. Weiß',
    'Recall-Board: Karte B1 bei einem gehaltenen Eintrag',
  );
}

// ── Theme: Board übernimmt Hell/Dunkel, Ausgabefenster unverändert ──
{
  const quelle = ohneKommentare(leseText('src/renderer/src/views/RecallBoard.tsx'));
  ok(quelle.includes('useTheme()') && !quelle.includes('ThemeToggle'), 'Recall-Board: ruft useTheme() (gemerktes Hell/Dunkel beim Öffnen), ohne eigenen Schalter (E15)');
  // Die Hashes sichern G1 und G3 für den Pilot (Stand main 5e5b234ec3, Text mit LF). Ändert eine spätere Aufgabe eine der
  // drei Dateien gewollt (etwa die Folgeaufgaben zum Import-Dialog), setzt sie die Hashes in derselben Änderung neu.
  const hash = (d: string): string => createHash('sha256').update(leseText(d)).digest('hex');
  const ist = [hash('src/renderer/src/views/OutputView.tsx'), hash('src/renderer/src/lib/engine.ts'), hash('src/renderer/src/views/ImportDialog.tsx')];
  const soll = [
    '7155aa32faa170b09262745d671a45511505b3d2f972596687edb025278aba3f',
    'd14816e8cf54ec9018910f12f56114d3b7eba095c5be02515eed385f1c51996a',
    '8b35b4b9b4c2d19a075dab6d146021b2b03e0ab9afeb62671f17579f45a8d691',
  ];
  gleich(ist, soll, 'Ausgabefenster, Engine und Import-Dialog byte-gleich mit main 5e5b234ec3 (Spec 5.3, G1, G3; Inhalt mit LF)');
  if (ist.join() !== soll.join()) console.log('     Gewollte Änderung nach dem Pilot? Dann die Hashes in test/ui/board.test.tsx neu setzen.');
  ok(!leseText('src/renderer/src/views/OutputView.tsx').includes('useTheme'), 'Ausgabefenster: kein useTheme (bleibt wie bisher, G3)');
}

// ── Warnfarbe Orange statt Gelb (Spec 4.2, E25) ──
{
  const views = readdirSync('src/renderer/src/views').filter((d) => d.endsWith('.tsx'));
  const gelb = views.filter((d) => ohneKommentare(leseText(`src/renderer/src/views/${d}`)).includes('--warning'));
  const html = board(basisStatus({ entries: eintraege(2), hinweis: { art: 'H1', text: 'Hinweis H1' }, gehalten: { label: 'Dr. Weiß' } }));
  gleich(
    [gelb, (html.match(/var\(--status-warn\)/g) ?? []).length],
    [[], 3],
    'Farben: keine Datei in views/*.tsx nutzt Gelb --warning; Hinweisband und Karte B1 im Board sind orange (--status-warn, Spec 4.2, E25)',
  );
}

// ── Keine ASCII-Anführungszeichen in Nutzertexten (G5, Befund 9) ──
{
  // Quelltext: kein „…" (öffnendes deutsches, schließendes ASCII-Zeichen) außerhalb von Kommentaren.
  const views = readdirSync('src/renderer/src/views').filter((d) => d.endsWith('.tsx'));
  const falsch = views.filter((d) => /„[^“"\n]*"/.test(ohneKommentare(leseText(`src/renderer/src/views/${d}`))));
  gleich(falsch, [], 'Texte: in views/*.tsx schließt kein „ mit einem ASCII-Anführungszeichen (G5, Befund 9)');
  enthaelt(leseText('src/renderer/src/views/RecallBoard.tsx'), 'Kein Eintrag passt zu „{q}“.', 'Recall-Board: „Kein Eintrag passt zu „{q}“.“ mit „ “ (Nr. 91)');
  // Gerendert: kein &quot; in Textknoten (React maskiert " im Text als &quot;).
  const status = basisStatus({
    entries: eintraege(3),
    activeEntry: 0,
    hinweis: { art: 'H3', text: 'Hinweis' },
    datenQuelle: { art: 'show', zeile: 'Quelle: Show „Probe“ · 3 Speaker', zurueckKnopf: 'Zurück zum eigenen Ordner (Daten)', ohneOrdner: false },
  });
  const seiten = [
    mitStore({ config: basisConfig(), status }, () => render(<OperatorView />)),
    board(status),
    render(<LiveBereich previewRef={{ current: null }} live={false} ndiActive={false} activeEntry={0} anzahl={3} onTake={nichts} onClear={nichts} onSchritt={nichts} />),
    render(<Bedienung config={basisConfig({ template: 'graphic' })} status={status} templates={VORLAGEN} setConfig={nichts} onSelectTemplate={nichts} onOpenBoard={nichts} onRecall={nichts} />),
    render(
      <Einstellungen
        stand={basisStand({ status, displays: MONITORE })}
        aktionen={protokollAktionen([])}
        templates={VORLAGEN}
        activeGraphicId="v1"
        onPickImport={nichts}
        onDropImport={nichts}
        onDeleteTemplate={nichts}
      />,
    ),
  ];
  const textknoten = seiten.map((h) => h.replace(/<[^>]*>/g, '')).join('\n');
  enthaeltNicht(textknoten, '&quot;', 'Texte: gerendertes Bedienfenster, Board, Live-Bereich, Bedienung und Panel ohne ASCII-Anführungszeichen');
}
```

Einfügen in `apps/titler/test/ui/selftest.ts` direkt vor der Zeile `abschluss();`:
```ts
import './board.test';
```

- [ ] **Step 2: Test laufen lassen (rot)**

```
(cd apps/titler && npx tsx --tsconfig tsconfig.test.json test/ui/selftest.ts) > <eigener Scratchpad>/c12-rot.txt 2>&1; echo "Exit=$?"
grep -c "^ok " <eigener Scratchpad>/c12-rot.txt
grep -E "^FAIL|^     |FEHLGESCHLAGEN" <eigener Scratchpad>/c12-rot.txt
```
Erwartet (gemessen): `Exit=1`, **143** `ok` (= 136 + 7) und diese fünf `FAIL`:
```
FAIL Recall-Board beim Laden: „Lädt…“ statt „0 Einträge“ und „Keine Einträge …“ (E22)
FAIL Recall-Board: ruft useTheme() (gemerktes Hell/Dunkel beim Öffnen), ohne eigenen Schalter (E15)
FAIL Farben: keine Datei in views/*.tsx nutzt Gelb --warning; Hinweisband und Karte B1 im Board sind orange (--status-warn, Spec 4.2, E25)
     ist: [["RecallBoard.tsx"],0] soll: [[],3]
FAIL Texte: in views/*.tsx schließt kein „ mit einem ASCII-Anführungszeichen (G5, Befund 9)
     ist: ["RecallBoard.tsx"] soll: []
FAIL Recall-Board: „Kein Eintrag passt zu „{q}“.“ mit „ “ (Nr. 91)
     fehlt: Kein Eintrag passt zu „{q}“.
5 FEHLGESCHLAGEN
```

- [ ] **Step 3: Recall-Board** (`apps/titler/src/renderer/src/views/RecallBoard.tsx`)

Vorher:
```tsx
import { cn, Logo } from '@jm/ui';
import { useTitler } from '@/store/titler';
import { b1Text, boardHinweis } from '@/lib/datalink-anzeige';
```
Nachher:
```tsx
import { cn, Logo, useTheme } from '@jm/ui';
import { useTitler } from '@/store/titler';
import { b1Text, boardHinweis } from '@/lib/datalink-anzeige';
import { TITLER_TEXTE } from '@/lib/oberflaeche';
```
Vorher:
```tsx
 */
export function RecallBoard(): React.JSX.Element {
```
Nachher:
```tsx
 * UX-Pilot C12 (Spec 8, E15, E22): übernimmt Hell/Dunkel des Arbeitsplatzes beim Öffnen (ohne eigenen Schalter) und zeigt
 * „Lädt…“, bis der Zustand da ist, statt „0 Einträge“. Bleibt ohne AppShell (Anhang A „Besonderheiten“).
 */
export function RecallBoard(): React.JSX.Element {
  useTheme();
```
Vorher:
```tsx

  return (
```
Nachher:
```tsx

  if (!state) {
    return <div className="h-screen grid place-items-center text-[var(--muted-foreground)]">{TITLER_TEXTE.laedt}</div>;
  }

  return (
```
Vorher:
```tsx
              Kein Eintrag passt zu „{q}".
```
Nachher:
```tsx
              Kein Eintrag passt zu „{q}“.
```
Warnfarbe Orange statt Gelb (Spec 4.2, E25), Hinweisband. Vorher:
```tsx
          className="shrink-0 border-b border-[var(--warning)]/50 bg-[var(--warning)]/15 px-5 py-2.5 text-sm font-semibold"
```
Nachher:
```tsx
          className="shrink-0 border-b border-[var(--status-warn)]/50 bg-[var(--status-warn)]/15 px-5 py-2.5 text-sm font-semibold"
```
Karte B1. Vorher:
```tsx
          <div className="min-h-16 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--warning)] px-3 py-2 flex items-center justify-center text-center text-sm font-bold">
```
Nachher:
```tsx
          <div className="min-h-16 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--status-warn)] px-3 py-2 flex items-center justify-center text-center text-sm font-bold">
```

- [ ] **Step 4: Test laufen lassen (grün)**

```
npm run selftest -w @jm/titler; echo "Exit=$?"
(cd apps/titler && npx tsx --tsconfig tsconfig.test.json test/ui/selftest.ts) > <eigener Scratchpad>/c12-ui.txt 2>&1; echo "Exit=$?"
grep -c "^ok " <eigener Scratchpad>/c12-ui.txt
grep -E "^ok   (Recall-Board|Ausgabefenster|Farben:|Texte: (in views/\*\.tsx schließt|gerendertes))" <eigener Scratchpad>/c12-ui.txt
```
Erwartet (gemessen): `Exit=0` (beide Läufe), alter Lauf 538, Oberflächen-Lauf **148** `ok` (= 136 + 12),
„ALLE TESTS OK“. Die zwölf neuen Zeilen:
```
ok   Recall-Board: bleibt ohne AppShell (keine Statusleiste, kein Panel), Kopf mit „RECALL-BOARD“ und Zahl (Anhang A)
ok   Recall-Board beim Laden: „Lädt…“ statt „0 Einträge“ und „Keine Einträge …“ (E22)
ok   Recall-Board geladen ohne Einträge: weiter „Keine Einträge. …“ (Nr. 89)
ok   Recall-Board: Hinweis nur bei H1, H5, H6 (Board-Filter bleibt, OF1)
ok   Recall-Board: Karte B1 bei einem gehaltenen Eintrag
ok   Recall-Board: ruft useTheme() (gemerktes Hell/Dunkel beim Öffnen), ohne eigenen Schalter (E15)
ok   Ausgabefenster, Engine und Import-Dialog byte-gleich mit main 5e5b234ec3 (Spec 5.3, G1, G3; Inhalt mit LF)
ok   Ausgabefenster: kein useTheme (bleibt wie bisher, G3)
ok   Farben: keine Datei in views/*.tsx nutzt Gelb --warning; Hinweisband und Karte B1 im Board sind orange (--status-warn, Spec 4.2, E25)
ok   Texte: in views/*.tsx schließt kein „ mit einem ASCII-Anführungszeichen (G5, Befund 9)
ok   Recall-Board: „Kein Eintrag passt zu „{q}“.“ mit „ “ (Nr. 91)
ok   Texte: gerendertes Bedienfenster, Board, Live-Bereich, Bedienung und Panel ohne ASCII-Anführungszeichen
```

- [ ] **Step 5: Typprüfung**

```
npm run typecheck -w @jm/titler; echo "Exit=$?"
```
Erwartet (gemessen): drei `tsc`-Läufe ohne Meldung, `Exit=0`.

- [ ] **Step 6: Bau und Klassen-Probe**

```
npm run build -w @jm/titler; echo "Exit=$?"
(cd packages/ui && npx tsx galerie/pruefe-klassen.ts --css ../../apps/titler/out/renderer/assets) | grep -cE "^ok"
```
Erwartet (gemessen): Bau `Exit=0`; Klassen-Probe `20`.

- [ ] **Step 7: Gegenproben** (je eine Ersetzung allein mit dem Edit-Werkzeug, Oberflächen-Lauf, danach zurück; nicht committen)

Lauf je Probe wie in C9 Step 13.

a) `useTheme` im Ausgabefenster:
Datei `apps/titler/src/renderer/src/views/OutputView.tsx`, Probe:
```tsx
import { activeGraphic } from '@/lib/graphic';
```
wird zu:
```tsx
import { activeGraphic } from '@/lib/graphic';
import { useTheme } from '@jm/ui';
void useTheme;
```
Erwartet (gemessen; der Hash ist der des veränderten Ausgabefensters):
```
Exit=1
FAIL Ausgabefenster, Engine und Import-Dialog byte-gleich mit main 5e5b234ec3 (Spec 5.3, G1, G3; Inhalt mit LF)
     ist: ["a1f5b76396275b6c6e97c658333b63e938e574609e521ad3a387b58561148636","d14816e8cf54ec9018910f12f56114d3b7eba095c5be02515eed385f1c51996a","8b35b4b9b4c2d19a075dab6d146021b2b03e0ab9afeb62671f17579f45a8d691"] soll: ["7155aa32faa170b09262745d671a45511505b3d2f972596687edb025278aba3f","d14816e8cf54ec9018910f12f56114d3b7eba095c5be02515eed385f1c51996a","8b35b4b9b4c2d19a075dab6d146021b2b03e0ab9afeb62671f17579f45a8d691"]
     Gewollte Änderung nach dem Pilot? Dann die Hashes in test/ui/board.test.tsx neu setzen.
FAIL Ausgabefenster: kein useTheme (bleibt wie bisher, G3)
2 FEHLGESCHLAGEN
```
b) ASCII-Zeichen im Board-Text:
Datei `apps/titler/src/renderer/src/views/RecallBoard.tsx`, Probe:
```tsx
Kein Eintrag passt zu „{q}“.
```
wird zu:
```tsx
Kein Eintrag passt zu „{q}".
```
Erwartet (gemessen):
```
Exit=1
FAIL Texte: in views/*.tsx schließt kein „ mit einem ASCII-Anführungszeichen (G5, Befund 9)
     ist: ["RecallBoard.tsx"] soll: []
FAIL Recall-Board: „Kein Eintrag passt zu „{q}“.“ mit „ “ (Nr. 91)
     fehlt: Kein Eintrag passt zu „{q}“.
2 FEHLGESCHLAGEN
```
c) „0 Einträge“ beim Laden (Ladezustand weggelassen):
Datei `apps/titler/src/renderer/src/views/RecallBoard.tsx`, Probe:
```tsx
  if (!state) {
    return <div className="h-screen grid place-items-center text-[var(--muted-foreground)]">{TITLER_TEXTE.laedt}</div>;
  }
```
wird zu:
```tsx
(Zeile entfernt)
```
Erwartet (gemessen):
```
Exit=1
FAIL Recall-Board beim Laden: „Lädt…“ statt „0 Einträge“ und „Keine Einträge …“ (E22)
1 FEHLGESCHLAGEN
```
d) Karte B1 wieder gelb:
Datei `apps/titler/src/renderer/src/views/RecallBoard.tsx`, Probe:
```tsx
border-2 border-dashed border-[var(--status-warn)]
```
wird zu:
```tsx
border-2 border-dashed border-[var(--warning)]
```
Erwartet (gemessen):
```
Exit=1
FAIL Farben: keine Datei in views/*.tsx nutzt Gelb --warning; Hinweisband und Karte B1 im Board sind orange (--status-warn, Spec 4.2, E25)
     ist: [["RecallBoard.tsx"],2] soll: [[],3]
1 FEHLGESCHLAGEN
```
Nach jeder Probe zurückbauen; danach zeigt `git diff --stat` nur die Dateien dieser Aufgabe
(`views/OutputView.tsx` steht dort nicht).

- [ ] **Step 8: Zeilenenden prüfen**

```
node -e "for (const f of process.argv.slice(1)) { const t = require('fs').readFileSync(f, 'utf8'); const n = (t.match(/\n/g) || []).length, c = (t.match(/\r\n/g) || []).length; console.log(f, n, c, c === 0 || c === n ? 'einheitlich' : 'GEMISCHT'); }" apps/titler/src/renderer/src/views/RecallBoard.tsx apps/titler/test/ui/board.test.tsx apps/titler/test/ui/selftest.ts
```
Erwartet (gemessen):
```
apps/titler/src/renderer/src/views/RecallBoard.tsx 104 104 einheitlich
apps/titler/test/ui/board.test.tsx 111 0 einheitlich
apps/titler/test/ui/selftest.ts 12 0 einheitlich
```

- [ ] **Step 9: Commit**

```
git add apps/titler/src/renderer/src/views/RecallBoard.tsx apps/titler/test/ui/board.test.tsx apps/titler/test/ui/selftest.ts
git status --short
```
Erwartet:
```
M  apps/titler/src/renderer/src/views/RecallBoard.tsx
A  apps/titler/test/ui/board.test.tsx
M  apps/titler/test/ui/selftest.ts
```
Dann:
```
git commit -m "feat(titler): Recall-Board mit Hell/Dunkel und Ladezustand, Anfuehrungszeichen berichtigt" -m "UX-Pilot C12 (Spec 5.3, 8, Anhang A Titler Besonderheiten; E15, E22): Das Recall-Board ruft useTheme ohne Schalter und uebernimmt so Hell/Dunkel des Arbeitsplatzes; bis der Zustand da ist, zeigt es Laedt... statt 0 Eintraege. Hinweis-Filter H1/H5/H6 und Karte B1 bleiben (OF1). Kein Eintrag passt zu ... schliesst mit dem deutschen Anfuehrungszeichen. Hinweisband und Karte B1 sind orange (status-warn statt warning, Spec 4.2); keine Ansicht nutzt mehr warning. Ausgabefenster, Engine und Import-Dialog bleiben byte-gleich (Hash im Test, mit Hinweis fuer spaetere gewollte Aenderungen). Gegenproben a-d." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- „Lädt…“ ersetzt beim Board die ganze Ansicht (wie Nr. 1 im Bedienfenster), auch Kopf und Suche; vorher gäbe es nichts zu
  suchen.
- Die Hash-Prüfung schließt `views/ImportDialog.tsx` mit ein (G1 nennt ihn byte-gleich).
- „Suche“ prüft den Text am Quelltext: Die Suchbox ist lokaler Zustand, und der Server-Render beginnt immer mit leerer Suche.
- Die ASCII-Prüfung hat zwei Teile: am Quelltext ohne Kommentare das Muster `„…"` (öffnendes „, schließendes ASCII-Zeichen)
  und am gerenderten HTML `&quot;` in Textknoten.
- Nachbesserung nach der Plan-Prüfung (Befunde spec:2, code:3): Warnfarbe Orange in Hinweisband und Karte B1 mit
  einem Test über alle `views/*.tsx` (E25, Gegenprobe d); die Hash-Prüfung bleibt, sagt aber im Kommentar und unter dem
  `FAIL`, dass eine spätere, gewollte Änderung die Hashes neu setzt (Gegenprobe a zeigt die Zeile).
- Zählstände (in der letzten Nachbesserung gemessen): Oberflächen-Lauf rot 143 `ok` (136 + 7), grün 148 `ok` (136 + 12);
  ebenso die `FAIL`-Zeilen und die Gegenproben a–d. Task 12 selbst ist unverändert; die zwei `ok` mehr kommen aus Task 10
  und 11 (Restlücken R3 und R4).

---

## Block D · Abhaken, Abnahme, Doku, Gesamtprüfung (Aufgaben 13–16)

Block D ändert keinen Produktcode. Er hakt die Funktionsliste aus C1 mit einem Test ab (C13), legt die Abnahme-Datei an
(C14), führt Handbuch und Doku nach (C15) und prüft den ganzen Branch gegen die Basis `5e5b234ec3` (C16). Orte und
Dateinamen stammen aus dem Ortsregister mit der Ortsvorgabe je Nummer und aus S-C; die Zählstände der Läufe setzen sich aus
den Aufgaben C1–C12 zusammen.

---

### Task 13: C13 · Funktionsliste abhaken (Spec 10 „nach dem Umbau“)

**Spec:** 10 („Nach dem Umbau wird jeder Punkt abgehakt, mit Ort im neuen Aufbau. Ein Punkt ohne Haken blockiert die
Welle.“; Pflichtpunkt Panel-Tasten; Kürzel bleiben gleich), Anhang A „Titler“. Global Constraints G1, G5, G8, G9, G11, G12.
Review Focus 2.

**Arbeitsverzeichnis/Voraussetzung:** Plan-Worktree, Aufgaben C1–C12 committet. `git status --short` zeigt keine Datei
dieses Plans; fremde, ungestagte Dateien dürfen dastehen.

**Dateien:**
- Create: `apps/titler/test/ui/funktionsliste.test.ts`
- Modify: `apps/titler/test/ui/selftest.ts` (eine Importzeile direkt vor `abschluss();`)
- Modify: `docs/ux/funktionslisten/titler.md` (ein Absatz direkt vor `## 1 · `; die Spalte „künftig wo“ in allen 103 Zeilen
  der Abschnitte 1–7; sonst nichts)

**Interfaces:**
- Consumes:
  - aus C1 die Liste mit den Abschnittsköpfen `## 1 · ` bis `## 10 · `, je Zeile
    `| {Nr} | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | |` (7 Spalten, „künftig wo“ leer als
    `| |`), Nummern fortlaufend 1–103, je Abschnitt 60/12/12/7/1/5/6 Zeilen, Bereich „Tastenkürzel“ in Nr. 93 und
    „Pflichtpunkt Panel“ in Nr. 96, die Pfadregel im Kopf;
  - aus C7 `apps/titler/test/ui/selftest.ts` mit der Zeile `abschluss();` und `@jm/ui/testhilfe` (`ok`, `gleich`,
    `leseText`);
  - aus C8–C12 die Dateien `lib/oberflaeche.ts`, `lib/bruecken.ts`, `views/KopfMitte.tsx`, `views/LiveBereich.tsx`,
    `views/Bedienung.tsx` (mit `persistId` `titler.graphics` und `titler.recall`), `views/Einstellungen.tsx`,
    `views/felder.tsx` (S-B4, S-C) und die Abläufe `remote.onCommand`, `onFileOpened`, `reportState` und `listDisplays` in
    `views/OperatorView.tsx` (G8).
- Produces: die abgehakte Liste (Grundlage für C14 und C15) und den Test `funktionsliste.test.ts` im zweiten Titler-Lauf.

**Verhalten (verbindlich):**
- „künftig wo“ beginnt mit `✓ ` und hat eine dieser Formen, jeweils mit den Dateien in Backticks und wahlweise
  `: {Erläuterung}`:
  - `✓ {Ort} (…)` bzw. `✓ {Ort} › {Feld} (…)`; `{Ort}` ist wörtlich ein Ort des Ortsregisters, danach folgt ein
    Leerzeichen, ein Doppelpunkt oder ein Komma (Nr. 94 nennt so mehrere Orte);
  - `✓ unverändert (…)`: dasselbe Verhalten wie vor dem Umbau; die Klammer nennt die Datei(en), in denen es jetzt steht;
  - `✓ entfällt ({Grund}, E…/OF…)`, ohne Datei;
  - `✓ ersetzt durch {Ort} (…, E…/OF…)`.
- Zum Ortsregister kommt „Einstellungen (Panel)“ für Regeln, die in jedem Abschnitt des Panels gelten (Nr. 96, wie die
  Ortsvorgabe sie nennt).
- Jede Zeile außer „entfällt“ nennt mindestens eine Datei. „entfällt“ (auch mitten im Text) und „ersetzt durch“ stehen nur
  mit einer Entscheidung (E…) oder Owner-Frage (OF…).
- Pfade folgen der Regel im Kopf der Liste: ohne Präfix relativ zu `apps/titler/src/renderer/src/`; `main/`, `preload/`,
  `shared/`, `utility/` und `renderer/` relativ zu `apps/titler/src/`; `app-runtime/` = `packages/app-runtime/src/`, `ui/` =
  `packages/ui/src/components/`; `apps/`, `packages/` und `docs/` ab der Repo-Wurzel. Der Test vergleicht jeden
  Pfadteil mit dem Verzeichnisinhalt; ein falsch geschriebener Name fällt also auch unter Windows auf, wo `existsSync` Groß-
  und Kleinschreibung ignoriert.
- Die Spalte „heute wo“ und die Abschnitte 8–10 bleiben der Stand vor dem Umbau. Neue Bedienelemente (Statusleiste, ⚙,
  Hell/Dunkel-Schalter) sind keine Zeilen der Liste; die Liste sichert nur, dass nichts Altes verloren geht.
- „künftig wo“ und der Test nennen keine Zeilennummern im Code: Orte sind Dateien, damit die Liste nach späteren
  Änderungen wahr bleibt.
- Zwei Querprüfungen gegen den Code: Die `persistId` aus Nr. 99 und Nr. 100 steht in `views/Bedienung.tsx`, und die vier
  Abläufe aus Nr. 73, 79, 80 und 81 stehen in `views/OperatorView.tsx` (G8: sie wirken auch bei geschlossenem Panel).
- Jede Meldung des Tests beginnt mit „Funktionsliste“; die Gegenproben filtern darauf.

---

- [ ] **Step 1: Test schreiben** (Neue Datei `apps/titler/test/ui/funktionsliste.test.ts`, Write-Werkzeug, LF)

```ts
// ─────────────────────────────────────────────────────────────────────────────
// Funktionsliste nach dem Umbau (Spec 10, Aufgabe C13). Jede der 103 Zeilen in den Abschnitten 1–7 von
// docs/ux/funktionslisten/titler.md ist in „künftig wo“ abgehakt: „✓ “ und ein Ort des Ortsregisters, „unverändert (…)“,
// „entfällt (…, E…/OF…)“ oder „ersetzt durch {Ort} (…, E…/OF…)“. Jede genannte Datei existiert, Groß- und
// Kleinschreibung wie im Repo. Dazu zwei Querprüfungen gegen den Code (persistId in der Bedienung, die vier Abläufe in
// OperatorView, G8). Läuft im Paketordner apps/titler (npm run selftest -w @jm/titler, zweiter Lauf).
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';

const LISTE = '../../docs/ux/funktionslisten/titler.md';

/** Ortsregister des Plans; „Einstellungen (Panel)“ steht für Regeln, die in jedem Abschnitt des Panels gelten. */
const ORTE: readonly string[] = [
  'Kopfzeile links (Logo, JM Titler)',
  'Kopfzeile Mitte (Show vom Master)',
  'Kopfzeile rechts (ON AIR)',
  'Kopfzeile rechts (Hell/Dunkel)',
  'Kopfzeile rechts (⚙)',
  'Live-Bereich › Vorschau',
  ...['Take', 'Clear', '◀ Eintrag', 'Eintrag ▶'].map((t) => `Live-Bereich › Haupttasten › ${t}`),
  'Live-Bereich › Hinweiszeile',
  ...['Vorlage', 'Inhalt', 'Grafik-Vorlagen', 'Daten / Recall'].map((b) => `Bedienung › ${b}`),
  'Einstellungen (Panel)',
  ...['iveo', 'NDI-Ausgabe', 'Ausgabe auf Bildschirm', 'Fernsteuerung', 'DataLink', 'Stil', 'Grafik-Vorlagen'].map(
    (a) => `Einstellungen › ${a}`,
  ),
  ...['Master', 'iveo', 'NDI', 'Bildschirm', 'Fernsteuerung', 'DataLink'].map((e) => `Statusleiste › ${e}`),
  'Recall-Board',
  'Ausgabefenster',
];

/** Zeilen je Abschnitt 1–7, wie C1 die Liste anlegt. */
const JE_ABSCHNITT = [60, 12, 12, 7, 1, 5, 6];

/** Datei in Backticks: Pfad mit Endung, aufgelöst nach der Pfadregel im Kopf der Liste. */
const PFAD = /`([A-Za-z0-9_./-]+\.(?:tsx|ts|css|html|json|md|mjs))`/g;
const VERWEIS = /\b(?:E\d+|OF\d+)\b/;

interface Zeile {
  abschnitt: number;
  nr: number;
  zellen: string[];
}

function zeilen(text: string): Zeile[] {
  const liste: Zeile[] = [];
  let abschnitt = 0;
  for (const z of text.split('\n')) {
    const kopf = /^## (\d+) · /.exec(z);
    if (kopf) {
      abschnitt = Number(kopf[1]);
      continue;
    }
    const nr = /^\| (\d+) \|/.exec(z);
    if (nr && abschnitt >= 1 && abschnitt <= 7) {
      liste.push({ abschnitt, nr: Number(nr[1]), zellen: z.split('|').slice(1, -1).map((s) => s.trim()) });
    }
  }
  return liste;
}

/** Pfadregel der Liste: Repo-Wurzel, apps/titler/src, @jm/app-runtime, Bausteine von @jm/ui oder der Renderer. */
function aufgeloest(pfad: string): string {
  if (/^(?:apps|packages|docs)\//.test(pfad)) return `../../${pfad}`;
  if (/^(?:main|preload|shared|utility|renderer)\//.test(pfad)) return `src/${pfad}`;
  if (pfad.startsWith('app-runtime/')) return `../../packages/app-runtime/src/${pfad.slice('app-runtime/'.length)}`;
  if (pfad.startsWith('ui/')) return `../../packages/ui/src/components/${pfad.slice('ui/'.length)}`;
  return `src/renderer/src/${pfad}`;
}

/** Gibt es die Datei mit genau dieser Schreibweise? Jeder Pfadteil wird mit dem Verzeichnisinhalt verglichen. */
function gibtEs(pfad: string): boolean {
  let ort = '';
  for (const teil of aufgeloest(pfad).split('/')) {
    if (teil !== '..') {
      try {
        if (!readdirSync(ort === '' ? '.' : ort).includes(teil)) return false;
      } catch {
        return false;
      }
    }
    ort = ort === '' ? teil : `${ort}/${teil}`;
  }
  return existsSync(ort);
}

/** Ort am Anfang des Texts: ein Eintrag des Ortsregisters, danach Leerzeichen, Doppelpunkt, Komma oder das Ende. */
function ortAm(text: string): string | undefined {
  return ORTE.find((o) => text.startsWith(o) && /^(?:[ :,]|$)/.test(text.slice(o.length)));
}

/** null = Zeile abgehakt; sonst der erste Grund, warum nicht. */
function zeilenFehler(z: Zeile): string | null {
  if (z.zellen.length !== 7) return `${z.zellen.length} statt 7 Spalten`;
  const k = z.zellen[6];
  if (!k.startsWith('✓ ')) return '„künftig wo“ ohne Haken';
  const rest = k.slice(2);
  const ohneCode = k.replace(/`[^`]*`/g, '');
  if (ohneCode.includes('"')) return 'ASCII-Anführungszeichen';
  let form: string | undefined;
  if (rest.startsWith('unverändert (')) form = 'unverändert';
  else if (rest.startsWith('entfällt (')) form = 'entfällt';
  else if (rest.startsWith('ersetzt durch ')) form = ortAm(rest.slice('ersetzt durch '.length)) && 'ersetzt durch';
  else form = ortAm(rest);
  if (form === undefined) return `Ort nicht aus dem Ortsregister: ${rest.slice(0, 40)}`;
  if (form === 'ersetzt durch' && !VERWEIS.test(ohneCode)) return '„ersetzt durch“ ohne E- oder OF-Verweis';
  if (ohneCode.includes('entfällt') && !VERWEIS.test(ohneCode)) return '„entfällt“ ohne E- oder OF-Verweis';
  const pfade = [...k.matchAll(PFAD)].map((m) => m[1]);
  if (form !== 'entfällt' && pfade.length === 0) return 'Ort ohne Datei';
  const fehlt = pfade.filter((p) => !gibtEs(p));
  return fehlt.length > 0 ? `Datei fehlt: ${fehlt.join(', ')}` : null;
}

const alle = zeilen(leseText(LISTE));

gleich(alle.length, 103, 'Funktionsliste: 103 Zeilen in den Abschnitten 1–7 (Stand C1)');
gleich(
  JE_ABSCHNITT.map((_, i) => alle.filter((z) => z.abschnitt === i + 1).length),
  JE_ABSCHNITT,
  'Funktionsliste: Zeilen je Abschnitt wie in C1 (60/12/12/7/1/5/6)',
);
gleich(
  alle.map((z) => z.nr),
  alle.map((_, i) => i + 1),
  'Funktionsliste: Nummern fortlaufend ab 1',
);

for (const z of alle) {
  const f = zeilenFehler(z);
  ok(f === null, `Funktionsliste Nr. ${z.nr} abgehakt${f === null ? '' : ` – ${f}`}`);
}

const zeile = (nr: number): Zeile | undefined => alle.find((z) => z.nr === nr);
const kuenftig = (nr: number): string => zeile(nr)?.zellen[6] ?? '';
const quelle = (pfad: string): string => (gibtEs(pfad) ? readFileSync(aufgeloest(pfad), 'utf8') : '');

ok(
  kuenftig(7).startsWith('✓ Live-Bereich › Haupttasten › Take (') && kuenftig(7).includes('`views/LiveBereich.tsx`'),
  'Funktionsliste Nr. 7 (Take): Live-Bereich › Haupttasten › Take in views/LiveBereich.tsx',
);
// Die Kürzel des Electron-Standardmenüs gehören zu Nr. 93 (vor und nach dem Umbau), die Wirkung von Strg+R zu Nr. 97,
// gemessen in Abnahme 5c (OF11). Fällt das Menü aus einer Spalte, ist die Pflichtzeile nicht mehr vollständig.
ok(
  zeile(93)?.zellen[1] === 'Tastenkürzel' &&
    ['Electron-Standardmenü', 'Strg+R'].every((w) => (zeile(93)?.zellen[2] ?? '').includes(w)) &&
    kuenftig(93).startsWith('✓ ') &&
    kuenftig(93).includes('keine') &&
    kuenftig(93).includes('Electron-Standardmenü'),
  'Funktionsliste Nr. 93 (Pflichtzeile Tastenkürzel): abgehakt, keine eigenen Kürzel, das Electron-Standardmenü vor und nach dem Umbau genannt (Spec 10, UO5, OF11)',
);
ok(
  ['Standardmenü', 'Strg+R', 'Abnahme 5c'].every((w) => (zeile(97)?.zellen[2] ?? '').includes(w)) &&
    kuenftig(97).startsWith('✓ ') &&
    ['Electron-Standardmenü', 'Strg+R', 'Abnahme 5c'].every((w) => kuenftig(97).includes(w)),
  'Funktionsliste Nr. 97 (Menü): Electron-Standardmenü und die Wirkung von Strg+R genannt, gemessen in Abnahme 5c (OF11)',
);
ok(
  zeile(96)?.zellen[1] === 'Pflichtpunkt Panel' &&
    kuenftig(96).startsWith('✓ ') &&
    ['Leertaste', 'Escape', 'Feld', 'Schalter'].every((w) => kuenftig(96).includes(w)),
  'Funktionsliste Nr. 96 (Pflichtpunkt Panel): Leertaste und Escape, je für Feld und Schalter (Spec 10, O1)',
);

for (const [nr, id] of [
  [99, 'titler.graphics'],
  [100, 'titler.recall'],
] as const) {
  ok(
    (zeile(nr)?.zellen[2] ?? '').includes(`jm.collapsible.${id}`) &&
      kuenftig(nr).startsWith('✓ Bedienung › ') &&
      kuenftig(nr).includes(`\`${id}\``) &&
      kuenftig(nr).includes('`views/Bedienung.tsx`') &&
      quelle('views/Bedienung.tsx').includes(id),
    `Funktionsliste Nr. ${nr}: gleiche persistId ${id}, steht in views/Bedienung.tsx`,
  );
}

for (const [wort, imCode] of [
  ['remote.onCommand', 'remote.onCommand'],
  ['onFileOpened', 'onFileOpened'],
  ['remote.reportState', 'reportState'],
  ['listDisplays()', 'listDisplays'],
] as const) {
  const z = alle.find((x) => x.abschnitt === 3 && x.zellen[3].includes(wort));
  ok(
    z !== undefined &&
      z.zellen[6].includes('`views/OperatorView.tsx`') &&
      quelle('views/OperatorView.tsx').includes(imCode),
    `Funktionsliste: ${wort} bleibt in OperatorView, wirkt bei geschlossenem Panel (G8)`,
  );
}
```

- [ ] **Step 2: Test in den zweiten Titler-Lauf hängen** (`apps/titler/test/ui/selftest.ts`, Edit-Werkzeug)

Einfügen in `apps/titler/test/ui/selftest.ts` direkt vor der Zeile `abschluss();`:
```ts
import './funktionsliste.test';
```

- [ ] **Step 3: Rot-Lauf**

```
SP='<eigener Scratchpad>'; [ -d "$SP" ] && { npm run selftest -w @jm/titler > "$SP/c13-rot.log" 2>&1; echo "Exit=$?"; grep -c "^FAIL" "$SP/c13-rot.log"; grep -c "^FAIL Funktionsliste" "$SP/c13-rot.log"; grep -c "^ok   Funktionsliste" "$SP/c13-rot.log"; grep "FEHLGESCHLAGEN" "$SP/c13-rot.log"; grep "^FAIL" "$SP/c13-rot.log" | sed -n '1p;103,113p'; }
```
Erwartet (gemessen): `Exit=1`, dann:
```
113
113
3
113 FEHLGESCHLAGEN
FAIL Funktionsliste Nr. 1 abgehakt – „künftig wo“ ohne Haken
FAIL Funktionsliste Nr. 103 abgehakt – „künftig wo“ ohne Haken
FAIL Funktionsliste Nr. 7 (Take): Live-Bereich › Haupttasten › Take in views/LiveBereich.tsx
FAIL Funktionsliste Nr. 93 (Pflichtzeile Tastenkürzel): abgehakt, keine eigenen Kürzel, das Electron-Standardmenü vor und nach dem Umbau genannt (Spec 10, UO5, OF11)
FAIL Funktionsliste Nr. 97 (Menü): Electron-Standardmenü und die Wirkung von Strg+R genannt, gemessen in Abnahme 5c (OF11)
FAIL Funktionsliste Nr. 96 (Pflichtpunkt Panel): Leertaste und Escape, je für Feld und Schalter (Spec 10, O1)
FAIL Funktionsliste Nr. 99: gleiche persistId titler.graphics, steht in views/Bedienung.tsx
FAIL Funktionsliste Nr. 100: gleiche persistId titler.recall, steht in views/Bedienung.tsx
FAIL Funktionsliste: remote.onCommand bleibt in OperatorView, wirkt bei geschlossenem Panel (G8)
FAIL Funktionsliste: onFileOpened bleibt in OperatorView, wirkt bei geschlossenem Panel (G8)
FAIL Funktionsliste: remote.reportState bleibt in OperatorView, wirkt bei geschlossenem Panel (G8)
FAIL Funktionsliste: listDisplays() bleibt in OperatorView, wirkt bei geschlossenem Panel (G8)
```
Die 113 sind 103 Zeilen ohne Haken und zehn Einzelprüfungen; alle `FAIL`-Zeilen kommen aus diesem Test (erste und zweite
Zahl gleich). Die drei Zählprüfungen (103 Zeilen, Zeilen je Abschnitt, Nummern fortlaufend) sind schon grün, weil C1 die
Liste so angelegt hat. Der erste Lauf (`test/selftest.ts`) endet mit `ALLE TESTS OK`, die Tests aus C7–C12 im zweiten Lauf
bleiben grün (im Log zusammen 689 `ok`: 538 + 148 + 3). Jede andere Zahl oder `FAIL`-Zeile ist ein Befund (G16).

- [ ] **Step 4: Kopfabsatz „Stand nach dem Umbau“** (`docs/ux/funktionslisten/titler.md`, Edit-Werkzeug)

Einfügen in `docs/ux/funktionslisten/titler.md` direkt vor der Zeile `## 1 · `:
```markdown
**Stand nach dem Umbau (Welle 0, Titler-Pilot, Aufgabe C13):** Jede Zeile der Abschnitte 1–7 ist in „künftig wo“
abgehakt, mit dem Ort im neuen Aufbau (Ortsregister des Plans `docs/superpowers/plans/2026-10-13-ux-titler-pilot.md`) und
der Datei; die Pfade folgen der Regel oben. „unverändert“ heißt: dasselbe Verhalten wie vor dem Umbau, die Klammer nennt
die Datei(en), in denen es jetzt steht. „entfällt“ und „ersetzt durch“ stehen nur mit einer Entscheidung (E…) oder
Owner-Frage (OF…) aus dem Plan. „Einstellungen (Panel)“ meint Regeln, die in jedem Abschnitt des Panels gelten. Die Spalte
„heute wo“ und die Abschnitte 8–10 bleiben der Stand vor dem Umbau. Den Haken prüft
`apps/titler/test/ui/funktionsliste.test.ts`.

```

- [ ] **Step 5: Abschnitt 1 „Hauptfenster“ abhaken, Nr. 1–60 (`docs/ux/funktionslisten/titler.md`, Edit-Werkzeug)**

Nr. 1 (Fenster: Lade-Anzeige „Lädt…“ (ersetzt die ganze Ansicht)). Vorher:
```text
| |
| 2 |
```
Nachher:
```text
| ✓ unverändert (`views/OperatorView.tsx`): „Lädt…“ ersetzt die ganze Ansicht, bis der erste Zustand da ist; bei scheiterndem `getState` bleibt es stehen (Store byte-gleich, Folgeaufgabe) |
| 2 |
```

Nr. 2 (Kopfzeile: Logo, „JM TITLER“, „Live-CG → NDI“). Vorher:
```text
| |
| 3 |
```
Nachher:
```text
| ✓ Kopfzeile links (Logo, JM Titler) (`views/OperatorView.tsx`, `packages/ui/src/components/AppHeader.tsx`): über `AppShell` mit dem Werkzeugnamen „Titler“; der Untertitel „Live-CG → NDI“ entfällt (Spec 3.2, E18) |
| 3 |
```

Nr. 3 (Kopfzeile: Verbund-Abzeichen (V-Zeile V2–V15, Rahmen- und Textfarbe …). Vorher:
```text
| |
| 4 |
```
Nachher:
```text
| ✓ Kopfzeile Mitte (Show vom Master) (`views/KopfMitte.tsx`, `lib/bruecken.ts`, `ui/StatusPill.tsx`): `VerbundZeile` als `StatusPill` mit Zustand statt Textfarbe, mit „…“ gekürzt (`kuerzen`), der volle Text als Tooltip; ohne Zeile bleibt die Mitte leer (G4, E18) |
| 4 |
```

Nr. 4 (Kopfzeile: Pill „Suite · ⟨n⟩ verbunden“ / „Suite getrennt“, Punkt …). Vorher:
```text
| |
| 5 |
```
Nachher:
```text
| ✓ ersetzt durch Statusleiste › Fernsteuerung (`lib/oberflaeche.ts`, E6, OF2): „bereit · {n} verbunden“, „aus“, „Port belegt“, „Fehler: …“ oder „unbekannt“ aus der Fernsteuerungs-Meldung des Steuerservers statt „Suite getrennt“; Port 8726 und Modus unter Einstellungen › Fernsteuerung |
| 5 |
```

Nr. 5 (Kopfzeile: Pill „NDI · ⟨n⟩ Empfänger“ / „NDI aus“). Vorher:
```text
| |
| 6 |
```
Nachher:
```text
| ✓ ersetzt durch Statusleiste › NDI (`lib/oberflaeche.ts`, E7): „aus“ bzw. „an (ohne Rückmeldung)“, Empfänger nur bei NDI an und mehr als 0; nie ● ohne Rückmeldung des Senders (OF6) |
| 6 |
```

Nr. 6 (Live-Bereich: CG-Vorschau (Canvas 960×540 auf Schachbrett .cg-checker)). Vorher:
```text
| |
| 7 |
```
Nachher:
```text
| ✓ Live-Bereich › Vorschau (`views/LiveBereich.tsx`): weiter das erste `<canvas>` im Bedienfenster, 960×540 auf dem Schachbrett (G4) |
| 7 |
```

Nr. 7 (Live-Bereich: Knopf „● Take (On Air)“, Ring solange live). Vorher:
```text
| |
| 8 |
```
Nachher:
```text
| ✓ Live-Bereich › Haupttasten › Take (`views/LiveBereich.tsx`): `TallyButton` „Take“, live solange `live`, nie gesperrt, Handler `take()` wie heute (E11, E12); ON AIR steht in der Kopfzeile rechts |
| 8 |
```

Nr. 8 (Live-Bereich: Knopf „Clear“). Vorher:
```text
| |
| 9 |
```
Nachher:
```text
| ✓ Live-Bereich › Haupttasten › Clear (`views/LiveBereich.tsx`): `TallyButton` „Clear“, immer bereit, nie gesperrt, Handler `clear()` wie heute (E12) |
| 9 |
```

Nr. 9 (Live-Bereich: Hinweiszeile unter Take/Clear: „NDI-Quelle aktiv — in …). Vorher:
```text
| |
| 10 |
```
Nachher:
```text
| ✓ Live-Bereich › Hinweiszeile (`views/LiveBereich.tsx`, `lib/oberflaeche.ts`): bei NDI an der Text von heute; bei NDI aus „NDI unter Einstellungen › NDI-Ausgabe starten …“ statt „NDI rechts starten …“ (T4, OF8) |
| 10 |
```

Nr. 10 (Steuerpult: Reiter „Steuerung“ / „Einstellungen“ (role=tab)). Vorher:
```text
| |
| 11 |
```
Nachher:
```text
| ✓ entfällt (Einstellungen im Panel über ⚙ bzw. Statuseintrag, E14) |
| 11 |
```

Nr. 11 (Steuerung › Vorlage: 4 Knöpfe „Bauchbinde“, „Banner“, „Ticker“, …). Vorher:
```text
| |
| 12 |
```
Nachher:
```text
| ✓ Bedienung › Vorlage (`views/Bedienung.tsx`): vier Knöpfe, immer offen neben der Vorschau, Handler `setConfig({ template })` wie heute |
| 12 |
```

Nr. 12 (Steuerung › Inhalt: Feld „Name“). Vorher:
```text
| |
| 13 |
```
Nachher:
```text
| ✓ Bedienung › Inhalt (`views/Bedienung.tsx`): Feld „Name“ aus `@jm/ui` (`Field`, `TextInput`), bei Vorlage Bauchbinde, je Tastendruck wie heute (E23) |
| 13 |
```

Nr. 13 (Steuerung › Inhalt: Feld „Untertitel“). Vorher:
```text
| |
| 14 |
```
Nachher:
```text
| ✓ Bedienung › Inhalt (`views/Bedienung.tsx`): Feld „Untertitel“ aus `@jm/ui`, bei Vorlage Bauchbinde, je Tastendruck wie heute (E23) |
| 14 |
```

Nr. 14 (Steuerung › Inhalt: Feld „Banner-Text“). Vorher:
```text
| |
| 15 |
```
Nachher:
```text
| ✓ Bedienung › Inhalt (`views/Bedienung.tsx`): Feld „Banner-Text“ aus `@jm/ui`, bei Vorlage Banner (E23) |
| 15 |
```

Nr. 15 (Steuerung › Inhalt: Feld „Ticker-Text“). Vorher:
```text
| |
| 16 |
```
Nachher:
```text
| ✓ Bedienung › Inhalt (`views/Bedienung.tsx`): Feld „Ticker-Text“ aus `@jm/ui`, bei Vorlage Ticker (E23) |
| 16 |
```

Nr. 16 (Steuerung › Inhalt: Schieber „Ticker-Tempo“ (0,02–0,30, Schritt 0,01, …). Vorher:
```text
| |
| 17 |
```
Nachher:
```text
| ✓ Bedienung › Inhalt (`views/Bedienung.tsx`, `views/felder.tsx`): Schieber „Ticker-Tempo“ als lokaler `Slider`, Bereich und Schritt wie heute (E23) |
| 17 |
```

Nr. 17 (Steuerung › Inhalt: Je Slot der aktiven Grafik-Vorlage ein Feld (Label …). Vorher:
```text
| |
| 18 |
```
Nachher:
```text
| ✓ Bedienung › Inhalt (`views/Bedienung.tsx`): je Slot der Grafik-Vorlage ein Feld aus `@jm/ui`, Handler wie heute (E23) |
| 18 |
```

Nr. 18 (Steuerung › Inhalt: Text „Diese Vorlage hat keine Textfelder (reines …). Vorher:
```text
| |
| 19 |
```
Nachher:
```text
| ✓ Bedienung › Inhalt (`views/Bedienung.tsx`): Text „Diese Vorlage hat keine Textfelder (reines Standbild).“ wie heute |
| 19 |
```

Nr. 19 (Steuerung › Inhalt: Text „Keine Grafik-Vorlage gewählt — unter …). Vorher:
```text
| |
| 20 |
```
Nachher:
```text
| ✓ Bedienung › Inhalt (`views/Bedienung.tsx`, `lib/oberflaeche.ts`): „Keine Grafik-Vorlage gewählt — unter „Grafik-Vorlagen“ auswählen oder unter Einstellungen › Grafik-Vorlagen importieren.“ (T6, OF8) |
| 20 |
```

Nr. 20 (Steuerung › Grafik-Vorlagen: Abschnittskopf (auf/zu, aria-expanded) und …). Vorher:
```text
| |
| 21 |
```
Nachher:
```text
| ✓ Bedienung › Grafik-Vorlagen (Kopf, `views/Bedienung.tsx`) und Einstellungen › Grafik-Vorlagen (Beschreibung, `views/Einstellungen.tsx`): Kopf als `Collapsible`, Start zu, gleiche `persistId` `titler.graphics`; die Beschreibung steht im Panel (E13) |
| 21 |
```

Nr. 21 (Steuerung › Grafik-Vorlagen: Ablagefläche „oder .psd / .jmtitler …). Vorher:
```text
| |
| 22 |
```
Nachher:
```text
| ✓ Einstellungen › Grafik-Vorlagen (`views/Einstellungen.tsx`, `views/OperatorView.tsx`): Ablagefläche im Panel; `onDropImport` und der Import-Dialog bleiben in OperatorView (G8); Lesefehler weiter ohne Anzeige (Befund 7, Folgeaufgabe) |
| 22 |
```

Nr. 22 (Steuerung › Grafik-Vorlagen: Knopf „Datei importieren…“). Vorher:
```text
| |
| 23 |
```
Nachher:
```text
| ✓ Einstellungen › Grafik-Vorlagen (`views/Einstellungen.tsx`, `views/OperatorView.tsx`): Knopf „Datei importieren…“; `pickImport` bleibt in OperatorView (G8) |
| 23 |
```

Nr. 23 (Steuerung › Grafik-Vorlagen: Kachel je Vorlage (Vorschaubild oder …). Vorher:
```text
| |
| 24 |
```
Nachher:
```text
| ✓ Bedienung › Grafik-Vorlagen (`views/Bedienung.tsx`): Kachel jetzt `<button>` mit `aria-pressed`, per Tab erreichbar; Klick wählt wie heute über `selectTemplate` (E13) |
| 24 |
```

Nr. 24 (Steuerung › Grafik-Vorlagen: „✕“ je Kachel (Tooltip „Vorlage löschen“)). Vorher:
```text
| |
| 25 |
```
Nachher:
```text
| ✓ Einstellungen › Grafik-Vorlagen › Löschen (`views/Einstellungen.tsx`, `views/OperatorView.tsx`): sichtbarer Knopf „Löschen“ je Vorlage mit dem zugänglichen Namen „Vorlage „{Name}“ löschen“, weiter ohne Rückfrage; `deleteTemplate` bleibt in OperatorView (E13, T7) |
| 25 |
```

Nr. 25 (Steuerung › Grafik-Vorlagen: Text „Noch keine Vorlagen importiert.“). Vorher:
```text
| |
| 26 |
```
Nachher:
```text
| ✓ Bedienung › Grafik-Vorlagen (`views/Bedienung.tsx`, `lib/oberflaeche.ts`): „Noch keine Vorlagen. Import unter Einstellungen › Grafik-Vorlagen.“ (T6, OF8) |
| 26 |
```

Nr. 26 (Steuerung › Daten / Recall: Abschnittskopf (auf/zu)). Vorher:
```text
| |
| 27 |
```
Nachher:
```text
| ✓ Bedienung › Daten / Recall (`views/Bedienung.tsx`): `Collapsible`, Start offen, gleiche `persistId` `titler.recall` |
| 27 |
```

Nr. 27 (Steuerung › Daten / Recall: Quellzeile Q1–Q4 (gekürzt, Tooltip voll): …). Vorher:
```text
| |
| 28 |
```
Nachher:
```text
| ✓ Bedienung › Daten / Recall (`views/Bedienung.tsx`): Quellzeile Q1–Q4 wie heute, gekürzt mit Tooltip |
| 28 |
```

Nr. 28 (Steuerung › Daten / Recall: Stehender Hinweis H1–H7 (Warnfarbe, …). Vorher:
```text
| |
| 29 |
```
Nachher:
```text
| ✓ Bedienung › Daten / Recall (`views/Bedienung.tsx`): Hinweis H1–H7 wie heute, auch bei Quelle master (R2); der Kasten ist orange statt gelb (Spec 4.2, E25) |
| 29 |
```

Nr. 29 (Steuerung › Daten / Recall: Text „Kein Datenordner aktiv. Im Reiter …). Vorher:
```text
| |
| 30 |
```
Nachher:
```text
| ✓ Bedienung › Daten / Recall (`views/Bedienung.tsx`, `lib/oberflaeche.ts`): Text von heute, „Im Reiter Einstellungen › DataLink“ wird „Unter Einstellungen › DataLink“ (T5, OF8) |
| 30 |
```

Nr. 30 (Steuerung › Daten / Recall: Fehlerzeile „DataLink: ⟨Fehler⟩“ (z. B. …). Vorher:
```text
| |
| 31 |
```
Nachher:
```text
| ✓ Bedienung › Daten / Recall (`views/Bedienung.tsx`): Fehlerzeile „DataLink: …“; mit noch geltender Liste bleiben Liste, Zähler und Eintrag-Tasten stehen und bedienbar (E21, benannte Änderung L3) |
| 31 |
```

Nr. 31 (Steuerung › Daten / Recall: Zähler „Einträge · ⟨k⟩/⟨n⟩“ bzw. „Einträge …). Vorher:
```text
| |
| 32 |
```
Nachher:
```text
| ✓ Bedienung › Daten / Recall (`views/Bedienung.tsx`): Zähler „Einträge · k/n“ wie heute (`zaehlerText`) |
| 32 |
```

Nr. 32 (Steuerung › Daten / Recall: Knopf „⧉ Board“ (Tooltip …). Vorher:
```text
| |
| 33 |
```
Nachher:
```text
| ✓ Bedienung › Daten / Recall (`views/Bedienung.tsx`): Knopf „⧉ Board“ wie heute (`openRecall`) |
| 33 |
```

Nr. 33 (Steuerung › Daten / Recall: Knopf „‹“ (Tooltip „Vorheriger Eintrag“)). Vorher:
```text
| |
| 34 |
```
Nachher:
```text
| ✓ Live-Bereich › Haupttasten › ◀ Eintrag (`views/LiveBereich.tsx`): `TallyButton` „◀ Eintrag“ mit `stepEntry(-1)`, am ersten Eintrag gesperrt mit „Erster Eintrag“; das ‹ unter Daten / Recall entfällt (E12) |
| 34 |
```

Nr. 34 (Steuerung › Daten / Recall: Knopf „›“ (Tooltip „Nächster Eintrag“)). Vorher:
```text
| |
| 35 |
```
Nachher:
```text
| ✓ Live-Bereich › Haupttasten › Eintrag ▶ (`views/LiveBereich.tsx`): `TallyButton` „Eintrag ▶“ mit `stepEntry(1)`, am letzten Eintrag gesperrt mit „Letzter Eintrag“; das › unter Daten / Recall entfällt (E12) |
| 35 |
```

Nr. 35 (Steuerung › Daten / Recall: Eintragsliste (Nr. + Label oder „—“, …). Vorher:
```text
| |
| 36 |
```
Nachher:
```text
| ✓ Bedienung › Daten / Recall (`views/Bedienung.tsx`): Eintragsliste wie heute, Klick über `recallSchluessel` |
| 36 |
```

Nr. 36 (Steuerung › Daten / Recall: Variablen des aktiven Eintrags {{k}} = Wert …). Vorher:
```text
| |
| 37 |
```
Nachher:
```text
| ✓ Bedienung › Daten / Recall (`views/Bedienung.tsx`): Variablen, Hilfetext und Quelle wie heute |
| 37 |
```

Nr. 37 (Steuerung › Daten / Recall: „Im Text verwendet:“ mit {{k}}, grün = …). Vorher:
```text
| |
| 38 |
```
Nachher:
```text
| ✓ Bedienung › Daten / Recall (`views/Bedienung.tsx`): „Im Text verwendet:“ wie heute, weiter ohne `slotText` und ohne NFC (Befund 8, Folgeaufgabe) |
| 38 |
```

Nr. 38 (Steuerung › Stil: Abschnittskopf (auf/zu)). Vorher:
```text
| |
| 39 |
```
Nachher:
```text
| ✓ Einstellungen › Stil (`views/Einstellungen.tsx`): eigener Abschnitt im Panel, offen; das `Collapsible` entfällt (E14) |
| 39 |
```

Nr. 39 (Steuerung › Stil: Knöpfe „Unten“ / „Oben“). Vorher:
```text
| |
| 40 |
```
Nachher:
```text
| ✓ Einstellungen › Stil (`views/Einstellungen.tsx`): Knöpfe „Unten“ und „Oben“, Handler wie heute |
| 40 |
```

Nr. 40 (Steuerung › Stil: Schieber „Größe“ (0,6–1,6, Schritt 0,05, Wert mit 2 …). Vorher:
```text
| |
| 41 |
```
Nachher:
```text
| ✓ Einstellungen › Stil (`views/Einstellungen.tsx`, `views/felder.tsx`): Schieber „Größe“ als lokaler `Slider`, Bereich und Schritt wie heute (E23) |
| 41 |
```

Nr. 41 (Steuerung › Stil: Farbwähler „Balken“, „Text“, „Akzent“ (mit …). Vorher:
```text
| |
| 42 |
```
Nachher:
```text
| ✓ Einstellungen › Stil (`views/Einstellungen.tsx`, `views/felder.tsx`): Farbwähler „Balken“, „Text“, „Akzent“ als lokales `ColorField` (E23) |
| 42 |
```

Nr. 42 (Einstellungen › DataLink: Abschnitt mit Beschreibung „Platzhalter …). Vorher:
```text
| |
| 43 |
```
Nachher:
```text
| ✓ ersetzt durch Einstellungen › DataLink (`packages/settings/src/abschnitte/DataLinkSection.tsx`, E24): feste Abschnittstexte statt des Hilfetexts mit „im Reiter Steuerung“; die Erklärung des Dateiformats (CSV mit Kopfzeile = Liste, schlüssel=wert = ein Eintrag, Platzhalter {{name}}) steht danach nur noch im Handbuch (`packages/cookbook/content/tool-manuals/tool-jm-titler.md`) |
| 43 |
```

Nr. 43 (Einstellungen › DataLink: Textfeld Ordnerpfad (Platzhalter „Kein Ordner …). Vorher:
```text
| |
| 44 |
```
Nachher:
```text
| ✓ Einstellungen › DataLink › Ordnerpfad (`views/Einstellungen.tsx`, `packages/settings/src/abschnitte/DataLinkSection.tsx`): Pfadfeld, Übernahme bei Enter bzw. Verlassen statt je Tastendruck, ohne Leerzeichen am Anfang und Ende; bei Quelle master gesperrt (OF4, E10, benannte Änderung L2) |
| 44 |
```

Nr. 44 (Einstellungen › DataLink: Knopf „Durchsuchen…“ (R2: disabled bei …). Vorher:
```text
| |
| 45 |
```
Nachher:
```text
| ✓ Einstellungen › DataLink › Ordner wählen … (`views/Einstellungen.tsx`, `packages/settings/src/abschnitte/DataLinkSection.tsx`): Knopf „Ordner wählen …“ statt „Durchsuchen…“, `pickFolder` wie heute; bei Quelle master gesperrt (G4) |
| 45 |
```

Nr. 45 (Einstellungen › DataLink: Knopf „✕“ (Tooltip „Watchfolder entfernen“) …). Vorher:
```text
| |
| 46 |
```
Nachher:
```text
| ✓ Einstellungen › DataLink › Ordner entfernen (`views/Einstellungen.tsx`, `packages/settings/src/abschnitte/DataLinkSection.tsx`): Knopf „Ordner entfernen“ statt „✕“, setzt den Ordner leer wie heute; bei Quelle master sichtbar gesperrt statt ausgeblendet (OF4, E10) |
| 46 |
```

Nr. 46 (Einstellungen › DataLink: Text „Im Verbund kommen die Speaker vom …). Vorher:
```text
| |
| 47 |
```
Nachher:
```text
| ✓ Einstellungen › DataLink (`views/Einstellungen.tsx`, `lib/oberflaeche.ts`): Sperrgrund aus `datenQuelle.ordnerGesperrt`, „Gesperrt: Im Verbund kommen die Speaker vom Master „…“. …“ (OF7) |
| 47 |
```

Nr. 47 (Einstellungen › DataLink: Knopf K1 „Zurück zum eigenen Ordner …). Vorher:
```text
| |
| 48 |
```
Nachher:
```text
| ✓ Einstellungen › DataLink (`views/Einstellungen.tsx`, `lib/oberflaeche.ts`): K1 „Zurück zum eigenen Ordner (…)“ als Rücksprung des Abschnitts, nur bei Quelle show mit eigenem Ordner (E10) |
| 48 |
```

Nr. 48 (Einstellungen › DataLink: Fehlerzeile „DataLink: ⟨Fehler⟩“). Vorher:
```text
| |
| 49 |
```
Nachher:
```text
| ✓ Einstellungen › DataLink (`lib/oberflaeche.ts`): Fehlertext im Abschnitt, „Ordner nicht gefunden“ als „Ordner fehlt“; dazu Statusleiste › DataLink (E10) |
| 49 |
```

Nr. 49 (Einstellungen › iveo: Kasten „iveo aktiv“ + „⟨n⟩ Speaker aus der …). Vorher:
```text
| |
| 50 |
```
Nachher:
```text
| ✓ ersetzt durch Einstellungen › iveo und Statusleiste › iveo (`lib/oberflaeche.ts`, `packages/settings/src/abschnitte/IveoSection.tsx`, E9, E24): „verbunden“ bei Quelle show und bei master mit verbundenem Master-Link, „Liste aus früherem Stand“ bei H3, H4 und H7 und bei master mit getrenntem Master-Link, dazu die Speakerzahl; der Kasten mit „Abruf im Reiter Steuerung“ entfällt und mit ihm der Hinweis, wie iveo aktiv wird (Titler über eine JM Show mit iveo-Daten öffnen); der steht danach nur noch im Handbuch (`packages/cookbook/content/tool-manuals/tool-jm-titler.md`) |
| 50 |
```

Nr. 50 (Einstellungen › Ausgabe (NDI): Feld „Quellname“). Vorher:
```text
| |
| 51 |
```
Nachher:
```text
| ✓ Einstellungen › NDI-Ausgabe › Quellenname (`views/Einstellungen.tsx`, `packages/settings/src/abschnitte/NdiOutputSection.tsx`): Übernahme bei Enter bzw. Verlassen statt je Tastendruck, ohne Leerzeichen am Anfang und Ende, wirkt wie heute beim nächsten Start (E7, OF14, benannte Änderung L1) |
| 51 |
```

Nr. 51 (Einstellungen › Ausgabe (NDI): Auswahl „Auflösung“ (1920×1080, 1280×720)). Vorher:
```text
| |
| 52 |
```
Nachher:
```text
| ✓ Einstellungen › NDI-Ausgabe › Auflösung (`views/Einstellungen.tsx`, `packages/settings/src/abschnitte/NdiOutputSection.tsx`): 1920×1080 und 1280×720 wie heute (E7) |
| 52 |
```

Nr. 52 (Einstellungen › Ausgabe (NDI): Auswahl „fps“ (25, 30, 50, 60)). Vorher:
```text
| |
| 53 |
```
Nachher:
```text
| ✓ Einstellungen › NDI-Ausgabe › Bildrate (`views/Einstellungen.tsx`, `packages/settings/src/abschnitte/NdiOutputSection.tsx`): 25, 30, 50 und 60 wie heute (E7) |
| 53 |
```

Nr. 53 (Einstellungen › Ausgabe (NDI): Knopf „NDI starten“ / „NDI stoppen“). Vorher:
```text
| |
| 54 |
```
Nachher:
```text
| ✓ Einstellungen › NDI-Ausgabe › Ausgabe (`views/Einstellungen.tsx`, `packages/settings/src/abschnitte/NdiOutputSection.tsx`, `lib/oberflaeche.ts`): Schalter statt Knopf, Start und Stopp über `startNdi` und `stopNdi` wie heute (E7) |
| 54 |
```

Nr. 54 (Einstellungen › Ausgabe (NDI): Warnung „Auflösung sollte gerade sein.“). Vorher:
```text
| |
| 55 |
```
Nachher:
```text
| ✓ Einstellungen › NDI-Ausgabe (`lib/oberflaeche.ts`): Fehlertext „Auflösung sollte gerade sein.“; dazu Statusleiste › NDI mit „Fehler: Auflösung sollte gerade sein.“ (E7) |
| 55 |
```

Nr. 55 (Einstellungen › Ausgabe (2. Bildschirm): Abschnitt mit Beschreibung …). Vorher:
```text
| |
| 56 |
```
Nachher:
```text
| ✓ ersetzt durch Einstellungen › Ausgabe auf Bildschirm (`packages/settings/src/abschnitte/ScreenOutputSection.tsx`, E24): feste Abschnittstexte statt der Beschreibung |
| 56 |
```

Nr. 56 (Einstellungen › Ausgabe (2. Bildschirm): Auswahl „Monitor“ („Primär …). Vorher:
```text
| |
| 57 |
```
Nachher:
```text
| ✓ Einstellungen › Ausgabe auf Bildschirm › Bildschirm (`packages/settings/src/abschnitte/ScreenOutputSection.tsx`, `views/OperatorView.tsx`): Auswahl „Bildschirm“; die Liste kommt weiter aus `listDisplays` in OperatorView; ein abgezogener Monitor zeigt „Bildschirm fehlt“ (E8) |
| 57 |
```

Nr. 57 (Einstellungen › Ausgabe (2. Bildschirm): Farbwähler „Chroma“ (mit …). Vorher:
```text
| |
| 58 |
```
Nachher:
```text
| ✓ Einstellungen › Ausgabe auf Bildschirm › Hintergrund (`packages/settings/src/abschnitte/ScreenOutputSection.tsx`): Textfeld `#RRGGBB` und Farbwähler (OF3) |
| 58 |
```

Nr. 58 (Einstellungen › Ausgabe (2. Bildschirm): Knopf „Reset“ (Tooltip …). Vorher:
```text
| |
| 59 |
```
Nachher:
```text
| ✓ Einstellungen › Ausgabe auf Bildschirm › Standardfarbe (#00B140) (`packages/settings/src/abschnitte/ScreenOutputSection.tsx`): Knopf „Standardfarbe (#00B140)“ (OF3) |
| 59 |
```

Nr. 59 (Einstellungen › Ausgabe (2. Bildschirm): Knopf „2. Bildschirm …). Vorher:
```text
| |
| 60 |
```
Nachher:
```text
| ✓ Einstellungen › Ausgabe auf Bildschirm › Ausgabe (`packages/settings/src/abschnitte/ScreenOutputSection.tsx`, `lib/oberflaeche.ts`): Schalter statt Knopf, setzt `secondScreenEnabled` wie heute (E8) |
| 60 |
```

Nr. 60 (Einstellungen › Ausgabe (2. Bildschirm): Text „Tipp: Zweitmonitor …). Vorher:
```text
`views/OperatorView.tsx:768-770` | |
```
Nachher:
```text
`views/OperatorView.tsx:768-770` | ✓ ersetzt durch Einstellungen › Ausgabe auf Bildschirm (`packages/settings/src/abschnitte/screen-output.ts`, E24): Tipp `SCREEN_TEXTE.hinweis` „Zweiten Bildschirm wählen, damit die Ausgabe nicht die Bedienoberfläche verdeckt.“ unter der Auswahl, solange die Ausgabe auf den Hauptmonitor zielt |
```

- [ ] **Step 6: Abschnitt 2 „Dialoge und Meldungen“ abhaken, Nr. 61–72 (`docs/ux/funktionslisten/titler.md`, Edit-Werkzeug)**

Nr. 61 (Import-Dialog (Modal, z-50): Dialog „Bauchbinde importieren“; Kopf …). Vorher:
```text
| |
| 62 |
```
Nachher:
```text
| ✓ unverändert (`views/ImportDialog.tsx`, `views/OperatorView.tsx`): geöffnet aus Einstellungen › Grafik-Vorlagen; `importParsed` lebt in OperatorView, der Dialog kommt also auch bei geschlossenem Panel (G8) |
| 62 |
```

Nr. 62 (Import-Dialog: Klick auf den abgedunkelten Hintergrund). Vorher:
```text
| |
| 63 |
```
Nachher:
```text
| ✓ unverändert (`views/ImportDialog.tsx`): auch während des Speicherns aktiv (Befund 7, Folgeaufgabe) |
| 63 |
```

Nr. 63 (Import-Dialog: Knopf „✕“ (Tooltip „Abbrechen“)). Vorher:
```text
| |
| 64 |
```
Nachher:
```text
| ✓ unverändert (`views/ImportDialog.tsx`): während des Speicherns nicht gesperrt (Befund 7, Folgeaufgabe) |
| 64 |
```

Nr. 64 (Import-Dialog: Live-Vorschau (Canvas in Vorlagengröße, Platzhalter …). Vorher:
```text
| |
| 65 |
```
Nachher:
```text
| ✓ unverändert (`views/ImportDialog.tsx`) |
| 65 |
```

Nr. 65 (Import-Dialog: Feld „Name der Vorlage“). Vorher:
```text
| |
| 66 |
```
Nachher:
```text
| ✓ unverändert (`views/ImportDialog.tsx`) |
| 66 |
```

Nr. 66 (Import-Dialog: Überschrift „Textfelder → Variablen“, Erklärtext …). Vorher:
```text
| |
| 67 |
```
Nachher:
```text
| ✓ unverändert (`views/ImportDialog.tsx`) |
| 67 |
```

Nr. 67 (Import-Dialog: Knopf „Abbrechen“). Vorher:
```text
| |
| 68 |
```
Nachher:
```text
| ✓ unverändert (`views/ImportDialog.tsx`) |
| 68 |
```

Nr. 68 (Import-Dialog: Knopf „In Library speichern“ / „Speichere…“). Vorher:
```text
| |
| 69 |
```
Nachher:
```text
| ✓ unverändert (`views/ImportDialog.tsx`): Speicherfehler weiter ohne Anzeige (Befund 7, Folgeaufgabe) |
| 69 |
```

Nr. 69 (Nativer Dialog (Main): „DataLink-Ordner wählen“ (Ordner, Startpfad = …). Vorher:
```text
| |
| 70 |
```
Nachher:
```text
| ✓ unverändert (`main/index.ts`): Main; ausgelöst aus Einstellungen › DataLink über „Ordner wählen …“; bei Quelle master kommt er weiter nicht (R2) |
| 70 |
```

Nr. 70 (Nativer Dialog (Main): „Bauchbinde importieren“ (Datei; Filter …). Vorher:
```text
| |
| 71 |
```
Nachher:
```text
| ✓ unverändert (`main/index.ts`): Main; ausgelöst aus Einstellungen › Grafik-Vorlagen über „Datei importieren…“ |
| 71 |
```

Nr. 71 (Meldung window.alert: „Import fehlgeschlagen: ⟨Fehler⟩“ (z. B. „Nicht …). Vorher:
```text
| |
| 72 |
```
Nachher:
```text
| ✓ unverändert (`views/OperatorView.tsx`): `runImport` bleibt in OperatorView (G8) |
| 72 |
```

Nr. 72 (Meldung window.alert: „Show-Vorlage konnte nicht importiert werden: …). Vorher:
```text
`views/OperatorView.tsx:119-122` | |
```
Nachher:
```text
`views/OperatorView.tsx:119-122` | ✓ unverändert (`views/OperatorView.tsx`): der Show-Vorlagen-Import bleibt in OperatorView (G8) |
```

- [ ] **Step 7: Abschnitt 3 „Abläufe ohne eigenes Bedienelement“ abhaken, Nr. 73–84 (`docs/ux/funktionslisten/titler.md`, Edit-Werkzeug)**

Nr. 73 (Fernsteuerung (Companion, Port 8726): Befehle take, clear, toggle). Vorher:
```text
| |
| 74 |
```
Nachher:
```text
| ✓ unverändert (`views/OperatorView.tsx`): `remote.onCommand` lebt in OperatorView und wirkt auch bei geschlossenem Panel (G8) |
| 74 |
```

Nr. 74 (Fernsteuerung: Befehl template ⟨kind⟩). Vorher:
```text
| |
| 75 |
```
Nachher:
```text
| ✓ unverändert (`views/OperatorView.tsx`): im selben Zuhörer `remote.onCommand` (G8) |
| 75 |
```

Nr. 75 (Fernsteuerung: Befehl text ⟨name⟩ ⟨untertitel⟩ (_ = Leerzeichen, - = …). Vorher:
```text
| |
| 76 |
```
Nachher:
```text
| ✓ unverändert (`views/OperatorView.tsx`): im selben Zuhörer `remote.onCommand` (G8) |
| 76 |
```

Nr. 76 (Fernsteuerung: Befehl graphic ⟨id/nr/name⟩). Vorher:
```text
| |
| 77 |
```
Nachher:
```text
| ✓ unverändert (`views/OperatorView.tsx`): im selben Zuhörer `remote.onCommand` (G8) |
| 77 |
```

Nr. 77 (Fernsteuerung: Befehl slot ⟨key⟩ ⟨text⟩). Vorher:
```text
| |
| 78 |
```
Nachher:
```text
| ✓ unverändert (`views/OperatorView.tsx`): im selben Zuhörer `remote.onCommand` (G8) |
| 78 |
```

Nr. 78 (Fernsteuerung (im Main, zur Abgrenzung): Befehle recall ⟨ref⟩, next, …). Vorher:
```text
| |
| 79 |
```
Nachher:
```text
| ✓ unverändert (`main/index.ts`, `main/control-server.ts`): im Main erledigt; der Steuerserver bekommt nur die lesende Fernsteuerungs-Meldung (N2) |
| 79 |
```

Nr. 79 (Show-Integration (C3): Bauchbinden-Vorlage aus einer .jmshow …). Vorher:
```text
| |
| 80 |
```
Nachher:
```text
| ✓ unverändert (`views/OperatorView.tsx`): `onFileOpened` lebt in OperatorView und wirkt auch bei geschlossenem Panel (G8) |
| 80 |
```

Nr. 80 (Tally / On-Air: Live-Zustand an Main melden). Vorher:
```text
| |
| 81 |
```
Nachher:
```text
| ✓ unverändert (`views/OperatorView.tsx`): `remote.reportState` mit demselben Inhalt, auch bei geschlossenem Panel (G2, G8) |
| 81 |
```

Nr. 81 (Monitore: Monitorliste laden und bei Hot-Plug neu laden). Vorher:
```text
| |
| 82 |
```
Nachher:
```text
| ✓ unverändert (`views/OperatorView.tsx`): `listDisplays()` und `onDisplaysChanged` laden wie heute und bleiben in OperatorView (G8); neu sind der Startwert „nicht geladen“ statt einer leeren Liste und ein Ablehnungs-Zweig: Ein Ladefehler setzt die Liste auf „nicht geladen“, statt die alte Liste unbehandelt stehen zu lassen. In beiden Fällen zeigt Statusleiste › Bildschirm „unbekannt“ (E8) |
| 82 |
```

Nr. 82 (Store (alle Fenster): Erstladen und Abos). Vorher:
```text
| |
| 83 |
```
Nachher:
```text
| ✓ unverändert (`store/titler.ts`, `App.tsx`): byte-gleich (G1) |
| 83 |
```

Nr. 83 (Engine: Frame-Port für NDI empfangen; Vorlagen-Hintergrund nachladen; …). Vorher:
```text
| |
| 84 |
```
Nachher:
```text
| ✓ unverändert (`lib/engine.ts`): byte-gleich (G3) |
| 84 |
```

Nr. 84 (Ansichtswahl: ?view=recall → Recall-Board, ?view=output → Ausgabe, …). Vorher:
```text
`App.tsx:15-18` | |
```
Nachher:
```text
`App.tsx:15-18` | ✓ unverändert (`App.tsx`): byte-gleich (G1) |
```

- [ ] **Step 8: Abschnitt 4 „Recall-Board“ abhaken, Nr. 85–91 (`docs/ux/funktionslisten/titler.md`, Edit-Werkzeug)**

Nr. 85 (Board › Kopf: Logo, „RECALL-BOARD“, „⟨n⟩ Einträge“). Vorher:
```text
| |
| 86 |
```
Nachher:
```text
| ✓ Recall-Board (`views/RecallBoard.tsx`): Kopf wie heute; „Lädt…“ statt „0 Einträge“, solange der Zustand fehlt (E22, T11) |
| 86 |
```

Nr. 86 (Board › Kopf: Suchfeld „Suchen…“ (filtert nach Label, nur im Fenster, …). Vorher:
```text
| |
| 87 |
```
Nachher:
```text
| ✓ Recall-Board unverändert (`views/RecallBoard.tsx`): Suchfeld wie heute |
| 87 |
```

Nr. 87 (Board: Hinweisband (nur H1, H5, H6, role=status)). Vorher:
```text
| |
| 88 |
```
Nachher:
```text
| ✓ Recall-Board (`views/RecallBoard.tsx`, OF1, E25): Hinweisband nur H1, H5 und H6 aus derselben Quelle wie im Bedienfenster, wie heute; orange statt gelb (Spec 4.2) |
| 88 |
```

Nr. 88 (Board: Karte B1 „Auf Sendung, nicht in der Liste: ⟨Label⟩“). Vorher:
```text
| |
| 89 |
```
Nachher:
```text
| ✓ Recall-Board (`views/RecallBoard.tsx`, OF1, E25): Karte B1 wie heute, Rand orange statt gelb (Spec 4.2) |
| 89 |
```

Nr. 89 (Board: Text „Keine Einträge. Wähle im Operator-Fenster einen …). Vorher:
```text
| |
| 90 |
```
Nachher:
```text
| ✓ Recall-Board (`views/RecallBoard.tsx`): Text erst nach dem Laden, vorher „Lädt…“ (E22) |
| 90 |
```

Nr. 90 (Board: Knopf je Eintrag (Raster, aktiver gefüllt, Tooltip Label)). Vorher:
```text
| |
| 91 |
```
Nachher:
```text
| ✓ Recall-Board unverändert (`views/RecallBoard.tsx`) |
| 91 |
```

Nr. 91 (Board: Text „Kein Eintrag passt zu „⟨q⟩“.“). Vorher:
```text
`views/RecallBoard.tsx:87-91` | |
```
Nachher:
```text
`views/RecallBoard.tsx:87-91` | ✓ Recall-Board (`views/RecallBoard.tsx`): „Kein Eintrag passt zu „{q}“.“ mit „ “ statt des ASCII-Schlusszeichens (G5) |
```

- [ ] **Step 9: Abschnitt 5 „Ausgabefenster“ abhaken, Nr. 92 (`docs/ux/funktionslisten/titler.md`, Edit-Werkzeug)**

Nr. 92 (Ausgabe: Vollbild-Canvas in Programmauflösung auf Chroma-Farbe, …). Vorher:
```text
`views/OutputView.tsx:19-57` | |
```
Nachher:
```text
`views/OutputView.tsx:19-57` | ✓ unverändert (`views/OutputView.tsx`, `lib/engine.ts`): byte-gleich, ohne AppShell und ohne Hell/Dunkel (G3, Spec 5.3) |
```

- [ ] **Step 10: Abschnitt 6 „Tastatur“ abhaken, Nr. 93–97 (`docs/ux/funktionslisten/titler.md`, Edit-Werkzeug)**

Nr. 93 (Tastenkürzel: Keine. Kein …). Vorher:
```text
| |
| 94 |
```
Nachher:
```text
| ✓ unverändert (`views/LiveBereich.tsx`, `views/Bedienung.tsx`): keine eigenen Kürzel, auch keine neuen; die Haupttasten zeigen kein Kürzel (UO5, E12); das Electron-Standardmenü bleibt mit denselben Kürzeln, weil der Main unverändert bleibt (G2, OF11; Abnahme 5c) |
| 94 |
```

Nr. 94 (Tastatur nativ: Tab-Fokus; Leertaste/Enter lösen den fokussierten Knopf …). Vorher:
```text
| |
| 95 |
```
Nachher:
```text
| ✓ Live-Bereich › Haupttasten › Take, Clear, ◀ Eintrag und Eintrag ▶, die Bedienung und das Panel (`views/LiveBereich.tsx`, `views/Bedienung.tsx`, `views/Einstellungen.tsx`): per Tab erreichbar, Leertaste und Enter lösen nativ aus, Pfeiltasten in Auswahl und Schieber wie heute; ein gehaltenes Enter löst die vier Haupttasten nur einmal aus (`TallyButton`, benannte Änderung L4); neu erreichbar sind die Kacheln als `<button>`, „Löschen“ ist sichtbar (E13, L5); der Reiter entfällt (E14) |
| 95 |
```

Nr. 95 (Tastatur im Import-Dialog: Escape schließt den Import-Dialog nicht …). Vorher:
```text
| |
| 96 |
```
Nachher:
```text
| ✓ unverändert (`views/ImportDialog.tsx`): Escape schließt den Import-Dialog weiter nicht (Befund 7, Folgeaufgabe) |
| 96 |
```

Nr. 96 (Pflichtpunkt Panel: Leertaste/Escape mit Fokus im Panel. Heute: kein …). Vorher:
```text
| |
| 97 |
```
Nachher:
```text
| ✓ Einstellungen (Panel) (`packages/ui/src/components/SettingsPanel.tsx`, `views/Einstellungen.tsx`, O1): Ein Feld behält jede Taste, die Leertaste tippt dort ein Leerzeichen. Leertaste auf einem Schalter oder Knopf geht ans Tool; der Titler hat kein Kürzel, also löst sie den Schalter bzw. Knopf aus, z. B. den Schalter „Ausgabe“ unter NDI-Ausgabe. Escape mit Fokus im Panel schließt das Panel und erreicht den Titler nie; nur in einem Feld mit geändertem Entwurf verwirft der erste Escape den Entwurf und das Panel bleibt offen, der zweite schließt es, z. B. im Feld „Quellenname“ (Spec 10) |
| 97 |
```

Nr. 97 (Menü / globale Kürzel: Kein …). Vorher:
```text
`:577` | |
```
Nachher:
```text
`:577` | ✓ unverändert (`main/index.ts`): Hauptprozess unverändert (G2), das Electron-Standardmenü bleibt (OF11); die Wirkung von Strg+R misst Abnahme 5c (nach „Take“ auf einer Testquelle: ON AIR, NDI-Ausgabe, Ausgabefenster), Strg+Plus prüft Abnahme 3 |
```

- [ ] **Step 11: Abschnitt 7 „Gemerkte Zustände“ abhaken, Nr. 98–103 (`docs/ux/funktionslisten/titler.md`, Edit-Werkzeug)**

Nr. 98 (localStorage: titler.operator.tab (steuerung/einstellungen): lesen beim …). Vorher:
```text
| |
| 99 |
```
Nachher:
```text
| ✓ entfällt (kein Reiter mehr; das Panel startet zu und merkt nichts, E14) |
| 99 |
```

Nr. 99 (localStorage: jm.collapsible.titler.graphics (1/0)). Vorher:
```text
| |
| 100 |
```
Nachher:
```text
| ✓ Bedienung › Grafik-Vorlagen (`views/Bedienung.tsx`): gleiche `persistId` `titler.graphics` |
| 100 |
```

Nr. 100 (localStorage: jm.collapsible.titler.recall). Vorher:
```text
| |
| 101 |
```
Nachher:
```text
| ✓ Bedienung › Daten / Recall (`views/Bedienung.tsx`): gleiche `persistId` `titler.recall` |
| 101 |
```

Nr. 101 (localStorage: jm.collapsible.titler.style). Vorher:
```text
| |
| 102 |
```
Nachher:
```text
| ✓ entfällt (Stil steht offen im Panel, der Schlüssel `jm.collapsible.titler.style` wird nicht mehr gelesen, E14) |
| 102 |
```

Nr. 102 (sonst: Kein sessionStorage, kein IndexedDB im Renderer (grep). …). Vorher:
```text
| |
| 103 |
```
Nachher:
```text
| ✓ Kopfzeile rechts (Hell/Dunkel) (`views/OperatorView.tsx`, `packages/ui/src/lib/theme.ts`): `ThemeToggle` über `AppHeader`, gemerkt unter `jm-theme` je Arbeitsplatz; das Recall-Board übernimmt es beim Öffnen (`views/RecallBoard.tsx`), das Ausgabefenster bleibt dunkel (E15, G3); sonst weiter kein `sessionStorage` und kein IndexedDB |
| 103 |
```

Nr. 103 (Main-Ablage (zur Einordnung): <userData>/titler-config.json (alle …). Vorher:
```text
`app-runtime/verbund-speicher.ts:26-29` | |
```
Nachher:
```text
`app-runtime/verbund-speicher.ts:26-29` | ✓ unverändert (`main/config.ts`, `main/library.ts`, `main/show-quelle.ts`, `main/iveo-show.ts`, `packages/app-runtime/src/verbund-speicher.ts`): Main-Ablage, vom Pilot nicht berührt (G1) |
```

- [ ] **Step 12: Grün-Lauf**

```
SP='<eigener Scratchpad>'; [ -d "$SP" ] && { npm run selftest -w @jm/titler > "$SP/c13-gruen.log" 2>&1; echo "Exit=$?"; grep -c "^ok" "$SP/c13-gruen.log"; grep -c "^FAIL" "$SP/c13-gruen.log"; grep -c "ALLE TESTS OK" "$SP/c13-gruen.log"; grep -c "^ok   Funktionsliste" "$SP/c13-gruen.log"; }
```
Erwartet (gemessen): `Exit=0`, dann `802`, `0`, `2`, `116`. Die erste Zahl ist der Titler-Stand nach C12 (beide Läufe:
538 + 148) plus 116 aus diesem Test: 3 Zählprüfungen, 103 Zeilen, 10 Einzelprüfungen. Der zweite Lauf allein hat jetzt 264
`ok`.

- [ ] **Step 13: Typprüfung**

```
npm run typecheck -w @jm/titler; echo "Exit=$?"
```
Erwartet: `Exit=0`, keine Zeile `error TS`. `typecheck:test` (C7) erfasst `test/ui/**` und damit `funktionsliste.test.ts`
(gemessen: Exit 0 in etwa 6 s; eine absichtlich falsche Zeile `export const kaputt: number = 'a';` am Ende der Testdatei
ergibt mit `tsc --noEmit -p tsconfig.test.json` `error TS2322` und Exit 2).

- [ ] **Step 14: Gegenproben** (je einmal ändern, laufen lassen, zurückstellen; nie committen)

Jede Probe sichert die Datei in den Scratchpad, ändert genau eine Zeile per `sed`, lässt nur den zweiten Titler-Lauf laufen
und zeigt die `FAIL`-Zeilen dieses Tests; danach kopiert sie die Sicherung zurück. Die Prüfsumme am Ende belegt, dass Liste
und Bedienung wieder byte-gleich sind:
```
SP='<eigener Scratchpad>'; L=docs/ux/funktionslisten/titler.md; B=apps/titler/src/renderer/src/views/Bedienung.tsx
probe() { cp "$1" "$SP/probe.vorher" && sed -i "$2" "$1" && (cd apps/titler && npx tsx --tsconfig tsconfig.test.json test/ui/selftest.ts) | grep "^FAIL Funktionsliste"; echo "--- $1"; cp "$SP/probe.vorher" "$1"; }
[ -d "$SP" ] && { vorher=$(cat "$L" "$B" | md5sum)
probe "$L" '/^| 7 |/s#`views/LiveBereich.tsx`#`views/LiveBereichX.tsx`#'
probe "$L" '/^| 98 |/s#, E14)#)#'
probe "$L" '/^| 4 |/s#, E6, OF2)#)#'
probe "$L" '/^| 11 |/s#✓ Bedienung › Vorlage#✓ Steuerung › Vorlage#'
probe "$L" '/^| 40 |/s#`views/felder.tsx`#`views/Felder.tsx`#'
probe "$L" '/^| 11 |/s#`views/Bedienung.tsx`#`Views/Bedienung.tsx`#'
probe "$L" '/^| 103 |/s#`main/config.ts`#`main/konfig.ts`#'
probe "$L" '/^| 1 |/s#Folgeaufgabe)#"Folgeaufgabe")#'
probe "$B" 's#titler\.recall#titler.rekall#g'
probe "$L" '/^| 93 |/s#Electron-Standardmenü#Electron-Menü#g'
probe "$L" '/^| 97 |/s#Standardmenü#Menü#g'
[ "$(cat "$L" "$B" | md5sum)" = "$vorher" ] && echo "Liste und Bedienung unverändert"; }
```
Erwartet (gemessen):
```
FAIL Funktionsliste Nr. 7 abgehakt – Datei fehlt: views/LiveBereichX.tsx
FAIL Funktionsliste Nr. 7 (Take): Live-Bereich › Haupttasten › Take in views/LiveBereich.tsx
--- docs/ux/funktionslisten/titler.md
FAIL Funktionsliste Nr. 98 abgehakt – „entfällt“ ohne E- oder OF-Verweis
--- docs/ux/funktionslisten/titler.md
FAIL Funktionsliste Nr. 4 abgehakt – „ersetzt durch“ ohne E- oder OF-Verweis
--- docs/ux/funktionslisten/titler.md
FAIL Funktionsliste Nr. 11 abgehakt – Ort nicht aus dem Ortsregister: Steuerung › Vorlage (`views/Bedienung.ts
--- docs/ux/funktionslisten/titler.md
FAIL Funktionsliste Nr. 40 abgehakt – Datei fehlt: views/Felder.tsx
--- docs/ux/funktionslisten/titler.md
FAIL Funktionsliste Nr. 11 abgehakt – Datei fehlt: Views/Bedienung.tsx
--- docs/ux/funktionslisten/titler.md
FAIL Funktionsliste Nr. 103 abgehakt – Datei fehlt: main/konfig.ts
--- docs/ux/funktionslisten/titler.md
FAIL Funktionsliste Nr. 1 abgehakt – ASCII-Anführungszeichen
--- docs/ux/funktionslisten/titler.md
FAIL Funktionsliste Nr. 100: gleiche persistId titler.recall, steht in views/Bedienung.tsx
--- apps/titler/src/renderer/src/views/Bedienung.tsx
FAIL Funktionsliste Nr. 93 (Pflichtzeile Tastenkürzel): abgehakt, keine eigenen Kürzel, das Electron-Standardmenü vor und nach dem Umbau genannt (Spec 10, UO5, OF11)
--- docs/ux/funktionslisten/titler.md
FAIL Funktionsliste Nr. 97 (Menü): Electron-Standardmenü und die Wirkung von Strg+R genannt, gemessen in Abnahme 5c (OF11)
--- docs/ux/funktionslisten/titler.md
Liste und Bedienung unverändert
```
Die fünfte und sechste Probe belegen den Vergleich je Pfadteil in `gibtEs`: Unter Windows ist
`existsSync('src/renderer/src/views/Felder.tsx')` ebenso `true` wie `existsSync('src/renderer/src/Views/Bedienung.tsx')`
(gemessen). Ohne den Vergleich blieben beide Proben grün, und erst die CI unter Linux fände den Fehler. Die siebte belegt,
dass `main/…` gegen `apps/titler/src/` aufgelöst wird, die neunte die Querprüfung gegen den Code. In der neunten Probe
melden auch die Tests aus C10 die geänderte `persistId`; der Filter zeigt nur die Zeilen dieses Tests. Die zehnte und
elfte nehmen das Electron-Standardmenü aus Nr. 93 bzw. Nr. 97 (aus der Spalte „Element“ und aus „künftig wo“): Der
dauerhafte Test bewacht die Erwähnung, nicht nur die einmalige Prüfung aus C1 (letzte Nachbesserung, Restlücke R2).

- [ ] **Step 15: Zeilenenden**

```
node -e "for(const f of ['apps/titler/test/ui/funktionsliste.test.ts','apps/titler/test/ui/selftest.ts','docs/ux/funktionslisten/titler.md']){const t=require('fs').readFileSync(f,'utf8');console.log(f,'CRLF',(t.match(/\r\n/g)||[]).length)}"
```
Erwartet: dreimal `CRLF 0`. Alle drei Dateien sind in diesem Plan neu (C1, C7, C13) und mit LF angelegt; das
Edit-Werkzeug behält LF bei (G11).

- [ ] **Step 16: Commit**

```
git add apps/titler/test/ui/funktionsliste.test.ts apps/titler/test/ui/selftest.ts docs/ux/funktionslisten/titler.md
git status --short
```
Erwartet genau (fremde Dateien darunter bleiben ungestaged):
```
A  apps/titler/test/ui/funktionsliste.test.ts
M  apps/titler/test/ui/selftest.ts
M  docs/ux/funktionslisten/titler.md
```
Dann:
```
git commit -m "test(titler): Funktionsliste nach dem Umbau abgehakt und geprueft" -m "Spalte kuenftig wo in allen 103 Zeilen der Abschnitte 1-7 von docs/ux/funktionslisten/titler.md: Ort nach dem Ortsregister des Plans und Datei, unveraendert, entfaellt oder ersetzt durch mit Entscheidung. test/ui/funktionsliste.test.ts prueft Haken, Ort, vorhandene Dateien je Pfadteil (Gross- und Kleinschreibung), Verweis bei entfaellt und ersetzt durch, die Pflichtzeilen Tastenkuerzel (mit dem Electron-Standardmenue in Nr. 93 und 97) und Panel-Tasten (Spec 10, O1), persistId titler.graphics/titler.recall in views/Bedienung.tsx und die vier Ablaeufe in OperatorView (G8)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Ersetzt wird über den kürzesten eindeutigen Text: das leere Feld am Ende der Zeile n zusammen mit dem Anfang der Zeile
  n+1 (`| |` und `| n+1 |`), bei der letzten Zeile eines Abschnitts das Ende ihres Felds „heute wo“ (Nr. 60, 72, 84, 91,
  92, 97, 103). So hängt C13 nur an der Nummerierung und an sieben Feldern „heute wo“ aus C1, nicht am ganzen Wortlaut der
  Liste.
- Die Ortsvorgabe je Nummer ist übernommen, mit diesen Anpassungen, damit jede Zeile einen Ort des Registers und eine
  Datei hat:
  - Nr. 60: „ersetzt durch Einstellungen › Ausgabe auf Bildschirm (`…/screen-output.ts`, E24)“ statt „ersetzt durch den Tipp
    des Abschnitts“; der Tipp `SCREEN_TEXTE.hinweis` steht in der Erläuterung. Gemessen am Code
    (`screen-output.ts:94`): Der Tipp erscheint nur, solange die Ausgabe auf den Hauptmonitor zielt; heute steht er immer da.
  - Nr. 81: „unverändert (`views/OperatorView.tsx`)“; der neue Startwert „nicht geladen“ und der Ablehnungs-Zweig (E8)
    stehen in der Erläuterung.
  - Nr. 93: „unverändert (`views/LiveBereich.tsx`, `views/Bedienung.tsx`): keine eigenen Kürzel …“ statt „unverändert:
    keine Kürzel“, damit auch diese Zeile eine Datei nennt; dazu der Satz zum Electron-Standardmenü (Nachbesserung,
    Prüfbefund funktionsliste:1, OF11).
  - Nr. 94: „Live-Bereich › Haupttasten › Take, Clear, ◀ Eintrag und Eintrag ▶, die Bedienung und das Panel (…)“ statt
    „Haupttasten, Panel und Kacheln per Tab erreichbar (…)“; so beginnt die Zeile mit einem Ort des Registers, gefolgt von
    einem Komma.
  - „unverändert“ heißt im Kopfabsatz „dasselbe Verhalten, die Klammer nennt die Datei(en), in denen es jetzt steht“, nicht
    „gleiche Datei“: Nr. 71–77 und 79–81 bleiben in `views/OperatorView.tsx`, Nr. 93 nennt die neuen Dateien.
  - Nr. 96: Das Register bekommt „Einstellungen (Panel)“, wie die Ortsvorgabe es nennt (Regel für jeden Abschnitt).
  - Nr. 103 nennt die Dateien der Main-Ablage statt „Main-Ablage“.
- Zusätzlich zum Gerüst prüft der Test die Zeilenzahl je Abschnitt, die fortlaufende Nummerierung, „ersetzt durch“ mit
  E-/OF-Verweis, Ordnernamen je Pfadteil und zwei Querprüfungen gegen den Code (`persistId` in `views/Bedienung.tsx`, die
  vier Abläufe in `views/OperatorView.tsx`).
- Letzte Nachbesserung (Restlücke R2, NB33): Nr. 93 verlangt das Electron-Standardmenü samt Strg+R in der Spalte
  „Element“ und das Standardmenü in „künftig wo“; die neue Einzelprüfung zu Nr. 97 verlangt Standardmenü, Strg+R und
  „Abnahme 5c“ in beiden Spalten. Vorher prüfte nur die einmalige Prüfung aus C1 das Menü; ein späteres Streichen blieb im
  dauerhaften Test grün. Gegenproben 10 und 11.
- Die Rot-Zahl steht ohne die Messmarke aus dem Gerüst (C13-ROT) im Plan: Gezählt werden nur die `FAIL`-Zeilen dieses
  Tests und seine `ok`-Zeilen. Beide hängen nur an C1 (103 Zeilen mit leerem „künftig wo“) und am Test, nicht an C2–C12.
  Die Gesamtzahl `ok` des Rot-Laufs hängt an C3–C12 und wird deshalb nicht verlangt.
- Gegenproben ändern die Dateien per `sed` und stellen sie per `cp` aus einer Sicherung im Scratchpad zurück, nicht mit
  dem Edit-Werkzeug (G9). Grund: elf Proben, zehn davon auf derselben Datei; die Prüfsumme am Ende belegt den Rückbau. Kein
  `git checkout`, kein `git stash`.
- Die Orte folgen den Entscheidungen, die Block C umsetzt (E7–E15, E18, E21–E24, OF3, OF4, OF7, T4–T7, T11). Beim
  Zusammensetzen gegen den echten Stand nach Task 12 geprüft: Jeder Ort und jede genannte Datei passt, keine Nachher-Zeile
  musste angepasst werden (Grün-Lauf und Gegenproben wie angegeben).

**Gemessen beim Zusammensetzen** (14.10.2026, in der Kopie nach Task 1–12):
- C13 hat 106 Operationen (1 neue Datei, 2 Einfügungen, 103 Ersetzungen), Fehler 0; jede Vorher-Stelle genau einmal.
- Rot-Lauf `Exit=1`, 112 `FAIL`, alle aus diesem Test, 687 `ok` (538 + 146 + 3 Zählprüfungen); Grün-Lauf `Exit=0`,
  799 `ok` (538 + 146 + 115), 0 `FAIL`, zweimal `ALLE TESTS OK`; der zweite Lauf allein 261 `ok`.
- `npm run typecheck -w @jm/titler` (mit `typecheck:test`) `Exit=0`, 0 `error TS`.
- Gegenproben wie angegeben, danach „Liste und Bedienung unverändert“; Zeilenenden dreimal `CRLF 0`. Der Kopfabsatz steht
  zwischen dem Kopf der Liste (`---`) und `## 1 · `. Danach tragen alle 103 Zeilen einen Haken (`grep -c '✓'` auf die
  Liste: 103).
- Unter Windows meldet `existsSync` für `src/renderer/src/views/Felder.tsx` und `src/renderer/src/Views/Bedienung.tsx`
  jeweils `true` (gemessen); erst der Vergleich je Pfadteil fängt die beiden Proben.
- Nachgemessen am 15.10.2026 nach der Nachbesserung der Plan-Prüfung (die Befunde spec:3 und funktionsliste:3 bis :6
  ändern nur den Text von Nr. 30, 37, 43, 50, 81, 94 und 96), in einer frischen Kopie mit Task 1–12 aus diesem Plantext: 106 Operationen,
  Fehler 0; Rot-Lauf und Grün-Lauf wie oben (Rot-Block maschinell verglichen), Typprüfung `Exit=0` in 6 s, die Probe mit
  `kaputt` `error TS2322` an `test/ui/funktionsliste.test.ts(182,14)` mit Exit 2, die neun Gegenproben wörtlich wie
  angegeben, `grep -c '✓'` 103, Zeilenenden dreimal `CRLF 0`.
- In der letzten Nachbesserung (15.10.2026; Restlücke R2 im Test, R3 und R4 in Task 10 und 11, R5 in Nr. 97) neu gemessen;
  die Zahlen davor sind damit überholt. 106 Operationen, Fehler 0; Rot-Lauf `Exit=1`, 113 `FAIL`, alle aus diesem Test,
  689 `ok` (538 + 148 + 3); Grün-Lauf `Exit=0`, 802 `ok` (538 + 148 + 116), 0 `FAIL`, zweimal `ALLE TESTS OK`; der zweite
  Lauf allein 264 `ok`; Typprüfung `Exit=0`; die Probe mit `kaputt` `error TS2322` an
  `test/ui/funktionsliste.test.ts(194,14)` mit Exit 2; die elf Gegenproben wörtlich wie angegeben (Ausgabe maschinell
  verglichen), danach „Liste und Bedienung unverändert“; `grep -c '✓'` 103; Zeilenenden dreimal `CRLF 0`.

---

### Task 14: C14 · Abnahme-Datei `docs/ux/ABNAHME-UX-Welle-0.md`

**Spec:** 12 (Abnahme je Welle, Punkte 1–6), 9.1 (released wird nach der Abnahme), Anhang A „Titler“, 10 (Pflichtpunkt
Panel-Tasten). Entscheidungen E2, E4, E6–E10, E12, E15, E18, E19, E22; Owner-Fragen OF1, OF5, OF6, OF9, OF10, OF13. Global
Constraints G5, G11, G12.

**Arbeitsverzeichnis/Voraussetzung:** Plan-Worktree, Task 13 committet.

**Dateien:**
- Create: `docs/ux/ABNAHME-UX-Welle-0.md` (LF)

**Interfaces:**
- Consumes: Orte und Texte aus C8–C12 (Statuseinträge und ihre Texte nach S-B4, `MASTER_LINK_TEXTE` und den `…_TEXTE` aus
  `@jm/settings`, Haupttasten T3, Reihenfolge der Panel-Abschnitte), die Funktionsliste aus C13 (Nr. 93, 94, 96, 97) und die
  Ortsangaben der offenen Abnahmen (`packages/master-link/ABNAHME-2b.md:42`, `:44`; `apps/titler/ABNAHME-2b-R1.md:13`).
- Produces: die Prüfliste für die Owner-Abnahme („Nach der Umsetzung“).

**Verhalten (verbindlich):**
- Format wie `apps/titler/ABNAHME-2b-R1.md`: Titel, Zeile „Spec: …“, **Voraussetzungen:**, Tabelle
  `| # | Schritt | Erwartung | Ergebnis / Datum |` mit leerer letzter Spalte, Hinweise; dann wie
  `packages/master-link/ABNAHME-2b.md` „## Zusatzprüfungen (nicht in Spec 12)“ als nummerierte Liste, jeder Punkt endet auf
  „Ergebnis / Datum:“.
- Die Nummer jeder Tabellenzeile beginnt mit dem Punkt aus Spec 12 (1 Probe-Show, 2 Hell und Dunkel, 3 kleines Fenster,
  4 Statuseinträge, 5 Haupttasten und Kürzel, 6 Einstellungen), danach ein Buchstabe. Jeder der sechs Punkte hat mindestens
  eine Zeile.
- Erwartungen nennen nur, was der Owner sieht (Symbol, Label, Text), keine Dateinamen. Was der Pilot ohne Electron nicht
  messen kann (Brücke beim Start, Standardmenü und Zoom, Mac-Ziehfläche, Ablage außerhalb der Fläche), steht als eigener
  Prüfpunkt mit der Deutung eines Fehlschlags.
- Die Abnahme läuft mit einem lokalen Abnahme-Bau vor dem Release (Spec 9.1, OF13); die Voraussetzungen setzen keinen
  veröffentlichten Titler 0.12.0 voraus.
- Für die Zustände eines Statuseintrags, die der Owner herbeiführen kann, nennt die Tabelle je einen Schritt (Spec 12.4),
  ausdrücklich auch für diese, gemessen an `statusLeiste` nach Task 8: iveo ○ „unbekannt“ über einen Abruf ohne Treffer
  (Hinweis H5, E9), iveo ▲ „Liste aus früherem Stand“ über die Trennung vom Master (E9), DataLink ▲ „keine Einträge“ über
  einen leeren Ordner (E10).
- „Port belegt“ ist reproduzierbar: Ein Node-Einzeiler lauscht wie der Titler auf allen Adressen an 8726 (Hinweis zu 4e).
- Die Schmal-Ansicht ist nur per Zoom erreichbar (`minWidth` 960 bleibt, E19): Eine Stufe „Zoom In“ macht aus 960 px etwa
  877 px.
- Die Fundament-Prüfpunkte 8 (Leertaste = GO auf einem Panel-Schalter) und 11 (auf Sendung und gesperrt) entfallen für den
  Titler: Er hat kein Leertasten-Kürzel, und „Take“ ist nie gesperrt (E12). Prüfpunkt 7 (Take ziehen) und 9 (alle
  Statuseinträge ganz sichtbar) gelten.
- Ein Hinweis übersetzt die Orte der offenen Abnahmen 2a, 2b R1 und 2b R2 in den neuen Aufbau, falls sie erst mit dem Pilot
  laufen (OF9).

- [ ] **Step 1: Prüfbefehl zuerst (rot)**

```
node - <<'EOF'
const fs = require('fs'); const f = 'docs/ux/ABNAHME-UX-Welle-0.md';
const t = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : (console.log('fehlt: ' + f), process.exit(1));
const zeilen = t.split('\n').filter((l) => /^\| \d[a-z]? \|/.test(l)).map((l) => l.split('|').slice(1, -1).map((s) => s.trim()));
console.log(`Zeilen ${zeilen.length}: ${zeilen.map((z) => z[0]).join(' ')}`);
console.log(`4 Spalten, Ergebnis leer: ${zeilen.every((z) => z.length === 4 && z[3] === '')}`);
console.log(`Spec-12-Punkte 1–6: ${[1, 2, 3, 4, 5, 6].map((n) => zeilen.filter((z) => z[0][0] === String(n)).length).join('/')}`);
const zusatz = t.slice(t.indexOf('## Zusatzprüfungen (nicht in Spec 12)'));
console.log(`Zusatzprüfungen: ${(zusatz.match(/^\d+\. \*\*/gm) || []).length}, mit Ergebnis: ${(zusatz.match(/Ergebnis \/ Datum:$/gm) || []).length}`);
console.log(`CRLF ${(t.match(/\r\n/g) || []).length}, ASCII-Anführungszeichen außerhalb von Code: ${(t.replace(/`[^`]*`/g, '').match(/"/g) || []).length}`);
EOF
```
Erwartet heute (gemessen): `fehlt: docs/ux/ABNAHME-UX-Welle-0.md`, Exit 1.

- [ ] **Step 2: Abnahme-Datei schreiben** (Neue Datei `docs/ux/ABNAHME-UX-Welle-0.md`, Write-Werkzeug, LF)

````markdown
# Abnahme Suite-UX-Update Welle 0 · Titler-Pilot (Owner, ein Rechner; 4a, 4b, 4f, 6c und Zusatz 4 mit zwei Rechnern)

Spec: `docs/superpowers/specs/2026-10-08-suite-ux-update-design.md`, Abschnitt 12 und Anhang A „Titler“. Plan:
`docs/superpowers/plans/2026-10-13-ux-titler-pilot.md`. Die Nummer jeder Zeile beginnt mit dem Punkt aus Spec 12:
1 Probe-Show, 2 Hell und Dunkel, 3 kleines Fenster, 4 Statuseinträge, 5 Haupttasten und Kürzel, 6 Einstellungen.

**Voraussetzungen:**
- Titler 0.12.0 ist als Abnahme-Bau installiert: Veröffentlicht wird erst nach dieser Abnahme (Spec 9.1). Die Datei `JM Titler-0.12.0-win-x64.exe` aus dem Branch wird an A (und mit B zur Hand an B) von Hand über die installierte 0.11.0 ausgeführt, im vorgeschlagenen Installationsordner. Der Launcher startet den Titler wie gewohnt über die Kachel und bietet bis zum Release kein Update an. Launcher und Rundown laufen wie im Betrieb.
- Die offenen Abnahmen 2a (`apps/rundown/ABNAHME-2a.md`), 2b Release 1 (`apps/titler/ABNAHME-2b-R1.md`) und 2b Release 2 (`packages/master-link/ABNAHME-2b.md`) laufen vorher, noch mit Titler 0.11.0, also vor der Installation des Abnahme-Baus. Laufen sie erst mit 0.12.0, gilt der Hinweis zu den offenen Abnahmen unten.
- Eine Probe-Show mit iveo-Bindung und Speakern ist zur Hand (wie in `apps/titler/ABNAHME-2b-R1.md`). In iveo wird nichts geschrieben.
- Ein NDI-Empfänger im selben Netz (Mischer, vMix, OBS oder NDI Studio Monitor) und ein zweiter Monitor.
- Für 4a, 4b, 4f, 6c und Zusatz 4 ein zweiter Rechner B, gekoppelt wie in Teil 1 (`packages/master-link/ABNAHME.md`); A ist der Master. Ohne B entfallen nur diese Teile.
- Für 4e Node.js auf dem Rechner (Befehl im Hinweis zu 4e); für 4b und 5d Bitfocus Companion mit dem JM-Suite-Modul oder ein Telnet-Client.
- Die Statusleiste zeigt je Eintrag ein Symbol (● in Ordnung, ▲ Warnung, ⚠ Fehler, ○ aus oder unbekannt), das Label und den Zustand; der Tooltip zeigt beides ganz.

| # | Schritt | Erwartung | Ergebnis / Datum |
| --- | --- | --- | --- |
| 1 | Titler über den Launcher mit der Probe-Show starten. Unter ⚙ › NDI-Ausgabe den Schalter „Ausgabe“ einschalten und die Quelle im Mischer öffnen. Unter ⚙ › Ausgabe auf Bildschirm den zweiten Monitor wählen und „Ausgabe“ einschalten. Unter Daten / Recall einen Speaker abrufen, „Take“, dann „Clear“. | Kopfzeile links „JM Titler“, rechts „bereit“, nach „Take“ die rote Fläche „ON AIR“. Die Bauchbinde erscheint im Mischer mit Alpha und auf dem zweiten Monitor auf Chroma-Grün; „Clear“ blendet beide aus. Das Ausgabefenster sieht aus wie vor dem Pilot. | |
| 2a | Den Hell/Dunkel-Schalter in der Kopfzeile auf Hell stellen. Titler schließen und über die Kachel neu starten. | Der Titler startet in Hell. Kopfzeile, Live-Bereich, Bedienung, Panel und Statusleiste sind gut lesbar; Haupttasten und Statuseinträge zeigen ihre Bedeutung auch ohne Farbe (Text bzw. Symbol). | |
| 2b | In Hell unter Daten / Recall „⧉ Board“ öffnen. | Das Recall-Board öffnet in Hell, ohne Kopf- und Statusleiste des Rahmens. | |
| 2c | In Hell das Ausgabefenster auf dem zweiten Monitor ansehen. | unverändert: Chroma-Fläche, keine helle Fläche, keine Bedienelemente | |
| 2d | Zurück auf Dunkel, Titler neu starten. Das Recall-Board offen lassen, auf Hell und zurück schalten; danach das Board schließen und wieder öffnen. | Der Titler startet in Dunkel. Ein schon offenes Board wechselt erst beim nächsten Öffnen mit (kein Abgleich zwischen offenen Fenstern). | |
| 3 | Das Hauptfenster auf die kleinste Breite ziehen (960 px). Dann einmal vergrößern: Strg und Plus; wirkt das nicht, Alt drücken und im Menü „View“ „Zoom In“ wählen. Die Seite ist dann etwa 877 px breit. ⚙ öffnen und wieder schließen. Mit B zur Hand dasselbe an B. Zum Schluss Strg und 0 bzw. „Actual Size“. | Das Panel liegt über dem Inhalt statt daneben. Kopfzeile und Statusleiste bleiben ganz sichtbar. Die Statusleiste zeigt je Eintrag nur Symbol und Label; alle sechs Einträge (Master, iveo, NDI, Bildschirm, Fernsteuerung, DataLink) stehen ganz da, keiner ist abgeschnitten. An B wird die Anzeige in der Kopfzeilen-Mitte mit „…“ gekürzt und überdeckt die rechte Seite nicht; der Tooltip zeigt den vollen Text (E18). Lässt sich der Titler nicht vergrößern: „nicht erreichbar“ eintragen (Hinweis zu 3). | |
| 4a | Master: an einem Einzelplatz (Rechner ohne Kopplung) die Statusleiste ansehen. Dann an A und an B den Titler starten; an A den Launcher beenden, etwa 30 s warten, wieder starten. | Einzelplatz: ○ „Master aus“. An A ● „Master verbunden mit ⟨A⟩“ (der eigene Launcher ist der Master). An B kurz ▲ „Master sucht …“ bzw. „verbindet …“, dann ● „Master verbunden mit ⟨A⟩“. Launcher an A beendet: an B erst ▲ „Master sucht …“, nach der ersten Suchrunde ⚠ mit dem Text des Master-Links (wie in der Teil-1-Abnahme); nach dem Start an A wieder ●. Nie länger als einen Augenblick „Master unbekannt“. | |
| 4b | iveo: den Titler ohne Show starten; danach mit der Probe-Show. Dann, ohne Sendung, per Companion bzw. Telnet (wie 5d) `TITLER RECALL Niemand` senden (ein Name, den die Liste nicht hat); danach unter Daten / Recall einen Eintrag anklicken. Mit B zur Hand an B im Verbund (Show am Master mit Speakern, wie 4f): den Launcher an A beenden und nach etwa 30 s wieder starten (wie 4a). | Ohne Show ○ „iveo nicht eingerichtet“. Mit Show ● „iveo verbunden“; unter ⚙ › iveo steht die Zahl der Speaker. Nach `TITLER RECALL Niemand` steht unter Daten / Recall „Abruf „Niemand“: nicht in der Liste. Bitte einen Eintrag abrufen.“, und der Eintrag zeigt ○ „iveo unbekannt“ (ein solcher Hinweis kann einen Hinweis zur Liste verdecken); nach dem Abruf wieder ●. An B ● „iveo verbunden“; mit beendetem Launcher an A ▲ „iveo Liste aus früherem Stand“ (die Liste ist der zuletzt vom Master empfangene Stand), nach dem Start an A wieder ●. Dasselbe ▲ erscheint ohne Master, wenn unter Daten / Recall ein Hinweis „Liste aus früherem Stand: …“ steht. | |
| 4c | NDI: unter ⚙ › NDI-Ausgabe „Ausgabe“ aus, dann an; im Mischer die Quelle öffnen und wieder schließen. | Aus: ○ „NDI aus“. An: ▲ „NDI an (ohne Rückmeldung)“, mit geöffneter Quelle nach wenigen Sekunden ▲ „NDI 1 Empfänger · an (ohne Rückmeldung)“. Nie ●: Der Titler bekommt vom NDI-Sender keine Bestätigung. Unter dem Quellenname steht kein „Im Netz: …“; den Namen im Netz kennt der Titler im Pilot nicht (Folgeplan). | |
| 4d | Bildschirm: unter ⚙ › Ausgabe auf Bildschirm „Ausgabe“ aus, an; dann den gewählten Monitor abziehen und wieder anstecken. | Aus: ○ „Bildschirm aus“. An: ▲ „Bildschirm an (ohne Rückmeldung)“. Monitor abgezogen: ⚠ „Bildschirm fehlt“ (die Ausgabe liegt dann wie bisher auf dem Hauptmonitor). Wieder angesteckt: ▲. | |
| 4e | Fernsteuerung: Titler beenden. Port 8726 belegen (Hinweis zu 4e), dann den Titler starten. Danach den belegenden Befehl beenden, den Titler neu starten und Companion verbinden. | Mit belegtem Port: ⚠ „Fernsteuerung Port belegt“. Nach dem Neustart ● „Fernsteuerung bereit · N verbunden“ (ein laufender Launcher zählt mit); mit Companion steigt N um 1. Unter ⚙ › Fernsteuerung stehen Port 8726, der Modus und der Hinweis auf das Companion-Modul „jm-suite“, kein Knopf „Im Launcher einrichten“. Wird der Modus im Launcher geändert, zeigt der Titler bis zu seinem Neustart weiter den Modus, mit dem er läuft; „Neustart nötig“ erscheint im Pilot nicht (kommt mit dem Folgeplan). | |
| 4f | DataLink: ohne Show und ohne Ordner starten; dann unter ⚙ › DataLink einen leeren Ordner wählen, danach einen Ordner mit einer CSV; den Ordner im Explorer umbenennen. Danach mit der Probe-Show ohne eigenen Ordner. Zum Schluss an B im Verbund (Show am Master mit Speakern). | ○ „DataLink kein Ordner“; leerer Ordner ▲ „DataLink keine Einträge“; mit CSV ● „DataLink {n} Einträge“; umbenannt ⚠ „DataLink Ordner fehlt“. Mit der Show ● „DataLink {n} Einträge“, nicht „kein Ordner“. An B unter ⚙ › DataLink: „Gesperrt: Im Verbund kommen die Speaker vom Master „⟨M⟩“. …“; „Ordner wählen …“, das Feld „Ordnerpfad“ und „Ordner entfernen“ sind gesperrt. | |
| 5a | Haupttasten mit der Maus: „Take“, „Clear“. Unter Daten / Recall einen Eintrag wählen, dann „◀ Eintrag“ und „Eintrag ▶“ bis an beide Enden der Liste. | „Take“ zeigt „LIVE“, solange die Bauchbinde auf Sendung ist, und ist nie gesperrt; „Clear“ ist nie gesperrt. Am ersten Eintrag ist „◀ Eintrag“ gesperrt mit „Gesperrt: Erster Eintrag“, am letzten „Eintrag ▶“ mit „Gesperrt: Letzter Eintrag“. Ohne Einträge gibt es nur „Take“ und „Clear“. | |
| 5b | Dieselben Tasten per Touch (falls ein Touchscreen da ist) und per Tab mit Leertaste bzw. Enter. | wie mit der Maus; jede Taste löst genau einmal aus. | |
| 5c | Tastenkürzel: in den Live-Bereich klicken (nicht auf eine Taste), dann Leertaste, Enter und die Pfeiltasten. Danach Strg und R messen, ohne echte Sendung: NDI-Ausgabe und Ausgabe auf Bildschirm an wie in Schritt 1, die NDI-Quelle nur in einer Vorschau, die nicht auf Sendung geht (z. B. NDI Studio Monitor, nicht auf dem Programm eines Mischers). Einen Speaker abrufen, „Take“, dann mit dem Fokus im Bedienfenster Strg und R. | Eigene Kürzel: keine, wie vor dem Pilot. Nichts geht auf Sendung, und der Eintrag wechselt nicht. Strg und R lädt das Bedienfenster neu (Electron-Standardmenü, Funktionsliste Nr. 93 und 97); danach steht der Titler wieder bereit, ⚙ ist zu. Erwartet nach dem Code: Die Kopfzeile zeigt wieder „bereit“ statt „ON AIR“, die Bauchbinde verschwindet aus dem Ausgabefenster. Eintragen, was gemessen wurde: ON AIR in der Kopfzeile, das Bild in der NDI-Vorschau (Bauchbinde weg oder stehen geblieben, Quelle noch da oder weg), das Ausgabefenster (Bauchbinde weg, Fenster noch offen) und die Statuseinträge NDI und Bildschirm nach dem Neuladen. Weicht etwas von der Erwartung ab, ist das ein Befund für den Folgeplan (OF11). | |
| 5d | Companion bzw. Telnet auf Port 8726: `TITLER TAKE`, `TITLER CLEAR`, `TITLER TOGGLE`, `TITLER NEXT`. | ON AIR in der Kopfzeile und „Take“ folgen jedem Befehl; `TITLER NEXT` wechselt den Eintrag wie „Eintrag ▶“. | |
| 6a | ⚙ öffnen, alle Abschnitte durchsehen, ⚙ wieder schließen. Dasselbe mit dem Hauptfenster auf der kleinsten Breite (960 px, ohne Zoom). | Reihenfolge iveo, NDI-Ausgabe, Ausgabe auf Bildschirm, Fernsteuerung, DataLink, Stil, Grafik-Vorlagen. Das Panel schiebt den Inhalt zusammen; Vorschau und Haupttasten bleiben sichtbar. Bei 960 px bleiben für beide nur etwa 160 px Breite (E19): eintragen, ob Vorschau und Tasten dort noch bedienbar sind. | |
| 6b | Den Statuseintrag „NDI“ anklicken; danach „Master“. | Das Panel öffnet am Abschnitt NDI-Ausgabe und hebt ihn etwa 1,5 s mit einem Rand hervor. „Master“ ist kein Knopf (es gibt keinen Abschnitt dafür). | |
| 6c | Sperrgründe: an B im Verbund (wie 4f) den Abschnitt DataLink ansehen; im Live-Bereich „◀ Eintrag“ am ersten Eintrag. | Jede gesperrte Bedienung nennt ihren Grund sichtbar („Gesperrt: …“), auch im Tooltip. | |

**Hinweis zu 3 (Schmal-Ansicht):** Das Hauptfenster lässt sich nicht schmaler als 960 px ziehen; unter 900 px kommt es nur über den Zoom (eine Stufe macht aus 960 px etwa 877 px). Ob Strg und Plus im Titler wirken, ist nicht gemessen (der Titler setzt kein eigenes Menü). Ist Schritt 3 nicht erreichbar, prüft der Controller dieselbe Erwartung in der Galerie (`npm run galerie -w @jm/ui`, Rahmen 800 px, Fundament-Prüfpunkt 9).

**Hinweis zu 4e (Port belegen):** In einer Eingabeaufforderung `node -e "require('net').createServer().listen(8726,()=>console.log('8726 belegt, Strg+C beendet'))"` ausführen, das Fenster offen lassen und erst dann den Titler starten. Der Befehl lauscht wie der Titler auf allen Adressen des Rechners; das gilt, solange in der Fernsteuerungs-Einrichtung des Launchers keine feste Adresse eingetragen ist (Normalfall). Strg+C gibt den Port wieder frei. Der Titler versucht es danach nicht von selbst neu, deshalb der Neustart.

**Hinweis zu 4b bis 4d:** „unbekannt“ und „an (ohne Rückmeldung)“ sind keine Fehler: Sie sagen ehrlich, was der Titler nicht messen kann (Spec 7). Ein ● bei NDI oder Bildschirm wäre ein Befund.

**Hinweis zu den offenen Abnahmen (OF9):** Laufen 2a, 2b R1 oder 2b R2 erst mit Titler 0.12.0, gelten dort diese Orte: „Einstellungen › DataLink“ ist ⚙ › DataLink im Panel; „Durchsuchen…“ heißt „Ordner wählen …“, „✕“ heißt „Ordner entfernen“, und beide sind im Verbund sichtbar gesperrt statt ausgeblendet; „Daten / Recall“ steht unverändert in der Bedienung neben der Vorschau; die Anzeige „vor „Suite · … verbunden““ steht in der Kopfzeilen-Mitte; „‹“ und „›“ unter Daten / Recall sind „◀ Eintrag“ und „Eintrag ▶“ unter der Vorschau.

## Zusatzprüfungen (nicht in Spec 12)

Diese Punkte prüfen den Titler-Pilot dort, wo kein Selbsttest hinkommt: Tasten im Panel, Zeiger-Verhalten der Haupttasten, die Anzeige aus Master-Link 2b R2 im neuen Rahmen, die Brücke beim Start und Abläufe bei geschlossenem Panel. Die Fundament-Prüfpunkte 8 (Leertaste = GO auf einem Panel-Schalter) und 11 (auf Sendung und gesperrt) entfallen für den Titler: Er hat kein Leertasten-Kürzel, und „Take“ ist nie gesperrt. Ergebnis und Datum hinter jedem Punkt eintragen.

1. **Panel-Tasten (Spec 10, Pflichtpunkt der Funktionsliste Nr. 96):** ⚙ öffnen und mit Tab bis zum Schalter „Ausgabe“ unter NDI-Ausgabe gehen, dann die Leertaste drücken: Der Schalter schaltet, NDI startet (der Titler hat kein Kürzel, also bleibt die Taste beim Schalter); ein zweites Mal Leertaste stoppt NDI wieder. Ins Feld „Quellenname“ ein Zeichen tippen: Die Leertaste tippt dort ein Leerzeichen. Escape: Der alte Name steht wieder da, das Panel bleibt offen. Ein zweites Escape: Das Panel schließt, der Fokus steht wieder auf ⚙. Ergebnis / Datum:
2. **Take ziehen (Fundament-Prüfpunkt 7):** „Take“ mit der linken Maustaste drücken, mit gedrückter Taste den Zeiger ganz vom Knopf wegziehen und außerhalb loslassen: Nichts geht auf Sendung. Geht die Bauchbinde trotzdem auf Sendung, ist das ein Befund. Ergebnis / Datum:
3. **Alle Statuseinträge ganz sichtbar (Fundament-Prüfpunkt 9):** in Schritt 3 erledigt; war Schritt 3 nicht erreichbar, hier das Ergebnis der Galerie eintragen. Ergebnis / Datum:
4. **Show vom Master in der Kopfzeile (R2):** An B zeigt die Kopfzeile in der Mitte ● „Show vom Master: ⟨S⟩ · Stand ⟨hh:mm⟩“, bei schmalem Fenster gekürzt, der volle Text steht im Tooltip. Die Zustände aus der R2-Abnahme (▲ „nicht verbunden · letzter Stand …“, ⚠ mit dem Text des Master-Links, ▲ „Daten vom früheren Master …“) erscheinen an derselben Stelle, mit Symbol statt farbiger Schrift. Am Einzelplatz und an A bleibt die Mitte leer. Die Ordnerwahl ist gesperrt wie in 4f. Ergebnis / Datum:
5. **Brücke beim Start:** An B den Titler starten und die Statusleiste in den ersten Sekunden beobachten; dasselbe am Einzelplatz. „Master“ zeigt nach höchstens etwa 2 s „sucht …“, „verbindet …“ oder „verbunden mit ⟨A⟩“, am Einzelplatz „aus“. Bleibt dort „unbekannt“, kommt die Abfrage des Fensters nicht beim Hauptprozess an (ohne Electron nicht messbar); das ist ein Befund. Ergebnis / Datum:
6. **Recall-Board:** Wie in `apps/titler/ABNAHME-2b-R1.md` Schritt 3 und 4 (Speaker auf Sendung, dann ein Side Event ohne ihn): Unter Daten / Recall steht derselbe Hinweis wie vor dem Pilot; das Recall-Board zeigt wie bisher sein Hinweisband und die Karte „Auf Sendung, nicht in der Liste: ⟨Name⟩“. Hinweis-Kasten, Hinweisband und Karte sind jetzt orange statt gelb (Warnfarbe, E25). Beim Öffnen des Boards steht höchstens kurz „Lädt…“, nie „0 Einträge“ oder „Keine Einträge …“ vor der Liste. Ergebnis / Datum:
7. **Grafik-Vorlagen:** Unter ⚙ › Grafik-Vorlagen eine `.psd` über „Datei importieren…“ und eine zweite durch Ziehen auf die Ablagefläche importieren: Der Import-Dialog kommt wie bisher; nach „In Library speichern“ steht die Vorlage unter Grafik-Vorlagen neben der Vorschau und ist gewählt. Die Kacheln lassen sich per Tab erreichen und mit Leertaste wählen. „Löschen“ im Panel entfernt eine Vorlage ohne Rückfrage, wie bisher. Dann eine Datei außerhalb der Ablagefläche ins Fenster fallen lassen und notieren, was passiert (bisher nicht gemessen). Ergebnis / Datum:
8. **Bei geschlossenem Panel:** Panel zu. Im Launcher eine Show mit Bauchbinden-Vorlage öffnen, so dass der laufende Titler den Show-Link bekommt: Die Vorlage wird importiert und unter Grafik-Vorlagen gewählt, ohne dass das Panel offen war, und geht nicht auf Sendung. Ebenso wirken `TITLER TAKE` und `TITLER CLEAR` (5d) bei geschlossenem Panel. Ergebnis / Datum:
9. **Hell mit Import-Dialog:** In Hell eine Vorlage importieren. Der Dialog ist hell und gut lesbar, sein Hintergrund bleibt abgedunkelt; die Schachbrettflächen der Vorschau (im Live-Bereich, in den Kacheln und im Dialog) bleiben dunkel, damit Transparenz sichtbar bleibt. Ergebnis / Datum:
10. **Mac:** Nur falls es den Abnahme-Bau 0.12.0 auch als `.dmg` gibt (OF10): Das Fenster lässt sich an der Kopfzeile ziehen, die Ampel überdeckt weder Logo noch Name. Sonst „entfällt (kein Mac-Build)“ eintragen. Ergebnis / Datum:
````

- [ ] **Step 3: Prüfbefehl (grün)**

Derselbe Befehl wie in Step 1. Erwartet (gemessen):
```
Zeilen 19: 1 2a 2b 2c 2d 3 4a 4b 4c 4d 4e 4f 5a 5b 5c 5d 6a 6b 6c
4 Spalten, Ergebnis leer: true
Spec-12-Punkte 1–6: 1/4/1/6/4/3
Zusatzprüfungen: 10, mit Ergebnis: 10
CRLF 0, ASCII-Anführungszeichen außerhalb von Code: 0
```

- [ ] **Step 4: Gegenprobe Prüfbefehl** (nur im Speicher, die Datei bleibt unverändert)

```
node - <<'EOF'
const t = require('fs').readFileSync('docs/ux/ABNAHME-UX-Welle-0.md', 'utf8').replace('| 4e | ', '| 4e | x | ').replace('(Spec 7).', '(Spec 7)."');
const zeilen = t.split('\n').filter((l) => /^\| \d[a-z]? \|/.test(l)).map((l) => l.split('|').slice(1, -1).map((s) => s.trim()));
console.log(`4 Spalten, Ergebnis leer: ${zeilen.every((z) => z.length === 4 && z[3] === '')}`);
console.log(`ASCII-Anführungszeichen außerhalb von Code: ${(t.replace(/`[^`]*`/g, '').match(/"/g) || []).length}`);
EOF
```
Erwartet (gemessen): `4 Spalten, Ergebnis leer: false` und `ASCII-Anführungszeichen außerhalb von Code: 1`. Der Prüfbefehl
erkennt also eine verrutschte Spalte und ein ASCII-Anführungszeichen.

- [ ] **Step 5: Commit**

```
git add docs/ux/ABNAHME-UX-Welle-0.md
git status --short
```
Erwartet genau:
```
A  docs/ux/ABNAHME-UX-Welle-0.md
```
Dann:
```
git commit -m "docs(ux): Abnahme UX-Welle 0 (Titler-Pilot)" -m "docs/ux/ABNAHME-UX-Welle-0.md im Format der Titler-Abnahme 2b R1: Spec 12 Punkte 1-6 (Probe-Show, Hell und Dunkel, Schmal-Ansicht per Zoom, jeder Statuseintrag in jedem erreichbaren Zustand mit reproduzierbarem Port belegt, Haupttasten und Kuerzel, Einstellungen ueber Zahnrad und Statuseintrag) und Zusatzpruefungen fuer den Titler (Panel-Tasten, Fundament-Pruefpunkte 7 und 9, Show vom Master und Sperre, Bruecke beim Start, Recall-Board, Grafik-Vorlagen, Ablaeufe bei geschlossenem Panel, Hell mit Import-Dialog, Mac); Ortsuebersetzung fuer die offenen Abnahmen (OF9)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Die Tabellennummern tragen den Spec-12-Punkt (1, 2a–2d, 3, 4a–4f, 5a–5d, 6a–6c); so ist „jeder Punkt aus Spec 12 hat eine
  Zeile“ mit dem Prüfbefehl nachweisbar. `apps/titler/ABNAHME-2b-R1.md` hat keinen Abschnitt „Zusatzprüfungen“; dessen Form
  kommt aus `packages/master-link/ABNAHME-2b.md`.
- 4a nennt zusätzlich den Master-Rechner A („verbunden mit ⟨A⟩“, E4: die Rolle wird nicht mitgesendet), 4f die Show ohne
  eigenen Ordner („{n} Einträge“, E10 `externeQuelle`).
- 4b und 4f führen auch diese Zustände herbei (Nachbesserung, Prüfbefund spec:6): ○ „iveo unbekannt“ über
  `TITLER RECALL Niemand` ohne Sendung (Hinweis H5 wie in `apps/titler/ABNAHME-2b-R1.md` Schritt 11b; ein erfolgreicher
  Abruf löscht ihn, `shared/datalink-kern.ts`), ▲ „iveo Liste aus früherem Stand“ über die Trennung vom Master an B (am
  Code gelesen, nicht im Fenster gemessen: Den Hinweis H3 bekommt der Titler erst, wenn dieselbe Show ohne Speaker neu
  geliefert wird; ein Side Event ohne verknüpfte Speaker reicht dafür nicht, weil der Launcher dann die bisherige Liste
  behält, `apps/launcher/src/main/iveo-abgleich-kern.ts`), ▲ „DataLink keine Einträge“ über einen leeren Ordner (ein
  Ordner ohne Datendatei liefert eine leere Liste ohne Fehler, `main/datalink.ts`, Funktion `scan`).
- Die Voraussetzung nennt den Abnahme-Bau statt „über den Launcher installiert“ (Nachbesserung, Prüfbefund spec:1): Spec
  9.1 verlangt das Release erst nach der Abnahme.
- 5c misst die Wirkung von Strg+R (letzte Nachbesserung, Restlücke R5, NB36): Vorher stand dort „abgeleitet, hier nicht
  prüfen“, und OF11 stützte sich auf eine nicht gemessene Wirkung. Gefahrlos ist die Messung, weil die NDI-Quelle nur in
  einer Vorschau läuft; die Erwartung ist aus `main/index.ts` (`titler:report-state`, `did-finish-load` des
  Ausgabefensters) abgeleitet, eingetragen wird, was der Owner sieht.
- Gerüst „Hell-Modus: Import-Dialog und `.cg-checker` bleiben dunkel“: Am Code abgeleitet (nicht gemessen) bleibt nur der
  Hintergrund des Dialogs dunkel (`bg-black/60`, wie bei `Modal`), der Dialog selbst nutzt Tokens und wird hell; die
  Schachbrettflächen haben feste Farben und bleiben dunkel. Zusatz 9 erwartet das so.
- Die Ortsübersetzung für die offenen Abnahmen (OF9) steht immer als Hinweis da, nicht nur bei Ablehnung von OF9; sie
  schadet bei Annahme nicht.
- „Tabelle wortgleich zur Liste im Plan“ prüft der Befehl über die Nummernfolge, die Spaltenzahl und die leere
  Ergebnisspalte; den Wortlaut selbst legt Step 2 fest.

**Gemessen** (14.10.2026, beim Zusammensetzen nach Task 13 bestätigt): Step 1 `fehlt: docs/ux/ABNAHME-UX-Welle-0.md` mit
Exit 1; eine neue Datei; Step 3 und Step 4 wie angegeben; die Datei hat 59 Zeilen, alle mit LF. Nach der Nachbesserung
(Prüfbefunde spec:1 und spec:6; 15.10.2026) nachgemessen: Step 1, 3 und 4 wörtlich wie angegeben, weiter 59 Zeilen. Die
Zustände aus 4b und 4f sind an `statusLeiste` (Task 8) im Stand nach Task 12 gemessen: Show mit Hinweis H5 ○ „iveo
unbekannt“, Quelle master bei Master-Link `sucht` bzw. `fehler` ▲ „iveo Liste aus früherem Stand“, eigener Ordner ohne
Einträge ▲ „DataLink keine Einträge“. In der letzten Nachbesserung (Zeile 5c, Restlücke R5; 15.10.2026) nachgemessen:
Step 1 `fehlt: docs/ux/ABNAHME-UX-Welle-0.md`, Step 3 wörtlich wie angegeben (19 Zeilen, 1/4/1/6/4/3, 10 Zusatzprüfungen,
CRLF 0, ASCII 0), Step 4 `false` und `1`; die Datei hat weiter 59 Zeilen. Der Einzeiler
aus dem Hinweis zu 4e ist nicht ausgeführt (G13: keine Netzdienste beim Planen); dass er wie der Titler auf allen Adressen
lauscht, folgt aus `packages/suite-control-protocol/src/server.ts:205` (`srv.listen(port, this.resolved.bindHost, …)` mit
`bindHost` undefiniert) und Node (`listen(port)` ohne Host). Am Code gelesen: `views/ImportDialog.tsx` nutzt 13-mal
`var(--…)` und für den Hintergrund `bg-black/60` (`:69`); `.cg-checker` hat feste Farben (`globals.css:53-62`).

---

### Task 15: C15 · Handbuch und Doku nachführen

**Spec:** 10 (kein Funktionsverlust, auch nicht in der Anleitung), 5.1, 8, 9.2; Global Constraints G1, G5, G11, G12.
Owner-Regel „Doku nachführen, nicht neu bauen“: nur die genannten Stellen, punktuell.

**Arbeitsverzeichnis/Voraussetzung:** Plan-Worktree, Task 14 committet.

**Dateien:**
- Modify: `packages/cookbook/content/tool-manuals/tool-jm-titler.md` (Zeile 18 `lastReviewed`; Einrichtung Zeilen 47 und
  51; Während Zeilen 54–55; Pannenhilfe Zeilen 73, 75 und 76)
- Modify: `packages/cookbook/cookbook.json` (nur über `npm run cookbook:build`, nie von Hand)
- Modify: `docs/suite-verbund.md` (Zeile 112)
- Modify: `docs/release-titler.md` (Zeilen 84 und 90, Smoke-Test)
- Modify: `docs/ux/suite-ux-roadmap.md` (Zeile 35)
- Modify: `docs/roadmap.md` (Lane E, Zeile 356, nur die Zelle „Stand“ der Zeile „0 · Titler-Pilot“)

**Interfaces:**
- Consumes: Orte und Texte aus C9–C12 (Kopfzeile, Haupttasten, Panel-Abschnitte, Statuseinträge), die Texte der
  Fernsteuerung aus `REMOTE_TEXTE` („bereit · {n} verbunden“, „Port belegt“), `ABSCHNITT_TEXTE.anOhneRueckmeldung`
  („an (ohne Rückmeldung)“), `DATALINK_TEXTE` („kein Ordner“, „Ordner fehlt“, „Ordner wählen …“), die Funktionsliste aus
  C13 und die Abnahme-Datei aus C14.
- Produces: keine Schnittstelle (nur Doku).

**Verhalten (verbindlich):**
- Jede Ersetzung ist punktuell (G11): Die Zeilen davor und danach bleiben; `docs/roadmap.md` wird nur in einer Zelle
  geändert, nie umgebrochen.
- Neue Sätze ohne ASCII-Anführungszeichen; Tool-Texte wörtlich (G5). Das ASCII-Schlusszeichen in Handbuch Zeile 47
  verschwindet mit dem neuen Satz; die in nicht berührten Zeilen (Handbuch 64 und 65) bleiben, sie sind nicht Teil dieser
  Aufgabe.
- Das Handbuch nennt Orte so, wie der Owner sie sieht (Kopfzeile, Statusleiste, „Einstellungen › …“), keine Dateien. Die
  Zeilen 48–50 (NDI einbinden, DataLink, Grafik-Vorlage) nennen keinen Ort des alten Aufbaus und bleiben; die Orte stehen
  gesammelt in der neuen Zeile 47.
- `cookbook.json` entsteht nur über `npm run cookbook:build`; danach meldet `npm run cookbook:check` „frisch“.
- `lastReviewed` ist das Datum, an dem der Text gegen den geplanten Aufbau geprüft wurde (2026-10-13); `build.mjs` setzt
  damit auch `updatedAt` von `cookbook.json`.
- Zeilenenden bleiben je Datei, wie sie sind (G11): vier Dateien mit CRLF, `docs/ux/suite-ux-roadmap.md` mit LF (im
  Worktree `ux-update` gemessen). `cookbook.json` schreibt `build.mjs` mit LF, so wie sie im Repo liegt. Nie gemischt.
- Reine `*.md`-Commits lösen keine CI aus (`paths-ignore`); dieser Commit enthält `cookbook.json` und läuft deshalb durch die
  CI.

- [ ] **Step 1: Prüfbefehle zuerst (Stand vorher)**

```
echo "release-titler alt: $(grep -c 'Suite getrennt\|Suite · N verbunden' docs/release-titler.md)"
echo "suite-verbund alt: $(grep -c 'Titler: vor „Suite' docs/suite-verbund.md)"
echo "Handbuch alt: $(grep -c 'der Reiter „Einstellungen' packages/cookbook/content/tool-manuals/tool-jm-titler.md) · neu: $(grep -c 'Einstellungen › ' packages/cookbook/content/tool-manuals/tool-jm-titler.md)"
echo "Plan-Link: $(grep -c '2026-10-13-ux-titler-pilot.md' docs/roadmap.md) / $(grep -c '2026-10-13-ux-titler-pilot.md' docs/ux/suite-ux-roadmap.md)"
npm run cookbook:check 2>&1 | tail -1
```
Erwartet (gemessen):
```
release-titler alt: 2
suite-verbund alt: 1
Handbuch alt: 1 · neu: 0
Plan-Link: 0 / 0
cookbook.json ist frisch (43 Rezepte).
```

- [ ] **Step 2: Handbuch, Kopf** (`packages/cookbook/content/tool-manuals/tool-jm-titler.md`, Edit-Werkzeug; CRLF)

Vorher:
```yaml
lastReviewed: 2026-07-04
```
Nachher:
```yaml
lastReviewed: 2026-10-13
```

- [ ] **Step 3: Handbuch, Einrichtung** (`packages/cookbook/content/tool-manuals/tool-jm-titler.md`, Zeilen 47 und 51)

Zeile 47. Vorher:
```markdown
- Vorlage wählen (Bauchbinde/Banner/Ticker/Grafik) und Stil einstellen — der Reiter „Einstellungen" bündelt DataLink, iveo-Status, Ausgabe (NDI/2. Bildschirm)
```
Nachher:
```markdown
- Vorlage wählen (Bauchbinde/Banner/Ticker/Grafik) unter **Vorlage** neben der Vorschau. Alles Einrichtende liegt im Panel **Einstellungen**: ⚙ oben rechts oder ein Klick auf einen Eintrag der Statusleiste öffnet es am passenden Abschnitt — iveo, NDI-Ausgabe (der Schalter „Ausgabe“ startet NDI), Ausgabe auf Bildschirm, Fernsteuerung, DataLink („Ordner wählen …“), Stil (Position, Größe, Farben) und Grafik-Vorlagen (Import)
```

Zeile 51. Vorher:
```markdown
- iveo (optional): Wird der Titler über eine iveo-gebundene Show gestartet, materialisiert der Launcher die Speaker automatisch in den DataLink (`speakers.tsv`) — kein Token im Titler nötig
```
Nachher:
```markdown
- iveo (optional): Wird der Titler über eine iveo-gebundene Show gestartet, materialisiert der Launcher die Speaker automatisch in den DataLink (`speakers.tsv`) — kein Token im Titler nötig
- Kopfzeile: in der Mitte im Verbund (gekoppelter Rechner) „Show vom Master: ⟨Show⟩ · Stand ⟨hh:mm⟩“; solange die Speaker vom Master kommen, ist die Ordnerwahl unter Einstellungen › DataLink gesperrt, der Grund steht dort. Rechts **ON AIR** bzw. „bereit“, der Schalter Hell/Dunkel (je Arbeitsplatz gemerkt; das Recall-Board übernimmt ihn beim Öffnen, das Ausgabefenster bleibt unverändert) und ⚙
- Statusleiste unten: Master, iveo, NDI, Bildschirm, Fernsteuerung, DataLink. „unbekannt“ heißt: Der Titler weiß es (noch) nicht; „an (ohne Rückmeldung)“ heißt: eingeschaltet, eine Bestätigung gibt es nicht
```

- [ ] **Step 4: Handbuch, Während** (`packages/cookbook/content/tool-manuals/tool-jm-titler.md`, Zeilen 54–55)

Vorher:
```markdown
- Bauchbinde füllen: Namensfeld ist immer sichtbar; per DataLink `RECALL`/`NEXT`/`PREV` durch die Liste springen
- `TAKE` blendet on air, `CLEAR` blendet aus — lokal oder per Companion/Rundown/Q&A
```
Nachher:
```markdown
- Bauchbinde füllen: **Vorlage** und **Inhalt** (Namensfeld) stehen immer offen neben der Vorschau; per DataLink `RECALL`/`NEXT`/`PREV` durch die Liste springen — lokal mit **◀ Eintrag** / **Eintrag ▶** unter der Vorschau (am Anfang bzw. Ende der Liste gesperrt, der Grund steht auf der Taste) oder per Klick unter **Daten / Recall**
- **Take** blendet on air (die Kopfzeile zeigt **ON AIR**, die Taste „LIVE“), **Clear** blendet aus — lokal oder per Companion/Rundown/Q&A (`TAKE`/`CLEAR`). Tastenkürzel gibt es keine
```

- [ ] **Step 5: Handbuch, Pannenhilfe** (`packages/cookbook/content/tool-manuals/tool-jm-titler.md`, Zeilen 73, 75 und 76)

Zeile 73. Vorher:
```markdown
| NDI-Quelle taucht im Mischer nicht auf | Gleiches Subnetz? NDI-Discovery/Firewall frei? Titler wirklich gestartet? |
```
Nachher:
```markdown
| NDI-Quelle taucht im Mischer nicht auf | Statusleiste **NDI**: „aus“ → unter Einstellungen › NDI-Ausgabe einschalten. „an (ohne Rückmeldung)“ heißt nur: eingeschaltet, eine Bestätigung des Senders gibt es nicht. Dann: gleiches Subnetz? NDI-Discovery/Firewall frei? |
```

Zeile 75. Vorher:
```markdown
| `{{variablen}}` bleiben leer | DataLink-Watchfolder gewählt? Spalten-/Ebenennamen passen zum Mapping? Per `RECALL <Nr.>` einen Eintrag ziehen |
```
Nachher:
```markdown
| `{{variablen}}` bleiben leer | Statusleiste **DataLink**: „kein Ordner“ → unter Einstellungen › DataLink einen Ordner wählen; „Ordner fehlt“ → Ordner umbenannt oder Laufwerk weg. Spalten-/Ebenennamen passen zum Mapping? Per `RECALL <Nr.>` einen Eintrag ziehen |
```

Zeile 76. Vorher:
```markdown
| Companion/Q&A steuert nicht | Port 8726 offen? `jm-titler-ctl` im mDNS sichtbar? |
```
Nachher:
```markdown
| Companion/Q&A steuert nicht | Statusleiste **Fernsteuerung**: „Port belegt“ → ein anderes Programm hält 8726; es beenden und den Titler neu starten. „bereit · 0 verbunden“ → der Titler lauscht, kein Client ist verbunden: Port 8726 in der Firewall offen? `jm-titler-ctl` im mDNS sichtbar? |
```

- [ ] **Step 6: `cookbook.json` neu bauen** (nur der Befehl, die Datei nicht von Hand ändern)

```
npm run cookbook:build 2>&1 | tail -1
npm run cookbook:check 2>&1 | tail -1
git diff --numstat -- packages/cookbook/cookbook.json
```
Erwartet (gemessen):
```
cookbook.json geschrieben: 43 Rezepte.
cookbook.json ist frisch (43 Rezepte).
11	9	packages/cookbook/cookbook.json
```
Geändert sind `updatedAt` (`2026-10-06` → `2026-10-13`; `build.mjs` nimmt das jüngste `lastReviewed` aller Rezepte), das
`lastReviewed` des Titler-Rezepts, unter „vor“ der erste Eintrag und das Komma am iveo-Eintrag samt zwei neuen Einträgen
dahinter, die ersten zwei Einträge unter „waehrend“ und drei `remedy`-Texte: 9 Zeilen geändert, 2 neu. Git meldet dazu „LF will be replaced by CRLF the next time Git touches it“: `build.mjs` schreibt LF, im
Repo liegt die Datei mit LF, und `cookbook:check` vergleicht ohne CR. Die Meldung ist harmlos.

- [ ] **Step 7: Verbund-Doku** (`docs/suite-verbund.md`, Zeile 112)

Vorher:
```markdown
**In den Tools** (Timer: neben „Sync“, Titler: vor „Suite · ⟨n⟩ verbunden“, Rundown: im Statusstreifen):
```
Nachher:
```markdown
**In den Tools** (Timer: neben „Sync“, Titler: in der Kopfzeile in der Mitte, Rundown: im Statusstreifen):
```

- [ ] **Step 8: Release-Anleitung, Smoke-Test** (`docs/release-titler.md`, Zeilen 84 und 90)

Zeile 84. Vorher:
```markdown
1. Titler starten → Kopfzeile zeigt **Suite getrennt**, solange kein Steuerclient verbunden ist.
```
Nachher:
```markdown
1. Titler starten → der Statuseintrag **Fernsteuerung** zeigt „bereit · 0 verbunden“, solange kein Steuerclient verbunden
   ist (ein laufender Launcher zählt als Client mit), und „Port belegt“, wenn ein anderes Programm 8726 hält.
```

Zeile 90. Vorher:
```markdown
   Die Kopf-Badge wechselt auf **Suite · N verbunden**.
```
Nachher:
```markdown
   Der Statuseintrag **Fernsteuerung** wechselt auf „bereit · N verbunden“.
```

- [ ] **Step 9: UX-Roadmap** (`docs/ux/suite-ux-roadmap.md`, Zeile 35)

Vorher:
```markdown
Der Titler-Pilot bekommt einen eigenen Plan, nach dem Merge von Master-Link 2b R2 und Zoom 4b (Spec 9.2).
```
Nachher:
```markdown
Plan für den Titler-Pilot (nach dem Merge von Master-Link 2b R2 und Zoom 4b, Spec 9.2):
[`docs/superpowers/plans/2026-10-13-ux-titler-pilot.md`](../superpowers/plans/2026-10-13-ux-titler-pilot.md); Abnahme
[`docs/ux/ABNAHME-UX-Welle-0.md`](ABNAHME-UX-Welle-0.md).
```

- [ ] **Step 10: Roadmap Lane E** (`docs/roadmap.md`, Zeile 356, nur die Zelle „Stand“)

Vorher:
```markdown
| eigener Plan, nach dem Merge von Master-Link 2b R2 und Zoom 4b (Spec 9.2) |
```
Nachher:
```markdown
| Plan [`docs/superpowers/plans/2026-10-13-ux-titler-pilot.md`](superpowers/plans/2026-10-13-ux-titler-pilot.md) (nach dem Merge von Master-Link 2b R2 und Zoom 4b, Spec 9.2); Funktionsliste [`docs/ux/funktionslisten/titler.md`](ux/funktionslisten/titler.md) abgehakt; Owner-Abnahme nach [`docs/ux/ABNAHME-UX-Welle-0.md`](ux/ABNAHME-UX-Welle-0.md) offen |
```

- [ ] **Step 11: Prüfbefehle (nachher), Umfang, Anführungszeichen, Zeilenenden**

```
echo "release-titler alt: $(grep -c 'Suite getrennt\|Suite · N verbunden' docs/release-titler.md)"
echo "suite-verbund alt: $(grep -c 'Titler: vor „Suite' docs/suite-verbund.md)"
echo "Handbuch alt: $(grep -c 'der Reiter „Einstellungen' packages/cookbook/content/tool-manuals/tool-jm-titler.md) · neu: $(grep -c 'Einstellungen › ' packages/cookbook/content/tool-manuals/tool-jm-titler.md)"
echo "Plan-Link: $(grep -c '2026-10-13-ux-titler-pilot.md' docs/roadmap.md) / $(grep -c '2026-10-13-ux-titler-pilot.md' docs/ux/suite-ux-roadmap.md)"
npm run cookbook:check 2>&1 | tail -1
git diff --numstat -- docs/ packages/cookbook/
git diff -U0 -- docs/roadmap.md docs/release-titler.md docs/suite-verbund.md docs/ux/suite-ux-roadmap.md packages/cookbook/content/tool-manuals/tool-jm-titler.md | grep '^+[^+]' | grep -c '"'
node -e "for(const f of ['docs/roadmap.md','docs/release-titler.md','docs/suite-verbund.md','docs/ux/suite-ux-roadmap.md','packages/cookbook/content/tool-manuals/tool-jm-titler.md','packages/cookbook/cookbook.json']){const t=require('fs').readFileSync(f,'utf8');const c=(t.match(/\r\n/g)||[]).length,n=(t.match(/\n/g)||[]).length;console.log(f,'Zeilen',n,c===n?'CRLF':c===0?'LF':'GEMISCHT')}"
```
Erwartet (gemessen):
```
release-titler alt: 0
suite-verbund alt: 0
Handbuch alt: 0 · neu: 3
Plan-Link: 1 / 1
cookbook.json ist frisch (43 Rezepte).
3	2	docs/release-titler.md
1	1	docs/roadmap.md
1	1	docs/suite-verbund.md
3	1	docs/ux/suite-ux-roadmap.md
9	7	packages/cookbook/content/tool-manuals/tool-jm-titler.md
11	9	packages/cookbook/cookbook.json
0
docs/roadmap.md Zeilen 548 CRLF
docs/release-titler.md Zeilen 94 CRLF
docs/suite-verbund.md Zeilen 179 CRLF
docs/ux/suite-ux-roadmap.md Zeilen 41 LF
packages/cookbook/content/tool-manuals/tool-jm-titler.md Zeilen 93 CRLF
packages/cookbook/cookbook.json Zeilen 4569 LF
```
`numstat` listet genau die sechs Dateien (C13 und C14 sind committet), sortiert nach Pfad. Im Handbuch bleibt die alte
Zeile 51 als erste der drei neuen stehen, deshalb 9 neu und 7 entfernt. „Handbuch neu: 3“ zählt die Zeilen mit
„Einstellungen › “ (Kopfzeile, Pannenhilfe NDI und DataLink). `0` heißt: keine neue Zeile mit ASCII-Anführungszeichen. Die Zeilenzahlen gelten für den Stand `5e5b234ec3`; verbindlich ist je Datei „nicht
GEMISCHT“ (G11). `docs/ux/suite-ux-roadmap.md` zeigt im Worktree `ux-update` `LF`, in einem frisch angelegten Worktree
`CRLF`; beides ist richtig.

- [ ] **Step 12: Commit**

```
git add docs/roadmap.md docs/release-titler.md docs/suite-verbund.md docs/ux/suite-ux-roadmap.md packages/cookbook/content/tool-manuals/tool-jm-titler.md packages/cookbook/cookbook.json
git status --short
```
Erwartet genau:
```
M  docs/release-titler.md
M  docs/roadmap.md
M  docs/suite-verbund.md
M  docs/ux/suite-ux-roadmap.md
M  packages/cookbook/content/tool-manuals/tool-jm-titler.md
M  packages/cookbook/cookbook.json
```
Dann:
```
git commit -m "docs(ux): Titler-Handbuch und Doku auf den Pilot nachgefuehrt" -m "Handbuch tool-jm-titler.md: Einstellungen im Panel ueber Zahnrad und Statusleiste statt Reiter, Kopfzeile mit Show vom Master, ON AIR und Hell/Dunkel, Statusleiste, Haupttasten Take/Clear und Eintrag zurueck/weiter, Pannenhilfe ueber die Statuseintraege NDI, DataLink und Fernsteuerung; lastReviewed 2026-10-13; cookbook.json per cookbook:build. suite-verbund.md: Ort der Verbund-Anzeige im Titler. release-titler.md: Smoke-Test liest den Statuseintrag Fernsteuerung. suite-ux-roadmap.md und Lane E in roadmap.md verlinken Plan, Funktionsliste und Abnahme." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- `cookbook.json` ändert sich in mehr als den drei Zeilen aus der Ist-Karte: Die drei galten für eine einzige geänderte
  Handbuchzeile plus `lastReviewed` (`updatedAt`, `lastReviewed`, eine Textzeile). Das Gerüst verlangt aber Änderungen an
  Zeile 47, am Ablauf „Während“, an der Pannenhilfe und neue Sätze zu Kopfzeile und Hell/Dunkel; jede geänderte
  Handbuchzeile ist eine eigene Zeile in `cookbook.json`. Die Zahl steht gemessen in Step 6.
- `cookbook.json` steht im `git add` von Step 12, aber in keiner Ersetzung: Die Datei entsteht durch
  `npm run cookbook:build` (Step 6). Das ist gewollt; die Datei wird nie von Hand geändert.
- Pannenhilfe: Das Gerüst nennt `:73-77`; geändert werden die Zeilen 73 (NDI), 75 (DataLink) und 76 (Fernsteuerung). Die
  Zeilen 74 (Alpha) und 77 (iveo-Token) nennen keinen Ort des alten Aufbaus und bleiben.
- „Hell/Dunkel und Kopfzeile Mitte“ stehen als zwei neue Einträge nach Zeile 51 (Kopfzeile, Statusleiste); die Zeilen 48–50
  bleiben, weil die neue Zeile 47 die Orte aller Panel-Abschnitte nennt.
- `release-titler.md` nur 84 und 90; der Rest der Anleitung (Stand 0.4.0) ist kein Teil des Pilots.
- Die Zelle in `docs/roadmap.md` sagt nicht „umgesetzt“ oder „gemergt“: Den Stand nach dem Merge trägt der Controller in
  „Nach der Umsetzung“ (Punkt 8) nach.

**Gemessen** (14.10.2026, beim Zusammensetzen nach Task 14 bestätigt): Step 1 wie angegeben; 12 Ersetzungen (Handbuch 7,
Verbund-Doku 1, Release-Anleitung 2, UX-Roadmap 1, Roadmap 1), jede Vorher-Stelle genau einmal; Step 6 und 11 wie
angegeben. Die Messkopie hat kein Git: `numstat` und die Anführungszeichen-Zählung sind mit
`git diff --no-index --ignore-cr-at-eol` gegen eine Sicherung der sechs Dateien vor Step 2 gemessen (gleiche Zählung wie im
Repo, wo Git die Zeilenenden normalisiert). In der Kopie liegen alle Dateien mit CRLF (`git archive`), also auch
`docs/ux/suite-ux-roadmap.md`; das `LF` in Step 11 ist der Stand im Worktree `ux-update` (`git ls-files --eol`: `w/lf`).
Am 15.10.2026 nach der Nachbesserung unverändert nachgemessen (Step 1, 6 und 11 wie angegeben).

---

### Task 16: C16 · Gesamtprüfung

**Spec:** 11 (bestehende Selbsttests, Typprüfung und CSP-Test bleiben grün; neue Ableitungen mit Selbsttest der App), 12
(Voraussetzung der Owner-Abnahme). Review Focus 1–5; Global Constraints G1–G4, G9–G13, G15–G17; Tabelle „Testläufe“ im
Plankopf.

**Arbeitsverzeichnis/Voraussetzung:** Plan-Worktree, Aufgaben C1–C15 committet. `git status --short` zeigt keine Datei
dieses Plans; fremde, ungestagte Dateien dürfen dastehen. Keine andere Workspace-Typprüfung läuft gleichzeitig (G10).

**Dateien:** keine. C16 ändert keine Datei im Repo und committet nichts. Logs und die zwei Prüfskripte liegen nur im
Scratchpad (G17).

**Interfaces:**
- Consumes: den Stand nach C1–C15, die Tabelle „Testläufe“, die Pfadliste und die byte-gleichen Dateien aus G1, die Basis
  `5e5b234ec3`.
- Produces: den Bericht an den Controller für „Nach der Umsetzung“ (Step 8): Endstände aller Läufe, Umfang des Diffs,
  byte-gleiche Dateien, Zeilenenden.

**Verhalten (verbindlich):**
- Jeder Lauf wird zuerst mit `echo "Exit=$?"` gelesen, dann gezählt (G17). Weicht ein Wert ab, hält der Ausführende an und
  meldet (G16). C16 repariert nichts; eine Korrektur ist eine Nachbesserung der betroffenen Aufgabe.
- Die Typprüfung aller Workspaces läuft allein, nie parallel zu einer anderen (G10).
- Build-Ausgaben (`apps/titler/out`, `packages/ui/galerie/dist`) sind git-ignoriert (gemessen: `.gitignore:5` und
  `apps/titler/.gitignore:3`); `git status --short` ist danach so leer wie vorher.
- Der Pfadfilter kennt genau die Pfade aus G1. Der Plan selbst (`docs/superpowers/plans/2026-10-13-ux-titler-pilot.md`)
  zählt in Step 6 und 7 nicht mit, ob der Controller ihn auf dem Branch committet hat oder nicht; so hängen die Zahlen nicht
  an der Länge des Plans. Jede andere geänderte Datei ist ein Befund.
- Byte-gleich gegen die Basis heißt: `git diff --exit-code 5e5b234ec3 -- <Pfade>` endet mit Exit 0 und gibt nichts aus.
  Jeder Pfad der Liste muss an der Basis Dateien haben; ein verschriebener Pfad wäre sonst still „gleich“.

- [ ] **Step 1: Selbsttests**

```
SP='<eigener Scratchpad>'; [ -d "$SP" ] && {
npm run selftest -w @jm/titler > "$SP/c16-titler.log" 2>&1; echo "Titler Exit=$?"; grep -c "^ok" "$SP/c16-titler.log"; grep -c "^FAIL" "$SP/c16-titler.log"; grep -c "ALLE TESTS OK" "$SP/c16-titler.log"
(cd apps/titler && npx tsx test/selftest.ts) > "$SP/c16-titler-alt.log" 2>&1; echo "Titler alt Exit=$?"; grep -c "^ok" "$SP/c16-titler-alt.log"
(cd apps/titler && npx tsx --tsconfig tsconfig.test.json test/ui/selftest.ts) > "$SP/c16-titler-ui.log" 2>&1; echo "Titler Oberfläche Exit=$?"; grep -c "^ok" "$SP/c16-titler-ui.log"
npm run selftest -w @jm/ui > "$SP/c16-ui.log" 2>&1; echo "ui Exit=$?"; grep -c "^ok" "$SP/c16-ui.log"
npm run selftest -w @jm/settings > "$SP/c16-settings.log" 2>&1; echo "settings Exit=$?"; grep -c "^ok" "$SP/c16-settings.log"
npm run selftest -w @jm/app-runtime > "$SP/c16-app-runtime.log" 2>&1; echo "app-runtime Exit=$?"; grep "passed, .* failed" "$SP/c16-app-runtime.log"
npm run selftest -w @jm/suite-control-protocol > "$SP/c16-protokoll.log" 2>&1; echo "Steuerprotokoll Exit=$?"; grep -c "^ok" "$SP/c16-protokoll.log"
}
```
Erwartet:
```
Titler Exit=0
802
0
2
Titler alt Exit=0
538
Titler Oberfläche Exit=0
264
ui Exit=0
680
settings Exit=0
463
app-runtime Exit=0
50 passed, 0 failed
254 passed, 0 failed
Steuerprotokoll Exit=0
80
```
Der Titler-Gesamtstand ist derselbe wie nach C13 (C14 und C15 ändern keinen Test) und gleich der Summe der zwei Läufe
darunter. Vorher (Basis `5e5b234ec3`): Titler 512, ui 627, settings 419, app-runtime `50 passed` und `227 passed`,
Steuerprotokoll 77.

- [ ] **Step 2: Typprüfung aller Workspaces (allein)**

```
SP='<eigener Scratchpad>'; [ -d "$SP" ] && { npm run typecheck --workspaces --if-present > "$SP/c16-typecheck.log" 2>&1; echo "Exit=$?"; grep -c "error TS" "$SP/c16-typecheck.log"; grep -c "^> @jm/.* typecheck$" "$SP/c16-typecheck.log"; grep -c "^> @jm/titler@.* typecheck:test$" "$SP/c16-typecheck.log"; }
```
Erwartet: `Exit=0`, dann `0`, `31` und `1`. Die dritte Zahl zählt die Workspaces mit einem Skript `typecheck`, die vierte
belegt, dass `typecheck:test` (C7) mitläuft.

- [ ] **Step 3: Build und Klassen-Probe** (Review Focus 5)

```
SP='<eigener Scratchpad>'; [ -d "$SP" ] && { npm run build -w @jm/titler > "$SP/c16-bau.log" 2>&1; echo "Bau Exit=$?"; (cd packages/ui && npx tsx galerie/pruefe-klassen.ts --css ../../apps/titler/out/renderer/assets) > "$SP/c16-klassen.log" 2>&1; echo "Klassen Exit=$?"; grep -c "^ok" "$SP/c16-klassen.log"; grep -c "^FAIL" "$SP/c16-klassen.log"; }
```
Erwartet: `Bau Exit=0`, `Klassen Exit=0`, `20`, `0`.

- [ ] **Step 4: Galerie**

```
SP='<eigener Scratchpad>'; [ -d "$SP" ] && { npm run galerie:pruefen -w @jm/ui > "$SP/c16-galerie.log" 2>&1; echo "Galerie Exit=$?"; grep -c "^ok" "$SP/c16-galerie.log"; grep -c "^FAIL" "$SP/c16-galerie.log"; }
```
Erwartet: `Galerie Exit=0`, `20`, `0`. Der Befehl baut die Galerie nur (`vite build`) und prüft deren CSS; er
startet keinen Server.

- [ ] **Step 5: Kochbuch, CI-Datei, Version**

```
npm run cookbook:check 2>&1 | tail -1
node -e "const y=require('js-yaml').load(require('fs').readFileSync('.github/workflows/ci-checks.yml','utf8'));const s=y.jobs.selftests.steps;console.log('Schritte',s.length);for(const x of s)if(/Titler|App-Laufzeit/.test(x.name||''))console.log(x.name)"
node -p "require('./apps/titler/package.json').version + ' / Lock ' + require('./package-lock.json').packages['apps/titler'].version"
```
Erwartet:
```
cookbook.json ist frisch (43 Rezepte).
Schritte 22
Titler (DataLink-Schlüssel, Datenquelle, Oberfläche)
App-Laufzeit (Log-Aufräumen, CSP, Verbund-Anzeige, Abo-Zustand, Master-Link-Meldung)
0.11.0 / Lock 0.11.0
```
Die Version bleibt 0.11.0 (G15). 0.12.0 setzt erst der Controller („Nach der Umsetzung“, Punkt 5) für den Abnahme-Bau;
veröffentlicht wird erst nach der Owner-Abnahme (Spec 9.1, Punkt 8).

- [ ] **Step 6: Diff gegen die Basis nur auf Pfaden aus G1** (mit Gegenprobe des Pfadfilters)

Das Prüfskript in den Scratchpad schreiben und laufen lassen:
```
SP='<eigener Scratchpad>'; [ -d "$SP" ] && cat > "$SP/g1-pfade.js" <<'EOF'
// Jede gegen die Basis 5e5b234ec3 geänderte Datei muss auf einem Pfad aus G1 liegen. Der Plan selbst (vom Controller
// committet oder nicht) zählt nicht mit. Weitere Pfade als Argumente gelten als zusätzlich geändert (Gegenprobe).
const { execSync } = require('child_process');
const G1 = [
  /^apps\/titler\/src\/renderer\/src\//,
  /^apps\/titler\/src\/preload\/index\.ts$/,
  /^apps\/titler\/src\/shared\/(types|fernsteuerung)\.ts$/,
  /^apps\/titler\/src\/main\/(control-server|index)\.ts$/,
  /^apps\/titler\/test\//,
  /^apps\/titler\/(tsconfig\.test|package)\.json$/,
  /^packages\/app-runtime\/src\/(index|master-link-meldung|master-link-ipc)\.ts$/,
  /^packages\/app-runtime\/test\/verbund\.test\.ts$/,
  /^packages\/suite-control-protocol\/(src\/server|test\/selftest)\.ts$/,
  /^packages\/ui\/src\/lib\/(master-link|bruecke|useBrueckenWert|texte)\.ts$/,
  /^packages\/ui\/src\/index\.ts$/,
  /^packages\/ui\/src\/components\/StatusPill\.tsx$/,
  /^packages\/ui\/test\//,
  /^packages\/ui\/galerie\/beispiele-settings\.tsx$/,
  /^packages\/settings\/src\/abschnitte\/(datalink\.ts|DataLinkSection\.tsx|screen-output\.ts|ScreenOutputSection\.tsx)$/,
  /^packages\/settings\/test\//,
  /^\.github\/workflows\/ci-checks\.yml$/,
  /^package-lock\.json$/,
  /^docs\/ux\/(funktionslisten\/titler|ABNAHME-UX-Welle-0|suite-ux-roadmap)\.md$/,
  /^docs\/(roadmap|suite-verbund|release-titler)\.md$/,
  /^packages\/cookbook\/content\/tool-manuals\/tool-jm-titler\.md$/,
  /^packages\/cookbook\/cookbook\.json$/,
];
const PLAN = 'docs/superpowers/plans/2026-10-13-ux-titler-pilot.md';
const geaendert = execSync('git diff --name-only 5e5b234ec3', { encoding: 'utf8' }).split('\n').filter(Boolean).filter((p) => p !== PLAN);
const alle = [...geaendert, ...process.argv.slice(2)];
const fremd = alle.filter((p) => !G1.some((r) => r.test(p)));
for (const p of fremd) console.log(`außerhalb G1: ${p}`);
console.log(`Dateien ${alle.length}, außerhalb G1 ${fremd.length}`);
process.exitCode = fremd.length > 0 ? 1 : 0;
EOF
node "$SP/g1-pfade.js"; echo "Exit=$?"
git diff --stat 5e5b234ec3 -- . ':(exclude)docs/superpowers/plans/2026-10-13-ux-titler-pilot.md' | tail -1
```
Erwartet (gemessen):
```
Dateien 63, außerhalb G1 0
Exit=0
 63 files changed, 4429 insertions(+), 776 deletions(-)
```
Die 63 Dateien sind 28 neue und 35 geänderte (Step 7); der Plan selbst ist in beiden Zahlen nicht enthalten.
Gegenprobe (zwei Pfade, die G1 ausschließt, nur als Argument; nichts wird geändert):
```
SP='<eigener Scratchpad>'; node "$SP/g1-pfade.js" apps/timer/src/main/index.ts packages/app-runtime/src/verbund.ts; echo "Exit=$?"
```
Erwartet: `außerhalb G1: apps/timer/src/main/index.ts`, `außerhalb G1: packages/app-runtime/src/verbund.ts`, dann
`Dateien 65, außerhalb G1 2` und `Exit=1`.

- [ ] **Step 7: Byte-gleich gegen die Basis und Zeilenenden**

Byte-gleich bleiben die Dateien, die G1 ausdrücklich nennt (Ausgabefenster, Import-Dialog, Engine, Store, Ansichtswahl,
Typen und Einstieg des Renderers, `index.html`), die R2-Dateien von `@jm/app-runtime`, die nicht angefassten Main-, Utility-
und Shared-Dateien des Titlers sowie `packages/master-link`, `packages/show` und `packages/suite-manifest`:
```
B=(apps/titler/src/renderer/index.html apps/titler/src/renderer/src/App.tsx apps/titler/src/renderer/src/jmtitler.d.ts apps/titler/src/renderer/src/main.tsx apps/titler/src/renderer/src/store/titler.ts apps/titler/src/renderer/src/lib/cg.ts apps/titler/src/renderer/src/lib/datalink-anzeige.ts apps/titler/src/renderer/src/lib/engine.ts apps/titler/src/renderer/src/lib/graphic.ts apps/titler/src/renderer/src/lib/psd-import.ts apps/titler/src/renderer/src/views/ImportDialog.tsx apps/titler/src/renderer/src/views/OutputView.tsx apps/titler/src/main/config.ts apps/titler/src/main/datalink.ts apps/titler/src/main/iveo-show.ts apps/titler/src/main/library.ts apps/titler/src/main/show-quelle.ts apps/titler/src/main/ndi apps/titler/src/utility apps/titler/src/shared/datalink-kern.ts apps/titler/src/shared/datenquelle.ts apps/titler/src/shared/text-kodierung.ts apps/titler/src/shared/vars.ts packages/app-runtime/src/verbund.ts packages/app-runtime/src/verbund-anzeige.ts packages/app-runtime/src/verbund-daten.ts packages/app-runtime/src/verbund-ipc.ts packages/app-runtime/src/verbund-speicher.ts packages/app-runtime/src/verbund-typen.ts packages/app-runtime/test/selftest.ts packages/master-link packages/show packages/suite-manifest)
for p in "${B[@]}"; do [ -n "$(git ls-tree -r --name-only 5e5b234ec3 -- "$p")" ] || echo "fehlt an der Basis: $p"; done
echo "Pfade ${#B[@]}, Dateien an der Basis: $(git ls-tree -r --name-only 5e5b234ec3 -- "${B[@]}" | wc -l)"
git diff --exit-code --stat 5e5b234ec3 -- "${B[@]}"; echo "Exit=$?"
```
Erwartet (gemessen auf `5e5b234ec3`; die Zahlen hängen nur an der Basis): keine Zeile „fehlt an der Basis“, dann
`Pfade 33, Dateien an der Basis: 76`, keine Ausgabe von `git diff` und `Exit=0`.

Gegenprobe (nur lesend): Dieselbe Prüfung für eine Datei, die C9–C12 ändern, schlägt an:
```
git diff --exit-code --stat 5e5b234ec3 -- apps/titler/src/renderer/src/views/OperatorView.tsx; echo "Exit=$?"
```
Erwartet: eine Zeile `apps/titler/src/renderer/src/views/OperatorView.tsx | …`, die Summenzeile `1 file changed, …` und
`Exit=1`.

Zeilenenden aller geänderten und neuen Dateien (G11):
```
node - <<'EOF'
const { execSync } = require('child_process');
const fs = require('fs');
const liste = (f) => execSync(`git diff --name-only --diff-filter=${f} 5e5b234ec3 -- . ":(exclude)docs/superpowers/plans/2026-10-13-ux-titler-pilot.md"`, { encoding: 'utf8' }).split('\n').filter(Boolean);
const form = (p) => { const t = fs.readFileSync(p, 'utf8'); const c = (t.match(/\r\n/g) || []).length; const n = (t.match(/\n/g) || []).length; return c === 0 ? 'LF' : c === n ? 'CRLF' : 'GEMISCHT'; };
const neu = liste('A'); const geaendert = liste('M');
console.log(`neu ${neu.length}, davon nicht LF ${neu.filter((p) => form(p) !== 'LF').length}`);
console.log(`geändert ${geaendert.length}, davon gemischt ${geaendert.filter((p) => form(p) === 'GEMISCHT').length}`);
console.log(`geändert mit LF: ${geaendert.filter((p) => form(p) === 'LF').join(' ')}`);
EOF
```
Erwartet:
```
neu 28, davon nicht LF 0
geändert 35, davon gemischt 0
geändert mit LF: packages/cookbook/cookbook.json
```
So in einem frisch angelegten Worktree (gemessen beim Zusammensetzen). Im Worktree `ux-update` liegt
`docs/ux/suite-ux-roadmap.md` mit LF (`git ls-files --eol`: `w/lf`); dort steht sie zusätzlich in der letzten Zeile. `cookbook.json` schreibt `cookbook:build` mit LF (C15).
Jede andere geänderte Datei hat CRLF, jede neue LF. „neu“ und „geändert“ zusammen ergeben die Dateizahl aus Step 6.

- [ ] **Step 8: Bericht an den Controller** (kein Commit)

```
git status --short
git log --oneline 5e5b234ec3..HEAD
```
Erwartet: `git status --short` zeigt keine Datei dieses Plans. `git log` zeigt je Aufgabe C1–C15 genau einen Commit (Titel
wie in den Commit-Steps), dazu höchstens den Plan-Commit des Controllers.

Der Bericht nennt: die Endstände aus Step 1 bis 5 (Titler beide Läufe, ui, settings, app-runtime, Steuerprotokoll,
Typprüfung, Klassen-Probe, Galerie, Kochbuch, CI-Schritte, Version), die Zahlen aus Step 6 und 7 und jede Abweichung. Er
geht an den Controller für „Nach der Umsetzung“. C16 committet nichts.

**Abweichungen vom Gerüst:**
- Die Liste der byte-gleichen Dateien ist länger als im Gerüst: Sie nimmt alle Dateien auf, die G1 als „byte-gleich“ oder
  „nicht angefasst“ nennt (zusätzlich `main.tsx`, `index.html`, die Main-Dateien `config`, `datalink`, `iveo-show`,
  `library`, `show-quelle`, `main/ndi`, `utility`, die vier Shared-Dateien und `packages/app-runtime/test/selftest.ts`).
  `verbund*.ts` steht ausgeschrieben, weil `git ls-tree` keine Muster kennt.
- Neu ist die Prüfung, dass jeder Pfad an der Basis Dateien hat (33 Pfade, 76 Dateien); ohne sie wäre ein verschriebener
  Pfad still „gleich“.
- Der Plan selbst zählt in Step 6 und 7 nicht mit (Ausschluss im Skript bzw. per `:(exclude)`); er steht nicht in G1,
  kommt aber vielleicht mit dem Branch, und seine Länge ändert sich bei jeder Nachbesserung (beim Zusammensetzen
  entschieden, Z-Liste im Plankopf).
- Die Gegenprobe für „byte-gleich“ nutzt `views/OperatorView.tsx`, das C9–C12 ändern; sie ändert nichts.
- Die Zeilenenden prüft ein Skript über alle neuen und geänderten Dateien statt einer Liste je Aufgabe. Erwartet ist
  „nicht gemischt“; LF bei geänderten Dateien nur für die zwei genannten.
- Step 8 (Bericht) ist neu: C16 hat keinen Commit, also braucht der Endstand einen festen Ort.

**Gemessen** (zuletzt in der Abschluss-Messung der letzten Nachbesserung am 15.10.2026, NB38: frische Kopie von
`5e5b234ec3`, der ganze Plantext eingespielt, 250 Operationen, Fehler 0, dieselbe Kopie nach Task 1–15):
- Step 1: Titler `Exit=0`, 802 `ok`, 0 `FAIL`, zweimal `ALLE TESTS OK`; alter Lauf 538, zweiter Lauf 264; ui 680,
  settings 463, app-runtime `50 passed, 0 failed` und `254 passed, 0 failed`, Steuerprotokoll 80, jeweils `Exit=0`
  (Ausgabe wörtlich wie der erwartete Block).
- Step 2: `Exit=0` nach 75 s (allein gelaufen; im Abschluss NB30 95 s, die Laufzeit ist nur Messwert), `0`, `31`, `1`.
- Step 3: `Bau Exit=0`, Klassen-Probe 20 `ok`, 0 `FAIL`; im gebauten CSS (50,64 kB) stehen die Klassen aus
  `packages/ui/src` (71) und `packages/settings/src` (39), auch die neuen des Farbwählers aus Task 6.
- Step 4: `Galerie Exit=0`, 20 `ok`, 0 `FAIL`.
- Step 5: wie erwartet (`cookbook.json` frisch nach C15, 22 Schritte, `0.11.0 / Lock 0.11.0`).
- Step 6 und 7: Die Messkopie hat kein Git. Gemessen ist der Dateivergleich gegen `git archive 5e5b234ec3` (ohne
  git-ignorierte Bau-Ausgaben) mit `git diff --no-index --numstat` je Datei: 28 neue und 35 geänderte Dateien, alle auf
  Pfaden aus G1, zusammen 4429 Zeilen neu und 776 entfernt; mit dem Pfadfilter aus Step 6 auf dieser Dateiliste `Dateien 63,
  außerhalb G1 0`, Gegenprobe `Dateien 65, außerhalb G1 2` mit `Exit=1`; neue Dateien alle `LF`, geänderte nicht gemischt, nur
  `cookbook.json` mit `LF`. Byte-gleich: 33 Pfade, 76 Dateien an der Basis, 0 abweichend. Lesend im Worktree `ux-update`
  auf `5e5b234ec3` (sauber, Schreiber von Block D): Pfadfilter `Dateien 0, außerhalb G1 0` mit `Exit=0`, Gegenprobe
  `außerhalb G1 2` mit `Exit=1`; derselbe Byte-Vergleich gegen `adda584693` (vor R2) meldet 31 Dateien und `Exit=1`.
- Nachgemessen am 15.10.2026 nach den drei Nachbesserungen der Plan-Prüfung, in einer frischen Kopie mit dem ganzen
  Plantext (250 Operationen, Fehler 0): dieselben Werte wie im Abschluss NB30 (nächster Punkt); Step 5 wörtlich; byte-gleich 33 Pfade, 76 Dateien, 0 abweichend,
  die Gegenprobe mit `views/OperatorView.tsx` abweichend.
- Im Abschluss der Nachbesserung (NB30), also vor der letzten Nachbesserung: Step 1 bis 5 wie oben bis auf den
  Oberflächen-Lauf (damals 261, zusammen 799; Typprüfung 95 s, beim Teil 3 der Nachbesserung 91 s; die Laufzeit ist nur
  Messwert); Step 6 und 7 per Dateivergleich gegen `git archive 5e5b234ec3` mit denselben Zahlen bis auf die Zeilen
  (63, 28 neu, 35 geändert, damals 4313+/776−, neue alle LF, geänderte nicht gemischt, nur `cookbook.json` mit
  LF, byte-gleich 33 Pfade, 76 Dateien, 0 abweichend); lesend im Worktree `ux-update` auf `5e5b234ec3` Pfadfilter
  `Dateien 0, außerhalb G1 0` mit `Exit=0`, Gegenprobe `Dateien 2, außerhalb G1 2` mit `Exit=1`, Byte-Vergleich
  `Pfade 33, Dateien an der Basis: 76` mit `Exit=0`. Ein zweites Abspielen ohne Tests ergab Byte für Byte denselben Baum.

---

## Nachbesserung nach der Plan-Prüfung

Vier Prüfer haben den Plan am 14.10.2026 geprüft: Spec-Abdeckung (`spec:1` bis `spec:8`), Code-Treue (`code:1` bis
`code:6`), TDD und Robustheit (`robust:1` bis `robust:8`) und Funktionsliste (`funktionsliste:1` bis `funktionsliste:7`).
Alle 29 Befunde sind übernommen, keiner ist abgelehnt; einige als Entscheidung statt als Code, einer anders als
vorgeschlagen. Nachgebessert wurde in drei Teilen (Task 1–8, Task 9–12, Task 13–16 mit Kopf), je mit neuer Messung der
betroffenen Aufgaben samt allen Gegenproben; zum Schluss ist der ganze Plan noch einmal gemessen (NB30), und die
Widersprüche zwischen den Teilen sind aufgelöst (NB31). Die Punkte heißen NB, weil N1 und N2 schon die zwei Ausnahmen in G2
sind. Je Punkt: Befund, Ergebnis, Grund, Ort im Plan. Eine unabhängige Nachprüfung (15.10.2026) fand danach fünf kleine
Restlücken R1–R5; die letzte Nachbesserung schließt sie (NB32 bis NB36), trägt die Owner-Antworten ein (NB37) und misst den
ganzen Plan neu (NB38).

- **NB1 · `spec:1` Release vor der Owner-Abnahme (wichtig) · übernommen.** Spec 9.1 gibt das Release erst nach der Abnahme
  der Welle und nur mit Owner-Freigabe frei; der Plan ließ vorher releasen und widersprach sich in Task 16. Ort: „Nach der
  Umsetzung“ Punkt 5 bis 8 neu geordnet (Release-Commit auf dem Branch, lokaler Abnahme-Bau
  `JM Titler-0.12.0-win-x64.exe` von Hand an A und B, Owner-Abnahme, erst danach Merge, Tag, Release und `bump-manifest`);
  Task 14 (Spec-Zeile, Verhalten, Voraussetzung der Abnahme-Datei, Zusatz 10, Abweichungen); Task 16 Step 5; G5; Fristen
  von OF8 bis OF10; neue OF13.
- **NB2 · `spec:2` Gelb `--warning` in Bedienung und Recall-Board (wichtig) · übernommen.** Spec 4.2 verlangt Orange für
  Warnungen. Ort: neue E25 (Ausnahme in E22); Task 10 Step 5 (Hinweis-Kasten H1–H7), Task 12 Step 3 (Hinweisband und Karte
  B1); Tests in Task 10 Step 1 und Task 12 Step 1 (keine Datei unter `views/` nutzt `--warning`); Gegenproben Task 10 f)
  und Task 12 d); Funktionsliste Nr. 28, 87 und 88 (Task 13); Abnahme Zusatz 6.
- **NB3 · `spec:3` G2 nannte nur N1 und N2 · übernommen.** Am Code bestätigt: Heute schreibt jeder Tastendruck den
  NDI-Namen und den DataLink-Pfad (`views/OperatorView.tsx:684` bzw. `:623`); der Text-Entwurf aus `@jm/settings` übernimmt
  erst bei Enter bzw. Verlassen und schneidet Leerzeichen ab. Ort: G2 mit den benannten Änderungen L1–L6; Verweise in E7,
  E8, E10, E12, E13, E21, im Absatz „Spec“ des Kopfs, in „Vor der Umsetzung“ und in Funktionsliste Nr. 30, 43 und 50
  (Task 13); E7 als neue OF14.
- **NB4 · `spec:4` Vorschau des NDI-Namens im Netz (Spec 6.2) · übernommen als Entscheidung.** Den Namen bildet die
  NDI-Bibliothek im Sender-Prozess; Renderer und `TitlerStatus` kennen ihn nicht, ein nachgebauter Name wäre nicht gemessen
  (Spec 7.3). Heute zeigt der Titler ihn auch nicht, es geht nichts verloren. Ort: E7, Task 8 „Verhalten“ (NDI), „Bewusst
  nicht in diesem Plan“, OF6, Abnahme 4c.
- **NB5 · `spec:5` „Neustart nötig“ der Fernsteuerung (Spec 6.2) · übernommen als Entscheidung.** `modus()` liest die in
  `start()` aufgelöste Konfiguration (`packages/suite-control-protocol/src/server.ts:155-182`), zeigt also den Modus des
  laufenden Servers und lügt nicht. Der Hinweis bräuchte im Main das Lesen von `control.json` und einen Dateiwächter, mehr
  als N2. Ort: E6, Task 8 „Verhalten“ (Fernsteuerung), „Bewusst nicht in diesem Plan“, OF6, Abnahme 4e.
- **NB6 · `spec:6` Abnahme 4b und 4f erreichten nicht jeden Zustand · übernommen, für H3 anders als vorgeschlagen.**
  `apps/titler/ABNAHME-2b-R1.md` hat keinen H3-Schritt, und ein Side Event ohne Speaker behält im Launcher die bisherige
  Liste (`apps/launcher/src/main/iveo-abgleich-kern.ts:951`). Darum führt 4b ○ „iveo unbekannt“ über `TITLER RECALL
  Niemand` herbei (H5) und ▲ „iveo Liste aus früherem Stand“ an B über die Trennung vom Master (E9); 4f bekommt den leeren
  Ordner für ▲ „DataLink keine Einträge“. Alle Erwartungen sind an `statusLeiste` gemessen. Ort: Task 14 Step 2
  (Voraussetzungen, Zeilen 4b und 4f), Abweichungen und „Gemessen“ von Task 14.
- **NB7 · `spec:7` Kürzung der V-Zeile mit „…“ · übernommen (Umsetzung statt Owner-Frage).** Ein hart abgeschnittener Text
  kann falsch lesen lassen („Stand 09:0“), und die R2-Regel (2b-Spec 16.5) bleibt so wirksam. `StatusPill` bekommt
  additiv die optionale Prop `kuerzen`; ohne sie bleibt das Markup unverändert (Spec 4.1). Ort: E18, G1, Dateistruktur;
  Task 9 Step 2 (Tests), der neue Step 5, Step 6 (`KopfMitte` mit `kuerzen`), Gegenproben m) und n); Abnahme 3;
  Funktionsliste Nr. 3; Pfadfilter in Task 16 Step 6.
- **NB8 · `spec:8` Breite des Live-Bereichs bei offenem Panel · übernommen als Entscheidung mit Abnahmepunkt.** Die vier
  Vorlage-Knöpfe brauchen die 400 px der Bedienung; eine schrumpfbare Bedienung wäre eine Gestaltungsänderung über den
  Pilot hinaus. Gerechnet: bei 960 px etwa 160 px für Vorschau und Haupttasten, bei 1180 px etwa 380 px. Ort: E19, Abnahme
  6a (auch bei 960 px; ob es reicht, trägt der Owner ein).
- **NB9 · `code:1` Probe 4 in Task 2 hing am Einzug · übernommen.** Gemessen: sechs Leerzeichen
  `{"reg":601,"sperre":419}`, vier Leerzeichen `{"reg":597,"sperre":419}`. Ort: Task 2 Step 9 (Probe 4 wörtlich mit dem
  Code davor und danach, beide Werte genannt).
- **NB10 · `code:2` Probe 4 in Task 6 nicht eindeutig · übernommen.** Gemessen: ohne Kontext steht die Zeile zweimal in der
  Datei, mit dem dreizeiligen Block ab `const hex = p.backgroundDefault ?? '';` ergibt die Probe genau die vier `FAIL`.
  Ort: Task 6 Step 13, Probe 4.
- **NB11 · `code:3` Hash-Test im CI · übernommen (dokumentiert statt entfernt).** Der Test sichert den Pilot bis zum Merge,
  auch in Fix-Runden nach Task 16; eine spätere gewollte Änderung setzt die Hashes in derselben Änderung neu. Ort: Task 12
  Step 1 (Kommentar im Test, Hinweiszeile unter dem `FAIL`), Task 12 „Verhalten“, Gegenprobe a), „Nach der Umsetzung“
  Punkt 9.
- **NB12 · `code:4` Zeilennummern im dauerhaften Test · übernommen.** Eine Zeilennummer ist eine Regel für die Umsetzung,
  keine Dauerinvariante. Jetzt relativ: Die R2-Importe stehen unverändert direkt hintereinander, vor den Importen aus
  `master-link-*.ts`. Gegenprobe: 1 `FAIL` mit `{"r2Pos":583,"neuPos":463}`; Positivprobe (`// Probe` am Dateianfang)
  bleibt `254 passed, 0 failed`. Ort: Task 2 Step 1, Step 9 (Probe 7, Positivprobe), Abweichungen.
- **NB13 · `code:5` G11 widersprach Task 15 und 16 · übernommen.** Gemessen: Ein frischer Worktree hat alles mit CRLF, der
  Worktree `ux-update` 76 Dateien `w/lf`; maßgeblich ist „nicht gemischt“. Ort: G11.
- **NB14 · `code:6` Kopftabelle gegen den Aufgabentext · übernommen.** Ort: Tabelle „Gemessene Zählstände“, Zeile 2, 3 und
  4 und der Satz darunter (Teil 3), Zeile 16 im Abschluss zusammen mit Task 16 „Gemessen“ auf denselben Lauf (NB30).
- **NB15 · `robust:1` iveo ● bei gestörtem Master-Link (wichtig) · übernommen.** Bei Quelle `master` kommt die Liste über
  den Link; der Test schrieb den Widerspruch zur V-Zeile fest. `iveoAbschnitt` nimmt jetzt die Master-Link-Meldung als
  Eingang: bei `verbunden` die Regel wie bisher, bei gemessener Trennung (`ohne-client`, `aus`, `sucht`, `verbindet`,
  `fehler`) „Liste aus früherem Stand“ (mit Kern-Hinweis „unbekannt“), bei offener oder fehlender Brücke und unbekannter Art
  „unbekannt“, nie `ok`. Das iveo-Kreuz hat die Achse Master-Link (576 Fälle); Gegenproben 12 (1 `FAIL`, 34 Fälle) und 13
  (1 `FAIL`, 16 Fälle). Ort: E9, Task 8 „Verhalten“, Step 1, Step 3 und Step 5, Commit-Text; Review Focus 1; neue OF12 zu
  Quelle `show`.
- **NB16 · `robust:2` ON AIR und Take-Tally ohne Test (wichtig) · übernommen.** Der Render ohne Browser kennt nur
  `live = false`. Quelltext-Wächter auf `useTitlerEngine` und `onAir={{ live }}` (Task 9, Gegenprobe f) und auf
  `live={live}` (Task 10, Gegenprobe e). Ort: Task 9 Step 2 und Step 13, Task 10 Step 1 und Step 11, Selbstprüfung 7.2 und
  7.4, Review Focus 1.
- **NB17 · `robust:3` Panel öffnen und Aktionen ungetestet (wichtig) · übernommen als Quelltext-Wächter statt Fabrik.**
  Ohne Browser lässt sich kein Klick auslösen, und eine Fabrik in `lib/` verschöbe die Mutationsstelle nur in den Aufrufer.
  Der Wächter deckt `settingsOpen`, `settingsSection`, `setPanelOffen(offen)`, `setPanelAbschnitt(abschnitt)`,
  `aktionen={aktionen}` und die fünf Aktionen; die Gegenproben g) bis k) sind genau die Mutationen K9, K8, K6, K5 und K7 des
  Prüfers. Ort: Task 9 Step 2 und Step 13, Review Focus 2.
- **NB18 · `robust:4` Übergang des Brücken-Hooks ungetestet (wichtig) · übernommen.** Die Mutationen H2 und H3 blieben
  grün. Den Übergang rechnen jetzt die reinen, nur für den Test exportierten Funktionen `hookSchritt` und `hookWert` in
  `useBrueckenWert.ts` (Index unverändert); geprüft sind der Verlauf verbunden → sucht → fehler → `null`, der Quellwechsel
  und die Verdrahtung im Hook, mit den Gegenproben 10 bis 13. Ort: Task 5 (Interfaces, Verhalten, Step 1, 6, 7, 9, 10, 11,
  Commit), Review Focus 1.
- **NB19 · `robust:5` Ablehnungs-Zweig der Monitorliste ungetestet · übernommen.** Wächter auf
  `.then(setDisplays, () => setDisplays(undefined))`, Gegenprobe l); Gegenproben a) und b) auf die neue Meldung umgestellt.
  Ort: Task 9 Step 2 und Step 13; Funktionsliste Nr. 81.
- **NB20 · `robust:6` NDI-Kreuz ohne die Höhe · übernommen.** Auflösung `1920x1081` im Kreuz (24 Fälle), Gegenprobe 14
  (1 `FAIL`, 8 Fälle). Ort: Task 8 Step 1 und Step 5.
- **NB21 · `robust:7` DataLink im Panel nie mit Fehler gerendert · übernommen.** Der Panel-Test rendert DataLink mit
  `EACCES: permission denied` und mit „Ordner nicht gefunden“; Gegenprobe e). Ort: Task 11 „Verhalten“, Step 1 und Step 8.
- **NB22 · `robust:8` aktiver Recall-Eintrag nur optisch · übernommen.** `aria-current` am aktiven Eintragsknopf in
  `views/Bedienung.tsx`, geprüft im Render-Test, Gegenprobe g); das Recall-Board bleibt unverändert (E22). Ort: Task 10
  Step 1, Step 5 und Step 11.
- **NB23 · `funktionsliste:1` Nr. 93 übersah das Electron-Standardmenü (wichtig) · übernommen.** Der Titler setzt kein
  Menü, also gilt das Standardmenü (`electron.d.ts:8673`; die Kürzel sind aus den Menü-Rollen abgeleitet, das
  Electron-Programm ist nicht installiert). Nr. 93 heißt „Keine eigenen.“ und nennt die Kürzel des Standardmenüs, Nr. 97
  die Wirkung von Strg+R. Ort: Task 1 (Nr. 93 und 97, Prüfung in Step 3, fünfte Gegenprobe in Step 4), Task 13 Step 10,
  Abnahme 5c, „Bewusst nicht in diesem Plan“, neue OF11.
- **NB24 · `funktionsliste:2` fünf Haken ohne Test (wichtig) · übernommen.** Der Render-Test der Bedienung zeigt Banner,
  Ticker samt Tempo-Schieber (0.02 bis 0.3, Schritt 0.01), eine Grafik-Vorlage ohne Textfelder (Nr. 18) und „Daten /
  Recall“ ohne Variablen (Hilfetext Nr. 36); Gegenproben h), i) und j). Ort: Task 10 Step 1 und Step 11, Review Focus 2.
- **NB25 · `funktionsliste:3` falscher Befund-Verweis · übernommen.** Slot-Text und NFC stehen beide in Befund 8. Ort:
  Task 13 Nr. 37, „Bewusst nicht in diesem Plan“.
- **NB26 · `funktionsliste:4` Nr. 94 und Enter auf den Haupttasten · übernommen.** Ein gehaltenes Enter löst die vier
  Haupttasten nur einmal aus (`packages/ui/src/components/TallyButton.tsx:101`, L4). Ort: Task 13 Nr. 94, G2 (L4), E12.
- **NB27 · `funktionsliste:5` Nr. 81 „neu ist nur der Startwert“ · übernommen.** Nr. 81 nennt den Startwert „nicht
  geladen“ und den Ablehnungs-Zweig, der die Liste auf „unbekannt“ setzt. Ort: Task 13 Nr. 81 und die Abweichungs-Notiz.
- **NB28 · `funktionsliste:6` Nr. 96 „schließt immer“ mit Ausnahme · übernommen.** Escape schließt das Panel; nur in einem
  Feld mit geändertem Entwurf verwirft der erste Escape den Entwurf, der zweite schließt
  (`packages/settings/src/entwurf.ts:141-143`, `panelTaste`). Ort: Task 13 Nr. 96.
- **NB29 · `funktionsliste:7` E24 verschwieg den inhaltlichen Wegfall · übernommen (Owner zur Kenntnis).**
  `DataLinkSection` und `IveoSection` haben keine Hilfetext-Prop; ein Hinweistext bräuchte eine Änderung in `@jm/settings`
  und einen neuen Text (OF8). Stattdessen nennen E24, Task 11 und die Funktionsliste den Wegfall (Dateiformat, Weg zu iveo)
  mit Verweis aufs Handbuch `packages/cookbook/content/tool-manuals/tool-jm-titler.md`. Ort: E24, Task 11 „Verhalten“,
  Task 13 Nr. 42 und 49.
- **NB30 · Abschluss-Messung (15.10.2026).** Frische Kopie von `5e5b234ec3` (`git archive`, `node_modules` als Junctions,
  `@jm/*` auf die Pakete der Kopie), der ganze Plantext Aufgabe für Aufgabe maschinell eingespielt: 250 Operationen,
  Fehler 0, jede Vorher-Stelle genau einmal; `cookbook:build` nach Task 15 Step 5 wie in Step 6. Nach jeder Aufgabe liefen
  die Zähl-Läufe (Titler alter Lauf und Oberflächen-Lauf, `@jm/ui`, `@jm/settings`, app-runtime, Steuerprotokoll), nach
  Task 9 bis 12 dazu Bau und Klassen-Probe; alle Werte gleich der Tabelle „Gemessene Zählstände“, auch die Prüfung aus
  Task 1 und der Prüfbefehl aus Task 14. Am Endstand: Task 16 Step 1 wörtlich wie erwartet (Titler 799 = 538 + 261,
  zweimal „ALLE TESTS OK“; ui 680; settings 463; app-runtime `50 passed, 0 failed` und `254 passed, 0 failed`;
  Steuerprotokoll 80), Typprüfung aller 31 Workspaces allein `Exit=0`, 0 `error TS`, `typecheck:test` läuft mit (95 s),
  Titler-Bau `Exit=0` (CSS 50,64 kB), Klassen-Probe 20 `ok` und 0 `FAIL` (71 Klassen aus `packages/ui/src`, 39 aus
  `packages/settings/src`), Galerie 20 `ok`, Kochbuch frisch (43 Rezepte), CI 22 Schritte, `0.11.0 / Lock 0.11.0`. Diff
  gegen die Basis: 63 Dateien (28 neu, 35 geändert), 4313+/776−, alle auf Pfaden aus G1, Gegenprobe `Dateien 65,
  außerhalb G1 2`; neue Dateien alle LF, geänderte nicht gemischt, nur `cookbook.json` mit LF; byte-gleich 33 Pfade,
  76 Dateien, 0 abweichend. Gegenproben am Endstand: Task 13 (die neun Proben wörtlich, danach „Liste und Bedienung
  unverändert“), Task 14 (`false`, 1). Ein zweites Abspielen ohne Tests in eine weitere frische Kopie (250 Operationen,
  Fehler 0, `cookbook:build` an derselben Stelle): alle 1861 nicht ignorierten Dateien Byte für Byte gleich mit der
  Messkopie, darunter die 63 berührten. Die Gegenproben aller Aufgaben haben die drei Teile gemessen (Task 1–8, 9–12 und
  13–16, je Datei danach Byte für Byte zurück); dazugekommen sind 26 Gegenproben und eine Positivprobe (Selbstprüfung 4).
- **NB31 · Widersprüche zwischen den Teilen aufgelöst.** Die Teile hatten die Folgen für den Kopf offen gelassen. Auf die
  Messung gesetzt: Tabelle „Testläufe“ (Titler 538 + 261 = 799, `@jm/ui` 680), Tabelle „Gemessene Zählstände“ (Zeile 1, 2,
  5, 6, 8 bis 13 und 16 samt Einleitung), Z1, Z3, Z8 und Z10 (Stand nach der Nachbesserung, die Werte beim Zusammensetzen
  bleiben genannt, wo sie Geschichte sind), Task 16 „Gemessen“ (Typprüfung 95 s im Abschluss, im Teil 3 91 s; Tabelle und
  Text nennen denselben Lauf) und die Selbstprüfung (Abdeckung mit den neuen Tests, neue Zeilen 4.1/4.2 und 9.1, 7.1 mit
  576 und 24 Fällen, Punkt 3 mit `TS2345`, Punkt 4 mit den neuen Gegenproben). Geprüft und einheitlich: E1–E25, L1–L6,
  T1–T11, Z1–Z10, OF1–OF14 (OF11 und OF12 aus Teil 1, OF13 und OF14 aus Teil 3, alle mit Vorgabe und Frist im Kopf und in
  „Vor der Umsetzung“), „Nach der Umsetzung“ Punkt 5 bis 9 an allen Verweisstellen, „Abnahme-Bau“ als einziger Begriff für
  den lokalen Bau, „Befund 8“ statt „Befunde 8 und 13“, und dieselbe Signatur `iveoAbschnitt(s: OberflaechenStand)` in
  Task 8 und 11 (der Master-Link kommt über `OberflaechenStand.masterLink`). Keine neue Owner-Frage aus dem Abschluss.

**Letzte Nachbesserung (15.10.2026): Restlücken der Nachprüfung und Owner-Antworten.** Die Nachprüfung fand keinen neuen
Widerspruch, aber fünf Stellen, an denen ein absichtlicher Fehler grün blieb bzw. eine Wirkung nur abgeleitet war (R1–R5).
Jede ist geschlossen und mit einer Gegenprobe gemessen, die rot wird; keine ändert Produktcode außer dem Zuschnitt des
Brücken-Hooks (NB32), keine berührt Protokolle, IPC oder Main.

- **NB32 · R1 Hook-Wächter nur auf Teilstrings · geschlossen.** Die Mutation der Nachprüfung (der Effekt übernimmt eine
  Meldung nur, wenn sie nicht `null` ist) blieb grün: Ein Hook, der das Schließen der Brücke verschluckt, hätte weiter den
  alten Wert gezeigt. Jetzt ist der Körper des Effekts die reine Funktion `hookAbo` in `useBrueckenWert.ts` (nur für den
  Test exportiert); ein Verhaltenstest lässt sie mit der Attrappen-Quelle laufen und prüft nach jeder Meldung `hookWert`
  (Antwort verbunden, dann sucht, fehler, `null`; Stille nach dem Abmelden), und der Hook selbst steht im Test wörtlich,
  denn ohne DOM laufen seine Effekte nicht. Gegenprobe 14 (die Mutation der Nachprüfung im Effektkörper) und 15 (derselbe
  Fehler im Hook) sind rot, ebenso 9, 12 und 13 auf dem neuen Aufbau. Ort: Task 5 (Interfaces, Verhalten, Step 1, 6, 9, 10,
  11, Commit, Abweichungen), E5, Review Focus 1. `@jm/ui` bleibt bei 670 `ok` (drei Prüfungen ersetzt, keine dazu).
- **NB33 · R2 Standardmenü im dauerhaften Test · geschlossen.** `funktionsliste.test.ts` prüfte bei Nr. 93 nur „keine“.
  Jetzt verlangt Nr. 93 das Electron-Standardmenü samt Strg+R (Spalte „Element“) und das Standardmenü in „künftig wo“; eine
  neue Einzelprüfung verlangt bei Nr. 97 Standardmenü, Strg+R und „Abnahme 5c“ in beiden Spalten. Gegenproben 10 und 11
  (Menü aus Nr. 93 bzw. Nr. 97 gestrichen) sind rot. Ort: Task 13 Step 1, 3, 12, 14, Commit, Abweichungen und „Gemessen“;
  Review Focus 2.
- **NB34 · R3 Verdrahtung der Felder der Bedienung · geschlossen.** Gerendert war nur, dass die Felder da sind. Der neue
  Test ruft ohne Browser das `onChange` jedes Felds auf (über den Baum, den `Bedienung` beim Server-Render zurückgibt) und
  vergleicht den Patch an `setConfig`: Name, Untertitel, Banner-Text, Ticker-Text, Ticker-Tempo und die zwei Slots einer
  Grafik-Vorlage. Gegenproben k) (Banner-Text schreibt in `subtitle`) und l) (Ticker-Tempo schreibt nichts) sind rot;
  Gegenprobe h) zeigt jetzt zwei `FAIL`. Ort: Task 10 (Verhalten, Step 1, 8, 11, 12, Commit, Abweichungen), Review Focus 2.
- **NB35 · R4 Panel-Bildschirm bei nicht geladener Monitorliste · geschlossen.** Der Panel-Test rendert „Ausgabe auf
  Bildschirm“ mit `displays` undefined und verlangt „unbekannt“ statt der Auswahl „Kein Bildschirm gefunden“. Gegenprobe f)
  ist die Mutation K4 der Prüfung (`stand.displays ?? []` nur im Panel), die vorher grün blieb; sie ist rot. Ort: Task 11
  (Verhalten, Step 1, 2, 5, 8, 9, Commit, Abweichungen), Review Focus 1.
- **NB36 · R5 Strg+R in der Abnahme gemessen statt abgeleitet · geschlossen.** Abnahme 5c misst jetzt ohne echte Sendung,
  was Strg+R nach „Take“ auf einer Testquelle (NDI-Ausgabe nur in einer Vorschau, Ausgabe auf Bildschirm an) mit ON AIR,
  NDI-Bild, Ausgabefenster und den Statuseinträgen NDI und Bildschirm tut; die Erwartung aus dem Code steht dabei, eine
  Abweichung ist ein Befund für den Folgeplan. OF11 und Funktionsliste Nr. 97 sagen „aus dem Code abgeleitet, gemessen in
  Abnahme 5c“ statt „abgeleitet, nicht gemessen“. Ort: OF11, Task 1 (Nr. 97, Abweichungen), Task 13 (Nr. 97 „künftig wo“),
  Task 14 (Zeile 5c, Abweichungen). Gemessen: Der Prüfbefehl aus Task 14 meldet weiter 19 Zeilen und 0 ASCII-Anführungszeichen,
  die Datei hat weiter 59 Zeilen; die Prüfung aus Task 1 meldet weiter „Funktionsliste in Ordnung“.
- **NB37 · Owner-Antworten (15.10.2026) · eingetragen.** Der Owner hat alle Vorgaben OF1–OF14 bestätigt („passt“), auch
  OF8 (Texte T1–T11 wie im Plan) und OF13 (Abnahme mit dem lokalen Abnahme-Bau vor Merge und Release). Ort: Abschnitt
  „Owner-Fragen“ (Satz unter der Überschrift, Spalte „Owner“ je Zeile), Absatz „Spec“ im Kopf, G5, Task 1 (Abweichungen,
  OF11), Task 14 (Zeile 5c), „Vor der Umsetzung“. Keine Aufgabe ändert sich dadurch. Die Freigabe des Releases selbst bleibt
  nach der Abnahme beim Owner („Nach der Umsetzung“, Punkt 8).
- **NB38 · Abschluss-Messung der letzten Nachbesserung (15.10.2026).** Frische Kopie von `5e5b234ec3` (`node_modules` als
  Junctions, `@jm/*` auf die Pakete der Kopie), der ganze Plantext Aufgabe für Aufgabe maschinell eingespielt: 250
  Operationen, Fehler 0, jede Vorher-Stelle genau einmal. Je Aufgabe liefen an den Stellen des Plans jeder rote und grüne
  Lauf (Befehl aus dem Plantext, erwarteter Block maschinell gegen das Log verglichen), die Typprüfungen (alle 31
  Workspaces nach Task 2, 3 und 16 je `Exit=0`, 0 `error TS`), Bau und Klassen-Probe (Task 7, 9–12 je 20 `ok`; CSS 51,58,
  50,81, 51,18, 50,67 und 50,64 kB wie bisher) und alle Gegenproben (jede Datei danach Byte für Byte zurück). Abweichungen vom
  erwarteten Block gab es nur, wo die Messkopie kein Git hat (`git check-ignore` in Task 4 Step 8, `git diff --numstat` in
  Task 15 Step 6 und 11; dort per `git diff --no-index` gegen eine Basis-Kopie nachgemessen: dieselben Zahlen 3/2, 1/1,
  1/1, 3/1, 9/7, 11/9 und 0 neue ASCII-Anführungszeichen) und bei den absichtlich gekürzten ist/soll-Zeilen in Task 6
  Step 4. Die Gegenproben, die sich nicht ändern sollten, gaben wörtlich dieselbe Ausgabe wie in den drei Teilen der
  Nachbesserung (Task 1–4, 6–9 und 12: 69 von 69 Logs gleich, dazu die unveränderten Proben a–g, i und j in Task 10 und
  a–e in Task 11; die Probe ohne Kontext in Task 6 wieder „Vorher 2-mal“ wie in NB10). Neu bzw. geändert und gemessen: Task 5 (15 Proben, 3, 2, 1, 2, 1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 1 `FAIL`), Task 10
  (12 Proben, h jetzt 2 `FAIL`), Task 11 (6 Proben), Task 13 (11 Proben); jeder Erwartungsblock maschinell gleich.
  Zählstände je Aufgabe: Titler alt 512 → 533 → 538; Oberflächen-Lauf 14, 52, 76, 111, 136, 148, 264; `@jm/ui` 670, 679,
  680; `@jm/settings` 463; app-runtime 50/0 und 254/0; Steuerprotokoll 80; Rot-Läufe Task 11 122 `ok` + 14 `FAIL`, Task 12
  143 + 5, Task 13 113 `FAIL` und 689 `ok`. Endstand (Task 16): Titler 802 = 538 + 264, zweimal „ALLE TESTS OK“; ui 680,
  settings 463, app-runtime 50/0 und 254/0, Steuerprotokoll 80; Typprüfung aller 31 Workspaces `Exit=0` (75 s), `0`,
  `31`, `1`; Bau `Exit=0` (CSS 50,64 kB), Klassen-Probe 20 `ok` und 0 `FAIL` (71 und 39 Klassen); Galerie 20 `ok`; Kochbuch
  frisch (43 Rezepte), CI 22 Schritte, `0.11.0 / Lock 0.11.0`. Diff gegen die Basis: 63 Dateien (28 neu, 35 geändert),
  4429+/776−, Pfadfilter `Dateien 63, außerhalb G1 0`, Gegenprobe `Dateien 65, außerhalb G1 2` mit `Exit=1`; neue Dateien
  alle LF, geänderte nicht gemischt, nur `cookbook.json` mit LF; byte-gleich 33 Pfade, 76 Dateien, 0 abweichend, die
  Gegenprobe mit `views/OperatorView.tsx` abweichend. Zweites Abspielen ohne Tests in eine weitere frische Kopie (250
  Operationen, Fehler 0, `cookbook:build` nach Task 15 Step 5): alle 1861 nicht ignorierten Dateien Byte für Byte gleich
  mit der Messkopie, darunter die 63 berührten. Die geänderten Zählstände stehen im Kopf (Tabellen „Testläufe“ und
  „Gemessene Zählstände“, Z1, Z3, Z8, Z10), in den Aufgaben 10 bis 13 und 16 und in der Selbstprüfung.

## Selbstprüfung des Plans

**1. Spec-Abdeckung** (je geforderter Abschnitt; jede Zeile ist durch die Messung beim Zusammensetzen gedeckt und nach der
Nachbesserung neu gemessen, zuletzt in der Abschluss-Messung der letzten Nachbesserung NB38; „neu“ markiert Tests und
Entscheidungen aus der Nachbesserung, „zuletzt“ die aus der letzten Nachbesserung zu den Restlücken R1–R5)

| Spec | Anforderung | Aufgabe(n) |
| --- | --- | --- |
| 3.9 Master-Link | eine lesende Brücke in `@jm/app-runtime` (Ereignis an den Renderer und Abfrage), einmal gebaut, in jedem Tool nutzbar; kleine, benannte Ausnahme von U6 (UO3) | 2 (Kanal `jmps:master-link`, Meldung, Registrierung in `los`, Senden beim Anhängen, Wächter gegen Doppelung mit R2; neu: R2-Importe relativ geprüft, Registrierung samt Einzug als Probe), 4 (Preload und Typen des Titlers), 5 (Abbildung auf den Statuseintrag, Brücken-Hook; neu: Übergang `hookSchritt`/`hookWert`, Verlauf verbunden → sucht → fehler → `null`, Quellwechsel, Verdrahtung im Hook; zuletzt: der Effektkörper `hookAbo` läuft mit einer Attrappen-Quelle und übernimmt jede Folgemeldung, auch `null`, der Hook steht wörtlich im Test, R1), 9 (Quellen ohne `window`, Eintrag im Rahmen) |
| 3.9 Fernsteuerung | lesende Meldung `{läuft, port, clients, modus}` aus dem vorhandenen Steuerserver, Port 8726 fest | 3 (Getter `modus()`, `naechsteFernsteuerung`, Statusfeld, drei Anlässe im Main), 8 (Statuseintrag und Abschnitt), 11 (Panel); neu: E6 (Modus des laufenden Servers, „Neustart nötig“ erst mit OF6, Abnahme 4e) |
| 4.1, 4.2 (berührt) | additive Erweiterung der Bausteine; Warnung orange, Statusfarben nie nur auf Wörtern | neu: 9 (`StatusPill` mit optionaler Prop `kuerzen`, ohne Prop unverändert, E18, Test in `@jm/ui`), 10 und 12 (E25: Hinweis-Kasten, Hinweisband und Karte B1 in `--status-warn`; Test: keine Datei unter `views/` nutzt `--warning`) |
| 5.1 Kopfzeile | wie 3.2, `headerCenter` mit der Anzeige aus Master-Link 2b R2 | 9 (`VerbundZeile` als `StatusPill`, mit „…“ gekürzt über die neue Prop `kuerzen`, R2-Felder im Preload unverändert), 8 (`verbundZeileZustand`) |
| 5.1 Live-Bereich | das „immer sichtbare“ Element oben bzw. links; höchstens vier `TallyButton`s; Nebenbereiche als `Collapsible` mit `persistId` | 10 (Vorschau als erstes `<canvas>`, vier Tasten, `titler.graphics`, `titler.recall`; neu: Wächter `live={live}`, `aria-current` am aktiven Eintrag, Banner, Ticker samt Tempo, Vorlage ohne Textfelder und Variablen-Hilfetext gerendert; zuletzt: jedes Feld der Bedienung schreibt beim Tippen in seinen Schlüssel, R3), 8 (`hauptTasten`); Breite bei offenem Panel: E19 gerechnet, Abnahme 6a auch bei 960 px |
| 5.1 Einstellungen, Statusleiste | Panel über ⚙ oder Statuseintrag, schiebt den Inhalt zusammen; Statusleiste nach 3.3 | 9 (Rahmen, Panel-Zustand; neu: Quelltext-Wächter, dass ⚙ und Statuseintrag das Panel am Abschnitt öffnen und die fünf Aktionen an Store und Preload gehen), 11 (Abschnitte, Anker je Statuseintrag), 8 (Leiste in fester Reihenfolge, E20) |
| 5.3 | Ausgabefenster unverändert | G3; 12 (Hash-Test auf `OutputView.tsx`, `lib/engine.ts`, `ImportDialog.tsx`), 16 (byte-gleich gegen die Basis) |
| 6 | Abschnitte aus `@jm/settings` (NDI-Ausgabe, Bildschirm, Fernsteuerung, iveo, DataLink) mit `locked`, ausblenden statt ausgrauen; tool-eigen Stil und Grafik-Vorlagen | 6 (additive Props, OF3, OF4), 8 (Props je Abschnitt, OF2, OF5, OF7), 10 und 11 (Panel mit sieben Abschnitten, Sperrgrund im Verbund; neu: DataLink mit Fehler und mit „Ordner fehlt“ gerendert); NDI-Quellenname bei Enter bzw. Verlassen (L1, OF14); „Vorschau des Namens im Netz“ und „Neustart nötig“ aus 6.2 nicht im Pilot (E7, E6, OF6, Abnahme 4c und 4e) |
| 7.1 | Kreuzprodukt je Eintrag | 5 (Master, 12 Eingänge), 8 (iveo 576 mit der Achse Master-Link, NDI 24 mit der Auflösung `1920x1081`, Bildschirm 24, Fernsteuerung 18, DataLink 48, Haupttasten 24 Fälle, ganze Leiste 360), 3 (Ereignisfolgen) |
| 7.2 | unbekannt ist nicht ok | 5 (neu: der Hook zeigt nach einem Abbruch nie den alten Wert; zuletzt auch nicht nach dem Schließen der Brücke, R1), 11 (zuletzt: Panel-Abschnitt „Ausgabe auf Bildschirm“ bei nicht geladener Monitorliste „unbekannt“, R4), 8 (Brücke offen, Monitorliste nicht geladen, keine Steuerserver-Meldung, Kern-Hinweis verdeckt; neu: iveo bei Quelle `master` mit offener oder fehlender Brücke bzw. unbekannter Art „unbekannt“, nie `ok`), 9 (Server-Render ohne Brücke ergibt „unbekannt“; eine abgelehnte Monitorliste bleibt „unbekannt“, Quelltext-Wächter) |
| 7.3 | nur Gemessenes; „an (ohne Rückmeldung)“ | 8 (NDI ohne Senderrückmeldung, Bildschirm ohne Fensterrückmeldung, Empfänger nur bei an und über 0; neu: iveo bei `master` nur mit verbundenem Link `ok`, bei gemessener Trennung „Liste aus früherem Stand“), OF6, OF12 |
| 7.4 | `live` nur für Sendezustände | 8 (über alle Kombinationen kein `live` in der Leiste), 9 (ON AIR aus `live`, E11: per Quelltext-Wächter `onAir={{ live }}`, weil der Server-Render nur `live = false` kennt; gerendert ist nur „bereit“), 10 (Take live: `liveTasten` mit `live` als Prop, die Verdrahtung `live={live}` per Quelltext-Wächter) |
| 8 | Hell und Dunkel, gemerkt je Arbeitsplatz | 9 (`ThemeToggle` über `AppHeader`), 12 (Recall-Board übernimmt das Theme, Ausgabefenster nicht), 14 (Abnahme 2a–2d) |
| 9.1 | released wird erst nach der Abnahme der Welle und nur mit Owner-Freigabe | neu: „Nach der Umsetzung“ Punkt 5–8 (Release-Commit auf dem Branch, lokaler Abnahme-Bau, Abnahme, erst danach Merge, Tag, Release und Katalog), 14 (Voraussetzung Abnahme-Bau), 16 Step 5 (Version bleibt 0.11.0), OF13 |
| 10 | Funktionsliste vor dem Umbau aus dem Code; danach jeder Punkt abgehakt mit Ort; Pflichtpunkt Leertaste/Escape im Panel; Kürzel bleiben gleich | 1 (103 Zeilen, Nr. 93 „Keine eigenen.“ samt Electron-Standardmenü, Nr. 96 Pflichtpunkt; neu: Prüfung und Gegenprobe auf Nr. 93), 13 (jede Zeile mit Haken und Ort, Test im zweiten Lauf, Querprüfungen gegen den Code; neu: Nr. 94 und 96 widerspruchsfrei, Nr. 42 und 49 nennen den Wegfall samt Handbuch; zuletzt: das Electron-Standardmenü in Nr. 93 und 97 im dauerhaften Test, R2), 11 (NDI-Schalter `role="switch"`, kein Tastenhandler im Titler), G2 (Ausnahmen N1, N2 und die benannten Änderungen der Bedienlogik L1–L6), OF11 (vom Owner bestätigt) |
| 11 | Render-Tests ohne Browser, Logiktests, Selbsttest der App; bestehende Selbsttests, Typprüfung und CSP-Test bleiben grün | 7 (zweiter `tsx`-Lauf, `tsconfig.test.json`, `typecheck:test`, CI-Schrittname), 8–13 (Render- und Logiktests; neu: Quelltext-Wächter für Verdrahtung, die ein Render ohne Browser nicht zeigt), 2 (4b- und CSP-Wächter bleiben grün), 16 (alle Läufe, alle Workspaces) |
| 12 | Abnahme-Datei mit den Punkten 1–6 und den Titler-Punkten | 14 (`docs/ux/ABNAHME-UX-Welle-0.md`, 19 Zeilen, 10 Zusatzprüfungen; neu: 4b und 4f führen jeden Zustand des iveo- und DataLink-Eintrags herbei, an `statusLeiste` gemessen; 4c und 4e mit den Hinweisen aus E7 und E6; 5c Strg und R; 6a auch bei 960 px; zuletzt: 5c misst Strg und R nach „Take“ auf einer Testquelle, R5) |
| Anhang A „Titler“ | immer sichtbar Vorschau und Take/Clear; Haupttasten Take, Clear, ◀/▶ Eintrag; On-Air aus `live`; Statuseinträge Master-Link, iveo, NDI, Bildschirm, Fernsteuerung, DataLink; Einstellungen wie gelistet, tool-eigen Stil und Grafik-Vorlagen; Zusatzfenster ohne AppShell; Recall-Board mit denselben Hinweisen | 8, 9, 10, 11, 12 (Board ohne AppShell, Hinweise aus derselben Quelle, OF1); E12 (Text „Take“ statt „● Take“, OF8); E20 (Label „Fernsteuerung“, OF2) |

**2. Platzhalter-Scan:** Nach „TBD“, „TODO“, „später“, „ähnlich wie Task“, offenen Messmarken der Schreiber und den Platzhaltern
für Zählstände aus Block B und C gesucht: keine (Z1). Stehen geblieben sind nur erklärte Pfad- und Wertplatzhalter in Befehlen und Ausgaben (`<eigener
Scratchpad>` nach G17, `<worktree>` bzw. `<Worktree>`, `<Dateien>` im Zeilenenden-Befehl von Block A, `<Pfade>` in der
Beschreibung der Byte-Gleichheit, `{Name}`, `{n}` und `{hex}` als Teile von Nutzertexten). Jeder Code-Schritt enthält den
vollständigen Code; „nicht gemessen“ steht nur, wo ohne Electron, Browser oder Owner nichts zu messen ist (Laufzeit von
`ipcMain.handle` in `los`, Aussehen, Zoom im Titler; je mit Abnahmepunkt). In den Inhalten der Funktionsliste (Task 1) und
der Abnahme-Datei (Task 14) kennzeichnen „abgeleitet“ und „nicht gemessen“ die Herkunft einer Aussage; das ist gewollt.

**3. Typ-Konsistenz:** Die Namen, Signaturen und Props aus den Schnittstellen (S-A1 bis S-C, je Aufgabe unter
„Interfaces“) sind beim Zusammensetzen durch das Einspielen geprüft: Jede Vorher-Stelle passte genau einmal, nach jeder
Aufgabe war `npm run typecheck -w @jm/titler` grün (ab Task 7 mit `typecheck:test`, also auch die Oberflächentests), nach
Task 5 und 6 `-w @jm/ui` und `-w @jm/settings`, nach Task 2, 3 und 16 alle 31 Workspaces ohne `error TS`. Der strukturelle
Gleichlauf `MasterLinkMeldung` (app-runtime) → `MasterLinkMeldungZeile` (Titler) → `MasterLinkMeldung` (`@jm/ui`) ist über
die Zuweisung im Preload (Task 4, Gegenprobe `TS2322` und `TS2345`) und den Aufruf in `lib/oberflaeche.ts` (Task 8)
belegt. Die Nachbesserung hat Typen nur additiv erweitert (`StatusPill` `kuerzen`, die für den Test exportierten
`hookSchritt`/`hookWert`, `masterLink` als Eingang von `iveoAbschnitt` über `OberflaechenStand`); die Typprüfung aller
31 Workspaces blieb im Abschluss ohne `error TS` (NB30). Die letzte Nachbesserung ergänzt nur die für den Test exportierte
Funktion `hookAbo` (Signatur unter Task 5 „Interfaces“); die Typprüfung aller Workspaces bleibt ohne `error TS` (NB38). Abweichend
vom Gerüst und begründet (Z4): `Einstellungen` hat in Task 9 die kurze Form `{ stand, aktionen }` und ab Task 10 die
Register-Form; `views/felder.tsx` exportiert bis Task 10 auch `Field` und `Labeled`.

**4. Review Focus:** Alle fünf Zeilen haben Tests in den genannten Aufgaben, und jede dieser Prüfungen hat eine Gegenprobe,
die rot wurde (Task 2, 3, 5, 7, 8, 9–13; gemessen von den Schreibern bzw. beim Zusammensetzen, Z8). Die Nachbesserung hat
26 Gegenproben und eine Positivprobe ergänzt (Task 1: 1, Task 2: 1 und die Positivprobe, Task 5: 4, Task 8: 3, Task 9: 9,
Task 10: 6, Task 11: 1, Task 12: 1), darunter Mutationen, die die Prüfer mit dem alten Plan grün durchbrachten (ON AIR
tot, Take-Tally an NDI, ⚙ ohne Wirkung, Statusklick ohne Abschnitt, tote Ordnerwahl, NDI ohne Namen, K1 tot, Hook hält den
ersten Wert, alter Wert nach Quellwechsel, Ladefehler der Monitorliste als leere Liste, ungerade Höhe, DataLink-Fehler
nicht im Panel); alle Gegenproben von Task 1–16 sind dabei neu gemessen (NB30). Die letzte Nachbesserung hat sieben
Gegenproben ergänzt (Task 5: 14 und 15, Task 10: k und l, Task 11: f, Task 13: 10 und 11) und in Task 5 die Proben 9, 12
und 13 auf den neuen Aufbau des Hooks gezielt; sie fangen die Mutationen, die nach der Nachprüfung noch grün blieben
(Effekt verschluckt `null`, Feld schreibt in den falschen Schlüssel oder nichts, Panel-Bildschirm mit leerer Liste statt
„unbekannt“, Standardmenü aus Nr. 93 bzw. 97 gestrichen). Alle Gegenproben von Task 1–16 sind danach noch einmal gemessen
(NB38). Zusätzlich geprüft und gedeckt: Zeilenenden neuer Dateien mit
einer Prüfung, die den Fehler auch zeigen kann (Z2); die Funktionsliste gegen Groß- und Kleinschreibung von Pfaden unter
Windows (Task 13, Proben 5 und 6). **Nur mit Electron bzw. im Fenster messbar** und deshalb nicht durch Tests gedeckt: dass
die Abfrage der Brücke beim Start ankommt (Abnahme, Zusatzprüfung 5), das Aussehen in Hell und Dunkel, die Schmal-Ansicht
über den Zoom und das Verhalten der Tasten im Panel; das sind die Abnahmepunkte in `docs/ux/ABNAHME-UX-Welle-0.md`.

## Vor der Umsetzung (nur Controller und Owner)

Dieser Abschnitt ist keine Aufgabe für ausführende Agenten.

- Der Owner hat OF1–OF14 am 15.10.2026 beantwortet: alle Vorgaben bestätigt (Tabelle „Owner-Fragen“, Spalte „Owner“),
  auch OF8 (Texte T1–T11 wie im Plan) und OF13 (Abnahme mit dem lokalen Abnahme-Bau vor Merge und Release). Damit ändert
  sich keine Aufgabe, und keine Frist aus der Spalte „spätestens vor“ ist mehr offen. Offen bleibt nur, was erst nach der
  Abnahme kommt: die Freigabe des Releases durch den Owner („Nach der Umsetzung“, Punkt 8).
- Zur Kenntnis nimmt der Owner die Auslegungen E1–E25, die benannten Änderungen der Bedienlogik L1–L6 (G2), die
  Abweichungen der Montage Z1–Z10 und die Nachbesserung nach der Plan-Prüfung NB1–NB38.
- Der Controller richtet den Umsetzungs-Worktree ab `5e5b234ec3` ein und lässt dort `npm ci --ignore-scripts` laufen, damit
  `node_modules/@jm/settings` existiert (Task 7 Step 0 prüft den Link und hält sonst an).
- Liegt `main` bei der Umsetzung weiter als `5e5b234ec3`, wird der Plan neu aufgesetzt: Der Controller spielt den Plantext
  auf einer frischen Kopie des neuen Stands ein und misst Vorher-Texte, Zeilen, Zählstände, Lock-Zeilen und Rot-Meldungen
  nach. Weicht etwas ab, wird der Plantext vor dem Start nachgebessert, nicht während der Ausführung (G16). Besonders
  empfindlich sind die Stellen, die R2 und Zoom 4b mitbenutzen: `packages/app-runtime/src/index.ts` (Task 2),
  `apps/titler/src/main/index.ts` und `apps/titler/test/selftest.ts` (Task 3, 4), `package-lock.json` (Task 7) und
  `.github/workflows/ci-checks.yml` (Task 2, 7).

## Nach der Umsetzung (nur Controller und Owner)

Dieser Abschnitt beschreibt, was nach Task 16 geschieht. Er ist keine Aufgabe für ausführende Agenten; was hier steht,
entscheidet und tut der Controller mit dem Owner.

1. Hat sich `main` vor oder während der Umsetzung bewegt, setzt der Controller den Branch auf den neuen Stand neu auf und
   misst nach (Vorher-Texte, Zählstände, Lock-Zeilen, Rot-Meldungen; Weg wie unter „Vor der Umsetzung“). Erst danach folgen
   Review und Pull Request.
2. Review des ganzen Branches durch einen frischen Reviewer: Spec-Treue, Review Focus 1–5, G1–G4, E1–E25, Z1–Z10 und
   NB1–NB38.
   Befunde gehen als Nachbesserung in diesen Plan, mit neuer Messung der betroffenen Aufgaben.
3. Pull Request gegen `main`. In der CI sind „Typecheck (alle Workspaces)“ und „Selbsttests“ grün; der Link
   `@jm/settings` entsteht dort durch `npm ci`, und die Lock-Zeile aus Task 7 ist damit bestätigt. Reine Doku-Commits lösen
   keine CI aus (`paths-ignore`).
4. Der Durchgang R2 (`apps/launcher/test/e2e-teil2b-verbund.ts`) mit dem gebauten Titler läuft nur nach Freigabe durch den
   Owner, weil er Electron startet.
5. Version: Titler 0.12.0 (Minor nach Spec 9.1) in `apps/titler/package.json:3` und in der Versionszeile des Lock-Blocks
   `apps/titler` (`package-lock.json:738`). `packages/suite-manifest/changelog.json` bekommt im Block `titler` vor dem Eintrag 0.11.0 (`:1103`) einen Eintrag für 0.12.0 (eine Release-Änderung, keine Aufgabe dieses Plans; G1 gilt für die Aufgaben); die Notes sind ein Entwurf
   zur Freigabe durch den Owner. Prüfmuster: JSON parsebar, Versionen in Paket, Lock und Changelog gleich, keine
   ASCII-Anführungszeichen im neuen Eintrag. Die R2-Note von 0.11.0 nennt noch den alten Ort „vor „Suite · … verbunden““;
   sie bleibt als Historie stehen. Dieser Release-Commit liegt auf dem Branch, vor dem Abnahme-Bau; gemergt wird erst nach
   der Abnahme (Punkt 8).
6. Abnahme-Bau (Spec 9.1: released wird erst nach der Abnahme und nur mit Owner-Freigabe; OF13): Aus dem Branch mit dem
   Release-Commit entsteht lokal nach `docs/release-titler.md` (mit NDI-SDK, ohne Veröffentlichung, `--publish never`) die
   Datei `JM Titler-0.12.0-win-x64.exe`. Der Owner installiert sie von Hand an A und B über die installierte 0.11.0, im
   vorgeschlagenen Installationsordner. Der Launcher startet den Titler weiter über die Kachel: Er erkennt ein Tool an der
   Programmdatei am Installationspfad und vergleicht für Updates mit der zuletzt von ihm installierten Version, bietet also
   bis zum Release kein Update an (`apps/launcher/src/main/install-state.ts`, `updates.ts`, am Code gelesen). Vor der
   Abnahme gibt es keinen Merge, keinen Tag, kein GitHub-Release und keinen Katalog-Eintrag. Für den Mac gilt OF10.
7. Owner-Abnahme nach `docs/ux/ABNAHME-UX-Welle-0.md` mit diesem Abnahme-Bau. Vorher laufen nach OF9 die offenen Abnahmen
   2a, 2b-R1 und 2b (R2) noch auf 0.11.0; sonst gilt der Hinweis zu den offenen Abnahmen in der neuen Abnahme-Datei.
   Befunde gehen als Nachbesserung in diesen Plan; danach entsteht ein neuer Abnahme-Bau, und die betroffenen Punkte
   laufen erneut.
8. Release erst nach bestandener Abnahme und nur mit Freigabe des Owners (Spec 9.1), wie 0.10.1 und 0.11.0 in dieser
   Reihenfolge: Merge, Tag `titler-v0.12.0` auf dem Merge-Commit, lokaler Bau aus dem Tag nach `docs/release-titler.md`,
   GitHub-Release mit dieser `.exe`, danach von Hand `bump-manifest` mit „[skip ci]“. `main` liegt vor dem Tag auf dem
   Remote, weil der CI-Bump auf `main` schreibt. Weicht der Code beim Merge vom abgenommenen Stand ab (`main` hat sich
   bewegt), gilt Punkt 1, und die betroffenen Abnahmepunkte laufen mit einem neuen Abnahme-Bau erneut. Welle 1 beginnt erst
   nach dieser Abnahme (Spec 9.2). Roadmap (`docs/roadmap.md` Lane E, Release-Reihenfolge) und Roadmap-Index werden
   nachgeführt.
9. Befunde gehen weiter: der R2-Typfehler `apps/titler/test/selftest.ts:685` (E16); die Fundament-Vormerkungen, die der
   Pilot berührt (TallyButton nach dem Entsperren, E3-Wächter `text-base`/`font-*`, StatusBar ohne `whitespace-nowrap`,
   On-Air ohne `role="status"`); der Folgeplan „Titler-Rückmeldungen“ aus OF6; die drei Hashes in
   `apps/titler/test/ui/board.test.tsx` (Ausgabefenster, Engine, Import-Dialog), die eine spätere, gewollte Änderung an einer
   dieser Dateien in derselben Änderung neu setzt (der Test sagt das unter dem `FAIL`); die Folgeaufgaben unter „Bewusst nicht in
   diesem Plan“; und für die Werkzeuge der Pläne die Lehre aus Z2: `$'\r'` in einer Befehlsersetzung zählt unter Git Bash
   5.3 nicht, was es zählen soll.
