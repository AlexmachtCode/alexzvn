// Task 11 · Toggle und Select (Spec 3.5, 6.2; E11, E13): Schalter mit role="switch" und Form statt nur Farbe; Auswahl
// nativ, ein fehlender gespeicherter Wert bleibt sichtbar gewählt („nicht verfügbar: …“) und springt nie still um.
import { Field } from '../src/components/Field';
import { Select } from '../src/components/Select';
import { Toggle } from '../src/components/Toggle';
import { gleich, ok, pruefeIdVerweise, render } from './harness';
import { attr, hatKlassen, tags, text, zwischen } from './lib/markup';

const nichts = (): void => undefined;
const OPTIONEN = [
  { value: 'mic-1', label: 'Mikro 1' },
  { value: 'mic-2', label: 'Mikro 2' },
];
/** Je Option [value, selected, disabled, Text]. */
const optionen = (html: string): Array<[string | undefined, boolean, boolean, string]> =>
  html
    .split('<option')
    .slice(1)
    .map((teil) => {
      const tag = `<option${teil.slice(0, teil.indexOf('>') + 1)}`;
      return [
        attr(tag, 'value'),
        attr(tag, 'selected') !== undefined,
        attr(tag, 'disabled') !== undefined,
        text(teil.slice(teil.indexOf('>') + 1, teil.indexOf('</option>'))),
      ];
    });

// ── Toggle ──
{
  const [an] = tags(render(<Toggle checked onChange={nichts} aria-label="Ausgabe" />), 'button');
  const [aus] = tags(render(<Toggle checked={false} onChange={nichts} aria-label="Ausgabe" />), 'button');
  ok(
    attr(an, 'type') === 'button' && attr(an, 'role') === 'switch' && attr(an, 'aria-checked') === 'true' &&
      attr(an, 'data-state') === 'an' && attr(aus, 'role') === 'switch' && attr(aus, 'aria-checked') === 'false' &&
      attr(aus, 'data-state') === 'aus',
    'Toggle: button type=button role=switch aria-checked true/false, data-state an/aus',
  );
  ok(
    hatKlassen(an, 'justify-end') && hatKlassen(aus, 'justify-start'),
    'Toggle: Knopf-Position als Form (rechts = an, links = aus), nicht nur Farbe',
  );
  ok(
    hatKlassen(an, 'h-[var(--control-h)] border-[var(--brand-yellow)] bg-[var(--tally-selected)]') &&
      attr(an, 'aria-label') === 'Ausgabe',
    'Toggle: h-[var(--control-h)], an = --tally-selected mit gelber Kante, aria-label durchgereicht',
  );
}
{
  const [k] = tags(render(<Toggle checked onChange={nichts} disabled aria-label="Ausgabe" />), 'button');
  ok(attr(k, 'disabled') === '', 'Toggle disabled: disabled-Attribut');
}
{
  const html = render(
    <Field label="Ausgabe" id="ndi-an" lockedReason="Vom Master vorgegeben">
      <Toggle checked onChange={nichts} />
    </Field>,
  );
  const [k] = tags(html, 'button');
  ok(
    attr(tags(html, 'label')[0], 'for') === 'ndi-an' && attr(k, 'id') === 'ndi-an' && attr(k, 'disabled') === '' &&
      attr(k, 'aria-describedby') === 'ndi-an-sperre',
    'Toggle in Field: label for → button id, Sperre setzt disabled und aria-describedby',
  );
  pruefeIdVerweise(html, 'Toggle in Field: alle id-Verweise gültig');
  const mitFehler = tags(
    render(
      <Field label="Ausgabe" id="ndi-an" error="NDI-Laufzeit fehlt">
        <Toggle checked onChange={nichts} />
      </Field>,
    ),
    'button',
  )[0];
  ok(
    attr(mitFehler, 'aria-invalid') === 'true' && attr(mitFehler, 'aria-describedby') === 'ndi-an-fehler',
    'Toggle in Field mit Fehler: aria-invalid=true, aria-describedby auf den Fehler',
  );
}

