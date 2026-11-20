import { useEffect, useRef, useState } from 'react';
import { cn } from '@jm/ui';
import type { Slide } from '@shared/types';
import { renderBase } from '@/lib/pdf';
import { ensureOverlayBitmaps, paintSlide } from '@/lib/paint';

interface Props {
  slide: Slide;
  /** Paint overlays on top of the base page (default true). */
  withOverlays?: boolean;
  /** Base raster width in px — pick by usage (thumb ~320, current ~1280, audience ~1920). */
  maxWidth?: number;
  className?: string;
  /** #293: gerufen, sobald die Folie gemalt ist (Publikumsansicht: erst dann blenden/umschalten). */
  onGemalt?: () => void;
}

/**
 * Display-only slide renderer. Rasterises the base page (cached) and composites
 * overlays via the shared painter, then letterboxes inside its parent.
 */
export function SlideCanvas({ slide, withOverlays = true, maxWidth = 1280, className, onGemalt }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  // Repaint when the slide content (incl. overlays) or resolution changes.
  const overlaySig = withOverlays ? JSON.stringify(slide.overlays) : '';

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void (async () => {
      try {
        const base = await renderBase(slide.sourceId, slide.pageIndex, maxWidth);
        if (withOverlays) await ensureOverlayBitmaps([slide]);
        if (cancelled) return;
        const canvas = ref.current;
        if (!canvas) return;
        canvas.width = base.width;
        canvas.height = base.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        if (withOverlays) {
          paintSlide(ctx, base.canvas, slide, base.width, base.height);
        } else {
          ctx.clearRect(0, 0, base.width, base.height);
          ctx.drawImage(base.canvas, 0, 0);
        }
        onGemalt?.();
      } catch {
        if (!cancelled) {
          setFailed(true);
          onGemalt?.(); // auch ein Fehler darf den Wechsel nicht festhalten
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide.sourceId, slide.pageIndex, maxWidth, withOverlays, overlaySig]);

  if (failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-xs text-[var(--muted-foreground)]',
          'bg-[var(--card)] border border-[var(--border)] rounded',
          className,
        )}
      >
        Folie konnte nicht geladen werden
      </div>
    );
  }

  return <canvas ref={ref} className={cn('max-w-full max-h-full w-auto h-auto block', className)} />;
}
