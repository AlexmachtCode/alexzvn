// UX Welle 2a, Caption d · Live-Bereich (Spec 3.4, 5.1; E4, E7, E9; Funktionsliste Nr. 9–12, 24–36): oben die vier Haupttasten
// als TallyButtons in grid gap-3 (oben NDI, Start/Stopp; unten Hold, Leeren; Ruling Fix-Runde 1), darunter der
// Mikrofonfehler-Text (E9), die Hinweise (whisper fehlt, Fehler des Main), dann die große Live-Zeile mit der NDI-Vorschau,
// die Pegelzeile und der Verlauf mit der Korrektur der jüngsten Zeile (wie heute, samt bekannter Eigenheiten). Jede Taste
// und jedes Feld ruft dieselbe Store-Aktion wie bisher (Attrappen, Klick über die Verdrahtung des TallyButton). Render ohne
// Browser und ohne window.
import { TallyButton, type TallyButtonProps } from '@jm/ui';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { liveAktionen, type LiveAktionen } from '@/lib/aktionen';
import { CAPTION_TEXTE, hauptTasten, type OberflaechenStand } from '@/lib/oberflaeche';
import { CaptionOberflaeche } from '@/views/CaptionOberflaeche';
import { LiveBereich, liveTasten, pegelProzent } from '@/views/LiveBereich';
import { tallyHandler } from '../../../../packages/ui/src/components/TallyButton';
import { erzeugeHalten } from '../../../../packages/ui/src/lib/halten';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { attr, caption, element, elemente, GERAETE, mitStore, ohneKommentare, quellen, store, tags, text, warte, ZEILEN } from './testzustand';

const T = CAPTION_TEXTE;
const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
const inhalt = (html: string): string => element(html, 'main', '');
const MIKRO_FEHLER = 'Requested device not found';
const BOOL = [false, true] as const;

function stand(z: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return { caption: caption(), geraete: GERAETE, micError: null, pegel: 0, masterLink: undefined, fernsteuerung: undefined, ...z };
}
/** Aktionen wie in der View: aus den Store-Attrappen (lib/aktionen.ts), jeder Aufruf landet im Protokoll. */
function aktionen(log: string[] = [], name: string | undefined = 'JM Caption'): LiveAktionen {
  return liveAktionen(store(log), name, (id) => void log.push(`bearbeiten:${id}`));
}
const REF = { current: null };
const live = (s: OberflaechenStand, editing: string | null = null, log: string[] = []): string =>
  render(<LiveBereich stand={s} previewRef={REF} editing={editing} aktionen={aktionen(log)} />);
const baum = (s: OberflaechenStand, editing: string | null = null, log: string[] = []) => elemente(LiveBereich({ stand: s, previewRef: REF, editing, aktionen: aktionen(log) }));
/** Klick wie im Fenster: über die Ereignis-Verdrahtung des TallyButton (eine gesperrte Taste klickt nicht). */
const klick = (p: TallyButtonProps): void => tallyHandler(p, erzeugeHalten({})).onClick();

interface Knopf {
  label: string | undefined;
  state: string | undefined;
  gesperrt: string | undefined;
  grund: string | undefined;
}
/** Die gerenderten TallyButtons (Knöpfe mit data-state) in Reihenfolge. */
function knoepfe(html: string): Knopf[] {
  return [...html.matchAll(/(<button[^>]*\sdata-state="[^"]*"[^>]*>)([\s\S]*?)<\/button>/g)].map((m) => ({
    label: m[2].match(/<span>([^<]*)<\/span>/)?.[1],
    state: attr(m[1], 'data-state'),
    gesperrt: attr(m[1], 'aria-disabled'),
    grund: m[2].match(/<span id="[^"]*"[^>]*>([^<]*)<\/span>/)?.[1],
  }));
}
const erwartet = (t: { label: string; state: string; disabledReason?: string }): Knopf => ({
  label: t.label,
  state: t.state,
  gesperrt: t.state === 'gesperrt' ? 'true' : undefined,
  grund: t.state === 'gesperrt' ? t.disabledReason : undefined,
});

