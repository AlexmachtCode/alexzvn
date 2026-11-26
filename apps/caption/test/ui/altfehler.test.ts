// Altfehler Stufe 2, Caption A (Plan 2026-11-26, Task 4; Spec Abschnitt 5): CA-1 ein Mikrofonfehler beendet die Transkription
// (running=0 für Companion, kein Neustart von selbst), CA-4 „Leeren“ leert auch bei Hold die NDI-Quelle und Hold hält den leeren
// Stand, CA-5 die Korrektur trifft die angeklickte Zeile über ihre Kennung. Caption B (Task 5): CA-8 Zahlenfelder mit Grenzen (Feld
// wie im Recorder, der Main zieht Datei und IPC auf die Grenzen, C1), CA-11 Fenster zu beendet die Transkription und Companion
// „transcribe on“ ohne Fenster wird abgelehnt (C2, D8). Reine Module unter tsx ohne Electron und ohne window; der Hauptprozess
// (importiert electron), der Preload und die Wurzel-View nur als Quelltext-Wächter (R3).
// Die Module werden als Namensraum bzw. dynamisch geladen: Fehlt ein Export oder das Modul, ist jeder Fall einzeln rot.
import * as settings from '@jm/settings';
import { AUDIO_TEXTE } from '@jm/settings';
import { MASTER_LINK_TEXTE } from '@jm/ui';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import type { CaptionConfig, CaptionLine } from '@shared/types';
import * as aktionen from '@/lib/aktionen';
import * as engine from '@/lib/ndi-engine';
import { CAPTION_TEXTE, mikrofonAbschnitt } from '@/lib/oberflaeche';
import { zahlSchritt, type ZahlRegeln } from '../../../../packages/ui/src/lib/eingabe';
import { UI_TEXTE } from '../../../../packages/ui/src/lib/texte';
import { caption, GERAETE, ohneKommentare, store, ZEILEN } from './testzustand';

const QUELLE = (pfad: string): string => ohneKommentare(leseText(pfad));
const MIKRO_FEHLER = 'Requested device not found';

/** Ruft f; ein Wurf (fehlender Export, fehlendes Modul) kommt als Text zurück, damit jeder Fall für sich rot zeigt. */
function versuch<T>(f: () => T): T | string {
  try {
    return f();
  } catch (e) {
    return `Wurf: ${e instanceof Error ? e.message : String(e)}`;
  }
}

// ── CA-1: Mikrofonfehler stoppt die Transkription ──
{
  const log: string[] = [];
  versuch(() => aktionen.mikrofonGescheitert(store(log), (m) => log.push('micError:' + m), new Error(MIKRO_FEHLER)));
  gleich(
    log,
    [`micError:${MIKRO_FEHLER}`, 'stop'],
    'CA-1 Mikrofonfehler stoppt die Transkription: erst steht der Fehler im Fenster (micError), dann ruft es stop() (caption:stop, Companion sieht running=0)',
  );
  const log2: string[] = [];
  versuch(() => aktionen.mikrofonGescheitert(store(log2), (m) => log2.push('micError:' + m), 'kaputt'));
  gleich(log2, ['micError:kaputt', 'stop'], 'CA-1 Mikrofonfehler: ein Wurf ohne Error-Objekt erscheint als Text (String(e)), die Transkription endet ebenso');
}

