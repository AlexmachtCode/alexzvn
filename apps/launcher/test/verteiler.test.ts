// Verteiler der Show-Daten am Master OHNE Electron (tsx): npm run selftest:verbund -w @jm/launcher
// Master-Link Teil 2b Release 2, Spec 13.1–13.4, 13.6, 15.1, 15.2, 15.6, 19.3 Nr. 1–9. Der Server ist nachgebaut: Er
// sammelt die Zeilen je Sitzung und antwortet je Sitzung mit 'gesendet', 'gestaut' oder 'weg'.
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { GRENZEN, pruefeStand, type SendeErgebnis, type StandInhalt, type TeilnehmerDaten } from '@jm/master-link';
import { migrateShow, type Show } from '@jm/show';
import { gedaechtnisSchluessel } from '../../rundown/src/main/gedaechtnis';
import { Verteiler, verbundSchluessel, type VerteilerServer } from '../src/main/verbund/verteiler';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

const PFAD = 'C:/Shows/COP31 Tag 1.jmshow';
const ANDERER_PFAD = 'C:/Shows/COP31 Tag 2.jmshow';

/** Nachgebauter Server: sammelt jede Zeile; `modus` gibt je Sitzung die Antwort vor (Vorgabe 'gesendet'). */
function nachgebauterServer() {
  const zeilen: Array<{ sitzung: number; zeile: string }> = [];
  const modus = new Map<number, SendeErgebnis>();
  const server: VerteilerServer = {
    sendeDaten(sitzung, zeile) {
      const m = modus.get(sitzung) ?? 'gesendet';
      if (m === 'gesendet') zeilen.push({ sitzung, zeile });
      return m;
    },
  };
  return { server, zeilen, modus };
}

/** Eine Zeile → { t, stand } mit geprüftem Inhalt (pruefeStand), wie das Tool sie liest. */
function lies(zeile: string): { t: string; s: StandInhalt | null; einzeilig: boolean } {
  const o = JSON.parse(zeile) as { t: string };
  const p = pruefeStand(o);
  return { t: o.t, s: p.ok ? p.wert : null, einzeilig: zeile.endsWith('\n') && zeile.indexOf('\n') === zeile.length - 1 };
}

function umgebung() {
  const log: string[] = [];
  let epochen = 0;
  let aenderungen = 0;
  const namen = new Map([['B-id', 'Regie-Laptop'], ['C-id', 'Studio-PC'], ['A-id', 'Regie-PC']]);
  const v = new Verteiler({
    log: (stufe, text) => { log.push(`${stufe}: ${text}`); },
    rechnerName: (id) => namen.get(id) ?? id,
    neueEpoche: () => `epoche-${++epochen}`,
    jetzt: () => Date.parse('2026-10-08T10:15:00.000Z'),
    beiAenderung: () => { aenderungen++; },
  });
  const s = nachgebauterServer();
  return { v, log, s, aenderungen: () => aenderungen };
}

function tn(sitzung: number, o: Partial<TeilnehmerDaten> = {}): TeilnehmerDaten {
  const rechnerId = o.rechnerId ?? 'B-id';
  const appId = o.appId ?? 'jm-timer';
  return { sitzung, schluessel: `${rechnerId}\u0000${appId}`, rechnerId, art: 'tool', appId, dieserRechner: false, ...o };
}
const ABO = { art: 'show' as const, fassung: 1 };

function show(name = 'COP31 Tag 1', extra: Partial<Show> = {}): Show {
  return migrateShow({
    schemaVersion: 1,
    name,
    updatedAt: '2026-10-08T09:00:00.000Z',
    tools: [
      { appId: 'jm-timer', settings: { durationMs: 300000 } },
      { appId: 'jm-recorder', settings: { dir: 'D:/Aufnahmen', fileName: 'tag1' } },
      { appId: 'jm-rundown', document: 'C:/Shows/Tag1.jmrundown' },
    ],
    ablauf: [{ id: 'a1', label: 'Begrüßung' }],
    iveo: { event: 'cop31', baseUrl: 'https://iveo.example/api/v1', name: 'COP31', speakers: [{ name: 'Ana Silva' }] },
    ...extra,
  });
}
const an = (zeilen: Array<{ sitzung: number; zeile: string }>, sitzung: number) => zeilen.filter((z) => z.sitzung === sitzung).map((z) => lies(z.zeile));

