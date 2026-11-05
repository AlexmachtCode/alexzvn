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
// Schreiber des Kontos (P3, Abholen, P6) verlassen sich auf die Input-Gates von workerd (workerd lässt während eines
// Speicherzugriffs keinen fremden Aufruf in den Code; die Map-Attrappe der Tests kennt dieses Tor nicht); ebenso die P6-Regeln "eine Anfrage ist nur offen
// entscheidbar", "es bleibt immer ein Admin", die Schreiber von iveo und `geraet-markieren` und `neuer-code` (Einladung des Kontos
// außerhalb der Reihe). Aufräumen löscht außerhalb der Reihe; kein Schreiber in der Reihe nimmt einen bereits entschiedenen Vorgang
// an, mit einer Ausnahme (Z2 Fixrunde 1, I1): ein weiteres Ja mit demselben Seitentoken hängt an einen bestätigten, nicht abgeholten
// Vorgang ein neues e an. Darum nehmen Abholen und Abbrechen den Vorgang ebenfalls in der Reihe (ein spätes Ja belebt nichts wieder).
// Nie `binde` oder `inReihe` aus der Reihe rufen.
// Das Erneuern (P5) liest das Gerät nach dem Beweis (WebCrypto, kein Speicher) frisch, prüft `letztesKonto` noch einmal und setzt nur
// seine eigenen Felder, ohne await zwischen frischem Lesen und Schreiben: ein gleichzeitiges Abholen oder eine gleichzeitige Markierung
// (`jm`) bleibt so erhalten (ebenfalls dank der Input-Gates).
//
// Uhr: `jetzt` kommt mit jeder Aktion vom Worker; fehlt es, und im Alarm, gilt `env.KONTO_UHR()` (nur Tests, EP21), sonst
// `Date.now()`. Schlüssel im Speicher (EP1): konto:<kid>, email:<email>, geraet:<gid>, vorgang:<vid>, grab:<vid> (Z2), state:<state>,
// iveo:<basis|slug>, anfrage:<aid>, log:<ms 13-stellig>:<zufall>, fehl:<kid>, altkey:<tag>:<gruppe>:<plattform>-<arch>.
import {
  EINLADUNG_MS,
  PROTOKOLL_MS,
  STUFEN,
  VORGANG_MS,
  WERKZEUGE,
  alterKeyGilt,
  bremseAktiv,
  darf,
  googleNeuFaellig,
  istDomainKonto,
  istErsterAdmin,
  iveoSchluessel,
  normalisiereBasis,
  kontoGueltig,
  nachFehlversuch,
} from './konto-kern.js';
import {
  CODE_ALPHABET,
  geraetIdAus,
  gleichOhneZeitleck,
  hashePasswort,
  neuerEinladungsCode,
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
/** Obergrenzen (Z1-W1): Events je Zugang und je Hinterlegen, Werkzeuge je Zugang, Seite beim Aufräumen der Fehl-E-Mails. */
const MAX_EVENTS = 100;
const MAX_WERKZEUGE = 20;
const AUFRAEUM_SEITE = 500;
/** Ein Admin mit kürzerer Frist als so lange zählt für „es bleibt immer ein Admin“ nicht (er liefe bald aus). */
const ADMIN_FRIST_MIN_MS = 30 * TAG_MS;
/** Z2: Port des Rückkanals (Launcher auf 127.0.0.1, Port 0 → vom Betriebssystem gewählt), eine ganze Zahl in diesen Grenzen. */
const RUECK_PORT_MIN = 1024;
const RUECK_PORT_MAX = 65535;
/** Z2 (Nr. 6): so lange nach dem Abholen nimmt der Grabstein dasselbe Abholgeheimnis und dasselbe e noch einmal an. */
const GRAB_MS = 60_000;
/** Z2 Fixrunde 1 (I1): so viele Einmalwerte gibt es je Vorgang höchstens (erstes Ja plus zwei Wiederholungen, etwa ein Doppelklick). */
const E_MAX = 3;
const EMAIL_FORM = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const K = {
  konto: (kid) => `konto:${kid}`,
  email: (email) => `email:${email}`,
  geraet: (gid) => `geraet:${gid}`,
  vorgang: (vid) => `vorgang:${vid}`,
  /** Z2 (Nr. 6): Grabstein eines abgeholten Vorgangs (60 s), nur mit Hashes; die Anmeldeseite sieht ihn nie. */
  grab: (vid) => `grab:${vid}`,
  state: (state) => `state:${state}`,
  iveo: (key) => `iveo:${key}`,
  anfrage: (aid) => `anfrage:${aid}`,
  fehl: (kid) => `fehl:${kid}`,
  /** Bremse einer unbekannten E-Mail (P4): nur der SHA-256 der normalisierten E-Mail, nie die E-Mail selbst. */
  fehlEmail: (hash) => `fehl-email:${hash}`,
  /** Inhaber eines Q&A-Events (Z3): nur der SHA-256 der Event-ID mit eigenem Präfix, nie die Event-ID selbst. */
  qaInhaber: (eventHash) => `qa:${eventHash}`,
};
/** Q&A-Inhaber: so lange höchstens aufbewahren (Obergrenze für `bis`). */
const QA_INHABER_MAX_MS = 30 * TAG_MS;
/** `bis` eines Q&A-Inhabers wird nur verlängert, wenn es um mehr als so viel wächst. Muss kleiner sein als der Puffer des Absenders (QA.bisPufferMs, 1 h in qa-relay.js), damit `bis` nie unter Meta-Ende + Puffer − Schritt fällt (AR89). */
const QA_INHABER_SCHRITT_MS = 1800_000;
const HEX64 = /^[a-f0-9]{64}$/;

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
  'sitzung-erneuern': 'sitzungErneuern',
  abmelden: 'abmelden',
  ich: 'ich',
  'zoom-anfragen': 'zoomAnfragen',
  'iveo-fuer': 'iveoFuer',
  'altkey-zaehlen': 'altkeyZaehlen',
  'qa-inhaber': 'qaInhaber',
  'admin-uebersicht': 'adminUebersicht',
  'admin-aktion': 'adminAktion',
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

/**
 * Z2 (Nr. 5, AR20): Erlaubnisliste statt Sperrliste. Erlaubt sind Buchstaben und Ziffern (Unicode \p{L}\p{N}, nach NFC), das
 * Leerzeichen und - _ . ( ) '; alles andere (Steuer-, Format-, Richtungs- und Nullbreitenzeichen, Symbole, Emoji, Satzzeichen,
 * kombinierende Zeichen, Tags) wird entfernt.
 */
const NICHT_ERLAUBT = /[^\p{L}\p{N} \-_.()']/gu;
/**
 * Gemessen (Node 24): \p{L} lässt die Hangul-Füller U+115F, U+1160, U+3164 und U+FFA0 durch (Kategorie Lo, unsichtbar). Sie sind die
 * einzigen Buchstaben oder Ziffern mit Default_Ignorable_Code_Point; beide Angaben fallen hier ausdrücklich weg.
 */
const UNSICHTBARE_BUCHSTABEN = /[\p{Default_Ignorable_Code_Point}\u{115f}\u{1160}\u{3164}\u{ffa0}]/gu;

/**
 * Rechnername für Bestätigungsseite und Admin-Maske (Spec 4.1, AbwA19; Z2 Nr. 5): nach NFC wird Leerraum ein Leerzeichen, unsichtbare
 * Buchstaben und alles außerhalb der Erlaubnisliste fallen weg, Leerraum wird zusammengezogen, höchstens 40 Zeichen. Den Namen wählt
 * der Launcher; die Seite nennt ihn nur als „Rechner: ‹Name› (vom Rechner gemeldet)“ (B25) und escaped ihn (P17). Gegen einen
 * weitergeleiteten Link schützt der Rückkanal (Z2), nicht der Name.
 */
function rechnerName(roh) {
  if (typeof roh !== 'string') return '';
  const t = roh
    .normalize('NFC')
    .replace(/\s+/gu, ' ')
    .replace(UNSICHTBARE_BUCHSTABEN, '')
    .replace(NICHT_ERLAUBT, '')
    .replace(/ {2,}/g, ' ')
    .trim();
  return [...t].slice(0, 40).join('').trim();
}

/**
 * Stand einer Zoom-Anfrage für den Launcher (ZoomAnfrageStand, Plan 10.5): bei `freigegeben` das gewährte „bis“ (Z9b),
 * `am` = Zeitpunkt des letzten Wechsels (offen seit, abgelehnt am; Z9a, Z9c).
 */
function anfrageStand(a) {
  return {
    id: a.id,
    zustand: a.zustand,
    zweck: a.zweck,
    von: a.von,
    bis: a.zustand === 'freigegeben' && typeof a.freigegebenBis === 'number' ? a.freigegebenBis : a.bis,
    am: typeof a.entschiedenAm === 'number' ? a.entschiedenAm : a.am,
  };
}

/** Admin-Aktion (Plan 10.5 `AdminAktion.aktion`) → Methode; jede bekommt `(aktion, wer, jetzt)`. */
const ADMIN_AKTIONEN = {
  'zugang-speichern': 'zugangSpeichern',
  einladen: 'einladen',
  'neuer-code': 'neuerCode',
  'zugang-loeschen': 'adminZugangLoeschen',
  entsperren: 'adminEntsperren',
  'iveo-hinterlegen': 'iveoHinterlegen',
  'iveo-entfernen': 'iveoEntfernen',
  'anfrage-freigeben': 'anfrageFreigeben',
  'anfrage-ablehnen': 'anfrageAblehnen',
  'geraet-markieren': 'geraetMarkieren',
};

const B64URL = /^[A-Za-z0-9_-]+$/;

function nachName(a, b) {
  return a.name.localeCompare(b.name, 'de') || a.email.localeCompare(b.email);
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
    // Ein put mit Objekt: Konto und E-Mail-Index entstehen zusammen oder gar nicht (Z1-W1).
    await this.ctx.storage.put({ [K.konto(konto.kid)]: konto, [K.email(konto.email)]: konto.kid });
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
    for (const [, k] of await this.ctx.storage.list({ prefix: 'konto:' })) {
      // Ein Admin mit kurzer Frist (unter 30 Tagen) schützt nicht: er liefe aus, und „immer ein Admin“ hielte nur zum Schein.
      const dauerhaft = typeof k.bis !== 'number' || k.bis > jetzt + ADMIN_FRIST_MIN_MS;
      if (k.kid !== ausser && dauerhaft && this.istAktiverAdmin(k, jetzt)) n++;
    }
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
    if (!Number.isFinite(am) || typeof wer !== 'string' || !wer || typeof was !== 'string' || !was) throw new Error('Protokolleintrag ungueltig');
    const eintrag = { am, wer: String(wer), was: String(was), wen: String(wen ?? ''), details: details ?? {} };
    await this.ctx.storage.put(`log:${String(am).padStart(13, '0')}:${zufall(6)}`, eintrag);
  }

  /**
   * Alle Zoom-Anfragen als `[Schlüssel, Anfrage]`. Eine offene Anfrage, deren „bis“ vorbei ist, zählt nicht mehr: sie wird beim
   * Lesen gelöscht und nicht geliefert (Z1-W1). Entschiedene bleiben bis zum Aufräumen (90 Tage nach „bis“).
   */
  async anfragenLesen(jetzt) {
    const aus = [];
    for (const [key, a] of await this.ctx.storage.list({ prefix: 'anfrage:' })) {
      if (a && a.zustand === 'offen' && !(a.bis > jetzt)) await this.ctx.storage.delete(key);
      else aus.push([key, a]);
    }
    return aus;
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
   * Alt-Key-Zeilen 90 Tage nach der letzten Anfrage, Zoom-Anfragen (auch offene) 90 Tage nach ihrem „bis“, Geräte 12 Monate
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
    // Z2 (Nr. 6): Grabsteine abgeholter Vorgänge nach ihren 60 s.
    for (const [key, g] of await st.list({ prefix: 'grab:' })) {
      if (!g || !(g.bis > jetzt)) await st.delete(key);
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
      if (!a || a.bis + AUFBEWAHRUNG_MS <= jetzt) await st.delete(key);
    }
    for (const [key, q] of await st.list({ prefix: 'qa:' })) {
      if (!q || !(q.bis >= jetzt)) await st.delete(key);
    }
    for (const [key, g] of await st.list({ prefix: 'geraet:' })) {
      if (!g || !(g.letzterKontakt + GERAET_MS > jetzt)) await st.delete(key);
    }
    // Zähler unbekannter E-Mails wachsen mit jedem Fremden: seitenweise lesen, nie die ganze Liste auf einmal.
    for (let ab; ; ) {
      const seite = [...(await st.list({ prefix: 'fehl-email:', limit: AUFRAEUM_SEITE, ...(ab ? { start: ab } : {}) })).entries()];
      for (const [key, f] of seite) if (!f || !(f.am + FEHL_EMAIL_MS > jetzt)) await st.delete(key);
      if (seite.length < AUFRAEUM_SEITE) break;
      ab = `${seite[seite.length - 1][0]}\u0000`;
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

  /** Sperre aufheben (Spec 4), nur aus „gesperrt“ (sonst 400 ungueltig): aktiv mit der alten Stufe; eine laufende Passwort-Bremse fällt mit weg. */
  async entsperren(kid, durch, jetzt) {
    const konto = await this.ladeKonto(kid);
    if (!konto) return fehler('vorgang-unbekannt', 404);
    if (konto.zustand !== 'gesperrt') return fehler('ungueltig', 400);
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

  /**
   * Aktion `vorgang-anlegen` `{ geraet, abholHash, code, rueckPort }` → `{ vorgang, bis }`; das Abholgeheimnis kennt der DO nur als
   * Hash. Z2: `rueckPort` ist der Port, auf dem der Launcher auf 127.0.0.1 lauscht (ganze Zahl 1024–65535, sonst 400 ungueltig).
   * Z2 Fixrunde 1 (AR91 Nr. 4): wegen des Rechnernamens weist der DO nie ab; ist er nach der Erlaubnisliste leer, bleibt er leer
   * (die Seite zeigt dann B27).
   */
  async vorgangAnlegen(b, jetzt) {
    const g = b.geraet && typeof b.geraet === 'object' ? b.geraet : {};
    const publicJwk = reinerJwk(g.publicJwk);
    const gid = publicJwk ? await geraetIdAus(publicJwk) : null;
    const name = rechnerName(g.name);
    if (!gid || (g.plattform !== 'win' && g.plattform !== 'mac') || (g.arch !== 'x64' && g.arch !== 'arm64')) return fehler('ungueltig', 400);
    if (typeof b.abholHash !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(b.abholHash)) return fehler('ungueltig', 400);
    if (typeof b.code !== 'string' || !CODE_FORM.test(b.code)) return fehler('ungueltig', 400);
    if (!Number.isInteger(b.rueckPort) || b.rueckPort < RUECK_PORT_MIN || b.rueckPort > RUECK_PORT_MAX) return fehler('ungueltig', 400);
    const vorgang = zufall(18);
    const v = {
      vorgang,
      abholHash: b.abholHash,
      code: b.code,
      geraet: { gid, publicJwk, name, plattform: g.plattform, arch: g.arch, version: text(g.version, 32) },
      rueckPort: b.rueckPort,
      bis: jetzt + VORGANG_MS,
      zustand: 'offen',
    };
    await this.ctx.storage.put(K.vorgang(vorgang), v);
    return { ok: true, vorgang, bis: v.bis };
  }

  /**
   * Aktion `vorgang-lesen` `{ vorgang }` → `{ zustand, code, rechnerName, bis }` (Anmeldeseite, P17). Z2 Fixrunde 1: nach dem Abholen
   * (Grabstein, 60 s) nur `{ zustand: 'abgeholt' }` — erst dann zeigt die Seite B8; vorher bei `bestaetigt` B28.
   */
  async vorgangLesen(b, jetzt) {
    const v = await this.ladeVorgang(b.vorgang, jetzt);
    if (!v) {
      const g = typeof b.vorgang === 'string' && b.vorgang ? await this.ctx.storage.get(K.grab(b.vorgang)) : null;
      if (g && g.bis > jetzt) return { ok: true, zustand: 'abgeholt' };
      return fehler('vorgang-unbekannt', 404);
    }
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
    if (v.zustand !== 'offen' && v.zustand !== 'angemeldet') return fehler('vorgang-unbekannt', 404);
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
      // Die Einladung gilt einmal, auch bei gleichzeitigen Versuchen: frisch lesen und prüfen;
      // "ohne await bis zum put" gilt erst ab dem zweiten frischen Lesen (nach dem zeitkonstanten Vergleich).
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
   * Z2: Bei Ja entsteht der Einmalwert `e = zufall(32)` (43 Zeichen b64url); der DO speichert nur `sha256(e)` und gibt `e` genau
   * einmal mit dem Port des Rückkanals zurück (`{ zustand, e, rueckPort }`): Die Bestätigen-Route baut daraus den Sprung an
   * 127.0.0.1 auf demselben Rechner. Abholen verlangt danach dieses e (RFC 8252, loopback redirect).
   * Z2 Fixrunde 1 (I1, Doppelklick): beim ersten Ja bleibt vom Seitentoken nur sein Hash (`seitenHash`), die Hashes der Einmalwerte
   * stehen in `eHashes`. Ein weiteres Ja mit demselben Seitentoken, solange der Vorgang bestätigt und nicht abgeholt ist, bringt ein
   * neues e, dessen Hash an die Liste kommt (höchstens E_MAX = 3); frühere bleiben gültig. Ab dem vierten Ja, bei Nein nach Ja und mit
   * einem anderen Seitentoken bleibt es bei der Antwort von vorher (404 bzw. 403, Seite B10). Abholen nimmt den Vorgang in derselben
   * Reihe, darum kann ein spätes Ja einen abgeholten Vorgang nicht wiederbeleben.
   */
  async vorgangBestaetigen(b, jetzt) {
    const v = await this.ladeVorgang(b.vorgang, jetzt);
    if (!v || (v.zustand !== 'angemeldet' && v.zustand !== 'bestaetigt')) return fehler('vorgang-unbekannt', 404);
    const token = typeof b.seitenToken === 'string' ? b.seitenToken : '';
    // Seitentoken zeitkonstant: vor dem ersten Ja im Klartext, danach nur noch sein Hash.
    const seitenHash = token ? await sha256B64url(token) : '';
    const tokenOk =
      v.zustand === 'angemeldet' ? await gleichOhneZeitleck(token, v.seitenToken) : await gleichOhneZeitleck(seitenHash, String(v.seitenHash ?? ''));
    if (!tokenOk) return fehler('vorgang-unbekannt', 403);
    if (b.antwort !== 'ja' && b.antwort !== 'nein') return fehler('ungueltig', 400);
    if (v.zustand === 'bestaetigt' && b.antwort !== 'ja') return fehler('vorgang-unbekannt', 404);
    // Z2: e und sein Hash vor der Reihe (SHA-256 ist ein await ohne Speicher); in die Reihe geht nur das Schreiben.
    const e = b.antwort === 'ja' ? zufall(32) : null;
    const eHash = e ? await sha256B64url(e) : null;
    // Der Token ist oben zeitkonstant geprüft; in der Reihe wird frisch gelesen und nur noch derselbe Vorgang geändert: das erste Ja
    // (angemeldet → bestätigt) oder ein weiteres Ja mit demselben Seitentoken (bestätigt, Liste noch nicht voll).
    return this.inReihe(async () => {
      const frisch = await this.ladeVorgang(v.vorgang, jetzt);
      if (!frisch) return fehler('vorgang-unbekannt', 404);
      if (frisch.zustand === 'angemeldet') {
        if (v.zustand !== 'angemeldet' || frisch.seitenToken !== v.seitenToken) return fehler('vorgang-unbekannt', 404);
        frisch.zustand = b.antwort === 'ja' ? 'bestaetigt' : 'abgelehnt';
        delete frisch.seitenToken;
        if (eHash) {
          frisch.seitenHash = seitenHash;
          frisch.eHashes = [eHash];
        }
      } else if (frisch.zustand === 'bestaetigt' && eHash && frisch.seitenHash === seitenHash) {
        if (!Array.isArray(frisch.eHashes) || frisch.eHashes.length >= E_MAX) return fehler('vorgang-unbekannt', 404);
        frisch.eHashes = [...frisch.eHashes, eHash];
      } else {
        return fehler('vorgang-unbekannt', 404);
      }
      await this.ctx.storage.put(K.vorgang(frisch.vorgang), frisch);
      return e ? { ok: true, zustand: frisch.zustand, e, rueckPort: frisch.rueckPort } : { ok: true, zustand: frisch.zustand };
    });
  }

  /**
   * Aktion `vorgang-abholen` `{ vorgang, abholHash, beweis, eHash? }` → `{ zustand: 'wartet'|'abgelehnt'|'abgelaufen' }` oder
   * `{ zustand: 'bestaetigt', konto, geraet }` (Konto ohne Geheimes mit wirksamer Stufe, Gerät ohne Schlüssel; der Worker
   * baut daraus Stand und Sitzung). Der Beweis muss vom Geräteschlüssel des Vorgangs kommen; ein fremdes Gerät lässt den
   * Vorgang offen. Nach `bestaetigt`, `abgelehnt` und `abgelaufen` ist der Vorgang weg.
   * Z2: Nach der Bestätigung gibt es die Sitzung nur mit dem Einmalwert e aus dem Sprung auf den Rechner (`eHash` = sha256(e), vom
   * Worker gebildet), zeitkonstant gegen den gespeicherten Hash verglichen; ohne oder mit falschem e antwortet der DO wie vor dem Ja
   * (`wartet`) und verrät nichts. Nach dem Abholen liegt 60 s ein Grabstein (`grab:<vid>`, Nr. 6): Er nimmt dasselbe
   * Abholgeheimnis und dasselbe e noch einmal an (verlorene Antwort) und liefert dieselbe Anmeldung (`grabAbholen`).
   */
  async vorgangAbholen(b, jetzt) {
    const vid = typeof b.vorgang === 'string' && b.vorgang ? b.vorgang : null;
    const v = vid ? await this.ctx.storage.get(K.vorgang(vid)) : null;
    if (!v && vid) return this.grabAbholen(b, vid, jetzt);
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
    // Z2: ohne einen Einmalwert aus dem Formular an den Rückkanal (oder ohne gespeicherte Hashes) keine Sitzung, nur „wartet“.
    if (!(await this.eStimmt(b.eHash, v.eHashes))) return { ok: true, zustand: 'wartet' };
    // Atomar nehmen, bevor eine Sitzung entsteht: wer den Vorgang nicht mehr löschen kann, war zu spät (zweimal abholen = einmal).
    // Z2 Fixrunde 1 (I1): in der Reihe der Bestätigungen, damit ein gleichzeitiges weiteres Ja den Vorgang nicht wiederbelebt; die
    // Hashes kommen aus dem frisch gelesenen Vorgang (ein weiteres Ja davor ist also im Grabstein).
    const genommen = await this.inReihe(async () => {
      const frisch = await this.ctx.storage.get(K.vorgang(v.vorgang));
      if (!frisch || frisch.zustand !== 'bestaetigt' || frisch.abholHash !== v.abholHash) return null;
      return (await this.vorgangWeg(frisch)) ? frisch : null;
    });
    if (!genommen) return fehler('vorgang-unbekannt', 404);
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
    // Z2 (Nr. 6): Grabstein für eine verlorene Antwort, nur mit Hashes und dem öffentlichen Schlüssel (für den Gerätebeweis).
    await this.ctx.storage.put(K.grab(v.vorgang), {
      vorgang: v.vorgang,
      abholHash: v.abholHash,
      eHashes: genommen.eHashes,
      kid: konto.kid,
      gid: geraet.gid,
      publicJwk: v.geraet.publicJwk,
      angemeldetSeit: geraet.angemeldetSeit,
      bis: jetzt + GRAB_MS,
    });
    return { ok: true, zustand: 'bestaetigt', konto: { ...ohneGeheimes(konto), stufe: this.stufeVon(konto) }, geraet: ohneSchluessel(geraet) };
  }

  /**
   * Z2: stimmt `eHash` (sha256 des mitgeschickten e) mit einem der gespeicherten Hashes? Ohne e oder ohne Liste nie. Z2 Fixrunde 1
   * (I1): jeder Eintrag wird zeitkonstant verglichen, alle Vergleiche laufen, erst danach zählt ein Treffer (kein früher Abbruch, der
   * die Position verrät).
   */
  async eStimmt(eHash, liste) {
    if (!Array.isArray(liste) || liste.length === 0 || typeof eHash !== 'string' || eHash === '') return false;
    const treffer = await Promise.all(liste.map((h) => gleichOhneZeitleck(eHash, typeof h === 'string' ? h : '')));
    return treffer.reduce((ja, t) => ja || t, false);
  }

  /**
   * Z2 (Nr. 6): Abholen am Grabstein. Dasselbe Abholgeheimnis, ein frischer Beweis desselben Geräts und dasselbe e innerhalb von 60 s
   * nach dem Abholen → dieselbe Anmeldung noch einmal (Konto frisch geprüft, Gerät unverändert, gleiches `angemeldetSeit`; der
   * Worker stellt dazu eine neue Sitzung desselben Geräts aus). Alles andere ist 404 `vorgang-unbekannt` (ein fremdes Gerät 403),
   * wie ohne Grabstein. Ist das Gerät inzwischen abgemeldet oder anders angemeldet, gibt es nichts mehr. Nach 60 s ist er weg.
   */
  async grabAbholen(b, vid, jetzt) {
    const st = this.ctx.storage;
    const g = await st.get(K.grab(vid));
    if (!g || !(await gleichOhneZeitleck(String(b.abholHash ?? ''), g.abholHash))) return fehler('vorgang-unbekannt', 404);
    if (!(g.bis > jetzt)) {
      await st.delete(K.grab(vid));
      return fehler('vorgang-unbekannt', 404);
    }
    if (!(await pruefeGeraeteBeweis(g.publicJwk, b.beweis, 'abholen', vid, jetzt))) return fehler('geraet-unbekannt', 403);
    if (!(await this.eStimmt(b.eHash, g.eHashes))) return fehler('vorgang-unbekannt', 404);
    const konto = await this.ladeKonto(g.kid);
    if (!konto) return fehler('geloescht', 403);
    const gueltig = kontoGueltig(konto, jetzt);
    if (!gueltig.ok) return fehler(gueltig.grund, 403);
    const geraet = await st.get(K.geraet(g.gid));
    if (!geraet || geraet.letztesKonto !== g.kid || geraet.angemeldetSeit !== g.angemeldetSeit) return fehler('vorgang-unbekannt', 404);
    return { ok: true, zustand: 'bestaetigt', konto: { ...ohneGeheimes(konto), stufe: this.stufeVon(konto) }, geraet: ohneSchluessel(geraet) };
  }

  /**
   * Aktion `vorgang-abbrechen` `{ vorgang, abholHash }` → `{ ok }` (Launcher bricht ab, Spec 4.1). Z2 Fixrunde 1: das Löschen in der
   * Reihe der Bestätigungen, damit ein gleichzeitiges weiteres Ja den abgebrochenen Vorgang nicht wiederbelebt.
   */
  async vorgangAbbrechen(b) {
    const v = typeof b.vorgang === 'string' && b.vorgang ? await this.ctx.storage.get(K.vorgang(b.vorgang)) : null;
    if (!v || !(await gleichOhneZeitleck(String(b.abholHash ?? ''), v.abholHash))) return fehler('vorgang-unbekannt', 404);
    await this.inReihe(async () => {
      const frisch = await this.ctx.storage.get(K.vorgang(v.vorgang));
      if (frisch) await this.vorgangWeg(frisch);
    });
    return { ok: true };
  }

  // ── Sitzung, Lage, Zoom-Anfrage, iveo, alter Schlüssel (Spec 6.1, 6.3, 6.4, 7, 8, OF2) ──

  /**
   * Aktion `sitzung-erneuern` `{ kid, gid, angemeldetSeit, beweis, version, rechnerName }` → `{ konto, geraet }` (Spec 6.1, EP2): jede
   * Start-Prüfung des Launchers. Liest den aktuellen Stand (Stufe, Tools, Events, bis, Zoom-Freigabe, JM-Rechner); der Worker
   * stellt daraus die neue Sitzung aus. Codes (je 403): `geloescht`, `gesperrt`, `zugang-abgelaufen` (S6–S8), `geraet-unbekannt`
   * (S9: Gerät unbekannt, Beweis falsch oder das Gerät gehört inzwischen einem anderen Konto, Spec 6.1 ein Konto je Rechner);
   * 401 `sitzung-abgelaufen` (S2), wenn ein Google-Konto sich vor 90 Tagen oder länger zuletzt mit Google angemeldet hat (Spec 4:
   * wer ausscheidet und sein Google-Konto verliert, kommt so spätestens dann nicht mehr herein; OFP8).
   */
  async sitzungErneuern(b, jetzt) {
    const konto = await this.ladeKonto(b.kid);
    if (!konto) return fehler('geloescht', 403);
    const g = kontoGueltig(konto, jetzt);
    if (!g.ok) return fehler(g.grund, 403);
    const geraet = typeof b.gid === 'string' && b.gid ? await this.ctx.storage.get(K.geraet(b.gid)) : null;
    if (!geraet || geraet.letztesKonto !== konto.kid) return fehler('geraet-unbekannt', 403);
    // Nur die Sitzung der AKTUELLEN Anmeldung dieses Geräts erneuert sich: der Claim angemeldetSeit muss dem Gerät entsprechen
    // (eine ältere Sitzung nach einer neueren Anmeldung desselben Kontos am selben Gerät nicht; AR79).
    if (typeof b.angemeldetSeit !== 'number' || geraet.angemeldetSeit !== b.angemeldetSeit) return fehler('geraet-unbekannt', 403);
    if (!(await pruefeGeraeteBeweis(geraet.publicJwk, b.beweis, 'erneuern', konto.kid, jetzt))) return fehler('geraet-unbekannt', 403);
    if (googleNeuFaellig(konto.art, geraet.angemeldetSeit, jetzt)) return fehler('sitzung-abgelaufen', 401);
    const version = text(b.version, 32);
    const name = rechnerName(b.rechnerName);
    // Der Beweis war ein Nicht-Speicher-await: das Gerät frisch lesen, prüfen, ändern, schreiben, ohne await dazwischen.
    const frisch = await this.ctx.storage.get(K.geraet(geraet.gid));
    if (!frisch || frisch.letztesKonto !== konto.kid || frisch.angemeldetSeit !== b.angemeldetSeit) return fehler('geraet-unbekannt', 403);
    frisch.letzterKontakt = jetzt;
    if (version) frisch.version = version;
    if (name) frisch.name = name;
    await this.ctx.storage.put(K.geraet(frisch.gid), frisch);
    return { ok: true, konto: { ...ohneGeheimes(konto), stufe: this.stufeVon(konto) }, geraet: ohneSchluessel(frisch) };
  }

  /**
   * Aktion `abmelden` `{ kid, gid, angemeldetSeit }` → `{ ok }` (EP26): Konto und Gerät bleiben, aber das Gerät gehört danach keinem
   * Konto mehr (`letztesKonto` und `angemeldetSeit` null): eine alte Sitzung lässt sich mit einem frischen Gerätebeweis nicht mehr
   * erneuern (Z1-W1, Gesamtprüfung Minor 1). `angemeldetSeit` ist der Claim der abmeldenden Sitzung; stimmt er nicht mit dem Gerät
   * überein (neuere Anmeldung desselben Kontos am selben Gerät), bleibt alles stehen (AR74 D).
   */
  async abmelden(b, jetzt) {
    const geraet = typeof b.gid === 'string' && b.gid ? await this.ctx.storage.get(K.geraet(b.gid)) : null;
    // Nur wer sich mit der AKTUELLEN Anmeldung dieses Geräts abmeldet: eine alte Sitzung (Claim angemeldetSeit) löst eine neuere
    // Anmeldung desselben Kontos am selben Gerät nicht (AR74 D).
    if (geraet && geraet.letztesKonto === b.kid && typeof b.angemeldetSeit === 'number' && geraet.angemeldetSeit === b.angemeldetSeit) {
      geraet.letzterKontakt = jetzt;
      geraet.letztesKonto = null;
      geraet.angemeldetSeit = null;
      await this.ctx.storage.put(K.geraet(geraet.gid), geraet);
    }
    return { ok: true };
  }

  /**
   * Aktion `ich` `{ kid }` → `{ kontoAktiv, grund, zoomAnfrage, adminOffen }` (Spec 4.2, 6.3, EP15, EP23): der aktuelle Stand
   * im DO, nicht der festgehaltene. `grund` ist `gesperrt`, `geloescht` oder `zugang-abgelaufen`; `zoomAnfrage` die jüngste
   * Anfrage des Kontos; `adminOffen` zählt offene Anfragen nur für aktuelle, aktive Admins (sonst 0).
   */
  async ich(b, jetzt) {
    const konto = await this.ladeKonto(b.kid);
    const g = konto ? kontoGueltig(konto, jetzt) : { ok: false, grund: 'geloescht' };
    let juengste = null;
    let offen = 0;
    for (const [, a] of await this.anfragenLesen(jetzt)) {
      if (a.zustand === 'offen') offen++;
      if (konto && a.kid === konto.kid && (!juengste || a.am > juengste.am)) juengste = a;
    }
    return {
      ok: true,
      kontoAktiv: g.ok,
      grund: g.ok ? null : g.grund,
      zoomAnfrage: juengste ? anfrageStand(juengste) : null,
      adminOffen: g.ok && this.stufeVon(konto) === 'admin' ? offen : 0,
    };
  }

  /**
   * Aktion `zoom-anfragen` `{ kid, gid, zweck, von, bis }` → `{ anfrage }` (Spec 8, Schritt 1): nur Externe nach der aktuellen
   * Stufe im DO (Admin und Kollege → 400 nicht-noetig, S13), höchstens eine offene Anfrage je Konto (409 konflikt, S12c),
   * Zweck 1–200 Zeichen, `von < bis`, `bis` in der Zukunft (sonst 400 ungueltig). Rechnername, JM-Markierung und Plattform des
   * Geräts werden mit abgelegt (Reiter Anfragen, M40/M41).
   */
  async zoomAnfragen(b, jetzt) {
    const konto = await this.ladeKonto(b.kid);
    if (!konto) return fehler('geloescht', 403);
    const g = kontoGueltig(konto, jetzt);
    if (!g.ok) return fehler(g.grund, 403);
    if (this.stufeVon(konto) !== 'externer') return fehler('nicht-noetig', 400);
    const zweck = text(b.zweck, 200);
    if (!zweck || !Number.isFinite(b.von) || !Number.isFinite(b.bis) || !(b.bis > b.von) || !(b.bis > jetzt)) return fehler('ungueltig', 400);
    const geraet = typeof b.gid === 'string' && b.gid ? await this.ctx.storage.get(K.geraet(b.gid)) : null;
    if (!geraet || geraet.letztesKonto !== konto.kid) return fehler('geraet-unbekannt', 403);
    for (const [, a] of await this.anfragenLesen(jetzt)) {
      if (a.kid === konto.kid && a.zustand === 'offen') return fehler('konflikt', 409);
    }
    const anfrage = {
      id: zufall(9),
      kid: konto.kid,
      gid: geraet.gid,
      rechnerName: geraet.name,
      jm: geraet.jm === true,
      plattform: geraet.plattform,
      zweck,
      von: b.von,
      bis: b.bis,
      zustand: 'offen',
      am: jetzt,
      entschiedenAm: null,
      entschiedenVon: null,
      freigegebenBis: null,
    };
    await this.ctx.storage.put(K.anfrage(anfrage.id), anfrage);
    return { ok: true, anfrage: anfrageStand(anfrage) };
  }

  /**
   * Aktion `iveo-fuer` `{ stufe, tools, events }` → `{ events: [{ key, basis, slug, name, iv, ct }] }` (Spec 6.4, EP13): der
   * Stand kommt aus den Claims der Sitzung (beim Start festgehalten, 6.1). Ausgewählt wird mit `darf(…, 'iveo')` aus
   * konto-kern.js: Admin und Kollege alle hinterlegten Events, Externe nur mit Werkzeug `iveo` und nur die ausgewählten. Der
   * Worker entschlüsselt (P16).
   */
  async iveoFuer(b, jetzt) {
    const stand = { stufe: b.stufe, tools: b.tools, events: b.events, exp: jetzt + 1 };
    const events = [];
    for (const [, e] of await this.ctx.storage.list({ prefix: 'iveo:' })) {
      if (darf(stand, 'iveo', { event: e.key, jetzt })) events.push({ key: e.key, basis: e.basis, slug: e.slug, name: e.name, iv: e.iv, ct: e.ct });
    }
    return { ok: true, events };
  }

  /**
   * Aktion `altkey-zaehlen` `{ gruppe, plattform, arch }` → `{ ok }` (OF2, OFP2): zählt Anfragen mit dem alten PROXY_KEY je Tag
   * (UTC), Gruppe (`katalog`, `qa`) und `‹plattform›-‹arch›` (`win`/`mac` und `x64`/`arm64`, sonst `unbekannt`); keine IP,
   * keine Kennung des Rechners.
   */
  async altkeyZaehlen(b, jetzt) {
    if (b.gruppe !== 'katalog' && b.gruppe !== 'qa') return fehler('ungueltig', 400);
    const plattform = `${b.plattform === 'win' || b.plattform === 'mac' ? b.plattform : 'unbekannt'}-${b.arch === 'x64' || b.arch === 'arm64' ? b.arch : 'unbekannt'}`;
    const tag = new Date(jetzt).toISOString().slice(0, 10);
    const key = `altkey:${tag}:${b.gruppe}:${plattform}`;
    const alt = await this.ctx.storage.get(key);
    await this.ctx.storage.put(key, { tag, gruppe: b.gruppe, plattform, anzahl: (alt ? alt.anzahl : 0) + 1, zuletzt: jetzt });
    return { ok: true };
  }

  /**
   * Aktion `qa-inhaber` `{ eventHash, kidHash, gidHash, bisMs }` (Z3, OE3, AR55): wem gehört ein Q&A-Event? Compare-and-set
   * im DO: Lesen und Schreiben ohne `await` auf etwas anderes als den Speicher dazwischen (Eingangs-Tor), darum entscheiden
   * zwei gleichzeitige Freigaben verschiedener Konten eindeutig. Alle Hashes sind SHA-256 hex; die Event-ID selbst kommt nie hierher.
   *   - noch kein Inhaber, Freigabe (kidHash und gidHash): binden → { ok, inhaber, neu: true }
   *   - Inhaber da, kidHash ODER gidHash gleich → { ok, inhaber, neu: false } (bis wird nur verlängert)
   *   - sonst 403 keine-freigabe; der alte Schlüssel (ohne beide Hashes) bei gebundenem Event ebenso (EP33)
   *   - der alte Schlüssel ohne Inhaber: ok, nichts gebunden, inhaber null
   * `bis` (ms) ist höchstens 30 Tage nach jetzt; ein Eintrag mit bis < jetzt gilt als nicht vorhanden und wird beim Lesen gelöscht.
   */
  async qaInhaber(b, jetzt) {
    const mitKid = b.kidHash !== undefined;
    const mitGid = b.gidHash !== undefined;
    if (!HEX64.test(b.eventHash) || mitKid !== mitGid || (mitKid && !(HEX64.test(b.kidHash) && HEX64.test(b.gidHash))) || !Number.isFinite(b.bisMs)) {
      return fehler('ungueltig', 400);
    }
    const st = this.ctx.storage;
    const key = K.qaInhaber(b.eventHash);
    let inhaber = (await st.get(key)) ?? null;
    // Ab hier bis zum Schreiben kein await auf etwas anderes als den Speicher (Eingangs-Tor).
    if (inhaber && !(inhaber.bis >= jetzt)) {
      await st.delete(key);
      inhaber = null;
    }
    const bis = Math.min(b.bisMs, jetzt + QA_INHABER_MAX_MS);
    if (!inhaber) {
      if (!mitKid) return { ok: true, inhaber: null, neu: false };
      inhaber = { kidHash: b.kidHash, gidHash: b.gidHash, bis };
      await st.put(key, inhaber);
      return { ok: true, inhaber, neu: true };
    }
    if (!mitKid || (b.kidHash !== inhaber.kidHash && b.gidHash !== inhaber.gidHash)) return fehler('keine-freigabe', 403);
    // Nur bei mehr als einer halben Stunde Zuwachs schreiben: Q&A fragt alle 5 s, jedes Mal ein Schreiben wäre unnötige Last.
    if (bis - inhaber.bis > QA_INHABER_SCHRITT_MS) {
      inhaber = { ...inhaber, bis };
      await st.put(key, inhaber);
    }
    return { ok: true, inhaber, neu: false };
  }

  // ── Admin-Maske (Spec 7, 4, 8, 9; EP15, EP19, EP20, OFP4) ──

  /** Aktueller Admin im DO (OFP4): Konto da, gültig, wirksame Stufe `admin` (ERSTER_ADMIN zählt immer). Nie aus den Claims. */
  async aktuellerAdmin(kid, jetzt) {
    const konto = await this.ladeKonto(kid);
    return this.istAktiverAdmin(konto, jetzt) ? konto : null;
  }

  /**
   * Aktion `admin-uebersicht` `{ kid }` → AdminUebersicht (Plan 10.5): alle Zugänge (auch abgelaufene und gesperrte, nach
   * Name), iveo-Events ohne `iv`/`ct`, Zoom-Anfragen (jüngste zuerst; Rechnername, JM und Plattform vom Gerät, sonst aus der
   * Anfrage), Geräte ohne Schlüssel (`letztesKonto` = Kennung, die Maske zeigt den Namen aus `zugaenge`), alter Schlüssel mit
   * Frist und Diagnose aus `alterKeyGilt(env, 'katalog')` und den Zeilen der Zählung (jüngster Tag zuerst). Ohne aktuellen
   * Admin → 403 kein-recht.
   */
  async adminUebersicht(b, jetzt) {
    if (!(await this.aktuellerAdmin(b.kid, jetzt))) return fehler('kein-recht', 403);
    const st = this.ctx.storage;
    const konten = [...(await st.list({ prefix: 'konto:' })).values()];
    const nachKid = new Map(konten.map((k) => [k.kid, k]));
    const geraete = new Map([...(await st.list({ prefix: 'geraet:' })).values()].map((g) => [g.gid, g]));
    const zugaenge = konten
      .map((k) => ({
        kid: k.kid,
        email: k.email,
        name: k.name,
        art: k.art,
        stufe: this.stufeVon(k),
        zustand: k.zustand,
        tools: k.tools,
        events: k.events,
        bis: k.bis,
        zoomBis: k.zoomBis,
        einladungBis: k.einladung ? k.einladung.bis : null,
        letzteAnmeldung: k.letzteAnmeldung,
        ersterAdmin: this.istErster(k),
      }))
      .sort(nachName);
    const iveo = [...(await st.list({ prefix: 'iveo:' })).values()].map((e) => ({ key: e.key, basis: e.basis, slug: e.slug, name: e.name, am: e.am, von: e.von }));
    const anfragen = (await this.anfragenLesen(jetzt))
      .map(([, a]) => {
        const k = nachKid.get(a.kid);
        const g = geraete.get(a.gid);
        return {
          id: a.id,
          kid: a.kid,
          name: k ? k.name : '',
          email: k ? k.email : '',
          zweck: a.zweck,
          von: a.von,
          bis: a.bis,
          gid: a.gid,
          rechnerName: g ? g.name : a.rechnerName,
          jm: g ? g.jm === true : a.jm === true,
          plattform: g ? g.plattform : a.plattform,
          zustand: a.zustand,
          am: a.am,
        };
      })
      .sort((x, y) => y.am - x.am);
    const geraeteListe = [...geraete.values()]
      .map((g) => ({
        gid: g.gid,
        name: g.name,
        plattform: g.plattform,
        arch: g.arch,
        version: g.version,
        jm: g.jm === true,
        ersterKontakt: g.ersterKontakt,
        letzterKontakt: g.letzterKontakt,
        letztesKonto: g.letztesKonto ?? null,
      }))
      .sort((x, y) => y.letzterKontakt - x.letzterKontakt);
    const frist = alterKeyGilt(this.env, 'katalog', jetzt);
    const zeilen = [...(await st.list({ prefix: 'altkey:', reverse: true })).values()].map((z) => ({
      tag: z.tag,
      gruppe: z.gruppe,
      plattform: z.plattform,
      anzahl: z.anzahl,
      zuletzt: z.zuletzt,
    }));
    return { ok: true, zugaenge, iveo, anfragen, geraete: geraeteListe, altKey: { bis: frist.bis, diagnose: frist.diagnose, zeilen } };
  }

  /**
   * Aktion `admin-aktion` `{ kid, aktion }` → `{ ok: true, einladungscode?, codeBis? }` (Plan 10.5 AdminAktion; bei
   * `iveo-hinterlegen` statt `token` je Event `{ iv, ct }`, 10.4). Prüft zuerst den aktuellen Admin im DO (OFP4: ein
   * herabgestufter oder gesperrter Admin kann sofort nichts mehr); jede gelungene Aktion schreibt genau einen
   * Protokolleintrag mit `wer` = E-Mail des Admins (EP19). Codes: 400 ungueltig/domain, 403 kein-recht/erster-admin,
   * 404 vorgang-unbekannt (unbekannte Kennung), 409 konflikt (S12a, S12b).
   */
  async adminAktion(b, jetzt) {
    const admin = await this.aktuellerAdmin(b.kid, jetzt);
    if (!admin) return fehler('kein-recht', 403);
    const a = b.aktion && typeof b.aktion === 'object' && !Array.isArray(b.aktion) ? b.aktion : {};
    const methode = typeof a.aktion === 'string' && Object.hasOwn(ADMIN_AKTIONEN, a.aktion) ? ADMIN_AKTIONEN[a.aktion] : null;
    if (!methode) return fehler('ungueltig', 400);
    return this[methode](a, admin.email, jetzt);
  }

  /**
   * Stufe, Werkzeuge, Events, „Zugang bis“ und Zoom-Freigabe prüfen (Spec 5, M27): Stufe aus STUFEN, Werkzeuge aus WERKZEUGE
   * (ohne Doppelte), Events nur hinterlegte Schlüssel, `bis` und `zoomBis` Zahl oder null, Externe brauchen `bis`. Sonst null.
   */
  async zugangsWerte(a) {
    if (!STUFEN.includes(a.stufe)) return null;
    if (!Array.isArray(a.tools) || a.tools.length > MAX_WERKZEUGE || !a.tools.every((t) => WERKZEUGE.includes(t))) return null;
    if (!Array.isArray(a.events) || a.events.length > MAX_EVENTS || !a.events.every((e) => typeof e === 'string')) return null;
    for (const e of a.events) if (!(await this.ctx.storage.get(K.iveo(e)))) return null;
    const zeitOderNull = (w) => w === null || Number.isFinite(w);
    if (!zeitOderNull(a.bis) || !zeitOderNull(a.zoomBis)) return null;
    if (a.stufe === 'externer' && a.bis === null) return null;
    return { stufe: a.stufe, tools: [...new Set(a.tools)], events: [...new Set(a.events)], bis: a.bis, zoomBis: a.zoomBis };
  }

  /** `zugang-speichern` (Spec 7, 4): erster Admin → 403 erster-admin (S16); den letzten aktiven Admin entmachten → 409 (S12a). */
  async zugangSpeichern(a, wer, jetzt) {
    const konto = await this.ladeKonto(a.kid);
    if (!konto) return fehler('vorgang-unbekannt', 404);
    if (this.istErster(konto)) return fehler('erster-admin', 403);
    const werte = await this.zugangsWerte({ ...a, bis: a.bis ?? null, zoomBis: a.zoomBis ?? null });
    if (!werte) return fehler('ungueltig', 400);
    // Der letzte Admin darf keine kurze Frist bekommen (unter 30 Tagen): sonst liefe er aus und es gäbe keinen mehr (Z1-W1).
    const bleibtAdmin = werte.stufe === 'admin' && (werte.bis === null || werte.bis > jetzt + ADMIN_FRIST_MIN_MS);
    if (this.istAktiverAdmin(konto, jetzt) && !bleibtAdmin && !(await this.adminBleibt(jetzt, konto.kid))) return fehler('konflikt', 409);
    const vorher = { stufe: konto.stufe, tools: konto.tools, events: konto.events, bis: konto.bis, zoomBis: konto.zoomBis };
    Object.assign(konto, werte, { geaendert: jetzt });
    await this.speichereKonto(konto);
    await this.protokolliere({ am: jetzt, wer, was: 'zugang-speichern', wen: konto.email, details: { kid: konto.kid, vorher, nachher: werte } });
    return { ok: true };
  }

  /**
   * `einladen` (Spec 4, EP4): legt einen Externen mit Einladungscode an (12 Zeichen, gespeichert nur als SHA-256 der
   * normalisierten Form, 72 h, einmal). Der Code steht nur in dieser Antwort. jakobsmedien.com → 400 domain (S17, M28);
   * vergebene E-Mail → 409 konflikt (S12b); ohne Name, gültige E-Mail oder „bis“ in der Zukunft → 400 ungueltig.
   */
  async einladen(a, wer, jetzt) {
    const email = normEmail(a.email);
    if (!EMAIL_FORM.test(email)) return fehler('ungueltig', 400);
    if (istDomainKonto(email)) return fehler('domain', 400);
    if (await this.kontoPerEmail(email)) return fehler('konflikt', 409);
    const name = text(a.name, 80);
    const werte = await this.zugangsWerte({ stufe: 'externer', tools: a.tools, events: a.events, bis: a.bis ?? null, zoomBis: null });
    if (!name || !werte || !(werte.bis > jetzt)) return fehler('ungueltig', 400);
    const code = neuerEinladungsCode();
    const konto = {
      kid: zufall(12),
      email,
      name,
      art: 'passwort',
      stufe: 'externer',
      zustand: 'aktiv',
      tools: werte.tools,
      events: werte.events,
      bis: werte.bis,
      zoomBis: null,
      einladung: { hash: await sha256B64url(normalisiereCode(code)), bis: jetzt + EINLADUNG_MS },
      erstellt: jetzt,
      geaendert: jetzt,
      letzteAnmeldung: null,
    };
    await this.speichereKonto(konto);
    await this.protokolliere({ am: jetzt, wer, was: 'einladen', wen: email, details: { kid: konto.kid, tools: werte.tools, events: werte.events, bis: werte.bis } });
    return { ok: true, einladungscode: code, codeBis: konto.einladung.bis };
  }

  /** `neuer-code` (Spec 4, M19): neues Einladungsverfahren, das bisherige Passwort gilt nicht mehr; nur für E-Mail-Zugänge. */
  async neuerCode(a, wer, jetzt) {
    const konto = await this.ladeKonto(a.kid);
    if (!konto) return fehler('vorgang-unbekannt', 404);
    if (konto.art !== 'passwort') return fehler('ungueltig', 400);
    const code = neuerEinladungsCode();
    delete konto.passwort;
    konto.einladung = { hash: await sha256B64url(normalisiereCode(code)), bis: jetzt + EINLADUNG_MS };
    konto.geaendert = jetzt;
    await this.speichereKonto(konto);
    await this.ctx.storage.delete(K.fehl(konto.kid));
    await this.protokolliere({ am: jetzt, wer, was: 'neuer-code', wen: konto.email, details: { kid: konto.kid } });
    return { ok: true, einladungscode: code, codeBis: konto.einladung.bis };
  }

  /** `zugang-loeschen` (Spec 4): Google sperren, Externe löschen (P3). */
  async adminZugangLoeschen(a, wer, jetzt) {
    return this.zugangLoeschen(a.kid, wer, jetzt);
  }

  /** `entsperren` (Spec 4): Sperre aufheben (P3). */
  async adminEntsperren(a, wer, jetzt) {
    return this.entsperren(a.kid, wer, jetzt);
  }

  /**
   * `iveo-hinterlegen` (Spec 6.4, 7): je Event `{ slug, name, iv, ct }` unter `<normalisierte Basis>|<slug>` (EP13); ein
   * vorhandenes Event wird ersetzt. Klartext kennt der DO nie. Ohne Basis, ohne Events, mit `|` im Slug oder ohne iv/ct → 400.
   */
  async iveoHinterlegen(a, wer, jetzt) {
    const basis = normalisiereBasis(a.basis);
    const liste = Array.isArray(a.events) ? a.events : [];
    if (!basis || liste.length === 0 || liste.length > MAX_EVENTS) return fehler('ungueltig', 400);
    const eintraege = [];
    for (const e of liste) {
      const slug = e && typeof e.slug === 'string' ? e.slug.trim() : '';
      const key = iveoSchluessel(a.basis, slug); // aus der Roh-Basis, genau einmal normalisiert (AR74): derselbe String wie im Worker
      if (!key) return fehler('ungueltig', 400);
      if (typeof e.iv !== 'string' || typeof e.ct !== 'string' || !B64URL.test(e.iv) || !B64URL.test(e.ct)) return fehler('ungueltig', 400);
      eintraege.push({ key, basis, slug, name: text(e.name, 200) || slug, iv: e.iv, ct: e.ct, am: jetzt, von: wer });
    }
    for (const e of eintraege) await this.ctx.storage.put(K.iveo(e.key), e);
    await this.protokolliere({ am: jetzt, wer, was: 'iveo-hinterlegen', wen: basis, details: { slugs: eintraege.map((e) => e.slug) } });
    return { ok: true };
  }

  /** `iveo-entfernen` (Spec 7, M34): Launcher, die das Token schon haben, behalten es bis zu ihrem nächsten Start. */
  async iveoEntfernen(a, wer, jetzt) {
    const key = typeof a.key === 'string' ? a.key : '';
    const e = key ? await this.ctx.storage.get(K.iveo(key)) : null;
    if (!e) return fehler('vorgang-unbekannt', 404);
    // Erst alle Konten bereinigen, dann das Event löschen: scheitert die Schleife mittendrin, lässt sich der Vorgang wiederholen.
    // Das Event auch aus den Zugängen nehmen: sonst bleibt ein nicht mehr hinterlegter Schlüssel in `konto.events` und jedes
    // `zugang-speichern` mit den bisherigen Events scheitert (zugangsWerte). Seiten zu 128 Konten, nur Betroffene schreiben.
    let ab;
    for (;;) {
      const seite = [...(await this.ctx.storage.list({ prefix: 'konto:', limit: 128, ...(ab ? { start: ab } : {}) })).entries()];
      for (const [sk, k] of seite) {
        if (Array.isArray(k.events) && k.events.includes(key)) {
          k.events = k.events.filter((x) => x !== key);
          k.geaendert = jetzt;
          await this.ctx.storage.put(sk, k);
        }
      }
      if (seite.length < 128) break;
      ab = `${seite[seite.length - 1][0]}\u0000`;
    }
    await this.ctx.storage.delete(K.iveo(key));
    await this.protokolliere({ am: jetzt, wer, was: 'iveo-entfernen', wen: e.basis, details: { slug: e.slug } });
    return { ok: true };
  }

  /** Offene Anfrage laden; unbekannt → 404, schon entschieden → 400 (Spec 8). */
  async offeneAnfrage(id, jetzt) {
    const anfrage = typeof id === 'string' && id ? await this.ctx.storage.get(K.anfrage(id)) : null;
    if (!anfrage) return { fehler: fehler('vorgang-unbekannt', 404) };
    // Eine offene Anfrage, deren „bis“ vorbei ist, gibt es nicht mehr (anfragenLesen räumt sie auf).
    if (anfrage.zustand === 'offen' && !(anfrage.bis > jetzt)) {
      await this.ctx.storage.delete(K.anfrage(anfrage.id));
      return { fehler: fehler('vorgang-unbekannt', 404) };
    }
    if (anfrage.zustand !== 'offen') return { fehler: fehler('ungueltig', 400) };
    return { anfrage };
  }

  /** `anfrage-freigeben` (Spec 8, Schritt 3): `zoomBis` am Konto, Anfrage geschlossen; wirkt beim nächsten Start (6.3). */
  async anfrageFreigeben(a, wer, jetzt) {
    const { anfrage, fehler: f } = await this.offeneAnfrage(a.id, jetzt);
    if (f) return f;
    if (!Number.isFinite(a.bis) || !(a.bis > jetzt)) return fehler('ungueltig', 400);
    const konto = await this.ladeKonto(anfrage.kid);
    if (!konto) return fehler('vorgang-unbekannt', 404);
    konto.zoomBis = a.bis;
    konto.geaendert = jetzt;
    await this.speichereKonto(konto);
    Object.assign(anfrage, { zustand: 'freigegeben', entschiedenAm: jetzt, entschiedenVon: wer, freigegebenBis: a.bis });
    await this.ctx.storage.put(K.anfrage(anfrage.id), anfrage);
    await this.protokolliere({ am: jetzt, wer, was: 'anfrage-freigeben', wen: konto.email, details: { id: anfrage.id, bis: a.bis, gid: anfrage.gid } });
    return { ok: true };
  }

  /** `anfrage-ablehnen` (Spec 8, Schritt 4): Anfrage geschlossen, der Externe sieht es beim nächsten Kontakt (`ich`). */
  async anfrageAblehnen(a, wer, jetzt) {
    const { anfrage, fehler: f } = await this.offeneAnfrage(a.id, jetzt);
    if (f) return f;
    Object.assign(anfrage, { zustand: 'abgelehnt', entschiedenAm: jetzt, entschiedenVon: wer });
    await this.ctx.storage.put(K.anfrage(anfrage.id), anfrage);
    const konto = await this.ladeKonto(anfrage.kid);
    await this.protokolliere({ am: jetzt, wer, was: 'anfrage-ablehnen', wen: konto ? konto.email : anfrage.kid, details: { id: anfrage.id } });
    return { ok: true };
  }

  /** `geraet-markieren` (Spec 7: JM-Rechner); wirkt für Zoom beim nächsten Start (6.3). */
  async geraetMarkieren(a, wer, jetzt) {
    const geraet = typeof a.gid === 'string' && a.gid ? await this.ctx.storage.get(K.geraet(a.gid)) : null;
    if (!geraet) return fehler('vorgang-unbekannt', 404);
    if (typeof a.jm !== 'boolean') return fehler('ungueltig', 400);
    geraet.jm = a.jm;
    await this.ctx.storage.put(K.geraet(geraet.gid), geraet);
    await this.protokolliere({ am: jetzt, wer, was: 'geraet-markieren', wen: geraet.name, details: { gid: geraet.gid, jm: a.jm } });
    return { ok: true };
  }

  // ── Ende der Methoden ──
}
