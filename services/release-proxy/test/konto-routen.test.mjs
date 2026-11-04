// Launcher-API /konto/* über worker.fetch (Anmeldung im Launcher, Plan Teil 1, P16; P17 und P18 fügen vor der Ende-Marke ein).
//   node --experimental-strip-types services/release-proxy/test/konto-routen.test.mjs
// Ohne Netz und ohne Cloudflare: Bindung KONTO = makeKontoNs (echte KontoSpeicher-Instanz je Name und Jurisdiction),
// RATELIMIT = makeKV, Uhr = makeUhr über env.KONTO_UHR (EP21), fetch-Attrappe für GitHub (und ab P18 Google). Schritte der
// Anmeldeseite, die erst P17/P18 als HTTP-Routen bringen, laufen hier direkt als DO-Aktion (rufeDo). Schlüssel entstehen zur
// Laufzeit (G4). Nicht über tsx (Kopf von worker.test.mjs).
import { readFileSync } from 'node:fs';
import worker from '../worker.js';
import { handleKonto } from '../konto-relay.js';
import { pruefeToken } from '../konto-krypto.js';
import { FEHLER_TEXT, KONFLIKT_TEXT } from '../konto-zugang.js';
import { abschluss, check, makeKontoNs, makeKV, makeUhr, makeWaitCtx, pruefeFaelle, rufeDo, testGeraet, testSchluessel } from './konto-attrappen.mjs';

// Konsole mitschneiden: erwartete Warnungen und die Prüfung „kein Geheimnis im Log“ am Ende.
const protokoll = [];
const realLog = console.log;
const realWarn = console.warn;
const realError = console.error;
const mitschnitt = (...a) => protokoll.push(a.map(String).join(' '));
console.warn = mitschnitt;
console.error = mitschnitt;
/** Alles, was nie in der Konsole stehen darf (Sitzungen, Abholgeheimnisse, Codes, Passwörter, Tokens, Schlüssel). */
const geheim = [];

const TAG = 24 * 3600_000;
const T0 = Date.parse('2026-11-02T10:00:00Z');
const SCHLUESSEL = testSchluessel();
const IVEO = testSchluessel();
const ERSTER = 'chefin@jakobsmedien.com';
geheim.push(SCHLUESSEL, IVEO);

globalThis.fetch = async (u) => {
  const url = String(u);
  if (url.includes('/contents/')) return new Response('{"tools":[]}', { status: 200 });
  return new Response('{}', { status: 404 });
};

/** Frische Umgebung je Testblock: eigene Uhr, eigener DO, eigene Drossel. */
function umgebung(mehr = {}, nsOpt = {}) {
  const env = {
    PROXY_KEY: 'test-proxy-key', GITHUB_TOKEN: 'gh', REPO: 'owner/repo', KONTO_SCHLUESSEL: SCHLUESSEL, IVEO_SCHLUESSEL: IVEO,
    ERSTER_ADMIN: ERSTER, KONTO_UHR: makeUhr(T0), RATELIMIT: makeKV(), ...mehr,
  };
  if (!('KONTO' in mehr)) env.KONTO = makeKontoNs(env, nsOpt);
  return env;
}

/** Alle Antworten mit Status ≥ 400 (für die Prüfung der Fehlerform am Ende). */
const fehlerAntworten = [];
const jsonAntworten = [];

async function api(env, methode, pfad, { body, sitzung, kopf = {}, ip = '9.9.9.9', roh } = {}) {
  const h = { 'CF-Connecting-IP': ip, ...kopf };
  if (sitzung) h.Authorization = `Bearer ${sitzung}`;
  const init = { method: methode, headers: h };
  if (roh !== undefined) init.body = roh;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    h['content-type'] = 'application/json';
  }
  const ctx = makeWaitCtx();
  const res = await worker.fetch(new Request('https://proxy.test' + pfad, init), env, ctx);
  await ctx.fertig();
  const text = await res.text();
  let daten = null;
  try {
    daten = JSON.parse(text);
  } catch {
    daten = null;
  }
  const a = { status: res.status, daten, text, kopf: res.headers, pfad };
  if ((res.headers.get('content-type') || '').startsWith('application/json')) jsonAntworten.push(a);
  if (res.status >= 400 && pfad.startsWith('/konto')) fehlerAntworten.push(a);
  return a;
}

const soll = (a, status, code, konflikt) =>
  a.status === status && a.daten && a.daten.code === code && a.daten.error === (konflikt ? KONFLIKT_TEXT[konflikt] : FEHLER_TEXT[code]);
const ist = (a) => `${a.status} ${a.daten ? a.daten.code ?? JSON.stringify(a.daten).slice(0, 80) : a.text.slice(0, 80)}`;

/** Der erste Admin über Google (ERSTER_ADMIN) → kid. */
async function ersterAdmin(env) {
  const r = await rufeDo(env.KONTO.speicher(), 'konto-aus-google', { email: ERSTER, name: 'Chefin Test' });
  return r.kid;
}

/** Externen einladen (als erster Admin) → Einladungscode. */
async function einladen(env, adminKid, email, mehr = {}) {
  const r = await rufeDo(env.KONTO.speicher(), 'admin-aktion', {
    kid: adminKid,
    aktion: { aktion: 'einladen', email, name: mehr.name ?? 'Erika Extern', tools: mehr.tools ?? [], events: mehr.events ?? [], bis: mehr.bis ?? env.KONTO_UHR() + 60 * TAG },
  });
  geheim.push(r.einladungscode);
  return r.einladungscode;
}

/**
 * Anmeldung wie in Spec 4.1, Schritte der Seite als DO-Aktion: Vorgang über HTTP, Anmelden (Google oder Einladung mit neuem
 * Passwort), Bestätigen, Abholen über HTTP. → { sitzung, stand, geraet, vorgang }.
 */
async function anmelden(env, o) {
  const sp = env.KONTO.speicher();
  const geraet = o.geraet ?? (await testGeraet({ name: o.rechner ?? 'Regie-PC 1' }));
  const v = await api(env, 'POST', '/konto/vorgang', { body: { geraet: geraet.angaben } });
  geheim.push(v.daten.abholGeheimnis, v.daten.code);
  let bind;
  if (o.google) {
    const g = await rufeDo(sp, 'konto-aus-google', { email: o.email, name: o.name ?? 'Karl Kollege' });
    bind = await rufeDo(sp, 'vorgang-konto-binden', { vorgang: v.daten.vorgang, kid: g.kid });
  } else {
    geheim.push(o.passwort);
    bind = await rufeDo(sp, 'vorgang-passwort', { vorgang: v.daten.vorgang, email: o.email, einladungscode: o.einladungscode, neu: o.passwort, neu2: o.passwort });
  }
  await rufeDo(sp, 'vorgang-bestaetigen', { vorgang: v.daten.vorgang, seitenToken: bind.seitenToken, antwort: 'ja' });
  const ab = await api(env, 'POST', '/konto/vorgang/abholen', {
    body: { vorgang: v.daten.vorgang, abholGeheimnis: v.daten.abholGeheimnis, beweis: await geraet.beweis('abholen', v.daten.vorgang, env.KONTO_UHR()) },
  });
  if (!ab.daten || !ab.daten.sitzung) throw new Error(`Anmeldung ${o.email} gescheitert: ${ist(ab)}`);
  geheim.push(ab.daten.sitzung);
  return { sitzung: ab.daten.sitzung, stand: ab.daten.stand, geraet, vorgang: v.daten.vorgang };
}

async function erneuern(env, s, geraet = s.geraet, ts = env.KONTO_UHR()) {
  const r = await api(env, 'POST', '/konto/sitzung', {
    sitzung: s.sitzung,
    body: { beweis: await geraet.beweis('erneuern', s.stand.kid, ts), version: '0.18.0', rechnerName: 'Regie-PC 1' },
  });
  if (r.daten && r.daten.sitzung) geheim.push(r.daten.sitzung);
  return r;
}

