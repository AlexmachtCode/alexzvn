// ─────────────────────────────────────────────────────────────────────────────
// Editor-Bühne: rendert die Nodes als DOM und legt ein Auswahl-Overlay darüber.
//
// Verschieben/Skalieren laufen über Pointer-Events (nicht Mouse-Events) — dieselbe
// Entscheidung wie im Rest der Suite und Voraussetzung dafür, dass der Editor auf
// einem Touch-Gerät bedienbar bleibt.
//
// Die Bühne ist bewusst NICHT der Player: hier soll man unsichtbare Elemente sehen,
// nichts anklicken-was-Regeln-feuert und exakt platzieren können. Gespielt wird in
// der Sandbox nebenan.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AppNode } from '@jm/appkit';
import { useAssetUrls } from '../lib/assetUrls';
import { snapRect, snapToGrid, type Guide } from '../lib/snap';
import { useCurrentScene, useEditor } from '../store';

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const HANDLE_CURSOR: Record<Handle, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

const MIN_SIZE = 16;

/** Einrast-Abstand in BILDSCHIRM-Pixeln — bei 30 % Zoom wären 6 Design-Pixel unerreichbar. */
const SNAP_TOLERANCE_SCREEN = 8;

interface Drag {
  kind: 'move' | Handle;
  startX: number;
  startY: number;
  node: { x: number; y: number; w: number; h: number };
}

