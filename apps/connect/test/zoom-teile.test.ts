// Teilnehmerzeilen und Soll-Liste als reine Funktionen OHNE Electron (tsx): npm run selftest -w @jm/connect
// Spec 4 (Normierter Name, Doppelname, Verwaiste Quelle), 5.4 (ZoomParticipant), 6.3 (Abgleich-Tabelle, Kollision).
import type { Participant } from '@jm/zoom-bridge/protocol';
import type { ZoomQuelle, ZoomSollEintrag, ZoomZustand } from '../src/shared/types';
import { KT } from '../src/main/zoom/klartext';
import { pruefeZugangEingabe } from '../src/main/zoom/zugang-eingabe';
import { pruefeSdkSchluesselEingabe } from '../src/main/zoom/sdk-schluessel-eingabe';
import { istAusserhalbMeeting, sollAbbild, sollHandlungen, type SollLage, type SollListe } from '../src/main/zoom/soll';
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

// ── Aufgabe 16: Zoom-Einstellungen, rein (Spec 5.6, G4, G5) ──
{
  const { gueltigerAnzeigename, gueltigerVersatz, zugangAusUmgebung, zugangAusKlartext, waehleZugang } = await import(
    '../src/main/zoom/einstellungen'
  );
  const fs = await import('node:fs');
  const os = await import('node:os');
  const pfad = await import('node:path');

  // Anzeigename: 1 bis 64 Zeichen nach trim (G4)
  ck('Einst: Anzeigename „JM Connect“ gültig', gueltigerAnzeigename('JM Connect') === 'JM Connect');
  ck('Einst: Anzeigename wird getrimmt', gueltigerAnzeigename('  Regie 1  ') === 'Regie 1');
  ck('Einst: Anzeigename mit 64 Zeichen gültig', gueltigerAnzeigename('x'.repeat(64)) === 'x'.repeat(64));
  ck('Einst: Anzeigename mit 65 Zeichen ungültig', gueltigerAnzeigename('x'.repeat(65)) === null);
  ck('Einst: Anzeigename nur aus Leerzeichen ungültig', gueltigerAnzeigename('   ') === null);
  ck('Einst: Anzeigename ohne Text ungültig', gueltigerAnzeigename(undefined) === null && gueltigerAnzeigename(42) === null);

  // Versatz: ganze Zahl 0 bis 1000 (G4)
  ck(
    'Einst: Versatz 0, 250 und 1000 gültig',
    gueltigerVersatz(0) === 0 && gueltigerVersatz(250) === 250 && gueltigerVersatz(1000) === 1000,
  );
  ck(
    'Einst: Versatz 1001, -1, 1.5, NaN, "250", undefined ungültig',
    [1001, -1, 1.5, Number.NaN, '250', undefined].every((v) => gueltigerVersatz(v) === null),
  );

  // Umgebung (Entwicklungsweg, Herkunft 'env')
  const leer = zugangAusUmgebung({});
  ck('Einst: leere Umgebung → keine Daten, kein Fehler', leer.daten === null && leer.fehler === null);
  const beide = zugangAusUmgebung({ ZOOM_SDK_CLIENT_ID: 'env-id-9876', ZOOM_SDK_CLIENT_SECRET: 'env-secret' });
  ck(
    'Einst: Umgebung mit ID und Secret',
    beide.daten?.clientId === 'env-id-9876' && beide.daten?.clientSecret === 'env-secret' && beide.fehler === null,
  );
  const halb = zugangAusUmgebung({ ZOOM_SDK_CLIENT_ID: 'env-id-9876' });
  ck(
    'Einst: Umgebung nur mit ID → Fehler, der den Wert nicht nennt',
    halb.daten === null && halb.fehler !== null && !halb.fehler.includes('env-id-9876'),
  );
  const ordner = fs.mkdtempSync(pfad.join(os.tmpdir(), 'jmc-zoom-einst-'));
  try {
    const gut = pfad.join(ordner, 'zugang.json');
    fs.writeFileSync(gut, String.fromCharCode(0xfeff) + JSON.stringify({ clientId: 'datei-id-4321', clientSecret: 'datei-secret' }));
    const ausDatei = zugangAusUmgebung({ ZOOM_SDK_CREDENTIALS: gut });
    ck(
      'Einst: Umgebung mit Datei (mit BOM) liefert die Daten',
      ausDatei.daten?.clientId === 'datei-id-4321' && ausDatei.daten?.clientSecret === 'datei-secret',
    );
    const kaputt = pfad.join(ordner, 'kaputt.json');
    fs.writeFileSync(kaputt, '{ "clientSecret": GEHEIM-INHALT');
    const k = zugangAusUmgebung({ ZOOM_SDK_CREDENTIALS: kaputt });
    ck(
      'Einst: kaputte Datei → Fehler, Inhalt nicht zitiert',
      k.daten === null && k.fehler !== null && !k.fehler.includes('GEHEIM-INHALT'),
    );
  } finally {
    fs.rmSync(ordner, { recursive: true, force: true });
  }

  // Inhalt von zoomZugangEnc nach dem Entschlüsseln
  const gelesen = zugangAusKlartext(JSON.stringify({ clientId: 'gesp-id-0002', clientSecret: 'g' }));
  ck(
    'Einst: Klartext gültig',
    gelesen.unlesbar === false && gelesen.daten?.clientId === 'gesp-id-0002' && gelesen.daten?.clientSecret === 'g',
  );
  ck('Einst: nicht entschlüsselbar → unlesbar', zugangAusKlartext(null).unlesbar === true && zugangAusKlartext(null).daten === null);
  ck('Einst: entschlüsselt, aber kein JSON → unlesbar', zugangAusKlartext('{kaputt').unlesbar === true);
  ck('Einst: entschlüsselt, Feld fehlt → unlesbar', zugangAusKlartext('{"clientId":"a"}').unlesbar === true);

  // Rangfolge Umgebung > Gespeichertes > Sitzung (Spec 5.6)
  const U = { clientId: 'env-id-0001', clientSecret: 'u' };
  const G = { clientId: 'gesp-id-0002', clientSecret: 'g' };
  const S = { clientId: 'sitz-id-0003', clientSecret: 's' };
  const r1 = waehleZugang({ umgebung: U, gespeichert: { daten: G, unlesbar: false }, sitzung: S });
  ck('Einst: Umgebung hat Vorrang', r1.herkunft === 'env' && r1.daten === U && r1.unlesbar === false);
  const r2 = waehleZugang({ umgebung: null, gespeichert: { daten: G, unlesbar: false }, sitzung: S });
  ck('Einst: Gespeichertes vor Sitzung', r2.herkunft === 'stored' && r2.daten === G);
  const r3 = waehleZugang({ umgebung: null, gespeichert: null, sitzung: S });
  ck('Einst: nur Sitzung', r3.herkunft === 'session' && r3.daten === S && r3.unlesbar === false);
  const r4 = waehleZugang({ umgebung: null, gespeichert: { daten: null, unlesbar: true }, sitzung: null });
  ck('Einst: unlesbar ohne Ersatz → none + unlesbar', r4.herkunft === 'none' && r4.daten === null && r4.unlesbar === true);
  const r5 = waehleZugang({ umgebung: U, gespeichert: { daten: null, unlesbar: true }, sitzung: null });
  ck('Einst: unlesbar, aber Umgebung da → kein Mangel', r5.herkunft === 'env' && r5.unlesbar === false);
  const r6 = waehleZugang({ umgebung: null, gespeichert: null, sitzung: null });
  ck('Einst: nichts hinterlegt → none', r6.herkunft === 'none' && r6.daten === null && r6.unlesbar === false);
}

