// Zoom-Slots in Connect als reine Funktionen (Spec 7.1, 7.3, 10.1): Zustand eines Slots nach der Vorrangfolge,
// Offenheit und Zählung (n, k, o, e), Ton-Abbildung und Befehlsbau. Plan B, Task B2 ergänzt den Slot-Abgleich (ersetzt
// soll.ts ab Task B12). Ohne Electron (G-B2): Laufzeit-Importe nur relativ; Bridge-Typen und -Konstanten nur aus
// @jm/zoom-bridge/protocol. Der Kern (kern.ts) ruft diese Funktionen und führt aus, was sie ergeben.
import type { Command, SlotAudioSetting, SlotFallback, SlotMode, SlotReason, SlotState, SpeakerSignal } from '@jm/zoom-bridge/protocol';
import type {
  ZoomErlaubnis, ZoomSlotEinstellung, ZoomSlotErsatzbild, ZoomSlotModus, ZoomSlotZustand, ZoomSprecherSignal, ZoomZustand,
} from '../../shared/types';
import { BETRIEBSGROESSE } from '../../shared/zoom-text';
import { normName } from './teilnehmer';

/** Fehlerstand eines Slots (Spec 7.3 Nr. 2, 3): Ein Slot mit Fehlerstand startet nicht von selbst neu. */
export type SlotFehlerstand = 'keine_antwort' | 'gescheitert' | 'zurueckgestellt';

/**
 * Eingaben der Vorrangfolge (Spec 7.3 „Zustand eines Slots“).
 * - `senderAktiv`: Für diesen Slot besteht ein NDI-Sender (letztes `slot`-Ereignis mit `state` ≠ `off`), in der aktiven
 *   Bridge oder in einer, die gerade abbaut (Generationsregel ST4 6.9; „Sender der alten Bridge zählen bis zu ihrem
 *   Abbau in n“, 10.1).
 * - `slotOffGesendet`: `slotOff` ist gesendet, das `slot off` der Bridge steht aus.
 * - `bridgeImAbbau`: Die Bridge, die diesen Sender hält, baut ab. Ohne Sender ohne Wirkung.
 * - `bridgeState`: `state` des letzten `slot`-Ereignisses dieses Slots; `null`, solange keins kam.
 * - `fristLaeuft`: `slotOn` ist gesendet, noch kein `slot`-Ereignis, die Antwortfrist (10 s) läuft.
 */
export interface SlotZustandEingabe {
  an: boolean;
  senderAktiv: boolean;
  slotOffGesendet: boolean;
  bridgeImAbbau: boolean;
  bridgeState: SlotState | null;
  meeting: ZoomZustand;
  erlaubnis: ZoomErlaubnis | null;
  fehlerstand: SlotFehlerstand | null;
  fristLaeuft: boolean;
}

/**
 * Spec 7.3, Vorrang (erste passende Zeile gilt): 1. Start aus und kein Sender → SZ0; 2. `slotOff` gesendet oder Bridge
 * im Abbau → SZ9; 3. Sender → SZ4/SZ5/SZ6 nach der Lage der Bridge (`live`, `held`, sonst Ersatzbild); 4. Meeting nicht
 * `im_meeting` → SZ1; 5. Erlaubnis ≠ „ja“ → SZ2; 6. Fehlerstand → SZ7/SZ8/SZ10; 7. Frist läuft → SZ3; 8. sonst SZ11.
 */
export function slotZustand(e: SlotZustandEingabe): ZoomSlotZustand {
  if (!e.an && !e.senderAktiv) return 'aus';
  if (e.slotOffGesendet || (e.bridgeImAbbau && e.senderAktiv)) return 'stoppt';
  if (e.senderAktiv) return e.bridgeState === 'live' ? 'zeigt' : e.bridgeState === 'held' ? 'gehalten' : 'ersatz';
  if (e.meeting !== 'im_meeting') return 'ohne_meeting';
  if (e.erlaubnis !== 'ja') return 'wartet_erlaubnis';
  if (e.fehlerstand !== null) return e.fehlerstand;
  if (e.fristLaeuft) return 'startet';
  return 'geplant';
}

