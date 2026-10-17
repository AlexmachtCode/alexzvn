// UX-Pilot C10 · Live-Bereich und Bedienung (Spec 3.4, 5.1, Anhang A „Titler“; E12, E13, E21, E23): Vorschau und
// höchstens vier Haupttasten immer sichtbar, daneben Vorlage, Inhalt, Grafik-Vorlagen und Daten / Recall. Stil, Import und
// Löschen ziehen ins Panel. Render ohne Browser; die gemerkten Collapsibles über einen nachgestellten localStorage.
import { createRef, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Field, TextInput } from '@jm/ui';
import { enthaelt, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import type { GraphicTemplate, TitlerConfig } from '@shared/types';
import { TITLER_TEXTE } from '@/lib/oberflaeche';
import { Bedienung, type BedienungProps } from '@/views/Bedienung';
import { Einstellungen } from '@/views/Einstellungen';
import { Slider } from '@/views/felder';
import { LiveBereich, liveTasten, type LiveBereichProps } from '@/views/LiveBereich';
import { attr, basisConfig, basisStand, basisStatus, bereich, ohneKommentare, protokollAktionen, tags, text, VORLAGEN } from './testzustand';

const nichts = (): void => undefined;
function live(z: Partial<LiveBereichProps> = {}): LiveBereichProps {
  return {
    previewRef: createRef<HTMLCanvasElement>(),
    live: false,
    ndiActive: false,
    activeEntry: -1,
    anzahl: 0,
    onTake: nichts,
    onClear: nichts,
    onSchritt: nichts,
    ...z,
  };
}
function bedienung(z: Partial<BedienungProps> = {}): BedienungProps {
  return {
    config: basisConfig(),
    status: basisStatus(),
    templates: [],
    setConfig: nichts,
    onSelectTemplate: nichts,
    onOpenBoard: nichts,
    onRecall: nichts,
    ...z,
  };
}
/** Rendert mit einem nachgestellten localStorage (Collapsible liest ihn nur mit window); danach ist window wieder weg. */
function mitSpeicher(werte: Record<string, string>, f: () => string): string {
  const g = globalThis as { window?: unknown };
  g.window = { localStorage: { getItem: (k: string) => werte[k] ?? null, setItem: nichts } };
  try {
    return f();
  } finally {
    delete g.window;
  }
}
/** Titel und aria-expanded der Collapsibles in Reihenfolge. */
function klappen(html: string): string[] {
  return [...html.matchAll(/<button type="button" aria-expanded="(true|false)"[^>]*>[\s\S]*?<span[^>]*>([^<]*)<\/span>/g)].map(
    (m) => `${m[2]}:${m[1]}`,
  );
}

// ── Haupttasten (liveTasten) ──
{
  const T = TITLER_TEXTE;
  const zeile = (p: LiveBereichProps): string[] =>
    liveTasten(p).map((t) => `${t.label}:${t.state}${t.disabledReason ? `(${t.disabledReason})` : ''}`);
  gleich(
    [
      zeile(live()),
      zeile(live({ live: true })),
      zeile(live({ anzahl: 3, activeEntry: 0 })),
      zeile(live({ anzahl: 3, activeEntry: 2, live: true })),
      zeile(live({ anzahl: 3, activeEntry: -1 })),
      zeile(live({ anzahl: 1, activeEntry: 0 })),
    ],
    [
      [`${T.take}:bereit`, `${T.clear}:bereit`],
      [`${T.take}:live`, `${T.clear}:bereit`],
      [`${T.take}:bereit`, `${T.clear}:bereit`, `${T.zurueck}:gesperrt(${T.ersterEintrag})`, `${T.weiter}:bereit`],
      [`${T.take}:live`, `${T.clear}:bereit`, `${T.zurueck}:bereit`, `${T.weiter}:gesperrt(${T.letzterEintrag})`],
      [`${T.take}:bereit`, `${T.clear}:bereit`, `${T.zurueck}:bereit`, `${T.weiter}:bereit`],
      [`${T.take}:bereit`, `${T.clear}:bereit`, `${T.zurueck}:gesperrt(${T.ersterEintrag})`, `${T.weiter}:gesperrt(${T.letzterEintrag})`],
    ],
    'liveTasten: Take und Clear immer, ◀/▶ Eintrag nur mit Einträgen, an den Rändern gesperrt mit Grund; Take nie gesperrt (E12)',
  );
  const log: string[] = [];
  const tasten = liveTasten(
    live({
      anzahl: 3,
      activeEntry: 1,
      onTake: () => void log.push('take'),
      onClear: () => void log.push('clear'),
      onSchritt: (d) => void log.push(`schritt ${d}`),
    }),
  );
  for (const t of tasten) t.onClick?.();
  gleich(log, ['take', 'clear', 'schritt -1', 'schritt 1'], 'liveTasten: Klick ruft onTake, onClear, onSchritt(-1), onSchritt(1)');
  ok(tasten.every((t) => t.shortcut === undefined && t.onPress === undefined), 'liveTasten: keine Kürzel, kein Halten (UO5)');
}

// ── Live-Bereich gerendert ──
{
  const aus = render(<LiveBereich {...live({ anzahl: 3, activeEntry: 0 })} />);
  const an = render(<LiveBereich {...live({ ndiActive: true })} />);
  ok(
    /^<div data-titler="live"[^>]*><div [^>]*cg-checker[^>]*><canvas /.test(aus),
    'LiveBereich: die Vorschau ist das erste Kind des Live-Bereichs, darin zuerst das <canvas>',
  );
  const [vorschau] = tags(aus, 'canvas');
  gleich([attr(vorschau, 'width'), attr(vorschau, 'height')], ['960', '540'], 'LiveBereich: Vorschau 960×540 wie bisher');
  const tastenTeil = bereich(aus, 'haupttasten');
  gleich(
    [tags(tastenTeil, 'button').length, (tastenTeil.match(/ data-state="/g) ?? []).length, aus.includes('<kbd')],
    [4, 4, false],
    'LiveBereich: vier TallyButtons in data-titler="haupttasten", kein <kbd> (höchstens vier, keine Kürzel)',
  );
  gleich(
    [text(bereich(aus, 'hinweiszeile')), text(bereich(an, 'hinweiszeile'))],
    [TITLER_TEXTE.hinweisNdiAus, TITLER_TEXTE.hinweisNdiAn],
    'LiveBereich: Hinweiszeile bei NDI aus (T4) bzw. an (wie bisher)',
  );
  pruefeIdVerweise(aus, 'LiveBereich: id-Verweise gültig (Sperrgrund per aria-describedby)');
}

// ── Bedienung: Vorlage und Inhalt ──
{
  const html = render(<Bedienung {...bedienung()} />);
  ok(
    /<h3[^>]*>Vorlage<\/h3>/.test(html) && /<h3[^>]*>Inhalt<\/h3>/.test(html) && html.startsWith('<div data-titler="bedienung"'),
    'Bedienung: „Vorlage“ und „Inhalt“ immer offen (SettingsSection, kein Collapsible)',
  );
  gleich(klappen(html), ['Grafik-Vorlagen:false', 'Daten / Recall:true'], 'Bedienung: Collapsibles „Grafik-Vorlagen“ (zu) und „Daten / Recall“ (offen) wie bisher');
  const labels = (h: string): string[] => [...h.matchAll(/<label for="[^"]+"[^>]*>([^<]*)<\/label>/g)].map((m) => m[1]);
  gleich(labels(html), ['Name', 'Untertitel'], 'Bedienung › Inhalt: Bauchbinde mit Name und Untertitel aus @jm/ui (Field + TextInput, E23)');
  pruefeIdVerweise(html, 'Bedienung: id-Verweise gültig (Beschriftung → Eingabe)');
  const grafik = render(
    <Bedienung
      {...bedienung({ config: basisConfig({ template: 'graphic', activeGraphicId: 'v1', slotText: { name: 'Anna' } }), templates: VORLAGEN })}
    />,
  );
  gleich(labels(grafik), ['Name-Ebene', 'Rolle-Ebene'], 'Bedienung › Inhalt: Grafik-Vorlage mit einem Feld je Slot');
  gleich(
    tags(grafik, 'input').map((t) => attr(t, 'value')),
    ['Anna', 'Moderation'],
    'Bedienung › Inhalt: Slot-Wert aus slotText, sonst Vorgabetext',
  );
  const ohne = render(<Bedienung {...bedienung({ config: basisConfig({ template: 'graphic', activeGraphicId: '' }) })} />);
  enthaelt(ohne, TITLER_TEXTE.keineGrafik, 'Bedienung › Inhalt: ohne gewählte Grafik-Vorlage der Hinweis T6');
  const standbild = render(<Bedienung {...bedienung({ config: basisConfig({ template: 'graphic', activeGraphicId: 'v2' }), templates: VORLAGEN })} />);
  enthaelt(text(standbild), 'Diese Vorlage hat keine Textfelder (reines Standbild).', 'Bedienung › Inhalt: Grafik-Vorlage ohne Textfelder mit dem Hinweis von heute (Nr. 18)');
  const banner = render(<Bedienung {...bedienung({ config: basisConfig({ template: 'banner', bannerText: 'Eilmeldung' }) })} />);
  const ticker = render(<Bedienung {...bedienung({ config: basisConfig({ template: 'ticker', tickerText: 'Lauftext', tickerSpeed: 0.12 }) })} />);
  const [tempo] = tags(ticker, 'input').filter((t) => attr(t, 'type') === 'range');
  gleich(
    [
      labels(banner),
      tags(banner, 'input').map((t) => attr(t, 'value')),
      labels(ticker),
      text(ticker).includes('Ticker-Tempo'),
      ['min', 'max', 'step', 'value'].map((a) => attr(tempo, a)),
    ],
    [['Banner-Text'], ['Eilmeldung'], ['Ticker-Text'], true, ['0.02', '0.3', '0.01', '0.12']],
    'Bedienung › Inhalt: Banner mit Feld „Banner-Text“, Ticker mit Feld „Ticker-Text“ und Schieber „Ticker-Tempo“ 0,02–0,3 in 0,01 (Nr. 14–16)',
  );
}

// ── Bedienung: Verdrahtung der Felder (onChange → setConfig mit dem richtigen Schlüssel) ──
// Ohne Browser lässt sich nicht tippen. Darum ruft ein Fänger Bedienung beim Server-Render auf (ihre useMemo laufen dort)
// und hält den Baum fest, den sie zurückgibt; darin stehen die Felder mit ihren onChange, die der Test selbst aufruft.
{
  function felder(config: TitlerConfig, templates: GraphicTemplate[] = []): string[] {
    const patches: string[] = [];
    let baum: ReactNode = null;
    function Faenger(): React.JSX.Element {
      const el = Bedienung(bedienung({ config, templates, setConfig: (patch) => void patches.push(JSON.stringify(patch)) }));
      baum = el;
      return el;
    }
    render(<Faenger />);
    const aus: string[] = [];
    const geh = (n: ReactNode): void => {
      if (Array.isArray(n)) {
        n.forEach(geh);
        return;
      }
      if (!isValidElement(n)) return;
      const props = n.props as { label?: string; children?: ReactNode; onChange?: (v: number) => void };
      const kind = props.children;
      let ruf: (() => void) | undefined;
      if (n.type === Field && isValidElement(kind) && kind.type === TextInput) {
        const eingabe = kind as ReactElement<{ onChange(v: string): void }>;
        ruf = () => eingabe.props.onChange('Neu');
      } else if (n.type === Slider) {
        ruf = () => props.onChange?.(0.25);
      }
      if (ruf) {
        const vorher = patches.length;
        ruf();
        aus.push(`${props.label}: ${patches.slice(vorher).join(' ') || 'nichts'}`);
      }
      geh(kind);
    };
    geh(baum);
    return aus;
  }
  gleich(
    [
      ...felder(basisConfig()),
      ...felder(basisConfig({ template: 'banner' })),
      ...felder(basisConfig({ template: 'ticker' })),
      ...felder(basisConfig({ template: 'graphic', activeGraphicId: 'v1', slotText: { name: 'Anna' } }), VORLAGEN),
    ],
    [
      'Name: {"name":"Neu"}',
      'Untertitel: {"subtitle":"Neu"}',
      'Banner-Text: {"bannerText":"Neu"}',
      'Ticker-Text: {"tickerText":"Neu"}',
      'Ticker-Tempo: {"tickerSpeed":0.25}',
      'Name-Ebene: {"slotText":{"name":"Neu"}}',
      'Rolle-Ebene: {"slotText":{"name":"Anna","rolle":"Neu"}}',
    ],
    'Bedienung › Inhalt: jedes Feld schreibt beim Tippen in seinen Schlüssel (Name, Untertitel, Banner-Text, Ticker-Text, Ticker-Tempo, Slots; E23)',
  );
}

// ── Bedienung: Grafik-Vorlagen (Kacheln) und gemerkte Collapsibles ──
{
  const offen = { 'jm.collapsible.titler.graphics': '1', 'jm.collapsible.titler.recall': '0' };
  const html = mitSpeicher(offen, () =>
    render(<Bedienung {...bedienung({ config: basisConfig({ activeGraphicId: 'v2' }), templates: VORLAGEN })} />),
  );
  gleich(
    [klappen(html), klappen(mitSpeicher({}, () => render(<Bedienung {...bedienung()} />)))],
    [
      ['Grafik-Vorlagen:true', 'Daten / Recall:false'],
      ['Grafik-Vorlagen:false', 'Daten / Recall:true'],
    ],
    'Bedienung: Collapsibles merken sich unter jm.collapsible.titler.graphics und …titler.recall (persistId wie bisher)',
  );
  const kacheln = tags(html, 'button').filter((t) => VORLAGEN.some((v) => attr(t, 'title') === v.name));
  gleich(
    kacheln.map((t) => [attr(t, 'type'), attr(t, 'aria-pressed'), attr(t, 'title')]),
    [
      ['button', 'false', 'Bauchbinde rot'],
      ['button', 'true', 'Standbild'],
    ],
    'Bedienung › Grafik-Vorlagen: Kacheln sind <button type="button"> mit aria-pressed (per Tastatur wählbar, E13)',
  );
  ok(
    !html.includes('Datei importieren') && !html.includes(TITLER_TEXTE.loeschen) && !html.includes('hierher ziehen'),
    'Bedienung › Grafik-Vorlagen: nur wählen; Import und Löschen liegen im Panel',
  );
  const leer = mitSpeicher(offen, () => render(<Bedienung {...bedienung()} />));
  enthaelt(leer, TITLER_TEXTE.keineVorlagen, 'Bedienung › Grafik-Vorlagen: ohne Vorlagen der Hinweis T6');
}

// ── Bedienung: Daten / Recall ──
{
  const status = basisStatus({
    entries: [
      { key: 'a', label: 'Anna Berg' },
      { key: 'b', label: 'Ben Kurz' },
      { key: 'c', label: '' },
    ],
    activeEntry: 1,
    variables: { name: 'Ben Kurz' },
    dataSources: ['speakers.tsv'],
    hinweis: { art: 'H3', text: 'Hinweis H3 wörtlich' },
    datenQuelle: { art: 'show', zeile: 'Quelle: Show „Probe“ · 3 Speaker', zurueckKnopf: null, ohneOrdner: false },
  });
  const html = render(<Bedienung {...bedienung({ status, config: basisConfig({ name: '{{name}}' }) })} />);
  ok(
    ['Quelle: Show „Probe“ · 3 Speaker', 'Hinweis H3 wörtlich', 'Einträge · 2/3', '⧉ Board', 'Anna Berg', 'Ben Kurz', 'Im Text verwendet:', '{{name}}', 'Quelle: speakers.tsv'].every(
      (t) => text(html).includes(t),
    ) && !/>[‹›]</.test(html),
    'Bedienung › Daten / Recall: Quellzeile, Hinweis, Zähler, ⧉ Board, Liste, Variablen, „Im Text verwendet“; ‹ und › entfallen (E12)',
  );
  gleich(tags(html, 'button').length, 4 + 2 + 1 + 3, 'Bedienung › Daten / Recall: Knöpfe = 4 Vorlagen + 2 Collapsibles + ⧉ Board + 3 Einträge');
  gleich(
    [...html.matchAll(/<button type="button"( aria-current="true")? class="[^"]*"><span class="tabular[^"]*">(\d+)<\/span>/g)].map((m) => `${m[2]}:${m[1] ? 'aktiv' : '-'}`),
    ['1:-', '2:aktiv', '3:-'],
    'Bedienung › Daten / Recall: der aktive Eintrag trägt aria-current, nicht nur Farbe und Fettung',
  );
  const kasten = tags(html, 'p').find((t) => attr(t, 'role') === 'status');
  ok(
    (attr(kasten, 'class') ?? '').includes('border-[var(--status-warn)]/50 bg-[var(--status-warn)]/15') && !html.includes('--warning'),
    'Bedienung › Daten / Recall: Hinweis-Kasten in Orange (--status-warn), kein Gelb --warning (Spec 4.2, E25)',
  );
  enthaelt(
    text(render(<Bedienung {...bedienung({ status: { ...status, variables: {} } })} />)),
    'Keine Variablen gefunden. Lege im Ordner z. B. eine gaeste.csv mit Kopfzeile',
    'Bedienung › Daten / Recall: ohne Variablen der Hilfetext von heute (Nr. 36)',
  );
  const fehler = render(<Bedienung {...bedienung({ status: { ...status, dataError: 'EACCES: permission denied' } })} />);
  ok(
    text(fehler).includes('DataLink: EACCES: permission denied') &&
      text(fehler).includes('Anna Berg') &&
      text(fehler).includes('⧉ Board') &&
      !text(fehler).includes('Quelle: speakers.tsv'),
    'Bedienung › Daten / Recall: bei Fehler mit noch geltender Liste stehen Fehlerzeile und Liste zugleich (E21)',
  );
  enthaelt(render(<Bedienung {...bedienung()} />), TITLER_TEXTE.keinOrdner, 'Bedienung › Daten / Recall: ohne Datenordner der Hinweis T5');
}

// ── Panel: Stil und Grafik-Vorlagen ziehen mit um ──
{
  const html = render(
    <Einstellungen
      stand={basisStand()}
      aktionen={protokollAktionen([])}
      templates={VORLAGEN}
      activeGraphicId="v1"
      onPickImport={nichts}
      onDropImport={nichts}
      onDeleteTemplate={nichts}
    />,
  );
  ok(
    html.includes('id="einstellung-stil"') &&
      html.includes('id="einstellung-vorlagen"') &&
      text(html).includes('Datei importieren…') &&
      text(html).includes('hierher ziehen'),
    'Panel: Abschnitte „Stil“ und „Grafik-Vorlagen“ mit Anker, Import-Knopf und Ablagefläche',
  );
  gleich(
    tags(html, 'button')
      .filter((t) => attr(t, 'aria-label')?.startsWith('Vorlage „'))
      .map((t) => attr(t, 'aria-label')),
    VORLAGEN.map((v) => TITLER_TEXTE.loeschenAria(v.name)),
    'Panel › Grafik-Vorlagen: je Vorlage ein Knopf „Löschen“ mit aria-label (T7)',
  );
  ok(!html.includes('opacity-0'), 'Panel › Grafik-Vorlagen: „Löschen“ immer sichtbar (kein opacity-0, E13)');
}

// ── Quelltext ──
{
  const op = leseText('src/renderer/src/views/OperatorView.tsx');
  const fehlt = [
    'live={live}',
    'onTake={take}',
    'onClear={clear}',
    'onSchritt={(delta) => void window.jmtitler.stepEntry(delta)}',
    'onSelectTemplate={selectTemplate}',
    'onOpenBoard={() => void window.jmtitler.openRecall()}',
    'onRecall={(key) => void window.jmtitler.recallSchluessel(key)}',
    'onPickImport={() => void pickImport()}',
    'onDropImport={onDropImport}',
    'onDeleteTemplate={(tpl) => void deleteTemplate(tpl)}',
  ].filter((z) => !op.includes(z));
  ok(
    fehlt.length === 0,
    'Quelltext OperatorView: Haupttasten mit Take-Tally aus live (E11), Kacheln, Recall, Board, Import und Löschen unverändert verdrahtet',
  );
  for (const z of fehlt) console.log(`     fehlt: ${z}`);
  const bed = ohneKommentare(leseText('src/renderer/src/views/Bedienung.tsx'));
  ok(
    bed.includes('persistId="titler.graphics"') && bed.includes('persistId="titler.recall"') && !bed.includes('titler.style') && !bed.includes('window'),
    'Quelltext Bedienung: persistId titler.graphics und titler.recall, kein titler.style, kein window',
  );
  const alt = ['views/OperatorView.tsx', 'views/Bedienung.tsx', 'views/LiveBereich.tsx'].filter((d) =>
    /Reiter|rechts starten/.test(leseText(`src/renderer/src/${d}`)),
  );
  ok(alt.length === 0, 'Texte: kein „Reiter“ und kein „rechts starten“ in OperatorView, Bedienung, LiveBereich (Befund 16)');
  for (const d of alt) console.log(`     gefunden in: ${d}`);
}
