// Teilnehmerzeilen, Einstellungen und Fernsteuer-Deutung als reine Funktionen OHNE Electron (tsx): npm run selftest -w @jm/connect
// Spec 4 (Normierter Name, Doppelname), 5.4 und Slot-Spec 7.10 (ZoomParticipant, KF4), 5.6 (Einstellungen), 11.2 (Deutung).
import type { Participant } from '@jm/zoom-bridge/protocol';
import { pruefeZugangEingabe } from '../src/main/zoom/zugang-eingabe';
import { pruefeSdkSchluesselEingabe } from '../src/main/zoom/sdk-schluessel-eingabe';
import { baueTeilnehmer, gleicherNdiName, kameraVon, NDI_PRAEFIX, normName } from '../src/main/zoom/teilnehmer';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

// ── Testhilfen ──
/** Teilnehmer wie im roster der Bridge; IDs wie in der Attrappe (eigene Zeile 100, Fremde ab 16778240). */
function p(id: number, name: string, extra: Partial<Participant> = {}): Participant {
  return { id, name, persistentId: '', self: false, videoOn: true, hasCamera: true, inWaitingRoom: false, role: 'attendee', ...extra };
}

console.log('— Normierter Name, NDI-Präfix, Kamera');
ck('normName: NFC („Ana\\u0301“ = „Aná“)', normName('Ana\u0301') === normName('An\u00e1'));
ck('normName: trim, Leerraum zu einem Leerzeichen', normName('  Anna \t  Maria ') === 'anna maria');
ck('normName: klein (de)', normName('ÄRGER') === 'ärger' && normName('Anna') === normName('anna'));
ck('NDI_PRAEFIX mit Gedankenstrich U+2013', NDI_PRAEFIX === 'JM Connect – Zoom ' && NDI_PRAEFIX.charCodeAt(11) === 0x2013);
ck('gleicherNdiName ohne Groß-/Kleinschreibung', gleicherNdiName('JM Connect – zoom anna', 'JM Connect – Zoom Anna'));
ck('gleicherNdiName nach NFC', gleicherNdiName('JM Connect – Zoom Ana\u0301', 'JM Connect – Zoom An\u00e1'));
ck('gleicherNdiName: anderer Name → nein', !gleicherNdiName('JM Connect – Zoom Anna', 'JM Connect – Zoom Anna (2)'));
ck('kameraVon: videoOn → an', kameraVon({ videoOn: true, hasCamera: true }) === 'an');
ck('kameraVon: hasCamera false → keine', kameraVon({ videoOn: false, hasCamera: false }) === 'keine');
ck('kameraVon: sonst → aus', kameraVon({ videoOn: false, hasCamera: true }) === 'aus');