/** Eingaben der Spalte „in o“ (Spec 10.1). `grund` = letzter Grund der Bridge; `zeigteSchon` zählt nur im Modus Teilnehmer. */
export interface OffenEingabe {
  zustand: ZoomSlotZustand;
  liefSchon: boolean;
  doppelt: number;
  zweifel: boolean;
  grund: SlotReason | null;
  modus: ZoomSlotModus;
  zeigteSchon: boolean;
}

/**
 * Spec 10.1, Spalte „in o“: SZ1 und SZ2 nur, wenn der Slot in diesem Meeting schon lief (0.12); SZ6 bei `doppelt` > 1,
 * `zweifel` (T13b), Grund `subscribeFailed` (B51) und bei Teilnehmer-Slots mit Grund `participantLeft`/`noTarget`, die die
 * eingestellte Person schon zeigten (FR7); SZ7, SZ8 und SZ10 immer; alle übrigen nie.
 */
export function istOffen(e: OffenEingabe): boolean {
  switch (e.zustand) {
    case 'ohne_meeting':
    case 'wartet_erlaubnis':
      return e.liefSchon;
    case 'ersatz':
      return e.doppelt > 1 || e.zweifel || e.grund === 'subscribeFailed'
        || (e.modus === 'teilnehmer' && e.zeigteSchon && (e.grund === 'participantLeft' || e.grund === 'noTarget'));
    case 'keine_antwort':
    case 'gescheitert':
    case 'zurueckgestellt':
      return true;
    case 'aus':
    case 'startet':
    case 'zeigt':
    case 'gehalten':
    case 'stoppt':
    case 'geplant':
      return false;
  }
}

/** Zahlen über alle angelegten Slots (Spec 3, 10.1, 10.3). */
export interface SlotZahlen { n: number; k: number; o: number; e: number; a: number; gestopptEntzug: number }

/**
 * n = laufend (SZ4, SZ5, SZ6, SZ9), k = mit Ersatzbild (SZ6), o = offen, e = eingeschaltet (auch vorübergehend und
 * `anNurMeeting`), a = angelegt; `gestopptEntzug` = SZ2 bei Erlaubnis „entzogen“ und `liefSchon` (10.3, T82).
 */
export function zaehleSlots(
  l: readonly { zustand: ZoomSlotZustand; offen: boolean; an: boolean; erlaubnis: ZoomErlaubnis | null; liefSchon: boolean }[],
): SlotZahlen {
  const z: SlotZahlen = { n: 0, k: 0, o: 0, e: 0, a: 0, gestopptEntzug: 0 };
  for (const s of l) {
    z.a++;
    if (s.zustand === 'zeigt' || s.zustand === 'gehalten' || s.zustand === 'ersatz' || s.zustand === 'stoppt') z.n++;
    if (s.zustand === 'ersatz') z.k++;
    if (s.offen) z.o++;
    if (s.an) z.e++;
    if (s.zustand === 'wartet_erlaubnis' && s.erlaubnis === 'entzogen' && s.liefSchon) z.gestopptEntzug++;
  }
  return z;
}

/** Spec 7.1, Ton-Abbildung (Connect → Bridge, KF8). Connect sendet immer beide Felder zusammen, nie eines allein (PK14). */
export function tonFuerBridge(
  e: Pick<ZoomSlotEinstellung, 'tonAn' | 'tonArt' | 'computerton'>,
): { audio: SlotAudioSetting; shareAudio: boolean } {
  return { audio: !e.tonAn ? 'off' : e.tonArt === 'person' ? 'person' : 'mix', shareAudio: e.computerton };
}

/** „Ton eingeschaltet“ für Companion (`zoom_slot{n}_audio`) und Kachel (Spec 8.2): `tonAn`, oder im Modus Freigabe `computerton`. */
export function tonEingeschaltet(e: Pick<ZoomSlotEinstellung, 'tonAn' | 'modus' | 'computerton'>): boolean {
  return e.tonAn || (e.modus === 'freigabe' && e.computerton);
}

