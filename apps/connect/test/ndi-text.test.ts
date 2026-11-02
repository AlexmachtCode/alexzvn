// NDI-Texte, Abzeichen, Raumansicht und Tray-Gästezeile von JM Connect OHNE Electron (tsx): npm run selftest -w @jm/connect
// Spec 22.9 (Texte T107–T146), 22.5 (Regel G und P; ab Plan C Task C5 Regel V, ab Task C6 Regel R und TT), 22.10 (Kreuzprodukt,
// je Wahrheitsprädikat eine eigene Prüfung), 22.11 (PK52 Texte, PK58 rein). Die Texte im Test sind aus der Spec abgeschrieben,
// nicht aus dem Modul (Präfix „S“). Die Lagen sind Daten in der Form aus src/main/ndi-lage.ts (Plan C Block c1).
import { initialRoomState, ndiGastName, reduce } from '@jm/rtc/state';
import type { RoomState } from '@jm/rtc/protocol';
import type {
  NdiArt, NdiGastGrund, NdiProgrammGrund, NdiProgrammLage, NdiProgrammZustand, NdiQuelleLage, NdiQuelleZustand,
} from '../src/main/ndi-lage';
import {
  bildschirmTooltip, gastAbzeichen, kopfzeileSichtbar, NDI_TEXT, oeffnenMeldung, programmAbzeichen, T140_NACH_MS,
  type Abzeichen, type GastAbzeichenEingabe, type OeffnenStelle,
} from '../src/shared/ndi-text';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
/** Ein Prädikat über alle Kombinationen ist EINE Prüfung; bei einer Abweichung bis zu fünf Beispiele. */
function alle<T>(name: string, faelle: readonly T[], gilt: (f: T) => boolean, zeige: (f: T) => string): void {
  const falsch = faelle.filter((f) => !gilt(f));
  ck(name, falsch.length === 0);
  for (const f of falsch.slice(0, 5)) console.log(`        z. B. ${zeige(f)}`);
}

// ── Testhilfen ──
const quelle = (o: Partial<NdiQuelleLage> = {}): NdiQuelleLage => ({
  schluessel: 'g1', art: 'kamera', label: 'JM Connect – Anna', zustand: 'sendet', grund: null, code: null, k: 0, empfaenger: null, ...o,
});
const gast = (o: Partial<GastAbzeichenEingabe> = {}): GastAbzeichenEingabe => ({
  lage: quelle(), eingelassen: true, ohneEintragSeitMs: null, art: 'kamera', plattform: 'win32', raumverbunden: true, ...o,
});
const schirm = (o: Partial<NdiQuelleLage> = {}): NdiQuelleLage => quelle({ schluessel: 'g1::screen', art: 'bildschirm', label: 'JM Connect – Anna (Bildschirm)', ...o });
const programm = (o: Partial<NdiProgrammLage> = {}): NdiProgrammLage => ({
  zustand: 'verbunden', grund: null, code: null, k: 0, quelle: 'REGIE (JM Switcher)', hinweis: 'JM Switcher', bereit: true, ...o,
});
const g = (o: Partial<GastAbzeichenEingabe>): Abzeichen | null => gastAbzeichen(gast(o));
const p = (o: Partial<NdiProgrammLage>, plattform: 'win32' | 'darwin' = 'win32'): Abzeichen => programmAbzeichen({ lage: programm(o), plattform });
const gleichA = (a: Abzeichen | null, b: Abzeichen | null): boolean =>
  a === b || (a !== null && b !== null && a.text === b.text && a.title === b.title && a.tooltip === b.tooltip
    && a.grundzeile === b.grundzeile && a.knopfNeustart === b.knopfNeustart && a.knopfLogordner === b.knopfLogordner);
const zeigeA = (a: Abzeichen | null): string => (a === null ? 'kein Abzeichen' : JSON.stringify(a));