// ── CA-1 (Fix-Runde 1, Ruling R8): ein Grund auch bei leerer Meldung des Browsers ──
// Gemessen (Task 4, out/t4-mikrofonfehler.png): Ist ein gemerkter Eingang weg, lehnt Chromium mit OverconstrainedError und leerer
// Meldung ab; dann stand nur „Mikrofon:“ im Fenster und der Abschnitt Audiogerät bekam error: ''.
{
  const fehler = (name: string, message: string): Error => Object.assign(new Error(message), { name });
  const grund = (e: unknown): unknown => versuch(() => aktionen.mikrofonGrund(e));
  gleich(
    grund(fehler('OverconstrainedError', '')),
    'Gerät nicht gefunden',
    'CA-1 Grund: OverconstrainedError mit leerer Meldung (ein gemerkter Eingang ist weg) ergibt „Gerät nicht gefunden“',
  );
  gleich(grund(fehler('NotFoundError', '')), 'Gerät nicht gefunden', 'CA-1 Grund: NotFoundError mit leerer Meldung ergibt „Gerät nicht gefunden“');
  gleich(grund(fehler('NotAllowedError', '')), 'nicht verfügbar', 'CA-1 Grund: jede andere leere Meldung (etwa NotAllowedError) ergibt „nicht verfügbar“');
  gleich(grund(fehler('NotFoundError', MIKRO_FEHLER)), MIKRO_FEHLER, 'CA-1 Grund: eine Meldung des Browsers bleibt, wie sie ist, auch bei NotFoundError');
  gleich(grund(fehler('OverconstrainedError', '   ')), 'Gerät nicht gefunden', 'CA-1 Grund: eine Meldung nur aus Leerzeichen gilt als leer');
  gleich(grund('kaputt'), 'kaputt', 'CA-1 Grund: ein Wurf ohne Error-Objekt erscheint als Text (String(e))');
  // Fenster und Panel zeigen denselben Grund (micError ist der Text unter den Tasten und der Fehler des Abschnitts Audiogerät, E9).
  const gesetzt: { micError: string | null } = { micError: null };
  const log: string[] = [];
  versuch(() => aktionen.mikrofonGescheitert(store(log), (m) => void (gesetzt.micError = m), fehler('OverconstrainedError', '')));
  const panel = mikrofonAbschnitt({ caption: caption({ running: false, config: { audioInputDeviceId: 'weg' } }), geraete: GERAETE, micError: gesetzt.micError, pegel: 0 }).error;
  gleich(
    { panel, fenster: gesetzt.micError === null ? null : CAPTION_TEXTE.live.mikrofonFehler(gesetzt.micError), log },
    { panel: 'Gerät nicht gefunden', fenster: 'Mikrofon: Gerät nicht gefunden', log: ['stop'] },
    'CA-1 Grund: bei OverconstrainedError ist der Fehler im Abschnitt Audiogerät nicht leer, das Fenster zeigt „Mikrofon: Gerät nicht gefunden“, die Transkription endet',
  );
  // Der Text kommt aus @jm/settings (nicht nachgebaut); „nicht verfügbar“ ist ein eigener, benannter Caption-Text, der keinem Text aus
  // @jm/settings oder @jm/ui gleicht (auch nicht UI_TEXTE, das @jm/ui nicht exportiert).
  const flach = (v: unknown): string[] =>
    typeof v === 'function' ? flach((v as (...a: unknown[]) => unknown)('x', 2, 3)) : typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(flach) : [];
  const fremd = new Set([...Object.entries(settings).filter(([k]) => k.endsWith('_TEXTE')).map(([, v]) => v), MASTER_LINK_TEXTE, UI_TEXTE].flatMap(flach));
  const akt = QUELLE('src/renderer/src/lib/aktionen.ts');
  ok(
    AUDIO_TEXTE.nichtGefunden === 'Gerät nicht gefunden' && akt.includes('AUDIO_TEXTE.nichtGefunden') && !akt.includes('Gerät nicht gefunden') &&
      (CAPTION_TEXTE.mikrofon as Record<string, unknown>).nichtVerfuegbar === 'nicht verfügbar' && !fremd.has('nicht verfügbar') && akt.includes('CAPTION_TEXTE.mikrofon.nichtVerfuegbar'),
    'CA-1 Grund: „Gerät nicht gefunden“ ist AUDIO_TEXTE.nichtGefunden aus @jm/settings (importiert), „nicht verfügbar“ steht als CAPTION_TEXTE.mikrofon.nichtVerfuegbar und gleicht keinem Text aus @jm/settings oder @jm/ui',
  );
}

