import { useState } from 'react';
import type { AdminUebersicht } from '@shared/konto';
import { REITER_TEXTE, altKeyText, alteLauncherZeilen, fehlerText, geraeteZeilen } from '@/lib/admin-ansicht';
import { useKonto } from '@/store/konto';

/**
 * Anmeldung (Plan P27, Spec 7, OF2; OFP2, EP9): Reiter „Geräte“ — Frist des alten Schlüssels (M44, ohne Enddatum als
 * Diagnose), Hinweis zu Connect (M47), Tabelle der Rechner (M43) mit Häkchen „JM-Rechner“ (geraet-markieren) und die Anfragen
 * alter Launcher je Tag, Gruppe und Plattform ohne IP (M45, M46).
 */
export function AdminGeraete({ daten }: { daten: AdminUebersicht }): React.JSX.Element {
  const aktion = useKonto((s) => s.adminAktion);
  const zeilen = geraeteZeilen(daten);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const markiere = async (gid: string, jm: boolean): Promise<void> => {
    setBusy(true);
    setMeldung(null);
    try {
      const r = await aktion({ aktion: 'geraet-markieren', gid, jm });
      if (!r.ok) setMeldung(fehlerText(r.code, 'geraet-markieren'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-4 text-xs">
      <div className="flex flex-col gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] px-3 py-2">
        <p role="status">{altKeyText(daten)}</p>
        <p className="text-[var(--muted-foreground)]">{REITER_TEXTE.connect}</p>
      </div>
      {meldung && (
        <p role="alert" className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-2">
          {meldung}
        </p>
      )}
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
            <th className="py-1 pr-3">{REITER_TEXTE.spalteRechner}</th>
            <th className="py-1 pr-3">{REITER_TEXTE.spalteKonto}</th>
            <th className="py-1 pr-3">{REITER_TEXTE.spalteKontakt}</th>
            <th className="py-1 pr-3">{REITER_TEXTE.spalteVersion}</th>
            <th className="py-1 pr-3">{REITER_TEXTE.spaltePlattform}</th>
            <th className="py-1">{REITER_TEXTE.spalteJm}</th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map((g) => (
            <tr key={g.gid} className="border-t border-[var(--border)]/60">
              <td className="py-1 pr-3 font-semibold">{g.rechner}</td>
              <td className="py-1 pr-3">{g.konto}</td>
              <td className="py-1 pr-3 tabular-nums">{g.kontakt}</td>
              <td className="py-1 pr-3 tabular-nums">{g.version}</td>
              <td className="py-1 pr-3">{g.plattform}</td>
              <td className="py-1">
                <input
                  type="checkbox"
                  aria-label={`${REITER_TEXTE.spalteJm} ${g.rechner}`}
                  checked={g.jm}
                  disabled={busy}
                  onChange={(e) => void markiere(g.gid, e.target.checked)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-col gap-1">
        <p className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">{REITER_TEXTE.alteLauncher}</p>
        {alteLauncherZeilen(daten).map((z) => (
          <p key={z}>{z}</p>
        ))}
      </div>
    </div>
  );
}
