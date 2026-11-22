// UX Welle 2a, Interpreter d · Live-Bereich (Spec 3.4, 5.1; E4, E10; Funktionsliste Nr. 5–7, 12–27): oben in einer Zeile die Karte
// „Pegel“ (Meter Floor und Dolmetscher, Ducking-Pille, „Überbrückt“ bei Bypass) und rechts die Haupttaste Starten/Stoppen (ihr
// alter Platz oben rechts), darunter das Fehlerband und die Kabel-Hinweiskarten mit dem Download-Knopf. Jede Taste ruft dieselbe
// Engine- bzw. Preload-Aktion wie bisher (Attrappen, Klick über die Verdrahtung des TallyButton). Dazu der Wächter „IN keine
// rohen Farben“ (die Notice-Töne emerald/yellow werden ok/warn). Render ohne Browser und ohne window.
import { STATUS_SYMBOL, TallyButton, type TallyButtonProps, UNBEKANNT } from '@jm/ui';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { kabelHerunterladen, liveAktionen, type LiveAktionen } from '@/lib/aktionen';
import { hauptTaste, INTERPRETER_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';
import { HINWEIS_TON, LiveBereich, liveTaste, meterBreite } from '@/views/LiveBereich';
import { InterpreterOberflaeche } from '@/views/InterpreterOberflaeche';
import { tallyHandler } from '../../../../packages/ui/src/components/TallyButton';
import { erzeugeHalten } from '../../../../packages/ui/src/lib/halten';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { attr, einst, element, elemente, geraete, mitStore, motor, motorAttrappe, ohneKommentare, quellen, stand, tags, text, warte } from './testzustand';

const T = INTERPRETER_TEXTE;
const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
const inhalt = (html: string): string => element(html, 'main', '');
const BOOL = [false, true] as const;

/** Aktionen wie in der View: aus der Motor-Attrappe; der Download schreibt ins Protokoll. */
function aktionen(s: OberflaechenStand, log: string[] = []): LiveAktionen {
  const e = s.einstellungen;
  return liveAktionen(motorAttrappe(log), s.engine?.running === true, { floorId: e?.floorId ?? '', interpreterId: e?.interpreterId ?? '', outputId: e?.outputId ?? '' }, () => void log.push('download'));
}
const live = (s: OberflaechenStand, log: string[] = [], schwelle = -42): string => render(<LiveBereich stand={s} schwelleDb={schwelle} aktionen={aktionen(s, log)} />);
const baum = (s: OberflaechenStand, log: string[] = []) => elemente(LiveBereich({ stand: s, schwelleDb: -42, aktionen: aktionen(s, log) }));
/** Klick wie im Fenster: über die Ereignis-Verdrahtung des TallyButton (eine gesperrte Taste klickt nicht). */
const klick = (p: TallyButtonProps): void => tallyHandler(p, erzeugeHalten({})).onClick();
const teil = (html: string, id: string, name = 'div'): string => element(html, name, `data-interpreter="${id}"`);

interface Knopf {
  label: string | undefined;
  state: string | undefined;
  gesperrt: string | undefined;
  grund: string | undefined;
}
function knoepfe(html: string): Knopf[] {
  return [...html.matchAll(/(<button[^>]*\sdata-state="[^"]*"[^>]*>)([\s\S]*?)<\/button>/g)].map((m) => ({
    label: [...m[2].matchAll(/<span>([^<]*)<\/span>/g)].map((x) => x[1]).join(''),
    state: attr(m[1], 'data-state'),
    gesperrt: attr(m[1], 'aria-disabled'),
    grund: m[2].match(/<span id="[^"]*"[^>]*>([^<]*)<\/span>/)?.[1],
  }));
}

