// UX Welle 1, Rundown d · Live-Bereich (Spec 3.4, 5.1, Anhang A „Rundown“; E11, R15): die scharfe Zeile immer sichtbar, darunter der
// Transport mit den drei Haupttasten als TallyButtons (Kürzel Leertaste, ↑, ↓), die stehenden Hinweise mit ✕, die Mindestbreite der
// Liste und das Raster der Tasten nach Containerbreite. Render ohne Browser.
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { Hinweise } from '@/components/Hinweise';
import { RundownList } from '@/components/RundownList';
import { Transport } from '@/components/Transport';
import {
  FENSTER_LAYOUT,
  hauptTasten,
  LISTE_LAYOUT,
  RUNDOWN_TEXTE,
  TASTEN_DREI_BREITE,
  TASTEN_MIN_BREITE,
  TASTEN_ZWEI_BREITE,
  tastenAnordnung,
} from '@/lib/oberflaeche';
import type { RundownHinweis } from '@shared/types';
import { attr, basisState, bereich, ohneKommentare, tags, text, zeile, zeileMitAktion } from './testzustand';

const T = RUNDOWN_TEXTE;
const mitZeilen = basisState({ doc: { schemaVersion: 2, name: 'Test', rows: [zeile('a'), zeile('b'), zeile('c')] }, index: 1 });
const nichts = (): void => undefined;
const transport = (state = mitZeilen, log: string[] = []): string => render(<Transport state={state} onNav={(c) => void log.push(c.t)} />);

// ── RD Live Tasten: drei TallyButtons mit Kürzel ──
{
  const html = transport();
  const knoepfe = tags(html, 'button');
  gleich(knoepfe.length, 3, 'RD Live Tasten: genau drei Haupttasten (◀ Zurück, GO, Weiter ▶), höchstens vier');
  gleich(
    [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1])),
    [`${T.zurueck}Kürzel: ${T.kuerzel.zurueck}`, `${T.go}Kürzel: ${T.kuerzel.go}`, `${T.weiter}Kürzel: ${T.kuerzel.weiter}`],
    'RD Live Tasten: Beschriftung und Kürzelanzeige (Leertaste = GO, ↑ = Zurück, ↓ = Weiter) wie die Tastatur-Regie',
  );
  gleich(knoepfe.map((t) => attr(t, 'data-state')), ['bereit', 'bereit', 'bereit'], 'RD Live Tasten: mit Zeile sind alle drei bereit, nie live (der Rundown hat keine On-Air-Quelle)');
  const leer = transport(basisState());
  gleich(tags(leer, 'button').map((t) => attr(t, 'aria-disabled')), [undefined, 'true', undefined], 'RD Live Tasten: ohne Zeile ist nur GO gesperrt (aria-disabled); Zurück und Weiter nie (R15)');
  ok(text(leer).includes(T.grund.keineZeile), 'RD Live Tasten: der Grund „Keine Zeile im Ablauf“ steht sichtbar neben der gesperrten Taste');
  pruefeIdVerweise(leer, 'RD Live Tasten: id-Verweis des Sperrgrunds gültig');
  const t = hauptTasten({ state: mitZeilen });
  gleich([t.zurueck.state, t.go.state, t.weiter.state], ['bereit', 'bereit', 'bereit'], 'RD Live Tasten: hauptTasten und gerenderte Zustände stimmen überein');
}

