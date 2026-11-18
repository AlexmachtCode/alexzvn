// #313: reine SVG-Hilfen – am Inhalt erkennen, Seitenverhältnis lesen, Rastergröße für den 4K-Ausgang.
// npm run selftest -w @jm/presenter
let pass = 0, fail = 0;
function ck(name: string, cond: boolean, extra = ''): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const b = await import('../src/shared/bildformat');
const enc = (s: string) => new TextEncoder().encode(s);
const gr = (s: string) => JSON.stringify(b.svgRasterGroesse(enc(s)));

// istSvg
ck('svg schlicht', b.istSvg(enc('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')));
ck('svg mit BOM, Leerraum, XML-Kopf, Kommentar, DOCTYPE', b.istSvg(enc(
  '﻿  \n<?xml version="1.0" encoding="UTF-8"?>\n<!-- Logo -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg viewBox="0 0 1 1"></svg>')));
ck('svg-Tag in Großschrift', b.istSvg(enc('<SVG width="1" height="1"></SVG>')));
ck('png ist kein svg', !b.istSvg(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)));
ck('html mit svg im body ist kein svg', !b.istSvg(enc('<html><body><svg width="1" height="1"/></body></html>')));
ck('leer ist kein svg', !b.istSvg(new Uint8Array(0)));
ck('<svgfoo> ist kein svg', !b.istSvg(enc('<svgfoo/>')));
ck('svg erst nach 4 KiB Kommentar → nicht erkannt', !b.istSvg(enc(`<!--${'x'.repeat(5000)}--><svg/>`)));

// svgSeitenverhaeltnis
ck('width/height Zahlen', b.svgSeitenverhaeltnis('<svg width="200" height="100">') === 2);
ck('width/height px', b.svgSeitenverhaeltnis('<svg width="200px" height="50px">') === 4);
ck('Prozent → viewBox', b.svgSeitenverhaeltnis('<svg width="100%" height="100%" viewBox="0 0 300 600">') === 0.5);
ck('em → viewBox', b.svgSeitenverhaeltnis('<svg width="10em" height="2em" viewBox="0 0 400 100">') === 4);
ck('nur viewBox mit Kommas', b.svgSeitenverhaeltnis('<svg viewBox="0,0,1920,1080">') === 1920 / 1080);
ck('Attribute über Zeilen und einfache Anführungszeichen', b.svgSeitenverhaeltnis("<svg\n  width='30'\n  height='10'>") === 3);
ck('nichts → null', b.svgSeitenverhaeltnis('<svg xmlns="http://www.w3.org/2000/svg">') === null);
ck('width 0 ohne viewBox → null', b.svgSeitenverhaeltnis('<svg width="0" height="10">') === null);
ck('kaputte viewBox → null', b.svgSeitenverhaeltnis('<svg viewBox="0 0 0 10">') === null);
ck('height-Attribut eines Kindes zählt nicht', b.svgSeitenverhaeltnis('<svg viewBox="0 0 10 10"><rect width="5" height="1"/></svg>') === 1);
ck('Vorspann vor dem Wurzelelement', b.svgSeitenverhaeltnis('<?xml version="1.0"?><!-- width="9" --><svg width="4" height="2">') === 2);

// svgRasterGroesse – in 3840×2160 eingepasst
ck('Konstanten', b.SVG_RASTER_MAX_BREITE === 3840 && b.SVG_RASTER_MAX_HOEHE === 2160);
ck('2:1 → 3840×1920', gr('<svg width="200" height="100"/>') === '{"breite":3840,"hoehe":1920}', gr('<svg width="200" height="100"/>'));
ck('1:2 → 1080×2160', gr('<svg viewBox="0 0 100 200"/>') === '{"breite":1080,"hoehe":2160}', gr('<svg viewBox="0 0 100 200"/>'));
ck('ohne Angabe → 3840×2160', gr('<svg/>') === '{"breite":3840,"hoehe":2160}', gr('<svg/>'));
ck('16:9 → 3840×2160', gr('<svg width="1920" height="1080"/>') === '{"breite":3840,"hoehe":2160}');
const schmal = b.svgRasterGroesse(enc('<svg width="1" height="1000"/>'));
ck('1×1000 → 2160 hoch, mindestens 1 breit', schmal.hoehe === 2160 && schmal.breite >= 1, JSON.stringify(schmal));
const flach = b.svgRasterGroesse(enc('<svg width="100000" height="1"/>'));
ck('100000×1 → 3840 breit, mindestens 1 hoch', flach.breite === 3840 && flach.hoehe >= 1, JSON.stringify(flach));

console.log(`bildformat: ${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);
