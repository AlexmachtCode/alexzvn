// Galerie (Spec 3.10): jeder Baustein aus @jm/ui und jeder Abschnitt aus @jm/settings, links Dunkel, rechts Hell,
// darunter der ganze Rahmen in 1200 px und 800 px Breite (Schmal-Ansicht, E7).
import { settingsBeispiele } from './beispiele-settings';
import { uiBeispiele, type Beispiel, type Modus } from './beispiele-ui';
import { shellAdresse, type ShellParameter } from './ShellSeite';

export const RAHMEN_ANSICHTEN: ReadonlyArray<{ breite: number; parameter: ShellParameter; titel: string }> = [
  { breite: 1200, parameter: { modus: 'dark', panel: true, dichte: 'normal', sitzung: true }, titel: '1200 px · Dunkel · Panel offen' },
  { breite: 1200, parameter: { modus: 'light', panel: false, dichte: 'normal', sitzung: true }, titel: '1200 px · Hell · Panel zu' },
  { breite: 800, parameter: { modus: 'dark', panel: true, dichte: 'kompakt', sitzung: true }, titel: '800 px · Dunkel · Panel über dem Inhalt · kompakt' },
  { breite: 800, parameter: { modus: 'light', panel: true, dichte: 'normal', sitzung: true }, titel: '800 px · Hell · Panel über dem Inhalt' },
  { breite: 1200, parameter: { modus: 'dark', panel: false, dichte: 'normal', sitzung: false }, titel: '1200 px · Dunkel · ohne Sitzung (leere Statusleiste, kein ⚙)' },
];

/** Gruppen in der Reihenfolge ihres ersten Auftretens. */
function gruppiere(liste: Beispiel[]): Array<[string, Beispiel[]]> {
  const gruppen = new Map<string, Beispiel[]>();
  for (const b of liste) gruppen.set(b.gruppe, [...(gruppen.get(b.gruppe) ?? []), b]);
  return [...gruppen.entries()];
}

function Spalte({ modus }: { modus: Modus }): React.JSX.Element {
  const gruppen = gruppiere([...uiBeispiele(modus), ...settingsBeispiele(modus)]);
  return (
    <section
      data-modus={modus}
      aria-label={modus === 'dark' ? 'Dunkel' : 'Hell'}
      className={modus === 'dark' ? 'dark min-w-0 space-y-8 bg-[var(--background)] p-6 text-[var(--foreground)]' : 'light min-w-0 space-y-8 bg-[var(--background)] p-6 text-[var(--foreground)]'}
    >
      <h2 className="text-sm font-extrabold">{modus === 'dark' ? 'Dunkel (Standard)' : 'Hell'}</h2>
      {gruppen.map(([gruppe, liste]) => (
        <section key={gruppe} className="space-y-3">
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{gruppe}</h3>
          <div className="flex flex-wrap items-start gap-4">
            {liste.map((b) => (
              <figure key={b.name} data-beispiel={b.name} className="m-0 min-w-[240px] max-w-full space-y-1.5">
                <figcaption className="text-[11px] text-[var(--muted-foreground)]">{b.titel}</figcaption>
                {b.element}
              </figure>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}

export function Galerie(): React.JSX.Element {
  return (
    <div className="min-w-[1180px] bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-extrabold">Galerie · @jm/ui und @jm/settings</h1>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          Jeder Baustein in jedem Zustand, links Dunkel, rechts Hell. Die Abschnitte zeigen feste Zustände, ihre Knöpfe
          tun nichts. Unten der Rahmen in 1200 px und 800 px Breite.
        </p>
      </header>
      <div className="grid grid-cols-2">
        <Spalte modus="dark" />
        <Spalte modus="light" />
      </div>
      <section aria-labelledby="galerie-rahmen" className="space-y-4 border-t border-[var(--border)] px-6 py-6">
        <h2 id="galerie-rahmen" className="text-sm font-extrabold">
          Rahmen (AppShell) in 1200 px und 800 px
        </h2>
        <div className="flex flex-wrap gap-6">
          {RAHMEN_ANSICHTEN.map((r) => (
            <figure key={r.titel} className="m-0 space-y-1.5">
              <figcaption className="text-[11px] text-[var(--muted-foreground)]">{r.titel}</figcaption>
              <iframe
                title={r.titel}
                src={shellAdresse(r.parameter)}
                width={r.breite}
                height={560}
                className="rounded-[var(--radius-lg)] border border-[var(--border)]"
              />
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
