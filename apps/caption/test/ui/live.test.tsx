// UX Welle 2a, Caption d · Live-Bereich (Spec 3.4, 5.1; E4, E7, E9; Funktionsliste Nr. 9–12, 24–36): oben die vier Haupttasten
// als TallyButtons (Start/Stopp, Hold, Leeren, NDI, in der Reihenfolge von heute) in grid gap-3, direkt darunter der
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
  gleich(tags(m, 'button').filter((t) => attr(t, 'data-state') !== undefined).length, 4, 'CA Live: genau vier TallyButtons (Start/Stopp, Hold, Leeren, NDI)');
  const tasten = (attr(tags(m, 'div').find((t) => attr(t, 'data-caption') === 'tasten'), 'class') ?? '').split(/\s+/);
  ok(['grid', 'grid-cols-2', 'gap-3', 'max-w-[30rem]'].every((k) => tasten.includes(k)), 'CA Live: die Haupttasten stehen in grid gap-3, zwei Spalten, feste Breite (gleiche Lage bei jeder Fenstergröße und offenem Panel)');
  const wurzel = (attr(tags(m, 'section').find((t) => attr(t, 'data-caption') === 'live'), 'class') ?? '').split(/\s+/);
  ok(wurzel.includes('max-[900px]:max-w-[calc(100vw_-_var(--panel-w)_-_2.5rem)]'), 'CA Live: unter 900 px bleibt der Live-Bereich links neben dem Panel (das Panel liegt dort über dem Inhalt)');
  const zeile = (attr(tags(m, 'div').find((t) => attr(t, 'data-caption') === 'zeile-vorschau'), 'class') ?? '').split(/\s+/);
  ok(zeile.includes('flex-wrap'), 'CA Live: Live-Zeile und Vorschau stehen nebeneinander und brechen bei schmalem Inhalt untereinander um');
  pruefeIdVerweise(html, 'CA Live: id-Verweise gültig');
  ok(!text(m).includes('"'), 'CA Live: kein ASCII-Anführungszeichen im Text des Live-Bereichs');
}

// ── CA Live Tasten: gerendert genau hauptTasten in der Reihenfolge von heute, Gründe sichtbar ──
{
  const faelle = kreuz({ antwort: BOOL, running: BOOL, hold: BOOL, ndiActive: BOOL, ndiSendet: BOOL, micError: [null, MIKRO_FEHLER] } as const);
  pruefeFaelle('CA Live Tasten: vier TallyButtons Start/Stopp, Hold, Leeren, NDI mit Zustand, Sperre und Grund aus hauptTasten', faelle, (f) => {
    const s = stand({ caption: f.antwort ? caption({ running: f.running, hold: f.hold, status: { ndiActive: f.ndiActive, ndiSendet: f.ndiSendet } }) : undefined, micError: f.micError });
    const t = hauptTasten(s);
    return vergleiche(JSON.stringify(knoepfe(live(s))), JSON.stringify([t.start, t.hold, t.leeren, t.ndi].map(erwartet)));
  });
  gleich(
    knoepfe(live(stand({ caption: undefined }))).map((k) => [k.state, k.gesperrt, k.grund]),
    [0, 1, 2, 3].map(() => ['gesperrt', 'true', T.grund.zustandOffen]),
    'CA Live Tasten: vor der ersten Antwort alle vier gesperrt mit sichtbarem Grund „Lädt …“ (heute stand dort nur „Lädt …“)',
  );
}

