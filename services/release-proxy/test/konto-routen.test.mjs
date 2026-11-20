// Launcher-API /konto/* über worker.fetch (Anmeldung im Launcher, Plan Teil 1, P16; P17 und P18 fügen vor der Ende-Marke ein).
//   node --experimental-strip-types services/release-proxy/test/konto-routen.test.mjs
// Ohne Netz und ohne Cloudflare: Bindung KONTO = makeKontoNs (echte KontoSpeicher-Instanz je Name und Jurisdiction),
// Drosseln = makeRLBindungen (die sechs Rate-Limit-Bindungen KONTO_RL_*, AR70), RATELIMIT = makeKV (bleibt leer: die Konto-Routen
// zählen nicht mehr in KV), Uhr = makeUhr über env.KONTO_UHR (EP21), fetch-Attrappe für GitHub (und ab P18 Google). Schritte der
// Anmeldeseite, die erst P17/P18 als HTTP-Routen bringen, laufen hier direkt als DO-Aktion (rufeDo). Schlüssel entstehen zur
// Laufzeit (G4). Nicht über tsx (Kopf von worker.test.mjs).
import { readFileSync } from 'node:fs';
import worker from '../worker.js';
import { handleKonto } from '../konto-relay.js';
import { pruefeToken } from '../konto-krypto.js';
import { FEHLER_TEXT, KONFLIKT_TEXT } from '../konto-zugang.js';
import { abschluss, check, makeKontoNs, makeKV, makeRateLimit, makeRLBindungen, makeUhr, makeWaitCtx, pruefeFaelle, rufeDo, testGeraet, testSchluessel } from './konto-attrappen.mjs';
import { sha256B64url } from '../konto-krypto.js';

// Konsole mitschneiden: erwartete Warnungen und die Prüfung „kein Geheimnis im Log“ am Ende.
const protokoll = [];
const realLog = console.log;
const realWarn = console.warn;
const realError = console.error;
const mitschnitt = (...a) => protokoll.push(a.map(String).join(' '));
console.warn = mitschnitt;
console.error = mitschnitt;
// G4 (Z1-W2): auch log, info und debug werden mitgeschnitten; die Ausgabe des Harness (check in konto-attrappen.mjs) läuft über das
// beim Laden gesicherte echte console.log und landet nicht im Mitschnitt.
console.log = mitschnitt;
console.info = mitschnitt;
console.debug = mitschnitt;
/** Alles, was nie in der Konsole stehen darf (Sitzungen, Abholgeheimnisse, Codes, Passwörter, Tokens, Schlüssel). */
const geheim = [];

