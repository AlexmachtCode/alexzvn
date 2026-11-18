// #317 Gast-Klicker: reine Helfer (shared) + Verbindungs-Client im Main gegen einen echten ws-Server als Stand-in
// für den Cloud-Dienst. present.ts, windows.ts, Electron und Logger sind Attrappen; die Einstellungsdatei ist echt
// (Testordner als userData).
// npm run selftest -w @jm/presenter
import { registerHooks } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocketServer, type WebSocket as WsSocket } from 'ws';
import type { GastKlickerStatus } from '../src/shared/gast-klicker';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const warte = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
async function bis(fn: () => boolean, ms = 4000): Promise<boolean> {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    if (fn()) return true;
    await warte(20);
  }
  return fn();
}

// ---------------------------------------------------------------- reine Helfer
const sh = await import('../src/shared/gast-klicker');

ck('Basis-URL', sh.GAST_KLICKER_BASIS === 'https://jm-gast-klicker.jm-production-suite.workers.dev');
ck('coerce kaputt → null', JSON.stringify(sh.coerceGastKlickerConfig({ an: true, raum: 'ABC', geheimnis: 'x' })) === '{"an":true,"raum":null,"geheimnis":null}');
ck('coerce gültig bleibt', JSON.stringify(sh.coerceGastKlickerConfig({ an: false, raum: 'abcdefghij12', geheimnis: 'f'.repeat(64) })) === JSON.stringify({ an: false, raum: 'abcdefghij12', geheimnis: 'f'.repeat(64) }));
ck('coerce Müll → aus', JSON.stringify(sh.coerceGastKlickerConfig('quatsch')) === '{"an":false,"raum":null,"geheimnis":null}');
ck('Basis ftp → Vorgabe', sh.basisAusUmgebung('ftp://x') === sh.GAST_KLICKER_BASIS);
ck('Basis leer → Vorgabe', sh.basisAusUmgebung(undefined) === sh.GAST_KLICKER_BASIS && sh.basisAusUmgebung('') === sh.GAST_KLICKER_BASIS);
ck('Basis http lokal ohne Schrägstrich', sh.basisAusUmgebung('http://127.0.0.1:9/') === 'http://127.0.0.1:9');
ck('Basis mit Pfad → Vorgabe', sh.basisAusUmgebung('https://a.b/pfad') === sh.GAST_KLICKER_BASIS);
ck('gastLink', sh.gastLink('https://a.b', 'abcdefghij12') === 'https://a.b/k/abcdefghij12');
ck('presenterWsUrl https → wss', sh.presenterWsUrl('https://a.b', 'abcdefghij12') === 'wss://a.b/h/abcdefghij12/ws');
ck('presenterWsUrl http → ws', sh.presenterWsUrl('http://127.0.0.1:9', 'abcdefghij12') === 'ws://127.0.0.1:9/h/abcdefghij12/ws');
ck('chatText', sh.chatText('https://x/k/abc') === 'Advance your slides yourself / Folien selbst weiterschalten: https://x/k/abc');
ck('fuehreAus next', sh.fuehreAus({ aktiv: true, pausiert: false }, 'next') === 'next');
ck('fuehreAus prev', sh.fuehreAus({ aktiv: true, pausiert: false }, 'prev') === 'prev');
ck('fuehreAus pausiert → null', sh.fuehreAus({ aktiv: true, pausiert: true }, 'next') === null);
ck('fuehreAus inaktiv → null', sh.fuehreAus({ aktiv: false, pausiert: false }, 'next') === null);
ck('fuehreAus goto → null', sh.fuehreAus({ aktiv: true, pausiert: false }, 'goto') === null);
ck('wartezeitMs(0, 0.5) = 1000', sh.wartezeitMs(0, 0.5) === 1000);
ck('wartezeitMs(1, 0.5) = 2000', sh.wartezeitMs(1, 0.5) === 2000);
ck('wartezeitMs(10, 0.5) = 30000', sh.wartezeitMs(10, 0.5) === 30000);
ck('wartezeitMs(10, 0.99) ≤ 30000', sh.wartezeitMs(10, 0.99) <= 30000);
ck('wartezeitMs(0, 0) = 800', sh.wartezeitMs(0, 0) === 800);

