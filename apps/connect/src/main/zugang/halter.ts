// ─────────────────────────────────────────────────────────────────────────────
// Halter der Freigaben von JM Connect (Anmeldung im Launcher, Teil 2, Task 11; Spec 6.3, OT9, OT10, QR2, QR5).
// Holt je Zweck eine Freigabe beim Launcher, hält sie, erneuert sie, und löscht die Altlasten (alter Proxy-Key, alter
// SDK-Schlüssel) genau einmal. Der Live-Betrieb hängt nie vom Launcher ab: gehaltene Freigaben gelten weiter.
// Rein: kein Electron, keine Datei; zur Laufzeit nur Importe aus ./regeln. Keine Logzeile nennt eine Freigabe.
// ─────────────────────────────────────────────────────────────────────────────
import type { FreigabeErgebnis, FreigabeGrund } from '@jm/app-runtime/freigabe';
import type { ProxyKeySource } from '../../shared/types';
import { APP_ID, erneuernFaellig, leseFreigabe, nachAblehnung, versuchErlaubt, waehleZugang } from './regeln';
import type { ConnectZweck, GehalteneFreigaben, ZugangsLage, ZugangsWahl } from './regeln';

export interface AltWert {
  lesen(): { wert: string | null; herkunft: ProxyKeySource };
  loeschen(): boolean;
}

export interface ZugangsHalter {
  zugang(zweck: ConnectZweck, ziel: string): Promise<ZugangsWahl>;
  antwort(zweck: ConnectZweck, w: ZugangsWahl, status: number, code: string | null): void;
  bestaetigt(zweck: ConnectZweck, w: ZugangsWahl): boolean;
  lage(zweck: ConnectZweck): ZugangsLage;
  tokens(): string[];
}

export interface HalterAbhaengigkeiten {
  holeFreigabe(a: { appId: 'jm-connect'; zweck: ConnectZweck; ziel: string }): Promise<FreigabeErgebnis>;
  gehalten: GehalteneFreigaben;
  speichern(g: GehalteneFreigaben): void;
  alt: { 'connect-raum': AltWert; 'zoom-sdk': AltWert };
  jetzt(): number;
  log(z: string): void;
  geaendert(): void;
}

const ZWECKE: readonly ConnectZweck[] = ['connect-raum', 'zoom-jwt', 'zoom-sdk'];

interface Stand {
  letzter: number | null;
  laufend: Promise<void> | null;
  grund: FreigabeGrund | null;
  detail: string | null;
  ziel: string;
  altAbgelehnt: boolean;
  geloescht: boolean;
  versucht: boolean;
}

