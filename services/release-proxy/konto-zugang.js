// Zugang zu den Tool-Routen des Workers (Anmeldung im Launcher, Plan Teil 1, P15; Spec 9, 9.1, 10; EP3, EP9, EP10, EP17).
//
// Eine Stelle statt der Kopien von keyOk: worker.js (Gate vor Feedback, Katalog, Kochbuch, KI-Entwurf, /tools/:id/latest)
// und qa-relay.js (Admin-Routen von /qa/:id, P19) fragen zugangPruefen. Angenommen wird, in dieser Reihenfolge:
//   1. Authorization: Bearer jm1.… — an Routen ohne Ziel eine Sitzung mit Recht nach darf (Spec 9.1), an Routen mit Ziel
//      (Q&A-Event) nur eine Freigabe für genau Zweck und Ziel (EP3). Eine Freigabe ist nie eine Sitzung und umgekehrt.
//      Geprüft werden nur Signatur und Claims, ohne Durable Object (EP2): Der Stand gilt so, wie ihn der letzte Start des
//      Launchers festgehalten hat (Spec 6.1, 6.3).
//   2. Der alte PROXY_KEY (X-Proxy-Key oder Bearer ohne jm1.) bis ALTKEY_BIS, nur für die Gruppen katalog und qa (EP9),
//      zeitkonstant verglichen. Jede angenommene Anfrage zählt der Konten-DO über ctx.waitUntil (OFP2: je Tag, Gruppe,
//      Plattform, ohne IP), damit der Reiter Geräte alte Launcher zeigt.
//   3. Sonst 401 „nicht angemeldet“.
// Das Selbst-Update GET /tools/launcher/latest beantwortet selbstUpdateLiefern (EP10, EP32): ohne Anmeldung erst ab Launcher
// 0.18.0 (ältere Installer tragen den alten Schlüssel in sich), 60 s im Speicher des Isolats, Drossel je IP nur für Abrufe
// bei GitHub. connect-relay.js prüft in Teil 1 weiter selbst gegen PROXY_KEY (G10; Gruppe connect erst mit Teil 2, EP9).
// Fehlerform { ok: false, status, error: Text S1–S18, code } (Texttabelle 9.6). Kein Token, Schlüssel oder Claim geht in
// einen Text oder ins Log.
import { alterKeyGilt, darf, funktionFuerRoute, ZWECK_FUNKTION } from './konto-kern.js';
import { gleichOhneZeitleck, pruefeToken, schluesselBrauchbar, sha256B64url, TOKEN_PRAEFIX } from './konto-krypto.js';
import { compareVersions } from './paketwahl.js';

/** Texte S1–S18 (Texttabelle 9.6) je Code; `konflikt` hat drei Texte (KONFLIKT_TEXT), S12a ist die Vorgabe. */
export const FEHLER_TEXT = Object.freeze({
  'nicht-angemeldet': 'nicht angemeldet: im Launcher anmelden', // S1
  'sitzung-abgelaufen': 'Anmeldung abgelaufen: im Launcher neu anmelden', // S2
  'kein-recht': 'kein Recht für diese Funktion', // S3
  'alter-key-abgelaufen': 'alter Schlüssel nicht mehr gültig: Launcher aktualisieren und anmelden', // S4
  'nicht-eingerichtet': 'Anmeldung auf dem Server nicht eingerichtet', // S5
  gesperrt: 'Zugang gesperrt', // S6
  geloescht: 'Zugang gelöscht', // S7
  'zugang-abgelaufen': 'Zugang abgelaufen', // S8
  'geraet-unbekannt': 'Rechner unbekannt: neu anmelden', // S9
  'vorgang-unbekannt': 'Anmeldevorgang unbekannt oder abgelaufen', // S10
  ungueltig: 'ungültige Anfrage', // S11
  konflikt: 'es muss immer mindestens einen Admin geben', // S12a
  'nicht-noetig': 'Zoom ist für deine Stufe schon erlaubt', // S13
  'unbekannter-zweck': 'unbekannter Zweck', // S14
  'keine-freigabe': 'keine Freigabe für dieses Q&A-Event', // S15
  'erster-admin': 'der erste Admin lässt sich hier nicht ändern', // S16
  domain: 'Kollegen von jakobsmedien.com melden sich mit Google an', // S17
  uhr: 'Uhr des Rechners geht falsch: Datum und Uhrzeit prüfen', // S18 (EP30: Gerätebeweis außerhalb ±5 min, Task 16)
});

