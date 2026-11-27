// UX Welle 2a, Recorder d · Rahmen (Spec 3.1, 3.2, 3.8, 5.1, 10; E4, E5, E13, E15, E16; Übergabe Task 20): AppShell mit Kopf
// „JM Audio Recorder“, ON AIR (nur bei recording), ThemeToggle und ⚙, Statusleiste aus lib/oberflaeche.ts. init() bleibt im
// App-Wurzelknoten (Funktionsliste Nr. 64, 111). Der gemessene Zustand kommt nur aus getState beim Einhängen und onState,
// nie aus dem Store. Das Panel steckt in keinem key und keiner Bedingung um den Live-Bereich. Render ohne Browser und ohne
// window.
import { existsSync } from 'node:fs';
import { ordneStatus, verbindeBruecke } from '@jm/ui';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import type { RecorderState } from '@shared/types';
import { App } from '@/App';
import { ZUSTAND_QUELLE } from '@/lib/bruecken';
import { statusLeiste, type OberflaechenStand } from '@/lib/oberflaeche';
import { RecorderOberflaeche } from '@/views/RecorderOberflaeche';
import { UI_TEXTE } from '../../../../packages/ui/src/lib/texte';
import { attr, element, GERAETE, mitStore, ohneKommentare, quellen, statusEintraege, tags, text, warte, zustand } from './testzustand';

const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
/** Der Inhalt des AppShell (`<main>…</main>`), ohne Kopf, Panel und Statusleiste. */
const inhalt = (html: string): string => element(html, 'main', '');
/** Stand, den die Oberfläche mit dem Anfangszustand des Stores bildet (vor jeder Antwort). */
const STAND_ANFANG: OberflaechenStand = {
  recorder: { deviceIndex: null, channels: 2, sampleRate: 48000, loading: true, hinweisEingang: null },
  zustand: undefined,
  geraete: [],
  meldung: null,
  masterLink: undefined,
  fernsteuerung: undefined,
};

// ── RE Rahmen: Kopf, ⚙, ThemeToggle, Statusleiste vor der ersten Antwort ──
{
  const html = render(<RecorderOberflaeche />);
  const [zahnrad] = tags(html, 'button').filter((t) => attr(t, 'data-zahnrad') !== undefined);
  const [thema] = tags(html, 'button').filter((t) => attr(t, 'data-theme') !== undefined);
  ok(
    text(html).includes('JM Audio Recorder') && !html.includes('JM AUDIO RECORDER') && html.includes('data-bereich="inhalt"'),
    'RE Rahmen: AppShell mit Kopf „JM Audio Recorder“ (die alte Marke „JM AUDIO RECORDER“ ist weg)',
  );
  ok(!text(html).includes('Mehrkanal-Aufnahme · Dante / ASIO'), 'RE Rahmen: der alte Untertitel „Mehrkanal-Aufnahme · Dante / ASIO“ entfällt (E16)');
  gleich(
    [attr(thema, 'aria-label'), attr(zahnrad, 'aria-label'), attr(zahnrad, 'aria-expanded')],
    [UI_TEXTE.themeUmschalten(UI_TEXTE.dunkel, UI_TEXTE.hell), UI_TEXTE.einstellungenOeffnen, 'false'],
    'RE Rahmen: ThemeToggle (E5) und ⚙ „Einstellungen öffnen“ im Kopf, Panel beim Start zu',
  );
  const knopfTexte = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1]).trim());
  ok(!knopfTexte.includes('Light') && !knopfTexte.includes('Dark'), 'RE Rahmen: kein lokaler Theme-Knopf „Light“/„Dark“ mehr (E5)');
  ok(!existsSync('src/renderer/src/components/Topbar.tsx'), 'RE Rahmen: components/Topbar.tsx samt lokalem Theme-Knopf ist gelöscht');
  gleich(quellen().filter((d) => /Topbar/.test(ohneKommentare(leseText(d)))), [], 'RE Rahmen: keine Quelldatei verweist mehr auf Topbar');
  gleich(
    statusEintraege(html).map(([id, z]) => [id, z]),
    ordneStatus(statusLeiste(STAND_ANFANG)).map((i) => [i.id, i.state]),
    'RE Rahmen: die Statusleiste zeigt genau statusLeiste(stand) in der Reihenfolge von ordneStatus',
  );
  gleich(
    statusEintraege(html).map(([id, z, tipp]) => [id, z, (tipp ?? '').includes('unbekannt')]),
    [
      ['master-link', 'off', true],
      ['aufnahme', 'off', true],
      ['platz', 'off', true],
      ['fernsteuerung', 'off', true],
      ['eingang', 'off', true],
      ['zeitplan', 'off', true],
    ],
    'RE Rahmen (Altfehler RE-PLATZ, geänderte Erwartung): vor der ersten Antwort sind Master, Aufnahme, Platz, Fernsteuerung, Eingang und Zeitplan „unbekannt“, nichts ist ok',
  );
  ok(html.includes('data-onair="bereit"') && !html.includes('data-onair="live"'), 'RE Rahmen: ON AIR im Kopf, nicht live vor der ersten Antwort (E4)');
  pruefeIdVerweise(html, 'RE Rahmen: id-Verweise im ganzen Bedienfenster gültig');
  ok(!text(html).includes('"'), 'RE Rahmen: kein ASCII-Anführungszeichen im Text des Bedienfensters');
}