console.log('— Zugangsdaten von Hand: Nutzlast-Prüfung (IPC)');
{
  const g = pruefeZugangEingabe({ clientId: 'id-test', clientSecret: 'geheim-test' });
  ck('gültig → beide Werte', g !== null && g.clientId === 'id-test' && g.clientSecret === 'geheim-test');
  ck('Werte werden hier nicht verändert (Leerraum bleibt für den Kern)',
    pruefeZugangEingabe({ clientId: ' a ', clientSecret: '' })?.clientId === ' a ');
  ck('kein Objekt → null', pruefeZugangEingabe(null) === null && pruefeZugangEingabe('x') === null
    && pruefeZugangEingabe(undefined) === null && pruefeZugangEingabe(42) === null);
  ck('fehlende Felder → null', pruefeZugangEingabe({ clientId: 'a' }) === null && pruefeZugangEingabe({ clientSecret: 'a' }) === null
    && pruefeZugangEingabe({}) === null);
  ck('Zahl statt String → null', pruefeZugangEingabe({ clientId: 1, clientSecret: 'a' }) === null
    && pruefeZugangEingabe({ clientId: 'a', clientSecret: 2 }) === null);
  ck('genau 512 Zeichen → gültig, 513 → null',
    pruefeZugangEingabe({ clientId: 'x'.repeat(512), clientSecret: 'a' }) !== null
    && pruefeZugangEingabe({ clientId: 'x'.repeat(513), clientSecret: 'a' }) === null
    && pruefeZugangEingabe({ clientId: 'a', clientSecret: 'y'.repeat(513) }) === null);
}

console.log('— SDK-Schlüssel von Hand: Nutzlast-Prüfung (IPC, Spec SDK nachladen 4.2)');
{
  const g = pruefeSdkSchluesselEingabe({ schluessel: 'sdk-test' });
  ck('gültig → der Wert', g !== null && g.schluessel === 'sdk-test');
  ck('Wert wird hier nicht verändert (Leerraum bleibt für den Kern)', pruefeSdkSchluesselEingabe({ schluessel: ' a b ' })?.schluessel === ' a b ');
  ck('leerer String ist eine Eingabe (S18 gibt der Kern)', pruefeSdkSchluesselEingabe({ schluessel: '' })?.schluessel === '');
  ck('kein Objekt → null', pruefeSdkSchluesselEingabe(null) === null && pruefeSdkSchluesselEingabe('sdk-test') === null
    && pruefeSdkSchluesselEingabe(undefined) === null && pruefeSdkSchluesselEingabe(42) === null);
  ck('fehlendes Feld oder Zahl → null', pruefeSdkSchluesselEingabe({}) === null && pruefeSdkSchluesselEingabe({ schluessel: 7 }) === null);
  ck('genau 512 Zeichen → gültig, 513 → null',
    pruefeSdkSchluesselEingabe({ schluessel: 'x'.repeat(512) }) !== null && pruefeSdkSchluesselEingabe({ schluessel: 'x'.repeat(513) }) === null);
}

