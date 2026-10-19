import { app } from 'electron';
import type { ToolManifest, ToolState } from '@jm/suite-manifest';
import type { LauncherUpdate } from '@shared/types';
import { getAllStates } from './install-state';
import { getReleaseSource, type ReleaseSource } from './release-source';
import { compareVersions } from './release-wahl';

// Kurzlebiger Cache der online ermittelten Versionen, damit häufiges Neuprüfen
// (z. B. Fenster-Fokus) nicht bei jedem Mal die Releases-API anfragt. Fehler
// werden NICHT gecached → beim nächsten Versuch wird wieder online geprüft.
const TTL_MS = 5 * 60 * 1000;
const versionCache = new Map<string, { value: string | null; at: number }>();

async function cachedLatestVersion(source: ReleaseSource, tool: ToolManifest): Promise<string | null> {
  const hit = versionCache.get(tool.id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = await source.latestVersion(tool);
  versionCache.set(tool.id, { value, at: Date.now() });
  return value;
}

/**
 * Reichert die plattenbasierten Tool-Zustände um eine LIVE-Update-Prüfung an:
 * Für jedes installierte Tool mit bekannter Version wird die neueste Release-
 * Version aus der konfigurierten Quelle geholt; ist sie höher, wird der Status
 * auf `update-available` gesetzt und die verfügbare Version mitgegeben.
 *
 * Online-gated: Ohne Quelle (kein Token/Proxy) oder bei Netzfehlern bleiben die
 * Zustände unverändert — es werden also nie falsche Update-Hinweise erzeugt.
 * Tools ohne bekannte installierte Version (z. B. außerhalb des Launchers
 * installiert) werden übersprungen, da kein Vergleich möglich ist.
 */
export async function checkToolUpdates(tools: ToolManifest[]): Promise<ToolState[]> {
  const base = getAllStates(tools);
  const source = getReleaseSource();
  if (!source) return base;

  const byId = new Map(tools.map((t) => [t.id, t]));
  return Promise.all(
    base.map(async (state) => {
      if (state.status !== 'installed' || !state.installedVersion) return state;
      const tool = byId.get(state.id);
      if (!tool) return state;
      try {
        const latest = await cachedLatestVersion(source, tool);
        if (latest && compareVersions(latest, state.installedVersion) > 0) {
          return { ...state, status: 'update-available' as const, latestAvailable: latest };
        }
      } catch {
        // offline / Quelle nicht erreichbar → Zustand unverändert lassen
      }
      return state;
    }),
  );
}

/**
 * Pseudo-Manifest für den Launcher selbst, damit Download/Asset-Auflösung (über
 * dieselbe ReleaseSource wie bei den Tools) wiederverwendet werden kann. Tag-
 * Präfix `launcher-v`, Artefaktnamen entsprechend electron-builder.yml.
 */
export function launcherManifest(tools: ToolManifest[]): ToolManifest | null {
  const repo = tools[0]?.repo;
  if (!repo) return null;
  return {
    id: 'launcher',
    name: 'JM Production Suite',
    tagline: '',
    description: '',
    category: 'Utilities',
    appId: 'gmbh.jakobs.production-suite',
    repo,
    app: 'launcher',
    latestVersion: app.getVersion(),
    platforms: {
      win: { artifact: 'JM Production Suite-${version}-win-x64.exe' },
      mac: { artifact: 'JM Production Suite-${version}-mac-${arch}.dmg' },
    },
  };
}

/**
 * Prüft, ob es eine neuere Launcher-Version gibt (Release-Tag `launcher-v*` im
 * selben Repo wie die Tools). Nutzt DIESELBE Quelle wie der eigentliche
 * Launcher-Download (`updateLauncher`) — also Proxy bevorzugt, sonst Token —,
 * damit tokenlose Clients ihre eigenen Updates ebenfalls erkennen. Liefert die
 * Info nur, wenn online eine höhere Version gefunden wird — sonst null.
 */
export async function checkLauncherUpdate(tools: ToolManifest[]): Promise<LauncherUpdate | null> {
  const source = getReleaseSource();
  const launcher = launcherManifest(tools);
  if (!source || !launcher) return null;
  const current = app.getVersion();
  try {
    const latest = await source.latestVersion(launcher);
    if (latest && compareVersions(latest, current) > 0) {
      return { current, latest };
    }
  } catch {
    // offline / Quelle nicht erreichbar → keine Aussage
  }
  return null;
}
