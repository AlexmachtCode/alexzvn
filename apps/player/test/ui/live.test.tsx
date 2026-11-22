// UX Welle 2a, Player d2 · Transport und Fußleiste (Spec 3.4, 5.1; E4, E7, E14; W2-10): Die Cue-Show zeigt Standby und den
// Transport als vier TallyButtons (GO, Pause/Weiter, Stop, Panik) mit sichtbaren Gründen; Bibliothek und Soundboard tragen eine
// feste Fußleiste mit Stop und Panik (dieselben Store-Aktionen, ohne Kürzel), die Cue-Show nicht. „■ Alle stoppen“ im Soundboard
// bleibt. Jede Taste ruft dieselbe Store-Aktion wie bisher (Attrappen). Render ohne Browser und ohne window.
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { TallyButton, type TallyButtonProps } from '@jm/ui';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import type { Playlist } from '@shared/types';
import { fussleistenTasten, PLAYER_TEXTE, transportTasten, type OberflaechenStand, type PlayerZustand } from '@/lib/oberflaeche';
import { FussleisteAnzeige, fussleistenKnoepfe } from '@/views/Fussleiste';
import { LiveBereich, transportKnoepfe, type TransportAktionen } from '@/views/LiveBereich';
import { PlayerOberflaeche, type Reiter } from '@/views/PlayerOberflaeche';
import { tallyHandler } from '../../../../packages/ui/src/components/TallyButton';
import { erzeugeHalten } from '../../../../packages/ui/src/lib/halten';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { attr, element, mitStore, ohneKommentare, show as eineShow, showCue, tags, text } from './testzustand';

const T = PLAYER_TEXTE;
const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
const CUES = [showCue(1, { label: 'Intro' }), showCue(2)];
function spieler(z: Partial<PlayerZustand> = {}): PlayerZustand {
  return {
    activeShowId: 1,
    showCues: CUES,
    standbyIndex: 0,
    playingCueIds: [],
    vorlaufCueIds: [],
    showPaused: false,
    videoCue: null,
    videoProgress: null,
    outputDisplayId: null,
    ...z,
  };
}
const stand = (p: PlayerZustand | undefined): Pick<OberflaechenStand, 'player'> => ({ player: p });
/** Attrappen der vier Store-Aktionen; jeder Aufruf schreibt den Namen der Aktion ins Protokoll. */
function aktionen(log: string[] = []): TransportAktionen {
  return {
    showGo: () => void log.push('showGo'),
    showTogglePause: () => void log.push('showTogglePause'),
    showStop: () => void log.push('showStop'),
    showPanic: () => void log.push('showPanic'),
  };
}
const LAUF: Record<string, Partial<PlayerZustand>> = {
  leer: {},
  vorlauf: { playingCueIds: [1], vorlaufCueIds: [1] },
  spielt: { playingCueIds: [1] },
};
/** Kreuzprodukt der Zustände, die Sperren und Beschriftungen des Transports ändern (standby 2 = hinter dem letzten Cue). */
const FAELLE = kreuz({ player: ['da', 'undefined'], standby: [0, 2], lauf: Object.keys(LAUF), pausiert: [false, true] } as const);
const spielerAus = (f: (typeof FAELLE)[number]): PlayerZustand | undefined =>
  f.player === 'undefined' ? undefined : spieler({ ...LAUF[f.lauf], showPaused: f.pausiert, standbyIndex: f.standby });

/** Alle TallyButton-Props eines Baums; Bausteine ohne Hooks (LiveBereich, Tasten, FussleisteAnzeige) werden aufgerufen. */
function tallys(n: ReactNode): TallyButtonProps[] {
  if (Array.isArray(n)) return n.flatMap(tallys);
  if (!isValidElement(n)) return [];
  const el = n as ReactElement<Record<string, unknown>>;
  if (el.type === TallyButton) return [el.props as unknown as TallyButtonProps];
  if (typeof el.type === 'function') return tallys((el.type as (p: unknown) => ReactNode)(el.props));
  return tallys(el.props.children as ReactNode);
}
/** Klick wie im Fenster: über die Ereignis-Verdrahtung des TallyButton (eine gesperrte Taste klickt nicht). */
const klick = (p: TallyButtonProps): void => tallyHandler(p, erzeugeHalten({})).onClick();

