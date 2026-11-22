// UX Welle 2a, Recorder d · Live-Bereich und Arbeitsbereich (Spec 3.4, 5.1; E4, E7, E13; Ruling P3; Funktionsliste Nr. 7–42):
// Oben Preset-Leiste, Hinweisband und Main-Meldung mit „OK“; darunter Aufnahme-Taste, Eingangs-Taste, Marke, Uhr, Ziel-Anzeige,
// Verstärkung und Kanal-Meter in EINEM Live-Container, der nie höher ist als der sichtbare Inhalt (die Meter scrollen in sich);
// der Zeitplan steht im Arbeitsbereich darunter. Jede Taste und jedes Feld ruft dieselbe Store-Aktion wie bisher (Attrappen,
// Klick über die Verdrahtung des TallyButton). Render ohne Browser und ohne window.
import { createHash } from 'node:crypto';
import { Button, TallyButton, TextInput, UNBEKANNT, type TallyButtonProps } from '@jm/ui';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import type { RecorderState, RecorderStatus } from '@shared/types';
import { meldungAbonnieren } from '@/lib/aktionen';
import { dbfsLabel, formatClock } from '@/lib/format';
import { hauptTasten, RECORDER_TEXTE, statusLeiste, type OberflaechenStand, type RecorderZustand } from '@/lib/oberflaeche';
import { LiveBereich, liveKnoepfe, type LiveAktionen, type LiveWerte } from '@/views/LiveBereich';
import { RecorderOberflaeche } from '@/views/RecorderOberflaeche';
import { ZeitplanKarte, type ZeitplanAktionen } from '@/views/RecorderView';
import { tallyHandler } from '../../../../packages/ui/src/components/TallyButton';
import { erzeugeHalten } from '../../../../packages/ui/src/lib/halten';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { attr, element, elemente, elementText, GERAETE, mitStore, ohneKommentare, tags, text, zustand } from './testzustand';

const T = RECORDER_TEXTE;
const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
const inhalt = (html: string): string => element(html, 'main', '');
const STATI: RecorderStatus[] = ['idle', 'armed', 'recording'];

function recorder(z: Partial<RecorderZustand> = {}): RecorderZustand {
  return { deviceIndex: 0, channels: 8, sampleRate: 96000, loading: false, hinweisEingang: null, ...z };
}
function stand(z: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return { recorder: recorder(), zustand: zustand('idle'), geraete: GERAETE, meldung: null, masterLink: undefined, fernsteuerung: undefined, ...z };
}
const WERTE: LiveWerte = { peaks: [], gainDb: 0, hinweisOrdner: null, dir: null };
/** Attrappen der Aktionen; jeder Aufruf schreibt den Namen der Store-Aktion (mit Argument) ins Protokoll. */
function aktionen(log: string[] = []): LiveAktionen {
  return {
    arm: () => void log.push('arm'),
    disarm: () => void log.push('disarm'),
    record: () => void log.push('record'),
    stop: () => void log.push('stop'),
    setGain: (db) => void log.push(`setGain:${db}`),
    hinweiseSchliessen: () => void log.push('hinweiseSchliessen'),
    meldungQuittieren: () => void log.push('meldungQuittieren'),
    dateiZeigen: (p) => void log.push(`dateiZeigen:${p}`),
  };
}
const live = (s: OberflaechenStand, w: Partial<LiveWerte> = {}, log: string[] = []): string =>
  render(<LiveBereich stand={s} werte={{ ...WERTE, ...w }} aktionen={aktionen(log)} presets={<div data-probe="presets" />} />);
const baum = (s: OberflaechenStand, w: Partial<LiveWerte> = {}, log: string[] = []) =>
  elemente(LiveBereich({ stand: s, werte: { ...WERTE, ...w }, aktionen: aktionen(log), presets: null }));
/** Klick wie im Fenster: über die Ereignis-Verdrahtung des TallyButton (eine gesperrte Taste klickt nicht). */
const klick = (p: TallyButtonProps): void => tallyHandler(p, erzeugeHalten({})).onClick();

interface Knopf {
  label: string | undefined;
  state: string | undefined;
  gesperrt: string | undefined;
  grund: string | undefined;
}
/** Die gerenderten TallyButtons (Knöpfe mit data-state) in Reihenfolge. */
function knoepfe(html: string): Knopf[] {
  return [...html.matchAll(/(<button[^>]*\sdata-state="[^"]*"[^>]*>)([\s\S]*?)<\/button>/g)].map((m) => ({
    label: m[2].match(/<span>([^<]*)<\/span>/)?.[1],
    state: attr(m[1], 'data-state'),
    gesperrt: attr(m[1], 'aria-disabled'),
    grund: m[2].match(/<span id="[^"]*"[^>]*>([^<]*)<\/span>/)?.[1],
  }));
}
const erwartet = (t: { label: string; state: string; disabledReason?: string }): Knopf => ({
  label: t.label,
  state: t.state,
  gesperrt: t.state === 'gesperrt' ? 'true' : undefined,
  grund: t.state === 'gesperrt' ? t.disabledReason : undefined,
});

