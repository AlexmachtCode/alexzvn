// Gedächtnis des Rundowns je Show-Datei (Spec 4.7, 4.8, 5.2) — die Dateiebene.
//
// Bewusst OHNE Electron: Ordner (`<userData>/regie`) und userData-Pfad kommen als
// Argument. So prüft test/gedaechtnis.test.ts das Modul mit
// `node --experimental-strip-types` auf einem Temp-Ordner. Die relativen Importe
// unten haben keine Endung; im Build löst electron-vite sie auf, im Test der Hook
// test/resolve-ts.mjs. Deshalb hier keine `@shared/…`-Aliase.
import { createHash } from 'node:crypto';
import {
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { hatEigeneTimerListe, migrateShow, type Show } from '@jm/show';
import { ersatzSchluessel } from '../shared/abgleich';
import { newId } from '../shared/conductor';
import { migrate } from '../shared/doc-format';
import type { DateiStand, GedaechtnisInhalt } from '../shared/ausgangsstand';

/** Unterordner in userData für Gedächtnis und Zeiger (4.7). */
export const REGIE_ORDNER = 'regie';
const ZEIGER_DATEI = 'zuletzt.json';
const AUTOSAVE_DATEI = 'rundown.autosave.jmrundown';
const AUTOSAVE_V1_DATEI = 'rundown.autosave.v1.jmrundown';
/** Windows: Umbenennen scheitert kurz, solange ein anderer Prozess die Datei offen hat. */
const WIEDERHOLBAR = new Set(['EPERM', 'EBUSY', 'EACCES']);

function fehlerCode(e: unknown): string {
  return (e as NodeJS.ErrnoException | null)?.code ?? 'EIO';
}

function schlafeSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Zwischendatei im selben Ordner schreiben, dann umbenennen. Scheitert das
 * Umbenennen an einer Windows-Sperre, bis zu 5 Versuche im Abstand von 50 ms
 * (wie Spec 7.4). Scheitert alles: Zwischendatei weg, false.
 */
function schreibeAtomar(ziel: string, inhalt: string): boolean {
  const zwischen = `${ziel}.${process.pid}.${Date.now()}.tmp`;
  try {
    mkdirSync(dirname(ziel), { recursive: true });
    writeFileSync(zwischen, inhalt, 'utf8');
  } catch {
    try {
      unlinkSync(zwischen);
    } catch {
      /* gab es nie */
    }
    return false;
  }
  for (let versuch = 1; ; versuch++) {
    try {
      renameSync(zwischen, ziel);
      return true;
    } catch (e) {
      if (!WIEDERHOLBAR.has(fehlerCode(e)) || versuch >= 5) {
        try {
          unlinkSync(zwischen);
        } catch {
          /* schon weg */
        }
        return false;
      }
      schlafeSync(50);
    }
  }
}

/**
 * Schlüssel des Gedächtnisses einer Show (4.7): die ersten 16 Hex-Zeichen von
 * SHA-256 über den mit `path.resolve` normalisierten, kleingeschriebenen Pfad.
 */
export function gedaechtnisSchluessel(showPfad: string): string {
  return createHash('sha256').update(resolve(showPfad).toLowerCase()).digest('hex').slice(0, 16);
}

function pruefeDateiStand(v: unknown): DateiStand | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.pfad !== 'string' || !o.pfad) return null;
  if (typeof o.mtimeMs !== 'number' || !Number.isFinite(o.mtimeMs)) return null;
  if (typeof o.groesse !== 'number' || !Number.isFinite(o.groesse)) return null;
  if (typeof o.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(o.sha256)) return null;
  return { pfad: o.pfad, mtimeMs: o.mtimeMs, groesse: o.groesse, sha256: o.sha256 };
}

