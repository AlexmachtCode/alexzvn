// Geteilter Rezept-Kern — PURES ESM ohne Node-APIs, läuft sowohl im Compiler
// (Node) als auch im Release-Proxy (Cloudflare Worker). Enthält das Schema, die
// Validierung eines Rezept-Objekts und das Rendern in eine `.md`-Quelle.
//
// Arbeitsteilung: Der KI-Authoring-Flow lässt Claude ein Recipe-JSON liefern →
// validateRecipe() prüft es → renderRecipeMarkdown() erzeugt die `.md` für den PR.
// Der Markdown-Parser (gray-matter) lebt separat in recipe-parse.mjs (nur Node).

export const CATEGORIES = ['Veranstaltungsformate', 'Technik-Setups', 'Kunden-/Location-Setups', 'Tool-Manuals', 'Best Practices'];
export const DIFFICULTIES = ['einfach', 'mittel', 'anspruchsvoll', 'profi'];
export const OWNERS = ['kunde-haus', 'jm', 'gemischt'];

/**
 * „Best Practices" trägt SOPs/Notfall-Flowcharts, die nicht ins Rezept-Template
 * (Zutaten/Schritte/…) passen. Solche Einträge führen ihren Inhalt als Roh-
 * Markdown im `markdown`-Feld (statt in `blocks`); der Launcher-Reader und die
 * Website rendern dann das Markdown. Frontmatter bleibt vollständig (Default-
 * Werte für die rezept-spezifischen Felder), damit Schema/Validierung greifen.
 */
export const DOC_CATEGORIES = ['Best Practices'];

/** Kategorie → Ordner-Slug unter content/. */
export const CATEGORY_SLUG = {
  'Veranstaltungsformate': 'veranstaltungsformate',
  'Technik-Setups': 'technik-setups',
  'Kunden-/Location-Setups': 'kunden-location-setups',
  'Tool-Manuals': 'tool-manuals',
  'Best Practices': 'best-practices',
};

const REQUIRED = ['id', 'title', 'category', 'difficulty', 'setupTimeMin', 'teamSize', 'equipmentOwner', 'lastReviewed', 'owner', 'summary'];

/**
 * Validiert ein Rezept-Objekt gegen das Schema.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateRecipe(r) {
  const e = [];
  if (!r || typeof r !== 'object') return { ok: false, errors: ['Rezept ist kein Objekt'] };
  const id = r.id || '(ohne id)';

  for (const k of REQUIRED) {
    if (r[k] === undefined || r[k] === null || r[k] === '') e.push(`${id}: Pflichtfeld fehlt: ${k}`);
  }
  if (r.id && !/^[a-z0-9-]+$/.test(r.id)) e.push(`${id}: id muss kebab-case sein (nur a-z, 0-9, -)`);
  if (r.category !== undefined && !CATEGORIES.includes(r.category)) e.push(`${id}: ungültige category: ${r.category}`);
  if (r.difficulty !== undefined && !DIFFICULTIES.includes(r.difficulty)) e.push(`${id}: ungültige difficulty: ${r.difficulty}`);
  if (r.equipmentOwner !== undefined && !OWNERS.includes(r.equipmentOwner)) e.push(`${id}: ungültiger equipmentOwner: ${r.equipmentOwner}`);
  if (r.setupTimeMin !== undefined && (typeof r.setupTimeMin !== 'number' || !Number.isFinite(r.setupTimeMin))) {
    e.push(`${id}: setupTimeMin muss eine Zahl (Minuten) sein`);
  }
  for (const k of ['tags', 'relatedTools', 'prerequisites', 'crewRoles']) {
    if (r[k] !== undefined && !Array.isArray(r[k])) e.push(`${id}: ${k} muss eine Liste sein`);
  }

  const b = r.blocks;
  if (!b || typeof b !== 'object') {
    e.push(`${id}: blocks fehlt`);
  } else {
    if (!Array.isArray(b.ingredients)) e.push(`${id}: blocks.ingredients muss eine Liste sein`);
    if (!b.steps || typeof b.steps !== 'object') {
      e.push(`${id}: blocks.steps fehlt`);
    } else {
      for (const p of ['vor', 'waehrend', 'nach']) {
        if (b.steps[p] !== undefined && !Array.isArray(b.steps[p])) e.push(`${id}: blocks.steps.${p} muss eine Liste sein`);
      }
    }
    if (b.troubleshooting !== undefined && !Array.isArray(b.troubleshooting)) e.push(`${id}: blocks.troubleshooting muss eine Liste sein`);
    if (b.checklists !== undefined && !Array.isArray(b.checklists)) e.push(`${id}: blocks.checklists muss eine Liste sein`);
  }
  return { ok: e.length === 0, errors: e };
}

// YAML-Double-Quoted-Scalar (JSON-String ist gültiges YAML) — robust für alle Inhalte.
const q = (s) => JSON.stringify(String(s ?? ''));

/**
 * Rendert ein Rezept-Objekt in eine `.md`-Quelle (Frontmatter + Template-Blöcke),
 * die der Compiler (recipe-parse.mjs) wieder identisch einliest (Round-Trip).
 */
