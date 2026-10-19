import { useState } from 'react';
import { Button, Card, cn } from '@jm/ui';
import type { AnhangOrdnerStand } from '@shared/types';
import { ANHANG_TEXTE, anhangAnzeige } from '@/lib/anhang-liste';
import { iveoStatusZeile } from '@/lib/iveo-status';
import { ORDNER_ZEILEN_TEXTE, kopfzeile, listenZeile, ordnerZeile, weitereSideEvents } from '@/lib/ordner-zeilen';
import { useTools } from '@/store/tools';

/** YYYY-MM-DD → „Di, 12.11.2024" (lokal geparst, ohne TZ-Verschiebung). */
function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const wd = new Date(y, m - 1, d).toLocaleDateString('de-DE', { weekday: 'short' });
  return `${wd}, ${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
}

/**
 * iveo-Paket, Spec 9.13, 11.1: Kopfzeile der Ablage — Text der Klasse K1–K10, Schalter T26 nur, wenn kopfzeile ihn erlaubt
 * (9.2 Nr. 1–3), „Ordner öffnen“ (T30) für den Basisordner mit dem Pfad als Tooltip. Keine eigene Logik: alles aus kopfzeile.
 */
function OrdnerKopf({
  kopf,
  stand,
  onSchalter,
  onOeffnen,
}: {
  kopf: ReturnType<typeof kopfzeile>;
  stand: AnhangOrdnerStand;
  onSchalter: (an: boolean) => void;
  onOeffnen: () => void;
}): React.JSX.Element {
  return (
    <div className="mt-4 flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] px-3 py-2">
      <p role="status" className="text-[11px] text-[var(--muted-foreground)] break-words">
        {kopf.text}
      </p>
      {(kopf.schalter || kopf.ordnerOeffnen) && (
        <div className="flex flex-wrap items-center gap-3">
          {kopf.schalter && (
            <label className="flex items-center gap-2 text-[11px]">
              <input type="checkbox" checked={stand.schalterAn} onChange={(e) => onSchalter(e.target.checked)} />
              {ORDNER_ZEILEN_TEXTE.schalter}
            </label>
          )}
          {kopf.ordnerOeffnen && (
            <Button size="sm" variant="outline" className="shrink-0" title={kopf.tooltip ?? undefined} onClick={onOeffnen}>
              {ORDNER_ZEILEN_TEXTE.ordnerOeffnen}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** iveo-Paket, Spec 11.2: Ordner-Zeile eines Side Events (S1–S13) mit „Ordner öffnen“ nach ordnerZeile, Pfad nur als Tooltip. */
function OrdnerZeileAnzeige({
  zeile,
  onOeffnen,
}: {
  zeile: ReturnType<typeof ordnerZeile>;
  onOeffnen: () => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 px-3 pb-2">
      <p className="min-w-0 flex-1 text-[11px] text-[var(--muted-foreground)] break-words">{zeile.text}</p>
      {zeile.ordnerOeffnen && (
        <Button size="sm" variant="outline" className="shrink-0" title={zeile.tooltip ?? undefined} onClick={onOeffnen}>
          {ORDNER_ZEILEN_TEXTE.ordnerOeffnen}
        </Button>
      )}
    </div>
  );
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
  // iveo-Paket, Spec 8.1 (E18): der Aufklapp-Zustand liegt im Store (das Panel bleibt eingehängt, App.tsx:74); Listen,
  // Stand und Fehler entscheidet der Helfer anhangListeSchritt, die Zeilen L0–L7 bildet anhangAnzeige.
  const anhaenge = useTools((s) => s.anhaenge);
  const toggleMaterials = useTools((s) => s.toggleMaterials);
  const retryMaterials = useTools((s) => s.retryMaterials);
  const downloadMaterial = useTools((s) => s.downloadMaterial);
  const iveoSync = useTools((s) => s.iveoSync);
  // iveo-Paket, Spec 9.13–9.15: Stand der Ablage und Uhr des Renderers (alle 15 s neu, solange das Panel offen ist).
  const anhangOrdner = useTools((s) => s.anhangOrdner);
  const ordnerUhr = useTools((s) => s.ordnerUhr);
  const setzeAnhangOrdner = useTools((s) => s.setzeAnhangOrdner);
  const oeffneAnhangOrdner = useTools((s) => s.oeffneAnhangOrdner);
  const [busy, setBusy] = useState<string | null>(null);

  if (!open) return null;

  const canSwitch = data?.canSwitch ?? false;
  const activeId = data?.activeProgramId ?? '';
  const days = data?.days ?? [];
  const programs = data?.programs ?? [];
  // Spec 7.6: „iveo-Abgleich gestört: <Text> (seit <Uhrzeit>)“, solange eine Abfrage scheitert.
  const stoerung = iveoStatusZeile(iveoSync);
  // iveo-Paket, Spec 9.13, 11.1, 11.2: Kopfzeile (K0–K10) und Zeilen (S1–S13) nur aus den reinen Helfern, mit der Uhr des
  // Renderers; Zeilen nur in K7–K10, Block T65 mit den Side Events der Ablage, die die Liste nicht zeigt.
  const kopf = kopfzeile(anhangOrdner, ordnerUhr);
  const zeilenSichtbar = kopf.fall === 'K7' || kopf.fall === 'K8' || kopf.fall === 'K9' || kopf.fall === 'K10';
  // G8: in K8 ist die Menge unbekannt, ein Side Event ohne Eintrag im Stand bekommt dort keine Zeile (listenZeile gibt null).
  const zeileVon = (programId: string): ReturnType<typeof ordnerZeile> | null =>
    anhangOrdner && zeilenSichtbar ? listenZeile(anhangOrdner, programId, ordnerUhr) : null;
  const weitere =
    anhangOrdner && zeilenSichtbar ? weitereSideEvents(anhangOrdner, data?.ok ? programs.map((p) => p.id) : []) : [];

  const doSwitch = async (programId?: string): Promise<void> => {
    if (!canSwitch) return;
    setBusy(programId ?? '__day__');
    try {
      await switchTo(programId, data?.day);
    } finally {
      setBusy(null);
    }
  };

  // Auf- und Zuklappen der Anhang-Listen: toggleMaterials im Store (iveo-Paket, Spec 8.1).

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

        {stoerung && (
          <p
            role="status"
            className="mt-4 text-[11px] rounded-[var(--radius)] border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-[var(--destructive)] break-words"
          >
            {stoerung}
          </p>
        )}

        {/* iveo-Paket, Spec 9.13, 11.1: Kopfzeile der Ablage unter der Störungszeile, unabhängig von data.ok (K1–K10). */}
        {kopf.text !== null && anhangOrdner && (
          <OrdnerKopf
            kopf={kopf}
            stand={anhangOrdner}
            onSchalter={(an) => void setzeAnhangOrdner(an)}
            onOeffnen={() => void oeffneAnhangOrdner()}
          />
        )}

        {data && !data.ok ? (
          <>
            <p className="mt-5 text-sm rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] px-3 py-3 text-[var(--muted-foreground)]">
              {data.error ?? 'Keine iveo-gebundene Show geöffnet.'}
            </p>
            {/* K0 (Spec 9.11): ohne geöffnete iveo-Show sagt das Panel auch etwas über die Ablage (T52). */}
            {kopf.fall === 'K0' && (
              <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">{ORDNER_ZEILEN_TEXTE.keineShow}</p>
            )}
          </>
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
                  // L0–L7 (Spec 11.3): Zahl am 📎, Zeile unter der Liste, „Erneut versuchen“ nur in L2.
                  const anz = anhangAnzeige(anhaenge, p.id, canSwitch, Date.now());
                  const mats = anhaenge.listen[p.id];
                  const matOpen = anhaenge.materialsOffen === p.id;
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
                        {anz.fall !== 'L0' && (
                          <button
                            type="button"
                            onClick={() => toggleMaterials(p.id)}
                            title={ANHANG_TEXTE.tooltip}
                            className={cn(
                              'shrink-0 rounded-[var(--radius)] border px-2 py-0.5 text-[11px]',
                              matOpen
                                ? 'border-[var(--primary)]/50 text-[var(--primary)]'
                                : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--highlight)]',
                            )}
                          >
                            📎{anz.zahl !== null ? ` ${anz.zahl}` : ''}
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

                      {zeileVon(p.id) && (
                        <OrdnerZeileAnzeige
                          zeile={zeileVon(p.id)!}
                          onOeffnen={() => void oeffneAnhangOrdner(p.id)}
                        />
                      )}

                      {matOpen && (
                        <div className="flex flex-col gap-1 border-t border-[var(--border)]/60 px-3 py-2">
                          {anz.fall === 'L3' && mats?.length === 0 && (
                            <p className="text-[11px] text-[var(--muted-foreground)]">{ANHANG_TEXTE.leereListe}</p>
                          )}
                          {(anz.fall === 'L3' || anz.fall === 'L5') && mats && mats.length > 0 && (
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
                          {anz.zeile && (
                            <p
                              className={cn(
                                'text-[11px] break-words',
                                anz.fall === 'L2' || anz.fall === 'L3'
                                  ? 'text-[var(--destructive)]'
                                  : 'text-[var(--muted-foreground)]',
                              )}
                            >
                              {anz.zeile}
                            </p>
                          )}
                          {anz.erneut && (
                            <Button size="sm" variant="outline" className="self-start" onClick={() => retryMaterials(p.id)}>
                              Erneut versuchen
                            </Button>
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
        {/* Ende der Side-Event-Liste (data.ok) */}

        {/* iveo-Paket, Spec 9.13 (T65): Side Events der Ablage, die die Liste oben nicht zeigt — auch ohne iveo-Cache. */}
        {weitere.length > 0 && (
          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <h3 className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
              {ORDNER_ZEILEN_TEXTE.weitere}
            </h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {weitere.map((se) => (
                <li key={se.programId} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
                  <div className="truncate px-3 pt-2 text-sm font-semibold" title={se.titel}>
                    {se.titel}
                  </div>
                  <OrdnerZeileAnzeige
                    zeile={ordnerZeile(se, ordnerUhr)}
                    onOeffnen={() => void oeffneAnhangOrdner(se.programId)}
                  />
                </li>
              ))}
            </ul>
          </div>
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
