// UX Welle 2a, Caption d · Rahmen (Spec 3.1, 3.2, 3.8, 5.1, 10; E4, E5, E8, E9, E15, E16; Übergabe Task 25): AppShell mit Kopf
// „JM Caption“ (Logo, ThemeToggle, Mac-Ziehfläche aus AppHeader), ON AIR nach E4, ⚙ und Statusleiste aus lib/oberflaeche.ts.
// Wächter „CA NDI-Engine bleibt“: useCaptionNdiEngine und die Aufnahme-Effekte stehen unbedingt in der Wurzel-View, das
// Vorschau-Canvas steht ohne Bedingung im JSX; der Panelzustand steckt in keinem key und keiner Bedingung um den Live-Bereich.
// Render ohne Browser und ohne window.
import { existsSync } from 'node:fs';
import { ordneStatus } from '@jm/ui';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { App } from '@/App';
import { ABSCHNITT, statusLeiste, type OberflaechenStand } from '@/lib/oberflaeche';
import { CaptionOberflaeche } from '@/views/CaptionOberflaeche';
import { UI_TEXTE } from '../../../../packages/ui/src/lib/texte';
import { attr, caption, element, mitStore, ohneKommentare, quellen, statusEintraege, tags, text, ZEILEN } from './testzustand';

const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
/** Der Inhalt des AppShell (`<main>…</main>`), ohne Kopf, Panel und Statusleiste. */
const inhalt = (html: string): string => element(html, 'main', '');
/** Gleicher Code, Leerraum egal. */
const flach = (s: string): string => s.replace(/\s+/g, ' ').trim();
/** Stand, den die Oberfläche vor jeder Antwort bildet (Store state null, Geräte noch nicht gemessen, Brücken offen). */
const STAND_ANFANG: OberflaechenStand = { caption: undefined, geraete: undefined, micError: null, pegel: 0, masterLink: undefined, fernsteuerung: undefined };

// ── CA Rahmen: Kopf „JM Caption“ mit Logo, ThemeToggle, ⚙ und Mac-Ziehfläche; Statusleiste vor der ersten Antwort ──
{
  const html = render(<CaptionOberflaeche />);
  const kopf = element(html, 'header', '');
  const [zahnrad] = tags(html, 'button').filter((t) => attr(t, 'data-zahnrad') !== undefined);
  const [thema] = tags(html, 'button').filter((t) => attr(t, 'data-theme') !== undefined);
  ok(text(kopf).includes('JM Caption') && html.includes('data-bereich="inhalt"'), 'CA Rahmen: AppShell mit Kopf „JM Caption“');
  ok(kopf.includes('aria-label="Jakobs Medien"') && kopf.includes('<svg'), 'CA Rahmen: Logo im Kopf (aus AppHeader)');
  ok(/<header[^>]*style="-webkit-app-region:drag"/.test(html), 'CA Rahmen: der Kopf ist die Fenster-Ziehfläche (AppHeader, auf dem Mac mit Platz für die Ampel)');
  gleich(
    [attr(thema, 'aria-label'), attr(zahnrad, 'aria-label'), attr(zahnrad, 'aria-expanded')],
    [UI_TEXTE.themeUmschalten(UI_TEXTE.dunkel, UI_TEXTE.hell), UI_TEXTE.einstellungenOeffnen, 'false'],
    'CA Rahmen: ThemeToggle (E5) und ⚙ „Einstellungen öffnen“ im Kopf, Panel beim Start zu',
  );
  gleich(tags(html, 'header').length, 1, 'CA Rahmen: genau ein Kopf (der alte eigene Kopf mit Modell, Sprache und Tasten ist weg)');
  gleich(
    statusEintraege(html).map(([id, z]) => [id, z]),
    ordneStatus(statusLeiste(STAND_ANFANG)).map((i) => [i.id, i.state]),
    'CA Rahmen: die Statusleiste zeigt genau statusLeiste(stand) in der Reihenfolge von ordneStatus',
  );
  gleich(
    statusEintraege(html).map(([id, z, tipp]) => [id, z, (tipp ?? '').includes('unbekannt')]),
    [
      ['master-link', 'off', true],
      ['ndi', 'off', true],
      ['fernsteuerung', 'off', true],
      ['mikrofon', 'off', true],
      ['whisper', 'off', true],
      ['fehler', 'off', true],
    ],
    'CA Rahmen: vor der ersten Antwort sind Master, NDI, Fernsteuerung, Mikrofon, Whisper und Fehler „unbekannt“, nichts ist ok',
  );
  ok(html.includes('data-onair="bereit"') && !html.includes('data-onair="live"'), 'CA Rahmen: ON AIR im Kopf, nicht live vor der ersten Antwort (E4)');
  pruefeIdVerweise(html, 'CA Rahmen: id-Verweise im ganzen Bedienfenster gültig');
  ok(!text(html).includes('"'), 'CA Rahmen: kein ASCII-Anführungszeichen im Text des Bedienfensters');
  // ON AIR nur bei sendendem NDI, laufender Aufnahme und ohne Mikrofonfehler (E4); der Rahmen zeigt genau kopfOnAir.
  const live = mitStore({ state: caption({ running: true, status: { ndiActive: true, ndiSendet: true } }) }, () => render(<CaptionOberflaeche />));
  const ohneSender = mitStore({ state: caption({ running: true, status: { ndiActive: true } }) }, () => render(<CaptionOberflaeche />));
  ok(live.includes('data-onair="live"') && ohneSender.includes('data-onair="bereit"'), 'CA Rahmen: ON AIR live bei sendendem NDI und laufender Aufnahme, sonst bereit (E4)');
}

