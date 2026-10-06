// Zoom-SDK nachladen OHNE Electron (tsx): Paket, Link, Download, Entpacken, Texte (Spec 2026-10-06, 4.1, 4.3, 5, 6).
//   npm run selftest -w @jm/connect   ·   einzeln: npx tsx apps/connect/test/sdk-laden.test.ts
// Lokaler HTTP-Testserver (Muster apps/launcher/test/iveo-huelle.test.ts) mit erfundenem Mini-Paket und eigenem
// SHA. Das echte tar.exe läuft nur unter Windows; anderswo zählen diese Fälle als „übersprungen“.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SDK_FASSUNG } from '@jm/zoom-bridge/sdk';
import { KT } from '../src/main/zoom/klartext';
import { freierPlatz } from '../src/main/zoom/laufzeit';
import {
  entpacke,
  fehlerCode,
  holeLink,
  lade,
  LADE_ORDNER,
  ladeFehlerText,
  SDK_LADEN_DIENSTE,
  type KindProzess,
  type LadeFehler,
} from '../src/main/zoom/sdk-laden';
import { SDK_PAKET } from '../src/main/zoom/sdk-paket';

let pass = 0, fail = 0, skip = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
function ueberspringe(name: string): void {
  skip++;
  console.log(`  --  ${name} (übersprungen: nur unter Windows)`);
}
// Gesamtwache: hängt ein Fall, endet der Lauf rot statt nie.
const wache = setTimeout(() => {
  console.log('FAIL  Gesamtlaufzeit über 60 s – ein Fall hängt');
  process.exit(1);
}, 60_000);
wache.unref();

const tmp = mkdtempSync(join(tmpdir(), 'jm-sdk-laden-'));
const sig = (): AbortSignal => new AbortController().signal;
/** Wartet höchstens `ms`, bis `f()` gilt; liefert den letzten Wert. */
async function bis(f: () => boolean, ms = 2000): Promise<boolean> {
  const ende = Date.now() + ms;
  while (!f() && Date.now() < ende) await new Promise((r) => setTimeout(r, 10));
  return f();
}
/** Jedes Fehler-Ergebnis landet hier: am Ende darf keines Schlüssel, Link oder Server-Adresse tragen. */
const fehlerErgebnisse: unknown[] = [];
function merke<T extends { ok: boolean }>(r: T): T {
  if (!r.ok) fehlerErgebnisse.push(r);
  return r;
}

// Erfundenes Mini-Paket: 300 000 Bytes festes Muster, eigener SHA-256.
const PAKET = Buffer.alloc(300_000);
for (let i = 0; i < PAKET.length; i++) PAKET[i] = i % 251;
const MINI = { bytes: PAKET.length, sha256: createHash('sha256').update(PAKET).digest('hex') };

// ── Testserver ──
type LinkModus = { status: number; kopf?: Record<string, string>; body: string } | 'haengt';
let linkModus: LinkModus = { status: 200, body: '{}' };
let anfragen: Array<{ pfad: string; schluessel: string | undefined; proxyKey: string | undefined }> = [];
/** /paket/endlos: was der Server gesendet hat und ob der Client die Verbindung geschlossen hat. */
const endlos = { gesendet: 0, zu: false };

/** Schreibt `daten` in 10 Stücken mit kurzer Pause, damit der Client mehrere Stücke liest. */
function stueckweise(res: ServerResponse, daten: Buffer, dann: () => void): void {
  const groesse = Math.ceil(daten.length / 10);
  let pos = 0;
  const weiter = (): void => {
    if (pos >= daten.length) return dann();
    res.write(daten.subarray(pos, pos + groesse));
    pos += groesse;
    setTimeout(weiter, 5);
  };
  weiter();
}

