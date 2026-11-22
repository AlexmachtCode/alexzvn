// UX Welle 2a, Recorder d · Einstellungs-Panel (Spec 3.6, 6; E13, E15; O1; Funktionsliste Nr. 6, 16–20, 27–29, 105): Eingang
// (AudioDeviceSection, gesperrt bei offenem Eingang), Format (Kanäle mit „Max“, Samplerate, ASIO-Hinweis; NumberInput, gesperrt bei
// offenem Eingang), Ziel (Ordner, Dateiname, Spuren einzeln), Fernsteuerung (Modul „JM Audio Recorder“, Port 8729). Jeder
// Abschnitt ist ein Sprungziel, jedes Feld ruft dieselbe Store-Aktion wie bisher (Attrappen). Render ohne Browser und ohne window.
import { ABSCHNITT_TEXTE, AUDIO_TEXTE, AudioDeviceSection, REMOTE_TEXTE, type AudioDeviceSectionProps } from '@jm/settings';
import { Button, NumberInput, TextInput } from '@jm/ui';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { panelAktionen, type EinstellungenAktionen, type PanelStore } from '@/lib/aktionen';
import { ABSCHNITT, RECORDER_TEXTE, statusLeiste, type OberflaechenStand, type RecorderZustand } from '@/lib/oberflaeche';
import { Einstellungen, type ZielWerte } from '@/views/Einstellungen';
import { panelTaste } from '../../../../packages/ui/src/components/SettingsPanel';
import { UI_TEXTE } from '../../../../packages/ui/src/lib/texte';
import { abschnitt, attr, basisMeldung, elemente, elementText, GERAETE, ohneKommentare, quellen, tags, text, warte, zustand } from './testzustand';

const T = RECORDER_TEXTE;
const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
function recorder(z: Partial<RecorderZustand> = {}): RecorderZustand {
  return { deviceIndex: 0, channels: 8, sampleRate: 96000, loading: false, hinweisEingang: null, ...z };
}
function stand(z: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return { recorder: recorder(), zustand: zustand('idle'), geraete: GERAETE, meldung: null, masterLink: undefined, fernsteuerung: undefined, ...z };
}
const ZIEL: ZielWerte = { dir: null, fileName: '', separateTracks: false };
/** Attrappe der Store-Aktionen unter ihren Namen im Store; jeder Aufruf landet im Protokoll. */
function store(log: string[]): PanelStore {
  return {
    selectDevice: (i) => void log.push(`selectDevice:${i}`),
    refreshDevices: async () => void log.push('refreshDevices'),
    setChannels: (n) => void log.push(`setChannels:${n}`),
    setSampleRate: (n) => void log.push(`setSampleRate:${n}`),
    pickDir: async () => void log.push('pickDir'),
    setFileName: (s) => void log.push(`setFileName:${s}`),
    setSeparateTracks: (v) => void log.push(`setSeparateTracks:${v}`),
  };
}
const aktionen = (log: string[] = []): EinstellungenAktionen => panelAktionen(store(log));
const panel = (s: OberflaechenStand, z: Partial<ZielWerte> = {}, log: string[] = []): string => render(<Einstellungen stand={s} ziel={{ ...ZIEL, ...z }} aktionen={aktionen(log)} />);
const titel = (html: string): string[] => [...html.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]);

// ── RE Panel Abschnitte: Anker, Reihenfolge, Titel ──
{
  const log: string[] = [];
  const s = stand();
  const html = panel(s, {}, log);
  const anker = Object.values(ABSCHNITT).map((id) => html.indexOf(`id="einstellung-${id}"`));
  ok(anker.every((p, i) => p >= 0 && (i === 0 || p > anker[i - 1])), `RE Panel Abschnitte: Anker für alle ABSCHNITT-Werte in der Reihenfolge Eingang, Format, Ziel, Fernsteuerung (${anker.join(', ')})`);
  gleich(titel(html), [AUDIO_TEXTE.titel, T.format.titel, T.ziel.titel, REMOTE_TEXTE.titel], 'RE Panel Abschnitte: Audiogerät, Format, Ziel, Fernsteuerung');
  const ziele = [stand(), stand({ zustand: zustand('armed') }), stand({ zustand: undefined })].flatMap((x) => statusLeiste(x).map((i) => i.settingsSection)).filter((z): z is string => typeof z === 'string');
  gleich([...new Set(ziele)].filter((z) => !html.includes(`id="einstellung-${z}"`)), [], 'RE Panel Abschnitte: jeder Statuseintrag mit Abschnitt findet seinen Anker');
  pruefeIdVerweise(html, 'RE Panel Abschnitte: id-Verweise gültig');
  gleich(log, [], 'RE Panel Abschnitte: Rendern löst keine Aktion aus');
  ok(!text(html).includes('"') && !text(panel(stand({ zustand: zustand('armed') }))).includes('"'), 'RE Panel Abschnitte: kein ASCII-Anführungszeichen in den Texten des Panels');
  ok(!/<input[^>]*type="number"/.test(html), 'RE Panel Abschnitte: kein natives Zahlenfeld im Panel (Kanäle und Samplerate sind NumberInput, E13)');
}

