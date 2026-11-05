// Selbsttest der Freigabe-Schnittstelle Launcher ↔ Tools (Anmeldung Teil 1, Plan P12, 10.8) — ohne Electron:
//   node --experimental-strip-types packages/app-runtime/test/freigabe.test.ts
// Echte Sockets nur auf 127.0.0.1 (ein nachgebauter Launcher je Fall, danach geschlossen), Tür-Dateien nur in einem
// Temp-Ordner unter os.tmpdir() (danach gelöscht). Der echte Tür-Dienst des Launchers kommt in Task 13 (apps/launcher).
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import {
  beweisGleich, FREIGABE_PFAD, FREIGABE_VERSION, freigabeBeweis, holeFreigabe, inhaltsHash, pruefeErgebnis, TUER_DATEI, tuerPfad,
  type FreigabeErgebnis,
} from '../src/freigabe.ts';

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

const temp: string[] = [];
function appData(): string {
  const d = mkdtempSync(join(tmpdir(), 'jm-freigabe-'));
  temp.push(d);
  return d;
}
const SCHLUESSEL = 'test-schluessel-' + 'a'.repeat(32);
const ANDERER = 'test-schluessel-' + 'b'.repeat(32);
function schreibeTuer(dir: string, inhalt: unknown): void {
  mkdirSync(join(dir, 'JM Production Suite'), { recursive: true });
  writeFileSync(tuerPfad(dir), typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt));
}

type Modus = 'echt' | 'ohne-beweis' | 'falscher-schluessel' | 'manipuliert' | '404-signiert' | '404-ohne' | 'haengt'
  | 'kaputt' | 'falsche-form' | 'grund' | 'grund-unbekannt' | 'zu-gross' | 'genau-64k' | 'abgebrochen';
interface Empfangen { kopf: IncomingMessage['headers']; body: string; url: string | undefined; beweisOk: boolean }