function route(req: IncomingMessage, res: ServerResponse): void {
  const pfad = (req.url ?? '/').split('?')[0];
  anfragen.push({
    pfad,
    schluessel: req.headers['x-zoom-sdk-key'] as string | undefined,
    proxyKey: req.headers['x-proxy-key'] as string | undefined,
  });
  if (pfad.startsWith('/zoom-sdk/')) {
    if (linkModus === 'haengt') return; // antwortet nie
    res.writeHead(linkModus.status, { 'content-type': 'application/json', ...linkModus.kopf });
    res.end(linkModus.body);
    return;
  }
  const haelfte = PAKET.subarray(0, PAKET.length / 2);
  switch (pfad) {
    case '/paket/ok':
      res.writeHead(200, { 'content-length': String(PAKET.length) });
      stueckweise(res, PAKET, () => res.end());
      return;
    case '/paket/abriss':
      res.writeHead(200, { 'content-length': String(PAKET.length) });
      res.write(haelfte);
      setTimeout(() => res.socket?.destroy(), 20);
      return;
    case '/paket/kurz': // sauber zu Ende, aber zu kurz (ohne content-length, chunked)
      res.writeHead(200);
      res.end(haelfte);
      return;
    case '/paket/endlos': { // mehr Bytes als gepinnt: sendet bis zum Zehnfachen, es sei denn, der Client legt auf
      res.writeHead(200);
      const stueck = Buffer.alloc(30_000, 1);
      endlos.gesendet = 0;
      endlos.zu = false;
      res.on('close', () => {
        endlos.zu = true;
      });
      const weiter = (): void => {
        if (endlos.zu) return;
        if (endlos.gesendet >= 10 * PAKET.length) return void res.end();
        endlos.gesendet += stueck.length;
        res.write(stueck);
        setTimeout(weiter, 5);
      };
      weiter();
      return;
    }
    case '/paket/falsch': {
      const anders = Buffer.from(PAKET);
      anders[0] ^= 0xff;
      res.writeHead(200, { 'content-length': String(anders.length) });
      res.end(anders);
      return;
    }
    case '/paket/haengt':
      res.writeHead(200, { 'content-length': String(PAKET.length) });
      res.write(haelfte);
      return; // nie zu Ende
    default:
      res.writeHead(403);
      res.end('nein');
  }
}

const server = createServer(route);
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const BASIS = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

// ── 4.1 Gepinntes Paket ──
console.log('— Gepinntes Paket (Spec 4.1)');
ck('SDK_PAKET.fassung === SDK_FASSUNG aus @jm/zoom-bridge', SDK_PAKET.fassung === SDK_FASSUNG);
ck('sha256 ist echtes Hex (64 Zeichen, kein Platzhalter)', /^[0-9a-f]{64}$/.test(SDK_PAKET.sha256));
ck('datei = zoom-sdk-win-x64-<fassung>.zip', SDK_PAKET.datei === `zoom-sdk-win-x64-${SDK_FASSUNG}.zip`);
ck('bytes und bytesEntpackt sind ganze Zahlen > 0, entpackt größer',
  Number.isSafeInteger(SDK_PAKET.bytes) && SDK_PAKET.bytes > 0 && Number.isSafeInteger(SDK_PAKET.bytesEntpackt)
    && SDK_PAKET.bytesEntpackt > SDK_PAKET.bytes);
ck('Arbeitsordner heißt „laden“ (Spec 4.3 Schritt 4)', LADE_ORDNER === 'laden');
ck('Werte wörtlich wie am hochgeladenen Asset gemessen (Plan G1)', JSON.stringify(SDK_PAKET) === JSON.stringify({
  fassung: '7.1.5.43953',
  datei: 'zoom-sdk-win-x64-7.1.5.43953.zip',
  sha256: '596ef61956b5f336570dd3cd14b0ec9822d51e37a2a4fc03ce4f96c1974b3b4e',
  bytes: 150120193,
  bytesEntpackt: 329657415,
}));

// ── Link beim Proxy ──
console.log('— Link beim Proxy (holeLink): Fehlerarten, Header, kein Proxy-Schlüssel');
async function link(modus: LinkModus): Promise<Awaited<ReturnType<typeof holeLink>>> {
  linkModus = modus;
  return merke(await holeLink({ base: BASIS, schluessel: 'sdk-test', fassung: SDK_FASSUNG, signal: sig() }));
}
{
  anfragen = [];
  const r = await link({ status: 200, body: JSON.stringify({ fassung: SDK_FASSUNG, url: `${BASIS}/paket/ok`, size: MINI.bytes }) });
  ck('200 → url und size', r.ok && r.url === `${BASIS}/paket/ok` && r.size === MINI.bytes);
  ck('… GET /zoom-sdk/<fassung>, Schlüssel im Header X-Zoom-Sdk-Key',
    anfragen.length === 1 && anfragen[0].pfad === `/zoom-sdk/${SDK_FASSUNG}` && anfragen[0].schluessel === 'sdk-test');
  ck('… ohne X-Proxy-Key', anfragen[0].proxyKey === undefined);
}
ck('401 → schluessel', JSON.stringify(await link({ status: 401, body: '{"error":"unauthorized"}' })) === '{"ok":false,"art":"schluessel"}');
ck('429 mit Retry-After 125 → gedrosselt, 125 s',
  JSON.stringify(await link({ status: 429, kopf: { 'Retry-After': '125' }, body: '{}' })) === '{"ok":false,"art":"gedrosselt","sekunden":125}');
