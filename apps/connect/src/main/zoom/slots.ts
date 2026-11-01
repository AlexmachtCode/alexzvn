// Zoom-Slots in Connect als reine Funktionen (Spec 7.1, 7.3, 10.1): Zustand eines Slots nach der Vorrangfolge,
// Offenheit und Zählung (n, k, o, e), Ton-Abbildung und Befehlsbau. Plan B, Task B2 ergänzt den Slot-Abgleich (ersetzt
// soll.ts ab Task B12). Ohne Electron (G-B2): Laufzeit-Importe nur relativ; Bridge-Typen und -Konstanten nur aus
// @jm/zoom-bridge/protocol. Der Kern (kern.ts) ruft diese Funktionen und führt aus, was sie ergeben.
import type { Command, SlotAudioSetting, SlotFallback, SlotMode, SlotReason, SlotState, SpeakerSignal } from '@jm/zoom-bridge/protocol';
import type {
  ZoomErlaubnis, ZoomSlotEinstellung, ZoomSlotErsatzbild, ZoomSlotModus, ZoomSlotZustand, ZoomSprecherSignal, ZoomZustand,
} from '../../shared/types';

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

// ── Ende des Moduls ──