/** Nachgebauter Launcher: prüft den Beweis des Tools und antwortet je nach Modus. */
async function launcher(modus: Modus): Promise<{ server: Server; port: number; empfangen: Empfangen[] }> {
  const empfangen: Empfangen[] = [];
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = '';
    req.on('data', (c) => { body += String(c); });
    req.on('end', () => {
      const zeit = String(req.headers['x-jm-zeit'] ?? '');
      const nonce = String(req.headers['x-jm-nonce'] ?? '');
      const beweisOk = beweisGleich(req.headers['x-jm-beweis'] as string | undefined, freigabeBeweis(SCHLUESSEL, ['tool', zeit, nonce, inhaltsHash(body)]));
      empfangen.push({ kopf: req.headers, body, url: req.url, beweisOk });
      if (modus === 'haengt') return;
      const antworte = (status: number, text: string, schluessel: string | null, beweisText = text): void => {
        const kopf: Record<string, string> = { 'content-type': 'application/json' };
        if (schluessel) kopf['x-jm-beweis'] = freigabeBeweis(schluessel, ['launcher', nonce, inhaltsHash(beweisText)]);
        res.writeHead(status, kopf);
        res.end(text);
      };
      const gut = JSON.stringify({ ok: true, freigabe: 'jm1.test.frei', bis: 1_800_000_000_000, konto: { name: 'Maria Schmidt', stufe: 'kollege' } });
      switch (modus) {
        case 'echt': return antworte(200, gut, SCHLUESSEL);
        case 'ohne-beweis': return antworte(200, gut, null);
        case 'falscher-schluessel': return antworte(200, gut, ANDERER);
        case 'manipuliert': return antworte(200, gut.replace('jm1.test.frei', 'jm1.test.boes'), SCHLUESSEL, gut);
        case '404-signiert': return antworte(404, JSON.stringify({ ok: false, grund: 'launcher-zu-alt' }), SCHLUESSEL);
        case '404-ohne': return antworte(404, 'not found', null);
        case 'kaputt': return antworte(200, '{kaputt', SCHLUESSEL);
        case 'falsche-form': return antworte(200, JSON.stringify({ ok: true, freigabe: 5 }), SCHLUESSEL);
        case 'grund': return antworte(200, JSON.stringify({ ok: false, grund: 'niemand-angemeldet' }), SCHLUESSEL);
        case 'grund-unbekannt': return antworte(200, JSON.stringify({ ok: false, grund: 'was-anderes' }), SCHLUESSEL);
        case 'zu-gross': return antworte(200, aufGroesse(64 * 1024 + 1), SCHLUESSEL);
        case 'genau-64k': return antworte(200, aufGroesse(64 * 1024), SCHLUESSEL);
        case 'abgebrochen':
          // Kopf verspricht 1000 Byte, geliefert werden 8, dann bricht die Verbindung ab
          res.writeHead(200, { 'content-type': 'application/json', 'content-length': '1000' });
          res.write('{"ok":tr');
          setTimeout(() => res.socket?.destroy(), 20);
          return;
      }
    });
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()));
  return { server, port: (server.address() as { port: number }).port, empfangen };
}
/** Eine gültige, unterschreibbare Antwort mit genau n Byte (ASCII), aufgefüllt in einem Zusatzfeld, das pruefeErgebnis ignoriert. */
function aufGroesse(n: number): string {
  const kopf = JSON.stringify({ ok: true, freigabe: 'jm1.test.frei', bis: 1_800_000_000_000, konto: { name: 'Maria Schmidt', stufe: 'kollege' }, fuell: '' });
  return JSON.stringify({ ok: true, freigabe: 'jm1.test.frei', bis: 1_800_000_000_000, konto: { name: 'Maria Schmidt', stufe: 'kollege' }, fuell: 'x'.repeat(n - Buffer.byteLength(kopf)) });
}
async function schliesse(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((ok) => server.close(() => ok()));
}
async function fall(modus: Modus, o: { zeitlimitMs?: number } = {}): Promise<{ e: FreigabeErgebnis; empfangen: Empfangen[] }> {
  const l = await launcher(modus);
  const dir = appData();
  schreibeTuer(dir, { v: 1, port: l.port, schluessel: SCHLUESSEL, pid: 4711, start: 1 });
  try {
    const e = await holeFreigabe({ appId: 'jm-qa', zweck: 'qa-relay', ziel: 'evt-1' }, { appDataDir: dir, jetzt: () => 1_700_000_000_000, zeitlimitMs: o.zeitlimitMs });
    return { e, empfangen: l.empfangen };
  } finally {
    await schliesse(l.server);
  }
}
const grund = (e: FreigabeErgebnis): string => (e.ok ? 'ok' : e.grund);

// --- P12 6.2: Erfolg mit gegenseitigem Beweis ----------------------------------------------------------------------------
{
  const { e, empfangen } = await fall('echt');
  const r = empfangen[0];
  const body = r ? JSON.parse(r.body) : null;
  check('P12 6.2: Erfolg mit gegenseitigem Beweis (Tool beweist sich, Antwort ist unterschrieben) liefert Freigabe, bis und Konto',
    e.ok === true && e.freigabe === 'jm1.test.frei' && e.bis === 1_800_000_000_000 && e.konto.name === 'Maria Schmidt'
    && e.konto.stufe === 'kollege' && empfangen.length === 1 && r.beweisOk && r.url === FREIGABE_PFAD);
  check('P12 10.8: Anfrage mit X-JM-Zeit (ms, eingespeiste Uhr), X-JM-Nonce (16 B b64url) und Body { v: 1, appId, zweck, ziel }',
    r?.kopf['x-jm-zeit'] === '1700000000000' && /^[A-Za-z0-9_-]{22}$/.test(String(r?.kopf['x-jm-nonce']))
    && JSON.stringify(body) === JSON.stringify({ v: FREIGABE_VERSION, appId: 'jm-qa', zweck: 'qa-relay', ziel: 'evt-1' })
    && r?.kopf['content-type'] === 'application/json');
}