/** Die drei Texte zum Code `konflikt`: S12a (Admins), S12b (E-Mail vergeben), S12c (offene Zoom-Anfrage). */
export const KONFLIKT_TEXT = Object.freeze({
  admin: 'es muss immer mindestens einen Admin geben', // S12a
  email: 'diese E-Mail hat schon einen Zugang', // S12b
  zoom: 'es gibt schon eine offene Zoom-Anfrage', // S12c
});

/** Ablehnung im Vertrag 10.1. `konflikt` wählt beim Code `konflikt` den Text (admin, email, zoom). */
export function abgelehnt(code, status, konflikt) {
  const text = code === 'konflikt' && konflikt ? KONFLIKT_TEXT[konflikt] : FEHLER_TEXT[code];
  return { ok: false, status, error: text ?? FEHLER_TEXT.ungueltig, code: text ? code : 'ungueltig' };
}

/** Uhr der Anmeldung: im Test env.KONTO_UHR (eine Funktion, über wrangler nicht setzbar, EP21), sonst Date.now(). */
export function kontoJetzt(env) {
  return env && typeof env.KONTO_UHR === 'function' ? env.KONTO_UHR() : Date.now();
}

/**
 * EP10, EP32: GET /tools/launcher/latest liefert der Worker ab Launcher 0.18.0 auch ohne Zugang (gebremst, selbstUpdateLiefern),
 * damit jeder Launcher an die reparierende Version kommt, auch nach ALTKEY_BIS. Maßgeblich ist die dekodierte ID genau
 * `launcher`; /tools/jm-launcher/latest liefert dasselbe Release, bleibt aber hinter dem Gate.
 */
export function launcherSelbstUpdate(method, pathname) {
  if (method !== 'GET') return false;
  const m = String(pathname).match(/^\/tools\/([^/]+)\/latest\/?$/);
  if (!m) return false;
  let id;
  try {
    id = decodeURIComponent(m[1]);
  } catch {
    return false;
  }
  return id === 'launcher';
}

/**
 * EP32: Ohne Anmeldung liefert der Worker das Selbst-Update erst ab dieser Launcher-Version, der ersten ohne eingebackenen
 * PROXY_KEY (EP11). Ein älteres Release bekommt nur, wer Zugang hat (Sitzung oder alter Schlüssel bis ALTKEY_BIS): Sein
 * Installer trägt den alten Schlüssel in sich, der für Connect bis Teil 2 gilt (EP9). Bis zum Release von 0.18.0 bleibt die
 * Route darum so geschützt wie vor der Anmeldung.
 */
export const SELBST_UPDATE_OFFEN_AB = '0.18.0';

/** EP32: Zwischenspeicher 60 s je Repo, Plattform und Architektur; Drossel je IP (30 je 600 s) nur für Abrufe bei GitHub. */
export const SELBST_UPDATE = Object.freeze({ speicherMs: 60_000, rlMax: 30, rlWindowSec: 600 });

// Speicher des Isolats statt Cache-API (EP32): wirkt auf workers.dev wie im Test. Höchstens vier Einträge je Repo (win/mac ×
// x64/arm64), nur öffentliche Angaben (Version, Paket, Größe, signierter Download-Link), nie etwas, das an einer Anfrage hängt.
const selbstUpdateSpeicher = new Map();
// Laufende Abfragen je Schlüssel: wer gleichzeitig kommt, wartet auf dieselbe Abfrage (ohne eigene Drossel, ohne eigenen Abruf).
const selbstUpdateLaufend = new Map();
const KEIN_CACHE = { 'cache-control': 'no-store' };