interface Knopf {
  label: string | undefined;
  state: string | undefined;
  gesperrt: string | undefined;
  title: string | undefined;
  kuerzel: string | undefined;
  grund: string | undefined;
}
/** Die gerenderten TallyButtons (Knöpfe mit data-state) in Reihenfolge. */
function knoepfe(html: string): Knopf[] {
  return [...html.matchAll(/(<button[^>]*\sdata-state="[^"]*"[^>]*>)([\s\S]*?)<\/button>/g)].map((m) => {
    const innen = m[2];
    const kbd = innen.match(/<kbd[^>]*>([\s\S]*?)<\/kbd>/)?.[1];
    return {
      label: innen.match(/<span>([^<]*)<\/span>/)?.[1],
      state: attr(m[1], 'data-state'),
      gesperrt: attr(m[1], 'aria-disabled'),
      title: attr(m[1], 'title'),
      kuerzel: kbd === undefined ? undefined : text(kbd.replace(/<span class="sr-only">[^<]*<\/span>/, '')),
      grund: innen.match(/<span id="[^"]*"[^>]*>([^<]*)<\/span>/)?.[1],
    };
  });
}
/** Erwartung je Taste aus der Ableitung: so muss sie gerendert erscheinen. */
function erwartet(t: { label: string; state: string; shortcut?: string; disabledReason?: string }): Knopf {
  const gesperrt = t.state === 'gesperrt';
  return {
    label: t.label,
    state: t.state,
    gesperrt: gesperrt ? 'true' : undefined,
    title: gesperrt ? t.disabledReason : undefined,
    kuerzel: t.shortcut,
    grund: gesperrt ? t.disabledReason : undefined,
  };
}
const ab = (html: string, merkmal: string): string => {
  const i = html.indexOf(merkmal);
  return i < 0 ? '' : html.slice(i);
};
/** Der Inhalt des AppShell (`<main>…</main>`). */
const inhalt = (html: string): string => element(html, 'main', '');
const MIT_SHOW = { loading: false, shows: [eineShow(1, 'Gala')], activeShowId: 1, showCues: CUES, standbyIndex: 0 };
const BOARD: Playlist = { id: 1, name: 'Board', kind: 'soundboard', createdAt: 0, updatedAt: 0 };

