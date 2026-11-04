import { Fragment, useEffect, useState } from 'react';
import { Button, Card, cn, noDragRegion } from '@jm/ui';
import { kontoKopf, sitzungGueltig } from '@/lib/konto-anzeige';
import {
  KONTO_TEXTE, ZOOM_TEXTE, abmeldeFrage, ausgabeZeilen, hinweisZeilen, kontoKnoepfe, kontoZeilen, zoomConnectHinweis, zoomFehlerText,
  zoomFormular, zoomHinweis, zoomKnopfSichtbar, zoomStand, zustandsZeile,
} from '@/lib/konto-dialog';
import { useKonto } from '@/store/konto';
import { useTools } from '@/store/tools';

const feldCls = cn(
  'h-8 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2.5 text-xs text-[var(--foreground)]',
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
);

/**
 * Anmeldung (Plan P25, Spec 4.2, 6.1, 8): Konto-Dialog — wer angemeldet ist, Stufe, seit wann, bis wann (Externe), dieser
 * Rechner, Zoom, Zustand mit Grund und Weg, Diagnosen, Ausgaben an Tools, Zoom-Anfrage für Externe, Abmelden mit Rückfrage.
 * Alle Zeilen und Texte aus lib/konto-dialog.ts. Muster wie SystemStatusModal (G11).
 */
