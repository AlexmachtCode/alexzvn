// Task 10 · Field, TextInput, NumberInput (Spec 3.5, 3.8; E12, E13): Beschriftung, Hilfe, Sperrgrund und Fehler sind
// per id verknüpft (aria-describedby in fester Reihenfolge), Fehler setzt aria-invalid, Sperre setzt disabled.
import { Field } from '../src/components/Field';
import { NumberInput, NumberInputAnsicht, zahlAnsichtHandler, zahlFeldHandler, zahlTaste } from '../src/components/NumberInput';
import { TextInput } from '../src/components/TextInput';
import { zahlEntwurfAus, zahlSchritt, type ZahlEreignis } from '../src/lib/eingabe';
import { STATUS_SYMBOL_KLASSE } from '../src/lib/status';
import { gleich, leseText, ok, pruefeIdVerweise, render } from './harness';
import { attr, hatKlassen, tags, text, zwischen } from './lib/markup';

const nichts = (): void => undefined;
/** Text des Elements mit dieser id (Inhalt bis zum ersten schließenden Tag `ende`). */
const textVonId = (html: string, id: string, ende = '</p>'): string =>
  text(zwischen(html, `id="${id}"`, ende).replace(/^[^>]*>/, ''));

// ── Field ──
{
  const html = render(
    <Field label="Quellenname" id="ndi-name">
      <TextInput value="JM Titler" onChange={nichts} />
    </Field>,
  );
  const [label] = tags(html, 'label');
  const [input] = tags(html, 'input');
  ok(
    attr(label, 'for') === 'ndi-name' && attr(input, 'id') === 'ndi-name' && text(html) === 'Quellenname',
    'Field: label for = input id',
  );
  ok(hatKlassen(label, 'text-xs font-semibold text-[var(--foreground)]'), 'Field: ein Beschriftungsstil (text-xs, halbfett, Vordergrund)');
  ok(
    attr(input, 'aria-describedby') === undefined && attr(input, 'aria-invalid') === undefined && attr(input, 'disabled') === undefined,
    'Field ohne Hilfe, Sperre, Fehler: keine Verweise, kein aria-invalid, nicht gesperrt',
  );
}
{
  const html = render(
    <Field label="Port" id="port" hint="Standard 8729" lockedReason="Vom Master vorgegeben" error="Port belegt">
      <TextInput value="8729" onChange={nichts} />
    </Field>,
  );
  gleich(
    attr(tags(html, 'input')[0], 'aria-describedby'),
    'port-hilfe port-sperre port-fehler',
    'Field: aria-describedby Reihenfolge Hilfe, Sperre, Fehler',
  );
  pruefeIdVerweise(html, 'Field: alle id-Verweise gültig');
}
{
  const html = render(
    <Field label="Port" id="port" error="Port belegt">
      <TextInput value="8729" onChange={nichts} />
    </Field>,
  );
  ok(
    attr(tags(html, 'input')[0], 'aria-invalid') === 'true' &&
      textVonId(html, 'port-fehler') === '⚠ Port belegt' &&
      html.includes(`<span aria-hidden="true" class="${STATUS_SYMBOL_KLASSE.error}">⚠</span>`),
    'Field Fehler: aria-invalid=true, „⚠ {text}“ mit ⚠ in Fehlerfarbe',
  );
}
{
  const html = render(
    <Field label="Ordner" id="ordner" lockedReason="Vom Master vorgegeben">
      <TextInput value="D:/Show" onChange={nichts} disabled={false} />
    </Field>,
  );
  ok(
    attr(tags(html, 'input')[0], 'disabled') === '' && textVonId(html, 'ordner-sperre') === 'Gesperrt: Vom Master vorgegeben',
    'Field Sperre: disabled + „Gesperrt: {grund}“ (auch gegen disabled={false} der Eingabe)',
  );
  const leer = render(
    <Field label="Ordner" id="ordner" lockedReason="">
      <TextInput value="D:/Show" onChange={nichts} />
    </Field>,
  );
  ok(
    attr(tags(leer, 'input')[0], 'disabled') === undefined && !leer.includes('ordner-sperre') && !leer.includes('Gesperrt'),
    'Field mit leerem Sperrgrund: nicht gesperrt, kein Sperrtext (gesperrt nie ohne Grund)',
  );
}
{
  const html = render(
    <Field label="Name">
      <TextInput value="" onChange={nichts} />
    </Field>,
  );
  const id = attr(tags(html, 'input')[0], 'id') ?? '';
  ok(id !== '' && attr(tags(html, 'label')[0], 'for') === id, 'Field ohne id-Prop: eigene id (useId), label for passt');
}

