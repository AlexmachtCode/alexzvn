// UX Welle 2b, Presenter d1 · Rahmen des Editors (B11, B14, Muster d; Spec 3.1, 3.8): AppShell „Werkzeug“ mit Kopf „JM Presenter“,
// ThemeToggle, ⚙ und kompakter Dichte; die Werkzeugleiste trägt die sechs Datei-Knöpfe, busy.label, den NDI-Schalter und die
// Haupttaste in fester Breite, ohne eigenen Kopf und ohne ⚙-Dropdown; die Ablage umschließt den Rahmen, die Öffnen-Frage bleibt
// daneben. Ein Stand für alles (useStand): Wächter am Quelltext und der Bildschirm-Leser mit Zusammenfassen und Reihenfolge.
// Render ohne Browser und ohne window (die Effekte laufen in renderToStaticMarkup nicht).
import { SCREEN_TEXTE } from '@jm/settings';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import type { DisplayInfo } from '@shared/types';
import { PRESENTER_TEXTE, statusLeiste, type OberflaechenStand, type StartWahl } from '@/lib/oberflaeche';
import * as stand from '@/lib/useStand';
import { EditorRahmen } from '@/views/EditorOberflaeche';
import { EditorView } from '@/views/EditorView';
import { abschnitt, aktionenAttrappe, attr, bekannterStand, bereich, bildschirme, folie, grundStand, laufend, mitStore, ndiStatus, ohneKommentare, statusEintraege, tags, text } from './testzustand';

const T = PRESENTER_TEXTE;
const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
const ROH = (d: string): string => leseText(`src/renderer/src/${d}`);
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const DATEI_KNOEPFE = ['Neu', '+ PDF / Bilder', '+ Office', 'Öffnen', 'Speichern', 'PDF-Export'];

/** Der Rahmen mit einem gegebenen Stand (ohne useStand), wie ihn die Wurzel-View rendert. */
function rahmen(s: OberflaechenStand, startWahl: StartWahl = { bildschirm: 22, nurNdi: false }, panelOffen = false, log: string[] = []): string {
  return render(
    <EditorRahmen stand={s} startWahl={startWahl} aktionen={aktionenAttrappe(log)} panelOffen={panelOffen} onPanel={() => undefined}>
      <div data-presenter="arbeitsflaeche" />
    </EditorRahmen>,
  );
}
/** Render ohne Abbruch: ein Wurf (etwa window beim Rendern) zählt als FAIL, der Lauf geht weiter. */
function ohneWurf(name: string, f: () => string): string {
  try {
    return f();
  } catch (e) {
    ok(false, `${name}: Render ohne Wurf (${String(e).split(String.fromCharCode(10))[0]})`);
    return '';
  }
}
const knopfTexte = (html: string): string[] => [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1]).trim());
const werkzeug = (html: string): string => bereich(html, 'data-bereich', 'toolbar');
const kopf = (html: string): string => bereich(html, 'data-bereich', 'kopf') || (html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '');
const haupttaste = (html: string): { state?: string; text: string; title?: string } => {
  const b = bereich(html, 'data-presenter', 'haupttaste');
  const [t] = tags(b, 'button');
  return { state: attr(t, 'data-state'), text: text(b).trim(), title: attr(t, 'title') };
};

