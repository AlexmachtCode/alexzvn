// Task 13 · SettingsPanel und PanelAnker (Spec 3.1, 3.6, 4.3; E7, E8): Titel und Schließen-Knopf, Sprungziel mit
// Hervorhebung, Escape nur bei Fokus im Panel (und nicht, wenn eine Eingabe die Taste schon verbraucht hat).
import { zahlTaste } from '../src/components/NumberInput';
import {
  PANEL_HERVORHEBUNG_MS,
  PanelAnker,
  SettingsPanel,
  panelFokus,
  panelProps,
  panelSprung,
  panelTaste,
  useSettingsPanel,
} from '../src/components/SettingsPanel';
import { gleich, leseText, ok, render } from './harness';
import { attr, hatKlassen, tags, text, zwischen } from './lib/markup';

const nichts = (): void => undefined;
/** [data-section-id, data-hervorgehoben] aller Anker in Reihenfolge. */
const anker = (html: string): Array<[string | undefined, string | undefined]> =>
  tags(html, 'div')
    .filter((t) => attr(t, 'data-section-id') !== undefined)
    .map((t) => [attr(t, 'data-section-id'), attr(t, 'data-hervorgehoben')]);

{
  const html = render(
    <SettingsPanel open={false} onClose={nichts}>
      <p>Inhalt</p>
    </SettingsPanel>,
  );
  ok(html === '', 'Panel zu → nichts gerendert');
}
{
  const html = render(
    <SettingsPanel open onClose={nichts} id="panel-1">
      <PanelAnker id="ndi">NDI</PanelAnker>
    </SettingsPanel>,
  );
  const [aside] = tags(html, 'aside');
  ok(
    attr(aside, 'aria-label') === 'Einstellungen' && attr(aside, 'id') === 'panel-1' && attr(aside, 'tabindex') === '-1' &&
      text(zwischen(html, '<h2', '</h2>').replace(/^[^>]*>/, '')) === 'Einstellungen',
    'Panel offen: <aside aria-label="Einstellungen" tabindex="-1">, Überschrift „Einstellungen“',
  );
  const [schliessen] = tags(html, 'button');
  ok(
    attr(schliessen, 'type') === 'button' && attr(schliessen, 'aria-label') === 'Einstellungen schließen',
    'Panel: Schließen-Knopf aria-label „Einstellungen schließen“',
  );
  ok(
    hatKlassen(aside, 'w-[var(--panel-w)] bg-[var(--surface-raised)] max-[900px]:absolute shrink-0'),
    'Panel: w-[var(--panel-w)], bg-[var(--surface-raised)], max-[900px]:absolute',
  );
  ok((attr(aside, 'style') ?? '').includes('-webkit-app-region:no-drag'), 'Panel: no-drag im style');
}
{
  const html = render(
    <SettingsPanel open onClose={nichts} sectionId="iveo">
      <PanelAnker id="ndi">a</PanelAnker>
      <PanelAnker id="iveo">b</PanelAnker>
      <PanelAnker id="datalink">c</PanelAnker>
    </SettingsPanel>,
  );
  gleich(
    anker(html),
    [
      ['ndi', 'false'],
      ['iveo', 'true'],
      ['datalink', 'false'],
    ],
    'Panel sectionId → nur dieser Anker data-hervorgehoben=true',
  );
  const iveo = tags(html, 'div').find((t) => attr(t, 'data-section-id') === 'iveo') ?? '';
  ok(hatKlassen(iveo, 'border-[var(--tally-selected)] rounded-[var(--radius-lg)]'), 'Panel: hervorgehobener Anker mit Rand --tally-selected');
  const ohne = render(
    <SettingsPanel open onClose={nichts}>
      <PanelAnker id="ndi">a</PanelAnker>
    </SettingsPanel>,
  );
  gleich(anker(ohne), [['ndi', 'false']], 'Panel ohne sectionId: kein Anker hervorgehoben');
}
{
  const html = render(<PanelAnker id="ndi">x</PanelAnker>);
  const [tag] = tags(html, 'div');
  ok(
    attr(tag, 'id') === 'einstellung-ndi' && attr(tag, 'data-section-id') === 'ndi' && attr(tag, 'data-hervorgehoben') === 'false',
    'PanelAnker ohne Panel: id einstellung-<id>, nicht hervorgehoben',
  );
  ok(attr(tag, 'tabindex') === '-1', 'PanelAnker: tabIndex -1 (Fokusziel des Sprungs)');
  function Zeige(): React.JSX.Element {
    return <span>{useSettingsPanel().hervorgehoben ?? '-'}</span>;
  }
  gleich(
    [
      render(<Zeige />),
      render(
        <SettingsPanel open onClose={nichts} sectionId="iveo">
          <Zeige />
        </SettingsPanel>,
      ).includes('<span>iveo</span>'),
    ],
    ['<span>-</span>', true],
    'useSettingsPanel: außerhalb leer, im Panel die hervorgehobene id',
  );
  ok(PANEL_HERVORHEBUNG_MS === 1500, 'Panel: Hervorhebung dauert 1500 ms');
}

