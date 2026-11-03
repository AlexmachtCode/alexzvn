// P3–P6 · Durable Object `KontoSpeicher` (Spec 4, 4.1, 6.1, 6.3, 6.4, 7, 8, 9, 11; Plan 10.4, EP1–EP5, EP19–EP21, OF2, OF3).
//   node --experimental-strip-types services/release-proxy/test/konto-do.test.mjs
// Form „check“ über die Zählung aus konto-attrappen.mjs. Der DO läuft als einfache Klasse auf der Map-Attrappe von
// ctx.storage; Aktionen gehen wie vom Worker als POST an https://konto.intern/<aktion> (rufeDo). P4–P6 fügen ihre Fälle
// direkt vor der Marke „Ende der Fälle“ ein und ihre Hilfsfunktionen direkt vor `async function run() {`.
import { readFileSync } from 'node:fs';
import { PROTOKOLL_MS } from '../konto-kern.js';
import { hashePasswort, neuerBestaetigungsCode, sha256B64url, zufall } from '../konto-krypto.js';
import { abschluss, check, gleich, makeCtx, makeUhr, neuerSpeicher, pruefeFaelle, rufeDo, testGeraet } from './konto-attrappen.mjs';

const T0 = Date.UTC(2026, 9, 21, 8, 0, 0);
const MIN = 60_000;
const TAG = 24 * 3600_000;
const ERSTE = 'chefin@jakobsmedien.com';

/** Externes Konto mit Passwort und/oder Einladung direkt in den Speicher (Einladen über die Admin-Maske kommt erst in P6). */
async function legeExternenAn(speicher, o = {}) {
  const konto = {
    kid: o.kid ?? 'k-ext',
    email: o.email ?? 'technik@firma.example',
    name: o.name ?? 'Tom Technik',
    art: 'passwort',
    stufe: o.stufe ?? 'externer',
    zustand: o.zustand ?? 'aktiv',
    tools: o.tools ?? ['qa'],
    events: o.events ?? [],
    bis: o.bis === undefined ? T0 + 30 * TAG : o.bis,
    zoomBis: o.zoomBis ?? null,
    erstellt: T0 - TAG,
    geaendert: T0 - TAG,
    letzteAnmeldung: null,
  };
  if (o.passwort) konto.passwort = await hashePasswort(o.passwort);
  if (o.einladungscode) konto.einladung = { hash: await sha256B64url(o.einladungscode.replace(/-/g, '')), bis: o.einladungBis ?? T0 + 3 * TAG };
  await speicher.speichereKonto(konto);
  return konto;
}

/** Alle Protokolleinträge in Speicher-Reihenfolge (nach Zeit). */
async function protokoll(ctx) {
  return [...(await ctx.storage.list({ prefix: 'log:' })).values()];
}

/** Anmeldevorgang wie vom Worker (P16): Code und Abholgeheimnis entstehen dort, der DO bekommt nur den Hash (P4). */
async function neuerVorgang(speicher, geraet, jetzt = T0) {
  const abholGeheimnis = zufall(32);
  const code = neuerBestaetigungsCode();
  const abholHash = await sha256B64url(abholGeheimnis);
  const r = await rufeDo(speicher, 'vorgang-anlegen', { jetzt, geraet: geraet.angaben, abholHash, code });
  return { ...r, abholGeheimnis, abholHash, code };
}

/** Abholen mit frischem Gerätebeweis (Zweck `abholen`, Bezug Vorgang). */
async function abholen(speicher, v, geraet, jetzt = T0) {
  return rufeDo(speicher, 'vorgang-abholen', { jetzt, vorgang: v.vorgang, abholHash: v.abholHash, beweis: await geraet.beweis('abholen', v.vorgang, jetzt) });
}

/** Ganze Google-Anmeldung bis zum Abholen (Spec 4.1): Konto finden oder anlegen, binden, mit Ja bestätigen, abholen. */
async function googleAnmelden(speicher, geraet, email, name, jetzt = T0) {
  const v = await neuerVorgang(speicher, geraet, jetzt);
  const k = await rufeDo(speicher, 'konto-aus-google', { jetzt, email, name });
  const b = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt, vorgang: v.vorgang, kid: k.kid });
  await rufeDo(speicher, 'vorgang-bestaetigen', { jetzt, vorgang: v.vorgang, seitenToken: b.seitenToken, antwort: 'ja' });
  return { v, kid: k.kid, abgeholt: await abholen(speicher, v, geraet, jetzt) };
}

/** Ganze Passwort-Anmeldung bis zum Abholen; `angaben` ist `{ email, passwort }` oder `{ email, einladungscode, neu }`. */
async function passwortAnmelden(speicher, geraet, angaben, jetzt = T0) {
  const v = await neuerVorgang(speicher, geraet, jetzt);
  const p = await rufeDo(speicher, 'vorgang-passwort', { jetzt, vorgang: v.vorgang, ...angaben });
  if (!p.ok) return { v, passwort: p, abgeholt: null };
  await rufeDo(speicher, 'vorgang-bestaetigen', { jetzt, vorgang: v.vorgang, seitenToken: p.seitenToken, antwort: 'ja' });
  return { v, passwort: p, abgeholt: await abholen(speicher, v, geraet, jetzt) };
}

