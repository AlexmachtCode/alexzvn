// Quelle des Zoom-JWT (Anmeldung Teil 2, Task 14). Rein: kein Electron, keine Datei. npm run selftest -w @jm/connect
process.env.TZ = 'Europe/Berlin';
import type { ZugangsWahl, ConnectFreigabe, ZugangsLage } from '../src/main/zugang/regeln';
import type { ProxyKeySource } from '../src/shared/types';

const { erzeugeJwtQuelle, holeServerJwt, devTtl, JWT_ERNEUERN_VOR_MS, JWT_MIN_REST_MS } = await import('../src/main/zoom/jwt-quelle');

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

const H = 3_600_000;
const START = new Date(2026, 10, 20, 9, 0).getTime();
let uhr = START;
const KONTO = { name: 'Test Person', stufe: 'kollege' as const };
const FREIGABE: ConnectFreigabe = { zweck: 'zoom-jwt', token: 'jm1.test-jwt', bis: START + 72 * H, ziel: 'meeting-sdk', konto: KONTO };
const LOKAL = { clientId: 'test-id', clientSecret: 'test-geheim' };

type ServerAntwort = { ok: true; jwt: string; gueltigS: number } | { ok: false; status: number; code: string | null };
interface Opt {
  wahl: ZugangsWahl;
  server: (n: number) => ServerAntwort;
  lokal: { clientId: string; clientSecret: string } | null;
  herkunft: ProxyKeySource;
  devTtlS: number | null;
  braucht: boolean;
  grund: ZugangsLage['letzterGrund'];
}
const gut = (n: number): ServerAntwort => ({ ok: true, jwt: 'test.jwt.' + n, gueltigS: 43_170 });
const schlecht = (status: number, code: string | null = null) => (): ServerAntwort => ({ ok: false, status, code });

function q(o: Partial<Opt> = {}) {
  const zugang: string[] = [];
  const server: Array<{ token: string; ttlS: number | null }> = [];
  const antworten: Array<{ status: number; code: string | null }> = [];
  const zeitgeber: Array<{ ms: number; fn: () => void; weg: boolean }> = [];
  const log: string[] = [];
  const signiert: number[] = [];
  let geloescht = 0;
  let herkunft: ProxyKeySource = o.herkunft ?? 'none';
  const wahl: ZugangsWahl = o.wahl ?? { art: 'freigabe', f: FREIGABE };
  const quelle = erzeugeJwtQuelle({
    halter: {
      async zugang(zweck, ziel) { zugang.push(`${zweck}:${ziel}`); return wahl; },
      antwort(_z, _w, status, code) { antworten.push({ status, code }); },
      lage() {
        return { wahl: wahl.art, konto: wahl.art === 'freigabe' ? KONTO : null, bis: wahl.art === 'freigabe' ? FREIGABE.bis : null,
          letzterGrund: o.grund ?? null, detail: null, altHerkunft: 'none', altAbgelehnt: false, versucht: true, geloescht: false };
      },
    },
    async holeServerJwt(token, ttlS) {
      server.push({ token, ttlS });
      return (o.server ?? gut)(server.length);
    },
    lokal: {
      lesen: () => ({ daten: o.lokal ?? null, herkunft }),
      loeschen: () => { geloescht++; herkunft = 'none'; return true; },
    },
    signiereLokal(_z, ttlS) { signiert.push(ttlS); return 'test.lokal.' + signiert.length; },
    devTtlS: o.devTtlS ?? null,
    brauchtJwt: () => o.braucht ?? true,
    jetzt: () => uhr,
    zeitgeber(ms, fn) { const t = { ms, fn, weg: false }; zeitgeber.push(t); return t; },
    loescheZeitgeber(t) { (t as { weg: boolean }).weg = true; },
    log: (z) => { log.push(z); },
    geaendert: () => undefined,
  });
  return { quelle, zugang, server, antworten, zeitgeber, log, signiert, geloescht: () => geloescht };
}

