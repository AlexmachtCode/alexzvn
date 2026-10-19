// ─────────────────────────────────────────────────────────────────────────────
// Release-Wahl des Launchers (iveo-Paket, Spec 10.4, 10.5; E40, E41). Rein: keine Importe, kein Electron, damit der
// Launcher-Selbsttest (node --experimental-strip-types) das Modul lädt (G5). release-source.ts, updates.ts und
// installer.ts rufen nur diese Helfer.
//
// Regel (dieselbe steht in services/release-proxy/paketwahl.js; beide Tests lesen
// services/release-proxy/test/paketwahl-faelle.json):
//   1. Kandidaten: nicht draft, Tag beginnt mit dem Präfix, absteigend nach Version.
//   2. Windows: Name endet auf .exe.
//   3. macOS: Name endet auf .dmg und enthält die Architektur des Launcher-Prozesses, oder weder arm64 noch x64
//      (universell), oder der Launcher ist arm64 und der Name enthält x64 (Rosetta). Ein x64-Launcher nimmt nie ein
//      arm64-Paket; ein x64-Launcher unter Rosetta zählt als x64 (FP12).
//   4. Innerhalb eines Releases: genaue Architektur vor universell vor x64 auf arm64; in der GitHub-Quelle zuerst der
//      genaue Name aus dem Katalog (wörtlich oder, wie GitHub ihn ablegt, mit Punkten statt Leerzeichen).
//   5. Gewählt wird das erste Release (höchste Version) mit einem passenden Paket.
//   6. Kein Release mit dem Präfix → kein-release; Releases da, keins passend → kein-paket.
// ─────────────────────────────────────────────────────────────────────────────

/** Vergleicht zwei Dotted-Versions numerisch; >0 wenn `a` neuer als `b` (aus release-source.ts hierher gezogen). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Ein Paket eines Releases, wie die GitHub-API es liefert (nur die Felder, die die Wahl braucht). */
export interface ReleaseAsset {
  id: number;
  name: string;
  size: number;
}

/** Ein Release, wie die GitHub-API es liefert (nur die Felder, die die Wahl braucht). */
export interface ReleaseEintrag {
  tag_name: string;
  draft: boolean;
  assets: ReleaseAsset[];
}

export type PaketWahl =
  | { art: 'gewaehlt'; version: string; release: ReleaseEintrag; asset: ReleaseAsset }
  | { art: 'kein-release' }
  | { art: 'kein-paket' };

/** Rang eines Pakets für diesen Rechner (Regel 2–4): 0 genau (bzw. .exe), 1 universell, 2 x64 auf arm64; null = passt nicht. */
function rang(name: string, plattform: 'mac' | 'win', arch: 'arm64' | 'x64'): number | null {
  if (plattform === 'win') return name.endsWith('.exe') ? 0 : null;
  if (!name.endsWith('.dmg')) return null;
  if (name.includes(arch)) return 0;
  if (!name.includes('arm64') && !name.includes('x64')) return 1;
  if (arch === 'arm64' && name.includes('x64')) return 2;
  return null;
}

/**
 * Neuestes Release mit einem Paket für diesen Rechner (Spec 10.5). `genauerName` liefert den Artefaktnamen aus dem
 * Katalog für eine Version (nur die GitHub-Quelle kennt ihn); er gilt nur, wenn das Paket auch passt.
 */
export function waehleRelease(
  releases: ReleaseEintrag[],
  praefix: string,
  plattform: 'mac' | 'win',
  arch: 'arm64' | 'x64',
  genauerName?: (version: string) => string | null,
): PaketWahl {
  const kandidaten = releases
    .filter((r) => !r.draft && typeof r.tag_name === 'string' && r.tag_name.startsWith(praefix))
    .map((r) => ({ release: r, version: r.tag_name.slice(praefix.length) }))
    .sort((x, y) => compareVersions(y.version, x.version));
  if (kandidaten.length === 0) return { art: 'kein-release' };
  for (const { release, version } of kandidaten) {
    const passend: Array<{ asset: ReleaseAsset; rang: number }> = [];
    for (const asset of release.assets ?? []) {
      const r = typeof asset?.name === 'string' ? rang(asset.name, plattform, arch) : null;
      if (r !== null) passend.push({ asset, rang: r });
    }
    if (passend.length === 0) continue;
    const wunsch = genauerName ? genauerName(version) : null;
    const genau = wunsch ? passend.find((p) => p.asset.name === wunsch || p.asset.name === wunsch.replace(/ /g, '.')) : undefined;
    const beste = genau ?? passend.reduce((a, b) => (b.rang < a.rang ? b : a));
    return { art: 'gewaehlt', version, release, asset: beste.asset };
  }
  return { art: 'kein-paket' };
}