// Texte aus 22.9, aus der Spec abgeschrieben.
const S = {
  T107: 'NDI startet …',
  T108: 'NDI ●',
  T108n: (c: number): string => (c === 0 ? 'NDI ● kein Empfänger' : c === 1 ? 'NDI ● 1 Empfänger' : `NDI ● ${c} Empfänger`),
  T108mac: 'Kein Empfänger verbunden. Unter macOS braucht Connect für NDI den Zugriff auf das lokale Netzwerk (Systemeinstellungen › Datenschutz & Sicherheit › Lokales Netzwerk).',
  T109: 'NDI: kein Bild',
  T109tip: 'Die NDI-Quelle besteht, aber seit über 3 s kam kein Bild für sie an.',
  T110: (k: number): string => `NDI ausgefallen · Neustart ${k} von 3 …`,
  T111: 'NDI ausgefallen',
  T111zeile: (art: NdiArt, grund: string): string => `${art === 'kamera' ? 'NDI-Quelle Kamera' : 'NDI-Quelle Bildschirm'}: ${grund} Details im Log.`,
  T112: 'Bildschirm: ',
  T113: (name: string): string => `Teilt seinen Bildschirm. Den Zustand der NDI-Quelle „JM Connect – ${name} (Bildschirm)“ zeigt das Abzeichen „Bildschirm: …“ daneben.`,
  T114: 'NDI fehlt in diesem Paket oder ließ sich nicht laden (Addon oder NDI-Laufzeit).',
  T115: 'Die NDI-Laufzeit ließ sich nicht starten.',
  T116: 'Der NDI-Sender ließ sich nicht anlegen.',
  T117: (code: number): string => `Der NDI-Prozess endete beim Start (Code ${code}).`,
  T118: 'Der NDI-Prozess fiel nach drei Neustarts erneut aus.',
  T119: 'Das interne Medienfenster von Connect fehlt. Bitte Connect neu starten.',
  T120: 'Programm: aus',
  T121: 'Programm sucht …',
  T122: 'Programm: keine Quelle',
  T122tip: (h: string): string => `Connect sucht laufend eine NDI-Quelle mit „${h}“ im Namen.`,
  T122mac: ' Unter macOS braucht Connect dafür den Zugriff auf das lokale Netzwerk (Systemeinstellungen › Datenschutz & Sicherheit › Lokales Netzwerk).',
  T123: (q: string): string => `Programm ● ${q}`,
  T124: (q: string): string => `Programm: kein Bild von ${q}`,
  T124tip: 'Von dieser NDI-Quelle kommt seit über 3 s kein Bild an (Switcher-Ausgang, Netz oder NDI-Verbindung).',
  T125: 'Programm kommt an, die Weitergabe an die Gäste hängt',
  T126: (q: string): string => `Programm: Öffnen gescheitert (${q}) · neuer Versuch folgt`,
  T127: (k: number): string => `Programm-Empfang ausgefallen · Neustart ${k} von 3 …`,
  T128: 'Programm-Empfang ausgefallen',
  T128zeile: (grund: string): string => `Programm-Empfang: ${grund} Details im Log.`,
  T138: 'Der NDI-Prozess meldete sich nicht binnen 10 s.',
  T139: 'Der NDI-Prozess meldete einen unbekannten Fehler.',
  T140: 'NDI: keine Quelle',
  T140tip: 'Für diesen Gast besteht in Connect keine NDI-Quelle, etwa nach einem Neustart von Connect bei offenem Raum.',
} as const;
const GRUND_S: Record<NdiGastGrund, (code: number | null) => string> = {
  addon: () => S.T114, init: () => S.T115, sender: () => S.T116, startAbbruch: (c) => S.T117(c ?? -1), absturz: () => S.T118,
  keinPeer: () => S.T119, keinStart: () => S.T138, unbekannt: () => S.T139,
};