// --- P12 6.2: Gegenproben-Klasse (jede Abweichung ergibt einen festen Grund) --------------------------------------------
{
  const ergebnisse: Array<[string, string, string]> = [];
  const ohneTuer = await holeFreigabe({ appId: 'jm-qa', zweck: 'qa-relay', ziel: 'evt-1' }, { appDataDir: appData() });
  ergebnisse.push(['Tür-Datei fehlt', grund(ohneTuer), 'kein-launcher']);
  const kaputtDir = appData();
  schreibeTuer(kaputtDir, '{ kaputt');
  ergebnisse.push(['Tür-Datei kaputt', grund(await holeFreigabe({ appId: 'jm-qa', zweck: 'qa-relay' }, { appDataDir: kaputtDir })), 'kein-launcher']);
  const v2 = appData();
  schreibeTuer(v2, { v: 2, port: 1, schluessel: SCHLUESSEL, pid: 1, start: 1 });
  ergebnisse.push(['Tür-Datei v: 2', grund(await holeFreigabe({ appId: 'jm-qa', zweck: 'qa-relay' }, { appDataDir: v2 })), 'launcher-zu-alt']);
  const tot = await launcher('echt');
  const totPort = tot.port;
  await schliesse(tot.server);
  const totDir = appData();
  schreibeTuer(totDir, { v: 1, port: totPort, schluessel: SCHLUESSEL, pid: 1, start: 1 });
  ergebnisse.push(['Port tot (veraltete Tür-Datei)', grund(await holeFreigabe({ appId: 'jm-qa', zweck: 'qa-relay' }, { appDataDir: totDir })), 'kein-launcher']);
  for (const [modus, soll] of [['ohne-beweis', 'launcher-unecht'], ['falscher-schluessel', 'launcher-unecht'], ['manipuliert', 'launcher-unecht'],
    ['404-signiert', 'launcher-zu-alt'], ['404-ohne', 'launcher-unecht'], ['kaputt', 'launcher-unecht'], ['falsche-form', 'launcher-unecht'],
    ['grund', 'niemand-angemeldet'], ['grund-unbekannt', 'launcher-unecht']] as Array<[Modus, string]>) {
    ergebnisse.push([modus, grund((await fall(modus)).e), soll]);
  }
  const start = Date.now();
  const haengt = await fall('haengt', { zeitlimitMs: 150 });
  const dauer = Date.now() - start;
  ergebnisse.push([`Zeitlimit (150 ms, gemessen ${dauer < 3000 ? 'unter 3 s' : `${dauer} ms`})`, dauer < 3000 ? grund(haengt.e) : 'zu langsam', 'kein-launcher']);
  const falsch = ergebnisse.filter(([, ist, soll]) => ist !== soll);
  check(`P12 6.2: Gründe — keine Tür-Datei, kaputt, v: 2, Port tot, ohne Beweis, fremder Schlüssel, manipuliert, 404, kaputtes JSON, falsche Form, Grund durchgereicht, Zeitlimit (${ergebnisse.length} Fälle)${falsch.length ? ` — ${falsch.slice(0, 5).map(([n, i, s]) => `${n}: ist ${i}, soll ${s}`).join('; ')}` : ''}`,
    falsch.length === 0);
}

// --- P12 10.8: Beweis mit festen Vektoren -----------------------------------------------------------------------------
{
  const V1 = 'HB0PdUnXSt3EemFDA3cBN-bkQCPrKFGcGlNWUBgloXY';
  const V2 = 'LTySQwXMJ7HtTOjwTgSoZi6EoYJr72d_BWyfTRrIZ5M';
  const H = 'afbf9d0f3560b0fd7795e81c42a0a79ee6b6fc67e064f77826aee642cad28d91';
  const k = 'test-schluessel-fuer-den-vektor-01';
  check('P12 10.8: freigabeBeweis und inhaltsHash mit festen Vektoren (HMAC-SHA256 b64url über teile.join(„|“), SHA-256 hex)',
    inhaltsHash('{"v":1}') === H && freigabeBeweis(k, ['tool', '1700000000000', 'AAAAAAAAAAAAAAAAAAAAAA', H]) === V1
    && freigabeBeweis(k, ['launcher', 'AAAAAAAAAAAAAAAAAAAAAA', inhaltsHash('')]) === V2
    && beweisGleich(V1, V1) && !beweisGleich(V1, V2) && !beweisGleich(undefined, V1) && !beweisGleich(V1.slice(1), V1));
  check('P12 10.8: tuerPfad = <appData>/JM Production Suite/launcher-tuer.json; pruefeErgebnis nur mit den Formen aus 10.8',
    tuerPfad('X') === join('X', 'JM Production Suite', 'launcher-tuer.json') && TUER_DATEI === 'launcher-tuer.json'
    && pruefeErgebnis({ ok: false, grund: 'kein-recht', detail: 'x'.repeat(300) })?.ok === false
    && (pruefeErgebnis({ ok: false, grund: 'kein-recht', detail: 'x'.repeat(300) }) as { detail: string }).detail.length === 200
    && pruefeErgebnis({ ok: true, freigabe: 'f', bis: 1, konto: { name: 'n', stufe: 'gast' } }) === null && pruefeErgebnis(null) === null);
}

