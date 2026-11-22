// Testhilfen der Player-Oberflächentests (UX Welle 2a, Aufgabe b): feste Zustände und Attrappen für Render- und
// Ableitungstests. Wächst mit den Aufgaben c bis d; Aufgabe b liefert den Zustand der Fernsteuerungs-Meldung, Aufgabe c
// Medien, Show-Cues und Pads.
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { Cue, MediaItem, MediaKind, ShowCue } from '@shared/types';

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