// ── RE Live über dem Falz: Taste, Marke, Uhr und Meter im selben Live-Container vor dem Zeitplan ──
{
  const html = mitStore({ loading: false, devices: GERAETE, deviceIndex: 0, channels: 2 }, () => render(<RecorderOberflaeche />));
  const m = inhalt(html);
  const behaelter = element(html, 'section', 'data-recorder="live"');
  const reihe = [
    'data-recorder="live"',
    'aria-label="Preset"',
    'data-recorder="transport"',
    'data-recorder="ziel"',
    'data-recorder="tasten"',
    'data-recorder="marke"',
    'data-recorder="uhr"',
    'data-recorder="pegel-kopf"',
    'type="range"',
    'data-recorder="pegel"',
    'data-recorder="arbeitsbereich"',
    'Geplante Aufnahme',
  ];
  const pos = reihe.map((s) => m.indexOf(s));
  ok(pos.every((p, i) => p >= 0 && (i === 0 || p > pos[i - 1])), `RE Live über dem Falz: Reihenfolge im Inhalt Live-Container, Preset-Leiste, Karte mit Ziel-Anzeige, Taste, Marke, Uhr, Pegel-Kopf, Verstärkung, Meter, dann der Arbeitsbereich mit dem Zeitplan (${pos.join(', ')})`);
  ok(
    behaelter !== '' &&
      ['aria-label="Preset"', 'data-recorder="tasten"', 'data-recorder="marke"', 'data-recorder="uhr"', 'data-recorder="ziel"', 'type="range"', 'data-recorder="pegel"', '>CH01<'].every((x) => behaelter.includes(x)) &&
      !behaelter.includes('Geplante Aufnahme'),
    'RE Live über dem Falz: Preset-Leiste, Tasten, Marke, Uhr, Ziel-Anzeige, Verstärkung und Meter stehen im selben Live-Container; der Zeitplan nicht',
  );
  gleich(tags(behaelter, 'button').filter((t) => attr(t, 'data-state') !== undefined).length, 2, 'RE Live über dem Falz: genau zwei TallyButtons (Aufnahme/Stopp, Eingang öffnen/schließen), höchstens vier');
  const klasse = (tag: string | undefined): string[] => (attr(tag, 'class') ?? '').split(/\s+/);
  const wurzel = klasse(tags(html, 'section').find((t) => attr(t, 'data-recorder') === 'live'));
  ok(
    ['flex', 'flex-col', 'overflow-y-auto', 'max-h-[calc(100vh_-_var(--header-h)_-_var(--statusbar-h)_-_2rem)]'].every((k) => wurzel.includes(k)),
    'RE Live über dem Falz: der Live-Container ist nie höher als der sichtbare Inhalt (100vh minus Kopf, Statusleiste und Rand)',
  );
  const pegel = klasse(tags(behaelter, 'div').find((t) => attr(t, 'data-recorder') === 'pegel'));
  ok(pegel.includes('overflow-y-auto') && pegel.some((k) => k.startsWith('min-h-')) && !pegel.includes('shrink-0'), 'RE Live über dem Falz: nur die Meter geben nach und scrollen in sich (viele Kanäle), mit Mindesthöhe');
  ok(
    ['transport'].every((id) => klasse(tags(behaelter, 'div').find((t) => attr(t, 'data-recorder') === id)).includes('shrink-0')),
    'RE Live über dem Falz: Tasten, Marke, Uhr, Ziel und Verstärkung schrumpfen nie (shrink-0)',
  );
  const tasten = klasse(tags(behaelter, 'div').find((t) => attr(t, 'data-recorder') === 'tasten'));
  ok(['grid', 'grid-cols-2', 'gap-3'].every((k) => tasten.includes(k)), 'RE Live über dem Falz: die Haupttasten stehen in grid gap-3 (Spec 5.1)');
  // Mit Hinweisen und Meldung (gemessen: 920×620 mit offenem Panel drückten sie die Meter sonst aus dem Bild).
  const voll = live(stand({ recorder: recorder({ hinweisEingang: 'Eingang fehlt.' }), meldung: 'Geplante Aufnahme gestartet.' }), { hinweisOrdner: 'Ordner fehlt.' });
  const hinweise = klasse(tags(voll, 'div').find((t) => attr(t, 'data-recorder') === 'hinweise'));
  const imKasten = voll.slice(voll.indexOf('data-recorder="hinweise"'), voll.indexOf('data-recorder="transport"'));
  ok(
    ['min-h-[2.75rem]', 'overflow-y-auto'].every((k) => hinweise.includes(k)) && !hinweise.some((k) => k.startsWith('shrink')) && pegel.includes('shrink-[10000]') &&
      imKasten.includes('role="alert"') && imKasten.includes('data-recorder="meldung"') && !live(stand()).includes('data-recorder="hinweise"'),
    'RE Live über dem Falz: Hinweisband und Meldung stehen oben in einem Kasten, der erst nach den Metern nachgibt (flex-shrink 1 gegen 10000), in sich scrollt und mindestens ein Band zeigt; ohne Hinweis kein Kasten',
  );
  const pegelKopf = klasse(tags(behaelter, 'div').find((t) => attr(t, 'data-recorder') === 'pegel-kopf'));
  ok(!pegelKopf.includes('flex-wrap'), 'RE Live über dem Falz: Pegelkopf und Verstärkung bleiben einzeilig (gemessen: umgebrochen kostete die Zeile 17 px)');
  const ziel = klasse(tags(behaelter, 'div').find((t) => attr(t, 'data-recorder') === 'ziel'));
  ok(ziel.includes('min-w-0') && ziel.includes('flex-1'), 'RE Live über dem Falz: die Ziel-Anzeige teilt sich die Kopfzeile der Karte und kürzt den Pfad statt umzubrechen');
  ok(m.indexOf('data-recorder="live"') < m.indexOf('data-recorder="arbeitsbereich"') && !element(html, 'section', 'data-recorder="live"').includes('arbeitsbereich'), 'RE Live über dem Falz: der Arbeitsbereich liegt hinter dem Live-Container, nicht darin');
  ok(QUELLE('views/RecorderOberflaeche.tsx').includes('presets={<PresetLeiste />}'), 'RE Live über dem Falz: die Preset-Leiste steht oben im Live-Bereich (E13)');
  pruefeIdVerweise(html, 'RE Live über dem Falz: id-Verweise gültig');
}

