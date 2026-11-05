// Anmeldung im Launcher (Teil 1) · Rechte, Kontostand und Fristen (Spec 4, 5, 6.1, 9, 9.1, 10; Plan 10.2, EP9, EP16, OF1, OF4).
// Rein und synchron, ohne Import und ohne Konsole: der Worker (konto-do.js, konto-zugang.js, konto-relay.js) und der
// Launcher-Test (P7, apps/launcher/test/konto-rechte.test.ts) laden dieselbe Datei. Nur benannte Exporte, kein Default.
// Alle Zeiten sind Unix-ms. Die Falltabelle test/rechte-faelle.json prüft `darf` hier und im Launcher gleich.

export const STUFEN = Object.freeze(['admin', 'kollege', 'externer']);
export const WERKZEUGE = Object.freeze(['connect-raum', 'qa', 'iveo']);
export const FUNKTIONEN = Object.freeze(['launcher-update', 'katalog', 'kochbuch', 'feedback', 'ki-entwurf', 'connect-raum', 'zoom', 'qa', 'iveo', 'admin']);
export const SITZUNG_MAX_MS = 30 * 24 * 3600_000;
export const VORGANG_MS = 5 * 60_000;
export const EINLADUNG_MS = 72 * 3600_000;
export const FREIGABE_MS = Object.freeze({ 'qa-relay': 72 * 3600_000 });
export const ZWECK_FUNKTION = Object.freeze({ 'qa-relay': 'qa' });
export const BREMSE = Object.freeze({ fehlversuche: 5, sperreMs: 15 * 60_000 });
export const PROTOKOLL_MS = 365 * 24 * 3600_000;
export const DOMAIN = 'jakobsmedien.com';
/** Spätestens so lange nach der letzten Anmeldung mit Google erneuert der DO die Sitzung eines Google-Kontos (Spec 4, OFP8). */
export const GOOGLE_NEU_MS = 90 * 24 * 3600_000;

// ALTKEY_BIS / ALTKEY_CONNECT_BIS: ISO-Datum `JJJJ-MM-TT` (00:00 UTC) oder Datum mit Uhrzeit und Zone
// (`2026-12-15T00:00:00+01:00`, `…Z`). Der Zeitpunkt ist der erste Augenblick ohne alten Schlüssel.
const FRIST_FORM = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/;

/**
 * Basis-URL eines iveo-Events wie `normalizeIveoBaseUrl` in @jm/iveo (packages/iveo/src/client.ts): getrimmt, ohne Schema mit
 * https://, ohne Schrägstriche am Ende, mit Host. Leer, ohne Host oder mit `|` (Trenner im Schlüssel) → null; eine Vorgabe-Basis
 * kennt der Worker nicht, der Launcher schickt die Basis immer mit (P27). Die EINE Stelle der Normalisierung (Z1-W1): der Worker
 * (AAD beim Verschlüsseln und Entschlüsseln), der DO (Schlüssel im Speicher) und die feste iveo-Liste (W2) rufen sie.
 */
export function normalisiereBasis(roh) {
  const t = typeof roh === 'string' ? roh.trim() : '';
  if (!t || t.includes('|')) return null;
  const mitSchema = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  const sauber = mitSchema.replace(/\/+$/, '');
  try {
    return new URL(sauber).host ? sauber : null;
  } catch {
    return null;
  }
}

/**
 * Der iveo-Schlüssel `<normalisierte Basis>|<Slug getrimmt>` (EP13) genau in der Schreibweise, in der der DO ihn speichert, oder
 * null (Basis unbrauchbar, Slug leer, länger als 120 Zeichen oder mit `|`). Er ist auch die AAD des Geheimtexts (Z1-W1).
 */
export function iveoSchluessel(basis, slug) {
  const b = normalisiereBasis(basis);
  const s = typeof slug === 'string' ? slug.trim() : '';
  if (!b || !s || s.length > 120 || s.includes('|')) return null;
  return `${b}|${s}`;
}

