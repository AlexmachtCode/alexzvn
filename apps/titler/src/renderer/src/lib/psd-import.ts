import { readPsd, type Layer as PsdLayer } from 'ag-psd';
import { unzipSync, strFromU8 } from 'fflate';
import type { TitlerSlot } from '@shared/types';

// Bauchbinden-Import (#162): PSD oder .jmtitler-Bündel → flacher Hintergrund + Slots.
// Die Text-Extraktion ist ein schlanker Port von psdTextLayer aus
// apps/grafiktool/src/renderer/src/engine/io/psd.ts (bewusst dupliziert, um die
// Titler-App nicht an die Grafiktool-Layer-Engine zu koppeln — bei einem dritten
// Konsumenten in ein @jm/psd-slots-Paket extrahieren). Bitte mit dem Original
// synchron halten.

/** In-Memory-Ergebnis eines Imports (Hintergrund als Canvas, Slots als Metadaten). */
export interface ParsedTemplate {
  width: number;
  height: number;
  background: HTMLCanvasElement;
  slots: TitlerSlot[];
}

/**
 * Auto-Mapping Ebenenname → DataLink-Variable. Deckt die Grafiktool-Bauchbinden-
 * Layernamen (Titel/Untertitel) und die DataLink-Label-Keys ab. Geteilt mit dem
 * Grafiktool-Export (titlerBundle.ts) — dort dieselbe Tabelle spiegeln.
 */
const VAR_MAP: { re: RegExp; placeholder: string }[] = [
  { re: /^(titel|title|name|sprecher|speaker)$/i, placeholder: '{{name}}' },
  { re: /^(untertitel|subtitle|funktion|function|rolle|role)$/i, placeholder: '{{subtitle}}' },
  { re: /^(ort|location|stadt|city)$/i, placeholder: '{{location}}' },
];

/** Ebenenname → Platzhalter, sonst der Literaltext der Ebene. */
export function autoMapVariable(layerName: string, literal: string): string {
  const trimmed = layerName.trim();
  for (const m of VAR_MAP) if (m.re.test(trimmed)) return m.placeholder;
  return literal;
}

/** Ebenenname → stabiler Slot-Schlüssel (Adresse für TITLER SLOT / slotText). */
export function sanitizeKey(name: string): string {
  const k = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return k || 'slot';
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number): string => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Aus einer PSD-Textebene einen füllbaren Slot bauen (best-effort; Port von psdTextLayer). */
function slotFromPsdText(layer: PsdLayer, uniqueKey: (base: string) => string): TitlerSlot | null {
  const t = layer.text;
  if (!t || typeof t.text !== 'string') return null;
  const style = t.style ?? {};
  const transform = t.transform ?? [1, 0, 0, 1, 0, 0];
  const scaleY = Math.abs(transform[3] || 1);
  const fontSize = Math.max(4, Math.round((style.fontSize ?? 72) * scaleY));

  const fc = style.fillColor as { r?: number; g?: number; b?: number } | undefined;
  const color = fc ? rgbToHex(fc.r ?? 0, fc.g ?? 0, fc.b ?? 0) : '#000000';

  const fontName = style.font?.name;
  const fontFamily = fontName ? `"${fontName.replace(/-/g, ' ')}"` : '"Manrope Variable", system-ui, sans-serif';
  const bold = !!style.fauxBold || /bold|black|heavy|semibold/i.test(fontName ?? '');

  const just = (t.paragraphStyle?.justification ?? '').toString().toLowerCase();
  const align: TitlerSlot['align'] = just.includes('center') ? 'center' : just.includes('right') ? 'right' : 'left';

  const label = layer.name || 'Text';
  const x = layer.left ?? Math.round(transform[4] ?? 0);
  const y = layer.top ?? Math.round((transform[5] ?? 0) - fontSize);
  const w = Math.max(0, (layer.right ?? x) - x);
  const h = Math.max(0, (layer.bottom ?? y) - y);

  return {
    key: uniqueKey(sanitizeKey(label)),
    label,
    x,
    y,
    w,
    h,
    fontFamily,
    fontSize,
    fontWeight: bold ? 700 : 400,
    color,
    align,
    lineHeight: 1.2,
    defaultText: autoMapVariable(label, t.text.replace(/\r/g, '\n')),
  };
}

/**
 * PSD in eine Vorlage überführen: Nicht-Text-Ebenen werden flach auf einen
 * Hintergrund-Canvas gerechnet, Text-Ebenen werden zu Slots. Gruppen werden
 * rekursiv behandelt; ausgeblendete Ebenen ignoriert.
 */
