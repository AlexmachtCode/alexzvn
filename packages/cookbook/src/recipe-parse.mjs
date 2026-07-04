// Node-seitiger Rezept-Parser: `.md`-Quelle → Rezept-Objekt. Nutzt gray-matter
// (js-yaml) fürs Frontmatter und einen zeilenbasierten Parser für die Template-
// Blöcke. Bewusst getrennt von recipe-core.mjs, weil gray-matter Node-spezifisch
// ist — der Worker nutzt nur recipe-core (validate + render).

import matter from 'gray-matter';
import { DOC_CATEGORIES } from './recipe-core.mjs';

/** YAML-Datum (js-yaml liefert ein Date) → ISO-Datumsstring YYYY-MM-DD. */
function toDateStr(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

const listItem = (line) => {
  // "- text", "* text", "- [ ] text", "- [x] text"
  const m = line.match(/^\s*[-*]\s+(?:\[[ xX]\]\s+)?(.*\S)\s*$/);
  return m ? m[1] : null;
};

const tableCells = (line) => {
  const t = line.trim();
  if (!t.startsWith('|')) return null;
  return t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
};

const isSeparatorRow = (cells) => cells.every((c) => /^:?-{2,}:?$/.test(c));

/** Body in Abschnitte (## ) mit Unterabschnitten (### ), Listen und Tabellen zerlegen. */
function parseBody(body) {
  const sections = [];
  let section = null;
  let sub = null;
  for (const raw of body.split(/\r?\n/)) {
    const t = raw.trim();
    if (t.startsWith('## ')) {
      section = { h2: t.slice(3).trim(), items: [], rows: [], subs: [] };
      sub = null;
      sections.push(section);
      continue;
    }
    if (t.startsWith('### ')) {
      sub = { h3: t.slice(4).trim(), items: [], rows: [] };
      if (section) section.subs.push(sub);
      continue;
    }
    if (!section) continue;
    const target = sub ?? section;
    const li = listItem(raw);
    if (li !== null) {
      target.items.push(li);
      continue;
    }
    const cells = tableCells(raw);
    if (cells && !isSeparatorRow(cells)) target.rows.push(cells);
  }
  return sections;
}

/** Abschnitte → strukturierte Blöcke (das Rezept-Template). Pure. */
function buildBlocks(sections) {
  const find = (pred) => sections.find((s) => pred(s.h2.toLowerCase()));
  const ing = find((h) => h.includes('zutat'));
  const steps = find((h) => h.includes('schritt'));
  const tipsSec = find((h) => h.includes('tipp'));
  const trouble = find((h) => h.includes('panne'));
  const check = find((h) => h.includes('checklist'));

  const phase = (sec, pred) => sec?.subs.find((x) => pred(x.h3.toLowerCase()))?.items ?? [];

  const blocks = {
    ingredients: ing ? ing.subs.map((s) => ({ title: s.h3, items: s.items })) : [],
    steps: {
      // Phasen-Überschriften großzügig erkennen: die Manuals nutzen „Einrichtung"
      // (Vorbereitung), „Während" und „Nachbereitung"/„Export"/„Ausgabe".
      vor: phase(steps, (h) => h.includes('vorbereit') || h.includes('einricht')),
      waehrend: phase(steps, (h) => h.includes('während') || h.includes('waehrend') || h.includes('live') || h.includes('betrieb')),
      nach: phase(steps, (h) => h.includes('nachbereit') || h.includes('ausgabe') || h.includes('export')),
    },
    // rows[0] ist die Tabellen-Kopfzeile; die Trennzeile wurde schon gefiltert.
    troubleshooting: trouble ? trouble.rows.slice(1).map((r) => ({ risk: r[0], remedy: r[1] ?? '' })) : [],
    checklists: check ? check.subs.map((s) => ({ title: s.h3, items: s.items })) : [],
  };
  const tips = tipsSec ? tipsSec.items : [];
  if (tips.length) blocks.tips = tips;
  return blocks;
}

/** Frontmatter (data) + kompilierte Blöcke → Rezept-Objekt (feste Feldreihenfolge). */
function toRecipe(data, blocks) {
  const recipe = {
    id: data.id,
    title: data.title,
    category: data.category,
    difficulty: data.difficulty,
    setupTimeMin: data.setupTimeMin,
    teamSize: String(data.teamSize),
    tags: data.tags ?? [],
    relatedTools: data.relatedTools ?? [],
    prerequisites: data.prerequisites ?? [],
    equipmentOwner: data.equipmentOwner,
    crewRoles: data.crewRoles ?? [],
    lastReviewed: toDateStr(data.lastReviewed),
    owner: data.owner,
    summary: data.summary,
    blocks,
  };
  if (data.location) recipe.location = data.location;
  return recipe;
}

/** `.md`-Quelltext → Rezept-Objekt. */
export function parseRecipeMarkdown(md) {
  const { data, content } = matter(md);
  const recipe = toRecipe(data, buildBlocks(parseBody(content)));
  // Doc-Kategorien (Best Practices): der Inhalt steckt im Roh-Markdown, nicht in
  // den Rezept-Blöcken → Body als `markdown` mitführen, damit Launcher/Website ihn
  // rendern. Für normale Rezepte NICHT gespeichert (cookbook.json bleibt schlank).
  if (DOC_CATEGORIES.includes(data.category) && content?.trim()) {
    recipe.markdown = content.trim();
  }
  return recipe;
}
