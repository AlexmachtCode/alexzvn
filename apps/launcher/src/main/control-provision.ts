import { app } from 'electron';
import selfsigned from 'selfsigned';
import { certFingerprint, randomToken } from '@jm/auth-core';
import {
  readControlConfig,
  writeControlConfig,
  type SuiteControlConfig,
} from '@jm/control-config';
import type { ControlPlaneStatus } from '@shared/types';

// Provisionierung der sicheren Steuerebene (P1-Adoption Welle 2, #59).
// Der Launcher erzeugt EIN Suite-Token, einen mDNS-Pairing-Key und ein
// selbstsigniertes TLS-Zertifikat und schreibt sie in die geteilte control.json
// (@jm/control-config, unter app.getPath('appData')). Alle Tools übernehmen das
// beim nächsten Start automatisch (sie lesen die Konfig via `appDataDir`).
// Companion/Clients bekommen Token + Fingerprint angezeigt (Pairing).

function appData(): string {
  return app.getPath('appData');
}

function toStatus(cfg: SuiteControlConfig, revealSecrets = false): ControlPlaneStatus {
  return {
    mode: cfg.mode ?? 'open',
    hasToken: Boolean(cfg.token),
    hasTls: Boolean(cfg.tls),
    tlsFingerprint: cfg.tlsFingerprint,
    // Token nur direkt nach dem Provisionieren ausliefern (zum Anzeigen/Kopieren).
    token: revealSecrets ? cfg.token : undefined,
  };
}

/** Aktueller Zustand der Steuerebene (aus der geteilten Konfig). */
export function getControlStatus(): ControlPlaneStatus {
  return toStatus(readControlConfig(appData()));
}

/**
 * Sichere Steuerebene aktivieren bzw. neu provisionieren: frische Geheimnisse +
 * Zertifikat erzeugen und in die geteilte Konfig schreiben (mode='secure').
 */
export function provisionControl(): ControlPlaneStatus {
  const pems = selfsigned.generate([{ name: 'commonName', value: 'jm-suite-control' }], {
    days: 3650,
    keySize: 2048,
    algorithm: 'sha256',
  });
  const cfg: SuiteControlConfig = {
    mode: 'secure',
    token: randomToken(),
    signKey: randomToken(),
    tls: { cert: pems.cert, key: pems.private },
    tlsFingerprint: certFingerprint(pems.cert),
  };
  writeControlConfig(appData(), cfg);
  return toStatus(cfg, true);
}

/** Zurück auf offene Steuerebene (Geheimnisse verwerfen). */
export function disableControl(): ControlPlaneStatus {
  writeControlConfig(appData(), { mode: 'open' });
  return toStatus(readControlConfig(appData()));
}
