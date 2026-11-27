// Freier Platz im Zielordner (Altfehler RE-PLATZ, B5). Ohne Electron, unter tsx testbar (einspeisbares statfs). Kein existsSync und
// kein anderer synchroner Zugriff: statfs läuft im libuv-Pool und hält den Hauptprozess (Audioblöcke, IPC, Steuerserver) nie an. Ein
// Zielordner, den es noch nicht gibt (er entsteht erst beim Start), wird am nächsten vorhandenen Vorfahren gemessen; jeder andere Fehler
// heißt „unbekannt“ (null). Je Pfad höchstens eine Messung zugleich; nach PLATZ_GRENZE_MS antwortet die Abfrage null, die alte Messung
// läuft im Hintergrund aus (ein totes NAS belegt so höchstens einen Faden des Pools, statt mit jedem Takt einen weiteren).
import { promises as fsp } from 'node:fs';
import path from 'node:path';

/** So lange wartet eine Frage auf die Messung, danach gilt der Platz als unbekannt. */
export const PLATZ_GRENZE_MS = 3000;

type Statfs = (p: string) => Promise<{ bavail: number | bigint; bsize: number | bigint }>;

/** Beginnt mit zwei Trennern (`\\` oder `//`, auch gemischt): eine Freigabe nach Windows-Regeln. */
const FREIGABE = /^[\\/]{2}/;
/** Eine Freigabe mit Server und Freigabename (`\\server\share`, `//server/share`); nur ab ihr wird gemessen. */
const FREIGABE_MIT_NAMEN = /^[\\/]{2}[^\\/]+[\\/]+[^\\/]+/;
/** Eine Freigabe ohne Freigabenamen (`//`, `\\server`): Windows-Regeln machen daraus `\`, und statfs misst dort das Systemlaufwerk. */
const unvollstaendigeFreigabe = (p: string): boolean => FREIGABE.test(p) && !FREIGABE_MIT_NAMEN.test(p);

/**
 * Elternordner; null an der Wurzel (`D:\`, `\\server\share\`, `//server/share/`, `/`). Pfade mit Laufwerk oder zwei Trennern am Anfang gehen
 * nach Windows-Regeln (`path.win32`, auch unter Linux in der CI), sonst nach POSIX-Regeln. Fix-Runde 1 (Ruling R16): `//server/share` nach
 * POSIX-Regeln ginge weiter zu `//server` und `//`; über die Wurzel einer Freigabe geht es nie hinaus.
 */
export function elternOrdner(p: string): string | null {
  if (unvollstaendigeFreigabe(p)) return null;
  const regeln = /^[A-Za-z]:/.test(p) || FREIGABE.test(p) ? path.win32 : path.posix;
  // Nach Windows-Regeln bleibt dirname einer Freigabe mit Namen an ihrer Wurzel (\\server\share\); höher geht es nie.
  const oben = regeln.dirname(p);
  return oben === p ? null : oben;
}

/**
 * Freie Byte für den Aufrufer (`bavail × bsize`) im Ordner oder im nächsten vorhandenen Vorfahren; null, wenn nicht lesbar. Eine Freigabe
 * ohne Freigabenamen wird nie gemessen (Ruling R16: statfs('//') nennt das Systemlaufwerk, eine erfundene Zahl).
 */
export async function freierPlatz(dir: string, statfs: Statfs = (p) => fsp.statfs(p)): Promise<number | null> {
  if (unvollstaendigeFreigabe(dir)) return null;
  let d: string | null = dir;
  while (d !== null && d !== '') {
    try {
      const s = await statfs(d);
      const frei = Number(s.bavail) * Number(s.bsize);
      return Number.isFinite(frei) && frei >= 0 ? frei : null;
    } catch (e) {
      if ((e as { code?: unknown } | null)?.code !== 'ENOENT') return null;
      const oben = elternOrdner(d);
      // Nie im Kreis: kommt der Pfad nicht weiter nach oben, ist Schluss (elternOrdner gibt an der Wurzel null).
      d = oben === d ? null : oben;
    }
  }
  return null;
}

/** Abfrage des freien Platzes mit Zusammenlegen je Pfad und Zeitgrenze. */
export class PlatzAbfrage {
  private readonly laufend = new Map<string, Promise<number | null>>();
  private readonly messe: typeof freierPlatz;
  private readonly grenzeMs: number;

  constructor(messe: typeof freierPlatz = freierPlatz, grenzeMs: number = PLATZ_GRENZE_MS) {
    this.messe = messe;
    this.grenzeMs = grenzeMs;
  }

  frage(dir: string): Promise<number | null> {
    let messung = this.laufend.get(dir);
    if (messung === undefined) {
      const neu: Promise<number | null> = Promise.resolve()
        .then(() => this.messe(dir))
        .catch(() => null)
        .finally(() => {
          if (this.laufend.get(dir) === neu) this.laufend.delete(dir);
        });
      messung = neu;
      this.laufend.set(dir, neu);
    }
    const m = messung;
    return new Promise((r) => {
      const grenze = setTimeout(() => r(null), this.grenzeMs);
      void m.then((v) => {
        clearTimeout(grenze);
        r(v);
      });
    });
  }
}
