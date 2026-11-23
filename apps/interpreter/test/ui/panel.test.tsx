// UX Welle 2a, Interpreter d · Einstellungs-Panel (Spec 3.6, 6.2; E10, E15; O1; Funktionsliste Nr. 8–11, 29–39, 78–81): Audiogerät
// mit drei Wahlen (Floor und Dolmetscher Pflicht, Ausgabe mit „Systemstandard“, Pegel nur im Lauf, ohne Aktualisieren, je mit dem
// Wechselhinweis „Wirkt erst nach Stopp und erneutem Start.“), dahinter der tool-eigene Abschnitt „Ducking“ (Bypass, Schwelle,
// Absenkung, Attack, Release, Nachlauf, Vorverstärkung Floor und Dolmetscher, „Ducking-Werte zurücksetzen“). Jedes Feld ruft
// dieselbe Store-Aktion wie bisher (Attrappen); keine Wahl startet, stoppt oder leitet um (Wahl ≠ Bewegung).
import { ABSCHNITT_TEXTE, AUDIO_TEXTE, AudioDeviceSection, type AudioDeviceSectionProps } from '@jm/settings';
import { Button } from '@jm/ui';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { panelAktionen, type PanelAktionen } from '@/lib/aktionen';
import { ABSCHNITT, DUCKING_REGLER, INTERPRETER_TEXTE, statusLeiste, VORVERSTAERKUNG_REGLER, type OberflaechenStand } from '@/lib/oberflaeche';
import { DEFAULT_SETTINGS, type DuckSettings } from '@shared/ducking';
import { Einstellungen, type ReglerWerte } from '@/views/Einstellungen';
import { panelTaste } from '../../../../packages/ui/src/components/SettingsPanel';
import { abschnitt, attr, einst, elemente, geraete, motor, ohneKommentare, stand, storeAttrappe, tags, text } from './testzustand';

