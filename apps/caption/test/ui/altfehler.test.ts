// Altfehler Stufe 2, Caption A (Plan 2026-11-26, Task 4; Spec Abschnitt 5): CA-1 ein Mikrofonfehler beendet die Transkription
// (running=0 für Companion, kein Neustart von selbst), CA-4 „Leeren“ leert auch bei Hold die NDI-Quelle und Hold hält den leeren
// Stand, CA-5 die Korrektur trifft die angeklickte Zeile über ihre Kennung. Reine Module unter tsx ohne Electron und ohne window;
// der Hauptprozess (importiert electron), der Preload und die Wurzel-View nur als Quelltext-Wächter (R3).
// Die Module werden als Namensraum bzw. dynamisch geladen: Fehlt ein Export oder das Modul, ist jeder Fall einzeln rot.
import * as settings from '@jm/settings';
import { AUDIO_TEXTE } from '@jm/settings';
import { MASTER_LINK_TEXTE } from '@jm/ui';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import type { CaptionLine } from '@shared/types';
import * as aktionen from '@/lib/aktionen';
import * as engine from '@/lib/ndi-engine';
import { CAPTION_TEXTE, mikrofonAbschnitt } from '@/lib/oberflaeche';
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