console.log('— C4 · ST107–ST128, ST133, ST134, ST138–ST146 wörtlich (22.9, PK52)');
const SOLL: Array<[string, string | null | undefined, string]> = [
  ['T107', g({ lage: quelle({ zustand: 'startet' }) })?.text, 'NDI startet …'],
  ['T108 (vor dem ersten stat)', g({})?.text, 'NDI ●'],
  ['T108 (0 Empfänger)', g({ lage: quelle({ empfaenger: 0 }) })?.text, 'NDI ● kein Empfänger'],
  ['T108 (1 Empfänger)', g({ lage: quelle({ empfaenger: 1 }) })?.text, 'NDI ● 1 Empfänger'],
  ['T108 (2 Empfänger)', g({ lage: quelle({ empfaenger: 2 }) })?.text, 'NDI ● 2 Empfänger'],
  ['T108 (Tooltip macOS, 0 Empfänger)', g({ lage: quelle({ empfaenger: 0 }), plattform: 'darwin' })?.tooltip,
    'Kein Empfänger verbunden. Unter macOS braucht Connect für NDI den Zugriff auf das lokale Netzwerk (Systemeinstellungen › Datenschutz & Sicherheit › Lokales Netzwerk).'],
  ['T109', g({ lage: quelle({ zustand: 'ohneBild' }) })?.text, 'NDI: kein Bild'],
  ['T109 (Tooltip)', g({ lage: quelle({ zustand: 'ohneBild' }) })?.tooltip, 'Die NDI-Quelle besteht, aber seit über 3 s kam kein Bild für sie an.'],
  ['T110 (k = 1)', g({ lage: quelle({ zustand: 'neustart', k: 1, code: 1 }) })?.text, 'NDI ausgefallen · Neustart 1 von 3 …'],
  ['T110 (k = 3)', g({ lage: quelle({ zustand: 'neustart', k: 3, code: 1 }) })?.text, 'NDI ausgefallen · Neustart 3 von 3 …'],
  ['T111 (Abzeichen)', g({ lage: quelle({ zustand: 'gescheitert', grund: 'init' }) })?.text, 'NDI ausgefallen'],
  ['T111 (Zeile Kamera) mit T114', g({ lage: quelle({ zustand: 'gescheitert', grund: 'addon' }) })?.grundzeile,
    'NDI-Quelle Kamera: NDI fehlt in diesem Paket oder ließ sich nicht laden (Addon oder NDI-Laufzeit). Details im Log.'],
  ['T111 (Zeile Kamera) mit T115', g({ lage: quelle({ zustand: 'gescheitert', grund: 'init' }) })?.grundzeile,
    'NDI-Quelle Kamera: Die NDI-Laufzeit ließ sich nicht starten. Details im Log.'],
  ['T111 (Zeile Kamera) mit T116', g({ lage: quelle({ zustand: 'gescheitert', grund: 'sender' }) })?.grundzeile,
    'NDI-Quelle Kamera: Der NDI-Sender ließ sich nicht anlegen. Details im Log.'],
  ['T111 (Zeile Kamera) mit T117', g({ lage: quelle({ zustand: 'gescheitert', grund: 'startAbbruch', code: 3221225477 }) })?.grundzeile,
    'NDI-Quelle Kamera: Der NDI-Prozess endete beim Start (Code 3221225477). Details im Log.'],
  ['T111 (Zeile Kamera) mit T117 ohne Exit-Code (kommt nicht vor; Owner-Frage OFC1, Vorgabe „unbekannt“)',
    g({ lage: quelle({ zustand: 'gescheitert', grund: 'startAbbruch', code: null }) })?.grundzeile,
    'NDI-Quelle Kamera: Der NDI-Prozess endete beim Start (Code unbekannt). Details im Log.'],
  ['T111 (Zeile Kamera) mit T118', g({ lage: quelle({ zustand: 'gescheitert', grund: 'absturz', code: 1, k: 3 }) })?.grundzeile,
    'NDI-Quelle Kamera: Der NDI-Prozess fiel nach drei Neustarts erneut aus. Details im Log.'],
  ['T111 (Zeile Kamera) mit T119', g({ lage: quelle({ zustand: 'gescheitert', grund: 'keinPeer' }) })?.grundzeile,
    'NDI-Quelle Kamera: Das interne Medienfenster von Connect fehlt. Bitte Connect neu starten. Details im Log.'],
  ['T111 (Zeile Kamera) mit T138', g({ lage: quelle({ zustand: 'gescheitert', grund: 'keinStart' }) })?.grundzeile,
    'NDI-Quelle Kamera: Der NDI-Prozess meldete sich nicht binnen 10 s. Details im Log.'],
  ['T111 (Zeile Kamera) mit T139', g({ lage: quelle({ zustand: 'gescheitert', grund: 'unbekannt' }) })?.grundzeile,
    'NDI-Quelle Kamera: Der NDI-Prozess meldete einen unbekannten Fehler. Details im Log.'],
  ['T111 (Zeile Bildschirm)', g({ art: 'bildschirm', lage: schirm({ zustand: 'gescheitert', grund: 'init' }) })?.grundzeile,
    'NDI-Quelle Bildschirm: Die NDI-Laufzeit ließ sich nicht starten. Details im Log.'],
  ['T111 (Knopf)', NDI_TEXT.t111Knopf, 'NDI neu starten'],
  ['T112 (Präfix, Abzeichen „Bildschirm: NDI ●“)', g({ art: 'bildschirm', lage: schirm() })?.text, 'Bildschirm: NDI ●'],
  ['T112 (Präfix bei T111)', g({ art: 'bildschirm', lage: schirm({ zustand: 'gescheitert', grund: 'absturz' }) })?.text, 'Bildschirm: NDI ausgefallen'],
  ['T113', bildschirmTooltip('Anna'),
    'Teilt seinen Bildschirm. Den Zustand der NDI-Quelle „JM Connect – Anna (Bildschirm)“ zeigt das Abzeichen „Bildschirm: …“ daneben.'],
  ['T120', p({ zustand: 'aus', quelle: null, bereit: false }).text, 'Programm: aus'],
  ['T121', p({ zustand: 'sucht', quelle: null, bereit: false }).text, 'Programm sucht …'],
  ['T122', p({ zustand: 'keineQuelle', quelle: null }).text, 'Programm: keine Quelle'],
  ['T122 (Tooltip win32)', p({ zustand: 'keineQuelle', quelle: null }).tooltip, 'Connect sucht laufend eine NDI-Quelle mit „JM Switcher“ im Namen.'],
  ['T122 (Tooltip darwin, abweichender hinweis)', p({ zustand: 'keineQuelle', quelle: null, hinweis: 'Regie 2' }, 'darwin').tooltip,
    'Connect sucht laufend eine NDI-Quelle mit „Regie 2“ im Namen. Unter macOS braucht Connect dafür den Zugriff auf das lokale Netzwerk (Systemeinstellungen › Datenschutz & Sicherheit › Lokales Netzwerk).'],
  ['T123', p({}).text, 'Programm ● REGIE (JM Switcher)'],
  ['T124', p({ zustand: 'ohneBild' }).text, 'Programm: kein Bild von REGIE (JM Switcher)'],
  ['T124 (Tooltip)', p({ zustand: 'ohneBild' }).tooltip, 'Von dieser NDI-Quelle kommt seit über 3 s kein Bild an (Switcher-Ausgang, Netz oder NDI-Verbindung).'],
  ['T125', p({ zustand: 'staut' }).text, 'Programm kommt an, die Weitergabe an die Gäste hängt'],
  ['T126', p({ zustand: 'fehler' }).text, 'Programm: Öffnen gescheitert (REGIE (JM Switcher)) · neuer Versuch folgt'],
  ['T127 (k = 2)', p({ zustand: 'neustart', quelle: null, k: 2, code: 1, bereit: false }).text, 'Programm-Empfang ausgefallen · Neustart 2 von 3 …'],
  ['T128 (Abzeichen)', p({ zustand: 'gescheitert', grund: 'init', quelle: null, bereit: false }).text, 'Programm-Empfang ausgefallen'],
  ['T128 (Zeile) mit T115', p({ zustand: 'gescheitert', grund: 'init', quelle: null, bereit: false }).grundzeile,
    'Programm-Empfang: Die NDI-Laufzeit ließ sich nicht starten. Details im Log.'],
  ['T128 (Zeile) mit T117', p({ zustand: 'gescheitert', grund: 'startAbbruch', code: 1, quelle: null, bereit: false }).grundzeile,
    'Programm-Empfang: Der NDI-Prozess endete beim Start (Code 1). Details im Log.'],
  ['T128 (Zeile) mit T119', p({ zustand: 'gescheitert', grund: 'keinPeer', quelle: null, bereit: false }).grundzeile,
    'Programm-Empfang: Das interne Medienfenster von Connect fehlt. Bitte Connect neu starten. Details im Log.'],
  ['T128 (Knopf)', NDI_TEXT.t128Knopf, 'Programm neu starten'],
  ['T133 (Link)', NDI_TEXT.t133, 'ndi.video'],
  ['T133 (Tooltip)', NDI_TEXT.t133Tooltip, 'NDI-Website öffnen (ndi.video)'],
  ['T133 (Adresse)', NDI_TEXT.t133Adresse, 'https://ndi.video/'],
  ['T134', NDI_TEXT.t134, 'NDI® is a registered trademark of Vizrt NDI AB.'],
  ['T140', g({ lage: null, ohneEintragSeitMs: 3000 })?.text, 'NDI: keine Quelle'],
  ['T140 (Tooltip)', g({ lage: null, ohneEintragSeitMs: 3000 })?.tooltip,
    'Für diesen Gast besteht in Connect keine NDI-Quelle, etwa nach einem Neustart von Connect bei offenem Raum.'],
  ['T140 (Bildschirm, mit T112)', g({ art: 'bildschirm', lage: null, ohneEintragSeitMs: 3000 })?.text, 'Bildschirm: NDI: keine Quelle'],
  ['T141', NDI_TEXT.t141,
    'Keine Verbindung zum Raum; Connect versucht laufend, neu zu verbinden. Die Gästeliste zeigt den letzten Stand, die NDI-Abzeichen den aktuellen; Gäste steuern, Talkback, Folien und Einladen gehen erst wieder mit der Verbindung.'],
  ['T142 (Knopf Logordner, auch T111 und T128)', NDI_TEXT.t142Logordner, 'Logordner öffnen'],
  ['T142 (Knopf Lizenz)', NDI_TEXT.t142Lizenz, 'Lizenzbedingungen'],
  ['T143 (Logordner)', oeffnenMeldung('logordnerFusszeile', 'gescheitert', 'C:\\Users\\Regie\\AppData\\Roaming\\JM Connect\\logs'),
    'Logordner ließ sich nicht öffnen: C:\\Users\\Regie\\AppData\\Roaming\\JM Connect\\logs'],
  ['T143 (Lizenzbedingungen)', oeffnenMeldung('lizenz', 'gescheitert', '/Applications/JM Connect.app/Contents/Resources/LIZENZ.txt'),
    'Lizenzbedingungen ließen sich nicht öffnen: /Applications/JM Connect.app/Contents/Resources/LIZENZ.txt'],
  ['T143 (ndi.video)', oeffnenMeldung('linkGaeste', 'gescheitert', 'https://ndi.video/'), 'ndi.video ließ sich nicht öffnen: https://ndi.video/'],
  ['T144', NDI_TEXT.t144,
    'Verbindung zum Raum beendet: Die Anmeldung von Connect gilt 8 Stunden ab dem letzten „Raum öffnen“ und ist abgelaufen, Connect versucht es für die Bedienung nicht mehr. „Raum öffnen“ meldet Connect neu an, ohne einen verteilten Link ungültig zu machen; Bilder und Programm-Rückkanal können dabei kurz aussetzen.'],
  ['T144 (Zusatz bei bekanntem Raum-Zustand)', NDI_TEXT.t144Zusatz, ' Die Gästeliste zeigt den letzten Stand, die NDI-Abzeichen den aktuellen.'],
  ['T145', NDI_TEXT.t145, 'Remote-Zuschaltungen als NDI®-Quellen — Green Room'],
  ['T146', NDI_TEXT.t146('R1'), 'Keine Verbindung zum Raum „R1“. Adresse und Proxy-Key prüfen — im Hintergrund wird weiter versucht.'],
];
for (const [id, ist, soll] of SOLL) ck(`S${id} wörtlich`, ist === soll);
{
  // Jeder Wert aus NDI_TEXT (Funktionen mit Probewerten): kein ASCII-Anführungszeichen (22.1 Nr. 7, OE2).
  const texte: string[] = [];
  for (const v of Object.values(NDI_TEXT)) {
    if (typeof v === 'string') texte.push(v);
    else if (typeof v === 'function') texte.push(String((v as (a: unknown, b: unknown) => unknown)(2, 'X')));
  }
  ck(`S22.9: kein ASCII-Anführungszeichen in den ${texte.length} Werten von NDI_TEXT`, texte.length >= 40 && texte.every((t) => !t.includes('"')));
  ck('ST145 trägt das ®, T134 nennt Vizrt NDI AB', NDI_TEXT.t145.includes('NDI®') && NDI_TEXT.t134.includes('Vizrt NDI AB'));
}

