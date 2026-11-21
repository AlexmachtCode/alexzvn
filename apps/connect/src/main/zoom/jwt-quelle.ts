// ─────────────────────────────────────────────────────────────────────────────
// Quelle des Zoom-JWT von JM Connect (Anmeldung im Launcher, Teil 2, Task 14; Entwurf „Zoom-JWT“, OT2, OT3, OT9, R6, E4, E9).
// Der Worker signiert das JWT selbst (`POST /zoom/jwt`, Freigabe `zoom-jwt`); Connect hält es nur im RAM und erneuert es,
// sobald weniger als 2 h Rest bleiben. Die alten lokalen Zoom-Zugangsdaten gelten nur im Übergang als Rückfall.
// Rein: kein Electron, keine Datei; fetch, Uhr, Zeitgeber und Signatur sind einspeisbar (test/jwt-quelle.test.ts).
//
// GEHEIMNISSE: Kein JWT, keine Freigabe, kein Client-Secret in Log, Fehlerdetail oder lage(). Logzeilen nennen nur die
// Herkunft und `bis` als ISO. geheimnisse() liefert das gehaltene JWT für den Schwärzer der Logs.
// ─────────────────────────────────────────────────────────────────────────────
import type { ProxyKeySource } from '../../shared/types';
import type { ZugangsHalter } from '../zugang/halter';
import { ZIEL_ZOOM_JWT, leseFehlerCode } from '../zugang/regeln';
import type { JwtGrund, ZoomAnmeldungLage } from '../zugang/regeln';

/** Erneuern, sobald weniger als 2 h Rest bleiben. */
export const JWT_ERNEUERN_VOR_MS = 7_200_000;
/** Scheitert die Erneuerung, versucht die Quelle es nach 5 min erneut (solange das Meeting das JWT braucht). */
export const JWT_WIEDERHOLEN_MS = 300_000;
/** Ein gehaltenes JWT, das der Server nicht ersetzen kann, gilt noch bei mindestens 5 min Rest. */
export const JWT_MIN_REST_MS = 300_000;
/** Laufzeit des lokal signierten JWT (Übergang): 12 h. */
const LOKAL_TTL_S = 43_200;
const ABRUF_ZEITLIMIT_MS = 10_000;
const EIGENE_MASCHINE = new Set(['127.0.0.1', 'localhost', '[::1]']);

export type JwtHerkunft = 'server' | 'lokal';
export type JwtErgebnis =
  | { ok: true; jwt: string; bis: number; herkunft: JwtHerkunft }
  | { ok: false; grund: JwtGrund; detail: string | null };

export type ServerJwtErgebnis = { ok: true; jwt: string; gueltigS: number } | { ok: false; status: number; code: string | null };

export interface JwtQuelle {
  hole(): Promise<JwtErgebnis>;
  /** Der Server hat angenommen: gespeicherte lokale Daten genau einmal löschen (true). `lokal` nie. */
  angemeldet(h: JwtHerkunft): boolean;
  lage(): ZoomAnmeldungLage;
  geheimnisse(): string[];
  stoppe(): void;
}

export interface JwtQuelleAbhaengigkeiten {
  halter: Pick<ZugangsHalter, 'zugang' | 'antwort' | 'lage'>;
  holeServerJwt(token: string, ttlS: number | null): Promise<ServerJwtErgebnis>;
  lokal: {
    lesen(): { daten: { clientId: string; clientSecret: string } | null; herkunft: ProxyKeySource };
    loeschen(): boolean;
  };
  signiereLokal(z: { clientId: string; clientSecret: string }, ttlS: number): string;
  devTtlS: number | null;
  brauchtJwt(): boolean;
  jetzt(): number;
  zeitgeber(ms: number, fn: () => void): unknown;
  loescheZeitgeber(t: unknown): void;
  log(z: string): void;
  geaendert(): void;
}

/** `JMPS_ZOOM_JWT_TTL_S` als ganze Zahl 1800–43 200 (wie der Worker), sonst null. */
export function devTtl(env: Record<string, string | undefined>): number | null {
  const v = env.JMPS_ZOOM_JWT_TTL_S;
  if (typeof v !== 'string' || !/^\d{1,5}$/.test(v)) return null;
  const n = Number(v);
  return n >= 1800 && n <= 43_200 ? n : null;
}

/**
 * `POST <base>/zoom/jwt` mit der Freigabe als Bearer. Nur https (http nur an die eigene Maschine), keine Weiterleitung,
 * 10 s Zeitlimit. Wirft nie: Netzfehler → status 0, unbrauchbare Antwort → status 502.
 */