// Anzeigetexte (Fernsteuerungs-Abschnitt, Pille in der Referentenansicht)
const S = (o: Partial<GastKlickerStatus>): GastKlickerStatus => ({ an: true, lage: 'verbunden', link: 'https://x/k/abcdefghij12', gaeste: 0, pausiert: false, ...o });
ck('pillenText aus → null', sh.pillenText(S({ an: false, lage: 'aus' })) === null);
ck('pillenText verbunden', sh.pillenText(S({})) === 'Gast-Klick ●');
ck('pillenText pausiert', sh.pillenText(S({ pausiert: true })) === 'Gast-Klick pausiert');
ck('pillenText getrennt', sh.pillenText(S({ lage: 'getrennt' })) === 'Gast-Klick getrennt');
ck('pillenText verbindet = getrennt', sh.pillenText(S({ lage: 'verbindet' })) === 'Gast-Klick getrennt');
ck('pillenText abgelehnt = getrennt', sh.pillenText(S({ lage: 'abgelehnt' })) === 'Gast-Klick getrennt');
ck('statusText 2 Gäste', sh.statusText(S({ gaeste: 2 })) === 'verbunden · 2 Gäste');
ck('statusText 1 Gast', sh.statusText(S({ gaeste: 1 })) === 'verbunden · 1 Gast');
ck('statusText 0 Gäste', sh.statusText(S({ gaeste: 0 })) === 'verbunden · 0 Gäste');
ck('statusText verbindet', sh.statusText(S({ lage: 'verbindet' })) === 'verbindet …');
ck('statusText getrennt', sh.statusText(S({ lage: 'getrennt' })) === 'getrennt – verbindet neu');
ck('statusText abgelehnt nennt Neuer Link', sh.statusText(S({ lage: 'abgelehnt' })).includes('Neuer Link'));
ck('statusText aus', sh.statusText(S({ an: false, lage: 'aus' })) === 'aus');

// ---------------------------------------------------------------- Attrappen
type PState = { active: boolean; index: number; total: number; screen: 'live' | 'black' | 'white' };
const g = globalThis as unknown as {
  __p: { cbs: Set<() => void>; state: PState; nexts: number; prevs: number };
  __win: { erfasst: number; bild: Buffer | null };
  __log: string[];
  __userData: string;
};
g.__p = { cbs: new Set(), state: { active: false, index: 0, total: 0, screen: 'live' }, nexts: 0, prevs: 0 };
g.__win = { erfasst: 0, bild: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000)]) };
g.__log = [];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jmpr-gk-'));
g.__userData = dir;
const aendere = (s: Partial<PState>): void => {
  g.__p.state = { ...g.__p.state, ...s };
  for (const cb of g.__p.cbs) cb();
};

const QUELLEN: Record<string, string> = {
  'mock:present': `const p = globalThis.__p;
export function subscribe(cb) { p.cbs.add(cb); return () => p.cbs.delete(cb); }
export function getState() { return p.state; }
export function next() { p.nexts++; }
export function prev() { p.prevs++; }`,
  'mock:windows': `export async function captureVorschau() { globalThis.__win.erfasst++; return globalThis.__win.bild; }`,
  'mock:electron': `export const app = { getPath: () => globalThis.__userData };`,
  'mock:runtime': `const l = (...a) => globalThis.__log.push(a.join(' '));
export function getLog() { return { info: l, warn: l, error: l }; }`,
};
const ZIELE: Record<string, string> = {
  './present': 'mock:present',
  './windows': 'mock:windows',
  electron: 'mock:electron',
  '@jm/app-runtime': 'mock:runtime',
};
registerHooks({
  resolve(spec, ctx, next) {
    const z = ZIELE[spec];
    if (z) return { url: z, shortCircuit: true };
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    const q = QUELLEN[url];
    if (q) return { format: 'module', source: q, shortCircuit: true };
    return next(url, ctx);
  },
});

// ---------------------------------------------------------------- Stand-in-Dienst
type Verb = { ws: WsSocket; raum: string; auth: string | undefined; nachrichten: (string | Buffer)[] };
const verbindungen: Verb[] = [];
let antwort: 'ok' | 'abgelehnt' = 'ok';
let server: WebSocketServer | null = null;
let port = 0;
function starteServer(p: number): Promise<void> {
  return new Promise((res) => {
    const s = new WebSocketServer({ host: '127.0.0.1', port: p }, () => {
      port = (s.address() as { port: number }).port;
      res();
    });
    s.on('connection', (ws, req) => {
      const m = /^\/h\/([a-z0-9]{12})\/ws$/.exec(req.url ?? '');
      const v: Verb = { ws, raum: m?.[1] ?? '', auth: req.headers.authorization, nachrichten: [] };
      verbindungen.push(v);
      ws.on('message', (d, bin) => {
        const daten = d as Buffer;
        v.nachrichten.push(bin ? daten : daten.toString());
        if (bin) return;
        const o = JSON.parse(daten.toString()) as { t: string };
        if (o.t === 'hallo') {
          ws.send(JSON.stringify({ t: antwort }));
          if (antwort === 'abgelehnt') ws.close(4403);
        }
      });
    });
    server = s;
  });
}
function stoppeServer(): Promise<void> {
  return new Promise((res) => {
    if (!server) return res();
    for (const c of server.clients) c.terminate();
    server.close(() => res());
    server = null;
  });
}
const json = (v: Verb | undefined): { t: string; [k: string]: unknown }[] =>
  (v?.nachrichten ?? []).filter((x): x is string => typeof x === 'string').map((x) => JSON.parse(x));
