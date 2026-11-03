// P2 · Krypto des Kontos (Spec 4, 4.1, 6.4, 7, 9; Plan 10.3, EP2, EP4, EP5, EP7).
//   node --experimental-strip-types services/release-proxy/test/konto-krypto.test.mjs
// Form „check“ wie konto-kern.test.mjs. Schlüssel entstehen zur Laufzeit (G4: keine hochentropischen Literale im Quelltext);
// Gerätebeweise signiert ein in Node erzeugtes ECDSA-P-256-Paar wie später der Launcher (P8).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  BEWEIS_FENSTER_MS,
  CODE_ALPHABET,
  PBKDF2_ITERATIONEN,
  TOKEN_PRAEFIX,
  beweisText,
  geraetIdAus,
  gleichOhneZeitleck,
  hashePasswort,
  iveoEntschluesseln,
  iveoVerschluesseln,
  neuerBestaetigungsCode,
  neuerEinladungsCode,
  normalisiereCode,
  pruefeGeraeteBeweis,
  pruefePasswort,
  pruefeToken,
  reinerJwk,
  schluesselBrauchbar,
  sha256B64url,
  signiere,
  zufall,
} from '../konto-krypto.js';

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

const JETZT = Date.UTC(2026, 9, 21, 8, 0, 0);
const MIN = 60_000;
const B64URL = /^[A-Za-z0-9_-]+$/;

function testSchluessel(laenge = 32) {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(laenge))));
}
function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
/** Ersetzt das Zeichen an Stelle i durch ein anderes b64url-Zeichen (das erste Zeichen trägt volle 6 Bit). */
function kippe(text, i) {
  const c = text[i] === 'A' ? 'B' : 'A';
  return text.slice(0, i) + c + text.slice(i + 1);
}
async function testGeraet() {
  const paar = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicJwk = await crypto.subtle.exportKey('jwk', paar.publicKey);
  const gid = await geraetIdAus(publicJwk);
  return {
    publicJwk,
    gid,
    async beweis(zweck, bezug, ts) {
      const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, paar.privateKey, new TextEncoder().encode(beweisText(zweck, bezug, ts)));
      return { gid, ts, sig: b64url(sig) };
    },
  };
}

const SITZUNG = {
  v: 1, typ: 'sitzung', kid: 'k-1', email: 'maria@jakobsmedien.com', name: 'Maria Schmidt', art: 'google', stufe: 'kollege',
  tools: [], events: [], zoom: true, zoomBis: null, jm: true, plattform: 'win', gid: 'g-1', iat: JETZT, exp: JETZT + 3600_000,
  kontoBis: null, angemeldetSeit: JETZT,
};
const FREIGABE = { v: 1, typ: 'freigabe', zweck: 'qa-relay', ziel: 'event-123', kid: 'k-1', gid: 'g-1', iat: JETZT, exp: JETZT + 3600_000 };

