// Zoom-Einstellungen: ein gescheitertes Schreiben darf die Anzeige nicht belügen (Fix-Runde 1, Aufgabe 16).
// settings.ts braucht Electron und das Log; beides wird per Modul-Hook durch Attrappen ersetzt. npm run selftest -w @jm/connect
import { registerHooks } from 'node:module';
import { chmodSync, mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const g = globalThis as unknown as { __mock: { userData: string; verschluesselung: boolean } };
const wurzel = mkdtempSync(join(tmpdir(), 'jmc-set-'));
const kaputt = join(wurzel, 'datei-statt-ordner');
writeFileSync(kaputt, 'x'); // darunter lässt sich nichts anlegen → jedes Schreiben scheitert
g.__mock = { userData: wurzel, verschluesselung: true };

const ELECTRON = `
export const app = { getPath: () => globalThis.__mock.userData };
export const safeStorage = {
  isEncryptionAvailable: () => globalThis.__mock.verschluesselung,
  encryptString: (s) => Buffer.from('E:' + s),
  decryptString: (b) => b.toString().slice(2),
};`;
const LOG = `const n = () => {}; export const getLog = () => ({ error: n, warn: n, info: n });`;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'electron') return { url: 'mock:electron', shortCircuit: true };
    if (spec === '@jm/app-runtime') return { url: 'mock:app-runtime', shortCircuit: true };
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (url === 'mock:electron') return { format: 'module', source: ELECTRON, shortCircuit: true };
    if (url === 'mock:app-runtime') return { format: 'module', source: LOG, shortCircuit: true };
    return next(url, ctx);
  },
});

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

const s = await import('../src/main/settings');
const daten = { clientId: 'ID-1234', clientSecret: 'geheim' };

// Schreiben klappt: wie bisher
g.__mock.userData = wurzel;
ck('Set: Schreiben ok → stored', s.zoomZugangSpeichern(daten) === 'stored');
ck('Set: Datei liegt da', existsSync(join(wurzel, 'connect-settings.json')) && readFileSync(join(wurzel, 'connect-settings.json'), 'utf8').includes('zoomZugangEnc'));
s.setzeZoomVersatzMs(120); s.setzeZoomAnzeigename('Alt');
ck('Set: Versatz/Name von Platte', s.zoomVersatzMs() === 120 && s.zoomAnzeigename() === 'Alt');

// Schreiben scheitert
g.__mock.userData = kaputt;
const neu = { clientId: 'ID-9999', clientSecret: 'neu' };
ck('Set: Schreiben scheitert → session statt stored', s.zoomZugangSpeichern(neu) === 'session');
const z = s.zoomZugangLesen();
ck('Set: Sitzungsdaten gelten, Herkunft session', z.herkunft === 'session' && z.daten?.clientId === 'ID-9999');
ck('Set: Grund schreibfehler (Schlüsselbund ist da, die Datei nicht)', z.grund === 'schreibfehler');
const versatzGespeichert = s.setzeZoomVersatzMs(300);
ck('Set: Versatz nach gescheitertem Schreiben = neuer Wert', s.zoomVersatzMs() === 300);
ck('Set: … setzeZoomVersatzMs meldet false, der Versatz gilt nur für diese Sitzung (N4b.3 Nr. 4)',
  versatzGespeichert === false && s.zoomVersatzNurSitzung());
s.setzeZoomAnzeigename('Neu');
ck('Set: Name nach gescheitertem Schreiben = neuer Wert', s.zoomAnzeigename() === 'Neu');

// Platte wieder da: Schreiben gelingt, Platte ist maßgeblich
g.__mock.userData = wurzel;
s.zoomZugangSpeichern(daten);
ck('Set: erfolgreich gespeichert → kein Grund mehr', s.zoomZugangLesen().herkunft === 'stored' && s.zoomZugangLesen().grund === undefined);
const wiederGespeichert = s.setzeZoomVersatzMs(50); s.setzeZoomAnzeigename('Platte');
ck('Set: Schreiben ok → Platte gilt', s.zoomVersatzMs() === 50 && s.zoomAnzeigename() === 'Platte');
ck('Set: … setzeZoomVersatzMs meldet true, nicht mehr nur Sitzung', wiederGespeichert === true && !s.zoomVersatzNurSitzung());