ck('429 ohne Retry-After → gedrosselt, 60 s',
  JSON.stringify(await link({ status: 429, body: '{}' })) === '{"ok":false,"art":"gedrosselt","sekunden":60}');
ck('404 → fehlt', JSON.stringify(await link({ status: 404, body: '{"error":"not_found"}' })) === '{"ok":false,"art":"fehlt"}');
ck('502 → proxy „HTTP 502“', JSON.stringify(await link({ status: 502, body: '{"error":"upstream"}' })) === '{"ok":false,"art":"proxy","grund":"HTTP 502"}');
ck('200 mit kaputtem JSON → proxy „Antwort ungültig“ (kein JS-Fehlername)',
  JSON.stringify(await link({ status: 200, body: 'kein json' })) === '{"ok":false,"art":"proxy","grund":"Antwort ungültig"}');
ck('200 ohne url → proxy „Antwort ungültig“',
  JSON.stringify(await link({ status: 200, body: JSON.stringify({ size: 5 }) })) === '{"ok":false,"art":"proxy","grund":"Antwort ungültig"}');
{
  // Der SDK-Schlüssel geht nie im Klartext übers Netz: http nur an die eigene Maschine (wie BASIS hier).
  let gefragt = 0;
  const zaehle: typeof fetch = async () => {
    gefragt++;
    return new Response('{}', { status: 500 });
  };
  const r = merke(await holeLink({ base: 'http://proxy.test', schluessel: 'sdk-test', fassung: SDK_FASSUNG, signal: sig(), werkzeuge: { fetch: zaehle } }));
  ck('Proxy-Adresse mit http:// (nicht die eigene Maschine) → proxy „kein HTTPS“, keine Anfrage',
    JSON.stringify(r) === '{"ok":false,"art":"proxy","grund":"kein HTTPS"}' && gefragt === 0);
  gefragt = 0;
  const r2 = merke(await holeLink({ base: 'keine adresse', schluessel: 'sdk-test', fassung: SDK_FASSUNG, signal: sig(), werkzeuge: { fetch: zaehle } }));
  ck('kaputte Proxy-Adresse → proxy „Adresse ungültig“, keine Anfrage',
    JSON.stringify(r2) === '{"ok":false,"art":"proxy","grund":"Adresse ungültig"}' && gefragt === 0);
}
{
  const zu = createServer(() => {});
  await new Promise<void>((r) => zu.listen(0, '127.0.0.1', r));
  const port = (zu.address() as AddressInfo).port;
  await new Promise<void>((r) => zu.close(() => r()));
  const r = merke(await holeLink({ base: `http://127.0.0.1:${port}`, schluessel: 'sdk-test', fassung: SDK_FASSUNG, signal: sig() }));
  ck('Netzfehler (Port zu) → proxy „ECONNREFUSED“', !r.ok && r.art === 'proxy' && r.grund === 'ECONNREFUSED');
}
{
  linkModus = 'haengt';
  const ac = new AbortController();
  const lauf = holeLink({ base: BASIS, schluessel: 'sdk-test', fassung: SDK_FASSUNG, signal: ac.signal });
  setTimeout(() => ac.abort(), 50);
  ck('Abbruch, während der Proxy schweigt → abgebrochen', JSON.stringify(merke(await lauf)) === '{"ok":false,"art":"abgebrochen"}');
}

