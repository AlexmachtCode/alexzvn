// Launcher-API /konto/* (Anmeldung im Launcher, Plan Teil 1, P16; Vertrag 10.1; Spec 4.1, 6.1–6.4, 7, 8, 9; EP1–EP3, EP13).
//
// handleKonto(request, env, url, ctx) beantwortet jeden Pfad unter /konto/ (sonst null, worker.js macht weiter). Hier
// entstehen Sitzungen und Freigaben (signiert mit KONTO_SCHLUESSEL, EP2/EP3), hier werden iveo-Tokens ver- und
// entschlüsselt (IVEO_SCHLUESSEL, EP13); der Konten-DO (konto-do.js) kennt keinen der beiden Schlüssel und sieht iveo-Tokens
// nur als { iv, ct }. Jede Anfrage an den DO baut kontoAktion neu, ohne eine Kopfzeile des Clients (Lehre B1).
// Antworten: JSON mit cache-control no-store; Fehler { error: Text S…, code } (Texttabelle 9.6, EP17). Kein Token,
// Abholgeheimnis, Code, Passwort oder Schlüssel geht ins Log oder in eine Fehlermeldung.
import { googleBereit, googleRueckkehr, googleStartAdresse } from './konto-google.js';
import { FREIGABE_MS, ZWECK_FUNKTION, darf, kontoStand } from './konto-kern.js';
import { BEWEIS_FENSTER_MS, iveoEntschluesseln, iveoVerschluesseln, neuerBestaetigungsCode, pruefeToken, schluesselBrauchbar, sha256B64url, signiere, zufall } from './konto-krypto.js';
import { datumText, esc, fuelle, htmlAntwort, seiteAnmelden, seiteBestaetigen, seiteMeldung } from './konto-seiten.js';
import { abgelehnt, kontoAktion, kontoJetzt, kontoStub } from './konto-zugang.js';

// Vertrag 10.1: P16 liefert kontoStub(env); er liegt seit P15 in konto-zugang.js (Alt-Key-Zählung).
export { kontoStub } from './konto-zugang.js';

const KONTO = {
  apiBytes: 16 * 1024, // JSON-Body der Launcher-API (Admin-Aktion mit iveo-Token und Event-Liste)
  vorgang: { rlMax: 10, rlWindowSec: 600 }, // POST /konto/vorgang je IP (EP5)
  formBytes: 8 * 1024, // Formulare der Anmeldeseite (P17)
  passwort: { rlMax: 20, rlWindowSec: 600 }, // POST /konto/passwort je IP (EP4), vor der Bremse je Konto im DO
};

/** Methode und Pfad (ohne Schrägstrich am Ende) → Handler. Nur diese Routen gibt es unter /konto/. */
const ROUTEN = {
  'POST /konto/vorgang': vorgangAnlegen,
  'POST /konto/vorgang/abholen': vorgangAbholen,
  'POST /konto/vorgang/abbrechen': vorgangAbbrechen,
  'POST /konto/sitzung': sitzungErneuern,
  'POST /konto/abmelden': abmelden,
  'GET /konto/ich': ich,
  'POST /konto/freigabe': freigabe,
  'GET /konto/iveo': iveo,
  'POST /konto/zoom-anfrage': zoomAnfrage,
  'GET /konto/admin/uebersicht': adminUebersicht,
  'POST /konto/admin/aktion': adminAktion,
  'GET /konto/anmelden': seiteAnmeldenRoute,
  'POST /konto/passwort': passwortRoute,
  'POST /konto/bestaetigen': bestaetigenRoute,
  'GET /konto/google': googleStartRoute,
  'GET /konto/google/zurueck': googleZurueckRoute,
  // ── Ende der Routen ──
};

/** Routen mit HTML-Antwort (Anmeldeseite, P17/P18); ohne Einrichtung zeigen sie S5 als Seite statt als JSON. */
const SEITEN = new Set([
  'GET /konto/anmelden',
  'POST /konto/passwort',
  'POST /konto/bestaetigen',
  'GET /konto/google',
  'GET /konto/google/zurueck',
  // ── Ende der Seiten ──
]);

