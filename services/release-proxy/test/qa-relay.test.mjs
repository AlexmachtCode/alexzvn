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
import { abschluss, check, makeKV, makeWaitCtx, pruefeFaelle, testSchluessel } from './konto-attrappen.mjs';

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
  return { PROXY_KEY: PROXY, KONTO_SCHLUESSEL: SCHLUESSEL, KONTO_UHR: () => T0, QA_RELAY: makeKV(), RATELIMIT: makeKV(), ...mehr };
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
    const a = await anfrage(umgebung({ KONTO: ns, ALTKEY_BIS: VOR }), 'GET', `/qa/${EVENT}/pending`, { kopf: { 'X-Proxy-Key': PROXY }, ctx });
    await ctx.fertig();
    const ctx2 = makeWaitCtx();
    await anfrage(umgebung({ KONTO: ns }), 'GET', `/qa/${EVENT}/pending`, { kopf: bearer(await freigabe(EVENT)), ctx: ctx2 });
    await ctx2.fertig();
    check('P19 OF2: alter Key an /qa/* → eine Zählung (Gruppe qa, Plattform unbekannt); Freigabe zählt nicht',
      a.status === 200 && anfragen.length === 1 && JSON.stringify(anfragen[0]) === JSON.stringify({ jetzt: T0, gruppe: 'qa', plattform: 'unbekannt', arch: '' }));
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
    const ttl = env.QA_RELAY.daten.get(`qa:${ANDERES}:meta`).ttl;
    faelle.push({ name: 'Übergang: das Binden behält die Restlaufzeit (48 h)', a: { status: ttl > 172_000 && ttl <= 172_800 ? 200 : ttl }, soll: 200 });
    await pruefeFaelle('P19 EP33: ein Event gehört der Freigabe, die es zuerst geöffnet hat (Konto oder Rechner)', faelle, (f) =>
      f.a.status === f.soll && (f.soll !== 403 || (f.a.daten && f.a.daten.code === 'keine-freigabe' && f.a.daten.error === FEHLER_TEXT['keine-freigabe']))
        ? null
        : `ist ${f.a.status} ${f.a.daten ? f.a.daten.code ?? f.a.daten.error ?? '' : ''}, soll ${f.soll}`);
    const pub = await anfrage(env, 'GET', `/qa/${EVENT}/pubkey`);
    const offen = await anfrage(env, 'GET', `/qa/${EVENT}/pending`, { kopf: teamB });
    const ablage = [...env.QA_RELAY.daten.values()].map((e) => e.wert).join('\n');
    check('P19 EP33: danach gilt der Schlüssel von Team B, die Einreichung ist noch da; Konto und Rechner stehen nur als Hash in der Ablage',
      auf.status === 200 && pub.daten && pub.daten.jwk && pub.daten.jwk.n === 'test-modulus-team-b' && offen.daten && offen.daten.items.length === 1
        && ablage.includes('"inhaber"') && !['k-team-b', 'g-regie-1'].some((w) => ablage.includes(w)));
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
      r.status !== 401 && offen.length === 1 && zaehlungen.length === 1 && zaehlungen[0].gruppe === 'qa',
    );
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
