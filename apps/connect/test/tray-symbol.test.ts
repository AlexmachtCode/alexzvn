// Menüleisten-Symbol von JM Connect (#277, Spec 23) OHNE Electron (tsx): npm run selftest -w @jm/connect
// PK61: das Vorlagenbild aus src/main/tray-symbol.ts, gelesen mit einem eigenen PNG-Leser (Signatur, jede CRC, Filter 0–4;
// nicht der Schreiber des Moduls), die Wahl je Plattform und der Quelltext von tray.ts (Vorlagenbild nur unter macOS, sonst
// wie 0.3.0) und index.ts (Fenster- und Tray-Datei unverändert). Die Zahlen der Zeichnung sind die der Vorschau (OFC5, V1).
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { traySymbolArt, trayVorlagePng } from '../src/main/tray-symbol';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

// ── Eigener PNG-Leser (unabhängig vom Schreiber im Modul) ──
interface Png { w: number; h: number; bit: number; farbe: number; interlace: number; chunks: string[]; rgba: Uint8Array }
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (b: Buffer): number => {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
/** null, wenn Signatur, eine CRC, die Länge der Rohdaten oder ein Zeilenfilter nicht stimmt. */
function lesePng(buf: Buffer): Png | null {
  try {
    if (!buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return null;
    let o = 8;
    const chunks: string[] = [], idat: Buffer[] = [];
    let kopf: Buffer | null = null;
    while (o < buf.length) {
      const len = buf.readUInt32BE(o);
      const typ = buf.toString('ascii', o + 4, o + 8);
      if (buf.readUInt32BE(o + 8 + len) !== crc(buf.subarray(o + 4, o + 8 + len))) return null;
      chunks.push(typ);
      if (typ === 'IHDR') kopf = buf.subarray(o + 8, o + 8 + len);
      if (typ === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len));
      o += 12 + len;
    }
    if (!kopf) return null;
    const w = kopf.readUInt32BE(0), h = kopf.readUInt32BE(4), bit = kopf[8], farbe = kopf[9], interlace = kopf[12];
    if (bit !== 8 || farbe !== 6 || interlace !== 0) return { w, h, bit, farbe, interlace, chunks, rgba: new Uint8Array(0) };
    const roh = inflateSync(Buffer.concat(idat));
    const zl = w * 4;
    if (roh.length !== (zl + 1) * h) return null;
    const px = new Uint8Array(zl * h);
    for (let y = 0; y < h; y++) {
      const ft = roh[y * (zl + 1)];
      for (let x = 0; x < zl; x++) {
        const r = roh[y * (zl + 1) + 1 + x];
        const a = x >= 4 ? px[y * zl + x - 4] : 0, b = y > 0 ? px[(y - 1) * zl + x] : 0;
        const c = x >= 4 && y > 0 ? px[(y - 1) * zl + x - 4] : 0;
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        const v = [r, r + a, r + b, r + ((a + b) >> 1), r + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)][ft];
        if (v === undefined) return null;
        px[y * zl + x] = v & 0xff;
      }
    }
    return { w, h, bit, farbe, interlace, chunks, rgba: px };
  } catch {
    return null;
  }
}
const alphaVon = (p: Png | null): Uint8Array => {
  const a = new Uint8Array(p ? p.w * p.h : 0);
  for (let i = 0; p && i < a.length; i++) a[i] = p.rgba[i * 4 + 3] ?? 0;
  return a;
};

