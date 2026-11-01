// Teilnehmerzeilen der Zoom-Karte als reine Funktionen (Spec 4, 5.4, 7.10, 10.10). Ohne Electron (G8).
// Der Kern (kern.ts) ruft baueTeilnehmer bei JEDEM Abbild neu auf; so stimmen Doppelname, Kamera und
// Slot-Nummern immer mit der aktuellen Teilnehmerliste überein. NDI_PRAEFIX, normName und gleicherNdiName
// nutzen auch die Slot-Regeln (einstellungen.ts, slots.ts).
import type { Participant, UserRoleName } from '@jm/zoom-bridge/protocol';
import type { ZoomParticipant } from '../../shared/types';

/** So beginnt der NDI-Name jeder Zoom-Quelle (native/video.cpp:188-201), Gedankenstrich U+2013. */
export const NDI_PRAEFIX = 'JM Connect – Zoom ';

/** Normierter Name (Spec 4): Unicode-NFC, trim, Leerraum zu einem Leerzeichen, klein (de). */
export function normName(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de');
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
 * Teilnehmerzeilen für das Abbild (Spec 5.4, 7.10, 10.10): ohne die eigene Zeile der Bridge, Host und Co-Host zuerst, dann
 * nach Name (de). `doppelname` zählt alle fremden Teilnehmer mit gleichem normierten Namen, auch solche im Warteraum.
 * `kamera` kommt aus dem Teilnehmer der Sitzung, den der Reducer bei `videoStatus` nachführt (0.18). `slotNrn` liefert der
 * Kern: die laufenden Slots, deren Ziel diese Person ist bzw. deren gezeigte Freigabe sie teilt (nach Nummer).
 */
export function baueTeilnehmer(e: {
  liste: readonly Participant[];
  slotNrn: ReadonlyMap<number, readonly number[]>;
}): ZoomParticipant[] {
  const fremde = e.liste.filter((p) => !p.self);
  const anzahl = new Map<string, number>();
  for (const p of fremde) anzahl.set(normName(p.name), (anzahl.get(normName(p.name)) ?? 0) + 1);
  const zeilen = fremde.map((p): ZoomParticipant => ({
    id: p.id,
    name: p.name,
    rolle: p.role,
    kamera: kameraVon(p),
    imWarteraum: p.inWaitingRoom,
    doppelname: (anzahl.get(normName(p.name)) ?? 0) >= 2,
    slotNrn: [...(e.slotNrn.get(p.id) ?? [])].sort((a, b) => a - b),
  }));
  return zeilen.sort((a, b) => rang(a.rolle) - rang(b.rolle) || a.name.localeCompare(b.name, 'de'));
}
