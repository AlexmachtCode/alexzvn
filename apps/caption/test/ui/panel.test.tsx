// UX Welle 2a, Caption d · Einstellungs-Panel (Spec 3.6, 6; E8, E9, E15; O1; Funktionsliste Nr. 5–8, 13–23, 99, 101–104): NDI-Ausgabe
// (Quellname, Auflösung aus RES, Bildrate 25/30/50/60, keine Transparenz), Audiogerät (eine Wahl, System-Standard, ⟳ als
// „Geräte aktualisieren“, Pegel), Fernsteuerung (Modul „JM Caption“, Port 8732), dann die tool-eigenen Abschnitte Erkennung
// (Modell, Sprache, Engine, Wörterbuch, Max. Äußerung) und Darstellung (Schrift, Zeilen, Band). Jeder Abschnitt ist ein
// Sprungziel, jedes Feld ruft dieselbe Store-Aktion wie bisher (Attrappen). Eine Wahl löst keinen Start aus (Wahl ≠ Bewegung).
import { AUDIO_TEXTE, AudioDeviceSection, NDI_TEXTE, NdiOutputSection, REMOTE_TEXTE, type AudioDeviceSectionProps, type NdiOutputSectionProps } from '@jm/settings';
import { Select } from '@jm/ui';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { geraeteListe, panelAktionen, type EinstellungenAktionen } from '@/lib/aktionen';
import { ABSCHNITT, CAPTION_TEXTE, ENGINES, MODELLE, SPRACHEN, statusLeiste, type OberflaechenStand } from '@/lib/oberflaeche';
import { Einstellungen } from '@/views/Einstellungen';
import { panelTaste } from '../../../../packages/ui/src/components/SettingsPanel';
import { abschnitt, attr, basisMeldung, caption, elemente, GERAETE, ohneKommentare, store, tags, text, warte } from './testzustand';