// ── PL Transport: vier TallyButtons, Gründe sichtbar, GO zeigt „Leertaste“ ──
{
  pruefeFaelle('PL Transport: gerendert genau vier TallyButtons GO, Pause/Weiter, Stop, Panik mit Zustand, Sperre, Grund (sichtbar und als title) und Kürzel aus transportTasten', FAELLE, (f) => {
    const p = spielerAus(f);
    const t = transportTasten(stand(p));
    const html = render(<LiveBereich stand={stand(p)} aktionen={aktionen()} />);
    return vergleiche(JSON.stringify(knoepfe(html)), JSON.stringify([t.go, t.pauseWeiter, t.stop, t.panik].map(erwartet)));
  });
  pruefeFaelle('PL Transport: gesperrt nie ohne sichtbaren Grund (aria-disabled, Grund-Zeile per aria-describedby)', FAELLE, (f) => {
    const html = render(<LiveBereich stand={stand(spielerAus(f))} aktionen={aktionen()} />);
    const ohne = tags(html, 'button').filter((b) => attr(b, 'aria-disabled') === 'true' && !html.includes(`id="${attr(b, 'aria-describedby') ?? '-'}"`));
    return ohne.length === 0 ? null : `${ohne.length} gesperrte Taste(n) ohne Grund-Zeile`;
  });

  const leer = render(<LiveBereich stand={stand(spieler())} aktionen={aktionen()} />);
  gleich(
    knoepfe(leer).map((k) => [k.label, k.state, k.grund]),
    [
      ['GO', 'bereit', undefined],
      ['❚❚ Pause', 'gesperrt', 'Kein Cue läuft'],
      ['■ Stop', 'bereit', undefined],
      ['⛔ Panik', 'bereit', undefined],
    ],
    'PL Transport: Reihenfolge GO, Pause/Weiter, Stop, Panik; ohne laufenden Cue ist Pause gesperrt und zeigt „Kein Cue läuft“',
  );
  const ende = render(<LiveBereich stand={stand(spieler({ standbyIndex: 2 }))} aktionen={aktionen()} />);
  gleich(
    [knoepfe(ende)[0]?.state, knoepfe(ende)[0]?.gesperrt, knoepfe(ende)[0]?.grund, text(ende).includes('Kein Standby-Cue')],
    ['gesperrt', 'true', 'Kein Standby-Cue', true],
    'PL Transport: ohne Standby-Cue ist GO gesperrt und zeigt „Kein Standby-Cue“ sichtbar',
  );
  const pause = render(<LiveBereich stand={stand(spieler({ playingCueIds: [1], showPaused: true }))} aktionen={aktionen()} />);
  gleich(knoepfe(pause)[1]?.label, '▶ Weiter', 'PL Transport: bei pausierter Show heißt die zweite Taste „▶ Weiter“ (E7, bereit mit wechselnder Beschriftung)');
  gleich(
    knoepfe(leer).map((k) => k.kuerzel),
    ['Leertaste', undefined, 'Esc', undefined],
    'PL Transport: GO zeigt das Kürzel „Leertaste“, Stop „Esc“; Pause/Weiter und Panik haben keines',
  );
  ok(!text(leer).includes('⏎') && !QUELLE('views/ShowView.tsx').includes('GO ⏎'), 'PL Transport: die falsche Beschriftung „GO ⏎“ ist weg (Spec 3.4: ausgelöst wird die Leertaste)');
  ok(
    /<div[^>]*\stitle="Sofort alles stoppen"[^>]*><button[^>]*>(?:(?!<\/button>)[\s\S])*⛔ Panik/.test(leer),
    'PL Transport: der alte Tooltip „Sofort alles stoppen“ umhüllt die Taste Panik (TallyButton hat keinen title)',
  );
  gleich(
    tags(leer, 'div').filter((d) => attr(d, 'title') !== undefined).map((d) => attr(d, 'title')),
    [T.tipps.panik],
    'PL Transport: genau dieser eine Tooltip; GO, Pause/Weiter und Stop tragen keinen',
  );
  ok(
    text(leer).includes('Standby') && text(leer).includes('Cue 1 · Intro') && leer.indexOf('Cue 1 · Intro') < leer.indexOf('data-state='),
    'PL Transport: die Standby-Anzeige „Standby“ / „Cue 1 · ‹Name›“ steht über den Tasten',
  );
  ok(text(ende).includes('— Ende —'), 'PL Transport: ohne Standby-Cue steht „— Ende —“');
  const raster = tags(leer, 'div').filter((d) => attr(d, 'data-player') === 'tasten');
  ok(
    raster.length === 1 && /\bgrid\b/.test(attr(raster[0], 'class') ?? '') && /\bgap-3\b/.test(attr(raster[0], 'class') ?? '') && tags(leer, 'button').length === 4,
    'PL Transport: höchstens vier TallyButtons in einem Raster grid gap-3 (Spec 5.1)',
  );
  ok(/\bshrink-0\b/.test(attr(tags(leer, 'div').find((d) => attr(d, 'data-player') === 'transport'), 'class') ?? ''), 'PL Transport: der Transport schrumpft nicht (shrink-0); die Cue-Liste scrollt, er bleibt sichtbar');
  // Gemessen im Fenster (t16-probe2.mjs, Wurzelschrift 15 px = --text-base): eine gesperrte Taste mit Grund-Zeile ist 62,19 px hoch,
  // eine bereite 47,99 px (--control-h-lg). Ohne feste Höhe spränge der Transport beim GO (Pause wird bereit) und am Ende um 14 px.
  // min-h-16 reichte nicht (4 rem = 60 px); --control-h-lg + 1,25 rem = 66,75 px hält die Zeile in jedem Zustand gleich hoch.
  const FESTE_HOEHE = 'min-h-[calc(var(--control-h-lg)+1.25rem)]';
  const huellen = (h: string): string[] => [...h.matchAll(/<div([^>]*)><button[^>]*\sdata-state=/g)].map((m) => attr(`<div${m[1]}>`, 'class') ?? '');
  pruefeFaelle(`PL Transport: feste Zeilenhöhe (${FESTE_HOEHE} an jeder der vier Hüllen), der Transport springt nicht zwischen gesperrt und bereit`, FAELLE, (f) => {
    const h = huellen(render(<LiveBereich stand={stand(spielerAus(f))} aktionen={aktionen()} />));
    return h.length === 4 && h.every((k) => k.split(/\s+/).includes(FESTE_HOEHE)) ? null : `Hüllen ${JSON.stringify(h)}`;
  });
  ok(!text(leer).includes('"'), 'PL Transport: kein ASCII-Anführungszeichen in den gerenderten Texten');
  pruefeIdVerweise(leer + ende, 'PL Transport: id-Verweise der Tasten gültig');

  const cueShow = inhalt(mitStore(MIT_SHOW, () => render(<PlayerOberflaeche anfangReiter="show" />)));
  gleich(
    knoepfe(cueShow).map((k) => k.label),
    ['GO', '❚❚ Pause', '■ Stop', '⛔ Panik'],
    'PL Transport: die Cue-Show zeigt den Transport ohne Klick (Live-Element mit Standby, vier TallyButtons)',
  );
}