// --- Nr. 1: Abo → stand mit Epoche und Folge 0 bzw. dem aktuellen Stand -------------------------------------------
{
  const u = umgebung();
  u.v.meldeShow(PFAD, show());
  u.v.starte(u.s.server);
  u.v.aufAbo(tn(1), ABO);
  const [z] = an(u.s.zeilen, 1);
  ck('Nr. 1: Abo → genau eine Zeile „stand“, besteht pruefeStand, eine Zeile mit \\n',
    u.s.zeilen.length === 1 && z.t === 'stand' && z.s !== null && z.einzeilig);
  ck('Nr. 1: … Epoche des Verteilers, Folge 0, Fassung 1, Schlüssel der Show',
    z.s?.epoche === 'epoche-1' && z.s.folge === 0 && z.s.fassung === 1 && z.s.schluessel === verbundSchluessel(PFAD));
  ck('Nr. 1: … der Ausschnitt (ohne baseUrl, Dokument und rechnergebundene Settings), mitDokument',
    (z.s?.show as Show | null)?.name === 'COP31 Tag 1' && !JSON.stringify(z.s?.show).includes('baseUrl')
    && !JSON.stringify(z.s?.show).includes('Aufnahmen') && JSON.stringify(z.s?.mitDokument) === '["jm-rundown"]' && z.s?.grund === undefined);
  u.v.meldeShow(PFAD, show('Zwei'));
  u.v.meldeShow(PFAD, show('Drei'));
  u.v.meldeShow(PFAD, show('Vier'));
  u.v.aufAbo(tn(2, { appId: 'jm-titler' }), ABO);
  const [z2] = an(u.s.zeilen, 2);
  ck('Nr. 1: Abo nach drei Änderungen → stand mit dem aktuellen Stand (Folge 3)',
    z2.t === 'stand' && z2.s?.folge === 3 && (z2.s?.show as Show | null)?.name === 'Vier');
  u.v.aufAbo(tn(3, { appId: 'jm-rundown' }), { art: 'show', fassung: 2 });
  ck('13.1: Abo mit Fassung 2 → stand mit der höchsten bekannten Fassung (1)', an(u.s.zeilen, 3)[0]?.s?.fassung === 1);
}

// --- Nr. 2 und 3: gleiche Show → keine neue Folge; geänderte Show → Folge + 1, aenderung an alle, einmal serialisiert -
{
  const u = umgebung();
  u.v.starte(u.s.server);
  u.v.meldeShow(PFAD, show());
  u.v.aufAbo(tn(1), ABO);
  u.v.aufAbo(tn(2, { rechnerId: 'C-id', appId: 'jm-rundown' }), ABO);
  const vorher = u.s.zeilen.length;
  u.v.meldeShow(PFAD, show());
  ck('Nr. 2 (E9): gleiche Show noch einmal gemeldet → keine neue Folge, keine aenderung',
    u.s.zeilen.length === vorher && u.v.stand().folge === 1);
  u.v.meldeShow(PFAD, show('COP31 Tag 1 neu'));
  const neu = u.s.zeilen.slice(vorher);
  ck('Nr. 3: geänderte Show → Folge + 1, aenderung an beide Abos',
    neu.length === 2 && neu.every((z) => lies(z.zeile).t === 'aenderung' && lies(z.zeile).s?.folge === 2)
    && JSON.stringify(neu.map((z) => z.sitzung).sort()) === '[1,2]');
  ck('Nr. 3: … dieselbe Zeichenkette an alle (einmal serialisiert)', neu[0].zeile === neu[1].zeile);
  ck('Nr. 3: … das Modal wird neu gemeldet', u.aenderungen() > 0);
}