// ── Aufgabe 6 (4b): Plätze bis zur Betriebsgröße, Vorschau „(2)“, Ton aus dem Soll ──
console.log('— 4b: Soll-Liste mit Plätzen (L7, N4b.3 Nr. 3)');
{
  const t = (id: number, name: string, imWarteraum = false) => ({ id, name, imWarteraum });
  const eintrag = (name: string, aboId: number | null = null, ton = true) => ({ name, ton, ndiName: `JM Connect – Zoom ${name}`, aboId });
  // Drei Einträge ohne Abo, je genau ein Treffer außerhalb des Warteraums: alle drei würden abonniert.
  const drei: SollListe = new Map([['anna', eintrag('Anna')], ['ben', eintrag('Ben', null, false)], ['carla', eintrag('Carla')]]);
  const lage3: SollLage = { teilnehmer: [t(16778240, 'Anna'), t(16778241, 'Ben'), t(16778242, 'Carla')], abos: new Map() };
  ck('plaetze 2 bei drei Einträgen: zwei abonnieren, in der Reihenfolge der Soll-Liste',
    JSON.stringify(sollHandlungen(drei, lage3, 2)) === JSON.stringify([
      { art: 'abonnieren', schluessel: 'anna', id: 16778240, ton: true },
      { art: 'abonnieren', schluessel: 'ben', id: 16778241, ton: false },
    ]));
  ck('… im Abbild: Anna und Ben wartet, Carla grenze (ohne Doppelname, ohne aboId)',
    JSON.stringify(sollAbbild(drei, lage3, 2).map((e) => [e.name, e.stand, e.doppelname, e.aboId]))
      === JSON.stringify([['Anna', 'wartet', false, null], ['Ben', 'wartet', false, null], ['Carla', 'grenze', false, null]]));
  ck('plaetze 0: keine Handlung, alle drei grenze',
    sollHandlungen(drei, lage3, 0).length === 0 && sollAbbild(drei, lage3, 0).every((e) => e.stand === 'grenze'));
  ck('negative plaetze (mehr belegt als die Betriebsgröße) zählen wie 0',
    sollHandlungen(drei, lage3, -1).length === 0 && sollAbbild(drei, lage3, -1).every((e) => e.stand === 'grenze'));
  ck('ohne plaetze: alle drei abonnieren, keiner grenze (Vorgabe unbegrenzt)',
    sollHandlungen(drei, lage3).length === 3 && sollAbbild(drei, lage3).every((e) => e.stand === 'wartet'));

  // neuLaden ersetzt ein Abo, das schon einen Platz belegt: es verbraucht keinen weiteren.
  const mitVerwaist: SollListe = new Map([['anna', eintrag('Anna', 16778200)], ['ben', eintrag('Ben')]]);
  const lageV: SollLage = { teilnehmer: [t(16778250, 'Anna'), t(16778241, 'Ben')], abos: new Map([[16778200, { verwaist: true }]]) };
  ck('neuLaden verbraucht keinen Platz (plaetze 1: neuLaden Anna, abonnieren Ben)',
    JSON.stringify(sollHandlungen(mitVerwaist, lageV, 1).map((h) => h.art)) === JSON.stringify(['neuLaden', 'abonnieren']));
  ck('plaetze 0: neuLaden bleibt, Anna verwaist, Ben grenze',
    JSON.stringify(sollHandlungen(mitVerwaist, lageV, 0).map((h) => h.art)) === JSON.stringify(['neuLaden'])
      && JSON.stringify(sollAbbild(mitVerwaist, lageV, 0).map((e) => [e.name, e.stand])) === JSON.stringify([['Anna', 'verwaist'], ['Ben', 'grenze']]));

  // Wer ohnehin nicht abonniert würde, verbraucht keinen Platz und steht nie auf grenze.
  const gemischt: SollListe = new Map([['anna', eintrag('Anna')], ['ben', eintrag('Ben')], ['carla', eintrag('Carla')], ['dora', eintrag('Dora')]]);
  const lageG: SollLage = { teilnehmer: [t(16778240, 'Anna'), t(16778241, 'anna'), t(16778242, 'Ben', true), t(16778243, 'Dora')], abos: new Map() };
  ck('Doppelname, Warteraum und Abwesende verbrauchen keinen Platz (plaetze 1 → Dora)',
    JSON.stringify(sollHandlungen(gemischt, lageG, 1)) === JSON.stringify([{ art: 'abonnieren', schluessel: 'dora', id: 16778243, ton: true }]));
  ck('… und behalten ihren Stand (doppelname, wartet, wartet, wartet)',
    JSON.stringify(sollAbbild(gemischt, lageG, 1).map((e) => [e.name, e.stand])) === JSON.stringify([['Anna', 'doppelname'], ['Ben', 'wartet'], ['Carla', 'wartet'], ['Dora', 'wartet']]));
}

console.log('— 4b: NDI-Vorschau wie uniqueSourceName (L22, N4b.3 Nr. 1)');
{
  ck('frei → ohne Zusatz', ndiVorschau('Anna', new Set()) === 'JM Connect – Zoom Anna');
  ck('belegt → „ (2)“', ndiVorschau('Anna', new Set(['JM Connect – Zoom Anna'])) === 'JM Connect – Zoom Anna (2)');
  ck('mit „ (2)“ belegt → „ (3)“', ndiVorschau('Anna', new Set(['JM Connect – Zoom Anna', 'JM Connect – Zoom Anna (2)'])) === 'JM Connect – Zoom Anna (3)');
  ck('nur „ (2)“ belegt → ohne Zusatz (die Bridge prüft zuerst den Grundnamen)',
    ndiVorschau('Anna', new Set(['JM Connect – Zoom Anna (2)'])) === 'JM Connect – Zoom Anna');
  ck('Vergleich wie in der Bridge: genau, mit Groß-/Kleinschreibung', ndiVorschau('anna', new Set(['JM Connect – Zoom Anna'])) === 'JM Connect – Zoom anna');
  ck('ohne zweiten Parameter wie bisher', ndiVorschau('Anna') === 'JM Connect – Zoom Anna');
}

