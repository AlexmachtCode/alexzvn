import type { FernsteuerungMeldung } from '@shared/fernsteuerung';

/**
 * Master-Link-Zustand für die Statusleiste. Spiegel von MasterLinkMeldung aus @jm/app-runtime, das im Renderer nicht
 * importierbar ist (Main-Code). Den Gleichlauf prüft die Typprüfung des Preloads.
 */
export type MasterLinkMeldungZeile =
  | { art: 'aus' }
  | { art: 'sucht' }
  | { art: 'verbindet'; adresse: string }
  | { art: 'verbunden'; adresse: string; seit: number; masterName: string; suite: string }
  | { art: 'fehler'; code: string; text: string; errCode?: string }
  | { art: 'ohne-client' };

declare global {
  interface Window {
    jms?: {
      platform: string;
      versions: Record<string, string | undefined>;
      serverUrl: string;
      isElectron: boolean;
      remote: {
        getUrls: () => Promise<string[]>;
        getAddresses: () => Promise<string[]>;
      };
      closeWindow: () => Promise<void>;
      masterLink: () => Promise<MasterLinkMeldungZeile | null>;
      onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => () => void;
      fernsteuerung: () => Promise<FernsteuerungMeldung | null>;
      onFernsteuerung: (cb: (m: FernsteuerungMeldung | null) => void) => () => void;
      /** Altfehler SC-S1: Ort der Datei mit dem Erst-Passwort und ob sie besteht; nie ihr Inhalt. */
      erstPasswort: () => Promise<{ datei: string; vorhanden: boolean } | null>;
      /** Altfehler SC-S2: das Fenster-Geheimnis dieses Starts (X-JMS-Fenster, auth.fenster); null bei Ablehnung. */
      fensterGeheimnis: () => Promise<string | null>;
    };
  }
}
