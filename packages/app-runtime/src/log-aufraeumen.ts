// Löschfrist der Logs (Spec Zoom Stage 4, Nachtrag N4b.2; Plan 4b, L10): Logdateien und Logzeilen, die
// älter als 14 Tage sind, verschwinden, und zwar in jeder Suite-App, die initAppRuntime ruft. Ohne Electron
// und nur mit node:fs/node:path (Muster csp.ts), damit `node --experimental-strip-types` die Regeln im
// Selbsttest prüft. Darum auch kein `enum` und keine Parameter-Properties.
//
// Regeln:
// - Nur eigene Dateien: main.log, renderer.log (samt Rotation .1, .2, …) und last-crash.json.
// - Alter = mtime. Ab 14 Tagen wird die Datei gelöscht. Eine mtime in der Zukunft (die Uhr sprang) wird nie
//   gelöscht und nie gekürzt.
// - Eine jüngere Logdatei, deren erste Zeile älter ist, wird gekürzt: Es bleiben die Zeilen ab der ersten Zeile
//   mit Zeitstempel innerhalb der Frist. Zeilen ohne Zeitstempel (Stapel) gehören zur Zeile davor. Ohne das
//   stünde bei einer täglich genutzten App, die nie 5 MB erreicht und darum nie rotiert, jede Zeile für immer
//   im Log.
// - Gekürzt wird byte-genau über eine Hilfsdatei `<name>.kuerzen` und Umbenennen. Bleibt sie nach einem harten
//   Ende liegen, löscht sie der nächste Lauf.
// - Jeder Fehler wird je Datei gemeldet, nie geworfen (EBUSY, EPERM, ENOENT): Aufräumen verhindert nie den Start.
import * as nodeFs from 'node:fs';
import path from 'node:path';

export const LOG_FRIST_MS = 14 * 24 * 60 * 60 * 1000;
export const LOG_AUFRAEUMEN_TAKT_MS = 6 * 60 * 60 * 1000;
/** Die Dateien des Loggers in `userData/logs` (index.ts): main.log, renderer.log, Rotation .1–.n, Crash-Marke. */
export const LOG_DATEIMUSTER = /^(?:(?:main|renderer)\.log(?:\.[1-9]\d*)?|last-crash\.json)$/;
/** Hilfsdatei beim Kürzen. */
const HILFSDATEI = /^(?:main|renderer)\.log(?:\.[1-9]\d*)?\.kuerzen$/;
/** Zeitstempel am Zeilenanfang, wie createLogger ihn schreibt: `2026-10-06T12:00:00.000Z `. */
const ZEITSTEMPEL = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z) /;
/** So viel liest das Aufräumen zuerst; ist die erste Zeile darin jung (Normalfall), wird die Datei nicht ganz gelesen. */
const KOPF_BYTES = 64 * 1024;
/** Größere Dateien liest das Aufräumen nie ganz (doppelte Rotationsgröße MAX_BYTES aus index.ts): Die Rotation scheiterte. */
export const KUERZEN_MAX_BYTES = 10 * 1024 * 1024;

/** Die Dateisystem-Aufrufe, einzeln einspeisbar (Tests: EBUSY, EPERM). */
export interface LogFs {
  readdirSync(ordner: string): string[];
  statSync(datei: string): { mtimeMs: number; size: number; isFile(): boolean };
  rmSync(datei: string, optionen: { force: boolean }): void;
  /** Die ersten `bytes` Bytes (oder weniger): Reicht der Kopf für die Entscheidung, wird die Datei nicht ganz gelesen. */
  leseKopf(datei: string, bytes: number): Uint8Array;
  readFileSync(datei: string): Uint8Array;
  writeFileSync(datei: string, daten: Uint8Array): void;
  renameSync(von: string, nach: string): void;
}

export interface AufraeumBericht {
  /** Dateinamen, die gelöscht wurden. */
  geloescht: string[];
  /** Dateinamen, die gekürzt wurden. */
  gekuerzt: string[];
  /** `<datei> (<code>)`; beim nicht lesbaren Ordner dessen Pfad. */
  fehler: string[];
}

const ECHT: LogFs = {
  readdirSync: (ordner) => nodeFs.readdirSync(ordner),
  statSync: (datei) => nodeFs.statSync(datei),
  rmSync: (datei, optionen) => nodeFs.rmSync(datei, optionen),
  leseKopf: (datei, bytes) => {
    const fd = nodeFs.openSync(datei, 'r');
    try {
      const puffer = new Uint8Array(bytes);
      return puffer.subarray(0, nodeFs.readSync(fd, puffer, 0, bytes, 0));
    } finally {
      nodeFs.closeSync(fd);
    }
  },
  readFileSync: (datei) => nodeFs.readFileSync(datei),
  writeFileSync: (datei, daten) => nodeFs.writeFileSync(datei, daten),
  renameSync: (von, nach) => nodeFs.renameSync(von, nach),
};

