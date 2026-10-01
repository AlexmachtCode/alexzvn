import { randomBytes } from 'node:crypto';
import { abschnitt, gleich, pruefe } from './helfer';
import { CODE_ALPHABET, CODE_LAENGE, erzeugeCode, normalisiereCode, zeigeCode } from '../src/code';
import { GRENZEN, kuerzeName } from '../src/fristen';

/** Chi-Quadrat über die Zeichen von `anzahlCodes` Codes (31 Eimer). */
function chiQuadrat(erzeuge: () => string, anzahlCodes: number): number {
  const zaehler = new Array<number>(CODE_ALPHABET.length).fill(0);
  let n = 0;
  for (let i = 0; i < anzahlCodes; i++) {
    for (const z of erzeuge()) {
      zaehler[CODE_ALPHABET.indexOf(z)]++;
      n++;
    }
  }
  const erwartet = n / CODE_ALPHABET.length;
  return zaehler.reduce((s, x) => s + (x - erwartet) ** 2 / erwartet, 0);
}

export async function laufe(): Promise<void> {
  abschnitt('Code');
  gleich(CODE_ALPHABET.length, 31, 'Alphabet hat 31 Zeichen');
  pruefe(!/[01ILO]/.test(CODE_ALPHABET), 'Alphabet ohne Verwechsler 0 1 I L O');

  const c = erzeugeCode();
  gleich(c.length, CODE_LAENGE, 'Code hat 10 Zeichen');
  pruefe([...c].every((z) => CODE_ALPHABET.includes(z)), 'Code nur aus dem Alphabet');
  gleich(zeigeCode('K7QXM3PRTH'), 'K7QXM-3PRTH', 'Anzeige mit Bindestrich in der Mitte');

  gleich(normalisiereCode('k7qxm-3prth'), { ok: true, code: 'K7QXM3PRTH' }, 'klein + Bindestrich wird normalisiert');
  gleich(normalisiereCode(' K7QXM 3PRTH '), { ok: true, code: 'K7QXM3PRTH' }, 'Leerzeichen fallen weg');
  gleich(normalisiereCode('K7QXO3PRTH'), { ok: false, grund: 'zeichen', zeichen: 'O' }, 'O wird lokal als fremdes Zeichen gemeldet');
  gleich(normalisiereCode('k7qxm3prtl'), { ok: false, grund: 'zeichen', zeichen: 'l' }, 'Originalschreibweise wird gemeldet');
  gleich(normalisiereCode('K7QXM'), { ok: false, grund: 'laenge', laenge: 5 }, 'zu kurz → Länge');
  gleich(normalisiereCode('K7QXM3PRTHA'), { ok: false, grund: 'laenge', laenge: 11 }, 'zu lang → Länge');
  gleich(normalisiereCode('K7QXM3PRTß'), { ok: false, grund: 'zeichen', zeichen: 'ß' }, 'ß (Großschreibung „SS“) ist kein Codezeichen');
  gleich(normalisiereCode('K7QXM3PRTﬆ'), { ok: false, grund: 'zeichen', zeichen: 'ﬆ' }, 'Ligatur ﬆ (groß „ST“) ist kein Codezeichen');

  // Verteilung: fair (randomInt) besteht χ² < 80 (df = 30, p ≈ 1e-6), die typische
  // Verzerrung randomBytes % 31 fällt durch (gemessen: min. χ² 242 in 50 Läufen).
  const fair = chiQuadrat(() => erzeugeCode(), 10_000);
  pruefe(fair < 80, `Verteilung fair: χ² = ${fair.toFixed(1)} < 80`);
  const verzerrt = chiQuadrat(() => erzeugeCode((max) => randomBytes(1)[0] % max), 10_000);
  pruefe(verzerrt > 80, `Gegenprobe randomBytes % 31 fällt durch: χ² = ${verzerrt.toFixed(1)} > 80`);

  abschnitt('Namen');
  gleich(kuerzeName('  Regie-PC  '), 'Regie-PC', 'Name wird getrimmt');
  gleich(kuerzeName(''), 'Unbenannt', 'leerer Name → „Unbenannt“');
  const lang = 'Ü'.repeat(80);
  gleich([...kuerzeName(lang)].length, GRENZEN.maxNamenLaenge, 'langer Name auf 60 Zeichen gekürzt');
  const emoji = '🎬'.repeat(70);
  gleich([...kuerzeName(emoji)].length, 60, 'Emoji werden als ganze Zeichen gezählt');

  // Endprüfung A6: Fremdnamen landen im zeilenbasierten Log und in der Oberfläche — Steuer-/Formatzeichen raus.
  gleich(kuerzeName('Regie\nPC'), 'Regie PC', 'Zeilenumbruch → Leerzeichen (keine gefälschte Logzeile)');
  gleich(kuerzeName('Regie\r\n2026-01-01 [ERROR] x'), 'Regie 2026-01-01 [ERROR] x', 'CR LF → ein Leerzeichen');
  gleich(kuerzeName('A\u001b[31mB'), 'A [31mB', 'ESC (Terminal-Steuerfolge) → Leerzeichen');
  gleich(kuerzeName('\u202eevil.exe'), 'evil.exe', 'Bidi-Override U+202E fällt weg (verdreht sonst Namen in Listen)');
  gleich(kuerzeName('a\u2028b\u2029c\u0085d\u200be'), 'a b c d e', 'U+2028/2029, NEL und Nullbreite → Leerzeichen');
  gleich(kuerzeName('  a \t\t \n b  '), 'a b', 'mehrfache Leerräume zusammengezogen, getrimmt');
  gleich(kuerzeName('\n\u001b\u202e\t'), 'Unbenannt', 'nur Steuerzeichen → „Unbenannt“');
  gleich(kuerzeName(`${'x'.repeat(59)} yz`), 'x'.repeat(59), 'nach dem Kürzen erneut getrimmt (kein Leerzeichen am Ende)');
}
