// Testhilfen der Timer-Oberflächentests (UX Welle 1): feste Zustände und Attrappen für Render- und Ableitungstests.
// Wächst mit den Aufgaben c bis d; Aufgabe b liefert den Zustand der Fernsteuerungs-Meldung.
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import { useStore, type AppState } from '@/store/timer';

/** Meldung eines laufenden Steuerservers ohne Clients (Port 8724, offener Modus). */
export function basisMeldung(z: Partial<FernsteuerungMeldung> = {}): FernsteuerungMeldung {
  return { laeuft: true, port: 8724, clients: 0, modus: 'open', ...z };
}

// ── Aufgabe d: Render-Hilfen (aus apps/titler/test/ui/testzustand.ts, auf den Timer-Store angepasst) ──
/**
 * Führt f mit einem Store-Zustand aus. Beim Server-Render liest zustand 4.5.7 den Anfangszustand (getInitialState); ein
 * setState wirkt dort nicht. Deshalb werden dessen Felder für die Dauer von f gesetzt und danach zurückgestellt.
 */
export function mitStore<T>(patch: Partial<AppState>, f: () => T): T {
  const anfang = useStore.getInitialState() as unknown as Record<string, unknown>;
  const vorher: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) vorher[k] = anfang[k];
  Object.assign(anfang, patch);
  try {
    return f();
  } finally {
    Object.assign(anfang, vorher);
  }
}

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

/** Das Element mit diesem data-timer-Wert samt Inhalt (Ende am passenden schließenden Tag gleichen Namens). */
export function bereich(html: string, marke: string): string {
  const m = new RegExp(`<(\\w+)\\s[^>]*data-timer="${marke}"[^>]*>`).exec(html);
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