ck('T14: Konstanten 2 h und 5 min', JWT_ERNEUERN_VOR_MS === 7_200_000 && JWT_MIN_REST_MS === 300_000);

{
  const x = q();
  const a = await x.quelle.hole(); const b = await x.quelle.hole();
  ck('T14 OT2: erster Bedarf: Freigabe und JWT vom Server; zweiter Bedarf aus dem RAM, ohne Abruf',
    a.ok && b.ok && a.jwt === 'test.jwt.1' && b.jwt === a.jwt && x.server.length === 1 && x.zugang.length === 1 && a.herkunft === 'server' && a.bis === uhr + 43_170_000);
  ck('T14: zugang fragt zoom-jwt mit dem festen Ziel, der Abruf trägt die Freigabe', x.zugang[0] === 'zoom-jwt:meeting-sdk' && x.server[0].token === 'jm1.test-jwt' && x.server[0].ttlS === null);
}
{
  uhr = START + 3 * H; // Uhr geht 3 h vor
  const x = q();
  const a = await x.quelle.hole();
  uhr = START - 3 * H; // und 3 h nach
  const y = q();
  const b = await y.quelle.hole();
  ck('T14 RF1: Uhr 3 h vor oder nach: bis = lokale Uhr + gueltigS; ein Zeitgeber auf bis − 2 h = 35 970 000 ms',
    a.ok && b.ok && a.bis === START + 3 * H + 43_170_000 && b.bis === START - 3 * H + 43_170_000
    && x.zeitgeber.length === 1 && x.zeitgeber[0].ms === 35_970_000 && y.zeitgeber.length === 1 && y.zeitgeber[0].ms === 35_970_000);
  uhr = START;
}
{
  const x = q();
  await x.quelle.hole();
  uhr = START + 6 * H; // Rest gut 6 h: noch genug
  const b = await x.quelle.hole();
  uhr = START + 10 * H + 30 * 60_000; // Rest unter 2 h
  const c = await x.quelle.hole();
  ck('T14 OT2: unter 2 h Rest → neues JWT; Zeitgeber feuert nur bei brauchtJwt() true',
    b.ok && b.jwt === 'test.jwt.1' && c.ok && c.jwt === 'test.jwt.2' && x.server.length === 2 && x.zeitgeber[0].weg && x.zeitgeber.length === 2);
  uhr = START;
  const y = q({ braucht: false });
  await y.quelle.hole();
  y.zeitgeber[0].fn();
  await new Promise((r) => setTimeout(r, 0));
  const z = q({ braucht: true });
  await z.quelle.hole();
  z.zeitgeber[0].fn();
  await new Promise((r) => setTimeout(r, 0));
  ck('T14 OT2: Zeitgeber ohne Bedarf holt nichts, mit Bedarf holt er neu', y.server.length === 1 && z.server.length === 2 && z.zeitgeber.length === 2);
}
{
  const x = q();
  const [a, b] = await Promise.all([x.quelle.hole(), x.quelle.hole()]);
  ck('T14 RF2: zwei gleichzeitige Bedarfe → genau ein zugang() und ein Server-Abruf', a.ok && b.ok && x.zugang.length === 1 && x.server.length === 1);
}
{
  const x = q({ server: (n) => (n === 1 ? gut(1) : schlecht(0)()), lokal: LOKAL });
  await x.quelle.hole();
  uhr = START + 11 * H; // Rest 1 h 14 min 30 s
  const a = await x.quelle.hole();
  uhr = START + 11 * H + 55 * 60_000; // Rest 4 min 30 s
  const b = await x.quelle.hole();
  uhr = START;
  const y = q({ server: schlecht(0) });
  const c = await y.quelle.hole();
  ck('T14 6.3: Server weg, JWT im RAM mit 1 h Rest → ok aus dem RAM; mit 4 min Rest und lokalen Daten → lokal; ohne → server-fehler, Detail Netz',
    a.ok && a.herkunft === 'server' && a.jwt === 'test.jwt.1'
    && b.ok && b.herkunft === 'lokal' && x.signiert.length === 1 && x.signiert[0] === 43_200
    && !c.ok && c.grund === 'server-fehler' && c.detail === 'Netz');
}
{
  const x = q({ wahl: { art: 'keiner' }, grund: 'unbekannter-zweck', lokal: LOKAL });
  const a = await x.quelle.hole();
  const l = x.quelle.lage();
  ck('T14 OT10: Freigabe nicht zu bekommen (unbekannter-zweck), lokale Daten → lokal, lage.quelle lokal mit Grund unbekannter-zweck',
    a.ok && a.herkunft === 'lokal' && a.bis === uhr + 43_200_000 && x.server.length === 0 && l.quelle === 'lokal' && l.grund === 'unbekannter-zweck');
}
{
  const x = q({ wahl: { art: 'keiner' } });
  const a = await x.quelle.hole();
  const l = x.quelle.lage();
  ck('T14 OT8: weder Freigabe noch lokale Daten → ok false mit Grund kein-launcher, kein signiereLokal',
    !a.ok && a.grund === 'kein-launcher' && x.signiert.length === 0 && x.server.length === 0 && l.quelle === 'keine' && l.grund === 'kein-launcher');
}
{
  const x = q({ server: schlecht(401, 'nicht-angemeldet') });
  const a = await x.quelle.hole();
  const y = q({ server: schlecht(503, 'nicht-eingerichtet') });
  const b = await y.quelle.hole();
  const z = q({ server: schlecht(500) });
  const c = await z.quelle.hole();
  ck('T14 QR5: 401 vom Server → halter.antwort(zoom-jwt, …, 401), Grund server-abgelehnt; 503 nicht-eingerichtet → nicht-eingerichtet',
    !a.ok && a.grund === 'server-abgelehnt' && x.antworten.length === 1 && x.antworten[0].status === 401 && x.antworten[0].code === 'nicht-angemeldet'
    && !b.ok && b.grund === 'nicht-eingerichtet' && y.antworten.length === 0
    && !c.ok && c.grund === 'server-fehler' && c.detail === 'HTTP 500');
}
{
  const x = q({ herkunft: 'stored' });
  const a = x.quelle.angemeldet('server');
  const b = x.quelle.angemeldet('server');
  const y = q({ herkunft: 'stored' });
  const c = y.quelle.angemeldet('lokal');
  const z = q({ herkunft: 'env' });
  const d = z.quelle.angemeldet('server');
  ck('T14 OT9: angemeldet(server) löscht gespeicherte Daten genau einmal (true, dann false); lokal und Umgebung nie',
    a === true && b === false && x.geloescht() === 1 && x.quelle.lage().geloescht === true && c === false && y.geloescht() === 0 && d === false && z.geloescht() === 0);
}
{
  const x = q({ devTtlS: 1860, lokal: LOKAL });
  const a = await x.quelle.hole(); const b = await x.quelle.hole();
  const z = q({ devTtlS: 1860, server: (n) => (n === 1 ? { ok: true, jwt: 'test.jwt.1', gueltigS: 1860 } : schlecht(0)()) });
  await z.quelle.hole();
  const e = await z.quelle.hole();
  ck('T14 E9, M4: devTtlS 1860 → jeder Bedarf holt beim Server mit ttlS 1860 (zweiter Bedarf nicht aus dem RAM), kein Zeitgeber, lage.devTtlS 1860; auch mit lokalen Daten nie signiereLokal, solange der Server liefert; Server weg mit devTtlS → kein JWT aus dem RAM (P6)',
    a.ok && b.ok && x.server.length === 2 && x.server.every((s) => s.ttlS === 1860) && x.zeitgeber.length === 0 && x.quelle.lage().devTtlS === 1860
    && x.signiert.length === 0 && !e.ok && e.grund === 'server-fehler' && z.zeitgeber.length === 0);
}
ck('devTtl: 1800 und 43200 gelten, 1799, 43201, 2e3x, leer → null', devTtl({ JMPS_ZOOM_JWT_TTL_S: '1800' }) === 1800 && devTtl({ JMPS_ZOOM_JWT_TTL_S: '43200' }) === 43_200
  && ['1799', '43201', '2e3x', ''].every((v) => devTtl({ JMPS_ZOOM_JWT_TTL_S: v }) === null) && devTtl({}) === null);
{
  const x = q({ lokal: LOKAL, herkunft: 'stored' });
  const a = await x.quelle.hole();
  x.quelle.angemeldet('server');
  const y = q({ server: schlecht(401), lokal: LOKAL });
  await y.quelle.hole();
  const alle = [...x.log, ...y.log].join('\n');
  ck('T14 G4: keine Logzeile enthält test.jwt. oder jm1.; geheimnisse() nennt das gehaltene JWT',
    a.ok && !alle.includes('test.jwt.') && !alle.includes('jm1.') && !alle.includes('test-geheim') && x.log.length > 0
    && x.quelle.geheimnisse().length === 1 && x.quelle.geheimnisse()[0] === 'test.jwt.1');
}
{
  const aufrufe: Array<{ url: string; init: RequestInit }> = [];
  const f = (async (u: URL | string, init: RequestInit) => {
    aufrufe.push({ url: String(u), init });
    return new Response(JSON.stringify({ jwt: 'test.jwt.x', exp: 1, gueltigS: 43_170 }), { status: 200 });
  }) as typeof fetch;
  const a = await holeServerJwt('https://beispiel.test', 'jm1.test-jwt', 1860, f);
  const b = await holeServerJwt('https://beispiel.test', 'jm1.test-jwt', null, f);
  const n = aufrufe.length;
  const c = await holeServerJwt('http://beispiel.test', 'jm1.test-jwt', null, f);
  const nach = aufrufe.length;
  const d = await holeServerJwt('http://127.0.0.1:8787', 'jm1.test-jwt', null, f);
  const e = await holeServerJwt('https://beispiel.test', 'jm1.test-jwt', null, (async () => new Response('{"jwt":"test.jwt.x"}', { status: 200 })) as typeof fetch);
  const g = await holeServerJwt('https://beispiel.test', 'jm1.test-jwt', null, (async () => { throw new TypeError('fetch failed'); }) as typeof fetch);
  const h = await holeServerJwt('https://beispiel.test', 'jm1.test-jwt', null, (async () => new Response('{"code":"nicht-eingerichtet"}', { status: 503 })) as typeof fetch);
  const h0 = aufrufe[0].init.headers as Record<string, string>;
  const h1 = aufrufe[1].init.headers as Record<string, string>;
  ck('T14: holeServerJwt: POST ‹base›/zoom/jwt mit Bearer und redirect manual; mit ttlS 1860 Rumpf {"ttlS":1860} und content-type application/json, mit null ohne Rumpf; http://beispiel → kein Abruf; Antwort ohne gueltigS → status 502',
    a.ok && b.ok && aufrufe[0].url === 'https://beispiel.test/zoom/jwt' && aufrufe[0].init.method === 'POST' && h0.Authorization === 'Bearer jm1.test-jwt'
    && aufrufe[0].init.redirect === 'manual' && aufrufe[0].init.body === '{"ttlS":1860}' && h0['content-type'] === 'application/json'
    && aufrufe[1].init.body === undefined && h1['content-type'] === undefined
    && !c.ok && c.status === 0 && n === 2 && nach === 2 && d.ok && aufrufe.length === 3 && aufrufe[2].url === 'http://127.0.0.1:8787/zoom/jwt'
    && !e.ok && e.status === 502 && e.code === null && !g.ok && g.status === 0 && !h.ok && h.status === 503 && h.code === 'nicht-eingerichtet');
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
