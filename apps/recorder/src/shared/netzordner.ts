// Zielordner aus einer .jmshow (Altfehler RE-7b, B4): dieselbe Prüfung wie beim Preset-Import (`istErlaubterOrdner`, `istNetzwerkPfad`).
// Rein, ohne Electron und ohne Dateizugriff: der Main fragt mit `pruefeShowOrdner`, ob er den Ordner setzen darf, ob ein Netzwerkordner
// erst im Fenster bestätigt werden muss oder ob er ungültig ist; der Store vergleicht mit `normiereOrdner` (D2).
import { istErlaubterOrdner, istNetzwerkPfad } from './presets';

/** Vergleichsform eines Ordners: Schrägstriche zu `\`, Groß/Klein egal (klein), ohne `\` am Ende. Nur zum Vergleichen, nie zum Schreiben. */
export function normiereOrdner(p: string): string {
  return p.replace(/\//g, '\\').toLowerCase().replace(/\\+$/, '');
}

export type ShowOrdnerArt = 'setzen' | 'bestaetigen' | 'ungueltig';

/**
 * Ein Ordner, der weder Laufwerkspfad noch übliche Freigabe ist, ist ungültig (wie beim Import); ein Netzwerkordner, den `istBestaetigt`
 * nicht kennt, wartet auf die Bestätigung im Fenster; alles andere wird gesetzt.
 */
export function pruefeShowOrdner(dir: string, istBestaetigt: (p: string) => boolean): { art: ShowOrdnerArt; dir: string } {
  if (!istErlaubterOrdner(dir)) return { art: 'ungueltig', dir };
  if (istNetzwerkPfad(dir) && !istBestaetigt(dir)) return { art: 'bestaetigen', dir };
  return { art: 'setzen', dir };
}