console.log('— C4 · T113 nennt die NDI-Quelle so, wie der Raum sie anlegt (C-EP5, ndiGastName aus @jm/rtc)');
{
  // Der Name der Bildschirm-Quelle kommt aus der Room-State-Machine (spinUpNdi mit stream 'screen'); der Tooltip muss genau
  // diesen Namen tragen, nicht den rohen Gastnamen.
  const bildschirmLabel = (name: string): string | null => {
    let s: RoomState = initialRoomState('R1');
    s = reduce(s, { t: 'guestJoin', guestId: 'g1', name }, 1000).state;
    s = reduce(s, { t: 'approve', guestId: 'g1' }, 1000).state;
    const e = reduce(s, { t: 'guestTracks', guestId: 'g1', hasScreen: true }, 1000).effects
      .find((x) => x.t === 'spinUpNdi' && x.stream === 'screen');
    return e && e.t === 'spinUpNdi' ? e.label : null;
  };
  const NAMEN: Array<[string, string, string]> = [
    ['einfacher Name', 'Anna', 'Anna'],
    ['Satzzeichen und Anführungszeichen fallen weg', 'Dr. Anna "Müller" <x>', 'Dr Anna Müller x'],
    ['Umlaute, Ziffern, _ und - bleiben', 'Zoë-Marie_2', 'Zoë-Marie_2'],
    ['leer → „Gast“', '', 'Gast'],
    ['nur Zeichen, die wegfallen → „Gast“', '!!!', 'Gast'],
    ['länger als 40 → 40 Zeichen', 'A'.repeat(45), 'A'.repeat(40)],
  ];
  for (const [titel, roh, sauber] of NAMEN) {
    ck(`C-EP5 ndiGastName: ${titel}`, ndiGastName(roh) === sauber);
    const label = bildschirmLabel(roh);
    ck(`ST113 nennt die Quelle des Raums wörtlich (${titel})`,
      label === `JM Connect – ${sauber} (Bildschirm)` && bildschirmTooltip(roh) === S.T113(sauber) && bildschirmTooltip(roh).includes(`„${label}“`));
  }
}

