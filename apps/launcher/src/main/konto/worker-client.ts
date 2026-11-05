// ─────────────────────────────────────────────────────────────────────────────
// Anmeldung im Launcher (Teil 1) · Client der Worker-API /konto/* (Plan 10.1, 10.6, EP17; Spec 9.1).
// `fetch` ist eingespeist (Hülle: globales fetch; Tests: Attrappe). Jeder Fehler wird ein KontoFehler mit festem Code:
// fetch wirft → `netz`; Zeitlimit (Vorgabe 15 s) und jede 5xx-Antwort → `server`, außer `code: nicht-eingerichtet`;
// 429 → `zu-viele`; sonst der `code` des Workers, ein unbekannter Code → `server`. Eine 200-Antwort ohne die erwartete
// Form zählt als `server`. Fehlermeldungen nennen nur Code und HTTP-Status, nie eine Sitzung, ein Geheimnis oder eine URL.
// /konto/* bekommt nie `X-Proxy-Key` (den alten Schlüssel nimmt nur das Gate für Tool-Routen, Task 15); `zugangsKopf` ist
// der Kopf für diese Tool-Routen (Task 22). Kein electron-Import (G9).
// ─────────────────────────────────────────────────────────────────────────────
import type {
  AdminAktion, AdminAktionErgebnis, AdminUebersicht, EntzugGrund, KontoFehlerCode, KontoStand, ZoomAnfrageStand,
} from '../../shared/konto';
import type { GeraetBeweis } from './geraet';

/** Codes, die der Worker in `code` schicken darf (10.1); `netz` entsteht nur hier. */
const WORKER_CODES: readonly KontoFehlerCode[] = ['server', 'nicht-eingerichtet', 'zu-viele', 'nicht-angemeldet',
  'sitzung-abgelaufen', 'kein-recht', 'gesperrt', 'geloescht', 'zugang-abgelaufen', 'geraet-unbekannt', 'vorgang-unbekannt',
  'ungueltig', 'konflikt', 'nicht-noetig', 'unbekannter-zweck', 'erster-admin', 'domain', 'uhr', 'iveo-basis-unbekannt'];

export const KONTO_ZEITLIMIT_MS = 15_000;

export class KontoFehler extends Error {
  readonly code: KontoFehlerCode;
  readonly status: number | null;
  constructor(code: KontoFehlerCode, status: number | null) {
    super(`Konto-Anfrage fehlgeschlagen: ${code}${status === null ? '' : ` (HTTP ${status})`}`);
    this.name = 'KontoFehler';
    this.code = code;
    this.status = status;
  }
}

export interface IveoZentral { key: string; basis: string; slug: string; name: string; token: string }
/** Diagnose des Workers zu GET /konto/iveo (10.1): ohne IVEO_SCHLUESSEL eine leere Liste mit diesem Hinweis (G7). */
export type IveoHinweis = 'iveo-nicht-eingerichtet';
export interface KontoClient {
  vorgangAnlegen(g: { publicJwk: JsonWebKey; name: string; plattform: 'win' | 'mac'; arch: string; version: string }): Promise<{ vorgang: string; abholGeheimnis: string; code: string; adresse: string; bis: number }>;
  vorgangAbholen(vorgang: string, abholGeheimnis: string, beweis: GeraetBeweis): Promise<{ zustand: 'wartet' | 'abgelehnt' | 'abgelaufen' } | { zustand: 'bestaetigt'; sitzung: string; stand: KontoStand }>;
  vorgangAbbrechen(vorgang: string, abholGeheimnis: string): Promise<void>;
  sitzungErneuern(sitzung: string, beweis: GeraetBeweis, version: string, rechnerName: string): Promise<{ sitzung: string; stand: KontoStand }>;
  abmelden(sitzung: string): Promise<void>;
  ich(sitzung: string): Promise<{ kontoAktiv: boolean; grund: EntzugGrund | null; zoomAnfrage: ZoomAnfrageStand | null; adminOffen: number }>;
  freigabe(sitzung: string, zweck: string, ziel: string): Promise<{ freigabe: string; bis: number }>;
  iveoTokens(sitzung: string): Promise<{ events: IveoZentral[]; hinweis: IveoHinweis | null }>;
  zoomAnfragen(sitzung: string, a: { zweck: string; von: number; bis: number }): Promise<ZoomAnfrageStand>;
  adminUebersicht(sitzung: string): Promise<AdminUebersicht>;
  adminAktion(sitzung: string, a: AdminAktion): Promise<AdminAktionErgebnis>;
}

/**
 * AR57 (Z1): die Server-Adresse, mit der ein Client gebaut wird: https, Schema und Host klein, Port 443 weg, ohne Schrägstrich am
 * Ende; http nur für 127.0.0.1 und [::1] (Entwicklung). Keine Zugangsdaten, kein Query, kein Fragment. Sonst null. Wirft nie.
 */
