// Leiste des Referenten unter dem Kopf (UX Welle 2b, Presenter d2; B11, B12): links wie im alten Kopf der große Zähler „n / m“,
// der Titel der aktuellen Folie und die Uhr; rechts Bildschirmwahl, „Auf diesen Bildschirm“, NDI, Gast-Klick, Schleife,
// „Publikum Vollbild“, „Vollbild“ und „Übersicht“ in dieser Reihenfolge. Bei schmalem Fenster bricht die rechte Gruppe in eine
// zweite Zeile um (wie bisher der Kopf), statt Knöpfe aus dem Fenster zu schieben. Die Bildschirmwahl merkt nur (onWahl), erst
// „Auf diesen Bildschirm“ verschiebt (onVerschieben), gesperrt mit title-Grund (B11). Kein Abo und keine Hooks in der Leiste:
// Stand, Wahl und Aktionen kommen aus der Wurzel-View; nur Uhr und Schleifen-Countdown zählen selbst.
import { useEffect, useState } from 'react';
import { cn, UNBEKANNT } from '@jm/ui';
import type { Slide } from '@shared/types';
import { Clock } from '@/components/Clock';
import { GastKlickerPille } from '@/components/GastKlickerPille';
import { NdiKnopf } from '@/components/NdiSchalter';
import { nurNdiLaeuft, PRESENTER_TEXTE, verschiebenGrund, type OberflaechenStand, type ReferentAktionen } from '@/lib/oberflaeche';

export interface ReferentLeisteProps {
  stand: OberflaechenStand;
  folien: Slide[] | null;
  /** Wirksame Bildschirmwahl (referentWahl): die gemerkte Wahl oder der gemessene Bildschirm des Publikums; null ohne beides. */
  wahl: number | null;
  uebersicht: boolean;
  referent: Pick<ReferentAktionen, 'schleife' | 'publikumVollbild' | 'vollbild'>;
  onNdi(an: boolean): void;
  onGastPause(an: boolean): void;
  /** Auswahl in der Leiste: merkt nur (B11), verschiebt nichts. */
  onWahl(id: number): void;
  /** „Auf diesen Bildschirm“: verschiebt das Publikum auf die Wahl. */
  onVerschieben(): void;
  onUebersicht(offen: boolean): void;
}

export function ReferentLeiste({ stand, folien, wahl, uebersicht, referent, onNdi, onGastPause, onWahl, onVerschieben, onUebersicht }: ReferentLeisteProps) {
  const T = PRESENTER_TEXTE;
  const p = stand.praesentation;
  const titel = p === undefined ? undefined : folien?.[p.index]?.title;
  const liste = stand.bildschirme;
  const nurNdi = nurNdiLaeuft(stand);
  const grund = verschiebenGrund(stand, wahl);

  return (
    <div data-presenter="leiste" className="flex min-w-0 flex-1 items-center gap-4 select-none">
      <div data-presenter="leiste-links" className="flex flex-1 items-center gap-4">
        <div data-presenter="zaehler" className="flex shrink-0 items-baseline gap-2 whitespace-nowrap">
          <span className="text-3xl font-extrabold tabular text-[var(--primary)]">{p === undefined ? '—' : p.index + 1}</span>
          <span className="text-lg text-[var(--muted-foreground)] tabular">/ {p === undefined ? '—' : p.total}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div data-presenter="folientitel" className="text-sm font-semibold truncate">
            {titel || '—'}
          </div>
        </div>
        <Clock />
      </div>
      <div className="h-8 w-px shrink-0 bg-[var(--border)]" />
      <div data-presenter="leiste-rechts" className="flex flex-wrap items-center justify-end gap-2">
        <select
          data-presenter="bildschirm"
          value={liste === undefined ? '' : nurNdi ? 'keiner' : (wahl ?? '')}
          disabled={liste === undefined || nurNdi}
          onChange={(e) => {
            const id = Number(e.target.value);
            if (e.target.value !== '' && Number.isFinite(id)) onWahl(id);
          }}
          title={T.publikum.bildschirmWahl}
          className="h-8 max-w-[170px] shrink-0 rounded-md bg-[var(--input)] border border-[var(--border)] px-2 text-xs text-[var(--foreground)] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {liste === undefined ? (
            <option value="">{UNBEKANNT}</option>
          ) : nurNdi ? (
            <option value="keiner">{T.publikum.nurNdi}</option>
          ) : (
            liste.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))
          )}
        </select>
        <LeistenKnopf kennung="verschieben" onClick={onVerschieben} disabled={grund !== undefined} title={grund}>
          {T.verschieben.knopf}
        </LeistenKnopf>
        <NdiKnopf variante="referent" status={stand.ndi} plattform={stand.plattform} onSchalten={onNdi} />
        <GastKlickerPille status={stand.gastKlicker} onPause={onGastPause} />
        <SchleifenKnopf schleife={p?.schleife === true} bisMs={p?.schleifeBisMs ?? null} onSchalten={referent.schleife} />
        <LeistenKnopf kennung="publikum-vollbild" onClick={referent.publikumVollbild} disabled={nurNdi} title={nurNdi ? T.publikum.keinFensterNurNdi : undefined}>
          Publikum Vollbild
        </LeistenKnopf>
        <LeistenKnopf kennung="vollbild" onClick={referent.vollbild} active={stand.referentVollbild === true} title="Referentenansicht im Vollbild (F11)">
          Vollbild
        </LeistenKnopf>
        <LeistenKnopf kennung="uebersicht" onClick={() => onUebersicht(!uebersicht)} active={uebersicht}>
          Übersicht
        </LeistenKnopf>
      </div>
    </div>
  );
}

/** #293: Schleife live an/aus, mit Countdown bis zum nächsten Selbst-Weiterblättern. */
export function SchleifenKnopf({ schleife, bisMs, onSchalten }: { schleife: boolean; bisMs: number | null; onSchalten(an: boolean): void }) {
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    if (!schleife || bisMs == null) return;
    const id = setInterval(() => setJetzt(Date.now()), 250);
    return () => clearInterval(id);
  }, [schleife, bisMs]);
  const rest = schleife && bisMs != null ? Math.max(0, Math.ceil((bisMs - jetzt) / 1000)) : null;
  return (
    <LeistenKnopf
      kennung="schleife"
      onClick={() => onSchalten(!schleife)}
      active={schleife}
      title={schleife ? 'Schleife anhalten' : 'Schleife starten: blättert nach der Standzeit selbst weiter'}
    >
      ⟳ Schleife{rest != null ? ` · ${rest} s` : schleife ? ' · steht' : ''}
    </LeistenKnopf>
  );
}

/** Knopf der Leiste (früher HeaderBtn), nur mit Tokens; `kennung` steht als data-presenter am Knopf (Tests, Messung). */
function LeistenKnopf({
  kennung,
  children,
  onClick,
  active,
  title,
  disabled,
}: {
  kennung: string;
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
  /** Gesperrt, aber mit Tooltip (darum ohne pointer-events-none). */
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      data-presenter={kennung}
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        'h-8 px-3 shrink-0 whitespace-nowrap rounded-md text-xs font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        active
          ? 'bg-[var(--primary)] text-[var(--brand-dark)] border-[var(--primary)]'
          : 'bg-[var(--card)] border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--highlight)]',
      )}
    >
      {children}
    </button>
  );
}
