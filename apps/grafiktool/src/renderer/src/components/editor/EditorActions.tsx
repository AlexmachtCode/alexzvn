import { useState } from 'react';
import { useEditor } from '@/store/editor';
import { DOC_PRESETS } from '@/engine/io/safeArea';
import { psdToDoc, docToPsdBytes } from '@/engine/io/psd';
import { jmgToDoc, docToJmgBytes } from '@/engine/io/project';
import { docToTitlerBundle } from '@/engine/io/titlerBundle';
import { loadSvg, tiffToCanvas, decodeToBitmap } from '@/engine/io/importImage';
import type { EditorController } from '@/engine/render/EditorController';
import type { ImageFormat } from '@shared/types';
import { Button } from '@jm/ui';
import { Icon } from './Icons';
import { cn } from '@jm/ui';

type ExportFormat = ImageFormat | 'psd';

/** Load picked image bytes as a new layer in the document. */
export async function importBytesAsLayer(
  controller: EditorController,
  bytes: Uint8Array,
  name: string,
): Promise<void> {
  const bitmap = await decodeToBitmap(bytes);
  controller.addImageLayer(bitmap, name);
  bitmap.close();
}

function ext(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

export function EditorActions() {
  const controller = useEditor((s) => s.controller);
  const canUndo = useEditor((s) => s.canUndo);
  const canRedo = useEditor((s) => s.canRedo);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [busy, setBusy] = useState(false);

  if (!controller) return null;

  const run = async (fn: () => Promise<void>) => {
    if (!window.jmg) return;
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      console.error(err);
      alert(`Aktion fehlgeschlagen: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const onNew = (id: string) => {
    const preset = DOC_PRESETS.find((p) => p.id === id);
    if (preset) controller.newDocument(preset.width, preset.height);
  };

  const onOpen = () =>
    run(async () => {
      const f = await window.jmg.file.open('all');
      if (!f) return;
      const e = ext(f.fileName);
      if (e === 'psd') {
        controller.setDocument(psdToDoc(f.bytes));
      } else if (e === 'jmg') {
        controller.setDocument(await jmgToDoc(f.bytes));
      } else if (e === 'svg') {
        controller.addImageLayer(await loadSvg(f.bytes), f.fileName);
      } else if (e === 'tif' || e === 'tiff') {
        controller.addImageLayer(tiffToCanvas(f.bytes), f.fileName);
      } else {
        await importBytesAsLayer(controller, f.bytes, f.fileName);
      }
    });

  const onImport = () =>
    run(async () => {
      const picked = await window.jmg.dialog.pickImages();
      for (const p of picked) await importBytesAsLayer(controller, p.bytes, p.fileName);
    });

  const onSaveProject = () =>
    run(async () => {
      const bytes = await docToJmgBytes(controller.doc);
      await window.jmg.file.saveBytes({
        suggestedName: 'projekt',
        ext: 'jmg',
        filterName: 'JM Grafik-Projekt',
        bytes,
      });
    });

  // Bauchbinde als .jmtitler-Vorlage für den JM Titler exportieren (#162):
  // Nicht-Text-Ebenen → Hintergrund-PNG, Text-Ebenen → variablen-fähige Slots.
  const onSendToTitler = () =>
    run(async () => {
      const bytes = await docToTitlerBundle(controller.doc, 'Bauchbinde');
      await window.jmg.file.saveBytes({
        suggestedName: 'bauchbinde',
        ext: 'jmtitler',
        filterName: 'JM Titler-Vorlage',
        bytes,
      });
    });

  const onExport = () =>
    run(async () => {
      if (format === 'psd') {
        const bytes = docToPsdBytes(controller.doc, controller.flattenForExport());
        await window.jmg.file.saveBytes({ suggestedName: 'grafik', ext: 'psd', filterName: 'Photoshop', bytes });
      } else {
        const bytes = await controller.exportBytes(format);
        await window.jmg.file.saveImage({ suggestedName: 'grafik', format, bytes });
      }
    });

  return (
    <div className="flex items-center gap-2">
      <select
        value=""
        onChange={(e) => {
          onNew(e.target.value);
          e.target.value = '';
        }}
        title="Neues Dokument"
        className="h-8 px-2 rounded-[var(--radius)] text-[12px] bg-[var(--input)] border border-[var(--border)] text-[var(--foreground)]"
      >
        <option value="" disabled>
          Neu…
        </option>
        {DOC_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>

      <Button size="sm" variant="outline" uppercase={false} onClick={onOpen} disabled={busy}>
        Öffnen
      </Button>

      <div className="flex items-center gap-1">
        <IconBtn title="Rückgängig (Strg+Z)" disabled={!canUndo} onClick={() => controller.undo()}>
          <Icon.undo />
        </IconBtn>
        <IconBtn title="Wiederholen (Strg+Y)" disabled={!canRedo} onClick={() => controller.redo()}>
          <Icon.redo />
        </IconBtn>
      </div>

      <Button size="sm" variant="ghost" uppercase={false} onClick={onImport} disabled={busy}>
        Bild platzieren
      </Button>

      <Button size="sm" variant="outline" uppercase={false} onClick={onSaveProject} disabled={busy}>
        Speichern
      </Button>

      <Button
        size="sm"
        variant="ghost"
        uppercase={false}
        onClick={onSendToTitler}
        disabled={busy}
        title="Als .jmtitler-Vorlage für den JM Titler exportieren (Textebenen werden zu Variablen-Feldern)"
      >
        An Titler senden
      </Button>

      <div className="flex items-center">
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as ExportFormat)}
          className="h-8 px-1.5 rounded-l-[var(--radius)] text-[12px] bg-[var(--input)] border border-[var(--border)] border-r-0 text-[var(--foreground)]"
        >
          <option value="png">PNG</option>
          <option value="jpg">JPG</option>
          <option value="webp">WebP</option>
          <option value="psd">PSD</option>
        </select>
        <Button size="sm" variant="primary" uppercase={false} onClick={onExport} disabled={busy} className="rounded-l-none">
          Export
        </Button>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-8 h-8 grid place-items-center rounded-[var(--radius)] border border-[var(--border)]',
        'text-[var(--foreground)]/80 hover:bg-[var(--highlight)] disabled:opacity-30 disabled:cursor-not-allowed',
      )}
    >
      {children}
    </button>
  );
}