// ── CA-4: „Leeren“ bei Hold leert das Bild, Hold hält den leeren Stand ──
{
  const text = (vorher: { text: string; leerung: number }, lines: CaptionLine[], hold: boolean, leerungen: number): unknown =>
    versuch(() => engine.angezeigterText(vorher, lines, hold, leerungen));
  const NEU: CaptionLine[] = [{ id: 'l4', text: 'Neu', at: 4 }];
  const geleert = text({ text: 'Bitte nehmen Sie Platz.', leerung: 0 }, [], true, 1);
  gleich(geleert, { text: '', leerung: 1 }, 'CA-4 Leeren bei Hold leert das Bild: mit Hold und einer neuen Leerung ist der Text leer (Vorschau und NDI-Quelle)');
  gleich(
    text({ text: '', leerung: 1 }, NEU, true, 1),
    { text: '', leerung: 1 },
    'CA-4 Hold bleibt an und hält den leeren Stand: eine Zeile, die nach dem Leeren kommt, erscheint bei Hold nicht',
  );
  gleich(text({ text: '', leerung: 1 }, NEU, false, 1), { text: 'Neu', leerung: 1 }, 'CA-4 ohne Hold folgt das Bild wieder der jüngsten Zeile');
  gleich(
    text({ text: 'Bitte nehmen Sie Platz.', leerung: 1 }, [...ZEILEN, ...NEU], true, 1),
    { text: 'Bitte nehmen Sie Platz.', leerung: 1 },
    'CA-4 gleiche Leerung bei Hold: der eingefrorene Text bleibt stehen (Hold wie bisher, E7)',
  );
  gleich(text({ text: 'alt', leerung: 0 }, ZEILEN, false, 0), { text: ZEILEN[2].text, leerung: 0 }, 'CA-4 ohne Hold: der Text der jüngsten Zeile wie bisher');
  gleich(text({ text: 'alt', leerung: 2 }, [], false, 3), { text: '', leerung: 3 }, 'CA-4 ohne Hold mit leerem Verlauf: leer, die Leerung ist übernommen (ein späteres Hold leert nicht noch einmal)');
}

// ── CA-5: korrigiereZeile trifft die Kennung ──
{
  type Zeilen = { korrigiereZeile?: (lines: CaptionLine[], id: string, text: string) => CaptionLine[] | null };
  let modul: Zeilen = {};
  let ladefehler = 'kein Export korrigiereZeile';
  try {
    modul = (await import('@shared/zeilen')) as Zeilen;
  } catch (e) {
    ladefehler = `shared/zeilen lädt nicht (${e instanceof Error ? e.message : String(e)})`;
  }
  const korrigiere = (lines: CaptionLine[], id: string, t: string): unknown =>
    versuch(() => {
      if (!modul.korrigiereZeile) throw new Error(ladefehler);
      return modul.korrigiereZeile(lines, id, t);
    });
  const vorher = JSON.stringify(ZEILEN);
  gleich(
    korrigiere(ZEILEN, 'l2', 'Neu'),
    [ZEILEN[0], { ...ZEILEN[1], text: 'Neu' }, ZEILEN[2]],
    'CA-5 korrigiereZeile trifft die Kennung: nur l2 trägt „Neu“, l1 und die inzwischen jüngste l3 bleiben',
  );
  gleich(korrigiere(ZEILEN, 'weg', 'x'), null, 'CA-5 korrigiereZeile: eine unbekannte Kennung (die Zeile ist weg, etwa nach „Leeren“) ergibt null, nichts ändert sich');
  gleich(korrigiere([], 'l1', 'x'), null, 'CA-5 korrigiereZeile: im leeren Verlauf ergibt jede Kennung null');
  gleich(
    korrigiere(ZEILEN, 'l3', ''),
    [ZEILEN[0], ZEILEN[1], { ...ZEILEN[2], text: '' }],
    'CA-5 korrigiereZeile: ein leerer Text macht die Zeile leer, sie bleibt im Verlauf (wie bisher)',
  );
  gleich(JSON.stringify(ZEILEN), vorher, 'CA-5 korrigiereZeile ändert die übergebene Liste nicht');
}

