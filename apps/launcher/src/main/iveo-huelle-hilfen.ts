// Reine Helfer der iveo-Hülle (iveo-sync.ts), ohne Electron — testbar mit tsx
// (test/iveo-huelle.test.ts). Master-Link Teil 2a, Spec 7.0, 7.5 und 7.6 (Log).
import { resolve } from 'node:path';
import type { IveoFetchLike, IveoFetchResponse } from '@jm/iveo';
import type { Show } from '@jm/show';
import { leseShowMitGrund } from './show-lesen';

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
  return showPfadSchluessel(a) === showPfadSchluessel(b);
}

function showPfadSchluessel(p: string): string {
  return resolve(p).toLowerCase();
}

/**
 * Spec 7.6 (Log): „Gleichbleibende Wiederholungen nicht, damit das Log nicht alle 45 s wächst.“ Eine Warnung, die
 * jede Abfrage erneut auslöst, kommt nur beim ersten Fehlschlag und bei einem Wechsel des Grunds ins Log.
 */
export interface WechselLog {
  /** Warnung `m` mit dem Grund `grund`. Derselbe Grund wie bei der letzten Warnung → nichts. */
  warn(grund: string, m: string): void;
  /** Erfolg: der nächste Fehlschlag kommt wieder ins Log. */
  ok(): void;
}

export function nurBeiWechsel(warn: (m: string) => void): WechselLog {
  let letzterGrund: string | null = null;
  return {
    warn(grund, m) {
      if (grund === letzterGrund) return;
      letzterGrund = grund;
      warn(m);
    },
    ok() {
      letzterGrund = null;
    },
  };
}

/**
 * Show-Leser für den Kern. Der Kern bekommt nur null; den Grund (Fehlercode bzw. „kein gültiges JSON“, nie Inhalt)
 * hält dieser Leser im Log fest — beim ersten Fehlschlag und bei einem Wechsel von Grund oder Datei, nicht bei jeder
 * Abfrage. Ein erfolgreiches Lesen setzt zurück.
 */
export function showLeserFuerKern(lies: (pfad: string) => string, meldung: WechselLog): (pfad: string) => Show | null {
  return (pfad) => {
    const r = leseShowMitGrund(pfad, lies);
    if (r.show) {
      meldung.ok();
      return r.show;
    }
    meldung.warn(`${showPfadSchluessel(pfad)}\n${r.grund}`, `iveo: Show-Datei nicht lesbar (${r.grund}).`);
    return null;
  };
}

/**
 * Show-Schreiber für den Kern. `schreibe` meldet seine Warnung (Fehlercode, Versuche) über `log`; ins Log kommt sie nur
 * beim ersten Fehlschlag und bei einem Wechsel. Ein erfolgreiches Schreiben setzt zurück.
 */
export function showSchreiberFuerKern(
  schreibe: (pfad: string, show: Show, log: (m: string) => void) => boolean,
  meldung: WechselLog,
): (pfad: string, show: Show) => boolean {
  return (pfad, show) => {
    const warnungen: string[] = [];
    const ok = schreibe(pfad, show, (m) => warnungen.push(m));
    if (ok) meldung.ok();
    for (const m of warnungen) meldung.warn(`${showPfadSchluessel(pfad)}\n${m}`, m);
    return ok;
  };
}