// --- Nr. 4: Ausschnitt über 921 600 Byte → zu-gross; gemessen in Bytes der fertigen Zeile (Review Focus 1) -------------
{
  const u = umgebung();
  u.v.starte(u.s.server);
  u.v.aufAbo(tn(1), ABO);
  // 470 000 × „ä“: unter 921 600 Zeichen, aber über 921 600 Byte (UTF-8 je 2 Byte).
  const gross = show('Groß', { ablauf: [{ id: 'a1', label: 'ä'.repeat(470_000) }] });
  u.v.meldeShow(PFAD, gross);
  const z = an(u.s.zeilen, 1).at(-1)!;
  ck('Nr. 4: zu groß in Bytes (nicht in Zeichen) → show null, grund zu-gross, Schlüssel und mitDokument bleiben',
    JSON.stringify(gross).length < GRENZEN.maxStandZeile && z.t === 'aenderung' && z.s?.show === null && z.s.grund === 'zu-gross'
    && z.s.schluessel === verbundSchluessel(PFAD) && JSON.stringify(z.s.mitDokument) === '["jm-rundown"]');
  const warnung = u.log.find((l) => l.startsWith('warn: Verbund: Show zu groß'));
  const kib = Number(/\((\d+) KiB > 900 KiB\)/.exec(warnung ?? '')?.[1]);
  ck(`Nr. 4: … Warnung wörtlich 15.6 mit KiB (${kib} KiB)`,
    /^warn: Verbund: Show zu groß für den Verbund \(\d+ KiB > 900 KiB\), nicht verteilt\.$/.test(warnung ?? '') && kib > 900 && kib < 1000);
  ck('Nr. 4: … das Modal kennt Name und Größe', u.v.stand().grund === 'zu-gross' && u.v.stand().showName === 'Groß' && u.v.stand().groesseKiB === kib);
  u.v.meldeShow(PFAD, show('Klein', { ablauf: [{ id: 'a1', label: 'a'.repeat(470_000) }] }));
  const z2 = an(u.s.zeilen, 1).at(-1)!;
  ck('Nr. 4: Gegenprobe: 470 000 × „a“ (1 Byte) wird verteilt', z2.s?.show !== null && z2.s?.grund === undefined && z2.s?.folge === 2);
}

// --- Nr. 5: neue Epoche bei Neustart der Rolle; meldeShow vor starte() gemerkt; ohne Show keine-show ------------------
{
  const u = umgebung();
  u.v.starte(u.s.server);
  u.v.aufAbo(tn(1), ABO);
  const z = an(u.s.zeilen, 1)[0];
  ck('Nr. 5: ohne Show → stand mit show null, grund keine-show, schluessel null, mitDokument []',
    z.s?.show === null && z.s.grund === 'keine-show' && z.s.schluessel === null && z.s.mitDokument.length === 0);
  u.v.stoppe();
  u.v.meldeShow(PFAD, show());
  const nachStopp = u.s.zeilen.length;
  u.v.aufAbo(tn(1), ABO);
  ck('Nr. 5: nach stoppe() geht nichts mehr hinaus, auch nicht auf ein Abo', u.s.zeilen.length === nachStopp && !u.v.hatAbo(1));
  u.v.starte(u.s.server);
  u.v.aufAbo(tn(7), ABO);
  const z2 = an(u.s.zeilen, 7)[0];
  ck('Nr. 5: neuer Start → neue Epoche, Folge 0, die vorher gemeldete Show wird verteilt',
    z2.s?.epoche === 'epoche-2' && z2.s.folge === 0 && (z2.s.show as Show | null)?.name === 'COP31 Tag 1');
  ck('Nr. 5: … die Abos der alten Epoche sind weg', !u.v.hatAbo(1) && u.v.hatAbo(7));
}