console.log('— 4b: baueTeilnehmer: Vorschau der zweiten Anna, Ton aus dem Soll (N4b.3 Nr. 1, 2)');
{
  const liste: Participant[] = [p(16778240, 'Anna'), p(16778241, 'Anna'), p(16778243, 'Ben'), p(16778244, 'Carla')];
  const annaGeladen = new Map([[16778240, quelle(16778240, 'JM Connect – Zoom Anna')]]);
  const zeilen = baueTeilnehmer({
    liste,
    quellen: annaGeladen,
    tonVorwahl: new Map([[16778244, true]]),
    zeilenFehler: new Map(),
    gastLabels: [],
    sollTon: (name) => (name === 'Ben' || name === 'Carla' ? false : undefined),
  });
  const z = (id: number) => zeilen.find((x) => x.id === id);
  ck('erste Anna geladen → Vorschau der zweiten endet auf „ (2)“', z(16778241)?.ndiNameVorschau === 'JM Connect – Zoom Anna (2)');
  ck('sollTon false → tonVorwahl false (Ben)', z(16778243)?.tonVorwahl === false);
  ck('ein eigener Wert in tonVorwahl gewinnt (Carla: true trotz Soll false)', z(16778244)?.tonVorwahl === true);
  ck('kein Soll-Eintrag → Vorgabe true (zweite Anna)', z(16778241)?.tonVorwahl === true);
  const mitGast = baueTeilnehmer({ liste, quellen: annaGeladen, tonVorwahl: new Map(), zeilenFehler: new Map(), gastLabels: ['JM Connect – Zoom Anna (2)'] });
  ck('Kollision prüft die Vorschau mit „ (2)“', mitGast.find((x) => x.id === 16778241)?.kollision === KT.Q10('JM Connect – Zoom Anna (2)'));
  ck('ohne sollTon wie bisher: Vorgabe true', mitGast.every((x) => x.tonVorwahl === true));
}

// ── Aufgabe 7 (4b): Fernsteuer-Befehle deuten, rein (Spec 11.2, 8.6, 0.5; L21) ──
{
  const { deuteZoomBefehl, ladeZiel } = await import('../src/main/zoom/fernsteuerung');
  const { FT } = await import('../src/main/zoom/klartext');
  const j = (x: unknown): string => JSON.stringify(x);

  console.log('— 4b: deuteZoomBefehl');
  ck('zoom_load [Ben] → laden „Ben“', j(deuteZoomBefehl('zoom_load', ['Ben'])) === j({ art: 'laden', name: 'Ben' }));
  ck('zoom_load [Anna, Maria] → „Anna Maria“ (Argumente mit einem Leerzeichen verbunden)',
    j(deuteZoomBefehl('zoom_load', ['Anna', 'Maria'])) === j({ art: 'laden', name: 'Anna Maria' }));
  for (const args of [[], ['  '], ['', '']]) {
    ck(`zoom_load ${j(args)} → f1 mit FT.F1`,
      j(deuteZoomBefehl('zoom_load', args)) === j({ art: 'abgelehnt', kennung: 'f1', text: FT.F1, logText: 'Companion: F1 (zoom_load)' }));
  }
  ck('zoom_unload [] → f1', j(deuteZoomBefehl('zoom_unload', [])) === j({ art: 'abgelehnt', kennung: 'f1', text: FT.F1, logText: 'Companion: F1 (zoom_unload)' }));
  ck('ZOOM_UNLOAD (Großschrift) [Ben] → entladen „Ben“', j(deuteZoomBefehl('ZOOM_UNLOAD', ['Ben'])) === j({ art: 'entladen', name: 'Ben' }));
  ck('Zoom_Load (gemischt) [Ben] → laden', j(deuteZoomBefehl('Zoom_Load', ['Ben'])) === j({ art: 'laden', name: 'Ben' }));
  ck('zoom_delay [300] → versatz 300', j(deuteZoomBefehl('zoom_delay', ['300'])) === j({ art: 'versatz', ms: 300 }));
  ck('zoom_delay [0] und [1000]: beide Grenzen gültig',
    j(deuteZoomBefehl('zoom_delay', ['0'])) === j({ art: 'versatz', ms: 0 }) && j(deuteZoomBefehl('zoom_delay', ['1000'])) === j({ art: 'versatz', ms: 1000 }));
  const F6: Array<[string[], string]> = [[['1001'], '1001'], [['1,5'], '1,5'], [['1.5'], '1.5'], [['-3'], '-3'], [[], ''], [['3', '00'], '3 00'], [['abc'], 'abc']];
  for (const [args, arg] of F6) {
    ck(`zoom_delay ${j(args)} → f6 mit „${arg}“ im Text`,
      j(deuteZoomBefehl('zoom_delay', args)) === j({ art: 'abgelehnt', kennung: 'f6', text: FT.F6(arg), logText: 'Companion: F6 (zoom_delay)' }));
  }
  ck('zoom_xyz → f7 mit dem Verb',
    j(deuteZoomBefehl('zoom_xyz', ['Anna'])) === j({ art: 'abgelehnt', kennung: 'f7', text: FT.F7('zoom_xyz'), logText: 'Companion: F7 (zoom_xyz)' }));
  ck('ZOOM_XYZ → f7, Verb klein in Text und Log',
    j(deuteZoomBefehl('ZOOM_XYZ', [])) === j({ art: 'abgelehnt', kennung: 'f7', text: FT.F7('zoom_xyz'), logText: 'Companion: F7 (zoom_xyz)' }));
  const abgelehnt = [deuteZoomBefehl('zoom_load', []), deuteZoomBefehl('zoom_delay', ['Anna', 'Maria']), deuteZoomBefehl('zoom_frieda', ['Anna', 'Maria'])];
  ck('logText nennt nie einen Namen aus den Argumenten (N4b.2)',
    abgelehnt.every((b) => b.art === 'abgelehnt' && !b.logText.includes('Anna') && !b.logText.includes('Maria')));

  console.log('— 4b: ladeZiel (Spec 11.2, normierter Name nach Spec 4)');
  const t = (id: number, name: string, imWarteraum = false) => ({ id, name, imWarteraum });
  const liste = [t(16778240, 'Anna'), t(16778241, 'Ben'), t(16778242, 'Carla', true), t(16778243, 'Dora'), t(16778244, 'dora ')];
  ck('genau eine Person → gefunden', j(ladeZiel('Ben', liste)) === j({ art: 'gefunden', id: 16778241 }));
  ck('„anna“ findet „Anna“ (normiert)', j(ladeZiel('anna', liste)) === j({ art: 'gefunden', id: 16778240 }));
  ck('Leerraum normiert: „  Anna “ findet „Anna“', j(ladeZiel('  Anna ', liste)) === j({ art: 'gefunden', id: 16778240 }));
  ck('zwei Personen (Dora, „dora “) → mehrdeutig n = 2', j(ladeZiel('Dora', liste)) === j({ art: 'mehrdeutig', n: 2 }));
  ck('genau eine Person im Warteraum → warteraum', j(ladeZiel('Carla', liste)) === j({ art: 'warteraum', id: 16778242 }));
  ck('niemand mit diesem Namen → niemand', j(ladeZiel('Frieda', liste)) === j({ art: 'niemand' }));
  ck('„Anna Maria“ trifft nicht „Anna“', j(ladeZiel('Anna Maria', liste)) === j({ art: 'niemand' }));
  ck('ein zweiter Ben im Warteraum macht „Ben“ mehrdeutig (Doppelname zählt den Warteraum mit)',
    j(ladeZiel('Ben', [...liste, t(16778245, 'BEN', true)])) === j({ art: 'mehrdeutig', n: 2 }));
}

