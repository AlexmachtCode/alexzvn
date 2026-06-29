import { contextBridge, ipcRenderer } from 'electron';
import type {
  ArmInput,
  AudioDevice,
  JmrecApi,
  Levels,
  OpResult,
  RecorderRemoteCommand,
  RecordInput,
  RecordResult,
  RecorderState,
  ScheduleInput,
} from '@shared/types';

const api: JmrecApi = {
  platform: process.platform,
  listDevices: () => ipcRenderer.invoke('rec:listDevices') as Promise<AudioDevice[]>,
  arm: (input: ArmInput) => ipcRenderer.invoke('rec:arm', input) as Promise<OpResult>,
  disarm: () => ipcRenderer.invoke('rec:disarm') as Promise<void>,
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
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmrec', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmrec = api;
}
