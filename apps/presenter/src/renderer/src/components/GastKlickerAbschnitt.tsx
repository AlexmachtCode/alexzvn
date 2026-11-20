import { useEffect, useState } from 'react';
import { chatText, statusText, type GastKlickerStatus } from '@shared/gast-klicker';

/**
 * #317: Gast-Klicker übers Internet im Fenster „Fernsteuerung“. Remote-Gäste (z. B. per Zoom) öffnen einen Link
 * und schalten ihre Folien selbst vor/zurück; der Presenter verbindet sich dafür ausgehend mit dem Cloud-Dienst.
 */
export function GastKlickerAbschnitt() {
  const [s, setS] = useState<GastKlickerStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [kopiert, setKopiert] = useState(false);

  useEffect(() => {
    void window.jmpr.gastKlicker.status().then(setS);
    return window.jmpr.gastKlicker.onStatus(setS);
  }, []);

  const tu = async (fn: () => Promise<GastKlickerStatus>): Promise<void> => {
    setBusy(true);
    try {
      setS(await fn());
    } finally {
      setBusy(false);
    }
  };

  const kopiere = async (): Promise<void> => {
    if (!s?.link) return;
    try {
      await navigator.clipboard.writeText(chatText(s.link));
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    } catch {
      setKopiert(false);
    }
  };

  const an = s?.an ?? false;
  const ok = s?.lage === 'verbunden';

  return (
    <div className="mt-6 pt-5 border-t border-white/10">
      <h4 className="font-bold">🌐 Gast-Klicker übers Internet (Zoom-Gäste)</h4>
      <p className="text-sm text-white/50 mt-1 mb-4">
        Remote-Gäste öffnen einen Link im Browser und schalten ihre Folien selbst weiter – ohne Installation.
      </p>

      <div className="flex items-center justify-between rounded-lg bg-white/5 ring-1 ring-white/10 px-4 py-3">
        <div>
          <div className="font-semibold">Gast-Klicker {an ? 'an' : 'aus'}</div>
          <div className={`text-xs ${an && !ok ? 'text-[var(--destructive)]' : 'text-white/45'}`}>
            {s ? statusText(s) : '…'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void tu(() => window.jmpr.gastKlicker.setzeAn(!an))}
          disabled={busy || !s}
          aria-pressed={an}
          aria-label="Gast-Klicker ein/aus"
          className={`relative h-7 w-12 rounded-full transition-colors disabled:opacity-50 ${
            an ? 'bg-[var(--primary)]' : 'bg-white/20'
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${an ? 'left-[1.4rem]' : 'left-0.5'}`}
          />
        </button>
      </div>

      {an && s?.link && (
        <>
          <div className="mt-4">
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/45 font-bold">Link für die Gäste</span>
            <input
              readOnly
              value={s.link}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-1 w-full h-10 rounded-md bg-white/10 border border-white/15 px-2 text-sm font-mono"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void kopiere()}
              className="h-9 px-3 rounded-md bg-[var(--primary)] text-black text-sm font-semibold"
            >
              {kopiert ? 'Kopiert ✓' : 'Für den Zoom-Chat kopieren'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void tu(() => window.jmpr.gastKlicker.pause(!s.pausiert))}
              className={`h-9 px-3 rounded-md text-sm font-semibold ring-1 ${
                s.pausiert ? 'bg-amber-500/25 ring-amber-400/60' : 'bg-white/10 ring-white/15'
              }`}
            >
              {s.pausiert ? 'Gast-Klick fortsetzen' : 'Gast-Klick pausieren'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Neuen Link erzeugen? Der alte Link funktioniert dann nicht mehr.')) {
                  void tu(() => window.jmpr.gastKlicker.neuerLink());
                }
              }}
              className="h-9 px-3 rounded-md text-sm ring-1 bg-white/5 ring-white/15 text-white/70"
            >
              Neuer Link
            </button>
          </div>
          <p className="mt-3 text-xs text-white/45">
            Wer den Link hat, kann vor/zurück klicken. Ist Publikum im Chat, den Link privat an den Gast schicken. Dein
            eigener Clicker und die Tastatur wirken immer.
          </p>
        </>
      )}
    </div>
  );
}