// ── Select ──
{
  const html = render(<Select options={OPTIONEN} value="mic-2" onChange={nichts} aria-label="Eingang" />);
  gleich(
    optionen(html),
    [
      ['mic-1', false, false, 'Mikro 1'],
      ['mic-2', true, false, 'Mikro 2'],
    ],
    'Select: Optionen aus selectOptionen, gewählter Wert selected',
  );
  const [sel] = tags(html, 'select');
  ok(hatKlassen(sel, 'h-[var(--control-h)] rounded-[var(--radius-md)]') && attr(sel, 'aria-label') === 'Eingang', 'Select: natives <select>, h-[var(--control-h)], aria-label');
}
{
  const mitLabel = render(
    <Select options={OPTIONEN} value="mic-9" fehlendLabel="USB-Mikro (alt)" onChange={nichts} aria-label="Eingang" />,
  );
  gleich(
    optionen(mitLabel),
    [
      ['mic-9', true, true, 'nicht verfügbar: USB-Mikro (alt)'],
      ['mic-1', false, false, 'Mikro 1'],
      ['mic-2', false, false, 'Mikro 2'],
    ],
    'Select fehlender Wert: erste Option „nicht verfügbar: …“ disabled und selected, übrige Liste unverändert',
  );
  const ohneLabel = render(<Select options={OPTIONEN} value="mic-9" onChange={nichts} aria-label="Eingang" />);
  gleich(optionen(ohneLabel)[0], ['mic-9', true, true, 'nicht verfügbar: mic-9'], 'Select fehlender Wert ohne fehlendLabel: „nicht verfügbar: {value}“');
}
{
  const mit = render(<Select options={OPTIONEN} value="" placeholder="Gerät wählen" onChange={nichts} aria-label="Eingang" />);
  gleich(optionen(mit)[0], ['', true, false, 'Gerät wählen'], 'Select: placeholder bei value \'\'');
  const ohne = render(<Select options={OPTIONEN} value="" onChange={nichts} aria-label="Eingang" />);
  gleich(optionen(ohne)[0], ['', true, false, '– bitte wählen –'], 'Select: value \'\' ohne placeholder → „– bitte wählen –“ statt still der ersten Option');
  const standard = render(
    <Select options={[{ value: '', label: 'System-Standard' }, ...OPTIONEN]} value="" onChange={nichts} aria-label="Ausgang" />,
  );
  gleich(
    optionen(standard).map((o) => o[3]),
    ['System-Standard', 'Mikro 1', 'Mikro 2'],
    'Select: gibt es eine Option \'\' (z. B. System-Standard), kommt kein Platzhalter dazu',
  );
}
{
  const html = render(
    <Field label="Eingang" id="eingang" error="Gerät nicht gefunden">
      <Select options={OPTIONEN} value="mic-1" onChange={nichts} />
    </Field>,
  );
  const [sel] = tags(html, 'select');
  ok(
    attr(sel, 'id') === 'eingang' && attr(sel, 'aria-describedby') === 'eingang-fehler' && attr(sel, 'aria-invalid') === 'true',
    'Select in Field: id, aria-describedby und aria-invalid',
  );
  pruefeIdVerweise(html, 'Select in Field: alle id-Verweise gültig');
  const gesperrt = render(
    <Field label="Eingang" id="eingang" lockedReason="Vom Master vorgegeben">
      <Select options={OPTIONEN} value="mic-1" onChange={nichts} />
    </Field>,
  );
  ok(
    attr(tags(gesperrt, 'select')[0], 'disabled') === '' &&
      text(zwischen(gesperrt, 'id="eingang-sperre"', '</p>').replace(/^[^>]*>/, '')) === 'Gesperrt: Vom Master vorgegeben',
    'Select in Field mit Sperre: disabled und Sperrgrund',
  );
}