// --- Nr. 6: launcher-Abo ignoriert; das 33. Abo eines Rechners; wiederholtes Abo -----------------------------------
{
  const u = umgebung();
  u.v.starte(u.s.server);
  u.v.meldeShow(PFAD, show());
  u.v.aufAbo(tn(1, { art: 'launcher', appId: 'jm-launcher' }), ABO);
  u.v.aufAbo(tn(1, { art: 'launcher', appId: 'jm-launcher' }), ABO);
  ck('Nr. 6: Abo eines Launchers → nichts gesendet, kein Abo, eine Logzeile (E13)',
    u.s.zeilen.length === 0 && !u.v.hatAbo(1)
    && u.log.filter((l) => l === 'info: Verbund: Abo von Regie-Laptop/jm-launcher ignoriert, ein Launcher braucht keine Show-Daten.').length === 1);
  for (let i = 10; i < 10 + GRENZEN.maxAbosJeRechner; i++) u.v.aufAbo(tn(i, { appId: `jm-tool-${i}` }), ABO);
  ck('Nr. 6: 32 Abos von Rechner B → 32 Antworten', u.s.zeilen.length === 32 && u.v.stand().abos.length === 32);
  u.v.aufAbo(tn(99, { appId: 'jm-timer' }), ABO);
  u.v.aufAbo(tn(98, { appId: 'jm-titler' }), ABO);
  ck('Nr. 6: das 33. und 34. Abo desselben Rechners → unbeantwortet, eine Warnung je Rechner',
    u.s.zeilen.length === 32 && !u.v.hatAbo(99)
    && u.log.filter((l) => l === 'warn: Verbund: Regie-Laptop hat 32 Abos, weitere werden nicht beantwortet.').length === 1);
  u.v.aufAbo(tn(200, { rechnerId: 'C-id', appId: 'jm-timer' }), ABO);
  ck('Nr. 6: ein anderer Rechner wird weiter beantwortet', u.s.zeilen.length === 33 && u.v.hatAbo(200));
  u.v.aufGetrennt(10);
  u.v.aufAbo(tn(99, { appId: 'jm-timer' }), ABO);
  ck('Nr. 6: nach dem Ende eines Abos wird ein wiederholtes Abo beantwortet', u.v.hatAbo(99) && an(u.s.zeilen, 99).length === 1);
  u.v.aufAbo(tn(99, { appId: 'jm-timer' }), ABO);
  ck('Nr. 6: zweites Abo derselben Sitzung → erneut stand mit dem aktuellen Stand, kein zweites Abo',
    an(u.s.zeilen, 99).length === 2 && an(u.s.zeilen, 99)[1].t === 'stand' && u.v.stand().abos.length === 33);
  ck('Nr. 6: neues Abo: Logzeile wörtlich 15.6', u.log.includes('info: Verbund: Abo von Studio-PC/jm-timer (33 Abos).'));
}

// --- Nr. 7: gestaut → nach entstaut nur der neueste Stand ----------------------------------------------------------
{
  const u = umgebung();
  u.v.starte(u.s.server);
  u.v.meldeShow(PFAD, show());
  u.s.modus.set(5, 'gestaut');
  u.v.aufAbo(tn(5), ABO);
  ck('Nr. 7: Stau beim stand → nichts geschrieben, eine Logzeile wörtlich 15.6',
    u.s.zeilen.length === 0 && u.log.includes('warn: Verbund: Sendung an Regie-Laptop/jm-timer gestaut, der neueste Stand folgt danach.'));
  u.v.meldeShow(PFAD, show('Zwei'));
  u.v.meldeShow(PFAD, show('Drei'));
  ck('Nr. 7: … weitere Stände gehen an eine gestaute Sitzung nicht hinaus, keine zweite Stau-Zeile',
    u.s.zeilen.length === 0 && u.log.filter((l) => l.includes('gestaut')).length === 1);
  u.s.modus.delete(5);
  u.v.aufEntstaut(5);
  const nach = an(u.s.zeilen, 5);
  ck('Nr. 7: entstaut → genau eine Zeile, aenderung mit dem neuesten Stand (Folge 3)',
    nach.length === 1 && nach[0].t === 'aenderung' && nach[0].s?.folge === 3 && (nach[0].s?.show as Show | null)?.name === 'Drei');
  u.v.aufEntstaut(5);
  ck('Nr. 7: noch einmal entstaut, nichts Neueres → nichts', an(u.s.zeilen, 5).length === 1);
  u.s.modus.set(5, 'weg');
  u.v.meldeShow(PFAD, show('Vier'));
  ck('Nr. 7: Antwort weg → das Abo ist entfernt', !u.v.hatAbo(5));
}

