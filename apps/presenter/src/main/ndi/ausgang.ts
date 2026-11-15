// NDI-Ausgang im Main (#303): Schalter (userData), verstecktes NDI-Fenster, Leben des Sender-Prozesses,
// Empfängerzahl und Fehlerzustand. Ein Fehler wirft nie und öffnet keinen Dialog: Der Schalter meldet
// „nicht verfügbar“ mit Grund, dazu eine Log-Zeile `[ndi] …`; Präsentation und Bildschirm laufen weiter.
//
// Ob Addon und NDI-Laufzeit da sind, prüft der Utility-Prozess beim Laden (Meldung `fehler`); der Main prüft
// nur Plattform und Sender-Datei. Auf dem Mac startet so nie ein Sender, unter Windows wird ein fehlendes
// Addon gemeldet statt abzustürzen.
import type { BrowserWindow } from 'electron';
import type { NdiStatus, PresentationPayload } from '@shared/types';
import { NDI_STATUS_AUS } from '../../shared/ndi';
import { getPayload, subscribe } from '../present';
import { broadcastAll, closeNdiWindow, getNdiWindow, openNdiWindow, sendeAnNdi } from '../windows';
import { ladeNdiConfig, speichereNdiConfig } from './config';
import { starteSender, stoppeSender, verbindeFenster } from './sender-process';
import type { SenderMeldungen } from './sender-process';

const NUR_WINDOWS = 'NDI-Ausgang gibt es nur unter Windows.';
const SENDER_FEHLT = 'NDI-Sender fehlt im Paket.';
const ANTWORTET_NICHT = 'NDI-Sender antwortet nicht.';
const BILD_ANTWORTET_NICHT = 'NDI-Bild antwortet nicht.';
const BILD_ABGESTUERZT = 'NDI-Bild abgestürzt.';

/**
 * So lange darf ein Start dauern – der erste wie der Neuaufbau mit einem Ersatzfenster nach einem Absturz: Bis dahin
 * müssen der Sender (`bereit`) UND das neue NDI-Fenster (`ndi:fensterBereit`) sich gemeldet haben, sonst gilt der
 * Start als gescheitert. So bleibt `startet` immer begrenzt.
 */
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
/** Das aktuelle NDI-Fenster (jedes neue, nicht nur ein Ersatz) hat sich noch nicht gemeldet – bis dahin kein Bild. */
let fensterWartet = false;
/** Zeitpunkt des letzten Absturzes des NDI-Bilds (Date.now), null = keiner seit dem letzten Aus. */
let letzterAbsturz: number | null = null;
/**
 * NDI-Fenster, die der Ausgang selbst schließt (Aus, Ende des Senders, Ersatz nach einem Absturz, Start gescheitert).
 * Ihr `closed` – mit destroy() noch während des Schließens – beendet keinen Sender; beim Ersatz läuft er weiter.
 */
const selbstGeschlossen = new WeakSet<BrowserWindow>();

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

/**
 * `sendet` erst, wenn der Sender bereit ist UND das NDI-Fenster sich gemeldet hat – dann endet auch die Start-Frist.
 * Sonst ehrlich `startet`.
 */
function zeigeLauf(): void {
  if (!laeuft()) return;
  const fertig = senderBereit && !fensterWartet;
  if (fertig) beendeStartFrist();
  setzeStatus({ ...status, lage: fertig ? 'sendet' : 'startet' });
}

function beendeStartFrist(): void {
  if (startFrist) clearTimeout(startFrist);
  startFrist = null;
}

/** Start-Frist (neu) setzen; bei Ablauf ist der Start gescheitert – Grund je nachdem, wer sich nicht gemeldet hat. */
function starteFrist(): void {
  beendeStartFrist();
  startFrist = setTimeout(() => {
    startFrist = null;
    senderEnde(senderBereit ? BILD_ANTWORTET_NICHT : ANTWORTET_NICHT);
  }, startFristMs);
}

/** Sender und Start-Frist beenden (der Status bleibt dem Aufrufer überlassen). */
function stoppeLauf(): void {
  beendeStartFrist();
  senderBereit = false;
  stoppeSender();
}

/** Das NDI-Fenster selbst schließen (siehe selbstGeschlossen). */
function schliesseFenster(): void {
  const win = getNdiWindow();
  if (win) selbstGeschlossen.add(win);
  closeNdiWindow();
}

