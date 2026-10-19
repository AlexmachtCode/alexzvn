// Paketwahl des Release-Proxys für GET /tools/:id/latest (iveo-Paket, Spec 10.5; E41, EP3). Eigenes Modul neben
// worker.js (Muster qa-relay.js), ohne Importe: test/worker.test.mjs und tools/trockenlauf.mjs laden es ohne den
// Worker. Dieselbe Regel steht im Launcher (apps/launcher/src/main/release-wahl.ts); beide Tests lesen
// test/paketwahl-faelle.json, eine Tabelle für zwei Umsetzungen.
//
//   1. Kandidaten: nicht draft, Tag beginnt mit dem Präfix, absteigend nach Version.
//   2. Windows: Name endet auf .exe.
//   3. macOS: Name endet auf .dmg und enthält arch, oder weder arm64 noch x64 (universell), oder arch ist arm64 und der
//      Name enthält x64 (Rosetta). Ein x64-Mac bekommt nie ein arm64-Paket.
//   4. Innerhalb eines Releases: genaue Architektur vor universell vor x64 auf arm64.
//   5. Gewählt wird das erste Release (höchste Version) mit einem passenden Paket.
//   6. Kein Release mit dem Präfix → kein-release; Releases da, keins passend → kein-paket (404 mit keinPaketFehler).

/** Dotted-Versionsvergleich; >0 wenn a neuer als b (aus worker.js hierher verschoben). */
export function compareVersions(a, b) {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Rang eines Pakets (Regel 2–4): 0 genau bzw. .exe, 1 universell, 2 x64 auf arm64; null = passt nicht. */
function rang(name, plattform, arch) {
  if (plattform === 'win') return name.endsWith('.exe') ? 0 : null;
  if (!name.endsWith('.dmg')) return null;
  if (name.includes(arch)) return 0;
  if (!name.includes('arm64') && !name.includes('x64')) return 1;
  if (arch === 'arm64' && name.includes('x64')) return 2;
  return null;
}

/**
 * Neuestes Release mit einem Paket für plattform ('mac' | 'win') und arch ('arm64' | 'x64').
 * @returns {{ art: 'gewaehlt', version: string, release: object, asset: object } | { art: 'kein-release' } | { art: 'kein-paket' }}
 */
export function waehleRelease(releases, praefix, plattform, arch) {
  const kandidaten = releases
    .filter((r) => r && !r.draft && typeof r.tag_name === 'string' && r.tag_name.startsWith(praefix))
    .map((r) => ({ release: r, version: r.tag_name.slice(praefix.length) }))
    .sort((x, y) => compareVersions(y.version, x.version));
  if (kandidaten.length === 0) return { art: 'kein-release' };
  for (const { release, version } of kandidaten) {
    let beste = null;
    for (const asset of release.assets || []) {
      const r = asset && typeof asset.name === 'string' ? rang(asset.name, plattform, arch) : null;
      if (r !== null && (beste === null || r < beste.rang)) beste = { asset, rang: r };
    }
    if (beste) return { art: 'gewaehlt', version, release, asset: beste.asset };
  }
  return { art: 'kein-paket' };
}

/** T28: 404-Text, wenn Releases da sind, aber keins ein passendes Paket hat (Spec 10.5 Nr. 6, 11.6). */
export function keinPaketFehler(app, plattform, arch) {
  return plattform === 'mac'
    ? `kein Release von ${app} mit einem Paket für macOS (${arch})`
    : `kein Release von ${app} mit einem Paket für Windows`;
}
