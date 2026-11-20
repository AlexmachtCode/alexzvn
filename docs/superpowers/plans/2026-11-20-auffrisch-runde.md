# Auffrisch-Runde (Block 2 nach der COP31) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CI-Bremse und Presenter-Prüfstand beheben, die Live-Tools mit dem mDNS-Fix neu ausliefern, die Stage-Display-Nachricht in die Presenter-Ansichten bringen und den NDI-Lizenztext in Titler, Caption, Switcher und NDI Screen Capture legen.

**Architecture:** Vier Schritte nach Risiko (Spec, Weg B), je Schritt ein PR. Schritt 1 ändert nur Tests und gibt dem NDI-Sender-Kern eine injizierbare Uhr. Schritt 2 und 3 sind Neubauten; der Fix kommt über das gebündelte `@jm/discovery`. Schritt 3 zieht dazu die Nachricht als reine Funktion plus gemeinsame Komponente aus `StageScreen.tsx`. Schritt 4 erweitert die vier `tools/bundle-ndi.mjs` und prüft sie in einem Temp-Baum, nie im echten `resources/`.

**Tech Stack:** TypeScript, Electron 33.4.11 mit electron-vite, React 18 (`renderToStaticMarkup` über `@jm/ui/testhilfe`), tsx, Node-Skripte (.mjs), GitHub Actions (`ci-checks.yml`, `suite-release.yml`).

**Spec:** `docs/superpowers/specs/2026-11-20-auffrisch-runde-design.md` (bindend). Für Task 4 zusätzlich `git show docs/stage-display-ndi:docs/superpowers/specs/2026-11-06-stage-display-ndi-design.md`, Zeile 48 (Regeln der Nachricht) und 88–90 (Kopfzeile `PresenterHeader`, Mitte).

## Global Constraints

- Arbeitsort ist nur der Worktree. Jeder Befehl beginnt mit `cd "C:/Users/alexk/alexzvn/.claude/worktrees/auffrisch-runde"` mit großem `C:`, sonst lädt Node React doppelt und die UI-Tests scheitern fälschlich.
- Der Umsetzer pusht, taggt, released und merged nicht und führt kein `npm install` aus. Aus der Spec: „Jedes Release, jeder Merge und jeder Push nur mit Owner-OK.“ und „Tags immer einzeln pushen.“
- Nicht-Ziele (Spec): kein UX-Umbau, kein `onError`-Durchreichen der mDNS-Fehler ins Log, keine NDI-Quelle im Stage Display.
- NDI-Sender-Kern: Standard bleibt die echte Uhr, der Release-Code verhält sich nicht anders.
- Versionen: Timer 0.14.1, Rundown 0.8.1, Battle 0.4.0, Prompter 0.7.0, Stage Display 0.6.0; je ein Patch-Sprung für Titler 0.12.2, Caption 0.4.1, Switcher 0.10.1 und NDI Screen Capture 0.3.2 (siehe Offene Frage 1).
- Versionssprung immer an zwei Stellen: `apps/<tool>/package.json` und in `package-lock.json` der Eintrag `"apps/<tool>"`, beide von Hand.
- Changelog: ein neuer Eintrag ganz oben in `entries` der App in `packages/suite-manifest/changelog.json`, Form `{ "version", "date", "notes": [] }`, Datum vorerst `"JJJJ-MM-TT"` (der Controller setzt den Release-Tag). In Notes keine ASCII-`"`, typografisch „…“. Den Wortlaut gibt der Owner frei.
- Stabilitätszeile wörtlich nach dem Muster von Launcher 0.18.0 und Q&A 0.6.0: „Stabilität: ‹Tool› stürzt nicht mehr ab, wenn das Netzwerk kurz wegbricht oder die automatische Suche im Netz (mDNS, Port 5353) blockiert ist.“
- NDI-Lizenztext unter Windows: `<NDI_SDK_DIR>\Bin\x64\Processing.NDI.Lib.Licenses.txt` nach `resources/bin/win/`. Fehlt er oder ist er leer, bricht der Bau ab, bevor etwas kopiert ist (Vorbild `apps/presenter/tools/bundle-ndi.mjs:31-57`).
- git: nur explizite Pfade stagen, nie `git add -A`, nach jedem `git add` `git status --short` lesen. Nichts unter `apps/*/resources/bin` committen. Jede Commit-Message endet mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Typografische Zeichen („ “ … –) direkt schreiben, keine `\uXXXX`-Escapes: Edit/Write dekodieren sie.

## Review Focus

1. Eine lange Nachricht in der Kopfzeile bei laufendem Countdown: Sie wird mit „…“ gekürzt, Countdown und Uhr bleiben sichtbar. Test in Task 4.
2. Eine Nachricht nur aus Leerraum erzeugt in keiner der drei Ansichten ein leeres gelbes Element. Test in Task 4.
3. Ad-hoc-Nachricht und blinkende Timer-Nachricht zugleich: Die Ad-hoc-Nachricht gewinnt und blinkt nicht, auch in der Kopfzeile. Test in Task 4.
4. Der Lizenztext liegt im SDK, ist aber leer (0 Byte): Abbruch wie bei fehlender Datei, nichts kopiert. Tests in Task 6 und 7.
5. Ein Neubau ohne den mDNS-Fix, etwa aus einem veralteten Stand: Die Bündelprüfung sucht die Fix-Zeile in `out/main/index.cjs`. Schritte in Task 3, 5 und 8.

---

## Gemeinsame Prüfwerkzeuge (für Task 3, 5, 8 und den Controller)

**Versionsprüfung.** Die Argumente `app=version` tauscht jeder Task gegen seine eigenen aus. Ohne `STRENG=1` gilt der Datums-Platzhalter `JJJJ-MM-TT`, mit `STRENG=1` nur ein echtes Datum (Controller vor dem Merge). Am 20.11. gegen `timer=0.14.0 rundown=0.8.1` gemessen: `ok` / `FAIL`, Exit 1.

```bash
cd "C:/Users/alexk/alexzvn/.claude/worktrees/auffrisch-runde" && node --input-type=module - timer=0.14.1 rundown=0.8.1 <<'EOF'
import { readFileSync } from 'node:fs';
const c = JSON.parse(readFileSync('packages/suite-manifest/changelog.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')).packages;
const datum = process.env.STRENG === '1' ? /^\d{4}-\d{2}-\d{2}$/ : /^(\d{4}-\d{2}-\d{2}|JJJJ-MM-TT)$/;
let fail = 0;
for (const arg of process.argv.slice(2)) {
  const [app, version] = arg.split('=');
  const e = c.find((x) => x.app === app)?.entries[0];
  const p = [];
  if (e?.version !== version) p.push(`oberster Eintrag ${e?.version}`);
  if (!datum.test(e?.date ?? '')) p.push(`Datum ${e?.date}`);
  if (e?.notes.some((n) => n.includes('"'))) p.push('ASCII-Anführungszeichen');
  const pkg = JSON.parse(readFileSync(`apps/${app}/package.json`, 'utf8')).version;
  if (pkg !== version) p.push(`package.json ${pkg}`);
  if (lock[`apps/${app}`]?.version !== version) p.push(`package-lock ${lock[`apps/${app}`]?.version}`);
  if (p.length) fail++;
  console.log(`${p.length ? 'FAIL' : '  ok'}  ${app} ${version} ${e?.date ?? ''} ${p.join(', ')}`);
}
process.exit(fail ? 1 : 0);
EOF
```

**Bündelprüfung mDNS-Fix.** Gemessen am 20.11.: `npm run build -w @jm/<tool>` läuft ohne Electron-Binary, und der Bau von main enthält die Zeile bei Timer, Rundown, Battle, Prompter, Stage Display, Titler, Caption und Switcher je einmal.

```bash
npm run build -w @jm/<tool> && grep -c "mDNS-Fehler (ignoriert)" apps/<tool>/out/main/index.cjs   # erwartet: 1
```

---

## Schritt 1 · nur Tests, kein Release

### Task 1: Injizierbare Uhr im NDI-Sender-Kern, Wackeltest ersetzen

