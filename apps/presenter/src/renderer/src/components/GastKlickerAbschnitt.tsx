import { useState } from 'react';
import { Button, Field, TextInput, Toggle, UNBEKANNT } from '@jm/ui';
import { statusText, type GastKlickerStatus } from '@shared/gast-klicker';
import { PRESENTER_TEXTE } from '@/lib/oberflaeche';

/** Was der Abschnitt auslösen kann; die Rückfrage bei „Neuer Link“ (window.confirm) und das Kopieren stecken in der Aktion. */
export interface GastKlickerAktionen {
  setzeAn(an: boolean): Promise<unknown>;
  pause(an: boolean): Promise<unknown>;
  /** Fragt vorher per window.confirm; bei „Abbrechen“ passiert nichts. */
  neuerLink(): Promise<unknown>;
  /** Kopiert den Chat-Text mit dem Link; true, wenn es geklappt hat. */
  kopieren(link: string): Promise<boolean>;
}

/**
 * #317: Gast-Klicker übers Internet. Remote-Gäste (z. B. per Zoom) öffnen einen Link und schalten ihre Folien selbst vor/zurück;
 * der Presenter verbindet sich dafür ausgehend mit dem Cloud-Dienst. Inhalt des Panel-Abschnitts „Gast-Klicker“ (UX Welle 2b, d1)
 * (in Editor und Referent): Status, Aktionen und „beschäftigt“ kommen herein, kein Abo und kein window hier. „beschäftigt“ hält die
 * Wurzel-View (lib/aufrufe.ts, Rückspiel Task 26): das Panel stirbt beim Schließen, ein Wiederöffnen während eines Aufrufs gibt
 * Schalter, Pause und Neuer Link nicht frei. Nur die Rückmeldung „Kopiert“ (2 s) bleibt hier.
 */
export function GastKlickerAbschnitt({ status: s, aktionen, busy }: { status: GastKlickerStatus | undefined; aktionen: GastKlickerAktionen; busy: boolean }) {
  const T = PRESENTER_TEXTE.gastKlicker;
  const [kopiert, setKopiert] = useState(false);

  const kopiere = async (): Promise<void> => {
    if (!s?.link) return;
    const ok = await aktionen.kopieren(s.link);
    setKopiert(ok);
    if (ok) setTimeout(() => setKopiert(false), 2000);
  };

  const an = s?.an ?? false;
  const ok = s?.lage === 'verbunden';
  // Wie bisher: an, aber nicht verbunden, steht die Statuszeile als Fehler (früher rot).
  const zeile = s ? statusText(s) : UNBEKANNT;
  // Vor der ersten Antwort kein erfundenes „Gast-Klicker aus“: nur der Titel, der Zustand steht als „unbekannt“ darunter (Nur Gemessenes,
  // Gesamtprüfung UX Welle 2b M9).
  const beschriftung = s === undefined ? T.titel : an ? T.an : T.aus;

  return (
    <div className="space-y-3">
      <Field label={beschriftung} {...(an && !ok ? { error: zeile } : { hint: zeile })}>
        <Toggle checked={an} onChange={() => void aktionen.setzeAn(!an)} disabled={busy || !s} aria-label={T.schalter} />
      </Field>

      {an && s?.link ? (
        <>
          <Field label={T.link}>
            <TextInput readOnly value={s.link} onChange={() => undefined} onFocus={(e) => e.currentTarget.select()} className="font-mono" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" uppercase={false} onClick={() => void kopiere()}>
              {kopiert ? T.kopiert : T.kopieren}
            </Button>
            <Button
              type="button"
              size="sm"
              uppercase={false}
              variant={s.pausiert ? 'accent' : 'outline'}
              aria-pressed={s.pausiert}
              disabled={busy}
              onClick={() => void aktionen.pause(!s.pausiert)}
            >
              {s.pausiert ? T.fortsetzen : T.pausieren}
            </Button>
            <Button type="button" size="sm" uppercase={false} variant="ghost" disabled={busy} onClick={() => void aktionen.neuerLink()}>
              {T.neuerLink}
            </Button>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)]">{T.hinweis}</p>
        </>
      ) : null}
    </div>
  );
}
