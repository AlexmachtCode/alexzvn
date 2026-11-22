// Testhilfen der Interpreter-Oberflächentests (UX Welle 2a, Aufgabe b): feste Zustände und Attrappen für Render- und
// Ableitungstests. Wächst mit den Aufgaben c bis d.

/** Quelltext ohne Kommentare (Zeilen- und Blockkommentare), für Prüfungen am Code. */
export function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
