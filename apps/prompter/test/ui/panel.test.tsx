// UX Welle 2a, Prompter d · Einstellungs-Panel (Spec 3.6, 6; E3, E11, E15): Ausgabe auf Bildschirm und Fernsteuerung aus
// @jm/settings, dahinter die tool-eigenen Abschnitte Schrift, Lese-Linie, Darstellung und Handy-Fernbedienung. Jeder
// Statuseintrag mit Abschnitt findet seinen Anker. Das alte Pult zeigt diese Abschnitte nicht mehr. Render ohne Browser.
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import type { AusgabeZustand } from '@jm/output-window/zustand';
import { DEFAULT_CONFIG, type PrompterState } from '@shared/types';
import * as aktionenModul from '@/lib/aktionen';
import { baueAktionen } from '@/lib/aktionen';
import { ABSCHNITT, bildschirmEtikett, PROMPTER_TEXTE, statusLeiste, type OberflaechenStand } from '@/lib/oberflaeche';
import { Einstellungen, type EinstellungenAktionen } from '@/views/Einstellungen';
import { abschnitt, attr, basisMeldung, ohneKommentare, tags, text } from './testzustand';

const T = PROMPTER_TEXTE;
const state = (teil: Partial<PrompterState['config']> = {}, remote: PrompterState['remote'] = { running: false, urls: [] }): PrompterState => ({
  config: { ...DEFAULT_CONFIG, ...teil },
  transport: { playing: false, anchorEm: 0, anchorAtMs: 0, emPerSec: 1 },
  remote,
});
function stand(z: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return { prompter: state(), ausgabe: undefined, masterLink: undefined, fernsteuerung: undefined, ...z };
}
function aktionen(log: string[] = []): EinstellungenAktionen {
  return {
    ausgabeUmschalten: (an) => void log.push(`ausgabe${an}`),
    bildschirmWaehlen: (id) => void log.push(`bildschirm${id}`),
    konfigurieren: (p) => void log.push(`konfig${JSON.stringify(p)}`),
    handyUmschalten: (an) => void log.push(`handy${an}`),
    ausgabeVerschieben: () => void log.push('verschieben'),
  };
}
const panel = (s: OberflaechenStand, log: string[] = []): string => render(<Einstellungen stand={s} aktionen={aktionen(log)} />);
const titel = (html: string): string[] => [...html.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]);
const schalter = (html: string): string[] => tags(html, 'button').filter((t) => attr(t, 'role') === 'switch').map((t) => attr(t, 'aria-checked') ?? '');

// ── PR Panel Abschnitte: Anker und Reihenfolge ──
{
  const log: string[] = [];
  const s = stand();
  const html = panel(s, log);
  gleich(Object.values(ABSCHNITT).filter((id) => !html.includes(`id="einstellung-${id}"`)), [], 'PR Panel Abschnitte: Anker für alle ABSCHNITT-Werte (ausgabe, fernsteuerung, schrift, leselinie, darstellung, handy)');
  gleich(
    titel(html).slice(2),
    [T.titel.schrift, T.titel.leselinie, T.titel.darstellung, T.handy.titel],
    'PR Panel Abschnitte: hinter den gemeinsamen Abschnitten folgen Schrift, Lese-Linie, Darstellung, Handy-Fernbedienung',
  );
  const ziele = statusLeiste(s).map((i) => i.settingsSection).filter((z): z is string => typeof z === 'string');
  gleich(ziele.filter((z) => !html.includes(`id="einstellung-${z}"`)), [], 'PR Panel Abschnitte: jeder Statuseintrag mit Abschnitt findet seinen Anker');
  pruefeIdVerweise(html, 'PR Panel Abschnitte: id-Verweise gültig');
  gleich(log, [], 'PR Panel Abschnitte: Rendern löst keine Aktion aus');
  ok(!text(html).includes('"'), 'PR Panel Abschnitte: kein ASCII-Anführungszeichen in den Texten des Panels');
}

// ── Das alte Pult zeigt diese Abschnitte nicht mehr ──
{
  const pult = ohneKommentare(leseText('src/renderer/src/views/PrompterOberflaeche.tsx') + leseText('src/renderer/src/views/LiveBereich.tsx'));
  const alt = ['Schriftgröße', 'Zeilenabstand', 'Seitenrand', 'Lese-Linie', 'Spiegeln', 'Fernbedienung aktiv', 'refreshDisplays', 'RemoteQr', 'type="checkbox"', '<select'].filter((w) => pult.includes(w));
  gleich(alt, [], 'PR Panel Abschnitte: das Steuerpult im Hauptfenster zeigt Schrift, Lese-Linie, Darstellung, Ausgabe und Handy-Fernbedienung nicht mehr');
  ok(!pult.includes('Lauf & Schrift'), 'PR Panel Abschnitte: die alte Überschrift „Lauf & Schrift“ ist weg');
}

