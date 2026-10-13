// --- JM Titler: Datenquelle und gemerkte Show (Master-Link Teil 2b, Spec 7.6, 7.7) ---
//
// Reine Regeln ohne Electron, ohne fs und ohne node:path: Woher der Titler seine Einträge liest
// (Show, eigener Ordner, frühere Show), was beim Lesen einer Show geschieht, wann die gemerkte
// Show geschrieben oder gelöscht wird, der einmalige Übergang für `iveo-data`, Quellzeile und Knopf.
// Die Pfadauflösung kommt als Parameter herein (in der Produktion `path.resolve`). `main/index.ts`
// liest die Show, wendet die Schritte an und schreibt die gemerkte Show (`main/show-quelle.ts`).
// Release 2 (Spec 17.2): Datenquelle `master` für die Show vom Master im Verbund. Das Ereignis
// `masterStand` trägt einfache Felder; das Modul importiert nichts aus `@jm/app-runtime`.
// Zur Laufzeit importiert das Modul nichts (nur Typen).
import type { Show, ShowIveoSpeaker } from '@jm/show';
import type { Hinweis } from './datalink-kern';

/**
 * Woher der Titler seine Einträge liest (Spec 7.7, 17.2). `show`, `master` und `frueher` lesen
 * `userData/iveo-data`; `master` ist die Show vom Master im Verbund.
 */
export type DatenQuelleArt = 'show' | 'ordner' | 'frueher' | 'master';

/** Inhalt von `<userData>/show-zuletzt.json` für eine eigene Show (Spec 7.7). */
export interface GemerkteShowPfad {
  showPfad: string;
  showName: string;
  /** War die Datenquelle nach dem Anwenden `show`? */
  mitSpeakern: boolean;
}

/**
 * Inhalt von `<userData>/show-zuletzt.json` im Verbundmodus (Spec 17.2): die Show vom Master mit
 * Speakern. `showPfad` und `mitSpeakern` fehlen; ein Titler 0.10 liest das als „keine gemerkte Show“.
 */
export interface GemerkteShowMaster {
  quelle: 'master';
  masterId: string;
  schluessel: string | null;
  showName: string;
}

export type GemerkteShow = GemerkteShowPfad | GemerkteShowMaster;

/** Master-Form der gemerkten Show? */
export function istMasterForm(g: GemerkteShow | null): g is GemerkteShowMaster {
  return g !== null && 'quelle' in g && g.quelle === 'master';
}

export interface QuellZustand {
  art: DatenQuelleArt;
  /** Die Show, mit der der Titler verbunden ist; null ohne (und bei einer Show vom Master). */
  showPfad: string | null;
  showName: string | null;
  /** Hinweis der Datenquelle: nur H3, H4, H7. */
  quellHinweis: Hinweis | null;
  /** Die Show vom Master, zu der die Liste gehört (Spec 17.2); null bei eigener Show oder Ordner. */
  master: { masterId: string; masterName: string; schluessel: string | null } | null;
}

/** Wie die Show kam: Show-Deep-Link, RELOAD vom Launcher oder Start ohne Deep-Link (gemerkte Show). */
export type QuellWeg = 'deepLink' | 'reload' | 'start';

export type QuellEreignis =
  /** Show gelesen. `gleicheShow`: derselbe Pfad wie die verbundene Show (`gleicheShowPfad`). */
  | { t: 'gelesen'; weg: QuellWeg; pfad: string; show: Show; gleicheShow: boolean }
  /**
   * Show nicht lesbar; `grund` ohne Dateiinhalt. `gemerkt`: die gemerkte Show (beim Start). `mitEigenemOrdner`: Ist
   * ein eigener Ordner eingetragen (`eigenerOrdner` nicht leer)? Nur die Logzeile beim Start hängt davon ab.
   */
  | { t: 'nichtLesbar'; weg: QuellWeg; pfad: string; grund: string; gemerkt: GemerkteShowPfad | null; mitEigenemOrdner: boolean }
  /** Der Bediener hat einen DataLink-Ordner gewählt. */
  | { t: 'ordnerGewaehlt' }
  /** Knopf „Zurück zum eigenen Ordner“. */
  | { t: 'zurueckZumOrdner' }
  /**
   * Ein Stand vom Master mit Show wird angewendet (Spec 17.2). Ob es dieselbe Show ist, bestimmt
   * `quellSchritt` selbst aus `master` im Zustand (masterId + schluessel), nicht der Aufrufer (E21).
   */
  | { t: 'masterStand'; masterId: string; masterName: string; schluessel: string | null; show: Show }
  /** Der Verbundmodus ist zu Ende (app-runtime meldet `frueher`, Spec 16.1). */
  | { t: 'verbundEnde' };

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

