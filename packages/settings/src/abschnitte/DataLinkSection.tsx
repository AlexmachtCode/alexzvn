// --- @jm/settings: DataLinkSection (Spec 6.2) ---
import { Button, Field, TextInput } from '@jm/ui';
import { useTextEntwurf } from '../entwurf';
import { Anzeige, SectionFrame } from '../SectionFrame';
import { istGesperrt } from '../vertrag';
import { DATALINK_TEXTE, dataLinkView, ordnerEntfernen, type DataLinkSectionProps } from './datalink';

export function DataLinkSection(p: DataLinkSectionProps): React.JSX.Element {
  const view = dataLinkView(p);
  const gesperrt = istGesperrt(view);
  // Pfadfeld (UX-Pilot C6, OF4): Übernahme erst bei Enter oder Verlassen, nicht je Tastendruck; gesperrt meldet es nichts.
  const pfad = useTextEntwurf(p.folder, (neu) => p.onFolderText?.(neu), undefined, gesperrt);
  return (
    <SectionFrame view={view} titel={DATALINK_TEXTE.titel}>
      {view.sichtbar.ordnerFeld ? (
        <Field label={DATALINK_TEXTE.ordnerpfad} error={pfad.fehler}>
          <TextInput {...pfad.feld} placeholder={DATALINK_TEXTE.keinOrdner} spellCheck={false} disabled={gesperrt ? true : undefined} />
        </Field>
      ) : (
        <Anzeige label={DATALINK_TEXTE.ordner}>{view.ordnerText}</Anzeige>
      )}
      {view.sichtbar.ordnerWaehlen ? (
        <Button type="button" variant="outline" size="sm" uppercase={false} className="motion-reduce:transition-none" onClick={() => p.onPickFolder?.()} disabled={gesperrt}>
          {DATALINK_TEXTE.ordnerWaehlen}
        </Button>
      ) : null}
      {view.sichtbar.ordnerEntfernen ? (
        <Button type="button" variant="ghost" size="sm" uppercase={false} className="motion-reduce:transition-none" onClick={() => ordnerEntfernen(p)} disabled={gesperrt}>
          {DATALINK_TEXTE.ordnerEntfernen}
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
