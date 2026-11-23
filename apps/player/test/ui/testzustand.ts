// Testhilfen der Player-Oberflächentests (UX Welle 2a, Aufgabe b): feste Zustände und Attrappen für Render- und
// Ableitungstests. Wächst mit den Aufgaben c bis d; Aufgabe b liefert den Zustand der Fernsteuerungs-Meldung, Aufgabe c
// Medien, Show-Cues und Pads.
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { Cue, MediaItem, MediaKind, Show, ShowCue } from '@shared/types';
import { usePlayer } from '@/store/player';

/** Meldung eines laufenden Steuerservers ohne Clients (Port 8725, offener Modus). */
export function basisMeldung(z: Partial<FernsteuerungMeldung> = {}): FernsteuerungMeldung {
  return { laeuft: true, port: 8725, clients: 0, modus: 'open', ...z };
}

/** Quelltext ohne Kommentare (Zeilen- und Blockkommentare), für Prüfungen am Code. */
export function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Ein Medium der Bibliothek (Titel „Titel ‹id›“, Datei „m‹id›.wav“ bzw. „.mp4“). */
export function medium(id: number, kind: MediaKind = 'audio'): MediaItem {
  const datei = `m${id}.${kind === 'video' ? 'mp4' : 'wav'}`;
  return {
    id,
    path: `C:/Medien/${datei}`,
    fileName: datei,
    kind,
    title: `Titel ${id}`,
    artist: null,
    durationSec: 10,
    sizeBytes: 1000,
    format: null,
    codec: null,
    thumbPath: null,
    addedAt: 0,
    lastPlayedAt: null,
  };
}

/** Ein Show-Cue mit eigenem Medium (Medium-id = Cue-id + 100); `ohneMedium` ergibt einen leeren Cue. */
export function showCue(id: number, z: Partial<ShowCue> & { kind?: MediaKind; ohneMedium?: boolean } = {}): ShowCue {
  const { kind, ohneMedium, ...rest } = z;
  const m = ohneMedium ? null : medium(id + 100, kind ?? 'audio');
  return {
    id,
    showId: 1,
    mediaId: m?.id ?? null,
    label: '',
    position: id,
    preWaitSec: 0,
    autoContinue: false,
    fadeInSec: 0,
    fadeOutSec: 0,
    gainDb: 0,
    loop: false,
    media: m,
    ...rest,
  };
}

/** Ein Soundboard-Pad mit Medium `mediaId` auf Platz `slot`. */
export function pad(id: number, slot: number, mediaId: number): Cue {
  return { id, playlistId: 1, mediaId, label: '', slot, hotkey: null, color: null, gainDb: 0, loop: false, media: medium(mediaId) };
}

// ── Aufgabe d: Render-Hilfen (aus apps/prompter/test/ui/testzustand.ts, auf den Player-Store angepasst) ──

/** Eine Show der Liste (Name „‹name›“). */
export function show(id: number, name = `Show ${id}`): Show {
  return { id, name, createdAt: 0, updatedAt: 0 };
}

/**
 * Führt f mit einem Store-Zustand aus. Beim Server-Render liest zustand den Anfangszustand (getInitialState); ein setState
 * wirkt dort nicht. Deshalb werden dessen Felder für die Dauer von f gesetzt und danach zurückgestellt.
 */
export function mitStore<T>(patch: Partial<ReturnType<typeof usePlayer.getState>>, f: () => T): T {
  const anfang = usePlayer.getInitialState() as unknown as Record<string, unknown>;
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
