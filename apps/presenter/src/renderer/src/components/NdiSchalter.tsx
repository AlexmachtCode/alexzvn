import { cn } from '@jm/ui';
import { ndiSchalterText } from '../../../shared/ndi';
import { useNdiStatus } from '@/lib/useNdiStatus';

const TIPP = 'NDI-Ausgang „JM Presenter“: 1920×1080, 25 fps, transparente Ränder';

// Aussehen wie die Knöpfe der jeweiligen Leiste (Toolbar `btn`, PresenterView `HeaderBtn`).
const GRUNDFORM = {
  editor:
    'h-9 px-3 rounded-md text-sm font-semibold whitespace-nowrap border transition-colors ' +
    'disabled:opacity-40 disabled:pointer-events-none',
  referent: 'h-8 px-3 rounded-md text-xs font-semibold whitespace-nowrap border transition-colors disabled:opacity-40 disabled:pointer-events-none',
} as const;

const RUHIG = {
  editor: 'border-[var(--border)] bg-[var(--card)] hover:bg-[var(--highlight)]',
  referent: 'bg-white/10 border-white/15 hover:bg-white/20',
} as const;

const BERNSTEIN = 'border-amber-400/60 bg-amber-400/15 text-amber-300 hover:bg-amber-400/25';

/** NDI-Schalter mit Empfängerzahl; Editor-Werkzeugleiste und Referentenansicht zeigen denselben Status. */
export function NdiSchalter({ variante }: { variante: 'editor' | 'referent' }) {
  const { status, setzeAn } = useNdiStatus();
  const sendet = status.lage === 'sendet';
  const bernstein = status.an && status.lage === 'nicht-verfuegbar';

  return (
    <button
      type="button"
      onClick={() => setzeAn(!status.an)}
      disabled={window.jmpr.platform !== 'win32'}
      title={status.grund ?? TIPP}
      className={cn(
        GRUNDFORM[variante],
        bernstein
          ? BERNSTEIN
          : sendet
            ? 'bg-[var(--primary)] text-[var(--brand-dark)] border-[var(--primary)]'
            : RUHIG[variante],
      )}
    >
      {ndiSchalterText(status)}
    </button>
  );
}
