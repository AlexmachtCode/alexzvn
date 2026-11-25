// UX Welle 2a, Player d1 · Einstellungs-Panel (Spec 3.6, 6; E3, E14, E15): „Ausgabe auf Bildschirm“ (das alte Modal
// „Video-Ausgabe“) und die Fernsteuerung aus @jm/settings mit den Props aus lib/oberflaeche.ts. Eine Bildschirmwahl speichert
// nur (Fix-Runde 1, wie Prompter und Stage-Display); öffnen und schließen über den Schalter, umziehen über „Auf diesen
// Bildschirm“. Vollbild nur gemessen, neu gelesen bei jedem Öffnen des Panels und nach jeder Ausgabe-Aktion; der Schalter
// schaltet nur, wenn der Messwert vom Wunsch abweicht. Jeder Statuseintrag mit Abschnitt findet seinen Anker. Das Modal gibt
// es nicht mehr. Render ohne Browser, Aktionen mit Attrappen.
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import type { AusgabeZustand } from '@jm/output-window/zustand';
import { REMOTE_TEXTE, SCREEN_TEXTE, ScreenOutputSection, type ScreenOption, type ScreenOutputSectionProps } from '@jm/settings';
import * as aktionenModul from '@/lib/aktionen';
import { baueAktionen, liesBildschirme, liesVollbild, type AktionenQuellen } from '@/lib/aktionen';
import { ABSCHNITT, bildschirmEtikett, kannVerschieben, PLAYER_TEXTE, statusLeiste, type OberflaechenStand, type PlayerZustand } from '@/lib/oberflaeche';
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
  videoBelegt: false,
  ...z,
});
const BILDSCHIRME: ScreenOption[] = [
  { id: 1, label: 'DELL · Primär (1920×1080)', primary: true },
  { id: 2, label: 'Beamer (1280×720)', primary: false },
];
function fake(log: string[], z: Partial<AktionenQuellen> = {}): ReturnType<typeof baueAktionen> {
  return baueAktionen({
    outputDisplayId: null,
    vollbild: undefined,
    setOutputDisplayId: (id) => void log.push(`speichern${id}`),
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
/** Alle React-Elemente eines gerenderten Baums (Einstellungen ist eine reine Funktion ohne Hooks und lässt sich direkt aufrufen). */
function elemente(n: ReactNode): ReactElement[] {
  if (Array.isArray(n)) return n.flatMap(elemente);
  if (!isValidElement(n)) return [];
  return [n, ...elemente((n.props as { children?: ReactNode }).children)];
}

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

// ── Aktionen (Fix-Runde 1): die Bildschirmwahl speichert nur; Schalter und „Auf diesen Bildschirm“ öffnen auf dem gemerkten ──
{
  const log: string[] = [];
  const a = fake(log, { outputDisplayId: 2 });
  a.bildschirmWaehlen(3);
  await warte();
  gleich(log.splice(0), ['speichern3'], 'PL Panel Aktionen: eine Bildschirmwahl ruft nur den Setter; kein Öffnen, kein Umziehen, kein Neumessen (Tastatur am Auswahlfeld bewegt die Ausgabe nie)');
  a.bildschirmWaehlen(null);
  await warte();
  gleich(log.splice(0), ['speichernnull'], 'PL Panel Aktionen: „Automatisch (Hauptmonitor)“ speichert null');
  a.ausgabeUmschalten(true);
  a.ausgabeUmschalten(false);
  await warte();
  gleich(log.splice(0), ['open2', 'close', 'messen', 'messen'], 'PL Panel Aktionen: der Ausgabeschalter öffnet auf dem gemerkten Bildschirm, aus schließt („Ausgabe schließen“); danach neu messen');
  fake(log).ausgabeUmschalten(true);
  await warte();
  gleich(log.splice(0), ['openundefined', 'messen'], 'PL Panel Aktionen: gemerkt null → der Schalter öffnet ohne Kennung (der Hauptprozess nimmt den primären)');
  a.ausgabeVerschieben();
  fake(log).ausgabeVerschieben();
  await warte();
  gleich(log.splice(0), ['open2', 'openundefined', 'messen', 'messen'], 'PL Panel Aktionen: „Auf diesen Bildschirm“ zieht auf den gemerkten Bildschirm um (derselbe Aufruf wie der alte Tipp auf die Karte), null ohne Kennung');
  fake(log, { outputDisplayId: 2, openOutput: async () => Promise.reject(new Error('weg')) }).ausgabeVerschieben();
  await warte();
  gleich(log.splice(0), ['messen'], 'PL Panel Aktionen: auch nach einem Fehler wird neu gemessen');
}

// ── Vollbild nach Messung: der Schalter kehrt die Wirkung nie um ──
{
  const log: string[] = [];
  const faelle: Array<[boolean | null | undefined, boolean, string[]]> = [
    [true, true, []],
    [true, false, ['toggle', 'messen']],
    [false, true, ['toggle', 'messen']],
    [false, false, []],
    [null, true, []],
    [null, false, []],
    [undefined, true, []],
    [undefined, false, []],
  ];
  const ist: string[][] = [];
  for (const [gemessen, an] of faelle) {
    fake(log, { vollbild: gemessen }).vollbildUmschalten(an);
    await warte();
    ist.push(log.splice(0));
  }
  gleich(
    ist,
    faelle.map(([, , soll]) => soll),
    'PL Panel Aktionen: vollbildUmschalten(an) schaltet nur, wenn der Messwert von an abweicht (gemessen true + an → nichts, gemessen false + an → umschalten); ohne Messwert nie',
  );
}

// ── „Auf diesen Bildschirm“: nur bei gemessen offenem Fenster oder fehlendem Bildschirm ──
{
  const knopf = (z: AusgabeZustand | null | undefined): string[] =>
    tags(panel(stand({ ausgabe: z })), 'button').filter((t) => attr(t, 'data-player') === 'verschieben').map(() => 'da');
  gleich(
    [knopf(undefined), knopf(null), knopf({ art: 'zu', displayId: null }), knopf({ art: 'abgestuerzt', displayId: 1 }), knopf({ art: 'offen', displayId: 1 }), knopf({ art: 'bildschirm-fehlt', displayId: 5 })],
    [[], [], [], [], ['da'], ['da']],
    'PL Panel Abschnitte: der Knopf „Auf diesen Bildschirm“ steht nur bei offenem oder fehlendem Bildschirm, nicht bei zu, abgestürzt oder unbekannt',
  );
  gleich(
    [kannVerschieben(undefined), kannVerschieben(null), kannVerschieben({ art: 'offen', displayId: 1 }), kannVerschieben({ art: 'zu', displayId: null })],
    [false, false, true, false],
    'PL Panel Abschnitte: kannVerschieben wie im Prompter',
  );
  const html = abschnitt(panel(stand({ ausgabe: { art: 'offen', displayId: 1 } })), ABSCHNITT.ausgabe);
  ok(
    PLAYER_TEXTE.ausgabe.verschieben === 'Auf diesen Bildschirm' && text(html).includes('Auf diesen Bildschirm'),
    'PL Panel Abschnitte: der Knopf trägt den Wortlaut des Prompters „Auf diesen Bildschirm“ und steht beim Abschnitt Ausgabe',
  );
}

// ── Das gerenderte Panel reicht die Aktionen durch (Review Minor 2) ──
{
  const log: string[] = [];
  const s = stand({ player: spieler({ outputDisplayId: 2 }), ausgabe: { art: 'offen', displayId: 2 }, vollbild: true, bildschirme: BILDSCHIRME });
  const a = fake(log, { outputDisplayId: 2, vollbild: true });
  const baum = elemente(Einstellungen({ stand: s, aktionen: a }));
  const ausgabe = baum.find((e) => e.type === ScreenOutputSection)?.props as ScreenOutputSectionProps | undefined;
  const verschieben = baum.find((e) => (e.props as Record<string, unknown>)['data-player'] === 'verschieben')?.props as { onClick?: () => void } | undefined;
  gleich(
    [typeof ausgabe?.onToggle, typeof ausgabe?.onSelect, typeof ausgabe?.onFullscreen, typeof verschieben?.onClick],
    ['function', 'function', 'function', 'function'],
    'PL Panel Abschnitte: das gerenderte Panel gibt Schalter, Auswahl, Vollbild und „Auf diesen Bildschirm“ Rückrufe (keine toten Bedienelemente)',
  );
  ausgabe?.onSelect?.(1);
  ausgabe?.onSelect?.(null);
  ausgabe?.onToggle?.(false);
  ausgabe?.onFullscreen?.(false);
  verschieben?.onClick?.();
  await warte();
  gleich(
    log,
    ['speichern1', 'speichernnull', 'close', 'toggle', 'open2', 'messen', 'messen', 'messen'],
    'PL Panel Abschnitte: die Rückrufe des gerenderten Panels landen bei den Aktionen der View (Auswahl speichert, Schalter schließt, Vollbild schaltet nach Messung, Knopf zieht um)',
  );
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
    ober.includes('useEffect(() => liesBildschirme(window.jmplay?.output?.displays, setBildschirme), [ausgabe]);') &&
      /useEffect\(\(\) => \{\s*if \(!panelOffen\) return undefined;\s*const \w+ = liesBildschirme\(window\.jmplay\?\.output\?\.displays, setBildschirme\);\s*const \w+ = liesVollbild\(window\.jmplay\?\.output\?\.isFullscreen, setVollbild\);[\s\S]*?\}, \[panelOffen\]\);/.test(ober),
    'PL Panel Abschnitte: die Bildschirmliste holt die View beim Start, bei jeder Änderung des Ausgabezustands (Gesamtprüfung I3) und bei jedem Öffnen des Panels; beim Öffnen wird auch das Vollbild neu gelesen (nicht beim Schließen)',
  );
  ok(/useEffect\(\(\) => liesVollbild\(window\.jmplay\?\.output\?\.isFullscreen, setVollbild\), \[ausgabe\]\);/.test(ober), 'PL Panel Abschnitte: das Vollbild wird bei jeder Änderung des Ausgabezustands neu gelesen');
  ok(
    /baueAktionen\(\{[^}]*\bvollbild,[^}]*\bsetOutputDisplayId,[^}]*nachAusgabe: vollbildNeuLesen,[^}]*\}\)/.test(ober) && ober.includes('settings={<Einstellungen stand={stand} aktionen={aktionen} />}'),
    'PL Panel Abschnitte: die Aktionen bekommen den gemessenen Vollbildwert, den Setter des Bildschirms und das Neumessen; das Panel bekommt Stand und Aktionen',
  );
}

