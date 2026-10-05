// Teilnehmerzeilen und Soll-Liste als reine Funktionen OHNE Electron (tsx): npm run selftest -w @jm/connect
// Spec 4 (Normierter Name, Doppelname, Verwaiste Quelle), 5.4 (ZoomParticipant), 6.3 (Abgleich-Tabelle, Kollision).
import type { Participant } from '@jm/zoom-bridge/protocol';
import type { ZoomQuelle } from '../src/shared/types';
import { KT } from '../src/main/zoom/klartext';
import { sollAbbild, sollHandlungen, type SollLage, type SollListe } from '../src/main/zoom/soll';
import {
  baueTeilnehmer, gleicherNdiName, istVerwaist, kameraVon, NDI_PRAEFIX, ndiVorschau, normName, zaehleQuellen,
} from '../src/main/zoom/teilnehmer';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

// ── Testhilfen ──
/** Teilnehmer wie im roster der Bridge; IDs wie in der Attrappe (eigene Zeile 100, Fremde ab 16778240). */
function p(id: number, name: string, extra: Partial<Participant> = {}): Participant {
  return { id, name, persistentId: '', self: false, videoOn: true, hasCamera: true, inWaitingRoom: false, role: 'attendee', ...extra };
}
function quelle(aboId: number, ndiName: string, bild: ZoomQuelle['bild'] = 'live'): ZoomQuelle {
  return { aboId, ndiName, bild, bildGrund: 'frames', ton: 'live', tonGrund: 'packets', fehler: null };
}
const LEER = { quellen: new Map<number, ZoomQuelle>(), tonVorwahl: new Map<number, boolean>(), zeilenFehler: new Map<number, string>(), gastLabels: [] as string[] };

console.log('— Normierter Name, NDI-Vorschau, Kamera');
ck('normName: NFC („Ana\\u0301“ = „Aná“)', normName('Ana\u0301') === normName('An\u00e1'));
ck('normName: trim, Leerraum zu einem Leerzeichen', normName('  Anna \t  Maria ') === 'anna maria');
ck('normName: klein (de)', normName('ÄRGER') === 'ärger' && normName('Anna') === normName('anna'));
ck('ndiVorschau mit Gedankenstrich U+2013', ndiVorschau('Anna') === 'JM Connect – Zoom Anna' && NDI_PRAEFIX.charCodeAt(11) === 0x2013);
ck('gleicherNdiName ohne Groß-/Kleinschreibung', gleicherNdiName('JM Connect – zoom anna', 'JM Connect – Zoom Anna'));
ck('gleicherNdiName nach NFC', gleicherNdiName('JM Connect – Zoom Ana\u0301', 'JM Connect – Zoom An\u00e1'));
ck('gleicherNdiName: anderer Name → nein', !gleicherNdiName('JM Connect – Zoom Anna', 'JM Connect – Zoom Anna (2)'));
ck('kameraVon: videoOn → an', kameraVon({ videoOn: true, hasCamera: true }) === 'an');
ck('kameraVon: hasCamera false → keine', kameraVon({ videoOn: false, hasCamera: false }) === 'keine');
ck('kameraVon: sonst → aus', kameraVon({ videoOn: false, hasCamera: true }) === 'aus');