async function run() {
  // P16 4.1: der ganze Ablauf über HTTP, die Seite (P17) hier als DO-Aktion.
  {
    const env = umgebung();
    const uhr = env.KONTO_UHR;
    const geraet = await testGeraet();
    const v = await api(env, 'POST', '/konto/vorgang', { body: { geraet: geraet.angaben } });
    const d = v.daten || {};
    geheim.push(d.abholGeheimnis, d.code);
    check('P16 4.1: POST /konto/vorgang → 200 mit Vorgang, Abholgeheimnis, Code XXX-XXX, Adresse und bis = jetzt + 5 min',
      v.status === 200 && typeof d.vorgang === 'string' && typeof d.abholGeheimnis === 'string' && d.abholGeheimnis.length >= 40
        && /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}$/.test(d.code)
        && d.adresse === `https://proxy.test/konto/anmelden?v=${encodeURIComponent(d.vorgang)}` && d.bis === T0 + 5 * 60_000);
    const speicherText = JSON.stringify([...env.KONTO.speicher().ctx.daten.values()]);
    check('P16 4.1: der DO kennt das Abholgeheimnis nur als Hash', !speicherText.includes(d.abholGeheimnis) && speicherText.includes(d.code));
    const abholen = async (g = geraet, geh = d.abholGeheimnis) =>
      api(env, 'POST', '/konto/vorgang/abholen', { body: { vorgang: d.vorgang, abholGeheimnis: geh, beweis: await g.beweis('abholen', d.vorgang, uhr()) } });
    const w = await abholen();
    const fremd = await abholen(await testGeraet());
    const falsch = await abholen(geraet, 'test-falsches-geheimnis');
    // EP30: die Uhr des Rechners geht 6 min falsch → 400 S18 vor dem DO, der Vorgang bleibt offen.
    const uhrFalsch = await api(env, 'POST', '/konto/vorgang/abholen', {
      body: { vorgang: d.vorgang, abholGeheimnis: d.abholGeheimnis, beweis: await geraet.beweis('abholen', d.vorgang, uhr() + 6 * 60_000) },
    });
    check('P16 4.1: Abholen vor der Bestätigung → wartet; fremdes Gerät → 403 S9; falsches Abholgeheimnis → 404 S10; Uhr 6 min daneben → 400 S18',
      w.status === 200 && w.daten.zustand === 'wartet' && soll(fremd, 403, 'geraet-unbekannt') && soll(falsch, 404, 'vorgang-unbekannt')
        && soll(uhrFalsch, 400, 'uhr'));
    const sp = env.KONTO.speicher();
    const g = await rufeDo(sp, 'konto-aus-google', { email: 'karl@jakobsmedien.com', name: 'Karl Kollege' });
    const bind = await rufeDo(sp, 'vorgang-konto-binden', { vorgang: d.vorgang, kid: g.kid });
    await rufeDo(sp, 'vorgang-bestaetigen', { vorgang: d.vorgang, seitenToken: bind.seitenToken, antwort: 'ja' });
    uhr.vor(30_000);
    const b = await abholen();
    const s = b.daten || {};
    geheim.push(s.sitzung);
    const claims = s.sitzung ? await pruefeToken(SCHLUESSEL, s.sitzung, 'sitzung', uhr()) : null;
    check('P16 4.1: nach Ja → bestaetigt mit Sitzung (jm1., prüfbar) und Stand Kollege, Gerät und 30 Tage',
      b.status === 200 && s.zustand === 'bestaetigt' && !!claims && claims.kid === g.kid && claims.stufe === 'kollege'
        && claims.gid === geraet.gid && claims.exp === uhr() + 30 * TAG && JSON.stringify(s.stand) === JSON.stringify(claims));
    const nochmal = await abholen();
    check('P16 4.1: zweites Abholen → 404 S10', soll(nochmal, 404, 'vorgang-unbekannt'));
    const katalog = await api(env, 'GET', '/suite.json', { sitzung: s.sitzung });
    check('P16 4.1: die Sitzung öffnet das Gate (GET /suite.json → 200)', katalog.status === 200);
    const v2 = await api(env, 'POST', '/konto/vorgang', { body: { geraet: geraet.angaben } });
    geheim.push(v2.daten.abholGeheimnis, v2.daten.code);
    const ab1 = await api(env, 'POST', '/konto/vorgang/abbrechen', { body: { vorgang: v2.daten.vorgang, abholGeheimnis: 'test-falsch' } });
    const ab2 = await api(env, 'POST', '/konto/vorgang/abbrechen', { body: { vorgang: v2.daten.vorgang, abholGeheimnis: v2.daten.abholGeheimnis } });
    const ab3 = await api(env, 'POST', '/konto/vorgang/abholen', {
      body: { vorgang: v2.daten.vorgang, abholGeheimnis: v2.daten.abholGeheimnis, beweis: await geraet.beweis('abholen', v2.daten.vorgang, uhr()) },
    });
    check('P16 4.1: Abbrechen nur mit Abholgeheimnis (sonst 404 S10); danach ist der Vorgang weg',
      soll(ab1, 404, 'vorgang-unbekannt') && ab2.status === 200 && ab2.daten.ok === true && soll(ab3, 404, 'vorgang-unbekannt'));
    // Klasse „Code abgelaufen“: genau 5 min nach dem Anlegen gilt der Vorgang nicht mehr (Frist VORGANG_MS, EP5).
    const v3 = await api(env, 'POST', '/konto/vorgang', { body: { geraet: geraet.angaben } });
    geheim.push(v3.daten.abholGeheimnis, v3.daten.code);
    uhr.vor(5 * 60_000);
    const spaet = async () => api(env, 'POST', '/konto/vorgang/abholen', {
      body: { vorgang: v3.daten.vorgang, abholGeheimnis: v3.daten.abholGeheimnis, beweis: await geraet.beweis('abholen', v3.daten.vorgang, uhr()) },
    });
    const s1 = await spaet();
    const s2 = await spaet();
    check('P16 4.1: Code abgelaufen: Abholen genau 5 min nach dem Anlegen → abgelaufen, danach 404 S10',
      s1.status === 200 && s1.daten.zustand === 'abgelaufen' && soll(s2, 404, 'vorgang-unbekannt'));
    const kaputt = await api(env, 'POST', '/konto/vorgang', { body: { geraet: { name: 'ohne Schlüssel', plattform: 'win', arch: 'x64' } } });
    const keinJson = await api(env, 'POST', '/konto/vorgang', { roh: 'kein json', kopf: { 'content-type': 'application/json' } });
    // Zu große Anfrage laut content-length: 400 S11, ohne den Body zu lesen (Attrappe merkt sich arrayBuffer()).
    let gelesen = false;
    const gross = {
      method: 'POST',
      headers: new Headers({ 'content-length': String(1024 * 1024), 'CF-Connecting-IP': '9.9.9.8' }),
      arrayBuffer: async () => {
        gelesen = true;
        return new ArrayBuffer(0);
      },
    };
    const grossRes = await handleKonto(gross, env, new URL('https://proxy.test/konto/vorgang'), makeWaitCtx());
    const grossDaten = await grossRes.json();
    check('P16 4.1: Gerät ohne Schlüssel oder Body ohne JSON → 400 S11; zu großes content-length → 400 S11, Body ungelesen',
      soll(kaputt, 400, 'ungueltig') && soll(keinJson, 400, 'ungueltig')
        && grossRes.status === 400 && grossDaten.code === 'ungueltig' && grossDaten.error === FEHLER_TEXT.ungueltig && gelesen === false);
  }

  // P16 6.1: Start-Prüfung = Erneuerung mit Gerätebeweis; der DO liest den aktuellen Stand.
  {
    const env = umgebung();
    const uhr = env.KONTO_UHR;
    const admin = await ersterAdmin(env);
    const code = await einladen(env, admin, 'erika@extern.test', { bis: T0 + 2 * TAG });
    const erika = await anmelden(env, { email: 'erika@extern.test', einladungscode: code, passwort: 'test-passwort-erika' });
    const karl = await anmelden(env, { google: true, email: 'karl@jakobsmedien.com' });
    const sp = env.KONTO.speicher();
    await rufeDo(sp, 'admin-aktion', { kid: admin, aktion: { aktion: 'zugang-speichern', kid: erika.stand.kid, stufe: 'externer', tools: ['qa'], events: [], bis: T0 + 2 * TAG, zoomBis: null } });
    uhr.vor(TAG);
    const neu = await erneuern(env, erika);
    const c = neu.daten && neu.daten.sitzung ? await pruefeToken(SCHLUESSEL, neu.daten.sitzung, 'sitzung', uhr()) : null;
    check('P16 6.1: Erneuern → neue Sitzung mit dem aktuellen Stand aus dem DO (Werkzeug qa), iat jetzt, exp = iat + 30 Tage, Zugang bis als kontoBis',
      neu.status === 200 && !!c && JSON.stringify(c.tools) === '["qa"]' && c.iat === uhr() && c.exp === uhr() + 30 * TAG && c.kontoBis === T0 + 2 * TAG && c.gid === erika.geraet.gid);
    const fremd = await erneuern(env, erika, await testGeraet());
    // EP30: Uhr des Rechners 6 min vor bzw. nach → 400 S18 vor dem DO (kein „Rechner unbekannt“, das Konto bleibt unberührt).
    const uhrVor = await erneuern(env, erika, erika.geraet, uhr() + 6 * 60_000);
    const uhrNach = await erneuern(env, erika, erika.geraet, uhr() - 6 * 60_000);
    await rufeDo(sp, 'admin-aktion', { kid: admin, aktion: { aktion: 'zugang-speichern', kid: erika.stand.kid, stufe: 'externer', tools: ['qa'], events: [], bis: uhr() + 3600_000, zoomBis: null } });
    uhr.vor(2 * 3600_000);
    const abgelaufenDO = await erneuern(env, erika);
    await rufeDo(sp, 'admin-aktion', { kid: admin, aktion: { aktion: 'zugang-loeschen', kid: karl.stand.kid } });
    const gesperrt = await erneuern(env, karl);
    await rufeDo(sp, 'admin-aktion', { kid: admin, aktion: { aktion: 'zugang-loeschen', kid: erika.stand.kid } });
    const geloescht = await erneuern(env, erika);
    uhr.vor(31 * TAG);
    const alt = await erneuern(env, karl);
    const ohne = await api(env, 'POST', '/konto/sitzung', { body: {} });
    const faelle = [
      { name: 'fremdes Gerät', a: fremd, s: [403, 'geraet-unbekannt'] },
      { name: 'Uhr 6 min vor (EP30)', a: uhrVor, s: [400, 'uhr'] },
      { name: 'Uhr 6 min nach (EP30)', a: uhrNach, s: [400, 'uhr'] },
      { name: 'Zugang bis überschritten (DO)', a: abgelaufenDO, s: [403, 'zugang-abgelaufen'] },
      { name: 'Google-Konto gelöscht = gesperrt', a: gesperrt, s: [403, 'gesperrt'] },
      { name: 'Externer gelöscht', a: geloescht, s: [403, 'geloescht'] },
      { name: 'Sitzung älter als 30 Tage', a: alt, s: [401, 'sitzung-abgelaufen'] },
      { name: 'ohne Sitzung', a: ohne, s: [401, 'nicht-angemeldet'] },
    ];
    await pruefeFaelle('P16 6.1: Erneuern scheitert mit Grund', faelle, (f) => (soll(f.a, ...f.s) ? null : `ist ${ist(f.a)}`));
  }

  // P16 6.2: Freigabe aus den Claims (EP3), auch nach einer Sperre im DO; nie die Sitzung selbst.
  {
    const env = umgebung();
    const uhr = env.KONTO_UHR;
    const admin = await ersterAdmin(env);
    const karl = await anmelden(env, { google: true, email: 'karl@jakobsmedien.com' });
    const codeA = await einladen(env, admin, 'ohne@extern.test');
    const ohneQa = await anmelden(env, { email: 'ohne@extern.test', einladungscode: codeA, passwort: 'test-passwort-ohne' });
    const codeB = await einladen(env, admin, 'kurz@extern.test', { tools: ['qa'], bis: T0 + 10 * 3600_000 });
    const kurz = await anmelden(env, { email: 'kurz@extern.test', einladungscode: codeB, passwort: 'test-passwort-kurz' });
    await rufeDo(env.KONTO.speicher(), 'admin-aktion', { kid: admin, aktion: { aktion: 'zugang-loeschen', kid: karl.stand.kid } });
    const f = await api(env, 'POST', '/konto/freigabe', { sitzung: karl.sitzung, body: { zweck: 'qa-relay', ziel: 'qa-event-1' } });
    geheim.push(f.daten && f.daten.freigabe);
    const c = f.daten && f.daten.freigabe ? await pruefeToken(SCHLUESSEL, f.daten.freigabe, 'freigabe', uhr()) : null;
    check('P16 6.2: Freigabe für Q&A aus den Claims, auch nach Sperre im DO (bis = jetzt + 72 h, Zweck, Ziel, Konto, Gerät)',
      f.status === 200 && !!c && c.zweck === 'qa-relay' && c.ziel === 'qa-event-1' && c.kid === karl.stand.kid && c.gid === karl.geraet.gid
        && c.exp === uhr() + 72 * 3600_000 && f.daten.bis === c.exp);
    const alsSitzung = await api(env, 'GET', '/konto/ich', { sitzung: f.daten.freigabe });
    const katalog = await api(env, 'GET', '/suite.json', { sitzung: f.daten.freigabe });
    check('P16 6.2: eine Freigabe ist keine Sitzung (GET /konto/ich → 401 S1, GET /suite.json → 403 S3)',
      soll(alsSitzung, 401, 'nicht-angemeldet') && soll(katalog, 403, 'kein-recht'));
    const k = await api(env, 'POST', '/konto/freigabe', { sitzung: kurz.sitzung, body: { zweck: 'qa-relay', ziel: 'qa-event-1' } });
    geheim.push(k.daten && k.daten.freigabe);
    check('P16 6.2, 6.3: Freigabe läuft 72 h, auch über „Zugang bis“ hinaus (Externer mit qa, Zugang noch 10 h)', k.status === 200 && k.daten.bis === uhr() + 72 * 3600_000);
    const faelle = [
      { name: 'Externer ohne Werkzeug qa', a: await api(env, 'POST', '/konto/freigabe', { sitzung: ohneQa.sitzung, body: { zweck: 'qa-relay', ziel: 'qa-event-1' } }), s: [403, 'kein-recht'] },
      { name: 'unbekannter Zweck', a: await api(env, 'POST', '/konto/freigabe', { sitzung: karl.sitzung, body: { zweck: 'zoom-jwt', ziel: 'x1' } }), s: [400, 'unbekannter-zweck'] },
      { name: 'Ziel fehlt', a: await api(env, 'POST', '/konto/freigabe', { sitzung: karl.sitzung, body: { zweck: 'qa-relay' } }), s: [400, 'ungueltig'] },
      { name: 'Ziel mit Leerzeichen', a: await api(env, 'POST', '/konto/freigabe', { sitzung: karl.sitzung, body: { zweck: 'qa-relay', ziel: 'a b' } }), s: [400, 'ungueltig'] },
      { name: 'ohne Sitzung', a: await api(env, 'POST', '/konto/freigabe', { body: { zweck: 'qa-relay', ziel: 'qa-event-1' } }), s: [401, 'nicht-angemeldet'] },
    ];
    await pruefeFaelle('P16 6.2: Freigabe abgelehnt', faelle, (x) => (soll(x.a, ...x.s) ? null : `ist ${ist(x.a)}`));
  }

  // P16 6.4: iveo-Tokens: hinterlegt nur verschlüsselt, ausgegeben nur nach Recht, nie gecacht.
  {
    const env = umgebung();
    const admin = await ersterAdmin(env);
    const chefin = await anmelden(env, { google: true, email: ERSTER, name: 'Chefin Test' });
    const TOKEN = 'test-iveo-token-tagung';
    geheim.push(TOKEN);
    // Jeden Body an den DO mitschreiben: das Token darf ihn nie erreichen (EP13).
    const sp = env.KONTO.speicher();
    const doBodies = [];
    const doFetch = sp.fetch.bind(sp);
    sp.fetch = async (r) => {
      doBodies.push(await r.clone().text());
      return doFetch(r);
    };
    const h = await api(env, 'POST', '/konto/admin/aktion', {
      sitzung: chefin.sitzung,
      body: { aktion: 'iveo-hinterlegen', basis: 'https://iveo.example', events: [{ slug: 'tagung', name: 'Tagung 2026' }, { slug: 'messe', name: 'Messe' }], token: TOKEN },
    });
    const speicherText = JSON.stringify([...sp.ctx.daten.entries()]);
    const anDo = doBodies.filter((b) => b.includes('iveo-hinterlegen'));
    check('P16 6.4: iveo-hinterlegen → 200; der DO bekommt und speichert das Token nur verschlüsselt (je Event iv und ct)',
      h.status === 200 && h.daten.ok === true && anDo.length === 1 && !anDo[0].includes(TOKEN) && JSON.parse(anDo[0]).aktion.events.length === 2
        && JSON.parse(anDo[0]).aktion.events.every((e) => typeof e.iv === 'string' && typeof e.ct === 'string' && !('token' in e))
        && !speicherText.includes(TOKEN) && !doBodies.some((b) => b.includes(TOKEN)));
    const ue = await api(env, 'GET', '/konto/admin/uebersicht', { sitzung: chefin.sitzung });
    const tagung = (ue.daten.iveo || []).find((e) => e.slug === 'tagung');
    check('P16 6.4: die Übersicht nennt die Events ohne Token, iv und ct', !!tagung && !ue.text.includes(TOKEN) && !/"(iv|ct)"/.test(ue.text));
    const karl = await anmelden(env, { google: true, email: 'karl@jakobsmedien.com' });
    const code1 = await einladen(env, admin, 'iveo@extern.test', { tools: ['iveo'], events: [tagung.key] });
    const mitIveo = await anmelden(env, { email: 'iveo@extern.test', einladungscode: code1, passwort: 'test-passwort-iveo' });
    const code2 = await einladen(env, admin, 'qa@extern.test', { tools: ['qa'], events: [tagung.key] });
    const ohneIveo = await anmelden(env, { email: 'qa@extern.test', einladungscode: code2, passwort: 'test-passwort-qa' });
    const liste = async (s, e = env) => api(e, 'GET', '/konto/iveo', { sitzung: s.sitzung });
    const k = await liste(karl);
    const x = await liste(mitIveo);
    const o = await liste(ohneIveo);
    const slugs = (a) => (a.daten.events || []).map((e) => `${e.slug}:${e.token === TOKEN}`).sort().join(',');
    check('P16 6.4: Kollege bekommt alle Events mit Token; Externer mit iveo nur sein Event; Externer ohne iveo keins',
      k.status === 200 && slugs(k) === 'messe:true,tagung:true' && slugs(x) === 'tagung:true' && slugs(o) === '');
    check('P16 6.4: GET /konto/iveo mit cache-control no-store', k.kopf.get('cache-control') === 'no-store');
    const ohneSchluessel = { ...env, IVEO_SCHLUESSEL: undefined };
    const n = await liste(karl, ohneSchluessel);
    const n2 = await api(ohneSchluessel, 'POST', '/konto/admin/aktion', { sitzung: chefin.sitzung, body: { aktion: 'iveo-hinterlegen', basis: 'https://iveo.example', events: [{ slug: 'x', name: 'X' }], token: TOKEN } });
    // Ein unbrauchbarer Schlüssel (nicht genau 32 Byte) verhält sich wie ein fehlender, nicht wie ein 502.
    const kurzIveo = { ...env, IVEO_SCHLUESSEL: 'test-kurz' };
    const m = await liste(karl, kurzIveo);
    const m2 = await api(kurzIveo, 'POST', '/konto/admin/aktion', { sitzung: chefin.sitzung, body: { aktion: 'iveo-hinterlegen', basis: 'https://iveo.example', events: [{ slug: 'x', name: 'X' }], token: TOKEN } });
    check('P16 6.4: ohne IVEO_SCHLUESSEL leere Liste mit Hinweis; Hinterlegen → 503 S5; unbrauchbarer Schlüssel ebenso',
      n.status === 200 && JSON.stringify(n.daten) === '{"events":[],"hinweis":"iveo-nicht-eingerichtet"}' && soll(n2, 503, 'nicht-eingerichtet')
        && m.status === 200 && JSON.stringify(m.daten) === '{"events":[],"hinweis":"iveo-nicht-eingerichtet"}' && soll(m2, 503, 'nicht-eingerichtet'));
  }

  // P16 7: Admin-Routen nur für aktuelle Admins (der DO prüft den aktuellen Stand, OFP4); Konflikt-Texte S12a/S12b.
  {
    const env = umgebung();
    const admin = await ersterAdmin(env);
    const chefin = await anmelden(env, { google: true, email: ERSTER, name: 'Chefin Test' });
    const zweite = await anmelden(env, { google: true, email: 'zweite@jakobsmedien.com', name: 'Zweite Admin' });
    const sp = env.KONTO.speicher();
    await rufeDo(sp, 'admin-aktion', { kid: admin, aktion: { aktion: 'zugang-speichern', kid: zweite.stand.kid, stufe: 'admin', tools: [], events: [], bis: null, zoomBis: null } });
    const zweiteAdmin = await erneuern(env, zweite);
    const za = { ...zweite, sitzung: zweiteAdmin.daten.sitzung, stand: zweiteAdmin.daten.stand };
    const vorher = await api(env, 'GET', '/konto/admin/uebersicht', { sitzung: za.sitzung });
    await rufeDo(sp, 'admin-aktion', { kid: admin, aktion: { aktion: 'zugang-speichern', kid: zweite.stand.kid, stufe: 'kollege', tools: [], events: [], bis: null, zoomBis: null } });
    const karl = await anmelden(env, { google: true, email: 'karl@jakobsmedien.com' });
    const ue = await api(env, 'GET', '/konto/admin/uebersicht', { sitzung: chefin.sitzung });
    check('P16 7: Admin → Übersicht 200 (Zugänge, iveo, Anfragen, Geräte, Alt-Key) ohne ok-Feld',
      ue.status === 200 && Array.isArray(ue.daten.zugaenge) && ue.daten.zugaenge.length === 3 && Array.isArray(ue.daten.geraete)
        && 'altKey' in ue.daten && !('ok' in ue.daten));
    const faelle = [
      { name: 'Kollege Übersicht', a: await api(env, 'GET', '/konto/admin/uebersicht', { sitzung: karl.sitzung }), s: [403, 'kein-recht'] },
      { name: 'Kollege Aktion', a: await api(env, 'POST', '/konto/admin/aktion', { sitzung: karl.sitzung, body: { aktion: 'geraet-markieren', gid: karl.geraet.gid, jm: true } }), s: [403, 'kein-recht'] },
      { name: 'herabgestufter Admin mit Admin-Sitzung', a: await api(env, 'GET', '/konto/admin/uebersicht', { sitzung: za.sitzung }), s: [403, 'kein-recht'] },
      { name: 'erster Admin herabstufen', a: await api(env, 'POST', '/konto/admin/aktion', { sitzung: chefin.sitzung, body: { aktion: 'zugang-speichern', kid: chefin.stand.kid, stufe: 'kollege', tools: [], events: [], bis: null, zoomBis: null } }), s: [403, 'erster-admin'] },
      { name: 'Einladen jakobsmedien.com', a: await api(env, 'POST', '/konto/admin/aktion', { sitzung: chefin.sitzung, body: { aktion: 'einladen', email: 'neu@jakobsmedien.com', name: 'N', tools: [], events: [], bis: T0 + TAG } }), s: [400, 'domain'] },
      { name: 'unbekannte Aktion', a: await api(env, 'POST', '/konto/admin/aktion', { sitzung: chefin.sitzung, body: { aktion: 'alles-loeschen' } }), s: [400, 'ungueltig'] },
      { name: 'unbekannte Kennung', a: await api(env, 'POST', '/konto/admin/aktion', { sitzung: chefin.sitzung, body: { aktion: 'geraet-markieren', gid: 'gibt-es-nicht', jm: true } }), s: [404, 'vorgang-unbekannt'] },
    ];
    await pruefeFaelle('P16 7: Admin-Routen abgelehnt', faelle, (f) => (soll(f.a, ...f.s) ? null : `ist ${ist(f.a)}`));
    check('P16 7: dieselbe Sitzung des zweiten Admins hatte vor dem Herabstufen Zugang (200)', vorher.status === 200);
    const e1 = await api(env, 'POST', '/konto/admin/aktion', { sitzung: chefin.sitzung, body: { aktion: 'einladen', email: 'erika@extern.test', name: 'Erika', tools: [], events: [], bis: T0 + TAG } });
    geheim.push(e1.daten && e1.daten.einladungscode);
    const e2 = await api(env, 'POST', '/konto/admin/aktion', { sitzung: chefin.sitzung, body: { aktion: 'einladen', email: 'erika@extern.test', name: 'Erika', tools: [], events: [], bis: T0 + TAG } });
    check('P16 7: Einladen → Code und codeBis; dieselbe E-Mail noch einmal → 409 S12b',
      e1.status === 200 && /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/.test(e1.daten.einladungscode)
        && e1.daten.codeBis === T0 + 72 * 3600_000 && soll(e2, 409, 'konflikt', 'email'));
    delete env.ERSTER_ADMIN; // ohne ERSTER_ADMIN gilt die Zählregel (EP20): die Chefin ist dann die einzige Admin
    const letzte = await api(env, 'POST', '/konto/admin/aktion', { sitzung: chefin.sitzung, body: { aktion: 'zugang-speichern', kid: chefin.stand.kid, stufe: 'kollege', tools: [], events: [], bis: null, zoomBis: null } });
    check('P16 7: letzte Admin herabstufen → 409 S12a', soll(letzte, 409, 'konflikt', 'admin'));
  }

  // P16 8: Zoom-Anfrage nur für Externe; GET /konto/ich zeigt sie und den Admin-Punkt.
  {
    const env = umgebung();
    const admin = await ersterAdmin(env);
    const chefin = await anmelden(env, { google: true, email: ERSTER, name: 'Chefin Test' });
    const karl = await anmelden(env, { google: true, email: 'karl@jakobsmedien.com' });
    const code = await einladen(env, admin, 'erika@extern.test', { tools: ['connect-raum'] });
    const erika = await anmelden(env, { email: 'erika@extern.test', einladungscode: code, passwort: 'test-passwort-erika' });
    const von = T0 + TAG;
    const a4 = await api(env, 'POST', '/konto/zoom-anfrage', { sitzung: erika.sitzung, body: { zweck: 'x', von, bis: von } });
    const a1 = await api(env, 'POST', '/konto/zoom-anfrage', { sitzung: erika.sitzung, body: { zweck: 'Webinar Kunde X', von, bis: von + 4 * 3600_000 } });
    const a2 = await api(env, 'POST', '/konto/zoom-anfrage', { sitzung: erika.sitzung, body: { zweck: 'Noch eins', von, bis: von + 3600_000 } });
    const a3 = await api(env, 'POST', '/konto/zoom-anfrage', { sitzung: karl.sitzung, body: { zweck: 'x', von, bis: von + 1 } });
    check('P16 8: bis ≤ von → 400 S11; Externer → Anfrage offen; zweite offene → 409 S12c; Kollege → 400 S13',
      a1.status === 200 && a1.daten.anfrage.zustand === 'offen' && a1.daten.anfrage.zweck === 'Webinar Kunde X'
        && soll(a2, 409, 'konflikt', 'zoom') && soll(a3, 400, 'nicht-noetig') && soll(a4, 400, 'ungueltig'));
    const ichE = await api(env, 'GET', '/konto/ich', { sitzung: erika.sitzung });
    const ichA = await api(env, 'GET', '/konto/ich', { sitzung: chefin.sitzung });
    const ichK = await api(env, 'GET', '/konto/ich', { sitzung: karl.sitzung });
    check('P16 8: /konto/ich → Externer sieht seine offene Anfrage; Admin adminOffen 1; Kollege 0',
      ichE.status === 200 && ichE.daten.kontoAktiv === true && ichE.daten.grund === null && ichE.daten.zoomAnfrage.zustand === 'offen'
        && ichA.daten.adminOffen === 1 && ichK.daten.adminOffen === 0 && ichK.daten.zoomAnfrage === null);
    await rufeDo(env.KONTO.speicher(), 'admin-aktion', { kid: admin, aktion: { aktion: 'zugang-loeschen', kid: karl.stand.kid } });
    const ichGesperrt = await api(env, 'GET', '/konto/ich', { sitzung: karl.sitzung });
    const abm = await api(env, 'POST', '/konto/abmelden', { sitzung: karl.sitzung });
    check('P16 6.3: /konto/ich nach Sperre → kontoAktiv false mit Grund gesperrt; Abmelden → 200',
      ichGesperrt.status === 200 && ichGesperrt.daten.kontoAktiv === false && ichGesperrt.daten.grund === 'gesperrt' && abm.status === 200 && abm.daten.ok === true);
  }

  // P16 B1-Lehre: keine Kopfzeile des Clients erreicht den DO (x-konto-intern, x-connect-admin, cookie, authorization).
  {
    const env = umgebung();
    await ersterAdmin(env);
    const chefin = await anmelden(env, { google: true, email: ERSTER, name: 'Chefin Test' });
    const boese = { 'x-konto-intern': '1', 'x-connect-admin': '1', cookie: 'sitzung=test-keks', 'x-forwarded-host': 'evil.test' };
    env.KONTO.anfragen.length = 0;
    const geraet = await testGeraet();
    const v = await api(env, 'POST', '/konto/vorgang', { body: { geraet: geraet.angaben }, kopf: boese });
    geheim.push(v.daten && v.daten.abholGeheimnis, v.daten && v.daten.code);
    await api(env, 'GET', '/konto/ich', { sitzung: chefin.sitzung, kopf: boese });
    await api(env, 'GET', '/konto/admin/uebersicht', { sitzung: chefin.sitzung, kopf: boese });
    await api(env, 'POST', '/konto/admin/aktion', { sitzung: chefin.sitzung, kopf: boese, body: { aktion: 'geraet-markieren', gid: chefin.geraet.gid, jm: true } });
    const a = env.KONTO.anfragen;
    const fremd = a.filter((x) => Object.keys(x.headers).join(',') !== 'content-type' || x.method !== 'POST' || !x.url.startsWith('https://konto.intern/'));
    check(`P16 B1-Lehre: jede DO-Anfrage ist neu gebaut (POST https://konto.intern/…, nur content-type; ${a.length} Anfragen)`,
      a.length === 4 && fremd.length === 0);
    if (fremd.length) console.log(`     ${JSON.stringify(fremd[0]).slice(0, 200)}`);
  }

  // P16 S5: ohne Einrichtung 503 S5; Jurisdiction wie Connect (Vorgabe eu, '' = global, fehlende Fähigkeit = 503).
  {
    const geraet = await testGeraet();
    const vorgang = (env) => api(env, 'POST', '/konto/vorgang', { body: { geraet: geraet.angaben } });
    const ohneSchluessel = await vorgang(umgebung({ KONTO_SCHLUESSEL: undefined }));
    const ohneBindung = await vorgang(umgebung({ KONTO: undefined }));
    const ohneFaehigkeit = await vorgang(umgebung({}, { mitJurisdiktion: false }));
    const kurzEnv = umgebung({ KONTO_SCHLUESSEL: 'test-kurz' });
    const kurzVorgang = await vorgang(kurzEnv);
    const kurzSitzung = await api(kurzEnv, 'POST', '/konto/sitzung', { sitzung: 'jm1.test.test', body: { beweis: { ts: T0 } } });
    const globalEnv = umgebung({ KONTO_JURISDICTION: '' }, { mitJurisdiktion: false });
    const global = await vorgang(globalEnv);
    const euEnv = umgebung();
    const eu = await vorgang(euEnv);
    geheim.push(global.daten && global.daten.abholGeheimnis, eu.daten && eu.daten.abholGeheimnis, global.daten && global.daten.code, eu.daten && eu.daten.code);
    const faelle = [
      { name: 'ohne KONTO_SCHLUESSEL', ok: soll(ohneSchluessel, 503, 'nicht-eingerichtet') },
      { name: 'ohne Bindung KONTO', ok: soll(ohneBindung, 503, 'nicht-eingerichtet') },
      { name: 'Bindung ohne Jurisdiction-Fähigkeit', ok: soll(ohneFaehigkeit, 503, 'nicht-eingerichtet') },
      { name: 'KONTO_SCHLUESSEL unbrauchbar (test-kurz): Vorgang → 503 S5', ok: soll(kurzVorgang, 503, 'nicht-eingerichtet') },
      { name: 'KONTO_SCHLUESSEL unbrauchbar: Sitzung erneuern → 503 S5, nicht 401 S1', ok: soll(kurzSitzung, 503, 'nicht-eingerichtet') },
      { name: "KONTO_JURISDICTION '' → global", ok: global.status === 200 && globalEnv.KONTO.instanzen.has('|konten') },
      { name: 'Vorgabe eu', ok: eu.status === 200 && JSON.stringify(euEnv.KONTO.jurisdiktionen.slice(0, 1)) === '["eu"]' && euEnv.KONTO.instanzen.has('eu|konten') },
    ];
    await pruefeFaelle('P16 9: Einrichtung und Jurisdiction', faelle, (f) => (f.ok ? null : 'abweichend'));
    check('P16 G7: Fehleinrichtung steht im Worker-Log (ohne Wert)', protokoll.some((z) => z.startsWith('konto: Anmeldung nicht eingerichtet')));
  }

  // P16 EP5: Drossel POST /konto/vorgang 10 je 600 s und IP.
  {
    const env = umgebung();
    const geraet = await testGeraet();
    const status = [];
    for (let i = 0; i < 11; i++) {
      const r = await api(env, 'POST', '/konto/vorgang', { body: { geraet: geraet.angaben }, ip: '1.1.1.1' });
      if (r.daten && r.daten.abholGeheimnis) geheim.push(r.daten.abholGeheimnis, r.daten.code);
      status.push(r);
    }
    const andere = await api(env, 'POST', '/konto/vorgang', { body: { geraet: geraet.angaben }, ip: '2.2.2.2' });
    env.KONTO_UHR.vor(600_000);
    const spaeter = await api(env, 'POST', '/konto/vorgang', { body: { geraet: geraet.angaben }, ip: '1.1.1.1' });
    for (const r of [andere, spaeter]) if (r.daten && r.daten.abholGeheimnis) geheim.push(r.daten.abholGeheimnis, r.daten.code);
    const elfte = status[10];
    const rlSchluessel = [...env.RATELIMIT.daten.keys()];
    check('P16 EP5: 10 Vorgänge je IP in 600 s, der 11. → 429 zu-viele mit Retry-After; andere IP und nächstes Fenster frei; die IP steht nie im Klartext im Schlüssel',
      status.slice(0, 10).every((r) => r.status === 200) && elfte.status === 429 && elfte.daten.code === 'zu-viele'
        && elfte.daten.error === 'zu viele Anfragen' && Number(elfte.kopf.get('Retry-After')) > 0 && andere.status === 200 && spaeter.status === 200
        && rlSchluessel.length >= 2 && !rlSchluessel.some((s) => s.includes('1.1.1.1') || s.includes('2.2.2.2')));
  }

  // P16 10.1: unbekannte Routen unter /konto/ → 404 S11; andere Pfade fasst handleKonto nicht an.
  {
    const env = umgebung();
    const a = await api(env, 'GET', '/konto/gibt-es-nicht');
    const b = await api(env, 'GET', '/konto/vorgang');
    const c = await api(env, 'GET', '/konto');
    const d = await api(env, 'GET', '/kontoauszug');
    check('P16 10.1: unbekannte Route, falsche Methode, /konto → 404 S11; /kontoauszug geht ans Gate (401 S1)',
      soll(a, 404, 'ungueltig') && soll(b, 404, 'ungueltig') && soll(c, 404, 'ungueltig') && soll(d, 401, 'nicht-angemeldet'));
  }

  // ── P17: Anmeldeseite im Browser (Spec 4.1 Schritte 2–4; Texte B1–B17, B21–B23) ──
  {
    const { SEITEN_TEXT, esc } = await import('../konto-seiten.js');
    const seiten = [];
    const merke = async (res) => {
      const a = { status: res.status, kopf: res.headers, html: await res.text() };
      seiten.push(a);
      return a;
    };
    const hole = async (env, pfad, ip = '7.7.7.7') =>
      merke(await worker.fetch(new Request('https://proxy.test' + pfad, { headers: { 'CF-Connecting-IP': ip } }), env, makeWaitCtx()));
    const sende = async (env, pfad, felder, ip = '7.7.7.7') =>
      merke(await worker.fetch(new Request('https://proxy.test' + pfad, {
        method: 'POST',
        headers: { 'CF-Connecting-IP': ip, 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(felder).toString(),
      }), env, makeWaitCtx()));
    const versteckt = (html, name) => (html.match(new RegExp(`name="${name}" value="([^"]*)"`)) || [])[1];
    const zeigt = (a, ...texte) => texte.every((t) => a.html.includes(esc(t)));
    const vorgang = async (env, geraet) => {
      const v = await api(env, 'POST', '/konto/vorgang', { body: { geraet: (geraet ?? (await testGeraet())).angaben } });
      geheim.push(v.daten.abholGeheimnis, v.daten.code);
      return v.daten;
    };
    const B = SEITEN_TEXT;
    const env = umgebung({ GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'test-google-secret' });
    geheim.push('test-google-secret');
    const uhr = env.KONTO_UHR;
    const admin = await ersterAdmin(env);
    const codeE = await einladen(env, admin, 'erika@extern.test', { bis: T0 + 2 * 3600_000 });
    const geraet = await testGeraet({ name: '<b>Regie</b> "1" & \'A\'' });
    const v1 = await vorgang(env, geraet);

    const s1 = await hole(env, `/konto/anmelden?v=${encodeURIComponent(v1.vorgang)}`);
    check('P17 4.1: Anmeldeseite mit Google (B1–B5, Vorgang im Formular, Google-Link mit Vorgang)',
      s1.status === 200 && s1.html.includes(`<title>${esc(B.B1)}</title>`) && s1.html.includes(`<h1>${B.B2}</h1>`)
        && zeigt(s1, B.B3_knopf, B.B3_zeile, B.B4_titel, B.B4_email, B.B4_passwort, B.B4_knopf, B.B5_auf, B.B5_code, B.B5_neu, B.B5_neu2, B.B5_knopf)
        && s1.html.includes(`href="/konto/google?v=${esc(encodeURIComponent(v1.vorgang))}"`) && versteckt(s1.html, 'v') === v1.vorgang
        && !s1.html.includes(B.B6));
    const ohneGoogle = umgebung();
    const vo = await vorgang(ohneGoogle);
    const s2 = await hole(ohneGoogle, `/konto/anmelden?v=${vo.vorgang}`);
    check('P17 4.1: ohne GOOGLE_CLIENT_ID → B6 und kein Google-Link, Passwort-Anmeldung bleibt', s2.status === 200 && zeigt(s2, B.B6, B.B4_titel) && !s2.html.includes('/konto/google'));
    const s3 = await hole(env, '/konto/anmelden');
    const s4 = await hole(env, '/konto/anmelden?v=gibt-es-nicht');
    check('P17 4.1: ohne Vorgang → B22; unbekannter Vorgang → 404 B10', s3.status === 200 && zeigt(s3, B.B22) && s4.status === 404 && zeigt(s4, B.B10));

    // Erstes Mal: Einladungscode und neues Passwort → Bestätigungsseite (B7) mit E-Mail, Code, Rechnername.
    geheim.push('test-passwort-erika');
    const b1 = await sende(env, '/konto/passwort', { v: v1.vorgang, email: 'Erika@Extern.test', einladungscode: codeE.toLowerCase(), neu: 'test-passwort-erika', neu2: 'test-passwort-erika' });
    const t1 = versteckt(b1.html, 't');
    geheim.push(t1);
    check('P17 4.1: Einladung → Bestätigungsseite: Angemeldet als E-Mail, Code wie im Launcher, Rechner, Ja und Nein',
      b1.status === 200 && zeigt(b1, B.B7_frage, B.B7_ja, B.B7_nein) && b1.html.includes(esc('Angemeldet als erika@extern.test'))
        && b1.html.includes(`<p class="code">${v1.code}</p>`) && b1.html.includes('Rechner: &lt;b&gt;Regie&lt;/b&gt; &quot;1&quot; &amp; &#39;A&#39;')
        && !b1.html.includes('<b>Regie') && typeof t1 === 'string' && t1.length > 20 && versteckt(b1.html, 'v') === v1.vorgang);
    const ohneT = await sende(env, '/konto/bestaetigen', { v: v1.vorgang, antwort: 'ja' });
    const falschT = await sende(env, '/konto/bestaetigen', { v: v1.vorgang, t: 'test-falsches-seitentoken', antwort: 'ja' });
    const w = await api(env, 'POST', '/konto/vorgang/abholen', { body: { vorgang: v1.vorgang, abholGeheimnis: v1.abholGeheimnis, beweis: await geraet.beweis('abholen', v1.vorgang, uhr()) } });
    check('P17 4.1: Bestätigen ohne oder mit falschem Seitentoken → 403 B10, der Launcher wartet weiter',
      ohneT.status === 403 && zeigt(ohneT, B.B10) && falschT.status === 403 && zeigt(falschT, B.B10) && w.daten.zustand === 'wartet');
    const ja = await sende(env, '/konto/bestaetigen', { v: v1.vorgang, t: t1, antwort: 'ja' });
    const ab = await api(env, 'POST', '/konto/vorgang/abholen', { body: { vorgang: v1.vorgang, abholGeheimnis: v1.abholGeheimnis, beweis: await geraet.beweis('abholen', v1.vorgang, uhr()) } });
    geheim.push(ab.daten && ab.daten.sitzung);
    check('P17 4.1: Ja → B8; der Launcher holt die Sitzung des Externen ab', ja.status === 200 && zeigt(ja, B.B8) && ab.daten.zustand === 'bestaetigt' && ab.daten.stand.email === 'erika@extern.test');

    // Nein → B9 und abgelehnt beim Abholen; ein zweites Konto am selben Vorgang → B11.
    const v2 = await vorgang(env);
    const b2 = await sende(env, '/konto/passwort', { v: v2.vorgang, email: 'erika@extern.test', passwort: 'test-passwort-erika' }, '7.7.7.8');
    const t2 = versteckt(b2.html, 't');
    geheim.push(t2);
    const nein = await sende(env, '/konto/bestaetigen', { v: v2.vorgang, t: t2, antwort: 'nein' });
    check('P17 4.1: Passwort richtig → Bestätigungsseite; Nein → B9', b2.status === 200 && !!t2 && nein.status === 200 && zeigt(nein, B.B9));
    const codeF = await einladen(env, admin, 'fritz@extern.test');
    geheim.push('test-passwort-fritz');
    const vf = await vorgang(env);
    const bf = await sende(env, '/konto/passwort', { v: vf.vorgang, email: 'fritz@extern.test', einladungscode: codeF, neu: 'test-passwort-fritz', neu2: 'test-passwort-fritz' }, '7.7.7.9');
    geheim.push(versteckt(bf.html, 't'));
    const v3 = await vorgang(env);
    await sende(env, '/konto/passwort', { v: v3.vorgang, email: 'erika@extern.test', passwort: 'test-passwort-erika' }, '7.7.7.9');
    const fremd = await sende(env, '/konto/passwort', { v: v3.vorgang, email: 'fritz@extern.test', passwort: 'test-passwort-fritz' }, '7.7.7.9');
    check('P17 EP5: zweites Konto (eigene Einladung gilt) am Vorgang, an dem schon ein anderes Konto angemeldet ist → 409 B11',
      bf.status === 200 && fremd.status === 409 && zeigt(fremd, B.B11));

    // Fehlertexte je Fall (eigene IP je Fall, damit die Drossel nicht mitzählt).
    const v4 = await vorgang(env);
    const sp = env.KONTO.speicher();
    const faelle = [];
    let ip = 10;
    const fall = async (name, felder, status, nr, werte, mehr = () => true) => {
      const a = await sende(env, '/konto/passwort', { v: v4.vorgang, ...felder }, `10.0.0.${ip++}`);
      faelle.push({ name, ok: a.status === status && a.html.includes(nr.startsWith('B') ? `role="alert">${esc(B[nr]).replace(/‹([^›]+)›/g, (_, n) => esc(werte[n]))}` : nr) && mehr(a), a });
    };
    await fall('falsches Passwort', { email: 'erika@extern.test', passwort: 'test-falsch-123' }, 401, 'B12', {}, (a) => a.html.includes('value="erika@extern.test"') && !a.html.includes('test-falsch-123'));
    await fall('unbekannte E-Mail', { email: 'niemand@extern.test', passwort: 'test-falsch-123' }, 401, 'B12');
    await fall('falscher Einladungscode', { email: 'fritz@extern.test', einladungscode: 'AAAA-BBBB-CCCC', neu: 'test-passwort-neu', neu2: 'test-passwort-neu' }, 401, 'B14', {}, (a) => a.html.includes('<details open>'));
    await fall('Passwörter ungleich', { email: 'fritz@extern.test', einladungscode: 'AAAA-BBBB-CCCC', neu: 'test-passwort-neu', neu2: 'test-passwort-neu2' }, 400, 'B15_ungleich');
    await fall('Passwort zu kurz', { email: 'fritz@extern.test', einladungscode: 'AAAA-BBBB-CCCC', neu: 'kurz', neu2: 'kurz' }, 400, 'B15_kurz');
    await fall('E-Mail von jakobsmedien.com', { email: 'karl@jakobsmedien.com', passwort: 'test-falsch-123' }, 400, 'B23');
    await fall('unbekannter Vorgang', { v: 'gibt-es-nicht', email: 'erika@extern.test', passwort: 'test-passwort-erika' }, 404, esc(B.B10));
    for (let i = 0; i < 3; i++) await sende(env, '/konto/passwort', { v: v4.vorgang, email: 'erika@extern.test', passwort: 'test-falsch-123' }, `10.1.0.${i}`);
    await fall('fünfter Fehlversuch → Bremse 15 min', { email: 'erika@extern.test', passwort: 'test-falsch-123' }, 429, 'B13', { n: 15 });
    await fall('Bremse gilt auch für das richtige Passwort', { email: 'erika@extern.test', passwort: 'test-passwort-erika' }, 429, 'B13', { n: 15 });
    const kidF = await sp.ctx.storage.get('email:fritz@extern.test');
    const kontoF = await sp.ctx.storage.get(`konto:${kidF}`);
    await sp.ctx.storage.put(`konto:${kidF}`, { ...kontoF, zustand: 'gesperrt' });
    await fall('Zugang gesperrt (im Speicher gesetzt)', { email: 'fritz@extern.test', passwort: 'test-passwort-fritz' }, 403, 'B16');
    await sp.ctx.storage.put(`konto:${kidF}`, kontoF);
    uhr.vor(15 * 60_000);
    uhr.vor(2 * 3600_000);
    const v5 = await vorgang(env);
    const abgelaufen = await sende(env, '/konto/passwort', { v: v5.vorgang, email: 'erika@extern.test', passwort: 'test-passwort-erika' }, '10.2.0.1');
    // Klasse „Code abgelaufen“: der Vorgang v4 ist seit über 2 h vorbei.
    await fall('Vorgang abgelaufen (Formular)', { email: 'erika@extern.test', passwort: 'test-passwort-erika' }, 404, esc(B.B10));
    const spaetSeite = await hole(env, `/konto/anmelden?v=${encodeURIComponent(v4.vorgang)}`);
    faelle.push({ name: 'Vorgang abgelaufen (Anmeldeseite)', ok: spaetSeite.status === 404 && zeigt(spaetSeite, B.B10), a: spaetSeite });
    faelle.push({ name: 'Zugang abgelaufen mit Datum', ok: abgelaufen.status === 403 && abgelaufen.html.includes(esc('Dein Zugang ist am 02.11.2026 abgelaufen. Frag einen Admin nach einer Verlängerung.')), a: abgelaufen });
    const dr = [];
    // Je Versuch eine andere unbekannte E-Mail: die Bremse je E-Mail (P4, EP4) zählt dann nicht mit, nur die Drossel je IP.
    for (let i = 0; i < 21; i++) dr.push(await sende(env, '/konto/passwort', { v: v5.vorgang, email: `niemand-${i}@extern.test`, passwort: 'test-falsch-123' }, '10.3.0.1'));
    faelle.push({ name: 'Drossel: 21. Formular je IP in 600 s', ok: dr.slice(0, 20).every((a) => a.status === 401) && dr[20].status === 429 && zeigt(dr[20], B.B21) && Number(dr[20].kopf.get('Retry-After')) > 0, a: dr[20] });
    await pruefeFaelle('P17 4: Fehlertexte der Anmeldeseite', faelle, (f) => (f.ok ? null : `ist ${f.a.status} ${f.a.html.slice(f.a.html.indexOf('<h1>'), f.a.html.indexOf('<h1>') + 160)}`));

    // Escape: E-Mail mit HTML und Anführungszeichen landet nur escaped im Formular.
    const v6 = await vorgang(env);
    const boese = await sende(env, '/konto/passwort', { v: v6.vorgang, email: '"><script>x()</script>@extern.test', passwort: 'test-falsch-123' }, '10.4.0.1');
    check('P17 Escape: Rechnername (oben) und eingegebene E-Mail mit HTML und Anführungszeichen nur escaped',
      boese.status === 401 && boese.html.includes('value="&quot;&gt;&lt;script&gt;x()&lt;/script&gt;@extern.test"') && !boese.html.includes('<script'));

    // S5: ohne Einrichtung eine Seite statt JSON.
    const ohne = umgebung({ KONTO_SCHLUESSEL: undefined });
    const s5 = await hole(ohne, '/konto/anmelden?v=x');
    const s5b = await sende(ohne, '/konto/passwort', { v: 'x', email: 'a@b.test', passwort: 'test-falsch-123' });
    check('P17 S5: ohne Einrichtung zeigen Anmeldeseite und Formular S5 als Seite (503)',
      s5.status === 503 && s5b.status === 503 && zeigt(s5, FEHLER_TEXT['nicht-eingerichtet']) && (s5.kopf.get('content-type') || '').startsWith('text/html'));

    // Kopfzeilen und kein Skript auf jeder Seite dieses Blocks.
    const CSP = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
    const kopfFalsch = seiten.filter((a) => a.kopf.get('content-type') !== 'text/html; charset=utf-8' || a.kopf.get('cache-control') !== 'no-store'
      || a.kopf.get('referrer-policy') !== 'no-referrer' || a.kopf.get('x-content-type-options') !== 'nosniff'
      || a.kopf.get('content-security-policy') !== CSP || a.kopf.get('set-cookie') !== null || /<script/i.test(a.html));
    check(`P17 Kopfzeilen: CSP ohne Skript, no-store, no-referrer, nosniff, kein Set-Cookie, kein <script> (${seiten.length} Seiten)`, seiten.length >= 30 && kopfFalsch.length === 0);

    // G2: alle Texte B1–B23 aus der Tabelle; sichtbarer Text ohne ASCII-Anführungszeichen.
    const sichtbar = seiten.filter((a) => a !== boese).map((a) => a.html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]*>/g, '')).join('\n');
    check('P17 G2: SEITEN_TEXT hat B1–B23 ohne ASCII-Anführungszeichen; sichtbarer Text der Seiten ohne "',
      ['B1', 'B2', 'B6', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13', 'B14', 'B16', 'B17', 'B18', 'B19', 'B20', 'B21', 'B22', 'B23'].every((n) => typeof B[n] === 'string')
        && Object.values(B).every((t) => !t.includes('"')) && !sichtbar.includes('"'));
    const q = readFileSync(new URL('../konto-seiten.js', import.meta.url), 'utf8');
    check('P17 rein: konto-seiten.js ohne import, ohne console, ohne <script', !/^import /m.test(q) && !q.includes('console.') && !q.includes('<script'));
  }

  // ── Ende der Fälle ──

  // P16 10.1: Fehlerform und Cache-Kopf aller Antworten dieses Laufs.
  {
    const texte = new Set([...Object.values(FEHLER_TEXT), ...Object.values(KONFLIKT_TEXT), 'zu viele Anfragen']);
    const falsch = fehlerAntworten.filter((a) => (a.kopf.get('content-type') || '').startsWith('application/json') && !(a.daten && texte.has(a.daten.error) && typeof a.daten.code === 'string'));
    check(`P16 10.1: jede JSON-Fehlerantwort unter /konto/ hat { error: Text S…, code } (${fehlerAntworten.length} Antworten)`, fehlerAntworten.length > 20 && falsch.length === 0);
    for (const a of falsch.slice(0, 3)) console.log(`     ${a.pfad}: ${a.text.slice(0, 120)}`);
    const konto = jsonAntworten.filter((a) => a.pfad.startsWith('/konto/'));
    check(`P16 10.1: jede JSON-Antwort unter /konto/ mit cache-control no-store (${konto.length} Antworten)`,
      konto.length > 50 && konto.every((a) => a.kopf.get('cache-control') === 'no-store'));
  }

  // P16 G4: kein Geheimnis in der Konsole (läuft als letzter Fall über das ganze Protokoll).
  {
    const alles = protokoll.join('\n');
    const treffer = geheim.filter((g) => typeof g === 'string' && g.length >= 6 && alles.includes(g));
    check(`P16 G4: Konsole ohne Sitzung, Freigabe, Abholgeheimnis, Code, Passwort, Einladungscode, iveo-Token, Schlüssel (${geheim.length} Werte)`,
      treffer.length === 0 && !alles.includes('jm1.'));
  }
  // Quelltext-Wächter: konto-relay.js gibt keine Kopfzeile des Clients weiter und loggt keine Meldung eines Fehlers.
  {
    const q = readFileSync(new URL('../konto-relay.js', import.meta.url), 'utf8');
    check('P16 B1-Lehre: konto-relay.js ohne new Headers(request.headers), ohne new Request(request, ohne e.message',
      !q.includes('new Headers(request.headers)') && !q.includes('new Request(request') && !q.includes('e.message'));
  }
}

run()
  .catch((e) => {
    check(`konto-routen: Test-Harness ohne Ausnahme (${e && e.name}: ${e && e.message})`, false);
  })
  .finally(() => {
    console.log = realLog;
    console.warn = realWarn;
    console.error = realError;
    abschluss();
  });
