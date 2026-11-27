import { useEffect, useRef } from 'react';
import type { CaptionConfig, CaptionLine } from '@shared/types';
import { drawCaption } from './caption-cg';

/**
 * Text der Ausgabe je Takt (Altfehler CA-4): ohne Hold der Text der jüngsten Zeile; mit Hold bleibt der vorige Text stehen, außer
 * seit dem vorigen Takt kam eine Leerung (`leerungen` zählt der Main bei jedem „Leeren“): dann ist der Text leer, und Hold hält
 * diesen leeren Stand. „Leeren“ ist der Griff im Notfall und leert darum immer auch die NDI-Quelle. Rein, ohne window.
 */
export function angezeigterText(
  vorher: { text: string; leerung: number },
  lines: CaptionLine[],
  hold: boolean,
  leerungen: number,
): { text: string; leerung: number } {
  if (!hold) return { text: lines.length ? lines[lines.length - 1].text : '', leerung: leerungen };
  if (leerungen !== vorher.leerung) return { text: '', leerung: leerungen };
  return vorher;
}

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
 * Transkriptionen erscheinen erst nach dem Lösen von Hold. Eine neue Leerung
 * (`leerungen`) leert die Ausgabe auch bei Hold (Altfehler CA-4, angezeigterText).
 */
export function useCaptionNdiEngine(
  config: CaptionConfig,
  lines: CaptionLine[],
  hold: boolean,
  leerungen: number,
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
  const leerungenRef = useRef(leerungen);
  leerungenRef.current = leerungen;

  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const offctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const portRef = useRef<MessagePort | null>(null);
  const lastSendRef = useRef(0);
  // Gezeigter Text und die Leerung, die er schon kennt: bei Hold eingefroren, sonst folgt die Ausgabe der jüngsten Zeile.
  const shownRef = useRef({ text: '', leerung: leerungen });

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

      // Anzuzeigenden Text bestimmen — bei Hold eingefroren, eine neue Leerung leert auch bei Hold (Altfehler CA-4).
      shownRef.current = angezeigterText(shownRef.current, linesRef.current, holdRef.current, leerungenRef.current);
      drawCaption(ctx, W, H, c, shownRef.current.text);

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