const T = CAPTION_TEXTE;
const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
function stand(z: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return { caption: caption(), geraete: GERAETE, micError: null, pegel: 0, masterLink: undefined, fernsteuerung: undefined, ...z };
}
/** Panel-Aktionen wie in der View, aus den Store-Attrappen; „Geräte aktualisieren“ schreibt refreshDevices ins Protokoll. */
const aktionen = (log: string[] = [], name: string | undefined = 'JM Caption'): EinstellungenAktionen => panelAktionen(store(log), name, () => void log.push('refreshDevices'));
const panel = (s: OberflaechenStand, log: string[] = []): string => render(<Einstellungen stand={s} aktionen={aktionen(log)} />);
const titel = (html: string): string[] => [...html.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]);
const optionen = (sel: string): string[] => [...sel.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map((m) => m[1]);
/** Die Auswahlfelder eines Abschnitts als HTML (vom öffnenden bis zum schließenden Tag). */
const auswahlen = (h: string): string[] => [...h.matchAll(/<select[\s\S]*?<\/select>/g)].map((m) => m[0]);

// ── CA Panel Abschnitte: Anker, Reihenfolge, Titel ──
{
  const log: string[] = [];
  const html = panel(stand(), log);
  const anker = Object.values(ABSCHNITT).map((id) => html.indexOf(`id="einstellung-${id}"`));
  ok(anker.every((p, i) => p >= 0 && (i === 0 || p > anker[i - 1])), `CA Panel Abschnitte: Anker für alle ABSCHNITT-Werte in der Reihenfolge NDI, Mikrofon, Fernsteuerung, Erkennung, Darstellung (${anker.join(', ')})`);
  gleich(titel(html), [NDI_TEXTE.titel, AUDIO_TEXTE.titel, REMOTE_TEXTE.titel, T.erkennung.titel, T.darstellung.titel], 'CA Panel Abschnitte: NDI-Ausgabe, Audiogerät, Fernsteuerung, Erkennung, Darstellung');
  const ziele = [stand(), stand({ caption: undefined }), stand({ micError: 'x' })].flatMap((x) => statusLeiste(x).map((i) => i.settingsSection)).filter((z): z is string => typeof z === 'string');
  gleich([...new Set(ziele)].filter((z) => !html.includes(`id="einstellung-${z}"`)), [], 'CA Panel Abschnitte: jeder Statuseintrag mit Abschnitt findet seinen Anker');
  pruefeIdVerweise(html, 'CA Panel Abschnitte: id-Verweise gültig');
  gleich(log, [], 'CA Panel Abschnitte: Rendern löst keine Aktion aus');
  ok(!text(html).includes('"') && !text(panel(stand({ caption: undefined }))).includes('"'), 'CA Panel Abschnitte: kein ASCII-Anführungszeichen in den Texten des Panels');
  ok([...MODELLE, ...SPRACHEN, ...ENGINES].every((x) => !x.label.includes('"')), 'CA Panel Abschnitte: Beschriftungen der Wahlen ohne ASCII-Anführungszeichen');
}

// ── CA Panel NDI-Ausgabe: Quellname, Auflösung, Bildrate, keine Transparenz; vor der Antwort gesperrt ──
{
  const n = abschnitt(panel(stand({ caption: caption({ config: { ndiName: 'Saal 2', ndiWidth: 1280, ndiHeight: 720, ndiFps: 50 } }) })), ABSCHNITT.ndi);
  const [aufl, fps] = auswahlen(n);
  ok(text(n).includes(NDI_TEXTE.quellenname) && tags(n, 'input').some((t) => attr(t, 'value') === 'Saal 2'), 'CA Panel NDI: Feld „Quellenname“ mit dem gemerkten Namen');
  gleich([optionen(aufl ?? ''), optionen(fps ?? '')], [['1080p', '720p', '2160p'], ['25', '30', '50', '60']], 'CA Panel NDI: Auflösung 1080p, 720p, 2160p (RES) und Bildrate 25, 30, 50, 60 wie bisher');
  ok(!text(n).includes(NDI_TEXTE.transparenz), 'CA Panel NDI: keine Wahl der Transparenz (die Quelle ist immer transparent)');
  ok(n.includes('role="switch"') && text(n).includes(NDI_TEXTE.ausgabe), 'CA Panel NDI: Schalter „Ausgabe“ (wie die Taste NDI)');
  const vorher = abschnitt(panel(stand({ caption: undefined })), ABSCHNITT.ndi);
  const schalter = tags(vorher, 'button').filter((t) => attr(t, 'role') === 'switch');
  ok(text(vorher).includes(`Gesperrt: ${T.grund.zustandOffen}`) && schalter.length === 1 && schalter.every((t) => attr(t, 'disabled') !== undefined),'CA Panel NDI: vor der ersten Antwort gesperrt mit Grund „Lädt …“ (wie die Tasten)');
}

// ── CA Panel Mikrofon: eine Wahl „Audio-Eingang (Mikrofon)“, System-Standard, Geräte, Aktualisieren ──
{
  const m = abschnitt(panel(stand()), ABSCHNITT.mikrofon);
  ok(text(m).includes(T.mikrofon.wahl), 'CA Panel Mikrofon: Wahl „Audio-Eingang (Mikrofon)“ (der Tooltip des alten Felds wird Beschriftung)');
  gleich(optionen(auswahlen(m)[0] ?? ''), [T.mikrofon.standard, 'Shure MV7', 'Headset'], 'CA Panel Mikrofon: „System-Standard (Mikrofon)“, dann die gemessenen Eingänge');
  ok([...m.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].some((x) => text(x[1]).includes(AUDIO_TEXTE.aktualisieren)), 'CA Panel Mikrofon: „Geräte aktualisieren“ (ersetzt ⟳)');
  gleich(geraeteListe([{ deviceId: 'a', label: 'Mikro' }, { deviceId: 'b', label: '' }]), [{ id: 'a', label: 'Mikro' }, { id: 'b', label: T.mikrofon.ohneName(2) }], 'CA Panel Mikrofon: Eingänge ohne Namen heißen „Audiogerät n“ wie bisher (Zählung ab 1)');
  ok(T.mikrofon.ohneName(2) === 'Audiogerät 2', 'CA Panel Mikrofon: Wortlaut „Audiogerät n“ unverändert');
}

// ── CA Panel Fernsteuerung ──
{
  const f = abschnitt(panel(stand({ fernsteuerung: basisMeldung({ clients: 2 }) })), ABSCHNITT.fernsteuerung);
  ok(text(f).includes('8732') && text(f).includes('Modul „JM Caption“') && !f.includes('role="switch"'), 'CA Panel Fernsteuerung: Port 8732 und Companion-Modul „JM Caption“, ohne Schalter');
}

// ── CA Panel Erkennung: Modell, Sprache, Engine, Wörterbuch, Max. Äußerung ──
{
  const e = abschnitt(panel(stand({ caption: caption({ config: { model: 'small', language: 'en', engine: 'cli', dictionary: 'iveo', maxUtteranceSec: 6 } }) })), ABSCHNITT.erkennung);
  const [modell, sprache, engine] = auswahlen(e);
  gleich(
    [optionen(modell ?? ''), optionen(sprache ?? ''), optionen(engine ?? '')],
    [['Tiny (schnell)', 'Base', 'Small', 'Medium', 'Large v3 (genau)'], ['Deutsch', 'Englisch', 'Auto-Erkennung'], ['Server (schnell, Modell bleibt geladen)', 'CLI (pro Äußerung)']],
    'CA Panel Erkennung: Modell, Sprache und Engine mit den Einträgen von heute',
  );
  ok([T.erkennung.modell, T.erkennung.sprache, T.erkennung.engine, T.erkennung.woerterbuch, T.erkennung.maxAeusserung].every((w) => text(e).includes(w)), 'CA Panel Erkennung: Beschriftungen Modell, Sprache, Engine, „Fachwörter-Wörterbuch (eine je Zeile)“, „Max. Äußerung (s)“');
  const wb = e.match(/<textarea[^>]*>[^<]*<\/textarea>/)?.[0] ?? '';
  ok(attr(wb, 'rows') === '4' && attr(wb, 'placeholder') === 'z. B.\nJakobs Medien\niveo\nNITROVON' && wb.includes('>iveo</textarea>'), 'CA Panel Erkennung: Wörterbuch mit 4 Zeilen und dem alten Platzhalter');
  const zahl = tags(e, 'input').find((t) => attr(t, 'type') === 'number');
  gleich([attr(zahl, 'min'), attr(zahl, 'max'), attr(zahl, 'value')], ['2', '15', '6'], 'CA Panel Erkennung: Max. Äußerung als Zahlenfeld 2 bis 15 wie bisher (Nr. 23, 101)');
  ok(text(abschnitt(panel(stand({ caption: undefined })), ABSCHNITT.erkennung)).includes('unbekannt') && auswahlen(abschnitt(panel(stand({ caption: undefined })), ABSCHNITT.erkennung)).length === 0, 'CA Panel Erkennung: vor der ersten Antwort „unbekannt“, keine erfundenen Werte');
}

// ── CA Panel Darstellung: Schrift, Zeilen, Band ──
{
  const d = abschnitt(panel(stand({ caption: caption({ config: { ndiFontSize: 72, ndiLines: 3, ndiBand: false } }) })), ABSCHNITT.darstellung);
  const zahl = tags(d, 'input').find((t) => attr(t, 'type') === 'number');
  gleich([attr(zahl, 'min'), attr(zahl, 'max'), attr(zahl, 'value')], ['16', '160', '72'], 'CA Panel Darstellung: Schrift als Zahlenfeld 16 bis 160 wie bisher (Nr. 16, 101)');
  gleich(optionen(auswahlen(d)[0] ?? ''), ['1', '2', '3'], 'CA Panel Darstellung: Zeilen 1, 2, 3');
  const kasten = tags(d, 'input').find((t) => attr(t, 'type') === 'checkbox');
  ok(kasten !== undefined && !kasten.includes(' checked') && text(d).includes(T.darstellung.band), 'CA Panel Darstellung: Kontrollkästchen „Band“');
  ok([T.darstellung.schrift, T.darstellung.zeilen].every((w) => text(d).includes(w)), 'CA Panel Darstellung: Beschriftungen „Schrift“ und „Zeilen“ wie bisher');
}

// ── CA Panel Verdrahtung: jedes Feld ruft dieselbe Store-Aktion wie bisher; eine Wahl startet nichts ──
{
  const log: string[] = [];
  const els = elemente(Einstellungen({ stand: stand(), aktionen: aktionen(log) }));
  const ndi = els.find((e) => e.type === NdiOutputSection)?.props as unknown as NdiOutputSectionProps | undefined;
  ndi?.onToggle?.(true);
  ndi?.onToggle?.(false);
  ndi?.onRename?.('Saal 2');
  ndi?.onResolution?.('1280x720');
  ndi?.onFps?.('50');
  const geraet = els.find((e) => e.type === AudioDeviceSection)?.props as unknown as AudioDeviceSectionProps | undefined;
  geraet?.choices[0]?.onChange?.('mic-2');
  geraet?.onRefresh?.();
  const wahlen = els.filter((e) => e.type === Select).map((e) => e.props.onChange as (v: string) => void);
  wahlen[0]?.('large-v3');
  wahlen[1]?.('auto');
  wahlen[2]?.('cli');
  wahlen[3]?.('3');
  const feld = (art: string) => els.find((e) => e.type === art);
  (feld('textarea')?.props.onChange as ((e: unknown) => void) | undefined)?.({ target: { value: 'iveo\nNITROVON' } });
  const zahlen = els.filter((e) => e.type === 'input' && e.props.type === 'number').map((e) => e.props.onChange as (e: unknown) => void);
  zahlen[0]?.({ target: { value: '12' } });
  zahlen[1]?.({ target: { value: '96' } });
  (els.find((e) => e.type === 'input' && e.props.type === 'checkbox')?.props.onChange as ((e: unknown) => void) | undefined)?.({ target: { checked: false } });
  await warte();
  gleich(
    log,
    [
      'ndiStart:JM Caption',
      'ndiStop',
      'setConfig:{"ndiName":"Saal 2"}',
      'setConfig:{"ndiWidth":1280,"ndiHeight":720}',
      'setConfig:{"ndiFps":50}',
      'setConfig:{"audioInputDeviceId":"mic-2"}',
      'refreshDevices',
      'setConfig:{"model":"large-v3"}',
      'setConfig:{"language":"auto"}',
      'setConfig:{"engine":"cli"}',
      'setConfig:{"ndiLines":3}',
      'setConfig:{"dictionary":"iveo\\nNITROVON"}',
      'setConfig:{"maxUtteranceSec":12}',
      'setConfig:{"ndiFontSize":96}',
      'setConfig:{"ndiBand":false}',
    ],
    'CA Panel Verdrahtung: NDI-Schalter → ndiStart(Name)/ndiStop, Quellname/Auflösung/Bildrate/Eingang/Modell/Sprache/Engine/Zeilen/Wörterbuch/Max. Äußerung/Schrift/Band → setConfig wie bisher, Aktualisieren → refreshDevices',
  );
  gleich(
    log.filter((z) => /^(start|stop|setHold|clear|correctLine)/.test(z)),
    [],
    'CA Panel Verdrahtung: keine Wahl im Panel startet oder stoppt die Transkription, schaltet Hold oder leert (Wahl ≠ Bewegung); NDI schaltet nur der Schalter „Ausgabe“',
  );
  // Leeres Zahlenfeld wird 0, eine Zahl außerhalb bleibt stehen (wie heute, Nr. 101, Befund 8).
  const log2: string[] = [];
  const els2 = elemente(Einstellungen({ stand: stand(), aktionen: aktionen(log2) }));
  const z2 = els2.filter((e) => e.type === 'input' && e.props.type === 'number').map((e) => e.props.onChange as (e: unknown) => void);
  z2[0]?.({ target: { value: '' } });
  z2[1]?.({ target: { value: '400' } });
  await warte();
  gleich(log2, ['setConfig:{"maxUtteranceSec":0}', 'setConfig:{"ndiFontSize":400}'], 'CA Panel Verdrahtung: Zahlenfelder setzen Number(Wert) bei jeder Taste, ohne Klemmen (wie heute)');
  const ober = QUELLE('views/CaptionOberflaeche.tsx');
  ok(ober.includes('panelAktionen(store, cfg?.ndiName, refreshDevices)') && ober.includes('settings={<Einstellungen stand={stand} aktionen={panel} />}'), 'CA Panel Verdrahtung: die View reicht Store-Aktionen, Quellnamen und refreshDevices an panelAktionen und den Stand an das Panel');
}

// ── CA Panel ohne Effekte und Tasten (E15, O1, Nr. 99) ──
{
  const q = QUELLE('views/Einstellungen.tsx');
  ok(!/\buse[A-Z]\w*\(/.test(q) && !/\bwindow\b/.test(q) && !q.includes('useCaption') && !q.includes('jmcaption') && !q.includes('onKeyDown'), 'CA Panel Abschnitte: Einstellungen.tsx ohne window, ohne Hooks, ohne Store und ohne eigene Tasten (E15)');
  ok(!/\b(start|stop|setHold|clear|ndiStart|ndiStop)\(/.test(q), 'CA Panel Abschnitte: Einstellungen.tsx ruft keine Live-Aktion selbst');
  const ak = QUELLE('lib/aktionen.ts');
  ok(!/(?<![\w-])window\b|\bdocument\b|\bnavigator\b|\blocalStorage\b|from ['"]@\/store\//.test(ak), 'CA Panel Abschnitte: lib/aktionen.ts rein (kein window, navigator, document, Store-Import)');
  const ereignis = (key: string, ziel: unknown, log: string[]) => ({ key, defaultPrevented: false, target: ziel, stopPropagation: () => void log.push('stop'), preventDefault: () => void log.push('prevent') });
  const esc: string[] = [];
  panelTaste(ereignis('Escape', { tagName: 'BUTTON', type: 'button' }, esc), () => void esc.push('zu'));
  const feld: string[] = [];
  panelTaste(ereignis('ArrowUp', { tagName: 'SELECT' }, feld), () => void feld.push('zu'));
  const leer: string[] = [];
  panelTaste(ereignis(' ', { tagName: 'BUTTON', type: 'button' }, leer), () => void leer.push('zu'));
  gleich([esc, feld, leer], [['stop', 'prevent', 'zu'], ['stop'], []], 'CA Panel Tasten: Escape schließt das Panel, ein Feld behält seine Tasten, die Leertaste auf einem Knopf geht ans Tool (O1; Caption hat keine Kürzel)');
}