const TAG = 24 * 3600_000;
const T0 = Date.parse('2026-11-02T10:00:00Z');
const SCHLUESSEL = testSchluessel();
const IVEO = testSchluessel();
const ERSTER = 'chefin@jakobsmedien.com';
/** Z2: Port des Rückkanals, den der Launcher beim Anlegen meldet (Ganzzahl 1024–65535). */
const RUECK_PORT = 50321;
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
    ERSTER_ADMIN: ERSTER, KONTO_UHR: makeUhr(T0), RATELIMIT: makeKV(), ...makeRLBindungen(), ...mehr,
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
  const v = await api(env, 'POST', '/konto/vorgang', { body: { geraet: geraet.angaben, rueckPort: RUECK_PORT } });
  geheim.push(v.daten.abholGeheimnis, v.daten.code);
  let bind;
  if (o.google) {
    const g = await rufeDo(sp, 'konto-aus-google', { email: o.email, name: o.name ?? 'Karl Kollege' });
    bind = await rufeDo(sp, 'vorgang-konto-binden', { vorgang: v.daten.vorgang, kid: g.kid });
  } else {
    geheim.push(o.passwort);
    bind = await rufeDo(sp, 'vorgang-passwort', { vorgang: v.daten.vorgang, email: o.email, einladungscode: o.einladungscode, neu: o.passwort, neu2: o.passwort });
  }
  // Z2: die Antwort auf Ja trägt den Einmalwert e; den bekäme der Launcher über den Sprung an 127.0.0.1 (Kette unten über HTTP).
  const ja = await rufeDo(sp, 'vorgang-bestaetigen', { vorgang: v.daten.vorgang, seitenToken: bind.seitenToken, antwort: 'ja' });
  geheim.push(ja.e);
  const ab = await api(env, 'POST', '/konto/vorgang/abholen', {
    body: { vorgang: v.daten.vorgang, abholGeheimnis: v.daten.abholGeheimnis, beweis: await geraet.beweis('abholen', v.daten.vorgang, env.KONTO_UHR()), e: ja.e },
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
    const v = await api(env, 'POST', '/konto/vorgang', { body: { geraet: geraet.angaben, rueckPort: RUECK_PORT } });
    const d = v.daten || {};
    geheim.push(d.abholGeheimnis, d.code);
    check('P16 4.1: POST /konto/vorgang → 200 mit Vorgang, Abholgeheimnis, Code XXX-XXX, Adresse und bis = jetzt + 5 min',
      v.status === 200 && typeof d.vorgang === 'string' && typeof d.abholGeheimnis === 'string' && d.abholGeheimnis.length >= 40
        && /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}$/.test(d.code)
        && d.adresse === `https://proxy.test/konto/anmelden?v=${encodeURIComponent(d.vorgang)}` && d.bis === T0 + 5 * 60_000);
    const speicherText = JSON.stringify([...env.KONTO.speicher().ctx.daten.values()]);
    check('P16 4.1: der DO kennt das Abholgeheimnis nur als Hash', !speicherText.includes(d.abholGeheimnis) && speicherText.includes(d.code));
    const abholen = async (g = geraet, geh = d.abholGeheimnis, e = undefined) =>
      api(env, 'POST', '/konto/vorgang/abholen', { body: { vorgang: d.vorgang, abholGeheimnis: geh, beweis: await g.beweis('abholen', d.vorgang, uhr()), e } });
    const w = await abholen();
    const fremd = await abholen(await testGeraet());
    const falsch = await abholen(geraet, 'Zz9_-'.repeat(8) + 'Zz9'); // richtige Form (43 Zeichen), falscher Wert
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
    const ja = await rufeDo(sp, 'vorgang-bestaetigen', { vorgang: d.vorgang, seitenToken: bind.seitenToken, antwort: 'ja' });
    geheim.push(ja.e);
    uhr.vor(30_000);
    const b = await abholen(geraet, d.abholGeheimnis, ja.e);
    const s = b.daten || {};
    geheim.push(s.sitzung);
    const claims = s.sitzung ? await pruefeToken(SCHLUESSEL, s.sitzung, 'sitzung', uhr()) : null;
    check('P16 4.1: nach Ja → bestaetigt mit Sitzung (jm1., prüfbar) und Stand Kollege, Gerät und 30 Tage',
      b.status === 200 && s.zustand === 'bestaetigt' && !!claims && claims.kid === g.kid && claims.stufe === 'kollege'
        && claims.gid === geraet.gid && claims.exp === uhr() + 30 * TAG && JSON.stringify(s.stand) === JSON.stringify(claims));
    // Z2: ohne e nimmt der Grabstein nichts an (dasselbe e innerhalb von 60 s: eigener Fall unten).
    const nochmal = await abholen();
    check('P16 4.1, Z2: zweites Abholen ohne e → 404 S10', soll(nochmal, 404, 'vorgang-unbekannt'));
    const katalog = await api(env, 'GET', '/suite.json', { sitzung: s.sitzung });
    check('P16 4.1: die Sitzung öffnet das Gate (GET /suite.json → 200)', katalog.status === 200);
    const v2 = await api(env, 'POST', '/konto/vorgang', { body: { geraet: geraet.angaben, rueckPort: RUECK_PORT } });
    geheim.push(v2.daten.abholGeheimnis, v2.daten.code);
    const ab1 = await api(env, 'POST', '/konto/vorgang/abbrechen', { body: { vorgang: v2.daten.vorgang, abholGeheimnis: 'Zz9_-'.repeat(8) + 'Zz9' } }); // richtige Form, falscher Wert
    const ab2 = await api(env, 'POST', '/konto/vorgang/abbrechen', { body: { vorgang: v2.daten.vorgang, abholGeheimnis: v2.daten.abholGeheimnis } });
    const ab3 = await api(env, 'POST', '/konto/vorgang/abholen', {
      body: { vorgang: v2.daten.vorgang, abholGeheimnis: v2.daten.abholGeheimnis, beweis: await geraet.beweis('abholen', v2.daten.vorgang, uhr()) },
    });
    check('P16 4.1: Abbrechen nur mit Abholgeheimnis (sonst 404 S10); danach ist der Vorgang weg',
      soll(ab1, 404, 'vorgang-unbekannt') && ab2.status === 200 && ab2.daten.ok === true && soll(ab3, 404, 'vorgang-unbekannt'));
    // Klasse „Code abgelaufen“: genau 5 min nach dem Anlegen gilt der Vorgang nicht mehr (Frist VORGANG_MS, EP5).
    const v3 = await api(env, 'POST', '/konto/vorgang', { body: { geraet: geraet.angaben, rueckPort: RUECK_PORT } });
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
      body: { aktion: 'iveo-hinterlegen', basis: 'https://app.my-iveo.de/api/v1', events: [{ slug: 'tagung', name: 'Tagung 2026' }, { slug: 'messe', name: 'Messe' }], token: TOKEN },
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
    // Z1-W1 AAD: vertauschte Geheimtexte zweier Events (der Speicher des DO wurde verändert) lassen sich nicht mehr entschlüsseln.
    const keyTagung = 'https://app.my-iveo.de/api/v1|tagung';
    const keyMesse = 'https://app.my-iveo.de/api/v1|messe';
    const eintragT = sp.ctx.daten.get(`iveo:${keyTagung}`);
    const eintragM = sp.ctx.daten.get(`iveo:${keyMesse}`);
    sp.ctx.daten.set(`iveo:${keyTagung}`, { ...eintragT, iv: eintragM.iv, ct: eintragM.ct });
    sp.ctx.daten.set(`iveo:${keyMesse}`, { ...eintragM, iv: eintragT.iv, ct: eintragT.ct });
    const vertauscht = await liste(karl);
    sp.ctx.daten.set(`iveo:${keyTagung}`, eintragT);
    sp.ctx.daten.set(`iveo:${keyMesse}`, eintragM);
    const zurueck = await liste(karl);
    check('Z1-W1 AAD: vertauschte Geheimtexte (Event A unter Schlüssel B) → GET /konto/iveo liefert keines der beiden Events; zurückgetauscht wieder beide',
      vertauscht.status === 200 && (vertauscht.daten.events || []).length === 0 && slugs(zurueck) === 'messe:true,tagung:true');
    // AR74 B: Tausch-Variante. Der DO-Eintrag behält den key von A, übernimmt aber basis, slug, iv und ct von B: B's Token darf nicht
    // unter A herauskommen (die AAD ist e.key, nicht basis|slug aus dem Eintrag selbst).
    const TOKEN_B = 'test-iveo-token-b-geheim';
    geheim.push(TOKEN_B);
    await api(env, 'POST', '/konto/admin/aktion', { sitzung: chefin.sitzung, body: { aktion: 'iveo-hinterlegen', basis: 'https://app.my-iveo.de/api/v1', events: [{ slug: 'tausch-a', name: 'A' }], token: TOKEN } });
    await api(env, 'POST', '/konto/admin/aktion', { sitzung: chefin.sitzung, body: { aktion: 'iveo-hinterlegen', basis: 'https://staging-dev.my-iveo.de/api/v1', events: [{ slug: 'tausch-b', name: 'B' }], token: TOKEN_B } });
    const keyA = 'https://app.my-iveo.de/api/v1|tausch-a';
    const keyB = 'https://staging-dev.my-iveo.de/api/v1|tausch-b';
    const eintragA = sp.ctx.daten.get(`iveo:${keyA}`);
    const eintragB = sp.ctx.daten.get(`iveo:${keyB}`);
    const vorTausch = await liste(karl);
    sp.ctx.daten.set(`iveo:${keyA}`, { ...eintragA, basis: eintragB.basis, slug: eintragB.slug, iv: eintragB.iv, ct: eintragB.ct });
    const nachTausch = await liste(karl);
    sp.ctx.daten.set(`iveo:${keyA}`, eintragA);
    const unterA = (r) => (r.daten.events || []).filter((e) => e.key === keyA);
    check('AR74 B: DO-Eintrag mit key von A, aber basis, slug, iv und ct von B → A erscheint nicht mehr (weder mit B\'s noch mit einem Token), B bleibt; vorher waren beide da',
      unterA(vorTausch).length === 1 && unterA(nachTausch).length === 0 && !(nachTausch.daten.events || []).some((e) => e.key === keyA || (e.token === TOKEN_B && e.key !== keyB))
        && (nachTausch.daten.events || []).some((e) => e.key === keyB && e.token === TOKEN_B));
    // Z1-W2 [T]: zweiter darf-Filter im Worker. Ein DO ohne Filter (iveo-fuer liefert immer ALLE Events, als Admin) darf einem Externen
    // nur sein Event und einem Externen ohne iveo nichts geben.
    {
      const jur = env.KONTO.jurisdiction;
      env.KONTO.jurisdiction = (x) => {
        const n = jur(x);
        const get = n.get;
        n.get = (id) => {
          const s = get(id);
          return {
            fetch: async (rq) => {
              if (!rq.url.endsWith('/iveo-fuer')) return s.fetch(rq);
              const b = await rq.json();
              return s.fetch(new Request(rq.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...b, stufe: 'admin' }) }));
            },
          };
        };
        return n;
      };
      const xGierig = await liste(mitIveo);
      const oGierig = await liste(ohneIveo);
      const kGierig = await liste(karl);
      env.KONTO.jurisdiction = jur;
      check('Z1-W2 [T] 6.4: DO ohne Filter (liefert alle Events) → der Worker filtert noch einmal: Externer mit iveo nur tagung, Externer ohne iveo nichts, Kollege alle',
        slugs(xGierig) === 'tagung:true' && slugs(oGierig) === '' && (kGierig.daten.events || []).length > 2);
    }
    // Dieselbe Normalisierung beim Hinterlegen und Lesen: eine ungeputzte Basis ergibt denselben Schlüssel wie die geputzte.
    const roh = await api(env, 'POST', '/konto/admin/aktion', {
      sitzung: chefin.sitzung,
      body: { aktion: 'iveo-hinterlegen', basis: ' HTTPS://App.My-Iveo.DE:443/api/v1/ ', events: [{ slug: ' tagung ', name: 'Tagung 2026' }], token: TOKEN },
    });
    const nachRoh = await liste(karl);
    check('Z1-W1 AAD: Hinterlegen mit ungeputzter Basis und Slug (Schema und Host groß, :443, Schrägstrich, Leerzeichen) ersetzt https://app.my-iveo.de/api/v1|tagung und lässt sich lesen',
      roh.status === 200 && slugs(nachRoh).split(',').filter((s) => !s.startsWith('tausch-')).join(',') === 'messe:true,tagung:true' && sp.ctx.daten.has(`iveo:${keyTagung}`));
    const kaputtBasis = await api(env, 'POST', '/konto/admin/aktion', {
      sitzung: chefin.sitzung,
      body: { aktion: 'iveo-hinterlegen', basis: 'a|b', events: [{ slug: 'x', name: 'X' }], token: TOKEN },
    });
    check('Z1-W1 AAD: unbrauchbare Basis beim Hinterlegen → 400 ungueltig (der Worker verschlüsselt nichts ohne Schlüssel)', soll(kaputtBasis, 400, 'ungueltig'));
    const ohneSchluessel = { ...env, IVEO_SCHLUESSEL: undefined };
    const n = await liste(karl, ohneSchluessel);
    const n2 = await api(ohneSchluessel, 'POST', '/konto/admin/aktion', { sitzung: chefin.sitzung, body: { aktion: 'iveo-hinterlegen', basis: 'https://app.my-iveo.de/api/v1', events: [{ slug: 'x', name: 'X' }], token: TOKEN } });
    // Ein unbrauchbarer Schlüssel (nicht genau 32 Byte) verhält sich wie ein fehlender, nicht wie ein 502.
    const kurzIveo = { ...env, IVEO_SCHLUESSEL: 'test-kurz' };
    const m = await liste(karl, kurzIveo);
    const m2 = await api(kurzIveo, 'POST', '/konto/admin/aktion', { sitzung: chefin.sitzung, body: { aktion: 'iveo-hinterlegen', basis: 'https://app.my-iveo.de/api/v1', events: [{ slug: 'x', name: 'X' }], token: TOKEN } });
    check('P16 6.4: ohne IVEO_SCHLUESSEL leere Liste mit Hinweis; Hinterlegen → 503 S5',
      n.status === 200 && JSON.stringify(n.daten) === '{"events":[],"hinweis":"iveo-nicht-eingerichtet"}' && soll(n2, 503, 'nicht-eingerichtet'));
    const leerIveo = await liste(karl, { ...env, IVEO_SCHLUESSEL: '' });
    check('Z1-W2: unbrauchbarer IVEO_SCHLUESSEL (gesetzt, aber nicht 32 Byte) → GET /konto/iveo und Hinterlegen 503 S5, weder leere Liste noch 502; ein leerer Wert gilt als fehlend',
      soll(m, 503, 'nicht-eingerichtet') && soll(m2, 503, 'nicht-eingerichtet') && leerIveo.status === 200 && JSON.stringify(leerIveo.daten) === '{"events":[],"hinweis":"iveo-nicht-eingerichtet"}'
        && protokoll.some((z) => z === 'konto: IVEO_SCHLUESSEL unbrauchbar (nicht 32 Byte Base64)'));

    // Z1-W2 OE2: feste iveo-Liste. Production und Staging gehen (in jeder Schreibweise), jede andere Basis → 400 iveo-basis-unbekannt
    // (S19), ohne dass der DO etwas bekommt oder etwas verschlüsselt wird; eine unbrauchbare Basis bleibt 400 ungueltig.
    const vorBasen = doBodies.length;
    const baseVersuch = (basis) => api(env, 'POST', '/konto/admin/aktion', { sitzung: chefin.sitzung, body: { aktion: 'iveo-hinterlegen', basis, events: [{ slug: 'basis-test', name: 'Basis' }], token: TOKEN } });
    const gut = [];
    for (const b of ['https://app.my-iveo.de/api/v1', 'https://app.my-iveo.de/api/v1/', 'APP.my-iveo.de:443/api/v1', 'https://staging-dev.my-iveo.de/api/v1', ' HTTPS://Staging-Dev.my-iveo.de:443/api/v1// ']) gut.push([b, (await baseVersuch(b)).status]);
    const nachGut = doBodies.length;
    const fremd = [];
    for (const b of ['https://iveo.example', 'http://app.my-iveo.de/api/v1', 'https://app.my-iveo.de/api/v2', 'https://app.my-iveo.de', 'https://app.my-iveo.de:8443/api/v1',
      'https://app.my-iveo.de.evil.example/api/v1', 'https://app.my-iveo.de@evil.example/api/v1', 'https://staging.my-iveo.de/api/v1', 'https://my-iveo.de/api/v1']) {
      fremd.push([b, await baseVersuch(b)]);
    }
    const unbrauchbar = await baseVersuch('a|b');
    const ohneBasis = await baseVersuch(undefined);
    check('Z1-W2 OE2: Hinterlegen mit Production oder Staging (jede Schreibweise) → 200; jede andere Basis → 400 iveo-basis-unbekannt (S19) vor DO und Verschlüsselung; unbrauchbar oder fehlend → 400 ungueltig',
      gut.every(([, s]) => s === 200) && fremd.every(([, a]) => soll(a, 400, 'iveo-basis-unbekannt')) && doBodies.length === nachGut && nachGut - vorBasen === 5
        && soll(unbrauchbar, 400, 'ungueltig') && soll(ohneBasis, 400, 'ungueltig'));
    // AR74 A: Leerraum innerhalb der Basis (x.de/ /) wird nie mit 200 angenommen (sonst läge das Event unlesbar im DO); eine Listen-Basis
    // in auffälliger Schreibweise wird hinterlegt UND von GET /konto/iveo ausgeliefert (Hinterlegen und Lesen bilden denselben Schlüssel).
    const lr = [];
    for (const b of ['app.my-iveo.de/api/v1/ /', 'neu.example/ /', 'x.de/ /', 'app.my-iveo.de/api/v1/\t/', 'app.my-iveo.de/api/v1/\n/']) lr.push([b, await baseVersuch(b)]);
    const caps = await api(env, 'POST', '/konto/admin/aktion', { sitzung: chefin.sitzung, body: { aktion: 'iveo-hinterlegen', basis: 'HTTPS://APP.MY-IVEO.DE:443/api/v1/', events: [{ slug: 'caps-test', name: 'Caps' }], token: TOKEN } });
    const capsListe = await liste(karl);
    check('AR74 A: Hinterlegen mit Leerraum innerhalb der Basis (x.de/ /, Tab, LF) → 400, nie 200; HTTPS://APP.MY-IVEO.DE:443/api/v1/ → 200 und GET /konto/iveo liefert das Event mit Token',
      lr.every(([, a]) => a.status === 400 && (a.daten.code === 'ungueltig' || a.daten.code === 'iveo-basis-unbekannt')) && caps.status === 200
        && (capsListe.daten.events || []).some((e) => e.slug === 'caps-test' && e.token === TOKEN && e.key === 'https://app.my-iveo.de/api/v1|caps-test'));
    if (!fremd.every(([, a]) => soll(a, 400, 'iveo-basis-unbekannt'))) realLog(`     ${fremd.map(([b, a]) => `${b} → ${ist(a)}`).join('\n     ')}`);
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

  // AR74 D: Abmelden-Rennen. Eine ALTE Sitzung (erste Anmeldung) meldet nach einer neuen Anmeldung desselben Kontos am selben Gerät
  // ab: die neue Anmeldung bleibt stehen (Erneuern mit der neuen Sitzung geht); die aktuelle Sitzung löst das Gerät wie bisher.
  {
    const env = umgebung();
    const geraet = await testGeraet({ name: 'Rennen-PC' });
    const alt = await anmelden(env, { google: true, email: 'rennen@jakobsmedien.com', name: 'Rennen', geraet });
    env.KONTO_UHR.vor(5000);
    const neu = await anmelden(env, { google: true, email: 'rennen@jakobsmedien.com', name: 'Rennen', geraet });
    // AR79: die ALTE Sitzung lässt sich nach der neueren Anmeldung nicht mehr erneuern; die neue erneuert sich in einer Kette beliebig oft.
    const altErn = await erneuern(env, alt);
    let kette = neu;
    const kettenStatus = [];
    for (let i = 0; i < 3; i++) {
      env.KONTO_UHR.vor(1000);
      const r = await erneuern(env, kette);
      kettenStatus.push(r.status);
      if (r.daten && r.daten.sitzung) kette = { ...kette, sitzung: r.daten.sitzung, stand: r.daten.stand };
    }
    check('AR79: alte Sitzung nach neuerer Anmeldung am selben Gerät → Erneuern 403 geraet-unbekannt; die neue Sitzung erneuert sich dreimal hintereinander (200, Kette mit der jeweils erneuerten Sitzung)',
      soll(altErn, 403, 'geraet-unbekannt') && kettenStatus.join(',') === '200,200,200');
    const abAlt = await api(env, 'POST', '/konto/abmelden', { sitzung: alt.sitzung });
    const nachAlt = await erneuern(env, neu);
    const abNeu = await api(env, 'POST', '/konto/abmelden', { sitzung: neu.sitzung });
    const nachNeu = await erneuern(env, neu);
    check('AR74 D: Abmelden mit der alten Sitzung (200) lässt die neuere Anmeldung am Gerät stehen (Erneuern 200); Abmelden mit der aktuellen löst das Gerät (Erneuern 403 geraet-unbekannt)',
      alt.stand.angemeldetSeit !== neu.stand.angemeldetSeit && abAlt.status === 200 && nachAlt.status === 200 && abNeu.status === 200 && soll(nachNeu, 403, 'geraet-unbekannt'));
  }

  // P16 B1-Lehre: keine Kopfzeile des Clients erreicht den DO (x-konto-intern, x-connect-admin, cookie, authorization).
  {
    const env = umgebung();
    await ersterAdmin(env);
    const chefin = await anmelden(env, { google: true, email: ERSTER, name: 'Chefin Test' });
    const boese = { 'x-konto-intern': '1', 'x-connect-admin': '1', cookie: 'sitzung=test-keks', 'x-forwarded-host': 'evil.test' };
    env.KONTO.anfragen.length = 0;
    const geraet = await testGeraet();
    const v = await api(env, 'POST', '/konto/vorgang', { body: { geraet: geraet.angaben, rueckPort: RUECK_PORT }, kopf: boese });
    geheim.push(v.daten && v.daten.abholGeheimnis, v.daten && v.daten.code);
    await api(env, 'GET', '/konto/ich', { sitzung: chefin.sitzung, kopf: boese });
    await api(env, 'GET', '/konto/admin/uebersicht', { sitzung: chefin.sitzung, kopf: boese });
    await api(env, 'POST', '/konto/admin/aktion', { sitzung: chefin.sitzung, kopf: boese, body: { aktion: 'geraet-markieren', gid: chefin.geraet.gid, jm: true } });
    const a = env.KONTO.anfragen;
    const fremd = a.filter((x) => Object.keys(x.headers).join(',') !== 'content-type' || x.method !== 'POST' || !x.url.startsWith('https://konto.intern/'));
    check(`P16 B1-Lehre: jede DO-Anfrage ist neu gebaut (POST https://konto.intern/…, nur content-type; ${a.length} Anfragen)`,
      a.length === 4 && fremd.length === 0);
    if (fremd.length) realLog(`     ${JSON.stringify(fremd[0]).slice(0, 200)}`);
  }

  // P16 S5: ohne Einrichtung 503 S5; Jurisdiction wie Connect (Vorgabe eu, '' = global, fehlende Fähigkeit = 503).
  {
    const geraet = await testGeraet();
    const vorgang = (env) => api(env, 'POST', '/konto/vorgang', { body: { geraet: geraet.angaben, rueckPort: RUECK_PORT } });
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

  // Z1-W2 AR70: Drossel POST /konto/vorgang über die Bindung KONTO_RL_VORGANG (20 je 60 s und IP), nicht mehr in KV (EP5).
  {
    const env = umgebung();
    const geraet = await testGeraet();
    const status = [];
    for (let i = 0; i < 21; i++) {
      const r = await api(env, 'POST', '/konto/vorgang', { body: { geraet: geraet.angaben, rueckPort: RUECK_PORT }, ip: '1.1.1.1' });
      if (r.daten && r.daten.abholGeheimnis) geheim.push(r.daten.abholGeheimnis, r.daten.code);
      status.push(r);
    }
    const andere = await api(env, 'POST', '/konto/vorgang', { body: { geraet: geraet.angaben, rueckPort: RUECK_PORT }, ip: '2.2.2.2' });
    const anfragenVorher = env.KONTO.anfragen.length;
    const nochEine = await api(env, 'POST', '/konto/vorgang', { body: { geraet: geraet.angaben, rueckPort: RUECK_PORT }, ip: '1.1.1.1' });
    const anfragenNachher = env.KONTO.anfragen.length;
    env.KONTO_RL_VORGANG.neuesFenster();
    const spaeter = await api(env, 'POST', '/konto/vorgang', { body: { geraet: geraet.angaben, rueckPort: RUECK_PORT }, ip: '1.1.1.1' });
    for (const r of [andere, spaeter]) if (r.daten && r.daten.abholGeheimnis) geheim.push(r.daten.abholGeheimnis, r.daten.code);
    const einundzwanzigste = status[20];
    const rlSchluessel = [...new Set(env.KONTO_RL_VORGANG.aufrufe)];
    const erwartet = (await sha256B64url(`${SCHLUESSEL}|1.1.1.1`)).slice(0, 22);
    check('Z1-W2 AR70: 20 Vorgänge je IP und Periode, der 21. → 429 zu-viele mit Retry-After 60 vor dem DO; andere IP und neue Periode frei; Schlüssel = IP-Hash (22 Zeichen), nie die IP; KV bleibt leer',
      status.slice(0, 20).every((r) => r.status === 200) && einundzwanzigste.status === 429 && einundzwanzigste.daten.code === 'zu-viele'
        && einundzwanzigste.daten.error === 'zu viele Anfragen' && einundzwanzigste.kopf.get('Retry-After') === '60' && nochEine.status === 429 && anfragenNachher === anfragenVorher
        && andere.status === 200 && spaeter.status === 200
        && rlSchluessel.length === 2 && rlSchluessel.includes(erwartet) && rlSchluessel.every((s) => s.length === 22 && !s.includes('1.1.1.1') && !s.includes('2.2.2.2'))
        && env.RATELIMIT.daten.size === 0);
  }

  // Z1-W2 AR70: Verdrahtung aller sechs Bindungen mit kleiner Grenze (3): die 4. Anfrage → 429 vor dem DO, Antwort wie bisher
  // (JSON zu-viele oder Seite B21) mit Retry-After 60; fehlt die Bindung oder wirft limit(), bleibt die Route offen (kein 5xx).
  {
    const Bseiten = (await import('../konto-seiten.js')).SEITEN_TEXT;
    const vorg = 'v'.repeat(24);
    const geh = 'g'.repeat(43);
    const form = { v: vorg, email: 'x@extern.test', passwort: 'test-falsch-123' };
    const jsonInit = (daten) => () => ({ method: 'POST', headers: { 'CF-Connecting-IP': '3.3.3.3', 'content-type': 'application/json' }, body: JSON.stringify(daten) });
    const getInit = () => ({ headers: { 'CF-Connecting-IP': '3.3.3.3' } });
    const routen = [
      { name: 'vorgang', rl: 'KONTO_RL_VORGANG', json: true, pfad: '/konto/vorgang', init: jsonInit({ geraet: { publicJwk: {} } }) },
      { name: 'abholen', rl: 'KONTO_RL_ABHOLEN', json: true, pfad: '/konto/vorgang/abholen', init: jsonInit({ vorgang: vorg, abholGeheimnis: geh, beweis: { ts: T0 } }) },
      { name: 'abbrechen', rl: 'KONTO_RL_ABBRECHEN', json: true, pfad: '/konto/vorgang/abbrechen', init: jsonInit({ vorgang: vorg, abholGeheimnis: geh }) },
      { name: 'google (Start)', rl: 'KONTO_RL_GOOGLE', json: false, pfad: `/konto/google?v=${vorg}`, init: getInit },
      { name: 'google (Rückkehr)', rl: 'KONTO_RL_GOOGLE', json: false, pfad: '/konto/google/zurueck?state=test-state&code=test-code-x', init: getInit },
      { name: 'passwort', rl: 'KONTO_RL_PASSWORT', json: false, pfad: '/konto/passwort', init: () => ({ method: 'POST', headers: { 'CF-Connecting-IP': '3.3.3.3', 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString() }) },
    ];
    const google = { GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'test-google-secret-w2' };
    geheim.push(google.GOOGLE_CLIENT_SECRET);
    const aufruf = (env, r) => worker.fetch(new Request('https://proxy.test' + r.pfad, r.init()), env, makeWaitCtx());
    const verdrahtung = [];
    const offen = [];
    for (const r of routen) {
      const env = umgebung({ ...google, [r.rl]: makeRateLimit(3) });
      const antw = [];
      for (let i = 0; i < 3; i++) antw.push((await aufruf(env, r)).status);
      const davor = env.KONTO.anfragen.length;
      const vierte = await aufruf(env, r);
      const text = await vierte.text();
      const ct = vierte.headers.get('content-type') || '';
      const istJson = ct.startsWith('application/json');
      verdrahtung.push({ name: r.name, ok: antw.every((s) => s !== 429) && vierte.status === 429 && vierte.headers.get('Retry-After') === '60' && env.KONTO.anfragen.length === davor
        && (r.json ? istJson && JSON.parse(text).code === 'zu-viele' && JSON.parse(text).error === 'zu viele Anfragen'
          : ct.startsWith('text/html') && text.includes(Bseiten.B21) && vierte.headers.get('set-cookie') === null && vierte.headers.get('x-content-type-options') === 'nosniff'), a: { status: vierte.status, text: text.slice(0, 100) } });
      // Bindung fehlt: Warnung, offen
      const ohne = umgebung({ ...google });
      delete ohne[r.rl];
      const vorWarn = protokoll.length;
      let ohne429 = false;
      for (let i = 0; i < 25; i++) if ((await aufruf(ohne, r)).status === 429) ohne429 = true;
      const warnt = protokoll.slice(vorWarn).some((z) => z === `rate-limit: Bindung ${r.rl} fehlt — ungedrosselt`);
      // limit() wirft: Warnung mit dem Namen der Ausnahme, offen, kein 5xx
      const wirft = umgebung({ ...google, [r.rl]: makeRateLimit(3, { wirft: Object.assign(new Error('test-geheim-meldung-w2'), { name: 'TestFehler' }) }) });
      const vorWurf = protokoll.length;
      const wurfStatus = [];
      for (let i = 0; i < 5; i++) wurfStatus.push((await aufruf(wirft, r)).status);
      const warntWurf = protokoll.slice(vorWurf).some((z) => z === `rate-limit: ${r.rl} nicht prüfbar (TestFehler) — offen`);
      offen.push({ name: r.name, ok: !ohne429 && warnt && wurfStatus.every((s) => s !== 429 && s < 500) && warntWurf && wirft[r.rl].aufrufe.length === 5, a: { status: [ohne429, warnt, warntWurf, ...wurfStatus].join(' ') } });
    }
    geheim.push('test-geheim-meldung-w2');
    await pruefeFaelle('Z1-W2 AR70: Bindung je Route (4. Anfrage → 429 vor dem DO, Antwort wie bisher, Retry-After 60)', verdrahtung, (f) => (f.ok ? null : `ist ${f.a.status} ${f.a.text}`));
    await pruefeFaelle('Z1-W2 AR70: Bindung fehlt → Warnung und offen; limit() wirft → Warnung mit Namen, offen, nie 5xx', offen, (f) => (f.ok ? null : `ist ${f.a.status}`));
  }

  // Z1-W2 Punkt 3: Vorfilter auf die exakte Form vor SHA und DO: Vorgangs-ID genau 24, Abholgeheimnis genau 43 Zeichen b64url
  // (zufall(18), zufall(32)); sonst 400 ungueltig, und der DO bekommt nichts. Die richtige Form erreicht den DO (404 vorgang-unbekannt).
  {
    const env = umgebung();
    const vorg = 'Ab1_-'.repeat(4) + 'Ab1_'; // 24
    const geh = 'Cd2_-'.repeat(8) + 'Cd2'; // 43
    const pfade = ['/konto/vorgang/abholen', '/konto/vorgang/abbrechen'];
    const body = (v, g) => ({ vorgang: v, abholGeheimnis: g, beweis: { ts: T0 } });
    const schlecht = [
      ['Vorgang 23 Zeichen', vorg.slice(1), geh], ['Vorgang 25 Zeichen', vorg + 'a', geh], ['Vorgang mit +', vorg.slice(1) + '+', geh], ['Vorgang mit =', vorg.slice(1) + '=', geh],
      ['Vorgang mit Leerzeichen', vorg.slice(1) + ' ', geh], ['Vorgang leer', '', geh], ['Vorgang Zahl', 24, geh], ['Vorgang null', null, geh], ['Vorgang Liste', [vorg], geh],
      ['Geheimnis 42 Zeichen', vorg, geh.slice(1)], ['Geheimnis 44 Zeichen', vorg, geh + 'a'], ['Geheimnis mit /', vorg, geh.slice(1) + '/'], ['Geheimnis mit Zeilenumbruch', vorg, geh.slice(1) + '\n'],
      ['Geheimnis leer', vorg, ''], ['Geheimnis fehlt', vorg, undefined], ['Geheimnis Objekt', vorg, { a: geh }],
    ];
    const faelle = [];
    for (const pfad of pfade) {
      const davor = env.KONTO.anfragen.length;
      const antworten = [];
      for (const [name, v, g] of schlecht) antworten.push([name, await api(env, 'POST', pfad, { body: body(v, g) })]);
      const gut = await api(env, 'POST', pfad, { body: body(vorg, geh) });
      faelle.push({ name: `${pfad}: 16 falsche Formen → 400 ungueltig, kein DO-Aufruf`, ok: antworten.every(([, a]) => soll(a, 400, 'ungueltig')) && env.KONTO.anfragen.length === davor + 1, a: antworten.find(([, a]) => !soll(a, 400, 'ungueltig')) });
      faelle.push({ name: `${pfad}: richtige Form erreicht den DO (404 vorgang-unbekannt)`, ok: soll(gut, 404, 'vorgang-unbekannt'), a: [pfad, gut] });
    }
    await pruefeFaelle('Z1-W2 Vorfilter: Vorgang 24 und Abholgeheimnis 43 Zeichen b64url vor DO', faelle, (f) => (f.ok ? null : `ist ${f.a ? ist(f.a[1]) : '?'} bei ${f.a ? f.a[0] : '?'}`));
  }

  // Z1-W2 Punkt 6 [T]: Grenzen der Bodys (JSON 16 KB, Formular 8 KB) auf das Byte, mit und ohne content-length, und Lesefehler mitten im
  // Stream (→ ungültig 400 bzw. B10, nie 502).
  {
    const env = umgebung();
    const geraet = await testGeraet();
    const enc = new TextEncoder();
    const B10 = (await import('../konto-seiten.js')).SEITEN_TEXT.B10;
    let ipNr = 0;
    const ip = () => `11.0.0.${ipNr++}`;
    const jsonMitLaenge = (n) => {
      const basis = { geraet: geraet.angaben, rueckPort: RUECK_PORT, fuell: '' };
      const leer = enc.encode(JSON.stringify(basis)).length;
      return JSON.stringify({ ...basis, fuell: 'a'.repeat(n - leer) });
    };
    const formMitLaenge = (n) => {
      const basis = 'v=' + 'q'.repeat(24) + '&email=a%40extern.test&passwort=test-falsch-123&fuell=';
      return basis + 'a'.repeat(n - basis.length);
    };
    const stromAus = (text, stueck = 1000) => {
      const bytes = enc.encode(text);
      let pos = 0;
      return new ReadableStream({
        pull(c) {
          if (pos >= bytes.length) return c.close();
          c.enqueue(bytes.slice(pos, pos + stueck));
          pos += stueck;
        },
      });
    };
    const strom = (pfad, text, typ) => worker.fetch(new Request('https://proxy.test' + pfad, { method: 'POST', headers: { 'CF-Connecting-IP': ip(), 'content-type': typ }, body: stromAus(text), duplex: 'half' }), env, makeWaitCtx());
    const mitLaenge = (pfad, text, laenge) => {
      let angefasst = 0;
      const req = { method: 'POST', headers: new Headers({ 'content-length': String(laenge), 'CF-Connecting-IP': ip() }), get body() { angefasst++; return stromAus(text); } };
      return handleKonto(req, env, new URL('https://proxy.test' + pfad), makeWaitCtx()).then((res) => ({ res, angefasst: () => angefasst }));
    };
    const kaputt = (pfad, typ) => {
      let n = 0;
      const body = new ReadableStream({
        pull(c) {
          if (n++ === 0) c.enqueue(enc.encode('v=' + 'q'.repeat(24) + '&email='));
          else c.error(new Error('test-lesefehler'));
        },
      });
      return worker.fetch(new Request('https://proxy.test' + pfad, { method: 'POST', headers: { 'CF-Connecting-IP': ip(), 'content-type': typ }, body, duplex: 'half' }), env, makeWaitCtx());
    };
    const j16 = 16 * 1024;
    const f8 = 8 * 1024;
    const jOk = await strom('/konto/vorgang', jsonMitLaenge(j16), 'application/json');
    const jZu = await strom('/konto/vorgang', jsonMitLaenge(j16 + 1), 'application/json');
    const jOkL = await mitLaenge('/konto/vorgang', jsonMitLaenge(j16), j16);
    const jZuL = await mitLaenge('/konto/vorgang', jsonMitLaenge(j16 + 1), j16 + 1);
    const fOk = await strom('/konto/passwort', formMitLaenge(f8), 'application/x-www-form-urlencoded');
    const fZu = await strom('/konto/passwort', formMitLaenge(f8 + 1), 'application/x-www-form-urlencoded');
    const fOkL = await mitLaenge('/konto/passwort', formMitLaenge(f8), f8);
    const fZuL = await mitLaenge('/konto/passwort', formMitLaenge(f8 + 1), f8 + 1);
    const jOkDaten = await jOk.json();
    geheim.push(jOkDaten.abholGeheimnis, jOkDaten.code);
    const jOkLDaten = await jOkL.res.json();
    geheim.push(jOkLDaten.abholGeheimnis, jOkLDaten.code);
    check('Z1-W2 [T] 6: JSON-Body genau 16 KB (16384 Bytes) wird angenommen, 16385 abgelehnt (400 ungueltig); als Stream und laut content-length (dann ohne den Body zu lesen)',
      jOk.status === 200 && jZu.status === 400 && (await jZu.json()).code === 'ungueltig' && jOkL.res.status === 200 && jZuL.res.status === 400 && jZuL.angefasst() === 0);
    const fOkText = await fOk.text();
    check('Z1-W2 [T] 6: Formular genau 8 KB (8192 Bytes) wird gelesen (dann 404 B10: Vorgang unbekannt), 8193 abgelehnt (400 B10); als Stream und laut content-length',
      fOk.status === 404 && fOkText.includes(B10) && fZu.status === 400 && (await fZu.text()).includes(B10) && fOkL.res.status === 404 && fZuL.res.status === 400 && fZuL.angefasst() === 0);
    const kJson = await kaputt('/konto/vorgang', 'application/json');
    const kPass = await kaputt('/konto/passwort', 'application/x-www-form-urlencoded');
    const kBest = await kaputt('/konto/bestaetigen', 'application/x-www-form-urlencoded');
    check('Z1-W2 Punkt 6: Lesefehler mitten im Stream → ungültig: JSON 400 ungueltig, Passwort-Formular 400 B10, Bestätigen 403 B10 (nie 502)',
      soll({ status: kJson.status, daten: await kJson.json() }, 400, 'ungueltig') && kPass.status === 400 && (await kPass.text()).includes(B10) && kBest.status === 403 && (await kBest.text()).includes(B10));
    check('Z1-W2 Punkt 6: der Lesefehler steht nicht im Log', !protokoll.some((z) => z.includes('test-lesefehler')));
  }

  // Z1-W2 [T] P17: esc an jedem Wert der Seiten (Vorgang im Formular und im Google-Link, Seitentoken, E-Mail, Code, Rechnername).
  {
    const { seiteAnmelden, seiteBestaetigen } = await import('../konto-seiten.js');
    const boese = 'a"\'<>&b';
    const anmelden = seiteAnmelden({ vorgang: boese, google: true, fehler: '', email: boese });
    const bestaetigen = seiteBestaetigen({ vorgang: boese, seitenToken: boese, email: boese, code: boese, rechnerName: boese });
    check('Z1-W2 [T] P17: seiteAnmelden und seiteBestaetigen escapen jeden eingesetzten Wert (kein rohes Zeichen aus a"\'<>&b im Markup)',
      !anmelden.includes(boese) && !bestaetigen.includes(boese) && anmelden.includes('name="v" value="a&quot;&#39;&lt;&gt;&amp;b"') && anmelden.includes('href="/konto/google?v=a%22\'%3C%3E%26b"'.replace("'", '&#39;'))
        && bestaetigen.includes('name="v" value="a&quot;&#39;&lt;&gt;&amp;b"') && bestaetigen.includes('name="t" value="a&quot;&#39;&lt;&gt;&amp;b"') && bestaetigen.includes('a&quot;&#39;&lt;&gt;&amp;b</p>'));
    // Z2 Fixrunde 1 (OE6): die Seite nach Ja maskiert v und e; der Port ist streng eine ganze Zahl 1024–65535, sonst gibt es keine Seite.
    const { seiteWeiter } = await import('../konto-seiten.js');
    const weiter = seiteWeiter({ port: 61001, vorgang: boese, e: boese });
    const ohnePort = [80, 1023, 65536, 61001.5, '61001', '61001"><script>', null, undefined].map((port) => {
      try {
        seiteWeiter({ port, vorgang: 'v', e: 'e' });
        return 'Seite';
      } catch {
        return 'abgelehnt';
      }
    });
    check('Z2 A1: seiteWeiter maskiert v und e im Formular (kein rohes Zeichen aus a"\'<>&b) und nimmt nur einen Port 1024–65535 als ganze Zahl (8 falsche abgelehnt)',
      !weiter.includes(boese) && weiter.includes('name="v" value="a&quot;&#39;&lt;&gt;&amp;b"') && weiter.includes('name="e" value="a&quot;&#39;&lt;&gt;&amp;b"')
        && weiter.includes('<form method="post" action="http://127.0.0.1:61001/anmeldung/zurueck">') && ohnePort.every((x) => x === 'abgelehnt'));
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
      const v = await api(env, 'POST', '/konto/vorgang', { body: { geraet: (geraet ?? (await testGeraet())).angaben, rueckPort: RUECK_PORT } });
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
    // Z2 Nr. 5: der Rechnername nur aus erlaubten Zeichen (aus <b>Regie</b> "1" & 'A' wird bRegieb 1 'A'), escaped und als B25.
    check('P17 4.1, Z2: Einladung → Bestätigungsseite: Angemeldet als E-Mail, Code wie im Launcher, Rechner (B25, nur erlaubte Zeichen, escaped), Ja und Nein',
      b1.status === 200 && zeigt(b1, B.B7_frage, B.B7_ja, B.B7_nein) && b1.html.includes(esc('Angemeldet als erika@extern.test'))
        && b1.html.includes(`<p class="code">${v1.code}</p>`) && b1.html.includes('<p>Rechner: bRegieb 1 &#39;A&#39; (vom Rechner gemeldet)</p>')
        && !b1.html.includes('<b>Regie') && typeof t1 === 'string' && t1.length > 20 && versteckt(b1.html, 'v') === v1.vorgang);
    const ohneT = await sende(env, '/konto/bestaetigen', { v: v1.vorgang, antwort: 'ja' });
    const falschT = await sende(env, '/konto/bestaetigen', { v: v1.vorgang, t: 'test-falsches-seitentoken', antwort: 'ja' });
    const w = await api(env, 'POST', '/konto/vorgang/abholen', { body: { vorgang: v1.vorgang, abholGeheimnis: v1.abholGeheimnis, beweis: await geraet.beweis('abholen', v1.vorgang, uhr()) } });
    check('P17 4.1: Bestätigen ohne oder mit falschem Seitentoken → 403 B10, der Launcher wartet weiter',
      ohneT.status === 403 && zeigt(ohneT, B.B10) && falschT.status === 403 && zeigt(falschT, B.B10) && w.daten.zustand === 'wartet');
    const ja = await sende(env, '/konto/bestaetigen', { v: v1.vorgang, t: t1, antwort: 'ja' });
    // Z2 Fixrunde 1 (OE6): Ja zeigt eine Seite mit B26 und dem Knopf B29; das Formular schickt v und e per POST an den Rückkanal.
    const eJa = versteckt(ja.html, 'e');
    geheim.push(eJa);
    const ab = await api(env, 'POST', '/konto/vorgang/abholen', { body: { vorgang: v1.vorgang, abholGeheimnis: v1.abholGeheimnis, beweis: await geraet.beweis('abholen', v1.vorgang, uhr()), e: eJa } });
    geheim.push(ab.daten && ab.daten.sitzung);
    check('P17 4.1, Z2: Ja → Seite mit B26 und Knopf B29, Formular POST an den Rückkanal auf 127.0.0.1 (v und e versteckt); der Launcher holt mit e die Sitzung des Externen ab',
      ja.status === 200 && zeigt(ja, B.B26, B.B29) && ja.kopf.get('location') === null
        && ja.html.includes(`<form method="post" action="http://127.0.0.1:${RUECK_PORT}/anmeldung/zurueck">`) && versteckt(ja.html, 'v') === v1.vorgang
        && typeof eJa === 'string' && ab.daten.zustand === 'bestaetigt' && ab.daten.stand.email === 'erika@extern.test');

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
    await fall('Passwörter ungleich', { email: 'fritz@extern.test', einladungscode: 'AAAA-BBBB-CCCC', neu: 'test-passwort-neu', neu2: 'test-passwort-neu2' }, 400, 'B15_ungleich', {}, (a) => a.html.includes('<details open>'));
    await fall('Passwort zu kurz', { email: 'fritz@extern.test', einladungscode: 'AAAA-BBBB-CCCC', neu: 'kurz', neu2: 'kurz' }, 400, 'B15_kurz', {}, (a) => a.html.includes('<details open>'));
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
    const anfDr = [];
    for (let i = 0; i < 11; i++) {
      dr.push(await sende(env, '/konto/passwort', { v: v5.vorgang, email: `niemand-${i}@extern.test`, passwort: 'test-falsch-123' }, '10.3.0.1'));
      anfDr.push(env.KONTO.anfragen.length);
    }
    // Die Drossel kommt vor dem DO: die 11. Anfrage erreicht den DO nicht mehr (Zähler der Attrappe wächst nicht).
    faelle.push({ name: 'Drossel: 11. Formular je IP und Periode (KONTO_RL_PASSWORT, 10 je 60 s)', ok: dr.slice(0, 10).every((a) => a.status === 401) && dr[10].status === 429 && zeigt(dr[10], B.B21) && dr[10].kopf.get('Retry-After') === '60' && anfDr[10] === anfDr[9] && anfDr[9] > anfDr[8], a: dr[10] });
    await pruefeFaelle('P17 4: Fehlertexte der Anmeldeseite', faelle, (f) => (f.ok ? null : `ist ${f.a.status} ${f.a.html.slice(f.a.html.indexOf('<h1>'), f.a.html.indexOf('<h1>') + 160)}`));

    // Escape: E-Mail mit HTML und Anführungszeichen landet nur escaped im Formular.
    const v6 = await vorgang(env);
    const boese = await sende(env, '/konto/passwort', { v: v6.vorgang, email: '"><script>x()</script>@extern.test', passwort: 'test-falsch-123' }, '10.4.0.1');
    // Das versteckte Feld v (aus der Anfrage, auch auf der gedrosselten Seite) wird ebenfalls escaped.
    const roherV = 'a"\'<>&b';
    const vRes = await worker.fetch(new Request('https://proxy.test/konto/passwort', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '10.3.0.1', 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ v: roherV, email: 'x@extern.test', passwort: 'test-falsch-123' }).toString(),
    }), env, makeWaitCtx());
    const vEsc = { status: vRes.status, html: await vRes.text() };
    check('P17 Escape: Rechnername (oben) und eingegebene E-Mail mit HTML und Anführungszeichen nur escaped',
      boese.status === 401 && boese.html.includes('value="&quot;&gt;&lt;script&gt;x()&lt;/script&gt;@extern.test"') && !boese.html.includes('<script')
        && vEsc.status === 429 && vEsc.html.includes('name="v" value="a&quot;&#39;&lt;&gt;&amp;b"') && !vEsc.html.includes(roherV));

    // S5: ohne Einrichtung eine Seite statt JSON.
    const ohne = umgebung({ KONTO_SCHLUESSEL: undefined });
    const s5 = await hole(ohne, '/konto/anmelden?v=x');
    const s5b = await sende(ohne, '/konto/passwort', { v: 'x', email: 'a@b.test', passwort: 'test-falsch-123' });
    // Ausnahme und Ausfall des DO auf den Seiten-Routen: Seite „interner Fehler“ (502), nie JSON, B10 oder B12.
    const rohFetch = async (e, pfad, init) => {
      const res = await worker.fetch(new Request('https://proxy.test' + pfad, init), e, makeWaitCtx());
      return { status: res.status, kopf: res.headers, html: await res.text() };
    };
    const formKopf = (ipAdr) => ({ 'CF-Connecting-IP': ipAdr, 'content-type': 'application/x-www-form-urlencoded' });
    const formRoh = (e, pfad, felder, ipAdr) => rohFetch(e, pfad, { method: 'POST', headers: formKopf(ipAdr), body: new URLSearchParams(felder).toString() });
    const defekt = (modus) => {
      const e = umgebung();
      const jur = e.KONTO.jurisdiction;
      e.KONTO.jurisdiction = (x) => {
        const n = jur(x);
        const get = n.get;
        n.get = (id) => {
          const s = get(id);
          return { fetch: (rq) => modus(rq, s) };
        };
        return n;
      };
      return e;
    };
    const wirft = defekt(() => { throw new Error('boom'); });
    const keinJsonDo = defekt(() => new Response('<html>Bad Gateway</html>', { status: 502 }));
    const fuenfhundert = defekt(() => new Response(JSON.stringify({ ok: false, code: 'falsch', status: 500 })));
    const ohneStatus = defekt(() => new Response(JSON.stringify({ ok: false, code: 'vorgang-unbekannt' })));
    const ausfallSeiten = [
      await rohFetch(wirft, '/konto/anmelden?v=x', { headers: { 'CF-Connecting-IP': '10.6.0.1' } }),
      await formRoh(wirft, '/konto/passwort', { v: 'x', email: 'a@b.test', passwort: 'test-falsch-123' }, '10.6.0.2'),
      await rohFetch(keinJsonDo, '/konto/anmelden?v=x', { headers: { 'CF-Connecting-IP': '10.6.0.3' } }),
      await rohFetch(fuenfhundert, '/konto/anmelden?v=x', { headers: { 'CF-Connecting-IP': '10.6.0.4' } }),
      await rohFetch(ohneStatus, '/konto/anmelden?v=x', { headers: { 'CF-Connecting-IP': '10.6.0.5' } }),
      await formRoh(fuenfhundert, '/konto/passwort', { v: 'x', email: 'a@b.test', passwort: 'test-falsch-123' }, '10.6.0.6'),
      await formRoh(fuenfhundert, '/konto/bestaetigen', { v: 'x', t: 'test-seitentoken', antwort: 'ja' }, '10.6.0.7'),
      await formRoh(ohneStatus, '/konto/bestaetigen', { v: 'x', t: 'test-seitentoken', antwort: 'nein' }, '10.6.0.8'),
    ];
    const alsAusfallSeite = ausfallSeiten.every((a) => a.status === 502 && (a.kopf.get('content-type') || '').startsWith('text/html') && a.html.includes('role="alert">interner Fehler</p>'));
    // Z1-W2 Punkt 6 [T]: jede 502-Seite (Ausnahme auf jeder Seiten-Route, Ausfall des DO, unbekannter Code des DO im Default-Zweig von
    // passwortRoute) trägt dieselben Kopfzeilen wie die übrigen Seiten: CSP gleich, kein Set-Cookie, no-store, no-referrer, nosniff.
    const wirftG = defekt(() => { throw new Error('boom'); });
    wirftG.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
    wirftG.GOOGLE_CLIENT_SECRET = 'test-google-secret';
    const seltsam = defekt(() => new Response(JSON.stringify({ ok: false, code: 'seltsam', status: 400 })));
    const mehr502 = [
      await formRoh(wirft, '/konto/bestaetigen', { v: 'x', t: 'test-seitentoken', antwort: 'ja' }, '10.6.1.1'),
      await rohFetch(wirftG, '/konto/google?v=x', { headers: { 'CF-Connecting-IP': '10.6.1.2' } }),
      await rohFetch(wirftG, '/konto/google/zurueck?state=x&code=y', { headers: { 'CF-Connecting-IP': '10.6.1.3' } }),
      await formRoh(seltsam, '/konto/passwort', { v: 'x', email: 'a@b.test', passwort: 'test-falsch-123' }, '10.6.1.4'),
    ];
    const kopf502 = [...ausfallSeiten, ...mehr502].filter((a) => a.kopf.get('content-type') !== 'text/html; charset=utf-8' || a.kopf.get('cache-control') !== 'no-store'
      || a.kopf.get('referrer-policy') !== 'no-referrer' || a.kopf.get('x-content-type-options') !== 'nosniff'
      || a.kopf.get('content-security-policy') !== "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' http://127.0.0.1:*; base-uri 'none'; frame-ancestors 'none'" || a.kopf.get('set-cookie') !== null);
    check('Z1-W2 Punkt 6: alle 502-Seiten (' + (ausfallSeiten.length + mehr502.length) + ': Ausnahme auf jeder Seiten-Route, DO-Ausfall, unbekannter Code im Default-Zweig von passwortRoute) mit den Kopfzeilen der übrigen Seiten',
      mehr502.every((a) => a.status === 502 && a.html.includes('role="alert">interner Fehler</p>')) && kopf502.length === 0);

    // Z1-W2 [T]: das Aufklappfeld <details> ist offen genau bei B13 mit Einladungscode, B14, B15 (beide) und sonst zu.
    const offen = (name) => (faelle.find((f) => f.name === name) || { a: { html: '' } }).a.html.includes('<details open>');
    const zu = (name) => (faelle.find((f) => f.name === name) || { a: { html: '' } }).a.html.includes('<details>');
    check('Z1-W2 [T] P17: <details> offen bei B14, B15 ungleich und B15 kurz; zu bei B12 (falsches Passwort, unbekannte E-Mail), B13 mit Passwort und B23',
      offen('falscher Einladungscode') && offen('Passwörter ungleich') && offen('Passwort zu kurz')
        && zu('falsches Passwort') && zu('unbekannte E-Mail') && zu('fünfter Fehlversuch → Bremse 15 min') && zu('E-Mail von jakobsmedien.com'));

    // Formulare sind auf 8 KB begrenzt: als Stream ohne content-length (nach dem Überschreiten abgebrochen, nicht bis zum Ende
    // gelesen) und laut content-length (Body wird gar nicht angefasst).
    const strom = () => {
      const z = { pulls: 0, abgebrochen: false };
      const enc = new TextEncoder();
      z.body = new ReadableStream({
        pull(c) {
          z.pulls++;
          if (z.pulls > 16384) return c.close();
          c.enqueue(enc.encode(z.pulls === 1 ? `v=${v6.vorgang}&email=a%40extern.test&passwort=x&fuell=` : 'a'.repeat(1024)));
        },
        cancel() { z.abgebrochen = true; },
      });
      return z;
    };
    const sp1 = strom();
    const gross1 = await rohFetch(env, '/konto/passwort', { method: 'POST', headers: formKopf('10.5.0.1'), body: sp1.body, duplex: 'half' });
    const sp2 = strom();
    const gross2 = await rohFetch(env, '/konto/bestaetigen', { method: 'POST', headers: formKopf('10.5.0.2'), body: sp2.body, duplex: 'half' });
    let bodyAngefasst = 0;
    const versprochen = (pfad) => handleKonto({
      method: 'POST',
      headers: new Headers({ 'content-length': String(1024 * 1024), 'CF-Connecting-IP': '10.5.0.3' }),
      get body() { bodyAngefasst++; return null; },
    }, env, new URL('https://proxy.test' + pfad), makeWaitCtx());
    const gross3 = await versprochen('/konto/passwort');
    const gross4 = await versprochen('/konto/bestaetigen');
    const grossOk = gross1.status === 400 && zeigt(gross1, B.B10) && gross2.status === 403 && zeigt(gross2, B.B10)
      && sp1.abgebrochen && sp1.pulls < 50 && sp2.abgebrochen && sp2.pulls < 50
      && gross3.status === 400 && gross4.status === 403 && bodyAngefasst === 0;
    check('P17 S5: ohne Einrichtung zeigen Anmeldeseite und Formular S5 als Seite (503)',
      s5.status === 503 && s5b.status === 503 && zeigt(s5, FEHLER_TEXT['nicht-eingerichtet']) && (s5.kopf.get('content-type') || '').startsWith('text/html')
        && alsAusfallSeite && grossOk);

    // Kopfzeilen und kein Skript auf jeder Seite dieses Blocks (Z2: form-action auch http://127.0.0.1:* für den Sprung nach Ja).
    const CSP = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' http://127.0.0.1:*; base-uri 'none'; frame-ancestors 'none'";
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

  // ── P18: Google-Anmeldung (Spec 4, 4.1 Schritt 2; EP6; Texte B6, B10, B11, B16–B20) ──
  {
    const { SEITEN_TEXT: B, esc } = await import('../konto-seiten.js');
    const { GOOGLE_TOKEN, pkceChallenge } = await import('../konto-google.js');
    const CLIENT = 'test-client.apps.googleusercontent.com';
    const SECRET = 'test-google-client-secret';
    geheim.push(SECRET);
    const env = umgebung({ GOOGLE_CLIENT_ID: CLIENT, GOOGLE_CLIENT_SECRET: SECRET });
    const uhr = env.KONTO_UHR;
    const admin = await ersterAdmin(env);
    const sp = env.KONTO.speicher();
    const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const idToken = (angaben) => `${b64u({ alg: 'RS256', kid: 'test' })}.${b64u(angaben)}.test-signatur`;
    // fetch-Attrappe für Google: jede Anfrage wird mitgeschrieben; `google` bestimmt die Antwort des Token-Endpunkts.
    const aufrufe = [];
    let google = null;
    const altesFetch = globalThis.fetch;
    globalThis.fetch = async (u, init = {}) => {
      aufrufe.push({ url: String(u), method: init.method, body: String(init.body ?? ''), redirect: init.redirect, signal: init.signal });
      // Wie die Workers-Laufzeit (gemessen 06.11. unter workerd): `redirect: 'error'` gibt es dort nicht, der Aufruf wirft. Die Attrappe
      // nahm den Wert vorher an; so erreichte die Anmeldung die Abnahme, ohne dass je ein Token-Tausch möglich war.
      if (init.redirect !== undefined && init.redirect !== 'follow' && init.redirect !== 'manual') {
        throw new TypeError('Invalid redirect value, must be one of "follow" or "manual"');
      }
      if (String(u) !== GOOGLE_TOKEN) return new Response('{}', { status: 404 });
      if (init.signal && init.signal.aborted) throw init.signal.reason;
      return google({ signal: init.signal });
    };
    const seitenP18 = [];
    const hole = async (pfad, e = env) => {
      const res = await worker.fetch(new Request('https://proxy.test' + pfad, { headers: { 'CF-Connecting-IP': '8.8.8.8' } }), e, makeWaitCtx());
      const a = { status: res.status, kopf: res.headers, html: await res.text() };
      seitenP18.push(a);
      return a;
    };
    // Ausfall des DO (AR53): `ausfallBei` nennt die DO-Aktion, deren Antwort ein 5xx ist; alle anderen Aktionen laufen echt.
    let ausfallBei = null;
    let seltsamBei = null; // Z1-W2: Aktion, deren Antwort ein unbekannter Code mit Status 400 ist (Default-Zweig von googleKontoFehler)
    const jurisdiktion = env.KONTO.jurisdiction;
    env.KONTO.jurisdiction = (x) => {
      const n = jurisdiktion(x);
      const get = n.get;
      n.get = (id) => {
        const s = get(id);
        return {
          fetch: (rq) =>
            ausfallBei && rq.url.endsWith(`/${ausfallBei}`)
              ? new Response(JSON.stringify({ ok: false, code: 'vorgang-unbekannt', status: 500 }))
              : seltsamBei && rq.url.endsWith(`/${seltsamBei}`)
                ? new Response(JSON.stringify({ ok: false, code: 'seltsam', status: 400 }))
                : s.fetch(rq),
        };
      };
      return n;
    };
    /** Vorgang anlegen (je Aufruf eigene IP, die Drossel zählt 10 je IP) und den Google-Start holen → { v, ort (URL), state, nonce }. */
    let ipNr = 0;
    const legeAn = async () => {
      const v = await api(env, 'POST', '/konto/vorgang', { body: { geraet: (await testGeraet()).angaben, rueckPort: RUECK_PORT }, ip: `9.9.8.${ipNr++}` });
      geheim.push(v.daten.abholGeheimnis, v.daten.code);
      return v;
    };
    const starte = async () => {
      const v = await legeAn();
      const s = await hole(`/konto/google?v=${encodeURIComponent(v.daten.vorgang)}`);
      const ort = new URL(s.kopf.get('location') || 'https://leer.invalid/');
      return { v: v.daten, s, ort, state: ort.searchParams.get('state'), nonce: ort.searchParams.get('nonce') };
    };
    const angaben = (nonce, mehr = {}) => ({
      iss: 'https://accounts.google.com', aud: CLIENT, azp: CLIENT, sub: '1234567890', hd: 'jakobsmedien.com', email: 'gabi@jakobsmedien.com',
      email_verified: true, name: 'Gabi Google', iat: Math.floor(uhr() / 1000), exp: Math.floor(uhr() / 1000) + 3600, nonce, ...mehr,
    });
    const tokenAntwort = (a) => () => new Response(JSON.stringify({ access_token: 'test-access-token', id_token: idToken(a), token_type: 'Bearer' }), { status: 200 });

    // Start: 302 zu Google mit PKCE S256; der Verifier liegt nur im Vorgang (DO).
    const st = await starte();
    const vg = await sp.ctx.storage.get(`vorgang:${st.v.vorgang}`);
    const p = st.ort.searchParams;
    check('P18 EP6: Start → 302 an accounts.google.com mit client_id, redirect_uri, scope, hd, prompt, state, nonce, code_challenge S256',
      st.s.status === 302 && st.ort.origin + st.ort.pathname === 'https://accounts.google.com/o/oauth2/v2/auth' && p.get('client_id') === CLIENT
        && p.get('redirect_uri') === 'https://proxy.test/konto/google/zurueck' && p.get('response_type') === 'code' && p.get('scope') === 'openid email profile'
        && p.get('hd') === 'jakobsmedien.com' && p.get('prompt') === 'select_account' && p.get('code_challenge_method') === 'S256'
        && !!vg && !!vg.google && vg.google.state === st.state && vg.google.nonce === st.nonce && p.get('code_challenge') === (await pkceChallenge(vg.google.verifier))
        && !st.ort.href.includes(vg.google.verifier) && st.s.kopf.get('cache-control') === 'no-store' && st.s.kopf.get('set-cookie') === null);

    // Rückkehr ok → Bestätigungsseite, neues Konto Kollege; der Token-Tausch trägt Code, Verifier und Secret.
    google = tokenAntwort(angaben(st.nonce));
    aufrufe.length = 0;
    const z = await hole(`/konto/google/zurueck?state=${st.state}&code=test-code-ok`);
    const tausch = aufrufe[0] ? new URLSearchParams(aufrufe[0].body) : new URLSearchParams();
    const t = (z.html.match(/name="t" value="([^"]*)"/) || [])[1];
    geheim.push(t, 'test-code-ok', vg.google.verifier);
    check('P18 4.1: Rückkehr ok → Bestätigungsseite mit E-Mail und Code des Launchers',
      z.status === 200 && z.html.includes(esc('Angemeldet als gabi@jakobsmedien.com')) && z.html.includes(`<p class="code">${st.v.code}</p>`) && !!t);
    check('P18 EP6: genau ein Token-Tausch (POST oauth2.googleapis.com/token mit code, code_verifier, client_id, client_secret, redirect_uri, grant_type)',
      aufrufe.length === 1 && aufrufe[0].method === 'POST' && tausch.get('code') === 'test-code-ok' && tausch.get('code_verifier') === vg.google.verifier
        && tausch.get('client_id') === CLIENT && tausch.get('client_secret') === SECRET && tausch.get('grant_type') === 'authorization_code'
        && tausch.get('redirect_uri') === 'https://proxy.test/konto/google/zurueck');
    const kid = await sp.ctx.storage.get('email:gabi@jakobsmedien.com');
    const konto = kid ? await sp.ctx.storage.get(`konto:${kid}`) : null;
    check('P18 4: erste Google-Anmeldung legt einen Kollegen an (art google, Name von Google)', !!konto && konto.stufe === 'kollege' && konto.art === 'google' && konto.name === 'Gabi Google');

    // Gegenproben-Klasse: jede Abweichung im id_token, beim Tausch oder im Konto → eigene Seite, kein Konto.
    const gesperrt = await rufeDo(sp, 'konto-aus-google', { email: 'gesperrt@jakobsmedien.com', name: 'Gesperrt' });
    await rufeDo(sp, 'admin-aktion', { kid: admin, aktion: { aktion: 'zugang-loeschen', kid: gesperrt.kid } });
    const fremdesKonto = await rufeDo(sp, 'konto-aus-google', { email: 'erster@jakobsmedien.com', name: 'Erster' });
    const faelle = [
      { name: 'hd fremd (E-Mail jakobsmedien.com)', g: (n) => tokenAntwort(angaben(n, { hd: 'andere.de', email: 'neu@jakobsmedien.com' })), soll: [403, 'B18'] },
      { name: 'E-Mail-Domain fremd, hd stimmt', g: (n) => tokenAntwort(angaben(n, { email: 'gabi@andere.de' })), soll: [403, 'B18'] },
      { name: 'E-Mail unbestätigt', g: (n) => tokenAntwort(angaben(n, { email_verified: false, email: 'neu@jakobsmedien.com' })), soll: [403, 'B19'] },
      { name: 'nonce falsch', g: () => tokenAntwort(angaben('test-fremde-nonce-1234', { email: 'neu@jakobsmedien.com' })), soll: [403, 'B20'] },
      { name: 'aud falsch', g: (n) => tokenAntwort(angaben(n, { aud: 'fremd.apps.googleusercontent.com', azp: 'fremd.apps.googleusercontent.com', email: 'neu@jakobsmedien.com' })), soll: [403, 'B20'] },
      { name: 'iss falsch', g: (n) => tokenAntwort(angaben(n, { iss: 'https://evil.example', email: 'neu@jakobsmedien.com' })), soll: [403, 'B20'] },
      { name: 'exp vorbei', g: (n) => tokenAntwort(angaben(n, { exp: Math.floor(uhr() / 1000) - 1, email: 'neu@jakobsmedien.com' })), soll: [403, 'B20'] },
      { name: 'Token-Tausch 400', g: () => () => new Response('{"error":"invalid_grant"}', { status: 400 }), soll: [403, 'B20'] },
      { name: 'id_token unlesbar', g: () => () => new Response('{"id_token":"kaputt"}', { status: 200 }), soll: [403, 'B20'] },
      { name: 'Google nicht erreichbar', g: () => () => { throw new TypeError('fetch failed'); }, soll: [403, 'B20'] },
      { name: 'Abbruch bei Google (error=access_denied)', g: () => tokenAntwort({}), pfad: (s) => `/konto/google/zurueck?state=${s}&error=access_denied`, soll: [400, 'B20'] },
      { name: 'state unbekannt', g: () => tokenAntwort({}), pfad: () => '/konto/google/zurueck?state=test-unbekannter-state&code=x', soll: [404, 'B10'] },
      { name: 'Google-Konto gesperrt', g: (n) => tokenAntwort(angaben(n, { email: 'gesperrt@jakobsmedien.com' })), soll: [403, 'B16'] },
      { name: 'Vorgang schon an einem anderen Konto', g: (n) => tokenAntwort(angaben(n)), vorher: async (v) => rufeDo(sp, 'vorgang-konto-binden', { vorgang: v, kid: fremdesKonto.kid }), soll: [409, 'B11'] },
    ];
    const vorherKonten = (await sp.ctx.storage.list({ prefix: 'konto:' })).size;
    await pruefeFaelle('P18 4: Google-Rückkehr abgelehnt (Seite je Grund, kein neues Konto)', faelle, async (f) => {
      const s = await starte();
      if (f.vorher) await f.vorher(s.v.vorgang);
      google = f.g(s.nonce);
      const a = await hole(f.pfad ? f.pfad(s.state) : `/konto/google/zurueck?state=${s.state}&code=test-code-fall`);
      const [status, nr] = f.soll;
      return a.status === status && a.html.includes(esc(B[nr])) && !a.html.includes('name="t"') ? null : `ist ${a.status} ${a.html.slice(a.html.indexOf('<h1>'), a.html.indexOf('<h1>') + 140)}`;
    });
    // Ausfall des DO (5xx) an jeder der vier Stellen → Seite „interner Fehler“ (502), nie B10 „Link abgelaufen“ oder B11 (AR53).
    const ausfall = async (aktion, pfad) => {
      ausfallBei = aktion;
      try {
        return await hole(pfad);
      } finally {
        ausfallBei = null;
      }
    };
    const alsAusfall = (a) => a.status === 502 && a.html.includes('role="alert">interner Fehler</p>') && !a.html.includes(esc(B.B10)) && !a.html.includes(esc(B.B11));
    const ausfallVorgang = await legeAn();
    const ausfallMerken = await ausfall('vorgang-google-merken', `/konto/google?v=${encodeURIComponent(ausfallVorgang.daten.vorgang)}`);
    const ausfallState = await ausfall('vorgang-google-state', '/konto/google/zurueck?state=test-state-ausfall&code=x');
    const ausfallAus = await starte();
    google = tokenAntwort(angaben(ausfallAus.nonce, { email: 'erster@jakobsmedien.com' }));
    const ausfallKonto = await ausfall('konto-aus-google', `/konto/google/zurueck?state=${ausfallAus.state}&code=test-code-ausfall`);
    const ausfallBind = await starte();
    google = tokenAntwort(angaben(ausfallBind.nonce, { email: 'erster@jakobsmedien.com' }));
    const ausfallBinden = await ausfall('vorgang-konto-binden', `/konto/google/zurueck?state=${ausfallBind.state}&code=test-code-ausfall`);
    // Z1-W2 [T]: ein unbekannter Code des DO nach der Google-Prüfung (Default-Zweig von googleKontoFehler) ist die Ausfallseite, kein B10/B11.
    const seltsam = async (aktion) => {
      const s = await starte();
      google = tokenAntwort(angaben(s.nonce, { email: 'erster@jakobsmedien.com' }));
      seltsamBei = aktion;
      try {
        return await hole(`/konto/google/zurueck?state=${s.state}&code=test-code-seltsam`);
      } finally {
        seltsamBei = null;
      }
    };
    const seltsamKonto = await seltsam('konto-aus-google');
    const seltsamBinden = await seltsam('vorgang-konto-binden');
    check('Z1-W2 [T] P18: unbekannter Code des DO bei konto-aus-google und vorgang-konto-binden → Seite interner Fehler (502), Kopfzeilen wie die übrigen', alsAusfall(seltsamKonto) && alsAusfall(seltsamBinden)
      && seltsamKonto.kopf.get('content-security-policy') === seltsamBinden.kopf.get('content-security-policy') && seltsamKonto.kopf.get('set-cookie') === null);
    check('P18 4: abgelehnte Google-Anmeldungen legen kein Konto an',
      (await sp.ctx.storage.list({ prefix: 'konto:' })).size === vorherKonten && [ausfallMerken, ausfallState, ausfallKonto, ausfallBinden].every(alsAusfall));

    // Ein state gilt genau einmal (Wiederholung der Rückkehr → B10).
    const w = await starte();
    google = tokenAntwort(angaben(w.nonce, { email: 'wieder@jakobsmedien.com' }));
    const w1 = await hole(`/konto/google/zurueck?state=${w.state}&code=test-code-w`);
    const w2 = await hole(`/konto/google/zurueck?state=${w.state}&code=test-code-w`);
    geheim.push((w1.html.match(/name="t" value="([^"]*)"/) || [])[1]);
    check('P18 EP6: Rückkehr mit demselben state ein zweites Mal → 404 B10', w1.status === 200 && w2.status === 404 && w2.html.includes(esc(B.B10)));

    // Z1-W2 Punkt 5 und [T]: id_token-Prüfungen im Einzelnen, Härtung des Token-Abrufs, Log ohne E-Mail und Secret.
    {
      let zaehler = 0;
      const frisch = () => `z1-${zaehler++}@jakobsmedien.com`;
      const rueck = async (f) => {
        env.KONTO_RL_GOOGLE.neuesFenster(); // eine IP für alle Anfragen dieses Blocks: jede beginnt in einer neuen Periode
        const s = await starte();
        google = f(s.nonce);
        return hole(`/konto/google/zurueck?state=${s.state}&code=test-code-z1`);
      };
      const ok = (a) => a.status === 200 && a.html.includes('name="t"');
      const nein = (a, nr) => a.status === 403 && a.html.includes(esc(B[nr])) && !a.html.includes('name="t"');
      const ANDERE = 'andere.apps.googleusercontent.com';
      const jetztS = uhr() / 1000;
      const idFaelle = [
        { name: 'iss accounts.google.com (ohne https) gilt', mehr: { iss: 'accounts.google.com' }, soll: 'ok' },
        { name: 'iss mit Schrägstrich am Ende', mehr: { iss: 'https://accounts.google.com/' }, soll: 'B20' },
        { name: 'iss http statt https', mehr: { iss: 'http://accounts.google.com' }, soll: 'B20' },
        { name: 'iss mit Großbuchstaben', mehr: { iss: 'https://Accounts.google.com' }, soll: 'B20' },
        { name: 'iss mit Zusatz hinter dem Host', mehr: { iss: 'https://accounts.google.com.evil.example' }, soll: 'B20' },
        { name: 'mehrere aud, azp ist unser Client', mehr: { aud: [CLIENT, ANDERE], azp: CLIENT }, soll: 'ok' },
        { name: 'mehrere aud, azp ist ein fremder Client', mehr: { aud: [CLIENT, ANDERE], azp: ANDERE }, soll: 'B20' },
        { name: 'mehrere aud, azp fehlt', mehr: { aud: [CLIENT, ANDERE], azp: undefined }, soll: 'B20' },
        { name: 'aud-Liste ohne unseren Client, azp stimmt', mehr: { aud: [ANDERE, 'dritte.apps.googleusercontent.com'], azp: CLIENT }, soll: 'B20' },
        { name: 'aud als Liste mit nur unserem Client, azp fehlt', mehr: { aud: [CLIENT], azp: undefined }, soll: 'ok' },
        { name: 'email_verified als Text true', mehr: { email_verified: 'true' }, soll: 'B19' },
        { name: 'email_verified als Zahl 1', mehr: { email_verified: 1 }, soll: 'B19' },
        { name: 'email_verified fehlt', mehr: { email_verified: undefined }, soll: 'B19' },
        { name: 'hd fehlt', mehr: { hd: undefined }, soll: 'B18' },
        { name: 'hd in Großbuchstaben', mehr: { hd: 'JAKOBSMEDIEN.COM' }, soll: 'B18' },
        { name: 'exp genau jetzt (>= an der Grenze: abgelehnt)', mehr: { exp: jetztS }, soll: 'B20' },
        { name: 'exp eine Sekunde nach jetzt', mehr: { exp: jetztS + 1 }, soll: 'ok' },
        { name: 'exp als Text', mehr: { exp: String(jetztS + 3600) }, soll: 'B20' },
      ];
      await pruefeFaelle('Z1-W2 [T] P18: einzelne Angaben des id_token (iss exakt, azp bei mehreren aud, email_verified nur true, exp-Grenze)', idFaelle, async (f) => {
        const a = await rueck((n) => tokenAntwort(angaben(n, { email: frisch(), ...f.mehr })));
        const gut = f.soll === 'ok' ? ok(a) : nein(a, f.soll);
        return gut ? null : `ist ${a.status} ${a.html.slice(a.html.indexOf('<h1>'), a.html.indexOf('<h1>') + 140)}`;
      });
      check('Z1-W2 [T] P18: jetzt liegt auf einer ganzen Sekunde (Voraussetzung der exp-Grenze)', Number.isInteger(jetztS));

      // B17: ein Google-Konto, dessen Zugang bis abgelaufen ist, bekommt die Seite mit dem Datum (nicht B16, nicht „interner Fehler“).
      const abgl = await rufeDo(sp, 'konto-aus-google', { email: 'abgelaufen@jakobsmedien.com', name: 'Abgelaufen' });
      const kontoAbgl = await sp.ctx.storage.get(`konto:${abgl.kid}`);
      await sp.ctx.storage.put(`konto:${abgl.kid}`, { ...kontoAbgl, bis: uhr() - 3600_000 });
      const b17 = await rueck((n) => tokenAntwort(angaben(n, { email: 'abgelaufen@jakobsmedien.com' })));
      check('Z1-W2 [T] P18: Google-Konto mit abgelaufenem Zugang → 403 B17 mit Datum; kein Bestätigungsformular',
        b17.status === 403 && b17.html.includes(esc('Dein Zugang ist am 02.11.2026 abgelaufen. Frag einen Admin nach einer Verlängerung.')) && !b17.html.includes('name="t"'));

      // Härtung des Token-Abrufs: keine Weiterleitung, Frist 10 s, Antwort höchstens 64 KiB, Rest eines Fehlers verwerfen.
      const echteFrist = AbortSignal.timeout;
      const fristen = [];
      AbortSignal.timeout = (ms) => (fristen.push(ms), echteFrist.call(AbortSignal, ms));
      aufrufe.length = 0;
      const normal = await rueck((n) => tokenAntwort(angaben(n, { email: frisch() })));
      AbortSignal.timeout = echteFrist;
      check('Z1-W2 Punkt 5: der Token-Abruf geht mit redirect manual und einer Frist von 10 s (AbortSignal.timeout)',
        ok(normal) && aufrufe.length === 1 && aufrufe[0].redirect === 'manual' && aufrufe[0].signal instanceof AbortSignal && JSON.stringify(fristen) === '[10000]');
      AbortSignal.timeout = () => echteFrist.call(AbortSignal, 20);
      const haengt = await Promise.race([
        rueck(() => ({ signal }) => new Promise((_, ab) => signal && signal.addEventListener('abort', () => ab(signal.reason)))),
        new Promise((r) => setTimeout(() => r({ status: 'haengt', html: '' }), 3000)),
      ]);
      AbortSignal.timeout = echteFrist;
      check('Z1-W2 Punkt 5: antwortet Google nicht innerhalb der Frist, bricht der Abruf ab → 403 B20 (kein Hängen)', nein(haengt, 'B20'));
      aufrufe.length = 0;
      const weiter = await rueck(() => () => new Response(null, { status: 302, headers: { location: 'https://evil.example/' } }));
      check('Z1-W2 Punkt 5: eine Weiterleitung von Google ist keine gültige Antwort (kein id_token) → 403 B20', nein(weiter, 'B20'));
      check('Z1-W2 Punkt 5: der Weiterleitung wird nicht gefolgt (das Secret steht im Body, kein zweiter Abruf)',
        aufrufe.filter((a) => a.url === GOOGLE_TOKEN).length === 1 && !aufrufe.some((a) => a.url.includes('evil.example')));

      const strom = (bloecke, { status = 200, kopf = {} } = {}) => {
        const z = { pulls: 0, abgebrochen: false };
        const enc = new TextEncoder();
        z.res = new Response(
          new ReadableStream({
            pull(c) {
              z.pulls++;
              if (z.pulls > bloecke.length) return c.close();
              c.enqueue(enc.encode(bloecke[z.pulls - 1]));
            },
            cancel() { z.abgebrochen = true; },
          }, { highWaterMark: 0 }),
          { status, headers: kopf },
        );
        return z;
      };
      const mitPolster = (n, kb) => JSON.stringify({ id_token: idToken(angaben(n, { email: frisch() })), polster: 'x'.repeat(kb * 1024) });
      const knapp = await rueck((n) => () => new Response(mitPolster(n, 40), { status: 200 }));
      const zuGross = await rueck((n) => () => new Response(mitPolster(n, 70), { status: 200 }));
      const stromGross = strom(Array.from({ length: 200 }, () => 'a'.repeat(1024)));
      const stromA = await rueck(() => () => stromGross.res);
      const laenge = strom(['{}'], { kopf: { 'content-length': '100000' } });
      const laengeA = await rueck(() => () => laenge.res);
      const fehlerStrom = strom(Array.from({ length: 20 }, () => 'b'.repeat(1024)), { status: 500 });
      const fehlerA = await rueck(() => () => fehlerStrom.res);
      check('Z1-W2 Punkt 5: Antwort bis 64 KiB wird gelesen (40 KiB → angemeldet), größere abgelehnt (70 KiB → 403 B20)', ok(knapp) && nein(zuGross, 'B20'));
      check('Z1-W2 Punkt 5: ein Stream ohne content-length wird beim Überschreiten von 64 KiB abgebrochen (nicht bis zum Ende gelesen); ein content-length über 64 KiB wird gar nicht gelesen',
        nein(stromA, 'B20') && stromGross.abgebrochen && stromGross.pulls < 100 && nein(laengeA, 'B20') && laenge.pulls === 0);
      check('Z1-W2 Punkt 5: bei einer Fehlerantwort (HTTP 500) wird der Rest des Bodys verworfen (cancel), nicht gelesen', nein(fehlerA, 'B20') && fehlerStrom.abgebrochen && fehlerStrom.pulls === 0);

      // Log: ein Token-Tausch mit 400, dessen Body das Secret enthält, und alle Abweisungen nennen nur Gründe, nie E-Mail oder Secret.
      const vorLog = protokoll.length;
      const mitSecret = await rueck(() => () => new Response(`{"error":"invalid_client","error_description":"client_secret ${SECRET} abgelehnt"}`, { status: 400 }));
      const neuesLog = protokoll.slice(vorLog).join('\n');
      check('Z1-W2 [T] P18: Token-Tausch mit 400 und Secret im Body → 403 B20; das Secret steht nie im Log (nur der HTTP-Status)',
        nein(mitSecret, 'B20') && !neuesLog.includes(SECRET) && neuesLog.includes('konto-google: Anmeldung abgelehnt (Token-Tausch HTTP 400)'));
      check('Z1-W2 [T] P18: keine E-Mail-Adresse (kein @) in irgendeiner Zeile des Logs', protokoll.length > 5 && !protokoll.some((zeile) => zeile.includes('@')));
    }

    // Z1-W2 [T]: alle Seiten dieses Blocks (ohne die 302) tragen CSP, no-store, no-referrer, nosniff und kein Set-Cookie; der 302 sagt no-referrer.
    {
      const CSP = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' http://127.0.0.1:*; base-uri 'none'; frame-ancestors 'none'";
      const html = seitenP18.filter((a) => a.status !== 302);
      const umleitungen = seitenP18.filter((a) => a.status === 302);
      const falsch = html.filter((a) => a.kopf.get('content-type') !== 'text/html; charset=utf-8' || a.kopf.get('cache-control') !== 'no-store' || a.kopf.get('referrer-policy') !== 'no-referrer'
        || a.kopf.get('x-content-type-options') !== 'nosniff' || a.kopf.get('content-security-policy') !== CSP || a.kopf.get('set-cookie') !== null || /<script/i.test(a.html));
      check(`Z1-W2 [T] P18: Kopfzeilen jeder Seite (${html.length}) wie auf der Anmeldeseite; jeder 302 (${umleitungen.length}) mit referrer-policy no-referrer, no-store, ohne Set-Cookie`,
        html.length > 40 && falsch.length === 0 && umleitungen.length >= 10
          && umleitungen.every((a) => a.kopf.get('referrer-policy') === 'no-referrer' && a.kopf.get('cache-control') === 'no-store' && a.kopf.get('set-cookie') === null && a.kopf.get('location').startsWith('https://accounts.google.com/')));
    }

    // Ohne Client: Start und Rückkehr zeigen B6; Ablauf mit Google bestätigt und abgeholt.
    const ohne = umgebung();
    const o1 = await hole('/konto/google?v=x', ohne);
    const o2 = await hole('/konto/google/zurueck?state=x&code=y', ohne);
    check('P18 EP6: ohne GOOGLE_CLIENT_ID → Start und Rückkehr 503 mit B6', o1.status === 503 && o2.status === 503 && o1.html.includes(esc(B.B6)) && o2.html.includes(esc(B.B6)));
    globalThis.fetch = altesFetch;
    const alles = protokoll.join('\n');
    check('P18 G4: Konsole ohne Client-Secret, Code, Verifier und id_token; nur Gründe', !alles.includes(SECRET) && !alles.includes('test-code-') && !alles.includes(vg.google.verifier)
      && !alles.includes('test-signatur') && protokoll.some((zeile) => zeile === 'konto-google: Anmeldung abgelehnt (nonce)'));
    const q = readFileSync(new URL('../konto-google.js', import.meta.url), 'utf8');
    check('P18 rein: konto-google.js importiert nur konto-kern.js und ruft nur den Token-Endpunkt',
      (q.match(/^import /gm) || []).length === 1 && q.includes("from './konto-kern.js'") && (q.match(/fetch\(/g) || []).length === 1);
  }

  // ── Z2: Rückkanal-Bindung über HTTP (Spec 4.1 mit Z2; Fixrunde 1 OE6): anlegen mit Port → anmelden → Ja → Seite mit Knopf (POST an
  // 127.0.0.1:<port>, v und e versteckt) → abholen nur mit e; Doppelklick (I1); B27, B28, B8; Grabstein 60 s; Phishing ──
  {
    const { SEITEN_TEXT: B, esc } = await import('../konto-seiten.js');
    const env = umgebung();
    const uhr = env.KONTO_UHR;
    const admin = await ersterAdmin(env);
    const code = await einladen(env, admin, 'erika@extern.test');
    geheim.push('test-passwort-erika-z2');
    let ipNr = 0;
    const formular = async (pfad, felder) => {
      const res = await worker.fetch(new Request('https://proxy.test' + pfad, {
        method: 'POST',
        headers: { 'CF-Connecting-IP': `10.9.0.${ipNr++}`, 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(felder).toString(),
      }), env, makeWaitCtx());
      return { status: res.status, kopf: res.headers, html: await res.text() };
    };
    const seitenToken = (html) => (html.match(/name="t" value="([^"]*)"/) || [])[1];
    const abholen = async (v, geraet, e, geheimnis = v.abholGeheimnis) => api(env, 'POST', '/konto/vorgang/abholen', {
      body: { vorgang: v.vorgang, abholGeheimnis: geheimnis, beweis: await geraet.beweis('abholen', v.vorgang, uhr()), ...(e === undefined ? {} : { e }) },
    });

    // Nr. 1/2: der Port des Rückkanals ist Pflicht (ganze Zahl 1024–65535).
    const g0 = await testGeraet();
    const ohnePort = [];
    for (const p of [undefined, 80, 1023, 65536, 50000.5, '50321', null]) {
      ohnePort.push(await api(env, 'POST', '/konto/vorgang', { body: { geraet: g0.angaben, ...(p === undefined ? {} : { rueckPort: p }) } }));
    }
    check('Z2 1/2: POST /konto/vorgang ohne gültigen rueckPort (fehlt, 80, 1023, 65536, 50000.5, Text, null) → 400 S11', ohnePort.every((a) => soll(a, 400, 'ungueltig')));

    // Kette: anlegen mit Port, Einladung einlösen → Bestätigungsseite mit B25 und B24 direkt über Ja.
    const geraet = await testGeraet({ name: 'Regie-PC 7' });
    const v = (await api(env, 'POST', '/konto/vorgang', { body: { geraet: geraet.angaben, rueckPort: 61001 } })).daten;
    geheim.push(v.abholGeheimnis, v.code);
    const best = await formular('/konto/passwort', { v: v.vorgang, email: 'erika@extern.test', einladungscode: code, neu: 'test-passwort-erika-z2', neu2: 'test-passwort-erika-z2' });
    const t = seitenToken(best.html);
    geheim.push(t);
    const iWarn = best.html.indexOf(esc(B.B24));
    const iForm = best.html.indexOf('<form method="post" action="/konto/bestaetigen">');
    const iJa = best.html.indexOf(esc(B.B7_ja));
    const zwischen = iWarn < 0 ? 'fehlt' : best.html.slice(iWarn + esc(B.B24).length, iJa).replace(/<[^>]*>/g, '').trim();
    check('Z2 4: der Warnsatz B24 steht auf der Bestätigungsseite direkt über „Ja, das ist mein Rechner“ (kein anderer Text dazwischen)',
      best.status === 200 && iWarn > 0 && iWarn < iForm && iForm < iJa && zwischen === '');
    check('Z2 5: der Rechnername steht auf der Bestätigungsseite nur in der Form B25 („Rechner: ‹Name› (vom Rechner gemeldet)“)',
      best.html.includes(`<p>${esc('Rechner: Regie-PC 7 (vom Rechner gemeldet)')}</p>`) && (best.html.match(/Regie-PC 7/g) || []).length === 1);
    const vorJa = await abholen(v, geraet);

    // Nr. 3, Fixrunde 1 (OE6): Ja → 200-Seite mit B26 und einem Formular (POST) an genau http://127.0.0.1:<rueckPort>/anmeldung/zurueck;
    // v und e stehen nur als versteckte Felder darin, nie in einer Adresse oder einem Kopf; der Knopf trägt B29.
    /** Formular der Seite nach Ja: Ziel, Methode, versteckte Felder, Knopf. */
    const knopfFormular = (html) => {
      const f = html.match(/<form method="(post)" action="([^"]*)"><input type="hidden" name="v" value="([^"]*)"><input type="hidden" name="e" value="([^"]*)"><button type="submit">([^<]*)<\/button><\/form>/);
      return f ? { methode: f[1], ziel: f[2], v: f[3], e: f[4], knopf: f[5] } : null;
    };
    const ja = await formular('/konto/bestaetigen', { v: v.vorgang, t, antwort: 'ja' });
    const kf = knopfFormular(ja.html);
    const e = kf ? kf.e : '';
    geheim.push(e);
    const kopfText = [...ja.kopf.entries()].map(([k, w]) => `${k}: ${w}`).join('\n');
    check('Z2 3 (OE6): Ja → 200 mit B26 und einem POST-Formular an genau http://127.0.0.1:<rueckPort>/anmeldung/zurueck; v und e (43 Zeichen b64url) nur als versteckte Felder, Knopf B29; e in keinem Kopf, kein Location',
      ja.status === 200 && !!kf && kf.methode === 'post' && kf.ziel === 'http://127.0.0.1:61001/anmeldung/zurueck' && kf.v === v.vorgang
        && /^[A-Za-z0-9_-]{43}$/.test(e) && kf.knopf === esc(B.B29) && ja.html.includes(`<p>${esc(B.B26)}</p>`)
        && ja.kopf.get('location') === null && !kopfText.includes(e) && (ja.html.match(new RegExp(e, 'g')) || []).length === 1);
    check('Z2 3 (OE6): die Seite nach Ja trägt die Kopfzeilen der Seiten (CSP mit form-action http://127.0.0.1:*, no-store, no-referrer, nosniff, kein Cookie), kein Skript, kein meta refresh',
      ja.kopf.get('content-type') === 'text/html; charset=utf-8' && ja.kopf.get('cache-control') === 'no-store' && ja.kopf.get('referrer-policy') === 'no-referrer'
        && ja.kopf.get('x-content-type-options') === 'nosniff'
        && ja.kopf.get('content-security-policy') === "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' http://127.0.0.1:*; base-uri 'none'; frame-ancestors 'none'"
        && ja.kopf.get('set-cookie') === null && !/<script/i.test(ja.html) && !/http-equiv/i.test(ja.html) && !/<a /i.test(ja.html));
    // B28 (Fixrunde 1): die Anmeldeseite bei bestätigt, aber noch nicht abgeholt: B28 ohne Knopf und ohne e, kein B8.
    const zwischendurch = await worker.fetch(new Request(`https://proxy.test/konto/anmelden?v=${encodeURIComponent(v.vorgang)}`, { headers: { 'CF-Connecting-IP': '10.9.2.1' } }), env, makeWaitCtx());
    const zwischenHtml = await zwischendurch.text();
    check('Z2 B28: GET /konto/anmelden bei bestätigt, aber noch nicht abgeholt → B28, kein Knopf, kein e, nicht B8',
      zwischendurch.status === 200 && zwischenHtml.includes(esc(B.B28)) && !zwischenHtml.includes('<form') && !zwischenHtml.includes(e) && !zwischenHtml.includes(esc(B.B8)));
    // Liefert der DO einen unbrauchbaren Port oder kein gültiges e, springt die Seite nirgendwohin (502 „interner Fehler“, kein Location).
    const sprungMit = async (antwortDo) => {
      const e2 = umgebung();
      const jur = e2.KONTO.jurisdiction;
      e2.KONTO.jurisdiction = (x) => {
        const n = jur(x);
        const get = n.get;
        n.get = (id) => {
          const s = get(id);
          return { fetch: (rq) => (rq.url.endsWith('/vorgang-bestaetigen') ? Response.json(antwortDo) : s.fetch(rq)) };
        };
        return n;
      };
      const res = await worker.fetch(new Request('https://proxy.test/konto/bestaetigen', {
        method: 'POST',
        headers: { 'CF-Connecting-IP': '10.9.1.1', 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ v: 'v'.repeat(24), t: 'test-seitentoken', antwort: 'ja' }).toString(),
      }), e2, makeWaitCtx());
      return { status: res.status, ort: res.headers.get('location'), html: await res.text() };
    };
    const eGut = 'Ab1_-'.repeat(8) + 'Ab1';
    const schlecht = [];
    for (const a of [{ rueckPort: 80, e: eGut }, { rueckPort: 70000, e: eGut }, { rueckPort: '61001', e: eGut }, { rueckPort: 61001.5, e: eGut }, { rueckPort: 61001, e: 'kurz' }, { rueckPort: 61001 }, { e: eGut }]) {
      schlecht.push(await sprungMit({ ok: true, zustand: 'bestaetigt', ...a }));
    }
    check('Z2 3: liefert der DO einen unbrauchbaren Port (80, 70000, Text, 61001.5, fehlt) oder kein gültiges e, gibt es kein Formular an 127.0.0.1 (502 interner Fehler, kein Location)',
      schlecht.every((a) => a.status === 502 && a.ort === null && a.html.includes('role="alert">interner Fehler</p>') && !a.html.includes('127.0.0.1')));

    // Nr. 2: abholen ohne e → wartet; falsches e (richtige Form) → wartet; falsche Form → 400 vor dem DO; mit e → Sitzung.
    const ohneE = await abholen(v, geraet);
    const falschesE = await abholen(v, geraet, 'Zz9_-'.repeat(8) + 'Zz9');
    const davor = env.KONTO.anfragen.length;
    const formFalsch = [];
    for (const x of [e.slice(1), e + 'A', e.slice(1) + '+', e.slice(1) + '=', 42, null, '']) formFalsch.push(await abholen(v, geraet, x));
    const danach = env.KONTO.anfragen.length;
    check('Z2 2: vor dem Ja wartet; nach dem Ja ohne e oder mit falschem e der richtigen Form → wartet (nur { zustand: wartet })',
      JSON.stringify(vorJa.daten) === '{"zustand":"wartet"}' && JSON.stringify(ohneE.daten) === '{"zustand":"wartet"}' && JSON.stringify(falschesE.daten) === '{"zustand":"wartet"}');
    check('Z2 2: Vorfilter wie in Z1: e nicht genau 43 Zeichen b64url (42, 44, mit +, mit =, Zahl, null, leer) → 400 S11 vor dem DO',
      formFalsch.every((a) => soll(a, 400, 'ungueltig')) && danach === davor);
    uhr.vor(2000);
    const mitE = await abholen(v, geraet, e);
    geheim.push(mitE.daten && mitE.daten.sitzung);
    const c1 = mitE.daten && mitE.daten.sitzung ? await pruefeToken(SCHLUESSEL, mitE.daten.sitzung, 'sitzung', uhr()) : null;
    check('Z2 2: mit e → bestaetigt mit der Sitzung des Externen an genau diesem Gerät',
      mitE.status === 200 && mitE.daten.zustand === 'bestaetigt' && !!c1 && c1.gid === geraet.gid && c1.email === 'erika@extern.test');
    const seiteNachAbholen = await worker.fetch(new Request(`https://proxy.test/konto/anmelden?v=${encodeURIComponent(v.vorgang)}`, { headers: { 'CF-Connecting-IP': '10.9.2.2' } }), env, makeWaitCtx());
    const nachAbholenHtml = await seiteNachAbholen.text();

    // Nr. 6: die Antwort geht unterwegs verloren; dieselbe Anfrage innerhalb von 60 s → dieselbe Anmeldung, danach nicht mehr.
    uhr.vor(59_999);
    const wieder = await abholen(v, geraet, e);
    geheim.push(wieder.daten && wieder.daten.sitzung);
    const c2 = wieder.daten && wieder.daten.sitzung ? await pruefeToken(SCHLUESSEL, wieder.daten.sitzung, 'sitzung', uhr()) : null;
    uhr.vor(1);
    const zuSpaet = await abholen(v, geraet, e);
    check('Z2 6: Antwort verloren: Wiederholung nach 59,999 s mit demselben Abholgeheimnis und e → bestaetigt, neue Sitzung desselben Geräts (gleiche kid, gid, angemeldetSeit); nach 60 s → 404 S10',
      wieder.status === 200 && wieder.daten.zustand === 'bestaetigt' && !!c2 && !!c1 && c2.kid === c1.kid && c2.gid === c1.gid && c2.angemeldetSeit === c1.angemeldetSeit
        && soll(zuSpaet, 404, 'vorgang-unbekannt'));
    const seiteSpaet = await worker.fetch(new Request(`https://proxy.test/konto/anmelden?v=${encodeURIComponent(v.vorgang)}`, { headers: { 'CF-Connecting-IP': '10.9.2.3' } }), env, makeWaitCtx());
    const spaetHtml = await seiteSpaet.text();
    check('Z2 B8 (Fixrunde 1): erst nach dem Abholen zeigt die Anmeldeseite B8 (60 s lang), danach 404 B10',
      seiteNachAbholen.status === 200 && nachAbholenHtml.includes(esc(B.B8)) && !nachAbholenHtml.includes(esc(B.B28)) && seiteSpaet.status === 404 && spaetHtml.includes(esc(B.B10)));

    // I1 (Fixrunde 1): Doppelklick auf „Ja“ — jedes weitere Ja mit demselben Seitentoken zeigt die Seite mit einem neuen e (höchstens
    // drei), das vierte die Antwort von vorher (403 B10). Der Browser zeigt die letzte Seite; mit deren e holt der Launcher ab.
    const gd = await testGeraet({ name: 'Regie-PC 8' });
    const vd = (await api(env, 'POST', '/konto/vorgang', { body: { geraet: gd.angaben, rueckPort: 61002 } })).daten;
    geheim.push(vd.abholGeheimnis, vd.code);
    const bd = await formular('/konto/passwort', { v: vd.vorgang, email: 'erika@extern.test', passwort: 'test-passwort-erika-z2' });
    const td = seitenToken(bd.html);
    geheim.push(td);
    const doppelt = [];
    for (let i = 0; i < 4; i++) doppelt.push(await formular('/konto/bestaetigen', { v: vd.vorgang, t: td, antwort: 'ja' }));
    const eListe = doppelt.slice(0, 3).map((a) => (knopfFormular(a.html) || {}).e);
    geheim.push(...eListe);
    const mitLetztem = await abholen(vd, gd, eListe[2]);
    geheim.push(mitLetztem.daten && mitLetztem.daten.sitzung);
    check('Z2 I1: Doppelklick auf Ja: das 2. und 3. Ja zeigen die Seite mit je neuem e (Formular an denselben Port), das 4. → 403 B10; mit dem e der zuletzt gezeigten Seite holt der Launcher ab',
      doppelt.slice(0, 3).every((a) => a.status === 200 && (knopfFormular(a.html) || {}).ziel === 'http://127.0.0.1:61002/anmeldung/zurueck')
        && eListe.every((x) => /^[A-Za-z0-9_-]{43}$/.test(x ?? '')) && new Set(eListe).size === 3
        && doppelt[3].status === 403 && doppelt[3].html.includes(esc(B.B10)) && !doppelt[3].html.includes('<form method="post" action="http://127.0.0.1')
        && mitLetztem.status === 200 && mitLetztem.daten.zustand === 'bestaetigt');

    // B27 (Fixrunde 1): ein Name, der nach der Erlaubnisliste leer ist, weist nicht ab; die Seite sagt „Rechner: (kein Name gemeldet)“.
    const gn = await testGeraet({ name: '\u{2605}\u{2605} !' });
    const vn = await api(env, 'POST', '/konto/vorgang', { body: { geraet: gn.angaben, rueckPort: 61003 } });
    geheim.push(vn.daten && vn.daten.abholGeheimnis, vn.daten && vn.daten.code);
    const bn = vn.daten ? await formular('/konto/passwort', { v: vn.daten.vorgang, email: 'erika@extern.test', passwort: 'test-passwort-erika-z2' }) : { html: '' };
    geheim.push(seitenToken(bn.html));
    check('Z2 B27: Rechnername nur aus Zeichen außerhalb der Erlaubnisliste → Vorgang entsteht (200), die Seite zeigt B27 statt B25',
      vn.status === 200 && bn.html.includes(`<p>${esc(B.B27)}</p>`) && !bn.html.includes('(vom Rechner gemeldet)'));

    // Phishing: der Angreifer legt den Vorgang auf seinem Rechner an (eigener Port) und schickt dem Opfer den Link; das Opfer meldet
    // sich an und klickt Ja. Der Knopf im Browser des Opfers schickt e an 127.0.0.1:62002 auf dem Rechner des Opfers: e erreicht den
    // Angreifer nie.
    const angreifer = await testGeraet({ name: 'Regie-PC 1' });
    const zweiter = await testGeraet({ name: 'Anderer PC' });
    const va = (await api(env, 'POST', '/konto/vorgang', { body: { geraet: angreifer.angaben, rueckPort: 62002 } })).daten;
    geheim.push(va.abholGeheimnis, va.code);
    const pb = await formular('/konto/passwort', { v: va.vorgang, email: 'erika@extern.test', passwort: 'test-passwort-erika-z2' });
    const ta = seitenToken(pb.html);
    geheim.push(ta);
    const jaOpfer = await formular('/konto/bestaetigen', { v: va.vorgang, t: ta, antwort: 'ja' });
    const kfOpfer = knopfFormular(jaOpfer.html) || {};
    geheim.push(kfOpfer.e);
    const fremdGeheimnis = 'Cd2_-'.repeat(8) + 'Cd2';
    const zweiterOhne = await abholen(va, zweiter, undefined, fremdGeheimnis);
    const zweiterMitE = await abholen(va, zweiter, kfOpfer.e, fremdGeheimnis);
    const antworten = [];
    let sitzung = false;
    for (let i = 0; i < 150; i++) {
      uhr.vor(2000);
      const r = await abholen(va, angreifer);
      antworten.push(r.daten ? r.daten.zustand ?? r.daten.code : r.status);
      if (r.daten && r.daten.sitzung) sitzung = true;
    }
    check('Z2 Phishing: der Rechner des Angreifers (eigener Vorgang, das Opfer bestätigt, Knopf an 127.0.0.1:62002 beim Opfer) bekommt nie eine Sitzung: 149 × wartet, nach 5 min abgelaufen; ein zweiter Launcher (anderes Abholgeheimnis, auch mit dem richtigen e) → 404 S10',
      jaOpfer.status === 200 && kfOpfer.ziel === 'http://127.0.0.1:62002/anmeldung/zurueck' && /^[A-Za-z0-9_-]{43}$/.test(kfOpfer.e ?? '')
        && !sitzung && antworten.slice(0, 149).every((z) => z === 'wartet') && antworten[149] === 'abgelaufen'
        && soll(zweiterOhne, 404, 'vorgang-unbekannt') && soll(zweiterMitE, 404, 'vorgang-unbekannt'));
  }

  // ── Ende der Fälle ──

  // P16 10.1: Fehlerform und Cache-Kopf aller Antworten dieses Laufs.
  {
    const texte = new Set([...Object.values(FEHLER_TEXT), ...Object.values(KONFLIKT_TEXT), 'zu viele Anfragen']);
    const falsch = fehlerAntworten.filter((a) => (a.kopf.get('content-type') || '').startsWith('application/json') && !(a.daten && texte.has(a.daten.error) && typeof a.daten.code === 'string'));
    check(`P16 10.1: jede JSON-Fehlerantwort unter /konto/ hat { error: Text S…, code } (${fehlerAntworten.length} Antworten)`, fehlerAntworten.length > 20 && falsch.length === 0);
    for (const a of falsch.slice(0, 3)) realLog(`     ${a.pfad}: ${a.text.slice(0, 120)}`);
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
  // Z1-W2 [T] G4: das Protokoll oben schneidet nur warn und error mit (der Harness druckt selbst über console.log). Darum zusätzlich
  // ein Quelltext-Wächter: keine Datei der Anmeldung im Worker ruft console.log, console.info oder console.debug.
  {
    const dateien = ['konto-relay.js', 'konto-zugang.js', 'konto-do.js', 'konto-google.js', 'konto-krypto.js', 'konto-kern.js', 'konto-seiten.js', 'konto-altkey.js'];
    const treffer = dateien.filter((d) => /\bconsole\s*\.\s*(log|info|debug|trace|dir)\b/.test(readFileSync(new URL('../' + d, import.meta.url), 'utf8')));
    check(`Z1-W2 [T] G4: ${dateien.length} Quelltexte der Anmeldung ohne console.log, info, debug, trace oder dir${treffer.length ? ` — in ${treffer.join(', ')}` : ''}`, treffer.length === 0);
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
