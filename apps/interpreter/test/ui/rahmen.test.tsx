// UX Welle 2a, Interpreter d · Rahmen (Spec 3.1, 3.2, 3.8, 5.1, 10; E4, E5, E10, E15, E16; Übergabe Task 30): AppShell mit Kopf
// „JM Interpreter“ (Logo, ThemeToggle, Mac-Ziehfläche aus AppHeader), ON AIR „MIX AKTIV“ nach E4, ⚙ und Statusleiste aus
// lib/oberflaeche.ts; der alte Untertitel entfällt (E16).
// Wächter „IN Engine bleibt“: Erzeugung der Engine (useRef), Abo und destroy im Aufräumen, Geräteliste mit Mikrofon-Probe und die
// Regler-Effekte stehen unbedingt in der Wurzel-View, Zeichen für Zeichen wie im alten App.tsx; der Panelzustand steckt in keinem
// key und in keiner Bedingung um den Live-Bereich oder den Besitzer der Engine. Render ohne Browser und ohne window.
import { existsSync } from 'node:fs';
import { ordneStatus } from '@jm/ui';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { App } from '@/App';
import { ABSCHNITT, INTERPRETER_TEXTE, statusLeiste } from '@/lib/oberflaeche';
import { InterpreterOberflaeche } from '@/views/InterpreterOberflaeche';
import { UI_TEXTE } from '../../../../packages/ui/src/lib/texte';
import { attr, element, mitStore, ohneKommentare, quellen, STAND_ANFANG, statusEintraege, tags, text } from './testzustand';

const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
/** Der Inhalt des AppShell (`<main>…</main>`), ohne Kopf, Panel und Statusleiste. */
const inhalt = (html: string): string => element(html, 'main', '');
/** Gleicher Code, Leerraum egal. */
const flach = (s: string): string => s.replace(/\s+/g, ' ').trim();
const ALTER_UNTERTITEL = 'Floor/Dolmetscher-Ducking · Einspeisung in Zoom/Webex';

// ── IN Rahmen: Kopf „JM Interpreter“ mit Logo, ThemeToggle, ⚙ und Ziehfläche; Statusleiste vor der ersten Antwort ──
{
  const html = render(<InterpreterOberflaeche />);
  const kopf = element(html, 'header', '');
  const [zahnrad] = tags(html, 'button').filter((t) => attr(t, 'data-zahnrad') !== undefined);
  const [thema] = tags(html, 'button').filter((t) => attr(t, 'data-theme') !== undefined);
  ok(text(kopf).includes('JM Interpreter') && html.includes('data-bereich="inhalt"'), 'IN Rahmen: AppShell mit Kopf „JM Interpreter“');
  ok(kopf.includes('aria-label="Jakobs Medien"') && kopf.includes('<svg'), 'IN Rahmen: Logo im Kopf (aus AppHeader)');
  ok(/<header[^>]*style="-webkit-app-region:drag"/.test(html), 'IN Rahmen: der Kopf ist die Fenster-Ziehfläche (AppHeader, auf dem Mac mit Platz für die Ampel)');
  gleich(
    [attr(thema, 'aria-label'), attr(zahnrad, 'aria-label'), attr(zahnrad, 'aria-expanded')],
    [UI_TEXTE.themeUmschalten(UI_TEXTE.dunkel, UI_TEXTE.hell), UI_TEXTE.einstellungenOeffnen, 'false'],
    'IN Rahmen: ThemeToggle (E5) und ⚙ „Einstellungen öffnen“ im Kopf, Panel beim Start zu',
  );
  gleich(tags(html, 'header').length, 1, 'IN Rahmen: genau ein Kopf (der alte eigene Kopf mit Titel und Taste ist weg)');
  ok(!text(html).includes(ALTER_UNTERTITEL) && !text(html).includes('Floor/Dolmetscher-Ducking'), 'IN Rahmen: der alte Untertitel „Floor/Dolmetscher-Ducking · Einspeisung in Zoom/Webex“ entfällt (E16)');
  gleich(tags(html, 'h1').length, 0, 'IN Rahmen: kein eigenes h1 „JM Interpreter“ mehr (der Titel kommt aus AppHeader)');
  gleich(
    statusEintraege(html).map(([id, z]) => [id, z]),
    ordneStatus(statusLeiste(STAND_ANFANG)).map((i) => [i.id, i.state]),
    'IN Rahmen: die Statusleiste zeigt genau statusLeiste(stand) in der Reihenfolge von ordneStatus',
  );
  gleich(
    statusEintraege(html).map(([id, z, tipp]) => [id, z, (tipp ?? '').includes('unbekannt')]),
    [
      ['master-link', 'off', true],
      ['ausgabe', 'off', true],
      ['floor', 'off', true],
      ['dolmetscher', 'off', true],
      ['ducking', 'off', true],
      ['fehler', 'off', true],
    ],
    'IN Rahmen: vor der ersten Antwort sind Master, Ausgabe, Floor, Dolmetscher, Ducking und Fehler „unbekannt“, nichts ist ok',
  );
  ok(html.includes('data-onair="bereit"') && !html.includes('data-onair="live"'), 'IN Rahmen: ON AIR im Kopf, nicht live vor der ersten Antwort (E4)');
  pruefeIdVerweise(html, 'IN Rahmen: id-Verweise im ganzen Bedienfenster gültig');
  ok(!text(html).includes('"'), 'IN Rahmen: kein ASCII-Anführungszeichen im Text des Bedienfensters');
}

