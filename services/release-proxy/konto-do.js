// Anmeldung im Launcher (Teil 1) · Durable Object `KontoSpeicher` (Spec 4, 4.1, 6.1, 6.3, 6.4, 7, 8, 9, 11; Plan 10.4,
// EP1–EP5, EP19–EP21, OF2, OF3, OFP2, OFP4): Konten, Geräte, Anmeldevorgänge, Einladungen, Zoom-Anfragen, iveo-Tokens (nur
// verschlüsselt), Protokoll und Zählung alter Schlüssel. Eine Instanz (`idFromName('konten')`) in der EU, SQLite-gestützt,
// genutzt über die KV-Schnittstelle von ctx.storage (get/put/delete/list mit prefix) und den Alarm.
//
// Einfache Klasse ohne `cloudflare:workers` (wie ConnectRoom): ladbar unter Node, getestet mit den Attrappen aus
// test/konto-attrappen.mjs. Der Worker spricht den DO nur über
//   stub.fetch(new Request('https://konto.intern/<aktion>', { method: 'POST', body: JSON.stringify({ jetzt, … }) }))
// an und baut jede Anfrage neu (Lehre B1: keine Kopfzeile des Clients). Antwort immer JSON `{ ok: true, … }` oder
// `{ ok: false, code, status }` mit HTTP-Status `status`; alles andere als POST an https://konto.intern/<aktion> ist 404.
// Der DO signiert nichts und entschlüsselt nichts: Sitzungen, Freigaben und iveo-Klartext macht der Worker (P16) mit seinen
// Secrets, hier kommen iveo-Tokens nur als `{ iv, ct }` an. Kein Protokolleintrag enthält Passwort, Hash, Code,
// Abholgeheimnis, Seitentoken oder Token (OF3); der DO schreibt nichts in die Konsole (Fehler gehen als `diagnose` mit dem
// Namen des Fehlers an den Worker).
//
// Einmal-Regeln: Abholen nimmt den Vorgang atomar (delete); alle Schreiber eines Vorgangs (Binden, Bestätigen, Google-Zustand) und
// das Setzen per Einladung laufen in `inReihe` und lesen dort frisch (kein PBKDF2 in der Reihe), auch ohne Input-Gates. Die
// Schreiber des Kontos (P3, P6) verlassen sich auf die Input-Gates von workerd. Nie `binde` oder `inReihe` aus der Reihe rufen.
//
// Uhr: `jetzt` kommt mit jeder Aktion vom Worker; fehlt es, und im Alarm, gilt `env.KONTO_UHR()` (nur Tests, EP21), sonst
// `Date.now()`. Schlüssel im Speicher (EP1): konto:<kid>, email:<email>, geraet:<gid>, vorgang:<vid>, state:<state>,
// iveo:<basis|slug>, anfrage:<aid>, log:<ms 13-stellig>:<zufall>, fehl:<kid>, altkey:<tag>:<gruppe>:<plattform>-<arch>.
import { PROTOKOLL_MS, VORGANG_MS, bremseAktiv, istDomainKonto, istErsterAdmin, kontoGueltig, nachFehlversuch } from './konto-kern.js';
import {
  CODE_ALPHABET,
  geraetIdAus,
  gleichOhneZeitleck,
  hashePasswort,
  normalisiereCode,
  pruefeGeraeteBeweis,
  pruefePasswort,
  reinerJwk,
  sha256B64url,
  zufall,
} from './konto-krypto.js';

const TAG_MS = 24 * 3600_000;
/** Aufbewahrung der Alt-Key-Zählung und entschiedener Zoom-Anfragen (nach ihrem „bis“). */
const AUFBEWAHRUNG_MS = 90 * TAG_MS;
/** Geräte ohne Kontakt so lange danach löschen (Spec 11: eine Sitzung überlebt keine 30 Tage ohne Kontakt). */
const GERAET_MS = 365 * TAG_MS;
/** Bremse unbekannter E-Mails (P4, EP4) so lange nach dem letzten Versuch löschen. */
const FEHL_EMAIL_MS = 30 * TAG_MS;
const EMAIL_FORM = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const K = {
  konto: (kid) => `konto:${kid}`,
  email: (email) => `email:${email}`,
  geraet: (gid) => `geraet:${gid}`,
  vorgang: (vid) => `vorgang:${vid}`,
  state: (state) => `state:${state}`,
  iveo: (key) => `iveo:${key}`,
  anfrage: (aid) => `anfrage:${aid}`,
  fehl: (kid) => `fehl:${kid}`,
  /** Bremse einer unbekannten E-Mail (P4): nur der SHA-256 der normalisierten E-Mail, nie die E-Mail selbst. */
  fehlEmail: (hash) => `fehl-email:${hash}`,
};

