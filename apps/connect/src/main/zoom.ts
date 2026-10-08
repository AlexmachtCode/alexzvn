// Zoom-Hülle (Spec 5.1, 6.1, 8.7): verbindet den Electron-freien Kern (zoom/kern.ts) mit IPC,
// Dialogen, den Einstellungen (safeStorage) und dem Fenster. Der Kern entsteht nur unter Windows;
// unter macOS gibt es weder Kern noch Zoom-Kanäle, und AppStatus.zoom bleibt null (Spec 1).
import { app, dialog, ipcMain, shell, type BrowserWindow, type OpenDialogOptions } from 'electron';
import { join } from 'node:path';
import { getLog } from '@jm/app-runtime';
import { resourcePath } from '@jm/electron-kit';
import { IPC } from '@shared/ipc';
import type { ZoomErgebnis, ZoomKurz } from '@shared/types';
import { erzeugeZoomKern, type ZoomKern } from './zoom/kern';
import { pruefeZugangEingabe } from './zoom/zugang-eingabe';
import { pruefeSdkSchluesselEingabe } from './zoom/sdk-schluessel-eingabe';
import { activeLabels } from './ndi-guests';
import { setZoomControlState } from './control-server';
import { aenderungsMelder } from './control-state';
import {
  proxyUrl,
  setzeZoomAnzeigename,
  setzeZoomLaufzeit,
  setzeZoomVersatzMs,
  zoomAnzeigename,
  zoomSdkSchluesselLesen,
  zoomSdkSchluesselLoeschen,
  zoomSdkSchluesselSpeichern,
  zoomVersatzMs,
  zoomVersatzNurSitzung,
  zoomZugangLesen,
  zoomZugangLoeschen,
  zoomZugangSpeichern,
} from './settings';

declare const __dirname: string;

/** Antwort auf eine falsche Nutzlast oder einen abgebrochenen Dialog: leerer Text, den zeigt der Renderer nicht. */
const NICHTS: ZoomErgebnis = { ok: false, text: '' };

let kern: ZoomKern | null = null;
/** Ein offener Ordner-/Datei-Dialog genügt: ein Doppelklick öffnet keinen zweiten. */
let dialogOffen = false;
/** Zoom-Teil des STATE an den Steuerserver, nur wenn sich einer der sieben Werte geändert hat (Spec 11.3). */
const meldeZoomTeil = aenderungsMelder(setZoomControlState);

/**
 * Zoom-Teil des STATE melden: die zoom_*-Werte aus kern.stateKv(). Läuft einmal nach dem Anlegen des
 * Kerns und danach bei jeder Änderung der Kurzform (onKurz), nicht bei jedem Abbild. Ohne Kern (macOS)
 * meldet niemand einen Zoom-Teil, dort fehlen die zoom_*-Schlüssel im STATE (Spec 7.5).
 */
function meldeZoomState(): void {
  if (!kern) return;
  const kv = kern.stateKv();
  meldeZoomTeil(kv ? { ...kv } : null);
}

function feld(p: unknown, name: string): unknown {
  return typeof p === 'object' && p !== null ? (p as Record<string, unknown>)[name] : undefined;
}

function ganzeZahl(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

async function waehlePfad(getWindow: () => BrowserWindow | null, opts: OpenDialogOptions): Promise<string | null> {
  if (dialogOffen) return null;
  dialogOffen = true;
  try {
    const w = getWindow();
    const r = w && !w.isDestroyed() ? await dialog.showOpenDialog(w, opts) : await dialog.showOpenDialog(opts);
    return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0];
  } finally {
    dialogOffen = false;
  }
}

export function startZoom(d: { getWindow: () => BrowserWindow | null; logDir: string; onKurz: () => void }): void {
  if (kern || process.platform !== 'win32') return;
  // %LOCALAPPDATA% statt userData (Roaming): 315 MB gehören nicht in ein servergespiegeltes Profil (Spec 0.2).
  const basis = join(process.env.LOCALAPPDATA || join(app.getPath('home'), 'AppData', 'Local'), 'JM Connect', 'zoom-laufzeit');
  const ressourcen = resourcePath('', join(__dirname, '..', '..', 'resources'));
  try {
    kern = erzeugeZoomKern({
      pfade: { basis, ressourcen },
      zugang: { lesen: zoomZugangLesen, speichern: zoomZugangSpeichern, loeschen: zoomZugangLoeschen },
      sdkSchluessel: { lesen: zoomSdkSchluesselLesen, speichern: zoomSdkSchluesselSpeichern, loeschen: zoomSdkSchluesselLoeschen },
      einstellungen: {
        anzeigename: zoomAnzeigename,
        setzeAnzeigename: setzeZoomAnzeigename,
        versatzMs: zoomVersatzMs,
        setzeVersatzMs: setzeZoomVersatzMs,
        versatzNurSitzung: zoomVersatzNurSitzung,
        setzeLaufzeit: setzeZoomLaufzeit,
      },
      // „Zoom-SDK laden“ (Spec SDK nachladen 4.3): Umgebung JMPS_PROXY_URL, Einstellung oder Vorgabe; kein Proxy-Schlüssel.
      proxyUrl,
      gastLabels: activeLabels,
      // Der Kern liefert fertige Zeilen: Präfix [zoom]/[zoom-bridge], Geheimnisse schon maskiert (8.7).
      log: (zeile) => getLog().info(zeile),
      onAbbild: (a) => {
        const w = d.getWindow();
        if (w && !w.isDestroyed()) w.webContents.send(IPC.zoom, a);
      },
      // Kurzform geändert: AppStatus an Tray und Kopfzeile, und den Zoom-Teil des STATE (nur bei Änderung).
      onKurz: () => {
        d.onKurz();
        meldeZoomState();
      },
    });
  } catch (e) {
    getLog().error('[zoom] Zoom-Kern ließ sich nicht anlegen:', e instanceof Error ? e.message : e);
    return;
  }
  // Erster STATE-Push: Der Kern meldet seinen Anfangszustand nicht über onKurz.
  meldeZoomState();
  registriereKanaele(kern, d);
}

