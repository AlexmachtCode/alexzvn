// Framework-unabhängige Switcher-Engine (OBS-Modell):
//   Quellen-Pool (color/screen) → Szenen (geordnete Ebenen mit Position/Größe)
//   → Program/Preview schalten *Szenen* (Cut hart, Auto = Dissolve).
// Gezeichnet auf zwei Canvases per requestAnimationFrame. NDI/Capture-Karte
// kommen als weitere Quelltypen in späteren Slices dazu.

import type { SwitcherContent, SwitcherSource } from '@shared/project';

export type SourceKind = 'color' | 'screen' | 'ndi' | 'image' | 'capture';

export interface SourceInfo {
  id: string;
  name: string;
  kind: SourceKind;
  color?: string;
  /**
   * Nur für die Anzeige (#89): screen/capture-Quelle ohne Live-Stream — z. B.
   * nach dem Öffnen eines Projekts. Wird per attachStream() wieder verbunden.
   */
  offline?: boolean;
}

/** Chroma-Key-Einstellungen einer Ebene (Greenscreen). */
export interface ChromaKey {
  enabled: boolean;
  /** Schlüsselfarbe als Hex (#rrggbb). */
  color: string;
  /** Toleranz 0..1 — wie nah an der Farbe wird ausgestanzt. */
  similarity: number;
  /** Kantenweichheit 0..1. */
  smoothness: number;
  /** Spill-Suppression 0..1 — Farbstich der Schlüsselfarbe im Motiv dämpfen. */
  spill: number;
}

/** Eine Ebene in einer Szene — Quelle + normalisiertes Rechteck (0..1). */
export interface LayerInfo {
  id: string;
  sourceId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
  /** Chroma-Key (optional; nur für Bild/Video-Quellen sinnvoll). */
  key?: ChromaKey;
}

export const DEFAULT_CHROMA_KEY: ChromaKey = {
  enabled: true,
  color: '#00d400',
  similarity: 0.4,
  smoothness: 0.1,
  spill: 0.3,
};

export interface SceneInfo {
  id: string;
  name: string;
  /** Reihenfolge: erste Ebene = hinten, letzte = vorne. */
  layers: LayerInfo[];
}

export interface EngineState {
  sources: SourceInfo[];
  scenes: SceneInfo[];
  previewSceneId: string | null;
  programSceneId: string | null;
  transitioning: boolean;
  autoMs: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface InternalSource {
  info: SourceInfo;
  video: HTMLVideoElement | null;
  stream: MediaStream | null;
  // Bild/Logo-Quelle (PNG mit Transparenz für Corner-Logos).
  image?: HTMLImageElement;
  // NDI: empfangene BGRA-Frames werden in dieses Offscreen-Canvas geschrieben
  // und von dort wie ein <video> in die Ebene gezeichnet.
  ndiCanvas?: HTMLCanvasElement;
  ndiCtx?: CanvasRenderingContext2D | null;
  ndiImage?: ImageData;
  ndiReady?: boolean;
}

// Vorgabe-Renderauflösung (Full-HD). Über setRenderSize() zur Laufzeit umstellbar
// (Einstellung „Programm-Auflösung"); das Kompositing selbst ist auflösungsunabhängig
// (paintScene/drawSceneLayers rechnen relativ zur Canvas-Größe bzw. in 0..1).
const DEFAULT_RENDER_W = 1920;
const DEFAULT_RENDER_H = 1080;
// Multiview-Ausgabeauflösung (16:9). Bleibt 720p — ein Monitoring-Raster braucht
// kein Full-HD (spart Rechenlast, unabhängig von der Programm-Auflösung).
const MULTIVIEW_W = 1280;
const MULTIVIEW_H = 720;

export class SwitcherEngine {
  private sources: InternalSource[] = [];
  private scenes: SceneInfo[] = [];
  private previewSceneId: string | null = null;
  private programSceneId: string | null = null;
  private autoMs = 800;
  private transition: { fromId: string | null; toId: string; t0: number; dur: number } | null = null;
  // Wiederverwendetes Offscreen-Canvas für Chroma-Key-Ebenen.
  private keyCanvas: HTMLCanvasElement | null = null;
  private keyCtx: CanvasRenderingContext2D | null = null;
  private previewCanvas: HTMLCanvasElement | null = null;
  private programCanvas: HTMLCanvasElement | null = null;
  // Multiview: internes Offscreen-Canvas, das alle Szenen + PGM/PVW zeigt. Wird
  // nur gerendert, wenn aktiv (Panel offen oder NDI-Multiview-Ausgabe) — sonst
  // kostenlos. Konsumenten (Vorschau-Panel, NDI-Ausgabe) lesen es per
  // getMultiviewCanvas() und blitten/kodieren daraus (eine Quelle der Wahrheit).
  private multiviewCanvas: HTMLCanvasElement | null = null;
  private multiviewActive = false;
  private multiviewTally = { recording: false, streaming: false };
  private raf = 0;
  private listeners = new Set<() => void>();
  private seq = 0;
  private renderW = DEFAULT_RENDER_W;
  private renderH = DEFAULT_RENDER_H;

