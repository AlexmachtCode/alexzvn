// Live-Bereich des Stage-Displays (UX Welle 2a, Aufgabe d; Spec 3.4, 5.1; E4): die Vorschau (StageScreen, 16:9, unverändert) immer
// sichtbar, direkt darunter das Nachricht-Feld (wirkt mit jedem Tastendruck) und die Schalterreihe der Anzeige-Elemente (W2-8),
// zuletzt die eine Haupttaste „Bühnenschirm“ (öffnen/schließen) als TallyButton. Rein darstellend: Aktionen kommen aus der View,
// dieser Bereich liest kein window.
import { Field, TallyButton, TextInput, Toggle, type TallyButtonProps } from '@jm/ui';
import type { StageConfig, StageState } from '@shared/types';
import { StageScreen } from '@/components/StageScreen';
import { buehnenschirmTaste, schirmSollOffen, STAGE_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';

export interface LiveAktionen {
  /** Bühnenschirm: true öffnet, false schließt. */
  ausgabeUmschalten(an: boolean): void;
  nachricht(text: string): void;
  widget(key: keyof StageConfig['widgets'], an: boolean): void;
}

/** Die Haupttaste als Props: genau die Ableitung buehnenschirmTaste; der Klick öffnet oder schließt je nach gemessenem Fenster. */
export function liveTaste(s: OberflaechenStand, a: LiveAktionen): TallyButtonProps {
  return { ...buehnenschirmTaste(s), onClick: () => a.ausgabeUmschalten(!schirmSollOffen(s.ausgabe)) };
}

const ELEMENTE = ['clock', 'timer', 'switcher', 'presenter', 'message'] as const satisfies readonly (keyof StageConfig['widgets'])[];

const UEBERSCHRIFT = 'mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted-foreground)]';

export function LiveBereich({
  state,
  stand,
  now,
  aktionen,
}: {
  state: StageState;
  stand: OberflaechenStand;
  now: number;
  aktionen: LiveAktionen;
}): React.JSX.Element {
  const T = STAGE_TEXTE.live;
  const c = state.config;
  return (
    <div data-stage="live" className="space-y-5">
      <div>
        <h3 className={UEBERSCHRIFT}>{T.vorschau}</h3>
        <div data-stage="vorschau" className="aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
          <StageScreen state={state} now={now} />
        </div>
      </div>

      <div data-stage="nachricht">
        <Field label={T.nachrichtTitel}>
          <TextInput value={c.message} onChange={aktionen.nachricht} placeholder={T.nachrichtPlatzhalter} />
        </Field>
      </div>

      <div data-stage="elemente">
        <h3 className={UEBERSCHRIFT}>{T.elementeTitel}</h3>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {ELEMENTE.map((key) => (
            <Field key={key} label={T.elemente[key]} className="w-auto">
              <Toggle checked={c.widgets[key]} onChange={(an) => aktionen.widget(key, an)} />
            </Field>
          ))}
        </div>
      </div>

      <div data-stage="haupttaste" className="max-w-sm">
        <TallyButton {...liveTaste(stand, aktionen)} />
      </div>
    </div>
  );
}