function pruefeGedaechtnis(roh: unknown): GedaechtnisInhalt | null {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return null;
  const o = roh as Record<string, unknown>;
  if (o.schemaVersion !== 2 || typeof o.showPfad !== 'string' || !o.showPfad) return null;
  if (!o.doc || typeof o.doc !== 'object') return null;
  const datei = pruefeDateiStand(o.datei);
  return {
    schemaVersion: 2,
    showPfad: o.showPfad,
    showName: typeof o.showName === 'string' ? o.showName : '',
    doc: migrate(o.doc, newId),
    scharfId: typeof o.scharfId === 'string' ? o.scharfId : null,
    gespeichertAm: typeof o.gespeichertAm === 'string' ? o.gespeichertAm : '',
    ...(datei ? { datei } : {}),
  };
}

/**
 * Gedächtnis `<ordner>/<schlüssel>.json` lesen. Fehlt es: `{ inhalt: null }`.
 * Kaputt oder fremd: `inhalt: null` plus Fehlerart ('kein-json', 'unlesbar'); die
 * Datei bleibt liegen (Review-Focus 2). Scheitert schon das Lesen (EBUSY, EPERM,
 * EACCES, EIO …), ist das KEIN Inhaltsfehler: `fehler: 'io'`. Die Parser-Meldung wird nie weitergegeben (G6).
 */
export function leseGedaechtnis(
  ordner: string,
  schluessel: string,
): { inhalt: GedaechtnisInhalt | null; fehler?: 'kein-json' | 'unlesbar' | 'io' } {
  let text: string;
  try {
    text = readFileSync(join(ordner, `${schluessel}.json`), 'utf8');
  } catch (e) {
    return fehlerCode(e) === 'ENOENT' ? { inhalt: null } : { inhalt: null, fehler: 'io' };
  }
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    return { inhalt: null, fehler: 'kein-json' };
  }
  const inhalt = pruefeGedaechtnis(roh);
  return inhalt ? { inhalt } : { inhalt: null, fehler: 'unlesbar' };
}

/** Gedächtnis atomar schreiben; der Dateiname kommt aus `inhalt.showPfad`. */
export function schreibeGedaechtnis(ordner: string, inhalt: GedaechtnisInhalt): boolean {
  const schluessel = gedaechtnisSchluessel(inhalt.showPfad);
  return schreibeAtomar(join(ordner, `${schluessel}.json`), JSON.stringify(inhalt, null, 2) + '\n');
}

/**
 * Ein defektes Gedächtnis als `<schlüssel>.defekt.json` daneben sichern, bevor
 * das nächste Schreiben es ersetzt. Liefert den Pfad der Sicherung oder null.
 */
export function sichereDefektesGedaechtnis(ordner: string, schluessel: string): string | null {
  const ziel = join(ordner, `${schluessel}.defekt.json`);
  try {
    copyFileSync(join(ordner, `${schluessel}.json`), ziel);
    return ziel;
  } catch {
    return null;
  }
}

/**
 * Was mit einem nicht lesbaren Gedächtnis geschieht (Ruling Fix-Runde 1):
 *  - Inhalt kaputt ('kein-json', 'unlesbar') und die Kopie als `.defekt.json` gelingt
 *    → 'beiseite' (beschädigt, das nächste Schreiben darf es ersetzen)
 *  - I/O-Fehler ('io') oder gescheiterte Kopie → 'gesperrt': nicht als beschädigt
 *    behandeln, der Aufrufer überschreibt es nicht, bis ein Lesen wieder gelingt.
 */
export function legeGedaechtnisFehlerBei(
  ordner: string,
  schluessel: string,
  fehler: 'kein-json' | 'unlesbar' | 'io',
): 'beiseite' | 'gesperrt' {
  if (fehler === 'io') return 'gesperrt';
  return sichereDefektesGedaechtnis(ordner, schluessel) ? 'beiseite' : 'gesperrt';
}

/** Zeiger auf die gemerkte Show (`<ordner>/zuletzt.json`, 4.7) oder null. */
export function leseZeiger(ordner: string): { showPfad: string; schluessel: string } | null {
  try {
    const roh = JSON.parse(readFileSync(join(ordner, ZEIGER_DATEI), 'utf8')) as unknown;
    if (!roh || typeof roh !== 'object') return null;
    const o = roh as Record<string, unknown>;
    if (typeof o.showPfad !== 'string' || !o.showPfad) return null;
    // Der Schlüssel landet in einem Dateinamen → nur genau 16 Hex-Zeichen.
    if (typeof o.schluessel !== 'string' || !/^[0-9a-f]{16}$/.test(o.schluessel)) return null;
    return { showPfad: o.showPfad, schluessel: o.schluessel };
  } catch {
    return null;
  }
}