console.log('— C4 · Zähltests (22.10): 5 Gast-Zustände, 9 Programm-Zustände, 8 bzw. 7 Gründe');
const GAST_Z: Record<NdiQuelleZustand, true> = { startet: true, sendet: true, ohneBild: true, neustart: true, gescheitert: true };
const PROG_Z: Record<NdiProgrammZustand, true> = {
  aus: true, sucht: true, keineQuelle: true, verbunden: true, ohneBild: true, staut: true, fehler: true, neustart: true, gescheitert: true,
};
const GAST_GRUENDE: Record<NdiGastGrund, true> = {
  addon: true, init: true, sender: true, startAbbruch: true, absturz: true, keinPeer: true, keinStart: true, unbekannt: true,
};
const PROG_GRUENDE: Record<NdiProgrammGrund, true> = {
  addon: true, init: true, startAbbruch: true, absturz: true, keinPeer: true, keinStart: true, unbekannt: true,
};
ck('NdiQuelleZustand hat 5 Werte', Object.keys(GAST_Z).length === 5);
ck('NdiProgrammZustand hat 9 Werte', Object.keys(PROG_Z).length === 9);
ck('NdiGastGrund hat 8 Werte', Object.keys(GAST_GRUENDE).length === 8);
ck('NdiProgrammGrund hat 7 Werte', Object.keys(PROG_GRUENDE).length === 7);
ck('jeder Gast-Zustand hat ein Abzeichen mit Text (Laufzeit; der Typcheck prüft den Record im Modul)',
  (Object.keys(GAST_Z) as NdiQuelleZustand[]).every((z) => (g({ lage: quelle({ zustand: z, grund: z === 'gescheitert' ? 'init' : null, k: z === 'neustart' ? 1 : 0 }) })?.text ?? '') !== ''));
ck('jeder Programm-Zustand hat ein Abzeichen mit Text',
  (Object.keys(PROG_Z) as NdiProgrammZustand[]).every((z) => p({ zustand: z, grund: z === 'gescheitert' ? 'init' : null, k: z === 'neustart' ? 1 : 0 }).text !== ''));
ck('jeder Gast-Grund hat einen Text in der Grundzeile', (Object.keys(GAST_GRUENDE) as NdiGastGrund[]).every((r) => {
  const z = g({ lage: quelle({ zustand: 'gescheitert', grund: r, code: 1 }) })?.grundzeile ?? '';
  return /^NDI-Quelle Kamera: .+\. Details im Log\.$/.test(z) && !z.includes('undefined');
}));
ck('jeder Programm-Grund hat einen Text in der Grundzeile', (Object.keys(PROG_GRUENDE) as NdiProgrammGrund[]).every((r) => {
  const z = p({ zustand: 'gescheitert', grund: r, code: 1, quelle: null }).grundzeile ?? '';
  return /^Programm-Empfang: .+\. Details im Log\.$/.test(z) && !z.includes('undefined');
}));

console.log('— C4 · Gast-Abzeichen nach Regel G als Kreuzprodukt (22.10) mit den Wahrheitsprädikaten');
type Phase = 'warteraum' | 'freigegeben' | 'aufSendung';
interface GastFall {
  eintrag: boolean; phase: Phase; teilt: boolean; zustand: NdiQuelleZustand; grund: NdiGastGrund | null; k: number;
  empf: number | null; art: NdiArt; plattform: 'win32' | 'darwin'; raum: boolean; seit: number | null;
}
/** Regel G (22.5), im Test aus der Spec abgeschrieben: erste passende Zeile. */
function regelG(f: GastFall): Abzeichen | null {
  const praefix = f.art === 'bildschirm' ? S.T112 : '';
  const eingelassen = f.phase !== 'warteraum' && (f.art === 'kamera' || f.teilt);
  const nur = (text: string, tooltip: string | null): Abzeichen =>
    ({ text: praefix + text, title: praefix + text, tooltip, grundzeile: null, knopfNeustart: false, knopfLogordner: false });
  if (!f.eintrag) return eingelassen && f.seit !== null && f.seit >= 3000 ? nur(S.T140, S.T140tip) : null;
  switch (f.zustand) {
    case 'startet': return nur(S.T107, null);
    case 'sendet': return nur(f.empf === null ? S.T108 : S.T108n(f.empf), f.empf === 0 && f.plattform === 'darwin' ? S.T108mac : null);
    case 'ohneBild': return nur(S.T109, S.T109tip);
    case 'neustart': return nur(S.T110(f.k), null);
    case 'gescheitert': return {
      text: praefix + S.T111, title: praefix + S.T111, tooltip: null, grundzeile: S.T111zeile(f.art, GRUND_S[f.grund ?? 'unbekannt'](7)),
      knopfNeustart: f.grund !== 'keinPeer', knopfLogordner: true,
    };
  }
}
const eingabeG = (f: GastFall): GastAbzeichenEingabe => ({
  lage: f.eintrag
    ? (f.art === 'kamera' ? quelle : schirm)({ zustand: f.zustand, grund: f.grund, k: f.k, empfaenger: f.empf, code: f.zustand === 'gescheitert' || f.zustand === 'neustart' ? 7 : null })
    : null,
  eingelassen: f.phase !== 'warteraum' && (f.art === 'kamera' || f.teilt),
  ohneEintragSeitMs: f.eintrag ? null : f.seit,
  art: f.art, plattform: f.plattform, raumverbunden: f.raum,
});
const GAST_FAELLE: GastFall[] = [];
for (const art of ['kamera', 'bildschirm'] as NdiArt[]) for (const phase of ['warteraum', 'freigegeben', 'aufSendung'] as Phase[])
  for (const teilt of art === 'bildschirm' ? [true, false] : [false]) for (const plattform of ['win32', 'darwin'] as const)
    for (const raum of [true, false]) {
      for (const seit of [2999, 3000]) GAST_FAELLE.push({ eintrag: false, phase, teilt, zustand: 'startet', grund: null, k: 0, empf: null, art, plattform, raum, seit });
      for (const zustand of Object.keys(GAST_Z) as NdiQuelleZustand[]) {
        const gruende = zustand === 'gescheitert' ? (Object.keys(GAST_GRUENDE) as NdiGastGrund[]) : [null];
        const ks = zustand === 'neustart' ? [1, 2, 3] : [0];
        const empfs = zustand === 'sendet' ? [null, 0, 1, 2] : [null];
        for (const grund of gruende) for (const k of ks) for (const empf of empfs)
          GAST_FAELLE.push({ eintrag: true, phase, teilt, zustand, grund, k, empf, art, plattform, raum, seit: null });
      }
    }