const binaer = (v: Verb | undefined): Buffer[] => (v?.nachrichten ?? []).filter((x): x is Buffer => typeof x !== 'string');
const letzteV = (): Verb | undefined => verbindungen.at(-1);
const sende = (v: Verb | undefined, o: unknown): void => v?.ws.send(JSON.stringify(o));

await starteServer(0);
process.env.JMPR_GAST_KLICKER_URL = `http://127.0.0.1:${port}`;

// ---------------------------------------------------------------- Client
const gk = await import('../src/main/gast-klicker');
const meldungen: GastKlickerStatus[] = [];
gk.setGastKlickerStatusHandler((s) => meldungen.push(s));
const st = (): GastKlickerStatus => gk.getGastKlickerStatus();

ck('raumAusGeheimnis Vektor a (wie Worker)', gk.raumAusGeheimnis('a'.repeat(64)) === '530qlojw1124');
ck('raumAusGeheimnis Vektor b (wie Worker)', gk.raumAusGeheimnis('b'.repeat(64)) === 'vhy6gurjrplw');

const start = gk.initGastKlicker();
ck('Start ohne Einstellungen: aus', start.an === false && start.lage === 'aus' && start.link === null);

gk.applyGastKlicker(true);
ck('einschalten → verbindet', st().lage === 'verbindet' || st().lage === 'verbunden');
await bis(() => json(letzteV()).length > 0);
const erste = json(letzteV())[0] as { t: string; geheimnis?: string };
ck('verbindet und sendet hallo mit Geheimnis als erste Nachricht', erste?.t === 'hallo' && /^[a-f0-9]{64}$/.test(erste.geheimnis ?? ''));
ck('Raum der URL passt zum Geheimnis', letzteV()?.raum === gk.raumAusGeheimnis(erste.geheimnis ?? ''));
ck('Geheimnis im Authorization-Header beim Verbindungsaufbau', letzteV()?.auth === `Bearer ${erste.geheimnis}`);
ck('Link zeigt auf /k/<raum>', st().link === `http://127.0.0.1:${port}/k/${letzteV()?.raum}`);
await bis(() => st().lage === 'verbunden');
ck('nach ok: Lage verbunden', st().lage === 'verbunden');
await bis(() => json(letzteV()).some((m) => m.t === 'stand'));
ck('nach ok: Stand gesendet', json(letzteV()).some((m) => m.t === 'stand' && m.aktiv === false && m.pausiert === false));

sende(letzteV(), { t: 'cmd', dir: 'next' });
await warte(150);
ck('inaktiv → kein next()', g.__p.nexts === 0);

aendere({ active: true, index: 0, total: 3 });
await bis(() => json(letzteV()).some((m) => m.t === 'stand' && m.aktiv === true && m.total === 3));
ck('Änderung → Stand mit aktiv/total', json(letzteV()).some((m) => m.t === 'stand' && m.aktiv === true && m.total === 3 && m.screen === 'live'));
await bis(() => binaer(letzteV()).length > 0, 2000);
const bild = binaer(letzteV())[0];
ck('Folienwechsel → nach ~300 ms ein Binärbild (FF D8)', bild !== undefined && bild[0] === 0xff && bild[1] === 0xd8);
const erfasstNachErstem = g.__win.erfasst;

sende(letzteV(), { t: 'cmd', dir: 'next' });
await bis(() => g.__p.nexts === 1);
ck('cmd next bei aktiver Präsentation → next() einmal', g.__p.nexts === 1);
ck('Log-Zeile je Gast-Klick', g.__log.some((z) => z.includes('[gast-klicker] next')));
sende(letzteV(), { t: 'cmd', dir: 'prev' });
await bis(() => g.__p.prevs === 1);
ck('cmd prev → prev()', g.__p.prevs === 1);
sende(letzteV(), { t: 'cmd', dir: 'goto' });
await warte(100);
ck('cmd goto ignoriert', g.__p.nexts === 1 && g.__p.prevs === 1);