/** Modus in Connect → `mode` der Bridge (Spec 3). */
export const MODUS_ZU_BRIDGE: Record<ZoomSlotModus, SlotMode> = { teilnehmer: 'participant', sprecher: 'speaker', freigabe: 'share' };
/** Ersatzbild in Connect → `fallback` der Bridge (Spec 3, 6.12). */
export const ERSATZBILD_ZU_BRIDGE: Record<ZoomSlotErsatzbild, SlotFallback> = {
  transparent: 'transparent', eingefroren: 'freeze', schwarz: 'black', weiss: 'white',
};
/** Sprecher-Signal in Connect → `signal` von `speakerConfig` (Spec 3, 7.6). */
export const SIGNAL_ZU_BRIDGE: Record<ZoomSprecherSignal, SpeakerSignal> = {
  sprecherVideo: 'speakerVideo', aktivesVideo: 'activeVideo', tonAktiv: 'activeAudio',
};

/**
 * `slotOn` mit allen Feldern (Spec 6.2, 7.3 Nr. 2), Ton über tonFuerBridge. `id` nur im Modus Teilnehmer (0 = kein Ziel);
 * Sprecher- und Freigabe-Slots wählen ihr Ziel in der Bridge (7.3 Nr. 9). Keine Kennung ist 0: ANNAHME AN10, teils belegt.
 */
export function slotOnBefehl(e: ZoomSlotEinstellung, ziel: number): Extract<Command, { cmd: 'slotOn' }> {
  const ton = tonFuerBridge(e);
  return {
    cmd: 'slotOn',
    slot: e.nr,
    ndi: e.ndiName,
    mode: MODUS_ZU_BRIDGE[e.modus],
    ...(e.modus === 'teilnehmer' ? { id: ziel } : {}),
    resolution: e.aufloesung,
    audio: ton.audio,
    shareAudio: ton.shareAudio,
    fallback: ERSATZBILD_ZU_BRIDGE[e.ersatzbild],
    showNoVideo: e.ohneKamera,
  };
}

// ── Slot-Abgleich (Spec 7.3 Nr. 1–10, 7.4; Plan B, Task B2) ──

/** Je Slot nur diese Sitzung (Spec 7.3 Nr. 2, 5, 6, 7); wird nie gespeichert. */
export interface SlotSitzung {
  /** Wen der Slot zeigt oder zuletzt zeigte (Nr. 5); die Handwahl (`slotPersonWaehlen`) setzt sie. */
  gewaehlteId: number | null;
  /** Stand der Beitrittsfolge, als die gewählte Person ging. Der Kern setzt ihn beim `left` dieser Kennung (Nr. 5 c). */
  wegSeq: number | null;
  /** Name nach einer Umbenennung der gezeigten Person, nur für dieses Meeting (Nr. 6). */
  personJetzt: string | null;
  /** Lief in diesem Meeting schon; der Kern setzt es beim ersten `slot starting` (Nr. 7, 0.12). */
  liefSchon: boolean;
  /** Zeigte die eingestellte Person schon; gesetzt nur über zeigteSchonNachLive (Nr. 7, N3). */
  zeigteSchon: boolean;
  fehlerstand: SlotFehlerstand | null;
  /** `slotOn` gesendet, die Antwortfrist läuft (Nr. 2). */
  frist: boolean;
}

/** Stand zu Beginn jeder Sitzung und nach jedem Sitzungsende (sitzungNach). */
export const SITZUNG_LEER: Readonly<SlotSitzung> = {
  gewaehlteId: null, wegSeq: null, personJetzt: null, liefSchon: false, zeigteSchon: false, fehlerstand: null, frist: false,
};

/** Teilnehmer ohne die eigene Zeile der Bridge. `folge`: Beitrittsfolge (Einträge aus `roster` 0, jedes `joined` die nächste Zahl). */
export interface AbgleichTeilnehmer { id: number; name: string; imWarteraum: boolean; folge: number }

/**
 * Ein Slot im Abgleich. `bridge`: Sender dieses Slots in der aktiven Bridge, `null` ohne Sender. `bridge.imAbbau`: `slotOff`
 * ist gesendet oder die Generation baut ab; dann plant der Abgleich für diesen Slot nichts (Nr. 4, Nr. 10).
 */
