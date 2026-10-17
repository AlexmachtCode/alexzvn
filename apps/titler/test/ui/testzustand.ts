// Testhilfen der Titler-Oberflächentests C9–C12 (UX-Pilot): feste Titler-Zustände für Render-Tests, der Render des ganzen
// Bedienfensters über den Anfangszustand des Stores und kleine Lesehilfen für das HTML aus renderToStaticMarkup.
import {
  DEFAULT_CONFIG,
  type DisplayInfo,
  type GraphicTemplate,
  type TitlerConfig,
  type TitlerState,
  type TitlerStatus,
} from '@shared/types';
import type { OberflaechenStand, TitlerAktionen } from '@/lib/oberflaeche';
import { useTitler } from '@/store/titler';

/** Status eines frisch gestarteten Titlers: kein Ordner, kein NDI, keine Meldung des Steuerservers. */
export function basisStatus(z: Partial<TitlerStatus> = {}): TitlerStatus {
  return {
    ndiActive: false,
    connections: 0,
    suiteClients: 0,
    variables: {},
    dataSources: [],
    entries: [],
    activeEntry: -1,
    datenQuelle: { art: 'ordner', zeile: '', zurueckKnopf: null, ohneOrdner: true },
    ...z,
  };
}

export function basisConfig(z: Partial<TitlerConfig> = {}): TitlerConfig {
  return { ...DEFAULT_CONFIG, ...z };
}

/** Stand für lib/oberflaeche.ts: Monitorliste und Master-Link noch offen (undefined), wie beim Server-Render. */
export function basisStand(z: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return { config: basisConfig(), status: basisStatus(), displays: undefined, masterLink: undefined, ...z };
}

/** Aktionen, die jeden Aufruf mitschreiben (für Prop-Bauer und Knöpfe ohne DOM). */
export function protokollAktionen(log: string[]): TitlerAktionen {
  return {
    setConfig: (patch) => void log.push(`setConfig ${JSON.stringify(patch)}`),
    startNdi: (name) => void log.push(`startNdi ${name}`),
    stopNdi: () => void log.push('stopNdi'),
    pickFolder: () => void log.push('pickFolder'),
    zurueckZumEigenenOrdner: () => void log.push('zurueckZumEigenenOrdner'),
  };
}

/** n Einträge „Person 1“ … mit Schlüsseln k0 … */
export function eintraege(n: number): TitlerStatus['entries'] {
  return Array.from({ length: n }, (_, i) => ({ key: `k${i}`, label: `Person ${i + 1}` }));
}

/** Zwei Grafik-Vorlagen: eine mit zwei Textfeldern, ein reines Standbild (für Bedienung und Panel, C10/C11). */
export const VORLAGEN: GraphicTemplate[] = [
  {
    id: 'v1',
    name: 'Bauchbinde rot',
    width: 1920,
    height: 1080,
    createdAt: 1,
    slots: [
      { key: 'name', label: 'Name-Ebene', x: 0, y: 0, w: 10, h: 10, fontFamily: 'Manrope', fontSize: 40, fontWeight: 700, color: '#fff', align: 'left', lineHeight: 1.2, defaultText: '{{name}}' },
      { key: 'rolle', label: 'Rolle-Ebene', x: 0, y: 0, w: 10, h: 10, fontFamily: 'Manrope', fontSize: 30, fontWeight: 400, color: '#fff', align: 'left', lineHeight: 1.2, defaultText: 'Moderation' },
    ],
  },
  { id: 'v2', name: 'Standbild', width: 1920, height: 1080, createdAt: 2, slots: [] },
];

export const MONITORE: DisplayInfo[] = [
  { id: 1, label: '1920×1080 · primär', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, size: { width: 1920, height: 1080 }, scaleFactor: 1, primary: true, internal: false },
  { id: 2, label: '1920×1080', bounds: { x: 1920, y: 0, width: 1920, height: 1080 }, size: { width: 1920, height: 1080 }, scaleFactor: 1, primary: false, internal: false },
];

/**
 * Führt f mit einem Store-Zustand aus. Beim Server-Render liest zustand 4.5.7 den Anfangszustand (getInitialState); ein
 * setState wirkt dort nicht. Deshalb wird dessen `state` für die Dauer von f gesetzt und danach zurückgestellt.
 */
export function mitStore<T>(state: TitlerState | null, f: () => T): T {
  const anfang = useTitler.getInitialState();
  const vorher = anfang.state;
  anfang.state = state;
  try {
    return f();
  } finally {
    anfang.state = vorher;
  }
}

/** Quelltext ohne Kommentare (Zeilen- und Blockkommentare, auch JSX-Kommentare), für Prüfungen am Code. */
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

/** Das Element mit diesem data-titler-Wert samt Inhalt (Ende am passenden schließenden Tag gleichen Namens). */
export function bereich(html: string, marke: string): string {
  const m = new RegExp(`<(\\w+)\\s[^>]*data-titler="${marke}"[^>]*>`).exec(html);
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
