// ─────────────────────────────────────────────────────────────────────────────
// Drag & Drop: Zieh-Elemente und Ablageflächen.
//
// Anders als Rad, Quiz und Memory ist das kein isoliertes Widget — Elemente und
// Flächen müssen sich kennen. Deshalb eine Schicht über den bereits gerenderten
// Nodes der Szene.
//
// Auf einem Messe-Terminal entscheidend:
//   • Pointer-Events statt Mouse-Events, ein Drag-Zustand PRO pointerId → zwei
//     Besucher können gleichzeitig ziehen
//   • `touch-action: none` auf den Elementen, sonst scrollt der Browser die Seite
//     statt das Element zu bewegen
//   • Bildschirm-Deltas durch den Bühnen-Maßstab teilen, sonst läuft das Element
//     dem Finger davon
//
// „Alles abgelegt" ist bewusst KEIN eingebauter Trigger: das schreibt man als
// Zähler (`onDropped → abgelegt +1`) plus eine Szenen-Regel auf `onVarChange`.
// Dieselbe Regelliste, kein Sonderfall.
// ─────────────────────────────────────────────────────────────────────────────

import type { DragItemNode, DropZoneNode, NodeId } from '../model';
import type { TriggerType, VarValue } from '../logic';

export interface DragSource {
  node: DragItemNode;
  el: HTMLElement;
}

export interface DragTarget {
  node: DropZoneNode;
  el: HTMLElement;
}

export interface DragLayerOptions {
  items: DragSource[];
  zones: DragTarget[];
  /** Aktueller Maßstab der Bühne (Design-Pixel → Bildschirm-Pixel). */
  getScale: () => number;
  fire: (nodeId: NodeId, trigger: TriggerType, result?: VarValue) => void;
}

export interface DragLayer {
  reset(): void;
  destroy(): void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SLOT_GAP = 10;

function contains(r: Rect, px: number, py: number): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function createDragLayer(opts: DragLayerOptions): DragLayer {
  const { items, zones, getScale, fire } = opts;

  /** Aktuelle Position je Element, in Design-Pixeln. */
  const pos = new Map<NodeId, { x: number; y: number }>();
  /** Element → Fläche, in der es liegt. */
  const placed = new Map<NodeId, NodeId>();
  /** Korrekt abgelegt und festgestellt (`lockOnDrop`). */
  const locked = new Set<NodeId>();
  const drags = new Map<number, { item: DragSource; startX: number; startY: number; ox: number; oy: number }>();
  const cleanups: (() => void)[] = [];

  let zTop = 100;
  let destroyed = false;

  const zoneRect = (z: DragTarget): Rect => ({ x: z.node.x, y: z.node.y, w: z.node.w, h: z.node.h });
  const countIn = (zoneId: NodeId): number => {
    let n = 0;
    for (const id of placed.values()) if (id === zoneId) n++;
    return n;
  };

  function setPos(item: DragSource, x: number, y: number): void {
    pos.set(item.node.id, { x, y });
    item.el.style.left = `${x}px`;
    item.el.style.top = `${y}px`;
  }

  function goHome(item: DragSource): void {
    setPos(item, item.node.x, item.node.y);
  }

  /** Freier Platz in der Fläche — Elemente stapeln sich nicht übereinander. */
  function slotIn(zone: DragTarget, item: DragSource, index: number): { x: number; y: number } {
    const r = zoneRect(zone);
    const cols = Math.max(1, Math.floor((r.w - SLOT_GAP) / (item.node.w + SLOT_GAP)));
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      x: r.x + SLOT_GAP + col * (item.node.w + SLOT_GAP),
      y: r.y + SLOT_GAP + row * (item.node.h + SLOT_GAP),
    };
  }

  /** Oberste Fläche unter dem Mittelpunkt des Elements. */
  function zoneUnder(cx: number, cy: number): DragTarget | null {
    for (let i = zones.length - 1; i >= 0; i--) {
      if (contains(zoneRect(zones[i]), cx, cy)) return zones[i];
    }
    return null;
  }

  function finish(item: DragSource, pointerId: number): void {
    const d = drags.get(pointerId);
    if (!d) return;
    drags.delete(pointerId);
    item.el.style.zIndex = '';

    const p = pos.get(item.node.id) ?? { x: item.node.x, y: item.node.y };
    const cx = p.x + item.node.w / 2;
    const cy = p.y + item.node.h / 2;
    const zone = zoneUnder(cx, cy);

    if (!zone) {
      if (item.node.props.returnOnMiss) goHome(item);
      fire(item.node.id, 'onRejected', item.node.props.tag);
      return;
    }

    const accepts = zone.node.props.accepts.includes(item.node.props.tag);
    const full = zone.node.props.capacity > 0 && countIn(zone.node.id) >= zone.node.props.capacity;

    if (!accepts || full) {
      if (item.node.props.returnOnMiss) goHome(item);
      fire(item.node.id, 'onRejected', zone.node.name);
      fire(zone.node.id, 'onRejected', item.node.props.tag);
      return;
    }

    const index = countIn(zone.node.id);
    placed.set(item.node.id, zone.node.id);
    if (zone.node.props.snap) {
      const slot = slotIn(zone, item, index);
      setPos(item, slot.x, slot.y);
    }
    if (item.node.props.lockOnDrop) {
      locked.add(item.node.id);
      item.el.style.cursor = 'default';
    }
    fire(item.node.id, 'onDropped', zone.node.name);
    fire(zone.node.id, 'onDropped', item.node.props.tag);
  }

  for (const item of items) {
    goHome(item);
    item.el.style.touchAction = 'none';
    item.el.style.cursor = 'grab';

    const onDown = (e: PointerEvent): void => {
      if (destroyed || item.node.locked || locked.has(item.node.id)) return;
      e.preventDefault();
      e.stopPropagation();
      item.el.setPointerCapture(e.pointerId);
      const p = pos.get(item.node.id) ?? { x: item.node.x, y: item.node.y };
      drags.set(e.pointerId, { item, startX: e.clientX, startY: e.clientY, ox: p.x, oy: p.y });
      // Beim Herausziehen macht es den Platz in der Fläche wieder frei.
      placed.delete(item.node.id);
      item.el.style.zIndex = String(++zTop);
      item.el.style.cursor = 'grabbing';
    };

    const onMove = (e: PointerEvent): void => {
      const d = drags.get(e.pointerId);
      if (!d || d.item !== item) return;
      const s = getScale() || 1;
      setPos(item, d.ox + (e.clientX - d.startX) / s, d.oy + (e.clientY - d.startY) / s);
    };

    const onUp = (e: PointerEvent): void => {
      if (!drags.has(e.pointerId)) return;
      item.el.style.cursor = 'grab';
      finish(item, e.pointerId);
    };

    item.el.addEventListener('pointerdown', onDown);
    item.el.addEventListener('pointermove', onMove);
    item.el.addEventListener('pointerup', onUp);
    item.el.addEventListener('pointercancel', onUp);

    cleanups.push(() => {
      item.el.removeEventListener('pointerdown', onDown);
      item.el.removeEventListener('pointermove', onMove);
      item.el.removeEventListener('pointerup', onUp);
      item.el.removeEventListener('pointercancel', onUp);
    });
  }

  return {
    reset() {
      drags.clear();
      placed.clear();
      locked.clear();
      for (const item of items) {
        item.el.style.cursor = 'grab';
        goHome(item);
      }
    },
    destroy() {
      destroyed = true;
      drags.clear();
      for (const fn of cleanups) fn();
    },
  };
}
