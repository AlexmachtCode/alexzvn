// Reine Regeln für die Zoom-Felder in connect-settings.json (Spec 5.6): gültige Werte, Zugangsdaten
// aus der Umgebung, Inhalt von zoomZugangEnc, Rangfolge der Herkünfte. Ohne Electron, damit `tsx`
// sie prüfen kann; settings.ts bringt nur Datei, safeStorage und Sitzung dazu.
import { readCredentials } from '@jm/zoom-bridge';
import type { ZugangDaten, ZugangStand } from './kern';

/** Was in zoomZugangEnc steht, nach dem Entschlüsseln. */
export interface GespeicherterZugang {
  daten: ZugangDaten | null;
  /** zoomZugangEnc ist da, lässt sich aber nicht entschlüsseln oder ist kaputt (A5). */
  unlesbar: boolean;
}

/** 1 bis 64 Zeichen nach `trim` (G4), sonst `null`. Der Aufrufer setzt dann die Vorgabe „JM Connect“. */
export function gueltigerAnzeigename(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length >= 1 && t.length <= 64 ? t : null;
}

/** Ganze Zahl 0 bis 1000 (G4), sonst `null`. Der Aufrufer setzt dann 0. */
export function gueltigerVersatz(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1000 ? v : null;
}

/**
 * Zugangsdaten aus der Umgebung: ZOOM_SDK_CLIENT_ID + ZOOM_SDK_CLIENT_SECRET oder ZOOM_SDK_CREDENTIALS
 * (Entwicklungsweg, Herkunft 'env', Spec 5.6). Ohne jede dieser Variablen: keine Daten, kein Fehler.
 * `fehler` nennt nie einen Wert: readCredentials zitiert weder das Secret noch den Dateiinhalt.
 */
export function zugangAusUmgebung(env: Record<string, string | undefined>): { daten: ZugangDaten | null; fehler: string | null } {
  if (!env.ZOOM_SDK_CLIENT_ID && !env.ZOOM_SDK_CLIENT_SECRET && !env.ZOOM_SDK_CREDENTIALS) {
    return { daten: null, fehler: null };
  }
  try {
    const { clientId, clientSecret } = readCredentials(env);
    return { daten: { clientId, clientSecret }, fehler: null };
  } catch (e) {
    return { daten: null, fehler: e instanceof Error ? e.message : String(e) };
  }
}

/** Inhalt von zoomZugangEnc nach dem Entschlüsseln. `klartext === null` heißt: nicht entschlüsselbar. */
export function zugangAusKlartext(klartext: string | null): GespeicherterZugang {
  if (klartext !== null) {
    try {
      const j = JSON.parse(klartext) as { clientId?: unknown; clientSecret?: unknown } | null;
      if (j && typeof j.clientId === 'string' && j.clientId && typeof j.clientSecret === 'string' && j.clientSecret) {
        return { daten: { clientId: j.clientId, clientSecret: j.clientSecret }, unlesbar: false };
      }
    } catch {
      // kaputt → unten „unlesbar“; der Inhalt geht nirgendwohin (G5)
    }
  }
  return { daten: null, unlesbar: true };
}

/** Rangfolge Umgebung > Gespeichertes > Sitzung (Spec 5.6, wie beim Proxy-Key in settings.ts). */
export function waehleZugang(e: {
  umgebung: ZugangDaten | null;
  gespeichert: GespeicherterZugang | null;
  sitzung: ZugangDaten | null;
}): ZugangStand {
  if (e.umgebung) return { daten: e.umgebung, herkunft: 'env', unlesbar: false };
  if (e.gespeichert?.daten) return { daten: e.gespeichert.daten, herkunft: 'stored', unlesbar: false };
  if (e.sitzung) return { daten: e.sitzung, herkunft: 'session', unlesbar: false };
  return { daten: null, herkunft: 'none', unlesbar: e.gespeichert?.unlesbar === true };
}