// ── CA Live: Tasten, Mikrofonfehler, Live-Zeile, Vorschau, Pegel und Verlauf ohne Klick im Inhalt, in dieser Reihenfolge ──
{
  const html = mitStore({ state: caption({ lines: ZEILEN, whisperAvailable: false, error: 'whisper-Start fehlgeschlagen.' }) }, () => render(<CaptionOberflaeche />));
  const m = inhalt(html);
  const reihe = ['data-caption="live"', 'data-caption="tasten"', 'data-caption="hinweis-whisper"', 'data-caption="hinweis-fehler"', 'data-caption="live-zeile"', 'data-caption="vorschau"', '<canvas', 'data-caption="pegel"', 'data-caption="verlauf"'];
  const pos = reihe.map((s) => m.indexOf(s));
  ok(pos.every((p, i) => p >= 0 && (i === 0 || p > pos[i - 1])), `CA Live: im Inhalt ohne Klick Tasten, Hinweise, Live-Zeile, Vorschau mit Canvas, Pegel und Verlauf (${pos.join(', ')})`);
  gleich(tags(m, 'button').filter((t) => attr(t, 'data-state') !== undefined).length, 4, 'CA Live: genau vier TallyButtons (NDI, Start/Stopp, Hold, Leeren)');
  const tasten = (attr(tags(m, 'div').find((t) => attr(t, 'data-caption') === 'tasten'), 'class') ?? '').split(/\s+/);
  ok(['grid', 'grid-cols-2', 'gap-3', 'max-w-[30rem]'].every((k) => tasten.includes(k)), 'CA Live: die Haupttasten stehen in grid gap-3, zwei Spalten, feste Breite (gleiche Lage bei jeder Fenstergröße und offenem Panel)');
  // Fix-Runde 1 (Important 2): Die Verengung unter 900 px gilt nur bei offenem Panel (dort liegt es über dem Inhalt). Per CSS in
  // globals.css über :has(> aside), ohne Panelzustand in der View; bei geschlossenem Panel steht die Vorschau neben der Live-Zeile.
  const wurzel = (attr(tags(m, 'section').find((t) => attr(t, 'data-caption') === 'live'), 'class') ?? '').split(/\s+/);
  ok(wurzel.length > 0 && !wurzel.some((k) => k.startsWith('max-[900px]')), 'CA Live: keine Verengung per Klasse am Live-Bereich (sie gälte auch bei geschlossenem Panel)');
  // Fix-Runde 1, gemessen (t26-messung-fr1.json): bei 900×600, Panel zu, mit Mikrofonfehler, beiden Hinweisen und einer langen
  // Zeile (Zustand B) lag der Pegel mit gap-3 und Hinweisen py-1.5 16 px unter dem Falz. Kompakter: gap-2, Hinweise py-1.
  const mitHinweisen = live(stand({ caption: caption({ whisperAvailable: false, error: 'x' }), micError: 'y' }));
  const hinweisKlassen = ['mikrofonfehler', 'hinweis-whisper', 'hinweis-fehler'].map((id) => (attr(tags(mitHinweisen, 'p').find((x) => attr(x, 'data-caption') === id), 'class') ?? '').split(/\s+/));
  ok(wurzel.includes('gap-2') && !wurzel.includes('gap-3') && hinweisKlassen.every((k) => k.includes('py-1') && !k.includes('py-1.5')), 'CA Live: kompakte Abstände im Live-Bereich (gap-2, Hinweise py-1), damit Vorschau und Pegel bei 900×600 auch mit allen Hinweisen über dem Falz stehen (gemessen)');
  const css = ohneKommentare(leseText('src/renderer/src/globals.css')).replace(/\s+/g, ' ');
  ok(
    /@media \(width < 900px\) \{ \[data-bereich='inhalt'\]:has\(> aside\) \[data-caption='live'\] \{ max-width: calc\(100vw - var\(--panel-w\) - 2\.5rem\); \} \}/.test(css),
    'CA Live: unter 900 px (wie das Panel, das dort über dem Inhalt liegt) bleibt der Live-Bereich nur bei offenem Panel links daneben (globals.css, :has(> aside))',
  );
  // Der Selektor passt zum echten DOM des AppShell: <aside> ist direktes Kind von [data-bereich=inhalt], nur bei offenem Panel.
  const offenHtml = mitStore({ state: caption() }, () => render(<CaptionOberflaeche anfangOffen />));
  const zuHtml = mitStore({ state: caption() }, () => render(<CaptionOberflaeche />));
  /** Tags erster Ebene unter [data-bereich=inhalt]. */
  const kinder = (h: string): string[] => {
    const b = h.slice(h.indexOf('data-bereich="inhalt"'));
    const aus: string[] = [];
    let tiefe = 0;
    for (const x of b.slice(b.indexOf('>') + 1).matchAll(/<(\/?)([a-z0-9]+)[^>]*?(\/?)>/g)) {
      if (x[1] === '/') {
        tiefe--;
        if (tiefe < 0) break;
        continue;
      }
      if (tiefe === 0) aus.push(x[2]);
      if (x[3] !== '/' && !['input', 'img', 'br', 'hr', 'meta', 'link', 'source', 'path'].includes(x[2])) tiefe++;
    }
    return aus;
  };
  gleich([kinder(zuHtml), kinder(offenHtml)], [['main'], ['main', 'aside']], 'CA Live: [data-bereich=inhalt] hat bei offenem Panel ein <aside> als direktes Kind, bei geschlossenem nicht (der :has-Selektor greift genau dann)');
  const zeile = (attr(tags(m, 'div').find((t) => attr(t, 'data-caption') === 'zeile-vorschau'), 'class') ?? '').split(/\s+/);
  ok(zeile.includes('flex-wrap'), 'CA Live: Live-Zeile und Vorschau stehen nebeneinander und brechen bei schmalem Inhalt untereinander um');
  pruefeIdVerweise(html, 'CA Live: id-Verweise gültig');
  ok(!text(m).includes('"'), 'CA Live: kein ASCII-Anführungszeichen im Text des Live-Bereichs');
}