// --- P12 G9, G10: nur node:-Module, index.ts unverändert, Export ./freigabe ---------------------------------------------
{
  const quelle = readFileSync(new URL('../src/freigabe.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const importe = quelle.split('\n').filter((z) => /^import\b/.test(z));
  const index = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { exports: Record<string, string> };
  check(`P12 G9: freigabe.ts lädt nur node:-Module (${importe.length} Importe), kein Electron; index.ts kennt die Freigabe nicht; Export „./freigabe“`,
    importe.length > 0 && importe.every((z) => /from 'node:[a-z]+';$/.test(z)) && !quelle.includes('electron')
    && !index.includes('freigabe') && pkg.exports['./freigabe'] === './src/freigabe.ts' && pkg.exports['.'] === './src/index.ts');
}

// --- P12 Review 1: Launcher mit eigenem Schlüssel und eigener Antwort (Nonce, Wiederholung, Tür neu schreiben) ---------------
interface Eigener { server: Server; port: number; nonces: string[] }
async function eigenerLauncher(schl: string, antwort: (n: number, nonce: string) => { status: number; text: string; beweis: string }): Promise<Eigener> {
  const nonces: string[] = [];
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    req.on('data', () => {});
    req.on('end', () => {
      const nonce = String(req.headers['x-jm-nonce'] ?? '');
      nonces.push(nonce);
      const a = antwort(nonces.length, nonce);
      res.writeHead(a.status, { 'content-type': 'application/json', 'x-jm-beweis': a.beweis });
      res.end(a.text);
    });
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()));
  return { server, port: (server.address() as { port: number }).port, nonces };
}
const GUT = JSON.stringify({ ok: true, freigabe: 'jm1.test.frei', bis: 1_800_000_000_000, konto: { name: 'Maria Schmidt', stufe: 'kollege' } });
const frage = { appId: 'jm-qa', zweck: 'qa-relay', ziel: 'evt-1' };
{
  // Nonce-Frische: zwei Aufrufe gegen dieselbe Tür-Datei, verschiedene Nonces.
  const l = await eigenerLauncher(SCHLUESSEL, (_n, nonce) => ({ status: 200, text: GUT, beweis: freigabeBeweis(SCHLUESSEL, ['launcher', nonce, inhaltsHash(GUT)]) }));
  const dir = appData();
  schreibeTuer(dir, { v: 1, port: l.port, schluessel: SCHLUESSEL, pid: 1, start: 1 });
  const a = await holeFreigabe(frage, { appDataDir: dir });
  const b = await holeFreigabe(frage, { appDataDir: dir });
  await schliesse(l.server);
  check('P12 6.2: Nonce je Anfrage neu (zwei Aufrufe gegen dieselbe Tür-Datei, beide 16 B b64url, verschieden)',
    a.ok && b.ok && l.nonces.length === 2 && l.nonces[0] !== l.nonces[1] && l.nonces.every((n) => /^[A-Za-z0-9_-]{22}$/.test(n)));
}
{
  // Wiederholung: der zweite Aufruf bekommt die erste unterschriebene Antwort erneut, sie gehört zur alten Nonce.
  let erste: { text: string; beweis: string } | null = null;
  const l = await eigenerLauncher(SCHLUESSEL, (n, nonce) => {
    if (n === 1) {
      erste = { text: GUT, beweis: freigabeBeweis(SCHLUESSEL, ['launcher', nonce, inhaltsHash(GUT)]) };
    }
    return { status: 200, ...(erste as { text: string; beweis: string }) };
  });
  const dir = appData();
  schreibeTuer(dir, { v: 1, port: l.port, schluessel: SCHLUESSEL, pid: 1, start: 1 });
  const a = await holeFreigabe(frage, { appDataDir: dir });
  const b = await holeFreigabe(frage, { appDataDir: dir });
  await schliesse(l.server);
  check('P12 6.2: Wiederholte Antwort (erste unterschriebene Antwort beim zweiten Aufruf erneut) ist launcher-unecht',
    a.ok === true && grund(b) === 'launcher-unecht');
}
{
  // Tür-Datei bei jedem Aufruf neu lesen: zwischen zwei Aufrufen neuer Port und neuer Schlüssel.
  const la = await eigenerLauncher(SCHLUESSEL, (_n, nonce) => ({ status: 200, text: GUT, beweis: freigabeBeweis(SCHLUESSEL, ['launcher', nonce, inhaltsHash(GUT)]) }));
  const lb = await eigenerLauncher(ANDERER, (_n, nonce) => ({ status: 200, text: GUT, beweis: freigabeBeweis(ANDERER, ['launcher', nonce, inhaltsHash(GUT)]) }));
  const dir = appData();
  schreibeTuer(dir, { v: 1, port: la.port, schluessel: SCHLUESSEL, pid: 1, start: 1 });
  const a = await holeFreigabe(frage, { appDataDir: dir });
  schreibeTuer(dir, { v: 1, port: lb.port, schluessel: ANDERER, pid: 2, start: 2 });
  const b = await holeFreigabe(frage, { appDataDir: dir });
  await schliesse(la.server);
  await schliesse(lb.server);
  check('P12 10.8: Tür-Datei wird bei jedem Aufruf neu gelesen (neuer Port und Schlüssel zwischen zwei Aufrufen erreichen den neuen Launcher)',
    a.ok === true && b.ok === true && la.nonces.length === 1 && lb.nonces.length === 1);
}