console.log('— Fix-Welle: Stand „erlaubnis“ (die Person ist da, es fehlt nur die Aufnahme-Erlaubnis; Z6, Z7)');
{
  const t = (id: number, name: string, imWarteraum = false) => ({ id, name, imWarteraum });
  const soll: SollListe = new Map([
    ['anna', { name: 'Anna', ton: true, ndiName: 'JM Connect – Zoom Anna', aboId: 16778240 }],
    ['ben', { name: 'Ben', ton: true, ndiName: 'JM Connect – Zoom Ben', aboId: null }],
    ['carla', { name: 'Carla', ton: true, ndiName: 'JM Connect – Zoom Carla', aboId: null }],
    ['dora', { name: 'Dora', ton: true, ndiName: 'JM Connect – Zoom Dora', aboId: null }],
    ['emil', { name: 'Emil', ton: true, ndiName: 'JM Connect – Zoom Emil', aboId: 16778299 }],
  ]);
  // Anna: ihre Quelle ist nach dem Entzug abgebaut (kein Abo mehr), sie ist im Meeting. Ben im Warteraum, Carla nicht da,
  // Dora zweimal da, Emil verwaist (weg, sein altes Abo steht noch).
  const lage: SollLage = {
    teilnehmer: [t(16778240, 'Anna'), t(16778241, 'Ben', true), t(16778243, 'Dora'), t(16778244, 'dora')],
    abos: new Map([[16778299, { verwaist: true }]]),
    erlaubnisFehlt: true,
  };
  ck('ohne Erlaubnis: genau 1 Treffer, nicht im Warteraum, kein Abo → erlaubnis; die übrigen Stände bleiben',
    JSON.stringify(sollAbbild(soll, lage).map((e) => [e.name, e.stand]))
      === JSON.stringify([['Anna', 'erlaubnis'], ['Ben', 'wartet'], ['Carla', 'wartet'], ['Dora', 'doppelname'], ['Emil', 'verwaist']]));
  ck('… mit Erlaubnis, aber ohne geplanten Abgleich und ohne Ladefehler an ihrer Zeile bleibt Anna „wartet“',
    sollAbbild(soll, { ...lage, erlaubnisFehlt: false })[0]?.stand === 'wartet');
  ck('… ohne Angabe wie mit Erlaubnis (Vorgabe)', sollAbbild(soll, { teilnehmer: lage.teilnehmer, abos: lage.abos })[0]?.stand === 'wartet');
  ck('… die Handlungen hängen nicht daran (der Kern handelt ohnehin nur mit Erlaubnis)',
    JSON.stringify(sollHandlungen(soll, lage)) === JSON.stringify(sollHandlungen(soll, { ...lage, erlaubnisFehlt: false, abgleichGeplant: true })));
  ck('… ohne freien Platz bleibt es grenze, auch ohne Erlaubnis', sollAbbild(soll, lage, 0)[0]?.stand === 'grenze');
  // Mit Erlaubnis und geplantem Abgleich (300 ms nach roster, inMeeting, Erlaubnis „ja“): Die Person ist da, das Abo folgt gleich.
  const geplant: SollLage = { ...lage, erlaubnisFehlt: false, abgleichGeplant: true };
  ck('Abgleich geplant: genau 1 Treffer, kein Abo, Platz frei → laedt; Warteraum, fehlend, doppelt, verwaist bleiben',
    JSON.stringify(sollAbbild(soll, geplant).map((e) => [e.name, e.stand]))
      === JSON.stringify([['Anna', 'laedt'], ['Ben', 'wartet'], ['Carla', 'wartet'], ['Dora', 'doppelname'], ['Emil', 'verwaist']]));
  ck('… ohne freien Platz grenze (es folgt kein Abo)', sollAbbild(soll, geplant, 0)[0]?.stand === 'grenze');
}