// ── RE Panel Eingang: Geräteliste, Aktualisieren, Sperre bei offenem Eingang ──
{
  const zu = abschnitt(panel(stand()), ABSCHNITT.eingang);
  const offen = abschnitt(panel(stand({ zustand: zustand('armed', { device: 0 }) })), ABSCHNITT.eingang);
  const auswahl = (h: string): string | undefined => tags(h, 'select')[0];
  const aktualisieren = (h: string): string | undefined => [...h.matchAll(/(<button[^>]*>)([\s\S]*?)<\/button>/g)].find((m) => text(m[2]).includes(AUDIO_TEXTE.aktualisieren))?.[1];
  ok(
    text(zu).includes(T.eingang.titel) && text(zu).includes('Dante Virtual Soundcard — ASIO (64 ch)') && text(zu).includes('Mikro — MME (2 ch)') && aktualisieren(zu) !== undefined,
    'RE Panel Eingang: Wahl „Eingang“ mit „Name — Treiber (n ch)“ und „Geräte aktualisieren“',
  );
  ok(attr(auswahl(zu), 'disabled') === undefined && attr(aktualisieren(zu), 'disabled') === undefined && !text(zu).includes(AUDIO_TEXTE.sperreEingangOffen), 'RE Panel Eingang: bei zu frei');
  ok(
    attr(auswahl(offen), 'disabled') !== undefined && attr(aktualisieren(offen), 'disabled') !== undefined && text(offen).includes(ABSCHNITT_TEXTE.gesperrt(AUDIO_TEXTE.sperreEingangOffen)),
    'RE Panel Eingang: bei offenem Eingang sind Auswahl und „Geräte aktualisieren“ gesperrt, mit Grund „solange der Eingang offen ist“ (wie bisher disabled={open})',
  );
  ok(text(abschnitt(panel(stand({ recorder: recorder({ loading: true }), geraete: [] })), ABSCHNITT.eingang)).includes(AUDIO_TEXTE.unbekannt), 'RE Panel Eingang: solange die Geräte gesucht werden „unbekannt“');
  ok(text(abschnitt(panel(stand({ geraete: [], recorder: recorder({ deviceIndex: null }) })), ABSCHNITT.eingang)).includes(AUDIO_TEXTE.keinEingang), 'RE Panel Eingang: leere Liste nach dem Laden: „Kein Eingang gefunden“ (Wortlaut wie die alte Option)');
}

// ── RE Panel Format: Kanäle, Max, Samplerate, ASIO-Hinweis; gesperrt bei offenem Eingang ──
{
  // Der Server-Render schreibt das Attribut wie React es nennt (inputMode); der Browser liest es ohne Rücksicht auf Groß/klein.
  const zahlFelder = (h: string): string[] => tags(h, 'input').filter((t) => attr(t, 'inputMode') === 'numeric');
  const zu = abschnitt(panel(stand()), ABSCHNITT.format);
  gleich(zahlFelder(zu).map((t) => [attr(t, 'type'), attr(t, 'value'), attr(t, 'disabled') !== undefined]), [['text', '8', false], ['text', '96000', false]], 'RE Panel Format: Kanäle (8) und Samplerate (96000) als NumberInput mit dem gemerkten Wunsch, frei bei zu');
  ok(text(zu).includes(T.format.kanaele) && text(zu).includes(T.format.samplerate), 'RE Panel Format: Feldnamen „Kanäle“ und „Samplerate (Hz)“ wie bisher');
  const max = (h: string): string | undefined => tags(h, 'button').find((t) => attr(t, 'title')?.startsWith('Alle '));
  ok(attr(max(zu), 'title') === T.format.alleKanaele(64) && text(zu).includes(T.format.max) && attr(max(zu), 'disabled') === undefined, 'RE Panel Format: „Max“ mit Tooltip „Alle 64 Kanäle“ beim gewählten Gerät');
  ok(text(zu).includes(T.format.asioHinweis), 'RE Panel Format: ASIO-Hinweis beim ASIO-Gerät');
  const mme = abschnitt(panel(stand({ recorder: recorder({ deviceIndex: 3 }) })), ABSCHNITT.format);
  ok(attr(max(mme), 'title') === T.format.alleKanaele(2) && !text(mme).includes(T.format.asioHinweis), 'RE Panel Format: beim MME-Gerät „Alle 2 Kanäle“ und kein ASIO-Hinweis');
  ok(max(abschnitt(panel(stand({ recorder: recorder({ deviceIndex: null }) })), ABSCHNITT.format)) === undefined, 'RE Panel Format: ohne gewähltes Gerät kein „Max“');
  const offen = abschnitt(panel(stand({ zustand: zustand('recording') })), ABSCHNITT.format);
  ok(
    zahlFelder(offen).every((t) => attr(t, 'disabled') !== undefined) && zahlFelder(offen).length === 2 && attr(max(offen), 'disabled') !== undefined &&
      (text(offen).match(new RegExp(UI_TEXTE.gesperrt(AUDIO_TEXTE.sperreEingangOffen), 'g')) ?? []).length === 2,
    'RE Panel Format: bei offenem Eingang (auch in der Aufnahme) Kanäle, Max und Samplerate gesperrt mit Grund „solange der Eingang offen ist“',
  );
  const felder = elemente(Einstellungen({ stand: stand(), ziel: ZIEL, aktionen: aktionen() })).filter((e) => e.type === NumberInput).map((e) => [e.props.value, e.props.min, e.props.max, e.props.ganzzahl]);
  gleich(felder, [[8, 1, 64, true], [96000, 8000, undefined, true]], 'RE Panel Format: Kanäle ganzzahlig 1 bis Kanäle des Geräts (64), Samplerate ganzzahlig ab 8000; Übernahme bei Enter oder Verlassen, keine Pfeile (E13)');
}

