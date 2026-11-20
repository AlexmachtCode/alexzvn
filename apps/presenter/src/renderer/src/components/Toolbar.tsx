import { useEffect, useState } from 'react';
import { Logo, cn, dragRegion, noDragRegion, isElectronMac } from '@jm/ui';
import type { DisplayInfo, PresentationState, TimerSyncConfig } from '@shared/types';
import { useProject } from '@/store/project';
import { NdiSchalter } from '@/components/NdiSchalter';
import { getExpandPptxBuilds, setExpandPptxBuilds } from '@/lib/settings';
import { useNdiStatus } from '@/lib/useNdiStatus';
import { ndiLiefertBild, nurNdiBehalten, startZielFuer } from '../../../shared/ndi';

const btn =
  'h-9 px-3 rounded-md text-sm font-semibold whitespace-nowrap border border-[var(--border)] bg-[var(--card)] ' +
  'hover:bg-[var(--highlight)] transition-colors disabled:opacity-40 disabled:pointer-events-none';

export function Toolbar() {
  const doc = useProject((s) => s.doc);
  const busy = useProject((s) => s.busy);
  const dirty = useProject((s) => s.dirty);
  const selectedId = useProject((s) => s.selectedId);
  const importDocs = useProject((s) => s.importDocs);
  const importOffice = useProject((s) => s.importOffice);
  const newProject = useProject((s) => s.newProject);
  const openProject = useProject((s) => s.openProject);
  const saveProject = useProject((s) => s.saveProject);
  const exportPdf = useProject((s) => s.exportPdf);
  const buildPayload = useProject((s) => s.buildPayload);
  const setError = useProject((s) => s.setError);

  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [audienceDisplay, setAudienceDisplay] = useState<number | null>(null);
  // „Keiner – nur NDI“ (#303): eigener Schalter, `audienceDisplay` bleibt die bisherige Bildschirmwahl.
  const [nurNdi, setNurNdi] = useState(false);
  const { status: ndi } = useNdiStatus();
  const nurNdiWaehlbar = ndiLiefertBild(ndi);
  const nurNdiBleibt = nurNdiBehalten(ndi);
  const [showSettings, setShowSettings] = useState(false);
  const [expandBuilds, setExpandBuildsState] = useState(getExpandPptxBuilds());
  const [timerCfg, setTimerCfg] = useState<TimerSyncConfig | null>(null);
  const [timerConnected, setTimerConnected] = useState(false);
  const [present, setPresent] = useState<PresentationState>({
    active: false,
    index: 0,
    total: 0,
    screen: 'live',
  });

  useEffect(() => {
    void window.jmpr.present.displays().then((d) => {
      setDisplays(d);
      // Default the audience to a non-primary screen when present.
      const secondary = d.find((x) => !x.primary);
      setAudienceDisplay(secondary?.id ?? d[0]?.id ?? null);
    });
    void window.jmpr.present.getState().then(setPresent);
    const offState = window.jmpr.present.onState(setPresent);
    void window.jmpr.timer.getConfig().then(setTimerCfg);
    void window.jmpr.timer.getState().then((s) => setTimerConnected(s.connected));
    const offTimer = window.jmpr.timer.onState((s) => setTimerConnected(s.connected));
    return () => {
      offState();
      offTimer();
    };
  }, []);

  // Liefert NDI dauerhaft kein Bild (aus, nicht verfügbar), gilt wieder die bisherige Bildschirmwahl; ein
  // vorübergehendes „startet“ behält „Keiner“.
  useEffect(() => {
    if (!nurNdiBleibt) setNurNdi(false);
  }, [nurNdiBleibt]);

  const applyTimer = (patch: Partial<TimerSyncConfig>): void => {
    if (!timerCfg) return;
    const next = { ...timerCfg, ...patch };
    setTimerCfg(next);
    void window.jmpr.timer.apply(next);
  };

  const visibleCount = doc.slides.filter((s) => !s.hidden).length;

  const startPresentation = async (): Promise<void> => {
    if (visibleCount === 0) {
      setError('Keine sichtbaren Folien zum Präsentieren.');
      return;
    }
    const visible = doc.slides.filter((s) => !s.hidden);
    const startIndex = Math.max(
      0,
      visible.findIndex((s) => s.id === selectedId),
    );
    const payload = buildPayload(startIndex);
    await window.jmpr.present.start(payload, startZielFuer(nurNdi, ndi, audienceDisplay));
  };

  // Frisch beginnen, ohne die App zu schließen (Issue #40): leert das Projekt,
  // danach führt der Empty-State direkt zum Import der neuen PDF. Bei
  // ungespeicherten Änderungen erst rückfragen, damit nichts verloren geht.
  const handleNew = (): void => {
    if (
      dirty &&
      doc.slides.length > 0 &&
      !window.confirm(
        'Aktuelle Präsentation verwerfen und neu beginnen? Nicht gespeicherte Änderungen gehen verloren.',
      )
    ) {
      return;
    }
    newProject();
  };

  return (
    <header
      style={dragRegion}
      className={cn(
        // relative + z-50: the backdrop-blur makes the header its own stacking
        // context; without a raised z-index the editor body (slide canvas +
        // inspector) paints over the settings dropdown that drops out of it.
        'relative z-50 h-14 flex items-center gap-3 pr-4 border-b border-[var(--border)]/60 bg-[var(--card)]/60 backdrop-blur-md',
        isElectronMac ? 'pl-20' : 'pl-4',
      )}
    >
      <div className="flex items-center gap-2.5 pr-2">
        <Logo size={26} />
        <div className="hidden md:flex flex-col leading-tight">
          <span className="text-xs font-extrabold tracking-[0.06em]">JM PRESENTER</span>
          <span className="text-[9px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Folien-Editor & Präsentation
          </span>
        </div>
      </div>

      <div className="h-6 w-px bg-[var(--border)]" />

      <div className="flex items-center gap-1.5" style={noDragRegion}>
        <button type="button" className={btn} disabled={busy.active} onClick={handleNew}>
          Neu
        </button>
        <button type="button" className={btn} disabled={busy.active} onClick={() => void importDocs()}>
          + PDF / Bilder
        </button>
        <button type="button" className={btn} disabled={busy.active} onClick={() => void importOffice()}>
          + Office
        </button>
        <button type="button" className={btn} disabled={busy.active} onClick={() => void openProject()}>
          Öffnen
        </button>
        <button type="button" className={btn} disabled={busy.active} onClick={() => void saveProject()}>
          Speichern{dirty ? ' •' : ''}
        </button>
        <button
          type="button"
          className={btn}
          disabled={busy.active || visibleCount === 0}
          onClick={() => void exportPdf()}
        >
          PDF-Export
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2" style={noDragRegion}>
        {busy.active && (
          <span className="text-xs text-[var(--muted-foreground)] animate-pulse">{busy.label}</span>
        )}

        <select
          value={nurNdi ? 'keiner' : audienceDisplay ?? ''}
          onChange={(e) => {
            if (e.target.value === 'keiner') {
              setNurNdi(true);
              return;
            }
            setNurNdi(false);
            setAudienceDisplay(e.target.value ? Number(e.target.value) : null);
          }}
          title="Publikums-Bildschirm"
          className="h-9 max-w-[200px] rounded-md bg-[var(--card)] border border-[var(--border)] px-2 text-xs"
        >
          {displays.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
          {window.jmpr.platform === 'win32' && (
            <option value="keiner" disabled={!nurNdiWaehlbar && !nurNdi}>
              Keiner – nur NDI
            </option>
          )}
        </select>

        <NdiSchalter variante="editor" />

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            title="Einstellungen"
            className={cn(btn, showSettings && 'bg-[var(--highlight)]')}
          >
            ⚙︎
          </button>
          {showSettings && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSettings(false)} />
              <div className="absolute right-0 top-full mt-2 z-20 w-80 rounded-lg bg-[var(--card)] ring-1 ring-[var(--border)] shadow-xl p-4 text-sm">
                <div className="font-bold mb-2">Einstellungen</div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={expandBuilds}
                    onChange={(e) => {
                      setExpandPptxBuilds(e.target.checked);
                      setExpandBuildsState(e.target.checked);
                    }}
                    className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
                  />
                  <span>
                    <span className="font-semibold">PPTX-Aufbau-Animationen als Einzelschritte</span>{' '}
                    <span className="text-[10px] uppercase tracking-wide text-[var(--primary)]">
                      experimentell
                    </span>
                    <span className="block text-xs text-[var(--muted-foreground)] mt-0.5">
                      Splittet On-Click-Animationen beim Office-Import in einzelne Folien. Bei
                      Problemen wird automatisch auf das flache PDF zurückgefallen.
                    </span>
                  </span>
                </label>

                <div className="my-3 h-px bg-[var(--border)]" />

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={timerCfg?.enabled ?? false}
                    disabled={!timerCfg}
                    onChange={(e) => applyTimer({ enabled: e.target.checked })}
                    className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
                  />
                  <span>
                    <span className="font-semibold inline-flex items-center gap-1.5">
                      JM Timer synchronisieren
                      {timerCfg?.enabled && (
                        <span
                          title={timerConnected ? 'verbunden' : 'keine Verbindung'}
                          className={cn(
                            'inline-block h-2 w-2 rounded-full',
                            timerConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse',
                          )}
                        />
                      )}
                    </span>
                    <span className="block text-xs text-[var(--muted-foreground)] mt-0.5">
                      Zeigt den Countdown des JM Timers live in der Referentenansicht.
                    </span>
                  </span>
                </label>

                {timerCfg?.enabled && (
                  <div className="mt-2 flex items-center gap-2 pl-6">
                    <input
                      value={timerCfg.host}
                      onChange={(e) => setTimerCfg({ ...timerCfg, host: e.target.value })}
                      onBlur={(e) => applyTimer({ host: e.target.value.trim() || '127.0.0.1' })}
                      placeholder="127.0.0.1"
                      spellCheck={false}
                      className="h-8 flex-1 min-w-0 rounded-md bg-[var(--card)] border border-[var(--border)] px-2 text-xs"
                      title="Host / IP des JM Timers"
                    />
                    <span className="text-[var(--muted-foreground)] text-xs">:</span>
                    <input
                      value={timerCfg.port}
                      onChange={(e) =>
                        setTimerCfg({ ...timerCfg, port: Number(e.target.value.replace(/\D/g, '')) || 0 })
                      }
                      onBlur={(e) => {
                        const p = Number(e.target.value.replace(/\D/g, ''));
                        applyTimer({ port: p >= 1 && p <= 65535 ? p : 7777 });
                      }}
                      placeholder="7777"
                      className="h-8 w-16 text-center rounded-md bg-[var(--card)] border border-[var(--border)] px-2 text-xs"
                      title="Port (Standard 7777)"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {present.active ? (
          <button
            type="button"
            onClick={() => void window.jmpr.present.stop()}
            className={cn(btn, 'bg-[var(--destructive)] text-white border-[var(--destructive)]')}
          >
            ■ Beenden
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void startPresentation()}
            disabled={busy.active || visibleCount === 0}
            className={cn(
              btn,
              'bg-[var(--primary)] text-[var(--brand-dark)] border-[var(--primary)] font-bold',
            )}
          >
            ▶ Präsentieren
          </button>
        )}
      </div>
    </header>
  );
}
