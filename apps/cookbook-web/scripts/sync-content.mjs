// Generiert die Starlight-Doku-Seiten aus dem kompilierten cookbook.json
// (Single Source of Truth). Reine Ableitung — die Quelle bleibt
// packages/cookbook/content/**.md. Wird vor `astro dev`/`astro build` ausgeführt.

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const COOKBOOK = JSON.parse(readFileSync(join(REPO, 'packages/cookbook/cookbook.json'), 'utf8'));
const DOCS = join(HERE, '..', 'src', 'content', 'docs');

let toolName = (id) => id;
try {
  const suite = JSON.parse(readFileSync(join(REPO, 'packages/suite-manifest/suite.json'), 'utf8'));
  const byId = new Map(suite.tools.map((t) => [t.id, t]));
  toolName = (id) => (byId.has(id) ? `${byId.get(id).name} — ${byId.get(id).tagline}` : id);
} catch {
  // suite.json nicht lesbar → IDs unverändert anzeigen
}

const CATEGORY_ORDER = ['Veranstaltungsformate', 'Technik-Setups', 'Kunden-/Location-Setups', 'Tool-Manuals', 'Best Practices'];
const CATEGORY_SLUG = {
  'Veranstaltungsformate': 'veranstaltungsformate',
  'Technik-Setups': 'technik-setups',
  'Kunden-/Location-Setups': 'kunden-location-setups',
  'Tool-Manuals': 'tool-manuals',
  'Best Practices': 'best-practices',
};
const OWNER_LABEL = { 'kunde-haus': 'Kunde / Haustechnik', jm: 'JM-Material', gemischt: 'Gemischt (Haus + JM)' };

function formatSetupTime(min) {
  if (min >= 1440) {
    const d = min / 1440;
    return Number.isInteger(d) ? `${d} ${d === 1 ? 'Tag' : 'Tage'}` : `${d.toFixed(1).replace('.', ',')} Tage`;
  }
  if (min >= 60) {
    const h = min / 60;
    return `${Number.isInteger(h) ? h : h.toFixed(1).replace('.', ',')} h`;
  }
  return `${min} min`;
}

const ystr = (s) => JSON.stringify(s); // JSON-String == gültiger YAML-Double-Quoted-Scalar

function recipePage(r) {
  const L = [];
  L.push('---');
  L.push(`title: ${ystr(r.title)}`);
  L.push(`description: ${ystr(r.summary)}`);
  L.push('---');
  L.push('');
  L.push('{/* Automatisch generiert aus packages/cookbook/cookbook.json — nicht direkt bearbeiten. */}');
  L.push('');
  // Doc-Einträge (Best Practices): Inhalt ist Roh-Markdown statt Rezept-Blöcken.
  if (r.markdown) {
    L.push(`**Kategorie:** ${r.category} · **Schwierigkeit:** ${r.difficulty}`);
    L.push('');
    L.push(r.markdown);
    L.push('');
    L.push('---');
    L.push('');
    L.push(`*Zuletzt geprüft: ${r.lastReviewed} · Verantwortlich: ${r.owner}*`);
    L.push('');
    return L.join('\n');
  }
  const meta = [
    `**Kategorie:** ${r.category}`,
    `**Schwierigkeit:** ${r.difficulty}`,
    `**Aufbauzeit:** ${formatSetupTime(r.setupTimeMin)}`,
    `**Team:** ${r.teamSize}`,
    `**Equipment:** ${OWNER_LABEL[r.equipmentOwner] ?? r.equipmentOwner}`,
  ];
  if (r.location) meta.push(`**Location:** ${r.location}`);
  L.push(meta.join(' · '));
  L.push('');
  if (r.crewRoles?.length) {
    L.push(`**Crew:** ${r.crewRoles.join(' · ')}`);
    L.push('');
  }
  if (r.relatedTools?.length) {
    L.push('## Passende JM-Tools');
    for (const id of r.relatedTools) L.push(`- ${toolName(id)}`);
    L.push('');
  }
  if (r.prerequisites?.length) {
    L.push('## Voraussetzungen');
    for (const p of r.prerequisites) L.push(`- ${p}`);
    L.push('');
  }
  L.push('## Zutaten');
  for (const g of r.blocks.ingredients) {
    L.push(`### ${g.title}`);
    for (const it of g.items) L.push(`- ${it}`);
    L.push('');
  }
  L.push('## Schritt-für-Schritt');
  for (const [name, items] of [
    ['Vorbereitung', r.blocks.steps.vor],
    ['Während', r.blocks.steps.waehrend],
    ['Nachbereitung', r.blocks.steps.nach],
  ]) {
    if (!items.length) continue;
    L.push(`### ${name}`);
    items.forEach((it, i) => L.push(`${i + 1}. ${it}`));
    L.push('');
  }
  if (r.blocks.tips?.length) {
    L.push('## Profi-Tipps');
    for (const t of r.blocks.tips) L.push(`- ${t}`);
    L.push('');
  }
  if (r.blocks.troubleshooting?.length) {
    L.push('## Pannenhilfe');
    L.push('| Risiko | Gegenmaßnahme |');
    L.push('| --- | --- |');
    for (const row of r.blocks.troubleshooting) L.push(`| ${row.risk} | ${row.remedy} |`);
    L.push('');
  }
  if (r.blocks.checklists?.length) {
    L.push('## Checklisten');
    for (const c of r.blocks.checklists) {
      L.push(`### ${c.title}`);
      for (const it of c.items) L.push(`- [ ] ${it}`);
      L.push('');
    }
  }
  L.push('---');
  L.push('');
  L.push(`*Zuletzt geprüft: ${r.lastReviewed} · Verantwortlich: ${r.owner}*`);
  L.push('');
  return L.join('\n');
}

function indexPage(recipes) {
  const L = [];
  L.push('---');
  L.push('title: JM Kochbuch');
  L.push('description: Internes Nachschlagewerk — Best Practices und Manuals der Jakobs Medien GmbH.');
  L.push('---');
  L.push('');
  L.push('Willkommen im **JM Kochbuch** — dem internen Nachschlagewerk für Best Practices und Manuals.');
  L.push('Jedes Rezept folgt demselben Schema: Zutaten, Aufbauzeit, Schritt-für-Schritt, Pannenhilfe und Checklisten.');
  L.push('');
  for (const cat of CATEGORY_ORDER) {
    const inCat = recipes.filter((r) => r.category === cat);
    if (!inCat.length) continue;
    L.push(`## ${cat}`);
    for (const r of inCat) L.push(`- [${r.title}](/${CATEGORY_SLUG[cat]}/${r.id}/) — ${r.summary}`);
    L.push('');
  }
  return L.join('\n');
}

// docs frisch aufbauen (Stale-Dateien vermeiden)
rmSync(DOCS, { recursive: true, force: true });
mkdirSync(DOCS, { recursive: true });
// alle Kategorie-Ordner anlegen, auch leere — sonst bricht Starlights
// `autogenerate` bei einem fehlenden Verzeichnis ab.
for (const slug of Object.values(CATEGORY_SLUG)) mkdirSync(join(DOCS, slug), { recursive: true });
writeFileSync(join(DOCS, 'index.md'), indexPage(COOKBOOK.recipes));
for (const r of COOKBOOK.recipes) {
  const dir = join(DOCS, CATEGORY_SLUG[r.category] ?? 'sonstige');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${r.id}.md`), recipePage(r));
}
console.log(`Starlight-Seiten generiert: ${COOKBOOK.recipes.length} Rezepte + Index.`);