// ── RE Panel Ziel: Ordner, Dateiname, Spuren einzeln ──
{
  const leer = abschnitt(panel(stand()), ABSCHNITT.ziel);
  const voll = abschnitt(panel(stand(), { dir: 'D:\\Aufnahmen', fileName: 'Probe', separateTracks: true }), ABSCHNITT.ziel);
  ok(text(leer).includes(T.ziel.ordner) && text(leer).includes(T.ziel.ordnerWaehlen) && text(leer).includes(T.ziel.keinOrdner), 'RE Panel Ziel: „Zielordner“, „Ordner wählen…“ und „noch keiner gewählt“');
  ok(text(voll).includes('D:\\Aufnahmen') && tags(voll, 'span').some((t) => attr(t, 'title') === 'D:\\Aufnahmen') && !text(voll).includes(T.ziel.keinOrdner), 'RE Panel Ziel: der gewählte Ordner steht da, voll im Tooltip');
  const name = tags(voll, 'input').find((t) => attr(t, 'placeholder') === T.ziel.dateinamePlatzhalter);
  ok(text(voll).includes(T.ziel.dateiname) && attr(name, 'value') === 'Probe' && attr(name, 'disabled') === undefined, 'RE Panel Ziel: „Dateiname (optional)“ mit Platzhalter „leer = Zeitstempel“, nie gesperrt');
  const kasten = (h: string): string | undefined => tags(h, 'input').find((t) => attr(t, 'type') === 'checkbox');
  ok(
    kasten(voll)?.includes(' checked') === true && kasten(leer)?.includes(' checked') === false && text(voll).includes(T.ziel.spuren) && text(voll).includes(T.ziel.spurenHinweis) && attr(kasten(voll), 'disabled') === undefined,
    'RE Panel Ziel: Kontrollkästchen „Spuren zusätzlich einzeln speichern“ mit Erläuterung, frei außerhalb der Aufnahme',
  );
  ok(attr(kasten(abschnitt(panel(stand({ zustand: zustand('recording') })), ABSCHNITT.ziel)), 'disabled') !== undefined && attr(kasten(abschnitt(panel(stand({ zustand: zustand('armed') })), ABSCHNITT.ziel)), 'disabled') === undefined, 'RE Panel Ziel: „Spuren einzeln“ nur in der Aufnahme gesperrt (wie bisher)');
  ok(T.ziel.spurenHinweis === 'je Kanal eine Mono-WAV im Unterordner „…-Spuren“', 'RE Panel Ziel: Erläuterung mit typografischem Schlusszeichen statt ASCII-Anführungszeichen (R9, Z1)');
}

// ── RE Panel Fernsteuerung ──
{
  const f = abschnitt(panel(stand({ fernsteuerung: basisMeldung({ clients: 2 }) })), ABSCHNITT.fernsteuerung);
  ok(text(f).includes('8729') && text(f).includes('Modul „JM Audio Recorder“') && !f.includes('role="switch"'), 'RE Panel Fernsteuerung: Port 8729 und Companion-Modul „JM Audio Recorder“, ohne Schalter');
}