// ── CA-8: pruefeKonfig zieht Datei und IPC auf die Grenzen (C1), das Feld nimmt dieselben Grenzen ──
type Grenze = { readonly min: number; readonly max: number };
type Konfig = {
  CAPTION_GRENZEN?: { readonly ndiFontSize: Grenze; readonly maxUtteranceSec: Grenze };
  pruefeKonfig?: (patch: Partial<CaptionConfig>) => Partial<CaptionConfig>;
};
let konfig: Konfig = {};
let konfigFehler = 'kein Export pruefeKonfig';
try {
  konfig = (await import('@shared/konfig')) as Konfig;
} catch (e) {
  konfigFehler = `shared/konfig lädt nicht (${e instanceof Error ? e.message : String(e)})`;
}
{
  const pruefe = (patch: Record<string, unknown>): unknown =>
    versuch(() => {
      if (!konfig.pruefeKonfig) throw new Error(konfigFehler);
      return konfig.pruefeKonfig(patch as Partial<CaptionConfig>);
    });
  gleich(
    konfig.CAPTION_GRENZEN ?? konfigFehler,
    { ndiFontSize: { min: 16, max: 160 }, maxUtteranceSec: { min: 2, max: 15 } },
    'CA-8 CAPTION_GRENZEN: Schrift 16 bis 160, Max. Äußerung 2 bis 15 (wie die alten min/max der Felder)',
  );
  gleich(pruefe({ ndiFontSize: 0 }), { ndiFontSize: 16 }, 'CA-8 pruefeKonfig: eine Schrift von 0 wird 16 (keine Schrift unter dem Mindestwert, C1)');
  gleich(pruefe({ ndiFontSize: 400 }), { ndiFontSize: 160 }, 'CA-8 pruefeKonfig: eine Schrift von 400 wird 160');
  gleich(pruefe({ maxUtteranceSec: NaN }), {}, 'CA-8 pruefeKonfig: eine nicht endliche Zahl fällt weg (der alte Wert bleibt)');
  gleich(pruefe({ maxUtteranceSec: 7.5 }), { maxUtteranceSec: 7.5 }, 'CA-8 pruefeKonfig: 7,5 s liegt im Bereich und bleibt (keine Rundung)');
  gleich(pruefe({ ndiName: 'X' }), { ndiName: 'X' }, 'CA-8 pruefeKonfig: andere Schlüssel bleiben unverändert');
  gleich(
    pruefe({ ndiFontSize: 10, ndiName: 'X', maxUtteranceSec: 20 }),
    { ndiFontSize: 16, ndiName: 'X', maxUtteranceSec: 15 },
    'CA-8 pruefeKonfig: beide Grenzen in einem Teil, der Rest bleibt',
  );
  gleich(
    [pruefe({ ndiFontSize: 16 }), pruefe({ ndiFontSize: 160 }), pruefe({ maxUtteranceSec: 2 }), pruefe({ maxUtteranceSec: 15 })],
    [{ ndiFontSize: 16 }, { ndiFontSize: 160 }, { maxUtteranceSec: 2 }, { maxUtteranceSec: 15 }],
    'CA-8 pruefeKonfig: die Grenzen selbst gelten',
  );
  gleich(
    [pruefe({ ndiFontSize: Infinity }), pruefe({ ndiFontSize: '54' }), pruefe({ maxUtteranceSec: null })],
    [{}, {}, {}],
    'CA-8 pruefeKonfig: Unendlich, Text und null aus der Datei fallen weg (die Vorgabe bzw. der alte Wert bleibt)',
  );
  const teil = { ndiFontSize: 0 };
  versuch(() => konfig.pruefeKonfig?.(teil));
  gleich(teil, { ndiFontSize: 0 }, 'CA-8 pruefeKonfig ändert den übergebenen Teil nicht');
}
// Feldlogik mit den Caption-Grenzen (zahlSchritt aus @jm/ui, Wächter K8): ein ungültiger Wert zeigt einen Fehlertext und wirkt nicht.
{
  const g = konfig.CAPTION_GRENZEN;
  const schrift: ZahlRegeln = { ...g?.ndiFontSize, ganzzahl: true };
  const maxAeusserung: ZahlRegeln = { ...g?.maxUtteranceSec };
  const uebernimm = (text: string, regeln: ZahlRegeln, aktuell: number): { fehler: string | null; neuerWert: number | null } => {
    const r = zahlSchritt({ text, geaendert: true }, { art: 'uebernehmen' }, regeln, aktuell);
    return { fehler: r.z.fehler ?? null, neuerWert: r.neuerWert ?? null };
  };
  gleich(uebernimm('0', schrift, 54), { fehler: 'Mindestens 16.', neuerWert: null }, 'CA-8 Feldlogik: „0“ bei Schrift zeigt „Mindestens 16.“ und übernimmt nichts');
  gleich(uebernimm('', schrift, 54), { fehler: 'Bitte eine Zahl eingeben.', neuerWert: null }, 'CA-8 Feldlogik: ein leeres Feld zeigt „Bitte eine Zahl eingeben.“ und übernimmt nichts (früher wurde es 0)');
  gleich(uebernimm('54,5', schrift, 54), { fehler: 'Bitte eine ganze Zahl eingeben.', neuerWert: null }, 'CA-8 Feldlogik: „54,5“ bei Schrift (ganzzahl) zeigt „Bitte eine ganze Zahl eingeben.“');
  gleich(uebernimm('161', schrift, 54), { fehler: 'Höchstens 160.', neuerWert: null }, 'CA-8 Feldlogik: „161“ bei Schrift zeigt „Höchstens 160.“');
  gleich(uebernimm('7,5', maxAeusserung, 8), { fehler: null, neuerWert: 7.5 }, 'CA-8 Feldlogik: „7,5“ bei Max. Äußerung übernimmt 7.5 (Komma als Dezimaltrenner, ohne ganzzahl)');
  gleich(uebernimm('1', maxAeusserung, 8), { fehler: 'Mindestens 2.', neuerWert: null }, 'CA-8 Feldlogik: „1“ bei Max. Äußerung zeigt „Mindestens 2.“');
  gleich(uebernimm('96', schrift, 54), { fehler: null, neuerWert: 96 }, 'CA-8 Feldlogik: „96“ bei Schrift übernimmt 96');
}

