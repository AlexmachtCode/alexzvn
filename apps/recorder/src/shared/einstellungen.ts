import type { AudioDevice, GemerkterEingang, RecEinstellungen } from './types';

const GAIN_MIN = -12;
const GAIN_MAX = 24;

function zahl(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/**
 * Gelesene Einstellungen prüfen (#291): Nur Felder mit passendem Typ kommen durch, Zahlen in
 * ihren Grenzen. Alles andere fällt still weg — der Recorder nimmt dann seine Vorgabe.
 */
export function normiereEinstellungen(raw: unknown): RecEinstellungen {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const e: RecEinstellungen = {};

  const eg = r.eingang as Record<string, unknown> | undefined;
  if (eg && typeof eg === 'object' && typeof eg.name === 'string' && eg.name && typeof eg.hostApiName === 'string') {
    e.eingang = { name: eg.name, hostApiName: eg.hostApiName };
  }
  const ch = zahl(r.channels);
  if (ch !== undefined) e.channels = Math.max(1, Math.floor(ch));
  const sr = zahl(r.sampleRate);
  if (sr !== undefined && sr >= 8000 && sr <= 384000) e.sampleRate = Math.floor(sr);
  if (typeof r.dir === 'string' && r.dir) e.dir = r.dir;
  if (typeof r.fileName === 'string') e.fileName = r.fileName.slice(0, 200);
  if (typeof r.separateTracks === 'boolean') e.separateTracks = r.separateTracks;
  const g = zahl(r.gainDb);
  if (g !== undefined) e.gainDb = Math.max(GAIN_MIN, Math.min(GAIN_MAX, Math.round(g)));
  const d = zahl(r.scheduleDurationMin);
  if (d !== undefined) e.scheduleDurationMin = Math.max(0, Math.floor(d));
  return e;
}

/**
 * Gemerkten Eingang in der aktuellen Geräteliste wiederfinden. Name UND Treiber (hostApiName)
 * müssen stimmen: derselbe Name steht unter MME, WASAPI usw. mehrfach in der Liste. Die
 * PortAudio-Nummer zählt nicht — sie verschiebt sich, sobald ein Gerät dazukommt.
 */
export function findeEingang(devices: AudioDevice[], e: GemerkterEingang): AudioDevice | null {
  return devices.find((d) => d.name === e.name && d.hostApiName === e.hostApiName) ?? null;
}