// ── IN Rahmen: Panel-Anker je Abschnitt, Panel offen oder zu, der Inhalt bleibt gleich ──
{
  const patch = { floorId: 'mic-a', interpreterId: 'mic-b', bypass: true };
  const z = mitStore(patch, () => render(<InterpreterOberflaeche />));
  const o = mitStore(patch, () => render(<InterpreterOberflaeche anfangOffen />));
  ok(o.includes(`aria-label="${UI_TEXTE.einstellungen}"`) && !z.includes(`aria-label="${UI_TEXTE.einstellungen}"`), 'IN Rahmen: das Panel ist offen bzw. zu');
  const anker = Object.values(ABSCHNITT).map((id) => o.indexOf(`id="einstellung-${id}"`));
  ok(anker.every((p) => p >= 0), `IN Rahmen: Panel-Anker für jeden Abschnitt (${Object.values(ABSCHNITT).join(', ')})`);
  ok(inhalt(z) !== '' && inhalt(o) === inhalt(z), 'IN Rahmen: der Inhalt (Live-Bereich mit Metern, Pille, Überbrückt und Taste) ist bei offenem und geschlossenem Panel Zeichen für Zeichen gleich (das Panel steht daneben)');
  ok(inhalt(z).includes(INTERPRETER_TEXTE.live.ueberbrueckt), 'IN Rahmen: der Stand aus dem Store (Bypass) erreicht den Live-Bereich');
}

