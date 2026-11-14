// NDI-Ausgang im Main (#303): Schalter (userData), verstecktes NDI-Fenster, Leben des Sender-Prozesses,
// Empfängerzahl und Fehlerzustand. Ein Fehler wirft nie und öffnet keinen Dialog: Der Schalter meldet
// „nicht verfügbar“ mit Grund, dazu eine Log-Zeile `[ndi] …`; Präsentation und Bildschirm laufen weiter.
//
// Ob Addon und NDI-Laufzeit da sind, prüft der Utility-Prozess beim Laden (Meldung `fehler`); der Main prüft
// nur Plattform und Sender-Datei. Auf dem Mac startet so nie ein Sender, unter Windows wird ein fehlendes
// Addon gemeldet statt abzustürzen.
import type { NdiStatus, PresentationPayload } from '@shared/types';
import { NDI_STATUS_AUS, ndiLiefertBild } from '../../shared/ndi';
import { getPayload, subscribe } from '../present';
import { broadcastAll, closeNdiWindow, getNdiWindow, openNdiWindow, sendeAnNdi } from '../windows';
import { ladeNdiConfig, speichereNdiConfig } from './config';
import { starteSender, stoppeSender, verbindeFenster } from './sender-process';
import type { SenderMeldungen } from './sender-process';

const NUR_WINDOWS = 'NDI-Ausgang gibt es nur unter Windows.';
const SENDER_FEHLT = 'NDI-Sender fehlt im Paket.';
const ANTWORTET_NICHT = 'NDI-Sender antwortet nicht.';
const BILD_ABGESTUERZT = 'NDI-Bild abgestürzt.';

/** So lange darf der Sender nach dem Start schweigen, bevor er als gescheitert gilt (weder `bereit` noch `fehler`). */
const START_FRIST_MS = 10_000;
/** Stürzt das NDI-Bild in dieser Zeit ein zweites Mal ab, wird es nicht wieder geöffnet. */
const ABSTURZ_FENSTER_MS = 60_000;

let startFristMs = START_FRIST_MS;
let absturzFensterMs = ABSTURZ_FENSTER_MS;

let status: NdiStatus = NDI_STATUS_AUS;
/**
 * Das Payload, auf dem das NDI-Fenster steht. Ein frisch geöffnetes Fenster holt sich das laufende selbst
 * (`present:getPayload`); danach kommt nur ein NEUES Payload-Objekt per `present:payload` – Folie, Pause und
 * Schleife erfährt das Fenster wie alle anderen über `present:state`.
 */
let gemerkt: PresentationPayload | null = null;
let startFrist: ReturnType<typeof setTimeout> | null = null;
/** Der laufende Sender hat `bereit` gemeldet. */
let senderBereit = false;
/** Ein Ersatzfenster nach einem Absturz ist noch nicht bereit – bis dahin zeigt NDI kein aktuelles Bild. */
let ersatzWartet = false;
/** Zeitpunkt des letzten Absturzes des NDI-Bilds (Date.now), null = keiner seit dem letzten Aus. */
let letzterAbsturz: number | null = null;

const ersteZeile = (e: unknown): string => String((e as { message?: unknown })?.message ?? e).split(/\r?\n/)[0];
const laeuft = (): boolean => status.lage === 'startet' || status.lage === 'sendet';

/** Nur echte Änderungen gehen an die Fenster; jeder Übergang nach „nicht verfügbar“ schreibt eine Log-Zeile. */
function setzeStatus(neu: NdiStatus): void {
  const alt = status;
  if (alt.an === neu.an && alt.lage === neu.lage && alt.empfaenger === neu.empfaenger && alt.grund === neu.grund) return;
  status = neu;
  if (neu.lage === 'nicht-verfuegbar' && (alt.lage !== 'nicht-verfuegbar' || alt.grund !== neu.grund)) {
    console.error('[ndi] nicht verfügbar:', neu.grund);
  }
  broadcastAll('ndi:status', status);
}

function nichtVerfuegbar(an: boolean, grund: string): void {
  setzeStatus({ an, lage: 'nicht-verfuegbar', empfaenger: 0, grund });
}

/** `sendet` erst, wenn der Sender bereit ist und kein Ersatzfenster mehr wartet; sonst ehrlich `startet`. */
function zeigeLauf(): void {
  if (laeuft()) setzeStatus({ ...status, lage: senderBereit && !ersatzWartet ? 'sendet' : 'startet' });
}

function beendeStartFrist(): void {
  if (startFrist) clearTimeout(startFrist);
  startFrist = null;
}

/** Sender und Start-Frist beenden (der Status bleibt dem Aufrufer überlassen). */
function stoppeLauf(): void {
  beendeStartFrist();
  senderBereit = false;
  stoppeSender();
}

/**
 * Toter Sender (Takt steht nach `fehler`, der Prozess ist weg oder antwortet nicht): Prozess nie weiterlaufen
 * lassen. Das NDI-Fenster bleibt offen – ein Neustart verbindet es sofort neu.
 */
function senderEnde(grund: string): void {
  if (!laeuft()) return; // Nachzügler nach Aus oder nach dem ersten Ende
  stoppeLauf();
  nichtVerfuegbar(true, grund);
}

