// P3–P6 · Durable Object `KontoSpeicher` (Spec 4, 4.1, 6.1, 6.3, 6.4, 7, 8, 9, 11; Plan 10.4, EP1–EP5, EP19–EP21, OF2, OF3).
//   node --experimental-strip-types services/release-proxy/test/konto-do.test.mjs
// Form „check“ über die Zählung aus konto-attrappen.mjs. Der DO läuft als einfache Klasse auf der Map-Attrappe von
// ctx.storage; Aktionen gehen wie vom Worker als POST an https://konto.intern/<aktion> (rufeDo). P4–P6 fügen ihre Fälle
// direkt vor der Marke „Ende der Fälle“ ein und ihre Hilfsfunktionen direkt vor `async function run() {`.
import { readFileSync } from 'node:fs';
import { PROTOKOLL_MS } from '../konto-kern.js';
import { hashePasswort, sha256B64url } from '../konto-krypto.js';
import { abschluss, check, gleich, makeCtx, makeUhr, neuerSpeicher, pruefeFaelle, rufeDo } from './konto-attrappen.mjs';

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

  // ── Ende der Fälle ──
}

run()
  .then(abschluss)
  .catch((e) => {
    console.error('Test-Harness-Fehler:', e);
    process.exit(1);
  });
