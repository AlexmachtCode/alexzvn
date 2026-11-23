// Testhilfen der Presenter-Oberflächentests (UX Welle 2b, Presenter b): feste Zustände und Attrappen für Render- und
// Ableitungstests. Wächst mit den Aufgaben c bis d; Aufgabe b liefert den Zustand der Fernsteuerungs-Meldung, Aufgabe c den
// OberflaechenStand, laufende Präsentationen, Bildschirmlisten und die Attrappe für `window.jmpr.present`, Aufgabe d1 das
// Lesen des gerenderten HTML (Tags, Attribute, Text, Abschnitte, Statuseinträge), den Store-Griff und die Panel-Aktionen.
import type { OberflaechenStand } from '@/lib/oberflaeche';
import type { EinstellungenAktionen } from '@/views/Einstellungen';
import { useProject } from '@/store/project';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { GastKlickerStatus } from '@shared/gast-klicker';
import type { DisplayInfo, JmprApi, NdiLage, NdiStatus, PresentationState, RemoteStatus, Slide } from '@shared/types';

/** Meldung eines laufenden Steuerservers ohne Clients (Port 8728, offener Modus). */
export function basisMeldung(z: Partial<FernsteuerungMeldung> = {}): FernsteuerungMeldung {
  return { laeuft: true, port: 8728, clients: 0, modus: 'open', ...z };
}

/** Quelltext ohne Kommentare (Zeilen- und Blockkommentare), für Prüfungen am Code. */
export function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Stand vor jeder Antwort (alles undefined), Editor unter Windows; `teil` überschreibt einzelne Eingänge. */
export function grundStand(teil: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return {
    praesentation: undefined,
    bildschirme: undefined,
    ndi: undefined,
    handy: undefined,
    gastKlicker: undefined,
    timer: undefined,
    masterLink: undefined,
    fernsteuerung: undefined,
    netzwerkkarten: undefined,
    fenster: 'editor',
    plattform: 'win32',
    ...teil,
  };
}

/** NDI-Status wie vom Hauptprozess (`ndi:status`). */
export function ndiStatus(lage: NdiLage, an = lage !== 'aus', empfaenger = 0, grund: string | null = null): NdiStatus {
  return { an, lage, empfaenger, grund };
}

/** Handy-Server (`remote:status`): aus, oder laufend mit Adresse und PIN. */
export function handyStatus(z: Partial<RemoteStatus> = {}): RemoteStatus {
  return { running: false, url: null, pin: null, config: { enabled: false, bind: 'all', port: 7330, pinEnabled: true }, error: null, ...z };
}

/** Gast-Klicker (`gastKlicker:status`): aus, oder an mit Link. */
export function gastStatus(z: Partial<GastKlickerStatus> = {}): GastKlickerStatus {
  return { an: false, lage: 'aus', link: null, gaeste: 0, pausiert: false, ...z };
}

/** Netzwerkkarten wie `remote:interfaces`. */
export const NETZWERKKARTEN = [
  { address: 'all', label: 'Alle Schnittstellen (0.0.0.0)' },
  { address: '10.0.0.5', label: 'Ethernet · 10.0.0.5' },
];

/** Ein Stand, in dem jede Quelle geantwortet hat: keine Präsentation, drei Bildschirme, NDI aus, alles andere aus. */
export function bekannterStand(teil: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return grundStand({
    praesentation: { active: false, index: 0, total: 0, screen: 'live' },
    bildschirme: bildschirme(null),
    ndi: ndiStatus('aus'),
    handy: handyStatus(),
    gastKlicker: gastStatus(),
    timer: { config: { enabled: false, host: '127.0.0.1', port: 7777 }, verbunden: false },
    masterLink: null,
    fernsteuerung: basisMeldung(),
    netzwerkkarten: NETZWERKKARTEN,
    ...teil,
  });
}

/** Panel-Aktionen als Attrappe: jeder Aufruf landet als Zeile in `log`; mit `startwahl` wie im Editor. */
export function aktionenAttrappe(log: string[] = [], editor = true): EinstellungenAktionen {
  const merke = (z: string): Promise<void> => {
    log.push(z);
    return Promise.resolve();
  };
  return {
    ndiSchalten: (an) => void log.push(`ndi(${an})`),
    timerSchalten: (an) => void log.push(`timer(${an})`),
    timerSetzen: (host, port) => void log.push(`timerSetzen(${host},${port})`),
    handyAnwenden: (c) => merke(`handy(${JSON.stringify(c)})`),
    gastKlicker: {
      setzeAn: (an) => merke(`gastAn(${an})`),
      pause: (an) => merke(`gastPause(${an})`),
      neuerLink: () => merke('gastNeuerLink'),
      kopieren: (link) => merke(`gastKopieren(${link})`).then(() => true),
    },
    ...(editor
      ? { startwahl: { startBildschirmWaehlen: (id: number | null) => void log.push(`start(${id})`), nurNdiWaehlen: (an: boolean) => void log.push(`nurNdi(${an})`) } }
      : {}),
  };
}

