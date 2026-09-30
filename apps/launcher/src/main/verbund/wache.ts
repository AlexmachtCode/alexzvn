import {
  listeKarten, wirksameKarten,
  type Lesen, type MasterLinkDatei, type NetzwerkInterfaces,
} from '@jm/master-link';
import type { VerbundKarte } from '@shared/types';

// Wächter des Verbunds OHNE Electron (per tsx getestet): Netzwerkkarten und Lesbarkeit der master-link.json.

/** Karten für Modal und Kopf (Spec 4.1): alle nicht-internen IPv4-Karten und ob die gewählte fehlt. */
export function kartenLage(ni: NetzwerkInterfaces, gewaehlt: string | null): { karten: VerbundKarte[]; karteFehlt: boolean } {
  const karten = listeKarten(ni);
  return {
    karten: karten.map((k) => ({
      name: k.name,
      adressen: k.adressen.map((a) => `${a.adresse}/${a.praefix}`),
      virtuell: k.virtuell,
      nurLinkLocal: k.nurLinkLocal,
    })),
    karteFehlt: wirksameKarten(karten, gewaehlt).karteFehlt,
  };
}

/** Spec 4.1 „alle 10 s“: `lage()` im Takt neu bilden; ändert sie sich, `beiAenderung()` — unabhängig von der Rolle. */
export function beobachte(lage: () => string, beiAenderung: () => void, taktMs: number): () => void {
  let vorher = lage();
  const zeitgeber = setInterval(() => {
    const jetzt = lage();
    if (jetzt === vorher) return;
    vorher = jetzt;
    beiAenderung();
  }, taktMs);
  zeitgeber.unref?.();
  return () => clearInterval(zeitgeber);
}

/**
 * Spec 7.3 beim Start des Launchers: ein I/O-Fehler (EBUSY/EPERM, z. B. Virenscanner) ist VORÜBERGEHEND.
 * Erneut lesen — erst `versuche`-mal alle `pauseMs`, danach alle `taktMs` —, bis ein Lesen gelingt.
 * `gesperrt(code)` meldet jeden Fehlversuch: solange darf der Launcher nichts schreiben (Spec 10).
 */
export async function leseBisLesbar(
  lies: () => Lesen<MasterLinkDatei>,
  gesperrt: (code: string) => void,
  o: { versuche?: number; pauseMs?: number; taktMs?: number } = {},
): Promise<Exclude<Lesen<MasterLinkDatei>, { art: 'io' }>> {
  for (let i = 0; ; i++) {
    const r = lies();
    if (r.art !== 'io') return r;
    gesperrt(r.code);
    const ms = i < (o.versuche ?? 10) ? (o.pauseMs ?? 500) : (o.taktMs ?? 5000);
    await new Promise<void>((weiter) => setTimeout(weiter, ms));
  }
}
