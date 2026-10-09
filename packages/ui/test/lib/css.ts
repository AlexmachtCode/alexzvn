// Liest Custom Properties (`--name: wert;`) aus CSS-Text. Nur für die Selbsttests (Bestand, Tokens, Kontrast).
// Erfasst werden die innersten Blöcke `selektor { … }`; ein umgebendes `@layer base { … }` fällt dabei weg.

export interface CssBlock {
  /** Whitespace-normalisiert, Teile mit „, “ verbunden, z. B. ':root, .dark' */
  selektor: string;
  werte: Record<string, string>;
}

function normalisiereSelektor(roh: string): string {
  return roh
    .split(',')
    .map((teil) => teil.trim().replace(/\s+/g, ' '))
    .join(', ');
}

export function leseCustomProperties(css: string): CssBlock[] {
  const text = css.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const bloecke: CssBlock[] = [];
  for (const block of text.matchAll(/([^{};]*)\{([^{}]*)\}/g)) {
    const werte: Record<string, string> = {};
    for (const wert of block[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      werte[wert[1]] = wert[2].trim().replace(/\s+/g, ' ');
    }
    bloecke.push({ selektor: normalisiereSelektor(block[1]), werte });
  }
  return bloecke;
}

/** Alle Werte der Blöcke mit genau diesem Selektor, in Dateireihenfolge (ein späterer Block überschreibt). */
export function tokenTabelle(css: string, selektor: string): Record<string, string> {
  const gesucht = normalisiereSelektor(selektor);
  const tabelle: Record<string, string> = {};
  for (const block of leseCustomProperties(css)) {
    if (block.selektor === gesucht) Object.assign(tabelle, block.werte);
  }
  return tabelle;
}
