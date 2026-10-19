import type { Platform, ToolManifest } from '@jm/suite-manifest';
import { resolveProxy, resolveProxyKey, resolveToken } from './settings';
import { holeAlleSeiten, RELEASES_PRO_SEITE } from './release-liste';
import { proxyAntwortAuswerten, waehleRelease, type PaketWahl, type ReleaseEintrag } from './release-wahl';

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

/** Plattform dieses Rechners für Katalog und Proxy; exportiert für die Texte T29/T69 in installer.ts. */
export function platformKey(): Platform | null {
  if (process.platform === 'darwin') return 'mac';
  if (process.platform === 'win32') return 'win';
  return null;
}

/** Architektur des Launcher-Prozesses; ein x64-Launcher unter Rosetta zählt als x64 (Spec 10.5, FP12). */
export function archToken(): 'arm64' | 'x64' {
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

// Versionsvergleich und die Regel „neuestes Release mit passendem Paket“ stehen in release-wahl.ts (iveo-Paket,
// Spec 10.4, 10.5): rein, im Launcher-Selbsttest geprüft, mit derselben Testtabelle wie der Release-Proxy.
type GithubRelease = ReleaseEintrag;

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

/**
 * GitHub-Releases im gemeinsamen Monorepo via fine-grained PAT (read-only
 * contents). Tools teilen sich `repo` und werden über das Tag-Präfix
 * `<app>-v<version>` unterschieden. Gewählt wird das neueste Release mit einem
 * Paket für diesen Rechner, zuerst mit dem genauen Namen aus dem Katalog
 * (waehleRelease, Spec 10.5); `/releases/latest` taugt im Monorepo nicht, da es
 * nur das eine neueste Release der ganzen Repo liefert.
 */
class GithubReleaseSource implements ReleaseSource {
  constructor(private readonly token: string) {}

  /** Die eine Wahl für Update-Prüfung und Download (Spec 10.5 Nr. 7); null ohne bekannte Plattform. */
  private async wahl(tool: ToolManifest): Promise<PaketWahl | null> {
    const plattform = platformKey();
    if (!plattform) return null;
    const releases = await listGithubReleases(tool.repo, this.token);
    return waehleRelease(releases, `${tool.app}-v`, plattform, archToken(), (version) => resolveArtifactName(tool, version));
  }

  async latestVersion(tool: ToolManifest): Promise<string | null> {
    const wahl = await this.wahl(tool);
    return wahl?.art === 'gewaehlt' ? wahl.version : null;
  }

  async latest(tool: ToolManifest): Promise<ResolvedAsset | null> {
    const wahl = await this.wahl(tool);
    if (wahl?.art !== 'gewaehlt') return null;
    const { version, asset } = wahl;

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
  ): Promise<{ version: string; asset: { url: string; size: number; fileName: string } | null } | null> {
    const platform = platformKey();
    if (!platform) return null;
    const url =
      `${this.base.replace(/\/$/, '')}/tools/${tool.id}/latest` +
      `?platform=${platform}&arch=${archToken()}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'X-Proxy-Key': this.key },
    });
    // Der Fehlertext des Proxys bleibt erhalten, z. B. „Proxy 404: kein Release von connect mit einem Paket für macOS
    // (x64)“ (Spec 10.4, 11.5 F2–F6); der Proxy-Key steht in keiner Meldung.
    return proxyAntwortAuswerten(res, platform);
  }

  async latestVersion(tool: ToolManifest): Promise<string | null> {
    // Ein Release ohne Paket für diesen Rechner gilt nicht als Update (Spec 10.5 Nr. 7).
    const r = await this.query(tool);
    return r?.asset ? r.version : null;
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