export async function holeServerJwt(base: string, token: string, ttlS: number | null, f: typeof fetch = fetch): Promise<ServerJwtErgebnis> {
  let ziel: URL;
  try {
    ziel = new URL(`${base.replace(/\/+$/, '')}/zoom/jwt`);
  } catch {
    return { ok: false, status: 0, code: null };
  }
  if (ziel.protocol !== 'https:' && !(ziel.protocol === 'http:' && EIGENE_MASCHINE.has(ziel.hostname))) {
    return { ok: false, status: 0, code: null };
  }
  const kopf: Record<string, string> = { Authorization: `Bearer ${token}` };
  const init: RequestInit = { method: 'POST', headers: kopf, redirect: 'manual', signal: AbortSignal.timeout(ABRUF_ZEITLIMIT_MS) };
  if (ttlS !== null) {
    kopf['content-type'] = 'application/json';
    init.body = JSON.stringify({ ttlS });
  }
  try {
    const res = await f(ziel, init);
    if (res.status !== 200) {
      let code: string | null = null;
      if (res.status === 401 || res.status === 403 || res.status === 503) {
        try { code = leseFehlerCode(await res.json()); } catch { code = null; }
      } else {
        await res.body?.cancel().catch(() => undefined);
      }
      return { ok: false, status: res.status, code };
    }
    const j = await res.json().then((x: unknown) => x as { jwt?: unknown; gueltigS?: unknown } | null, () => null);
    if (typeof j?.jwt !== 'string' || !j.jwt || typeof j.gueltigS !== 'number' || !Number.isSafeInteger(j.gueltigS) || j.gueltigS <= 0) {
      return { ok: false, status: 502, code: null };
    }
    return { ok: true, jwt: j.jwt, gueltigS: j.gueltigS };
  } catch {
    return { ok: false, status: 0, code: null };
  }
}

interface Gehalten { jwt: string; bis: number }

