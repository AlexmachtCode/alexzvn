import { create } from 'zustand';
import type { ImportedFile, Overlay, ProjectDoc, Slide, SourceMeta } from '@shared/types';
import { uid } from '@/lib/ids';
import { clearAssets, getSource, getImageBytes, putImage, putSource } from '@/lib/assets';
import { clearPdfCaches, pdfPageCount } from '@/lib/pdf';
import { deserializeProject, serializeProject } from '@/lib/project-file';
import { exportSlidesToPdf } from '@/lib/export-pdf';
import { getExpandPptxBuilds } from '@/lib/settings';

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

function makeSlide(sourceId: string, pageIndex: number, title: string): Slide {
  return {
    id: uid('slide'),
    sourceId,
    pageIndex,
    title,
    notes: '',
    hidden: false,
    overlays: [],
  };
}

function emptyDoc(): ProjectDoc {
  return { schemaVersion: 1, name: 'Unbenannt', slides: [], sources: [] };
}

interface Busy {
  active: boolean;
  label: string;
}

interface ProjectState {
  doc: ProjectDoc;
  selectedId: string | null;
  selectedOverlayId: string | null;
  dirty: boolean;
  busy: Busy;
  error: string | null;
  /** Neutral, dismissible info message (distinct from the red error banner). */
  notice: string | null;

  // selection
  select: (id: string | null) => void;
  selectOverlay: (id: string | null) => void;

  // import / IO
  importDocs: () => Promise<void>;
  /**
   * Bereits gelesene Dateien (PDF/Bild) als Quellen+Folien einpflegen. `replace`
   * ersetzt das aktuelle Projekt (frisches Deck) — genutzt vom PRESENTER-OPEN-
   * Steuerbefehl; `importDocs` ruft es mit replace=false (anhängen).
   */
  ingestImportedFiles: (files: ImportedFile[], replace?: boolean) => Promise<void>;
  importOffice: () => Promise<void>;
  newProject: () => void;
  openProject: () => Promise<void>;
  /** Projekt aus rohen .jmpres-Bytes laden (manuell oder via Show-Deep-Link). */
  openProjectFromBytes: (bytes: Uint8Array) => void;
  saveProject: () => Promise<void>;
  exportPdf: () => Promise<void>;
  setError: (msg: string | null) => void;
  setNotice: (msg: string | null) => void;

  // slide ops
  move: (id: string, dir: -1 | 1) => void;
  moveTo: (id: string, toIndex: number) => void;
  toggleHidden: (id: string) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  setTitle: (id: string, title: string) => void;
  setNotes: (id: string, notes: string) => void;

  // overlay ops
  addTextOverlay: (slideId: string) => void;
  addImageOverlay: (slideId: string) => Promise<void>;
  updateOverlay: (slideId: string, overlayId: string, patch: Partial<Overlay>) => void;
  removeOverlay: (slideId: string, overlayId: string) => void;

  // presentation
  buildPayload: (startIndex: number) => import('@shared/types').PresentationPayload;
}

function replaceSlide(doc: ProjectDoc, id: string, fn: (s: Slide) => Slide): ProjectDoc {
  return { ...doc, slides: doc.slides.map((s) => (s.id === id ? fn(s) : s)) };
}