// ── CA-11: transcribeAblehnung (C2, D8) — nur ein Einschalten ohne Fenster wird abgelehnt ──
{
  type Fernbefehl = {
    transcribeAblehnung?: (arg: string | undefined, ziel: boolean, fensterOffen: boolean) => { hinweis: string; log: string } | null;
    CA11_TEXTE?: Record<string, (verb: string) => string>;
  };
  let modul: Fernbefehl = {};
  let ladefehler = 'kein Export transcribeAblehnung';
  try {
    modul = (await import('@shared/fernbefehl')) as Fernbefehl;
  } catch (e) {
    ladefehler = `shared/fernbefehl lädt nicht (${e instanceof Error ? e.message : String(e)})`;
  }
  const ablehnung = (arg: string | undefined, ziel: boolean, fensterOffen: boolean): unknown =>
    versuch(() => {
      if (!modul.transcribeAblehnung) throw new Error(ladefehler);
      return modul.transcribeAblehnung(arg, ziel, fensterOffen);
    });
  gleich(
    ablehnung('on', true, false),
    {
      hinweis: 'Companion „TRANSCRIBE ON“ abgelehnt: Das Caption-Fenster ist geschlossen. Ein Klick aufs Dock öffnet es.',
      log: 'Fernbefehl abgelehnt: TRANSCRIBE ON (kein Fenster offen)',
    },
    'CA-11 transcribeAblehnung: „transcribe on“ ohne Fenster wird abgelehnt, mit Grund fürs Fenster (state.error) und Logzeile',
  );
  gleich(ablehnung('on', true, true), null, 'CA-11 transcribeAblehnung: mit offenem Fenster gilt „transcribe on“ wie bisher (null)');
  gleich(ablehnung('off', false, false), null, 'CA-11 transcribeAblehnung: „transcribe off“ ohne Fenster wird nicht abgelehnt (nur ein Einschalten, D8)');
  gleich(ablehnung('toggle', false, false), null, 'CA-11 transcribeAblehnung: ein toggle, das ausschalten würde, wird ohne Fenster nicht abgelehnt');
  const ohneArg = ablehnung(undefined, true, false) as { hinweis?: string; log?: string } | null;
  ok(
    typeof ohneArg === 'object' && ohneArg !== null && (ohneArg.hinweis ?? '').includes('„TRANSCRIBE TOGGLE“') && (ohneArg.log ?? '').includes('TRANSCRIBE TOGGLE'),
    `CA-11 transcribeAblehnung: ohne Argument nennt der Text TRANSCRIBE TOGGLE (${JSON.stringify(ohneArg)})`,
  );
  // K4: die Texte stehen einmal in der benannten Konstante CA11_TEXTE; sie gleichen keinem Text aus @jm/settings oder @jm/ui.
  const T = modul.CA11_TEXTE;
  const flach = (v: unknown): string[] =>
    typeof v === 'function' ? flach((v as (...a: unknown[]) => unknown)('x', 2, 3)) : typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(flach) : [];
  const fremd = new Set([...Object.entries(settings).filter(([k]) => k.endsWith('_TEXTE')).map(([, v]) => v), MASTER_LINK_TEXTE, UI_TEXTE].flatMap(flach));
  const eigene = T ? flach(T) : [];
  ok(
    T !== undefined && T.hinweis?.('TRANSCRIBE ON') === 'Companion „TRANSCRIBE ON“ abgelehnt: Das Caption-Fenster ist geschlossen. Ein Klick aufs Dock öffnet es.' &&
      T.log?.('TRANSCRIBE ON') === 'Fernbefehl abgelehnt: TRANSCRIBE ON (kein Fenster offen)' && eigene.length === 2 && eigene.every((t) => !t.includes('"') && !fremd.has(t)) &&
      !QUELLE('src/main/index.ts').includes('abgelehnt'),
    'CA-11 Texte: Grund und Logzeile stehen in CA11_TEXTE (shared/fernbefehl.ts, K4), ohne ASCII-Anführungszeichen, gleichen keinem Text aus @jm/settings oder @jm/ui und stehen nicht im Main',
  );
}

