// #303: Reine Zeichenhilfen des NDI-Bilds (Einpassen, Blendkurve, Zeichenplan, BGRA). npm run selftest -w @jm/presenter
let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const eq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const b = await import('../src/shared/ndi-bild');

// Einpassen wie SlideCanvas im Publikumsfenster: verkleinern, nie vergrößern, mittig.
ck('16:9 füllt', eq(b.einpassen(1920, 1080), { x: 0, y: 0, w: 1920, h: 1080 }));
ck('Hochkant-PDF: volle Höhe, mittig', eq(b.einpassen(1920, 3413), { x: 656, y: 0, w: 608, h: 1080 }));
ck('4:3-Bild', eq(b.einpassen(1920, 1440), { x: 240, y: 0, w: 1440, h: 1080 }));
ck('kleines Bild nicht vergrößert (wie Publikumsfenster)', eq(b.einpassen(640, 480), { x: 640, y: 300, w: 640, h: 480 }));
ck('21:9 mittig', eq(b.einpassen(1920, 823), { x: 0, y: 129, w: 1920, h: 823 }));

// Blendkurve wie CSS `ease-in-out`.
ck('ease 0, 1, Mitte', b.easeInOut(0) === 0 && b.easeInOut(1) === 1 && Math.abs(b.easeInOut(0.5) - 0.5) < 1e-6);
ck('ease wie CSS (0,25 → 0,1292; 0,1 → 0,0197)', Math.abs(b.easeInOut(0.25) - 0.1292) < 1e-3 && Math.abs(b.easeInOut(0.1) - 0.0197) < 1e-3);
ck('ease begrenzt', b.easeInOut(-1) === 0 && b.easeInOut(2) === 1);

// Zeichenplan: welche Schichten mit welcher Deckkraft, ab wo verdeckt, ob der Takt weiterläuft.
const alt = { key: 1, blendeMs: 0, bereitAbMs: 0 };
ck('leer', eq(b.zeichenplan([], 0), { zeichnen: [], deckendAb: null, blendeLaeuft: false }));
ck('nicht gemalt → nichts', eq(b.zeichenplan([{ key: 1, blendeMs: 0, bereitAbMs: null }], 0).zeichnen, []));
ck('kein Schwarzblitz: alte bleibt, bis die neue gemalt ist', eq(b.zeichenplan([alt, { key: 2, blendeMs: 0, bereitAbMs: null }], 100).zeichnen, [{ key: 1, alpha: 1 }]));
ck('Schnitt: neue deckt', eq(b.zeichenplan([alt, { key: 2, blendeMs: 0, bereitAbMs: 50 }], 100), { zeichnen: [{ key: 2, alpha: 1 }], deckendAb: 2, blendeLaeuft: false }));
const v = b.zeichenplan([alt, { key: 2, blendeMs: 1000, bereitAbMs: 0 }], 250);
ck('Blende nach 1/4: alt voll, neu 0,129 darüber (Schichtfolge wie CSS-Stapel)', v.zeichnen.length === 2 && eq(v.zeichnen[0], { key: 1, alpha: 1 }) && Math.abs(v.zeichnen[1].alpha - 0.1292) < 1e-3 && v.deckendAb === 1 && v.blendeLaeuft);
ck('Blende fertig: nur neu', eq(b.zeichenplan([alt, { key: 2, blendeMs: 1000, bereitAbMs: 0 }], 1000), { zeichnen: [{ key: 2, alpha: 1 }], deckendAb: 2, blendeLaeuft: false }));
const drei = [alt, { key: 2, blendeMs: 500, bereitAbMs: 0 }, { key: 3, blendeMs: 500, bereitAbMs: 400 }];
const z = b.zeichenplan(drei, 600);
ck('schnell geklickt: Mitte fertig, oben halb → Mitte + oben', z.zeichnen.map((e) => e.key).join() === '2,3' && z.deckendAb === 2 && z.blendeLaeuft);
ck('schnell geklickt: am Ende nur die oberste', eq(b.zeichenplan(drei, 900), { zeichnen: [{ key: 3, alpha: 1 }], deckendAb: 3, blendeLaeuft: false }));
const wartet = b.zeichenplan([alt, { key: 2, blendeMs: 500, bereitAbMs: 0 }, { key: 3, blendeMs: 500, bereitAbMs: null }], 250);
ck('schnell geklickt, oberste noch nicht gemalt: laufende Blende geht weiter', wartet.zeichnen.map((e) => e.key).join() === '1,2' && wartet.deckendAb === 1 && wartet.blendeLaeuft);

// Pixelformat und Füllung.
const px = Uint8ClampedArray.of(1, 2, 3, 4, 10, 20, 30, 40); b.rgbaZuBgra(px);
ck('RGBA → BGRA, Alpha bleibt', eq([...px], [3, 2, 1, 4, 30, 20, 10, 40]));
ck('Füllung: Schwarz und leer transparent, Weiß weiß, Folie Schichten', b.ndiFuellung('schwarz') === 'transparent' && b.ndiFuellung('leer') === 'transparent' && b.ndiFuellung('weiss') === 'weiss' && b.ndiFuellung('folie') === 'schichten');

console.log(`\n${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);
