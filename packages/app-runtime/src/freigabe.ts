// ─────────────────────────────────────────────────────────────────────────────
// @jm/app-runtime/freigabe — Freigabe-Schnittstelle Launcher ↔ Tools (Anmeldung Teil 1; Plan 10.8, EP8; Spec 6.2).
//
// Ein Tool fragt den laufenden Launcher desselben Windows-Kontos nach einer kurzlebigen Freigabe für einen Zweck
// (Teil 1: `qa-relay` mit der Q&A-Event-ID als Ziel; Teil 2 ergänzt Zwecke, ohne hier etwas zu ändern). Der Launcher legt
// je Start eine Tür-Datei `<appData>/JM Production Suite/launcher-tuer.json` mit Port und Zufallsschlüssel an und lauscht
// nur auf 127.0.0.1. Beide Seiten beweisen sich je Anfrage mit HMAC-SHA256 über den Schlüssel der Tür-Datei:
//   Anfrage  POST http://127.0.0.1:<port>/v1/freigabe, Kopf X-JM-Zeit (ms), X-JM-Nonce (16 B b64url),
//            X-JM-Beweis = freigabeBeweis(schluessel, ['tool', zeit, nonce, sha256hex(body)])
//   Antwort  X-JM-Beweis = freigabeBeweis(schluessel, ['launcher', nonce, sha256hex(antwortBody)])
// Der Launcher lehnt Zeit außerhalb ±60 s, eine schon gesehene Nonce (2 min) und einen falschen Beweis ab; dieses Modul
// verwirft jede Antwort ohne gültigen Beweis (`launcher-unecht`). Keine Tür-Datei oder keine Verbindung → `kein-launcher`,
// eine neuere Fassung der Tür-Datei oder eine unterschriebene 404 → `launcher-zu-alt`. Zeitlimit 5 s.
// Grenze (EP8): Ein Prozess desselben Windows-Kontos kann die Tür-Datei lesen; Freigaben sind darum eng (Zweck, Ziel, 72 h).
// Nur node:-Module (G9), kein Electron: läuft in jedem Tool-Main und im Selbsttest mit echten Sockets.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { request } from 'node:http';
import { join } from 'node:path';

export const TUER_DATEI = 'launcher-tuer.json';
export const FREIGABE_VERSION = 1;
/** Pfad der Anfrage; eine spätere Fassung bekäme einen neuen Pfad. */
export const FREIGABE_PFAD = '/v1/freigabe';
/** Kopfzeilen des Beweises (klein geschrieben, wie Node sie liefert). */
export const KOPF_ZEIT = 'x-jm-zeit';
export const KOPF_NONCE = 'x-jm-nonce';
export const KOPF_BEWEIS = 'x-jm-beweis';
export const FREIGABE_ZEITLIMIT_MS = 5000;

export interface TuerDatei { v: 1; port: number; schluessel: string; pid: number; start: number }
export interface FreigabeAnfrage { v: 1; appId: string; zweck: string; ziel?: string }
export type FreigabeGrund = 'kein-launcher' | 'launcher-zu-alt' | 'launcher-unecht' | 'niemand-angemeldet' | 'abgelaufen'
  | 'entzogen' | 'kein-recht' | 'server-nicht-erreichbar' | 'unbekannter-zweck' | 'fehler';
export type FreigabeErgebnis =
  | { ok: true; freigabe: string; bis: number; konto: { name: string; stufe: 'admin' | 'kollege' | 'externer' } }
  | { ok: false; grund: FreigabeGrund; detail?: string };

export const FREIGABE_GRUENDE: readonly FreigabeGrund[] = ['kein-launcher', 'launcher-zu-alt', 'launcher-unecht',
  'niemand-angemeldet', 'abgelaufen', 'entzogen', 'kein-recht', 'server-nicht-erreichbar', 'unbekannter-zweck', 'fehler'];

/** `<appData>/JM Production Suite/launcher-tuer.json` (appData = app.getPath('appData'), je Windows-Konto). */
export function tuerPfad(appDataDir: string): string {
  return join(appDataDir, 'JM Production Suite', TUER_DATEI);
}

/** HMAC-SHA256 (Schlüssel = der Text aus der Tür-Datei) über teile.join('|'), b64url. */
export function freigabeBeweis(schluessel: string, teile: readonly string[]): string {
  return createHmac('sha256', schluessel).update(teile.join('|')).digest('base64url');
}

