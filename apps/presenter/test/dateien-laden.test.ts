// #298/#299: der EINE Lade-Weg im Hauptprozess (ladeDateien) mit Attrappe statt LibreOffice.
// npm run selftest -w @jm/presenter
import { registerHooks } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const gleich = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

// dateien-laden.ts importiert './office/import' (LibreOffice) → Attrappe, die das expandBuilds mitschreibt.
const g = globalThis as unknown as { __expand: boolean[] };
g.__expand = [];
const IMPORT = `
export async function importOfficeFile(pfad, expandBuilds) {
  globalThis.__expand.push(expandBuilds);
  if (pfad.endsWith('Deck.pptx')) {
    return { ok: true, name: 'Deck.pdf', bytes: Uint8Array.of(1, 2, 3), animations: { perSlide: [1], animatedSlides: 1, totalBuilds: 1 } };
  }
  return { ok: false, error: 'LibreOffice nicht gefunden.' };
}`;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === './office/import') return { url: 'mock:office-import', shortCircuit: true };
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (url === 'mock:office-import') return { format: 'module', source: IMPORT, shortCircuit: true };
    return next(url, ctx);
  },
});

const { ladeDateien, pruefeImportPfade } = await import('../src/main/dateien-laden');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jmpr-laden-'));
const pdfBytes = new TextEncoder().encode('%PDF-1.4');
const projBytes = Uint8Array.of(80, 75, 3, 4, 9);
const p = (n: string) => path.join(dir, n);
fs.writeFileSync(p('a.pdf'), pdfBytes);
fs.writeFileSync(p('b.PNG'), Uint8Array.of(137, 80, 78, 71));
fs.writeFileSync(p('S.jmpres'), projBytes);
fs.mkdirSync(p('ordner.pdf'));

try {
  // PDF + Bild + nicht unterstützt
  let r = await ladeDateien([p('a.pdf'), p('b.PNG'), p('Video.mp4')], { expandBuilds: false });
  ck('PDF und Bild geladen, Video übersprungen', r.files.map((f) => f.name + ':' + f.kind).join('|') === 'a.pdf:pdf|b.PNG:image');
  ck('Bytes der PDF stimmen', gleich(r.files[0].bytes, pdfBytes));
  ck('Hinweis nennt das Video', JSON.stringify(r.hinweise) === JSON.stringify(['Nicht unterstützt, übersprungen: Video.mp4']));
  ck('kein Projekt', r.projekt === null);

  // Office mit expandBuilds
  r = await ladeDateien([p('Deck.pptx')], { expandBuilds: true });
  ck('Office → ein PDF', r.files.length === 1 && r.files[0].name === 'Deck.pdf' && r.files[0].kind === 'pdf');
  ck('Animationen mitgegeben', r.files[0].animations?.totalBuilds === 1);
  ck('expandBuilds kam an', g.__expand[g.__expand.length - 1] === true);
  r = await ladeDateien([p('Deck.pptx')], { expandBuilds: false });
  ck('expandBuilds false kam an', g.__expand[g.__expand.length - 1] === false);

  // Office-Fehler
  r = await ladeDateien([p('Kaputt.docx')], { expandBuilds: false });
  ck('Office-Fehler → Hinweis', r.files.length === 0 && JSON.stringify(r.hinweise) === JSON.stringify(['„Kaputt.docx“: LibreOffice nicht gefunden.']));

  // Lesefehler
  r = await ladeDateien([p('fehlt.pdf')], { expandBuilds: false });
  ck('fehlende Datei → Hinweis', r.files.length === 0 && r.hinweise.length === 1 && r.hinweise[0].startsWith('„fehlt.pdf“ konnte nicht geladen werden: '));
  r = await ladeDateien([p('ordner.pdf')], { expandBuilds: false });
  ck('Ordner statt Datei → Hinweis', r.files.length === 0 && r.hinweise.length === 1 && r.hinweise[0].startsWith('„ordner.pdf“ konnte nicht geladen werden: '));

  // Projekt
  r = await ladeDateien([p('S.jmpres')], { expandBuilds: false });
  ck('einzelnes Projekt', r.projekt?.name === 'S.jmpres' && gleich(r.projekt.bytes, projBytes) && r.files.length === 0);
  r = await ladeDateien([p('S.jmpres'), p('a.pdf')], { expandBuilds: false });
  ck('Projekt zusammen mit PDF → übersprungen', r.projekt === null && r.files.length === 1 && JSON.stringify(r.hinweise) === JSON.stringify(['Projektdatei nur einzeln ablegen, übersprungen: S.jmpres']));

  // Reihenfolge
  r = await ladeDateien([p('b.PNG'), p('Deck.pptx'), p('a.pdf')], { expandBuilds: false });
  ck('Reihenfolge bleibt', r.files.map((f) => f.name).join('|') === 'b.PNG|Deck.pdf|a.pdf');
  // Eingabeprüfung für files:importPaths
  const abs = p('a.pdf');
  ck('kein Array → null', pruefeImportPfade('x') === null && pruefeImportPfade(undefined) === null);
  ck('Nicht-String → null', pruefeImportPfade([abs, 5]) === null);
  ck('201 Pfade → null', pruefeImportPfade(Array.from({ length: 201 }, () => abs)) === null);
  ck('200 Pfade ok', pruefeImportPfade(Array.from({ length: 200 }, () => abs))?.length === 200);
  ck('relativer Pfad entfällt', JSON.stringify(pruefeImportPfade(['a.pdf', abs])) === JSON.stringify([abs]));
  const unc = '\\\\nas\\share\\a.pdf';
  // path.isAbsolute kennt UNC nur unter Windows; dort läuft die Zielanwendung.
  ck('UNC-Pfad bleibt', process.platform !== 'win32' || pruefeImportPfade([unc])?.[0] === unc);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