// ── PL Ort aus der Messung (2a-Nachzug, UX Welle 2b; löst die Zeile data-player="lage" aus Gesamtprüfung I3 ab): der Abschnitt
// „Ausgabe auf Bildschirm“ selbst nennt den gemessenen Bildschirm – die Pille und die Zeile „Steht auf“ aus @jm/settings –, nie den
// nur gewählten (Wahl ≠ Bewegung). Ohne gemessenen Ort (Bildschirm fehlt) keine Zeile „Steht auf“ ──
{
  const LISTE: ScreenOption[] = [
    { id: 1, label: 'DELL · Primär (1920×1080)', primary: true },
    { id: 2, label: 'Beamer (1280×720)', primary: false },
    { id: 3, label: 'Foyer (1280×720)', primary: false },
  ];
  const s = (z: AusgabeZustand | null | undefined, b: ScreenOption[] | 'ohne' = LISTE): OberflaechenStand =>
    stand({ player: spieler({ outputDisplayId: 3 }), ausgabe: z, ...(b === 'ohne' ? {} : { bildschirme: b }) });
  const aus = (st: OberflaechenStand): string => abschnitt(panel(st), ABSCHNITT.ausgabe);
  /** Wert der Zeile „Steht auf“ im Ausgabe-Abschnitt, sonst null. */
  const stehtAuf = (st: OberflaechenStand): string | null => {
    const t = text(aus(st));
    const i = t.indexOf(SCREEN_TEXTE.stehtAuf);
    return i < 0 ? null : t.slice(i + SCREEN_TEXTE.stehtAuf.length).trim();
  };
  const gemessen2 = s({ art: 'offen', displayId: 2 });
  ok((stehtAuf(gemessen2) ?? '').startsWith('Beamer (1280×720)'), 'PL Ort aus der Messung: gemessen auf Bildschirm 2, Bildschirm 3 gewählt → „Steht auf“ nennt Bildschirm 2');
  ok(
    !(stehtAuf(gemessen2) ?? '').includes('Foyer') && text(aus(gemessen2)).includes('auf Bildschirm 2'),
    'PL Ort aus der Messung: die Pille sagt „auf Bildschirm 2“, keine Zeile nennt den nur gewählten Bildschirm als Ort',
  );
  gleich(
    [stehtAuf(s({ art: 'bildschirm-fehlt', displayId: 2 })), stehtAuf(s({ art: 'offen', displayId: 2 }, 'ohne')), stehtAuf(s({ art: 'offen', displayId: 9 }))],
    [null, null, null],
    'PL Ort aus der Messung: Bildschirm fehlt, Liste unbekannt oder gemessener Bildschirm nicht in der Liste → keine Zeile „Steht auf“, kein geratener Name',
  );
  ok(text(aus(s({ art: 'bildschirm-fehlt', displayId: 2 }))).includes('Bildschirm fehlt'), 'PL Ort aus der Messung: bei abgezogenem Bildschirm sagt die Pille „Bildschirm fehlt“');
  gleich(
    [stehtAuf(s(undefined)), stehtAuf(s(null)), stehtAuf(s({ art: 'zu', displayId: null })), stehtAuf(s({ art: 'abgestuerzt', displayId: 2 }))],
    [null, null, null, null],
    'PL Ort aus der Messung: keine Zeile „Steht auf“, solange kein Fenster gemessen offen ist (unbekannt, keine Brücke, zu, abgestürzt)',
  );
  const alle = [undefined, null, { art: 'zu', displayId: null }, { art: 'offen', displayId: 2 }, { art: 'bildschirm-fehlt', displayId: 2 }, { art: 'abgestuerzt', displayId: 2 }] as Array<AusgabeZustand | null | undefined>;
  ok(alle.every((z) => !panel(s(z)).includes('data-player="lage"')), 'PL Ort aus der Messung: keine Zeile data-player="lage" mehr');
  const q = QUELLE('views/Einstellungen.tsx');
  ok(!q.includes('gemesseneLage') && !q.includes('data-player="lage"'), 'PL Ort aus der Messung: Einstellungen.tsx nutzt gemesseneLage nicht mehr');
}