/** SHA-256 eines Textes (UTF-8) als Hex, für den Beweis über Anfrage- und Antwortkörper. */
export function inhaltsHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Zwei Beweise ohne Zeitleck vergleichen; verschiedene Längen sind ungleich. */
export function beweisGleich(a: string | undefined, b: string): boolean {
  if (typeof a !== 'string') return false;
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Ergebnis aus einer Antwort prüfen: nur die Formen aus 10.8, sonst null. */
export function pruefeErgebnis(roh: unknown): FreigabeErgebnis | null {
  if (typeof roh !== 'object' || roh === null) return null;
  const r = roh as Record<string, unknown>;
  if (r.ok === true) {
    const k = r.konto as Record<string, unknown> | null | undefined;
    if (typeof r.freigabe !== 'string' || !r.freigabe || typeof r.bis !== 'number' || !Number.isFinite(r.bis)) return null;
    if (typeof k !== 'object' || k === null || typeof k.name !== 'string') return null;
    if (k.stufe !== 'admin' && k.stufe !== 'kollege' && k.stufe !== 'externer') return null;
    return { ok: true, freigabe: r.freigabe, bis: r.bis, konto: { name: k.name, stufe: k.stufe } };
  }
  if (r.ok === false && FREIGABE_GRUENDE.includes(r.grund as FreigabeGrund)) {
    const detail = typeof r.detail === 'string' ? r.detail.slice(0, 200) : undefined;
    return detail === undefined ? { ok: false, grund: r.grund as FreigabeGrund } : { ok: false, grund: r.grund as FreigabeGrund, detail };
  }
  return null;
}

/** Tür-Datei lesen: fehlt bzw. kaputt → null, eine neuere Fassung → 'neuer'. */
function leseTuer(appDataDir: string): TuerDatei | 'neuer' | null {
  let roh: unknown;
  try {
    roh = JSON.parse(readFileSync(tuerPfad(appDataDir), 'utf8'));
  } catch {
    return null;
  }
  if (typeof roh !== 'object' || roh === null) return null;
  const t = roh as Record<string, unknown>;
  if (typeof t.v !== 'number' || !Number.isInteger(t.v) || t.v < 1) return null;
  if (t.v > FREIGABE_VERSION) return 'neuer';
  if (typeof t.port !== 'number' || !Number.isInteger(t.port) || t.port < 1 || t.port > 65535) return null;
  if (typeof t.schluessel !== 'string' || t.schluessel.length < 32) return null;
  if (typeof t.pid !== 'number' || typeof t.start !== 'number') return null;
  return { v: 1, port: t.port, schluessel: t.schluessel, pid: t.pid, start: t.start };
}

const ANTWORT_MAX_BYTES = 64 * 1024;

function sende(port: number, body: string, kopf: Record<string, string>, zeitlimitMs: number): Promise<{ status: number; beweis: string | undefined; text: string }> {
  return new Promise((ja, nein) => {
    let uhr: ReturnType<typeof setTimeout> | undefined;
    let erledigt = false;
    const ende = (f: () => void): void => {
      if (erledigt) return;
      erledigt = true;
      clearTimeout(uhr);
      f();
    };
    const req = request({
      host: '127.0.0.1',
      port,
      method: 'POST',
      path: FREIGABE_PFAD,
      // Sicherheit: kein gemeinsamer Agent, keine Keep-Alive-Verbindung; so geht die Anfrage auch an einem Proxy aus der Umgebung (HTTP_PROXY/NODE_USE_ENV_PROXY) vorbei.
      agent: false,
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), ...kopf },
    }, (res) => {
      const teile: Buffer[] = [];
      let laenge = 0;
      res.on('data', (c: Buffer) => {
        laenge += c.length;
        if (laenge > ANTWORT_MAX_BYTES) {
          ende(() => nein(new Error('Antwort zu groß')));
          req.destroy();
          return;
        }
        teile.push(c);
      });
      res.on('end', () => {
        const b = res.headers[KOPF_BEWEIS];
        ende(() => ja({ status: res.statusCode ?? 0, beweis: typeof b === 'string' ? b : undefined, text: Buffer.concat(teile).toString('utf8') }));
      });
      res.on('error', (e) => ende(() => nein(e)));
      res.on('close', () => ende(() => nein(new Error('Verbindung beendet'))));
    });
    uhr = setTimeout(() => {
      ende(() => nein(new Error('Zeitlimit')));
      req.destroy();
    }, zeitlimitMs);
    req.on('error', (e) => ende(() => nein(e)));
    req.end(body);
  });
}

/**
 * Freigabe beim Launcher holen (Tool-Seite). Wirft nie: jeder Fehler wird ein Grund aus FreigabeGrund. Die Antwort trägt
 * die Freigabe; das Tool speichert sie selbst (Q&A: befristet in qa.cloud.secret, Task 30) und schreibt sie in kein Log.
 */
export async function holeFreigabe(
  a: Omit<FreigabeAnfrage, 'v'>,
  o: { appDataDir: string; zeitlimitMs?: number; jetzt?: () => number },
): Promise<FreigabeErgebnis> {
  const tuer = leseTuer(o.appDataDir);
  if (tuer === null) return { ok: false, grund: 'kein-launcher' };
  if (tuer === 'neuer') return { ok: false, grund: 'launcher-zu-alt' };
  const anfrage: FreigabeAnfrage = { v: FREIGABE_VERSION, appId: a.appId, zweck: a.zweck, ...(a.ziel === undefined ? {} : { ziel: a.ziel }) };
  const body = JSON.stringify(anfrage);
  const zeit = String((o.jetzt ?? Date.now)());
  const nonce = randomBytes(16).toString('base64url');
  const kopf = {
    [KOPF_ZEIT]: zeit,
    [KOPF_NONCE]: nonce,
    [KOPF_BEWEIS]: freigabeBeweis(tuer.schluessel, ['tool', zeit, nonce, inhaltsHash(body)]),
  };
  let antwort: { status: number; beweis: string | undefined; text: string };
  try {
    antwort = await sende(tuer.port, body, kopf, o.zeitlimitMs ?? FREIGABE_ZEITLIMIT_MS);
  } catch {
    return { ok: false, grund: 'kein-launcher' };
  }
  if (!beweisGleich(antwort.beweis, freigabeBeweis(tuer.schluessel, ['launcher', nonce, inhaltsHash(antwort.text)]))) {
    return { ok: false, grund: 'launcher-unecht' };
  }
  if (antwort.status === 404) return { ok: false, grund: 'launcher-zu-alt' };
  let roh: unknown;
  try {
    roh = JSON.parse(antwort.text);
  } catch {
    return { ok: false, grund: 'launcher-unecht' };
  }
  return pruefeErgebnis(roh) ?? { ok: false, grund: 'launcher-unecht' };
}

// ── Ende des Moduls ──
