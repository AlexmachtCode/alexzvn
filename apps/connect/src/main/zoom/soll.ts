// Soll-Liste der Zoom-Quellen als reine Funktionen (Spec 6.3, Abgleich-Tabelle). Ohne Electron (G8).
// Die Soll-Liste merkt sich die Quellen, die der Bediener geladen hat, über den normierten Namen.
// Der Kern hält sie und ruft diese Funktionen: sollAbbild bei jedem Abbild (Stand, sollOffen),
// sollHandlungen nur im Zustand im_meeting mit Erlaubnis 'ja', 300 ms nach einer Teilnehmeränderung.
import type { ZoomSollEintrag, ZoomZustand } from '../../shared/types';
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
  /**
   * Im Meeting, aber ohne Aufnahme-Erlaubnis (Z6 angefragt, Z7 entzogen, abgelehnt, abgelaufen): Der Abgleich handelt
   * nicht. Ein Eintrag, dessen Person eindeutig da ist, wartet dann auf die Erlaubnis, nicht auf die Person.
   * Fehlt das Feld, gilt false (Abgleich mit Erlaubnis).
   */
  erlaubnisFehlt?: boolean;
  /**
   * Im Meeting mit Erlaubnis ist ein Abgleich geplant (300 ms nach roster, inMeeting, Erlaubnis „ja“, Abbau): Ein Eintrag,
   * den er abonnieren wird, wird gerade geladen und wartet nicht auf die Person. Fehlt das Feld, gilt false.
   */
  abgleichGeplant?: boolean;
  /**
   * Connect selbst ist nicht im Meeting (Zustand ≠ im_meeting, siehe istAusserhalbMeeting): Teilnehmerliste und Abos gelten
   * dann nicht, jeder offene Eintrag wartet auf den Wiederbeitritt (Owner 08.10.2026, Vorrang vor allen anderen Ständen außer
   * 'verwaist': eine verwaiste Quelle lebt mit der Bridge schwarz weiter, etwa in Z10, und bleibt entladbar, Ruling 08.10.2026).
   * Welche Einträge offen sind, ändert das nicht. Fehlt das Feld, gilt false (im Meeting).
   */
  ausserhalbMeeting?: boolean;
  /**
   * Was ein Fehler an der Teilnehmerzeile für die gemerkte Quelle dieser Person heißt, je Teilnehmer-ID (der Kern führt es mit
   * den Zeilenfehlern, höchstens einen je ID). Owner 08.10.2026, ein gescheitertes Laden: 'keineAntwort' = Q8 (das Abo blieb
   * 10 s ohne Antwort), 'gescheitert' = die Bridge hat das Abo abgelehnt (istLadeFehler in klartext.ts). Ruling 08.10.2026
   * (R2), kein Ladefehler: 'erlaubnis' = Q1, die Bridge hat das Abo mangels Aufnahme-Erlaubnis abgelehnt (istErlaubnisFehler),
   * auch wenn Connect die Erlaubnis noch als „ja“ führt. Q2 (R1) trägt der Kern nicht ein: Die Person ist weg, es bleibt
   * 'wartet'. Ist die Person eindeutig da und steht der Eintrag an IHRER Zeile, ersetzt er den Rückfall 'wartet'; alle
   * anderen Stände (auch 'laedt' bei geplantem Abgleich) behalten Vorrang. Fehlt das Feld, gibt es keinen.
   */
  zeilenStand?: ReadonlyMap<number, SollZeilenStand>;
}

/**
 * Was ein Fehler an der Zeile einer eindeutig anwesenden Person für ihre gemerkte Quelle heißt (Owner 08.10.2026: Q8 und
 * Ladefehler; Ruling 08.10.2026 R2: Q1 wartet auf die Erlaubnis).
 */
export type SollZeilenStand = Extract<ZoomSollEintrag['stand'], 'keineAntwort' | 'gescheitert' | 'erlaubnis'>;

/**
 * Owner 08.10.2026: Connect ist außerhalb des Meetings, sobald der Zustand nicht im_meeting ist, etwa beim eigenen
 * Wiederbeitritt (Z11), während Zoom selbst neu verbindet (Z10), in jedem fehler mit gemerkten Quellen (R2, R7,
 * „Verbindung verloren: …“, B3–B5), bei „Erneut beitreten“ (startet, tritt_bei, warteraum) und im Warteraum mitten im
 * Meeting. In verlaesst (Ruling 08.10.2026: Verlassen und Beenden leeren sie vor Z12), einrichtung und bereit ist die
 * Soll-Liste leer. Der Kern setzt damit SollLage.ausserhalbMeeting.
 */