// --- P12 Review 1: unvollständige Tür-Dateien ergeben kein-launcher und werfen nie ------------------------------------------
{
  const voll = { v: 1, port: 8080, schluessel: SCHLUESSEL, pid: 1, start: 1 };
  const ohne = (k: string): Record<string, unknown> => { const c: Record<string, unknown> = { ...voll }; delete c[k]; return c; };
  const faelle: Array<[string, unknown]> = [
    ['ohne Schlüssel', ohne('schluessel')],
    ['Schlüssel zu kurz', { ...voll, schluessel: 'test-kurz' }],
    ['Port 0', { ...voll, port: 0 }],
    ['Port "80"', { ...voll, port: '80' }],
    ['Port 70000', { ...voll, port: 70000 }],
    ['ohne pid', ohne('pid')],
    ['v 0', { ...voll, v: 0 }],
    ['v "1"', { ...voll, v: '1' }],
    ['[]', '[]'],
    ['null', 'null'],
    ['leer', ''],
  ];
  const abweichend: string[] = [];
  for (const [name, inhalt] of faelle) {
    const dir = appData();
    schreibeTuer(dir, inhalt);
    let ist: string;
    try {
      ist = grund(await holeFreigabe(frage, { appDataDir: dir, zeitlimitMs: 500 }));
    } catch {
      ist = 'wirft';
    }
    if (ist !== 'kein-launcher') abweichend.push(`${name}: ist ${ist}, soll kein-launcher`);
  }
  check(`P12 6.2: Unvollständige Tür-Dateien — jede ergibt kein-launcher, keine wirft (${faelle.length} Fälle)${abweichend.length ? ` — ${abweichend.slice(0, 5).join('; ')}` : ''}`,
    abweichend.length === 0);
}

