// P3–P6 · Durable Object `KontoSpeicher` (Spec 4, 4.1, 6.1, 6.3, 6.4, 7, 8, 9, 11; Plan 10.4, EP1–EP5, EP19–EP21, OF2, OF3).
//   node --experimental-strip-types services/release-proxy/test/konto-do.test.mjs
// Form „check“ über die Zählung aus konto-attrappen.mjs. Der DO läuft als einfache Klasse auf der Map-Attrappe von
// ctx.storage; Aktionen gehen wie vom Worker als POST an https://konto.intern/<aktion> (rufeDo). P4–P6 fügen ihre Fälle
// direkt vor der Marke „Ende der Fälle“ ein und ihre Hilfsfunktionen direkt vor `async function run() {`.
import { readFileSync } from 'node:fs';
import { PROTOKOLL_MS, darf, iveoSchluessel, kontoStand } from '../konto-kern.js';
import { hashePasswort, iveoEntschluesseln, iveoVerschluesseln, neuerBestaetigungsCode, sha256B64url, zufall } from '../konto-krypto.js';
import { abschluss, check, gleich, makeCtx, makeKontoNs, makeUhr, neuerSpeicher, pruefeFaelle, rufeDo, testGeraet, testSchluessel } from './konto-attrappen.mjs';

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

/** Z2: Port des Rückkanals, den der Launcher beim Anlegen meldet (Port 0 → vom Betriebssystem gewählt, hier fest). */
const RUECK_PORT = 50123;

/** Anmeldevorgang wie vom Worker (P16): Code und Abholgeheimnis entstehen dort, der DO bekommt nur den Hash (P4). */
async function neuerVorgang(speicher, geraet, jetzt = T0, rueckPort = RUECK_PORT) {
  const abholGeheimnis = zufall(32);
  const code = neuerBestaetigungsCode();
  const abholHash = await sha256B64url(abholGeheimnis);
  const r = await rufeDo(speicher, 'vorgang-anlegen', { jetzt, geraet: geraet.angaben, abholHash, code, rueckPort });
  return { ...r, abholGeheimnis, abholHash, code };
}

/**
 * Abholen mit frischem Gerätebeweis (Zweck `abholen`, Bezug Vorgang). Z2: den Einmalwert `e` (aus der Antwort auf „Ja“, `v.e`) bekommt
 * der DO wie das Abholgeheimnis nur als Hash (`eHash`, vom Worker gebildet); ohne `v.e` geht keiner mit.
 */
async function abholen(speicher, v, geraet, jetzt = T0) {
  const e = v.e ? { eHash: await sha256B64url(v.e) } : {};
  return rufeDo(speicher, 'vorgang-abholen', { jetzt, vorgang: v.vorgang, abholHash: v.abholHash, beweis: await geraet.beweis('abholen', v.vorgang, jetzt), ...e });
}

/** Z2: „Ja“ bzw. „Nein“ wie die Bestätigen-Route; bei Ja merkt sich `v` den Einmalwert `e` (den bekäme der Launcher über den Sprung). */
async function bestaetige(speicher, v, seitenToken, antwort = 'ja', jetzt = T0) {
  const r = await rufeDo(speicher, 'vorgang-bestaetigen', { jetzt, vorgang: v.vorgang, seitenToken, antwort });
  if (r.ok && typeof r.e === 'string') v.e = r.e;
  return r;
}

/** Ganze Google-Anmeldung bis zum Abholen (Spec 4.1): Konto finden oder anlegen, binden, mit Ja bestätigen, abholen. */
async function googleAnmelden(speicher, geraet, email, name, jetzt = T0) {
  const v = await neuerVorgang(speicher, geraet, jetzt);
  const k = await rufeDo(speicher, 'konto-aus-google', { jetzt, email, name });
  const b = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt, vorgang: v.vorgang, kid: k.kid });
  await bestaetige(speicher, v, b.seitenToken, 'ja', jetzt);
  return { v, kid: k.kid, abgeholt: await abholen(speicher, v, geraet, jetzt) };
}

/** Ganze Passwort-Anmeldung bis zum Abholen; `angaben` ist `{ email, passwort }` oder `{ email, einladungscode, neu }`. */
async function passwortAnmelden(speicher, geraet, angaben, jetzt = T0) {
  const v = await neuerVorgang(speicher, geraet, jetzt);
  const p = await rufeDo(speicher, 'vorgang-passwort', { jetzt, vorgang: v.vorgang, ...angaben });
  if (!p.ok) return { v, passwort: p, abgeholt: null };
  await bestaetige(speicher, v, p.seitenToken, 'ja', jetzt);
  return { v, passwort: p, abgeholt: await abholen(speicher, v, geraet, jetzt) };
}

/** Ein Externer (Passwort), angemeldet an einem Testgerät; Grundlage der Fälle ab P5. */
async function angemeldeterExterner(env = {}, o = {}) {
  const { speicher, ctx } = neuerSpeicher(env);
  const geraet = await testGeraet(o.geraet ?? {});
  const konto = await legeExternenAn(speicher, { passwort: 'richtiges-passwort', ...(o.konto ?? {}) });
  const r = await passwortAnmelden(speicher, geraet, { email: konto.email, passwort: 'richtiges-passwort' }, o.jetzt ?? T0);
  return { speicher, ctx, geraet, kid: r.abgeholt.konto.kid };
}

/** Start-Prüfung wie der Worker (P16): kid und gid aus den Claims, frischer Beweis `erneuern` mit Bezug kid. */
async function erneuern(speicher, geraet, kid, jetzt, mehr = {}) {
  return rufeDo(speicher, 'sitzung-erneuern', {
    jetzt,
    kid,
    gid: geraet.gid,
    // Claim angemeldetSeit der erneuerten Sitzung (AR79): hier der aktuelle Wert des Geräts, wie nach der Anmeldung.
    angemeldetSeit: ((await speicher.ctx.storage.get(`geraet:${geraet.gid}`)) || {}).angemeldetSeit,
    beweis: await geraet.beweis('erneuern', kid, jetzt),
    version: '0.18.0',
    rechnerName: 'Regie-PC 1',
    ...mehr,
  });
}

/**
 * Speicher mit einem aktuellen Admin (P6): mit ERSTER_ADMIN der erste Admin über Google, sonst ein Google-Konto, das im
 * Speicher zum Admin gemacht wird. `aktion` und `uebersicht` rufen den DO wie der Worker (P16: kid aus den Claims).
 */
async function mitAdmin(env = { ERSTER_ADMIN: ERSTE }) {
  const { speicher, ctx } = neuerSpeicher(env);
  const { kid } = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0 - TAG, email: ERSTE, name: 'Clara Chefin' });
  if (!env.ERSTER_ADMIN) await speicher.speichereKonto({ ...(await speicher.ladeKonto(kid)), stufe: 'admin' });
  const aktion = (a, jetzt = T0, von = kid) => rufeDo(speicher, 'admin-aktion', { jetzt, kid: von, aktion: a });
  const uebersicht = (jetzt = T0, von = kid) => rufeDo(speicher, 'admin-uebersicht', { jetzt, kid: von });
  return { speicher, ctx, kid, aktion, uebersicht };
}

