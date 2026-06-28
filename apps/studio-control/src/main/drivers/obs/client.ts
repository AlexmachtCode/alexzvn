import OBSWebSocketDefault from 'obs-websocket-js';
import type { ObsCommand, ObsConfig, ObsStatus } from '@shared/obs';

const RECONNECT_MS = 3000;

// obs-websocket-js v5 ist ein ESM-first-Dual-Package. Im CJS-Main-Bundle
// (electron-vite + externalizeDepsPlugin → require) liefert der Default-Import je
// nach Interop die Modul-Namespace-Hülle statt der Klasse → `new OBSWebSocket()`
// warf „OBSWebSocket is not a constructor" (Issue #91). Das blockierte zugleich
// den (Dev-)Start, weil startServer() den OBS-Pool eager aufbaut und der throw
// das Fenster nie aufkommen ließ. Konstruktor robust aus beiden Formen ziehen.
const OBSWebSocket = ((OBSWebSocketDefault as unknown as { default?: typeof OBSWebSocketDefault })
  .default ?? OBSWebSocketDefault) as typeof OBSWebSocketDefault;

/**
 * Brücke zu einer OBS-Instanz über das obs-websocket-v5-Protokoll. Event-getrieben
 * (kein Polling): Szenenwechsel, Record/Stream-Status kommen als Events. Bei
 * Verbindungsverlust wird automatisch neu verbunden. Reines JS (ws) — CI-tauglich.
 */
export class ObsClient {
  private readonly obs = new OBSWebSocket();
  private status: ObsStatus;
  private closed = false;
  private reconnectT: NodeJS.Timeout | null = null;

  constructor(
    private readonly cfg: ObsConfig,
    private readonly onStatus: (s: ObsStatus) => void,
  ) {
    this.status = { id: cfg.id, state: 'connecting', lastChecked: 0 };

    this.obs.on('ConnectionClosed', () => {
      if (this.closed) return;
      this.patch({ state: 'down', recording: undefined, streaming: undefined });
      this.scheduleReconnect();
    });
    this.obs.on('CurrentProgramSceneChanged', (d) => this.patch({ currentScene: d.sceneName }));
    this.obs.on('SceneListChanged', () => void this.refreshScenes());
    this.obs.on('SceneNameChanged', () => void this.refreshScenes());
    this.obs.on('RecordStateChanged', (d) => this.patch({ recording: d.outputActive }));
    this.obs.on('StreamStateChanged', (d) => this.patch({ streaming: d.outputActive }));

    void this.connect();
  }

  private async connect(): Promise<void> {
    try {
      const url = `ws://${this.cfg.host}:${this.cfg.port}`;
      await this.obs.connect(url, this.cfg.password || undefined);
      const [list, rec, stream] = await Promise.all([
        this.obs.call('GetSceneList'),
        this.obs.call('GetRecordStatus'),
        this.obs.call('GetStreamStatus'),
      ]);
      this.patch({
        state: 'connected',
        lastError: undefined,
        currentScene: list.currentProgramSceneName,
        scenes: sceneNames(list.scenes),
        recording: rec.outputActive,
        streaming: stream.outputActive,
      });
    } catch (err) {
      this.patch({ state: 'down', lastError: describe(err) });
      this.scheduleReconnect();
    }
  }

  private async refreshScenes(): Promise<void> {
    try {
      const list = await this.obs.call('GetSceneList');
      this.patch({ scenes: sceneNames(list.scenes), currentScene: list.currentProgramSceneName });
    } catch {
      /* ignore — Reconnect-Pfad übernimmt */
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectT || this.closed) return;
    this.reconnectT = setTimeout(() => {
      this.reconnectT = null;
      if (!this.closed) void this.connect();
    }, RECONNECT_MS);
  }

  private patch(p: Partial<ObsStatus>): void {
    this.status = { ...this.status, ...p, lastChecked: Date.now() };
    this.onStatus(this.status);
  }

  getStatus(): ObsStatus {
    return this.status;
  }

  async execute(cmd: ObsCommand): Promise<void> {
    switch (cmd.type) {
      case 'scene':
        await this.obs.call('SetCurrentProgramScene', { sceneName: cmd.scene });
        break;
      case 'record':
        await this.obs.call(cmd.on === undefined ? 'ToggleRecord' : cmd.on ? 'StartRecord' : 'StopRecord');
        break;
      case 'stream':
        await this.obs.call(cmd.on === undefined ? 'ToggleStream' : cmd.on ? 'StartStream' : 'StopStream');
        break;
    }
  }

  dispose(): void {
    this.closed = true;
    if (this.reconnectT) clearTimeout(this.reconnectT);
    void this.obs.disconnect();
  }
}

/** Szenennamen extrahieren; OBS liefert sie von unten nach oben → für Anzeige umdrehen. */
function sceneNames(scenes: unknown[]): string[] {
  return scenes
    .map((s) => (s as { sceneName?: string }).sceneName)
    .filter((n): n is string => typeof n === 'string')
    .reverse();
}

function describe(err: unknown): string {
  const m = (err as { message?: string })?.message;
  if (m) return m;
  return err instanceof Error ? err.message : String(err);
}