/**
 * GET /tools/launcher/latest (Spec 9.1, EP10, EP32): ohne Anmeldung erreichbar, aber gebremst. Eine Antwort mit Status 200 oder
 * 404 (kein Release oder Paket) bleibt 60 s im Speicher des Isolats; nur ein Abruf bei GitHub (`hole`, wie für jedes Tool) zählt
 * in der Drossel je IP. Ohne Zugang (`zugang` aus dem Gate) gilt nur eine Antwort mit einer Version ab SELBST_UPDATE_OFFEN_AB,
 * sonst die Ablehnung des Gates (401 S1 bzw. S4).
 */
export async function selbstUpdateLiefern(request, env, { jetzt, zugang, platform, arch, hole }) {
  const schluessel = `${env.REPO}|${platform}|${arch}`;
  let eintrag = selbstUpdateSpeicher.get(schluessel);
  if (!eintrag || eintrag.bis <= jetzt) {
    let laufend = selbstUpdateLaufend.get(schluessel);
    if (!laufend) {
      // Gleich synchron eintragen (vor dem ersten await), sonst laufen gleichzeitige Anfragen alle an der Map vorbei.
      laufend = selbstUpdateHolen(request, env, jetzt, hole, schluessel).finally(() => selbstUpdateLaufend.delete(schluessel));
      selbstUpdateLaufend.set(schluessel, laufend);
    }
    const erg = await laufend;
    if (erg.art === 'drossel') return jsonAntwort({ error: 'zu viele Anfragen', code: 'zu-viele' }, 429, { 'Retry-After': String(erg.retryAfter) });
    if (erg.art === 'fehler') return new Response(erg.text, { status: erg.status, headers: { 'content-type': erg.typ, ...KEIN_CACHE } });
    eintrag = erg.eintrag;
  }
  const offen = eintrag.status === 200 && compareVersions(eintrag.version || '0', SELBST_UPDATE_OFFEN_AB) >= 0;
  if (!zugang.ok && !offen) return jsonAntwort({ error: zugang.error, code: zugang.code }, zugang.status);
  return new Response(eintrag.text, { status: eintrag.status, headers: { 'content-type': 'application/json; charset=utf-8', ...KEIN_CACHE } });
}

/** Eine Abfrage für alle, die gleichzeitig kommen: Drossel (einmal), Abruf bei GitHub, Eintrag im Speicher. */
async function selbstUpdateHolen(request, env, jetzt, hole, schluessel) {
  const rl = await selbstUpdateDrossel(request, env, jetzt);
  if (!rl.ok) return { art: 'drossel', retryAfter: rl.retryAfter };
  const res = await hole();
  const text = await res.text();
  // Nur feste Antworten merken; ein Fehler von GitHub (502) geht ungemerkt durch und wird beim nächsten Mal neu geholt.
  if (res.status !== 200 && res.status !== 404) {
    return { art: 'fehler', status: res.status, text, typ: res.headers.get('content-type') || 'application/json; charset=utf-8' };
  }
  let version = '';
  try {
    version = String(JSON.parse(text).version || '');
  } catch {
    version = '';
  }
  const eintrag = { bis: jetzt + SELBST_UPDATE.speicherMs, status: res.status, version, text };
  selbstUpdateSpeicher.set(schluessel, eintrag);
  return { art: 'eintrag', eintrag };
}

/**
 * Konten-DO in der EU (EP1): EINE Instanz `idFromName('konten')` hinter der Bindung KONTO, adressiert wie roomStub in
 * connect-relay.js. `KONTO_JURISDICTION=""` schaltet die Jurisdiction ab (nur lokale Läufe); eine verlangte
 * Jurisdiction, die die Bindung nicht kann, wirft (der Aufrufer antwortet 503 S5), statt still global zu laufen.
 * konto-relay.js (P16) gibt diese Funktion weiter.
 */
