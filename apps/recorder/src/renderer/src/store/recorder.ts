import { create } from 'zustand';
import type { AudioDevice, RecorderState } from '@shared/types';

const IDLE: RecorderState = {
  status: 'idle',
  device: null,
  channels: 0,
  sampleRate: 0,
  filePath: null,
  recordedSec: 0,
};

const GAIN_KEY = 'jmrec.gainDb';
const GAIN_MIN = -12;
const GAIN_MAX = 24;
function clampGain(db: number): number {
  return Math.max(GAIN_MIN, Math.min(GAIN_MAX, Math.round(Number.isFinite(db) ? db : 0)));
}
function loadGain(): number {
  try {
    return clampGain(Number(localStorage.getItem(GAIN_KEY)));
  } catch {
    return 0;
  }
}

interface RecStore {
  devices: AudioDevice[];
  deviceIndex: number | null;
  channels: number;
  sampleRate: number;
  dir: string | null;
  fileName: string;
  separateTracks: boolean;
  /** Geplante Startzeit als datetime-local-Wert; '' = sofort starten. */
  scheduleStart: string;
  /** Auto-Stopp nach N Minuten; 0 = bis zum manuellen Stopp. */
  scheduleDurationMin: number;
  /** Aufnahme-Verstärkung in dB (#94), persistiert in localStorage. */
  gainDb: number;
  state: RecorderState;
  peaks: number[];
  notice: string | null;
  loading: boolean;

  init: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  selectDevice: (index: number) => void;
  setChannels: (n: number) => void;
  setSampleRate: (n: number) => void;
  setFileName: (s: string) => void;
  setSeparateTracks: (v: boolean) => void;
  setScheduleStart: (s: string) => void;
  setScheduleDurationMin: (n: number) => void;
  setGain: (db: number) => void;
  pickDir: () => Promise<void>;
  arm: () => Promise<void>;
  disarm: () => Promise<void>;
  record: () => Promise<void>;
  stop: () => Promise<void>;
  schedule: () => Promise<void>;
  cancelSchedule: () => Promise<void>;
  setNotice: (s: string | null) => void;
}

let subscribed = false;