export function KontoModal(): React.JSX.Element | null {
  const offen = useKonto((s) => s.kontoOffen);
  const ansicht = useKonto((s) => s.ansicht);
  const schliessen = useKonto((s) => s.schliesseKonto);
  const anmelden = useKonto((s) => s.anmelden);
  const abmelden = useKonto((s) => s.abmelden);
  const zoomAnfragen = useKonto((s) => s.zoomAnfragen);
  const tools = useTools((s) => s.tools);
  const iveoShowOffen = useTools((s) => s.iveoActive !== null);
  const [frage, setFrage] = useState(false);
  const [formular, setFormular] = useState<{ zweck: string; von: string; bis: string } | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (offen) return;
    setFrage(false);
    setFormular(null);
    setMeldung(null);
  }, [offen]);
  // Escape: erst die Rückfrage bzw. das Formular zu, dann den Dialog.
  useEffect(() => {
    if (!offen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (frage) setFrage(false);
        else if (formular) setFormular(null);
        else schliessen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [offen, frage, formular, schliessen]);

  if (!offen) return null;

  const jetzt = Date.now();
  const kopf = kontoKopf(ansicht, true);
  const zustand = zustandsZeile(ansicht);
  const hinweise = hinweisZeilen(ansicht);
  const zeilen = kontoZeilen(ansicht, jetzt);
  const knoepfe = kontoKnoepfe(ansicht);
  const zStand = zoomStand(ansicht);
  const zKnopf = zoomKnopfSichtbar(ansicht, jetzt);
  // Z11 (EP34): Connect nutzt die Zoom-Freigabe erst mit Teil 2 — der Satz steht direkt unter den Zeilen.
  const zConnect = zoomConnectHinweis(ansicht);
  const toolName = (appId: string): string => tools.find((t) => t.id === appId)?.name ?? appId;

  const senden = async (): Promise<void> => {
    if (!formular) return;
    const f = zoomFormular(formular, Date.now());
    if (!f.ok) {
      setMeldung(f.text);
      return;
    }
    setBusy(true);
    try {
      const r = await zoomAnfragen({ zweck: f.zweck, von: f.von, bis: f.bis });
      if (r.ok) {
        setFormular(null);
        setMeldung(null);
      } else setMeldung(zoomFehlerText(r.code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-6"
      style={noDragRegion}
      onClick={(e) => {
        if (e.target === e.currentTarget) schliessen();
      }}
    >
      <Card className="w-full max-w-lg p-6 jm-fade-in">
        <div className="flex max-h-[calc(100vh-6rem)] flex-col">
          <div className="shrink-0">
            <h2 className="text-lg font-extrabold tracking-tight">{KONTO_TEXTE.titel}</h2>
            {kopf.text && <p className="text-xs text-[var(--muted-foreground)] mt-1">{kopf.text}</p>}
          </div>

          <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
            {zustand && (
              <p role="status" className="mt-4 text-xs rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] px-3 py-2">
                {zustand}
              </p>
            )}
            {hinweise.map((h) => (
              <p key={h} className="mt-2 text-xs text-[var(--muted-foreground)]">
                {h}
              </p>
            ))}
            {zeilen.length > 0 && (
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                {zeilen.map((z) => (
                  <Fragment key={z.bezeichner}>
                    <dt className="text-[var(--muted-foreground)]">{z.bezeichner}</dt>
                    <dd className="break-words">{z.wert}</dd>
                  </Fragment>
                ))}
              </dl>
            )}
            {zConnect && (
              <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">{zConnect}</p>
            )}

            {(zKnopf || zStand) && (
              <div className="mt-5 border-t border-[var(--border)] pt-4">
                {zStand && <p className="text-xs">{zStand}</p>}
                {zKnopf && !formular && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => setFormular({ zweck: '', von: '', bis: '' })}>
                    {ZOOM_TEXTE.knopf}
                  </Button>
                )}
                {formular && (
                  <div className="mt-3 flex flex-col gap-2">
                    <p className="text-xs font-extrabold">{ZOOM_TEXTE.titel}</p>
                    <label className="flex flex-col gap-1 text-[11px] text-[var(--muted-foreground)]">
                      {ZOOM_TEXTE.zweck}
                      <input className={feldCls} value={formular.zweck} onChange={(e) => setFormular({ ...formular, zweck: e.target.value })} />
                    </label>
                    <div className="flex gap-2">
                      <label className="flex flex-1 flex-col gap-1 text-[11px] text-[var(--muted-foreground)]">
                        {ZOOM_TEXTE.von}
                        <input type="date" className={feldCls} value={formular.von} onChange={(e) => setFormular({ ...formular, von: e.target.value })} />
                      </label>
                      <label className="flex flex-1 flex-col gap-1 text-[11px] text-[var(--muted-foreground)]">
                        {ZOOM_TEXTE.bis}
                        <input type="date" className={feldCls} value={formular.bis} onChange={(e) => setFormular({ ...formular, bis: e.target.value })} />
                      </label>
                    </div>
                    <p className="text-[11px] text-[var(--muted-foreground)]">{zoomHinweis(ansicht)}</p>
                    {meldung && (
                      <p role="alert" className="text-[11px] text-[var(--destructive)]">
                        {meldung}
                      </p>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setFormular(null)}>
                        {KONTO_TEXTE.abbrechen}
                      </Button>
                      <Button size="sm" variant="primary" disabled={busy} onClick={() => void senden()}>
                        {ZOOM_TEXTE.senden}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {sitzungGueltig(ansicht) && (
              <div className="mt-5 border-t border-[var(--border)] pt-4">
                <p className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">{KONTO_TEXTE.ausgaben}</p>
                <ul className="mt-2 flex flex-col gap-1 text-xs">
                  {ausgabeZeilen(ansicht, toolName).map((z) => (
                    <li key={z}>{z}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-6 flex shrink-0 flex-col gap-3 border-t border-[var(--border)] pt-4">
            {frage ? (
              <>
                <p className="text-sm">{abmeldeFrage(iveoShowOffen)}</p>
                <div className="flex justify-end gap-3">
                  <Button variant="ghost" onClick={() => setFrage(false)}>
                    {KONTO_TEXTE.abbrechen}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setFrage(false);
                      void abmelden();
                    }}
                  >
                    {KONTO_TEXTE.jaAbmelden}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-3">
                {knoepfe.includes('abmelden') && (
                  <Button variant="outline" onClick={() => setFrage(true)}>
                    {KONTO_TEXTE.abmelden}
                  </Button>
                )}
                {knoepfe.includes('neu-anmelden') && (
                  <Button variant="primary" onClick={anmelden}>
                    {KONTO_TEXTE.neuAnmelden}
                  </Button>
                )}
                {knoepfe.includes('anmelden') && (
                  <Button variant="primary" onClick={anmelden}>
                    {KONTO_TEXTE.anmelden}
                  </Button>
                )}
                <Button variant="ghost" onClick={schliessen}>
                  {KONTO_TEXTE.schliessen}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