function meldungen(): SenderMeldungen {
  return {
    bereit: () => {
      if (status.lage !== 'startet' || senderBereit) return; // spätes `bereit` nach Ablauf der Frist: ignoriert
      beendeStartFrist();
      senderBereit = true;
      zeigeLauf();
    },
    empfaenger: (n) => {
      if (status.lage === 'sendet') setzeStatus({ ...status, empfaenger: n });
    },
    fehler: (grund) => senderEnde(grund || 'NDI-Sender meldet einen Fehler.'),
    beendet: (code) => senderEnde(`NDI-Sender beendet (Code ${code}).`),
  };
}

/** Neues NDI-Fenster; es meldet sich selbst per ndi:fensterBereit, dann bekommt es den Port. */
function oeffneFenster(): void {
  const win = openNdiWindow();
  win.once('closed', () => {
    // Nach schnellem Aus/An oder einem Absturz gehört der laufende Sender schon zum neuen Fenster.
    if (getNdiWindow() === null) stoppeLauf();
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    if (getNdiWindow() === win) bildAbgestuerzt(details.reason);
  });
}

/**
 * Der Renderer des NDI-Fensters ist weg: Fenster schließen und neu öffnen wie bei Aus/An (neuer Port, das
 * neue Fenster holt das laufende Payload). Der Sender läuft weiter, damit die Quelle im Netz bleibt; bis das
 * neue Fenster bereit ist, heißt der Zustand `startet`. Ein zweiter Absturz binnen ABSTURZ_FENSTER_MS öffnet
 * nicht wieder, sondern meldet „nicht verfügbar“.
 */
function bildAbgestuerzt(grund: string): void {
  console.error('[ndi] NDI-Bild abgestürzt:', grund);
  const jetzt = Date.now();
  const wieder = letzterAbsturz !== null && jetzt - letzterAbsturz < absturzFensterMs;
  letzterAbsturz = jetzt;
  closeNdiWindow();
  if (wieder) {
    stoppeLauf();
    ersatzWartet = false;
    nichtVerfuegbar(true, BILD_ABGESTUERZT);
    return;
  }
  if (!status.an) return;
  gemerkt = getPayload();
  ersatzWartet = true;
  zeigeLauf();
  oeffneFenster();
}

function starte(): void {
  if (process.platform !== 'win32') {
    nichtVerfuegbar(true, NUR_WINDOWS);
    return;
  }
  let gestartet: boolean;
  try {
    gestartet = starteSender(meldungen());
  } catch (err) {
    stoppeSender(); // wirft es nach dem Fork (z. B. beim init), läuft das Kind schon
    nichtVerfuegbar(true, `NDI-Sender startet nicht: ${ersteZeile(err)}`);
    return;
  }
  if (!gestartet) {
    nichtVerfuegbar(true, SENDER_FEHLT);
    return;
  }
  senderBereit = false;
  setzeStatus({ an: true, lage: 'startet', empfaenger: 0, grund: null });
  gemerkt = getPayload();
  beendeStartFrist();
  startFrist = setTimeout(() => {
    startFrist = null;
    senderEnde(ANTWORTET_NICHT);
  }, startFristMs);
  const offen = getNdiWindow();
  if (offen) {
    verbindeFenster(offen); // Neustart nach einem Fehler: das Fenster steht schon
    return;
  }
  ersatzWartet = false;
  oeffneFenster();
}

/**
 * Beim App-Start (einmal, aus registerIpc): Payload-Weitergabe einrichten und den gemerkten Schalter anwenden.
 * Die Fristen sind nur für die Selbsttests einspeisbar.
 */
export function initNdiAusgang(opt: { startFristMs?: number; absturzFensterMs?: number } = {}): void {
  startFristMs = opt.startFristMs ?? START_FRIST_MS;
  absturzFensterMs = opt.absturzFensterMs ?? ABSTURZ_FENSTER_MS;
  if (process.platform !== 'win32') {
    nichtVerfuegbar(false, NUR_WINDOWS);
    return;
  }
  subscribe(() => {
    const p = getPayload();
    if (!status.an || p === gemerkt) return;
    gemerkt = p;
    sendeAnNdi('present:payload', p);
  });
  if (ladeNdiConfig().an) starte();
}

export function ndiStatus(): NdiStatus {
  return status;
}

/** Schalter setzen und merken. Ein: (neu) starten, solange kein Sender läuft. Aus: Sender und Fenster weg. */
export function setzeNdiAn(an: boolean): NdiStatus {
  speichereNdiConfig({ an });
  if (!an) {
    stoppeLauf();
    closeNdiWindow();
    ersatzWartet = false;
    letzterAbsturz = null;
    setzeStatus(NDI_STATUS_AUS);
  } else if (!laeuft()) {
    starte();
  }
  return status;
}

/** Kommt gerade ein Bild bei den NDI-Empfängern an? */
export function ndiLiefert(): boolean {
  return ndiLiefertBild(status);
}

/** Das NDI-Fenster ist geladen: Bild-Port verbinden, wenn ein Sender läuft. */
export function ndiFensterBereit(): void {
  const win = getNdiWindow();
  if (!win) return;
  ersatzWartet = false;
  if (!laeuft()) return;
  verbindeFenster(win);
  zeigeLauf();
}

/** App endet (will-quit). */
export function beendeNdi(): void {
  stoppeLauf();
}
