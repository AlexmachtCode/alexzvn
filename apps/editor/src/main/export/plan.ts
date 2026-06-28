// Wandelt eine Timeline in EIN ffmpeg-Kommando (filter_complex) um.
//
// Strategie (siehe Plan): robuster filter_complex-Pfad. Jeder Clip wird auf die
// Sequenz (W×H×fps, yuv420p) normalisiert → gemischte Codecs/Auflösungen sind
// verkettbar. Lücken = schwarze color-Quelle. Übergänge = xfade. Titel = Overlay
// vom Renderer gerenderter Vollbild-PNGs. Audio = atrim/adelay/volume → amix.
import { clipDurationUs, usToSec, type Clip, type Project } from '@shared/project';
import { getPreset, usesAudioBitrate, type VideoPreset } from '@shared/presets';

export interface PlanInput {
  project: Project;
  /** clipId → Pfad eines vollflächigen, transparenten Titel-PNGs (Sequenzauflösung). */
  titleFiles: Map<string, string>;
  encoder: string;
}

export interface ExportPlan {
  args: string[];
  totalSec: number;
}

const s = (us: number): string => usToSec(us).toFixed(6);

interface MediaInput {
  index: number;
  path: string;
}

/** Normalisierungs-Kette für einen Video-Clip auf die Sequenz. */
function normalizeVideo(label: string, srcLabel: string, clip: Clip, p: Project): string {
  const { width: W, height: H, fps } = p.export;
  const mode = clip.transform?.scaleMode ?? 'fit';
  let scalePad: string;
  if (mode === 'stretch') {
    scalePad = `scale=${W}:${H}`;
  } else if (mode === 'fill') {
    scalePad = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`;
  } else {
    scalePad = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black`;
  }
  return (
    `[${srcLabel}]trim=start=${s(clip.inUs)}:end=${s(clip.outUs)},setpts=PTS-STARTPTS,` +
    `${scalePad},fps=${fps},format=yuv420p,setsar=1[${label}]`
  );
}

/** Schwarzes Segment (Lücke / Vorlauf). */
function blackSegment(label: string, durUs: number, p: Project): string {
  const { width: W, height: H, fps } = p.export;
  return `color=c=black:s=${W}x${H}:r=${fps}:d=${s(durUs)},format=yuv420p,setsar=1[${label}]`;
}