  attach(preview: HTMLCanvasElement, program: HTMLCanvasElement): void {
    this.previewCanvas = preview;
    this.programCanvas = program;
    preview.width = this.renderW;
    preview.height = this.renderH;
    program.width = this.renderW;
    program.height = this.renderH;
    if (!this.raf) this.loop();
  }

  /**
   * Programm-/Vorschau-Renderauflösung zur Laufzeit umstellen (Einstellung
   * „Programm-Auflösung"). Beide Canvas werden neu dimensioniert — Aufnahme/RTMP
   * (captureStream auf dem Programm-Canvas) und die NDI-Ausgabe (liest die
   * Canvas-Größe) ziehen automatisch nach. Idempotent.
   */
  setRenderSize(w: number, h: number): void {
    if (w <= 0 || h <= 0) return;
    if (w === this.renderW && h === this.renderH) return;
    this.renderW = w;
    this.renderH = h;
    if (this.previewCanvas) {
      this.previewCanvas.width = w;
      this.previewCanvas.height = h;
    }
    if (this.programCanvas) {
      this.programCanvas.width = w;
      this.programCanvas.height = h;
    }
  }

  detach(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy(): void {
    this.detach();
    for (const s of this.sources) this.disposeSource(s);
    this.sources = [];
    this.scenes = [];
    this.previewSceneId = null;
    this.programSceneId = null;
    this.transition = null;
    this.multiviewActive = false;
    this.multiviewCanvas = null;
  }

  // ---- Multiview ----

  /**
   * Multiview-Rendering an-/abschalten. Nur wenn aktiv wird das Offscreen-Canvas
   * pro Frame gefüllt (sonst kostenlos). Konsumenten lesen getMultiviewCanvas().
   */
  setMultiviewActive(on: boolean): void {
    this.multiviewActive = on;
    if (on && !this.multiviewCanvas) {
      const cv = document.createElement('canvas');
      cv.width = MULTIVIEW_W;
      cv.height = MULTIVIEW_H;
      this.multiviewCanvas = cv;
    }
  }

  /** Tally-Marker (REC/LIVE) für die Multiview-PGM-Box setzen. */
  setMultiviewTally(tally: { recording: boolean; streaming: boolean }): void {
    this.multiviewTally = tally;
  }

  /** Das Multiview-Offscreen-Canvas (oder null, falls nie aktiviert). */
  getMultiviewCanvas(): HTMLCanvasElement | null {
    return this.multiviewCanvas;
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  getState(): EngineState {
    return {
      sources: this.sources.map((s) => {
        const offline = (s.info.kind === 'screen' || s.info.kind === 'capture') && !s.stream;
        return offline ? { ...s.info, offline: true } : { ...s.info };
      }),
      scenes: this.scenes.map((sc) => ({ ...sc, layers: sc.layers.map((l) => ({ ...l })) })),
      previewSceneId: this.previewSceneId,
      programSceneId: this.programSceneId,
      transitioning: this.transition != null,
      autoMs: this.autoMs,
    };
  }

  // ---- Projekt speichern/laden (#89) ----

  /** Serialisierbaren Projektinhalt liefern (ohne Live-Streams; image als Data-URL). */
  serialize(): SwitcherContent {
    return {
      sources: this.sources.map((s): SwitcherSource => {
        const base: SwitcherSource = { id: s.info.id, name: s.info.name, kind: s.info.kind };
        if (s.info.kind === 'color' && s.info.color) base.color = s.info.color;
        if (s.info.kind === 'image' && s.image?.src) base.imageDataUrl = s.image.src;
        return base;
      }),
      scenes: this.scenes.map((sc) => ({ ...sc, layers: sc.layers.map((l) => ({ ...l })) })),
      previewSceneId: this.previewSceneId,
      programSceneId: this.programSceneId,
      autoMs: this.autoMs,
    };
  }

  /**
   * Projektinhalt laden: aktuelle Quellen freigeben und Pool/Szenen neu aufbauen.
   * Source-IDs werden 1:1 übernommen (damit Ebenen-Referenzen + NDI-Reconnect per
   * recvId=id greifen). NDI wird NICHT hier verbunden — das macht die View
   * (Auto-Reconnect); screen/capture starten offline (per attachStream verbindbar).
   */
  loadContent(content: SwitcherContent): void {
    for (const s of this.sources) this.disposeSource(s);
    this.transition = null;
    this.sources = content.sources.map((src): InternalSource => {
      if (src.kind === 'image' && src.imageDataUrl) {
        const image = new Image();
        image.onload = () => this.notify();
        image.src = src.imageDataUrl;
        return { info: { id: src.id, name: src.name, kind: 'image' }, video: null, stream: null, image };
      }
      const info: SourceInfo = { id: src.id, name: src.name, kind: src.kind };
      if (src.kind === 'color') info.color = src.color ?? '#000000';
      return { info, video: null, stream: null };
    });
    this.scenes = content.scenes.map((sc) => ({
      id: sc.id,
      name: sc.name,
      layers: sc.layers.map((l) => ({ ...l, key: l.key ? { ...l.key } : undefined })),
    }));
    this.previewSceneId = content.previewSceneId;
    this.programSceneId = content.programSceneId;
    this.autoMs = content.autoMs;
    // seq über die höchste vergebene Nummer heben, damit neue IDs nicht kollidieren.
    this.seq = Math.max(this.seq, maxIdSeq(content));
    this.notify();
  }

  /** Einen (offline-)Quelleneintrag wieder an einen Live-Stream koppeln (Reconnect). */
  attachStream(sourceId: string, stream: MediaStream): void {
    const src = this.sources.find((s) => s.info.id === sourceId);
    if (!src) return;
    this.disposeSource(src);
    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = stream;
    void video.play().catch(() => {});
    src.video = video;
    src.stream = stream;
    src.image = undefined;
    this.notify();
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }

  // ---- Quellen-Pool ----

  addColor(name: string, color: string): string {
    const id = this.nextId('src');
    this.sources.push({ info: { id, name, kind: 'color', color }, video: null, stream: null });
    this.notify();
    return id;
  }

  /** Farbe einer Farb-Quelle ändern. */
  setSourceColor(id: string, color: string): void {
    const src = this.sources.find((s) => s.info.id === id);
    if (src && src.info.kind === 'color') {
      src.info.color = color;
      this.notify();
    }
  }

  /** Ein Bild/Logo (Data-URL, z. B. PNG mit Alpha) als Quelle in den Pool legen. */
  addImageSource(name: string, dataUrl: string): string {
    const id = this.nextId('src');
    const image = new Image();
    image.onload = () => this.notify(); // erstes Frame zeichnen, sobald geladen
    image.src = dataUrl;
    this.sources.push({ info: { id, name, kind: 'image' }, video: null, stream: null, image });
    this.notify();
    return id;
  }

  addScreenStream(name: string, stream: MediaStream): string {
    return this.pushStreamSource(name, 'screen', stream);
  }

  /** Eine Capture-Karte / Kamera (getUserMedia-Stream) in den Pool legen. */
  addCaptureStream(name: string, stream: MediaStream): string {
    return this.pushStreamSource(name, 'capture', stream);
  }

  private pushStreamSource(name: string, kind: SourceKind, stream: MediaStream): string {
    const id = this.nextId('src');
    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = stream;
    void video.play().catch(() => {});
    this.sources.push({ info: { id, name, kind }, video, stream });
    this.notify();
    return id;
  }

  /** Eine NDI-Quelle in den Pool legen (Frames kommen via updateNdiFrame). */
  addNdiSource(name: string): string {
    const id = this.nextId('src');
    this.sources.push({ info: { id, name, kind: 'ndi' }, video: null, stream: null });
    this.notify();
    return id;
  }

  /**
   * Ein empfangenes BGRA-Frame in das Offscreen-Canvas der NDI-Quelle schreiben.
   * Bewusst OHNE notify() — der rAF-Loop liest das Canvas direkt; React muss
   * nicht 30×/s neu rendern.
   */
  updateNdiFrame(id: string, data: Uint8Array, width: number, height: number, lineStride: number): void {
    const src = this.sources.find((s) => s.info.id === id);
    if (!src || src.info.kind !== 'ndi' || width <= 0 || height <= 0) return;
    if (!src.ndiCanvas) src.ndiCanvas = document.createElement('canvas');
    if (src.ndiCanvas.width !== width || src.ndiCanvas.height !== height) {
      src.ndiCanvas.width = width;
      src.ndiCanvas.height = height;
      src.ndiCtx = src.ndiCanvas.getContext('2d');
      src.ndiImage = src.ndiCtx?.createImageData(width, height) ?? undefined;
    }
    const ctx = src.ndiCtx;
    const img = src.ndiImage;
    if (!ctx || !img) return;
    bgraToRgba(data, img.data, width, height, lineStride);
    ctx.putImageData(img, 0, 0);
    src.ndiReady = true;
  }

  renameSource(id: string, name: string): void {
    const src = this.sources.find((s) => s.info.id === id);
    if (src) {
      src.info.name = name;
      this.notify();
    }
  }

  removeSource(id: string): void {
    const idx = this.sources.findIndex((s) => s.info.id === id);
    if (idx < 0) return;
    this.disposeSource(this.sources[idx]);
    this.sources.splice(idx, 1);
    // Aus allen Szenen die Ebenen dieser Quelle entfernen.
    for (const sc of this.scenes) sc.layers = sc.layers.filter((l) => l.sourceId !== id);
    this.notify();
  }

  private disposeSource(s: InternalSource): void {
    s.stream?.getTracks().forEach((t) => t.stop());
    if (s.video) s.video.srcObject = null;
    if (s.image) s.image.onload = null;
  }

  // ---- Szenen ----

  addScene(name: string): string {
    const id = this.nextId('scene');
    this.scenes.push({ id, name, layers: [] });
    if (!this.previewSceneId) this.previewSceneId = id;
    if (!this.programSceneId) this.programSceneId = id;
    this.notify();
    return id;
  }

  removeScene(id: string): void {
    const idx = this.scenes.findIndex((s) => s.id === id);
    if (idx < 0) return;
    this.scenes.splice(idx, 1);
    if (this.previewSceneId === id) this.previewSceneId = this.scenes[0]?.id ?? null;
    if (this.programSceneId === id) this.programSceneId = this.scenes[0]?.id ?? null;
    if (this.transition && (this.transition.fromId === id || this.transition.toId === id)) {
      this.transition = null;
    }
    this.notify();
  }

  renameScene(id: string, name: string): void {
    const sc = this.scenes.find((s) => s.id === id);
    if (sc) {
      sc.name = name;
      this.notify();
    }
  }

  setPreviewScene(id: string): void {
    this.previewSceneId = id;
    this.notify();
  }

  /** Program direkt auf eine Szene setzen (harter Schnitt, z. B. Fernsteuerung). */
  setProgramScene(id: string): void {
    if (!this.scenes.some((s) => s.id === id)) return;
    this.programSceneId = id;
    this.transition = null;
    this.notify();
  }

  // ---- Ebenen ----

  /** Quelle als Ebene in eine Szene legen. Erste Ebene = Vollbild, weitere = PiP. */
  addLayer(sceneId: string, sourceId: string): void {
    const sc = this.scenes.find((s) => s.id === sceneId);
    if (!sc) return;
    const first = sc.layers.length === 0;
    const rect: Rect = first ? { x: 0, y: 0, w: 1, h: 1 } : { x: 0.66, y: 0.06, w: 0.3, h: 0.3 };
    sc.layers.push({ id: this.nextId('layer'), sourceId, ...rect, visible: true });
    this.notify();
  }

  removeLayer(sceneId: string, layerId: string): void {
    const sc = this.scenes.find((s) => s.id === sceneId);
    if (!sc) return;
    sc.layers = sc.layers.filter((l) => l.id !== layerId);
    this.notify();
  }

  setLayerRect(sceneId: string, layerId: string, rect: Rect): void {
    const layer = this.scenes.find((s) => s.id === sceneId)?.layers.find((l) => l.id === layerId);
    if (!layer) return;
    layer.x = rect.x;
    layer.y = rect.y;
    layer.w = rect.w;
    layer.h = rect.h;
    this.notify();
  }

  /** Chroma-Key einer Ebene setzen/ändern (Patch wird gemerged). */
  setLayerKey(sceneId: string, layerId: string, patch: Partial<ChromaKey>): void {
    const layer = this.scenes.find((s) => s.id === sceneId)?.layers.find((l) => l.id === layerId);
    if (!layer) return;
    layer.key = { ...DEFAULT_CHROMA_KEY, ...layer.key, ...patch };
    this.notify();
  }

  setLayerVisible(sceneId: string, layerId: string, visible: boolean): void {
    const layer = this.scenes.find((s) => s.id === sceneId)?.layers.find((l) => l.id === layerId);
    if (!layer) return;
    layer.visible = visible;
    this.notify();
  }

  /** Ebene in der Z-Reihenfolge verschieben (+1 = weiter nach vorn). */
  moveLayer(sceneId: string, layerId: string, dir: -1 | 1): void {
    const sc = this.scenes.find((s) => s.id === sceneId);
    if (!sc) return;
    const i = sc.layers.findIndex((l) => l.id === layerId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sc.layers.length) return;
    [sc.layers[i], sc.layers[j]] = [sc.layers[j], sc.layers[i]];
    this.notify();
  }

  // ---- Transport ----

  setAutoMs(ms: number): void {
    this.autoMs = Math.max(0, Math.floor(ms) || 0);
    this.notify();
  }

  /**
   * Bus-Swap nach CUT/AUTO (Standard-Mischer-Verhalten, #21): das alte Program
   * (`fromId`) wird zum neuen Preview, sofern es noch existiert und sich vom
   * neuen Program unterscheidet. So sind PGM/PVW danach wieder verschieden und
   * ein sinnvoller Rück-Wechsel ist sofort möglich.
   */
  private busSwapPreview(fromId: string | null): void {
    if (fromId && fromId !== this.programSceneId && this.scenes.some((s) => s.id === fromId)) {
      this.previewSceneId = fromId;
    }
  }

  cut(): void {
    if (!this.previewSceneId) return;
    const fromId = this.programSceneId;
    this.programSceneId = this.previewSceneId;
    this.busSwapPreview(fromId);
    this.transition = null;
    this.notify();
  }

  auto(ms?: number): void {
    if (!this.previewSceneId || this.previewSceneId === this.programSceneId || this.transition) return;
    this.transition = {
      fromId: this.programSceneId,
      toId: this.previewSceneId,
      t0: performance.now(),
      dur: ms ?? this.autoMs,
    };
    this.notify();
  }

  // ---- Rendering ----

  private loop = (): void => {
    this.render();
    if (this.multiviewActive) this.renderMultiview();
    this.raf = requestAnimationFrame(this.loop);
  };

  private render(): void {
    this.paintScene(this.previewCanvas, this.previewSceneId, 1, true);

    if (this.transition) {
      const k =
        this.transition.dur > 0
          ? Math.min(1, (performance.now() - this.transition.t0) / this.transition.dur)
          : 1;
      this.paintScene(this.programCanvas, this.transition.fromId, 1, true);
      this.paintScene(this.programCanvas, this.transition.toId, k, false);
      if (k >= 1) {
        const fromId = this.transition.fromId;
        this.programSceneId = this.transition.toId;
        this.busSwapPreview(fromId); // altes Program → Preview (Bus-Swap, #21)
        this.transition = null;
        this.notify();
      }
    } else {
      this.paintScene(this.programCanvas, this.programSceneId, 1, true);
    }
  }

  private paintScene(
    canvas: HTMLCanvasElement | null,
    sceneId: string | null,
    alpha: number,
    clearFirst: boolean,
  ): void {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    if (clearFirst) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
    }
    const scene = sceneId ? this.scenes.find((s) => s.id === sceneId) : null;
    if (!scene) return;
    this.drawSceneLayers(ctx, scene, 0, 0, w, h, alpha);
  }

  /**
   * Zeichnet die (sichtbaren) Ebenen einer Szene in ein Rechteck (rx,ry,rw,rh)
   * des Ziel-Contexts — Ebenenrechtecke sind relativ zur Szene (0..1) und werden
   * in die Region skaliert. Genutzt vom Haupt-Output (Vollbild) und vom
   * Multiview (PGM/PVW-Boxen + Szenen-Kacheln).
   */
  private drawSceneLayers(
    ctx: CanvasRenderingContext2D,
    scene: SceneInfo,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    alpha: number,
  ): void {
    for (const layer of scene.layers) {
      if (!layer.visible) continue;
      const src = this.sources.find((x) => x.info.id === layer.sourceId);
      if (!src) continue;
      const dx = rx + layer.x * rw;
      const dy = ry + layer.y * rh;
      const dw = layer.w * rw;
      const dh = layer.h * rh;
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      if (src.info.kind === 'color' && src.info.color) {
        ctx.fillStyle = src.info.color;
        ctx.fillRect(dx, dy, dw, dh);
      } else {
        // Zeichenbare Quelle (NDI/Bild/Video) ermitteln.
        let img: CanvasImageSource | null = null;
        let iw = 0;
        let ih = 0;
        if (src.info.kind === 'ndi' && src.ndiReady && src.ndiCanvas) {
          img = src.ndiCanvas;
          iw = src.ndiCanvas.width;
          ih = src.ndiCanvas.height;
        } else if (src.info.kind === 'image' && src.image && src.image.complete && src.image.naturalWidth > 0) {
          img = src.image;
          iw = src.image.naturalWidth;
          ih = src.image.naturalHeight;
        } else if (src.video && src.video.readyState >= 2 && src.video.videoWidth > 0) {
          img = src.video;
          iw = src.video.videoWidth;
          ih = src.video.videoHeight;
        }
        if (img) {
          if (layer.key?.enabled) {
            this.drawKeyed(ctx, img, iw, ih, dx, dy, dw, dh, layer.key);
          } else {
            drawContainInto(ctx, img, iw, ih, dx, dy, dw, dh);
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Quelle ins Offscreen-Canvas zeichnen, Chroma-Key anwenden, dann compositen. */
  private drawKeyed(
    ctx: CanvasRenderingContext2D,
    img: CanvasImageSource,
    iw: number,
    ih: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    key: ChromaKey,
  ): void {
    const w = Math.max(1, Math.round(dw));
    const h = Math.max(1, Math.round(dh));
    if (!this.keyCanvas) this.keyCanvas = document.createElement('canvas');
    if (this.keyCanvas.width !== w || this.keyCanvas.height !== h) {
      this.keyCanvas.width = w;
      this.keyCanvas.height = h;
      this.keyCtx = this.keyCanvas.getContext('2d', { willReadFrequently: true });
    }
    const wctx = this.keyCtx;
    if (!wctx) return;
    wctx.clearRect(0, 0, w, h);
    drawContainInto(wctx, img, iw, ih, 0, 0, w, h);
    const image = wctx.getImageData(0, 0, w, h);
    chromaKey(image.data, key);
    wctx.putImageData(image, 0, 0);
    ctx.drawImage(this.keyCanvas, dx, dy, w, h);
  }

  // ---- Multiview-Rendering ----

  /**
   * Zeichnet das Multiview-Bild: oben PGM + PVW groß (rote/grüne Umrandung,
   * Tally), darunter ein Raster aller Szenen-Kacheln (Tally-Rand für PGM/PVW).
   * Liest die fertigen PGM/PVW-Canvases (inkl. laufender Blende) direkt; die
   * Kacheln werden frisch aus dem Szenenzustand gezeichnet.
   */
  private renderMultiview(): void {
    const cv = this.multiviewCanvas;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const W = cv.width;
    const H = cv.height;
    const PAD = 12;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    // Oben: PGM + PVW nebeneinander (jeweils halbe Breite).
    const topH = Math.round(H * 0.56);
    const boxW = (W - PAD * 3) / 2;
    const boxH = topH - PAD * 2;
    const recTxt = this.multiviewTally.recording ? '● REC' : '';
    const liveTxt = this.multiviewTally.streaming ? '● LIVE' : '';
    const pgmTally = [recTxt, liveTxt].filter(Boolean).join('  ');
    this.drawMvMonitor(ctx, this.programCanvas, PAD, PAD, boxW, boxH, 'PROGRAM', '#dc2626', pgmTally);
    this.drawMvMonitor(ctx, this.previewCanvas, PAD * 2 + boxW, PAD, boxW, boxH, 'PREVIEW', '#16a34a');

    // Unten: Szenen-Kacheln im Raster.
    const stripY = topH;
    const stripH = H - topH;
    const n = this.scenes.length;
    if (n === 0) return;
    const maxCols = 5;
    const cols = Math.min(n, maxCols);
    const rows = Math.ceil(n / cols);
    const cellW = (W - PAD * (cols + 1)) / cols;
    const cellH = (stripH - PAD * (rows + 1)) / rows;
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = PAD + c * (cellW + PAD);
      const y = stripY + PAD + r * (cellH + PAD);
      const scene = this.scenes[i];
      const accent =
        scene.id === this.programSceneId
          ? '#dc2626'
          : scene.id === this.previewSceneId
            ? '#16a34a'
            : '#3a3a3a';
      this.drawMvScene(ctx, scene, x, y, cellW, cellH, accent);
    }
  }

  /** Eine große Multiview-Box: fertiges Canvas (PGM/PVW) + Label + Tally. */
  private drawMvMonitor(
    ctx: CanvasRenderingContext2D,
    src: HTMLCanvasElement | null,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    accent: string,
    tally?: string,
  ): void {
    const labelH = Math.max(18, Math.round(h * 0.09));
    const vy = y + labelH;
    const vh = h - labelH;
    ctx.fillStyle = '#000';
    ctx.fillRect(x, vy, w, vh);
    if (src && src.width > 0) drawContainInto(ctx, src, src.width, src.height, x, vy, w, vh);
    // Label-Leiste
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, w, labelH);
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.round(labelH * 0.62)}px Segoe UI, system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 8, y + labelH / 2 + 1);
    if (tally) {
      ctx.textAlign = 'right';
      ctx.fillText(tally, x + w - 8, y + labelH / 2 + 1);
    }
    // Rahmen
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  }

  /** Eine Szenen-Kachel: Szene gerendert + Name + Tally-Rand. */
  private drawMvScene(
    ctx: CanvasRenderingContext2D,
    scene: SceneInfo,
    x: number,
    y: number,
    w: number,
    h: number,
    accent: string,
  ): void {
    const labelH = Math.max(14, Math.round(h * 0.16));
    const vy = y;
    const vh = h - labelH;
    ctx.fillStyle = '#000';
    ctx.fillRect(x, vy, w, vh);
    // Szene in die (16:9-zentrierte) Videofläche zeichnen, hart auf die Box geclippt.
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, vy, w, vh);
    ctx.clip();
    const inner = contain169(x, vy, w, vh);
    this.drawSceneLayers(ctx, scene, inner.x, inner.y, inner.w, inner.h, 1);
    ctx.restore();
    // Namensleiste
    ctx.fillStyle = '#161616';
    ctx.fillRect(x, y + h - labelH, w, labelH);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = `600 ${Math.round(labelH * 0.6)}px Segoe UI, system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const name = scene.name.length > 22 ? scene.name.slice(0, 21) + '…' : scene.name;
    ctx.fillText(name, x + 6, y + h - labelH / 2 + 1);
    // Tally-Rahmen
    ctx.strokeStyle = accent;
    ctx.lineWidth = accent === '#3a3a3a' ? 1.5 : 3;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }
}

/** Höchste Zahl aus allen IDs (src-N/scene-N/layer-N) eines Projektinhalts (#89). */
function maxIdSeq(content: SwitcherContent): number {
  let max = 0;
  const scan = (id: string): void => {
    const m = /-(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  };
  for (const s of content.sources) scan(s.id);
  for (const sc of content.scenes) {
    scan(sc.id);
    for (const l of sc.layers) scan(l.id);
  }
  return max;
}

/** Zentriertes 16:9-Rechteck innerhalb (x,y,w,h). */
function contain169(x: number, y: number, w: number, h: number): Rect {
  const target = 16 / 9;
  let cw = w;
  let ch = w / target;
  if (ch > h) {
    ch = h;
    cw = h * target;
  }
  return { x: x + (w - cw) / 2, y: y + (h - ch) / 2, w: cw, h: ch };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { r: 0, g: 212, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Chroma-Key per YCbCr-Chroma-Distanz: Pixel nahe der Schlüsselfarbe → alpha 0,
 * Übergangsband gefeathert. Optionale Spill-Suppression dämpft den Farbstich der
 * dominanten Schlüsselkanal-Komponente im verbleibenden Motiv.
 */
function chromaKey(data: Uint8ClampedArray, key: ChromaKey): void {
  const { r: kr, g: kg, b: kb } = hexToRgb(key.color);
  const kCb = -0.168736 * kr - 0.331264 * kg + 0.5 * kb;
  const kCr = 0.5 * kr - 0.418688 * kg - 0.081312 * kb;
  const sim = key.similarity * 0.5 * 255; // Schwelle in Cb/Cr-Einheiten
  const smooth = Math.max(1, key.smoothness * 0.3 * 255);
  const spill = key.spill ?? 0;
  const maxK = Math.max(kr, kg, kb);
  const dom = kg === maxK ? 1 : kb === maxK ? 2 : 0; // dominanter Kanal der Keyfarbe
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const cb = -0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 0.5 * r - 0.418688 * g - 0.081312 * b;
    const d = Math.hypot(cb - kCb, cr - kCr);
    if (d < sim) {
      data[i + 3] = 0;
      continue;
    }
    if (d < sim + smooth) {
      const a = Math.round(data[i + 3] * ((d - sim) / smooth));
      data[i + 3] = a;
      if (a === 0) continue;
    }
    if (spill > 0) {
      if (dom === 1) {
        const lim = (r + b) / 2;
        if (g > lim) data[i + 1] = g - (g - lim) * spill;
      } else if (dom === 2) {
        const lim = (r + g) / 2;
        if (b > lim) data[i + 2] = b - (b - lim) * spill;
      } else {
        const lim = (g + b) / 2;
        if (r > lim) data[i] = r - (r - lim) * spill;
      }
    }
  }
}

/**
 * BGRA → RGBA (Canvas-ImageData erwartet RGBA). Schneller Pfad per Uint32 (eine
 * Operation/Pixel) wenn dicht gepackt; sonst Byte-Schleife mit Stride-Beachtung.
 * Little-Endian-Layout der Quelle: Bits 0-7 = B, 8-15 = G, 16-23 = R, 24-31 = A.
 */
function bgraToRgba(
  src: Uint8Array,
  dst: Uint8ClampedArray,
  w: number,
  h: number,
  stride: number,
): void {
  if (stride === w * 4 && src.byteOffset % 4 === 0 && src.byteLength >= w * h * 4) {
    const s32 = new Uint32Array(src.buffer, src.byteOffset, w * h);
    const d32 = new Uint32Array(dst.buffer, dst.byteOffset, w * h);
    for (let i = 0; i < s32.length; i++) {
      const p = s32[i];
      // A + G bleiben; B (Bits 0-7) → 16-23, R (Bits 16-23) → 0-7.
      d32[i] = (p & 0xff00ff00) | ((p & 0xff) << 16) | ((p >>> 16) & 0xff);
    }
    return;
  }
  for (let y = 0; y < h; y++) {
    let s = y * stride;
    let d = y * w * 4;
    for (let x = 0; x < w; x++) {
      dst[d] = src[s + 2]; // R
      dst[d + 1] = src[s + 1]; // G
      dst[d + 2] = src[s]; // B
      dst[d + 3] = src[s + 3]; // A
      s += 4;
      d += 4;
    }
  }
}

function drawContainInto(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  iw: number,
  ih: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const scale = Math.min(dw / iw, dh / ih);
  const cw = iw * scale;
  const ch = ih * scale;
  ctx.drawImage(img, dx + (dw - cw) / 2, dy + (dh - ch) / 2, cw, ch);
}
