// UX Welle 2a, Player d1 · Einstellungs-Panel (Spec 3.6, 6; E3, E14, E15): „Ausgabe auf Bildschirm“ (das alte Modal
// „Video-Ausgabe“) und die Fernsteuerung aus @jm/settings mit den Props aus lib/oberflaeche.ts. Eine Bildschirmwahl öffnet
// die Ausgabe sofort (wie der Tipp auf die Bildschirmkarte); Vollbild nur gemessen und nach jeder Ausgabe-Aktion neu gelesen.
// Jeder Statuseintrag mit Abschnitt findet seinen Anker. Das Modal gibt es nicht mehr. Render ohne Browser, Aktionen mit
// Attrappen.
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import type { AusgabeZustand } from '@jm/output-window/zustand';
import { REMOTE_TEXTE, SCREEN_TEXTE, type ScreenOption } from '@jm/settings';
import { baueAktionen, liesBildschirme, liesVollbild, type AktionenQuellen } from '@/lib/aktionen';
import { ABSCHNITT, bildschirmEtikett, PLAYER_TEXTE, statusLeiste, type OberflaechenStand, type PlayerZustand } from '@/lib/oberflaeche';
import { Einstellungen } from '@/views/Einstellungen';
import { abschnitt, attr, basisMeldung, ohneKommentare, tags, text } from './testzustand';

const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
const spieler = (z: Partial<PlayerZustand> = {}): PlayerZustand => ({
  activeShowId: null,
  showCues: [],
  standbyIndex: 0,
  playingCueIds: [],
  vorlaufCueIds: [],
  showPaused: false,
  videoCue: null,
  videoProgress: null,
  outputDisplayId: null,
  ...z,
});
const stand = (z: Partial<OberflaechenStand> = {}): OberflaechenStand => ({
  player: spieler(),
  pads: undefined,
  ausgabe: undefined,
  vollbild: undefined,
  masterLink: undefined,
  fernsteuerung: undefined,
  ...z,
});
const BILDSCHIRME: ScreenOption[] = [
  { id: 1, label: 'DELL · Primär (1920×1080)', primary: true },
  { id: 2, label: 'Beamer (1280×720)', primary: false },
];
function fake(log: string[], z: Partial<AktionenQuellen> = {}): ReturnType<typeof baueAktionen> {
  return baueAktionen({
    outputDisplayId: null,
    bildschirme: BILDSCHIRME,
    openOutput: async (id) => void log.push(`open${id}`),
    closeOutput: async () => void log.push('close'),
    toggleFullscreen: async () => void log.push('toggle'),
    nachAusgabe: () => void log.push('messen'),
    ...z,
  });
}
const panel = (s: OberflaechenStand, log: string[] = []): string => render(<Einstellungen stand={s} aktionen={fake(log)} />);
const titel = (html: string): string[] => [...html.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]);
const schalter = (html: string): string[] => tags(html, 'button').filter((t) => attr(t, 'role') === 'switch').map((t) => attr(t, 'aria-checked') ?? '');
const warte = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

// ── PL Panel Abschnitte: Anker und Reihenfolge ──
{
  const log: string[] = [];
  const s = stand();
  const html = panel(s, log);
  gleich(Object.values(ABSCHNITT).filter((id) => !html.includes(`id="einstellung-${id}"`)), [], 'PL Panel Abschnitte: Anker für alle ABSCHNITT-Werte (ausgabe, fernsteuerung)');
  gleich(titel(html), [SCREEN_TEXTE.titel, REMOTE_TEXTE.titel], 'PL Panel Abschnitte: Ausgabe auf Bildschirm, dann Fernsteuerung');
  const ziele = statusLeiste(s).map((i) => i.settingsSection).filter((z): z is string => typeof z === 'string');
  gleich(ziele.filter((z) => !html.includes(`id="einstellung-${z}"`)), [], 'PL Panel Abschnitte: jeder Statuseintrag mit Abschnitt findet seinen Anker');
  pruefeIdVerweise(html, 'PL Panel Abschnitte: id-Verweise gültig');
  gleich(log, [], 'PL Panel Abschnitte: Rendern löst keine Aktion aus');
  ok(!text(html).includes('"'), 'PL Panel Abschnitte: kein ASCII-Anführungszeichen in den Texten des Panels');
  gleich(PLAYER_TEXTE.ausgabe.hinweis, 'Bildschirm für das Vollbild-Ausgabefenster wählen. Video-Cues erscheinen dort.', 'PL Panel Abschnitte: der Hinweis des alten Dialogs „Video-Ausgabe“ steht mit altem Wortlaut in PLAYER_TEXTE');
  ok(text(abschnitt(html, ABSCHNITT.ausgabe)).includes(PLAYER_TEXTE.ausgabe.hinweis), 'PL Panel Abschnitte: der Hinweis steht beim Abschnitt Ausgabe');
}

