// #317 Gast-Klicker übers Internet: der Presenter verbindet sich AUSGEHEND mit dem Cloud-Dienst
// (services/gast-klicker), führt von dort nur „vor“/„zurück“ aus und schickt Stand + JPEG-Vorschau.
// Kein eingehender Port. Fällt der Dienst aus, ändert sich am lokalen Betrieb nichts; der Client verbindet neu.
// Grundsatz (Gesamtprüfung 18.11.): nichts aus diesem Modul darf in die lokale Show durchschlagen – jeder Weg, der aus
// present.publish() oder einem Timer kommt, fängt seine Fehler selbst.
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
/** Erste Erfassung nach einer Änderung, dann noch einmal (schwere PDF-Seiten brauchen länger als 300 ms). */
const VORSCHAU_VERZUG_MS = 300;
const NACHFASS_MS = 1500;
const MAX_BILD_BYTES = 262144;
/** Höchstens ein Gast-Kommando je 150 ms über ALLE Gäste (der Raum drosselt nur je Verbindung). */
const KOMMANDO_ABSTAND_MS = 150;
/** `bildBitte` höchstens einmal je Sekunde beantworten (Wiederverbinden ohne Bild im Raum). */
const BILD_BITTE_ABSTAND_MS = 1000;
const RAUM_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const PING = '{"t":"ping"}';

/** Herzschlag: App-Ping (der Raum antwortet, in Workers ohne aufzuwachen); ohne Antwort binnen Frist neu verbinden. */
let pingMs = 20_000;
let pongFristMs = 10_000;

let cfg: GastKlickerConfig = { an: false, raum: null, geheimnis: null };
let lage: GastKlickerLage = 'aus';
let gaeste = 0;
let pausiert = false;
let sock: WebSocket | null = null;
let versuch = 0;
let wiederTimer: ReturnType<typeof setTimeout> | null = null;
let bildTimer: ReturnType<typeof setTimeout> | null = null;
let nachfassTimer: ReturnType<typeof setTimeout> | null = null;
let letzterBild: string | null = null;
let letztesBild: Buffer | null = null;
let erfasseGerade = false;
let letzteBildBitteMs = 0;
let letztesKommandoMs = 0;
let abbestellen: (() => void) | null = null;
let onStatus: ((s: GastKlickerStatus) => void) | null = null;
let bildZuGrossGemeldet = false;
/** Fehlerlauf seit der letzten erfolgreichen Verbindung schon ins Log geschrieben? (eine Zeile je Ausfall) */
let ausfallGemeldet = false;
let ersterFehler: string | null = null;

const basis = (): string => basisAusUmgebung(process.env.JMPR_GAST_KLICKER_URL);

function log(stufe: 'info' | 'warn', text: string): void {
  try {
    getLog()[stufe](`[gast-klicker] ${text}`);
  } catch {
    /* Log darf nie stören */
  }
}

/** Nur für Selbsttests: kürzere Herzschlag-Zeiten. */
export function setzeHerzschlagZeiten(ping: number, frist: number): void {
  pingMs = ping;
  pongFristMs = frist;
}

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
  try {
    onStatus?.(getGastKlickerStatus());
  } catch {
    /* Fenster weg o. ä. */
  }
}

function neuesGeheimnis(): void {
  const geheimnis = randomBytes(32).toString('hex');
  cfg = { ...cfg, geheimnis, raum: raumAusGeheimnis(geheimnis) };
}

