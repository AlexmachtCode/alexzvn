// Side-Event-Ordner OHNE Electron (tsx): npm run selftest:iveo -w @jm/launcher
// iveo-Paket Teil E (Spec 9.1–9.15, 12.4): die reinen Regeln (Namen und Pfade 9.12, Links 9.7, Panel 8.6, Fehlertexte
// 9.13, Index 9.8, Ablage-Menge 9.3, Sperre 9.2, Rückhaltung 9.6, Auffrischregel 6.1); ab Task 12 Plan und Lauf.
import { createHash } from 'node:crypto';
import { join, parse } from 'node:path';
import {
  bereinigeName, freierName, GESPERRTE_ENDUNGEN, imOrdner, MIME_EXT, ordnerPfad, vergleichsform, zwischenKennung, type PfadErgebnis,
} from '../src/main/side-event-ordner';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

const WURZEL = parse(process.cwd()).root;
/** Ordnerpfad mit genau n UTF-16-Einheiten (Längentests gleich unter Windows und POSIX). */
const ordnerMitLaenge = (n: number): string => WURZEL + 'o'.repeat(n - WURZEL.length);
const nameVon = (r: PfadErgebnis): string | null => (r.ok ? r.name : null);
const ohneEinzelSurrogat = (s: string): boolean => !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);
const cp = (s: string): number => Array.from(s).length;
const ZEIT = new Date(2026, 9, 16, 10, 30, 15);

console.log('— P8 · Namen nach 9.12 Regeln 1–8 (12.4 Nr. 1)');
{
  const tabelle: Array<[string, string, string]> = [
    ['CON', 'CON', '_CON'],
    ['con.txt', 'con.txt', '_con.txt'],
    ['CON .pdf', 'CON .pdf', '_CON .pdf'],
    ['nul  .txt', 'nul  .txt', '_nul .txt'],
    ['CONIN$', 'CONIN$', '_CONIN$'],
    ['COM¹', 'COM¹', '_COM¹'],
    ['LPT9.pdf', 'LPT9.pdf', '_LPT9.pdf'],
    ['Präsentation.', 'Präsentation.', 'Präsentation'],
    ['Präsentation  ', 'Präsentation  ', 'Präsentation'],
    ['.versteckt', '.versteckt', '_.versteckt'],
    ['..', '..', 'Anhang'],
    ['../x', '../x', '_.._x'],
    ['a/b', 'a/b', 'a_b'],
    ['a\\b', 'a\\b', 'a_b'],
    ['a:b', 'a:b', 'a_b'],
    ['a*?"<>|b', 'a*?"<>|b', 'a______b'],
    ['Steuerzeichen U+0001, U+001F, U+007F, Tab', 'a\u0001b\u001fc\u007fd\te', 'a_b_c_d_e'],
    ['U+0085 (C1)', 'a\u0085b', 'a_b'],
    ['U+200B (Cf)', 'a​b', 'a_b'],
    ['Slides‹U+202E›txt.exe (Bidi, Cf)', 'Slides‮txt.exe', 'Slides_txt.exe'],
    ['NFD-Eingabe', 'Präsentation', 'Präsentation'],
    ['Leerraumfolge innen', 'Side   Event  Klima', 'Side Event Klima'],
    ['leer', '', 'Anhang'],
    ['nur Leerzeichen und Punkte', ' . . ', 'Anhang'],
    ['entfernt', 'entfernt', 'entfernt'],
  ];
  for (const [titel, roh, soll] of tabelle) {
    const ist = bereinigeName(roh, 'Anhang');
    ck(`P8 12.4 Nr. 1: ${titel} → ${soll}`, ist === soll && bereinigeName(ist, 'Anhang') === ist);
  }
  ck('P8 9.12 Regel 8: leer beim Side-Event-Ordner → „Side Event“', bereinigeName('', 'Side Event') === 'Side Event');
  ck('P8 9.12 Regel 1: Ergebnis ist NFC', bereinigeName('Präsentation', 'Anhang') === 'Präsentation'.normalize('NFC'));
}
{
  const label = `${'a'.repeat(110)}😀${'b'.repeat(189)}`;
  const ohneBudget = ordnerPfad({ art: 'datei', seitenOrdner: null, label, kind: 'file', mime: 'application/pdf' });
  ck('P8 12.4 Nr. 1: 300 Zeichen mit Emoji an der Schnittstelle (Codepunkte) → Emoji ganz, Name samt „ (99)“ ≤ 120 Codepunkte',
    nameVon(ohneBudget) === `${'a'.repeat(110)}😀.pdf` && cp(`${nameVon(ohneBudget)} (99)`) <= 120 && ohneEinzelSurrogat(nameVon(ohneBudget) ?? ''));
  const so = ordnerMitLaenge(202 - 4 - 111);
  const mitBudget = ordnerPfad({ art: 'datei', seitenOrdner: so, label, kind: 'file', mime: 'application/pdf' });
  ck('P8 12.4 Nr. 1: Emoji an der Grenze der UTF-16-Einheiten → ganz weggelassen, kein halbes Ersatzzeichen',
    nameVon(mitBudget) === `${'a'.repeat(110)}.pdf` && ohneEinzelSurrogat(nameVon(mitBudget) ?? ''));
  const breit = ordnerPfad({ art: 'datei', seitenOrdner: null, label: 'ä'.repeat(300), kind: 'file', mime: 'application/pdf' });
  ck('P8 9.12 Regel 10: zwei Bytes je Zeichen → Name samt „ (99)“ ≤ 240 Bytes und ≤ 120 Codepunkte',
    Buffer.byteLength(`${nameVon(breit)} (99)`, 'utf8') <= 240 && cp(`${nameVon(breit)} (99)`) <= 120 && nameVon(breit) === `${'ä'.repeat(111)}.pdf`);
}

