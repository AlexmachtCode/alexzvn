// Stage Display: Die Ad-hoc-Nachricht steht in allen drei Ansichten (Countdown, Referent „ref“, Hauptansicht „main“).
// In den Presenter-Ansichten sitzt sie mittig in der Kopfzeile, ohne Programmpunkt als Ersatz (Spec 2026-11-06, Z. 48, 88–90).
// Render ohne Browser über renderToStaticMarkup unter tsx.
import { abschluss, enthaelt, enthaeltNicht, gleich, ok, render } from '@jm/ui/testhilfe';
import { StageScreen } from '@/components/StageScreen';
import { buehnenNachricht } from '@/lib/nachricht';
import { DEFAULT_COLORS, type StageState } from '@shared/types';

const JETZT = Date.UTC(2026, 10, 20, 9, 0, 0);

type Ansicht = 'countdown' | 'ref' | 'main';

function zustand(o: {
  ansicht?: Ansicht;
  message?: string;
  timerMessage?: string;
  blinking?: boolean;
  widgets?: Partial<StageState['config']['widgets']>;
  countdownLaeuft?: boolean;
} = {}): StageState {
  const ansicht = o.ansicht ?? 'countdown';
  const presenterAn = ansicht !== 'countdown';
  return {
    config: {
      timer: { enabled: true, host: '127.0.0.1', port: 1 },
      switcher: { enabled: true, host: '127.0.0.1', port: 2 },
      presenter: { enabled: true, host: '127.0.0.1', port: 3, pin: '', mode: ansicht === 'main' ? 'main' : 'ref' },
      widgets: { clock: true, timer: true, switcher: true, message: true, presenter: true, ...o.widgets },
      message: o.message ?? '',
      outputDisplayId: null,
    },
    timer: {
      connected: true,
      countdown: o.countdownLaeuft ? { durationMs: 300_000, delayMs: 0, startedAtMs: JETZT, pausedRemainingMs: null } : null,
      activeLabel: null,
      nextLabel: null,
      colors: DEFAULT_COLORS,
      message: o.timerMessage ?? '',
      blinking: o.blinking ?? false,
    },
    switcher: { connected: false, program: 0, preview: 0, recording: false, streaming: false, scenes: 0 },
    presenter: {
      connected: presenterAn,
      active: presenterAn,
      index: 0,
      total: 3,
      title: 'Folie',
      notes: '',
      nextTitle: null,
      screen: 'live',
      rev: 1,
    },
  };
}

/** Attribute des <div>, dessen einziges Kind `text` ist; sonst ''. */
function attrs(html: string, text: string): string {
  const maskiert = text.replace(/[.*+?^$()|[\]\{}]/g, '\\$&');
  const m = new RegExp(`<div([^>]*)>${maskiert}</div>`).exec(html);
  return m ? m[1] : '';
}

gleich(buehnenNachricht(zustand({ message: '  Bitte zum Ende kommen  ' })), { text: 'Bitte zum Ende kommen', blinkt: false }, 'Ad-hoc-Nachricht getrimmt, blinkt nicht');
gleich(buehnenNachricht(zustand({ timerMessage: 'Noch 2 Minuten', blinking: true })), { text: 'Noch 2 Minuten', blinkt: true }, 'nur Timer-Nachricht: blinkt mit dem Timer');
gleich(buehnenNachricht(zustand({ message: 'Ad hoc', timerMessage: 'Timer', blinking: true })), { text: 'Ad hoc', blinkt: false }, 'Ad-hoc vor Timer, blinkt nicht');
gleich(buehnenNachricht(zustand({ timerMessage: 'Timer', widgets: { timer: false } })), null, 'Anzeige-Element Timer aus: Timer-Nachricht zählt nicht');
gleich(buehnenNachricht(zustand({ message: 'Ad hoc', widgets: { message: false } })), null, 'Haken Nachricht aus: keine Nachricht');
gleich(buehnenNachricht(zustand({ message: ' \n ' })), null, 'nur Leerraum: keine Nachricht');
for (const ansicht of ['countdown', 'ref', 'main'] as const) {
  const html = render(<StageScreen state={zustand({ ansicht, message: 'Bitte zum Ende kommen' })} now={JETZT} />);
  enthaelt(html, 'Bitte zum Ende kommen', `${ansicht}: Ad-hoc-Nachricht sichtbar`);
  ok(/color:#FFE819/.test(attrs(html, 'Bitte zum Ende kommen')) && !attrs(html, 'Bitte zum Ende kommen').includes('jm-blink'), `${ansicht}: gelb, blinkt nicht`);
  const blink = render(<StageScreen state={zustand({ ansicht, timerMessage: 'Noch 2 Minuten', blinking: true })} now={JETZT} />);
  ok(attrs(blink, 'Noch 2 Minuten').includes('jm-blink') && attrs(blink, 'Noch 2 Minuten').includes('color:#F61C56'), `${ansicht}: blinkende Timer-Nachricht rot und blinkend`);
  const beide = render(<StageScreen state={zustand({ ansicht, message: 'Ad hoc', timerMessage: 'Timer', blinking: true })} now={JETZT} />);
  ok(!attrs(beide, 'Ad hoc').includes('jm-blink') && !beide.includes('>Timer<'), `${ansicht}: Ad-hoc gewinnt und blinkt nicht`);
  enthaeltNicht(render(<StageScreen state={zustand({ ansicht, message: 'Bitte zum Ende kommen', widgets: { message: false } })} now={JETZT} />), 'Bitte zum Ende kommen', `${ansicht}: Haken Nachricht aus blendet aus`);
  ok(render(<StageScreen state={zustand({ ansicht, message: ' \n ' })} now={JETZT} />) === render(<StageScreen state={zustand({ ansicht, message: '' })} now={JETZT} />), `${ansicht}: Leerraum rendert wie keine Nachricht`);
}
for (const ansicht of ['ref', 'main'] as const) {
  const lang = 'Bitte sofort zum Ende kommen, '.repeat(10).trim();
  const html = render(<StageScreen state={zustand({ ansicht, message: lang, countdownLaeuft: true })} now={JETZT} />);
  ok(/\btruncate\b/.test(attrs(html, lang)) && /\bmin-w-0\b/.test(attrs(html, lang)), `${ansicht}: Kopfzeile kürzt mit „…“ (truncate, min-w-0)`);
  enthaelt(html, '00:05:00', `${ansicht}: lange Nachricht verdrängt den Countdown nicht`);
}
const cd = render(<StageScreen state={zustand({ ansicht: 'countdown', message: 'Bitte zum Ende kommen' })} now={JETZT} />);
ok(!/\btruncate\b/.test(attrs(cd, 'Bitte zum Ende kommen')) && attrs(cd, 'Bitte zum Ende kommen').includes('word-break:break-word'), 'countdown: bricht um wie bisher, kürzt nicht');
abschluss();