// ── IN Live: Meter, Pille, Taste und Kabelkarten ohne Klick im Inhalt, in dieser Reihenfolge ──
{
  const html = mitStore({ outputId: '', bypass: true }, () => render(<InterpreterOberflaeche />));
  const m = inhalt(html);
  const reihe = ['data-interpreter="live"', 'data-interpreter="kopfzeile"', 'data-interpreter="pegel"', 'data-interpreter="pille"', 'data-interpreter="ueberbrueckt"', 'data-interpreter="meter-floor"', 'data-interpreter="meter-dolmetscher"', 'data-interpreter="taste"', 'data-interpreter="kabel"'];
  const pos = reihe.map((s) => m.indexOf(s));
  ok(pos.slice(0, -1).every((p, i) => p >= 0 && (i === 0 || p > pos[i - 1])), `IN Live: im Inhalt ohne Klick Pegel-Karte mit Pille, Überbrückt und beiden Metern, dann die Haupttaste (${pos.join(', ')})`);
  ok(m.includes('data-interpreter="kabel"') && pos[8] > pos[7], 'IN Live: die Kabel-Karten stehen unter Metern und Taste (vor der ersten Geräteliste leer, wie bisher)');
  gleich(knoepfe(m).map((k) => [k.label, k.state, k.grund]), [[T.taste.starten, 'gesperrt', T.grund.zustandOffen]], 'IN Live: genau eine Haupttaste; vor der ersten Antwort gesperrt mit sichtbarem Grund „Lädt …“');
  pruefeIdVerweise(html, 'IN Live: id-Verweise gültig');
  ok(!text(m).includes('"'), 'IN Live: kein ASCII-Anführungszeichen im Text des Live-Bereichs');
  // Ruhe-Stand vor der ersten Antwort: Meter „—“, Pille unbekannt (kein erfundenes „Floor offen“).
  gleich(text(teil(m, 'pille', 'span')), UNBEKANNT, 'IN Live: die Pille sagt vor der ersten Antwort der Engine „unbekannt“');
}

// ── IN Live Haupttaste: genau hauptTaste, Platz oben rechts wie bisher ──
{
  const faelle = kreuz({ antwort: BOOL, running: BOOL, floor: ['', 'mic-a'], dolmetscher: ['', 'mic-b'] } as const);
  pruefeFaelle('IN Live Haupttaste: TallyButton mit Beschriftung, Zustand, Sperre und sichtbarem Grund aus hauptTaste', faelle, (f) => {
    const s = stand({ engine: f.antwort ? motor({ running: f.running }) : undefined, einstellungen: einst({ floorId: f.floor, interpreterId: f.dolmetscher }) });
    const t = hauptTaste(s);
    const ist = knoepfe(live(s))[0];
    const soll: Knopf = { label: t.label, state: t.state, gesperrt: t.state === 'gesperrt' ? 'true' : undefined, grund: t.state === 'gesperrt' ? t.disabledReason : undefined };
    return vergleiche(JSON.stringify(ist), JSON.stringify(soll));
  });
  const gesperrt = live(stand({ einstellungen: einst({ floorId: '' }) }));
  const [knopf] = tags(gesperrt, 'button').filter((x) => attr(x, 'data-state') !== undefined);
  ok(attr(knopf, 'title') === 'Erst beide Eingänge wählen' && text(gesperrt).includes('Erst beide Eingänge wählen'), 'IN Live Haupttaste: der alte Tooltip „Erst beide Eingänge wählen“ bleibt (title) und steht zusätzlich sichtbar unter der Taste');
  // Platz: oben rechts in der ersten Zeile des Live-Bereichs (wie der alte Knopf rechts im Kopf, App.tsx:88-103), feste Breite,
  // in einer zentrierten Spalte so breit wie die alte (max-w-4xl, mx-auto).
  const h = live(stand());
  const zeile = teil(h, 'kopfzeile');
  const klassen = (id: string): string[] => (attr(tags(h, 'div').find((x) => attr(x, 'data-interpreter') === id), 'class') ?? '').split(/\s+/);
  ok(zeile.indexOf('data-interpreter="pegel"') < zeile.indexOf('data-interpreter="taste"') && zeile.indexOf('data-interpreter="pegel"') > 0, 'IN Live Haupttaste: in der Kopfzeile des Live-Bereichs steht die Taste rechts neben der Pegel-Karte');
  ok(['flex', 'items-start', 'gap-3'].every((k) => klassen('kopfzeile').includes(k)) && !klassen('kopfzeile').includes('flex-wrap'), 'IN Live Haupttaste: die Kopfzeile bricht nie um (die Taste bleibt bei jeder Fenstergröße oben rechts)');
  ok(['w-56', 'shrink-0'].every((k) => klassen('taste').includes(k)), 'IN Live Haupttaste: die Taste hat eine feste Breite (14 rem) und schrumpft nicht');
  const wurzel = (attr(tags(h, 'section').find((x) => attr(x, 'data-interpreter') === 'live'), 'class') ?? '').split(/\s+/);
  ok(['mx-auto', 'max-w-4xl'].every((k) => wurzel.includes(k)), 'IN Live Haupttaste: der Live-Bereich ist die alte zentrierte Spalte (max-w-4xl, mx-auto), damit die Taste am alten Platz oben rechts steht');
  const css = ohneKommentare(leseText('src/renderer/src/globals.css')).replace(/\s+/g, ' ');
  ok(
    /@media \(width < 900px\) \{ \[data-bereich='inhalt'\]:has\(> aside\) \[data-interpreter='live'\] \{ max-width: calc\(100vw - var\(--panel-w\) - 2\.5rem\); margin-inline: 0; \} \}/.test(css),
    'IN Live Haupttaste: unter 900 px liegt das Panel über dem Inhalt; nur bei offenem Panel (:has(> aside)) bleibt der Live-Bereich links daneben (globals.css, ohne Panelzustand in der View)',
  );
}

