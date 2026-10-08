// Task 7 · Eingabe-Logik (Spec 3.5; E11, E12, E13): Zahl prüfen ohne stilles Klemmen, Entwurf mit Enter/Verlassen/
// Escape, Auswahl ohne stilles Umspringen, Feld-IDs und die Reihenfolge in aria-describedby.
import * as ui from '../src/index';
import {
  beschreibtDurch,
  feldIds,
  parseZahl,
  selectOptionen,
  starteFrist,
  UEBERNAHME_FRIST_MS,
  zahlEntwurfAus,
  zahlSchritt,
  type SelectOption,
  type ZahlRegeln,
} from '../src/lib/eingabe';
import { gleich, ok } from './harness';

const FEHLT = { ok: false, fehler: 'Bitte eine Zahl eingeben.' };

// ── parseZahl ──
gleich(['', 'abc', '1e3', '1.2.3', '12a', ','].map((t) => parseZahl(t)), Array(6).fill(FEHLT), "Eingabe: parseZahl '', 'abc', '1e3' u. a. → „Bitte eine Zahl eingeben.“");
gleich(parseZahl(' 42 '), { ok: true, wert: 42 }, "Eingabe: parseZahl ' 42 ' → 42 (Leerraum weg)");
gleich([parseZahl('1,5'), parseZahl('1.5'), parseZahl('-3')], [{ ok: true, wert: 1.5 }, { ok: true, wert: 1.5 }, { ok: true, wert: -3 }], 'Eingabe: parseZahl Komma und Punkt als Dezimaltrenner, Minus erlaubt');
gleich(
  [parseZahl('1.5', { ganzzahl: true }), parseZahl('2', { ganzzahl: true })],
  [{ ok: false, fehler: 'Bitte eine ganze Zahl eingeben.' }, { ok: true, wert: 2 }],
  "Eingabe: parseZahl '1.5' mit ganzzahl → „Bitte eine ganze Zahl eingeben.“",
);
gleich(
  [parseZahl('0', { min: 1 }), parseZahl('0,5', { min: 1.5 }), parseZahl('1', { min: 1 })],
  [{ ok: false, fehler: 'Mindestens 1.' }, { ok: false, fehler: 'Mindestens 1,5.' }, { ok: true, wert: 1 }],
  "Eingabe: parseZahl '0' mit min 1 → „Mindestens 1.“, Grenze selbst gilt",
);
gleich(
  [parseZahl('70000', { max: 65535 }), parseZahl('65535', { max: 65535 })],
  [{ ok: false, fehler: 'Höchstens 65535.' }, { ok: true, wert: 65535 }],
  "Eingabe: parseZahl '70000' mit max 65535 → „Höchstens 65535.“ (kein stilles Klemmen)",
);