/**
 * Datenquelle beim Start: gemerkte Show mit Speakern → `show`; Übergang → `frueher`; sonst `ordner`.
 * Master-Form (Spec 17.2): an denselben Master gekoppelt (`gekoppelterMaster` = masterId der
 * Kopplung) → `master`, die vorhandene TSV gilt; sonst `frueher` (Q3). Den Namen des Masters kennt
 * die Datei nicht; er kommt mit dem ersten Stand (Zwischenspeicher oder Netz).
 */
export function startZustand(gemerkt: GemerkteShow | null, frueher: boolean, gekoppelterMaster: string | null = null): QuellZustand {
  if (istMasterForm(gemerkt)) {
    const master = { masterId: gemerkt.masterId, masterName: '', schluessel: gemerkt.schluessel };
    const art: DatenQuelleArt = gekoppelterMaster === gemerkt.masterId ? 'master' : 'frueher';
    return { art, showPfad: null, showName: gemerkt.showName, quellHinweis: null, master };
  }
  if (gemerkt?.mitSpeakern) return { art: 'show', showPfad: gemerkt.showPfad, showName: gemerkt.showName, quellHinweis: null, master: null };
  if (frueher) return { art: 'frueher', showPfad: null, showName: null, quellHinweis: null, master: null };
  return { art: 'ordner', showPfad: gemerkt?.showPfad ?? null, showName: gemerkt?.showName ?? null, quellHinweis: null, master: null };
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
  return { zustand, tsv, beobachte, merke: { t: 'schreiben', wert }, vorlage, log: [gemerktZeile(pfad)] };
}

/** Logzeile „Show gemerkt“ (Spec 7.9). */
function gemerktZeile(pfad: string): string {
  return `Show gemerkt: ${pfad}`;
}

/** Gehört die Liste zur Show `schluessel` dieses Masters (Spec 17.2, E21)? Ein Schlüssel null ist nie dieselbe Show. */
function zeigtMasterShow(z: QuellZustand, masterId: string, schluessel: string | null): boolean {
  return z.master !== null && schluessel !== null && z.master.masterId === masterId && z.master.schluessel === schluessel;
}