console.log('— Owner 08.10.2026: Stand „wiederbeitritt“ (Connect selbst ist nicht im Meeting: Z10, Z11, fehler, „Erneut beitreten“)');
{
  const t = (id: number, name: string, imWarteraum = false) => ({ id, name, imWarteraum });
  const soll: SollListe = new Map([
    ['anna', { name: 'Anna', ton: true, ndiName: 'JM Connect – Zoom Anna', aboId: null }],
    ['ben', { name: 'Ben', ton: true, ndiName: 'JM Connect – Zoom Ben', aboId: null }],
    ['carla', { name: 'Carla', ton: true, ndiName: 'JM Connect – Zoom Carla', aboId: null }],
    ['dora', { name: 'Dora', ton: true, ndiName: 'JM Connect – Zoom Dora', aboId: null }],
    ['emil', { name: 'Emil', ton: true, ndiName: 'JM Connect – Zoom Emil', aboId: 16778299 }],
    ['fritz', { name: 'Fritz', ton: true, ndiName: 'JM Connect – Zoom Fritz', aboId: 16778245 }],
  ]);
  // Die letzte bekannte Lage (in Z10 die Sitzung der alten Bridge): Anna eindeutig da, Ben im Warteraum, Carla fehlt, Dora
  // doppelt, Emil verwaist (weg, sein altes Abo steht noch), Fritz verbunden (seine Quelle läuft).
  const lage: SollLage = {
    teilnehmer: [t(16778240, 'Anna'), t(16778241, 'Ben', true), t(16778243, 'Dora'), t(16778244, 'dora'), t(16778245, 'Fritz')],
    abos: new Map([[16778299, { verwaist: true }], [16778245, { verwaist: false }]]),
  };
  const staende = (l: SollLage, plaetze?: number): string => JSON.stringify(sollAbbild(soll, l, plaetze).map((e) => [e.name, e.stand]));
  // Ruling 08.10.2026: 'verwaist' behält Vorrang vor 'wiederbeitritt'. Ein verwaister Eintrag hat eine echte, schwarze
  // NDI-Quelle (aboId), die der Bediener per „Entladen“ abbauen können muss; in Z10 leben Bridge und Quelle weiter.
  const draussenErwartet = JSON.stringify([
    ['Anna', 'wiederbeitritt'], ['Ben', 'wiederbeitritt'], ['Carla', 'wiederbeitritt'], ['Dora', 'wiederbeitritt'], ['Emil', 'verwaist'],
  ]);
  const draussen: SollLage = { ...lage, ausserhalbMeeting: true };
  ck('außerhalb des Meetings: jeder offene Eintrag → wiederbeitritt (statt wartet, doppelname), nicht „wartet auf die Person“; nur verwaist bleibt',
    staende(draussen) === draussenErwartet);
  ck('… Vorrang vor erlaubnis (auch wenn die Lage „Erlaubnis fehlt“ meldet)', staende({ ...draussen, erlaubnisFehlt: true }) === draussenErwartet);
  ck('… Vorrang vor laedt (auch mit geplantem Abgleich)', staende({ ...draussen, abgleichGeplant: true }) === draussenErwartet);
  ck('… Vorrang vor grenze (kein freier Platz)', staende(draussen, 0) === draussenErwartet);
  ck('… wiederbeitritt ohne Abo zum Entladen und ohne Doppelname-Markierung',
    sollAbbild(soll, draussen).filter((e) => e.stand === 'wiederbeitritt').every((e) => e.aboId === null && !e.doppelname));
  const emil = (l: SollLage): ZoomSollEintrag | undefined => sollAbbild(soll, l).find((e) => e.name === 'Emil');
  ck('nicht im Meeting + verwaist → „verwaist“ mit aboId (Knopf „Entladen“ bleibt), genau wie im Meeting',
    emil(draussen)?.stand === 'verwaist' && emil(draussen)?.aboId === 16778299 && JSON.stringify(emil(draussen)) === JSON.stringify(emil(lage)));
  {
    // Verwaist und Name doppelt: auch außerhalb des Meetings rot mit Q11 und mit aboId, wie im Meeting.
    const soll2: SollListe = new Map([['gerd', { name: 'Gerd', ton: false, ndiName: 'JM Connect – Zoom Gerd', aboId: 16778300 }]]);
    const lage2: SollLage = { teilnehmer: [t(16778301, 'Gerd'), t(16778302, 'gerd')], abos: new Map([[16778300, { verwaist: true }]]) };
    const g = sollAbbild(soll2, { ...lage2, ausserhalbMeeting: true });
    ck('… auch mit Doppelname: verwaist, aboId, doppelname wie im Meeting',
      g.length === 1 && g[0].stand === 'verwaist' && g[0].aboId === 16778300 && g[0].doppelname
      && JSON.stringify(g) === JSON.stringify(sollAbbild(soll2, lage2)));
  }
  ck('… Zählung unverändert: dieselben Einträge offen wie im Meeting, der verbundene (Fritz) bleibt draußen',
    JSON.stringify(sollAbbild(soll, draussen).map((e) => e.name)) === JSON.stringify(sollAbbild(soll, lage).map((e) => e.name))
    && sollAbbild(soll, draussen, 0).length === sollAbbild(soll, lage, 0).length && !sollAbbild(soll, draussen).some((e) => e.name === 'Fritz'));
  ck('… die Handlungen hängen nicht daran (sollHandlungen unverändert)',
    JSON.stringify(sollHandlungen(soll, draussen)) === JSON.stringify(sollHandlungen(soll, lage)));
  ck('im Meeting (Feld false oder fehlend) bleiben die bisherigen Stände',
    staende({ ...lage, ausserhalbMeeting: false }) === staende(lage)
    && staende(lage) === JSON.stringify([['Anna', 'wartet'], ['Ben', 'wartet'], ['Carla', 'wartet'], ['Dora', 'doppelname'], ['Emil', 'verwaist']])
    && staende({ ...lage, ausserhalbMeeting: false, erlaubnisFehlt: true }).startsWith('[["Anna","erlaubnis"]'));
  // Welche Zustände „außerhalb“ sind: jeder außer im_meeting (Owner 08.10.2026), darunter abriss (Z10, Z11), fehler (R2, R7),
  // startet, tritt_bei und warteraum („Erneut beitreten“). Record über alle Zustände: ein neuer scheitert im Typcheck.
  const AUSSERHALB: Record<ZoomZustand, boolean> = {
    nicht_verfuegbar: true, einrichtung: true, bereit: true, startet: true, tritt_bei: true, warteraum: true,
    im_meeting: false, abriss: true, verlaesst: true, fehler: true,
  };
  for (const z of Object.keys(AUSSERHALB) as ZoomZustand[]) {
    ck(`istAusserhalbMeeting(${z}) = ${AUSSERHALB[z]}`, istAusserhalbMeeting(z) === AUSSERHALB[z]);
  }
}

