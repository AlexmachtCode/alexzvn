// Datei atomar schreiben (Z1-L3, AR85/AR88): erst in eine Temp-Datei im selben Ordner (mit fsync), dann umbenennen. Bricht der
// Rechner dazwischen ab, bleibt die alte Datei ganz; eine liegengebliebene Temp-Datei wird nie gelesen und beim Laden entfernt.
// Unter Windows scheitert das Umbenennen mit EPERM/EACCES/EBUSY, solange Virenscanner oder Sync die Zieldatei offen halten:
// dann bis zu 5 Wiederholungen im Abstand von 50 ms, danach Rückfall auf direktes Schreiben der Zieldatei (nie schlechter als
// vor L3). Rein (kein Electron), läuft unter node.
import { closeSync, fsyncSync, openSync, readdirSync, renameSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/** Die Dateioperationen, austauschbar für Tests. */
export interface DateiOps {
  openSync: typeof openSync;
  writeSync: typeof writeSync;
  fsyncSync: typeof fsyncSync;
  closeSync: typeof closeSync;
  renameSync: typeof renameSync;
  writeFileSync: typeof writeFileSync;
  rmSync: typeof rmSync;
  /** Synchrone Pause in ms. */
  pause: (ms: number) => void;
}

export const UMBENENNEN_WIEDERHOLUNGEN = 5;
export const UMBENENNEN_PAUSE_MS = 50;
const WIEDERHOLBAR = ['EPERM', 'EACCES', 'EBUSY'];

function pauseSynchron(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const STANDARD: DateiOps = { openSync, writeSync, fsyncSync, closeSync, renameSync, writeFileSync, rmSync, pause: pauseSynchron };

function istWiederholbar(e: unknown): boolean {
  const c = (e as { code?: unknown } | null)?.code;
  return typeof c === 'string' && WIEDERHOLBAR.includes(c);
}

export function schreibeAtomar(pfad: string, daten: Uint8Array, ops: Partial<DateiOps> = {}): void {
  const o: DateiOps = { ...STANDARD, ...ops };
  const temp = `${pfad}.${process.pid}.tmp`;
  try {
    const fd = o.openSync(temp, 'w');
    try {
      o.writeSync(fd, daten);
      o.fsyncSync(fd);
    } finally {
      o.closeSync(fd);
    }
    for (let versuch = 0; ; versuch++) {
      try {
        o.renameSync(temp, pfad);
        return;
      } catch (e) {
        if (!istWiederholbar(e) || versuch >= UMBENENNEN_WIEDERHOLUNGEN) throw e;
        o.pause(UMBENENNEN_PAUSE_MS);
      }
    }
  } catch {
    // Rückfall wie vor L3: die Zieldatei direkt schreiben; scheitert auch das, wirft dieser Fehler. Die Temp-Datei wird entfernt
    // (ein Ordner an ihrem Pfad bleibt stehen, rmSync ohne recursive lässt ihn aus).
    try {
      o.writeFileSync(pfad, daten);
    } finally {
      try {
        o.rmSync(temp, { force: true });
      } catch {
        /* egal */
      }
    }
  }
}

/** Liegengebliebene `<Name>.<Ziffern>.tmp` neben der Zieldatei entfernen (Reste aus Abstürzen); fehlertolerant, nie ein Ordner. */
export function raeumeTempReste(zielPfad: string): void {
  try {
    const ordner = dirname(zielPfad);
    const name = basename(zielPfad).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const muster = new RegExp(`^${name}\\.\\d+\\.tmp$`);
    for (const n of readdirSync(ordner)) {
      if (!muster.test(n)) continue;
      try {
        const p = join(ordner, n);
        if (statSync(p).isFile()) rmSync(p, { force: true });
      } catch {
        /* egal */
      }
    }
  } catch {
    /* Ordner fehlt o. ä. */
  }
}
