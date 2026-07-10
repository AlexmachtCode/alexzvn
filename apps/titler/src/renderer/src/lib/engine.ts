import { useCallback, useEffect, useRef, useState } from 'react';
import type { GraphicTemplate, TitlerConfig } from '@shared/types';
import { drawCg, type GraphicRenderCtx } from './cg';

/** Aktive Grafik-Vorlage (#162) für den Render-Loop: Metadaten + aufgelöste Slot-Texte. */
export interface EngineGraphic {
  tpl: GraphicTemplate;
  slotText: Record<string, string>;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const ANIM_MS = 450;

/**
 * Render-/NDI-Engine des Titlers (läuft im Operator-Renderer):
 *  - zeichnet den CG pro Frame auf einen Offscreen-Canvas in Programmauflösung,
 *  - spiegelt ihn skaliert in die Vorschau (mit Schachbrett-Hintergrund),
 *  - liest ihn bei aktivem NDI als BGRA aus und postet ihn auf den Frame-Port
 *    (Main → utilityProcess → sendVideoBGRA), gedrosselt auf config.fps.
 * Take/Clear blendet über `vis` (Alpha + Slide) ein/aus.
 */
export function useTitlerEngine(
  config: TitlerConfig,
  ndiActive: boolean,
  previewRef: React.RefObject<HTMLCanvasElement | null>,
  opts?: { bg?: string; graphic?: EngineGraphic },
): { live: boolean; take: () => void; clear: () => void } {
  const cfgRef = useRef(config);
  cfgRef.current = config;
  const ndiRef = useRef(ndiActive);
  ndiRef.current = ndiActive;
  // Hintergrundfarbe (2. Bildschirm, #161) — leer = transparent (NDI-Key).
  const bgRef = useRef(opts?.bg);
  bgRef.current = opts?.bg;
  // Aktive Grafik-Vorlage (#162) + gecachtes Hintergrund-Bitmap (nach Library-ID).
  const graphicRef = useRef(opts?.graphic);
  graphicRef.current = opts?.graphic;
  const bgBitmapRef = useRef<{ id: string; bmp: ImageBitmap } | null>(null);
  const loadingIdRef = useRef<string | null>(null);

  const [live, setLive] = useState(false);

  const visRef = useRef(0);
  const animRef = useRef({ from: 0, to: 0, start: 0 });
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const offctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const portRef = useRef<MessagePort | null>(null);
  const startRef = useRef(performance.now());
  const lastSendRef = useRef(0);

  const animateTo = useCallback((to: number) => {
    animRef.current = { from: visRef.current, to, start: performance.now() };
    setLive(to > 0.5);
  }, []);
  const take = useCallback(() => animateTo(1), [animateTo]);
  const clear = useCallback(() => animateTo(0), [animateTo]);

  // Frame-Port vom Main empfangen (per window.postMessage-Transfer aus dem Preload).
  useEffect(() => {
    const onMsg = (e: MessageEvent): void => {
      if (e.data === 'jmtitler:frame-port' && e.ports && e.ports[0]) {
        portRef.current = e.ports[0];
        portRef.current.start();
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Library-Änderung (#162): gecachtes Hintergrund-Bitmap verwerfen → neu laden.
  useEffect(() => {
    return window.jmtitler.onTplChanged(() => {
      bgBitmapRef.current?.bmp.close();
      bgBitmapRef.current = null;
      loadingIdRef.current = null;
    });
  }, []);

  useEffect(() => {
    // Taktgeber BEWUSST setInterval statt requestAnimationFrame: rAF wird von Chromium angehalten,
    // sobald das Fenster verdeckt/minimiert ist — der NDI-Ausgang muss aber durchlaufen (das Fenster
    // setzt dazu backgroundThrottling:false). ~60 Hz hält die Vorschau-Animation weich; der NDI-Versand
    // darin bleibt auf config.fps gedrosselt. Lehre aus dem Switcher-NDI-Ausgang (Commit 56320acfd8).
    const ensureOffscreen = (W: number, H: number): CanvasRenderingContext2D => {
      let cv = offscreenRef.current;
      if (!cv) {
        cv = document.createElement('canvas');
        offscreenRef.current = cv;
      }
      if (cv.width !== W || cv.height !== H) {
        cv.width = W;
        cv.height = H;
        offctxRef.current = cv.getContext('2d', { willReadFrequently: true });
      }
      if (!offctxRef.current) {
        offctxRef.current = cv.getContext('2d', { willReadFrequently: true });
      }
      return offctxRef.current as CanvasRenderingContext2D;
    };

    const frame = (): void => {
      const c = cfgRef.current;
      const ctx = ensureOffscreen(c.width, c.height);
      const now = performance.now();

      const a = animRef.current;
      const t = Math.min(1, (now - a.start) / ANIM_MS);
      visRef.current = a.from + (a.to - a.from) * easeInOut(t);

      const elapsedSec = (now - startRef.current) / 1000;

      // Grafik-Vorlage (#162): Hintergrund-Bitmap lazy nach Library-ID cachen.
      let gfx: GraphicRenderCtx | undefined;
      const g = graphicRef.current;
      if (c.template === 'graphic' && g) {
        const id = g.tpl.id;
        const cached = bgBitmapRef.current;
        if (id && (!cached || cached.id !== id) && loadingIdRef.current !== id) {
          loadingIdRef.current = id;
          void window.jmtitler.tpl
            .readBg(id)
            .then(async (bytes) => {
              if (!bytes) {
                loadingIdRef.current = null;
                return;
              }
              const bmp = await createImageBitmap(new Blob([bytes as BlobPart], { type: 'image/png' }));
              bgBitmapRef.current?.bmp.close();
              bgBitmapRef.current = { id, bmp };
              loadingIdRef.current = null;
            })
            .catch(() => {
              loadingIdRef.current = null;
            });
        }
        const bmp = bgBitmapRef.current && bgBitmapRef.current.id === id ? bgBitmapRef.current.bmp : null;
        gfx = { tpl: g.tpl, bg: bmp, slotText: g.slotText };
      }

      drawCg(ctx, c.width, c.height, c, visRef.current, elapsedSec, { bg: bgRef.current, gfx });

      // Vorschau (skaliert)
      const pv = previewRef.current;
      if (pv && offscreenRef.current) {
        const pctx = pv.getContext('2d');
        if (pctx) {
          pctx.clearRect(0, 0, pv.width, pv.height);
          pctx.drawImage(offscreenRef.current, 0, 0, pv.width, pv.height);
        }
      }

      // NDI-Frame (gedrosselt auf fps)
      const port = portRef.current;
      if (ndiRef.current && port) {
        const interval = 1000 / Math.max(1, c.fps);
        if (now - lastSendRef.current >= interval) {
          lastSendRef.current = now;
          const img = ctx.getImageData(0, 0, c.width, c.height);
          const u32 = new Uint32Array(img.data.buffer);
          // RGBA (0xAABBGGRR LE) → BGRA (0xAARRGGBB LE): R und B tauschen.
          for (let i = 0; i < u32.length; i++) {
            const p = u32[i];
            u32[i] = (p & 0xff00ff00) | ((p & 0x000000ff) << 16) | ((p & 0x00ff0000) >>> 16);
          }
          // Ohne Transfer posten → Buffer wird kopiert (transferiert käme als null an).
          port.postMessage({ type: 'video', buffer: img.data.buffer, w: c.width, h: c.height, fpsN: c.fps });
        }
      }
    };

    // Ein einzelner Fehler darf die Ausgabe nicht dauerhaft abwürgen: bei der rAF-Schleife riss ein
    // Wurf die Kette ab und die Quelle sendete nie wieder. Der Timer läuft unabhängig weiter.
    const tick = (): void => {
      try {
        frame();
      } catch {
        /* nächster Tick versucht es erneut */
      }
    };

    const timer = setInterval(tick, Math.round(1000 / 60));
    return () => clearInterval(timer);
  }, [previewRef]);

  return { live, take, clear };
}