export interface AbgleichSlot {
  e: ZoomSlotEinstellung;
  voruebergehend: boolean;
  anNurMeeting: boolean;
  s: SlotSitzung;
  bridge: { laeuft: boolean; imAbbau: boolean; mode: SlotMode; target: number } | null;
}
export interface AbgleichEingabe {
  meeting: ZoomZustand;
  erlaubnis: ZoomErlaubnis | null;
  ueber5: boolean;
  teilnehmer: readonly AbgleichTeilnehmer[];
  slots: readonly AbgleichSlot[];
}
/** Was der Kern ausführt, in dieser Reihenfolge: nach Nummer, je Slot `nameMerken` vor dem Befehl. */
export type AbgleichHandlung =
  | { art: 'starten'; nr: number; befehl: Extract<Command, { cmd: 'slotOn' }> }
  | { art: 'aendern'; nr: number; befehl: Extract<Command, { cmd: 'slotSet' }> }
  | { art: 'stoppen'; nr: number }
  | { art: 'zurueckstellen'; nr: number }
  | { art: 'nameMerken'; nr: number; gewaehlteId: number | null };

/**
 * Ziel eines Teilnehmer-Slots (Spec 7.3 Nr. 5, 6). `wahl` trägt die Kandidaten bei Doppelname und Zweifel; ihr `hinweis`
 * bleibt hier leer: Kamera und Rolle kennt der Abgleich nicht, die Kennzeichen setzt der Kern (Task B12) aus
 * KANDIDAT_KENNZEICHEN (Task B9, OFP3).
 */
export interface ZielErgebnis {
  ziel: number;                      // 0 = kein Ziel; keine Kennung ist 0: ANNAHME AN10, teils belegt
  gewaehlteId: number | null;
  doppelt: number;
  zweifel: boolean;
  imWarteraum: boolean;
  keinePerson: boolean;
  wahl: { id: number; name: string; hinweis: string }[] | null;
}

/**
 * Spec 7.3 Nr. 5, 6. Gesucht wird nach dem normierten Namen (`normName`) von `person` und, falls gesetzt, `personJetzt`;
 * Namensvettern sind alle Teilnehmer mit einem dieser Namen, einschließlich Warteraum.
 * (a) `gewaehlteId` ist da: im Warteraum → Ziel 0 (T17), sonst sie; Namensvettern ändern nichts.
 * Ohne Person und ohne `personJetzt` → Ziel 0, `keinePerson` (T18).
 * (b) `gewaehlteId` nicht gesetzt: keiner → 0 (T16); genau einer → er (im Warteraum: 0, T17); mehrere → 0, `doppelt`, `wahl` (T13).
 * (c) `gewaehlteId` gesetzt, die Person ist gegangen: genau einer, nach dem Weggang beigetreten (`folge` > `wegSeq`) → Rückkehr
 * auf ihn; genau einer, schon vorher da oder `wegSeq` unbekannt → 0, `zweifel`, `wahl` (T13b); im Warteraum → 0 (T17);
 * mehrere → 0, `doppelt`, `wahl` (T13); keiner → 0 (T16).
 */
export function teilnehmerZiel(e: ZoomSlotEinstellung, s: SlotSitzung, t: readonly AbgleichTeilnehmer[]): ZielErgebnis {
  const ohne = { doppelt: 1, zweifel: false, imWarteraum: false, keinePerson: false, wahl: null };
  if (s.gewaehlteId !== null) {
    const da = t.find((x) => x.id === s.gewaehlteId);
    if (da !== undefined) {
      return da.imWarteraum ? { ...ohne, ziel: 0, gewaehlteId: da.id, imWarteraum: true } : { ...ohne, ziel: da.id, gewaehlteId: da.id };
    }
  }
  const namen = [e.person, s.personJetzt ?? ''].map(normName).filter((n) => n !== '');
  if (namen.length === 0) return { ...ohne, ziel: 0, gewaehlteId: s.gewaehlteId, keinePerson: true };
  const vettern = t.filter((x) => namen.includes(normName(x.name)));
  const wahl = vettern.map((x) => ({ id: x.id, name: x.name, hinweis: '' }));
  if (vettern.length === 0) return { ...ohne, ziel: 0, gewaehlteId: s.gewaehlteId };
  if (vettern.length > 1) return { ...ohne, ziel: 0, gewaehlteId: s.gewaehlteId, doppelt: vettern.length, wahl };
  const v = vettern[0];
  if (v.imWarteraum) return { ...ohne, ziel: 0, gewaehlteId: s.gewaehlteId, imWarteraum: true };
  if (s.gewaehlteId === null || (s.wegSeq !== null && v.folge > s.wegSeq)) return { ...ohne, ziel: v.id, gewaehlteId: v.id };
  return { ...ohne, ziel: 0, gewaehlteId: s.gewaehlteId, zweifel: true, wahl };
}

