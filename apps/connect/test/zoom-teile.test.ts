// Teilnehmerzeilen und Soll-Liste als reine Funktionen OHNE Electron (tsx): npm run selftest -w @jm/connect
// Spec 4 (Normierter Name, Doppelname, Verwaiste Quelle), 5.4 (ZoomParticipant), 6.3 (Abgleich-Tabelle, Kollision).
import type { Participant } from '@jm/zoom-bridge/protocol';
import type { ZoomQuelle } from '../src/shared/types';
import { KT } from '../src/main/zoom/klartext';
import { pruefeZugangEingabe } from '../src/main/zoom/zugang-eingabe';
import { pruefeSdkSchluesselEingabe } from '../src/main/zoom/sdk-schluessel-eingabe';
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

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
