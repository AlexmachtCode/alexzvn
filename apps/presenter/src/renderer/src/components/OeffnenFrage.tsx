import { useEffect, useId, useRef } from 'react';
import { useProject } from '@/store/project';

/** Eine Datei mit Namen, mehrere als Anzahl (nur PDFs → „PDFs“). */
function titel(namen: string[]): string {
  if (namen.length === 1) return `„${namen[0]}“ öffnen`;
  const allePdf = namen.every((n) => /\.pdf$/i.test(n));
  return `${namen.length} ${allePdf ? 'PDFs' : 'Dateien'} öffnen`;
}

/**
 * Doppelklick / „Öffnen mit“ (#299) bei schon belegtem Editor: ersetzen, anhängen oder
 * lassen. Was ankommt, während die Frage offen ist, landet in derselben Frage (Store).
 */
export function OeffnenFrage() {
  const frage = useProject((s) => s.frage);
  const dirty = useProject((s) => s.dirty);
  const beantworte = useProject((s) => s.beantworteFrage);
  const kopfId = useId();
  const anhaengen = useRef<HTMLButtonElement>(null);
  const offen = frage !== null;

  useEffect(() => {
    if (!offen) return;
    anhaengen.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      void beantworte('abbrechen');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [offen, beantworte]);

  if (!frage) return null;

  const knopf = 'h-10 px-4 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 font-semibold whitespace-nowrap';
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={kopfId}
        className="w-full max-w-md rounded-2xl bg-[#161616] ring-1 ring-white/10 p-6"
      >
        <h3 id={kopfId} className="text-lg font-bold break-words">
          {titel(frage.files.map((f) => f.name))}
        </h3>
        <p className="mt-1 text-sm text-white/60">Im Presenter liegt schon eine Präsentation.</p>
        {dirty && (
          <p className="mt-2 text-sm text-amber-300">Beim Ersetzen gehen nicht gespeicherte Änderungen verloren.</p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" className={knopf} onClick={() => void beantworte('ersetzen')}>
            Ersetzen
          </button>
          <button
            ref={anhaengen}
            type="button"
            className="h-10 px-5 rounded-md bg-[var(--primary)] text-[var(--brand-dark)] font-bold whitespace-nowrap"
            onClick={() => void beantworte('anhaengen')}
          >
            Anhängen
          </button>
          <button type="button" className={knopf} onClick={() => void beantworte('abbrechen')}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
