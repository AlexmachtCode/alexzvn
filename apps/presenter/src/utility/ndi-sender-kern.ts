// Kern des NDI-Senders (#303): hält das letzte Bild und sendet es im festen Takt (25 fps) – auch im Stand,
// denn NDI-Empfänger brauchen einen stetigen Strom. Ohne eigene Importe der Laufzeit, damit die Selbsttests
// ihn mit Attrappen prüfen können; geladen wird @jm/ndi allein im Einstieg ndi-sender.ts.
import type * as NdiApi from '@jm/ndi';
import { NDI_BILD_BYTES, NDI_BREITE, NDI_FPS, NDI_HOEHE, NDI_NAME, NDI_TAKT_MS } from '../shared/ndi';
import type { AnSender, VomSender } from '../shared/ndi';

export interface KernPort {
  on(ereignis: 'message', cb: (e: { data: unknown }) => void): unknown;
  postMessage(nachricht: unknown): void;
}

export type NdiSendeModul = Pick<typeof NdiApi, 'init' | 'createSender' | 'sendVideoBGRA' | 'connections' | 'destroy'>;

const ersteZeile = (e: unknown): string => String((e as { message?: unknown })?.message ?? e).split(/\r?\n/)[0];

/**
 * Empfänger aus `connections()`: Das NDI-SDK zählt je Empfänger ZWEI Verbindungen (gemessen mit NDI 6 auf
 * Windows: 0 → 2 → 4 → 2 → 0 bei 0/1/2/1/0 Empfängern). Eine ungerade Zahl rundet auf, damit ein verbundener
 * Empfänger nie als 0 erscheint.
 */
export function empfaengerZahl(verbindungen: number): number {
  return Number.isFinite(verbindungen) && verbindungen > 0 ? Math.ceil(verbindungen / 2) : 0;
}

export function starteNdiSenderKern(
  port: KernPort,
  ladeNdi: () => Promise<NdiSendeModul>,
  taktMs: number = NDI_TAKT_MS,
): void {
  const melde = (m: VomSender): void => port.postMessage(m);
  let ndi: NdiSendeModul | null = null;
  let angefangen = false;
  let beendet = false;
  let letztes: Uint8Array = new Uint8Array(NDI_BILD_BYTES); // alles 0 = vollständig transparent
  let gesendet = 0;
  let soll = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const beendeTakt = (): void => {
    beendet = true;
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const tick = (): void => {
    timer = null;
    if (beendet || !ndi) return;
    try {
      ndi.sendVideoBGRA(letztes, NDI_BREITE, NDI_HOEHE, NDI_FPS, 1);
      gesendet++;
      if (gesendet % NDI_FPS === 0) melde({ type: 'stat', empfaenger: empfaengerZahl(ndi.connections()) });
    } catch (err) {
      beendeTakt();
      melde({ type: 'fehler', grund: ersteZeile(err) });
      return;
    }
    // Driftfrei: der Sollzeitpunkt wandert um feste Takte; liegt er weit zurück, wird nicht im Stoß nachgeholt.
    soll += taktMs;
    const jetzt = performance.now();
    if (jetzt - soll > 2 * taktMs) soll = jetzt;
    timer = setTimeout(tick, Math.max(0, soll - jetzt));
  };

  const starte = async (): Promise<void> => {
    try {
      const modul = await ladeNdi();
      modul.init();
      modul.createSender(NDI_NAME);
      ndi = modul;
    } catch (err) {
      melde({ type: 'fehler', grund: ersteZeile(err) });
      return;
    }
    if (beendet) { // stop kam schon während des Ladens
      try { ndi.destroy(); } catch { /* nichts mehr zu tun */ }
      return;
    }
    melde({ type: 'bereit' });
    soll = performance.now();
    tick();
  };

  port.on('message', (e) => {
    const d = e.data as AnSender | null;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'init') {
      if (angefangen) return;
      angefangen = true;
      void starte();
    } else if (d.type === 'bild') {
      // Nur ein Vollbild: der native Code läse bei einem kürzeren Puffer über das Ende hinaus.
      if (d.buffer instanceof ArrayBuffer && d.buffer.byteLength === NDI_BILD_BYTES) letztes = new Uint8Array(d.buffer);
    } else if (d.type === 'stop') {
      beendeTakt();
      if (ndi) {
        try { ndi.destroy(); } catch { /* nichts mehr zu tun */ }
        ndi = null;
      }
    }
  });
}
