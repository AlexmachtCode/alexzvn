// ─────────────────────────────────────────────────────────────────────────────
// Anmeldung im Launcher (Teil 1) · Freigabe-Stelle (Plan 10.6, EP3, EP8; Spec 6.1, 6.2, 6.3).
// Entscheidet, ob ein Tool eine Freigabe bekommt, und holt sie beim Worker (POST /konto/freigabe; der Worker stellt sie
// aus den Claims der Sitzung aus, ohne neue Prüfung im Konten-Speicher). Teil 1 kennt nur den Zweck `qa-relay` für JM Q&A;
// Teil 2 ergänzt Zwecke in ZWECKE und am Worker, ohne Kanal oder Beweis zu ändern. Ein Tool-Neustart übernimmt so den beim
// Launcher-Start festgehaltenen Stand; auch bei „Zugang entzogen, Sitzung läuft“ gibt es weiter Freigaben, bis der Launcher
// neu startet (Spec 6.1, 6.3). Jede Ausgabe wird ohne Token gemerkt (Konto-Dialog „An Tools ausgegeben“) und geloggt.
// Kein electron-Import (G9).
// ─────────────────────────────────────────────────────────────────────────────
import type { FreigabeAnfrage, FreigabeErgebnis, FreigabeGrund } from '@jm/app-runtime/freigabe';
import { darf, type Funktion, type KontoZustand } from '../../shared/konto';
import type { SitzungsTreiber } from './sitzung-kern';
import { KontoFehler, type KontoClient } from './worker-client';

export const ZWECKE: Readonly<Record<string, { funktion: Funktion; zielNoetig: boolean; apps: readonly string[] }>> = {
  'qa-relay': { funktion: 'qa', zielNoetig: true, apps: ['jm-qa'] },
};

/** Ohne gültige Sitzung: welcher Grund passt zum Zustand des Treibers? */
function grundOhneSitzung(z: KontoZustand): FreigabeGrund {
  if (z === 'abgelaufen') return 'abgelaufen';
  if (z === 'entzogen') return 'entzogen';
  return 'niemand-angemeldet';
}

/** Fehler des Workers bei POST /konto/freigabe → Grund für das Tool (Q3a–Q3i). */
function grundAusFehler(e: unknown): { grund: FreigabeGrund; detail?: string } {
  const code = e instanceof KontoFehler ? e.code : 'server';
  switch (code) {
    case 'netz': case 'server': case 'zu-viele': case 'nicht-eingerichtet': return { grund: 'server-nicht-erreichbar' };
    case 'kein-recht': return { grund: 'kein-recht' };
    case 'unbekannter-zweck': return { grund: 'unbekannter-zweck' };
    case 'sitzung-abgelaufen': return { grund: 'abgelaufen' };
    case 'nicht-angemeldet': return { grund: 'niemand-angemeldet' };
    case 'gesperrt': case 'geloescht': case 'zugang-abgelaufen': case 'geraet-unbekannt': return { grund: 'entzogen' };
    default: return { grund: 'fehler', detail: code };
  }
}

/** Werte eines Tools nur gesäubert ins Log (keine Zeilenumbrüche, höchstens 64 Zeichen). */
const sauber = (s: string): string => s.replace(/[^\w.-]/g, '?').slice(0, 64);

export function erzeugeFreigabeStelle(u: {
  treiber: SitzungsTreiber; client: KontoClient; jetzt(): number; log(z: string): void;
}): { behandle(a: FreigabeAnfrage): Promise<FreigabeErgebnis> } {
  return {
    async behandle(a: FreigabeAnfrage): Promise<FreigabeErgebnis> {
      const zweck = Object.prototype.hasOwnProperty.call(ZWECKE, a.zweck) ? ZWECKE[a.zweck] : undefined;
      if (!zweck || !zweck.apps.includes(a.appId)) {
        u.log(`Freigabe: ${sauber(a.appId)} fragt unbekannten Zweck ${sauber(a.zweck)}`);
        return { ok: false, grund: 'unbekannter-zweck' };
      }
      const ziel = a.ziel ?? '';
      if (zweck.zielNoetig && !ziel) return { ok: false, grund: 'fehler', detail: 'ungueltig' };
      const sitzung = await u.treiber.sitzungFuerBedarf();
      const ansicht = u.treiber.ansicht();
      if (!sitzung || !ansicht.stand) return { ok: false, grund: grundOhneSitzung(ansicht.zustand) };
      if (!darf(ansicht.stand, zweck.funktion, { jetzt: u.jetzt() })) {
        u.log(`Freigabe: ${a.zweck} für ${a.appId} abgelehnt (kein Recht)`);
        return { ok: false, grund: 'kein-recht' };
      }
      try {
        const r = await u.client.freigabe(sitzung, a.zweck, ziel);
        u.treiber.merkeAusgabe({ appId: a.appId, zweck: a.zweck, ziel, bis: r.bis, am: u.jetzt() });
        u.log(`Freigabe: ${a.zweck} an ${a.appId} ausgegeben, gültig bis ${new Date(r.bis).toISOString()}`);
        return { ok: true, freigabe: r.freigabe, bis: r.bis, konto: { name: ansicht.stand.name, stufe: ansicht.stand.stufe } };
      } catch (e) {
        const g = grundAusFehler(e);
        u.log(`Freigabe: ${a.zweck} für ${a.appId} nicht ausgegeben (${g.grund})`);
        return g.detail === undefined ? { ok: false, grund: g.grund } : { ok: false, grund: g.grund, detail: g.detail };
      }
    },
  };
}

// ── Ende des Moduls ──