// ── PL Transport Verdrahtung: jede Taste ruft dieselbe Store-Aktion wie bisher (Attrappen) ──
{
  const log: string[] = [];
  transportKnoepfe(stand(spieler({ playingCueIds: [1] })), aktionen(log)).forEach((t) => t.onClick?.());
  gleich(log, ['showGo', 'showTogglePause', 'showStop', 'showPanic'], 'PL Transport Verdrahtung: GO → showGo, Pause/Weiter → showTogglePause, Stop → showStop, Panik → showPanic');

  const baum: string[] = [];
  const gerendert = tallys(LiveBereich({ stand: stand(spieler({ playingCueIds: [1] })), aktionen: aktionen(baum) }));
  gerendert.forEach(klick);
  gleich(
    [gerendert.map((t) => t.label), baum],
    [['GO', '❚❚ Pause', '■ Stop', '⛔ Panik'], ['showGo', 'showTogglePause', 'showStop', 'showPanic']],
    'PL Transport Verdrahtung: die im Live-Bereich gerenderten TallyButtons rufen per Klick genau diese Aktionen',
  );
  ok(gerendert.every((t) => t.onPress === undefined && t.onRelease === undefined), 'PL Transport Verdrahtung: kein Halten, nur Klick');

  // Wie heute: GO disabled={!standbyCue}, Pause disabled={playingCueIds.length === 0 && !showPaused}, Stop und Panik immer.
  pruefeFaelle('PL Transport Verdrahtung: eine gesperrte Taste ruft nichts (GO ohne Standby-Cue, Pause/Weiter ohne Cue und ohne Pause), Stop und Panik immer', FAELLE, (f) => {
    const p = spielerAus(f);
    const l: string[] = [];
    tallys(LiveBereich({ stand: stand(p), aktionen: aktionen(l) })).forEach(klick);
    const soll = [
      ...(p !== undefined && f.standby === 0 ? ['showGo'] : []),
      ...(p !== undefined && (p.playingCueIds.length > 0 || p.showPaused) ? ['showTogglePause'] : []),
      'showStop',
      'showPanic',
    ];
    return vergleiche(l.join(','), soll.join(','));
  });
  pruefeFaelle('PL Transport Verdrahtung: die Tasten sind genau die Ableitung transportTasten plus Klick (keine zweite Rechnung)', FAELLE, (f) => {
    const p = spielerAus(f);
    const t = transportTasten(stand(p));
    const ist = transportKnoepfe(stand(p), aktionen()).map(({ onClick: _k, ...rest }) => rest);
    return vergleiche(JSON.stringify(ist), JSON.stringify([t.go, t.pauseWeiter, t.stop, t.panik]));
  });

  const show = QUELLE('views/ShowView.tsx');
  ok(
    ['showGo', 'showTogglePause', 'showStop', 'showPanic'].every((a) => show.includes(`const ${a} = usePlayer((s) => s.${a});`)) &&
      show.includes('aktionen={{ showGo, showTogglePause, showStop, showPanic }}') &&
      (show.match(/<LiveBereich\b/g) ?? []).length === 1,
    'PL Transport Verdrahtung: die Cue-Show reicht genau die Store-Aktionen showGo, showTogglePause, showStop, showPanic an den Live-Bereich',
  );
  ok(
    !/onClick=\{show(?:Go|Stop|Panic|TogglePause)\}/.test(show) && !show.includes('Sofort alles stoppen'),
    'PL Transport Verdrahtung: der alte handgebaute Transport ist aus ShowView.tsx entfernt (keine zweiten Knöpfe)',
  );
  const live = QUELLE('views/LiveBereich.tsx');
  ok(
    !/(?<![\w-])window\b/.test(live) && !live.includes('usePlayer') && !/addEventListener|keydown|onKeyDown/i.test(live),
    'PL Transport Verdrahtung: der Live-Bereich liest weder window noch Store und hat keine eigene Tastenbehandlung (Leertaste/Esc bleiben in der Cue-Show)',
  );
}

