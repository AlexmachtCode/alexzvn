import type { GraphicTemplate, TitlerConfig } from '@shared/types';

const FONT = '"Manrope Variable", system-ui, Arial, sans-serif';

/** Render-Kontext für eine importierte Grafik-Vorlage (#162). */
export interface GraphicRenderCtx {
  tpl: GraphicTemplate;
  /** Dekodierter Hintergrund (ImageBitmap/Canvas) — null, solange noch nicht geladen. */
  bg: CanvasImageSource | null;
  /** Aufgelöste Slot-Texte (key → fertiger Text). */
  slotText: Record<string, string>;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rr);
}

/** Optionen für {@link drawCg}. */
export interface DrawCgOptions {
  /**
   * Hintergrundfarbe statt Transparenz (#161, 2. Bildschirm/Chroma-Green). Wird
   * VOR dem Early-Return gefüllt, damit ein geleerter Ausgang eine volle
   * Chroma-Fläche ist (nicht schwarz). NDI-Aufrufer lassen dies weg → transparent.
   */
  bg?: string;
  /** Render-Daten der aktiven Grafik-Vorlage (#162), nötig bei template==='graphic'. */
  gfx?: GraphicRenderCtx;
}

function drawMultiline(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  baseline: number,
  lineHeight: number,
): void {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], x, baseline + i * lineHeight);
}

/**
 * Importierte Grafik-Vorlage zeichnen (#162): Hintergrund-Bild in Autoren-Auflösung
 * auf die Programmauflösung skalieren, dann je Slot den aufgelösten Text an seiner
 * Position setzen. `e` (0..1) treibt Fade + sanften Slide (wie die Built-ins).
 */
function drawGraphic(ctx: CanvasRenderingContext2D, W: number, H: number, gfx: GraphicRenderCtx, e: number): void {
  const { tpl, bg, slotText } = gfx;
  if (tpl.width <= 0 || tpl.height <= 0) return;
  ctx.save();
  const slide = (1 - e) * H * 0.04;
  ctx.translate(0, slide);
  ctx.scale(W / tpl.width, H / tpl.height);
  if (bg) ctx.drawImage(bg, 0, 0, tpl.width, tpl.height);
  ctx.textBaseline = 'alphabetic';
  for (const slot of tpl.slots) {
    const text = slotText[slot.key] ?? '';
    if (!text) continue;
    ctx.font = `${slot.fontWeight} ${slot.fontSize}px ${slot.fontFamily}`;
    ctx.fillStyle = slot.color;
    ctx.textAlign = slot.align;
    const x = slot.align === 'center' ? slot.x + slot.w / 2 : slot.align === 'right' ? slot.x + slot.w : slot.x;
    drawMultiline(ctx, text, x, slot.y + slot.fontSize, slot.fontSize * slot.lineHeight);
  }
  ctx.restore();
  ctx.textAlign = 'left';
}

/**
 * Zeichnet den CG auf den Offscreen-Canvas (Programmauflösung). Ohne `opts.bg`
 * transparent (für NDI-Key), mit `opts.bg` auf gefülltem Hintergrund (2. Bildschirm).
 * `vis` 0..1 steuert Ein-/Ausblendung (Alpha + Slide), `elapsedSec` treibt den
 * Ticker. Alle Maße relativ zur Höhe → auflösungsunabhängig.
 */