// ── RE Live Tasten: gerendert genau hauptTasten (Aufnahme/Stopp, dann Eingang), Gründe sichtbar ──
{
  const faelle = kreuz({ status: ['undefined', ...STATI], geraet: [0, null], laedt: [false, true] } as const);
  pruefeFaelle('RE Live Tasten: zwei TallyButtons in der Reihenfolge Aufnahme/Stopp, Eingang mit Zustand, Sperre und Grund aus hauptTasten', faelle, (f) => {
    const s = stand({ recorder: recorder({ deviceIndex: f.geraet, loading: f.laedt }), zustand: f.status === 'undefined' ? undefined : zustand(f.status) });
    const t = hauptTasten(s);
    return vergleiche(JSON.stringify(knoepfe(live(s))), JSON.stringify([t.aufnahme, t.eingang].map(erwartet)));
  });
  gleich(
    knoepfe(live(stand({ zustand: zustand('recording') }))).map((k) => [k.label, k.state]),
    [[T.taste.stopp, 'live'], [T.taste.eingangSchliessen, 'bereit']],
    'RE Live Tasten: bei recording „Stopp“ live (E4) links, „Eingang schließen“ rechts wie bisher',
  );
  gleich(
    knoepfe(live(stand({ zustand: undefined })))[0],
    { label: T.taste.aufnahme, state: 'gesperrt', gesperrt: 'true', grund: T.grund.zustandOffen },
    'RE Live Tasten: vor der ersten Antwort gesperrt mit sichtbarem Grund „Aufnahmezustand wird abgefragt…“',
  );
}

