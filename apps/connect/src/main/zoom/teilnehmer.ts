// Teilnehmerzeilen der Zoom-Karte als reine Funktionen (Spec 4, 5.4, 6.3). Ohne Electron (G8).
// Der Kern (kern.ts) ruft baueTeilnehmer bei JEDEM Abbild neu auf; so stimmen Doppelname,
// Kollision und Zeilenfehler immer mit der aktuellen Teilnehmerliste überein.
import type { Participant, UserRoleName } from '@jm/zoom-bridge/protocol';
import type { ZoomParticipant, ZoomQuelle } from '../../shared/types';
import { KT } from './klartext';

/** So beginnt der NDI-Name jeder Zoom-Quelle (native/video.cpp:188-201), Gedankenstrich U+2013. */
export const NDI_PRAEFIX = 'JM Connect – Zoom ';

/** Normierter Name (Spec 4): Unicode-NFC, trim, Leerraum zu einem Leerzeichen, klein (de). */
export function normName(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de');
}

/** NDI-Name, den die Bridge für diese Person vergeben wird, solange noch keine Quelle läuft. */
export function ndiVorschau(name: string): string {
  return NDI_PRAEFIX + name;
}

/** Gleicher NDI-Name im Sinne der Kollisionsprüfung (Spec 6.3): nach NFC, ohne Groß-/Kleinschreibung. */
export function gleicherNdiName(a: string, b: string): boolean {
  return a.normalize('NFC').toLocaleLowerCase('de') === b.normalize('NFC').toLocaleLowerCase('de');
}

/** Spec 5.4: videoOn → 'an', sonst hasCamera === false → 'keine', sonst 'aus'. */
export function kameraVon(p: Pick<Participant, 'videoOn' | 'hasCamera'>): 'an' | 'aus' | 'keine' {
  if (p.videoOn) return 'an';
  if (p.hasCamera === false) return 'keine';
  return 'aus';
}

/** Host zuerst, dann Co-Host, dann alle übrigen (Spec 5.4 `teilnehmer`). */
function rang(r: UserRoleName): number {
  return r === 'host' ? 0 : r === 'coHost' ? 1 : 2;
}

/**
 * Teilnehmerzeilen für das Abbild: ohne die eigene Zeile der Bridge, Host und Co-Host zuerst, dann
 * nach Name (de). `doppelname` zählt alle fremden Teilnehmer mit gleichem normierten Namen, auch
 * solche im Warteraum. `tonVorwahl` gilt je Teilnehmer-ID (Vorgabe true). `kollision` vergleicht den
 * NDI-Namen der Zeile (Quelle, sonst Vorschau) mit den NDI-Namen der Browser-Gäste.
 */
export function baueTeilnehmer(e: {
  liste: readonly Participant[];
  quellen: ReadonlyMap<number, ZoomQuelle>;
  tonVorwahl: ReadonlyMap<number, boolean>;
  zeilenFehler: ReadonlyMap<number, string>;
  gastLabels: readonly string[];
}): ZoomParticipant[] {
  const fremde = e.liste.filter((p) => !p.self);
  const anzahl = new Map<string, number>();
  for (const p of fremde) anzahl.set(normName(p.name), (anzahl.get(normName(p.name)) ?? 0) + 1);
  const zeilen = fremde.map((p): ZoomParticipant => {
    const quelle = e.quellen.get(p.id) ?? null;
    const ndiNameVorschau = ndiVorschau(p.name);
    const ndiName = quelle?.ndiName ?? ndiNameVorschau;
    return {
      id: p.id,
      name: p.name,
      rolle: p.role,
      kamera: kameraVon(p),
      imWarteraum: p.inWaitingRoom,
      doppelname: (anzahl.get(normName(p.name)) ?? 0) >= 2,
      tonVorwahl: e.tonVorwahl.get(p.id) ?? true,
      quelle,
      ndiNameVorschau,
      kollision: e.gastLabels.some((l) => gleicherNdiName(l, ndiName)) ? KT.Q10(ndiName) : null,
      fehler: e.zeilenFehler.get(p.id) ?? null,
    };
  });
  return zeilen.sort((a, b) => rang(a.rolle) - rang(b.rolle) || a.name.localeCompare(b.name, 'de'));
}

/** n = alle Quellen (NDI-Sender existiert), k = davon nicht 'live' (Spec 5.4 `quellen`/`ohneBild`). */
export function zaehleQuellen(quellen: Iterable<ZoomQuelle>): { n: number; k: number } {
  let n = 0;
  let k = 0;
  for (const q of quellen) {
    n++;
    if (q.bild !== 'live') k++;
  }
  return { n, k };
}

/**
 * Verwaiste Quelle (Spec 4): ihr Teilnehmer steht nicht mehr in der Liste — auch wenn das
 * black-Ereignis noch aussteht — oder ihr Bild meldet black mit Grund participantLeft.
 */
export function istVerwaist(aboId: number, teilnehmerIds: ReadonlySet<number>, bild: { state: string; reason: string } | undefined): boolean {
  if (!teilnehmerIds.has(aboId)) return true;
  return bild?.state === 'black' && bild.reason === 'participantLeft';
}
