// Task 4 · Kontrast der Token-Paare in Dunkel und Hell, gerechnet aus den oklch-Werten (Spec 4.2, 11; E3, G7).
// Klassen: Text 4,5 : 1 (WCAG 1.4.3), große Schrift 3 : 1 (ab 18,66 px fett), Grafik 3 : 1 (WCAG 1.4.11: Symbole,
// Ränder, Flächen). Neue Paare müssen ihre Klasse erfüllen. Bestands-Paare unter 4,5 sind Befunde: Ihr Wert ist
// festgeschrieben (±0,01), damit sich nichts unbemerkt verschiebt; ändern darf sie nur der Owner (Spec 4.1).
import { kontrast, loese, mische, modusTabelle, parseFarbe, type Rgb } from './lib/oklch';
import { gleich, ok } from './harness';

const zahl = (n: number): string => n.toFixed(2).replace('.', ',');
const grenzText = (n: number): string => String(n).replace('.', ',');

function farbe(wert: string): { rgb: Rgb; alpha: number } {
  const f = parseFarbe(wert);
  if (!f) throw new Error(`keine oklch-Farbe: ${wert}`);
  return f;
}

/** Fläche eines Tokens; eine durchscheinende Fläche wird über ihre Unterlage gemischt. */
function flaeche(name: string, tabelle: Record<string, string>, unterlage?: string): Rgb {
  const f = farbe(loese(name, tabelle));
  if (f.alpha >= 1) return f.rgb;
  if (unterlage === undefined) throw new Error(`${name} ist durchscheinend, die Unterlage fehlt`);
  return mische(f.rgb, f.alpha, flaeche(unterlage, tabelle));
}

function paar(tabelle: Record<string, string>, vorne: string, hinten: string, unterlage?: string): number {
  const h = flaeche(hinten, tabelle, unterlage);
  const v = farbe(loese(vorne, tabelle));
  return kontrast(v.alpha >= 1 ? v.rgb : mische(v.rgb, v.alpha, h), h);
}

// ── Werkzeug ──
{
  const weiss = farbe('oklch(1 0 0)').rgb;
  ok(Math.abs(kontrast(weiss, farbe('oklch(0 0 0)').rgb) - 21) <= 0.01, 'Kontrast: Referenz Weiß/Schwarz = 21,00');
  ok(Math.abs(kontrast(farbe('oklch(0.178 0 0)').rgb, weiss) - 18.87) <= 0.01, 'Kontrast: oklch(0.178 0 0) auf Weiß = 18,87');
  gleich(
    [parseFarbe('oklch(0.922 0.187 99.5 / 0.5)')?.alpha, parseFarbe('oklch(1 0 0)')?.alpha, parseFarbe('#ffffff'), parseFarbe('var(--x)')],
    [0.5, 1, null, null],
    'Kontrast: parseFarbe liest Alpha und lehnt andere Schreibweisen ab',
  );
  ok(loese('--primary', modusTabelle('dunkel')) === 'oklch(0.922 0.187 99.5)', 'Kontrast: loese folgt var()-Ketten (--primary → --brand-yellow)');
  let zyklus = '';
  let fehlt = '';
  try {
    loese('--a', { '--a': 'var(--b)', '--b': 'var(--a)' });
  } catch (e) {
    zyklus = (e as Error).message;
  }
  try {
    loese('--gibt-es-nicht', {});
  } catch (e) {
    fehlt = (e as Error).message;
  }
  ok(zyklus.startsWith('Zyklus') && fehlt.startsWith('unbekannt'), 'Kontrast: loese meldet Zyklus und unbekannten Namen');
}

// ── Neue Paare (müssen ihre Klasse erfüllen) ──
const GRENZE = { Text: 4.5, groß: 3, Grafik: 3 } as const;
type Klasse = keyof typeof GRENZE;

const NEUE_PAARE: Array<[vorne: string, hinten: string, klasse: Klasse]> = [
  ['--foreground', '--surface-raised', 'Text'],
  ['--muted-foreground', '--surface-raised', 'Text'],
  ['--primary-foreground', '--tally-selected', 'Text'],
  ['--brand-fg-on-dark', '--tally-live', 'groß'],
  // live-Eintrag der Statusleiste und live-StatusPill (E14): normale Schrift in Hintergrundfarbe auf der roten Fläche
  ['--background', '--tally-live', 'Text'],
  // Hover- und Sperrfläche der neuen Bausteine (E23): --muted statt --highlight
  ['--foreground', '--muted', 'Text'],
];
for (const zeichen of ['--tally-live', '--tally-ready', '--status-warn', '--status-error', '--status-off', '--tally-selected']) {
  for (const grund of ['--background', '--card', '--surface-raised']) NEUE_PAARE.push([zeichen, grund, 'Grafik']);
}
// Ränder auf der Hover-Fläche --muted: grüne Kante des TallyButton „bereit“ und Rand des ⚙ bei offenem Panel (Task 9, 14)
NEUE_PAARE.push(['--tally-ready', '--muted', 'Grafik'], ['--tally-selected', '--muted', 'Grafik']);
// Rand der Eingabefelder (Task 10, Fix-Runde 1): E3 verlangt für Ränder 3 : 1 gegen jede Fläche, auf der ein Feld steht,
// und gegen die eigene Füllung --input. --border (1,2 bis 1,4) und --input als Fläche reichen dafür nicht.
for (const grund of ['--background', '--card', '--surface-raised', '--input']) NEUE_PAARE.push(['--field-border', grund, 'Grafik']);
// Toggle 'aus' (Task 11, Fix-Runde 1): Kante --field-border und Knopf --muted-foreground auf der Spur --input, Knopf auch auf der Seitenfläche
NEUE_PAARE.push(['--muted-foreground', '--input', 'Grafik'], ['--muted-foreground', '--background', 'Grafik']);

