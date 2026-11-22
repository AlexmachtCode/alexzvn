// Testhilfen der Interpreter-Oberflächentests (UX Welle 2a, Aufgabe b): feste Zustände und Attrappen für Render- und
// Ableitungstests. Wächst mit den Aufgaben c bis d; Aufgabe d bringt die Render-Hilfen (aus apps/caption/test/ui/testzustand.ts),
// Zustände der Engine und der Einstellungen, Geräte und die Attrappen von Motor, Store und Preload.
import { readdirSync } from 'node:fs';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import type { Devices, EngineState } from '@/core/engine';
import type { InterpreterMotor, InterpreterStore } from '@/lib/aktionen';
import type { Einstellungen, GeraeteStand, OberflaechenStand } from '@/lib/oberflaeche';
import { useSettings } from '@/store/settings';

/** Quelltext ohne Kommentare (Zeilen- und Blockkommentare), für Prüfungen am Code. */
export function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

// ── Aufgabe d: Zustände, Geräte, Attrappen und Render-Hilfen ──

/** Zwei Eingänge, darunter die Aufnahmeseite von VB-CABLE, und zwei Ausgänge (VB-CABLE und ein Lautsprecher). */
export const EINGAENGE = [
  { deviceId: 'mic-a', label: 'Mikro Saal' },
  { deviceId: 'mic-b', label: 'Dolmetschkabine' },
  { deviceId: 'cable-out', label: 'Standard - CABLE Output (VB-Audio Virtual Cable)' },
];
export const AUSGAENGE = [
  { deviceId: 'cable-in', label: 'CABLE Input (VB-Audio Virtual Cable)' },
  { deviceId: 'lautsprecher', label: 'Lautsprecher (Realtek Audio)' },
  { deviceId: 'vm-in', label: 'VoiceMeeter Input (VB-Audio VoiceMeeter VAIO)' },
];

/** Zustand der Engine wie getState() (Vorgabe: steht, kein Fehler). */
export function motor(p: Partial<EngineState> = {}): EngineState {
  return { running: false, ducking: false, floorDb: -Infinity, interpreterDb: -Infinity, error: null, startedOutputId: null, ...p };
}

export function einst(p: Partial<Einstellungen> = {}): Einstellungen {
  return { floorId: 'mic-a', interpreterId: 'mic-b', outputId: 'cable-in', bypass: false, ...p };
}

export function geraete(p: Partial<GeraeteStand> = {}): GeraeteStand {
  return { eingaenge: EINGAENGE, ausgaenge: AUSGAENGE, labelsAvailable: true, ...p };
}

/** Stand nach den ersten Antworten (Engine steht, Einstellungen gelesen, Geräte gemessen, Master-Link aus, nichts gestartet). */
export function stand(p: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return { engine: motor(), einstellungen: einst(), geraete: geraete(), masterLink: { art: 'aus' }, gestartet: null, ...p };
}

/** Stand, den die Oberfläche vor jeder Antwort bildet (Engine-Effekt noch nicht gelaufen, Geräte offen, Brücke offen). */
export const STAND_ANFANG: OberflaechenStand = { engine: undefined, einstellungen: einst({ floorId: '', interpreterId: '', outputId: '' }), geraete: undefined, masterLink: undefined, gestartet: null };

/** Attrappe des Motors (InterpreterEngine.start/stop); jeder Aufruf landet im Protokoll. */
export function motorAttrappe(log: string[]): InterpreterMotor {
  return {
    start: async (d: Devices) => void log.push(`start:${JSON.stringify(d)}`),
    stop: async () => void log.push('stop'),
  };
}

/** Attrappe des Stores (useSettings: set und reset); jeder Aufruf landet im Protokoll. */
export function storeAttrappe(log: string[]): Pick<InterpreterStore, 'set' | 'reset'> {
  return {
    set: ((key: string, value: unknown) => void log.push(`set:${key}=${JSON.stringify(value)}`)) as InterpreterStore['set'],
    reset: () => void log.push('reset'),
  };
}

/**
 * Führt f mit einem Store-Zustand aus. Beim Server-Render liest zustand den Anfangszustand (getInitialState); ein setState
 * wirkt dort nicht. Deshalb werden dessen Felder für die Dauer von f gesetzt und danach zurückgestellt.
 */
export function mitStore<T>(patch: Partial<ReturnType<typeof useSettings.getState>>, f: () => T): T {
  const anfang = useSettings.getInitialState() as unknown as Record<string, unknown>;
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

/**
 * Inhalt eines Elements `<name …>…</name>` ab einem Merkmal im öffnenden Tag, mit Verschachtelung gleichen Namens (zählt
 * öffnende und schließende Tags dieses Namens).
 */
export function element(html: string, name: string, merkmal: string): string {
  const a = html.search(new RegExp(`<${name}(?=[\\s>])[^>]*${merkmal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  if (a < 0) return '';
  const re = new RegExp(`<(/?)${name}(?=[\\s>])[^>]*>`, 'g');
  re.lastIndex = a;
  let tiefe = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    tiefe += m[1] === '/' ? -1 : 1;
    if (tiefe === 0) return html.slice(a, m.index + m[0].length);
  }
  return html.slice(a);
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

/** Alle Quelldateien unter src/renderer/src (relativ zu apps/interpreter), auch CSS. */
export function quellen(d = 'src/renderer/src'): string[] {
  return readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? quellen(`${d}/${e.name}`) : /\.(tsx?|css)$/.test(e.name) ? [`${d}/${e.name}`] : []));
}
