// DataLinkSection (Spec 6.2, 7): unbekannte Dateizahl nie als „0 Dateien“, App-Texte nur angezeigt.
import { enthaelt, enthaeltNicht, gleich, ok, render } from '@jm/ui/testhilfe';
import { abschnittStatusItem, DATALINK_TEXTE, DataLinkSection, dataLinkView, type DataLinkSectionProps, type SectionStatus } from '../src/index';
import { bewegungsVerstoesse, kreuz, nachLetztem, pruefeFaelle, sperrZaehlung, statusText, vergleiche, vor } from './hilfe';

const s = (state: SectionStatus['state'], text: string): SectionStatus => ({ state, text });
const U = s('off', 'unbekannt');
const KEIN_ORDNER = s('off', 'kein Ordner');
const FEHLT = s('error', 'Ordner fehlt');
const FEHLER = s('error', 'Fehler: Testfehler');
const ZAEHLEN = 'zählen' as const;

const AENDERUNG = new Date(2026, 9, 8, 9, 5).toISOString();   // Ortszeit 09:05

// Tabelle 1: Zeile = folder|folderMissing. ZAEHLEN heißt: Status aus Tabelle 2.
const ORDNER: Record<string, SectionStatus | typeof ZAEHLEN> = {
  'leer|undefined': KEIN_ORDNER,
  'leer|false': KEIN_ORDNER,
  'leer|true': FEHLT,
  'gesetzt|undefined': ZAEHLEN,
  'gesetzt|false': ZAEHLEN,
  'gesetzt|true': FEHLT,
};
// Tabelle 2: Zeile = fileCount|lastChange.
const ZAEHLUNG: Record<string, SectionStatus> = {
  'undefined|fehlt': U,
  'undefined|gesetzt': U,
  '0|fehlt': s('warn', 'keine Datei'),
  '0|gesetzt': s('warn', 'keine Datei'),
  '1|fehlt': s('ok', '1 Datei'),
  '1|gesetzt': s('ok', '1 Datei · 09:05'),
  '5|fehlt': s('ok', '5 Dateien'),
  '5|gesetzt': s('ok', '5 Dateien · 09:05'),
};

const basis: DataLinkSectionProps = { id: 'datalink', folder: 'D:\\Show\\Daten' };

{
  const faelle = kreuz({
    folder: ['leer', 'gesetzt'],
    folderMissing: [undefined, false, true],
    fileCount: [undefined, 0, 1, 5],
    lastChange: ['fehlt', 'gesetzt'],
    error: [undefined, 'Testfehler'],
    locked: [undefined, 'Vom Master vorgegeben'],
  } as const);
  const props = (f: (typeof faelle)[number]): DataLinkSectionProps => ({
    ...basis,
    folder: f.folder === 'leer' ? '' : basis.folder,
    folderMissing: f.folderMissing,
    fileCount: f.fileCount,
    lastChange: f.lastChange === 'gesetzt' ? AENDERUNG : undefined,
    error: f.error,
    locked: f.locked,
  });
  pruefeFaelle('DataLink Kreuzprodukt: Eingang → status aus den Tabellen (locked ändert den Status nicht)', faelle, (f) => {
    const o = ORDNER[`${f.folder}|${f.folderMissing}`];
    const soll = f.error ? FEHLER : o === ZAEHLEN ? ZAEHLUNG[`${f.fileCount}|${f.lastChange}`] : o;
    return vergleiche(statusText(dataLinkView(props(f)).status), statusText(soll));
  });
  pruefeFaelle('DataLink Kreuzprodukt: nie „0 Dateien“', faelle, (f) => (dataLinkView(props(f)).status.text.includes('0 Dateien') ? 'zeigt 0 Dateien' : null));
}