/** iveo-Event wie vom Worker (P16): das Token mit IVEO_SCHLUESSEL und dem Schlüssel `basis|slug` als AAD verschlüsselt, der DO bekommt nur `{ iv, ct }`. */
async function iveoEvent(schluessel, slug, name, token, basis = 'https://iveo.example') {
  return { slug, name, ...(await iveoVerschluesseln(schluessel, token, iveoSchluessel(basis, slug))) };
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
    await ctx.storage.put('anfrage:offen-neu', { id: 'offen-neu', kid: 'k-2', zustand: 'offen', bis: T0 + TAG });
    await ctx.storage.put('geraet:g-alt', { gid: 'g-alt', name: 'Alt-PC', letzterKontakt: T0 - 365 * TAG, letztesKonto: 'k-1' });
    await ctx.storage.put('geraet:g-jung', { gid: 'g-jung', name: 'Neu-PC', letzterKontakt: T0 - 365 * TAG + 1, letztesKonto: null });
    await ctx.storage.put('fehl-email:alt', { anzahl: 2, bisMs: null, am: T0 - 30 * TAG });
    await ctx.storage.put('fehl-email:jung', { anzahl: 2, bisMs: null, am: T0 - 30 * TAG + 1 });
    await speicher.alarm();
    check(
      'P3 Alarm räumt abgelaufene Vorgänge samt state, verwaiste state, abgelaufene Einladungen, Alt-Key-Zeilen und Anfragen (auch offene) 90 Tage nach ihrem „bis“, Geräte nach 12 Monaten ohne Kontakt und Zähler unbekannter E-Mails nach 30 Tagen ab; stellt sich für morgen',
      !ctx.daten.has('vorgang:alt') && !ctx.daten.has('state:s-alt') && ctx.daten.has('vorgang:neu') && ctx.daten.has('state:s-neu') &&
        !ctx.daten.has('state:s-waise') && !('einladung' in ctx.daten.get('konto:k-1')) && 'einladung' in ctx.daten.get('konto:k-2') &&
        !ctx.daten.has('altkey:2026-07-01:katalog:win-x64') && ctx.daten.has('altkey:2026-07-30:katalog:win-x64') &&
        !ctx.daten.has('anfrage:alt') && ctx.daten.has('anfrage:jung') && !ctx.daten.has('anfrage:offen') && ctx.daten.has('anfrage:offen-neu') &&
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
        gespeichert.geraet.name === 'Regie-PC 1' && gespeichert.abholHash === v.abholHash && !roh.includes(v.abholGeheimnis) && gespeichert.rueckPort === RUECK_PORT &&
        lesen.ok === true && lesen.zustand === 'offen' && lesen.code === v.code && lesen.rechnerName === 'Regie-PC 1' && lesen.bis === v.bis,
    );
    const gut = { geraet: geraet.angaben, abholHash: v.abholHash, code: 'K7P-42X', rueckPort: RUECK_PORT };
    const faelle = [
      { name: 'richtig', body: gut, soll: 200 },
      // Z2: der Port des Rückkanals ist Pflicht, eine ganze Zahl von 1024 bis 65535.
      { name: 'Z2 Port 1024', body: { ...gut, rueckPort: 1024 }, soll: 200 },
      { name: 'Z2 Port 65535', body: { ...gut, rueckPort: 65535 }, soll: 200 },
      { name: 'Z2 ohne Port', body: { ...gut, rueckPort: undefined }, soll: 400 },
      { name: 'Z2 Port 1023', body: { ...gut, rueckPort: 1023 }, soll: 400 },
      { name: 'Z2 Port 0', body: { ...gut, rueckPort: 0 }, soll: 400 },
      { name: 'Z2 Port 65536', body: { ...gut, rueckPort: 65536 }, soll: 400 },
      { name: 'Z2 Port 50000.5', body: { ...gut, rueckPort: 50000.5 }, soll: 400 },
      { name: 'Z2 Port als Text', body: { ...gut, rueckPort: '50000' }, soll: 400 },
      { name: 'Z2 Port null', body: { ...gut, rueckPort: null }, soll: 400 },
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
    await pruefeFaelle('P4 4.1, Z2: vorgang-anlegen prüft Code, Abhol-Hash, Gerät und den Port des Rückkanals (1024–65535)', faelle, async (f) => {
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
    const ja = await bestaetige(speicher, v, b.seitenToken, 'ja', T0 + 5000);
    const fertig = await abholen(speicher, v, geraet, T0 + 6000);
    // Z2: der Grabstein nimmt nur dasselbe e noch einmal an; ohne e ist der Vorgang nach dem Abholen weg (404).
    const nochmal = await abholen(speicher, { ...v, e: undefined }, geraet, T0 + 7000);
    const g = ctx.daten.get(`geraet:${geraet.gid}`);
    check(
      'P4 4.1, Z2: Abholen wartet bis zur Bestätigung; Ja (mit e) → Konto (ohne Passwort-Hash) und Gerät (ohne Schlüssel); zweites Abholen ohne e → 404 vorgang-unbekannt',
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
    const ja2 = await bestaetige(speicher, v2, b2.seitenToken, 'ja', T0 + 5 * MIN - 1);
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
    const ja = await bestaetige(speicher, v, bindA.seitenToken);
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
    await bestaetige(speicher, v, b.seitenToken);
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

  // ── P4, Z2: Rechnername (Spec 4.1, AbwA19; Z2 Nr. 5: Erlaubnisliste statt Sperrliste, AR20) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    const faelle = [
      { name: 'normal', roh: 'Regie-PC 1', soll: 'Regie-PC 1' },
      { name: 'Umlaute und Klammern', roh: 'Büro (Saal 2)', soll: 'Büro (Saal 2)' },
      { name: 'erlaubte Zeichen - _ . ( ) und Apostroph', roh: "Saal_2.Regie-PC (Kai's)", soll: "Saal_2.Regie-PC (Kai's)" },
      { name: 'Buchstaben und Ziffern anderer Schriften', roh: 'Студия 3 東京', soll: 'Студия 3 東京' },
      { name: 'NFC (e und Akut werden ein é)', roh: 'Cafe\u{301}', soll: 'Café' },
      { name: 'geschütztes Leerzeichen und BOM werden Leerzeichen', roh: 'Regie\u{a0}PC\u{feff}1', soll: 'Regie PC 1' },
      { name: 'Leerraum', roh: '  Regie \t PC\n1 ', soll: 'Regie PC 1' },
      { name: 'Richtungszeichen', roh: 'PC\u{202e}LIAM', soll: 'PCLIAM' },
      { name: 'unsichtbare Zeichen', roh: 'Re\u{200b}gie\u{2060}-PC', soll: 'Regie-PC' },
      { name: 'Steuerzeichen', roh: 'PC\x07\x1b[31m', soll: 'PC31m' },
      { name: 'Sonderzeichen', roh: 'Regie#1 <b> & "PC" / Saal: 2!', soll: 'Regie1 b PC Saal 2' },
      { name: 'Hangul-Füller U+115F', roh: 'PC\u{115f}1', soll: 'PC1' },
      { name: 'Hangul-Füller U+1160', roh: 'PC\u{1160}1', soll: 'PC1' },
      { name: 'Hangul-Füller U+3164', roh: 'PC\u{3164}1', soll: 'PC1' },
      { name: 'Hangul-Füller U+FFA0 (halbbreit)', roh: 'PC\u{ffa0}1', soll: 'PC1' },
      { name: 'Braille-Leerzeichen U+2800', roh: 'PC\u{2800}1', soll: 'PC1' },
      { name: 'Grapheme Joiner U+034F', roh: 'PC\u{34f}1', soll: 'PC1' },
      { name: 'Variation Selector U+FE0F', roh: 'PC\u{fe0f}1', soll: 'PC1' },
      { name: 'Tag-Zeichen U+E0041 und U+E007F', roh: 'PC\u{e0041}\u{e007f}1', soll: 'PC1' },
      { name: 'Emoji', roh: 'Regie \u{1f3ac} PC', soll: 'Regie PC' },
      { name: 'länger als 40 Zeichen', roh: 'Dein Rechner: Code stimmt, bitte Ja klicken und fertig', soll: 'Dein Rechner Code stimmt bitte Ja klicke' },
      { name: 'nur Leerraum und Unsichtbares', roh: ' \u{200b} ', soll: null },
      { name: 'nur Hangul-F\u00fcller', roh: '\u{3164}\u{3164}', soll: null },
      { name: 'nur Sonderzeichen', roh: '#!?', soll: null },
    ];
    await pruefeFaelle('P4 4.1, Z2: Rechnername nur aus Buchstaben, Ziffern, Leerzeichen und -_.()\' (nach NFC, höchstens 40 Zeichen, Hangul-Füller ausdrücklich weg, alles andere entfernt, Leerraum zusammengezogen; leer → 400)', faelle, async (f) => {
      const g = await testGeraet({ name: f.roh });
      const r = await rufeDo(speicher, 'vorgang-anlegen', { jetzt: T0, geraet: g.angaben, abholHash: await sha256B64url(zufall(32)), code: 'K7P-42X', rueckPort: RUECK_PORT });
      const ist = r.ok ? ctx.daten.get(`vorgang:${r.vorgang}`).geraet.name : `${r.http}:${r.code}`;
      return gleich(ist, f.soll === null ? '400:ungueltig' : f.soll);
    });
    // Z2 Nr. 5, gemessen (Node 24): \p{L} lässt U+115F, U+1160, U+3164 und U+FFA0 durch (Kategorie Lo, Default_Ignorable_Code_Point);
    // die Regel entfernt sie darum ausdrücklich (die vier Fälle oben).
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
    await bestaetige(speicher, v, bindG.seitenToken);
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

  // ── P4 Review: gleiche Rechenarbeit für unbekannte E-Mails beim kalten Start (AR18, keine Zeitmessung) ──
  {
    const ableitungen = async (email, ersterFehler = false) => {
      const { speicher } = neuerSpeicher({});
      await legeExternenAn(speicher, { passwort: 'richtiges-passwort' });
      const geraet = await testGeraet();
      const v = await neuerVorgang(speicher, geraet);
      const original = crypto.subtle.deriveBits;
      let n = 0;
      let wirf = ersterFehler;
      crypto.subtle.deriveBits = function (...a) {
        n++;
        if (wirf) {
          wirf = false;
          return Promise.reject(new Error('Ableitung ausgefallen'));
        }
        return original.apply(this, a);
      };
      try {
        const r = await rufeDo(speicher, 'vorgang-passwort', { jetzt: T0, vorgang: v.vorgang, email, passwort: 'falsches-passwort' });
        const nErster = n;
        const w = await neuerVorgang(speicher, geraet);
        const r2 = await rufeDo(speicher, 'vorgang-passwort', { jetzt: T0, vorgang: w.vorgang, email, passwort: 'falsches-passwort' });
        return { n: nErster, r, r2 };
      } finally {
        delete crypto.subtle.deriveBits;
      }
    };
    const bekannt = await ableitungen('technik@firma.example');
    const unbekannt = await ableitungen('niemand@firma.example');
    check(
      'P4 AR18: der 1. Versuch auf einer frischen Instanz kostet für eine unbekannte und eine bekannte E-Mail gleich viele Ableitungen (Attrappe immer zuerst)',
      bekannt.n === unbekannt.n && bekannt.n >= 2 && bekannt.r.code === 'falsch' && unbekannt.r.code === 'falsch',
    );
    const ausfall = await ableitungen('niemand@firma.example', true);
    check(
      'P4 AR18: fällt die Attrappe aus, bleibt das abgelehnte Versprechen nicht liegen (erst 500, dann wieder 401 falsch)',
      ausfall.r.http === 500 && ausfall.r2.http === 401 && ausfall.r2.code === 'falsch',
    );
  }

  // ── P4 Review: Einmal-Regeln auch ohne Input-Gates (AR19) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    const geraet = await testGeraet();
    const k = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'maria@jakobsmedien.com', name: 'Maria Schmidt' });
    const v = await neuerVorgang(speicher, geraet);
    const b = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0, vorgang: v.vorgang, kid: k.kid });
    await bestaetige(speicher, v, b.seitenToken);
    const beide = await Promise.all([abholen(speicher, v, geraet, T0), abholen(speicher, v, geraet, T0)]);
    const sitzungen = beide.filter((x) => x.zustand === 'bestaetigt');
    const verloren = beide.filter((x) => x.zustand !== 'bestaetigt');
    check(
      'P4 AR19: zweimal gleichzeitig abholen ergibt genau eine Sitzung, die andere Anfrage → 404 vorgang-unbekannt',
      sitzungen.length === 1 && verloren.length === 1 && verloren[0].http === 404 && verloren[0].code === 'vorgang-unbekannt' && !ctx.daten.has(`vorgang:${v.vorgang}`),
    );
  }
  {
    const { speicher, ctx } = neuerSpeicher({});
    await legeExternenAn(speicher, { kid: 'k-e', email: 'e@firma.example', einladungscode: 'ABCD-EFGH-JKLM', einladungBis: T0 + 72 * 3600_000 });
    const geraet = await testGeraet();
    const v1 = await neuerVorgang(speicher, geraet);
    const v2 = await neuerVorgang(speicher, geraet);
    const beide = await Promise.all([
      rufeDo(speicher, 'vorgang-passwort', { jetzt: T0, vorgang: v1.vorgang, email: 'e@firma.example', einladungscode: 'ABCD-EFGH-JKLM', neu: 'passwort-erster-1' }),
      rufeDo(speicher, 'vorgang-passwort', { jetzt: T0, vorgang: v2.vorgang, email: 'e@firma.example', einladungscode: 'ABCD-EFGH-JKLM', neu: 'passwort-zweiter-2' }),
    ]);
    const konto = ctx.daten.get('konto:k-e');
    const gewinner = beide.findIndex((x) => x.ok);
    const v3 = await neuerVorgang(speicher, geraet);
    const login = gewinner < 0 ? null : await rufeDo(speicher, 'vorgang-passwort', { jetzt: T0, vorgang: v3.vorgang, email: 'e@firma.example', passwort: gewinner === 0 ? 'passwort-erster-1' : 'passwort-zweiter-2' });
    check(
      'P4 AR19: derselbe Einladungscode gleichzeitig zweimal → genau ein ok, die andere Anfrage → 400 einladung; das Passwort des Gewinners gilt',
      beide.filter((x) => x.ok).length === 1 && beide.filter((x) => x.code === 'einladung' && x.http === 400).length === 1 && !('einladung' in konto) &&
        login?.ok === true,
    );
  }
  {
    const { speicher, ctx } = neuerSpeicher({});
    const geraet = await testGeraet();
    const a = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'anna@jakobsmedien.com', name: 'Anna A' });
    const c = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'carl@jakobsmedien.com', name: 'Carl C' });
    const v = await neuerVorgang(speicher, geraet);
    const beide = await Promise.all([
      rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0, vorgang: v.vorgang, kid: a.kid }),
      rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0, vorgang: v.vorgang, kid: c.kid }),
    ]);
    const erster = beide.findIndex((x) => x.ok);
    const gespeichert = ctx.daten.get(`vorgang:${v.vorgang}`);
    const ja = erster < 0 ? null : await bestaetige(speicher, v, beide[erster].seitenToken);
    const geholt = ja ? await abholen(speicher, v, geraet, T0) : null;
    check(
      'P4 AR19: Rennen um das Binden: genau ein Konto bindet (das andere → 409 konflikt), der Vorgang gehört diesem Konto und das Abholen liefert es',
      beide.filter((x) => x.ok).length === 1 && beide.filter((x) => x.http === 409 && x.code === 'konflikt').length === 1 &&
        gespeichert.kid === [a.kid, c.kid][erster] && geholt?.konto?.kid === [a.kid, c.kid][erster],
    );
  }

  // ── P4 Review: ein entschiedener Vorgang nimmt weder Passwort-Anmeldung noch Google-Zustand an (AR20) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    await legeExternenAn(speicher, { kid: 'k-e', email: 'e@firma.example', einladungscode: 'ABCD-EFGH-JKLM', einladungBis: T0 + 72 * 3600_000 });
    const geraet = await testGeraet();
    const k = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'maria@jakobsmedien.com', name: 'Maria Schmidt' });
    const vorgaenge = [];
    for (const antwort of ['ja', 'nein']) {
      const v = await neuerVorgang(speicher, geraet);
      const b = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0, vorgang: v.vorgang, kid: k.kid });
      await rufeDo(speicher, 'vorgang-bestaetigen', { jetzt: T0, vorgang: v.vorgang, seitenToken: b.seitenToken, antwort });
      vorgaenge.push({ name: antwort === 'ja' ? 'bestätigt' : 'abgelehnt', v });
    }
    await pruefeFaelle('P4 AR20: entschiedener Vorgang → vorgang-passwort und vorgang-google-merken antworten 404 vorgang-unbekannt, die Einladung bleibt unverbraucht, nichts wird gemerkt', vorgaenge, async (f) => {
      const p = await rufeDo(speicher, 'vorgang-passwort', { jetzt: T0, vorgang: f.v.vorgang, email: 'e@firma.example', einladungscode: 'ABCD-EFGH-JKLM', neu: 'langes-passwort-1' });
      const state = zufall(24);
      const m = await rufeDo(speicher, 'vorgang-google-merken', { jetzt: T0, vorgang: f.v.vorgang, state, nonce: zufall(24), verifier: zufall(32) });
      const konto = ctx.daten.get('konto:k-e');
      return gleich(
        [p.http, p.code, m.http, m.code, 'einladung' in konto, 'passwort' in konto, ctx.daten.has(`state:${state}`), 'google' in ctx.daten.get(`vorgang:${f.v.vorgang}`)],
        [404, 'vorgang-unbekannt', 404, 'vorgang-unbekannt', true, false, false, false],
      );
    });
  }

  // ── P4 Review 2: alle Schreiber eines Vorgangs in der Reihe, ohne Input-Gates (AR22, put zurückgehalten) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    const geraet = await testGeraet();
    const a = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'anna@jakobsmedien.com', name: 'Anna A' });
    const c = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'carl@jakobsmedien.com', name: 'Carl C' });
    const v = await neuerVorgang(speicher, geraet);
    const neuState = zufall(24);
    let freigeben;
    const tor = new Promise((r) => (freigeben = r));
    const put = ctx.storage.put.bind(ctx.storage);
    ctx.storage.put = async (k, w) => {
      if (k === `vorgang:${v.vorgang}` && w && w.google && w.google.state === neuState) await tor;
      return put(k, w);
    };
    const merken = rufeDo(speicher, 'vorgang-google-merken', { jetzt: T0, vorgang: v.vorgang, state: neuState, nonce: zufall(24), verifier: zufall(32) });
    const bindA = rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0, vorgang: v.vorgang, kid: a.kid });
    await new Promise((r) => setTimeout(r, 50));
    freigeben();
    const [rm, rA] = await Promise.all([merken, bindA]);
    const nach = ctx.daten.get(`vorgang:${v.vorgang}`);
    const rc = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0, vorgang: v.vorgang, kid: c.kid });
    check(
      'P4 AR22: Binden gegen gleichzeitiges Merken des Google-Zustands: die Bindung von A geht nicht verloren (angemeldet, kid A, Zustand erhalten); Carl → 409 konflikt',
      rm.ok === true && rA.ok === true && nach.zustand === 'angemeldet' && nach.kid === a.kid && nach.google?.state === neuState && rc.http === 409 && rc.code === 'konflikt',
    );
  }
  {
    const { speicher, ctx } = neuerSpeicher({});
    const geraet = await testGeraet();
    const k = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'maria@jakobsmedien.com', name: 'Maria Schmidt' });
    const v = await neuerVorgang(speicher, geraet);
    const b = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0, vorgang: v.vorgang, kid: k.kid });
    let n = 0;
    let freigeben;
    const tor = new Promise((r) => (freigeben = r));
    const put = ctx.storage.put.bind(ctx.storage);
    ctx.storage.put = async (key, w) => {
      if (key === `vorgang:${v.vorgang}` && w && w.zustand === 'bestaetigt' && ++n === 2) await tor;
      return put(key, w);
    };
    const ja1 = rufeDo(speicher, 'vorgang-bestaetigen', { jetzt: T0, vorgang: v.vorgang, seitenToken: b.seitenToken, antwort: 'ja' });
    const ja2 = rufeDo(speicher, 'vorgang-bestaetigen', { jetzt: T0, vorgang: v.vorgang, seitenToken: b.seitenToken, antwort: 'ja' });
    for (let i = 0; i < 400 && ctx.daten.get(`vorgang:${v.vorgang}`)?.zustand !== 'bestaetigt'; i++) await new Promise((r) => setTimeout(r, 5));
    // Z2: abgeholt wird mit dem Einmalwert des Ja, das gilt (das andere Ja liefert keinen).
    const erstesJa = await Promise.race([ja1, ja2].map((p) => p.then((r) => (r.ok ? r : new Promise(() => {})))));
    const erst = await abholen(speicher, { ...v, e: erstesJa.e }, geraet, T0);
    freigeben();
    const jas = await Promise.all([ja1, ja2]);
    const zweit = await abholen(speicher, v, geraet, T0);
    check(
      'P4 AR22, Z2: zweimal „Ja“ (Doppelklick) gegen das Abholen: genau ein Ja gilt und liefert ein e, das andere → 404 ohne e, es entsteht keine zweite Sitzung',
      erst.zustand === 'bestaetigt' && jas.filter((x) => x.ok).length === 1 && jas.filter((x) => x.http === 404 && x.code === 'vorgang-unbekannt').length === 1 &&
        jas.filter((x) => typeof x.e === 'string').length === 1 && zweit.http === 404 && zweit.code === 'vorgang-unbekannt' &&
        !ctx.daten.has(`vorgang:${v.vorgang}`),
    );
  }

  // ── P4 Review 2: die Einladung zählt auf die Bremse (AR23: die Prüfung in der Reihe darf die erste nicht verdecken) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    await legeExternenAn(speicher, { kid: 'k-e', email: 'e@firma.example', einladungscode: 'ABCD-EFGH-JKLM', einladungBis: T0 + 72 * 3600_000 });
    await legeExternenAn(speicher, { kid: 'k-x', email: 'x@firma.example', einladungscode: 'NPQR-STUV-WXYZ', einladungBis: T0 + 10 * MIN });
    const geraet = await testGeraet();
    const versuch = async (email, code, jetzt) => {
      const v = await neuerVorgang(speicher, geraet, jetzt);
      return rufeDo(speicher, 'vorgang-passwort', { jetzt, vorgang: v.vorgang, email, einladungscode: code, neu: 'langes-passwort-1' });
    };
    const falsche = [];
    for (let i = 0; i < 7; i++) falsche.push(await versuch('e@firma.example', `ABCD-EFGH-JKL${i + 2}`, T0 + i * 1000));
    const richtigGesperrt = await versuch('e@firma.example', 'ABCD-EFGH-JKLM', T0 + 8000);
    check(
      'P4 AR23: 5 falsche Einladungscodes in Folge → 429 bremse (4 mal 400 einladung), auch der richtige Code kommt dann nicht durch; die Einladung bleibt',
      JSON.stringify(falsche.map((r) => `${r.http}:${r.code}`)) === JSON.stringify(['400:einladung', '400:einladung', '400:einladung', '400:einladung', '429:bremse', '429:bremse', '429:bremse']) &&
        richtigGesperrt.http === 429 && 'einladung' in ctx.daten.get('konto:k-e'),
    );
    const spaet = [];
    for (let i = 0; i < 5; i++) spaet.push(await versuch('x@firma.example', 'NPQR-STUV-WXYZ', T0 + 10 * MIN + i * 1000));
    check(
      'P4 AR23: eine abgelaufene Einladung zählt als Fehlversuch (4 mal 400 einladung, der Zähler steigt, der 5. → 429 bremse)',
      JSON.stringify(spaet.map((r) => `${r.http}:${r.code}`)) === JSON.stringify(['400:einladung', '400:einladung', '400:einladung', '400:einladung', '429:bremse']) &&
        ctx.daten.get('fehl:k-x')?.anzahl === 5,
    );
  }

  // ── P4 Review 3: die Reihe schützt Bestätigen und google-state auch bei verschränktem Lesen (AR25, Lese-Tor) ──
  {
    /** Ab dem `ab`-ten Lesen des Vorgangs: Antwort zurückhalten, bis ein zweites frisches Lesen kommt (höchstens 200 ms; die Schranke wirkt nur Richtung grün). */
    const leseTor = (ctx, vid, ab) => {
      let n = 0;
      let gehalten = 0;
      let freigeben;
      const tor = new Promise((r) => (freigeben = r));
      const get = ctx.storage.get.bind(ctx.storage);
      ctx.storage.get = async (key) => {
        const w = await get(key);
        if (key === `vorgang:${vid}` && ++n >= ab) {
          if (++gehalten === 2) freigeben();
          else setTimeout(freigeben, 200);
          await tor;
        }
        return w;
      };
    };
    {
      const { speicher, ctx } = neuerSpeicher({});
      const geraet = await testGeraet();
      const k = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'maria@jakobsmedien.com', name: 'Maria Schmidt' });
      const v = await neuerVorgang(speicher, geraet);
      const b = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0, vorgang: v.vorgang, kid: k.kid });
      leseTor(ctx, v.vorgang, 3);
      const jas = await Promise.all([1, 2].map(() => rufeDo(speicher, 'vorgang-bestaetigen', { jetzt: T0, vorgang: v.vorgang, seitenToken: b.seitenToken, antwort: 'ja' })));
      check(
        'P4 AR25: zweimal Bestätigen mit verschränktem Lesen: genau ein Ja gilt, das andere → 404 vorgang-unbekannt',
        jas.filter((x) => x.ok).length === 1 && jas.filter((x) => x.http === 404 && x.code === 'vorgang-unbekannt').length === 1,
      );
    }
    {
      const { speicher, ctx } = neuerSpeicher({});
      const geraet = await testGeraet();
      const v = await neuerVorgang(speicher, geraet);
      const S = zufall(24);
      await rufeDo(speicher, 'vorgang-google-merken', { jetzt: T0, vorgang: v.vorgang, state: S, nonce: zufall(24), verifier: zufall(32) });
      leseTor(ctx, v.vorgang, 1);
      const beide = await Promise.all([1, 2].map(() => rufeDo(speicher, 'vorgang-google-state', { jetzt: T0, state: S })));
      check(
        'P4 AR25: derselbe Google-state gleichzeitig zweimal mit verschränktem Lesen: genau einmal gültig, der andere → 404 vorgang-unbekannt',
        beide.filter((x) => x.ok).length === 1 && beide.filter((x) => x.http === 404 && x.code === 'vorgang-unbekannt').length === 1,
      );
    }
    {
      const { speicher, ctx } = neuerSpeicher({});
      const geraet = await testGeraet();
      const k = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'maria@jakobsmedien.com', name: 'Maria Schmidt' });
      const v = await neuerVorgang(speicher, geraet);
      const S = zufall(24);
      await rufeDo(speicher, 'vorgang-google-merken', { jetzt: T0, vorgang: v.vorgang, state: S, nonce: zufall(24), verifier: zufall(32) });
      const b = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0, vorgang: v.vorgang, kid: k.kid });
      await bestaetige(speicher, v, b.seitenToken);
      let halte = true;
      let freigeben;
      const tor = new Promise((r) => (freigeben = r));
      const get = ctx.storage.get.bind(ctx.storage);
      ctx.storage.get = async (key) => {
        const w = await get(key);
        if (halte && key === `vorgang:${v.vorgang}`) {
          halte = false;
          setTimeout(freigeben, 2000); // Rückfall: sonst bliebe der Test hängen, wenn das Abholen nie ans Ziel kommt
          await tor;
        }
        return w;
      };
      const st = rufeDo(speicher, 'vorgang-google-state', { jetzt: T0, state: S });
      for (let i = 0; i < 400 && halte; i++) await new Promise((r) => setTimeout(r, 5));
      const erst = await abholen(speicher, v, geraet, T0);
      freigeben();
      const rs = await st;
      // Z2: ohne e (der Grabstein nimmt nur dasselbe e noch einmal an, eigener Fall unten).
      const zweit = await abholen(speicher, { ...v, e: undefined }, geraet, T0);
      check(
        'P4 AR25: google-state gegen das Abholen eines bestätigten Vorgangs: der Vorgang wird nicht wiederbelebt (404), kein zweites Abholen',
        erst.zustand === 'bestaetigt' && rs.http === 404 && rs.code === 'vorgang-unbekannt' && !ctx.daten.has(`vorgang:${v.vorgang}`) &&
          zweit.http === 404 && zweit.code === 'vorgang-unbekannt',
      );
    }
  }

  // ── P5: Sitzung erneuern liest den aktuellen Stand (Spec 6.1, 6.3, EP2) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    const geraet = await testGeraet({ name: 'Regie-PC 3', version: '0.18.0' });
    const { kid, abgeholt } = await googleAnmelden(speicher, geraet, 'maria@jakobsmedien.com', 'Maria Schmidt');
    const vorher = kontoStand(abgeholt.konto, abgeholt.geraet, T0, undefined);
    const k = await speicher.ladeKonto(kid);
    Object.assign(k, { stufe: 'externer', tools: ['qa'], events: ['https://iveo.example|tagung'], bis: T0 + 10 * TAG, zoomBis: T0 + 5 * TAG });
    await speicher.speichereKonto(k);
    const g = ctx.daten.get(`geraet:${geraet.gid}`);
    g.jm = true;
    await ctx.storage.put(`geraet:${geraet.gid}`, g);
    const jetzt = T0 + 2 * TAG;
    const r = await erneuern(speicher, geraet, kid, jetzt, { version: '0.18.1', rechnerName: 'Regie-PC 3\u200b neu' });
    const nachher = kontoStand(r.konto, r.geraet, jetzt, undefined);
    const gNeu = ctx.daten.get(`geraet:${geraet.gid}`);
    check(
      'P5 6.1: Erneuern liest den aktuellen Stand im DO (Stufe, Werkzeuge, Events, Zugang bis, Zoom-Freigabe, JM-Rechner) und hält Version, Name und letzten Kontakt des Geräts fest',
      vorher.stufe === 'kollege' && vorher.jm === false && r.ok === true && nachher.stufe === 'externer' && JSON.stringify(nachher.tools) === '["qa"]' &&
        JSON.stringify(nachher.events) === '["https://iveo.example|tagung"]' && nachher.exp === jetzt + 30 * TAG && nachher.kontoBis === T0 + 10 * TAG && nachher.zoom === true &&
        nachher.jm === true && nachher.angemeldetSeit === T0 && !('passwort' in r.konto) && !('publicJwk' in r.geraet) &&
        gNeu.version === '0.18.1' && gNeu.name === 'Regie-PC 3 neu' && gNeu.letzterKontakt === jetzt && gNeu.ersterKontakt === T0,
    );
  }

  // ── P5: Klassen gesperrt, gelöscht, abgelaufen, fremdes Gerät beim Erneuern (Spec 6.3, 7) ──
  {
    const fremd = await testGeraet();
    const faelle = [
      { name: 'aktiv (Gegenstück)', vorbereiten: async () => {}, soll: [200, null] },
      { name: 'gesperrt', vorbereiten: async (s, kid) => s.speichereKonto({ ...(await s.ladeKonto(kid)), zustand: 'gesperrt' }), soll: [403, 'gesperrt'] },
      { name: 'gelöscht', vorbereiten: (s, kid) => s.zugangLoeschen(kid, ERSTE, T0), soll: [403, 'geloescht'] },
      { name: 'abgelaufen (bis = jetzt)', vorbereiten: async (s, kid) => s.speichereKonto({ ...(await s.ladeKonto(kid)), bis: T0 + MIN }), soll: [403, 'zugang-abgelaufen'] },
      { name: 'Beweis eines anderen Schlüssels', beweis: () => fremd.beweis('erneuern', 'k-ext', T0 + MIN), soll: [403, 'geraet-unbekannt'] },
      { name: 'unbekannte gid', mehr: { gid: fremd.gid }, soll: [403, 'geraet-unbekannt'] },
      { name: 'Beweis mit Zweck abholen', beweis: (g) => g.beweis('abholen', 'k-ext', T0 + MIN), soll: [403, 'geraet-unbekannt'] },
      { name: 'Beweis mit fremder Konto-Kennung', beweis: (g) => g.beweis('erneuern', 'k-anders', T0 + MIN), soll: [403, 'geraet-unbekannt'] },
      { name: 'Beweis 6 min alt', beweis: (g) => g.beweis('erneuern', 'k-ext', T0 + MIN - 6 * MIN), soll: [403, 'geraet-unbekannt'] },
      {
        name: 'Gerät gehört inzwischen einem anderen Konto',
        vorbereiten: async (s, kid, g) => {
          await legeExternenAn(s, { kid: 'k-zwei', email: 'zwei@firma.example', passwort: 'richtiges-passwort' });
          await passwortAnmelden(s, g, { email: 'zwei@firma.example', passwort: 'richtiges-passwort' }, T0);
        },
        soll: [403, 'geraet-unbekannt'],
      },
    ];
    await pruefeFaelle('P5 6.3: Erneuern → gesperrt, gelöscht, abgelaufen, fremdes Gerät (je 403 mit Code)', faelle, async (f) => {
      const { speicher, geraet, kid } = await angemeldeterExterner({});
      if (f.vorbereiten) await f.vorbereiten(speicher, kid, geraet);
      const mehr = { ...(f.mehr ?? {}), ...(f.beweis ? { beweis: await f.beweis(geraet) } : {}) };
      const r = await erneuern(speicher, geraet, kid, T0 + MIN, mehr);
      return gleich([r.http, r.ok ? null : r.code], f.soll);
    });
  }

  // ── P5: Google-Konten erneuern höchstens 90 Tage nach der letzten Anmeldung mit Google (Spec 4: Ausscheiden; OFP8) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    const geraet = await testGeraet();
    const { kid } = await googleAnmelden(speicher, geraet, 'maria@jakobsmedien.com', 'Maria Schmidt');
    const kette = [];
    for (const tag of [29, 58, 87, 89]) kette.push((await erneuern(speicher, geraet, kid, T0 + tag * TAG)).http);
    const nach90 = await erneuern(speicher, geraet, kid, T0 + 90 * TAG);
    const wieder = await googleAnmelden(speicher, geraet, 'maria@jakobsmedien.com', 'Maria Schmidt', T0 + 90 * TAG + MIN);
    const danach = await erneuern(speicher, geraet, kid, T0 + 100 * TAG);
    const ext = await angemeldeterExterner({}, { konto: { bis: T0 + 400 * TAG } });
    const extNach100 = await erneuern(ext.speicher, ext.geraet, ext.kid, T0 + 100 * TAG);
    check(
      'P5 4, OFP8: ein Google-Konto erneuert bis 90 Tage nach der letzten Anmeldung mit Google, danach 401 sitzung-abgelaufen; eine neue Anmeldung mit Google gilt wieder; ein E-Mail-Zugang ist nicht betroffen',
      JSON.stringify(kette) === '[200,200,200,200]' && nach90.http === 401 && nach90.code === 'sitzung-abgelaufen' &&
        wieder.abgeholt.zustand === 'bestaetigt' && ctx.daten.get(`geraet:${geraet.gid}`).angemeldetSeit === T0 + 90 * TAG + MIN &&
        danach.http === 200 && extNach100.http === 200,
    );
  }

  // ── P5: ich (Spec 6.3, EP23) und abmelden (EP26) ──
  {
    const faelle = [
      { name: 'aktiv', vorbereiten: async () => {}, soll: [true, null] },
      { name: 'gesperrt', vorbereiten: async (s, kid) => s.speichereKonto({ ...(await s.ladeKonto(kid)), zustand: 'gesperrt' }), soll: [false, 'gesperrt'] },
      { name: 'abgelaufen', vorbereiten: async (s, kid) => s.speichereKonto({ ...(await s.ladeKonto(kid)), bis: T0 + MIN }), soll: [false, 'zugang-abgelaufen'] },
      { name: 'gelöscht', vorbereiten: (s, kid) => s.zugangLoeschen(kid, ERSTE, T0), soll: [false, 'geloescht'] },
    ];
    await pruefeFaelle('P5 6.3: ich meldet den aktuellen Stand (aktiv, gesperrt, abgelaufen, gelöscht)', faelle, async (f) => {
      const { speicher, kid } = await angemeldeterExterner({});
      await f.vorbereiten(speicher, kid);
      const r = await rufeDo(speicher, 'ich', { jetzt: T0 + MIN, kid });
      return gleich([r.kontoAktiv, r.grund, r.zoomAnfrage, r.adminOffen], [...f.soll, null, 0]);
    });
    const { speicher, ctx, geraet, kid } = await angemeldeterExterner({});
    const fremd = await rufeDo(speicher, 'abmelden', { jetzt: T0 + 2 * TAG, kid: 'k-anders', gid: geraet.gid, angemeldetSeit: T0 });
    // AR74 D: eine ALTE Sitzung (anderer Claim angemeldetSeit, fehlend, kein Zahlenwert) löst das Gerät nicht.
    for (const alt of [T0 - 1, T0 + 1, undefined, null, String(T0)]) await rufeDo(speicher, 'abmelden', { jetzt: T0 + 2 * TAG, kid, gid: geraet.gid, angemeldetSeit: alt });
    const gAlt = ctx.daten.get(`geraet:${geraet.gid}`);
    check(
      'AR74 D: abmelden mit falschem, fehlendem oder nicht-numerischem angemeldetSeit ändert nichts (Gerät bleibt beim Konto)',
      gAlt.letztesKonto === kid && gAlt.angemeldetSeit === T0 && gAlt.letzterKontakt === T0,
    );
    const gFremd = ctx.daten.get(`geraet:${geraet.gid}`);
    const fremdWirkungslos = gFremd.letzterKontakt === T0 && gFremd.letztesKonto === kid && gFremd.angemeldetSeit === T0;
    const ab = await rufeDo(speicher, 'abmelden', { jetzt: T0 + TAG, kid, gid: geraet.gid, angemeldetSeit: T0 });
    const g = ctx.daten.get(`geraet:${geraet.gid}`);
    check(
      'P5 EP26: abmelden wirkt nur für das eigene Konto (ein fremdes ändert nichts); Konto und Gerät bleiben, das Gerät gehört danach keinem Konto (Z1-W1)',
      ab.ok === true && fremd.ok === true && fremdWirkungslos && g.letzterKontakt === T0 + TAG && g.letztesKonto === null && g.angemeldetSeit === null && ctx.daten.has(`konto:${kid}`),
    );
    const danach = await erneuern(speicher, geraet, kid, T0 + TAG + MIN);
    check(
      'Z1-W1 Minor 1: nach dem Abmelden lässt sich die alte Sitzung mit frischem Gerätebeweis nicht erneuern (403 geraet-unbekannt)',
      danach.http === 403 && danach.code === 'geraet-unbekannt',
    );
  }

  // AR79: sitzung-erneuern vergleicht den Claim angemeldetSeit mit dem Gerät.
  {
    const { speicher, ctx, geraet, kid } = await angemeldeterExterner({});
    const gespeichert = ctx.daten.get(`geraet:${geraet.gid}`).angemeldetSeit;
    const faelle = [
      { name: 'passender Wert', wert: gespeichert, soll: true },
      { name: 'älterer Wert (neuere Anmeldung am Gerät)', wert: gespeichert - 1, soll: false },
      { name: 'neuerer Wert', wert: gespeichert + 1, soll: false },
      { name: 'fehlt', wert: undefined, soll: false },
      { name: 'null', wert: null, soll: false },
      { name: 'Text', wert: String(gespeichert), soll: false },
    ];
    await pruefeFaelle('AR79: sitzung-erneuern nur mit passendem angemeldetSeit, sonst 403 geraet-unbekannt', faelle, async (f) => {
      const r = await erneuern(speicher, geraet, kid, T0 + MIN, { angemeldetSeit: f.wert });
      return f.soll ? (r.ok === true ? null : `ist ${r.code}`) : r.http === 403 && r.code === 'geraet-unbekannt' ? null : `ist ${r.ok} ${r.code}`;
    });
    // Das Gerät ohne angemeldetSeit (null) erneuert sich nie, auch nicht mit fehlendem Claim.
    await ctx.storage.put(`geraet:${geraet.gid}`, { ...ctx.daten.get(`geraet:${geraet.gid}`), angemeldetSeit: null });
    const ohneAm = await erneuern(speicher, geraet, kid, T0 + 2 * MIN, { angemeldetSeit: null });
    check('AR79: ein Gerät ohne angemeldetSeit erneuert sich nicht (403 geraet-unbekannt)', ohneAm.http === 403 && ohneAm.code === 'geraet-unbekannt');
  }

  // ── P5: Zoom-Anfrage (Spec 8, Schritt 1) ──
  {
    const { speicher, ctx, geraet, kid } = await angemeldeterExterner({}, { geraet: { name: 'Laptop Tom', plattform: 'mac', arch: 'arm64' } });
    const anfrage = (jetzt, o = {}) => rufeDo(speicher, 'zoom-anfragen', { jetzt, kid, gid: geraet.gid, zweck: 'Tagung Berlin', von: T0 + TAG, bis: T0 + 3 * TAG, ...o });
    const erste = await anfrage(T0);
    const zweite = await anfrage(T0 + MIN);
    const gespeichert = [...(await ctx.storage.list({ prefix: 'anfrage:' })).values()];
    const a = gespeichert[0];
    const ich = await rufeDo(speicher, 'ich', { jetzt: T0 + MIN, kid });
    check(
      'P5 8: Zoom-Anfrage eines Externen: offen mit Zweck und Zeitraum, Rechnername, JM-Markierung und Plattform des Geräts abgelegt; ich zeigt sie; zweite offene → 409 konflikt',
      erste.ok === true && JSON.stringify(erste.anfrage) === JSON.stringify({ id: a.id, zustand: 'offen', zweck: 'Tagung Berlin', von: T0 + TAG, bis: T0 + 3 * TAG, am: T0 }) &&
        gespeichert.length === 1 && a.kid === kid && a.gid === geraet.gid && a.rechnerName === 'Laptop Tom' && a.jm === false && a.plattform === 'mac' &&
        JSON.stringify(ich.zoomAnfrage) === JSON.stringify(erste.anfrage) && zweite.http === 409 && zweite.code === 'konflikt',
    );
    const faelle = [
      { name: 'Zweck leer', o: { zweck: '   ' } },
      { name: 'bis = von', o: { bis: T0 + TAG } },
      { name: 'bis vor von', o: { bis: T0 + TAG - 1 } },
      { name: 'bis vorbei', o: { von: T0 - 2 * TAG, bis: T0 - TAG } },
      { name: 'von fehlt', o: { von: undefined } },
      { name: 'bis als Text', o: { bis: String(T0 + 3 * TAG) } },
    ];
    await pruefeFaelle('P5 8: ungültige Zoom-Anfragen → 400 ungueltig', faelle, async (f) => {
      const { speicher: s2, geraet: g2, kid: k2 } = await angemeldeterExterner({});
      const r = await rufeDo(s2, 'zoom-anfragen', { jetzt: T0, kid: k2, gid: g2.gid, zweck: 'Tagung Berlin', von: T0 + TAG, bis: T0 + 3 * TAG, ...f.o });
      return gleich([r.http, r.code], [400, 'ungueltig']);
    });
  }
  {
    const { speicher } = neuerSpeicher({ ERSTER_ADMIN: ERSTE });
    const g1 = await testGeraet();
    const g2 = await testGeraet();
    const kollege = await googleAnmelden(speicher, g1, 'maria@jakobsmedien.com', 'Maria Schmidt');
    const admin = await googleAnmelden(speicher, g2, ERSTE, 'Clara Chefin');
    const anfrage = (kid, gid) => rufeDo(speicher, 'zoom-anfragen', { jetzt: T0, kid, gid, zweck: 'Probe', von: T0 + TAG, bis: T0 + 2 * TAG });
    const rk = await anfrage(kollege.kid, g1.gid);
    const ra = await anfrage(admin.kid, g2.gid);
    const k = await speicher.ladeKonto(kollege.kid);
    await speicher.speichereKonto({ ...k, stufe: 'externer', bis: T0 + 10 * TAG });
    const herabgestuft = await anfrage(kollege.kid, g1.gid);
    const ohneGeraet = await rufeDo(speicher, 'zoom-anfragen', { jetzt: T0, kid: kollege.kid, gid: 'gibts-nicht', zweck: 'Probe', von: T0 + TAG, bis: T0 + 2 * TAG });
    check(
      'P5 8: Kollege und Admin → 400 nicht-noetig (S13); ein auf Externer herabgestuftes Google-Konto darf anfragen (aktuelle Stufe im DO); unbekanntes Gerät → 403',
      rk.http === 400 && rk.code === 'nicht-noetig' && ra.code === 'nicht-noetig' && herabgestuft.ok === true && ohneGeraet.http === 403 &&
        ohneGeraet.code === 'geraet-unbekannt',
    );
  }

  // ── P5: iveo-fuer (Spec 6.4, EP13) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    for (const [slug, name] of [['tagung', 'Tagung'], ['messe', 'Messe'], ['gala', 'Gala']]) {
      const key = `https://iveo.example|${slug}`;
      await ctx.storage.put(`iveo:${key}`, { key, basis: 'https://iveo.example', slug, name, iv: `iv-${slug}`, ct: `ct-${slug}`, am: T0, von: ERSTE });
    }
    const T = 'https://iveo.example|tagung';
    const G = 'https://iveo.example|gala';
    const faelle = [
      { name: 'Admin', stand: { stufe: 'admin', tools: [], events: [] }, soll: 'gala,messe,tagung' },
      { name: 'Kollege', stand: { stufe: 'kollege', tools: [], events: [] }, soll: 'gala,messe,tagung' },
      { name: 'Externer mit iveo und zwei Events', stand: { stufe: 'externer', tools: ['iveo'], events: [T, G] }, soll: 'gala,tagung' },
      { name: 'Externer mit iveo, Event nicht hinterlegt', stand: { stufe: 'externer', tools: ['iveo'], events: ['https://iveo.example|fehlt'] }, soll: '' },
      { name: 'Externer ohne Werkzeug iveo', stand: { stufe: 'externer', tools: ['qa', 'connect-raum'], events: [T, G] }, soll: '' },
      { name: 'Externer, Event anderer Basis', stand: { stufe: 'externer', tools: ['iveo'], events: ['https://anders.example|tagung'] }, soll: '' },
      { name: 'unbekannte Stufe', stand: { stufe: 'chef', tools: ['iveo'], events: [T] }, soll: '' },
      { name: 'ohne Stand', stand: {}, soll: '' },
    ];
    await pruefeFaelle('P5 6.4: iveo-fuer nach Stufe, Werkzeug und Events aus den Claims', faelle, async (f) => {
      const r = await rufeDo(speicher, 'iveo-fuer', { jetzt: T0, ...f.stand });
      return gleich(r.events.map((e) => e.slug).join(','), f.soll);
    });
    const r = await rufeDo(speicher, 'iveo-fuer', { jetzt: T0, stufe: 'kollege', tools: [], events: [] });
    check(
      'P5 6.4: iveo-fuer liefert je Event key, basis, slug, name, iv und ct (verschlüsselt; entschlüsselt wird im Worker)',
      JSON.stringify(Object.keys(r.events[0])) === '["key","basis","slug","name","iv","ct"]' && r.events[0].iv === 'iv-gala' && r.events[0].ct === 'ct-gala',
    );
  }

  // ── P5: Zählung alter Schlüssel (OF2, OFP2) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    const z = (jetzt, gruppe, plattform, arch) => rufeDo(speicher, 'altkey-zaehlen', { jetzt, gruppe, plattform, arch, ip: '203.0.113.7' });
    await z(T0, 'katalog', 'win', 'x64');
    await z(T0 + MIN, 'katalog', 'win', 'x64');
    await z(T0 + 2 * MIN, 'qa', 'mac', 'arm64');
    await z(T0 + TAG, 'katalog', 'win', 'x64');
    await z(T0 + 3 * MIN, 'katalog', 'linux', 'ia32');
    const connect = await z(T0, 'connect', 'win', 'x64');
    const zeilen = [...(await ctx.storage.list({ prefix: 'altkey:' })).entries()];
    const soll = [
      ['altkey:2026-10-21:katalog:unbekannt-unbekannt', 1, T0 + 3 * MIN],
      ['altkey:2026-10-21:katalog:win-x64', 2, T0 + MIN],
      ['altkey:2026-10-21:qa:mac-arm64', 1, T0 + 2 * MIN],
      ['altkey:2026-10-22:katalog:win-x64', 1, T0 + TAG],
    ];
    check(
      'P5 OF2: Alt-Key-Zählung je Tag (UTC), Gruppe und Plattform-Architektur mit letzter Anfrage; Gruppe connect → 400 (gilt in Teil 1 unbefristet)',
      JSON.stringify(zeilen.map(([k, v]) => [k, v.anzahl, v.zuletzt])) === JSON.stringify(soll) && connect.http === 400 && connect.code === 'ungueltig',
    );
    check(
      'P5 OFP2: die Zählung speichert keine IP und keine Kennung eines Rechners (nur tag, gruppe, plattform, anzahl, zuletzt)',
      !JSON.stringify(zeilen).includes('203.0.113.7') && zeilen.every(([, v]) => Object.keys(v).join(',') === 'tag,gruppe,plattform,anzahl,zuletzt'),
    );
  }

  // ── P5: adminOffen nur für aktuelle Admins (Spec 7, EP15) ──
  {
    const { speicher } = neuerSpeicher({ ERSTER_ADMIN: ERSTE });
    const admin = await googleAnmelden(speicher, await testGeraet(), ERSTE, 'Clara Chefin');
    const kollege = await googleAnmelden(speicher, await testGeraet(), 'maria@jakobsmedien.com', 'Maria Schmidt');
    const zweiter = await googleAnmelden(speicher, await testGeraet(), 'jonas@jakobsmedien.com', 'Jonas Weber');
    const z = await speicher.ladeKonto(zweiter.kid);
    await speicher.speichereKonto({ ...z, stufe: 'admin' });
    await legeExternenAn(speicher, { passwort: 'richtiges-passwort' });
    const extGeraet = await testGeraet();
    await passwortAnmelden(speicher, extGeraet, { email: 'technik@firma.example', passwort: 'richtiges-passwort' });
    await rufeDo(speicher, 'zoom-anfragen', { jetzt: T0, kid: 'k-ext', gid: extGeraet.gid, zweck: 'Probe', von: T0 + TAG, bis: T0 + 2 * TAG });
    const offen = async (kid) => (await rufeDo(speicher, 'ich', { jetzt: T0 + MIN, kid })).adminOffen;
    const vorher = [await offen(admin.kid), await offen(zweiter.kid), await offen(kollege.kid), await offen('k-ext')];
    await speicher.speichereKonto({ ...(await speicher.ladeKonto(zweiter.kid)), stufe: 'kollege' });
    const herabgestuft = await offen(zweiter.kid);
    await speicher.speichereKonto({ ...(await speicher.ladeKonto(zweiter.kid)), stufe: 'admin', zustand: 'gesperrt' });
    const gesperrt = await offen(zweiter.kid);
    check(
      'P5 7: adminOffen zählt offene Anfragen nur für aktuelle, aktive Admins (erster Admin, ernannter Admin ja; Kollege, Externer, herabgestufter und gesperrter Admin 0)',
      JSON.stringify(vorher) === '[1,1,0,0]' && herabgestuft === 0 && gesperrt === 0,
    );
  }

  // ── P5 Review: Erneuern ohne Geheimes (Passwort-Konto), Gerät gehört dem Konto bei der Zoom-Anfrage, Erneuern liest das Gerät frisch ──
  {
    const { speicher, ctx, geraet, kid } = await angemeldeterExterner({});
    const r = await erneuern(speicher, geraet, kid, T0 + TAG);
    const gespeichert = ctx.daten.get(`konto:${kid}`);
    check(
      'P5 6.1 Review: Erneuern gibt das Konto ohne Passwort und Einladung heraus (Passwort-Konto, im DO liegt ein Passwort)',
      r.ok === true && !!gespeichert.passwort && !('passwort' in r.konto) && !('einladung' in r.konto) && r.konto.kid === kid,
    );
  }
  {
    const { speicher, ctx, geraet, kid } = await angemeldeterExterner({});
    await legeExternenAn(speicher, { kid: 'k-zwei', email: 'zwei@firma.example', passwort: 'richtiges-passwort' });
    await passwortAnmelden(speicher, geraet, { email: 'zwei@firma.example', passwort: 'richtiges-passwort' }, T0);
    const r = await rufeDo(speicher, 'zoom-anfragen', { jetzt: T0 + MIN, kid, gid: geraet.gid, zweck: 'Probe', von: T0 + TAG, bis: T0 + 2 * TAG });
    check(
      'P5 8 Review: Zoom-Anfrage von einem Gerät, das inzwischen einem anderen Konto gehört → 403 geraet-unbekannt, keine Anfrage abgelegt',
      r.http === 403 && r.code === 'geraet-unbekannt' && (await ctx.storage.list({ prefix: 'anfrage:' })).size === 0,
    );
  }
  {
    const { speicher, ctx, geraet, kid } = await angemeldeterExterner({});
    const key = `geraet:${geraet.gid}`;
    const get = ctx.storage.get.bind(ctx.storage);
    const put = ctx.storage.put.bind(ctx.storage);
    let n = 0;
    // Lese-Tor: das erste Lesen des Geräts liefert den alten Stand; ein anderer Schreiber setzt jm, bevor der Beweis fertig ist.
    ctx.storage.get = async (k) => {
      const w = await get(k);
      if (k === key && ++n === 1) {
        const alt = { ...w };
        await put(key, { ...w, jm: true });
        return alt;
      }
      return w;
    };
    const r = await erneuern(speicher, geraet, kid, T0 + TAG);
    const g = ctx.daten.get(key);
    check(
      'P5 6.1 Review: Erneuern liest das Gerät nach dem Beweis frisch (ein dazwischen gesetztes jm bleibt erhalten; letzter Kontakt und Version gesetzt)',
      r.ok === true && g.jm === true && g.letzterKontakt === T0 + TAG && g.version === '0.18.0' && r.geraet.jm === true,
    );
    const { speicher: s2, ctx: c2, geraet: g2, kid: k2 } = await angemeldeterExterner({});
    const key2 = `geraet:${g2.gid}`;
    const get2 = c2.storage.get.bind(c2.storage);
    const put2 = c2.storage.put.bind(c2.storage);
    let m = 0;
    c2.storage.get = async (k) => {
      const w = await get2(k);
      if (k === key2 && ++m === 1) {
        const alt = { ...w };
        await put2(key2, { ...w, letztesKonto: 'k-uebernommen' });
        return alt;
      }
      return w;
    };
    const r2 = await erneuern(s2, g2, k2, T0 + TAG);
    check(
      'P5 6.1 Review: wird das Gerät während des Beweises von einem anderen Konto übernommen → 403 geraet-unbekannt, Gerät unverändert',
      r2.http === 403 && r2.code === 'geraet-unbekannt' && c2.daten.get(key2).letztesKonto === 'k-uebernommen' && c2.daten.get(key2).letzterKontakt !== T0 + TAG,
    );
  }

  // ── P6: nur aktuelle Admins (Spec 7, OFP4: Stand im DO, nicht aus den Claims) ──
  {
    const { speicher, ctx, kid: erster } = await mitAdmin();
    await ctx.storage.put('geraet:g-1', { gid: 'g-1', name: 'Regie-PC 1', plattform: 'win', arch: 'x64', version: '0.18.0', jm: false, ersterKontakt: T0, letzterKontakt: T0, letztesKonto: null });
    const google = async (email, mehr) => {
      const { kid } = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0 - TAG, email, name: email.slice(0, email.indexOf('@')) });
      await speicher.speichereKonto({ ...(await speicher.ladeKonto(kid)), ...mehr });
      return kid;
    };
    const wer = {
      'erster Admin': erster,
      'ernannter Admin': await google('jonas@jakobsmedien.com', { stufe: 'admin' }),
      Kollege: await google('maria@jakobsmedien.com', {}),
      Externer: (await legeExternenAn(speicher, { passwort: 'richtiges-passwort' })).kid,
      'herabgestufter Admin (die Claims sagen noch admin)': await google('paul@jakobsmedien.com', { stufe: 'kollege' }),
      'gesperrter Admin': await google('gerd@jakobsmedien.com', { stufe: 'admin', zustand: 'gesperrt' }),
      'abgelaufener Admin': await google('abel@jakobsmedien.com', { stufe: 'admin', bis: T0 }),
      'unbekanntes Konto': 'k-gibts-nicht',
    };
    const darfDas = new Set(['erster Admin', 'ernannter Admin']);
    const faelle = ['admin-uebersicht', 'admin-aktion'].flatMap((aufruf) => Object.keys(wer).map((name) => ({ name: `${aufruf} · ${name}`, aufruf, konto: name })));
    await pruefeFaelle('P6 7: Admin-Maske und Admin-Aktionen nur für aktuelle Admins (Aufruf × Konto)', faelle, async (f) => {
      const r = await rufeDo(speicher, f.aufruf, { jetzt: T0, kid: wer[f.konto], aktion: { aktion: 'geraet-markieren', gid: 'g-1', jm: false } });
      return gleich([r.http, r.ok ? null : r.code], darfDas.has(f.konto) ? [200, null] : [403, 'kein-recht']);
    });
    const unbekannt = await rufeDo(speicher, 'admin-aktion', { jetzt: T0, kid: erster, aktion: { aktion: 'alles-loeschen' } });
    const ohne = await rufeDo(speicher, 'admin-aktion', { jetzt: T0, kid: erster });
    const proto = await rufeDo(speicher, 'admin-aktion', { jetzt: T0, kid: erster, aktion: { aktion: 'constructor' } });
    check('P6 10.5: unbekannte, fehlende oder geerbte Admin-Aktion → 400 ungueltig', [unbekannt, ohne, proto].every((r) => r.http === 400 && r.code === 'ungueltig'));
  }

  // ── P6: zugang-speichern (Spec 7, 4, 5; EP16, EP20) ──
  {
    const { speicher, aktion, kid: erster } = await mitAdmin();
    const S = testSchluessel();
    await aktion({ aktion: 'iveo-hinterlegen', basis: 'https://iveo.example', events: [await iveoEvent(S, 'tagung', 'Tagung', 'test-iveo-1')] });
    const g = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'maria@jakobsmedien.com', name: 'Maria Schmidt' });
    const gut = { aktion: 'zugang-speichern', kid: g.kid, stufe: 'externer', tools: ['qa', 'iveo', 'qa'], events: ['https://iveo.example|tagung'], bis: T0 + 10 * TAG, zoomBis: T0 + 2 * TAG };
    const r = await aktion(gut, T0 + MIN);
    const k = await speicher.ladeKonto(g.kid);
    check(
      'P6 7: zugang-speichern setzt Stufe, Werkzeuge (ohne Doppelte), Events, Zugang bis und Zoom-Freigabe; ein Google-Konto darf Externer werden',
      r.ok === true && k.stufe === 'externer' && JSON.stringify(k.tools) === '["qa","iveo"]' && JSON.stringify(k.events) === '["https://iveo.example|tagung"]' &&
        k.bis === T0 + 10 * TAG && k.zoomBis === T0 + 2 * TAG && k.art === 'google' && k.geaendert === T0 + MIN,
    );
    const faelle = [
      { name: 'Externer ohne bis', a: { ...gut, bis: null }, soll: [400, 'ungueltig'] },
      { name: 'unbekanntes Werkzeug', a: { ...gut, tools: ['zoom'] }, soll: [400, 'ungueltig'] },
      { name: 'nicht hinterlegtes Event', a: { ...gut, events: ['https://iveo.example|fehlt'] }, soll: [400, 'ungueltig'] },
      { name: 'unbekannte Stufe', a: { ...gut, stufe: 'chef' }, soll: [400, 'ungueltig'] },
      { name: 'bis als Text', a: { ...gut, bis: '2026-12-01' }, soll: [400, 'ungueltig'] },
      { name: 'Werkzeuge fehlen', a: { ...gut, tools: undefined }, soll: [400, 'ungueltig'] },
      { name: 'unbekannte Kennung', a: { ...gut, kid: 'k-gibts-nicht' }, soll: [404, 'vorgang-unbekannt'] },
      { name: 'erster Admin', a: { ...gut, kid: erster, stufe: 'admin', bis: null }, soll: [403, 'erster-admin'] },
    ];
    await pruefeFaelle('P6 7: zugang-speichern lehnt ab (Externer ohne bis, unbekanntes Werkzeug, nicht hinterlegtes Event, Stufe, Formen, Kennung, erster Admin)', faelle, async (f) => {
      const x = await aktion(f.a, T0 + 2 * MIN);
      return gleich([x.http, x.code], f.soll);
    });
  }
  {
    const { speicher, aktion, kid: a } = await mitAdmin({});
    const b = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'jonas@jakobsmedien.com', name: 'Jonas Weber' });
    await speicher.speichereKonto({ ...(await speicher.ladeKonto(b.kid)), stufe: 'admin' });
    const kollege = (kid, mehr = {}) => ({ aktion: 'zugang-speichern', kid, stufe: 'kollege', tools: [], events: [], bis: null, zoomBis: null, ...mehr });
    const bHerab = await aktion(kollege(b.kid), T0 + MIN);
    const selbstHerab = await aktion(kollege(a, {}), T0 + 2 * MIN);
    const selbstAblauf = await aktion(kollege(a, { stufe: 'admin', bis: T0 + 2 * MIN }), T0 + 2 * MIN);
    const selbstLoeschen = await aktion({ aktion: 'zugang-loeschen', kid: a }, T0 + 2 * MIN);
    const selbstVerlaengern = await aktion(kollege(a, { stufe: 'admin', bis: T0 + 300 * TAG }), T0 + 3 * MIN);
    check(
      'P6 9: ohne ERSTER_ADMIN lässt sich der letzte aktive Admin weder herabstufen noch ablaufen lassen noch löschen (409 konflikt); solange ein zweiter da ist, geht es',
      bHerab.ok === true && selbstHerab.http === 409 && selbstHerab.code === 'konflikt' && selbstAblauf.code === 'konflikt' &&
        selbstLoeschen.code === 'konflikt' && selbstVerlaengern.ok === true && (await speicher.ladeKonto(a)).stufe === 'admin',
    );
  }

  // ── P6: einladen und neuer Code (Spec 4, EP4) ──
  {
    const { speicher, ctx, aktion } = await mitAdmin();
    const r = await aktion({ aktion: 'einladen', email: ' Tom@Firma.example ', name: 'Tom Technik', tools: ['qa'], events: [], bis: T0 + 30 * TAG }, T0);
    const k = await speicher.kontoPerEmail('tom@firma.example');
    const roh = JSON.stringify([...ctx.daten.values()]);
    check(
      'P6 4: einladen legt einen Externen an; Einladungscode XXXX-XXXX-XXXX nur in der Antwort, gespeichert nur als Hash, gilt 72 h',
      r.ok === true && /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/.test(r.einladungscode) && r.codeBis === T0 + 72 * 3600_000 &&
        k.stufe === 'externer' && k.art === 'passwort' && k.zustand === 'aktiv' && k.bis === T0 + 30 * TAG && JSON.stringify(k.tools) === '["qa"]' &&
        k.einladung.hash === (await sha256B64url(r.einladungscode.replace(/-/g, ''))) && k.einladung.bis === r.codeBis &&
        !roh.includes(r.einladungscode) && !roh.includes(r.einladungscode.replace(/-/g, '')) && !('passwort' in k),
    );
    const geraet = await testGeraet();
    const erst = await passwortAnmelden(speicher, geraet, { email: 'tom@firma.example', einladungscode: r.einladungscode, neu: 'langes-passwort-1' }, T0 + MIN);
    check(
      'P6 4.1: mit dem Einladungscode setzt der Externe sein Passwort und ist angemeldet',
      erst.abgeholt?.zustand === 'bestaetigt' && erst.abgeholt?.konto?.stufe === 'externer' && erst.abgeholt?.konto?.email === 'tom@firma.example',
    );
    const basis = { aktion: 'einladen', email: 'anna@firma.example', name: 'Anna Extern', tools: ['qa'], events: [], bis: T0 + 30 * TAG };
    const faelle = [
      { name: 'E-Mail vergeben', a: { ...basis, email: 'TOM@firma.example' }, soll: [409, 'konflikt'] },
      { name: 'jakobsmedien.com', a: { ...basis, email: 'neu@jakobsmedien.com' }, soll: [400, 'domain'] },
      { name: 'E-Mail ohne @', a: { ...basis, email: 'anna.firma.example' }, soll: [400, 'ungueltig'] },
      { name: 'ohne Name', a: { ...basis, name: '  ' }, soll: [400, 'ungueltig'] },
      { name: 'ohne bis', a: { ...basis, bis: undefined }, soll: [400, 'ungueltig'] },
      { name: 'bis vorbei', a: { ...basis, bis: T0 - 1 }, soll: [400, 'ungueltig'] },
      { name: 'unbekanntes Werkzeug', a: { ...basis, tools: ['zoom'] }, soll: [400, 'ungueltig'] },
    ];
    await pruefeFaelle('P6 4: einladen lehnt ab (E-Mail vergeben, jakobsmedien.com, ungültige E-Mail, ohne Name, ohne oder vergangenes bis, Werkzeug)', faelle, async (f) => {
      const x = await aktion(f.a, T0);
      return gleich([x.http, x.code, x.einladungscode], [...f.soll, undefined]);
    });
  }
  {
    const { speicher, aktion } = await mitAdmin();
    await legeExternenAn(speicher, { passwort: 'altes-passwort-1' });
    const geraet = await testGeraet();
    const vorher = await passwortAnmelden(speicher, geraet, { email: 'technik@firma.example', passwort: 'altes-passwort-1' });
    const r = await aktion({ aktion: 'neuer-code', kid: 'k-ext' }, T0 + MIN);
    const alt = await passwortAnmelden(speicher, geraet, { email: 'technik@firma.example', passwort: 'altes-passwort-1' }, T0 + 2 * MIN);
    const neu = await passwortAnmelden(speicher, geraet, { email: 'technik@firma.example', einladungscode: r.einladungscode, neu: 'neues-passwort-1' }, T0 + 3 * MIN);
    const g = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'maria@jakobsmedien.com', name: 'Maria Schmidt' });
    const google = await aktion({ aktion: 'neuer-code', kid: g.kid }, T0);
    check(
      'P6 4: neuer-code macht das alte Passwort ungültig (Anmeldung danach falsch), der neue Code setzt ein neues; Google-Konto → 400 ungueltig',
      vorher.abgeholt.zustand === 'bestaetigt' && r.ok === true && r.codeBis === T0 + MIN + 72 * 3600_000 && alt.passwort.code === 'falsch' &&
        neu.abgeholt?.zustand === 'bestaetigt' && google.http === 400 && google.code === 'ungueltig',
    );
  }

  // ── P6: iveo hinterlegen, ersetzen, entfernen (Spec 6.4, 7; EP13) ──
  {
    const { speicher, ctx, aktion, uebersicht } = await mitAdmin();
    const S = testSchluessel();
    const r = await aktion({ aktion: 'iveo-hinterlegen', basis: ' app.my-iveo.de/api/v1/ ', events: [await iveoEvent(S, 'tagung', 'Tagung 2026', 'test-iveo-token-a', ' app.my-iveo.de/api/v1/ '), await iveoEvent(S, 'gala', '', 'test-iveo-token-b', ' app.my-iveo.de/api/v1/ ')] }, T0);
    const roh = JSON.stringify([...ctx.daten.values()]);
    const u = await uebersicht(T0);
    const fuer = await rufeDo(speicher, 'iveo-fuer', { jetzt: T0, stufe: 'kollege', tools: [], events: [] });
    const klar = await Promise.all(fuer.events.map((e) => iveoEntschluesseln(S, e, e.key)));
    check(
      'P6 6.4: iveo hinterlegen: Schlüssel <normalisierte Basis>|<slug>, Name (sonst slug), von = Admin, kein Klartext im Speicher; iveo-fuer liefert iv/ct, die der Worker entschlüsselt',
      r.ok === true && JSON.stringify(u.iveo.map((e) => e.key)) === '["https://app.my-iveo.de/api/v1|gala","https://app.my-iveo.de/api/v1|tagung"]' &&
        u.iveo[0].name === 'gala' && u.iveo[1].name === 'Tagung 2026' && u.iveo[0].von === ERSTE && u.iveo[0].am === T0 && !roh.includes('test-iveo-token') &&
        JSON.stringify(klar) === '["test-iveo-token-b","test-iveo-token-a"]',
    );
    check(
      'P6 6.4: die Übersicht gibt nie iv oder ct heraus (je Event nur key, basis, slug, name, am, von)',
      u.iveo.every((e) => Object.keys(e).join(',') === 'key,basis,slug,name,am,von') && fuer.events.every((e) => !JSON.stringify(u).includes(e.ct) && !JSON.stringify(u).includes(e.iv)),
    );
    const ersetzt = await aktion({ aktion: 'iveo-hinterlegen', basis: 'https://app.my-iveo.de/api/v1', events: [await iveoEvent(S, 'gala', 'Gala', 'test-iveo-token-c', 'https://app.my-iveo.de/api/v1')] }, T0 + MIN);
    const nachErsetzen = await rufeDo(speicher, 'iveo-fuer', { jetzt: T0 + MIN, stufe: 'admin', tools: [], events: [] });
    const gala = nachErsetzen.events.find((e) => e.slug === 'gala');
    const weg = await aktion({ aktion: 'iveo-entfernen', key: 'https://app.my-iveo.de/api/v1|tagung' }, T0 + 2 * MIN);
    const nochmal = await aktion({ aktion: 'iveo-entfernen', key: 'https://app.my-iveo.de/api/v1|tagung' }, T0 + 2 * MIN);
    const danach = await uebersicht(T0 + 3 * MIN);
    check(
      'P6 6.4: ersetzen (gleicher Schlüssel, neues Token, neues am) und entfernen; unbekannter Schlüssel → 404',
      ersetzt.ok === true && (await iveoEntschluesseln(S, gala, gala.key)) === 'test-iveo-token-c' && nachErsetzen.events.length === 2 && weg.ok === true &&
        nochmal.http === 404 && nochmal.code === 'vorgang-unbekannt' && JSON.stringify(danach.iveo.map((e) => [e.slug, e.name, e.am])) === JSON.stringify([['gala', 'Gala', T0 + MIN]]),
    );
    const klartext = 'test-iveo-klartext';
    const gut = { aktion: 'iveo-hinterlegen', basis: 'https://iveo.example', events: [{ slug: 'x', name: 'X', iv: 'aaaa', ct: 'bbbb' }] };
    const faelle = [
      { name: 'Basis leer', a: { ...gut, basis: '  ' } },
      { name: 'Basis ohne Host', a: { ...gut, basis: 'https://' } },
      { name: 'Basis mit |', a: { ...gut, basis: 'https://a.example|x' } },
      { name: 'keine Events', a: { ...gut, events: [] } },
      { name: 'Slug mit |', a: { ...gut, events: [{ slug: 'a|b', iv: 'aaaa', ct: 'bbbb' }] } },
      { name: 'Slug leer', a: { ...gut, events: [{ slug: ' ', iv: 'aaaa', ct: 'bbbb' }] } },
      { name: 'ohne ct', a: { ...gut, events: [{ slug: 'x', iv: 'aaaa' }] } },
      { name: 'Klartext-Token statt iv/ct', a: { ...gut, events: [{ slug: 'x', token: klartext }] } },
    ];
    await pruefeFaelle('P6 6.4: iveo-hinterlegen lehnt ab (Basis, Events, Slug, ohne iv/ct; ein Klartext-Token nimmt der DO nie an)', faelle, async (f) => {
      const x = await aktion(f.a, T0);
      return gleich([x.http, x.code], [400, 'ungueltig']);
    });
    check('P6 6.4: nach den abgelehnten Fällen liegt kein Klartext und kein neues Event im Speicher', !JSON.stringify([...ctx.daten.values()]).includes(klartext) && !ctx.daten.has('iveo:https://iveo.example|x'));
  }

  // ── P6: Zoom-Anfrage freigeben und ablehnen, Gerät als JM-Rechner markieren (Spec 8, 7; OF4) ──
  {
    const { speicher, aktion, uebersicht, kid: adminKid } = await mitAdmin();
    await legeExternenAn(speicher, { passwort: 'richtiges-passwort' });
    const geraet = await testGeraet({ name: 'Laptop Tom' });
    await passwortAnmelden(speicher, geraet, { email: 'technik@firma.example', passwort: 'richtiges-passwort' });
    const anfragen = (jetzt) => rufeDo(speicher, 'zoom-anfragen', { jetzt, kid: 'k-ext', gid: geraet.gid, zweck: 'Tagung Berlin', von: T0 + TAG, bis: T0 + 3 * TAG });
    const punkt = async (jetzt) => (await rufeDo(speicher, 'ich', { jetzt, kid: adminKid })).adminOffen;
    const a1 = await anfragen(T0);
    const punktOffen = await punkt(T0);
    const frei = await aktion({ aktion: 'anfrage-freigeben', id: a1.anfrage.id, bis: T0 + 5 * TAG }, T0 + MIN);
    const punktFrei = await punkt(T0 + MIN);
    const ich1 = await rufeDo(speicher, 'ich', { jetzt: T0 + 2 * MIN, kid: 'k-ext' });
    const start1 = await erneuern(speicher, geraet, 'k-ext', T0 + 2 * MIN, { rechnerName: 'Laptop Tom' });
    const stand1 = kontoStand(start1.konto, start1.geraet, T0 + 2 * MIN, ERSTE);
    const markiert = await aktion({ aktion: 'geraet-markieren', gid: geraet.gid, jm: true }, T0 + 3 * MIN);
    const start2 = await erneuern(speicher, geraet, 'k-ext', T0 + 4 * MIN, { rechnerName: 'Laptop Tom' });
    const stand2 = kontoStand(start2.konto, start2.geraet, T0 + 4 * MIN, ERSTE);
    const doppelt = await aktion({ aktion: 'anfrage-freigeben', id: a1.anfrage.id, bis: T0 + 6 * TAG }, T0 + 4 * MIN);
    check(
      'P6 8: anfrage-freigeben setzt zoomBis und schließt die Anfrage; ich zeigt „freigegeben bis“; Zoom wirkt nach dem nächsten Start erst auf einem JM-Rechner (OF4); schon entschieden → 400',
      frei.ok === true && JSON.stringify(ich1.zoomAnfrage) === JSON.stringify({ id: a1.anfrage.id, zustand: 'freigegeben', zweck: 'Tagung Berlin', von: T0 + TAG, bis: T0 + 5 * TAG, am: T0 + MIN }) &&
        stand1.zoom === true && stand1.jm === false && darf(stand1, 'zoom', { jetzt: T0 + 2 * MIN }) === false && markiert.ok === true &&
        stand2.jm === true && darf(stand2, 'zoom', { jetzt: T0 + 4 * MIN }) === true && doppelt.http === 400 && doppelt.code === 'ungueltig',
    );
    const a2 = await anfragen(T0 + 5 * MIN);
    const punktNeu = await punkt(T0 + 5 * MIN);
    const ab = await aktion({ aktion: 'anfrage-ablehnen', id: a2.anfrage.id }, T0 + 6 * MIN);
    const punktAb = await punkt(T0 + 6 * MIN);
    check(
      'P6 7, EP15: der Punkt am Zahnrad folgt den Entscheidungen (adminOffen des Admins: offen 1, nach Freigeben 0, neue Anfrage 1, nach Ablehnen 0)',
      JSON.stringify([punktOffen, punktFrei, punktNeu, punktAb]) === '[1,0,1,0]',
    );
    const ich2 = await rufeDo(speicher, 'ich', { jetzt: T0 + 7 * MIN, kid: 'k-ext' });
    const u = await uebersicht(T0 + 7 * MIN);
    check(
      'P6 8: anfrage-ablehnen schließt die Anfrage; ich zeigt „abgelehnt am“; die Übersicht nennt Name, E-Mail, Zweck, Zeitraum, Rechner und JM (jüngste zuerst)',
      a2.ok === true && ab.ok === true && ich2.zoomAnfrage.zustand === 'abgelehnt' && ich2.zoomAnfrage.am === T0 + 6 * MIN &&
        JSON.stringify(u.anfragen.map((a) => [a.zustand, a.name, a.email, a.zweck, a.von, a.bis, a.rechnerName, a.jm, a.plattform])) ===
          JSON.stringify([
            ['abgelehnt', 'Tom Technik', 'technik@firma.example', 'Tagung Berlin', T0 + TAG, T0 + 3 * TAG, 'Laptop Tom', true, 'win'],
            ['freigegeben', 'Tom Technik', 'technik@firma.example', 'Tagung Berlin', T0 + TAG, T0 + 3 * TAG, 'Laptop Tom', true, 'win'],
          ]),
    );
    const a3 = await anfragen(T0 + 7 * MIN);
    const faelle = [
      { name: 'unbekannte Anfrage', a: { aktion: 'anfrage-freigeben', id: 'gibts-nicht', bis: T0 + TAG }, soll: [404, 'vorgang-unbekannt'] },
      { name: 'freigeben bis vorbei', a: { aktion: 'anfrage-freigeben', id: a3.anfrage.id, bis: T0 }, soll: [400, 'ungueltig'] },
      { name: 'ablehnen schon entschieden', a: { aktion: 'anfrage-ablehnen', id: a2.anfrage.id }, soll: [400, 'ungueltig'] },
      { name: 'unbekanntes Gerät', a: { aktion: 'geraet-markieren', gid: 'gibts-nicht', jm: true }, soll: [404, 'vorgang-unbekannt'] },
      { name: 'jm als Text', a: { aktion: 'geraet-markieren', gid: geraet.gid, jm: 'ja' }, soll: [400, 'ungueltig'] },
    ];
    await pruefeFaelle('P6 8: Anfragen und Geräte lehnen ab (unbekannt, vergangen, schon entschieden, jm kein Wahrheitswert)', faelle, async (f) => {
      const x = await aktion(f.a, T0 + 8 * MIN);
      return gleich([x.http, x.code], f.soll);
    });
  }

  // ── P6: jede Admin-Aktion genau ein Protokolleintrag (Spec 9, EP19, OF3) ──
  {
    const S = testSchluessel();
    const vorbereitet = async () => {
      const m = await mitAdmin();
      await legeExternenAn(m.speicher, { passwort: 'richtiges-passwort' });
      const geraet = await testGeraet({ name: 'Laptop Tom' });
      await passwortAnmelden(m.speicher, geraet, { email: 'technik@firma.example', passwort: 'richtiges-passwort' });
      const a = await rufeDo(m.speicher, 'zoom-anfragen', { jetzt: T0, kid: 'k-ext', gid: geraet.gid, zweck: 'Probe', von: T0 + TAG, bis: T0 + 2 * TAG });
      const maria = await rufeDo(m.speicher, 'konto-aus-google', { jetzt: T0, email: 'maria@jakobsmedien.com', name: 'Maria Schmidt' });
      const gerd = await rufeDo(m.speicher, 'konto-aus-google', { jetzt: T0, email: 'gerd@jakobsmedien.com', name: 'Gerd G' });
      await m.speicher.speichereKonto({ ...(await m.speicher.ladeKonto(gerd.kid)), zustand: 'gesperrt' });
      await m.aktion({ aktion: 'iveo-hinterlegen', basis: 'https://iveo.example', events: [await iveoEvent(S, 'tagung', 'Tagung', 'test-iveo-1')] });
      return { ...m, geraet, anfrage: a.anfrage.id, maria: maria.kid, gerd: gerd.kid };
    };
    const faelle = [
      { name: 'zugang-speichern', a: () => ({ aktion: 'zugang-speichern', kid: 'k-ext', stufe: 'externer', tools: ['qa'], events: [], bis: T0 + TAG, zoomBis: null }), was: 'zugang-speichern', wen: 'technik@firma.example' },
      { name: 'einladen', a: () => ({ aktion: 'einladen', email: 'neu@firma.example', name: 'Neu N', tools: [], events: [], bis: T0 + TAG }), was: 'einladen', wen: 'neu@firma.example' },
      { name: 'neuer-code', a: () => ({ aktion: 'neuer-code', kid: 'k-ext' }), was: 'neuer-code', wen: 'technik@firma.example' },
      { name: 'zugang-loeschen (Externer)', a: () => ({ aktion: 'zugang-loeschen', kid: 'k-ext' }), was: 'zugang-geloescht', wen: 'technik@firma.example' },
      { name: 'zugang-loeschen (Google)', a: (v) => ({ aktion: 'zugang-loeschen', kid: v.maria }), was: 'zugang-gesperrt', wen: 'maria@jakobsmedien.com' },
      { name: 'entsperren', a: (v) => ({ aktion: 'entsperren', kid: v.gerd }), was: 'zugang-entsperrt', wen: 'gerd@jakobsmedien.com' },
      { name: 'iveo-hinterlegen', a: async () => ({ aktion: 'iveo-hinterlegen', basis: 'https://iveo.example', events: [await iveoEvent(S, 'gala', 'Gala', 'test-iveo-2')] }), was: 'iveo-hinterlegen', wen: 'https://iveo.example' },
      { name: 'iveo-entfernen', a: () => ({ aktion: 'iveo-entfernen', key: 'https://iveo.example|tagung' }), was: 'iveo-entfernen', wen: 'https://iveo.example' },
      { name: 'anfrage-freigeben', a: (v) => ({ aktion: 'anfrage-freigeben', id: v.anfrage, bis: T0 + 3 * TAG }), was: 'anfrage-freigeben', wen: 'technik@firma.example' },
      { name: 'anfrage-ablehnen', a: (v) => ({ aktion: 'anfrage-ablehnen', id: v.anfrage }), was: 'anfrage-ablehnen', wen: 'technik@firma.example' },
      { name: 'geraet-markieren', a: (v) => ({ aktion: 'geraet-markieren', gid: v.geraet.gid, jm: true }), was: 'geraet-markieren', wen: 'Laptop Tom' },
      { name: 'abgelehnt: ungültig', a: () => ({ aktion: 'zugang-speichern', kid: 'k-ext', stufe: 'chef', tools: [], events: [], bis: null, zoomBis: null }), was: null },
      { name: 'abgelehnt: kein Admin', a: () => ({ aktion: 'geraet-markieren', gid: 'x', jm: true }), von: 'k-ext', was: null },
    ];
    await pruefeFaelle('P6 9: jede gelungene Admin-Aktion genau ein Protokolleintrag mit wer = Admin, was, wen; abgelehnte keiner; nie Code, Hash, iv oder ct', faelle, async (f) => {
      const v = await vorbereitet();
      const vorher = await protokoll(v.ctx);
      const r = await v.aktion(await f.a(v), T0 + MIN, f.von ?? v.kid);
      const neu = (await protokoll(v.ctx)).slice(vorher.length);
      const roh = JSON.stringify(neu);
      const geheim = [r.einladungscode, r.einladungscode && r.einladungscode.replace(/-/g, ''), 'pbkdf2', '"iv"', '"ct"', 'hash'].filter(Boolean);
      const ist = [neu.length, neu[0] ? neu[0].wer : null, neu[0] ? neu[0].was : null, neu[0] ? neu[0].wen : null, geheim.filter((g) => roh.includes(g))];
      const soll = f.was ? [1, ERSTE, f.was, f.wen, []] : [0, null, null, null, []];
      return gleich(ist, soll);
    });
  }

  // ── P6: Übersicht (Spec 7, OF2, M44; EP15) ──
  {
    const { speicher, ctx, aktion, uebersicht, kid: erster } = await mitAdmin({ ERSTER_ADMIN: ERSTE, ALTKEY_BIS: '2026-11-20' });
    await legeExternenAn(speicher, { kid: 'k-alt', email: 'alt@firma.example', name: 'Zora Alt', passwort: 'richtiges-passwort', bis: T0 - TAG });
    const einl = await aktion({ aktion: 'einladen', email: 'neu@firma.example', name: 'Nora Neu', tools: [], events: [], bis: T0 + 10 * TAG }, T0);
    const g = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'bernd@jakobsmedien.com', name: 'Bernd Gesperrt' });
    await aktion({ aktion: 'zugang-loeschen', kid: g.kid }, T0);
    const geraet = await testGeraet({ name: 'Regie-PC 9' });
    await googleAnmelden(speicher, geraet, 'maria@jakobsmedien.com', 'Maria Schmidt', T0 + MIN);
    await rufeDo(speicher, 'altkey-zaehlen', { jetzt: T0 - TAG, gruppe: 'katalog', plattform: 'win', arch: 'x64' });
    await rufeDo(speicher, 'altkey-zaehlen', { jetzt: T0, gruppe: 'qa', plattform: 'mac', arch: 'arm64' });
    const u = await uebersicht(T0 + 2 * MIN);
    const z = (email) => u.zugaenge.find((x) => x.email === email);
    check(
      'P6 7: Übersicht: alle Zugänge nach Name (abgelaufene und gesperrte sichtbar, Einladung offen mit Frist, erster Admin markiert, letzte Anmeldung)',
      u.ok === true && JSON.stringify(u.zugaenge.map((x) => x.name)) === '["Bernd Gesperrt","Clara Chefin","Maria Schmidt","Nora Neu","Zora Alt"]' &&
        z('alt@firma.example').bis === T0 - TAG && z('bernd@jakobsmedien.com').zustand === 'gesperrt' && z('neu@firma.example').einladungBis === einl.codeBis &&
        z(ERSTE).ersterAdmin === true && z(ERSTE).stufe === 'admin' && z('maria@jakobsmedien.com').ersterAdmin === false &&
        z('maria@jakobsmedien.com').letzteAnmeldung === T0 + MIN && z(ERSTE).kid === erster &&
        u.zugaenge.every((x) => Object.keys(x).join(',') === 'kid,email,name,art,stufe,zustand,tools,events,bis,zoomBis,einladungBis,letzteAnmeldung,ersterAdmin'),
    );
    check(
      'P6 OF2: Übersicht: Geräte ohne Schlüssel mit letztem Konto; alter Schlüssel mit Frist aus ALTKEY_BIS und den Zeilen der Zählung (jüngster Tag zuerst)',
      JSON.stringify(u.geraete.map((x) => [x.name, x.jm, x.letztesKonto === z('maria@jakobsmedien.com').kid, x.letzterKontakt])) === JSON.stringify([['Regie-PC 9', false, true, T0 + MIN]]) &&
        u.geraete.every((x) => Object.keys(x).join(',') === 'gid,name,plattform,arch,version,jm,ersterKontakt,letzterKontakt,letztesKonto') &&
        JSON.stringify(u.altKey) === JSON.stringify({ bis: '2026-11-20T00:00:00.000Z', diagnose: null, zeilen: [
          { tag: '2026-10-21', gruppe: 'qa', plattform: 'mac-arm64', anzahl: 1, zuletzt: T0 },
          { tag: '2026-10-20', gruppe: 'katalog', plattform: 'win-x64', anzahl: 1, zuletzt: T0 - TAG },
        ] }),
    );
    const roh = JSON.stringify(u);
    const gespeichert = [...ctx.daten.values()].filter((x) => x && x.einladung).map((x) => x.einladung.hash);
    check(
      'P6 OF3: Übersicht ohne Passwort-Hash, Einladungs-Hash, Geräteschlüssel und Einladungscode',
      !roh.includes('pbkdf2') && gespeichert.length === 1 && !roh.includes(gespeichert[0]) && !roh.includes('publicJwk') && !roh.includes('"kty"') &&
        !roh.includes(einl.einladungscode),
    );
    const diag = async (env) => (await (await mitAdmin({ ERSTER_ADMIN: ERSTE, ...env })).uebersicht(T0)).altKey;
    const ohne = await diag({});
    const unlesbar = await diag({ ALTKEY_BIS: 'bald' });
    const vorbei = await diag({ ALTKEY_BIS: '2026-10-01' });
    check(
      'P6 M44: Diagnose des alten Schlüssels in der Übersicht (ohne ALTKEY_BIS → ohne-ende, unlesbar → unlesbar, Datum → bis)',
      JSON.stringify([ohne.bis, ohne.diagnose, unlesbar.bis, unlesbar.diagnose, vorbei.bis, vorbei.diagnose]) ===
        JSON.stringify([null, 'ohne-ende', null, 'unlesbar', '2026-10-01T00:00:00.000Z', null]),
    );
  }

  // ── P6 Review: neuer Code (Hash, Bremse) und iveo-entfernen nimmt das Event aus den Zugängen ──
  {
    const { speicher, ctx, aktion } = await mitAdmin();
    await legeExternenAn(speicher, { passwort: 'richtiges-passwort' });
    await ctx.storage.put('fehl:k-ext', { anzahl: 3, bisMs: null });
    const r = await aktion({ aktion: 'neuer-code', kid: 'k-ext' }, T0 + MIN);
    const k = await speicher.ladeKonto('k-ext');
    const roh = JSON.stringify([...ctx.daten.values()]);
    check(
      'P6 4: neuer-code speichert den Code nur als Hash (Rohspeicher ohne Klartext, einladung.hash = SHA-256 der normalisierten Form)',
      r.ok === true && !roh.includes(r.einladungscode) && !roh.includes(r.einladungscode.replace(/-/g, '')) &&
        k.einladung.hash === (await sha256B64url(r.einladungscode.replace(/-/g, ''))) && !('code' in k.einladung),
    );
    check('P6 4: neuer-code löscht die Bremse des Kontos', !ctx.daten.has('fehl:k-ext'));
  }
  {
    const { speicher, aktion } = await mitAdmin();
    const S = testSchluessel();
    await aktion({ aktion: 'iveo-hinterlegen', basis: 'https://iveo.example', events: [await iveoEvent(S, 'tagung', 'Tagung', 'test-iveo-1'), await iveoEvent(S, 'gala', 'Gala', 'test-iveo-2')] });
    const ev = ['https://iveo.example|tagung', 'https://iveo.example|gala'];
    await legeExternenAn(speicher, { passwort: 'richtiges-passwort', bis: T0 + 10 * TAG });
    const zugang = (events, bis) => ({ aktion: 'zugang-speichern', kid: 'k-ext', stufe: 'externer', tools: ['qa'], events, bis, zoomBis: null });
    await aktion(zugang(ev, T0 + 10 * TAG), T0);
    const weg = await aktion({ aktion: 'iveo-entfernen', key: ev[0] }, T0 + MIN);
    const nach = await speicher.ladeKonto('k-ext');
    const verlaengert = await aktion(zugang(nach.events, T0 + 20 * TAG), T0 + 2 * MIN);
    check(
      'P6 7, 6.4: iveo-entfernen nimmt das Event aus den Zugängen; der Externe lässt sich mit seinen übrigen Events speichern und verlängern',
      weg.ok === true && JSON.stringify(nach.events) === JSON.stringify([ev[1]]) && verlaengert.ok === true && (await speicher.ladeKonto('k-ext')).bis === T0 + 20 * TAG,
    );
    await aktion({ aktion: 'iveo-hinterlegen', basis: 'https://iveo.example', events: [await iveoEvent(S, 'tagung', 'Tagung neu', 'test-iveo-3')] }, T0 + 3 * MIN);
    check(
      'P6 7, 6.4: wird dasselbe Event neu hinterlegt, bekommt der Externe dadurch keinen Zugang zurück',
      JSON.stringify((await speicher.ladeKonto('k-ext')).events) === JSON.stringify([ev[1]]),
    );
  }

  {
    const { speicher, ctx, aktion } = await mitAdmin();
    const S = testSchluessel();
    await aktion({ aktion: 'iveo-hinterlegen', basis: 'https://iveo.example', events: [await iveoEvent(S, 'tagung', 'Tagung', 'test-iveo-1'), await iveoEvent(S, 'gala', 'Gala', 'test-iveo-2')] });
    const key = 'https://iveo.example|tagung';
    const gala = 'https://iveo.example|gala';
    for (let i = 0; i < 140; i++) {
      const kid = `k-${String(i).padStart(3, '0')}`;
      const events = i === 5 || i === 138 ? [key, gala] : i === 6 ? [gala] : [];
      await ctx.storage.put(`konto:${kid}`, { kid, email: `x${i}@firma.example`, name: `X ${i}`, art: 'passwort', stufe: 'externer', zustand: 'aktiv', tools: [], events, bis: T0 + TAG, zoomBis: null, erstellt: T0, geaendert: T0 });
    }
    const vorher = new Map([...ctx.daten].filter(([x]) => x.startsWith('konto:k-')).map(([x, k]) => [x, JSON.stringify(k)]));
    const weg = await aktion({ aktion: 'iveo-entfernen', key }, T0 + MIN);
    const hat = [...ctx.daten].filter(([x, k]) => x.startsWith('konto:') && Array.isArray(k.events) && k.events.includes(key)).length;
    const geaendert = [...ctx.daten].filter(([x, k]) => x.startsWith('konto:k-') && JSON.stringify(k) !== vorher.get(x)).map(([x]) => x).sort();
    check(
      'P6 7, 6.4: iveo-entfernen bereinigt auch Konten hinter der ersten Seite (140 Konten, Event bei Konto 5 und 138); die übrigen Konten bleiben unverändert',
      weg.ok === true && hat === 0 && JSON.stringify(geaendert) === '["konto:k-005","konto:k-138"]' &&
        JSON.stringify(ctx.daten.get('konto:k-138').events) === JSON.stringify([gala]) && !ctx.daten.has(`iveo:${key}`),
    );
  }

  // ── Z1-W1: Härtung des Konten-DO (Nachrunde vor dem Deploy) ──
  {
    // speichereKonto: Konto und E-Mail-Index mit einem put (Objekt).
    const { speicher, ctx } = neuerSpeicher({});
    const puts = [];
    const put = ctx.storage.put.bind(ctx.storage);
    ctx.storage.put = async (k, v) => {
      puts.push(k);
      return put(k, v);
    };
    await speicher.speichereKonto({ kid: 'k-at', email: 'at@firma.example', name: 'At', art: 'passwort', stufe: 'externer', zustand: 'aktiv', tools: [], events: [], bis: T0 + TAG });
    check(
      'Z1-W1: speichereKonto schreibt Konto und E-Mail-Index mit EINEM put (Objekt), nicht in zwei Schritten',
      puts.length === 1 && puts[0] !== null && typeof puts[0] === 'object' && Object.keys(puts[0]).sort().join(',') === 'email:at@firma.example,konto:k-at' &&
        ctx.daten.get('email:at@firma.example') === 'k-at' && ctx.daten.get('konto:k-at').kid === 'k-at',
    );
  }
  {
    // protokolliere prüft die Eingaben.
    const { speicher, ctx } = neuerSpeicher({});
    const schlecht = [
      { am: NaN, wer: 'x', was: 'y' },
      { am: Infinity, wer: 'x', was: 'y' },
      { am: String(T0), wer: 'x', was: 'y' },
      { am: T0, wer: '', was: 'y' },
      { am: T0, wer: undefined, was: 'y' },
      { am: T0, wer: 'x', was: '' },
    ];
    let wirft = 0;
    for (const e of schlecht) {
      try {
        await speicher.protokolliere(e);
      } catch {
        wirft++;
      }
    }
    const vorher = (await protokoll(ctx)).length;
    await speicher.protokolliere({ am: T0, wer: ERSTE, was: 'probe', wen: 'x', details: {} });
    check('Z1-W1: protokolliere wirft bei am nicht endlich oder wer/was leer oder keine Zeichenkette (6 Fälle), schreibt dann nichts; ein gültiger Eintrag geht', wirft === 6 && vorher === 0 && (await protokoll(ctx)).length === 1);
  }
  {
    // entsperren wirkt nur aus „gesperrt“.
    const m = await mitAdmin();
    const k = await rufeDo(m.speicher, 'konto-aus-google', { jetzt: T0, email: 'maria@jakobsmedien.com', name: 'Maria' });
    const aktivEntsperren = await m.aktion({ aktion: 'entsperren', kid: k.kid });
    const logNachAktiv = (await protokoll(m.ctx)).filter((e) => e.was === 'zugang-entsperrt').length;
    await m.aktion({ aktion: 'zugang-loeschen', kid: k.kid }, T0 + MIN);
    const gesperrt = (await m.speicher.ladeKonto(k.kid)).zustand;
    const entsperrt = await m.aktion({ aktion: 'entsperren', kid: k.kid }, T0 + 2 * MIN);
    const nochmal = await m.aktion({ aktion: 'entsperren', kid: k.kid }, T0 + 3 * MIN);
    const unbekannt = await m.aktion({ aktion: 'entsperren', kid: 'k-gibts-nicht' }, T0 + 3 * MIN);
    check(
      'Z1-W1: entsperren wirkt nur aus gesperrt (aktives Konto → 400 ungueltig, kein Protokolleintrag; gesperrt → ok; danach nochmal → 400; unbekannt → 404)',
      aktivEntsperren.http === 400 && aktivEntsperren.code === 'ungueltig' && logNachAktiv === 0 && gesperrt === 'gesperrt' && entsperrt.ok === true &&
        (await m.speicher.ladeKonto(k.kid)).zustand === 'aktiv' && nochmal.http === 400 && unbekannt.http === 404 &&
        (await protokoll(m.ctx)).filter((e) => e.was === 'zugang-entsperrt').length === 1,
    );
  }
  {
    // Aufräumen der Fehl-E-Mails seitenweise.
    const { speicher, ctx } = neuerSpeicher({ KONTO_UHR: makeUhr(T0) });
    for (let i = 0; i < 1100; i++) {
      await ctx.storage.put(`fehl-email:${String(i).padStart(5, '0')}`, { anzahl: 1, bisMs: null, am: i < 700 ? T0 - 31 * TAG : T0 - TAG });
    }
    const seiten = [];
    const list = ctx.storage.list.bind(ctx.storage);
    ctx.storage.list = async (o = {}) => {
      if (o.prefix === 'fehl-email:') seiten.push(o.limit);
      return list(o);
    };
    await speicher.alarm();
    const rest = [...ctx.daten.keys()].filter((x) => x.startsWith('fehl-email:'));
    check(
      'Z1-W1: das Aufräumen der Fehl-E-Mails liest in Seiten (limit höchstens 500, mehrere Seiten bei 1100 Zählern) und löscht genau die alten (700 weg, 400 bleiben)',
      seiten.length >= 3 && seiten.every((n) => typeof n === 'number' && n <= 500) && rest.length === 400 && rest.every((x) => Number(x.slice(-5)) >= 700),
    );
  }
  {
    // Abgelaufene offene Zoom-Anfragen zählen nicht mehr und werden beim Lesen aufgeräumt.
    const stale = (kid, gid) => ({ id: 'alt', kid, gid, rechnerName: 'Alt-PC', jm: false, plattform: 'win', zweck: 'Alt', von: T0 - 3 * TAG, bis: T0 - TAG, zustand: 'offen', am: T0 - 4 * TAG, entschiedenAm: null, entschiedenVon: null, freigegebenBis: null });
    {
      const { speicher, ctx, geraet, kid } = await angemeldeterExterner({});
      await ctx.storage.put('anfrage:alt', stale(kid, geraet.gid));
      const neu = await rufeDo(speicher, 'zoom-anfragen', { jetzt: T0 + MIN, kid, gid: geraet.gid, zweck: 'Neu', von: T0 + TAG, bis: T0 + 2 * TAG });
      check(
        'Z1-W1: eine offene Anfrage, deren „bis“ vorbei ist, blockiert keine neue (kein 409) und wird beim Lesen gelöscht',
        neu.ok === true && !ctx.daten.has('anfrage:alt') && (await ctx.storage.list({ prefix: 'anfrage:' })).size === 1,
      );
    }
    {
      const { speicher, ctx, geraet, kid } = await angemeldeterExterner({});
      await ctx.storage.put('anfrage:alt', stale(kid, geraet.gid));
      const ich = await rufeDo(speicher, 'ich', { jetzt: T0 + MIN, kid });
      check('Z1-W1: ich zeigt eine abgelaufene offene Anfrage nicht mehr und räumt sie auf', ich.ok === true && ich.zoomAnfrage === null && !ctx.daten.has('anfrage:alt'));
    }
    {
      const m = await mitAdmin();
      await legeExternenAn(m.speicher, { passwort: 'richtiges-passwort' });
      await m.ctx.storage.put('anfrage:alt', stale('k-ext', 'g-1'));
      await m.ctx.storage.put('anfrage:neu', { ...stale('k-ext', 'g-1'), id: 'neu', zweck: 'Neu', bis: T0 + 2 * TAG });
      // Erst entscheiden, dann lesen: die Entscheidung selbst darf eine abgelaufene offene Anfrage nicht mehr annehmen.
      const frei = await m.aktion({ aktion: 'anfrage-freigeben', id: 'alt', bis: T0 + 5 * TAG }, T0);
      const ablehnen = await m.aktion({ aktion: 'anfrage-ablehnen', id: 'alt' }, T0);
      const zoomBisNachFreigabe = (await m.speicher.ladeKonto('k-ext')).zoomBis;
      await m.ctx.storage.put('anfrage:alt', stale('k-ext', 'g-1'));
      const ich = await rufeDo(m.speicher, 'ich', { jetzt: T0, kid: m.kid });
      const u = await m.uebersicht(T0);
      check(
        'Z1-W1: adminOffen und die Übersicht zählen nur noch gültige offene Anfragen (eine von zwei); die abgelaufene lässt sich weder freigeben noch ablehnen (404)',
        zoomBisNachFreigabe === null && ich.adminOffen === 1 && u.anfragen.length === 1 && u.anfragen[0].id === 'neu' && frei.http === 404 && ablehnen.http === 404 && !m.ctx.daten.has('anfrage:alt'),
      );
    }
  }
  {
    // AR74 C: Grenzen von anfragenLesen. Offen gilt bis „bis“ (bis > jetzt); entschiedene Anfragen löscht das Lesen nie.
    const anf = (kid, gid, o) => ({ id: 'x', kid, gid, rechnerName: 'PC', jm: false, plattform: 'win', zweck: 'Z', von: T0 - 3 * TAG, bis: T0, zustand: 'offen', am: T0 - 4 * TAG, entschiedenAm: null, entschiedenVon: null, freigegebenBis: null, ...o });
    {
      const { speicher, ctx, geraet, kid } = await angemeldeterExterner({});
      await ctx.storage.put('anfrage:knapp', anf(kid, geraet.gid, { id: 'knapp', bis: T0 + MIN + 1 }));
      const blockiert = await rufeDo(speicher, 'zoom-anfragen', { jetzt: T0 + MIN, kid, gid: geraet.gid, zweck: 'Neu', von: T0 + TAG, bis: T0 + 2 * TAG });
      check(
        'AR74 C: eine offene Anfrage mit bis = jetzt + 1 bleibt gespeichert und blockiert eine neue (409 konflikt)',
        blockiert.ok === false && blockiert.code === 'konflikt' && blockiert.status === 409 && ctx.daten.has('anfrage:knapp'),
      );
    }
    {
      const { speicher, ctx, geraet, kid } = await angemeldeterExterner({});
      await ctx.storage.put('anfrage:genau', anf(kid, geraet.gid, { id: 'genau', bis: T0 + MIN }));
      const ich = await rufeDo(speicher, 'ich', { jetzt: T0 + MIN, kid });
      check('AR74 C: eine offene Anfrage mit bis = jetzt ist abgelaufen (weg beim Lesen)', ich.zoomAnfrage === null && !ctx.daten.has('anfrage:genau'));
    }
    {
      const { speicher, ctx, geraet, kid } = await angemeldeterExterner({});
      await ctx.storage.put('anfrage:fg', anf(kid, geraet.gid, { id: 'fg', zustand: 'freigegeben', bis: T0 - TAG, am: T0 - 5 * TAG, entschiedenAm: T0 - 4 * TAG, freigegebenBis: T0 - TAG }));
      const ich = await rufeDo(speicher, 'ich', { jetzt: T0 + MIN, kid });
      await ctx.storage.put('anfrage:fg', anf(kid, geraet.gid, { id: 'fg', zustand: 'abgelehnt', bis: T0 - TAG, am: T0 - 5 * TAG, entschiedenAm: T0 - 4 * TAG }));
      const ich2 = await rufeDo(speicher, 'ich', { jetzt: T0 + MIN, kid });
      check(
        'AR74 C: entschiedene Anfragen (freigegeben, abgelehnt) mit vergangenem bis bleiben und stehen in ich',
        ich.zoomAnfrage && ich.zoomAnfrage.id === 'fg' && ich.zoomAnfrage.zustand === 'freigegeben' && ich2.zoomAnfrage && ich2.zoomAnfrage.zustand === 'abgelehnt' && ctx.daten.has('anfrage:fg'),
      );
    }
    {
      const m = await mitAdmin();
      await legeExternenAn(m.speicher, { passwort: 'richtiges-passwort' });
      await m.ctx.storage.put('anfrage:fg', anf('k-ext', 'g-1', { id: 'fg', zustand: 'freigegeben', bis: T0 - TAG, am: T0 - 5 * TAG, freigegebenBis: T0 - TAG }));
      await m.ctx.storage.put('anfrage:ab', anf('k-ext', 'g-1', { id: 'ab', zustand: 'abgelehnt', bis: T0 - 2 * TAG, am: T0 - 6 * TAG }));
      await m.ctx.storage.put('anfrage:knapp', anf('k-ext', 'g-1', { id: 'knapp', bis: T0 + 1, am: T0 - TAG }));
      const u = await m.uebersicht(T0);
      check(
        'AR74 C: die Übersicht zeigt entschiedene Anfragen mit vergangenem bis und die offene mit bis = jetzt + 1',
        u.anfragen.map((a) => a.id).sort().join(',') === 'ab,fg,knapp' && m.ctx.daten.has('anfrage:fg') && m.ctx.daten.has('anfrage:ab'),
      );
    }
  }
  {
    // Kurze Frist beim letzten Admin.
    const { speicher, aktion, kid: a } = await mitAdmin({});
    const speichern = (bis, jetzt = T0 + MIN) => aktion({ aktion: 'zugang-speichern', kid: a, stufe: 'admin', tools: [], events: [], bis, zoomBis: null }, jetzt);
    const kurz = await speichern(T0 + 10 * TAG);
    const genau = await speichern(T0 + MIN + 30 * TAG);
    const lang = await speichern(T0 + MIN + 30 * TAG + 1);
    check(
      'Z1-W1: der letzte Admin bekommt keine kurze Frist (10 Tage und genau 30 Tage → 409 konflikt, 30 Tage + 1 ms geht)',
      kurz.http === 409 && kurz.code === 'konflikt' && genau.http === 409 && lang.ok === true && (await speicher.ladeKonto(a)).bis === T0 + MIN + 30 * TAG + 1,
    );
    const b = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'jonas@jakobsmedien.com', name: 'Jonas' });
    const setzeB = async (bis) => speicher.speichereKonto({ ...(await speicher.ladeKonto(b.kid)), stufe: 'admin', bis });
    const herab = () => aktion({ aktion: 'zugang-speichern', kid: a, stufe: 'kollege', tools: [], events: [], bis: null, zoomBis: null }, T0 + 2 * MIN);
    await setzeB(T0 + 10 * TAG);
    const mitKurzem = await herab();
    const loeschenMitKurzem = await aktion({ aktion: 'zugang-loeschen', kid: a }, T0 + 2 * MIN);
    await setzeB(T0 + 60 * TAG);
    const mitLangem = await herab();
    check(
      'Z1-W1: ein zweiter Admin mit kurzer Frist (10 Tage) schützt nicht (Herabstufen und Löschen des ersten → 409); mit 60 Tagen geht es',
      mitKurzem.http === 409 && loeschenMitKurzem.http === 409 && mitLangem.ok === true,
    );
  }
  {
    // Obergrenzen von zugangsWerte, Grenzen von iveo und Slug.
    const m = await mitAdmin();
    const S = testSchluessel();
    const k = await rufeDo(m.speicher, 'konto-aus-google', { jetzt: T0, email: 'maria@jakobsmedien.com', name: 'Maria' });
    const speichern = (mehr) => m.aktion({ aktion: 'zugang-speichern', kid: k.kid, stufe: 'kollege', tools: [], events: [], bis: null, zoomBis: null, ...mehr });
    for (let i = 0; i < 101; i++) await m.ctx.storage.put(`iveo:https://iveo.example|e${i}`, { key: `https://iveo.example|e${i}`, basis: 'https://iveo.example', slug: `e${i}`, name: `E${i}`, iv: 'aaaa', ct: 'bbbb', am: T0, von: ERSTE });
    const schluessel = (n) => Array.from({ length: n }, (_, i) => `https://iveo.example|e${i}`);
    const hundert = await speichern({ events: schluessel(100) });
    const hunderteins = await speichern({ events: schluessel(101) });
    const doppelt = await speichern({ events: ['https://iveo.example|e1', 'https://iveo.example|e1'] });
    const werkzeuge = await speichern({ tools: Array(21).fill('qa') });
    const werkzeugeGut = await speichern({ tools: ['qa', 'qa', 'iveo'] });
    check(
      'Z1-W1: zugang-speichern: 100 Events gehen, 101 → 400; doppelte Events werden zu einem; mehr als 20 Werkzeuge → 400, doppelte Werkzeuge werden zu einem',
      hundert.ok === true && hunderteins.http === 400 && hunderteins.code === 'ungueltig' && doppelt.ok === true && werkzeuge.http === 400 && werkzeugeGut.ok === true &&
        JSON.stringify((await m.speicher.ladeKonto(k.kid)).tools) === '["qa","iveo"]',
    );
    await speichern({ events: ['https://iveo.example|e1', 'https://iveo.example|e1'] });
    check('Z1-W1: doppelte Events landen nur einmal im Konto', JSON.stringify((await m.speicher.ladeKonto(k.kid)).events) === '["https://iveo.example|e1"]');

    const ev = async (slug) => ({ slug, name: slug.slice(0, 5), ...(await iveoVerschluesseln(S, 'test-iveo-grenze', iveoSchluessel('https://grenze.example', slug) ?? 'x|y')) });
    const viele = async (n) => Promise.all(Array.from({ length: n }, (_, i) => ev(`s${i}`)));
    const h100 = await m.aktion({ aktion: 'iveo-hinterlegen', basis: 'https://grenze.example', events: await viele(100) });
    const h101 = await m.aktion({ aktion: 'iveo-hinterlegen', basis: 'https://grenze.example', events: await viele(101) });
    const s120 = await m.aktion({ aktion: 'iveo-hinterlegen', basis: 'https://grenze.example', events: [await ev('x'.repeat(120))] });
    const s121 = await m.aktion({ aktion: 'iveo-hinterlegen', basis: 'https://grenze.example', events: [{ slug: 'y'.repeat(121), name: 'Y', iv: 'aaaa', ct: 'bbbb' }] });
    check(
      'Z1-W1: iveo-hinterlegen: 100 Events und Slug mit 120 Zeichen gehen; 101 Events und Slug mit 121 Zeichen → 400 ungueltig, nichts gespeichert',
      h100.ok === true && h101.http === 400 && h101.code === 'ungueltig' && s120.ok === true && s121.http === 400 && s121.code === 'ungueltig' &&
        !m.ctx.daten.has(`iveo:https://grenze.example|${'y'.repeat(121)}`) && !m.ctx.daten.has('iveo:https://grenze.example|s100'),
    );
  }
  {
    // anfrage-freigeben mit Datum in der Vergangenheit.
    const m = await mitAdmin();
    await legeExternenAn(m.speicher, { passwort: 'richtiges-passwort' });
    await m.ctx.storage.put('anfrage:a1', { id: 'a1', kid: 'k-ext', gid: 'g-1', rechnerName: 'PC', jm: false, plattform: 'win', zweck: 'Probe', von: T0, bis: T0 + 10 * TAG, zustand: 'offen', am: T0, entschiedenAm: null, entschiedenVon: null, freigegebenBis: null });
    const faelle = [
      { name: 'ein ms in der Vergangenheit', bis: T0 - 1 },
      { name: 'genau jetzt', bis: T0 },
      { name: 'weit in der Vergangenheit', bis: T0 - 365 * TAG },
      { name: 'kein Datum', bis: 'morgen' },
      { name: 'fehlt', bis: undefined },
    ];
    await pruefeFaelle('Z1-W1: anfrage-freigeben mit „bis“ nicht in der Zukunft oder ohne Zahl → 400 ungueltig', faelle, async (f) => {
      const r = await m.aktion({ aktion: 'anfrage-freigeben', id: 'a1', bis: f.bis }, T0);
      return gleich([r.http, r.code], [400, 'ungueltig']);
    });
    const unveraendert = (await m.speicher.ladeKonto('k-ext')).zoomBis === null && m.ctx.daten.get('anfrage:a1').zustand === 'offen';
    const ok = await m.aktion({ aktion: 'anfrage-freigeben', id: 'a1', bis: T0 + 1 }, T0);
    check('Z1-W1: nach den abgelehnten Fällen ist die Anfrage noch offen und zoomBis leer; mit „bis“ = jetzt + 1 geht es', unveraendert && ok.ok === true);
  }
  {
    // [T] ERSTER_ADMIN mit Großbuchstaben und Leerzeichen auf der Env-Seite; stufeVon in der Übersicht.
    const m = await mitAdmin({ ERSTER_ADMIN: '  Chefin@JakobsMedien.COM  ' });
    const u = await m.uebersicht();
    const loeschen = await m.aktion({ aktion: 'zugang-loeschen', kid: m.kid });
    check(
      'Z1-W1 [T]: ERSTER_ADMIN mit Großbuchstaben und Leerzeichen in der Umgebung: das Google-Konto wird Admin, die Übersicht nennt es ersterAdmin, Löschen → 403 erster-admin',
      (await m.speicher.ladeKonto(m.kid)).stufe === 'admin' && u.zugaenge.length === 1 && u.zugaenge[0].ersterAdmin === true && u.zugaenge[0].stufe === 'admin' &&
        loeschen.http === 403 && loeschen.code === 'erster-admin',
    );
    await m.speicher.speichereKonto({ ...(await m.speicher.ladeKonto(m.kid)), stufe: 'kollege' });
    const u2 = await m.uebersicht();
    check('Z1-W1 [T]: stufeVon in der Übersicht: ein gespeichertes „kollege“ beim ersten Admin erscheint als admin', u2.zugaenge[0].stufe === 'admin' && u2.zugaenge[0].ersterAdmin === true);
  }
  {
    // [T] Anfragen von gelöschten, gesperrten und abgelaufenen Konten; Zweck über 200 Zeichen; leerer Rechnername.
    const faelle = [
      { name: 'gesperrt', vorbereiten: async (s, kid) => s.speichereKonto({ ...(await s.ladeKonto(kid)), zustand: 'gesperrt' }), soll: [403, 'gesperrt'] },
      { name: 'abgelaufen', vorbereiten: async (s, kid) => s.speichereKonto({ ...(await s.ladeKonto(kid)), bis: T0 + MIN }), soll: [403, 'zugang-abgelaufen'] },
      { name: 'gelöscht', vorbereiten: (s, kid) => s.zugangLoeschen(kid, ERSTE, T0), soll: [403, 'geloescht'] },
    ];
    await pruefeFaelle('Z1-W1 [T]: zoom-anfragen eines gesperrten, abgelaufenen oder gelöschten Kontos → 403 mit dem Grund, keine Anfrage abgelegt', faelle, async (f) => {
      const { speicher, ctx, geraet, kid } = await angemeldeterExterner({});
      await f.vorbereiten(speicher, kid);
      const r = await rufeDo(speicher, 'zoom-anfragen', { jetzt: T0 + 2 * MIN, kid, gid: geraet.gid, zweck: 'Probe', von: T0 + TAG, bis: T0 + 2 * TAG });
      return gleich([r.http, r.code, (await ctx.storage.list({ prefix: 'anfrage:' })).size], [...f.soll, 0]);
    });
    const { speicher, ctx, geraet, kid } = await angemeldeterExterner({});
    const lang = await rufeDo(speicher, 'zoom-anfragen', { jetzt: T0 + MIN, kid, gid: geraet.gid, zweck: `  ${'x'.repeat(250)}  `, von: T0 + TAG, bis: T0 + 2 * TAG });
    const gespeichert = [...(await ctx.storage.list({ prefix: 'anfrage:' })).values()];
    check(
      'Z1-W1 [T]: ein Zweck über 200 Zeichen wird (wie im Brief: text(zweck, 200)) auf 200 Zeichen gekürzt und angenommen; nur Leerraum → 400 ungueltig',
      lang.ok === true && gespeichert.length === 1 && gespeichert[0].zweck === 'x'.repeat(200) && lang.anfrage.zweck === 'x'.repeat(200),
    );
    const leer = await rufeDo(speicher, 'zoom-anfragen', { jetzt: T0 + 2 * MIN, kid, gid: geraet.gid, zweck: '   ', von: T0 + TAG, bis: T0 + 2 * TAG });
    check('Z1-W1 [T]: Zweck nur aus Leerraum → 400 ungueltig', leer.http === 400 && leer.code === 'ungueltig');
  }
  {
    // [T] Ein leerer Rechnername beim Erneuern behält den alten Namen.
    const { speicher, ctx, geraet, kid } = await angemeldeterExterner({});
    const faelle = [{ name: 'leer', n: '' }, { name: 'nur Leerraum', n: '   ' }, { name: 'nur Nullbreitenzeichen und Steuerzeichen', n: `${String.fromCharCode(0x200b)}\u0007` }, { name: 'keine Zeichenkette', n: 42 }];
    await pruefeFaelle('Z1-W1 [T]: sitzung-erneuern mit leerem oder unbrauchbarem Rechnernamen behält den alten Namen', faelle, async (f) => {
      const r = await erneuern(speicher, geraet, kid, T0 + MIN, { rechnerName: f.n });
      return gleich([r.ok, r.geraet.name, ctx.daten.get(`geraet:${geraet.gid}`).name], [true, 'Regie-PC 1', 'Regie-PC 1']);
    });
  }
  {
    // [T] iveo-entfernen setzt „geaendert“ bei jedem betroffenen Konto (auch hinter der ersten Seite) und nur dort.
    const { ctx, aktion } = await mitAdmin();
    const S = testSchluessel();
    await aktion({ aktion: 'iveo-hinterlegen', basis: 'https://iveo.example', events: [await iveoEvent(S, 'tagung', 'Tagung', 'test-iveo-1')] });
    const key = 'https://iveo.example|tagung';
    for (let i = 0; i < 140; i++) {
      const kid = `k-${String(i).padStart(3, '0')}`;
      await ctx.storage.put(`konto:${kid}`, { kid, email: `x${i}@firma.example`, name: `X ${i}`, art: 'passwort', stufe: 'externer', zustand: 'aktiv', tools: [], events: i === 5 || i === 138 ? [key] : [], bis: T0 + TAG, zoomBis: null, erstellt: T0, geaendert: T0 });
    }
    await aktion({ aktion: 'iveo-entfernen', key }, T0 + 7 * MIN);
    const stand = (i) => ctx.daten.get(`konto:k-${String(i).padStart(3, '0')}`).geaendert;
    check('Z1-W1 [T]: iveo-entfernen setzt geaendert = jetzt bei den betroffenen Konten (5 und 138, auch hinter der ersten Seite), alle anderen bleiben bei T0', stand(5) === T0 + 7 * MIN && stand(138) === T0 + 7 * MIN && stand(0) === T0 && stand(6) === T0 && stand(139) === T0);
  }

  // ── Z2 Nr. 2: Einmalwert e beim Bestätigen, Abholen nur mit e (Rückkanal wie Desktop-OAuth, RFC 8252 loopback) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    const geraet = await testGeraet();
    const k = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'maria@jakobsmedien.com', name: 'Maria Schmidt' });
    const v = await neuerVorgang(speicher, geraet, T0, 61234);
    const b = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0, vorgang: v.vorgang, kid: k.kid });
    const ja = await rufeDo(speicher, 'vorgang-bestaetigen', { jetzt: T0, vorgang: v.vorgang, seitenToken: b.seitenToken, antwort: 'ja' });
    const gespeichert = ctx.daten.get(`vorgang:${v.vorgang}`);
    const roh = JSON.stringify([...ctx.daten.entries()]);
    check('Z2 2: Ja → e (43 Zeichen b64url, zufall(32)) und der Port des Rückkanals in der Antwort; im Speicher nur sha256(e), nie e',
      ja.ok === true && ja.zustand === 'bestaetigt' && typeof ja.e === 'string' && /^[A-Za-z0-9_-]{43}$/.test(ja.e) && ja.rueckPort === 61234
        && gespeichert.eHash === (await sha256B64url(ja.e)) && !roh.includes(ja.e));
    const beweis = async (ts) => geraet.beweis('abholen', v.vorgang, ts);
    const ohneE = await abholen(speicher, v, geraet, T0 + 1000);
    const falschesE = await abholen(speicher, { ...v, e: zufall(32) }, geraet, T0 + 2000);
    const leeresE = await rufeDo(speicher, 'vorgang-abholen', { jetzt: T0 + 2500, vorgang: v.vorgang, abholHash: v.abholHash, beweis: await beweis(T0 + 2500), eHash: '' });
    const eUngehasht = await rufeDo(speicher, 'vorgang-abholen', { jetzt: T0 + 2600, vorgang: v.vorgang, abholHash: v.abholHash, beweis: await beweis(T0 + 2600), eHash: ja.e });
    const eKeinText = await rufeDo(speicher, 'vorgang-abholen', { jetzt: T0 + 2700, vorgang: v.vorgang, abholHash: v.abholHash, beweis: await beweis(T0 + 2700), eHash: 42 });
    const nochBestaetigt = ctx.daten.get(`vorgang:${v.vorgang}`)?.zustand === 'bestaetigt';
    const mitE = await abholen(speicher, { ...v, e: ja.e }, geraet, T0 + 3000);
    check('Z2 2: nach Ja ohne e, mit falschem, leerem, ungehashtem oder unlesbarem e → wartet (wie vor dem Ja, ohne Konto), der Vorgang bleibt bestätigt; mit e → Sitzung',
      [ohneE, falschesE, leeresE, eUngehasht, eKeinText].every((r) => r.http === 200 && r.ok === true && r.zustand === 'wartet' && !('konto' in r) && !('geraet' in r))
        && nochBestaetigt && mitE.zustand === 'bestaetigt' && mitE.konto.kid === k.kid && mitE.geraet.gid === geraet.gid);
    const w = await neuerVorgang(speicher, geraet);
    const bw = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0, vorgang: w.vorgang, kid: k.kid });
    const nein = await rufeDo(speicher, 'vorgang-bestaetigen', { jetzt: T0, vorgang: w.vorgang, seitenToken: bw.seitenToken, antwort: 'nein' });
    check('Z2 2: Nein → kein e und kein Port in der Antwort, kein Hash im Vorgang',
      nein.ok === true && nein.zustand === 'abgelehnt' && !('e' in nein) && !('rueckPort' in nein) && !('eHash' in ctx.daten.get(`vorgang:${w.vorgang}`)));
    // Ein bestätigter Vorgang ohne Hash (etwa aus der Zeit vor Z2) gibt ohne e nie eine Sitzung: fehlt der Hash, gilt kein e.
    const alt = await neuerVorgang(speicher, geraet);
    const altGespeichert = ctx.daten.get(`vorgang:${alt.vorgang}`);
    await ctx.storage.put(`vorgang:${alt.vorgang}`, { ...altGespeichert, zustand: 'bestaetigt', kid: k.kid });
    const altOhne = await abholen(speicher, alt, geraet, T0);
    const altLeer = await rufeDo(speicher, 'vorgang-abholen', { jetzt: T0, vorgang: alt.vorgang, abholHash: alt.abholHash, beweis: await geraet.beweis('abholen', alt.vorgang, T0), eHash: '' });
    check('Z2 2: ein bestätigter Vorgang ohne gespeicherten Hash → wartet, auch mit leerem e (nie eine Sitzung ohne Sprung)',
      altOhne.zustand === 'wartet' && altLeer.zustand === 'wartet' && ctx.daten.has(`vorgang:${alt.vorgang}`));
  }

  // ── Z2 Phishing: ein Angreifer startet den Vorgang selbst und schickt dem Opfer den Link ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    const angreifer = await testGeraet({ name: 'Regie-PC 1' });
    const zweiter = await testGeraet({ name: 'Anderer PC' });
    const opfer = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'chefin@jakobsmedien.com', name: 'Clara Chefin' });
    const v = await neuerVorgang(speicher, angreifer, T0, 50001);
    // Das Opfer meldet sich im eigenen Browser an und klickt Ja; e geht per Sprung an 127.0.0.1:50001 auf dem Rechner des Opfers.
    const b = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0 + MIN, vorgang: v.vorgang, kid: opfer.kid });
    const ja = await rufeDo(speicher, 'vorgang-bestaetigen', { jetzt: T0 + MIN, vorgang: v.vorgang, seitenToken: b.seitenToken, antwort: 'ja' });
    // Der Rechner des Angreifers fragt alle 2 s nach, ohne e, bis die Frist abläuft.
    const zustaende = new Set();
    let konto = false;
    for (let t = T0 + MIN; t < T0 + 5 * MIN; t += 2000) {
      const r = await abholen(speicher, v, angreifer, t);
      zustaende.add(r.zustand ?? r.code);
      if (r.konto || r.zustand === 'bestaetigt') konto = true;
    }
    const ende = await abholen(speicher, v, angreifer, T0 + 5 * MIN);
    // Ein zweiter „Launcher“ (eigenes Gerät, eigenes Abholgeheimnis, kein e) am selben Vorgang: nie eine Sitzung.
    const v2 = await neuerVorgang(speicher, zweiter);
    const b2 = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0, vorgang: v2.vorgang, kid: opfer.kid });
    await rufeDo(speicher, 'vorgang-bestaetigen', { jetzt: T0, vorgang: v2.vorgang, seitenToken: b2.seitenToken, antwort: 'ja' });
    const fremdGeheimnis = await rufeDo(speicher, 'vorgang-abholen', { jetzt: T0, vorgang: v2.vorgang, abholHash: await sha256B64url(zufall(32)), beweis: await zweiter.beweis('abholen', v2.vorgang, T0) });
    const fremdMitE = await rufeDo(speicher, 'vorgang-abholen', { jetzt: T0, vorgang: v2.vorgang, abholHash: await sha256B64url(zufall(32)), beweis: await zweiter.beweis('abholen', v2.vorgang, T0), eHash: await sha256B64url(ja.e) });
    check('Z2 Phishing: der Rechner des Angreifers (eigener Vorgang, Opfer bestätigt, kein e) bekommt nie eine Sitzung (nur wartet, dann abgelaufen); ein zweiter Launcher mit anderem Abholgeheimnis → 404, auch mit einem e',
      ja.ok === true && !konto && [...zustaende].join(',') === 'wartet' && ende.zustand === 'abgelaufen' && !ctx.daten.has(`geraet:${angreifer.gid}`)
        && (await speicher.ladeKonto(opfer.kid)).letzteAnmeldung === null
        && fremdGeheimnis.http === 404 && fremdGeheimnis.code === 'vorgang-unbekannt' && fremdMitE.http === 404 && !ctx.daten.has(`geraet:${zweiter.gid}`));
  }

  // ── Z2 Nr. 6: Grabstein nach dem Abholen (verlorene Antwort, 60 s, dasselbe Abholgeheimnis und dasselbe e) ──
  {
    const { speicher, ctx } = neuerSpeicher({});
    const geraet = await testGeraet();
    const fremd = await testGeraet();
    const k = await rufeDo(speicher, 'konto-aus-google', { jetzt: T0, email: 'maria@jakobsmedien.com', name: 'Maria Schmidt' });
    const v = await neuerVorgang(speicher, geraet);
    const b = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0, vorgang: v.vorgang, kid: k.kid });
    await bestaetige(speicher, v, b.seitenToken);
    const T1 = T0 + 1000;
    const erst = await abholen(speicher, v, geraet, T1); // die Antwort geht unterwegs verloren
    const grab = ctx.daten.get(`grab:${v.vorgang}`);
    const roh = JSON.stringify([...ctx.daten.entries()]);
    const nochmal = await abholen(speicher, v, geraet, T1 + 59_999);
    const ohneE = await abholen(speicher, { ...v, e: undefined }, geraet, T1 + 30_000);
    const anderesE = await abholen(speicher, { ...v, e: zufall(32) }, geraet, T1 + 30_000);
    const anderesGeheimnis = await abholen(speicher, { ...v, abholHash: await sha256B64url(zufall(32)) }, geraet, T1 + 30_000);
    const fremdesGeraet = await abholen(speicher, v, fremd, T1 + 30_000);
    const seite = await rufeDo(speicher, 'vorgang-lesen', { jetzt: T1 + 30_000, vorgang: v.vorgang });
    const danach = await abholen(speicher, v, geraet, T1 + 60_000);
    check('Z2 6: nach dem Abholen liegt 60 s ein Grabstein (eigener Schlüssel, nur Hashes); dasselbe Abholgeheimnis plus dasselbe e → dieselbe Anmeldung (Konto, Gerät, angemeldetSeit)',
      erst.zustand === 'bestaetigt' && !ctx.daten.has(`vorgang:${v.vorgang}`) && !!grab && grab.bis === T1 + 60_000 && !roh.includes(v.e) && !roh.includes(v.abholGeheimnis)
        && nochmal.http === 200 && nochmal.zustand === 'bestaetigt' && nochmal.konto.kid === k.kid && nochmal.geraet.gid === geraet.gid
        && nochmal.geraet.angemeldetSeit === erst.geraet.angemeldetSeit && erst.geraet.angemeldetSeit === T1 && !('publicJwk' in nochmal.geraet) && !('passwort' in nochmal.konto));
    check('Z2 6: der Grabstein nimmt nichts anderes an: ohne e, anderes e, anderes Abholgeheimnis → 404; fremdes Gerät → 403; die Seite kennt den Vorgang nicht (404)',
      ohneE.http === 404 && ohneE.code === 'vorgang-unbekannt' && anderesE.http === 404 && anderesGeheimnis.http === 404
        && fremdesGeraet.http === 403 && fremdesGeraet.code === 'geraet-unbekannt' && seite.http === 404 && seite.code === 'vorgang-unbekannt');
    check('Z2 6: nach 60 s ist der Vorgang weg: Wiederholung → 404 vorgang-unbekannt, der Grabstein ist gelöscht',
      danach.http === 404 && danach.code === 'vorgang-unbekannt' && !ctx.daten.has(`grab:${v.vorgang}`));
    // Ein abgemeldetes Gerät (oder eins, das inzwischen anders angemeldet ist) bekommt aus dem Grabstein nichts mehr.
    const w = await neuerVorgang(speicher, geraet, T0 + 2 * MIN);
    const bw = await rufeDo(speicher, 'vorgang-konto-binden', { jetzt: T0 + 2 * MIN, vorgang: w.vorgang, kid: k.kid });
    await bestaetige(speicher, w, bw.seitenToken, 'ja', T0 + 2 * MIN);
    const wErst = await abholen(speicher, w, geraet, T0 + 2 * MIN);
    await rufeDo(speicher, 'abmelden', { jetzt: T0 + 2 * MIN + 1000, kid: k.kid, gid: geraet.gid, angemeldetSeit: wErst.geraet.angemeldetSeit });
    const wNochmal = await abholen(speicher, w, geraet, T0 + 2 * MIN + 2000);
    check('Z2 6: nach dem Abmelden innerhalb der 60 s liefert der Grabstein keine Sitzung mehr (404)',
      wErst.zustand === 'bestaetigt' && wNochmal.http === 404 && wNochmal.code === 'vorgang-unbekannt');
    // Der Alarm räumt abgelaufene Grabsteine ab.
    const uhr = makeUhr(T0);
    const a = neuerSpeicher({ KONTO_UHR: uhr });
    await a.ctx.storage.put('grab:alt', { vorgang: 'alt', bis: T0 });
    await a.ctx.storage.put('grab:neu', { vorgang: 'neu', bis: T0 + 1 });
    await a.speicher.alarm();
    check('Z2 6: der Alarm räumt abgelaufene Grabsteine ab, laufende bleiben', !a.ctx.daten.has('grab:alt') && a.ctx.daten.has('grab:neu'));
  }

  // ── Z3: Aktion qa-inhaber (Q&A-Event-Inhaber, Compare-and-set; OE3, AR55) ──
  {
    const h = (c) => c.repeat(64);
    const EV = h('a');
    const A = { kidHash: h('1'), gidHash: h('2') };
    const frage = (speicher, mehr = {}, jetzt = T0) => rufeDo(speicher, 'qa-inhaber', { jetzt, eventHash: EV, bisMs: jetzt + 2 * TAG, ...mehr });

    // erstes Öffnen bindet; Antwort und Ablage
    {
      const { speicher, ctx } = neuerSpeicher();
      const r = await frage(speicher, A);
      check('Z3: qa-inhaber ohne Inhaber bindet kidHash, gidHash und bis → neu true', gleich([r.ok, r.neu, r.inhaber], [true, true, { ...A, bis: T0 + 2 * TAG }]) === null);
      check('Z3: der Inhaber liegt unter der eigenen Schlüssel-Familie qa:<eventHash>', gleich([...ctx.daten.keys()], [`qa:${EV}`]) === null);
    }

    // Tabelle: Zustand davor × Eingabe → Antwort
    {
      const B = { kidHash: h('3'), gidHash: h('4') };
      const faelle = [
        { name: 'dasselbe Konto, derselbe Rechner', ein: A, soll: [200, true, false] },
        { name: 'dasselbe Konto, anderer Rechner', ein: { kidHash: A.kidHash, gidHash: B.gidHash }, soll: [200, true, false] },
        { name: 'anderes Konto, derselbe Rechner', ein: { kidHash: B.kidHash, gidHash: A.gidHash }, soll: [200, true, false] },
        { name: 'anderes Konto, anderer Rechner', ein: B, soll: [403, false, 'keine-freigabe'] },
        { name: 'alter Schlüssel (ohne Hashes) bei gebundenem Event', ein: {}, soll: [403, false, 'keine-freigabe'] },
        { name: 'nur kidHash (Rechner fehlt) bei gebundenem Event', ein: { kidHash: A.kidHash }, soll: [400, false, 'ungueltig'] },
        { name: 'eventHash kein SHA-256-hex', ein: { ...A, eventHash: 'qa-event-1' }, soll: [400, false, 'ungueltig'] },
        { name: 'kidHash kein SHA-256-hex', ein: { kidHash: 'k-1', gidHash: A.gidHash }, soll: [400, false, 'ungueltig'] },
        { name: 'bisMs keine Zahl', ein: { ...A, bisMs: 'morgen' }, soll: [400, false, 'ungueltig'] },
      ];
      await pruefeFaelle('Z3: qa-inhaber bei gebundenem Event je Eingabe', faelle, async (f) => {
        const { speicher } = neuerSpeicher();
        await frage(speicher, A);
        const r = await frage(speicher, f.ein);
        return gleich([r.http, r.ok, r.ok ? r.neu : r.code], f.soll);
      });
    }

    // alter Schlüssel ohne Inhaber: ok, bindet nicht (EP33 wie heute)
    {
      const { speicher, ctx } = neuerSpeicher();
      const r = await frage(speicher, {});
      check('Z3: alter Schlüssel ohne Inhaber → ok, inhaber null, nichts gespeichert', gleich([r.ok, r.neu, r.inhaber ?? null, ctx.daten.size], [true, false, null, 0]) === null);
      const danach = await frage(speicher, A);
      check('Z3: danach bindet die erste Freigabe (Übergang)', gleich([danach.ok, danach.neu], [true, true]) === null);
    }

    // Aufräumen beim Lesen, Obergrenze 30 Tage, Verlängern beim Wiedersehen
    {
      const { speicher } = neuerSpeicher();
      await frage(speicher, A);
      const nach = await frage(speicher, { kidHash: h('3'), gidHash: h('4') }, T0 + 2 * TAG + 1);
      check('Z3: abgelaufener Inhaber (bis < jetzt) gilt als nicht vorhanden: der Nächste bindet', gleich([nach.ok, nach.neu, nach.inhaber?.kidHash], [true, true, h('3')]) === null);
      const { speicher: s2, ctx: c2 } = neuerSpeicher();
      await frage(s2, A);
      await frage(s2, {}, T0 + 2 * TAG + 1); // alter Schlüssel: liest und räumt auf, ohne neu zu binden
      check('Z3: ein abgelaufener Eintrag wird beim Lesen gelöscht (auch durch den alten Schlüssel)', c2.daten.size === 0);
      const { speicher: s3 } = neuerSpeicher();
      const lang = await frage(s3, { ...A, bisMs: T0 + 400 * TAG });
      check('Z3: bis ist auf 30 Tage ab jetzt begrenzt', lang.inhaber?.bis === T0 + 30 * TAG);
      const { speicher: s4, ctx: c4 } = neuerSpeicher();
      await frage(s4, { ...A, bisMs: T0 + 2 * TAG });
      await frage(s4, { ...A, bisMs: T0 + 3 * TAG }, T0 + TAG);
      await frage(s4, { ...A, bisMs: T0 + TAG }, T0 + TAG);
      check('Z3: bis wird beim Wiedersehen nur verlängert, nie verkürzt', c4.daten.get(`qa:${EV}`)?.bis === T0 + 3 * TAG);
    }

    // Schlüssel-Familie kollidiert nicht; keine Klarform der Event-ID
    {
      // Ein Konto, ein Gerät, eine E-Mail-Zuordnung und ein Vorgang, deren Kennung genau der eventHash ist: der Inhaber legt sich
      // daneben und verdrängt keinen; und umgekehrt liest qa-inhaber nie einen solchen Eintrag als Inhaber.
      const { speicher, ctx } = neuerSpeicher();
      const fremd = { konto: { kid: EV, tag: 'konto' }, geraet: { gid: EV, tag: 'geraet' }, email: EV, vorgang: { vid: EV, tag: 'vorgang' } };
      for (const [fam, wert] of Object.entries(fremd)) await ctx.storage.put(`${fam}:${EV}`, wert);
      const erst = await frage(speicher, A);
      await frage(speicher, A, T0 + 1);
      const unveraendert = Object.entries(fremd).every(([fam, wert]) => JSON.stringify(ctx.daten.get(`${fam}:${EV}`)) === JSON.stringify(wert));
      const qa = [...ctx.daten.keys()].filter((k) => k.startsWith('qa:'));
      check('Z3: ein Konto-, Geräte-, E-Mail- und Vorgangs-Schlüssel mit demselben Hash bleibt unverändert, der Inhaber liegt allein unter qa:<eventHash> und wurde gebunden',
        unveraendert && gleich(qa, [`qa:${EV}`]) === null && erst.neu === true && erst.inhaber?.kidHash === A.kidHash);
      const { speicher: s2, ctx: c2 } = neuerSpeicher();
      for (const fam of ['konto', 'geraet', 'email', 'vorgang', 'state', 'iveo', 'anfrage', 'fehl', 'fehl-email', 'altkey', 'log']) await c2.storage.put(`${fam}:${EV}`, { kidHash: h('9'), gidHash: h('9'), bis: T0 + TAG });
      const leer = await frage(s2, A);
      check('Z3: Einträge anderer Familien mit demselben Hash gelten nie als Inhaber (der Erste bindet neu)', leer.neu === true && leer.inhaber?.kidHash === A.kidHash);
    }

    // Grenzfälle von bis (M3): bis = jetzt gilt noch, bis = jetzt − 1 ist frei
    {
      const B = { kidHash: h('3'), gidHash: h('4') };
      const { speicher } = neuerSpeicher();
      await frage(speicher, { ...A, bisMs: T0 });
      const gleichJetzt = await frage(speicher, B, T0);
      const { speicher: s2 } = neuerSpeicher();
      await frage(s2, { ...A, bisMs: T0 });
      const eineMsDanach = await frage(s2, B, T0 + 1);
      check('Z3 M3: bis = jetzt → der Inhaber gilt noch (Fremder 403); bis = jetzt − 1 → frei (Fremder bindet)',
        gleich([gleichJetzt.http, gleichJetzt.code, eineMsDanach.http, eineMsDanach.neu], [403, 'keine-freigabe', 200, true]) === null);
    }

    // M7: bis wird nur verlängert, wenn es um mehr als 1 h wächst (weniger Schreiblast bei der Abfrage alle 5 s)
    {
      const { speicher, ctx } = neuerSpeicher();
      await frage(speicher, { ...A, bisMs: T0 + 2 * TAG });
      const schreibt = [];
      const echtes = ctx.storage.put;
      ctx.storage.put = async (...a) => (schreibt.push(a[0]), echtes(...a));
      await frage(speicher, { ...A, bisMs: T0 + 2 * TAG + 30 * MIN }, T0 + 1);
      const nachHalbeStunde = ctx.daten.get(`qa:${EV}`)?.bis;
      const nachHalbe = schreibt.length;
      await frage(speicher, { ...A, bisMs: T0 + 2 * TAG + 61 * MIN }, T0 + 2);
      check('Z3 M7: Wachstum um 30 min → kein Schreiben, bis bleibt; um 61 min → geschrieben',
        nachHalbeStunde === T0 + 2 * TAG && nachHalbe === 0 && ctx.daten.get(`qa:${EV}`)?.bis === T0 + 2 * TAG + 61 * MIN && schreibt.length === 1);
    }

    // M5: der Tages-Alarm räumt abgelaufene Inhaber ab, gültige bleiben
    {
      const uhr = makeUhr(T0);
      const { speicher, ctx } = neuerSpeicher({ KONTO_UHR: uhr });
      await ctx.storage.put(`qa:${h('b')}`, { kidHash: h('1'), gidHash: h('2'), bis: T0 - 1 });
      await ctx.storage.put(`qa:${h('c')}`, { kidHash: h('1'), gidHash: h('2'), bis: T0 });
      await speicher.alarm();
      check('Z3 M5: der Alarm löscht qa:-Einträge mit bis < jetzt und lässt bis = jetzt stehen', gleich([...ctx.daten.keys()].filter((k) => k.startsWith('qa:')), [`qa:${h('c')}`]) === null);
    }

    // M1: Zwischen dem Lesen und dem letzten Schreiben in qaInhaber steht nur Speicher-Zugriff (Eingangs-Tor)
    {
      const quelle = readFileSync(new URL('../konto-do.js', import.meta.url), 'utf8');
      const rumpf = quelle.slice(quelle.indexOf('async qaInhaber('), quelle.indexOf('// ── Admin-Maske'));
      const von = rumpf.indexOf('st.get(key)');
      const bis = rumpf.lastIndexOf('st.put(');
      const dazwischen = rumpf.slice(von, bis + 'st.put('.length).replace(/\/\/.*$/gm, ''); // ohne Zeilenkommentare
      check('Z3 M1: Quelltext qaInhaber: zwischen st.get(key) und dem letzten st.put steht jedes await vor einem st.-Zugriff (kein fetch, crypto, Timer)',
        von > 0 && bis > von && /await/.test(dazwischen) && !/await\s+(?!st\.)/.test(dazwischen) && !/setTimeout|fetch\(|crypto\./.test(dazwischen));
    }

    // AR90: Der Puffer des Absenders (qa-relay.js) muss den Schritt des DO um mindestens 60 s (Einreichungs-Minimum) übersteigen,
    // sonst fällt bis bei einem nicht geschriebenen Zuwachs unter Meta-Ende + 60 s. Beide Konstanten kommen aus dem Quelltext.
    {
      const zahl = (text, muster) => {
        const m = text.match(muster);
        return m ? Number(m[1].replace(/_/g, '')) : NaN;
      };
      const doText = readFileSync(new URL('../konto-do.js', import.meta.url), 'utf8');
      const relayText = readFileSync(new URL('../qa-relay.js', import.meta.url), 'utf8');
      const schritt = zahl(doText, /const QA_INHABER_SCHRITT_MS = ([\d_]+);/);
      const puffer = zahl(relayText, /bisPufferMs: ([\d_]+),/);
      check('Z3 AR90: Quelltext: bisPufferMs (qa-relay.js) − QA_INHABER_SCHRITT_MS (konto-do.js) ≥ 60 000 ms', Number.isFinite(schritt) && Number.isFinite(puffer) && puffer - schritt >= 60_000);
    }

    // Rennen: zwei Konten öffnen gleichzeitig dasselbe Event (Promise.all über die Namespace-Attrappe mit Eingangs-Tor)
    {
      const ns = makeKontoNs({ KONTO_UHR: () => T0 });
      const stub = ns.get(ns.idFromName('konten'));
      const rufe = async (e) => {
        const res = await stub.fetch(new Request('https://konto.intern/qa-inhaber', { method: 'POST', body: JSON.stringify({ jetzt: T0, eventHash: EV, bisMs: T0 + TAG, ...e }) }));
        return { http: res.status, ...(await res.json()) };
      };
      const [x, y] = await Promise.all([rufe({ kidHash: h('1'), gidHash: h('2') }), rufe({ kidHash: h('3'), gidHash: h('4') })]);
      check('Z3: gleichzeitig zwei fremde Konten → genau eines wird Inhaber, das andere bekommt 403 keine-freigabe', gleich([x.http + y.http, [x, y].filter((r) => r.neu === true).length, [x, y].filter((r) => r.code === 'keine-freigabe').length], [603, 1, 1]) === null);
    }
  }

  // ── Ende der Fälle ──
}

run()
  .then(abschluss)
  .catch((e) => {
    console.error('Test-Harness-Fehler:', e);
    process.exit(1);
  });
