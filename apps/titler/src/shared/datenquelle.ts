// --- JM Titler: Datenquelle und gemerkte Show (Master-Link Teil 2b, Spec 7.6, 7.7) ---
//
// Reine Regeln ohne Electron, ohne fs und ohne node:path: Woher der Titler seine Einträge liest
// (Show, eigener Ordner, frühere Show), was beim Lesen einer Show geschieht, wann die gemerkte
// Show geschrieben oder gelöscht wird, der einmalige Übergang für `iveo-data`, Quellzeile und Knopf.
// Die Pfadauflösung kommt als Parameter herein (in der Produktion `path.resolve`). `main/index.ts`
// liest die Show, wendet die Schritte an und schreibt die gemerkte Show (`main/show-quelle.ts`).
// Zur Laufzeit importiert das Modul nichts (nur Typen).
import type { Show, ShowIveoSpeaker } from '@jm/show';
import type { Hinweis } from './datalink-kern';

/** Woher der Titler seine Einträge liest (Spec 7.7). `show` und `frueher` lesen `userData/iveo-data`. */
export type DatenQuelleArt = 'show' | 'ordner' | 'frueher';

/** Inhalt von `<userData>/show-zuletzt.json` (Spec 7.7). */
export interface GemerkteShow {
  showPfad: string;
  showName: string;
  /** War die Datenquelle nach dem Anwenden `show`? */
  mitSpeakern: boolean;
}

export interface QuellZustand {
  art: DatenQuelleArt;
  /** Die Show, mit der der Titler verbunden ist; null ohne. */
  showPfad: string | null;
  showName: string | null;
  /** Hinweis der Datenquelle: nur H3, H4, H7. */
  quellHinweis: Hinweis | null;
}

/** Wie die Show kam: Show-Deep-Link, RELOAD vom Launcher oder Start ohne Deep-Link (gemerkte Show). */
export type QuellWeg = 'deepLink' | 'reload' | 'start';

export type QuellEreignis =
  /** Show gelesen. `gleicheShow`: derselbe Pfad wie die verbundene Show (`gleicheShowPfad`). */
  | { t: 'gelesen'; weg: QuellWeg; pfad: string; show: Show; gleicheShow: boolean }
  /** Show nicht lesbar; `grund` ohne Dateiinhalt. `gemerkt`: die gemerkte Show (beim Start). */
  | { t: 'nichtLesbar'; weg: QuellWeg; pfad: string; grund: string; gemerkt: GemerkteShow | null }
  /** Der Bediener hat einen DataLink-Ordner gewählt. */
  | { t: 'ordnerGewaehlt' }
  /** Knopf „Zurück zum eigenen Ordner“. */
  | { t: 'zurueckZumOrdner' };

/** Was der Aufrufer nach einem Ereignis tut. */
export interface QuellSchritt {
  zustand: QuellZustand;
  /** Nicht null → `speakers.tsv` in iveo-data mit diesen Speakern neu schreiben. */
  tsv: ShowIveoSpeaker[] | null;
  /** Welcher Ordner beobachtet wird: iveo-data oder der eigene (`config.dataFolder`). */
  beobachte: 'iveo-data' | 'eigener';
  /** Gemerkte Show schreiben, löschen oder lassen. */
  merke: { t: 'schreiben'; wert: GemerkteShow } | { t: 'loeschen' } | { t: 'bleibt' };
  /** Bauchbinden-Vorlage der Show importieren (C3) — nur beim Show-Deep-Link. */
  vorlage: boolean;
  log: string[];
}

const BLEIBT = { t: 'bleibt' } as const;

function beobachteFuer(art: DatenQuelleArt): 'iveo-data' | 'eigener' {
  return art === 'ordner' ? 'eigener' : 'iveo-data';
}

