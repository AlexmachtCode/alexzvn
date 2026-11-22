// Einstellungs-Panel des Interpreters (UX Welle 2a, Interpreter d; Spec 3.6, 6.2; E10, E15; Funktionsliste Nr. 8–11, 29–39):
// Audiogerät aus @jm/settings mit den drei Wahlen aus lib/oberflaeche.ts (dieselbe Ableitung wie die Statusleiste: Floor und
// Dolmetscher Pflicht, Ausgabe mit „Systemstandard“, Pegel nur im Lauf, je mit „Wirkt erst nach Stopp und erneutem Start.“),
// dahinter der tool-eigene Abschnitt „Ducking“ (vorher die Karten „Ducking“ und „Vorverstärkung“): Bypass, fünf Regler,
// Unterüberschrift „Vorverstärkung“ mit zwei Reglern, „Ducking-Werte zurücksetzen“. Jedes Feld ruft dieselbe Store-Aktion wie
// bisher (lib/aktionen.ts): Die Wahlen speichern nur (die Engine liest die Geräte erst beim nächsten Start), Regler und Bypass
// wirken wie bisher sofort über die Effekte der Wurzel-View. Native Regler und Kästchen wie bisher (Pfeile und Leertaste gehören
// dem Feld, O1). Jeder Abschnitt ist ein Sprungziel (PanelAnker, id wie das settingsSection des Statuseintrags). Kein window, kein
// Store, keine Hooks (E15): Stand, Werte und Aktionen kommen aus der View.
import { AudioDeviceSection } from '@jm/settings';
import { Button, PanelAnker, SettingsSection } from '@jm/ui';
import type { DuckSettings } from '@shared/ducking';
import type { PanelAktionen } from '@/lib/aktionen';
import { ABSCHNITT, DUCKING_REGLER, geraeteAbschnitt, INTERPRETER_TEXTE, VORVERSTAERKUNG_REGLER, type OberflaechenStand, type Regler } from '@/lib/oberflaeche';

/** Die Werte des Abschnitts „Ducking“ aus dem Speicher: die sieben Regler und der Bypass. */
export type ReglerWerte = DuckSettings & { bypass: boolean };

export interface EinstellungenProps {
  stand: OberflaechenStand;
  werte: ReglerWerte;
  aktionen: PanelAktionen;
}

/** Ein Regler wie der alte Slider (App.tsx:242-281): Beschriftung, Wert mit Einheit, Bereich, Hinweis darunter. */
function regler(r: Regler, wert: number, aktionen: PanelAktionen): React.JSX.Element {
  const id = `in-regler-${r.key}`;
  return (
    <div key={r.key} data-regler={r.key} className="mb-3">
      <div className="flex justify-between text-xs">
        <label htmlFor={id} className="text-[var(--foreground)]">
          {r.label}
        </label>
        <span className="tabular-nums text-[var(--muted-foreground)]">{`${wert} ${r.einheit}`}</span>
      </div>
      <input
        id={id}
        type="range"
        min={r.min}
        max={r.max}
        step={r.step}
        value={wert}
        onChange={(e) => aktionen.regler(r.key, Number(e.target.value))}
        aria-describedby={r.hinweis ? `${id}-hinweis` : undefined}
        className="w-full accent-[var(--primary)]"
      />
      {r.hinweis ? (
        <div id={`${id}-hinweis`} className="text-[11px] text-[var(--muted-foreground)]">
          {r.hinweis}
        </div>
      ) : null}
    </div>
  );
}

export function Einstellungen({ stand, werte, aktionen }: EinstellungenProps): React.JSX.Element {
  const T = INTERPRETER_TEXTE;
  return (
    <div className="space-y-5">
      <AudioDeviceSection {...geraeteAbschnitt(stand, aktionen)} />

      <PanelAnker id={ABSCHNITT.ducking}>
        <SettingsSection title={T.ducking.titel}>
          <label className="flex w-fit cursor-pointer select-none items-center gap-2 text-xs text-[var(--foreground)]">
            <input
              type="checkbox"
              data-interpreter="bypass"
              checked={werte.bypass}
              onChange={(e) => aktionen.bypass(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            {T.ducking.bypass}
          </label>
          <div>{DUCKING_REGLER.map((r) => regler(r, werte[r.key], aktionen))}</div>
          <h4 className="text-sm font-semibold text-[var(--foreground)]">{T.ducking.vorverstaerkung}</h4>
          <div>{VORVERSTAERKUNG_REGLER.map((r) => regler(r, werte[r.key], aktionen))}</div>
          <Button type="button" variant="outline" size="sm" uppercase={false} onClick={() => aktionen.zuruecksetzen()}>
            {T.ducking.zuruecksetzen}
          </Button>
        </SettingsSection>
      </PanelAnker>
    </div>
  );
}
