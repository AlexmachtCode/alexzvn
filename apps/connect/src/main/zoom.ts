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
import { zoomAktiv, zoomStateTeil } from './zoom/plattform';
import { pruefeSlotEingabe } from './zoom/slot-eingabe';
import { pruefeZugangEingabe } from './zoom/zugang-eingabe';
import { pruefeSdkSchluesselEingabe } from './zoom/sdk-schluessel-eingabe';
import { activeLabels } from './ndi-guests';
import { setZoomControlState } from './control-server';
import { aenderungsMelder } from './control-state';
import {
  einstellungsLage,
  proxyUrl,
  setzeZoomAnzeigename,
  setzeZoomLaufzeit,
  setzeZoomSlots,
  setzeZoomSlotsUeber5,
  setzeZoomSlotVorgaben,
  setzeZoomSprecher,
  setzeZoomVersatzMs,
  setzeZoomVorschau,
  zoomAnzeigename,
  zoomLetztesMeeting,
  zoomMeetingMerken,
  zoomMeetingVergessen,
  zoomSlots,
  zoomSlotsUeber5,
  zoomSlotVorgaben,
  zoomSprecher,
  zoomVorschau,
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
 * Zoom-Teil des STATE melden: die zoom_*-Werte aus kern.stateKv() über zoomStateTeil (Slot-Spec 7.11, 8.2). Läuft einmal
 * nach dem Anlegen des Kerns und danach bei jeder Änderung der Kurzform (onKurz), nicht bei jedem Abbild. Ohne Kern (macOS)
 * meldet niemand einen Zoom-Teil, dort fehlen die zoom_*-Schlüssel im STATE (Spec 7.5).
 */
function meldeZoomState(): void {
  if (!kern) return;
  meldeZoomTeil(zoomStateTeil(process.platform, kern.stateKv()));
}

function feld(p: unknown, name: string): unknown {
  return typeof p === 'object' && p !== null ? (p as Record<string, unknown>)[name] : undefined;
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
  if (kern || !zoomAktiv(process.platform)) return;
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
        letztesMeeting: zoomLetztesMeeting,
        meetingMerken: zoomMeetingMerken,
        meetingVergessen: zoomMeetingVergessen,
        // Zoom-Slots (Slot-Spec 7.2, 7.10; Plan B, Task B12): gelesen und geschrieben nur über settings.ts.
        slots: zoomSlots,
        setzeSlots: setzeZoomSlots,
        vorgaben: zoomSlotVorgaben,
        setzeVorgaben: setzeZoomSlotVorgaben,
        sprecher: zoomSprecher,
        setzeSprecher: setzeZoomSprecher,
        vorschau: zoomVorschau,
        setzeVorschau: setzeZoomVorschau,
        ueber5: zoomSlotsUeber5,
        setzeUeber5: setzeZoomSlotsUeber5,
        einstellungsLage,
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
      // Vorschau (Spec 7.7): jedes preview-Ereignis direkt als Push ans Fenster, nie über das Abbild, nie ins Log.
      onVorschau: (b) => {
        const w = d.getWindow();
        if (w && !w.isDestroyed()) w.webContents.send(IPC.zoomVorschauBild, b);
      },
      // GEP14: Der Kern entsteht vor dem Hauptfenster (index.ts), es gibt noch keins. verdrahteZoomFenster meldet jede
      // Änderung, sobald index.ts das Fenster angelegt hat.
      fensterSichtbar: false,
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

  // Die Kanäle zum Laden, Entladen, Ton-Umschalten und Vergessen entfallen (Spec 7.9, Plan B, Task B11); die Slot-Kanäle
  // kommen mit Task B20.

  // Zoom-Slots (Spec 7.9, 11.11 KF5): Die Hülle prüft jede Nutzlast nur mit pruefeSlotEingabe (rein, getestet) und gibt
  // das geprüfte Ergebnis unverändert an den Kern. Ungültig → NICHTS, der Kern wird nicht gerufen.
  ipcMain.handle(IPC.zoomSlotAnlegen, (_e, p: unknown) => {
    const e = pruefeSlotEingabe('anlegen', p);
    return e.ok ? k.slotAnlegen() : NICHTS;
  });
  ipcMain.handle(IPC.zoomSlotAendern, (_e, p: unknown) => {
    const e = pruefeSlotEingabe('aendern', p);
    return e.ok ? k.slotAendern(e.wert.nr, e.wert.aenderung) : NICHTS;
  });
  ipcMain.handle(IPC.zoomSlotLoeschen, (_e, p: unknown) => {
    const e = pruefeSlotEingabe('loeschen', p);
    return e.ok ? k.slotLoeschen(e.wert.nr) : NICHTS;
  });
  ipcMain.handle(IPC.zoomSlotStart, (_e, p: unknown) => {
    const e = pruefeSlotEingabe('start', p);
    return e.ok ? k.slotStart(e.wert.nr, e.wert.an, e.wert.trotz) : NICHTS;
  });
  ipcMain.handle(IPC.zoomSlotAusPerson, (_e, p: unknown) => {
    const e = pruefeSlotEingabe('ausPerson', p);
    return e.ok ? k.slotAusPerson(e.wert.teilnehmerId, e.wert.trotz) : NICHTS;
  });
  ipcMain.handle(IPC.zoomSlotPerson, (_e, p: unknown) => {
    const e = pruefeSlotEingabe('person', p);
    return e.ok ? k.slotPersonWaehlen(e.wert.nr, e.wert.teilnehmerId) : NICHTS;
  });
  ipcMain.handle(IPC.zoomSlotVorgaben, (_e, p: unknown) => {
    const e = pruefeSlotEingabe('vorgaben', p);
    return e.ok ? k.vorgabenSetzen(e.wert) : NICHTS;
  });
  ipcMain.handle(IPC.zoomSprecher, (_e, p: unknown) => {
    const e = pruefeSlotEingabe('sprecher', p);
    return e.ok ? k.sprecherSetzen(e.wert) : NICHTS;
  });
  ipcMain.handle(IPC.zoomVorschauSchalten, (_e, p: unknown) => {
    const e = pruefeSlotEingabe('vorschau', p);
    return e.ok ? k.vorschauSetzen(e.wert.an) : NICHTS;
  });
  ipcMain.handle(IPC.zoomMesswerteText, (_e, p: unknown) => {
    const e = pruefeSlotEingabe('messwerte', p);
    return e.ok ? k.messwerteText() : '';
  });
  ipcMain.handle(IPC.zoomSlotBehalten, (_e, p: unknown) => {
    const e = pruefeSlotEingabe('behalten', p);
    return e.ok ? k.slotBehalten(e.wert.nr) : NICHTS;
  });

  // Ganzzahl und Bereich 0–1000 prüft der Kern (Q13); hier nur: ist es überhaupt eine Zahl?
  ipcMain.handle(IPC.zoomVersatz, (_e, p: unknown): ZoomErgebnis => {
    const ms = feld(p, 'ms');
    return typeof ms === 'number' ? k.versatz({ ms }) : NICHTS;
  });

  ipcMain.handle(IPC.zoomErneut, (): Promise<ZoomErgebnis> => k.erneut());
  ipcMain.handle(IPC.zoomSchliessen, (): void => k.schliessen());
  // Das gemerkte Meeting (#290): nur Nummer und zwei Flaggen, nie der Kenncode.
  ipcMain.handle(IPC.zoomLetztesMeeting, () => k.letztesMeeting());
  ipcMain.handle(IPC.zoomVergessen, (): void => k.vergessen());
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

/**
 * Fensterzustand für die Vorschau (Spec 7.7 „Fenster“, GEP14): sichtbar heißt gezeigt und nicht minimiert. index.ts ruft das
 * für jedes neu angelegte Hauptfenster; jedes der fünf Ereignisse und der Aufruf selbst melden den Zustand an den Kern
 * (previewMode schickt der Kern nur bei einer Änderung, B16). Ohne Kern (macOS) wirkungslos.
 */
export function verdrahteZoomFenster(win: BrowserWindow): void {
  const melde = (): void => {
    kern?.fensterSichtbar(!win.isDestroyed() && win.isVisible() && !win.isMinimized());
  };
  win.on('show', melde);
  win.on('hide', melde);
  win.on('minimize', melde);
  win.on('restore', melde);
  win.on('ready-to-show', melde);
  melde();
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

/** Gast-Sender haben sich geändert: Abbild neu senden (die NDI-Namensprüfung gegen Gast-Namen liest gastLabels, Slot-Spec T46). */
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
    const grund = zoomAktiv(process.platform) ? 'der Zoom-Kern ließ sich nicht anlegen' : 'Zoom gibt es nur unter Windows';
    getLog().info(`[zoom] Companion: ${cmd.verb} ignoriert (${grund})`);
    return;
  }
  try {
    kern.steuerbefehl({ verb: cmd.verb, args: [...cmd.args] });
  } catch (e) {
    getLog().error('[zoom] Fernsteuer-Befehl fehlgeschlagen:', e instanceof Error ? e.message : e);
  }
}