{
  gleich(
    [DATALINK_TEXTE.titel, DATALINK_TEXTE.ordner, DATALINK_TEXTE.status, DATALINK_TEXTE.ordnerWaehlen, DATALINK_TEXTE.gesperrtVomMaster],
    ['DataLink', 'Ordner', 'Status', 'Ordner wählen …', 'Vom Master vorgegeben'],
    'DataLink: Titel, Feldnamen, Knopf und Sperrgrund wörtlich',
  );
  gleich(DATALINK_TEXTE.dateien(1234), '1234 Dateien', 'DataLink: Zahl ohne Tausenderpunkt');
}

// ── Darstellung ──
const alle: DataLinkSectionProps = {
  ...basis,
  fileCount: 3,
  lastChange: AENDERUNG,
  sourceLine: 'Quelle: eigener Ordner D:\\Show\\Daten',
  notice: '„Ada“ ist nicht mehr in der Liste. Bitte einen Eintrag abrufen.',
  backLabel: 'Zurück zum eigenen Ordner (Daten)',
  onBack: () => {},
  onPickFolder: () => {},
};
{
  const html = render(<DataLinkSection {...alle} />);
  for (const t of ['>DataLink<', '>Ordner<', '>D:\\Show\\Daten<', '>Ordner wählen …</button>', '>Status<', 'Quelle: eigener Ordner', 'ist nicht mehr in der Liste', '>Zurück zum eigenen Ordner (Daten)</button>']) {
    enthaelt(html, t, `DataLink alle Angaben: ${t}`);
  }
  enthaelt(html, '>3 Dateien · 09:05</span>', 'DataLink: Statuspille „{n} Dateien · {hh:mm}“');
  ok(vor(html, '>Ordner<', '>Ordner wählen …<') && vor(html, '>Ordner wählen …<', '>Status<'), 'DataLink: Felder in fester Reihenfolge');
  gleich(bewegungsVerstoesse(html), [], 'DataLink: Übergänge nur motion-safe oder mit motion-reduce:transition-none (G8)');
}
{
  const html = render(<DataLinkSection {...alle} folder="" sourceLine={undefined} notice={undefined} onBack={undefined} onPickFolder={undefined} />);
  enthaelt(html, '>kein Ordner</div>', 'DataLink ohne Ordner: Anzeige „kein Ordner“');
  enthaeltNicht(html, '>Status<', 'DataLink ohne Quellzeile und Hinweis: kein Statusfeld');
  enthaeltNicht(html, 'Zurück zum eigenen Ordner', 'DataLink: Zurück-Knopf nur mit backLabel UND onBack');
  enthaeltNicht(html, 'Ordner wählen', 'DataLink ohne onPickFolder: kein Knopf');
}
{
  const html = render(<DataLinkSection {...alle} locked={DATALINK_TEXTE.gesperrtVomMaster} />);
  const z = sperrZaehlung(html);
  ok(z.alle === 2 && z.gesperrt === 2, `DataLink locked: alle Bedienelemente disabled (${z.gesperrt} von ${z.alle})`);
  enthaelt(html, 'Gesperrt: Vom Master vorgegeben', 'DataLink locked: „Gesperrt: Vom Master vorgegeben“');
  ok(vor(html, 'data-gesperrt="true"', '>Ordner<'), 'DataLink locked: Grund vor den Feldern');
}
{
  const html = render(<DataLinkSection {...alle} error="Datei nicht lesbar" />);
  ok(nachLetztem(html, 'data-fehler="true"', '</button>'), 'DataLink error: Fehlertext nach den Feldern');
}
{
  const p: DataLinkSectionProps = { ...alle, fileCount: undefined };
  const item = abschnittStatusItem(dataLinkView(p), { group: 'tool', label: 'DataLink' });
  const html = render(<DataLinkSection {...p} />);
  ok(item.state === 'off' && item.detail === 'unbekannt' && html.includes(`>${item.detail}</span>`), 'DataLink: abschnittStatusItem = Statuspille (Zustand und Text)');
}
