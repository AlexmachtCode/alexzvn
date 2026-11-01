// Zoom-Slots in Connect als reine Funktionen OHNE Electron (tsx): npm run selftest -w @jm/connect
// Spec 10.1 (Slot-Zustände, Spalten n, k, o), 7.3 (Vorrang, ab Plan B Task B2 auch Nr. 1–10), 7.1 (Ton-Abbildung, KF8),
// 8.2 („Ton eingeschaltet“). Nachfolger der Soll-Abgleich-Blöcke aus zoom-teile.test.ts (Spec 11.10, berichtigt B-EP2).
import type { SlotReason } from '@jm/zoom-bridge/protocol';
import type { ZoomErlaubnis, ZoomSlotEinstellung, ZoomSlotModus, ZoomSlotZustand } from '../src/shared/types';
import {
  ERSATZBILD_ZU_BRIDGE, istOffen, MODUS_ZU_BRIDGE, SIGNAL_ZU_BRIDGE, slotOnBefehl, slotZustand, tonEingeschaltet, tonFuerBridge,
  zaehleSlots, type OffenEingabe, type SlotZustandEingabe,
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
    flach(slotOnBefehl(abweichend, BEN)) === flach({
      cmd: 'slotOn', slot: 7, ndi: 'Bühne links', mode: 'participant', id: BEN, resolution: '1080p', audio: 'person', shareAudio: false,
      fallback: 'white', showNoVideo: false,
    }));
  ck('B1 slotOnBefehl Teilnehmer ohne Ziel: id 0', slotOnBefehl(einstellung(), 0).id === 0);
  ck('B1 slotOnBefehl Sprecher: ohne id (die Bridge wählt), Mischton, Computerton, Ersatzbild eingefroren',
    flach(slotOnBefehl(einstellung({ nr: 2, ndiName: 'Sprecher', modus: 'sprecher', ersatzbild: 'eingefroren', aufloesung: '360p' }), ANNA)) === flach({
      cmd: 'slotOn', slot: 2, ndi: 'Sprecher', mode: 'speaker', resolution: '360p', audio: 'mix', shareAudio: true, fallback: 'freeze',
      showNoVideo: true,
    }));
  ck('B1 slotOnBefehl Freigabe: ohne id, Ton aus, Computerton an, schwarz',
    flach(slotOnBefehl(einstellung({ nr: 16, ndiName: 'Folien', modus: 'freigabe', tonAn: false, ersatzbild: 'schwarz' }), 0)) === flach({
      cmd: 'slotOn', slot: 16, ndi: 'Folien', mode: 'share', resolution: '720p', audio: 'off', shareAudio: true, fallback: 'black',
      showNoVideo: true,
    }));
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
