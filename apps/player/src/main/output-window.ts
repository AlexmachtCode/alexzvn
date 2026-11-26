import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import { getLog } from '@jm/app-runtime';
import { AUSGABE_ZU, naechsterAusgabeZustand, type AusgabeEreignis, type AusgabeZustand } from '@jm/output-window/zustand';
import type { DisplayInfo, OutputCommand } from '@shared/types';
import { AUSGABE_BEREIT_MS, LebendeFenster } from './ausgabe-fenster';

declare const __dirname: string;

const preloadPath = join(__dirname, '../preload/index.cjs');

// UX Welle 2a (W2-2, E14): gemessener Zustand des Ausgabefensters, nur lesend. Das Fenster bleibt das eigene des Players
// (nicht die Klasse OutputWindow); es meldet seine Ereignisse an die reine Zustandsmaschine aus @jm/output-window/zustand.
let zustand: AusgabeZustand = AUSGABE_ZU;
const hoerer = new Set<(z: AusgabeZustand) => void>();
let bildschirmHoerer = false;
// Alle noch nicht geschlossenen Ausgabefenster dieses Moduls. Sie tragen den Zustand (E3) und, seit der Altfehler-Stufe 1, auch das
// Verhalten: Es gibt nur das aktuelle Fenster (PL-T13), und Befehle warten auf seine Meldung „bereit“ (PL-N). Die Frist gilt je
// Fenster: Nach dem ersten Ablauf gilt es als bereit, und die Log-Zeile kommt einmal je Fenster (R5).
const lebende = new LebendeFenster<BrowserWindow>(() => {
  getLog().warn(`Ausgabefenster meldete nicht bereit (${AUSGABE_BEREIT_MS} ms)`);
});

/** Das aktuelle Ausgabefenster: das neueste lebende ohne Schließ-Wunsch und nicht zerstört; sonst null. */
function aktuell(): BrowserWindow | null {
  const w = lebende.aktuelles();
  return w && !w.isDestroyed() ? w : null;
}

/** Die Ausgabeansicht von `win` hat output:cmd abonniert (IPC output:bereit, Altfehler PL-N). */
export function meldeAusgabeBereit(win: BrowserWindow): void {
  lebende.meldeBereit(win);
}

/** Gemessener Zustand des Fensters. */
export function ausgabeZustand(): AusgabeZustand {
  return zustand;
}

/** Meldet jede Änderung des Zustands; gibt die Abmeldung zurück. */
export function onAusgabeZustand(cb: (z: AusgabeZustand) => void): () => void {
  hoerer.add(cb);
  return () => {
    hoerer.delete(cb);
  };
}

function melde(e: AusgabeEreignis): void {
  const neu = naechsterAusgabeZustand(zustand, e);
  if (neu.art === zustand.art && neu.displayId === zustand.displayId) return;
  zustand = neu;
  for (const cb of [...hoerer]) cb(neu);
}

export function listDisplays(): DisplayInfo[] {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    label: d.label || `Bildschirm ${i + 1}`,
    primary: d.id === primaryId,
    width: d.size.width,
    height: d.size.height,
  }));
}

function loadOutput(win: BrowserWindow): void {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (rendererUrl) {
    win.loadURL(`${rendererUrl}#output`);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'output' });
  }
}

/**
 * Öffnet das Ausgabefenster oder zieht das aktuelle um. Löst erst auf, wenn das Fenster „bereit“ gemeldet hat (es hört dann auf
 * Befehle), höchstens nach AUSGABE_BEREIT_MS (Altfehler PL-N, A5). Ein neues Fenster entsteht nur ohne aktuelles (PL-T13).
 */