// Ohne Schlüsselbund: Sitzung ohne Grund (A4 bleibt wörtlich richtig)
g.__mock.verschluesselung = false;
s.zoomZugangSpeichern(neu);
const o = s.zoomZugangLesen();
ck('Set: ohne Schlüsselbund → session, kein Grund', o.herkunft === 'session' && o.grund === undefined);

// SDK-Schlüssel (Spec SDK nachladen 4.2): Umgebung > gespeichert > Sitzung, nie im Klartext auf der Platte
const datei = (): string => readFileSync(join(wurzel, 'connect-settings.json'), 'utf8');
g.__mock.verschluesselung = true;
g.__mock.userData = wurzel;
// Unabhängig von der Umgebung des Testlaufs: Eine gesetzte Variable hätte Vorrang (Gesamtprüfung: Task 3 minor 2).
delete process.env.JMPS_ZOOM_SDK_KEY;
const leer = s.zoomSdkSchluesselLesen();
ck('SDK: anfangs fehlt der Schlüssel', leer.herkunft === 'none' && leer.wert === null);
ck('SDK: Speichern mit Schlüsselbund → stored', s.zoomSdkSchluesselSpeichern('sdk-geheim-test') === 'stored');
ck('SDK: verschlüsselt in der Datei, nie im Klartext', datei().includes('zoomSdkKeyEnc') && !datei().includes('sdk-geheim-test'));
const gespeichert = s.zoomSdkSchluesselLesen();
ck('SDK: Lesen → stored mit Wert', gespeichert.herkunft === 'stored' && gespeichert.wert === 'sdk-geheim-test');
process.env.JMPS_ZOOM_SDK_KEY = '  sdk-test  ';
const umgebung = s.zoomSdkSchluesselLesen();
ck('SDK: Umgebung JMPS_ZOOM_SDK_KEY hat Vorrang, getrimmt', umgebung.herkunft === 'env' && umgebung.wert === 'sdk-test');
delete process.env.JMPS_ZOOM_SDK_KEY;
// Datei lesbar, aber schreibgeschützt: der alte Wert steht noch auf der Platte, der neue kommt nicht hin.
chmodSync(join(wurzel, 'connect-settings.json'), 0o444);
ck('SDK: Schreiben scheitert → session statt stored', s.zoomSdkSchluesselSpeichern('sdk-test') === 'session');
const sitzung = s.zoomSdkSchluesselLesen();
ck('SDK: … der neue Wert gilt für die Sitzung, nicht der alte von der Platte', sitzung.herkunft === 'session' && sitzung.wert === 'sdk-test');
chmodSync(join(wurzel, 'connect-settings.json'), 0o644);
s.zoomSdkSchluesselLoeschen();
ck('SDK: Entfernen → fehlt, Feld aus der Datei', s.zoomSdkSchluesselLesen().herkunft === 'none' && !datei().includes('zoomSdkKeyEnc'));
g.__mock.verschluesselung = false;
ck('SDK: ohne Schlüsselbund → session', s.zoomSdkSchluesselSpeichern('sdk-test') === 'session' && s.zoomSdkSchluesselLesen().herkunft === 'session');
ck('SDK: … nichts davon auf der Platte', !datei().includes('zoomSdkKeyEnc') && !datei().includes('sdk-test'));

// Entfernen und Speichern, wenn die Datei nicht schreibbar ist (Gesamtprüfung: Task 3 minor 1 und 3, Task 4 minor 1):
// Für diese Sitzung ist der Wert weg, auf der Platte steht er noch. Das meldet `false`, damit der Kern es sagen kann.
const schreibschutz = (an: boolean): void => chmodSync(join(wurzel, 'connect-settings.json'), an ? 0o444 : 0o644);
g.__mock.verschluesselung = true;
ck('SDK: Vorbereitung: gespeichert', s.zoomSdkSchluesselSpeichern('sdk-geheim-test') === 'stored');
schreibschutz(true);
ck('SDK: Entfernen bei schreibgeschützter Datei → false', s.zoomSdkSchluesselLoeschen() === false);
ck('SDK: … für diese Sitzung weg, auf der Platte noch da', s.zoomSdkSchluesselLesen().herkunft === 'none' && datei().includes('zoomSdkKeyEnc'));
g.__mock.verschluesselung = false;
ck('SDK: ohne Schlüsselbund, Datei schreibgeschützt → session (Zweig ohne Schlüsselbund, Schreiben scheitert)',
  s.zoomSdkSchluesselSpeichern('sdk-test') === 'session' && s.zoomSdkSchluesselLesen().wert === 'sdk-test');
