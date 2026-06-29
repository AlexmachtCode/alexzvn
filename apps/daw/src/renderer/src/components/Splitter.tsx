import { useCallback } from 'react';
import { cn } from '@jm/ui';

/**
 * Schlanker Resize-Griff zwischen zwei Panels (#95). `orientation:'v'` ist ein
 * vertikaler Trenner (horizontales Resize, Spalten); `'h'` ein horizontaler
 * Trenner (vertikales Resize, Zeilen). `onDelta` bekommt die Mausbewegung in px
 * auf der jeweiligen Achse; der Aufrufer rechnet das aufs Panel um (Vorzeichen).
 */
export function Splitter({
  orientation,
  onDelta,
  title,
}: {
  orientation: 'v' | 'h';
  onDelta: (delta: number) => void;
  title?: string;
}): React.JSX.Element {
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const axis = orientation === 'v' ? 'clientX' : 'clientY';
      let last = e[axis];
      const prevCursor = document.body.style.cursor;
      const prevSelect = document.body.style.userSelect;
      document.body.style.cursor = orientation === 'v' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
      const move = (ev: PointerEvent): void => {
        const cur = ev[axis];
        if (cur !== last) {
          onDelta(cur - last);
          last = cur;
        }
      };
      const up = (): void => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = prevSelect;
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [orientation, onDelta],
  );

  return (
    <div
      onPointerDown={onPointerDown}
      title={title ?? 'Ziehen zum Anpassen'}
      className={cn(
        'shrink-0 z-10 group flex items-center justify-center bg-[var(--border)]/40 hover:bg-[var(--primary)]/60 transition-colors',
        orientation === 'v' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize',
      )}
    />
  );
}