export function buildPlan(input: PlanInput): ExportPlan {
  const { project, titleFiles, encoder } = input;
  const preset = getPreset(project.export.presetId);
  if (!preset) throw new Error(`Unbekanntes Preset: ${project.export.presetId}`);

  // Videospuren in z-Reihenfolge (Array-Reihenfolge = oben→unten). Basis = die
  // unterste (im Array letzte) sichtbare Spur mit Clips; alle darüberliegenden
  // Spuren werden wie Titel als Overlays draufkomponiert (oberste gewinnt).
  const videoTracks = project.tracks.filter((t) => t.kind === 'video');
  const clipBearing = videoTracks
    .map((t, i) => ({ t, i }))
    .filter((x) => !x.t.muted && x.t.clips.length > 0);
  if (clipBearing.length === 0) throw new Error('Keine Videoclips auf der Timeline.');
  const baseEntry = clipBearing[clipBearing.length - 1];
  const baseTrack = baseEntry.t;
  // Obere Spuren von unten nach oben (damit die oberste zuletzt = ganz oben liegt).
  const upperEntries = clipBearing.filter((x) => x.i < baseEntry.i).sort((a, b) => b.i - a.i);
  const videoClips = [...baseTrack.clips].sort((a, b) => a.startUs - b.startUs);

  // ── Inputs sammeln (Original-Dateien, KEINE Proxies) ──────────────────────
  const inputs: string[] = [];
  const mediaInputs = new Map<string, MediaInput>(); // assetId → input
  const addMedia = (assetId: string, path: string): number => {
    const existing = mediaInputs.get(assetId);
    if (existing) return existing.index;
    const index = countInputs(inputs);
    inputs.push('-i', path);
    mediaInputs.set(assetId, { index, path });
    return index;
  };

  const assetPath = (assetId: string | undefined): string | undefined =>
    project.assets.find((a) => a.id === assetId)?.path;

  const filters: string[] = [];

  // ── Video-Basisspur: Segmente bauen (Lücken + Clips), dann L→R kombinieren ──
  interface Seg {
    label: string;
    durUs: number;
    transitionUs: number; // Blendendauer am Kopf dieses Segments (0 = Cut)
    clipId?: string;
  }
  const segs: Seg[] = [];
  let cursor = 0;
  let segN = 0;

  for (const clip of videoClips) {
    if (clip.startUs > cursor) {
      const gapLabel = `g${segN++}`;
      filters.push(blackSegment(gapLabel, clip.startUs - cursor, project));
      segs.push({ label: gapLabel, durUs: clip.startUs - cursor, transitionUs: 0 });
    }
    const path = assetPath(clip.assetId);
    if (!path) continue;
    const idx = addMedia(clip.assetId!, path);
    const vLabel = `v${segN++}`;
    filters.push(normalizeVideo(vLabel, `${idx}:v`, clip, project));
    const transitionUs = clip.transitionIn?.durationUs ?? 0;
    segs.push({ label: vLabel, durUs: clipDurationUs(clip), transitionUs, clipId: clip.id });
    cursor = clip.startUs + clipDurationUs(clip);
  }

  // Kombinieren: concat (Cut) oder xfade (Blende). Dabei die GE-RENDERTE Startzeit
  // jedes Clips merken — xfade verkürzt die Timeline, daher müssen Audio + Titel
  // auf diese gerenderte Zeitachse abgebildet werden (sonst Versatz/Drift).
  const renderedStart = new Map<string, number>(); // clipId → gerenderte Startzeit (µs)
  let accLabel = segs[0].label;
  let accUs = segs[0].durUs;
  if (segs[0].clipId) renderedStart.set(segs[0].clipId, 0);
  for (let i = 1; i < segs.length; i++) {
    const seg = segs[i];
    const out = `vb${i}`;
    const trans = Math.min(seg.transitionUs, accUs, seg.durUs);
    let thisStart: number;
    if (trans > 0) {
      thisStart = accUs - trans;
      filters.push(`[${accLabel}][${seg.label}]xfade=transition=fade:duration=${s(trans)}:offset=${s(thisStart)}[${out}]`);
      accUs = accUs + seg.durUs - trans;
    } else {
      thisStart = accUs;
      filters.push(`[${accLabel}][${seg.label}]concat=n=2:v=1:a=0[${out}]`);
      accUs = accUs + seg.durUs;
    }
    if (seg.clipId) renderedStart.set(seg.clipId, thisStart);
    accLabel = out;
  }
  // Original-Timeline → gerenderte Timeline (für Titel-/Overlay-Einblendung).
  const sortedVideo = [...videoClips].sort((a, b) => a.startUs - b.startUs);
  const originalToRendered = (tUs: number): number => {
    let shift = 0;
    for (const clip of sortedVideo) {
      if (tUs < clip.startUs) break;
      shift = clip.startUs - (renderedStart.get(clip.id) ?? clip.startUs);
    }
    return Math.max(0, tUs - shift);
  };

  // ── Obere Videospuren als Overlays (B-Roll / Layering; oberste gewinnt) ────
  // Basis ggf. mit Schwarz verlängern, falls obere Spuren über ihr Ende hinausgehen.
  let neededUs = accUs;
  for (const { t } of upperEntries)
    for (const clip of t.clips)
      neededUs = Math.max(neededUs, originalToRendered(clip.startUs) + clipDurationUs(clip));
  if (neededUs > accUs + 1000) {
    filters.push(blackSegment('vtail', neededUs - accUs, project));
    filters.push(`[${accLabel}][vtail]concat=n=2:v=1:a=0[vfull]`);
    accLabel = 'vfull';
    accUs = neededUs;
  }
  const videoRenderedEndUs = accUs;

  let videoOut = accLabel;
  let upN = 0;
  for (const { t } of upperEntries) {
    for (const clip of [...t.clips].sort((a, b) => a.startUs - b.startUs)) {
      const path = assetPath(clip.assetId);
      if (!path) continue;
      const idx = addMedia(clip.assetId!, path);
      const durUs = clipDurationUs(clip);
      const startUs = originalToRendered(clip.startUs);
      const endUs = startUs + durUs;
      const norm = `uv${upN}`;
      filters.push(normalizeVideo(norm, `${idx}:v`, clip, project));
      const shifted = `uvs${upN}`;
      filters.push(`[${norm}]setpts=PTS-STARTPTS+${s(startUs)}/TB[${shifted}]`);
      const out = `uvo${upN}`;
      filters.push(
        `[${videoOut}][${shifted}]overlay=0:0:eof_action=pass:enable='between(t,${usToSec(startUs).toFixed(3)},${usToSec(endUs).toFixed(3)})'[${out}]`,
      );
      videoOut = out;
      upN++;
    }
  }

  // ── Titel-Overlays (Overlay-Spuren) ──────────────────────────────────────
  let titleN = 0;
  for (const track of project.tracks) {
    if (track.kind !== 'overlay' || track.muted) continue;
    for (const clip of [...track.clips].sort((a, b) => a.startUs - b.startUs)) {
      const file = titleFiles.get(clip.id);
      if (!file) continue;
      const durUs = clipDurationUs(clip);
      const startUs = originalToRendered(clip.startUs);
      const endUs = startUs + durUs;
      const idx = countInputs(inputs);
      inputs.push('-loop', '1', '-framerate', String(project.export.fps), '-t', usToSec(durUs).toFixed(6), '-i', file);
      const tLabel = `t${titleN}`;
      filters.push(
        `[${idx}:v]scale=${project.export.width}:${project.export.height},` +
          `setpts=PTS-STARTPTS+${usToSec(startUs).toFixed(6)}/TB[${tLabel}]`,
      );
      const out = `ov${titleN}`;
      filters.push(
        `[${videoOut}][${tLabel}]overlay=0:0:eof_action=pass:enable='between(t,${usToSec(startUs).toFixed(3)},${usToSec(endUs).toFixed(3)})'[${out}]`,
      );
      videoOut = out;
      titleN++;
    }
  }

  // ── Audio: Clip-Ton (Video-Spur) + Audio-Spuren → amix ────────────────────
  const audioLabels: string[] = [];
  let aN = 0;
  let audioRenderedEndUs = videoRenderedEndUs;
  const addAudioFrom = (clip: Clip, startUs: number): void => {
    // Video-Clips, deren Ton als verknüpfter Audio-Clip ausgekoppelt wurde, hier
    // überspringen — sonst läge der Ton doppelt im amix.
    if (clip.muteSource) return;
    const asset = project.assets.find((a) => a.id === clip.assetId);
    if (!asset || !asset.hasAudio) return;
    const idx = addMedia(asset.id, asset.path);
    const gain = clip.gain ?? 1;
    const delayMs = Math.max(0, Math.round(usToSec(startUs) * 1000));
    const lbl = `a${aN++}`;
    filters.push(
      `[${idx}:a]atrim=start=${s(clip.inUs)}:end=${s(clip.outUs)},asetpts=PTS-STARTPTS,` +
        `volume=${gain.toFixed(3)},aformat=sample_rates=48000:channel_layouts=stereo,` +
        `adelay=${delayMs}:all=1[${lbl}]`,
    );
    audioLabels.push(lbl);
    audioRenderedEndUs = Math.max(audioRenderedEndUs, startUs + clipDurationUs(clip));
  };

  // Basisspur-Ton folgt der gerenderten (xfade-verkürzten) Zeitachse.
  for (const clip of videoClips) addAudioFrom(clip, renderedStart.get(clip.id) ?? clip.startUs);
  // Obere Videospuren: Ton an der gerenderten Position.
  for (const { t } of upperEntries)
    for (const clip of t.clips) addAudioFrom(clip, originalToRendered(clip.startUs));
  // Reine Audiospuren.
  for (const track of project.tracks) {
    if (track.kind !== 'audio' || track.muted) continue;
    for (const clip of track.clips) addAudioFrom(clip, clip.startUs);
  }

  const wantAudio = project.export.audioCodec !== 'none' && audioLabels.length > 0;
  let audioOut: string | null = null;
  if (wantAudio) {
    if (audioLabels.length === 1) {
      audioOut = audioLabels[0];
    } else {
      audioOut = 'aout';
      filters.push(`${audioLabels.map((l) => `[${l}]`).join('')}amix=inputs=${audioLabels.length}:normalize=0[aout]`);
    }
  }

  // ── Encode-Tail ───────────────────────────────────────────────────────────
  const totalSec = usToSec(Math.max(videoRenderedEndUs, audioRenderedEndUs));
  const args: string[] = ['-y', ...inputs, '-filter_complex', filters.join(';'), '-map', `[${videoOut}]`];

  if (audioOut) args.push('-map', `[${audioOut}]`);

  args.push('-c:v', encoder, ...videoRateArgs(preset, encoder, project), ...(preset.extraArgs ?? []));

  if (audioOut) {
    args.push('-c:a', project.export.audioCodec);
    if (usesAudioBitrate(project.export.audioCodec) && project.export.audioBitrateKbps) {
      args.push('-b:a', `${project.export.audioBitrateKbps}k`);
    }
  } else {
    args.push('-an');
  }

  args.push('-progress', 'pipe:1', '-nostats', '-loglevel', 'error');
  return { args, totalSec };
}

