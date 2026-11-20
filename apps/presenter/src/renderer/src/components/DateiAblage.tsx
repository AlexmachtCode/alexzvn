import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { cn } from '@jm/ui';
import type { AbgelegteDateien } from '@shared/types';
import { hinweisOhnePfad } from '../../../shared/dateien';
import { useProject } from '@/store/project';
import { getExpandPptxBuilds } from '@/lib/settings';

/** Nur echtes Datei-Ziehen zählt; Folien umsortieren (SlideList) bringt keine `Files` mit. */
function bringtDateien(e: DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes('Files');
}

/** Abgelegte Dateien im Hauptprozess laden und hinten anhängen (#298). Fehler landen in der Fehlerzeile. */
async function legeAb(dateien: File[]): Promise<void> {
  try {
    if (!dateien.length) return;
    const { busy, setNotice } = useProject.getState();
    if (busy.active) {
      setNotice('Import läuft noch – bitte danach erneut ablegen.');
      return;
    }
    useProject.setState({ busy: { active: true, label: 'Lade Dateien…' }, error: null, notice: null });
    let geladen: AbgelegteDateien;
    try {
      geladen = await window.jmpr.files.importiereAbgelegte(dateien, getExpandPptxBuilds());
    } finally {
      useProject.setState({ busy: { active: false, label: '' } });
    }
    const { ohnePfad, ...g } = geladen;
    const ohne = hinweisOhnePfad(ohnePfad);
    await useProject.getState().oeffneGeladene({ ...g, hinweise: ohne ? [ohne, ...g.hinweise] : g.hinweise }, 'anhaengen');
  } catch (err) {
    useProject.setState({ error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Macht das ganze Editor-Fenster zur Ablage für Dateien aus dem Explorer/Finder.
 * Ohne sie würde ein Ablegen schlicht nichts tun.
 */
export function DateiAblage({ className, children }: { className?: string; children: ReactNode }) {
  const [zeigen, setZeigen] = useState(false);
  // dragenter/dragleave feuern an jedem Kind: mitzählen statt beim ersten dragleave verstecken.
  const tiefe = useRef(0);

  const onDragEnter = (e: DragEvent) => {
    if (!bringtDateien(e)) return;
    e.preventDefault();
    tiefe.current += 1;
    setZeigen(true);
  };
  const onDragOver = (e: DragEvent) => {
    if (!bringtDateien(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onDragLeave = (e: DragEvent) => {
    if (!bringtDateien(e)) return;
    tiefe.current = Math.max(0, tiefe.current - 1);
    if (tiefe.current === 0) setZeigen(false);
  };
  const onDrop = (e: DragEvent) => {
    if (!bringtDateien(e)) return;
    e.preventDefault();
    tiefe.current = 0;
    setZeigen(false);
    void legeAb(Array.from(e.dataTransfer.files));
  };

  return (
    <div
      className={cn('relative', className)}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
      {/* Fängt das Ablegen bewusst selbst (kein pointer-events-none): Dateien landen so nie
          im Umsortier-Ziehen der Folienliste. */}
      {zeigen && (
        <div className="absolute inset-0 z-40 p-4 bg-[var(--background)]/70">
          <div className="h-full grid place-items-center rounded-xl border-2 border-dashed border-[var(--primary)] bg-[var(--primary)]/5">
            <div className="text-center">
              <div className="text-3xl font-extrabold">Dateien hier ablegen</div>
              <div className="mt-2 text-sm text-[var(--muted-foreground)]">PDF, Bilder, PowerPoint</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
