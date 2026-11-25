// Panel-Abschnitt „Cloud-Zugang“ (UX Welle 2b, Connect d1; B8, B20): die heutige CloudZugangKarte (Anmeldung Teil 2), offen im
// Panel statt als Karte über dem Raum. Connect hält keinen Key mehr in der Oberfläche; die Zugangszeile kommt fertig aus dem Main
// (status.cloudZugang). Feld „Adresse“ wie bisher (Enter speichert, nicht während gespeichert wird), nur ein noch hinterlegter
// alter Key lässt sich entfernen. „ändern“ und „Schließen“ der Karte entfallen: ⚙ bzw. der Statuseintrag öffnet das Panel, ✕ und
// Escape schließen es. Ohne Effekt, ohne window: Die Adresse liest die Wurzel-View über getProxy (proxyAdresse), Speichern und
// „Key entfernen“ sind Aktionen der Wurzel-View (setProxy). Muster: apps/qa Settings.tsx.
import { useState } from 'react';
import { Button, Field, STATUS_SYMBOL, TextInput, UNBEKANNT } from '@jm/ui';
import type { AppStatus } from '@shared/types';
import { ZUGANG_TEXT } from '../../../main/zugang/regeln';
import type { EinstellungenAktionen } from './Einstellungen';

export interface CloudZugangProps {
  /** AppStatus des Mains; undefined = noch keine Antwort. */
  status: AppStatus | undefined;
  /** Adresse aus getProxy: undefined = noch keine Antwort, null = Abfrage gescheitert; beide zeigen ein leeres Feld wie bisher. */
  proxyAdresse: string | null | undefined;
  aktionen: Pick<EinstellungenAktionen, 'proxySpeichern' | 'keyEntfernen'>;
}

/** Symbol und Farbe der Zugangszeile je Ton (die Farbe färbt nur das Symbol, das Wort steht in Vordergrundfarbe). */
const TON: Record<AppStatus['cloudZugang']['ton'], { symbol: string; klasse: string }> = {
  ok: { symbol: STATUS_SYMBOL.ok, klasse: 'text-[var(--tally-ready)]' },
  warn: { symbol: STATUS_SYMBOL.warn, klasse: 'text-[var(--status-warn)]' },
  fehler: { symbol: STATUS_SYMBOL.error, klasse: 'text-[var(--status-error)]' },
};

/**
 * Speichern wie bisher: gesperrt, solange gespeichert wird; setProxy über die Wurzel-View; danach zeigt das Feld die gespeicherte
 * Adresse (url null = es gilt wieder proxyAdresse). Scheitert setProxy, bleibt die Eingabe stehen und der Knopf wird wieder frei.
 */
export async function speichern(
  url: string,
  a: Pick<EinstellungenAktionen, 'proxySpeichern'>,
  setze: { busy(b: boolean): void; url(u: string | null): void },
): Promise<void> {
  setze.busy(true);
  try {
    await a.proxySpeichern(url);
    setze.url(null);
  } finally {
    setze.busy(false);
  }
}

export function CloudZugang({ status, proxyAdresse, aktionen }: CloudZugangProps): JSX.Element {
  const keySource = status?.proxyKeySource ?? 'none';
  const ton = TON[status?.cloudZugang.ton ?? 'ok'];
  /** Eingabe im Feld; null = unverändert, dann gilt die Adresse aus getProxy (kein Effekt nötig, auch wenn sie später kommt). */
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wert = url ?? proxyAdresse ?? '';
  const setze = { busy: setBusy, url: setUrl };

  return (
    <div data-connect="cloud-zugang" className="space-y-3">
      <p className="text-xs text-[var(--foreground)] select-text">
        {status ? (
          <>
            <span aria-hidden="true" className={ton.klasse}>
              {ton.symbol}
            </span>{' '}
            {status?.cloudZugang.text}
          </>
        ) : (
          UNBEKANNT
        )}
      </p>

      <Field label="Adresse">
        <TextInput
          placeholder="https://…workers.dev"
          value={wert}
          onChange={setUrl}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !busy) void speichern(wert, aktionen, setze);
          }}
        />
      </Field>

      {(keySource === 'stored' || keySource === 'session') && (
        <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--muted-foreground)]">
          <span>{ZUGANG_TEXT.altProxyKey}</span>
          <Button variant="outline" size="sm" uppercase={false} className="shrink-0" onClick={() => void aktionen.keyEntfernen()}>
            Key entfernen
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="primary" size="sm" uppercase={false} onClick={() => void speichern(wert, aktionen, setze)} disabled={busy}>
          Speichern
        </Button>
      </div>
    </div>
  );
}