// ── Escape (panelTaste) ──
{
  const protokoll: string[] = [];
  type Ziel = { tagName: string; type?: string; isContentEditable?: boolean };
  type Mod = { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean };
  const taste = (key: string, defaultPrevented = false, target?: Ziel, mod: Mod = {}) => ({
    key,
    defaultPrevented,
    target,
    ...mod,
    stopPropagation: () => void protokoll.push('stop'),
    preventDefault: () => void protokoll.push('prevent'),
  });
  const zu = () => void protokoll.push('zu');
  panelTaste(taste('Escape'), zu);
  gleich(protokoll, ['stop', 'prevent', 'zu'], 'panelTaste Escape → stopPropagation, preventDefault, onClose');
  protokoll.length = 0;
  panelTaste(taste('Enter'), zu);
  panelTaste(taste(' '), zu);
  panelTaste(taste(' ', false, { tagName: 'ASIDE' }), zu);
  panelTaste(taste(' ', false, { tagName: 'DIV' }), zu);
  gleich(protokoll, [], 'panelTaste Taste mit Fokus auf Panel/Abschnitt → nichts (Leertaste/Pfeile erreichen die Tool-Kürzel, Spec 10)');
  // Knöpfe, Schalter, Links, Häkchen verbrauchen die Leertaste nicht (Tool-Handler rufen preventDefault): Spec 10, Leertaste = GO bleibt.
  for (const tagName of ['BUTTON', 'A']) panelTaste(taste(' ', false, { tagName }), zu);
  for (const type of ['checkbox', 'radio', 'button']) panelTaste(taste(' ', false, { tagName: 'INPUT', type }), zu);
  gleich(protokoll, [], 'panelTaste Leertaste auf Knopf/Link/Häkchen → nichts (Tool-Kürzel gilt wie bisher, Spec 10)');
  // Felder verbrauchen Zeichen- und Navigationstasten: die bleiben im Panel.
  for (const tagName of ['INPUT', 'SELECT', 'TEXTAREA']) panelTaste(taste(' ', false, { tagName }), zu);
  panelTaste(taste('ArrowLeft', false, { tagName: 'INPUT', type: 'range' }), zu);
  panelTaste(taste('a', false, { tagName: 'INPUT', type: 'text' }), zu);
  panelTaste(taste(' ', false, { tagName: 'DIV', isContentEditable: true }), zu);
  gleich(protokoll, ['stop', 'stop', 'stop', 'stop', 'stop', 'stop'], 'panelTaste Taste auf Feld/Auswahl/contentEditable → stopPropagation, schließt nicht');
  protokoll.length = 0;
  // Kürzel mit Strg/Meta/Alt verbraucht kein Feld: sie erreichen das Tool (DAW Strg+S).
  for (const mod of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) panelTaste(taste('s', false, { tagName: 'INPUT', type: 'text' }, mod), zu);
  gleich(protokoll, [], 'panelTaste Strg/Meta/Alt+Taste im Feld → nichts (Tool-Kürzel erreichen das Tool)');
  // Pfeile/Entf/Pos1 auf einem Knopf: der Knopf verbraucht sie nicht.
  for (const key of ['ArrowUp', 'ArrowDown', 'Delete', 'Home', 'r']) panelTaste(taste(key, false, { tagName: 'BUTTON' }), zu);
  gleich(protokoll, [], 'panelTaste andere Tasten auf einem Knopf → nichts');
  protokoll.length = 0;
  panelTaste(taste('Escape', false, { tagName: 'DIV' }), zu);
  gleich(protokoll, ['stop', 'prevent', 'zu'], 'panelTaste Escape auch ohne Bedienelement → stopPropagation, preventDefault, onClose');
  protokoll.length = 0;
  panelTaste(taste('Escape', true), zu);
  gleich(protokoll, ['stop'], 'panelTaste defaultPrevented → nur stopPropagation (Escape gehört schon jemand anderem, schließt nicht)');
}
{
  // E8: Ein Zahlenfeld mit geändertem Entwurf verbraucht Escape – das Panel bleibt offen.
  let zu = 0;
  const ereignis = {
    key: 'Escape',
    defaultPrevented: false,
    stopPropagation: nichts,
    preventDefault() {
      ereignis.defaultPrevented = true;
    },
  };
  zahlTaste(ereignis, () => ({ verbraucht: true }));
  panelTaste(ereignis, () => void zu++);
  ok(zu === 0, 'Panel: Escape, das ein Zahlenfeld verbraucht hat, schließt das Panel nicht');
}