async function run() {
  const S = testSchluessel();
  const FREMD = testSchluessel();

  check(
    'P2 10.3: Konstanten (Präfix jm1., Alphabet ohne 0/O/1/I mit 32 Zeichen, 100000 Iterationen, Fenster 5 min)',
    TOKEN_PRAEFIX === 'jm1.' && CODE_ALPHABET === '23456789ABCDEFGHJKLMNPQRSTUVWXYZ' && CODE_ALPHABET.length === 32 &&
      PBKDF2_ITERATIONEN === 100_000 && BEWEIS_FENSTER_MS === 5 * MIN,
  );
  check(
    'P2 9: schluesselBrauchbar (32 Byte Base64 und Base64url ja; 16 Byte, 33 Byte, leer, fehlt, kein Base64 nein)',
    schluesselBrauchbar(S) && schluesselBrauchbar(S.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')) &&
      !schluesselBrauchbar(testSchluessel(16)) && !schluesselBrauchbar(testSchluessel(33)) && !schluesselBrauchbar('') &&
      !schluesselBrauchbar(undefined) && !schluesselBrauchbar('kein base64!'),
  );

  // ── Token (EP2, EP3) ──
  {
    const ts = await signiere(S, SITZUNG);
    const tf = await signiere(S, FREIGABE);
    const [, payload, sig] = ts.split('.');
    const zurueckS = await pruefeToken(S, ts, 'sitzung', JETZT);
    const zurueckF = await pruefeToken(S, tf, 'freigabe', JETZT);
    check(
      'P2 10.3: Token-Rundreise Sitzung und Freigabe (Form jm1.<payload>.<sig>, Claims gleich)',
      ts.startsWith('jm1.') && ts.split('.').length === 3 && B64URL.test(payload) && B64URL.test(sig) && sig.length === 43 &&
        JSON.stringify(zurueckS) === JSON.stringify(SITZUNG) && JSON.stringify(zurueckF) === JSON.stringify(FREIGABE),
    );
    const andereNutzlast = b64url(new TextEncoder().encode(JSON.stringify({ ...SITZUNG, stufe: 'admin' })));
    check(
      'P2 10.3: manipulierte Signatur, manipulierte Nutzlast, fremder Schlüssel, Präfix fehlt → null',
      (await pruefeToken(S, `jm1.${payload}.${kippe(sig, 0)}`, 'sitzung', JETZT)) === null &&
        (await pruefeToken(S, `jm1.${andereNutzlast}.${sig}`, 'sitzung', JETZT)) === null &&
        (await pruefeToken(FREMD, ts, 'sitzung', JETZT)) === null &&
        (await pruefeToken(S, ts.slice(4), 'sitzung', JETZT)) === null &&
        (await pruefeToken(S, `jm2.${payload}.${sig}`, 'sitzung', JETZT)) === null,
    );
    check(
      'P2 6.2: Sitzung als Freigabe und Freigabe als Sitzung → null',
      (await pruefeToken(S, ts, 'freigabe', JETZT)) === null && (await pruefeToken(S, tf, 'sitzung', JETZT)) === null,
    );
    const ablauf = await signiere(S, { ...SITZUNG, exp: JETZT });
    const knapp = await signiere(S, { ...SITZUNG, exp: JETZT + 1 });
    const v2 = await signiere(S, { ...SITZUNG, v: 2 });
    const ohneExp = await signiere(S, { ...SITZUNG, exp: undefined });
    check(
      'P2 6.1: exp === jetzt → null, exp = jetzt + 1 → gilt, v 2 → null, ohne exp → null',
      (await pruefeToken(S, ablauf, 'sitzung', JETZT)) === null && (await pruefeToken(S, knapp, 'sitzung', JETZT)) !== null &&
        (await pruefeToken(S, v2, 'sitzung', JETZT)) === null && (await pruefeToken(S, ohneExp, 'sitzung', JETZT)) === null,
    );
    let wirft = 0;
    for (const k of [testSchluessel(16), '', undefined]) {
      try {
        await signiere(k, SITZUNG);
      } catch {
        wirft++;
      }
    }
    const muell = ['', 'jm1.', 'jm1..', 'jm1.a.b.c', 'jm1.!!!.???', null, 42, `jm1.${payload}`];
    let nullen = 0;
    for (const t of muell) if ((await pruefeToken(S, t, 'sitzung', JETZT)) === null) nullen++;
    check(
      'P2 10.3: Müll-Token → null; unbrauchbarer Schlüssel → signiere wirft, pruefeToken null',
      nullen === muell.length && wirft === 3 && (await pruefeToken(testSchluessel(16), ts, 'sitzung', JETZT)) === null,
    );
  }

  // ── Codes (Spec 4.1, 4) ──
  {
    const codes = Array.from({ length: 1000 }, () => neuerBestaetigungsCode());
    const form = new RegExp(`^[${CODE_ALPHABET}]{3}-[${CODE_ALPHABET}]{3}$`);
    check(
      'P2 4.1: Bestätigungscode (1000 Stück: Form XXX-XXX, nur Alphabet, kein 0/O/1/I, nicht alle gleich)',
      codes.every((c) => form.test(c)) && !codes.some((c) => /[0O1I]/.test(c)) && new Set(codes).size > 900,
    );
    const einl = Array.from({ length: 1000 }, () => neuerEinladungsCode());
    const formE = new RegExp(`^[${CODE_ALPHABET}]{4}-[${CODE_ALPHABET}]{4}-[${CODE_ALPHABET}]{4}$`);
    check(
      'P2 4: Einladungscode (1000 Stück: Form XXXX-XXXX-XXXX) und normalisiereCode (klein, Leerzeichen, Bindestriche)',
      einl.every((c) => formE.test(c)) && new Set(einl).size === 1000 &&
        normalisiereCode(' ab2c-d3ef - gh4j ') === 'AB2CD3EFGH4J' && normalisiereCode('XYZ-234') === 'XYZ234' &&
        normalisiereCode(undefined) === '' && normalisiereCode(einl[0]) === einl[0].replace(/-/g, ''),
    );
    const z = [zufall(16), zufall(16), zufall(24)];
    check(
      'P2 zufall und sha256B64url (Länge, b64url, verschieden; „abc“ wie node:crypto)',
      z[0].length === 22 && z[2].length === 32 && z.every((x) => B64URL.test(x)) && z[0] !== z[1] &&
        (await sha256B64url('abc')) === createHash('sha256').update('abc').digest('base64url') &&
        (await sha256B64url('abc')).length === 43,
    );
  }

  // ── Passwort (Spec 4, EP4) ──
  {
    const h1 = await hashePasswort('richtig-und-lang');
    const h2 = await hashePasswort('richtig-und-lang');
    check('P2 4: PBKDF2-Format pbkdf2-sha256$100000$<Salz 16 B>$<Hash 32 B> (b64url)', /^pbkdf2-sha256\$100000\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/.test(h1));
    check(
      'P2 4: PBKDF2-Rundreise, falsches Passwort, zwei Hashes desselben Passworts verschieden',
      (await pruefePasswort('richtig-und-lang', h1)) && (await pruefePasswort('richtig-und-lang', h2)) &&
        !(await pruefePasswort('richtig-und-Lang', h1)) && !(await pruefePasswort('', h1)) && h1 !== h2,
    );
    const [, , salz, hash] = h1.split('$');
    const fremd = [
      `pbkdf2-sha1$100000$${salz}$${hash}`,
      `pbkdf2-sha256$200000$${salz}$${hash}`,
      `pbkdf2-sha256$0$${salz}$${hash}`,
      `pbkdf2-sha256$1e5$${salz}$${hash}`,
      `pbkdf2-sha256$100000$${salz}`,
      `pbkdf2-sha256$100000$${salz.slice(0, 8)}$${hash}`,
      `pbkdf2-sha256$100000$${salz}$${hash.slice(0, 20)}`,
      `pbkdf2-sha256$100000$!!$${hash}`,
      '',
    ];
    let abgelehnt = 0;
    for (const f of fremd) if (!(await pruefePasswort('richtig-und-lang', f))) abgelehnt++;
    check(`P2 4: pruefePasswort lehnt fremde Formen ab (${fremd.length} Fälle, auch mehr als 100000 Iterationen)`, abgelehnt === fremd.length && !(await pruefePasswort(undefined, h1)));
  }

  check(
    'P2 gleichOhneZeitleck (gleich, ungleich, Länge verschieden, leer, kein Text)',
    (await gleichOhneZeitleck('abc', 'abc')) && !(await gleichOhneZeitleck('abc', 'abd')) && !(await gleichOhneZeitleck('abc', 'abcd')) &&
      !(await gleichOhneZeitleck('', '')) && !(await gleichOhneZeitleck('', 'x')) && !(await gleichOhneZeitleck(undefined, undefined)) &&
      !(await gleichOhneZeitleck(1, 1)),
  );

  // ── iveo (Spec 6.4, EP13) ──
  {
    const T = 'test-iveo-token-1234';
    const a = await iveoVerschluesseln(S, T);
    const b = await iveoVerschluesseln(S, T);
    check(
      'P2 6.4: iveo AES-GCM Rundreise, iv 12 Byte je Aufruf neu, Chiffre ohne Klartext',
      (await iveoEntschluesseln(S, a)) === T && (await iveoEntschluesseln(S, b)) === T && a.iv !== b.iv && a.ct !== b.ct &&
        a.iv.length === 16 && B64URL.test(a.ct) && !a.ct.includes(T),
    );
    let wirft = 0;
    for (const k of [testSchluessel(16), undefined]) {
      try {
        await iveoVerschluesseln(k, T);
      } catch {
        wirft++;
      }
    }
    try {
      await iveoVerschluesseln(S, '');
    } catch {
      wirft++;
    }
    check(
      'P2 6.4: iveo falscher Schlüssel, manipuliertes ct, manipuliertes iv, fremde Form → null; unbrauchbarer Schlüssel oder leeres Token → wirft',
      (await iveoEntschluesseln(FREMD, a)) === null && (await iveoEntschluesseln(S, { iv: a.iv, ct: kippe(a.ct, 0) })) === null &&
        (await iveoEntschluesseln(S, { iv: kippe(a.iv, 0), ct: a.ct })) === null && (await iveoEntschluesseln(S, { iv: a.iv })) === null &&
        (await iveoEntschluesseln(S, null)) === null && wirft === 3,
    );
  }

  // ── Gerät (Spec 7, EP7) ──
  {
    const g = await testGeraet();
    const h = await testGeraet();
    const roh = { ...g.publicJwk, d: 'x' };
    check(
      'P2 7: geraetIdAus stabil, 22 Zeichen b64url, verschieden je Schlüssel; ungültiger Schlüssel → null; reinerJwk ohne Beiwerk, mit d → null',
      g.gid.length === 22 && B64URL.test(g.gid) && (await geraetIdAus(g.publicJwk)) === g.gid && g.gid !== h.gid &&
        (await geraetIdAus(reinerJwk(g.publicJwk))) === g.gid &&
        JSON.stringify(Object.keys(reinerJwk(g.publicJwk))) === '["kty","crv","x","y"]' && reinerJwk(roh) === null &&
        (await geraetIdAus({ kty: 'EC', crv: 'P-256', x: 'a', y: 'b' })) === null && (await geraetIdAus(null)) === null &&
        (await geraetIdAus({ ...g.publicJwk, crv: 'P-384' })) === null,
    );
    const ok = await g.beweis('abholen', 'v-1', JETZT);
    check(
      'P2 7: Gerätebeweis gültig, auch an der Grenze ±5 min',
      (await pruefeGeraeteBeweis(g.publicJwk, ok, 'abholen', 'v-1', JETZT)) &&
        (await pruefeGeraeteBeweis(g.publicJwk, await g.beweis('erneuern', 'k-1', JETZT - 5 * MIN), 'erneuern', 'k-1', JETZT)) &&
        (await pruefeGeraeteBeweis(g.publicJwk, await g.beweis('erneuern', 'k-1', JETZT + 5 * MIN), 'erneuern', 'k-1', JETZT)),
    );
    const falsch = [
      ['falscher Zweck', g.publicJwk, ok, 'erneuern', 'v-1'],
      ['falscher Bezug', g.publicJwk, ok, 'abholen', 'v-2'],
      ['ts − 6 min', g.publicJwk, await g.beweis('abholen', 'v-1', JETZT - 6 * MIN), 'abholen', 'v-1'],
      ['ts + 6 min', g.publicJwk, await g.beweis('abholen', 'v-1', JETZT + 6 * MIN), 'abholen', 'v-1'],
      ['fremder Schlüssel', h.publicJwk, { ...ok, gid: h.gid }, 'abholen', 'v-1'],
      ['gid passt nicht', g.publicJwk, { ...ok, gid: h.gid }, 'abholen', 'v-1'],
      ['Signatur verändert', g.publicJwk, { ...ok, sig: kippe(ok.sig, 0) }, 'abholen', 'v-1'],
      ['ts verändert', g.publicJwk, { ...ok, ts: JETZT + 1 }, 'abholen', 'v-1'],
      ['ohne Beweis', g.publicJwk, null, 'abholen', 'v-1'],
      ['ts als Text', g.publicJwk, { ...ok, ts: String(JETZT) }, 'abholen', 'v-1'],
    ];
    const durch = [];
    for (const [name, jwk, beweis, zweck, bezug] of falsch) if (await pruefeGeraeteBeweis(jwk, beweis, zweck, bezug, JETZT)) durch.push(name);
    check(`P2 7: Gerätebeweis falsch → false (${falsch.length} Fälle)`, durch.length === 0);
    for (const n of durch.slice(0, 5)) console.log(`     ${n} → ist true soll false`);
  }

  // ── Log-Hygiene und rein ──
  {
    const mitschnitt = [];
    const alt = { log: console.log, warn: console.warn, error: console.error, info: console.info, debug: console.debug };
    for (const k of Object.keys(alt)) console[k] = (...a) => mitschnitt.push(a.join(' '));
    try {
      await pruefeToken(S, 'jm1.x.y', 'sitzung', JETZT);
      await pruefeToken(testSchluessel(16), 'jm1.x.y', 'sitzung', JETZT);
      await pruefePasswort('x', 'kaputt$$');
      await iveoEntschluesseln(FREMD, await iveoVerschluesseln(S, 'test-geheim'));
      await pruefeGeraeteBeweis({ kty: 'EC' }, { gid: 'x', ts: JETZT, sig: '!!' }, 'abholen', 'v', JETZT);
      await geraetIdAus({ kty: 'EC', crv: 'P-256', x: 'A'.repeat(43), y: 'A'.repeat(43) });
      try {
        await signiere('', SITZUNG);
      } catch {
        /* erwartet */
      }
    } finally {
      Object.assign(console, alt);
    }
    check('P2 Log-Hygiene: Konsole bleibt bei allen Fehlern leer', mitschnitt.length === 0);
    const quelle = readFileSync(new URL('../konto-krypto.js', import.meta.url), 'utf8');
    check(
      'P2 10.3: konto-krypto.js ohne Import, ohne node:, ohne console, ohne Default-Export',
      !/^\s*import\s/m.test(quelle) && !/['"]node:/.test(quelle) && !/\bconsole\./.test(quelle) && !/export default/.test(quelle),
    );
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
