// --- @jm/settings: DataLinkSection (Spec 6.2) ---
import { Button } from '@jm/ui';
import { Anzeige, SectionFrame } from '../SectionFrame';
import { istGesperrt } from '../vertrag';
import { DATALINK_TEXTE, dataLinkView, type DataLinkSectionProps } from './datalink';

export function DataLinkSection(p: DataLinkSectionProps): React.JSX.Element {
  const view = dataLinkView(p);
  const gesperrt = istGesperrt(view);
  return (
    <SectionFrame view={view} titel={DATALINK_TEXTE.titel}>
      <Anzeige label={DATALINK_TEXTE.ordner}>{view.ordnerText}</Anzeige>
      {view.sichtbar.ordnerWaehlen ? (
        <Button type="button" variant="outline" size="sm" uppercase={false} className="motion-reduce:transition-none" onClick={() => p.onPickFolder?.()} disabled={gesperrt}>
          {DATALINK_TEXTE.ordnerWaehlen}
        </Button>
      ) : null}
      {view.sichtbar.status ? (
        <Anzeige label={DATALINK_TEXTE.status} hinweis={p.notice || undefined}>
          {p.sourceLine}
        </Anzeige>
      ) : null}
      {view.sichtbar.zurueck ? (
        <Button type="button" variant="ghost" size="sm" uppercase={false} className="motion-reduce:transition-none" onClick={() => p.onBack?.()} disabled={gesperrt}>
          {p.backLabel}
        </Button>
      ) : null}
    </SectionFrame>
  );
}
