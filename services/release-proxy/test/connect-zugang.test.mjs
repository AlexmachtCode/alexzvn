// Cloud-Raum von Connect /connect/:raum über die Anmeldung (Anmeldung Teil 2, Aufgabe 3; Spec 9.1, E3, OT5, OT7, R1, RF3, RF5).
//   node --experimental-strip-types services/release-proxy/test/connect-zugang.test.mjs
// Admin-Routen (POST/DELETE) brauchen eine Freigabe für genau diesen Raum (Zweck connect-raum) oder den alten PROXY_KEY bis
// ALTKEY_CONNECT_BIS. Der Raum gehört der ersten Freigabe, die ihn öffnet (Konten-DO, Aktion connect-inhaber); der alte Schlüssel
// öffnet keinen gebundenen Raum und ist je IP gedrosselt. Der Raum-DO ist eine Attrappe, der Konten-DO ein echter KontoSpeicher.
// Nicht über tsx (Kopf von worker.test.mjs).
import { readFileSync } from 'node:fs';
import worker from '../worker.js';
import { altKeyMerkerLeeren } from '../konto-altkey.js';
import { zugangPruefen } from '../konto-zugang.js';
import { abschluss, check, makeKontoNs, makeRLBindungen, makeUhr, makeWaitCtx, pruefeFaelle, testFreigabe, testSchluessel, testSitzung } from './konto-attrappen.mjs';

const protokoll = [];
console.warn = (...a) => protokoll.push(a.map(String).join(' '));
console.error = (...a) => protokoll.push(a.map(String).join(' '));

const quelle = readFileSync(new URL('../connect-relay.js', import.meta.url), 'utf8');
const KS = testSchluessel();
const uhr = makeUhr();
const ctx = makeWaitCtx();

/** Raum-DO-Attrappe: merkt jede Anfrage (Methode, Kopfzeilen) und antwortet 200 { ok: true }. */
function raumNs() {
  const anfragen = [];
  const ns = {
    anfragen,
    jurisdiction: () => ns,
    idFromName: (n) => n,
    get: () => ({
      async fetch(request) {
        anfragen.push({ method: request.method, headers: Object.fromEntries(request.headers) });
        return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
      },
    }),
  };
  return ns;
}

const env = { KONTO_SCHLUESSEL: KS, PROXY_KEY: 'test-proxy-key', CONNECT_ROOM: raumNs(), ...makeRLBindungen(), KONTO_UHR: uhr };
env.KONTO = makeKontoNs(env);

const auf = (id, kopf, method = 'POST', e = env, c = ctx) =>
  worker.fetch(
    new Request(`https://proxy.test/connect/${id}`, {
      method,
      headers: { 'CF-Connecting-IP': '9.9.9.9', 'content-type': 'application/json', ...kopf },
      body: method === 'POST' ? JSON.stringify({ secretHex: 'a'.repeat(64) }) : undefined,
    }),
    e,
    c,
  );
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const ALT = { 'X-Proxy-Key': 'test-proxy-key' };
const frei = (id, o = {}) => testFreigabe(KS, { zweck: 'connect-raum', ziel: id, jetzt: uhr(), ...o });

const fA = await frei('cop31-tag1');
check('T3 9.1: POST /connect/cop31-tag1 mit Freigabe für genau diese ID → 200, Raum erreicht', (await auf('cop31-tag1', bearer(fA))).status === 200 && env.CONNECT_ROOM.anfragen.length === 1);
await pruefeFaelle('T3 RF3: Gegenproben am Cloud-Raum', [
  { name: 'Sitzung statt Freigabe', r: await auf('cop31-tag1', bearer(await testSitzung(KS, { jetzt: uhr() }))), s: [403, 'keine-freigabe'] },
  { name: 'Freigabe für Raum A an Raum B', r: await auf('cop31-tag2', bearer(fA)), s: [403, 'keine-freigabe'] },
  { name: 'zoom-jwt (Ziel meeting-sdk) an /connect/meeting-sdk', r: await auf('meeting-sdk', bearer(await testFreigabe(KS, { zweck: 'zoom-jwt', ziel: 'meeting-sdk', jetzt: uhr() }))), s: [403, 'kein-recht'] },
  { name: 'fremdes Konto, fremder Rechner, gebundener Raum', r: await auf('cop31-tag1', bearer(await frei('cop31-tag1', { kid: 'k-2', gid: 'g-2' }))), s: [403, 'raum-vergeben'] },
  { name: 'abgelaufene Freigabe', r: await auf('cop31-tag1', bearer(await testFreigabe(KS, { zweck: 'connect-raum', ziel: 'cop31-tag1', jetzt: uhr() - 259_200_001 }))), s: [401, 'sitzung-abgelaufen'] },
  { name: 'ohne Kopf', r: await auf('cop31-tag1', {}), s: [401, 'nicht-angemeldet'] },
], async (x) => (x.r.status === x.s[0] && (await x.r.json()).code === x.s[1] ? null : `ist ${x.r.status}`));
check('T3 OT7: gleiches Konto auf anderem Rechner und anderes Konto auf gleichem Rechner → 200',
  (await auf('cop31-tag1', bearer(await frei('cop31-tag1', { gid: 'g-9' })))).status === 200
    && (await auf('cop31-tag1', bearer(await frei('cop31-tag1', { kid: 'k-9' })))).status === 200);
