// Texte der Hinweise an den Bediener (Spec 4.6), wortgleich zur Spec. Rein und
// ohne Laufzeit-Importe (G2), damit test/selftest.ts sie ohne Electron prüft.
// Der Main hängt sie an RundownState.hinweise; der Renderer zeigt sie nur an.
import type { ShowIveoProgramRef } from '@jm/show';
import type { AbgleichBericht } from './abgleich';

/** RELOAD ohne gemerkte Show (5.1): wortgleich zur Log-Warnung des Timers. */
export const RELOAD_OHNE_SHOW =
  'RELOAD empfangen, aber keine Show geladen (nicht per Show gestartet) — nichts neu eingelesen.';

/** Eigene Rundown-Datei wurde außerhalb geändert (4.8). */
export const DATEI_AUSSERHALB = 'Rundown-Datei wurde außerhalb geändert, Datei geladen.';

/**
 * Defektes Gedächtnis (Review-Focus 2). Steht NICHT in Spec 4.6 — der Text ist
 * eine Ergänzung dieser Umsetzung (im Plan unter „offene Fragen“ vermerkt).
 */
export const GEDAECHTNIS_DEFEKT =
  'Gespeicherter Stand dieser Show war beschädigt und wurde beiseitegelegt.';

/**
 * Kurzer Hinweis nach einem Abgleich: „iveo: 2 geändert · 1 neu · 1 entfallen ·
 * 1 wieder da · neu sortiert“. Nur Teile mit Zähler > 0; `entfallen` und
 * `entfernt` zählen zusammen als „entfallen“. null, wenn kein Teil zu nennen ist.
 */
export function berichtText(b: AbgleichBericht, mitIveo: boolean): string | null {
  const teile: string[] = [];
  if (b.geaendert > 0) teile.push(`${b.geaendert} geändert`);
  if (b.neu > 0) teile.push(`${b.neu} neu`);
  const weg = b.entfallen + b.entfernt;
  if (weg > 0) teile.push(`${weg} entfallen`);
  if (b.zurueck > 0) teile.push(`${b.zurueck} wieder da`);
  if (b.verschoben > 0) teile.push('neu sortiert');
  if (teile.length === 0) return null;
  return `${mitIveo ? 'iveo' : 'Show'}: ${teile.join(' · ')}`;
}

/** Stehender Hinweis, wenn die scharfe Zeile entfallen ist (R7 c). */
export function scharfVerruecktText(v: { von: string; nach: string | null }): string {
  const anfang = `Deine scharfe Zeile „${v.von}“ ist entfallen.`;
  return v.nach === null ? `${anfang} Es gibt keine Zeile mehr.` : `${anfang} Scharf ist jetzt „${v.nach}“.`;
}

/** Kurzer Hinweis beim Kontextwechsel (4.4). */
export function kontextWechselText(kontext: string, sideEvents: ShowIveoProgramRef[]): string {
  if (kontext.startsWith('se:')) {
    const programId = kontext.slice('se:'.length);
    const titel = sideEvents.find((s) => s.id === programId)?.title;
    return `Side Event gewechselt: ${titel || programId}`;
  }
  if (kontext.startsWith('liste:')) {
    const tag = kontext.slice('liste:'.length).split('|')[0];
    return `iveo: Programmliste ${tag || 'alle Tage'}`;
  }
  return 'Show-Ablauf (ohne iveo)';
}

export function showNichtLesbarText(grund: string): string {
  return `Show nicht lesbar: ${grund}`;
}

/** Stehender Hinweis bei einer abgewiesenen Änderung (5.5). */
export function abweisungText(mitIveo: boolean): string {
  const abgleich = mitIveo ? 'ein iveo-Abgleich' : 'ein Abgleich mit der Show';
  return `Gleichzeitig kam ${abgleich}. Deine letzte Änderung wurde nicht übernommen, bitte wiederholen.`;
}

/** Kurzer Hinweis, wenn ein Sprung beim GO nicht gesendet wird (6.2). */
export function sprungEntfallenText(titel: string): string {
  return `Sprung nicht gesendet: Ziel „${titel}“ ist entfallen.`;
}