const T = INTERPRETER_TEXTE;
const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
const WERTE: ReglerWerte = { ...DEFAULT_SETTINGS, bypass: false };
const aktionen = (log: string[] = []): PanelAktionen => panelAktionen(storeAttrappe(log));
const panel = (s: OberflaechenStand, werte: ReglerWerte = WERTE, log: string[] = []): string => render(<Einstellungen stand={s} werte={werte} aktionen={aktionen(log)} />);
const titel = (html: string): string[] => [...html.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]);
const optionen = (sel: string): string[] => [...sel.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map((m) => m[1]);
const auswahlen = (h: string): string[] => [...h.matchAll(/<select[\s\S]*?<\/select>/g)].map((m) => m[0]);
/** Ein Block einer Wahl (data-wahl). */
const wahl = (h: string, key: string): string => {
  const a = h.indexOf(`data-wahl="${key}"`);
  const b = h.indexOf('data-wahl="', a + 1);
  return a < 0 ? '' : h.slice(h.indexOf('>', a) + 1, b < 0 ? undefined : b);
};

// ── IN Panel Abschnitte: Anker, Reihenfolge, Titel ──
{
  const log: string[] = [];
  const html = panel(stand(), WERTE, log);
  const anker = Object.values(ABSCHNITT).map((id) => html.indexOf(`id="einstellung-${id}"`));
  ok(anker.every((p, i) => p >= 0 && (i === 0 || p > anker[i - 1])), `IN Panel Abschnitte: Anker für alle ABSCHNITT-Werte in der Reihenfolge Geräte, Ducking (${anker.join(', ')})`);
  gleich(titel(html), [AUDIO_TEXTE.titel, T.ducking.titel], 'IN Panel Abschnitte: „Audiogerät“, dann der tool-eigene Abschnitt „Ducking“');
  const ziele = [stand(), stand({ engine: undefined, geraete: undefined }), stand({ einstellungen: einst({ bypass: true }) })].flatMap((x) => statusLeiste(x).map((i) => i.settingsSection)).filter((z): z is string => typeof z === 'string');
  gleich([...new Set(ziele)].filter((z) => !html.includes(`id="einstellung-${z}"`)), [], 'IN Panel Abschnitte: jeder Statuseintrag mit Abschnitt findet seinen Anker');
  pruefeIdVerweise(html, 'IN Panel Abschnitte: id-Verweise gültig');
  gleich(log, [], 'IN Panel Abschnitte: Rendern löst keine Aktion aus');
  ok(!text(html).includes('"') && !text(panel(stand({ engine: undefined, geraete: undefined }))).includes('"'), 'IN Panel Abschnitte: kein ASCII-Anführungszeichen in den Texten des Panels');
}

// ── IN Panel Geräte: drei Wahlen mit den alten Beschriftungen, Wechselhinweis (E10), Pegel nur im Lauf ──
{
  const g = abschnitt(panel(stand()), ABSCHNITT.geraete);
  gleich(
    ['floor', 'dolmetscher', 'ausgabe'].map((k) => text(wahl(g, k)).startsWith(k === 'floor' ? 'Floor (O-Ton)' : k === 'dolmetscher' ? 'Dolmetscher' : 'Ausgabe (virtuelles Kabel)')),
    [true, true, true],
    'IN Panel Geräte: Wahlen „Floor (O-Ton)“, „Dolmetscher“, „Ausgabe (virtuelles Kabel)“ in dieser Reihenfolge (App.tsx:110-123)',
  );
  const [floor, dolm, aus] = auswahlen(g);
  gleich(
    [optionen(floor ?? ''), optionen(dolm ?? ''), optionen(aus ?? '')],
    [
      ['Mikro Saal', 'Dolmetschkabine', 'Standard - CABLE Output (VB-Audio Virtual Cable)'],
      ['Mikro Saal', 'Dolmetschkabine', 'Standard - CABLE Output (VB-Audio Virtual Cable)'],
      ['Systemstandard', 'CABLE Input (VB-Audio Virtual Cable)', 'Lautsprecher (Realtek Audio)', 'VoiceMeeter Input (VB-Audio VoiceMeeter VAIO)'],
    ],
    'IN Panel Geräte: beide Eingänge aus derselben Eingangsliste, die Ausgabe mit „Systemstandard“ (leere ID) zuerst',
  );
  const leer = auswahlen(abschnitt(panel(stand({ einstellungen: einst({ floorId: '', interpreterId: '' }) })), ABSCHNITT.geraete));
  gleich([optionen(leer[0] ?? '')[0], optionen(leer[1] ?? '')[0]], [ABSCHNITT_TEXTE.bitteWaehlen, ABSCHNITT_TEXTE.bitteWaehlen], 'IN Panel Geräte: ohne Wahl steht „– bitte wählen –“ aus @jm/settings (vorher „— bitte wählen —“, Z1)');
  gleich(
    ['floor', 'dolmetscher', 'ausgabe'].map((k) => text(wahl(g, k)).includes(T.wechselWirktNachNeustart)),
    [true, true, true],
    'IN Panel Geräte E10: jede der drei Wahlen trägt „Wirkt erst nach Stopp und erneutem Start.“',
  );
  ok(!text(g).includes(AUDIO_TEXTE.aktualisieren), 'IN Panel Geräte: kein „Geräte aktualisieren“ (die Liste zieht sich über devicechange nach, refresh aus)');
  ok(!text(g).includes('Pegel:'), 'IN Panel Geräte: ohne Lauf kein Pegel in den Wahlen');
  const lauf = abschnitt(panel(stand({ engine: motor({ running: true, floorDb: -20, interpreterDb: -Infinity }), gestartet: { floorId: 'mic-a', interpreterId: 'mic-b' } })), ABSCHNITT.geraete);
  gleich([text(wahl(lauf, 'floor')).includes(AUDIO_TEXTE.pegelWert(-20)), text(wahl(lauf, 'dolmetscher')).includes(AUDIO_TEXTE.keinSignal), text(wahl(lauf, 'ausgabe')).includes('Pegel')], [true, true, false], 'IN Panel Geräte: im Lauf Pegel an Floor und Dolmetscher (level an), nie an der Ausgabe');
  // Fix-Runde 1: Floor im Lauf auf ein anderes Gerät gestellt → unter der geänderten Wahl kein Pegel (er gehört dem alten Gerät).
  const geaendert = abschnitt(panel(stand({ engine: motor({ running: true, floorDb: -20, interpreterDb: -30 }), einstellungen: einst({ floorId: 'mic-b' }), gestartet: { floorId: 'mic-a', interpreterId: 'mic-b' } })), ABSCHNITT.geraete);
  gleich(
    [text(wahl(geaendert, 'floor')).includes('Pegel'), text(wahl(geaendert, 'dolmetscher')).includes(AUDIO_TEXTE.pegelWert(-30)), text(wahl(geaendert, 'floor')).includes(T.wechselWirktNachNeustart)],
    [false, true, true],
    'IN Panel Geräte: im Lauf geänderter Floor ohne Pegel (nie der Pegel des alten Geräts unter dem neuen Namen), Dolmetscher mit Pegel, Wechselhinweis bleibt',
  );
  const unbekannt = abschnitt(panel(stand({ geraete: undefined })), ABSCHNITT.geraete);
  ok(auswahlen(unbekannt).length === 0 && text(unbekannt).includes('unbekannt'), 'IN Panel Geräte: vor der ersten Geräteliste „unbekannt“, keine erfundene Auswahl');
}

// ── IN Panel Ducking: Bypass, sieben Regler mit Bereich, Schritt, Vorgabe und Hinweis wie bisher, Zurücksetzen ──
{
  const d = abschnitt(panel(stand(), { ...WERTE, bypass: true, thresholdDb: -50 }), ABSCHNITT.ducking);
  const kasten = tags(d, 'input').find((t) => attr(t, 'type') === 'checkbox');
  ok(kasten !== undefined && kasten.includes(' checked') && attr(kasten, 'data-interpreter') === 'bypass' && text(d).includes('Überbrücken (zum Vergleichshören)'), 'IN Panel Ducking: Kontrollkästchen „Überbrücken (zum Vergleichshören)“, angehakt bei Bypass (App.tsx:154-157)');
  const regler = tags(d, 'input').filter((t) => attr(t, 'type') === 'range');
  gleich(
    regler.map((t) => [attr(t, 'min'), attr(t, 'max'), attr(t, 'step'), attr(t, 'value')]),
    [
      ['-70', '-10', '1', '-50'],
      ['-40', '0', '1', '-18'],
      ['5', '300', '5', '60'],
      ['50', '2000', '10', '400'],
      ['0', '1500', '10', '350'],
      ['-24', '12', '1', '0'],
      ['-24', '12', '1', '0'],
    ],
    'IN Panel Ducking: sieben Regler mit Bereich und Schritt wie bisher (Schwelle −70…−10, Absenkung −40…0, Attack 5…300/5, Release 50…2000/10, Nachlauf 0…1500/10, Vorverstärkung −24…12)',
  );
  gleich(
    [...DUCKING_REGLER, ...VORVERSTAERKUNG_REGLER].map((r) => [r.key, r.label, r.einheit, r.hinweis ?? '']),
    [
      ['thresholdDb', 'Schwelle', 'dB', 'Ab diesem Dolmetscher-Pegel wird der O-Ton abgesenkt.'],
      ['duckDb', 'Absenkung', 'dB', 'Wie weit der O-Ton zurückgeht, solange gesprochen wird.'],
      ['attackMs', 'Attack', 'ms', 'Wie schnell abgesenkt wird.'],
      ['releaseMs', 'Release', 'ms', 'Wie schnell der O-Ton zurückkommt.'],
      ['holdMs', 'Nachlauf', 'ms', 'Atempausen kürzer als der Nachlauf reißen den O-Ton nicht hoch (verhindert Pumpen).'],
      ['floorGainDb', 'Floor', 'dB', ''],
      ['interpreterGainDb', 'Dolmetscher', 'dB', ''],
    ],
    'IN Panel Ducking: Beschriftungen, Einheiten und Hinweise wörtlich wie bisher (App.tsx:159-174)',
  );
  const t = text(d);
  ok(
    ['Schwelle-50 dB', 'Absenkung-18 dB', 'Attack60 ms', 'Release400 ms', 'Nachlauf350 ms'].every((x) => t.includes(x)) && [...DUCKING_REGLER].every((r) => t.includes(r.hinweis ?? '')),
    'IN Panel Ducking: Wert mit Einheit rechts neben der Beschriftung („-50 dB“), Hinweis darunter',
  );
  ok(t.indexOf(T.ducking.vorverstaerkung) > t.indexOf('Nachlauf') && t.indexOf(T.ducking.vorverstaerkung) < t.lastIndexOf('Dolmetscher') && T.ducking.vorverstaerkung === 'Vorverstärkung', 'IN Panel Ducking: Unterüberschrift „Vorverstärkung“ vor den zwei Vorverstärkungen (vorher eigene Karte)');
  ok(t.trim().endsWith(T.ducking.zuruecksetzen) && T.ducking.zuruecksetzen === 'Ducking-Werte zurücksetzen', 'IN Panel Ducking: zuletzt der Knopf „Ducking-Werte zurücksetzen“ (nach der Vorverstärkung, wie bisher, Befund 8)');
  gleich(DEFAULT_SETTINGS, { thresholdDb: -42, duckDb: -18, attackMs: 60, releaseMs: 400, holdMs: 350, floorGainDb: 0, interpreterGainDb: 0 } satisfies DuckSettings, 'IN Panel Ducking: Vorgaben unverändert (src/shared/ducking.ts)');
  const ids = regler.map((r) => attr(r, 'id'));
  ok(ids.every((id) => id !== undefined && d.includes(`for="${id}"`)), 'IN Panel Ducking: jeder Regler ist mit seiner Beschriftung verbunden (label for)');
}

// ── IN Panel Verdrahtung: jedes Feld ruft dieselbe Store-Aktion wie bisher; keine Wahl startet oder stoppt ──
{
  const log: string[] = [];
  const els = elemente(Einstellungen({ stand: stand(), werte: WERTE, aktionen: aktionen(log) }));
  const geraet = els.find((e) => e.type === AudioDeviceSection)?.props as unknown as AudioDeviceSectionProps | undefined;
  geraet?.choices[0]?.onChange?.('mic-b');
  geraet?.choices[1]?.onChange?.('mic-a');
  geraet?.choices[2]?.onChange?.('lautsprecher');
  geraet?.choices[2]?.onChange?.('');
  (els.find((e) => e.type === 'input' && e.props.type === 'checkbox')?.props.onChange as ((e: unknown) => void) | undefined)?.({ target: { checked: true } });
  const regler = els.filter((e) => e.type === 'input' && e.props.type === 'range').map((e) => e.props.onChange as (e: unknown) => void);
  ['-50', '-20', '100', '800', '500', '6', '-3'].forEach((v, i) => regler[i]?.({ target: { value: v } }));
  const zurueck = els.find((e) => e.type === Button);
  (zurueck?.props.onClick as (() => void) | undefined)?.();
  gleich(
    log,
    [
      'set:floorId="mic-b"',
      'set:interpreterId="mic-a"',
      'set:outputId="lautsprecher"',
      'set:outputId=""',
      'set:bypass=true',
      'set:thresholdDb=-50',
      'set:duckDb=-20',
      'set:attackMs=100',
      'set:releaseMs=800',
      'set:holdMs=500',
      'set:floorGainDb=6',
      'set:interpreterGainDb=-3',
      'reset',
    ],
    'IN Panel Verdrahtung: Floor/Dolmetscher/Ausgabe → s.set(floorId|interpreterId|outputId), Bypass → s.set(bypass), sieben Regler → s.set(Schlüssel, Number(Wert)), Zurücksetzen → s.reset() (App.tsx:110-177)',
  );
  ok(log.every((z) => z.startsWith('set:') || z === 'reset'), 'IN Panel Verdrahtung: keine Wahl im Panel startet, stoppt oder leitet um (Wahl ≠ Bewegung; die Engine liest die Geräte nur in start())');
  gleich(els.filter((e) => e.type === 'input' && e.props.type === 'range').length + els.filter((e) => e.type === 'input' && e.props.type === 'checkbox').length + els.filter((e) => e.type === Button).length, 9, 'IN Panel Verdrahtung: sieben Regler, ein Kästchen, ein Knopf (keine toten Felder)');
  const ober = QUELLE('views/InterpreterOberflaeche.tsx');
  ok(ober.includes('panelAktionen(s)') && /settings=\{<Einstellungen stand=\{stand\} werte=\{\{ \.\.\.duckSettings\(s\), bypass: s\.bypass \}\} aktionen=\{panel\} \/>\}/.test(ober), 'IN Panel Verdrahtung: die View reicht den Store (set, reset) an panelAktionen und Stand und Werte an das Panel');
  // Die Wahlen wirken wie bisher nur im Speicher: die View ruft engine.start ausschließlich in der Haupttaste, Regler wirken live
  // über setSettings/setBypass (Effekte der Wurzel-View, App.tsx:73-79).
  ok(!/\.start\(|\.stop\(|setSinkId|route\(/.test(QUELLE('lib/aktionen.ts').replace(/motor\.(start|stop)\(/g, '')), 'IN Panel Verdrahtung: lib/aktionen.ts ruft start/stop nur über den Motor der Haupttaste');
}

// ── IN Panel ohne Effekte und Tasten (E15, O1, Nr. 78) ──
{
  const q = QUELLE('views/Einstellungen.tsx');
  ok(!/\buse[A-Z]\w*\(/.test(q) && !/\bwindow\b/.test(q) && !q.includes('useSettings') && !q.includes('jminterpreter') && !q.includes('onKeyDown'), 'IN Panel Abschnitte: Einstellungen.tsx ohne window, ohne Hooks, ohne Store und ohne eigene Tasten (E15)');
  const ak = QUELLE('lib/aktionen.ts');
  ok(!/(?<![\w-])window\b|\bdocument\b|\bnavigator\b|\blocalStorage\b|from ['"]@\/store\//.test(ak), 'IN Panel Abschnitte: lib/aktionen.ts rein (kein window, navigator, document, Store-Import)');
  const ereignis = (key: string, ziel: unknown, log: string[]) => ({ key, defaultPrevented: false, target: ziel, stopPropagation: () => void log.push('stop'), preventDefault: () => void log.push('prevent') });
  const esc: string[] = [];
  panelTaste(ereignis('Escape', { tagName: 'BUTTON', type: 'button' }, esc), () => void esc.push('zu'));
  const feld: string[] = [];
  panelTaste(ereignis('ArrowDown', { tagName: 'SELECT' }, feld), () => void feld.push('zu'));
  const bereich: string[] = [];
  panelTaste(ereignis('ArrowLeft', { tagName: 'INPUT', type: 'range' }, bereich), () => void bereich.push('zu'));
  const leer: string[] = [];
  panelTaste(ereignis(' ', { tagName: 'INPUT', type: 'checkbox' }, leer), () => void leer.push('zu'));
  gleich([esc, feld, bereich, leer], [['stop', 'prevent', 'zu'], ['stop'], ['stop'], []], 'IN Panel Tasten: Escape schließt das Panel, Auswahl und Regler behalten ihre Pfeile, die Leertaste auf dem Kästchen geht ans Tool (O1; der Interpreter hat keine Kürzel)');
  ok(geraete().labelsAvailable, 'IN Panel Tasten: Testzustand mit lesbaren Namen');
}
