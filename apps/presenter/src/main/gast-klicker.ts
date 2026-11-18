// #317 Gast-Klicker übers Internet: der Presenter verbindet sich AUSGEHEND mit dem Cloud-Dienst
// (services/gast-klicker), führt von dort nur „vor“/„zurück“ aus und schickt Stand + JPEG-Vorschau.
// Kein eingehender Port. Fällt der Dienst aus, ändert sich am lokalen Betrieb nichts; der Client verbindet neu.
import { createHash, randomBytes } from 'node:crypto';
import WebSocket from 'ws';
import { getLog } from '@jm/app-runtime';
import { getState, next, prev, subscribe } from './present';
import { captureVorschau } from './windows';
import { loadGastKlickerConfig, saveGastKlickerConfig } from './gast-klicker-config';
import {
  basisAusUmgebung,
  fuehreAus,
  gastLink,
  presenterWsUrl,
  wartezeitMs,
  type GastKlickerConfig,
  type GastKlickerLage,
  type GastKlickerStatus,
} from '../shared/gast-klicker';

const VORSCHAU_BREITE = 640;
const VORSCHAU_VERZUG_MS = 300;
const MAX_BILD_BYTES = 262144;
const RAUM_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

let cfg: GastKlickerConfig = { an: false, raum: null, geheimnis: null };
let lage: GastKlickerLage = 'aus';
let gaeste = 0;
let pausiert = false;
let sock: WebSocket | null = null;
let versuch = 0;
let wiederTimer: ReturnType<typeof setTimeout> | null = null;
let bildTimer: ReturnType<typeof setTimeout> | null = null;
let letzterBild: string | null = null;
let abbestellen: (() => void) | null = null;
let onStatus: ((s: GastKlickerStatus) => void) | null = null;
let bildZuGrossGemeldet = false;

const basis = (): string => basisAusUmgebung(process.env.JMPR_GAST_KLICKER_URL);

/** Raum-Kennung aus dem Geheimnis — dieselbe Formel wie der Worker (services/gast-klicker/raum.js). */
export function raumAusGeheimnis(geheimnis: string): string {
  const d = createHash('sha256').update(`jm-gast-klicker/raum/v1:${geheimnis}`).digest();
  return [...d.subarray(0, 12)].map((b) => RAUM_ALPHABET[b % 36]).join('');
}

export function setGastKlickerStatusHandler(cb: (s: GastKlickerStatus) => void): void {
  onStatus = cb;
}

export function getGastKlickerStatus(): GastKlickerStatus {
  return {
    an: cfg.an,
    lage,
    link: cfg.an && cfg.raum ? gastLink(basis(), cfg.raum) : null,
    gaeste,
    pausiert,
  };
}

function melde(): void {
  onStatus?.(getGastKlickerStatus());
}

function neuesGeheimnis(): void {
  const geheimnis = randomBytes(32).toString('hex');
  cfg = { ...cfg, geheimnis, raum: raumAusGeheimnis(geheimnis) };
}

function sendeJson(o: unknown): void {
  if (sock && sock.readyState === WebSocket.OPEN && lage === 'verbunden') sock.send(JSON.stringify(o));
}

function standSchluessel(): string {
  const st = getState();
  return `${st.active}|${st.index}|${st.total}|${st.screen}`;
}

function sendeStand(): void {
  const st = getState();
  sendeJson({ t: 'stand', aktiv: st.active, index: st.index, total: st.total, screen: st.screen, pausiert });
}

async function sendeBild(erzwingen: boolean): Promise<void> {
  if (!sock || lage !== 'verbunden') return;
  const schluessel = standSchluessel();
  if (!erzwingen && schluessel === letzterBild) return;
  if (!getState().active) {
    letzterBild = schluessel;
    return;
  }
  const jpeg = await captureVorschau(VORSCHAU_BREITE);
  if (!jpeg || !sock || sock.readyState !== WebSocket.OPEN || lage !== 'verbunden') return;
  if (jpeg.byteLength > MAX_BILD_BYTES) {
    if (!bildZuGrossGemeldet) getLog().warn(`[gast-klicker] Vorschau zu groß (${jpeg.byteLength} Byte), nicht gesendet`);
    bildZuGrossGemeldet = true;
    return;
  }
  sock.send(jpeg, { binary: true });
  letzterBild = schluessel;
}

function planeBild(ms: number): void {
  if (bildTimer) clearTimeout(bildTimer);
  bildTimer = setTimeout(() => {
    bildTimer = null;
    void sendeBild(false);
  }, ms);
}

function beiAenderung(): void {
  if (lage !== 'verbunden') return;
  sendeStand();
  if (standSchluessel() !== letzterBild) planeBild(VORSCHAU_VERZUG_MS);
}

function fuehreKommandoAus(dir: unknown): void {
  const st = getState();
  const was = fuehreAus({ aktiv: st.active, pausiert }, dir);
  if (!was) return;
  getLog().info(`[gast-klicker] ${was}`);
  if (was === 'next') next();
  else prev();
}