// ── Ausgabe (E3, E14): Schalter, Bildschirmliste, Vollbild nur gemessen ──
{
  const aus = (z: AusgabeZustand | null | undefined, v: boolean | null | undefined = undefined, b?: ScreenOption[]): string =>
    abschnitt(panel(stand({ ausgabe: z, vollbild: v, bildschirme: b })), ABSCHNITT.ausgabe);
  const zu = aus({ art: 'zu', displayId: null });
  const offen = aus({ art: 'offen', displayId: 2 }, undefined, BILDSCHIRME);
  gleich([schalter(zu), schalter(offen)], [['false'], ['true']], 'PL Panel Abschnitte: der Ausgabeschalter folgt dem gemessenen Zustand (zu = aus, offen = an)');
  ok(text(offen).includes('DELL · Primär (1920×1080)') && text(offen).includes('Beamer (1280×720)'), 'PL Panel Abschnitte: die Bildschirmliste steht in der Auswahl (Name, „ · Primär“, Größe wie die alten Karten)');
  const vollbildFeld = (h: string): boolean => h.includes(`>${SCREEN_TEXTE.vollbild}<`);
  ok(!vollbildFeld(offen) && !vollbildFeld(aus({ art: 'offen', displayId: 2 }, null)) && vollbildFeld(aus({ art: 'offen', displayId: 2 }, true)), 'PL Panel Abschnitte: ohne gemessenes Vollbild (undefined, null) kein Vollbild-Feld (E14, nie geraten)');
  gleich(
    [schalter(aus({ art: 'offen', displayId: 2 }, true)), schalter(aus({ art: 'offen', displayId: 2 }, false)), schalter(aus({ art: 'zu', displayId: null }, true))],
    [['true', 'true'], ['true', 'false'], ['false']],
    'PL Panel Abschnitte: Vollbild als Schalter mit dem gemessenen Wert; ein gemessenes „zu“ widerlegt einen alten Vollbildwert',
  );
  ok(!text(zu).includes(SCREEN_TEXTE.hintergrund), 'PL Panel Abschnitte: kein Hintergrundfeld');
  gleich(
    [
      bildschirmEtikett({ label: 'DELL', primary: true, width: 1920, height: 1080 }),
      bildschirmEtikett({ label: 'Beamer', primary: false, width: 1280, height: 720 }),
    ],
    ['DELL · Primär (1920×1080)', 'Beamer (1280×720)'],
    'PL Panel Abschnitte: Etikett der Bildschirmauswahl aus den alten Karten: Name, „ · Primär“ beim primären, Breite×Höhe',
  );
}

// ── Fernsteuerung (nur Status, Modul „JM Player“) ──
{
  const f = abschnitt(panel(stand({ fernsteuerung: basisMeldung({ clients: 2 }) })), ABSCHNITT.fernsteuerung);
  ok(text(f).includes('8725') && text(f).includes('Modul „JM Player“') && !f.includes('role="switch"'), 'PL Panel Abschnitte: Fernsteuerung zeigt Port 8725 und das Companion-Modul „JM Player“, ohne Schalter');
}

// ── Das Modal „Video-Ausgabe“ gibt es nicht mehr ──
{
  const show = QUELLE('views/ShowView.tsx');
  gleich(
    ['OutputModal', 'outputOpen', 'setOutputOpen', 'Video-Ausgabe', 'Keine Bildschirme erkannt', 'toggleFullscreen', 'output.displays', 'output.isOpen', 'Vollbild', 'Fertig'].filter((w) => show.includes(w)),
    [],
    'PL Panel Abschnitte: ShowView.tsx hat kein Modal „Video-Ausgabe“ mehr (keine Bildschirmkarten, kein Schließen, kein Vollbild, kein Fertig)',
  );
  ok(/<Button size="sm" variant="ghost" onClick=\{onAusgabe\}>\s*▦ Ausgabe\s*<\/Button>/.test(show), 'PL Panel Abschnitte: „▦ Ausgabe“ bleibt im Kopf der Cue-Show und ruft onAusgabe');
  const ober = QUELLE('views/PlayerOberflaeche.tsx');
  ok(
    /const ausgabeOeffnen = useCallback\(\(\) => \{\s*setPanelOffen\(true\);\s*setPanelAbschnitt\(ABSCHNITT\.ausgabe\);\s*\}, \[\]\);/.test(ober),
    'PL Panel Abschnitte: „▦ Ausgabe“ öffnet das Panel beim Abschnitt Ausgabe',
  );
}

