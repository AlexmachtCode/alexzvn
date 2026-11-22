import { useEffect, useState } from 'react';
import { useRundown } from '@/store/useRundown';
import { exportRegieplan, parseRegieplan } from '@/lib/regieplan';
import { applyImportedRows, rowsFromImport } from '@/lib/doc';
import { importMeldung, zeilenArt } from '@shared/zeilen';
import { istEingabeZiel } from '@/lib/oberflaeche';
import { RundownOberflaeche, type RundownViewAktionen } from '@/views/RundownOberflaeche';

export function App() {
  const { state, load, nav, setDoc, newDoc, open, save, saveAs, setEndpoint, hinweisWeg, alsEigeneZeile } =
    useRundown();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  // Kurze Rückmeldung (Import) automatisch ausblenden.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  // Tastatur-Regie: Leertaste = GO, Pfeil hoch/runter = Zurück/Weiter
  // (nur außerhalb von Eingabefeldern, damit das Tippen nicht stört: INPUT, TEXTAREA, SELECT, contentEditable).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (istEingabeZiel(e.target)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        void nav({ t: 'go' });
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        void nav({ t: 'next' });
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        void nav({ t: 'prev' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav]);

  if (!state) {
    return <div className="grid h-full place-items-center text-[var(--muted-foreground)]">Lädt …</div>;
  }

  // Regieplan-Import (Issue #82): Excel/CSV wählen → Punkte als Zeilen anlegen.
  async function importRegieplan(): Promise<void> {
    const file = await window.jmrundown.importRegieplan();
    if (!file || !state) return;
    try {
      const parsed = await parseRegieplan(file.bytes);
      const rows = rowsFromImport(parsed.rows);
      if (rows.length === 0) {
        setNotice('Keine Regieplan-Punkte erkannt — ist eine Titel-Spalte vorhanden?');
        return;
      }
      // 4.5: Mit gemerkter Show ersetzt „Ersetzen“ nur die eigenen Zeilen.
      const ersetzbar = state.showGemerkt
        ? state.doc.rows.filter((r) => zeilenArt(r) === 'eigen').length
        : state.doc.rows.length;
      const replace =
        ersetzbar === 0
          ? true
          : window.confirm(
              `${rows.length} Regieplan-Punkte aus „${file.name}" gefunden.\n\n` +
                (state.showGemerkt
                  ? 'OK = eigene Zeilen ERSETZEN (Zeilen aus der Show bleiben)\n'
                  : 'OK = aktuellen Ablauf ERSETZEN\n') +
                'Abbrechen = anhängen',
            );
      const vorher = useRundown.getState().state?.abweisungen ?? 0;
      await setDoc(applyImportedRows(state.doc, rows, replace, state.showGemerkt), state.rev);
      const nachher = useRundown.getState().state?.abweisungen ?? 0;
      setNotice(importMeldung(rows.length, replace, vorher, nachher));
    } catch (e) {
      setNotice(`Import fehlgeschlagen: ${(e as Error).message}`);
    }
  }

  // Regieplan-Export (Issue #85): aktuellen Ablauf als Excel — vom JM Timer lesbar.
  async function exportPlan(): Promise<void> {
    if (!state || state.doc.rows.length === 0) {
      setNotice('Kein Ablauf zum Exportieren.');
      return;
    }
    try {
      await exportRegieplan(state.doc.rows, `${state.doc.name || 'JM-Rundown'}-Regieplan.xlsx`);
      setNotice('Regieplan als Excel exportiert.');
    } catch (e) {
      setNotice(`Export fehlgeschlagen: ${(e as Error).message}`);
    }
  }

  const aktionen: RundownViewAktionen = {
    nav: (cmd) => void nav(cmd),
    setDoc: (doc, rev) => void setDoc(doc, rev),
    neu: () => void newDoc(),
    oeffnen: () => void open(),
    regieplan: () => void importRegieplan(),
    exportieren: () => void exportPlan(),
    speichern: () => void save(),
    speichernUnter: () => void saveAs(),
    setEndpoint: (role, host, port) => void setEndpoint(role, host, port),
    hinweisWeg: (id) => void hinweisWeg(id),
    alsEigeneZeile: (rowId) => void alsEigeneZeile(rowId),
  };

  return <RundownOberflaeche state={state} notice={notice} aktionen={aktionen} />;
}
