// Live-Bereich von Q&A (UX Welle 1, Aufgabe d; Spec 3.4, 5.1, Anhang A „Q&A“; E8, E13, E15, R10, R16): oben der Sprecher am Wort (immer
// sichtbar) und darunter die Haupttasten als TallyButtons (Nächste, Beenden, Saal-Einreichung); darunter scrollt der Rest: links
// Warteschlange, Hinzufügen, Erledigt, rechts die QR-Karten Saal und Extern (bei weniger als 640 px Breite unter der Warteschlange).
// Zustände der Tasten kommen aus hauptTasten (lib/oberflaeche.ts), die Handler sind die des Stores; die Kopplungskarte entfällt (E13).
//
// Platz (R16, Rechnung in lib/oberflaeche.ts): bei 960 × 640 mit Panel bleiben dem Inhalt 583 px, nach dem Innenabstand 551 px: Die
// Tasten stehen in einer Reihe, die QR-Karten unter der Warteschlange. Die obere Zone ist shrink-0 (die Frage scrollt im eigenen
// Kasten), der untere Bereich scrollt selbst (min-h-0): Nichts überlappt die Haupttasten.
import { TallyButton, type TallyButtonProps } from '@jm/ui';
import { ActivePanel } from '@/components/ActivePanel';
import { AddForm } from '@/components/AddForm';
import { CloudPanel } from '@/components/CloudPanel';
import { Queue } from '@/components/Queue';
import { RemotePanel } from '@/components/RemotePanel';
import { hauptTasten, type OberflaechenStand } from '@/lib/oberflaeche';
import type { QaState } from '@shared/types';

/** Was die Haupttasten auslösen: die Handler `next()`, `endActive()` und `setRemote(!remote.running)` des Stores. */
export interface LiveAktionen {
  next(): void;
  endActive(): void;
  setRemote(an: boolean): void;
}

// Container-Query statt Viewport: tastenAnordnung(breite) beschreibt das Raster. Die Klassen stehen als Literal da (Tailwind-Scan);
// 292 = TASTEN_ZWEI_BREITE, 444 = TASTEN_DREI_BREITE; gemessen wird die Inhaltsbox hinter dem Innenabstand.
const RASTER = 'grid w-full grid-cols-1 gap-3 @[292px]:grid-cols-2 @[444px]:grid-cols-3';
// „Nächste“ steht breit oben, solange nur zwei Spalten da sind; im Markup ist sie ohnehin die erste Taste (Tab).
const NAECHSTE_PLATZ = '@[292px]:col-span-2 @[444px]:col-span-1';

export type TastenRolle = 'naechste' | 'beenden' | 'saal';

/**
 * Die drei Haupttasten mit ihrer Rolle in Anzeigereihenfolge (Nächste, Beenden, Saal). Die Rolle ist der React-key: Die Beschriftung
 * der Saal-Taste wechselt, der Knopf bleibt (R10). HauptTasten, liveTasten und tastenSchluessel lesen alle hieraus.
 */
function rollenTasten(s: Pick<OberflaechenStand, 'state'>, a: LiveAktionen): Array<[TastenRolle, TallyButtonProps]> {
  const t = hauptTasten(s);
  return [
    ['naechste', { ...t.naechste, onClick: a.next }],
    ['beenden', { ...t.beenden, onClick: a.endActive }],
    ['saal', { ...t.saal, onClick: () => a.setRemote(!s.state.remote.running) }],
  ];
}

const KEINE: LiveAktionen = { next() {}, endActive() {}, setRemote() {} };

/** Die Rollen der Tasten in Anzeigereihenfolge, aus derselben Quelle wie das, was HauptTasten rendert. */
export function tastenSchluessel(s: Pick<OberflaechenStand, 'state'>): TastenRolle[] {
  return rollenTasten(s, KEINE).map(([rolle]) => rolle);
}

/** Die Haupttasten als Props in Anzeigereihenfolge. Ohne DOM prüfbar. */
export function liveTasten(s: Pick<OberflaechenStand, 'state'>, a: LiveAktionen): TallyButtonProps[] {
  return rollenTasten(s, a).map(([, taste]) => taste);
}

export function HauptTasten({ stand, aktionen }: { stand: Pick<OberflaechenStand, 'state'>; aktionen: LiveAktionen }): React.JSX.Element {
  return (
    <div data-qa="haupttasten" className="@container w-full">
      <div className={RASTER}>
        {rollenTasten(stand, aktionen).map(([rolle, taste]) =>
          rolle === 'naechste' ? (
            <div key={rolle} className={NAECHSTE_PLATZ}>
              <TallyButton {...taste} />
            </div>
          ) : (
            <TallyButton key={rolle} {...taste} />
          ),
        )}
      </div>
    </div>
  );
}

export function LiveBereich({ state, aktionen }: { state: QaState; aktionen: LiveAktionen }): React.JSX.Element {
  return (
    <div data-qa="live" className="flex h-full min-h-0 flex-col">
      <div data-qa="oben" className="shrink-0 space-y-3 p-4 pb-3">
        <ActivePanel state={state} />
        <HauptTasten stand={{ state }} aktionen={aktionen} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div data-qa="unten" className="@container px-4 pb-4">
          <div className="grid grid-cols-1 gap-4 @[640px]:grid-cols-[minmax(0,1fr)_256px]">
            <div data-qa="spalte-links" className="min-w-0 space-y-3">
              <Queue entries={state.entries} config={state.config} />
              <AddForm />
            </div>
            <div data-qa="spalte-rechts" className="min-w-0 space-y-3">
              <RemotePanel remote={state.remote} />
              <CloudPanel cloud={state.cloud} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