// ── PL Fußleiste: Stop und Panik in Bibliothek und Soundboard, nicht doppelt in der Cue-Show ──
{
  pruefeFaelle('PL Fußleiste: gerendert genau Stop und Panik aus fussleistenTasten, immer bereit, ohne Kürzel', FAELLE, (f) => {
    const p = spielerAus(f);
    const t = fussleistenTasten(stand(p));
    const html = render(<FussleisteAnzeige stand={stand(p)} aktionen={aktionen()} />);
    const ist = knoepfe(html);
    if (ist.some((k) => k.kuerzel !== undefined || k.state !== 'bereit')) return 'Kürzel oder nicht bereit';
    return vergleiche(JSON.stringify(ist), JSON.stringify([t.stop, t.panik].map(erwartet)));
  });
  const html = render(<FussleisteAnzeige stand={stand(spieler())} aktionen={aktionen()} />);
  gleich(knoepfe(html).map((k) => k.label), ['■ Stop', '⛔ Panik'], 'PL Fußleiste: Beschriftungen wie im Transport');
  ok(
    /<div[^>]*\stitle="Sofort alles stoppen"[^>]*><button[^>]*>(?:(?!<\/button>)[\s\S])*⛔ Panik/.test(html) && !html.includes('<kbd'),
    'PL Fußleiste: Panik mit dem Tooltip „Sofort alles stoppen“, kein Kürzel sichtbar (W2-10)',
  );
  const wrapper = tags(html, 'div').filter((d) => attr(d, 'data-player') === 'tasten');
  const stopHuelle = html.match(/<div([^>]*)><button[^>]*>(?:(?!<\/button>)[\s\S])*■ Stop/)?.[1] ?? '';
  ok(
    wrapper.length === 1 && /\bgrid-cols-4\b/.test(attr(wrapper[0], 'class') ?? '') && /\bcol-start-3\b/.test(stopHuelle),
    'PL Fußleiste: Stop und Panik stehen in den Spalten 3 und 4 des Rasters, an derselben Stelle wie im Transport der Cue-Show',
  );
  ok(/\bshrink-0\b/.test(attr(tags(html, 'div').find((d) => attr(d, 'data-player') === 'fussleiste'), 'class') ?? ''), 'PL Fußleiste: fest unten (shrink-0), der Inhalt darüber scrollt');

  const log: string[] = [];
  fussleistenKnoepfe(stand(spieler()), aktionen(log)).forEach((t) => t.onClick?.());
  const baum: string[] = [];
  tallys(FussleisteAnzeige({ stand: stand(undefined), aktionen: aktionen(baum) })).forEach(klick);
  gleich([log, baum], [['showStop', 'showPanic'], ['showStop', 'showPanic']], 'PL Fußleiste: Stop → showStop, Panik → showPanic, dieselben Handler wie im Transport, auch vor dem Laden');

  const fall = (r: Reiter, patch: Record<string, unknown>): string => inhalt(mitStore(patch, () => render(<PlayerOberflaeche anfangReiter={r} />)));
  const ansichten: Array<[string, string]> = [
    ['Bibliothek vor dem Laden', fall('library', {})],
    ['Bibliothek', fall('library', { loading: false })],
    ['Soundboard ohne Board', fall('soundboard', { loading: false })],
    ['Soundboard mit Board', fall('soundboard', { loading: false, playlists: [BOARD], soundboardId: 1, cues: [] })],
  ];
  gleich(
    ansichten.map(([name, h]) => [name, (h.match(/data-player="fussleiste"/g) ?? []).length, knoepfe(ab(h, 'data-player="fussleiste"')).map((k) => k.label)]),
    ansichten.map(([name]) => [name, 1, ['■ Stop', '⛔ Panik']]),
    'PL Fußleiste: Bibliothek (auch vor dem Laden) und Soundboard (auch ohne Board) tragen genau eine Fußleiste mit Stop und Panik',
  );
  const cue = fall('show', MIT_SHOW);
  const cueLeer = fall('show', { loading: false });
  gleich(
    [cue.includes('data-player="fussleiste"'), cueLeer.includes('data-player="fussleiste"'), knoepfe(cue).filter((k) => k.label === '■ Stop').length, knoepfe(cue).filter((k) => k.label === '⛔ Panik').length],
    [false, false, 1, 1],
    'PL Fußleiste: die Cue-Show hat keine Fußleiste; Stop und Panik stehen dort genau einmal (im Transport)',
  );
  const show = QUELLE('views/ShowView.tsx');
  const lib = QUELLE('views/LibraryView.tsx');
  const sb = QUELLE('views/SoundboardView.tsx');
  gleich(
    [show.includes('Fussleiste'), (lib.match(/<Fussleiste \/>/g) ?? []).length, (sb.match(/<Fussleiste \/>/g) ?? []).length],
    [false, 1, 2],
    'PL Fußleiste: Quelltext-Wächter: keine Fußleiste in ShowView.tsx; LibraryView einmal, SoundboardView in beiden Zweigen (mit und ohne Board)',
  );
  const fuss = QUELLE('views/Fussleiste.tsx');
  ok(
    fuss.includes('const showStop = usePlayer((s) => s.showStop);') && fuss.includes('const showPanic = usePlayer((s) => s.showPanic);') && fuss.includes('aktionen={{ showStop, showPanic }}'),
    'PL Fußleiste: die Fußleiste reicht genau die Store-Aktionen showStop und showPanic durch',
  );
  ok(!/addEventListener|keydown|onKeyDown|stopAll|shortcut/i.test(fuss), 'PL Fußleiste: keine Tastenbehandlung, kein Kürzel, kein eigenes stopAll (Panik stoppt die Pads über showPanic)');
}