/** Datenquelle beim Start: gemerkte Show mit Speakern → `show`; Übergang → `frueher`; sonst `ordner`. */
export function startZustand(gemerkt: GemerkteShow | null, frueher: boolean): QuellZustand {
  if (gemerkt?.mitSpeakern) return { art: 'show', showPfad: gemerkt.showPfad, showName: gemerkt.showName, quellHinweis: null };
  if (frueher) return { art: 'frueher', showPfad: null, showName: null, quellHinweis: null };
  return { art: 'ordner', showPfad: gemerkt?.showPfad ?? null, showName: gemerkt?.showName ?? null, quellHinweis: null };
}

/** Eine Show wurde angewendet: gemerkte Show schreiben (beim Start bleibt sie, wie sie ist). */
function angewendet(
  zustand: QuellZustand,
  pfad: string,
  name: string,
  tsv: ShowIveoSpeaker[] | null,
  weg: QuellWeg,
): QuellSchritt {
  const vorlage = weg === 'deepLink';
  const beobachte = beobachteFuer(zustand.art);
  if (weg === 'start') return { zustand, tsv, beobachte, merke: BLEIBT, vorlage, log: [] };
  const wert: GemerkteShow = { showPfad: pfad, showName: name, mitSpeakern: zustand.art === 'show' };
  return { zustand, tsv, beobachte, merke: { t: 'schreiben', wert }, vorlage, log: [`Show gemerkt: ${pfad}`] };
}

/** Ein Ereignis der Datenquelle anwenden (Spec 7.6, 7.7). */
export function quellSchritt(z: QuellZustand, e: QuellEreignis): QuellSchritt {
  switch (e.t) {
    case 'gelesen': {
      const speakers = e.show.iveo?.speakers ?? [];
      const seit = e.show.iveo?.speakerVeraltetSeit;
      const h7: Hinweis | null = seit ? { art: 'H7', seit } : null;
      if (speakers.length) {
        // Show mit Speakern → show, TSV neu, H7 bei Merker.
        return angewendet({ art: 'show', showPfad: e.pfad, showName: e.show.name, quellHinweis: h7 }, e.pfad, e.show.name, speakers, e.weg);
      }
      // Beim Start ist die gelesene Show immer die gemerkte, also dieselbe.
      if (e.gleicheShow || e.weg === 'start') {
        // Dieselbe Show ohne Speaker: Art und TSV bleiben; bei Art show H7 bzw. H3.
        const quellHinweis: Hinweis | null = z.art === 'show' ? (h7 ?? { art: 'H3' }) : null;
        return { zustand: { ...z, quellHinweis }, tsv: null, beobachte: beobachteFuer(z.art), merke: BLEIBT, vorlage: e.weg === 'deepLink', log: [] };
      }
      // Andere Show ohne Speaker → eigener Ordner; die Show wird gemerkt (RELOAD wirkt weiter).
      return angewendet({ art: 'ordner', showPfad: e.pfad, showName: e.show.name, quellHinweis: null }, e.pfad, e.show.name, null, e.weg);
    }
    case 'nichtLesbar': {
      if (e.weg === 'start') {
        if (e.gemerkt?.mitSpeakern) {
          // Die vorhandene TSV gilt, H4; ein späteres RELOAD versucht es erneut.
          const zustand: QuellZustand = { art: 'show', showPfad: e.pfad, showName: e.gemerkt.showName, quellHinweis: { art: 'H4', grund: e.grund } };
          return { zustand, tsv: null, beobachte: 'iveo-data', merke: BLEIBT, vorlage: false, log: [] };
        }
        const zustand: QuellZustand = { art: 'ordner', showPfad: e.pfad, showName: e.gemerkt?.showName ?? null, quellHinweis: null };
        return { zustand, tsv: null, beobachte: 'eigener', merke: BLEIBT, vorlage: false, log: [`Gemerkte Show nicht lesbar (${e.grund}), eigener Ordner gilt.`] };
      }
      // Deep-Link oder RELOAD: Art und Liste bleiben; H4 nur bei Art show.
      const quellHinweis: Hinweis | null = z.art === 'show' ? { art: 'H4', grund: e.grund } : z.quellHinweis;
      return { zustand: { ...z, quellHinweis }, tsv: null, beobachte: beobachteFuer(z.art), merke: BLEIBT, vorlage: false, log: [] };
    }
    case 'ordnerGewaehlt':
    case 'zurueckZumOrdner':
      return {
        zustand: { art: 'ordner', showPfad: null, showName: null, quellHinweis: null },
        tsv: null,
        beobachte: 'eigener',
        merke: { t: 'loeschen' },
        vorlage: false,
        log: [],
      };
  }
}

