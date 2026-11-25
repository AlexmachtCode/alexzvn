// Testhilfen der Studio-Control-Oberflächentests (UX Welle 2b, Task 13): feste Zustände und Hilfen für Render- und
// Quelltext-Prüfungen. Wächst mit den folgenden Aufgaben (Brücken: Zustand der Fernsteuerungs-Meldung; Rahmen und Panels:
// Render-Hilfen für Statusleiste und Abschnitte, Vorbild apps/prompter/test/ui/testzustand.ts).
import { readdirSync } from 'node:fs';
import { createElement } from 'react';
import type { OberflaechenStand } from '@/lib/oberflaeche';
import { useApp } from '@/store/app';
import { useSession } from '@/store/session';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { SessionUser } from '@shared/protocol';

/** Quelltext ohne Kommentare (Zeilen- und Blockkommentare), für Prüfungen am Code. */
export function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Führt f mit einem Zustand des App-Stores (Abschnitt, Geräte …) aus. Beim Server-Render liest zustand den Anfangszustand
 * (getInitialState); ein setState wirkt dort nicht. Deshalb werden dessen Felder für die Dauer von f gesetzt und danach
 * zurückgestellt.
 */
export function mitStore<T>(patch: Partial<ReturnType<typeof useApp.getState>>, f: () => T): T {
  const anfang = useApp.getInitialState() as unknown as Record<string, unknown>;
  const vorher: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) vorher[k] = anfang[k];
  Object.assign(anfang, patch);
  try {
    return f();
  } finally {
    Object.assign(anfang, vorher);
  }
}

/** Fernsteuerungs-Meldung des Steuerservers (Port 8735) mit Vorgaben; Felder ohne Wert fehlen (nie undefined). */
export function basisMeldung(patch: Partial<FernsteuerungMeldung> = {}): FernsteuerungMeldung {
  return { laeuft: true, port: 8735, clients: 0, ...patch };
}

/** Angemeldeter Benutzer wie aus `/api/login` (Kennung, Name, Rolle). */
export function sitzungsBenutzer(patch: Partial<SessionUser> = {}): SessionUser {
  return { id: 1, username: 'Admin', role: 'admin', ...patch };
}

/**
 * Führt f mit einem Zustand der Sitzung (Token, Benutzer) aus, wie mitStore für den App-Store: Beim Server-Render liest
 * zustand den Anfangszustand, darum werden dessen Felder für die Dauer von f gesetzt und danach zurückgestellt.
 */
export function mitSitzung<T>(patch: Partial<ReturnType<typeof useSession.getState>>, f: () => T): T {
  const anfang = useSession.getInitialState() as unknown as Record<string, unknown>;
  const vorher: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) vorher[k] = anfang[k];
  Object.assign(anfang, patch);
  try {
    return f();
  } finally {
    Object.assign(anfang, vorher);
  }
}

/** Stand der Oberfläche vor jeder Antwort, im Electron-Fenster, nicht angemeldet; `teil` ersetzt einzelne Felder. */
export function grundStand(teil: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return {
    umgebung: 'electron',
    benutzer: null,
    server: undefined,
    atem: undefined,
    obs: undefined,
    tricaster: undefined,
    ptz: undefined,
    audio: undefined,
    licht: undefined,
    masterLink: undefined,
    fernsteuerung: undefined,
    erstPasswort: undefined,
    ...teil,
  };
}

/** Stand nach der Anmeldung als Admin mit Antworten von Server, Licht, Master-Link und Steuerserver (Electron). */
export function angemeldeterStand(teil: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return grundStand({
    benutzer: { name: 'Admin', rolle: 'admin' },
    server: true,
    licht: { node: false, blackout: false },
    masterLink: { art: 'aus' },
    fernsteuerung: basisMeldung(),
    ...teil,
  });
}