function sendeRoh(daten: string | Buffer): boolean {
  const s = sock;
  if (!s || s.readyState !== WebSocket.OPEN) return false;
  try {
    if (typeof daten === 'string') s.send(daten);
    else s.send(daten, { binary: true });
    return true;
  } catch (e) {
    log('warn', `Senden fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    try {
      s.terminate();
    } catch {
      /* schon zu */
    }
    return false;
  }
}

function sendeJson(o: unknown): void {
  if (lage === 'verbunden') sendeRoh(JSON.stringify(o));
}

function standSchluessel(): string {
  const st = getState();
  return `${st.active}|${st.index}|${st.total}|${st.screen}`;
}

function sendeStand(): void {
  try {
    const st = getState();
    sendeJson({ t: 'stand', aktiv: st.active, index: st.index, total: st.total, screen: st.screen, pausiert });
  } catch (e) {
    log('warn', `Stand nicht gesendet: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Vorschau erfassen und senden. `nurWennAnders`: gleiches Bild wie zuletzt gesendet nicht noch einmal schicken. */
async function sendeBild(erzwingen: boolean, nurWennAnders = false): Promise<void> {
  if (!sock || lage !== 'verbunden' || erfasseGerade) return;
  erfasseGerade = true;
  try {
    const schluessel = standSchluessel();
    if (!erzwingen && !nurWennAnders && schluessel === letzterBild) return;
    if (!getState().active) {
      letzterBild = schluessel;
      return;
    }
    const jpeg = await captureVorschau(VORSCHAU_BREITE);
    if (!jpeg || lage !== 'verbunden') return;
    if (jpeg.byteLength > MAX_BILD_BYTES) {
      if (!bildZuGrossGemeldet) log('warn', `Vorschau zu groß (${jpeg.byteLength} Byte), nicht gesendet`);
      bildZuGrossGemeldet = true;
      return;
    }
    if (nurWennAnders && letztesBild && jpeg.equals(letztesBild)) return;
    if (sendeRoh(jpeg)) {
      letzterBild = schluessel;
      letztesBild = jpeg;
    }
  } catch (e) {
    log('warn', `Vorschau nicht erfasst: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    erfasseGerade = false;
  }
}

function planeBild(ms: number): void {
  if (bildTimer) clearTimeout(bildTimer);
  if (nachfassTimer) clearTimeout(nachfassTimer);
  bildTimer = setTimeout(() => {
    bildTimer = null;
    void sendeBild(false);
  }, ms);
  nachfassTimer = setTimeout(() => {
    nachfassTimer = null;
    void sendeBild(false, true);
  }, NACHFASS_MS);
}

function beiAenderung(): void {
  try {
    if (lage !== 'verbunden') return;
    sendeStand();
    if (standSchluessel() !== letzterBild) planeBild(VORSCHAU_VERZUG_MS);
  } catch (e) {
    // läuft synchron in present.publish() – nie durchschlagen lassen (NDI, Companion, eigene Klicks)
    log('warn', `Änderung nicht verarbeitet: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function fuehreKommandoAus(dir: unknown): void {
  const jetzt = Date.now();
  if (jetzt - letztesKommandoMs < KOMMANDO_ABSTAND_MS) return;
  const st = getState();
  const was = fuehreAus({ aktiv: st.active, pausiert }, dir);
  if (!was) return;
  letztesKommandoMs = jetzt;
  log('info', was);
  if (was === 'next') next();
  else prev();
}

function beantworteBildBitte(): void {
  // Nach der Hibernation kennt der Raum weder Bild noch Stand → beides schicken (Gesamtprüfung 18.11.).
  sendeStand();
  const jetzt = Date.now();
  if (jetzt - letzteBildBitteMs < BILD_BITTE_ABSTAND_MS) return;
  letzteBildBitteMs = jetzt;
  void sendeBild(true);
}

function beiNachricht(ws: WebSocket, roh: WebSocket.RawData, binaer: boolean): void {
  if (ws !== sock || binaer) return;
  let m: { t?: unknown; dir?: unknown; n?: unknown };
  try {
    m = JSON.parse(roh.toString()) as typeof m;
  } catch {
    return;
  }
  try {
    switch (m.t) {
      case 'ok':
        versuch = 0;
        if (ausfallGemeldet || lage !== 'verbunden') log('info', 'verbunden');
        ausfallGemeldet = false;
        ersterFehler = null;
        lage = 'verbunden';
        letzterBild = null;
        letztesBild = null;
        melde();
        sendeStand();
        planeBild(VORSCHAU_VERZUG_MS);
        return;
      case 'abgelehnt':
        lage = 'abgelehnt';
        log('warn', 'vom Dienst abgelehnt');
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
        beantworteBildBitte();
        return;
      default:
        return;
    }
  } catch (e) {
    log('warn', `Nachricht nicht verarbeitet: ${e instanceof Error ? e.message : String(e)}`);
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
  let ws: WebSocket;
  try {
    ws = new WebSocket(presenterWsUrl(basis(), cfg.raum), {
      headers: { authorization: `Bearer ${geheimnis}` },
      handshakeTimeout: 15_000,
      perMessageDeflate: false,
      maxPayload: 64 * 1024,
    });
  } catch (e) {
    log('warn', `Verbindung nicht aufgebaut: ${e instanceof Error ? e.message : String(e)}`);
    lage = 'getrennt';
    melde();
    wiederTimer = setTimeout(verbinde, wartezeitMs(versuch++, Math.random()));
    return;
  }
  sock = ws;
  let herz: ReturnType<typeof setInterval> | null = null;
  let pongTimer: ReturnType<typeof setTimeout> | null = null;
  const herzAus = (): void => {
    if (herz) clearInterval(herz);
    if (pongTimer) clearTimeout(pongTimer);
    herz = null;
    pongTimer = null;
  };
  ws.on('open', () => {
    if (ws !== sock) return;
    sendeRoh(JSON.stringify({ t: 'hallo', geheimnis }));
    herz = setInterval(() => {
      if (ws !== sock || lage !== 'verbunden' || pongTimer) return;
      sendeRoh(PING);
      pongTimer = setTimeout(() => {
        pongTimer = null;
        if (ws !== sock) return;
        log('warn', 'keine Antwort auf Ping – verbinde neu');
        ws.terminate();
      }, pongFristMs);
    }, pingMs);
  });
  ws.on('message', (roh, binaer) => {
    // jede Nachricht beweist, dass die Leitung lebt
    if (pongTimer) {
      clearTimeout(pongTimer);
      pongTimer = null;
    }
    beiNachricht(ws, roh, binaer);
  });
  ws.on('unexpected-response', (_req, res) => {
    // 401/403 vom Worker: Geheimnis passt nicht (mehr) zum Raum → nicht endlos neu versuchen.
    if (ws === sock && (res.statusCode === 401 || res.statusCode === 403)) lage = 'abgelehnt';
    if (!ersterFehler) ersterFehler = `HTTP ${res.statusCode}`;
    ws.terminate();
  });
  ws.on('error', (e) => {
    if (!ersterFehler) ersterFehler = e.message;
  });
  ws.on('close', (code) => {
    herzAus();
    if (ws !== sock) return;
    sock = null;
    gaeste = 0;
    if (!cfg.an) return;
    if (code === 4403) lage = 'abgelehnt';
    if (!ausfallGemeldet) {
      log('warn', `getrennt (Code ${code}${ersterFehler ? `, ${ersterFehler}` : ''})${lage === 'abgelehnt' ? ' – abgelehnt' : ''}`);
      ausfallGemeldet = true;
    }
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
  if (nachfassTimer) {
    clearTimeout(nachfassTimer);
    nachfassTimer = null;
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
