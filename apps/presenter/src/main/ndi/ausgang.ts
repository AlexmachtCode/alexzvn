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

let status: NdiStatus = NDI_STATUS_AUS;
/**
 * Das Payload, auf dem das NDI-Fenster steht. Ein frisch geöffnetes Fenster holt sich das laufende selbst
 * (`present:getPayload`); danach kommt nur ein NEUES Payload-Objekt per `present:payload` – Folie, Pause und
 * Schleife erfährt das Fenster wie alle anderen über `present:state`.
 */
let gemerkt: PresentationPayload | null = null;

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

function meldungen(): SenderMeldungen {
  // Toter Sender (Takt steht nach `fehler`, oder der Prozess ist weg): Prozess nie weiterlaufen lassen.
  // Das NDI-Fenster bleibt offen – ein Neustart verbindet es sofort neu.
  const ende = (grund: string): void => {
    if (!laeuft()) return; // Nachzügler nach Aus oder nach dem ersten Ende
    stoppeSender();
    nichtVerfuegbar(true, grund);
  };
  return {
    bereit: () => {
      if (status.lage === 'startet') setzeStatus({ ...status, lage: 'sendet' });
    },
    empfaenger: (n) => {
      if (status.lage === 'sendet') setzeStatus({ ...status, empfaenger: n });
    },
    fehler: (grund) => ende(grund || 'NDI-Sender meldet einen Fehler.'),
    beendet: (code) => ende(`NDI-Sender beendet (Code ${code}).`),
  };
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
    nichtVerfuegbar(true, `NDI-Sender startet nicht: ${ersteZeile(err)}`);
    return;
  }
  if (!gestartet) {
    nichtVerfuegbar(true, SENDER_FEHLT);
    return;
  }
  setzeStatus({ an: true, lage: 'startet', empfaenger: 0, grund: null });
  gemerkt = getPayload();
  const offen = getNdiWindow();
  if (offen) {
    verbindeFenster(offen); // Neustart nach einem Fehler: das Fenster steht schon
    return;
  }
  // Das neue Fenster meldet sich selbst per ndi:fensterBereit, dann bekommt es den Port.
  const win = openNdiWindow();
  win.once('closed', () => {
    // Nach schnellem Aus/An gehört der laufende Sender schon zum neuen Fenster.
    if (getNdiWindow() === null) stoppeSender();
  });
}

/** Beim App-Start (einmal, aus registerIpc): Payload-Weitergabe einrichten und den gemerkten Schalter anwenden. */
export function initNdiAusgang(): void {
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
    stoppeSender();
    closeNdiWindow();
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
  if (win && laeuft()) verbindeFenster(win);
}

/** App endet (will-quit). */
export function beendeNdi(): void {
  stoppeSender();
}
