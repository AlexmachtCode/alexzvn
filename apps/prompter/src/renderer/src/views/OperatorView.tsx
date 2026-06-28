import { Button, cn, Logo } from '@jm/ui';
import { positionEm } from '@shared/types';
import { usePrompter } from '@/store/prompter';
import { PrompterScroller } from '@/components/PrompterScroller';
import { RemoteQr } from '@/components/RemoteQr';
import { usePrompterHotkeys } from '@/lib/useHotkeys';

export function OperatorView(): React.JSX.Element {
  const state = usePrompter((s) => s.state);
  const setConfig = usePrompter((s) => s.setConfig);
  const importScript = usePrompter((s) => s.importScript);
  const setMarkers = usePrompter((s) => s.setMarkers);
  const markersEm = usePrompter((s) => s.markersEm);
  const displays = usePrompter((s) => s.displays);
  const outputOpen = usePrompter((s) => s.outputOpen);
  const openOutput = usePrompter((s) => s.openOutput);
  const closeOutput = usePrompter((s) => s.closeOutput);
  const refreshDisplays = usePrompter((s) => s.refreshDisplays);
  const setRemote = usePrompter((s) => s.setRemote);
  usePrompterHotkeys();

  if (!state) {
    return <div className="h-screen grid place-items-center text-[var(--muted-foreground)]">Lädt…</div>;
  }
  const c = state.config;
  const t = state.transport;

  const jumpMarker = (dir: 1 | -1): void => {
    const pos = positionEm(t);
    if (dir > 0) {
      const next = markersEm.find((m) => m > pos + 0.05);
      if (next != null) void window.jmprompt.transport.seek(next);
    } else {
      const prev = [...markersEm].reverse().find((m) => m < pos - 0.05);
      void window.jmprompt.transport.seek(prev ?? 0);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="h-14 shrink-0 flex items-center gap-3 px-6 border-b border-[var(--border)]/60">
        <Logo size={24} />
        <span className="text-sm font-extrabold tracking-[0.06em]">JM PROMPTER</span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          Teleprompter
        </span>
        <span className="ml-auto text-[11px] text-[var(--muted-foreground)] hidden md:block">
          Leertaste = GO/Pause · ↑/↓ = nudge · Pos1 = Anfang
        </span>
      </header>

      <div className="flex-1 min-h-0 flex">
        {/* Editor */}
        <div className="flex-1 min-w-0 flex flex-col border-r border-[var(--border)]/60">
          <div className="px-5 pt-4 pb-2 flex items-center gap-2">
            <h3 className="text-[10px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)]">
              Skript
            </h3>
            <span className="text-[11px] text-[var(--muted-foreground)]">
              Zeilen mit <code className="text-[var(--foreground)]"># </code> werden zu Abschnitts-Marken
            </span>
            <button
              type="button"
              onClick={() => {
                void importScript().catch((e: unknown) =>
                  window.alert(
                    `Datei konnte nicht geladen werden: ${e instanceof Error ? e.message : String(e)}`,
                  ),
                );
              }}
              title=".docx, .txt oder .md laden (ersetzt das Skript)"
              className="ml-auto h-7 px-2.5 rounded-[var(--radius)] border border-[var(--border)] text-[11px] font-bold hover:bg-[var(--highlight)]"
            >
              📄 Datei laden
            </button>
          </div>
          <textarea
            value={c.script}
            onChange={(e) => void setConfig({ script: e.target.value })}
            spellCheck={false}
            className="flex-1 min-h-0 resize-none mx-5 mb-5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--input)] p-4 text-[15px] leading-relaxed font-medium outline-none focus:border-[var(--primary)]/60"
            placeholder="Skript hier eintippen oder einfügen…"
          />
        </div>

        {/* Steuerpult */}
        <div className="w-[400px] shrink-0 overflow-auto">
          <div className="p-5 space-y-5">
            {/* Vorschau */}
            <div>
              <SectionHeader>Vorschau</SectionHeader>
              <div className="aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
                <PrompterScroller state={state} onMarkers={setMarkers} />
              </div>
            </div>

            {/* Transport */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="px-3" onClick={() => jumpMarker(-1)} title="Voriger Abschnitt">
                  ⏮ Marke
                </Button>
                <Button
                  variant={t.playing ? 'accent' : 'primary'}
                  className="flex-1 font-extrabold tracking-wide"
                  onClick={() => void window.jmprompt.transport.toggle()}
                >
                  {t.playing ? '❙❙ Pause' : '▶ GO'}
                </Button>
                <Button size="sm" variant="ghost" className="px-3" onClick={() => jumpMarker(1)} title="Nächster Abschnitt">
                  Marke ⏭
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="flex-1" onClick={() => void window.jmprompt.transport.nudge(-3)}>
                  ↑ zurück
                </Button>
                <Button size="sm" variant="ghost" className="flex-1" onClick={() => void window.jmprompt.transport.reset()}>
                  ⟲ Anfang
                </Button>
                <Button size="sm" variant="ghost" className="flex-1" onClick={() => void window.jmprompt.transport.nudge(3)}>
                  ↓ vor
                </Button>
              </div>
            </div>

            {/* Tempo & Typo */}
            <Section title="Lauf & Schrift">
              <Slider
                label="Tempo"
                value={c.speed}
                min={0.2}
                max={6}
                step={0.1}
                suffix=" Z/s"
                onChange={(v) => void setConfig({ speed: v })}
              />
              <Slider
                label="Schriftgröße"
                value={c.fontScale}
                min={3}
                max={16}
                step={0.5}
                onChange={(v) => void setConfig({ fontScale: v })}
              />
              <Slider
                label="Zeilenabstand"
                value={c.lineHeight}
                min={1}
                max={2.4}
                step={0.05}
                onChange={(v) => void setConfig({ lineHeight: v })}
              />
              <Slider
                label="Seitenrand"
                value={c.marginXPct}
                min={0}
                max={28}
                step={1}
                suffix=" %"
                onChange={(v) => void setConfig({ marginXPct: v })}
              />
            </Section>

            {/* Lese-Linie */}
            <Section title="Lese-Linie">
              <Toggle label="Lese-Linie anzeigen" checked={c.readingLine} onChange={(v) => void setConfig({ readingLine: v })} />
              {c.readingLine && (
                <Slider
                  label="Position"
                  value={c.readingLinePct}
                  min={15}
                  max={80}
                  step={1}
                  suffix=" %"
                  onChange={(v) => void setConfig({ readingLinePct: v })}
                />
              )}
            </Section>

            {/* Darstellung */}
            <Section title="Darstellung">
              <div className="flex flex-wrap gap-x-5 gap-y-2.5">
                <Toggle label="Spiegeln ⇄" checked={c.mirrorH} onChange={(v) => void setConfig({ mirrorH: v })} />
                <Toggle label="Spiegeln ⇅" checked={c.mirrorV} onChange={(v) => void setConfig({ mirrorV: v })} />
                <Toggle label="Fett" checked={c.bold} onChange={(v) => void setConfig({ bold: v })} />
              </div>
            </Section>

            {/* Ausgabe */}
            <Section title="Ausgabe (Talent-Monitor)">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={c.outputDisplayId ?? ''}
                  onChange={(e) => void setConfig({ outputDisplayId: e.target.value ? Number(e.target.value) : null })}
                  onFocus={() => void refreshDisplays()}
                  className="h-9 flex-1 min-w-[160px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm font-semibold"
                >
                  <option value="">Primärer Bildschirm</option>
                  {displays.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                      {d.primary ? ' · primär' : ''} ({d.width}×{d.height})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" variant="primary" className="flex-1" onClick={() => void openOutput(c.outputDisplayId ?? undefined)}>
                  {outputOpen ? 'Auf diesen Bildschirm' : 'Vollbild öffnen'}
                </Button>
                {outputOpen && (
                  <Button size="sm" variant="ghost" onClick={() => void closeOutput()}>
                    Schließen
                  </Button>
                )}
              </div>
            </Section>

            {/* Handy-Fernbedienung */}
            <Section title="Fernbedienung (Handy im WLAN)">
              <Toggle
                label="Fernbedienung aktiv"
                checked={c.remoteEnabled}
                onChange={(v) => void setRemote(v)}
              />
              {state.remote.running && state.remote.urls.length > 0 && (
                <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] p-2.5 space-y-2">
                  <div className="text-[11px] text-[var(--muted-foreground)]">
                    Am Handy im selben WLAN scannen oder URL öffnen:
                  </div>
                  <RemoteQr url={state.remote.urls[0] ?? ''} />
                  {state.remote.urls.map((u) => (
                    <div key={u} className="text-sm font-bold tabular text-[var(--primary)] break-all">
                      {u}
                    </div>
                  ))}
                </div>
              )}
              {c.remoteEnabled && state.remote.urls.length === 0 && (
                <p className="text-[11px] text-[var(--muted-foreground)]">Keine LAN-Adresse gefunden.</p>
              )}
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <h3 className="text-[10px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)] mb-2">
      {children}
    </h3>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="space-y-2.5">
      <SectionHeader>{title}</SectionHeader>
      {children}
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}): React.JSX.Element {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between text-sm mb-1">
        <span className="font-semibold">{label}</span>
        <span className="tabular text-[var(--muted-foreground)]">
          {value.toFixed(step < 1 ? (step < 0.1 ? 2 : 1) : 0)}
          {suffix ?? ''}
        </span>
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

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}): React.JSX.Element {
  return (
    <label className={cn('flex items-center gap-2 text-sm cursor-pointer select-none')}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