// ── RE Rahmen: nach dem Laden ohne Geräte (Addon fehlt, Befund 3) ──
{
  const leer = mitStore({ loading: false, devices: [] }, () => render(<RecorderOberflaeche />));
  const modul = statusEintraege(leer).find(([id]) => id === 'audio-modul');
  ok(modul?.[1] === 'error' && (modul[2] ?? '').includes('Audio-Modul fehlt'), 'RE Rahmen: ist die Geräteliste nach dem Laden leer, meldet die Statusleiste „Audio-Modul fehlt“');
  const voll = mitStore({ loading: false, devices: GERAETE, deviceIndex: 0 }, () => render(<RecorderOberflaeche />));
  ok(!statusEintraege(voll).some(([id]) => id === 'audio-modul'), 'RE Rahmen: mit Geräten kein Eintrag Audio-Modul');
}

// ── RE Rahmen: Verdrahtung in der View ──
{
  const ober = QUELLE('views/RecorderOberflaeche.tsx');
  ok(ober.includes('tool="Audio Recorder"') && !ober.includes('tool="JM'), 'RE Rahmen: tool „Audio Recorder“ ohne „JM “ (der Kopf ergänzt es zu „JM Audio Recorder“)');
  ok(
    ober.includes('useBrueckenWert(MASTER_LINK_QUELLE)') && ober.includes('useBrueckenWert(FERNSTEUERUNG_QUELLE)') && ober.includes('status={statusLeiste(stand)}') && ober.includes('onAir={kopfOnAir(stand)}'),
    'RE Rahmen: Brücken, Statusleiste und ON AIR (kopfOnAir, nur bei recording) laufen in der View, auch bei geschlossenem Panel',
  );
  ok(
    ober.includes('settingsOpen={panelOffen}') && ober.includes('useState(anfangOffen)') && !ober.includes('localStorage') && ober.includes('settings={<Einstellungen'),
    'RE Rahmen: Panel über settings am AppShell; der Panelzustand ist ein lokaler useState (zu beim Start, nichts gemerkt)',
  );
  ok(!/\bkey=/.test(ober), 'RE Rahmen: der Rahmen setzt keinen key (der Panelzustand steckt in keinem key)');
  gleich((ober.match(/\bpanelOffen\b/g) ?? []).length, 2, 'RE Rahmen: panelOffen steht nur in useState und settingsOpen, in keiner Bedingung um den Live-Bereich');
  const live = ober.slice(ober.indexOf('<LiveBereich'), ober.indexOf('<LiveBereich') + 200);
  ok(ober.includes('<LiveBereich') && !/panel/i.test(live.slice(0, live.indexOf('/>'))), 'RE Rahmen: LiveBereich bekommt keinen Panelzustand');
}