const GF = GAST_FAELLE.map((f) => ({ f, a: gastAbzeichen(eingabeG(f)) }));
const zeigeG = ({ f, a }: { f: GastFall; a: Abzeichen | null }): string => `${JSON.stringify(f)} → ${zeigeA(a)}`;
console.log(`     22.10 Gast-Abzeichen: ${GF.length} Kombinationen geprüft`);
alle('22.10 Gast-Abzeichen: jede Kombination wörtlich nach Regel G (Text, title, Tooltip, Grundzeile, Knöpfe)', GF,
  ({ f, a }) => gleichA(a, regelG(f)), zeigeG);
const textG = (a: Abzeichen | null): string => (a === null ? '' : `${a.text}\n${a.tooltip ?? ''}\n${a.grundzeile ?? ''}`);
alle('Prädikat „NDI ●“ ⇒ sendet', GF, ({ f, a }) => !(a?.text ?? '').includes('NDI ●') || (f.eintrag && f.zustand === 'sendet'), zeigeG);
alle('Prädikat „kein Empfänger“ ⇒ sendet mit Empfängerzahl 0', GF,
  ({ f, a }) => !textG(a).includes('kein Empfänger') || (f.eintrag && f.zustand === 'sendet' && f.empf === 0), zeigeG);
alle('Prädikat „kein Bild“ ⇒ ohneBild (T109)', GF, ({ f, a }) => !textG(a).includes('kein Bild') || (f.eintrag && f.zustand === 'ohneBild'), zeigeG);
alle('Prädikat „Neustart {k} von 3“ ⇒ neustart und k ≤ 3 (k wie in der Lage)', GF, ({ f, a }) => {
  const m = /Neustart (\d+) von 3/.exec(textG(a));
  return m === null || (f.eintrag && f.zustand === 'neustart' && Number(m[1]) === f.k && f.k <= 3);
}, zeigeG);
alle('Prädikat Knopf „NDI neu starten“ ⇒ gescheitert und Grund nicht keinPeer', GF,
  ({ f, a }) => !a?.knopfNeustart || (f.eintrag && f.zustand === 'gescheitert' && f.grund !== 'keinPeer'), zeigeG);
alle('Prädikat „Details im Log“ steht nur mit dem Knopf „Logordner öffnen“ (und dieser nur dort)', GF,
  ({ a }) => textG(a).includes('Details im Log') === (a?.knopfLogordner ?? false), zeigeG);
alle('Prädikat „lokale Netzwerk“ ⇒ darwin und Empfängerzahl 0', GF,
  ({ f, a }) => !textG(a).includes('lokale Netzwerk') || (f.plattform === 'darwin' && f.eintrag && f.zustand === 'sendet' && f.empf === 0), zeigeG);
alle('Prädikat „NDI: keine Quelle“ ⇒ kein Eintrag seit mindestens 3 s und Gast eingelassen bzw. teilt', GF,
  ({ f, a }) => !textG(a).includes('NDI: keine Quelle')
    || (!f.eintrag && (f.seit ?? 0) >= 3000 && f.phase !== 'warteraum' && (f.art === 'kamera' || f.teilt)), zeigeG);
alle('Prädikat title = voller Text des Abzeichens (Regel G)', GF, ({ a }) => a === null || a.title === a.text, zeigeG);
alle('Prädikat Bildschirm-Quelle = Regel der Kamera mit dem Präfix T112 (ohne Eintrag zählt „teilt“)', GF.filter(({ f }) => f.art === 'bildschirm'), ({ f, a }) => {
  const k = gastAbzeichen(eingabeG({ ...f, art: 'kamera', teilt: false }));
  if (!f.eintrag && !(f.phase !== 'warteraum' && f.teilt)) return a === null;
  if (k === null) return a === null;
  return a !== null && a.text === S.T112 + k.text && a.title === S.T112 + k.title && a.tooltip === k.tooltip
    && a.knopfNeustart === k.knopfNeustart && a.knopfLogordner === k.knopfLogordner;
}, zeigeG);
alle('Prädikat Raumverbindung ändert Abzeichen und NDI-Knöpfe nicht (E53: die Knöpfe gehen per IPC)', GF,
  ({ f, a }) => gleichA(a, gastAbzeichen(eingabeG({ ...f, raum: !f.raum }))), zeigeG);
