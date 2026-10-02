// iveo-Hülle des Launchers OHNE Electron (tsx): npm run selftest:iveo -w @jm/launcher
// Master-Link Teil 2a: Takt und Zeitgrenze (Spec 7.0), offene Show erkennen (7.5),
// Statuszeile im iveo-Panel (7.6). Der Rest der Hülle ist Electron-Verdrahtung und
// wird im Durchgang mit gebauten Programmen geprüft (Spec 9.8, apps/rundown/test/e2e-teil2a.mjs).
import { createServer, type AddressInfo } from 'node:http';
import { IveoApiError, IveoClient, type IveoFetchResponse } from '@jm/iveo';
import { serializeShow, type Show } from '@jm/show';
import {
  abfrageTakt, gleicherShowPfad, IVEO_ABFRAGE_TAKT_MS, IVEO_ABRUF_ZEITGRENZE_MS, mitZeitgrenze, nurBeiWechsel,
  showLeserFuerKern, showSchreiberFuerKern, type FetchMitSignal,
} from '../src/main/iveo-huelle-hilfen';
import { toClientError } from '../src/main/iveo-abgleich-kern';
import { leseShowFuerEditor } from '../src/main/show-lesen';
import { iveoStatusZeile } from '../src/renderer/src/lib/iveo-status';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

console.log('— Abfragetakt (JMPS_IVEO_POLL_MS, Spec 7.0)');
ck('ohne Variable → 45 s', abfrageTakt(undefined) === 45_000);
ck('leer → 45 s', abfrageTakt('') === 45_000);
ck('2000 → 2 s (Durchgang 9.8)', abfrageTakt('2000') === 2000);
ck('2000.7 → 2000', abfrageTakt('2000.7') === 2000);
ck('500 → 500 (kürzester erlaubter Takt)', abfrageTakt('500') === 500);
ck('499 → 45 s (zu kurz, iveo nicht im Dauerfeuer)', abfrageTakt('499') === 45_000);
ck('0 → 45 s', abfrageTakt('0') === 45_000);
ck('60000 → 45 s (die Variable kann nur verkürzen)', abfrageTakt('60000') === 45_000);
ck('abc → 45 s', abfrageTakt('abc') === 45_000);
ck('Betriebstakt ist 45 s', IVEO_ABFRAGE_TAKT_MS === 45_000);
ck('Zeitgrenze je Abruf ist 15 s', IVEO_ABRUF_ZEITGRENZE_MS === 15_000);

console.log('— Zeitgrenze je Abruf (AbortSignal.timeout im fetchImpl)');
{
  let gesehen: Parameters<FetchMitSignal>[1];
  const haengt: FetchMitSignal = (_url, init) => {
    gesehen = init;
    return new Promise<IveoFetchResponse>((_ok, fehler) => {
      init?.signal?.addEventListener('abort', () => fehler(init.signal?.reason));
    });
  };
  // AbortSignal.timeout hält den Prozess nicht wach (unref) — ohne diesen Takt endete
  // node hier, bevor die Zeitgrenze feuert. In Electron läuft die Ereignisschleife ohnehin.
  const wach = setInterval(() => {}, 1000);
  const t0 = Date.now();
  const e = await mitZeitgrenze(haengt, 40)('http://127.0.0.1/x', { headers: { Authorization: 'Bearer t' }, redirect: 'manual' })
    .then(() => null, (x: unknown) => x);
  const dauer = Date.now() - t0;
  clearInterval(wach);
  ck('hängender Abruf bricht nach der Zeitgrenze ab', e !== null && dauer >= 30 && dauer < 2000);
  ck('… mit TimeoutError', (e as Error | null)?.name === 'TimeoutError');
  ck('Kopfzeilen und redirect bleiben erhalten', gesehen?.headers?.Authorization === 'Bearer t' && gesehen?.redirect === 'manual');

  const signale: Array<AbortSignal | undefined> = [];
  const merkt: FetchMitSignal = async (_url, init) => {
    signale.push(init?.signal);
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}), text: async () => '{}', arrayBuffer: async () => new ArrayBuffer(0) };
  };
  const f = mitZeitgrenze(merkt, 1000);
  await f('http://127.0.0.1/a');
  await f('http://127.0.0.1/b');
  ck('jeder Abruf bekommt ein eigenes Signal', signale.length === 2 && !!signale[0] && !!signale[1] && signale[0] !== signale[1]);
}
{
  // Echter fetch gegen einen Server, der nie antwortet (iveo hängt): der Client gibt auf.
  const server = createServer(() => { /* antwortet nie */ });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  const client = new IveoClient({ token: 't', baseUrl: `http://127.0.0.1:${port}/api/v1`, fetchImpl: mitZeitgrenze(fetch, 100), maxRetries: 0 });
  const t0 = Date.now();
  const e = await client.listAgendaItems('ev', 'p1').then(() => null, (x: unknown) => x);
  ck('IveoClient mit echtem fetch: hängender Server → Fehler nach der Zeitgrenze', e !== null && Date.now() - t0 < 3000);
  ck('… im Panel als deutscher Text, nicht als englische Rohmeldung', toClientError(e).error === 'iveo antwortet nicht innerhalb von 15 s');
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
}
{
  // Die Zeitgrenze läuft ab, während der Body liest (HTTP 200 schon da): kein falsches „bad_envelope“.
  const fetchImpl = async (): Promise<IveoFetchResponse> => ({
    ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({}),
    text: () => Promise.reject(new DOMException('The operation was aborted due to timeout', 'TimeoutError')),
    arrayBuffer: async () => new ArrayBuffer(0),
  });
  const client = new IveoClient({ token: 't', baseUrl: 'http://127.0.0.1/api/v1', fetchImpl, maxRetries: 0 });
  const e = await client.listAgendaItems('ev', 'p1').then(() => null, (x: unknown) => x);
  ck('Zeitgrenze beim Lesen des Body → TimeoutError statt bad_envelope', (e as Error | null)?.name === 'TimeoutError');

  // Echter fetch: die Kopfzeilen kommen, der Body hängt.
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.write('{"data":');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  const echt = new IveoClient({ token: 't', baseUrl: `http://127.0.0.1:${port}/api/v1`, fetchImpl: mitZeitgrenze(fetch, 100), maxRetries: 0 });
  const e2 = await echt.listAgendaItems('ev', 'p1').then(() => null, (x: unknown) => x);
  ck('echter fetch, Body hängt → Abbruch durch die Zeitgrenze, kein bad_envelope',
    e2 !== null && !(e2 instanceof IveoApiError) && ['TimeoutError', 'AbortError'].includes((e2 as Error).name));
  ck('… im Panel als deutscher Text', toClientError(e2).error === 'iveo antwortet nicht innerhalb von 15 s');
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
}

