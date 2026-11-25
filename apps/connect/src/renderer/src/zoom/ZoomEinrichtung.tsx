// Panel-Abschnitt „Zoom-Einrichtung“ (UX Welle 2b, Connect d2; B20, B22, B8; Spec 9 Punkt 3, Spec SDK nachladen 4.2–4.5): bis Task 24
// die aufklappbare Einrichtung der Zoom-Karte (ZoomCard.tsx:405-507), jetzt im Panel. Bei einem Mangel öffnet der Statuseintrag
// „Zoom-Einrichtung“ das Panel hier (B22); der Knopf „Einrichtung“ der Karte entfällt (⚙ öffnet das Panel). Inhalt und Sperren
// wie bisher: Sperr-Hinweis bei Mangel, SDK-Zeile mit „SDK-Ordner wählen …“/„Neu wählen …“ und „Zoom-SDK laden“ (S10 als Tooltip am
// Rahmen), Ladezeile mit „Abbrechen“ und Balken, Zeile „Zoom-Anmeldung“, die Übergangszeilen der alten Werte mit „Entfernen“,
// „Einrichtung prüfen“. Ohne Effekt und ohne Zustand (B8): Abbild aus stand.zoom, laufende Aufrufe und Antwort (Ort „einrichtung“)
// als ZoomAufrufe aus der Wurzel-View; window nur als Ziel der Aufrufe beim Klick.
import { Button } from '@jm/ui';
import type { JmConnectApi, ZoomAbbild } from '@shared/types';
import {
  einrichtungsTextArt,
  sdkBalken,
  sdkKnopf,
  sdkLadenZeile,
  sdkSchluesselZeile,
  sdkZeile,
  zoomKnoepfe,
  zugangZeile,
} from '@shared/zoom-text';
import { antwortAm, ohneText, type ZoomAufrufe } from './aufrufe';
import { MitTooltip, STIL } from './SlotEinstellungen';

// Tooltip- und Hinweistexte wörtlich aus Spec 8 und 9 (der Renderer importiert klartext.ts nicht). TEXT_S10 ist neu gefasst und
// steht wörtlich in Spec 2026-10-06 (Zoom-SDK nachladen), Abschnitt 5 (Owner 06.10.2026).
const TEXT_S10 = 'Während Zoom läuft oder das Zoom-SDK geladen oder kopiert wird, lässt sich die Einrichtung nicht ändern.';
const SPERR_HINWEIS = 'Zoom ist gesperrt, bis das Zoom-SDK eingerichtet ist.';
/** Ton der Zeile „Zoom-Anmeldung“: die Farbe nur am Rand, das Wort in Vordergrundfarbe (W2-9). */
const ANMELDUNG_RAND = { ok: '', warn: 'border-l-2 border-[var(--status-warn)] pl-2', fehler: 'border-l-2 border-[var(--status-error)] pl-2' } as const;

/** Die Aufrufe der Einrichtung, die ZoomEinrichtung braucht. */
export type EinrichtungApi = Pick<JmConnectApi, 'zoomSdkWaehlen' | 'zoomSdkLaden' | 'zoomSdkLadenAbbrechen' | 'zoomSdkSchluesselLoeschen' | 'zoomZugangLoeschen' | 'zoomPruefen'>;

/**
 * Die Aufrufe der Einrichtung (rein, ohne window): je Knopf der Schlüssel des Doppelklick-Schutzes (Nr. 103) und der Ort der
 * Antwort wie bisher; „einrichtung“ steht im Abschnitt, null zeigt nichts (das Abbild meldet es). `api` liefert erst beim Klick das
 * Ziel (window.jmconnect).
 */
export function einrichtungAufrufe(zoom: Pick<ZoomAufrufe, 'fuehreAus'>, api: () => EinrichtungApi) {
  return {
    sdkWaehlen: () => zoom.fuehreAus('sdk', 'einrichtung', () => api().zoomSdkWaehlen()),
    sdkLaden: () => zoom.fuehreAus('sdk', 'einrichtung', () => api().zoomSdkLaden()),
    sdkLadenAbbrechen: () => zoom.fuehreAus('sdk-abbrechen', null, () => ohneText(api().zoomSdkLadenAbbrechen())),
    schluesselLoeschen: () => zoom.fuehreAus('sdk-schluessel', 'einrichtung', () => api().zoomSdkSchluesselLoeschen()),
    zugangLoeschen: () => zoom.fuehreAus('zugang', 'einrichtung', () => api().zoomZugangLoeschen()),
    pruefen: () => zoom.fuehreAus('pruefen', null, () => api().zoomPruefen()),
  };
}

