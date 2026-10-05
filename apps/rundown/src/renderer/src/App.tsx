import { useEffect, useState } from 'react';
import { useRundown } from '@/store/useRundown';
import { exportRegieplan, parseRegieplan } from '@/lib/regieplan';
import { applyImportedRows, rowsFromImport } from '@/lib/doc';
import { importMeldung, zeilenArt, type ShowSicht } from '@shared/zeilen';
import type { RundownDoc } from '@shared/types';
import { ToolLinks } from '@/components/ToolLinks';
import { Transport } from '@/components/Transport';
import { RundownList } from '@/components/RundownList';
import { RowEditor } from '@/components/RowEditor';
import { ConnectionsPanel } from '@/components/ConnectionsPanel';

const hdrBtn =
  'rounded-md border border-[var(--border)] px-2.5 py-1 text-[var(--foreground)] hover:bg-[var(--highlight)]';

export function App() {
  const { state, load, nav, setDoc, newDoc, open, save, saveAs, setEndpoint, hinweisWeg, alsEigeneZeile } =
    useRundown();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showConnections, setShowConnections] = useState(false);
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
  // (nur außerhalb von Eingabefeldern, damit das Tippen nicht stört).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
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

  const selectedRow =
    state.doc.rows.find((r) => r.id === selectedId) ?? state.doc.rows[state.index] ?? null;
  // Was Liste und Editor über die gemerkte Show wissen (4.5, 6.2).
  const sicht: ShowSicht = {
    showGemerkt: state.showGemerkt,
    mitIveo: state.showMitIveo,
    ablaufSchluessel: state.ablaufSchluessel,
    eigeneTimerListe: state.eigeneTimerListe,
  };
  // 5.5: Jede Bearbeitung trägt den rev des Stands, aus dem sie berechnet wurde.
  // Nach einer Abweisung baut `state.abweisungen` im Schlüssel des Editors die
  // ungesteuerten Felder neu auf, damit sie den gespeicherten Stand zeigen.
  const aendere = (d: RundownDoc): void => void setDoc(d, state.rev);

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

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-2">
        <span className="font-bold">JM Rundown</span>
        <input
          key={`${state.doc.name}|${state.filePath ?? ''}|${state.abweisungen}`}
          defaultValue={state.doc.name}
          onBlur={(e) => aendere({ ...state.doc, name: e.target.value })}
          className="rounded border border-transparent bg-transparent px-2 py-0.5 text-sm hover:border-[var(--border)] focus:border-[var(--ring)] focus:outline-none"
        />
        {state.dirty && <span className="text-xs text-[var(--brand-yellow)]">• ungespeichert</span>}
        {notice && <span className="text-xs text-[var(--muted-foreground)]">{notice}</span>}
        <div className="ml-auto flex items-center gap-1.5 text-sm">
          <button onClick={() => void newDoc()} className={hdrBtn}>
            Neu
          </button>
          <button onClick={() => void open()} className={hdrBtn}>
            Öffnen
          </button>
          <button
            onClick={() => void importRegieplan()}
            title="Regieplan aus Excel/CSV importieren — legt je Punkt eine Zeile an"
            className={hdrBtn}
          >
            Regieplan…
          </button>
          <button
            onClick={() => void exportPlan()}
            title="Aktuellen Ablauf als Regieplan (Excel) exportieren — z. B. für den JM Timer"
            className={hdrBtn}
          >
            Export…
          </button>
          <button onClick={() => void save()} className={hdrBtn}>
            Speichern
          </button>
          <button onClick={() => void saveAs()} className={hdrBtn}>
            Speichern unter …
          </button>
        </div>
      </header>

      <ToolLinks links={state.links} onOpenConnections={() => setShowConnections(true)} />

      {state.hinweise.length > 0 && (
        // 4.6: Kurze Hinweise entfernt der Main nach 6 s, stehende klickt der Bediener weg.
        <div className="space-y-1 border-b border-[var(--border)] px-4 py-1.5">
          {state.hinweise.map((h) => (
            <div
              key={h.id}
              className={`flex items-center gap-2 text-xs ${
                h.art === 'stehend' ? 'text-[var(--warning)]' : 'text-[var(--muted-foreground)]'
              }`}
            >
              <span className="min-w-0 flex-1">{h.text}</span>
              {h.art === 'stehend' && (
                <button
                  onClick={() => void hinweisWeg(h.id)}
                  title="Hinweis schließen"
                  className="rounded px-1.5 py-0.5 text-xs hover:bg-[var(--highlight)]"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 border-r border-[var(--border)]">
          <RundownList
            doc={state.doc}
            index={state.index}
            selectedId={selectedRow?.id ?? null}
            onSelect={setSelectedId}
            onSetCue={(i) => void nav({ t: 'goto', n: i + 1 })}
            onDoc={aendere}
            sicht={sicht}
            iveoSpeakers={state.iveoSpeakers ?? []}
          />
        </div>
        <div className="w-[26rem] shrink-0">
          {selectedRow ? (
            <RowEditor
              key={`${selectedRow.id}:${state.abweisungen}`}
              doc={state.doc}
              row={selectedRow}
              iveoSpeakers={state.iveoSpeakers ?? []}
              iveoSideEvents={state.iveoSideEvents ?? []}
              sicht={sicht}
              onDoc={aendere}
              onAlsEigeneZeile={(rowId) => void alsEigeneZeile(rowId)}
            />
          ) : (
            <div className="grid h-full place-items-center text-sm text-[var(--muted-foreground)]">
              Keine Zeile gewählt.
            </div>
          )}
        </div>
      </div>

      <Transport state={state} onNav={(cmd) => void nav(cmd)} />

      {showConnections && (
        <ConnectionsPanel
          links={state.links}
          overrides={state.overrides}
          onSet={(role, host, port) => void setEndpoint(role, host, port)}
          onClose={() => setShowConnections(false)}
        />
      )}
    </div>
  );
}