// ── PL Alle stoppen bleibt: „■ Alle stoppen“ im Soundboard unverändert ──
{
  const html = inhalt(mitStore({ loading: false, playlists: [BOARD], soundboardId: 1, cues: [] }, () => render(<PlayerOberflaeche anfangReiter="soundboard" />)));
  const knopf = [...html.matchAll(/(<button[^>]*>)([\s\S]*?)<\/button>/g)].filter((m) => text(m[2]).trim() === '■ Alle stoppen');
  ok(
    knopf.length === 1 && attr(knopf[0][1], 'data-state') === undefined && html.indexOf('■ Alle stoppen') < html.indexOf('+ zuweisen') && !ab(html, 'data-player="fussleiste"').includes('Alle stoppen'),
    'PL Alle stoppen bleibt: genau ein Knopf „■ Alle stoppen“ im Kopf des Soundboards (kein TallyButton, nicht in der Fußleiste)',
  );
  const sb = QUELLE('views/SoundboardView.tsx');
  ok(
    /<Button size="sm" variant="ghost" onClick=\{\(\) => cueEngine\.stopAll\(\)\}>\s*■ Alle stoppen\s*<\/Button>/.test(sb) && (sb.match(/cueEngine\.stopAll\(\)/g) ?? []).length === 1,
    'PL Alle stoppen bleibt: der Knopf ruft weiter nur cueEngine.stopAll() (Pads), wie bisher',
  );
  gleich(
    ['views/ShowView.tsx', 'views/LibraryView.tsx', 'views/LiveBereich.tsx', 'views/Fussleiste.tsx'].filter((d) => /stopAll/.test(QUELLE(d))),
    [],
    'PL Alle stoppen bleibt: sonst ruft keine Ansicht stopAll (die Pads stoppt Panik im Store, W2-10)',
  );
}

