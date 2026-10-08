// Task 15 · AppShell (Spec 3.1, 3.8, 4.3; E6, E7, E8, E14): Kopfzeile · Werkzeugleiste · Inhalt mit Panel daneben ·
// Statusleiste. Ohne settings kein ⚙, kein Panel und keine klickbaren Statuseinträge; Rahmen auch ohne Sitzung.
import { AppShell, panelSchliessen, statusKlick, zahnradKlick, type AppShellProps } from '../src/components/AppShell';
import { PanelAnker } from '../src/components/SettingsPanel';
import type { StatusItem } from '../src/lib/status';
import { gleich, leseText, ok, pruefeIdVerweise, render } from './harness';
import { attr, hatKlassen, klassen, tags, zwischen } from './lib/markup';

const nichts = (): void => undefined;
const STATUS: StatusItem[] = [
  { id: 'ndi', group: 'ausgabe', label: 'NDI', state: 'ok', detail: 'JM Titler', settingsSection: 'ndi' },
  { id: 'master', group: 'verbindung', label: 'Master', state: 'off', detail: 'unbekannt' },
];
const basis = (teil: Partial<AppShellProps> = {}): AppShellProps => ({
  tool: 'Titler',
  status: STATUS,
  settingsOpen: false,
  onSettingsChange: nichts,
  children: <p>Live-Bereich</p>,
  ...teil,
});
const EINSTELLUNGEN = (
  <>
    <PanelAnker id="ndi">NDI-Abschnitt</PanelAnker>
    <PanelAnker id="iveo">iveo-Abschnitt</PanelAnker>
  </>
);
const zahnrad = (html: string): string => tags(html, 'button').find((t) => attr(t, 'data-zahnrad') !== undefined) ?? '';
const statusKnoepfe = (html: string): string[] => tags(html, 'button').filter((t) => attr(t, 'data-status-id') !== undefined);

