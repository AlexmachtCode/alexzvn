// #298/#299: reine Regeln zum Öffnen von Dateien (Einordnung, argv, Bündeln, Modus, Aufbau-Hinweise).
// npm run selftest -w @jm/presenter
let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

const d = await import('../src/shared/dateien');

ck('pdf groß', d.dateiArt('C:\\Docs\\Präsentation März.PDF') === 'pdf');
ck('bild', d.dateiArt('/x/logo.webp') === 'image' && d.dateiArt('a.BMP') === 'image');
ck('office', d.dateiArt('deck.pptx') === 'office' && d.dateiArt('brief.rtf') === 'office');
ck('projekt', d.dateiArt('show.jmpres') === 'projekt');
ck('ohne endung / fremd', d.dateiArt('C:\\Ordner') === null && d.dateiArt('film.mp4') === null && d.dateiArt('x.jmshow') === null);
ck('dateiName beide trenner', d.dateiName('C:\\a\\b.pdf') === 'b.pdf' && d.dateiName('/a/b c.pdf') === 'b c.pdf');

const o1 = d.ordneDateien(['a.pdf', 'b.png', 'Video.mp4', 'c.pptx', 'Notizen.txt']);
ck('ordnung: reihenfolge + arten', JSON.stringify(o1.importieren) === JSON.stringify([
  { pfad: 'a.pdf', art: 'pdf' }, { pfad: 'b.png', art: 'image' }, { pfad: 'c.pptx', art: 'office' }]));
ck('ordnung: nicht unterstützt', o1.nichtUnterstuetzt.join('|') === 'Video.mp4|Notizen.txt' && o1.projekt === null);
ck('projekt allein', d.ordneDateien(['C:\\x\\Show.jmpres']).projekt === 'C:\\x\\Show.jmpres');
const o2 = d.ordneDateien(['Show.jmpres', 'a.pdf']);
ck('projekt im mix übersprungen', o2.projekt === null && o2.projektUebersprungen.join() === 'Show.jmpres' && o2.importieren.length === 1);
ck('hinweise text', JSON.stringify(d.hinweiseAusOrdnung(d.ordneDateien(['C:\\v\\Video.mp4', 'Notizen.txt', 'S.jmpres', 'a.pdf'])))
  === JSON.stringify(['Nicht unterstützt, übersprungen: Video.mp4, Notizen.txt', 'Projektdatei nur einzeln ablegen, übersprungen: S.jmpres']));
ck('keine hinweise', d.hinweiseAusOrdnung(d.ordneDateien(['a.pdf'])).length === 0);

const da = new Set(['C:\\D\\Präsentation März.PDF', 'C:\\D\\b.png', 'C:\\D\\x.jmshow', 'C:\\D\\c.pdf']);
const ist = (p: string) => da.has(p);
ck('argv: exe, schalter, links, --show-wert raus', JSON.stringify(d.pfadeAusArgv(
  ['C:\\P\\JM Presenter.exe', '--allow-file-access-from-files', 'jmps://open?show=x', '--show', 'C:\\D\\x.jmshow',
   'C:\\D\\Präsentation März.PDF', 'C:\\D\\b.png', 'C:\\D\\fehlt.pdf', 'C:\\D\\Präsentation März.PDF'], ist))
  === JSON.stringify(['C:\\D\\Präsentation März.PDF', 'C:\\D\\b.png']));
ck('argv: --show überspringt genau EIN Wert', JSON.stringify(d.pfadeAusArgv(['--show', 'C:\\D\\c.pdf'], ist)) === '[]');

ck('fragen + leer → ersetzen', d.wieOeffnen('fragen', false) === 'ersetzen');
ck('fragen + folien → fragen', d.wieOeffnen('fragen', true) === 'fragen');
ck('anhaengen/ersetzen bleiben', d.wieOeffnen('anhaengen', false) === 'anhaengen' && d.wieOeffnen('ersetzen', true) === 'ersetzen');

const abgaben: string[][] = [];
const s = d.erstelleSammler(60, (p) => abgaben.push(p));
s(['a.pdf']); await warte(30); s(['b.pdf', 'a.pdf']); await warte(30);
ck('sammler: wartet nach letzter eingabe', abgaben.length === 0);
await warte(60);
ck('sammler: eine abgabe, ohne doppelte', abgaben.length === 1 && abgaben[0].join() === 'a.pdf,b.pdf');
s(['c.pdf']); await warte(90);
ck('sammler: danach neuer vorgang', abgaben.length === 2 && abgaben[1].join() === 'c.pdf');

