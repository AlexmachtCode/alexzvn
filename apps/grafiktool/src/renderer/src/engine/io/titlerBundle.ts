import { zipSync, strToU8 } from 'fflate';
import type { RGBA } from '../types';
import type { Document } from '../doc/Document';
import { blendToGCO } from '../doc/BlendMode';
import { createCanvas } from '../canvas';
import { renderLayerToCanvas } from './layerRender';
import { encodeCanvas } from './exportRaster';

// „An JM Titler senden" (#162): eine Bauchbinde aus dem Grafiktool als schlankes
// `.jmtitler`-Bündel exportieren, das der Titler importiert (Hintergrund-PNG aus
// den Nicht-Text-Ebenen + Slot-JSON aus den Text-Ebenen). Nutzt das eigene
// Document/TextStyle-Modell — kein PSD-Re-Parse.

/** Slot-Form des Titlers (Wire-Format, muss mit @jm/titler TitlerSlot übereinstimmen). */
interface TitlerSlot {
  key: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  defaultText: string;
}

// Auto-Mapping Ebenenname → DataLink-Variable. MUSS mit der Tabelle in
// apps/titler/src/renderer/src/lib/psd-import.ts (VAR_MAP) übereinstimmen.
const VAR_MAP: { re: RegExp; placeholder: string }[] = [
  { re: /^(titel|title|name|sprecher|speaker)$/i, placeholder: '{{name}}' },
  { re: /^(untertitel|subtitle|funktion|function|rolle|role)$/i, placeholder: '{{subtitle}}' },
  { re: /^(ort|location|stadt|city)$/i, placeholder: '{{location}}' },
];

function autoMapVariable(layerName: string, literal: string): string {
  const trimmed = layerName.trim();
  for (const m of VAR_MAP) if (m.re.test(trimmed)) return m.placeholder;
  return literal;
}

function sanitizeKey(name: string): string {
  const k = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return k || 'slot';
}

function rgbaToHex(c: RGBA): string {
  const h = (n: number): string => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

/** Nicht-Text-Ebenen (Raster/Form) flach in einen Hintergrund-Canvas rechnen. */
function flattenNonText(doc: Document): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(doc.width, doc.height);
  for (const layer of doc.layers) {
    if (layer.kind === 'text') continue;
    if (!layer.visible || layer.opacity <= 0) continue;
    const baked = renderLayerToCanvas(layer, doc.width, doc.height); // Transform + Maske eingebacken
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = blendToGCO(layer.blendMode);
    ctx.drawImage(baked, 0, 0);
    ctx.restore();
  }
  return canvas;
}

/** Text-Ebenen → Slots (Position/Font/Farbe aus dem TextStyle; Auto-Mapping des Textes). */
function textSlots(doc: Document): TitlerSlot[] {
  const { ctx } = createCanvas(1, 1); // nur zum Messen der Textbreite
  const slots: TitlerSlot[] = [];
  const used = new Set<string>();
  const uniqueKey = (base: string): string => {
    let k = base;
    let n = 2;
    while (used.has(k)) k = `${base}_${n++}`;
    used.add(k);
    return k;
  };
  for (const layer of doc.layers) {
    if (layer.kind !== 'text' || !layer.visible) continue;
    const s = layer.style;
    ctx.font = `${s.fontWeight} ${s.fontSize}px ${s.fontFamily}`;
    const lines = s.text.split('\n');
    let maxW = 0;
    for (const line of lines) maxW = Math.max(maxW, ctx.measureText(line).width);
    const pad = s.padding;
    slots.push({
      key: uniqueKey(sanitizeKey(layer.name)),
      label: layer.name || 'Text',
      x: layer.offsetX + pad,
      y: layer.offsetY + pad,
      w: maxW,
      h: lines.length * s.fontSize * s.lineHeight,
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      color: rgbaToHex(s.color),
      align: s.align,
      lineHeight: s.lineHeight,
      defaultText: autoMapVariable(layer.name, s.text),
    });
  }
  return slots;
}

/** Kleines Thumbnail (max. `maxW` breit). */
async function thumbBytes(bg: HTMLCanvasElement, maxW = 480): Promise<Uint8Array> {
  const scale = Math.min(1, maxW / bg.width);
  const { canvas, ctx } = createCanvas(Math.max(1, Math.round(bg.width * scale)), Math.max(1, Math.round(bg.height * scale)));
  ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
  return encodeCanvas(canvas, 'png');
}

/**
 * Dokument als `.jmtitler`-Bündel (ZIP) serialisieren: template.json (Metadaten +
 * Slots) + background.png (flache Nicht-Text-Ebenen) + thumb.png.
 */
export async function docToTitlerBundle(doc: Document, name = 'Bauchbinde'): Promise<Uint8Array> {
  const bg = flattenNonText(doc);
  const slots = textSlots(doc);
  const [pngBytes, thumb] = await Promise.all([encodeCanvas(bg, 'png'), thumbBytes(bg)]);
  const files: Record<string, Uint8Array> = {
    'template.json': strToU8(
      JSON.stringify({ schemaVersion: 1, name, width: doc.width, height: doc.height, slots }),
    ),
    'background.png': pngBytes,
    'thumb.png': thumb,
  };
  return zipSync(files, { level: 6 });
}
