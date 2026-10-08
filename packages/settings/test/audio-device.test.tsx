// AudioDeviceSection (Spec 6.2 Absatz Audiogerät, 7, Plan E11, E17): nie still auf Standard.
import { enthaelt, enthaeltNicht, gleich, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import {
  abschnittStatusItem,
  AUDIO_TEXTE,
  AudioDeviceSection,
  audioDeviceView,
  type AudioChoice,
  type AudioDeviceSectionProps,
  type SectionStatus,
} from '../src/index';
import { bewegungsVerstoesse, kreuz, nachLetztem, pruefeFaelle, sperrZaehlung, statusText, vergleiche, vor } from './hilfe';

const s = (state: SectionStatus['state'], text: string): SectionStatus => ({ state, text });
const U = s('off', 'unbekannt');
const KEINS_OFF = s('off', 'kein Gerät gewählt');
const KEINS_WARN = s('warn', 'kein Gerät gewählt');
const STANDARD = s('ok', 'System-Standard');
const MIKRO = s('ok', 'Mikro 1');
const FEHLER = s('error', 'Fehler: Testfehler');
type Soll = SectionStatus | 'fehlt';

const LISTEN = {
  unbekannt: undefined,
  leer: [],
  liste: [
    { id: 'mic-1', label: 'Mikro 1' },
    { id: 'mic-2', label: 'Mikro 2' },
  ],
};
const WERTE = { leer: '', vorhanden: 'mic-1', fehlt: 'weg' };

// Tabelle je Wahl: Zeile = Liste|Wert; Spalten = (required, defaultLabel) in der Folge (–, –), (–, gesetzt),
// (true, –), (true, gesetzt). 'fehlt' heißt: „Gerät nicht gefunden, zuletzt: {lastLabel}“ bzw. ohne lastLabel
// „Gerät nicht gefunden“ (error). Eine Wahl allein bestimmt den Abschnitt; error schlägt alles.
const WAHL: Record<string, [Soll, Soll, Soll, Soll]> = {
  'unbekannt|leer': [U, U, U, U],
  'unbekannt|vorhanden': [U, U, U, U],
  'unbekannt|fehlt': [U, U, U, U],
  'leer|leer': [KEINS_OFF, KEINS_OFF, KEINS_WARN, KEINS_WARN],
  'leer|vorhanden': ['fehlt', 'fehlt', 'fehlt', 'fehlt'],
  'leer|fehlt': ['fehlt', 'fehlt', 'fehlt', 'fehlt'],
  'liste|leer': [KEINS_OFF, STANDARD, KEINS_WARN, KEINS_WARN],
  'liste|vorhanden': [MIKRO, MIKRO, MIKRO, MIKRO],
  'liste|fehlt': ['fehlt', 'fehlt', 'fehlt', 'fehlt'],
};

const wahl = (c: Partial<AudioChoice>): AudioChoice => ({ key: 'eingang', label: 'Eingang', direction: 'input', value: '', ...c });
const basis: AudioDeviceSectionProps = { id: 'audio', choices: [], capabilities: {} };

{
  const faelle = kreuz({
    liste: ['unbekannt', 'leer', 'liste'],
    wert: ['leer', 'vorhanden', 'fehlt'],
    required: [undefined, true],
    defaultLabel: [undefined, 'System-Standard'],
    lastLabel: [undefined, 'Altes Mikro'],
    error: [undefined, 'Testfehler'],
  } as const);
  const choice = (f: (typeof faelle)[number]): AudioChoice =>
    wahl({ devices: LISTEN[f.liste], value: WERTE[f.wert], required: f.required, defaultLabel: f.defaultLabel, lastLabel: f.lastLabel });
  pruefeFaelle('Audio Kreuzprodukt (eine Wahl): Eingang → status aus der Tabelle', faelle, (f) => {
    const t = WAHL[`${f.liste}|${f.wert}`][(f.required ? 2 : 0) + (f.defaultLabel ? 1 : 0)];
    const soll = f.error
      ? FEHLER
      : t === 'fehlt'
        ? s('error', f.lastLabel ? `Gerät nicht gefunden, zuletzt: ${f.lastLabel}` : 'Gerät nicht gefunden')
        : t;
    return vergleiche(statusText(audioDeviceView({ ...basis, error: f.error, choices: [choice(f)] }).status), statusText(soll));
  });
  pruefeFaelle('Audio Kreuzprodukt (eine Wahl): Wahl-Status ohne error wie die Tabelle, nie live', faelle, (f) => {
    const w = audioDeviceView({ ...basis, error: f.error, choices: [choice(f)] }).wahlen[0];
    return w.status.state === 'live' ? 'live' : f.liste === 'unbekannt' && w.status.state === 'ok' ? 'ok bei unbekannter Liste' : null;
  });
}

// ── drei Wahlen (Interpreter-Muster) ──
const GERAETE = [
  { id: 'in-1', label: 'Floor-Mikro' },
  { id: 'in-2', label: 'Headset' },
];
const AUSGAENGE = [{ id: 'cable', label: 'CABLE Input' }];
const floor = (c: Partial<AudioChoice> = {}): AudioChoice =>
  wahl({ key: 'floor', label: 'Floor (O-Ton)', devices: GERAETE, value: 'in-1', required: true, ...c });
const dolmetscher = (c: Partial<AudioChoice> = {}): AudioChoice =>
  wahl({ key: 'interpreter', label: 'Dolmetscher', devices: GERAETE, value: 'in-2', required: true, ...c });
const ausgabe = (c: Partial<AudioChoice> = {}): AudioChoice =>
  wahl({ key: 'output', label: 'Ausgabe (virtuelles Kabel)', direction: 'output', devices: AUSGAENGE, value: 'cable', defaultLabel: 'Systemstandard', ...c });
{
  // Je Wahl vier Zustände: ok, unbekannt (off), kein Gerät (warn), fehlt (error).
  const ZUSTAND = {
    ok: {},
    unbekannt: { devices: undefined },
    keins: { value: '', defaultLabel: undefined, required: true },
    fehlt: { value: 'weg', lastLabel: 'Altgerät' },
  } satisfies Record<string, Partial<AudioChoice>>;
  const TEXT = { ok: '', unbekannt: 'unbekannt', keins: 'kein Gerät gewählt', fehlt: 'Gerät nicht gefunden, zuletzt: Altgerät' };
  const STATE = { ok: 'ok', unbekannt: 'off', keins: 'warn', fehlt: 'error' } as const;
  const RANG_SOLL = { ok: 0, unbekannt: 1, keins: 2, fehlt: 3 };
  const NAMEN = ['Floor (O-Ton)', 'Dolmetscher', 'Ausgabe (virtuelles Kabel)'];
  const faelle = kreuz({
    floor: ['ok', 'unbekannt', 'keins', 'fehlt'],
    dolmetscher: ['ok', 'unbekannt', 'keins', 'fehlt'],
    ausgabe: ['ok', 'unbekannt', 'keins', 'fehlt'],
  } as const);
  pruefeFaelle('Audio Kreuzprodukt (drei Wahlen): schlechteste Wahl, Text der ersten davon mit „{Wahl}: “', faelle, (f) => {
    const z = [f.floor, f.dolmetscher, f.ausgabe];
    const view = audioDeviceView({
      ...basis,
      choices: [floor(ZUSTAND[f.floor]), dolmetscher(ZUSTAND[f.dolmetscher]), ausgabe(ZUSTAND[f.ausgabe])],
    });
    const schlimmste = Math.max(...z.map((k) => RANG_SOLL[k]));
    const i = z.findIndex((k) => RANG_SOLL[k] === schlimmste);
    const soll = schlimmste === 0 ? 'ok 3 Geräte gewählt' : `${STATE[z[i]]} ${NAMEN[i]}: ${TEXT[z[i]]}`;
    return vergleiche(statusText(view.status), soll);
  });
  const fall = (choices: AudioChoice[]): string => statusText(audioDeviceView({ ...basis, choices }).status);
  gleich(fall([floor(), dolmetscher(), ausgabe()]), 'ok 3 Geräte gewählt', 'Audio drei Wahlen: alles da → „3 Geräte gewählt“');
  gleich(
    fall([floor(), dolmetscher({ value: 'weg', lastLabel: 'Headset alt' }), ausgabe()]),
    'error Dolmetscher: Gerät nicht gefunden, zuletzt: Headset alt',
    'Audio drei Wahlen: fehlendes Dolmetscher-Gerät',
  );
  gleich(
    fall([floor({ value: '' }), dolmetscher(), ausgabe({ value: 'weg' })]),
    'error Ausgabe (virtuelles Kabel): Gerät nicht gefunden',
    'Audio drei Wahlen: Fehler schlägt Warnung, auch wenn die Warnung weiter vorn steht',
  );
  gleich(fall([floor(), dolmetscher(), ausgabe({ value: '' })]), 'ok 3 Geräte gewählt', 'Audio drei Wahlen: Ausgabe auf Systemstandard ist ok');
  gleich(fall([]), 'off kein Gerät gewählt', 'Audio ohne Wahl: off „kein Gerät gewählt“');
  gleich(fall([floor(), dolmetscher(), ausgabe({ devices: [], value: '' })]), 'off Ausgabe (virtuelles Kabel): kein Gerät gewählt', 'Audio leere Ausgangsliste: nie „ok“, kein Systemstandard ohne Gerät (Spec 7, Regel 3)');
}

{
  gleich(AUDIO_TEXTE.sperreEingangOffen, 'solange der Eingang offen ist', 'Audio: Sperrgrund-Konstante (Anzeige „Gesperrt: solange der Eingang offen ist“)');
  gleich(AUDIO_TEXTE.wechselStoppt, 'Ein Wechsel stoppt die laufende Verarbeitung', 'Audio: Wechsel-Warnung wörtlich aus Spec 6.2');
  gleich(audioDeviceView({ ...basis, capabilities: { level: true }, choices: [floor({ levelDb: -12.4 })] }).wahlen[0].pegel, { text: 'Pegel: -12 dB', prozent: 79 }, 'Audio Pegel: -12,4 dB → „-12 dB“, 79 %');
  gleich(audioDeviceView({ ...basis, capabilities: { level: true }, choices: [floor({ levelDb: -Infinity })] }).wahlen[0].pegel?.text, 'Pegel: kein Signal', 'Audio Pegel: -Infinity → kein Signal');
  gleich(audioDeviceView({ ...basis, capabilities: { level: true }, choices: [floor()] }).wahlen[0].pegel, undefined, 'Audio Pegel: ohne gemessenen Pegel keine Anzeige (nichts Erfundenes, Spec 7.3)');
  gleich(audioDeviceView({ ...basis, capabilities: { level: true }, choices: [ausgabe({ levelDb: -6 })] }).wahlen[0].pegel, { text: 'Pegel: -6 dB', prozent: 90 }, 'Audio Pegel: auch für einen Ausgang, wenn das Tool einen Pegel liefert (Spec 6.2 „je Wahl“)');
  gleich(audioDeviceView({ ...basis, choices: [floor({ levelDb: -6 })] }).wahlen[0].pegel, undefined, 'Audio Pegel: nur mit capabilities.level');
  gleich(
    [
      audioDeviceView({ ...basis, capabilities: { level: true }, choices: [floor({ levelDb: -0.4 })] }).wahlen[0].pegel?.text,
      audioDeviceView({ ...basis, capabilities: { level: true }, choices: [floor({ levelDb: Number.NaN })] }).wahlen[0].pegel,
      audioDeviceView({ ...basis, capabilities: { level: true }, choices: [floor({ levelDb: Number.POSITIVE_INFINITY })] }).wahlen[0].pegel,
    ],
    ['Pegel: 0 dB', undefined, undefined],
    'Audio Pegel: -0,4 dB → „Pegel: 0 dB“ (nicht „-0“); NaN und +Infinity sind keine Messung → kein Pegel (E26)',
  );
}

// ── Darstellung ──
const drei: AudioDeviceSectionProps = {
  ...basis,
  choices: [floor({ levelDb: -12 }), dolmetscher({ levelDb: -Infinity }), ausgabe()],
  capabilities: { level: true, refresh: true },
  onRefresh: () => {},
};
{
  const html = render(<AudioDeviceSection {...drei} />);
  for (const t of ['>Audiogerät<', '>Floor (O-Ton)<', '>Dolmetscher<', '>Ausgabe (virtuelles Kabel)<', '>Geräte aktualisieren</button>']) enthaelt(html, t, `Audio drei Wahlen: ${t}`);
  ok((html.match(/<select/g) ?? []).length === 3, 'Audio drei Wahlen: drei Auswahlen');
  ok(vor(html, '>Floor (O-Ton)<', '>Dolmetscher<') && vor(html, '>Dolmetscher<', '>Ausgabe (virtuelles Kabel)<'), 'Audio: Wahlen in der Reihenfolge des Arrays');
  ok((html.match(/Pegel: /g) ?? []).length === 2, 'Audio: Pegel für die zwei Wahlen mit gemessenem Pegel, keiner für den Ausgang ohne Pegel');
  enthaelt(html, '>Systemstandard</option>', 'Audio: Standard-Option des Ausgangs');
  enthaelt(html, '>3 Geräte gewählt</span>', 'Audio: Statuspille „3 Geräte gewählt“');
  pruefeIdVerweise(html, 'Audio: alle id-Verweise gültig');
  gleich(sperrZaehlung(html).gesperrt, 0, 'Audio ohne Sperre: nichts gesperrt');
  gleich(bewegungsVerstoesse(html), [], 'Audio: Übergänge nur motion-safe oder mit motion-reduce:transition-none (G8)');
}
{
  const faelle = kreuz({ level: [false, true], refresh: [false, true] } as const);
  pruefeFaelle('Audio capabilities: Pegel genau mit level, Knopf genau mit refresh', faelle, (c) => {
    const v = audioDeviceView({ ...drei, capabilities: c });
    const pegel = v.wahlen.map((w) => w.pegel !== undefined);
    return pegel.join() === [c.level, c.level, false].join() && v.sichtbar.aktualisieren === c.refresh
      ? null
      : `pegel ${pegel.join()}, aktualisieren ${v.sichtbar.aktualisieren}`;
  });
  const nurPegel = render(<AudioDeviceSection {...drei} capabilities={{ level: true }} />);
  const nurKnopf = render(<AudioDeviceSection {...drei} capabilities={{ refresh: true }} />);
  ok(
    nurPegel.includes('Pegel: ') && !nurPegel.includes('Geräte aktualisieren') && nurKnopf.includes('Geräte aktualisieren') && !nurKnopf.includes('Pegel'),
    'Audio je Capability allein: genau ihr Feld erscheint, kein anderes',
  );
}
{
  const html = render(<AudioDeviceSection {...drei} capabilities={{}} />);
  enthaeltNicht(html, 'Pegel', 'Audio ohne level: keine Pegelanzeige');
  enthaeltNicht(html, 'Geräte aktualisieren', 'Audio ohne refresh: kein Knopf');
  enthaeltNicht(render(<AudioDeviceSection {...drei} onRefresh={undefined} />), 'Geräte aktualisieren', 'Audio refresh ohne onRefresh: kein Knopf');
}
{
  const html = render(<AudioDeviceSection {...drei} choices={[floor(), dolmetscher({ value: 'weg', lastLabel: 'Headset alt' }), ausgabe()]} />);
  enthaelt(html, 'nicht verfügbar: Headset alt', 'Audio fehlendes Gerät: bleibt gewählt, als „nicht verfügbar: {zuletzt}“');
  enthaelt(html, 'Dolmetscher: Gerät nicht gefunden, zuletzt: Headset alt', 'Audio fehlendes Gerät: Statustext mit Wahl und letztem Namen');
}
{
  const html = render(
    <AudioDeviceSection {...drei} choices={[floor({ devices: [] }), dolmetscher({ devices: undefined }), ausgabe({ devices: [], value: '' })]} />,
  );
  enthaelt(html, 'Kein Eingang gefunden', 'Audio Leerliste Eingang: „Kein Eingang gefunden“');
  enthaelt(html, 'Kein Ausgang gefunden', 'Audio Leerliste Ausgang: „Kein Ausgang gefunden“');
  ok((html.match(/<select/g) ?? []).length === 2, 'Audio Liste unbekannt: für diese Wahl keine Auswahl');
  enthaelt(html, '>unbekannt</div>', 'Audio Liste unbekannt: Anzeige „unbekannt“');
}
{
  const html = render(
    <AudioDeviceSection
      {...drei}
      choices={[floor({ lockedReason: AUDIO_TEXTE.sperreEingangOffen }), dolmetscher({ changeWarning: AUDIO_TEXTE.wechselStoppt }), ausgabe()]}
    />,
  );
  enthaelt(html, 'Gesperrt: solange der Eingang offen ist', 'Audio Sperrgrund je Wahl sichtbar');
  ok((html.match(/<select[^>]*disabled=""/g) ?? []).length === 1, 'Audio Sperrgrund je Wahl: nur diese Auswahl gesperrt');
  enthaelt(html, 'Ein Wechsel stoppt die laufende Verarbeitung', 'Audio Wechsel-Warnung sichtbar');
  pruefeIdVerweise(html, 'Audio Sperrgrund und Warnung per aria-describedby verknüpft');
}
{
  const html = render(<AudioDeviceSection {...drei} locked="Vom Master vorgegeben" />);
  const z = sperrZaehlung(html);
  ok(z.alle === 4 && z.gesperrt === 4, `Audio locked: alle Bedienelemente disabled (${z.gesperrt} von ${z.alle})`);
  ok(vor(html, 'Gesperrt: Vom Master vorgegeben', '<select'), 'Audio locked: Grund vor den Feldern');
}
{
  const html = render(<AudioDeviceSection {...drei} error="Audio-Treiber nicht geladen" />);
  ok(nachLetztem(html, 'data-fehler="true"', '<select'), 'Audio error: Fehlertext nach den Feldern');
}
{
  const p: AudioDeviceSectionProps = { ...drei, choices: [floor({ value: '' }), dolmetscher(), ausgabe()] };
  const view = audioDeviceView(p);
  const item = abschnittStatusItem(view, { group: 'tool', label: 'Audio' });
  const html = render(<AudioDeviceSection {...p} />);
  ok(item.state === 'warn' && html.includes(`data-state="${item.state}"`) && html.includes(`>${item.detail}</span>`), 'Audio: abschnittStatusItem = Statuspille (Zustand und Text)');
}
