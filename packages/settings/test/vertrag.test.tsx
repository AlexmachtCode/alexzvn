// Vertrag der Abschnitte (Spec 6.1, 7.2, 7.4) und Rahmen SectionFrame.
import { StatusPill } from '@jm/ui';
import { enthaelt, enthaeltNicht, gleich, ok, render } from '@jm/ui/testhilfe';
import {
  ABSCHNITT_TEXTE,
  abschnittStatusItem,
  fehlerStatus,
  hatFehler,
  istGesperrt,
  SectionFrame,
  st,
  STATUS_UNBEKANNT,
  type AbschnittZustand,
  type SectionBase,
} from '../src/index';
import { bewegungsVerstoesse, fallText, kreuz, sperrZaehlung } from './hilfe';

// ── Prüfschritt: tsx wendet `jsx: react-jsx` auch auf @jm/ui-Quellen an ──
// Die Komponente liegt in packages/ui/src, außerhalb dieses Pakets. Schlägt das fehl
// („React is not defined“), ist die Ursache zu melden, nicht zu umgehen.
{
  const html = render(<StatusPill state="ok" text="x" />);
  enthaelt(html, 'data-state="ok"', 'tsx: @jm/ui-Komponente aus einem settings-Test rendert');
}

// ── Vertrag ──
{
  gleich(STATUS_UNBEKANNT, { state: 'off', text: 'unbekannt' }, 'Vertrag: STATUS_UNBEKANNT = off/unbekannt (Spec 7.2)');
  ok(Object.isFrozen(STATUS_UNBEKANNT), 'Vertrag: STATUS_UNBEKANNT ist eingefroren');
  gleich(fehlerStatus('Port 8729 belegt'), { state: 'error', text: 'Fehler: Port 8729 belegt' }, 'Vertrag: fehlerStatus');
  gleich(st('warn', 'startet'), { state: 'warn', text: 'startet' }, 'Vertrag: st baut den Status');
  let geworfen = false;
  try {
    st('live' as AbschnittZustand, 'sendet');
  } catch {
    geworfen = true;
  }
  ok(geworfen, "Vertrag: st() lehnt 'live' zur Laufzeit ab (wirft, Spec 7.4)");
  ok(istGesperrt({ locked: 'Vom Master vorgegeben' }) && !istGesperrt({}) && !istGesperrt({ locked: '' }), 'Vertrag: istGesperrt – leerer Grund zählt nicht');
  ok(hatFehler({ error: 'x' }) && !hatFehler({}) && !hatFehler({ error: '' }), 'Vertrag: hatFehler – leerer Text zählt nicht');
  gleich<unknown>(
    ABSCHNITT_TEXTE,
    {
      imLauncherEinrichten: 'Im Launcher einrichten',
      anOhneRueckmeldung: 'an (ohne Rückmeldung)',
      aus: 'aus',
      gesperrtVomMaster: 'Vom Master vorgegeben',
      bitteWaehlen: '– bitte wählen –',
      nochNichtUebernommen: 'Noch nicht übernommen.',
    },
    'Vertrag: ABSCHNITT_TEXTE wörtlich (ohne Funktionen)',
  );
  ok(ABSCHNITT_TEXTE.gesperrt('Vom Master vorgegeben') === 'Gesperrt: Vom Master vorgegeben', 'Vertrag: Sperrtext „Gesperrt: {grund}“');

  const view: SectionBase = { id: 'ndi', status: { state: 'warn', text: 'an (ohne Rückmeldung)' } };
  gleich(
    abschnittStatusItem(view, { group: 'ausgabe', label: 'NDI' }),
    { id: 'ndi', group: 'ausgabe', label: 'NDI', state: 'warn', detail: 'an (ohne Rückmeldung)', settingsSection: 'ndi' },
    'Vertrag: abschnittStatusItem übernimmt id als settingsSection, state und Text',
  );
  gleich(
    abschnittStatusItem(view, { group: 'ausgabe', label: 'NDI', detail: 'JM Titler (REGIE-PC)' }).detail,
    'JM Titler (REGIE-PC)',
    'Vertrag: abschnittStatusItem – eigenes detail überschreibt den Statustext',
  );
  gleich(
    abschnittStatusItem({ id: 'iveo', status: STATUS_UNBEKANNT }, { group: 'verbindung', label: 'iveo' }).state,
    'off',
    'Vertrag: abschnittStatusItem – unbekannt bleibt off (nie ok)',
  );
}

