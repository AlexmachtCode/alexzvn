// Pairs video-flash events with audio-beep events (both on the same performance
// clock, in ms) and derives the A/V offset. Sign convention matches SyncSample:
// offsetMs = videoMs − audioMs  →  positive means audio leads video.

import type { MeasurementStats, SyncSample } from '@shared/types';
import { computeStats } from './stats';

export interface CorrelatorOptions {
  /** Max time between a flash and its matching beep to count as a pair (ms). */
  pairWindowMs: number;
  /** Keep at most this many recent events per channel (bounds re-pairing cost). */
  maxEvents: number;
}

export const DEFAULT_CORRELATOR_OPTIONS: CorrelatorOptions = {
  pairWindowMs: 350,
  maxEvents: 64,
};

export class Correlator {
  private opts: CorrelatorOptions;
  private flashes: number[] = [];
  private beeps: number[] = [];
  private cycle = 0;

  constructor(opts: Partial<CorrelatorOptions> = {}) {
    this.opts = { ...DEFAULT_CORRELATOR_OPTIONS, ...opts };
  }

  addFlash(timeMs: number): void {
    this.flashes.push(timeMs);
    if (this.flashes.length > this.opts.maxEvents) this.flashes.shift();
  }

  addBeep(timeMs: number): void {
    this.beeps.push(timeMs);
    if (this.beeps.length > this.opts.maxEvents) this.beeps.shift();
  }

  /**
   * Global nearest-pair matching: build every flash↔beep candidate within the
   * window, then assign shortest-distance pairs first, one-to-one. This is robust
   * to missed or spurious events (a lone flash or beep simply stays unpaired),
   * unlike a left-to-right greedy walk that can mis-assign a shared neighbour.
   */
  samples(): SyncSample[] {
    const candidates: { fi: number; bi: number; dist: number }[] = [];
    for (let fi = 0; fi < this.flashes.length; fi++) {
      for (let bi = 0; bi < this.beeps.length; bi++) {
        const dist = Math.abs(this.beeps[bi] - this.flashes[fi]);
        if (dist <= this.opts.pairWindowMs) candidates.push({ fi, bi, dist });
      }
    }
    candidates.sort((a, b) => a.dist - b.dist);

    const usedF = new Set<number>();
    const usedB = new Set<number>();
    const matched: { fi: number; bi: number }[] = [];
    for (const c of candidates) {
      if (usedF.has(c.fi) || usedB.has(c.bi)) continue;
      usedF.add(c.fi);
      usedB.add(c.bi);
      matched.push({ fi: c.fi, bi: c.bi });
    }

    matched.sort((a, b) => this.flashes[a.fi] - this.flashes[b.fi]);
    return matched.map(({ fi, bi }, i) => {
      const videoMs = this.flashes[fi];
      const audioMs = this.beeps[bi];
      return { cycle: this.cycle + i, videoMs, audioMs, offsetMs: videoMs - audioMs };
    });
  }

  stats(): MeasurementStats | null {
    return computeStats(this.samples().map((s) => s.offsetMs));
  }

  reset(): void {
    this.flashes = [];
    this.beeps = [];
    this.cycle = 0;
  }
}