function fehlerCode(e: unknown): string {
  const code = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
  return typeof code === 'string' && code ? code : 'unbekannt';
}

/**
 * Byte-Versatz, ab dem die Datei bleibt. 0 = nichts kürzen (die erste Zeile mit Zeitstempel ist jung, oder es
 * gibt keinen Zeitstempel). `daten.length` = jede Zeile mit Zeitstempel ist alt.
 */
function schnitt(daten: Uint8Array, grenzeMs: number): number {
  let altGesehen = false;
  let anfang = 0;
  while (anfang < daten.length) {
    const ende = daten.indexOf(0x0a, anfang);
    const naechste = ende === -1 ? daten.length : ende + 1;
    const kopf = String.fromCharCode(...daten.subarray(anfang, Math.min(anfang + 40, naechste)));
    const m = ZEITSTEMPEL.exec(kopf);
    const ms = m ? Date.parse(m[1]) : Number.NaN;
    if (Number.isFinite(ms)) {
      if (ms > grenzeMs) return altGesehen ? anfang : 0;
      altGesehen = true;
    }
    anfang = naechste;
  }
  return altGesehen ? daten.length : 0;
}

/** Räumt `ordner` auf (Regeln oben). Wirft nie. */
export function raeumeLogsAuf(e: { ordner: string; jetztMs: number; fristMs?: number; fs?: Partial<LogFs> }): AufraeumBericht {
  const fs: LogFs = { ...ECHT, ...e.fs };
  const grenzeMs = e.jetztMs - (e.fristMs ?? LOG_FRIST_MS);
  const bericht: AufraeumBericht = { geloescht: [], gekuerzt: [], fehler: [] };
  let namen: string[];
  try {
    namen = fs.readdirSync(e.ordner);
  } catch (err) {
    bericht.fehler.push(`${e.ordner} (${fehlerCode(err)})`);
    return bericht;
  }
  const loesche = (datei: string, name: string): void => {
    fs.rmSync(datei, { force: true });
    bericht.geloescht.push(name);
  };
  const sortiert = [...namen].sort();
  // Liegengebliebene Hilfsdateien zuerst: Das Kürzen unten legt dieselben Namen neu an.
  const reihenfolge = [...sortiert.filter((n) => HILFSDATEI.test(n)), ...sortiert.filter((n) => !HILFSDATEI.test(n))];
  for (const name of reihenfolge) {
    const hilfsdatei = HILFSDATEI.test(name);
    if (!hilfsdatei && !LOG_DATEIMUSTER.test(name)) continue;
    const datei = path.join(e.ordner, name);
    try {
      const st = fs.statSync(datei);
      if (!st.isFile()) continue;
      if (hilfsdatei) {
        loesche(datei, name);
        continue;
      }
      if (st.mtimeMs > e.jetztMs) continue;
      if (st.mtimeMs <= grenzeMs) {
        loesche(datei, name);
        continue;
      }
      if (name === 'last-crash.json') continue;
      // Erst nur den Kopf: Ist seine erste Zeile mit Zeitstempel jung (Normalfall), bleibt die Datei, ohne ganz gelesen zu werden.
      if (schnitt(fs.leseKopf(datei, KOPF_BYTES), grenzeMs) === 0) continue;
      if (st.size > KUERZEN_MAX_BYTES) {
        bericht.fehler.push(`${name} (ZU_GROSS)`);
        continue;
      }
      const daten = fs.readFileSync(datei);
      const ab = schnitt(daten, grenzeMs);
      if (ab === 0) continue;
      if (ab >= daten.length) {
        loesche(datei, name);
        continue;
      }
      const hilfe = `${datei}.kuerzen`;
      try {
        fs.writeFileSync(hilfe, daten.subarray(ab));
        fs.renameSync(hilfe, datei);
      } catch (err) {
        try {
          fs.rmSync(hilfe, { force: true });
        } catch {
          /* bleibt liegen; der nächste Lauf löscht sie */
        }
        throw err;
      }
      bericht.gekuerzt.push(name);
    } catch (err) {
      bericht.fehler.push(`${name} (${fehlerCode(err)})`);
    }
  }
  return bericht;
}

/** Zeilen fürs Log: eine Info-Zeile nur, wenn etwas geschah; je Fehler eine Warnung. */
export function berichtZeilen(b: AufraeumBericht, fristMs: number = LOG_FRIST_MS): { info: string | null; warn: string[] } {
  const tage = Math.round(fristMs / (24 * 60 * 60 * 1000));
  const info =
    b.geloescht.length + b.gekuerzt.length > 0
      ? `[runtime] Logs aufgeräumt: ${b.geloescht.length} gelöscht, ${b.gekuerzt.length} gekürzt (Frist ${tage} Tage)`
      : null;
  return { info, warn: b.fehler.map((f) => `[runtime] Log-Aufräumen: ${f}`) };
}