// --- Nr. 8: Kein Token in einer gesendeten Zeile (Spec 22) ---------------------------------------------------------
{
  const TOKEN = 'iveo_live_geheimes_token_4711';
  const PIN = 'PIN-geheim-0815';
  // Nachgebauter Token-Speicher des Launchers (settings.ts braucht Electron und wird hier nie geladen).
  const tokenSpeicher = new Map<string, string>([['cop31', TOKEN]]);
  const u = umgebung();
  u.v.starte(u.s.server);
  u.v.aufAbo(tn(1), ABO);
  u.v.meldeShow(PFAD, migrateShow({
    schemaVersion: 1,
    name: 'Mit Geheimnissen',
    tools: [
      { appId: 'jm-presenter', settings: { pin: PIN } },
      { appId: 'jm-timer', settings: { durationMs: 1000, zugang: tokenSpeicher.get('cop31') } },
    ],
    iveo: { event: 'cop31', baseUrl: `https://iveo.example/api/v1?token=${tokenSpeicher.get('cop31')}`, name: 'COP31' },
  }));
  u.v.aufAbo(tn(1), ABO);
  const alle = u.s.zeilen.map((z) => z.zeile).join('');
  ck('Nr. 8: Token (Speicher, unbekanntes Setting, baseUrl) und Presenter-PIN stehen in keiner gesendeten Zeile',
    u.s.zeilen.length === 3 && !alle.includes(TOKEN) && !alle.includes(PIN) && alle.includes('Mit Geheimnissen'));
  ck('Nr. 8: … und in keiner Logzeile', !u.log.join('\n').includes(TOKEN) && !u.log.join('\n').includes(PIN));
}

// --- Nr. 9: Abos hängen an der Sitzung, nicht am Teilnehmer-Schlüssel ----------------------------------------------
{
  const u = umgebung();
  u.v.starte(u.s.server);
  u.v.meldeShow(PFAD, show());
  u.v.aufAbo(tn(1), ABO);
  u.v.aufAbo(tn(2), ABO); // dasselbe Tool (gleicher Schlüssel) hat sich schnell neu angemeldet
  u.v.aufGetrennt(1); // das späte Ende der ersetzten Sitzung
  u.v.meldeShow(PFAD, show('Neu'));
  ck('Nr. 9: getrennt der ersetzten Sitzung löscht nicht das Abo der neuen; die aenderung kommt dort an',
    u.v.hatAbo(2) && !u.v.hatAbo(1) && an(u.s.zeilen, 2).at(-1)?.t === 'aenderung' && an(u.s.zeilen, 1).length === 1);
}