export function ZoomEinrichtung({ a, zoom }: { a: ZoomAbbild; zoom: ZoomAufrufe }): JSX.Element {
  const kn = zoomKnoepfe(a);
  const laeuft = zoom.laeuft;
  const auf = einrichtungAufrufe(zoom, () => window.jmconnect);
  const sdk = a.einrichtung.sdk;
  const zugang = a.einrichtung.zugang;
  // Alte Werte sind nur noch ein Übergang (E7): Zeile und „Entfernen“ gibt es nur, solange einer vorhanden ist.
  const zugangText = zugangZeile(a);
  const schluesselText = sdkSchluesselZeile(a);
  const sperrTitel = kn.einrichtungAenderbar ? undefined : TEXT_S10;
  const einrichtungAntwort = antwortAm(zoom, 'einrichtung');
  // „Zoom-SDK laden“: Tooltip S10 wie die Ordnerwahl (Spec SDK nachladen 4.5).
  const ladenTitel = kn.sdkLaden === 'gesperrt' ? TEXT_S10 : undefined;
  // Ein Balken für beide Abschnitte: erst der Download, danach die bestehende Kopie (sdkBalken, Aufgabe 8).
  const balken = sdkBalken(sdk);
  // S17 ist ein Hinweis (grau), alles andere ein Fehler (Spec SDK nachladen 4.3) — auch als Antwort, bevor das Abbild kommt.
  const textStil = (t: string): string => (einrichtungsTextArt(t) === 'hinweis' ? STIL.hinweis : STIL.fehler);
  return (
    <div data-connect="zoom-einrichtung" className="space-y-3 text-[var(--foreground)]">
      {kn.sperrHinweis && <p className={STIL.warnung}>{SPERR_HINWEIS}</p>}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm select-text">{sdkZeile(a)}</span>
          <span className="flex shrink-0 gap-2">
            <MitTooltip titel={sperrTitel}>
              <Button size="sm" uppercase={false} variant="outline" disabled={!kn.einrichtungAenderbar || laeuft.has('sdk')} onClick={() => void auf.sdkWaehlen()}>
                {sdkKnopf(a)}
              </Button>
            </MitTooltip>
            <MitTooltip titel={ladenTitel}>
              <Button size="sm" uppercase={false} variant="outline" disabled={kn.sdkLaden !== 'frei' || laeuft.has('sdk')} onClick={() => void auf.sdkLaden()}>
                Zoom-SDK laden
              </Button>
            </MitTooltip>
          </span>
        </div>
        {sdk.laden && (
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs">{sdkLadenZeile(sdk.laden)}</span>
            <Button size="sm" uppercase={false} variant="outline" disabled={!kn.sdkLadenAbbrechen || laeuft.has('sdk-abbrechen')} onClick={() => void auf.sdkLadenAbbrechen()}>
              Abbrechen
            </Button>
          </div>
        )}
        {balken !== null && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[var(--radius-sm)] bg-[var(--muted)]">
            <div className="h-full bg-[var(--primary)]" style={{ width: `${balken}%` }} />
          </div>
        )}
        {/* S17 (abgebrochen) ist ein Hinweis, kein Fehler: grau (Spec SDK nachladen 4.3). */}
        {sdk.text && <p className={`mt-1 ${textStil(sdk.text)}`}>{sdk.text}</p>}
      </div>
      <p className={`text-xs select-text ${ANMELDUNG_RAND[a.einrichtung.anmeldung.ton]}`}>{a.einrichtung.anmeldung.text}</p>
      {schluesselText !== null && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">{schluesselText}</span>
          {kn.sdkSchluesselEntfernbar && (
            <MitTooltip titel={sperrTitel}>
              <Button size="sm" uppercase={false} variant="outline" disabled={!kn.einrichtungAenderbar || laeuft.has('sdk-schluessel')} onClick={() => void auf.schluesselLoeschen()}>
                Entfernen
              </Button>
            </MitTooltip>
          )}
        </div>
      )}
      {zugangText !== null && (
        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">{zugangText}</span>
            {kn.zugangEntfernbar && (
              <MitTooltip titel={sperrTitel}>
                <Button size="sm" uppercase={false} variant="outline" disabled={!kn.einrichtungAenderbar || laeuft.has('zugang')} onClick={() => void auf.zugangLoeschen()}>
                  Entfernen
                </Button>
              </MitTooltip>
            )}
          </div>
          {zugang.text && zugang.text !== zugangText && <p className={`mt-1 ${STIL.fehler}`}>{zugang.text}</p>}
        </div>
      )}
      {einrichtungAntwort && einrichtungAntwort !== sdk.text && einrichtungAntwort !== zugang.text && (
        <p className={textStil(einrichtungAntwort)}>{einrichtungAntwort}</p>
      )}
      {kn.pruefen !== 'aus' && (
        <Button size="sm" uppercase={false} variant="outline" disabled={kn.pruefen === 'laeuft' || laeuft.has('pruefen')} onClick={() => void auf.pruefen()}>
          {kn.pruefen === 'laeuft' ? 'Prüfe …' : 'Einrichtung prüfen'}
        </Button>
      )}
    </div>
  );
}
