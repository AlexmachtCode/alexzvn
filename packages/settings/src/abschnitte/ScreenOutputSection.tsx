// --- @jm/settings: ScreenOutputSection (Spec 6.2) ---
import { Button, Field, Select, TextInput, Toggle, UNBEKANNT } from '@jm/ui';
import { useTextEntwurf } from '../entwurf';
import { Anzeige, SectionFrame } from '../SectionFrame';
import { istGesperrt } from '../vertrag';
import { farbeGewaehlt, FARBE_MUSTER, SCREEN_AUTO, SCREEN_TEXTE, screenOutputView, standardfarbe, type ScreenOutputSectionProps } from './screen-output';

const FARBE = FARBE_MUSTER;

export function ScreenOutputSection(p: ScreenOutputSectionProps): React.JSX.Element {
  const view = screenOutputView(p);
  const gesperrt = istGesperrt(view);
  const sperre = gesperrt ? true : undefined;
  const farbe = useTextEntwurf(p.background ?? '', (neu) => p.onBackground?.(neu), (neu) => FARBE.test(neu), gesperrt);
  const farbeFalsch = farbe.feld.value.trim() !== '' && !FARBE.test(farbe.feld.value.trim());
  return (
    <SectionFrame view={view} titel={SCREEN_TEXTE.titel}>
      {view.sichtbar.ausgabe ? (
        <Field label={SCREEN_TEXTE.ausgabe}>
          <Toggle checked={p.enabled} onChange={(n) => p.onToggle?.(n)} disabled={sperre} />
        </Field>
      ) : null}
      {view.sichtbar.auswahl ? (
        <Field label={SCREEN_TEXTE.bildschirm} hint={view.hinweis}>
          <Select
            options={view.optionen}
            value={view.auswahlWert}
            fehlendLabel={SCREEN_TEXTE.frueherGewaehlt}
            onChange={(v) => p.onSelect?.(v === SCREEN_AUTO ? null : Number(v))}
            disabled={sperre ?? (view.auswahlGesperrt ? true : undefined)}
          />
        </Field>
      ) : (
        <Anzeige label={SCREEN_TEXTE.bildschirm}>{UNBEKANNT}</Anzeige>
      )}
      {view.sichtbar.vollbild ? (
        typeof p.fullscreen === 'boolean' ? (
          <Field label={SCREEN_TEXTE.vollbild}>
            <Toggle checked={p.fullscreen} onChange={(n) => p.onFullscreen?.(n)} disabled={sperre} />
          </Field>
        ) : (
          <Anzeige label={SCREEN_TEXTE.vollbild}>{UNBEKANNT}</Anzeige>
        )
      ) : null}
      {view.sichtbar.hintergrund ? (
        typeof p.background === 'string' ? (
          <>
            <Field label={SCREEN_TEXTE.hintergrund} error={farbeFalsch ? SCREEN_TEXTE.farbeUngueltig : farbe.fehler}>
              <div className="flex items-center gap-2">
                <TextInput {...farbe.feld} disabled={sperre} />
                {view.sichtbar.farbwaehler ? (
                  <input
                    type="color"
                    aria-label={SCREEN_TEXTE.farbeWaehlen}
                    title={SCREEN_TEXTE.farbeWaehlen}
                    value={FARBE.test(p.background) ? p.background : '#000000'}
                    onChange={(e) => farbeGewaehlt(p, e.currentTarget.value)}
                    disabled={sperre}
                    className="h-[var(--control-h)] w-10 shrink-0 cursor-pointer rounded-[var(--radius-md)] border border-[var(--field-border)] bg-[var(--input)] p-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                ) : null}
              </div>
            </Field>
            {view.sichtbar.standardfarbe ? (
              <Button type="button" variant="outline" size="sm" uppercase={false} className="motion-reduce:transition-none" onClick={() => standardfarbe(p)} disabled={gesperrt}>
                {SCREEN_TEXTE.standardfarbe(p.backgroundDefault ?? '')}
              </Button>
            ) : null}
          </>
        ) : (
          <Anzeige label={SCREEN_TEXTE.hintergrund}>{UNBEKANNT}</Anzeige>
        )
      ) : null}
    </SectionFrame>
  );
}
