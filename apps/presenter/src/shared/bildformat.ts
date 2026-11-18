// #313: reine SVG-Hilfen. Wird im Renderer gebündelt: keine Node-/Electron-Importe.
//
// Chromium erkennt PNG, JPEG, WebP, GIF, BMP und AVIF selbst am Inhalt (createImageBitmap auf
// einem Blob ohne Typ) – SVG nicht. Der Renderer rastert SVG darum selbst
// (`renderer/src/lib/bild-dekodieren.ts`) und braucht dafür: ist es SVG, und in welcher Größe?

/** Ohne diesen Typ zeigt Chromium ein SVG in `<img>` nicht an (SVG wird nie am Inhalt erschnüffelt). */
export const SVG_MIME = 'image/svg+xml';

/** Größter Rahmen, in den ein SVG gerastert wird (Vektor → auf dem 4K-Ausgang scharf). */
export const SVG_RASTER_MAX_BREITE = 3840;
export const SVG_RASTER_MAX_HOEHE = 2160;

/** So viel vom Dateianfang entscheidet, ob es SVG ist. */
const ERKENNEN_BYTES = 4096;
/** So viel vom Dateianfang wird nach dem öffnenden <svg …>-Tag durchsucht (lange Namensraum-Listen). */
const GROESSE_BYTES = 65536;

function anfangAlsText(bytes: Uint8Array, n: number): string {
  // TextDecoder entfernt ein UTF-8-BOM selbst; kaputte Folgen werden zu U+FFFD statt zu werfen.
  return new TextDecoder('utf-8').decode(bytes.subarray(0, n));
}

/**
 * Stelle des Wurzelelements `<svg` im Text, nach Leerraum, XML-Kopf, Kommentaren und DOCTYPE;
 * -1, wenn dort etwas anderes steht (z. B. `<html>`) oder der Vorspann im Text nicht endet.
 */
function wurzelStart(text: string): number {
  let i = 0;
  for (;;) {
    while (i < text.length && /\s|﻿/.test(text[i])) i++;
    if (text.startsWith('<?', i)) {
      const e = text.indexOf('?>', i + 2);
      if (e < 0) return -1;
      i = e + 2;
    } else if (text.startsWith('<!--', i)) {
      const e = text.indexOf('-->', i + 4);
      if (e < 0) return -1;
      i = e + 3;
    } else if (text.slice(i, i + 9).toUpperCase() === '<!DOCTYPE') {
      const ende = text.indexOf('>', i);
      const klammer = text.indexOf('[', i);
      if (klammer >= 0 && (ende < 0 || klammer < ende)) {
        const e = text.indexOf(']>', klammer);
        if (e < 0) return -1;
        i = e + 2;
      } else {
        if (ende < 0) return -1;
        i = ende + 1;
      }
    } else {
      break;
    }
  }
  return /^<svg[\s/>]/i.test(text.slice(i, i + 5)) ? i : -1;
}

/** Ist das eine SVG-Datei? Entschieden am Inhalt der ersten 4 KiB, nicht an der Endung. */
export function istSvg(bytes: Uint8Array): boolean {
  return wurzelStart(anfangAlsText(bytes, ERKENNEN_BYTES)) >= 0;
}

/** Attribute des öffnenden Wurzel-Tags (Namen klein); null ohne Wurzelelement. */
function wurzelAttribute(text: string): Map<string, string> | null {
  const start = wurzelStart(text);
  if (start < 0) return null;
  // Tag-Ende: erstes `>` außerhalb von Anführungszeichen.
  let ende = text.length;
  let quote: string | null = null;
  for (let i = start + 4; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '>') {
      ende = i;
      break;
    }
  }
  const tag = text.slice(start + 4, ende);
  const attr = new Map<string, string>();
  for (const m of tag.matchAll(/([^\s=/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attr.set(m[1].toLowerCase(), m[2] ?? m[3] ?? '');
  }
  return attr;
}

/** Länge in Benutzereinheiten: nur reine Zahl oder `px`, > 0; alles andere (%, em, …) zählt nicht. */
function laenge(wert: string | undefined): number | null {
  if (wert === undefined) return null;
  const m = /^\s*([+]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(?:px)?\s*$/i.exec(wert);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Seitenverhältnis (Breite / Höhe) des SVG aus dem Text des Dateianfangs: aus `width`/`height` des
 * Wurzelelements (Zahl oder `px`), sonst aus `viewBox`; null, wenn beides nichts Verwertbares hat.
 */
export function svgSeitenverhaeltnis(text: string): number | null {
  const attr = wurzelAttribute(text);
  if (!attr) return null;
  const w = laenge(attr.get('width'));
  const h = laenge(attr.get('height'));
  if (w !== null && h !== null) return w / h;
  const vb = attr.get('viewbox');
  if (vb === undefined) return null;
  const teile = vb.trim().split(/[\s,]+/).map(Number);
  if (teile.length !== 4 || !teile.every(Number.isFinite)) return null;
  const [, , vw, vh] = teile;
  return vw > 0 && vh > 0 ? vw / vh : null;
}

/**
 * Rastergröße für ein SVG: in 3840×2160 eingepasst, Seitenverhältnis bleibt; ohne verwertbare
 * Größe 16:9 (also 3840×2160). Jede Seite mindestens 1 px.
 */
export function svgRasterGroesse(bytes: Uint8Array): { breite: number; hoehe: number } {
  const v = svgSeitenverhaeltnis(anfangAlsText(bytes, GROESSE_BYTES)) ?? SVG_RASTER_MAX_BREITE / SVG_RASTER_MAX_HOEHE;
  if (v >= SVG_RASTER_MAX_BREITE / SVG_RASTER_MAX_HOEHE) {
    return { breite: SVG_RASTER_MAX_BREITE, hoehe: Math.max(1, Math.round(SVG_RASTER_MAX_BREITE / v)) };
  }
  return { breite: Math.max(1, Math.round(SVG_RASTER_MAX_HOEHE * v)), hoehe: SVG_RASTER_MAX_HOEHE };
}
