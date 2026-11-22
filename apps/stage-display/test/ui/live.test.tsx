// UX Welle 2a, Stage-Display d · Live-Bereich (Spec 3.4, 5.1; E4, W2-8): die Vorschau unverändert und immer sichtbar, direkt darunter
// das Nachricht-Feld und die Schalterreihe der Anzeige-Elemente, zuletzt die eine Haupttaste „Bühnenschirm“. Render ohne Browser.
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import type { AusgabeZustand } from '@jm/output-window/zustand';
import { buehnenschirmTaste, STAGE_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';
import { LiveBereich, liveTaste, type LiveAktionen } from '@/views/LiveBereich';
import { attr, ohneKommentare, stageZustand, tags, text } from './testzustand';

const T = STAGE_TEXTE;
const stand = (ausgabe?: AusgabeZustand | null): OberflaechenStand => ({ stage: stageZustand(), ausgabe, masterLink: undefined });
function aktionen(log: string[] = []): LiveAktionen {
  return {
    ausgabeUmschalten: (an) => void log.push(`ausgabe${an}`),
    nachricht: (t) => void log.push(`nachricht${t}`),
    widget: (k, an) => void log.push(`widget${k}${an}`),
  };
}
const ZUSTAENDE: Array<[string, AusgabeZustand | null | undefined]> = [
  ['unbekannt', undefined],
  ['keine Brücke', null],
  ['zu', { art: 'zu', displayId: null }],
  ['offen', { art: 'offen', displayId: 1 }],
  ['Bildschirm fehlt', { art: 'bildschirm-fehlt', displayId: 5 }],
  ['abgestürzt', { art: 'abgestuerzt', displayId: 1 }],
];

// ── SD Live Taste: die eine Haupttaste je Zustand ──
{
  gleich(
    ZUSTAENDE.map(([, z]) => {
      const t = liveTaste(stand(z), aktionen());
      return `${t.label}:${t.state}`;
    }),
    [
      'Vollbild-Ausgabe öffnen:bereit',
      'Vollbild-Ausgabe öffnen:bereit',
      'Vollbild-Ausgabe öffnen:bereit',
      'Ausgabe schließen:live',
      'Ausgabe schließen:bereit',
      'Ausgabe schließen:bereit',
    ],
    'SD Live Taste: „Bühnenschirm“ öffnet, solange kein Fenster da ist, und schließt sonst; live nur bei gemessen offenem Schirm (E4)',
  );
  const s = stand({ art: 'offen', displayId: 1 });
  const soll = buehnenschirmTaste(s);
  const ist = liveTaste(s, aktionen());
  gleich([ist.label, ist.state, ist.disabledReason, ist.shortcut], [soll.label, soll.state, soll.disabledReason, undefined], 'SD Live Taste: die Taste ist genau die Ableitung buehnenschirmTaste, ohne Kürzel');
  const log: string[] = [];
  for (const [, z] of ZUSTAENDE) liveTaste(stand(z), aktionen(log)).onClick?.();
  gleich(log, ['ausgabetrue', 'ausgabetrue', 'ausgabetrue', 'ausgabefalse', 'ausgabefalse', 'ausgabefalse'], 'SD Live Taste: Klick öffnet bei unbekannt, keiner Brücke und zu, und schließt bei offen, Bildschirm fehlt und abgestürzt');
  ok(liveTaste(stand(), aktionen()).onPress === undefined && liveTaste(stand(), aktionen()).onRelease === undefined, 'SD Live Taste: kein Halten, nur Klick');
  ok(T.taste.oeffnen === 'Vollbild-Ausgabe öffnen' && T.taste.schliessen === 'Ausgabe schließen', 'SD Live Taste: die Beschriftungen sind der alte Wortlaut der Knöpfe');
}

// ── SD Live: ohne Klick sichtbar, Reihenfolge, Beschriftungen wie bisher ──
{
  const state = stageZustand({ config: { message: 'Bitte Plätze einnehmen', widgets: { clock: true, timer: false, switcher: true, message: true, presenter: false } } });
  const html = render(<LiveBereich state={state} stand={stand({ art: 'offen', displayId: 1 })} now={0} aktionen={aktionen()} />);
  ok(html.includes('data-stage="vorschau"') && html.includes('aspect-video'), 'SD Live: die Vorschau (16:9, StageScreen) steht ohne Klick da');
  const [feld] = tags(html, 'input').filter((t) => attr(t, 'type') === 'text');
  gleich(
    [attr(feld, 'value'), attr(feld, 'placeholder')],
    ['Bitte Plätze einnehmen', 'z. B. „Bitte Plätze einnehmen“ — leer = Timer-Nachricht'],
    'SD Live: das Nachricht-Feld zeigt den Text der Konfiguration und trägt den alten Platzhalter',
  );
  const schalter = tags(html, 'button').filter((t) => attr(t, 'role') === 'switch');
  gleich(schalter.map((t) => attr(t, 'aria-checked')), ['true', 'false', 'true', 'false', 'true'], 'SD Live: fünf Schalter (Uhr, Timer, Switcher, Presenter, Nachricht) folgen widgets');
  const t = text(html);
  ok(
    ['Vorschau', 'Anzeige-Elemente', 'Nachricht (Ad-hoc, hat Vorrang vor Timer-Nachricht)', 'Uhr', 'Timer/Countdown', 'Switcher-Status', 'Presenter (REF)'].every((w) => t.includes(w)),
    'SD Live: Überschriften und Beschriftungen der Schalter wie bisher',
  );
  const i = (s: string): number => html.indexOf(s);
  ok(
    i('data-stage="vorschau"') < i('data-stage="nachricht"') && i('data-stage="nachricht"') < i('data-stage="elemente"') && i('data-stage="elemente"') < i('data-stage="haupttaste"'),
    'SD Live: Reihenfolge Vorschau, Nachricht-Feld, Schalterreihe, Haupttaste',
  );
  ok(t.includes('Ausgabe schließen') && html.includes('data-state="live"'), 'SD Live: die Haupttaste zeigt bei offenem Schirm „Ausgabe schließen“ und ist live');
  ok(!t.includes('"'), 'SD Live: kein ASCII-Anführungszeichen in den gerenderten Texten');
  pruefeIdVerweise(html, 'SD Live: id-Verweise gültig');
}

// ── SD Live: Verdrahtung im Quelltext ──
{
  const q = ohneKommentare(leseText('src/renderer/src/views/LiveBereich.tsx'));
  ok(q.includes('onChange={aktionen.nachricht}') && q.includes('aktionen.widget(key, an)'), 'SD Live: Nachricht (jeder Tastendruck) und Schalter rufen die Aktionen');
  ok(!/\bwindow\b/.test(q) && !q.includes('useStage'), 'SD Live: LiveBereich liest kein window und keinen Store (die Aktionen kommen aus der View)');
  ok(!q.includes('<select') && !q.includes('type="checkbox"'), 'SD Live: keine eigenen Auswahl- und Kontrollkästchen mehr');
  const ober = ohneKommentare(leseText('src/renderer/src/views/StageOberflaeche.tsx'));
  ok(ober.includes('<LiveBereich') && !/panelOffen\s*(\?|&&)[^;\n]*<LiveBereich/.test(ober), 'SD Live: der Live-Bereich hängt nie am Panelzustand');
}