// ── Ausgabe auf Bildschirm (E3) ──
{
  const aus = (z: AusgabeZustand | null | undefined, b?: OberflaechenStand['bildschirme']): string => abschnitt(panel(stand({ ausgabe: z, bildschirme: b })), ABSCHNITT.ausgabe);
  const zu = aus({ art: 'zu', displayId: null });
  const offen = aus({ art: 'offen', displayId: 1 }, [{ id: 1, label: 'Talent', primary: false }]);
  ok(schalter(zu).length === 1 && !text(zu).includes('Vollbild') && !text(zu).includes('Hintergrund'), 'PR Panel Abschnitte: Ausgabe zeigt einen Schalter und kein Vollbild- und kein Hintergrundfeld');
  gleich([schalter(zu), schalter(offen)], [['false'], ['true']], 'PR Panel Abschnitte: der Ausgabeschalter folgt dem gemessenen Zustand (zu = aus, offen = an)');
  ok(text(offen).includes('Talent'), 'PR Panel Abschnitte: die frisch geholte Bildschirmliste steht in der Auswahl');
}

// ── Fernsteuerung (nur Status) ──
{
  const html = panel(stand({ fernsteuerung: basisMeldung({ clients: 2 }) }));
  const f = abschnitt(html, ABSCHNITT.fernsteuerung);
  ok(text(f).includes('8727') && text(f).includes('2') && !f.includes('role="switch"'), 'PR Panel Abschnitte: Fernsteuerung zeigt Port 8727 und die Zahl der Verbundenen, ohne Schalter');
}

// ── Tool-eigene Abschnitte ──
{
  const html = panel(stand({ prompter: state({ readingLine: true, remoteEnabled: true }, { running: true, urls: ['http://10.0.0.5:8728/?t=abc'] }) }));
  const schrift = abschnitt(html, ABSCHNITT.schrift);
  gleich(
    tags(schrift, 'input').filter((t) => attr(t, 'type') === 'range').map((t) => [attr(t, 'min'), attr(t, 'max'), attr(t, 'step')]),
    [['3', '16', '0.5'], ['1', '2.4', '0.05'], ['0', '28', '1']],
    'PR Panel Abschnitte: Schrift hat Schriftgröße, Zeilenabstand und Seitenrand mit den alten Bereichen',
  );
  ok(['Schriftgröße', 'Zeilenabstand', 'Seitenrand'].every((w) => text(schrift).includes(w)), 'PR Panel Abschnitte: Schrift trägt die alten Beschriftungen');
  const linie = abschnitt(html, ABSCHNITT.leselinie);
  ok(text(linie).includes('Lese-Linie anzeigen') && text(linie).includes('Position') && tags(linie, 'input').some((t) => attr(t, 'max') === '80'), 'PR Panel Abschnitte: Lese-Linie mit Schalter und Position, solange sie an ist');
  const ohneLinie = abschnitt(panel(stand({ prompter: state({ readingLine: false }) })), ABSCHNITT.leselinie);
  ok(!text(ohneLinie).includes('Position'), 'PR Panel Abschnitte: ohne Lese-Linie keine Positionsregelung (wie bisher)');
  const dar = abschnitt(html, ABSCHNITT.darstellung);
  ok(['Spiegeln ⇄', 'Spiegeln ⇅', 'Fett'].every((w) => text(dar).includes(w)) && schalter(dar).length === 3, 'PR Panel Abschnitte: Darstellung mit Spiegeln ⇄, Spiegeln ⇅ und Fett als Schalter');
  const handy = abschnitt(html, ABSCHNITT.handy);
  ok(text(handy).includes('http://10.0.0.5:8728/?t=abc') && handy.includes('data-prompter="handy-adressen"'), 'PR Panel Abschnitte: Handy-Fernbedienung zeigt die Adressen, wenn der Server läuft');
  const keine = abschnitt(panel(stand({ prompter: state({ remoteEnabled: true }, { running: true, urls: [] }) })), ABSCHNITT.handy);
  ok(text(keine).includes(T.handy.keineAdresse), 'PR Panel Abschnitte: ohne Adresse steht der Text aus PROMPTER_TEXTE.handy.keineAdresse (R-T5a)');
  const quelle = ohneKommentare(leseText('src/renderer/src/views/Einstellungen.tsx'));
  ok(!quelle.includes('Keine LAN-Adresse'), 'PR Panel Abschnitte: kein eigener Text „Keine LAN-Adresse gefunden“ im Panel (R-T5a)');
}

