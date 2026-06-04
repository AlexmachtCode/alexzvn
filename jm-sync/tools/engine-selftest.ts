// Standalone verification of the framework-neutral engine math against synthetic
// signals. Run: `npm run selftest`. No DOM / AudioWorklet needed — these are the
// same pure functions the browser detectors use.

import { median, mad, computeStats } from '../src/renderer/src/core/stats';
import { RisingEdgeDetector } from '../src/renderer/src/core/edge';
import { OnsetCore, defaultOnsetOptions } from '../src/renderer/src/core/audio-onset-core';
import { Correlator } from '../src/renderer/src/core/correlator';

let passed = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (!cond) {
    console.error(`✗ ${name} ${detail}`);
    process.exitCode = 1;
  } else {
    passed++;
    console.log(`✓ ${name} ${detail}`);
  }
}
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// --- stats ----------------------------------------------------------------
check('median odd', median([3, 1, 2]) === 2);
check('median even', median([1, 2, 3, 4]) === 2.5);
check('mad', mad([10, 10, 12, 8]) === 1);

const s = computeStats([9, 10, 10, 10, 11, 200])!;
check('computeStats rejects outlier', s.count === 5 && near(s.medianMs, 10, 0.001), `count=${s.count} med=${s.medianMs}`);

// --- rising-edge detector (sub-frame interpolation) -----------------------
{
  const det = new RisingEdgeDetector();
  const dt = 1000 / 60; // 60 fps
  const crossings: number[] = [];
  let t = 0;
  const push = (v: number) => {
    const c = det.push(v, t);
    if (c != null) crossings.push(c);
    t += dt;
  };
  for (let i = 0; i < 30; i++) push(0.1); // establish dark baseline
  const tBeforePulse = t - dt; // time of last dark frame
  push(0.9); // flash → expect crossing ~ midpoint between last dark and this frame
  for (let i = 0; i < 10; i++) push(0.9); // stay bright
  for (let i = 0; i < 20; i++) push(0.1); // dark again (re-arm)
  push(0.9); // second flash
  for (let i = 0; i < 10; i++) push(0.9);

  check('edge: two flashes detected', crossings.length === 2, `got ${crossings.length}`);
  check(
    'edge: sub-frame interpolation',
    near(crossings[0], tBeforePulse + dt * 0.5, 1),
    `cross=${crossings[0]?.toFixed(2)} expected≈${(tBeforePulse + dt * 0.5).toFixed(2)}`,
  );
}

// --- Goertzel onset core --------------------------------------------------
{
  const sr = 48000;
  const opts = defaultOnsetOptions(sr, 1000);
  const core = new OnsetCore(opts);
  const total = sr; // 1 s
  const burstStart = 24000;
  const burstLen = Math.round(sr * 0.03);
  const signal = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    let v = (Math.sin(i) * 1e-4); // negligible noise
    if (i >= burstStart && i < burstStart + burstLen) {
      v += 0.5 * Math.sin((2 * Math.PI * 1000 * i) / sr);
    }
    signal[i] = v;
  }
  const onsets: number[] = [];
  for (let i = 0; i < total; i += 128) {
    const block = signal.subarray(i, Math.min(i + 128, total));
    for (const o of core.push(block, i)) onsets.push(o);
  }
  check('onset: exactly one burst detected', onsets.length === 1, `got ${onsets.length}`);
  check(
    'onset: located near burst start',
    onsets.length > 0 && near(onsets[0], burstStart, opts.windowSize * 2),
    `onset=${onsets[0]} expected≈${burstStart}`,
  );

  const silentCore = new OnsetCore(defaultOnsetOptions(sr, 1000));
  const silent: number[] = [];
  const noise = new Float32Array(2048).map((_, i) => Math.sin(i) * 1e-4);
  for (let i = 0; i < 24; i++) for (const o of silentCore.push(noise, i * 2048)) silent.push(o);
  check('onset: no false positive on noise', silent.length === 0, `got ${silent.length}`);
}

// --- correlator -----------------------------------------------------------
{
  const c = new Correlator();
  // audio arrives 5 ms before video → offset should read +5 (audio leads).
  for (let k = 0; k < 6; k++) {
    const base = 1000 + k * 2000;
    c.addFlash(base);
    c.addBeep(base - 5);
  }
  const st = c.stats()!;
  check('correlator: pairs all cycles', st.count === 6, `count=${st.count}`);
  check('correlator: +5 ms (audio leads)', near(st.medianMs, 5, 0.001), `median=${st.medianMs}`);
}