console.log('— Owner 08.10.2026: Stände „keineAntwort“ (Q8) und „gescheitert“ (Ladefehler an ihrer Zeile), Vorrang-Kreuzprodukt');
{
  const t = (id: number, name: string, imWarteraum = false) => ({ id, name, imWarteraum });
  // Lesbarer Fall zuerst: im Meeting mit Erlaubnis, kein Abgleich geplant. Anna (Q8 an ihrer Zeile) und Ben (Ladefehler an seiner
  // Zeile) sind eindeutig da; Carla trägt einen Ladefehler, steht aber im Warteraum; Dora ist doppelt da (Fehler an einer der
  // beiden); Emil ist verwaist (Fehler an seiner neuen Zeile); Fritz ist mit neuer Kennung da, der Fehler steht an seiner alten;
  // Gustav ist nicht da (Fehler an seiner alten Zeile).
  const soll: SollListe = new Map([
    ['anna', { name: 'Anna', ton: true, ndiName: 'JM Connect – Zoom Anna', aboId: 16778240 }],
    ['ben', { name: 'Ben', ton: true, ndiName: 'JM Connect – Zoom Ben', aboId: 16778241 }],
    ['carla', { name: 'Carla', ton: true, ndiName: 'JM Connect – Zoom Carla', aboId: 16778242 }],
    ['dora', { name: 'Dora', ton: true, ndiName: 'JM Connect – Zoom Dora', aboId: 16778243 }],
    ['emil', { name: 'Emil', ton: true, ndiName: 'JM Connect – Zoom Emil', aboId: 16778299 }],
    ['fritz', { name: 'Fritz', ton: true, ndiName: 'JM Connect – Zoom Fritz', aboId: 16778245 }],
    ['gustav', { name: 'Gustav', ton: true, ndiName: 'JM Connect – Zoom Gustav', aboId: 16778246 }],
  ]);
  const lage: SollLage = {
    teilnehmer: [t(16778240, 'Anna'), t(16778241, 'Ben'), t(16778242, 'Carla', true), t(16778243, 'Dora'), t(16778244, 'dora'),
      t(16778250, 'Emil'), t(16778255, 'Fritz')],
    abos: new Map([[16778299, { verwaist: true }]]),
    ladeFehler: new Map([[16778240, 'keineAntwort'], [16778241, 'gescheitert'], [16778242, 'gescheitert'], [16778243, 'keineAntwort'],
      [16778250, 'gescheitert'], [16778245, 'keineAntwort'], [16778246, 'gescheitert']]),
  };
  const staende = (l: SollLage, plaetze?: number): string => JSON.stringify(sollAbbild(soll, l, plaetze).map((e) => [e.name, e.stand]));
  ck('Person eindeutig da, Q8 an ihrer Zeile → keineAntwort; Ladefehler an ihrer Zeile → gescheitert; Warteraum, doppelt, verwaist, Fehler an alter oder fremder Zeile bleiben',
    staende(lage) === JSON.stringify([['Anna', 'keineAntwort'], ['Ben', 'gescheitert'], ['Carla', 'wartet'], ['Dora', 'doppelname'],
      ['Emil', 'verwaist'], ['Fritz', 'wartet'], ['Gustav', 'wartet']]));
  ck('… keineAntwort und gescheitert ohne aboId und ohne Doppelname-Markierung',
    sollAbbild(soll, lage).some((e) => e.stand === 'keineAntwort')
    && sollAbbild(soll, lage).filter((e) => e.stand === 'keineAntwort' || e.stand === 'gescheitert').every((e) => e.aboId === null && !e.doppelname));
  const ohne: SollLage = { teilnehmer: lage.teilnehmer, abos: lage.abos };
  ck('… endet der Fehler (Zeilenfehler gelöscht), stimmt der alte Stand wieder: „wartet“',
    staende({ ...lage, ladeFehler: new Map() }) === staende(ohne) && staende(ohne).startsWith('[["Anna","wartet"],["Ben","wartet"]'));
  ck('… Zählung und Handlungen unverändert (kein automatischer neuer Versuch über den Stand)',
    JSON.stringify(sollAbbild(soll, lage).map((e) => e.name)) === JSON.stringify(sollAbbild(soll, ohne).map((e) => e.name))
    && JSON.stringify(sollHandlungen(soll, lage)) === JSON.stringify(sollHandlungen(soll, ohne)));

  // Kreuzprodukt über alle Achsen der Lage für einen Eintrag „Anna“. Die Vorrangtabelle (Spec 6.3, 9.9 mit den Nachträgen 4b):
  // verwaist > wiederbeitritt (außerhalb des Meetings) > grenze > doppelname > erlaubnis > laedt (Abgleich geplant)
  // > keineAntwort bzw. gescheitert (nur Person eindeutig da und Fehler an IHRER Zeile) > wartet.
  type Abo = 'keins' | 'verwaist';
  type Treffer = 'keiner' | 'da' | 'warteraum' | 'doppelt';
  type Fehler = 'ohne' | 'keineAntwort' | 'gescheitert' | 'keineAntwort fremd' | 'gescheitert fremd';
  const ANNA = 16778240, ALT = 16778299;
  const TREFFER: Record<Treffer, SollLage['teilnehmer']> = {
    keiner: [t(16778241, 'Ben')],
    da: [t(ANNA, 'Anna'), t(16778241, 'Ben')],
    warteraum: [t(ANNA, 'Anna', true)],
    doppelt: [t(ANNA, 'Anna'), t(16778244, 'ANNA ')],
  };
  const FEHLER: Record<Fehler, Map<number, 'keineAntwort' | 'gescheitert'> | undefined> = {
    ohne: undefined,
    keineAntwort: new Map([[ANNA, 'keineAntwort']]),
    gescheitert: new Map([[ANNA, 'gescheitert']]),
    // An einer anderen Zeile: ihre alte Kennung und Bens Zeile.
    'keineAntwort fremd': new Map([[ALT, 'keineAntwort'], [16778241, 'keineAntwort']]),
    'gescheitert fremd': new Map([[ALT, 'gescheitert'], [16778241, 'gescheitert']]),
  };
  const vorrang = (abo: Abo, tr: Treffer, aussen: boolean, plaetze: number, erlaubnisFehlt: boolean, geplant: boolean, f: Fehler): string => {
    if (abo === 'verwaist') return 'verwaist';
    if (aussen) return 'wiederbeitritt';
    const personDa = tr === 'da';
    if (personDa && plaetze <= 0) return 'grenze';
    if (tr === 'doppelt') return 'doppelname';
    if (personDa && erlaubnisFehlt) return 'erlaubnis';
    if (personDa && geplant) return 'laedt';
    if (personDa && (f === 'keineAntwort' || f === 'gescheitert')) return f;
    return 'wartet';
  };
  const B = [false, true];
  for (const f of Object.keys(FEHLER) as Fehler[]) {
    const abweichung: string[] = [];
    let n = 0;
    for (const abo of ['keins', 'verwaist'] as Abo[]) for (const tr of Object.keys(TREFFER) as Treffer[]) for (const aussen of B)
      for (const plaetze of [Infinity, 0]) for (const erlaubnisFehlt of B) for (const geplant of B) {
        n += 1;
        const einer: SollListe = new Map([['anna', { name: 'Anna', ton: true, ndiName: 'JM Connect – Zoom Anna', aboId: abo === 'verwaist' ? ALT : ANNA }]]);
        const l: SollLage = {
          teilnehmer: TREFFER[tr],
          abos: abo === 'verwaist' ? new Map([[ALT, { verwaist: true }]]) : new Map(),
          erlaubnisFehlt, abgleichGeplant: geplant, ausserhalbMeeting: aussen,
          ...(FEHLER[f] ? { ladeFehler: FEHLER[f] } : {}),
        };
        const ist = sollAbbild(einer, l, plaetze);
        const ohneFehler = sollAbbild(einer, { ...l, ladeFehler: undefined }, plaetze);
        const erwartet = vorrang(abo, tr, aussen, plaetze, erlaubnisFehlt, geplant, f);
        // Zählung (offen ja oder nein) und Handlungen hängen nicht am Fehler an der Zeile.
        const gleich = ist.length === 1 && ist[0].stand === erwartet && ohneFehler.length === 1
          && JSON.stringify(sollHandlungen(einer, l, plaetze)) === JSON.stringify(sollHandlungen(einer, { ...l, ladeFehler: undefined }, plaetze));
        if (!gleich) {
          abweichung.push(`${abo}/${tr}/${aussen ? 'außerhalb' : 'im Meeting'}/Plätze ${plaetze}/${erlaubnisFehlt ? 'ohne Erlaubnis' : 'Erlaubnis'}/`
            + `${geplant ? 'geplant' : '-'}: ${ist[0]?.stand ?? 'nichts'} statt ${erwartet}`);
        }
      }
    if (abweichung.length > 0) console.log(`     (${f}: ${abweichung.length} Abweichungen, etwa ${abweichung.slice(0, 3).join(' | ')})`);
    ck(`Kreuzprodukt, Fehler an der Zeile „${f}“: alle ${n} Lagen nach der Vorrangtabelle, Zählung und Handlungen wie ohne Fehler`,
      abweichung.length === 0 && n === 128);
  }
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
