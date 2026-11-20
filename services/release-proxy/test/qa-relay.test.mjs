// Q&A-Relay /qa/* über worker.fetch (Anmeldung im Launcher, Plan Teil 1, P19; Spec 6.2, 9, 9.1, 10; EP3, EP8, EP9, EP33; OF2).
//   node --experimental-strip-types services/release-proxy/test/qa-relay.test.mjs
// Erste Tests für qa-relay.js überhaupt: öffentliche Routen ohne Zugang, Admin-Routen mit Freigabe für genau dieses Event
// oder altem Schlüssel bis ALTKEY_BIS, das Event gehört der Freigabe, die es geöffnet hat (EP33), Blind-Relay unverändert
// (open → submit → pending → ack → delete). KV als makeKV (mit
// list und delete), Uhr über KONTO_UHR, kein Netz. Freigaben und Sitzungen signiert der Test mit einem Schlüssel aus
// testSchluessel() (G4). Nicht über tsx (Kopf von worker.test.mjs).
import { readFileSync } from 'node:fs';
import worker from '../worker.js';
import { altKeyMerkerLeeren } from '../konto-altkey.js';
import { signiere } from '../konto-krypto.js';
import { FEHLER_TEXT } from '../konto-zugang.js';
import { abschluss, check, makeKV, makeKontoNs, makeRateLimit, makeWaitCtx, pruefeFaelle, testSchluessel } from './konto-attrappen.mjs';

const protokoll = [];
const realWarn = console.warn;
const realError = console.error;
console.warn = (...a) => protokoll.push(a.map(String).join(' '));
console.error = (...a) => protokoll.push(a.map(String).join(' '));

const TAG = 24 * 3600_000;
const T0 = Date.parse('2026-11-02T10:00:00Z');
const SCHLUESSEL = testSchluessel();
const FREMD = testSchluessel();
const PROXY = 'test-proxy-key';
const EVENT = 'qa-event-1';
const ANDERES = 'qa-event-2';
const VOR = new Date(T0 + 10 * TAG).toISOString();
const NACH = new Date(T0 - TAG).toISOString();
globalThis.fetch = async () => new Response('{}', { status: 404 });

function umgebung(mehr = {}) {
  const env = { PROXY_KEY: PROXY, KONTO_SCHLUESSEL: SCHLUESSEL, KONTO_UHR: () => T0, QA_RELAY: makeKV(), RATELIMIT: makeKV(), ...mehr };
  // Z3: der Inhaber eines Events steht im Konten-DO; ohne eigene Angabe läuft ein echter KontoSpeicher hinter der Attrappe.
  if (!('KONTO' in mehr)) env.KONTO = makeKontoNs(env);
  return env;
}

/** Dieselbe Umgebung (KV und Konten-DO bleiben dieselben) mit weiteren Variablen. */
const umgebungMit = (env, mehr) => ({ ...env, ...mehr });

/** Hash der Event-ID, unter dem der Konten-DO den Inhaber führt (Präfix wie in qa-relay.js). */
async function eventHash(id) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`qa-event|${id}`)))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function anfrage(env, methode, pfad, { body, kopf = {}, ctx } = {}) {
  const h = { 'CF-Connecting-IP': '9.9.9.9', ...kopf };
  const init = { method: methode, headers: h };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    h['content-type'] = 'application/json';
  }
  const res = await worker.fetch(new Request('https://proxy.test' + pfad, init), env, ctx ?? makeWaitCtx());
  const text = await res.text();
  let daten = null;
  try {
    daten = JSON.parse(text);
  } catch {
    daten = null;
  }
  return { status: res.status, daten, text, kopf: res.headers };
}

const freigabe = (ziel, mehr = {}, schluessel = SCHLUESSEL) =>
  signiere(schluessel, { v: 1, typ: 'freigabe', zweck: 'qa-relay', ziel, kid: 'k-1', gid: 'g-1', iat: T0, exp: T0 + 72 * 3600_000, ...mehr });
const sitzung = (stufe) =>
  signiere(SCHLUESSEL, {
    v: 1, typ: 'sitzung', kid: 'k-1', email: 'karl@jakobsmedien.com', name: 'Karl Kollege', art: 'google', stufe, tools: [], events: [],
    zoom: true, zoomBis: null, jm: false, plattform: 'win', gid: 'g-1', iat: T0, exp: T0 + 30 * TAG, kontoBis: null, angemeldetSeit: T0,
  });
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const PUB = { kty: 'RSA', n: 'test-modulus-abc', e: 'AQAB' };
const umschlag = (n) => ({ v: 1, alg: 'RSA-OAEP+A256GCM', ek: 'QUJD', iv: 'REVGR0hJ', ct: `Q1Q${n}` });