// ── Testhilfen (test/hilfe.ts), auf die alle Abschnittstests bauen ──
{
  const k = kreuz({ a: [1, 2], b: ['x', undefined, 'z'] } as const);
  gleich(k.length, 6, 'Hilfe: kreuz liefert 2 × 3 = 6 Fälle');
  gleich(fallText(k[1]), 'a=1 b=undefined', 'Hilfe: fallText zeigt undefined');
  gleich(
    sperrZaehlung('<button disabled="">a</button><input disabled=""/><select></select><p>x</p>'),
    { alle: 3, gesperrt: 2 },
    'Hilfe: sperrZaehlung zählt button, input, select',
  );
  gleich(
    bewegungsVerstoesse(
      '<b class="a transition-colors"></b><i class="motion-safe:transition-colors"></i><u class="transition-opacity motion-reduce:transition-none"></u>',
    ),
    ['transition-colors'],
    'Hilfe: bewegungsVerstoesse findet transition ohne motion-safe und ohne motion-reduce:transition-none',
  );
}

// ── SectionFrame ──
const FELD = '<input data-feld="probe"/>';
function rahmen(view: SectionBase): string {
  return render(
    <SectionFrame view={view} titel="Probe-Abschnitt">
      <input data-feld="probe" />
    </SectionFrame>,
  );
}
{
  const html = rahmen({ id: 'probe', status: { state: 'ok', text: 'sendet' } });
  enthaelt(html, '<h3', 'SectionFrame: Titel als h3');
  enthaelt(html, '>Probe-Abschnitt</h3>', 'SectionFrame: Titel steht im h3');
  ok(html.indexOf('</h3>') < html.indexOf('data-state="ok"'), 'SectionFrame: StatusPill rechts neben dem Titel');
  enthaelt(html, '>sendet</span>', 'SectionFrame: Statustext in der Pille');
  enthaelt(html, 'id="einstellung-probe"', 'SectionFrame: Anker einstellung-<id>');
  enthaelt(html, 'data-section-id="probe"', 'SectionFrame: Anker trägt die Abschnitts-id');
  enthaeltNicht(html, 'data-gesperrt', 'SectionFrame: ohne locked kein Sperrtext');
  enthaeltNicht(html, 'data-fehler', 'SectionFrame: ohne error kein Fehlertext');
}
{
  const html = rahmen({ id: 'probe', status: { state: 'off', text: 'aus' }, locked: 'Vom Master vorgegeben' });
  enthaelt(html, '>Gesperrt: Vom Master vorgegeben</p>', 'SectionFrame locked: „Gesperrt: {grund}“ sichtbar');
  ok(html.indexOf('data-gesperrt="true"') > -1 && html.indexOf('data-gesperrt="true"') < html.indexOf(FELD), 'SectionFrame locked: Sperrtext vor den Feldern');
  enthaeltNicht(rahmen({ id: 'probe', status: { state: 'off', text: 'aus' }, locked: '' }), 'data-gesperrt', 'SectionFrame locked: leerer Grund zeigt nichts');
}
{
  const html = rahmen({ id: 'probe', status: fehlerStatus('Port belegt'), error: 'Port 8729 belegt' });
  enthaelt(html, '<span aria-hidden="true">⚠</span> Port 8729 belegt</p>', 'SectionFrame error: „⚠ {text}“, Symbol aria-hidden');
  ok(html.indexOf('data-fehler="true"') > html.indexOf(FELD), 'SectionFrame error: Fehlertext nach den Feldern');
  const beides = rahmen({ id: 'probe', status: fehlerStatus('x'), locked: 'Grund', error: 'Fehlertext' });
  ok(
    beides.indexOf('data-gesperrt') < beides.indexOf(FELD) && beides.indexOf(FELD) < beides.indexOf('data-fehler'),
    'SectionFrame: Reihenfolge Sperrgrund → Felder → Fehlertext',
  );
}
