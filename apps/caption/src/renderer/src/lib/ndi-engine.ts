import { useEffect, useRef } from 'react';
import type { CaptionConfig, CaptionLine } from '@shared/types';
import { drawCaption } from './caption-cg';

/**
 * NDI-/Render-Engine der Caption (läuft im Operator-Renderer, Muster aus
 * apps/titler/src/renderer/src/lib/engine.ts):
 *  - zeichnet den aktuellen Untertitel pro Frame auf einen Offscreen-Canvas in
 *    Programmauflösung,
 *  - spiegelt ihn skaliert in die Vorschau,
 *  - liest ihn bei aktivem NDI als BGRA aus und postet ihn auf den Frame-Port
 *    (Main → utilityProcess → sendVideoBGRA), gedrosselt auf cfg.ndiFps.
 *
 * `hold` friert die Ausgabe ein: der zuletzt angezeigte Text bleibt stehen, neue
 * Transkriptionen erscheinen erst nach dem Lösen von Hold.
 */
export function useCaptionNdiEngine(
  config: CaptionConfig,
  lines: CaptionLine[],
  hold: boolean,
  ndiActive: boolean,
  previewRef: React.RefObject<HTMLCanvasElement | null>,
): void {
  const cfgRef = useRef(config);
  cfgRef.current = config;
  const ndiRef = useRef(ndiActive);
  ndiRef.current = ndiActive;
  const holdRef = useRef(hold);
  holdRef.current = hold;
  const linesRef = useRef(lines);
  linesRef.current = lines;

  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const offctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const portRef = useRef<MessagePort | null>(null);
  const lastSendRef = useRef(0);
  // Bei Hold eingefrorener Text (sonst folgt die Ausgabe der jüngsten Zeile).
  const shownTextRef = useRef('');

  // Frame-Port vom Main empfangen (per window.postMessage-Transfer aus dem Preload).
  useEffect(() => {
    const onMsg = (e: MessageEvent): void => {
      if (e.data === 'jmcaption:frame-port' && e.ports && e.ports[0]) {
        portRef.current = e.ports[0];
        portRef.current.start();
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  useEffect(() => {
    // Taktgeber BEWUSST setInterval statt requestAnimationFrame: rAF wird von Chromium angehalten,
    // sobald das Fenster verdeckt/minimiert ist — der NDI-Ausgang muss aber durchlaufen (das Fenster
    // setzt dazu backgroundThrottling:false). ~60 Hz für die Vorschau; der NDI-Versand bleibt darin auf
    // cfg.ndiFps gedrosselt. Lehre aus dem Switcher-NDI-Ausgang (Commit 56320acfd8).
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
      const W = Math.max(2, Math.round(c.ndiWidth));
      const H = Math.max(2, Math.round(c.ndiHeight));
      const ctx = ensureOffscreen(W, H);
      const now = performance.now();

      // Anzuzeigenden Text bestimmen — bei Hold eingefroren.
      if (!holdRef.current) {
        const ls = linesRef.current;
        shownTextRef.current = ls.length ? ls[ls.length - 1].text : '';
      }
      drawCaption(ctx, W, H, c, shownTextRef.current);

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
        const interval = 1000 / Math.max(1, c.ndiFps);
        if (now - lastSendRef.current >= interval) {
          lastSendRef.current = now;
          const img = ctx.getImageData(0, 0, W, H);
          const u32 = new Uint32Array(img.data.buffer);
          // RGBA (0xAABBGGRR LE) → BGRA (0xAARRGGBB LE): R und B tauschen.
          for (let i = 0; i < u32.length; i++) {
            const p = u32[i];
            u32[i] = (p & 0xff00ff00) | ((p & 0x000000ff) << 16) | ((p & 0x00ff0000) >>> 16);
          }
          // Ohne Transfer posten → Buffer wird kopiert (transferiert käme als null an).
          port.postMessage({ type: 'video', buffer: img.data.buffer, w: W, h: H, fpsN: c.ndiFps });
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
}