/**
 * Spec 7.3 Nr. 1–10, rein. Der Kern ruft es 300 ms nach `roster`, `joined`, `left`, `renamed`, `videoStatus`, Erlaubnis
 * „ja“, Ankommen im Meeting und spätem Abbau bei Erlaubnis „ja“, sofort nach jeder Änderung des Bedieners (Task B12).
 * - Nr. 4: ausgeschaltet und läuft → `stoppen`, in jedem Zustand.
 * - Nr. 1: gestartet und umgehängt wird nur in `im_meeting` mit Erlaubnis „ja“.
 * - Nr. 2: eingeschaltet, läuft nicht, keine Frist, kein Fehlerstand → `starten` (slotOnBefehl).
 * - Nr. 3: ohne Zustimmung starten nur die ersten BETRIEBSGROESSE eingeschalteten Slots nach Nummer, der Rest wird
 *   `zurueckstellen` (laufende zählen mit).
 * - Nr. 5: ein laufender Teilnehmer-Slot, dessen Ziel abweicht → `aendern` mit `slotSet {slot, id}`; eine neue
 *   `gewaehlteId` → `nameMerken`. Meldet die Bridge noch einen anderen Modus, wartet der Slot (Moduswechsel unterwegs).
 * - Nr. 9: Sprecher- und Freigabe-Slots bekommen kein Ziel. Nr. 10: `bridge.imAbbau` → nichts.
 * - Nr. 8 (vorübergehende Slots, `anNurMeeting`) regelt slotEndetMitMeeting.
 */
export function planeSlotAbgleich(e: AbgleichEingabe): AbgleichHandlung[] {
  const aus: AbgleichHandlung[] = [];
  const startbar = e.meeting === 'im_meeting' && e.erlaubnis === 'ja';
  const sortiert = [...e.slots].sort((a, b) => a.e.nr - b.e.nr);
  const eingeschaltet = sortiert.filter((x) => x.e.an).map((x) => x.e.nr);
  const erlaubt = new Set(e.ueber5 ? eingeschaltet : eingeschaltet.slice(0, BETRIEBSGROESSE));
  for (const x of sortiert) {
    const nr = x.e.nr;
    if (x.bridge?.imAbbau) continue;
    const laeuft = x.bridge?.laeuft === true;
    if (!x.e.an) {
      if (laeuft) aus.push({ art: 'stoppen', nr });
      continue;
    }
    if (!startbar) continue;
    const z = x.e.modus === 'teilnehmer' ? teilnehmerZiel(x.e, x.s, e.teilnehmer) : null;
    if (laeuft) {
      if (z !== null && x.bridge !== null && x.bridge.mode === 'participant') {
        if (z.gewaehlteId !== x.s.gewaehlteId) aus.push({ art: 'nameMerken', nr, gewaehlteId: z.gewaehlteId });
        if (z.ziel !== x.bridge.target) aus.push({ art: 'aendern', nr, befehl: { cmd: 'slotSet', slot: nr, id: z.ziel } });
      }
      continue;
    }
    if (x.s.frist || x.s.fehlerstand !== null) continue;
    if (!erlaubt.has(nr)) {
      aus.push({ art: 'zurueckstellen', nr });
      continue;
    }
    if (z !== null && z.gewaehlteId !== x.s.gewaehlteId) aus.push({ art: 'nameMerken', nr, gewaehlteId: z.gewaehlteId });
    aus.push({ art: 'starten', nr, befehl: slotOnBefehl(x.e, z?.ziel ?? 0) });
  }
  return aus;
}

/** Ereignisse, die die Sitzung eines Slots berühren (Spec 7.2, 7.3 Nr. 2, 5, 7, 8). */
export type SitzungsEreignis = 'meetingEnde' | 'verlassen' | 'schliessen' | 'beitritt' | 'beenden' | 'mangel' | 'neueBridge'
  | 'entzug' | 'z10Roster' | 'z11' | 'erneut' | 'personGeaendert' | 'modusGeaendert' | 'stoppStart';