// ── Download ──
console.log('— Download (lade): Fortschritt, Abriss, Länge, Prüfsumme, Abbruch, Größe vom Proxy');
let nr = 0;
const neuesZiel = (): string => join(tmp, `dl-${++nr}`, 'paket.zip');
async function ladeVon(modus: string, extra: Partial<Parameters<typeof lade>[0]> = {}): Promise<{ r: Awaited<ReturnType<typeof lade>>; ziel: string }> {
  const ziel = neuesZiel();
  const r = merke(await lade({ url: `${BASIS}/paket/${modus}`, size: MINI.bytes, ziel, erwartet: MINI, signal: sig(), fortschritt: () => {}, ...extra }));
  return { r, ziel };
}
{
  const meldungen: number[] = [];
  let geprueft = 0;
  let uhr = 0;
  const { r, ziel } = await ladeVon('ok', {
    fortschritt: (b) => meldungen.push(b),
    beimPruefen: () => { geprueft++; },
    werkzeuge: { jetzt: () => (uhr += 300) },
  });
  ck('Erfolg → ok, Datei am Ziel mit genau dem Inhalt', r.ok && existsSync(ziel) && readFileSync(ziel).equals(PAKET));
  ck('… .teil ist weg', !existsSync(`${ziel}.teil`));
  ck('… Fortschritt in mehreren Schritten, steigend, bis zur vollen Größe',
    meldungen.length >= 2 && meldungen.at(-1) === MINI.bytes && meldungen.every((b, i) => i === 0 || b > meldungen[i - 1]));
  ck('… „wird geprüft“ genau einmal gemeldet', geprueft === 1);
}
{
  const meldungen: number[] = [];
  const { r } = await ladeVon('ok', { fortschritt: (b) => meldungen.push(b), werkzeuge: { jetzt: () => 1000 } });
  ck('Uhr steht: höchstens eine Fortschrittsmeldung je 250 ms (hier genau eine)', r.ok && meldungen.length === 1);
}
{
  const { r, ziel } = await ladeVon('abriss');
  ck('Abriss mitten im Strom → unvollstaendig mit Netz-Code', !r.ok && r.art === 'unvollstaendig' && /^[A-Z][A-Z_]+$/.test(r.grund));
  ck('… .teil weg, kein Ziel', !existsSync(`${ziel}.teil`) && !existsSync(ziel));
}
{
  const { r, ziel } = await ladeVon('kurz');
  ck('sauber zu Ende, aber zu kurz → unvollstaendig „unvollständig“',
    JSON.stringify(r) === '{"ok":false,"art":"unvollstaendig","grund":"unvollständig"}' && !existsSync(`${ziel}.teil`) && !existsSync(ziel));
}
{
  const { r, ziel } = await ladeVon('endlos');
  ck('Review Focus SDK-3: mehr Bytes als gepinnt → Abbruch beim Überschreiten, unvollstaendig „zu groß“',
    JSON.stringify(r) === '{"ok":false,"art":"unvollstaendig","grund":"zu groß"}' && !existsSync(`${ziel}.teil`) && !existsSync(ziel));
  ck('… der Download hört dort auf: Verbindung zu, bevor der Server das Zehnfache gesendet hat',
    (await bis(() => endlos.zu)) && endlos.gesendet < 10 * MINI.bytes);
}
{
  // Ein Schreibziel, das je Aufruf höchstens 1000 Bytes schreibt: lade() muss den Rest selbst nachschieben.
  let schreibAufrufe = 0;
  const { r, ziel } = await ladeVon('ok', {
    werkzeuge: {
      oeffne: async (pfad) => {
        const echt = await open(pfad, 'w');
        return {
          write: (daten, versatz, laenge) => {
            schreibAufrufe++;
            return echt.write(daten, versatz, Math.min(laenge, 1000));
          },
          close: () => echt.close(),
        };
      },
    },
  });
  ck('Teil-Schreiben (höchstens 1000 Bytes je Aufruf) → die Datei bekommt trotzdem jedes Byte',
    r.ok && readFileSync(ziel).equals(PAKET) && schreibAufrufe >= MINI.bytes / 1000);
}
{
  const { r, ziel } = await ladeVon('falsch');
  ck('falscher SHA → pruefsumme', JSON.stringify(r) === '{"ok":false,"art":"pruefsumme"}');
  ck('… .teil weg, kein Ziel', !existsSync(`${ziel}.teil`) && !existsSync(ziel));
}
{
  const { r } = await ladeVon('verboten');
  ck('Storage antwortet 403 → unvollstaendig „HTTP 403“', JSON.stringify(r) === '{"ok":false,"art":"unvollstaendig","grund":"HTTP 403"}');
}
{
  const ac = new AbortController();
  const ziel = neuesZiel();
  const r = merke(await lade({ url: `${BASIS}/paket/haengt`, size: MINI.bytes, ziel, erwartet: MINI, signal: ac.signal, fortschritt: () => ac.abort() }));
  ck('Abbruch mitten im Strom → abgebrochen', JSON.stringify(r) === '{"ok":false,"art":"abgebrochen"}');
  ck('… .teil weg, kein Ziel', !existsSync(`${ziel}.teil`) && !existsSync(ziel));
}
{
  anfragen = [];
  const ziel = neuesZiel();
  const r = merke(await lade({ url: `${BASIS}/paket/ok`, size: MINI.bytes + 1, ziel, erwartet: MINI, signal: sig(), fortschritt: () => {} }));
  ck('size vom Proxy ≠ gepinnt → fehlt, ohne Download', JSON.stringify(r) === '{"ok":false,"art":"fehlt"}' && anfragen.length === 0);
}

