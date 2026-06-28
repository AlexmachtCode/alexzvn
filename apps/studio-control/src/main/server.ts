import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { networkInterfaces } from 'node:os';
import { app } from 'electron';
import { Server as IoServer, type Socket } from 'socket.io';
import { z } from 'zod';

import {
  attachSocketAuth,
  requireHttpAuth,
  requireHttpRole,
  socketCan,
  socketUser,
} from './auth/middleware';
import {
  createSession,
  revokeSession,
} from './auth/sessions';
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
  verifyLogin,
} from './auth/users';
import {
  getDevices,
  loadDevices,
  onDevicesChange,
  removeDevice,
  upsertDevice,
} from './config/devices';
import {
  getTricasters,
  loadTricasters,
  removeTricaster,
  upsertTricaster,
} from './config/tricasters';
import {
  getPtzCameras,
  loadPtzCameras,
  removePtzCamera,
  upsertPtzCamera,
} from './config/ptz';
import { logAction, listRecent, onAudit } from './db/audit';
import { startControlGateway, stopControlGateway } from './gateway/control-gateway';
import { runAll, isScanning } from './discovery';
import {
  getAllStatuses,
  getClient,
  onStatusChange,
  startPolling,
  syncFromConfig,
} from './drivers/tricaster/pool';
import {
  getAllPtzStatuses,
  getPtzClient,
  onPtzStatusChange,
  startPtzPolling,
  syncPtzFromConfig,
} from './drivers/panasonic-ptz/pool';
import { loadLighting } from './config/lighting';
import {
  getLightingState,
  initLighting,
  onLightingChange,
  removeFixture,
  setBlackout,
  setFixtureState,
  setNode,
  upsertFixture,
} from './lighting/engine';
import {
  getAudioConsoles,
  loadAudioConsoles,
  removeAudioConsole,
  updateChannelState,
  upsertAudioConsole,
} from './config/audio';
import {
  getAudioStatuses,
  onAudioStatusChange,
  sendAudio,
  syncAudioFromConfig,
} from './audio/manager';
import { getAtemInstances, loadAtem, removeAtem, upsertAtem } from './config/atem';
import {
  getAtemClient,
  getAtemStatuses,
  onAtemStatusChange,
  syncAtemFromConfig,
} from './drivers/atem/pool';
import { getObsInstances, loadObs, removeObs, upsertObs } from './config/obs';
import {
  getObsClient,
  getObsStatuses,
  onObsStatusChange,
  syncObsFromConfig,
} from './drivers/obs/pool';
import {
  ArtnetNodeSchema,
  AtemConfigSchema,
  AudioConsoleConfigSchema,
  DeviceSchema,
  FixtureSchema,
  ObsConfigSchema,
  PtzCameraConfigSchema,
  TricasterConfigSchema,
} from '@shared/protocol';
import {
  AtemExecSchema,
  AudioExecSchema,
  CreateUserRequestSchema,
  EVENTS,
  LightingBlackoutSchema,
  LightingSetSchema,
  LoginRequestSchema,
  ObsExecSchema,
  PtzExecSchema,
  TricasterExecSchema,
  UpdateUserRequestSchema,
} from '@shared/protocol';
import { DMX_UNIVERSE_SIZE, findProfile } from '@shared/lighting';

export const SERVER_PORT = 7778;
export const SERVER_HOST = '0.0.0.0';
export const VITE_DEV_PORT = 5174;

let http: HttpServer | null = null;
let io: IoServer | null = null;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

function rendererDistDir(): string {
  return path.join(app.getAppPath(), 'out', 'renderer');
}

