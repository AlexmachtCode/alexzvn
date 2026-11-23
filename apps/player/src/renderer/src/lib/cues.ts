import type { Cue } from '@shared/types';

/**
 * WebAudio-Engine fürs Soundboard: dekodiert Cue-Medien einmal in AudioBuffer
 * vor und triggert sie danach latenzarm (getrennt vom Hintergrund-Player).
 * „Theatergong" ohne Decode-Verzögerung beim Tastendruck.
 *
 * Pad-Meldung (UX Welle 2a, W2-1): `onChange` meldet nach jedem `play`, `stop`, `stopAll` und natürlichen Ende
 * (`onended`) die IDs der gerade spielenden Pads; `aktiveIds()` liefert sie jederzeit. Eine Änderung am Klang (W2-10): Ein Pad,
 * das beim Auslösen noch lädt, startet nach einem `stopAll` (Panik, „Alle stoppen“) nicht mehr; sonst klingt alles wie bisher.
 */
class CueEngine {
  private ctx: AudioContext | null = null;
  private buffers = new Map<number, AudioBuffer>(); // key = mediaId
  private active = new Map<number, AudioBufferSourceNode>(); // key = cueId
  private hoerer = new Set<(ids: number[]) => void>();
  /** Zählt jedes stopAll; ein Pad, das beim Auslösen noch lud, startet nur, wenn seitdem kein stopAll kam. */
  private stopAllZaehler = 0;

  /** IDs der gerade spielenden Pads (Reihenfolge des Starts). */
  aktiveIds(): number[] {
    return [...this.active.keys()];
  }

  /** Meldet die spielenden Pads nach jeder Änderung; liefert die Abmeldung. */
  onChange(cb: (ids: number[]) => void): () => void {
    this.hoerer.add(cb);
    return () => {
      this.hoerer.delete(cb);
    };
  }

  /** An alle Hörer melden. Ein werfender Hörer stört weder die übrigen noch das Abspielen (Fehler in die Konsole). */
  private melde(): void {
    for (const cb of [...this.hoerer]) {
      try {
        cb(this.aktiveIds());
      } catch (e) {
        console.error('Pad-Meldung: Hörer warf', e);
      }
    }
  }

  private context(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Medium vordekodieren (idempotent). url = jmplay.mediaUrl(path). */
  async preload(mediaId: number, url: string): Promise<void> {
    if (this.buffers.has(mediaId)) return;
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    const buf = await this.context().decodeAudioData(arr);
    this.buffers.set(mediaId, buf);
  }

  /** Pad triggern. Lädt bei Bedarf nach und spielt dann (leicht verzögert). */
  play(cue: Cue, url: string): void {
    if (cue.mediaId == null) return;
    const buf = this.buffers.get(cue.mediaId);
    if (!buf) {
      // Nach einem stopAll (Panik, „Alle stoppen“) startet das ladende Pad nicht mehr; ein einzelnes stop(id) wirkt wie bisher.
      const zaehler = this.stopAllZaehler;
      void this.preload(cue.mediaId, url).then(() => {
        if (zaehler === this.stopAllZaehler) this.play(cue, url);
      });
      return;
    }
    this.beende(cue.id); // Re-Trigger: laufende Instanz desselben Pads ablösen (gemeldet wird einmal, unten)
    const ctx = this.context();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = cue.loop;
    const gain = ctx.createGain();
    gain.gain.value = Math.pow(10, (cue.gainDb || 0) / 20);
    src.connect(gain).connect(ctx.destination);
    src.onended = () => {
      if (this.active.get(cue.id) === src) {
        this.active.delete(cue.id);
        this.melde();
      }
    };
    src.start();
    this.active.set(cue.id, src);
    this.melde();
  }

  stop(cueId: number): void {
    this.beende(cueId);
    this.melde();
  }

  stopAll(): void {
    this.stopAllZaehler++;
    for (const id of [...this.active.keys()]) this.beende(id);
    this.melde();
  }

  /** Eine Instanz stoppen und austragen, ohne Meldung (wie bisher `stop`). */
  private beende(cueId: number): void {
    const src = this.active.get(cueId);
    if (src) {
      try {
        src.stop();
      } catch {
        // bereits beendet
      }
      this.active.delete(cueId);
    }
  }

  isPlaying(cueId: number): boolean {
    return this.active.has(cueId);
  }

  /** Buffer für entfernte/ersetzte Cues vergessen. */
  forget(mediaId: number): void {
    this.buffers.delete(mediaId);
  }
}

export const cueEngine = new CueEngine();