// ── Entwurf (NumberInput) ──
const PORT: ZahlRegeln = { min: 1, max: 65535, ganzzahl: true };
gleich([zahlEntwurfAus(null), zahlEntwurfAus(1.5)], [{ text: '', geaendert: false }, { text: '1,5', geaendert: false }], 'Eingabe: zahlEntwurfAus – null → leer, 1.5 → 1,5');
gleich(
  [zahlSchritt(zahlEntwurfAus(5), { art: 'tippen', text: '7' }, {}, 5), zahlSchritt({ text: '7', geaendert: true }, { art: 'tippen', text: '5' }, {}, 5)],
  [
    { z: { text: '7', geaendert: true }, verbraucht: false },
    { z: { text: '5', geaendert: false }, verbraucht: false },
  ],
  'Eingabe: zahlSchritt tippen – Entwurf ändert sich, zurückgetippt ist nichts geändert',
);
gleich(
  zahlSchritt({ text: '8080', geaendert: true }, { art: 'uebernehmen' }, PORT, 8000),
  { z: { text: '8080', geaendert: true, gesendet: 8080 }, neuerWert: 8080, verbraucht: false },
  'Eingabe: zahlSchritt uebernehmen gültig → neuerWert, Entwurf bleibt geändert, bis der Wert zurückkommt',
);
{
  const gemeldet = zahlSchritt({ text: '8080', geaendert: true }, { art: 'uebernehmen' }, PORT, 8000);
  // Das Tool lehnt ab (value bleibt 8000) bzw. übernimmt (value kommt als 8080 zurück).
  const abgelehnt = zahlSchritt(gemeldet.z, { art: 'verwerfen' }, PORT, 8000);
  const angenommen = zahlSchritt(gemeldet.z, { art: 'aussen', wert: 8080 }, PORT, 8080);
  gleich(
    [abgelehnt, angenommen],
    [
      { z: { text: '8000', geaendert: false }, verbraucht: true },
      { z: { text: '8080', geaendert: false }, verbraucht: false },
    ],
    'Eingabe: zahlSchritt nach dem Übernehmen – abgelehnt: Escape verwirft auf den echten Wert und gehört dem Feld; angenommen: der Wert von außen schließt den Entwurf',
  );
}
// E27: gemeldet ist nicht übernommen – nicht doppelt melden, nach der Frist sichtbar, die Antwort des Tools gilt
{
  const gemeldet = zahlSchritt({ text: '8080', geaendert: true }, { art: 'uebernehmen' }, PORT, 8000);
  const nochmal = zahlSchritt(gemeldet.z, { art: 'uebernehmen' }, PORT, 8000);
  const neu = zahlSchritt(zahlSchritt(gemeldet.z, { art: 'tippen', text: '8081' }, PORT, 8000).z, { art: 'uebernehmen' }, PORT, 8000);
  gleich(
    [nochmal, neu.neuerWert],
    [{ z: gemeldet.z, verbraucht: false }, 8081],
    'Eingabe: zahlSchritt – ein gemeldeter Wert wird nicht noch einmal gemeldet (Verlassen nach Enter, Tool lehnt ab); eine neue Eingabe meldet wieder',
  );
  const frist = zahlSchritt(gemeldet.z, { art: 'frist' }, PORT, 8000);
  gleich(
    [frist, zahlSchritt(frist.z, { art: 'uebernehmen' }, PORT, 8000).neuerWert, zahlSchritt(zahlEntwurfAus(8000), { art: 'frist' }, PORT, 8000)],
    [
      { z: { text: '8080', geaendert: true, gesendet: 8080, fehler: 'Noch nicht übernommen.' }, verbraucht: false },
      undefined,
      { z: { text: '8000', geaendert: false }, verbraucht: false },
    ],
    'Eingabe: zahlSchritt frist – ohne Antwort „Noch nicht übernommen.“, der Text bleibt und wird nicht erneut gemeldet; ohne gemeldeten Wert nichts',
  );
  gleich(
    [zahlSchritt(gemeldet.z, { art: 'aussen', wert: 8081 }, PORT, 8081).z, zahlSchritt(frist.z, { art: 'aussen', wert: 8081 }, PORT, 8081).z],
    [{ text: '8081', geaendert: false }, { text: '8081', geaendert: false }],
    'Eingabe: zahlSchritt aussen nach dem Melden – das Feld zeigt den Wert, mit dem das Tool antwortet (auch nach der Frist)',
  );
}
{
  let geplant: { f: () => void; ms: number } | undefined;
  let gemeldet = 0;
  let angehalten: unknown;
  const aufraeumen = starteFrist(() => void gemeldet++, {
    setTimeout: (f, ms) => {
      geplant = { f, ms };
      return 9;
    },
    clearTimeout: (id) => {
      angehalten = id;
    },
  });
  geplant?.f();
  aufraeumen();
  gleich([geplant?.ms, UEBERNAHME_FRIST_MS, gemeldet, angehalten], [2000, 2000, 1, 9], 'Eingabe: starteFrist meldet einmal nach 2 s, das Aufräumen hält die Frist an');
}
gleich(
  zahlSchritt({ text: '70000', geaendert: true }, { art: 'uebernehmen' }, PORT, 8000),
  { z: { text: '70000', fehler: 'Höchstens 65535.', geaendert: true }, verbraucht: false },
  'Eingabe: zahlSchritt uebernehmen ungültig → Fehler, Text bleibt, kein neuerWert',
);
gleich(
  [
    zahlSchritt(zahlEntwurfAus(8000), { art: 'uebernehmen' }, PORT, 8000),
    zahlSchritt({ text: '1,50', geaendert: true }, { art: 'uebernehmen' }, {}, 1.5),
  ],
  [
    { z: { text: '8000', geaendert: false }, verbraucht: false },
    { z: { text: '1,5', geaendert: false }, verbraucht: false },
  ],
  'Eingabe: zahlSchritt uebernehmen ohne Änderung oder mit gleichem Wert → kein neuerWert',
);
gleich(
  zahlSchritt({ text: '70000', fehler: 'Höchstens 65535.', geaendert: true }, { art: 'verwerfen' }, PORT, 8000),
  { z: { text: '8000', geaendert: false }, verbraucht: true },
  'Eingabe: zahlSchritt verwerfen mit Änderung → verbraucht, Text = aktueller Wert',
);
gleich(
  zahlSchritt(zahlEntwurfAus(8000), { art: 'verwerfen' }, PORT, 8000),
  { z: { text: '8000', geaendert: false }, verbraucht: false },
  'Eingabe: zahlSchritt verwerfen ohne Änderung → nicht verbraucht (Escape gehört dem Panel)',
);
gleich(
  [
    zahlSchritt(zahlEntwurfAus(8000), { art: 'aussen', wert: 9000 }, PORT, 8000),
    zahlSchritt(zahlEntwurfAus(8000), { art: 'aussen', wert: null }, PORT, 8000),
    zahlSchritt({ text: '81', geaendert: true }, { art: 'aussen', wert: 9000 }, PORT, 8000),
  ],
  [
    { z: { text: '9000', geaendert: false }, verbraucht: false },
    { z: { text: '', geaendert: false }, verbraucht: false },
    { z: { text: '81', geaendert: true }, verbraucht: false },
  ],
  'Eingabe: zahlSchritt aussen – ohne Änderung übernommen, mit Änderung bleibt der Entwurf',
);

