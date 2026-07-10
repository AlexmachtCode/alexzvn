// Speist die Zweitbildschirm-Ausgabe: liest das PROGRAMM-Canvas getaktet, kodiert es zu WebP und
// schickt die kleinen Bytes per IPC an den Main → Ausgabefenster (view=output). Bewusst komprimiert
// statt roh — ein 1080p-Rohstrom wäre ~200 MB/s; ein WebP-Frame ist ~100–300 KB.
//
// Der Timer ist BEWUSST setInterval (nicht rAF): das Hauptfenster kann verdeckt/minimiert sein,
// während die Ausgabe auf dem zweiten Monitor weiterlaufen muss (dieselbe Lehre wie der NDI-Ausgang;
// das Hauptfenster hat backgroundThrottling:false). Ein `busy`-Riegel überspringt Frames, statt sie
// zu stauen, falls das Kodieren mal langsamer ist als der Takt.

const DEFAULT_FPS = 25;
// WebP-Qualität: für einen Programm-Monitor/Beamer reicht 0.85 (visuell praktisch verlustfrei,
// aber ein Bruchteil der Rohgröße).
const QUALITY = 0.85;

export class ScreenOutputController {
  private getSource: () => HTMLCanvasElement | null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private fps: number;
  private busy = false;

  constructor(getSource: () => HTMLCanvasElement | null, fps = DEFAULT_FPS) {
    this.getSource = getSource;
    this.fps = fps > 0 ? fps : DEFAULT_FPS;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(this.tick, Math.round(1000 / this.fps));
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.busy = false;
  }

  setFps(fps: number): void {
    const next = fps > 0 ? fps : DEFAULT_FPS;
    if (next === this.fps) return;
    this.fps = next;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = setInterval(this.tick, Math.round(1000 / this.fps));
    }
  }

  private tick = (): void => {
    // Frame-Skipping: läuft noch eine Kodierung, dieses Intervall überspringen (nichts aufstauen).
    if (this.busy) return;
    const src = this.getSource();
    if (!src || src.width === 0 || src.height === 0) return;
    const w = src.width;
    const h = src.height;
    this.busy = true;
    src.toBlob(
      (blob) => {
        if (!blob) {
          this.busy = false;
          return;
        }
        blob
          .arrayBuffer()
          .then((buf) => {
            window.jmswitch.screen.sendFrame(buf, w, h);
          })
          .catch(() => {
            /* Frame verwerfen */
          })
          .finally(() => {
            this.busy = false;
          });
      },
      'image/webp',
      QUALITY,
    );
  };
}
