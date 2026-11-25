// ─────────────────────────────────────────────────────────────────────────────
// Studio-Control-Gateway — exponiert die Gerätetreiber über das suite-weite
// TCP-Zeilenprotokoll (@jm/suite-control-protocol) an Bitfocus Companion,
// ZUSÄTZLICH zum bestehenden REST-/Socket.IO-Pfad (Port 7778). So lässt sich der
// ganze Studio-Hub aus Companion fernsteuern — und jeder Befehl landet zentral
// im Audit-Log (Anforderung „zentral-auditierte Steuerung" für regulierte
// Umgebungen, Roadmap Welle 5).
//
// Modell: studio-control ist ein Geräte-HUB (mehrere ATEMs/OBS/TriCaster
// möglich). Das Protokoll/Companion-Modell ist „eine Rolle = ein logisches
// Gerät mit flachem Verb-Set". Wir bündeln daher alle Gerätetypen in EINER
// Rolle `studio` mit typ-präfixierten Verben (atem_/obs_/tricaster_) und
// bedienen je Typ die PRIMÄR-Instanz (die erste konfigurierte). Abgedeckt:
// ATEM, OBS, TriCaster, Panasonic-PTZ, Audiopult, Art-Net-Licht. Mehrinstanz-
// Adressierung (mehrere ATEMs etc.) ist eine spätere Ausbaustufe.
//
//   Client → Gateway:  STUDIO atem_program <n> | STUDIO atem_cut | STUDIO
//                      obs_scene <n> | STUDIO obs_record on|off | STUDIO
//                      tricaster_shortcut <name> | STATE?
//   Gateway → Client:  STATE ns=studio atem=0|1 atem_pgm=… obs=0|1 obs_scene=…
//
// mDNS: als Steuer-Endpunkt annonciert (controlEndpoint:true → TXT ctl=1, Name
// jm-studio-control-ctl). studio-control hat sonst KEINEN _jmps._tcp-Advert, es
// gibt also keine Namenskollision.
//
// Auth/Audit: Das TCP-Zeilenprotokoll kennt keinen Token-Handshake (Companion
// nutzt TCPHelper ohne Auth) — das Gateway handelt daher unter einer festen
// Dienst-Identität `companion-gateway`. Jeder Befehl wird über logAction()
// protokolliert (wer/was/Ziel/Payload). Das ist konsistent mit den übrigen
// Suite-Tools, deren TCP-Steuerports im vertrauenswürdigen Produktions-LAN
// ebenfalls unauthentifiziert sind; die Nachvollziehbarkeit liefert das Audit.
//
// Nur im Main-Prozess verwenden (node:net über @jm/suite-control-protocol).
import { SuiteControlServer } from '@jm/suite-control-protocol/server';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';
import { getAtemClient, getAtemStatuses, onAtemStatusChange } from '../drivers/atem/pool';
import { getObsClient, getObsStatuses, onObsStatusChange } from '../drivers/obs/pool';
import {
  getClient as getTricasterClient,
  getAllStatuses as getTricasterStatuses,
  onStatusChange as onTricasterStatusChange,
} from '../drivers/tricaster/pool';
import { getPtzClient, getAllPtzStatuses, onPtzStatusChange } from '../drivers/panasonic-ptz/pool';
import { sendAudio, getAudioStatuses, onAudioStatusChange } from '../audio/manager';
import { setBlackout, getLightingState, onLightingChange } from '../lighting/engine';
import { getAtemInstances } from '../config/atem';
import { getObsInstances } from '../config/obs';
import { getTricasters } from '../config/tricasters';
import { getPtzCameras } from '../config/ptz';
import { getAudioConsoles } from '../config/audio';
import { logAction } from '../db/audit';
import type { FernsteuerungEreignis } from '@shared/fernsteuerung';
import type { AtemCommand, AtemStatus } from '@shared/atem';
import type { ObsCommand, ObsStatus } from '@shared/obs';
import type { TricasterStatus } from '@shared/tricaster';
import type { PtzAction, PtzStatus } from '@shared/ptz';
import type { AudioAction, AudioStatus } from '@shared/audio';

