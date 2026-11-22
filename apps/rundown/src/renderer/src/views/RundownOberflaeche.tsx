// Oberfläche des Rundowns (UX Welle 1, Aufgabe d; Spec 3.1, 3.8, 5.1; E11, E12, E17): AppShell mit Kopf (JM Rundown, ⚙, Hell/Dunkel,
// V-Zeile in der Mitte), der Werkzeugleiste mit den Datei-Knöpfen, der Statusleiste aus lib/oberflaeche.ts und dem Einstellungs-Panel.
// Im Inhalt links die Spalte der Liste (Hinweise, Zeilen, darunter der Transport mit GO), rechts der Editor der gewählten Zeile.
// Brücken und Panelzustand laufen hier, auch bei geschlossenem Panel; das Panel selbst hat keine Effekte (G7, G8). Laden, Tastatur-
// Regie und Regieplan-Import liegen darüber in App.tsx (immer gemountet). Der Editor steht neben dem Panel, nie darin: Beim Öffnen
// des Panels bleibt er gemountet, seine ungesteuerten Felder verlieren nichts (E11).
import { useState } from 'react';
import { AppShell, useBrueckenWert } from '@jm/ui';
import { Hinweise } from '@/components/Hinweise';
import { RowEditor } from '@/components/RowEditor';
import { RundownList } from '@/components/RundownList';
import { Transport } from '@/components/Transport';
import { FERNSTEUERUNG_QUELLE, MASTER_LINK_QUELLE, VERBUND_QUELLE } from '@/lib/bruecken';
import { statusLeiste, type OberflaechenStand, type RundownAktionen } from '@/lib/oberflaeche';
import type { ShowSicht } from '@shared/zeilen';
import type { RundownDoc, RundownNav, RundownState } from '@shared/types';
import { Einstellungen } from './Einstellungen';
import { KopfMitte } from './KopfMitte';
import { Werkzeugleiste } from './Werkzeugleiste';

/** Alles, was die Oberfläche auslöst: die Handler des Stores und die Abläufe aus App.tsx (Import mit Rückfrage, Export). */
export interface RundownViewAktionen extends RundownAktionen {
  nav(cmd: RundownNav): void;
  /** `rev` = `state.rev` des Stands, aus dem `doc` berechnet wurde (5.5). */
  setDoc(doc: RundownDoc, rev: number): void;
  neu(): void;
  oeffnen(): void;
  regieplan(): void;
  exportieren(): void;
  speichern(): void;
  speichernUnter(): void;
  hinweisWeg(id: number): void;
  alsEigeneZeile(rowId: string): void;
}

export function RundownOberflaeche({
  state,
  notice,
  aktionen,
  anfangOffen = false,
}: {
  state: RundownState;
  /** Kurze Rückmeldung (Import, Export) für die Werkzeugleiste. */
  notice: string | null;
  aktionen: RundownViewAktionen;
  /** Panel beim Start offen (nur für Tests; im Betrieb zu, nichts gemerkt). */
  anfangOffen?: boolean;
}): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Einstellungs-Panel (Spec 3.1, 3.6): zu beim Start, nichts gemerkt; offen über ⚙ oder einen Statuseintrag.
  const [panelOffen, setPanelOffen] = useState(anfangOffen);
  const [panelAbschnitt, setPanelAbschnitt] = useState<string | undefined>(undefined);

  // Lesende Brücken (Spec 3.9): undefined, bis eine Antwort oder ein Ereignis da ist; ohne Preload null.
  const masterLink = useBrueckenWert(MASTER_LINK_QUELLE);
  const fernsteuerung = useBrueckenWert(FERNSTEUERUNG_QUELLE);
  const verbund = useBrueckenWert(VERBUND_QUELLE);

  // Ein Stand für Statusleiste und Panel (lib/oberflaeche.ts): beide zeigen dieselbe Ableitung.
  const stand: OberflaechenStand = { state, masterLink, fernsteuerung, verbund };

  const selectedRow = state.doc.rows.find((r) => r.id === selectedId) ?? state.doc.rows[state.index] ?? null;
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
  const aendere = (d: RundownDoc): void => aktionen.setDoc(d, state.rev);

  return (
    <AppShell
      tool="Rundown"
      headerCenter={<KopfMitte anzeige={verbund} />}
      toolbar={<Werkzeugleiste state={state} notice={notice} aktionen={{ ...aktionen, umbenennen: (name) => aendere({ ...state.doc, name }) }} />}
      status={statusLeiste(stand)}
      settings={<Einstellungen stand={stand} aktionen={aktionen} />}
      settingsOpen={panelOffen}
      settingsSection={panelAbschnitt}
      onSettingsChange={(offen, abschnitt) => {
        setPanelOffen(offen);
        setPanelAbschnitt(abschnitt);
      }}
    >
      <div className="flex h-full min-h-0">
        <div data-rundown="spalte-liste" className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-[var(--border)]">
          {/* 4.6: Kurze Hinweise entfernt der Main nach 6 s, stehende klickt der Bediener weg. */}
          <Hinweise hinweise={state.hinweise} onWeg={aktionen.hinweisWeg} />
          <div className="min-h-0 flex-1">
            <RundownList
              doc={state.doc}
              index={state.index}
              selectedId={selectedRow?.id ?? null}
              onSelect={setSelectedId}
              onSetCue={(i) => aktionen.nav({ t: 'goto', n: i + 1 })}
              onDoc={aendere}
              sicht={sicht}
              iveoSpeakers={state.iveoSpeakers ?? []}
            />
          </div>
          <Transport state={state} onNav={aktionen.nav} />
        </div>
        <div data-rundown="spalte-editor" className="w-[26rem] shrink-0">
          {selectedRow ? (
            <RowEditor
              key={`${selectedRow.id}:${state.abweisungen}`}
              doc={state.doc}
              row={selectedRow}
              iveoSpeakers={state.iveoSpeakers ?? []}
              iveoSideEvents={state.iveoSideEvents ?? []}
              sicht={sicht}
              onDoc={aendere}
              onAlsEigeneZeile={aktionen.alsEigeneZeile}
            />
          ) : (
            <div className="grid h-full place-items-center text-sm text-[var(--muted-foreground)]">Keine Zeile gewählt.</div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