// ── RE Panel Verdrahtung: das gerenderte Panel ruft dieselben Store-Aktionen wie die alten Felder ──
{
  const log: string[] = [];
  const els = elemente(Einstellungen({ stand: stand(), ziel: ZIEL, aktionen: aktionen(log) }));
  const geraet = els.find((e) => e.type === AudioDeviceSection)?.props as unknown as AudioDeviceSectionProps | undefined;
  geraet?.choices[0]?.onChange?.('3');
  geraet?.onRefresh?.();
  const zahlen = els.filter((e) => e.type === NumberInput);
  (zahlen[0]?.props.onChange as ((n: number) => void) | undefined)?.(4);
  (zahlen[1]?.props.onChange as ((n: number) => void) | undefined)?.(44100);
  const knopf = (wort: string): (() => void) | undefined => els.find((e) => e.type === Button && elementText(e) === wort)?.props.onClick as (() => void) | undefined;
  knopf(T.format.max)?.();
  knopf(T.ziel.ordnerWaehlen)?.();
  (els.find((e) => e.type === TextInput)?.props.onChange as ((s: string) => void) | undefined)?.('Probe');
  (els.find((e) => e.type === 'input' && e.props.type === 'checkbox')?.props.onChange as ((e: unknown) => void) | undefined)?.({ target: { checked: true }, currentTarget: { checked: true } });
  await warte();
  gleich(
    log,
    ['selectDevice:3', 'refreshDevices', 'setChannels:4', 'setSampleRate:44100', 'setChannels:64', 'pickDir', 'setFileName:Probe', 'setSeparateTracks:true'],
    'RE Panel Verdrahtung: Eingang → selectDevice(Index), Aktualisieren → refreshDevices, Kanäle/Max → setChannels, Samplerate → setSampleRate, Ordner → pickDir, Dateiname → setFileName, Spuren → setSeparateTracks',
  );
  const ober = QUELLE('views/RecorderOberflaeche.tsx');
  ok(
    ober.includes('panelAktionen({ selectDevice, refreshDevices, setChannels, setSampleRate, pickDir, setFileName, setSeparateTracks })') &&
      ['selectDevice', 'refreshDevices', 'setChannels', 'setSampleRate', 'pickDir', 'setFileName', 'setSeparateTracks'].every((n) => ober.includes(`const ${n} = useRec((s) => s.${n});`)) &&
      ober.includes('settings={<Einstellungen stand={stand} ziel={{ dir, fileName, separateTracks }} aktionen={panel} />}'),
    'RE Panel Verdrahtung: die View reicht die Store-Aktionen unter ihren Namen an panelAktionen und den Stand an das Panel',
  );
}

// ── RE Panel ohne Effekte und Tasten (E15, O1, Nr. 113–115) ──
{
  const q = QUELLE('views/Einstellungen.tsx');
  ok(!q.includes('useEffect') && !q.includes('useState') && !/\bwindow\b/.test(q) && !q.includes('useRec') && !q.includes('jmrec'), 'RE Panel Abschnitte: Einstellungen.tsx ohne window, ohne Hooks und ohne Store (E15)');
  const aktionenQuelle = QUELLE('lib/aktionen.ts');
  ok(!/(?<![\w-])window\b|\bdocument\b|\blocalStorage\b|from ['"]@\/store\//.test(aktionenQuelle), 'RE Panel Abschnitte: lib/aktionen.ts rein (kein window, kein Store-Import)');
  gleich(
    quellen().filter((d) => /onKeyDown|addEventListener\(\s*'key/.test(ohneKommentare(leseText(d)))),
    ['src/renderer/src/components/PresetLeiste.tsx'],
    'RE Panel Tasten: keine neuen Kürzel; das einzige onKeyDown bleibt das Namensfeld der Preset-Leiste (Nr. 113, 115)',
  );
  const ereignis = (key: string, ziel: unknown, log: string[]) => ({ key, defaultPrevented: false, target: ziel, stopPropagation: () => void log.push('stop'), preventDefault: () => void log.push('prevent') });
  const esc: string[] = [];
  panelTaste(ereignis('Escape', { tagName: 'BUTTON', type: 'button' }, esc), () => void esc.push('zu'));
  const feld: string[] = [];
  panelTaste(ereignis('ArrowUp', { tagName: 'INPUT', type: 'text' }, feld), () => void feld.push('zu'));
  gleich([esc, feld], [['stop', 'prevent', 'zu'], ['stop']], 'RE Panel Tasten: Escape schließt das Panel, ein Feld behält seine Tasten (O1)');
}
