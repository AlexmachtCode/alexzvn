// UX Welle 2b, Task 26 · Rückspiel der Regeln aus 2b in Studio-Control (regeln.md).
// Regel „select-text“ (Task 23/24, Connect): body { user-select: none } aus globals.css trifft Text, den Bediener kopieren. Hier sind
// das die Fehlerkästen der Gerätepanels (lastError samt Adresse), die Fehlerzeilen der Anmeldung und der Benutzerverwaltung und die
// Protokollzeilen „Letzte Aktionen“; sie tragen select-text. Render ohne Browser über die Wurzel-View (echter Store), die Fehler aus
// lokalem Zustand (Anmeldung, Benutzer) als Quelltext-Wächter.
import { createElement } from 'react';
import { leseText, ok, render } from '@jm/ui/testhilfe';
import { AuditLogPanel } from '@/components/video/AuditLogPanel';
import * as oberflaeche from '@/views/StudioOberflaeche';
import { geraetImStore, mitStore, oberflaecheHtml, ohneKommentare, tags, attr, type Typ } from './testzustand';

const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
const markierbar = (klasse: string | undefined): boolean => (klasse ?? '').split(/\s+/).includes('select-text');

/**
 * Die Klasse des Fehlerkastens (Rand --destructive/50), der den Text enthält; undefined, wenn kein Kasten ihn enthält. Der Kasten
 * enthält nur span und code (kein div), sein Inhalt reicht bis zum nächsten </div>. Der Text steht auch in Pille und Statusleiste,
 * darum zählt nur ein Treffer im Kasten.
 */
function kastenKlasse(html: string, fehler: string): string | undefined {
  for (const m of html.matchAll(/<div class="([^"]*border-\[var\(--destructive\)\]\/50[^"]*)">/g)) {
    const start = (m.index ?? 0) + m[0].length;
    if (html.slice(start, html.indexOf('</div>', start)).includes(fehler)) return m[1];
  }
  return undefined;
}

// ── SC Rückspiel select-text: der Fehlerkasten jedes Gerätepanels (getrennt mit lastError) ist markierbar ──
{
  const FAELLE: Array<[Typ, 'video' | 'audio']> = [
    ['tricaster', 'video'],
    ['atem', 'video'],
    ['obs', 'video'],
    ['ptz', 'video'],
    ['audio', 'audio'],
  ];
  for (const [typ, abschnitt] of FAELLE) {
    const fehler = `Zeitüberschreitung ${typ} (192.0.2.99)`;
    let html = '';
    try {
      html = oberflaecheHtml(oberflaeche.StudioOberflaeche, { abschnitt, store: geraetImStore(typ, { state: 'down', lastError: fehler }) }, render);
    } catch (e) {
      ok(false, `SC Rückspiel select-text: ${typ} – Render ohne Wurf (${String(e).split(String.fromCharCode(10))[0]})`);
    }
    const k = kastenKlasse(html, fehler);
    ok(
      k !== undefined && markierbar(k),
      `SC Rückspiel select-text: ${typ} – der Fehlerkasten mit lastError (und Adresse) ist markierbar (select-text, trotz body user-select none)`,
    );
  }
}

// ── SC Rückspiel select-text: Protokollzeilen „Letzte Aktionen“ ──
{
  const html = mitStore({ audit: [{ id: 1, ts: 0, username: 'admin', action: 'atem.cut', target: 'a1' }] } as never, () => render(createElement(AuditLogPanel)));
  const liste = tags(html, 'ul')[0];
  ok(html.includes('atem.cut') && markierbar(attr(liste, 'class')), 'SC Rückspiel select-text: die Protokollzeilen „Letzte Aktionen“ sind markierbar (Liste mit select-text)');
}

// ── SC Rückspiel select-text: Fehlerzeilen aus lokalem Zustand (Quelltext-Wächter) ──
{
  ok(
    /\{error && \(\s*<p className="[^"]*\bselect-text\b[^"]*">\s*\{error === /.test(QUELLE('views/Login.tsx')),
    'SC Rückspiel select-text: die Fehlerzeile der Anmeldung ist markierbar (select-text)',
  );
  ok(
    /\{error && <p className="[^"]*\bselect-text\b[^"]*">\{error\}<\/p>\}/.test(QUELLE('components/setup/UserManager.tsx')),
    'SC Rückspiel select-text: die Fehlerzeile der Benutzerverwaltung ist markierbar (select-text)',
  );
}
