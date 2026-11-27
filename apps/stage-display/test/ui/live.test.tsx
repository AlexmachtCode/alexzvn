// UX Welle 2a, Stage-Display d · Live-Bereich (Spec 3.4, 5.1; E4, W2-8): die Vorschau unverändert und immer sichtbar, direkt darunter
// das Nachricht-Feld und die Schalterreihe der Anzeige-Elemente, zuletzt die eine Haupttaste „Bühnenschirm“. Render ohne Browser.
import { Button, TextInput } from '@jm/ui';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import type { AusgabeZustand } from '@jm/output-window/zustand';
import type { PartialStageConfig, StageState } from '@shared/types';
import { baueAktionen } from '@/lib/aktionen';
import { buehnenschirmTaste, STAGE_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';
import { LiveBereich, liveTaste, VORSCHAU_MAX_BREITE, type LiveAktionen } from '@/views/LiveBereich';
import { attr, elemente, ohneKommentare, stageZustand, tags, text } from './testzustand';

const T = STAGE_TEXTE;
const stand = (ausgabe?: AusgabeZustand | null): OberflaechenStand => ({ stage: stageZustand(), ausgabe, masterLink: undefined });
function aktionen(log: string[] = []): LiveAktionen {
  return {
    ausgabeUmschalten: (an) => void log.push(`ausgabe${an}`),
    entwurf: (t) => void log.push(`entwurf${t}`),
    senden: (t) => void log.push(`senden${t}`),
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
  const state = stageZustand({
    config: { message: 'Auf der Bühne', nachrichtEntwurf: 'Bitte Plätze einnehmen', widgets: { clock: true, timer: false, switcher: true, message: true, presenter: false } },
  });
  const html = render(<LiveBereich state={state} stand={stand({ art: 'offen', displayId: 1 })} now={0} aktionen={aktionen()} />);
  ok(html.includes('data-stage="vorschau"') && html.includes('aspect-video'), 'SD Live: die Vorschau (16:9, StageScreen) steht ohne Klick da');
  const [feld] = tags(html, 'input').filter((t) => attr(t, 'type') === 'text');
  gleich(
    [attr(feld, 'value'), attr(feld, 'placeholder')],
    ['Bitte Plätze einnehmen', 'z. B. „Bitte Plätze einnehmen“ — leer = Timer-Nachricht'],
    'SD-1 Live: das Nachricht-Feld zeigt den Entwurf (nicht die Nachricht auf der Bühne) und trägt den alten Platzhalter',
  );
  const senden = tags(html, 'button').filter((t) => attr(t, 'type') === 'submit');
  ok(senden.length === 1 && /<button[^>]*type="submit"[^>]*>Senden<\/button>/.test(html) && /<form[^>]*data-stage="nachricht"/.test(html), 'SD-1 Live: im Formular data-stage="nachricht" steht genau ein Knopf „Senden“ (type submit)');
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

// ── SD Live Höhe: die Vorschau ist nach der Fensterhöhe gedeckelt, damit die Haupttaste ohne Scrollen sichtbar bleibt ──
{
  const html = render(<LiveBereich state={stageZustand()} stand={stand()} now={0} aktionen={aktionen()} />);
  const [rahmen] = tags(html, 'div').filter((t) => attr(t, 'data-stage') === 'vorschau');
  ok(
    VORSCHAU_MAX_BREITE === 'max(20rem, calc((100vh - 360px) * 16 / 9))' && /100vh/.test(attr(rahmen, 'style') ?? '') && (attr(rahmen, 'style') ?? '').includes('max-width:'),
    'SD Live Höhe: der Vorschau-Rahmen trägt max-width aus der Fensterhöhe (100vh), damit die Haupttaste bei 1080×760 ohne Scrollen sichtbar ist',
  );
  ok((attr(rahmen, 'class') ?? '').includes('aspect-video') && (attr(rahmen, 'class') ?? '').includes('mx-auto'), 'SD Live Höhe: das Seitenverhältnis 16:9 bleibt, die Vorschau steht mittig');
}

// ── SD-1 (Altfehler Stufe 2): die Nachricht ist ein Entwurf; auf die Bühne kommt sie erst mit „Senden“ oder Enter (Formular),
// leer senden nimmt sie herunter (C6). Baum der View ohne Hooks, Aktionen über baueAktionen mit einer setConfig-Attrappe ──
{
  const log: string[] = [];
  const a = baueAktionen({
    outputDisplayId: null,
    setConfig: async (p: PartialStageConfig) => void log.push(`setConfig${JSON.stringify(p)}`),
    openOutput: async () => undefined,
    closeOutput: async () => undefined,
  });
  const baum = (st: StageState) => elemente(LiveBereich({ state: st, stand: stand(), now: 0, aktionen: a }));
  const formular = (b: ReturnType<typeof baum>) => b.find((e) => e.type === 'form' && e.props['data-stage'] === 'nachricht');
  const absenden = (b: ReturnType<typeof baum>): number => {
    let verhindert = 0;
    (formular(b)?.props.onSubmit as ((e: { preventDefault(): void }) => void) | undefined)?.({ preventDefault: () => void verhindert++ });
    return verhindert;
  };
  const b = baum(stageZustand({ config: { message: 'Auf der Bühne', nachrichtEntwurf: 'Pause 5 Min' } }));
  const feld = b.find((e) => e.type === TextInput);
  const knopf = b.find((e) => e.type === Button && e.props.type === 'submit');
  ok(formular(b) !== undefined && knopf?.props.children === T.live.senden && T.live.senden === 'Senden', 'SD-1 Live: Formular data-stage="nachricht" mit einem Knopf „Senden“ (type submit, STAGE_TEXTE.live.senden)');
  gleich(feld?.props.value, 'Pause 5 Min', 'SD-1 Live: das Feld zeigt den Entwurf, nicht message');
  (feld?.props.onChange as ((t: string) => void) | undefined)?.('Pause');
  gleich(log, ['setConfig{"nachrichtEntwurf":"Pause"}'], 'SD-1 Live: Tippen schreibt nur den Entwurf (setConfig nachrichtEntwurf), die Bühne bleibt');
  log.length = 0;
  const verhindert = absenden(b);
  gleich([verhindert, log], [1, ['setConfig{"message":"Pause 5 Min"}']], 'SD-1 Live: Senden (Enter oder Knopf) verhindert das Neuladen und schickt den Entwurf als message auf die Bühne');
  log.length = 0;
  absenden(baum(stageZustand({ config: { message: 'Auf der Bühne', nachrichtEntwurf: '' } })));
  absenden(baum(stageZustand({ config: { message: 'Auf der Bühne' } })));
  gleich(log, ['setConfig{"message":""}', 'setConfig{"message":""}'], 'SD-1 Live: Senden mit leerem (oder fehlendem) Entwurf nimmt die Nachricht von der Bühne (C6)');
  ok(baum(stageZustand({ config: { message: 'Auf der Bühne' } })).find((e) => e.type === TextInput)?.props.value === '', 'SD-1 Live: ohne Entwurf ist das Feld leer, auch wenn eine Nachricht auf der Bühne steht');
}

// ── SD Live: Verdrahtung im Quelltext ──
{
  const q = ohneKommentare(leseText('src/renderer/src/views/LiveBereich.tsx'));
  ok(
    q.includes('onChange={aktionen.entwurf}') && q.includes('value={c.nachrichtEntwurf ?? \'\'}') && q.includes('aktionen.senden(c.nachrichtEntwurf ?? \'\')') && q.includes('aktionen.widget(key, an)'),
    'SD-1 Live: das Feld schreibt den Entwurf (Altfehler SD-1), das Formular sendet ihn, die Schalter rufen die Aktionen',
  );
  ok(!/onKeyDown|keydown|addEventListener/.test(q), 'SD-1 Wächter: LiveBereich.tsx hat keinen Tastenhörer; Enter im Feld schickt das Formular ab (Nr. 80)');
  ok(!/\bwindow\b/.test(q) && !q.includes('useStage'), 'SD Live: LiveBereich liest kein window und keinen Store (die Aktionen kommen aus der View)');
  ok(!q.includes('<select') && !q.includes('type="checkbox"'), 'SD Live: keine eigenen Auswahl- und Kontrollkästchen mehr');
  const ober = ohneKommentare(leseText('src/renderer/src/views/StageOberflaeche.tsx'));
  ok(ober.includes('<LiveBereich') && !/panelOffen\s*(\?|&&)[^;\n]*<LiveBereich/.test(ober), 'SD Live: der Live-Bereich hängt nie am Panelzustand');
}