// ── CA Live Tasten: gerendert genau hauptTasten in der Reihenfolge von heute, Gründe sichtbar ──
{
  const faelle = kreuz({ antwort: BOOL, running: BOOL, hold: BOOL, ndiActive: BOOL, ndiSendet: BOOL, micError: [null, MIKRO_FEHLER] } as const);
  pruefeFaelle('CA Live Tasten: vier TallyButtons NDI, Start/Stopp, Hold, Leeren mit Zustand, Sperre und Grund aus hauptTasten', faelle, (f) => {
    const s = stand({ caption: f.antwort ? caption({ running: f.running, hold: f.hold, status: { ndiActive: f.ndiActive, ndiSendet: f.ndiSendet } }) : undefined, micError: f.micError });
    const t = hauptTasten(s);
    return vergleiche(JSON.stringify(knoepfe(live(s))), JSON.stringify([t.ndi, t.start, t.hold, t.leeren].map(erwartet)));
  });
  gleich(
    knoepfe(live(stand({ caption: undefined }))).map((k) => [k.state, k.gesperrt, k.grund]),
    [0, 1, 2, 3].map(() => ['gesperrt', 'true', T.grund.zustandOffen]),
    'CA Live Tasten: vor der ersten Antwort alle vier gesperrt mit sichtbarem Grund „Lädt …“ (heute stand dort nur „Lädt …“)',
  );
}

// ── CA Tastenfolge: NDI auf seinem alten Platz oben links, keine Taste auf dem alten Platz einer anderen (Ruling Fix-Runde 1) ──
{
  // Heute (App.tsx bei d7cdd79ce0, bei 1100×780 aus den Klassen abgeleitet): „● Start“/„■ Stopp“, „Hold“ und „Leeren“ oben rechts
  // im einzeiligen Kopf (dort stehen jetzt ON AIR, Hell/Dunkel und ⚙), „○ NDI starten“/„◉ NDI an“ links in der NDI-Leiste darunter,
  // etwa x 16–139, y 59–93. Neu (Ruling Fix-Runde 1): oben links NDI (sein alter absoluter Platz), rechts daneben Start/Stopp;
  // darunter Hold links, Leeren rechts. Auf dem alten NDI-Platz liegt nie Start/Stopp (die Hand nach NDI beendete sonst die
  // Transkription) und nie Leeren. Gemessen in t26-messung.mjs (Schnitt mit dem alten NDI-Platz bei 1100×780).
  const tastenKlasse = (attr(tags(live(stand()), 'div').find((x) => attr(x, 'data-caption') === 'tasten'), 'class') ?? '').split(/\s+/);
  ok(tastenKlasse.includes('grid-cols-2') && !tastenKlasse.some((k) => /grid-cols-[13-9]/.test(k)), 'CA Tastenfolge: zwei Spalten in jeder Fenstergröße (kein Wechsel der Plätze)');
  /** Platz im Raster aus der Reihenfolge im DOM: [Reihe, Spalte], Reihe 0 oben. */
  const platz = (labels: Array<string | undefined>, label: string): [number, number] => {
    const i = labels.indexOf(label);
    return [Math.floor(i / 2), i % 2];
  };
  const labels = knoepfe(live(stand())).map((k) => k.label);
  gleich(labels, [T.taste.ndiStarten, T.taste.start, T.taste.hold, T.taste.leeren], 'CA Tastenfolge: im Raster NDI, Start/Stopp, Hold, Leeren (oben NDI und Start, unten Hold und Leeren)');
  gleich(
    [platz(labels, T.taste.ndiStarten), platz(labels, T.taste.start), platz(labels, T.taste.hold), platz(labels, T.taste.leeren)],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    'CA Tastenfolge: NDI oben links (sein alter Platz), Start/Stopp oben rechts, Hold unten links, Leeren unten rechts',
  );
  ok(labels[0] === T.taste.ndiStarten, 'CA Tastenfolge: auf dem alten NDI-Platz (oben links) liegt NDI, nie Start/Stopp und nie Leeren');
  gleich(
    knoepfe(live(stand({ caption: caption({ running: true, hold: true, status: { ndiActive: true, ndiSendet: true } }) }))).map((k) => [k.label, k.state]),
    [[T.taste.ndiAn, 'live'], [T.taste.stopp, 'live'], [T.taste.holdAn, 'bereit'], [T.taste.leeren, 'bereit']],
    'CA Tastenfolge: bei Lauf, Hold und sendendem NDI bleibt jede Taste an ihrem Platz, nur die Beschriftung wechselt (NDI an live, Stopp live, Hold ✓ bereit)',
  );
}