// --- Weitere Regeln aus 13.1, 15.1, 15.6 ----------------------------------------------------------------------------
{
  const u = umgebung();
  u.v.starte(u.s.server);
  u.v.meldeShow(PFAD, show());
  ck('15.6: neuer Stand → Logzeile wörtlich mit „Lokal geblieben“',
    /^info: Verbund: Show „COP31 Tag 1“ verteilt \(Stand 1, \d+ KiB, 0 Abos\)\. Lokal geblieben: jm-recorder\.dir\.$/.test(u.log.at(-1) ?? ''));
  u.v.aufAbo(tn(1), ABO);
  u.v.meldeShow(PFAD, migrateShow({ schemaVersion: 1, name: 'Schlicht', tools: [] }));
  ck('15.6: … ohne lokale Einstellungen „Lokal geblieben: nichts.“, k = Zahl der Abos',
    /^info: Verbund: Show „Schlicht“ verteilt \(Stand 2, 1 KiB, 1 Abos\)\. Lokal geblieben: nichts\.$/.test(u.log.at(-1) ?? ''));
  u.v.meldeShow(PFAD, null);
  const z = an(u.s.zeilen, 1).at(-1)!;
  ck('15.1: gespeicherte Show nicht lesbar → grund nicht-lesbar, Schlüssel der offenen Show, mitDokument []',
    z.t === 'aenderung' && z.s?.show === null && z.s.grund === 'nicht-lesbar' && z.s.schluessel === verbundSchluessel(PFAD) && z.s.mitDokument.length === 0);
  ck('15.6: … Logzeile wörtlich mit dem Dateinamen; das Modal kennt ihn',
    u.log.at(-1) === 'warn: Verbund: Show „COP31 Tag 1.jmshow“ nicht lesbar, nicht verteilt.' && u.v.stand().dateiName === 'COP31 Tag 1.jmshow');
  u.v.meldeShow(ANDERER_PFAD, show());
  const z2 = an(u.s.zeilen, 1).at(-1)!;
  ck('13.1: andere Datei mit gleichem Inhalt → anderer Schlüssel, neuer Stand', z2.s?.schluessel === verbundSchluessel(ANDERER_PFAD) && z2.s.folge === 4);
  ck('Stand fürs Modal: Name, Zeit, Folge, Epoche, Abos',
    JSON.stringify(u.v.stand()) === JSON.stringify({
      grund: null, showName: 'COP31 Tag 1', dateiName: 'COP31 Tag 2.jmshow', verteiltAm: Date.parse('2026-10-08T10:15:00.000Z'),
      groesseKiB: 1, epoche: 'epoche-1', folge: 4, abos: [{ sitzung: 1, rechnerId: 'B-id', appId: 'jm-timer' }],
    }));
}
{
  const u = umgebung();
  u.v.starte(u.s.server);
  u.v.aufAbo(tn(1, { rechnerId: 'A-id', dieserRechner: true }), ABO);
  u.v.aufAbo(tn(2), ABO);
  u.v.aufAbo(tn(3, { rechnerId: 'C-id' }), ABO);
  ck('E29: ein Abo von diesem Rechner wird bedient wie jedes andere', an(u.s.zeilen, 1).length === 1 && u.v.hatAbo(1));
  ck('abosAndererRechner zählt nur Abos fremder Rechner', u.v.abosAndererRechner() === 2);
  u.v.stoppe();
  ck('stoppe → keine Abos mehr, Stand leer', u.v.abosAndererRechner() === 0 && u.v.stand().epoche === null && u.v.stand().abos.length === 0);
}
{
  const roh = 'C:\\Shows\\..\\Shows\\Gala.JMSHOW';
  ck('verbundSchluessel = Gedächtnis-Schlüssel des Rundowns für denselben Pfad (2a-Spec 4.7), 16 Hex',
    verbundSchluessel(roh) === gedaechtnisSchluessel(roh) && /^[0-9a-f]{16}$/.test(verbundSchluessel(roh)));
  ck('verbundSchluessel: Formel sha256(resolve(p).toLowerCase())',
    verbundSchluessel('C:/Shows/Gala.jmshow') === createHash('sha256').update(resolve('C:/Shows/Gala.jmshow').toLowerCase()).digest('hex').slice(0, 16));
  ck('verbundSchluessel: aufloesen ist einsetzbar', verbundSchluessel('x', (p) => `/fest/${p}`) === createHash('sha256').update('/fest/x').digest('hex').slice(0, 16));
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