console.log('— baueTeilnehmer (Spec 5.4, 6.3)');
{
  const liste: Participant[] = [
    p(100, 'JM Connect', { self: true, role: 'host' }),
    p(16778241, 'Zoe', { videoOn: false }),
    p(16778242, 'Ärger', { videoOn: false, hasCamera: false }),
    p(16778243, 'Ben', { role: 'coHost' }),
    p(16778240, 'Anna', { role: 'host' }),
    p(16778244, 'anna', { inWaitingRoom: true }),
  ];
  const zeilen = baueTeilnehmer({
    liste,
    quellen: new Map([[16778243, quelle(16778243, 'JM Connect – Zoom Ben (2)')]]),
    tonVorwahl: new Map([[16778240, false]]),
    zeilenFehler: new Map([[16778241, KT.Q8]]),
    gastLabels: ['JM Connect – zoom anna', 'JM Connect – Zoom Ben (2)'],
  });
  const z = (id: number) => zeilen.find((x) => x.id === id);
  ck('eigene Zeile (self) fehlt', zeilen.length === 5 && z(100) === undefined);
  ck('Reihenfolge: Host, Co-Host, dann nach Name (de)', JSON.stringify(zeilen.map((x) => x.name)) === JSON.stringify(['Anna', 'Ben', 'anna', 'Ärger', 'Zoe']));
  ck('„Anna“ und „anna“ (im Warteraum) sind beide Doppelname', z(16778240)?.doppelname === true && z(16778244)?.doppelname === true);
  ck('eindeutige Namen sind kein Doppelname', z(16778243)?.doppelname === false && z(16778241)?.doppelname === false);
  ck('Ton-Vorwahl je ID: Anna aus, „anna“ bleibt an (Fall 13)', z(16778240)?.tonVorwahl === false && z(16778244)?.tonVorwahl === true);
  ck('Vorgabe der Ton-Vorwahl: an', z(16778241)?.tonVorwahl === true);
  ck('Quelle hängt an der Zeile mit gleicher ID', z(16778243)?.quelle?.aboId === 16778243 && z(16778240)?.quelle === null);
  ck('NDI-Vorschau je Zeile', z(16778241)?.ndiNameVorschau === 'JM Connect – Zoom Zoe');
  ck('Kollision über die Vorschau: Anna trägt Q10 (Fall 23)', z(16778240)?.kollision === KT.Q10('JM Connect – Zoom Anna'));
  ck('Kollision auch für „anna“ im Warteraum', z(16778244)?.kollision === KT.Q10('JM Connect – Zoom anna'));
  ck('Kollision über den NDI-Namen der laufenden Quelle (Ben)', z(16778243)?.kollision === KT.Q10('JM Connect – Zoom Ben (2)'));
  ck('ohne passendes Label keine Kollision', z(16778241)?.kollision === null && z(16778242)?.kollision === null);
  ck('Zeilenfehler aus zeilenFehler (Q8)', z(16778241)?.fehler === KT.Q8 && z(16778240)?.fehler === null);
  ck('Kamera und Warteraum je Zeile', z(16778241)?.kamera === 'aus' && z(16778242)?.kamera === 'keine' && z(16778240)?.kamera === 'an' && z(16778244)?.imWarteraum === true);
  ck('Rolle wird durchgereicht', z(16778240)?.rolle === 'host' && z(16778243)?.rolle === 'coHost' && z(16778241)?.rolle === 'attendee');
  ck('leere Liste → keine Zeilen', baueTeilnehmer({ liste: [], ...LEER }).length === 0);
}

console.log('— zaehleQuellen und istVerwaist');
{
  const n3 = zaehleQuellen([quelle(1, 'a', 'subscribed'), quelle(2, 'b', 'live'), quelle(3, 'c', 'black')]);
  ck('n = alle, k = alle außer live', n3.n === 3 && n3.k === 2);
  ck('keine Quellen → 0/0', JSON.stringify(zaehleQuellen([])) === JSON.stringify({ n: 0, k: 0 }));
  const ids = new Set([16778240]);
  ck('Teilnehmer nicht mehr in der Liste → verwaist (black steht noch aus)', istVerwaist(16778241, ids, undefined));
  ck('black/participantLeft → verwaist', istVerwaist(16778240, ids, { state: 'black', reason: 'participantLeft' }));
  ck('black/cameraOff → nicht verwaist', !istVerwaist(16778240, ids, { state: 'black', reason: 'cameraOff' }));
  ck('Teilnehmer da, live → nicht verwaist', !istVerwaist(16778240, ids, { state: 'live', reason: 'frames' }));
  ck('Teilnehmer da, noch kein Bild-Ereignis → nicht verwaist', !istVerwaist(16778240, ids, undefined));
}