/** Sender, Start-Frist UND NDI-Fenster beenden (der Status bleibt dem Aufrufer überlassen). */
function beendeAlles(): void {
  stoppeLauf();
  schliesseFenster();
  fensterWartet = false;
}

/**
 * Toter Sender (Takt steht nach `fehler`, der Prozess ist weg oder antwortet nicht) oder ein Start, der binnen der
 * Frist nicht fertig wird: Prozess nie weiterlaufen lassen, und auch das NDI-Fenster schließen – es zeichnete sonst
 * jede Folie und jede Blende weiter und schickte sie ins Leere. Ein Neustart (Schalter an) öffnet ein frisches Fenster.
 */
function senderEnde(grund: string): void {
  if (!laeuft()) return; // Nachzügler nach Aus oder nach dem ersten Ende
  beendeAlles();
  nichtVerfuegbar(true, grund);
}

function meldungen(): SenderMeldungen {
  return {
    bereit: () => {
      if (status.lage !== 'startet' || senderBereit) return; // spätes `bereit` nach Ablauf der Frist: ignoriert
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

/**
 * Neues NDI-Fenster (erster Start oder Ersatz nach einem Absturz). Es meldet sich selbst per ndi:fensterBereit, dann
 * bekommt es den Port; bis dahin heißt der Zustand `startet`, und die Start-Frist läuft (neu).
 */
function oeffneFenster(): void {
  fensterWartet = true;
  starteFrist();
  zeigeLauf();
  const win = openNdiWindow();
  win.once('closed', () => {
    // Nur ein Fenster, das jemand anderes schließt (windows.ts mit dem letzten sichtbaren Fenster), beendet den Lauf.
    if (!selbstGeschlossen.has(win) && getNdiWindow() === null) stoppeLauf();
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    if (getNdiWindow() === win) bildAbgestuerzt(details.reason);
  });
}

/**
 * Der Renderer des NDI-Fensters ist weg: Fenster schließen und neu öffnen wie bei Aus/An (neuer Port, das
 * neue Fenster holt das laufende Payload). Der Sender läuft weiter, damit die Quelle im Netz bleibt; bis das
 * neue Fenster bereit ist, heißt der Zustand `startet` – höchstens bis zum Ende der Start-Frist. Ein zweiter
 * Absturz binnen ABSTURZ_FENSTER_MS öffnet nicht wieder, sondern meldet „nicht verfügbar“.
 */
function bildAbgestuerzt(grund: string): void {
  console.error('[ndi] NDI-Bild abgestürzt:', grund);
  const jetzt = Date.now();
  const wieder = letzterAbsturz !== null && jetzt - letzterAbsturz < absturzFensterMs;
  letzterAbsturz = jetzt;
  if (wieder) {
    senderEnde(BILD_ABGESTUERZT);
    return;
  }
  schliesseFenster();
  gemerkt = getPayload();
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
  oeffneFenster(); // ein NDI-Fenster steht hier nie: Aus und jedes Ende schließen es
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

/**
 * initNdiAusgang hat geworfen (ipc.ts fängt es, damit der Editor trotzdem öffnet): Sender, Frist und Fenster weg,
 * Schalter „nicht verfügbar“ – genau eine Log-Zeile `[ndi] …`.
 */
export function ndiStartGescheitert(err: unknown): void {
  beendeAlles();
  nichtVerfuegbar(ladeNdiConfig().an, `NDI-Ausgang startet nicht: ${ersteZeile(err)}`);
}

export function ndiStatus(): NdiStatus {
  return status;
}

/** Schalter setzen und merken. Ein: (neu) starten, solange kein Sender läuft. Aus: Sender und Fenster weg. */
export function setzeNdiAn(an: boolean): NdiStatus {
  speichereNdiConfig({ an });
  if (!an) {
    beendeAlles();
    letzterAbsturz = null;
    setzeStatus(NDI_STATUS_AUS);
  } else if (!laeuft()) {
    starte();
  }
  return status;
}

/** Das NDI-Fenster ist geladen: Bild-Port verbinden; ist auch der Sender bereit, heißt es jetzt `sendet`. */
export function ndiFensterBereit(): void {
  const win = getNdiWindow();
  if (!win || !laeuft()) return;
  fensterWartet = false;
  verbindeFenster(win);
  zeigeLauf();
}

/** App endet (will-quit). */
export function beendeNdi(): void {
  stoppeLauf();
}