// ── CA Rahmen: Panel-Anker je Abschnitt, Panel offen oder zu, der Inhalt bleibt gleich ──
{
  const s = caption({ lines: ZEILEN, hold: true, status: { ndiActive: true, ndiSendet: true, connections: 2, ndiNetzName: 'JM Caption' } });
  const z = mitStore({ state: s }, () => render(<CaptionOberflaeche />));
  const o = mitStore({ state: s }, () => render(<CaptionOberflaeche anfangOffen />));
  ok(o.includes(`aria-label="${UI_TEXTE.einstellungen}"`) && !z.includes(`aria-label="${UI_TEXTE.einstellungen}"`), 'CA Rahmen: das Panel ist offen bzw. zu');
  const anker = Object.values(ABSCHNITT).map((id) => o.indexOf(`id="einstellung-${id}"`));
  ok(anker.every((p) => p >= 0), `CA Rahmen: Panel-Anker für jeden Abschnitt (${Object.values(ABSCHNITT).join(', ')})`);
  ok(inhalt(z) !== '' && inhalt(o) === inhalt(z), 'CA Rahmen: der Inhalt (Live-Bereich mit Vorschau) ist bei offenem und geschlossenem Panel Zeichen für Zeichen gleich (das Panel steht daneben)');
}

// ── CA Rahmen: Verdrahtung in der View ──
{
  const ober = QUELLE('views/CaptionOberflaeche.tsx');
  ok(ober.includes('tool="Caption"') && !ober.includes('tool="JM'), 'CA Rahmen: tool „Caption“ ohne „JM “ (der Kopf ergänzt es zu „JM Caption“)');
  ok(
    ober.includes('useBrueckenWert(MASTER_LINK_QUELLE)') && ober.includes('useBrueckenWert(FERNSTEUERUNG_QUELLE)') && ober.includes('status={statusLeiste(stand)}') && ober.includes('onAir={kopfOnAir(stand)}'),
    'CA Rahmen: Brücken, Statusleiste und ON AIR (kopfOnAir) laufen in der View, auch bei geschlossenem Panel',
  );
  ok(
    ober.includes('settingsOpen={panelOffen}') && ober.includes('useState(anfangOffen)') && !ober.includes('localStorage') && ober.includes('settings={<Einstellungen'),
    'CA Rahmen: Panel über settings am AppShell; der Panelzustand ist ein lokaler useState (zu beim Start, nichts gemerkt)',
  );
  ok(!/\bkey=/.test(ober), 'CA Rahmen: der Rahmen setzt keinen key (der Panelzustand steckt in keinem key)');
  gleich((ober.match(/\bpanelOffen\b/g) ?? []).length, 2, 'CA Rahmen: panelOffen steht nur in useState und settingsOpen, in keiner Bedingung um den Live-Bereich');
  const liveAufruf = ober.slice(ober.indexOf('<LiveBereich'), ober.indexOf('/>', ober.indexOf('<LiveBereich')));
  ok(ober.includes('<LiveBereich') && !/panel|abschnitt/i.test(liveAufruf), 'CA Rahmen: LiveBereich bekommt keinen Panelzustand');
  // Übergabe Task 25: caption nur aus der Antwort des Main, nie aus FALLBACK_CFG; Geräte erst nach der ersten Messung.
  ok(/const stand: OberflaechenStand = \{ caption: state \?\? undefined,/.test(ober), 'CA Rahmen: stand.caption ist die Antwort des Main (state ?? undefined)');
  gleich((ober.match(/\bFALLBACK_CFG\b/g) ?? []).length, 2, 'CA Rahmen: FALLBACK_CFG steht nur in seiner Definition und im Aufruf der Engine, nie im Stand');
  ok(ober.includes('useState<MikrofonGeraet[] | undefined>(undefined)'), 'CA Rahmen: die Geräteliste ist undefined, bis listAudioInputs das erste Mal antwortet');
  ok(!existsSync('src/renderer/src/components'), 'CA Rahmen: keine eigenen Ersatzbausteine (kein Ordner components)');
}

// ── CA NDI-Engine bleibt: Engine und Aufnahme-Effekte unbedingt in der Wurzel-View; das Canvas ohne Bedingung ──
{
  const ober = QUELLE('views/CaptionOberflaeche.tsx');
  const rumpf = ober.slice(ober.indexOf('export function CaptionOberflaeche'));
  // Bis zum return des JSX (oberste Ebene, „return (“ am Zeilenende); die return () => … der Effekte liegen tiefer.
  const vorReturn = rumpf.slice(0, rumpf.search(/\n {2}return \(\n/));
  const engine = 'useCaptionNdiEngine(cfg ?? FALLBACK_CFG, state?.lines ?? [], hold, ndiActive, previewRef);';
  ok(vorReturn.includes(engine), 'CA NDI-Engine bleibt: useCaptionNdiEngine läuft in der Wurzel-View (CaptionOberflaeche) mit Config, Zeilen, Hold, NDI-Lage und Vorschau-Ref wie bisher');
  // Oberste Ebene des Funktionsrumpfs (zwei Leerzeichen Einzug): kein if und kein return vor dem einen return des JSX.
  const obereEbene = vorReturn.split('\n').filter((z) => /^ {2}\S/.test(z));
  ok(obereEbene.length > 10 && !obereEbene.some((z) => /^ {2}(if|return)\b/.test(z)), 'CA NDI-Engine bleibt: kein vorzeitiges return und keine Bedingung vor den Hooks (Engine und Effekte laufen unbedingt, auch vor der ersten Antwort)');
  // Der Aufnahme-Effekt ist Zeichen für Zeichen der alte (App.tsx:85-126 bei d7cdd79ce0), ebenso Laden, Aufräumen und Engine-Werte.
  const ALT_AUFNAHME = `useEffect(() => {
    const desiredDevice = cfg?.audioInputDeviceId ?? '';
    if (running && captureRef.current && activeDeviceRef.current !== desiredDevice) {
      captureRef.current.stop();
      captureRef.current = null;
      setLevel(0);
    }
    if (running && !captureRef.current && cfg) {
      let cancelled = false;
      activeDeviceRef.current = desiredDevice;
      startCapture(
        {
          silenceMs: cfg.silenceMs,
          silenceThreshold: cfg.silenceThreshold,
          maxUtteranceSec: cfg.maxUtteranceSec,
          deviceId: cfg.audioInputDeviceId,
          onLevel: (r) => setLevel(r),
        },
        (pcm, sr) => window.jmcaption.pushUtterance(pcm, sr),
      )
        .then((cap) => {
          if (cancelled) cap.stop();
          else {
            captureRef.current = cap;
            setMicError(null);
          }
        })
        .catch((e: unknown) => setMicError(String((e as Error)?.message ?? e)));
      return () => {
        cancelled = true;
      };
    }
    if (!running && captureRef.current) {
      captureRef.current.stop();
      captureRef.current = null;
      setLevel(0);
    }
    return undefined;
  }, [running, cfg, setLevel]);`;
  ok(flach(vorReturn).includes(flach(ALT_AUFNAHME)), 'CA NDI-Engine bleibt: der Aufnahme-Effekt ist der alte (Start bei running, Neustart beim Gerätewechsel, Stopp, micError bis zum nächsten erfolgreichen Start)');
  ok(
    [
      'useEffect(() => { void load(); }, [load]);',
      'useEffect(() => () => captureRef.current?.stop(), []);',
      'const running = state?.running ?? false;',
      'const cfg = state?.config;',
      'const hold = state?.hold ?? false;',
      'const ndiActive = state?.status.ndiActive ?? false;',
      "navigator.mediaDevices.addEventListener?.('devicechange', onChange);",
      "return () => navigator.mediaDevices.removeEventListener?.('devicechange', onChange);",
    ].every((x) => flach(vorReturn).includes(flach(x))),
    'CA NDI-Engine bleibt: Laden, Geräteliste mit devicechange, Aufräumen der Aufnahme und die Werte der Engine wie bisher in der Wurzel-View',
  );
  ok(
    /void listAudioInputs\(\)\s*\.then\(\(d\) => setGeraete\(geraeteListe\(d\)\)\)\s*\.catch\(\(\) => setGeraete\(\[\]\)\);/.test(vorReturn),
    'CA NDI-Engine bleibt: die Mikrofon-Probe beim Start bleibt (listAudioInputs beim Einhängen); Fehler ergeben wie bisher eine leere Liste',
  );
  // Niemand sonst ruft Engine, Aufnahme oder Geräteliste.
  gleich(
    quellen().filter((d) => !d.endsWith('/views/CaptionOberflaeche.tsx') && !d.endsWith('/lib/ndi-engine.ts') && !d.endsWith('/lib/capture.ts') && /\b(useCaptionNdiEngine|startCapture|listAudioInputs)\b/.test(ohneKommentare(leseText(d)))),
    [],
    'CA NDI-Engine bleibt: nur die Wurzel-View ruft useCaptionNdiEngine, startCapture und listAudioInputs',
  );
  ok(/previewRef=\{previewRef\}/.test(ober) && ober.includes('const previewRef = useRef<HTMLCanvasElement | null>(null);'), 'CA NDI-Engine bleibt: dieselbe Vorschau-Ref geht an die Engine und an das Canvas im Live-Bereich');
  const lb = QUELLE('views/LiveBereich.tsx');
  gleich((lb.match(/<canvas\b/g) ?? []).length, 1, 'CA NDI-Engine bleibt: genau ein Canvas im Live-Bereich');
  ok(/<canvas ref=\{previewRef\} width=\{320\} height=\{180\}/.test(lb), 'CA NDI-Engine bleibt: das Canvas hängt an previewRef, 320 mal 180 wie bisher');
  const app = QUELLE('App.tsx');
  ok(/return <CaptionOberflaeche \/>;/.test(app) && !/\bkey=/.test(app) && !/[?&]{2}|\? </.test(app.slice(app.indexOf('return'))), 'CA NDI-Engine bleibt: App zeigt die Wurzel-View ohne Bedingung und ohne key');
  const main = QUELLE('main.tsx');
  ok(main.includes('<StrictMode>') && main.includes('<App />'), 'CA NDI-Engine bleibt: main.tsx hängt App unverändert unter StrictMode ein');
  // Das Canvas ist in jedem Zustand im DOM: vor der ersten Antwort, mit Zeilen, bei Hold, mit Mikrofonfehler, Panel offen.
  const faelle: Array<[string, () => string]> = [
    ['vor der Antwort', () => render(<CaptionOberflaeche />)],
    ['vor der Antwort, Panel offen', () => render(<CaptionOberflaeche anfangOffen />)],
    ['leer', () => mitStore({ state: caption() }, () => render(<CaptionOberflaeche />))],
    ['Zeilen, Hold, NDI', () => mitStore({ state: caption({ lines: ZEILEN, hold: true, status: { ndiActive: true, ndiSendet: true } }) }, () => render(<CaptionOberflaeche />))],
    ['läuft, Panel offen', () => mitStore({ state: caption({ running: true, lines: ZEILEN }) }, () => render(<CaptionOberflaeche anfangOffen />))],
    ['ohne whisper, mit Fehler', () => mitStore({ state: caption({ whisperAvailable: false, error: 'whisper-Start fehlgeschlagen.' }) }, () => render(<CaptionOberflaeche anfangOffen />))],
  ];
  gleich(
    faelle.map(([n, f]) => [n, (inhalt(f()).match(/<canvas width="320" height="180"/g) ?? []).length]),
    faelle.map(([n]) => [n, 1]),
    'CA NDI-Engine bleibt: das Vorschau-Canvas steht in jedem Zustand genau einmal im Inhalt (auch vor der ersten Antwort und bei offenem Panel)',
  );
}