ck('SDK: … nie im Klartext auf der Platte', !datei().includes('sdk-test'));
ck('SDK: … Entfernen → false, solange das alte Feld noch auf der Platte steht', s.zoomSdkSchluesselLoeschen() === false
  && s.zoomSdkSchluesselLesen().herkunft === 'none');
schreibschutz(false);
ck('SDK: Entfernen bei schreibbarer Datei → true, Feld weg', s.zoomSdkSchluesselLoeschen() === true && !datei().includes('zoomSdkKeyEnc'));
g.__mock.userData = kaputt;
s.zoomSdkSchluesselSpeichern('sdk-test');
ck('SDK: nur in der Sitzung und nichts auf der Platte → Entfernen → true, auch wenn das Schreiben scheitert',
  s.zoomSdkSchluesselLoeschen() === true && s.zoomSdkSchluesselLesen().herkunft === 'none');
g.__mock.userData = wurzel;
g.__mock.verschluesselung = true;
s.zoomZugangSpeichern(daten);
ck('Zugang: Vorbereitung: gespeichert', s.zoomZugangLesen().herkunft === 'stored' && datei().includes('zoomZugangEnc'));
schreibschutz(true);
ck('Zugang: Entfernen bei schreibgeschützter Datei → false', s.zoomZugangLoeschen() === false);
ck('Zugang: … für diese Sitzung weg, auf der Platte noch da', s.zoomZugangLesen().daten === null && datei().includes('zoomZugangEnc'));
schreibschutz(false);
ck('Zugang: Entfernen bei schreibbarer Datei → true, Feld weg', s.zoomZugangLoeschen() === true && !datei().includes('zoomZugangEnc'));

