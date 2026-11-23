// UX Welle 2a, Prompter d · Einstellungs-Panel (Spec 3.6, 6; E3, E11, E15): Ausgabe auf Bildschirm und Fernsteuerung aus
// @jm/settings, dahinter die tool-eigenen Abschnitte Schrift, Lese-Linie, Darstellung und Handy-Fernbedienung. Jeder
// Statuseintrag mit Abschnitt findet seinen Anker. Das alte Pult zeigt diese Abschnitte nicht mehr. Render ohne Browser.
import { SCREEN_TEXTE } from '@jm/settings';
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

// ── PR Ort aus der Messung (2a-Nachzug, UX Welle 2b; löst die Zeile data-prompter="lage" aus Gesamtprüfung I3 ab): der Abschnitt
// „Ausgabe auf Bildschirm“ selbst nennt den gemessenen Bildschirm – die Pille und die Zeile „Steht auf“ aus @jm/settings –, nie den
// nur gewählten (Wahl ≠ Bewegung). Ohne gemessenen Ort (Bildschirm fehlt) keine Zeile „Steht auf“ ──
{
  const LISTE = [
    { id: 1, label: 'Regie · primär (1920×1080)', primary: true },
    { id: 2, label: 'Talent (1920×1080)', primary: false },
    { id: 3, label: 'Bühne (1280×720)', primary: false },
  ];
  const s = (z: AusgabeZustand | null | undefined, b: OberflaechenStand['bildschirme'] | 'ohne' = LISTE): OberflaechenStand =>
    stand({ prompter: state({ outputDisplayId: 3 }), ausgabe: z, ...(b === 'ohne' ? {} : { bildschirme: b }) });
  const aus = (st: OberflaechenStand): string => abschnitt(panel(st), ABSCHNITT.ausgabe);
  /** Wert der Zeile „Steht auf“ im Ausgabe-Abschnitt, sonst null. */
  const stehtAuf = (st: OberflaechenStand): string | null => {
    const t = text(aus(st));
    const i = t.indexOf(SCREEN_TEXTE.stehtAuf);
    return i < 0 ? null : t.slice(i + SCREEN_TEXTE.stehtAuf.length).trim();
  };
  const gemessen2 = s({ art: 'offen', displayId: 2 });
  ok((stehtAuf(gemessen2) ?? '').startsWith('Talent (1920×1080)'), 'PR Ort aus der Messung: gemessen auf Bildschirm 2, Bildschirm 3 gewählt → „Steht auf“ nennt Bildschirm 2');
  ok(!(stehtAuf(gemessen2) ?? '').includes('Bühne') && text(aus(gemessen2)).includes('auf Bildschirm 2'), 'PR Ort aus der Messung: die Pille sagt „auf Bildschirm 2“, keine Zeile nennt den nur gewählten Bildschirm als Ort');
  gleich(
    [stehtAuf(s({ art: 'bildschirm-fehlt', displayId: 2 })), stehtAuf(s({ art: 'offen', displayId: 2 }, 'ohne')), stehtAuf(s({ art: 'offen', displayId: 9 }))],
    [null, null, null],
    'PR Ort aus der Messung: Bildschirm fehlt, Liste unbekannt oder gemessener Bildschirm nicht in der Liste → keine Zeile „Steht auf“, kein geratener Name',
  );
  ok(text(aus(s({ art: 'bildschirm-fehlt', displayId: 2 }))).includes('Bildschirm fehlt'), 'PR Ort aus der Messung: bei abgezogenem Bildschirm sagt die Pille „Bildschirm fehlt“');
  gleich(
    [stehtAuf(s(undefined)), stehtAuf(s(null)), stehtAuf(s({ art: 'zu', displayId: null })), stehtAuf(s({ art: 'abgestuerzt', displayId: 2 }))],
    [null, null, null, null],
    'PR Ort aus der Messung: keine Zeile „Steht auf“, solange kein Fenster gemessen offen ist (unbekannt, keine Brücke, zu, abgestürzt)',
  );
  const alle = [undefined, null, { art: 'zu', displayId: null }, { art: 'offen', displayId: 2 }, { art: 'bildschirm-fehlt', displayId: 2 }, { art: 'abgestuerzt', displayId: 2 }] as Array<AusgabeZustand | null | undefined>;
  ok(alle.every((z) => !panel(s(z)).includes('data-prompter="lage"')), 'PR Ort aus der Messung: keine Zeile data-prompter="lage" mehr');
  const q = ohneKommentare(leseText('src/renderer/src/views/Einstellungen.tsx'));
  ok(!q.includes('gemesseneLage') && !q.includes('data-prompter="lage"'), 'PR Ort aus der Messung: Einstellungen.tsx nutzt gemesseneLage nicht mehr');
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

// ── PR Bildschirmliste folgt dem Ereignis (UX Welle 2b, Task 4; Review Focus 5): folgeBildschirmen meldet sich am Bildschirm-Ereignis
// an und liest bei jedem Ereignis die Liste neu (liesBildschirme); ohne Brücke nichts; die Abmeldung wirkt, auch auf eine Antwort,
// die danach noch eintrifft; eine ältere Antwort überschreibt keine neuere ──
{
  type Liste = Array<{ id: number; label: string; primary: boolean; width: number; height: number }>;
  type Folge = (onBildschirme: ((cb: () => void) => () => void) | undefined, frage: (() => Promise<Liste>) | undefined, setze: (l: OberflaechenStand['bildschirme'] | undefined) => void) => () => void;
  const folge = (aktionenModul as Record<string, unknown>).folgeBildschirmen as Folge | undefined;
  ok(typeof folge === 'function', 'PR Bildschirmliste folgt dem Ereignis: lib/aktionen.ts hat folgeBildschirmen');
  const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
  const A: Liste = [{ id: 1, label: 'Regie', primary: true, width: 1920, height: 1080 }];
  const B: Liste = [...A, { id: 2, label: 'Talent', primary: false, width: 1280, height: 720 }];
  /** Attrappe der Brücke: merkt den Hörer, zählt An- und Abmeldungen. */
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
    // Ablauf: Anmelden (liest nichts), Ereignis → Liste A, Ereignis → Liste B, Ereignis mit Fehler → unbekannt, Abmelden, Ereignis → nichts.
    const br = bruecke();
    let fragen = 0;
    let antwort: () => Promise<Liste> = async () => A;
    const werte: Array<OberflaechenStand['bildschirme'] | undefined> = [];
    const ab = folge(br.on, () => (fragen++, antwort()), (l) => void werte.push(l));
    await tick();
    ergebnis.push(['angemeldet', br.an, fragen, werte.length]);
    br.feuere();
    await tick();
    antwort = async () => B;
    br.feuere();
    await tick();
    antwort = async () => Promise.reject(new Error('weg'));
    br.feuere();
    await tick();
    ergebnis.push(['drei Ereignisse', fragen, werte.map((l) => (l === undefined ? 'unbekannt' : l.map((x) => x.label).join('+')))]);
    ab();
    antwort = async () => A;
    br.feuere();
    await tick();
    ergebnis.push(['abgemeldet', br.ab, fragen, werte.length]);

    // Eine Antwort, die erst nach der Abmeldung eintrifft, setzt nichts mehr.
    const br2 = bruecke();
    let loese: (l: Liste) => void = () => undefined;
    const spaet: unknown[] = [];
    const ab2 = folge(br2.on, () => new Promise<Liste>((r) => (loese = r)), (l) => void spaet.push(l));
    br2.feuere();
    ab2();
    loese(B);
    await tick();
    ergebnis.push(['spät nach Abmeldung', spaet.length]);

    // Zwei Ereignisse kurz nacheinander: die Antwort des älteren kommt zuletzt und wird verworfen.
    const br3 = bruecke();
    const loeser: Array<(l: Liste) => void> = [];
    const reihe: string[] = [];
    folge(br3.on, () => new Promise<Liste>((r) => void loeser.push(r)), (l) => void reihe.push(l === undefined ? 'unbekannt' : l.map((x) => x.label).join('+')));
    br3.feuere();
    br3.feuere();
    loeser[1]?.(B);
    await tick();
    loeser[0]?.(A);
    await tick();
    ergebnis.push(['älter nach neuer', reihe]);

    // Ohne Brücke nichts: kein Ereignis-Zugang oder keine Abfrage → keine Anmeldung, keine Frage, nichts gesetzt.
    const br4 = bruecke();
    const ohne: unknown[] = [];
    let fragen4 = 0;
    const ab4 = folge(undefined, async () => (fragen4++, A), (l) => void ohne.push(l));
    const ab5 = folge(br4.on, undefined, (l) => void ohne.push(l));
    br4.feuere();
    await tick();
    ab4();
    ab5();
    ergebnis.push(['ohne Brücke', br4.an, fragen4, ohne.length, typeof ab4, typeof ab5]);
  }
  gleich(
    ergebnis,
    [
      ['angemeldet', 1, 0, 0],
      ['drei Ereignisse', 3, ['Regie · primär (1920×1080)', 'Regie · primär (1920×1080)+Talent (1280×720)', 'unbekannt']],
      ['abgemeldet', 1, 3, 3],
      ['spät nach Abmeldung', 0],
      ['älter nach neuer', ['Regie · primär (1920×1080)+Talent (1280×720)']],
      ['ohne Brücke', 0, 0, 0, 'function', 'function'],
    ],
    'PR Bildschirmliste folgt dem Ereignis: jedes Ereignis fragt und setzt die Liste (Fehler → unbekannt), ohne Brücke nichts, die Abmeldung wirkt auch auf späte Antworten, eine ältere Antwort überschreibt keine neuere',
  );
  const wurzel = ohneKommentare(leseText('src/renderer/src/views/PrompterOberflaeche.tsx'));
  ok(
    /useEffect\(\(\) => folgeBildschirmen\(window\.jmprompt\?\.output\?\.onBildschirme, window\.jmprompt\?\.output\?\.displays, setBildschirme\), \[\]\);/.test(wurzel),
    'PR Bildschirmliste folgt dem Ereignis: die Wurzel-View ruft folgeBildschirmen in einem Effekt (einmal, mit Abmeldung beim Abbau)',
  );
}
