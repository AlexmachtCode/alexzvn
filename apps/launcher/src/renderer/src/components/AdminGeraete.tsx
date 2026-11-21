import { useState } from 'react';
import { Button } from '@jm/ui';
import type { AdminUebersicht } from '@shared/konto';
import { ADMIN_TEXTE, REITER_TEXTE, altKeyTexte, alteLauncherZeilen, fehlerText, geraeteZeilen, raumFreigabeMeldung, raumZeilen } from '@/lib/admin-ansicht';
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
  const raeume = raumZeilen(daten);
  // RF7: eine Rückfrage zugleich. Die Anzeige wird beim Klick gemerkt, weil die Übersicht nach der Aktion neu lädt und die Zeile verschwinden kann.
  const [rueckfrage, setRueckfrage] = useState<{ raumHash: string; anzeige: string; frage: string } | null>(null);
  const [erfolg, setErfolg] = useState<string | null>(null);
  // Fehler von raum-freigeben stehen im Abschnitt selbst, damit sie bei vielen Rechnern nicht außer Sicht bleiben.
  const [raumFehler, setRaumFehler] = useState<string | null>(null);

  const markiere = async (gid: string, jm: boolean): Promise<void> => {
    setBusy(true);
    setMeldung(null);
    setErfolg(null);
    setRaumFehler(null);
    try {
      const r = await aktion({ aktion: 'geraet-markieren', gid, jm });
      if (!r.ok) setMeldung(fehlerText(r.code, 'geraet-markieren'));
    } finally {
      setBusy(false);
    }
  };

  // Der Aufruf selbst steht nur im Bestätigen-Knopf der Rückfrage (kein Weg am Dialog vorbei).
  const freigeben = async (anzeige: string, ruf: () => ReturnType<typeof aktion>): Promise<void> => {
    setBusy(true);
    setErfolg(null);
    setRaumFehler(null);
    try {
      const r = await ruf();
      setRueckfrage(null);
      if (r.ok) setErfolg(raumFreigabeMeldung(anzeige, r.ergebnis));
      else setRaumFehler(fehlerText(r.code, 'raum-freigeben'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-4 text-xs">
      <div className="flex flex-col gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] px-3 py-2">
        {altKeyTexte(daten).map((z) => (
          <p key={z} role="status">{z}</p>
        ))}
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
      {raeume !== null && (
        <div className="flex flex-col gap-1">
          <p className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">{REITER_TEXTE.raeumeTitel}</p>
          <p className="text-[var(--muted-foreground)]">{REITER_TEXTE.raeumeErklaerung}</p>
          {erfolg && (
            <p role="status" className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-2">
              {erfolg}
            </p>
          )}
          {raumFehler && (
            <p role="alert" className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-2">
              {raumFehler}
            </p>
          )}
          {raeume.length === 0 && <p>{REITER_TEXTE.keineRaeume}</p>}
          {raeume.map((z) => (
            <div key={z.raumHash} className="flex items-center justify-between gap-3">
              <p>{z.text}</p>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setErfolg(null);
                  setRaumFehler(null);
                  setRueckfrage({ raumHash: z.raumHash, anzeige: z.anzeige, frage: z.frage });
                }}
              >
                {REITER_TEXTE.raumFreigeben}
              </Button>
            </div>
          ))}
          {rueckfrage && (
            <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--border)] p-3">
              <p>{rueckfrage.frage}</p>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setRueckfrage(null)}>
                  {ADMIN_TEXTE.abbrechen}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void freigeben(rueckfrage.anzeige, () => aktion({ aktion: 'raum-freigeben', raumHash: rueckfrage.raumHash }))}
                >
                  {REITER_TEXTE.raumFreigeben}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">{REITER_TEXTE.alteLauncher}</p>
        {alteLauncherZeilen(daten).map((z) => (
          <p key={z}>{z}</p>
        ))}
      </div>
    </div>
  );
}
