// Persistierte Switcher-Einstellungen (localStorage). Geteilt zwischen dem
// Einstellungen-Tab und der Hauptansicht (Stream-Start-Button).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_CONTROL_PORT } from '@jm/companion-protocol';

// Aufloesung und Bitraten-Empfehlungen leben als reines Modul in @shared/output-quality
// (ohne zustand, damit der Selbsttest sie laden kann) und werden hier nur weitergereicht.
export { RESOLUTIONS, recommendedBitrate, type ProgramResolution } from '@shared/output-quality';
import type { ProgramResolution } from '@shared/output-quality';
export const OUTPUT_FPS_OPTIONS = [25, 30, 50, 60] as const;

export interface SettingsState {
  /** RTMP-Ziel (rtmp://server/app/streamkey). */
  rtmpUrl: string;
  /** Stream-Videobitrate in kbit/s (x264 -b:v). */
  streamBitrateKbps: number;
  /** Aufnahme-Videobitrate in kbit/s (MediaRecorder WebM). */
  recordBitrateKbps: number;
  /** TCP-Fernsteuerung (Companion) aktiv? */
  controlEnabled: boolean;
  /** Port des Steuerservers. */
  controlPort: number;
  /** Programm-Audioquelle (deviceId aus enumerateDevices) — '' = kein Ton. */
  audioInputId: string;
  /** Sichtbarer Name der NDI-Ausgabe (Program/Multiview als NDI-Quelle). */
  ndiOutputName: string;
  /** Was als NDI-Quelle ausgegeben wird: 'program' oder 'multiview'. */
  ndiOutputSource: 'program' | 'multiview';
  /** Auflösung, in der das Programm komponiert und ausgegeben wird (NDI/Aufnahme/RTMP). */
  programResolution: ProgramResolution;
  /** Bildrate der NDI-Ausgabe. */
  outputFps: number;
  /** Zweiter Bildschirm (Vollbild-Programm-Ausgabe auf einem Monitor) aktiv? */
  secondScreenEnabled: boolean;
  /** Ziel-Monitor (Electron display.id). 0 = noch keiner gewählt → Hauptmonitor. */
  secondScreenDisplayId: number;
  setRtmpUrl: (v: string) => void;
  setStreamBitrateKbps: (v: number) => void;
  setRecordBitrateKbps: (v: number) => void;
  setControlEnabled: (v: boolean) => void;
  setControlPort: (v: number) => void;
  setAudioInputId: (v: string) => void;
  setNdiOutputName: (v: string) => void;
  setNdiOutputSource: (v: 'program' | 'multiview') => void;
  setProgramResolution: (v: ProgramResolution) => void;
  setOutputFps: (v: number) => void;
  setSecondScreenEnabled: (v: boolean) => void;
  setSecondScreenDisplayId: (v: number) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      rtmpUrl: '',
      streamBitrateKbps: 4500,
      recordBitrateKbps: 12000,
      controlEnabled: false,
      controlPort: DEFAULT_CONTROL_PORT,
      audioInputId: '',
      ndiOutputName: 'JM Switcher',
      ndiOutputSource: 'program',
      programResolution: '1080p',
      outputFps: 25,
      secondScreenEnabled: false,
      secondScreenDisplayId: 0,
      setRtmpUrl: (rtmpUrl) => set({ rtmpUrl }),
      setStreamBitrateKbps: (streamBitrateKbps) =>
        set({ streamBitrateKbps: Math.min(20000, Math.max(500, Math.round(streamBitrateKbps) || 0)) }),
      setRecordBitrateKbps: (recordBitrateKbps) =>
        set({ recordBitrateKbps: Math.min(60000, Math.max(1000, Math.round(recordBitrateKbps) || 0)) }),
      setControlEnabled: (controlEnabled) => set({ controlEnabled }),
      setControlPort: (controlPort) =>
        set({ controlPort: Math.min(65535, Math.max(1, Math.round(controlPort) || DEFAULT_CONTROL_PORT)) }),
      setAudioInputId: (audioInputId) => set({ audioInputId }),
      setNdiOutputName: (ndiOutputName) => set({ ndiOutputName: ndiOutputName.slice(0, 64) }),
      setNdiOutputSource: (ndiOutputSource) => set({ ndiOutputSource }),
      setProgramResolution: (programResolution) => set({ programResolution }),
      setOutputFps: (outputFps) =>
        set({ outputFps: (OUTPUT_FPS_OPTIONS as readonly number[]).includes(outputFps) ? outputFps : 25 }),
      setSecondScreenEnabled: (secondScreenEnabled) => set({ secondScreenEnabled }),
      setSecondScreenDisplayId: (secondScreenDisplayId) => set({ secondScreenDisplayId }),
    }),
    { name: 'jmswitch-settings' },
  ),
);
