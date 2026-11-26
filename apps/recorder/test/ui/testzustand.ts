// Testhilfen der Recorder-Oberflächentests (UX Welle 2a, Aufgabe b): feste Zustände und Attrappen für Render- und
// Ableitungstests. Wächst mit den Aufgaben c bis d; Aufgabe b liefert den Zustand der Fernsteuerungs-Meldung, Aufgabe d die
// Render-Hilfen (aus apps/player/test/ui/testzustand.ts, auf den Recorder-Store angepasst), Geräte und gemessene Zustände.
import { readdirSync } from 'node:fs';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { AudioDevice, RecorderState, RecorderStatus } from '@shared/types';
import { useRec } from '@/store/recorder';

/** Meldung eines laufenden Steuerservers ohne Clients (Port 8729, offener Modus). */
export function basisMeldung(z: Partial<FernsteuerungMeldung> = {}): FernsteuerungMeldung {
  return { laeuft: true, port: 8729, clients: 0, modus: 'open', ...z };
}

/** Quelltext ohne Kommentare (Zeilen- und Blockkommentare), für Prüfungen am Code. */
export function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

// ── Aufgabe d: Geräte, gemessene Zustände und Render-Hilfen ──

/** Zwei Eingänge: ein ASIO-Gerät mit 64 Kanälen (Index 0) und ein Mikrofon mit 2 Kanälen (Index 3). */
export const GERAETE: AudioDevice[] = [
  { index: 0, name: 'Dante Virtual Soundcard', hostApiName: 'ASIO', maxInputChannels: 64, defaultSampleRate: 48000 },
  { index: 3, name: 'Mikro', hostApiName: 'MME', maxInputChannels: 2, defaultSampleRate: 44100 },
];

/** Gemessener Zustand des Hauptprozesses; offen = Gerät 3 mit 2 Kanälen und 44100 Hz. */
export function zustand(status: RecorderStatus, z: Partial<RecorderState> = {}): RecorderState {
  const offen = status !== 'idle';
  return { status, device: offen ? 3 : null, channels: offen ? 2 : 0, sampleRate: offen ? 44100 : 0, filePath: null, recordedSec: 0, fehler: null, spuren: false, ...z };
}

/**
 * Führt f mit einem Store-Zustand aus. Beim Server-Render liest zustand den Anfangszustand (getInitialState); ein setState
 * wirkt dort nicht. Deshalb werden dessen Felder für die Dauer von f gesetzt und danach zurückgestellt.
 */
export function mitStore<T>(patch: Partial<ReturnType<typeof useRec.getState>>, f: () => T): T {
  const anfang = useRec.getInitialState() as unknown as Record<string, unknown>;
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
 * (LiveBereich, Einstellungen, ZeitplanKarte), die sich direkt aufrufen lassen; so prüfen die Tests die Rückrufe am Element.
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

/** Alle Quelldateien unter src/renderer/src (relativ zu apps/recorder). */
export function quellen(d = 'src/renderer/src'): string[] {
  return readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? quellen(`${d}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${d}/${e.name}`] : []));
}