function intern(stufe) {
  return stufe === 'admin' || stufe === 'kollege';
}

function textListe(x) {
  return Array.isArray(x) ? x.filter((w) => typeof w === 'string') : [];
}

/**
 * Darf ein Stand (Claims der Sitzung, Spec 6.1: beim Start festgehalten) eine Funktion nutzen (Spec 9.1, Plan 10.2)?
 * `launcher-update` immer; sonst nie ohne Stand oder mit `exp <= jetzt`. `event` ist der iveo-Schlüssel `basis|slug`.
 */
export function darf(stand, funktion, { event, jetzt } = {}) {
  if (funktion === 'launcher-update') return true;
  if (!stand || typeof stand !== 'object') return false;
  if (typeof jetzt !== 'number' || typeof stand.exp !== 'number' || !(stand.exp > jetzt)) return false;
  const stufe = stand.stufe;
  if (!STUFEN.includes(stufe)) return false;
  const tools = textListe(stand.tools);
  switch (funktion) {
    case 'katalog':
    case 'kochbuch':
    case 'feedback':
      return true;
    case 'ki-entwurf':
      return intern(stufe);
    case 'admin':
      return stufe === 'admin';
    case 'connect-raum':
    case 'qa':
      return intern(stufe) || tools.includes(funktion);
    case 'iveo':
      if (intern(stufe)) return true; // Admin und Kollege: jedes hinterlegte Event
      return tools.includes('iveo') && typeof event === 'string' && textListe(stand.events).includes(event);
    case 'zoom':
      if (stand.plattform !== 'win') return false; // Spec 8, N15: Zoom in Connect nur unter Windows
      if (intern(stufe)) return true; // OF1: Kollegen und Admins auf jedem Windows-Rechner
      return stand.zoom === true && stand.jm === true; // OF4: Externe nur mit Freigabe und nur auf JM-Rechnern
    default:
      return false;
  }
}

/** Ist `email` die E-Mail aus dem Worker-Secret ERSTER_ADMIN (Groß/Klein und Leerzeichen egal, EP20)? */
export function istErsterAdmin(email, ersterAdmin) {
  if (typeof email !== 'string' || typeof ersterAdmin !== 'string') return false;
  const soll = ersterAdmin.trim().toLowerCase();
  return soll !== '' && email.trim().toLowerCase() === soll;
}

/**
 * Muss sich ein Google-Konto neu mit Google anmelden (Spec 4: wer ausscheidet und sein Google-Konto verliert, kommt nicht
 * mehr herein; OFP8)? Die Erneuerung beim Start fragt Google nicht; darum gilt sie für ein Google-Konto nur bis 90 Tage nach
 * der letzten Anmeldung mit Google an diesem Rechner (`angemeldetSeit` des Geräts). Ohne Angabe: ja. E-Mail-Zugänge: nie
 * (sie enden mit „Zugang bis“).
 */
export function googleNeuFaellig(art, angemeldetSeit, jetzt) {
  if (art !== 'google') return false;
  return !(typeof angemeldetSeit === 'number' && angemeldetSeit + GOOGLE_NEU_MS > jetzt);
}

/**
 * Kontostand für eine neue Sitzung (Claims ohne Signatur, Plan 10.3): `exp = iat + 30 Tage` (Obergrenze, Spec 6.1);
 * „Zugang bis“ steht nur als `kontoBis` darin und begrenzt den Start (Launcher R4, DO `kontoGueltig`), nicht die Laufzeit:
 * Ablauf wirkt erst beim nächsten Start (Spec 6.3, EP2). `zoom` für Admin und Kollege immer, für Externe nur mit
 * `zoomBis > iat`; `jm`, `plattform`, `gid` und `angemeldetSeit` kommen vom Gerät (der DO setzt `angemeldetSeit` beim
 * Abholen, P4). Erster Admin ist nur ein Google-Konto (EP20). Passwort-Hash und Einladung gehen nie in den Stand.
 */
