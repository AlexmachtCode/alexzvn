import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
// Vite emits the worker as an asset and gives us its URL.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { getSource, putSource, removeSource } from './assets';
import { bytesToBlob } from './bytes';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const docCache = new Map<string, Promise<PDFDocumentProxy>>();
const imageCache = new Map<string, Promise<ImageBitmap>>();
// Rendered base pages keyed by source:page:width — avoids re-rasterising a PDF
// page on every unrelated edit (title/notes/overlay changes).
const baseCache = new Map<string, BaseRender>();
const BASE_CACHE_MAX = 64;

/** A rendered slide base = pixel canvas + the page's natural aspect ratio. */
export interface BaseRender {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  aspect: number; // width / height of the source page
}

function loadDoc(sourceId: string): Promise<PDFDocumentProxy> {
  const cached = docCache.get(sourceId);
  if (cached) return cached;
  const entry = getSource(sourceId);
  if (!entry || entry.kind !== 'pdf') {
    return Promise.reject(new Error(`No PDF source for ${sourceId}`));
  }
  // pdf.js transfers/detaches the buffer it is given, so hand it a copy.
  const task = pdfjsLib.getDocument({ data: entry.bytes.slice() }).promise;
  docCache.set(sourceId, task);
  return task;
}

function loadImage(sourceId: string): Promise<ImageBitmap> {
  const cached = imageCache.get(sourceId);
  if (cached) return cached;
  const entry = getSource(sourceId);
  if (!entry) return Promise.reject(new Error(`No image source for ${sourceId}`));
  const task = createImageBitmap(bytesToBlob(entry.bytes));
  imageCache.set(sourceId, task);
  return task;
}

/**
 * Number of pages in a freshly imported PDF (bytes are registered first). Kann pdf.js sie nicht
 * lesen (beschädigt, leer, kennwortgeschützt), bleibt nichts registriert und der Fehler geht weiter.
 */
export async function pdfPageCount(id: string, bytes: Uint8Array): Promise<number> {
  putSource(id, 'pdf', bytes);
  try {
    const doc = await loadDoc(id);
    return doc.numPages;
  } catch (err) {
    docCache.delete(id);
    removeSource(id);
    throw err;
  }
}

function newCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/**
 * Renders the base page of a slide (no overlays) to a canvas no wider than
 * `maxWidthPx`. Works for both PDF pages and single-image sources.
 */
export async function renderBase(
  sourceId: string,
  pageIndex: number,
  maxWidthPx: number,
): Promise<BaseRender> {
  const entry = getSource(sourceId);
  if (!entry) throw new Error(`Missing source ${sourceId}`);

  const key = `${sourceId}:${pageIndex}:${Math.round(maxWidthPx)}`;
  const hit = baseCache.get(key);
  if (hit) return hit;

  const result = await renderBaseUncached(entry.kind, sourceId, pageIndex, maxWidthPx);
  baseCache.set(key, result);
  if (baseCache.size > BASE_CACHE_MAX) {
    const oldest = baseCache.keys().next().value as string | undefined;
    if (oldest) baseCache.delete(oldest);
  }
  return result;
}

async function renderBaseUncached(
  kind: 'pdf' | 'image',
  sourceId: string,
  pageIndex: number,
  maxWidthPx: number,
): Promise<BaseRender> {
  if (kind === 'image') {
    const bitmap = await loadImage(sourceId);
    const aspect = bitmap.width / bitmap.height;
    const w = Math.min(maxWidthPx, bitmap.width);
    const h = w / aspect;
    const canvas = newCanvas(w, h);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return { canvas, width: canvas.width, height: canvas.height, aspect };
  }

  const doc = await loadDoc(sourceId);
  const page = await doc.getPage(pageIndex + 1);
  const base = page.getViewport({ scale: 1 });
  const aspect = base.width / base.height;
  const scale = Math.min(maxWidthPx / base.width, 4);
  const viewport = page.getViewport({ scale: Math.max(scale, 0.1) });
  const canvas = newCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { canvas, width: canvas.width, height: canvas.height, aspect };
}

/**
 * Drop cached docs/bitmaps (e.g. when loading a new project). `behalte` = Quellen, deren
 * Dokumente bleiben (beim Ersetzen die frisch gelesenen).
 */
export function clearPdfCaches(behalte?: ReadonlySet<string>): void {
  for (const [id, task] of [...docCache]) {
    if (behalte?.has(id)) continue;
    void task.then((doc) => doc.destroy()).catch(() => undefined);
    docCache.delete(id);
  }
  for (const [id, task] of [...imageCache]) {
    if (behalte?.has(id)) continue;
    void task.then((bmp) => bmp.close()).catch(() => undefined);
    imageCache.delete(id);
  }
  baseCache.clear();
}