console.log('— C20 PK61: Vorlagenbild der Menüleiste (#277, Spec 23, E59)');
{
  const b18 = trayVorlagePng(1), b36 = trayVorlagePng(2);
  const p18 = lesePng(b18), p36 = lesePng(b36);
  const form = (p: Png | null, kante: number): boolean => p !== null && p.w === kante && p.h === kante && p.bit === 8
    && p.farbe === 6 && p.interlace === 0 && p.chunks.join(' ') === 'IHDR IDAT IEND' && p.rgba.length === kante * kante * 4;
  ck('C20 PK61 18er: PNG mit gültiger Signatur und CRC, 18 × 18, RGBA 8 Bit, ohne Interlace, nur IHDR IDAT IEND', form(p18, 18));
  ck('C20 PK61 Retina-Fassung: PNG mit gültiger Signatur und CRC, 36 × 36, RGBA 8 Bit, ohne Interlace, nur IHDR IDAT IEND', form(p36, 36));
  const beide = [p18, p36].filter((p): p is Png => p !== null && p.rgba.length > 0);
  ck('C20 PK61 Vorlagenbild: jedes Pixel hat RGB 0 (18er und 36er)',
    beide.length === 2 && beide.every((p) => p.rgba.every((v, i) => i % 4 === 3 || v === 0)));
  const a18 = alphaVon(p18), a36 = alphaVon(p36);
  ck('C20 PK61 Alpha nicht leer (18er und 36er)', a18.some((v) => v > 0) && a36.some((v) => v > 0));
  const ecken = (a: Uint8Array, k: number): number[] => [a[0], a[k - 1], a[(k - 1) * k], a[k * k - 1]];
  ck('C20 PK61 keine Kachel: die vier Ecken sind durchsichtig (18er und 36er)',
    a18.length === 324 && a36.length === 1296 && [...ecken(a18, 18), ...ecken(a36, 36)].every((v) => v === 0));
  const ring = (a: Uint8Array, k: number): number => {
    let n = 0;
    for (let i = 0; i < a.length; i++) {
      const x = i % k, y = Math.floor(i / k);
      if ((x === 0 || y === 0 || x === k - 1 || y === k - 1) && a[i] > 0) n++;
    }
    return n;
  };
  ck('C20 PK61 keine Kachel: der äußere Pixelring ist frei (18er und 36er)', a18.length === 324 && a36.length === 1296 && ring(a18, 18) + ring(a36, 36) === 0);
  const deckend = (a: Uint8Array): number => a.filter((v) => v >= 128).length / Math.max(a.length, 1);
  ck('C20 PK61 Anteil deckender Pixel (Alpha ≥ 128) zwischen 0,20 und 0,50 (18er und 36er; V1 0,380 und 0,321)',
    [deckend(a18), deckend(a36)].every((d) => d >= 0.2 && d <= 0.5));
  // 36er per 2 × 2-Kastenfilter auf 18 gerechnet gegen das 18er (Alpha 0–255): V1 0,218; um 1 Pixel versetzt 25,69
  let abw = Number.POSITIVE_INFINITY;
  if (a18.length === 324 && a36.length === 1296) {
    let s = 0;
    for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) {
      const m = (a36[2 * y * 36 + 2 * x] + a36[2 * y * 36 + 2 * x + 1] + a36[(2 * y + 1) * 36 + 2 * x] + a36[(2 * y + 1) * 36 + 2 * x + 1]) / 4;
      s += Math.abs(m - a18[y * 18 + x]);
    }
    abw = s / 324;
  }
  ck('C20 PK61 Retina-Fassung auf 18 gerechnet gleicht dem 18er (mittlere Abweichung unter 2 von 255)', abw < 2);
  const c18 = trayVorlagePng(1), c36 = trayVorlagePng(2);
  ck('C20 PK61 zweimal erzeugt byte-gleich (18er und 36er, auch nach der anderen Größe)', b18.equals(c18) && b36.equals(c36));
  // Zahl der Pixel mit Alpha, Alpha-Summe und die Lage-Momente Σa·x und Σa·y (x, y in Pixeln ab oben links). Die Momente
  // fangen eine gespiegelte, umgedrehte oder verschobene Zeichnung, bei der Zahl und Summe gleich bleiben (C20 Probe 23).
  const summe = (a: Uint8Array, k: number): string => {
    let n = 0, s = 0, sx = 0, sy = 0;
    for (let i = 0; i < a.length; i++) if (a[i] > 0) { n++; s += a[i]; sx += a[i] * (i % k); sy += a[i] * Math.floor(i / k); }
    return [n, s, sx, sy].join();
  };
  ck('C20 PK61 OFC5 V1: Zeichnung und Lage wie die Vorschau (18er 162 Pixel mit Alpha, Summe 26955, Momente x/y 234690/236060; 36er 481, 107766, 1930645/1940667)',
    summe(a18, 18) === '162,26955,234690,236060' && summe(a36, 36) === '481,107766,1930645,1940667');
  ck('C20 PK61 E59 Wahl je Plattform: darwin → Vorlagenbild; win32 und linux → Datei wie 0.3.0',
    traySymbolArt('darwin') === 'vorlage' && traySymbolArt('win32') === 'datei' && traySymbolArt('linux') === 'datei');

  // Quelltext (Electron läuft im Test nicht): tray.ts, index.ts, tray-symbol.ts
  const lies = (pf: string): string => readFileSync(new URL(pf, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const zaehle = (t: string, s: string): number => t.split(s).length - 1;
  const tray = lies('../src/main/tray.ts'), index = lies('../src/main/index.ts'), modul = lies('../src/main/tray-symbol.ts');
  const fn = (() => { const i = tray.indexOf('\nfunction trayBild('); return i < 0 ? '' : tray.slice(i, tray.indexOf('\n}\n', i) + 3); })();
  const kopf = "  if (traySymbolArt(process.platform) === 'vorlage') {\n";
  const iMac = fn.indexOf(kopf), jMac = iMac < 0 ? -1 : fn.indexOf('\n  }\n', iMac);
  const mac = jMac < 0 ? '' : fn.slice(iMac, jMac + 5), sonst = jMac < 0 ? '' : fn.slice(jMac + 5);
  ck('C20 PK61 E59 tray.ts: unter macOS 18er (scaleFactor 1) und 36er (addRepresentation, scaleFactor 2), setTemplateImage(true) nur dort, kein resize',
    mac.includes('nativeImage.createFromBuffer(trayVorlagePng(1), { scaleFactor: 1 })')
      && /\.addRepresentation\(\{ scaleFactor: 2, dataURL: `data:image\/png;base64,\$\{trayVorlagePng\(2\)\.toString\('base64'\)\}` \}\)/.test(mac)
      && mac.includes('bild.setTemplateImage(true);') && zaehle(tray, '.setTemplateImage(') === 1 && !mac.includes('resize('));
  ck('C20 PK61 E59 tray.ts: unter macOS bei leerem Vorlagenbild eine Logzeile und weiter wie 0.3.0 (kein leeres Tray-Symbol)',
    mac.endsWith("    if (!bild.isEmpty()) return bild;\n    getLog().warn('[tray] Vorlagenbild der Menüleiste ist leer (#277); Tray-Symbol wie 0.3.0 aus icon.png');\n  }\n"));
  ck('C20 PK61 E59 tray.ts: sonst wie 0.3.0 (createFromPath mit iconPath, leeres Bild ohne Datei), der Tray nimmt nur trayBild(deps.iconPath), kein setImage',
    sonst === '  const img = nativeImage.createFromPath(iconPath);\n  return img.isEmpty() ? nativeImage.createEmpty() : img;\n}\n'
      && zaehle(tray, 'nativeImage.createFromPath(') === 1 && tray.includes('  tray = new Tray(trayBild(deps.iconPath));\n')
      && zaehle(tray, 'new Tray(') === 1 && zaehle(tray, '.setImage(') === 0 && zaehle(tray, '.setPressedImage(') === 0);
  ck('C20 PK61 E59 index.ts: Fenster und Tray bekommen weiter iconPath() = resources/icon.png',
    zaehle(index, "return resourcePath('icon.png', join(__dirname, '..', '..', 'resources'));") === 1 && zaehle(index, 'iconPath: iconPath(),') === 2);
  ck('C20 PK61 G-C2: tray-symbol.ts rein (kein electron, keine Uhr, kein Zufall)',
    !/['"]electron(?:\/[^'"]*)?['"]|\bDate\b|\bperformance\b|perf_hooks|\bprocess\b|\bcrypto\b|\bMath\b(?!\.(?!random\b)[A-Za-z])/.test(modul));
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