/** Vorschau eines Nodes im Editor. Bewusst simpel — die Wahrheit steht im Player. */
function NodePreview({ node, assetUrls }: { node: AppNode; assetUrls: Map<string, string> }): JSX.Element {
  switch (node.type) {
    case 'text':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              node.props.align === 'left' ? 'flex-start' : node.props.align === 'right' ? 'flex-end' : 'center',
            fontSize: node.props.fontSize,
            color: node.props.color,
            fontWeight: node.props.weight,
            lineHeight: node.props.lineHeight,
            textAlign: node.props.align,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {node.props.bindTextTo ? `{${node.props.bindTextTo}}` : node.props.text}
        </div>
      );
    case 'shape':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: node.props.fill,
            borderRadius: node.props.kind === 'ellipse' ? '50%' : node.props.radius,
            border: node.props.strokeWidth > 0 ? `${node.props.strokeWidth}px solid ${node.props.stroke}` : undefined,
          }}
        />
      );
    case 'button':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: node.props.bg,
            color: node.props.color,
            borderRadius: node.props.radius,
            fontSize: node.props.fontSize,
            fontWeight: 600,
          }}
        >
          {node.props.label}
        </div>
      );
    case 'image': {
      const url = node.props.assetId ? assetUrls.get(node.props.assetId) : null;
      if (!url) {
        return (
          <div className="flex h-full w-full items-center justify-center border-2 border-dashed border-white/20 bg-white/5 text-sm text-white/40">
            Kein Bild
          </div>
        );
      }
      return (
        <img
          src={url}
          alt={node.name}
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: node.props.fit, borderRadius: node.props.radius }}
        />
      );
    }
    case 'video':
      return (
        <div className="flex h-full w-full items-center justify-center bg-black text-sm text-white/50">
          ▶ {node.name}
        </div>
      );
    case 'wheel': {
      const segs = node.props.segments.filter((s) => s.weight > 0);
      const total = segs.reduce((a, s) => a + s.weight, 0) || 1;
      let acc = 0;
      const stops = segs
        .map((s) => {
          const from = (acc / total) * 360;
          acc += s.weight;
          const to = (acc / total) * 360;
          return `${s.color} ${from}deg ${to}deg`;
        })
        .join(', ');
      return (
        <div
          className="relative h-full w-full rounded-full"
          style={{ background: segs.length ? `conic-gradient(${stops})` : '#333' }}
        >
          <div className="absolute left-1/2 top-1/2 h-[12%] w-[12%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
        </div>
      );
    }

    case 'quiz': {
      const q = node.props.questions[0];
      return (
        <div className="flex h-full w-full flex-col gap-[4%] overflow-hidden">
          <div
            style={{ fontSize: node.props.questionFontSize, color: node.props.textColor, fontWeight: 700 }}
            className="flex shrink-0 items-center justify-center text-center"
          >
            {q?.text ?? 'Ohne Frage'}
          </div>
          <div
            className="grid shrink-0 gap-[2%]"
            style={{ gridTemplateColumns: (q?.answers.length ?? 0) <= 2 ? '1fr' : '1fr 1fr' }}
          >
            {(q?.answers ?? []).map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-center px-[3%] py-[2.5%]"
                style={{
                  background: a.correct ? node.props.correctColor : node.props.answerColor,
                  color: node.props.textColor,
                  fontSize: node.props.answerFontSize,
                  borderRadius: node.props.answerFontSize / 3,
                  fontWeight: 600,
                }}
              >
                {a.text}
              </div>
            ))}
          </div>
          {node.props.questions.length > 1 && (
            <div className="shrink-0 text-center opacity-50" style={{ fontSize: node.props.answerFontSize * 0.6 }}>
              +{node.props.questions.length - 1} weitere Fragen
            </div>
          )}
        </div>
      );
    }

    case 'memory': {
      // Im Editor unmischt und aufgedeckt — sonst kann man die Paare nicht prüfen.
      const cards = node.props.pairs.flatMap((p) => {
        const own = !!(p.matchLabel || p.matchAssetId);
        return [
          { key: `${p.id}a`, label: p.label, assetId: p.assetId },
          { key: `${p.id}b`, label: own ? p.matchLabel : p.label, assetId: own ? p.matchAssetId : p.assetId },
        ];
      });
      return (
        <div
          className="grid h-full w-full"
          style={{
            gridTemplateColumns: `repeat(${Math.max(1, node.props.columns)}, 1fr)`,
            gridAutoRows: '1fr',
            gap: node.props.gap,
          }}
        >
          {cards.map((c) => {
            const url = c.assetId ? assetUrls.get(c.assetId) : null;
            return (
              <div
                key={c.key}
                className="flex items-center justify-center overflow-hidden p-[4%]"
                style={{
                  background: node.props.faceColor,
                  color: node.props.textColor,
                  borderRadius: node.props.radius,
                  fontSize: node.props.fontSize,
                  fontWeight: 700,
                }}
              >
                {url ? (
                  <img src={url} alt={c.label} draggable={false} className="max-h-full max-w-full object-contain" />
                ) : (
                  c.label
                )}
              </div>
            );
          })}
        </div>
      );
    }

    case 'dragitem': {
      const url = node.props.assetId ? assetUrls.get(node.props.assetId) : null;
      return (
        <div
          className="flex h-full w-full items-center justify-center overflow-hidden"
          style={{
            background: node.props.bg,
            color: node.props.color,
            borderRadius: node.props.radius,
            fontSize: node.props.fontSize,
            fontWeight: 600,
          }}
        >
          {url ? (
            <img src={url} alt={node.props.label} draggable={false} className="max-h-full max-w-full object-contain" />
          ) : (
            node.props.label
          )}
        </div>
      );
    }

    case 'dropzone':
      return (
        <div
          className="flex h-full w-full items-start justify-center p-2"
          style={{
            background: node.props.bg,
            border: `2px dashed ${node.props.borderColor}`,
            borderRadius: node.props.radius,
            color: node.props.color,
            fontSize: node.props.fontSize,
          }}
        >
          <span className="opacity-70">{node.props.label}</span>
        </div>
      );
  }
}