/**
 * Alle Pfade unter /konto/ → Response; andere Pfade → null. Ohne KONTO_SCHLUESSEL, ohne Bindung KONTO oder ohne die
 * verlangte Jurisdiction → 503 S5 (der Rest des Workers läuft weiter).
 */
export async function handleKonto(request, env, url, ctx) {
  if (url.pathname !== '/konto' && !url.pathname.startsWith('/konto/')) return null;
  const schluessel = `${request.method} ${url.pathname.replace(/\/+$/, '')}`;
  const route = Object.hasOwn(ROUTEN, schluessel) ? ROUTEN[schluessel] : null;
  if (!route) return fehler(abgelehnt('ungueltig', 404));
  let bereit = schluesselBrauchbar(env.KONTO_SCHLUESSEL) && !!env.KONTO;
  if (bereit) {
    try {
      kontoStub(env);
    } catch {
      bereit = false; // Jurisdiction verlangt, aber nicht unterstützt: laut scheitern statt still global (wie Connect)
    }
  }
  if (!bereit) {
    console.warn('konto: Anmeldung nicht eingerichtet (KONTO_SCHLUESSEL, Bindung KONTO oder Jurisdiction fehlt)');
    return nichtEingerichtet(SEITEN.has(schluessel));
  }
  const jetzt = kontoJetzt(env);
  const k = {
    request,
    env,
    url,
    ctx,
    jetzt,
    // Jede Anfrage an den Konten-DO entsteht in kontoAktion neu (Lehre B1): keine Kopfzeile des Clients.
    rufe: (aktion, daten) => kontoAktion(env, aktion, { ...daten, jetzt }),
  };
  try {
    return await route(k);
  } catch (e) {
    if (e instanceof Abgelehnt) return fehler(e.fehler);
    console.warn(`konto: ${schluessel} fehlgeschlagen (${fehlerName(e)})`);
    if (SEITEN.has(schluessel)) return htmlAntwort(seiteMeldung({ text: esc('interner Fehler'), fehler: true }), 502);
    return json({ error: 'interner Fehler', code: 'server' }, 502);
  }
}

// ── Launcher-API (Vertrag 10.1) ──────────────────────────────────────────────────────────────────────────────────────

/** POST /konto/vorgang: Anmeldevorgang mit Code und Abholgeheimnis (Spec 4.1 Schritt 1; EP5). */
async function vorgangAnlegen(k) {
  const rl = await drossel(k, 'konto-vorgang', KONTO.vorgang);
  if (!rl.ok) return zuViele(rl.retryAfter);
  const d = await liesJson(k.request);
  const g = d.geraet && typeof d.geraet === 'object' ? d.geraet : null;
  if (!g) return fehler(abgelehnt('ungueltig', 400));
  const abholGeheimnis = zufall(32);
  const code = neuerBestaetigungsCode();
  const r = await k.rufe('vorgang-anlegen', {
    geraet: { publicJwk: g.publicJwk, name: g.name, plattform: g.plattform, arch: g.arch, version: g.version },
    abholHash: await sha256B64url(abholGeheimnis),
    code,
  });
  if (!r.ok) return doFehler(r);
  const adresse = `${k.url.origin}/konto/anmelden?v=${encodeURIComponent(r.vorgang)}`;
  return json({ vorgang: r.vorgang, abholGeheimnis, code, adresse, bis: r.bis });
}

/** POST /konto/vorgang/abholen: wartet, bestätigt (dann Sitzung und Stand), abgelehnt oder abgelaufen (Spec 4.1 Schritt 4). */
async function vorgangAbholen(k) {
  const d = await liesJson(k.request);
  if (!text(d.vorgang) || !text(d.abholGeheimnis)) return fehler(abgelehnt('ungueltig', 400));
  if (uhrDaneben(d.beweis, k.jetzt)) return fehler(abgelehnt('uhr', 400));
  const r = await k.rufe('vorgang-abholen', { vorgang: d.vorgang, abholHash: await sha256B64url(d.abholGeheimnis), beweis: d.beweis });
  if (!r.ok) return doFehler(r);
  if (r.zustand !== 'bestaetigt') return json({ zustand: r.zustand });
  return json({ zustand: 'bestaetigt', ...(await sitzungAusstellen(k, r.konto, r.geraet)) });
}

