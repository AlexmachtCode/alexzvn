// App-Icons der Suite für die Werkzeug-Kacheln.
//
// Bewusst die SVGs, nicht die 1024er-PNGs: alle zusammen sind roh ~35 KB (die PNGs wären ~2 MB),
// Vite inlined sie unter 4 KB als Data-URI, und sie skalieren verlustfrei auf jede Kachelgröße.
//
// Der Verzeichnisname ist NICHT die Tool-ID: `apps/switcher` heißt im Katalog `jm-switcher`.
// Deshalb wird jedes Icon unter beiden Schlüsseln hinterlegt, statt einen der beiden zu raten.
const modules = import.meta.glob<string>('../../../../../*/build/icon.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

const byId = new Map<string, string>();
for (const [path, url] of Object.entries(modules)) {
  const dir = path.split('/').at(-3);
  if (!dir) continue;
  byId.set(dir, url);
  if (!dir.startsWith('jm-')) byId.set(`jm-${dir}`, url);
}

/** Icon eines Tools, oder null — dann zeigt die Kachel weiterhin das Kürzel. */
export function toolIcon(toolId: string): string | null {
  return byId.get(toolId) ?? null;
}
