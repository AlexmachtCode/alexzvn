import { useEffect, useState } from 'react';
import { Button, Card, cn, noDragRegion } from '@jm/ui';
import { ADMIN_TEXTE, adminKnopfSichtbar, ladeFehlerText } from '@/lib/admin-ansicht';
import { KONTO_TEXTE } from '@/lib/konto-dialog';
import { useKonto } from '@/store/konto';
import { AdminZugaenge } from './AdminZugaenge';
import { AdminIveo } from './AdminIveo';
import { AdminAnfragen } from './AdminAnfragen';
import { AdminGeraete } from './AdminGeraete';

type Reiter = 'zugaenge' | 'iveo' | 'anfragen' | 'geraete';
/** M2: Reiter der Admin-Maske (Aufbau A, Spec 7). */
const REITER: Array<{ key: Reiter; label: string }> = [
  { key: 'zugaenge', label: ADMIN_TEXTE.reiter.zugaenge },
  { key: 'iveo', label: ADMIN_TEXTE.reiter.iveo },
  { key: 'anfragen', label: ADMIN_TEXTE.reiter.anfragen },
  { key: 'geraete', label: ADMIN_TEXTE.reiter.geraete },
];

/**
 * Anmeldung (Plan P26, Spec 7, EP15): Admin-Maske, Aufbau A — Reiter oben (Muster TabBar.tsx), je Reiter Liste links und
 * Details rechts. Daten aus einer Abfrage (/konto/admin/uebersicht), nach jeder Aktion die neue Übersicht. Nur für Admins
 * (adminKnopfSichtbar); antwortet der Worker „kein Recht“ (herabgestuft, OFP4), schließt der Store die Maske mit M5.
 * Muster wie SystemStatusModal (G11), breiter (max-w-5xl).
 */
export function AdminModal(): React.JSX.Element | null {
  const offen = useKonto((s) => s.adminOffen);
  const ansicht = useKonto((s) => s.ansicht);
  const admin = useKonto((s) => s.admin);
  const schliessen = useKonto((s) => s.schliesseAdmin);
  const laden = useKonto((s) => s.adminLaden);
  const [reiter, setReiter] = useState<Reiter>('zugaenge');

  useEffect(() => {
    if (!offen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') schliessen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [offen, schliessen]);

  if (!offen || !adminKnopfSichtbar(ansicht)) return null;
  const daten = admin.daten;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-6"
      style={noDragRegion}
      onClick={(e) => {
        if (e.target === e.currentTarget) schliessen();
      }}
    >
      <Card className="w-full max-w-5xl p-6 jm-fade-in">
        <div className="flex max-h-[calc(100vh-6rem)] flex-col">
          <div className="flex shrink-0 flex-col gap-3">
            <h2 className="text-lg font-extrabold tracking-tight">{ADMIN_TEXTE.titel}</h2>
            <div role="tablist" aria-label={ADMIN_TEXTE.titel} className="flex items-center gap-1 border-b border-[var(--border)]/60">
              {REITER.map((r) => {
                const aktiv = reiter === r.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    role="tab"
                    aria-selected={aktiv}
                    onClick={() => setReiter(r.key)}
                    className={cn(
                      '-mb-px h-9 px-3 text-xs font-extrabold uppercase tracking-[0.08em] border-b-2 transition-colors',
                      aktiv ? 'border-[var(--primary)] text-[var(--foreground)]' : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
                    )}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
            {admin.fehler && (
              <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--destructive)]/40 px-3 py-2 text-xs text-[var(--destructive)]">
                <span>{ladeFehlerText(admin.fehler)}</span>
                <Button size="sm" variant="outline" onClick={() => void laden()}>
                  {ADMIN_TEXTE.neuLaden}
                </Button>
              </div>
            )}
            {!daten && !admin.fehler && <p className="mt-4 text-xs text-[var(--muted-foreground)]">{ADMIN_TEXTE.laedt}</p>}
            {daten && reiter === 'zugaenge' && <AdminZugaenge daten={daten} />}
            {daten && reiter === 'iveo' && <AdminIveo daten={daten} />}
            {daten && reiter === 'anfragen' && <AdminAnfragen daten={daten} />}
            {daten && reiter === 'geraete' && <AdminGeraete daten={daten} />}
          </div>

          <div className="mt-4 flex shrink-0 items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
            <Button variant="ghost" onClick={schliessen}>
              {KONTO_TEXTE.schliessen}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
