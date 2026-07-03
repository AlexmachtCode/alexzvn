import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, cn } from '@jm/ui';
import { DEFAULT_CONFIG, type GraphicTemplate } from '@shared/types';
import { drawCg } from '@/lib/cg';
import { encodeCanvasPng, makeThumbPng, type ParsedTemplate } from '@/lib/psd-import';

interface Props {
  /** Frisch importierte Vorlage (aus .psd oder .jmtitler). */
  parsed: { name: string; template: ParsedTemplate };
  /** Nach dem Speichern: die gespeicherte Library-Vorlage. */
  onSaved: (tpl: GraphicTemplate) => void;
  onCancel: () => void;
}

/**
 * Import-Dialog (#162): Name vergeben, Text-Slots → Variablen/Literale zuordnen
 * (vorbelegt aus dem Auto-Mapping), Live-Vorschau, dann in die Library speichern.
 */
export function ImportDialog({ parsed, onSaved, onCancel }: Props): React.JSX.Element {
  const { template } = parsed;
  const [name, setName] = useState(parsed.name);
  const [saving, setSaving] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const s of template.slots) o[s.key] = s.defaultText;
    return o;
  });
  const previewRef = useRef<HTMLCanvasElement>(null);

  // Transiente Vorlage für die Vorschau (noch keine Library-ID).
  const tpl: GraphicTemplate = useMemo(
    () => ({ id: '', name, width: template.width, height: template.height, slots: template.slots, createdAt: 0 }),
    [name, template],
  );

  // Live-Vorschau: Hintergrund + Slot-Texte (Platzhalter werden literal angezeigt).
  useEffect(() => {
    const cv = previewRef.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    drawCg(ctx, cv.width, cv.height, { ...DEFAULT_CONFIG, template: 'graphic' }, 1, 0, {
      gfx: { tpl, bg: template.background, slotText: overrides },
    });
  }, [tpl, overrides, template.background]);

  const save = async (): Promise<void> => {
    setSaving(true);
    try {
      const slots = template.slots.map((s) => ({ ...s, defaultText: overrides[s.key] ?? s.defaultText }));
      const [pngBytes, thumbBytes] = await Promise.all([
        encodeCanvasPng(template.background),
        makeThumbPng(template.background),
      ]);
      const saved = await window.jmtitler.tpl.add({
        name: name.trim() || 'Bauchbinde',
        width: template.width,
        height: template.height,
        slots,
        pngBytes,
        thumbBytes,
      });
      onSaved(saved);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6" onClick={onCancel}>
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 h-14 border-b border-[var(--border)]/60">
          <span className="text-sm font-extrabold tracking-[0.06em]">Bauchbinde importieren</span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            {template.width}×{template.height} · {template.slots.length} Textfeld(er)
          </span>
          <button
            onClick={onCancel}
            className="ml-auto h-8 w-8 grid place-items-center rounded hover:bg-[var(--highlight)]"
            title="Abbrechen"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="cg-checker rounded-[var(--radius)] border border-[var(--border)] overflow-hidden grid place-items-center">
            <canvas
              ref={previewRef}
              width={template.width}
              height={template.height}
              className="w-full h-auto object-contain"
            />
          </div>

          <label className="block">
            <div className="text-sm font-semibold mb-1">Name der Vorlage</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
            />
          </label>

          {template.slots.length === 0 ? (
            <p className="text-[11px] text-[var(--muted-foreground)]">
              Keine Textebenen gefunden — die Vorlage wird als reines Standbild importiert.
            </p>
          ) : (
            <div className="space-y-2.5">
              <h3 className="text-[10px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)]">
                Textfelder → Variablen
              </h3>
              <p className="text-[11px] text-[var(--muted-foreground)] -mt-1">
                Platzhalter wie <code className="text-[var(--primary)]">{'{{name}}'}</code> werden später aus DataLink
                gefüllt. Feste Texte bleiben stehen.
              </p>
              {template.slots.map((s) => (
                <label key={s.key} className="block">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-semibold">{s.label}</span>
                    <code className="text-[10px] text-[var(--muted-foreground)]">{s.key}</code>
                  </div>
                  <input
                    value={overrides[s.key] ?? ''}
                    onChange={(e) => setOverrides((o) => ({ ...o, [s.key]: e.target.value }))}
                    spellCheck={false}
                    className="h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-5 h-16 border-t border-[var(--border)]/60">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Abbrechen
          </Button>
          <Button
            variant="primary"
            className={cn('ml-auto', saving && 'opacity-70')}
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? 'Speichere…' : 'In Library speichern'}
          </Button>
        </div>
      </div>
    </div>
  );
}
