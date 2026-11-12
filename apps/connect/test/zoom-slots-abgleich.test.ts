// Zoom-Slots in Connect als reine Funktionen OHNE Electron (tsx): npm run selftest -w @jm/connect
// Spec 10.1 (Slot-Zustände, Spalten n, k, o), 7.3 (Vorrang, ab Plan B Task B2 auch Nr. 1–10), 7.1 (Ton-Abbildung, KF8),
// 8.2 („Ton eingeschaltet“). Nachfolger der Soll-Abgleich-Blöcke aus zoom-teile.test.ts (Spec 11.10, berichtigt B-EP2).
import type { SlotReason } from '@jm/zoom-bridge/protocol';
import type { ZoomErlaubnis, ZoomSlotEinstellung, ZoomSlotModus, ZoomSlotZustand } from '../src/shared/types';
import {
  ERSATZBILD_ZU_BRIDGE, istOffen, MODUS_ZU_BRIDGE, planeSlotAbgleich, SIGNAL_ZU_BRIDGE, SITZUNG_LEER, sitzungNach, slotEndetMitMeeting,
  slotOnBefehl, slotZustand, teilnehmerZiel, tonEingeschaltet, tonFuerBridge, ueber5Nach, zaehleSlots, zeigteSchonNachLive,
  type AbgleichEingabe, type AbgleichSlot, type AbgleichTeilnehmer, type OffenEingabe, type SitzungsEreignis, type SlotSitzung,
  type SlotZustandEingabe, type ZielErgebnis,
} from '../src/main/zoom/slots';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