// ── RE Live Verdrahtung: jede Taste ruft dieselbe Store-Aktion wie der alte Knopf ──
{
  // Orakel aus dem alten Code (RecorderView.tsx:146-176 bei d7cdd79ce0): zu → „Eingang öffnen“ (arm, gesperrt ohne Gerät);
  // armed → „Aufnahme“ (record) und „Eingang schließen“ (disarm); recording → „Stopp“ (stop) und „Eingang schließen“ (disarm).
  // Neu (Task 20, Nr. 80): bei zu steht „Aufnahme“ bereit und ruft record (der Start scheitert dort mit Toast).
  const ORAKEL: Record<string, string[]> = {
    'undefined/0': [],
    'undefined/null': [],
    'idle/0': ['record', 'arm'],
    'idle/null': ['record'],
    'armed/0': ['record', 'disarm'],
    'armed/null': ['record', 'disarm'],
    'recording/0': ['stop', 'disarm'],
    'recording/null': ['stop', 'disarm'],
  };
  const faelle = kreuz({ status: ['undefined', ...STATI], geraet: [0, null] } as const);
  pruefeFaelle('RE Live Verdrahtung: Klick über tallyHandler auf beide Tasten ruft arm, disarm, record bzw. stop wie bisher; gesperrt ruft nichts', faelle, (f) => {
    const log: string[] = [];
    const s = stand({ recorder: recorder({ deviceIndex: f.geraet }), zustand: f.status === 'undefined' ? undefined : zustand(f.status) });
    for (const k of liveKnoepfe(s, aktionen(log))) klick(k);
    return vergleiche(log.join(','), ORAKEL[`${f.status}/${f.geraet}`].join(','));
  });
  const faelleGleich = kreuz({ status: ['undefined', ...STATI], geraet: [0, null] } as const);
  pruefeFaelle('RE Live Verdrahtung: liveKnoepfe ist genau hauptTasten plus Klick (keine zweite Rechnung)', faelleGleich, (f) => {
    const s = stand({ recorder: recorder({ deviceIndex: f.geraet }), zustand: f.status === 'undefined' ? undefined : zustand(f.status) });
    const t = hauptTasten(s);
    const k = liveKnoepfe(s, aktionen());
    return vergleiche(JSON.stringify(k.map(({ onClick, ...r }) => [r, typeof onClick])), JSON.stringify([t.aufnahme, t.eingang].map((x) => [x, 'function'])));
  });
  // Die Tasten im gerenderten Baum sind genau liveKnoepfe (keine toten Knöpfe).
  const log: string[] = [];
  const tallys = baum(stand({ zustand: zustand('armed') }), {}, log).filter((e) => e.type === TallyButton);
  for (const t of tallys) klick(t.props as unknown as TallyButtonProps);
  gleich(log, ['record', 'disarm'], 'RE Live Verdrahtung: die TallyButtons im gerenderten Live-Bereich klicken record und disarm (armed)');

  // Verstärkung, 0 dB, Hinweis schließen, OK, Datei zeigen.
  const log2: string[] = [];
  const s2 = stand({ recorder: recorder({ hinweisEingang: 'Eingang fehlt' }), zustand: zustand('recording', { filePath: 'D:\\Aufnahmen\\Probe.wav' }), meldung: 'Geplante Aufnahme gestartet.' });
  const els = baum(s2, { gainDb: 6 }, log2);
  const regler = els.find((e) => e.type === 'input' && e.props.type === 'range');
  (regler?.props.onChange as ((e: unknown) => void) | undefined)?.({ target: { value: '-3' }, currentTarget: { value: '-3' } });
  const knopf = (f: (e: (typeof els)[number]) => boolean): (() => void) | undefined => els.find((e) => e.type === Button && f(e))?.props.onClick as (() => void) | undefined;
  knopf((e) => elementText(e) === '0 dB')?.();
  knopf((e) => e.props.title === 'Hinweis schließen')?.();
  knopf((e) => elementText(e) === T.meldung.ok)?.();
  knopf((e) => e.props.title === T.ziel.imOrdnerZeigen)?.();
  gleich(
    log2,
    ['setGain:-3', 'setGain:0', 'hinweiseSchliessen', 'meldungQuittieren', 'dateiZeigen:D:\\Aufnahmen\\Probe.wav'],
    'RE Live Verdrahtung: Regler → setGain(Wert), „0 dB“ → setGain(0), „×“ → hinweiseSchliessen, „OK“ → Meldung quittieren, „→ Datei“ → im Ordner zeigen',
  );
  const ober = QUELLE('views/RecorderOberflaeche.tsx');
  ok(
    ['arm: () => void arm()', 'disarm: () => void disarm()', 'record: () => void record()', 'stop: () => void stop()', 'setGain,', 'hinweiseSchliessen,', 'meldungQuittieren: () => setMeldung(null)', 'dateiZeigen: (pfad) => void window.jmrec.shell.reveal(pfad)'].every((x) => ober.includes(x)),
    'RE Live Verdrahtung: die View reicht genau die Store-Aktionen arm, disarm, record, stop, setGain, hinweiseSchliessen und shell.reveal herein',
  );
  ok(
    ['const arm = useRec((s) => s.arm);', 'const disarm = useRec((s) => s.disarm);', 'const record = useRec((s) => s.record);', 'const stop = useRec((s) => s.stop);', 'const setGain = useRec((s) => s.setGain);', 'const hinweiseSchliessen = useRec((s) => s.hinweiseSchliessen);'].every((x) => ober.includes(x)),
    'RE Live Verdrahtung: die Aktionen kommen unverändert aus dem Store',
  );
}

// ── RE Live Marke und Uhr: Zustand aus dem Hauptprozess, nie aus dem Store ──
{
  const marke = (html: string): [string, string] => {
    const tag = tags(html, 'span').find((t) => attr(t, 'data-recorder') === 'marke');
    return [text(element(html, 'span', 'data-recorder="marke"')), attr(tag, 'class') ?? ''];
  };
  const uhr = (html: string): string => text(element(html, 'span', 'data-recorder="uhr"'));
  const faelle: Array<[RecorderState | undefined, string, string]> = [
    [undefined, UNBEKANNT, 'var(--muted)'],
    [zustand('idle'), 'Inaktiv', 'var(--muted)'],
    [zustand('armed'), 'Bereit', 'var(--success)'],
    [zustand('recording', { recordedSec: 3725 }), 'Aufnahme', 'var(--warning)'],
  ];
  gleich(
    faelle.map(([z, , ton]) => {
      const html = live(stand({ zustand: z }));
      const [t, k] = marke(html);
      return [t, k.includes(ton), uhr(html)];
    }),
    faelle.map(([z, t]) => [t, true, formatClock(z?.recordedSec ?? 0)]),
    'RE Live Marke und Uhr: Marke „Aufnahme“ (Warnton), „Bereit“ (Erfolgston), „Inaktiv“ (gedämpft), vor der Antwort „unbekannt“; Uhr aus recordedSec (1:02:05)',
  );
}