// ── IN Rahmen: Verdrahtung in der View ──
{
  const ober = QUELLE('views/InterpreterOberflaeche.tsx');
  ok(ober.includes('tool="Interpreter"') && !ober.includes('tool="JM'), 'IN Rahmen: tool „Interpreter“ ohne „JM “ (der Kopf ergänzt es zu „JM Interpreter“)');
  ok(
    ober.includes('useBrueckenWert(MASTER_LINK_QUELLE)') && ober.includes('status={statusLeiste(stand)}') && ober.includes('onAir={kopfOnAir(stand)}'),
    'IN Rahmen: Brücke, Statusleiste und ON AIR (kopfOnAir, „MIX AKTIV“) laufen in der View, auch bei geschlossenem Panel',
  );
  ok(
    ober.includes('settingsOpen={panelOffen}') && ober.includes('useState(anfangOffen)') && !ober.includes('localStorage') && ober.includes('settings={<Einstellungen'),
    'IN Rahmen: Panel über settings am AppShell; der Panelzustand ist ein lokaler useState (zu beim Start, nichts gemerkt)',
  );
  ok(!/\bkey=/.test(ober), 'IN Rahmen: der Rahmen setzt keinen key (der Panelzustand steckt in keinem key)');
  gleich((ober.match(/\bpanelOffen\b/g) ?? []).length, 2, 'IN Rahmen: panelOffen steht nur in useState und settingsOpen, in keiner Bedingung um den Live-Bereich');
  const liveAufruf = ober.slice(ober.indexOf('<LiveBereich'), ober.indexOf('/>', ober.indexOf('<LiveBereich')));
  ok(ober.includes('<LiveBereich') && !/panel|abschnitt/i.test(liveAufruf), 'IN Rahmen: LiveBereich bekommt keinen Panelzustand');
  // Übergabe Task 30: engine erst nach dem ersten getState() im Effekt, Geräte erst nach dem ersten listDevices().
  ok(ober.includes('useState<EngineState | undefined>(undefined)') && !ober.includes('useState<EngineState>(() => engine.getState())'), 'IN Rahmen: stand.engine ist undefined bis zum ersten getState() im Effekt (nicht der Vorgabewert des Konstruktors)');
  ok(/geraete: devicesLoaded \? \{ eingaenge: inputs, ausgaenge: outputs, labelsAvailable \} : undefined/.test(ober), 'IN Rahmen: stand.geraete ist undefined bis zum ersten listDevices() (devicesLoaded)');
  ok(!existsSync('src/renderer/src/components'), 'IN Rahmen: keine eigenen Ersatzbausteine (kein Ordner components)');
}