export function kontoStub(env) {
  if (!env.KONTO) throw new Error('KONTO-Bindung fehlt');
  const j = env.KONTO_JURISDICTION === undefined ? 'eu' : String(env.KONTO_JURISDICTION).trim();
  let ns = env.KONTO;
  if (j) {
    if (typeof ns.jurisdiction !== 'function') throw new Error(`Jurisdiction ${j} verlangt, aber die DO-Bindung unterstützt sie nicht`);
    ns = ns.jurisdiction(j);
  }
  return ns.get(ns.idFromName('konten'));
}

/**
 * Eine Aktion des Konten-DO (Vertrag 10.4). Die Anfrage entsteht hier immer NEU: keine Kopfzeile, kein Body, keine
 * Adresse des Clients erreicht den DO (Lehre aus Befund B1, x-connect-admin). Antwort { ok: true, … } oder
 * { ok: false, code, status, … }.
 */
export async function kontoAktion(env, aktion, daten) {
  const antwort = await kontoStub(env).fetch(
    new Request(`https://konto.intern/${aktion}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(daten),
    }),
  );
  return antwort.json();
}

/**
 * Prüft den Zugang einer Anfrage zu einer Funktion (Spec 9.1).
 *   funktion: Funktion nach darf (konto-kern.js), etwa 'katalog', 'ki-entwurf', 'qa'
 *   gruppe:   Gruppe des alten Schlüssels ('katalog' | 'qa'); null = alter Schlüssel gilt hier nicht
 *   ziel:     Ziel einer Freigabe (Q&A: Event-ID); null = Route für Sitzungen (Launcher)
 * → { ok: true, art: 'sitzung', stand } | { ok: true, art: 'freigabe', claims } | { ok: true, art: 'alter-key' }
 *   | { ok: false, status, error, code }
 */
export async function zugangPruefen(request, env, { funktion, gruppe = null, ziel = null, jetzt, ctx } = {}) {
  const z = typeof ziel === 'string' && ziel !== '' ? ziel : null;
  const auth = request.headers.get('Authorization') || '';
  const bearer = /^Bearer\s+/i.test(auth) ? auth.replace(/^Bearer\s+/i, '').trim() : '';
  // Eine Sitzung oder Freigabe geht vor; ein zusätzlich mitgeschickter Schlüssel zählt dann nicht.
  if (bearer.startsWith(TOKEN_PRAEFIX)) return tokenPruefen(env, bearer, funktion, z, jetzt);
  const key = request.headers.get('X-Proxy-Key') || bearer;
  if (!key || !gruppe || !env.PROXY_KEY || !(await gleichOhneZeitleck(key, env.PROXY_KEY))) {
    return abgelehnt('nicht-angemeldet', 401);
  }
  if (!alterKeyGilt(env, gruppe, jetzt).gilt) return abgelehnt('alter-key-abgelaufen', 401);
  altKeyZaehlen(request, env, ctx, gruppe, jetzt);
  return { ok: true, art: 'alter-key' };
}

async function tokenPruefen(env, token, funktion, ziel, jetzt) {
  // Vertrag 10.3: ein fehlender oder unbrauchbarer Schlüssel (nicht genau 32 Byte Base64) ist ein Einrichtungsfehler, kein 401.
  if (!schluesselBrauchbar(env.KONTO_SCHLUESSEL)) return abgelehnt('nicht-eingerichtet', 503);
  const freigabe = await pruefeToken(env.KONTO_SCHLUESSEL, token, 'freigabe', jetzt);
  if (freigabe) {
    // Eine Freigabe gilt nur an einer Route mit Ziel, für ihren Zweck und ihr Ziel (EP3), nie wie eine Sitzung.
    if (ziel === null || ZWECK_FUNKTION[freigabe.zweck] !== funktion) return abgelehnt('kein-recht', 403);
    if (freigabe.ziel !== ziel) return abgelehnt('keine-freigabe', 403);
    return { ok: true, art: 'freigabe', claims: freigabe };
  }
  const stand = await pruefeToken(env.KONTO_SCHLUESSEL, token, 'sitzung', jetzt);
  if (stand) {
    // Die Sitzung verlässt den Launcher nie (EP8): an einer Route mit Ziel zählt nur eine Freigabe.
    if (ziel !== null) return abgelehnt('keine-freigabe', 403);
    if (!darf(stand, funktion, { jetzt })) return abgelehnt('kein-recht', 403);
    return { ok: true, art: 'sitzung', stand };
  }
  // Echt signiert, aber abgelaufen → S2 (Launcher meldet sich neu an, Q&A holt eine neue Freigabe); sonst S1.
  const abgelaufen =
    (await pruefeToken(env.KONTO_SCHLUESSEL, token, 'sitzung', 0)) || (await pruefeToken(env.KONTO_SCHLUESSEL, token, 'freigabe', 0));
  return abgelehnt(abgelaufen ? 'sitzung-abgelaufen' : 'nicht-angemeldet', 401);
}

/** OFP2: Anfragen mit altem Schlüssel je Tag, Gruppe und Plattform zählen, nach der Antwort (waitUntil), ohne IP. */
function altKeyZaehlen(request, env, ctx, gruppe, jetzt) {
  if (!env.KONTO || !ctx || typeof ctx.waitUntil !== 'function') return;
  // Der alte Schlüssel steckt in öffentlichen Installern: unbekannte Routen (404) schreiben nichts in den DO.
  if (funktionFuerRoute(request.method, new URL(request.url).pathname) === null) return;
  const q = new URL(request.url).searchParams;
  const p = q.get('platform');
  const plattform = p === 'win' || p === 'mac' ? p : 'unbekannt';
  const arch = plattform === 'unbekannt' ? '' : q.get('arch') === 'arm64' ? 'arm64' : 'x64';
  ctx.waitUntil(
    kontoAktion(env, 'altkey-zaehlen', { jetzt, gruppe, plattform, arch }).catch((e) => {
      console.warn(`konto: Alt-Key-Zählung fehlgeschlagen (${fehlerName(e)})`);
    }),
  );
}

/**
 * EP32: Fixed-Window-Drossel des Selbst-Updates je IP über RATELIMIT (Uhr der Anmeldung; die IP nur als Hash, Spec 11, OFP2).
 * Ohne KV oder bei einem KV-Fehler offen, mit Warnung: ein Ausfall der Drossel hält kein Update auf, der Speicher bremst weiter.
 */
async function selbstUpdateDrossel(request, env, jetzt) {
  if (!env.RATELIMIT) {
    console.warn('rate-limit: KV-Bindung RATELIMIT fehlt — selbst-update ungedrosselt');
    return { ok: true };
  }
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const ipHash = (await sha256B64url(`${env.KONTO_SCHLUESSEL ?? ''}|${ip}`)).slice(0, 22);
    const nowSec = Math.floor(jetzt / 1000);
    const { rlMax, rlWindowSec } = SELBST_UPDATE;
    const key = `rl:selbst-update:${ipHash}:${Math.floor(nowSec / rlWindowSec)}`;
    const current = Number((await env.RATELIMIT.get(key)) || 0);
    if (current >= rlMax) return { ok: false, retryAfter: rlWindowSec - (nowSec % rlWindowSec) };
    await env.RATELIMIT.put(key, String(current + 1), { expirationTtl: rlWindowSec * 2 });
    return { ok: true };
  } catch (e) {
    console.warn(`konto: Drossel Selbst-Update nicht prüfbar (${fehlerName(e)})`);
    return { ok: true };
  }
}

function jsonAntwort(obj, status, extra = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...KEIN_CACHE, ...extra } });
}

/** Nur der Name eines Fehlers, nie die Meldung (wie worker.js). */
function fehlerName(e) {
  return (e && typeof e.name === 'string' && e.name) || 'unbekannt';
}