// ── CA Tastenfolge: wie heute (App.tsx bei d7cdd79ce0) ──
{
  // Heute, von links nach rechts und oben nach unten: „● Start“/„■ Stopp“ (App.tsx:185-191), „Hold“/„Hold ✓“ (:192-199) und
  // „Leeren“ (:200-205) rechts im Kopf, „○ NDI starten“/„◉ NDI an“ (:211-218) links in der NDI-Leiste darunter.
  const HEUTE = ['Start', 'Hold', 'Leeren', 'NDI starten'];
  gleich(knoepfe(live(stand())).map((k) => k.label), HEUTE, 'CA Tastenfolge: Start, Hold, Leeren, NDI in der Reihenfolge von heute (Start bleibt vorn, NDI hinten)');
  gleich(
    knoepfe(live(stand({ caption: caption({ running: true, hold: true, status: { ndiActive: true, ndiSendet: true } }) }))).map((k) => [k.label, k.state]),
    [[T.taste.stopp, 'live'], [T.taste.holdAn, 'bereit'], [T.taste.leeren, 'bereit'], [T.taste.ndiAn, 'live']],
    'CA Tastenfolge: bei Lauf, Hold und sendendem NDI bleibt jede Taste an ihrem Platz, nur die Beschriftung wechselt (Stopp live, Hold ✓ bereit, NDI an live)',
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
    const soll = f.antwort ? [f.running ? 'stop' : 'start', `setHold:${!f.hold}`, 'clear', f.ndiActive ? 'ndiStop' : 'ndiStart:JM Caption'] : [];
    return vergleiche(log.join(','), soll.join(','));
  });
  pruefeFaelle('CA Live Verdrahtung: liveTasten ist genau hauptTasten plus Klick (keine zweite Rechnung)', kreuz({ antwort: BOOL, running: BOOL, ndiSendet: BOOL } as const), (f) => {
    const s = stand({ caption: f.antwort ? caption({ running: f.running, status: { ndiActive: f.ndiSendet, ndiSendet: f.ndiSendet } }) : undefined });
    const t = hauptTasten(s);
    return vergleiche(JSON.stringify(liveTasten(s, aktionen()).map(({ onClick, ...r }) => [r, typeof onClick])), JSON.stringify([t.start, t.hold, t.leeren, t.ndi].map((x) => [x, 'function'])));
  });
  // Die Tasten im gerenderten Baum sind genau liveTasten (keine toten Knöpfe).
  const log: string[] = [];
  const tallys = baum(stand({ caption: caption({ hold: true, status: { ndiActive: true } }) }), null, log).filter((e) => e.type === TallyButton);
  for (const t of tallys) klick(t.props as unknown as TallyButtonProps);
  gleich(log, ['start', 'setHold:false', 'clear', 'ndiStop'], 'CA Live Verdrahtung: die TallyButtons im gerenderten Live-Bereich klicken start, setHold(false), clear und ndiStop');
  const log2: string[] = [];
  for (const k of liveTasten(stand({ caption: caption({ config: { ndiName: 'Saal 2' } }) }), liveAktionen(store(log2), 'Saal 2', () => {}))) klick(k);
  gleich(log2.at(-1), 'ndiStart:Saal 2', 'CA Live Verdrahtung: NDI starten nimmt den Quellnamen der Konfiguration (ndiStart(c.ndiName))');
  const ober = QUELLE('views/CaptionOberflaeche.tsx');
  ok(
    ober.includes('const { state, level, load, setLevel, setConfig, start, stop, setHold, clear, correctLast, ndiStart, ndiStop } =') &&
      ober.includes('const store: CaptionStore = { setConfig, start, stop, setHold, clear, correctLast, ndiStart, ndiStop };') &&
      ober.includes('liveAktionen(store, cfg?.ndiName, setEditing)'),
    'CA Live Verdrahtung: die View reicht genau die Store-Aktionen aus useCaption an liveAktionen (Name der NDI-Quelle aus der Konfiguration)',
  );
}