console.log('— offene Show erkennen (Spec 7.5)');
ck('gleicher Pfad', gleicherShowPfad('/shows/a.jmshow', '/shows/a.jmshow'));
ck('andere Schreibweise (Windows-Pfad)', gleicherShowPfad('C:\\Shows\\Gala.jmshow', 'c:\\shows\\GALA.jmshow'));
ck('mit .. im Pfad', gleicherShowPfad('/shows/x/../a.jmshow', '/shows/a.jmshow'));
ck('andere Datei', !gleicherShowPfad('/shows/a.jmshow', '/shows/b.jmshow'));

console.log('— Statuszeile im iveo-Panel (Spec 7.6)');
const seit = new Date(2026, 9, 1, 14, 5, 30).toISOString(); // 14:05 Ortszeit
ck('ok → keine Zeile', iveoStatusZeile({ ok: true }) === null);
ck('kein Status → keine Zeile', iveoStatusZeile(null) === null);
ck('401 → Text und Uhrzeit', iveoStatusZeile({ ok: false, text: 'Token ungültig oder widerrufen', seit }) === 'iveo-Abgleich gestört: Token ungültig oder widerrufen (seit 14:05)');
ck('kein Token → Text und Uhrzeit', iveoStatusZeile({ ok: false, text: 'kein iveo-Token auf diesem Rechner, nur Offline-Ablauf', seit }) === 'iveo-Abgleich gestört: kein iveo-Token auf diesem Rechner, nur Offline-Ablauf (seit 14:05)');
ck('ohne seit → ohne Klammer', iveoStatusZeile({ ok: false, text: 'X' }) === 'iveo-Abgleich gestört: X');
ck('unlesbares seit → ohne Klammer', iveoStatusZeile({ ok: false, text: 'X', seit: 'kaputt' }) === 'iveo-Abgleich gestört: X');