/** POST /konto/vorgang/abbrechen: Launcher bricht ab (nur mit Abholgeheimnis). */
async function vorgangAbbrechen(k) {
  const d = await liesJson(k.request);
  if (!text(d.vorgang) || !text(d.abholGeheimnis)) return fehler(abgelehnt('ungueltig', 400));
  const r = await k.rufe('vorgang-abbrechen', { vorgang: d.vorgang, abholHash: await sha256B64url(d.abholGeheimnis) });
  if (!r.ok) return doFehler(r);
  return json({ ok: true });
}

/**
 * POST /konto/sitzung: Start-Prüfung = Erneuerung mit Gerätebeweis (EP2). Der DO liest den aktuellen Stand; die neue Sitzung
 * hält ihn bis zum nächsten Start fest (Spec 6.1, 6.3).
 */
async function sitzungErneuern(k) {
  const stand = await sitzungAus(k);
  const d = await liesJson(k.request);
  if (uhrDaneben(d.beweis, k.jetzt)) return fehler(abgelehnt('uhr', 400));
  const r = await k.rufe('sitzung-erneuern', {
    kid: stand.kid,
    gid: stand.gid,
    beweis: d.beweis,
    version: typeof d.version === 'string' ? d.version : '',
    rechnerName: typeof d.rechnerName === 'string' ? d.rechnerName : '',
  });
  if (!r.ok) return doFehler(r);
  return json(await sitzungAusstellen(k, r.konto, r.geraet));
}

/** POST /konto/abmelden: best effort, merkt nur den letzten Kontakt des Geräts (EP26). */
async function abmelden(k) {
  const stand = await sitzungAus(k);
  const r = await k.rufe('abmelden', { kid: stand.kid, gid: stand.gid });
  if (!r.ok) return doFehler(r);
  return json({ ok: true });
}

/** GET /konto/ich: aktueller Stand im DO für „Zugang entzogen“, Zoom-Anfrage und den Admin-Punkt (EP15, EP23). */
async function ich(k) {
  const stand = await sitzungAus(k);
  const r = await k.rufe('ich', { kid: stand.kid });
  if (!r.ok) return doFehler(r);
  return json({ kontoAktiv: r.kontoAktiv, grund: r.grund, zoomAnfrage: r.zoomAnfrage, adminOffen: r.adminOffen });
}

/**
 * POST /konto/freigabe: befristete Freigabe für ein Tool (EP3), nur aus den Claims der Sitzung, ohne DO: ein Tool-Neustart
 * übernimmt den beim Start festgehaltenen Stand, auch nach einem Entzug (Spec 6.1, 6.3). Laufzeit nach FREIGABE_MS, auch über
 * „Zugang bis“ hinaus (Ablauf wirkt erst beim nächsten Start des Launchers, Spec 6.3). Eine Freigabe ist nie die Sitzung selbst.
 */
async function freigabe(k) {
  const stand = await sitzungAus(k);
  const d = await liesJson(k.request);
  const zweck = typeof d.zweck === 'string' ? d.zweck : '';
  if (!Object.hasOwn(ZWECK_FUNKTION, zweck)) return fehler(abgelehnt('unbekannter-zweck', 400));
  const ziel = typeof d.ziel === 'string' ? d.ziel.trim() : '';
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(ziel)) return fehler(abgelehnt('ungueltig', 400));
  if (!darf(stand, ZWECK_FUNKTION[zweck], { jetzt: k.jetzt })) return fehler(abgelehnt('kein-recht', 403));
  const bis = k.jetzt + FREIGABE_MS[zweck];
  const claims = { v: 1, typ: 'freigabe', zweck, ziel, kid: stand.kid, gid: stand.gid, iat: k.jetzt, exp: bis };
  return json({ freigabe: await signiere(k.env.KONTO_SCHLUESSEL, claims), bis });
}