// ── RD Live Tasten: Klicks gehen an nav (Handler wie heute) ──
{
  const log: string[] = [];
  const roh = Transport({ state: mitZeilen, onNav: (c) => void log.push(c.t) });
  const klicks: Array<() => void> = [];
  const sammle = (n: unknown): void => {
    if (Array.isArray(n)) n.forEach(sammle);
    else if (n && typeof n === 'object' && 'props' in n) {
      const p = (n as { props: { onClick?: () => void; children?: unknown } }).props;
      if (p.onClick) klicks.push(p.onClick);
      sammle(p.children);
    }
  };
  sammle(roh);
  klicks.forEach((k) => k());
  gleich(log, ['prev', 'go', 'next'], 'RD Live Tasten: Klick auf ◀ Zurück, GO und Weiter ▶ ruft nav prev, go, next (Handler wie heute)');
  const q = ohneKommentare(leseText('src/renderer/src/components/Transport.tsx'));
  ok(q.includes('key="zurueck"') && q.includes('key="go"') && q.includes('key="weiter"') && !q.includes('key={taste.label}') && !q.includes('key={t.label}'), 'RD Live Tasten: jede Taste hat einen festen key je Rolle (zurueck, go, weiter), nie die Beschriftung (R10)');
}

// ── RD Live Tasten: Raster nach Containerbreite ──
{
  const q = ohneKommentare(leseText('src/renderer/src/components/Transport.tsx'));
  const arten = new Set(Array.from({ length: 1901 }, (_, i) => tastenAnordnung(100 + i)));
  gleich([...arten].sort(), ['go-oben', 'reihe', 'gestapelt'].sort(), 'RD Live Tasten: je Containerbreite 100–2000 px genau eine von drei Anordnungen: eine Reihe, GO oben mit ◀ ▶ darunter, gestapelt; nie 2+1 ohne GO breit');
  gleich(
    [tastenAnordnung(TASTEN_ZWEI_BREITE - 1), tastenAnordnung(TASTEN_ZWEI_BREITE), tastenAnordnung(TASTEN_DREI_BREITE - 1), tastenAnordnung(TASTEN_DREI_BREITE)],
    ['gestapelt', 'go-oben', 'go-oben', 'reihe'],
    `RD Live Tasten: die Grenzen liegen bei ${TASTEN_ZWEI_BREITE} px (2×140 + Lücke 12) und ${TASTEN_DREI_BREITE} px (3×140 + 2 Lücken)`,
  );
  gleich([TASTEN_ZWEI_BREITE, TASTEN_DREI_BREITE], [2 * TASTEN_MIN_BREITE + 12, 3 * TASTEN_MIN_BREITE + 24], 'RD Live Tasten: Grenzbreiten aus Mindestbreite und Lücke abgeleitet');
  ok(
    q.includes('@container') && q.includes('@[444px]:grid-cols-3') && q.includes('@[292px]:grid-cols-2') && q.includes('@[292px]:col-span-2') && q.includes('@[292px]:order-first') && q.includes('@[444px]:order-none') && q.includes('grid-cols-1') && !/(sm|md|lg|xl):grid-cols/.test(q),
    'RD Live Tasten: Container-Query (@container, @[292px] GO oben, @[444px] eine Reihe) mit grid-cols-1 als Basis, keine Viewport-Breakpoints; die Klassen stehen als Literal im Quelltext (Tailwind-Scan)',
  );
  ok(TASTEN_ZWEI_BREITE === 292 && TASTEN_DREI_BREITE === 444, 'RD Live Tasten: die Literale 292 und 444 im Quelltext gleichen den Konstanten');
  const html = transport();
  ok(html.includes('@container') && html.includes('@[444px]:grid-cols-3') && html.includes('@[292px]:grid-cols-2'), 'RD Live Tasten: gerendert trägt die Hülle @container und das Raster');
  const dom = [...html.matchAll(/<button[^>]*>[\s\S]*?<\/button>/g)].map((m) => text(m[0]).slice(0, 3));
  gleich(dom, ['◀ Z', 'GOK', 'Wei'], 'RD Live Tasten: die Tab-Reihenfolge im Markup bleibt ◀, GO, ▶ (GO oben ist nur Darstellung)');
}

