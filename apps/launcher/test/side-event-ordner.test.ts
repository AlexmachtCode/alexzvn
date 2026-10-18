// Side-Event-Ordner OHNE Electron (tsx): npm run selftest:iveo -w @jm/launcher
// iveo-Paket Teil E (Spec 9.1–9.15, 12.4): die reinen Regeln (Namen und Pfade 9.12, Links 9.7, Panel 8.6, Fehlertexte
// 9.13, Index 9.8, Ablage-Menge 9.3, Sperre 9.2, Rückhaltung 9.6, Auffrischregel 6.1); ab Task 12 Plan und Lauf.
import { createHash } from 'node:crypto';
import { join, parse } from 'node:path';
import { IveoApiError, IveoAssetAdresseError, type IveoMaterial } from '@jm/iveo';
import {
  bereinigeName, freierName, GESPERRTE_ENDUNGEN, imOrdner, MIME_EXT, ohneAdressen, ORDNER_GRUENDE, ordnerFehlerText, ordnerPfad, PANEL_TEXTE,
  panelAnhangSchritt, panelDateiOeffnen, pruefeLink, urlDateiInhalt, vergleichsform, zwischenKennung, type PfadErgebnis,
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

console.log('— P9 · Linkprüfer und .url-Inhalt (9.7; 12.4 Nr. 19, Helfer-Teil)');
{
  ck('P9 12.4 Nr. 19: javascript:, file:, smb:, search-ms: → ungültig',
    ['javascript:alert(1)', 'file:///C:/Windows/system32/calc.exe', 'smb://evil/share/x', 'search-ms:query=x&crumb=location:\\\\evil\\share']
      .every((u) => pruefeLink(u).ok === false));
  const lz = pruefeLink('  HTTPS://OK.Example/Pfad?x=1  ');
  ck('P9 12.4 Nr. 19: führende und folgende Leerzeichen → genau href (normalisiert, nicht der Rohtext)',
    lz.ok && lz.href === 'https://ok.example/Pfad?x=1');
  ck('P9 12.4 Nr. 19: Messeingabe CR LF + IconFile=\\\\evil\\share\\x.ico → ungültig (Regel 2)',
    pruefeLink('https://ok.example/pfad\r\nIconFile=\\\\evil\\share\\x.ico').ok === false);
  ck('P9 9.7 Regel 2: Tab, LF allein, DEL, NUL → ungültig',
    ['https://a.example/\tx', 'https://a.example/\nx', 'https://a.example/\u007f', 'https://a.example/\u0000'].every((u) => pruefeLink(u).ok === false));
  const lang = `https://ok.example/${'a'.repeat(2048 - 'https://ok.example/'.length)}`;
  ck('P9 12.4 Nr. 19: href mit 2048 Zeichen → gültig, mit 2049 → ungültig', pruefeLink(lang).ok === true && pruefeLink(`${lang}b`).ok === false);
  ck('P9 9.7 Regel 1: kein String → ungültig', pruefeLink(null).ok === false && pruefeLink(42).ok === false && pruefeLink(undefined).ok === false);
  const inhalt = urlDateiInhalt('https://example.org/a?b=1');
  const b = Buffer.from(inhalt, 'utf8');
  ck('P9 12.4 Nr. 19: .url-Inhalt byteweise (genau zwei Zeilen mit CRLF, UTF-8 ohne BOM)',
    b.equals(Buffer.from('[InternetShortcut]\r\nURL=https://example.org/a?b=1\r\n', 'utf8')) && b[0] === 0x5b
    && inhalt.split('\r\n').length === 3 && !inhalt.replace(/\r\n/g, '').includes('\n'));
}

console.log('— P9 · Panel: Öffnen und Speichern (8.6; 12.4 Nr. 19, 48)');
{
  const REF = `${'A'.repeat(100)}GEHEIM-ASSET${'B'.repeat(123)}.${'C'.repeat(43)}`;
  const mat = (x: Record<string, unknown>): IveoMaterial => ({ id: 'm1', kind: 'file', label: 'Bericht', ...x }) as IveoMaterial;
  const s1 = panelAnhangSchritt(mat({ kind: 'link', external_url: '  https://Example.org/Seite  ' }));
  ck('P9 12.4 Nr. 19: gültiger Link → {art: link, href} mit genau href', JSON.stringify(s1) === '{"art":"link","href":"https://example.org/Seite"}');
  const s2 = panelAnhangSchritt(mat({ kind: 'link', external_url: 'javascript:alert(1)' }));
  ck('P9 12.4 Nr. 19: ungültiger Link → {art: fehler} mit T53', JSON.stringify(s2) === '{"art":"fehler","text":"Link ohne gültige Adresse, nicht geöffnet."}');
  const s3 = panelAnhangSchritt(mat({ kind: 'link', external_url: 'https://ok.example/pfad\r\nIconFile=\\\\evil\\share\\x.ico' }));
  ck('P9 12.4 Nr. 19: Messeingabe als Link im Panel → T53', s3.art === 'fehler' && s3.text === PANEL_TEXTE.linkUngueltig);
  ck('P9 12.4 Nr. 19: Link ohne external_url → „Kein Link vorhanden.“',
    JSON.stringify(panelAnhangSchritt(mat({ kind: 'link', external_url: null }))) === '{"art":"fehler","text":"Kein Link vorhanden."}');
  ck('P9 8.6: Datei-Anhang ohne Asset, aber mit external_url → wie ein Link (iveo-sync.ts:681)',
    panelAnhangSchritt(mat({ kind: 'file', asset: null, external_url: 'https://example.org/x' })).art === 'link');
  ck('P9 12.4 Nr. 48: gelöschter Anhang → T15',
    JSON.stringify(panelAnhangSchritt(mat({ asset: { url: REF }, purged_at: '2026-10-16T09:00:00Z' }))) === '{"art":"fehler","text":"Anhang wurde in iveo gelöscht."}');
  ck('P9 12.4 Nr. 48: Datei ohne Asset → T54',
    JSON.stringify(panelAnhangSchritt(mat({ asset: { url: '' } }))) === '{"art":"fehler","text":"Kein Datei-Anhang vorhanden."}');
  const exe = panelAnhangSchritt(mat({ label: 'Agenda.exe', asset: { url: REF, mime_type: 'application/pdf', size_bytes: 10 } }));
  ck('P9 12.4 Nr. 48: „Agenda.exe“ mit application/pdf → {art: datei, vorschlag: Agenda_exe.pdf, gesperrt: exe}',
    JSON.stringify(exe) === '{"art":"datei","vorschlag":"Agenda_exe.pdf","gesperrt":"exe"}');
  const bidi = panelAnhangSchritt(mat({ label: 'Slides\u202etxt.exe', asset: { url: REF, mime_type: null } }));
  ck('P9 12.4 Nr. 48: „Slides‹U+202E›txt.exe“ → kein U+202E im Vorschlag, gesperrt',
    bidi.art === 'datei' && !bidi.vorschlag.includes('\u202e') && bidi.gesperrt === 'exe' && bidi.vorschlag === 'Slides_txt_exe.bin');
  const labels = ['CON', 'con.txt', 'CON .pdf', 'nul  .txt', 'CONIN$', 'COM¹', 'LPT9.pdf', 'Präsentation.', '.versteckt', '..', '../x', 'a/b', 'a\\b', 'a:b',
    'a*?"<>|b', 'a\u0001b', 'a\u0085b', 'a\u200bb', 'Slides\u202etxt.exe', 'Pra\u0308sentation', '', 'entfernt', 'Bericht.pdf', 'Bericht', 'Version 2.10',
    'Agenda.exe', 'x.url', 'www.example.com', 'x.library-ms', 'Deck.pptm', `${'a'.repeat(110)}😀${'b'.repeat(189)}`];
  const mimes = [...Object.keys(MIME_EXT), null, 'application/x-unbekannt'];
  const so = join(WURZEL, 'Shows', 'COP31 – Side Events', 'Klima');
  let gleich = 0, alle = 0, geheim = 0;
  for (const label of labels) for (const mime of mimes) {
    alle++;
    const s = panelAnhangSchritt(mat({ label, asset: { url: REF, mime_type: mime } }));
    const o = ordnerPfad({ art: 'datei', seitenOrdner: so, label, kind: 'file', mime });
    if (s.art === 'datei' && o.ok && s.vorschlag === o.name && s.gesperrt === o.gesperrt) gleich++;
    if (JSON.stringify(s).includes('GEHEIM')) geheim++;
  }
  ck(`P9 12.4 Nr. 48: Vorschlag = Name im Ordner für jedes Label und jeden MIME-Typ aus Nr. 1/2 (${alle} Paare)`, gleich === alle);
  ck('P9 12.4 Nr. 48: kein Ergebnis enthält den Marker aus asset.url', geheim === 0 && !JSON.stringify(exe).includes(REF.slice(0, 16)));
  ck('P9 12.4 Nr. 48: panelDateiOeffnen „Bericht.pdf“ ohne Sperre → öffnen', panelDateiOeffnen('Bericht.pdf', null) === true);
  ck('P9 12.4 Nr. 48: „Agenda_exe.pdf“ mit gesperrt exe → nicht öffnen (T74)', panelDateiOeffnen('Agenda_exe.pdf', 'exe') === false);
  ck('P9 12.4 Nr. 48: im Dialog zurückbenannt „Bericht.exe“ bzw. „Bericht.EXE“ → nicht öffnen',
    panelDateiOeffnen('Bericht.exe', null) === false && panelDateiOeffnen('Bericht.EXE', null) === false);
  ck('P9 12.4 Nr. 48: „Deck.pptm“ → öffnen', panelDateiOeffnen('Deck.pptm', null) === true);
  ck('P9 8.6: voller Pfad aus dem Dialog, Punkt am Ende, macOS-Endung → nicht öffnen',
    panelDateiOeffnen(join(WURZEL, 'Daten.x', 'Bericht.exe'), null) === false && panelDateiOeffnen('Bericht.exe. ', null) === false
    && panelDateiOeffnen('Start.command', null) === false);
  ck('P9 8.6: ohne Endung bzw. Ordner mit Punkt im Pfad → öffnen', panelDateiOeffnen('Bericht', null) === true && panelDateiOeffnen(join(WURZEL, 'a.exe', 'Bericht'), null) === true);
}

console.log('— P9 · Fehlertexte des Ordner-Teils (9.13, T22, T77 a)');
{
  const zeit = new Error('The operation was aborted due to timeout'); zeit.name = 'TimeoutError';
  const abbruch = new Error('This operation was aborted'); abbruch.name = 'AbortError';
  const fs = (code: string): Error => Object.assign(new Error(`${code}: no space left on device, write`), { code });
  ck('P9 9.13: Grund bedienung → kein Fehler (null), auch mit Fehlerobjekt', ordnerFehlerText(abbruch, 'download', 'bedienung') === null);
  ck('P9 9.13: Grund leerlauf → T22 (e)', ordnerFehlerText(abbruch, 'download', 'leerlauf') === 'keine Daten seit 60 s, abgebrochen');
  ck('P9 9.13: 404 bei agenda → T22 (m), bei download → T22 (n)',
    ordnerFehlerText(new IveoApiError(404, 'not_found', 'x'), 'agenda') === 'Agenda in iveo nicht gefunden (404)'
    && ordnerFehlerText(new IveoApiError(404, 'http_404', 'x'), 'download') === 'Datei in iveo nicht gefunden (404)');
  ck('P9 9.13: 401 → T22 (o) wie der Kern', ordnerFehlerText(new IveoApiError(401, 'unauthorized', 'x'), 'agenda') === 'Token ungültig/abgelaufen oder API-Zugang deaktiviert (401).');
  ck('P9 9.13: ≥ 500 → T22 (p) ohne „Details im Launcher-Log“',
    ordnerFehlerText(new IveoApiError(503, 'http_503', 'x'), 'download') === 'iveo-Server-Fehler (HTTP 503)');
  ck('P9 9.13: TimeoutError (und AbortError ohne Grund aus der Zeitgrenze) → T22 (q)',
    ordnerFehlerText(zeit, 'agenda') === 'iveo antwortet nicht innerhalb von 15 s' && ordnerFehlerText(abbruch, 'agenda') === 'iveo antwortet nicht innerhalb von 15 s');
  ck('P9 9.13: IveoAssetAdresseError → T77 (a)', ordnerFehlerText(new IveoAssetAdresseError(), 'download') === 'Datei-Adresse auf anderem Server ohne https');
  ck('P9 9.13: Dateisystemfehler → „Schreibfehler (‹Code›)“',
    ordnerFehlerText(fs('ENOSPC'), 'download') === 'Schreibfehler (ENOSPC)' && ordnerFehlerText(fs('EACCES'), 'datei') === 'Schreibfehler (EACCES)');
  ck('P9 9.13: anderer iveo-Fehler (429) → seine Meldung', ordnerFehlerText(new IveoApiError(429, 'rate_limited', 'iveo: zu viele Anfragen'), 'agenda') === 'iveo: zu viele Anfragen');
  const lang = ordnerFehlerText(new Error(`Zeile 1\r\nZeile 2\n${'x'.repeat(300)}`), 'datei') ?? '';
  ck('P9 9.13: sonst die Meldung, höchstens 200 Zeichen, ohne Zeilenumbrüche', lang.length === 200 && lang.startsWith('Zeile 1 Zeile 2 x') && !/[\r\n]/.test(lang));
  const SIG = 'https://signed.example/x?X-Amz-Signature=GEHEIM-SIG';
  const mitAdresse = ordnerFehlerText(new Error(`fetch ${SIG} fehlgeschlagen (302 von http://app.my-iveo.de/api/v1/assets/abc)`), 'download') ?? '';
  ck('P9 9.13: Meldung mit der signierten Adresse → „‹Adresse›“, kein „GEHEIM“',
    mitAdresse === 'fetch ‹Adresse› fehlgeschlagen (302 von ‹Adresse›' && !mitAdresse.includes('GEHEIM') && !/https?:/.test(mitAdresse));
  const geschnitten = ordnerFehlerText(new Error(`${'A'.repeat(195)} ${SIG}`), 'download') ?? '';
  ck('P9 9.13: Adresse an der 200-Zeichen-Grenze → erst ersetzt, dann gekürzt (kein Rest der Adresse)',
    geschnitten === `${'A'.repeat(195)} ‹Adr` && !/h(t(t(p(s)?)?)?)?$/i.test(geschnitten) && !geschnitten.includes('GEHEIM'));
  ck('P9 9.13: ohneAdressen ersetzt jede Adresse bis zum nächsten Leerraum, auch HTTP groß',
    ohneAdressen(`a ${SIG} b HTTP://X.example/y c`) === 'a ‹Adresse› b ‹Adresse› c');
  ck('P9 9.13: Fehler ohne Meldung → Bestandstext des Kerns', ordnerFehlerText({}, 'agenda') === 'iveo: unbekannter Fehler.' && ordnerFehlerText('kaputt', 'agenda') === 'kaputt');
  const gruende = [ORDNER_GRUENDE.zuGross(3 * 1_073_741_824), ORDNER_GRUENDE.mehrDaten(2.5 * 1_048_576), ORDNER_GRUENDE.wenigPlatz(512 * 1_048_576),
    ORDNER_GRUENDE.platzNichtPruefbar('ENOSYS'), ORDNER_GRUENDE.unvollstaendig(10, 20), ORDNER_GRUENDE.ohneDatei, ORDNER_GRUENDE.linkUngueltig,
    ORDNER_GRUENDE.ungueltigerAnhang('kind'), ORDNER_GRUENDE.pfadZuLang, ORDNER_GRUENDE.entferntKeinOrdner];
  ck('P9 11.6: T22 (a)–(d), (f)–(j), (l) wörtlich',
    JSON.stringify(gruende) === JSON.stringify(['zu groß (3072 MB, Grenze 2048 MB)', 'mehr Daten als angekündigt (2,5 MB)', 'zu wenig Speicherplatz (frei 512 MB)',
      'Speicherplatz nicht prüfbar (ENOSYS)', 'unvollständig (10 von 20 Bytes)', 'in iveo ohne Datei', 'Link ohne gültige Adresse',
      'ungültiger Anhang in iveo (kind)', 'Pfad zu lang', '„entfernt“ ist kein Ordner']));
  ck('P9 9.12: „Pfad zu lang“ aus ordnerPfad = T22 (j)', ORDNER_GRUENDE.pfadZuLang === 'Pfad zu lang');
  const alleTexte = [...Object.values(ORDNER_GRUENDE).map((t) => (typeof t === 'function' ? (t as (...a: unknown[]) => string)(1, 2) : t)), ...Object.values(PANEL_TEXTE)];
  ck('P9 11.6: keine ASCII-Anführungszeichen in Gründen und Notices', alleTexte.every((t) => !t.includes('"')));
}

// ── Ende der Fälle ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