/**
 * GET /konto/iveo: die iveo-Tokens, die dieser Stand nutzen darf, entschlüsselt (Spec 6.4, EP13). Der Launcher hält sie nur
 * im Speicher. Ohne IVEO_SCHLUESSEL eine leere Liste mit Hinweis (Diagnose statt Schweigen, G7).
 */
async function iveo(k) {
  const stand = await sitzungAus(k);
  if (!schluesselBrauchbar(k.env.IVEO_SCHLUESSEL)) return json({ events: [], hinweis: 'iveo-nicht-eingerichtet' });
  const r = await k.rufe('iveo-fuer', { stufe: stand.stufe, tools: stand.tools, events: stand.events });
  if (!r.ok) return doFehler(r);
  const events = [];
  let unlesbar = 0;
  for (const e of Array.isArray(r.events) ? r.events : []) {
    if (!darf(stand, 'iveo', { event: e.key, jetzt: k.jetzt })) continue;
    const token = await iveoEntschluesseln(k.env.IVEO_SCHLUESSEL, { iv: e.iv, ct: e.ct });
    if (token === null) {
      unlesbar++;
      continue;
    }
    events.push({ key: e.key, basis: e.basis, slug: e.slug, name: e.name, token });
  }
  if (unlesbar) console.warn(`konto: ${unlesbar} iveo-Token nicht entschlüsselbar (IVEO_SCHLUESSEL gewechselt?)`);
  return json({ events });
}

/** POST /konto/zoom-anfrage: nur Externe (Spec 8 Schritt 1); Kollegen und Admins dürfen Zoom ohnehin (S13). */
async function zoomAnfrage(k) {
  const stand = await sitzungAus(k);
  if (stand.stufe !== 'externer') return fehler(abgelehnt('nicht-noetig', 400));
  const d = await liesJson(k.request);
  const r = await k.rufe('zoom-anfragen', { kid: stand.kid, gid: stand.gid, zweck: d.zweck, von: d.von, bis: d.bis });
  if (!r.ok) return doFehler(r, 'zoom');
  return json({ anfrage: r.anfrage });
}

/** GET /konto/admin/uebersicht: nur aktuelle Admins; das prüft der DO am aktuellen Stand (OFP4), nicht an den Claims. */
async function adminUebersicht(k) {
  const stand = await sitzungAus(k);
  const r = await k.rufe('admin-uebersicht', { kid: stand.kid });
  if (!r.ok) return doFehler(r);
  const { ok: _ok, ...daten } = r;
  return json(daten);
}

/**
 * POST /konto/admin/aktion: nur aktuelle Admins (DO, OFP4). Beim Hinterlegen eines iveo-Tokens verschlüsselt der Worker es
 * je Event (AES-GCM, iv je Event neu) und reicht dem DO nur { iv, ct } weiter; das Token selbst erreicht den DO nie.
 */
async function adminAktion(k) {
  const stand = await sitzungAus(k);
  const d = await liesJson(k.request);
  let aktion = d;
  if (d.aktion === 'iveo-hinterlegen') {
    if (!schluesselBrauchbar(k.env.IVEO_SCHLUESSEL)) return fehler(abgelehnt('nicht-eingerichtet', 503));
    const token = typeof d.token === 'string' ? d.token.trim() : '';
    const liste = Array.isArray(d.events) ? d.events : [];
    if (!token || !liste.length || !liste.every((e) => e && typeof e.slug === 'string' && e.slug)) return fehler(abgelehnt('ungueltig', 400));
    const events = [];
    for (const e of liste) {
      const { iv, ct } = await iveoVerschluesseln(k.env.IVEO_SCHLUESSEL, token);
      events.push({ slug: e.slug, name: typeof e.name === 'string' ? e.name : '', iv, ct });
    }
    aktion = { aktion: 'iveo-hinterlegen', basis: d.basis, events };
  }
  const r = await k.rufe('admin-aktion', { kid: stand.kid, aktion });
  if (!r.ok) return doFehler(r, d.aktion === 'einladen' ? 'email' : 'admin');
  return json(r);
}