/** Aktion (Pfad nach https://konto.intern/) → Methode. Nur diese Namen sind von außen erreichbar. */
const AKTIONEN = {
  'konto-aus-google': 'kontoAusGoogle',
  'vorgang-anlegen': 'vorgangAnlegen',
  'vorgang-lesen': 'vorgangLesen',
  'vorgang-konto-binden': 'vorgangKontoBinden',
  'vorgang-google-merken': 'vorgangGoogleMerken',
  'vorgang-google-state': 'vorgangGoogleState',
  'vorgang-passwort': 'vorgangPasswort',
  'vorgang-bestaetigen': 'vorgangBestaetigen',
  'vorgang-abholen': 'vorgangAbholen',
  'vorgang-abbrechen': 'vorgangAbbrechen',
  // ── Ende der Aktionen ──
};

function antwort(daten) {
  return new Response(JSON.stringify(daten), {
    status: daten.ok ? 200 : daten.status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function fehler(code, status, mehr = {}) {
  return { ok: false, code, status, ...mehr };
}

/** Nur der Name eines Fehlers (Muster worker.js `fehlerName`), nie seine Meldung: die könnte Werte enthalten. */
function fehlerName(e) {
  return e && typeof e.name === 'string' ? e.name : 'Error';
}

function normEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/** Getrimmter Text bis `max` Zeichen, sonst ''. */
function text(wert, max) {
  return typeof wert === 'string' ? wert.trim().slice(0, max) : '';
}

/** Bestätigungscode `XXX-XXX` aus dem Alphabet ohne 0, O, 1, I (Spec 4.1). */
const CODE_FORM = new RegExp(`^[${CODE_ALPHABET}]{3}-[${CODE_ALPHABET}]{3}$`);

/** Konto ohne Passwort-Hash und Einladung (für Antworten an den Worker). */
function ohneGeheimes(konto) {
  const { passwort: _p, einladung: _e, ...rest } = konto;
  return rest;
}

/** Gerät ohne öffentlichen Schlüssel (für Antworten an den Worker; der Schlüssel bleibt im DO). */
function ohneSchluessel(geraet) {
  const { publicJwk: _k, ...rest } = geraet;
  return rest;
}

/** Steuer-, unsichtbare und Richtungszeichen (Bidi-Steuerung, Nullbreite, Trenner); sie werden im Rechnernamen Leerzeichen. */
const UNSICHTBAR = /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]/g;

/**
 * Rechnername für Bestätigungsseite und Admin-Maske (Spec 4.1, AbwA19): unsichtbare Zeichen werden Leerzeichen, Leerraum wird
 * zusammengezogen, höchstens 40 Zeichen. Den Namen wählt der Launcher; die Seite nennt ihn als „Rechner: …“ und escaped ihn
 * (P17). Gegen einen weitergeleiteten Link schützt der Vergleich des Codes, nicht der Name.
 */
function rechnerName(roh) {
  if (typeof roh !== 'string') return '';
  const t = roh.normalize('NFC').replace(UNSICHTBAR, ' ').replace(/\s+/g, ' ').trim();
  return [...t].slice(0, 40).join('').trim();
}

export class KontoSpeicher {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env || {};
  }

  uhr() {
    return typeof this.env.KONTO_UHR === 'function' ? this.env.KONTO_UHR() : Date.now();
  }

  async fetch(request) {
    let url = null;
    try {
      url = new URL(request.url);
    } catch {
      url = null;
    }
    const name = url && request.method === 'POST' && url.protocol === 'https:' && url.host === 'konto.intern' ? url.pathname.slice(1) : '';
    const methode = Object.hasOwn(AKTIONEN, name) ? AKTIONEN[name] : null;
    if (!methode) return antwort(fehler('ungueltig', 404));
    let body = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return antwort(fehler('ungueltig', 400));
    const jetzt = Number.isFinite(body.jetzt) ? body.jetzt : this.uhr();
    let ergebnis;
    try {
      ergebnis = await this[methode](body, jetzt);
    } catch (e) {
      ergebnis = fehler('server', 500, { diagnose: fehlerName(e) });
    }
    await this.weckerStellen(jetzt);
    return antwort(ergebnis);
  }

  // ── Speicher-Helfer ──

  async ladeKonto(kid) {
    if (typeof kid !== 'string' || !kid) return null;
    return (await this.ctx.storage.get(K.konto(kid))) ?? null;
  }

  async kontoPerEmail(email) {
    const e = normEmail(email);
    if (!e) return null;
    const kid = await this.ctx.storage.get(K.email(e));
    return kid ? this.ladeKonto(kid) : null;
  }

  async speichereKonto(konto) {
    await this.ctx.storage.put(K.konto(konto.kid), konto);
    await this.ctx.storage.put(K.email(konto.email), konto.kid);
  }

  ersterAdmin() {
    return typeof this.env.ERSTER_ADMIN === 'string' ? this.env.ERSTER_ADMIN : undefined;
  }

  /** Erster Admin ist nur ein Google-Konto mit der E-Mail aus ERSTER_ADMIN (EP20); ein E-Mail-Zugang mit derselben Adresse nie. */
  istErster(konto) {
    return !!konto && konto.art === 'google' && istErsterAdmin(konto.email, this.ersterAdmin());
  }

  /** Stufe mit ERSTER_ADMIN (immer Admin, EP20). */
  stufeVon(konto) {
    return this.istErster(konto) ? 'admin' : konto.stufe;
  }

  istAktiverAdmin(konto, jetzt) {
    return !!konto && this.stufeVon(konto) === 'admin' && kontoGueltig(konto, jetzt).ok;
  }

  /** Zahl der aktiven Admins, ohne `ausser`. */
  async adminZahl(jetzt, ausser = null) {
    let n = 0;
    for (const [, k] of await this.ctx.storage.list({ prefix: 'konto:' })) if (k.kid !== ausser && this.istAktiverAdmin(k, jetzt)) n++;
    return n;
  }

  /**
   * Bleibt ohne `ohneKid` ein aktiver Admin (Spec 9, EP20)? Immer die Zählregel: das Konto des ersten Admins zählt mit, sobald es
   * im DO existiert. Ein ERSTER_ADMIN ohne Konto (Tippfehler, fremde Domain, nie angemeldet) schützt nicht (robust:6).
   */
  async adminBleibt(jetzt, ohneKid) {
    return (await this.adminZahl(jetzt, ohneKid)) >= 1;
  }

  /** Protokoll (EP19, OF3): `{ am, wer, was, wen, details }`; `details` bauen die Aufrufer ohne Geheimnisse. */
  async protokolliere({ am, wer, was, wen, details }) {
    const eintrag = { am, wer: String(wer), was: String(was), wen: String(wen ?? ''), details: details ?? {} };
    await this.ctx.storage.put(`log:${String(am).padStart(13, '0')}:${zufall(6)}`, eintrag);
  }

  // ── Aufräumen (täglich per Alarm) ──

  async weckerStellen(jetzt) {
    try {
      if ((await this.ctx.storage.getAlarm()) == null) await this.ctx.storage.setAlarm(jetzt + TAG_MS);
    } catch {
      // Aufräumen ist nicht kritisch: Fristen prüft jede Aktion selbst.
    }
  }

  async alarm() {
    const jetzt = this.uhr();
    await this.aufraeumen(jetzt);
    await this.ctx.storage.setAlarm(jetzt + TAG_MS);
  }

  /**
   * Abgelaufene Vorgänge samt OAuth-state, verwaiste state, abgelaufene Einladungen, Protokoll nach 12 Monaten (OF3),
   * Alt-Key-Zeilen 90 Tage nach der letzten Anfrage, entschiedene Zoom-Anfragen 90 Tage nach ihrem „bis“, Geräte 12 Monate
   * nach dem letzten Kontakt und Zähler unbekannter E-Mails 30 Tage nach dem letzten Versuch (Spec 11).
   */
  async aufraeumen(jetzt) {
    const st = this.ctx.storage;
    for (const [key, v] of await st.list({ prefix: 'vorgang:' })) {
      if (!v || !(v.bis > jetzt)) {
        await st.delete(key);
        if (v && v.google && v.google.state) await st.delete(K.state(v.google.state));
      }
    }
    for (const [key, vid] of await st.list({ prefix: 'state:' })) {
      if (!(await st.get(K.vorgang(vid)))) await st.delete(key);
    }
    for (const [key, k] of await st.list({ prefix: 'konto:' })) {
      if (k && k.einladung && !(k.einladung.bis > jetzt)) {
        delete k.einladung;
        k.geaendert = jetzt;
        await st.put(key, k);
      }
    }
    for (const [key, e] of await st.list({ prefix: 'log:' })) {
      if (!e || e.am + PROTOKOLL_MS <= jetzt) await st.delete(key);
    }
    for (const [key, z] of await st.list({ prefix: 'altkey:' })) {
      if (!z || z.zuletzt + AUFBEWAHRUNG_MS <= jetzt) await st.delete(key);
    }
    for (const [key, a] of await st.list({ prefix: 'anfrage:' })) {
      if (!a || (a.zustand !== 'offen' && a.bis + AUFBEWAHRUNG_MS <= jetzt)) await st.delete(key);
    }
    for (const [key, g] of await st.list({ prefix: 'geraet:' })) {
      if (!g || !(g.letzterKontakt + GERAET_MS > jetzt)) await st.delete(key);
    }
    for (const [key, f] of await st.list({ prefix: 'fehl-email:' })) {
      if (!f || !(f.am + FEHL_EMAIL_MS > jetzt)) await st.delete(key);
    }
  }

  // ── Konten (Spec 4, 9) ──

  /** Aktion `konto-aus-google` `{ email, name }` → `{ kid }`: findet oder legt an (nur jakobsmedien.com, Kollege bzw. Admin). */
  async kontoAusGoogle(b, jetzt) {
    const email = normEmail(b.email);
    if (!istDomainKonto(email) || !EMAIL_FORM.test(email)) return fehler('domain', 400);
    const name = text(b.name, 80) || email.slice(0, email.indexOf('@'));
    const vorhanden = await this.kontoPerEmail(email);
    if (vorhanden) {
      const g = kontoGueltig(vorhanden, jetzt);
      if (!g.ok) return fehler(g.grund, 403, g.grund === 'zugang-abgelaufen' ? { bis: vorhanden.bis } : {});
      if (vorhanden.name !== name) {
        vorhanden.name = name;
        vorhanden.geaendert = jetzt;
        await this.speichereKonto(vorhanden);
      }
      return { ok: true, kid: vorhanden.kid };
    }
    const stufe = istErsterAdmin(email, this.ersterAdmin()) ? 'admin' : 'kollege';
    const konto = {
      kid: zufall(12),
      email,
      name,
      art: 'google',
      stufe,
      zustand: 'aktiv',
      tools: [],
      events: [],
      bis: null,
      zoomBis: null,
      erstellt: jetzt,
      geaendert: jetzt,
      letzteAnmeldung: null,
    };
    await this.speichereKonto(konto);
    await this.protokolliere({ am: jetzt, wer: 'system', was: 'konto-angelegt', wen: email, details: { kid: konto.kid, art: 'google', stufe } });
    return { ok: true, kid: konto.kid };
  }

  /** Zugang löschen (Spec 4): Google-Konto wird gesperrt (aufhebbar), ein Externer verschwindet samt Index und Anfragen. */
  async zugangLoeschen(kid, durch, jetzt) {
    const konto = await this.ladeKonto(kid);
    if (!konto) return fehler('vorgang-unbekannt', 404);
    if (this.istErster(konto)) return fehler('erster-admin', 403);
    if (this.istAktiverAdmin(konto, jetzt) && !(await this.adminBleibt(jetzt, kid))) return fehler('konflikt', 409);
    if (konto.art === 'google') {
      konto.zustand = 'gesperrt';
      konto.geaendert = jetzt;
      await this.speichereKonto(konto);
      await this.protokolliere({ am: jetzt, wer: durch, was: 'zugang-gesperrt', wen: konto.email, details: { kid, art: 'google', stufe: konto.stufe } });
      return { ok: true };
    }
    const st = this.ctx.storage;
    await st.delete(K.konto(kid));
    await st.delete(K.email(konto.email));
    await st.delete(K.fehl(kid));
    for (const [key, a] of await st.list({ prefix: 'anfrage:' })) if (a.kid === kid) await st.delete(key);
    for (const [key, g] of await st.list({ prefix: 'geraet:' })) {
      if (g.letztesKonto === kid) {
        g.letztesKonto = null;
        g.angemeldetSeit = null;
        await st.put(key, g);
      }
    }
    await this.protokolliere({ am: jetzt, wer: durch, was: 'zugang-geloescht', wen: konto.email, details: { kid, art: konto.art, stufe: konto.stufe } });
    return { ok: true };
  }

  /** Sperre aufheben (Spec 4): aktiv mit der alten Stufe; eine laufende Passwort-Bremse fällt mit weg. */
  async entsperren(kid, durch, jetzt) {
    const konto = await this.ladeKonto(kid);
    if (!konto) return fehler('vorgang-unbekannt', 404);
    konto.zustand = 'aktiv';
    konto.geaendert = jetzt;
    await this.speichereKonto(konto);
    await this.ctx.storage.delete(K.fehl(kid));
    await this.protokolliere({ am: jetzt, wer: durch, was: 'zugang-entsperrt', wen: konto.email, details: { kid } });
    return { ok: true };
  }

  // ── Anmeldevorgang (Spec 4.1, EP5): anlegen → anmelden (Google oder Passwort) → bestätigen → abholen ──

  /** Vorgang nur, solange er gilt (`bis > jetzt`); sonst null. */
  async ladeVorgang(vid, jetzt) {
    if (typeof vid !== 'string' || !vid) return null;
    const v = await this.ctx.storage.get(K.vorgang(vid));
    return v && v.bis > jetzt ? v : null;
  }

  async vorgangWeg(v) {
    const weg = await this.ctx.storage.delete(K.vorgang(v.vorgang));
    if (v.google && v.google.state) await this.ctx.storage.delete(K.state(v.google.state));
    return weg;
  }

  /** Aktion `vorgang-anlegen` `{ geraet, abholHash, code }` → `{ vorgang, bis }`; das Abholgeheimnis kennt der DO nur als Hash. */
  async vorgangAnlegen(b, jetzt) {
    const g = b.geraet && typeof b.geraet === 'object' ? b.geraet : {};
    const publicJwk = reinerJwk(g.publicJwk);
    const gid = publicJwk ? await geraetIdAus(publicJwk) : null;
    const name = rechnerName(g.name);
    if (!gid || !name || (g.plattform !== 'win' && g.plattform !== 'mac') || (g.arch !== 'x64' && g.arch !== 'arm64')) return fehler('ungueltig', 400);
    if (typeof b.abholHash !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(b.abholHash)) return fehler('ungueltig', 400);
    if (typeof b.code !== 'string' || !CODE_FORM.test(b.code)) return fehler('ungueltig', 400);
    const vorgang = zufall(18);
    const v = {
      vorgang,
      abholHash: b.abholHash,
      code: b.code,
      geraet: { gid, publicJwk, name, plattform: g.plattform, arch: g.arch, version: text(g.version, 32) },
      bis: jetzt + VORGANG_MS,
      zustand: 'offen',
    };
    await this.ctx.storage.put(K.vorgang(vorgang), v);
    return { ok: true, vorgang, bis: v.bis };
  }

  /** Aktion `vorgang-lesen` `{ vorgang }` → `{ zustand, code, rechnerName, bis }` (Anmeldeseite, P17). */
  async vorgangLesen(b, jetzt) {
    const v = await this.ladeVorgang(b.vorgang, jetzt);
    if (!v) return fehler('vorgang-unbekannt', 404);
    return { ok: true, zustand: v.zustand, code: v.code, rechnerName: v.geraet.name, bis: v.bis };
  }

  /**
   * Ein Vorgang gehört dem ersten Konto, das sich darauf anmeldet (EP5): ein anderes Konto → 409 konflikt (B11). Meldet
   * sich dasselbe Konto noch einmal an (zweiter Reiter, Zurück im Browser), bleibt das Seitentoken gleich.
   */
  binde(v0, konto) {
    return this.inReihe(async () => {
      const v = await this.ctx.storage.get(K.vorgang(v0.vorgang));
      if (!v) return fehler('vorgang-unbekannt', 404);
      return this.bindeAn(v, konto);
    });
  }

  /**
   * Das Binden selbst, auf dem frisch gelesenen Vorgang, innerhalb der Reihe von `binde`. Nie `binde` oder `inReihe` aus
   * einem Schritt der Reihe aufrufen: die Reihe wartet auf sich selbst (Deadlock).
   */
  async bindeAn(v, konto) {
    if (v.zustand === 'angemeldet' && v.kid !== konto.kid) return fehler('konflikt', 409);
    if (v.zustand !== 'offen' && v.zustand !== 'angemeldet') return fehler('vorgang-unbekannt', 404);
    if (v.zustand === 'offen') {
      v.kid = konto.kid;
      v.zustand = 'angemeldet';
      v.seitenToken = zufall(24);
      await this.ctx.storage.put(K.vorgang(v.vorgang), v);
    }
    return { ok: true, seitenToken: v.seitenToken, email: konto.email, code: v.code, rechnerName: v.geraet.name };
  }

  /** Aktion `vorgang-konto-binden` `{ vorgang, kid }` (nach `konto-aus-google`, P18) → `{ seitenToken, email, code, rechnerName }`. */
  async vorgangKontoBinden(b, jetzt) {
    const v = await this.ladeVorgang(b.vorgang, jetzt);
    if (!v) return fehler('vorgang-unbekannt', 404);
    const konto = await this.ladeKonto(b.kid);
    if (!konto) return fehler('vorgang-unbekannt', 404);
    const g = kontoGueltig(konto, jetzt);
    if (!g.ok) return fehler(g.grund, 403, g.grund === 'zugang-abgelaufen' ? { bis: konto.bis } : {});
    return this.binde(v, konto);
  }

  /** Aktion `vorgang-google-merken` `{ vorgang, state, nonce, verifier }`: OAuth-Zustand im Vorgang, state als eigener Schlüssel. */
  vorgangGoogleMerken(b, jetzt) {
    return this.inReihe(async () => {
      const v = await this.ladeVorgang(b.vorgang, jetzt);
      if (!v || (v.zustand !== 'offen' && v.zustand !== 'angemeldet')) return fehler('vorgang-unbekannt', 404);
      if (![b.state, b.nonce, b.verifier].every((x) => typeof x === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(x))) return fehler('ungueltig', 400);
      const alt = v.google && v.google.state;
      v.google = { state: b.state, nonce: b.nonce, verifier: b.verifier };
      await this.ctx.storage.put(K.vorgang(v.vorgang), v);
      if (alt) await this.ctx.storage.delete(K.state(alt));
      await this.ctx.storage.put(K.state(b.state), v.vorgang);
      return { ok: true };
    });
  }

  /** Aktion `vorgang-google-state` `{ state }` → `{ vorgang, nonce, verifier }`; ein state gilt genau einmal. */
  vorgangGoogleState(b, jetzt) {
    return this.inReihe(() => this.googleStateEinloesen(b, jetzt));
  }

  /** Der Rumpf von `vorgang-google-state`, nur innerhalb der Reihe aufrufen. */
  async googleStateEinloesen(b, jetzt) {
    if (typeof b.state !== 'string' || !b.state) return fehler('vorgang-unbekannt', 404);
    const vid = await this.ctx.storage.get(K.state(b.state));
    if (!vid) return fehler('vorgang-unbekannt', 404);
    await this.ctx.storage.delete(K.state(b.state));
    const v = await this.ladeVorgang(vid, jetzt);
    if (!v || !v.google || v.google.state !== b.state) return fehler('vorgang-unbekannt', 404);
    const { nonce, verifier } = v.google;
    delete v.google;
    await this.ctx.storage.put(K.vorgang(v.vorgang), v);
    return { ok: true, vorgang: v.vorgang, nonce, verifier };
  }

  /**
   * Aktion `vorgang-passwort` (Spec 4, EP4): `{ vorgang, email, passwort }` oder `{ vorgang, email, einladungscode, neu[, neu2] }`
   * → `{ seitenToken, email, code, rechnerName }`. Codes für die Anmeldeseite (P17, Block-Kopf A): `falsch` 401 (B12, auch
   * für eine unbekannte E-Mail), `einladung` 400 (B14), `bremse` 429 mit `minuten` (B13), `passwort-kurz` und
   * `passwort-ungleich` 400 (B15), `gesperrt` 403 (B16), `zugang-abgelaufen` 403 mit `bis` (B17), `domain` 400 (B23),
   * `konflikt` 409 (B11), `vorgang-unbekannt` 404 (B10). Die Bremse greift vor jeder Prüfung, auch für das richtige Passwort,
   * und für eine unbekannte E-Mail genauso (Zähler nur unter dem Hash der E-Mail, AbwA18); jeder Versuch zählt schon vor dem
   * Hash, ein Erfolg setzt die Bremse zurück.
   */
  async vorgangPasswort(b, jetzt) {
    const v = await this.ladeVorgang(b.vorgang, jetzt);
    if (!v || (v.zustand !== 'offen' && v.zustand !== 'angemeldet')) return fehler('vorgang-unbekannt', 404);
    const email = normEmail(b.email);
    if (istDomainKonto(email)) return fehler('domain', 400);
    const mitCode = typeof b.einladungscode === 'string';
    if (mitCode) {
      if (typeof b.neu !== 'string' || b.neu.length < 10) return fehler('passwort-kurz', 400);
      if ('neu2' in b && b.neu2 !== b.neu) return fehler('passwort-ungleich', 400);
    } else if (typeof b.passwort !== 'string') {
      return fehler('ungueltig', 400);
    }
    // Immer zuerst die Attrappe holen: sonst rechnet nur die unbekannte E-Mail beim 1. Versuch je Instanz einen Hash mehr (AR18).
    const attrappe = await this.attrappenHash();
    const gefunden = await this.kontoPerEmail(email);
    const konto = gefunden && gefunden.art === 'passwort' ? gefunden : null;
    const bremsSchluessel = konto ? K.fehl(konto.kid) : K.fehlEmail(await sha256B64url(email));
    const vorab = await this.bremseVorVersuch(bremsSchluessel, jetzt);
    if (vorab.minuten) return fehler('bremse', 429, { minuten: vorab.minuten });
    let richtig = false;
    let codeHash = null;
    if (mitCode) {
      const hash = await sha256B64url(normalisiereCode(b.einladungscode));
      codeHash = hash;
      richtig = !!(konto && konto.einladung && konto.einladung.bis > jetzt) && (await gleichOhneZeitleck(hash, konto.einladung.hash));
    } else {
      // Unbekannte E-Mail kostet dieselbe Rechenzeit wie ein falsches Passwort (B12: keine Auskunft, ob es die E-Mail gibt).
      const gespeichert = konto && konto.passwort ? konto.passwort : attrappe;
      richtig = (await pruefePasswort(b.passwort, gespeichert)) && !!(konto && konto.passwort);
    }
    if (!richtig) {
      // Der Versuch ist schon gezählt; war es der 5. in Folge, steht jetzt die Sperre (B13). Sonst dieselbe Meldung für eine
      // unbekannte E-Mail und ein falsches Passwort (B12).
      const minuten = bremseAktiv(vorab.bremse, jetzt);
      if (minuten) return fehler('bremse', 429, { minuten });
      return fehler(mitCode ? 'einladung' : 'falsch', mitCode ? 400 : 401);
    }
    await this.ctx.storage.delete(K.fehl(konto.kid));
    const g = kontoGueltig(konto, jetzt);
    if (!g.ok) return fehler(g.grund, 403, g.grund === 'zugang-abgelaufen' ? { bis: konto.bis } : {});
    if (v.zustand === 'angemeldet' && v.kid !== konto.kid) return fehler('konflikt', 409);
    if (mitCode) {
      const neuHash = await hashePasswort(b.neu);
      // Die Einladung gilt einmal, auch bei gleichzeitigen Versuchen: frisch lesen, prüfen und schreiben ohne await dazwischen.
      const gesetzt = await this.inReihe(async () => {
        const k0 = await this.ladeKonto(konto.kid);
        if (!k0 || !k0.einladung || !(k0.einladung.bis > jetzt) || !(await gleichOhneZeitleck(codeHash, k0.einladung.hash))) return false;
        // Nach dem zeitkonstanten Vergleich noch einmal frisch lesen: von hier bis zum put steht kein await.
        const k = await this.ladeKonto(konto.kid);
        if (!k || !k.einladung || k.einladung.hash !== k0.einladung.hash) return false;
        k.passwort = neuHash;
        delete k.einladung;
        k.geaendert = jetzt;
        await this.speichereKonto(k);
        return true;
      });
      if (!gesetzt) return fehler('einladung', 400);
    }
    return this.binde(v, konto);
  }

  /** Hash eines Zufallspassworts, einmal je Instanz, für unbekannte E-Mails. */
  attrappenHash() {
    if (!this.attrappe) {
      const p = hashePasswort(zufall(16));
      this.attrappe = p;
      // Ein abgelehntes Versprechen bleibt nicht liegen, sonst bekäme jede unbekannte E-Mail danach einen Serverfehler.
      p.catch(() => {
        if (this.attrappe === p) this.attrappe = null;
      });
    }
    return this.attrappe;
  }

  /** Arbeiten nacheinander je Instanz (Einmal-Regeln auch ohne Input-Gates); ein Fehler stoppt die Reihe nicht. */
  inReihe(fn) {
    const lauf = (this.einmalKette || Promise.resolve()).then(fn);
    this.einmalKette = lauf.catch(() => undefined);
    return lauf;
  }

  /**
   * Bremse vor einem Versuch (EP4, AbwA18): laufende Sperre lesen und den Versuch zählen, als eine Einheit. Die Kette je Instanz
   * lässt parallele Versuche nacheinander zählen (keiner überschreibt den Zähler eines anderen; das hängt nicht an den Input-Gates
   * von workerd). Liefert die Restminuten einer schon laufenden Sperre (dann wird nicht gezählt) oder 0 und die neue Bremse
   * `{ anzahl, bisMs, am }`.
   */
  bremseVorVersuch(schluessel, jetzt) {
    const lauf = (this.bremsKette || Promise.resolve()).then(async () => {
      const alt = await this.ctx.storage.get(schluessel);
      const minuten = bremseAktiv(alt, jetzt);
      if (minuten) return { minuten, bremse: alt };
      const bremse = { ...nachFehlversuch(alt, jetzt), am: jetzt };
      await this.ctx.storage.put(schluessel, bremse);
      return { minuten: 0, bremse };
    });
    this.bremsKette = lauf.catch(() => undefined);
    return lauf;
  }

  /**
   * Aktion `vorgang-bestaetigen` `{ vorgang, seitenToken, antwort: 'ja'|'nein' }` → `{ zustand }` (Spec 4.1, Schritt 4).
   * Falsches oder fehlendes Seitentoken → 403 `vorgang-unbekannt` (B10); der Vorgang bleibt dann unverändert.
   */
  async vorgangBestaetigen(b, jetzt) {
    const v = await this.ladeVorgang(b.vorgang, jetzt);
    if (!v || v.zustand !== 'angemeldet') return fehler('vorgang-unbekannt', 404);
    if (!(await gleichOhneZeitleck(String(b.seitenToken ?? ''), v.seitenToken))) return fehler('vorgang-unbekannt', 403);
    if (b.antwort !== 'ja' && b.antwort !== 'nein') return fehler('ungueltig', 400);
    // Der Token ist oben zeitkonstant geprüft; in der Reihe wird frisch gelesen und nur noch derselbe Vorgang im selben Zustand geändert.
    return this.inReihe(async () => {
      const frisch = await this.ladeVorgang(v.vorgang, jetzt);
      if (!frisch || frisch.zustand !== 'angemeldet' || frisch.seitenToken !== v.seitenToken) return fehler('vorgang-unbekannt', 404);
      frisch.zustand = b.antwort === 'ja' ? 'bestaetigt' : 'abgelehnt';
      delete frisch.seitenToken;
      await this.ctx.storage.put(K.vorgang(frisch.vorgang), frisch);
      return { ok: true, zustand: frisch.zustand };
    });
  }

  /**
   * Aktion `vorgang-abholen` `{ vorgang, abholHash, beweis }` → `{ zustand: 'wartet'|'abgelehnt'|'abgelaufen' }` oder
   * `{ zustand: 'bestaetigt', konto, geraet }` (Konto ohne Geheimes mit wirksamer Stufe, Gerät ohne Schlüssel; der Worker
   * baut daraus Stand und Sitzung). Der Beweis muss vom Geräteschlüssel des Vorgangs kommen; ein fremdes Gerät lässt den
   * Vorgang offen. Nach `bestaetigt`, `abgelehnt` und `abgelaufen` ist der Vorgang weg.
   */
  async vorgangAbholen(b, jetzt) {
    const v = typeof b.vorgang === 'string' && b.vorgang ? await this.ctx.storage.get(K.vorgang(b.vorgang)) : null;
    if (!v || !(await gleichOhneZeitleck(String(b.abholHash ?? ''), v.abholHash))) return fehler('vorgang-unbekannt', 404);
    if (!(v.bis > jetzt)) {
      await this.vorgangWeg(v);
      return { ok: true, zustand: 'abgelaufen' };
    }
    if (!(await pruefeGeraeteBeweis(v.geraet.publicJwk, b.beweis, 'abholen', v.vorgang, jetzt))) return fehler('geraet-unbekannt', 403);
    if (v.zustand === 'abgelehnt') {
      await this.vorgangWeg(v);
      return { ok: true, zustand: 'abgelehnt' };
    }
    if (v.zustand !== 'bestaetigt') return { ok: true, zustand: 'wartet' };
    // Atomar nehmen, bevor eine Sitzung entsteht: wer den Vorgang nicht mehr löschen kann, war zu spät (zweimal abholen = einmal).
    if (!(await this.vorgangWeg(v))) return fehler('vorgang-unbekannt', 404);
    const konto = await this.ladeKonto(v.kid);
    if (!konto) return fehler('geloescht', 403);
    const g = kontoGueltig(konto, jetzt);
    if (!g.ok) return fehler(g.grund, 403);
    const alt = await this.ctx.storage.get(K.geraet(v.geraet.gid));
    const geraet = {
      ...v.geraet,
      jm: alt ? alt.jm === true : false,
      ersterKontakt: alt ? alt.ersterKontakt : jetzt,
      letzterKontakt: jetzt,
      letztesKonto: konto.kid,
      angemeldetSeit: jetzt,
    };
    await this.ctx.storage.put(K.geraet(geraet.gid), geraet);
    konto.letzteAnmeldung = jetzt;
    await this.speichereKonto(konto);
    return { ok: true, zustand: 'bestaetigt', konto: { ...ohneGeheimes(konto), stufe: this.stufeVon(konto) }, geraet: ohneSchluessel(geraet) };
  }

  /** Aktion `vorgang-abbrechen` `{ vorgang, abholHash }` → `{ ok }` (Launcher bricht ab, Spec 4.1). */
  async vorgangAbbrechen(b) {
    const v = typeof b.vorgang === 'string' && b.vorgang ? await this.ctx.storage.get(K.vorgang(b.vorgang)) : null;
    if (!v || !(await gleichOhneZeitleck(String(b.abholHash ?? ''), v.abholHash))) return fehler('vorgang-unbekannt', 404);
    await this.vorgangWeg(v);
    return { ok: true };
  }

  // ── Ende der Methoden ──
}