console.log('— P8 · Endung und Sperrliste (9.12 Regel 9; 12.4 Nr. 2)');
{
  const datei = (label: string, mime: string | null): PfadErgebnis => ordnerPfad({ art: 'datei', seitenOrdner: null, label, kind: 'file', mime });
  const faelle: Array<[string, string, string | null, string, string | null]> = [
    ['Endung aus dem Label', 'Bericht.pdf', null, 'Bericht.pdf', null],
    ['Endung aus dem Label vor MIME', 'Bericht.PDF', 'application/pdf', 'Bericht.PDF', null],
    ['Endung aus dem MIME-Typ', 'Bericht', 'application/pdf', 'Bericht.pdf', null],
    ['MIME-Typ groß geschrieben', 'Bericht', 'Application/PDF', 'Bericht.pdf', null],
    ['keine Endung (MIME unbekannt)', 'Bericht', 'application/x-unbekannt', 'Bericht', null],
    ['keine Endung (ohne MIME)', 'Bericht', null, 'Bericht', null],
    ['„Version 2.10“ → MIME-Endung', 'Version 2.10', 'application/pdf', 'Version 2.10.pdf', null],
    ['„Agenda.exe“ mit PDF → „Agenda_exe.pdf“', 'Agenda.exe', 'application/pdf', 'Agenda_exe.pdf', 'exe'],
    ['„Agenda.EXE“ ohne MIME → .bin', 'Agenda.EXE', null, 'Agenda_EXE.bin', 'exe'],
    ['Datei-Anhang „x.url“ → „x_url.‹MIME-Endung›“', 'x.url', 'application/pdf', 'x_url.pdf', 'url'],
    ['„www.example.com“ → „www.example_com.‹MIME-Endung›“', 'www.example.com', 'text/plain', 'www.example_com.txt', 'com'],
    ['„x.library-ms“ ohne bekannten MIME-Typ → „x_library-ms.bin“', 'x.library-ms', 'application/x-unbekannt', 'x_library-ms.bin', 'library-ms'],
    ['„Deck.pptm“ bleibt (Makro-Formate erlaubt, OF9)', 'Deck.pptm', null, 'Deck.pptm', null],
    ['„Slides‹U+202E›txt.exe“ → kein U+202E, gesperrt', 'Slides‮txt.exe', 'application/pdf', 'Slides_txt_exe.pdf', 'exe'],
    ['macOS: „Start.command“', 'Start.command', null, 'Start_command.bin', 'command'],
  ];
  for (const [titel, label, mime, soll, gesperrt] of faelle) {
    const r = datei(label, mime);
    ck(`P8 12.4 Nr. 2: ${titel}`, r.ok && r.name === soll && r.gesperrt === gesperrt);
  }
  const lnk = ordnerPfad({ art: 'datei', seitenOrdner: null, label: 'Website', kind: 'link', mime: null });
  ck('P8 9.7: Link → ‹Stamm›.url, keine Sperre (die .url schreibt der Launcher selbst)', lnk.ok && lnk.name === 'Website.url' && lnk.gesperrt === null);
  const frei = ordnerPfad({ art: 'datei', seitenOrdner: ordnerMitLaenge(189), label: `abcdefghij.sh${'x'.repeat(40)}`, kind: 'file', mime: null });
  ck('P8 9.12 Regel 9 nach 10: legt die Kürzung eine gesperrte Endung frei („….sh“), greift die Sperrliste trotzdem',
    frei.ok && frei.name === 'abcdefghi.bin' && frei.gesperrt === 'sh');
  const sperrliste = 'exe com scr pif bat cmd msi msp mst msc cpl hta js jse vbs vbe wsf wsh wsc ps1 psm1 psd1 ps1xml reg inf lnk url scf library-ms searchconnector-ms settingcontent-ms appref-ms application gadget chm jar diagcab vhd vhdx iso img app command tool terminal scpt workflow pkg mpkg dmg sh'.split(' ');
  // OFP4 (Vorgabe): Startformate, die die Liste der Spec offen lässt (Windows 20, macOS 5; Prüfung Sicherheit 17.10.2026).
  const zusatzOFP4 = 'py pyw jnlp msix msixbundle appx appxbundle appinstaller rdp xll wsb website sct shb shs mde ade adp ins isp fileloc inetloc webloc applescript scptd'.split(' ');
  ck('P8 9.12 Regel 9: Sperrliste wörtlich (Windows 41, macOS 10) und Zusatz OFP4 (Windows 20, macOS 5)',
    GESPERRTE_ENDUNGEN.size === 76 && [...sperrliste, ...zusatzOFP4].every((e) => GESPERRTE_ENDUNGEN.has(e)));
  ck('P8 EP18: MIME_EXT übernimmt die 13 Einträge aus iveo-sync.ts', Object.keys(MIME_EXT).length === 13 && MIME_EXT['application/vnd.openxmlformats-officedocument.presentationml.presentation'] === '.pptx' && MIME_EXT['video/mp4'] === '.mp4');
}