console.log('— baueTeilnehmer (Spec 5.4, 7.10, 10.10; KF4: Slot-Nummern je Person, Kamera aus der Sitzung)');
{
  const liste: Participant[] = [
    p(100, 'JM Connect', { self: true, role: 'host' }),
    p(16778241, 'Zoe', { videoOn: false }),
    p(16778242, 'Ärger', { videoOn: false, hasCamera: false }),
    p(16778243, 'Ben', { role: 'coHost' }),
    p(16778240, 'Anna', { role: 'host' }),
    p(16778244, 'anna', { inWaitingRoom: true }),
  ];
  // Zwei Slots zeigen Anna (3 und 1, ungeordnet geliefert), einer Ben; Zoe zeigt niemand.
  const zeilen = baueTeilnehmer({ liste, slotNrn: new Map([[16778240, [3, 1]], [16778243, [2]]]) });
  const z = (id: number) => zeilen.find((x) => x.id === id);
  ck('eigene Zeile (self) fehlt', zeilen.length === 5 && z(100) === undefined);
  ck('Reihenfolge: Host, Co-Host, dann nach Name (de)', JSON.stringify(zeilen.map((x) => x.name)) === JSON.stringify(['Anna', 'Ben', 'anna', 'Ärger', 'Zoe']));
  ck('„Anna“ und „anna“ (im Warteraum) sind beide Doppelname', z(16778240)?.doppelname === true && z(16778244)?.doppelname === true);
  ck('eindeutige Namen sind kein Doppelname', z(16778243)?.doppelname === false && z(16778241)?.doppelname === false);
  ck('KF4: slotNrn = alle Slots auf diese Person, nach Nummer', JSON.stringify(z(16778240)?.slotNrn) === '[1,3]'
    && JSON.stringify(z(16778243)?.slotNrn) === '[2]' && JSON.stringify(z(16778241)?.slotNrn) === '[]');
  ck('KF4: Kamera aus dem Teilnehmer der Sitzung (der Reducer führt videoOn bei videoStatus nach)', z(16778241)?.kamera === 'aus'
    && z(16778242)?.kamera === 'keine' && z(16778240)?.kamera === 'an' && z(16778244)?.imWarteraum === true);
  ck('Rolle wird durchgereicht', z(16778240)?.rolle === 'host' && z(16778243)?.rolle === 'coHost' && z(16778241)?.rolle === 'attendee');
  ck('KF4: genau die Felder von ZoomParticipant (ohne Quelle, Ton-Vorwahl, Vorschau, Kollision, Zeilenfehler)',
    JSON.stringify(Object.keys(z(16778240) ?? {}).sort()) === '["doppelname","id","imWarteraum","kamera","name","rolle","slotNrn"]');
  ck('leere Liste → keine Zeilen', baueTeilnehmer({ liste: [], slotNrn: new Map() }).length === 0);
}

// zaehleQuellen und istVerwaist entfallen (es gibt keine Quellen, Spec 11.10); die Abgleich-Tabelle der Soll-Liste zieht in den
// reinen Slot-Abgleich (zoom-slots-abgleich.test.ts, Plan B, Task B1 und B2).

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

// ── Aufgabe 6 (4b): Plätze, NDI-Vorschau „(2)“, Ton aus dem Soll ──
// Entfallen mit Plan B, Task B12 (Spec 11.10): Plätze und Vorrang ziehen in den reinen Slot-Abgleich (Task B1, B2), die
// NDI-Vorschau in die Übergangs-Namensregel (PK35, Task B3), baueTeilnehmer in KF4 (oben).

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

// Die Stände der Soll-Liste (erlaubnis, wiederbeitritt, keineAntwort, gescheitert) und ihr Vorrang-Kreuzprodukt entfallen mit
// Plan B, Task B12; ihre Nachfolger sind die Slot-Zustände (Vorrang 7.3, zoom-slots-abgleich.test.ts) und PK18/PK19 (Task B14).

