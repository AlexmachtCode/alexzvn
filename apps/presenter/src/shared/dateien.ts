// #298/#299: reine Regeln zum Öffnen von Dateien (Drag & Drop, Doppelklick, „Öffnen mit“).
// Wird auch im Renderer gebündelt: keine Node-/Electron-Importe.
import type { GeladeneDateien, ImportedFile, OfficeAnimations } from './types';

export type DateiArt = 'pdf' | 'image' | 'office' | 'projekt';
export type OeffnenModus = 'ersetzen' | 'anhaengen' | 'fragen';

/** Ruhezeit, nach der gesammelte Dateien als EIN Vorgang abgegeben werden. */
export const SAMMEL_MS = 500;

/** Höchstens so viele Pfade nimmt der Hauptprozess (`files:importPaths`) je Aufruf an. */
export const MAX_PFADE_JE_AUFRUF = 200;

export const IMAGE_EXT: ReadonlySet<string> = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);
export const OFFICE_EXT: ReadonlySet<string> = new Set(['.pptx', '.ppt', '.odp', '.docx', '.doc', '.odt', '.rtf']);

/** Letztes Pfadsegment, trennt an `/` und `\`. */
export function dateiName(pfad: string): string {
  return pfad.split(/[\\/]/).pop() ?? pfad;
}

export function dateiArt(pfad: string): DateiArt | null {
  const name = dateiName(pfad);
  const punkt = name.lastIndexOf('.');
  if (punkt < 0) return null;
  const ext = name.slice(punkt).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (ext === '.jmpres') return 'projekt';
  if (IMAGE_EXT.has(ext)) return 'image';
  if (OFFICE_EXT.has(ext)) return 'office';
  return null;
}

export interface DateiOrdnung {
  importieren: { pfad: string; art: 'pdf' | 'image' | 'office' }[];
  projekt: string | null;
  /** Volle Pfade wie übergeben. */
  nichtUnterstuetzt: string[];
  /** Volle Pfade wie übergeben. */
  projektUebersprungen: string[];
}

export function ordneDateien(pfade: readonly string[]): DateiOrdnung {
  const importieren: DateiOrdnung['importieren'] = [];
  const projekte: string[] = [];
  const nichtUnterstuetzt: string[] = [];
  for (const pfad of pfade) {
    const art = dateiArt(pfad);
    if (art === null) nichtUnterstuetzt.push(pfad);
    else if (art === 'projekt') projekte.push(pfad);
    else importieren.push({ pfad, art });
  }
  // Eine Projektdatei zählt nur, wenn sie ganz allein abgelegt wurde.
  const allein = projekte.length === 1 && importieren.length === 0 && nichtUnterstuetzt.length === 0;
  return {
    importieren,
    projekt: allein ? projekte[0] : null,
    nichtUnterstuetzt,
    projektUebersprungen: allein ? [] : projekte,
  };
}

export function hinweiseAusOrdnung(o: DateiOrdnung): string[] {
  const hinweise: string[] = [];
  if (o.nichtUnterstuetzt.length) {
    hinweise.push(`Nicht unterstützt, übersprungen: ${o.nichtUnterstuetzt.map(dateiName).join(', ')}`);
  }
  if (o.projektUebersprungen.length) {
    hinweise.push(`Projektdatei nur einzeln ablegen, übersprungen: ${o.projektUebersprungen.map(dateiName).join(', ')}`);
  }
  return hinweise;
}

/** Hinweis für abgelegte Dateien ohne Pfad auf der Platte (aus dem Browser oder einer Mail gezogen). */
export function hinweisOhnePfad(namen: readonly string[]): string | null {
  if (!namen.length) return null;
  return `Ohne Dateipfad, übersprungen: ${namen.join(', ')} (bitte zuerst speichern und dann hineinziehen).`;
}

/**
 * Lädt beliebig viele Pfade über `laden`, das höchstens `max` je Aufruf annimmt, nie still
 * nichts (#298). Bis `max` geht alles in einem Aufruf. Darüber ordnet diese Funktion selbst
 * (eine Projektdatei ist dann nie allein, sie wird übersprungen) und lädt nur die
 * importierbaren Pfade, in Portionen nacheinander.
 */
export async function ladeInPortionen(
  pfade: readonly string[],
  laden: (teil: string[]) => Promise<GeladeneDateien>,
  max = MAX_PFADE_JE_AUFRUF,
): Promise<GeladeneDateien> {
  if (!pfade.length) return { files: [], projekt: null, hinweise: [] };
  if (pfade.length <= max) return laden([...pfade]);
  const ordnung = ordneDateien(pfade);
  const files: ImportedFile[] = [];
  const hinweise = hinweiseAusOrdnung(ordnung);
  const importieren = ordnung.importieren.map((i) => i.pfad);
  for (let i = 0; i < importieren.length; i += max) {
    const g = await laden(importieren.slice(i, i + max));
    files.push(...g.files);
    hinweise.push(...g.hinweise);
  }
  return { files, projekt: null, hinweise };
}

/** Dateipfade aus der Kommandozeile: ohne Schalter, Links und den Wert von `--show`. */
export function pfadeAusArgv(argv: readonly string[], istDatei: (p: string) => boolean): string[] {
  const aus: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--show') { i++; continue; }
    if (a.startsWith('-') || a.includes('://')) continue;
    if (dateiArt(a) === null || !istDatei(a)) continue;
    if (!aus.includes(a)) aus.push(a);
  }
  return aus;
}

export function wieOeffnen(modus: OeffnenModus, folienVorhanden: boolean): OeffnenModus {
  return modus === 'fragen' && !folienVorhanden ? 'ersetzen' : modus;
}

/** Bündelt Eingaben; nach `warteMs` Ruhe genau eine Abgabe (ohne Dubletten), dann wieder leer. */
export function erstelleSammler(warteMs: number, abgabe: (pfade: string[]) => void): (pfade: readonly string[]) => void {
  let gesammelt: string[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (pfade) => {
    for (const p of pfade) if (!gesammelt.includes(p)) gesammelt.push(p);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const fertig = gesammelt;
      gesammelt = [];
      timer = null;
      if (fertig.length) abgabe(fertig);
    }, warteMs);
  };
}

export function aufbauHinweise(
  anim: OfficeAnimations | undefined,
  seiten: number,
  expanded: boolean,
): { notizen: (string | null)[]; hinweis: string | null } {
  const passt = !!anim && anim.perSlide.length === seiten;
  const notizen = Array.from({ length: seiten }, (_, i) => {
    const n = passt ? anim!.perSlide[i] : 0;
    return n > 0 ? `▸ Original-Animation: ${n} Aufbau-Klick(s) auf dieser Folie.` : null;
  });
  let hinweis: string | null = null;
  if (expanded) {
    hinweis = `Aufbau-Animationen als Einzelschritte importiert — ${seiten} Schritt-Folien (experimentell).`;
  } else if (anim && anim.animatedSlides > 0) {
    hinweis = `${anim.animatedSlides} Folie(n) hatten Aufbau-Animationen (${anim.totalBuilds} Klicks) — als Notiz vermerkt.`;
  }
  return { notizen, hinweis };
}
