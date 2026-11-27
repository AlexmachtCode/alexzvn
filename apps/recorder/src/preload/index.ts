import { contextBridge, ipcRenderer } from 'electron';
import type { MasterLinkMeldung } from '@jm/app-runtime';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type {
  ArmInput,
  AudioDevice,
  GeladeneEinstellungen,
  JmrecApi,
  Levels,
  OpResult,
  PresetDateiErgebnis,
  RecorderRemoteCommand,
  RecordInput,
  RecordResult,
  RecorderState,
  RecEinstellungen,
  RecPreset,
  RecShowSettings,
  ScheduleInput,
} from '@shared/types';

/** Altfehler RE-7a, Fix-Runde 1: die zuletzt gemeldete Lage der Rückfrage beim Schließen und ihre Hörer (siehe onSchliessenFrage). */
let letzteFrage = false;
const frageHoerer = new Set<(offen: boolean) => void>();
ipcRenderer.on('recorder:schliessenFrage', (_e: unknown, offen: boolean): void => {
  letzteFrage = offen;
  for (const cb of frageHoerer) cb(offen);
});

const api: JmrecApi = {
  platform: process.platform,
  // UX Welle 2a (Spec 3.9): Master-Link-Zustand lesend. null, solange die Brücke fehlt oder ablehnt (Statusleiste: unbekannt).
  masterLink: () => (ipcRenderer.invoke('jmps:master-link') as Promise<MasterLinkMeldung>).catch(() => null),
  onMasterLink: (cb) => {
    const listener = (_e: unknown, m: MasterLinkMeldung): void => cb(m);
    ipcRenderer.on('jmps:master-link', listener);
    return () => ipcRenderer.off('jmps:master-link', listener);
  },
  // Meldung des Steuerservers lesend (Port, läuft, Clients, Modus, Startfehler). null, solange Main nichts gemeldet hat.
  fernsteuerung: () => (ipcRenderer.invoke('recorder:fernsteuerung') as Promise<FernsteuerungMeldung | null>).catch(() => null),
  onFernsteuerung: (cb) => {
    const listener = (_e: unknown, m: FernsteuerungMeldung | null): void => cb(m);
    ipcRenderer.on('recorder:fernsteuerung', listener);
    return () => ipcRenderer.off('recorder:fernsteuerung', listener);
  },
  listDevices: () => ipcRenderer.invoke('rec:listDevices') as Promise<AudioDevice[]>,
  arm: (input: ArmInput) => ipcRenderer.invoke('rec:arm', input) as Promise<OpResult>,
  disarm: () => ipcRenderer.invoke('rec:disarm') as Promise<OpResult>,
  startRecording: (input: RecordInput) => ipcRenderer.invoke('rec:start', input) as Promise<OpResult>,
  stopRecording: () => ipcRenderer.invoke('rec:stop') as Promise<RecordResult>,
  schedule: (input: ScheduleInput) => ipcRenderer.invoke('rec:schedule', input) as Promise<OpResult>,
  cancelSchedule: () => ipcRenderer.invoke('rec:cancelSchedule') as Promise<void>,
  getState: () => ipcRenderer.invoke('rec:state') as Promise<RecorderState>,
  setGain: (db: number) => ipcRenderer.invoke('rec:setGain', db) as Promise<void>,
  dialog: {
    pickDir: () => ipcRenderer.invoke('dialog:pickDir') as Promise<string | null>,
  },
  shell: {
    reveal: (p) => ipcRenderer.invoke('shell:reveal', p) as Promise<void>,
  },
  onLevels: (cb) => {
    const listener = (_e: unknown, l: Levels): void => cb(l);
    ipcRenderer.on('recorder:levels', listener);
    return () => ipcRenderer.off('recorder:levels', listener);
  },
  onState: (cb) => {
    const listener = (_e: unknown, s: RecorderState): void => cb(s);
    ipcRenderer.on('recorder:state', listener);
    return () => ipcRenderer.off('recorder:state', listener);
  },
  onNotice: (cb) => {
    const listener = (_e: unknown, msg: string): void => cb(msg);
    ipcRenderer.on('recorder:notice', listener);
    return () => ipcRenderer.off('recorder:notice', listener);
  },
  onRemoteCommand: (cb) => {
    const listener = (_e: unknown, cmd: RecorderRemoteCommand): void => cb(cmd);
    ipcRenderer.on('recorder:remote-cmd', listener);
    return () => ipcRenderer.off('recorder:remote-cmd', listener);
  },
  takeShowSettings: () =>
    ipcRenderer.invoke('rec:takeShowSettings') as Promise<RecShowSettings | null>,
  onShowSettings: (cb) => {
    const listener = (_e: unknown, s: RecShowSettings): void => cb(s);
    ipcRenderer.on('recorder:show-settings', listener);
    return () => ipcRenderer.off('recorder:show-settings', listener);
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load') as Promise<GeladeneEinstellungen>,
    save: (e: RecEinstellungen) => ipcRenderer.send('settings:save', e),
  },
  presets: {
    list: () => ipcRenderer.invoke('presets:list') as Promise<RecPreset[]>,
    speichern: (p: RecPreset) => ipcRenderer.invoke('presets:speichern', p) as Promise<RecPreset[]>,
    loeschen: (name: string) => ipcRenderer.invoke('presets:loeschen', name) as Promise<RecPreset[]>,
    exportieren: () => ipcRenderer.invoke('presets:exportieren') as Promise<PresetDateiErgebnis>,
    importieren: () => ipcRenderer.invoke('presets:importieren') as Promise<PresetDateiErgebnis>,
  },
  ordnerDa: (dir: string) => ipcRenderer.invoke('fs:ordnerDa', dir) as Promise<boolean>,
  // B6 (Altfehler RE-2, RE-2b, RE-7b): ein abgelehnter Fernbefehl geht mit Hinweis und Logzeile an den Main.
  ablehnung: (a) => ipcRenderer.invoke('recorder:ablehnung', a) as Promise<void>,
  // Altfehler RE-7b: „Übernehmen“ eines Netzwerkordners aus der Show; der Main merkt ihn.
  netzordnerBestaetigen: (pfad) => ipcRenderer.invoke('recorder:netzordnerBestaetigen', pfad) as Promise<boolean>,
  // Altfehler RE-7a: Rückfrage beim Schließen während einer Aufnahme (der Main stellt und schließt sie, das Fenster zeigt und beantwortet).
  // Fix-Runde 1: der Preload hört ab dem Laden mit; ein Abo, das erst später kommt (der Store abonniert in init, nach dem Laden), bekommt
  // eine offene Frage sofort. Nach einem Neuladen geht die erneut gestellte Frage so nicht verloren.
  onSchliessenFrage: (cb) => {
    frageHoerer.add(cb);
    if (letzteFrage) cb(true);
    return () => frageHoerer.delete(cb);
  },
  schliessenAntwort: (a) => {
    if (a !== 'gezeigt') letzteFrage = false;
    return ipcRenderer.invoke('recorder:schliessenAntwort', a) as Promise<void>;
  },
  // Altfehler RE-PLATZ: freier Platz im Zielordner (Byte), null = nicht lesbar.
  platz: (dir) => ipcRenderer.invoke('fs:platz', dir) as Promise<number | null>,
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmrec', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmrec = api;
}
