// Die oeffentliche Flaeche des Pakets. Was Stage 4 (Anbindung an apps/connect)
// benutzt, steht hier - und nur das.
export { Bridge, binPath, type BridgeOptions } from './bridge.ts';
export { buildJwt, readCredentials, type JwtOptions } from './jwt.ts';
export { initialSession, isSettled, reduce, type Session } from './state.ts';
export { SDK_FASSUNG, SDK_FASSUNG_BRIDGE, peInfo, findeSdkBin, type PeInfo } from './sdk.ts';
export {
  normalizeMeetingId,
  sdkErrorName,
  authResultName,
  explainStatus,
  FAIL_CODE_NAMES,
  failCodeName,
  failReason,
  endReason,
  type AudioReason,
  type AudioState,
  type BridgeEvent,
  type Command,
  type MeetingStatusName,
  type Participant,
  type UserRoleName,
  type VideoReason,
  type VideoState,
  type WireEvent,
} from './protocol.ts';