export function schreibeZeiger(ordner: string, z: { showPfad: string; schluessel: string }): boolean {
  return schreibeAtomar(
    join(ordner, ZEIGER_DATEI),
    JSON.stringify({ showPfad: z.showPfad, schluessel: z.schluessel }, null, 2) + '\n',
  );
}

export function loescheZeiger(ordner: string): void {
  try {
    unlinkSync(join(ordner, ZEIGER_DATEI));
  } catch {
    /* gibt es schon nicht */
  }
}

/**
 * Übergangsregel 5.2: den alten Autosave einmal als `rundown.autosave.v1.jmrundown`
 * sichern. Eine vorhandene Sicherung wird nie überschrieben. true = eine Sicherung
 * liegt vor (gerade angelegt oder schon da), false = kein Autosave oder Kopie gescheitert.
 */
export function sichereAltenAutosave(userData: string): boolean {
  const ziel = join(userData, AUTOSAVE_V1_DATEI);
  if (existsSync(ziel)) return true;
  try {
    copyFileSync(join(userData, AUTOSAVE_DATEI), ziel, constants.COPYFILE_EXCL);
    return true;
  } catch (e) {
    return fehlerCode(e) === 'EEXIST';
  }
}

export type ShowGelesen =
  | { ok: true; show: Show; ablaufSchluessel: string[]; eigeneTimerListe: boolean }
  | { ok: false; grund: string };

/**
 * Show lesen, ohne zu werfen (Review-Focus 1). `ablaufSchluessel` sind die
 * Schlüssel des normalisierten `show.ablauf` in Reihenfolge (R9, für 6.2),
 * `eigeneTimerListe` die Bedingung aus 6.1. `grund` enthält nie Dateiinhalt (G6).
 */
export function leseShowSicher(pfad: string): ShowGelesen {
  let text: string;
  try {
    text = readFileSync(pfad, 'utf8');
  } catch (e) {
    const code = fehlerCode(e);
    if (code === 'ENOENT') return { ok: false, grund: 'Datei nicht gefunden' };
    if (WIEDERHOLBAR.has(code)) return { ok: false, grund: `Datei gesperrt oder kein Zugriff (${code})` };
    return { ok: false, grund: `Lesefehler (${code})` };
  }
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    return { ok: false, grund: 'kein gültiges JSON' };
  }
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return { ok: false, grund: 'keine Show-Datei' };
  const show = migrateShow(roh);
  const timerSettings = show.tools.find((t) => t.appId === 'jm-timer')?.settings;
  return {
    ok: true,
    show,
    ablaufSchluessel: ersatzSchluessel(show.ablauf ?? []),
    eigeneTimerListe: hatEigeneTimerListe(timerSettings),
  };
}

/** Eigene `.jmrundown` der Show (4.8): relativ zur Show-Datei aufgelöst, null ohne Verweis. */
export function rundownDateiDerShow(showPfad: string, show: Show): string | null {
  const ref = show.tools.find((t) => t.appId === 'jm-rundown')?.document?.trim();
  if (!ref) return null;
  return isAbsolute(ref) ? resolve(ref) : resolve(dirname(resolve(showPfad)), ref);
}

/** Stand einer Datei für den Vergleich in 4.8 (Pfad, Größe, Änderungszeit, SHA-256) oder null. */
export function dateiStand(pfad: string): DateiStand | null {
  try {
    const abs = resolve(pfad);
    const st = statSync(abs);
    const sha256 = createHash('sha256').update(readFileSync(abs)).digest('hex');
    return { pfad: abs, mtimeMs: st.mtimeMs, groesse: st.size, sha256 };
  } catch {
    return null;
  }
}