function countInputs(inputs: string[]): number {
  // Jeder Input endet auf '-i <path>' → Anzahl der '-i'-Flags.
  return inputs.filter((a) => a === '-i').length;
}

/** Rate-Control-Args (aus Media Converter), bezogen auf die ExportSettings. */
export function videoRateArgs(preset: VideoPreset, encoder: string, project: Project): string[] {
  if (preset.qualityKind !== 'crf') return [];
  const { rateControl, quality, bitrateKbps } = project.export;
  if (rateControl === 'quality') {
    const q = quality ?? preset.defaultQuality ?? 22;
    if (encoder.endsWith('_nvenc')) return ['-rc', 'vbr', '-cq', String(q), '-b:v', '0'];
    if (encoder.endsWith('_qsv')) return ['-global_quality', String(q)];
    if (encoder.endsWith('_vaapi')) return ['-qp', String(q)];
    if (encoder.endsWith('_videotoolbox')) {
      const [lo, hi] = preset.qualityRange ?? [14, 32];
      const t = Math.min(1, Math.max(0, (q - lo) / (hi - lo)));
      const vq = Math.round(80 - t * 45);
      return ['-q:v', String(Math.min(100, Math.max(1, vq)))];
    }
    return ['-crf', String(q)];
  }
  const kbps = Math.max(100, Math.round(bitrateKbps ?? 8000));
  const b = `${kbps}k`;
  const buf = `${kbps * 2}k`;
  if (rateControl === 'cbr') {
    if (encoder.endsWith('_nvenc')) return ['-rc', 'cbr', '-b:v', b];
    if (encoder.endsWith('_qsv')) return ['-b:v', b, '-maxrate', b, '-bufsize', buf];
    if (encoder.endsWith('_vaapi')) return ['-rc_mode', 'CBR', '-b:v', b];
    if (encoder.endsWith('_videotoolbox')) return ['-b:v', b];
    return ['-b:v', b, '-minrate', b, '-maxrate', b, '-bufsize', buf];
  }
  if (encoder.endsWith('_nvenc')) return ['-rc', 'vbr', '-b:v', b, '-maxrate', `${Math.round(kbps * 1.5)}k`];
  if (encoder.endsWith('_qsv')) return ['-b:v', b];
  if (encoder.endsWith('_vaapi')) return ['-rc_mode', 'VBR', '-b:v', b];
  if (encoder.endsWith('_videotoolbox')) return ['-b:v', b];
  return ['-b:v', b];
}