// ── IN Engine bleibt: Erzeugung, Abo, destroy, Geräteliste und Regler-Effekte unbedingt in der Wurzel-View ──
{
  const ober = QUELLE('views/InterpreterOberflaeche.tsx');
  const rumpf = ober.slice(ober.indexOf('export function InterpreterOberflaeche'));
  // Bis zum return des JSX (oberste Ebene, „return (“ am Zeilenende); die return () => … der Effekte liegen tiefer.
  const vorReturn = rumpf.slice(0, rumpf.search(/\n {2}return \(\n/));
  ok(vorReturn.length > 0 && rumpf.search(/\n {2}return \(\n/) > 0, 'IN Engine bleibt: die Wurzel-View hat genau ein return mit JSX auf oberster Ebene');
  const ALT_ENGINE = `const engineRef = useRef<InterpreterEngine | null>(null);
  if (!engineRef.current) engineRef.current = new InterpreterEngine();
  const engine = engineRef.current;`;
  ok(flach(vorReturn).includes(flach(ALT_ENGINE)), 'IN Engine bleibt: die Engine entsteht wie bisher einmal per useRef in der Wurzel-View (App.tsx:9-11 bei d7cdd79ce0)');
  const ALT_ABO = `useEffect(() => {
    const unsub = engine.subscribe(() => setState(engine.getState()));
    setState(engine.getState());
    return () => {
      unsub();
      engine.destroy();
    };
  }, [engine]);`;
  ok(flach(vorReturn).includes(flach(ALT_ABO)), 'IN Engine bleibt: Abo, erster getState() und destroy im Aufräumen wie bisher (App.tsx:23-30), Abhängigkeit nur [engine]');
  const ALT_GERAETE = `useEffect(() => {
    let generation = 0;
    let knownLabels = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const load = (): void => {
      const myGeneration = ++generation;
      void listDevices(!knownLabels).then(({ inputs, outputs, labelsAvailable }) => {
        if (myGeneration !== generation) return;
        setInputs(inputs);
        setOutputs(outputs);
        setLabelsAvailable(labelsAvailable);
        setDevicesLoaded(true);
        if (labelsAvailable) knownLabels = true;
      });
    };
    const onDeviceChange = (): void => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(load, 500);
    };
    load();
    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, []);`;
  ok(flach(vorReturn).includes(flach(ALT_GERAETE)), 'IN Engine bleibt: Geräteliste mit Mikrofon-Probe beim Start (listDevices(!knownLabels)), Generationszähler und devicechange-Bündelung wie bisher (App.tsx:41-71)');
  ok(
    flach(vorReturn).includes(flach('useEffect(() => { engine.setSettings(duckSettings(s)); }, [engine, s]);')) &&
      flach(vorReturn).includes(flach('useEffect(() => { engine.setBypass(s.bypass); }, [engine, s.bypass]);')) &&
      vorReturn.includes('const s = useSettings();'),
    'IN Engine bleibt: Regler und Bypass wirken wie bisher sofort (setSettings bei jeder Store-Änderung, setBypass bei Bypass-Wechsel, App.tsx:73-79)',
  );
  // Oberste Ebene des Funktionsrumpfs (zwei Leerzeichen Einzug): kein if (außer der Engine-Erzeugung) und kein return vor dem JSX.
  const obereEbene = vorReturn.split('\n').filter((z) => /^ {2}\S/.test(z));
  ok(
    obereEbene.length > 10 && obereEbene.filter((z) => /^ {2}(if|return)\b/.test(z)).join('|') === '  if (!engineRef.current) engineRef.current = new InterpreterEngine();',
    'IN Engine bleibt: kein vorzeitiges return und keine Bedingung vor den Hooks außer der einmaligen Erzeugung (alles läuft unbedingt, auch vor der ersten Antwort)',
  );
  // Niemand sonst erzeugt, zerstört oder abonniert die Engine oder listet Geräte.
  gleich(
    quellen().filter((d) => !d.endsWith('/views/InterpreterOberflaeche.tsx') && !d.endsWith('/core/engine.ts') && /\bnew InterpreterEngine\b|\.destroy\(|\.subscribe\(|\blistDevices\(|\.start\(\{|getUserMedia/.test(ohneKommentare(leseText(d)))),
    [],
    'IN Engine bleibt: nur die Wurzel-View erzeugt die Engine, abonniert sie, ruft destroy und listet Geräte (Mikrofon-Probe)',
  );
  gleich((vorReturn.match(/new InterpreterEngine\(/g) ?? []).length, 1, 'IN Engine bleibt: genau eine Erzeugung der Engine');
  for (const d of ['views/Einstellungen.tsx', 'views/LiveBereich.tsx']) {
    const q = QUELLE(d);
    // stand.engine ist der abgeleitete Zustand (getState), kein Zugriff auf die Engine selbst.
    ok(!/\buse[A-Z]\w*\(/.test(q) && !/(?<![.?])\bengine\b|InterpreterEngine|@\/core\/engine['"]/.test(q.replace(/import type [^;]*;/g, '')), `IN Engine bleibt: ${d} ohne Hooks und ohne Engine (nur Stand und Aktionen aus der Wurzel-View)`);
  }
  const app = QUELLE('App.tsx');
  ok(/return <InterpreterOberflaeche \/>;/.test(app) && !/\bkey=/.test(app) && !/[?&]{2}|\? </.test(app.slice(app.indexOf('return'))), 'IN Engine bleibt: App zeigt die Wurzel-View ohne Bedingung und ohne key');
  const main = QUELLE('main.tsx');
  ok(main.includes('<StrictMode>') && main.includes('<App />'), 'IN Engine bleibt: main.tsx hängt App unverändert unter StrictMode ein (die Falle StrictMode/destroy wie bisher: Abo und destroy im selben Effekt)');
  // Die Wurzel-View ist der Besitzer: AppShell steht im return, der Live-Bereich ohne Bedingung und ohne key als einziges Kind.
  const jsx = rumpf.slice(rumpf.search(/\n {2}return \(\n/));
  ok(/<AppShell[\s\S]*<LiveBereich stand=\{stand\}[^>]*\/>\s*<\/AppShell>/.test(jsx) && !/\{[^}]*&&\s*<LiveBereich|\?\s*<LiveBereich/.test(jsx), 'IN Engine bleibt: der Live-Bereich steht ohne Bedingung im AppShell');
}