const anim = { perSlide: [0, 2, 1], animatedSlides: 2, totalBuilds: 3 };
const a1 = d.aufbauHinweise(anim, 3, false);
ck('aufbau: notizen', JSON.stringify(a1.notizen) === JSON.stringify([null,
  '▸ Original-Animation: 2 Aufbau-Klick(s) auf dieser Folie.', '▸ Original-Animation: 1 Aufbau-Klick(s) auf dieser Folie.']));
ck('aufbau: hinweis', a1.hinweis === '2 Folie(n) hatten Aufbau-Animationen (3 Klicks) — als Notiz vermerkt.');
ck('aufbau: seitenzahl passt nicht → keine notizen', d.aufbauHinweise(anim, 4, false).notizen.every((n) => n === null));
ck('aufbau: aufgeteilt', d.aufbauHinweise(undefined, 7, true).hinweis === 'Aufbau-Animationen als Einzelschritte importiert — 7 Schritt-Folien (experimentell).');
ck('aufbau: nichts', d.aufbauHinweise(undefined, 2, false).hinweis === null);

ck('ohne pfad: hinweis', d.hinweisOhnePfad(['mail.pdf', 'Bild.png'])
  === 'Ohne Dateipfad, übersprungen: mail.pdf, Bild.png (bitte zuerst speichern und dann hineinziehen).');
ck('ohne pfad: nichts', d.hinweisOhnePfad([]) === null);

// Portionen: der Hauptprozess nimmt höchstens MAX_PFADE_JE_AUFRUF Pfade je Aufruf.
const aufrufe: string[][] = [];
const lader = async (teil: string[]) => {
  aufrufe.push(teil);
  return {
    files: teil.filter((p) => !p.includes('fehlt')).map((p) => ({ name: p, kind: 'image' as const, bytes: Uint8Array.of(1) })),
    projekt: teil.length === 1 && teil[0].endsWith('.jmpres') ? { name: teil[0], bytes: Uint8Array.of(2) } : null,
    hinweise: teil.filter((p) => p.includes('fehlt')).map((p) => `„${p}“ wurde nicht gefunden.`),
  };
};
ck('portionen: grenze ist 200', d.MAX_PFADE_JE_AUFRUF === 200);
let r = await d.ladeInPortionen([], lader);
ck('portionen: leer → kein aufruf', aufrufe.length === 0 && r.files.length === 0 && r.projekt === null && r.hinweise.length === 0);
r = await d.ladeInPortionen(['S.jmpres'], lader);
ck('portionen: bis zur grenze EIN aufruf, projekt bleibt', aufrufe.length === 1 && r.projekt?.name === 'S.jmpres');
aufrufe.length = 0;
const bilder = (n: number) => Array.from({ length: n }, (_, i) => `b${i}.png`);
r = await d.ladeInPortionen(bilder(3), lader, 3);
ck('portionen: genau max → ein aufruf', aufrufe.length === 1 && r.files.length === 3);
aufrufe.length = 0;
r = await d.ladeInPortionen([...bilder(4), 'Video.mp4', 'fehlt.png', 'S.jmpres'], lader, 3);
ck('portionen: darüber in teilen ≤ max, nacheinander, ohne fremde/projekt', JSON.stringify(aufrufe)
  === JSON.stringify([['b0.png', 'b1.png', 'b2.png'], ['b3.png', 'fehlt.png']]));
ck('portionen: alle dateien in reihenfolge', r.files.map((f) => f.name).join() === 'b0.png,b1.png,b2.png,b3.png');
ck('portionen: projekt nie allein → übersprungen', r.projekt === null);
ck('portionen: hinweise aus ordnung + aus jedem teil', JSON.stringify(r.hinweise) === JSON.stringify([
  'Nicht unterstützt, übersprungen: Video.mp4', 'Projektdatei nur einzeln ablegen, übersprungen: S.jmpres', '„fehlt.png“ wurde nicht gefunden.']));
aufrufe.length = 0;
r = await d.ladeInPortionen(bilder(201), lader);
ck('portionen: 201 → 200 + 1', aufrufe.map((a) => a.length).join() === '200,1' && r.files.length === 201);
let laufend = 0, hoechstens = 0;
await d.ladeInPortionen(bilder(7), async (teil) => {
  laufend++; hoechstens = Math.max(hoechstens, laufend);
  await warte(5);
  laufend--;
  return lader(teil);
}, 3);
ck('portionen: nie zwei aufrufe gleichzeitig', hoechstens === 1);

console.log(`\ndateien: ${pass} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
