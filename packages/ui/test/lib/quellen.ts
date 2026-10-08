// Dateilisten und Hashes für Bestandsschutz (Task 2) und Quellregeln (Task 3). Pfade relativ zu packages/ui.
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';

/** SHA-256 (hex) über den Text mit \n statt \r\n: gleich unter Windows (CRLF im Arbeitsbaum) und Linux (CI). */
export function quellHash(text: string): string {
  return createHash('sha256').update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

/** Spec 4.1 / G2: diese Dateien bleiben bytegleich (nach LF-Normalisierung). */
export const BESTAND_DATEIEN: readonly string[] = [
  'src/components/Badge.tsx',
  'src/components/Button.tsx',
  'src/components/Card.tsx',
  'src/components/Collapsible.tsx',
  'src/components/Logo.tsx',
  'src/components/Modal.tsx',
  'src/components/SettingsSection.tsx',
  'src/components/Splitter.tsx',
  'src/components/Tabs.tsx',
  'src/lib/cn.ts',
  'src/lib/titlebar.ts',
  'src/tokens/colors.css',
  'src/tokens/typography.css',
];

/** Die einzigen zwei Zeilen, die base.css bekommt (Task 3, direkt nach `@import "./tokens/typography.css";`). */
export const NEUE_BASE_IMPORTE: readonly string[] = [
  '@import "./tokens/signal-colors.css";',
  '@import "./tokens/sizes.css";',
];

/** Alle Dateien unter src/ außer dem Bestand, base.css und index.ts, sortiert. Wächst mit jeder neuen Datei mit. */
export function neueQuellen(): string[] {
  const alle: string[] = [];
  const lauf = (ordner: string): void => {
    for (const eintrag of readdirSync(ordner, { withFileTypes: true })) {
      const pfad = `${ordner}/${eintrag.name}`;
      if (eintrag.isDirectory()) lauf(pfad);
      else alle.push(pfad);
    }
  };
  lauf('src');
  const ausgenommen = new Set<string>([...BESTAND_DATEIEN, 'src/base.css', 'src/index.ts']);
  return alle.filter((pfad) => !ausgenommen.has(pfad)).sort();
}