console.log('— P8 · Vergleichsform und Kollision (9.9; 12.4 Nr. 3)');
{
  ck('P8 9.9: Vergleichsform = NFC und klein', vergleichsform('PRÄSENTATION.PDF') === 'präsentation.pdf');
  ck('P8 12.4 Nr. 3: Kollision mit fremder Datei, anders geschrieben → „ (2)“',
    freierName('Bericht.pdf', new Set([vergleichsform('BERICHT.PDF')])) === 'Bericht (2).pdf');
  ck('P8 12.4 Nr. 3: „ (2)“ belegt → „ (3)“',
    freierName('Bericht.pdf', new Set(['bericht.pdf', 'bericht (2).pdf'])) === 'Bericht (3).pdf');
  ck('P8 9.9: NFD-Name der fremden Datei kollidiert mit dem NFC-Wunsch',
    freierName('Präsentation.pptx', new Set([vergleichsform('Präsentation.pptx')])) === 'Präsentation (2).pptx');
  ck('P8 9.9: frei → unverändert', freierName('Bericht.pdf', new Set(['bericht (2).pdf'])) === 'Bericht.pdf');
  ck('P8 9.9: Kollision mit dem Unterordner „entfernt“ → „entfernt (2)“', freierName(bereinigeName('entfernt', 'Anhang'), new Set(['entfernt'])) === 'entfernt (2)');
  ck('P8 9.9: ohne Endung und mit Ziffern-„Endung“ → Zusatz am Ende', freierName('Version 2.10', new Set(['version 2.10'])) === 'Version 2.10 (2)');
  ck('P8 9.9: .url-Datei → „ (2)“ vor .url', freierName('Website.url', new Set(['website.url'])) === 'Website (2).url');
}