// ── Entpacken mit eingespeistem Start (läuft überall) ──
console.log('— Entpacken (entpacke): Aufruf von tar.exe, Fehler, Abbruch (eingespeister Start)');
function falscherStart(verhalten: (k: EventEmitter) => void): {
  starte: (befehl: string, args: readonly string[]) => KindProzess;
  aufrufe: Array<{ befehl: string; args: readonly string[] }>;
  getoetet: () => number;
} {
  const aufrufe: Array<{ befehl: string; args: readonly string[] }> = [];
  let getoetet = 0;
  const starte = (befehl: string, args: readonly string[]): KindProzess => {
    aufrufe.push({ befehl, args });
    const k = new EventEmitter() as EventEmitter & { kill(): boolean };
    k.kill = () => {
      getoetet++;
      setImmediate(() => k.emit('close', null));
      return true;
    };
    setImmediate(() => verhalten(k));
    return k;
  };
  return { starte, aufrufe, getoetet: () => getoetet };
}
const WIN = { plattform: 'win32', systemRoot: 'C:\\Windows' };
{
  const f = falscherStart((k) => k.emit('close', 0));
  const ordner = join(tmp, 'aus-1');
  const r = merke(await entpacke({ zip: 'C:\\x\\paket.zip', ordner, signal: sig(), werkzeuge: { ...WIN, starte: f.starte } }));
  ck('Exit 0 → ok', r.ok);
  ck('… genau ein Aufruf: C:\\Windows\\System32\\tar.exe -xf <zip> -C <ordner>',
    f.aufrufe.length === 1 && f.aufrufe[0].befehl === 'C:\\Windows\\System32\\tar.exe'
      && JSON.stringify(f.aufrufe[0].args) === JSON.stringify(['-xf', 'C:\\x\\paket.zip', '-C', ordner]));
  ck('… Zielordner angelegt', existsSync(ordner));
}
{
  const f = falscherStart((k) => k.emit('close', 1));
  const r = merke(await entpacke({ zip: 'p.zip', ordner: join(tmp, 'aus-2'), signal: sig(), werkzeuge: { ...WIN, starte: f.starte } }));
  ck('Exit 1 → entpacken „Exit 1“', JSON.stringify(r) === '{"ok":false,"art":"entpacken","grund":"Exit 1"}');
}
{
  const f = falscherStart((k) => k.emit('error', Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' })));
  const r = merke(await entpacke({ zip: 'p.zip', ordner: join(tmp, 'aus-3'), signal: sig(), werkzeuge: { ...WIN, starte: f.starte } }));
  ck('tar.exe fehlt (error ENOENT) → entpacken „ENOENT“', JSON.stringify(r) === '{"ok":false,"art":"entpacken","grund":"ENOENT"}');
}
{
  const f = falscherStart(() => {}); // läuft, bis er getötet wird
  const ac = new AbortController();
  const lauf = entpacke({ zip: 'p.zip', ordner: join(tmp, 'aus-4'), signal: ac.signal, werkzeuge: { ...WIN, starte: f.starte } });
  setTimeout(() => ac.abort(), 20);
  const r = merke(await lauf);
  ck('Abbruch → Prozess beendet, entpacken „abgebrochen“',
    f.getoetet() === 1 && JSON.stringify(r) === '{"ok":false,"art":"entpacken","grund":"abgebrochen"}');
}
{
  const f = falscherStart((k) => k.emit('close', 0));
  const ac = new AbortController();
  ac.abort();
  const r = merke(await entpacke({ zip: 'p.zip', ordner: join(tmp, 'aus-5'), signal: ac.signal, werkzeuge: { ...WIN, starte: f.starte } }));
  ck('schon abgebrochen → entpacken „abgebrochen“, kein Start', f.aufrufe.length === 0 && !r.ok && r.art === 'entpacken' && r.grund === 'abgebrochen');
}
{
  const f = falscherStart((k) => k.emit('close', 0));
  const r = merke(await entpacke({ zip: 'p.zip', ordner: join(tmp, 'aus-6'), signal: sig(), werkzeuge: { plattform: 'linux', starte: f.starte } }));
  ck('nicht Windows → entpacken „nur Windows“, kein Start',
    f.aufrufe.length === 0 && JSON.stringify(r) === '{"ok":false,"art":"entpacken","grund":"nur Windows"}');
}
{
  const f = falscherStart((k) => k.emit('close', 0));
  const r = merke(await entpacke({ zip: 'p.zip', ordner: join(tmp, 'aus-7'), signal: sig(), werkzeuge: { plattform: 'win32', systemRoot: undefined, starte: f.starte } }));
  ck('ohne SystemRoot → entpacken „SystemRoot fehlt“, kein Start', f.aufrufe.length === 0 && !r.ok && r.art === 'entpacken' && r.grund === 'SystemRoot fehlt');
}
{
  const r = merke(await entpacke({
    zip: 'p.zip', ordner: join(tmp, 'aus-8'), signal: sig(),
    werkzeuge: { ...WIN, starte: () => { throw Object.assign(new Error('EPERM'), { code: 'EPERM' }); } },
  }));
  ck('Start wirft → entpacken mit Code', JSON.stringify(r) === '{"ok":false,"art":"entpacken","grund":"EPERM"}');
}
{
  // Echter Start, aber SystemRoot zeigt ins Leere: tar.exe fehlt wirklich. Läuft auf jeder Plattform.
  const r = merke(await entpacke({ zip: join(tmp, 'egal.zip'), ordner: join(tmp, 'aus-9'), signal: sig(), werkzeuge: { plattform: 'win32', systemRoot: join(tmp, 'kein-windows') } }));
  ck('fehlendes tar.exe (echter Start) → entpacken „ENOENT“', !r.ok && r.art === 'entpacken' && r.grund === 'ENOENT');
}

// ── Entpacken mit dem echten tar.exe (nur Windows) ──
console.log('— Entpacken mit dem echten tar.exe (nur Windows)');
if (process.platform === 'win32') {
  const quelle = join(tmp, 'tar-quelle');
  mkdirSync(join(quelle, 'language'), { recursive: true });
  writeFileSync(join(quelle, 'sdk.dll'), 'MZ-probe');
  writeFileSync(join(quelle, 'language', 'de.txt'), 'hallo');
  const zip = join(tmp, 'mini.zip');
  const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
  const pack = spawnSync(tar, ['-a', '-cf', zip, '-C', quelle, 'sdk.dll', 'language'], { windowsHide: true });
  ck('Vorbereitung: Test-ZIP mit tar.exe -a gebaut', pack.status === 0 && existsSync(zip));
  const aus = join(tmp, 'tar-aus');
  const r = merke(await entpacke({ zip, ordner: aus, signal: sig() }));
  ck('echtes tar.exe: Erfolg, Dateien samt Unterordner da',
    r.ok && readFileSync(join(aus, 'sdk.dll'), 'utf8') === 'MZ-probe' && readFileSync(join(aus, 'language', 'de.txt'), 'utf8') === 'hallo');
  const kaputt = join(tmp, 'kaputt.zip');
  writeFileSync(kaputt, Buffer.alloc(500, 7));
  const r2 = merke(await entpacke({ zip: kaputt, ordner: join(tmp, 'tar-aus-2'), signal: sig() }));
  ck('echtes tar.exe: kaputtes ZIP → entpacken „Exit …“', !r2.ok && r2.art === 'entpacken' && r2.grund.startsWith('Exit '));
} else {
  ueberspringe('Vorbereitung: Test-ZIP mit tar.exe -a gebaut');
  ueberspringe('echtes tar.exe: Erfolg, Dateien samt Unterordner da');
  ueberspringe('echtes tar.exe: kaputtes ZIP → entpacken „Exit …“');
}

// ── Texte, Codes, Dienste ──
console.log('— Zuordnung Fehlerart → Text (Spec 5), Codes, Platz');
const ZUORDNUNG: Array<[LadeFehler, string]> = [
  [{ ok: false, art: 'schluessel' }, KT.S12],
  [{ ok: false, art: 'gedrosselt', sekunden: 125 }, KT.S13(125)],
  [{ ok: false, art: 'proxy', grund: 'ENOTFOUND' }, KT.S14('ENOTFOUND')],
  [{ ok: false, art: 'fehlt' }, KT.S15],
  [{ ok: false, art: 'unvollstaendig', grund: 'UND_ERR_SOCKET' }, KT.S16('UND_ERR_SOCKET')],
  [{ ok: false, art: 'pruefsumme' }, KT.S16b],
  [{ ok: false, art: 'entpacken', grund: 'Exit 1' }, KT.S16c('Exit 1')],
  [{ ok: false, art: 'abgebrochen' }, KT.S17],
];
for (const [f, soll] of ZUORDNUNG) ck(`${f.art} → ${soll.slice(0, 40)} …`, ladeFehlerText(f) === soll);
ck('fehlerCode: cause.code vor code vor name, sonst „unbekannt“',
  fehlerCode(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } })) === 'ENOTFOUND'
    && fehlerCode(Object.assign(new Error('x'), { code: 'EPERM' })) === 'EPERM'
    && fehlerCode(new TypeError('x')) === 'TypeError' && fehlerCode(null) === 'unbekannt' && fehlerCode('text') === 'unbekannt');
{
  // Freier Platz ändert sich zwischen zwei Messungen (andere Prozesse schreiben): darum die Frage „wo?“ mit
  // eingespeistem statfs prüfen und die echte Messung nur auf „> 0“.
  let gefragt: string | undefined;
  const bytes = await freierPlatz(join(tmp, 'gibt', 'es', 'nicht'), {
    statfs: async (pfad) => {
      gefragt = pfad;
      return { bavail: 10, bsize: 4096 };
    },
  });
  ck('freierPlatz: gemessen am nächsten existierenden Vorfahren, bavail × bsize', gefragt === tmp && bytes === 40_960);
  ck('SDK_LADEN_DIENSTE.freierPlatz misst echt (> 0)', (await SDK_LADEN_DIENSTE.freierPlatz(join(tmp, 'gibt', 'es', 'nicht'))) > 0);
  const weg = join(tmp, 'weg');
  mkdirSync(join(weg, 'unter'), { recursive: true });
  writeFileSync(join(weg, 'unter', 'x'), 'x');
  SDK_LADEN_DIENSTE.loesche(weg);
  SDK_LADEN_DIENSTE.loesche(weg); // fehlt schon: kein Fehler
  ck('loesche: Ordner samt Inhalt weg, fehlender Ordner ist kein Fehler', !existsSync(weg));
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
{
  const alles = JSON.stringify(fehlerErgebnisse);
  ck('kein Fehler-Ergebnis trägt Schlüssel, Link oder Server-Adresse',
    fehlerErgebnisse.length > 20 && !alles.includes('sdk-test') && !alles.includes('127.0.0.1') && !alles.includes('/paket/'));
}
server.closeAllConnections();
await new Promise<void>((r) => server.close(() => r()));
try {
  rmSync(tmp, { recursive: true, force: true });
} catch {
  // Windows: eine Datei ist noch offen — der Temp-Ordner bleibt liegen, der Test nicht hängen.
}
console.log(`\n${pass} ok, ${fail} fehlgeschlagen, ${skip} übersprungen.`);
process.exit(fail === 0 ? 0 : 1);
