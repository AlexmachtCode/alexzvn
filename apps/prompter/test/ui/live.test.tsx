// UX Welle 2a, Prompter d · Live-Bereich (Spec 3.4, 5.1; E4): die Vorschau immer sichtbar, darunter die sechs Tasten des
// Transports als TallyButtons in der gewohnten Anordnung (Gesamtprüfung I1: oben Marke zurück, GO/Pause, Marke vor; unten ↑ zurück,
// Anfang, ↓ vor), der Tempo-Regler im Live-Bereich (W2-8), der Hinweis zur Leertaste. Render ohne Browser.
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import type { AusgabeZustand } from '@jm/output-window/zustand';
import { DEFAULT_CONFIG, type PrompterState } from '@shared/types';
import { hauptTasten, PROMPTER_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';
import { HauptTasten, LiveBereich, liveTasten, type LiveAktionen, type LiveTaste } from '@/views/LiveBereich';
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
const alleTasten = (s: OberflaechenStand, a: LiveAktionen = aktionen()): LiveTaste[] => liveTasten(s, a).flat();
const zeile = (s: OberflaechenStand): string[] => alleTasten(s).map(({ taste: t }) => `${t.label}:${t.state}${t.shortcut ? `[${t.shortcut}]` : ''}`);

// ── PR Live Tasten: sechs Tasten je Zustand, Reihe für Reihe (Marke zurück, GO/Pause, Marke vor · ↑ zurück, Anfang, ↓ vor) ──
{
  gleich(
    [zeile(stand(state(false))), zeile(stand(state(true), undefined)), zeile(stand(state(true), OFFEN)), zeile(stand(state(false), OFFEN))],
    [
      ['Marke zurück:bereit', 'GO:bereit[Leertaste]', 'Marke vor:bereit', '↑ zurück:bereit', 'Anfang:bereit[Pos1]', '↓ vor:bereit'],
      ['Marke zurück:bereit', 'Pause:bereit[Leertaste]', 'Marke vor:bereit', '↑ zurück:bereit', 'Anfang:bereit[Pos1]', '↓ vor:bereit'],
      ['Marke zurück:bereit', 'Pause:live[Leertaste]', 'Marke vor:bereit', '↑ zurück:bereit', 'Anfang:bereit[Pos1]', '↓ vor:bereit'],
      ['Marke zurück:bereit', 'GO:bereit[Leertaste]', 'Marke vor:bereit', '↑ zurück:bereit', 'Anfang:bereit[Pos1]', '↓ vor:bereit'],
    ],
    'PR Live Tasten: sechs Tasten; GO/Pause, Anfang und die Marken aus hauptTasten; live nur bei scrollend und Talent-Monitor offen; Kürzel nur Leertaste und Pos1',
  );
  gleich(
    liveTasten(stand(state(false)), aktionen()).map((r) => r.map((t) => t.id)),
    [
      ['markeZurueck', 'go', 'markeVor'],
      ['zurueck3', 'anfang', 'vor3'],
    ],
    'PR Live Tasten: zwei Reihen in Spaltenfolge wie vor dem Umbau (Ruling I1)',
  );
  const s = stand(state(true), OFFEN);
  const soll = hauptTasten(s);
  const nach = (id: LiveTaste['id']): LiveTaste['taste'] | undefined => alleTasten(s).find((t) => t.id === id)?.taste;
  gleich(
    [nach('go'), nach('anfang'), nach('markeZurueck'), nach('markeVor')].map((t) => [t?.label, t?.state, t?.shortcut, t?.disabledReason]),
    [soll.go, soll.anfang, soll.markeZurueck, soll.markeVor].map((t) => [t.label, t.state, t.shortcut, t.disabledReason]),
    'PR Live Tasten: GO/Pause, Anfang und die Marken sind genau die Ableitung hauptTasten (keine zweite Rechnung)',
  );
  const log: string[] = [];
  alleTasten(stand(state(false)), aktionen(log)).forEach(({ taste }) => taste.onClick?.());
  gleich(log, ['marke-1', 'toggle', 'marke1', 'nudge-3', 'anfang', 'nudge3'], 'PR Live Tasten: Klick ruft jumpMarker -1, toggle, jumpMarker +1, nudge -3, reset (Anfang), nudge +3 (Handler wie heute)');
  ok(alleTasten(stand(state(false))).every(({ taste: t }) => t.onPress === undefined && t.onRelease === undefined), 'PR Live Tasten: kein Halten, nur Klick');
}

// ── Gerendert: sechs Tasten, aria-disabled und Grund sichtbar bei Sperre ──
{
  const html = render(<HauptTasten tasten={liveTasten(stand(state(false)), aktionen())} />);
  gleich(tags(html, 'button').length, 6, 'PR Live Tasten: gerendert genau sechs TallyButtons');
  ok(html.includes('<kbd') && text(html).includes('Leertaste') && text(html).includes('Pos1'), 'PR Live Tasten: Kürzel „Leertaste“ und „Pos1“ stehen an den Tasten');
  const gesperrt = render(
    <HauptTasten
      tasten={[
        [
          { id: 'go', taste: { state: 'gesperrt', label: 'GO', disabledReason: 'Kein Skript vorhanden' } },
          { id: 'anfang', taste: { state: 'bereit', label: 'Anfang' } },
        ],
      ]}
    />,
  );
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

// ── PR Live Tastenplätze (Gesamtprüfung I1, Ruling: die gewohnte Anordnung der alten OperatorView.tsx) ──
// Reihe 1: Marke zurück | GO/Pause (breit, Mitte) | Marke vor; Reihe 2: ↑ zurück | Anfang | ↓ vor. „Anfang“ (an den Anfang und
// pausieren) liegt nie neben GO in Reihe 1. Geprüft am gerenderten Live-Bereich: je Reihe die Beschriftungen in Spaltenfolge und
// die Spaltenraster (GO doppelt so breit wie eine Marke, unten drei gleiche Spalten wie bisher).
{
  const html = render(<LiveBereich state={state(false)} stand={stand(state(false))} aktionen={aktionen()} onMarkers={() => undefined} />);
  const oben = html.indexOf('data-prompter="tasten-oben"');
  const unten = html.indexOf('data-prompter="tasten-unten"');
  const reihe = (von: number, bis?: number): string[] =>
    von < 0 ? [] : [...html.slice(von, bis).matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1]).replace(/Kürzel:.*$/, '').trim());
  gleich(
    [reihe(oben, unten < 0 ? undefined : unten), reihe(unten)],
    [
      ['Marke zurück', 'GO', 'Marke vor'],
      ['↑ zurück', 'Anfang', '↓ vor'],
    ],
    'PR Live Tastenplätze: Reihe 1 Marke zurück, GO, Marke vor; Reihe 2 ↑ zurück, Anfang, ↓ vor (wie vor dem Umbau)',
  );
  const klasse = (name: string): string => attr(tags(html, 'div').find((t) => attr(t, 'data-prompter') === name), 'class') ?? '';
  ok(
    oben >= 0 && unten > oben && klasse('tasten-oben').includes('grid-cols-[1fr_2fr_1fr]') && klasse('tasten-unten').includes('grid-cols-[1fr_1fr_1fr]'),
    'PR Live Tastenplätze: oben drei Spalten mit breitem GO in der Mitte (1:2:1), unten drei gleiche Spalten',
  );
  gleich(tags(html.slice(oben < 0 ? html.length : oben), 'button').length, 6, 'PR Live Tastenplätze: sechs Tasten unter der Vorschau, alle im Raster');
  // Im Lauf ist GO („LIVE“, „Pause“, Kürzel in 19 px) breiter als sein Platz (gemessen): Der Platz schneidet ab und hält das Raster
  // fest, damit nichts über einer Marke liegt oder ihr einen Klick wegnimmt; den abgeschnittenen Fokusring zeichnet er selbst.
  const goPlatz = attr(tags(html, 'div').find((t) => attr(t, 'data-taste') === 'go'), 'class') ?? '';
  ok(
    ['min-w-0', 'overflow-hidden', 'has-[:focus-visible]:outline-2', 'has-[:focus-visible]:outline-[var(--ring)]'].every((k) => goPlatz.split(' ').includes(k)),
    'PR Live Tastenplätze: der GO-Platz schneidet Überstand ab (kein Text über den Marken), das Raster bleibt fest, der Fokusring bleibt sichtbar',
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
  ok(text(html).includes('↑ zurück') && text(html).includes('↓ vor'), 'PR Live Tasten: ↑ zurück und ↓ vor (±3) stehen als Tasten in der unteren Reihe (Ruling I1)');
  ok(text(html).includes(T.live.hinweis), 'PR Live Tasten: der Hinweis, dass die Leertaste außerhalb des Skripts geht, steht im Live-Bereich');
  ok(!text(html).includes('"') && !T.live.hinweis.includes('"'), 'PR Live Tasten: kein ASCII-Anführungszeichen in den gerenderten Texten');
  const quelle = ohneKommentare(leseText('src/renderer/src/views/LiveBereich.tsx'));
  ok(quelle.includes('aktionen.nudge(-3)') && quelle.includes('aktionen.nudge(3)') && quelle.includes('aktionen.tempo('), 'PR Live Tasten: Nudge ±3 und Tempo rufen die Aktionen');
  ok(!/\bwindow\b/.test(quelle.replace(/usePrompterHotkeys/g, '')), 'PR Live Tasten: LiveBereich liest kein window (die Aktionen kommen aus der View)');
}