// ── Testhilfen ──
const j = (x: unknown): string => JSON.stringify(x);
/** JSON mit sortierten Schlüsseln: Gleichheit ohne Rücksicht auf die Reihenfolge der Felder. */
const flach = (x: unknown): string => JSON.stringify(x, (_k, v: unknown) =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
/** Kennungen wie in der Attrappe (ATTRAPPEN_NAMEN, G-B4). */
const ANNA = 16778240, BEN = 16778241;
/** Ein Slot mit den Vorgaben eines neuen Slots (7.6), Abweichungen über `x`. */
function einstellung(x: Partial<ZoomSlotEinstellung> = {}): ZoomSlotEinstellung {
  return {
    nr: 1, ndiName: 'Zoom 1', modus: 'teilnehmer', person: 'Anna', an: true, aufloesung: '720p', ersatzbild: 'transparent',
    tonAn: true, tonArt: 'mischton', computerton: true, ohneKamera: true, ...x,
  };
}
/** Lage für slotZustand: eingeschaltet, im Meeting, Erlaubnis „ja“, kein Sender, keine Frist, kein Fehlerstand (= SZ11). */
function lage(x: Partial<SlotZustandEingabe> = {}): SlotZustandEingabe {
  return {
    an: true, senderAktiv: false, slotOffGesendet: false, bridgeImAbbau: false, bridgeState: null, meeting: 'im_meeting',
    erlaubnis: 'ja', fehlerstand: null, fristLaeuft: false, ...x,
  };
}
const ZUSTAENDE: ZoomSlotZustand[] = [
  'aus', 'ohne_meeting', 'wartet_erlaubnis', 'startet', 'zeigt', 'gehalten', 'ersatz', 'keine_antwort', 'gescheitert', 'stoppt',
  'zurueckgestellt', 'geplant',
];
const GRUENDE: SlotReason[] = [
  'command', 'frames', 'noTarget', 'participantLeft', 'cameraOff', 'noFrames', 'speakerNone', 'speakerNoVideo', 'speakerChanged',
  'shareNone', 'sharePaused', 'shareStill', 'shareChanged', 'targetChanged', 'modeChanged', 'resolutionChanged', 'bufferMismatch',
  'subscribeFailed', 'meetingEnded', 'privilegeRevoked',
];
const MODI: ZoomSlotModus[] = ['teilnehmer', 'sprecher', 'freigabe'];

console.log('— B1 · 10.1: je Slot-Zustand Bedingung, n und k');
{
  const SZ: Array<[string, Partial<SlotZustandEingabe>, ZoomSlotZustand, number, number]> = [
    ['SZ0 Start aus, kein Sender', { an: false }, 'aus', 0, 0],
    ['SZ1 an, nicht im Meeting, kein Sender', { meeting: 'warteraum' }, 'ohne_meeting', 0, 0],
    ['SZ2 an, im Meeting, Erlaubnis offen', { erlaubnis: 'offen' }, 'wartet_erlaubnis', 0, 0],
    ['SZ3 slotOn gesendet, Frist läuft', { fristLaeuft: true }, 'startet', 0, 0],
    ['SZ4 Bridge live', { senderAktiv: true, bridgeState: 'live' }, 'zeigt', 1, 0],
    ['SZ5 Bridge held', { senderAktiv: true, bridgeState: 'held' }, 'gehalten', 1, 0],
    ['SZ6 Bridge starting', { senderAktiv: true, bridgeState: 'starting' }, 'ersatz', 1, 1],
    ['SZ6 Bridge fallback', { senderAktiv: true, bridgeState: 'fallback' }, 'ersatz', 1, 1],
    ['SZ7 Fehlerstand keine_antwort', { fehlerstand: 'keine_antwort' }, 'keine_antwort', 0, 0],
    ['SZ8 Fehlerstand gescheitert', { fehlerstand: 'gescheitert' }, 'gescheitert', 0, 0],
    ['SZ9 slotOff gesendet, Sender noch da', { an: false, senderAktiv: true, bridgeState: 'live', slotOffGesendet: true }, 'stoppt', 1, 0],
    ['SZ9 Bridge im Abbau, Sender noch da', { senderAktiv: true, bridgeState: 'fallback', bridgeImAbbau: true }, 'stoppt', 1, 0],
    ['SZ10 Fehlerstand zurueckgestellt', { fehlerstand: 'zurueckgestellt' }, 'zurueckgestellt', 0, 0],
    ['SZ11 an, im Meeting, Erlaubnis ja, nichts offen', {}, 'geplant', 0, 0],
  ];
  for (const [titel, x, zustand, n, k] of SZ) {
    const z = slotZustand(lage(x));
    const zahl = zaehleSlots([{ zustand: z, offen: false, an: lage(x).an, erlaubnis: 'ja', liefSchon: false }]);
    ck(`B1 10.1 ${titel}: Zustand ${zustand}, n = ${n}, k = ${k}`, z === zustand && zahl.n === n && zahl.k === k);
  }
  ck('B1 10.1: Bridge im Abbau ohne Sender ist kein SZ9 (zählt nicht in n)', slotZustand(lage({ bridgeImAbbau: true })) === 'geplant');
}

console.log('— B1 · 10.1: Spalte „in o“');
{
  const o = (zustand: ZoomSlotZustand, x: Partial<OffenEingabe> = {}): boolean =>
    istOffen({ zustand, liefSchon: false, doppelt: 1, zweifel: false, grund: null, modus: 'teilnehmer', zeigteSchon: false, ...x });
  ck('B1 10.1 SZ1: offen nur mit liefSchon', o('ohne_meeting', { liefSchon: true }) && !o('ohne_meeting'));
  ck('B1 10.1 SZ2: offen nur mit liefSchon (Z6 beim ersten Beitritt kein Alarm)', o('wartet_erlaubnis', { liefSchon: true }) && !o('wartet_erlaubnis'));
  ck('B1 10.1 SZ6: doppelt > 1 → offen', o('ersatz', { doppelt: 2, grund: 'noTarget' }));
  ck('B1 10.1 SZ6: zweifel (T13b) → offen', o('ersatz', { zweifel: true, grund: 'noTarget' }));
  ck('B1 10.1 SZ6: Grund subscribeFailed → offen (B51)', o('ersatz', { grund: 'subscribeFailed' }) && o('ersatz', { grund: 'subscribeFailed', modus: 'sprecher' }));
  ck('B1 10.1 SZ6: Teilnehmer, participantLeft oder noTarget, zeigteSchon → offen (FR7)',
    o('ersatz', { grund: 'participantLeft', zeigteSchon: true }) && o('ersatz', { grund: 'noTarget', zeigteSchon: true }));
  ck('B1 10.1 SZ6: participantLeft ohne zeigteSchon → nicht offen (0.12: Person kam nie)', !o('ersatz', { grund: 'participantLeft' }) && !o('ersatz', { grund: 'noTarget' }));
  ck('B1 10.1 SZ6: participantLeft mit zeigteSchon im Modus Sprecher → nicht offen', !o('ersatz', { grund: 'participantLeft', zeigteSchon: true, modus: 'sprecher' }));
  ck('B1 10.1 SZ6: cameraOff mit zeigteSchon → nicht offen (T19, B60)', !o('ersatz', { grund: 'cameraOff', zeigteSchon: true }));
  ck('B1 10.1 SZ7, SZ8, SZ10: immer offen', o('keine_antwort') && o('gescheitert') && o('zurueckgestellt'));
  ck('B1 10.1 SZ0, SZ3, SZ4, SZ5, SZ9, SZ11: nie offen, auch mit liefSchon, doppelt, zweifel und subscribeFailed',
    (['aus', 'startet', 'zeigt', 'gehalten', 'stoppt', 'geplant'] as ZoomSlotZustand[])
      .every((z) => !o(z, { liefSchon: true, doppelt: 3, zweifel: true, grund: 'subscribeFailed', zeigteSchon: true })));
  // Kreuzprodukt: die Spalte „in o“ der Tabelle 10.1 als Daten, gegen jede Kombination der Achsen.
  const SPALTE_O: Record<ZoomSlotZustand, (x: OffenEingabe) => boolean> = {
    aus: () => false,
    ohne_meeting: (x) => x.liefSchon,
    wartet_erlaubnis: (x) => x.liefSchon,
    startet: () => false,
    zeigt: () => false,
    gehalten: () => false,
    ersatz: (x) => x.doppelt > 1 || x.zweifel || x.grund === 'subscribeFailed'
      || (x.modus === 'teilnehmer' && x.zeigteSchon && (x.grund === 'participantLeft' || x.grund === 'noTarget')),
    keine_antwort: () => true,
    gescheitert: () => true,
    stoppt: () => false,
    zurueckgestellt: () => true,
    geplant: () => false,
  };
  let n = 0;
  const abweichung: string[] = [];
  for (const zustand of ZUSTAENDE) for (const liefSchon of [false, true]) for (const doppelt of [1, 2]) for (const zweifel of [false, true])
    for (const grund of [null, ...GRUENDE]) for (const modus of MODI) for (const zeigteSchon of [false, true]) {
      const x: OffenEingabe = { zustand, liefSchon, doppelt, zweifel, grund, modus, zeigteSchon };
      n++;
      if (istOffen(x) !== SPALTE_O[zustand](x)) abweichung.push(j(x));
    }
  if (abweichung.length > 0) console.log(`     (${abweichung.length} Abweichungen, etwa ${abweichung.slice(0, 2).join(' | ')})`);
  ck(`B1 10.1 Kreuzprodukt: alle ${n} Kombinationen wie die Spalte „in o“`, abweichung.length === 0 && n === 12 * 2 * 2 * 2 * 21 * 3 * 2);
}

console.log('— B1 · 7.3: Vorrang, je Zeile eine Lage, in der auch eine spätere Zeile passte');
{
  const alles: Partial<SlotZustandEingabe> = { meeting: 'warteraum', erlaubnis: 'offen', fehlerstand: 'gescheitert', fristLaeuft: true };
  ck('B1 7.3 Zeile 1 vor 2–8: Start aus ohne Sender → aus (auch mit Abbau, Meeting weg, Fehlerstand, Frist)',
    slotZustand(lage({ ...alles, an: false, bridgeImAbbau: true })) === 'aus');
  ck('B1 7.3 Zeile 2 vor 3: slotOff gesendet bei laufendem Sender → stoppt', slotZustand(lage({ ...alles, senderAktiv: true, bridgeState: 'live', slotOffGesendet: true })) === 'stoppt');
  ck('B1 7.3 Zeile 2 vor 4–8: slotOff gesendet, noch kein Ereignis → stoppt', slotZustand(lage({ ...alles, slotOffGesendet: true })) === 'stoppt');
  ck('B1 7.3 Zeile 3 vor 4–8: Sender außerhalb des Meetings → zeigt bzw. gehalten bzw. ersatz',
    slotZustand(lage({ ...alles, senderAktiv: true, bridgeState: 'live' })) === 'zeigt'
      && slotZustand(lage({ ...alles, senderAktiv: true, bridgeState: 'held' })) === 'gehalten'
      && slotZustand(lage({ ...alles, senderAktiv: true, bridgeState: 'starting' })) === 'ersatz');
  ck('B1 7.3 Zeile 3: Sender ausgeschaltet, slotOff noch nicht gesendet → weiter nach der Lage der Bridge', slotZustand(lage({ an: false, senderAktiv: true, bridgeState: 'live' })) === 'zeigt');
  ck('B1 7.3 Zeile 4 vor 5–8: nicht im Meeting → ohne_meeting', slotZustand(lage({ ...alles })) === 'ohne_meeting');
  ck('B1 7.3 Zeile 5 vor 6–8: Erlaubnis nicht ja → wartet_erlaubnis (auch mit Fehlerstand und Frist)',
    slotZustand(lage({ erlaubnis: 'entzogen', fehlerstand: 'gescheitert', fristLaeuft: true })) === 'wartet_erlaubnis'
      && slotZustand(lage({ erlaubnis: null, fehlerstand: 'keine_antwort' })) === 'wartet_erlaubnis');
  ck('B1 7.3 Zeile 6 vor 7: Fehlerstand mit laufender Frist → Fehlerstand',
    slotZustand(lage({ fehlerstand: 'keine_antwort', fristLaeuft: true })) === 'keine_antwort'
      && slotZustand(lage({ fehlerstand: 'zurueckgestellt', fristLaeuft: true })) === 'zurueckgestellt');
  ck('B1 7.3 Zeile 7 vor 8: Frist → startet', slotZustand(lage({ fristLaeuft: true })) === 'startet');
}

console.log('— B1 · 10.1, 10.3: zaehleSlots');
{
  const s = (zustand: ZoomSlotZustand, offen = false, an = true, erlaubnis: ZoomErlaubnis | null = 'ja', liefSchon = false) => ({ zustand, offen, an, erlaubnis, liefSchon });
  const z = zaehleSlots([s('zeigt'), s('gehalten'), s('ersatz', true), s('stoppt', false, false), s('aus', false, false), s('gescheitert', true), s('geplant')]);
  ck('B1 n = SZ4 + SZ5 + SZ6 + SZ9, k = SZ6, o = offene, e = eingeschaltete, a = angelegte',
    j(z) === j({ n: 4, k: 1, o: 2, e: 5, a: 7, gestopptEntzug: 0 }));
  ck('B1 keine Slots → alles 0', j(zaehleSlots([])) === j({ n: 0, k: 0, o: 0, e: 0, a: 0, gestopptEntzug: 0 }));
  ck('B1 10.3 gestopptEntzug: SZ2, Erlaubnis entzogen, liefSchon → 1', zaehleSlots([s('wartet_erlaubnis', true, true, 'entzogen', true)]).gestopptEntzug === 1);
  ck('B1 10.3 gestopptEntzug: ohne liefSchon, bei Erlaubnis offen oder in SZ1 → 0',
    zaehleSlots([s('wartet_erlaubnis', false, true, 'entzogen', false), s('wartet_erlaubnis', true, true, 'offen', true), s('ohne_meeting', true, true, 'entzogen', true)]).gestopptEntzug === 0);
}

console.log('— B1 · 7.1 Ton-Abbildung (KF8) und „Ton eingeschaltet“ (8.2)');
{
  const ZEILEN: Array<[string, Partial<ZoomSlotEinstellung>, string, boolean]> = [
    ['1 aus, Computerton aus', { tonAn: false, computerton: false }, 'off', false],
    ['2 aus, Computerton an', { tonAn: false, computerton: true }, 'off', true],
    ['3 Mischton, Computerton aus', { tonAn: true, tonArt: 'mischton', computerton: false }, 'mix', false],
    ['4 Mischton, Computerton an', { tonAn: true, tonArt: 'mischton', computerton: true }, 'mix', true],
    ['5 Person, Computerton aus', { tonAn: true, tonArt: 'person', computerton: false }, 'person', false],
    ['6 Person, Computerton an', { tonAn: true, tonArt: 'person', computerton: true }, 'person', true],
  ];
  for (const [titel, x, audio, shareAudio] of ZEILEN) {
    ck(`B1 KF8 Zeile ${titel} → audio ${audio}, shareAudio ${shareAudio}`, j(tonFuerBridge(einstellung(x))) === j({ audio, shareAudio }));
  }
  ck('B1 KF8: bei Ton aus zählt die Tonart nicht', j(tonFuerBridge(einstellung({ tonAn: false, tonArt: 'person', computerton: false }))) === j({ audio: 'off', shareAudio: false }));
  let falsch = 0;
  for (const modus of MODI) for (const tonAn of [false, true]) for (const computerton of [false, true]) {
    if (tonEingeschaltet(einstellung({ modus, tonAn, computerton })) !== (tonAn || (modus === 'freigabe' && computerton))) falsch++;
  }
  ck('B1 8.2 tonEingeschaltet: tonAn, oder im Modus Freigabe der Computerton (12 Kombinationen)', falsch === 0);
  ck('B1 8.2 tonEingeschaltet: Freigabe mit nur Computerton → 1; Sprecher mit nur Computerton → 0',
    tonEingeschaltet(einstellung({ modus: 'freigabe', tonAn: false, computerton: true }))
      && !tonEingeschaltet(einstellung({ modus: 'sprecher', tonAn: false, computerton: true })));
}

console.log('— B1 · Abbildungen und slotOnBefehl (6.2, 7.3 Nr. 2, Nr. 9)');
{
  ck('B1 MODUS_ZU_BRIDGE', j(MODUS_ZU_BRIDGE) === j({ teilnehmer: 'participant', sprecher: 'speaker', freigabe: 'share' }));
  ck('B1 ERSATZBILD_ZU_BRIDGE', j(ERSATZBILD_ZU_BRIDGE) === j({ transparent: 'transparent', eingefroren: 'freeze', schwarz: 'black', weiss: 'white' }));
  ck('B1 SIGNAL_ZU_BRIDGE', j(SIGNAL_ZU_BRIDGE) === j({ sprecherVideo: 'speakerVideo', aktivesVideo: 'activeVideo', tonAktiv: 'activeAudio' }));
  // Konstruktor-Rundlauf: jedes Feld weicht von der Vorgabe eines neuen Slots ab und muss im Befehl ankommen.
  const abweichend = einstellung({
    nr: 7, ndiName: 'Bühne links', modus: 'teilnehmer', person: 'Ben', aufloesung: '1080p', ersatzbild: 'weiss', tonAn: true,
    tonArt: 'person', computerton: false, ohneKamera: false,
  });
  ck('B1 slotOnBefehl Teilnehmer: alle Felder aus der Einstellung, id = Ziel',
    flach(slotOnBefehl(abweichend, BEN, abweichend.ndiName)) === flach({
      cmd: 'slotOn', slot: 7, ndi: 'Bühne links', mode: 'participant', id: BEN, resolution: '1080p', audio: 'person', shareAudio: false,
      fallback: 'white', showNoVideo: false,
    }));
  ck('B1 slotOnBefehl Teilnehmer ohne Ziel: id 0', slotOnBefehl(einstellung(), 0, 'Zoom 1').id === 0);
  ck('B1 slotOnBefehl Sprecher: ohne id (die Bridge wählt), Mischton, Computerton, Ersatzbild eingefroren',
    flach(slotOnBefehl(einstellung({ nr: 2, ndiName: 'Sprecher', modus: 'sprecher', ersatzbild: 'eingefroren', aufloesung: '360p' }), ANNA, 'Sprecher')) === flach({
      cmd: 'slotOn', slot: 2, ndi: 'Sprecher', mode: 'speaker', resolution: '360p', audio: 'mix', shareAudio: true, fallback: 'freeze',
      showNoVideo: true,
    }));
  ck('B1 slotOnBefehl Freigabe: ohne id, Ton aus, Computerton an, schwarz',
    flach(slotOnBefehl(einstellung({ nr: 16, ndiName: 'Folien', modus: 'freigabe', tonAn: false, ersatzbild: 'schwarz' }), 0, 'Folien')) === flach({
      cmd: 'slotOn', slot: 16, ndi: 'Folien', mode: 'share', resolution: '720p', audio: 'off', shareAudio: true, fallback: 'black',
      showNoVideo: true,
    }));
}

// ── Plan B, Task B2: Slot-Abgleich rein (Spec 7.3 Nr. 1–10, 7.2, 7.4) ──
const ANNA_NEU = 16778250, CARLA = 16778242;
/** Teilnehmer für den Abgleich; `folge` = Beitrittsfolge (roster 0, jedes joined die nächste Zahl). */
const t = (id: number, name: string, folge = 0, imWarteraum = false): AbgleichTeilnehmer => ({ id, name, imWarteraum, folge });
const sitzung = (x: Partial<SlotSitzung> = {}): SlotSitzung => ({ ...SITZUNG_LEER, ...x });
function aslot(e: ZoomSlotEinstellung, s: Partial<SlotSitzung> = {}, bridge: AbgleichSlot['bridge'] = null): AbgleichSlot {
  return { e, voruebergehend: false, anNurMeeting: false, s: sitzung(s), bridge };
}
const laeuft = (mode: 'participant' | 'speaker' | 'share', target: number): AbgleichSlot['bridge'] => ({ laeuft: true, imAbbau: false, mode, target });
function abgleich(slots: AbgleichSlot[], teilnehmer: AbgleichTeilnehmer[], x: Partial<AbgleichEingabe> = {}): string {
  return j(planeSlotAbgleich({ meeting: 'im_meeting', erlaubnis: 'ja', ueber5: false, personImNdiNamen: false, teilnehmer, slots, ...x }));
}
const ziel = (x: Partial<ZielErgebnis>): string =>
  flach({ ziel: 0, gewaehlteId: null, doppelt: 1, zweifel: false, imWarteraum: false, keinePerson: false, wahl: null, ...x });

console.log('— B2 · 7.3 Nr. 1–4, 9, 10: starten, stoppen, zurückstellen');
{
  const anna = einstellung();
  const T = [t(ANNA, 'Anna'), t(BEN, 'Ben')];
  const start = j([{ art: 'nameMerken', nr: 1, gewaehlteId: ANNA }, { art: 'starten', nr: 1, befehl: slotOnBefehl(anna, ANNA, anna.ndiName) }]);
  ck('B2 7.3 Nr. 1: nicht im Meeting → nichts', abgleich([aslot(anna)], T, { meeting: 'warteraum' }) === '[]' && abgleich([aslot(anna)], T, { meeting: 'abriss' }) === '[]');
  ck('B2 7.3 Nr. 1: Erlaubnis nicht „ja“ → nichts', ([null, 'offen', 'abgelehnt', 'abgelaufen', 'entzogen'] as const).every((erlaubnis) => abgleich([aslot(anna)], T, { erlaubnis }) === '[]'));
  ck('B2 7.3 Nr. 2: eingeschaltet, läuft nicht → nameMerken (Anna eindeutig), dann starten mit allen Feldern', abgleich([aslot(anna)], T) === start);
  ck('B2 7.3 Nr. 2: Frist läuft → nichts', abgleich([aslot(anna, { frist: true })], T) === '[]');
  ck('B2 7.3 Nr. 2: Fehlerstand → kein neuer Start von selbst (B13), auch bei roster (PK18 rein)',
    (['keine_antwort', 'gescheitert', 'zurueckgestellt'] as const).every((fehlerstand) => abgleich([aslot(anna, { fehlerstand })], T) === '[]'));
  const sieben = [7, 3, 1, 6, 2, 5, 4].map((nr) => aslot(einstellung({ nr, ndiName: `Zoom ${nr}`, modus: 'sprecher' })));
  const arten = (s: string): string => j((JSON.parse(s) as { art: string; nr: number }[]).map((h) => `${h.art} ${h.nr}`));
  ck('B2 7.3 Nr. 3: sieben eingeschaltet ohne Zustimmung → 1–5 starten nach Nummer, 6 und 7 zurückstellen',
    arten(abgleich(sieben, T)) === j(['starten 1', 'starten 2', 'starten 3', 'starten 4', 'starten 5', 'zurueckstellen 6', 'zurueckstellen 7']));
  ck('B2 7.3 Nr. 3: mit Zustimmung → alle sieben starten', arten(abgleich(sieben, T, { ueber5: true })) === j([1, 2, 3, 4, 5, 6, 7].map((n) => `starten ${n}`)));
  const zweiLaufen = sieben.map((x) => (x.e.nr <= 2 ? { ...x, bridge: laeuft('speaker', 0) } : x));
  ck('B2 7.3 Nr. 3: laufende zählen mit (1 und 2 laufen → 3, 4, 5 starten, 6, 7 zurückstellen)',
    arten(abgleich(zweiLaufen, T)) === j(['starten 3', 'starten 4', 'starten 5', 'zurueckstellen 6', 'zurueckstellen 7']));
  const zweiAus = sieben.map((x) => (x.e.nr === 2 ? { ...x, e: { ...x.e, an: false } } : x));
  ck('B2 7.3 Nr. 3: ausgeschaltete zählen nicht (2 aus → 1, 3, 4, 5, 6 starten, 7 zurückstellen)',
    arten(abgleich(zweiAus, T)) === j(['starten 1', 'starten 3', 'starten 4', 'starten 5', 'starten 6', 'zurueckstellen 7']));
  const aus = einstellung({ an: false });
  ck('B2 7.3 Nr. 4: ausgeschaltet und läuft → stoppen, auch außerhalb des Meetings',
    abgleich([aslot(aus, {}, laeuft('participant', ANNA))], T) === j([{ art: 'stoppen', nr: 1 }])
      && abgleich([aslot(aus, {}, laeuft('participant', ANNA))], T, { meeting: 'abriss', erlaubnis: null }) === j([{ art: 'stoppen', nr: 1 }]));
  ck('B2 7.3 Nr. 4, 10: slotOff unterwegs oder Bridge im Abbau → nichts (kein zweites slotOff, kein Start)',
    abgleich([aslot(aus, {}, { laeuft: true, imAbbau: true, mode: 'participant', target: ANNA })], T) === '[]'
      && abgleich([aslot(anna, {}, { laeuft: false, imAbbau: true, mode: 'participant', target: 0 })], T) === '[]');
  ck('B2 7.3 Nr. 4: ausgeschaltet, läuft nicht → nichts', abgleich([aslot(aus)], T) === '[]');
  const sprecher = einstellung({ nr: 2, ndiName: 'Sprecher', modus: 'sprecher' });
  const folien = einstellung({ nr: 3, ndiName: 'Folien', modus: 'freigabe' });
  ck('B2 7.3 Nr. 9: Sprecher- und Freigabe-Slots starten ohne Ziel und ohne nameMerken',
    abgleich([aslot(sprecher), aslot(folien)], T) === j([{ art: 'starten', nr: 2, befehl: slotOnBefehl(sprecher, 0, sprecher.ndiName) }, { art: 'starten', nr: 3, befehl: slotOnBefehl(folien, 0, folien.ndiName) }])
      && !('id' in slotOnBefehl(sprecher, 0, sprecher.ndiName)));
  ck('B2 7.3 Nr. 9: laufende Sprecher- und Freigabe-Slots werden nie umgehängt',
    abgleich([aslot(sprecher, {}, laeuft('speaker', BEN)), aslot(folien, {}, laeuft('share', 101))], T) === '[]');
}

console.log('— B2 · 7.3 Nr. 5, 6: Ziel eines Teilnehmer-Slots, (a), (b), (c), Umbenennung');
{
  const anna = einstellung();
  const z = (s: Partial<SlotSitzung>, tl: AbgleichTeilnehmer[], e = anna): string => flach(teilnehmerZiel(e, sitzung(s), tl));
  // (a)
  ck('B2 (a): gewählte Person da → Ziel sie, doppelt 1, auch neben einem Namensvetter',
    z({ gewaehlteId: ANNA }, [t(ANNA, 'Anna'), t(ANNA_NEU, 'anna', 3)]) === ziel({ ziel: ANNA, gewaehlteId: ANNA }));
  ck('B2 (a): gewählte Person im Warteraum → Ziel 0, imWarteraum (T17)', z({ gewaehlteId: ANNA }, [t(ANNA, 'Anna', 0, true)]) === ziel({ gewaehlteId: ANNA, imWarteraum: true }));
  ck('B2 (a): vergleicht keinen Namen (umbenannt oder Handwahl gilt)', z({ gewaehlteId: BEN }, [t(BEN, 'Ben')]) === ziel({ ziel: BEN, gewaehlteId: BEN }));
  // (b)
  ck('B2 (b): kein Namensvetter → Ziel 0 (T16)', z({}, [t(BEN, 'Ben')]) === ziel({}));
  ck('B2 (b): genau einer → Ziel er, gewaehlteId er', z({}, [t(ANNA, 'Anna'), t(BEN, 'Ben')]) === ziel({ ziel: ANNA, gewaehlteId: ANNA }));
  ck('B2 (b): normierter Name („  ANNA “ findet „Anna“, NFC)', z({}, [t(ANNA, '  ANNA ')]) === ziel({ ziel: ANNA, gewaehlteId: ANNA })
    && flach(teilnehmerZiel(einstellung({ person: 'Aná' }), sitzung(), [t(ANNA, 'Ana\u0301')])) === ziel({ ziel: ANNA, gewaehlteId: ANNA }));
  ck('B2 (b): genau einer im Warteraum → Ziel 0, imWarteraum (T17)', z({}, [t(ANNA, 'Anna', 0, true)]) === ziel({ imWarteraum: true }));
  ck('B2 (b): zwei, einer im Warteraum → Ziel 0, doppelt 2, Wahl mit beiden (der Warteraum zählt mit)',
    z({}, [t(ANNA, 'Anna'), t(ANNA_NEU, 'anna', 2, true)])
      === ziel({ doppelt: 2, wahl: [{ id: ANNA, name: 'Anna', hinweis: '' }, { id: ANNA_NEU, name: 'anna', hinweis: '' }] }));
  ck('B2 (b): keine Person eingestellt → keinePerson (T18)', z({}, [t(ANNA, 'Anna')], einstellung({ person: '' })) === ziel({ keinePerson: true }));
  // (c): Anna (gewaehlteId ANNA) ging bei Folge 2
  const weg = { gewaehlteId: ANNA, wegSeq: 2 };
  ck('B2 (c): Rückkehr, genau einer nach dem Weggang beigetreten → Ziel er, gewaehlteId er',
    z(weg, [t(ANNA_NEU, 'Anna', 3), t(BEN, 'Ben')]) === ziel({ ziel: ANNA_NEU, gewaehlteId: ANNA_NEU }));
  ck('B2 (c): Rückkehr nach dem normierten Namen („anna “, PK5 rein)', z(weg, [t(ANNA_NEU, 'anna ', 3)]) === ziel({ ziel: ANNA_NEU, gewaehlteId: ANNA_NEU }));
  ck('B2 (c): genau einer, schon vor dem Weggang da → Ziel 0, zweifel, Wahl (T13b, PK6 rein)',
    z(weg, [t(ANNA_NEU, 'Anna', 1)]) === ziel({ gewaehlteId: ANNA, zweifel: true, wahl: [{ id: ANNA_NEU, name: 'Anna', hinweis: '' }] }));
  ck('B2 (c): Folge gleich wegSeq zählt als „vorher da“', JSON.parse(z(weg, [t(ANNA_NEU, 'Anna', 2)])).zweifel === true);
  ck('B2 (c): wegSeq unbekannt → kein Sprung (zweifel)', JSON.parse(z({ gewaehlteId: ANNA }, [t(ANNA_NEU, 'Anna', 9)])).zweifel === true);
  ck('B2 (c): genau einer im Warteraum → Ziel 0, imWarteraum (T17)', z(weg, [t(ANNA_NEU, 'Anna', 3, true)]) === ziel({ gewaehlteId: ANNA, imWarteraum: true }));
  ck('B2 (c): mehrere → Ziel 0, doppelt, Wahl (T13)',
    z(weg, [t(ANNA_NEU, 'Anna', 3), t(CARLA, 'ANNA', 4)])
      === ziel({ gewaehlteId: ANNA, doppelt: 2, wahl: [{ id: ANNA_NEU, name: 'Anna', hinweis: '' }, { id: CARLA, name: 'ANNA', hinweis: '' }] }));
  ck('B2 (c): keiner → Ziel 0 (T16), gewaehlteId bleibt', z(weg, [t(BEN, 'Ben')]) === ziel({ gewaehlteId: ANNA }));
  // Nr. 6: Anna hat sich in „Annabelle“ umbenannt (personJetzt), ging dann
  const umbenannt = { ...weg, personJetzt: 'Annabelle' };
  ck('B2 Nr. 6: Rückkehr unter dem neuen Namen', z(umbenannt, [t(ANNA_NEU, 'Annabelle', 3)]) === ziel({ ziel: ANNA_NEU, gewaehlteId: ANNA_NEU }));
  ck('B2 Nr. 6: Rückkehr auch unter dem gespeicherten Namen', z(umbenannt, [t(ANNA_NEU, 'Anna', 3)]) === ziel({ ziel: ANNA_NEU, gewaehlteId: ANNA_NEU }));
  ck('B2 Nr. 6: je ein Namensvetter unter beiden Namen → doppelt 2', JSON.parse(z(umbenannt, [t(ANNA_NEU, 'Anna', 3), t(CARLA, 'Annabelle', 4)])).doppelt === 2);
  // im Abgleich
  ck('B2 Nr. 5 im Abgleich: Rückkehr per slotSet {id} am laufenden Slot, nie slotOff/slotOn (PK4 rein)',
    abgleich([aslot(anna, weg, laeuft('participant', 0))], [t(ANNA_NEU, 'Anna', 3)])
      === j([{ art: 'nameMerken', nr: 1, gewaehlteId: ANNA_NEU }, { art: 'aendern', nr: 1, befehl: { cmd: 'slotSet', slot: 1, id: ANNA_NEU } }]));
  ck('B2 Nr. 5 im Abgleich: Ziel wie in der Bridge → nichts', abgleich([aslot(anna, { gewaehlteId: ANNA }, laeuft('participant', ANNA))], [t(ANNA, 'Anna')]) === '[]');
  const ben = einstellung({ person: 'Ben' });
  ck('B2 Nr. 5 im Abgleich: Person auf Ben gestellt (nicht da), Anna läuft → slotSet {id: 0} (PK29 rein)',
    abgleich([aslot(ben, sitzungNach(sitzung({ gewaehlteId: ANNA, zeigteSchon: true }), 'personGeaendert'), laeuft('participant', ANNA))], [t(ANNA, 'Anna')])
      === j([{ art: 'aendern', nr: 1, befehl: { cmd: 'slotSet', slot: 1, id: 0 } }]));
  ck('B2 Nr. 5 im Abgleich: Bridge meldet noch einen anderen Modus → nichts (Moduswechsel unterwegs)',
    abgleich([aslot(anna, {}, laeuft('speaker', BEN))], [t(ANNA, 'Anna'), t(BEN, 'Ben')]) === '[]');
  ck('B2 Nr. 5 im Abgleich: Doppelname beim Start → Ziel 0, kein nameMerken',
    abgleich([aslot(anna)], [t(ANNA, 'Anna'), t(ANNA_NEU, 'Anna', 1)]) === j([{ art: 'starten', nr: 1, befehl: slotOnBefehl(anna, 0, anna.ndiName) }]));
}

console.log('— Task 1 · #287: Person im NDI-Namen beim Start');
{
  const anna = einstellung();
  const T = [t(ANNA, 'Anna'), t(BEN, 'Ben')];
  const startNdi = (slots: AbgleichSlot[], an: boolean): unknown =>
    planeSlotAbgleich({ meeting: 'im_meeting', erlaubnis: 'ja', ueber5: false, personImNdiNamen: an, teilnehmer: T, slots })
      .flatMap((h) => (h.art === 'starten' ? [h.befehl.ndi] : []))[0];
  ck('#287: slotOnBefehl setzt den übergebenen Namen ein, nicht ndiName', slotOnBefehl(anna, ANNA, 'Zoom 1 (Anna)').ndi === 'Zoom 1 (Anna)');
  ck('#287: Teilnehmer-Slot „Zoom 1“, Person „Anna“, Schalter an → ndi „Zoom 1 (Anna)“', startNdi([aslot(anna)], true) === 'Zoom 1 (Anna)');
  ck('#287: derselbe Slot, Schalter aus → „Zoom 1“', startNdi([aslot(anna)], false) === 'Zoom 1');
  ck('#287: Sprecher- und Freigabe-Slot, Schalter an → Slotname', startNdi([aslot(einstellung({ nr: 2, ndiName: 'Sprecher', modus: 'sprecher' }))], true) === 'Sprecher'
    && startNdi([aslot(einstellung({ nr: 3, ndiName: 'Folien', modus: 'freigabe' }))], true) === 'Folien');
  const ben = einstellung({ person: 'Ben' });
  ck('#287: laufender Teilnehmer-Slot, neue Person, Schalter an → nur nameMerken/aendern, kein starten/stoppen',
    abgleich([aslot(ben, sitzungNach(sitzung({ gewaehlteId: ANNA, zeigteSchon: true }), 'personGeaendert'), laeuft('participant', ANNA))], T, { personImNdiNamen: true })
      === j([{ art: 'nameMerken', nr: 1, gewaehlteId: BEN }, { art: 'aendern', nr: 1, befehl: { cmd: 'slotSet', slot: 1, id: BEN } }]));
}

console.log('— B2 · 7.3 Nr. 2, 5, 7, 8: Sitzung nach einem Ereignis (RR1, RR7, RR9)');
{
  const voll: SlotSitzung = { gewaehlteId: ANNA, wegSeq: 2, personJetzt: 'Annabelle', liefSchon: true, zeigteSchon: true, fehlerstand: 'gescheitert', frist: true };
  const LEER = j(SITZUNG_LEER);
  const ohneKennungen = { gewaehlteId: null, wegSeq: null, personJetzt: null };
  const SOLL: Array<[SitzungsEreignis, SlotSitzung]> = [
    ['meetingEnde', SITZUNG_LEER], ['verlassen', SITZUNG_LEER], ['schliessen', SITZUNG_LEER], ['beitritt', SITZUNG_LEER],
    ['beenden', SITZUNG_LEER], ['mangel', SITZUNG_LEER],
    ['neueBridge', { ...voll, ...ohneKennungen, fehlerstand: null, frist: false }],
    ['z11', { ...voll, ...ohneKennungen, fehlerstand: null, frist: false }],
    ['erneut', { ...voll, ...ohneKennungen, fehlerstand: null, frist: false }],
    ['z10Roster', { ...voll, ...ohneKennungen }],
    ['entzug', voll],
    ['personGeaendert', { ...voll, ...ohneKennungen, zeigteSchon: false }],
    ['modusGeaendert', { ...voll, zeigteSchon: false }],
    ['stoppStart', { ...voll, fehlerstand: null, frist: false }],
  ];
  for (const [ereignis, soll] of SOLL) ck(`B2 sitzungNach ${ereignis}`, j(sitzungNach(voll, ereignis)) === j(soll));
  ck('B2 sitzungNach: die Tabelle deckt alle 14 Ereignisse', new Set(SOLL.map(([e]) => e)).size === 14);
  ck('B2 SITZUNG_LEER: alles null bzw. false', LEER === j({ gewaehlteId: null, wegSeq: null, personJetzt: null, liefSchon: false, zeigteSchon: false, fehlerstand: null, frist: false }));
  ck('B2 sitzungNach ändert die Eingabe nicht', j(voll) === j({ gewaehlteId: ANNA, wegSeq: 2, personJetzt: 'Annabelle', liefSchon: true, zeigteSchon: true, fehlerstand: 'gescheitert', frist: true }));
  const ENDE: SitzungsEreignis[] = ['meetingEnde', 'verlassen', 'schliessen', 'beitritt', 'beenden', 'mangel'];
  const ANDERE: SitzungsEreignis[] = ['neueBridge', 'entzug', 'z10Roster', 'z11', 'erneut', 'personGeaendert', 'modusGeaendert', 'stoppStart'];
  ck('B2 Nr. 8: vorübergehender Slot zu jedem Sitzungsende → loeschen', ENDE.every((e) => slotEndetMitMeeting({ voruebergehend: true, anNurMeeting: false }, e) === 'loeschen'));
  ck('B2 Nr. 8 RR7: dauerhafter Slot mit anNurMeeting → ausschalten', ENDE.every((e) => slotEndetMitMeeting({ voruebergehend: false, anNurMeeting: true }, e) === 'ausschalten'));
  ck('B2 Nr. 8: dauerhafter Slot → bleibt', ENDE.every((e) => slotEndetMitMeeting({ voruebergehend: false, anNurMeeting: false }, e) === 'bleibt'));
  ck('B2 Nr. 8: Entzug, Z10, Z11, „Erneut beitreten“ und die übrigen → bleibt, auch vorübergehend',
    ANDERE.every((e) => slotEndetMitMeeting({ voruebergehend: true, anNurMeeting: true }, e) === 'bleibt'));
}

console.log('— B2 · 7.3 Nr. 7: zeigteSchon nur von slot live mit eingestellter Person (N3)');
{
  const s = sitzung({ gewaehlteId: ANNA });
  ck('B2 N3: participant, target = gewaehlteId → zeigteSchon', zeigteSchonNachLive(s, { mode: 'participant', target: ANNA }));
  ck('B2 N3: anderes Ziel → nicht gesetzt (Ereignis im Flug nach Personenwechsel)', !zeigteSchonNachLive(s, { mode: 'participant', target: BEN }));
  ck('B2 N3: anderer Modus → nicht gesetzt (spätes slot live nach Moduswechsel)', !zeigteSchonNachLive(s, { mode: 'speaker', target: ANNA }));
  ck('B2 N3: ohne gewaehlteId → nicht gesetzt, auch nicht für Ziel 0', !zeigteSchonNachLive(sitzung(), { mode: 'participant', target: 0 }) && !zeigteSchonNachLive(sitzung(), { mode: 'participant', target: ANNA }));
  ck('B2 N3: einmal gesetzt bleibt es', zeigteSchonNachLive(sitzung({ zeigteSchon: true }), { mode: 'speaker', target: BEN }));
}

console.log('— B2 · 7.4: Zustimmung über 5 verfällt');
{
  ck('B2 7.4: 6 eingeschaltet mit Zustimmung → bleibt', ueber5Nach(6, true));
  ck('B2 7.4: höchstens 5 → verfällt', !ueber5Nach(5, true) && !ueber5Nach(0, true));
  ck('B2 7.4: ohne Zustimmung → keine', !ueber5Nach(6, false) && !ueber5Nach(5, false));
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