**Files:**
- Modify: `apps/presenter/src/utility/ndi-sender-kern.ts:28-84` (Signatur, `tick`, `starte`, `beendeTakt`)
- Test: `apps/presenter/test/ndi-sender-kern.test.ts` (ganz neu geschrieben, Fälle wie bisher plus die neuen)
- Bleibt unverändert und muss kompatibel bleiben: `apps/presenter/src/utility/ndi-sender.ts:11` (Aufruf mit zwei Argumenten, einziger Aufrufer außer dem Test)

**Interfaces:**
- Produces (exportiert aus `ndi-sender-kern.ts`):
  ```ts
  /** Uhr des Sendetakts: im Release die echte, im Selbsttest eine simulierte. */
  export interface KernUhr {
    /** Monotone Zeit in ms. */
    jetzt(): number;
    /** Ruft fn nach ms ms auf; liefert eine Marke für abbrechen(). */
    planen(fn: () => void, ms: number): unknown;
    abbrechen(marke: unknown): void;
  }
  /** performance.now(), setTimeout, clearTimeout: genau das, was der Kern bisher direkt nutzte. */
  export const echteUhr: KernUhr;
  export function starteNdiSenderKern(
    port: KernPort,
    ladeNdi: () => Promise<NdiSendeModul>,
    taktMs: number = NDI_TAKT_MS,
    uhr: KernUhr = echteUhr,
  ): void;
  ```

- [ ] **Step 1: Test neu schreiben (`apps/presenter/test/ndi-sender-kern.test.ts`)**

Hilfen im Test, kein Export:
- `simulierteUhr(): { uhr: KernUhr; jetzt(): number; vorspulen(ms: number): void; stau(ms: number): void }` mit Start bei 0. `vorspulen(ms)` ruft alle geplanten Rückrufe mit Fälligkeit ≤ jetzt + ms in Fälligkeitsreihenfolge auf. Bei gleicher Fälligkeit gilt die Planungsreihenfolge. Vor jedem Aufruf steht die Uhr auf max(jetzt, Fälligkeit). Unterwegs neu geplante, rechtzeitig fällige Rückrufe laufen mit, am Ende steht die Uhr auf jetzt + ms. `stau(ms)` rückt nur die Uhr vor, das ist die blockierte Ereignisschleife. `abbrechen` entfernt die Marke.
- `attrappenNdi({ initWirft?, dauerMs?, verbindungen?, sim? })` wie bisher, aber `sendVideoBGRA` legt den Puffer als **Verweis** ab (`log.gesendet.push(buf)`, kein `buf.slice()`) und ruft bei `dauerMs` `sim.stau(dauerMs)` auf statt aktiv zu warten.
- `const fluss = () => new Promise<void>((r) => setImmediate(r));` nach jedem `init` (das Laden ist async).
- Jeder Fall bekommt seine eigene simulierte Uhr, Takt 40. Ein Stau beginnt nur direkt nach einer Sendung, die Uhr steht dann auf einem Vielfachen von 40 ab Start. Die Folge unten ist so gemessen (Probe vom 20.11. gegen den heutigen Kern mit global ersetzter Uhr).

```ts
// p1, p2 wie bisher (Laden scheitert / init wirft), mit sim und fluss() statt warte(100)
ck('Laufzeit fehlt → eine Meldung fehler mit erster Zeile', eq(p1.raus, [{ type: 'fehler', grund: 'Addon fehlt' }]));
ck('init wirft → fehler, nichts gesendet', p2.raus[0]?.type === 'fehler' && n2.log.gesendet.length === 0);
ck('init wirft → Grund ist erste Zeile', eq(p2.raus[0], { type: 'fehler', grund: 'NDI-Laufzeit fehlt' }));
// p3 (sim3): init zweimal, fluss(); die Prüfungen „init zählt nur einmal“, „bereit gemeldet“, „Quelle heißt JM Presenter“,
// „Format 1920×1080, 25/1“, „vor dem ersten Bild: transparent“ unverändert übernehmen.
// Bild 7 schicken; vor = gesendet.length; sim3.vorspulen(2000); neu = gesendet.slice(vor)
ck('Standbild: genau 50 Sendungen in 2000 ms (Takt 40 ms)', neu.length === 50);
ck('wiederholt das letzte Bild', neu.every((b) => b[0] === 7));
ck('Standbild: jede Sendung ist derselbe Puffer (Verweis statt 8,3-MB-Kopie je Takt)', neu.every((b) => b === neu[0]));
// „Empfängerzahl etwa jede Sekunde, 2 Verbindungen = 1 Empfänger“ und „stat meldet nie die rohe Verbindungszahl“ unverändert
// bild mit ArrayBuffer(100); sim3.vorspulen(80)   (Uhr 2080, steht auf einer Sendung)
ck('falsche Größe verworfen (nativer Code läse sonst über das Ende)', n3.log.gesendet.at(-1)![0] === 7);
// a = Anzahl; sim3.stau(100); sim3.vorspulen(0)
ck('Stau 100 ms: beim Wiederanlauf genau 2 Sendungen (Nachholen)', anzahl() - a === 2);
// sim3.vorspulen(1900)
ck('Stau 100 ms: 2000 ms ab Stau-Beginn weiter genau 50 Sendungen', anzahl() - a === 50);
// b = Anzahl; sim3.stau(500); sim3.vorspulen(0)
ck('Stau 500 ms: kein Stoß, höchstens 2 Sendungen beim Wiederanlauf (ohne die 2-Takt-Regel wären es 12)', anzahl() - b <= 2);
// c = Anzahl; sim3.vorspulen(39) → nach39; sim3.vorspulen(1) → nach40
ck('Stau 500 ms: danach wieder im 40-ms-Takt ab dem Wiederanlauf', nach39 === c && nach40 === c + 1);
// stop; m = Anzahl; sim3.vorspulen(200)
ck('stop: destroy, danach nichts mehr', n3.log.destroy === 1 && anzahl() === m);
// p4 mit eigener Uhr, attrappenNdi({ dauerMs: 10, sim: sim4 }): init, fluss, Bild 1, vor, sim4.vorspulen(2000)
ck('langsames Senden (10 ms je Bild): genau 50 Sendungen in 2000 ms', zaehl4 === 50);
// die beiden reinen empfaengerZahl-Prüfungen unverändert
// p5 verbindungen 4, sim5: init, fluss, sim5.vorspulen(1000)
ck('4 Verbindungen → stat empfaenger 2', /* Bedingung wie bisher */);
// p6 OHNE viertes Argument (echte Uhr): init, await warte(300), dann stop
ck('Standard ist die echte Uhr: ohne Uhr-Argument mindestens 1 Sendung in 300 ms', n6.log.gesendet.length >= 1);
```

- [ ] **Step 2: Test laufen lassen, er muss scheitern**

Run: `cd "C:/Users/alexk/alexzvn/.claude/worktrees/auffrisch-runde/apps/presenter" && npx tsx test/ndi-sender-kern.test.ts`
Expected: Exit 1. FAIL mindestens bei „Standbild: genau 50 …“, „Stau 100 ms …“ und „langsames Senden …“, weil der Kern das vierte Argument noch ignoriert und mit der echten Uhr läuft.

- [ ] **Step 3: `KernUhr`, `echteUhr` und den Parameter `uhr` in `ndi-sender-kern.ts` einbauen**

`performance.now()` (Zeilen 62 und 82) wird `uhr.jetzt()`, `setTimeout(tick, …)` (Zeile 64) wird `uhr.planen(tick, …)`, `clearTimeout(timer)` (Zeile 44) wird `uhr.abbrechen(timer)`. `timer` wird `unknown`, `null` heißt „nichts geplant“. Die Rechnung in `tick` (Zeilen 60–64) bleibt Zeichen für Zeichen.

- [ ] **Step 4: Test und Typprüfung laufen lassen, beide grün**