ck(`Regel G: eingelassen ohne Eintrag, ${T140_NACH_MS - 1} ms → kein Abzeichen, ${T140_NACH_MS} ms → T140 (T140_NACH_MS = 3000)`,
  T140_NACH_MS === 3000 && g({ lage: null, ohneEintragSeitMs: 2999 }) === null && g({ lage: null, ohneEintragSeitMs: 3000 })?.text === S.T140);
ck('Regel G: ohne Eintrag und ohne gemessene Zeit (null) → kein Abzeichen (eine Voreinstellung ist kein Messwert)',
  g({ lage: null, ohneEintragSeitMs: null }) === null);
ck('Regel G: Warteraum ohne Eintrag → kein Abzeichen, auch nach 10 s', g({ lage: null, eingelassen: false, ohneEintragSeitMs: 10_000 }) === null);

console.log('— C4 · Programm-Abzeichen nach Regel P als Kreuzprodukt (22.10), dazu die Kopfzeile × Raumverbindung (22.5 Ort 2, E53)');
interface ProgFall { zustand: NdiProgrammZustand; grund: NdiProgrammGrund | null; k: number; plattform: 'win32' | 'darwin'; hinweis: string; bereit: boolean; raum: boolean }
/** Regel P (22.5), aus der Spec abgeschrieben. Die Quelle ist in verbunden, ohneBild, staut und fehler gesetzt (22.4). */
function regelP(f: ProgFall): Abzeichen {
  const q = 'REGIE (JM Switcher)';
  const nur = (text: string, tooltip: string | null): Abzeichen => ({ text, title: text, tooltip, grundzeile: null, knopfNeustart: false, knopfLogordner: false });
  switch (f.zustand) {
    case 'aus': return nur(S.T120, null);
    case 'sucht': return nur(S.T121, null);
    case 'keineQuelle': return nur(S.T122, S.T122tip(f.hinweis) + (f.plattform === 'darwin' ? S.T122mac : ''));
    case 'verbunden': return nur(S.T123(q), null);
    case 'ohneBild': return nur(S.T124(q), S.T124tip);
    case 'staut': return nur(S.T125, null);
    case 'fehler': return nur(S.T126(q), null);
    case 'neustart': return nur(S.T127(f.k), null);
    case 'gescheitert': return {
      text: S.T128, title: S.T128, tooltip: null, grundzeile: S.T128zeile(GRUND_S[f.grund ?? 'unbekannt'](7)),
      knopfNeustart: f.grund !== 'keinPeer', knopfLogordner: true,
    };
  }
}
const PROG_FAELLE: ProgFall[] = [];
for (const zustand of Object.keys(PROG_Z) as NdiProgrammZustand[]) for (const plattform of ['win32', 'darwin'] as const)
  for (const hinweis of ['JM Switcher', 'Regie 2']) {
    const gruende = zustand === 'gescheitert' ? (Object.keys(PROG_GRUENDE) as NdiProgrammGrund[]) : [null];
    const ks = zustand === 'neustart' ? [1, 2, 3] : [0];
    const bereits = zustand === 'sucht' ? [false, true] : [zustand !== 'aus' && zustand !== 'neustart' && zustand !== 'gescheitert'];
    for (const grund of gruende) for (const k of ks) for (const bereit of bereits) for (const raum of [true, false])
      PROG_FAELLE.push({ zustand, grund, k, plattform, hinweis, bereit, raum });
  }
const MIT_QUELLE: NdiProgrammZustand[] = ['verbunden', 'ohneBild', 'staut', 'fehler'];
const PF = PROG_FAELLE.map((f) => ({
  f,
  a: programmAbzeichen({
    lage: programm({ zustand: f.zustand, grund: f.grund, k: f.k, hinweis: f.hinweis, bereit: f.bereit,
      code: f.zustand === 'gescheitert' || f.zustand === 'neustart' ? 7 : null, quelle: MIT_QUELLE.includes(f.zustand) ? 'REGIE (JM Switcher)' : null }),
    plattform: f.plattform,
  }),
}));
const zeigeP = ({ f, a }: { f: ProgFall; a: Abzeichen }): string => `${JSON.stringify(f)} → ${zeigeA(a)}`;
console.log(`     22.10 Programm-Abzeichen: ${PF.length} Kombinationen geprüft (× Raumverbindung: sie entscheidet nur, ob die Kopfzeile steht; das Abzeichen hat keine Raum-Eingabe, E53)`);
alle('22.10 Programm-Abzeichen: jede Kombination wörtlich nach Regel P (Text, title, Tooltip, Grundzeile, Knöpfe)', PF, ({ f, a }) => gleichA(a, regelP(f)), zeigeP);
alle('Prädikat „kein Bild“ ⇒ ohneBild (T124)', PF, ({ f, a }) => !textG(a).includes('kein Bild') || f.zustand === 'ohneBild', zeigeP);
alle('Prädikat „hängt“ ⇒ staut', PF, ({ f, a }) => !textG(a).includes('hängt') || f.zustand === 'staut', zeigeP);
alle('Prädikat „Öffnen gescheitert“ ⇒ fehler', PF, ({ f, a }) => !textG(a).includes('Öffnen gescheitert') || f.zustand === 'fehler', zeigeP);
alle('Prädikat „Programm: aus“ ⇒ aus', PF, ({ f, a }) => !textG(a).includes('Programm: aus') || f.zustand === 'aus', zeigeP);
alle('Prädikat „Programm ●“ ⇒ verbunden', PF, ({ f, a }) => !textG(a).includes('Programm ●') || f.zustand === 'verbunden', zeigeP);
alle('Prädikat „Neustart {k} von 3“ ⇒ neustart und k ≤ 3 (k wie in der Lage)', PF, ({ f, a }) => {
  const m = /Neustart (\d+) von 3/.exec(textG(a));
  return m === null || (f.zustand === 'neustart' && Number(m[1]) === f.k && f.k <= 3);
}, zeigeP);
alle('Prädikat Knopf „Programm neu starten“ ⇒ gescheitert und Grund nicht keinPeer', PF,
  ({ f, a }) => !a.knopfNeustart || (f.zustand === 'gescheitert' && f.grund !== 'keinPeer'), zeigeP);