// ── Plan B, Task B3: Einstellungen der Slots rein (Spec 7.2, 7.6, 7.9, E26; PK24, PK35, KF6, KF7) ──
{
  const e = await import('../src/main/zoom/einstellungen');
  const { pruefeSlotEingabe } = await import('../src/main/zoom/slot-eingabe');
  const { NDI_NAME_TEXT, HALTEZEIT_UNGUELTIG } = await import('../src/shared/zoom-text');
  type SlotKanal = import('../src/main/zoom/slot-eingabe').SlotKanal;
  const j = (x: unknown): string => JSON.stringify(x);
  /** JSON mit sortierten Schlüsseln: Gleichheit ohne Rücksicht auf die Reihenfolge der Felder. */
  const flach = (x: unknown): string => JSON.stringify(x, (_k, v: unknown) =>
    v !== null && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
  const P = 'JM Connect – Zoom ';
  const V = { aufloesung: '720p', tonAn: true } as const;

  console.log('— B3 · Übergangs-Namensregel (PK35 rein, Spec 7.2)');
  ck('B3 PK35: „A:B“ → „JM Connect – Zoom A B“', e.uebergangsNdiName('A:B', []) === `${P}A B`);
  ck('B3 PK35: „A: B“ → zwei Leerzeichen, wie 0.3.0 nach NDI', e.uebergangsNdiName('A: B', []) === `${P}A  B`);
  ck('B3 PK35: „A  B“, „ A“ und „A “ bleiben Zeichen für Zeichen erhalten',
    e.uebergangsNdiName('A  B', []) === `${P}A  B` && e.uebergangsNdiName(' A', []) === `${P} A` && e.uebergangsNdiName('A ', []) === `${P}A `);
  ck('B3 PK35: Steuerzeichen fallen weg (U+0001, Tab, U+007F, U+0085)', e.uebergangsNdiName('A\u0001B\tC\u007fD\u0085E', []) === `${P}ABCDE`);
  const lang = 'x'.repeat(70);
  ck('B3 PK35: 70 Zeichen → 60 Code-Punkte', e.uebergangsNdiName(lang, []) === `${P}${'x'.repeat(42)}` && e.codePunkte(e.uebergangsNdiName(lang, [])) === 60);
  ck('B3 PK35: gekürzt nach Code-Punkten, nie mitten in einem Emoji',
    e.codePunkte(e.uebergangsNdiName('😀'.repeat(50), [])) === 60 && e.uebergangsNdiName('😀'.repeat(50), []) === `${P}${'😀'.repeat(42)}`);
  ck('B3 PK35: Kollision nach gleicherNdiName (ohne Groß-/Kleinschreibung) → „ (2)“', e.uebergangsNdiName('Anna', ['jm connect – zoom anna']) === `${P}Anna (2)`);
  ck('B3 PK35: „ (2)“ auch belegt → „ (3)“', e.uebergangsNdiName('Anna', [`${P}Anna`, `${P}ANNA (2)`]) === `${P}Anna (3)`);
  ck('B3 PK35: Platz für „ (2)“ vor dem Kürzen', e.uebergangsNdiName(lang, [`${P}${'x'.repeat(42)}`]) === `${P}${'x'.repeat(38)} (2)`);
  const uebergang = ['Moderation: Anna', ' A', 'A ', lang].map((n) => ({ ...e.neuerSlot(1, V, []), ndiName: e.uebergangsNdiName(n, []) }));
  ck('B3 PK35: normiereSlot verwirft einen so angelegten Slot nicht und ändert seinen Namen nicht',
    uebergang.every((s) => e.normiereSlot(s)?.ndiName === s.ndiName) && uebergang[0].ndiName === `${P}Moderation  Anna`);

  console.log('— B3 · NDI-Namensprüfung (PK24 rein, E26)');
  const andere = [{ nr: 5, ndiName: 'Bühne' }, { nr: 3, ndiName: 'Zoom 3' }, { nr: 9, ndiName: 'ZOOM 3' }];
  const fehler = (name: string, nr = 1): string | null => e.pruefeNdiName(name, nr, andere, []).fehler;
  ck('B3 PK24 T43: leer', j(e.pruefeNdiName('', 1, andere, [])) === j({ fehler: NDI_NAME_TEXT.laenge, warnung: null }));
  ck('B3 PK24 T43: 61 Code-Punkte', fehler('x'.repeat(61)) === NDI_NAME_TEXT.laenge);
  ck('B3 PK24: 60 Code-Punkte gültig, ein Emoji zählt 1', fehler('x'.repeat(60)) === null && fehler(`😀${'x'.repeat(59)}`) === null);
  ck('B3 PK24 T43: zwei Emoji und 59 Zeichen = 61 Code-Punkte', fehler(`😀😀${'x'.repeat(59)}`) === NDI_NAME_TEXT.laenge);
  ck('B3 PK24 T44: Doppelpunkt', fehler('A:B') === NDI_NAME_TEXT.doppelpunkt);
  ck('B3 PK24 T47: Steuerzeichen (U+0001, Zeilenumbruch, U+007F, U+009F)', ['A\u0001', 'A\nB', 'A\u007f', 'A\u009f'].every((n) => fehler(n) === NDI_NAME_TEXT.steuerzeichen));
  ck('B3 PK24 T45: Name eines anderen Slots, ohne Groß-/Kleinschreibung, kleinste Nummer', fehler('zoom 3') === NDI_NAME_TEXT.doppelt(3));
  ck('B3 PK24 T45: gleich nach NFC („Bu\\u0308hne“ = „Bühne“)', fehler('Bühne') === NDI_NAME_TEXT.doppelt(5));
  ck('B3 PK24: der eigene Name des Slots ist kein Doppel', fehler('Bühne', 5) === null);
  ck('B3 PK24 T46: gleich einem Browser-Gast → nur Warnung, das Speichern gelingt',
    j(e.pruefeNdiName('JM Connect – Zoom Anna', 1, andere, ['jm connect – zoom anna'])) === j({ fehler: null, warnung: NDI_NAME_TEXT.gast('JM Connect – Zoom Anna') }));
  ck('B3 PK24: ein Fehler verdrängt die Warnung', j(e.pruefeNdiName('A:B', 1, andere, ['A:B'])) === j({ fehler: NDI_NAME_TEXT.doppelpunkt, warnung: null }));

  console.log('— B3 · Haltezeit (KF7, Spec 7.6)');
  ck('B3 KF7: 0, 0,1, 1 und 5 s gültig', [0, 100, 1000, 5000].every((ms) => e.pruefeHaltezeit(ms) === null));
  ck('B3 KF7: −0,1, 5,1 und 0,05 s → T74', [-100, 5100, 50].every((ms) => e.pruefeHaltezeit(ms) === HALTEZEIT_UNGUELTIG));
  ck('B3 KF7: keine ganze Zahl, NaN, Unendlich → T74', [150.5, Number.NaN, Infinity].every((ms) => e.pruefeHaltezeit(ms) === HALTEZEIT_UNGUELTIG));

  console.log('— B3 · normiereSlot, normiereSlots, Vorgaben, Sprecher, neuer Slot (Spec 7.2, 7.6)');
  const voll = {
    nr: 7, ndiName: 'Bühne links', modus: 'freigabe', person: 'Anna', an: true, aufloesung: '1080p', ersatzbild: 'weiss', tonAn: false,
    tonArt: 'person', computerton: false, ohneKamera: false,
  };
  ck('B3 normiereSlot: gültiger Slot bleibt Feld für Feld gleich (alle elf von der Vorgabe abweichend)', flach(e.normiereSlot(voll)) === flach(voll));
  ck('B3 normiereSlot: genau die elf Felder, fremde fallen weg', j(Object.keys(e.normiereSlot({ ...voll, extra: 1 }) ?? {}).sort())
    === j(['an', 'aufloesung', 'computerton', 'ersatzbild', 'modus', 'ndiName', 'nr', 'ohneKamera', 'person', 'tonAn', 'tonArt']));
  ck('B3 normiereSlot: unbekannte Werte → Vorgabe eines neuen Slots (7.6)',
    flach(e.normiereSlot({ nr: 2, ndiName: 'Zoom 2', modus: 'galerie', person: 5, an: 'ja', aufloesung: '4k', ersatzbild: 'rot', tonAn: 1, tonArt: 'stereo', computerton: null }))
      === flach({ nr: 2, ndiName: 'Zoom 2', modus: 'teilnehmer', person: '', an: false, aufloesung: '720p', ersatzbild: 'transparent', tonAn: true, tonArt: 'mischton', computerton: true, ohneKamera: true }));
  ck('B3 normiereSlot: Nummer außerhalb 1–16 oder keine ganze Zahl → verworfen', [0, 17, 1.5, '3', undefined].every((nr) => e.normiereSlot({ ...voll, nr }) === null));
  ck('B3 normiereSlot: NDI-Name fehlt oder verletzt E26 → verworfen, nie still ersetzt',
    [undefined, '', 'A:B', 'A\u0001', 'x'.repeat(61), 7].every((ndiName) => e.normiereSlot({ ...voll, ndiName }) === null));
  ck('B3 normiereSlot: kein Objekt → verworfen', [null, 'x', 3, [voll]].every((r) => e.normiereSlot(r) === null));
  const liste = e.normiereSlots([
    { ...voll, nr: 4, ndiName: 'Zoom 4' }, { ...voll, nr: 2, ndiName: 'Zoom 2' }, { ...voll, nr: 4, ndiName: 'Zoom 4b' },
    { ...voll, nr: 5, ndiName: 'ZOOM 2' }, { ...voll, nr: 99, ndiName: 'Zoom 99' },
  ]);
  ck('B3 normiereSlots: doppelte Nummer, doppelter Name, Nummer 99 → drei verworfen; der erste gilt, nach Nummer sortiert',
    liste.verworfen === 3 && j(liste.slots.map((s) => [s.nr, s.ndiName])) === j([[2, 'Zoom 2'], [4, 'Zoom 4']]));
  ck('B3 normiereSlots: Feld fehlt → leer, nichts verworfen', j(e.normiereSlots(undefined)) === j({ slots: [], verworfen: 0 }) && j(e.normiereSlots(null)) === j({ slots: [], verworfen: 0 }));
  ck('B3 normiereSlots: kein Array → leer, ein Eintrag verworfen (T91 statt stillen Verlusts)', j(e.normiereSlots({ nr: 1 })) === j({ slots: [], verworfen: 1 }));
  ck('B3 normiereVorgaben: fehlt → 720p, Ton an; gültige Werte bleiben',
    flach(e.normiereVorgaben(undefined)) === flach({ aufloesung: '720p', tonAn: true }) && flach(e.normiereVorgaben({ aufloesung: '360p', tonAn: false })) === flach({ aufloesung: '360p', tonAn: false })
      && flach(e.normiereVorgaben({ aufloesung: '4k', tonAn: 'nein' })) === flach({ aufloesung: '720p', tonAn: true }));
  ck('B3 normiereSprecher: fehlt → sprecherVideo, 1000; gültige Werte bleiben; Haltezeit gegen KF7',
    flach(e.normiereSprecher(undefined)) === flach({ signal: 'sprecherVideo', haltezeitMs: 1000 })
      && flach(e.normiereSprecher({ signal: 'tonAktiv', haltezeitMs: 2500 })) === flach({ signal: 'tonAktiv', haltezeitMs: 2500 })
      && flach(e.normiereSprecher({ signal: 'laut', haltezeitMs: 5100 })) === flach({ signal: 'sprecherVideo', haltezeitMs: 1000 }));
  ck('B3 neuerSlot: Vorgaben 7.6 (Teilnehmer, keine Person, transparent, Mischton, Computerton an, ohne Kamera an, Start aus, „Zoom {nr}“)',
    flach(e.neuerSlot(3, { aufloesung: '1080p', tonAn: false }, [])) === flach({ nr: 3, ndiName: 'Zoom 3', modus: 'teilnehmer', person: '', an: false, aufloesung: '1080p', ersatzbild: 'transparent', tonAn: false, tonArt: 'mischton', computerton: true, ohneKamera: true }));
  ck('B3 neuerSlot: Kollision → „Zoom 1 (2)“, dann „ (3)“', e.neuerSlot(1, V, ['zoom 1']).ndiName === 'Zoom 1 (2)' && e.neuerSlot(1, V, ['Zoom 1', 'Zoom 1 (2)']).ndiName === 'Zoom 1 (3)');
  ck('B3 neuerSlot: geht durch normiereSlot unverändert', flach(e.normiereSlot(e.neuerSlot(16, V, []))) === flach(e.neuerSlot(16, V, [])));

  console.log('— B3 · pruefeSlotEingabe je Kanal (KF6, Spec 7.9)');
  const gut: Array<[SlotKanal, unknown]> = [
    ['anlegen', {}],
    ['aendern', { nr: 2, aenderung: { ndiName: 'Bühne', modus: 'sprecher', person: 'Anna', aufloesung: '360p', ersatzbild: 'schwarz', tonAn: false, tonArt: 'person', computerton: false, ohneKamera: false } }],
    ['aendern', { nr: 16, aenderung: {} }],
    ['loeschen', { nr: 16 }],
    ['start', { nr: 1, an: true }], ['start', { nr: 1, an: false, trotz: true }],
    ['ausPerson', { teilnehmerId: 16778240 }], ['ausPerson', { teilnehmerId: 4294967295, trotz: false }],
    ['person', { nr: 3, teilnehmerId: 16778241 }],
    ['vorgaben', { aufloesung: '360p', tonAn: false }],
    ['sprecher', { signal: 'tonAktiv', haltezeitMs: 5100 }],
    ['vorschau', { an: false }],
    ['messwerte', {}],
    ['behalten', { nr: 5 }],
  ];
  for (const [kanal, roh] of gut) {
    const r = pruefeSlotEingabe(kanal, roh);
    ck(`B3 KF6 ${kanal} gültig: ${j(roh)}`, r.ok && flach(r.wert) === flach(roh) && r.wert !== roh);
  }
  const schlecht: Array<[SlotKanal, unknown]> = [
    ['anlegen', { nr: 1 }],
    ['aendern', { nr: 2 }], ['aendern', { nr: 2, aenderung: { nr: 3 } }], ['aendern', { nr: 2, aenderung: { an: true } }],
    ['aendern', { nr: 2, aenderung: { modus: 'galerie' } }], ['aendern', { nr: 2, aenderung: { ndiName: 5 } }],
    ['aendern', { nr: 2, aenderung: { person: 'x'.repeat(513) } }], ['aendern', { nr: 0, aenderung: {} }],
    ['aendern', { nr: 2, aenderung: [] }], ['aendern', { nr: 2, aenderung: { toString: 'x' } }], ['aendern', { nr: 2, aenderung: {}, x: 1 }],
    ['loeschen', { nr: 17 }], ['loeschen', { nr: '1' }], ['loeschen', {}],
    ['start', { nr: 1 }], ['start', { nr: 1, an: 'ja' }], ['start', { nr: 1, an: true, trotz: 1 }], ['start', { nr: 1, an: true, extra: 1 }],
    ['ausPerson', { teilnehmerId: 0 }], ['ausPerson', { teilnehmerId: 1.5 }], ['ausPerson', { teilnehmerId: 4294967296 }],
    ['person', { nr: 3 }], ['person', { nr: 3, teilnehmerId: -1 }],
    ['vorgaben', { aufloesung: '4k', tonAn: true }], ['vorgaben', { aufloesung: '720p' }],
    ['sprecher', { signal: 'laut', haltezeitMs: 1000 }], ['sprecher', { signal: 'tonAktiv', haltezeitMs: '1000' }],
    ['sprecher', { signal: 'tonAktiv', haltezeitMs: Number.NaN }],
    ['vorschau', { an: 1 }], ['messwerte', { x: 1 }], ['behalten', { nr: null }],
  ];
  for (const [kanal, roh] of schlecht) ck(`B3 KF6 ${kanal} ungültig: ${j(roh)}`, j(pruefeSlotEingabe(kanal, roh)) === j({ ok: false }));
  const kanaele: SlotKanal[] = ['anlegen', 'aendern', 'loeschen', 'start', 'ausPerson', 'person', 'vorgaben', 'sprecher', 'vorschau', 'messwerte', 'behalten'];
  ck('B3 KF6: kein Objekt ist für keinen der elf Kanäle gültig',
    kanaele.length === 11 && kanaele.every((k) => [undefined, null, 'x', 3, [], [{}]].every((roh) => !pruefeSlotEingabe(k, roh).ok)));
}

// ── Plan B, Task B5: Fernsteuer-Deutung der Slot-Verben (Spec 8.3, E25; erweitert den 4b-Block deuteZoomBefehl) ──
console.log('— B5 · deuteZoomBefehl, Slot-Verben (8.3)');
{
  const { deuteZoomBefehl } = await import('../src/main/zoom/fernsteuerung');
  const { FT } = await import('../src/main/zoom/klartext');
  const j = (x: unknown): string => JSON.stringify(x);
  const ab = (kennung: string, text: string, verb: string): string =>
    j({ art: 'abgelehnt', kennung, text, logText: `Companion: ${kennung.toUpperCase()} (${verb})` });
  ck('B5 zoom_slot 1 ON → slot 1 on', j(deuteZoomBefehl('zoom_slot', ['1', 'ON'])) === j({ art: 'slot', nr: 1, wert: 'on' }));
  ck('B5 zoom_slot 16 off → slot 16 off (16 ist erlaubt)', j(deuteZoomBefehl('zoom_slot', ['16', 'off'])) === j({ art: 'slot', nr: 16, wert: 'off' }));
  ck('B5 ZOOM_SLOT 3 TOGGLE und Toggle → toggle (Verb und Wert ohne Groß-/Kleinschreibung)',
    j(deuteZoomBefehl('ZOOM_SLOT', ['3', 'TOGGLE'])) === j({ art: 'slot', nr: 3, wert: 'toggle' })
      && j(deuteZoomBefehl('zoom_slot', ['3', 'Toggle'])) === j({ art: 'slot', nr: 3, wert: 'toggle' }));
  ck('B5 zoom_slot_audio 2 OFF → slotTon 2 off', j(deuteZoomBefehl('zoom_slot_audio', ['2', 'OFF'])) === j({ art: 'slotTon', nr: 2, wert: 'off' }));
  ck('B5 zoom_slot_audio 2 toggle → slotTon 2 toggle', j(deuteZoomBefehl('zoom_slot_audio', ['2', 'toggle'])) === j({ art: 'slotTon', nr: 2, wert: 'toggle' }));
  ck('B5 zoom_slot_mode 2 sprecher, FREIGABE, Teilnehmer → slotModus',
    j(deuteZoomBefehl('zoom_slot_mode', ['2', 'sprecher'])) === j({ art: 'slotModus', nr: 2, modus: 'sprecher' })
      && j(deuteZoomBefehl('zoom_slot_mode', ['2', 'FREIGABE'])) === j({ art: 'slotModus', nr: 2, modus: 'freigabe' })
      && j(deuteZoomBefehl('zoom_slot_mode', ['2', 'Teilnehmer'])) === j({ art: 'slotModus', nr: 2, modus: 'teilnehmer' }));
  ck('B5 zoom_slot_person 1 Anna Maria → Name mit einem Leerzeichen verbunden',
    j(deuteZoomBefehl('zoom_slot_person', ['1', 'Anna', 'Maria'])) === j({ art: 'slotPerson', nr: 1, name: 'Anna Maria' }));
  const F9: Array<[string[], string]> = [[['0', 'ON'], '0'], [['17', 'ON'], '17'], [['x', 'ON'], 'x'], [[], ''], [['1.5', 'ON'], '1.5'], [['-1', 'ON'], '-1']];
  for (const [args, arg] of F9) ck(`B5 zoom_slot ${j(args)} → F9 mit „${arg}“`, j(deuteZoomBefehl('zoom_slot', args)) === ab('f9', FT.F9(arg), 'zoom_slot'));
  ck('B5 F9 gilt für alle vier Slot-Verben', ['zoom_slot_mode', 'zoom_slot_person', 'zoom_slot_audio'].every((v) => j(deuteZoomBefehl(v, ['99', 'x'])) === ab('f9', FT.F9('99'), v)));
  const F13: Array<[string[], string]> = [[['1'], ''], [['1', 'an'], 'an'], [['1', 'on', 'extra'], 'on extra']];
  for (const [args, arg] of F13) ck(`B5 zoom_slot ${j(args)} → F13 mit „${arg}“`, j(deuteZoomBefehl('zoom_slot', args)) === ab('f13', FT.F13(arg), 'zoom_slot'));
  ck('B5 zoom_slot_audio 1 laut → F13', j(deuteZoomBefehl('zoom_slot_audio', ['1', 'laut'])) === ab('f13', FT.F13('laut'), 'zoom_slot_audio'));
  ck('B5 zoom_slot_mode 1 galerie → F10 mit „galerie“; ohne Modus → F10 mit „“',
    j(deuteZoomBefehl('zoom_slot_mode', ['1', 'galerie'])) === ab('f10', FT.F10('galerie'), 'zoom_slot_mode')
      && j(deuteZoomBefehl('zoom_slot_mode', ['1'])) === ab('f10', FT.F10(''), 'zoom_slot_mode'));
  ck('B5 zoom_slot_person 1 ohne Namen oder nur Leerraum → F11 mit der Nummer',
    j(deuteZoomBefehl('zoom_slot_person', ['1'])) === ab('f11', FT.F11(1), 'zoom_slot_person')
      && j(deuteZoomBefehl('zoom_slot_person', ['1', '  '])) === ab('f11', FT.F11(1), 'zoom_slot_person'));
  const abgelehnt = [deuteZoomBefehl('zoom_slot', ['Anna']), deuteZoomBefehl('zoom_slot_mode', ['1', 'Anna']), deuteZoomBefehl('zoom_slot', ['1', 'Anna'])];
  ck('B5 logText nennt nie einen Namen aus den Argumenten (N4b.2)', abgelehnt.every((b) => b.art === 'abgelehnt' && !b.logText.includes('Anna')));
  ck('B5 die alten Verben deuten unverändert (zoom_load, zoom_delay, zoom_xyz → F7)',
    j(deuteZoomBefehl('zoom_load', ['Ben'])) === j({ art: 'laden', name: 'Ben' }) && j(deuteZoomBefehl('zoom_delay', ['300'])) === j({ art: 'versatz', ms: 300 })
      && j(deuteZoomBefehl('zoom_slotx', ['1'])) === ab('f7', FT.F7('zoom_slotx'), 'zoom_slotx'));
}

// ── Plan B, Task B11: alte Bedienwege entfallen (Spec 7.9, 7.5 Nr. 9 und 10, 9.7 „Entfallen“, E29) ──
console.log('— B11 · Laden, Entladen, Ton-Umschalten und Vergessen gibt es weder in Hülle, Preload und IPC noch in der Karte');
{
  const { readFileSync } = await import('node:fs');
  const lies = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8');
  const typen = lies('../src/shared/types.ts');
  const api = typen.slice(typen.indexOf('export interface JmConnectApi'));
  const orte: Array<[string, string]> = [
    ['preload/index.ts', lies('../src/preload/index.ts')],
    ['main/zoom.ts', lies('../src/main/zoom.ts')],
    ['shared/ipc.ts', lies('../src/shared/ipc.ts')],
    ['JmConnectApi (shared/types.ts)', api],
    ['renderer/src/zoom/ZoomCard.tsx', lies('../src/renderer/src/zoom/ZoomCard.tsx')],
  ];
  const ALT = ['zoomLaden', 'zoomEntladen', 'zoomTon', 'zoomSollVerwerfen', 'jmc:zoom-laden', 'jmc:zoom-entladen', 'jmc:zoom-ton', 'jmc:zoom-soll-verwerfen'];
  for (const [ort, text] of orte) {
    const treffer = ALT.filter((n) => text.includes(n));
    ck(`B11: ${ort} nennt keinen der vier alten Kanäle${treffer.length ? ` (gefunden: ${treffer.join(', ')})` : ''}`, treffer.length === 0);
  }
  ck('B11: JmConnectApi gefunden (die Prüfung greift)', api.length > 1000 && api.includes('zoomVersatz'));
  const karte = orte[4][1];
  const RESTE = ['Als Quelle laden', 'Entladen', 'Gemerkte Quellen', 'wird: ', 'trotzId', 'soll:', 'TEXT_Q11', 'TEXT_Q14', 'kollision', 'tonVorwahl', 'ndiNameVorschau', 't.quelle', 't.fehler', 'a.soll'];
  const reste = RESTE.filter((r) => karte.includes(r));
  ck(`B11: die Karte hat keinen Ton-Schalter je Zeile, kein „Als Quelle laden“/„Entladen“, kein „wird: …“, keine „Gemerkten Quellen“${reste.length ? ` (gefunden: ${reste.join(', ')})` : ''}`,
    reste.length === 0);
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