/** Eigener TCP-Steuerport (getrennt vom REST-/Socket.IO-Port 7778). */
export const CONTROL_PORT = 8735;

/** Feste Audit-Identität für alle Gateway-Befehle. */
const GATEWAY_USERNAME = 'companion-gateway';

let server: SuiteControlServer | null = null;
const unsubscribers: Array<() => void> = [];

// ── Hilfen ───────────────────────────────────────────────────────────────────

/** STATE ist whitespace-getrennt → Leerzeichen ersetzen, leer → '-'. */
function san(s: string | undefined | null): string {
  const t = (s ?? '').trim().replace(/\s+/g, '_');
  return t || '-';
}

/** on/off/toggle (oder leer) → true/false/undefined (undefined = umschalten). */
function parseMode(arg: string | undefined): boolean | undefined {
  if (arg == null) return undefined;
  const u = arg.toLowerCase();
  if (u === 'on' || u === '1' || u === 'true' || u === 'start') return true;
  if (u === 'off' || u === '0' || u === 'false' || u === 'stop') return false;
  return undefined; // 'toggle' o. Ä.
}

/** Die Primär-Instanz (erste konfigurierte) eines Typs + ihr Live-Status. */
function primaryAtem(): { id: string; status?: AtemStatus } | null {
  const cfg = getAtemInstances()[0];
  if (!cfg) return null;
  return { id: cfg.id, status: getAtemStatuses().find((s) => s.id === cfg.id) };
}
function primaryObs(): { id: string; name: string; status?: ObsStatus } | null {
  const cfg = getObsInstances()[0];
  if (!cfg) return null;
  return { id: cfg.id, name: cfg.name, status: getObsStatuses().find((s) => s.id === cfg.id) };
}
function primaryTricaster(): { id: string; name: string; status?: TricasterStatus } | null {
  const cfg = getTricasters()[0];
  if (!cfg) return null;
  return { id: cfg.id, name: cfg.name, status: getTricasterStatuses().find((s) => s.id === cfg.id) };
}
function primaryPtz(): { id: string; name: string; status?: PtzStatus } | null {
  const cfg = getPtzCameras()[0];
  if (!cfg) return null;
  return { id: cfg.id, name: cfg.name, status: getAllPtzStatuses().find((s) => s.id === cfg.id) };
}
function primaryAudio(): { id: string; name: string; status?: AudioStatus } | null {
  const cfg = getAudioConsoles()[0];
  if (!cfg) return null;
  return { id: cfg.id, name: cfg.name, status: getAudioStatuses().find((s) => s.id === cfg.id) };
}

/** 1-basierter Index der aktuellen OBS-Szene in der Szenenliste (0 = unbekannt). */
function obsSceneIndex(status: ObsStatus | undefined): number {
  if (!status?.currentScene || !status.scenes) return 0;
  const i = status.scenes.indexOf(status.currentScene);
  return i >= 0 ? i + 1 : 0;
}

// ── STATE-Aufbau (Primär-Instanz je Typ) ─────────────────────────────────────

function buildState(): SuiteState {
  const atem = primaryAtem();
  const obs = primaryObs();
  const tc = primaryTricaster();
  const ptz = primaryPtz();
  const audio = primaryAudio();
  const light = getLightingState();
  const a = atem?.status;
  const o = obs?.status;
  return {
    ns: 'studio',
    kv: {
      atem: a?.state === 'connected',
      atem_name: san(a?.model),
      atem_pgm: a?.program ?? 0,
      atem_pvw: a?.preview ?? 0,
      atem_rec: !!a?.recording,
      atem_stream: !!a?.streaming,
      obs: o?.state === 'connected',
      obs_scene: obsSceneIndex(o),
      obs_scene_name: san(o?.currentScene),
      obs_rec: !!o?.recording,
      obs_stream: !!o?.streaming,
      tricaster: tc?.status?.state === 'connected',
      tricaster_name: san(tc?.name),
      ptz: ptz?.status?.state === 'connected',
      ptz_name: san(ptz?.name),
      ptz_power: ptz?.status?.power === 'on',
      audio: audio?.status?.state === 'connected',
      audio_name: san(audio?.name),
      lighting: light.config.node != null,
      lighting_blackout: light.blackout,
    },
  };
}