// ── Props und Effekt-Körper (die Effekte selbst laufen nur im Browser) ──
{
  let zu = 0;
  const protokoll: string[] = [];
  const props = panelProps({ id: 'p', onClose: () => void zu++ });
  props.onKeyDown({
    key: 'Escape',
    defaultPrevented: false,
    stopPropagation: () => void protokoll.push('stop'),
    preventDefault: () => void protokoll.push('prevent'),
  });
  ok(
    zu === 1 && protokoll.join(' ') === 'stop prevent' && props['aria-label'] === 'Einstellungen' && props.tabIndex === -1 && props.id === 'p',
    'Panel-Props: Escape am Panel schließt (panelTaste), aria-label „Einstellungen“, tabIndex -1, id',
  );
}
{
  const log: string[] = [];
  const ziel = (name: string) => ({ focus: () => void log.push(`fokus ${name}`) });
  const zahnrad = ziel('zahnrad');
  const feldImPanel = ziel('feld');
  const panel = { ...ziel('panel'), contains: (z: unknown) => z === feldImPanel };
  let aktiv: { focus(): void } | null = zahnrad;
  const zurueck = panelFokus(panel, () => aktiv);
  aktiv = feldImPanel;
  zurueck();
  const imPanel = [...log];
  log.length = 0;
  aktiv = zahnrad;
  const zurueck2 = panelFokus(panel, () => aktiv);
  aktiv = ziel('inhalt');
  zurueck2();
  gleich(
    [imPanel, log],
    [['fokus panel', 'fokus zahnrad'], ['fokus panel']],
    'Panel-Fokus: beim Öffnen aufs Panel; beim Schließen zurück zum ⚙ – nur, wenn der Fokus im Panel lag',
  );
  log.length = 0;
  const abschnitt = ziel('abschnitt');
  panelFokus(panel, () => zahnrad, abschnitt);
  panelFokus(panel, () => zahnrad, null);
  gleich(log, ['fokus abschnitt', 'fokus panel'], 'Panel-Fokus: mit Sprungziel aufs Ziel, ohne Ziel (null) aufs Panel');
}
{
  const gesetzt: Array<string | undefined> = [];
  const gescrollt: string[] = [];
  const uhr: Array<{ f: () => void; ms: number }> = [];
  let geloescht: unknown = 'nichts';
  const zeit = {
    setTimeout: (f: () => void, ms: number) => {
      uhr.push({ f, ms });
      return 42;
    },
    clearTimeout: (id: unknown) => {
      geloescht = id;
    },
  };
  const anker = (id: string) => ({ scrollIntoView: () => void gescrollt.push(id) });
  const aufraeumen = panelSprung('iveo', anker, (id) => void gesetzt.push(id), zeit);
  uhr[0]?.f();
  aufraeumen?.();
  const ohne = panelSprung(undefined, anker, (id) => void gesetzt.push(id), zeit);
  gleich(
    [gesetzt, gescrollt, uhr.map((u) => u.ms), geloescht, ohne],
    [['iveo', undefined, undefined], ['iveo'], [1500], 42, undefined],
    'Panel-Sprung: hervorheben, Anker in Sicht, nach 1500 ms enden; Aufräumen löscht die Uhr; ohne Abschnitt nur zurücksetzen',
  );
}
{
  const quelle = leseText('src/components/SettingsPanel.tsx');
  const fehlt = [
    'useLayoutEffektImBrowser(() => panelFokus(panelRef.current, aktivesElement, sectionId ? ankerIn(panelRef.current, sectionId) : null), []);',
    'useEffect(() => panelSprung(sectionId, (ziel) => ankerIn(panelRef.current, ziel), setHervorgehoben), [sectionId]);',
    '<aside ref={panelRef} {...panelProps({ id, onClose })}>',
  ].filter((zeile) => quelle.split(zeile).length !== 2);
  ok(fehlt.length === 0, 'Panel Verdrahtung: Fokus- und Sprung-Effekt, Panel-Props per Spread (je genau einmal)');
  for (const zeile of fehlt) console.log(`     fehlt: ${zeile}`);
}
