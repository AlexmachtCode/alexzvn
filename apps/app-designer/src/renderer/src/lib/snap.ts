// ─────────────────────────────────────────────────────────────────────────────
// Einrasten beim Verschieben.
//
// Zwei Stufen, in dieser Reihenfolge:
//   1. Ausrichten an Kanten und Mitten der Nachbarn sowie an der Bühne. Trifft es,
//      entsteht eine Hilfslinie — der Autor sieht, WORAN es eingerastet ist.
//   2. Sonst aufs Raster runden.
//
// Ohne (1) landet man mit reinem Raster-Snap zwar auf runden Zahlen, aber nie
// bündig an einem Nachbarn, dessen Größe kein Vielfaches des Rasters ist.
// ─────────────────────────────────────────────────────────────────────────────

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Eine Hilfslinie in Design-Koordinaten. `axis: 'x'` = senkrechte Linie. */
export interface Guide {
  axis: 'x' | 'y';
  at: number;
}

export interface SnapOptions {
  /** Rasterweite in Design-Pixeln. 0 = kein Raster. */
  grid: number;
  /** Abstand, ab dem eingerastet wird (Design-Pixel). */
  tolerance: number;
  canvas: { width: number; height: number };
  /** Alle anderen Elemente der Szene. */
  others: Rect[];
}

export interface SnapResult {
  x: number;
  y: number;
  guides: Guide[];
}

/** Kandidaten-Linien einer Achse: Kanten und Mitte jedes Nachbarn plus die Bühne. */
function candidates(axis: 'x' | 'y', opts: SnapOptions): number[] {
  const size = axis === 'x' ? opts.canvas.width : opts.canvas.height;
  const lines = [0, size / 2, size];
  for (const o of opts.others) {
    const start = axis === 'x' ? o.x : o.y;
    const extent = axis === 'x' ? o.w : o.h;
    lines.push(start, start + extent / 2, start + extent);
  }
  return lines;
}

/**
 * Sucht für eine Achse den besten Treffer. Geprüft werden die drei Bezugspunkte
 * des bewegten Elements (Anfang, Mitte, Ende) gegen alle Kandidatenlinien.
 */
function snapAxis(
  start: number,
  extent: number,
  axis: 'x' | 'y',
  opts: SnapOptions,
): { value: number; guide: Guide | null } {
  const points = [start, start + extent / 2, start + extent];
  const offsets = [0, extent / 2, extent];

  let best: { delta: number; line: number } | null = null;
  for (const line of candidates(axis, opts)) {
    for (let i = 0; i < points.length; i++) {
      const delta = line - points[i];
      if (Math.abs(delta) > opts.tolerance) continue;
      if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { delta, line };
    }
  }
  if (best) return { value: start + best.delta, guide: { axis, at: best.line } };

  if (opts.grid > 0) return { value: Math.round(start / opts.grid) * opts.grid, guide: null };
  return { value: start, guide: null };
}

/** Rastet die Position eines Rechtecks ein und meldet die getroffenen Hilfslinien. */
export function snapRect(rect: Rect, opts: SnapOptions): SnapResult {
  const sx = snapAxis(rect.x, rect.w, 'x', opts);
  const sy = snapAxis(rect.y, rect.h, 'y', opts);
  const guides: Guide[] = [];
  if (sx.guide) guides.push(sx.guide);
  if (sy.guide) guides.push(sy.guide);
  return { x: sx.value, y: sy.value, guides };
}

/** Beim Skalieren gibt es keine sinnvolle Mitte-an-Mitte-Ausrichtung: nur Raster. */
export function snapToGrid(value: number, grid: number): number {
  return grid > 0 ? Math.round(value / grid) * grid : value;
}
