import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { MasterLinkMeldungZeile, VerbundAnzeigeZeile } from '@shared/verbund';

declare global {
  interface Window {
    jm?: {
      platform: string;
      versions: Record<string, string | undefined>;
      serverUrl: string;
      speaker: {
        open: () => Promise<void>;
        close: () => Promise<void>;
        toggle: () => Promise<void>;
        isOpen: () => Promise<boolean>;
        setFullscreen: (flag: boolean) => Promise<boolean>;
        isFullscreen: () => Promise<boolean>;
        onStatus: (cb: (open: boolean) => void) => () => void;
      };
      remote: {
        getUrls: () => Promise<string[]>;
        getAddresses: () => Promise<string[]>;
      };
      auth: {
        get: () => Promise<{ enabled: boolean; token: string }>;
        setEnabled: (
          enabled: boolean,
        ) => Promise<{ enabled: boolean; token: string }>;
        regenerate: () => Promise<{ enabled: boolean; token: string }>;
      };
      closeWindow: () => Promise<void>;
      /** Verbund-Anzeige (Master-Link Teil 2b, Spec 16.4/16.5): V-Zeile oder null (Einzelplatz). */
      verbundAnzeige: () => Promise<VerbundAnzeigeZeile | null>;
      onVerbundAnzeige: (cb: (a: VerbundAnzeigeZeile | null) => void) => () => void;
      /** Master-Link-Zustand (UX Welle 1, Spec 3.9), lesend; null, wenn der Handler fehlt oder ablehnt. */
      masterLink: () => Promise<MasterLinkMeldungZeile | null>;
      onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => () => void;
      /** Meldung des Steuerservers (Port 8724, UX Welle 1): null, solange Main noch nichts gemeldet hat. */
      fernsteuerung: () => Promise<FernsteuerungMeldung | null>;
      onFernsteuerung: (cb: (m: FernsteuerungMeldung | null) => void) => () => void;
    };
  }
}

export {};
