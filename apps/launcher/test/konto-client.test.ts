// Anmeldung im Launcher (Teil 1) · P9: Client der Worker-API /konto/* (src/main/konto/worker-client.ts) — gegen den Vertrag
// Gliederung 10.1 mit einer fetch-Attrappe, ohne Netz (tsx). Die Worker-Routen selbst prüft Block C (Task 16).
import { readFileSync } from 'node:fs';
import { erzeugeKontoClient, KontoFehler, zugangsKopf, type KontoClient } from '../src/main/konto/worker-client';
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
  const r1 = await c.vorgangAnlegen(g);
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
    ['POST', '/konto/vorgang', false, { geraet: g }],
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

// --- P9 G9 ------------------------------------------------------------------------------------------------------------
{
  const quelle = readFileSync(new URL('../src/main/konto/worker-client.ts', import.meta.url), 'utf8');
  ck('P9 G9: worker-client.ts ohne electron-Import, ohne Konsole, X-Proxy-Key nur in zugangsKopf',
    !/from 'electron'|require\('electron'\)/.test(quelle) && !/console\./.test(quelle) && quelle.split("'X-Proxy-Key'").length === 2);
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