// ── Befehls-Routing ──────────────────────────────────────────────────────────

/** Audit + (best effort) Befehl ausführen. */
async function runAudited(verb: string, target: string, payload: unknown, exec: () => Promise<void>): Promise<void> {
  try {
    await exec();
    logAction({ userId: null, username: GATEWAY_USERNAME, action: `gateway:${verb}`, target, payload });
  } catch (err) {
    logAction({
      userId: null,
      username: GATEWAY_USERNAME,
      action: `gateway:${verb}:failed`,
      target,
      payload: { ...(payload as object), error: String(err) },
    });
  }
}

function num(arg: string | undefined): number {
  const n = Number(arg);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

async function handleAtem(verb: string, args: string[]): Promise<boolean> {
  const p = primaryAtem();
  if (!p) return false;
  const client = getAtemClient(p.id);
  if (!client) return false;
  let cmd: AtemCommand | null = null;
  switch (verb) {
    case 'atem_program': cmd = { type: 'program', input: Math.max(0, num(args[0])) }; break;
    case 'atem_preview': cmd = { type: 'preview', input: Math.max(0, num(args[0])) }; break;
    case 'atem_cut': cmd = { type: 'cut' }; break;
    case 'atem_auto': cmd = { type: 'auto' }; break;
    case 'atem_ftb': cmd = { type: 'ftb' }; break;
    case 'atem_record': cmd = { type: 'record', on: parseMode(args[0]) }; break;
    case 'atem_stream': cmd = { type: 'stream', on: parseMode(args[0]) }; break;
    default: return false;
  }
  await runAudited(verb, p.id, { command: cmd }, () => client.execute(cmd as AtemCommand));
  return true;
}

async function handleObs(verb: string, args: string[]): Promise<boolean> {
  const p = primaryObs();
  if (!p) return false;
  const client = getObsClient(p.id);
  if (!client) return false;
  let cmd: ObsCommand | null = null;
  switch (verb) {
    case 'obs_scene': {
      const scenes = p.status?.scenes ?? [];
      const scene = scenes[num(args[0]) - 1];
      if (!scene) return false; // Index außerhalb / Szenen unbekannt
      cmd = { type: 'scene', scene };
      break;
    }
    case 'obs_record': cmd = { type: 'record', on: parseMode(args[0]) }; break;
    case 'obs_stream': cmd = { type: 'stream', on: parseMode(args[0]) }; break;
    default: return false;
  }
  await runAudited(verb, p.id, { command: cmd }, () => client.execute(cmd as ObsCommand));
  return true;
}

async function handleTricaster(verb: string, args: string[]): Promise<boolean> {
  if (verb !== 'tricaster_shortcut') return false;
  const p = primaryTricaster();
  if (!p) return false;
  const client = getTricasterClient(p.id);
  if (!client) return false;
  const name = args[0];
  if (!name) return false;
  await runAudited(verb, p.id, { shortcut: name }, () => client.shortcut(name));
  return true;
}

async function handlePtz(verb: string, args: string[]): Promise<boolean> {
  const p = primaryPtz();
  if (!p) return false;
  const client = getPtzClient(p.id);
  if (!client) return false;
  let action: PtzAction | null = null;
  switch (verb) {
    case 'ptz_preset':
      action = { kind: 'preset-recall', preset: Math.max(0, Math.min(99, num(args[0]))) };
      break;
    case 'ptz_power': {
      // Toggle (mode undefined) anhand des zuletzt gepollten Power-Status auflösen.
      const on = parseMode(args[0]) ?? p.status?.power !== 'on';
      action = { kind: 'power', on };
      break;
    }
    default:
      return false;
  }
  await runAudited(verb, p.id, { action }, async () => {
    await client.send(action as PtzAction);
  });
  return true;
}

async function handleAudio(verb: string, args: string[]): Promise<boolean> {
  const p = primaryAudio();
  if (!p) return false;
  const channel = Math.max(1, Math.min(64, num(args[0])));
  let action: AudioAction | null = null;
  switch (verb) {
    case 'audio_mute':
      // Expliziter on/off-Token (kein Toggle — der Status führt keine Kanal-Mutes).
      action = { kind: 'mute', channel, on: (args[1] ?? 'on').toLowerCase() !== 'off' };
      break;
    case 'audio_fader': {
      const db = Number(args[1]);
      if (!Number.isFinite(db)) return false;
      action = { kind: 'fader', channel, db };
      break;
    }
    default:
      return false;
  }
  await runAudited(verb, p.id, { action }, async () => {
    if (!sendAudio(p.id, action as AudioAction)) throw new Error('audio send failed');
  });
  return true;
}

async function handleLighting(verb: string, args: string[]): Promise<boolean> {
  if (verb !== 'lighting_blackout') return false;
  // Toggle (mode undefined) anhand des aktuellen Blackout-Zustands auflösen.
  const on = parseMode(args[0]) ?? !getLightingState().blackout;
  await runAudited(verb, 'lighting', { on }, async () => setBlackout(on));
  return true;
}

async function dispatch(cmd: SuiteCommand): Promise<void> {
  if (cmd.ns !== 'studio') return;
  let handled = false;
  if (cmd.verb.startsWith('atem_')) handled = await handleAtem(cmd.verb, cmd.args);
  else if (cmd.verb.startsWith('obs_')) handled = await handleObs(cmd.verb, cmd.args);
  else if (cmd.verb.startsWith('tricaster_')) handled = await handleTricaster(cmd.verb, cmd.args);
  else if (cmd.verb.startsWith('ptz_')) handled = await handlePtz(cmd.verb, cmd.args);
  else if (cmd.verb.startsWith('audio_')) handled = await handleAudio(cmd.verb, cmd.args);
  else if (cmd.verb.startsWith('lighting_')) handled = await handleLighting(cmd.verb, cmd.args);
  // Nach einem ausgeführten Befehl sofort den Zustand zurückspiegeln (die
  // Treiber-Events pushen ohnehin nochmal, sobald sich der reale Status ändert).
  if (handled) server?.pushState(buildState());
}

// ── Lebenszyklus ─────────────────────────────────────────────────────────────

/**
 * onMeldung (UX Welle 2b): reicht jeden Statuswechsel des Servers mit dem Modus der meldenden Instanz weiter (Rückspiel Task 26,
 * Regel aus Task 21: srv.modus(), nicht die Modulvariable), nur lesend. Port, Verben und Protokoll bleiben. Start-Ergebnis und
 * Wurf meldet der Aufrufer (server.ts).
 */
export function startControlGateway(
  onMeldung?: (e: FernsteuerungEreignis) => void,
): Promise<{ ok: boolean; error?: string; port?: number }> {
  stopControlGateway();
  const srv = new SuiteControlServer({
    role: 'studio',
    appId: 'jm-studio-control',
    controlEndpoint: true,
    getState: buildState,
    onStatus: (st) => {
      onMeldung?.({ art: 'status', ...st, modus: srv.modus() });
    },
    onCommand: (cmd) => {
      void dispatch(cmd);
    },
  });
  server = srv;
  // Jede Treiber-Statusänderung sofort an Companion broadcasten (no-op ohne
  // Clients, daher günstig).
  const push = (): void => server?.pushState(buildState());
  unsubscribers.push(onAtemStatusChange(push));
  unsubscribers.push(onObsStatusChange(push));
  unsubscribers.push(onTricasterStatusChange(push));
  unsubscribers.push(onPtzStatusChange(push));
  unsubscribers.push(onAudioStatusChange(push));
  unsubscribers.push(onLightingChange(push));
  return server.start(CONTROL_PORT);
}

export function stopControlGateway(): void {
  while (unsubscribers.length) unsubscribers.pop()?.();
  if (server) {
    server.stop();
    server = null;
  }
}

export function gatewayStatus(): { running: boolean; port: number; clients: number } {
  return server?.status() ?? { running: false, port: CONTROL_PORT, clients: 0 };
}
