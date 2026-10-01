import type { Platform, ToolManifest } from '@jm/suite-manifest';
import { resolveProxy, resolveProxyKey, resolveToken } from './settings';
import { holeAlleSeiten, RELEASES_PRO_SEITE } from './release-liste';

/** Aufgelöstes, herunterladbares Release-Artefakt für die aktuelle Plattform. */
export interface ResolvedAsset {
  version: string;
  fileName: string;
  /** URL, von der das Binär geladen wird. */
  assetUrl: string;
  /** Bekannte Größe in Bytes (0, falls unbekannt). */
  size: number;
  /** Header für den Download-Request (z. B. GitHub-Auth). */
  downloadHeaders: Record<string, string>;
}

/** Abstraktion über die Herkunft der Release-Artefakte (GitHub-PAT, Proxy, …). */
export interface ReleaseSource {
  latest(tool: ToolManifest): Promise<ResolvedAsset | null>;
  /** Neueste verfügbare Version des Tools (ohne Asset-Auflösung), für die
   *  Update-Prüfung. null, wenn (noch) kein passendes Release existiert. */
  latestVersion(tool: ToolManifest): Promise<string | null>;
}

function platformKey(): Platform | null {
  if (process.platform === 'darwin') return 'mac';
  if (process.platform === 'win32') return 'win';
  return null;
}

function archToken(): string {
  return process.arch === 'arm64' ? 'arm64' : 'x64';
}

/** Erwarteter Artefaktname aus dem Manifest mit aufgelösten Platzhaltern. */
function resolveArtifactName(tool: ToolManifest, version: string): string | null {
  const key = platformKey();
  if (!key) return null;
  const info = tool.platforms[key];
  if (!info) return null;
  return info.artifact
    .replace(/\$\{version\}/g, version)
    .replace(/\$\{arch\}/g, archToken());
}

const USER_AGENT = 'JM-Production-Suite';

/** Vergleicht zwei Dotted-Versions numerisch; >0 wenn `a` neuer als `b`. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

interface GithubRelease {
  tag_name: string;
  draft: boolean;
  assets: Array<{ id: number; name: string; size: number }>;
}

/** Listet ALLE Releases einer Repo (read-only contents) via fine-grained PAT,
 *  Seite für Seite (siehe release-liste.ts: Seite 1 allein reichte nicht mehr). */
async function listGithubReleases(repo: string, token: string): Promise<GithubRelease[]> {
  return holeAlleSeiten(async (seite) => {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/releases?per_page=${RELEASES_PRO_SEITE}&page=${seite}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': USER_AGENT,
        },
      },
    );
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as GithubRelease[];
  });
}

/** Höchstversioniertes, nicht-draft Release mit Tag-Präfix `<prefix>` (z. B.
 *  "copy-v"). Liefert das Release samt geparster Version oder null. */
function pickHighestRelease(
  releases: GithubRelease[],
  prefix: string,
): { release: GithubRelease; version: string } | null {
  return (
    releases
      .filter((r) => !r.draft && r.tag_name.startsWith(prefix))
      .map((r) => ({ release: r, version: r.tag_name.slice(prefix.length) }))
      .sort((x, y) => compareVersions(y.version, x.version))[0] ?? null
  );
}

/**
 * GitHub-Releases im gemeinsamen Monorepo via fine-grained PAT (read-only
 * contents). Tools teilen sich `repo` und werden über das Tag-Präfix
 * `<app>-v<version>` unterschieden — es wird das höchstversionierte passende
 * Release gewählt (`/releases/latest` taugt im Monorepo nicht, da es nur das
 * eine neueste Release der ganzen Repo liefert).
 */
class GithubReleaseSource implements ReleaseSource {
  constructor(private readonly token: string) {}

  async latestVersion(tool: ToolManifest): Promise<string | null> {
    const releases = await listGithubReleases(tool.repo, this.token);
    return pickHighestRelease(releases, `${tool.app}-v`)?.version ?? null;
  }