check('T3 RF5: DELETE des Inhabers löst die Bindung; danach öffnet ein fremdes Konto auf fremdem Rechner denselben Raum',
  (await auf('cop31-tag1', bearer(fA), 'DELETE')).status === 200
    && (await auf('cop31-tag1', bearer(await frei('cop31-tag1', { kid: 'k-2', gid: 'g-2' })))).status === 200);

// Alter Schlüssel (OT5, R1): Stichtag, Bindung, Drossel, Zählung
{
  const mit = (bis) => ({ ...env, ALTKEY_CONNECT_BIS: bis });
  const stand = async (e, id) => (await auf(id, ALT, 'POST', e)).status;
  const code = async (e, id) => {
    const r = await auf(id, ALT, 'POST', e);
    return [r.status, (await r.json()).code];
  };
  const T = uhr();
  const leer = (await stand(env, 'alt-leer-1')) === 200 && (await stand({ ...env, ALTKEY_BIS: new Date(T - 86400_000).toISOString() }, 'alt-leer-2')) === 200;
  const vor = (await stand(mit(new Date(T + 86400_000).toISOString()), 'alt-vor-1')) === 200;
  const genau = JSON.stringify(await code(mit(new Date(T).toISOString()), 'alt-genau')) === JSON.stringify([401, 'alter-key-abgelaufen']);
  const unlesbar = (await stand(mit('2026-12-32'), 'alt-unlesbar')) === 200;
  check('T3 OT5: alter PROXY_KEY: ALTKEY_CONNECT_BIS leer → 200, auch nach ALTKEY_BIS; vor dem Stichtag 200; am Stichtag 401 alter-key-abgelaufen; unlesbar → 200', leer && vor && genau && unlesbar);
}
{
  const gebunden = (await auf('alt-gebunden', bearer(await frei('alt-gebunden')))).status === 200;
  const r = await auf('alt-gebunden', ALT);
  const abgelehnt = r.status === 403 && (await r.json()).code === 'raum-vergeben';
  const vorher = env.CONNECT_ROOM.anfragen.length;
  const ungebunden = (await auf('alt-offen', ALT)).status === 200;
  const danachA = (await auf('alt-offen', bearer(await frei('alt-offen')))).status === 200;
  const r2 = await auf('alt-offen', bearer(await frei('alt-offen', { kid: 'k-2', gid: 'g-2' })));
  const gehoertA = r2.status === 403 && (await r2.json()).code === 'raum-vergeben';
  check('T3 R1: alter Schlüssel an gebundenem Raum → 403 raum-vergeben; an ungebundenem → 200 ohne Bindung (danach bindet eine Freigabe)',
    gebunden && abgelehnt && ungebunden && danachA && gehoertA && vorher + 2 === env.CONNECT_ROOM.anfragen.length);
  // Auch DELETE mit dem alten Schlüssel löst keine Bindung und erreicht den Raum nicht.
  const vorDel = env.CONNECT_ROOM.anfragen.length;
  const del = await auf('alt-gebunden', ALT, 'DELETE');
  const weiterGebunden = (await auf('alt-gebunden', ALT)).status === 403;
  check('T3 R1: DELETE mit altem Schlüssel an gebundenem Raum → 403, Raum nicht erreicht, die Bindung bleibt', del.status === 403 && weiterGebunden && vorDel === env.CONNECT_ROOM.anfragen.length);
}
{
  const e = { ...env, ...makeRLBindungen() };
  const stati = [];
  let letzte = null;
  for (let i = 0; i < 21; i++) {
    letzte = await auf('alt-drossel', ALT, 'POST', e);
    stati.push(letzte.status);
  }
  const k = await letzte.json();
  const freigabeFrei = (await auf('alt-drossel-2', bearer(await frei('alt-drossel-2')), 'POST', e)).status === 200;
  check('T3 R1: alter Schlüssel je IP gedrosselt (21. Anfrage → 429, Retry-After 60), Freigaben nicht',
    stati.slice(0, 20).every((s) => s === 200) && stati[20] === 429 && letzte.headers.get('Retry-After') === '60'
      && k.code === 'zu-viele' && k.error === 'zu viele Anfragen' && freigabeFrei && e.KONTO_RL_CONNECTALT.aufrufe.length === 21);
}
{
  altKeyMerkerLeeren();
  const e = { ...env };
  e.KONTO = makeKontoNs(e);
  const c = makeWaitCtx();
  await auf('alt-zaehlen-1', ALT, 'POST', e, c);
  await auf('alt-zaehlen-2', ALT, 'POST', e, c);
  await auf('alt-zaehlen-3', bearer(await frei('alt-zaehlen-3')), 'POST', e, c);
  await c.fertig();
  const eintraege = [];
  for (const sp of e.KONTO.instanzen.values()) for (const [k, v] of sp.ctx.daten) if (k.startsWith('altkey:')) eintraege.push([k, v]);
  check('T3 OT5: angenommener alter Schlüssel wird einmal je IP und Tag in Gruppe connect gezählt (waitUntil)',
    eintraege.length === 1 && eintraege[0][0].includes(':connect:') && eintraege[0][1].anzahl === 1 && eintraege[0][1].gruppe === 'connect');
  altKeyMerkerLeeren();
}
{
  const roh = raumNs();
  const boese = { jurisdiction() { return this; }, idFromName: (n) => n, get: () => ({ fetch: async () => { throw new Error('test-konten-do-aus'); } }) };
  const e1 = { ...env, CONNECT_ROOM: roh, KONTO: boese };
  const r1 = await auf('do-aus-1', bearer(await frei('do-aus-1')), 'POST', e1);
  const r2 = await auf('do-aus-1', ALT, 'POST', e1);
  const r3 = await auf('do-aus-1', bearer(await frei('do-aus-1')), 'POST', { ...env, CONNECT_ROOM: roh, KONTO: undefined });
  const k1 = await r1.json();
  check('T3: Konten-DO wirft → 503 nicht-eingerichtet, Raum-DO nie gerufen',
    r1.status === 503 && k1.code === 'nicht-eingerichtet' && r2.status === 503 && r3.status === 503 && roh.anfragen.length === 0);
}
{
  const roh = raumNs();
  const unklar = { jurisdiction() { return this; }, idFromName: (n) => n, get: () => ({ fetch: async () => new Response('{"ok":false,"code":"ungueltig","status":400}', { status: 400 }) }) };
  const r = await auf('do-unklar', bearer(await frei('do-unklar')), 'POST', { ...env, CONNECT_ROOM: roh, KONTO: unklar });
  check('T3: unerwartete Antwort des Konten-DO → 503 nicht-eingerichtet (nie offen), Raum-DO nie gerufen', r.status === 503 && roh.anfragen.length === 0);
}
{
  const r = await auf('ohne-raum-do', bearer(await frei('ohne-raum-do')), 'POST', { ...env, CONNECT_ROOM: undefined });
  check('T3: ohne CONNECT_ROOM → 503 wie heute', r.status === 503);
}
{
  // B1: ein Client-Wert für die internen Kopfzeilen kommt nie beim Raum-DO an (an der Admin-Route setzt nur der Worker x-connect-admin).
  const roh = raumNs();
  const e = { ...env, CONNECT_ROOM: roh };
  await auf('kopf-b1-raum', { ...bearer(await frei('kopf-b1-raum')), 'x-connect-room': 'fremd' }, 'POST', e);
  check('T3 B1: x-connect-room des Clients wird überschrieben', roh.anfragen.length === 1 && roh.anfragen[0].headers['x-connect-room'] === 'kopf-b1-raum' && roh.anfragen[0].headers['x-connect-admin'] === '1');
}
{
  // Der neue Parameter zweck: zoom-jwt und zoom-sdk teilen die Funktion zoom, die Route verlangt den genauen Zweck.
  const anfrage = (t) => new Request('https://proxy.test/zoom-sdk/x', { headers: { Authorization: `Bearer ${t}` } });
  const sdk = await testFreigabe(KS, { zweck: 'zoom-sdk', ziel: 'win-x64', jetzt: uhr() });
  const mitZweck = await zugangPruefen(anfrage(sdk), env, { funktion: 'zoom', zweck: 'zoom-jwt', ziel: 'win-x64', jetzt: uhr(), ctx });
  const richtig = await zugangPruefen(anfrage(sdk), env, { funktion: 'zoom', zweck: 'zoom-sdk', ziel: 'win-x64', jetzt: uhr(), ctx });
  const ohne = await zugangPruefen(anfrage(sdk), env, { funktion: 'zoom', ziel: 'win-x64', jetzt: uhr(), ctx });
  check('T3 zweck: zugangPruefen mit zweck nimmt nur den genauen Zweck (sonst 403 kein-recht), ohne zweck wie bisher',
    mitZweck.ok === false && mitZweck.status === 403 && mitZweck.code === 'kein-recht' && richtig.ok === true && ohne.ok === true);
}
check('T3 R1: connect-relay.js hat kein keyOk und keinen Vergleich mit === env.PROXY_KEY', !/keyOk|===\s*env\.PROXY_KEY/.test(quelle));
check('T3 G4: weder jm1.-Token noch alter Schlüssel noch Freigabe im Protokoll', !protokoll.join('\n').includes('jm1.') && !protokoll.join('\n').includes('test-proxy-key'));
abschluss();
