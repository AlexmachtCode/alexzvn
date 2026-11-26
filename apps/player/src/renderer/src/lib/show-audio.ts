import type { ShowCue } from '@shared/types';

const MIN_GAIN = 0.0001; // exponentialRamp darf nicht auf 0 zielen

/** Gründe, aus denen ein Cue nicht lädt (Altfehler PL-T14); der Store zeigt sie im Hinweis und schreibt sie ins Log. */
export const SHOW_AUDIO_GRUND = {
  datei: 'Datei fehlt oder ist nicht lesbar.',
  format: 'Datei lässt sich nicht als Ton abspielen.',
} as const;

/**
 * WebAudio-Engine für die Cue-Show (getrennt vom Soundboard-Engine). Dekodiert
 * Cue-Medien einmal vor und spielt sie mit Fade-In/Out, Gain und Loop. `onEnded`
 * feuert nur beim NATÜRLICHEN Ende (nicht bei manuellem Stop) — daran hängt das
 * Auto-Continue der Show.
 */
class ShowAudio {
  private ctx: AudioContext | null = null;
  private buffers = new Map<number, AudioBuffer>(); // key = mediaId
  private active = new Map<number, { src: AudioBufferSourceNode; gain: GainNode }>(); // key = cueId

  private context(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  async preload(mediaId: number, url: string): Promise<void> {
    if (this.buffers.has(mediaId)) return;
    // Altfehler PL-T14: Ein Fehler trägt seinen Grund; ein Puffer kommt erst nach gelungenem Dekodieren in den Cache.
    let arr: ArrayBuffer;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(SHOW_AUDIO_GRUND.datei);
      arr = await res.arrayBuffer();
    } catch {
      throw new Error(SHOW_AUDIO_GRUND.datei);
    }
    let buf: AudioBuffer;
    try {
      buf = await this.context().decodeAudioData(arr);
    } catch {
      throw new Error(SHOW_AUDIO_GRUND.format);
    }
    this.buffers.set(mediaId, buf);
  }

  async play(cue: ShowCue, url: string, onEnded: () => void): Promise<void> {
    if (cue.mediaId == null) return;
    let buf = this.buffers.get(cue.mediaId);
    if (!buf) {
      await this.preload(cue.mediaId, url);
      buf = this.buffers.get(cue.mediaId);
      if (!buf) return;
    }
    this.stopNow(cue.id); // Re-Trigger: laufende Instanz hart ablösen

    const ctx = this.context();
    if (ctx.state === 'suspended') await ctx.resume();

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = cue.loop;
    const gain = ctx.createGain();
    const target = Math.max(MIN_GAIN, Math.pow(10, (cue.gainDb || 0) / 20));
    const now = ctx.currentTime;

    if (cue.fadeInSec > 0) {
      gain.gain.setValueAtTime(MIN_GAIN, now);
      gain.gain.exponentialRampToValueAtTime(target, now + cue.fadeInSec);
    } else {
      gain.gain.setValueAtTime(target, now);
    }
    // Fade-Out vor dem natürlichen Ende (nur sinnvoll bei nicht-loopenden Cues).
    if (!cue.loop && cue.fadeOutSec > 0 && buf.duration > cue.fadeOutSec) {
      const fadeStart = now + buf.duration - cue.fadeOutSec;
      gain.gain.setValueAtTime(target, fadeStart);
      gain.gain.exponentialRampToValueAtTime(MIN_GAIN, now + buf.duration);
    }

    src.connect(gain).connect(ctx.destination);
    src.onended = () => {
      if (this.active.get(cue.id)?.src === src) {
        this.active.delete(cue.id);
        onEnded();
      }
    };
    src.start();
    this.active.set(cue.id, { src, gain });
  }

  /** Sofort stoppen, ohne onEnded auszulösen (Re-Trigger / Panik). */
  private stopNow(cueId: number): void {
    const a = this.active.get(cueId);
    if (!a) return;
    a.src.onended = null;
    try {
      a.src.stop();
    } catch {
      // bereits beendet
    }
    this.active.delete(cueId);
  }

  /** Manueller Stop mit optionalem Fade-Out (kein Auto-Continue). */
  stop(cueId: number, fadeOutSec = 0): void {
    const a = this.active.get(cueId);
    if (!a) return;
    a.src.onended = null; // manueller Stop → kein Auto-Continue
    this.active.delete(cueId);
    if (fadeOutSec > 0) {
      const ctx = this.context();
      const now = ctx.currentTime;
      try {
        a.gain.gain.cancelScheduledValues(now);
        a.gain.gain.setValueAtTime(Math.max(MIN_GAIN, a.gain.gain.value), now);
        a.gain.gain.exponentialRampToValueAtTime(MIN_GAIN, now + fadeOutSec);
      } catch {
        // ignore
      }
      const src = a.src;
      setTimeout(() => {
        try {
          src.stop();
        } catch {
          // bereits beendet
        }
      }, fadeOutSec * 1000 + 60);
    } else {
      try {
        a.src.stop();
      } catch {
        // bereits beendet
      }
    }
  }

  panic(): void {
    for (const id of [...this.active.keys()]) this.stopNow(id);
  }

  async suspend(): Promise<void> {
    if (this.ctx && this.ctx.state === 'running') await this.ctx.suspend();
  }

  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();
  }

  forget(mediaId: number): void {
    this.buffers.delete(mediaId);
  }
}

export const showAudio = new ShowAudio();