// --- correlator robustness (missed / spurious events) ---------------------
{
  // One cycle is missing its beep → that flash stays unpaired, rest are correct.
  const c = new Correlator();
  for (let k = 0; k < 6; k++) {
    const base = 1000 + k * 2000;
    c.addFlash(base);
    if (k !== 3) c.addBeep(base - 5);
  }
  const st = c.stats()!;
  check('correlator: tolerates a missed beep', st.count === 5, `count=${st.count}`);
  check('correlator: median unaffected by gap', near(st.medianMs, 5, 0.001), `median=${st.medianMs}`);
}
{
  // A spurious beep far outside the pair window must be ignored.
  const c = new Correlator();
  c.addFlash(1000);
  c.addBeep(995);
  c.addBeep(50000); // noise burst, no matching flash
  const samples = c.samples();
  check('correlator: ignores out-of-window beep', samples.length === 1, `n=${samples.length}`);
}
{
  // Two flashes share a nearby beep — global matching must not double-assign.
  const c = new Correlator();
  c.addFlash(1000);
  c.addFlash(1100);
  c.addBeep(1010); // closest to flash#1
  c.addBeep(1108); // closest to flash#2
  const s = c.samples();
  check(
    'correlator: no double-assignment',
    s.length === 2 && near(s[0].offsetMs, -10, 0.001) && near(s[1].offsetMs, -8, 0.001),
    `n=${s.length} offs=${s.map((x) => x.offsetMs).join(',')}`,
  );
}

// --- end-to-end integration (real detectors, synthetic capture) -----------
// Simulate a captured stream where audio leads video by a known offset, run it
// through the ACTUAL flash + onset detectors + correlator, and check recovery.
{
  const sr = 48000;
  const fps = 60;
  const K = 5;
  const interval = 2.0; // s between cycles
  const videoMarker = 0.1; // flash at cycleStart + 0.10 s
  const audioMarker = 0.07; // beep  at cycleStart + 0.07 s  → audio leads by 30 ms
  const flashDur = 0.12;
  const beepDur = 0.06;
  const trueOffset = (videoMarker - audioMarker) * 1000; // +30 ms (audio leads)
  const duration = K * interval + 0.5;

  // Video: feed luminance frames through the real RisingEdgeDetector.
  const flashDet = new RisingEdgeDetector();
  const flashes: number[] = [];
  const frames = Math.floor(duration * fps);
  for (let f = 0; f < frames; f++) {
    const t = f / fps;
    let lum = 0.1;
    for (let k = 0; k < K; k++) {
      const on = k * interval + videoMarker;
      if (t >= on && t < on + flashDur) lum = 0.9;
    }
    const c = flashDet.push(lum, t * 1000);
    if (c != null) flashes.push(c);
  }

  // Audio: feed PCM blocks through the real OnsetCore.
  const onsetCore = new OnsetCore(defaultOnsetOptions(sr, 1000));
  const beeps: number[] = [];
  const total = Math.floor(duration * sr);
  for (let i = 0; i < total; i += 128) {
    const n = Math.min(128, total - i);
    const block = new Float32Array(n);
    for (let j = 0; j < n; j++) {
      const idx = i + j;
      const t = idx / sr;
      let v = Math.sin(idx) * 1e-4;
      for (let k = 0; k < K; k++) {
        const on = k * interval + audioMarker;
        if (t >= on && t < on + beepDur) v += 0.5 * Math.sin((2 * Math.PI * 1000 * idx) / sr);
      }
      block[j] = v;
    }
    for (const o of onsetCore.push(block, i)) beeps.push((o / sr) * 1000);
  }

  const corr = new Correlator();
  flashes.forEach((t) => corr.addFlash(t));
  beeps.forEach((t) => corr.addBeep(t));
  const st = corr.stats();

  check('e2e: detected all cycles', !!st && st.count === K, `count=${st?.count} (flashes=${flashes.length} beeps=${beeps.length})`);
  check(
    'e2e: recovers offset (within frame/onset resolution)',
    !!st && near(st.medianMs, trueOffset, 12),
    `median=${st?.medianMs?.toFixed(1)} expected≈+${trueOffset} (bias removed by calibration in real use)`,
  );
  check('e2e: low jitter', !!st && st.madMs <= 6, `mad=${st?.madMs?.toFixed(1)}`);
}

console.log(`\n${passed} checks passed.`);
