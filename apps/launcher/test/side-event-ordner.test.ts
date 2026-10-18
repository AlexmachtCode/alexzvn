// Side-Event-Ordner OHNE Electron (tsx): npm run selftest:iveo -w @jm/launcher
// iveo-Paket Teil E (Spec 9.1–9.15, 12.4): die reinen Regeln (Namen und Pfade 9.12, Links 9.7, Panel 8.6, Fehlertexte
// 9.13, Index 9.8, Ablage-Menge 9.3, Sperre 9.2, Rückhaltung 9.6, Auffrischregel 6.1); ab Task 12 Plan und Lauf.
import { createHash } from 'node:crypto';
import { join, parse } from 'node:path';
import { IveoApiError, IveoAssetAdresseError, type IveoMaterial } from '@jm/iveo';
import type { GueltigerAnhang } from '../src/main/iveo-anhaenge';
import { auffrischenFaellig, naechsterFaelligerTakt, SPEAKER_AUFFRISCHEN_MS } from '../src/main/iveo-huelle-hilfen';
import {
  ablageMenge, ablageTag, bereinigeName, freierName, GESPERRTE_ENDUNGEN, imOrdner, INDEX_DATEI, indexText, inhaltSignatur, leseIndex,
  leseSperre, MIME_EXT, ohneAdressen, ORDNER_GRUENDE, ordnerFehlerText, ordnerPfad, PANEL_TEXTE, panelAnhangSchritt, panelDateiOeffnen,
  pruefeLink, rueckhaltungBis, SPERR_DATEI, SPERRE_ABLAUF_MS, sperreBewerten, urlDateiInhalt, vergleichsform, zwischenKennung,
  type IndexLesen, type OrdnerIndex, type PfadErgebnis, type SperreBewertung, type SperreInhalt,
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

console.log('— P10 · Indexdatei lesen, prüfen, schreiben (9.8; 12.4 Nr. 35 Index-Teil)');
{
  // Der Index aus Spec 9.8, mit echten Werten statt „…“ (m-4 wartet mit seiner Kennung).
  const spec: OrdnerIndex = {
    format: 1, programId: 'P-17', titel: 'Side Event Klima', ordnerName: 'Side Event Klima', stand: '2026-10-16T10:30:00.000Z',
    eintraege: [
      { id: 'm-1', art: 'datei', zustand: 'aktiv', datei: 'Präsentation.pptx', label: 'Präsentation',
        inhalt: `application/vnd.openxmlformats-officedocument.presentationml.presentation|1048576|${'9f86d081'.repeat(8)}`, bytes: 1048576, mtimeMs: 1760610600000 },
      { id: 'm-2', art: 'link', zustand: 'aktiv', datei: 'Website.url', label: 'Website', inhalt: 'https://example.org/' },
      { id: 'm-3', art: 'datei', zustand: 'entfernt', datei: 'entfernt/Alt.pdf', label: 'Alt', seit: '2026-10-16T09:00:00.000Z' },
      { id: 'm-4', art: 'datei', zustand: 'aktiv', datei: 'Agenda.pdf', wartet: '.m-4.4711.jm-neu', inhaltNeu: `application/pdf|20|${'a'.repeat(64)}` },
      { id: 'm-5', art: 'datei', zustand: 'laedt', datei: 'Video.mp4', bytes: 52428800 },
    ],
  };
  const text = indexText(spec);
  const ok = leseIndex(text);
  ck('P10 12.4 Nr. 35: gültiger Index aus 9.8 → ok', ok.art === 'ok' && ok.index.eintraege.length === 5);
  ck('P10 9.8: indexText → leseIndex → indexText ist eine Rundreise (JSON, LF, Schluss-LF)',
    ok.art === 'ok' && indexText(ok.index) === text && text.endsWith('}\n') && !text.includes('\r'));
  const mit = (aenderung: (i: Record<string, unknown>, e: Array<Record<string, unknown>>) => void): IndexLesen => {
    const i = JSON.parse(text) as Record<string, unknown>;
    aenderung(i, i.eintraege as Array<Record<string, unknown>>);
    return leseIndex(JSON.stringify(i));
  };
  const faelle: Array<[string, (i: Record<string, unknown>, e: Array<Record<string, unknown>>) => void]> = [
    ['datei = ../x', (_i, e) => { e[0].datei = '../x'; }],
    ['datei = C:\\x', (_i, e) => { e[0].datei = 'C:\\x'; }],
    ['datei = \\\\h\\s\\x', (_i, e) => { e[0].datei = '\\\\h\\s\\x'; }],
    ['datei = entfernt/../../x', (_i, e) => { e[2].datei = 'entfernt/../../x'; }],
    ['datei = entfernt/x bei zustand aktiv', (_i, e) => { e[0].datei = 'entfernt/Alt.pdf'; }],
    ['datei = .versteckt (nicht nach 1–8 unverändert)', (_i, e) => { e[0].datei = '.versteckt'; }],
    ['datei leer', (_i, e) => { e[0].datei = ''; }],
    ['wartet mit Traversal', (_i, e) => { e[3].wartet = '../../x.4711.jm-neu'; }],
    ['wartet mit fremder Kennung', (_i, e) => { e[3].wartet = '.m-1.4711.jm-neu'; }],
    ['wartet ohne Ziffern', (_i, e) => { e[3].wartet = '.m-4.x.jm-neu'; }],
    ['art unbekannt', (_i, e) => { e[0].art = 'video'; }],
    ['zustand unbekannt', (_i, e) => { e[0].zustand = 'weg'; }],
    ['id keine Zeichenkette', (_i, e) => { e[0].id = 7; }],
    ['bytes als Text', (_i, e) => { e[0].bytes = '1048576'; }],
    ['doppelte Kennung', (_i, e) => { e[1].id = 'm-1'; }],
    ['zwei Einträge mit derselben Datei (Vergleichsform)', (_i, e) => { e[1].datei = 'PRÄSENTATION.pptx'; }],
    ['programId leer', (i) => { i.programId = ''; }],
    ['eintraege kein Array', (i) => { i.eintraege = {}; }],
    ['format als Text', (i) => { i.format = '1'; }],
    ['format 0', (i) => { i.format = 0; }],
    ['titel keine Zeichenkette', (i) => { i.titel = 5; }],
  ];
  for (const [titel, a] of faelle) ck(`P10 12.4 Nr. 35: ${titel} → kaputt`, mit(a).art === 'kaputt');
  ck('P10 12.4 Nr. 35: kein JSON, JSON-Array, null → kaputt', leseIndex('{kaputt').art === 'kaputt' && leseIndex('[]').art === 'kaputt' && leseIndex('null').art === 'kaputt');
  const neuer = mit((i) => { i.format = 2; i.eintraege = 'anders'; });
  ck('P10 12.4 Nr. 35: format 2 → neuer (Rest wird nicht geprüft, Ordner nicht anfassen)', JSON.stringify(neuer) === '{"art":"neuer","format":2}');
  const ohneStand = mit((i) => { delete i.stand; delete i.titel; delete i.ordnerName; });
  ck('P10 9.8: titel, ordnerName, stand fehlen → leer (Stand „nicht da“)',
    ohneStand.art === 'ok' && ohneStand.index.stand === '' && ohneStand.index.titel === '' && ohneStand.index.ordnerName === '');
  const fremdFeld = mit((i, e) => { i.zusatz = 'x'; e[0].geheim = 'y'; });
  ck('P10 9.8: unbekannte Felder werden nicht übernommen', fremdFeld.art === 'ok' && !('zusatz' in fremdFeld.index) && !('geheim' in fremdFeld.index.eintraege[0]));
  ck('P10 9.8: Dateinamen INDEX_DATEI und SPERR_DATEI', INDEX_DATEI === '.jm-anhaenge.json' && SPERR_DATEI === '.jm-ablage-sperre.json');
}

console.log('— P10 · Inhaltssignatur (9.5, 9.8, M1)');
{
  const REF = `${'A'.repeat(100)}GEHEIM-ASSET${'B'.repeat(123)}.${'C'.repeat(43)}`;
  const item = { id: 'i1', program_id: 'P-17', title: 'Eröffnung' };
  const anhang = (m: Record<string, unknown>, groesse: number | null): GueltigerAnhang => ({ item, m: m as unknown as IveoMaterial, groesse });
  const d = inhaltSignatur(anhang({ id: 'm1', kind: 'file', label: 'Deck', asset: { url: REF, mime_type: 'application/pdf', size_bytes: 1000 } }, 1000));
  ck('P10 9.8: Datei → „‹MIME›|‹Größe›|‹SHA-256 der Referenz›“, ohne die Referenz',
    d === `application/pdf|1000|${createHash('sha256').update(REF, 'utf8').digest('hex')}` && !d.includes('GEHEIM'));
  ck('P10 9.5: Datei ohne Größe und MIME → leere Teile', inhaltSignatur(anhang({ id: 'm1', kind: 'file', label: 'Deck', asset: { url: REF } }, null))?.startsWith('||') === true);
  ck('P10 9.7: Link → href aus pruefeLink', inhaltSignatur(anhang({ id: 'm2', kind: 'link', label: 'Web', external_url: ' HTTPS://Example.org ' }, null)) === 'https://example.org/');
  ck('P10 9.5: Link ohne gültige Adresse und Datei ohne Asset → null',
    inhaltSignatur(anhang({ id: 'm2', kind: 'link', label: 'Web', external_url: 'file:///x' }, null)) === null
    && inhaltSignatur(anhang({ id: 'm1', kind: 'file', label: 'Deck', asset: null }, null)) === null);
}

console.log('— P10 · Ablage-Tag und Ablage-Menge (9.3; 12.4 Nr. 42)');
{
  const tage = ['2026-11-10', '2026-11-11', '2026-11-12'];
  const anzahl = [22, 23, 22];
  const liste: Array<{ id: string; title: string }> = [];
  const tagVonKarte = new Map<string, string>();
  tage.forEach((t, n) => { for (let i = 1; i <= anzahl[n]; i++) { const id = `p${n + 1}-${String(i).padStart(2, '0')}`; liste.push({ id, title: `Side Event ${id}` }); tagVonKarte.set(id, t); } });
  const tagVon = (id: string): string | null => tagVonKarte.get(id) ?? null;
  ck('P10 12.4 Nr. 42: Prüfliste hat 67 Programme über drei Tage', liste.length === 67);
  const aktiv = 'p2-05';
  const tag = ablageTag({ programId: aktiv }, tagVon);
  ck('P10 9.3: Ablage-Tag aus dem aktiven Side Event (Filter {programId})', tag === '2026-11-11');
  const menge = ablageMenge(liste, tag, tagVon, aktiv);
  ck('P10 12.4 Nr. 42: Filter {programId}, aktiv an Tag 2 → nur Tag 2 und das aktive (23)', menge.length === 23 && menge.every((id) => id.startsWith('p2-')));
  const mitUnbekannt = ablageMenge([...liste, { id: 'neu-1', title: 'Neu' }], tag, tagVon, aktiv);
  ck('P10 12.4 Nr. 42: Eintrag ohne Tag im Cache zählt mit', mitUnbekannt.length === 24 && mitUnbekannt.includes('neu-1'));
  const aussen = ablageMenge(liste.filter((p) => p.id !== 'p2-07'), tag, tagVon, 'p2-07');
  ck('P10 12.4 Nr. 42: aktives Side Event außerhalb der Liste kommt dazu (am Ende)', aussen.length === 23 && aussen[aussen.length - 1] === 'p2-07');
  ck('P10 12.4 Nr. 42: Listen-Modus ohne Tag → alle 67', ablageMenge(liste, ablageTag({}, tagVon), tagVon, null).length === 67);
  ck('P10 9.3: filter.day vor dem Tag des aktiven', ablageTag({ day: '2026-11-12', programId: aktiv }, tagVon) === '2026-11-12');
  ck('P10 9.3: aktives Side Event ohne Tag im Cache → kein Ablage-Tag (alle)', ablageTag({ programId: 'fehlt' }, tagVon) === null);
  ck('P10 9.3: jede Kennung einmal', ablageMenge([...liste.slice(0, 3), liste[0]], null, tagVon, liste[1].id).length === 3);
}

console.log('— P10 · Sperrdatei (9.2 Regeln 1–6; 12.4 Nr. 40 Tabelle)');
{
  const JETZT = Date.UTC(2026, 9, 17, 10, 0, 0);
  const vor = (ms: number): string => new Date(JETZT - ms).toISOString();
  const sperreVon = (rechner: string, sitzung: string, alterMs: number): SperreInhalt => ({ format: 1, rechner, pid: 4711, sitzung, lebenszeichen: vor(alterMs) });
  const ich = { rechner: 'REGIE-PC', sitzung: 's-neu' };
  const faelle: Array<[string, unknown, boolean, SperreBewertung]> = [
    ['Regel 1: keine Sperrdatei (null) → frei', null, false, 'frei'],
    ['Regel 1: keine Sperrdatei (undefined) → frei', undefined, true, 'frei'],
    ['Regel 2: gleiche sitzung → eigen', sperreVon('REGIE-PC', 's-neu', 60_000), true, 'eigen'],
    ['Regel 2: gleiche sitzung, anderer Rechnername → eigen', sperreVon('ANDERS', 's-neu', 60_000), true, 'eigen'],
    ['Regel 3: gleicher rechner, noch nicht gehalten, Lebenszeichen 1 min → eigen-frueher', sperreVon('REGIE-PC', 's-alt', 60_000), false, 'eigen-frueher'],
    ['Regel 3: gleicher rechner, noch nicht gehalten, Lebenszeichen 20 min → eigen-frueher', sperreVon('REGIE-PC', 's-alt', 1_200_000), false, 'eigen-frueher'],
    ['Regel 4: gleicher rechner, schon gehalten → namensgleich', sperreVon('REGIE-PC', 's-zweiter', 10_000), true, 'namensgleich'],
    ['Regel 5: anderer rechner, Lebenszeichen 14:59 min → fremd', sperreVon('TECHNIK-PC', 's-x', 899_000), false, 'fremd'],
    ['Regel 6: anderer rechner, genau 15 min → abgelaufen', sperreVon('TECHNIK-PC', 's-x', 900_000), false, 'abgelaufen'],
    ['Regel 6: anderer rechner, 16 min → abgelaufen', sperreVon('TECHNIK-PC', 's-x', 960_000), true, 'abgelaufen'],
    ['Regel 5: Lebenszeichen in der Zukunft (Uhrzeit des anderen) → fremd', sperreVon('TECHNIK-PC', 's-x', -120_000), false, 'fremd'],
    ['exakt verglichen: „regie-pc“ ist ein anderer Rechner → fremd', sperreVon('regie-pc', 's-x', 60_000), false, 'fremd'],
    ['kein gültiger Inhalt (Text) → abgelaufen', '{kaputt', false, 'abgelaufen'],
    ['EP19: format 2 (neuerer Launcher), anderer Rechner, Lebenszeichen 1 min → fremd', { ...sperreVon('TECHNIK-PC', 's-x', 60_000), format: 2 }, false, 'fremd'],
    ['EP19: format 2, anderer Rechner, Lebenszeichen 16 min → abgelaufen', { ...sperreVon('TECHNIK-PC', 's-x', 960_000), format: 2 }, false, 'abgelaufen'],
    ['EP19: format 0 (keine ganze Zahl ≥ 1) → abgelaufen', { ...sperreVon('TECHNIK-PC', 's-x', 60_000), format: 0 }, false, 'abgelaufen'],
    ['Feld fehlt (rechner) → abgelaufen', { format: 1, pid: 1, sitzung: 's-x', lebenszeichen: vor(60_000) }, false, 'abgelaufen'],
    ['Lebenszeichen nicht lesbar → abgelaufen', { ...sperreVon('TECHNIK-PC', 's-x', 0), lebenszeichen: 'gestern' }, false, 'abgelaufen'],
  ];
  for (const [titel, gelesen, gehalten, soll] of faelle) ck(`P10 12.4 Nr. 40 Tabelle: ${titel}`, sperreBewerten(gelesen, ich, gehalten, JETZT) === soll);
  ck('P10 9.2: Ablauf 15 min', SPERRE_ABLAUF_MS === 900_000);
  ck('P10 9.2: leseSperre gibt nur die bekannten Felder zurück',
    JSON.stringify(leseSperre({ ...sperreVon('TECHNIK-PC', 's-x', 0), extra: 1 })) === JSON.stringify(sperreVon('TECHNIK-PC', 's-x', 0)) && leseSperre(null) === null);
}

console.log('— P10 · Rückhaltung und Auffrischregel (9.6; 12.4 Nr. 37 Formel; 6.1, EP9)');
{
  const t = 1_000_000;
  ck('P10 12.4 Nr. 37 Formel: 45, 90, 180, 360 s, dann höchstens 600 s',
    JSON.stringify([1, 2, 3, 4, 5, 6, 10].map((f) => (rueckhaltungBis(f, t) - t) / 1000)) === '[45,90,180,360,600,600,600]');
  ck('P10 9.6: f = 0 zählt wie der erste Fehlschlag', rueckhaltungBis(0, t) === t + 45_000);
  ck('P10 6.1 Regel: SPEAKER_AUFFRISCHEN_MS = 300 s', SPEAKER_AUFFRISCHEN_MS === 300_000);
  ck('P10 6.1 Regel: Takt 45 s → 254 s nicht fällig, 255 s fällig',
    auffrischenFaellig(0, 254_000, 45_000) === false && auffrischenFaellig(0, 255_000, 45_000) === true);
  ck('P10 6.1 Regel: naechsterFaelligerTakt = Start + 270 s bei 45 s (sechster Takt)', naechsterFaelligerTakt(1_000, 45_000) === 271_000);
  ck('P10 6.1 Regel: andere Takte (60 s → 240 s, 2 s → 298 s, 400 s → ein Takt)',
    naechsterFaelligerTakt(0, 60_000) === 240_000 && naechsterFaelligerTakt(0, 2_000) === 298_000 && naechsterFaelligerTakt(0, 400_000) === 400_000);
  let erster = -1;
  for (let k = 1; k <= 10 && erster < 0; k++) if (auffrischenFaellig(0, k * 45_000, 45_000)) erster = k;
  ck('P10 EP9: naechsterFaelligerTakt ist der erste Takt mit auffrischenFaellig', erster * 45_000 === naechsterFaelligerTakt(0, 45_000));
}

// ── Block C · P12: Plan je Side Event (Spec 9.5) ──────────────────────────────────────────────────────────────────
// Block C nutzt nur eigene Namen (Endung „C“) und Namensräume, damit nichts mit den Importen aus P8–P10 kollidiert.
import pathC from 'node:path';
import type { IveoMaterial as MaterialC } from '@jm/iveo';
import * as AnhaengeC from '../src/main/iveo-anhaenge';
import * as OrdnerC from '../src/main/side-event-ordner';

console.log('— P12 Plan je Side Event (Spec 9.5)');
{
  const ORDNER = pathC.join(pathC.resolve('/plan'), 'COP31 Tag 1 – Side Events', 'Klima');
  const JETZT = new Date(2026, 9, 16, 10, 30, 0);
  const datei = (id: string, label: string, o: { mime?: string | null; size?: unknown; ref?: string } = {}): MaterialC => ({
    id, kind: 'file', label,
    asset: { url: o.ref ?? `ref-${id}`, mime_type: o.mime === undefined ? 'application/pdf' : o.mime, size_bytes: (o.size === undefined ? 1000 : o.size) as number },
  });
  const link = (id: string, label: string, url: unknown): MaterialC => ({ id, kind: 'link', label, external_url: url as string });
  const anh = (...ms: MaterialC[]) => AnhaengeC.pruefeAnhaenge([{ id: 'p1', program_id: 'se-1', title: 'Punkt', materials: ms }]);
  const sig = (m: MaterialC): string => OrdnerC.inhaltSignatur(anh(m).gueltig[0]) as string;
  const idx = (...eintraege: OrdnerC.IndexEintrag[]): OrdnerC.OrdnerIndex => ({
    format: 1, programId: 'se-1', titel: 'Klima', ordnerName: 'Klima', stand: '2026-10-16T08:00:00.000Z', eintraege,
  });
  const f = (name: string, groesse: number, mtimeMs = 1000): OrdnerC.OrdnerDatei => ({ name, groesse, mtimeMs });
  const plane = (o: { a?: ReturnType<typeof anh>; index?: OrdnerC.OrdnerIndex | null; dateien?: OrdnerC.OrdnerDatei[]; entfernt?: OrdnerC.OrdnerDatei[]; url?: Record<string, string>; bis?: number | null }) =>
    OrdnerC.planeSideEvent({
      seitenOrdner: ORDNER, index: o.index ?? null, dateien: o.dateien ?? [], entfernt: o.entfernt ?? [],
      urlInhalte: new Map(Object.entries(o.url ?? {})), anhaenge: o.a?.gueltig ?? [], ungueltig: o.a?.ungueltig ?? [],
      jetzt: JETZT, zurueckgehaltenBis: () => o.bis ?? null,
    });
  // Kurzform je Schritt, damit ein Fall die ganze Liste in einer Zeile vergleicht.
  const kurz = (p: OrdnerC.PlanSchritt[]): string => p.map((s) => {
    switch (s.art) {
      case 'uebernehmen': return `uebernehmen ${s.anhang.m.id} ${s.datei}${s.neu ? '' : ' (laedt)'}`;
      case 'laden': return `laden ${s.anhang.m.id} ${s.wunsch} alt=${s.alt ?? '-'}`;
      case 'url-schreiben': return `url ${s.anhang.m.id} ${s.wunsch} alt=${s.alt ?? '-'}`;
      case 'umbenennen': return `umbenennen ${s.anhang.m.id} ${s.von} → ${s.wunsch}`;
      case 'nach-entfernt': return `entfernt ${s.id} ${s.datei} ${s.zusatz ?? '-'}`;
      case 'zurueckholen': return `zurueck ${s.anhang.m.id} ${s.aus} → ${s.wunsch}`;
      case 'tauschen': return `tauschen ${s.anhang.m.id} ${s.wartet} alt=${s.alt ?? '-'}`;
      case 'fehler': return `fehler ${s.id ?? '-'} ${s.datei}: ${s.grund}`;
      case 'zurueckgehalten': return `zurueckgehalten ${s.id} ${s.datei}`;
    }
  }).join(' | ');

  const BERICHT = datei('m-1', 'Bericht');
  const WEB = link('m-2', 'Website', 'https://example.org/');
  const WEB_INHALT = OrdnerC.urlDateiInhalt('https://example.org/');
  const aktivBericht = (o: Partial<OrdnerC.IndexEintrag> = {}): OrdnerC.IndexEintrag => ({
    id: 'm-1', art: 'datei', zustand: 'aktiv', datei: 'Bericht.pdf', label: 'Bericht', inhalt: sig(BERICHT), bytes: 1000, mtimeMs: 1000, ...o,
  });

  ck('P12 9.5 Zeile 1: Anhang neu, Datei mit seinem Namen und genau seiner Größe → übernehmen, kein Download (E47)',
    kurz(plane({ a: anh(BERICHT), dateien: [f('Bericht.pdf', 1000)] })) === 'uebernehmen m-1 Bericht.pdf');
  ck('P12 9.5 Zeile 1: Link neu, .url mit dem erwarteten Namen und byteweise dem Inhalt aus 9.7 → übernehmen',
    kurz(plane({ a: anh(WEB), dateien: [f('Website.url', Buffer.byteLength(WEB_INHALT))], url: { 'website.url': WEB_INHALT } })) === 'uebernehmen m-2 Website.url');
  ck('P12 9.5 Zeile 1: Vergleichsform – Datei in anderer Schreibweise und als NFD wird übernommen, Name wie im Dateisystem',
    kurz(plane({ a: anh(datei('m-1', 'Präsentation')), dateien: [f('PRÄSENTATION.PDF', 1000)] })) === 'uebernehmen m-1 PRÄSENTATION.PDF');
  ck('P12 9.5 Zeile 2: Anhang neu, Datei gleichen Namens mit anderer Größe → laden (Name nach 9.9 beim Platzieren)',
    kurz(plane({ a: anh(BERICHT), dateien: [f('Bericht.pdf', 999)] })) === 'laden m-1 Bericht.pdf alt=-');
  ck('P12 9.5 Grenze der Übernahme: Datei-Anhang ohne gültiges size_bytes, Datei mit dem Namen da → laden, nie übernehmen',
    kurz(plane({ a: anh(datei('m-1', 'Bericht', { size: '1000' })), dateien: [f('Bericht.pdf', 1000)] })) === 'laden m-1 Bericht.pdf alt=-'
    && kurz(plane({ a: anh(datei('m-1', 'Bericht', { size: null })), dateien: [f('Bericht.pdf', 1000)] })) === 'laden m-1 Bericht.pdf alt=-');
  ck('P12 9.5 Zeile 2: Link neu, .url mit anderem Inhalt gleicher Länge → nicht übernommen, neue .url',
    kurz(plane({ a: anh(WEB), dateien: [f('Website.url', Buffer.byteLength(WEB_INHALT))], url: { 'website.url': WEB_INHALT.replace('example', 'exbmple') } })) === 'url m-2 Website.url alt=-');
  ck('P12 9.5 Zeile 2: Link neu, .url mit einer Zeile mehr → nicht übernommen',
    kurz(plane({ a: anh(WEB), dateien: [f('Website.url', Buffer.byteLength(`${WEB_INHALT}IconFile=x\r\n`))], url: { 'website.url': `${WEB_INHALT}IconFile=x\r\n` } })) === 'url m-2 Website.url alt=-');
  ck('P12 9.5 Zeile 2: Datei mit dem Namen, die ein anderer Index-Eintrag nennt → nicht übernommen',
    kurz(plane({ a: anh(BERICHT, datei('m-9', 'Bericht')), index: idx(aktivBericht()), dateien: [f('Bericht.pdf', 1000)] })) === 'laden m-9 Bericht.pdf alt=-');
  ck('P12 9.5 Zeile 3: Anhang da, Datei da, Inhaltssignatur und Label gleich → nichts',
    kurz(plane({ a: anh(BERICHT), index: idx(aktivBericht()), dateien: [f('Bericht.pdf', 1000)] })) === '');
  ck('P12 9.5 Zeile 3: Vergleichsform – das Dateisystem liefert den Namen in NFD und anders geschrieben → nichts',
    kurz(plane({ a: anh(datei('m-1', 'Präsentation')), index: idx(aktivBericht({ datei: 'Präsentation.pdf', label: 'Präsentation', inhalt: sig(datei('m-1', 'Präsentation')) })), dateien: [f('präsentation.pdf'.normalize('NFD'), 1000)] })) === '');
  ck('P12 9.5 Zeile 4: Label geändert → umbenennen, kein Download',
    kurz(plane({ a: anh(datei('m-1', 'Bericht final')), index: idx(aktivBericht({ inhalt: sig(datei('m-1', 'Bericht final')) })), dateien: [f('Bericht.pdf', 1000)] })) === 'umbenennen m-1 Bericht.pdf → Bericht final.pdf');
  ck('P12 9.5 Zeile 5: Größe geändert → neue Fassung laden, die alte vorher nach entfernt/',
    kurz(plane({ a: anh(datei('m-1', 'Bericht', { size: 2000 })), index: idx(aktivBericht()), dateien: [f('Bericht.pdf', 1000)] })) === 'laden m-1 Bericht.pdf alt=Bericht.pdf');
  ck('P12 9.5 Zeile 5: Asset-Referenz geändert bei gleicher Größe und gleichem MIME → neue Fassung (Referenz-Hash, M1)',
    kurz(plane({ a: anh(datei('m-1', 'Bericht', { ref: 'ref-neu' })), index: idx(aktivBericht()), dateien: [f('Bericht.pdf', 1000)] })) === 'laden m-1 Bericht.pdf alt=Bericht.pdf');
  ck('P12 9.5 Zeile 5: Link mit neuer Adresse → neue .url, die alte nach entfernt/',
    kurz(plane({ a: anh(link('m-2', 'Website', 'https://example.org/neu')), index: idx({ id: 'm-2', art: 'link', zustand: 'aktiv', datei: 'Website.url', label: 'Website', inhalt: 'https://example.org/', bytes: 50, mtimeMs: 1000 }), dateien: [f('Website.url', 50)] })) === 'url m-2 Website.url alt=Website.url');
  ck('P12 9.5 Zeile 6: Index nennt die Datei, sie fehlt (Bediener hat gelöscht) → neu laden unter ihrem Namen',
    kurz(plane({ a: anh(BERICHT), index: idx(aktivBericht({ datei: 'Bericht (2).pdf' })), dateien: [] })) === 'laden m-1 Bericht (2).pdf alt=-');
  ck('P12 9.5 Zeile 7: Eintrag laedt, Datei mit genau bytes da (auch ohne size_bytes) → aktiv, kein Download',
    kurz(plane({ a: anh(datei('m-1', 'Bericht', { size: null })), index: idx({ id: 'm-1', art: 'datei', zustand: 'laedt', datei: 'Bericht.pdf', label: 'Bericht', bytes: 777 }), dateien: [f('Bericht.pdf', 777)] })) === 'uebernehmen m-1 Bericht.pdf (laedt)');
  ck('P12 9.5 Zeile 7: Eintrag laedt, Datei fehlt oder andere Bytezahl → neu laden',
    kurz(plane({ a: anh(BERICHT), index: idx({ id: 'm-1', art: 'datei', zustand: 'laedt', datei: 'Bericht.pdf', label: 'Bericht', bytes: 1000 }), dateien: [f('Bericht.pdf', 10)] })) === 'laden m-1 Bericht.pdf alt=-'
    && kurz(plane({ a: anh(BERICHT), index: idx({ id: 'm-1', art: 'datei', zustand: 'laedt', datei: 'Bericht.pdf', label: 'Bericht', bytes: 1000 }) })) === 'laden m-1 Bericht.pdf alt=-');
  ck('P12 9.5 Zeile 8: Größe weicht vom Index ab, Änderungszeit gleich → nach entfernt/ (unvollständig), neu laden',
    kurz(plane({ a: anh(BERICHT), index: idx(aktivBericht()), dateien: [f('Bericht.pdf', 400, 1000)] })) === 'entfernt m-1 Bericht.pdf unvollstaendig | laden m-1 Bericht.pdf alt=-');
  ck('P12 9.5 Zeile 9: Datei vom Bediener geändert (Änderungszeit weicht ab), Anhang in iveo gleich → nichts (E33)',
    kurz(plane({ a: anh(BERICHT), index: idx(aktivBericht()), dateien: [f('Bericht.pdf', 5555, 2000)] })) === '');
  ck('P12 9.5 Zeile 10: Eintrag aktiv, Anhang fehlt in iveo → nach entfernt/',
    kurz(plane({ a: anh(WEB), index: idx(aktivBericht()), dateien: [f('Bericht.pdf', 1000)] })).startsWith('entfernt m-1 Bericht.pdf -'));
  ck('P12 9.5 Zeile 10: Anhang gelöscht (purged_at) → nach entfernt/',
    kurz(plane({ a: anh({ ...BERICHT, purged_at: '2026-10-16T09:00:00Z' }), index: idx(aktivBericht()), dateien: [f('Bericht.pdf', 1000)] })) === 'entfernt m-1 Bericht.pdf -');
  ck('P12 9.5 leere Agenda: alle aktiven Einträge nach entfernt/ (Risiko 5)',
    kurz(plane({ a: anh(), index: idx(aktivBericht(), { id: 'm-2', art: 'link', zustand: 'aktiv', datei: 'Website.url', label: 'Website', inhalt: 'https://example.org/' }), dateien: [f('Bericht.pdf', 1000), f('Website.url', 50)] })) === 'entfernt m-1 Bericht.pdf - | entfernt m-2 Website.url -');
  ck('P12 9.5 Zeile 11: Eintrag entfernt, Anhang wieder da, Datei liegt in entfernt/ und Signatur passt → zurückholen ohne Download',
    kurz(plane({ a: anh(BERICHT), index: idx(aktivBericht({ zustand: 'entfernt', datei: 'entfernt/Bericht.pdf' })), entfernt: [f('Bericht.pdf', 1000)] })) === 'zurueck m-1 Bericht.pdf → Bericht.pdf');
  ck('P12 9.5 Zeile 11: Eintrag entfernt, Anhang wieder da, aber andere Signatur oder Datei weg → neu laden',
    kurz(plane({ a: anh(datei('m-1', 'Bericht', { size: 3 })), index: idx(aktivBericht({ zustand: 'entfernt', datei: 'entfernt/Bericht.pdf' })), entfernt: [f('Bericht.pdf', 1000)] })) === 'laden m-1 Bericht.pdf alt=-'
    && kurz(plane({ a: anh(BERICHT), index: idx(aktivBericht({ zustand: 'entfernt', datei: 'entfernt/Bericht.pdf' })) })) === 'laden m-1 Bericht.pdf alt=-');
  ck('P12 9.5 Zeile 12: Datei-Anhang ohne Asset → Fehler „in iveo ohne Datei“',
    kurz(plane({ a: anh({ id: 'm-1', kind: 'file', label: 'Bericht', asset: null }) })) === 'fehler m-1 Bericht: in iveo ohne Datei');
  ck('P12 9.5 Zeile 13: Link ohne gültige Adresse (javascript:, fehlend, CR LF im Rohtext) → Fehler, keine .url',
    kurz(plane({ a: anh(link('m-2', 'Website', 'javascript:alert(1)')) })) === 'fehler m-2 Website.url: Link ohne gültige Adresse'
    && kurz(plane({ a: anh(link('m-2', 'Website', undefined)) })) === 'fehler m-2 Website.url: Link ohne gültige Adresse'
    && kurz(plane({ a: anh(link('m-2', 'Website', 'https://ok.example/pfad\r\nIconFile=\\\\evil\\share\\x.ico')) })) === 'fehler m-2 Website.url: Link ohne gültige Adresse');
  ck('P12 9.5 Zeile 14: ungültiger Anhang (unbekanntes kind) → Fehler „ungültiger Anhang in iveo (kind)“',
    kurz(plane({ a: anh({ id: 'm-7', kind: 'video' as 'file', label: 'Film' }) })) === 'fehler m-7 Film: ungültiger Anhang in iveo (kind)');
  ck('P12 9.5 Zeile 14: ungültiger Anhang mit Index-Eintrag wandert nicht nach entfernt/',
    kurz(plane({ a: anh({ ...BERICHT, kind: 'video' as 'file' }), index: idx(aktivBericht()), dateien: [f('Bericht.pdf', 1000)] })) === 'fehler m-1 Bericht: ungültiger Anhang in iveo (kind)');
  ck('P12 9.5 Zeile 15: Download zurückgehalten → nichts bis zur genannten Zeit, danach laden',
    kurz(plane({ a: anh(BERICHT), bis: JETZT.getTime() + 1 })) === 'zurueckgehalten m-1 Bericht.pdf'
    && kurz(plane({ a: anh(BERICHT), bis: JETZT.getTime() })) === 'laden m-1 Bericht.pdf alt=-');
  ck('P12 9.6 wartende Fassung: wartet und inhaltNeu passt → tauschen ohne Download',
    kurz(plane({ a: anh(datei('m-1', 'Bericht', { size: 2000 })), index: idx(aktivBericht({ wartet: '.m-1.4711.jm-neu', inhaltNeu: sig(datei('m-1', 'Bericht', { size: 2000 })) })), dateien: [f('Bericht.pdf', 1000), f('.m-1.4711.jm-neu', 2000)] })) === 'tauschen m-1 .m-1.4711.jm-neu alt=Bericht.pdf');
  ck('P12 9.5 Endung gesperrt: der Plan trägt die gesperrte Endung für T70 und den Zusatz T68',
    (() => { const s = plane({ a: anh(datei('m-1', 'Agenda.exe')) })[0]; return s.art === 'laden' && s.wunsch === 'Agenda_exe.pdf' && s.gesperrt === 'exe'; })());

  // Fix-Runde 1: Befunde der Prüfung
  ck('P12 Fix: null-Eintrag in materials wirft nicht, der gültige Anhang wird geplant, das Problem steht dabei (8.5, 9.5 Zeile 14)',
    (() => { try { return kurz(plane({ a: anh(BERICHT, null as unknown as MaterialC) })) === 'laden m-1 Bericht.pdf alt=- | fehler - Punkt: ungültiger Anhang in iveo (id)'; } catch { return false; } })());
  ck('P12 Fix: dieselbe Datei kann nur einem Anhang gehören – zwei Anhänge mit gleichem Label, nur Bericht.pdf passt → einer übernimmt, der andere lädt',
    kurz(plane({ a: anh(BERICHT, datei('m-9', 'Bericht')), dateien: [f('Bericht.pdf', 1000), f('Bericht (2).pdf', 1000)] })) === 'uebernehmen m-1 Bericht.pdf | laden m-9 Bericht.pdf alt=-');
  const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  ck('P12 Fix: gleiches Label, neuer MIME-Typ → der Name bekommt die neue Endung (9.12), der alte steht als alt',
    kurz(plane({ a: anh(datei('m-1', 'Präsentation', { mime: PPTX })), index: idx(aktivBericht({ datei: 'Präsentation.pdf', label: 'Präsentation' })), dateien: [f('Präsentation.pdf', 1000)] })) === 'laden m-1 Präsentation.pptx alt=Präsentation.pdf');
  ck('P12 Fix: gleiches Label, Link wird Datei → .pdf statt .url',
    kurz(plane({ a: anh(datei('m-2', 'Website')), index: idx({ id: 'm-2', art: 'link', zustand: 'aktiv', datei: 'Website.url', label: 'Website', inhalt: WEB_INHALT, bytes: 40, mtimeMs: 1000 }), dateien: [f('Website.url', 40)] })) === 'laden m-2 Website.pdf alt=Website.url');
  ck('P12 Fix: gleiche Endung → der Name mit Kollisionszusatz bleibt (9.9)',
    kurz(plane({ a: anh(datei('m-1', 'Bericht', { size: 2000 })), index: idx(aktivBericht({ datei: 'Bericht (2).pdf' })), dateien: [f('Bericht (2).pdf', 1000)] })) === 'laden m-1 Bericht (2).pdf alt=Bericht (2).pdf');
  const NFC = 'Pr\u00e4sentation.pdf';
  const NFD = 'Pra\u0308sentation.pdf';
  const eigen = aktivBericht({ datei: NFC, label: 'Präsentation' });
  ck('P12 Fix: NFC- und NFD-Datei nebeneinander – nach entfernt/ geht nur die eigene Datei, in jeder Reihenfolge der Liste (9.9)',
    [[f(NFC, 1000), f(NFD, 5)], [f(NFD, 5), f(NFC, 1000)]].every((d) => { const p = plane({ index: idx(eigen), dateien: d }); return p.length === 1 && p[0].art === 'nach-entfernt' && p[0].datei === NFC; }));
  ck('P12 Fix: NFC- und NFD-Datei nebeneinander – umbenannt wird nur die eigene Datei, in jeder Reihenfolge der Liste (9.9)',
    [[f(NFC, 1000), f(NFD, 5)], [f(NFD, 5), f(NFC, 1000)]].every((d) => { const p = plane({ a: anh(datei('m-1', 'Folien')), index: idx(eigen), dateien: d }); return p.length === 1 && p[0].art === 'umbenennen' && p[0].von === NFC; }));
  ck('P12 Fix: Datei-Anhang mit asset ohne oder mit leerer url → Fehler „in iveo ohne Datei“, wie im Panel',
    kurz(plane({ a: anh({ id: 'm-1', kind: 'file', label: 'Bericht', asset: { url: '', mime_type: 'application/pdf', size_bytes: 1 } }) })) === 'fehler m-1 Bericht.pdf: in iveo ohne Datei'
    && kurz(plane({ a: anh({ id: 'm-1', kind: 'file', label: 'Bericht', asset: { mime_type: 'application/pdf', size_bytes: 1 } as unknown as MaterialC['asset'] }) })) === 'fehler m-1 Bericht.pdf: in iveo ohne Datei');
}

// ── Block C · P13: Lauf-Gerüst – Bedingungen (9.2), Sperrdatei, Ende der Ablage ──────────────────────────────────
import * as LaufC from '../src/main/side-event-ordner-lauf';
import * as AttC from './ordner-attrappe';
import * as ZeilenC from '../src/renderer/src/lib/ordner-zeilen';

console.log('— P13 Wer ablegt (Spec 9.2), Sperrdatei, Ende der Ablage');
{
  const SPERRE = pathC.join(AttC.BASIS, OrdnerC.SPERR_DATEI);
  const sperreVon = (fs: AttC.FsAttrappe): { rechner?: string; sitzung?: string; pid?: number; lebenszeichen?: string } | null => {
    const t = fs.inhalt(SPERRE);
    return t === null ? null : JSON.parse(t);
  };
  // Zugriffe seit einer Marke zählen (die Attrappe protokolliert jeden Aufruf).
  const ab = (fs: AttC.FsAttrappe) => {
    const n = fs.protokoll.length;
    return () => fs.protokoll.slice(n);
  };
  const ops = (liste: Array<{ op: string; p: string }>): string =>
    liste.map((x) => `${x.op} ${x.p === AttC.SHOW_PFAD ? 'Show' : x.p.startsWith(SPERRE) ? 'Sperre' : pathC.relative(AttC.ROOT, x.p)}`).join(', ');

  {
    // Nr. 26: Show-Datei fehlt → nur die Prüfung; wieder da → nächster Takt legt ab
    const T = AttC.baueLauf({ ohneShowDatei: true });
    T.fs.ordner(AttC.BASIS);
    const seit = ab(T.fs);
    await T.takt();
    await T.takt();
    ck('P13 12.4 Nr. 26: Show-Datei fehlt → je Takt nur ihre Prüfung, kein weiterer Zugriff, kein Abruf',
      ops(seit()) === 'readFile Show, readFile Show' && T.agenda.aufrufe.length === 0);
    ck('P13 12.4 Nr. 26: … Stand für K4 (showDatei fehlt), keine Sperre geschrieben',
      T.lauf.stand().showDatei === 'fehlt' && sperreVon(T.fs) === null);
    T.fs.lege(AttC.SHOW_PFAD, '{ kein JSON');
    await T.takt();
    ck('P13 9.11: Show-Datei nicht lesbar (kein gültiges JSON) → showDatei nicht-lesbar, keine Sperre',
      T.lauf.stand().showDatei === 'nicht-lesbar' && sperreVon(T.fs) === null);
    T.fs.lege(AttC.SHOW_PFAD, AttC.showText([{ id: 'se-1', title: 'Klima' }], { programId: 'se-1' }));
    await T.takt();
    ck('P13 12.4 Nr. 26: Show-Datei wieder da → der nächste Takt legt ab (Sperre dieser Sitzung geschrieben)',
      T.lauf.stand().showDatei === 'da' && sperreVon(T.fs)?.rechner === 'REGIE-1' && T.lauf.stand().basis?.existiert === true);
  }

  {
    // Nr. 27: je eigener Fall kein iveo-Abruf; Zugriffe nur nach den Ausnahmen aus 9.2
    const fall = async (name: string, setze: (T: ReturnType<typeof AttC.baueLauf>) => void, erwartet: string, mehr: (T: ReturnType<typeof AttC.baueLauf>) => boolean = () => true) => {
      const T = AttC.baueLauf();
      T.fs.ordner(AttC.BASIS);
      setze(T);
      const seit = ab(T.fs);
      await T.takt();
      await T.takt();
      const gesehen = ops(seit());
      ck(`P13 12.4 Nr. 27: ${name} → kein iveo-Abruf, Zugriffe: ${erwartet || 'keine'}`, gesehen === erwartet && T.agenda.aufrufe.length === 0 && mehr(T));
    };
    await fall('Rolle slave', (T) => { T.z.rolle = 'slave'; }, '');
    await fall('Rolle slave ohne Kopplung (Stand nennt die Rolle für K1)', (T) => { T.z.rolle = 'slave'; }, '', (T) => T.lauf.stand().rolle === 'slave');
    await fall('kein Token', (T) => { T.z.token = false; }, '', (T) => T.lauf.stand().tokenDa === false);
    await fall('Schalter aus', (T) => { T.z.schalter = false; }, `stat ${pathC.relative(AttC.ROOT, AttC.BASIS)}, stat ${pathC.relative(AttC.ROOT, AttC.BASIS)}`,
      (T) => T.lauf.stand().schalterAn === false && T.lauf.stand().basis?.existiert === true && T.lauf.ordnerPfadFuer() === AttC.BASIS);
    const fremd = JSON.stringify({ format: 1, rechner: 'REGIE-2', pid: 99, sitzung: 'fremd-1', lebenszeichen: new Date(Date.UTC(2026, 9, 16, 7, 59)).toISOString() });
    await fall('fremde gültige Sperre', (T) => { T.fs.lege(SPERRE, fremd); }, 'readFile Show, readFile Sperre, readFile Show, readFile Sperre',
      (T) => T.lauf.stand().sperre?.art === 'fremd' && T.lauf.stand().sperre?.rechner === 'REGIE-2');
  }
  {
    // Schalter aus und eine stat, die nicht zurückkehrt: höchstens eine je Takt, keine zweite, solange sie aussteht
    const T = AttC.baueLauf();
    T.z.schalter = false;
    T.fs.haengtBei('stat', (p) => p === AttC.BASIS);
    for (let i = 0; i < 3; i++) { T.lauf.takt(); await AttC.ruhe(); await T.uhr.spule(45_000, 45_000); }
    ck('P13 12.4 Nr. 27: Schalter aus, stat hängt → über drei Takte genau eine stat, sonst kein Zugriff',
      T.fs.zaehle('stat') === 1 && T.fs.protokoll.length === 1 && T.fs.haengend === 1);
  }
  {
    // namensgleiche Sperre: nur Show-Datei und Sperrdatei, dann bis zur neuen Sitzung gar nichts mehr
    const fs = new AttC.FsAttrappe('NTFS');
    fs.ordner(AttC.BASIS);
    const A = AttC.baueLauf({ fs });
    const B = AttC.baueLauf({ fs });
    await A.takt();
    await B.takt(); // B übernimmt als „eigen aus einer früheren Sitzung“
    const seit = ab(fs);
    await A.takt(); // A merkt: dieselbe Kennung des Rechners, andere Sitzung, er hielt sie schon → namensgleich
    await A.takt();
    ck('P13 12.4 Nr. 27: namensgleiche Sperre → kein Abruf; Zugriffe nur Show-Datei und Sperrdatei, danach keiner mehr',
      ops(seit()) === 'readFile Show, readFile Sperre' && A.agenda.aufrufe.length === 0);
  }
  {
    // Token fällt mitten in der Sitzung weg: danach außer dem einmaligen Löschen der eigenen Sperre kein Zugriff
    const T = AttC.baueLauf();
    T.fs.ordner(AttC.BASIS);
    await T.takt();
    const vorher = sperreVon(T.fs)?.sitzung;
    T.z.token = false;
    const seit = ab(T.fs);
    await T.takt();
    await T.takt();
    await T.takt();
    ck('P13 12.4 Nr. 27: Token fällt mitten in der Sitzung weg (Kern weiter aktiv) → einmal Sperre lesen und löschen, sonst nichts',
      typeof vorher === 'string' && ops(seit()) === 'readFile Sperre, unlink Sperre' && sperreVon(T.fs) === null);
  }

  {
    // Nr. 40 (a): zwei Rechner auf derselben Ablage
    const fs = new AttC.FsAttrappe('NTFS');
    fs.ordner(AttC.BASIS);
    const uhr = new AttC.TestUhr();
    const A = AttC.baueLauf({ fs, uhr, rechner: 'REGIE-1' });
    const B = AttC.baueLauf({ fs, uhr, rechner: 'REGIE-2', pid: 5000 });
    await A.takt();
    const seit = ab(fs);
    await B.takt();
    const sB = B.lauf.stand().sperre;
    ck('P13 12.4 Nr. 40 (a): zwei Rechner → nur einer hält die Sperre, der andere liest nur Show-Datei und Sperrdatei',
      sperreVon(fs)?.rechner === 'REGIE-1' && ops(seit()) === 'readFile Show, readFile Sperre');
    ck('P13 12.4 Nr. 40 (a): … sein Stand nennt den fremden Rechner und dessen Lebenszeichen (K5, T57), nie den eigenen Namen',
      sB?.art === 'fremd' && sB.rechner === 'REGIE-1' && sB.lebenszeichen === new Date(uhr.t).toISOString());
    ck('P13 9.13, 11.1 K5: „Ordner öffnen“ auf dem Rechner ohne Sperre führt zum Basisordner (er hat die Sperrdatei daraus gelesen, OF10)',
      ZeilenC.kopfzeile(B.lauf.stand(), uhr.t).ordnerOeffnen && B.lauf.ordnerPfadFuer() === AttC.BASIS);
    await uhr.spule(14 * 60_000 + 59_000, 60_000);
    await B.takt();
    ck('P13 12.4 Nr. 40 (a): Lebenszeichen 14:59 min alt → weiter fremd', B.lauf.stand().sperre?.art === 'fremd' && sperreVon(fs)?.rechner === 'REGIE-1');
    await uhr.spule(1_000);
    await B.takt();
    ck('P13 12.4 Nr. 40 (a): Lebenszeichen genau 15 min alt → übernommen, kein K5 mehr',
      sperreVon(fs)?.rechner === 'REGIE-2' && B.lauf.stand().sperre === null);
    await A.takt();
    ck('P13 12.4 Nr. 40 (a): der erste Rechner sieht danach die Sperre des zweiten (fremd) und legt nicht mehr ab',
      A.lauf.stand().sperre?.art === 'fremd' && A.lauf.stand().sperre?.rechner === 'REGIE-2' && sperreVon(fs)?.rechner === 'REGIE-2');
  }
  {
    // Nr. 40 (b): Neustart mit gleichem Rechnernamen, neuer Sitzung und neuer pid, Lebenszeichen 1 min alt
    const fs = new AttC.FsAttrappe('NTFS');
    fs.ordner(AttC.BASIS);
    const uhr = new AttC.TestUhr();
    const A = AttC.baueLauf({ fs, uhr });
    await A.takt();
    const sitzungA = sperreVon(fs)?.sitzung;
    await uhr.spule(60_000, 60_000);
    const B = AttC.baueLauf({ fs, uhr, pid: 5000 }); // A ist „beendet“ (taktet nicht mehr)
    await B.takt();
    ck('P13 12.4 Nr. 40 (b): Neustart → übernimmt im ersten Takt (Regel 3), kein K5, kein eigener Name in einer Zeile',
      B.lauf.stand().sperre === null && sperreVon(fs)?.sitzung !== sitzungA && sperreVon(fs)?.pid === 5000);
    // ebenso nach einem Show-Wechsel hin und zurück im selben Lauf
    B.z.aktiv = { path: pathC.join(AttC.ROOT, 'Shows', 'Andere.jmshow'), event: 'cop31', filter: { programId: 'se-1' } };
    B.lauf.sitzung();
    await B.lauf.ruhig();
    B.z.aktiv = { path: AttC.SHOW_PFAD, event: 'cop31', filter: { programId: 'se-1' } };
    B.lauf.sitzung();
    await B.takt();
    ck('P13 12.4 Nr. 40 (b): Show-Wechsel hin und zurück → übernimmt im ersten Takt, kein K5',
      B.lauf.stand().sperre === null && typeof sperreVon(fs)?.sitzung === 'string' && sperreVon(fs)?.pid === 5000);
  }
  {
    // Nr. 40 (c): Ende der Ablage je Auslöser → eigene Sperre gelöscht; ein wartender Rechner übernimmt im nächsten Takt
    const ausloeser: Array<[string, (T: ReturnType<typeof AttC.baueLauf>) => Promise<void>]> = [
      ['Rolle wird slave', async (T) => { T.z.rolle = 'slave'; await T.takt(); }],
      ['Token fällt weg', async (T) => { T.z.token = false; await T.takt(); }],
      ['Schalter aus', async (T) => { T.z.schalter = false; await T.takt(); }],
      ['andere Show geöffnet', async (T) => { T.z.aktiv = { path: pathC.join(AttC.ROOT, 'Shows', 'Andere.jmshow'), event: 'cop31', filter: {} }; T.lauf.sitzung(); await T.lauf.ruhig(); }],
      ['beenden()', async (T) => { T.lauf.beenden(); await T.lauf.ruhig(); }],
    ];
    for (const [name, tu] of ausloeser) {
      const fs = new AttC.FsAttrappe('NTFS');
      fs.ordner(AttC.BASIS);
      const uhr = new AttC.TestUhr();
      const A = AttC.baueLauf({ fs, uhr });
      const B = AttC.baueLauf({ fs, uhr, rechner: 'REGIE-2', pid: 5000 });
      await A.takt();
      await B.takt();
      await tu(A);
      const geloescht = sperreVon(fs) === null;
      await uhr.spule(45_000, 45_000);
      await B.takt();
      ck(`P13 12.4 Nr. 40 (c): ${name} → eigene Sperre gelöscht, der wartende Rechner übernimmt im nächsten Takt`,
        geloescht && sperreVon(fs)?.rechner === 'REGIE-2' && B.lauf.stand().sperre === null);
    }
    {
      const T = AttC.baueLauf();
      T.fs.ordner(AttC.BASIS);
      await T.takt();
      T.fs.lege(SPERRE, JSON.stringify({ format: 1, rechner: 'REGIE-1', pid: 1, sitzung: 'eine-andere', lebenszeichen: new Date(T.uhr.t).toISOString() }));
      T.z.rolle = 'slave';
      await T.takt();
      ck('P13 12.4 Nr. 40 (c): trägt die Sperre inzwischen eine andere Sitzung, bleibt sie', sperreVon(T.fs)?.sitzung === 'eine-andere');
    }
    {
      const T = AttC.baueLauf();
      T.fs.ordner(AttC.BASIS);
      await T.takt();
      await T.fs.rename(AttC.SHOW_PFAD, AttC.SHOW_PFAD + '.x');
      await T.takt();
      ck('P13 12.4 Nr. 40 (c): Show-Datei fehlt → Sperre bleibt (die Ablage läuft weiter, sobald sie wieder da ist)',
        T.lauf.stand().showDatei === 'fehlt' && sperreVon(T.fs)?.rechner === 'REGIE-1');
    }
    {
      const T = AttC.baueLauf();
      T.fs.ordner(AttC.BASIS);
      await T.takt();
      T.fs.fehlerBei('unlink', (p) => p === SPERRE, 'EPERM');
      T.z.schalter = false;
      await T.takt();
      ck('P13 12.4 Nr. 40 (c): Löschen scheitert → T75 im Log',
        T.logs.includes('warn iveo-Ordner: Sperrdatei in „COP31 Tag 1 – Side Events“ nicht gelöscht (EPERM); ein anderer Rechner übernimmt die Ablage erst nach 15 Minuten.'));
    }
  }
  {
    // Nr. 40 (d): zwei Läufe mit gleichem Rechnernamen
    const fs = new AttC.FsAttrappe('NTFS');
    fs.ordner(AttC.BASIS);
    const uhr = new AttC.TestUhr();
    const A = AttC.baueLauf({ fs, uhr });
    const B = AttC.baueLauf({ fs, uhr, pid: 5000 });
    await A.takt();
    await B.takt();
    const sitzungB = sperreVon(fs)?.sitzung;
    await uhr.spule(45_000, 45_000);
    await A.takt();
    await B.takt();
    await uhr.spule(45_000, 45_000);
    await A.takt();
    await B.takt();
    const sA = A.lauf.stand().sperre;
    ck('P13 12.4 Nr. 40 (d): namensgleich → ab dem nächsten Takt des ersten legt nur noch einer ab (die Sperre bleibt beim zweiten)',
      sperreVon(fs)?.sitzung === sitzungB && B.lauf.stand().sperre === null);
    ck('P13 12.4 Nr. 40 (d): … der andere zeigt K5 namensgleich (T73) mit dem Rechnernamen und löscht die Sperre nicht',
      sA?.art === 'namensgleich' && sA.rechner === 'REGIE-1' && fs.zaehle('unlink', (p) => p === SPERRE) === 0);
  }
  {
    // Nr. 40 (b): Show neu geöffnet, das angestoßene Löschen der alten Sperre hängt am Laufwerk; der nächste Takt darf
    // seine neue Sperre erst danach schreiben, sonst löscht das späte unlink sie wieder (zwei Rechner sähen „frei“).
    const T = AttC.baueLauf();
    T.fs.ordner(AttC.BASIS);
    await T.takt();
    const alt = sperreVon(T.fs)?.sitzung;
    const tor = T.fs.torBei('unlink', (p) => p === SPERRE);
    T.lauf.sitzung();
    await AttC.ruhe();
    T.lauf.takt();
    await AttC.ruhe();
    tor.weiter();
    await T.lauf.ruhig();
    const neu = sperreVon(T.fs)?.sitzung;
    ck('P13 12.4 Nr. 40 (b): das Löschen der alten Sperre wartet am Laufwerk → der nächste Takt wartet darauf, die neue Sperre bleibt stehen',
      tor.erreicht() && typeof alt === 'string' && typeof neu === 'string' && neu !== alt);
  }
  {
    // OFP6, 11.1 K6: Sperrdatei im vorhandenen Basisordner nicht lesbar bzw. nicht schreibbar → eigener Text (T78), nächster
    // Versuch = nächster Takt (vor der ersten Runde gibt es kein „gegen“; „--:--“ oder die Zeit einer vorigen Runde wären falsch).
    const hhmm = (ms: number): string => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const NAME = pathC.basename(AttC.BASIS);
    const agenda = [AttC.punkt('se-1', [AttC.datei('m-1', 'Folien')])];
    const k6 = async (setze: (fs: AttC.FsAttrappe) => void) => {
      const T = AttC.baueLauf();
      T.fs.ordner(AttC.BASIS);
      setze(T.fs);
      const t = T.takt(agenda);
      await T.uhr.spule(1_000, 50); // bis zu fünf Versuche im Abstand von 50 ms beim Umbenennen
      await t;
      return { T, k: ZeilenC.kopfzeile(T.lauf.stand(), T.uhr.t) };
    };
    {
      const { T, k } = await k6((fs) => fs.fehlerBei('readFile', (p) => p === SPERRE, 'EACCES'));
      // Ein Lesefehler außer ENOENT und ENOTDIR zeigt den Ordner: „Ordner öffnen“ bleibt (Festlegung 18.10.2026, OFP6).
      const nd = await k6((fs) => fs.fehlerBei('readFile', (p) => p === SPERRE, 'ENOTDIR'));
      ck('P13 11.1 K6, OFP6: Sperrdatei vor der ersten Runde nicht lesbar (EACCES) → T78 „… nicht lesbar“, nächster Versuch gegen den nächsten Takt, „Ordner öffnen“ (bei ENOTDIR nicht)',
        k.fall === 'K6' && k.text === `Sperrdatei in „${NAME}“ nicht lesbar (EACCES). Nächster Versuch gegen ${hhmm(T.uhr.t + 45_000)}.` && T.agenda.aufrufe.length === 0
        && k.ordnerOeffnen && T.lauf.ordnerPfadFuer() === AttC.BASIS
        && nd.k.fall === 'K6' && nd.k.text === `Sperrdatei in „${NAME}“ nicht lesbar (ENOTDIR). Nächster Versuch gegen ${hhmm(nd.T.uhr.t + 45_000)}.`
        && !nd.k.ordnerOeffnen && nd.T.lauf.ordnerPfadFuer() === null);
      T.fs.regelnLoeschen();
      await T.uhr.spule(45_000, 45_000);
      await T.takt(agenda);
      ck('P13 11.1 K6: der nächste Takt versucht es wirklich; lesbar → K6 weg, die Sperre dieser Sitzung steht',
        T.lauf.stand().basis?.fehler === null && sperreVon(T.fs)?.rechner === 'REGIE-1' && ZeilenC.kopfzeile(T.lauf.stand(), T.uhr.t).fall !== 'K6');
    }
    {
      const { T, k } = await k6((fs) => fs.fehlerBei('rename', (p) => p.startsWith(`${SPERRE}.`), 'EPERM'));
      ck('P13 11.1 K6, OFP6: Sperrdatei nicht schreibbar (EPERM beim Umbenennen, fünf Versuche) → T78 „… nicht schreibbar“, „Ordner öffnen“ (der Ordner ist da)',
        k.fall === 'K6' && k.text === `Sperrdatei in „${NAME}“ nicht schreibbar (EPERM). Nächster Versuch gegen ${hhmm(T.uhr.t + 45_000)}.` && k.ordnerOeffnen
        && T.fs.zaehle('rename', (p) => p.startsWith(`${SPERRE}.`)) === 5 && !T.fs.namen(AttC.BASIS).some((n) => n.endsWith('.tmp')));
    }
    {
      const { T, k } = await k6((fs) => fs.fehlerBei('open', (p) => p.startsWith(`${SPERRE}.`), 'EROFS'));
      ck('P13 11.1 K6: Basisordner nur lesbar (EROFS beim Anlegen der Zwischendatei) vor der ersten Runde → Zeit des nächsten Takts, nicht „--:--“',
        k.fall === 'K6' && k.text === `Sperrdatei in „${NAME}“ nicht schreibbar (EROFS). Nächster Versuch gegen ${hhmm(T.uhr.t + 45_000)}.`);
    }
  }
  {
    // 9.12 Regel 11, 12.4 Nr. 35: Der Basisordner ist eine Verknüpfung → K6, die Sperre wird nicht geschrieben, nichts darunter
    const T = AttC.baueLauf();
    const WOANDERS = pathC.join(AttC.ROOT, 'woanders');
    T.fs.ordner(WOANDERS);
    T.fs.verknuepfung(AttC.BASIS, WOANDERS);
    await T.takt([AttC.punkt('se-1', [AttC.datei('m-1', 'Folien')])]);
    const unter = T.fs.protokoll.filter((x) => [x.p, x.p2].some((p) => p !== undefined && p.startsWith(`${AttC.BASIS}${pathC.sep}`)));
    const k = ZeilenC.kopfzeile(T.lauf.stand(), T.uhr.t);
    ck('P13 9.12 Regel 11, 12.4 Nr. 35: Basisordner als Verknüpfung → K6 „nicht anlegbar (Verknüpfung)“, darunter nur das Lesen der Sperrdatei',
      k.fall === 'K6' && (k.text ?? '').startsWith(`Ordner „${pathC.basename(AttC.BASIS)}“ nicht anlegbar (Verknüpfung).`)
      && unter.every((x) => x.op === 'readFile') && T.fs.namen(WOANDERS).length === 0 && T.agenda.aufrufe.length === 0);
  }
  {
    // Fix-Runde 1, Befund 1: Rennen zwischen sitzung()/beenden() und einem Schreiben der Sperre, das noch läuft (rename wartet)
    const mitTor = async (ausloeser: (T: ReturnType<typeof AttC.baueLauf>) => void) => {
      const T = AttC.baueLauf();
      T.fs.ordner(AttC.BASIS);
      const tor = T.fs.torBei('rename', (p) => p.startsWith(`${SPERRE}.`));
      T.lauf.takt();
      await AttC.ruhe();
      const dagewesen = tor.erreicht();
      ausloeser(T);
      tor.weiter();
      await T.lauf.ruhig();
      return { T, dagewesen };
    };
    const a = await mitTor((T) => T.lauf.sitzung());
    ck('P13 12.4 Nr. 40 (b): sitzung() während das Umbenennen der Sperre wartet → die eben geschriebene Sperre der alten Sitzung wird gelöscht',
      a.dagewesen && sperreVon(a.T.fs) === null && a.T.fs.zaehle('unlink', (p) => p === SPERRE) === 1);
    await a.T.takt();
    ck('P13 12.4 Nr. 40 (b): … der nächste Takt schreibt die Sperre der neuen Sitzung und behauptet nie, ein zweiter Launcher habe übernommen (kein K5)',
      sperreVon(a.T.fs)?.rechner === 'REGIE-1' && a.T.lauf.stand().sperre === null);
    const b = await mitTor((T) => T.lauf.beenden());
    ck('P13 12.4 Nr. 40 (c): beenden() während das Umbenennen der Sperre wartet → die Sperre bleibt nicht liegen (Ende der Ablage, 9.2)',
      b.dagewesen && sperreVon(b.T.fs) === null && b.T.fs.zaehle('unlink', (p) => p === SPERRE) === 1);
  }
  {
    // Fix-Runde 2: dasselbe Rennen, aber während der lstat-Prüfung des Basisordners (Festhalten von gen und sitzung vor basisArt)
    const SHOW_B = pathC.join(AttC.ROOT, 'Shows', 'Andere.jmshow');
    const B_SPERRE = pathC.join(AttC.ROOT, 'Shows', 'Andere – Side Events', OrdnerC.SPERR_DATEI);
    const mitLstat = async (ausloeser: (T: ReturnType<typeof AttC.baueLauf>) => void) => {
      const T = AttC.baueLauf();
      T.fs.ordner(AttC.BASIS);
      T.fs.ordner(pathC.join(AttC.ROOT, 'Shows', 'Andere – Side Events'));
      T.fs.lege(SHOW_B, AttC.showText([{ id: 'se-1', title: 'Klima' }], { programId: 'se-1' } as never));
      const tor = T.fs.torBei('lstat', (p) => p === AttC.BASIS);
      T.lauf.takt();
      await AttC.ruhe();
      const dagewesen = tor.erreicht();
      ausloeser(T);
      tor.weiter();
      await T.lauf.ruhig();
      return { T, dagewesen };
    };
    const a = await mitLstat((T) => {
      T.z.aktiv = { path: SHOW_B, event: 'cop31', filter: { programId: 'se-1' } as never };
      T.lauf.sitzung();
    });
    ck('P13 12.4 Nr. 40 (b): sitzung() mit Show-Wechsel, während die lstat-Prüfung des Basisordners wartet → in der Sperre von Show A bleibt keine Sperre der neuen Sitzung stehen',
      a.dagewesen && sperreVon(a.T.fs) === null && a.T.fs.zaehle('unlink', (p) => p === SPERRE) === 1);
    await a.T.takt();
    a.T.lauf.beenden();
    await a.T.lauf.ruhig();
    ck('P13 12.4 Nr. 40 (b): … nach dem nächsten Takt und beenden() liegt weder in Show A noch in Show B eine Sperre',
      sperreVon(a.T.fs) === null && a.T.fs.inhalt(B_SPERRE) === null);
  }
  {
    // Fix-Runde 1, Befund 2: Schalter aus, stat hängt → die stat läuft abgelöst; der Lauf kommt nach Schalter an wieder in Gang
    const T = AttC.baueLauf();
    T.z.schalter = false;
    T.fs.haengtBei('stat', (p) => p === AttC.BASIS);
    for (let i = 0; i < 3; i++) { T.lauf.takt(); await AttC.ruhe(); await T.uhr.spule(45_000, 45_000); }
    T.z.schalter = true;
    T.fs.ordner(AttC.BASIS);
    T.lauf.takt();
    await AttC.ruhe();
    ck('P13 12.4 Nr. 27: Schalter aus, stat hängt, dann Schalter an → der nächste Takt läuft (Stand schalterAn, Sperre geschrieben), die Zeile lügt nicht',
      T.lauf.stand().schalterAn === true && sperreVon(T.fs)?.rechner === 'REGIE-1');
  }
  {
    // Fix-Runde 1, Befund 3: der Stand geht vor den Dateizugriffen hinaus; ein hängender Zugriff hält ihn nicht zurück
    const T = AttC.baueLauf();
    T.fs.ordner(AttC.BASIS);
    await T.takt();
    T.fs.haengtBei('unlink', (p) => p === SPERRE);
    T.z.rolle = 'slave';
    T.lauf.takt();
    await AttC.ruhe();
    ck('P13 11.1 K1: Rolle wird slave, das Löschen der Sperre hängt → der Stand nennt die Rolle trotzdem sofort (Kopfzeile K1)',
      T.staende[T.staende.length - 1]?.rolle === 'slave' && T.fs.haengend === 1);
    const S = AttC.baueLauf();
    S.fs.ordner(AttC.BASIS);
    S.fs.fehlerBei('readFile', (p) => p === SPERRE, 'EACCES');
    await S.takt();
    const vorher = S.staende.length;
    ck('P13 11.1 K6: Vorbedingung – Sperrdatei nicht lesbar', S.staende[S.staende.length - 1]?.basis?.fehler?.sperre === 'lesen');
    S.lauf.sitzung();
    const letzter = S.staende[S.staende.length - 1];
    ck('P13 9.2: sitzung() meldet den neuen Stand sofort (Show offen, keine Fehlerzeile der alten Sitzung)',
      S.staende.length > vorher && letzter?.showOffen === true && letzter?.basis === null);
  }
  {
    // Fix-Runde 1, Befund 3: K6 sagt auch dann die Wahrheit, wenn der Folgetakt hängt – nach Ablauf T59 mit der Zeit des Versuchs (11.1)
    const V = new Date(2026, 9, 17, 8, 0, 0).getTime();
    const NAME = 'COP31 Tag 1 – Side Events';
    const k6 = (fehler: { code: string; sperre?: 'lesen' | 'schreiben' }, jetzt: number) => ZeilenC.kopfzeile({
      showOffen: true, rolle: 'master', tokenDa: true, schalterAn: true, showDatei: 'da', sperre: null,
      basis: { name: NAME, pfad: '/Shows/x', existiert: true, fehler: { ...fehler, naechsterVersuch: new Date(V).toISOString() } },
      runde: null, ersteRundeGestartet: false, naechsteRundeGegen: null, letzterFortschritt: null, sideEvents: [],
    }, jetzt);
    ck('P13 11.1 K6: genau 45 s nach dem nächsten Versuch → noch T78',
      k6({ code: 'EACCES', sperre: 'lesen' }, V + 45_000).text === `Sperrdatei in „${NAME}“ nicht lesbar (EACCES). Nächster Versuch gegen 08:00.`);
    const spaet = k6({ code: 'EACCES', sperre: 'lesen' }, V + 46_000);
    ck('P13 11.1 K6: 46 s nach dem nächsten Versuch → T59 mit der Zeit des Versuchs, K6, „Ordner öffnen“ bleibt',
      spaet.fall === 'K6' && spaet.text === `Ablage: „${NAME}“ · Abgleich überfällig seit 08:00` && spaet.ordnerOeffnen);
    const spaet2 = k6({ code: 'EACCES' }, V + 30 * 60_000);
    ck('P13 11.1 K6: Ordner nicht anlegbar, 30 min später → T59, kein „Ordner öffnen“',
      spaet2.fall === 'K6' && spaet2.text === `Ablage: „${NAME}“ · Abgleich überfällig seit 08:00` && !spaet2.ordnerOeffnen);
  }
  ck('P13 9.2: T75 wörtlich',LaufC.LAUF_TEXTE.sperreNichtGeloescht('X', 'EPERM') === 'iveo-Ordner: Sperrdatei in „X“ nicht gelöscht (EPERM); ein anderer Rechner übernimmt die Ablage erst nach 15 Minuten.');
}

// ── Block C · P14: Warteschlange, Runde, Lauf-Generation, Ablage-Menge im Lauf (Spec 9.3, 9.4) ──────────────────
import { IveoApiError as IveoApiErrorC } from '@jm/iveo';

console.log('— P14 Warteschlange, Runde, Generation, Ablage-Menge (Spec 9.3, 9.4)');
{
  const isoC = (ms: number): string => new Date(ms).toISOString();
  const SPERRE = pathC.join(AttC.BASIS, OrdnerC.SPERR_DATEI);
  const SE3 = [{ id: 'se-1', title: 'Klima' }, { id: 'se-2', title: 'Wasser' }, { id: 'se-3', title: 'Wald' }];
  // Agenda, deren materials-Zugriff mitzählt: jede Ausführung eines Eintrags liest sie genau einmal (pruefeAnhaenge).
  const zaehlAgenda = (programId: string, ms: MaterialC[], z: { n: number }) =>
    [{ id: `${programId}-p1`, program_id: programId, title: 'Punkt', get materials() { z.n++; return ms; } }];
  const meldeAktiv = (T: ReturnType<typeof AttC.baueLauf>, agenda: unknown[]) =>
    T.lauf.agendaAktiv('se-1', { ok: true, agenda: agenda as never, abgerufen: isoC(T.uhr.t) });

  {
    const T = AttC.baueLauf();
    ck('P14 9.4: vor dem ersten Takt ist die erste Runde nicht gestartet (K8)', T.lauf.stand().ersteRundeGestartet === false);
    await T.takt([AttC.punkt('se-1', [])]);
    ck('P14 12.4 Nr. 25: Side Event ohne Anhänge → kein Ordner, auch kein Basisordner (OF4); Abgleich gelungen mit 0 Anhängen',
      !T.fs.gibt(AttC.BASIS) && T.fs.zaehle('mkdir') === 0 && T.se('se-1')?.abruf === 'gelungen' && T.se('se-1')?.n === 0 && T.se('se-1')?.existiert === false);
    await T.uhr.spule(45_000, 45_000);
    await T.takt([AttC.punkt('se-1', [AttC.datei('m-1', 'Bericht')])]);
    ck('P14 12.4 Nr. 25: erster Anhang → Basis- und Side-Event-Ordner entstehen, mit dem Basisordner die Sperrdatei',
      T.fs.gibt(pathC.join(AttC.BASIS, 'Klima')) && T.fs.gibt(SPERRE) && T.se('se-1')?.ordnerName === 'Klima' && T.se('se-1')?.existiert === true && T.se('se-1')?.n === 1);
    ck('P14 9.13, E35: „Ordner öffnen“ nur aus der programId; ohne Kennung der Basisordner; unbekannt → null',
      T.lauf.ordnerPfadFuer('se-1') === pathC.join(AttC.BASIS, 'Klima') && T.lauf.ordnerPfadFuer() === AttC.BASIS && T.lauf.ordnerPfadFuer('gibt-es-nicht') === null);
  }
  {
    const T = AttC.baueLauf();
    const staende: string[] = [];
    for (let i = 0; i < 3; i++) {
      await T.takt([AttC.punkt('se-1', [])]);
      staende.push(T.se('se-1')?.stand ?? '');
      await T.uhr.spule(45_000, 45_000);
    }
    ck('P14 12.4 Nr. 28: aktives Side Event jeden Takt aus der Agenda des Kerns, ohne eigenen Abruf (Stand je Takt neu)',
      T.agenda.aufrufe.length === 0 && new Set(staende).size === 3 && staende.every((x) => x !== '') && T.se('se-1')?.aktiv === true);
  }
  {
    const T = AttC.baueLauf({ sideEvents: SE3 });
    const start = T.uhr.t;
    const rundenStarts: number[] = [];
    for (let i = 0; i <= 12; i++) {
      const vorher = T.agenda.aufrufe.length;
      await T.takt([]);
      if (T.agenda.aufrufe.length > vorher) rundenStarts.push((T.uhr.t - start) / 1000);
      await T.uhr.spule(45_000, 45_000);
    }
    ck('P14 12.4 Nr. 28: Runde über die übrigen Side Events nach Regel 6.1 (Takt 45 s: Start, +270 s, +540 s)',
      JSON.stringify(rundenStarts) === '[0,270,540]' && T.agenda.aufrufe.join(',') === 'se-2,se-3,se-2,se-3,se-2,se-3');
    ck('P14 9.4: nächste Runde gegen Start der vorigen + 270 s (Kopfzeile „gegen ‹hh:mm›“)',
      T.lauf.stand().ersteRundeGestartet === true && T.lauf.stand().naechsteRundeGegen === isoC(start + 540_000 + 270_000));
    const runden = T.staende.map((s) => (s.runde ? `${s.runde.i}/${s.runde.n}` : '-'));
    ck('P14 11.1: während der Runde „‹i› von ‹n›“ (1/2, 2/2), danach keine Runde', runden.includes('1/2') && runden.includes('2/2') && runden[runden.length - 1] === '-');
    ck('P14 9.3: Stand je Side Event der Menge, das aktive markiert',
      T.lauf.stand().sideEvents.map((s) => `${s.programId}:${s.aktiv ? 'aktiv' : '-'}:${s.inMenge ? 'Menge' : '-'}:${s.titel}`).join(' ') === 'se-1:aktiv:Menge:Klima se-2:-:Menge:Wasser se-3:-:Menge:Wald');
  }
  {
    let gibFrei: () => void = () => undefined;
    const T = AttC.baueLauf({ sideEvents: SE3 });
    T.agenda.agenden.set('se-2', () => new Promise((ok) => { gibFrei = () => ok([]); }));
    let se1BeiSe3: string | undefined;
    T.agenda.agenden.set('se-3', async () => { se1BeiSe3 = T.se('se-1')?.abruf; return []; });
    T.lauf.takt();
    await AttC.ruhe();
    const n = { n: 0 };
    for (let i = 0; i < 3; i++) {
      meldeAktiv(T, zaehlAgenda('se-1', [], n));
      T.lauf.takt();
      await AttC.ruhe();
    }
    ck('P14 12.4 Nr. 28: während ein Abruf hängt, beginnt im Ordner-Teil kein zweiter (Attrappe misst keine Überlappung)',
      T.g.max === 1 && T.agenda.aufrufe.join(',') === 'se-2');
    gibFrei();
    await T.lauf.ruhig();
    ck('P14 12.4 Nr. 28: das aktive Side Event läuft nach dem laufenden Schritt, vor den übrigen der Runde',
      se1BeiSe3 === 'gelungen' && T.agenda.aufrufe.join(',') === 'se-2,se-3');
    ck('P14 12.4 Nr. 28, E48: je Side Event höchstens ein Eintrag – dreimal gemeldet, während es wartet, einmal ausgeführt',
      n.n === 1);
  }
  {
    const T = AttC.baueLauf();
    const tor = T.fs.torBei('mkdir', (p) => p === pathC.join(AttC.BASIS, 'Klima'));
    const n = { n: 0 };
    meldeAktiv(T, zaehlAgenda('se-1', [AttC.datei('m-1', 'Bericht')], n));
    T.lauf.takt();
    await AttC.ruhe();
    for (let i = 0; i < 3; i++) {
      await T.uhr.spule(45_000, 45_000);
      meldeAktiv(T, zaehlAgenda('se-1', [AttC.datei('m-1', 'Bericht')], n));
      T.lauf.takt();
      await AttC.ruhe();
    }
    tor.weiter();
    await T.lauf.ruhig();
    ck('P14 9.4, E48: läuft der Eintrag gerade, wird er nach dem Ende genau einmal neu eingereiht (dreimal gemeldet → ein Nachlauf)',
      tor.erreicht() && n.n === 2);
  }
  {
    let gibFrei: (a: unknown) => void = () => undefined;
    const T = AttC.baueLauf({ sideEvents: [SE3[0], SE3[1]] });
    T.agenda.agenden.set('se-2', () => new Promise((ok) => { gibFrei = ok; }));
    T.lauf.takt();
    await AttC.ruhe();
    T.z.aktiv = { path: pathC.join(AttC.ROOT, 'Shows', 'Andere.jmshow'), event: 'cop31', filter: { programId: 'x' } };
    T.lauf.sitzung();
    await AttC.ruhe();
    const seit = T.fs.protokoll.length;
    gibFrei([AttC.punkt('se-2', [AttC.datei('m-2', 'Spät')])]);
    await T.lauf.ruhig();
    ck('P14 12.4 Nr. 23: Show-Wechsel mitten im Abruf → das späte Ergebnis wird verworfen, ohne Plan und ohne Dateizugriff',
      T.fs.protokoll.length === seit && !T.fs.gibt(pathC.join(AttC.BASIS, 'Wasser')) && T.lauf.stand().sideEvents.length === 0);
  }
  {
    // 67 Programme über drei Tage (Prod-Größe, M5), Filter {programId}, aktives Side Event an Tag 2, 4 ohne Tag
    const tage: Record<string, string> = {};
    const liste = Array.from({ length: 67 }, (_, i) => ({ id: `p${i}`, title: `Programm ${i}` }));
    for (let i = 0; i < 63; i++) tage[`p${i}`] = `2026-11-1${i % 3}`;
    const T = AttC.baueLauf({ sideEvents: liste, filter: { programId: 'p1' }, tage });
    for (const p of liste) T.agenda.agenden.set(p.id, [AttC.punkt(p.id, [AttC.datei(`m-${p.id}`, 'Folien')])]);
    T.z.aktiv = { path: AttC.SHOW_PFAD, event: 'cop31', filter: { programId: 'p1' } };
    T.lauf.agendaAktiv('p1', { ok: true, agenda: [AttC.punkt('p1', [AttC.datei('m-p1', 'Folien')])], abgerufen: isoC(T.uhr.t) });
    await T.takt();
    const menge = liste.filter((p) => tage[p.id] === undefined || tage[p.id] === '2026-11-11');
    ck('P14 12.4 Nr. 42: 67 Programme über drei Tage, aktives an Tag 2 → abgerufen nur Tag 2 und die ohne Tag; das aktive ohne eigenen Abruf',
      [...T.agenda.aufrufe].sort().join(',') === menge.filter((p) => p.id !== 'p1').map((p) => p.id).sort().join(',') && menge.length === 25);
    ck('P14 12.4 Nr. 42: Ordner nur für Tag 2, die ohne Tag und das aktive',
      T.fs.namen(AttC.BASIS).filter((n) => n !== OrdnerC.SPERR_DATEI).join('|') === menge.map((p) => p.title).sort().join('|'));
    const T2 = AttC.baueLauf({ sideEvents: liste, filter: {}, tage });
    T2.z.aktiv = { path: AttC.SHOW_PFAD, event: 'cop31', filter: {} };
    await T2.takt();
    ck('P14 12.4 Nr. 42: Listen-Modus ohne Tag → alle 67 in der Runde', T2.agenda.aufrufe.length === 67);
  }
  {
    // Nr. 29 (hier statt in P13: der Basisordner entsteht erst mit dem ersten Anhang, und „gegen“ kommt aus der Runde)
    const T = AttC.baueLauf();
    T.fs.fehlerBei('mkdir', (p) => p === AttC.BASIS, 'EACCES');
    const start = T.uhr.t;
    const agenda = [AttC.punkt('se-1', [AttC.datei('m-1', 'Bericht')])];
    await T.takt(agenda);
    const k = T.lauf.stand();
    ck('P14 12.4 Nr. 29: Basisordner nicht anlegbar → K6-Felder: Code, nicht da, nächster Versuch gegen Rundenstart + 270 s',
      k.basis?.fehler?.code === 'EACCES' && k.basis.existiert === false && k.naechsteRundeGegen === isoC(start + 270_000)
      && k.basis.fehler.naechsterVersuch === isoC(start + 270_000));
    for (let i = 0; i < 5; i++) { await T.uhr.spule(45_000, 45_000); await T.takt(agenda); }
    ck('P14 12.4 Nr. 29: vor der genannten Zeit kein neuer Versuch (die Zeile verspricht „gegen ‹hh:mm›“)',
      T.fs.zaehle('mkdir', (p) => p === AttC.BASIS) === 1 && T.lauf.stand().basis?.fehler?.code === 'EACCES');
    T.fs.regelnLoeschen();
    await T.uhr.spule(45_000, 45_000);
    await T.takt(agenda);
    ck('P14 12.4 Nr. 29: zur genannten Zeit neuer Versuch, gelingt → Fehler weg, Ordner da',
      T.fs.zaehle('mkdir', (p) => p === AttC.BASIS) === 2 && T.lauf.stand().basis?.fehler === null && T.fs.gibt(pathC.join(AttC.BASIS, 'Klima')));
  }
  {
    // 9.14: Schalter aus und wieder an → die Runde über die übrigen Side Events startet im nächsten Takt, nicht erst 270 s
    // nach dem Start der vorigen (Abnahme Schritt 16, Handbuch)
    const T = AttC.baueLauf({ sideEvents: SE3.slice(0, 2) });
    await T.takt([]);
    await T.uhr.spule(45_000, 45_000);
    T.z.schalter = false;
    await T.takt([]);
    await T.uhr.spule(45_000, 45_000);
    T.z.schalter = true;
    const vorher = T.agenda.aufrufe.join(',');
    await T.takt([]);
    ck('P14 9.14: Schalter aus und wieder an → im nächsten Takt startet die Runde (Abruf des übrigen Side Events, „gegen“ neu)',
      vorher === 'se-2' && T.agenda.aufrufe.join(',') === 'se-2,se-2' && T.lauf.stand().naechsteRundeGegen === isoC(T.uhr.t + 270_000));
  }
  {
    // 11.1 K6, OFP6 (aus der Prüfung robust:3): Sperrdatei in einer späteren Runde nicht lesbar → K6 nennt den nächsten Takt,
    // nicht das längst vergangene „gegen“ der vorigen Runde
    const hhmm = (ms: number): string => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const T = AttC.baueLauf({ sideEvents: SE3.slice(0, 2) });
    T.fs.ordner(AttC.BASIS);
    await T.takt([]);
    const gegen = T.lauf.stand().naechsteRundeGegen;
    await T.uhr.spule(600_000, 60_000);
    T.fs.fehlerBei('readFile', (p) => p === SPERRE, 'EACCES');
    await T.takt([]);
    const k = ZeilenC.kopfzeile(T.lauf.stand(), T.uhr.t);
    ck('P14 11.1 K6: Sperrdatei in einer späteren Runde nicht lesbar → Zeit des nächsten Takts, nicht die längst vergangene der vorigen Runde',
      k.fall === 'K6' && k.text === `Sperrdatei in „${pathC.basename(AttC.BASIS)}“ nicht lesbar (EACCES). Nächster Versuch gegen ${hhmm(T.uhr.t + 45_000)}.`
      && k.ordnerOeffnen && gegen !== null && hhmm(Date.parse(gegen)) !== hhmm(T.uhr.t + 45_000));
  }
  {
    const fs = new AttC.FsAttrappe('NTFS');
    fs.ordner(AttC.BASIS);
    const uhr = new AttC.TestUhr();
    const A = AttC.baueLauf({ fs, uhr, sideEvents: SE3.slice(0, 2) });
    const B = AttC.baueLauf({ fs, uhr, sideEvents: SE3.slice(0, 2), rechner: 'REGIE-2', pid: 5000 });
    await A.takt([]);
    await B.takt([]);
    ck('P14 12.4 Nr. 40 (a): nur der Rechner mit der Sperre ruft iveo ab und gleicht ab',
      A.agenda.aufrufe.join(',') === 'se-2' && B.agenda.aufrufe.length === 0 && B.lauf.stand().sideEvents.length === 0);
  }
  {
    const T = AttC.baueLauf({ sideEvents: SE3.slice(0, 2) });
    T.fs.ordner(AttC.BASIS);
    T.agenda.agenden.set('se-2', () => new Promise(() => undefined));
    T.lauf.takt();
    await AttC.ruhe();
    const vorher = JSON.parse(T.fs.inhalt(SPERRE) ?? '{}').lebenszeichen;
    await T.uhr.spule(45_000, 45_000);
    const r = T.lauf.takt() as unknown;
    await AttC.ruhe();
    const nachher = JSON.parse(T.fs.inhalt(SPERRE) ?? '{}').lebenszeichen;
    ck('P14 9.4: takt() kehrt sofort zurück, auch wenn der Ordner-Teil an einem Abruf hängt; das Lebenszeichen rückt trotzdem vor',
      r === undefined && typeof vorher === 'string' && nachher === isoC(T.uhr.t) && nachher !== vorher);
  }
  {
    // Agenda-Abruf gescheitert: Stand für S9/S10 mit ordnerFehlerText und „seit“, Log T25 nur bei neuem Text
    const T = AttC.baueLauf({ sideEvents: SE3.slice(0, 2) });
    T.agenda.agenden.set('se-2', new IveoApiErrorC(404, 'not_found', 'Programm fehlt'));
    const start = T.uhr.t;
    await T.takt(new Error('Kern meldet 500'));
    const s2 = T.se('se-2');
    const s1 = T.se('se-1');
    ck('P14 9.13: Agenda eines Side Events der Runde scheitert → abruf gescheitert, Text „Agenda in iveo nicht gefunden (404)“, seit = jetzt',
      s2?.abruf === 'gescheitert' && s2.fehler?.text === 'Agenda in iveo nicht gefunden (404)' && s2.fehler.seit === isoC(start));
    ck('P14 9.13, 8.2: scheitert die Agenda des aktiven Side Events beim Kern, zeigt seine Zeile den Fehler aus meldeAgenda',
      s1?.abruf === 'gescheitert' && s1.fehler?.text === 'Kern meldet 500');
    ck('P14 9.13: Log T25 einmal je Side Event, mit Grund und Rohmeldung',
      T.logs.filter((z) => z.startsWith('warn iveo-Ordner: Agenda von')).join('|')
      === 'warn iveo-Ordner: Agenda von „Klima“ nicht abrufbar: Kern meldet 500 (Kern meldet 500).|warn iveo-Ordner: Agenda von „Wasser“ nicht abrufbar: Agenda in iveo nicht gefunden (404) (Programm fehlt).');
    await T.uhr.spule(270_000, 45_000);
    await T.takt(new Error('Kern meldet 500'));
    ck('P14 9.13: derselbe Fehler in der nächsten Runde → kein neues Log, „seit“ bleibt der erste Fehlschlag',
      T.logs.filter((z) => z.startsWith('warn iveo-Ordner: Agenda von')).length === 2 && T.se('se-2')?.fehler?.seit === isoC(start));
    T.agenda.agenden.set('se-2', []);
    await T.uhr.spule(270_000, 45_000);
    await T.takt([]);
    ck('P14 9.13: Abruf gelingt wieder → Fehler weg, abruf gelungen', T.se('se-2')?.abruf === 'gelungen' && T.se('se-2')?.fehler === null && T.se('se-1')?.fehler === null);
  }
}

// ── Block C · P14 Fix-Runde 1: Generation mit hängendem Eintrag, Pause in K4/K6, K6 nach langer Runde, Stand ohne Ordner ──
console.log('— P14 Fix-Runde 1 (Generationswechsel, K4/K6 mit Warteschlange, lange Runde, Abruf ohne Ordner)');
{
  const isoF = (ms: number): string => new Date(ms).toISOString();
  const SPERRE_F = pathC.join(AttC.BASIS, OrdnerC.SPERR_DATEI);
  const SE_F = [{ id: 'se-1', title: 'Klima' }, { id: 'se-2', title: 'Wasser' }, { id: 'se-3', title: 'Wald' }];
  {
    // Befund 1 und 5: Generationswechsel, während der Abruf von se-2 hängt
    let gibFrei: (a: unknown) => void = () => undefined;
    const T = AttC.baueLauf({ sideEvents: SE_F });
    let ersterAbruf = true; // nur der erste Abruf hängt, die späteren antworten sofort
    T.agenda.agenden.set('se-2', () => (ersterAbruf ? ((ersterAbruf = false), new Promise((ok) => { gibFrei = ok; })) : Promise.resolve([])));
    T.lauf.takt();
    await AttC.ruhe();
    T.lauf.sitzung();
    await AttC.ruhe();
    T.lauf.takt();
    await AttC.ruhe();
    ck('P14 Fix 5, 9.4: nach dem Generationswechsel beginnt im Ordner-Teil kein zweiter Abruf, solange der alte hängt',
      T.g.max === 1 && T.agenda.aufrufe.join(',') === 'se-2');
    gibFrei([]);
    await T.lauf.ruhig();
    for (let i = 0; i < 12; i++) { await T.uhr.spule(45_000, 45_000); await T.takt([]); }
    const s = T.lauf.stand();
    ck('P14 Fix 1, 9.4: nach dem Generationswechsel mit hängendem Eintrag wird die Runde fertig (kein dauerhaftes K7)',
      s.runde === null && T.se('se-2')?.abruf === 'gelungen' && T.se('se-3')?.abruf === 'gelungen' && ZeilenC.kopfzeile(s, T.uhr.t).fall !== 'K7');
    ck('P14 Fix 1, 9.4: jede Runde danach läuft (se-2 und se-3 mehrfach abgerufen)',
      T.agenda.aufrufe.filter((x) => x === 'se-2').length >= 3 && T.agenda.aufrufe.filter((x) => x === 'se-3').length >= 3);
  }
  {
    // Befund 2 A: die Show-Datei verschwindet, während der Abruf von se-2 hängt → K4, danach keine Arbeit mehr
    let gibFrei: (a: unknown) => void = () => undefined;
    const T = AttC.baueLauf({ sideEvents: SE_F });
    T.fs.ordner(AttC.BASIS);
    T.agenda.agenden.set('se-2', () => new Promise((ok) => { gibFrei = ok; }));
    T.lauf.takt();
    await AttC.ruhe();
    T.fs.fehlerBei('readFile', (p) => p === AttC.SHOW_PFAD, 'ENOENT');
    await T.uhr.spule(45_000, 45_000);
    T.lauf.takt();
    await AttC.ruhe();
    const k4 = ZeilenC.kopfzeile(T.lauf.stand(), T.uhr.t).fall;
    const seit = T.fs.protokoll.length;
    gibFrei([AttC.punkt('se-2', [AttC.datei('m-2', 'Spät')])]);
    await T.lauf.ruhig();
    T.fs.regelnLoeschen();
    ck('P14 Fix 2, 9.2, 9.11, 12.4 Nr. 26: K4 → die Warteschlange ruft nicht weiter ab und fasst kein Dateisystem an',
      k4 === 'K4' && T.agenda.aufrufe.join(',') === 'se-2' && T.fs.protokoll.slice(seit).every((x) => x.op === 'readFile') && !T.fs.gibt(pathC.join(AttC.BASIS, 'Wasser')));
  }
  {
    // Befund 2 B: Sperrdatei in einer späteren Runde nicht lesbar → K6 bleibt stehen, die Warteschlange arbeitet nicht weiter
    let gibFrei: (a: unknown) => void = () => undefined;
    const T = AttC.baueLauf({ sideEvents: SE_F });
    T.fs.ordner(AttC.BASIS);
    T.agenda.agenden.set('se-2', () => new Promise((ok) => { gibFrei = ok; }));
    T.lauf.takt();
    await AttC.ruhe();
    T.fs.fehlerBei('readFile', (p) => p === SPERRE_F, 'EACCES');
    await T.uhr.spule(45_000, 45_000);
    T.lauf.takt();
    await AttC.ruhe();
    const seit = T.fs.protokoll.length;
    gibFrei([AttC.punkt('se-2', [AttC.datei('m-2', 'Spät')])]);
    await T.lauf.ruhig();
    const k = ZeilenC.kopfzeile(T.lauf.stand(), T.uhr.t);
    T.fs.regelnLoeschen();
    ck('P14 Fix 2, 9.13: Sperrdatei nicht lesbar → die Warteschlange arbeitet nicht weiter, die Diagnose (T78) bleibt',
      k.fall === 'K6' && T.lauf.stand().basis?.fehler?.sperre === 'lesen' && T.agenda.aufrufe.join(',') === 'se-2'
      && !T.fs.protokoll.slice(seit).some((x) => x.op === 'mkdir' || x.op === 'open'));
  }
  {
    // Befund 3: Runde länger als 270 s, Basisordner nicht anlegbar → K6 nennt nie eine vergangene Zeit, kein Versuch je Eintrag
    const liste = Array.from({ length: 8 }, (_, i) => ({ id: `se-${i + 1}`, title: `Titel ${i + 1}` }));
    const T = AttC.baueLauf({ sideEvents: liste });
    for (const p of liste.slice(1)) {
      T.agenda.agenden.set(p.id, () => new Promise((ok) => { T.uhr.setTimeout(() => ok([AttC.punkt(p.id, [AttC.datei(`m-${p.id}`, 'Folien')])]), 60_000); }));
    }
    T.fs.fehlerBei('mkdir', (p) => p === AttC.BASIS, 'EACCES');
    T.lauf.takt();
    await AttC.ruhe();
    const luegen: string[] = [];
    for (let i = 0; i < 9; i++) {
      await T.uhr.spule(45_000, 45_000);
      T.lauf.takt();
      await AttC.ruhe();
      const s = T.lauf.stand();
      const k = ZeilenC.kopfzeile(s, T.uhr.t);
      const bis = Date.parse(s.basis?.fehler?.naechsterVersuch ?? '');
      if (s.basis?.fehler && (!(bis > T.uhr.t) || k.text?.includes('überfällig'))) luegen.push(`${(T.uhr.t - Date.parse('2026-10-16T08:00:00Z')) / 1000}:${k.text}`);
    }
    ck('P14 Fix 3, 11.1 K6: Runde länger als 270 s → der genannte nächste Versuch liegt nie in der Vergangenheit, nie T59', luegen.length === 0);
    ck('P14 Fix 3, 9.4: Runde länger als 270 s → der Fehler bleibt der des Basisordners (EACCES)', s0(T) === 'EACCES');
  }
  {
    // Fix-Runde 2, Befund 1 und 3: Runde länger als 270 s, nur se-2 mit Anhang, Takt mit 1-s-Uhr. K6 nennt nie eine vergangene Zeit,
    // nie T59 bei laufender Runde, und zu jeder genannten Zeit folgt wirklich ein Versuch (kein Termin, an dem nichts geschieht).
    const liste = Array.from({ length: 8 }, (_, i) => ({ id: `se-${i + 1}`, title: `Titel ${i + 1}` }));
    const T = AttC.baueLauf({ sideEvents: liste });
    for (const p of liste.slice(1)) {
      T.agenda.agenden.set(p.id, () => new Promise((ok) => { T.uhr.setTimeout(() => ok(p.id === 'se-2' ? [AttC.punkt(p.id, [AttC.datei(`m-${p.id}`, 'Folien')])] : []), 60_000); }));
    }
    T.fs.fehlerBei('mkdir', (p) => p === AttC.BASIS, 'EACCES');
    const t0 = T.uhr.t;
    const mkdirs = (): number => T.fs.zaehle('mkdir', (p) => p === AttC.BASIS);
    const genannt = new Map<number, number>(); // genannte Zeit → Zahl der Versuche, als sie zuerst genannt wurde
    const luegen: string[] = [];
    const leer: string[] = [];
    T.lauf.takt();
    await AttC.ruhe();
    for (let i = 0; i < 12; i++) {
      await T.uhr.spule(45_000, 1000);
      T.lauf.takt();
      await AttC.ruhe();
      const s = T.lauf.stand();
      const k = ZeilenC.kopfzeile(s, T.uhr.t);
      const bis = Date.parse(s.basis?.fehler?.naechsterVersuch ?? '');
      const wann = `${(T.uhr.t - t0) / 1000}:${k.text}`;
      if (s.basis?.fehler && (!(bis > T.uhr.t - 1000) || k.text?.includes('überfällig'))) luegen.push(wann);
      for (const [x, n] of genannt) if (T.uhr.t >= x + 1000 && mkdirs() <= n) leer.push(`${x - t0}:${wann}`);
      if (s.basis?.fehler && !genannt.has(bis)) genannt.set(bis, mkdirs());
    }
    ck('P14 Fix-Runde 2, 11.1 K6: lange Runde, nur ein Eintrag mit Anhang → nie eine vergangene Zeit, nie T59 bei laufender Runde', luegen.length === 0);
    ck('P14 Fix-Runde 2, 11.1 K6: lange Runde → zu jeder genannten Zeit folgt ein Versuch (kein Termin ohne Versuch)', leer.length === 0 && genannt.size > 1);
  }
  {
    // Befund 4: Abruf gelingt, Ordner nicht anlegbar → die Zeile zeigt den gelungenen Abruf
    const T = AttC.baueLauf({ sideEvents: SE_F.slice(0, 2) });
    T.agenda.agenden.set('se-2', new IveoApiErrorC(404, 'not_found', 'Programm fehlt'));
    await T.takt([]);
    const davor = T.se('se-2')?.abruf;
    T.agenda.agenden.set('se-2', [AttC.punkt('se-2', [AttC.datei('m-2', 'Folien')])]);
    T.fs.fehlerBei('mkdir', (p) => p === AttC.BASIS, 'EACCES');
    await T.uhr.spule(270_000, 45_000);
    await T.takt([]);
    const s2 = T.se('se-2');
    ck('P14 Fix 4, G8: Abruf gelungen, aber Basisordner nicht anlegbar → abruf gelungen, Fehler des früheren Abrufs weg, Stand gesetzt',
      davor === 'gescheitert' && s2?.abruf === 'gelungen' && s2.fehler === null && s2.stand === isoF(T.uhr.t) && s2.existiert === false);
  }
  {
    // Fix-Runde 2, Befund 2: ein Side Event mit Anhängen ist nie „Keine Anhänge“ (S11), auch wenn der Ordner nicht entstand und K6 später verschwindet
    const T = AttC.baueLauf({ sideEvents: SE_F.slice(0, 2) });
    T.agenda.agenden.set('se-2', [AttC.punkt('se-2', [AttC.datei('m-2', 'Folien')])]);
    T.fs.fehlerBei('mkdir', (p) => p === AttC.BASIS, 'EACCES');
    await T.takt([]);
    const bei = T.se('se-2');
    const zeileBei = bei ? ZeilenC.ordnerZeile(bei, T.uhr.t).fall : null;
    T.fs.regelnLoeschen();
    T.fs.ordner(AttC.BASIS);
    await T.uhr.spule(45_000, 45_000);
    await T.takt([]);
    const s2 = T.se('se-2');
    const zeile = s2 ? ZeilenC.ordnerZeile(s2, T.uhr.t).fall : null;
    ck('P14 Fix-Runde 2, 11.2: Anhänge da, Ordner nicht angelegt → n = Zahl der Anhänge, k = 0, nie S11',
      bei?.n === 1 && bei.k === 0 && zeileBei !== 'S11' && s2 !== undefined && s2.n === 1 && zeile !== 'S11');
  }
  {
    // Fix-Runde 3, Befund 1: der Takt kommt wie in der Hülle nach Kern-Abfrage und Wächter, also mit wechselnder Latenz neben dem 45-s-Raster.
    // Runde über 270 s: nach jedem Takt liegt die genannte Zeit nicht in der Vergangenheit, K6 sagt nie „überfällig“, und jede genannte Zeit
    // (bis auf die Toleranz eines Takts-Drittels) bekommt ihren Versuch.
    const liste = Array.from({ length: 8 }, (_, i) => ({ id: `se-${i + 1}`, title: `Titel ${i + 1}` }));
    const T = AttC.baueLauf({ sideEvents: liste });
    for (const p of liste.slice(1)) {
      T.agenda.agenden.set(p.id, () => new Promise((ok) => { T.uhr.setTimeout(() => ok(p.id === 'se-2' ? [AttC.punkt(p.id, [AttC.datei(`m-${p.id}`, 'Folien')])] : []), 60_000); }));
    }
    T.fs.fehlerBei('mkdir', (p) => p === AttC.BASIS, 'EACCES');
    const lat = [0, 3, 1, 4, 0, 5, 2, 6, 1, 3, 0, 4, 2];
    const t0 = T.uhr.t;
    const mkdirs = (): number => T.fs.zaehle('mkdir', (p) => p === AttC.BASIS);
    const genannt = new Map<number, number>(); // genannte Zeit → Zahl der Versuche, als sie zuerst genannt wurde
    const luegen: string[] = [];
    const leer: string[] = [];
    for (let k = 0; k < lat.length; k++) {
      const ziel = t0 + k * 45_000 + lat[k] * 1000;
      while (T.uhr.t < ziel) { // die Zeile sieht der Bediener jede Sekunde, nicht nur nach dem Takt
        await T.uhr.spule(1000, 1000);
        const z = T.lauf.stand();
        const zb = Date.parse(z.basis?.fehler?.naechsterVersuch ?? '');
        if (z.basis?.fehler && (T.uhr.t - zb > 10_000 || ZeilenC.kopfzeile(z, T.uhr.t).text?.includes('überfällig'))) luegen.push(`${(T.uhr.t - t0) / 1000}:${ZeilenC.kopfzeile(z, T.uhr.t).text}`);
      }
      T.lauf.takt();
      await AttC.ruhe();
      const s = T.lauf.stand();
      const kz = ZeilenC.kopfzeile(s, T.uhr.t);
      const bis = Date.parse(s.basis?.fehler?.naechsterVersuch ?? '');
      const wann = `${(T.uhr.t - t0) / 1000}:${kz.text}`;
      if (s.basis?.fehler && (!(bis > T.uhr.t - 1000) || kz.text?.includes('überfällig'))) luegen.push(wann);
      for (const [x, n] of genannt) if (T.uhr.t >= x - 15_000 && mkdirs() <= n) leer.push(`${(x - t0) / 1000}:${wann}`);
      if (s.basis?.fehler && !genannt.has(bis)) genannt.set(bis, mkdirs());
    }
    ck('P14 Fix-Runde 3, 11.1 K6: Takt mit wechselnder Latenz, lange Runde → nie eine vergangene Zeit, nie T59 bei laufender Runde', luegen.length === 0);
    ck('P14 Fix-Runde 3, 11.1 K6: Takt mit wechselnder Latenz → jeder genannten Zeit folgt ein Versuch', leer.length === 0 && genannt.size > 1);
  }
  {
    // Fix-Runde 3, Befund 3: kurze Runde, Takte 1 s nach dem Raster (erster 2 s): der Rundenstart bei „gegen“ macht den Versuch, auch wenn
    // der Takt ein paar Sekunden vor der genannten Zeit liegt.
    const T = AttC.baueLauf({ sideEvents: [{ id: 'se-1', title: 'Klima' }, { id: 'se-2', title: 'Wasser' }] });
    T.agenda.agenden.set('se-2', [AttC.punkt('se-2', [AttC.datei('m-2', 'Folien')])]);
    T.fs.fehlerBei('mkdir', (p) => p === AttC.BASIS, 'EACCES');
    const t0 = T.uhr.t;
    const mkdirs = (): number => T.fs.zaehle('mkdir', (p) => p === AttC.BASIS);
    await T.uhr.spule(2000, 1000);
    await T.takt([]);
    const gegen = Date.parse(T.lauf.stand().basis?.fehler?.naechsterVersuch ?? '');
    const davor = mkdirs();
    let vorbei = -1;
    for (let k = 1; k <= 8 && vorbei < 0; k++) {
      await T.uhr.spule(t0 + k * 45_000 + 1000 - T.uhr.t, 1000);
      await T.takt([]);
      if (T.uhr.t >= gegen - 15_000 && mkdirs() > davor) vorbei = k;
    }
    ck('P14 Fix-Runde 3, 9.4/Nr. 29: Takt kurz vor der genannten Zeit → der Versuch kommt in diesem Takt, nicht erst einen Takt später',
      vorbei > 0 && t0 + vorbei * 45_000 + 1000 < gegen + 1000);
  }
  {
    // Fix-Runde 3, Befund 2: K6 verschwindet auf einem anderen Weg (Basisordner von außen angelegt, Sperre geschrieben) → die Ablage bleibt nicht
    // für die Sitzung stehen: der Ordner von se-2 entsteht, K9 und die Zeile von se-2 stimmen.
    const T = AttC.baueLauf({ sideEvents: [{ id: 'se-1', title: 'Klima' }, { id: 'se-2', title: 'Wasser' }] });
    T.agenda.agenden.set('se-2', [AttC.punkt('se-2', [AttC.datei('m-2', 'Folien')])]);
    T.fs.fehlerBei('mkdir', (p) => p === AttC.BASIS, 'EACCES');
    await T.takt([]);
    T.fs.regelnLoeschen();
    T.fs.ordner(AttC.BASIS);
    for (let k = 1; k <= 12; k++) { await T.uhr.spule(45_000, 45_000); await T.takt([]); }
    const s2 = T.se('se-2');
    ck('P14 Fix-Runde 3, 11.2: K6 verschwindet auf anderem Weg (Basisordner von außen) → der Ordner von se-2 entsteht', s2?.existiert === true && s2.ordnerName !== null);
  }
  {
    // Fix-Runde 3, Befund 2: K6, Schalter aus und wieder an (9.14), danach Rechte behoben → der Basisordner entsteht, der Eintrag wird abgelegt.
    const T = AttC.baueLauf({ sideEvents: [{ id: 'se-1', title: 'Klima' }, { id: 'se-2', title: 'Wasser' }] });
    T.agenda.agenden.set('se-2', [AttC.punkt('se-2', [AttC.datei('m-2', 'Folien')])]);
    T.fs.fehlerBei('mkdir', (p) => p === AttC.BASIS, 'EACCES');
    await T.takt([]);
    T.z.schalter = false;
    await T.uhr.spule(45_000, 45_000); await T.takt([]);
    T.z.schalter = true;
    await T.uhr.spule(45_000, 45_000); await T.takt([]);
    T.fs.regelnLoeschen();
    for (let k = 0; k < 10; k++) { await T.uhr.spule(45_000, 45_000); await T.takt([]); }
    const s2 = T.se('se-2');
    ck('P14 Fix-Runde 3, 9.14: Schalter aus und an, danach Rechte behoben → der Basisordner entsteht und se-2 wird abgelegt',
      T.fs.gibt(AttC.BASIS) && s2?.existiert === true && s2.ordnerName !== null);
  }
  {
    // Fix-Runde 4, Befund 1: K6 nennt nur Zeiten, zu denen der Takt wirklich versucht. (a) Der Takt, der die Runde startet, hat mehr Latenz
    // als ein späterer: der spätere liegt ein paar Sekunden vor „gegen“, versucht wegen der Toleranz und scheitert; „gegen“ ist damit
    // verbraucht. (b) Der erste Fehlschlag kommt von einem Eintrag nach „gegen“, zwischen zwei Takten. Die Zeile wird jede Sekunde gelesen:
    // nie mehr als 10 s vergangen, nie T59 bei laufender Runde, und jede genannte Zeit bekommt ihren Versuch.
    const faelle: Array<{ name: string; lat: number[]; mitAnhang: string }> = [
      { name: 'Takt kurz vor „gegen“ (Rundenstart mit mehr Latenz)', lat: [5, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 0, 0], mitAnhang: 'se-2' },
      { name: 'erster Fehlschlag eines Eintrags nach „gegen“', lat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], mitAnhang: 'se-6' },
    ];
    for (const f of faelle) {
      const liste = Array.from({ length: 8 }, (_, i) => ({ id: `se-${i + 1}`, title: `Titel ${i + 1}` }));
      const T = AttC.baueLauf({ sideEvents: liste });
      for (const p of liste.slice(1)) {
        T.agenda.agenden.set(p.id, () => new Promise((ok) => { T.uhr.setTimeout(() => ok(p.id === f.mitAnhang ? [AttC.punkt(p.id, [AttC.datei(`m-${p.id}`, 'Folien')])] : []), 60_000); }));
      }
      T.fs.fehlerBei('mkdir', (p) => p === AttC.BASIS, 'EACCES');
      const t0 = T.uhr.t;
      const mkdirs = (): number => T.fs.zaehle('mkdir', (p) => p === AttC.BASIS);
      const genannt = new Map<number, number>(); // genannte Zeit → Zahl der Versuche, als sie zuerst genannt wurde
      const luegen: string[] = [];
      const leer: string[] = [];
      for (let k = 0; k < f.lat.length; k++) {
        const ziel = t0 + k * 45_000 + f.lat[k] * 1000;
        while (T.uhr.t < ziel) {
          await T.uhr.spule(1000, 1000);
          const z = T.lauf.stand();
          const zb = Date.parse(z.basis?.fehler?.naechsterVersuch ?? '');
          const kz = ZeilenC.kopfzeile(z, T.uhr.t);
          if (z.basis?.fehler && (T.uhr.t - zb > 10_000 || kz.text?.includes('überfällig'))) luegen.push(`${(T.uhr.t - t0) / 1000}:${kz.text}`);
          if (z.basis?.fehler && !genannt.has(zb)) genannt.set(zb, mkdirs());
        }
        T.lauf.takt();
        await AttC.ruhe();
        const s = T.lauf.stand();
        const bis = Date.parse(s.basis?.fehler?.naechsterVersuch ?? '');
        for (const [x, n] of genannt) if (T.uhr.t >= x - 15_000 && mkdirs() <= n) leer.push(`${(x - t0) / 1000}:${(T.uhr.t - t0) / 1000}`);
        if (s.basis?.fehler && !genannt.has(bis)) genannt.set(bis, mkdirs());
      }
      ck(`P14 Fix-Runde 4, 11.1 K6: ${f.name}, lange Runde → nie eine vergangene Zeit, nie T59, jeder genannten Zeit folgt ein Versuch`,
        luegen.length === 0 && leer.length === 0 && genannt.size > 1);
    }
  }
  {
    // Fix-Runde 4, Befund 2: Basisordner nicht anlegbar, dann EIN Aussetzer der Ablage (NAS, SMB) bei fehlendem Basisordner: Sperrdatei nicht
    // lesbar, lstat nicht möglich oder Zwischendatei der Sperre nicht anlegbar. Im Takt danach fehlt die Sperrdatei wieder (ENOENT), der Fehler
    // des Aussetzers ist überholt. Die Ablage bleibt nicht stehen, die Zeile lügt nicht (nie T59, nie mehr als 10 s vergangen), vor der neu
    // genannten Zeit kein weiterer Versuch, zu ihr der Versuch, und mit behobenen Rechten entstehen Basisordner und Ordner von se-2 – ob die
    // Rechte vor oder nach dem ersten Takt nach dem Aussetzer behoben sind.
    const aussetzer: Array<[string, string, (p: string) => boolean]> = [
      ['Sperrdatei nicht lesbar (pruefeSperre, sperre lesen)', 'readFile', (p) => p === SPERRE_F],
      ['lstat des Basisordners (basisArt)', 'lstat', (p) => p === AttC.BASIS],
      ['Zwischendatei der Sperre (schreibeSperre, sperre schreiben)', 'open', (p) => p.startsWith(`${SPERRE_F}.`)],
    ];
    for (const [name, op, wann] of aussetzer) {
      const fehler: string[] = [];
      for (const behoben of ['vor', 'nach'] as const) {
        const T = AttC.baueLauf({ sideEvents: [{ id: 'se-1', title: 'Klima' }, { id: 'se-2', title: 'Wasser' }] });
        T.agenda.agenden.set('se-2', [AttC.punkt('se-2', [AttC.datei('m-2', 'Folien')])]);
        T.fs.fehlerBei('mkdir', (p) => p === AttC.BASIS, 'EACCES');
        const t0 = T.uhr.t;
        const mkdirs = (): number => T.fs.zaehle('mkdir', (p) => p === AttC.BASIS);
        const pruefe = (w: string): void => {
          const s = T.lauf.stand();
          const kz = ZeilenC.kopfzeile(s, T.uhr.t);
          const bis = Date.parse(s.basis?.fehler?.naechsterVersuch ?? '');
          if (s.basis?.fehler && (T.uhr.t - bis > 10_000 || kz.text?.includes('überfällig'))) fehler.push(`${behoben} ${w} +${(T.uhr.t - t0) / 1000}: ${kz.text}`);
        };
        await T.takt([]);
        T.fs.fehlerBei(op, wann, 'EIO', 1);
        await T.uhr.spule(45_000, 45_000); await T.takt([]); pruefe('Aussetzer');
        if (behoben === 'vor') T.fs.regelnLoeschen();
        await T.uhr.spule(45_000, 45_000); await T.takt([]); pruefe('Takt danach');
        const v2 = Date.parse(T.lauf.stand().basis?.fehler?.naechsterVersuch ?? '');
        const m2 = mkdirs();
        if (behoben === 'nach') T.fs.regelnLoeschen();
        for (let k = 3; k <= 14; k++) {
          await T.uhr.spule(45_000, 45_000); await T.takt([]); pruefe(`Takt ${k}`);
          if (Number.isFinite(v2) && T.uhr.t < v2 - 15_000 && mkdirs() !== m2) fehler.push(`${behoben} Versuch vor der genannten Zeit +${(T.uhr.t - t0) / 1000}`);
          if (Number.isFinite(v2) && T.uhr.t >= v2 - 15_000 && T.uhr.t < v2 + 45_000 && mkdirs() <= m2) fehler.push(`${behoben} kein Versuch zur genannten Zeit +${(v2 - t0) / 1000}`);
        }
        const s2 = T.se('se-2');
        const kz = ZeilenC.kopfzeile(T.lauf.stand(), T.uhr.t);
        if (!(T.fs.gibt(AttC.BASIS) && s2?.existiert === true && s2.ordnerName !== null && kz.fall !== 'K6')) {
          fehler.push(`${behoben} Ablage steht: mkdir ${mkdirs()}, se-2 ${JSON.stringify({ existiert: s2?.existiert, ordner: s2?.ordnerName })}, ${kz.fall} ${kz.text}`);
        }
      }
      if (fehler.length) console.log(`    (${name}: ${fehler.slice(0, 3).join(' | ')})`);
      ck(`P14 Fix-Runde 4, 11.1 K6/9.2: ein Aussetzer „${name}“ bei fehlendem Basisordner → die Ablage bleibt nicht stehen, die Zeile lügt nicht`, fehler.length === 0);
    }
  }
}
function s0(T: ReturnType<typeof AttC.baueLauf>): string | undefined { return T.lauf.stand().basis?.fehler?.code; }

// ── Ende der Fälle ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