function serveStatic(req: IncomingMessage, res: ServerResponse): void {
  const distDir = rendererDistDir();
  const url = new URL(req.url ?? '/', 'http://localhost');
  let urlPath = url.pathname;
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  const safe = path.normalize(path.join(distDir, urlPath));
  if (!safe.startsWith(distDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.stat(safe, (err, stat) => {
    if (err || !stat.isFile()) {
      const idx = path.join(distDir, 'index.html');
      fs.readFile(idx, (e2, data) => {
        if (e2) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      });
      return;
    }
    const mime = MIME[path.extname(safe).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=3600',
    });
    fs.createReadStream(safe).pipe(res);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  method: string,
): Promise<boolean> {
  if (pathname === '/health') {
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/login' && method === 'POST') {
    try {
      const body = await readJson(req);
      const parsed = LoginRequestSchema.parse(body);
      const user = verifyLogin(parsed.username, parsed.password);
      if (!user) {
        sendJson(res, 401, { error: 'invalid_credentials' });
        return true;
      }
      const session = createSession(user.id);
      logAction({
        userId: user.id,
        username: user.username,
        action: 'auth:login',
      });
      sendJson(res, 200, {
        token: session.token,
        user: { id: user.id, username: user.username, role: user.role },
      });
    } catch (err) {
      sendJson(res, 400, { error: 'bad_request', detail: String(err) });
    }
    return true;
  }

  if (pathname === '/api/logout' && method === 'POST') {
    const auth = req.headers['authorization'];
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      revokeSession(auth.slice(7).trim());
    }
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/me' && method === 'GET') {
    const user = requireHttpAuth(req, res);
    if (!user) return true;
    sendJson(res, 200, {
      user: { id: user.id, username: user.username, role: user.role },
    });
    return true;
  }

  if (pathname === '/api/users' && method === 'GET') {
    if (!requireHttpRole(req, res, 'users:read')) return true;
    sendJson(res, 200, { users: listUsers() });
    return true;
  }

  if (pathname === '/api/users' && method === 'POST') {
    const actor = requireHttpRole(req, res, 'users:write');
    if (!actor) return true;
    try {
      const body = await readJson(req);
      const parsed = CreateUserRequestSchema.parse(body);
      const user = createUser(parsed);
      logAction({
        userId: actor.id || null,
        username: actor.username,
        action: 'users:create',
        target: user.username,
      });
      sendJson(res, 200, { user });
      broadcastUsersState();
    } catch (err) {
      sendJson(res, 400, { error: 'bad_request', detail: String(err) });
    }
    return true;
  }

  const userMatch = pathname.match(/^\/api\/users\/(\d+)$/);
  if (userMatch) {
    const id = Number(userMatch[1]);
    const actor = requireHttpRole(req, res, 'users:write');
    if (!actor) return true;
    if (method === 'PATCH') {
      try {
        const body = await readJson(req);
        const parsed = UpdateUserRequestSchema.parse(body);
        const user = updateUser(id, parsed);
        if (!user) {
          sendJson(res, 404, { error: 'not_found' });
          return true;
        }
        logAction({
          userId: actor.id || null,
          username: actor.username,
          action: 'users:update',
          target: user.username,
        });
        sendJson(res, 200, { user });
        broadcastUsersState();
      } catch (err) {
        sendJson(res, 400, { error: 'bad_request', detail: String(err) });
      }
      return true;
    }
    if (method === 'DELETE') {
      deleteUser(id);
      logAction({
        userId: actor.id || null,
        username: actor.username,
        action: 'users:delete',
        target: String(id),
      });
      sendJson(res, 200, { ok: true });
      broadcastUsersState();
      return true;
    }
  }

  if (pathname === '/api/tricasters' && method === 'GET') {
    if (!requireHttpRole(req, res, 'tricaster:read')) return true;
    sendJson(res, 200, {
      tricasters: getTricasters(),
      statuses: getAllStatuses(),
    });
    return true;
  }

  if (pathname === '/api/tricasters' && method === 'POST') {
    const actor = requireHttpRole(req, res, 'inventory:write');
    if (!actor) return true;
    try {
      const body = await readJson(req);
      const cfg = TricasterConfigSchema.parse(body);
      upsertTricaster(cfg);
      syncFromConfig();
      logAction({
        userId: actor.id || null,
        username: actor.username,
        action: 'tricaster:upsert',
        target: cfg.id,
      });
      sendJson(res, 200, { tricasters: getTricasters() });
    } catch (err) {
      sendJson(res, 400, { error: 'bad_request', detail: String(err) });
    }
    return true;
  }

  const tcDel = pathname.match(/^\/api\/tricasters\/([^/]+)$/);
  if (tcDel && method === 'DELETE') {
    const actor = requireHttpRole(req, res, 'inventory:write');
    if (!actor) return true;
    removeTricaster(tcDel[1]!);
    syncFromConfig();
    logAction({
      userId: actor.id || null,
      username: actor.username,
      action: 'tricaster:remove',
      target: tcDel[1],
    });
    sendJson(res, 200, { tricasters: getTricasters() });
    return true;
  }

  // ── ATEM (Blackmagic-Mischer) ──────────────────────────────────────────────
  if (pathname === '/api/atem' && method === 'GET') {
    if (!requireHttpRole(req, res, 'atem:read')) return true;
    sendJson(res, 200, { atem: getAtemInstances(), statuses: getAtemStatuses() });
    return true;
  }
  if (pathname === '/api/atem' && method === 'POST') {
    const actor = requireHttpRole(req, res, 'inventory:write');
    if (!actor) return true;
    try {
      const cfg = AtemConfigSchema.parse(await readJson(req));
      upsertAtem(cfg);
      syncAtemFromConfig();
      logAction({ userId: actor.id || null, username: actor.username, action: 'atem:upsert', target: cfg.id });
      sendJson(res, 200, { atem: getAtemInstances() });
    } catch (err) {
      sendJson(res, 400, { error: 'bad_request', detail: String(err) });
    }
    return true;
  }
  const atemDel = pathname.match(/^\/api\/atem\/([^/]+)$/);
  if (atemDel && method === 'DELETE') {
    const actor = requireHttpRole(req, res, 'inventory:write');
    if (!actor) return true;
    removeAtem(atemDel[1]!);
    syncAtemFromConfig();
    logAction({ userId: actor.id || null, username: actor.username, action: 'atem:remove', target: atemDel[1] });
    sendJson(res, 200, { atem: getAtemInstances() });
    return true;
  }

  // ── OBS (WebSocket-Bridge) ─────────────────────────────────────────────────
  if (pathname === '/api/obs' && method === 'GET') {
    if (!requireHttpRole(req, res, 'obs:read')) return true;
    sendJson(res, 200, { obs: getObsInstances(), statuses: getObsStatuses() });
    return true;
  }
  if (pathname === '/api/obs' && method === 'POST') {
    const actor = requireHttpRole(req, res, 'inventory:write');
    if (!actor) return true;
    try {
      const cfg = ObsConfigSchema.parse(await readJson(req));
      upsertObs(cfg);
      syncObsFromConfig();
      logAction({ userId: actor.id || null, username: actor.username, action: 'obs:upsert', target: cfg.id });
      sendJson(res, 200, { obs: getObsInstances() });
    } catch (err) {
      sendJson(res, 400, { error: 'bad_request', detail: String(err) });
    }
    return true;
  }
  const obsDel = pathname.match(/^\/api\/obs\/([^/]+)$/);
  if (obsDel && method === 'DELETE') {
    const actor = requireHttpRole(req, res, 'inventory:write');
    if (!actor) return true;
    removeObs(obsDel[1]!);
    syncObsFromConfig();
    logAction({ userId: actor.id || null, username: actor.username, action: 'obs:remove', target: obsDel[1] });
    sendJson(res, 200, { obs: getObsInstances() });
    return true;
  }

  if (pathname === '/api/ptz' && method === 'GET') {
    if (!requireHttpRole(req, res, 'ptz:read')) return true;
    sendJson(res, 200, {
      cameras: getPtzCameras(),
      statuses: getAllPtzStatuses(),
    });
    return true;
  }

  if (pathname === '/api/ptz' && method === 'POST') {
    const actor = requireHttpRole(req, res, 'inventory:write');
    if (!actor) return true;
    try {
      const body = await readJson(req);
      const cfg = PtzCameraConfigSchema.parse(body);
      upsertPtzCamera(cfg);
      syncPtzFromConfig();
      logAction({
        userId: actor.id || null,
        username: actor.username,
        action: 'ptz:upsert',
        target: cfg.id,
      });
      sendJson(res, 200, { cameras: getPtzCameras() });
      emitPtzState();
    } catch (err) {
      sendJson(res, 400, { error: 'bad_request', detail: String(err) });
    }
    return true;
  }

  const ptzDel = pathname.match(/^\/api\/ptz\/([^/]+)$/);
  if (ptzDel && method === 'DELETE') {
    const actor = requireHttpRole(req, res, 'inventory:write');
    if (!actor) return true;
    removePtzCamera(ptzDel[1]!);
    syncPtzFromConfig();
    logAction({
      userId: actor.id || null,
      username: actor.username,
      action: 'ptz:remove',
      target: ptzDel[1],
    });
    sendJson(res, 200, { cameras: getPtzCameras() });
    emitPtzState();
    return true;
  }

  if (pathname === '/api/lighting' && method === 'GET') {
    if (!requireHttpRole(req, res, 'lighting:read')) return true;
    sendJson(res, 200, getLightingState());
    return true;
  }

  if (pathname === '/api/lighting/node' && method === 'POST') {
    const actor = requireHttpRole(req, res, 'inventory:write');
    if (!actor) return true;
    try {
      const body = await readJson(req);
      const { node } = z.object({ node: ArtnetNodeSchema.nullable() }).parse(body);
      setNode(node);
      logAction({
        userId: actor.id || null,
        username: actor.username,
        action: 'lighting:node',
        target: node?.host ?? '(getrennt)',
      });
      sendJson(res, 200, getLightingState());
    } catch (err) {
      sendJson(res, 400, { error: 'bad_request', detail: String(err) });
    }
    return true;
  }

  if (pathname === '/api/lighting/fixture' && method === 'POST') {
    const actor = requireHttpRole(req, res, 'inventory:write');
    if (!actor) return true;
    try {
      const body = await readJson(req);
      const fx = FixtureSchema.parse(body);
      const profile = findProfile(fx.profileId);
      if (!profile) {
        sendJson(res, 400, { error: 'unknown_profile' });
        return true;
      }
      if (fx.address - 1 + profile.footprint > DMX_UNIVERSE_SIZE) {
        sendJson(res, 400, { error: 'address_out_of_range' });
        return true;
      }
      upsertFixture(fx);
      logAction({
        userId: actor.id || null,
        username: actor.username,
        action: 'lighting:fixture',
        target: fx.id,
      });
      sendJson(res, 200, getLightingState());
    } catch (err) {
      sendJson(res, 400, { error: 'bad_request', detail: String(err) });
    }
    return true;
  }

  const fxDel = pathname.match(/^\/api\/lighting\/fixture\/([^/]+)$/);
  if (fxDel && method === 'DELETE') {
    const actor = requireHttpRole(req, res, 'inventory:write');
    if (!actor) return true;
    removeFixture(fxDel[1]!);
    logAction({
      userId: actor.id || null,
      username: actor.username,
      action: 'lighting:fixture:remove',
      target: fxDel[1],
    });
    sendJson(res, 200, getLightingState());
    return true;
  }

  if (pathname === '/api/audio' && method === 'GET') {
    if (!requireHttpRole(req, res, 'audio:read')) return true;
    sendJson(res, 200, {
      consoles: getAudioConsoles(),
      statuses: getAudioStatuses(),
    });
    return true;
  }

  if (pathname === '/api/audio' && method === 'POST') {
    const actor = requireHttpRole(req, res, 'inventory:write');
    if (!actor) return true;
    try {
      const body = await readJson(req);
      const cfg = AudioConsoleConfigSchema.parse(body);
      upsertAudioConsole(cfg);
      syncAudioFromConfig();
      logAction({
        userId: actor.id || null,
        username: actor.username,
        action: 'audio:upsert',
        target: cfg.id,
      });
      sendJson(res, 200, { consoles: getAudioConsoles() });
      emitAudioState();
    } catch (err) {
      sendJson(res, 400, { error: 'bad_request', detail: String(err) });
    }
    return true;
  }

  const audioDel = pathname.match(/^\/api\/audio\/([^/]+)$/);
  if (audioDel && method === 'DELETE') {
    const actor = requireHttpRole(req, res, 'inventory:write');
    if (!actor) return true;
    removeAudioConsole(audioDel[1]!);
    syncAudioFromConfig();
    logAction({
      userId: actor.id || null,
      username: actor.username,
      action: 'audio:remove',
      target: audioDel[1],
    });
    sendJson(res, 200, { consoles: getAudioConsoles() });
    emitAudioState();
    return true;
  }

  if (pathname === '/api/audit' && method === 'GET') {
    if (!requireHttpRole(req, res, 'audit:read')) return true;
    sendJson(res, 200, { entries: listRecent(100) });
    return true;
  }

  return false;
}

function broadcastUsersState(): void {
  if (!io) return;
  const users = listUsers();
  for (const [, socket] of io.sockets.sockets) {
    if (socketCan(socket, 'users:read')) {
      socket.emit(EVENTS.USERS_STATE, { users });
    }
  }
}

function emitInventory(): void {
  io?.emit(EVENTS.INVENTORY_STATE, { devices: getDevices() });
}

function emitTricasterState(): void {
  io?.emit(EVENTS.TRICASTER_STATE, {
    tricasters: getTricasters(),
    statuses: getAllStatuses(),
  });
}

function emitPtzState(): void {
  io?.emit(EVENTS.PTZ_STATE, {
    cameras: getPtzCameras(),
    statuses: getAllPtzStatuses(),
  });
}

function emitLightingState(): void {
  io?.emit(EVENTS.LIGHTING_STATE, getLightingState());
}

function emitAudioState(): void {
  io?.emit(EVENTS.AUDIO_STATE, {
    consoles: getAudioConsoles(),
    statuses: getAudioStatuses(),
  });
}

function emitAtemState(): void {
  io?.emit(EVENTS.ATEM_STATE, { atem: getAtemInstances(), statuses: getAtemStatuses() });
}

function emitObsState(): void {
  io?.emit(EVENTS.OBS_STATE, { obs: getObsInstances(), statuses: getObsStatuses() });
}

function attachSocketHandlers(socket: Socket): void {
  socket.emit(EVENTS.INVENTORY_STATE, { devices: getDevices() });
  socket.emit(EVENTS.TRICASTER_STATE, {
    tricasters: getTricasters(),
    statuses: getAllStatuses(),
  });
  socket.emit(EVENTS.PTZ_STATE, {
    cameras: getPtzCameras(),
    statuses: getAllPtzStatuses(),
  });
  socket.emit(EVENTS.LIGHTING_STATE, getLightingState());
  socket.emit(EVENTS.AUDIO_STATE, {
    consoles: getAudioConsoles(),
    statuses: getAudioStatuses(),
  });
  socket.emit(EVENTS.ATEM_STATE, { atem: getAtemInstances(), statuses: getAtemStatuses() });
  socket.emit(EVENTS.OBS_STATE, { obs: getObsInstances(), statuses: getObsStatuses() });
  if (socketCan(socket, 'audit:read')) {
    socket.emit('audit:state', { entries: listRecent(100) });
  }
  if (socketCan(socket, 'users:read')) {
    socket.emit(EVENTS.USERS_STATE, { users: listUsers() });
  }

  socket.on(EVENTS.INVENTORY_UPSERT, (payload, ack?: (r: unknown) => void) => {
    if (!socketCan(socket, 'inventory:write')) {
      ack?.({ ok: false, error: 'forbidden' });
      return;
    }
    const parsed = DeviceSchema.safeParse(payload?.device);
    if (!parsed.success) {
      ack?.({ ok: false, error: 'bad_payload' });
      return;
    }
    upsertDevice(parsed.data);
    const user = socketUser(socket);
    logAction({
      userId: user.id || null,
      username: user.username,
      action: 'inventory:upsert',
      target: parsed.data.id,
    });
    ack?.({ ok: true });
  });

  socket.on(EVENTS.INVENTORY_REMOVE, (payload, ack?: (r: unknown) => void) => {
    if (!socketCan(socket, 'inventory:write')) {
      ack?.({ ok: false, error: 'forbidden' });
      return;
    }
    const id = typeof payload?.id === 'string' ? payload.id : null;
    if (!id) {
      ack?.({ ok: false, error: 'bad_payload' });
      return;
    }
    removeDevice(id);
    const user = socketUser(socket);
    logAction({
      userId: user.id || null,
      username: user.username,
      action: 'inventory:remove',
      target: id,
    });
    ack?.({ ok: true });
  });

  socket.on(EVENTS.DISCOVERY_RUN, async (_payload, ack?: (r: unknown) => void) => {
    if (!socketCan(socket, 'discovery:run')) {
      ack?.({ ok: false, error: 'forbidden' });
      return;
    }
    if (isScanning()) {
      ack?.({ ok: false, error: 'already_scanning' });
      return;
    }
    io?.emit(EVENTS.DISCOVERY_START, {});
    const user = socketUser(socket);
    logAction({
      userId: user.id || null,
      username: user.username,
      action: 'discovery:run',
    });
    const result = await runAll(4000, (partial) => {
      io?.emit(EVENTS.DISCOVERY_RESULT, { results: partial });
    });
    io?.emit(EVENTS.DISCOVERY_DONE, {
      count: result.results.length,
      durationMs: result.durationMs,
    });
    ack?.({ ok: true, count: result.results.length });
  });

  socket.on(EVENTS.TRICASTER_EXEC, async (payload, ack?: (r: unknown) => void) => {
    if (!socketCan(socket, 'tricaster:exec')) {
      ack?.({ ok: false, error: 'forbidden' });
      return;
    }
    const parsed = TricasterExecSchema.safeParse(payload);
    if (!parsed.success) {
      ack?.({ ok: false, error: 'bad_payload' });
      return;
    }
    const client = getClient(parsed.data.tricasterId);
    if (!client) {
      ack?.({ ok: false, error: 'unknown_tricaster' });
      return;
    }
    const user = socketUser(socket);
    try {
      await client.shortcut(parsed.data.shortcut, parsed.data.params);
      logAction({
        userId: user.id || null,
        username: user.username,
        action: 'tricaster:exec',
        target: parsed.data.tricasterId,
        payload: { shortcut: parsed.data.shortcut, params: parsed.data.params },
      });
      ack?.({ ok: true });
    } catch (err) {
      logAction({
        userId: user.id || null,
        username: user.username,
        action: 'tricaster:exec:failed',
        target: parsed.data.tricasterId,
        payload: { shortcut: parsed.data.shortcut, error: String(err) },
      });
      ack?.({ ok: false, error: String(err) });
    }
  });

  socket.on(EVENTS.ATEM_EXEC, async (payload, ack?: (r: unknown) => void) => {
    if (!socketCan(socket, 'atem:exec')) {
      ack?.({ ok: false, error: 'forbidden' });
      return;
    }
    const parsed = AtemExecSchema.safeParse(payload);
    if (!parsed.success) {
      ack?.({ ok: false, error: 'bad_payload' });
      return;
    }
    const client = getAtemClient(parsed.data.atemId);
    if (!client) {
      ack?.({ ok: false, error: 'unknown_atem' });
      return;
    }
    const user = socketUser(socket);
    try {
      await client.execute(parsed.data.command);
      logAction({
        userId: user.id || null,
        username: user.username,
        action: 'atem:exec',
        target: parsed.data.atemId,
        payload: parsed.data.command,
      });
      ack?.({ ok: true });
    } catch (err) {
      logAction({
        userId: user.id || null,
        username: user.username,
        action: 'atem:exec:failed',
        target: parsed.data.atemId,
        payload: { command: parsed.data.command, error: String(err) },
      });
      ack?.({ ok: false, error: String(err) });
    }
  });

  socket.on(EVENTS.OBS_EXEC, async (payload, ack?: (r: unknown) => void) => {
    if (!socketCan(socket, 'obs:exec')) {
      ack?.({ ok: false, error: 'forbidden' });
      return;
    }
    const parsed = ObsExecSchema.safeParse(payload);
    if (!parsed.success) {
      ack?.({ ok: false, error: 'bad_payload' });
      return;
    }
    const client = getObsClient(parsed.data.obsId);
    if (!client) {
      ack?.({ ok: false, error: 'unknown_obs' });
      return;
    }
    const user = socketUser(socket);
    try {
      await client.execute(parsed.data.command);
      logAction({
        userId: user.id || null,
        username: user.username,
        action: 'obs:exec',
        target: parsed.data.obsId,
        payload: parsed.data.command,
      });
      ack?.({ ok: true });
    } catch (err) {
      logAction({
        userId: user.id || null,
        username: user.username,
        action: 'obs:exec:failed',
        target: parsed.data.obsId,
        payload: { command: parsed.data.command, error: String(err) },
      });
      ack?.({ ok: false, error: String(err) });
    }
  });

  socket.on(EVENTS.PTZ_EXEC, async (payload, ack?: (r: unknown) => void) => {
    if (!socketCan(socket, 'ptz:exec')) {
      ack?.({ ok: false, error: 'forbidden' });
      return;
    }
    const parsed = PtzExecSchema.safeParse(payload);
    if (!parsed.success) {
      ack?.({ ok: false, error: 'bad_payload' });
      return;
    }
    const client = getPtzClient(parsed.data.cameraId);
    if (!client) {
      ack?.({ ok: false, error: 'unknown_camera' });
      return;
    }
    const user = socketUser(socket);
    const { cameraId, action } = parsed.data;
    try {
      await client.send(action);
      // Continuous drive ticks (pan-tilt/zoom/focus) would flood the audit log —
      // only record discrete, intentional actions.
      if (action.kind !== 'pan-tilt' && action.kind !== 'zoom' && action.kind !== 'focus') {
        logAction({
          userId: user.id || null,
          username: user.username,
          action: 'ptz:exec',
          target: cameraId,
          payload: action,
        });
      }
      ack?.({ ok: true });
    } catch (err) {
      logAction({
        userId: user.id || null,
        username: user.username,
        action: 'ptz:exec:failed',
        target: cameraId,
        payload: { action, error: String(err) },
      });
      ack?.({ ok: false, error: String(err) });
    }
  });

  socket.on(EVENTS.LIGHTING_SET, (payload, ack?: (r: unknown) => void) => {
    if (!socketCan(socket, 'lighting:exec')) {
      ack?.({ ok: false, error: 'forbidden' });
      return;
    }
    const parsed = LightingSetSchema.safeParse(payload);
    if (!parsed.success) {
      ack?.({ ok: false, error: 'bad_payload' });
      return;
    }
    // Live fader/colour move — frequent; applied immediately, not audited or
    // rebroadcast (the engine streams the result to the node).
    const ok = setFixtureState(parsed.data.fixtureId, parsed.data.patch);
    ack?.(ok ? { ok: true } : { ok: false, error: 'unknown_fixture' });
  });

  socket.on(EVENTS.LIGHTING_BLACKOUT, (payload, ack?: (r: unknown) => void) => {
    if (!socketCan(socket, 'lighting:exec')) {
      ack?.({ ok: false, error: 'forbidden' });
      return;
    }
    const parsed = LightingBlackoutSchema.safeParse(payload);
    if (!parsed.success) {
      ack?.({ ok: false, error: 'bad_payload' });
      return;
    }
    setBlackout(parsed.data.on);
    const user = socketUser(socket);
    logAction({
      userId: user.id || null,
      username: user.username,
      action: 'lighting:blackout',
      payload: { on: parsed.data.on },
    });
    ack?.({ ok: true });
  });

  socket.on(EVENTS.AUDIO_EXEC, (payload, ack?: (r: unknown) => void) => {
    if (!socketCan(socket, 'audio:exec')) {
      ack?.({ ok: false, error: 'forbidden' });
      return;
    }
    const parsed = AudioExecSchema.safeParse(payload);
    if (!parsed.success) {
      ack?.({ ok: false, error: 'bad_payload' });
      return;
    }
    const { consoleId, action } = parsed.data;
    const ok = sendAudio(consoleId, action);
    if (ok) {
      // Remember the channel's last-set value (debounced save in config).
      updateChannelState(
        consoleId,
        action.channel,
        action.kind === 'fader' ? { db: action.db } : { mute: action.on },
      );
      // Faders are continuous — only mutes are audited (discrete, intentional).
      if (action.kind === 'mute') {
        const user = socketUser(socket);
        logAction({
          userId: user.id || null,
          username: user.username,
          action: 'audio:mute',
          target: consoleId,
          payload: { channel: action.channel, on: action.on },
        });
      }
    }
    ack?.(ok ? { ok: true } : { ok: false, error: 'send_failed' });
  });
}

export function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    loadDevices();
    loadTricasters();
    loadPtzCameras();
    loadLighting();
    loadAudioConsoles();
    loadAtem();
    loadObs();
    syncFromConfig();
    syncPtzFromConfig();
    initLighting();
    syncAudioFromConfig();
    syncAtemFromConfig();
    syncObsFromConfig();
    startPolling();
    startPtzPolling();

    const distIndex = path.join(rendererDistDir(), 'index.html');
    const canServeStatic = fs.existsSync(distIndex);

    http = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const pathname = url.pathname;
      const method = (req.method ?? 'GET').toUpperCase();

      // Dev-only CORS: Im Dev läuft der Renderer auf dem Vite-Server (anderer
      // Origin als der API-Port) → `POST /api/login` mit JSON ist cross-origin und
      // wird ohne diese Header per Preflight geblockt („Failed to fetch"). Der
      // gepackte Build liefert den Renderer von DIESEM Server aus (same-origin),
      // braucht also kein CORS → bewusst dev-only, um die Produktions-Angriffs-
      // fläche nicht zu vergrößern. Auth läuft über Bearer-Token (kein Cookie),
      // daher ist das Spiegeln des Origins unkritisch.
      if (!app.isPackaged) {
        const origin = req.headers.origin;
        if (origin) {
          res.setHeader('Access-Control-Allow-Origin', origin);
          res.setHeader('Vary', 'Origin');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        }
        if (method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }
      }

      handleApi(req, res, pathname, method).then((handled) => {
        if (handled) return;
        if (pathname.startsWith('/api/')) {
          sendJson(res, 404, { error: 'not_found' });
          return;
        }
        if (!canServeStatic) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(
            'JM Studio Control dev server\n\nNo built renderer found.\n' +
              'Run `npm run build` first, or use the Vite dev server.\n',
          );
          return;
        }
        serveStatic(req, res);
      });
    });

    io = new IoServer(http, {
      cors: { origin: '*' },
      pingTimeout: 4000,
      pingInterval: 2000,
    });

    attachSocketAuth(io);

    io.on('connection', (socket) => {
      attachSocketHandlers(socket);
    });

    onDevicesChange(() => emitInventory());
    onStatusChange(() => emitTricasterState());
    onPtzStatusChange(() => emitPtzState());
    onLightingChange(() => emitLightingState());
    onAudioStatusChange(() => emitAudioState());
    onAtemStatusChange(() => emitAtemState());
    onObsStatusChange(() => emitObsState());
    onAudit((entry) => {
      if (!io) return;
      for (const [, socket] of io.sockets.sockets) {
        if (socketCan(socket, 'audit:read')) {
          socket.emit(EVENTS.AUDIT_APPEND, entry);
        }
      }
    });

    http.once('error', reject);
    http.listen(SERVER_PORT, SERVER_HOST, () => {
      console.log(
        `[jm-studio-control] http + socket.io listening on http://${SERVER_HOST}:${SERVER_PORT}`,
      );
      // Companion-Gateway (TCP-Steuerprotokoll, Port 8735) zusätzlich starten —
      // fehlertolerant: ein belegter Port darf den HTTP-/Socket.IO-Server nicht
      // verhindern.
      startControlGateway()
        .then((r) => {
          if (r.ok) {
            console.log(`[jm-studio-control] companion gateway listening on tcp://0.0.0.0:${r.port}`);
          } else {
            console.warn(`[jm-studio-control] companion gateway not started: ${r.error}`);
          }
        })
        .catch((e) => console.warn('[jm-studio-control] companion gateway error', e));
      resolve();
    });
  });
}

export function stopServer(): void {
  stopControlGateway();
  io?.close();
  http?.close();
  io = null;
  http = null;
}

export function getLanAddresses(): string[] {
  const out: string[] = [];
  const ifaces = networkInterfaces();
  for (const list of Object.values(ifaces)) {
    if (!list) continue;
    for (const iface of list) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address) {
        out.push(iface.address);
      }
    }
  }
  return out;
}

export function getRemoteUrls(): string[] {
  const port = app.isPackaged ? SERVER_PORT : VITE_DEV_PORT;
  return getLanAddresses().map((ip) => `http://${ip}:${port}/`);
}