// ── CA Live Mikrofonfehler: Text unter den Haupttasten (E9), bleibt bis zum nächsten erfolgreichen Start ──
{
  const mit = live(stand({ caption: caption({ running: true }), micError: MIKRO_FEHLER }));
  const band = element(mit, 'p', 'data-caption="mikrofonfehler"');
  ok(text(band) === T.live.mikrofonFehler(MIKRO_FEHLER) && T.live.mikrofonFehler('x') === 'Mikrofon: x' && band.includes('role="alert"'), 'CA Live Mikrofonfehler: „Mikrofon: ‹Meldung›“ wie das alte Band, als Hinweis (role alert)');
  const pos = (h: string, s: string): number => h.indexOf(s);
  ok(pos(mit, 'data-caption="tasten"') < pos(mit, 'data-caption="mikrofonfehler"') && pos(mit, 'data-caption="mikrofonfehler"') < pos(mit, 'data-caption="live-zeile"'), 'CA Live Mikrofonfehler: direkt unter den Haupttasten, vor der Live-Zeile (E9)');
  // Ruling Task 25/26: micError bleibt wie heute stehen, auch nach dem Stopp; die Start-Taste bleibt bedienbar und ist nie live.
  const gestoppt = live(stand({ caption: caption({ running: false }), micError: MIKRO_FEHLER }));
  ok(gestoppt.includes('data-caption="mikrofonfehler"') && knoepfe(gestoppt)[0]?.state === 'bereit', 'CA Live Mikrofonfehler: der Text bleibt nach dem Stopp stehen (wie heute), Start bleibt bedienbar');
  ok(knoepfe(mit)[0]?.label === T.taste.stopp && knoepfe(mit)[0]?.state === 'bereit', 'CA Live Mikrofonfehler: bei Lauf mit Mikrofonfehler „Stopp“ bedienbar, nicht live (E4, E9)');
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
  // Im Korrekturmodus: Feld mit altem Text, Fokus sofort; Verlassen übernimmt (correctLast, dann Ende); Enter verlässt; Escape nichts.
  const html = live(stand({ caption: caption({ lines: ZEILEN }) }), 'l3');
  const feld = tags(verlauf(html), 'input')[0];
  ok(attr(feld, 'value') === ZEILEN[2].text && !text(verlauf(html)).includes(ZEILEN[2].text) && text(verlauf(html)).includes(ZEILEN[1].text), 'CA Live Korrektur: die jüngste Zeile wird zum Feld mit dem alten Text, die übrigen bleiben');
  const log2: string[] = [];
  const eingabe = baum(stand({ caption: caption({ lines: ZEILEN }) }), 'l3', log2).find((e) => e.type === 'input');
  ok(eingabe?.props.autoFocus === true && eingabe.props.defaultValue === ZEILEN[2].text && eingabe.props.value === undefined, 'CA Live Korrektur: ungesteuertes Feld (defaultValue) mit Fokus beim Öffnen');
  (eingabe?.props.onBlur as ((e: unknown) => void) | undefined)?.({ target: { value: 'Bitte nehmen Sie jetzt Platz.' } });
  let geblurt = 0;
  const ziel = { blur: () => void geblurt++ };
  (eingabe?.props.onKeyDown as ((e: unknown) => void) | undefined)?.({ key: 'Enter', target: ziel });
  (eingabe?.props.onKeyDown as ((e: unknown) => void) | undefined)?.({ key: 'Escape', target: ziel });
  await warte();
  gleich([log2, geblurt], [['correctLast:Bitte nehmen Sie jetzt Platz.', 'bearbeiten:null'], 1], 'CA Live Korrektur: Verlassen ruft correctLast(Text) und beendet den Modus; Enter verlässt das Feld; Escape tut nichts (wie heute)');
  // Die Korrektur gilt weiter der jüngsten Zeile im Main (correctLast ohne Zeilen-Id), auch wenn das Feld an einer älteren hängt.
  const alt = live(stand({ caption: caption({ lines: ZEILEN }) }), 'l2');
  ok(attr(tags(verlauf(alt), 'input')[0], 'value') === ZEILEN[1].text, 'CA Live Korrektur: kommt während der Eingabe eine neue Zeile, bleibt das Feld an der alten (wie heute, Befund 5)');
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