// ── Das Panel hat keine Abläufe ──
{
  const q = ohneKommentare(leseText('src/renderer/src/views/Einstellungen.tsx'));
  ok(!q.includes('useEffect') && !/\bwindow\b/.test(q) && !q.includes('usePrompter') && !q.includes('jmprompt'), 'PR Panel Abschnitte: Einstellungen.tsx ohne window, ohne useEffect und ohne Store (E15)');
  const ober = ohneKommentare(leseText('src/renderer/src/views/PrompterOberflaeche.tsx'));
  ok(ober.includes('liesBildschirme(window.jmprompt?.output?.displays') && ober.includes('panelOffen'), 'PR Panel Abschnitte: die Bildschirmliste wird in der View frisch geholt, auch beim Öffnen des Panels');
}

// ── Fix 1: Bildschirmwahl verschiebt nicht; „Auf diesen Bildschirm“ ist ein eigener Knopf; „ · primär“ im Etikett ──
{
  const aufrufe: string[] = [];
  const a = baueAktionen({
    outputDisplayId: 2,
    setConfig: async (p) => void aufrufe.push(`setConfig${JSON.stringify(p)}`),
    openOutput: async (id) => void aufrufe.push(`open${id}`),
    closeOutput: async () => void aufrufe.push('close'),
    setRemote: async (an) => void aufrufe.push(`remote${an}`),
  });
  a.bildschirmWaehlen(3);
  gleich(aufrufe, ['setConfig{"outputDisplayId":3}'], 'PR Panel Abschnitte: eine Bildschirmwahl ruft nur setConfig und öffnet oder verschiebt kein Fenster');
  aufrufe.length = 0;
  a.ausgabeVerschieben();
  a.ausgabeUmschalten(true);
  a.ausgabeUmschalten(false);
  gleich(aufrufe, ['open2', 'open2', 'close'], 'PR Panel Abschnitte: „Auf diesen Bildschirm“ und der Ausgabeschalter öffnen auf dem gewählten Bildschirm, aus schließt');
  const knopf = (z: AusgabeZustand | null | undefined): string[] => tags(panel(stand({ ausgabe: z })), 'button').filter((t) => attr(t, 'data-prompter') === 'verschieben').map(() => 'da');
  gleich(
    [knopf(undefined), knopf(null), knopf({ art: 'zu', displayId: null }), knopf({ art: 'abgestuerzt', displayId: 1 }), knopf({ art: 'offen', displayId: 1 }), knopf({ art: 'bildschirm-fehlt', displayId: 5 })],
    [[], [], [], [], ['da'], ['da']],
    'PR Panel Abschnitte: der Knopf „Auf diesen Bildschirm“ steht nur bei offenem oder fehlendem Bildschirm, nicht bei zu, abgestürzt oder unbekannt',
  );
  ok(text(panel(stand({ ausgabe: { art: 'offen', displayId: 1 } }))).includes('Auf diesen Bildschirm'), 'PR Panel Abschnitte: der Knopf trägt den alten Wortlaut „Auf diesen Bildschirm“');
  const log: string[] = [];
  const q = ohneKommentare(leseText('src/renderer/src/views/Einstellungen.tsx'));
  ok(q.includes('onClick={aktionen.ausgabeVerschieben}') && log.length === 0, 'PR Panel Abschnitte: der Knopf ruft die Aktion ausgabeVerschieben');
  gleich(
    [
      bildschirmEtikett({ label: 'Display 1', primary: true, width: 1920, height: 1080 }),
      bildschirmEtikett({ label: 'Talent', primary: false, width: 1280, height: 720 }),
    ],
    ['Display 1 · primär (1920×1080)', 'Talent (1280×720)'],
    'PR Panel Abschnitte: Etikett der Bildschirmauswahl wie bisher, primärer Bildschirm mit „ · primär“',
  );
}

