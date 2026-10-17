import { useEffect, useMemo, useRef, useState } from 'react';
import { AppShell, useBrueckenWert } from '@jm/ui';
import { DEFAULT_CONFIG, type DisplayInfo, type GraphicTemplate, type TitlerConfig } from '@shared/types';
import { resolveConfigVars } from '@shared/vars';
import { useTitler } from '@/store/titler';
import { useTitlerEngine } from '@/lib/engine';
import { activeGraphic } from '@/lib/graphic';
import { encodeCanvasPng, importFileToTemplate, makeThumbPng, type ParsedTemplate } from '@/lib/psd-import';
import { MASTER_LINK_QUELLE, VERBUND_QUELLE } from '@/lib/bruecken';
import { statusLeiste, type OberflaechenStand, type TitlerAktionen } from '@/lib/oberflaeche';
import { Bedienung } from './Bedienung';
import { Einstellungen } from './Einstellungen';
import { ImportDialog } from './ImportDialog';
import { VerbundZeile } from './KopfMitte';
import { LiveBereich } from './LiveBereich';

export function OperatorView(): React.JSX.Element {
  const state = useTitler((s) => s.state);
  const setConfig = useTitler((s) => s.setConfig);
  const startNdi = useTitler((s) => s.startNdi);
  const stopNdi = useTitler((s) => s.stopNdi);
  const templates = useTitler((s) => s.templates);

  const config: TitlerConfig = state?.config ?? DEFAULT_CONFIG;
  const ndiActive = state?.status.ndiActive ?? false;
  const connections = state?.status.connections ?? 0;
  const variables = state?.status.variables ?? {};
  const entries = state?.status.entries ?? [];
  const activeEntry = state?.status.activeEntry ?? -1;

  const previewRef = useRef<HTMLCanvasElement>(null);
  // Zum Zeichnen werden {{variablen}} aufgelöst; die Eingabefelder zeigen weiter
  // die Vorlage (siehe @shared/vars).
  const resolved = useMemo(() => resolveConfigVars(config, variables), [config, variables]);
  const graphic = useMemo(() => activeGraphic(config, templates, variables), [config, templates, variables]);
  const { live, take, clear } = useTitlerEngine(resolved, ndiActive, previewRef, { graphic });

  // Import-Dialog (#162): frisch geparste Vorlage, bis gespeichert/abgebrochen.
  const [importParsed, setImportParsed] = useState<{ name: string; template: ParsedTemplate } | null>(null);

  const runImport = async (fileName: string, bytes: Uint8Array): Promise<void> => {
    try {
      setImportParsed(await importFileToTemplate(fileName, bytes));
    } catch (err) {
      // eslint-disable-next-line no-alert
      window.alert(`Import fehlgeschlagen: ${(err as Error).message}`);
    }
  };
  const pickImport = async (): Promise<void> => {
    const f = await window.jmtitler.pickImportFile();
    if (f) await runImport(f.fileName, f.bytes);
  };
  const selectTemplate = (tpl: GraphicTemplate): void =>
    void setConfig({ template: 'graphic', activeGraphicId: tpl.id, slotText: {} });
  const onDropImport = (e: React.DragEvent): void => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const p = window.jmtitler.pathForFile(file);
    void window.jmtitler.readFile(p).then((f) => {
      if (f) void runImport(f.fileName, f.bytes);
    });
  };
  const deleteTemplate = async (tpl: GraphicTemplate): Promise<void> => {
    await window.jmtitler.tpl.remove(tpl.id);
    if (config.activeGraphicId === tpl.id) void setConfig({ activeGraphicId: '' });
  };

  // Show-Integration (C3): per .jmshow referenzierte Bauchbinden-Vorlage
  // automatisch in die Library importieren und als aktive Grafik VORBEREITEN —
  // ohne Slot-Mapping-Dialog, ohne on-air (der Operator drückt bewusst TAKE).
  useEffect(() => {
    return window.jmtitler.onFileOpened(async (f) => {
      try {
        const { name, template } = await importFileToTemplate(f.fileName, f.bytes);
        const [pngBytes, thumbBytes] = await Promise.all([
          encodeCanvasPng(template.background),
          makeThumbPng(template.background),
        ]);
        const saved = await window.jmtitler.tpl.add({
          name: name.trim() || 'Bauchbinde',
          width: template.width,
          height: template.height,
          slots: template.slots,
          pngBytes,
          thumbBytes,
        });
        void setConfig({ template: 'graphic', activeGraphicId: saved.id, slotText: {} });
      } catch (err) {
        // eslint-disable-next-line no-alert
        window.alert(`Show-Vorlage konnte nicht importiert werden: ${(err as Error).message}`);
      }
    });
  }, [setConfig]);

  // ── TCP-Fernsteuerung (Bitfocus Companion) ─────────────────────────────────
  const liveRef = useRef(live);
  liveRef.current = live;

  // Befehle vom Steuerserver ausführen (Take/Clear/Toggle/Template).
  useEffect(() => {
    return window.jmtitler.remote.onCommand((cmd) => {
      switch (cmd.t) {
        case 'take':
          take();
          break;
        case 'clear':
          clear();
          break;
        case 'toggle':
          if (liveRef.current) clear();
          else take();
          break;
        case 'template':
          void setConfig({ template: cmd.kind });
          break;
        case 'text': {
          // Bauchbinden-Text fernsetzen (#93, z. B. Q&A aktiver Sprecher). Bei einer
          // Grafik-Vorlage (#162) auf die ersten beiden Slots abbilden (Name/Untertitel).
          const cfg = useTitler.getState().state?.config;
          const tpl =
            cfg?.template === 'graphic'
              ? useTitler.getState().templates.find((t) => t.id === cfg.activeGraphicId)
              : undefined;
          if (tpl) {
            const patch = { ...cfg!.slotText };
            if (tpl.slots[0]) patch[tpl.slots[0].key] = cmd.name;
            if (tpl.slots[1]) patch[tpl.slots[1].key] = cmd.subtitle;
            void setConfig({ slotText: patch });
          } else {
            void setConfig({ name: cmd.name, subtitle: cmd.subtitle });
          }
          break;
        }
        case 'graphic': {
          // Grafik-Vorlage per ID / Nr. / (Teil-)Name wählen (#162).
          const list = useTitler.getState().templates;
          const ref = cmd.ref.trim().toLowerCase();
          const found =
            list.find((t) => t.id.toLowerCase() === ref) ??
            list.find((_t, i) => String(i + 1) === ref) ??
            list.find((t) => t.name.toLowerCase() === ref) ??
            list.find((t) => t.name.toLowerCase().includes(ref));
          if (found) void setConfig({ template: 'graphic', activeGraphicId: found.id, slotText: {} });
          break;
        }
        case 'slot': {
          // Einzelnen Slot-Text einer Grafik-Vorlage fernsetzen (#162).
          const cur = useTitler.getState().state?.config.slotText ?? {};
          void setConfig({ slotText: { ...cur, [cmd.key]: cmd.text } });
          break;
        }
      }
    });
  }, [take, clear, setConfig]);

  // Live-Zustand an den Steuerserver melden (Companion-STATE).
  useEffect(() => {
    void window.jmtitler.remote.reportState({ onAir: live, template: config.template, ndiActive, connections });
  }, [live, config.template, ndiActive, connections]);

  const pickFolder = async (): Promise<void> => {
    const p = await window.jmtitler.pickDataFolder();
    if (p) void setConfig({ dataFolder: p });
  };

  // Monitore für die Zweitbildschirm-Auswahl (#161) — bei Hot-Plug aktualisieren. undefined = Liste noch nicht
  // geladen oder nicht ladbar: Statusleiste und Panel zeigen dann „unbekannt“, nie eine leere Liste (E8).
  const [displays, setDisplays] = useState<DisplayInfo[] | undefined>(undefined);
  useEffect(() => {
    const refresh = (): void => void window.jmtitler.listDisplays().then(setDisplays, () => setDisplays(undefined));
    refresh();
    return window.jmtitler.onDisplaysChanged(refresh);
  }, []);

  // Einstellungs-Panel (Spec 3.1, 3.6): zu beim Start, nichts gemerkt (E14); offen über ⚙ oder einen Statuseintrag.
  const [panelOffen, setPanelOffen] = useState(false);
  const [panelAbschnitt, setPanelAbschnitt] = useState<string | undefined>(undefined);
  // Lesende Brücken (Spec 3.9, E5): undefined, bis eine Antwort oder ein Ereignis da ist; ohne Preload null.
  const masterLink = useBrueckenWert(MASTER_LINK_QUELLE);
  const verbund = useBrueckenWert(VERBUND_QUELLE);

  if (!state) {
    return <div className="h-screen grid place-items-center text-[var(--muted-foreground)]">Lädt…</div>;
  }
  // Ein Stand für Statusleiste und Panel (lib/oberflaeche.ts, Spec 6.1): beide zeigen dieselbe Ableitung.
  const stand: OberflaechenStand = { config, status: state.status, displays, masterLink };
  // window.jmtitler nur in den Rückrufen, nie beim Rendern (G7).
  const aktionen: TitlerAktionen = {
    setConfig: (patch) => void setConfig(patch),
    startNdi: (name) => void startNdi(name),
    stopNdi: () => void stopNdi(),
    pickFolder: () => void pickFolder(),
    zurueckZumEigenenOrdner: () => void window.jmtitler.zurueckZumEigenenOrdner(),
  };

  return (
    <AppShell
      tool="Titler"
      headerCenter={<VerbundZeile anzeige={verbund} />}
      onAir={{ live }}
      status={statusLeiste(stand)}
      settings={
        <Einstellungen
          stand={stand}
          aktionen={aktionen}
          templates={templates}
          activeGraphicId={config.activeGraphicId}
          onPickImport={() => void pickImport()}
          onDropImport={onDropImport}
          onDeleteTemplate={(tpl) => void deleteTemplate(tpl)}
        />
      }
      settingsOpen={panelOffen}
      settingsSection={panelAbschnitt}
      onSettingsChange={(offen, abschnitt) => {
        setPanelOffen(offen);
        setPanelAbschnitt(abschnitt);
      }}
    >
      <div className="flex h-full min-h-0">
        <LiveBereich
          previewRef={previewRef}
          live={live}
          ndiActive={ndiActive}
          activeEntry={activeEntry}
          anzahl={entries.length}
          onTake={take}
          onClear={clear}
          onSchritt={(delta) => void window.jmtitler.stepEntry(delta)}
        />
        <Bedienung
          config={config}
          status={state.status}
          templates={templates}
          setConfig={(patch) => void setConfig(patch)}
          onSelectTemplate={selectTemplate}
          onOpenBoard={() => void window.jmtitler.openRecall()}
          onRecall={(key) => void window.jmtitler.recallSchluessel(key)}
        />
      </div>

      {importParsed ? (
        <ImportDialog
          parsed={importParsed}
          onCancel={() => setImportParsed(null)}
          onSaved={(tpl) => {
            setImportParsed(null);
            selectTemplate(tpl);
          }}
        />
      ) : null}
    </AppShell>
  );
}
