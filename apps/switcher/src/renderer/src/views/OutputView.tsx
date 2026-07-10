import { useEffect, useRef } from 'react';

/**
 * Ausgabe-Ansicht des zweiten Bildschirms (view=output): ein Vollbild-Canvas, das die vom
 * Haupt-Renderer zugelieferten (WebP-komprimierten) Programm-Frames zeigt. Kein Topbar, keine
 * Bedienung — reiner Monitor-/Beamer-Feed. Das Bild wird seitenverhältnistreu eingepasst (schwarze
 * Balken statt Verzerrung).
 *
 * Frame-Skipping: es wird nur das JEWEILS NEUESTE Frame dekodiert. Kommt ein neues, während noch
 * dekodiert wird, ersetzt es das wartende — so staut sich nichts auf, wenn die Dekodierung mal
 * langsamer ist als die Zulieferung.
 */
export function OutputView(): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let latest: ArrayBuffer | null = null;
    let decoding = false;
    let disposed = false;

    const fit = (): void => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    fit();
    window.addEventListener('resize', fit);

    const drawBitmap = (bmp: ImageBitmap): void => {
      if (!ctx) return;
      const cw = canvas.width;
      const ch = canvas.height;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);
      const scale = Math.min(cw / bmp.width, ch / bmp.height);
      const dw = bmp.width * scale;
      const dh = bmp.height * scale;
      ctx.drawImage(bmp, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    };

    const pump = async (): Promise<void> => {
      if (decoding || latest == null) return;
      decoding = true;
      const buf = latest;
      latest = null;
      try {
        const bmp = await createImageBitmap(new Blob([buf], { type: 'image/webp' }));
        if (disposed) bmp.close();
        else {
          drawBitmap(bmp);
          bmp.close();
        }
      } catch {
        /* defektes Frame verwerfen — das nächste kommt gleich */
      }
      decoding = false;
      if (!disposed && latest != null) void pump();
    };

    const off = window.jmswitch.screen.onFrame((data) => {
      latest = data;
      void pump();
    });

    return () => {
      disposed = true;
      off();
      window.removeEventListener('resize', fit);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100vw', height: '100vh', background: '#000' }}
    />
  );
}