// ── CA Live Verdrahtung: jede Taste ruft dieselbe Store-Aktion wie der alte Knopf ──
{
  // Orakel aus dem alten Code (App.tsx:185-218 bei d7cdd79ce0): Start/Stopp → running ? stop() : start(); Hold → setHold(!hold);
  // Leeren → clear(); NDI → ndiActive ? ndiStop() : ndiStart(c.ndiName). Vor der ersten Antwort gab es keine Tasten.
  const faelle = kreuz({ antwort: BOOL, running: BOOL, hold: BOOL, ndiActive: BOOL, micError: [null, MIKRO_FEHLER] } as const);
  pruefeFaelle('CA Live Verdrahtung: Klick über tallyHandler auf alle vier Tasten ruft start/stop, setHold(!hold), clear, ndiStart(Name)/ndiStop wie bisher; vor der Antwort nichts', faelle, (f) => {
    const log: string[] = [];
    const s = stand({ caption: f.antwort ? caption({ running: f.running, hold: f.hold, status: { ndiActive: f.ndiActive } }) : undefined, micError: f.micError });
    for (const k of liveTasten(s, aktionen(log))) klick(k);
    const soll = f.antwort ? [f.ndiActive ? 'ndiStop' : 'ndiStart:JM Caption', f.running ? 'stop' : 'start', `setHold:${!f.hold}`, 'clear'] : [];
    return vergleiche(log.join(','), soll.join(','));
  });
  pruefeFaelle('CA Live Verdrahtung: liveTasten ist genau hauptTasten plus Klick (keine zweite Rechnung)', kreuz({ antwort: BOOL, running: BOOL, ndiSendet: BOOL } as const), (f) => {
    const s = stand({ caption: f.antwort ? caption({ running: f.running, status: { ndiActive: f.ndiSendet, ndiSendet: f.ndiSendet } }) : undefined });
    const t = hauptTasten(s);
    return vergleiche(JSON.stringify(liveTasten(s, aktionen()).map(({ onClick, ...r }) => [r, typeof onClick])), JSON.stringify([t.ndi, t.start, t.hold, t.leeren].map((x) => [x, 'function'])));
  });
  // Die Tasten im gerenderten Baum sind genau liveTasten (keine toten Knöpfe).
  const log: string[] = [];
  const tallys = baum(stand({ caption: caption({ hold: true, status: { ndiActive: true } }) }), null, log).filter((e) => e.type === TallyButton);
  for (const t of tallys) klick(t.props as unknown as TallyButtonProps);
  gleich(log, ['ndiStop', 'start', 'setHold:false', 'clear'], 'CA Live Verdrahtung: die TallyButtons im gerenderten Live-Bereich klicken ndiStop, start, setHold(false) und clear');
  const log2: string[] = [];
  for (const k of liveTasten(stand({ caption: caption({ config: { ndiName: 'Saal 2' } }) }), liveAktionen(store(log2), 'Saal 2', () => {}))) klick(k);
  gleich(log2[0], 'ndiStart:Saal 2', 'CA Live Verdrahtung: NDI starten nimmt den Quellnamen der Konfiguration (ndiStart(c.ndiName))');
  const ober = QUELLE('views/CaptionOberflaeche.tsx');
  ok(
    ober.includes('const { state, level, load, setLevel, setConfig, start, stop, setHold, clear, correctLine, ndiStart, ndiStop } =') &&
      ober.includes('const store: CaptionStore = { setConfig, start, stop, setHold, clear, correctLine, ndiStart, ndiStop };') &&
      ober.includes('liveAktionen(store, cfg?.ndiName, setEditing)'),
    'CA Live Verdrahtung: die View reicht genau die Store-Aktionen aus useCaption an liveAktionen (Name der NDI-Quelle aus der Konfiguration; Altfehler CA-5: correctLine statt correctLast, G8)',
  );
}