{
  const html = render(<AppShell {...basis({ toolbar: <span>Werkzeuge</span> })} />);
  const p = ['<header', 'data-bereich="toolbar"', '<main', '<footer'].map((s) => html.indexOf(s));
  ok(p.every((x) => x >= 0) && p[0] < p[1] && p[1] < p[2] && p[2] < p[3], 'Shell: Reihenfolge header → toolbar → main → footer');
  ok(!render(<AppShell {...basis()} />).includes('data-bereich="toolbar"'), 'Shell ohne toolbar: kein Toolbar-Bereich');
}
{
  const normal = tags(render(<AppShell {...basis()} />), 'div')[0];
  const kompakt = tags(render(<AppShell {...basis({ dichte: 'kompakt' })} />), 'div')[0];
  gleich([attr(normal, 'data-dichte'), attr(kompakt, 'data-dichte')], ['normal', 'kompakt'], 'Shell data-dichte normal/kompakt (Vorgabe normal)');
  ok(hatKlassen(normal, 'flex h-screen flex-col overflow-hidden'), 'Shell: Wurzel h-screen flex flex-col');
}
{
  const html = render(<AppShell {...basis({ settingsOpen: true })} />);
  ok(
    zahnrad(html) === '' && !html.includes('<aside') && statusKnoepfe(html).length === 0 && html.includes('data-status-id="ndi"'),
    'Shell settings fehlt: kein ⚙, kein Panel, Statuseinträge ohne Knopf (auch mit settingsSection)',
  );
  const mitFalse = render(<AppShell {...basis({ settings: false, settingsOpen: true })} />);
  ok(zahnrad(mitFalse) === '' && !mitFalse.includes('<aside'), 'Shell settings={false} zählt als fehlend');
}
{
  const html = render(<AppShell {...basis({ settings: EINSTELLUNGEN, settingsOpen: true, settingsSection: 'iveo' })} />);
  const mainEnde = html.indexOf('</main>');
  const asideStart = html.indexOf('<aside');
  const asideEnde = html.indexOf('</aside>') + '</aside>'.length;
  ok(
    mainEnde > 0 && asideStart > mainEnde && html.slice(mainEnde + '</main>'.length, asideStart) === '' &&
      html.slice(asideEnde, html.indexOf('<footer')) === '</div>' && html.indexOf('<header') < asideStart,
    'Shell settingsOpen: Panel rechts neben <main> in der Inhaltszeile, zwischen Kopf- und Statusleiste',
  );
  gleich(
    tags(html, 'div')
      .filter((t) => attr(t, 'data-section-id') !== undefined)
      .map((t) => [attr(t, 'data-section-id'), attr(t, 'data-hervorgehoben')]),
    [
      ['ndi', 'false'],
      ['iveo', 'true'],
    ],
    'Shell settingsSection → Anker hervorgehoben',
  );
  ok(
    attr(zahnrad(html), 'aria-expanded') === 'true' && attr(zahnrad(html), 'aria-controls') === attr(tags(html, 'aside')[0], 'id'),
    'Shell: ⚙ aria-expanded=true, aria-controls = id des Panels',
  );
  ok(statusKnoepfe(html).length === 1, 'Shell mit settings: Statuseintrag mit settingsSection ist ein Knopf, ohne bleibt Anzeige');
  pruefeIdVerweise(html, 'Shell offen: alle id-Verweise gültig');
}
{
  const html = render(<AppShell {...basis({ settings: EINSTELLUNGEN, settingsOpen: false })} />);
  ok(
    !html.includes('<aside') && attr(zahnrad(html), 'aria-expanded') === 'false' && attr(zahnrad(html), 'aria-controls') === undefined,
    'Shell settings zu: kein Panel, ⚙ aria-expanded=false',
  );
  pruefeIdVerweise(html, 'Shell zu: alle id-Verweise gültig');
}
{
  const aufrufe: unknown[][] = [];
  const onSettingsChange = (...a: unknown[]): void => void aufrufe.push(a);
  const klick = statusKlick({ settings: <p>x</p>, onSettingsChange });
  klick?.('ndi');
  gleich([typeof klick, aufrufe], ['function', [[true, 'ndi']]], 'statusKlick → onSettingsChange(true, id)');
  gleich(
    [statusKlick({ settings: undefined, onSettingsChange }), statusKlick({ settings: null, onSettingsChange })],
    [undefined, undefined],
    'statusKlick ohne settings → undefined',
  );
  aufrufe.length = 0;
  zahnradKlick({ settingsOpen: false, onSettingsChange })();
  zahnradKlick({ settingsOpen: true, onSettingsChange })();
  gleich(aufrufe, [[true], [false]], 'zahnradKlick → onSettingsChange(!open), ohne Abschnitt');
  aufrufe.length = 0;
  panelSchliessen({ onSettingsChange })();
  gleich(aufrufe, [[false]], 'panelSchliessen → onSettingsChange(false), ohne Abschnitt (Escape und ✕)');
}
{
  // Kernzusage Spec 3.1 / E7: Das Panel verdeckt Kopf- und Statusleiste nie. Dafür tragen die Inhaltszeile und <main> Klassen.
  const html = render(<AppShell {...basis({ settings: EINSTELLUNGEN, settingsOpen: true })} />);
  const zeile = tags(html, 'div').find((t) => attr(t, 'data-bereich') === 'inhalt') ?? '';
  ok(
    hatKlassen(zeile, 'relative flex min-h-0 flex-1'),
    'Shell: Inhaltszeile relative flex min-h-0 flex-1 (Panel bezieht sich auf die Zeile, Statusleiste bleibt sichtbar)',
  );
  ok(hatKlassen(tags(html, 'main')[0] ?? '', 'min-h-0 min-w-0 flex-1 overflow-auto'), 'Shell: <main> min-h-0 min-w-0 flex-1 overflow-auto');
}
{
  // Weiterleitungen an die Kopfzeile: onAir und headerCenter müssen ankommen.
  const live = render(<AppShell {...basis({ onAir: { live: true } })} />);
  ok(zwischen(live, '<header', '</header>').includes('ON AIR'), 'Shell onAir live → ON AIR in der Kopfzeile');
  const mitte = render(<AppShell {...basis({ headerCenter: <span>Mitte-Text</span> })} />);
  ok(zwischen(mitte, 'data-bereich="mitte"', '</div>').includes('Mitte-Text'), 'Shell headerCenter → erscheint in data-bereich="mitte"');
}
{
  // Bindungen, die kein Render zeigt (Klick-Rückrufe): Pflichtzeilen im Quelltext.
  const quelle = leseText('src/components/AppShell.tsx');
  ok(
    quelle.includes('onSettingsToggle={zahnradKlick(p)}') && quelle.includes('onClose={panelSchliessen(p)}') &&
      quelle.includes('onAir={onAir}') && quelle.includes('center={headerCenter}'),
    'Shell Quelltext: ⚙ → zahnradKlick(p), Panel onClose → panelSchliessen(p), onAir und headerCenter an die Kopfzeile',
  );
}
{
  const html = render(
    <AppShell tool="Studio-Control" status={[]} settingsOpen={false} onSettingsChange={nichts}>
      <p>Anmelden</p>
    </AppShell>,
  );
  ok(
    html.includes('<header') && html.includes('<main') && html.includes('<footer') && html.includes('data-uhr') &&
      !html.includes('<aside') && zahnrad(html) === '' && html.includes('<div role="status" aria-live="polite" class="') &&
      html.includes('JM Studio-Control'),
    'Shell Zustand ohne Sitzung: status [], keine settings → Rahmen mit Uhr',
  );
}
{
  const html = render(
    <AppShell {...basis({ settings: EINSTELLUNGEN, settingsOpen: true, settingsSection: 'ndi', onAir: { live: true }, toolbar: <span>W</span> })} />,
  );
  const alle = tags(html, '[a-z0-9]+').flatMap(klassen);
  const uebergaenge = alle.filter((k) => k.includes('transition'));
  ok(
    uebergaenge.length > 0 && uebergaenge.every((k) => k.startsWith('motion-safe:')) && !alle.some((k) => k.startsWith('animate-')),
    'Shell: Übergänge nur motion-safe, kein animate-',
  );
}