/** Eine Folie für den Store (sichtbar, ohne Overlays). */
export function folie(id: string, hidden = false): Slide {
  return { id, sourceId: 'q', pageIndex: 0, title: id, notes: '', hidden, overlays: [] };
}

/**
 * Store-Zustand für einen Render ohne Browser: renderToStaticMarkup liest bei zustand den Anfangszustand (getInitialState);
 * er wird für die Dauer von `f` überschrieben und danach zurückgesetzt (Muster Prompter).
 */
export function mitStore<T>(patch: Partial<ReturnType<typeof useProject.getState>>, f: () => T): T {
  const anfang = useProject.getInitialState() as unknown as Record<string, unknown>;
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

/** Alle öffnenden Tags eines Namens im HTML. */
export function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}(?=[\\s>/])[^>]*>`, 'g')) ?? [];
}

/** Wert eines Attributs in einem öffnenden Tag (Entities aufgelöst). */
export function attr(tag: string | undefined, name: string): string | undefined {
  const m = tag?.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? entities(m[1]) : undefined;
}

/** Sichtbarer Text des HTML (ohne Tags, Entities aufgelöst). */
export function text(html: string): string {
  return entities(html.replace(/<[^>]+>/g, ''));
}

/** Statuseinträge der Leiste als [id, Zustand, Titel] in der gerenderten Reihenfolge. */
export function statusEintraege(html: string): Array<[string | undefined, string | undefined, string | undefined]> {
  return [...html.matchAll(/<(?:button|span)\s[^>]*data-status-id="[^"]*"[^>]*>/g)].map((m) => [attr(m[0], 'data-status-id'), attr(m[0], 'data-state'), attr(m[0], 'title')]);
}

/** HTML eines Panel-Abschnitts: vom Anker `einstellung-<id>` bis zum nächsten Anker. */
export function abschnitt(html: string, id: string): string {
  const a = html.indexOf(`id="einstellung-${id}"`);
  if (a < 0) return '';
  const b = html.indexOf('id="einstellung-', a + 1);
  return html.slice(a, b < 0 ? undefined : b);
}

/** Inhalt eines Bereichs `data-<schluessel>="<wert>"` bis zu seinem schließenden Tag (Tiefe gezählt, gleiches Tag). */
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

/** Laufende Präsentation, Folie 1 von 3, Publikum sieht die Folie. */
export function laufend(z: Partial<PresentationState> = {}): PresentationState {
  return { active: true, index: 0, total: 3, screen: 'live', ...z };
}

/**
 * Drei Bildschirme wie `getDisplays` im Main (Name „Bildschirm n[ (Haupt)] · B×H“), ids absichtlich nicht 1 bis 3, damit
 * Position und id nie zufällig gleich sind: 11 (Haupt), 22, 33. `publikum` = id des Bildschirms mit `current`, null = keiner.
 */
export function bildschirme(publikum: number | null): DisplayInfo[] {
  const bs = (id: number, n: number, primary: boolean, breite: number, hoehe: number): DisplayInfo => ({
    id,
    label: `Bildschirm ${n}${primary ? ' (Haupt)' : ''} · ${breite}×${hoehe}`,
    bounds: { x: (n - 1) * breite, y: 0, width: breite, height: hoehe },
    primary,
    current: id === publikum,
  });
  return [bs(11, 1, true, 2032, 1144), bs(22, 2, false, 1920, 1080), bs(33, 3, false, 1280, 720)];
}

type PresentAttrappe = Pick<JmprApi['present'], 'next' | 'prev' | 'goto' | 'setScreen' | 'stop'>;

/** Attrappe für `window.jmpr.present`: jeder Aufruf landet als Zeile in `aufrufe` („next“, „goto(0)“, „setScreen(black)“). */
export function presentAttrappe(): { present: PresentAttrappe; aufrufe: string[] } {
  const aufrufe: string[] = [];
  const merke =
    (name: string) =>
    (...a: unknown[]): Promise<void> => {
      aufrufe.push(a.length === 0 ? name : `${name}(${a.map(String).join(',')})`);
      return Promise.resolve();
    };
  return { aufrufe, present: { next: merke('next'), prev: merke('prev'), goto: merke('goto'), setScreen: merke('setScreen'), stop: merke('stop') } };
}
