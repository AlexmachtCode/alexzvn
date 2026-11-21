// Electron-Hülle des Halters (Anmeldung Teil 2, Task 11): verschlüsselte Datei über safeStorage, Anbindung an die Einstellungen.
import { safeStorage } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLog } from '@jm/app-runtime';
import { holeFreigabe } from '@jm/app-runtime/freigabe';
import { proxyKey, proxyKeySource, setProxyKey, zoomSdkSchluesselLesen, zoomSdkSchluesselLoeschen } from '../settings';
import { erzeugeZugangsHalter, type ZugangsHalter } from './halter';
import { geheimnisDatei, leseGehalten, type GehalteneFreigaben } from './regeln';

const DATEI = 'connect-zugang.bin';
const NICHT_LESBAR = '[connect] Zugang: gehaltene Freigaben nicht lesbar, Connect holt neue beim Launcher';
let halter: ZugangsHalter | null = null;
const rueckrufe: Array<() => void> = [];

function laden(pfad: string): GehalteneFreigaben {
  let roh: Buffer;
  try {
    roh = readFileSync(pfad);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') getLog().warn(NICHT_LESBAR);
    return {};
  }
  try {
    return leseGehalten(JSON.parse(safeStorage.decryptString(roh)));
  } catch {
    getLog().warn(NICHT_LESBAR);
    return {};
  }
}

export function starteZugang(o: { userData: string; appData: string }): ZugangsHalter {
  const pfad = join(o.userData, DATEI);
  halter = erzeugeZugangsHalter({
    holeFreigabe: (a) => holeFreigabe(a, { appDataDir: o.appData }),
    gehalten: laden(pfad),
    speichern: (g) => {
      try {
        const inhalt = geheimnisDatei(g, { verfuegbar: () => safeStorage.isEncryptionAvailable(), verschluesseln: (t) => safeStorage.encryptString(t) });
        if (inhalt !== null) writeFileSync(pfad, inhalt, { mode: 0o600 });
      } catch {
        getLog().warn('[connect] Zugang: gehaltene Freigaben konnten nicht gespeichert werden');
      }
    },
    alt: {
      'connect-raum': { lesen: () => ({ wert: proxyKey(), herkunft: proxyKeySource() }), loeschen: () => { setProxyKey(''); return true; } },
      'zoom-sdk': { lesen: () => zoomSdkSchluesselLesen(), loeschen: zoomSdkSchluesselLoeschen },
    },
    jetzt: () => Date.now(),
    log: (z) => getLog().info(z),
    geaendert: () => { for (const cb of rueckrufe) cb(); },
  });
  return halter;
}

export function zugangsHalter(): ZugangsHalter {
  if (!halter) throw new Error('Zugang nicht gestartet: starteZugang() fehlt');
  return halter;
}

export function beiZugangsAenderung(cb: () => void): void {
  rueckrufe.push(cb);
}
