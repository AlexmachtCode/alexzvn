// Altfehler RE-PLATZ (Plan 2026-11-26, Task 7; B5, Pre-flight G15; Owner 26.11. 12:13, Variante A): die Statusleiste zeigt den freien
// Platz im Zielordner als Restzeit für das aktuelle Format („Platz für 2 h 10 min“), gelb unter 15 min, rot unter 5 min, nie gesperrt;
// lässt sich der Platz nicht lesen, steht „Platz unbekannt“ da. Der Recorder schreibt immer 32-bit Float (4 Byte je Wert), mit „Spuren
// einzeln“ und mehr als einem Kanal doppelt. Rein: R/lib/platz.ts; ohne Electron: src/main/platz.ts (Messung mit einspeisbarem statfs).
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import type { StatusItem } from '@jm/ui';
import type { RecorderState } from '@shared/types';
import { RECORDER_TEXTE, statusLeiste, type OberflaechenStand, type RecorderZustand } from '@/lib/oberflaeche';
import { bytesProSekunde, PLATZ_TAKT_MS, platzEintrag, platzOrdner, restzeitSek } from '@/lib/platz';
import { elternOrdner, freierPlatz, PLATZ_GRENZE_MS, PlatzAbfrage } from '../../src/main/platz';
import { ohneKommentare, zustand } from './testzustand';

const kurz = (i: StatusItem | undefined): string => (i === undefined ? 'fehlt' : `${i.state} ${i.detail ?? ''}`);

// ── RE-PLATZ bytesProSekunde: Kanäle × Samplerate × 4, × 2 mit „Spuren einzeln“ bei mehr als einem Kanal ──
gleich(
  [bytesProSekunde({ kanaele: 2, rate: 48000, spuren: false }), bytesProSekunde({ kanaele: 8, rate: 96000, spuren: true }), bytesProSekunde({ kanaele: 1, rate: 48000, spuren: true })],
  [384000, 6144000, 192000],
  'RE-PLATZ bytesProSekunde: (2, 48000, ohne Spuren) 384000; (8, 96000, mit Spuren) 6144000; (1, 48000, mit Spuren) 192000 (Mono ohne Spur)',
);
gleich([PLATZ_TAKT_MS, PLATZ_GRENZE_MS], [5000, 3000], 'RE-PLATZ Takt 5 s im Fenster, Zeitgrenze 3 s im Hauptprozess (B5)');

// ── RE-PLATZ Restzeit und Stufen: ab 900 s ok, darunter warn, unter 300 s error; nie gesperrt ──
{
  const bps = 384000;
  const e = (sek: number | null | undefined, ordner: string | null = 'D:\\Aufnahmen'): string => kurz(platzEintrag(sek === null || sek === undefined ? sek : sek * bps, bps, ordner));
  gleich(restzeitSek(bps * 7800, bps), 7800, 'RE-PLATZ restzeitSek: freie Bytes durch Bytes je Sekunde');
  gleich(
    [e(7800), e(3600), e(899), e(900), e(299), e(300), e(59), e(0)],
    ['ok für 2 h 10 min', 'ok für 1 h 0 min', 'warn für 14 min', 'ok für 15 min', 'error für 4 min', 'warn für 5 min', 'error für unter 1 min', 'error voll'],
    'RE-PLATZ Restzeit und Stufen: 384000 × 7800 → „für 2 h 10 min“ ok; 899 s warn, 900 s ok; 299 s error, 300 s warn; 59 s „für unter 1 min“ error; 0 → „voll“ error',
  );
  gleich(
    [e(null), e(undefined), e(7800, null), e(undefined, null), e(null, null)],
    ['off unbekannt', 'off unbekannt', 'off kein Zielordner', 'off unbekannt', 'off kein Zielordner'],
    'RE-PLATZ Restzeit und Stufen (G15): null → „unbekannt“, ohne Ordner → off „kein Zielordner“; Reihenfolge: noch keine Antwort, dann kein Zielordner, dann kein Messwert',
  );
  const i = platzEintrag(bps * 7800, bps, 'D:\\Aufnahmen');
  gleich(
    [i.id, i.group, i.label, i.settingsSection, RECORDER_TEXTE.platz.titel],
    ['platz', 'ausgabe', 'Platz', 'ziel', 'Platz'],
    'RE-PLATZ Eintrag: id platz, Gruppe ausgabe, Titel „Platz“ (die Leiste zeigt „Platz für …“), ein Klick öffnet das Panel Ziel',
  );
  gleich(
    [RECORDER_TEXTE.platz.fuer(2, 10), RECORDER_TEXTE.platz.fuer(0, 7), RECORDER_TEXTE.platz.unterMinute, RECORDER_TEXTE.platz.voll, RECORDER_TEXTE.platz.keinOrdner],
    ['für 2 h 10 min', 'für 7 min', 'für unter 1 min', 'voll', 'kein Zielordner'],
    'RE-PLATZ Texte: RECORDER_TEXTE.platz wörtlich wie im Plan',
  );
}