// ── Helfer ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ablehnung als Ausnahme, damit Handler mit `await sitzungAus(k)` und `await liesJson(…)` gerade bleiben. */
class Abgelehnt extends Error {
  constructor(f) {
    super(f.code);
    this.fehler = f;
  }
}

/** Claims der Sitzung aus `Authorization: Bearer jm1.…`; sonst 401 S2 (echt, aber abgelaufen) bzw. S1. */
async function sitzungAus(k) {
  const auth = k.request.headers.get('Authorization') || '';
  const token = /^Bearer\s+/i.test(auth) ? auth.replace(/^Bearer\s+/i, '').trim() : '';
  const stand = token ? await pruefeToken(k.env.KONTO_SCHLUESSEL, token, 'sitzung', k.jetzt) : null;
  if (stand) return stand;
  const abgelaufen = token ? await pruefeToken(k.env.KONTO_SCHLUESSEL, token, 'sitzung', 0) : null;
  throw new Abgelehnt(abgelehnt(abgelaufen ? 'sitzung-abgelaufen' : 'nicht-angemeldet', 401));
}

/** Neue Sitzung aus Konto und Gerät (Kontostand nach P1, EP2): `{ sitzung, stand }`. */
async function sitzungAusstellen(k, konto, geraet) {
  const stand = kontoStand(konto, geraet, k.jetzt, k.env.ERSTER_ADMIN);
  return { sitzung: await signiere(k.env.KONTO_SCHLUESSEL, stand), stand };
}

/**
 * Body höchstens `max` Bytes: größer als content-length verspricht → null ohne zu lesen; ohne Body → leer; sonst Stück für
 * Stück gelesen und beim Überschreiten abgebrochen (null), auch ohne content-length (Stream).
 */
async function liesBegrenzt(request, max) {
  const cl = request.headers.get('content-length');
  if (cl && Number(cl) > max) return null;
  if (!request.body) return new Uint8Array(0);
  const leser = request.body.getReader();
  const stuecke = [];
  let summe = 0;
  for (;;) {
    const { done, value } = await leser.read();
    if (done) break;
    summe += value.byteLength;
    if (summe > max) {
      await leser.cancel().catch(() => {});
      return null;
    }
    stuecke.push(value);
  }
  const alles = new Uint8Array(summe);
  let pos = 0;
  for (const s of stuecke) {
    alles.set(s, pos);
    pos += s.byteLength;
  }
  return alles;
}

/** JSON-Body bis KONTO.apiBytes; leer → {}; kein Objekt oder zu groß → 400 S11. */
async function liesJson(request) {
  const buf = await liesBegrenzt(request, KONTO.apiBytes);
  if (buf === null) throw new Abgelehnt(abgelehnt('ungueltig', 400));
  if (buf.byteLength === 0) return {};
  try {
    const d = JSON.parse(new TextDecoder().decode(buf));
    if (d && typeof d === 'object' && !Array.isArray(d)) return d;
  } catch {
    // unten
  }
  throw new Abgelehnt(abgelehnt('ungueltig', 400));
}

function text(v) {
  return typeof v === 'string' && v.length > 0 && v.length <= 256;
}

/**
 * EP30: Zeit des Gerätebeweises mehr als 5 min (BEWEIS_FENSTER_MS) neben der Uhr des Workers → 400 S18, bevor der DO den Beweis
 * als fremdes Gerät ablehnt (403 S9 ließ den Launcher die Sitzung löschen). Nur die Zeit; die Signatur prüft der DO.
 */
function uhrDaneben(beweis, jetzt) {
  return !!beweis && typeof beweis === 'object' && typeof beweis.ts === 'number' && Math.abs(jetzt - beweis.ts) > BEWEIS_FENSTER_MS;
}

