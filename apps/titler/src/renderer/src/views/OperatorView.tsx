import { useEffect, useMemo, useRef, useState } from 'react';
import { AppShell, Button, cn, Collapsible, SettingsSection, useBrueckenWert } from '@jm/ui';
import {
  DEFAULT_CONFIG,
  type DisplayInfo,
  type GraphicTemplate,
  type TemplateKind,
  type TitlerConfig,
} from '@shared/types';
import { resolveConfigVars, usedVars } from '@shared/vars';
import { useTitler } from '@/store/titler';
import { useTitlerEngine } from '@/lib/engine';
import { activeGraphic } from '@/lib/graphic';
import { navGesperrt, zaehlerText } from '@/lib/datalink-anzeige';
import { encodeCanvasPng, importFileToTemplate, makeThumbPng, type ParsedTemplate } from '@/lib/psd-import';
import { MASTER_LINK_QUELLE, VERBUND_QUELLE } from '@/lib/bruecken';
import { statusLeiste, type OberflaechenStand, type TitlerAktionen } from '@/lib/oberflaeche';
import { ImportDialog } from './ImportDialog';
import { Einstellungen } from './Einstellungen';
import { ColorField, Field, Slider } from './felder';
import { VerbundZeile } from './KopfMitte';

const TEMPLATES: { key: TemplateKind; label: string }[] = [
  { key: 'lowerthird', label: 'Bauchbinde' },
  { key: 'banner', label: 'Banner' },
  { key: 'ticker', label: 'Ticker' },
  { key: 'graphic', label: 'Grafik' },
];

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
  const dataSources = state?.status.dataSources ?? [];
  const dataError = state?.status.dataError;
  const entries = state?.status.entries ?? [];
  const activeEntry = state?.status.activeEntry ?? -1;
  // Master-Link Teil 2b (Spec 7.8): stehender Hinweis H1–H7 und Datenquelle (Q1–Q3, K1).
  const hinweis = state?.status.hinweis;
  const datenQuelle = state?.status.datenQuelle;

  const previewRef = useRef<HTMLCanvasElement>(null);
  // Zum Zeichnen werden {{variablen}} aufgelöst; die Eingabefelder zeigen weiter
  // die Vorlage (siehe @shared/vars).
  const resolved = useMemo(() => resolveConfigVars(config, variables), [config, variables]);
  const graphic = useMemo(() => activeGraphic(config, templates, variables), [config, templates, variables]);
  const { live, take, clear } = useTitlerEngine(resolved, ndiActive, previewRef, { graphic });

  // Import-Dialog (#162): frisch geparste Vorlage, bis gespeichert/abgebrochen.
  const [importParsed, setImportParsed] = useState<{ name: string; template: ParsedTemplate } | null>(null);
  const activeTemplate = templates.find((t) => t.id === config.activeGraphicId);

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

  // Vorhandene Variablen (klein geschrieben) + im Text referenzierte Schlüssel
  // für die Variablen-Sektion (Treffer/Fehler markieren).
  const lowerVars = useMemo(() => {
    const m: Record<string, true> = {};
    for (const k of Object.keys(variables)) m[k.toLowerCase()] = true;
    return m;
  }, [variables]);
  const referenced = useMemo(() => {
    const set = new Set<string>();
    for (const t of [config.name, config.subtitle, config.bannerText, config.tickerText]) {
      for (const k of usedVars(t)) set.add(k);
    }
    return [...set];
  }, [config.name, config.subtitle, config.bannerText, config.tickerText]);

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
  const c = config;

  // Weiter/Zurück: gesperrt nur an den Rändern; ohne aktiven Eintrag beide frei (Spec 7.4).
  const nav = navGesperrt(activeEntry, entries.length);
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
      settings={<Einstellungen stand={stand} aktionen={aktionen} />}
      settingsOpen={panelOffen}
      settingsSection={panelAbschnitt}
      onSettingsChange={(offen, abschnitt) => {
        setPanelOffen(offen);
        setPanelAbschnitt(abschnitt);
      }}
    >
      <div className="flex h-full min-h-0">
        {/* Programm-Vorschau + Take/Clear */}
        <div className="flex-1 min-w-0 flex flex-col p-5 gap-4">
          <div className="cg-checker flex-1 min-h-0 rounded-[var(--radius-lg)] border border-[var(--border)] overflow-hidden grid place-items-center">
            <canvas ref={previewRef} width={960} height={540} className="w-full h-full object-contain" />
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="lg"
              className={cn('flex-1', live && 'ring-2 ring-[var(--primary)]')}
              onClick={take}
            >
              ● Take (On Air)
            </Button>
            <Button variant="outline" size="lg" className="flex-1" onClick={clear}>
              Clear
            </Button>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] -mt-1">
            {ndiActive
              ? 'NDI-Quelle aktiv — in TriCaster/vMix/OBS als Eingang über das vorhandene Programm legen (Alpha/Key).'
              : 'NDI rechts starten, damit die transparente Quelle im Netz erscheint. Vorschau läuft auch ohne NDI.'}
          </p>
        </div>

        {/* Steuerpult (#165): die Bedienung; die Einstellungen stehen im Panel (⚙ oder Statuseintrag, E14). */}
        <div className="w-[400px] shrink-0 overflow-auto border-l border-[var(--border)]/60">
          <div className="p-5 space-y-4">
              <div className="space-y-5">
                {/* Vorlage */}
                <SettingsSection title="Vorlage">
                  <div className="flex gap-2">
                    {TEMPLATES.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => void setConfig({ template: t.key })}
                        className={cn(
                          'flex-1 h-9 rounded-[var(--radius)] text-xs font-extrabold uppercase tracking-wide border',
                          c.template === t.key
                            ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent'
                            : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--highlight)]',
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </SettingsSection>

                {/* Inhalt — Namensfeld: immer sichtbar, nicht ausklappbar (#165) */}
                <SettingsSection title="Inhalt">
                  {c.template === 'lowerthird' && (
                    <>
                      <Field label="Name" value={c.name} onChange={(v) => void setConfig({ name: v })} />
                      <Field label="Untertitel" value={c.subtitle} onChange={(v) => void setConfig({ subtitle: v })} />
                    </>
                  )}
                  {c.template === 'banner' && (
                    <Field label="Banner-Text" value={c.bannerText} onChange={(v) => void setConfig({ bannerText: v })} />
                  )}
                  {c.template === 'ticker' && (
                    <>
                      <Field label="Ticker-Text" value={c.tickerText} onChange={(v) => void setConfig({ tickerText: v })} />
                      <Slider
                        label="Ticker-Tempo"
                        value={c.tickerSpeed}
                        min={0.02}
                        max={0.3}
                        step={0.01}
                        onChange={(v) => void setConfig({ tickerSpeed: v })}
                      />
                    </>
                  )}
                  {c.template === 'graphic' &&
                    (activeTemplate ? (
                      activeTemplate.slots.length === 0 ? (
                        <p className="text-[11px] text-[var(--muted-foreground)]">
                          Diese Vorlage hat keine Textfelder (reines Standbild).
                        </p>
                      ) : (
                        activeTemplate.slots.map((s) => (
                          <Field
                            key={s.key}
                            label={s.label}
                            value={c.slotText[s.key] ?? s.defaultText}
                            onChange={(v) => void setConfig({ slotText: { ...c.slotText, [s.key]: v } })}
                          />
                        ))
                      )
                    ) : (
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        Keine Grafik-Vorlage gewählt — unter „Grafik-Vorlagen" importieren oder auswählen.
                      </p>
                    ))}
                </SettingsSection>

                {/* Grafik-Vorlagen (#162): Import aus jm Grafiktool / PSD */}
                <Collapsible
                  title="Grafik-Vorlagen"
                  persistId="titler.graphics"
                  defaultOpen={false}
                  description={
                    <>
                      Bauchbinden aus dem jm Grafiktool oder als <code>.psd</code> importieren. Textebenen werden zu
                      füllbaren Feldern — Variablen bleiben nutzbar.
                    </>
                  }
                >
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDropImport}
                    className="rounded-[var(--radius)] border border-dashed border-[var(--border)] px-3 py-3 text-center"
                  >
                    <Button variant="outline" size="sm" onClick={() => void pickImport()}>
                      Datei importieren…
                    </Button>
                    <p className="mt-1.5 text-[10px] text-[var(--muted-foreground)]">
                      oder .psd / .jmtitler hierher ziehen
                    </p>
                  </div>
                  {templates.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {templates.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => selectTemplate(t)}
                          className={cn(
                            'group relative rounded-[var(--radius)] border overflow-hidden cursor-pointer',
                            t.id === config.activeGraphicId
                              ? 'border-[var(--primary)] ring-1 ring-[var(--primary)]'
                              : 'border-[var(--border)] hover:bg-[var(--highlight)]',
                          )}
                          title={t.name}
                        >
                          {t.thumbDataUrl ? (
                            <img src={t.thumbDataUrl} alt={t.name} className="cg-checker w-full h-20 object-contain" />
                          ) : (
                            <div className="cg-checker w-full h-20" />
                          )}
                          <div className="flex items-center gap-1 px-2 py-1">
                            <span className="truncate text-[11px] font-semibold">{t.name}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void deleteTemplate(t);
                              }}
                              className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 text-[var(--destructive)] text-xs"
                              title="Vorlage löschen"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[var(--muted-foreground)]">Noch keine Vorlagen importiert.</p>
                  )}
                </Collapsible>

                {/* Daten / Recall (#86/#152): Live-Abruf der DataLink-Einträge.
                    Der Datenordner selbst wird im Reiter „Einstellungen" gewählt. */}
                <Collapsible title="Daten / Recall" persistId="titler.recall" defaultOpen>
                  {/* Quelle über der Liste (Q1–Q3) und stehender Hinweis (H1–H7), Spec 7.8 */}
                  {datenQuelle?.zeile ? (
                    <p className="truncate text-[11px] text-[var(--muted-foreground)]" title={datenQuelle.zeile}>
                      {datenQuelle.zeile}
                    </p>
                  ) : null}
                  {hinweis ? (
                    <p
                      role="status"
                      className="rounded-[var(--radius)] border border-[var(--warning)]/50 bg-[var(--warning)]/15 px-3 py-2 text-[11px] text-[var(--foreground)]"
                    >
                      {hinweis.text}
                    </p>
                  ) : null}
                  {datenQuelle?.ohneOrdner ? (
                    <p className="text-[11px] text-[var(--muted-foreground)]">
                      Kein Datenordner aktiv. Im Reiter <b>Einstellungen › DataLink</b> einen Ordner wählen — oder den
                      Titler über eine <b>JM Show</b> mit iveo-Daten öffnen. Abrufbare Einträge erscheinen dann hier.
                    </p>
                  ) : dataError ? (
                    <p className="text-[11px] text-[var(--destructive)]">DataLink: {dataError}</p>
                  ) : (
                    <>
                      {/* Abrufbare Einträge (Recall) */}
                      {entries.length > 0 ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
                              {zaehlerText(activeEntry, entries.length)}
                            </span>
                            <div className="ml-auto flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                uppercase={false}
                                onClick={() => void window.jmtitler.openRecall()}
                                title="Recall-Button-Board in eigenem Fenster öffnen (#152)"
                              >
                                ⧉ Board
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                uppercase={false}
                                disabled={nav.zurueck}
                                onClick={() => void window.jmtitler.stepEntry(-1)}
                                title="Vorheriger Eintrag"
                              >
                                ‹
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                uppercase={false}
                                disabled={nav.weiter}
                                onClick={() => void window.jmtitler.stepEntry(1)}
                                title="Nächster Eintrag"
                              >
                                ›
                              </Button>
                            </div>
                          </div>
                          <div className="max-h-40 overflow-auto rounded-[var(--radius)] border border-[var(--border)]/60 divide-y divide-[var(--border)]/40">
                            {entries.map((e, i) => (
                              <button
                                key={e.key}
                                onClick={() => void window.jmtitler.recallSchluessel(e.key)}
                                className={cn(
                                  'flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-xs',
                                  i === activeEntry
                                    ? 'bg-[var(--primary)]/15 text-[var(--foreground)] font-bold'
                                    : 'hover:bg-[var(--highlight)] text-[var(--muted-foreground)]',
                                )}
                              >
                                <span className="tabular text-[10px] w-5 shrink-0 text-[var(--muted-foreground)]">{i + 1}</span>
                                <span className="truncate">{e.label || '—'}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {/* Variablen des aktiven Eintrags */}
                      <div className="rounded-[var(--radius)] border border-[var(--border)]/60 divide-y divide-[var(--border)]/40">
                        {Object.keys(variables).length === 0 ? (
                          <p className="px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
                            Keine Variablen gefunden. Lege im Ordner z. B. eine <code>gaeste.csv</code> mit Kopfzeile
                            <code>name,funktion</code> an — oder eine <code>daten.txt</code> mit <code>name=Dr. Schmidt</code>.
                          </p>
                        ) : (
                          Object.entries(variables).map(([k, v]) => (
                            <div key={k} className="flex items-baseline gap-2 px-3 py-1.5 text-xs">
                              <code className="font-bold text-[var(--primary)] shrink-0">{`{{${k}}}`}</code>
                              <span className="truncate text-[var(--muted-foreground)]">{v || '—'}</span>
                            </div>
                          ))
                        )}
                        {dataSources.length > 0 ? (
                          <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                            Quelle: {dataSources.join(', ')}
                          </p>
                        ) : null}
                      </div>
                    </>
                  )}
                  {referenced.length > 0 ? (
                    <p className="text-[11px] text-[var(--muted-foreground)] flex flex-wrap items-baseline gap-x-1">
                      <span>Im Text verwendet:</span>
                      {referenced.map((k) => (
                        <code
                          key={k}
                          className={cn(
                            k.toLowerCase() in lowerVars ? 'text-[var(--primary)]' : 'text-[var(--destructive)]',
                          )}
                          title={k.toLowerCase() in lowerVars ? 'Variable vorhanden' : 'Variable nicht gefunden'}
                        >
                          {`{{${k}}}`}
                        </code>
                      ))}
                    </p>
                  ) : null}
                </Collapsible>

                {/* Stil */}
                <Collapsible title="Stil" persistId="titler.style" defaultOpen={false}>
                  <div className="flex gap-2">
                    {(['bottom', 'top'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => void setConfig({ position: p })}
                        className={cn(
                          'flex-1 h-9 rounded-[var(--radius)] text-xs font-bold border',
                          c.position === p
                            ? 'bg-[var(--accent)] text-[var(--foreground)] border-transparent'
                            : 'border-[var(--border)] hover:bg-[var(--highlight)]',
                        )}
                      >
                        {p === 'bottom' ? 'Unten' : 'Oben'}
                      </button>
                    ))}
                  </div>
                  <Slider label="Größe" value={c.scale} min={0.6} max={1.6} step={0.05} onChange={(v) => void setConfig({ scale: v })} />
                  <div className="flex gap-3">
                    <ColorField label="Balken" value={c.colors.bar} onChange={(v) => void setConfig({ colors: { bar: v } })} />
                    <ColorField label="Text" value={c.colors.text} onChange={(v) => void setConfig({ colors: { text: v } })} />
                    <ColorField label="Akzent" value={c.colors.accent} onChange={(v) => void setConfig({ colors: { accent: v } })} />
                  </div>
                </Collapsible>
              </div>
          </div>
        </div>
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
