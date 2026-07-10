// ─────────────────────────────────────────────────────────────────────────────
// Baut die `index.html` eines auslieferbaren App-Bundles.
//
// Das Bundle muss per Doppelklick von `file://` laufen (USB-Stick, Kundenübergabe)
// UND von einem Webserver. Daraus folgt hart:
//   • Runtime als klassisches <script src>, nicht als Modul  → CORS blockiert
//     `<script type="module">` unter file://
//   • Dokument INLINE als <script type="application/json">   → fetch('app.json')
//     scheitert unter file:// an der null-Origin
//   • Assets als echte Dateien mit relativen Pfaden          → <img>/<video>/<audio>
//     laden unter file://, nur fetch/XHR nicht
//
// Dieselbe Datei erzeugt die Vorschau-Seite hinter `jmapp://preview/` — die
// Sandbox zeigt damit buchstäblich das Export-Artefakt, nicht etwas Ähnliches.
// ─────────────────────────────────────────────────────────────────────────────

import type { AppProject } from '../model';
import { DOC_SCRIPT_ID, ROOT_ID } from '../constants';

export interface BundleHtmlOptions {
  doc: AppProject;
  /** Pfad zur Runtime relativ zur index.html. */
  runtimeSrc?: string;
  /** Zusätzliche <head>-Zeilen (z. B. eine strengere CSP für die Vorschau). */
  headExtra?: string;
}

// U+2028/U+2029 sind gültiges JSON, aber ungültige JS-String-Literale — sie
// zerbrechen ein inline eingebettetes Dokument. Aus einem ASCII-Quelltext gebaut,
// damit die Zeichen nicht selbst in dieser Datei stehen (und beim Editieren
// unsichtbar verloren gehen).
const LINE_SEPARATORS = new RegExp('[\\u2028\\u2029]', 'g');

/**
 * Escaped `</script` und Zeilentrenner im eingebetteten JSON. Ein Fragetext mit
 * "</script>" würde die Seite sonst zerreißen — auf einem Messestand fällt das
 * frühestens dem Besucher auf.
 */
function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(LINE_SEPARATORS, (c) => '\\u' + c.charCodeAt(0).toString(16));
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

export function buildIndexHtml(opts: BundleHtmlOptions): string {
  const { doc, runtimeSrc = 'runtime.js', headExtra = '' } = opts;
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>${escapeHtml(doc.name)}</title>
${headExtra}<style>
  html, body { margin: 0; height: 100%; background: ${doc.theme.colorBg}; overflow: hidden; }
  /* Messe-Terminal: kein Doppeltipp-Zoom, keine Textauswahl, kein Tap-Highlight. */
  body {
    user-select: none; -webkit-user-select: none;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  #${ROOT_ID} { width: 100%; height: 100%; }
</style>
</head>
<body>
<div id="${ROOT_ID}"></div>
<script type="application/json" id="${DOC_SCRIPT_ID}">${safeJson(doc)}</script>
<script src="${runtimeSrc}"></script>
</body>
</html>
`;
}

/**
 * Strenge CSP für die Editor-Vorschau. Der Frame läuft unter jmapp://preview,
 * also bedeutet 'self' genau dieses Bundle — die Runtime lädt, sonst nichts.
 * Kein 'unsafe-eval': die Regel-Engine interpretiert, sie evaluiert nicht.
 */
export const PREVIEW_CSP_META =
  `<meta http-equiv="Content-Security-Policy" content="` +
  `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; ` +
  `img-src 'self' data:; media-src 'self'; font-src 'self' data:; base-uri 'none'">` +
  '\n';