export function CanvasStage(): JSX.Element {
  const doc = useEditor((s) => s.doc);
  const scene = useCurrentScene();
  const selectedId = useEditor((s) => s.selectedId);
  const select = useEditor((s) => s.select);
  const patchNode = useEditor((s) => s.patchNode);

  const snapOn = useEditor((s) => s.snap);
  const grid = useEditor((s) => s.grid);
  const showGrid = useEditor((s) => s.showGrid);
  const setSnap = useEditor((s) => s.setSnap);
  const setGrid = useEditor((s) => s.setGrid);
  const setShowGrid = useEditor((s) => s.setShowGrid);

  const assetUrls = useAssetUrls();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [guides, setGuides] = useState<Guide[]>([]);
  const dragRef = useRef<Drag | null>(null);

  // Bühne einpassen. ResizeObserver statt window.resize: der Editor-Split ändert
  // die Breite, ohne dass das Fenster sich ändert.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = (): void => {
      const pad = 48;
      const sx = (el.clientWidth - pad) / doc.canvas.width;
      const sy = (el.clientHeight - pad) / doc.canvas.height;
      setScale(Math.max(0.05, Math.min(sx, sy)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc.canvas.width, doc.canvas.height]);

  const selected = scene.nodes.find((n) => n.id === selectedId) ?? null;

  const onPointerDown = (e: React.PointerEvent, node: AppNode, kind: Drag['kind']): void => {
    if (node.locked) return;
    e.stopPropagation();
    e.preventDefault();
    select(node.id);
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind,
      startX: e.clientX,
      startY: e.clientY,
      node: { x: node.x, y: node.y, w: node.w, h: node.h },
    };
  };

  const onPointerMove = (e: React.PointerEvent): void => {
    const d = dragRef.current;
    if (!d || !selected) return;
    // Bildschirm-Delta in Design-Pixel umrechnen: die Bühne ist skaliert.
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    const s = d.node;
    // Alt gedrückt = frei positionieren, wie in jedem Design-Werkzeug.
    const useSnap = snapOn && !e.altKey;

    if (d.kind === 'move') {
      const raw = { x: s.x + dx, y: s.y + dy, w: s.w, h: s.h };
      if (!useSnap) {
        setGuides([]);
        patchNode(selected.id, { x: Math.round(raw.x), y: Math.round(raw.y) });
        return;
      }
      const others = scene.nodes.filter((n) => n.id !== selected.id).map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h }));
      const r = snapRect(raw, {
        grid,
        tolerance: SNAP_TOLERANCE_SCREEN / scale,
        canvas: doc.canvas,
        others,
      });
      setGuides(r.guides);
      patchNode(selected.id, { x: Math.round(r.x), y: Math.round(r.y) });
      return;
    }

    let { x, y, w, h } = s;
    if (d.kind.includes('w')) {
      const nw = Math.max(MIN_SIZE, s.w - dx);
      x = s.x + (s.w - nw);
      w = nw;
    }
    if (d.kind.includes('e')) w = Math.max(MIN_SIZE, s.w + dx);
    if (d.kind.includes('n')) {
      const nh = Math.max(MIN_SIZE, s.h - dy);
      y = s.y + (s.h - nh);
      h = nh;
    }
    if (d.kind.includes('s')) h = Math.max(MIN_SIZE, s.h + dy);

    // Beim Skalieren gibt es keine sinnvolle Mitte-an-Mitte-Ausrichtung: nur Raster.
    const g = useSnap ? grid : 0;
    patchNode(selected.id, {
      x: Math.round(snapToGrid(x, g)),
      y: Math.round(snapToGrid(y, g)),
      w: Math.max(MIN_SIZE, Math.round(snapToGrid(w, g))),
      h: Math.max(MIN_SIZE, Math.round(snapToGrid(h, g))),
    });
  };

  const endDrag = (e: React.PointerEvent): void => {
    if (dragRef.current) {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      dragRef.current = null;
      setGuides([]);
    }
  };

  // Entf löscht das ausgewählte Element.
  const removeNode = useEditor((s) => s.removeNode);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        removeNode(selectedId);
      }
      if (e.key === 'Escape') select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, removeNode, select]);

  return (
    <div
      ref={wrapRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#0b0b0b]"
      onPointerDown={() => select(null)}
    >
      <div
        className="relative shadow-2xl"
        style={{
          width: doc.canvas.width,
          height: doc.canvas.height,
          transform: `scale(${scale})`,
          background: scene.background,
          flex: 'none',
        }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {showGrid && grid > 0 && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,.07) 1px, transparent 1px),' +
                'linear-gradient(to bottom, rgba(255,255,255,.07) 1px, transparent 1px)',
              backgroundSize: `${grid}px ${grid}px`,
            }}
          />
        )}

        {scene.nodes.map((n) => (
          <div
            key={n.id}
            data-node={n.id}
            onPointerDown={(e) => onPointerDown(e, n, 'move')}
            style={{
              position: 'absolute',
              left: n.x,
              top: n.y,
              width: n.w,
              height: n.h,
              transform: `rotate(${n.rotation}deg)`,
              // Unsichtbare Elemente bleiben im Editor sichtbar (blass), sonst
              // kann man sie nicht mehr auswählen, um sie wieder einzublenden.
              opacity: n.visible ? n.opacity : n.opacity * 0.25,
              cursor: n.locked ? 'default' : 'move',
              outline: n.id === selectedId ? '2px solid var(--brand-yellow, #fbe73b)' : undefined,
              outlineOffset: 2,
            }}
          >
            <NodePreview node={n} assetUrls={assetUrls} />
          </div>
        ))}

        {selected && !selected.locked && (
          <div
            style={{
              position: 'absolute',
              left: selected.x,
              top: selected.y,
              width: selected.w,
              height: selected.h,
              transform: `rotate(${selected.rotation}deg)`,
              pointerEvents: 'none',
            }}
          >
            {HANDLES.map((h) => {
              const size = 10 / scale;
              const pos: Record<string, number | string> = { position: 'absolute' };
              if (h.includes('n')) pos['top'] = -size / 2;
              if (h.includes('s')) pos['bottom'] = -size / 2;
              if (h.includes('w')) pos['left'] = -size / 2;
              if (h.includes('e')) pos['right'] = -size / 2;
              if (h === 'n' || h === 's') {
                pos['left'] = '50%';
                pos['marginLeft'] = -size / 2;
              }
              if (h === 'e' || h === 'w') {
                pos['top'] = '50%';
                pos['marginTop'] = -size / 2;
              }
              return (
                <div
                  key={h}
                  onPointerDown={(e) => onPointerDown(e, selected, h)}
                  style={{
                    ...pos,
                    width: size,
                    height: size,
                    background: '#fbe73b',
                    border: `${1 / scale}px solid #000`,
                    cursor: HANDLE_CURSOR[h],
                    pointerEvents: 'auto',
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Hilfslinien: zeigen, WORAN eingerastet wurde. */}
        {guides.map((g, i) => (
          <div
            key={`${g.axis}-${g.at}-${i}`}
            className="pointer-events-none absolute bg-[#fbe73b]"
            style={
              g.axis === 'x'
                ? { left: g.at, top: 0, width: 1 / scale, height: '100%' }
                : { top: g.at, left: 0, height: 1 / scale, width: '100%' }
            }
          />
        ))}
      </div>

      <div className="pointer-events-none absolute bottom-2 left-3 flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
        <label className="pointer-events-auto flex cursor-pointer items-center gap-1">
          <input type="checkbox" checked={snapOn} onChange={(e) => setSnap(e.target.checked)} />
          Einrasten
        </label>
        <label className="pointer-events-auto flex cursor-pointer items-center gap-1">
          <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
          Raster
        </label>
        <label className="pointer-events-auto flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={200}
            value={grid}
            onChange={(e) => setGrid(Number(e.target.value))}
            className="w-14 rounded border border-[var(--border)] bg-transparent px-1 py-0.5"
          />
          px
        </label>
        <span className="opacity-60">Alt = frei</span>
      </div>

      <div className="pointer-events-none absolute bottom-2 right-3 text-xs text-[var(--muted-foreground)]">
        {doc.canvas.width}×{doc.canvas.height} · {Math.round(scale * 100)}%
      </div>
    </div>
  );
}