// ── CA Live Mikrofonfehler: Text unter den Haupttasten (E9), bleibt bis zum nächsten erfolgreichen Start ──
{
  const mit = live(stand({ caption: caption({ running: true }), micError: MIKRO_FEHLER }));
  const band = element(mit, 'p', 'data-caption="mikrofonfehler"');
  ok(text(band) === T.live.mikrofonFehler(MIKRO_FEHLER) && T.live.mikrofonFehler('x') === 'Mikrofon: x' && band.includes('role="alert"'), 'CA Live Mikrofonfehler: „Mikrofon: ‹Meldung›“ wie das alte Band, als Hinweis (role alert)');
  const pos = (h: string, s: string): number => h.indexOf(s);
  /** Die Taste Start/Stopp (oben rechts, zweite im Raster). */
  const startTaste = (h: string): Knopf | undefined => knoepfe(h)[1];
  ok(pos(mit, 'data-caption="tasten"') < pos(mit, 'data-caption="mikrofonfehler"') && pos(mit, 'data-caption="mikrofonfehler"') < pos(mit, 'data-caption="live-zeile"'), 'CA Live Mikrofonfehler: direkt unter den Haupttasten, vor der Live-Zeile (E9)');
  // Ruling Task 25/26: micError bleibt wie heute stehen, auch nach dem Stopp; die Start-Taste bleibt bedienbar und ist nie live.
  const gestoppt = live(stand({ caption: caption({ running: false }), micError: MIKRO_FEHLER }));
  ok(gestoppt.includes('data-caption="mikrofonfehler"') && startTaste(gestoppt)?.label === T.taste.start && startTaste(gestoppt)?.state === 'bereit', 'CA Live Mikrofonfehler: der Text bleibt nach dem Stopp stehen (wie heute), Start bleibt bedienbar');
  ok(startTaste(mit)?.label === T.taste.stopp && startTaste(mit)?.state === 'bereit', 'CA Live Mikrofonfehler: bei Lauf mit Mikrofonfehler „Stopp“ bedienbar, nicht live (E4, E9)');
  ok(!live(stand()).includes('data-caption="mikrofonfehler"'), 'CA Live Mikrofonfehler: ohne Fehler kein Text');
  const klasse = attr(tags(mit, 'p').find((t) => attr(t, 'data-caption') === 'mikrofonfehler'), 'class') ?? '';
  ok(klasse.includes('var(--status-error)') && klasse.includes('max-w-[30rem]'), 'CA Live Mikrofonfehler: Rand und Fläche aus --status-error, so breit wie die Tasten');
}

// ── CA Live Hinweise: whisper fehlt, Fehler des Main ──
{
  const beide = live(stand({ caption: caption({ whisperAvailable: false, error: 'Modell ggml-small.bin nicht gefunden.' }) }));
  ok(text(element(beide, 'p', 'data-caption="hinweis-whisper"')) === T.whisper.fehltHinweis, 'CA Live Hinweise: „whisper.cpp ist hier nicht gebündelt — …“ bei fehlender Binary, Wortlaut wie bisher');
  ok(text(element(beide, 'p', 'data-caption="hinweis-fehler"')) === 'Modell ggml-small.bin nicht gefunden.', 'CA Live Hinweise: der Fehlertext des Main ohne Vorsatz, wie bisher');
  const ohne = live(stand());
  ok(!ohne.includes('hinweis-whisper') && !ohne.includes('hinweis-fehler'), 'CA Live Hinweise: ohne Anlass keine Hinweise');
  const k = (id: string): string => attr(tags(beide, 'p').find((t) => attr(t, 'data-caption') === id), 'class') ?? '';
  ok(k('hinweis-whisper').includes('var(--status-warn)') && k('hinweis-fehler').includes('var(--status-error)'), 'CA Live Hinweise: whisper fehlt als Warnung (--status-warn), Fehler als Fehler (--status-error)');
}