console.log('— P8 · Basisordner, Side-Event-Ordner, Zwischen- und Kaputt-Namen (9.1, 9.6, 9.8)');
{
  const show = join(WURZEL, 'Shows', 'COP31 Tag 1.jmshow');
  const b = ordnerPfad({ art: 'basis', showPfad: show });
  ck('P8 9.1: Basisordner „‹Stamm› – Side Events“ neben der Show, Trenner U+0020 U+2013 U+0020',
    b.ok && b.name === 'COP31 Tag 1 – Side Events' && b.pfad === join(WURZEL, 'Shows', 'COP31 Tag 1 – Side Events') && b.name.includes(' – '));
  const lang = ordnerPfad({ art: 'basis', showPfad: join(WURZEL, 'Shows', `${'S'.repeat(200)}.JMSHOW`) });
  ck('P8 9.12 Regel 10: langer Show-Name → Basisordner samt Zusatz ≤ 120 Codepunkte', lang.ok && cp(lang.name) <= 120 && lang.name.endsWith(' – Side Events'));
  const basis = ordnerMitLaenge(60);
  const se = ordnerPfad({ art: 'seitenOrdner', basisPfad: basis, titel: 'Side Event: Klima/Energie?' });
  ck('P8 9.1: Side-Event-Ordner = Titel nach 9.12', se.ok && se.name === 'Side Event_ Klima_Energie_' && se.pfad === join(basis, 'Side Event_ Klima_Energie_'));
  const id40 = 'k'.repeat(40);
  const id50 = 'k'.repeat(50);
  const z40 = ordnerPfad({ art: 'zwischen', seitenOrdner: basis, kennung: id40, pid: 4711, endung: 'jm-laden' });
  const z50 = ordnerPfad({ art: 'zwischen', seitenOrdner: basis, kennung: id50, pid: 4711, endung: 'jm-neu' });
  const h = createHash('sha256').update(id50, 'utf8').digest('hex').slice(0, 8);
  ck('P8 9.6: Zwischendatei „.‹Kennung›.‹pid›.jm-laden“ (Kennung mit 40 Codepunkten bleibt)', nameVon(z40) === `.${id40}.4711.jm-laden`);
  ck('P8 12.4 Nr. 4: Kennung > 40 im Zwischennamen → die ersten 31, „-“ und 8 Hex des SHA-256',
    nameVon(z50) === `.${'k'.repeat(31)}-${h}.4711.jm-neu` && zwischenKennung(id50) === `${'k'.repeat(31)}-${h}`);
  ck('P8 9.12 Regel 2: Pfadtrenner aus der Kennung landen nie im Zwischennamen', zwischenKennung('../../x') === '.._.._x' && nameVon(ordnerPfad({ art: 'zwischen', seitenOrdner: basis, kennung: 'a/b', pid: 1, endung: 'jm-laden' })) === '.a_b.1.jm-laden');
  const k = ordnerPfad({ art: 'kaputt', seitenOrdner: basis, zeit: ZEIT });
  ck('P8 9.8: beschädigter Index → „.jm-anhaenge.kaputt-JJJJMMTT-hhmmss.json“ (Ortszeit)', nameVon(k) === '.jm-anhaenge.kaputt-20261016-103015.json');
}