// ── PS Editor-Rahmen: Kopf, ⚙, ThemeToggle, kompakt, Werkzeugleiste ohne eigenen Kopf ──
{
  const html = ohneWurf('PS Editor-Rahmen', () => render(<EditorView />));
  const [zahnrad] = tags(html, 'button').filter((t) => attr(t, 'data-zahnrad') !== undefined);
  const [thema] = tags(html, 'button').filter((t) => attr(t, 'data-theme') !== undefined);
  const k = kopf(html);
  ok(
    text(k).includes('JM Presenter') && !html.includes('JM PRESENTER') && !text(html).includes('Folien-Editor & Präsentation'),
    'PS Editor-Rahmen: Kopf „JM Presenter“ aus dem AppShell; die alte Marke „JM PRESENTER“ und der Untertitel „Folien-Editor & Präsentation“ entfallen (E16, B9)',
  );
  gleich(
    [attr(thema, 'aria-label'), attr(zahnrad, 'aria-label'), attr(zahnrad, 'aria-expanded')],
    ['Darstellung: Dunkel. Umschalten auf Hell', 'Einstellungen öffnen', 'false'],
    'PS Editor-Rahmen: ThemeToggle und ⚙ „Einstellungen öffnen“ im Kopf, Panel beim Start zu',
  );
  ok(html.includes('data-dichte="kompakt"'), 'PS Editor-Rahmen: AppShell in der Dichte kompakt (data-dichte="kompakt", P3-A)');
  ok(k.includes('data-zahnrad') && k.includes('data-theme') && !knopfTexte(k).some((t) => DATEI_KNOEPFE.includes(t)), 'PS Editor-Rahmen: der Kopf trägt ⚙ und ThemeToggle, keinen Datei-Knopf');
  const w = werkzeug(html);
  gleich(knopfTexte(w).slice(0, 6), DATEI_KNOEPFE, 'PS Editor-Rahmen: die Werkzeugleiste beginnt mit den sechs Datei-Knöpfen in der alten Reihenfolge');
  ok(bereich(w, 'data-presenter', 'ndi').startsWith('<button') && haupttaste(w).state !== undefined, 'PS Editor-Rahmen: in der Werkzeugleiste stehen der NDI-Schalter und die Haupttaste (TallyButton)');
  ok(/<div[^>]*data-presenter="haupttaste"[^>]*class="[^"]*\bw-44\b[^"]*\bshrink-0\b/.test(w), 'PS Editor-Rahmen: die Haupttaste steht in fester Breite (w-44, schrumpft nicht)');
  ok(!w.includes('fixed inset-0') && !w.includes('data-zahnrad') && !/title="Einstellungen"/.test(w), 'PS Editor-Rahmen: kein ⚙-Dropdown in der Werkzeugleiste (kein Klickfänger fixed inset-0 wie Toolbar.tsx:201)');
  ok(!w.includes('<select') && !w.includes('<header'), 'PS Editor-Rahmen: die Werkzeugleiste hat keinen eigenen Kopf und keine Bildschirmwahl mehr (die Wahl steht im Panel, B11)');
  ok(html.includes('data-onair="bereit"') && !html.includes('data-onair="live"'), 'PS Editor-Rahmen: ON AIR im Kopf, vor der ersten Antwort nicht live (B3)');
  gleich(
    statusEintraege(html).map(([id]) => id).sort(),
    ['fernsteuerung', 'gast-klicker', 'handy', 'master-link', 'praesentation', 'publikum', 'timer'],
    'PS Editor-Rahmen: Statusleiste mit Master-Link, Timer, Publikum, Fernsteuerung, Handy, Gast-Klicker und Präsentation (ohne window kein NDI)',
  );
  ok(statusEintraege(html).every(([, z]) => z === 'off'), 'PS Editor-Rahmen: vor der ersten Antwort ist kein Statuseintrag ok');
  gleich(haupttaste(w), { state: 'gesperrt', text: `${T.taste.praesentieren}${T.grund.zustandOffen}`, title: T.grund.zustandOffen }, 'PS Editor-Rahmen: vor der ersten Antwort ist „Präsentieren“ gesperrt mit „Lädt …“');
  const ndi = tags(bereich(w, 'data-presenter', 'ndi'), 'button')[0];
  ok(ndi !== undefined && /\sdisabled=""/.test(ndi) && attr(ndi, 'title') === T.grund.zustandOffen && text(bereich(w, 'data-presenter', 'ndi')) === T.ndi.schalterUnbekannt, 'PS Editor-Rahmen: vor der ersten Antwort ist der NDI-Schalter gesperrt mit „Lädt …“ und zeigt „NDI unbekannt“ statt eines erfundenen „aus“');
  pruefeIdVerweise(html, 'PS Editor-Rahmen: id-Verweise im ganzen Editorfenster gültig');
  ok(!text(html).includes('"'), 'PS Editor-Rahmen: kein ASCII-Anführungszeichen in den Texten des Editorfensters');
}

// ── PS Editor-Rahmen: Haupttaste und NDI-Schalter je Zustand (B14, B3; Texte aus PRESENTER_TEXTE) ──
{
  const mitFolien = { doc: { schemaVersion: 1 as const, name: 'P', slides: [folie('a'), folie('b', true)], sources: [] } };
  const nurVersteckt = { doc: { schemaVersion: 1 as const, name: 'P', slides: [folie('b', true)], sources: [] } };
  const faelle: Array<[string, Parameters<typeof mitStore>[0], OberflaechenStand, ReturnType<typeof haupttaste>]> = [
    ['keine sichtbare Folie', nurVersteckt, bekannterStand(), { state: 'gesperrt', text: `${T.taste.praesentieren}${T.grund.keineFolien}`, title: T.grund.keineFolien }],
    ['beschäftigt', { ...mitFolien, busy: { active: true, label: 'Importiere…' } }, bekannterStand(), { state: 'gesperrt', text: `${T.taste.praesentieren}Importiere…`, title: 'Importiere…' }],
    ['bereit', mitFolien, bekannterStand(), { state: 'bereit', text: T.taste.praesentieren, title: undefined }],
    ['läuft live', mitFolien, bekannterStand({ praesentation: laufend(), bildschirme: bildschirme(22) }), { state: 'live', text: `LIVE${T.taste.beenden}`, title: undefined }],
    ['läuft schwarz', mitFolien, bekannterStand({ praesentation: laufend({ screen: 'black' }), bildschirme: bildschirme(22) }), { state: 'bereit', text: T.taste.beenden, title: undefined }],
  ];
  gleich(
    faelle.map(([name, store, s]) => [name, mitStore(store, () => haupttaste(werkzeug(rahmen(s))))]),
    faelle.map(([name, , , soll]) => [name, soll]),
    'PS Editor-Rahmen: Haupttaste je Zustand – gesperrt mit Grund (keine sichtbare Folie, busy.label), „Präsentieren“ bereit, „Beenden“ live nur bei laufender Folie',
  );
  const busy = mitStore({ ...mitFolien, busy: { active: true, label: 'Exportiere PDF…' } }, () => werkzeug(rahmen(bekannterStand())));
  ok(text(busy).includes('Exportiere PDF…') && knopfTexte(busy).slice(0, 6).length === 6, 'PS Editor-Rahmen: busy.label steht in der Werkzeugleiste neben NDI-Schalter und Haupttaste');
  const ndiText = (n: OberflaechenStand['ndi'], plattform = 'win32'): [string, boolean] => {
    const b = bereich(werkzeug(rahmen(bekannterStand({ ndi: n, plattform }))), 'data-presenter', 'ndi');
    return [text(b), /\sdisabled=""/.test(tags(b, 'button')[0] ?? '')];
  };
  gleich(
    [ndiText(ndiStatus('aus')), ndiText(ndiStatus('sendet', true, 2)), ndiText(ndiStatus('startet')), ndiText(ndiStatus('nicht-verfuegbar', true, 0, 'kein Addon')), ndiText(ndiStatus('nicht-verfuegbar', false, 0, 'nur Windows'), 'darwin')],
    [['NDI aus', false], ['NDI ● an · 2 Empfänger', false], ['NDI startet …', false], ['NDI nicht verfügbar', false], ['NDI nicht verfügbar', true]],
    'PS Editor-Rahmen: der NDI-Schalter zeigt die gemessene Lage wie bisher (ndiSchalterText) und ist außer unter Windows gesperrt',
  );
}

// ── PS Editor-Rahmen: Pille und Statusleiste mit derselben Startwahl (Pflicht aus Task 9: statusLeiste(s, startWahl)) ──
{
  const fall = (s: OberflaechenStand, startWahl: StartWahl): [string | undefined, string | undefined, string] => {
    const html = rahmen(s, startWahl, true);
    const eintrag = statusEintraege(html).find(([id]) => id === 'publikum');
    const pille = /data-state="[^"]*"[^>]*title="([^"]*)"/.exec(abschnitt(html, 'ausgabe'))?.[1] ?? '';
    return [eintrag?.[1], eintrag?.[2], pille];
  };
  const keine = bekannterStand();
  const nurNdi = bekannterStand({ praesentation: laufend(), bildschirme: bildschirme(null), ndi: ndiStatus('sendet', true, 1) });
  const lauf = bekannterStand({ praesentation: laufend(), bildschirme: bildschirme(33) });
  gleich(
    [fall(keine, { bildschirm: 99, nurNdi: false }), fall(keine, { bildschirm: 22, nurNdi: false }), fall(nurNdi, { bildschirm: 99, nurNdi: true }), fall(lauf, { bildschirm: 22, nurNdi: false })],
    [
      ['error', `${T.publikum.titel}: ${SCREEN_TEXTE.bildschirmFehlt}`, SCREEN_TEXTE.bildschirmFehlt],
      ['off', `${T.publikum.titel}: aus`, 'aus'],
      ['off', `${T.publikum.titel}: ${T.publikum.nurNdi}`, 'aus'],
      ['ok', `${T.publikum.titel}: ${bildschirme(33)[2].label}`, SCREEN_TEXTE.aufBildschirm(3)],
    ],
    'PS Editor-Rahmen: die Wurzel gibt Statusleiste und Ausgabe-Abschnitt dieselbe Startwahl – fehlende Wahl in beiden „Bildschirm fehlt“, bei nur NDI kein Fehler, bei laufendem Publikum der gemessene Bildschirm',
  );
  const r = QUELLE('views/EditorOberflaeche.tsx');
  ok(
    r.includes('status={statusLeiste(stand, startWahl)}') && r.includes('<Einstellungen stand={stand} aktionen={aktionen} startWahl={startWahl} />') && r.includes('startWahl={startWahl}'),
    'PS Editor-Rahmen: Quelltext – die Statusleiste bekommt dieselbe Startwahl wie das Panel (statusLeiste(stand, startWahl) und Einstellungen … startWahl={startWahl})',
  );
  ok((r.match(/const startWahl\b/g) ?? []).length === 1 && !/statusLeiste\(stand\)/.test(r), 'PS Editor-Rahmen: Quelltext – genau eine Startwahl in der Wurzel, nie statusLeiste ohne Startwahl');
}

// ── PS Editor-Rahmen: das Panel schiebt das Raster, der Inhalt bleibt ──
{
  const offen = rahmen(bekannterStand(), undefined, true);
  const zu = rahmen(bekannterStand());
  ok(
    offen.includes('aria-label="Einstellungen"') && offen.indexOf('data-presenter="arbeitsflaeche"') < offen.indexOf('aria-label="Einstellungen"') && zu.includes('data-presenter="arbeitsflaeche"') && !zu.includes('aria-label="Einstellungen"'),
    'PS Editor-Rahmen: bei offenem Panel bleibt die Arbeitsfläche gerendert, das Panel steht daneben (Spec 3.1, W2-4); beim Start zu',
  );
  const ober = QUELLE('views/EditorOberflaeche.tsx');
  ok(ober.includes('useState(anfangOffen)') && ober.includes('settingsOpen={panelOffen}') && !ober.includes('localStorage'), 'PS Editor-Rahmen: der Panelzustand ist ein lokaler useState (zu beim Start, nichts gemerkt)');
  ok(ober.includes('tool="Presenter"') && ober.includes('dichte="kompakt"') && ober.includes('onAir={kopfOnAir(stand)}'), 'PS Editor-Rahmen: tool „Presenter“ ohne „JM “, Dichte kompakt, ON AIR aus kopfOnAir');
  ok(!/useState\([^)]*\)\s*;[^\n]*localStorage/.test(ober) && /useState<number \| undefined>\(undefined\)/.test(ober) && /useState\(false\)/.test(ober), 'PS Editor-Rahmen: die Startwahl (Bildschirm, nur NDI) lebt als lokaler Zustand in der Wurzel, nicht gemerkt');
}

// ── PS ein Stand: EditorOberflaeche holt den Stand nur über useStand, ohne eigene Abos; alle Abos stehen in useStand ──
{
  const ABO = /useBrueckenWert|useNdiStatus|useTimerSync|\.on(?:State|Status|Bildschirme|MasterLink|Fernsteuerung)\(|\.displays\(|\.getState\(|\.getConfig\(|\.status\(\)|\.interfaces\(|MASTER_LINK_QUELLE|FERNSTEUERUNG_QUELLE/;
  const wurzel = QUELLE('views/EditorOberflaeche.tsx');
  ok((wurzel.match(/useStand\('editor', panelOffen\)/g) ?? []).length === 1, "PS ein Stand: EditorOberflaeche ruft useStand('editor', panelOffen) genau einmal");
  gleich(
    ['views/EditorOberflaeche.tsx', 'views/EditorView.tsx', 'views/Einstellungen.tsx', 'components/Toolbar.tsx', 'components/GastKlickerAbschnitt.tsx'].filter((d) => ABO.test(QUELLE(d))),
    [],
    'PS ein Stand: Wurzel, Arbeitsfläche, Panel, Werkzeugleiste und Gast-Klicker-Abschnitt haben keine eigenen Abos und Abfragen',
  );
  const s = QUELLE('lib/useStand.ts');
  const noetig = [
    'present?.getState', 'present?.onState', 'present?.displays', 'present?.onBildschirme', 'ndi?.status', 'ndi?.onStatus', 'remote?.status', 'remote?.onStatus',
    'remote?.interfaces', 'gastKlicker?.status', 'gastKlicker?.onStatus', 'timer?.getState', 'timer?.onState', 'timer?.getConfig',
    'useBrueckenWert(MASTER_LINK_QUELLE)', 'useBrueckenWert(FERNSTEUERUNG_QUELLE)',
  ];
  gleich(noetig.filter((n) => !s.includes(n)), [], 'PS ein Stand: useStand liest Präsentation, Bildschirme, NDI, Handy, Netzwerkkarten, Gast-Klicker, Timer, Master-Link und Fernsteuerung an einer Stelle');
  ok(/export function useStand\(fenster: 'editor' \| 'referent', panelOffen: boolean\): OberflaechenStand/.test(s), 'PS ein Stand: Signatur useStand(fenster, panelOffen): OberflaechenStand');
  const ohnePreload = s.replace(/function preload\(\)[\s\S]*?\n}\n/, '');
  ok(
    /typeof window === 'undefined'/.test(s) && (ohnePreload.match(/\bwindow\.\w+/g) ?? []).every((w) => w === 'window.confirm'),
    'PS ein Stand: useStand.ts liest window nur in preload() hinter typeof window (Render-Tests ohne window); sonst nur window.confirm im Rückruf „Neuer Link“',
  );
  // Ohne window: jede Quelle antwortet null und meldet nie, nichts wirft.
  const quellen = [stand.PRAESENTATION_QUELLE, stand.NDI_QUELLE, stand.HANDY_QUELLE, stand.GAST_KLICKER_QUELLE, stand.TIMER_ZUSTAND_QUELLE, stand.TIMER_EINSTELLUNG_QUELLE];
  const antworten = await Promise.all(quellen.map((q) => (q === undefined ? Promise.resolve('fehlt') : q.abfrage())));
  const ab = quellen.map((q) => (q === undefined ? 'fehlt' : typeof q.ereignis(() => undefined)));
  gleich([antworten, ab], [quellen.map(() => null), quellen.map(() => 'function')], 'PS ein Stand: ohne window antworten alle Quellen null und melden sich ohne Wurf an');
}

// ── PS ein Stand: Timer-Einstellung – der Main meldet sie nicht, darum meldet timerEinstellen sie selbst (sofort, wie bisher) ──
{
  const gemeldet: unknown[] = [];
  const q = stand.TIMER_EINSTELLUNG_QUELLE;
  const ab = q?.ereignis((c) => void gemeldet.push(c)) ?? (() => undefined);
  stand.timerEinstellen?.({ enabled: true, host: '10.0.0.9', port: 7777 });
  ab();
  stand.timerEinstellen?.({ enabled: false, host: 'x', port: 1 });
  gleich(gemeldet, [{ enabled: true, host: '10.0.0.9', port: 7777 }], 'PS ein Stand: timerEinstellen meldet die neue Timer-Einstellung sofort an useStand (ohne window kein apply, kein Wurf); nach der Abmeldung nichts mehr');
}

// ── PS ein Stand: Bildschirmliste – sofort lesen (Start, Präsentation, Panel), Ereignisse zusammenfassen, nie eine ältere Antwort
// über eine neuere (Pflicht aus Task 8/9: move des Publikumsfensters feuert oft und ungedrosselt) ──
{
  const leser = stand.bildschirmLeser;
  ok(typeof leser === 'function' && stand.BILDSCHIRM_RUHE_MS === 150, 'PS ein Stand: lib/useStand.ts hat bildschirmLeser und BILDSCHIRM_RUHE_MS = 150');
  if (typeof leser === 'function') {
    // Uhr und Abfrage als Attrappen: die Uhr feuert nur auf Anstoß, jede Abfrage wartet, bis der Test sie beantwortet.
    const uhr = { geplant: [] as Array<{ f: () => void; ms: number; weg: boolean }> };
    const zeit = {
      setTimeout: (f: () => void, ms: number) => (uhr.geplant.push({ f, ms, weg: false }), uhr.geplant.length - 1),
      clearTimeout: (id: unknown) => void (uhr.geplant[id as number] && (uhr.geplant[id as number].weg = true)),
    };
    const feuere = (): void => {
      const offen = uhr.geplant.filter((g) => !g.weg);
      uhr.geplant = [];
      offen.forEach((g) => g.f());
    };
    const fragen: Array<{ an(l: DisplayInfo[]): void; nein(): void }> = [];
    const frage = (): Promise<DisplayInfo[]> => new Promise((an, nein) => void fragen.push({ an, nein: () => nein(new Error('weg')) }));
    const gesetzt: Array<string> = [];
    const setze = (l: DisplayInfo[] | undefined): void => void gesetzt.push(l === undefined ? 'unbekannt' : l.find((d) => d.current)?.id.toString() ?? 'keiner');
    const l = leser(frage, setze, zeit);
    // Fehlt eine erwartete Abfrage, bricht der Ablauf ab und zählt als FAIL (statt den Lauf zu beenden).
    const antworte = (i: number, liste: DisplayInfo[] | null): void => {
      if (fragen[i] === undefined) throw new Error(`Abfrage ${i + 1} fehlt`);
      if (liste === null) fragen[i].nein();
      else fragen[i].an(liste);
    };
    try {
    l.lies();
    const nachLies = fragen.length;
    antworte(0, bildschirme(22));
    await tick();
    for (let i = 0; i < 20; i++) l.ereignis();
    const vorUhr = fragen.length;
    const geplant = uhr.geplant.filter((g) => !g.weg).map((g) => g.ms);
    feuere();
    const nachUhr = fragen.length;
    // Während die Abfrage läuft: ein sofortiges Lesen und ein Ereignis warten, eine zweite Abfrage startet erst nach der Antwort.
    l.lies();
    l.ereignis();
    feuere();
    const waehrend = fragen.length;
    antworte(1, bildschirme(33));
    await tick();
    const danach = fragen.length;
    antworte(2, bildschirme(11));
    await tick();
    // Fehler → unbekannt; nach ab() wirken weder eine späte Antwort noch ein geplantes Ereignis.
    l.lies();
    antworte(3, null);
    await tick();
    l.ereignis();
    l.lies();
    l.ab();
    feuere();
    antworte(4, bildschirme(22));
    await tick();
    l.ereignis();
    feuere();
    gleich(
      { nachLies, vorUhr, geplant, nachUhr, waehrend, danach, fragenGesamt: fragen.length, gesetzt },
      { nachLies: 1, vorUhr: 1, geplant: [150], nachUhr: 2, waehrend: 2, danach: 3, fragenGesamt: 5, gesetzt: ['22', '33', '11', 'unbekannt'] },
      'PS ein Stand: bildschirmLeser liest sofort; 20 Ereignisse ergeben eine Abfrage nach 150 ms; eine Abfrage zur Zeit, Antworten in Reihenfolge (nie eine ältere über eine neuere); Fehler → unbekannt; nach ab() nichts mehr',
    );
    } catch (e) {
      ok(false, `PS ein Stand: bildschirmLeser – Ablauf vollständig (${String(e)})`);
    }
    const ohne: string[] = [];
    const leer = leser(undefined, (x) => void ohne.push(String(x)), zeit);
    leer.lies();
    leer.ereignis();
    feuere();
    gleich(ohne, [], 'PS ein Stand: ohne Abfrage (kein Preload) liest bildschirmLeser nichts und setzt nichts');
  }
  const s = QUELLE('lib/useStand.ts');
  ok(
    /present\?\.onBildschirme\?\.\(\(\) => [a-z]+\.ereignis\(\)\)/.test(s) && /\[praesentation\]\)/.test(s) && /if \(panelOffen\) [a-zA-Z.?]*lies\(\)/.test(s),
    'PS ein Stand: useStand liest die Liste beim Start und bei jeder Änderung der Präsentation sofort, beim Öffnen des Panels, und fasst present:bildschirme über den Leser zusammen (B11)',
  );
}

// ── PS Ablage außen: DateiAblage umschließt den ganzen Rahmen (N2b 1.10 R6), die Öffnen-Frage steht daneben ──
{
  const html = ohneWurf('PS Ablage außen', () => render(<EditorView />));
  ok(/^<div class="relative[^"]*"><div data-dichte="kompakt"/.test(html), 'PS Ablage außen: das äußerste Element ist die Ablage (DateiAblage), ihr erstes Kind der AppShell-Rahmen (Kopf, Leiste, Inhalt, Statusleiste)');
  const v = QUELLE('views/EditorView.tsx');
  const pos = ['<DateiAblage', '<EditorOberflaeche', '</EditorOberflaeche>', '</DateiAblage>', '<OeffnenFrage />'].map((t) => v.indexOf(t));
  ok(pos.every((p, i) => p >= 0 && (i === 0 || p > pos[i - 1])), 'PS Ablage außen: Quelltext – DateiAblage umschließt EditorOberflaeche (und damit AppShell), OeffnenFrage steht dahinter, außerhalb der Ablage');
  ok(QUELLE('views/EditorOberflaeche.tsx').includes('<AppShell') && !QUELLE('views/EditorOberflaeche.tsx').includes('DateiAblage'), 'PS Ablage außen: der AppShell steht in EditorOberflaeche, die Ablage nur außen in EditorView');
}

// ── PS Editor-Rahmen: der Dialog OeffnenFrage bleibt, wie er ist (Aufbau und Texte; nur Tokens statt roher Farben) ──
{
  const datei = { name: 'Vortrag.pdf', kind: 'pdf' as const, bytes: new Uint8Array() };
  const html = ohneWurf('PS Editor-Rahmen', () => mitStore({ frage: { files: [datei] }, dirty: true }, () => render(<EditorView />)));
  const dialog = bereich(html, 'role', 'dialog');
  ok(
    html.indexOf('role="dialog"') > html.lastIndexOf('data-bereich="inhalt"') && /<div class="fixed inset-0 z-50[^"]*grid place-items-center p-6"><div role="dialog" aria-modal="true" aria-labelledby="[^"]+"/.test(html),
    'PS Editor-Rahmen: die Öffnen-Frage ist weiter ein modaler Dialog über dem ganzen Fenster (fixed inset-0 z-50), außerhalb der Ablage',
  );
  gleich(
    [text(dialog.match(/<h3[\s\S]*?<\/h3>/)?.[0] ?? ''), knopfTexte(dialog), text(dialog).includes('Im Presenter liegt schon eine Präsentation.'), text(dialog).includes('Beim Ersetzen gehen nicht gespeicherte Änderungen verloren.')],
    ['„Vortrag.pdf“ öffnen', ['Ersetzen', 'Anhängen', 'Abbrechen'], true, true],
    'PS Editor-Rahmen: Titel, Texte und die drei Knöpfe der Öffnen-Frage unverändert',
  );
  const q = QUELLE('components/OeffnenFrage.tsx');
  ok(q.includes("e.key !== 'Escape'") && q.includes("beantworte('abbrechen')") && q.includes('anhaengen.current?.focus()'), 'PS Editor-Rahmen: Esc bricht ab, der Fokus steht auf „Anhängen“ (Abläufe der Öffnen-Frage unverändert)');
}

// ── PS keine rohen Farben: geänderte Dateien nur mit Tokens; ausgenommen nur das QR-Bild in Pairing (RemotePanel.tsx, QrBild) ──
{
  const roh = /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|shadow|accent)-(?:white|black|neutral|gray|grey|zinc|slate|stone|red|green|blue|yellow|amber|orange|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?\b|#[0-9a-fA-F]{3,8}\b/;
  const dateien = [
    'views/EditorView.tsx',
    'views/EditorOberflaeche.tsx',
    'views/Einstellungen.tsx',
    'components/Toolbar.tsx',
    'components/NdiSchalter.tsx',
    'components/OeffnenFrage.tsx',
    'components/RemotePanel.tsx',
    'components/GastKlickerAbschnitt.tsx',
    'lib/useStand.ts',
  ];
  const ohneQr = (d: string, q: string): string => (d === 'components/RemotePanel.tsx' ? q.replace(/\nfunction QrBild\([\s\S]*?\n}\n/, '\n') : q);
  gleich(dateien.filter((d) => roh.test(ohneQr(d, QUELLE(d)))), [], 'PS keine rohen Farben: keine rohen Farbklassen und Hex-Werte in den geänderten Dateien, nur Tokens (W2-9)');
  const remote = ROH('components/RemotePanel.tsx');
  const qr = /\nfunction QrBild\([\s\S]*?\n}\n/.exec(remote)?.[0] ?? '';
  ok(qr.includes("dark: '#0c0c0c'") && qr.includes("light: '#ffffff'") && qr.includes('bg-white'), 'PS keine rohen Farben: das QR-Bild (QrBild in Pairing) bleibt dunkel auf weiß (Programmfläche, B5)');
  ok(qr !== '' && roh.test(ohneKommentare(remote.replace(qr, '\n'))) === false,'PS keine rohen Farben: außerhalb von QrBild hat RemotePanel.tsx keine rohe Farbe mehr, auch nicht in der Hülle');
  ok(!/AppShell|@jm\/settings|var\(--/.test(QUELLE('views/AudienceView.tsx')), 'PS keine rohen Farben: AudienceView bleibt Programmfläche ohne Rahmen und ohne Token-Umzug (B5)');
}

// ── Hilfen für die übrigen Prüfungen: Grundstand ohne Wurf ──
ok(grundStand().netzwerkkarten === undefined && statusLeiste(grundStand()).length > 0, 'PS ein Stand: der Grundstand kennt die Netzwerkkarten (undefined = noch nicht gelesen)');
