import { useEffect, useState } from 'react';
import { Badge, Button, Modal } from '@jm/ui';
import type { DisplayInfo, TemplateInfo } from '@shared/types';
import { useEditor } from '../store';
import { packProject, unpackProject } from '../io/jmapp';

/** Ab hier warnen wir vor der Bundle-Größe — Videos sind der übliche Ausreißer. */
const SIZE_WARN_MB = 50;

export function Toolbar(): JSX.Element {
  const doc = useEditor((s) => s.doc);
  const assets = useEditor((s) => s.assets);
  const path = useEditor((s) => s.path);
  const dirty = useEditor((s) => s.dirty);
  const loadDoc = useEditor((s) => s.loadDoc);
  const markSaved = useEditor((s) => s.markSaved);
  const addAssets = useEditor((s) => s.addAssets);

  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [showKiosk, setShowKiosk] = useState(false);
  const [kioskOpen, setKioskOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void window.jmapp.listTemplates().then(setTemplates);
    void window.jmapp.isKioskOpen().then(setKioskOpen);
  }, []);

  const flash = (msg: string): void => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 4000);
  };

  const onNew = async (id: string): Promise<void> => {
    const next = await window.jmapp.loadTemplate(id);
    // Vorlagen bringen keine Medien mit — sonst wären sie keine Vorlagen.
    loadDoc(next, [], null);
    setShowTemplates(false);
  };

  const onOpen = async (): Promise<void> => {
    const opened = await window.jmapp.openProject();
    if (!opened) return;
    try {
      const { doc: next, assets: nextAssets } = unpackProject(opened.zipBytes);
      loadDoc(next, nextAssets, opened.path);
    } catch (err) {
      flash(`Öffnen fehlgeschlagen: ${(err as Error).message}`);
    }
  };

  const onSave = async (as: boolean): Promise<void> => {
    const bytes = packProject(doc, assets);
    const r = as ? await window.jmapp.saveProjectAs(bytes) : await window.jmapp.saveProject(bytes, path);
    if (r.canceled || !r.path) return;
    markSaved(r.path);
    flash(`Gespeichert: ${r.path}`);
  };

  const onImport = async (): Promise<void> => {
    const blobs = await window.jmapp.importAsset();
    if (blobs.length) addAssets(blobs);
  };

  const onExport = async (): Promise<void> => {
    const r = await window.jmapp.exportBundle(doc, assets);
    if (r.canceled || !r.dir) return;
    const mb = r.bytes / (1024 * 1024);
    const warn = mb > SIZE_WARN_MB ? ` — Achtung: ${mb.toFixed(1)} MB, für Web recht groß` : '';
    flash(`Bundle exportiert (${mb.toFixed(1)} MB)${warn}`);
    void window.jmapp.revealPath(`${r.dir}/index.html`);
  };

  const onKiosk = async (displayId: number | null): Promise<void> => {
    await window.jmapp.publish(doc, assets);
    await window.jmapp.openKiosk(displayId);
    setKioskOpen(true);
    setShowKiosk(false);
  };

  const openKioskDialog = async (): Promise<void> => {
    setDisplays(await window.jmapp.listDisplays());
    setShowKiosk(true);
  };

  return (
    <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
      <Button size="sm" variant="outline" uppercase={false} onClick={() => setShowTemplates(true)}>
        Neu aus Vorlage
      </Button>
      <Button size="sm" variant="outline" uppercase={false} onClick={() => void onOpen()}>
        Öffnen
      </Button>
      <Button size="sm" variant="outline" uppercase={false} onClick={() => void onSave(false)}>
        Speichern
      </Button>
      <Button size="sm" variant="ghost" uppercase={false} onClick={() => void onSave(true)}>
        Speichern unter…
      </Button>

      <span className="mx-2 h-5 w-px bg-[var(--border)]" />

      <Button size="sm" variant="ghost" uppercase={false} onClick={() => void onImport()}>
        Medien importieren
      </Button>

      <span className="flex-1" />

      <span className="truncate text-xs text-[var(--muted-foreground)]">
        {doc.name}
        {dirty && ' •'}
      </span>
      {kioskOpen && <Badge tone="success">Terminal läuft</Badge>}

      <Button size="sm" variant="outline" uppercase={false} onClick={() => void openKioskDialog()}>
        Auf Terminal starten
      </Button>
      {kioskOpen && (
        <Button
          size="sm"
          variant="ghost"
          uppercase={false}
          onClick={() => {
            void window.jmapp.closeKiosk();
            setKioskOpen(false);
          }}
        >
          Beenden
        </Button>
      )}
      <Button size="sm" variant="primary" uppercase={false} onClick={() => void onExport()}>
        Exportieren
      </Button>

      {status && (
        <div className="absolute bottom-3 left-1/2 z-50 -translate-x-1/2 rounded bg-[var(--card,#1c1c1c)] px-4 py-2 text-sm shadow-lg ring-1 ring-[var(--border)]">
          {status}
        </div>
      )}

      {showTemplates && (
        <Modal onClose={() => setShowTemplates(false)} title="Neue App aus Vorlage">
          <div className="space-y-2">
            {templates.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)]">Keine Vorlagen gefunden.</p>
            )}
            {templates.map((t) => (
              <button
                key={t.id}
                className="w-full rounded border border-[var(--border)] p-3 text-left hover:bg-[var(--muted)]"
                onClick={() => void onNew(t.id)}
              >
                <div className="font-semibold">{t.name}</div>
                <div className="text-sm text-[var(--muted-foreground)]">{t.description}</div>
              </button>
            ))}
            {dirty && (
              <p className="pt-2 text-xs text-[#f5a524]">
                Die aktuelle App hat ungespeicherte Änderungen — sie gehen verloren.
              </p>
            )}
          </div>
        </Modal>
      )}

      {showKiosk && (
        <Modal onClose={() => setShowKiosk(false)} title="Auf welchem Bildschirm?">
          <div className="space-y-2">
            <p className="text-sm text-[var(--muted-foreground)]">
              Das Terminal zeigt exakt das, was der Export erzeugt.
            </p>
            {displays.map((d) => (
              <button
                key={d.id}
                className="w-full rounded border border-[var(--border)] p-3 text-left hover:bg-[var(--muted)]"
                onClick={() => void onKiosk(d.id)}
              >
                <div className="font-semibold">
                  {d.label} {d.primary && <span className="text-xs text-[var(--muted-foreground)]">(primär)</span>}
                </div>
                <div className="text-sm text-[var(--muted-foreground)]">
                  {d.width}×{d.height}
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