export const useProject = create<ProjectState>((set, get) => ({
  doc: emptyDoc(),
  selectedId: null,
  selectedOverlayId: null,
  dirty: false,
  busy: { active: false, label: '' },
  error: null,
  notice: null,

  select: (id) => set({ selectedId: id, selectedOverlayId: null }),
  selectOverlay: (id) => set({ selectedOverlayId: id }),
  setError: (msg) => set({ error: msg }),
  setNotice: (msg) => set({ notice: msg }),

  importDocs: async () => {
    const files = await window.jmpr.files.importDocs();
    if (files.length) await get().ingestImportedFiles(files, false);
  },

  ingestImportedFiles: async (files, replace = false) => {
    set({ busy: { active: true, label: replace ? 'Lade Präsentation…' : 'Importiere…' }, error: null });
    try {
      // replace = frisches Deck: alte Quellen-Caches leeren (wie newProject).
      if (replace) {
        clearPdfCaches();
        clearAssets();
      }
      const baseDoc = replace ? emptyDoc() : get().doc;
      const newSources: SourceMeta[] = [];
      const newSlides: Slide[] = [];
      for (const f of files) {
        const sourceId = uid('src');
        const base = stripExt(f.name);
        if (f.kind === 'pdf') {
          const count = await pdfPageCount(sourceId, f.bytes);
          newSources.push({ id: sourceId, kind: 'pdf', name: f.name, pageCount: count });
          for (let p = 0; p < count; p += 1) {
            newSlides.push(makeSlide(sourceId, p, count > 1 ? `${base} ${p + 1}` : base));
          }
        } else {
          putSource(sourceId, 'image', f.bytes);
          newSources.push({ id: sourceId, kind: 'image', name: f.name, pageCount: 1 });
          newSlides.push(makeSlide(sourceId, 0, base));
        }
      }
      const merged: ProjectDoc = {
        ...baseDoc,
        sources: [...baseDoc.sources, ...newSources],
        slides: [...baseDoc.slides, ...newSlides],
      };
      set({
        doc: merged,
        dirty: true,
        selectedId: replace ? (newSlides[0]?.id ?? null) : (get().selectedId ?? newSlides[0]?.id ?? null),
        selectedOverlayId: replace ? null : get().selectedOverlayId,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ busy: { active: false, label: '' } });
    }
  },

  importOffice: async () => {
    set({ busy: { active: true, label: 'Konvertiere mit LibreOffice…' }, error: null, notice: null });
    try {
      const res = await window.jmpr.files.importOffice(getExpandPptxBuilds());
      if (!res.ok || !res.bytes) {
        if (res.error && res.error !== 'Abgebrochen.') set({ error: res.error });
        return;
      }
      const sourceId = uid('src');
      const base = stripExt(res.name ?? 'Dokument');
      const count = await pdfPageCount(sourceId, res.bytes);
      const doc = get().doc;
      const newSlides: Slide[] = [];
      // Map the original deck's on-click builds onto the flattened slides. The
      // mapping is 1 PDF page per PPTX slide, so only annotate when the counts
      // line up — otherwise we'd risk tagging the wrong slide.
      const anim = res.animations;
      const builds = anim && anim.perSlide.length === count ? anim.perSlide : null;
      for (let p = 0; p < count; p += 1) {
        const slide = makeSlide(sourceId, p, count > 1 ? `${base} ${p + 1}` : base);
        if (builds && builds[p] > 0) {
          slide.notes = `▸ Original-Animation: ${builds[p]} Aufbau-Klick(s) auf dieser Folie.`;
        }
        newSlides.push(slide);
      }
      set({
        doc: {
          ...doc,
          sources: [...doc.sources, { id: sourceId, kind: 'pdf', name: base, pageCount: count }],
          slides: [...doc.slides, ...newSlides],
        },
        dirty: true,
        selectedId: get().selectedId ?? newSlides[0]?.id ?? null,
        notice: res.expanded
          ? `Aufbau-Animationen als Einzelschritte importiert — ${count} Schritt-Folien (experimentell).`
          : anim && anim.animatedSlides > 0
            ? `${anim.animatedSlides} Folie(n) hatten Aufbau-Animationen (${anim.totalBuilds} Klicks) — als Notiz vermerkt.`
            : null,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ busy: { active: false, label: '' } });
    }
  },

  newProject: () => {
    // Frischer Start ohne App-Neustart (Issue #40): Caches der alten Quellen
    // leeren, damit über mehrere Neu+Import-Zyklen kein Speicher zurückbleibt.
    clearPdfCaches();
    clearAssets();
    set({ doc: emptyDoc(), selectedId: null, selectedOverlayId: null, dirty: false });
  },

  openProjectFromBytes: (bytes) => {
    set({ busy: { active: true, label: 'Öffne Projekt…' }, error: null });
    try {
      const doc = deserializeProject(bytes);
      set({
        doc,
        selectedId: doc.slides[0]?.id ?? null,
        selectedOverlayId: null,
        dirty: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ busy: { active: false, label: '' } });
    }
  },

  openProject: async () => {
    const opened = await window.jmpr.files.openProject();
    if (!opened) return;
    get().openProjectFromBytes(opened.bytes);
  },

  saveProject: async () => {
    const doc = get().doc;
    set({ busy: { active: true, label: 'Speichere…' }, error: null });
    try {
      const bytes = serializeProject(doc);
      const saved = await window.jmpr.files.saveProject(doc.name, bytes);
      if (saved) set({ dirty: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ busy: { active: false, label: '' } });
    }
  },

  exportPdf: async () => {
    const doc = get().doc;
    set({ busy: { active: true, label: 'Exportiere PDF…' }, error: null });
    try {
      const bytes = await exportSlidesToPdf(doc.slides);
      await window.jmpr.files.savePdf(doc.name, bytes);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ busy: { active: false, label: '' } });
    }
  },

  move: (id, dir) => {
    const slides = [...get().doc.slides];
    const i = slides.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= slides.length) return;
    [slides[i], slides[j]] = [slides[j], slides[i]];
    set({ doc: { ...get().doc, slides }, dirty: true });
  },

  moveTo: (id, toIndex) => {
    const slides = [...get().doc.slides];
    const from = slides.findIndex((s) => s.id === id);
    if (from < 0) return;
    const [moved] = slides.splice(from, 1);
    const clamped = Math.max(0, Math.min(toIndex, slides.length));
    slides.splice(clamped, 0, moved);
    set({ doc: { ...get().doc, slides }, dirty: true });
  },

  toggleHidden: (id) =>
    set({ doc: replaceSlide(get().doc, id, (s) => ({ ...s, hidden: !s.hidden })), dirty: true }),

  duplicate: (id) => {
    const slides = [...get().doc.slides];
    const i = slides.findIndex((s) => s.id === id);
    if (i < 0) return;
    const src = slides[i];
    const copy: Slide = {
      ...src,
      id: uid('slide'),
      title: `${src.title} (Kopie)`,
      overlays: src.overlays.map((o) => ({ ...o, id: uid('ov') })),
    };
    slides.splice(i + 1, 0, copy);
    set({ doc: { ...get().doc, slides }, dirty: true, selectedId: copy.id });
  },

  remove: (id) => {
    const slides = get().doc.slides.filter((s) => s.id !== id);
    const sel = get().selectedId === id ? (slides[0]?.id ?? null) : get().selectedId;
    set({ doc: { ...get().doc, slides }, dirty: true, selectedId: sel });
  },

  setTitle: (id, title) =>
    set({ doc: replaceSlide(get().doc, id, (s) => ({ ...s, title })), dirty: true }),
  setNotes: (id, notes) =>
    set({ doc: replaceSlide(get().doc, id, (s) => ({ ...s, notes })), dirty: true }),

  addTextOverlay: (slideId) => {
    const overlay: Overlay = {
      id: uid('ov'),
      kind: 'text',
      x: 0.08,
      y: 0.72,
      w: 0.84,
      h: 0.18,
      rotation: 0,
      text: 'Text',
      fontFrac: 0.07,
      color: '#ffffff',
      bold: true,
      align: 'left',
      background: 'rgba(10,10,12,0.72)',
    };
    set({
      doc: replaceSlide(get().doc, slideId, (s) => ({ ...s, overlays: [...s.overlays, overlay] })),
      dirty: true,
      selectedOverlayId: overlay.id,
    });
  },

  addImageOverlay: async (slideId) => {
    const file = await window.jmpr.files.importImage();
    if (!file) return;
    const imageId = uid('img');
    putImage(imageId, file.bytes);
    const overlay: Overlay = {
      id: uid('ov'),
      kind: 'image',
      x: 0.72,
      y: 0.06,
      w: 0.22,
      h: 0.14,
      rotation: 0,
      imageId,
    };
    set({
      doc: replaceSlide(get().doc, slideId, (s) => ({ ...s, overlays: [...s.overlays, overlay] })),
      dirty: true,
      selectedOverlayId: overlay.id,
    });
  },

  updateOverlay: (slideId, overlayId, patch) =>
    set({
      doc: replaceSlide(get().doc, slideId, (s) => ({
        ...s,
        overlays: s.overlays.map((o) => (o.id === overlayId ? { ...o, ...patch } : o)),
      })),
      dirty: true,
    }),

  removeOverlay: (slideId, overlayId) =>
    set({
      doc: replaceSlide(get().doc, slideId, (s) => ({
        ...s,
        overlays: s.overlays.filter((o) => o.id !== overlayId),
      })),
      dirty: true,
      selectedOverlayId: null,
    }),

  buildPayload: (startIndex) => {
    const doc = get().doc;
    const visible = doc.slides.filter((s) => !s.hidden);
    const sources: Record<string, { kind: 'pdf' | 'image'; bytes: Uint8Array }> = {};
    const images: Record<string, Uint8Array> = {};
    for (const s of visible) {
      if (!sources[s.sourceId]) {
        const entry = getSource(s.sourceId);
        if (entry) sources[s.sourceId] = { kind: entry.kind, bytes: entry.bytes };
      }
      for (const o of s.overlays) {
        if (o.kind === 'image' && o.imageId && !images[o.imageId]) {
          const bytes = getImageBytes(o.imageId);
          if (bytes) images[o.imageId] = bytes;
        }
      }
    }
    return { slides: visible, sources, images, startIndex };
  },
}));