async function run() {
  // ── P3: Attrappe (Grundlage aller Fälle) ──
  {
    const ctx = makeCtx();
    const wert = { a: [1] };
    await ctx.storage.put('x:2', wert);
    await ctx.storage.put('x:1', 1);
    await ctx.storage.put('y:1', 1);
    wert.a.push(2);
    const gelesen = await ctx.storage.get('x:2');
    gelesen.a.push(3);
    const liste = await ctx.storage.list({ prefix: 'x:' });
    await ctx.storage.setAlarm(T0);
    check(
      'P3 EP21: Attrappe legt Kopien ab, list sortiert nach Präfix, delete meldet true, Alarm lesbar',
      JSON.stringify((await ctx.storage.get('x:2')).a) === '[1]' && JSON.stringify([...liste.keys()]) === '["x:1","x:2"]' &&
        (await ctx.storage.getAlarm()) === T0 && (await ctx.storage.delete('y:1')) === true && (await ctx.storage.get('y:1')) === undefined,
    );
  }

  // ── P3: Konten aus Google (Spec 4, 9) ──
  {
    const { speicher, ctx } = neuerSpeicher({ ERSTER_ADMIN: ERSTE });
    const a = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'Maria.Schmidt@JakobsMedien.com', name: 'Maria Schmidt' });
    const b = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0 + MIN, email: 'maria.schmidt@jakobsmedien.com', name: 'Maria Schmidt' });
    const konto = await speicher.ladeKonto(a.kid);
    check(
      'P3 4: erste Google-Anmeldung legt Kollegen an (E-Mail-Index klein, Groß/Klein egal), zweite findet dasselbe Konto',
      a.http === 200 && a.ok === true && typeof a.kid === 'string' && a.kid.length === 16 && b.kid === a.kid &&
        konto.email === 'maria.schmidt@jakobsmedien.com' && konto.stufe === 'kollege' && konto.art === 'google' && konto.zustand === 'aktiv' &&
        ctx.daten.get('email:maria.schmidt@jakobsmedien.com') === a.kid && [...ctx.daten.keys()].filter((k) => k.startsWith('konto:')).length === 1,
    );
    const c = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: ' Chefin@JakobsMedien.com', name: 'Clara Chefin' });
    const log = await protokoll(ctx);
    check(
      'P3 9: ERSTER_ADMIN wird Admin; je neu angelegtem Konto ein Protokolleintrag von system',
      (await speicher.ladeKonto(c.kid)).stufe === 'admin' && log.length === 2 &&
        log.every((e) => e.wer === 'system' && e.was === 'konto-angelegt') && log.map((e) => e.wen).sort().join(',') === `${ERSTE},maria.schmidt@jakobsmedien.com`,
    );
    const fremd = [];
    for (const email of ['maria@x.jakobsmedien.com', 'maria@gmail.com', 'jakobsmedien.com@evil.de', '']) {
      const r = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email, name: 'X' });
      fremd.push(`${r.http}:${r.code}`);
    }
    check('P3 4: nur Konten von jakobsmedien.com (Subdomain, fremde Domain, verdreht, leer → 400 domain)', fremd.every((x) => x === '400:domain'));
  }

  // ── P3: Löschen, Sperren, Entsperren (Spec 4) ──
  {
    const { speicher } = neuerSpeicher({ ERSTER_ADMIN: ERSTE });
    await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: ERSTE, name: 'Clara Chefin' }); // der erste Admin bleibt
    const a = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'jonas@jakobsmedien.com', name: 'Jonas Weber' });
    const k = await speicher.ladeKonto(a.kid);
    k.stufe = 'admin';
    await speicher.speichereKonto(k);
    const loeschen = await speicher.zugangLoeschen(a.kid, ERSTE, T0 + MIN);
    const danach = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0 + 2 * MIN, email: 'jonas@jakobsmedien.com', name: 'Jonas Weber' });
    const gesperrt = await speicher.ladeKonto(a.kid);
    const auf = await speicher.entsperren(a.kid, ERSTE, T0 + 3 * MIN);
    const wieder = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0 + 4 * MIN, email: 'jonas@jakobsmedien.com', name: 'Jonas Weber' });
    check(
      'P3 4: Löschen sperrt ein Google-Konto dauerhaft; nächste Anmeldung → gesperrt; Entsperren → aktiv mit alter Stufe',
      loeschen.ok === true && gesperrt?.zustand === 'gesperrt' && danach.http === 403 && danach.code === 'gesperrt' &&
        auf.ok === true && wieder.ok === true && wieder.kid === a.kid && (await speicher.ladeKonto(a.kid))?.stufe === 'admin',
    );
  }
  {
    const { speicher, ctx } = neuerSpeicher({ ERSTER_ADMIN: ERSTE });
    const ext = await legeExternenAn(speicher, { passwort: 'geheim-und-lang-1', einladungscode: 'ABCD-EFGH-JKLM' });
    await ctx.storage.put('anfrage:a1', { id: 'a1', kid: ext.kid, zustand: 'offen' });
    await ctx.storage.put('anfrage:a2', { id: 'a2', kid: 'k-anders', zustand: 'offen' });
    await ctx.storage.put('geraet:g1', { gid: 'g1', letztesKonto: ext.kid, angemeldetSeit: T0 });
    await ctx.storage.put('geraet:g2', { gid: 'g2', letztesKonto: 'k-anders', angemeldetSeit: T0 });
    await ctx.storage.put(`fehl:${ext.kid}`, { anzahl: 2, bisMs: null });
    const r = await speicher.zugangLoeschen(ext.kid, ERSTE, T0 + MIN);
    const g1 = ctx.daten.get('geraet:g1');
    check(
      'P3 4: Löschen eines Externen entfernt Konto, E-Mail-Index, Einladung, Anfragen und Bremse; sein Gerät verliert letztesKonto',
      r.ok === true && !ctx.daten.has(`konto:${ext.kid}`) && !ctx.daten.has(`email:${ext.email}`) && !ctx.daten.has('anfrage:a1') &&
        ctx.daten.has('anfrage:a2') && !ctx.daten.has(`fehl:${ext.kid}`) && g1.letztesKonto === null && g1.angemeldetSeit === null &&
        ctx.daten.get('geraet:g2').letztesKonto === 'k-anders' && (await speicher.kontoPerEmail(ext.email)) === null,
    );
    const unbekannt = await speicher.zugangLoeschen('k-gibts-nicht', ERSTE, T0);
    const unbekanntAuf = await speicher.entsperren('k-gibts-nicht', ERSTE, T0);
    check('P3 4: unbekannte Kennung → 404 vorgang-unbekannt (Löschen, Entsperren)', unbekannt.code === 'vorgang-unbekannt' && unbekannt.status === 404 && unbekanntAuf.code === 'vorgang-unbekannt');
  }

  // ── P3: immer mindestens ein Admin, erster Admin unveränderbar (Spec 9, EP20) ──
  {
    const ohne = neuerSpeicher({});
    const a = await rufeDo(ohne.speicher, 'konto-aus-google', { jetzt: T0, email: 'anna@jakobsmedien.com', name: 'Anna A' });
    const b = await rufeDo(ohne.speicher, 'konto-aus-google', { jetzt: T0, email: 'ben@jakobsmedien.com', name: 'Ben B' });
    for (const kid of [a.kid, b.kid]) {
      const k = await ohne.speicher.ladeKonto(kid);
      k.stufe = 'admin';
      await ohne.speicher.speichereKonto(k);
    }
    const erstes = await ohne.speicher.zugangLoeschen(a.kid, 'ben@jakobsmedien.com', T0 + MIN);
    const letztes = await ohne.speicher.zugangLoeschen(b.kid, 'ben@jakobsmedien.com', T0 + 2 * MIN);
    const mit = neuerSpeicher({ ERSTER_ADMIN: ERSTE });
    const c = await rufeDo(mit.speicher, 'konto-aus-google', { jetzt: T0, email: ERSTE, name: 'Clara Chefin' });
    const erster = await mit.speicher.zugangLoeschen(c.kid, ERSTE, T0 + MIN);
    check(
      'P3 9: immer mindestens ein Admin (ohne ERSTER_ADMIN: letzter aktiver Admin → 409 konflikt); erster Admin → 403 erster-admin',
      erstes.ok === true && letztes.ok === false && letztes.code === 'konflikt' && letztes.status === 409 &&
        (await ohne.speicher.ladeKonto(b.kid)).zustand === 'aktiv' && (await ohne.speicher.adminZahl(T0 + 3 * MIN)) === 1 &&
        erster.code === 'erster-admin' && erster.status === 403 && (await mit.speicher.ladeKonto(c.kid)).zustand === 'aktiv',
    );
  }
  {
    // EP20 (robust:6, sicherheit:9): ein ERSTER_ADMIN ohne Konto im DO (Tippfehler, Adresse außerhalb der Domain, nie angemeldet)
    // schützt nicht; dann gilt die Zählregel. Ein E-Mail-Zugang mit der Adresse aus ERSTER_ADMIN ist nie der erste Admin.
    const faelle = [
      { name: 'Tippfehler in der Domain', erster: 'chef@jakobsmedien.con' },
      { name: 'Tippfehler vor dem @', erster: 'chfe@jakobsmedien.com' },
      { name: 'externe Adresse', erster: 'chef@firma.example' },
    ];
    await pruefeFaelle('P3 9, EP20: ERSTER_ADMIN ohne Konto im DO schützt den letzten aktiven Admin nicht (409 konflikt)', faelle, async (f) => {
      const { speicher } = neuerSpeicher({ ERSTER_ADMIN: f.erster });
      const a = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'anna@jakobsmedien.com', name: 'Anna A' });
      await speicher.speichereKonto({ ...(await speicher.ladeKonto(a.kid)), stufe: 'admin' });
      const r = await speicher.zugangLoeschen(a.kid, 'anna@jakobsmedien.com', T0 + MIN);
      return gleich([r.ok, r.code ?? null, (await speicher.ladeKonto(a.kid)).zustand], [false, 'konflikt', 'aktiv']);
    });
    const { speicher } = neuerSpeicher({ ERSTER_ADMIN: 'chef@firma.example' });
    const ext = await legeExternenAn(speicher, { kid: 'k-chef', email: 'chef@firma.example', passwort: 'geheim-und-lang-3' });
    const r = await speicher.zugangLoeschen(ext.kid, 'admin@jakobsmedien.com', T0);
    check(
      'P3 EP20: ein E-Mail-Zugang mit der Adresse aus ERSTER_ADMIN ist nie der erste Admin (Stufe bleibt, löschbar)',
      speicher.istErster(ext) === false && speicher.stufeVon(ext) === 'externer' && r.ok === true && (await speicher.ladeKonto('k-chef')) === null,
    );
  }

  // ── P3: Protokoll (OF3, EP19) ──
  {
    const uhr = makeUhr(T0);
    const { speicher, ctx } = neuerSpeicher({ ERSTER_ADMIN: ERSTE, KONTO_UHR: uhr });
    const ext = await legeExternenAn(speicher, { passwort: 'geheim-und-lang-2', einladungscode: 'WXYZ-2345-6789' });
    const g = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'maria@jakobsmedien.com', name: 'Maria Schmidt' });
    await speicher.zugangLoeschen(ext.kid, ERSTE, T0 + MIN);
    await speicher.zugangLoeschen(g.kid, ERSTE, T0 + 2 * MIN);
    await speicher.entsperren(g.kid, ERSTE, T0 + 3 * MIN);
    const log = await protokoll(ctx);
    const roh = JSON.stringify(log);
    check(
      'P3 OF3: Protokoll ohne Passwort-Daten (kein Hash, kein Passwort, keine Einladung), auch für den gelöschten Externen',
      log.length === 4 && log.some((e) => e.was === 'zugang-geloescht' && e.wen === ext.email && e.wer === ERSTE) &&
        !roh.includes('pbkdf2') && !roh.includes('geheim-und-lang-2') && !roh.includes('einladung') && !roh.includes('WXYZ') &&
        log.every((e) => Object.keys(e).join(',') === 'am,wer,was,wen,details'),
    );
    uhr.stelle(T0 + PROTOKOLL_MS - 1);
    await speicher.alarm();
    const nochDa = (await protokoll(ctx)).map((e) => e.was).join(',');
    uhr.stelle(T0 + 2 * MIN + PROTOKOLL_MS);
    await speicher.alarm();
    const rest = (await protokoll(ctx)).map((e) => e.was).join(',');
    check(
      'P3 OF3: Protokoll bleibt 12 Monate, danach räumt der Alarm es ab (Eintrag für Eintrag)',
      nochDa === 'konto-angelegt,zugang-geloescht,zugang-gesperrt,zugang-entsperrt' && rest === 'zugang-entsperrt',
    );
  }

  // ── P3: Alarm (Spec 4.1, 4, 8, 11) ──
  {
    const uhr = makeUhr(T0);
    const { speicher, ctx } = neuerSpeicher({ KONTO_UHR: uhr });
    await ctx.storage.put('vorgang:alt', { vorgang: 'alt', bis: T0, google: { state: 's-alt' } });
    await ctx.storage.put('state:s-alt', 'alt');
    await ctx.storage.put('vorgang:neu', { vorgang: 'neu', bis: T0 + 1, google: { state: 's-neu' } });
    await ctx.storage.put('state:s-neu', 'neu');
    await ctx.storage.put('state:s-waise', 'gibts-nicht');
    await legeExternenAn(speicher, { kid: 'k-1', email: 'a@firma.example', einladungscode: 'AAAA-BBBB-CCCC', einladungBis: T0 });
    await legeExternenAn(speicher, { kid: 'k-2', email: 'b@firma.example', einladungscode: 'DDDD-EEEE-FFFF', einladungBis: T0 + 1 });
    await ctx.storage.put('altkey:2026-07-01:katalog:win-x64', { tag: '2026-07-01', zuletzt: T0 - 90 * TAG });
    await ctx.storage.put('altkey:2026-07-30:katalog:win-x64', { tag: '2026-07-30', zuletzt: T0 - 90 * TAG + 1 });
    await ctx.storage.put('anfrage:alt', { id: 'alt', kid: 'k-1', zustand: 'abgelehnt', bis: T0 - 90 * TAG });
    await ctx.storage.put('anfrage:jung', { id: 'jung', kid: 'k-1', zustand: 'freigegeben', bis: T0 - 90 * TAG + 1 });
    await ctx.storage.put('anfrage:offen', { id: 'offen', kid: 'k-2', zustand: 'offen', bis: T0 - 365 * TAG });
    await ctx.storage.put('geraet:g-alt', { gid: 'g-alt', name: 'Alt-PC', letzterKontakt: T0 - 365 * TAG, letztesKonto: 'k-1' });
    await ctx.storage.put('geraet:g-jung', { gid: 'g-jung', name: 'Neu-PC', letzterKontakt: T0 - 365 * TAG + 1, letztesKonto: null });
    await ctx.storage.put('fehl-email:alt', { anzahl: 2, bisMs: null, am: T0 - 30 * TAG });
    await ctx.storage.put('fehl-email:jung', { anzahl: 2, bisMs: null, am: T0 - 30 * TAG + 1 });
    await speicher.alarm();
    check(
      'P3 Alarm räumt abgelaufene Vorgänge samt state, verwaiste state, abgelaufene Einladungen, Alt-Key-Zeilen und entschiedene Anfragen nach 90 Tagen, Geräte nach 12 Monaten ohne Kontakt und Zähler unbekannter E-Mails nach 30 Tagen ab; stellt sich für morgen',
      !ctx.daten.has('vorgang:alt') && !ctx.daten.has('state:s-alt') && ctx.daten.has('vorgang:neu') && ctx.daten.has('state:s-neu') &&
        !ctx.daten.has('state:s-waise') && !('einladung' in ctx.daten.get('konto:k-1')) && 'einladung' in ctx.daten.get('konto:k-2') &&
        !ctx.daten.has('altkey:2026-07-01:katalog:win-x64') && ctx.daten.has('altkey:2026-07-30:katalog:win-x64') &&
        !ctx.daten.has('anfrage:alt') && ctx.daten.has('anfrage:jung') && ctx.daten.has('anfrage:offen') &&
        !ctx.daten.has('geraet:g-alt') && ctx.daten.has('geraet:g-jung') && !ctx.daten.has('fehl-email:alt') && ctx.daten.has('fehl-email:jung') &&
        ctx.alarmZeit === T0 + TAG,
    );
    const frisch = neuerSpeicher({});
    await rufeDo(frisch.speicher, 'konto-aus-google', { jetzt: T0, email: 'a@jakobsmedien.com', name: 'A' });
    const ersterAlarm = frisch.ctx.alarmZeit;
    await rufeDo(frisch.speicher, 'konto-aus-google', { jetzt: T0 + 5 * MIN, email: 'a@jakobsmedien.com', name: 'A' });
    check('P3 EP1: die erste Aktion stellt den Alarm auf morgen, weitere verschieben ihn nicht', ersterAlarm === T0 + TAG && frisch.ctx.alarmZeit === T0 + TAG);
  }

  // ── P3: nur POST https://konto.intern/<aktion> (Lehre B1, Plan 10.4) ──
  {
    const uhr = makeUhr(T0 + 7 * MIN);
    const { speicher } = neuerSpeicher({ KONTO_UHR: uhr });
    const body = JSON.stringify({ jetzt: T0, email: 'a@jakobsmedien.com', name: 'A' });
    const faelle = [
      { name: 'POST konto.intern (richtig)', url: 'https://konto.intern/konto-aus-google', method: 'POST', body, soll: 200 },
      { name: 'GET', url: 'https://konto.intern/konto-aus-google', method: 'GET', soll: 404 },
      { name: 'PUT', url: 'https://konto.intern/konto-aus-google', method: 'PUT', body, soll: 404 },
      { name: 'fremder Host', url: 'https://jm-suite-proxy.example/konto-aus-google', method: 'POST', body, soll: 404 },
      { name: 'http statt https', url: 'http://konto.intern/konto-aus-google', method: 'POST', body, soll: 404 },
      { name: 'unbekannte Aktion', url: 'https://konto.intern/alles-loeschen', method: 'POST', body, soll: 404 },
      { name: 'Methode statt Aktion', url: 'https://konto.intern/zugangLoeschen', method: 'POST', body, soll: 404 },
      { name: 'constructor', url: 'https://konto.intern/constructor', method: 'POST', body, soll: 404 },
      { name: 'toString', url: 'https://konto.intern/toString', method: 'POST', body, soll: 404 },
      { name: 'Unterpfad', url: 'https://konto.intern/konto-aus-google/x', method: 'POST', body, soll: 404 },
      { name: 'kaputtes JSON', url: 'https://konto.intern/konto-aus-google', method: 'POST', body: '{', soll: 400 },
      { name: 'Liste als Body', url: 'https://konto.intern/konto-aus-google', method: 'POST', body: '[]', soll: 400 },
    ];
    await pruefeFaelle('P3 B1-Lehre: der DO antwortet nur auf POST https://konto.intern/<aktion>', faelle, async (f) => {
      const res = await speicher.fetch(new Request(f.url, { method: f.method, body: f.body }));
      const daten = await res.json();
      return gleich([res.status, res.headers.get('cache-control'), daten.ok], [f.soll, 'no-store', f.soll === 200]);
    });
    const ohneJetzt = await rufeDo(speicher, 'konto-aus-google', { email: 'b@jakobsmedien.com', name: 'B' });
    check('P3 EP21: ohne jetzt im Body gilt env.KONTO_UHR', (await speicher.ladeKonto(ohneJetzt.kid)).erstellt === T0 + 7 * MIN);
    speicher.kontoAusGoogle = async () => {
      throw new TypeError('kaputt: geheim-123');
    };
    const kaputt = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'c@jakobsmedien.com', name: 'C' });
    check(
      'P3 Diagnose: ein Fehler in einer Aktion → 500 server mit dem Namen des Fehlers, ohne seine Meldung',
      kaputt.http === 500 && kaputt.code === 'server' && kaputt.diagnose === 'TypeError' && !JSON.stringify(kaputt).includes('geheim-123'),
    );
  }

  // ── P3: Quelltext-Wächter (EP1, EP21, Lehre B1) ──
  {
    const quelle = readFileSync(new URL('../konto-do.js', import.meta.url), 'utf8');
    check(
      'P3 EP1: konto-do.js ohne cloudflare:workers, ohne node:, ohne console, ohne KONTO_SCHLUESSEL und IVEO_SCHLUESSEL',
      !/from\s+['"]cloudflare:/.test(quelle) && !/['"]node:/.test(quelle) && !/\bconsole\./.test(quelle) &&
        !quelle.includes('KONTO_SCHLUESSEL') && !quelle.includes('IVEO_SCHLUESSEL'),
    );
  }

  // ── P4: Vorgang anlegen und lesen (Spec 4.1, EP5) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    const geraet = await testGeraet({ name: 'Regie-PC 1' });
    const v = await neuerVorgang(speicher, geraet);
    const gespeichert = ctx.daten.get(`vorgang:${v.vorgang}`);
    const roh = JSON.stringify([...ctx.daten.values()]);
    const lesen = await rufeDo(speicher, 'vorgang-lesen', { jetzt: T0 + MIN, vorgang: v.vorgang });
    check(
      'P4 4.1: Vorgang anlegen (bis = jetzt + 5 min, Gerät mit gid, Abholgeheimnis nur als Hash, kein Klartext-Geheimnis im Speicher); lesen liefert Code und Rechnername',
      v.http === 200 && typeof v.vorgang === 'string' && v.vorgang.length === 24 && v.bis === T0 + 5 * MIN &&
        gespeichert.zustand === 'offen' && gespeichert.code === v.code && gespeichert.geraet.gid === geraet.gid &&
        gespeichert.geraet.name === 'Regie-PC 1' && gespeichert.abholHash === v.abholHash && !roh.includes(v.abholGeheimnis) &&
        lesen.ok === true && lesen.zustand === 'offen' && lesen.code === v.code && lesen.rechnerName === 'Regie-PC 1' && lesen.bis === v.bis,
    );
    const gut = { geraet: geraet.angaben, abholHash: v.abholHash, code: 'K7P-42X' };
    const faelle = [
      { name: 'richtig', body: gut, soll: 200 },
      { name: 'Code mit O', body: { ...gut, code: 'K7O-42X' }, soll: 400 },
      { name: 'Code ohne Bindestrich', body: { ...gut, code: 'K7P42X' }, soll: 400 },
      { name: 'Code klein', body: { ...gut, code: 'k7p-42x' }, soll: 400 },
      { name: 'Hash zu kurz', body: { ...gut, abholHash: 'abc' }, soll: 400 },
      { name: 'ohne Gerät', body: { ...gut, geraet: undefined }, soll: 400 },
      { name: 'Schlüssel mit privatem Anteil', body: { ...gut, geraet: { ...geraet.angaben, publicJwk: { ...geraet.publicJwk, d: 'x' } } }, soll: 400 },
      { name: 'Plattform linux', body: { ...gut, geraet: { ...geraet.angaben, plattform: 'linux' } }, soll: 400 },
      { name: 'Architektur ia32', body: { ...gut, geraet: { ...geraet.angaben, arch: 'ia32' } }, soll: 400 },
      { name: 'Rechnername leer', body: { ...gut, geraet: { ...geraet.angaben, name: '  ' } }, soll: 400 },
    ];
    await pruefeFaelle('P4 4.1: vorgang-anlegen prüft Code, Abhol-Hash und Gerät', faelle, async (f) => {
      const r = await rufeDo(speicher, 'vorgang-anlegen', { jetzt: T0, ...f.body });
      return gleich([r.http, r.ok ? 'ok' : r.code], [f.soll, f.soll === 200 ? 'ok' : 'ungueltig']);
    });
  }

  // ── P4: Ablauf mit Google bis zum Abholen (Spec 4.1) ──
  {
    const { speicher, ctx } = neuerSpeicher({ ERSTER_ADMIN: ERSTE });
    const geraet = await testGeraet({ name: 'Regie-PC 2' });
    const v = await neuerVorgang(speicher, geraet);
    const warten1 = await abholen(speicher, v, geraet, T0 + 2000);
    const k = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0 + 3000, email: 'maria@jakobsmedien.com', name: 'Maria Schmidt' });
    const b = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0 + 3000, vorgang: v.vorgang, kid: k.kid });
    const warten2 = await abholen(speicher, v, geraet, T0 + 4000);
    const lesen = await rufeDo(speicher, 'vorgang-lesen', { jetzt: T0 + 4000, vorgang: v.vorgang });
    const ja = await rufeDo(speicher, 'vorgang-bestaetigen', { jetzt: T0 + 5000, vorgang: v.vorgang, seitenToken: b.seitenToken, antwort: 'ja' });
    const fertig = await abholen(speicher, v, geraet, T0 + 6000);
    const nochmal = await abholen(speicher, v, geraet, T0 + 7000);
    const g = ctx.daten.get(`geraet:${geraet.gid}`);
    check(
      'P4 4.1: Abholen wartet bis zur Bestätigung; Ja → Konto (ohne Geheimes) und Gerät (ohne Schlüssel); zweites Abholen → 404 vorgang-unbekannt',
      warten1.zustand === 'wartet' && b.ok === true && b.email === 'maria@jakobsmedien.com' && b.code === v.code && b.rechnerName === 'Regie-PC 2' &&
        typeof b.seitenToken === 'string' && warten2.zustand === 'wartet' && lesen.zustand === 'angemeldet' && ja.zustand === 'bestaetigt' &&
        fertig.ok === true && fertig.zustand === 'bestaetigt' && fertig.konto.kid === k.kid && fertig.konto.stufe === 'kollege' &&
        !('passwort' in fertig.konto) && fertig.geraet.gid === geraet.gid && !('publicJwk' in fertig.geraet) && fertig.geraet.angemeldetSeit === T0 + 6000 &&
        nochmal.http === 404 && nochmal.code === 'vorgang-unbekannt' && !ctx.daten.has(`vorgang:${v.vorgang}`) &&
        g.letztesKonto === k.kid && g.jm === false && g.ersterKontakt === T0 + 6000 && g.letzterKontakt === T0 + 6000 && g.publicJwk.kty === 'EC' &&
        (await speicher.ladeKonto(k.kid)).letzteAnmeldung === T0 + 6000,
    );
    g.jm = true;
    await ctx.storage.put(`geraet:${geraet.gid}`, g);
    const zweite = await googleAnmelden(speicher, geraet, ERSTE, 'Clara Chefin', T0 + TAG);
    check(
      'P4 7: erneute Anmeldung am selben Rechner behält JM-Markierung und ersten Kontakt; der erste Admin kommt als Admin',
      zweite.abgeholt.zustand === 'bestaetigt' && zweite.abgeholt.geraet.jm === true && zweite.abgeholt.geraet.ersterKontakt === T0 + 6000 &&
        zweite.abgeholt.geraet.letztesKonto === zweite.kid && zweite.abgeholt.konto.stufe === 'admin',
    );
  }

  // ── P4: Klasse „Code abgelaufen“ (Spec 4.1: 5 min) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    const geraet = await testGeraet();
    const k = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'maria@jakobsmedien.com', name: 'Maria Schmidt' });
    const v = await neuerVorgang(speicher, geraet);
    const b = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0 + MIN, vorgang: v.vorgang, kid: k.kid });
    const spaet = await rufeDo(speicher, 'vorgang-bestaetigen', { jetzt: T0 + 5 * MIN, vorgang: v.vorgang, seitenToken: b.seitenToken, antwort: 'ja' });
    const spaetLesen = await rufeDo(speicher, 'vorgang-lesen', { jetzt: T0 + 5 * MIN, vorgang: v.vorgang });
    const spaetBinden = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0 + 5 * MIN, vorgang: v.vorgang, kid: k.kid });
    const abgeholt = await abholen(speicher, v, geraet, T0 + 5 * MIN);
    check(
      'P4 4.1: Code abgelaufen (genau 5 min): Bestätigen, Lesen, Binden → 404 vorgang-unbekannt (B10); Abholen → abgelaufen, Vorgang weg',
      b.ok === true && spaet.http === 404 && spaet.code === 'vorgang-unbekannt' && spaetLesen.code === 'vorgang-unbekannt' &&
        spaetBinden.code === 'vorgang-unbekannt' && abgeholt.ok === true && abgeholt.zustand === 'abgelaufen' && !ctx.daten.has(`vorgang:${v.vorgang}`),
    );
    const v2 = await neuerVorgang(speicher, geraet);
    const b2 = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0 + MIN, vorgang: v2.vorgang, kid: k.kid });
    const ja2 = await rufeDo(speicher, 'vorgang-bestaetigen', { jetzt: T0 + 5 * MIN - 1, vorgang: v2.vorgang, seitenToken: b2.seitenToken, antwort: 'ja' });
    const zuSpaet = await abholen(speicher, v2, geraet, T0 + 5 * MIN);
    check(
      'P4 4.1: bestätigt vor Ablauf, abgeholt nach Ablauf → abgelaufen (keine Sitzung nach der Frist)',
      ja2.zustand === 'bestaetigt' && zuSpaet.zustand === 'abgelaufen' && !('konto' in zuSpaet),
    );
  }

  // ── P4: Klasse „Code von anderem Konto bestätigt“ (EP5: der Vorgang gehört dem ersten Konto) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    await legeExternenAn(speicher, { kid: 'k-b', email: 'b@firma.example', passwort: 'passwort-von-b' });
    await legeExternenAn(speicher, { kid: 'k-d', email: 'd@firma.example', einladungscode: 'DDDD-EEEE-FFFF' });
    const geraet = await testGeraet();
    const v = await neuerVorgang(speicher, geraet);
    const a = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'anna@jakobsmedien.com', name: 'Anna A' });
    const c = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'carl@jakobsmedien.com', name: 'Carl C' });
    const bindA = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0, vorgang: v.vorgang, kid: a.kid });
    const bindB = await rufeDo(speicher, 'vorgang-passwort', { jetzt: T0, vorgang: v.vorgang, email: 'b@firma.example', passwort: 'passwort-von-b' });
    const bindC = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0, vorgang: v.vorgang, kid: c.kid });
    const bindD = await rufeDo(speicher, 'vorgang-passwort', { jetzt: T0, vorgang: v.vorgang, email: 'd@firma.example', einladungscode: 'DDDD-EEEE-FFFF', neu: 'neues-passwort-d' });
    const kontoD = ctx.daten.get('konto:k-d');
    const nochmalA = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0, vorgang: v.vorgang, kid: a.kid });
    const fremdesToken = await rufeDo(speicher, 'vorgang-bestaetigen', { jetzt: T0, vorgang: v.vorgang, seitenToken: zufall(24), antwort: 'ja' });
    const ohneToken = await rufeDo(speicher, 'vorgang-bestaetigen', { jetzt: T0, vorgang: v.vorgang, antwort: 'ja' });
    const ja = await rufeDo(speicher, 'vorgang-bestaetigen', { jetzt: T0, vorgang: v.vorgang, seitenToken: bindA.seitenToken, antwort: 'ja' });
    const fertig = await abholen(speicher, v, geraet, T0);
    check(
      'P4 4.1: Code von anderem Konto bestätigt: B (Passwort), C (Google) und D (Einladung, bleibt unverbraucht) am Vorgang von A → 409 konflikt; A noch einmal → dasselbe Seitentoken; fremdes oder fehlendes Seitentoken → 403; abgeholt wird A',
      bindA.ok === true && bindB.http === 409 && bindB.code === 'konflikt' && bindC.http === 409 && bindC.code === 'konflikt' &&
        bindD.http === 409 && bindD.code === 'konflikt' && 'einladung' in kontoD && !('passwort' in kontoD) &&
        nochmalA.ok === true && nochmalA.seitenToken === bindA.seitenToken && fremdesToken.http === 403 && fremdesToken.code === 'vorgang-unbekannt' &&
        ohneToken.http === 403 && ja.zustand === 'bestaetigt' && fertig.zustand === 'bestaetigt' && fertig.konto.kid === a.kid,
    );
  }

  // ── P4: Klasse „fremdes Gerät“ (Spec 7, EP5) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    const geraet = await testGeraet();
    const fremd = await testGeraet();
    const v = await neuerVorgang(speicher, geraet);
    const k = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'maria@jakobsmedien.com', name: 'Maria Schmidt' });
    const b = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0, vorgang: v.vorgang, kid: k.kid });
    await rufeDo(speicher, 'vorgang-bestaetigen', { jetzt: T0, vorgang: v.vorgang, seitenToken: b.seitenToken, antwort: 'ja' });
    const faelle = [
      { name: 'Beweis eines anderen Schlüssels', beweis: () => fremd.beweis('abholen', v.vorgang, T0) },
      { name: 'fremder Schlüssel mit eigener gid', beweis: async () => ({ ...(await fremd.beweis('abholen', v.vorgang, T0)), gid: geraet.gid }) },
      { name: 'falscher Zweck', beweis: () => geraet.beweis('erneuern', v.vorgang, T0) },
      { name: 'falscher Bezug', beweis: () => geraet.beweis('abholen', 'anderer-vorgang', T0) },
      { name: 'Beweis älter als 5 min', beweis: () => geraet.beweis('abholen', v.vorgang, T0 - 5 * MIN - 1) },
      { name: 'ohne Beweis', beweis: async () => null },
    ];
    await pruefeFaelle('P4 7: fremdes Gerät beim Abholen → 403 geraet-unbekannt, der Vorgang bleibt bestätigt', faelle, async (f) => {
      const r = await rufeDo(speicher, 'vorgang-abholen', { jetzt: T0, vorgang: v.vorgang, abholHash: v.abholHash, beweis: await f.beweis() });
      return gleich([r.http, r.code, ctx.daten.get(`vorgang:${v.vorgang}`)?.zustand], [403, 'geraet-unbekannt', 'bestaetigt']);
    });
    const falschesGeheimnis = await rufeDo(speicher, 'vorgang-abholen', {
      jetzt: T0,
      vorgang: v.vorgang,
      abholHash: await sha256B64url(zufall(32)),
      beweis: await geraet.beweis('abholen', v.vorgang, T0),
    });
    const richtig = await abholen(speicher, v, geraet, T0);
    check(
      'P4 4.1: falsches Abholgeheimnis → 404 vorgang-unbekannt; danach holt das richtige Gerät ab',
      falschesGeheimnis.http === 404 && falschesGeheimnis.code === 'vorgang-unbekannt' && richtig.zustand === 'bestaetigt' && ctx.daten.has(`geraet:${geraet.gid}`) &&
        !ctx.daten.has(`geraet:${fremd.gid}`),
    );
  }

  // ── P4: Nein, Abbrechen (Spec 4.1, Schritt 4) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    const geraet = await testGeraet();
    const k = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'maria@jakobsmedien.com', name: 'Maria Schmidt' });
    const v = await neuerVorgang(speicher, geraet);
    const b = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0, vorgang: v.vorgang, kid: k.kid });
    const vielleicht = await rufeDo(speicher, 'vorgang-bestaetigen', { jetzt: T0, vorgang: v.vorgang, seitenToken: b.seitenToken, antwort: 'vielleicht' });
    const nein = await rufeDo(speicher, 'vorgang-bestaetigen', { jetzt: T0, vorgang: v.vorgang, seitenToken: b.seitenToken, antwort: 'nein' });
    const dochJa = await rufeDo(speicher, 'vorgang-bestaetigen', { jetzt: T0, vorgang: v.vorgang, seitenToken: b.seitenToken, antwort: 'ja' });
    const launcher = await abholen(speicher, v, geraet, T0);
    check(
      'P4 4.1: Nein → abgelehnt auf beiden Seiten (Seite: kein Ja danach; Launcher: abgelehnt, Vorgang weg, kein Gerät angelegt); unbekannte Antwort → 400',
      vielleicht.http === 400 && vielleicht.code === 'ungueltig' && nein.zustand === 'abgelehnt' && dochJa.http === 404 &&
        launcher.zustand === 'abgelehnt' && !ctx.daten.has(`vorgang:${v.vorgang}`) && !ctx.daten.has(`geraet:${geraet.gid}`),
    );
    const w = await neuerVorgang(speicher, geraet);
    const falsch = await rufeDo(speicher, 'vorgang-abbrechen', { jetzt: T0, vorgang: w.vorgang, abholHash: await sha256B64url(zufall(32)) });
    const ab = await rufeDo(speicher, 'vorgang-abbrechen', { jetzt: T0, vorgang: w.vorgang, abholHash: w.abholHash });
    const danach = await abholen(speicher, w, geraet, T0);
    const seite = await rufeDo(speicher, 'vorgang-lesen', { jetzt: T0, vorgang: w.vorgang });
    check(
      'P4 4.1: Abbrechen nur mit dem Abholgeheimnis (sonst 404); danach kennen Launcher und Seite den Vorgang nicht mehr',
      falsch.http === 404 && ab.ok === true && danach.code === 'vorgang-unbekannt' && seite.code === 'vorgang-unbekannt',
    );
  }

  // ── P4: Google-Zustand im Vorgang (EP6: state, nonce, verifier) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    const geraet = await testGeraet();
    const v = await neuerVorgang(speicher, geraet);
    const erst = { state: zufall(24), nonce: zufall(24), verifier: zufall(32) };
    const dann = { state: zufall(24), nonce: zufall(24), verifier: zufall(32) };
    const m1 = await rufeDo(speicher, 'vorgang-google-merken', { jetzt: T0, vorgang: v.vorgang, ...erst });
    const m2 = await rufeDo(speicher, 'vorgang-google-merken', { jetzt: T0, vorgang: v.vorgang, ...dann });
    const kurz = await rufeDo(speicher, 'vorgang-google-merken', { jetzt: T0, vorgang: v.vorgang, ...dann, state: 'x' });
    const alt = await rufeDo(speicher, 'vorgang-google-state', { jetzt: T0, state: erst.state });
    const neu = await rufeDo(speicher, 'vorgang-google-state', { jetzt: T0, state: dann.state });
    const zweimal = await rufeDo(speicher, 'vorgang-google-state', { jetzt: T0, state: dann.state });
    const unbekannt = await rufeDo(speicher, 'vorgang-google-state', { jetzt: T0, state: zufall(24) });
    const w = await neuerVorgang(speicher, geraet);
    await rufeDo(speicher, 'vorgang-google-merken', { jetzt: T0, vorgang: w.vorgang, ...erst });
    const nachAblauf = await rufeDo(speicher, 'vorgang-google-state', { jetzt: T0 + 5 * MIN, state: erst.state });
    check(
      'P4 EP6: Google-Zustand: merken, ein neuer state ersetzt den alten, Form geprüft; jeder state gilt genau einmal und nur im laufenden Vorgang',
      m1.ok === true && m2.ok === true && kurz.http === 400 && alt.http === 404 && neu.ok === true && neu.vorgang === v.vorgang &&
        neu.nonce === dann.nonce && neu.verifier === dann.verifier && zweimal.http === 404 && unbekannt.http === 404 && nachAblauf.http === 404 &&
        !('google' in ctx.daten.get(`vorgang:${v.vorgang}`)) && !ctx.daten.has(`state:${dann.state}`),
    );
  }

  // ── P4: Passwort und Bremse (Spec 4, EP4) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    await legeExternenAn(speicher, { passwort: 'richtiges-passwort' });
    const geraet = await testGeraet();
    const versuch = async (email, passwort, jetzt) => {
      const v = await neuerVorgang(speicher, geraet, jetzt);
      return rufeDo(speicher, 'vorgang-passwort', { jetzt, vorgang: v.vorgang, email, passwort });
    };
    const richtig = await versuch('Technik@Firma.example', 'richtiges-passwort', T0);
    const falsch = await versuch('technik@firma.example', 'falsches-passwort', T0);
    const unbekannt = await versuch('niemand@firma.example', 'richtiges-passwort', T0);
    const kollege = await versuch('maria@jakobsmedien.com', 'richtiges-passwort', T0);
    const unbekanntZaehler = ctx.daten.get(`fehl-email:${await sha256B64url('niemand@firma.example')}`);
    check(
      'P4 4: Passwort richtig → gebunden; falsch → 401 falsch; unbekannte E-Mail → derselbe Code, gezählt nur unter dem Hash der E-Mail; jakobsmedien.com → 400 domain (B23)',
      richtig.ok === true && richtig.email === 'technik@firma.example' && falsch.http === 401 && falsch.code === 'falsch' &&
        unbekannt.http === 401 && unbekannt.code === 'falsch' && kollege.http === 400 && kollege.code === 'domain' &&
        JSON.stringify(ctx.daten.get('fehl:k-ext')) === JSON.stringify({ anzahl: 1, bisMs: null, am: T0 }) &&
        [...ctx.daten.keys()].filter((x) => x.startsWith('fehl:')).length === 1 && unbekanntZaehler?.anzahl === 1 &&
        ![...ctx.daten.keys()].some((x) => x.includes('niemand')),
    );
    const reihe = [];
    for (let i = 0; i < 4; i++) reihe.push((await versuch('technik@firma.example', `falsch-${i}`, T0 + i * 1000)).code);
    const gesperrtRichtig = await versuch('technik@firma.example', 'richtiges-passwort', T0 + 10 * MIN);
    const frei = await versuch('technik@firma.example', 'richtiges-passwort', T0 + 3000 + 15 * MIN);
    check(
      'P4 4: Bremse: der 5. Fehlversuch in Folge sperrt 15 min (429 bremse mit Restminuten), auch für das richtige Passwort; danach frei, Erfolg setzt zurück',
      JSON.stringify(reihe) === '["falsch","falsch","falsch","bremse"]' && gesperrtRichtig.http === 429 && gesperrtRichtig.code === 'bremse' &&
        gesperrtRichtig.minuten === 6 && frei.ok === true && !ctx.daten.has('fehl:k-ext'),
    );
  }

  // ── P4: unbekannte E-Mail wie ein Konto (EP4, AbwA18: keine Auskunft, ob es die E-Mail gibt) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    await legeExternenAn(speicher, { passwort: 'richtiges-passwort' });
    const geraet = await testGeraet();
    const reihe = async (email) => {
      const codes = [];
      for (let i = 0; i < 6; i++) {
        const v = await neuerVorgang(speicher, geraet, T0 + i * 1000);
        const r = await rufeDo(speicher, 'vorgang-passwort', { jetzt: T0 + i * 1000, vorgang: v.vorgang, email, passwort: `falsch-${i}` });
        codes.push(`${r.http}:${r.code}${r.minuten ? `:${r.minuten}` : ''}`);
      }
      return codes.join(',');
    };
    const bekannt = await reihe('technik@firma.example');
    const unbekannt = await reihe('Niemand@Firma.example');
    const zaehler = ctx.daten.get(`fehl-email:${await sha256B64url('niemand@firma.example')}`);
    const roh = JSON.stringify([...ctx.daten.keys(), ...ctx.daten.values()]);
    check(
      'P4 4, EP4: eine unbekannte E-Mail verhält sich wie ein Konto (gleiche Antworten, der 5. Fehlversuch sperrt 15 min); ihr Zähler steht nur unter dem Hash der E-Mail',
      bekannt === unbekannt && bekannt === '401:falsch,401:falsch,401:falsch,401:falsch,429:bremse:15,429:bremse:15' &&
        zaehler?.anzahl === 5 && zaehler?.am === T0 + 4000 && !roh.includes('niemand'),
    );
  }

  // ── P4: Bremse gegen parallele Versuche (EP4, AbwA18) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    await legeExternenAn(speicher, { passwort: 'richtiges-passwort' });
    const geraet = await testGeraet();
    const vorgaenge = [];
    for (let i = 0; i < 20; i++) vorgaenge.push(await neuerVorgang(speicher, geraet));
    const antworten = await Promise.all(
      vorgaenge.map((v, i) =>
        rufeDo(speicher, 'vorgang-passwort', { jetzt: T0, vorgang: v.vorgang, email: 'technik@firma.example', passwort: i === 19 ? 'richtiges-passwort' : `falsch-${i}` }),
      ),
    );
    const zaehl = {};
    for (const a of antworten) zaehl[a.ok ? 'ok' : a.code] = (zaehl[a.ok ? 'ok' : a.code] || 0) + 1;
    check(
      'P4 EP4: 19 falsche und zuletzt das richtige Passwort gleichzeitig: jeder Versuch zählt wie nacheinander (4 falsch, 16 Bremse, das richtige kommt nicht durch)',
      zaehl.falsch === 4 && zaehl.bremse === 16 && !zaehl.ok && ctx.daten.get('fehl:k-ext')?.bisMs === T0 + 15 * MIN,
    );
  }

  // ── P4: Rechnername (Spec 4.1, AbwA19) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    const faelle = [
      { name: 'normal', roh: 'Regie-PC 1', soll: 'Regie-PC 1' },
      { name: 'Umlaute und Klammern', roh: 'Büro (Saal 2)', soll: 'Büro (Saal 2)' },
      { name: 'Leerraum', roh: '  Regie \t PC\n1 ', soll: 'Regie PC 1' },
      { name: 'Richtungszeichen', roh: 'PC\u202eLIAM', soll: 'PC LIAM' },
      { name: 'unsichtbare Zeichen', roh: 'Re\u200bgie\u2060-PC', soll: 'Re gie -PC' },
      { name: 'Steuerzeichen', roh: 'PC\u0007\u001b[31m', soll: 'PC [31m' },
      { name: 'länger als 40 Zeichen', roh: 'Dein Rechner: Code stimmt, bitte Ja klicken und fertig', soll: 'Dein Rechner: Code stimmt, bitte Ja klic' },
      { name: 'nur Leerraum und Unsichtbares', roh: ' \u200b ', soll: null },
    ];
    await pruefeFaelle('P4 4.1: Rechnername der Bestätigungsseite (höchstens 40 Zeichen; Steuer-, unsichtbare und Richtungszeichen werden Leerzeichen; leer → 400)', faelle, async (f) => {
      const g = await testGeraet({ name: f.roh });
      const r = await rufeDo(speicher, 'vorgang-anlegen', { jetzt: T0, geraet: g.angaben, abholHash: await sha256B64url(zufall(32)), code: 'K7P-42X' });
      const ist = r.ok ? ctx.daten.get(`vorgang:${r.vorgang}`).geraet.name : `${r.http}:${r.code}`;
      return gleich(ist, f.soll === null ? '400:ungueltig' : f.soll);
    });
  }

  // ── P4: Einladung (Spec 4, EP4: Einladungscode einmal, 72 h) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    await legeExternenAn(speicher, { kid: 'k-neu', email: 'neu@firma.example', einladungscode: 'ABCD-EFGH-JKLM', einladungBis: T0 + 72 * 3600_000 });
    await legeExternenAn(speicher, { kid: 'k-alt', email: 'alt@firma.example', einladungscode: 'NPQR-STUV-WXYZ', einladungBis: T0 + 72 * 3600_000 });
    const geraet = await testGeraet();
    const mitCode = async (email, einladungscode, neu, neu2, jetzt = T0) => {
      const v = await neuerVorgang(speicher, geraet, jetzt);
      return rufeDo(speicher, 'vorgang-passwort', { jetzt, vorgang: v.vorgang, email, einladungscode, neu, ...(neu2 === undefined ? {} : { neu2 }) });
    };
    const kurz = await mitCode('neu@firma.example', 'ABCD-EFGH-JKLM', 'kurz-9-zz');
    const ungleich = await mitCode('neu@firma.example', 'ABCD-EFGH-JKLM', 'langes-passwort-1', 'langes-passwort-2');
    const falscherCode = await mitCode('neu@firma.example', 'ABCD-EFGH-JKLN', 'langes-passwort-1');
    const richtig = await mitCode('neu@firma.example', ' abcd efgh-jklm ', 'langes-passwort-1', 'langes-passwort-1');
    const zweimal = await mitCode('neu@firma.example', 'ABCD-EFGH-JKLM', 'langes-passwort-2');
    const konto = ctx.daten.get('konto:k-neu');
    const danach = await passwortAnmelden(speicher, geraet, { email: 'neu@firma.example', passwort: 'langes-passwort-1' });
    const abgelaufen = await mitCode('alt@firma.example', 'NPQR-STUV-WXYZ', 'langes-passwort-1', undefined, T0 + 72 * 3600_000);
    check(
      'P4 4: Einladung: neu < 10 Zeichen → passwort-kurz, ungleich → passwort-ungleich, falscher Code → 400 einladung; richtiger Code (klein, Leerzeichen) setzt das Passwort und gilt nur einmal, das Abholen liefert keinen Hash; nach 72 h ungültig',
      kurz.http === 400 && kurz.code === 'passwort-kurz' && ungleich.code === 'passwort-ungleich' && falscherCode.http === 400 &&
        falscherCode.code === 'einladung' && richtig.ok === true && zweimal.code === 'einladung' && !('einladung' in konto) &&
        konto.passwort.startsWith('pbkdf2-sha256$100000$') && danach.abgeholt.zustand === 'bestaetigt' && danach.abgeholt.konto.kid === 'k-neu' && !('passwort' in danach.abgeholt.konto) &&
        abgelaufen.code === 'einladung',
    );
  }

  // ── P4: Klassen „gesperrt“ und „abgelaufen“ (Spec 4, 6.1) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    const geraet = await testGeraet();
    await legeExternenAn(speicher, { kid: 'k-gesperrt', email: 'gesperrt@firma.example', passwort: 'richtiges-passwort', zustand: 'gesperrt' });
    await legeExternenAn(speicher, { kid: 'k-ablauf', email: 'ablauf@firma.example', passwort: 'richtiges-passwort', bis: T0 });
    const g = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0 - TAG, email: 'maria@jakobsmedien.com', name: 'Maria Schmidt' });
    const h = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0 - TAG, email: 'hans@jakobsmedien.com', name: 'Hans Huber' });
    const v = await neuerVorgang(speicher, geraet);
    const bindG = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0, vorgang: v.vorgang, kid: g.kid });
    await rufeDo(speicher, 'vorgang-bestaetigen', { jetzt: T0, vorgang: v.vorgang, seitenToken: bindG.seitenToken, antwort: 'ja' });
    const gk = await speicher.ladeKonto(g.kid);
    gk.zustand = 'gesperrt';
    await speicher.speichereKonto(gk);
    const hk = await speicher.ladeKonto(h.kid);
    hk.stufe = 'externer';
    hk.bis = T0 - 1;
    await speicher.speichereKonto(hk);
    const ergebnis = (r) => [r.http, r.code, r.bis ?? null];
    const faelle = [
      { name: 'Passwort, gesperrt', lauf: async () => (await passwortAnmelden(speicher, geraet, { email: 'gesperrt@firma.example', passwort: 'richtiges-passwort' })).passwort, soll: [403, 'gesperrt', null] },
      { name: 'Passwort, abgelaufen', lauf: async () => (await passwortAnmelden(speicher, geraet, { email: 'ablauf@firma.example', passwort: 'richtiges-passwort' })).passwort, soll: [403, 'zugang-abgelaufen', T0] },
      { name: 'Google, gesperrt', lauf: () => rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'maria@jakobsmedien.com', name: 'Maria Schmidt' }), soll: [403, 'gesperrt', null] },
      { name: 'Google, abgelaufen', lauf: () => rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'hans@jakobsmedien.com', name: 'Hans Huber' }), soll: [403, 'zugang-abgelaufen', T0 - 1] },
      { name: 'Binden nach Sperre', lauf: async () => rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0, vorgang: (await neuerVorgang(speicher, geraet)).vorgang, kid: g.kid }), soll: [403, 'gesperrt', null] },
      { name: 'Abholen nach Sperre zwischen Ja und Abholen', lauf: () => abholen(speicher, v, geraet, T0), soll: [403, 'gesperrt', null] },
    ];
    await pruefeFaelle('P4 6.1: gesperrt und abgelaufen bei Google- und Passwort-Anmeldung', faelle, async (f) => gleich(ergebnis(await f.lauf()), f.soll));
    check('P4 6.1: nach einer Sperre zwischen Ja und Abholen entsteht kein Gerät', !ctx.daten.has(`geraet:${geraet.gid}`));
  }

  // ── Ende der Fälle ──
}

run()
  .then(abschluss)
  .catch((e) => {
    console.error('Test-Harness-Fehler:', e);
    process.exit(1);
  });