// ── CA Live-Zeile und Vorschau ──
{
  const zeile = (h: string): string => text(element(h, 'div', 'data-caption="live-text"'));
  gleich(
    [zeile(live(stand({ caption: undefined }))), zeile(live(stand())), zeile(live(stand({ caption: caption({ lines: ZEILEN }) })))],
    [T.grund.zustandOffen, T.live.bereit, ZEILEN[2].text],
    'CA Live-Zeile: vor der Antwort „Lädt …“, ohne Zeilen „— bereit —“, sonst der Text der jüngsten Zeile',
  );
  ok(zeile(live(stand({ caption: caption({ lines: ZEILEN, hold: true }) }))) === ZEILEN[2].text, 'CA Live-Zeile: folgt Hold nicht (wie heute: nur Vorschau und NDI stehen)');
  const vorschau = (h: string): string => element(h, 'div', 'data-caption="vorschau"');
  const mitHold = live(stand({ caption: caption({ hold: true }) }));
  ok(text(vorschau(mitHold)).includes(T.live.vorschau) && text(vorschau(mitHold)).includes(T.live.eingefroren) && !text(vorschau(live(stand()))).includes(T.live.eingefroren), 'CA Live Vorschau: „NDI-Vorschau“, bei Hold „eingefroren“');
  ok(live(stand()).includes('class="ca-schachbrett'), 'CA Live Vorschau: Schachbrett hinter dem Canvas zeigt die Transparenz der Quelle (Klasse aus globals.css, Tokens)');
  // Fix-Runde 1 (Minor 1, hochgestuft): Das Schachbrett bleibt in beiden Modi dunkel wie heute (#2a2a2a/#1c1c1c), damit weiße
  // Untertitel ohne Band in der Vorschau lesbar bleiben. Es nutzt nur Tokens, die kein .light-Block umdefiniert.
  const tokenCss = ['colors.css', 'signal-colors.css'].map((d) => leseText(`../../packages/ui/src/tokens/${d}`)).join('\n');
  const hellBloecke = [...tokenCss.matchAll(/\.light\s*\{([^}]*)\}/g)].map((x) => x[1]).join('\n');
  const wechselnd = new Set([...hellBloecke.matchAll(/(--[\w-]+)\s*:/g)].map((x) => x[1]));
  const regel = ohneKommentare(leseText('src/renderer/src/globals.css')).match(/\.ca-schachbrett\s*\{([^}]*)\}/)?.[1] ?? '';
  const genutzt = [...regel.matchAll(/var\((--[\w-]+)\)/g)].map((x) => x[1]);
  ok(wechselnd.has('--muted') && wechselnd.has('--card') && wechselnd.size > 10, 'CA Live Vorschau: Gegenprobe (--muted und --card wechseln in Hell)');
  ok(
    genutzt.length >= 2 && genutzt.every((v) => !wechselnd.has(v) && new RegExp(`${v}\\s*:`).test(tokenCss)),
    `CA Live Vorschau: das Schachbrett nutzt nur Tokens, die in Hell nicht wechseln (${[...new Set(genutzt)].join(', ')}), bleibt also dunkel wie heute`,
  );
  // Das Canvas steht in jedem Zustand genau einmal da (auch Mikrofonfehler, Korrektur, Pegel, ohne Geräte).
  const faelle = kreuz({ antwort: BOOL, zeilen: BOOL, hold: BOOL, mic: [null, MIKRO_FEHLER], edit: BOOL, pegel: [0, 0.2] } as const);
  pruefeFaelle('CA Live Vorschau: das Canvas steht in jedem Zustand genau einmal im Live-Bereich', faelle, (f) => {
    const s = stand({ caption: f.antwort ? caption({ lines: f.zeilen ? ZEILEN : [], hold: f.hold }) : undefined, micError: f.mic, pegel: f.pegel });
    return vergleiche(String((live(s, f.edit ? 'l3' : null).match(/<canvas width="320" height="180"/g) ?? []).length), '1');
  });
}

// ── CA Live Pegel: Breite wie bisher, Farbe aus Tokens, „transkribiert …“, Zeilenzahl ──
{
  gleich([0, 0.03, 0.075, 0.12, 0.15, 0.5].map(pegelProzent), [0, 20, 50, 80, 100, 100], 'CA Live Pegel: Breite = min(100, round(Pegel / 0,15 · 100)) Prozent wie bisher');
  const balken = (h: string): string | undefined => tags(element(h, 'div', 'data-caption="pegel"'), 'div').find((t) => (attr(t, 'style') ?? '').includes('width'));
  const leise = live(stand({ pegel: 0.075 }));
  const laut = live(stand({ pegel: 0.13 }));
  ok((attr(balken(leise), 'style') ?? '').includes('width:50%') && (attr(balken(leise), 'style') ?? '').includes('var(--tally-ready)'), 'CA Live Pegel: 50 % in --tally-ready');
  ok((attr(balken(laut), 'style') ?? '').includes('width:87%') && (attr(balken(laut), 'style') ?? '').includes('var(--status-error)'), 'CA Live Pegel: über 80 % in --status-error (heute rot)');
  ok(text(element(leise, 'div', 'data-caption="pegel"')).includes(T.live.pegel), 'CA Live Pegel: Beschriftung „Pegel“');
  ok(text(live(stand({ caption: caption({ busy: true }) }))).includes(T.whisper.arbeitet) && !text(live(stand())).includes(T.whisper.arbeitet), 'CA Live Pegel: „transkribiert …“ nur bei busy');
  ok(text(live(stand({ caption: caption({ lines: ZEILEN }) }))).includes(T.live.zeilen(3)) && T.live.zeilen(3) === '3 Zeilen' && !text(live(stand({ caption: undefined }))).includes(T.live.zeilen(0)), 'CA Live Pegel: „3 Zeilen“ wie bisher; vor der Antwort keine Zahl');
}