function entities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Alle öffnenden Tags eines Namens im HTML. */
export function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}(?=[\\s>/])[^>]*>`, 'g')) ?? [];
}

/** Wert eines Attributs in einem öffnenden Tag (Entities aufgelöst). */
export function attr(tag: string | undefined, name: string): string | undefined {
  const m = tag?.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? entities(m[1]!) : undefined;
}

/** Sichtbarer Text des HTML (ohne Tags, Entities aufgelöst). */
export function text(html: string): string {
  return entities(html.replace(/<[^>]+>/g, ''));
}

/** Texte aller Knöpfe im HTML, in der gerenderten Reihenfolge. */
export function knopfTexte(html: string): string[] {
  return [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1]!).trim());
}

/** Statuseinträge der Leiste als [id, Zustand, Titel] in der gerenderten Reihenfolge. */
export function statusEintraege(html: string): Array<[string | undefined, string | undefined, string | undefined]> {
  return [...html.matchAll(/<(?:button|span)\s[^>]*data-status-id="[^"]*"[^>]*>/g)].map((m) => [attr(m[0], 'data-status-id'), attr(m[0], 'data-state'), attr(m[0], 'title')]);
}

/** Inhalt eines Bereichs `<schluessel>="<wert>"` bis zu seinem schließenden Tag (Tiefe gezählt, gleiches Tag). */
export function bereich(html: string, schluessel: string, wert: string): string {
  const start = html.search(new RegExp(`<(\\w+)[^>]*\\s${schluessel}="${wert}"`));
  if (start < 0) return '';
  const name = /^<(\w+)/.exec(html.slice(start))?.[1] ?? 'div';
  const muster = new RegExp(`<${name}(?=[\\s>])|</${name}>`, 'g');
  muster.lastIndex = start;
  let tiefe = 0;
  for (let m = muster.exec(html); m !== null; m = muster.exec(html)) {
    tiefe += m[0].startsWith('</') ? -1 : 1;
    if (tiefe === 0) return html.slice(start, m.index + m[0].length);
  }
  return html.slice(start);
}

/** Panel-Anker (`id="einstellung-<id>"`) im HTML, in der gerenderten Reihenfolge. */
export function anker(html: string): string[] {
  return [...html.matchAll(/id="einstellung-([^"]+)"/g)].map((m) => m[1]!);
}

/** Ein React-Element, wie es eine Komponente als Funktion zurückgibt (für Rückrufe ohne DOM). */
export interface Element {
  type: unknown;
  props: Record<string, unknown> & { children?: unknown };
}

/** Alle Elemente eines React-Baums (ohne Komponenten aufzurufen), in Dokumentreihenfolge. */
export function elemente(knoten: unknown): Element[] {
  const aus: Element[] = [];
  const geh = (k: unknown): void => {
    if (Array.isArray(k)) {
      k.forEach(geh);
      return;
    }
    if (k === null || typeof k !== 'object' || !('props' in k)) return;
    const e = k as Element;
    aus.push(e);
    geh(e.props.children);
  };
  geh(knoten);
  return aus;
}

/** Alle .ts- und .tsx-Dateien unter src/renderer/src, Pfade relativ dazu mit /. */
export function rendererDateien(): string[] {
  return (readdirSync('src/renderer/src', { recursive: true }) as string[])
    .map((d) => d.replace(/\\/g, '/'))
    .filter((d) => /\.tsx?$/.test(d))
    .sort();
}

// ── Gerätepanels (Task 18): Geräte im Store, Render der Wurzel-View, Pillen und Haupttasten aus dem HTML ──

/** Gerätetypen mit Status-Ereignissen; Schlüssel der Konfiguration und der Status-Tabelle im App-Store. */
export const STORE_SCHLUESSEL = {
  tricaster: ['tricasters', 'tricasterStatuses'],
  atem: ['atem', 'atemStatuses'],
  obs: ['obs', 'obsStatuses'],
  ptz: ['ptzCameras', 'ptzStatuses'],
  audio: ['audioConsoles', 'audioStatuses'],
} as const;
export type Typ = keyof typeof STORE_SCHLUESSEL;

/** Je Typ eine Instanz, nur TEST-NET-1-Adressen (RFC 5737); die Tests kontaktieren nichts. */
export const KONFIG: Record<Typ, Record<string, unknown>> = {
  tricaster: { id: 'tc1', name: 'TriCaster TC2', host: '192.0.2.12', port: 80 },
  atem: { id: 'a1', name: 'ATEM Mini', host: '192.0.2.10' },
  obs: { id: 'o1', name: 'OBS', host: '192.0.2.11', port: 4455 },
  ptz: { id: 'p1', name: 'AW-UE150', host: '192.0.2.13', port: 80 },
  audio: { id: 'au1', name: 'Yamaha QL1', type: 'yamaha-ql', transport: 'tcp', host: '192.0.2.30', port: 49280, channelCount: 4, channels: [] },
};

/** Store-Felder für eine Instanz des Typs mit einer Meldung (undefined = Instanz ohne Status-Ereignis). */
export function geraetImStore(typ: Typ, meldung?: Record<string, unknown>): Record<string, unknown> {
  const [cfg, status] = STORE_SCHLUESSEL[typ];
  const k = KONFIG[typ];
  const extra = typ === 'audio' ? { transport: 'tcp' } : {};
  return { [cfg]: [k], [status]: meldung === undefined ? {} : { [k.id as string]: { id: k.id, lastChecked: 1, ...extra, ...meldung } } };
}

/** Alle Video-Geräte verbunden (ATEM Program 1/Preview 2, OBS mit Szenen, PTZ eingeschaltet), dazu optional mehr. */
export function alleVideo(extra: { atem?: Record<string, unknown>; obs?: Record<string, unknown>; tricaster?: Record<string, unknown>; ptz?: Record<string, unknown> } = {}): Record<string, unknown> {
  return {
    ...geraetImStore('tricaster', { state: 'connected', version: '8.2', ...extra.tricaster }),
    ...geraetImStore('atem', { state: 'connected', model: 'ATEM Mini Pro', program: 1, preview: 2, ...extra.atem }),
    ...geraetImStore('obs', { state: 'connected', scenes: ['Kamera 1', 'Kamera 2'], currentScene: 'Kamera 1', ...extra.obs }),
    ...geraetImStore('ptz', { state: 'connected', power: 'on', ...extra.ptz }),
  };
}

/**
 * Die Wurzel-View (StudioOberflaeche) mit Sitzung, App-Store und Server-Meldung gerendert, wie im Fenster: die Panels bekommen
 * den Stand von dort (echte Verdrahtung der ids und Status-Tabellen).
 */
export function oberflaecheHtml(
  Wurzel: (p: { server: boolean | undefined }) => React.JSX.Element,
  o: { rolle?: 'admin' | 'operator' | 'viewer'; server?: boolean | undefined; abschnitt?: 'video' | 'audio' | 'licht' | 'setup'; store?: Record<string, unknown> },
  render: (el: React.JSX.Element) => string,
): string {
  const server = 'server' in o ? o.server : true;
  return mitSitzung({ token: 't', user: sitzungsBenutzer({ role: o.rolle ?? 'admin' }) }, () =>
    mitStore({ section: o.abschnitt ?? 'video', ...(o.store ?? {}) } as never, () => render(createElement(Wurzel, { server }))),
  );
}

/** Ein Element mit seinem ganzen Inhalt ab Position `start` (Tiefe über gleichnamige Tags gezählt). */
function elementAb(html: string, start: number): string {
  const name = /^<(\w+)/.exec(html.slice(start))?.[1] ?? 'span';
  const muster = new RegExp(`<${name}(?=[\\s>])|</${name}>`, 'g');
  muster.lastIndex = start;
  let tiefe = 0;
  for (let m = muster.exec(html); m !== null; m = muster.exec(html)) {
    tiefe += m[0].startsWith('</') ? -1 : 1;
    if (tiefe === 0) return html.slice(start, m.index + m[0].length);
  }
  return html.slice(start);
}

/** Pillen (StatusPill aus @jm/ui: span mit data-state) als [Zustand, sichtbarer Text ohne Screenreader-Wort]. */
export function pillen(html: string): Array<[string | undefined, string]> {
  return [...html.matchAll(/<span data-state="/g)].map((m) => {
    const el = elementAb(html, m.index!);
    const sichtbar = el.replace(/<span class="sr-only">[\s\S]*?<\/span>/g, '').replace(/<span aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g, '');
    return [attr(el, 'data-state'), text(sichtbar).trim()];
  });
}

/** Ein TallyButton im HTML: Behälter-Klasse, Zustand, Beschriftung, sichtbarer Grund, title, aria-disabled. */
export interface Tally {
  huelle: string | undefined;
  state: string | undefined;
  label: string;
  grund: string;
  title: string | undefined;
  gesperrt: boolean;
}

/** Alle TallyButtons (button mit data-state) im HTML, jeweils mit der Klasse des umgebenden Behälters. */
export function tallyTasten(html: string): Tally[] {
  return [...html.matchAll(/<div class="([^"]*)"><button type="button" data-state="/g)].map((m) => {
    const knopf = elementAb(html, m.index! + m[0].indexOf('<button'));
    const kopf = tags(knopf, 'button')[0];
    const label = /<span>([^<]*)<\/span>/.exec(knopf)?.[1] ?? '';
    const grund = /<span id="[^"]*"[^>]*>([^<]*)<\/span>/.exec(knopf)?.[1] ?? '';
    return { huelle: m[1], state: attr(kopf, 'data-state'), label: text(label), grund: text(grund), title: attr(kopf, 'title'), gesperrt: attr(kopf, 'aria-disabled') === 'true' };
  });
}

/** Halte-Knöpfe (HalteKnopf aus @jm/ui: button mit aria-pressed) als Tag und Beschriftung. */
export function halteKnoepfe(html: string): Array<{ tag: string; label: string }> {
  return [...html.matchAll(/<button type="button" aria-pressed="/g)].map((m) => {
    const el = elementAb(html, m.index!);
    return { tag: tags(el, 'button')[0]!, label: text(el).trim() };
  });
}