/** Fehler des DO → Vertrag 10.1; 5xx des DO → 502 „interner Fehler“ (Bestandstext von worker.js). */
function doFehler(r, konflikt) {
  if (doAusfall(r)) return json({ error: 'interner Fehler', code: 'server' }, 502);
  return fehler(abgelehnt(r.code, r.status, konflikt));
}

/** Antwort des DO ohne Status oder mit 5xx: ein Ausfall, kein fachlicher Grund. */
function doAusfall(r) {
  return !r || typeof r.status !== 'number' || r.status >= 500;
}

/** Ausfall des DO auf einer Seiten-Route: Seite „interner Fehler“ (502) statt B10/B11/B12. */
function ausfallSeite() {
  return htmlAntwort(seiteMeldung({ text: esc('interner Fehler'), fehler: true }), 502);
}

function fehler(f) {
  return json({ error: f.error, code: f.code }, f.status);
}

/** Ohne Einrichtung: 503 S5, für die Routen der Anmeldeseite als Seite, sonst als JSON. */
function nichtEingerichtet(seite) {
  const f = abgelehnt('nicht-eingerichtet', 503);
  return seite ? htmlAntwort(seiteMeldung({ text: esc(f.error), fehler: true }), 503) : fehler(f);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function zuViele(retryAfter) {
  return new Response(JSON.stringify({ error: 'zu viele Anfragen', code: 'zu-viele' }), {
    status: 429,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'Retry-After': String(retryAfter || 60) },
  });
}

/**
 * Fixed-Window-Drossel je IP über RATELIMIT (wie worker.js), mit der Uhr der Anmeldung. Ohne Bindung: Warnung, offen. Die IP steht
 * nur als Hash mit dem Worker-Secret im Schlüssel (Spec 11, OFP2: keine IP-Adressen speichern; KV liegt nicht in der EU).
 */
async function drossel(k, bucket, { rlMax, rlWindowSec }) {
  if (!k.env.RATELIMIT) {
    console.warn(`rate-limit: KV-Bindung RATELIMIT fehlt — ${bucket} ungedrosselt`);
    return { ok: true };
  }
  const ip = k.request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = (await sha256B64url(`${k.env.KONTO_SCHLUESSEL ?? ''}|${ip}`)).slice(0, 22);
  const nowSec = Math.floor(k.jetzt / 1000);
  const key = `rl:${bucket}:${ipHash}:${Math.floor(nowSec / rlWindowSec)}`;
  const current = Number((await k.env.RATELIMIT.get(key)) || 0);
  if (current >= rlMax) return { ok: false, retryAfter: rlWindowSec - (nowSec % rlWindowSec) };
  await k.env.RATELIMIT.put(key, String(current + 1), { expirationTtl: rlWindowSec * 2 });
  return { ok: true };
}

/** Nur der Name eines Fehlers, nie die Meldung (wie worker.js). */
function fehlerName(e) {
  return (e && typeof e.name === 'string' && e.name) || 'unbekannt';
}

// ── Anmeldeseite im Browser (P17; Spec 4.1 Schritte 2–4, Texte B1–B17, B21–B23) ─────────────────────────────────────

/** Google-Anmeldung eingerichtet? Ohne Client zeigt die Seite B6 und nur die Passwort-Anmeldung (EP6). */
function googleDa(env) {
  return googleBereit(env);
}

/** Formular (application/x-www-form-urlencoded) bis KONTO.formBytes; größer → null. */
async function liesFormular(request) {
  const buf = await liesBegrenzt(request, KONTO.formBytes);
  if (buf === null) return null;
  return new URLSearchParams(new TextDecoder().decode(buf));
}

/** Seite mit einem Text aus der Tabelle 9.5. */
function meldung(nr, status = 200, werte) {
  return htmlAntwort(seiteMeldung({ text: fuelle(nr, werte), fehler: status >= 400 }), status);
}