gk.setzeGastPause(true);
await bis(() => json(letzteV()).some((m) => m.t === 'stand' && m.pausiert === true));
ck('Pause → Stand mit pausiert gesendet', json(letzteV()).some((m) => m.t === 'stand' && m.pausiert === true));
ck('Status pausiert', st().pausiert === true);
sende(letzteV(), { t: 'cmd', dir: 'next' });
await warte(150);
ck('pausiert → kein next()', g.__p.nexts === 1);
gk.setzeGastPause(false);

aendere({});
await warte(450);
ck('gleicher Stand → kein neues Bild', g.__win.erfasst === erfasstNachErstem);
aendere({ index: 1 });
aendere({ index: 2 });
await warte(450);
ck('schnelle Folge → ein Bild für den letzten Stand', g.__win.erfasst === erfasstNachErstem + 1);
sende(letzteV(), { t: 'bildBitte' });
await bis(() => g.__win.erfasst === erfasstNachErstem + 2);
ck('bildBitte → Bild sofort, auch bei gleichem Stand', g.__win.erfasst === erfasstNachErstem + 2);

sende(letzteV(), { t: 'gaeste', n: 3 });
await bis(() => st().gaeste === 3);
ck('gaeste 3 → Status gaeste 3', st().gaeste === 3 && meldungen.at(-1)?.gaeste === 3);

const geheimnisVorher = erste.geheimnis;
const anzahlVorher = verbindungen.length;
await stoppeServer();
await bis(() => st().lage === 'getrennt');
ck('Dienst weg → Lage getrennt', st().lage === 'getrennt');
ck('Dienst weg → Gäste 0', st().gaeste === 0);
await starteServer(port);
await bis(() => st().lage === 'verbunden', 6000);
ck('Dienst wieder da → wieder verbunden', st().lage === 'verbunden');
ck('Neuverbindung schickt hallo mit gleichem Geheimnis', verbindungen.length > anzahlVorher && json(letzteV())[0]?.geheimnis === geheimnisVorher);

const datei = path.join(dir, 'gast-klicker.json');
const gespeichert = JSON.parse(fs.readFileSync(datei, 'utf8')) as Record<string, unknown>;
ck('Einstellungen gespeichert: an/raum/geheimnis, kein pausiert', gespeichert.an === true && gespeichert.geheimnis === geheimnisVorher && gespeichert.raum === letzteV()?.raum && !('pausiert' in gespeichert));

const alteV = letzteV();
const alterRaum = alteV?.raum;
gk.neuerGastLink();
await bis(() => json(alteV).some((m) => m.t === 'schliessen'));
ck('neuerGastLink → schliessen an alten Raum', json(alteV).some((m) => m.t === 'schliessen'));
await bis(() => letzteV() !== alteV && st().lage === 'verbunden');
ck('neuerGastLink → neue Verbindung zu anderem Raum', letzteV() !== alteV && letzteV()?.raum !== alterRaum && st().link?.endsWith(`/k/${letzteV()?.raum}`) === true);
const neu = JSON.parse(fs.readFileSync(datei, 'utf8')) as Record<string, unknown>;
ck('neuerGastLink speichert neues Geheimnis', neu.geheimnis !== geheimnisVorher && neu.raum === letzteV()?.raum);

antwort = 'abgelehnt';
gk.neuerGastLink();
await bis(() => st().lage === 'abgelehnt');
ck('abgelehnt → Lage abgelehnt', st().lage === 'abgelehnt');
const nachAblehnung = verbindungen.length;
await warte(2000);
ck('abgelehnt → keine Neuverbindung binnen 2 s', verbindungen.length === nachAblehnung);
antwort = 'ok';

gk.applyGastKlicker(false);
ck('ausschalten → aus, kein Link', st().lage === 'aus' && st().an === false && st().link === null);
await warte(100);
ck('ausschalten → Verbindung zu', letzteV()?.ws.readyState !== 1);
const ausDatei = JSON.parse(fs.readFileSync(datei, 'utf8')) as Record<string, unknown>;
ck('ausschalten gespeichert, Geheimnis bleibt', ausDatei.an === false && typeof ausDatei.geheimnis === 'string');

gk.applyGastKlicker(true);
await bis(() => st().lage === 'verbunden');
ck('wieder einschalten → gleicher Raum wie gespeichert', letzteV()?.raum === ausDatei.raum);
gk.shutdownGastKlicker();
await warte(100);
ck('shutdown → Verbindung zu', letzteV()?.ws.readyState !== 1);

await stoppeServer();
fs.rmSync(dir, { recursive: true, force: true });
console.log(`gast-klicker: ${pass} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