// ── TextInput ──
{
  const html = render(<TextInput value="x" onChange={nichts} />);
  const [input] = tags(html, 'input');
  ok(
    attr(input, 'type') === 'text' &&
      hatKlassen(
        input,
        'h-[var(--control-h)] rounded-[var(--radius-md)] select-text focus-visible:outline-2 focus-visible:outline-[var(--ring)]',
      ),
    'TextInput: h-[var(--control-h)], Fokus-Ring, select-text',
  );
}
{
  const html = render(<TextInput value="" onChange={nichts} id="suche" aria-label="Suche" placeholder="Name" />);
  const [input] = tags(html, 'input');
  ok(
    attr(input, 'id') === 'suche' && attr(input, 'aria-label') === 'Suche' && attr(input, 'placeholder') === 'Name',
    'TextInput ohne Field: id, aria-label und placeholder durchgereicht',
  );
}

// ── NumberInput ──
{
  const html = render(
    <Field label="Port" id="port" hint="1–65535">
      <NumberInput value={8729} onChange={nichts} unit="TCP" ganzzahl min={1} max={65535} />
    </Field>,
  );
  const [input] = tags(html, 'input');
  ok(
    textVonId(html, 'port-einheit', '</span>') === 'TCP' &&
      (attr(input, 'aria-describedby') ?? '').split(' ').includes('port-einheit'),
    'NumberInput: Einheit sichtbar und in aria-describedby',
  );
  ok(attr(input, 'inputMode') === 'numeric' && attr(input, 'value') === '8729', 'NumberInput: inputMode numeric bei ganzzahl, Startwert 8729');
  ok(hatKlassen(input, 'h-[var(--control-h)] tabular'), 'NumberInput: h-[var(--control-h)], tabular');
  pruefeIdVerweise(html, 'NumberInput in Field: alle id-Verweise gültig');
}
{
  const html = render(
    <Field label="Port" id="p" hint="1–65535" lockedReason="Vom Master vorgegeben" error="Port belegt">
      <NumberInput value={8729} onChange={nichts} unit="TCP" ganzzahl />
    </Field>,
  );
  const [input] = tags(html, 'input');
  gleich(
    [attr(input, 'disabled'), attr(input, 'aria-invalid'), attr(input, 'aria-describedby')],
    ['', 'true', 'p-hilfe p-sperre p-fehler p-einheit'],
    'NumberInput in Field mit Hilfe, Sperre und Fehler: disabled, aria-invalid, aria-describedby Hilfe → Sperre → Fehler → Einheit',
  );
}
{
  const komma = tags(render(<NumberInput value={1.5} onChange={nichts} aria-label="Verzögerung" />), 'input')[0];
  const leer = tags(render(<NumberInput value={null} onChange={nichts} aria-label="Verzögerung" />), 'input')[0];
  ok(
    attr(komma, 'value') === '1,5' && attr(komma, 'inputMode') === 'decimal' && attr(komma, 'aria-label') === 'Verzögerung' &&
      attr(leer, 'value') === '',
    'NumberInput: Startwert zahlText(value) („1,5“), null → leer, inputMode decimal',
  );
}
{
  const html = render(
    <Field label="Port" id="port">
      <NumberInputAnsicht
        entwurf={{ text: 'abc', fehler: 'Bitte eine Zahl eingeben.', geaendert: true }}
        onTippen={nichts}
        onUebernehmen={nichts}
        onTaste={nichts}
        ganzzahl
      />
    </Field>,
  );
  const [input] = tags(html, 'input');
  const fehlerId = (attr(input, 'aria-describedby') ?? '').split(' ').find((id) => id.endsWith('-zahlfehler')) ?? '-';
  ok(
    attr(input, 'value') === 'abc' && attr(input, 'aria-invalid') === 'true' && textVonId(html, fehlerId) === '⚠ Bitte eine Zahl eingeben.',
    'NumberInput ungültiger Entwurf: Text bleibt, aria-invalid, „⚠ Bitte eine Zahl eingeben.“ direkt unter dem Feld',
  );
  pruefeIdVerweise(html, 'NumberInput ungültiger Entwurf: alle id-Verweise gültig');
}
{
  const protokoll: string[] = [];
  const taste = (key: string) => ({
    key,
    stopPropagation: () => void protokoll.push('stop'),
    preventDefault: () => void protokoll.push('prevent'),
  });
  // Mit der echten Entwurfs-Logik (Task 7): Wert 8729, getippt „80“.
  let z = zahlSchritt(zahlEntwurfAus(8729), { art: 'tippen', text: '80' }, {}, 8729).z;
  const schritt = (e: ZahlEreignis) => {
    protokoll.push(e.art);
    const r = zahlSchritt(z, e, {}, 8729);
    z = r.z;
    return r;
  };
  zahlTaste(taste('Escape'), schritt);
  gleich(
    [protokoll, z.text],
    [['verwerfen', 'stop', 'prevent'], '8729'],
    'NumberInput: Escape mit geändertem Entwurf verwirft und verbraucht die Taste (Panel bleibt offen)',
  );
  protokoll.length = 0;
  zahlTaste(taste('Escape'), schritt);
  gleich(protokoll, ['verwerfen'], 'NumberInput: Escape ohne Änderung bleibt frei (Panel darf schließen)');
  protokoll.length = 0;
  zahlTaste(taste('Enter'), schritt);
  zahlTaste(taste('a'), schritt);
  gleich(protokoll, ['uebernehmen'], 'NumberInput: Enter übernimmt, andere Tasten tun nichts');
}