/** Ein Ereignis der Datenquelle anwenden (Spec 7.6, 7.7, 17.2). */
export function quellSchritt(z: QuellZustand, e: QuellEreignis): QuellSchritt {
  switch (e.t) {
    case 'gelesen': {
      const speakers = e.show.iveo?.speakers ?? [];
      const seit = e.show.iveo?.speakerVeraltetSeit;
      const h7: Hinweis | null = seit ? { art: 'H7', seit } : null;
      if (speakers.length) {
        // Show mit Speakern → show, TSV neu, H7 bei Merker.
        return angewendet({ art: 'show', showPfad: e.pfad, showName: e.show.name, quellHinweis: h7, master: null }, e.pfad, e.show.name, speakers, e.weg);
      }
      // Beim Start ist die gelesene Show immer die gemerkte, also dieselbe.
      if (e.gleicheShow || e.weg === 'start') {
        // Dieselbe Show ohne Speaker: Art und TSV bleiben; bei Art show H7 bzw. H3.
        const quellHinweis: Hinweis | null = z.art === 'show' ? (h7 ?? { art: 'H3' }) : null;
        return { zustand: { ...z, quellHinweis }, tsv: null, beobachte: beobachteFuer(z.art), merke: BLEIBT, vorlage: e.weg === 'deepLink', log: [] };
      }
      // Andere Show ohne Speaker → eigener Ordner; die Show wird gemerkt (RELOAD wirkt weiter).
      return angewendet({ art: 'ordner', showPfad: e.pfad, showName: e.show.name, quellHinweis: null, master: null }, e.pfad, e.show.name, null, e.weg);
    }
    case 'nichtLesbar': {
      if (e.weg === 'start') {
        if (e.gemerkt?.mitSpeakern) {
          // Die vorhandene TSV gilt, H4; ein späteres RELOAD versucht es erneut.
          const zustand: QuellZustand = { art: 'show', showPfad: e.pfad, showName: e.gemerkt.showName, quellHinweis: { art: 'H4', grund: e.grund }, master: null };
          return { zustand, tsv: null, beobachte: 'iveo-data', merke: BLEIBT, vorlage: false, log: [] };
        }
        const zustand: QuellZustand = { art: 'ordner', showPfad: e.pfad, showName: e.gemerkt?.showName ?? null, quellHinweis: null, master: null };
        // Ohne eigenen Ordner gilt keiner (die Liste ist leer, „Kein Datenordner aktiv …“): Die Zeile sagt das.
        const folge = e.mitEigenemOrdner ? 'eigener Ordner gilt' : 'kein eigener Ordner eingetragen';
        return { zustand, tsv: null, beobachte: 'eigener', merke: BLEIBT, vorlage: false, log: [`Gemerkte Show nicht lesbar (${e.grund}), ${folge}.`] };
      }
      // Deep-Link oder RELOAD (und eine nicht schreibbare TSV im Master-Weg): Art und Liste bleiben;
      // H4 nur bei Art show bzw. master.
      const quellHinweis: Hinweis | null = z.art === 'show' || z.art === 'master' ? { art: 'H4', grund: e.grund } : z.quellHinweis;
      return { zustand: { ...z, quellHinweis }, tsv: null, beobachte: beobachteFuer(z.art), merke: BLEIBT, vorlage: false, log: [] };
    }
    case 'ordnerGewaehlt':
    case 'zurueckZumOrdner':
      return {
        zustand: { art: 'ordner', showPfad: null, showName: null, quellHinweis: null, master: null },
        tsv: null,
        beobachte: 'eigener',
        merke: { t: 'loeschen' },
        vorlage: false,
        log: [],
      };
    case 'masterStand': {
      const speakers = e.show.iveo?.speakers ?? [];
      const seit = e.show.iveo?.speakerVeraltetSeit;
      const h7: Hinweis | null = seit ? { art: 'H7', seit } : null;
      const master = { masterId: e.masterId, masterName: e.masterName, schluessel: e.schluessel };
      const gleich = zeigtMasterShow(z, e.masterId, e.schluessel);
      if (speakers.length) {
        // Stand mit Speakern → master (wie show, Ordner iveo-data), TSV neu, H7 bei Merker. Gemerkt wird
        // nur, was sich ändert (Show, Master oder Name); sonst schriebe jeder Stand die Datei neu.
        const zustand: QuellZustand = { art: 'master', showPfad: null, showName: e.show.name, quellHinweis: h7, master };
        const wert: GemerkteShowMaster = { quelle: 'master', masterId: e.masterId, schluessel: e.schluessel, showName: e.show.name };
        const unveraendert = gleich && z.art === 'master' && z.showName === e.show.name;
        return { zustand, tsv: speakers, beobachte: 'iveo-data', merke: unveraendert ? BLEIBT : { t: 'schreiben', wert }, vorlage: false, log: [] };
      }
      if (gleich) {
        // Gleiche Show, keine Speaker: Art und Liste bleiben; bei master H7 bzw. H3.
        const quellHinweis: Hinweis | null = z.art === 'master' ? (h7 ?? { art: 'H3' }) : null;
        return { zustand: { ...z, showName: e.show.name, quellHinweis, master }, tsv: null, beobachte: beobachteFuer(z.art), merke: BLEIBT, vorlage: false, log: [] };
      }
      // Neue Show, keine Speaker → eigener Ordner. Die gemerkte Show wird gelöscht: ein Neustart fände
      // sonst die Liste der vorigen Show als Quelle master.
      return {
        zustand: { art: 'ordner', showPfad: null, showName: e.show.name, quellHinweis: null, master },
        tsv: null,
        beobachte: 'eigener',
        merke: { t: 'loeschen' },
        vorlage: false,
        log: [],
      };
    }
    case 'verbundEnde':
      // Nur die Quelle master endet: frueher (Q3), die TSV bleibt (Spec 17.2). Andere Quellen bleiben.
      if (z.art !== 'master') return { zustand: z, tsv: null, beobachte: beobachteFuer(z.art), merke: BLEIBT, vorlage: false, log: [] };
      return { zustand: { ...z, art: 'frueher', quellHinweis: null }, tsv: null, beobachte: 'iveo-data', merke: BLEIBT, vorlage: false, log: [] };
  }
}

/**
 * Die `speakers.tsv` einer gelesenen Show ließ sich nicht schreiben (`s` ist der Schritt, der sie schreiben wollte).
 * Der Schritt gilt nicht: Sonst nennte Q1 die neue Show über der Liste der vorigen, und die gemerkte Show stünde mit
 * Speakern da. Die Show zählt wie nicht lesbar — Quelle, Liste und gemerkte Show bleiben, H4 bei Art `show`, ein
 * späteres RELOAD versucht es erneut. Nur der Vorlagen-Import (C3) des Deep-Links bleibt, wie er war.
 */
