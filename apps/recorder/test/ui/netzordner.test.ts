// Altfehler Stufe 2, Recorder A (Plan 2026-11-26, Task 6; RE-7b, B4): der Zielordner aus einer .jmshow geht durch dieselbe Prüfung
// wie beim Import. `normiereOrdner` und `pruefeShowOrdner` (src/shared/netzordner.ts, rein) und die Liste der bestätigten
// Netzwerkordner (`NetzordnerListe`, src/main/netzordner.ts, ohne Electron) mit einer Datei im Temp-Ordner.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gleich, ok } from '@jm/ui/testhilfe';
import * as shared from '@shared/netzordner';
import * as main from '../../src/main/netzordner';

const NAS = '\\\\nas\\x';

// ── normiereOrdner: Schrägstriche zu \, klein, ohne \ am Ende ──
gleich(
  [shared.normiereOrdner('//nas/x/'), shared.normiereOrdner('\\\\NAS\\x'), shared.normiereOrdner('\\\\NAS\\x\\'), shared.normiereOrdner('D:/Show/')],
  [NAS, NAS, NAS, 'd:\\show'],
  'RE-7b normiereOrdner: //nas/x/, \\\\NAS\\x und \\\\NAS\\x\\ ergeben dieselbe Form (Schrägstriche zu \\, klein, ohne \\ am Ende)',
);

// ── pruefeShowOrdner: ungültig, bestätigen, setzen ──
{
  const nie = (): boolean => false;
  const immer = (): boolean => true;
  const bekannt = (p: string): boolean => shared.normiereOrdner(p) === shared.normiereOrdner('\\\\NAS\\x\\');
  gleich(shared.pruefeShowOrdner(NAS, nie), { art: 'bestaetigen', dir: NAS }, 'RE-7b pruefeShowOrdner: ein neuer Netzwerkordner wartet auf Bestätigung');
  gleich(shared.pruefeShowOrdner('//nas/x', nie), { art: 'bestaetigen', dir: '//nas/x' }, 'RE-7b pruefeShowOrdner: auch mit Schrägstrichen (//nas/x)');
  gleich(shared.pruefeShowOrdner(NAS, bekannt), { art: 'setzen', dir: NAS }, 'RE-7b pruefeShowOrdner: ein bestätigter Netzwerkordner wird gesetzt (Vergleich über normiereOrdner)');
  gleich(shared.pruefeShowOrdner('\\\\nas\\y', bekannt), { art: 'bestaetigen', dir: '\\\\nas\\y' }, 'RE-7b pruefeShowOrdner: ein anderer Netzwerkordner bleibt unbestätigt');
  const ungueltig = ['\\\\?\\C:\\x', '\\\\.\\COM1', '\\\\nas', 'Aufnahmen\\Tag', ''];
  gleich(
    ungueltig.map((d) => [shared.pruefeShowOrdner(d, nie).art, shared.pruefeShowOrdner(d, immer).art]),
    ungueltig.map(() => ['ungueltig', 'ungueltig']),
    'RE-7b pruefeShowOrdner: \\\\?\\C:\\x, \\\\.\\COM1, \\\\nas, Relatives und Leeres sind ungültig, auch wenn sie als bestätigt gälten',
  );
  gleich(
    [shared.pruefeShowOrdner('D:\\Show', nie), shared.pruefeShowOrdner('E:/Aufnahme', nie)],
    [{ art: 'setzen', dir: 'D:\\Show' }, { art: 'setzen', dir: 'E:/Aufnahme' }],
    'RE-7b pruefeShowOrdner: ein Laufwerksordner (D:\\Show) wird ohne Bestätigung gesetzt',
  );
}

// ── NetzordnerListe: Datei { version: 1, ordner }, Zwischendatei, kaputt = leer ──
{
  const d = mkdtempSync(join(tmpdir(), 'jmrec-netz-'));
  const datei = join(d, 'recorder-netzordner.json');
  const a = new main.NetzordnerListe(datei);
  a.laden();
  ok(!a.enthaelt(NAS) && !existsSync(datei), 'RE-7b NetzordnerListe: ohne Datei leer, Laden legt keine Datei an');
  a.merke('\\\\NAS\\x');
  a.merke('//nas/x/');
  const gelesen = JSON.parse(readFileSync(datei, 'utf8')) as unknown;
  gleich(gelesen, { version: 1, ordner: ['\\\\NAS\\x'] }, 'RE-7b NetzordnerListe: merke schreibt { version: 1, ordner } (dieselbe Freigabe nur einmal, normiert verglichen)');
  ok(!existsSync(`${datei}.tmp`), 'RE-7b NetzordnerListe: geschrieben über eine Zwischendatei, die danach weg ist (umbenannt)');
  const b = new main.NetzordnerListe(datei);
  b.laden();
  ok(b.enthaelt('//nas/x/') && b.enthaelt(NAS) && !b.enthaelt('\\\\nas\\y'), 'RE-7b NetzordnerListe: eine neue Liste liest die Datei wieder; enthaelt vergleicht normiert');
  writeFileSync(datei, '{kaputt', 'utf8');
  const c = new main.NetzordnerListe(datei);
  c.laden();
  ok(!c.enthaelt(NAS), 'RE-7b NetzordnerListe: eine kaputte Datei ergibt eine leere Liste');
  writeFileSync(datei, JSON.stringify({ version: 2, ordner: [NAS] }), 'utf8');
  const v = new main.NetzordnerListe(datei);
  v.laden();
  writeFileSync(datei, JSON.stringify({ version: 1, ordner: [NAS, 7, null] }), 'utf8');
  const m = new main.NetzordnerListe(datei);
  m.laden();
  ok(!v.enthaelt(NAS) && m.enthaelt(NAS), 'RE-7b NetzordnerListe: eine fremde Version gilt als leer; Einträge, die kein Text sind, fallen weg');
}