// ── IN Live Verdrahtung: die Taste ruft engine.start mit den drei gemerkten Geräten bzw. engine.stop, wie der alte Knopf ──
{
  // Orakel aus dem alten Code (App.tsx:81-84 bei d7cdd79ce0): running ? engine.stop() : engine.start({ floorId, interpreterId, outputId }).
  const faelle = kreuz({ antwort: BOOL, running: BOOL, floor: ['', 'mic-a'], ausgabe: ['', 'cable-in'] } as const);
  pruefeFaelle('IN Live Verdrahtung: Klick über tallyHandler ruft stop bzw. start mit floorId, interpreterId, outputId; gesperrt nichts', faelle, (f) => {
    const log: string[] = [];
    const s = stand({ engine: f.antwort ? motor({ running: f.running }) : undefined, einstellungen: einst({ floorId: f.floor, outputId: f.ausgabe }) });
    klick(liveTaste(s, aktionen(s, log)));
    const gesperrt = !f.antwort || f.floor === '';
    const soll = gesperrt ? [] : [f.running ? 'stop' : `start:${JSON.stringify({ floorId: f.floor, interpreterId: 'mic-b', outputId: f.ausgabe })}`];
    return vergleiche(log.join(','), soll.join(','));
  });
  pruefeFaelle('IN Live Verdrahtung: liveTaste ist genau hauptTaste plus Klick (keine zweite Rechnung)', kreuz({ antwort: BOOL, running: BOOL, floor: ['', 'mic-a'] } as const), (f) => {
    const s = stand({ engine: f.antwort ? motor({ running: f.running }) : undefined, einstellungen: einst({ floorId: f.floor }) });
    const { onClick, ...rest } = liveTaste(s, aktionen(s));
    return vergleiche(JSON.stringify([rest, typeof onClick]), JSON.stringify([hauptTaste(s), 'function']));
  });
  const log: string[] = [];
  const s = stand({ engine: motor({ running: true }) });
  const tallys = baum(s, log).filter((e) => e.type === TallyButton);
  for (const t of tallys) klick(t.props as unknown as TallyButtonProps);
  gleich([tallys.length, log], [1, ['stop']], 'IN Live Verdrahtung: der eine TallyButton im gerenderten Live-Bereich klickt engine.stop() im Lauf');
  const ober = QUELLE('views/InterpreterOberflaeche.tsx');
  ok(
    /liveAktionen\(\s*engine,\s*state\?\.running === true,\s*\{ floorId: s\.floorId, interpreterId: s\.interpreterId, outputId: s\.outputId \},/.test(ober),
    'IN Live Verdrahtung: die View reicht die Engine selbst, running aus dem Zustand und die drei Geräte aus dem Store an liveAktionen',
  );
}

// ── IN Live Download: VB-CABLE herunterladen ruft openCableDownload über den Preload wie bisher ──
{
  const s = stand({ einstellungen: einst({ outputId: '' }) });
  const log: string[] = [];
  const knopf = baum(s, log).find((e) => e.type !== TallyButton && typeof e.props.onClick === 'function' && /herunterladen/.test(JSON.stringify(e.props.children ?? '')));
  (knopf?.props.onClick as (() => void) | undefined)?.();
  gleich(log, ['download'], 'IN Live Download: der Knopf „VB-CABLE herunterladen“ ruft die Download-Aktion der View');
  const aufrufe: string[] = [];
  kabelHerunterladen({ openCableDownload: async () => void aufrufe.push('openCableDownload') });
  kabelHerunterladen(undefined);
  let geworfen = false;
  try {
    kabelHerunterladen({ openCableDownload: () => Promise.reject(new Error('kein Browser')) });
  } catch {
    geworfen = true;
  }
  await warte();
  gleich([aufrufe, geworfen], [['openCableDownload'], false], 'IN Live Download: openCableDownload() über den Preload; fehlt der Preload, passiert nichts; ein Fehler wird still geschluckt (App.tsx:302-306)');
  const ober = QUELLE('views/InterpreterOberflaeche.tsx');
  ok(ober.includes('() => kabelHerunterladen(window.jminterpreter)'), 'IN Live Download: die View liest window.jminterpreter erst beim Klick (Rückruf), wie bisher');
}

// ── IN Live Meter, Pille, Überbrückt ──
{
  gleich([meterBreite(-Infinity), meterBreite(Number.NaN), meterBreite(-60), meterBreite(-30), meterBreite(0), meterBreite(6)], [0, 0, 0, 0.5, 1, 1], 'IN Live Meter: Skala −60 dBFS (0 %) bis 0 dBFS (100 %), nichts Endliches darunter, −∞ und NaN 0 % (App.tsx:216-219)');
  const h = live(stand({ engine: motor({ running: true, floorDb: -23.44, interpreterDb: -Infinity }) }), [], -42);
  const floor = teil(h, 'meter-floor');
  const dolm = teil(h, 'meter-dolmetscher');
  gleich(
    [text(element(floor, 'span', 'data-interpreter="wert"')), text(element(dolm, 'span', 'data-interpreter="wert"'))],
    ['-23.4 dB', '—'],
    'IN Live Meter: Pegel mit einer Nachkommastelle („-23.4 dB“), bei Stille „—“ (App.tsx:226)',
  );
  ok(text(floor).startsWith(T.geraete.floorKurz) && text(dolm).startsWith(T.geraete.dolmetscher), 'IN Live Meter: Beschriftungen „Floor“ und „Dolmetscher“ wie bisher');
  const balken = (x: string): string | undefined => attr(tags(x, 'div').find((t) => attr(t, 'data-interpreter') === 'balken'), 'style');
  gleich([balken(floor), balken(dolm)], [`width:${meterBreite(-23.44) * 100}%`, 'width:0%'], 'IN Live Meter: Balkenbreite aus meterBreite');
  const schwelle = tags(h, 'div').filter((t) => attr(t, 'data-interpreter') === 'schwelle');
  gleich([schwelle.length, attr(schwelle[0], 'title'), attr(schwelle[0], 'style')], [1, 'Schwelle -42 dB', `left:${meterBreite(-42) * 100}%`], 'IN Live Meter: nur der Dolmetscher-Meter trägt die Schwellenmarke mit Tooltip „Schwelle ‹Wert› dB“ (App.tsx:230-236)');
  ok(floor.indexOf('data-interpreter="schwelle"') < 0 && dolm.includes('data-interpreter="schwelle"'), 'IN Live Meter: die Schwellenmarke sitzt im Dolmetscher-Meter');

  const faelle = kreuz({ antwort: BOOL, ducking: BOOL, bypass: BOOL, running: BOOL } as const);
  pruefeFaelle('IN Live Pille und Überbrückt: Pille „FLOOR ABGESENKT“/„Floor offen“ nach ducking (vor der Antwort „unbekannt“), „Überbrückt“ genau bei Bypass (E10)', faelle, (f) => {
    const s = stand({ engine: f.antwort ? motor({ running: f.running, ducking: f.ducking }) : undefined, einstellungen: einst({ bypass: f.bypass }) });
    const x = live(s);
    const pille = text(teil(x, 'pille', 'span'));
    const ue = teil(x, 'ueberbrueckt', 'span');
    const pilleSoll = !f.antwort ? UNBEKANNT : f.ducking ? T.live.abgesenkt : T.live.offen;
    if (pille !== pilleSoll) return `Pille ist „${pille}“, soll „${pilleSoll}“`;
    if (f.bypass !== (ue !== '')) return `Überbrückt ${ue !== '' ? 'da' : 'fehlt'}`;
    if (f.bypass && !text(ue).includes(T.live.ueberbrueckt)) return 'Überbrückt ohne Text';
    return null;
  });
  const ue = teil(live(stand({ einstellungen: einst({ bypass: true }) })), 'ueberbrueckt', 'span');
  ok(tags(ue, 'span').some((t) => attr(t, 'data-state') === 'warn') && text(ue).includes(STATUS_SYMBOL.warn), 'IN Live Überbrückt: als StatusPill „warn“ mit ▲ (wie der Statuseintrag ducking „überbrückt“), nie nur Farbe');
  gleich([T.live.abgesenkt, T.live.offen, T.live.pegel, T.live.ueberbrueckt], ['FLOOR ABGESENKT', 'Floor offen', 'Pegel', 'Überbrückt'], 'IN Live Pille: Wortlaut „FLOOR ABGESENKT“, „Floor offen“ und „Pegel“ wie bisher (App.tsx:138-144), „Überbrückt“ neu (E10)');
}

// ── IN Live Kabelkarten: jede Karte wie bisher; E10 „nicht verfügbar“ mit neuem Text und nur nach geladener Geräteliste ──
{
  const ALT_SATZ = 'Der Mix geht auf den Systemstandard und erreicht die Konferenz nicht.';
  const kabel = (s: OberflaechenStand): string => teil(live(s), 'kabel');
  const karten = (s: OberflaechenStand): string[] => {
    const k = kabel(s);
    const innen = k.slice(k.indexOf('>') + 1, k.lastIndexOf('</div>'));
    const aus: string[] = [];
    let rest = innen;
    while (rest.trim() !== '') {
      const name = rest.match(/^<(\w+)/)?.[1];
      if (!name) break;
      const e = element(rest, name, '');
      // Blockgrenzen (p, div, button) als Leerzeichen, damit Überschrift, Absatz und Knopf getrennt lesbar bleiben.
      aus.push(text(e.replace(/<(?=\/?(?:p|div|button)[\s>])/g, ' <')).replace(/\s+/g, ' ').trim());
      rest = rest.slice(e.length);
    }
    return aus;
  };
  // Vor der ersten Geräteliste: nichts (devicesLoaded, App.tsx:418-420), auch nicht bei gemerkter, unbekannter Ausgabe.
  gleich(karten(stand({ geraete: undefined, einstellungen: einst({ outputId: 'weg' }) })), [], 'IN Live Kabel: vor der ersten Geräteliste keine Karte, auch nicht „nicht verfügbar“ (devicesLoaded-Wache, App.tsx:418-420)');
  // E10: gemerkte Ausgabe fehlt in der gemessenen Liste → neuer Text, nicht mehr „Der Mix geht auf den Systemstandard“.
  const weg = karten(stand({ einstellungen: einst({ outputId: 'weg' }) }));
  gleich(weg, [T.ausgabeNichtVerfuegbar], 'IN Live Kabel E10: Ausgabe nicht in der Liste → „Das gewählte Ausgabegerät ist derzeit nicht verfügbar. Der Start schlägt damit fehl.“ (INTERPRETER_TEXTE.ausgabeNichtVerfuegbar)');
  ok(!kabel(stand({ einstellungen: einst({ outputId: 'weg' }) })).includes(ALT_SATZ) && !quellen().some((d) => ohneKommentare(leseText(d)).includes(ALT_SATZ)), 'IN Live Kabel E10: der alte Satz „Der Mix geht auf den Systemstandard und erreicht die Konferenz nicht.“ steht nirgends mehr im Renderer');
  gleich(
    karten(stand({ geraete: geraete({ labelsAvailable: false }), einstellungen: einst({ outputId: 'weg' }) })),
    ['Gerätenamen nicht lesbar — bitte die Mikrofonfreigabe erteilen. Ohne sie kann der Interpreter das virtuelle Kabel nicht erkennen.'],
    'IN Live Kabel: ohne lesbare Namen nur die Karte „Gerätenamen nicht lesbar“ (ersetzt alle anderen, App.tsx:422-429)',
  );
  gleich(
    karten(stand({ einstellungen: einst({ outputId: 'cable-in' }) })),
    ['VB-CABLE erkannt. In Zoom als Mikrofon wählen: CABLE Output (VB-Audio Virtual Cable)'],
    'IN Live Kabel: VB-CABLE erkannt, Zoom-Name ohne Chromium-Vorsatz aus der Eingabeliste (App.tsx:346-364)',
  );
  gleich(
    karten(stand({ einstellungen: einst({ outputId: 'cable-in' }), geraete: geraete({ eingaenge: [{ deviceId: 'mic-a', label: 'Mikro Saal' }] }) })),
    ['VB-CABLE erkannt, aber unter dem Namen CABLE Output (VB-Audio Virtual Cable) wurde keine Aufnahmeseite gefunden. Mögliche Ursachen: der Treiber ist unvollständig installiert, das Gerät ist in den Windows-Sound-Einstellungen deaktiviert — oder es wurde dort umbenannt.'],
    'IN Live Kabel: Kabel erkannt, Gegenseite fehlt (App.tsx:335-344)',
  );
  const vm = karten(stand({ einstellungen: einst({ outputId: 'vm-in' }), geraete: geraete({ eingaenge: [{ deviceId: 'vm-out', label: 'VoiceMeeter Output (VB-Audio VoiceMeeter VAIO)' }] }) }));
  ok(vm.length === 1 && vm[0].startsWith('VoiceMeeter erkannt. In Zoom als Mikrofon wählen: VoiceMeeter Output (VB-Audio VoiceMeeter VAIO). Ein- und Ausgang'), 'IN Live Kabel: VoiceMeeter erkannt mit Routing-Satz (App.tsx:350-358)');
  const ohne = karten(stand({ einstellungen: einst({ outputId: '' }) }));
  gleich(
    ohne,
    ['Kein virtuelles Kabel gewählt Zoom und Webex können nur ein Mikrofon abgreifen. Der Interpreter spielt seinen Mix deshalb in ein virtuelles Kabel hinein; in Zoom wird dann das andere Ende desselben Kabels als Mikrofon gewählt. Ohne Kabel geht der Mix auf den Systemstandard und erreicht die Konferenz nicht. VB-CABLE ist für private Nutzung Donationware; der gewerbliche Einsatz ist lizenzpflichtig. VB-CABLE herunterladen'],
    'IN Live Kabel: Systemstandard gewählt → „Kein virtuelles Kabel gewählt“ mit Lizenzsatz und Download-Knopf (App.tsx:367-378; dieser Satz stimmt, E10)',
  );
  gleich(
    karten(stand({ einstellungen: einst({ outputId: 'lautsprecher' }) })),
    ['Lautsprecher (Realtek Audio): kein bekanntes virtuelles Kabel Der Mix geht auf dieses Gerät. Es ist aber kein virtuelles Kabel, das der Interpreter kennt, und für Zoom/Webex wird eines gebraucht, damit die Konferenz den Ton als Mikrofon abgreifen kann. Sonderwege (z. B. eigenes Routing) bleiben davon unbenommen möglich. VB-CABLE ist für private Nutzung Donationware; der gewerbliche Einsatz ist lizenzpflichtig. VB-CABLE herunterladen'],
    'IN Live Kabel: unbekanntes Gerät → „‹Name›: kein bekanntes virtuelles Kabel“ mit Lizenzsatz und Download-Knopf (App.tsx:381-394)',
  );
  // Im Lauf zählt das GESTARTETE Gerät; weicht die Einstellung ab, zuerst die Karte „Ausgabegerät geändert“ (App.tsx:431-446).
  const wechsel = karten(stand({ engine: motor({ running: true, startedOutputId: 'cable-in' }), einstellungen: einst({ outputId: 'lautsprecher' }) }));
  gleich(
    wechsel,
    [
      'Das Ausgabegerät wurde geändert, der Interpreter sendet aber noch auf das beim Start gewählte Gerät. Die Änderung wirkt erst, wenn er gestoppt und erneut gestartet wird.',
      'VB-CABLE erkannt. In Zoom als Mikrofon wählen: CABLE Output (VB-Audio Virtual Cable)',
    ],
    'IN Live Kabel: im Lauf mit geänderter Ausgabe die Karte „Ausgabegerät geändert“ und die Kabel-Karte des gestarteten Geräts',
  );
  gleich(karten(stand({ engine: motor({ running: false, startedOutputId: null }), einstellungen: einst({ outputId: 'lautsprecher' }) }))[0]?.startsWith('Lautsprecher'), true, 'IN Live Kabel: ohne Lauf zählt die Einstellung');
  // Töne der Karten: ok nur bei erkanntem Kabel ohne Routing, sonst warn (Bedeutung wie bisher: emerald → ok, yellow → warn).
  const ton = (s: OberflaechenStand): string[] => {
    const k = kabel(s);
    return tags(k, 'div').slice(1).filter((t) => attr(t, 'data-ton') !== undefined).map((t) => attr(t, 'data-ton') as string);
  };
  gleich(
    [
      ton(stand({ einstellungen: einst({ outputId: 'cable-in' }) })),
      ton(stand({ einstellungen: einst({ outputId: 'weg' }) })),
      ton(stand({ einstellungen: einst({ outputId: 'vm-in' }) })),
      ton(stand({ einstellungen: einst({ outputId: '' }) })),
      ton(stand({ einstellungen: einst({ outputId: 'lautsprecher' }) })),
      ton(stand({ geraete: geraete({ labelsAvailable: false }) })),
      ton(stand({ engine: motor({ running: true, startedOutputId: 'cable-in' }), einstellungen: einst({ outputId: '' }) })),
    ],
    [['ok'], ['warn'], ['warn'], ['warn'], ['warn'], ['warn'], ['warn', 'ok']],
    'IN Live Kabel: Ton je Karte wie bisher (grün nur „Kabel erkannt“, alles andere gelb → warn)',
  );
}

// ── IN Live Fehlerband: state.error roh, unter der Kopfzeile, nur bei Fehler (App.tsx:105-107) ──
{
  const mit = live(stand({ engine: motor({ error: 'Requested device not found' }) }));
  const band = teil(mit, 'fehler');
  ok(text(band) === 'Requested device not found' && mit.indexOf('data-interpreter="kopfzeile"') < mit.indexOf('data-interpreter="fehler"') && mit.indexOf('data-interpreter="fehler"') < mit.indexOf('data-interpreter="kabel"'), 'IN Live Fehlerband: rohe Meldung, unter Metern und Taste, über den Kabel-Karten');
  ok(!live(stand()).includes('data-interpreter="fehler"') && !live(stand({ engine: undefined })).includes('data-interpreter="fehler"'), 'IN Live Fehlerband: ohne Fehler (und vor der ersten Antwort) kein Band');
  ok((attr(tags(mit, 'div').find((t) => attr(t, 'data-interpreter') === 'fehler'), 'class') ?? '').includes('border-[var(--status-error)]/60'), 'IN Live Fehlerband: Fehler bleibt Fehler (Rand --status-error, nie warn)');
}

// ── IN keine rohen Farben: alle Renderer-Dateien nur mit Tokens; Notice-Töne emerald/yellow werden ok/warn ──
{
  const roh =
    /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|shadow|accent|placeholder|caret|decoration)-(?:white|black|neutral|gray|grey|zinc|slate|stone|red|green|blue|yellow|amber|orange|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?\b|#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab)\(|['"](?:white|black|red|green|blue|yellow|orange|gray|grey|transparent)['"]/;
  ok(
    roh.test('border-neutral-700 bg-neutral-800') && roh.test('bg-yellow-400 text-neutral-900') && roh.test('border-emerald-700 bg-emerald-950/30 text-emerald-200') && roh.test('accent-yellow-400') && roh.test("{ background: 'red' }") && roh.test('#121212') && !roh.test('border-[var(--status-warn)]/60 bg-[var(--muted)] accent-[var(--primary)]'),
    'IN keine rohen Farben: Gegenprobe (Klassen, Hex, rgb und benannte Farben des alten App.tsx werden erkannt, Tokens nicht)',
  );
  const dateien = quellen();
  ok(['App.tsx', 'globals.css', 'views/LiveBereich.tsx', 'views/Einstellungen.tsx', 'views/InterpreterOberflaeche.tsx'].every((d) => dateien.includes(`src/renderer/src/${d}`)), `IN keine rohen Farben: geprüft werden alle Renderer-Dateien samt globals.css (${dateien.length})`);
  gleich(dateien.filter((d) => roh.test(ohneKommentare(leseText(d)))), [], 'IN keine rohen Farben: keine rohen Farbklassen, Hex-, rgb-/oklch-Werte oder benannten Farben im Renderer');
  gleich(
    [HINWEIS_TON.ok, HINWEIS_TON.warn],
    ['border-[var(--tally-ready)]/60 bg-[var(--tally-ready)]/10', 'border-[var(--status-warn)]/60 bg-[var(--status-warn)]/10'],
    'IN keine rohen Farben: Notice-Ton emerald wird ok (--tally-ready), yellow wird warn (--status-warn); die Schrift bleibt --foreground (Statusfarben färben nie Wörter)',
  );
  // Die Spur der Meter (vorher bg-neutral-800) bleibt in Hell und Dunkel dunkel wie eine Pegelbrücke: Sie ist eine dunkle Insel
  // (Klasse dark, die Token-Dateien definieren :root, .dark), darin --muted (dunkel oklch 0,27 wie neutral-800) und die Schwelle in
  // --destructive des dunklen Satzes (gemessen 4,24 : 1 auf der Spur in beiden Modi; mit dem hellen Satz nur 2,77 : 1).
  const h = live(stand({ engine: motor({ running: true, ducking: true, floorDb: -20 }) }));
  const klassen = (id: string): string[][] => tags(h, 'div').filter((t) => attr(t, 'data-interpreter') === id).map((t) => (attr(t, 'class') ?? '').split(/\s+/));
  ok(klassen('spur').length === 2 && klassen('spur').every((k) => k.includes('dark') && k.includes('bg-[var(--muted)]')), 'IN keine rohen Farben: beide Meter-Spuren sind dunkle Inseln (dark) mit --muted');
  ok(klassen('balken').every((k) => k.includes('bg-[var(--brand-yellow)]')) && klassen('schwelle').every((k) => k.includes('bg-[var(--destructive)]')), 'IN keine rohen Farben: Meter-Balken in Markengelb (vorher bg-yellow-400), Schwellenmarke in --destructive (vorher bg-red-400) auf der dunklen Spur');
  const tokens = leseText('../../packages/ui/src/tokens/colors.css') + leseText('../../packages/ui/src/tokens/signal-colors.css');
  ok((tokens.match(/:root,\s*\n\s*\.dark \{/g) ?? []).length === 2 && /\.dark \{[^}]*--muted:\s+oklch\(0\.27 0 0\)/.test(tokens.replace(/:root,\s*\n\s*/g, '')), 'IN keine rohen Farben: die Token-Dateien definieren den dunklen Satz auch für .dark (die Insel greift), --muted dunkel = oklch(0.27 0 0)');
}

// ── IN Live Tasten: keine neuen Kürzel ──
{
  gleich(quellen().filter((d) => /onKeyDown|addEventListener\(\s*['"]key/.test(ohneKommentare(leseText(d)))), [], 'IN Live Tasten: keine Kürzel und kein eigener Tastenhörer im Renderer (Nr. 77, E1)');
}
