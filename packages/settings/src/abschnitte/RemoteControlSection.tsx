// --- @jm/settings: RemoteControlSection (Spec 6.2), Tool-Anzeige und Launcher-Vollform ---
import { Button, Field, NumberInput, Toggle, UNBEKANNT, zahlText } from '@jm/ui';
import { Anzeige, SectionFrame } from '../SectionFrame';
import { istGesperrt } from '../vertrag';
import { REMOTE_TEXTE, remoteControlView, type RemoteControlSectionProps } from './remote-control';

export function RemoteControlSection(p: RemoteControlSectionProps): React.JSX.Element {
  const view = remoteControlView(p);
  const gesperrt = istGesperrt(view);
  const sperre = gesperrt ? true : undefined;
  const l = view.variante === 'launcher' ? p.launcher : undefined;
  return (
    <SectionFrame view={view} titel={REMOTE_TEXTE.titel}>
      {view.sichtbar.steuerung ? (
        typeof p.enabled === 'boolean' ? (
          <Field label={REMOTE_TEXTE.steuerung}>
            <Toggle checked={p.enabled} onChange={(n) => p.onToggle?.(n)} disabled={sperre} />
          </Field>
        ) : (
          <Anzeige label={REMOTE_TEXTE.steuerung}>{UNBEKANNT}</Anzeige>
        )
      ) : null}
      <Anzeige label={REMOTE_TEXTE.modus} hinweis={view.variante === 'launcher' ? REMOTE_TEXTE.wirktBeimStart : undefined}>
        {view.modusText}
      </Anzeige>
      {view.sichtbar.portFeld ? (
        <Field label={REMOTE_TEXTE.port}>
          <NumberInput value={p.port ?? null} ganzzahl min={1} max={65535} onChange={(n) => p.onPortChange?.(n)} disabled={sperre} />
        </Field>
      ) : view.sichtbar.port ? (
        <Anzeige label={REMOTE_TEXTE.port}>{typeof p.port === 'number' ? zahlText(p.port) : UNBEKANNT}</Anzeige>
      ) : null}
      {view.sichtbar.verbunden ? <Anzeige label={REMOTE_TEXTE.verbunden}>{view.verbundenText ?? UNBEKANNT}</Anzeige> : null}
      {view.sichtbar.companion ? (
        <p className="text-[11px] text-[var(--muted-foreground)]">{REMOTE_TEXTE.companion(p.companionModule ?? '')}</p>
      ) : null}
      {view.sichtbar.imLauncher ? (
        <Button type="button" variant="outline" size="sm" uppercase={false} className="motion-reduce:transition-none" onClick={() => p.onOpenLauncher?.()} disabled={gesperrt}>
          {REMOTE_TEXTE.imLauncherEinrichten}
        </Button>
      ) : null}
      {view.sichtbar.aktionen && l ? (
        <div className="flex items-center gap-3">
          <Button type="button" variant="primary" size="sm" className="motion-reduce:transition-none" onClick={() => l.onActivate()} disabled={gesperrt || l.busy}>
            {p.mode === 'secure' ? REMOTE_TEXTE.erneuern : REMOTE_TEXTE.aktivieren}
          </Button>
          {view.sichtbar.deaktivieren ? (
            <Button type="button" variant="ghost" size="sm" className="motion-reduce:transition-none" onClick={() => l.onDeactivate()} disabled={gesperrt || l.busy}>
              {REMOTE_TEXTE.deaktivieren}
            </Button>
          ) : null}
        </div>
      ) : null}
      {view.sichtbar.token && l ? (
        <div data-token="true" className="space-y-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--muted)] p-3">
          <p className="text-[11px] text-[var(--muted-foreground)]">{REMOTE_TEXTE.einmaligSichtbar}</p>
          <Anzeige label={REMOTE_TEXTE.token}>{l.revealedToken}</Anzeige>
          {view.sichtbar.tokenKopieren ? (
            <Button type="button" variant="outline" size="sm" uppercase={false} className="motion-reduce:transition-none" onClick={() => l.onCopyToken?.()} disabled={gesperrt}>
              {REMOTE_TEXTE.tokenKopieren}
            </Button>
          ) : null}
        </div>
      ) : null}
      {view.sichtbar.fingerabdruck && l ? <Anzeige label={REMOTE_TEXTE.tlsFingerabdruck}>{l.tlsFingerprint}</Anzeige> : null}
      {view.sichtbar.tokenHinweis ? <p className="text-[11px] text-[var(--muted-foreground)]">{REMOTE_TEXTE.tokenNurBeimErzeugen}</p> : null}
    </SectionFrame>
  );
}
