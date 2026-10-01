import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { abschnitt, gleich, pruefe, tempOrdner, warte } from './helfer';
import { erzeugeTestZertifikat } from './zertifikate';
import { musterDatei } from './muster';
import {
  DateiBeobachter, leseMasterLinkDatei, masterLinkPfad, pruefeMasterLinkDatei, schreibeAtomar,
  schreibeMasterLinkDatei, verbindungsrelevantGeaendert,
} from '../src/datei';

export async function laufe(): Promise<void> {
  const z = erzeugeTestZertifikat();
  const gut = musterDatei(z.cert);

  abschnitt('Datei: Pfad und Prüfung (Spec 7.1)');
  gleich(masterLinkPfad('C:/AppData'), join('C:/AppData', 'JM Production Suite', 'master-link.json'), 'Pfad unter dem Suite-Ordner');
  gleich(pruefeMasterLinkDatei(JSON.parse(JSON.stringify(gut))), { ok: true, datei: gut }, 'gültige Datei → ok');
  gleich(pruefeMasterLinkDatei({ ...gut, version: 2 }).ok, false, 'falsche Version → defekt');
  gleich(pruefeMasterLinkDatei({ ...gut, rolle: 'chef' }).ok, false, 'unbekannte Rolle → defekt');
  const ohneZert = JSON.parse(JSON.stringify(gut));
  delete ohneZert.kopplung.zertifikat;
  gleich(pruefeMasterLinkDatei(ohneZert).ok, false, 'Kopplung ohne Zertifikat → defekt');
  gleich(pruefeMasterLinkDatei({ ...gut, kopplung: { ...gut.kopplung!, fingerprint: '00'.repeat(32) } }).ok, false, 'Fingerprint ≠ Zertifikat → defekt');
  // GEMESSEN: bestand „nicht leer“, dann warf signiereAnmeldung im Handler — jedes Tool stürzte ab (Spec 7.3).
  // Nur den Grund vergleichen: die FAIL-Zeile nennt dann den Grund statt der ganzen Datei.
  const grund = (p: ReturnType<typeof pruefeMasterLinkDatei>): string => (p.ok ? 'ok' : p.grund);
  const paar = gut.kopplung!.schluessel;
  gleich(grund(pruefeMasterLinkDatei({ ...gut, kopplung: { ...gut.kopplung!, schluessel: { ...paar, privat: 'AAAA' } } })),
    'schluessel unbrauchbar', 'privater Schlüssel nicht als Ed25519 ladbar → defekt');
  gleich(grund(pruefeMasterLinkDatei({ ...gut, kopplung: { ...gut.kopplung!, schluessel: { ...paar, oeffentlich: 'P' } } })),
    'schluessel unbrauchbar', 'öffentlicher Schlüssel kein Ed25519 → defekt');
  const mitExtra = pruefeMasterLinkDatei({ ...gut, zukunft: 1, kopplung: { ...gut.kopplung!, festeAdresse: '  ', port: 99999 } });
  pruefe(mitExtra.ok && !('zukunft' in mitExtra.datei), 'unbekannte Felder werden verworfen, kein Defekt');
  pruefe(mitExtra.ok && mitExtra.datei.kopplung!.festeAdresse === null, 'leere feste Adresse → null');
  pruefe(mitExtra.ok && mitExtra.datei.kopplung!.port === 8738, 'ungültiger Port → 8738');
  gleich(pruefeMasterLinkDatei({ ...gut, rolle: 'aus', kopplung: null }).ok, true, 'Rolle aus ohne Kopplung ist gültig');

  abschnitt('Datei: Lesen und atomar Schreiben');
  const ordner = tempOrdner();
  const pfad = masterLinkPfad(ordner);
  gleich(leseMasterLinkDatei(pfad), { art: 'fehlt' }, 'fehlende Datei → fehlt');
  schreibeMasterLinkDatei(pfad, gut);
  gleich(leseMasterLinkDatei(pfad), { art: 'ok', wert: gut }, 'geschrieben und gelesen');
  gleich(readdirSync(join(ordner, 'JM Production Suite')), ['master-link.json'], 'keine .tmp-Reste');
  pruefe(readFileSync(pfad, 'utf8').endsWith('\n'), 'Datei endet mit Zeilenumbruch');
  writeFileSync(pfad, '{"version":1,');
  gleich(leseMasterLinkDatei(pfad).art, 'defekt', 'abgeschnittenes JSON → defekt');
  schreibeAtomar(pfad, 'hallo');
  gleich(readFileSync(pfad, 'utf8'), 'hallo', 'schreibeAtomar ersetzt vorhandene Datei');
  let versuche = 0;
  schreibeAtomar(pfad, 'nach EBUSY', (von, nach) => {
    versuche++;
    if (versuche < 3) throw Object.assign(new Error('belegt'), { code: 'EBUSY' });
    renameSync(von, nach);
  });
  pruefe(versuche === 3 && readFileSync(pfad, 'utf8') === 'nach EBUSY', 'rename bei EBUSY wiederholt (Virenscanner), dann geschrieben');
  let geworfen = '';
  try {
    schreibeAtomar(pfad, 'nie', () => { throw Object.assign(new Error('gesperrt'), { code: 'EACCES' }); });
  } catch (e) { geworfen = (e as NodeJS.ErrnoException).code ?? ''; }
  gleich(geworfen, 'EACCES', 'nach 2 s ohne Erfolg: Fehler weitergeben');
  gleich(readdirSync(join(ordner, 'JM Production Suite')), ['master-link.json'], 'auch dann keine .tmp-Reste');
  let fremd = '';
  let fremdVersuche = 0;
  try {
    schreibeAtomar(pfad, 'nie', () => { fremdVersuche++; throw Object.assign(new Error('weg'), { code: 'ENOSPC' }); });
  } catch (e) { fremd = (e as NodeJS.ErrnoException).code ?? ''; }
  gleich([fremd, fremdVersuche], ['ENOSPC', 1], 'andere Fehler sofort weitergeben (genau ein Versuch, keine Wiederholung)');

  abschnitt('Datei: verbindungsrelevante Felder');
  const k = gut.kopplung!;
  pruefe(!verbindungsrelevantGeaendert(gut, { ...gut, kopplung: { ...k, adressen: ['10.0.0.9'] } }), 'Adressen → keine Trennung');
  pruefe(!verbindungsrelevantGeaendert(gut, { ...gut, kopplung: { ...k, letzteAdresse: '10.0.0.9' } }), 'letzte Adresse → keine Trennung');
  pruefe(!verbindungsrelevantGeaendert(gut, { ...gut, kopplung: { ...k, masterName: 'Neu' } }), 'Master-Name → keine Trennung');
  pruefe(verbindungsrelevantGeaendert(gut, { ...gut, kopplung: { ...k, schluessel: { ...k.schluessel, privat: 'x' } } }), 'Schlüssel → Neuaufbau');
  pruefe(verbindungsrelevantGeaendert(gut, { ...gut, rolle: 'aus' }), 'Rolle → Neuaufbau');
  pruefe(verbindungsrelevantGeaendert(gut, { ...gut, netzwerk: { karte: 'Ethernet 2' } }), 'Karte → Neuaufbau');
  pruefe(verbindungsrelevantGeaendert(gut, { ...gut, kopplung: { ...k, festeAdresse: '10.1.1.1' } }), 'feste Adresse → Neuaufbau');
  pruefe(verbindungsrelevantGeaendert(gut, null), 'Datei weg → Neuaufbau');

  abschnitt('Datei: Beobachter (zwei Fehllesungen, Spec 7.3)');
  const o2 = tempOrdner();
  const p2 = masterLinkPfad(o2);
  const b = new DateiBeobachter(p2);
  gleich(b.pruefe(), { art: 'geaendert', datei: null, relevant: true }, 'erster Blick ohne Datei → geändert (null)');
  gleich(b.pruefe(), { art: 'unveraendert' }, 'nichts passiert → unverändert');
  schreibeMasterLinkDatei(p2, gut);
  gleich(b.pruefe(), { art: 'geaendert', datei: gut, relevant: true }, 'Datei erscheint → relevant');
  await warte(20);
  const nurAdressen = { ...gut, kopplung: { ...k, adressen: ['10.0.0.9'] } };
  schreibeMasterLinkDatei(p2, nurAdressen);
  gleich(b.pruefe(), { art: 'geaendert', datei: nurAdressen, relevant: false }, 'nur Adressen → geändert, nicht relevant');
  await warte(20);
  writeFileSync(p2, 'Müll');
  gleich(b.pruefe(), { art: 'unveraendert' }, '1. Fehllesung → alter Stand bleibt');
  gleich(b.aktuell(), nurAdressen, 'aktuell() liefert den letzten gültigen Stand');
  gleich(b.pruefe(), { art: 'defekt' }, '2. Fehllesung in Folge → defekt');
  await warte(20);
  schreibeMasterLinkDatei(p2, nurAdressen);
  gleich(b.pruefe(), { art: 'geaendert', datei: nurAdressen, relevant: true }, 'reparierte Datei (gleicher Inhalt) → relevant, Neuaufbau');
  rmSync(p2);
  gleich(b.pruefe(), { art: 'geaendert', datei: null, relevant: true }, 'Datei im Betrieb gelöscht → null, relevant (Review Focus 3)');

  abschnitt('Datei: I/O-Fehler sind vorübergehend (Spec 7.3)');
  // Ordner statt Datei: statSync klappt, Lesen wirft EISDIR — ein I/O-Fehler wie EBUSY/EPERM vom Virenscanner,
  // KEIN Defekt. Feste mtime in ganzen Sekunden, damit „gleiche mtime“ prüfbar ist.
  const p3 = masterLinkPfad(tempOrdner());
  mkdirSync(p3, { recursive: true });
  utimesSync(p3, 1_700_000_000, 1_700_000_000);
  gleich(leseMasterLinkDatei(p3).art, 'io', 'Ordner statt Datei → io (Vorbedingung)');
  const b3 = new DateiBeobachter(p3);
  gleich([b3.pruefe(), b3.pruefe(), b3.pruefe()].map((x) => x.art), ['unveraendert', 'unveraendert', 'unveraendert'],
    'I/O-Fehler schon beim ersten Lesen → nie „defekt“ (kein fehler:datei)');
  rmSync(p3, { recursive: true });
  schreibeMasterLinkDatei(p3, gut);
  utimesSync(p3, 1_700_000_000, 1_700_000_000);
  gleich(b3.pruefe(), { art: 'geaendert', datei: gut, relevant: true },
    'wieder lesbar bei gleicher mtime → gelesen (mtime erst nach erfolgreichem Lesen gemerkt)');
  rmSync(p3);
  mkdirSync(p3);
  gleich([b3.pruefe(), b3.pruefe(), b3.pruefe()].map((x) => x.art), ['unveraendert', 'unveraendert', 'unveraendert'],
    'I/O-Fehler im Betrieb → nie „defekt“');
  gleich(b3.aktuell(), gut, '… aktuell() liefert weiter den letzten gültigen Stand');
  // EBUSY/EPERM von statSync lassen sich im Test nicht erzeugen; ein NUL-Byte im Pfad liefert plattformunabhängig
  // einen statSync-Fehler außer ENOENT (ERR_INVALID_ARG_VALUE).
  const b4 = new DateiBeobachter(`${p3}\u0000`);
  gleich([b4.pruefe(), b4.pruefe(), b4.pruefe()].map((x) => x.art), ['unveraendert', 'unveraendert', 'unveraendert'],
    'statSync-Fehler außer ENOENT → vorübergehend, nie „defekt“');

  abschnitt('Datei: Beobachter loggt I/O- und stat-Fehler je Codewechsel einmal (Endprüfung A9)');
  {
    // Ein Tool mit dauerhaft unlesbarer master-link.json zeigte sonst stumm „aus“.
    const p5 = join(tempOrdner(), 'master-link.json');
    mkdirSync(p5); // Ordner statt Datei: Lesen wirft EISDIR (wie EBUSY vom Virenscanner)
    const zeilen: string[] = [];
    const b5 = new DateiBeobachter(p5, (t) => zeilen.push(t));
    b5.pruefe();
    b5.pruefe();
    b5.pruefe();
    gleich(zeilen.length, 1, `dreimal derselbe I/O-Fehler → genau eine Logzeile (${zeilen.join(' | ')})`);
    pruefe(zeilen[0]?.includes('EISDIR') === true && zeilen[0].includes('master-link.json'), '… mit Dateiname und Fehlercode (nie Inhalt)');
    rmSync(p5, { recursive: true });
    writeFileSync(p5, JSON.stringify(musterDatei(erzeugeTestZertifikat().cert)));
    gleich(b5.pruefe().art, 'geaendert', 'wieder lesbar → gelesen');
    gleich(zeilen.length, 1, '… ohne weitere Logzeile');
    rmSync(p5);
    mkdirSync(p5);
    b5.pruefe();
    gleich(zeilen.length, 2, 'derselbe Fehler nach einer Erholung → wieder eine Zeile');
    const zeilenStat: string[] = [];
    const b6 = new DateiBeobachter(`${p5}\u0000`, (t) => zeilenStat.push(t));
    b6.pruefe();
    b6.pruefe();
    gleich(zeilenStat.length, 1, `stat-Fehler (außer ENOENT) → genau eine Logzeile (${zeilenStat.join(' | ')})`);
  }
}