// ── Bindung: die Handler am <input> und der Weg zu zahlSchritt (Effekte laufen nur im Browser) ──
{
  const protokoll: string[] = [];
  const h = zahlFeldHandler({
    onTippen: (t) => void protokoll.push(`tippen ${t}`),
    onUebernehmen: () => void protokoll.push('uebernehmen'),
    onTaste: (e) => void protokoll.push(`taste ${e.key}`),
  });
  h.onChange({ currentTarget: { value: '80' } });
  h.onBlur();
  h.onKeyDown({ key: 'Escape', stopPropagation: nichts, preventDefault: nichts });
  gleich(protokoll, ['tippen 80', 'uebernehmen', 'taste Escape'], 'NumberInput Feld-Handler: Tippen, Verlassen (onBlur) und Tasten (onKeyDown) erreichen die Ansicht');
}
{
  const ereignisse: string[] = [];
  let gestoppt = false;
  const h = zahlAnsichtHandler((e) => {
    ereignisse.push(e.art === 'tippen' ? `tippen ${e.text}` : e.art);
    return { verbraucht: e.art === 'verwerfen' };
  });
  h.onTippen('81');
  h.onUebernehmen();
  h.onTaste({ key: 'Escape', stopPropagation: () => void (gestoppt = true), preventDefault: nichts });
  gleich([ereignisse, gestoppt], [['tippen 81', 'uebernehmen', 'verwerfen'], true], 'NumberInput Ansicht-Handler: jedes Ereignis als zahlSchritt, Escape über zahlTaste');
}
{
  const quelle = leseText('src/components/NumberInput.tsx');
  const fehlt = [
    '{...zahlFeldHandler({ onTippen, onUebernehmen, onTaste })}',
    '{...zahlAnsichtHandler(schritt)}',
    "schrittRef.current({ art: 'aussen', wert: value });",
    "starteFrist(() => schrittRef.current({ art: 'frist' }))",
  ].filter((z) => quelle.split(z).length !== 2);
  const input = quelle.slice(quelle.indexOf('<input'), quelle.indexOf('/>', quelle.indexOf('<input')));
  ok(fehlt.length === 0 && !/\son[A-Z]\w*=\{/.test(input), 'NumberInput Verdrahtung: Handler per Spread, Wert von außen und Frist (E27) im Effekt');
  for (const z of fehlt) console.log(`     fehlt: ${z}`);
}
