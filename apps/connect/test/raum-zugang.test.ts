// Cloud-Raum mit Freigabe (Anmeldung Teil 2, Task 12): Raum-ID auffüllen (N4), Zugang beim Öffnen/Schließen, Statuszeile statt Key-Feld.
// room.ts braucht Electron, das Log und die Hülle des Halters; alles drei wird per Modul-Hook ersetzt. npm run selftest -w @jm/connect
import { registerHooks } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ConnectZweck, ZugangsLage, ZugangsWahl } from '../src/main/zugang/regeln';

interface Aufruf { zweck: ConnectZweck; ziel?: string; w?: ZugangsWahl; status?: number; code?: string | null }
interface Halter {
  wahl: ZugangsWahl;
  zugaenge: Aufruf[];
  antworten: Aufruf[];
  zugang(zweck: ConnectZweck, ziel: string): Promise<ZugangsWahl>;
  antwort(zweck: ConnectZweck, w: ZugangsWahl, status: number, code: string | null): void;
  lage(zweck: ConnectZweck): ZugangsLage;
}
const g = globalThis as unknown as { __halter: Halter; __userData: string };
g.__userData = mkdtempSync(join(tmpdir(), 'jmc-raum-'));
const LAGE: ZugangsLage = { wahl: 'keiner', konto: null, bis: null, letzterGrund: 'niemand-angemeldet', detail: null, altHerkunft: 'none', altAbgelehnt: false, versucht: true, geloescht: false };
const halter: Halter = {
  wahl: { art: 'keiner' },
  zugaenge: [],
  antworten: [],
  async zugang(zweck, ziel) { this.zugaenge.push({ zweck, ziel }); return this.wahl; },
  antwort(zweck, w, status, code) { this.antworten.push({ zweck, w, status, code }); },
  lage: () => LAGE,
};
g.__halter = halter;

