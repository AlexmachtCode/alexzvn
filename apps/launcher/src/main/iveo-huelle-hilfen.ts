// Reine Helfer der iveo-Hülle (iveo-sync.ts), ohne Electron — testbar mit tsx
// (test/iveo-huelle.test.ts). Master-Link Teil 2a, Spec 7.0 und 7.5.
import { resolve } from 'node:path';
import type { IveoFetchLike, IveoFetchResponse } from '@jm/iveo';

/** Abfragetakt im Betrieb (Spec 7.0). */
export const IVEO_ABFRAGE_TAKT_MS = 45_000;
/** Kürzester Takt, den JMPS_IVEO_POLL_MS setzen darf — schützt iveo vor Dauerfeuer. */
export const IVEO_ABFRAGE_TAKT_MIN_MS = 500;
/** Zeitgrenze je Abruf (Spec 7.0). */
export const IVEO_ABRUF_ZEITGRENZE_MS = 15_000;

/**
 * Abfragetakt aus JMPS_IVEO_POLL_MS (nur für Tests, Spec 9.8). Eine Zahl von 500
 * bis 45000 verkürzt den Takt; alles andere (fehlt, keine Zahl, zu kurz, länger
 * als 45 s) lässt ihn bei 45 s — die Variable kann nur verkürzen.
 */
export function abfrageTakt(wert: string | undefined): number {
  if (!wert) return IVEO_ABFRAGE_TAKT_MS;
  const n = Math.trunc(Number(wert));
  if (!Number.isFinite(n) || n < IVEO_ABFRAGE_TAKT_MIN_MS || n > IVEO_ABFRAGE_TAKT_MS) return IVEO_ABFRAGE_TAKT_MS;
  return n;
}

/** fetch-Vertrag mit Abbruchsignal — der globale fetch erfüllt ihn. */
export type FetchMitSignal = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; redirect?: 'follow' | 'manual'; signal?: AbortSignal },
) => Promise<IveoFetchResponse>;

/**
 * Jeder Abruf bekommt sein eigenes Signal mit Zeitgrenze (Spec 7.0). Hängt iveo,
 * bricht der Abruf nach `ms` mit einem TimeoutError ab. Der Client wertet das wie
 * einen Netzfehler (Wiederholung, danach Fehler), statt die Abfrage ewig zu halten.
 */
export function mitZeitgrenze(f: FetchMitSignal, ms: number): IveoFetchLike {
  return (url, init) => f(url, { ...init, signal: AbortSignal.timeout(ms) });
}

/**
 * Meint `b` dieselbe Show-Datei wie `a`? Absolut aufgelöst und ohne Groß-/Klein-
 * schreibung verglichen (Windows-Pfade; wie der Gedächtnis-Schlüssel, Spec 4.7).
 */
export function gleicherShowPfad(a: string, b: string): boolean {
  return resolve(a).toLowerCase() === resolve(b).toLowerCase();
}
