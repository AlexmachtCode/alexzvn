// Kochbuch-Compiler: liest die Markdown-Quellen unter content/**, validiert sie
// gegen das Schema (recipe-core) und schreibt cookbook.json (gebündelte/Proxy-
// Quelle, analog suite.json).
//
//   node src/build.mjs           # cookbook.json schreiben
//   node src/build.mjs --check   # nur prüfen, ob cookbook.json frisch ist (CI)
//
// Parsing lebt in recipe-parse.mjs (gray-matter, Node), Schema/Validierung in
// recipe-core.mjs (pur, auch im Worker nutzbar).

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, validateRecipe } from './recipe-core.mjs';
import { parseRecipeMarkdown } from './recipe-parse.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(HERE, '..'); // packages/cookbook
const CONTENT_DIR = join(PKG_ROOT, 'content');
const OUT_FILE = join(PKG_ROOT, 'cookbook.json');
const SCHEMA_VERSION = 1;

const CHECK = process.argv.includes('--check');
const errors = [];
const warnings = [];

/** Alle .md-Dateien unter content/ rekursiv, sortiert (deterministisch). */
function findMarkdown(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findMarkdown(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out.sort();
}

// --- optionale Soft-Validierung der Tool-Deep-Links gegen suite.json ---
let knownToolIds = null;
try {
  const suite = JSON.parse(readFileSync(join(PKG_ROOT, '..', 'suite-manifest', 'suite.json'), 'utf8'));
  knownToolIds = new Set(suite.tools.map((t) => t.id));
} catch {
  // suite-manifest nicht lesbar → Deep-Link-Prüfung überspringen
}

const files = findMarkdown(CONTENT_DIR);
if (files.length === 0) {
  console.error(`Keine Rezepte in ${CONTENT_DIR} gefunden.`);
  process.exit(1);
}

const recipes = [];
for (const file of files) {
  const fileId = basename(file, '.md');
  const recipe = parseRecipeMarkdown(readFileSync(file, 'utf8'));

  // Schema-Validierung (geteilt mit dem Authoring-Flow) + datei-spezifische Checks.
  errors.push(...validateRecipe(recipe).errors);
  if (recipe.id !== fileId) errors.push(`${fileId}: id "${recipe.id}" != Dateiname "${fileId}"`);
  if (knownToolIds) {
    for (const tid of recipe.relatedTools) {
      if (!knownToolIds.has(tid)) warnings.push(`${fileId}: relatedTools verweist auf unbekanntes Tool "${tid}"`);
    }
  }
  // Doc-Einträge (Best Practices) tragen ihren Inhalt als Roh-`markdown`, nicht in
  // den Rezept-Blöcken → die Zutaten/Schritte-Warnungen hier nicht anwenden.
  if (!recipe.markdown) {
    if (recipe.blocks.ingredients.length === 0) warnings.push(`${fileId}: keine Zutaten-Gruppen gefunden`);
    const s = recipe.blocks.steps;
    if (!s.vor.length && !s.waehrend.length && !s.nach.length) warnings.push(`${fileId}: keine Schritte gefunden`);
  }

  recipes.push(recipe);
}

if (errors.length) {
  console.error('Kochbuch-Build fehlgeschlagen:');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

// deterministische Reihenfolge: nach Kategorie-Reihenfolge, dann Titel
recipes.sort((a, b) => {
  const ci = CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category);
  return ci !== 0 ? ci : a.title.localeCompare(b.title, 'de');
});

// updatedAt deterministisch aus dem jüngsten lastReviewed (sonst wäre --check nie frisch)
const updatedAt = `${recipes.map((r) => r.lastReviewed).sort().at(-1)}T00:00:00.000Z`;
const cookbook = { schemaVersion: SCHEMA_VERSION, updatedAt, recipes };
const json = JSON.stringify(cookbook, null, 2) + '\n';

for (const w of warnings) console.warn('  ! ' + w);

if (CHECK) {
  const current = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, 'utf8') : '';
  if (current !== json) {
    console.error('cookbook.json ist veraltet — bitte `npm run cookbook:build` ausführen und committen.');
    process.exit(1);
  }
  console.log(`cookbook.json ist frisch (${recipes.length} Rezepte).`);
} else {
  writeFileSync(OUT_FILE, json);
  console.log(`cookbook.json geschrieben: ${recipes.length} Rezepte.`);
}