// ── RE-PLATZ in der Aufnahme zählt der Zustand, nicht der Wunsch ──
{
  const rec = (status: RecorderState['status'], filePath: string | null, z: Partial<RecorderState> = {}): RecorderState => zustand(status, { filePath, ...z });
  gleich(
    [
      platzOrdner(rec('recording', 'E:\\Show\\Tag.wav'), 'D:\\Wunsch'),
      platzOrdner(rec('recording', '/srv/aufnahme/Tag.wav'), null),
      platzOrdner(rec('recording', 'D:\\Tag.wav'), null),
      platzOrdner(rec('recording', '\\\\nas\\share\\Tag.wav'), 'D:\\Wunsch'),
      platzOrdner(rec('armed', 'E:\\Show\\Tag.wav'), 'D:\\Wunsch'),
      platzOrdner(rec('idle', null), null),
      platzOrdner(undefined, 'D:\\Wunsch'),
    ],
    ['E:\\Show', '/srv/aufnahme', 'D:\\', '\\\\nas\\share\\', 'D:\\Wunsch', null, 'D:\\Wunsch'],
    'RE-PLATZ platzOrdner: in der Aufnahme der Ordner von filePath (Trenner \\ und /; Laufwerks- und Freigabewurzel mit Trenner, wie statfs sie braucht), sonst der Zielordner',
  );
  const wunsch = (z: Partial<RecorderZustand> = {}): RecorderZustand => ({ deviceIndex: 0, channels: 8, sampleRate: 96000, loading: false, hinweisEingang: null, ...z });
  const stand = (z: RecorderState, platz: OberflaechenStand['platz']): OberflaechenStand => ({ recorder: wunsch(), zustand: z, geraete: undefined, meldung: null, masterLink: undefined, fernsteuerung: undefined, platz });
  const platz = (s: OberflaechenStand): string => kurz(statusLeiste(s).find((x) => x.id === 'platz'));
  // Gemessen 2 Kanäle × 44100 Hz mit Spuren: 705600 B/s; frei für 1000 s. Der Wunsch (8 × 96000, ohne Spuren) ergäbe 3072000 B/s.
  const frei = 2 * 44100 * 4 * 2 * 1000;
  gleich(
    [
      platz(stand(rec('recording', 'E:\\Show\\Tag.wav', { spuren: true }), { frei, spuren: false, dir: 'D:\\Wunsch' })),
      platz(stand(rec('recording', 'E:\\Show\\Tag.wav', { spuren: false }), { frei, spuren: true, dir: 'D:\\Wunsch' })),
      platz(stand(rec('armed', null), { frei, spuren: true, dir: 'D:\\Wunsch' })),
      platz(stand(rec('idle', null), { frei: 8 * 96000 * 4 * 2 * 1000, spuren: true, dir: 'D:\\Wunsch' })),
    ],
    ['ok für 16 min', 'ok für 33 min', 'ok für 16 min', 'ok für 16 min'],
    'RE-PLATZ in der Aufnahme zählt der Zustand, nicht der Wunsch: Kanäle, Samplerate und Spuren der Aufnahme; bei offenem Eingang die gemessenen Kanäle und Raten mit dem Spuren-Wunsch; bei zu der Wunsch',
  );
  gleich(
    [platz(stand(rec('idle', null), undefined)), platz(stand(rec('idle', null), { frei: undefined, spuren: false, dir: null })), platz(stand(rec('idle', null), { frei: null, spuren: false, dir: 'D:\\x' }))],
    ['off unbekannt', 'off unbekannt', 'off unbekannt'],
    'RE-PLATZ Statusleiste: ohne Platz-Stand, vor der ersten Antwort und ohne Messwert „Platz unbekannt“',
  );
  gleich(platz(stand(rec('idle', null), { frei: null, spuren: false, dir: null })), 'off kein Zielordner', 'RE-PLATZ Statusleiste: ohne Zielordner „kein Zielordner“');
  const reihe = statusLeiste(stand(rec('recording', 'E:\\Show\\Tag.wav'), { frei, spuren: false, dir: 'D:\\Wunsch' })).map((x) => x.id);
  ok(reihe.indexOf('platz') === reihe.indexOf('aufnahme') + 1, `RE-PLATZ Statusleiste: der Eintrag steht direkt hinter „aufnahme“ (${reihe.join(', ')})`);
  ok(!/(?<![\w-])window\b|\bdocument\b|\bipcRenderer\b|from ['"]electron['"]|from ['"]@\/store\//.test(ohneKommentare(leseText('src/renderer/src/lib/platz.ts'))), 'RE-PLATZ lib/platz.ts rein: ohne window, document, IPC, Electron und Store');
}

// ── RE-PLATZ freierPlatz: ENOENT geht zum Elternordner, anderer Fehler → null, bavail × bsize ──
type Statfs = (p: string) => Promise<{ bavail: number | bigint; bsize: number | bigint }>;
const enoent = (p: string): Error => Object.assign(new Error(`ENOENT: no such file or directory, statfs '${p}'`), { code: 'ENOENT' });
{
  const pfade: string[] = [];
  const statfs: Statfs = async (p) => {
    pfade.push(p);
    if (p === 'D:\\Aufnahmen') return { bavail: 10, bsize: 4096 };
    throw enoent(p);
  };
  const frei = await freierPlatz('D:\\Aufnahmen\\Neu\\Tag', statfs);
  gleich([frei, pfade], [40960, ['D:\\Aufnahmen\\Neu\\Tag', 'D:\\Aufnahmen\\Neu', 'D:\\Aufnahmen']], 'RE-PLATZ freierPlatz: nicht vorhandener Ordner → gemessen am nächsten vorhandenen Vorfahren, bavail × bsize');
  const gross = await freierPlatz('D:\\x', async () => ({ bavail: 10n, bsize: 4096n }));
  gleich(gross, 40960, 'RE-PLATZ freierPlatz: auch mit bigint-Werten');
  const andere: string[] = [];
  const nichts = await freierPlatz('D:\\Gesperrt\\Neu', async (p) => {
    andere.push(p);
    throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
  });
  gleich([nichts, andere.length], [null, 1], 'RE-PLATZ freierPlatz: ein anderer Fehler als ENOENT → null, ohne weiter nach oben zu gehen');
  const temp = mkdtempSync(join(tmpdir(), 'jmrec-platz-'));
  const echt = await freierPlatz(temp);
  const echtNeu = await freierPlatz(join(temp, 'gibt-es-nicht', 'tiefer'));
  ok(typeof echt === 'number' && echt > 0 && typeof echtNeu === 'number' && echtNeu > 0, `RE-PLATZ freierPlatz: echter Temp-Ordner > 0, auch ein nicht vorhandener Unterordner (${echt}, ${echtNeu})`);
}

// ── Review Focus 2 · RE-PLATZ elternOrdner endet an der Wurzel ──
{
  gleich(
    [elternOrdner('\\\\nas\\share\\Neu'), elternOrdner('\\\\nas\\share\\'), elternOrdner('D:\\'), elternOrdner('/srv/aufnahme'), elternOrdner('D:\\Aufnahmen'), elternOrdner('/')],
    ['\\\\nas\\share\\', null, null, '/srv', 'D:\\', null],
    'RE-PLATZ elternOrdner endet an der Wurzel: UNC an \\\\server\\share\\, Laufwerk an D:\\, POSIX an /',
  );
  const pfade: string[] = [];
  const frei = await freierPlatz('\\\\nas\\share\\Neu\\Tag1', async (p) => {
    pfade.push(p);
    throw enoent(p);
  });
  gleich([frei, pfade], [null, ['\\\\nas\\share\\Neu\\Tag1', '\\\\nas\\share\\Neu', '\\\\nas\\share\\']], 'RE-PLATZ freierPlatz: meldet jede Ebene einer Freigabe ENOENT → null nach höchstens drei Aufrufen');
}

// ── RE-PLATZ PlatzAbfrage: je Pfad höchstens eine Messung zugleich, Zeitgrenze → null, die alte Messung läuft aus ──
{
  let messungen = 0;
  let loese: (v: number | null) => void = () => {};
  const a = new PlatzAbfrage(async () => {
    messungen++;
    return new Promise<number | null>((r) => (loese = r));
  }, 1000);
  const f1 = a.frage('D:\\A');
  const f2 = a.frage('D:\\A');
  await new Promise((r) => setTimeout(r, 5));
  loese(123);
  gleich([await f1, await f2, messungen], [123, 123, 1], 'RE-PLATZ PlatzAbfrage: zwei Fragen zugleich → eine Messung, beide bekommen ihr Ergebnis');
  const f3 = a.frage('D:\\A');
  await new Promise((r) => setTimeout(r, 5));
  loese(456);
  gleich([await f3, messungen], [456, 2], 'RE-PLATZ PlatzAbfrage: nach der Antwort misst die nächste Frage neu');

  let haengend = 0;
  const b = new PlatzAbfrage(async () => {
    haengend++;
    return new Promise<number | null>(() => {});
  }, 30);
  const t0 = Date.now();
  const g1 = await b.frage('\\\\nas\\tot');
  const ms = Date.now() - t0;
  const g2 = await b.frage('\\\\nas\\tot');
  gleich([g1, g2, haengend], [null, null, 1], 'RE-PLATZ PlatzAbfrage: antwortet die Messung nie → null nach der Zeitgrenze; die nächste Frage teilt die hängende Messung (keine zweite)');
  ok(ms >= 25 && ms < 1000, `RE-PLATZ PlatzAbfrage: die Zeitgrenze gilt (30 ms im Test, gemessen ${ms} ms)`);
  const c = new PlatzAbfrage(async () => {
    throw new Error('kaputt');
  }, 1000);
  gleich(await c.frage('D:\\B'), null, 'RE-PLATZ PlatzAbfrage: eine scheiternde Messung → null');
}
