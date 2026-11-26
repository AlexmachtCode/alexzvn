// Freier Platz als Restzeit in der Statusleiste (Altfehler RE-PLATZ; B5, Pre-flight G15; Owner 26.11. 12:13, Variante A). Rein: kein
// window, kein IPC, kein Store. Der Recorder schreibt immer 32-bit Float (4 Byte je Wert, main/wav.ts); mit „Spuren einzeln“ und mehr als
// einem Kanal kommt je Kanal eine Mono-Datei dazu, also dieselbe Menge noch einmal. Gelb unter 15 min, rot unter 5 min; gesperrt wird nie,
// denn eine falsche Schätzung darf keine nötige Aufnahme verhindern. Lässt sich der Platz nicht lesen, steht „Platz unbekannt“ da.
// Relative Importe: der Store lädt dieses Modul, und sein Test läuft unter tsx ohne Aliase.
import { unbekannt, type StatusItem } from '@jm/ui';
import type { RecorderState } from '../../../shared/types';

/** Takt der Abfrage im Fenster (B5); dazu fragt der Store sofort bei jedem Wechsel von Ordner, Format, Spuren oder Status. */
export const PLATZ_TAKT_MS = 5000;

/** Ab hier warn (unter 15 min), ab hier error (unter 5 min). */
const GELB_SEK = 900;
const ROT_SEK = 300;

/** Texte des Eintrags (RECORDER_TEXTE.platz verweist hierher, K4). Die Statusleiste zeigt Titel und Detail: „Platz für 2 h 10 min“. */
export const PLATZ_TEXTE = {
  titel: 'Platz',
  fuer: (h: number, m: number): string => (h === 0 ? `für ${m} min` : `für ${h} h ${m} min`),
  unterMinute: 'für unter 1 min',
  voll: 'voll',
  keinOrdner: 'kein Zielordner',
} as const;

/** Byte je Sekunde: Kanäle × Samplerate × 4 (32-bit Float), × 2 mit „Spuren einzeln“ bei mehr als einem Kanal. */
export function bytesProSekunde(f: { kanaele: number; rate: number; spuren: boolean }): number {
  return f.kanaele * f.rate * 4 * (f.spuren && f.kanaele > 1 ? 2 : 1);
}

/**
 * Ordner, dessen Platz zählt: in der Aufnahme der Ordner der Datei (`filePath`, Trenner `\` und `/`; Laufwerks- und Freigabewurzel mit
 * Trenner, wie statfs sie braucht), denn der Zielordner des Stores kann sich seit dem Start geändert haben; sonst der Zielordner.
 */
export function platzOrdner(z: RecorderState | undefined, dir: string | null): string | null {
  if (z?.status !== 'recording' || !z.filePath) return dir;
  const p = z.filePath;
  const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'));
  if (i < 0) return dir;
  const ordner = p.slice(0, i);
  const wurzel = ordner === '' || /^[A-Za-z]:$/.test(ordner) || /^[\\/]{2}[^\\/]+[\\/][^\\/]+$/.test(ordner);
  return wurzel ? p.slice(0, i + 1) : ordner;
}

/** Restzeit in ganzen Sekunden; ohne Datenrate (0) gibt es keine Zahl. */
export function restzeitSek(frei: number, bps: number): number {
  return bps > 0 ? Math.floor(frei / bps) : Number.NaN;
}

/**
 * Der Eintrag „Platz“ (Pre-flight G15): noch keine Antwort → „Platz unbekannt“; kein Zielordner → „kein Zielordner“; kein Messwert →
 * „Platz unbekannt“; sonst die Restzeit, ab 900 s ok, darunter warn, unter 300 s error, 0 Byte „voll“. Gruppe ausgabe, ein Klick öffnet das
 * Panel Ziel (`settingsSection` = ABSCHNITT.ziel).
 */
export function platzEintrag(frei: number | null | undefined, bps: number, ordner: string | null): StatusItem {
  const T = PLATZ_TEXTE;
  const kopf = { id: 'platz', group: 'ausgabe', label: T.titel, settingsSection: 'ziel' } as const;
  if (frei === undefined) return unbekannt(kopf);
  if (ordner === null) return { ...kopf, state: 'off', detail: T.keinOrdner };
  if (frei === null) return unbekannt(kopf);
  if (frei <= 0) return { ...kopf, state: 'error', detail: T.voll };
  const sek = restzeitSek(frei, bps);
  if (!Number.isFinite(sek)) return unbekannt(kopf);
  const stufe = sek < ROT_SEK ? 'error' : sek < GELB_SEK ? 'warn' : 'ok';
  const detail = sek < 60 ? T.unterMinute : T.fuer(Math.floor(sek / 3600), Math.floor((sek % 3600) / 60));
  return { ...kopf, state: stufe, detail };
}