// ── RE Live Pegel: Zahl der Zeilen, Deckkraft, Verstärkung ──
{
  const zeilen = (html: string): string[] => [...html.matchAll(/>(CH\d{2})</g)].map((m) => m[1]);
  const zu = live(stand({ zustand: zustand('idle'), recorder: recorder({ channels: 8 }) }));
  const offen = live(stand({ zustand: zustand('armed'), recorder: recorder({ channels: 8 }) }), { peaks: [0.5, 0] });
  const null0 = live(stand({ zustand: zustand('armed', { channels: 0 }) }));
  // Gedimmt werden nur die Zeilen (wie bisher), nicht der Rahmen der Karte.
  const pegelKlasse = (html: string): string => attr(tags(html, 'div').find((t) => attr(t, 'data-recorder') === 'pegel-zeilen'), 'class') ?? '';
  gleich(
    [zeilen(zu).length, zeilen(offen), zeilen(null0)],
    [8, ['CH01', 'CH02'], ['CH01']],
    'RE Live Pegel: bei zu die eingestellten Kanäle (8), bei offen die gemessenen (2), mindestens eine Zeile',
  );
  ok(pegelKlasse(zu).includes('opacity-40') && !pegelKlasse(offen).includes('opacity-40') && text(zu).includes('Eingang öffnen zum Messen') && !text(offen).includes('Eingang öffnen zum Messen'), 'RE Live Pegel: bei zu gedimmt mit „Eingang öffnen zum Messen“, bei offen nicht');
  ok(text(offen).includes(`${dbfsLabel(0.5)} dB`) && text(offen).includes('-∞ dB') && text(offen).includes('Pegel'), 'RE Live Pegel: Pegelkopf „Pegel“, Werte je Kanal wie bisher („-6 dB“, „-∞ dB“)');
  const regler = (html: string): string | undefined => tags(html, 'input').find((t) => attr(t, 'type') === 'range');
  const r = regler(live(stand(), { gainDb: 6 }));
  gleich(
    [attr(r, 'min'), attr(r, 'max'), attr(r, 'step'), attr(r, 'value'), attr(r, 'title')],
    ['-12', '24', '1', '6', 'Aufnahme-Verstärkung'],
    'RE Live Pegel: Schieber GAIN −12 bis +24 dB, Schritt 1, Tooltip „Aufnahme-Verstärkung“ (E13: bei den Pegeln)',
  );
  const plus = text(live(stand(), { gainDb: 6 }));
  const null1 = live(stand(), { gainDb: 0 });
  ok(
    plus.includes('GAIN') && plus.includes('+6 dB') && plus.includes('Verstärkung hebt leise Aufnahmen an; zu viel übersteuert (Meter wird rot).') && text(live(stand(), { gainDb: -3 })).includes('-3 dB') && !text(null1).includes('Verstärkung hebt'),
    'RE Live Pegel: Anzeige „+6 dB“ bzw. „-3 dB“, Hinweis nur über 0 dB',
  );
  const nullKnopf = (html: string): string | undefined => tags(html, 'button').find((t) => attr(t, 'title') === 'Auf 0 dB zurücksetzen');
  ok(attr(nullKnopf(null1), 'disabled') !== undefined && attr(nullKnopf(live(stand(), { gainDb: 6 })), 'disabled') === undefined, 'RE Live Pegel: „0 dB“ (Tooltip „Auf 0 dB zurücksetzen“) gesperrt bei 0 dB');
}

// ── RE Live Ziel-Anzeige: Zielordner und Datei der Aufnahme ──
{
  const ohne = live(stand(), { dir: null });
  const mit = live(stand({ zustand: zustand('recording', { filePath: 'D:\\Aufnahmen\\Probe.wav' }) }), { dir: 'D:\\Aufnahmen' });
  const ziel = (html: string): string => element(html, 'div', 'data-recorder="ziel"');
  ok(text(ziel(ohne)).includes(T.ziel.ordner) && text(ziel(ohne)).includes(T.ziel.keinOrdner), 'RE Live Ziel-Anzeige: „Zielordner“ und „noch keiner gewählt“ ohne Ordner');
  const pfad = tags(mit, 'span').find((t) => attr(t, 'title') === 'D:\\Aufnahmen');
  ok(pfad !== undefined && text(mit).includes('D:\\Aufnahmen'), 'RE Live Ziel-Anzeige: der Zielordner steht da, voll im Tooltip');
  const link = tags(mit, 'button').find((t) => attr(t, 'title') === T.ziel.imOrdnerZeigen);
  ok(link !== undefined && text(mit).includes('→ Probe.wav') && !tags(ohne, 'button').some((t) => attr(t, 'title') === T.ziel.imOrdnerZeigen), 'RE Live Ziel-Anzeige: „→ Probe.wav“ (Tooltip „Im Ordner zeigen“) nur mit Datei im gemessenen Zustand');
}