for (const modus of ['dunkel', 'hell'] as const) {
  const tabelle = modusTabelle(modus);
  for (const [vorne, hinten, klasse] of NEUE_PAARE) {
    const wert = paar(tabelle, vorne, hinten);
    ok(
      wert >= GRENZE[klasse],
      `Kontrast ${modus}: ${vorne} auf ${hinten} ≥ ${grenzText(GRENZE[klasse])} (${klasse}) · ${zahl(wert)}`,
    );
  }
}

// Statussymbole stehen nie auf --muted: das ▲ von --status-warn erreichte dort hell nur 2,91 : 1 (Grafik 3 : 1). Deshalb
// hebt die Statusleiste einen Knopf beim Hover nur mit Unterstreichung hervor (E14, Task 8). Festgeschrieben wie ein
// Befund: Ändert sich der Wert, wird der Test rot, und die Entscheidung ist neu zu prüfen.
{
  const wert = paar(modusTabelle('hell'), '--status-warn', '--muted');
  ok(
    Math.abs(wert - 2.91) <= 0.01,
    `Kontrast hell: --status-warn auf --muted = 2,91, unter 3 (Grafik) – Statussymbole nie auf der Hover-Fläche (E14) · ${zahl(wert)}`,
  );
}

// ── Bestand: Text-Paare aus colors.css ──
const BESTAND: Array<[vorne: string, hinten: string, unterlage?: string]> = [
  ['--foreground', '--background'],
  ['--card-foreground', '--card'],
  ['--popover-foreground', '--popover'],
  ['--primary-foreground', '--primary'],
  ['--secondary-foreground', '--secondary'],
  ['--muted-foreground', '--background'],
  ['--muted-foreground', '--card'],
  ['--muted-foreground', '--secondary'],
  ['--muted-foreground', '--muted'],
  ['--destructive-foreground', '--destructive'],
  ['--accent-foreground', '--accent', '--background'],
  ['--accent-foreground', '--accent', '--card'],
  ['--success', '--background'],
  ['--warning', '--background'],
  // --highlight (Gelb mit 12 %) ist die Hover-Fläche von Button, Tabs und Modal. Gemessen über der Panel-Fläche und
  // der Karte; die neuen Bausteine nutzen es deshalb nicht (E23, Quellregel 8 in Task 3).
  ['--foreground', '--highlight', '--surface-raised'],
  ['--foreground', '--highlight', '--card'],
  ['--muted-foreground', '--highlight', '--surface-raised'],
  ['--muted-foreground', '--highlight', '--card'],
];

// Gemessen am Spec-Stand 5a14352934 (08.10.2026). Nicht änderbar in Welle 0 (Spec 4.1); der Owner entscheidet.
const BEFUND: Record<string, number> = {
  'dunkel: --destructive-foreground auf --destructive': 3.4,
  'dunkel: --accent-foreground auf --accent (über --background)': 4.08,
  'dunkel: --accent-foreground auf --accent (über --card)': 3.86,
  'dunkel: --muted-foreground auf --highlight (über --surface-raised)': 3.6,
  'dunkel: --muted-foreground auf --highlight (über --card)': 4.01,
  'hell: --success auf --background': 3.4,
  'hell: --warning auf --background': 2.54,
};

for (const modus of ['dunkel', 'hell'] as const) {
  const tabelle = modusTabelle(modus);
  for (const [vorne, hinten, unterlage] of BESTAND) {
    const schluessel = `${modus}: ${vorne} auf ${hinten}${unterlage ? ` (über ${unterlage})` : ''}`;
    const wert = paar(tabelle, vorne, hinten, unterlage);
    const befund = BEFUND[schluessel];
    if (befund !== undefined) {
      ok(Math.abs(wert - befund) <= 0.01, `Kontrast Bestand ${schluessel} = ${zahl(befund)} (Befund, festgeschrieben) · ${zahl(wert)}`);
      console.log(`Befund: ${schluessel} ${zahl(wert)} : 1, unter 4,5 für Text`);
    } else {
      ok(wert >= 4.5, `Kontrast Bestand ${schluessel} ≥ 4,5 (Text) · ${zahl(wert)}`);
    }
  }
}
