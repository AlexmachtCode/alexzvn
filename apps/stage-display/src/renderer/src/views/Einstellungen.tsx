// Einstellungs-Panel des Stage-Displays (UX Welle 2a, Aufgabe d; Spec 3.6, 6; E3, E12, E15): „Ausgabe auf Bildschirm“ (Bühnenschirm)
// und „Gegenstellen“ (die drei Quellen) aus @jm/settings mit den Props aus lib/oberflaeche.ts – dieselbe Ableitung wie die
// Statusleiste, also eine Wahrheit –, dahinter der tool-eigene Abschnitt „Presenter-Kopplung“ (PIN und Anzeige), nur solange die Presenter-Quelle an ist (wie bisher);
// die PIN steht seit Altfehler SD-5 verdeckt im PinFeld und gilt erst mit „Setzen“ (die Hülle hält den Entwurf). Jeder Abschnitt ist
// ein Sprungziel (PanelAnker, id wie das settingsSection des Statuseintrags). Kein window, kein Store und kein Effekt (E15):
// Aktionen kommen aus der View, die Bildschirmliste liest die View (beim Start, beim Öffnen des Panels, bei jeder Änderung des
// Ausgabezustands und bei jedem Bildschirm-Ereignis). Den gemessenen Ort des Schirms nennt der Ausgabe-Abschnitt selbst (Pille und
// „Steht auf“ aus measuredId, UX Welle 2b).
import { PeersSection, ScreenOutputSection } from '@jm/settings';
import { Button, Field, PanelAnker, SettingsSection } from '@jm/ui';
import type { PresenterMode } from '@shared/types';
import { PinFeld } from '@/components/PinFeld';
import type { OberflaechenAktionen } from '@/lib/aktionen';
import { ABSCHNITT, ausgabeAbschnitt, kannVerschieben, quellenAbschnitt, STAGE_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';

export interface EinstellungenProps {
  stand: OberflaechenStand;
  aktionen: OberflaechenAktionen;
}

const MODI: readonly { modus: PresenterMode; label: string }[] = [
  { modus: 'ref', label: STAGE_TEXTE.kopplung.ref },
  { modus: 'main', label: STAGE_TEXTE.kopplung.main },
];

const QUELLEN = ['timer', 'switcher', 'presenter'] as const;

export function Einstellungen({ stand, aktionen }: EinstellungenProps): React.JSX.Element {
  const T = STAGE_TEXTE;
  const p = stand.stage?.config.presenter;
  return (
    <div className="space-y-5">
      <ScreenOutputSection {...ausgabeAbschnitt(stand, aktionen)} />
      {kannVerschieben(stand.ausgabe) && (
        <Button type="button" variant="outline" size="sm" uppercase={false} data-stage="verschieben" onClick={aktionen.ausgabeVerschieben}>
          {T.ausgabe.verschieben}
        </Button>
      )}

      <PeersSection {...quellenAbschnitt(stand, aktionen)} />
      <ul data-stage="quellen-hinweise" className="space-y-1 text-[11px] text-[var(--muted-foreground)]">
        {QUELLEN.map((r) => (
          <li key={r}>
            <span className="font-semibold text-[var(--foreground)]">{T.quelle[r]}</span> · {T.quellenHinweis[r]}
          </li>
        ))}
      </ul>

      {p?.enabled === true && (
        <PanelAnker id={ABSCHNITT.presenter}>
          <SettingsSection title={T.kopplung.titel}>
            {p !== undefined && (
              <div className="space-y-2.5">
                <Field label={T.kopplung.pin} hint={T.kopplung.pinHinweis}>
                  <PinFeld wert={p.pin} setzen={aktionen.pin} />
                </Field>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[var(--foreground)]">{T.kopplung.anzeige}</span>
                  <div data-stage="modus" role="group" aria-label={T.kopplung.anzeige} className="flex gap-2">
                    {MODI.map(({ modus, label }) => (
                      <Button
                        key={modus}
                        type="button"
                        size="sm"
                        uppercase={false}
                        variant={p.mode === modus ? 'primary' : 'outline'}
                        aria-pressed={p.mode === modus}
                        onClick={() => aktionen.modus(modus)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)]">{T.kopplung.folienHinweis}</p>
                </div>
              </div>
            )}
          </SettingsSection>
        </PanelAnker>
      )}
    </div>
  );
}