  async latest(tool: ToolManifest): Promise<ResolvedAsset | null> {
    const releases = await listGithubReleases(tool.repo, this.token);
    const candidate = pickHighestRelease(releases, `${tool.app}-v`);
    if (!candidate) return null;

    const { release, version } = candidate;
    const key = platformKey();
    const ext = key === 'mac' ? '.dmg' : '.exe';
    const arch = archToken();
    const wanted = resolveArtifactName(tool, version);
    // GitHub ersetzt Leerzeichen in Asset-Namen durch Punkte ("JM Copy" → "JM.Copy").
    const wantedDot = wanted?.replace(/ /g, '.');
    const asset =
      (wanted && release.assets.find((a) => a.name === wanted || a.name === wantedDot)) ||
      // Fallback: passende Endung + Version, auf macOS zusätzlich die Architektur
      // (sonst würde bei arm64+x64 versehentlich das falsche DMG gewählt).
      release.assets.find(
        (a) =>
          a.name.endsWith(ext) &&
          a.name.includes(version) &&
          (key === 'mac' ? a.name.includes(arch) : true),
      );
    if (!asset) return null;

    return {
      version,
      fileName: asset.name,
      // Asset-Endpoint mit octet-stream → GitHub leitet auf eine signierte URL um;
      // fetch entfernt beim Cross-Origin-Redirect den Authorization-Header (korrekt für S3).
      assetUrl: `https://api.github.com/repos/${tool.repo}/releases/assets/${asset.id}`,
      size: asset.size,
      downloadHeaders: {
        Accept: 'application/octet-stream',
        Authorization: `Bearer ${this.token}`,
        'User-Agent': USER_AGENT,
      },
    };
  }
}

/**
 * Interner Proxy (Cloudflare Worker): hält das GitHub-Token serverseitig und
 * liefert pro Tool Version + signierte, auth-freie Download-URL. Der Client weist
 * sich mit dem Proxy-Key aus und übergibt Plattform/Architektur, damit das
 * richtige Asset gewählt wird.
 * GET {base}/tools/{id}/latest?platform=<mac|win>&arch=<arm64|x64>
 *   → { version, assets: { <platform>: {url,size,fileName} } }
 */
class ProxyReleaseSource implements ReleaseSource {
  constructor(
    private readonly base: string,
    private readonly key: string,
  ) {}

  private async query(
    tool: ToolManifest,
  ): Promise<{ version: string; asset?: { url: string; size: number; fileName: string } } | null> {
    const platform = platformKey();
    if (!platform) return null;
    const url =
      `${this.base.replace(/\/$/, '')}/tools/${tool.id}/latest` +
      `?platform=${platform}&arch=${archToken()}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'X-Proxy-Key': this.key },
    });
    if (!res.ok) throw new Error(`Proxy ${res.status} ${res.statusText}`);
    const json = (await res.json()) as {
      version: string;
      assets: Partial<Record<Platform, { url: string; size: number; fileName: string }>>;
    };
    return { version: json.version, asset: json.assets[platform] };
  }

  async latestVersion(tool: ToolManifest): Promise<string | null> {
    return (await this.query(tool))?.version ?? null;
  }

  async latest(tool: ToolManifest): Promise<ResolvedAsset | null> {
    const result = await this.query(tool);
    if (!result?.asset) return null;
    return {
      version: result.version,
      fileName: result.asset.fileName,
      assetUrl: result.asset.url,
      size: result.asset.size,
      downloadHeaders: {}, // signierte URL braucht keine Auth
    };
  }
}

/**
 * Wählt die aktive Release-Quelle: Proxy bevorzugt (kein GitHub-Token im Client,
 * nur ein niederwertiger Proxy-Key), sonst GitHub-PAT, sonst keine.
 */
export function getReleaseSource(): ReleaseSource | null {
  const proxy = resolveProxy();
  const proxyKey = resolveProxyKey();
  if (proxy && proxyKey) return new ProxyReleaseSource(proxy, proxyKey);
  const token = resolveToken();
  if (token) return new GithubReleaseSource(token);
  return null;
}