console.log('— Log nur beim Wechsel (Spec 7.6: „Gleichbleibende Wiederholungen nicht“)');
{
  const zeilen: string[] = [];
  const w = nurBeiWechsel((m) => zeilen.push(m));
  w.warn('A', 'Warnung A');
  w.warn('A', 'Warnung A');
  w.warn('A', 'Warnung A');
  ck('gleicher Grund dreimal → eine Zeile', zeilen.length === 1 && zeilen[0] === 'Warnung A');
  w.warn('B', 'Warnung B');
  ck('anderer Grund → neue Zeile', zeilen.length === 2 && zeilen[1] === 'Warnung B');
  w.warn('A', 'Warnung A');
  ck('zurück zum ersten Grund → wieder eine Zeile', zeilen.length === 3);
  w.ok();
  w.warn('A', 'Warnung A');
  ck('nach einem Erfolg kommt derselbe Grund wieder ins Log', zeilen.length === 4);
}
{
  // Der Kern liest die Show im Agenda-Modus bei jeder Abfrage, im Listen-Modus nach einem Lesefehler ebenso
  // (lastSyncIso rückt dann nicht vor) — ohne Merker stünde alle 45 s dieselbe Zeile im Log.
  const PFAD = 'C:/Shows/Tag 1.jmshow';
  const fehler = (code: string) => (): string => { throw Object.assign(new Error(`${code}: open '${PFAD}'`), { code }); };
  let antwort: () => string = fehler('ENOENT');
  const zeilen: string[] = [];
  const lies = showLeserFuerKern(() => antwort(), nurBeiWechsel((m) => zeilen.push(m)));
  const r1 = lies(PFAD);
  lies(PFAD);
  lies(PFAD);
  ck('Show fehlt, drei Abfragen → null und EINE Warnung mit dem Code',
    r1 === null && zeilen.length === 1 && zeilen[0] === 'iveo: Show-Datei nicht lesbar (ENOENT).');
  antwort = fehler('EBUSY');
  lies(PFAD);
  lies(PFAD);
  ck('anderer Grund (EBUSY) → eine neue Warnung', zeilen.length === 2 && zeilen[1] === 'iveo: Show-Datei nicht lesbar (EBUSY).');
  antwort = () => serializeShow({ schemaVersion: 1, name: 'Tag 1', tools: [] });
  const r2 = lies(PFAD);
  ck('lesbar → die Show, keine Warnung', r2?.name === 'Tag 1' && zeilen.length === 2);
  antwort = fehler('EBUSY');
  lies(PFAD);
  ck('nach einem Erfolg derselbe Grund → wieder eine Warnung', zeilen.length === 3);
  lies('C:/Shows/Tag 2.jmshow');
  ck('andere Datei, derselbe Grund → eigene Warnung', zeilen.length === 4);
  antwort = () => '{ "name": "geheimer Inhalt"';
  lies(PFAD);
  lies(PFAD);
  ck('kaputtes JSON → eine Warnung „kein gültiges JSON“, ohne Inhalt und ohne Pfad (G6)',
    zeilen.length === 5 && zeilen[4] === 'iveo: Show-Datei nicht lesbar (kein gültiges JSON).'
    && !zeilen.some((z) => z.includes('geheim') || z.includes('Tag 1.jmshow')));
}
{
  // Schreiben für den Kern: bei einer dauerhaften Sperre scheitert jede Abfrage erneut.
  const PFAD = 'C:/Shows/Tag 1.jmshow';
  const show: Show = { schemaVersion: 1, name: 'Tag 1', tools: [] };
  const zeilen: string[] = [];
  let gelingt = false;
  const schreibe = showSchreiberFuerKern((_pfad, _show, log) => {
    if (gelingt) return true;
    log('Show nicht geschrieben (EBUSY nach 5 Versuchen), Original unverändert.');
    return false;
  }, nurBeiWechsel((m) => zeilen.push(m)));
  const e = [schreibe(PFAD, show), schreibe(PFAD, show), schreibe(PFAD, show)];
  ck('Schreiben scheitert bei drei Abfragen → jedes Mal false, EINE Warnung',
    e.every((x) => x === false) && zeilen.length === 1 && zeilen[0] === 'Show nicht geschrieben (EBUSY nach 5 Versuchen), Original unverändert.');
  gelingt = true;
  ck('Schreiben gelingt → true, keine Warnung', schreibe(PFAD, show) === true && zeilen.length === 1);
  gelingt = false;
  schreibe(PFAD, show);
  ck('danach scheitert es wieder → wieder eine Warnung', zeilen.length === 2);
}

console.log('— Show-Editor liest die Datei beim Speichern (Spec 7.5, Regel 1): Fehler nie still');
{
  const PFAD = 'C:/Shows/Tag 1.jmshow';
  const zeilen: string[] = [];
  const warn = (m: string): void => { zeilen.push(m); };
  const fehlt = (): string => { throw Object.assign(new Error(`ENOENT: open '${PFAD}'`), { code: 'ENOENT' }); };
  ck('nicht lesbar (ENOENT) → null und eine Warnung mit dem Code, ohne Pfad',
    leseShowFuerEditor(PFAD, fehlt, warn) === null && zeilen.length === 1 && zeilen[0].includes('ENOENT') && !zeilen[0].includes('Tag 1'));
  ck('kaputtes JSON → null und „kein gültiges JSON“, ohne Inhalt',
    leseShowFuerEditor(PFAD, () => '{ "name": "geheimer Inhalt"', warn) === null && zeilen.length === 2
    && zeilen[1].includes('kein gültiges JSON') && !zeilen[1].includes('geheim'));
  const gut = leseShowFuerEditor(PFAD, () => serializeShow({ schemaVersion: 1, name: 'Tag 1', tools: [] }), warn);
  ck('lesbar → die Show, keine Warnung', gut?.name === 'Tag 1' && zeilen.length === 2);
  let gelesen = false;
  const fremd = leseShowFuerEditor('C:/Shows/notizen.txt', () => { gelesen = true; return '{}'; }, warn);
  ck('keine .jmshow-Datei → null, nicht gelesen, eine Warnung', fremd === null && !gelesen && zeilen.length === 3);
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