// ── PL Bildschirmliste folgt dem Ereignis (UX Welle 2b, Task 6, 2a-Nachzug): folgeBildschirmen meldet sich am Bildschirm-Ereignis an
// und liest bei jedem Ereignis die Liste neu (liesBildschirme); ohne Brücke nichts; die Abmeldung wirkt, auch auf eine Antwort, die
// danach noch eintrifft; eine ältere Antwort überschreibt keine neuere ──
{
  type Liste = Array<{ id: number; label: string; primary: boolean; width: number; height: number }>;
  type Folge = (onBildschirme: ((cb: () => void) => () => void) | undefined, frage: (() => Promise<Liste>) | undefined, setze: (l: ScreenOption[] | undefined) => void) => () => void;
  const folge = (aktionenModul as Record<string, unknown>).folgeBildschirmen as Folge | undefined;
  ok(typeof folge === 'function', 'PL Bildschirmliste folgt dem Ereignis: lib/aktionen.ts hat folgeBildschirmen');
  const A: Liste = [{ id: 1, label: 'DELL', primary: true, width: 1920, height: 1080 }];
  const B: Liste = [...A, { id: 2, label: 'Beamer', primary: false, width: 1280, height: 720 }];
  const namen = (l: ScreenOption[] | undefined): string => (l === undefined ? 'unbekannt' : l.map((x) => x.label).join('+'));
  /** Attrappe der Brücke: merkt die Hörer, zählt An- und Abmeldungen. */
  const bruecke = (): { on: (cb: () => void) => () => void; feuere(): void; an: number; ab: number } => {
    const b = { an: 0, ab: 0, hoerer: [] as Array<() => void> };
    return {
      on: (cb) => {
        b.an++;
        b.hoerer.push(cb);
        return () => {
          b.ab++;
          b.hoerer = b.hoerer.filter((h) => h !== cb);
        };
      },
      feuere: () => b.hoerer.forEach((h) => h()),
      get an() {
        return b.an;
      },
      get ab() {
        return b.ab;
      },
    };
  };
  const ergebnis: unknown[] = [];
  if (typeof folge === 'function') {
    // Anmelden (liest nichts), Ereignis → Liste A, Ereignis → Liste B, Ereignis mit Fehler → unbekannt, Abmelden, Ereignis → nichts.
    const br = bruecke();
    let fragen = 0;
    let antwort: () => Promise<Liste> = async () => A;
    const werte: Array<ScreenOption[] | undefined> = [];
    const ab = folge(br.on, () => (fragen++, antwort()), (l) => void werte.push(l));
    await warte();
    ergebnis.push(['angemeldet', br.an, fragen, werte.length]);
    br.feuere();
    await warte();
    antwort = async () => B;
    br.feuere();
    await warte();
    antwort = async () => Promise.reject(new Error('weg'));
    br.feuere();
    await warte();
    ergebnis.push(['drei Ereignisse', fragen, werte.map(namen)]);
    ab();
    antwort = async () => A;
    br.feuere();
    await warte();
    ergebnis.push(['abgemeldet', br.ab, fragen, werte.length]);

    // Eine Antwort, die erst nach der Abmeldung eintrifft, setzt nichts mehr.
    const br2 = bruecke();
    let loese: (l: Liste) => void = () => undefined;
    const spaet: unknown[] = [];
    const ab2 = folge(br2.on, () => new Promise<Liste>((r) => (loese = r)), (l) => void spaet.push(l));
    br2.feuere();
    ab2();
    loese(B);
    await warte();
    ergebnis.push(['spät nach Abmeldung', spaet.length]);

    // Zwei Ereignisse kurz nacheinander: die Antwort des älteren kommt zuletzt und wird verworfen.
    const br3 = bruecke();
    const loeser: Array<(l: Liste) => void> = [];
    const reihe: string[] = [];
    folge(br3.on, () => new Promise<Liste>((r) => void loeser.push(r)), (l) => void reihe.push(namen(l)));
    br3.feuere();
    br3.feuere();
    loeser[1]?.(B);
    await warte();
    loeser[0]?.(A);
    await warte();
    ergebnis.push(['älter nach neuer', reihe]);

    // Ohne Brücke nichts: kein Ereignis-Zugang oder keine Abfrage → keine Anmeldung, keine Frage, nichts gesetzt.
    const br4 = bruecke();
    const ohne: unknown[] = [];
    let fragen4 = 0;
    const ab4 = folge(undefined, async () => (fragen4++, A), (l) => void ohne.push(l));
    const ab5 = folge(br4.on, undefined, (l) => void ohne.push(l));
    br4.feuere();
    await warte();
    ab4();
    ab5();
    ergebnis.push(['ohne Brücke', br4.an, fragen4, ohne.length, typeof ab4, typeof ab5]);
  }
  gleich(
    ergebnis,
    [
      ['angemeldet', 1, 0, 0],
      ['drei Ereignisse', 3, ['DELL · Primär (1920×1080)', 'DELL · Primär (1920×1080)+Beamer (1280×720)', 'unbekannt']],
      ['abgemeldet', 1, 3, 3],
      ['spät nach Abmeldung', 0],
      ['älter nach neuer', ['DELL · Primär (1920×1080)+Beamer (1280×720)']],
      ['ohne Brücke', 0, 0, 0, 'function', 'function'],
    ],
    'PL Bildschirmliste folgt dem Ereignis: jedes Ereignis fragt und setzt die Liste (Fehler → unbekannt), ohne Brücke nichts, die Abmeldung wirkt auch auf späte Antworten, eine ältere Antwort überschreibt keine neuere',
  );
  const wurzel = QUELLE('views/PlayerOberflaeche.tsx');
  ok(
    /useEffect\(\(\) => folgeBildschirmen\(window\.jmplay\?\.output\?\.onBildschirme, window\.jmplay\?\.output\?\.displays, setBildschirme\), \[\]\);/.test(wurzel),
    'PL Bildschirmliste folgt dem Ereignis: die Wurzel-View ruft folgeBildschirmen in einem Effekt (einmal, mit Abmeldung beim Abbau)',
  );
}