async function run() {
  // P19 9.1: Admin-Routen × Zugang. Erwartet 200 oder Status und code mit Text S…
  {
    const ROUTEN = [
      { name: 'POST /qa/:id (öffnen)', m: 'POST', p: `/qa/${EVENT}`, body: { pubJwk: PUB } },
      { name: 'GET /qa/:id/pending', m: 'GET', p: `/qa/${EVENT}/pending` },
      { name: 'POST /qa/:id/ack', m: 'POST', p: `/qa/${EVENT}/ack`, body: { ids: [] } },
      { name: 'DELETE /qa/:id', m: 'DELETE', p: `/qa/${EVENT}` },
    ];
    const ZUGAENGE = [
      { name: 'Freigabe für dieses Event', kopf: bearer(await freigabe(EVENT)), soll: [200] },
      { name: 'Freigabe und falscher alter Key', kopf: { ...bearer(await freigabe(EVENT)), 'X-Proxy-Key': 'test-falsch' }, soll: [200] },
      { name: 'Freigabe für ein anderes Event', kopf: bearer(await freigabe(ANDERES)), soll: [403, 'keine-freigabe'] },
      { name: 'Freigabe abgelaufen', kopf: bearer(await freigabe(EVENT, { exp: T0 })), soll: [401, 'sitzung-abgelaufen'] },
      { name: 'Freigabe mit fremdem Schlüssel', kopf: bearer(await freigabe(EVENT, {}, FREMD)), soll: [401, 'nicht-angemeldet'] },
      { name: 'Sitzung (Kollege) statt Freigabe', kopf: bearer(await sitzung('kollege')), soll: [403, 'keine-freigabe'] },
      { name: 'alter Key, Frist läuft', kopf: { 'X-Proxy-Key': PROXY }, env: { ALTKEY_BIS: VOR }, soll: [200] },
      { name: 'alter Key, ALTKEY_BIS fehlt', kopf: { 'X-Proxy-Key': PROXY }, soll: [200] },
      { name: 'alter Key als Bearer', kopf: bearer(PROXY), env: { ALTKEY_BIS: VOR }, soll: [200] },
      { name: 'alter Key nach der Frist', kopf: { 'X-Proxy-Key': PROXY }, env: { ALTKEY_BIS: NACH }, soll: [401, 'alter-key-abgelaufen'] },
      { name: 'falscher Key', kopf: { 'X-Proxy-Key': 'test-falsch' }, soll: [401, 'nicht-angemeldet'] },
      { name: 'ohne Zugang', kopf: {}, soll: [401, 'nicht-angemeldet'] },
    ];
    const faelle = ZUGAENGE.flatMap((z) => ROUTEN.map((r) => ({ name: `${z.name} · ${r.name}`, z, r })));
    await pruefeFaelle('P19 9.1: Q&A-Admin-Routen je Zugang', faelle, async ({ z, r }) => {
      const a = await anfrage(umgebung(z.env), r.m, r.p, { body: r.body, kopf: z.kopf });
      const [status, code] = z.soll;
      const ok = a.status === status && (code ? a.daten && a.daten.code === code && a.daten.error === FEHLER_TEXT[code] : a.daten && a.daten.code === undefined);
      return ok ? null : `ist ${a.status} ${a.daten ? a.daten.code ?? a.daten.error : a.text.slice(0, 60)}, soll ${status} ${code ?? '-'}`;
    });
  }

  // P19 Blind-Relay unverändert: öffnen (Freigabe) → einreichen (öffentlich) → abholen → bestätigen → löschen.
  {
    const env = umgebung();
    const f = bearer(await freigabe(EVENT));
    const auf = await anfrage(env, 'POST', `/qa/${EVENT}`, { kopf: f, body: { pubJwk: PUB, retentionSec: 3600 } });
    const s1 = await anfrage(env, 'POST', `/qa/${EVENT}/submit`, { body: umschlag(1) });
    const s2 = await anfrage(env, 'POST', `/qa/${EVENT}/submit`, { body: umschlag(2) });
    const p1 = await anfrage(env, 'GET', `/qa/${EVENT}/pending`, { kopf: f });
    const ids = (p1.daten && p1.daten.items ? p1.daten.items : []).map((i) => i.id);
    const ack = await anfrage(env, 'POST', `/qa/${EVENT}/ack`, { kopf: f, body: { ids: ids.slice(0, 1) } });
    const p2 = await anfrage(env, 'GET', `/qa/${EVENT}/pending`, { kopf: f });
    const del = await anfrage(env, 'DELETE', `/qa/${EVENT}`, { kopf: f });
    const p3 = await anfrage(env, 'GET', `/qa/${EVENT}/pending`, { kopf: f });
    const pub = await anfrage(env, 'GET', `/qa/${EVENT}/pubkey`);
    check('P19 Blind-Relay: öffnen → zwei Einreichungen → abholen (2, Chiffretext unverändert) → bestätigen (1) → löschen (leer, Event weg)',
      auf.status === 200 && auf.daten.streamOpen === true && s1.status === 200 && s2.status === 200 && p1.status === 200 && ids.length === 2
        && p1.daten.items.every((i) => i.blob.alg === 'RSA-OAEP+A256GCM' && i.channel === 'stream') && ack.daten.deleted === 1
        && p2.daten.items.length === 1 && del.daten.removed === 1 && p3.daten.items.length === 0 && pub.status === 404 && env.QA_RELAY.daten.size === 0);
  }

  // P19 öffentliche Routen ohne jeden Zugang (Zuschauer und Presse haben keinen).
  {
    const env = umgebung();
    const codeHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('test-presse-code')))].map((b) => b.toString(16).padStart(2, '0')).join('');
    await anfrage(env, 'POST', `/qa/${EVENT}`, { kopf: bearer(await freigabe(EVENT)), body: { pubJwk: PUB, pressCodeHash: codeHash } });
    const faelle = [
      { name: 'GET Einreichseite', a: await anfrage(env, 'GET', `/qa/${EVENT}`), soll: 200, html: true },
      { name: 'GET Presseseite', a: await anfrage(env, 'GET', `/qa/${EVENT}/press`), soll: 200, html: true },
      { name: 'GET pubkey', a: await anfrage(env, 'GET', `/qa/${EVENT}/pubkey`), soll: 200 },
      { name: 'GET state', a: await anfrage(env, 'GET', `/qa/${EVENT}/state`), soll: 200 },
      { name: 'POST submit', a: await anfrage(env, 'POST', `/qa/${EVENT}/submit`, { body: umschlag(3) }), soll: 200 },
      { name: 'POST press mit Code', a: await anfrage(env, 'POST', `/qa/${EVENT}/press`, { body: { code: 'test-presse-code', env: umschlag(4) } }), soll: 200 },
      { name: 'POST press mit falschem Code', a: await anfrage(env, 'POST', `/qa/${EVENT}/press`, { body: { code: 'test-falsch', env: umschlag(5) } }), soll: 401 },
      { name: 'GET state unbekanntes Event', a: await anfrage(env, 'GET', '/qa/unbekannt-1/state'), soll: 200 },
    ];
    await pruefeFaelle('P19 9: öffentliche Q&A-Routen ohne Zugang wie bisher', faelle, (f) =>
      f.a.status === f.soll && (!f.html || (f.a.kopf.get('content-type') || '').startsWith('text/html')) && !(f.a.daten && f.a.daten.code)
        ? null
        : `ist ${f.a.status} ${f.a.text.slice(0, 60)}`);
  }

  // P19 OF2: der alte Schlüssel an /qa/* zählt mit Gruppe qa (Plattform unbekannt: Q&A schickt keine).
  {
    const anfragen = [];
    const ns = {
      jurisdiction() { return ns; },
      idFromName: () => ({}),
      get: () => ({ fetch: async (r) => { anfragen.push(await r.json()); return Response.json({ ok: true }); } }),
    };
    const ctx = makeWaitCtx();
    altKeyMerkerLeeren(); // die Fälle davor haben jetzt einen Konten-DO und damit den Merker für IP, Tag und Gruppe schon belegt
    const a = await anfrage(umgebung({ KONTO: ns, ALTKEY_BIS: VOR }), 'GET', `/qa/${EVENT}/pending`, { kopf: { 'X-Proxy-Key': PROXY }, ctx });
    await ctx.fertig();
    const ctx2 = makeWaitCtx();
    await anfrage(umgebung({ KONTO: ns }), 'GET', `/qa/${EVENT}/pending`, { kopf: bearer(await freigabe(EVENT)), ctx: ctx2 });
    await ctx2.fertig();
    check('P19 OF2: alter Key an /qa/* → eine Zählung (Gruppe qa, Plattform unbekannt); Freigabe zählt nicht',
      a.status === 200 && anfragen.filter((x) => x.gruppe).length === 1 && JSON.stringify(anfragen.find((x) => x.gruppe)) === JSON.stringify({ jetzt: T0, gruppe: 'qa', plattform: 'unbekannt', arch: '' }));
  }

  // P19 EP33: Ein Event gehört dem Konto bzw. Rechner, dessen Freigabe es zuerst geöffnet hat. Die Event-ID ist öffentlich
  // (Einreich-Adresse, Saal-QR): eine fremde Freigabe für dieselbe ID und der alte Schlüssel ändern es danach nicht mehr.
  {
    const env = umgebung({ ALTKEY_BIS: VOR });
    const teamB = bearer(await freigabe(EVENT, { kid: 'k-team-b', gid: 'g-regie-1' }));
    const fremd = bearer(await freigabe(EVENT, { kid: 'k-extern-x', gid: 'g-fremd-1' }));
    const kollegin = bearer(await freigabe(EVENT, { kid: 'k-kollegin', gid: 'g-regie-1' })); // anderes Konto, derselbe Rechner
    const zweiterPc = bearer(await freigabe(EVENT, { kid: 'k-team-b', gid: 'g-regie-2' })); // dasselbe Konto, anderer Rechner
    const alt = { 'X-Proxy-Key': PROXY };
    const PUB_B = { kty: 'RSA', n: 'test-modulus-team-b', e: 'AQAB' };
    const PUB_X = { kty: 'RSA', n: 'test-modulus-fremd', e: 'AQAB' };
    const auf = await anfrage(env, 'POST', `/qa/${EVENT}`, { kopf: teamB, body: { pubJwk: PUB_B } });
    await anfrage(env, 'POST', `/qa/${EVENT}/submit`, { body: umschlag(7) });
    const faelle = [
      { name: 'fremde Freigabe öffnet (überschreibt den Schlüssel)', a: await anfrage(env, 'POST', `/qa/${EVENT}`, { kopf: fremd, body: { pubJwk: PUB_X } }), soll: 403 },
      { name: 'fremde Freigabe holt ab', a: await anfrage(env, 'GET', `/qa/${EVENT}/pending`, { kopf: fremd }), soll: 403 },
      { name: 'fremde Freigabe quittiert', a: await anfrage(env, 'POST', `/qa/${EVENT}/ack`, { kopf: fremd, body: { ids: [] } }), soll: 403 },
      { name: 'fremde Freigabe löscht', a: await anfrage(env, 'DELETE', `/qa/${EVENT}`, { kopf: fremd }), soll: 403 },
      { name: 'alter Key öffnet ein gebundenes Event', a: await anfrage(env, 'POST', `/qa/${EVENT}`, { kopf: alt, body: { pubJwk: PUB_X } }), soll: 403 },
      { name: 'alter Key löscht ein gebundenes Event', a: await anfrage(env, 'DELETE', `/qa/${EVENT}`, { kopf: alt }), soll: 403 },
      { name: 'anderes Konto am selben Rechner holt ab', a: await anfrage(env, 'GET', `/qa/${EVENT}/pending`, { kopf: kollegin }), soll: 200 },
      { name: 'dasselbe Konto am anderen Rechner holt ab', a: await anfrage(env, 'GET', `/qa/${EVENT}/pending`, { kopf: zweiterPc }), soll: 200 },
      { name: 'Team B öffnet erneut', a: await anfrage(env, 'POST', `/qa/${EVENT}`, { kopf: teamB, body: { pubJwk: PUB_B } }), soll: 200 },
    ];
    // Übergang: Ein mit dem alten Schlüssel geöffnetes Event hat keinen Inhaber; die erste Freigabe, die es nutzt, bindet es
    // (Q&A öffnet je Lauf nur einmal, danach holt es nur ab), mit der Restlaufzeit des Events.
    const teamB2 = bearer(await freigabe(ANDERES, { kid: 'k-team-b', gid: 'g-regie-1' }));
    const fremd2 = bearer(await freigabe(ANDERES, { kid: 'k-extern-x', gid: 'g-fremd-1' }));
    await anfrage(env, 'POST', `/qa/${ANDERES}`, { kopf: alt, body: { pubJwk: PUB_B } });
    faelle.push(
      { name: 'Übergang: alter Key holt ab (Event ohne Inhaber)', a: await anfrage(env, 'GET', `/qa/${ANDERES}/pending`, { kopf: alt }), soll: 200 },
      { name: 'Übergang: Freigabe holt ab und bindet', a: await anfrage(env, 'GET', `/qa/${ANDERES}/pending`, { kopf: teamB2 }), soll: 200 },
      { name: 'Übergang: danach alter Key', a: await anfrage(env, 'GET', `/qa/${ANDERES}/pending`, { kopf: alt }), soll: 403 },
      { name: 'Übergang: danach fremde Freigabe', a: await anfrage(env, 'POST', `/qa/${ANDERES}`, { kopf: fremd2, body: { pubJwk: PUB_X } }), soll: 403 },
    );
    const bis = env.KONTO.speicher().ctx.daten.get(`qa:${await eventHash(ANDERES)}`)?.bis;
    faelle.push({ name: 'Übergang: das Binden gilt bis zum Ende des Events (48 h) plus 1 h Schreib-Puffer, im Konten-DO', a: { status: bis === T0 + 49 * 3600_000 ? 200 : bis }, soll: 200 });
    await pruefeFaelle('P19 EP33: ein Event gehört der Freigabe, die es zuerst geöffnet hat (Konto oder Rechner)', faelle, (f) =>
      f.a.status === f.soll && (f.soll !== 403 || (f.a.daten && f.a.daten.code === 'keine-freigabe' && f.a.daten.error === FEHLER_TEXT['keine-freigabe']))
        ? null
        : `ist ${f.a.status} ${f.a.daten ? f.a.daten.code ?? f.a.daten.error ?? '' : ''}, soll ${f.soll}`);
    const pub = await anfrage(env, 'GET', `/qa/${EVENT}/pubkey`);
    const offen = await anfrage(env, 'GET', `/qa/${EVENT}/pending`, { kopf: teamB });
    const ablage = [...env.QA_RELAY.daten.values()].map((e) => e.wert).join('\n');
    const imDo = JSON.stringify([...env.KONTO.speicher().ctx.daten.entries()]);
    check('P19 EP33 (Z3): danach gilt der Schlüssel von Team B, die Einreichung ist noch da; KV kennt keinen Inhaber, der Konten-DO nur Hashes',
      auf.status === 200 && pub.daten && pub.daten.jwk && pub.daten.jwk.n === 'test-modulus-team-b' && offen.daten && offen.daten.items.length === 1
        && !ablage.includes('inhaber') && imDo.includes('kidHash') && !['k-team-b', 'g-regie-1', EVENT, ANDERES].some((w) => imDo.includes(w)) && !['k-team-b', 'g-regie-1'].some((w) => ablage.includes(w)));
  }

  // P19 Quelltext: eine Prüfstelle; qa-relay.js vergleicht den Proxy-Key nicht mehr selbst.
  {
    const q = readFileSync(new URL('../qa-relay.js', import.meta.url), 'utf8');
    const w = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
    check('P19 Quelltext: qa-relay.js ohne keyOk und ohne env.PROXY_KEY, mit zugangPruefen (qa, Ziel = Event); worker.js reicht ctx weiter',
      !q.includes('keyOk') && !q.includes('env.PROXY_KEY') && q.includes("zugangPruefen(request, env, { funktion: 'qa', gruppe: 'qa', ziel: id,")
        && w.includes('await handleQa(request, env, url, ctx)'));
  }

  // Z1-W2 [T]: ohne QA_RELAY kommt das 503 erst NACH der Zugangsprüfung (ohne Zugang 401, mit falscher Freigabe 403).
  {
    const ohne = umgebung({ QA_RELAY: undefined });
    const ohneZugang = await anfrage(ohne, 'GET', `/qa/${EVENT}/pending`);
    const fremdesEvent = await anfrage(ohne, 'GET', `/qa/${EVENT}/pending`, { kopf: bearer(await freigabe(ANDERES)) });
    const gueltig = await anfrage(ohne, 'GET', `/qa/${EVENT}/pending`, { kopf: bearer(await freigabe(EVENT)) });
    check(
      'Z1-W2 [T]: ohne QA_RELAY → ohne Zugang 401 S1, Freigabe für ein anderes Event 403 S15, erst mit gültiger Freigabe 503 (QA_RELAY KV-Bindung fehlt)',
      ohneZugang.status === 401 && ohneZugang.daten.code === 'nicht-angemeldet' && fremdesEvent.status === 403 && fremdesEvent.daten.code === 'keine-freigabe'
        && gueltig.status === 503 && gueltig.daten.error === 'QA_RELAY KV-Bindung fehlt',
    );
  }

  // Z1-W2 [T] Probe K: worker.fetch reicht ctx bis zur Zählung durch: ein alter Key an GET /qa/:id/pending zählt über ctx.waitUntil
  // genau einmal (Gruppe qa).
  {
    const zaehlungen = [];
    const ns = { jurisdiction: () => ns, idFromName: () => ({}), get: () => ({ fetch: async (r) => (zaehlungen.push(await r.json()), Response.json({ ok: true })) }) };
    const offen = [];
    const ctx = { waitUntil: (p) => offen.push(p) };
    altKeyMerkerLeeren(); // der Merker im Isolat kennt IP, Tag und Gruppe aus den Fällen davor schon
    const r = await anfrage(umgebung({ ALTKEY_BIS: VOR, KONTO: ns }), 'GET', `/qa/${EVENT}/pending`, { kopf: { 'X-Proxy-Key': PROXY }, ctx });
    await Promise.all(offen);
    check(
      'Z1-W2 [T] Probe K: alter Key an /qa/:id/pending → durchgelassen, genau eine Zählung über ctx.waitUntil (Gruppe qa) — ctx kommt über worker.fetch und handleQa an',
      r.status !== 401 && offen.length === 1 && zaehlungen.filter((z) => z.gruppe).length === 1 && zaehlungen.find((z) => z.gruppe).gruppe === 'qa',
    );
  }

  // Z3 (OE3, AR55): Der Inhaber eines Events steht im Konten-DO (Compare-and-set), nicht mehr in KV.
  // Rennen: zwei verschiedene Konten öffnen dasselbe Event gleichzeitig; genau eines wird Inhaber.
  {
    const env = umgebung();
    const PUB_1 = { kty: 'RSA', n: 'test-modulus-eins', e: 'AQAB' };
    const PUB_2 = { kty: 'RSA', n: 'test-modulus-zwei', e: 'AQAB' };
    const eins = bearer(await freigabe(EVENT, { kid: 'k-eins', gid: 'g-eins' }));
    const zwei = bearer(await freigabe(EVENT, { kid: 'k-zwei', gid: 'g-zwei' }));
    const [a, b] = await Promise.all([
      anfrage(env, 'POST', `/qa/${EVENT}`, { kopf: eins, body: { pubJwk: PUB_1 } }),
      anfrage(env, 'POST', `/qa/${EVENT}`, { kopf: zwei, body: { pubJwk: PUB_2 } }),
    ]);
    const gewinner = a.status === 200 ? PUB_1 : PUB_2;
    const pub = await anfrage(env, 'GET', `/qa/${EVENT}/pubkey`);
    check('Z3 Rennen: zwei verschiedene Konten öffnen gleichzeitig dasselbe Event → genau eines 200, das andere 403 keine-freigabe; der Schlüssel im Event ist der des Siegers',
      [a.status, b.status].sort().join() === '200,403' && [a, b].filter((r) => r.status === 403).every((r) => r.daten?.code === 'keine-freigabe')
        && pub.status === 200 && pub.daten?.jwk?.n === gewinner.n);
    const kollegin = bearer(await freigabe(EVENT, { kid: 'k-kollegin', gid: gewinner === PUB_1 ? 'g-eins' : 'g-zwei' }));
    const rechner = await anfrage(env, 'GET', `/qa/${EVENT}/pending`, { kopf: kollegin });
    const alt = await anfrage(umgebungMit(env, { ALTKEY_BIS: VOR }), 'GET', `/qa/${EVENT}/pending`, { kopf: { 'X-Proxy-Key': PROXY } });
    check('Z3: derselbe Rechner mit einem anderen Konto → 200; der alte Schlüssel nach der Bindung → 403 keine-freigabe',
      rechner.status === 200 && alt.status === 403 && alt.daten?.code === 'keine-freigabe');
  }
  {
    const env = umgebung({ ALTKEY_BIS: VOR });
    const alt = { 'X-Proxy-Key': PROXY };
    const auf = await anfrage(env, 'POST', `/qa/${EVENT}`, { kopf: alt, body: { pubJwk: PUB } });
    const pend = await anfrage(env, 'GET', `/qa/${EVENT}/pending`, { kopf: alt });
    const imDo = env.KONTO.speicher().ctx.daten;
    check('Z3: der alte Schlüssel ohne Inhaber → 200, bindet nichts (der Konten-DO bleibt leer)', auf.status === 200 && pend.status === 200 && imDo.size === 0);
  }
  // KV hält keinen Inhaber mehr: ein altes `inhaber`-Feld in der Meta wird ignoriert, ein neues Öffnen schreibt keines.
  {
    const env = umgebung();
    const fremd = { kid: await eventHash('k-wer'), gid: await eventHash('g-wer') };
    await env.QA_RELAY.put(`qa:${EVENT}:meta`, JSON.stringify({ pubJwk: PUB, pressCodeHash: '', streamOpen: true, pressOpen: false, retentionSec: 3600, createdAt: T0, inhaber: fremd }), { expirationTtl: 3600 });
    const holt = await anfrage(env, 'GET', `/qa/${EVENT}/pending`, { kopf: bearer(await freigabe(EVENT, { kid: 'k-neu', gid: 'g-neu' })) });
    const auf = await anfrage(env, 'POST', `/qa/${EVENT}`, { kopf: bearer(await freigabe(EVENT, { kid: 'k-neu', gid: 'g-neu' })), body: { pubJwk: PUB } });
    check('Z3: ein altes inhaber-Feld in der Meta wird ignoriert (200), und das Öffnen schreibt keinen Inhaber nach KV',
      holt.status === 200 && auf.status === 200 && env.QA_RELAY.daten.get(`qa:${EVENT}:meta`)?.wert.includes('inhaber') === false);
  }
  // Fällt der DO aus oder fehlt die Bindung, antwortet jede Admin-Route mit 503 (nie offen), und nichts wird geschrieben.
  {
    const wirft = { jurisdiction() { return wirft; }, idFromName: () => ({}), get: () => ({ fetch: async () => { throw new Error('DO weg'); } }) };
    const fuenfhundert = { jurisdiction() { return fuenfhundert; }, idFromName: () => ({}), get: () => ({ fetch: async () => Response.json({ ok: false, code: 'server', status: 500 }, { status: 500 }) }) };
    const kaputt = { jurisdiction() { return kaputt; }, idFromName: () => ({}), get: () => ({ fetch: async () => new Response('keine json', { status: 200 }) }) };
    const ROUTEN = [
      { name: 'öffnen', m: 'POST', p: `/qa/${EVENT}`, body: { pubJwk: PUB } },
      { name: 'pending', m: 'GET', p: `/qa/${EVENT}/pending` },
      { name: 'ack', m: 'POST', p: `/qa/${EVENT}/ack`, body: { ids: [] } },
      { name: 'löschen', m: 'DELETE', p: `/qa/${EVENT}` },
    ];
    const DOS = [
      { name: 'DO wirft', mehr: { KONTO: wirft } },
      { name: 'DO antwortet 500', mehr: { KONTO: fuenfhundert } },
      { name: 'DO antwortet ohne JSON', mehr: { KONTO: kaputt } },
      { name: 'Bindung KONTO fehlt', mehr: { KONTO: undefined } },
    ];
    const ZUG = [
      { name: 'Freigabe', kopf: bearer(await freigabe(EVENT)) },
      { name: 'alter Schlüssel', kopf: { 'X-Proxy-Key': PROXY } },
    ];
    const faelle = DOS.flatMap((d) => ZUG.flatMap((z) => ROUTEN.map((r) => ({ name: `${d.name} · ${z.name} · ${r.name}`, d, z, r }))));
    const stand = [];
    await pruefeFaelle('Z3: Inhaber-Prüfung nicht erreichbar → 503 (S5) statt offen, nichts geschrieben', faelle, async ({ d, z, r }) => {
      const env = umgebung(d.mehr);
      const a = await anfrage(env, r.m, r.p, { body: r.body, kopf: z.kopf });
      stand.push(env.QA_RELAY.daten.size);
      return a.status === 503 && a.daten && a.daten.code === 'nicht-eingerichtet' ? null : `ist ${a.status} ${a.text.slice(0, 60)}, soll 503`;
    });
    check('Z3: bei ausgefallenem DO bleibt KV unberührt', stand.every((n) => n === 0));
  }
  // Z3 AR83: Der Inhaber gilt mindestens bis zum Ende der Aufbewahrung des Events (createdAt + retentionSec), auch wenn niemand
  // mehr zugreift. Die Meta mit 7 Tagen steht direkt in KV (qaOpen kappt selbst auf 48 h).
  {
    const TAG7 = 7 * TAG;
    const uhr = { t: T0 };
    const env = umgebung({ KONTO_UHR: () => uhr.t });
    const teamA = bearer(await freigabe(EVENT, { kid: 'k-a', gid: 'g-a', iat: T0, exp: T0 + 20 * TAG }));
    const fremd = bearer(await freigabe(EVENT, { kid: 'k-x', gid: 'g-x', iat: T0, exp: T0 + 20 * TAG }));
    await env.QA_RELAY.put(`qa:${EVENT}:meta`, JSON.stringify({ pubJwk: PUB, pressCodeHash: '', streamOpen: false, pressOpen: false, retentionSec: 7 * 86400, createdAt: T0 }), { expirationTtl: 7 * 86400 });
    await anfrage(env, 'GET', `/qa/${EVENT}/pending`, { kopf: teamA }); // bindet
    const bisImDo = () => env.KONTO.speicher().ctx.daten.get(`qa:${await_hash}`)?.bis;
    const await_hash = await eventHash(EVENT);
    const nachBindung = bisImDo();
    uhr.t = T0 + 3 * TAG; // nichts getan
    const fremd3 = await anfrage(env, 'GET', `/qa/${EVENT}/pending`, { kopf: fremd });
    uhr.t = T0 + 6 * TAG; // 6 Tage: die 48 h ab dem letzten Zugriff (Tag 0) sind lange um, das Event lebt noch
    const fremd6 = await anfrage(env, 'GET', `/qa/${EVENT}/pending`, { kopf: fremd });
    uhr.t = T0 + TAG7 + 2 * 3600_000; // nach Ende der Aufbewahrung (plus Puffer), ohne Zugriff seit Tag 0: frei
    const fremdNach = await anfrage(env, 'GET', `/qa/${EVENT}/pending`, { kopf: fremd });
    check('Z3 AR83: Event mit 7 Tagen Aufbewahrung, nichts getan → fremdes Konto nach 3 und 6 Tagen 403; nach dem Ende ist das Event frei',
      nachBindung >= T0 + TAG7 && fremd3.status === 403 && fremd6.status === 403 && fremdNach.status === 200);
  }
  // Das erste Öffnen kennt die Meta noch nicht: danach reicht der Inhaber trotzdem bis zum Ende der Aufbewahrung.
  {
    const env = umgebung();
    const a = await anfrage(env, 'POST', `/qa/${EVENT}`, { kopf: bearer(await freigabe(EVENT, { kid: 'k-a', gid: 'g-a' })), body: { pubJwk: PUB, retentionSec: 3600 } });
    const bis1 = env.KONTO.speicher().ctx.daten.get(`qa:${await eventHash(EVENT)}`)?.bis;
    // Meta nachträglich auf 10 Tage setzen und erneut abholen: bis wächst (nie über 30 Tage ab jetzt), schrumpft aber nie
    await env.QA_RELAY.put(`qa:${EVENT}:meta`, JSON.stringify({ pubJwk: PUB, retentionSec: 10 * 86400, createdAt: T0 }));
    await anfrage(env, 'GET', `/qa/${EVENT}/pending`, { kopf: bearer(await freigabe(EVENT, { kid: 'k-a', gid: 'g-a' })) });
    const bis2 = env.KONTO.speicher().ctx.daten.get(`qa:${await eventHash(EVENT)}`)?.bis;
    await env.QA_RELAY.put(`qa:${EVENT}:meta`, JSON.stringify({ pubJwk: PUB, retentionSec: 60, createdAt: T0 }));
    await anfrage(env, 'GET', `/qa/${EVENT}/pending`, { kopf: bearer(await freigabe(EVENT, { kid: 'k-a', gid: 'g-a' })) });
    const bis3 = env.KONTO.speicher().ctx.daten.get(`qa:${await eventHash(EVENT)}`)?.bis;
    check('Z3 AR83: erstes Öffnen bindet mit jetzt + 48 h + 1 h Puffer (Meta fehlt noch); bis wächst mit der Meta und wird nie kleiner',
      a.status === 200 && bis1 === T0 + 49 * 3600_000 && bis2 === T0 + 10 * TAG + 3600_000 && bis3 === bis2);
  }
  // M4: Der Nachzug nach dem ersten Öffnen: mit fortlaufender Uhr (+1 ms je Aufruf) liegt createdAt der Meta nach dem Binden; ohne
  // den Nachzug reichte der Inhaber nur bis (Binde-Zeit + 48 h), nicht bis zum Meta-Ende plus Puffer.
  {
    let tick = T0;
    const env = umgebung({ KONTO_UHR: () => tick++ });
    const a = await anfrage(env, 'POST', `/qa/${EVENT}`, { kopf: bearer(await freigabe(EVENT, { kid: 'k-a', gid: 'g-a' })), body: { pubJwk: PUB } });
    const meta = JSON.parse(env.QA_RELAY.daten.get(`qa:${EVENT}:meta`)?.wert ?? '{}');
    const bis = env.KONTO.speicher().ctx.daten.get(`qa:${await eventHash(EVENT)}`)?.bis;
    check('Z3 AR83 M4: nach dem ersten Öffnen (fortlaufende Uhr) liegt der Inhaber mindestens 60 s hinter dem Meta-Ende (createdAt + retentionSec)',
      a.status === 200 && Number.isFinite(bis) && bis >= meta.createdAt + meta.retentionSec * 1000 + 60_000);
  }
  // AR89/I-A: Der Nachzug trägt nichts: Auch wenn er scheitert, bleibt der Inhaber nie unter Meta-Ende + 60 s (Einreichungs-Minimum).
  // Der Konten-DO wird hier so umhüllt, dass der N-te qa-inhaber-Aufruf wirft.
  {
    const umhuellt = (env, zaehler) => {
      const echt = makeKontoNs(env);
      const ns = {
        speicher: echt.speicher,
        anfragen: echt.anfragen,
        jurisdiction: (j) => {
          const n = echt.jurisdiction(j);
          return {
            idFromName: n.idFromName,
            get: (id) => {
              const s = n.get(id);
              return {
                fetch: async (r) => {
                  if (r.url.endsWith('/qa-inhaber')) {
                    zaehler.n++;
                    if (zaehler.n === zaehler.wirfBei) throw new Error('Nachzug weg');
                  }
                  return s.fetch(r);
                },
              };
            },
          };
        },
      };
      return ns;
    };
    const meta = (env) => JSON.parse(env.QA_RELAY.daten.get(`qa:${EVENT}:meta`)?.wert ?? '{}');
    const ende = (env) => meta(env).createdAt + meta(env).retentionSec * 1000;
    const fremdBei = async (env, t, uhr) => {
      uhr.t = t;
      return anfrage(env, 'GET', `/qa/${EVENT}/pending`, { kopf: bearer(await freigabe(EVENT, { kid: 'k-x', gid: 'g-x' })) });
    };
    const teamA = async () => bearer(await freigabe(EVENT, { kid: 'k-a', gid: 'g-a' }));
    const oeffnen = async (env) => anfrage(env, 'POST', `/qa/${EVENT}`, { kopf: await teamA(), body: { pubJwk: PUB } });
    const STD = 3600_000;

    // A: tickende Uhr; erneutes Öffnen bei T0 + 2 h, der Nachzug scheitert → Fremder bei Meta-Ende − 30 min: 403
    {
      const uhr = { t: T0 };
      const zaehler = { n: 0, wirfBei: 0 };
      const env = umgebung({ KONTO_UHR: () => uhr.t++ });
      env.KONTO = umhuellt(env, zaehler);
      await oeffnen(env);
      uhr.t = T0 + 2 * STD;
      zaehler.n = 0;
      zaehler.wirfBei = 2; // 1 = Prüfung vor dem Öffnen, 2 = Nachzug
      const vorher = protokoll.length;
      const wieder = await oeffnen(env);
      const frei = await fremdBei(env, ende(env) - 30 * 60_000, uhr);
      check('Z3 AR89 I-A (a): erneutes Öffnen bei +2 h, Nachzug scheitert (Warnzeile, Öffnen bleibt 200) → Fremder 30 min vor dem Meta-Ende: 403',
        wieder.status === 200 && frei.status === 403 && protokoll.slice(vorher).some((z) => z.startsWith('qa-relay: Nachzug des Inhabers nach dem Öffnen fehlgeschlagen (status=503)')));
    }
    // B: feste Uhr, Öffnen bei T0 → Fremder bei Meta-Ende + 30 s: 403 (Einreichungen leben bis zu 60 s über das Ende)
    {
      const uhr = { t: T0 };
      const env = umgebung({ KONTO_UHR: () => uhr.t });
      await oeffnen(env);
      const frei = await fremdBei(env, ende(env) + 30_000, uhr);
      check('Z3 AR89 I-A (b): feste Uhr, Öffnen bei T0 → Fremder 30 s nach dem Meta-Ende: 403', frei.status === 403);
    }
    // C: feste Uhr; erneutes Öffnen bei T0 + 1 h (neues Meta-Ende genau 1 h später), Nachzug scheitert → Fremder 30 s nach dem Ende: 403
    {
      const uhr = { t: T0 };
      const zaehler = { n: 0, wirfBei: 0 };
      const env = umgebung({ KONTO_UHR: () => uhr.t });
      env.KONTO = umhuellt(env, zaehler);
      await oeffnen(env);
      uhr.t = T0 + STD;
      zaehler.n = 0;
      zaehler.wirfBei = 2;
      await oeffnen(env);
      const frei = await fremdBei(env, ende(env) + 30_000, uhr);
      check('Z3 AR89 I-A (c): feste Uhr, erneutes Öffnen bei +1 h, Nachzug scheitert → Fremder 30 s nach dem Meta-Ende: 403 (Schritt kleiner als der Puffer)', frei.status === 403);
    }
  }
  // I1: Eine Einreichung lebt nie länger als das Event: die KV-Laufzeit wird auf die Restlaufzeit der Meta gekappt (mindestens 60 s).
  {
    const uhr = { t: T0 };
    const env = umgebung({ KONTO_UHR: () => uhr.t });
    const teamA = bearer(await freigabe(EVENT, { kid: 'k-a', gid: 'g-a' }));
    const fremd = bearer(await freigabe(EVENT, { kid: 'k-x', gid: 'g-x' }));
    await anfrage(env, 'POST', `/qa/${EVENT}`, { kopf: teamA, body: { pubJwk: PUB } }); // 48 h
    const meta = JSON.parse(env.QA_RELAY.daten.get(`qa:${EVENT}:meta`)?.wert ?? '{}');
    const ende = meta.createdAt + meta.retentionSec * 1000;
    uhr.t = T0 + 47 * 3600_000;
    const s1 = await anfrage(env, 'POST', `/qa/${EVENT}/submit`, { body: umschlag(1) });
    uhr.t = ende - 10_000; // 10 s vor dem Ende: die Untergrenze von KV (60 s) gilt
    const s2 = await anfrage(env, 'POST', `/qa/${EVENT}/submit`, { body: umschlag(2) });
    const posten = [...env.QA_RELAY.daten.entries()].filter(([k]) => k.startsWith(`qa:${EVENT}:i:`));
    const ttls = posten.map(([, e]) => e.ttl).sort((x, y) => x - y);
    const lebtBis = Math.max(...posten.map(([, e]) => (JSON.parse(e?.wert ?? '{}').at ?? Infinity) + e?.ttl * 1000));
    uhr.t = ende; // am Meta-Ende: der Inhaber gilt noch (bis ≥ Meta-Ende), und damit leben auch die letzten Einreichungen noch
    const fremdEnde = await anfrage(env, 'GET', `/qa/${EVENT}/pending`, { kopf: fremd });
    check('Z3 AR83 I1: Einreichung bei 47 h lebt 1 h (Rest der Meta, nicht 48 h), bei 10 s vor dem Ende 60 s (KV-Minimum); die letzte lebt nur 50 s über das Ende hinaus; fremdes Konto am Meta-Ende → 403',
      s1.status === 200 && s2.status === 200 && ttls.length === 2 && ttls[0] === 60 && ttls[1] === 3600 && lebtBis <= ende + 60_000 && fremdEnde.status === 403);
  }
  // I2: Der alte Schlüssel ist öffentlich; seine Q&A-Admin-Anfragen werden vor dem Konten-DO je IP gedrosselt (Bindung KONTO_RL_QAALT).
  {
    const rl = makeRateLimit(3);
    const env = umgebung({ ALTKEY_BIS: VOR, KONTO_RL_QAALT: rl });
    const alt = { 'X-Proxy-Key': PROXY };
    const antworten = [];
    for (let i = 0; i < 5; i++) antworten.push(await anfrage(env, 'GET', `/qa/${EVENT}/pending`, { kopf: alt }));
    const inhaberAufrufe = () => env.KONTO.anfragen.filter((x) => x.url.endsWith('/qa-inhaber')).length;
    const drosselung = antworten.map((r) => r.status);
    const rlEnv = umgebung({ ALTKEY_BIS: VOR, KONTO_RL_QAALT: makeRateLimit(3) });
    const mitFreigabe = [];
    for (let i = 0; i < 5; i++) mitFreigabe.push((await anfrage(rlEnv, 'GET', `/qa/${EVENT}/pending`, { kopf: bearer(await freigabe(EVENT)) })).status);
    const wirft = makeRateLimit(3, { wirft: Object.assign(new Error('test'), { name: 'TestFehler' }) });
    const offenWirft = await anfrage(umgebung({ ALTKEY_BIS: VOR, KONTO_RL_QAALT: wirft }), 'GET', `/qa/${EVENT}/pending`, { kopf: alt });
    const offenOhne = await anfrage(umgebung({ ALTKEY_BIS: VOR }), 'GET', `/qa/${EVENT}/pending`, { kopf: alt });
    check('Z3 AR87 I2: alter Key an den Q&A-Admin-Routen: die 4. und 5. Anfrage je IP → 429 (Retry-After 60) ohne Aufruf des Konten-DO (3 Aufrufe)',
      drosselung.join() === '200,200,200,429,429' && antworten[3]?.kopf.get('Retry-After') === '60' && inhaberAufrufe() === 3);
    check('Z3 AR87 I2: Freigaben zählen nicht in KONTO_RL_QAALT (nie gedrosselt, kein limit()-Aufruf); fehlende Bindung oder Wurf → offen (200)',
      mitFreigabe.every((s) => s === 200) && rlEnv.KONTO_RL_QAALT.aufrufe.length === 0 && offenWirft.status === 200 && offenOhne.status === 200);
  }
  // M6: Eine unerwartete DO-Antwort (nicht 403) steht im Log: nur code, status und diagnose, nie Werte.
  {
    const vorher = protokoll.length;
    const ns = { jurisdiction() { return ns; }, idFromName: () => ({}), get: () => ({ fetch: async () => Response.json({ ok: false, code: 'server', status: 500, diagnose: 'TypeError' }, { status: 500 }) }) };
    const a = await anfrage(umgebung({ KONTO: ns }), 'GET', `/qa/${EVENT}/pending`, { kopf: bearer(await freigabe(EVENT)) });
    check('Z3 M6: DO antwortet 500 → 503 und eine Warnzeile mit code, status und diagnose',
      a.status === 503 && protokoll.slice(vorher).some((z) => z === 'qa-relay: Inhaber-Prüfung vom Konten-DO abgelehnt (code=server, status=500, diagnose=TypeError)'));
    // N1: Was kein Bezeichner ist (Leerzeichen, Umbruch, Geheimnis-artiger Text), erscheint nie im Log, nur ein Fragezeichen.
    const vorher2 = protokoll.length;
    const ns2 = { jurisdiction() { return ns2; }, idFromName: () => ({}), get: () => ({ fetch: async () => Response.json({ ok: false, code: 'a b', status: 500, diagnose: 'test-geheim\nzeile zwei' }, { status: 500 }) }) };
    const b = await anfrage(umgebung({ KONTO: ns2 }), 'GET', `/qa/${EVENT}/pending`, { kopf: bearer(await freigabe(EVENT)) });
    const neu = protokoll.slice(vorher2);
    check('Z3 N1: ein Wert, der kein Bezeichner ist, wird zu „?“ (code und diagnose), nie im Klartext geloggt',
      b.status === 503 && neu.includes('qa-relay: Inhaber-Prüfung vom Konten-DO abgelehnt (code=?, status=500, diagnose=?)') && !neu.join('\n').includes('test-geheim'));
  }
  // Quelltext: keine Inhaber-Logik in KV mehr; die Prüfung geht über die DO-Aktion.
  {
    const q = readFileSync(new URL('../qa-relay.js', import.meta.url), 'utf8');
    check('Z3 Quelltext: qa-relay.js ruft qa-inhaber im Konten-DO und liest meta.inhaber nicht mehr',
      q.includes("kontoAktion(env, 'qa-inhaber'") && !q.includes('meta.inhaber') && !q.includes('inhaber: neu'));
  }

  // ── Ende der Fälle ──

  const alles = protokoll.join('\n');
  check('P19 G4: Konsole ohne Proxy-Key, Schlüssel und Token', !alles.includes(PROXY) && !alles.includes(SCHLUESSEL) && !alles.includes('jm1.'));
}

run()
  .catch((e) => {
    check(`qa-relay: Test-Harness ohne Ausnahme (${e && e.name}: ${e && e.message})`, false);
  })
  .finally(() => {
    console.warn = realWarn;
    console.error = realError;
    abschluss();
  });