export async function openOutputWindow(displayId?: number): Promise<void> {
  const displays = screen.getAllDisplays();
  const target =
    (displayId != null ? displays.find((d) => d.id === displayId) : undefined) ??
    screen.getPrimaryDisplay();
  const { x, y, width, height } = target.bounds;
  // `screen` gibt es erst nach app.ready, darum erst hier (einmalig) anmelden.
  if (!bildschirmHoerer) {
    bildschirmHoerer = true;
    screen.on('display-removed', (_e, d) => melde({ t: 'bildschirm-weg', displayId: d.id }));
  }

  const vorhanden = aktuell();
  if (vorhanden) {
    // Auf den gewünschten Bildschirm umziehen und (wieder) in den Vollbildmodus.
    vorhanden.setFullScreen(false);
    vorhanden.setBounds({ x, y, width, height });
    vorhanden.setFullScreen(true);
    vorhanden.show();
    vorhanden.focus();
    melde({ t: 'geoeffnet', displayId: target.id, neu: false });
    await lebende.bereit(vorhanden, AUSGABE_BEREIT_MS);
    return;
  }

  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    backgroundColor: '#000000',
    fullscreen: true,
    show: false,
    title: 'JM Player — Ausgabe',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on('ready-to-show', () => win.show());
  win.on('closed', () => {
    // „zu“ erst, wenn das letzte lebende Fenster geschlossen ist. Ein spätes closed eines alten Fensters lässt das aktuelle
    // unberührt (PL-T13); Wartende auf dieses Fenster werden mit false frei.
    if (lebende.schliesse(win)) melde({ t: 'geschlossen' });
  });
  win.webContents.on('render-process-gone', () => {
    // Nur der Absturz des neuesten lebenden Fensters zählt.
    if (lebende.istNeuestes(win)) melde({ t: 'abgestuerzt' });
  });

  lebende.hinzu(win);
  loadOutput(win);
  melde({ t: 'geoeffnet', displayId: target.id, neu: true });
  await lebende.bereit(win, AUSGABE_BEREIT_MS);
}

export function closeOutputWindow(): void {
  const win = aktuell();
  if (!win) return;
  // Ab jetzt nicht mehr das aktuelle Fenster, auch bevor sein closed kommt: ein sofortiges Öffnen legt ein neues an (PL-T13).
  lebende.schliesst(win);
  win.close();
}

export function isOutputOpen(): boolean {
  return aktuell() !== null;
}

/** Gemessenes Vollbild des Ausgabefensters (E14); null, solange kein Fenster offen ist. */
export function isOutputFullscreen(): boolean | null {
  return aktuell()?.isFullScreen() ?? null;
}

/**
 * Vollbild am Ausgabeschirm umschalten (Issue #31). Liefert den neuen Zustand.
 * Beim Verlassen des Vollbilds das Fenster sichtbar/fokussiert halten, damit es
 * nicht hinter anderen Fenstern auf dem Ausgabeschirm verschwindet.
 */
export function toggleOutputFullscreen(): boolean {
  const win = aktuell();
  if (!win) return false;
  const next = !win.isFullScreen();
  win.setFullScreen(next);
  if (!next) {
    win.show();
    win.focus();
  }
  return next;
}

/**
 * Befehl an das aktuelle Ausgabefenster. Wartet auf dessen „bereit“, höchstens AUSGABE_BEREIT_MS je Fenster; danach geht der Befehl
 * trotzdem hinaus, die Log-Zeile schreibt der Ablauf-Hörer einmal je Fenster (Altfehler PL-N, A5, R5). Gesendet wird nur, wenn das
 * Fenster dann noch das aktuelle ist. Mehrere wartende Befehle behalten ihre Reihenfolge (die Wartenden werden in Aufrufreihenfolge
 * frei, auch beim ersten Ablauf alle zugleich).
 */
export async function sendToOutput(cmd: OutputCommand): Promise<void> {
  const win = aktuell();
  if (!win) return;
  await lebende.bereit(win, AUSGABE_BEREIT_MS);
  if (lebende.aktuelles() !== win || win.isDestroyed()) return;
  win.webContents.send('output:cmd', cmd);
}