// ── RE Rahmen: Panel offen oder zu, der Inhalt bleibt gleich ──
{
  const z = mitStore({ loading: false, devices: GERAETE, deviceIndex: 0 }, () => render(<RecorderOberflaeche />));
  const o = mitStore({ loading: false, devices: GERAETE, deviceIndex: 0 }, () => render(<RecorderOberflaeche anfangOffen />));
  ok(o.includes(`aria-label="${UI_TEXTE.einstellungen}"`) && !z.includes(`aria-label="${UI_TEXTE.einstellungen}"`), 'RE Rahmen: das Panel ist offen bzw. zu');
  ok(inhalt(z) !== '' && inhalt(o) === inhalt(z), 'RE Rahmen: der Inhalt (Live-Bereich und Zeitplan) ist bei offenem und geschlossenem Panel Zeichen für Zeichen gleich (das Panel steht daneben)');
}

// ── RE init bleibt: init() nur im App-Wurzelknoten ──
{
  const app = QUELLE('App.tsx');
  ok(
    app.includes('const init = useRec((s) => s.init);') && /useEffect\(\(\) => \{\s*void init\(\);\s*\}, \[init\]\);/.test(app),
    'RE init bleibt: App.tsx startet init() einmal im Effekt des Wurzelknotens (Hörer für Pegel, Zustand, Meldung, Fernbefehle, Show)',
  );
  ok(/return <RecorderOberflaeche \/>;/.test(app) && !/\bkey=/.test(app) && !/[?&]{2}|\? </.test(app.slice(app.indexOf('return'))), 'RE init bleibt: App zeigt die Oberfläche ohne Bedingung und ohne key');
  gleich(
    quellen().filter((d) => !d.endsWith('/App.tsx') && !d.endsWith('/store/recorder.ts') && /\binit\b/.test(ohneKommentare(leseText(d)))),
    [],
    'RE init bleibt: keine andere Datei des Renderers nennt init (nur App.tsx ruft es, der Store definiert es)',
  );
  const main = QUELLE('main.tsx');
  ok(main.includes('<StrictMode>') && main.includes('<App />'), 'RE init bleibt: main.tsx hängt App unverändert unter StrictMode ein');
  const html = render(<App />);
  ok(text(html).includes('JM Audio Recorder') && html.includes('data-recorder="live"'), 'RE init bleibt: App rendert den Rahmen mit Live-Bereich');
  ok(!app.includes('notice') && !app.includes('Topbar'), 'RE init bleibt: App.tsx trägt nur noch init und die Oberfläche (Toast und Kopf liegen in der View)');
}