export function erzeugeJwtQuelle(d: JwtQuelleAbhaengigkeiten): JwtQuelle {
  let ram: Gehalten | null = null;
  let timer: unknown = null;
  let laufend: Promise<JwtErgebnis> | null = null;
  let zuletzt: JwtHerkunft | null = null;
  let grund: JwtGrund | null = null;
  let detail: string | null = null;
  let geloescht = false;
  let gestoppt = false;
  let erneuerungen = 0;

  const iso = (ms: number): string => new Date(ms).toISOString();
  const dev = d.devTtlS !== null;

  function stoppeZeitgeber(): void {
    if (timer !== null) d.loescheZeitgeber(timer);
    timer = null;
  }

  function haltenUndPlanen(jwt: string, bis: number): void {
    ram = { jwt, bis };
    erneuerungen++;
    planeErneuern(Math.max(0, bis - JWT_ERNEUERN_VOR_MS - d.jetzt()));
  }

  /** Stellt den einen Zeitgeber für die erzwungene Erneuerung; nie mit devTtlS (E9), nie nach stoppe(). */
  function planeErneuern(ms: number): void {
    stoppeZeitgeber();
    if (dev || gestoppt) return;
    timer = d.zeitgeber(ms, () => {
      timer = null;
      if (gestoppt || !d.brauchtJwt()) return;
      const vorher = erneuerungen;
      void hole(true).then(
        () => { if (erneuerungen === vorher) wiederholen(); },
        () => { wiederholen(); },
      );
    });
  }

  function wiederholen(): void {
    if (gestoppt || !d.brauchtJwt() || timer !== null) return;
    d.log('[connect] Zoom-JWT: Erneuerung nicht gelungen, neuer Versuch in 5 min');
    planeErneuern(JWT_WIEDERHOLEN_MS);
  }

  async function ablauf(erzwingen: boolean): Promise<JwtErgebnis> {
    // (2) Im RAM mit mindestens 2 h Rest: nie mit devTtlS (E9), nie beim Erneuern durch den Zeitgeber.
    if (!dev && !erzwingen && ram && ram.bis - d.jetzt() >= JWT_ERNEUERN_VOR_MS) {
      return { ok: true, jwt: ram.jwt, bis: ram.bis, herkunft: 'server' };
    }
    // (3) Freigabe, dann der Server.
    let fehlerGrund: JwtGrund | null = null;
    let fehlerDetail: string | null = null;
    const w = await d.halter.zugang('zoom-jwt', ZIEL_ZOOM_JWT);
    if (w.art === 'freigabe') {
      const r = await d.holeServerJwt(w.f.token, d.devTtlS);
      if (r.ok) {
        const bis = d.jetzt() + r.gueltigS * 1000;
        haltenUndPlanen(r.jwt, bis);
        zuletzt = 'server';
        grund = null;
        detail = null;
        d.log(`[connect] Zoom-JWT: Quelle Server, bis ${iso(bis)}`);
        d.geaendert();
        return { ok: true, jwt: r.jwt, bis, herkunft: 'server' };
      }
      if (r.status === 401 || r.status === 403) {
        d.halter.antwort('zoom-jwt', w, r.status, r.code);
        fehlerGrund = 'server-abgelehnt';
      } else if (r.status === 503 && r.code === 'nicht-eingerichtet') {
        fehlerGrund = 'nicht-eingerichtet';
      } else {
        fehlerGrund = 'server-fehler';
        fehlerDetail = r.status === 0 ? 'Netz' : `HTTP ${r.status}`;
      }
      d.log(`[connect] Zoom-JWT: Server lieferte kein JWT (${fehlerGrund}${fehlerDetail ? `, ${fehlerDetail}` : ''})`);
    }
    // (4) Im RAM mit mindestens 5 min Rest: nie mit devTtlS (E9, P6).
    if (!dev && ram && ram.bis - d.jetzt() >= JWT_MIN_REST_MS) {
      zuletzt = 'server';
      return { ok: true, jwt: ram.jwt, bis: ram.bis, herkunft: 'server' };
    }
    // (5) Übergang: lokal signieren.
    const l = d.lokal.lesen().daten;
    if (l) {
      try {
        const jwt = d.signiereLokal(l, LOKAL_TTL_S);
        const bis = d.jetzt() + LOKAL_TTL_S * 1000;
        zuletzt = 'lokal';
        const lg = d.halter.lage('zoom-jwt');
        grund = fehlerGrund ?? lg.letzterGrund;
        detail = fehlerGrund ? fehlerDetail : lg.detail;
        d.log(`[connect] Zoom-JWT: Quelle lokal (Übergang), bis ${iso(bis)}`);
        d.geaendert();
        return { ok: true, jwt, bis, herkunft: 'lokal' };
      } catch {
        // Signatur nicht möglich: wie ohne lokale Daten behandeln.
      }
    }
    // (6) Fehler.
    const lg = d.halter.lage('zoom-jwt');
    zuletzt = null;
    grund = fehlerGrund ?? lg.letzterGrund ?? 'kein-launcher';
    detail = fehlerGrund ? fehlerDetail : lg.detail;
    d.log(`[connect] Zoom-JWT: keine Quelle (${grund})`);
    d.geaendert();
    return { ok: false, grund, detail };
  }

  function hole(erzwingen = false): Promise<JwtErgebnis> {
    if (!laufend) {
      laufend = ablauf(erzwingen).finally(() => { laufend = null; });
    }
    return laufend;
  }

  return {
    hole: () => hole(false),

    angemeldet(h) {
      if (h !== 'server' || geloescht) return false;
      const a = d.lokal.lesen();
      if ((a.herkunft !== 'stored' && a.herkunft !== 'session') || !d.lokal.loeschen()) return false;
      geloescht = true;
      d.log('[connect] Zoom-JWT: lokale Zugangsdaten gelöscht (Server-Anmeldung bestätigt)');
      d.geaendert();
      return true;
    },

    lage() {
      const lg = d.halter.lage('zoom-jwt');
      // Das Meeting braucht das JWT: die Quelle bleibt Server, auch wenn `bis` nach der lokalen Uhr verstrichen ist.
      const server = zuletzt === 'server' && ram !== null && (ram.bis > d.jetzt() || d.brauchtJwt());
      const quelle: ZoomAnmeldungLage['quelle'] = server ? 'server' : zuletzt === 'lokal' ? 'lokal' : 'keine';
      return {
        quelle,
        grund,
        detail,
        konto: quelle === 'server' ? lg.konto : null,
        freigabeBis: quelle === 'server' ? lg.bis : null,
        devTtlS: d.devTtlS,
        versucht: lg.versucht,
        geloescht,
      };
    },

    geheimnisse() {
      return ram ? [ram.jwt] : [];
    },

    stoppe() {
      gestoppt = true;
      stoppeZeitgeber();
    },
  };
}
