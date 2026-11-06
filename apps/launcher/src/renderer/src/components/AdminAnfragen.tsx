import { useState } from 'react';
import { Button, cn } from '@jm/ui';
import type { AdminUebersicht } from '@shared/konto';
import { ADMIN_TEXTE, REITER_TEXTE, anfrageFreigabe, anfrageZeilen, fehlerText } from '@/lib/admin-ansicht';
import { useKonto } from '@/store/konto';

const feldCls = cn(
  'h-8 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2.5 text-xs text-[var(--foreground)]',
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
);

/**
 * Anmeldung (Plan P27, Spec 8 (2–4), 7): Reiter „Anfragen“ — offene Zoom-Anfragen (M40) mit Warnung für Nicht-JM-Rechner
 * (M41); „Freigeben bis …“ mit Datum (vorbelegt mit dem gewünschten Ende, gilt bis Tagesende der Ortszeit) oder „Ablehnen“
 * (M42). Nach jeder Aktion kommt die neue Übersicht; der Punkt am Zahnrad folgt über die Lage (P21).
 */
export function AdminAnfragen({ daten }: { daten: AdminUebersicht }): React.JSX.Element {
  const aktion = useKonto((s) => s.adminAktion);
  const zeilen = anfrageZeilen(daten);
  const [bisFelder, setBisFelder] = useState<Record<string, string>>({});
  const [meldung, setMeldung] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fuehreAus = async (a: Parameters<typeof aktion>[0]): Promise<void> => {
    setBusy(true);
    setMeldung(null);
    try {
      const r = await aktion(a);
      if (!r.ok) setMeldung(fehlerText(r.code, a.aktion));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-3">
      {meldung && (
        <p role="alert" className="text-xs rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] px-3 py-2">
          {meldung}
        </p>
      )}
      {/* M48 (EP34): Connect nutzt die Zoom-Freigabe erst mit Teil 2; gespeichert wird sie schon. */}
      <p className="text-[11px] text-[var(--muted-foreground)]">{ADMIN_TEXTE.connectTeil1}</p>
      {zeilen.length === 0 && <p className="text-xs text-[var(--muted-foreground)]">{REITER_TEXTE.keineAnfragen}</p>}
      {zeilen.map((z) => {
        const feld = bisFelder[z.id] ?? z.bisFeld;
        return (
          <div key={z.id} className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--border)] p-3 text-xs">
            <p>{z.text}</p>
            {z.warnung && <p className="font-semibold text-[var(--destructive)]">{z.warnung}</p>}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <input type="date" className={feldCls} value={feld} onChange={(e) => setBisFelder({ ...bisFelder, [z.id]: e.target.value })} />
              <Button
                size="sm"
                variant="primary"
                disabled={busy}
                onClick={() => {
                  const a = anfrageFreigabe(z.id, feld);
                  if ('fehler' in a) setMeldung(a.fehler);
                  else void fuehreAus(a);
                }}
              >
                {REITER_TEXTE.freigeben}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void fuehreAus({ aktion: 'anfrage-ablehnen', id: z.id })}>
                {REITER_TEXTE.ablehnen}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