// ── CA Live Verlauf und Korrektur (Nr. 32–35, 73, 74; Eigenheiten wie heute, Befund 5) ──
{
  // Vom Verlauf bis zum Ende des Live-Bereichs (der Verlauf ist sein letztes Element; Zeilen sind verschachtelte div).
  const verlauf = (h: string): string => h.slice(h.indexOf('data-caption="verlauf"'), h.lastIndexOf('</section>'));
  const v = verlauf(live(stand({ caption: caption({ lines: ZEILEN }) })));
  const zeilen = [...v.matchAll(/<div[^>]*>([^<]*)<\/div>/g)].map((m) => [m[1], attr(m[0].slice(0, m[0].indexOf('>') + 1), 'title')]);
  gleich(
    zeilen,
    [[ZEILEN[2].text, T.live.korrigieren], [ZEILEN[1].text, undefined], [ZEILEN[0].text, undefined]],
    'CA Live Verlauf: jüngste Zeile oben; nur sie trägt den Tooltip „Doppelklick: letzte Zeile korrigieren“',
  );
  const vKlasse = (attr(tags(live(stand()), 'div').find((t) => attr(t, 'data-caption') === 'verlauf'), 'class') ?? '').split(/\s+/);
  ok(vKlasse.includes('max-h-44') && vKlasse.includes('overflow-y-auto'), 'CA Live Verlauf: Rollfläche bis 11 rem hoch wie bisher');
  ok(text(verlauf(live(stand()))).includes(T.live.keineZeilen) && !text(verlauf(live(stand({ caption: caption({ lines: ZEILEN }) })))).includes(T.live.keineZeilen), 'CA Live Verlauf: „Noch keine Untertitel.“ bei leerem Verlauf');
  // Doppelklick: nur die jüngste Zeile startet die Korrektur.
  const log: string[] = [];
  const els = baum(stand({ caption: caption({ lines: ZEILEN }) }), null, log).filter((e) => typeof e.props.onDoubleClick === 'function');
  for (const e of els) (e.props.onDoubleClick as () => void)();
  gleich(log, ['bearbeiten:l3'], 'CA Live Korrektur: Doppelklick auf die jüngste Zeile startet die Korrektur, ältere Zeilen reagieren nicht');
  // Im Korrekturmodus: Feld mit altem Text, Fokus sofort. Das Feld hängt an der angeklickten Zeile: l2, inzwischen kam l3.
  const html = live(stand({ caption: caption({ lines: ZEILEN }) }), 'l2');
  const feld = tags(verlauf(html), 'input')[0];
  ok(
    attr(feld, 'value') === ZEILEN[1].text && !text(verlauf(html)).includes(ZEILEN[1].text) && text(verlauf(html)).includes(ZEILEN[2].text),
    'CA Live Korrektur: kommt während der Eingabe eine neue Zeile, bleibt das Feld an der angeklickten (l2) mit ihrem alten Text, die übrigen bleiben Zeilen',
  );
  /** Das Feld der Korrektur an l2 aus dem Baum der View; jeder Aufruf landet im Protokoll. */
  const eingabe = (log: string[]) => baum(stand({ caption: caption({ lines: ZEILEN }) }), 'l2', log).find((e) => e.type === 'input');
  /** Ruft einen Hörer des Felds; ein Wurf landet als „Wurf: …“ im Protokoll (macht den Vergleich rot, bricht das Modul nicht ab). */
  const ruf = (log: string[], name: 'onBlur' | 'onKeyDown', e: unknown): void => {
    try {
      (eingabe(log)?.props[name] as ((e: unknown) => void) | undefined)?.(e);
    } catch (f) {
      log.push(`Wurf: ${f instanceof Error ? f.message : String(f)}`);
    }
  };
  const blur = (log: string[], target: unknown): void => ruf(log, 'onBlur', { target });
  const taste = (log: string[], e: unknown): void => ruf(log, 'onKeyDown', e);
  const offen = eingabe([]);
  ok(offen?.props.autoFocus === true && offen.props.defaultValue === ZEILEN[1].text && offen.props.value === undefined, 'CA Live Korrektur: ungesteuertes Feld (defaultValue) mit Fokus beim Öffnen');
  // Altfehler CA-5: Verlassen schickt die Korrektur an die Kennung der angeklickten Zeile (correctLine), dann endet der Modus.
  const logNeu: string[] = [];
  blur(logNeu, { value: 'Neu' });
  await warte();
  gleich(logNeu, ['correctLine:l2:Neu', 'bearbeiten:null'], 'CA-5 Korrektur trifft die Zeile: Verlassen ruft correctLine(l2, Text) für die angeklickte Zeile, auch wenn inzwischen l3 kam, und beendet den Modus');
  // Altfehler CA-5: Escape bricht ab (verbraucht die Taste, stellt den alten Text her, beendet den Modus); das blur beim Abbau des Felds
  // findet den alten Text vor und schickt nichts.
  const logEsc: string[] = [];
  let verhindert = 0;
  let geblurtEsc = 0;
  const feldEsc = { value: 'angefangen', blur: () => void geblurtEsc++ };
  taste(logEsc, { key: 'Escape', preventDefault: () => void verhindert++, currentTarget: feldEsc, target: feldEsc });
  const nachEscape = [...logEsc];
  blur(logEsc, feldEsc);
  await warte();
  gleich(
    { nachEscape, verhindert, wert: feldEsc.value, nachBlur: logEsc, geblurtEsc },
    { nachEscape: ['bearbeiten:null'], verhindert: 1, wert: ZEILEN[1].text, nachBlur: ['bearbeiten:null', 'bearbeiten:null'], geblurtEsc: 0 },
    'CA-5 Escape bricht die Korrektur ab: preventDefault, alter Text im Feld, Modus aus; das folgende blur schickt kein correctLine',
  );
  // Ein unveränderter Text geht nicht mehr an den Main (heute ging er mit, wirkte aber nicht).
  const logGleich: string[] = [];
  blur(logGleich, { value: ZEILEN[1].text });
  await warte();
  gleich(logGleich, ['bearbeiten:null'], 'CA-5 Korrektur: unveränderter Text beim Verlassen schickt kein correctLine, der Modus endet');
  // Enter verlässt das Feld wie bisher (blur übernimmt), ohne selbst zu senden.
  const logEnter: string[] = [];
  let geblurt = 0;
  taste(logEnter, { key: 'Enter', preventDefault: () => {}, target: { blur: () => void geblurt++ } });
  await warte();
  gleich([logEnter, geblurt], [[], 1], 'CA Live Korrektur: Enter verlässt das Feld (blur) und schickt selbst nichts');
  ok(QUELLE('views/CaptionOberflaeche.tsx').includes('const [editing, setEditing] = useState<string | null>(null);'), 'CA Live Korrektur: der Korrekturzustand liegt wie bisher in der Wurzel-View');
}