// ── RD Live Breite: die Spalte der Liste bei Mindestfenster ──
{
  const F = FENSTER_LAYOUT;
  const L = LISTE_LAYOUT;
  gleich(L.aussen + L.zeile + L.griff + L.nummer + L.luecken + L.aktionen + L.titelMin, 388, 'RD Live Breite: die festen Teile der Zeile summieren sich auf 388 px');
  ok(L.listeMin >= 388, 'RD Live Breite: listeMin deckt die festen Teile samt Titel-Mindestbreite');
  // Annahme: Windows-Rahmen 16 px (2×8 unsichtbare Ränder); minWidth gilt für das Außenmaß, die Seite bekommt weniger.
  const client = F.fensterMin - F.rahmen;
  const mitPanel = client - F.panel - F.editor - F.trennlinie;
  const ohnePanel = client - F.editor - F.trennlinie;
  gleich([client, mitPanel, ohnePanel], [944, 167, 527], 'RD Live Breite: bei 960 px Fenster (944 px Seite) bleiben der Liste mit Panel 167 px, ohne Panel 527 px');
  ok(mitPanel < L.listeMin && ohnePanel >= L.listeMin, 'RD Live Breite: mit offenem Panel reicht der Platz nicht (die Liste scrollt waagerecht), ohne Panel reicht er');
  // Der Container misst die Inhaltsbox des Transports, also nach dem Innenabstand px-4 (2×16).
  const inhalt = (b: number): number => b - F.transportInnen;
  gleich([inhalt(mitPanel), inhalt(ohnePanel)], [135, 495], 'RD Live Breite: die Inhaltsbox des Transports ist 135 px mit Panel, 495 px ohne');
  gleich([tastenAnordnung(inhalt(mitPanel)), tastenAnordnung(inhalt(ohnePanel))], ['gestapelt', 'reihe'], 'RD Live Breite: bei 960 px stehen die Tasten mit Panel gestapelt (135 px reichen nicht für zwei Spalten), ohne Panel in einer Reihe');
  gleich(tastenAnordnung(inhalt(1180 - F.rahmen - F.panel - F.editor - F.trennlinie)), 'go-oben', 'RD Live Breite: bei 1180 px mit Panel (Inhaltsbox 355 px) steht GO oben, ◀ ▶ darunter');
  const q = ohneKommentare(leseText('src/renderer/src/components/RundownList.tsx'));
  ok(q.includes('overflow-auto') && q.includes(`min-w-[${L.listeMin}px]`), 'RD Live Breite: die Zeilen liegen in einem Scroll-Behälter mit der Mindestbreite der Liste');
  const ober = ohneKommentare(leseText('src/renderer/src/views/RundownOberflaeche.tsx'));
  ok(/min-h-0 flex-1 overflow-hidden">\s*<RundownList/.test(ober), 'RD Live Breite: der Behälter der Liste hat min-h-0 und overflow-hidden, die Liste scrollt selbst und kann nie über den Transport ragen');
  ok(ober.includes('w-[26rem]') && FENSTER_LAYOUT.editor === 26 * 16, 'RD Live Breite: der Editor behält w-[26rem] (416 px), das Fenster-Minimum bleibt 960');
  ok(leseText('src/main/index.ts').includes('minWidth: 960'), 'RD Live Breite: die Fenster-Mindestbreite im Main ist 960 (unverändert)');
  ok(/--panel-w:\s*360px/.test(leseText('../../packages/ui/src/tokens/sizes.css')), 'RD Live Breite: die Panelbreite ist 360 px (unverändert)');
  const t = ohneKommentare(leseText('src/renderer/src/components/Transport.tsx'));
  ok(t.includes('px-4') && F.transportInnen === 32, 'RD Live Breite: der Transport hat px-4 (2×16 = transportInnen)');
}

// ── RD Live Element: die scharfe Zeile ohne Klick sichtbar ──
{
  const liste = render(<RundownList doc={mitZeilen.doc} index={1} selectedId={null} onSelect={nichts} onSetCue={nichts} onDoc={nichts} sicht={{ showGemerkt: false, mitIveo: false, ablaufSchluessel: [], eigeneTimerListe: false }} iveoSpeakers={[]} />);
  const zeilen = [...liste.matchAll(/<div[^>]*draggable="true"[^>]*>/g)].map((m) => m[0]);
  gleich(zeilen.length, 3, 'RD Live Element: alle Zeilen stehen in der Liste');
  const scharf = [...liste.matchAll(/SCHARF/g)].length;
  gleich(scharf, 1, 'RD Live Element: genau eine Zeile trägt die Kennung SCHARF');
  ok(liste.indexOf('SCHARF') > liste.indexOf('Zeile b') && liste.indexOf('SCHARF') < liste.indexOf('Zeile c'), 'RD Live Element: SCHARF steht an der Zeile mit dem Index');
  ok(text(transport()).includes(`${T.transport.scharf}Zeile b`), 'RD Live Element: der Transport nennt die scharfe Zeile ohne Klick');
  ok(text(transport(basisState())).includes(`${T.transport.scharf}${T.transport.keineZeile}`), 'RD Live Element: ohne Zeile steht „—“');
  const q = ohneKommentare(leseText('src/renderer/src/components/RundownList.tsx'));
  ok(q.includes('draggable={!sperre.verschieben}') && q.includes('onDragStart=') && q.includes('onDrop='), 'RD Live Element: Drag und Drop der Zeilen bleibt nativ');
  const mitAktion = render(<RundownList doc={{ schemaVersion: 2, name: 'T', rows: [zeileMitAktion('a')] }} index={0} selectedId="a" onSelect={nichts} onSetCue={nichts} onDoc={nichts} sicht={{ showGemerkt: false, mitIveo: false, ablaufSchluessel: [], eigeneTimerListe: false }} iveoSpeakers={[]} />);
  const titel = tags(mitAktion, 'button').map((t) => attr(t, 'title'));
  gleich(titel, ['scharf setzen', 'nach oben', 'nach unten', 'Zeile duplizieren', 'Zeile löschen', undefined], 'RD Live Element: die Symbolknöpfe der Zeile behalten ihre Tooltips, dazu „+ Zeile hinzufügen“');
  ok(text(mitAktion).includes('+ Zeile hinzufügen'), 'RD Live Element: „+ Zeile hinzufügen“ bleibt am Ende der Liste');
}

// ── RD Hinweise im Live-Bereich ──
{
  const hinweise: RundownHinweis[] = [
    { id: 1, text: 'Kurz sichtbar', art: 'kurz' },
    { id: 2, text: 'Bleibt stehen', art: 'stehend' },
  ];
  const log: number[] = [];
  const html = render(<Hinweise hinweise={hinweise} onWeg={(id) => void log.push(id)} />);
  ok(text(html).includes('Kurz sichtbar') && text(html).includes('Bleibt stehen'), 'RD Hinweise im Live-Bereich: kurze und stehende Hinweise stehen als Block da');
  const weg = tags(html, 'button');
  gleich(weg.length, 1, 'RD Hinweise im Live-Bereich: nur der stehende Hinweis trägt ein ✕ (die kurzen entfernt der Main nach 6 s)');
  gleich(attr(weg[0], 'title'), T.hinweise.schliessen, 'RD Hinweise im Live-Bereich: das ✕ trägt den Tooltip „Hinweis schließen“');
  ok(text(html).includes('✕'), 'RD Hinweise im Live-Bereich: das ✕ ist sichtbar');
  const roh = Hinweise({ hinweise, onWeg: (id) => void log.push(id) });
  const klicks: Array<() => void> = [];
  const sammle = (n: unknown): void => {
    if (Array.isArray(n)) n.forEach(sammle);
    else if (n && typeof n === 'object' && 'props' in n) {
      const p = (n as { props: { onClick?: () => void; children?: unknown } }).props;
      if (p.onClick) klicks.push(p.onClick);
      sammle(p.children);
    }
  };
  sammle(roh);
  klicks.forEach((k) => k());
  gleich(log, [2], 'RD Hinweise im Live-Bereich: das ✕ ruft hinweisWeg mit der Id des stehenden Hinweises');
  gleich(render(<Hinweise hinweise={[]} onWeg={nichts} />), '', 'RD Hinweise im Live-Bereich: ohne Hinweise steht nichts da');
  // Im Gesamtbild: der Block steht in der linken Spalte über der Liste, nicht im Kopf und nicht im Panel.
  const q = ohneKommentare(leseText('src/renderer/src/views/RundownOberflaeche.tsx'));
  ok(q.indexOf('<Hinweise') > q.indexOf('data-rundown="spalte-liste"') && q.indexOf('<Hinweise') < q.indexOf('<RundownList'), 'RD Hinweise im Live-Bereich: der Block steht in der linken Spalte über der Liste');
  void bereich;
}

// ── Texte und Quelltext-Wächter ──
{
  const dateien = ['views/RundownOberflaeche.tsx', 'views/Einstellungen.tsx', 'views/KopfMitte.tsx', 'views/Werkzeugleiste.tsx', 'components/Transport.tsx', 'components/Hinweise.tsx', 'components/RundownList.tsx', 'components/RowEditor.tsx', 'App.tsx'];
  const roh = /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|shadow)-(?:white|black|neutral|gray|grey|zinc|slate|stone|red|green|blue|yellow|amber|orange|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?\b/;
  gleich(dateien.filter((d) => roh.test(ohneKommentare(leseText(`src/renderer/src/${d}`)))), [], 'RD Live Tasten: keine rohen Farbklassen in den geänderten Dateien, nur Tokens');
  const ketten = dateien.filter((d) => /\b(?:hdrBtn|iconBtn)\b/.test(ohneKommentare(leseText(`src/renderer/src/${d}`))));
  gleich(ketten, [], 'RD Live Tasten: die lokalen Knopf-Klassenketten hdrBtn und iconBtn sind weg (Button aus @jm/ui)');
  const rest = ['components/RowEditor.tsx', 'components/RundownList.tsx', 'views/Werkzeugleiste.tsx'].filter((d) => /<button\b/.test(ohneKommentare(leseText(`src/renderer/src/${d}`))));
  gleich(rest, [], 'RD Live Tasten: kein rohes <button> mehr in Liste, Editor und Werkzeugleiste (Button aus @jm/ui)');
  const html = [transport(), render(<Hinweise hinweise={[{ id: 1, text: 'x', art: 'stehend' }]} onWeg={nichts} />)].join('');
  ok(!text(html).includes('"'), 'RD Live Tasten: kein ASCII-Anführungszeichen in den gerenderten Texten');
  const ober = ohneKommentare(leseText('src/renderer/src/views/RundownOberflaeche.tsx'));
  const einst = ohneKommentare(leseText('src/renderer/src/views/Einstellungen.tsx'));
  const app = ohneKommentare(leseText('src/renderer/src/App.tsx'));
  ok(
    ober.includes('useBrueckenWert(MASTER_LINK_QUELLE)') && ober.includes('useBrueckenWert(FERNSTEUERUNG_QUELLE)') && ober.includes('useBrueckenWert(VERBUND_QUELLE)') && ober.includes('status={statusLeiste(stand)}') && ober.includes('settingsOpen={panelOffen}'),
    'RD Live Tasten: Brücken, Statusleiste und Panelzustand laufen in der View, auch bei geschlossenem Panel (G8)',
  );
  ok(ober.includes('useState(anfangOffen)') && !ober.includes('localStorage'), 'RD Live Tasten: der Panelzustand ist ein lokaler useState (zu beim Start, nichts gemerkt)');
  ok(!einst.includes('useEffect') && !/\bwindow\b/.test(einst), 'RD Live Tasten: views/Einstellungen.tsx ohne window und ohne useEffect (G7, G8)');
  ok(app.includes('void load()') && app.includes('istEingabeZiel(e.target)') && app.includes("nav({ t: 'go' })") && app.includes('importRegieplan') && app.includes('window.confirm('), 'RD Live Tasten: Laden, Tastatur-Regie, Regieplan-Import samt Rückfrage laufen weiter in App.tsx (immer gemountet)');
}
