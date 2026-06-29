import { usToSec } from '@shared/project';

/** µs → "MM:SS.cc" (Timecode mit Hundertstel). */
export function formatTimecode(us: number): string {
  const sec = Math.max(0, usToSec(us));
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cc = Math.floor((sec - Math.floor(sec)) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cc).padStart(2, '0')}`;
}

/** µs → "M:SS" (kompakt für Clip-Beschriftungen). */
export function formatShort(us: number): string {
  const sec = Math.max(0, usToSec(us));
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Linearer Gain → dB-Text fürs Fader-Label. */
export function formatDb(gain: number): string {
  if (gain <= 0) return '−∞';
  const db = 20 * Math.log10(gain);
  if (db >= 0) return `+${db.toFixed(1)}`;
  return db.toFixed(1);
}

/** Lineare Spitze (0..1) → dBFS-Text. */
export function formatDbfs(peak: number): string {
  if (peak <= 0) return '−∞';
  return `${(20 * Math.log10(peak)).toFixed(0)}`;
}

/** Pegel-Einheit der Meter-Anzeige. */
export type MeterUnit = 'dbfs' | 'dbu';

/**
 * Digital↔analoge Bezugsausrichtung (EBU R68): 0 dBFS = +18 dBu.
 * Damit lässt sich die dBFS-Spitze als dBu darstellen (Studio-Üblichkeit).
 */
export const DBU_REF = 18;

/** Lineare Spitze (0..1) → Pegel-Text in der gewählten Einheit (ohne Suffix). */
export function formatMeterPeak(peak: number, unit: MeterUnit): string {
  if (peak <= 0) return '−∞';
  const dbfs = 20 * Math.log10(peak);
  if (unit === 'dbu') {
    const dbu = dbfs + DBU_REF;
    return `${dbu >= 0 ? '+' : ''}${dbu.toFixed(0)}`;
  }
  return `${dbfs.toFixed(0)}`;
}

/** Suffix für die gewählte Einheit. */
export function meterUnitLabel(unit: MeterUnit): string {
  return unit === 'dbu' ? 'dBu' : 'dBFS';
}

/** Pan (-1..+1) → Orientierungstext: L100 … 0 … R100. */
export function formatPan(pan: number): string {
  const v = Math.round(pan * 100);
  if (v === 0) return '0';
  return v < 0 ? `L${-v}` : `R${v}`;
}
