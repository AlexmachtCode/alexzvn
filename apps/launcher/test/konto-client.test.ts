// Anmeldung im Launcher (Teil 1) · P9: Client der Worker-API /konto/* (src/main/konto/worker-client.ts) — gegen den Vertrag
// Gliederung 10.1 mit einer fetch-Attrappe, ohne Netz (tsx). Die Worker-Routen selbst prüft Block C (Task 16).
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  browserAdresseErlaubt, erzeugeKontoClient, gesperrterKontoClient, istWorkerAdresse, KontoFehler, kopfFuer, pruefeServerBasis, redirectFuer,
  standAus, zugangsKopf, type KontoClient,
} from '../src/main/konto/worker-client';
import type { KontoStand } from '../src/shared/konto';
import { pruefeFaelle } from './konto-rechte.test';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

interface Aufruf { url: string; methode: string; kopf: Record<string, string>; body: unknown }
type Antwort = { status: number; json?: unknown; roh?: string } | { wirft: Error } | { haengt: true };

/** fetch-Attrappe: merkt jeden Aufruf (Kopfzeilen klein geschrieben), antwortet aus einer Funktion. */
function attrappe(antwort: (a: Aufruf) => Antwort): { fetch: typeof fetch; aufrufe: Aufruf[] } {
  const aufrufe: Aufruf[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    const kopf: Record<string, string> = {};
    for (const [k, v] of Object.entries((init?.headers ?? {}) as Record<string, string>)) kopf[k.toLowerCase()] = v;
    const a: Aufruf = { url: String(url), methode: init?.method ?? 'GET', kopf, body: init?.body ? JSON.parse(String(init.body)) : undefined };
    aufrufe.push(a);
    const r = antwort(a);
    if ('wirft' in r) throw r.wirft;
    if ('haengt' in r) {
      // Der Zeitgeber von AbortSignal.timeout hält den Prozess nicht am Leben; dieser hier schon (höchstens 5 s).
      return new Promise<Response>((_, nein) => {
        const halte = setTimeout(() => nein(new Error('Attrappe: kein Abbruch')), 5000);
        init?.signal?.addEventListener('abort', () => { clearTimeout(halte); nein(init.signal?.reason); });
      });
    }
    return new Response(r.roh ?? JSON.stringify(r.json ?? {}), { status: r.status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { fetch: f, aufrufe };
}

const BASIS = 'https://worker.test/';
const S = 'jm1.test.eins';
const STAND: KontoStand = {
  kid: 'k1', email: 'maria@jakobsmedien.com', name: 'Maria Schmidt', art: 'google', stufe: 'kollege', tools: [], events: [],
  zoom: true, zoomBis: null, jm: true, plattform: 'win', gid: 'g1', iat: 1, exp: 2, kontoBis: null, angemeldetSeit: 1,
};
const BEWEIS = { gid: 'g1', ts: 5, sig: 'sig' };
const ANFRAGE = { id: 'a1', zustand: 'offen' as const, zweck: 'Messe', von: 10, bis: 20, am: 5 };

async function fehlerVon(p: Promise<unknown>): Promise<KontoFehler | null> {
  try { await p; return null; } catch (e) { return e instanceof KontoFehler ? e : null; }
}

// --- P9 10.1: jede Methode mit Pfad, Methode, Kopf und Body ---------------------------------------------------------
{
  const att = attrappe((a) => {
    const p = a.url.replace('https://worker.test', '');
    const json: Record<string, unknown> = {
      '/konto/vorgang': { vorgang: 'v1', abholGeheimnis: 'h1', code: 'ABC-DEF', adresse: 'https://worker.test/konto/anmelden?v=v1', bis: 99 },
      '/konto/vorgang/abholen': { zustand: 'bestaetigt', sitzung: S, stand: STAND },
      '/konto/vorgang/abbrechen': { ok: true },
      '/konto/sitzung': { sitzung: 'jm1.test.zwei', stand: STAND },
      '/konto/abmelden': { ok: true },
      '/konto/ich': { kontoAktiv: true, grund: null, zoomAnfrage: ANFRAGE, adminOffen: 3 },
      '/konto/freigabe': { freigabe: 'jm1.test.frei', bis: 77 },
      '/konto/iveo': { events: [{ key: 'b|s', basis: 'b', slug: 's', name: 'Event', token: 'tok' }, { key: 'kaputt' }] },
      '/konto/zoom-anfrage': { anfrage: ANFRAGE },
      '/konto/admin/uebersicht': { zugaenge: [], iveo: [], anfragen: [], geraete: [], altKey: { bis: null, diagnose: 'ohne-ende', zeilen: [] } },
      '/konto/admin/aktion': { ok: true, einladungscode: 'AAAA-BBBB-CCCC', codeBis: 9 },
    };
    return { status: 200, json: json[p] };
  });
  const c: KontoClient = erzeugeKontoClient({ basis: BASIS, fetch: att.fetch });
  const g = { publicJwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' }, name: 'PC-1', plattform: 'win' as const, arch: 'x64', version: '0.18.0' };
  const r1 = await c.vorgangAnlegen(g, 50123);
  const r2 = await c.vorgangAbholen('v1', 'h1', BEWEIS);
  await c.vorgangAbbrechen('v1', 'h1');
  const r4 = await c.sitzungErneuern(S, BEWEIS, '0.18.0', 'PC-1');
  await c.abmelden(S);
  const r6 = await c.ich(S);
  const r7 = await c.freigabe(S, 'qa-relay', 'evt-1');
  const r8 = await c.iveoTokens(S);
  const r9 = await c.zoomAnfragen(S, { zweck: 'Messe', von: 10, bis: 20 });
  const r10 = await c.adminUebersicht(S);
  const r11 = await c.adminAktion(S, { aktion: 'neuer-code', kid: 'k2' });
  const soll: Array<[string, string, boolean, unknown]> = [
    ['POST', '/konto/vorgang', false, { geraet: g, rueckPort: 50123 }],
    ['POST', '/konto/vorgang/abholen', false, { vorgang: 'v1', abholGeheimnis: 'h1', beweis: BEWEIS }],
    ['POST', '/konto/vorgang/abbrechen', false, { vorgang: 'v1', abholGeheimnis: 'h1' }],
    ['POST', '/konto/sitzung', true, { beweis: BEWEIS, version: '0.18.0', rechnerName: 'PC-1' }],
    ['POST', '/konto/abmelden', true, undefined],
    ['GET', '/konto/ich', true, undefined],
    ['POST', '/konto/freigabe', true, { zweck: 'qa-relay', ziel: 'evt-1' }],
    ['GET', '/konto/iveo', true, undefined],
    ['POST', '/konto/zoom-anfrage', true, { zweck: 'Messe', von: 10, bis: 20 }],
    ['GET', '/konto/admin/uebersicht', true, undefined],
    ['POST', '/konto/admin/aktion', true, { aktion: 'neuer-code', kid: 'k2' }],
  ];
  const abweichung = soll.map(([m, p, mitSitzung, body], i) => {
    const a = att.aufrufe[i];
    const ok = a !== undefined && a.methode === m && a.url === `https://worker.test${p}` && a.kopf.accept === 'application/json'
      && (mitSitzung ? a.kopf.authorization === `Bearer ${S}` : a.kopf.authorization === undefined)
      && JSON.stringify(a.body) === JSON.stringify(body) && (body === undefined) === (a.kopf['content-type'] === undefined);
    return ok ? null : `${m} ${p}`;
  }).filter((x) => x !== null);
  ck(`P9 10.1: jede Methode mit Pfad, Methode, Kopf und Body (11 Aufrufe)${abweichung.length ? ` — ${abweichung.join(', ')}` : ''}`,
    att.aufrufe.length === 11 && abweichung.length === 0);
  ck('P9 10.1: Antworten kommen als Vertragstypen zurück (iveo ohne kaputte Einträge, adminOffen, Ergebnis der Aktion)',
    r1.code === 'ABC-DEF' && r1.bis === 99 && r2.zustand === 'bestaetigt' && 'sitzung' in r2 && r2.sitzung === S
    && r4.sitzung === 'jm1.test.zwei' && r6.kontoAktiv === true && r6.adminOffen === 3 && r6.zoomAnfrage?.id === 'a1'
    && r7.freigabe === 'jm1.test.frei' && r8.events.length === 1 && r8.events[0].token === 'tok' && r8.hinweis === null && r9.id === 'a1'
    && Array.isArray(r10.zugaenge) && r11.einladungscode === 'AAAA-BBBB-CCCC');
  // Z2: das Abholen schickt den Einmalwert e nur mit, wenn der Ablauf ihn hat (sonst fehlt das Feld ganz).
  const E = 'Cd2_-'.repeat(8) + 'Cd2';
  const vorher = att.aufrufe.length;
  await c.vorgangAbholen('v1', 'h1', BEWEIS, E);
  const mitE = att.aufrufe[vorher];
  ck('Z2 2: vorgangAbholen mit e schickt { vorgang, abholGeheimnis, beweis, e }; ohne e fehlt das Feld (oben)',
    mitE !== undefined && JSON.stringify(mitE.body) === JSON.stringify({ vorgang: 'v1', abholGeheimnis: 'h1', beweis: BEWEIS, e: E })
    && !('e' in (att.aufrufe[1].body as Record<string, unknown>)));
}

// --- P9 EP17: Fehlerabbildung --------------------------------------------------------------------------------------
{
  const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
  const FAELLE: Array<{ name: string; antwort: Antwort; code: string; status: number | null }> = [
    { name: 'fetch wirft (kein Netz)', antwort: { wirft: new TypeError('fetch failed') }, code: 'netz', status: null },
    { name: 'Zeitlimit', antwort: { wirft: timeout }, code: 'server', status: null },
    { name: '500', antwort: { status: 500, json: { error: 'x' } }, code: 'server', status: 500 },
    { name: '502 ohne JSON', antwort: { status: 502, roh: '<html>Bad Gateway</html>' }, code: 'server', status: 502 },
    { name: '503', antwort: { status: 503, json: {} }, code: 'server', status: 503 },
    { name: '504', antwort: { status: 504, json: {} }, code: 'server', status: 504 },
    { name: '503 nicht-eingerichtet', antwort: { status: 503, json: { error: 'S5', code: 'nicht-eingerichtet' } }, code: 'nicht-eingerichtet', status: 503 },
    { name: '429', antwort: { status: 429, json: { error: 'zu viele Anfragen' } }, code: 'zu-viele', status: 429 },
    { name: '401 nicht-angemeldet', antwort: { status: 401, json: { code: 'nicht-angemeldet' } }, code: 'nicht-angemeldet', status: 401 },
    { name: '401 sitzung-abgelaufen', antwort: { status: 401, json: { code: 'sitzung-abgelaufen' } }, code: 'sitzung-abgelaufen', status: 401 },
    { name: '403 gesperrt', antwort: { status: 403, json: { code: 'gesperrt' } }, code: 'gesperrt', status: 403 },
    { name: '403 geloescht', antwort: { status: 403, json: { code: 'geloescht' } }, code: 'geloescht', status: 403 },
    { name: '403 zugang-abgelaufen', antwort: { status: 403, json: { code: 'zugang-abgelaufen' } }, code: 'zugang-abgelaufen', status: 403 },
    { name: '403 geraet-unbekannt', antwort: { status: 403, json: { code: 'geraet-unbekannt' } }, code: 'geraet-unbekannt', status: 403 },
    { name: '403 kein-recht', antwort: { status: 403, json: { code: 'kein-recht' } }, code: 'kein-recht', status: 403 },
    { name: '403 erster-admin', antwort: { status: 403, json: { code: 'erster-admin' } }, code: 'erster-admin', status: 403 },
    { name: '404 vorgang-unbekannt', antwort: { status: 404, json: { code: 'vorgang-unbekannt' } }, code: 'vorgang-unbekannt', status: 404 },
    { name: '409 konflikt', antwort: { status: 409, json: { code: 'konflikt' } }, code: 'konflikt', status: 409 },
    { name: '400 ungueltig', antwort: { status: 400, json: { code: 'ungueltig' } }, code: 'ungueltig', status: 400 },
    { name: '400 domain', antwort: { status: 400, json: { code: 'domain' } }, code: 'domain', status: 400 },
    { name: '400 nicht-noetig', antwort: { status: 400, json: { code: 'nicht-noetig' } }, code: 'nicht-noetig', status: 400 },
    { name: '400 unbekannter-zweck', antwort: { status: 400, json: { code: 'unbekannter-zweck' } }, code: 'unbekannter-zweck', status: 400 },
    { name: '400 uhr (EP30)', antwort: { status: 400, json: { code: 'uhr' } }, code: 'uhr', status: 400 },
    { name: '401 unbekannter Code', antwort: { status: 401, json: { code: 'irgendwas' } }, code: 'server', status: 401 },
    { name: '403 ohne Code', antwort: { status: 403, json: { error: 'forbidden' } }, code: 'server', status: 403 },
    { name: '404 not found (alter Worker)', antwort: { status: 404, json: { error: 'not found' } }, code: 'server', status: 404 },
    { name: '200 kaputtes JSON', antwort: { status: 200, roh: '{kaputt' }, code: 'server', status: 200 },
    { name: '200 falsche Form', antwort: { status: 200, json: { sitzung: 5 } }, code: 'server', status: 200 },
  ];
  const ergebnisse: Array<{ f: (typeof FAELLE)[number]; e: KontoFehler | null }> = [];
  for (const f of FAELLE) {
    const c = erzeugeKontoClient({ basis: BASIS, fetch: attrappe(() => f.antwort).fetch });
    ergebnisse.push({ f, e: await fehlerVon(c.sitzungErneuern(S, BEWEIS, '0.18.0', 'PC-1')) });
  }
  const r = pruefeFaelle('P9 EP17: Fehlerabbildung (netz, server, nicht-eingerichtet, zu-viele, Codes des Workers)', ergebnisse,
    ({ f, e }) => (e && e.code === f.code && e.status === f.status ? null : `${f.name}: ist ${e ? `${e.code}/${e.status}` : 'kein Fehler'}, soll ${f.code}/${f.status}`));
  ck(r.name, r.ok);
}

// --- P9 G7, EP31: der Hinweis des Workers zu GET /konto/iveo geht weiter (Diagnose statt „nicht hinterlegt“) -----------
{
  const antworten = [{ events: [], hinweis: 'iveo-nicht-eingerichtet' },
    { events: [{ key: 'b|s', basis: 'b', slug: 's', name: 'Event', token: 'tok' }] }, { events: [], hinweis: 'irgendwas' }];
  const ist: string[] = [];
  for (const json of antworten) {
    const r = await erzeugeKontoClient({ basis: BASIS, fetch: attrappe(() => ({ status: 200, json })).fetch }).iveoTokens(S);
    ist.push(`${r.events.length}/${r.hinweis ?? '-'}`);
  }
  const soll = '0/iveo-nicht-eingerichtet 1/- 0/-';
  ck(`P9 G7: GET /konto/iveo gibt den Hinweis iveo-nicht-eingerichtet weiter, ein unbekannter Hinweis zählt nicht${ist.join(' ') === soll ? '' : ` — ist ${ist.join(' ')}, soll ${soll}`}`,
    ist.join(' ') === soll);
}

// --- P9: Zeitlimit wirkt (Vorgabe 15 s, hier eingestellt 40 ms) -------------------------------------------------------
{
  const c = erzeugeKontoClient({ basis: BASIS, fetch: attrappe(() => ({ haengt: true })).fetch, zeitlimitMs: 40 });
  const start = Date.now();
  const e = await fehlerVon(c.ich(S));
  const dauer = Date.now() - start;
  const quelle = readFileSync(new URL('../src/main/konto/worker-client.ts', import.meta.url), 'utf8');
  ck(`P9 10.6: Zeitlimit beendet eine hängende Anfrage als server (eingestellt 40 ms, gemessen ${dauer < 2000 ? 'unter 2 s' : `${dauer} ms`}; Vorgabe 15 s)`,
    e?.code === 'server' && e.status === null && dauer < 2000 && /KONTO_ZEITLIMIT_MS = 15_000;/.test(quelle));
}

// --- P9: Zugangskopf für Tool-Routen ---------------------------------------------------------------------------------
ck('P9 9.1: zugangsKopf: Sitzung → Authorization, sonst Dev-Key → X-Proxy-Key, sonst nichts',
  JSON.stringify(zugangsKopf({ sitzung: S, devKey: 'test-dev' })) === JSON.stringify({ Authorization: `Bearer ${S}` })
  && JSON.stringify(zugangsKopf({ sitzung: null, devKey: 'test-dev' })) === JSON.stringify({ 'X-Proxy-Key': 'test-dev' })
  && JSON.stringify(zugangsKopf({ sitzung: null })) === '{}' && JSON.stringify(zugangsKopf({ sitzung: null, devKey: '' })) === '{}');

// --- P9 G4: nie X-Proxy-Key an /konto/*, Fehlermeldung ohne Geheimnis ------------------------------------------------
{
  const att = attrappe(() => ({ status: 403, json: { code: 'gesperrt', error: 'Zugang gesperrt' } }));
  const c = erzeugeKontoClient({ basis: BASIS, fetch: att.fetch });
  const fehler = [
    await fehlerVon(c.sitzungErneuern(S, BEWEIS, '0.18.0', 'PC-1')),
    await fehlerVon(c.vorgangAbholen('v1', 'geheim-abholen', BEWEIS)),
    await fehlerVon(c.freigabe(S, 'qa-relay', 'evt-1')),
  ];
  const netz = erzeugeKontoClient({ basis: BASIS, fetch: attrappe(() => ({ wirft: new TypeError(`fetch failed for ${S}`) })).fetch });
  fehler.push(await fehlerVon(netz.ich(S)));
  const texte = fehler.map((e) => `${e?.message} ${e?.stack ?? ''} ${String(e)}`).join(' | ');
  ck('P9 G4: /konto/* bekommt nie X-Proxy-Key; Fehlermeldungen nennen weder Sitzung noch Abholgeheimnis noch Adresse',
    att.aufrufe.length === 3 && att.aufrufe.every((a) => !Object.keys(a.kopf).includes('x-proxy-key'))
    && fehler.every((e) => e !== null) && !texte.includes(S) && !texte.includes('geheim-abholen') && !texte.includes('worker.test')
    && fehler[0]?.message === 'Konto-Anfrage fehlgeschlagen: gesperrt (HTTP 403)' && fehler[3]?.message === 'Konto-Anfrage fehlgeschlagen: netz');
}

// --- Anmeldung P21/P22 (EP35; Nachbesserung Block D, sicherheit:2, sicherheit:8): Adressen des Workers, Browser nur https ----
{
  const SERVER = 'https://jm-suite-proxy.jm-production-suite.workers.dev';
  // [Adresse, Server-Adresse, gehört zum Worker (Kopf, P22), darf in den Browser (P21)]
  const FAELLE: Array<[string, string, boolean, boolean]> = [
    [`${SERVER}/suite.json`, SERVER, true, true],
    [`${SERVER}/konto/anmelden?v=v1`, `${SERVER}/`, true, true],
    [SERVER, SERVER, true, true],
    ['https://jm-suite-proxy.jm-production-suite.workers.dev.evil.example/suite.json', SERVER, false, false],
    ['https://jm-suite-proxy.jm-production-suite.workers.dev@evil.example/suite.json', SERVER, false, false],
    ['https://nutzer@jm-suite-proxy.jm-production-suite.workers.dev/suite.json', SERVER, false, false],
    ['http://jm-suite-proxy.jm-production-suite.workers.dev/suite.json', SERVER, false, false],
    ['https://jm-suite-proxy.jm-production-suite.workers.dev:8443/suite.json', SERVER, false, false],
    ['https://raw.githubusercontent.com/jm/suite.json', SERVER, false, false],
    ['https://proxy.test/jm/suite.json', 'https://proxy.test/jm', true, true],
    ['https://proxy.test/jmx/suite.json', 'https://proxy.test/jm/', false, false],
    ['http://127.0.0.1:8787/konto/anmelden?v=v1', 'http://127.0.0.1:8787', true, true],
    ['http://localhost:8787/konto/anmelden?v=v1', 'http://localhost:8787', true, true],
    ['http://192.168.1.5:8787/konto/anmelden?v=v1', 'http://192.168.1.5:8787', true, false],
    ['file:///C:/Windows/System32/calc.exe', 'file:///C:/', false, false],
    ['ms-settings:privacy', SERVER, false, false],
    ['keine Adresse', SERVER, false, false],
    [`${SERVER}/suite.json`, '', false, false],
  ];
  const abw = FAELLE.filter(([u, s, kopf, browser]) => istWorkerAdresse(u, s) !== kopf || browserAdresseErlaubt(u, s) !== browser)
    .map(([u, s]) => `${u} @ ${s || '-'}: ist ${istWorkerAdresse(u, s)}/${browserAdresseErlaubt(u, s)}`);
  ck(`P21 EP35: istWorkerAdresse (gleiche Herkunft, Pfad mit Grenze, ohne Zugangsdaten) und browserAdresseErlaubt (dazu https, http nur lokal) (${FAELLE.length} Fälle)${abw.length ? ` — ${abw.length} abweichend: ${abw.slice(0, 5).join('; ')}` : ''}`,
    abw.length === 0);
}
{
  // Die Anmeldeadresse kommt vom Server; was nicht https beim Worker liegt, gilt als Serverfehler (K53), nie als Adresse.
  const g = { publicJwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' }, name: 'PC-1', plattform: 'win' as const, arch: 'x64', version: '0.18.0' };
  const codes: string[] = [];
  for (const adresse of ['file:///C:/Windows/System32/calc.exe', 'https://worker.test.evil.example/konto/anmelden?v=v1', 'http://worker.test/konto/anmelden?v=v1']) {
    const c = erzeugeKontoClient({ basis: BASIS, fetch: attrappe(() => ({ status: 200, json: { vorgang: 'v1', abholGeheimnis: 'h1', code: 'ABC-DEF', adresse, bis: 99 } })).fetch });
    codes.push((await fehlerVon(c.vorgangAnlegen(g, 50123)))?.code ?? 'angenommen');
  }
  ck(`P21 EP35: vorgangAnlegen verwirft eine Anmeldeadresse, die nicht https beim Worker liegt, als server (${codes.join(', ')})`,
    codes.length === 3 && codes.every((x) => x === 'server'));
}

// --- Z1 L1 (AR57): Server-Adresse geprüft, Kopf nur an den Worker, keine Weiterleitung mit Kopf, Stand vollständig geprüft -------
{
  // [Eingabe, geprüfte Form oder null]
  const FAELLE: Array<[string, string | null]> = [
    ['https://jm-suite-proxy.jm-production-suite.workers.dev', 'https://jm-suite-proxy.jm-production-suite.workers.dev'],
    ['https://JM-Suite-Proxy.JM-Production-Suite.Workers.Dev/', 'https://jm-suite-proxy.jm-production-suite.workers.dev'],
    ['HTTPS://worker.test:443///', 'https://worker.test'], ['https://worker.test/jm/', 'https://worker.test/jm'], ['  https://worker.test  ', 'https://worker.test'],
    ['https://worker.test:8443', 'https://worker.test:8443'],
    ['http://127.0.0.1:8787', 'http://127.0.0.1:8787'], ['http://[::1]:8787/', 'http://[::1]:8787'], ['HTTP://127.0.0.1', 'http://127.0.0.1'],
    ['http://worker.test', null], ['http://localhost:8787', null], ['http://192.168.1.5:8787', null], ['http://127.0.0.1.evil.example', null],
    ['https://nutzer:geheim@worker.test', null], ['https://nutzer@worker.test', null], ['https://worker.test/?x=1', null], ['https://worker.test/#x', null],
    ['file:///C:/Windows', null], ['ftp://worker.test', null], ['worker.test', null], ['', null], ['   ', null], ['https://', null],
  ];
  const abw = FAELLE.filter(([roh, soll]) => pruefeServerBasis(roh) !== soll).map(([roh]) => `${JSON.stringify(roh)} → ${pruefeServerBasis(roh)}`);
  ck(`Z1 AR57: pruefeServerBasis — https, Schema und Host klein, :443 weg, kein Schrägstrich am Ende; http nur für 127.0.0.1 und [::1] (${FAELLE.length} Fälle)${abw.length ? ` — ${abw.join('; ')}` : ''}`,
    abw.length === 0 && pruefeServerBasis(undefined) === null);
  let gebaut = 0;
  const falsch: string[] = [];
  for (const [roh, soll] of FAELLE) {
    try {
      erzeugeKontoClient({ basis: roh, fetch: attrappe(() => ({ status: 200 })).fetch });
      gebaut++;
      if (soll === null) falsch.push(`gebaut: ${roh}`);
    } catch {
      if (soll !== null) falsch.push(`abgelehnt: ${roh}`);
    }
  }
  ck(`Z1 AR57: erzeugeKontoClient baut den Client nur mit geprüfter Adresse, sonst wirft er vor jeder Anfrage (${FAELLE.length} Fälle, ${gebaut} gebaut)${falsch.length ? ` — ${falsch.join('; ')}` : ''}`,
    falsch.length === 0);
  const ein = attrappe(() => ({ status: 200, json: {} }));
  const g = gesperrterKontoClient();
  const codes = [(await fehlerVon(g.ich('x')))?.code, (await fehlerVon(g.iveoTokens('x')))?.code, (await fehlerVon(g.adminUebersicht('x')))?.code];
  ck('Z1 AR57: gesperrterKontoClient (Ersatz bei unzulässiger Adresse) scheitert mit server und sendet nie eine Anfrage',
    codes.every((c) => c === 'server') && ein.aufrufe.length === 0);
  // EP35 mit [::1]: die Form, die URL.hostname liefert, ist [::1] (mit Klammern)
  const v6: Array<[string, string, boolean, boolean]> = [
    ['http://[::1]:8787/konto/anmelden?v=v1', 'http://[::1]:8787', true, true], ['http://[::1]:9/x', 'http://[::1]:8787', false, false],
    ['http://[::2]:8787/x', 'http://[::2]:8787', true, false], ['https://[::1]:8787/x', 'https://[::1]:8787', true, true],
  ];
  const abw6 = v6.filter(([u, s, kopf, browser]) => istWorkerAdresse(u, s) !== kopf || browserAdresseErlaubt(u, s) !== browser).map(([u]) => u);
  ck(`Z1 AR57, EP35: [::1] steht in der Tabelle von istWorkerAdresse und browserAdresseErlaubt (${v6.length} Fälle)${abw6.length ? ` — abweichend: ${abw6.join('; ')}` : ''}`, abw6.length === 0);
}
{
  const SERVER = 'https://jm-suite-proxy.jm-production-suite.workers.dev';
  // [Adresse, Server, Sitzung, Schlüssel, erwarteter Kopf]
  const FAELLE: Array<[string, string, string | null, string | undefined, Record<string, string>]> = [
    [`${SERVER}/suite.json`, SERVER, 'jm1.s', undefined, { Authorization: 'Bearer jm1.s' }],
    [`${SERVER}/suite.json`, `${SERVER}/`, 'jm1.s', 'dev', { Authorization: 'Bearer jm1.s' }],
    [`${SERVER}/suite.json`, SERVER, null, 'dev', { 'X-Proxy-Key': 'dev' }],
    [`${SERVER}/suite.json`, SERVER, null, undefined, {}],
    ['https://raw.githubusercontent.com/jm/suite.json', SERVER, 'jm1.s', 'dev', {}],
    [`${SERVER}.evil.example/suite.json`, SERVER, 'jm1.s', 'dev', {}],
    ['https://jm-suite-proxy.jm-production-suite.workers.dev@evil.example/suite.json', SERVER, 'jm1.s', 'dev', {}],
    ['http://jm-suite-proxy.jm-production-suite.workers.dev/suite.json', SERVER, 'jm1.s', 'dev', {}],
    // die Server-Adresse selbst ist nicht zulässig (http im Netz, Zugangsdaten): nie ein Kopf
    ['http://worker.test/suite.json', 'http://worker.test', 'jm1.s', 'dev', {}],
    ['https://nutzer:pw@worker.test/suite.json', 'https://nutzer:pw@worker.test', 'jm1.s', 'dev', {}],
    ['http://127.0.0.1:8787/suite.json', 'http://127.0.0.1:8787', 'jm1.s', undefined, { Authorization: 'Bearer jm1.s' }],
    ['http://[::1]:8787/suite.json', 'http://[::1]:8787', null, 'dev', { 'X-Proxy-Key': 'dev' }],
    [`${SERVER}/suite.json`, '', 'jm1.s', 'dev', {}], ['keine Adresse', SERVER, 'jm1.s', 'dev', {}],
  ];
  const abw = FAELLE.filter(([u, s, sitzung, key, soll]) => JSON.stringify(kopfFuer(u, s, sitzung, key)) !== JSON.stringify(soll)).map(([u, s]) => `${u} @ ${s || '-'}`);
  ck(`Z1 Abrufe mit Kopf: kopfFuer gibt Sitzung (vor Schlüssel) nur an eine Adresse des geprüften Workers, sonst {} (${FAELLE.length} Fälle)${abw.length ? ` — abweichend: ${abw.join('; ')}` : ''}`,
    abw.length === 0);
  const R: Array<[Record<string, string>, string]> = [
    [{ Authorization: 'Bearer x' }, 'error'], [{ authorization: 'Bearer x' }, 'error'], [{ 'X-Proxy-Key': 'k' }, 'error'], [{ 'x-proxy-key': 'k' }, 'error'],
    [{ Accept: 'application/json' }, 'follow'], [{}, 'follow'], [{ Authorization: 'Bearer x', Accept: 'a' }, 'error'],
  ];
  ck(`Z1 Abrufe mit Kopf: redirectFuer — 'error' mit Sitzung oder Schlüssel im Kopf, sonst 'follow' (${R.length} Fälle)`,
    R.every(([k, soll]) => redirectFuer(k) === soll));
}
{
  // Echte Weiterleitung auf 127.0.0.1: Der Server A leitet auf Server B um. Mit Kopf (redirect: 'error') erreicht B nie eine Anfrage.
  const b = { treffer: [] as Array<Record<string, string | string[] | undefined>> };
  const serverB = createServer((req, res) => { b.treffer.push(req.headers); res.writeHead(200, { 'content-type': 'application/json', connection: 'close' }); res.end('{}'); });
  await new Promise<void>((ok) => serverB.listen(0, '127.0.0.1', ok));
  const portB = (serverB.address() as AddressInfo).port;
  const serverA = createServer((_req, res) => { res.writeHead(302, { location: `http://127.0.0.1:${portB}/ziel`, connection: 'close' }); res.end(); });
  await new Promise<void>((ok) => serverA.listen(0, '127.0.0.1', ok));
  const portA = (serverA.address() as AddressInfo).port;
  const urlA = `http://127.0.0.1:${portA}/suite.json`;
  const kopf = kopfFuer(urlA, `http://127.0.0.1:${portA}`, 'jm1.geheim', undefined);
  let mitKopf = 'kein Fehler';
  try { await fetch(urlA, { headers: kopf, redirect: redirectFuer(kopf) }); } catch (e) { mitKopf = (e as { name?: string }).name ?? 'Fehler'; }
  const trefferMitKopf = b.treffer.length;
  // Gegenprobe der Aussage: ohne Kopf (redirect: 'follow') wird die Weiterleitung befolgt — der Test misst also wirklich die Weiterleitung
  const ohne = await fetch(urlA, { headers: { Accept: 'application/json' }, redirect: redirectFuer({ Accept: 'application/json' }) });
  await ohne.text();
  // der Konto-Client selbst: Weiterleitung bei /konto/* → Fehler netz, B bekommt nie die Sitzung
  const c = erzeugeKontoClient({ basis: `http://127.0.0.1:${portA}`, fetch: (url, init) => fetch(url, init) });
  const vorher = b.treffer.length;
  const f = await fehlerVon(c.ich('jm1.geheim'));
  const mitAuth = b.treffer.slice(vorher).filter((h) => h.authorization !== undefined).length;
  // Windows (Node/undici): ein vollständig gelesenes fetch und ein process.exit gleich danach lösen einen Absturz im Kern aus
  // (Assertion UV_HANDLE_CLOSING). Alles sauber schließen und kurz warten, bevor der Lauf endet.
  for (const sv of [serverA, serverB]) { sv.closeAllConnections(); await new Promise<void>((ok) => sv.close(() => ok())); }
  await new Promise<void>((ok) => setTimeout(ok, 250));
  ck('Z1 Abrufe mit Kopf: eine Weiterleitung trägt den Kopf nicht weiter — mit Sitzung im Kopf wirft der Abruf, das Ziel sieht keine Anfrage (echter Socket)',
    mitKopf !== 'kein Fehler' && trefferMitKopf === 0 && ohne.ok && b.treffer.length === 1 && b.treffer[0].authorization === undefined);
  ck('Z1 Abrufe mit Kopf: der Konto-Client folgt keiner Weiterleitung (netz), die Sitzung erreicht das Ziel nie',
    f?.code === 'netz' && mitAuth === 0);
}
{
  // istStand prüft jedes Feld: Basis ist ein gültiger Stand; jedes fehlende oder falsch getypte Feld macht die Antwort zu server (200)
  const g0 = { ...STAND } as Record<string, unknown>;
  const SCHLECHT: Array<[string, unknown]> = [
    ['kid', ''], ['kid', 5], ['email', null], ['name', 7], ['art', 'sms'], ['art', undefined], ['stufe', 'chef'], ['tools', 'qa'],
    ['tools', [5]], ['events', 'a'], ['events', [1]], ['zoom', 'ja'], ['zoom', undefined], ['zoomBis', undefined], ['zoomBis', '5'],
    ['jm', 1], ['plattform', 'linux'], ['gid', 3], ['gid', undefined], ['iat', Infinity], ['iat', '1'], ['exp', null],
    ['kontoBis', undefined], ['angemeldetSeit', undefined], ['angemeldetSeit', 'gestern'],
  ];
  const gueltig2 = { ...g0, art: 'passwort', tools: ['connect-raum', 'qa', 'iveo'], events: ['a|b'], zoomBis: 5, kontoBis: 9 };
  async function standAntwort(s: Record<string, unknown>): Promise<string> {
    const c = erzeugeKontoClient({ basis: BASIS, fetch: attrappe(() => ({ status: 200, json: { zustand: 'bestaetigt', sitzung: S, stand: s } })).fetch });
    const f = await fehlerVon(c.vorgangAbholen('v1', 'h1', BEWEIS));
    return f ? `${f.code}/${f.status}` : 'angenommen';
  }
  const abw: string[] = [];
  if (await standAntwort(g0) !== 'angenommen' || await standAntwort(gueltig2) !== 'angenommen') abw.push('gültiger Stand abgewiesen');
  for (const [feld, wert] of SCHLECHT) {
    const s = { ...g0 };
    if (wert === undefined) delete s[feld]; else s[feld] = wert;
    const r = await standAntwort(s);
    if (r !== 'server/200') abw.push(`${feld}=${String(wert)} → ${r}`);
  }
  // sitzungErneuern prüft denselben Stand
  const c2 = erzeugeKontoClient({ basis: BASIS, fetch: attrappe(() => ({ status: 200, json: { sitzung: S, stand: { ...g0, angemeldetSeit: 'x' } } })).fetch });
  const f2 = await fehlerVon(c2.sitzungErneuern(S, BEWEIS, '0.18.0', 'PC'));
  ck(`Z1 istStand: jedes Feld von KontoStand wird geprüft (Art, Werkzeuge, Events, Zoom, JM, Gerät, alle Zeiten) — ${SCHLECHT.length} falsche Felder werden zu server${abw.length ? ` — ${abw.join('; ')}` : ''}`,
    abw.length === 0 && f2?.code === 'server');
}

// --- Fixrunde 1 (AR78) Nr. 3: unbekannte Werkzeuge (Teil 2) werden herausgefiltert, der Stand bleibt gültig ---------------------------
{
  const stand2 = { ...STAND, tools: ['qa', 'zukunft', 'iveo', 'zukunft-2'] } as Record<string, unknown>;
  const c = erzeugeKontoClient({ basis: BASIS, fetch: attrappe((a) => (a.url.endsWith('/abholen')
    ? { status: 200, json: { zustand: 'bestaetigt', sitzung: S, stand: stand2 } } : { status: 200, json: { sitzung: S, stand: stand2 } })).fetch });
  const r1 = await c.vorgangAbholen('v1', 'h1', BEWEIS);
  const r2 = await c.sitzungErneuern(S, BEWEIS, '0.18.0', 'PC');
  const t1 = 'stand' in r1 ? r1.stand.tools.join() : 'kein Stand';
  const bleibtStreng = standAus({ ...STAND, tools: ['qa', 5] }) === null && standAus({ ...STAND, gid: 3 }) === null;
  ck(`Fixrunde 1 Nr. 3: ein unbekanntes Werkzeug lässt den Stand gültig (nur bekannte bleiben: ${t1}); ein Nicht-Text als Werkzeug und alle übrigen Prüfungen bleiben streng`,
    t1 === 'qa,iveo' && r2.stand.tools.join() === 'qa,iveo' && bleibtStreng && stand2.tools instanceof Array && stand2.tools.length === 4);
}

// --- P9 G9 ------------------------------------------------------------------------------------------------------------
{
  const quelle = readFileSync(new URL('../src/main/konto/worker-client.ts', import.meta.url), 'utf8');
  ck('P9 G9: worker-client.ts ohne electron-Import, ohne Konsole, X-Proxy-Key nur in zugangsKopf',
    !/from 'electron'|require\('electron'\)/.test(quelle) && !/console\./.test(quelle) && quelle.split("'X-Proxy-Key'").length === 2);
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
