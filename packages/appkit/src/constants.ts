/**
 * Geteilte Konstanten zwischen Runtime-Bootstrap und Bundle-Builder.
 *
 * Bewusst eine eigene Datei: `runtime/entry.ts` startet die App beim Laden
 * (Top-Level-`boot()`). Würde der Editor diese Konstanten von dort importieren,
 * liefe die Runtime im Editor-Renderer los.
 */

/** ID des <script type="application/json">, das das Dokument inline trägt. */
export const DOC_SCRIPT_ID = 'jmapp-doc';

/** Ordner der Assets im Bundle, relativ zur index.html. */
export const ASSET_DIR = 'assets';

/** Wurzelelement, in das die Runtime die Bühne rendert. */
export const ROOT_ID = 'jmapp-root';
