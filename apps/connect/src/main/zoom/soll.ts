// Soll-Liste der Zoom-Quellen als reine Funktionen (Spec 6.3, Abgleich-Tabelle). Ohne Electron (G8).
// Die Soll-Liste merkt sich die Quellen, die der Bediener geladen hat, über den normierten Namen.
// Der Kern hält sie und ruft diese Funktionen: sollAbbild bei jedem Abbild (Stand, sollOffen),
// sollHandlungen nur im Zustand im_meeting mit Erlaubnis 'ja', 300 ms nach einer Teilnehmeränderung.
import type { ZoomSollEintrag } from '../../shared/types';
import { normName } from './teilnehmer';

/** Ein Eintrag der Soll-Liste. `aboId` = Teilnehmer-ID des letzten Abos (gilt nur in dessen Sitzung). */
export interface SollEintrag {
  name: string;
  ton: boolean;
  ndiName: string;
  aboId: number | null;
}

/** Schlüssel: normName(name). */
export type SollListe = Map<string, SollEintrag>;

/** Was der Kern über das Meeting weiß, wenn er abgleicht. */
export interface SollLage {
  /** Nur fremde Teilnehmer (ohne die eigene Zeile der Bridge), auch die im Warteraum. */
  teilnehmer: ReadonlyArray<{ id: number; name: string; imWarteraum: boolean }>;
  /** Abos der AKTIVEN Bridge; `verwaist` nach istVerwaist (teilnehmer.ts). */
  abos: ReadonlyMap<number, { verwaist: boolean }>;
}

export type SollHandlung =
  | { art: 'abonnieren'; schluessel: string; id: number; ton: boolean }
  | { art: 'neuLaden'; schluessel: string; altAboId: number; id: number; ton: boolean };

interface Bewertung {
  schluessel: string;
  eintrag: SollEintrag;
  /** Fremde Teilnehmer mit diesem normierten Namen, auch im Warteraum. */
  treffer: ReadonlyArray<{ id: number; name: string; imWarteraum: boolean }>;
  /** 'keins' auch, wenn aboId in lage.abos fehlt: eine neue Bridge kennt die alten Abos nicht. */
  abo: 'verbunden' | 'verwaist' | 'keins';
}

function bewerte(soll: SollListe, lage: SollLage): Bewertung[] {
  return [...soll].map(([schluessel, eintrag]) => {
    const treffer = lage.teilnehmer.filter((t) => normName(t.name) === schluessel);
    const a = eintrag.aboId === null ? undefined : lage.abos.get(eintrag.aboId);
    const abo = a === undefined ? 'keins' : a.verwaist ? 'verwaist' : 'verbunden';
    return { schluessel, eintrag, treffer, abo };
  });
}

/**
 * Offene Soll-Einträge fürs Abbild (Spec 6.3, Spalte „Stand“): alles außer „verbunden“.
 * verwaist → 'verwaist' (mit aboId zum Entladen); kein Abo und ≥ 2 Treffer → 'doppelname';
 * sonst 'wartet'. `doppelname` = 2 oder mehr Treffer (auch bei verwaist: rot mit Q11).
 */
export function sollAbbild(soll: SollListe, lage: SollLage): ZoomSollEintrag[] {
  const aus: ZoomSollEintrag[] = [];
  for (const b of bewerte(soll, lage)) {
    if (b.abo === 'verbunden') continue;
    const doppelname = b.treffer.length >= 2;
    const stand: ZoomSollEintrag['stand'] = b.abo === 'verwaist' ? 'verwaist' : doppelname ? 'doppelname' : 'wartet';
    aus.push({
      name: b.eintrag.name,
      ton: b.eintrag.ton,
      ndiName: b.eintrag.ndiName,
      stand,
      aboId: stand === 'verwaist' ? b.eintrag.aboId : null,
      doppelname,
    });
  }
  return aus;
}

/**
 * Handlungen nach Spec 6.3: nur bei GENAU einem Treffer, der nicht im Warteraum ist.
 * Kein Abo → abonnieren; verwaistes Abo → neu laden (altes entladen, neues mit dem Ton des
 * Soll-Eintrags). Doppelnamen, Warteraum und fehlende Person: nichts.
 */
export function sollHandlungen(soll: SollListe, lage: SollLage): SollHandlung[] {
  const aus: SollHandlung[] = [];
  for (const b of bewerte(soll, lage)) {
    if (b.abo === 'verbunden' || b.treffer.length !== 1 || b.treffer[0].imWarteraum) continue;
    const id = b.treffer[0].id;
    if (b.abo === 'verwaist' && b.eintrag.aboId !== null) {
      aus.push({ art: 'neuLaden', schluessel: b.schluessel, altAboId: b.eintrag.aboId, id, ton: b.eintrag.ton });
    } else {
      aus.push({ art: 'abonnieren', schluessel: b.schluessel, id, ton: b.eintrag.ton });
    }
  }
  return aus;
}