export function erzeugeZugangsHalter(d: HalterAbhaengigkeiten): ZugangsHalter {
  const gehalten: GehalteneFreigaben = {};
  for (const z of ZWECKE) {
    const f = d.gehalten[z];
    if (f) gehalten[z] = f;
  }
  const stand = {} as Record<ConnectZweck, Stand>;
  for (const z of ZWECKE) {
    stand[z] = { letzter: null, laufend: null, grund: null, detail: null, ziel: gehalten[z]?.ziel ?? '', altAbgelehnt: false, geloescht: false, versucht: false };
  }

  // Der alte Wert gehört je Zweck genau einem Altkanal; `zoom-jwt` hat keinen.
  const altVon = (z: ConnectZweck): AltWert | null => (z === 'connect-raum' ? d.alt['connect-raum'] : z === 'zoom-sdk' ? d.alt['zoom-sdk'] : null);
  const speichern = (): void => d.speichern({ ...gehalten });

  async function versuch(zweck: ConnectZweck, ziel: string): Promise<void> {
    const s = stand[zweck];
    s.versucht = true;
    let e: FreigabeErgebnis;
    try {
      e = await d.holeFreigabe({ appId: APP_ID, zweck, ziel });
    } catch {
      e = { ok: false, grund: 'fehler', detail: 'ausnahme' };
    }
    if (e.ok) {
      const f = leseFreigabe({ zweck, token: e.freigabe, bis: e.bis, ziel, konto: e.konto }, zweck);
      if (f) {
        gehalten[zweck] = f;
        s.grund = null;
        s.detail = null;
        s.letzter = null; // gedrosselt wird nur nach einem Fehlschlag (QR2)
        speichern();
        if (zweck === 'connect-raum') {
          const a = d.alt['connect-raum'];
          const h = a.lesen().herkunft;
          if ((h === 'stored' || h === 'session') && a.loeschen()) {
            s.geloescht = true;
            d.log(`[connect] Zugang: alter Proxy-Key gelöscht, Freigabe vom Launcher bis ${new Date(f.bis).toISOString()}`);
          }
        }
        d.geaendert();
        return;
      }
      s.grund = 'fehler';
      s.detail = 'ungueltige-antwort';
    } else {
      s.grund = e.grund;
      s.detail = e.detail ?? null;
    }
    d.log(`[connect] Zugang: Freigabe ${zweck} nicht erhalten (${s.grund}${s.detail && /^[a-z0-9-]{1,40}$/.test(s.detail) ? `, ${s.detail}` : ''})`);
    d.geaendert();
  }

  return {
    async zugang(zweck, ziel) {
      const s = stand[zweck];
      if (ziel) s.ziel = ziel;
      if (!s.laufend) {
        const jetzt = d.jetzt();
        if (erneuernFaellig(gehalten[zweck] ?? null, ziel, jetzt) && versuchErlaubt(s.letzter, jetzt)) {
          s.letzter = jetzt;
          s.laufend = versuch(zweck, ziel).finally(() => { s.laufend = null; });
        }
      }
      if (s.laufend) await s.laufend;
      return waehleZugang({ freigabe: gehalten[zweck] ?? null, ziel, altKey: altVon(zweck)?.lesen().wert ?? null, altAbgelehnt: s.altAbgelehnt, jetzt: d.jetzt() });
    },

    antwort(zweck, w, status, code) {
      const was = nachAblehnung(w.art, status, code);
      const s = stand[zweck];
      if (was === 'freigabe-verwerfen' && w.art === 'freigabe') {
        if (gehalten[zweck]?.token !== w.f.token) return; // eine neuere Freigabe ist schon da
        delete gehalten[zweck];
        s.letzter = null;
        speichern();
        d.geaendert();
      } else if (was === 'key-abgelehnt') {
        const a = altVon(zweck);
        if (!a) return;
        s.altAbgelehnt = true;
        if (a.lesen().herkunft !== 'env') a.loeschen();
        d.geaendert();
      }
    },

    bestaetigt(zweck, w) {
      if (zweck !== 'zoom-sdk' || w.art !== 'freigabe') return false;
      const a = d.alt['zoom-sdk'];
      const h = a.lesen().herkunft;
      if ((h !== 'stored' && h !== 'session') || !a.loeschen()) return false;
      stand[zweck].geloescht = true;
      d.log('[connect] Zugang: alter SDK-Schlüssel gelöscht');
      d.geaendert();
      return true;
    },

    lage(zweck) {
      const s = stand[zweck];
      const f = gehalten[zweck] ?? null;
      const a = altVon(zweck)?.lesen();
      const wahl = waehleZugang({ freigabe: f, ziel: s.ziel || f?.ziel || '', altKey: a?.wert ?? null, altAbgelehnt: s.altAbgelehnt, jetzt: d.jetzt() });
      return {
        wahl: wahl.art,
        konto: f?.konto ?? null,
        bis: f?.bis ?? null,
        letzterGrund: s.grund,
        detail: s.detail,
        altHerkunft: a?.herkunft ?? 'none',
        altAbgelehnt: s.altAbgelehnt,
        versucht: s.versucht,
        geloescht: s.geloescht,
      };
    },

    tokens() {
      return ZWECKE.map((z) => gehalten[z]?.token).filter((t): t is string => typeof t === 'string');
    },
  };
}
