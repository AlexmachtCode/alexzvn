// P1 · Rechte, Kontostand und Fristen der Anmeldung (Spec 4, 5, 6.1, 9, 9.1, 10; Plan 10.2, EP9, EP16, OF1, OF4).
//   node --experimental-strip-types services/release-proxy/test/konto-kern.test.mjs
// Form „check“: `  ok  ‹Name›` / `FAIL  ‹Name›`, Schluss `‹n› passed, ‹m› failed`, Exit 1 bei Fehlern. Ein Kreuzprodukt ist
// eine Zeile mit „(‹n› Fälle)“; bei Abweichung folgen bis zu fünf Fälle mit ist/soll. Die Falltabelle rechte-faelle.json
// liest auch der Launcher-Test (P7) und prüft damit seine eigene Umsetzung von `darf`. Eigene Helfer im Kopf: die
// gemeinsamen Attrappen (konto-attrappen.mjs) entstehen erst in P3.
import { readFileSync } from 'node:fs';
import {
  BREMSE,
  DOMAIN,
  EINLADUNG_MS,
  FREIGABE_MS,
  FUNKTIONEN,
  GOOGLE_NEU_MS,
  PROTOKOLL_MS,
  SITZUNG_MAX_MS,
  STUFEN,
  VORGANG_MS,
  WERKZEUGE,
  ZWECK_FUNKTION,
  alterKeyGilt,
  bremseAktiv,
  darf,
  funktionFuerRoute,
  googleNeuFaellig,
  istDomainKonto,
  istErsterAdmin,
  kontoGueltig,
  kontoStand,
  kurzName,
  nachFehlversuch,
} from '../konto-kern.js';

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}`);
  }
}

/** Alle Kombinationen der Achsen, in fester Reihenfolge. */
function kreuz(achsen) {
  let faelle = [{}];
  for (const [name, werte] of Object.entries(achsen)) faelle = faelle.flatMap((f) => werte.map((w) => ({ ...f, [name]: w })));
  return faelle;
}

/** Eine Zeile je Tabelle; `pruefe` liefert null oder „ist … soll …“. */
function pruefeFaelle(name, faelle, pruefe) {
  const abw = [];
  for (const f of faelle) {
    const r = pruefe(f);
    if (r !== null) abw.push(`${f.name ?? JSON.stringify(f)} → ${r}`);
  }
  check(`${name} (${faelle.length} Fälle)`, abw.length === 0);
  for (const z of abw.slice(0, 5)) console.log(`     ${z}`);
  if (abw.length > 5) console.log(`     … und ${abw.length - 5} weitere`);
}

const gleich = (ist, soll) => (JSON.stringify(ist) === JSON.stringify(soll) ? null : `ist ${JSON.stringify(ist)} soll ${JSON.stringify(soll)}`);

const JETZT = Date.UTC(2026, 9, 21, 8, 0, 0);
const TAG = 24 * 3600_000;
const FAELLE = JSON.parse(readFileSync(new URL('./rechte-faelle.json', import.meta.url), 'utf8'));

/** Stand aus einem Fall der Tabelle: `exp: 'gueltig'` = jetzt + 1 h, `'abgelaufen'` = genau jetzt (Grenze). */
function standAus(s) {
  if (s === null) return null;
  return { ...s, exp: s.exp === 'gueltig' ? JETZT + 3600_000 : JETZT };
}

const KONTO = { kid: 'k-1', email: 'maria.schmidt@jakobsmedien.com', name: 'Maria Schmidt', art: 'google', stufe: 'kollege', zustand: 'aktiv', tools: [], events: [], bis: null, zoomBis: null };
const GERAET = { gid: 'g-1', jm: true, plattform: 'win', angemeldetSeit: JETZT - TAG };

async function run() {
  // ── Konstanten ──
  check(
    'P1 10.2: Konstanten (Stufen, Werkzeuge, Funktionen, Fristen, Freigabe, Bremse, Domain)',
    JSON.stringify(STUFEN) === '["admin","kollege","externer"]' &&
      JSON.stringify(WERKZEUGE) === '["connect-raum","qa","iveo"]' &&
      JSON.stringify(FUNKTIONEN) === '["launcher-update","katalog","kochbuch","feedback","ki-entwurf","connect-raum","zoom","qa","iveo","admin"]' &&
      SITZUNG_MAX_MS === 30 * TAG && VORGANG_MS === 300_000 && EINLADUNG_MS === 3 * TAG && PROTOKOLL_MS === 365 * TAG &&
      GOOGLE_NEU_MS === 90 * TAG && FREIGABE_MS['qa-relay'] === 3 * TAG && ZWECK_FUNKTION['qa-relay'] === 'qa' &&
      BREMSE.fehlversuche === 5 && BREMSE.sperreMs === 900_000 && DOMAIN === 'jakobsmedien.com',
  );

  // ── Falltabelle: Abdeckung und Rechte (Spec 9.1) ──
  {
    const hat = (p) => FAELLE.some(p);
    const decktMatrix = FUNKTIONEN.every((f) =>
      STUFEN.every((s) => ['gueltig', 'abgelaufen'].every((e) => hat((c) => c.funktion === f && c.stand && c.stand.stufe === s && c.stand.exp === e))),
    );
    const decktRest =
      FUNKTIONEN.every((f) => hat((c) => c.funktion === f && c.stand === null)) &&
      hat((c) => c.stand && c.stand.stufe === 'externer' && c.stand.tools.length > 0 && c.erwartet === true) &&
      hat((c) => c.funktion === 'iveo' && c.event !== null && c.stand && !c.stand.events.includes(c.event)) &&
      STUFEN.every((s) =>
        ['win', 'mac'].every((p) =>
          [true, false].every((jm) => [true, false].every((z) => hat((c) => c.funktion === 'zoom' && c.stand && c.stand.stufe === s && c.stand.plattform === p && c.stand.jm === jm && c.stand.zoom === z))),
        ),
      );
    const namenEinmalig = new Set(FAELLE.map((c) => c.name)).size === FAELLE.length;
    check('P1 10.2: Falltabelle deckt Funktion × Stufe × gültig/abgelaufen, ohne Stand, Werkzeuge, Events und Zoom × Stufe × Freigabe × JM × Plattform ab', decktMatrix && decktRest && namenEinmalig);
    pruefeFaelle('P1 9.1: Rechte nach der Falltabelle', FAELLE, (c) =>
      gleich(darf(standAus(c.stand), c.funktion, { event: c.event ?? undefined, jetzt: JETZT }), c.erwartet),
    );
    const voll = { stufe: 'admin', tools: [...WERKZEUGE], events: [], zoom: true, jm: true, plattform: 'win', exp: JETZT + TAG };
    check(
      'P1 9.1: unbekannte Funktion, unbekannte Stufe, fehlende Uhr, Stand ohne exp → nie erlaubt; launcher-update ohne alles',
      darf(voll, 'irgendwas', { jetzt: JETZT }) === false &&
        darf({ ...voll, stufe: 'chef' }, 'katalog', { jetzt: JETZT }) === false &&
        darf(voll, 'katalog', {}) === false &&
        darf({ ...voll, exp: undefined }, 'katalog', { jetzt: JETZT }) === false &&
        darf(null, 'launcher-update') === true,
    );
  }

  // ── Kontostand (Spec 6.1, 5, 9) ──
  {
    const faelle = kreuz({ stufe: ['admin', 'kollege', 'externer'], bis: [null, JETZT + TAG, JETZT + 30 * TAG, JETZT + 40 * TAG] });
    // Spec 6.3: „Zugang bis“ begrenzt nur den Start (Claim kontoBis, Launcher R4, DO kontoGueltig), nicht die Laufzeit.
    pruefeFaelle('P1 6.1, 6.3: exp = iat + 30 Tage, Zugang bis nur als kontoBis (Stufe × bis)', faelle, (c) => {
      const s = kontoStand({ ...KONTO, stufe: c.stufe, bis: c.bis }, GERAET, JETZT, undefined);
      return gleich([s.iat, s.exp, s.kontoBis], [JETZT, JETZT + 30 * TAG, c.bis]);
    });
  }
  {
    const faelle = kreuz({ stufe: ['admin', 'kollege', 'externer'], zoomBis: [JETZT + 1, JETZT, JETZT - 1, null] });
    pruefeFaelle('P1 5: Zoom im Stand (Stufe × zoomBis nach, gleich, vor iat, keins)', faelle, (c) => {
      const s = kontoStand({ ...KONTO, stufe: c.stufe, zoomBis: c.zoomBis }, GERAET, JETZT, undefined);
      const soll = c.stufe !== 'externer' || (c.zoomBis !== null && c.zoomBis > JETZT);
      return gleich([s.zoom, s.zoomBis], [soll, c.zoomBis]);
    });
  }
  {
    const a = kontoStand(KONTO, GERAET, JETZT, undefined);
    const b = kontoStand(KONTO, { gid: 'g-2', jm: 'ja', plattform: 'linux' }, JETZT, undefined);
    const c = kontoStand(KONTO, { gid: 'g-3', jm: false, plattform: 'mac' }, JETZT, undefined);
    check(
      'P1 5: jm, plattform, gid und angemeldetSeit kommen vom Gerät (fremde Werte → kein JM, mac; ohne angemeldetSeit → jetzt)',
      a.jm === true && a.plattform === 'win' && a.gid === 'g-1' && a.angemeldetSeit === JETZT - TAG &&
        b.jm === false && b.plattform === 'mac' && b.gid === 'g-2' && b.angemeldetSeit === JETZT &&
        c.jm === false && c.plattform === 'mac',
    );
  }
  {
    const geheim = { ...KONTO, art: 'passwort', email: 'ext@firma.example', stufe: 'externer', tools: ['qa', 'zoom', 'iveo', 3], events: ['b|e', 7], passwort: 'pbkdf2-sha256$100000$abc$def', einladung: { hash: 'h', bis: JETZT } };
    const s = kontoStand(geheim, GERAET, JETZT, undefined);
    check(
      'P1 6.1: Stand hat genau die Claims aus 10.3 (v 1, typ sitzung), Werkzeuge nur aus der Liste, ohne Passwort und Einladung',
      JSON.stringify(Object.keys(s)) ===
        '["v","typ","kid","email","name","art","stufe","tools","events","zoom","zoomBis","jm","plattform","gid","iat","exp","kontoBis","angemeldetSeit"]' &&
        s.v === 1 && s.typ === 'sitzung' && JSON.stringify(s.tools) === '["qa","iveo"]' && JSON.stringify(s.events) === '["b|e"]' &&
        !JSON.stringify(s).includes('pbkdf2') && !('einladung' in s),
    );
  }
  check(
    'P1 9: erster Admin (ERSTER_ADMIN in anderer Schreibung und mit Leerzeichen → admin; andere E-Mail, leer oder fehlend → nie; ein E-Mail-Zugang mit der Adresse → nie)',
    kontoStand(KONTO, GERAET, JETZT, '  Maria.Schmidt@JakobsMedien.com ').stufe === 'admin' &&
      kontoStand(KONTO, GERAET, JETZT, 'chefin@jakobsmedien.com').stufe === 'kollege' &&
      kontoStand(KONTO, GERAET, JETZT, '').stufe === 'kollege' &&
      kontoStand(KONTO, GERAET, JETZT, undefined).stufe === 'kollege' &&
      kontoStand({ ...KONTO, art: 'passwort', email: 'chef@firma.example', stufe: 'externer' }, GERAET, JETZT, 'chef@firma.example').stufe === 'externer' &&
      istErsterAdmin('', '') === false && istErsterAdmin('a@b.c', 'A@B.C') === true,
  );
  {
    // Spec 4, OFP8: Google-Konten erneuern höchstens 90 Tage nach der letzten Anmeldung mit Google an diesem Rechner.
    const alter = { 'knapp 90 Tage': GOOGLE_NEU_MS - 1, 'genau 90 Tage': GOOGLE_NEU_MS, '91 Tage': GOOGLE_NEU_MS + TAG, 'ohne Angabe': null };
    const faelle = kreuz({ art: ['google', 'passwort'], alter: Object.keys(alter) }).map((f) => ({ ...f, name: `${f.art} · ${f.alter}` }));
    pruefeFaelle('P1 4: googleNeuFaellig (Anmeldeart × Alter der letzten Anmeldung mit Google; nur Google-Konten, ab 90 Tagen)', faelle, (c) => {
      const seit = alter[c.alter] === null ? null : JETZT - alter[c.alter];
      return gleich(googleNeuFaellig(c.art, seit, JETZT), c.art === 'google' && (seit === null || alter[c.alter] >= GOOGLE_NEU_MS));
    });
  }

  // ── Domain, Gültigkeit, Kurzname (Spec 4, 4.2) ──
  {
    const faelle = [
      ['maria@jakobsmedien.com', true],
      ['Maria.Schmidt@JakobsMedien.COM', true],
      ['  maria@jakobsmedien.com ', true],
      ['maria@x.jakobsmedien.com', false],
      ['maria@jakobsmedien.com.example', false],
      ['jakobsmedien.com@evil.de', false],
      ['maria@evil-jakobsmedien.com', false],
      ['mariajakobsmedien.com', false],
      ['@jakobsmedien.com', false],
      ['a@b@jakobsmedien.com', false],
      ['jakobsmedien.com', false],
      [null, false],
    ].map(([email, soll]) => ({ name: String(email), email, soll }));
    pruefeFaelle('P1 4: Domain-Konto', faelle, (c) => gleich(istDomainKonto(c.email), c.soll));
  }
  {
    const faelle = [
      { name: 'aktiv ohne bis', konto: { zustand: 'aktiv', bis: null }, soll: { ok: true } },
      { name: 'aktiv, bis morgen', konto: { zustand: 'aktiv', bis: JETZT + TAG }, soll: { ok: true } },
      { name: 'aktiv, bis genau jetzt', konto: { zustand: 'aktiv', bis: JETZT }, soll: { ok: false, grund: 'zugang-abgelaufen' } },
      { name: 'aktiv, bis gestern', konto: { zustand: 'aktiv', bis: JETZT - TAG }, soll: { ok: false, grund: 'zugang-abgelaufen' } },
      { name: 'gesperrt', konto: { zustand: 'gesperrt', bis: null }, soll: { ok: false, grund: 'gesperrt' } },
      { name: 'gesperrt und abgelaufen', konto: { zustand: 'gesperrt', bis: JETZT - TAG }, soll: { ok: false, grund: 'gesperrt' } },
      { name: 'unbekannter Zustand', konto: { zustand: 'pausiert', bis: null }, soll: { ok: false, grund: 'gesperrt' } },
      { name: 'kein Konto', konto: null, soll: { ok: false, grund: 'gesperrt' } },
    ];
    pruefeFaelle('P1 6.3: kontoGueltig', faelle, (c) => gleich(kontoGueltig(c.konto, JETZT), c.soll));
  }
  check(
    'P1 4.2: kurzName (zwei Wörter, drei Wörter, klein geschrieben, ein Wort, leer → Teil der E-Mail)',
    kurzName('Maria Schmidt', 'm@x.de') === 'Maria S.' &&
      kurzName('Anna Maria  Schmidt-Berg', 'a@x.de') === 'Anna S.' &&
      kurzName('jonas weber', 'j@x.de') === 'jonas W.' &&
      kurzName('Kim', 'k@x.de') === 'Kim' &&
      kurzName('   ', 'tech@firma.example') === 'tech' &&
      kurzName(undefined, '') === '',
  );

  // ── Routen (Spec 9.1, Nachmessung 3.3) ──
  {
    const faelle = [
      ['GET', '/', null],
      ['GET', '/tools/launcher/latest', 'launcher-update'],
      ['GET', '/tools/launcher/latest/', 'launcher-update'],
      ['GET', '/tools/%6Cauncher/latest', 'launcher-update'],
      ['GET', '/tools/jm-launcher/latest', 'katalog'],
      ['GET', '/tools/jm-copy/latest', 'katalog'],
      ['POST', '/tools/launcher/latest', null],
      ['GET', '/tools/%E0/latest', null],
      ['GET', '/suite.json', 'katalog'],
      ['GET', '/changelog.json', 'katalog'],
      ['GET', '/cookbook.json', 'kochbuch'],
      ['POST', '/suite.json', null],
      ['POST', '/feedback', 'feedback'],
      ['GET', '/feedback', null],
      ['POST', '/cookbook/draft', 'ki-entwurf'],
      ['GET', '/qa/event-123', null],
      ['GET', '/qa/event-123/press', null],
      ['POST', '/qa/event-123/press', null],
      ['GET', '/qa/event-123/pubkey', null],
      ['POST', '/qa/event-123/submit', null],
      ['GET', '/qa/event-123/state', null],
      ['POST', '/qa/event-123', 'qa'],
      ['DELETE', '/qa/event-123', 'qa'],
      ['GET', '/qa/event-123/pending', 'qa'],
      ['POST', '/qa/event-123/ack', 'qa'],
      ['GET', '/connect/raum-123', null],
      ['GET', '/connect/raum-123/state', null],
      ['GET', '/connect/raum-123/ice', null],
      ['GET', '/connect/raum-123/ws', null],
      ['POST', '/connect/raum-123', 'connect-raum'],
      ['DELETE', '/connect/raum-123', 'connect-raum'],
      ['GET', '/zoom-sdk/win-x64', 'zoom'],
      ['GET', '/konto/ich', null],
      ['GET', '/unbekannt', null],
    ].map(([method, pfad, soll]) => ({ name: `${method} ${pfad}`, method, pfad, soll }));
    pruefeFaelle('P1 9.1: funktionFuerRoute', faelle, (c) => gleich(funktionFuerRoute(c.method, c.pfad), c.soll));
  }

  // ── Frist für den alten Schlüssel (Spec 10, EP9) ──
  {
    const bis = '2026-11-20T00:00:00Z';
    const ms = Date.parse(bis);
    const werte = {
      fehlt: [undefined, { gilt: true, bis: null, diagnose: 'ohne-ende' }],
      leer: ['  ', { gilt: true, bis: null, diagnose: 'ohne-ende' }],
      zukunft: [bis, { gilt: true, bis: '2026-11-20T00:00:00.000Z', diagnose: null }],
      grenze: [bis, { gilt: false, bis: '2026-11-20T00:00:00.000Z', diagnose: null }],
      vorbei: [bis, { gilt: false, bis: '2026-11-20T00:00:00.000Z', diagnose: null }],
      datum: ['2026-11-20', { gilt: true, bis: '2026-11-20T00:00:00.000Z', diagnose: null }],
      zone: ['2026-11-20T00:00:00+01:00', { gilt: true, bis: '2026-11-19T23:00:00.000Z', diagnose: null }],
      unlesbar: ['bald', { gilt: true, bis: null, diagnose: 'unlesbar' }],
      ohneZone: ['2026-11-20T10:00', { gilt: true, bis: null, diagnose: 'unlesbar' }],
      falscherTag: ['2026-02-30', { gilt: true, bis: null, diagnose: 'unlesbar' }],
    };
    const jetztFuer = { zukunft: ms - 1, grenze: ms, vorbei: ms + 1, datum: ms - 1, zone: ms - 3600_000 - 1 };
    const faelle = kreuz({ gruppe: ['katalog', 'qa'], wert: Object.keys(werte) }).map((f) => ({ ...f, name: `${f.gruppe} ${f.wert}` }));
    pruefeFaelle('P1 10: alterKeyGilt (Gruppe × ALTKEY_BIS fehlt, leer, Zukunft, genau jetzt, vorbei, Datum, Zone, unlesbar)', faelle, (c) => {
      const env = { ALTKEY_BIS: werte[c.wert][0], ALTKEY_CONNECT_BIS: '2000-01-01' };
      return gleich(alterKeyGilt(env, c.gruppe, jetztFuer[c.wert] ?? ms), werte[c.wert][1]);
    });
    check(
      'P1 10: connect hat einen eigenen Stichtag (ALTKEY_CONNECT_BIS fehlt → gilt; ALTKEY_BIS vorbei wirkt nicht auf connect); fremde Gruppe gilt nie',
      JSON.stringify(alterKeyGilt({ ALTKEY_BIS: '2000-01-01' }, 'connect', ms)) === '{"gilt":true,"bis":null,"diagnose":"ohne-ende"}' &&
        alterKeyGilt({ ALTKEY_CONNECT_BIS: bis }, 'connect', ms + 1).gilt === false &&
        alterKeyGilt({}, 'zoom', ms).gilt === false &&
        alterKeyGilt(undefined, 'katalog', ms).gilt === true,
    );
  }

  // ── Bremse (Spec 4, EP4) ──
  {
    let b = null;
    const verlauf = [];
    for (let i = 1; i <= 5; i++) {
      b = nachFehlversuch(b, JETZT + i * 1000);
      verlauf.push(bremseAktiv(b, JETZT + i * 1000));
    }
    const gesperrtBis = b.bisMs;
    const waehrend = nachFehlversuch(b, JETZT + 60_000);
    const nachAblauf = nachFehlversuch(b, gesperrtBis);
    check(
      'P1 4: Bremse (4 Fehlversuche frei, der 5. sperrt 15 min, Restminuten aufgerundet, Sperre unverändert, danach frei, Erfolg setzt zurück)',
      JSON.stringify(verlauf) === '[0,0,0,0,15]' && gesperrtBis === JETZT + 5000 + 15 * 60_000 &&
        bremseAktiv(b, gesperrtBis - 60_001) === 2 && bremseAktiv(b, gesperrtBis - 1) === 1 && bremseAktiv(b, gesperrtBis) === 0 &&
        JSON.stringify(waehrend) === JSON.stringify(b) &&
        JSON.stringify(nachAblauf) === '{"anzahl":1,"bisMs":null}' &&
        bremseAktiv(null, JETZT) === 0 && JSON.stringify(nachFehlversuch(null, JETZT)) === '{"anzahl":1,"bisMs":null}',
    );
  }

  // ── rein (Plan 10.2: ohne Import, ohne Konsole) ──
  {
    const quelle = readFileSync(new URL('../konto-kern.js', import.meta.url), 'utf8');
    check('P1 10.2: konto-kern.js ohne import und ohne console', !/^\s*import\s/m.test(quelle) && !/\bconsole\./.test(quelle) && !/export default/.test(quelle));
  }
}

run()
  .then(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  })
  .catch((e) => {
    console.error('Test-Harness-Fehler:', e);
    process.exit(1);
  });
