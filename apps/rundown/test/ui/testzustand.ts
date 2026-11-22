// Testhilfen der Rundown-Oberflächentests (UX Welle 1): feste Zustände und Attrappen für Render- und Ableitungstests.
// Wächst mit den Aufgaben c bis d; Aufgabe b liefert den Zustand der Fernsteuerungs-Meldung.
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { RundownRow, RundownState } from '@shared/types';

/** Meldung eines laufenden Steuerservers ohne Clients (Port 8731, offener Modus). */
export function basisMeldung(z: Partial<FernsteuerungMeldung> = {}): FernsteuerungMeldung {
  return { laeuft: true, port: 8731, clients: 0, modus: 'open', ...z };
}

/** Leerer Rundown-Stand ohne Show und ohne Gegenstellen; `teil` überschreibt einzelne Felder. */
export function basisState(teil: Partial<RundownState> = {}): RundownState {
  return {
    doc: { schemaVersion: 2, name: 'Test', rows: [] },
    index: 0,
    scharfId: null,
    filePath: null,
    dirty: false,
    links: [],
    overrides: {},
    lastFired: null,
    iveoSpeakers: [],
    iveoSideEvents: [],
    rev: 0,
    hinweise: [],
    abweisungen: 0,
    ablaufSchluessel: [],
    eigeneTimerListe: false,
    showGemerkt: false,
    showMitIveo: false,
    ...teil,
  };
}

/** Eine Zeile ohne Aktionen. */
export function zeile(id: string): RundownRow {
  return { id, label: `Zeile ${id}`, actions: [] };
}

// ── Aufgabe d: Render-Hilfen (aus apps/timer/test/ui/testzustand.ts; der Rundown hat einen Store ohne Anfangszustand, die Views bekommen den Stand als Prop) ──
/** Quelltext ohne Kommentare (Zeilen- und Blockkommentare), für Prüfungen am Code. */
export function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function entities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Alle öffnenden Tags eines Elements, z. B. tags(html, 'button'). */
export function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}(?=[\\s>/])[^>]*>`, 'g')) ?? [];
}

/** Wert eines Attributs in einem öffnenden Tag (Entities aufgelöst), sonst undefined. */
export function attr(tag: string | undefined, name: string): string | undefined {
  const m = tag?.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? entities(m[1]) : undefined;
}

/** Text ohne Tags (Entities aufgelöst). */
export function text(html: string): string {
  return entities(html.replace(/<[^>]+>/g, ''));
}

/** Statuseinträge der Leiste in Reihenfolge: [id, Zustand, Tooltip „Label: Detail“]. */
export function statusEintraege(html: string): Array<[string | undefined, string | undefined, string | undefined]> {
  return [...html.matchAll(/<(?:button|span)\s[^>]*data-status-id="[^"]*"[^>]*>/g)].map((m) => [
    attr(m[0], 'data-status-id'),
    attr(m[0], 'data-state'),
    attr(m[0], 'title'),
  ]);
}

/** Das Element mit diesem data-rundown-Wert samt Inhalt (Ende am passenden schließenden Tag gleichen Namens). */
export function bereich(html: string, marke: string): string {
  const m = new RegExp(`<(\\w+)\\s[^>]*data-rundown="${marke}"[^>]*>`).exec(html);
  if (!m) return '';
  const name = m[1];
  const re = new RegExp(`<${name}(?=[\\s>/])[^>]*>|</${name}>`, 'g');
  re.lastIndex = m.index;
  let tiefe = 0;
  for (let t = re.exec(html); t; t = re.exec(html)) {
    tiefe += t[0].startsWith('</') ? -1 : 1;
    if (tiefe === 0) return html.slice(m.index, t.index + t[0].length);
  }
  return html.slice(m.index);
}

/** Eine Zeile mit Aktionen, für Liste und Editor. */
export function zeileMitAktion(id: string): RundownRow {
  return { id, label: `Zeile ${id}`, actions: [{ id: `a-${id}`, role: 'timer', verb: 'start', args: [], enabled: true }] };
}