// ── Wächter am Quelltext (R3): Wurzel-View, Hauptprozess, Preload, Typen ──
{
  const wurzel = QUELLE('src/renderer/src/views/CaptionOberflaeche.tsx');
  const haupt = QUELLE('src/main/index.ts');
  const preload = QUELLE('src/preload/index.ts');
  const typen = QUELLE('src/shared/types.ts');
  const motor = QUELLE('src/renderer/src/lib/ndi-engine.ts');
  const akt = QUELLE('src/renderer/src/lib/aktionen.ts');

  // CA-1: der .catch des Aufnahme-Effekts meldet über mikrofonGescheitert, auch für einen abgebrochenen Versuch (kein cancelled davor).
  ok(
    /\n\s*\.catch\(\(e: unknown\) => mikrofonGescheitert\(\{ stop \}, setMicError, e\)\);\n/.test(wurzel) && !wurzel.includes('.catch((e: unknown) => setMicError(') &&
      /const \{ state, level, load, setLevel, setConfig, start, stop,/.test(wurzel),
    'CA-1 Wächter: der .catch des Aufnahme-Effekts ruft mikrofonGescheitert({ stop }, setMicError, e), stop aus useCaption()',
  );
  ok(
    /export function mikrofonGescheitert\(store: Pick<CaptionStore, 'stop'>, setzeFehler: \(m: string\) => void, e: unknown\): void \{\s*setzeFehler\(mikrofonGrund\(e\)\);\s*void store\.stop\(\);\s*\}/.test(akt) &&
      !/\bwindow\./.test(akt),
    'CA-1 Wächter: mikrofonGescheitert setzt den Grund (mikrofonGrund, Ruling R8) und ruft store.stop(), ohne window und ohne eigenen Kanal (der Stopp ist caption:stop)',
  );
  // CA-4: der Main zählt die Leerungen, der Zustand trägt sie, die Engine wählt den Text über angezeigterText.
  ok(
    /\nlet leerungen = 0;\n/.test(haupt) && /function doClear\(\): void \{\s*lines = \[\];\s*leerungen\+\+;\s*broadcast\(\);\s*\}/.test(haupt) && /case 'clear':\s*doClear\(\);/.test(haupt) &&
      /ipcMain\.handle\('caption:clear', \(\) => \{\s*doClear\(\);/.test(haupt),
    'CA-4 Wächter: doClear erhöht leerungen (für die Taste „Leeren“ und für Companion clear derselbe Weg)',
  );
  ok(/function buildState\(\): CaptionState \{\s*return \{[^}]*\bleerungen\b[^}]*\};\s*\}/.test(haupt) && /\n {2}leerungen: number;\n/.test(typen), 'CA-4 Wächter: buildState gibt leerungen mit, CaptionState hat das Feld');
  {
    const frame = motor.slice(motor.indexOf('const frame = (): void => {'), motor.indexOf('// Vorschau (skaliert)'));
    ok(
      /shownRef\.current = angezeigterText\(shownRef\.current, linesRef\.current, holdRef\.current, leerungenRef\.current\);/.test(frame) && frame.includes('drawCaption(ctx, W, H, c, shownRef.current.text);') && !/holdRef\.current\)\s*\{/.test(frame),
      'CA-4 Wächter: frame() ruft angezeigterText(…) und zeichnet dessen Text; keine eigene Hold-Abfrage mehr im Takt',
    );
  }
  ok(
    wurzel.includes('useCaptionNdiEngine(cfg ?? FALLBACK_CFG, state?.lines ?? [], hold, state?.leerungen ?? 0, ndiActive, previewRef);'),
    'CA-4 Wächter: die Wurzel-View reicht state?.leerungen ?? 0 an die Engine',
  );
  // CA-5: caption:correctLine ersetzt caption:correctLast; der Main überträgt nur bei einem Treffer.
  ok(
    /ipcMain\.handle\('caption:correctLine', \(_e, id: string, text: string\) => \{\s*const neu = korrigiereZeile\(lines, id, text\);\s*if \(neu\) \{\s*lines = neu;\s*broadcast\(\);\s*\}\s*return buildState\(\);\s*\}\);/.test(haupt) &&
      haupt.includes("import { korrigiereZeile } from '@shared/zeilen';") && !haupt.includes('caption:correctLast'),
    'CA-5 Wächter: src/main/index.ts hat caption:correctLine mit korrigiereZeile, überträgt nur bei einem Treffer und kein caption:correctLast',
  );
  ok(
    preload.includes("correctLine: (id: string, text: string) => ipcRenderer.invoke('caption:correctLine', id, text) as Promise<CaptionState>,") && !preload.includes('correctLast') &&
      typen.includes('correctLine: (id: string, text: string) => Promise<CaptionState>;') && !typen.includes('correctLast'),
    'CA-5 Wächter: der Preload bietet correctLine(id, text) über caption:correctLine, JmCaptionApi ebenso, correctLast gibt es nicht mehr',
  );
  // Neu ist nur caption:correctLine (Global Constraints); CA-1 braucht keinen Kanal.
  gleich(
    [...haupt.matchAll(/ipcMain\.(?:handle|on)\('([^']+)'/g)].map((m) => m[1]),
    ['caption:getState', 'caption:fernsteuerung', 'caption:setConfig', 'caption:start', 'caption:stop', 'caption:setHold', 'caption:clear', 'caption:correctLine', 'caption:utterance', 'caption:ndi-start', 'caption:ndi-stop', 'caption:ndi-status'],
    'CA-5 Wächter: die IPC-Kanäle des Main sind die alten, nur caption:correctLine ersetzt caption:correctLast (CA-1 ohne neuen Kanal)',
  );
  // Companion liest weiter running (CA-1 wirkt über caption:stop → setRunning(false) → broadcast).
  ok(
    /function buildSuiteState\(\): SuiteState \{\s*return \{\s*ns: 'caption',\s*kv: \{\s*running,/.test(haupt) && /function setRunning\(v: boolean\): void \{\s*if \(running === v\) return;\s*running = v;\s*if \(v\) error = null;\s*else stopTranscriber\(\);\s*broadcast\(\);\s*\}/.test(haupt) &&
      /ipcMain\.handle\('caption:stop', \(\) => \{\s*setRunning\(false\);/.test(haupt),
    'CA-1 Wächter: buildSuiteState liest weiter running, caption:stop setzt running über setRunning(false) zurück und überträgt (Companion running=0)',
  );
}

// ── Wächter am Quelltext, Task 5 (R3): CA-8 im Main und im Panel, CA-11 im Main ──
{
  const haupt = QUELLE('src/main/index.ts');
  const panel = QUELLE('src/renderer/src/views/Einstellungen.tsx');
  // CA-8 (C1): IPC und Datei laufen über pruefeKonfig.
  ok(
    /ipcMain\.handle\('caption:setConfig', \(_e, patch: Partial<CaptionConfig>\) => \{\s*config = \{ \.\.\.config, \.\.\.pruefeKonfig\(patch\) \};\s*saveConfig\(\);\s*broadcast\(\);\s*return buildState\(\);\s*\}\);/.test(haupt) &&
      haupt.includes("import { pruefeKonfig } from '@shared/konfig';"),
    'CA-8 Wächter: caption:setConfig legt nur pruefeKonfig(patch) über die Konfiguration (Grenzen, nicht endliche Zahlen fallen weg), dann wie bisher speichern und übertragen',
  );
  ok(
    /function loadConfig\(\): void \{\s*try \{\s*const raw = JSON\.parse\(readFileSync\(configPath\(\), 'utf8'\)\) as Partial<CaptionConfig>;\s*config = \{ \.\.\.defaultConfig, \.\.\.pruefeKonfig\(raw\) \};\s*\} catch \{\s*config = \{ \.\.\.defaultConfig \};\s*\}\s*\}/.test(haupt),
    'CA-8 Wächter: loadConfig legt die Datei über pruefeKonfig auf die Vorgaben (eine Schrift unter 16 aus caption.config.json gibt es nicht)',
  );
  ok(
    panel.includes("import { CAPTION_GRENZEN } from '@shared/konfig';") && (panel.match(/<NumberInput\b/g) ?? []).length === 2 && !/type="number"/.test(panel) &&
      panel.includes('min={CAPTION_GRENZEN.ndiFontSize.min}') && panel.includes('max={CAPTION_GRENZEN.ndiFontSize.max}') &&
      panel.includes('min={CAPTION_GRENZEN.maxUtteranceSec.min}') && panel.includes('max={CAPTION_GRENZEN.maxUtteranceSec.max}') &&
      !/Mindestens|Höchstens|Bitte eine|Noch nicht übernommen/.test(panel + QUELLE('src/renderer/src/lib/oberflaeche.ts')),
    'CA-8 Wächter: das Panel nimmt die Grenzen aus CAPTION_GRENZEN (dieselben wie der Main), zwei NumberInput, kein natives Zahlenfeld; die Fehlertexte kommen aus @jm/ui (UI_TEXTE), nicht aus Caption',
  );
  // CA-11 (C2): Fenster zu beendet die Transkription und Hold, plattformunabhängig; die bestehenden Zeilen bleiben am Anfang.
  const geschlossen = haupt.slice(haupt.indexOf("win.on('closed', () => {"), haupt.indexOf('const url = rendererUrl();'));
  ok(
    /^win\.on\('closed', \(\) => \{\s*stopSender\(\);\s*ndiLage\.stoppe\(\);\s*status\.ndiActive = false;\s*status\.connections = 0;\s*syncNdi\(\);\s*mainWindow = null;\s*setRunning\(false\);\s*setHoldState\(false\);\s*\}\);\s*$/.test(geschlossen),
    'CA-11 Wächter: win.on(closed) behält seine Zeilen und setzt danach setRunning(false) und setHoldState(false) (Companion running=0, hold=0)',
  );
  // G10: Caption hatte keinen activate-Hörer; er ist neu, im Zweig mit der Einzelinstanz, nach dem ersten Fenster.
  const aktiv = haupt.indexOf("app.on('activate'");
  ok(
    /app\.on\('activate', \(\) => \{\s*if \(!mainWindow\) createMainWindow\(\);\s*\}\);/.test(haupt) && (haupt.match(/app\.on\('activate'/g) ?? []).length === 1 &&
      haupt.indexOf('app.whenReady().then(() => {') > 0 && aktiv > haupt.indexOf('registerIpc();\n    createMainWindow();\n') && haupt.indexOf('registerIpc();\n    createMainWindow();\n') > 0 &&
      aktiv < haupt.indexOf("app.on('before-quit'"),
    'CA-11 Wächter: app.on(activate) öffnet ein neues Fenster nur ohne mainWindow (Klick aufs Dock), registriert nach dem ersten Fenster',
  );
  // C2, D8: Companion „transcribe on“ ohne Fenster wird abgelehnt; der Grund steht in state.error, die Logzeile im Protokoll.
  const transcribe = haupt.slice(haupt.indexOf("case 'transcribe':"), haupt.indexOf("case 'hold':"));
  const abgelehnt = /if \(a\) \{([^}]*)\}/.exec(transcribe)?.[1] ?? '';
  ok(
    /case 'transcribe': \{\s*const ziel = resolveMode\(arg, running\);\s*const a = transcribeAblehnung\(arg, ziel, mainWindow !== null\);/.test(transcribe) &&
      /^\s*error = a\.hinweis;\s*getLog\(\)\.warn\(a\.log\);\s*broadcast\(\);\s*$/.test(abgelehnt) && !abgelehnt.includes('setRunning(') &&
      /\} else setRunning\(ziel\);\s*break;\s*\}/.test(transcribe) && haupt.includes("import { transcribeAblehnung } from '@shared/fernbefehl';"),
    'CA-11 Wächter: case transcribe ruft transcribeAblehnung(arg, ziel, mainWindow !== null); bei Ablehnung error = Grund, getLog().warn(Logzeile), broadcast() und kein setRunning; sonst setRunning(ziel) wie bisher',
  );
  ok(
    /case 'hold':\s*setHoldState\(resolveMode\(arg, hold\)\);\s*break;\s*case 'ndi':\s*if \(resolveMode\(arg, status\.ndiActive\)\) startNdi\(config\.ndiName\);\s*else stopNdi\(\);\s*break;\s*case 'clear':\s*doClear\(\);\s*break;/.test(haupt),
    'CA-11 Wächter: hold, ndi und clear bleiben wörtlich (abgelehnt wird nur transcribe, wenn es einschalten würde, D8)',
  );
}
