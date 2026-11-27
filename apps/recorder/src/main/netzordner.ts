// Bestätigte Netzwerkordner (Altfehler RE-7b, B4): je Pfad gemerkt in `recorder-netzordner.json` unter userData (main/ipc.ts). Ohne
// Electron, damit der Test sie mit einer Temp-Datei prüft. Die Datei liegt lokal; Laden und Vergleichen greifen nie auf das Netz zu.
// Geschrieben wie die Einstellungen (main/einstellungen.ts): erst in eine Zwischendatei, dann umbenennen.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { normiereOrdner } from '../shared/netzordner';

export class NetzordnerListe {
  /** Normierte Form → Pfad, wie er zuerst bestätigt wurde. */
  private ordner = new Map<string, string>();

  constructor(private readonly datei: string) {}

  /** Liest die Datei `{ version: 1, ordner: string[] }`; fehlt sie, ist sie kaputt oder fremd, ist die Liste leer. */
  laden(): void {
    this.ordner = new Map();
    let roh: unknown;
    try {
      roh = JSON.parse(readFileSync(this.datei, 'utf8'));
    } catch {
      return;
    }
    const r = roh as { version?: unknown; ordner?: unknown } | null;
    if (!r || typeof r !== 'object' || r.version !== 1 || !Array.isArray(r.ordner)) return;
    for (const p of r.ordner) {
      if (typeof p === 'string' && p !== '' && !this.ordner.has(normiereOrdner(p))) this.ordner.set(normiereOrdner(p), p);
    }
  }

  /** Ist der Ordner bestätigt? Verglichen normiert (Schrägstriche, Groß/Klein, `\` am Ende). */
  enthaelt(p: string): boolean {
    return this.ordner.has(normiereOrdner(p));
  }

  /** Merkt den Ordner als bestätigt und schreibt die Datei; ein schon bekannter Ordner schreibt nichts. Schreibfehler gehen an den Aufrufer. */
  merke(p: string): void {
    const n = normiereOrdner(p);
    if (this.ordner.has(n)) return;
    this.ordner.set(n, p);
    mkdirSync(dirname(this.datei), { recursive: true });
    const tmp = `${this.datei}.tmp`;
    writeFileSync(tmp, JSON.stringify({ version: 1, ordner: [...this.ordner.values()] }, null, 2), 'utf8');
    renameSync(tmp, this.datei);
  }
}
