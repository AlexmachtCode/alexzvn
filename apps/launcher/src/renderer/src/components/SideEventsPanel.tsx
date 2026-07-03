import { useState } from 'react';
import { Button, Card, cn } from '@jm/ui';
import { useTools } from '@/store/tools';

/** YYYY-MM-DD → „Di, 12.11.2024" (lokal geparst, ohne TZ-Verschiebung). */
function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const wd = new Date(y, m - 1, d).toLocaleDateString('de-DE', { weekday: 'short' });
  return `${wd}, ${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
}

/** Bytes → kompakte Größe (KB/MB). */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * iveo-Live-Umschalter (#11): listet die Side Events des Tages der offenen Show und
 * schaltet auf Klick live um (Ablauf = dessen Agenda + Speaker → Timer/Titler
 * RELOAD). Ersetzt das umständliche „pro Side Event eine eigene Show anlegen".
 * Auflisten geht token-frei; Umschalten braucht das iveo-Token (dieser Rechner).
 */
export function SideEventsPanel(): React.JSX.Element | null {
  const open = useTools((s) => s.sideEventsOpen);
  const data = useTools((s) => s.sideEvents);
  const close = useTools((s) => s.closeSideEvents);
  const loadDay = useTools((s) => s.loadSideEvents);
  const switchTo = useTools((s) => s.switchSideEvent);
  const materials = useTools((s) => s.materials);
  const materialsError = useTools((s) => s.materialsError);
  const loadMaterials = useTools((s) => s.loadMaterials);
  const downloadMaterial = useTools((s) => s.downloadMaterial);
  const [busy, setBusy] = useState<string | null>(null);
  const [openMat, setOpenMat] = useState<string | null>(null);

  if (!open) return null;

  const canSwitch = data?.canSwitch ?? false;
  const activeId = data?.activeProgramId ?? '';
  const days = data?.days ?? [];
  const programs = data?.programs ?? [];

  const doSwitch = async (programId?: string): Promise<void> => {
    if (!canSwitch) return;
    setBusy(programId ?? '__day__');
    try {
      await switchTo(programId, data?.day);
    } finally {
      setBusy(null);
    }
  };

  const toggleMaterials = (programId: string): void => {
    if (openMat === programId) {
      setOpenMat(null);
      return;
    }
    setOpenMat(programId);
    if (!materials[programId]) void loadMaterials(programId);
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm px-6"
      onClick={close}
    >
      <Card className="w-full max-w-lg p-6 jm-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold tracking-tight truncate">
              Side Events {data?.event ? `· ${data.event}` : ''}
            </h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Ein Klick schaltet das Side Event live (Timer &amp; Titler übernehmen Ablauf &amp; Speaker)
              — keine neue Show nötig.
            </p>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-[var(--radius-full)] border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em]',
              canSwitch
                ? 'border-[var(--success)]/40 bg-[var(--success)]/12 text-[var(--success)]'
                : 'border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]',
            )}
          >
            {canSwitch ? 'Live' : 'Nur Anzeige'}
          </span>
        </div>

        {data && !data.ok ? (
          <p className="mt-5 text-sm rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] px-3 py-3 text-[var(--muted-foreground)]">
            {data.error ?? 'Keine iveo-gebundene Show geöffnet.'}
          </p>
        ) : (
          <>
            {!canSwitch && (
              <p className="mt-4 text-[11px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[var(--muted-foreground)]">
                Live-Umschalten nur auf dem Rechner mit dem iveo-Token dieser Show.
              </p>
            )}

            <div className="mt-4 flex items-center gap-2">
              {days.length > 1 && (
                <select
                  value={data?.day ?? ''}
                  onChange={(e) => void loadDay(e.target.value)}
                  className={cn(
                    'h-8 min-w-0 flex-1 rounded-[var(--radius)] border border-[var(--border)]',
                    'bg-[var(--input)] px-2 text-xs text-[var(--foreground)]',
                  )}
                >
                  {days.map((d) => (
                    <option key={d.value} value={d.value}>
                      {formatDay(d.value)} — {d.count} Punkt(e)
                    </option>
                  ))}
                </select>
              )}
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                disabled={!canSwitch || busy !== null || !activeId}
                onClick={() => void doSwitch(undefined)}
                title="Zurück zur Tagesübersicht (alle Side Events des Tages als Ablauf)"
              >
                {busy === '__day__' ? '…' : 'Tagesübersicht'}
              </Button>
            </div>

            {programs.length === 0 ? (
              <p className="mt-4 text-sm rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] px-3 py-3 text-[var(--muted-foreground)]">
                Keine Side Events für diesen Tag im Cache.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1.5 max-h-[58vh] overflow-auto pr-1">
                {programs.map((p) => {
                  const isActive = p.id === activeId;
                  const mats = materials[p.id];
                  const matErr = materialsError[p.id];
                  const matOpen = openMat === p.id;
                  return (
                    <li
                      key={p.id}
                      className={cn(
                        'rounded-[var(--radius)] border',
                        isActive
                          ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                          : 'border-[var(--border)] bg-[var(--card)]',
                      )}
                    >
                      <div className="flex items-center gap-3 px-3 py-2">
                        {p.time && (
                          <span className="w-10 shrink-0 text-[11px] tabular-nums text-[var(--muted-foreground)]">
                            {p.time}
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={p.title}>
                          {p.title}
                        </span>
                        {canSwitch && (
                          <button
                            type="button"
                            onClick={() => toggleMaterials(p.id)}
                            title="Materialien (Präsentationen/Dateien) anzeigen"
                            className={cn(
                              'shrink-0 rounded-[var(--radius)] border px-2 py-0.5 text-[11px]',
                              matOpen
                                ? 'border-[var(--primary)]/50 text-[var(--primary)]'
                                : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--highlight)]',
                            )}
                          >
                            📎{mats?.length ? ` ${mats.length}` : ''}
                          </button>
                        )}
                        {isActive ? (
                          <span className="shrink-0 rounded-[var(--radius-full)] border border-[var(--primary)]/40 bg-[var(--primary)]/15 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[var(--primary)]">
                            Aktiv
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="primary"
                            className="shrink-0"
                            disabled={!canSwitch || busy !== null}
                            onClick={() => void doSwitch(p.id)}
                          >
                            {busy === p.id ? '…' : 'Live'}
                          </Button>
                        )}
                      </div>

                      {matOpen && (
                        <div className="border-t border-[var(--border)]/60 px-3 py-2">
                          {matErr ? (
                            <div className="flex flex-col gap-2">
                              <p className="text-[11px] text-[var(--destructive)] break-words">
                                Materialien konnten nicht geladen werden: {matErr}
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="self-start"
                                onClick={() => void loadMaterials(p.id)}
                              >
                                Erneut versuchen
                              </Button>
                            </div>
                          ) : mats === undefined ? (
                            <p className="text-[11px] text-[var(--muted-foreground)]">Lade Materialien…</p>
                          ) : mats.length === 0 ? (
                            <p className="text-[11px] text-[var(--muted-foreground)]">
                              Keine Materialien an diesem Side Event.
                            </p>
                          ) : (
                            <ul className="flex flex-col gap-1">
                              {mats.map((m) => (
                                <li key={m.id} className="flex items-center gap-2">
                                  <span className="min-w-0 flex-1 truncate text-xs" title={m.label}>
                                    {m.kind === 'link' ? '🔗' : '📄'} {m.label}
                                    {m.sizeBytes ? (
                                      <span className="text-[var(--muted-foreground)]">
                                        {' '}· {formatSize(m.sizeBytes)}
                                      </span>
                                    ) : null}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="shrink-0"
                                    onClick={() => void downloadMaterial(p.id, m.id)}
                                  >
                                    {m.kind === 'link' ? 'Öffnen' : 'Herunterladen'}
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        <div className="mt-5 flex justify-end border-t border-[var(--border)] pt-4">
          <Button variant="ghost" onClick={close}>
            Schließen
          </Button>
        </div>
      </Card>
    </div>
  );
}