export function istAusserhalbMeeting(zustand: ZoomZustand): boolean {
  return zustand !== 'im_meeting';
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

/** Je Eintrag: Bewertung, Handlung (oder keine) und ob er an der Betriebsgröße scheitert. */
interface Planung {
  b: Bewertung;
  handlung: SollHandlung | null;
  /** Würde abonniert, aber es ist kein Platz mehr frei (L7). */
  grenze: boolean;
}

/**
 * Handlungen nach Spec 6.3: nur bei GENAU einem Treffer, der nicht im Warteraum ist. Kein Abo → abonnieren;
 * verwaistes Abo → neu laden (altes entladen, neues mit dem Ton des Soll-Eintrags). `plaetze` = freie Plätze
 * bis zur Betriebsgröße (L7, N4b.3 Nr. 3): Nur „abonnieren“ verbraucht einen Platz, „neu laden“ ersetzt ein
 * belegtes Abo. Ohne Platz keine Handlung, der Eintrag steht auf 'grenze'. Reihenfolge der Plätze: die
 * Einfügereihenfolge der Soll-Liste. Werte ≤ 0 heißen „kein Platz“.
 */
function plane(soll: SollListe, lage: SollLage, plaetze: number): Planung[] {
  let frei = plaetze;
  return bewerte(soll, lage).map((b): Planung => {
    if (b.abo === 'verbunden' || b.treffer.length !== 1 || b.treffer[0].imWarteraum) return { b, handlung: null, grenze: false };
    const id = b.treffer[0].id;
    if (b.abo === 'verwaist' && b.eintrag.aboId !== null) {
      return { b, handlung: { art: 'neuLaden', schluessel: b.schluessel, altAboId: b.eintrag.aboId, id, ton: b.eintrag.ton }, grenze: false };
    }
    if (frei <= 0) return { b, handlung: null, grenze: true };
    frei -= 1;
    return { b, handlung: { art: 'abonnieren', schluessel: b.schluessel, id, ton: b.eintrag.ton }, grenze: false };
  });
}

/**
 * Offene Soll-Einträge fürs Abbild (Spec 6.3, Spalte „Stand“, dazu Spec 9 Punkt 9, Nachtrag 4b): alles außer „verbunden“.
 * verwaist → 'verwaist' (mit aboId zum Entladen), auch außerhalb des Meetings: Die schwarze Quelle lebt mit der Bridge
 * (Z10, Warteraum mitten im Meeting) weiter und muss sich abbauen lassen (Ruling 08.10.2026, Vorrang vor
 * 'wiederbeitritt'). Sonst außerhalb des Meetings
 * (lage.ausserhalbMeeting) → 'wiederbeitritt' vor allen übrigen Regeln, ohne aboId und ohne doppelname (Owner 08.10.2026).
 * Im Meeting: würde abonniert, hat aber keinen Platz → 'grenze';
 * kein Abo und ≥ 2 Treffer → 'doppelname'; genau 1 Treffer außerhalb des Warteraums ohne Erlaubnis
 * (lage.erlaubnisFehlt) → 'erlaubnis'; wird beim geplanten Abgleich abonniert (lage.abgleichGeplant) → 'laedt';
 * genau 1 Treffer außerhalb des Warteraums mit einem Fehler an IHRER Zeile (lage.zeilenStand) → 'keineAntwort' (Q8) bzw.
 * 'gescheitert' (Owner 08.10.2026) bzw. 'erlaubnis' (Q1, Ruling 08.10.2026); sonst 'wartet'. `doppelname` = 2 oder mehr Treffer
 * (auch bei verwaist: rot mit Q11). `plaetze` wie bei sollHandlungen; Vorgabe: unbegrenzt.
 */
export function sollAbbild(soll: SollListe, lage: SollLage, plaetze = Infinity): ZoomSollEintrag[] {
  const aus: ZoomSollEintrag[] = [];
  for (const { b, handlung, grenze } of plane(soll, lage, plaetze)) {
    if (b.abo === 'verbunden') continue;
    if (lage.ausserhalbMeeting === true && b.abo !== 'verwaist') {
      // Owner 08.10.2026 („Statuszeile lügt“): Ohne Meeting wartet der Eintrag auf den Wiederbeitritt, nicht auf die Person.
      // Ausnahme verwaist (Ruling 08.10.2026): Die schwarze Quelle lebt (Z10) und muss sich per „Entladen“ abbauen lassen.
      aus.push({ name: b.eintrag.name, ton: b.eintrag.ton, ndiName: b.eintrag.ndiName, stand: 'wiederbeitritt', aboId: null, doppelname: false });
      continue;
    }
    const doppelname = b.treffer.length >= 2;
    // Gesamtprüfung 4b („Statuszeile lügt“): Ist die Person eindeutig da, wartet der Eintrag nicht auf sie.
    const personDa = b.treffer.length === 1 && !b.treffer[0].imWarteraum;
    const stand: ZoomSollEintrag['stand'] = b.abo === 'verwaist' ? 'verwaist' : grenze ? 'grenze' : doppelname ? 'doppelname'
      : personDa && lage.erlaubnisFehlt === true ? 'erlaubnis'
      : handlung?.art === 'abonnieren' && lage.abgleichGeplant === true ? 'laedt'
      // Owner 08.10.2026: Ihr Laden ist gescheitert (Q8 oder Ablehnung der Bridge an IHRER Zeile); kein neuer Versuch von selbst.
      // Ruling 08.10.2026: Q1 an IHRER Zeile wartet auf die Erlaubnis (R2); Q2 trägt der Kern nicht ein, es bleibt 'wartet' (R1).
      : (personDa ? lage.zeilenStand?.get(b.treffer[0].id) : undefined) ?? 'wartet';
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
 * Handlungen nach Spec 6.3 (Regeln bei plane): abonnieren bzw. neu laden, höchstens `plaetze`-mal abonnieren.
 * Doppelnamen, Warteraum, fehlende Person und Einträge ohne Platz: nichts. Vorgabe: unbegrenzt.
 */
export function sollHandlungen(soll: SollListe, lage: SollLage, plaetze = Infinity): SollHandlung[] {
  return plane(soll, lage, plaetze).flatMap((x) => (x.handlung ? [x.handlung] : []));
}
