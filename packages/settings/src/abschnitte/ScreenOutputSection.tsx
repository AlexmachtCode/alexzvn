// --- @jm/settings: ScreenOutputSection (Spec 6.2) ---
import { Field, Select, TextInput, Toggle, UNBEKANNT } from '@jm/ui';
import { useTextEntwurf } from '../entwurf';
import { Anzeige, SectionFrame } from '../SectionFrame';
import { istGesperrt } from '../vertrag';
import { SCREEN_AUTO, SCREEN_TEXTE, screenOutputView, type ScreenOutputSectionProps } from './screen-output';

const FARBE = /^#[0-9a-fA-F]{6}$/;

export function ScreenOutputSection(p: ScreenOutputSectionProps): React.JSX.Element {
  const view = screenOutputView(p);
  const sperre = istGesperrt(view) ? true : undefined;
  const farbe = useTextEntwurf(p.background ?? '', (neu) => p.onBackground?.(neu), (neu) => FARBE.test(neu));
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
        <Field label={SCREEN_TEXTE.hintergrund} error={farbeFalsch ? SCREEN_TEXTE.farbeUngueltig : farbe.fehler}>
          <TextInput {...farbe.feld} disabled={sperre} />
        </Field>
      ) : null}
    </SectionFrame>
  );
}