export function pruefeServerBasis(raw: string | undefined): string | null {
  const t = (raw ?? '').trim();
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return null;
  }
  if (u.username !== '' || u.password !== '' || u.search !== '' || u.hash !== '' || !u.host) return null;
  const lokal = u.hostname === '127.0.0.1' || u.hostname === '[::1]';
  if (!(u.protocol === 'https:' || (u.protocol === 'http:' && lokal))) return null;
  return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`;
}

/** Z1: Liegt `url` beim (geprüften) Worker? Nur dann darf ein Kopf mit Sitzung oder Schlüssel mit. */
export function istWorkerZiel(url: string, server: string): boolean {
  const basis = pruefeServerBasis(server);
  return basis !== null && istWorkerAdresse(url, basis);
}

/**
 * Z1 (Abrufe mit Kopf): der Kopf für einen Abruf beim Worker, rein. Nur wenn `server` eine geprüfte Server-Adresse ist und `url`
 * dort liegt (gleiche Herkunft, Pfad mit Grenze), sonst {}: eine fremde Adresse bekommt nie die Sitzung oder den Schlüssel.
 */
export function kopfFuer(url: string, server: string, sitzung: string | null, devKey?: string): Record<string, string> {
  return istWorkerZiel(url, server) ? zugangsKopf({ sitzung, devKey }) : {};
}

/**
 * Z1: `redirect` für einen Abruf. Trägt der Kopf eine Sitzung oder einen Schlüssel, folgt fetch keiner Weiterleitung ('error'):
 * sonst ginge der Kopf mit zur Zieladresse (fetch behält Authorization und eigene Köpfe bei einer Weiterleitung innerhalb der
 * Herkunft, und eine Weiterleitung auf eine andere Herkunft ist ohnehin nicht gewollt).
 */
export function redirectFuer(kopf: Record<string, string>): 'error' | 'follow' {
  return Object.keys(kopf).some((k) => k.toLowerCase() === 'authorization' || k.toLowerCase() === 'x-proxy-key') ? 'error' : 'follow';
}

/** Kopf für Tool-Routen (Katalog, Installieren, Feedback …): Sitzung → Authorization; sonst Dev-Key → X-Proxy-Key; sonst nichts. */
export function zugangsKopf(z: { sitzung: string | null; devKey?: string }): Record<string, string> {
  if (z.sitzung) return { Authorization: `Bearer ${z.sitzung}` };
  if (z.devKey) return { 'X-Proxy-Key': z.devKey };
  return {};
}

type Objekt = Record<string, unknown>;
const istObjekt = (x: unknown): x is Objekt => typeof x === 'object' && x !== null && !Array.isArray(x);
const istText = (x: unknown): x is string => typeof x === 'string' && x.length > 0;
const istZahl = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const ENTZUG: readonly string[] = ['gesperrt', 'geloescht', 'zugang-abgelaufen', 'geraet-unbekannt'];

const WERKZEUGE: readonly string[] = ['connect-raum', 'qa', 'iveo'];
/** Z1: jedes Feld von KontoStand wird geprüft (Art, Stufe, Werkzeuge, Events, Zoom, JM-Rechner, Gerätekennung, alle Zeiten). */
export function istStand(x: unknown): x is KontoStand {
  return istObjekt(x) && istText(x.kid) && typeof x.email === 'string' && typeof x.name === 'string'
    && (x.art === 'google' || x.art === 'passwort')
    && (x.stufe === 'admin' || x.stufe === 'kollege' || x.stufe === 'externer')
    && Array.isArray(x.tools) && x.tools.every((t) => typeof t === 'string' && WERKZEUGE.includes(t))
    && Array.isArray(x.events) && x.events.every((e) => typeof e === 'string')
    && typeof x.zoom === 'boolean' && (x.zoomBis === null || istZahl(x.zoomBis)) && typeof x.jm === 'boolean'
    && (x.plattform === 'win' || x.plattform === 'mac') && typeof x.gid === 'string'
    && istZahl(x.iat) && istZahl(x.exp) && (x.kontoBis === null || istZahl(x.kontoBis)) && istZahl(x.angemeldetSeit);
}
function istZoomAnfrage(x: unknown): x is ZoomAnfrageStand {
  return istObjekt(x) && istText(x.id) && (x.zustand === 'offen' || x.zustand === 'freigegeben' || x.zustand === 'abgelehnt')
    && typeof x.zweck === 'string' && istZahl(x.von) && istZahl(x.bis) && istZahl(x.am);
}

/**
 * Z1 (AR57): Ersatz, wenn die Server-Adresse nicht zulässig ist: jeder Aufruf scheitert mit `server`, es geht nie eine Anfrage
 * hinaus. Die Anmeldung zeigt dann den Serverfehler, statt dass der Launcher an eine unbrauchbare Adresse sendet.
 */
export function gesperrterKontoClient(): KontoClient {
  const nein = (): Promise<never> => Promise.reject(new KontoFehler('server', null));
  return {
    vorgangAnlegen: nein, vorgangAbholen: nein, vorgangAbbrechen: nein, sitzungErneuern: nein, abmelden: nein, ich: nein,
    freigabe: nein, iveoTokens: nein, zoomAnfragen: nein, adminUebersicht: nein, adminAktion: nein,
  };
}

export function erzeugeKontoClient(o: { basis: string; fetch: typeof fetch; zeitlimitMs?: number }): KontoClient {
  // AR57 (Z1): ein Client entsteht nur mit geprüfter Server-Adresse (https, Host klein; http nur für 127.0.0.1 und [::1]).
  const basis = pruefeServerBasis(o.basis);
  if (basis === null) throw new Error('Konto-Client: Server-Adresse nicht zulässig');
  const zeitlimit = o.zeitlimitMs ?? KONTO_ZEITLIMIT_MS;

  async function rufe(methode: 'GET' | 'POST', pfad: string, sitzung: string | null, body?: unknown): Promise<unknown> {
    const kopf: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) kopf['Content-Type'] = 'application/json';
    if (sitzung !== null) kopf.Authorization = `Bearer ${sitzung}`;
    let res: Response;
    try {
      res = await o.fetch(`${basis}${pfad}`, {
        method: methode,
        headers: kopf,
        body: body === undefined ? undefined : JSON.stringify(body),
        // Z1: keine Weiterleitung (der Worker leitet /konto/* nie um); sonst ginge die Sitzung mit.
        redirect: 'error',
        signal: AbortSignal.timeout(zeitlimit),
      });
    } catch (e) {
      throw new KontoFehler((e as { name?: unknown } | null)?.name === 'TimeoutError' ? 'server' : 'netz', null);
    }
    let daten: unknown = null;
    try {
      daten = await res.json();
    } catch {
      daten = null;
    }
    if (res.ok) return daten;
    const code = istObjekt(daten) && typeof daten.code === 'string' && (WORKER_CODES as readonly string[]).includes(daten.code)
      ? (daten.code as KontoFehlerCode) : null;
    if (res.status === 429) throw new KontoFehler('zu-viele', 429);
    if (res.status >= 500) throw new KontoFehler(code === 'nicht-eingerichtet' ? 'nicht-eingerichtet' : 'server', res.status);
    throw new KontoFehler(code ?? 'server', res.status);
  }
  /** Erfolgsantwort ohne die erwartete Form → `server` (mit Status 200). */
  function form<T>(ok: boolean, wert: T): T {
    if (!ok) throw new KontoFehler('server', 200);
    return wert;
  }

  return {
    async vorgangAnlegen(g) {
      const d = await rufe('POST', '/konto/vorgang', null, { geraet: g });
      // EP35 (Nachbesserung Block D, sicherheit:8): eine Anmeldeadresse, die nicht https beim Worker liegt, ist ein Serverfehler
      // (K53) — der Launcher öffnet sie nie im System-Browser.
      return form(istObjekt(d) && istText(d.vorgang) && istText(d.abholGeheimnis) && istText(d.code) && istText(d.adresse)
        && browserAdresseErlaubt(d.adresse, basis) && istZahl(d.bis),
        d as { vorgang: string; abholGeheimnis: string; code: string; adresse: string; bis: number });
    },
    async vorgangAbholen(vorgang, abholGeheimnis, beweis) {
      const d = await rufe('POST', '/konto/vorgang/abholen', null, { vorgang, abholGeheimnis, beweis });
      if (istObjekt(d) && d.zustand === 'bestaetigt') {
        return form(istText(d.sitzung) && istStand(d.stand), { zustand: 'bestaetigt' as const, sitzung: d.sitzung as string, stand: d.stand as KontoStand });
      }
      const z = istObjekt(d) ? d.zustand : null;
      return form(z === 'wartet' || z === 'abgelehnt' || z === 'abgelaufen', { zustand: z as 'wartet' | 'abgelehnt' | 'abgelaufen' });
    },
    async vorgangAbbrechen(vorgang, abholGeheimnis) {
      await rufe('POST', '/konto/vorgang/abbrechen', null, { vorgang, abholGeheimnis });
    },
    async sitzungErneuern(sitzung, beweis, version, rechnerName) {
      const d = await rufe('POST', '/konto/sitzung', sitzung, { beweis, version, rechnerName });
      return form(istObjekt(d) && istText(d.sitzung) && istStand(d.stand), d as { sitzung: string; stand: KontoStand });
    },
    async abmelden(sitzung) {
      await rufe('POST', '/konto/abmelden', sitzung);
    },
    async ich(sitzung) {
      const d = await rufe('GET', '/konto/ich', sitzung);
      const ok = istObjekt(d) && typeof d.kontoAktiv === 'boolean' && (d.grund === null || d.grund === undefined || ENTZUG.includes(String(d.grund)))
        && (d.zoomAnfrage === null || d.zoomAnfrage === undefined || istZoomAnfrage(d.zoomAnfrage));
      const r = (ok ? d : {}) as Objekt;
      return form(ok, {
        kontoAktiv: r.kontoAktiv as boolean,
        grund: (r.grund ?? null) as EntzugGrund | null,
        zoomAnfrage: (r.zoomAnfrage ?? null) as ZoomAnfrageStand | null,
        adminOffen: istZahl(r.adminOffen) ? r.adminOffen : 0,
      });
    },
    async freigabe(sitzung, zweck, ziel) {
      const d = await rufe('POST', '/konto/freigabe', sitzung, { zweck, ziel });
      return form(istObjekt(d) && istText(d.freigabe) && istZahl(d.bis), d as { freigabe: string; bis: number });
    },
    async iveoTokens(sitzung) {
      const d = await rufe('GET', '/konto/iveo', sitzung);
      const liste = istObjekt(d) && Array.isArray(d.events) ? d.events : null;
      const events = form(liste !== null, (liste ?? []).filter((e): e is IveoZentral => istObjekt(e) && istText(e.key)
        && typeof e.basis === 'string' && istText(e.slug) && typeof e.name === 'string' && istText(e.token)));
      // G7: die Diagnose des Workers geht weiter, statt als „kein Token hinterlegt“ zu enden (Statuszeile I12).
      return { events, hinweis: istObjekt(d) && d.hinweis === 'iveo-nicht-eingerichtet' ? 'iveo-nicht-eingerichtet' : null };
    },
    async zoomAnfragen(sitzung, a) {
      const d = await rufe('POST', '/konto/zoom-anfrage', sitzung, a);
      return form(istObjekt(d) && istZoomAnfrage(d.anfrage), (istObjekt(d) ? d.anfrage : null) as ZoomAnfrageStand);
    },
    async adminUebersicht(sitzung) {
      const d = await rufe('GET', '/konto/admin/uebersicht', sitzung);
      return form(istObjekt(d) && Array.isArray(d.zugaenge) && Array.isArray(d.iveo) && Array.isArray(d.anfragen)
        && Array.isArray(d.geraete) && istObjekt(d.altKey), d as unknown as AdminUebersicht);
    },
    async adminAktion(sitzung, a) {
      const d = await rufe('POST', '/konto/admin/aktion', sitzung, a);
      return form(istObjekt(d) && d.ok === true, d as unknown as AdminAktionErgebnis);
    },
  };
}

/**
 * EP35 (Nachbesserung Block D, sicherheit:2): Liegt `url` beim Worker? Gleiche Herkunft (Schema, Host, Port) wie die
 * Server-Adresse, keine Zugangsdaten in der Adresse, und hat die Server-Adresse einen Pfad, dann dieser Pfad mit Grenze
 * („/a“ deckt „/a/b“, nicht „/ab“). Ein Präfixvergleich der Zeichenkette ließe Doppelgänger wie
 * `https://worker.dev.evil.example/` oder `https://worker.dev@evil.example/` durch. Unlesbare Adressen → false.
 */
export function istWorkerAdresse(url: string, server: string): boolean {
  let u: URL;
  let s: URL;
  try {
    u = new URL(url);
    s = new URL(server);
  } catch {
    return false;
  }
  if (u.origin === 'null' || u.origin !== s.origin || u.username !== '' || u.password !== '') return false;
  const pfad = s.pathname.replace(/\/+$/, '');
  return pfad === '' || u.pathname === pfad || u.pathname.startsWith(`${pfad}/`);
}

/**
 * EP35 (sicherheit:8): darf die Adresse in den System-Browser bzw. die Zwischenablage? Nur https (in der Entwicklung http auf
 * 127.0.0.1, localhost oder ::1) und nur beim Worker (istWorkerAdresse). file:, ms-…: und fremde Hosts nie.
 */
export function browserAdresseErlaubt(url: string, server: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const lokal = u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.hostname === '[::1]';
  if (!(u.protocol === 'https:' || (u.protocol === 'http:' && lokal))) return false;
  return istWorkerAdresse(url, server);
}

// ── Ende des Moduls ──