console.log('— P8 · Pfadlänge (9.12 Regel 10; 12.4 Nr. 4)');
{
  const laengste = (so: string, r: PfadErgebnis, zusatz: string): number => {
    if (!r.ok) return Number.NaN;
    const end = /\.[A-Za-z0-9]{2,5}$/.exec(r.name)?.[0] ?? '';
    return join(so, 'entfernt', `${r.name.slice(0, r.name.length - end.length)}${zusatz} (99)${end}`).length;
  };
  const so180 = ordnerMitLaenge(180);
  const tief = ordnerPfad({ art: 'datei', seitenOrdner: so180, label: 'L'.repeat(100), kind: 'file', mime: 'application/pdf' });
  ck('P8 12.4 Nr. 4: tiefer Ordner → Stamm gekürzt (180 Einheiten Ordner, Endung .pdf → Stamm 18)', nameVon(tief) === `${'L'.repeat(18)}.pdf`);
  ck('P8 12.4 Nr. 4: an der Grenze bleibt die längste Form „entfernt\\… (unvollständig …) (99)…“ bei genau 250',
    laengste(so180, tief, ' (unvollständig 2026-10-16 10-30)') === 250);
  ck('P8 12.4 Nr. 4: ebenso die Form mit „ersetzt“ (6 Einheiten kürzer)', laengste(so180, tief, ' (ersetzt 2026-10-16 10-30)') === 244);
  const u = ordnerPfad({ art: 'entfernt', seitenOrdner: so180, datei: nameVon(tief) ?? '', zusatz: { art: 'unvollstaendig', zeit: ZEIT } });
  const e = ordnerPfad({ art: 'entfernt', seitenOrdner: so180, datei: nameVon(tief) ?? '', zusatz: { art: 'ersetzt', zeit: ZEIT } });
  ck('P8 9.10: entfernt mit „unvollständig“ ohne neue Kürzung, Pfad ≤ 250 auch mit „ (99)“',
    nameVon(u) === `${'L'.repeat(18)} (unvollständig 2026-10-16 10-30).pdf` && u.ok && u.pfad.length + 5 <= 250 && u.pfad === join(so180, 'entfernt', nameVon(u) ?? ''));
  ck('P8 9.10: entfernt mit „ersetzt“ ohne neue Kürzung', nameVon(e) === `${'L'.repeat(18)} (ersetzt 2026-10-16 10-30).pdf`);
  ck('P8 9.10: von iveo entfernt → entfernt\\‹Name›', nameVon(ordnerPfad({ art: 'entfernt', seitenOrdner: so180, datei: 'Alt.pdf', zusatz: null })) === 'Alt.pdf');
  ck('P8 12.4 Nr. 4: zu tief (Stamm < 8) → „Pfad zu lang“',
    JSON.stringify(ordnerPfad({ art: 'datei', seitenOrdner: ordnerMitLaenge(191), label: 'Bericht', kind: 'file', mime: 'application/pdf' })) === '{"ok":false,"grund":"Pfad zu lang"}');
  ck('P8 12.4 Nr. 4: Stamm genau 8 → passt', nameVon(ordnerPfad({ art: 'datei', seitenOrdner: ordnerMitLaenge(190), label: 'Berichtsheft', kind: 'file', mime: 'application/pdf' })) === 'Berichts.pdf');
  const basis = ordnerMitLaenge(100);
  const se = ordnerPfad({ art: 'seitenOrdner', basisPfad: basis, titel: 'T'.repeat(200) });
  ck('P8 12.4 Nr. 4: Side-Event-Ordner lässt Platz für „\\entfernt\\“ und die Reserve 60 (Ordnerpfad = 180)',
    se.ok && se.pfad.length === 180 && se.pfad.length + '\\entfernt\\'.length + 60 === 250);
  const so = se.ok ? se.pfad : '';
  const kurz = ordnerPfad({ art: 'datei', seitenOrdner: so, label: 'Kurzname.abcde', kind: 'file', mime: null });
  ck('P8 12.4 Nr. 4: Ordner an der Budgetgrenze, Stamm 8, „ (99)“, Endung mit 5 Zeichen → längste Form passt in die Reserve 60',
    nameVon(kurz) === 'Kurzname.abcde' && laengste(so, kurz, ' (unvollständig 2026-10-16 10-30)') <= 250);
  ck('P8 12.4 Nr. 4: Basisordner zu tief für jeden Side-Event-Ordner → „Pfad zu lang“',
    !ordnerPfad({ art: 'seitenOrdner', basisPfad: ordnerMitLaenge(172), titel: 'Klima' }).ok && ordnerPfad({ art: 'seitenOrdner', basisPfad: ordnerMitLaenge(171), titel: 'Klima' }).ok);
  const leer = ordnerPfad({ art: 'datei', seitenOrdner: so180, label: `${'a'.repeat(17)} ${'b'.repeat(50)}`, kind: 'file', mime: 'application/pdf' });
  const punkt = ordnerPfad({ art: 'datei', seitenOrdner: so180, label: `${'a'.repeat(17)}.${'b'.repeat(50)}`, kind: 'file', mime: 'application/pdf' });
  ck('P8 12.4 Nr. 4: Kürzung endet auf Leerzeichen bzw. Punkt → nachbereinigt (Regeln 3–8 erneut)',
    nameVon(leer) === `${'a'.repeat(17)}.pdf` && nameVon(punkt) === `${'a'.repeat(17)}.pdf`);
  const vorbehalt = ordnerPfad({ art: 'datei', seitenOrdner: ordnerMitLaenge(190), label: 'CONOUT$ abcdefghij', kind: 'file', mime: 'application/pdf' });
  ck('P8 9.12 Regel 7 nach 10: Kürzung legt einen reservierten Namen frei („CONOUT$ “) → „_“ davor, Budget gehalten',
    nameVon(vorbehalt) === '_CONOUT$.pdf');
}

console.log('— P8 · Wächter gegen Pfad-Traversal (9.12 Regel 11; 12.4 Nr. 5)');
{
  const so = join(WURZEL, 'Shows', 'COP31 – Side Events', 'Klima');
  const bereinigt = ordnerPfad({ art: 'datei', seitenOrdner: so, label: '../../x', kind: 'file', mime: null });
  ck('P8 12.4 Nr. 5: mit Bereinigung bleibt „../../x“ im Ordner', bereinigt.ok && imOrdner(so, bereinigt.pfad) && bereinigt.name === '_.._.._x');
  ck('P8 12.4 Nr. 5: Bereinigung ausgeschaltet, Label „../../x“ → imOrdner falsch, der Schritt bricht ab', imOrdner(so, join(so, '../../x')) === false);
  ck('P8 9.12 Regel 11: absoluter Pfad, der Ordner selbst und ein Nachbarordner → falsch',
    !imOrdner(so, join(WURZEL, 'x')) && !imOrdner(so, so) && !imOrdner(so, `${so}-anders${join('/', 'x')}`));
  ck('P8 9.12 Regel 11: Datei und entfernt\\Datei im Ordner → wahr', imOrdner(so, join(so, 'Deck.pptx')) && imOrdner(so, join(so, 'entfernt', 'Alt.pdf')));
}

// ── Ende der Fälle ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