Run: `cd "C:/Users/alexk/alexzvn/.claude/worktrees/auffrisch-runde" && npm run selftest -w @jm/presenter && npm run typecheck -w @jm/presenter`
Expected: Exit 0. Die Kern-Datei meldet `… ok, 0 FAIL`, die Laufzeit liegt unter 2 s statt bisher rund 7 s.

- [ ] **Step 5: Commit**

```bash
git add apps/presenter/src/utility/ndi-sender-kern.ts apps/presenter/test/ndi-sender-kern.test.ts && git status --short
git commit -m "test(presenter): NDI-Sender-Kern mit simulierter Uhr – genau 50 in 2 s, Nachholen und kein Stoß geprüft

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Prüfstand-Gruppe `ndi` misst wieder richtig

**Files:**
- Modify: `apps/presenter/test/pruefstand.mjs:1500-1503` (`domVollbild`), `:1682` (Aufruf in Fall 4), `:1689-1693` (Titel und Meldung des zweiten Falls 4), `:1820` und `:1834-1835` (Fall 13), `:1847-1849` (Fall 14)

**Interfaces:**
- Produces: `function domPublikumVollbild(): { gesperrt: boolean; titel: string } | null` sucht den Knopf mit genau dem Text „Publikum Vollbild“ und ersetzt `domVollbild`. Die Gruppe `vollbild` (`domKnopfGenau('Vollbild')`, Referenten-Vollbild) bleibt unberührt.

- [ ] **Step 1: Ursache am Code bestätigen (keine Änderung)**

Run: `grep -n "Publikum Vollbild\|Referentenansicht im Vollbild\|^            Vollbild" apps/presenter/src/renderer/src/views/PresenterView.tsx`
Expected: Zeile 123 „Publikum Vollbild“ (gesperrt bei `nurNdi`, Titel sonst leer) und Zeilen 128/130 „Vollbild“ (Titel „Referentenansicht im Vollbild (F11)“, nie gesperrt). `domVollbild` trifft den zweiten Knopf. Fall 4 erwartet „gesperrt“ und `NUR_NDI_TITEL`, Fall 13 einen leeren Titel. Beide messen also den falschen Knopf.

- [ ] **Step 2: `domVollbild` durch `domPublikumVollbild` ersetzen**

Beide Aufrufe umstellen. In den Falltiteln 4 („…, „Vollbild“ gesperrt mit …“) und 13 („(Publikumsfenster, „Vollbild“ bedienbar)“) wird „Vollbild“ zu „Publikum Vollbild“.

- [ ] **Step 3: Fall 14 stellt seine Voraussetzung selbst her**

Am Anfang des Falls, noch vor `erwarte(referent, …)`: `await auswerten(ed, 'window.jmpr.ndi.setzeAn(true)')`, dann `bisLage(ed, 'sendet', 10_000)` und `erwarte(s?.lage === 'sendet', \`Voraussetzung NDI an: Status ${JSON.stringify(s)}\`)`. Titel: „14 (Voraussetzung: NDI an bis „sendet“) Editor per window.close() …“. `setzeNdiAn(true)` startet nur, wenn noch nichts läuft (`apps/presenter/src/main/ndi/ausgang.ts:246`). Ist Fall 13 grün, ändert der Schritt also nichts. Ist er rot, steht `ndi-config.json` danach wieder auf `an`, und Fall 15 kippt nicht mit.

- [ ] **Step 4: Syntax prüfen**

Run: `node --check apps/presenter/test/pruefstand.mjs && grep -c "domVollbild(" apps/presenter/test/pruefstand.mjs`
Expected: kein Fehler; die Zählung meldet `0`.

- [ ] **Step 5: Commit**

```bash
git add apps/presenter/test/pruefstand.mjs && git status --short
git commit -m "test(presenter): Prüfstand ndi misst „Publikum Vollbild“, Fall 14 schaltet NDI selbst an

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6 (nur Controller, von Hand): Gruppe `ndi` am echten NDI**

Voraussetzungen: Windows mit interaktivem Desktop (Fall 14 misst Fenster über user32). NDI 6 SDK und Laufzeit sind installiert, `NDI_SDK_DIR=C:\Program Files\NDI\NDI 6 SDK` ist gesetzt (am 20.11. gemessen). Es läuft kein JM Presenter. `jm_ndi.node` liegt in `packages/ndi/build/Release` (gemessen). Der Prüfstand nimmt eigene Profile und entfernt `ELECTRON_RUN_AS_NODE` selbst (`pruefstand.mjs:135-142`).

```bash
cd "C:/Users/alexk/alexzvn/.claude/worktrees/auffrisch-runde/apps/presenter" && npm run dist:dir && node test/pruefstand.mjs --nur ndi
```
Expected: alle Fälle `ok`, auch der zweite Fall 4 sowie 13, 14 und die drei Fälle 15. Letzte Zeile `pruefstand: ‹n› ok, 0 FAIL, 0 übersprungen`, Exit 0. Auf dem Stand vor Task 2 zeigt derselbe Lauf FAIL bei 4 (Referentenansicht), 13, 14 und 15.

---

## Schritt 2 · Timer 0.14.1, Rundown 0.8.1 (reiner Neubau)

### Task 3: Versionen und Changelog Timer und Rundown

**Files:**
- Modify: `apps/timer/package.json:3`, `apps/rundown/package.json:3`
- Modify: `package-lock.json:709` (`"apps/timer"`), `:551` (`"apps/rundown"`)
- Modify: `packages/suite-manifest/changelog.json` (oberster Eintrag der Apps `timer` und `rundown`)
- Nicht anfassen: `packages/cookbook/cookbook.json`. Er nennt keine dieser Versionen als Ist-Stand (gemessen: nur „ab Titler 0.12.1“ im Titler-Kapitel, und das bleibt richtig).

**Interfaces:** keine.

- [ ] **Step 1: Versionsprüfung `timer=0.14.1 rundown=0.8.1`, sie muss scheitern**

Expected: zwei `FAIL`-Zeilen (`oberster Eintrag 0.14.0 …`), Exit 1.

- [ ] **Step 2: Versionen setzen**

In beiden `package.json` und in beiden Lock-Einträgen: `0.14.0` wird `0.14.1`, `0.8.0` wird `0.8.1`.

- [ ] **Step 3: Changelog-Einträge**

Timer: `{ "version": "0.14.1", "date": "JJJJ-MM-TT", "notes": ["Stabilität: Der Timer stürzt nicht mehr ab, wenn das Netzwerk kurz wegbricht oder die automatische Suche im Netz (mDNS, Port 5353) blockiert ist."] }`. Rundown genauso mit `0.8.1` und „Der Rundown stürzt …“.

- [ ] **Step 4: Versionsprüfung und Bündelprüfung, beide grün**

Versionsprüfung `timer=0.14.1 rundown=0.8.1`: zwei `ok`-Zeilen, Exit 0. Bündelprüfung für `timer` und `rundown`: je `1`. Dazu `npm run selftest -w @jm/timer && npm run selftest -w @jm/rundown`: Exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/timer/package.json apps/rundown/package.json package-lock.json packages/suite-manifest/changelog.json && git status --short
git commit -m "chore(release): Timer 0.14.1 und Rundown 0.8.1 – Neubau mit mDNS-Fix (Auffrisch-Runde Schritt 2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Schritt 3 · Battle 0.4.0, Prompter 0.7.0, Stage Display 0.6.0

### Task 4: Stage-Display-Nachricht in der Kopfzeile, erster Selbsttest, CI

**Files:**
- Create: `apps/stage-display/src/renderer/src/lib/nachricht.ts`
- Modify: `apps/stage-display/src/renderer/src/components/StageScreen.tsx:48-51` und `:117-125` (Countdown-Ansicht), `:187-222` (`PresenterHeader`)
- Create: `apps/stage-display/tsconfig.test.json`, Muster `apps/titler/tsconfig.test.json`: `extends ./tsconfig.web.json`, `composite: false`, `types: ["node"]`, include `test/**/*.ts`, `test/**/*.tsx`, `src/renderer/src/**/*.ts(x)` und `src/shared/**/*.ts`
- Create: `apps/stage-display/test/nachricht.test.tsx`
- Modify: `apps/stage-display/package.json` (Skripte, siehe Step 1)
- Modify: `.github/workflows/ci-checks.yml`, neuer Schritt direkt nach „Presenter (Suite-Status, On Air nur in der Präsentation)“ (Zeile 71–72)

**Interfaces:**
- Produces (`lib/nachricht.ts`):
  ```ts
  export interface BuehnenNachricht { text: string; blinkt: boolean }
  /** Ad-hoc-Nachricht (getrimmt) vor Timer-Nachricht (nur mit Anzeige-Element „Timer“); blinkt nur die Timer-Nachricht,
   *  wenn der Timer blinkt. Haken „Nachricht“ aus oder kein Text → null. Regeln von StageScreen.tsx:48-51 und :118. */
  export function buehnenNachricht(state: StageState): BuehnenNachricht | null;
  ```
- Produces (nicht exportiert, in `StageScreen.tsx`): `function NachrichtZeile({ nachricht, className, style }: { nachricht: BuehnenNachricht; className: string; style?: CSSProperties })`. Ein `<div>` mit dem Text als einzigem Kind. `jm-blink` und `color:#F61C56` kommen beim Blinken dazu, sonst `color:#FFE819`, dazu immer `font-extrabold`. Beide Ansichten nutzen es:
  - Countdown-Ansicht: wie heute `absolute inset-x-0 top-[76%] px-[5%] text-center`, Stil `fontSize: '4.5cqh', wordBreak: 'break-word'` (bricht um, kürzt nicht).
  - `PresenterHeader`: zwischen Uhr und rechter Gruppe, `min-w-0 flex-1 truncate px-[2cqw] text-center`, Stil `fontSize: '3.6cqh'`. Ohne Nachricht wird nichts gerendert. Nur die Nachricht kommt dazu, kein Programmpunkt als Ersatz („Sonst ändern sich diese Ansichten nicht“, Offene Frage 5).

- [ ] **Step 1: Test, Test-tsconfig und Skripte anlegen**

`package.json`: `"selftest": "tsx --tsconfig tsconfig.test.json test/nachricht.test.tsx"`, `"typecheck:test": "tsc --noEmit -p tsconfig.test.json"`, `"typecheck"` endet zusätzlich auf `&& npm run typecheck:test`.

Der Test importiert `abschluss, enthaelt, enthaeltNicht, gleich, ok, render` aus `@jm/ui/testhilfe`, `StageScreen` aus `@/components/StageScreen`, `buehnenNachricht` aus `@/lib/nachricht` und `DEFAULT_COLORS, type StageState` aus `@shared/types`. Die Hilfe `zustand({ ansicht?, message?, timerMessage?, blinking?, widgets?, countdownLaeuft? })` baut einen vollständigen `StageState`. Die Vorgabe ist `ansicht: 'countdown'`, alle Anzeige-Elemente sind an, `timer.connected = true`, `JETZT = Date.UTC(2026, 10, 20, 9, 0, 0)`. Dazu gibt es drei Ansichten. `countdown` heißt `presenter.active = false`. `ref` heißt `presenter.connected = presenter.active = true`, `config.presenter.mode = 'ref'`. `main` ist dasselbe mit `'main'`. „Laufender Countdown“ heißt `{ durationMs: 300_000, delayMs: 0, startedAtMs: JETZT, pausedRemainingMs: null }` und wird als „00:05:00“ angezeigt. `attrs(html, text)` liefert die Attribute des `<div>`, dessen einziges Kind `text` ist (`/<div([^>]*)>TEXT<\/div>/`, `text` regex-maskiert), sonst `''`. Gemessen am 20.11.: Dieses Server-Rendern von `StageScreen` läuft unter tsx, die Countdown-Ansicht enthält die Nachricht, `ref` nicht.

```tsx
gleich(buehnenNachricht(zustand({ message: '  Bitte zum Ende kommen  ' })), { text: 'Bitte zum Ende kommen', blinkt: false }, 'Ad-hoc-Nachricht getrimmt, blinkt nicht');
gleich(buehnenNachricht(zustand({ timerMessage: 'Noch 2 Minuten', blinking: true })), { text: 'Noch 2 Minuten', blinkt: true }, 'nur Timer-Nachricht: blinkt mit dem Timer');
gleich(buehnenNachricht(zustand({ message: 'Ad hoc', timerMessage: 'Timer', blinking: true })), { text: 'Ad hoc', blinkt: false }, 'Ad-hoc vor Timer, blinkt nicht');
gleich(buehnenNachricht(zustand({ timerMessage: 'Timer', widgets: { timer: false } })), null, 'Anzeige-Element Timer aus: Timer-Nachricht zählt nicht');
gleich(buehnenNachricht(zustand({ message: 'Ad hoc', widgets: { message: false } })), null, 'Haken Nachricht aus: keine Nachricht');
gleich(buehnenNachricht(zustand({ message: ' \n ' })), null, 'nur Leerraum: keine Nachricht');
for (const ansicht of ['countdown', 'ref', 'main'] as const) {
  const html = render(<StageScreen state={zustand({ ansicht, message: 'Bitte zum Ende kommen' })} now={JETZT} />);
  enthaelt(html, 'Bitte zum Ende kommen', `${ansicht}: Ad-hoc-Nachricht sichtbar`);
  ok(/color:#FFE819/.test(attrs(html, 'Bitte zum Ende kommen')) && !attrs(html, 'Bitte zum Ende kommen').includes('jm-blink'), `${ansicht}: gelb, blinkt nicht`);
  const blink = render(<StageScreen state={zustand({ ansicht, timerMessage: 'Noch 2 Minuten', blinking: true })} now={JETZT} />);
  ok(attrs(blink, 'Noch 2 Minuten').includes('jm-blink') && attrs(blink, 'Noch 2 Minuten').includes('color:#F61C56'), `${ansicht}: blinkende Timer-Nachricht rot und blinkend`);
  const beide = render(<StageScreen state={zustand({ ansicht, message: 'Ad hoc', timerMessage: 'Timer', blinking: true })} now={JETZT} />);
  ok(!attrs(beide, 'Ad hoc').includes('jm-blink') && !beide.includes('>Timer<'), `${ansicht}: Ad-hoc gewinnt und blinkt nicht`);
  enthaeltNicht(render(<StageScreen state={zustand({ ansicht, message: 'Bitte zum Ende kommen', widgets: { message: false } })} now={JETZT} />), 'Bitte zum Ende kommen', `${ansicht}: Haken Nachricht aus blendet aus`);
  ok(render(<StageScreen state={zustand({ ansicht, message: ' \n ' })} now={JETZT} />) === render(<StageScreen state={zustand({ ansicht, message: '' })} now={JETZT} />), `${ansicht}: Leerraum rendert wie keine Nachricht`);
}
for (const ansicht of ['ref', 'main'] as const) {
  const lang = 'Bitte sofort zum Ende kommen, '.repeat(10).trim();
  const html = render(<StageScreen state={zustand({ ansicht, message: lang, countdownLaeuft: true })} now={JETZT} />);
  ok(/\btruncate\b/.test(attrs(html, lang)) && /\bmin-w-0\b/.test(attrs(html, lang)), `${ansicht}: Kopfzeile kürzt mit „…“ (truncate, min-w-0)`);
  enthaelt(html, '00:05:00', `${ansicht}: lange Nachricht verdrängt den Countdown nicht`);
}
const cd = render(<StageScreen state={zustand({ ansicht: 'countdown', message: 'Bitte zum Ende kommen' })} now={JETZT} />);
ok(!/\btruncate\b/.test(attrs(cd, 'Bitte zum Ende kommen')) && attrs(cd, 'Bitte zum Ende kommen').includes('word-break:break-word'), 'countdown: bricht um wie bisher, kürzt nicht');
abschluss();
```

- [ ] **Step 2: Test laufen lassen, er muss scheitern**

Run: `cd "C:/Users/alexk/alexzvn/.claude/worktrees/auffrisch-runde" && npm run selftest -w @jm/stage-display`
Expected: Exit ≠ 0, „Cannot find module '@/lib/nachricht'“ (oder ähnlich).

- [ ] **Step 3: `buehnenNachricht` und `NachrichtZeile` bauen, Countdown-Ansicht und `PresenterHeader` darauf umstellen**

- [ ] **Step 4: Test und Typprüfung, beide grün**

Run: `npm run selftest -w @jm/stage-display && npm run typecheck -w @jm/stage-display`
Expected: `ALLE TESTS OK`, Exit 0.

- [ ] **Step 5: CI-Schritt**

In `ci-checks.yml` nach dem Presenter-Schritt einfügen:
```yaml
      - name: Stage Display (Nachricht in allen drei Ansichten)
        run: npm run selftest -w @jm/stage-display
```
Run: `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/ci-checks.yml','utf8')); console.log('yaml ok')" && grep -n "Stage Display (Nachricht" .github/workflows/ci-checks.yml`
Expected: `yaml ok` und eine Fundstelle. `js-yaml` 4.2.0 liegt im Root-`node_modules`, gemessen. Dieselbe YAML-Prüfung gilt nach jeder Änderung an `ci-checks.yml` in Task 6 und 7.

- [ ] **Step 6: Commit**

```bash
git add apps/stage-display/src/renderer/src/lib/nachricht.ts apps/stage-display/src/renderer/src/components/StageScreen.tsx apps/stage-display/tsconfig.test.json apps/stage-display/test/nachricht.test.tsx apps/stage-display/package.json .github/workflows/ci-checks.yml && git status --short
git commit -m "feat(stage-display): Nachricht auch in der Kopfzeile der Presenter-Ansichten, erster Selbsttest in CI

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Versionen und Changelog Battle, Prompter, Stage Display

**Files:**
- Modify: `apps/battle/package.json:3`, `apps/prompter/package.json:3`, `apps/stage-display/package.json:3`
- Modify: `package-lock.json:48` (`"apps/battle"`), `:457` (`"apps/prompter"`), `:582` (`"apps/stage-display"`)
- Modify: `packages/suite-manifest/changelog.json`

**Interfaces:** Consumes Task 4 (die Nachricht ist gebaut, die Changelog-Zeile beschreibt sie).

- [ ] **Step 1: Versionsprüfung `battle=0.4.0 prompter=0.7.0 stage-display=0.6.0`, sie muss scheitern** (drei `FAIL`, Exit 1)

- [ ] **Step 2: Versionen setzen** (`0.3.0` → `0.4.0`, `0.6.0` → `0.7.0`, `0.5.0` → `0.6.0`, jeweils package.json und Lock)

- [ ] **Step 3: Changelog-Einträge (Vorschlag, der Owner gibt frei)**

Die drei Tools nehmen seit dem 05.07. den Master-Link-Client mit, der standardmäßig an ist (Spec B2). Die Verbund-Zeile folgt dem Wortlaut von Timer 0.12.0.
- Battle 0.4.0: „Stabilität: Battle stürzt nicht mehr ab, …“ und „Verbund: Battle verbindet sich von selbst mit dem Master, sobald dieser Rechner im Verbund gekoppelt ist, auch ohne laufenden Launcher; der Master zeigt Battle dann bei diesem Rechner. Ohne Kopplung ändert sich nichts.“
- Prompter 0.7.0: dieselben zwei Zeilen mit „Der Prompter …“.
- Stage Display 0.6.0: zuerst „Die Nachricht an die Bühne erscheint jetzt auch, wenn das Stage Display die Folien aus dem Presenter zeigt (Referenten- und Hauptansicht), mittig in der Kopfzeile. Bisher fehlte sie dort. Zu lange Nachrichten werden mit „…“ gekürzt.“, danach Stabilität und Verbund mit „Das Stage Display …“.
- Der STATE-Text mit %XX-Kodierung (Spec B2) braucht keine Zeile. Battle und Prompter senden nur Zahlen und Kennbuchstaben (`apps/battle/src/main/index.ts:136-152`, `apps/prompter/src/main/control-server.ts:8`), und das Stage Display hat keinen Steuerserver.

- [ ] **Step 4: Versionsprüfung und Bündelprüfung, beide grün**

Versionsprüfung: drei `ok`. Bündelprüfung für `battle`, `prompter` und `stage-display`: je `1`. Dazu `npm run selftest -w @jm/battle && npm run selftest -w @jm/stage-display && npm run typecheck -w @jm/prompter`: Exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/battle/package.json apps/prompter/package.json apps/stage-display/package.json package-lock.json packages/suite-manifest/changelog.json && git status --short
git commit -m "chore(release): Battle 0.4.0, Prompter 0.7.0, Stage Display 0.6.0 (Auffrisch-Runde Schritt 3)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Schritt 4 · NDI-Lizenztext in Titler, Caption, Switcher, NDI Screen Capture

### Task 6: Lizenztext in Titler und Caption (Windows und Mac), Probe im Temp-Baum

**Files:**
- Create: `scripts/ndi-buendel-probe.mjs` (Testhilfe für Task 6 und 7)
- Modify: `apps/titler/tools/bundle-ndi.mjs` (Mac-Zweig `:22-64`, Windows-Zweig `:77-98`)
- Modify: `apps/caption/tools/bundle-ndi.mjs` (gleiche Zeilen, die Datei ist heute gleich)
- Create: `apps/titler/test/bundle-ndi.test.mjs`, `apps/caption/test/bundle-ndi.test.mjs`
- Modify: `apps/titler/package.json` (`selftest` endet zusätzlich auf `&& node test/bundle-ndi.test.mjs`), `apps/caption/package.json` (ebenso)
- Modify: `.github/workflows/ci-checks.yml`: Caption hat heute keinen CI-Schritt (gemessen), neu nach dem Stage-Display-Schritt: `Caption (Audio-Helfer, NDI-Lizenztext im Bündel)` → `npm run selftest -w @jm/caption`. Titler läuft schon in CI.

**Interfaces:**
- Produces (`scripts/ndi-buendel-probe.mjs`):
  ```js
  /**
   * Führt eine KOPIE von apps/<app>/tools/bundle-ndi.mjs in einem Temp-Baum aus, das echte resources/ der App bleibt
   * unberührt: <tmp>/apps/<app>/tools/bundle-ndi.mjs, <tmp>/packages/ndi/build/Release/jm_ndi.node (Attrappe),
   * <tmp>/sdk/Bin/x64/Processing.NDI.Lib.x64.dll (Attrappe) und je nach `lizenz` Processing.NDI.Lib.Licenses.txt mit Text,
   * mit 0 Byte oder gar nicht. Lauf mit NDI_SDK_DIR=<tmp>/sdk; der Temp-Baum wird danach gelöscht.
   * @param {string} app  Ordner unter apps/
   * @param {'fehlt'|'leer'|'da'} lizenz
   * @returns {{ status: number|null, ausgabe: string, kopiert: string[]|null }}
   *   ausgabe = stdout + stderr; kopiert = sortierte Dateinamen in <tmp>/apps/<app>/resources/bin/win, null ohne Ordner
   */
  export function probeNdiBuendel(app, lizenz)
  ```
- Produces (Titler und Caption, `bundle-ndi.mjs`):
  - Windows: `sources` bekommt `{ name: 'Processing.NDI.Lib.Licenses.txt', src: join(sdk, 'Bin', 'x64', 'Processing.NDI.Lib.Licenses.txt') }`. Erst werden alle Quellen geprüft (fehlt, keine Datei oder 0 Byte → `throw new Error('[bundle-ndi] Quelle fehlt oder ist leer: …')`, Namen und Pfade wie beim Presenter), dann erst `mkdirSync` und Kopie.
  - Mac: `const { lizenzDateien, lizenzAuswahl } = await import('../../connect/tools/bundle-ndi.mjs');`, dynamisch und nur im darwin-Zweig, damit die Probe im Temp-Baum ohne Connect-Dateien läuft. Der Import hat keine Nebenwirkung (gemessen: nur Exporte, Hauptprogramm nur über `istHauptprogramm`). Die Dateiliste kommt aus `readdirSync(sdk, { recursive: true })`, die Pfade relativ mit `/`. Die Auswahl macht `lizenzAuswahl(lizenzen, (rel) => sha256(join(sdk, rel)))`. Ohne Fund `throw new Error(\`[bundle-ndi] keine Lizenzdatei der NDI-Laufzeit (.txt mit „licen“ im Pfad) unter ${sdk}\`)`, und zwar vor jeder Kopie. Die gewählten Dateien kommen flach nach `resources/bin/mac`. Das Apple-SDK legt `libndi_licenses.txt` dreimal gleich ab, `lizenzAuswahl` legt sie einmal bei (Connect-Befund 593448479b).

- [ ] **Step 1: Probe-Hilfe und beide Tests schreiben**

`apps/titler/test/bundle-ndi.test.mjs` (Caption gleich, mit `'caption'`) importiert `probeNdiBuendel` aus `../../../scripts/ndi-buendel-probe.mjs`. `lies(rel)` liest relativ zur Testdatei (CRLF → LF). Der Ausgabestil ist der von `apps/presenter/test/release-weg.test.ts` (`  ok  ` / `FAIL  `, Summe, Exit 1 bei FAIL):
```js
const bundle = lies('../tools/bundle-ndi.mjs');
ck('Windows: Lizenztext steht in den Quellen neben der DLL', bundle.includes("name: 'Processing.NDI.Lib.Licenses.txt'") && bundle.includes("join(sdk, 'Bin', 'x64', 'Processing.NDI.Lib.Licenses.txt')"));
ck('Mac: Lizenzdateien wie Connect, ohne Fund Abbruch', bundle.includes("import('../../connect/tools/bundle-ndi.mjs')") && bundle.includes('lizenzDateien(') && bundle.includes('lizenzAuswahl(') && bundle.includes('keine Lizenzdatei der NDI-Laufzeit'));
if (process.platform === 'win32') {
  const fehlt = probeNdiBuendel('titler', 'fehlt');
  ck('ohne Lizenztext: Abbruch mit Hinweis, nichts kopiert', fehlt.status !== 0 && fehlt.ausgabe.includes('Processing.NDI.Lib.Licenses.txt') && fehlt.kopiert === null);
  const leer = probeNdiBuendel('titler', 'leer');
  ck('leerer Lizenztext (0 Byte): Abbruch wie ohne, nichts kopiert', leer.status !== 0 && leer.ausgabe.includes('Processing.NDI.Lib.Licenses.txt') && leer.kopiert === null);
  const da = probeNdiBuendel('titler', 'da');
  ck('mit Lizenztext: Addon, DLL und Lizenztext in resources/bin/win', da.status === 0 && JSON.stringify(da.kopiert) === JSON.stringify(['Processing.NDI.Lib.Licenses.txt', 'Processing.NDI.Lib.x64.dll', 'jm_ndi.node']));
} else if (process.platform === 'linux') {
  const l = probeNdiBuendel('titler', 'fehlt');
  ck('Linux: übersprungen wie bisher, nichts kopiert', l.status === 0 && l.ausgabe.includes('übersprungen') && l.kopiert === null);
} else console.log('skip  Mac-Zweig: nur im Mac-Bau prüfbar (otool, install_name_tool)');
```

- [ ] **Step 2: Tests laufen lassen, sie müssen scheitern**

Run: `cd "C:/Users/alexk/alexzvn/.claude/worktrees/auffrisch-runde" && node apps/titler/test/bundle-ndi.test.mjs; node apps/caption/test/bundle-ndi.test.mjs`
Expected: je Exit 1. FAIL bei beiden Quelltext-Prüfungen sowie bei „ohne Lizenztext“ und „leerer Lizenztext“ (heute Exit 0 mit Kopie) und bei „mit Lizenztext“ (nur zwei Dateien). Das echte `apps/*/resources/bin` bleibt dabei unberührt.

- [ ] **Step 3: Windows- und Mac-Zweig in beiden `bundle-ndi.mjs` umbauen** (laut Interfaces; der Kopfkommentar nennt den Lizenztext und Vorbild Presenter/Connect)

- [ ] **Step 4: Tests und Selbsttests grün**

Run: `node apps/titler/test/bundle-ndi.test.mjs && node apps/caption/test/bundle-ndi.test.mjs && npm run selftest -w @jm/titler && npm run selftest -w @jm/caption`
Expected: Exit 0, keine `FAIL`-Zeile. Danach `git status --short`: keine Datei unter `resources/` geändert.

- [ ] **Step 5: CI-Schritt für Caption** (siehe Files). Prüfen mit `grep -n "Caption (Audio-Helfer" .github/workflows/ci-checks.yml`: eine Fundstelle.

- [ ] **Step 6: Commit**

```bash
git add scripts/ndi-buendel-probe.mjs apps/titler/tools/bundle-ndi.mjs apps/caption/tools/bundle-ndi.mjs apps/titler/test/bundle-ndi.test.mjs apps/caption/test/bundle-ndi.test.mjs apps/titler/package.json apps/caption/package.json .github/workflows/ci-checks.yml && git status --short
git commit -m "fix(titler,caption): Lizenztext der NDI-Laufzeit ins Paket, Bau bricht ohne ihn ab

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: Lizenztext in Switcher und NDI Screen Capture (nur Windows), Selbsttest für NDI Screen Capture

**Files:**
- Modify: `apps/switcher/tools/bundle-ndi.mjs:29-47`, `apps/ndi-screen-capture/tools/bundle-ndi.mjs:29-47` (heute gleich)
- Create: `apps/switcher/test/bundle-ndi.test.mjs`, `apps/ndi-screen-capture/test/bundle-ndi.test.mjs`
- Modify: `apps/switcher/package.json` (`selftest` endet zusätzlich auf `&& node test/bundle-ndi.test.mjs`), `apps/ndi-screen-capture/package.json` (neu `"selftest": "node test/bundle-ndi.test.mjs"`)
- Create: `apps/ndi-screen-capture/.gitignore` mit der Zeile `resources/bin`. Die App hat heute keine eigene. `resources/bin/win/Processing.NDI.Lib.x64.dll` und `jm_ndi.node` sind seit 231ffc0d7c im Repo (gemessen), ein lokaler Bau legte den Lizenztext sonst als neue, unignorierte Datei daneben. Die beiden verfolgten Dateien bleiben verfolgt (Offene Frage 2).
- Modify: `.github/workflows/ci-checks.yml`: `Switcher (Ausgabe-Qualität, NDI-Lizenztext im Bündel)` → `npm run selftest -w @jm/switcher` und `NDI Screen Capture (NDI-Lizenztext im Bündel)` → `npm run selftest -w @jm/ndi-screen-capture`, beide nach dem Caption-Schritt

**Interfaces:**
- Consumes: `probeNdiBuendel(app, lizenz)` aus Task 6.
- Produces: Windows-Zweig wie in Task 6, kein Mac-Zweig (heute „Nicht-Windows — übersprungen“, bleibt so).

- [ ] **Step 1: Beide Tests schreiben.** Wie in Task 6 ohne die Mac-Quelltextprüfung, mit `'switcher'` bzw. `'ndi-screen-capture'`. Die Linux-Erwartung (`übersprungen`, Exit 0) gilt auch hier.

- [ ] **Step 2: Tests laufen lassen, sie müssen scheitern**

Run: `node apps/switcher/test/bundle-ndi.test.mjs; node apps/ndi-screen-capture/test/bundle-ndi.test.mjs`
Expected: je Exit 1. FAIL bei der Quelltext-Prüfung, „ohne Lizenztext“, „leerer Lizenztext“ und „mit Lizenztext“.

- [ ] **Step 3: Windows-Zweig beider Skripte umbauen** (Prüfen vor `mkdirSync`, leere Datei zählt als fehlend)

- [ ] **Step 4: Tests und Selbsttests grün**

Run: `node apps/switcher/test/bundle-ndi.test.mjs && node apps/ndi-screen-capture/test/bundle-ndi.test.mjs && npm run selftest -w @jm/switcher && npm run selftest -w @jm/ndi-screen-capture`
Expected: Exit 0. `git status --short` zeigt nichts unter `apps/ndi-screen-capture/resources/`, vor allem keine geänderte DLL.

- [ ] **Step 5: CI-Schritte** (siehe Files). Prüfen mit `grep -c "NDI-Lizenztext im Bündel" .github/workflows/ci-checks.yml`: `3`.

- [ ] **Step 6: Commit**

```bash
git add apps/switcher/tools/bundle-ndi.mjs apps/ndi-screen-capture/tools/bundle-ndi.mjs apps/switcher/test/bundle-ndi.test.mjs apps/ndi-screen-capture/test/bundle-ndi.test.mjs apps/switcher/package.json apps/ndi-screen-capture/package.json apps/ndi-screen-capture/.gitignore .github/workflows/ci-checks.yml && git status --short
git commit -m "fix(switcher,ndi-screen-capture): Lizenztext der NDI-Laufzeit ins Paket, Selbsttests in CI

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: Versionen und Changelog Titler, Caption, Switcher, NDI Screen Capture

**Files:**
- Modify: `apps/titler/package.json:3`, `apps/caption/package.json:3`, `apps/switcher/package.json:3`, `apps/ndi-screen-capture/package.json:3`
- Modify: `package-lock.json:741` (`"apps/titler"`), `:81` (`"apps/caption"`), `:652` (`"apps/switcher"`), `:360` (`"apps/ndi-screen-capture"`)
- Modify: `packages/suite-manifest/changelog.json`

**Interfaces:** Consumes Task 6 und 7.

- [ ] **Step 1: Versionsprüfung `titler=0.12.2 caption=0.4.1 switcher=0.10.1 ndi-screen-capture=0.3.2`, sie muss scheitern** (vier `FAIL`)

- [ ] **Step 2: Versionen setzen** (package.json und Lock)

- [ ] **Step 3: Changelog-Einträge (Vorschlag, der Owner gibt frei)**

Die erste Zeile ist bei allen vier gleich: „Lizenz: Der Lizenztext der NDI-Laufzeit liegt jetzt im Paket.“ Dazu, gemessen am 20.11.:
- Titler 0.12.2: die Stabilitätszeile („Der Titler …“). Titler, Caption und Switcher annoncieren über `SuiteControlServer` → `@jm/discovery`, ihre letzten Tags liegen vor 364d4af5f8.
- Caption 0.4.1: Stabilität („Caption …“) und Verbund („Caption verbindet sich …“, Wortlaut wie Task 5). Caption 0.4.0, Switcher 0.10.0 und NDI Screen Capture 0.3.1 liegen vor dem Master-Link-Client 65adc88aad.
- Switcher 0.10.1: Stabilität („Der Switcher …“) und Verbund („Der Switcher …“).
- NDI Screen Capture 0.3.2: nur die Verbund-Zeile („NDI Screen Capture …“). Ohne `@jm/discovery` gibt es keine Stabilitätszeile.

- [ ] **Step 4: Versionsprüfung und Bündelprüfung, beide grün**

Versionsprüfung: vier `ok`. Bündelprüfung für `titler`, `caption` und `switcher`: je `1`. Für NDI Screen Capture: `npm run build -w @jm/ndi-screen-capture && grep -c "Master-Link nicht gestartet" apps/ndi-screen-capture/out/main/index.cjs` meldet `1` (der Master-Link-Client ist im Bündel).

- [ ] **Step 5: Commit**

```bash
git add apps/titler/package.json apps/caption/package.json apps/switcher/package.json apps/ndi-screen-capture/package.json package-lock.json packages/suite-manifest/changelog.json && git status --short
git commit -m "chore(release): Titler 0.12.2, Caption 0.4.1, Switcher 0.10.1, NDI Screen Capture 0.3.2 – NDI-Lizenztext (Schritt 4)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Controller: Rauchtests und Release (kein Task des Umsetzers)

**Zweig-Schnitt.** Die Tasks laufen linear auf `feat/auffrisch-runde`. Je Schritt ein Zweig auf den letzten Commit des Schritts: `auffrisch/1-tests` (Task 2), `auffrisch/2-neubau` (Task 3), `auffrisch/3-stage` (Task 5) und `auffrisch/4-ndi-lizenz` (Task 8). Die PRs nacheinander öffnen, den nächsten erst nach dem Merge des vorigen. Das Repo merged mit Merge-Commits, darum zeigt der Folge-PR dann nur seine eigenen Commits.

**Vor jedem Merge:** das Datum `JJJJ-MM-TT` der Schritt-Einträge auf den Release-Tag setzen, dann die Versionsprüfung mit `STRENG=1`. Danach ist das JSON gültig, das Datum echt, und es gibt keine ASCII-`"`.

**Electron im Worktree (gemessen 20.11.).** Es ist nicht startbar: `node_modules/electron/dist` enthält nur `LICENSES.chromium.html`, `electron.exe` und `path.txt` fehlen, die Postinstall lief nicht. Der Cache hat `%LOCALAPPDATA%\electron\Cache\electron-v33.4.11-win32-x64.zip`. Vor den Rauchtests von Schritt 3: `cd "C:/Users/alexk/alexzvn/.claude/worktrees/auffrisch-runde" && node node_modules/electron/install.js`, das ändert nur `node_modules` des Worktrees. Danach müssen `node_modules/electron/dist/electron.exe` und `node_modules/electron/path.txt` da sein. In dieser Shell steht `ELECTRON_RUN_AS_NODE=1` (gemessen), darum vor jedem Start `unset ELECTRON_RUN_AS_NODE`. Installierte Instanzen der geprüften Tools sind geschlossen, wegen Ports und Single-Instance-Lock.

**Rauchtest-Rezept (eigenes Profil, echtes Profil bleibt unberührt):**
```bash
cd "C:/Users/alexk/alexzvn/.claude/worktrees/auffrisch-runde" && unset ELECTRON_RUN_AS_NODE
P="$(mktemp -d)"; W="$(cygpath -w "$P")"; mkdir -p "$P/AppData/Roaming" "$P/AppData/Local"
# Schritt 3: gebauter Stand (npm run build -w @jm/<tool>) über das Workspace-Electron:
USERPROFILE="$W" APPDATA="$W\\AppData\\Roaming" LOCALAPPDATA="$W\\AppData\\Local" \
  node_modules/electron/dist/electron.exe apps/<tool> --user-data-dir="$W\\userData" > "$P/konsole.txt" 2>&1 &
# Schritt 4: statt electron.exe apps/<tool> die gebaute "apps/<tool>/release/win-unpacked/JM ‹Name›.exe"
```
- R1 Start: Das Fenster kommt, `$P/userData/logs/main.log` entsteht. Das beweist das eigene Profil. `find "$(cygpath -u "$APPDATA")/@jm/<tool>" -newer "$P"` liefert nichts.
- R2 Log: keine `[ERROR]`-Zeile, kein `uncaughtException`/`unhandledRejection`, keine `last-crash.json` in `$P/userData/logs`.
- R3 Suche im Netz: `node scripts/mdns-scan.mjs 10` zeigt `jm-battle` (ctl, 8734), `jm-prompter` (ctl, 8727), in Schritt 4 `jm-titler` (ctl, 8726), `jm-caption` (ctl, 8732) und `jm-switcher`. Das Stage Display annonciert nichts. Prüfung: Timer (Stand Task 3) in einem zweiten eigenen Profil starten, die Bedienansicht des Stage Display zeigt bei Timer „verbunden“.
- R4 Master-Link, Stufe A (immer): Das eigene Profil hat keine Kopplung, der Client bleibt untätig. Im Log steht kein „Master-Link nicht gestartet“. Stufe B nur mit Owner-OK: `%APPDATA%\JM Production Suite\master-link.json` (vorhanden, gemessen) nach `$P/AppData/Roaming/JM Production Suite/` kopieren und neu starten. Im Log stehen dann `Master-Link: …`-Zeilen, und am Master erscheint das Tool bei diesem Rechner. Danach `rm -rf "$P"`.
- R5 nur Stage Display, kurzer Blick des Owners: Presenter mit laufender Präsentation, im Stage Display die Quelle Presenter an, eine Nachricht eintippen. In REF und MAIN steht sie mittig in der Kopfzeile.

**Release-Reihenfolge je Schritt:** PR → CI grün → Owner-OK (Changelog-Wortlaut eingeschlossen) → Merge (main liegt dann vor den Tags) → Tags einzeln auf den Merge-Commit pushen. Mehr als 3 Tags in einem Push lösen keine Workflows aus. → Prüfung am Proxy `https://jm-suite-proxy.jm-production-suite.workers.dev/tools/<app>/latest`: Ohne Zugang ist 401 „nicht angemeldet“ für Nicht-Launcher-Tools richtig, mit Zugang prüft nur der Owner.

- **Schritt 1 (kein Release):** Controller-Schritt aus Task 2 vor dem PR, dann PR → CI (Presenter-Selbsttest jetzt ohne echte Uhr) → Owner-OK → Merge. Keine Tags.
- **Schritt 2 (CI-Release, mac + win):** `git push origin timer-v0.14.1` und warten, bis `suite-release.yml` mit `plan`, beiden `release`-Jobs und `bump-manifest` grün ist. Dann dasselbe mit `rundown-v0.8.1`. Danach `gh release view <tag> --json assets` (2 DMG + 1 exe, Namen mit Punkten) und die Proxy-Prüfung.
- **Schritt 3 (CI-Release):** Rauchtest R1–R5 für Battle, Prompter und Stage Display vor dem PR. Dann wie Schritt 2 mit `battle-v0.4.0`, `prompter-v0.7.0` und `stage-display-v0.6.0`, je einzeln.
- **Schritt 4 (lokal, Windows):** `suite-release.yml` schließt `titler-v`, `caption-v`, `switcher-v` und `ndi-screen-capture-v` aus (Zeile 56). Ein Tag-Push lässt dort nur `plan` laufen, `release` und `bump-manifest` werden übersprungen. Je App, nacheinander:
  1. Worktree auf den Merge-Commit: `git switch --detach <merge-sha>`. Nach allen vier Apps `git switch feat/auffrisch-runde`.
  2. Bauen: `CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist:win -w @jm/<app> -- --publish never` mit `NDI_SDK_DIR` (gesetzt). Caption braucht zusätzlich `WHISPER_DIR` und `WHISPER_MODEL_BASE`. Beide sind in dieser Shell nicht gesetzt (gemessen), der Owner nennt die Pfade (`docs/release-caption.md`).
  3. Lizenztext im Paket: `apps/<app>/release/win-unpacked/resources/bin/win/Processing.NDI.Lib.Licenses.txt` ist da, und `sha256sum` gleicht `"$NDI_SDK_DIR/Bin/x64/Processing.NDI.Lib.Licenses.txt"`.
  4. Rauchtest R1–R4 mit der win-unpacked-Exe. Bei Caption, Switcher und NDI Screen Capture ist der Master-Link-Client neu.
  5. `git push origin <app>-v<version>` einzeln, dann `gh release create <app>-v<version> "apps/<app>/release/JM ‹Name›-<version>-win-x64.exe" --title "JM ‹Name› <version>" --prerelease --notes "‹Changelog-Zeilen›"`.
  6. Auf main: `node scripts/bump-manifest.mjs <app> <version>`, Commit `chore(manifest): <app> latestVersion → <version> [skip ci]`, Push nach Owner-OK, Proxy-Prüfung.
  7. Mac-DMGs für Titler und Caption nur, wenn der Owner es will (Offene Frage 3): lokal auf dem Mac nach `docs/mac-build-windows-only-apps.md`. Dann liegt `libndi_licenses.txt` in `Contents/Resources/bin/mac`.
  8. Nichts unter `apps/ndi-screen-capture/resources/bin` committen: Der Bau überschreibt die dort verfolgten Dateien. Danach `git checkout -- apps/ndi-screen-capture/resources/bin`.

## Abweichungen vom Spec-Befund (gemessen am 20.11.)

- B1 gilt weiter, betrifft aber mehr Tools als fünf. Titler 0.12.1, Caption 0.4.0 und Switcher 0.10.0 annoncieren über `SuiteControlServer` → `@jm/discovery` (`apps/titler/src/main/control-server.ts:21`, Caption und Switcher ebenso). Keiner ihrer Tags enthält 364d4af5f8 oder 7089e1c389 (`git merge-base --is-ancestor`). Der Neubau in Schritt 4 bringt den Fix mit, dafür die Stabilitätszeile in Task 8.
- Schritt 4 ist für Caption, Switcher und NDI Screen Capture kein reiner Lizenz-Patch. Ihre Tags liegen vor dem Master-Link-Client 65adc88aad, dazu kommen 73–84 Commits in den direkten `@jm`-Paketen. Der Titler bringt nur 20 mit, und er hat schon Master-Link. `packages/ndi` ist seit allen vier Tags unverändert. Darum gibt es in Schritt 4 einen Rauchtest und Verbund-Zeilen.
- NDI Screen Capture: `apps/ndi-screen-capture/resources/bin/win/Processing.NDI.Lib.x64.dll` (29,8 MB) und `jm_ndi.node` sind seit 231ffc0d7c im Repo, demselben Commit, der den PortAudio-Gitlink versehentlich brachte. Es gibt keine App-`.gitignore`.
- Die letzten Releases von Titler, Caption, Switcher und NDI Screen Capture tragen nur die Windows-exe (`gh release view`). Der Mac-Zweig von Titler und Caption wird derzeit nicht ausgeliefert.
- Kern: Nach einem langen Stau sendet er zwei Bilder im selben Moment (`ndi-sender-kern.ts:63-64`, `soll = jetzt` → Verzögerung 0). Das ist harmlos, kein Stoß. Der Test pinnt „höchstens 2“.
- Caption und Switcher haben Selbsttests, die bisher nicht in `ci-checks.yml` laufen. Task 6 und 7 nehmen sie auf.
- Die Paketsprünge nach direkten Abhängigkeiten: Timer und Rundown je 31 Commits, Battle, Prompter und Stage Display 94–95. Die Spec nennt 33 und „rund 130“, vermutlich mit den transitiven, also dieselbe Größenordnung.

## Offene Fragen an den Owner

1. Caption, Switcher und NDI Screen Capture nehmen Master-Link und 73–84 Paket-Commits mit. Bleibt es beim Patch (0.4.1, 0.10.1, 0.3.2) oder wird es ein Minor wie in Schritt 3 (0.5.0, 0.11.0, 0.4.0)? Der Plan setzt Patch. Der Controller ändert Task 8 vor der Ausführung, falls nötig.
2. Sollen `Processing.NDI.Lib.x64.dll` und `jm_ndi.node` von NDI Screen Capture aus dem öffentlichen Repo (`git rm --cached`; der Verlauf bleibt davon unberührt)? Task 7 verhindert nur, dass der Lizenztext dazukommt.
3. Sollen diesmal auch Mac-DMGs für Titler und Caption gebaut werden? Die letzten Releases sind nur Windows, `suite.json` führt `mac`.
4. Den Wortlaut aller Changelog-Zeilen (Task 3, 5, 8) gibt der Owner frei. Sollen die 14 Tage Log-Aufbewahrung (b5b52d6e76) erwähnt werden? Bisher steht das in keinem Changelog.
5. Stage Display: In der Kopfzeile steht nur die Nachricht, ohne Programmpunkt als Ersatz. Gelesen aus „Sonst ändern sich diese Ansichten nicht“ (Spec stage-display-ndi, Z. 90).
6. Rauchtest-Stufe B mit echter Kopplung (Kopie von `master-link.json` ins Temp-Profil, das Tool meldet sich am echten Master an): erlaubt?
