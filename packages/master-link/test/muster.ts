import { erzeugeSchluesselpaar, fingerprintVonPem } from '../src/beweis';
import type { Kopplung, MasterLinkDatei } from '../src/datei';

/** Eine gültige master-link.json (Rolle slave) für das Zertifikat `zertPem`. */
export function musterDatei(zertPem: string, teil: Partial<Kopplung> = {}, rolle: MasterLinkDatei['rolle'] = 'slave'): MasterLinkDatei {
  return {
    version: 1,
    rolle,
    rechner: { id: 'rechner-b', name: 'Regie-Laptop 2' },
    netzwerk: { karte: null },
    kopplung: {
      masterId: 'master-a',
      masterName: 'Regie-PC',
      fingerprint: fingerprintVonPem(zertPem),
      zertifikat: zertPem,
      port: 8738,
      adressen: ['127.0.0.1'],
      letzteAdresse: null,
      festeAdresse: null,
      schluessel: erzeugeSchluesselpaar(),
      ...teil,
    },
  };
}
