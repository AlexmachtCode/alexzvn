import { cn } from '@jm/ui';
import type { Overlay, Slide } from '@shared/types';
import { useProject } from '@/store/project';

export const labelCls = 'text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] font-bold';
export const inputCls =
  'w-full rounded-md bg-[var(--card)] border border-[var(--border)] px-2.5 py-1.5 text-sm ' +
  'outline-none focus:border-[var(--primary)]';

export function Inspector({ slide }: { slide: Slide }) {
  const setTitle = useProject((s) => s.setTitle);
  const setNotes = useProject((s) => s.setNotes);
  const addTextOverlay = useProject((s) => s.addTextOverlay);
  const addImageOverlay = useProject((s) => s.addImageOverlay);
  const selectedOverlayId = useProject((s) => s.selectedOverlayId);
  const overlay = slide.overlays.find((o) => o.id === selectedOverlayId) ?? null;

  return (
    <div className="h-full flex flex-col overflow-auto scroll-thin p-4 gap-4">
      <div className="space-y-1.5">
        <div className={labelCls}>Titel</div>
        <input
          className={inputCls}
          value={slide.title}
          onChange={(e) => setTitle(slide.id, e.target.value)}
          placeholder="Folientitel"
        />
      </div>

      <div className="space-y-1.5">
        <div className={labelCls}>Sprecher-Notizen</div>
        <textarea
          className={cn(inputCls, 'h-40 resize-none leading-relaxed')}
          value={slide.notes}
          onChange={(e) => setNotes(slide.id, e.target.value)}
          placeholder="Notizen für die Referentenansicht…"
        />
      </div>

      <div className="space-y-2">
        <div className={labelCls}>Overlays</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => addTextOverlay(slide.id)}
            className="flex-1 h-9 rounded-md bg-[var(--card)] border border-[var(--border)] text-sm font-semibold hover:bg-[var(--highlight)]"
          >
            + Text
          </button>
          <button
            type="button"
            onClick={() => void addImageOverlay(slide.id)}
            className="flex-1 h-9 rounded-md bg-[var(--card)] border border-[var(--border)] text-sm font-semibold hover:bg-[var(--highlight)]"
          >
            + Logo / Bild
          </button>
        </div>
      </div>

      {overlay && <OverlayInspector slide={slide} overlay={overlay} />}
    </div>
  );
}

function OverlayInspector({ slide, overlay }: { slide: Slide; overlay: Overlay }) {
  const update = useProject((s) => s.updateOverlay);
  const removeOverlay = useProject((s) => s.removeOverlay);
  const set = (patch: Partial<Overlay>) => update(slide.id, overlay.id, patch);

  return (
    <div className="rounded-lg border border-[var(--border)] p-3 space-y-3 bg-[var(--card)]/40">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">
          {overlay.kind === 'text' ? 'Text-Overlay' : 'Bild-Overlay'}
        </span>
        <button
          type="button"
          onClick={() => removeOverlay(slide.id, overlay.id)}
          className="text-xs text-[var(--destructive)] hover:underline"
        >
          Entfernen
        </button>
      </div>

      {overlay.kind === 'text' && (
        <>
          <textarea
            className={cn(inputCls, 'h-20 resize-none')}
            value={overlay.text ?? ''}
            onChange={(e) => set({ text: e.target.value })}
            placeholder="Text…"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className={labelCls}>Schriftgröße</span>
              <input
                type="range"
                min={2}
                max={20}
                step={0.5}
                value={(overlay.fontFrac ?? 0.06) * 100}
                onChange={(e) => set({ fontFrac: Number(e.target.value) / 100 })}
                className="w-full"
              />
            </label>
            <label className="space-y-1">
              <span className={labelCls}>Farbe</span>
              <input
                type="color"
                value={overlay.color ?? '#ffffff'}
                onChange={(e) => set({ color: e.target.value })}
                className="w-full h-8 rounded bg-transparent"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <SegBtn active={overlay.align === 'left'} onClick={() => set({ align: 'left' })}>
              Links
            </SegBtn>
            <SegBtn active={overlay.align === 'center'} onClick={() => set({ align: 'center' })}>
              Mitte
            </SegBtn>
            <SegBtn active={overlay.align === 'right'} onClick={() => set({ align: 'right' })}>
              Rechts
            </SegBtn>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!overlay.bold}
                onChange={(e) => set({ bold: e.target.checked })}
              />
              Fett
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={overlay.background != null}
                onChange={(e) => set({ background: e.target.checked ? 'rgba(10,10,12,0.72)' : null })}
              />
              Balken-Hintergrund
            </label>
          </div>
        </>
      )}

      <label className="space-y-1 block">
        <span className={labelCls}>Drehung ({Math.round(overlay.rotation)}°)</span>
        <input
          type="range"
          min={-45}
          max={45}
          step={1}
          value={overlay.rotation}
          onChange={(e) => set({ rotation: Number(e.target.value) })}
          className="w-full"
        />
      </label>
    </div>
  );
}

export function SegBtn({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 h-8 rounded-md text-xs font-semibold border',
        active
          ? 'bg-[var(--primary)] text-[var(--brand-dark)] border-[var(--primary)]'
          : 'bg-[var(--card)] border-[var(--border)] hover:bg-[var(--highlight)]',
      )}
    >
      {children}
    </button>
  );
}