// ── RE Live Hinweisband: Hinweise des Stores, Token statt Amber ──
{
  const beide = live(stand({ recorder: recorder({ hinweisEingang: 'Gemerkter Eingang fehlt.' }) }), { hinweisOrdner: 'Ordner fehlt.' });
  // Vom Band bis zum Ende seines ersten Knopfs (das „ד), über die innere Spalte der Absätze hinweg.
  const von = beide.indexOf('role="alert"');
  const band = von < 0 ? '' : beide.slice(von, beide.indexOf('</button>', von) + '</button>'.length);
  ok(band.includes('<p>Gemerkter Eingang fehlt.</p>') && band.includes('<p>Ordner fehlt.</p>') && tags(band, 'button').some((t) => attr(t, 'title') === 'Hinweis schließen'), 'RE Live Hinweisband: beide Hinweise als Absätze und „×“ mit Tooltip „Hinweis schließen“');
  const klasse = attr(tags(beide, 'div').find((t) => attr(t, 'role') === 'alert'), 'class') ?? '';
  ok(klasse.includes('var(--status-warn)') && !/amber/.test(klasse), 'RE Live Hinweisband: Rand und Fläche aus --status-warn, keine rohe Farbe (Nr. 44)');
  ok(live(stand(), { hinweisOrdner: 'Nur Ordner.' }).includes('role="alert"') && !live(stand()).includes('role="alert"'), 'RE Live Hinweisband: nur bei einem Hinweis');
}

// ── RE Meldung mit OK: Meldung des Hauptprozesses bleibt bis „OK“ im Live-Bereich (E13, Ruling P3) ──
{
  const mit = live(stand({ meldung: 'Geplante Aufnahme gestartet.' }));
  const band = element(mit, 'div', 'data-recorder="meldung"');
  ok(
    band.includes('role="status"') && text(band).includes('Geplante Aufnahme gestartet.') && tags(band, 'button').some(() => true) && text(band).includes(T.meldung.ok),
    'RE Meldung mit OK: die Meldung steht im Live-Bereich mit dem Knopf „OK“',
  );
  ok(!live(stand({ meldung: null })).includes('data-recorder="meldung"') && !live(stand({ meldung: '   ' })).includes('data-recorder="meldung"'), 'RE Meldung mit OK: ohne offene Meldung (oder nur Leerzeichen) kein Band');
  const m = mit.indexOf('data-recorder="meldung"');
  ok(m > mit.indexOf('data-probe="presets"') && m < mit.indexOf('data-recorder="transport"'), 'RE Meldung mit OK: das Band steht oben (nach der Preset-Leiste, vor den Tasten)');
  const beides = live(stand({ meldung: 'Geplante Aufnahme gestartet.', recorder: recorder({ hinweisEingang: 'Eingang fehlt.' }) }), { hinweisOrdner: 'Ordner fehlt.' });
  ok(beides.indexOf('data-recorder="meldung"') >= 0 && beides.indexOf('data-recorder="meldung"') < beides.indexOf('role="alert"'), 'RE Meldung mit OK: die Meldung steht vor dem Hinweisband, damit „OK“ auch im engen Kasten zu sehen ist');
  const s = stand({ meldung: 'Stille konnte nicht in die Datei geschrieben werden: x' });
  ok(statusLeiste(s).some((i) => i.id === 'meldung' && i.detail === s.meldung) && text(live(s)).includes(s.meldung ?? '?'), 'RE Meldung mit OK: Band und Statuseintrag „Meldung“ zeigen denselben Text');

  // Das Abo: jede Meldung setzt den Text, eine neuere ersetzt die ältere; „OK“ setzt null; dieselbe Meldung danach zeigt wieder.
  let hoerer: ((t: string) => void) | undefined;
  const log: string[] = [];
  let offen: string | null = null;
  const ab = meldungAbonnieren(
    (cb) => {
      log.push('an');
      hoerer = cb;
      return () => {
        log.push('ab');
        hoerer = undefined;
      };
    },
    (t) => {
      offen = t;
    },
  );
  const verlauf: Array<string | null> = [];
  hoerer?.('Aufnahme geplant für 20:00.');
  verlauf.push(offen);
  hoerer?.('Geplante Aufnahme gestartet.');
  verlauf.push(offen);
  offen = null; // „OK“
  verlauf.push(offen);
  hoerer?.('Geplante Aufnahme gestartet.');
  verlauf.push(offen);
  ab();
  hoerer?.('danach');
  verlauf.push(offen);
  gleich(
    [log, verlauf],
    [['an', 'ab'], ['Aufnahme geplant für 20:00.', 'Geplante Aufnahme gestartet.', null, 'Geplante Aufnahme gestartet.', 'Geplante Aufnahme gestartet.']],
    'RE Meldung mit OK: das Abo setzt jede Meldung, die neuere ersetzt die ältere, nach „OK“ erscheint dieselbe Meldung wieder; nach dem Abmelden nichts mehr',
  );
  gleich(typeof meldungAbonnieren(undefined, () => undefined), 'function', 'RE Meldung mit OK: ohne Preload meldet sich nichts an (Abmeldung ohne Wirkung)');

  const ober = QUELLE('views/RecorderOberflaeche.tsx');
  ok(
    ober.includes('const [meldung, setMeldung] = useState<string | null>(null);') && ober.includes('useEffect(() => meldungAbonnieren(window.jmrec?.onNotice, setMeldung), []);') && /const stand: OberflaechenStand = \{[^}]*\bmeldung,/.test(ober),
    'RE Meldung mit OK: die View abonniert onNotice getrennt vom Store, hält die offene Meldung als Oberflächenzustand und gibt sie als stand.meldung weiter',
  );
  // Der Toast bleibt (5 s, Nr. 54); eine Meldung des Stores bleibt nur Toast.
  ok(/useEffect\(\(\) => \{\s*if \(!notice\) return;\s*const t = setTimeout\(\(\) => setNotice\(null\), 5000\);\s*return \(\) => clearTimeout\(t\);\s*\}, \[notice, setNotice\]\);/.test(ober), 'RE Meldung mit OK: der Toast leert sich nach 5 s wie bisher');
  const toast = mitStore({ notice: 'Bitte einen Namen für das Preset eingeben.' }, () => render(<RecorderOberflaeche />));
  ok(text(inhalt(toast)).includes('Bitte einen Namen für das Preset eingeben.') && !toast.includes('data-recorder="meldung"'), 'RE Meldung mit OK: eine Meldung des Stores erscheint nur als Toast, nie im Band');
  const toastKlasse = tags(inhalt(toast), 'div').map((t) => attr(t, 'class') ?? '').find((k) => k.includes('fixed'));
  ok((toastKlasse ?? '').includes('bottom-[calc(var(--statusbar-h)+1.25rem)]'), 'RE Meldung mit OK: der Toast steht unten mittig über der Statusleiste (vorher 1,25 rem über dem Fensterrand)');
}