/** Höchstlänge des Proxy-Fehlertexts in der Anzeige (Codepunkte, Spec 10.4). */
const FEHLERTEXT_MAX = 200;

/**
 * Fehlertext einer Proxy-Antwort (Spec 10.4, 11.5 F2–F6): JSON-Objekt mit String-Feld `error` → „Proxy ‹Status›:
 * ‹error›“ (Zeilenumbrüche zu Leerzeichen, höchstens 200 Zeichen); sonst „Proxy ‹Status› ‹Statustext›“ wie bisher.
 */
export function proxyFehlerText(status: number, statusText: string, body: string): string {
  let fehler: unknown = null;
  try {
    const j: unknown = JSON.parse(body);
    if (j !== null && typeof j === 'object' && !Array.isArray(j)) fehler = (j as { error?: unknown }).error;
  } catch {
    /* kein JSON: Rückfall auf Status und Statustext */
  }
  if (typeof fehler === 'string') {
    const text = Array.from(fehler.replace(/\r\n|\r|\n/g, ' ').trim()).slice(0, FEHLERTEXT_MAX).join('');
    if (text !== '') return `Proxy ${status}: ${text}`;
  }
  return `Proxy ${status} ${statusText}`;
}

/** Das, was die Auswertung von einer fetch-Antwort braucht (im Test ein nachgebautes Objekt). */
export interface ProxyAntwortLike {
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

/**
 * Ganze Auswertung der Proxy-Antwort (Spec 10.4): ohne `ok` ein Fehler mit proxyFehlerText (Lesefehler = leerer
 * Text); mit `ok` die Version und das Paket dieser Plattform, `asset` null, wenn die Antwort keins trägt (F8).
 */
export async function proxyAntwortAuswerten(
  res: ProxyAntwortLike,
  plattform: 'mac' | 'win',
): Promise<{ version: string; asset: { url: string; size: number; fileName: string } | null }> {
  if (!res.ok) {
    let body = '';
    try {
      body = await res.text();
    } catch {
      body = '';
    }
    throw new Error(proxyFehlerText(res.status, res.statusText, body));
  }
  let j: unknown;
  try {
    j = await res.json();
  } catch {
    throw new Error(proxyFehlerText(res.status, res.statusText, ''));
  }
  const o = (j !== null && typeof j === 'object' ? j : {}) as { version?: unknown; assets?: unknown };
  if (typeof o.version !== 'string' || o.version === '') throw new Error(proxyFehlerText(res.status, res.statusText, ''));
  const assets = o.assets !== null && typeof o.assets === 'object' ? (o.assets as Record<string, unknown>) : {};
  const roh = assets[plattform];
  const a = (roh !== null && typeof roh === 'object' ? roh : {}) as { url?: unknown; size?: unknown; fileName?: unknown };
  const asset =
    typeof a.url === 'string' && typeof a.fileName === 'string'
      ? { url: a.url, size: typeof a.size === 'number' ? a.size : 0, fileName: a.fileName }
      : null;
  return { version: o.version, asset };
}

/** T29 (Tool) bzw. T69 (Launcher selbst): kein Paket für diesen Rechner (Spec 11.6, 11.5 F8 und F11). */
export function keinPaketText(plattform: 'mac' | 'win', arch: 'arm64' | 'x64', wer: 'tool' | 'launcher'): string {
  if (wer === 'launcher') {
    return plattform === 'mac'
      ? `Kein Launcher-Installer für diesen Rechner gefunden (macOS, Launcher-Architektur ${arch}).`
      : 'Kein Launcher-Installer für diesen Rechner gefunden (Windows).';
  }
  return plattform === 'mac'
    ? `Kein Release mit einem Paket für diesen Rechner gefunden (macOS, Launcher-Architektur ${arch}).`
    : 'Kein Release mit einem Paket für diesen Rechner gefunden (Windows).';
}

// ── Ende des Moduls ──