/** GET /konto/anmelden?v=<vorgang>: Anmeldeseite; ohne Vorgang B22, unbekannt oder abgelaufen 404 B10. */
async function seiteAnmeldenRoute(k) {
  const vorgang = k.url.searchParams.get('v') || '';
  if (!vorgang) return meldung('B22');
  const r = await k.rufe('vorgang-lesen', { vorgang });
  if (!r.ok && doAusfall(r)) return ausfallSeite();
  if (!r.ok) return meldung('B10', 404);
  if (r.zustand === 'bestaetigt') return meldung('B8');
  if (r.zustand === 'abgelehnt') return meldung('B9');
  return htmlAntwort(seiteAnmelden({ vorgang, google: googleDa(k.env) }));
}

/**
 * POST /konto/passwort: Externe mit E-Mail und Passwort oder mit Einladungscode und neuem Passwort (Spec 4, EP4). Zuerst die
 * Drossel je IP (`konto-pw`, 20 je 600 s), die Bremse je Konto prüft der DO. Fehler zeigen die Anmeldeseite mit B12–B17, B21,
 * B23 und der eingegebenen E-Mail, nie mit dem Passwort. Erfolg zeigt die Bestätigungsseite (B7).
 */
async function passwortRoute(k) {
  const rl = await drossel(k, 'konto-pw', KONTO.passwort);
  const f = await liesFormular(k.request);
  const vorgang = f ? (f.get('v') || '').trim() : '';
  const email = f ? (f.get('email') || '').trim().slice(0, 200) : '';
  const seite = (nr, status, werte = {}, einladungOffen = false, extra = {}) =>
    htmlAntwort(seiteAnmelden({ vorgang, google: googleDa(k.env), fehler: fuelle(nr, werte), email, einladungOffen }), status, extra);
  if (!rl.ok) return seite('B21', 429, {}, false, { 'Retry-After': String(rl.retryAfter || 60) });
  if (!f || !vorgang) return meldung('B10', 400);
  const mitCode = (f.get('einladungscode') || '').trim() !== '';
  const daten = mitCode
    ? { vorgang, email, einladungscode: f.get('einladungscode'), neu: f.get('neu') || '', neu2: f.get('neu2') || '' }
    : { vorgang, email, passwort: f.get('passwort') || '' };
  const r = await k.rufe('vorgang-passwort', daten);
  if (r.ok) {
    return htmlAntwort(seiteBestaetigen({ vorgang, seitenToken: r.seitenToken, email: r.email, code: r.code, rechnerName: r.rechnerName }));
  }
  if (doAusfall(r)) return ausfallSeite();
  switch (r.code) {
    case 'falsch':
    case 'ungueltig':
      return seite('B12', 401);
    case 'einladung':
      return seite('B14', 401, {}, true);
    case 'bremse':
      return seite('B13', 429, { n: r.minuten }, mitCode);
    case 'passwort-ungleich':
      return seite('B15_ungleich', 400, {}, true);
    case 'passwort-kurz':
      return seite('B15_kurz', 400, {}, true);
    case 'gesperrt':
      return seite('B16', 403);
    case 'zugang-abgelaufen':
      return seite('B17', 403, { Datum: datumText(r.bis) });
    case 'domain':
      return seite('B23', 400);
    case 'konflikt':
      return meldung('B11', 409);
    case 'vorgang-unbekannt':
      return meldung('B10', 404);
    default:
      return htmlAntwort(seiteMeldung({ text: esc('interner Fehler'), fehler: true }), 502);
  }
}

/** POST /konto/bestaetigen: Ja oder Nein mit Seitentoken (Spec 4.1 Schritt 4); ohne gültiges Seitentoken 403 B10. */
async function bestaetigenRoute(k) {
  const f = await liesFormular(k.request);
  const vorgang = f ? (f.get('v') || '').trim() : '';
  const seitenToken = f ? (f.get('t') || '').trim() : '';
  const antwort = f ? f.get('antwort') : '';
  if (!vorgang || !seitenToken || (antwort !== 'ja' && antwort !== 'nein')) return meldung('B10', 403);
  const r = await k.rufe('vorgang-bestaetigen', { vorgang, seitenToken, antwort });
  if (r.ok) return meldung(r.zustand === 'bestaetigt' ? 'B8' : 'B9');
  if (doAusfall(r)) return ausfallSeite();
  return meldung(r.code === 'konflikt' ? 'B11' : 'B10', 403);
}