const ELECTRON = `
export const app = { getPath: () => globalThis.__userData };
export const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (s) => Buffer.from('E:' + s),
  decryptString: (b) => b.toString().slice(2),
};`;
const LOG = `const n = () => {};
export const getLog = () => ({ error: n, warn: n, info: n });`;
const HUELLE = `export const zugangsHalter = () => globalThis.__halter;
export const beiZugangsAenderung = () => {};`;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'electron') return { url: 'mock:electron', shortCircuit: true };
    if (spec === '@jm/app-runtime') return { url: 'mock:app-runtime', shortCircuit: true };
    if (/zugang\/huelle$/.test(spec)) return { url: 'mock:huelle', shortCircuit: true };
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (url === 'mock:electron') return { format: 'module', source: ELECTRON, shortCircuit: true };
    if (url === 'mock:app-runtime') return { format: 'module', source: LOG, shortCircuit: true };
    if (url === 'mock:huelle') return { format: 'module', source: HUELLE, shortCircuit: true };
    return next(url, ctx);
  },
});

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const read = (p: string): string => readFileSync(join(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');

const { raumId } = await import('../src/main/raum-id');
const { roomFor } = await import('../src/main/show-open');
const room = await import('../src/main/room');
const { ZUGANG_TEXT, grundText } = await import('../src/main/zugang/regeln');

const sha6 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 6);
ck('T12 N4: raumId: show → show- und 6 Hex, stabil; cop31 → cop31-…; abcdef und 64 Zeichen unverändert; 70 → 64; ä-x → -x- und 6 Hex; leer bleibt leer; zwei kurze Namen verschieden; jede Ausgabe passt auf ID_RE',
  /^show-[0-9a-f]{6}$/.test(raumId('show')) && raumId('show') === raumId('show') && /^cop31-[0-9a-f]{6}$/.test(raumId('cop31'))
    && raumId('abcdef') === 'abcdef' && raumId('a'.repeat(64)) === 'a'.repeat(64) && raumId('b'.repeat(70)) === 'b'.repeat(64)
    && raumId('ä-x') === '-x-' + sha6('-x') && raumId('') === '' && raumId('show') !== raumId('cop31')
    && ['show', 'cop31', 'a', 'abcdef', '-x'].every((r) => /^[A-Za-z0-9_-]{6,64}$/.test(raumId(r))));
ck('T12 N4: Show „Show“ ohne Raum-Einstellung → raumId(„show“); explizite Raum-ID „ab“ → raumId(„ab“)',
  roomFor({ name: 'Show', tools: [] }) === raumId('show') && roomFor({ name: 'X Y Z', tools: [{ appId: 'jm-connect', settings: { room: 'ab' } }] }) === raumId('ab'));

// ── fetch-Attrappe: merkt URL, Methode, Kopfzeilen; Antwort steuerbar ──
interface Anfrage { url: string; method: string; headers: Record<string, string> }
const anfragen: Anfrage[] = [];
let antwortStatus = 200;
let antwortBody: unknown = {};
globalThis.fetch = (async (url: string, init?: { method?: string; headers?: Record<string, string> }) => {
  anfragen.push({ url: String(url), method: init?.method ?? 'GET', headers: { ...(init?.headers ?? {}) } });
  return new Response(JSON.stringify(antwortBody), { status: antwortStatus, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;
const zuruecksetzen = (): void => { anfragen.length = 0; halter.zugaenge.length = 0; halter.antworten.length = 0; antwortStatus = 200; antwortBody = {}; };
const fehlerVon = async (p: Promise<unknown>): Promise<string | null> => { try { await p; return null; } catch (e) { return (e as Error).message; } };
const FREIGABE: ZugangsWahl = { art: 'freigabe', f: { zweck: 'connect-raum', token: 'jm1.test-freigabe', bis: Date.now() + 3_600_000, ziel: raumId('show'), konto: { name: 'Test Person', stufe: 'kollege' } } };

zuruecksetzen();
halter.wahl = FREIGABE;
const sitzung = await room.openRoom('show');
const id = raumId('show');
ck('T12 9.1: Raum öffnen mit Freigabe → POST /connect/‹id› mit Bearer, ohne X-Proxy-Key; Ziel der Freigabe = aufgefüllte ID',
  anfragen.length === 1 && anfragen[0].method === 'POST' && anfragen[0].url.endsWith(`/connect/${id}`)
    && anfragen[0].headers['Authorization'] === 'Bearer jm1.test-freigabe' && !('X-Proxy-Key' in anfragen[0].headers)
    && halter.zugaenge.length === 1 && halter.zugaenge[0].zweck === 'connect-raum' && halter.zugaenge[0].ziel === id && sitzung.room === id);
zuruecksetzen();
await room.closeRoom();
ck('T12: Raum schließen schickt DELETE mit demselben Zugang für den offenen Raum',
  anfragen.length === 1 && anfragen[0].method === 'DELETE' && anfragen[0].url.endsWith(`/connect/${id}`)
    && anfragen[0].headers['Authorization'] === 'Bearer jm1.test-freigabe' && halter.zugaenge.length === 1 && halter.zugaenge[0].ziel === id);

zuruecksetzen();
halter.wahl = { art: 'alter-key', key: 'test-alter-key' };
await room.openRoom('show');
ck('T12 OT10: ohne Freigabe, mit altem Key → X-Proxy-Key', anfragen.length === 1 && anfragen[0].headers['X-Proxy-Key'] === 'test-alter-key' && !('Authorization' in anfragen[0].headers));
await room.closeRoom();
zuruecksetzen();
halter.wahl = { art: 'keiner' };
const keiner = await fehlerVon(room.openRoom('show'));
ck('T12 OT10: ohne beides → Fehler CZ7 mit Grundtext, keine Anfrage',
  keiner === ZUGANG_TEXT.raumNicht(grundText('connect-raum', 'niemand-angemeldet', null)) && anfragen.length === 0);

zuruecksetzen();
halter.wahl = FREIGABE;
antwortStatus = 403; antwortBody = { code: 'raum-vergeben' };
const vergeben = await fehlerVon(room.openRoom('show'));
ck('T12 RF5: 403 raum-vergeben → Fehler CZ8 wörtlich; halter.antwort mit 403 und raum-vergeben',
  vergeben === ZUGANG_TEXT.raumVergeben && halter.antworten.length === 1 && halter.antworten[0].status === 403
    && halter.antworten[0].code === 'raum-vergeben' && halter.antworten[0].w === FREIGABE && halter.antworten[0].zweck === 'connect-raum');

zuruecksetzen();
halter.wahl = FREIGABE;
antwortStatus = 401; antwortBody = { code: 'freigabe-ungueltig' };
const abgelehnt = await fehlerVon(room.openRoom('show'));
ck('T12 QR5: 401 auf eine Freigabe → Fehler CZ9, halter.antwort mit 401',
  abgelehnt === ZUGANG_TEXT.raumFreigabeAbgelehnt && halter.antworten.length === 1 && halter.antworten[0].status === 401 && halter.antworten[0].code === 'freigabe-ungueltig');

zuruecksetzen();
halter.wahl = FREIGABE;
antwortStatus = 500;
const fehler500 = await fehlerVon(room.openRoom('show'));
ck('T12: anderer Fehler → „Raum öffnen fehlgeschlagen (Proxy 500).“, keine Antwort an den Halter', fehler500 === 'Raum öffnen fehlgeschlagen (Proxy 500).' && halter.antworten.length === 0);

ck('T12: isConfigured = Adresse vorhanden', room.isConfigured() === true);

const ipc = read('src/main/ipc.ts');
const app = read('src/renderer/src/App.tsx');
ck('T12 Spec 166, E7: ipc.ts nimmt keinen neuen Proxy-Key an; App.tsx hat kein Feld „Proxy-Key“ und zeigt status.cloudZugang.text',
  /if \(p\?\.key === ''\) setProxyKey\(''\)/.test(ipc) && !app.includes('>Proxy-Key</label>') && app.includes('{status?.cloudZugang.text}'));
ck('T12: der Rückruf beiZugangsAenderung fängt Fehler (wirft nie in den Halter)', /beiZugangsAenderung\(\(\) => \{\s*try \{\s*pushStatus\(\);\s*\} catch/.test(ipc));

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail ? 1 : 0);
