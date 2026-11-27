// Testhilfen der Caption-Oberflächentests (UX Welle 2a, Aufgabe b): feste Zustände für Ableitungstests. Wächst mit den
// Aufgaben c bis d; Aufgabe b liefert den Zustand der Fernsteuerungs-Meldung, Aufgabe d die Render-Hilfen (aus
// apps/recorder/test/ui/testzustand.ts, auf den Caption-Store angepasst), Antworten des Main, Geräte und Store-Attrappen.
import { readdirSync } from 'node:fs';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { CaptionConfig, CaptionLine, CaptionState, CaptionStatus } from '@shared/types';
import type { CaptionStore } from '@/lib/aktionen';
import type { MikrofonGeraet } from '@/lib/oberflaeche';
import { useCaption } from '@/store/useCaption';

/** Meldung eines laufenden Steuerservers ohne Clients (Port 8732, offener Modus). */
export function basisMeldung(z: Partial<FernsteuerungMeldung> = {}): FernsteuerungMeldung {
  return { laeuft: true, port: 8732, clients: 0, modus: 'open', ...z };
}

/** Quelltext ohne Kommentare (Zeilen- und Blockkommentare), für Prüfungen am Code. */
export function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

// ── Aufgabe d: Antworten des Main, Geräte, Store-Attrappen und Render-Hilfen ──

/** Konfiguration wie die Vorgaben des Main (src/main/index.ts), Quellname „JM Caption“. */
export const CONFIG: CaptionConfig = {
  model: 'base',
  language: 'de',
  maxUtteranceSec: 8,
  silenceMs: 700,
  silenceThreshold: 0.012,
  audioInputDeviceId: '',
  dictionary: '',
  engine: 'server',
  ndiName: 'JM Caption',
  ndiWidth: 1920,
  ndiHeight: 1080,
  ndiFps: 30,
  ndiFontSize: 54,
  ndiLines: 2,
  ndiBand: true,
};

/** Zwei gemessene Audio-Eingänge (wie die View sie aus listAudioInputs bildet). */
export const GERAETE: MikrofonGeraet[] = [
  { id: 'mic-1', label: 'Shure MV7' },
  { id: 'mic-2', label: 'Headset' },
];

/** Drei Zeilen des Verlaufs, die jüngste zuletzt (wie im Main). */
export const ZEILEN: CaptionLine[] = [
  { id: 'l1', text: 'Guten Abend und willkommen.', at: 1 },
  { id: 'l2', text: 'Wir beginnen mit dem ersten Vortrag.', at: 2 },
  { id: 'l3', text: 'Bitte nehmen Sie Platz.', at: 3 },
];

export function status(z: Partial<CaptionStatus> = {}): CaptionStatus {
  return { ndiActive: false, connections: 0, ndiSendet: false, ndiNetzName: null, ...z };
}

/** Antwort des Main (CaptionState). Bis zur ersten Antwort ist der Wert im Stand `undefined`, nicht eine solche Vorgabe. */
export function caption(
  z: Partial<Omit<CaptionState, 'config' | 'status'>> & { config?: Partial<CaptionConfig>; status?: Partial<CaptionStatus> } = {},
): CaptionState {
  const { config, status: st, ...rest } = z;
  return { running: false, hold: false, busy: false, whisperAvailable: true, lines: [], leerungen: 0, error: null, ...rest, config: { ...CONFIG, ...config }, status: status(st) };
}

/** Attrappe der Store-Aktionen unter ihren Namen im Store (store/useCaption.ts); jeder Aufruf landet im Protokoll. */
export function store(log: string[]): CaptionStore {
  return {
    setConfig: async (patch) => void log.push(`setConfig:${JSON.stringify(patch)}`),
    start: async () => void log.push('start'),
    stop: async () => void log.push('stop'),
    setHold: async (h) => void log.push(`setHold:${h}`),
    clear: async () => void log.push('clear'),
    correctLine: async (id, t) => void log.push(`correctLine:${id}:${t}`),
    ndiStart: async (name) => void log.push(`ndiStart:${name}`),
    ndiStop: async () => void log.push('ndiStop'),
  };
}

/**
 * Führt f mit einem Store-Zustand aus. Beim Server-Render liest zustand den Anfangszustand (getInitialState); ein setState
 * wirkt dort nicht. Deshalb werden dessen Felder für die Dauer von f gesetzt und danach zurückgestellt.
 */
export function mitStore<T>(patch: Partial<ReturnType<typeof useCaption.getState>>, f: () => T): T {
  const anfang = useCaption.getInitialState() as unknown as Record<string, unknown>;
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

/** Inhalt des ersten Elements `<name …>…</name>` ab einem Merkmal im öffnenden Tag (ohne Verschachtelung gleichen Namens). */
export function element(html: string, name: string, merkmal: string): string {
  const a = html.search(new RegExp(`<${name}(?=[\\s>])[^>]*${merkmal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  if (a < 0) return '';
  const b = html.indexOf(`</${name}>`, a);
  return html.slice(a, b < 0 ? undefined : b + name.length + 3);
}

/** Wartet, bis offene Promise-Rückrufe gelaufen sind. */
export const warte = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/**
 * Alle React-Elemente eines Baums, ohne Bausteine aufzurufen: Nur props.children wird durchlaufen. Für Ansichten ohne Hooks
 * (LiveBereich, Einstellungen), die sich direkt aufrufen lassen; so prüfen die Tests die Rückrufe am Element.
 */
export function elemente(n: ReactNode): Array<ReactElement<Record<string, unknown>>> {
  if (Array.isArray(n)) return n.flatMap(elemente);
  if (!isValidElement(n)) return [];
  const el = n as ReactElement<Record<string, unknown>>;
  return [el, ...elemente(el.props.children as ReactNode)];
}

/** Sichtbarer Text eines Elements aus dem Baum (nur Zeichenketten und Zahlen unter children). */
export function elementText(n: ReactNode): string {
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(elementText).join('');
  if (!isValidElement(n)) return '';
  return elementText((n.props as { children?: ReactNode }).children);
}

/** Alle Quelldateien unter src/renderer/src (relativ zu apps/caption), auch CSS. */
export function quellen(d = 'src/renderer/src'): string[] {
  return readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? quellen(`${d}/${e.name}`) : /\.(tsx?|css)$/.test(e.name) ? [`${d}/${e.name}`] : []));
}
