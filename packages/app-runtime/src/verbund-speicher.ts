// ─────────────────────────────────────────────────────────────────────────────
// Verbund der Tool-Seite: Zwischenspeicher (Master-Link Teil 2b, Release 2, Spec 16.3, E18).
//
// `<userData des Tools>/verbund/master-stand.json` = { fassung: 1, stand } mit dem zuletzt
// angewendeten Stand vom Master. Ohne Electron: den Pfad gibt verbund.ts hinein.
// • Schreiben: asynchron, Zwischendatei und Umbenennen, bis zu 5 Versuche im Abstand von 50 ms
//   bei EPERM/EBUSY/EACCES (Virenscanner, Indexdienst). Bewusst NICHT schreibeAtomar aus
//   @jm/master-link: das wartet synchron bis zu 2 s und hielte den Main-Prozess an (E18).
// • Lesen: tolerant. Fehlt die Datei → null. Ist sie kaputt, leer, fremd (fassung ≠ 1) oder trägt
//   sie keinen gültigen Stand → null und EINE Warnung; die Warnung nennt nie Dateiinhalt (G6),
//   nur einen Feldnamen oder Fehlercode. Der nächste angewendete Stand überschreibt die Datei.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { migrateShow, type Show } from '@jm/show';
import { pruefeStand } from '@jm/master-link';
import type { MasterStand } from './verbund-typen';
import type { StandSpeicher } from './verbund-daten';

const FASSUNG = 1;
const VERSUCHE = 5;
const PAUSE_MS = 50;
const NOCHMAL = new Set(['EPERM', 'EBUSY', 'EACCES']);

/** `<userData>/verbund/master-stand.json` (16.3). */
export function standDatei(userData: string): string {
  return join(userData, 'verbund', 'master-stand.json');
}

/** Nur ein Fehlercode wie ENOENT oder EBUSY, nie ein Fehlertext (der kann Pfade oder Inhalt tragen). */
function codeAus(e: unknown): string {
  const c = (e as { code?: unknown } | null)?.code;
  return typeof c === 'string' && /^[A-Z][A-Z0-9_]*$/.test(c) ? c : 'unbekannt';
}

const istObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Prüft den gespeicherten Stand; liefert ihn oder den Namen des ersten falschen Felds. */
function pruefeGespeichert(roh: unknown): MasterStand | string {
  if (!istObj(roh)) return 'kein Objekt';
  if (roh.fassung !== FASSUNG) return 'fassung';
  const s = roh.stand;
  if (!istObj(s)) return 'stand';
  if (typeof s.masterId !== 'string' || !s.masterId) return 'masterId';
  if (typeof s.masterName !== 'string') return 'masterName';
  if (typeof s.empfangenAm !== 'number' || !Number.isFinite(s.empfangenAm) || s.empfangenAm < 0) return 'empfangenAm';
  if (!istObj(s.show)) return 'show'; // gespeichert wird nur ein angewendeter Stand, also immer mit Show
  // Epoche, Folge, Schlüssel und mitDokument nach denselben Regeln wie ein Stand aus dem Netz (13.2).
  const p = pruefeStand({ art: 'show', fassung: 1, epoche: s.epoche, folge: s.folge, schluessel: s.schluessel, show: s.show, mitDokument: s.mitDokument });
  if (!p.ok) return p.grund;
  let show: Show;
  try {
    show = migrateShow(s.show);
  } catch {
    return 'show';
  }
  return {
    masterId: s.masterId,
    masterName: s.masterName,
    epoche: p.wert.epoche,
    folge: p.wert.folge,
    schluessel: p.wert.schluessel,
    show,
    mitDokument: p.wert.mitDokument,
    empfangenAm: s.empfangenAm,
  };
}

export function erzeugeStandSpeicher(
  datei: string,
  log: (stufe: 'info' | 'warn', t: string) => void,
  umbenennen: (von: string, nach: string) => void = renameSync,
): StandSpeicher {
  const zwischen = `${datei}.tmp`;
  const warne = (t: string): void => {
    try {
      log('warn', t);
    } catch {
      /* Logging darf nie werfen */
    }
  };
  const pause = (): Promise<void> => new Promise((fertig) => setTimeout(fertig, PAUSE_MS));

  return {
    lies(): MasterStand | null {
      let text: string;
      try {
        text = readFileSync(datei, 'utf8');
      } catch (e) {
        if (codeAus(e) !== 'ENOENT') warne(`Verbund: Zwischenspeicher nicht lesbar (${codeAus(e)}), wird beim nächsten Stand überschrieben.`);
        return null;
      }
      let roh: unknown;
      try {
        roh = JSON.parse(text);
      } catch {
        warne('Verbund: Zwischenspeicher nicht lesbar (kein gültiges JSON), wird beim nächsten Stand überschrieben.');
        return null;
      }
      const ergebnis = pruefeGespeichert(roh);
      if (typeof ergebnis === 'string') {
        warne(`Verbund: Zwischenspeicher nicht lesbar (${ergebnis}), wird beim nächsten Stand überschrieben.`);
        return null;
      }
      return ergebnis;
    },

    async schreibe(s: MasterStand): Promise<boolean> {
      const inhalt = `${JSON.stringify({ fassung: FASSUNG, stand: s })}\n`;
      let code = 'unbekannt';
      try {
        mkdirSync(dirname(datei), { recursive: true });
      } catch (e) {
        code = codeAus(e);
        warne(`Verbund: Zwischenspeicher nicht geschrieben (${code}).`);
        return false;
      }
      for (let versuch = 1; versuch <= VERSUCHE; versuch++) {
        try {
          await writeFile(zwischen, inhalt, 'utf8');
          umbenennen(zwischen, datei);
          return true;
        } catch (e) {
          code = codeAus(e);
          if (!NOCHMAL.has(code) || versuch === VERSUCHE) break;
          await pause();
        }
      }
      try {
        rmSync(zwischen, { force: true });
      } catch {
        /* Zwischendatei bleibt liegen — das nächste Schreiben überschreibt sie */
      }
      warne(`Verbund: Zwischenspeicher nicht geschrieben (${code}).`);
      return false;
    },

    loesche(): void {
      for (const p of [datei, zwischen]) {
        try {
          rmSync(p, { force: true });
        } catch {
          /* nicht löschbar (etwa ein Ordner gleichen Namens) — das Lesen verwirft ihn ohnehin */
        }
      }
    },
  };
}