// --- P12 Review 1, G4: nichts in Konsole oder Ergebnis; agent: false; Standard-Zeitlimit 5 s -----------------------------------
{
  const quelle = readFileSync(new URL('../src/freigabe.ts', import.meta.url), 'utf8');
  check('P12 G4: freigabe.ts schreibt nichts in Konsole oder Standardausgabe (weder console. noch process.std)',
    !quelle.includes('console.') && !quelle.includes('process.std'));
  check('P12 10.8: Anfrage ohne Keep-Alive und am Umgebungs-Proxy vorbei (agent: false steht im Quelltext)',
    /^\s*agent: false,$/m.test(quelle));
  const ergebnisse: FreigabeErgebnis[] = [];
  for (const m of ['echt', 'ohne-beweis', 'falscher-schluessel', 'manipuliert', 'grund'] as Modus[]) ergebnisse.push((await fall(m)).e);
  const text = JSON.stringify(ergebnisse);
  check(`P12 G4: kein Ergebnis enthält einen Schlüssel oder einen Beweis (${ergebnisse.length} Fälle)`,
    !text.includes(SCHLUESSEL) && !text.includes(ANDERER) && !/[A-Za-z0-9_-]{43}/.test(text));
}
{
  // Standard-Zeitlimit 5 s, ohne 5 s zu warten: die Zeitgeber werden mitgelesen und auf 100 ms verkürzt.
  const echt = globalThis.setTimeout;
  const verlangt: number[] = [];
  globalThis.setTimeout = ((f: () => void, ms?: number, ...r: unknown[]) => {
    verlangt.push(Number(ms));
    return echt(f, Math.min(Number(ms) || 0, 100), ...r);
  }) as typeof setTimeout;
  let e: FreigabeErgebnis;
  try {
    e = (await fall('haengt')).e;
  } finally {
    globalThis.setTimeout = echt;
  }
  check(`P12 6.2: Standard-Zeitlimit ist 5000 ms (verlangt: ${verlangt.join(', ')}) und führt zu kein-launcher`,
    verlangt.includes(5000) && !verlangt.some((v) => v > 5000) && grund(e) === 'kein-launcher');
}

// --- Z1 L1 Nr. 9: appDataDir muss absolut sein ---------------------------------------------------------------------------------
{
  // Eine gültige Tür-Datei mit lebendem Launcher liegt unter einem absoluten Pfad; derselbe Ordner relativ zum Arbeitsordner angegeben
  // darf nie gelesen werden (je nach Arbeitsordner läge dort eine fremde Tür-Datei).
  const l = await launcher('echt');
  const dir = appData();
  schreibeTuer(dir, { v: 1, port: l.port, schluessel: SCHLUESSEL, pid: 4711, start: 1 });
  try {
    const absolut = grund(await holeFreigabe({ appId: 'jm-qa', zweck: 'qa-relay' }, { appDataDir: dir, jetzt: () => 1_700_000_000_000 }));
    const relativ = relative(process.cwd(), dir);
    const mitRelativ = relativ !== '' && !isAbsolute(relativ)
      ? grund(await holeFreigabe({ appId: 'jm-qa', zweck: 'qa-relay' }, { appDataDir: relativ, jetzt: () => 1_700_000_000_000 })) : 'nicht prüfbar';
    const nurName = grund(await holeFreigabe({ appId: 'jm-qa', zweck: 'qa-relay' }, { appDataDir: '', jetzt: () => 1_700_000_000_000 }));
    check(`Z1 Nr. 9: holeFreigabe liest die Tür-Datei nur unter einem absoluten Pfad (absolut: ${absolut}, relativ: ${mitRelativ}, leer: ${nurName})`,
      absolut === 'ok' && mitRelativ === 'kein-launcher' && nurName === 'kein-launcher' && l.empfangen.length === 1);
  } finally {
    await schliesse(l.server);
  }
}

// --- Z1 L1 Nr. 9 [T]: Grenze der Antwort (64 KiB), abgebrochene Antwort ---------------------------------------------------------
{
  const genau = await fall('genau-64k');
  const zuGross = await fall('zu-gross');
  const abgebrochen = await fall('abgebrochen');
  check(`Z1 [T]: eine unterschriebene Antwort von genau 64 KiB gilt, ein Byte mehr ist kein-launcher (genau: ${grund(genau.e)}, +1: ${grund(zuGross.e)})`,
    grund(genau.e) === 'ok' && grund(zuGross.e) === 'kein-launcher' && genau.empfangen.length === 1 && zuGross.empfangen.length === 1);
  check(`Z1 [T]: eine mittendrin abgebrochene Antwort ist kein-launcher (ohne Wurf, ohne Warten bis zum Zeitlimit): ${grund(abgebrochen.e)}`,
    grund(abgebrochen.e) === 'kein-launcher' && abgebrochen.empfangen.length === 1);
}