function registriereKanaele(k: ZoomKern, d: { getWindow: () => BrowserWindow | null; logDir: string }): void {
  ipcMain.handle(IPC.zoomGet, () => k.abbild());

  // Spec 6.1 „SDK-Ordner wählen“: Sperre S10 VOR dem Dialog; abgebrochen → nichts.
  ipcMain.handle(IPC.zoomSdkWaehlen, async (): Promise<ZoomErgebnis> => {
    const sperre = k.einrichtungSperre();
    if (!sperre.ok) return sperre;
    const ordner = await waehlePfad(d.getWindow, { properties: ['openDirectory'] });
    return ordner === null ? NICHTS : k.sdkWaehlen(ordner);
  });

  // „Zoom-SDK laden“ (Spec SDK nachladen 4.3): Sperre S10, Schlüssel S11 und Platz S5 prüft der Kern.
  ipcMain.handle(IPC.zoomSdkLaden, (): Promise<ZoomErgebnis> => k.sdkLaden());
  ipcMain.handle(IPC.zoomSdkLadenAbbrechen, (): void => k.sdkLadenAbbrechen());

  // Spec 6.1 „Zugangsdaten wählen“. Den Pfad merkt sich Connect nicht.
  ipcMain.handle(IPC.zoomZugangWaehlen, async (): Promise<ZoomErgebnis> => {
    const sperre = k.einrichtungSperre();
    if (!sperre.ok) return sperre;
    const datei = await waehlePfad(d.getWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Zugangsdaten', extensions: ['json'] }],
    });
    return datei === null ? NICHTS : k.zugangWaehlen(datei);
  });

  // Zugangsdaten von Hand: Form prüfen (kein Objekt, falsche Typen, über 512 Zeichen → stumm abgewiesen),
  // dann der Kern. Weder Antwort noch Log enthalten je einen Wert.
  ipcMain.handle(IPC.zoomZugangEintragen, (_e, p: unknown): ZoomErgebnis => {
    const e = pruefeZugangEingabe(p);
    return e === null ? NICHTS : k.zugangEintragen(e);
  });

  ipcMain.handle(IPC.zoomZugangLoeschen, (): ZoomErgebnis => k.zugangLoeschen());

  // SDK-Schlüssel (Spec SDK nachladen 4.2): Form prüfen (über 512 Zeichen, falsche Typen → stumm abgewiesen),
  // dann der Kern (Trimmen, S18, Sperre S10). Weder Antwort noch Log enthalten je den Wert.
  ipcMain.handle(IPC.zoomSdkSchluesselEintragen, (_e, p: unknown): ZoomErgebnis => {
    const e = pruefeSdkSchluesselEingabe(p);
    return e === null ? NICHTS : k.sdkSchluesselEintragen(e);
  });
  ipcMain.handle(IPC.zoomSdkSchluesselLoeschen, (): ZoomErgebnis => k.sdkSchluesselLoeschen());
  ipcMain.handle(IPC.zoomPruefen, (): Promise<ZoomErgebnis> => k.pruefen());

  // Der Kenncode kommt nur hier herein und geht nie zurück (Spec 5.5, 5.7).
  ipcMain.handle(IPC.zoomBeitreten, (_e, p: unknown): ZoomErgebnis | Promise<ZoomErgebnis> => {
    const nummer = feld(p, 'nummer');
    const kenncode = feld(p, 'kenncode');
    const anzeigename = feld(p, 'anzeigename');
    if (typeof nummer !== 'string' || typeof kenncode !== 'string' || typeof anzeigename !== 'string') return NICHTS;
    return k.beitreten({ nummer, kenncode, anzeigename });
  });

  ipcMain.handle(IPC.zoomVerlassen, async (): Promise<void> => {
    await k.verlassen();
  });

  // Spec 6.8: nur in Z11 wirksam (der Kern prüft den Zustand); Nummer, Kenncode und gemerkte Quellen bleiben.
  ipcMain.handle(IPC.zoomAbbrechen, (): void => k.abbrechen());

  ipcMain.handle(IPC.zoomLaden, (_e, p: unknown): ZoomErgebnis | Promise<ZoomErgebnis> => {
    const id = feld(p, 'id');
    const ton = feld(p, 'ton');
    const trotz = feld(p, 'trotzBetriebsgroesse');
    if (!ganzeZahl(id) || typeof ton !== 'boolean' || typeof trotz !== 'boolean') return NICHTS;
    return k.laden({ id, ton, trotzBetriebsgroesse: trotz });
  });

  ipcMain.handle(IPC.zoomEntladen, (_e, p: unknown): ZoomErgebnis | Promise<ZoomErgebnis> => {
    const aboId = feld(p, 'aboId');
    return ganzeZahl(aboId) ? k.entladen({ aboId }) : NICHTS;
  });

  ipcMain.handle(IPC.zoomTon, (_e, p: unknown): ZoomErgebnis => {
    const id = feld(p, 'id');
    const an = feld(p, 'an');
    return ganzeZahl(id) && typeof an === 'boolean' ? k.ton({ id, an }) : NICHTS;
  });

  ipcMain.handle(IPC.zoomSollVerwerfen, (_e, p: unknown): void => {
    const name = feld(p, 'name');
    if (typeof name === 'string') k.sollVerwerfen({ name });
  });

  // Ganzzahl und Bereich 0–1000 prüft der Kern (Q13); hier nur: ist es überhaupt eine Zahl?
  ipcMain.handle(IPC.zoomVersatz, (_e, p: unknown): ZoomErgebnis => {
    const ms = feld(p, 'ms');
    return typeof ms === 'number' ? k.versatz({ ms }) : NICHTS;
  });

  ipcMain.handle(IPC.zoomErneut, (): Promise<ZoomErgebnis> => k.erneut());
  ipcMain.handle(IPC.zoomSchliessen, (): void => k.schliessen());
  ipcMain.handle(IPC.zoomMeldungWeg, (): void => k.meldungWeg());

  // Mehrere Texte verweisen auf „Details im Log“ (Spec 8.7).
  ipcMain.handle(IPC.zoomLogordner, async (): Promise<void> => {
    const fehler = await shell.openPath(d.logDir);
    if (fehler) getLog().warn('[zoom] Logordner ließ sich nicht öffnen:', fehler);
  });
}