export function drawCg(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  c: TitlerConfig,
  vis: number,
  elapsedSec: number,
  opts?: DrawCgOptions,
): void {
  if (opts?.bg) {
    ctx.fillStyle = opts.bg;
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.clearRect(0, 0, W, H);
  }
  if (vis <= 0.001) return;

  const e = easeOutCubic(Math.max(0, Math.min(1, vis)));
  const S = c.scale;
  const bottom = c.position === 'bottom';

  ctx.save();
  ctx.globalAlpha = e;
  ctx.textBaseline = 'alphabetic';

  if (c.template === 'graphic') {
    if (opts?.gfx) drawGraphic(ctx, W, H, opts.gfx, e);
  } else if (c.template === 'lowerthird') {
    const nameSize = H * 0.052 * S;
    const subSize = H * 0.030 * S;
    const padX = H * 0.032 * S;
    const padY = H * 0.024 * S;
    const gap = H * 0.014 * S;
    const accentW = H * 0.012 * S;
    const hasSub = c.subtitle.trim().length > 0;

    ctx.font = `800 ${nameSize}px ${FONT}`;
    const nameW = ctx.measureText(c.name).width;
    ctx.font = `600 ${subSize}px ${FONT}`;
    const subW = hasSub ? ctx.measureText(c.subtitle).width : 0;

    const textW = Math.max(nameW, subW);
    const barH = padY * 2 + nameSize + (hasSub ? gap + subSize : 0);
    const barW = accentW + padX + textW + padX;
    const x = W * 0.06;
    const yBase = bottom ? H - H * 0.1 - barH : H * 0.1;
    const slide = (1 - e) * H * 0.05 * (bottom ? 1 : -1);
    const y = yBase + slide;

    // Panel
    ctx.fillStyle = c.colors.bar;
    roundRect(ctx, x, y, barW, barH, H * 0.012);
    ctx.fill();
    // Akzent-Stripe links
    ctx.fillStyle = c.colors.accent;
    roundRect(ctx, x, y, accentW, barH, H * 0.012);
    ctx.fill();

    const tx = x + accentW + padX;
    ctx.fillStyle = c.colors.text;
    ctx.font = `800 ${nameSize}px ${FONT}`;
    ctx.fillText(c.name, tx, y + padY + nameSize * 0.82);
    if (hasSub) {
      ctx.fillStyle = c.colors.accent;
      ctx.font = `600 ${subSize}px ${FONT}`;
      ctx.fillText(c.subtitle, tx, y + padY + nameSize + gap + subSize * 0.82);
    }
  } else if (c.template === 'banner') {
    const bandH = H * 0.1 * S;
    const yBase = bottom ? H - H * 0.08 - bandH : H * 0.08;
    const slide = (1 - e) * H * 0.05 * (bottom ? 1 : -1);
    const y = yBase + slide;
    const x = W * 0.06;
    const w = W * 0.88;

    ctx.fillStyle = c.colors.bar;
    roundRect(ctx, x, y, w, bandH, H * 0.012);
    ctx.fill();
    // Akzentlinie oben
    ctx.fillStyle = c.colors.accent;
    roundRect(ctx, x, y, w, H * 0.008, H * 0.004);
    ctx.fill();

    const fs = H * 0.045 * S;
    ctx.fillStyle = c.colors.text;
    ctx.font = `800 ${fs}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(c.bannerText, x + w / 2, y + bandH / 2 + fs * 0.34);
    ctx.textAlign = 'left';
  } else {
    // Ticker
    const bandH = H * 0.07 * S;
    const yBase = bottom ? H - bandH : 0;
    const slide = (1 - e) * bandH * (bottom ? 1 : -1);
    const y = yBase + slide;

    ctx.fillStyle = c.colors.bar;
    ctx.fillRect(0, y, W, bandH);
    // Akzentkante
    ctx.fillStyle = c.colors.accent;
    ctx.fillRect(0, bottom ? y : y + bandH - H * 0.006, W, H * 0.006);

    const fs = H * 0.034 * S;
    ctx.font = `700 ${fs}px ${FONT}`;
    ctx.fillStyle = c.colors.text;
    const text = c.tickerText.length ? c.tickerText : ' ';
    const blockW = ctx.measureText(text).width || 1;
    const offset = (elapsedSec * c.tickerSpeed * W) % blockW;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, W, bandH);
    ctx.clip();
    const ty = y + bandH / 2 + fs * 0.34;
    for (let sx = -offset; sx < W; sx += blockW) {
      ctx.fillText(text, sx, ty);
    }
    ctx.restore();
  }

  ctx.restore();
}