export function tsvNichtGeschrieben(
  z: QuellZustand,
  s: QuellSchritt,
  e: { weg: QuellWeg; pfad: string; grund: string; gemerkt: GemerkteShowPfad | null; mitEigenemOrdner: boolean },
): QuellSchritt {
  const nichtLesbar = quellSchritt(z, { t: 'nichtLesbar', ...e, grund: `speakers.tsv nicht schreibbar: ${e.grund}` });
  return { ...nichtLesbar, vorlage: s.vorlage };
}

/**
 * Logzeilen eines Schritts nach dem Schreiben der gemerkten Show: „Show gemerkt“ (Spec 7.9) nur, wenn sie wirklich
 * gespeichert ist. Ohne Schreiben (`merke` nicht `schreiben`) bleiben die Zeilen, wie sie sind.
 */
export function logNachMerken(s: QuellSchritt, gespeichert: boolean): string[] {
  if (s.merke.t !== 'schreiben' || gespeichert || istMasterForm(s.merke.wert)) return s.log;
  const zeile = gemerktZeile(s.merke.wert.showPfad);
  return s.log.filter((z) => z !== zeile);
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

/** Ist `pfad` die Show, die die Datenquelle gerade anzeigt (`z.showPfad`)? Nicht die zuletzt versuchte. */
export function zeigtShow(z: QuellZustand, pfad: string, aufloesen: (p: string) => string): boolean {
  return z.showPfad !== null && gleicheShowPfad(z.showPfad, pfad, aufloesen);
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
 * Bei `frueher` ohne Einträge (die alte `speakers.tsv` fehlt oder ist leer) ebenfalls leer: Q3 sagte sonst
 * Speaker zu, wo keine sind; es greift die Leer-Anzeige.
 */
export function quellZeile(z: QuellZustand, ordner: string, anzahl: number): string {
  if (z.art === 'show') return `Quelle: Show „${z.showName ?? ''}“ · ${anzahl} Speaker`;
  // Q4 (Spec 16.5): die Show vom Master; der volle Name, die Zeile kürzt die Oberfläche.
  if (z.art === 'master') return `Quelle: Show vom Master „${z.showName ?? ''}“`;
  if (z.art === 'frueher') return anzahl > 0 ? 'Quelle: Speaker aus einer früheren Show' : '';
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

/**
 * Ordnerwahl unter Einstellungen › DataLink (Spec 17.2, Owner O1): Trägt die Show am Master Speaker
 * (Quelle `master`), ist sie gesperrt — Rückgabe ist der Text dazu. Sonst `null` (frei wählbar).
 */
export function ordnerWahlGesperrt(z: QuellZustand): string | null {
  if (z.art !== 'master') return null;
  return `Im Verbund kommen die Speaker vom Master „${z.master?.masterName ?? ''}“. Ein eigener Ordner gilt, solange die Show dort keine Speaker hat.`;
}

/**
 * Sperre im Main für einen Config-Patch (E22): Lehnt der Main den `dataFolder` des Patches ab? Nur wenn er gesetzt
 * ist, sich vom bisherigen Ordner unterscheidet und die Ordnerwahl gesperrt ist; dann der Text aus 17.2 für die
 * Warnung, sonst `null`. Der Rest des Patches gilt in jedem Fall.
 */
export function ordnerPatchAbgelehnt(neu: string | undefined, vorher: string, z: QuellZustand): string | null {
  if (neu === undefined || neu === vorher) return null;
  return ordnerWahlGesperrt(z);
}

/**
 * Endet mit dieser Lage aus app-runtime (`VerbundDaten.art`) der Verbund für die Quelle `master` (Spec 16.1, 17.2)?
 * Ja bei `frueher`, `einzelplatz` und `datei-defekt`: Der Rechner folgt keinem Master mehr — auch dann, wenn noch
 * nichts angewendet ist (Start mit gemerkter Master-Form ohne lesbaren Zwischenspeicher, danach entkoppelt). Sonst
 * bliebe die Ordnerwahl gesperrt, und Q4 nennte eine Show vom Master, der nicht mehr gilt. Die anderen Lagen
 * (`warte`, `ohne-daten`, `aktuell`, `getrennt`) gehören zu einem laufenden Verbund.
 */
export function verbundEndetFuer(z: QuellZustand, lage: string): boolean {
  return z.art === 'master' && (lage === 'frueher' || lage === 'einzelplatz' || lage === 'datei-defekt');
}