// ── Plan B, Task B4: Zoom-Slots in connect-settings.json (Spec 7.2, 11.5; T90–T92 über einstellungsLage) ──
{
  const e = await import('../src/main/zoom/einstellungen');
  const { readdirSync } = await import('node:fs');
  type Slot = import('../src/shared/types').ZoomSlotEinstellung;
  /** JSON mit sortierten Schlüsseln: Gleichheit ohne Rücksicht auf die Reihenfolge der Felder. */
  const flach = (x: unknown): string => JSON.stringify(x, (_k, v: unknown) =>
    v !== null && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
  const V = { aufloesung: '720p', tonAn: true } as const;
  const ordnerA = mkdtempSync(join(tmpdir(), 'jmc-slots-'));
  const dateiA = join(ordnerA, 'connect-settings.json');
  const inA = (): Record<string, unknown> => JSON.parse(readFileSync(dateiA, 'utf8')) as Record<string, unknown>;
  g.__mock.userData = ordnerA;
  g.__mock.verschluesselung = true;

  ck('B4 7.2: ohne Datei → keine Slots; Vorgaben 720p/an, Sprecher sprecherVideo/1000, Vorschau an, keine Zustimmung über 5',
    s.zoomSlots().length === 0 && flach(s.zoomSlotVorgaben()) === flach({ aufloesung: '720p', tonAn: true })
      && flach(s.zoomSprecher()) === flach({ signal: 'sprecherVideo', haltezeitMs: 1000 }) && s.zoomVorschau() === true && s.zoomSlotsUeber5() === false);
  ck('B4 7.2: einstellungsLage ohne Befund → gesichert null, verworfen 0', flach(s.einstellungsLage()) === flach({ gesichert: null, verworfen: 0, nurSitzung: false }));

  // 11.5 Konstruktor-Rundlauf: jedes der elf Felder einzeln geändert, geschrieben, gelesen
  const basis = e.neuerSlot(1, V, []);
  const ABWEICHUNG: Array<[keyof Slot, Partial<Slot>]> = [
    ['nr', { nr: 16 }], ['ndiName', { ndiName: 'Bühne links' }], ['modus', { modus: 'freigabe' }], ['person', { person: 'Anna Maria' }],
    ['an', { an: true }], ['aufloesung', { aufloesung: '1080p' }], ['ersatzbild', { ersatzbild: 'schwarz' }], ['tonAn', { tonAn: false }],
    ['tonArt', { tonArt: 'person' }], ['computerton', { computerton: false }], ['ohneKamera', { ohneKamera: false }],
  ];
  ck('B4 11.5: der Rundlauf deckt alle elf Felder', ABWEICHUNG.length === 11 && new Set(ABWEICHUNG.map(([f]) => f)).size === 11 && Object.keys(basis).length === 11);
  for (const [feld, a] of ABWEICHUNG) {
    const slot = { ...basis, ...a };
    ck(`B4 11.5 Rundlauf ${feld}: geschrieben, gelesen, gleich`, s.setzeZoomSlots([slot]) && flach(s.zoomSlots()) === flach([slot]));
  }
  ck('B4 7.2: zoomSlotsFassung 1 in der Datei', inA().zoomSlotsFassung === 1);

  // 7.2: vorübergehende Slots nie, anNurMeeting mit an: false
  const dauerhaft = { ...basis, nr: 1, ndiName: 'Zoom 1', person: 'Anna', an: true };
  const voruebergehend = { ...basis, nr: 2, ndiName: 'JM Connect – Zoom Bernd', person: 'Bernd', an: true };
  const nurMeeting = { ...basis, nr: 3, ndiName: 'Zoom 3', person: 'Carla', an: true };
  s.setzeZoomSlots(e.slotsFuerPlatte([
    { e: dauerhaft, voruebergehend: false, anNurMeeting: false },
    { e: voruebergehend, voruebergehend: true, anNurMeeting: false },
    { e: nurMeeting, voruebergehend: false, anNurMeeting: true },
  ]));
  ck('B4 7.2, 0.14: ein vorübergehender Slot steht nie in der Datei (weder Nummer noch Name noch Person)',
    !readFileSync(dateiA, 'utf8').includes('Bernd') && s.zoomSlots().every((x) => x.nr !== 2));
  ck('B4 7.2 RR7: ein dauerhafter Slot mit anNurMeeting steht mit an: false in der Datei', s.zoomSlots().find((x) => x.nr === 3)?.an === false);
  ck('B4 7.2: ein dauerhafter Slot ohne anNurMeeting behält an: true', s.zoomSlots().find((x) => x.nr === 1)?.an === true);

  // Vorgaben, Sprecher, Vorschau, Zustimmung über 5: Rundlauf
  ck('B4 7.2: Vorgaben, Sprecher, Vorschau und Zustimmung → gespeichert und gelesen',
    s.setzeZoomSlotVorgaben({ aufloesung: '1080p', tonAn: false }) && s.setzeZoomSprecher({ signal: 'tonAktiv', haltezeitMs: 2500 })
      && s.setzeZoomVorschau(false) && s.setzeZoomSlotsUeber5(true)
      && flach(s.zoomSlotVorgaben()) === flach({ aufloesung: '1080p', tonAn: false }) && flach(s.zoomSprecher()) === flach({ signal: 'tonAktiv', haltezeitMs: 2500 })
      && s.zoomVorschau() === false && s.zoomSlotsUeber5() === true);
  ck('B4 7.2: … alles in der Datei', flach(inA().zoomSlotVorgaben) === flach({ aufloesung: '1080p', tonAn: false })
    && flach(inA().zoomSprecher) === flach({ signal: 'tonAktiv', haltezeitMs: 2500 }) && inA().zoomVorschau === false && inA().zoomSlotsUeber5 === true);

  // 11.5: normiereSlot beim Lesen, T91 mit Zahl
  writeFileSync(dateiA, JSON.stringify({ zoomSlots: [
    { ...basis, nr: 4, ndiName: 'Zoom 4' },
    { ...basis, nr: 4, ndiName: 'Zoom 4b' },
    { ...basis, nr: 5, ndiName: 'zoom 4' },
    { ...basis, nr: 17, ndiName: 'Zoom 17' },
    { ...basis, nr: 6, ndiName: 'A:B' },
    { ...basis, nr: 7, ndiName: 'Zoom 7', modus: 'galerie', aufloesung: '4k' },
  ] }));
  const gelesen = s.zoomSlots();
  ck('B4 11.5: normiereSlot beim Lesen: zwei übernommen, unbekannte Werte → Vorgabe',
    JSON.stringify(gelesen.map((x) => [x.nr, x.modus, x.aufloesung])) === JSON.stringify([[4, 'teilnehmer', '720p'], [7, 'teilnehmer', '720p']]));
  ck('B4 11.5 T91: vier verworfen (doppelte Nummer, doppelter Name, Nummer 17, Name mit „:“)', s.einstellungsLage().verworfen === 4);

  // 11.5 T92: Schreibfehler → nur diese Sitzung, die Anzeige behauptet kein Speichern
  const neu = { ...basis, nr: 9, ndiName: 'Zoom 9' };
  g.__mock.userData = kaputt;
  ck('B4 11.5 T92: Schreiben scheitert → setzeZoomSlots meldet false', s.setzeZoomSlots([neu]) === false);
  ck('B4 11.5: … die Slots gelten für diese Sitzung (der Getter liefert sie)', flach(s.zoomSlots()) === flach([neu]));
  ck('B4 11.5: … ebenso Vorgaben, Sprecher, Vorschau und Zustimmung (false, der Sitzungswert gilt)',
    s.setzeZoomSlotVorgaben({ aufloesung: '360p', tonAn: true }) === false && s.zoomSlotVorgaben().aufloesung === '360p'
      && s.setzeZoomSprecher({ signal: 'aktivesVideo', haltezeitMs: 0 }) === false && s.zoomSprecher().signal === 'aktivesVideo'
      && s.setzeZoomVorschau(true) === false && s.zoomVorschau() === true && s.setzeZoomSlotsUeber5(false) === false && s.zoomSlotsUeber5() === false);
  g.__mock.userData = ordnerA;
  ck('B4: Platte wieder schreibbar → true, die Platte gilt', s.setzeZoomSlots([neu]) === true && s.setzeZoomSlotVorgaben(V) && s.setzeZoomSprecher({ signal: 'sprecherVideo', haltezeitMs: 1000 })
    && s.setzeZoomVorschau(true) && s.setzeZoomSlotsUeber5(false) && flach(inA().zoomSlots) === flach([neu]) && flach(s.zoomSlots()) === flach([neu]));

  // 0.17, T90: unlesbare Datei → Sicherungskopie vor dem nächsten Schreiben
  const ordnerB = mkdtempSync(join(tmpdir(), 'jmc-slots-kaputt-'));
  const dateiB = join(ordnerB, 'connect-settings.json');
  writeFileSync(dateiB, '{ "zoomSlots": [ kaputt');
  g.__mock.userData = ordnerB;
  ck('B4 7.2: unlesbare Datei → keine Slots, Vorgaben', s.zoomSlots().length === 0 && flach(s.zoomSlotVorgaben()) === flach(V) && s.zoomVorschau() === true);
  ck('B4 0.17: … vor dem nächsten Schreiben noch keine Sicherungskopie, die Datei liegt unverändert',
    s.einstellungsLage().gesichert === null && readdirSync(ordnerB).length === 1 && readFileSync(dateiB, 'utf8') === '{ "zoomSlots": [ kaputt');
  ck('B4 0.17: … das nächste Schreiben gelingt', s.setzeZoomVorschau(false) === true);
  const kopien = readdirSync(ordnerB).filter((n) => n !== 'connect-settings.json');
  ck('B4 0.17: Sicherungskopie im selben Ordner, Name mit Zeitstempel', kopien.length === 1 && /^connect-settings\.unlesbar-\d{8}-\d{6}\.json$/.test(kopien[0]));
  ck('B4 0.17: … mit dem alten Inhalt (die übrigen Felder gehen nicht still verloren)', kopien.length === 1 && readFileSync(join(ordnerB, kopien[0]), 'utf8') === '{ "zoomSlots": [ kaputt');
  ck('B4 T90: einstellungsLage nennt die Sicherungskopie', s.einstellungsLage().gesichert === kopien[0]);
  ck('B4 0.17: … die neue Datei ist lesbar und trägt den neuen Wert', (JSON.parse(readFileSync(dateiB, 'utf8')) as { zoomVorschau?: unknown }).zoomVorschau === false);
  s.setzeZoomVorschau(true);
  ck('B4 0.17: ein weiteres Schreiben legt keine zweite Kopie an, der Name bleibt', readdirSync(ordnerB).length === 2 && s.einstellungsLage().gesichert === kopien[0]);
  const ordnerC = mkdtempSync(join(tmpdir(), 'jmc-slots-null-'));
  writeFileSync(join(ordnerC, 'connect-settings.json'), 'null');
  g.__mock.userData = ordnerC;
  ck('B4 0.17: gültiges JSON, das kein Objekt ist (null), zählt als unlesbar und wird gesichert',
    s.zoomSlots().length === 0 && s.setzeZoomVorschau(false) && readdirSync(ordnerC).some((n) => n.startsWith('connect-settings.unlesbar-')));
  ck('B4 sicherungsName: Ortszeit JJJJMMTT-hhmmss', e.sicherungsName(new Date(2026, 9, 20, 7, 5, 9), () => false) === 'connect-settings.unlesbar-20261020-070509.json');
  ck('B4 sicherungsName: vergeben → „-2“, „-3“', e.sicherungsName(new Date(2026, 9, 20, 7, 5, 9), (n) => !n.endsWith('-3.json')) === 'connect-settings.unlesbar-20261020-070509-3.json');
  g.__mock.userData = wurzel;
}

// ── Nachtrag B zu Plan B: T92 aus settings.ts abgeleitet (NB9), NDI-Name nur aus Leerraum (NB5) ──
{
  const e = await import('../src/main/zoom/einstellungen');
  const ordner = mkdtempSync(join(tmpdir(), 'jmc-nb9-'));
  const V = { aufloesung: '720p', tonAn: true } as const;
  g.__mock.userData = ordner;
  ck('NB9: alles gespeichert → einstellungsLage().nurSitzung false', s.setzeZoomSlotVorgaben(V) && s.einstellungsLage().nurSitzung === false);
  g.__mock.userData = kaputt;
  ck('NB9: Vorgaben nicht schreibbar → nurSitzung true (T92)', s.setzeZoomSlotVorgaben({ aufloesung: '360p', tonAn: false }) === false
    && s.einstellungsLage().nurSitzung === true);
  g.__mock.userData = ordner;
  ck('NB9: ein späteres erfolgreiches setzeZoomSlots hebt T92 nicht auf, solange die Vorgaben nur in der Sitzung gelten',
    s.setzeZoomSlots([]) === true && s.einstellungsLage().nurSitzung === true);
  ck('NB9: erst das erfolgreiche Schreiben der Vorgaben hebt T92 auf', s.setzeZoomSlotVorgaben(V) === true && s.einstellungsLage().nurSitzung === false);
  const setter: Array<[string, () => boolean]> = [
    ['Slots', () => s.setzeZoomSlots([])], ['Vorgaben', () => s.setzeZoomSlotVorgaben(V)],
    ['Sprecher', () => s.setzeZoomSprecher({ signal: 'sprecherVideo', haltezeitMs: 1000 })], ['Vorschau', () => s.setzeZoomVorschau(true)],
    ['Zustimmung über 5', () => s.setzeZoomSlotsUeber5(false)],
  ];
  const lauf = setter.map(([name, setze]) => {
    g.__mock.userData = kaputt;
    const gescheitert = setze() === false && s.einstellungsLage().nurSitzung;
    g.__mock.userData = ordner;
    const gespeichert = setze() === true && !s.einstellungsLage().nurSitzung;
    return gescheitert && gespeichert ? '' : `${name} `;
  }).join('');
  ck(`NB9: jedes der fünf Slot-Felder setzt T92 beim Scheitern und hebt es beim Speichern auf${lauf ? ` (abweichend: ${lauf})` : ''}`, lauf === '');
  const basis = e.neuerSlot(1, V, []);
  ck('NB5: normiereSlot verwirft einen gespeicherten NDI-Namen nur aus Leerraum wie einen leeren',
    e.normiereSlot({ ...basis, ndiName: '   ' }) === null && e.normiereSlot({ ...basis, ndiName: '   ' }) === null
    && e.normiereSlots([{ ...basis, ndiName: '   ' }]).verworfen === 1);
  ck('NB5: … Leerraum am Rand bleibt erlaubt und unverändert (W4)', e.normiereSlot({ ...basis, ndiName: ' Bühne ' })?.ndiName === ' Bühne ');
  g.__mock.userData = wurzel;
}

// ── #290: letztes Meeting merken (Nummer + verschlüsselter Kenncode) ──
{
  const e = await import('../src/main/zoom/einstellungen');
  const ordner = mkdtempSync(join(tmpdir(), 'jmc-290-'));
  const dat = join(ordner, 'connect-settings.json');
  const inhalt = (): string => readFileSync(dat, 'utf8');
  g.__mock.userData = ordner;
  g.__mock.verschluesselung = true;

  ck('290: gueltigeLetzteNummer: getrimmt 1–64, sonst null',
    e.gueltigeLetzteNummer(' 123 456 ') === '123 456' && e.gueltigeLetzteNummer('') === null && e.gueltigeLetzteNummer('   ') === null
      && e.gueltigeLetzteNummer(5) === null && e.gueltigeLetzteNummer(undefined) === null
      && e.gueltigeLetzteNummer('1'.repeat(64)) === '1'.repeat(64) && e.gueltigeLetzteNummer('1'.repeat(65)) === null);
  ck('290: ohne Datei → null', s.zoomLetztesMeeting() === null);

  ck('290: merken mit Schlüsselbund → kenncodeGespeichert true', s.zoomMeetingMerken(' 123 456 7890 ', 'Geheim-Kenncode').kenncodeGespeichert === true);
  const m = s.zoomLetztesMeeting();
  ck('290: … lesen: Nummer getrimmt, Kenncode entschlüsselt', m?.nummer === '123 456 7890' && m.kenncode === 'Geheim-Kenncode');
  ck('290: … Datei enthält KEINEN Klartext-Kenncode, aber zoomLetzterKenncodeEnc', !inhalt().includes('Geheim-Kenncode') && inhalt().includes('zoomLetzterKenncodeEnc'));

  g.__mock.verschluesselung = false;
  ck('290: ohne Schlüsselbund → kenncodeGespeichert false', s.zoomMeetingMerken('555 666', 'Anderer-Code').kenncodeGespeichert === false);
  ck('290: … Nummer da, kein zoomLetzterKenncodeEnc, kein Klartext', inhalt().includes('555 666') && !inhalt().includes('zoomLetzterKenncodeEnc') && !inhalt().includes('Anderer-Code'));
  ck('290: … lesen: Nummer, Kenncode null', s.zoomLetztesMeeting()?.nummer === '555 666' && s.zoomLetztesMeeting()?.kenncode === null);

  g.__mock.verschluesselung = true;
  s.zoomMeetingMerken('111 222', 'Code-1');
  ck('290: leerer Kenncode → Feld gelöscht, Nummer bleibt, false',
    s.zoomMeetingMerken('111 222', '').kenncodeGespeichert === false && !inhalt().includes('zoomLetzterKenncodeEnc') && s.zoomLetztesMeeting()?.kenncode === null);

  s.zoomMeetingMerken('111 222', 'Code-2');
  g.__mock.verschluesselung = false;
  ck('290: ohne Schlüsselbund lesen → Kenncode null, Nummer da', s.zoomLetztesMeeting()?.nummer === '111 222' && s.zoomLetztesMeeting()?.kenncode === null);
  g.__mock.verschluesselung = true;

  s.zoomMeetingVergessen();
  ck('290: vergessen → beide Felder weg, lesen null', !inhalt().includes('zoomLetzteNummer') && !inhalt().includes('zoomLetzterKenncodeEnc') && s.zoomLetztesMeeting() === null);

  // Schreibfehler: still, nie werfen
  s.zoomMeetingMerken('777 888', 'Code-3');
  g.__mock.userData = kaputt;
  let geworfen = false, rueck: { kenncodeGespeichert: boolean } | undefined;
  try { rueck = s.zoomMeetingMerken('999', 'Code-4'); s.zoomMeetingVergessen(); } catch { geworfen = true; }
  ck('290: Schreibfehler → nie werfen, kenncodeGespeichert false', !geworfen && rueck?.kenncodeGespeichert === false);

  // unlesbare Datei → null
  const ordnerK = mkdtempSync(join(tmpdir(), 'jmc-290-kaputt-'));
  writeFileSync(join(ordnerK, 'connect-settings.json'), '{ kaputt');
  g.__mock.userData = ordnerK;
  ck('290: unlesbare Datei → null', s.zoomLetztesMeeting() === null);

  // Enc ohne Nummer → null
  const ordnerE = mkdtempSync(join(tmpdir(), 'jmc-290-enc-'));
  writeFileSync(join(ordnerE, 'connect-settings.json'), JSON.stringify({ zoomLetzterKenncodeEnc: Buffer.from('E:x').toString('base64') }));
  g.__mock.userData = ordnerE;
  ck('290: Kenncode ohne Nummer → null', s.zoomLetztesMeeting() === null);
  g.__mock.userData = wurzel;
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
