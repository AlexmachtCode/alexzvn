// DataLinkSection (Spec 6.2, 7): unbekannte Dateizahl nie als „0 Dateien“, App-Texte nur angezeigt.
import { enthaelt, enthaeltNicht, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { abschnittStatusItem, DATALINK_TEXTE, DataLinkSection, dataLinkView, type DataLinkSectionProps, type SectionStatus } from '../src/index';
import { ordnerEntfernen } from '../src/abschnitte/datalink';
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

// ── Erweiterung für den Titler (UX-Pilot C6, E10, OF4): fremde Quelle, Einträge, Pfadfeld, „Ordner entfernen“ ──
// Tabelle 3: Zeile = folder|folderMissing|externeQuelle. ZAEHLEN heißt: Status aus Tabelle 4 (Einträge) bzw., wenn
// eintraege fehlt, aus Tabelle 2 (Dateien). Ohne die neuen Props gelten Tabelle 1 und 2 (Kreuz oben, unverändert).
const ORDNER_EXTERN: Record<string, SectionStatus | typeof ZAEHLEN> = {
  'leer|undefined|undefined': KEIN_ORDNER,
  'leer|undefined|false': KEIN_ORDNER,
  'leer|undefined|true': ZAEHLEN,
  'leer|false|undefined': KEIN_ORDNER,
  'leer|false|false': KEIN_ORDNER,
  'leer|false|true': ZAEHLEN,
  'leer|true|undefined': FEHLT,
  'leer|true|false': FEHLT,
  'leer|true|true': FEHLT,
  'gesetzt|undefined|undefined': ZAEHLEN,
  'gesetzt|undefined|false': ZAEHLEN,
  'gesetzt|undefined|true': ZAEHLEN,
  'gesetzt|false|undefined': ZAEHLEN,
  'gesetzt|false|false': ZAEHLEN,
  'gesetzt|false|true': ZAEHLEN,
  'gesetzt|true|undefined': FEHLT,
  'gesetzt|true|false': FEHLT,
  'gesetzt|true|true': FEHLT,
};
// Tabelle 4: Zeile = eintraege. DATEIEN heißt: eintraege nicht gemeldet, Tabelle 2 gilt.
const DATEIEN = 'dateien' as const;
const EINTRAEGE: Record<string, SectionStatus | typeof DATEIEN> = {
  undefined: DATEIEN,
  '0': s('warn', 'keine Einträge'),
  '1': s('ok', '1 Eintrag'),
  '5': s('ok', '5 Einträge'),
};

{
  const faelle = kreuz({
    folder: ['leer', 'gesetzt'],
    folderMissing: [undefined, false, true],
    externeQuelle: [undefined, false, true],
    eintraege: [undefined, 0, 1, 5],
    fileCount: [undefined, 0, 1, 5],
    lastChange: ['fehlt', 'gesetzt'],
    error: [undefined, 'Testfehler'],
  } as const);
  const props = (f: (typeof faelle)[number]): DataLinkSectionProps => ({
    ...basis,
    folder: f.folder === 'leer' ? '' : basis.folder,
    folderMissing: f.folderMissing,
    externeQuelle: f.externeQuelle,
    eintraege: f.eintraege,
    fileCount: f.fileCount,
    lastChange: f.lastChange === 'gesetzt' ? AENDERUNG : undefined,
    error: f.error,
  });
  pruefeFaelle('DataLink erweitert Kreuzprodukt: externeQuelle und eintraege → status aus Tabelle 3, 4 und 2', faelle, (f) => {
    const o = ORDNER_EXTERN[`${f.folder}|${f.folderMissing}|${f.externeQuelle}`];
    const e = EINTRAEGE[String(f.eintraege)];
    const soll = f.error ? FEHLER : o !== ZAEHLEN ? o : e !== DATEIEN ? e : ZAEHLUNG[`${f.fileCount}|${f.lastChange}`];
    return vergleiche(statusText(dataLinkView(props(f)).status), statusText(soll));
  });
  pruefeFaelle('DataLink erweitert: nie „0 Einträge“ oder „0 Dateien“', faelle, (f) =>
    /(^|\D)0 (Einträge|Dateien)/.test(dataLinkView(props(f)).status.text) ? 'zeigt 0' : null,
  );
  pruefeFaelle('DataLink erweitert: ok nur mit gemessener Zahl über 0 (Einträge vor Dateien)', faelle, (f) => {
    const zahl = f.eintraege !== undefined ? f.eintraege : f.fileCount;
    return dataLinkView(props(f)).status.state === 'ok' && !(typeof zahl === 'number' && zahl > 0) ? 'ok ohne Zahl' : null;
  });
}

{
  gleich(
    [DATALINK_TEXTE.eintrag, DATALINK_TEXTE.eintraege(5), DATALINK_TEXTE.eintraege(1234), DATALINK_TEXTE.keineEintraege, DATALINK_TEXTE.ordnerpfad, DATALINK_TEXTE.ordnerEntfernen],
    ['1 Eintrag', '5 Einträge', '1234 Einträge', 'keine Einträge', 'Ordnerpfad', 'Ordner entfernen'],
    'DataLink erweitert: Texte wörtlich (T8), Zahl ohne Tausenderpunkt',
  );
}

const erweitert: DataLinkSectionProps = { ...alle, onClearFolder: () => {}, capabilities: { ordnerText: true }, onFolderText: () => {} };
{
  const html = render(<DataLinkSection {...erweitert} />);
  for (const t of ['>Ordnerpfad</label>', 'value="D:\\Show\\Daten"', 'placeholder="kein Ordner"', '>Ordner entfernen</button>']) {
    enthaelt(html, t, `DataLink erweitert: ${t}`);
  }
  enthaeltNicht(html, 'data-anzeige="Ordner"', 'DataLink Pfadfeld: ersetzt die Anzeige „Ordner“ (kein Wert doppelt)');
  ok(
    vor(html, '>Ordnerpfad<', '>Ordner wählen …<') &&
      vor(html, '>Ordner wählen …<', '>Ordner entfernen<') &&
      vor(html, '>Ordner entfernen<', '>Status<') &&
      vor(html, '>Status<', '>Zurück zum eigenen Ordner (Daten)<'),
    'DataLink erweitert: Felder in fester Reihenfolge (Pfad, wählen, entfernen, Status, Zurück)',
  );
  pruefeIdVerweise(html, 'DataLink Pfadfeld: id-Verweise gültig');
  ok(html.startsWith('<div id="einstellung-datalink"') && html.includes('>Ordnerpfad</label>'), 'DataLink Pfadfeld: steht im Panel-Anker des Abschnitts (Sprung aus der Statusleiste)');
  gleich(bewegungsVerstoesse(html), [], 'DataLink erweitert: Übergänge nur motion-safe oder mit motion-reduce:transition-none (G8)');
}
{
  const faelle = kreuz({
    folder: ['', 'D:\\Show\\Daten'],
    ordnerText: [undefined, false, true],
    feldRueckruf: [false, true],
    entfernenRueckruf: [false, true],
  } as const);
  pruefeFaelle(
    'DataLink erweitert: Pfadfeld genau mit capabilities.ordnerText UND onFolderText, „Ordner entfernen“ genau mit Ordner UND onClearFolder',
    faelle,
    (f) => {
      const p: DataLinkSectionProps = {
        ...alle,
        folder: f.folder,
        capabilities: f.ordnerText === undefined ? undefined : { ordnerText: f.ordnerText },
        onFolderText: f.feldRueckruf ? () => {} : undefined,
        onClearFolder: f.entfernenRueckruf ? () => {} : undefined,
      };
      const v = dataLinkView(p).sichtbar;
      const html = render(<DataLinkSection {...p} />);
      const feld = f.ordnerText === true && f.feldRueckruf;
      const entfernen = f.folder !== '' && f.entfernenRueckruf;
      return vergleiche(
        `${v.ordnerFeld}/${html.includes('>Ordnerpfad<')}/${v.ordnerEntfernen}/${html.includes('>Ordner entfernen<')}`,
        `${feld}/${feld}/${entfernen}/${entfernen}`,
      );
    },
  );
}
{
  const html = render(<DataLinkSection {...erweitert} locked="Im Verbund kommen die Speaker vom Master „Regie-PC“." />);
  const z = sperrZaehlung(html);
  ok(z.alle === 4 && z.gesperrt === 4, `DataLink erweitert locked: Pfadfeld, Ordner wählen, Ordner entfernen und Zurück disabled (${z.gesperrt} von ${z.alle})`);
  enthaelt(html, 'Gesperrt: Im Verbund kommen die Speaker vom Master „Regie-PC“.', 'DataLink erweitert locked: Grund des Tools wörtlich');
}
{
  // Aktion ohne DOM (Muster peerSetzen): der Knopf ruft genau ordnerEntfernen(p).
  const aufrufe: string[] = [];
  const mit: DataLinkSectionProps = { ...erweitert, onClearFolder: () => aufrufe.push('entfernt') };
  ok(ordnerEntfernen(mit) === true && aufrufe.length === 1, 'DataLink Ordner entfernen: Aufruf gemeldet');
  ok(ordnerEntfernen({ ...mit, locked: 'Vom Master vorgegeben' }) === false && aufrufe.length === 1, 'DataLink Ordner entfernen: gesperrt kein Aufruf');
  ok(ordnerEntfernen({ ...mit, locked: '   ' }) === true && aufrufe.length === 2, 'DataLink Ordner entfernen: ein Grund nur aus Leerzeichen sperrt nicht (istGesperrt)');
  ok(ordnerEntfernen({ ...mit, folder: '' }) === false && aufrufe.length === 2, 'DataLink Ordner entfernen: ohne Ordner kein Aufruf');
  ok(ordnerEntfernen({ ...alle }) === false, 'DataLink Ordner entfernen ohne onClearFolder: kein Aufruf, kein Absturz');
  const quelle = leseText('src/abschnitte/DataLinkSection.tsx');
  ok(
    quelle.includes('onClick={() => ordnerEntfernen(p)}') &&
      quelle.includes('useTextEntwurf(p.folder, (neu) => p.onFolderText?.(neu), undefined, gesperrt)') &&
      quelle.includes('<TextInput {...pfad.feld}'),
    'DataLink Verdrahtung: „Ordner entfernen“ ruft ordnerEntfernen, das Pfadfeld meldet über den Text-Entwurf (nicht je Tastendruck), die Sperre geht an den Entwurf',
  );
}
{
  // Titler-Muster: Daten aus der Show, kein eigener Ordner (E10).
  const html = render(<DataLinkSection id="datalink" folder="" externeQuelle eintraege={5} sourceLine="Quelle: Show „Gala“ · 5 Speaker" onPickFolder={() => {}} />);
  enthaelt(html, '>5 Einträge</span>', 'DataLink Show ohne eigenen Ordner: Statuspille „5 Einträge“ statt „kein Ordner“');
  enthaelt(html, '>kein Ordner</div>', 'DataLink Show ohne eigenen Ordner: die Anzeige „Ordner“ bleibt ehrlich „kein Ordner“');
  const item = abschnittStatusItem(dataLinkView({ id: 'datalink', folder: '', externeQuelle: true, eintraege: 0 }), { group: 'tool', label: 'DataLink' });
  gleich({ state: item.state, detail: item.detail }, { state: 'warn', detail: 'keine Einträge' }, 'DataLink Show ohne Einträge: Statuseintrag warn „keine Einträge“');
}
