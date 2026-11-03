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
// Uhr: `jetzt` kommt mit jeder Aktion vom Worker; fehlt es, und im Alarm, gilt `env.KONTO_UHR()` (nur Tests, EP21), sonst
// `Date.now()`. Schlüssel im Speicher (EP1): konto:<kid>, email:<email>, geraet:<gid>, vorgang:<vid>, state:<state>,
// iveo:<basis|slug>, anfrage:<aid>, log:<ms 13-stellig>:<zufall>, fehl:<kid>, altkey:<tag>:<gruppe>:<plattform>-<arch>.
import { PROTOKOLL_MS, istDomainKonto, istErsterAdmin, kontoGueltig } from './konto-kern.js';
import { zufall } from './konto-krypto.js';

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

  // ── Ende der Methoden ──
}