export function kontoStand(konto, geraet, jetzt, ersterAdmin) {
  const stufe = konto.art === 'google' && istErsterAdmin(konto.email, ersterAdmin) ? 'admin' : konto.stufe;
  const kontoBis = typeof konto.bis === 'number' ? konto.bis : null;
  const zoomBis = typeof konto.zoomBis === 'number' ? konto.zoomBis : null;
  const exp = jetzt + SITZUNG_MAX_MS;
  return {
    v: 1,
    typ: 'sitzung',
    kid: konto.kid,
    email: konto.email,
    name: konto.name,
    art: konto.art,
    stufe,
    tools: textListe(konto.tools).filter((w) => WERKZEUGE.includes(w)),
    events: textListe(konto.events),
    zoom: intern(stufe) || (zoomBis !== null && zoomBis > jetzt),
    zoomBis,
    jm: geraet.jm === true,
    plattform: geraet.plattform === 'win' ? 'win' : 'mac',
    gid: geraet.gid,
    iat: jetzt,
    exp,
    kontoBis,
    angemeldetSeit: typeof geraet.angemeldetSeit === 'number' ? geraet.angemeldetSeit : jetzt,
  };
}

/** Darf sich das Konto jetzt anmelden bzw. eine Sitzung erneuern? Nur `zustand: 'aktiv'` und `bis` in der Zukunft. */
export function kontoGueltig(konto, jetzt) {
  if (!konto || konto.zustand !== 'aktiv') return { ok: false, grund: 'gesperrt' };
  if (typeof konto.bis === 'number' && konto.bis <= jetzt) return { ok: false, grund: 'zugang-abgelaufen' };
  return { ok: true };
}

/** Google-Firmenkonto: genau ein `@`, davor etwas, dahinter genau `jakobsmedien.com` (Groß/Klein egal, Spec 4). */
export function istDomainKonto(email) {
  if (typeof email !== 'string') return false;
  const e = email.trim().toLowerCase();
  const at = e.indexOf('@');
  return at > 0 && at === e.lastIndexOf('@') && e.slice(at + 1) === DOMAIN;
}

/** „Maria S.“: erstes Wort plus Initial des letzten; ein Wort bleibt; ohne Namen der Teil der E-Mail vor dem `@`. */
export function kurzName(name, email) {
  const woerter = typeof name === 'string' ? name.trim().split(/\s+/).filter(Boolean) : [];
  if (woerter.length >= 2) return `${woerter[0]} ${[...woerter[woerter.length - 1]][0].toUpperCase()}.`;
  if (woerter.length === 1) return woerter[0];
  const e = typeof email === 'string' ? email.trim() : '';
  const at = e.indexOf('@');
  return at > 0 ? e.slice(0, at) : e;
}

/**
 * Welche Funktion braucht eine Route (Spec 9.1, Nachmessung 3.3)? `null` = keine (öffentlich oder unbekannt).
 * `/tools/launcher/latest` (dekodierte ID genau `launcher`) ist das Selbst-Update, `jm-launcher` zählt als Katalog (EP10).
 */