// ── PL Hinweisleiste: über Fußleiste bzw. Transport, nie über Statusleiste, Stop oder Panik ──
{
  // Gemessen vor dem Umbau (t16-vorher.json): mit bottom-[calc(var(--statusbar-h)+1.25rem)] lag der Hinweis bei 1309×790 auf y 686–744
  // und deckte die Fußleiste (691–762, Stop x 660–968) bzw. den Transport (624–762) für 4 s; bei 1028×630 ebenso.
  const ALT = 'bottom-[calc(var(--statusbar-h)+1.25rem)]';
  const SOLL: Record<Reiter, string> = {
    library: 'bottom-[calc(var(--statusbar-h)+var(--control-h-lg)+2.25rem)]',
    soundboard: 'bottom-[calc(var(--statusbar-h)+var(--control-h-lg)+2.25rem)]',
    show: 'bottom-[calc(var(--statusbar-h)+10.5rem)]',
  };
  const klasse = (r: Reiter): string | undefined => {
    const h = inhalt(mitStore({ ...MIT_SHOW, notice: 'Importiere…' }, () => render(<PlayerOberflaeche anfangReiter={r} />)));
    return attr(tags(h, 'div').find((d) => /\bfixed\b/.test(attr(d, 'class') ?? '') && (attr(d, 'class') ?? '').includes('bottom-[')), 'class');
  };
  gleich(
    (['library', 'soundboard', 'show'] as Reiter[]).map((r) => [r, (klasse(r) ?? '').split(/\s+/).filter((k) => k.startsWith('bottom-'))]),
    (['library', 'soundboard', 'show'] as Reiter[]).map((r) => [r, [SOLL[r]]]),
    'PL Hinweisleiste: in Bibliothek und Soundboard über der Fußleiste, in der Cue-Show über dem Transport (Abstand je Reiter)',
  );
  ok(!QUELLE('views/PlayerOberflaeche.tsx').includes(ALT), 'PL Hinweisleiste: der alte Abstand über der Statusleiste (deckte Fußleiste und Transport) ist weg');
  ok(
    text(inhalt(mitStore({ loading: false, notice: 'Importiere…' }, () => render(<PlayerOberflaeche anfangReiter="library" />)))).includes('Importiere…'),
    'PL Hinweisleiste: der Hinweis erscheint weiter im Inhalt (Text aus dem Store)',
  );
}

// ── PL keine rohen Farben: geänderte Dateien nur mit Tokens (außer der Video-Fläche der Bibliotheks-Vorschau) ──
{
  const dateien = ['views/ShowView.tsx', 'views/LiveBereich.tsx', 'views/Fussleiste.tsx', 'views/SoundboardView.tsx', 'views/LibraryView.tsx', 'views/PlayerOberflaeche.tsx'];
  // Video-Fläche (Programmfläche, W2-9): der schwarze Rahmen um das <video> der Vorschau in LibraryView.tsx.
  const VIDEO_FLAECHE = 'flex-1 min-h-0 bg-black grid place-items-center overflow-hidden p-2';
  const lib = QUELLE('views/LibraryView.tsx');
  gleich(lib.split(VIDEO_FLAECHE).length - 1, 1, 'PL keine rohen Farben: genau eine Video-Fläche (bg-black) in LibraryView.tsx, die Vorschau');
  const roh = /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|shadow)-(?:white|black|neutral|gray|grey|zinc|slate|stone|red|green|blue|yellow|amber|orange|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?\b|#[0-9a-fA-F]{3,8}\b/;
  gleich(
    dateien.filter((d) => roh.test(QUELLE(d).replace(VIDEO_FLAECHE, ''))),
    [],
    'PL keine rohen Farben: keine rohen Farbklassen und Hex-Werte in den geänderten Dateien, nur Tokens (Video-Fläche ausgenommen)',
  );
}
