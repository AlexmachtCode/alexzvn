// Testhilfen der Stage-Display-Oberflächentests (UX Welle 2a, Aufgabe b): feste Zustände und Attrappen für Render- und
// Ableitungstests. Wächst mit den Aufgaben c bis d.
import type { AusgabeZustand } from '@jm/output-window/zustand';
import type { StageConfig, StageState } from '@shared/types';
import { useStage } from '@/store/stage';

/** Ausgabezustand „offen“ auf Bildschirm 2. */
export function offenerSchirm(z: Partial<AusgabeZustand> = {}): AusgabeZustand {
  return { art: 'offen', displayId: 2, ...z };
}

/** Quelltext ohne Kommentare (Zeilen- und Blockkommentare), für Prüfungen am Code. */
export function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

// ── Aufgabe d: Render-Hilfen (aus apps/prompter/test/ui/testzustand.ts, auf den Stage-Store angepasst) ──

/** Ein vollständiger Zustand: alle Quellen aus und getrennt, Standard-Anzeige-Elemente, Nachricht leer. */
export function stageZustand(teil: { config?: Partial<StageConfig>; verbunden?: [boolean, boolean, boolean] } = {}): StageState {
  const v = teil.verbunden ?? [false, false, false];
  const config: StageConfig = {
    timer: { enabled: false, host: '127.0.0.1', port: 7777 },
    switcher: { enabled: false, host: '127.0.0.1', port: 8723 },
    presenter: { enabled: false, host: '127.0.0.1', port: 7330, pin: '', mode: 'ref' },
    widgets: { clock: true, timer: true, switcher: true, message: true, presenter: true },
    message: '',
    outputDisplayId: null,
    ...teil.config,
  };
  return {
    config,
    timer: { connected: v[0], countdown: null, activeLabel: null, nextLabel: null, colors: { normal: '#fff', warning: '#fff', overtime: '#fff', warningAtSec: 60 }, message: '', blinking: false },
    switcher: { connected: v[1], program: 0, preview: 0, recording: false, streaming: false, scenes: 0 },
    presenter: { connected: v[2], active: false, index: 0, total: 0, title: '', notes: '', nextTitle: null, screen: 'live', rev: 0 },
  };
}

/**
 * Führt f mit einem Store-Zustand aus. Beim Server-Render liest zustand den Anfangszustand (getInitialState); ein setState
 * wirkt dort nicht. Deshalb werden dessen Felder für die Dauer von f gesetzt und danach zurückgestellt.
 */
export function mitStore<T>(patch: Partial<ReturnType<typeof useStage.getState>>, f: () => T): T {
  const anfang = useStage.getInitialState() as unknown as Record<string, unknown>;
  const vorher: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) vorher[k] = anfang[k];
  Object.assign(anfang, patch);
  try {
    return f();
  } finally {
    Object.assign(anfang, vorher);
  }
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
  return [...html.matchAll(/<(?:button|span)\s[^>]*data-status-id="[^"]*"[^>]*>/g)].map((m) => [attr(m[0], 'data-status-id'), attr(m[0], 'data-state'), attr(m[0], 'title')]);
}

/** Der Abschnitt mit dem Anker einstellung-{id}: vom Anker bis zum nächsten Anker (bzw. bis zum Ende). */
export function abschnitt(html: string, id: string): string {
  const a = html.indexOf(`id="einstellung-${id}"`);
  if (a < 0) return '';
  const b = html.indexOf('id="einstellung-', a + 1);
  return html.slice(a, b < 0 ? undefined : b);
}
