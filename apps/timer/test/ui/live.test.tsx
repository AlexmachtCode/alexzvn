// UX Welle 1, Timer d · Live-Bereich (Spec 3.4, 5.1, Anhang A „Timer“; E8, E9, E10): die laufende Zeit immer sichtbar, darunter höchstens
// vier Haupttasten als TallyButtons (Countdown 2, Ablauf 4), Delay und Auto-Advance als gemerkte Collapsibles. Render ohne Browser.
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { Clock } from '@/components/Clock';
import { Countdown } from '@/components/Countdown';
import { MessageBar } from '@/components/MessageBar';
import { Timetable } from '@/components/Timetable';
import { hauptTasten, TIMER_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';
import { INITIAL_STATE, type TimetableItem } from '@shared/timer-state';
import { HauptTasten, liveTasten, type HauptAktionen } from '@/views/LiveBereich';
import { attr, mitStore, ohneKommentare, tags, text } from './testzustand';

const T = TIMER_TEXTE;
const item = (i: number): TimetableItem => ({ id: `i${i}`, label: `Punkt ${i + 1}`, durationMs: 60_000 });
const LAEUFT = { ...INITIAL_STATE.countdown, startedAtMs: 1_000 };
const PAUSIERT = { ...INITIAL_STATE.countdown, pausedRemainingMs: 30_000 };
const ABLAUF = (activeIndex: number | null, n = 3): typeof INITIAL_STATE.timetable => ({ ...INITIAL_STATE.timetable, items: Array.from({ length: n }, (_, i) => item(i)), activeIndex });
const stand = (timer: Partial<typeof INITIAL_STATE>): Pick<OberflaechenStand, 'timer'> => ({ timer: { countdown: INITIAL_STATE.countdown, timetable: INITIAL_STATE.timetable, ...timer } });
function aktionen(log: string[] = []): HauptAktionen {
  return { start: () => void log.push('start'), pause: () => void log.push('pause'), reset: () => void log.push('reset'), prev: () => void log.push('prev'), next: () => void log.push('next') };
}
const zeile = (s: Pick<OberflaechenStand, 'timer'>, mode: 'countdown' | 'timetable'): string[] =>
  liveTasten(s, mode, aktionen()).map((t) => `${t.label}:${t.state}${t.disabledReason ? `(${t.disabledReason})` : ''}${t.shortcut ? `[${t.shortcut}]` : ''}`);

// ── TI Live Tasten je Modus (liveTasten) ──
{
  gleich(
    [
      zeile(stand({}), 'countdown'),
      zeile(stand({ countdown: LAEUFT }), 'countdown'),
      zeile(stand({ countdown: PAUSIERT }), 'countdown'),
      zeile(stand({ countdown: { ...INITIAL_STATE.countdown, delayMs: 5_000 } }), 'countdown'),
    ],
    [
      ['Start:bereit[Leertaste]', `Reset:gesperrt(${T.grund.nichtsZuruecksetzen})[R]`],
      ['Pause:bereit[Leertaste]', 'Reset:bereit[R]'],
      ['Resume:bereit[Leertaste]', 'Reset:bereit[R]'],
      ['Start:bereit[Leertaste]', 'Reset:bereit[R]'],
    ],
    'TI Live Tasten je Modus: Countdown hat Start/Resume/Pause (eine Taste, Leertaste) und Reset (R); Reset im Leerlauf gesperrt mit Grund; nie live',
  );
  gleich(
    [
      zeile(stand({ timetable: ABLAUF(null, 0) }), 'timetable'),
      zeile(stand({ timetable: ABLAUF(0) }), 'timetable'),
      zeile(stand({ timetable: ABLAUF(1), countdown: LAEUFT }), 'timetable'),
      zeile(stand({ timetable: ABLAUF(2) }), 'timetable'),
    ],
    [
      [`← Prev:gesperrt(${T.grund.keinePunkte})`, 'Start:bereit', `Reset:gesperrt(${T.grund.nichtsZuruecksetzen})`, `Next →:gesperrt(${T.grund.keinePunkte})`],
      [`← Prev:gesperrt(${T.grund.ersterPunkt})`, 'Start:bereit', `Reset:gesperrt(${T.grund.nichtsZuruecksetzen})`, 'Next →:bereit'],
      ['← Prev:bereit', 'Pause:bereit', 'Reset:bereit', 'Next →:bereit'],
      ['← Prev:bereit', 'Start:bereit', `Reset:gesperrt(${T.grund.nichtsZuruecksetzen})`, `Next →:gesperrt(${T.grund.letzterPunkt})`],
    ],
    'TI Live Tasten je Modus: Ablauf hat ← Prev, Start/Pause, Reset und Next →; am Anfang und Ende gesperrt mit Grund; ohne Kürzel (die gibt es nur im Countdown)',
  );
  const log: string[] = [];
  const bedienen = (s: Pick<OberflaechenStand, 'timer'>, mode: 'countdown' | 'timetable'): void => liveTasten(s, mode, aktionen(log)).forEach((t) => t.onClick?.());
  bedienen(stand({}), 'countdown');
  bedienen(stand({ countdown: LAEUFT }), 'countdown');
  bedienen(stand({ timetable: ABLAUF(1) }), 'timetable');
  gleich(
    log,
    ['start', 'reset', 'pause', 'reset', 'prev', 'start', 'reset', 'next'],
    'TI Live Tasten je Modus: Klick ruft startCountdown/pauseCountdown/resetCountdown/ttPrev/ttNext (Handler wie heute; Start ruft im Lauf pause)',
  );
  ok(
    ['countdown', 'timetable'].every((m) => liveTasten(stand({}), m as 'countdown' | 'timetable', aktionen()).every((t) => t.state !== 'live' && t.onPress === undefined)),
    'TI Live Tasten je Modus: keine live-Zustände und kein Halten (E8: der Timer hat keine On-Air-Quelle)',
  );
  gleich(hauptTasten(stand({}), 'clock'), null, 'TI Live Tasten je Modus: die Uhr hat keine Haupttasten');
}

// ── Gerendert: aria-disabled, Grund sichtbar, Kürzel nur im Countdown ──
{
  const cd = render(<HauptTasten stand={stand({})} mode="countdown" aktionen={aktionen()} />);
  const ab = render(<HauptTasten stand={stand({ timetable: ABLAUF(0) })} mode="timetable" aktionen={aktionen()} />);
  const sperre = (html: string): Array<string | undefined> => tags(html, 'button').map((t) => attr(t, 'aria-disabled'));
  gleich([tags(cd, 'button').length, tags(ab, 'button').length], [2, 4], 'TI Live Tasten je Modus: gerendert zwei (Countdown) bzw. vier (Ablauf) TallyButtons, höchstens vier');
  gleich([sperre(cd), sperre(ab)], [[undefined, 'true'], ['true', undefined, 'true', undefined]], 'TI Live Tasten je Modus: gesperrte Tasten tragen aria-disabled');
  ok(text(cd).includes(T.grund.nichtsZuruecksetzen) && text(ab).includes(T.grund.ersterPunkt), 'TI Live Tasten je Modus: der Sperrgrund steht sichtbar neben der Taste');
  ok(cd.includes('<kbd') && text(cd).includes('Leertaste') && !ab.includes('<kbd'), 'TI Live Tasten je Modus: Kürzel „Leertaste“ und „R“ nur im Countdown, nicht im Ablauf (UO5)');
  pruefeIdVerweise(cd + ab, 'TI Live Tasten je Modus: id-Verweise der Sperrgründe gültig');
}

// ── Live-Element ohne Klick sichtbar; Collapsibles gemerkt ──
{
  const ZEIT = /\d\d:\d\d:\d\d/;
  const cd = mitStore({ mode: 'countdown' }, () => render(<Countdown />));
  const uhr = render(<Clock />);
  const ab = mitStore({ timetable: ABLAUF(1) }, () => render(<Timetable />));
  ok(ZEIT.test(text(cd)) && ZEIT.test(text(uhr)) && ZEIT.test(text(ab)), 'TI Live Tasten je Modus: die laufende Zeit steht in Uhr, Countdown und Ablauf ohne Klick da');
  ok(cd.indexOf('00:05:00') < cd.indexOf('data-state="bereit"'), 'TI Live Tasten je Modus: im Countdown steht die Zeit über den Haupttasten');
  ok(ab.includes('Punkt 2') && tags(ab, 'button').filter((t) => ['bereit', 'live', 'gesperrt'].includes(attr(t, 'data-state') ?? '')).length === 4, 'TI Live Tasten je Modus: der Ablauf zeigt den aktiven Punkt samt vier Haupttasten');
  const klappen = (html: string): string[] => [...html.matchAll(/<button type="button" aria-expanded="(true|false)"[^>]*>[\s\S]*?<span[^>]*>([^<]*)<\/span>/g)].map((m) => `${m[2]}:${m[1]}`);
  gleich(klappen(cd), ['Delay · Live:true'], 'TI Live Tasten je Modus: Delay im Countdown als Collapsible (offen)');
  gleich(klappen(ab), ['Delay · Live:true', 'Auto-Advance:true'], 'TI Live Tasten je Modus: Delay und Auto-Advance im Ablauf als Collapsibles');
  const quellen = ['DelayControls', 'AutoAdvanceSettings'].map((n) => leseText(`src/renderer/src/components/${n}.tsx`));
  ok(quellen[0].includes('persistId="timer.delay"') && quellen[1].includes('persistId="timer.autoAdvance"'), 'TI Live Tasten je Modus: persistId timer.delay und timer.autoAdvance');
  const leer = mitStore({ timetable: ABLAUF(null, 0) }, () => render(<Timetable />));
  ok(!leer.includes('Auto-Advance'), 'TI Live Tasten je Modus: ohne Programmpunkte kein Auto-Advance (wie bisher)');
}

// ── MessageBar: Texte ohne ASCII-Anführungszeichen ──
{
  const html = mitStore({ mode: 'countdown', timetable: ABLAUF(null) }, () => [render(<MessageBar />), render(<Countdown />), render(<Timetable />), render(<Clock />)].join(''));
  const platzhalter = tags(html, 'input').map((t) => attr(t, 'placeholder') ?? '');
  ok(!text(html).includes('"') && platzhalter.every((p) => !p.includes('"')), 'TI Live Tasten je Modus: kein ASCII-Anführungszeichen in den gerenderten Texten und Platzhaltern (nur „ “)');
  ok(html.includes('data-timer="messagebar"'), 'TI Live Tasten je Modus: die MessageBar trägt ihre Marke');
}

// ── Quelltext-Wächter ──
{
  const dateien = [
    'views/TimerOberflaeche.tsx', 'views/Einstellungen.tsx', 'views/KopfMitte.tsx', 'views/LiveBereich.tsx', 'views/Operator.tsx',
    'components/Sidebar.tsx', 'components/Countdown.tsx', 'components/Timetable.tsx', 'components/TimetableRow.tsx', 'components/RemoteInfo.tsx',
    'components/ColorPicker.tsx', 'components/MessageBar.tsx', 'components/DelayControls.tsx', 'components/AutoAdvanceSettings.tsx', 'components/Clock.tsx',
    'components/ModusKopf.tsx',
  ];
  // Rohe Tailwind-Farbklassen; der Scrim der XLSX-Maske (bg-black/60) ist eine Fläche, keine Bedienfarbe, und die Maske ist nicht Teil dieser Liste.
  const roh = /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|shadow)-(?:white|black|neutral|gray|grey|zinc|slate|stone|red|green|blue|yellow|amber|orange|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?\b/;
  const treffer = dateien.filter((d) => roh.test(ohneKommentare(leseText(`src/renderer/src/${d}`))));
  gleich(treffer, [], 'TI Live Tasten je Modus: keine rohen Farbklassen in den geänderten Dateien, nur Tokens');
  const alt = dateien.filter((d) => /from '\.\/ui\/|components\/ui\//.test(leseText(`src/renderer/src/${d}`)));
  gleich(alt, [], 'TI Live Tasten je Modus: keine Importe der lokalen Ersatzbausteine (StatusPill, Input, SectionHeader, Headline) mehr');
  const ober = ohneKommentare(leseText('src/renderer/src/views/TimerOberflaeche.tsx'));
  const einst = ohneKommentare(leseText('src/renderer/src/views/Einstellungen.tsx'));
  const operator = ohneKommentare(leseText('src/renderer/src/views/Operator.tsx'));
  ok(
    ober.includes('useBrueckenWert(MASTER_LINK_QUELLE)') && ober.includes('useBrueckenWert(FERNSTEUERUNG_QUELLE)') && ober.includes('useBrueckenWert(VERBUND_QUELLE)') &&
      ober.includes('window.jm?.speaker') && ober.includes('headerCenter={') && ober.includes('status={statusLeiste(stand)}'),
    'TI Live Tasten je Modus: Brücken, Speaker-Status, Kopfmitte und Statusleiste laufen in der View, auch bei geschlossenem Panel (G8)',
  );
  ok(!einst.includes('useEffect') && !/\bwindow\b/.test(einst), 'TI Live Tasten je Modus: views/Einstellungen.tsx ohne window und ohne useEffect (G7, G8)');
  ok(operator.includes('useAutoAdvance()') && !/connected: (true|false)/.test(ober), 'TI Live Tasten je Modus: useAutoAdvance läuft oberhalb des Modus in Operator.tsx');
  ok(leseText('src/renderer/src/App.tsx').includes('connect(resolveServerUrl(),'), 'TI Live Tasten je Modus: der Socket-Client wird weiter in App.tsx angeschlossen');
}