// ── selectOptionen (E11: der Wert springt nie still um) ──
{
  const GERAETE: SelectOption[] = [
    { value: 'mic-1', label: 'Mikrofon 1' },
    { value: 'mic-2', label: 'Mikrofon 2' },
  ];
  const vorher = JSON.stringify(GERAETE);
  const vorhanden = selectOptionen(GERAETE, 'mic-2');
  ok(JSON.stringify(vorhanden) === vorher && vorhanden !== GERAETE, 'Eingabe: selectOptionen – Wert vorhanden → Liste unverändert (Kopie)');
  gleich(
    selectOptionen(GERAETE, '', { placeholder: 'System-Standard' })[0],
    { value: '', label: 'System-Standard' },
    "Eingabe: selectOptionen – '' mit placeholder → erste Option { value: '', label: placeholder }",
  );
  gleich(
    selectOptionen(GERAETE, '')[0],
    { value: '', label: '– bitte wählen –' },
    "Eingabe: selectOptionen – '' ohne placeholder → erste Option „– bitte wählen –“",
  );
  gleich(
    selectOptionen([{ value: '', label: 'Standard' }, ...GERAETE], ''),
    [{ value: '', label: 'Standard' }, ...GERAETE],
    "Eingabe: selectOptionen – '' als echte Option → keine zusätzliche Option",
  );
  gleich(
    [selectOptionen(GERAETE, 'usb-9', { fehlendLabel: 'USB-Mikrofon' }), selectOptionen(GERAETE, 'usb-9')[0]],
    [
      [{ value: 'usb-9', label: 'nicht verfügbar: USB-Mikrofon', disabled: true }, ...GERAETE],
      { value: 'usb-9', label: 'nicht verfügbar: usb-9', disabled: true },
    ],
    'Eingabe: selectOptionen – fehlender Wert → erste Option „nicht verfügbar: …“ disabled, Wert bleibt',
  );
  ok(JSON.stringify(GERAETE) === vorher, 'Eingabe: selectOptionen verändert die Eingabe nie');
}

// ── Feld-IDs und aria-describedby (E13: Reihenfolge Hilfe, Sperre, Fehler, dann extra) ──
{
  const ids = feldIds('port');
  gleich(ids, { input: 'port', hilfe: 'port-hilfe', sperre: 'port-sperre', fehler: 'port-fehler' }, 'Eingabe: feldIds');
  gleich(
    [
      beschreibtDurch(ids, { fehler: true, sperre: true, hilfe: true, extra: ['port-einheit'] }),
      beschreibtDurch(ids, { fehler: true, hilfe: true }),
      beschreibtDurch(ids, { extra: ['port-einheit'] }),
    ],
    ['port-hilfe port-sperre port-fehler port-einheit', 'port-hilfe port-fehler', 'port-einheit'],
    'Eingabe: beschreibtDurch – Reihenfolge Hilfe, Sperre, Fehler, extra',
  );
  gleich(
    [beschreibtDurch(ids, {}), beschreibtDurch(ids, { hilfe: false, extra: [] })],
    [undefined, undefined],
    'Eingabe: beschreibtDurch – nichts → undefined',
  );
}

ok(typeof ui.parseZahl === 'function' && ui.parseZahl('3').ok && typeof ui.starteFrist === 'function', 'Eingabe: Export parseZahl und starteFrist aus src/index.ts');