// ── CA Live Tasten im Feld: das einzige onKeyDown bleibt das Korrekturfeld (keine neuen Kürzel) ──
{
  gleich(
    quellen().filter((d) => /onKeyDown|addEventListener\(\s*'key/.test(ohneKommentare(leseText(d)))),
    ['src/renderer/src/views/LiveBereich.tsx'],
    'CA Live Tasten: keine neuen Kürzel; das einzige onKeyDown ist Enter im Korrekturfeld (Nr. 74, 98)',
  );
}

// ── CA keine rohen Farben: alle Renderer-Dateien außer der Programmfläche lib/caption-cg.ts nur mit Tokens ──
{
  const roh =
    /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|shadow|accent|placeholder|caret|decoration)-(?:white|black|neutral|gray|grey|zinc|slate|stone|red|green|blue|yellow|amber|orange|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?\b|#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\(/;
  ok(
    roh.test('border-neutral-700 bg-neutral-800') && roh.test("background: '#e0533d'") && roh.test('repeating-conic-gradient(#2a2a2a 0% 25%)') && roh.test('rgba(0,0,0,0.55)') && roh.test('text-yellow-300') && !roh.test('border-[var(--status-warn)]/60 bg-[var(--muted)]'),
    'CA keine rohen Farben: Gegenprobe (Klassen, Hex und rgba() des alten App.tsx werden erkannt, Tokens nicht)',
  );
  const dateien = quellen().filter((d) => !d.endsWith('/lib/caption-cg.ts'));
  ok(dateien.length >= 12 && dateien.includes('src/renderer/src/App.tsx') && dateien.includes('src/renderer/src/globals.css') && dateien.includes('src/renderer/src/views/LiveBereich.tsx'), `CA keine rohen Farben: geprüft werden alle Renderer-Dateien samt globals.css (${dateien.length})`);
  gleich(dateien.filter((d) => roh.test(ohneKommentare(leseText(d)))), [], 'CA keine rohen Farben: keine rohen Farbklassen, Hex-, rgb- oder oklch-Werte im Renderer außer der Programmfläche lib/caption-cg.ts');
  ok(roh.test(leseText('src/renderer/src/lib/caption-cg.ts')), 'CA keine rohen Farben: die Programmfläche lib/caption-cg.ts behält ihre Farben (NDI-Bild unverändert)');
}