export function parsePsdToTemplate(bytes: Uint8Array): ParsedTemplate {
  const psd = readPsd(new Uint8Array(bytes).buffer, {
    skipThumbnail: true,
    skipLinkedFilesData: true,
    useImageData: false,
  });
  const width = psd.width;
  const height = psd.height;
  const background = document.createElement('canvas');
  background.width = width;
  background.height = height;
  const bgctx = background.getContext('2d');
  if (!bgctx) throw new Error('Canvas-Kontext nicht verfügbar');

  const slots: TitlerSlot[] = [];
  const used = new Set<string>();
  const uniqueKey = (base: string): string => {
    let k = base;
    let n = 2;
    while (used.has(k)) k = `${base}_${n++}`;
    used.add(k);
    return k;
  };

  let rasterDrawn = false;
  const walk = (layers: PsdLayer[] | undefined): void => {
    if (!layers) return;
    for (const layer of layers) {
      if (layer.hidden) continue;
      if (layer.children) {
        walk(layer.children);
        continue;
      }
      const slot = slotFromPsdText(layer, uniqueKey);
      if (slot) {
        slots.push(slot);
        continue;
      }
      if (layer.canvas) {
        bgctx.globalAlpha = layer.opacity ?? 1;
        bgctx.drawImage(layer.canvas, layer.left ?? 0, layer.top ?? 0);
        bgctx.globalAlpha = 1;
        rasterDrawn = true;
      }
    }
  };
  walk(psd.children);

  // Keine separierbaren Raster-Ebenen → auf das flache Composite zurückfallen.
  if (!rasterDrawn && psd.canvas) bgctx.drawImage(psd.canvas, 0, 0);

  return { width, height, background, slots };
}

/** .jmtitler-Bündel (ZIP: template.json + background.png) in eine Vorlage laden. */
export async function readTitlerBundle(bytes: Uint8Array): Promise<{ name: string; template: ParsedTemplate }> {
  const files = unzipSync(bytes);
  const jsonBytes = files['template.json'];
  const pngBytes = files['background.png'];
  if (!jsonBytes || !pngBytes) {
    throw new Error('Ungültiges .jmtitler-Bündel (template.json / background.png fehlt).');
  }
  const meta = JSON.parse(strFromU8(jsonBytes)) as {
    name?: string;
    width: number;
    height: number;
    slots: TitlerSlot[];
  };
  const bitmap = await createImageBitmap(new Blob([pngBytes as BlobPart], { type: 'image/png' }));
  const background = document.createElement('canvas');
  background.width = meta.width || bitmap.width;
  background.height = meta.height || bitmap.height;
  background.getContext('2d')?.drawImage(bitmap, 0, 0);
  bitmap.close();
  return {
    name: meta.name || 'Bauchbinde',
    template: { width: background.width, height: background.height, background, slots: meta.slots ?? [] },
  };
}

/** Import-Datei (per Dialog/Drop) nach Endung dispatchen. */
export async function importFileToTemplate(
  fileName: string,
  bytes: Uint8Array,
): Promise<{ name: string; template: ParsedTemplate }> {
  const lower = fileName.toLowerCase();
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'Bauchbinde';
  if (lower.endsWith('.jmtitler')) return readTitlerBundle(bytes);
  if (lower.endsWith('.psd')) return { name: baseName, template: parsePsdToTemplate(bytes) };
  throw new Error('Nicht unterstütztes Format — bitte .psd oder .jmtitler wählen.');
}

/** Canvas als PNG-Bytes kodieren (für die Library). */
export async function encodeCanvasPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('Bild konnte nicht kodiert werden');
  return new Uint8Array(await blob.arrayBuffer());
}

/** Verkleinertes Thumbnail-PNG (max. `maxW` breit) für die Library-Kacheln. */
export async function makeThumbPng(canvas: HTMLCanvasElement, maxW = 480): Promise<Uint8Array> {
  const scale = Math.min(1, maxW / canvas.width);
  const thumb = document.createElement('canvas');
  thumb.width = Math.max(1, Math.round(canvas.width * scale));
  thumb.height = Math.max(1, Math.round(canvas.height * scale));
  thumb.getContext('2d')?.drawImage(canvas, 0, 0, thumb.width, thumb.height);
  return encodeCanvasPng(thumb);
}