// ── Aktionen: ein Tipp auf einen Bildschirm öffnet sofort; nach jeder Ausgabe-Aktion wird das Vollbild neu gemessen ──
{
  const log: string[] = [];
  const a = fake(log, { outputDisplayId: 2 });
  a.bildschirmWaehlen(2);
  await warte();
  gleich(log.splice(0), ['open2', 'messen'], 'PL Panel Aktionen: eine Bildschirmwahl öffnet sofort auf diesem Bildschirm (oder zieht ein offenes Fenster um, wie der Tipp auf die Karte), danach neu messen');
  a.bildschirmWaehlen(null);
  await warte();
  gleich(log.splice(0), ['open1', 'messen'], 'PL Panel Aktionen: „Automatisch (Hauptmonitor)“ öffnet auf dem primären Bildschirm der Liste (wie dessen Karte)');
  fake(log, { bildschirme: undefined }).bildschirmWaehlen(null);
  await warte();
  gleich(log.splice(0), ['openundefined', 'messen'], 'PL Panel Aktionen: ohne Liste öffnet „Automatisch“ ohne Kennung (der Hauptprozess nimmt den primären)');
  a.ausgabeUmschalten(true);
  a.ausgabeUmschalten(false);
  await warte();
  gleich(log.splice(0), ['open2', 'close', 'messen', 'messen'], 'PL Panel Aktionen: der Ausgabeschalter öffnet auf dem gewählten Bildschirm, aus schließt („Ausgabe schließen“)');
  fake(log).ausgabeUmschalten(true);
  await warte();
  gleich(log.splice(0), ['openundefined', 'messen'], 'PL Panel Aktionen: ohne gewählten Bildschirm öffnet der Schalter ohne Kennung (primär)');
  a.vollbildUmschalten(false);
  await warte();
  gleich(log.splice(0), ['toggle', 'messen'], 'PL Panel Aktionen: Vollbild schaltet um und misst danach neu (der Wert wird nie aus der Antwort geraten)');
  fake(log, { openOutput: async () => Promise.reject(new Error('weg')) }).bildschirmWaehlen(2);
  await warte();
  gleich(log.splice(0), ['messen'], 'PL Panel Aktionen: auch nach einem Fehler wird neu gemessen');
}

// ── Vollbild lesen: nur der Messwert, nie geraten ──
{
  const werte: Array<boolean | null | undefined> = [];
  const setze = (v: boolean | null | undefined): void => void werte.push(v);
  liesVollbild(async () => true, setze);
  liesVollbild(async () => null, setze);
  liesVollbild(async () => Promise.reject(new Error('weg')), setze);
  liesVollbild(undefined, setze);
  const ab = liesVollbild(async () => false, setze);
  ab();
  await warte();
  gleich(werte, [true, null, null], 'PL Vollbild lesen: Messwert übernommen; null oder Fehler = kein Messwert; ohne Preload nichts; eine überholte Antwort wird verworfen');
}

// ── Bildschirmliste lesen: frisch, bei einem Fehler unbekannt ──
{
  const werte: Array<ScreenOption[] | undefined> = [];
  const setze = (l: ScreenOption[] | undefined): void => void werte.push(l);
  const liste = [
    { id: 1, label: 'DELL', primary: true, width: 1920, height: 1080 },
    { id: 2, label: 'Beamer', primary: false, width: 1280, height: 720 },
  ];
  liesBildschirme(async () => liste, setze);
  liesBildschirme(async () => Promise.reject(new Error('weg')), setze);
  liesBildschirme(undefined, setze);
  const ab = liesBildschirme(async () => liste, setze);
  ab();
  await warte();
  gleich(
    werte,
    [BILDSCHIRME, undefined],
    'PL Bildschirmliste: die Antwort wird mit den Etiketten der alten Karten übernommen; ein Fehler ergibt „nicht geladen“ (undefined), nie die alte Liste; ohne Preload nichts; eine überholte Antwort wird verworfen',
  );
}

// ── Abläufe in der View, das Panel ohne Effekte (E15) ──
{
  const q = QUELLE('views/Einstellungen.tsx');
  ok(!q.includes('useEffect') && !/\bwindow\b/.test(q) && !q.includes('usePlayer') && !q.includes('jmplay') && !q.includes('cueEngine'), 'PL Panel Abschnitte: Einstellungen.tsx ohne window, ohne useEffect und ohne Store (E15)');
  const ober = QUELLE('views/PlayerOberflaeche.tsx');
  ok(
    ober.includes('useEffect(() => liesBildschirme(window.jmplay?.output?.displays, setBildschirme), []);') &&
      ober.includes('useEffect(() => (panelOffen ? liesBildschirme(window.jmplay?.output?.displays, setBildschirme) : undefined), [panelOffen]);'),
    'PL Panel Abschnitte: die Bildschirmliste holt die View beim Start und bei jedem Öffnen des Panels (nicht beim Schließen)',
  );
  ok(/useEffect\(\(\) => liesVollbild\(window\.jmplay\?\.output\?\.isFullscreen, setVollbild\), \[ausgabe\]\);/.test(ober), 'PL Panel Abschnitte: das Vollbild wird bei jeder Änderung des Ausgabezustands neu gelesen');
  ok(ober.includes('nachAusgabe: vollbildNeuLesen') && ober.includes('settings={<Einstellungen stand={stand} aktionen={aktionen} />}'), 'PL Panel Abschnitte: nach jeder Ausgabe-Aktion liest die View das Vollbild neu; das Panel bekommt Stand und Aktionen');
}