export const useRec = create<RecStore>((set, get) => ({
  devices: [],
  deviceIndex: null,
  channels: 2,
  sampleRate: 48000,
  dir: null,
  fileName: '',
  separateTracks: false,
  scheduleStart: '',
  scheduleDurationMin: 0,
  gainDb: loadGain(),
  state: IDLE,
  peaks: [],
  notice: null,
  loading: true,

  setNotice: (notice) => set({ notice }),

  init: async () => {
    if (!subscribed) {
      subscribed = true;
      window.jmrec.onLevels((l) => set({ peaks: l.peaks }));
      window.jmrec.onState((s) => set({ state: s }));
      window.jmrec.onNotice((msg) => set({ notice: msg }));
      // Persistierten Gain in den Main spiegeln (Main startet bei 0 dB).
      void window.jmrec.setGain(get().gainDb);
      // TCP-Fernsteuerung (Companion): Befehle auf die Store-Aktionen abbilden.
      window.jmrec.onRemoteCommand((cmd) => {
        const s = get();
        switch (cmd.t) {
          case 'record':
            if (cmd.mode === 'off') void s.stop();
            else if (cmd.mode === 'on') void s.record();
            else s.state.status === 'recording' ? void s.stop() : void s.record();
            break;
          case 'arm':
            void s.arm();
            break;
          case 'disarm':
            void s.disarm();
            break;
        }
      });
    }
    await get().refreshDevices();
    set({ loading: false });
  },

  refreshDevices: async () => {
    try {
      const devices = await window.jmrec.listDevices();
      set({ devices });
      // Vorauswahl: bevorzugt ein ASIO-/Dante-Gerät, sonst das erste.
      if (get().deviceIndex == null && devices.length) {
        const preferred =
          devices.find((d) => /dante/i.test(d.name)) ??
          devices.find((d) => /asio/i.test(d.hostApiName)) ??
          devices[0];
        get().selectDevice(preferred.index);
      }
    } catch (e) {
      set({ notice: (e as Error).message });
    }
  },

  selectDevice: (index) => {
    const d = get().devices.find((x) => x.index === index);
    if (!d) return;
    set({
      deviceIndex: index,
      channels: Math.min(d.maxInputChannels, 2) || 1,
      sampleRate: d.defaultSampleRate || 48000,
    });
  },
  setChannels: (n) => set({ channels: Math.max(1, Math.floor(n) || 1) }),
  setSampleRate: (n) => set({ sampleRate: Math.max(8000, Math.floor(n) || 48000) }),
  setFileName: (fileName) => set({ fileName }),
  setSeparateTracks: (separateTracks) => set({ separateTracks }),
  setScheduleStart: (scheduleStart) => set({ scheduleStart }),
  setScheduleDurationMin: (scheduleDurationMin) =>
    set({ scheduleDurationMin: Math.max(0, Math.floor(scheduleDurationMin) || 0) }),

  setGain: (db) => {
    const gainDb = clampGain(db);
    set({ gainDb });
    try {
      localStorage.setItem(GAIN_KEY, String(gainDb));
    } catch {
      // localStorage nicht verfügbar → nur In-Memory
    }
    void window.jmrec.setGain(gainDb);
  },

  pickDir: async () => {
    const dir = await window.jmrec.dialog.pickDir();
    if (dir) set({ dir });
  },

  arm: async () => {
    const { deviceIndex, channels, sampleRate } = get();
    if (deviceIndex == null) {
      set({ notice: 'Kein Eingang gewählt.' });
      return;
    }
    const res = await window.jmrec.arm({ device: deviceIndex, channels, sampleRate });
    if (!res.ok) set({ notice: res.error ?? 'Eingang konnte nicht geöffnet werden.' });
  },

  disarm: async () => {
    await window.jmrec.disarm();
    set({ peaks: [] });
  },

  record: async () => {
    let dir = get().dir;
    if (!dir) {
      await get().pickDir();
      dir = get().dir;
      if (!dir) return;
    }
    const res = await window.jmrec.startRecording({
      dir,
      fileName: get().fileName,
      separateTracks: get().separateTracks,
    });
    if (!res.ok) set({ notice: res.error ?? 'Aufnahme konnte nicht gestartet werden.' });
  },

  stop: async () => {
    const res = await window.jmrec.stopRecording();
    if (res.ok && res.filePath) {
      set({ notice: `Gespeichert: ${res.filePath}` });
    } else if (!res.ok) {
      set({ notice: res.error ?? 'Stopp fehlgeschlagen.' });
    }
  },

  schedule: async () => {
    let dir = get().dir;
    if (!dir) {
      await get().pickDir();
      dir = get().dir;
      if (!dir) return;
    }
    const { scheduleStart, scheduleDurationMin } = get();
    // datetime-local liefert lokale Zeit ohne Zone — new Date(...) interpretiert sie lokal.
    const startMs = scheduleStart ? new Date(scheduleStart).getTime() : null;
    if (scheduleStart && (startMs == null || Number.isNaN(startMs))) {
      set({ notice: 'Ungültige Startzeit.' });
      return;
    }
    const base = startMs ?? Date.now();
    const stopMs = scheduleDurationMin > 0 ? base + scheduleDurationMin * 60_000 : null;
    const res = await window.jmrec.schedule({
      dir,
      fileName: get().fileName,
      separateTracks: get().separateTracks,
      startAt: startMs,
      stopAt: stopMs,
    });
    if (!res.ok) set({ notice: res.error ?? 'Planung fehlgeschlagen.' });
  },

  cancelSchedule: async () => {
    await window.jmrec.cancelSchedule();
  },
}));