// ── RE Zeitplan: Karte „Geplante Aufnahme“ im Arbeitsbereich, dieselben Store-Aktionen ──
{
  const JETZT = 1_800_000_000_000;
  const zAktionen = (log: string[] = []): ZeitplanAktionen => ({
    setScheduleStart: (v) => void log.push(`setScheduleStart:${v}`),
    setScheduleDurationMin: (n) => void log.push(`setScheduleDurationMin:${n}`),
    schedule: () => void log.push('schedule'),
    cancelSchedule: () => void log.push('cancelSchedule'),
  });
  const karte = (z: RecorderState | undefined, log: string[] = []): string =>
    render(<ZeitplanKarte zustand={z} jetzt={JETZT} werte={{ scheduleStart: '2026-11-22T20:00', scheduleDurationMin: 15 }} aktionen={zAktionen(log)} />);
  const zu = karte(zustand('idle'));
  const offen = karte(zustand('armed'));
  const rec = karte(zustand('recording', { scheduledStopAt: JETZT + 125_000 }));
  const geplant = karte(zustand('armed', { scheduledStartAt: JETZT + 65_000, scheduledStopAt: JETZT + 965_000 }));
  ok(text(zu).includes('Erst den Eingang öffnen — dann lässt sich Start- und Stoppzeit planen.') && tags(zu, 'input').length === 0 && text(karte(undefined)).includes('Erst den Eingang öffnen'), 'RE Zeitplan: bei zu (und vor der Antwort) der Hinweis statt der Felder');
  const felder = tags(offen, 'input').map((t) => [attr(t, 'type'), attr(t, 'value'), attr(t, 'min') ?? '', attr(t, 'step') ?? '', attr(t, 'disabled') !== undefined]);
  gleich(felder, [['datetime-local', '2026-11-22T20:00', '', '', false], ['number', '15', '0', '1', false]], 'RE Zeitplan: Startzeit (datetime-local) und Dauer (Zahl, min 0, Schritt 1, Pfeile wie bisher, Nr. 118)');
  ok(['Geplante Aufnahme', 'Startzeit (leer = sofort)', 'Dauer (Min, 0 = manuell)', 'Planen'].every((w) => text(offen).includes(w)), 'RE Zeitplan: Kartenkopf, Feldnamen und „Planen“ wie bisher');
  ok(tags(rec, 'input').every((t) => attr(t, 'disabled') !== undefined) && text(rec).includes(`Auto-Stopp in ${formatClock(125)}`) && attr(tags(rec, 'button').at(-1), 'disabled') !== undefined, 'RE Zeitplan: in der Aufnahme Felder und „Planen“ gesperrt, Marke „Auto-Stopp in 2:05“');
  ok(text(geplant).includes(`Start in ${formatClock(65)}`) && text(geplant).includes('Geplant für') && text(geplant).includes('· Stopp') && text(geplant).includes('Abbrechen') && tags(geplant, 'input').length === 0, 'RE Zeitplan: bei geplantem Start „Geplant für … · Stopp …“, „Abbrechen“ und Marke „Start in 1:05“');
  ok(text(offen).includes(T.zeitplan.fusstext) && !T.zeitplan.fusstext.includes('"') && T.zeitplan.fusstext.includes('„Spuren einzeln“'), 'RE Zeitplan: Fußtext mit typografischen Anführungszeichen (R9, Z1)');

  const log: string[] = [];
  const elsOffen = elemente(ZeitplanKarte({ zustand: zustand('armed'), jetzt: JETZT, werte: { scheduleStart: '', scheduleDurationMin: 0 }, aktionen: zAktionen(log) }));
  const eingabe = (typ: string) => elsOffen.find((e) => e.type === TextInput && e.props.type === typ)?.props.onChange as ((v: string) => void) | undefined;
  eingabe('datetime-local')?.('2026-11-22T21:30');
  eingabe('number')?.('45');
  (elsOffen.find((e) => e.type === Button && elementText(e) === 'Planen')?.props.onClick as (() => void) | undefined)?.();
  const elsGeplant = elemente(ZeitplanKarte({ zustand: zustand('armed', { scheduledStartAt: JETZT + 1000 }), jetzt: JETZT, werte: { scheduleStart: '', scheduleDurationMin: 0 }, aktionen: zAktionen(log) }));
  (elsGeplant.find((e) => e.type === Button && elementText(e) === 'Abbrechen')?.props.onClick as (() => void) | undefined)?.();
  gleich(log, ['setScheduleStart:2026-11-22T21:30', 'setScheduleDurationMin:45', 'schedule', 'cancelSchedule'], 'RE Zeitplan: Startzeit → setScheduleStart, Dauer → setScheduleDurationMin(Zahl), „Planen“ → schedule, „Abbrechen“ → cancelSchedule');
  const view = QUELLE('views/RecorderView.tsx');
  ok(
    ['const schedule = useRec((s) => s.schedule);', 'const cancelSchedule = useRec((s) => s.cancelSchedule);', 'const setScheduleStart = useRec((s) => s.setScheduleStart);', 'const setScheduleDurationMin = useRec((s) => s.setScheduleDurationMin);', 'schedule: () => void schedule()', 'cancelSchedule: () => void cancelSchedule()'].every((x) => view.includes(x)) &&
      view.includes('const t = setInterval(() => setNow(Date.now()), 500);') && view.includes('}, [pendingStart, pendingStop]);'),
    'RE Zeitplan: die verbundene Karte nimmt die Aktionen aus dem Store und tickt wie bisher alle 500 ms, solange etwas ansteht',
  );
}