// ── Google-Anmeldung (P18; Spec 4, 4.1 Schritt 2; EP6; Texte B6, B10, B11, B16–B20) ──────────────────────────────────

/** Rückkehradresse bei Google (im Client des Owners eingetragen, EP6): <origin>/konto/google/zurueck. */
function googleZurueckAdresse(k) {
  return `${k.url.origin}/konto/google/zurueck`;
}

/** GET /konto/google?v=<vorgang>: 302 zu Google mit PKCE S256; state, nonce und verifier merkt der Vorgang im DO. */
async function googleStartRoute(k) {
  if (!googleBereit(k.env)) return meldung('B6', 503);
  const vorgang = k.url.searchParams.get('v') || '';
  if (!vorgang) return meldung('B10', 404);
  const state = zufall(24);
  const nonce = zufall(24);
  const verifier = zufall(48);
  const r = await k.rufe('vorgang-google-merken', { vorgang, state, nonce, verifier });
  if (!r.ok && doAusfall(r)) return ausfallSeite();
  if (!r.ok) return meldung('B10', 404);
  const ziel = await googleStartAdresse(k.env, { state, nonce, verifier, redirectUri: googleZurueckAdresse(k) });
  return new Response(null, { status: 302, headers: { location: ziel, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
}

/**
 * GET /konto/google/zurueck?code=&state=: state gilt genau einmal (DO), dann Code tauschen und prüfen (konto-google.js),
 * Konto finden oder als Kollege anlegen (nur jakobsmedien.com), an den Vorgang binden → Bestätigungsseite (B7).
 */
async function googleZurueckRoute(k) {
  if (!googleBereit(k.env)) return meldung('B6', 503);
  const state = k.url.searchParams.get('state') || '';
  const code = k.url.searchParams.get('code') || '';
  if (!state) return meldung('B10', 404);
  const s = await k.rufe('vorgang-google-state', { state });
  if (!s.ok && doAusfall(s)) return ausfallSeite();
  if (!s.ok) return meldung('B10', 404);
  if (!code || k.url.searchParams.has('error')) return meldung('B20', 400);
  const g = await googleRueckkehr(k.env, { code, verifier: s.verifier, nonce: s.nonce, redirectUri: googleZurueckAdresse(k), jetzt: k.jetzt });
  if (!g.ok) return meldung(g.grund === 'domain' ? 'B18' : g.grund === 'email-unbestaetigt' ? 'B19' : 'B20', 403);
  const a = await k.rufe('konto-aus-google', { email: g.email, name: g.name });
  if (!a.ok) return googleKontoFehler(a);
  const b = await k.rufe('vorgang-konto-binden', { vorgang: s.vorgang, kid: a.kid });
  if (!b.ok) return googleKontoFehler(b);
  return htmlAntwort(seiteBestaetigen({ vorgang: s.vorgang, seitenToken: b.seitenToken, email: b.email, code: b.code, rechnerName: b.rechnerName }));
}

/** Fehler des DO nach der Google-Prüfung als Seite; ein Ausfall des DO (AR53) ist „interner Fehler“, nie B10 oder B11. */
function googleKontoFehler(r) {
  if (doAusfall(r)) return ausfallSeite();
  switch (r.code) {
    case 'gesperrt':
    case 'geloescht':
      return meldung('B16', 403);
    case 'zugang-abgelaufen':
      return meldung('B17', 403, { Datum: datumText(r.bis) });
    case 'domain':
      return meldung('B18', 403);
    case 'konflikt':
      return meldung('B11', 409);
    case 'vorgang-unbekannt':
      return meldung('B10', 404);
    default:
      return htmlAntwort(seiteMeldung({ text: esc('interner Fehler'), fehler: true }), 502);
  }
}

// ── Ende der Handler ──