alle('Prädikat „Details im Log“ steht nur mit dem Knopf „Logordner öffnen“', PF, ({ a }) => textG(a).includes('Details im Log') === a.knopfLogordner, zeigeP);
alle('Prädikat „lokale Netzwerk“ ⇒ darwin und keineQuelle', PF,
  ({ f, a }) => !textG(a).includes('lokale Netzwerk') || (f.plattform === 'darwin' && f.zustand === 'keineQuelle'), zeigeP);
alle('Prädikat Tooltip T122 nur in keineQuelle und mit dem hinweis der Lage', PF,
  ({ f, a }) => (a.tooltip ?? '').includes('Connect sucht laufend') === (f.zustand === 'keineQuelle')
    && (f.zustand !== 'keineQuelle' || (a.tooltip ?? '').includes(`„${f.hinweis}“`)), zeigeP);
alle('Prädikat title = voller Text (Regel P; das Abzeichen kann abgeschnitten werden)', PF, ({ a }) => a.title === a.text, zeigeP);
/** 22.5 Ort 2 (E53), aus der Spec abgeschrieben: die Kopfzeile steht mit Raumverbindung und ohne sie, sobald der Empfang nicht aus ist. */
const kopfzeileS = (f: ProgFall): boolean => f.raum || f.zustand !== 'aus';
const kopfP = (f: ProgFall): boolean => kopfzeileSichtbar({ programm: f.zustand, raumverbunden: f.raum });
alle('22.10 Kopfzeile: jede Kombination × Raumverbindung nach 22.5 Ort 2 (mit Raumverbindung immer, ohne sie, sobald der Empfang nicht aus ist)', PF,
  ({ f }) => kopfP(f) === kopfzeileS(f), zeigeP);
alle('Prädikat Grundzeile T128 mit ihren Knöpfen ⇒ die Kopfzeile steht, auch ohne Raumverbindung (E53: die Knöpfe gehen per IPC)', PF,
  ({ f, a }) => a.grundzeile === null || kopfP(f), zeigeP);

console.log('— C4 · Öffnen-Meldung T143 (22.10, E35)');
{
  const STELLEN: OeffnenStelle[] = ['logordnerGrundzeile', 'logordnerFusszeile', 'lizenz', 'linkGaeste', 'linkSlots'];
  const FOLGEN: Array<[string, Array<'gescheitert' | 'gelungen'>]> = [
    ['keines', []], ['gescheitert', ['gescheitert']], ['gescheitert und danach gelungen', ['gescheitert', 'gelungen']],
    ['gelungen und danach gescheitert', ['gelungen', 'gescheitert']],
  ];
  const PFAD = 'C:\\Users\\Regie\\AppData\\Roaming\\JM Connect\\logs';
  const soll = (s: OeffnenStelle): string => (s === 'lizenz'
    ? `Lizenzbedingungen ließen sich nicht öffnen: ${PFAD}`
    : s === 'linkGaeste' || s === 'linkSlots' ? 'ndi.video ließ sich nicht öffnen: https://ndi.video/' : `Logordner ließ sich nicht öffnen: ${PFAD}`);
  const faelle = STELLEN.flatMap((s) => FOLGEN.map(([titel, folge]) => {
    const letztes = folge.length === 0 ? 'keines' : folge[folge.length - 1];
    return { s, titel, letztes, m: oeffnenMeldung(s, letztes, PFAD) };
  }));
  console.log(`     22.10 Öffnen-Meldung: ${faelle.length} Kombinationen geprüft`);
  alle('22.10 T143 steht genau nach einem Scheitern an dieser Stelle, wörtlich, und nicht mehr nach einem Gelingen', faelle,
    ({ s, letztes, m }) => m === (letztes === 'gescheitert' ? soll(s) : null), (x) => JSON.stringify(x));
  alle('Prädikat „ließ sich nicht öffnen“ bzw. „ließen sich nicht öffnen“ ⇒ das letzte Öffnen an dieser Stelle scheiterte', faelle,
    ({ letztes, m }) => !/ließ(en)? sich nicht öffnen/.test(m ?? '') || letztes === 'gescheitert', (x) => JSON.stringify(x));
  ck('T143 nennt beim Link immer die feste Adresse, nie eine fremde (jmc:ndi-seite öffnet nur https://ndi.video/)',
    oeffnenMeldung('linkSlots', 'gescheitert', 'https://example.invalid/') === 'ndi.video ließ sich nicht öffnen: https://ndi.video/');
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
