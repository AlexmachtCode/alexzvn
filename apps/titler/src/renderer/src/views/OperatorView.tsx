import { useEffect, useMemo, useRef } from 'react';
import { Button, cn, Logo } from '@jm/ui';
import { DEFAULT_CONFIG, type TemplateKind, type TitlerConfig } from '@shared/types';
import { resolveConfigVars, usedVars } from '@shared/vars';
import { useTitler } from '@/store/titler';
import { useTitlerEngine } from '@/lib/engine';

const TEMPLATES: { key: TemplateKind; label: string }[] = [
  { key: 'lowerthird', label: 'Bauchbinde' },
  { key: 'banner', label: 'Banner' },
  { key: 'ticker', label: 'Ticker' },
];

const RESOLUTIONS = [
  { label: '1920×1080', w: 1920, h: 1080 },
  { label: '1280×720', w: 1280, h: 720 },
];
const FPS = [25, 30, 50, 60];

export function OperatorView(): React.JSX.Element {
  const state = useTitler((s) => s.state);
  const setConfig = useTitler((s) => s.setConfig);
  const startNdi = useTitler((s) => s.startNdi);
  const stopNdi = useTitler((s) => s.stopNdi);

  const config: TitlerConfig = state?.config ?? DEFAULT_CONFIG;
  const ndiActive = state?.status.ndiActive ?? false;
  const connections = state?.status.connections ?? 0;
  const suiteClients = state?.status.suiteClients ?? 0;
  const variables = state?.status.variables ?? {};
  const dataSources = state?.status.dataSources ?? [];
  const dataError = state?.status.dataError;
  const entries = state?.status.entries ?? [];
  const activeEntry = state?.status.activeEntry ?? -1;

  const previewRef = useRef<HTMLCanvasElement>(null);
  // Zum Zeichnen werden {{variablen}} aufgelöst; die Eingabefelder zeigen weiter
  // die Vorlage (siehe @shared/vars).
  const resolved = useMemo(() => resolveConfigVars(config, variables), [config, variables]);
  const { live, take, clear } = useTitlerEngine(resolved, ndiActive, previewRef);

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
        case 'text':
          // Bauchbinden-Text fernsetzen (#93, z. B. Q&A aktiver Sprecher).
          void setConfig({ name: cmd.name, subtitle: cmd.subtitle });
          break;
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

  if (!state) {
    return <div className="h-screen grid place-items-center text-[var(--muted-foreground)]">Lädt…</div>;
  }
  const c = config;

  return (
    <div className="h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="h-14 shrink-0 flex items-center gap-3 px-6 border-b border-[var(--border)]/60">
        <Logo size={24} />
        <span className="text-sm font-extrabold tracking-[0.06em]">JM TITLER</span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          Live-CG → NDI
        </span>
        <span
          className={cn(
            'ml-auto inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] font-extrabold border',
            suiteClients > 0
              ? 'border-[var(--primary)]/40 text-[var(--primary)]'
              : 'border-[var(--border)] text-[var(--muted-foreground)]',
          )}
          title="Verbundene Suite-Steuerclients (Companion, Q&A, Battle, System-Zustand)"
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: suiteClients > 0 ? 'var(--primary)' : 'var(--muted-foreground)' }}
          />
          {suiteClients > 0 ? `Suite · ${suiteClients} verbunden` : 'Suite getrennt'}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] font-extrabold border',
            ndiActive
              ? 'border-[var(--primary)]/40 text-[var(--primary)]'
              : 'border-[var(--border)] text-[var(--muted-foreground)]',
          )}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: ndiActive ? 'var(--primary)' : 'var(--muted-foreground)' }}
          />
          {ndiActive ? `NDI · ${connections} Empfänger` : 'NDI aus'}
        </span>
      </header>

      <div className="flex-1 min-h-0 flex">
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

        {/* Steuerpult */}
        <div className="w-[400px] shrink-0 overflow-auto border-l border-[var(--border)]/60">
          <div className="p-5 space-y-5">
            {/* Vorlage */}
            <Section title="Vorlage">
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
            </Section>

            {/* Inhalt */}
            <Section title="Inhalt">
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
            </Section>

            {/* DataLink-Variablen (#86) + Recall */}
            <Section title="Daten / Variablen">
              <p className="text-[11px] text-[var(--muted-foreground)] -mt-1">
                Platzhalter <code className="text-[var(--primary)]">{'{{name}}'}</code> in den Textfeldern
                werden aus den Dateien im Ordner gefüllt. CSV mit Kopfzeile = Liste (je Zeile ein Eintrag,
                abrufbar); <code>schlüssel=wert</code>-Datei = ein Eintrag.
              </p>
              <div className="flex gap-2">
                <input
                  value={c.dataFolder}
                  onChange={(e) => void setConfig({ dataFolder: e.target.value })}
                  placeholder="Kein Ordner gewählt"
                  spellCheck={false}
                  className="h-9 flex-1 min-w-0 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-xs"
                />
                <Button variant="outline" size="sm" onClick={() => void pickFolder()}>
                  Durchsuchen…
                </Button>
                {c.dataFolder ? (
                  <Button variant="ghost" size="sm" uppercase={false} onClick={() => void setConfig({ dataFolder: '' })} title="Watchfolder entfernen">
                    ✕
                  </Button>
                ) : null}
              </div>
              {dataError ? (
                <p className="text-[11px] text-[var(--destructive)]">DataLink: {dataError}</p>
              ) : null}

              {/* Abrufbare Einträge (Recall) */}
              {c.dataFolder && !dataError && entries.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
                      Einträge {activeEntry >= 0 ? `· ${activeEntry + 1}/${entries.length}` : `· ${entries.length}`}
                    </span>
                    <div className="ml-auto flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        uppercase={false}
                        disabled={activeEntry <= 0}
                        onClick={() => void window.jmtitler.stepEntry(-1)}
                        title="Vorheriger Eintrag"
                      >
                        ‹
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        uppercase={false}
                        disabled={activeEntry >= entries.length - 1}
                        onClick={() => void window.jmtitler.stepEntry(1)}
                        title="Nächster Eintrag"
                      >
                        ›
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-auto rounded-[var(--radius)] border border-[var(--border)]/60 divide-y divide-[var(--border)]/40">
                    {entries.map((label, i) => (
                      <button
                        key={`${i}-${label}`}
                        onClick={() => void window.jmtitler.recallEntry(String(i + 1))}
                        className={cn(
                          'flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-xs',
                          i === activeEntry
                            ? 'bg-[var(--primary)]/15 text-[var(--foreground)] font-bold'
                            : 'hover:bg-[var(--highlight)] text-[var(--muted-foreground)]',
                        )}
                      >
                        <span className="tabular text-[10px] w-5 shrink-0 text-[var(--muted-foreground)]">{i + 1}</span>
                        <span className="truncate">{label || '—'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Variablen des aktiven Eintrags */}
              {c.dataFolder && !dataError ? (
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
              ) : null}
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
            </Section>

            {/* Stil */}
            <Section title="Stil">
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
            </Section>

            {/* Ausgabe (NDI) */}
            <Section title="Ausgabe (NDI)">
              <Field label="Quellname" value={c.ndiName} onChange={(v) => void setConfig({ ndiName: v })} />
              <div className="flex gap-2">
                <Labeled label="Auflösung">
                  <select
                    value={`${c.width}x${c.height}`}
                    onChange={(e) => {
                      const r = RESOLUTIONS.find((x) => `${x.w}x${x.h}` === e.target.value);
                      if (r) void setConfig({ width: r.w, height: r.h });
                    }}
                    className="h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2 text-sm font-semibold"
                  >
                    {RESOLUTIONS.map((r) => (
                      <option key={r.label} value={`${r.w}x${r.h}`}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </Labeled>
                <Labeled label="fps">
                  <select
                    value={String(c.fps)}
                    onChange={(e) => void setConfig({ fps: Number(e.target.value) })}
                    className="h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2 text-sm font-semibold tabular"
                  >
                    {FPS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </Labeled>
              </div>
              {ndiActive ? (
                <Button variant="destructive" className="w-full" onClick={() => void stopNdi()}>
                  NDI stoppen
                </Button>
              ) : (
                <Button variant="primary" className="w-full" onClick={() => void startNdi(c.ndiName)}>
                  NDI starten
                </Button>
              )}
              {c.width % 2 !== 0 || c.height % 2 !== 0 ? (
                <p className="text-[11px] text-[var(--destructive)]">Auflösung sollte gerade sein.</p>
              ) : null}
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="space-y-2.5">
      <h3 className="text-[10px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}): React.JSX.Element {
  return (
    <label className="block">
      <div className="text-sm font-semibold mb-1">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
      />
    </label>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label className="block flex-1">
      <div className="text-sm font-semibold mb-1">{label}</div>
      {children}
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}): React.JSX.Element {
  return (
    <label className="flex-1">
      <div className="text-[11px] font-semibold mb-1 text-[var(--muted-foreground)]">{label}</div>
      <div className="flex items-center gap-2 h-9 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-7 rounded cursor-pointer bg-transparent border-0 p-0"
        />
        <span className="text-[11px] tabular text-[var(--muted-foreground)] uppercase">{value}</span>
      </div>
    </label>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}): React.JSX.Element {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between text-sm mb-1">
        <span className="font-semibold">{label}</span>
        <span className="tabular text-[var(--muted-foreground)]">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--primary)]"
      />
    </label>
  );
}
