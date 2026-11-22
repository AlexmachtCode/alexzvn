// UX Welle 2a, Prompter d · Live-Bereich (Spec 3.4, 5.1; E4): die Vorschau immer sichtbar, darunter die vier Haupttasten als
// TallyButtons (GO/Pause, Anfang, Marke zurück, Marke vor), der Tempo-Regler im Live-Bereich (W2-8), der Hinweis zur Leertaste.
// Render ohne Browser.
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import type { AusgabeZustand } from '@jm/output-window/zustand';
import { DEFAULT_CONFIG, type PrompterState } from '@shared/types';
import { hauptTasten, PROMPTER_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';
import { HauptTasten, LiveBereich, liveTasten, type LiveAktionen } from '@/views/LiveBereich';
import { attr, ohneKommentare, tags, text } from './testzustand';

const T = PROMPTER_TEXTE;
const state = (playing: boolean, speed = DEFAULT_CONFIG.speed): PrompterState => ({
  config: { ...DEFAULT_CONFIG, speed },
  transport: { playing, anchorEm: 0, anchorAtMs: 0, emPerSec: 1 },
  remote: { running: false, urls: [] },
});
const OFFEN: AusgabeZustand = { art: 'offen', displayId: 1 };
const stand = (p: PrompterState | undefined, ausgabe?: AusgabeZustand | null): OberflaechenStand => ({ prompter: p, ausgabe, masterLink: undefined, fernsteuerung: undefined });
function aktionen(log: string[] = []): LiveAktionen {
  return {
    toggle: () => void log.push('toggle'),
    anfang: () => void log.push('anfang'),
    marke: (r) => void log.push(`marke${r}`),
    nudge: (d) => void log.push(`nudge${d}`),
    tempo: (v) => void log.push(`tempo${v}`),
  };
}
const zeile = (s: OberflaechenStand): string[] => liveTasten(s, aktionen()).map((t) => `${t.label}:${t.state}${t.shortcut ? `[${t.shortcut}]` : ''}`);

// ── PR Live Tasten: vier Haupttasten je Zustand ──
{
  gleich(
    [zeile(stand(state(false))), zeile(stand(state(true), undefined)), zeile(stand(state(true), OFFEN)), zeile(stand(state(false), OFFEN))],
    [
      ['GO:bereit[Leertaste]', 'Anfang:bereit[Pos1]', 'Marke zurück:bereit', 'Marke vor:bereit'],
      ['Pause:bereit[Leertaste]', 'Anfang:bereit[Pos1]', 'Marke zurück:bereit', 'Marke vor:bereit'],
      ['Pause:live[Leertaste]', 'Anfang:bereit[Pos1]', 'Marke zurück:bereit', 'Marke vor:bereit'],
      ['GO:bereit[Leertaste]', 'Anfang:bereit[Pos1]', 'Marke zurück:bereit', 'Marke vor:bereit'],
    ],
    'PR Live Tasten: vier Haupttasten (GO/Pause, Anfang, Marke zurück, Marke vor) aus hauptTasten; live nur bei scrollend und Talent-Monitor offen; Kürzel nur Leertaste und Pos1',
  );
  const s = stand(state(true), OFFEN);
  const soll = hauptTasten(s);
  gleich(
    liveTasten(s, aktionen()).map((t) => [t.label, t.state, t.shortcut, t.disabledReason]),
    [soll.go, soll.anfang, soll.markeZurueck, soll.markeVor].map((t) => [t.label, t.state, t.shortcut, t.disabledReason]),
    'PR Live Tasten: die Tasten sind genau die Ableitung hauptTasten (keine zweite Rechnung)',
  );
  const log: string[] = [];
  liveTasten(stand(state(false)), aktionen(log)).forEach((t) => t.onClick?.());
  gleich(log, ['toggle', 'anfang', 'marke-1', 'marke1'], 'PR Live Tasten: Klick ruft toggle, reset (Anfang) und jumpMarker -1 / +1 (Handler wie heute)');
  ok(liveTasten(stand(state(false)), aktionen()).every((t) => t.onPress === undefined && t.onRelease === undefined), 'PR Live Tasten: kein Halten, nur Klick');
}

// ── Gerendert: vier Tasten, aria-disabled und Grund sichtbar bei Sperre ──
{
  const html = render(<HauptTasten tasten={liveTasten(stand(state(false)), aktionen())} />);
  gleich(tags(html, 'button').length, 4, 'PR Live Tasten: gerendert genau vier TallyButtons');
  ok(html.includes('<kbd') && text(html).includes('Leertaste') && text(html).includes('Pos1'), 'PR Live Tasten: Kürzel „Leertaste“ und „Pos1“ stehen an den Tasten');
  const gesperrt = render(<HauptTasten tasten={[{ state: 'gesperrt', label: 'GO', disabledReason: 'Kein Skript vorhanden' }, { state: 'bereit', label: 'Anfang' }]} />);
  gleich(tags(gesperrt, 'button').map((t) => attr(t, 'aria-disabled')), ['true', undefined], 'PR Live Tasten: eine gesperrte Taste trägt aria-disabled');
  ok(text(gesperrt).includes('Kein Skript vorhanden'), 'PR Live Tasten: der Sperrgrund steht sichtbar neben der Taste');
  pruefeIdVerweise(html + gesperrt, 'PR Live Tasten: id-Verweise der Tasten gültig');
}

// ── R-T6a: die Tooltips „Voriger Abschnitt“ / „Nächster Abschnitt“ der Marken-Tasten (alter Wortlaut, OperatorView.tsx) ──
{
  const html = render(<HauptTasten tasten={liveTasten(stand(state(false)), aktionen())} />);
  const umhuellt = (titel: string, label: string): boolean =>
    new RegExp(`<div[^>]*\\stitle="${titel}"[^>]*><button[^>]*>(?:(?!</button>).)*${label}`, 's').test(html);
  ok(
    umhuellt('Voriger Abschnitt', 'Marke zurück') && umhuellt('Nächster Abschnitt', 'Marke vor'),
    'PR Live Tasten Tooltips: „Voriger Abschnitt“ umhüllt die Taste „Marke zurück“, „Nächster Abschnitt“ die Taste „Marke vor“ (R-T6a)',
  );
  gleich(
    tags(html, 'div').filter((t) => attr(t, 'title') !== undefined).map((t) => attr(t, 'title')),
    ['Voriger Abschnitt', 'Nächster Abschnitt'],
    'PR Live Tasten Tooltips: genau diese zwei Tooltips, GO/Pause und Anfang tragen keinen',
  );
  ok(T.tipps.markeZurueck === 'Voriger Abschnitt' && T.tipps.markeVor === 'Nächster Abschnitt', 'PR Live Tasten Tooltips: der alte Wortlaut steht in PROMPTER_TEXTE.tipps');
  ok(
    ohneKommentare(leseText('src/renderer/src/views/LiveBereich.tsx')).includes('title={tipp}') && !leseText('../../packages/ui/src/components/TallyButton.tsx').includes('Voriger Abschnitt'),
    'PR Live Tasten Tooltips: das umhüllende Element trägt den title, @jm/ui bleibt unverändert',
  );
}

// ── Live-Element ohne Klick sichtbar, Tempo im Live-Bereich, Hinweis ──
{
  const html = render(<LiveBereich state={state(false, 2.5)} stand={stand(state(false, 2.5))} aktionen={aktionen()} onMarkers={() => undefined} />);
  ok(html.includes('data-prompter="vorschau"') && html.includes('aspect-video'), 'PR Live Tasten: die Vorschau (16:9) steht ohne Klick da');
  ok(html.indexOf('data-prompter="vorschau"') < html.indexOf('data-state="bereit"'), 'PR Live Tasten: die Vorschau steht über den Haupttasten');
  const regler = tags(html, 'input').filter((t) => attr(t, 'type') === 'range');
  gleich(regler.map((t) => [attr(t, 'min'), attr(t, 'max'), attr(t, 'step'), attr(t, 'value')]), [['0.2', '6', '0.1', '2.5']], 'PR Live Tasten: genau ein Regler im Live-Bereich, das Tempo (0,2 bis 6, Schritt 0,1)');
  ok(text(html).includes(T.tempo.titel) && text(html).includes('2.5'), 'PR Live Tasten: der Tempo-Regler zeigt Namen und Wert');
  ok(text(html).includes('↑ zurück') && text(html).includes('↓ vor'), 'PR Live Tasten: die Nudge-Knöpfe ↑ zurück und ↓ vor (±3) bleiben normale Knöpfe');
  ok(text(html).includes(T.live.hinweis), 'PR Live Tasten: der Hinweis, dass die Leertaste außerhalb des Skripts geht, steht im Live-Bereich');
  ok(!text(html).includes('"') && !T.live.hinweis.includes('"'), 'PR Live Tasten: kein ASCII-Anführungszeichen in den gerenderten Texten');
  const quelle = ohneKommentare(leseText('src/renderer/src/views/LiveBereich.tsx'));
  ok(quelle.includes('aktionen.nudge(-3)') && quelle.includes('aktionen.nudge(3)') && quelle.includes('aktionen.tempo('), 'PR Live Tasten: Nudge ±3 und Tempo rufen die Aktionen');
  ok(!/\bwindow\b/.test(quelle.replace(/usePrompterHotkeys/g, '')), 'PR Live Tasten: LiveBereich liest kein window (die Aktionen kommen aus der View)');
}
