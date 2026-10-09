// --- @jm/settings: IveoSection (Spec 6.2) – nur Anzeige, nie ein Token-Feld ---
import { Button } from '@jm/ui';
import { Anzeige, SectionFrame } from '../SectionFrame';
import { istGesperrt } from '../vertrag';
import { IVEO_TEXTE, iveoView, type IveoSectionProps } from './iveo';

export function IveoSection(p: IveoSectionProps): React.JSX.Element {
  const view = iveoView(p);
  return (
    <SectionFrame view={view} titel={IVEO_TEXTE.titel}>
      {view.sichtbar.event ? <Anzeige label={IVEO_TEXTE.event}>{p.eventName}</Anzeige> : null}
      {view.sichtbar.buehne ? <Anzeige label={IVEO_TEXTE.buehne}>{p.stage}</Anzeige> : null}
      {view.sichtbar.speaker ? <Anzeige label={IVEO_TEXTE.speaker}>{view.speakerText}</Anzeige> : null}
      <p className="text-[11px] text-[var(--muted-foreground)]">{IVEO_TEXTE.tokenImLauncher}</p>
      {view.sichtbar.imLauncher ? (
        <Button type="button" variant="outline" size="sm" uppercase={false} className="motion-reduce:transition-none" onClick={() => p.onOpenLauncher?.()} disabled={istGesperrt(view)}>
          {IVEO_TEXTE.imLauncherEinrichten}
        </Button>
      ) : null}
    </SectionFrame>
  );
}
