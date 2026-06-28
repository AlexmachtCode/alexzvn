/**
 * Datenmodell des JM Kochbuchs. Stil bewusst analog zu `@jm/suite-manifest`
 * (deutsche Doc-Kommentare, `schemaVersion` + `updatedAt`), damit Content
 * gebündelt (Offline) und live per Release-Proxy nachladbar ist.
 *
 * Die Blöcke sind strukturierte Daten (keine HTML-Strings) — so rendert der
 * Launcher ohne Markdown-Renderer und ohne `dangerouslySetInnerHTML`. Der
 * Markdown-Compiler (Phase 2) erzeugt exakt diese Struktur aus den `.md`-Quellen.
 */

/** Kategorien für die Gruppierung im Kochbuch-Reader. */
export type CookbookCategory =
  | 'Veranstaltungsformate'
  | 'Technik-Setups'
  | 'Kunden-/Location-Setups'
  | 'Tool-Manuals'
  /** SOPs / Notfall-Flowcharts. Führen ihren Inhalt als Roh-`markdown` (statt
   *  strukturierter `blocks`); Launcher/Website rendern das Markdown. */
  | 'Best Practices';

/** Schwierigkeitsgrad eines Rezepts. */
export type Difficulty = 'einfach' | 'mittel' | 'anspruchsvoll' | 'profi';

/**
 * Eigentum des eingesetzten Equipments. Aus realen Angeboten abgeleitet:
 * manche Locations (z. B. Ministerien) stellen Haustechnik, anderes bringt JM mit.
 */
export type EquipmentOwner = 'kunde-haus' | 'jm' | 'gemischt';

/** Eine Gruppe der „Zutaten" (z. B. Audio, Video, Rollen/Personal). */
export interface IngredientGroup {
  title: string;
  items: string[];
}

/** Schritt-für-Schritt, aufgeteilt in die drei Phasen einer Produktion. */
export interface RecipeSteps {
  vor: string[];
  waehrend: string[];
  nach: string[];
}

/** Eine Zeile der Pannenhilfe-Tabelle (Risiko → Gegenmaßnahme). */
export interface TroubleshootingRow {
  risk: string;
  remedy: string;
}

/** Eine benannte Checkliste; der Erledigt-Zustand ist UI-lokal, nicht im Inhalt. */
export interface Checklist {
  title: string;
  items: string[];
}

/** Die strukturierten Inhaltsblöcke eines Rezepts (das Rezept-Template). */
export interface RecipeBlocks {
  /** Was brauche ich — Equipment, Rollen, Software, Voraussetzungen (gruppiert). */
  ingredients: IngredientGroup[];
  /** Ablauf in den Phasen Vorbereitung / Während / Nachbereitung. */
  steps: RecipeSteps;
  /** Profi-Tipps (optional). */
  tips?: string[];
  /** Pannenhilfe: Risiko → Gegenmaßnahme. */
  troubleshooting: TroubleshootingRow[];
  /** Mise en place: abhakbare Vorab-Checks. */
  checklists: Checklist[];
}

/** Ein kompiliertes Rezept (Frontmatter-Metadaten + strukturierte Blöcke). */
export interface Recipe {
  /** Stabile kebab-ID, entspricht dem Dateinamen der Markdown-Quelle. */
  id: string;
  title: string;
  category: CookbookCategory;
  difficulty: Difficulty;
  /** Aufbauzeit in Minuten (auch mehrtägig, z. B. 1440 = 1 Tag). */
  setupTimeMin: number;
  /** Mindest-Crew, frei als Text ("2" oder "2-3"). */
  teamSize: string;
  tags: string[];
  /** `ToolManifest.id`-Referenzen für Deep-Links in die Suite. */
  relatedTools: string[];
  /** Voraussetzungen als freie Textpunkte (Strom, Netz, Raumzugang …). */
  prerequisites: string[];
  /** Eigentum des Equipments (Kunde/Haus, JM, gemischt). */
  equipmentOwner: EquipmentOwner;
  /** Beteiligte Rollen als Anzeigetexte. */
  crewRoles: string[];
  /** Optionales Location-Profil (z. B. „BMUKN Berlin, Stresemannstr. 128-130"). */
  location?: string;
  /** ISO-Datum der letzten inhaltlichen Prüfung (treibt ein „veraltet"-Badge). */
  lastReviewed: string;
  /** Verantwortliche Person (E-Mail). */
  owner: string;
  /** Kurzbeschreibung für Liste und Vorschau. */
  summary: string;
  blocks: RecipeBlocks;
  /** Roh-Markdown des Bodys — nur für Website/PDF-Export (Phase 3), optional. */
  markdown?: string;
}

/** Der kompilierte Kochbuch-Index (analog `SuiteManifest`). */
export interface Cookbook {
  schemaVersion: number;
  /** ISO-Zeitstempel des Kompilats. */
  updatedAt: string;
  recipes: Recipe[];
}
