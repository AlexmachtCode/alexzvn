// --- @jm/settings: NdiOutputSection (Spec 6.2) ---
import { Field, Select, TextInput, Toggle, UNBEKANNT } from '@jm/ui';
import { useTextEntwurf } from '../entwurf';
import { Anzeige, SectionFrame } from '../SectionFrame';
import { ABSCHNITT_TEXTE, istGesperrt } from '../vertrag';
import { NDI_TEXTE, ndiOutputView, type NdiOutputSectionProps } from './ndi-output';

export function NdiOutputSection(p: NdiOutputSectionProps): React.JSX.Element {
  const view = ndiOutputView(p);
  const gesperrt = istGesperrt(view);
  const sperre = gesperrt ? true : undefined;
  const name = useTextEntwurf(p.sourceName, (neu) => p.onRename?.(neu), undefined, gesperrt);
  return (
    <SectionFrame view={view} titel={NDI_TEXTE.titel}>
      {view.sichtbar.ausgabe ? (
        <Field label={NDI_TEXTE.ausgabe} hint={view.empfaenger}>
          <Toggle checked={p.enabled} onChange={(n) => p.onToggle?.(n)} disabled={sperre} />
        </Field>
      ) : view.empfaenger ? (
        <p className="text-xs text-[var(--muted-foreground)] tabular">{view.empfaenger}</p>
      ) : null}
      {view.sichtbar.umbenennen ? (
        <Field label={NDI_TEXTE.quellenname} hint={view.hinweis} error={name.fehler}>
          <TextInput {...name.feld} disabled={sperre} />
        </Field>
      ) : (
        <Anzeige label={NDI_TEXTE.quellenname} hinweis={view.hinweis}>
          {p.sourceName}
        </Anzeige>
      )}
      {view.sichtbar.aufloesung ? (
        <Field label={NDI_TEXTE.aufloesung}>
          <Select
            options={p.resolutionOptions ?? []}
            value={p.resolution ?? ''}
            placeholder={ABSCHNITT_TEXTE.bitteWaehlen}
            onChange={(v) => p.onResolution?.(v)}
            disabled={sperre}
          />
        </Field>
      ) : null}
      {view.sichtbar.bildrate ? (
        <Field label={NDI_TEXTE.bildrate}>
          <Select
            options={p.fpsOptions ?? []}
            value={p.fps ?? ''}
            placeholder={ABSCHNITT_TEXTE.bitteWaehlen}
            onChange={(v) => p.onFps?.(v)}
            disabled={sperre}
          />
        </Field>
      ) : null}
      {view.sichtbar.transparenz ? (
        typeof p.transparency === 'boolean' ? (
          <Field label={NDI_TEXTE.transparenz}>
            <Toggle checked={p.transparency} onChange={(n) => p.onTransparency?.(n)} disabled={sperre} />
          </Field>
        ) : (
          <Anzeige label={NDI_TEXTE.transparenz}>{UNBEKANNT}</Anzeige>
        )
      ) : null}
    </SectionFrame>
  );
}
