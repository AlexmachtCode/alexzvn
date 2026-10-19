// Trockenlauf vor dem Deploy des Release-Proxys (iveo-Paket, Spec 10.7; E43, EP5): stellt für jedes Tool aus
// packages/suite-manifest/suite.json und den Launcher auf Windows, Mac arm64 und Mac x64 die alte Wahl des Workers
// (eingefroren, bis zum iveo-Paket) der neuen Wahl aus paketwahl.js gegenüber: Version und Paketname oder Fehlertext.
//
//   node services/release-proxy/tools/trockenlauf.mjs
//
// Nur Controller und Owner starten die Kommandozeile: Sie braucht Netz und ein angemeldetes gh. Sie liest nur (gh api,
// GET, dieselben Seiten wie der Worker: 100 je Seite, höchstens 30), schreibt keine Datei und druckt nur Version,
// Paketname oder Fehlertext, nie Adressen, Kopfzeilen oder Tokens. Jede Zeile mit „≠“ geht mit Begründung an den Owner,
// bevor er den Deploy freigibt. Die reinen Funktionen prüft services/release-proxy/test/worker.test.mjs (Fall 24).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareVersions, keinPaketFehler, waehleRelease } from '../paketwahl.js';

/** Die alte Wahl des Workers (worker.js bis zum iveo-Paket), eingefroren: höchstes Release, Mac notfalls irgendein DMG. */
export function alteWahl(releases, praefix, plattform, arch) {
  const app = praefix.endsWith('-v') ? praefix.slice(0, -2) : praefix;
  const picked = releases
    .filter((r) => !r.draft && typeof r.tag_name === 'string' && r.tag_name.startsWith(praefix))
    .map((r) => ({ release: r, version: r.tag_name.slice(praefix.length) }))
    .sort((a, b) => compareVersions(b.version, a.version))[0];
  if (!picked) return { art: 'fehler', text: `kein Release für ${app}` };
  const ext = plattform === 'mac' ? '.dmg' : '.exe';
  const assets = picked.release.assets || [];
  const asset =
    assets.find((a) => a.name.endsWith(ext) && (plattform === 'mac' ? a.name.includes(arch) : true)) ||
    assets.find((a) => a.name.endsWith(ext));
  if (!asset) return { art: 'fehler', text: `kein ${plattform}-Asset im Release` };
  return { art: 'gewaehlt', version: picked.version, asset };
}

const ZIELE = [
  { name: 'Windows', plattform: 'win', arch: 'x64' },
  { name: 'Mac arm64', plattform: 'mac', arch: 'arm64' },
  { name: 'Mac x64', plattform: 'mac', arch: 'x64' },
];

function beschreibeAlt(w) {
  return w.art === 'gewaehlt' ? `${w.version} · ${w.asset.name}` : `404 ${w.text}`;
}

function beschreibeNeu(w, app, plattform, arch) {
  if (w.art === 'gewaehlt') return `${w.version} · ${w.asset.name}`;
  return w.art === 'kein-release' ? `404 kein Release für ${app}` : `404 ${keinPaketFehler(app, plattform, arch)}`;
}

/** Je Tool und Ziel eine Zeile alt gegen neu; die Tool-ID wird wie im Worker auf die App abgebildet (jm- weg). */
export function vergleicheWahl(releases, tools) {
  const zeilen = [];
  for (const t of tools) {
    const app = t.id.startsWith('jm-') ? t.id.slice(3) : t.id;
    const praefix = `${app}-v`;
    for (const z of ZIELE) {
      const alt = beschreibeAlt(alteWahl(releases, praefix, z.plattform, z.arch));
      const neu = beschreibeNeu(waehleRelease(releases, praefix, z.plattform, z.arch), app, z.plattform, z.arch);
      zeilen.push({ tool: t.id, plattform: z.name, alt, neu, gleich: alt === neu });
    }
  }
  return zeilen;
}

/** Druckzeilen: Unterschiede mit „≠ “ vorn, am Ende die Zählung. */
export function formatiereZeilen(zeilen) {
  const aus = zeilen.map((z) => `${z.gleich ? '  ' : '≠ '}${z.tool} · ${z.plattform} · alt: ${z.alt} · neu: ${z.neu}`);
  aus.push(`${zeilen.length} Zeilen, ${zeilen.filter((z) => !z.gleich).length} mit Unterschied (≠).`);
  return aus;
}

/** Release-Liste wie der Worker (alleReleases): Seite für Seite, nur die Felder der Wahl. */
function holeReleases(repo) {
  const alle = [];
  for (let seite = 1; seite <= 30; seite++) {
    const roh = execFileSync('gh', ['api', `repos/${repo}/releases?per_page=100&page=${seite}`], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    });
    const teil = JSON.parse(roh);
    if (!Array.isArray(teil)) throw new Error('GitHub API: Release-Liste ist kein Array');
    for (const r of teil) {
      alle.push({
        tag_name: r.tag_name,
        draft: r.draft,
        assets: (r.assets || []).map((x) => ({ id: x.id, name: x.name, size: x.size })),
      });
    }
    if (teil.length < 100) return alle;
  }
  console.warn('trockenlauf: Obergrenze von 30 Seiten erreicht, ältere Releases bleiben ungelesen (wie im Worker).');
  return alle;
}

function hauptprogramm() {
  const wurzel = fileURLToPath(new URL('../../../', import.meta.url));
  const katalog = JSON.parse(readFileSync(resolve(wurzel, 'packages/suite-manifest/suite.json'), 'utf8'));
  const wrangler = readFileSync(resolve(wurzel, 'services/release-proxy/wrangler.toml'), 'utf8');
  const repo = /^REPO\s*=\s*"([^"]+)"/m.exec(wrangler)?.[1];
  if (!repo) {
    console.error('trockenlauf: REPO in services/release-proxy/wrangler.toml nicht gefunden.');
    process.exit(2);
  }
  const tools = [...katalog.tools.map((t) => ({ id: t.id })), { id: 'launcher' }];
  const releases = holeReleases(repo);
  console.log(`Trockenlauf ${repo}: ${releases.length} Releases, ${tools.length} Tools (mit dem Launcher), je Windows, Mac arm64, Mac x64.`);
  for (const zeile of formatiereZeilen(vergleicheWahl(releases, tools))) console.log(zeile);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) hauptprogramm();
