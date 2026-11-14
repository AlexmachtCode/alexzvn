import type { Overlay, Slide } from '@shared/types';
import { getImageBytes } from './assets';
import { bytesToBlob } from './bytes';

// Single source of truth for how a slide looks: base page + overlays composited
// onto a canvas. Used by the audience window, the presenter previews and the PDF
// export, so what you arrange in the editor is exactly what gets shown/exported.

const overlayBitmaps = new Map<string, ImageBitmap>();

/** Pre-decode every overlay image used by the given slides (paint is sync). */
export async function ensureOverlayBitmaps(slides: Slide[]): Promise<void> {
  const ids = new Set<string>();
  for (const s of slides) {
    for (const o of s.overlays) if (o.kind === 'image' && o.imageId) ids.add(o.imageId);
  }
  await Promise.all(
    [...ids].map(async (id) => {
      if (overlayBitmaps.has(id)) return;
      const bytes = getImageBytes(id);
      if (!bytes) return;
      try {
        overlayBitmaps.set(id, await createImageBitmap(bytesToBlob(bytes)));
      } catch {
        // ignore undecodable image
      }
    }),
  );
}

/** Alle vorab dekodierten Overlay-Bilder schließen und vergessen (#303: neue Präsentation im NDI-Fenster). */
export function clearOverlayBitmaps(): void {
  for (const bmp of overlayBitmaps.values()) bmp.close();
  overlayBitmaps.clear();
}

export const FONT_FAMILY = '"Manrope Variable", ui-sans-serif, system-ui, sans-serif';

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph === '') {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    out.push(line);
  }
  return out;
}

function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  o: Overlay,
  W: number,
  H: number,
): void {
  const pw = o.w * W;
  const ph = o.h * H;
  const fontPx = Math.max(6, (o.fontFrac ?? 0.06) * H);
  if (o.background) {
    ctx.fillStyle = o.background;
    ctx.fillRect(0, 0, pw, ph);
  }
  ctx.font = `${o.bold ? 700 : 500} ${fontPx}px ${FONT_FAMILY}`;
  ctx.fillStyle = o.color ?? '#ffffff';
  ctx.textBaseline = 'top';
  const pad = fontPx * 0.25;
  const lines = wrapLines(ctx, o.text ?? '', pw - pad * 2);
  const lineHeight = fontPx * 1.2;
  const blockHeight = lines.length * lineHeight;
  let ty = Math.max(pad, (ph - blockHeight) / 2);
  for (const line of lines) {
    let tx = pad;
    ctx.textAlign = 'left';
    if (o.align === 'center') {
      tx = pw / 2;
      ctx.textAlign = 'center';
    } else if (o.align === 'right') {
      tx = pw - pad;
      ctx.textAlign = 'right';
    }
    ctx.fillText(line, tx, ty);
    ty += lineHeight;
  }
}

function drawImageOverlay(ctx: CanvasRenderingContext2D, o: Overlay, W: number, H: number): void {
  const bmp = o.imageId ? overlayBitmaps.get(o.imageId) : undefined;
  if (!bmp) return;
  const pw = o.w * W;
  const ph = o.h * H;
  // contain
  const scale = Math.min(pw / bmp.width, ph / bmp.height);
  const dw = bmp.width * scale;
  const dh = bmp.height * scale;
  ctx.drawImage(bmp, (pw - dw) / 2, (ph - dh) / 2, dw, dh);
}

/** Paint just the overlays (no base) into the target context, sized WxH. Used by
 *  the vector PDF export to stamp overlays over a vector page background. */
export function paintOverlays(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  W: number,
  H: number,
): void {
  for (const o of slide.overlays) {
    ctx.save();
    ctx.translate(o.x * W, o.y * H);
    if (o.rotation) {
      const cx = (o.w * W) / 2;
      const cy = (o.h * H) / 2;
      ctx.translate(cx, cy);
      ctx.rotate((o.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }
    if (o.kind === 'text') drawTextOverlay(ctx, o, W, H);
    else drawImageOverlay(ctx, o, W, H);
    ctx.restore();
  }
}

/** Paint base + overlays into the target context, sized WxH. */
export function paintSlide(
  ctx: CanvasRenderingContext2D,
  base: CanvasImageSource,
  slide: Slide,
  W: number,
  H: number,
): void {
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(base, 0, 0, W, H);
  paintOverlays(ctx, slide, W, H);
}
