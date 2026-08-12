// Die oeffentliche Flaeche des Pakets. Was Stage 4 (Anbindung an apps/connect)
// benutzt, steht hier - und nur das.
export { Bridge, binPath, type BridgeOptions } from './bridge.ts';
export { buildJwt, readCredentials, type JwtOptions } from './jwt.ts';
export { initialSession, isSettled, reduce, type Session } from './state.ts';
export {
  normalizeMeetingId,
  sdkErrorName,
  authResultName,
  explainStatus,
  type BridgeEvent,
  type Command,
  type MeetingStatusName,
  type Participant,
  type UserRoleName,
  type WireEvent,
} from './protocol.ts';