export function renderRecipeMarkdown(r) {
  const b = r.blocks || {};
  const L = [];
  L.push('---');
  L.push(`id: ${r.id}`);
  L.push(`title: ${q(r.title)}`);
  L.push(`category: ${r.category}`);
  L.push(`difficulty: ${r.difficulty}`);
  L.push(`setupTimeMin: ${Number(r.setupTimeMin) || 0}`);
  L.push(`teamSize: ${q(r.teamSize)}`);
  L.push(`tags: [${(r.tags || []).map(q).join(', ')}]`);
  L.push(`relatedTools: [${(r.relatedTools || []).map(q).join(', ')}]`);
  L.push('prerequisites:');
  for (const p of r.prerequisites || []) L.push(`  - ${q(p)}`);
  L.push(`equipmentOwner: ${r.equipmentOwner}`);
  L.push('crewRoles:');
  for (const c of r.crewRoles || []) L.push(`  - ${q(c)}`);
  if (r.location) L.push(`location: ${q(r.location)}`);
  L.push(`lastReviewed: ${q(r.lastReviewed)}`);
  L.push(`owner: ${r.owner}`);
  L.push(`summary: ${q(r.summary)}`);
  L.push('---');
  L.push('');

  L.push('## Zutaten');
  L.push('');
  for (const g of b.ingredients || []) {
    L.push(`### ${g.title}`);
    for (const it of g.items || []) L.push(`- ${it}`);
    L.push('');
  }

  L.push('## Schritt-für-Schritt');
  L.push('');
  const steps = b.steps || {};
  for (const [name, items] of [['Vorbereitung', steps.vor], ['Während', steps.waehrend], ['Nachbereitung', steps.nach]]) {
    if (!items || !items.length) continue;
    L.push(`### ${name}`);
    for (const it of items) L.push(`- ${it}`);
    L.push('');
  }

  if (b.tips && b.tips.length) {
    L.push('## Profi-Tipps');
    for (const t of b.tips) L.push(`- ${t}`);
    L.push('');
  }

  if (b.troubleshooting && b.troubleshooting.length) {
    L.push('## Pannenhilfe');
    L.push('');
    L.push('| Risiko | Gegenmaßnahme |');
    L.push('| --- | --- |');
    for (const row of b.troubleshooting) L.push(`| ${row.risk} | ${row.remedy} |`);
    L.push('');
  }

  if (b.checklists && b.checklists.length) {
    L.push('## Checklisten');
    L.push('');
    for (const c of b.checklists) {
      L.push(`### ${c.title}`);
      for (const it of c.items || []) L.push(`- [ ] ${it}`);
      L.push('');
    }
  }

  return L.join('\n') + '\n';
}