// ── RE Zustand nur gemessen: getState beim Einhängen und onState, ein Push gewinnt ──
{
  ok(typeof ZUSTAND_QUELLE.abfrage === 'function' && typeof ZUSTAND_QUELLE.ereignis === 'function', 'RE Zustand nur gemessen: lib/bruecken.ts hat die Quelle ZUSTAND_QUELLE');
  gleich([await ZUSTAND_QUELLE.abfrage(), typeof ZUSTAND_QUELLE.ereignis(() => {})], [null, 'function'], 'RE Zustand nur gemessen: ohne window antwortet die Quelle null und das Ereignis gibt eine Abmeldung');

  const g = globalThis as unknown as { window?: unknown };
  const log: string[] = [];
  let push: ((s: RecorderState) => void) | undefined;
  let antworte: ((s: RecorderState) => void) | undefined;
  let lehneAb: ((e: Error) => void) | undefined;
  // Attrappe des Preloads: getState antwortet erst, wenn der Test es sagt (antworte/lehneAb); onState merkt den Hörer.
  const attrappe = (): unknown => ({
    jmrec: {
      getState: () => {
        log.push('getState');
        return new Promise<RecorderState>((r, f) => {
          antworte = r;
          lehneAb = f;
        });
      },
      onState: (cb: (s: RecorderState) => void) => {
        log.push('onState');
        push = cb;
        return () => void log.push('ab');
      },
    },
  });
  const status = (w: RecorderState | null): string => (w === null ? 'null' : w.status);
  try {
    // A: Push vor der Antwort → die (ältere) Antwort wird verworfen.
    g.window = attrappe();
    const a: string[] = [];
    const abA = verbindeBruecke(ZUSTAND_QUELLE, (w) => void a.push(status(w)));
    push?.(zustand('recording'));
    antworte?.(zustand('idle'));
    await warte();
    abA();
    gleich([log.splice(0), a], [['onState', 'getState', 'ab'], ['recording']], 'RE Zustand nur gemessen: erst onState anmelden, dann getState; ein Push vor der Antwort gewinnt, die spätere Antwort gilt nicht');
    // B: Antwort zuerst, dann Push → beide, der Push zuletzt.
    const b: string[] = [];
    const abB = verbindeBruecke(ZUSTAND_QUELLE, (w) => void b.push(status(w)));
    antworte?.(zustand('armed'));
    await warte();
    push?.(zustand('recording'));
    push?.(zustand('armed'));
    abB();
    push?.(zustand('idle'));
    log.splice(0);
    gleich(b, ['armed', 'recording', 'armed'], 'RE Zustand nur gemessen: die Antwort von getState gilt, bis ein Push kommt; jeder spätere Push gewinnt; nach der Abmeldung zählt nichts mehr');
    // C: getState lehnt ab → null (die View macht daraus „unbekannt“).
    const c: string[] = [];
    const abC = verbindeBruecke(ZUSTAND_QUELLE, (w) => void c.push(status(w)));
    lehneAb?.(new Error('weg'));
    await warte();
    abC();
    gleich(c, ['null'], 'RE Zustand nur gemessen: lehnt getState ab, meldet die Quelle null (unbekannt), nie einen erfundenen Zustand');
  } finally {
    delete g.window;
  }
  const ober = QUELLE('views/RecorderOberflaeche.tsx');
  ok(
    ober.includes('useBrueckenWert(ZUSTAND_QUELLE)') && /const zustand = gemessen \?\? undefined;/.test(ober) && /const stand: OberflaechenStand = \{[^}]*\bzustand,/.test(ober),
    'RE Zustand nur gemessen: die View füllt zustand nur aus ZUSTAND_QUELLE (getState + onState); null wird unbekannt',
  );
  const quelleBruecke = QUELLE('lib/bruecken.ts');
  ok(
    /abfrage: \(\) => preload\(\)\?\.getState\?\.\(\) \?\? Promise\.resolve\(null\)/.test(quelleBruecke) && /ereignis: \(cb\) => preload\(\)\?\.onState\?\.\(cb\) \?\? \(\(\) => \{\}\)/.test(quelleBruecke),
    'RE Zustand nur gemessen: ZUSTAND_QUELLE liest jmrec.getState und jmrec.onState (vorhandene Preload-Funktionen)',
  );
  const dateien = ['views/RecorderOberflaeche.tsx', 'views/LiveBereich.tsx', 'views/Einstellungen.tsx', 'views/RecorderView.tsx'];
  gleich(
    dateien.filter((d) => /\bs\.state\b|\.state\.status|useRec\(\(s\) => s\.state/.test(QUELLE(d))),
    [],
    'RE Zustand nur gemessen: Oberfläche, Live-Bereich, Panel und Zeitplan lesen den Store-Zustand nie (der Store startet mit IDLE und fragt nie)',
  );
  ok(/<ScheduleCard zustand=\{zustand\} \/>/.test(ober) && /<LiveBereich stand=\{stand\}/.test(ober), 'RE Zustand nur gemessen: Live-Bereich und Zeitplan bekommen den gemessenen Zustand aus der View');
}