/** Wie die Soll-Liste in 0.3.0 (Spec 7.2, RR1): Meeting-Ende, „Verlassen“, „Schließen“, neuer Beitritt, Beenden, Mangel der Einrichtung. */
function istSitzungsende(ereignis: SitzungsEreignis): boolean {
  return ereignis === 'meetingEnde' || ereignis === 'verlassen' || ereignis === 'schliessen' || ereignis === 'beitritt'
    || ereignis === 'beenden' || ereignis === 'mangel';
}

/**
 * Sitzung eines Slots nach einem Ereignis (Spec 7.3 Nr. 2, 5, 7; RR1, RR7, RR9).
 * - Sitzungsende: alles fällt (SITZUNG_LEER).
 * - Neue Bridge, Z11 (neue Bridge nach dem Wiederbeitritt), „Erneut beitreten“: Fehlerstand und Frist fallen, die Kennungen
 *   gelten nicht mehr (`gewaehlteId`, `wegSeq`, `personJetzt`); `liefSchon`/`zeigteSchon` bleiben (Fortsetzung).
 * - Neues `roster` nach Z10: nur die Kennungen fallen. Entzug: nichts fällt.
 * - Person geändert: Kennungen und `zeigteSchon` fallen; Modus geändert: `zeigteSchon` fällt.
 * - „Stopp“/„Start“ dieses Slots: Fehlerstand und Frist fallen.
 */
export function sitzungNach(s: SlotSitzung, ereignis: SitzungsEreignis): SlotSitzung {
  if (istSitzungsende(ereignis)) return { ...SITZUNG_LEER };
  switch (ereignis) {
    case 'neueBridge':
    case 'z11':
    case 'erneut':
      return { ...s, gewaehlteId: null, wegSeq: null, personJetzt: null, fehlerstand: null, frist: false };
    case 'z10Roster':
      return { ...s, gewaehlteId: null, wegSeq: null, personJetzt: null };
    case 'personGeaendert':
      return { ...s, gewaehlteId: null, wegSeq: null, personJetzt: null, zeigteSchon: false };
    case 'modusGeaendert':
      return { ...s, zeigteSchon: false };
    case 'stoppStart':
      return { ...s, fehlerstand: null, frist: false };
    default:
      return { ...s }; // 'entzug'
  }
}

/**
 * Spec 7.2, 7.3 Nr. 8: Zu den Sitzungsenden verschwindet ein vorübergehender Slot (`loeschen`; läuft er, sendet der Kern
 * vorher `slotOff`), ein dauerhafter mit `anNurMeeting` geht aus (`ausschalten`, gespeichert war schon `an: false`); sonst
 * und bei allen anderen Ereignissen `bleibt`.
 */
export function slotEndetMitMeeting(slot: { voruebergehend: boolean; anNurMeeting: boolean }, ereignis: SitzungsEreignis): 'loeschen' | 'ausschalten' | 'bleibt' {
  if (!istSitzungsende(ereignis)) return 'bleibt';
  if (slot.voruebergehend) return 'loeschen';
  return slot.anNurMeeting ? 'ausschalten' : 'bleibt';
}

/**
 * `zeigteSchon` nach einem `slot live` (Spec 7.3 Nr. 7, N3): gesetzt nur von `mode: participant` mit `target` = gültige
 * `gewaehlteId`. Ein `slot live` mit anderem Ziel oder Modus kann nach einem Personen- oder Moduswechsel noch unterwegs sein
 * und setzt es nicht. Der Kern ruft es nur für Slots im Modus Teilnehmer.
 */
export function zeigteSchonNachLive(s: SlotSitzung, ev: { mode: SlotMode; target: number }): boolean {
  return s.zeigteSchon || (ev.mode === 'participant' && s.gewaehlteId !== null && ev.target === s.gewaehlteId);
}

/** Spec 7.4: Die Zustimmung über BETRIEBSGROESSE verfällt, sobald höchstens so viele Slots eingeschaltet sind. */
export function ueber5Nach(eingeschaltet: number, zustimmung: boolean): boolean {
  return eingeschaltet > BETRIEBSGROESSE && zustimmung;
}

// ── Ende des Moduls ──
