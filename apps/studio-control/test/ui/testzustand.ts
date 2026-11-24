// Testhilfen der Studio-Control-Oberflächentests (UX Welle 2b, Task 13): feste Zustände und Hilfen für Render- und
// Quelltext-Prüfungen. Wächst mit den folgenden Aufgaben (Brücken: Zustand der Fernsteuerungs-Meldung; Rahmen und Panels:
// Render-Hilfen für Statusleiste und Abschnitte, Vorbild apps/prompter/test/ui/testzustand.ts).
import { readdirSync } from 'node:fs';
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
