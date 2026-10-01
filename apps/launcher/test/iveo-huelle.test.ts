// iveo-Hülle des Launchers OHNE Electron (tsx): npm run selftest:iveo -w @jm/launcher
// Master-Link Teil 2a: Takt und Zeitgrenze (Spec 7.0), offene Show erkennen (7.5),
// Statuszeile im iveo-Panel (7.6). Der Rest der Hülle ist Electron-Verdrahtung und
// wird im Durchgang mit gebauten Programmen geprüft (Spec 9.8, apps/rundown/test/e2e-teil2a.mjs).
import { createServer, type AddressInfo } from 'node:http';
import { IveoClient, type IveoFetchResponse } from '@jm/iveo';
import {
  abfrageTakt, gleicherShowPfad, IVEO_ABFRAGE_TAKT_MS, IVEO_ABRUF_ZEITGRENZE_MS, mitZeitgrenze, type FetchMitSignal,
} from '../src/main/iveo-huelle-hilfen';
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

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