// --- Z1 L1 [T]: unvollständige Tür-Dateien mit totem Port (statt 8080) und mit lebendem Launcher -------------------------------
{
  // Ein toter Port, den wirklich niemand belegt: kurz öffnen, Nummer merken, schließen. Auf 8080 könnte auf einem Entwicklerrechner etwas lauschen.
  const probe = createServer();
  await new Promise<void>((ok) => probe.listen(0, '127.0.0.1', () => ok()));
  const tot = (probe.address() as { port: number }).port;
  await schliesse(probe);
  // Mit einem LEBENDEN Launcher sähe eine fälschlich angenommene Datei eine gültige Antwort ("ok") — erst das unterscheidet „zu Recht
  // abgelehnt“ von „Verbindung scheiterte zufällig“.
  const lebend = await launcher('echt');
  const FAELLE: Array<[string, (port: number) => unknown]> = [
    ['ohne Schlüssel', (p) => { const c: Record<string, unknown> = { v: 1, port: p, schluessel: SCHLUESSEL, pid: 1, start: 1 }; delete c.schluessel; return c; }],
    ['Schlüssel zu kurz', (p) => ({ v: 1, port: p, schluessel: 'test-kurz', pid: 1, start: 1 })],
    ['ohne Port', (p) => { const c: Record<string, unknown> = { v: 1, port: p, schluessel: SCHLUESSEL, pid: 1, start: 1 }; delete c.port; return c; }],
    ['Port als Text', (p) => ({ v: 1, port: String(p), schluessel: SCHLUESSEL, pid: 1, start: 1 })],
    ['Port 0', () => ({ v: 1, port: 0, schluessel: SCHLUESSEL, pid: 1, start: 1 })],
    ['Port 70000', () => ({ v: 1, port: 70000, schluessel: SCHLUESSEL, pid: 1, start: 1 })],
    ['Port mit Nachkommastelle', (p) => ({ v: 1, port: p + 0.5, schluessel: SCHLUESSEL, pid: 1, start: 1 })],
    ['ohne pid', (p) => { const c: Record<string, unknown> = { v: 1, port: p, schluessel: SCHLUESSEL, pid: 1, start: 1 }; delete c.pid; return c; }],
    ['ohne start', (p) => { const c: Record<string, unknown> = { v: 1, port: p, schluessel: SCHLUESSEL, pid: 1, start: 1 }; delete c.start; return c; }],
    ['v 0', (p) => ({ v: 0, port: p, schluessel: SCHLUESSEL, pid: 1, start: 1 })],
    ['v als Text', (p) => ({ v: '1', port: p, schluessel: SCHLUESSEL, pid: 1, start: 1 })],
    ['Liste', () => '[]'], ['null', () => 'null'], ['leer', () => ''],
  ];
  const abweichend: string[] = [];
  for (const [name, bau] of FAELLE) {
    for (const [wo, port] of [['toter Port', tot], ['lebender Launcher', lebend.port]] as const) {
      const dir = appData();
      schreibeTuer(dir, bau(port));
      let ist: string;
      try {
        ist = grund(await holeFreigabe({ appId: 'jm-qa', zweck: 'qa-relay' }, { appDataDir: dir, zeitlimitMs: 500 }));
      } catch {
        ist = 'wirft';
      }
      if (ist !== 'kein-launcher') abweichend.push(`${name} (${wo}): ist ${ist}`);
    }
  }
  const gesehen = lebend.empfangen.length;
  await schliesse(lebend.server);
  check(`Z1 [T]: unvollständige Tür-Dateien ergeben kein-launcher — mit totem Port (nicht 8080) und mit lebendem Launcher, der nie angefragt wird (${FAELLE.length * 2} Fälle)${abweichend.length ? ` — ${abweichend.slice(0, 5).join('; ')}` : ''}`,
    abweichend.length === 0 && gesehen === 0);
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