export function funktionFuerRoute(method, pathname) {
  const m = String(method || '').toUpperCase();
  const p = String(pathname || '');
  const tools = p.match(/^\/tools\/([^/]+)\/latest\/?$/);
  if (tools) {
    if (m !== 'GET') return null;
    let id;
    try {
      id = decodeURIComponent(tools[1]);
    } catch {
      return null;
    }
    return id === 'launcher' ? 'launcher-update' : 'katalog';
  }
  if (m === 'GET' && (p === '/suite.json' || p === '/changelog.json')) return 'katalog';
  if (m === 'GET' && p === '/cookbook.json') return 'kochbuch';
  if (m === 'POST' && p === '/feedback') return 'feedback';
  if (m === 'POST' && p === '/cookbook/draft') return 'ki-entwurf';
  const qa = p.match(/^\/qa\/([^/]+)(?:\/([a-z]+))?\/?$/);
  if (qa) {
    const sub = qa[2] || '';
    const admin = ((m === 'POST' || m === 'DELETE') && sub === '') || (m === 'GET' && sub === 'pending') || (m === 'POST' && sub === 'ack');
    return admin ? 'qa' : null;
  }
  const raum = p.match(/^\/connect\/([^/]+)(?:\/([a-z]+))?\/?$/);
  if (raum) return (m === 'POST' || m === 'DELETE') && !raum[2] ? 'connect-raum' : null;
  if (/^\/zoom-sdk\/[^/]*\/?$/.test(p)) return m === 'GET' ? 'zoom' : null;
  return null;
}

function liesFrist(text) {
  if (!FRIST_FORM.test(text)) return NaN;
  const j = Number(text.slice(0, 4));
  const mo = Number(text.slice(5, 7));
  const t = Number(text.slice(8, 10));
  const d = new Date(Date.UTC(j, mo - 1, t));
  if (d.getUTCFullYear() !== j || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== t) return NaN;
  return Date.parse(text);
}

/**
 * Gilt der alte PROXY_KEY für eine Routengruppe noch (Spec 10, OF2, EP9)? `katalog` und `qa` bis ALTKEY_BIS, `connect` bis
 * ALTKEY_CONNECT_BIS (in Teil 1 nie gesetzt). Fehlt der Wert oder ist er unlesbar: unbefristet, mit Diagnose für den Reiter
 * Geräte (M44). Die Grenze selbst gilt nicht mehr (`jetzt < bis`). Eine unbekannte Gruppe gilt nie.
 */
export function alterKeyGilt(env, gruppe, jetzt) {
  const name = gruppe === 'connect' ? 'ALTKEY_CONNECT_BIS' : gruppe === 'katalog' || gruppe === 'qa' ? 'ALTKEY_BIS' : null;
  if (!name) return { gilt: false, bis: null, diagnose: null };
  const roh = env ? env[name] : undefined;
  if (roh === undefined || roh === null || (typeof roh === 'string' && roh.trim() === '')) {
    return { gilt: true, bis: null, diagnose: 'ohne-ende' };
  }
  const ms = typeof roh === 'string' ? liesFrist(roh.trim()) : NaN;
  if (!Number.isFinite(ms)) return { gilt: true, bis: null, diagnose: 'unlesbar' };
  return { gilt: jetzt < ms, bis: new Date(ms).toISOString(), diagnose: null };
}

/**
 * Bremse je Konto nach einem Fehlversuch (Spec 4, EP4): der 5. Fehlversuch in Folge sperrt 15 min. Während einer Sperre
 * ändert sich nichts; nach ihrem Ablauf beginnt die Zählung neu. Ein Erfolg löscht die Bremse (der DO speichert dann nichts).
 */
export function nachFehlversuch(bremse, jetzt) {
  const b = bremse && typeof bremse.anzahl === 'number' ? bremse : { anzahl: 0, bisMs: null };
  if (typeof b.bisMs === 'number') {
    if (b.bisMs > jetzt) return { anzahl: b.anzahl, bisMs: b.bisMs };
    return { anzahl: 1, bisMs: null };
  }
  const anzahl = b.anzahl + 1;
  return { anzahl, bisMs: anzahl >= BREMSE.fehlversuche ? jetzt + BREMSE.sperreMs : null };
}

/** Restminuten einer laufenden Sperre (aufgerundet), sonst 0. */
export function bremseAktiv(bremse, jetzt) {
  if (!bremse || typeof bremse.bisMs !== 'number' || bremse.bisMs <= jetzt) return 0;
  return Math.ceil((bremse.bisMs - jetzt) / 60_000);
}