/** Zwei Pfade gleich nach `aufloesen`, ohne Rücksicht auf Groß- und Kleinschreibung (Spec 7.7). Leer → nie gleich. */
function gleicherPfad(a: string, b: string, aufloesen: (p: string) => string): boolean {
  if (!a.trim() || !b.trim()) return false;
  return aufloesen(a).toLowerCase() === aufloesen(b).toLowerCase();
}

/** Zeigt `ordner` auf `userData/iveo-data`? */
export function istIveoDataOrdner(ordner: string, iveoData: string, aufloesen: (p: string) => string): boolean {
  return gleicherPfad(ordner, iveoData, aufloesen);
}

/** Der eigene Ordner des Bedieners: `config.dataFolder`, aber '' wenn leer oder iveo-data (nie ein eigener Ordner). */
export function eigenerOrdner(dataFolder: string, iveoData: string, aufloesen: (p: string) => string): string {
  return !dataFolder.trim() || istIveoDataOrdner(dataFolder, iveoData, aufloesen) ? '' : dataFolder;
}

/** Dieselbe Show trotz anderer Schreibweise (`C:\Shows\Tag1.jmshow` = `c:/shows/tag1.jmshow`)? */
export function gleicheShowPfad(a: string, b: string, aufloesen: (p: string) => string): boolean {
  return gleicherPfad(a, b, aufloesen);
}

/**
 * Übergang beim Start (Spec 7.7): Steht `config.dataFolder` auf iveo-data, hat ein früherer Titler ihn
 * überschrieben. Er wird einmalig geleert; ohne gemerkte Show wird die Datenquelle `frueher`.
 */
export function uebergang(
  dataFolder: string,
  iveoData: string,
  gemerkt: GemerkteShow | null,
  aufloesen: (p: string) => string,
): { dataFolderLeeren: boolean; frueher: boolean; log: string[] } {
  if (!istIveoDataOrdner(dataFolder, iveoData, aufloesen)) return { dataFolderLeeren: false, frueher: false, log: [] };
  return {
    dataFolderLeeren: true,
    frueher: gemerkt === null,
    log: ['DataLink: Ordner iveo-data war von einer Show gesetzt, kein eigener Ordner mehr eingetragen.'],
  };
}

/**
 * Zeile über der Liste (Spec 7.8 Q1–Q3). `ordner` ist der eigene Ordner (`eigenerOrdner`), `anzahl`
 * die Zahl der Einträge. Bei `ordner` ohne eigenen Ordner leer (dann steht „Kein Datenordner aktiv …“).
 */
export function quellZeile(z: QuellZustand, ordner: string, anzahl: number): string {
  if (z.art === 'show') return `Quelle: Show „${z.showName ?? ''}“ · ${anzahl} Speaker`;
  if (z.art === 'frueher') return 'Quelle: Speaker aus einer früheren Show';
  return ordner ? `Quelle: eigener Ordner ${ordner}` : '';
}

/**
 * Knopf K1 (Spec 7.8): nur bei Datenquelle `show` und einem eigenen Ordner. `ordner` ist der eigene
 * Ordner (`eigenerOrdner`, also nie iveo-data). Ordnername = letzter Pfadteil, ohne node:path.
 */
export function zurueckKnopf(z: QuellZustand, ordner: string): string | null {
  if (z.art !== 'show' || !ordner.trim()) return null;
  const name = ordner.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || ordner;
  return `Zurück zum eigenen Ordner (${name})`;
}