function beiNachricht(ws: WebSocket, roh: WebSocket.RawData, binaer: boolean): void {
  if (ws !== sock || binaer) return;
  let m: { t?: unknown; dir?: unknown; n?: unknown };
  try {
    m = JSON.parse(roh.toString()) as typeof m;
  } catch {
    return;
  }
  switch (m.t) {
    case 'ok':
      versuch = 0;
      lage = 'verbunden';
      letzterBild = null;
      melde();
      sendeStand();
      planeBild(VORSCHAU_VERZUG_MS);
      return;
    case 'abgelehnt':
      lage = 'abgelehnt';
      melde();
      return;
    case 'cmd':
      if (lage === 'verbunden') fuehreKommandoAus(m.dir);
      return;
    case 'gaeste':
      if (typeof m.n === 'number' && Number.isInteger(m.n) && m.n >= 0) {
        gaeste = m.n;
        melde();
      }
      return;
    case 'bildBitte':
      void sendeBild(true);
      return;
    default:
      return;
  }
}

function verbinde(): void {
  if (!cfg.an || !cfg.raum || !cfg.geheimnis) return;
  if (wiederTimer) {
    clearTimeout(wiederTimer);
    wiederTimer = null;
  }
  lage = 'verbindet';
  melde();
  const geheimnis = cfg.geheimnis;
  const ws = new WebSocket(presenterWsUrl(basis(), cfg.raum), {
    headers: { authorization: `Bearer ${geheimnis}` },
    handshakeTimeout: 15_000,
  });
  sock = ws;
  ws.on('open', () => {
    if (ws === sock) ws.send(JSON.stringify({ t: 'hallo', geheimnis }));
  });
  ws.on('message', (roh, binaer) => beiNachricht(ws, roh, binaer));
  ws.on('unexpected-response', (_req, res) => {
    // 401/403 vom Worker: Geheimnis passt nicht (mehr) zum Raum → nicht endlos neu versuchen.
    if (ws === sock && (res.statusCode === 401 || res.statusCode === 403)) lage = 'abgelehnt';
    ws.terminate();
  });
  ws.on('error', () => {
    /* `close` folgt; Fehler nicht ins Log fluten */
  });
  ws.on('close', (code) => {
    if (ws !== sock) return;
    sock = null;
    gaeste = 0;
    if (!cfg.an) return;
    if (code === 4403) lage = 'abgelehnt';
    if (lage === 'abgelehnt') {
      melde();
      return;
    }
    lage = 'getrennt';
    melde();
    wiederTimer = setTimeout(verbinde, wartezeitMs(versuch++, Math.random()));
  });
}

function trenne(): void {
  if (wiederTimer) {
    clearTimeout(wiederTimer);
    wiederTimer = null;
  }
  if (bildTimer) {
    clearTimeout(bildTimer);
    bildTimer = null;
  }
  const s = sock;
  sock = null;
  gaeste = 0;
  if (s) {
    try {
      if (s.readyState === WebSocket.CONNECTING) s.terminate();
      else s.close(1000);
    } catch {
      /* schon zu */
    }
  }
}

/** Gespeicherte Einstellung laden; war der Gast-Klicker an, gleich verbinden (App-Start). */
export function initGastKlicker(): GastKlickerStatus {
  cfg = loadGastKlickerConfig();
  if (cfg.geheimnis) cfg = { ...cfg, raum: raumAusGeheimnis(cfg.geheimnis) };
  if (cfg.an) return applyGastKlicker(true);
  lage = 'aus';
  return getGastKlickerStatus();
}

export function applyGastKlicker(an: boolean): GastKlickerStatus {
  if (an) {
    if (!cfg.geheimnis) neuesGeheimnis();
    cfg = { ...cfg, an: true };
    saveGastKlickerConfig(cfg);
    abbestellen ??= subscribe(beiAenderung);
    if (!sock) verbinde();
  } else {
    cfg = { ...cfg, an: false };
    saveGastKlickerConfig(cfg);
    trenne();
    abbestellen?.();
    abbestellen = null;
    lage = 'aus';
    melde();
  }
  return getGastKlickerStatus();
}

export function setzeGastPause(an: boolean): GastKlickerStatus {
  pausiert = an;
  sendeStand();
  melde();
  return getGastKlickerStatus();
}

/** Neuer Link: alten Raum schließen (Gäste sehen „nicht aktiv“), neues Geheimnis, neu verbinden. */
export function neuerGastLink(): GastKlickerStatus {
  sendeJson({ t: 'schliessen' });
  trenne();
  neuesGeheimnis();
  saveGastKlickerConfig(cfg);
  if (cfg.an) {
    lage = 'verbindet';
    verbinde();
  }
  melde();
  return getGastKlickerStatus();
}

export function shutdownGastKlicker(): void {
  trenne();
  abbestellen?.();
  abbestellen = null;
}
