// Task 14 · AppHeader (Spec 3.2, 3.8; E3, E22): Ziehfläche mit Mac-Freiraum, jedes Bedienelement no-drag,
// On-Air-Anzeige mit Form und Text, ⚙ nur mit Einstellungen.
import { AppHeader } from '../src/components/AppHeader';
import { LIVE_FLAECHE_KLASSE, STATUS_SYMBOL_KLASSE } from '../src/lib/status';
import { gleich, ok, render } from './harness';
import { attr, hatKlassen, klassen, ohneVersteckt, tags, text, zwischen } from './lib/markup';

const NO_DRAG = '-webkit-app-region:no-drag';
const nichts = (): void => undefined;
/** Öffnendes Tag und Inhalt der On-Air-Anzeige (sie enthält genau ein inneres span). */
const onAir = (html: string): { tag: string; inhalt: string } => {
  const tag = tags(html, 'span').find((t) => attr(t, 'data-onair') !== undefined) ?? '';
  const ab = html.indexOf(tag) + tag.length;
  const inhalt = html.slice(ab, html.indexOf('</span>', html.indexOf('</span>', ab) + 1));
  return { tag, inhalt };
};

{
  const html = render(<AppHeader tool="Titler" mac={false} />);
  ok(
    tags(html, 'svg').length === 1 && attr(tags(html, 'svg')[0], 'role') === 'img' && text(html).includes('JM Titler'),
    'Header: Logo + „JM {tool}“',
  );
  const [header] = tags(html, 'header');
  ok(
    (attr(header, 'style') ?? '').includes('-webkit-app-region:drag') && hatKlassen(header, 'h-[var(--header-h)] shrink-0'),
    'Header: <header> mit -webkit-app-region:drag und h-[var(--header-h)]',
  );
}
{
  const mac = klassen(tags(render(<AppHeader tool="Titler" mac />), 'header')[0]);
  const win = klassen(tags(render(<AppHeader tool="Titler" mac={false} />), 'header')[0]);
  const vorgabe = klassen(tags(render(<AppHeader tool="Titler" />), 'header')[0]);
  ok(
    mac.includes('pl-20') && !mac.includes('pl-4') && win.includes('pl-4') && !win.includes('pl-20') && vorgabe.includes('pl-4'),
    'Header mac=true → pl-20; mac=false → pl-4; Vorgabe isElectronMac (unter Node false) → pl-4',
  );
}
{
  const html = render(
    <AppHeader
      tool="Titler"
      mac={false}
      center={<span>Show vom Master: Gala · Stand 09:05</span>}
      settingsAvailable
      settingsOpen={false}
      onSettingsToggle={nichts}
    />,
  );
  const knoepfe = tags(html, 'button');
  const mitte = tags(html, 'div').find((t) => attr(t, 'data-bereich') === 'mitte') ?? '';
  ok(
    knoepfe.length === 2 && knoepfe.every((k) => (attr(k, 'style') ?? '').includes(NO_DRAG)) && (attr(mitte, 'style') ?? '').includes(NO_DRAG) &&
      text(html).includes('Show vom Master: Gala · Stand 09:05'),
    'Header: Mitte, ThemeToggle und ⚙ mit no-drag (jeder Knopf einzeln)',
  );
}
{
  const html = render(<AppHeader tool="Titler" mac={false} />);
  ok(
    onAir(html).tag === '' && !text(html).includes('ON AIR') && !text(html).includes('bereit'),
    'Header onAir fehlt → keine On-Air-Anzeige',
  );
}
{
  const html = render(<AppHeader tool="Titler" mac={false} onAir={{ live: true }} />);
  const a = onAir(html);
  ok(
    attr(a.tag, 'data-onair') === 'live' && hatKlassen(a.tag, LIVE_FLAECHE_KLASSE) && text(ohneVersteckt(a.inhalt)) === 'ON AIR' &&
      a.inhalt.includes('<span aria-hidden="true">■</span>'),
    'Header onAir live → LIVE_FLAECHE_KLASSE, ■ und „ON AIR“',
  );
  const mitLabel = onAir(render(<AppHeader tool="Titler" mac={false} onAir={{ live: true, label: 'AUF SENDUNG' }} />));
  ok(text(ohneVersteckt(mitLabel.inhalt)) === 'AUF SENDUNG', 'Header onAir live mit label → label statt „ON AIR“');
}
{
  const html = render(<AppHeader tool="Titler" mac={false} onAir={{ live: false, label: 'AUF SENDUNG' }} />);
  const a = onAir(html);
  ok(
    attr(a.tag, 'data-onair') === 'bereit' &&
      hatKlassen(a.tag, 'border-[var(--tally-ready)] text-[var(--foreground)]') &&
      a.inhalt.includes(`<span aria-hidden="true" class="${STATUS_SYMBOL_KLASSE.ok}">●</span>`) &&
      text(ohneVersteckt(a.inhalt)) === 'bereit' &&
      !html.includes('bg-[var(--tally-live)]'),
    'Header onAir nicht live → „bereit“ mit ● in Symbolklasse ok, Text in Vordergrundfarbe (nie nur Farbe)',
  );
}
{
  const ohne = render(<AppHeader tool="Titler" mac={false} />);
  ok(tags(ohne, 'button').length === 1, 'Header ohne settingsAvailable: kein ⚙ (nur der ThemeToggle)');
  const zu = tags(render(<AppHeader tool="Titler" mac={false} settingsAvailable settingsOpen={false} panelId="p1" onSettingsToggle={nichts} />), 'button');
  const auf = tags(render(<AppHeader tool="Titler" mac={false} settingsAvailable settingsOpen panelId="p1" onSettingsToggle={nichts} />), 'button');
  const zahnradZu = zu.find((t) => attr(t, 'data-zahnrad') !== undefined) ?? '';
  const zahnradAuf = auf.find((t) => attr(t, 'data-zahnrad') !== undefined) ?? '';
  gleich(
    [
      attr(zahnradZu, 'aria-expanded'),
      attr(zahnradZu, 'aria-controls'),
      attr(zahnradZu, 'aria-label'),
      attr(zahnradAuf, 'aria-expanded'),
      attr(zahnradAuf, 'aria-controls'),
      attr(zahnradAuf, 'aria-label'),
    ],
    ['false', undefined, 'Einstellungen öffnen', 'true', 'p1', 'Einstellungen schließen'],
    'Header ⚙: aria-expanded, aria-controls nur bei offenem Panel, aria-label öffnen/schließen',
  );
  ok(attr(zahnradZu, 'type') === 'button' && hatKlassen(zahnradZu, 'h-[var(--control-h)] w-[var(--control-h)]'), 'Header ⚙: type=button, Größe --control-h');
  const zahnradText = zwischen(render(<AppHeader tool="Titler" mac={false} settingsAvailable onSettingsToggle={nichts} />), 'data-zahnrad', '</button>');
  ok(zahnradText.includes('<span aria-hidden="true">⚙</span>'), 'Header ⚙: Symbol aria-hidden (Name kommt aus aria-label)');
}
