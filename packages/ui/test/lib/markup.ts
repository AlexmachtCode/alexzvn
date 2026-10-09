// Kleine Lesehilfen für das HTML aus renderToStaticMarkup (nur Tests von Block B).
// Bewusst ohne DOM-Bibliothek: Die Bausteine schreiben aria-hidden immer als erstes Attribut,
// und die gesuchten Elemente sind nicht ineinander verschachtelt (siehe die einzelnen Tests).

function entities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Alle öffnenden Tags eines Elements, z. B. tags(html, 'button') → ['<button type="button" …>', …]. */
export function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}(?=[\\s>/])[^>]*>`, 'g')) ?? [];
}

/** Wert eines Attributs in einem öffnenden Tag (Entities aufgelöst), sonst undefined. */
export function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? entities(m[1]) : undefined;
}

/** Die Klassen eines öffnenden Tags als Liste. */
export function klassen(tag: string): string[] {
  return (attr(tag, 'class') ?? '').split(/\s+/).filter(Boolean);
}

/** true, wenn das Tag ALLE Klassen aus `liste` (durch Leerzeichen getrennt) trägt. */
export function hatKlassen(tag: string, liste: string): boolean {
  const da = new Set(klassen(tag));
  return liste.split(/\s+/).filter(Boolean).every((k) => da.has(k));
}

/** Text ohne Tags (Entities aufgelöst) – so, wie ihn ein Mensch oder Screenreader liest. */
export function text(html: string): string {
  return entities(html.replace(/<[^>]+>/g, ''));
}

/** HTML ohne die aria-hidden-Symbole (`<span aria-hidden="true" …>…</span>`, nicht verschachtelt). */
export function ohneVersteckt(html: string): string {
  return html.replace(/<span aria-hidden="true"[^>]*>[^<]*<\/span>/g, '');
}

/** Der Teil zwischen dem ersten `start` und dem ersten `ende` danach (beide ausgeschlossen); '' wenn nicht gefunden. */
export function zwischen(html: string, start: string, ende: string): string {
  const a = html.indexOf(start);
  if (a < 0) return '';
  const b = html.indexOf(ende, a + start.length);
  return b < 0 ? '' : html.slice(a + start.length, b);
}