// ── RE Presets unverändert: die Preset-Leiste ist Zeichen für Zeichen die alte ──
{
  const roh = leseText('src/renderer/src/components/PresetLeiste.tsx').replace(/\r\n/g, '\n');
  gleich(createHash('sha256').update(roh).digest('hex'), 'cc66f4a0b6a883fd764120b48c1b1d11bd3395d70d0b413f294c0e2b4f2675a3', 'RE Presets unverändert: components/PresetLeiste.tsx wie vor dem Umbau (Auswahl, Rückfragen, Menü, Sperren)');
}

// ── RE keine rohen Farben: geänderte Dateien nur mit Tokens ──
{
  const dateien = ['App.tsx', 'views/RecorderOberflaeche.tsx', 'views/LiveBereich.tsx', 'views/Einstellungen.tsx', 'views/RecorderView.tsx', 'components/PresetLeiste.tsx', 'lib/aktionen.ts', 'lib/format.ts'];
  const roh = /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|shadow|accent)-(?:white|black|neutral|gray|grey|zinc|slate|stone|red|green|blue|yellow|amber|orange|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?\b|#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/;
  ok(roh.test('border-amber-500/60 bg-amber-500/10') && roh.test("background: '#121212'") && roh.test('rgba(0,0,0,.5)') && !roh.test('border-[var(--status-warn)]/60'), 'RE keine rohen Farben: Gegenprobe (Amber des alten Hinweisbands, Hex und rgba() werden erkannt, Tokens nicht)');
  gleich(dateien.filter((d) => roh.test(QUELLE(d))), [], 'RE keine rohen Farben: keine rohen Farbklassen, Hex- oder rgb-Werte in Rahmen, Live-Bereich, Panel, Zeitplan, Preset-Leiste und Aktionen');
}
