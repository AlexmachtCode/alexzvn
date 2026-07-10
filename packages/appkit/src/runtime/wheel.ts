// ─────────────────────────────────────────────────────────────────────────────
// Glücksrad als SVG.
//
// Bewusst kein Canvas: Ein exportiertes Bundle läuft von `file://`, und Canvas mit
// geladenen Bildern wäre dort „tainted" (getImageData verboten). SVG bleibt zudem
// bei jeder Terminal-Auflösung scharf und kostet keine Render-Schleife.
//
// Sektorgröße ist proportional zum Gewicht — die Ziehung zieht anschließend einen
// uniformen Winkel. Damit ist die Chance genau das, was der Autor sieht; ein
// „gewichtetes" Rad mit gleich großen Feldern wäre eine Lüge auf dem Messestand.
// ─────────────────────────────────────────────────────────────────────────────

import type { WheelNode, WheelSegment } from '../model';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Der Zeiger sitzt oben; in SVG-Winkeln (0° = 3 Uhr, im Uhrzeigersinn) ist das 270°. */
const POINTER_ANGLE = 270;

interface Slice {
  seg: WheelSegment;
  from: number;
  to: number;
}

/** Sektorgrenzen in Grad, beginnend bei 0°. Segmente mit weight<=0 entfallen. */
export function sliceSegments(segments: WheelSegment[]): Slice[] {
  const usable = segments.filter((s) => s.weight > 0);
  const total = usable.reduce((a, s) => a + s.weight, 0);
  if (!usable.length || total <= 0) return [];
  const out: Slice[] = [];
  let acc = 0;
  for (const seg of usable) {
    const span = (seg.weight / total) * 360;
    out.push({ seg, from: acc, to: acc + span });
    acc += span;
  }
  // Rundungsdrift auf exakt 360 ziehen, damit kein Haarriss bleibt.
  if (out.length) out[out.length - 1].to = 360;
  return out;
}

function mod360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Segment, das nach Rotation `rot` unter dem Zeiger liegt. */
export function segmentAt(slices: Slice[], rot: number): WheelSegment | null {
  if (!slices.length) return null;
  const a = mod360(POINTER_ANGLE - rot);
  for (const s of slices) if (a >= s.from && a < s.to) return s.seg;
  return slices[slices.length - 1].seg;
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function sectorPath(cx: number, cy: number, r: number, from: number, to: number): string {
  // Ein Vollkreis lässt sich nicht als Bogen zeichnen (Start == Ende) → Kreis.
  if (to - from >= 359.999) {
    return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`;
  }
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

export interface WheelView {
  el: HTMLElement;
  /**
   * Dreht das Rad und meldet das Ergebnis, wenn es steht. Ein laufender Spin
   * wird ignoriert (Doppel-Tipp auf dem Terminal darf nicht neu würfeln).
   */
  spin(onStop: (value: string, seg: WheelSegment) => void): void;
  destroy(): void;
}

export function createWheel(node: WheelNode): WheelView {
  const { segments, turns, textColor } = node.props;
  const slices = sliceSegments(segments);

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:100%;height:100%;';

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;transform-origin:50% 50%;';

  for (const s of slices) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', sectorPath(50, 50, 49, s.from, s.to));
    path.setAttribute('fill', s.seg.color);
    svg.appendChild(path);

    const mid = (s.from + s.to) / 2;
    const [tx, ty] = polar(50, 50, 32, mid);
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', String(tx));
    label.setAttribute('y', String(ty));
    label.setAttribute('fill', textColor);
    label.setAttribute('font-size', '5');
    label.setAttribute('font-weight', '700');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('transform', `rotate(${mid} ${tx} ${ty})`);
    label.textContent = s.seg.label;
    svg.appendChild(label);
  }

  const hub = document.createElementNS(SVG_NS, 'circle');
  hub.setAttribute('cx', '50');
  hub.setAttribute('cy', '50');
  hub.setAttribute('r', '6');
  hub.setAttribute('fill', '#ffffff');
  svg.appendChild(hub);

  // Zeiger liegt außerhalb der rotierenden Gruppe. Als SVG-Polygon statt
  // CSS-Border-Dreieck: border-width kennt keine Prozente, ein px-Dreieck würde
  // beim Skalieren der Bühne nicht mitwachsen.
  const overlay = document.createElementNS(SVG_NS, 'svg');
  overlay.setAttribute('viewBox', '0 0 100 100');
  overlay.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
  const pointer = document.createElementNS(SVG_NS, 'polygon');
  pointer.setAttribute('points', '44,1 56,1 50,13');
  pointer.setAttribute('fill', '#ffffff');
  pointer.setAttribute('stroke', 'rgba(0,0,0,.35)');
  pointer.setAttribute('stroke-width', '0.6');
  overlay.appendChild(pointer);

  wrap.append(svg, overlay);

  let rotation = 0;
  let spinning = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    el: wrap,
    spin(onStop) {
      if (spinning || !slices.length) return;
      spinning = true;

      // Uniformer Zielwinkel → das Segment ergibt sich aus der sichtbaren Größe.
      const target = Math.random() * 360;
      // Immer vorwärts drehen: mindestens `turns` volle Umdrehungen auf die
      // aktuelle Rotation, dann bis der Zielwinkel unter dem Zeiger steht.
      const base = rotation + turns * 360;
      rotation = base + mod360(POINTER_ANGLE - target - base);

      svg.style.transition = `transform ${node.props.spinMs}ms cubic-bezier(.15,.9,.25,1)`;
      svg.style.transform = `rotate(${rotation}deg)`;

      timer = setTimeout(() => {
        spinning = false;
        timer = null;
        const seg = segmentAt(slices, rotation);
        if (seg) onStop(seg.value || seg.label, seg);
      }, node.props.spinMs);
    },
    destroy() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