console.log('— Abgleich der Soll-Liste: die neun Zeilen der Tabelle 6.3');
{
  const ANNA = 'anna';
  /** Soll-Liste mit genau einem Eintrag „Anna“ (Ton aus, damit „Ton des Soll-Eintrags“ prüfbar ist). */
  const soll = (aboId: number | null): SollListe => new Map([[ANNA, { name: 'Anna', ton: false, ndiName: 'JM Connect – Zoom Anna', aboId }]]);
  const t = (id: number, name: string, imWarteraum = false) => ({ id, name, imWarteraum });
  const fall = (titel: string, aboId: number | null, lage: SollLage, stand: string | null, doppelname: boolean, handlung: unknown[]) => {
    const abb = sollAbbild(soll(aboId), lage);
    const erwartet = stand === null ? [] : [{
      name: 'Anna', ton: false, ndiName: 'JM Connect – Zoom Anna', stand, aboId: stand === 'verwaist' ? aboId : null, doppelname,
    }];
    ck(`${titel}: Stand`, JSON.stringify(abb) === JSON.stringify(erwartet));
    ck(`${titel}: Handlung`, JSON.stringify(sollHandlungen(soll(aboId), lage)) === JSON.stringify(handlung));
  };
  const abo = (id: number, verwaist: boolean) => new Map([[id, { verwaist }]]);

  fall('1 Abo verbunden', 16778240, { teilnehmer: [t(16778240, 'Anna')], abos: abo(16778240, false) }, null, false, []);
  fall('2 verwaist, 0 Treffer', 16778240, { teilnehmer: [t(16778241, 'Ben')], abos: abo(16778240, true) }, 'verwaist', false, []);
  fall('3 verwaist, genau 1 Treffer (anna) → neu laden', 16778240, { teilnehmer: [t(16778250, 'anna')], abos: abo(16778240, true) }, 'verwaist', false,
    [{ art: 'neuLaden', schluessel: ANNA, altAboId: 16778240, id: 16778250, ton: false }]);
  fall('4 verwaist, 1 Treffer im Warteraum', 16778240, { teilnehmer: [t(16778250, 'Anna', true)], abos: abo(16778240, true) }, 'verwaist', false, []);
  fall('5 verwaist, 2 Treffer → rot mit Q11', 16778240, { teilnehmer: [t(16778250, 'Anna'), t(16778251, 'ANNA ')], abos: abo(16778240, true) }, 'verwaist', true, []);
  fall('6 kein Abo, genau 1 Treffer → abonnieren', null, { teilnehmer: [t(16778240, 'Anna')], abos: new Map() }, 'wartet', false,
    [{ art: 'abonnieren', schluessel: ANNA, id: 16778240, ton: false }]);
  fall('7 kein Abo, 1 Treffer im Warteraum', null, { teilnehmer: [t(16778240, 'Anna', true)], abos: new Map() }, 'wartet', false, []);
  fall('8 kein Abo, 0 Treffer', null, { teilnehmer: [t(16778241, 'Ben')], abos: new Map() }, 'wartet', false, []);
  fall('9 kein Abo, 2 Treffer → nichts, doppelname', null, { teilnehmer: [t(16778240, 'Anna'), t(16778241, 'anna')], abos: new Map() }, 'doppelname', true, []);
  fall('aboId nicht mehr in abos (neue Bridge) → wie „kein Abo“', 16778240, { teilnehmer: [t(16778260, 'Anna')], abos: new Map() }, 'wartet', false,
    [{ art: 'abonnieren', schluessel: ANNA, id: 16778260, ton: false }]);

  // Mehrere Einträge: nur die offenen stehen im Abbild, Reihenfolge der Soll-Liste.
  const mehr: SollListe = new Map([
    ['anna', { name: 'Anna', ton: true, ndiName: 'JM Connect – Zoom Anna', aboId: 16778240 }],
    ['ben', { name: 'Ben', ton: true, ndiName: 'JM Connect – Zoom Ben', aboId: null }],
  ]);
  const lage: SollLage = { teilnehmer: [t(16778240, 'Anna')], abos: abo(16778240, false) };
  ck('nur offene Einträge im Abbild', JSON.stringify(sollAbbild(mehr, lage).map((x) => [x.name, x.stand])) === JSON.stringify([['Ben', 'wartet']]));
  ck('leere Soll-Liste → nichts', sollAbbild(new Map(), lage).length === 0 && sollHandlungen(new Map(), lage).length === 0);
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