/** Kurzform für AppStatus (Tray, Kopfzeile); `null` ohne Kern (macOS). */
export function zoomKurz(): ZoomKurz | null {
  return kern ? kern.kurz() : null;
}

/** Kopie, Prüfung oder Bridge läuft (Spec 6.6: dann wartet before-quit auf zoomBeenden). */
export function zoomLaeuft(): boolean {
  return kern ? kern.laeuft() : false;
}

/** Verlässt das Meeting und baut ab, höchstens `fristMs` lang (Spec 6.6). Ohne Kern sofort erledigt. */
export function zoomBeenden(fristMs: number): Promise<void> {
  if (!kern) return Promise.resolve();
  return kern.beenden(fristMs).catch((e: unknown) => {
    getLog().error('[zoom] Beenden fehlgeschlagen:', e instanceof Error ? e.message : e);
  });
}

/** Tray „Zoom-Meeting verlassen“: wirkt immer als „Verlassen“ nach Spec 6.8. */
export function zoomVerlassen(): void {
  if (!kern) return;
  kern.verlassen().catch((e: unknown) => {
    getLog().error('[zoom] Verlassen fehlgeschlagen:', e instanceof Error ? e.message : e);
  });
}

/** Gast-Sender haben sich geändert: Kollisionsprüfung Gast ↔ Zoom neu rechnen (Spec 6.3). */
export function zoomGastLabelsGeaendert(): void {
  kern?.gastLabelsGeaendert();
}

/**
 * Fernsteuer-Verb zoom_* vom Steuerserver (Spec 11.2): geht an den Kern, nie an den Renderer oder den DO.
 * Ohne Kern (macOS) nur eine Logzeile und sonst nichts (L19). Die Logzeile nennt nur das Verb, nie die
 * Argumente, denn dort stehen Anzeigenamen (N4b.2).
 */
export function zoomSteuerbefehl(cmd: { verb: string; args: string[] }): void {
  if (!kern) {
    const grund = process.platform === 'win32' ? 'der Zoom-Kern ließ sich nicht anlegen' : 'Zoom gibt es nur unter Windows';
    getLog().info(`[zoom] Companion: ${cmd.verb} ignoriert (${grund})`);
    return;
  }
  try {
    kern.steuerbefehl({ verb: cmd.verb, args: [...cmd.args] });
  } catch (e) {
    getLog().error('[zoom] Fernsteuer-Befehl fehlgeschlagen:', e instanceof Error ? e.message : e);
  }
}