// ── Gesamtprüfung I3: das Panel nennt den gemessenen Bildschirm des Talent-Monitors (Wahl ≠ Bewegung) ──
// Die Pille des gemeinsamen Abschnitts nennt den gewählten Bildschirm; liegt der Monitor gemessen woanders, sagt die Zeile unter
// dem Abschnitt, wo er wirklich steht – mit denselben Worten wie der Eintrag der Statusleiste („Titel: Text“, eine Wahrheit).
{
  const LISTE = [
    { id: 1, label: 'Regie · primär (1920×1080)', primary: true },
    { id: 2, label: 'Talent (1920×1080)', primary: false },
    { id: 3, label: 'Bühne (1280×720)', primary: false },
  ];
  const s = (z: AusgabeZustand | null | undefined, b: OberflaechenStand['bildschirme'] | 'ohne' = LISTE): OberflaechenStand =>
    stand({ prompter: state({ outputDisplayId: 3 }), ausgabe: z, ...(b === 'ohne' ? {} : { bildschirme: b }) });
  const lage = (st: OberflaechenStand): string | null => {
    const m = abschnitt(panel(st), ABSCHNITT.ausgabe).match(/<p[^>]*data-prompter="lage"[^>]*>([\s\S]*?)<\/p>/);
    return m ? text(m[1]) : null;
  };
  const statusTitel = (st: OberflaechenStand): string => {
    const i = statusLeiste(st).find((x) => x.id === 'talent-monitor');
    return `${i?.label}: ${i?.detail}`;
  };
  const gemessen2 = s({ art: 'offen', displayId: 2 });
  gleich(lage(gemessen2), 'Talent-Monitor: offen · Talent (1920×1080)', 'PR Panel gemessene Lage: gemessen auf Bildschirm 2, Bildschirm 3 gewählt → die Zeile nennt Bildschirm 2');
  ok(!(lage(gemessen2) ?? '').includes('Bühne'), 'PR Panel gemessene Lage: die Zeile nennt nie den nur gewählten Bildschirm');
  ok(lage(gemessen2) === statusTitel(gemessen2), 'PR Panel gemessene Lage: Zeile und Statuseintrag sagen dasselbe (eine Wahrheit)');
  gleich(
    [lage(s({ art: 'bildschirm-fehlt', displayId: 2 })), lage(s({ art: 'offen', displayId: 2 }, 'ohne'))],
    ['Talent-Monitor: Bildschirm fehlt', 'Talent-Monitor: offen'],
    'PR Panel gemessene Lage: Bildschirm abgezogen → „Bildschirm fehlt“ wie die Statusleiste; ohne Liste nur „offen“, kein geratener Name',
  );
  gleich(
    [lage(s(undefined)), lage(s(null)), lage(s({ art: 'zu', displayId: null })), lage(s({ art: 'abgestuerzt', displayId: 2 }))],
    [null, null, null, null],
    'PR Panel gemessene Lage: keine Zeile, solange kein Fenster gemessen da ist (unbekannt, keine Brücke, zu, abgestürzt)',
  );
}

// ── Gesamtprüfung I3/M2: die Bildschirmliste wie bei Stage und Player – beim Start, bei jedem Öffnen des Panels und bei jeder
// Änderung des Ausgabezustands frisch; ein Fehler setzt sie auf unbekannt zurück, nie die alte Liste ──
{
  const lies = (aktionenModul as Record<string, unknown>).liesBildschirme as
    | ((frage: (() => Promise<Array<{ id: number; label: string; primary: boolean; width: number; height: number }>>) | undefined, setze: (l: OberflaechenStand['bildschirme'] | undefined) => void) => () => void)
    | undefined;
  ok(typeof lies === 'function', 'PR Bildschirmliste: lib/aktionen.ts liest die Liste mit liesBildschirme');
  const werte: Array<OberflaechenStand['bildschirme'] | undefined> = [];
  if (typeof lies === 'function') {
    const setze = (l: OberflaechenStand['bildschirme'] | undefined): void => void werte.push(l);
    const liste = [
      { id: 1, label: 'Regie', primary: true, width: 1920, height: 1080 },
      { id: 2, label: 'Talent', primary: false, width: 1280, height: 720 },
    ];
    lies(async () => liste, setze);
    lies(async () => Promise.reject(new Error('weg')), setze);
    lies(undefined, setze);
    const ab = lies(async () => liste, setze);
    ab();
    await new Promise((r) => setTimeout(r, 0));
  }
  gleich(
    werte,
    [
      [
        { id: 1, label: 'Regie · primär (1920×1080)', primary: true },
        { id: 2, label: 'Talent (1280×720)', primary: false },
      ],
      undefined,
    ],
    'PR Bildschirmliste: die Antwort kommt mit dem Etikett „Name[ · primär] (B×H)“; ein Fehler ergibt unbekannt (undefined), nie die alte Liste; ohne Preload nichts; eine überholte Antwort wird verworfen',
  );
  const ober = ohneKommentare(leseText('src/renderer/src/views/PrompterOberflaeche.tsx'));
  ok(
    ober.includes('useEffect(() => liesBildschirme(window.jmprompt?.output?.displays, setBildschirme), [ausgabe]);') &&
      /useEffect\(\(\) => \{\s*if \(!panelOffen\) return undefined;\s*return liesBildschirme\(window\.jmprompt\?\.output\?\.displays, setBildschirme\);\s*\}, \[panelOffen\]\);/.test(ober),
    'PR Bildschirmliste: die View holt die Liste beim Start und bei jeder Änderung des Ausgabezustands ([ausgabe]) und bei jedem Öffnen des Panels',
  );
}
