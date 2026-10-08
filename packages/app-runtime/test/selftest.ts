// Selbsttest der CSP-Konstruktion — ohne Electron, ohne Fenster:
//   node --experimental-strip-types packages/app-runtime/test/selftest.ts
//
// Warum es diesen Test gibt: die strenge Fassung erlaubt `connect-src 'self'`, der Dev-Modus
// dagegen ws:/wss:/http:/https:. Eine App, deren Renderer selbst mit dem Netz spricht, läuft
// darum in `npm run dev` tadellos und stirbt stumm im gepackten Build. Genau das ist JM Connect
// beim ersten Installer passiert (Raum-WebSocket geblockt). Der Unterschied wird hier festgenagelt.
//
// Dazu die Löschfrist der Logs (Plan Zoom 4b, Aufgabe 17; Spec N4b.2): log-aufraeumen.ts ist wie csp.ts
// frei von Electron und läuft hier gegen Temp-Ordner mit eingespeister Uhr.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCsp } from '../src/csp.ts';
import {
  berichtZeilen,
  KUERZEN_MAX_BYTES,
  LOG_AUFRAEUMEN_TAKT_MS,
  LOG_AUFRAEUMEN_VERZOEGERUNG_MS,
  LOG_DATEIMUSTER,
  LOG_FRIST_MS,
  planeLogAufraeumen,
  raeumeLogsAuf,
  type AufraeumBericht,
} from '../src/log-aufraeumen.ts';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}`);
  }
}

/** Die Quellen einer Direktive aus dem fertigen Header-Wert herausziehen. */
function directive(csp: string, name: string): string[] {
  const part = csp.split('; ').find((d) => d.startsWith(`${name} `));
  return part ? part.slice(name.length + 1).split(' ') : [];
}

// ── Die Falle selbst ──────────────────────────────────────────────────────────
{
  const dev = buildCsp({}, true);
  const prod = buildCsp({}, false);
  check('Dev lässt wss: durch (Vite/HMR)', directive(dev, 'connect-src').includes('wss:'));
  check(
    '⭐ Prod OHNE connectSrc erlaubt NUR self — hier stirbt eine Renderer-WebSocket',
    directive(prod, 'connect-src').join(' ') === "'self'",
  );
}

// ── Der Ausweg: die App meldet ihren Bedarf an ────────────────────────────────
{
  const prod = buildCsp({ connectSrc: ['https:', 'wss:'] }, false);
  const cs = directive(prod, 'connect-src');
  check('Prod MIT connectSrc erlaubt wss:', cs.includes('wss:'));
  check('Prod MIT connectSrc erlaubt https:', cs.includes('https:'));
  check("'self' bleibt immer enthalten", cs.includes("'self'"));
}

// ── Was die Lockerung NICHT aufweicht ─────────────────────────────────────────
{
  const prod = buildCsp({ connectSrc: ['https:', 'wss:'] }, false);
  check("Prod: script-src bleibt 'self' (kein unsafe-eval)", directive(prod, 'script-src').join(' ') === "'self'");
  check("object-src bleibt 'none'", directive(prod, 'object-src').join(' ') === "'none'");
  check("frame-src bleibt 'none'", directive(prod, 'frame-src').join(' ') === "'none'");
  check('img-src trägt data: (QR-Codes)', directive(prod, 'img-src').includes('data:'));
}

// ── Zusätze landen in der richtigen Direktive ─────────────────────────────────
{
  const csp = buildCsp({ imgSrc: ['jm-media:'], mediaSrc: ['jm-media:'] }, false);
  check('imgSrc-Zusatz landet in img-src', directive(csp, 'img-src').includes('jm-media:'));
  check('mediaSrc-Zusatz landet in media-src', directive(csp, 'media-src').includes('jm-media:'));
  check('… und nicht in connect-src', !directive(csp, 'connect-src').includes('jm-media:'));
}

// ── frameSrc: die Sandbox des App Designers (#196) ────────────────────────────
// Die Vorschau lädt unter einem eigenen Schema, das die Parent-CSP NICHT erbt. Ohne diesen
// Opt-in steht `frame-src 'none'` und die Sandbox bleibt schwarz. Der Default darf sich davon
// nicht anstecken lassen — sonst dürfte JEDES Tool fremde Frames einbetten.
{
  const csp = buildCsp({ frameSrc: ['jmapp:'] }, false);
  check('frameSrc-Zusatz landet in frame-src', directive(csp, 'frame-src').join(' ') === 'jmapp:');
  check('frameSrc ERSETZT none (nicht daneben)', !directive(csp, 'frame-src').includes("'none'"));
  check('leeres frameSrc fällt auf none zurück', directive(buildCsp({ frameSrc: [] }, false), 'frame-src').join(' ') === "'none'");
}

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
  // Gesamtprüfung 4b: initAppRuntime läuft VOR dem Single-Instance-Lock. Eine zweite Instanz (Doppelklick, Deep-Link,
  // .jmshow, Launcher-Start einer laufenden App) darf main.log und renderer.log der laufenden nicht kürzen: Schreibt diese
  // im Fenster zwischen Lesen und Umbenennen, ist ihre Zeile weg. planeLogAufraeumen räumt darum nie sofort auf, sondern
  // erst nach einer Wartezeit und nur, wenn `darf` (der Lock) es erlaubt; danach im Takt.
  const warte = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
  const alt = (o: string, name: string): void => lege(o, name, zeile(Date.now() - 16 * TAG, 'alt'), Date.now() - 15 * TAG);
  check('Wartezeit vor dem ersten Lauf: 30 s', LOG_AUFRAEUMEN_VERZOEGERUNG_MS === 30 * 1000);

  const o = neuerOrdner();
  alt(o, 'main.log.2');
  const berichte: AufraeumBericht[] = [];
  planeLogAufraeumen({ ordner: o, melde: (b) => berichte.push(b), darf: () => true, verzoegerungMs: 100, taktMs: 150 });
  check('planen räumt nicht sofort auf (die App hat den Lock noch nicht angefragt)', da(o, 'main.log.2') && berichte.length === 0);
  await warte(250);
  check('… nach der Wartezeit: alte Datei gelöscht, der Bericht geht an melde',
    !da(o, 'main.log.2') && berichte.length >= 1 && JSON.stringify(berichte[0].geloescht) === '["main.log.2"]');
  alt(o, 'main.log.3');
  await warte(400);
  check('… danach im Takt wieder', !da(o, 'main.log.3') && berichte.some((b) => b.geloescht.includes('main.log.3')));

  const o2 = neuerOrdner();
  alt(o2, 'main.log.2');
  const berichte2: AufraeumBericht[] = [];
  let gefragt = 0;
  planeLogAufraeumen({ ordner: o2, melde: (b) => berichte2.push(b), darf: () => (gefragt += 1, false), verzoegerungMs: 50, taktMs: 50 });
  await warte(300);
  check('ohne Lock (zweite Instanz): nie aufräumen, nichts melden, aber bei jedem Lauf gefragt',
    da(o2, 'main.log.2') && berichte2.length === 0 && gefragt >= 2);

  // Die Zeitgeber halten keine App am Leben (unref): Ein Node-Prozess, der nur plant, endet sofort.
  const modul = new URL('../src/log-aufraeumen.ts', import.meta.url).href;
  const t0 = Date.now();
  const kind = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e',
      `const m = await import(${JSON.stringify(modul)}); m.planeLogAufraeumen({ ordner: ${JSON.stringify(neuerOrdner())}, melde: () => {}, darf: () => true });`],
    { encoding: 'utf8', timeout: 20_000 },
  );
  check('… ohne verzoegerungMs (30 s) endet ein Prozess, der nur plant, sofort (unref)', kind.status === 0 && Date.now() - t0 < 10_000);

  // index.ts importiert electron und lässt sich hier nicht laden. Geprüft wird darum der Aufrufort im Quelltext:
  // Eine Regel, die nie gerufen wird, löscht nichts; ein Bericht, der nicht ins Log geht, zeigt niemand an.
  const quelle = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
  const init = quelle.slice(quelle.indexOf('export function initAppRuntime('));
  const logger = init.indexOf('createLogger(');
  const plan = init.indexOf('planeLogAufraeumen(');
  check('initAppRuntime plant das Aufräumen nach dem Logger, nur mit dem Lock, der Bericht geht ins Log',
    logger >= 0 && plan > logger && /planeLogAufraeumen\(\{[\s\S]*?darf: \(\) => app\.hasSingleInstanceLock\(\)/.test(init)
      && /planeLogAufraeumen\(\{[\s\S]*?melde: \(b\) => meldeAufraeumen\(log, b\)/.test(init));
  check('… und index.ts räumt nirgends sofort auf (kein raeumeLogsAuf, kein eigener Takt)',
    !quelle.includes('raeumeLogsAuf(') && !quelle.includes('LOG_AUFRAEUMEN_TAKT_MS'));
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
