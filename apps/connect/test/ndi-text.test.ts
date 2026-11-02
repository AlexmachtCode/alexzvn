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

// ── Plan C, Task C5: Raumansicht (Regel V), Raumabbruch (E57) und Raum-Folge (OE3) ──
console.log('— C5 · Raumansicht nach Regel V: die sieben Lagen (22.10, PK58 rein)');
{
  const { raumAnsicht } = await import('../src/shared/raum-ansicht');
  type RA = import('../src/shared/raum-ansicht').RaumAnsicht;
  type RE = import('../src/shared/raum-ansicht').RaumAnsichtEingabe;
  // Regel V aus 22.5, im Test aus der Spec abgeschrieben: je Lage, was steht und was bedienbar ist.
  const LAGEN: Array<[string, RE, Omit<RA, 'ipcKnoepfeBedienbar'>]> = [
    ['1 kein Client ohne Raumabbruch', { client: false, verbunden: false, raumBekannt: false, raumabbruch: false },
      { raumOeffnen: true, raumSchliessen: false, gastEinladen: false, gaesteliste: false, t141: false, t144: false, t144Zusatz: false, wsKnoepfeBedienbar: false, linkErzeugenBedienbar: false }],
    ['2 kein Client nach Raumabbruch, Raum-Zustand unbekannt', { client: false, verbunden: false, raumBekannt: false, raumabbruch: true },
      { raumOeffnen: true, raumSchliessen: true, gastEinladen: false, gaesteliste: false, t141: false, t144: true, t144Zusatz: false, wsKnoepfeBedienbar: false, linkErzeugenBedienbar: false }],
    ['3 kein Client nach Raumabbruch, Raum-Zustand bekannt', { client: false, verbunden: false, raumBekannt: true, raumabbruch: true },
      { raumOeffnen: true, raumSchliessen: true, gastEinladen: false, gaesteliste: true, t141: false, t144: true, t144Zusatz: true, wsKnoepfeBedienbar: false, linkErzeugenBedienbar: false }],
    ['4 Client ohne Verbindung, Raum-Zustand unbekannt', { client: true, verbunden: false, raumBekannt: false, raumabbruch: false },
      { raumOeffnen: false, raumSchliessen: true, gastEinladen: true, gaesteliste: false, t141: false, t144: false, t144Zusatz: false, wsKnoepfeBedienbar: false, linkErzeugenBedienbar: false }],
    ['5 Client ohne Verbindung, Raum-Zustand bekannt', { client: true, verbunden: false, raumBekannt: true, raumabbruch: false },
      { raumOeffnen: false, raumSchliessen: true, gastEinladen: true, gaesteliste: true, t141: true, t144: false, t144Zusatz: false, wsKnoepfeBedienbar: false, linkErzeugenBedienbar: false }],
    ['6 Client verbunden, Raum-Zustand unbekannt', { client: true, verbunden: true, raumBekannt: false, raumabbruch: false },
      { raumOeffnen: false, raumSchliessen: true, gastEinladen: true, gaesteliste: false, t141: false, t144: false, t144Zusatz: false, wsKnoepfeBedienbar: true, linkErzeugenBedienbar: true }],
    ['7 Client verbunden, Raum-Zustand bekannt', { client: true, verbunden: true, raumBekannt: true, raumabbruch: false },
      { raumOeffnen: false, raumSchliessen: true, gastEinladen: true, gaesteliste: true, t141: false, t144: false, t144Zusatz: false, wsKnoepfeBedienbar: true, linkErzeugenBedienbar: true }],
  ];
  const FELDER = ['raumOeffnen', 'raumSchliessen', 'gastEinladen', 'gaesteliste', 't141', 't144', 't144Zusatz', 'wsKnoepfeBedienbar', 'linkErzeugenBedienbar'] as const;
  for (const [titel, e, soll] of LAGEN) {
    const ist = raumAnsicht(e);
    ck(`Regel V, Lage ${titel}: ${FELDER.filter((f) => soll[f]).join(', ') || '–'}; IPC-Knöpfe bedienbar`,
      FELDER.every((f) => ist[f] === soll[f]) && ist.ipcKnoepfeBedienbar === true);
  }
  // Prädikate (22.10) über die sieben Lagen; der Text kommt aus ndi-text.ts (T141, T144 samt Zusatz).
  const R = LAGEN.map(([titel, e]) => ({ titel, e, a: raumAnsicht(e) }));
  const zeilen = (a: RA): string => [a.t141 ? NDI_TEXT.t141 : '', a.t144 ? NDI_TEXT.t144 + (a.t144Zusatz ? NDI_TEXT.t144Zusatz : '') : ''].join('\n');
  const zeigeR = (x: { titel: string }): string => `Lage ${x.titel}`;
  alle('Prädikat „Raum öffnen“ ⇔ kein Client', R, ({ e, a }) => a.raumOeffnen === !e.client, zeigeR);
  alle('Prädikat „Verbindung zum Raum beendet“ ⇔ kein Client und Raumabbruch', R,
    ({ e, a }) => zeilen(a).includes('Verbindung zum Raum beendet') === (!e.client && e.raumabbruch), zeigeR);
  alle('Prädikat „Raum schließen“ bedienbar ⇔ Client besteht oder Raumabbruch', R, ({ e, a }) => a.raumSchliessen === (e.client || e.raumabbruch), zeigeR);
  alle('Prädikat „Keine Verbindung zum Raum“ (T141) ⇔ Client besteht, Raumverbindung nein und Raum-Zustand bekannt (T146 prüft PK58 im Quelltext)', R,
    ({ e, a }) => zeilen(a).includes('Keine Verbindung zum Raum') === (e.client && !e.verbunden && e.raumBekannt), zeigeR);
  alle('Prädikat „Die Gästeliste zeigt den letzten Stand“ ⇒ Raumverbindung nein und Raum-Zustand bekannt', R,
    ({ e, a }) => !zeilen(a).includes('Die Gästeliste zeigt den letzten Stand') || (!e.verbunden && e.raumBekannt), zeigeR);
  alle('Prädikat Knopf über die Raum-WebSocket oder „Link erzeugen“ bedienbar ⇒ Raumverbindung ja', R,
    ({ e, a }) => !(a.wsKnoepfeBedienbar || a.linkErzeugenBedienbar) || e.verbunden, zeigeR);
  alle('Prädikat Gästeliste ⇒ Raum-Zustand bekannt; „Gast einladen“ ⇔ Client besteht', R,
    ({ e, a }) => (!a.gaesteliste || e.raumBekannt) && a.gastEinladen === e.client, zeigeR);
  // Lagen, die nach E57 nicht vorkommen (ohne Client verbunden; Client mit Raumabbruch), sperren die WebSocket-Knöpfe trotzdem
  // ohne Client und zeigen „Raum öffnen“ nie neben einem Client.
  const UNMOEGLICH: RE[] = [
    { client: false, verbunden: true, raumBekannt: true, raumabbruch: false }, { client: false, verbunden: true, raumBekannt: true, raumabbruch: true },
    { client: true, verbunden: false, raumBekannt: true, raumabbruch: true }, { client: true, verbunden: true, raumBekannt: true, raumabbruch: true },
  ];
  ck('Regel V: auch in Lagen, die nicht vorkommen, ohne Client keine WebSocket-Knöpfe und mit Client kein „Raum öffnen“, kein T144',
    UNMOEGLICH.every((e) => { const a = raumAnsicht(e); return (e.client || !a.wsKnoepfeBedienbar) && (!e.client || (!a.raumOeffnen && !a.t144)); }));
  const nurOeffnen = raumAnsicht({ client: false, verbunden: false, raumBekannt: true, raumabbruch: false });
  ck('Regel V: ohne Client und ohne Raumabbruch steht nur „Raum öffnen“, auch wenn noch ein Raum-Zustand bekannt wäre',
    nurOeffnen.raumOeffnen && !nurOeffnen.raumSchliessen && !nurOeffnen.gastEinladen && !nurOeffnen.gaesteliste && !nurOeffnen.t141 && !nurOeffnen.t144);
}

console.log('— C5 · raumAbbruch nach Ablauf der Anmeldung (E57, Wanduhr)');
{
  const { raumAbbruch } = await import('../src/shared/raum-ansicht');
  const BIS = Date.UTC(2026, 9, 20, 18, 0, 0); // operatorBis = exp in ms (Wanduhr), fester Testwert
  const FAELLE: Array<[string, boolean, number, 'anmeldungAbgelaufen' | null]> = [
    ['verbunden, operatorBis − 1 ms', true, BIS - 1, null],
    ['verbunden, genau operatorBis', true, BIS, null],
    ['verbunden, operatorBis + 1 h (Anmeldung abgelaufen, Verbindung steht)', true, BIS + 3_600_000, null],
    ['getrennt, operatorBis − 1 ms', false, BIS - 1, null],
    ['getrennt, genau operatorBis', false, BIS, 'anmeldungAbgelaufen'],
    ['getrennt, operatorBis + 1 h', false, BIS + 3_600_000, 'anmeldungAbgelaufen'],
  ];
  for (const [titel, verbunden, jetzt, soll] of FAELLE) {
    ck(`E57 raumAbbruch: ${titel} → ${soll ?? 'kein Raumabbruch'}`, raumAbbruch({ verbunden, jetzt, operatorBis: BIS }) === soll);
  }
}

console.log('— C5 · Raum-Folge: „Raum schließen“ überholt ein laufendes „Raum öffnen“ nicht (OE3, C-EP3)');
{
  const { erzeugeRaumFolge } = await import('../src/shared/raum-ansicht');
  // Antwort des Mains auf „Raum öffnen“, die der Test von außen erfüllt oder ablehnt.
  const antwort = <T>(): { p: Promise<T>; erfuelle: (v: T) => void; lehneAb: (e: Error) => void } => {
    let erfuelle!: (v: T) => void; let lehneAb!: (e: Error) => void;
    const p = new Promise<T>((a, b) => { erfuelle = a; lehneAb = b; });
    return { p, erfuelle, lehneAb };
  };
  const takt = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
  {
    const folge = erzeugeRaumFolge(); const spur: string[] = []; const a = antwort<string>();
    const o = folge.oeffnen(async () => { spur.push('öffnen-Anfang'); const s = await a.p; spur.push('öffnen-Ende'); return s; });
    const z = folge.schliessen(async () => { spur.push('schließen'); });
    await takt(); await takt();
    ck('OE3: „schließen“, während „öffnen“ auf den Main wartet, läuft noch nicht', spur.join(',') === 'öffnen-Anfang');
    a.erfuelle('S1'); const ergebnis = await o; await z;
    ck('OE3: Reihenfolge öffnen-Anfang, öffnen-Ende, schließen; oeffnen gibt das Ergebnis weiter',
      spur.join(',') === 'öffnen-Anfang,öffnen-Ende,schließen' && ergebnis === 'S1');
  }
  {
    // Modell von room.ts: openRoom setzt das Secret erst nach der Antwort (:59-60), closeRoom verwirft es (:122-123).
    const folge = erzeugeRaumFolge(); let secret: string | null = null; const a = antwort<string>();
    const o = folge.oeffnen(async () => { secret = await a.p; });
    const z = folge.schliessen(async () => { secret = null; });
    a.erfuelle('geheim'); await o; await z;
    ck('OE3: eine spät zurückkommende Antwort setzt nach „Raum schließen“ kein Secret mehr (E57: Schließen verwirft jeden Link)', secret === null);
  }
  {
    const folge = erzeugeRaumFolge(); const spur: string[] = []; const a = antwort<string>();
    const o = folge.oeffnen(async () => { spur.push('öffnen'); return a.p; });
    const z = folge.schliessen(async () => { spur.push('schließen'); });
    a.lehneAb(new Error('Proxy nicht erreichbar'));
    let fehler = '';
    try { await o; } catch (e) { fehler = (e as Error).message; }
    await z;
    ck('OE3: scheitert „öffnen“, läuft „schließen“ danach trotzdem, und oeffnen gibt den Fehler weiter (Fehlerzweig von openRoom)',
      spur.join(',') === 'öffnen,schließen' && fehler === 'Proxy nicht erreichbar');
  }
  {
    const folge = erzeugeRaumFolge(); const spur: string[] = [];
    const z = folge.schliessen(async () => { spur.push('schließen'); });
    ck('OE3: ohne laufendes „öffnen“ beginnt „schließen“ sofort (noch im selben Aufruf)', spur.join(',') === 'schließen');
    await z;
  }
  {
    const folge = erzeugeRaumFolge(); const spur: string[] = []; const s = antwort<void>();
    const z = folge.schliessen(async () => { spur.push('schließen-Anfang'); await s.p; spur.push('schließen-Ende'); });
    const o = folge.oeffnen(async () => { spur.push('öffnen'); return 'S2'; });
    ck('OE3: „öffnen“ nach „schließen“ unverändert (wartet nicht auf das Schließen, wie heute)', spur.join(',') === 'schließen-Anfang,öffnen');
    s.erfuelle(); await z; await o;
  }
  {
    const folge = erzeugeRaumFolge(); const spur: string[] = [];
    await folge.oeffnen(async () => { spur.push('öffnen'); });
    const z = folge.schliessen(async () => { spur.push('schließen'); });
    ck('OE3: nach einem erledigten „öffnen“ beginnt „schließen“ sofort (die Folge hält kein altes Öffnen fest)', spur.join(',') === 'öffnen,schließen');
    await z;
  }
  {
    // Zweiter Klick auf „Raum öffnen“, während das erste noch auf den Main wartet: openRoom (C13) ruft raumFolge.oeffnen auch
    // dann und endet am Guard `openingRef.current || clientRef.current` sofort. Danach „Raum schließen“ (Knopf nach dem
    // Raumabbruch oder Tray, E58): es muss trotzdem auf das erste Öffnen warten (OE3, E57).
    const folge = erzeugeRaumFolge(); const spur: string[] = []; const a = antwort<string>();
    let oeffnet = false; let client: string | null = null; let secret: string | null = null;
    const openRoom = (): Promise<void> => folge.oeffnen(async () => {
      if (oeffnet || client !== null) { spur.push('Guard'); return; }
      oeffnet = true;
      try { spur.push('öffnen-Anfang'); secret = await a.p; client = 'C1'; spur.push('öffnen-Ende'); } finally { oeffnet = false; }
    });
    const o1 = openRoom(); const o2 = openRoom();
    await takt(); await takt();
    const z = folge.schliessen(async () => { spur.push('schließen'); client = null; secret = null; });
    await takt(); await takt();
    const vorDerAntwort = spur.join(',');
    a.erfuelle('geheim'); await o1; await o2; await z;
    ck('OE3: ein zweites „öffnen“, das am Guard sofort endet, hebt das Warten auf das erste nicht auf („schließen“ erst nach dem ersten „öffnen“, das späte Secret verworfen)',
      vorDerAntwort === 'öffnen-Anfang,Guard' && spur.join(',') === 'öffnen-Anfang,Guard,öffnen-Ende,schließen' && secret === null && client === null);
  }
}

// ── Plan C, Task C6: Tray-Gästezeile (Regel R, T129–T131) und Tooltip (Regel TT, T132) ──
console.log('— C6 · ST129–ST132 wörtlich, Tray-Gästezeile nach Regel R als Kreuzprodukt (22.10)');
{
  const { gaesteZeileNdi, TRAY_NDI_TEXT } = await import('../src/shared/zoom-text');
  const { ndiZahlen } = await import('../src/main/ndi-lage');
  type Anzeige = import('../src/shared/zoom-text').NdiZahlenAnzeige;
  type Zahlen = import('../src/main/ndi-lage').NdiZahlen;
  // Beide Richtungen im Typcheck: NdiZahlen aus der Lage (C3) passt in die Anzeige und umgekehrt (gleiche Form, E42).
  const hin = (z: Zahlen): Anzeige => z;
  const her = (z: Anzeige): Zahlen => z;
  void her;
  type Z = Anzeige & { cloud: boolean };
  const zeile = (e: number, s: number, g: number, b: number, a: number, cloud = true): string => gaesteZeileNdi({ e, s, g, b, a, cloud });
  const SOLL: Array<[string, string, string]> = [
    ['7.3 (e = 0, Cloud eingerichtet, unverändert)', zeile(0, 0, 0, 0, 0), '○ Gäste: keine NDI-Quelle'],
    ['7.3 (e = 0, Cloud nicht eingerichtet, unverändert)', zeile(0, 0, 0, 0, 0, false), '△ Gäste: Cloud nicht eingerichtet'],
    ['T129 (e = 1)', zeile(1, 0, 0, 0, 1), '△ Gäste: NDI-Quelle ausgefallen'],
    ['T129 (a = 2 von e = 3)', zeile(3, 0, 1, 0, 2), '△ Gäste: 2 von 3 NDI-Quellen ausgefallen'],
    ['T129 vor T131 (a = 1, g = 2, b = 1)', zeile(3, 0, 2, 1, 1), '△ Gäste: 1 von 3 NDI-Quellen ausgefallen'],
    ['T130 (s = 1)', zeile(1, 1, 0, 0, 0), '○ Gäste: NDI-Quelle startet …'],
    ['T130 (s = 3)', zeile(3, 3, 0, 0, 0), '○ Gäste: 3 NDI-Quellen starten …'],
    ['T131 (g = 1)', zeile(1, 0, 1, 0, 0), '● Gäste: 1 NDI-Quelle'],
    ['T131 (g = 2, unverändert bei s = 0 und b = 0)', zeile(2, 0, 2, 0, 0), '● Gäste: 2 NDI-Quellen'],
    ['T131 (g = 2, b = 1, s = 1)', zeile(3, 1, 2, 1, 0), '● Gäste: 2 NDI-Quellen, 1 ohne Bild, 1 startet …'],
    ['T131 (g = 1, s = 2)', zeile(3, 2, 1, 0, 0), '● Gäste: 1 NDI-Quelle, 2 starten …'],
    ['T131 (g = 2, b = 2)', zeile(2, 0, 2, 2, 0), '● Gäste: 2 NDI-Quellen, 2 ohne Bild'],
    ['T131 ohne Cloud (e > 0: die Quellen zählen)', zeile(2, 0, 2, 0, 0, false), '● Gäste: 2 NDI-Quellen'],
    ['T132 (Teil des Tooltips)', TRAY_NDI_TEXT.t132, 'NDI-Ausfall'],
  ];
  for (const [id, ist, soll] of SOLL) ck(`S${id} wörtlich`, ist === soll);
  // Zählweise aus der Lage (C3) bis in die Zeile: Einträge startet, ohneBild, gescheitert.
  const lagen = [quelle({ schluessel: 'g1', zustand: 'startet' }), quelle({ schluessel: 'g2', zustand: 'ohneBild' }),
    quelle({ schluessel: 'g3', zustand: 'gescheitert', grund: 'absturz', code: 1 })];
  ck('Regel R mit ndiZahlen aus der Lage: startet, ohneBild, gescheitert → „△ Gäste: 1 von 3 NDI-Quellen ausgefallen“',
    gaesteZeileNdi({ ...hin(ndiZahlen(lagen)), cloud: true }) === '△ Gäste: 1 von 3 NDI-Quellen ausgefallen');

  /** Regel R (22.5), im Test aus der Spec abgeschrieben. */
  const regelR = (z: Z): string => {
    if (z.e === 0) return z.cloud ? '○ Gäste: keine NDI-Quelle' : '△ Gäste: Cloud nicht eingerichtet';
    if (z.a > 0) return z.e === 1 ? '△ Gäste: NDI-Quelle ausgefallen' : `△ Gäste: ${z.a} von ${z.e} NDI-Quellen ausgefallen`;
    if (z.g > 0) {
      return (z.g === 1 ? '● Gäste: 1 NDI-Quelle' : `● Gäste: ${z.g} NDI-Quellen`) + (z.b > 0 ? `, ${z.b} ohne Bild` : '')
        + (z.s === 0 ? '' : z.s === 1 ? ', 1 startet …' : `, ${z.s} starten …`);
    }
    return z.s === 1 ? '○ Gäste: NDI-Quelle startet …' : `○ Gäste: ${z.s} NDI-Quellen starten …`;
  };
  // e ∈ {0, 1, 2, 3} mit jeder Aufteilung auf s, g (davon b) und a, je Cloud ja/nein.
  const FAELLE: Z[] = [];
  for (const e of [0, 1, 2, 3]) for (const a of Array.from({ length: e + 1 }, (_, i) => i))
    for (const gg of Array.from({ length: e - a + 1 }, (_, i) => i)) for (const b of Array.from({ length: gg + 1 }, (_, i) => i))
      for (const cloud of [true, false]) FAELLE.push({ e, a, g: gg, b, s: e - a - gg, cloud });
  const R = FAELLE.map((z) => ({ z, t: gaesteZeileNdi(z) }));
  const zeigeR = ({ z, t }: { z: Z; t: string }): string => `${JSON.stringify(z)} → ${t}`;
  console.log(`     22.10 Tray-Gästezeile: ${R.length} Kombinationen geprüft`);
  alle('22.10 Tray-Gästezeile: jede Aufteilung wörtlich nach Regel R', R, ({ z, t }) => t === regelR(z), zeigeR);
  alle('Prädikat „●“ in der Tray-Zeile ⇒ g > 0 und a = 0', R, ({ z, t }) => !t.includes('●') || (z.g > 0 && z.a === 0), zeigeR);
  alle('Prädikat „ausgefallen“ in der Tray-Zeile ⇔ a > 0', R, ({ z, t }) => t.includes('ausgefallen') === z.a > 0, zeigeR);
  alle('Prädikat „ohne Bild“ in der Tray-Zeile ⇔ b > 0 und a = 0', R, ({ z, t }) => t.includes('ohne Bild') === (z.b > 0 && z.a === 0), zeigeR);
  alle('Prädikat „startet“/„starten“ in der Tray-Zeile ⇒ s > 0 und a = 0', R, ({ z, t }) => !/startet|starten/.test(t) || (z.s > 0 && z.a === 0), zeigeR);
  alle('Prädikat Zahlen in der Zeile stimmen (a von e, g, b, s; Singular bei 1)', R, ({ z, t }) => {
    if (z.a > 0) return z.e === 1 ? t.endsWith('NDI-Quelle ausgefallen') : t.includes(`${z.a} von ${z.e} NDI-Quellen`);
    if (z.g > 0) return t.includes(z.g === 1 ? '1 NDI-Quelle' : `${z.g} NDI-Quellen`) && (z.b === 0 || t.includes(`${z.b} ohne Bild`));
    return z.e === 0 || t.includes(z.s === 1 ? 'NDI-Quelle startet' : `${z.s} NDI-Quellen starten`);
  }, zeigeR);
}

console.log('— C6 · Tooltip nach Regel TT als Kreuzprodukt (22.10): e > 0 × n > 0 × ndi_alarm × Z0–Z13, macOS ohne Zoom');
{
  const { trayTooltipNdi } = await import('../src/shared/zoom-text');
  type ZZ = import('../src/shared/zoom-text').ZoomZ;
  // Zoom-Teile des Tooltips je Zeile aus 7.1, wörtlich wie 7.4 (zoom-text.ts:245-246: abriss = Z10/Z11, fehler = Z13).
  const ZOOM_TEILE: Record<ZZ, string[]> = {
    Z0: [], Z1a: [], Z1b: [], Z2: [], Z3: [], Z4: [], Z5a: [], Z5b: [], Z6: [], Z7: [], Z7b: [], Z8: [], Z9: [], Z9b: [],
    Z10: ['Zoom-Verbindung unterbrochen'], Z11: ['Zoom-Verbindung unterbrochen'], Z12: [], Z13: ['Zoom-Fehler'],
  };
  ck('ZoomZ hat 18 Zeilen (Z0–Z13), jede steht in der Tooltip-Tabelle', Object.keys(ZOOM_TEILE).length === 18);
  const SOLL: Array<[string, string, string]> = [
    ['T132: nichts aktiv', trayTooltipNdi({ e: 0, n: 0, ndiAlarm: false, zoomTeile: [] }), 'JM Connect'],
    ['T132: nur NDI-Ausfall (Programm-Empfang, ohne Gast-Quelle)', trayTooltipNdi({ e: 0, n: 0, ndiAlarm: true, zoomTeile: [] }), 'JM Connect — NDI-Ausfall'],
    ['T132: Zuschaltungen aktiv und NDI-Ausfall', trayTooltipNdi({ e: 1, n: 0, ndiAlarm: true, zoomTeile: [] }), 'JM Connect — Zuschaltungen aktiv · NDI-Ausfall'],
    ['T132: Slots laufen (n = 2), Zoom-Fehler (Z13)', trayTooltipNdi({ e: 0, n: 2, ndiAlarm: false, zoomTeile: ZOOM_TEILE.Z13 }),
      'JM Connect — Zuschaltungen aktiv · Zoom-Fehler'],
    ['T132: alle Teile, Z10', trayTooltipNdi({ e: 2, n: 1, ndiAlarm: true, zoomTeile: ZOOM_TEILE.Z10 }),
      'JM Connect — Zuschaltungen aktiv · NDI-Ausfall · Zoom-Verbindung unterbrochen'],
    ['T132: macOS (ohne Zoom), Gast-Quelle', trayTooltipNdi({ e: 1, n: 0, ndiAlarm: false, zoomTeile: [] }), 'JM Connect — Zuschaltungen aktiv'],
  ];
  for (const [id, ist, soll] of SOLL) ck(`S${id} wörtlich`, ist === soll);
  /** Regel TT (22.5), aus der Spec abgeschrieben. */
  const regelTT = (e: number, n: number, alarm: boolean, zoom: string[]): string => {
    const t = [...(e > 0 || n > 0 ? ['Zuschaltungen aktiv'] : []), ...(alarm ? ['NDI-Ausfall'] : []), ...zoom];
    return t.length ? `JM Connect — ${t.join(' · ')}` : 'JM Connect';
  };
  interface TF { zz: ZZ | 'macOS'; e: number; n: number; alarm: boolean }
  const FAELLE: TF[] = [];
  for (const zz of [...(Object.keys(ZOOM_TEILE) as ZZ[]), 'macOS' as const]) for (const e of [0, 1])
    for (const n of zz === 'macOS' ? [0] : [0, 2]) for (const alarm of [false, true]) FAELLE.push({ zz, e, n, alarm });
  const teileVon = (f: TF): string[] => (f.zz === 'macOS' ? [] : ZOOM_TEILE[f.zz]);
  const T = FAELLE.map((f) => ({ f, t: trayTooltipNdi({ e: f.e, n: f.n, ndiAlarm: f.alarm, zoomTeile: teileVon(f) }) }));
  const zeigeT = ({ f, t }: { f: TF; t: string }): string => `${JSON.stringify(f)} → ${t}`;
  console.log(`     22.10 Tooltip: ${T.length} Kombinationen geprüft (alle Paare aus Z und n, auch solche, die 7.1 nicht hervorbringt)`);
  alle('22.10 Tooltip: jede Kombination wörtlich nach Regel TT', T, ({ f, t }) => t === regelTT(f.e, f.n, f.alarm, teileVon(f)), zeigeT);
  alle('Prädikat „Zuschaltungen aktiv“ ⇔ e > 0 oder n > 0', T, ({ f, t }) => t.includes('Zuschaltungen aktiv') === (f.e > 0 || f.n > 0), zeigeT);
  alle('Prädikat „NDI-Ausfall“ ⇔ ndi_alarm = 1', T, ({ f, t }) => t.includes('NDI-Ausfall') === f.alarm, zeigeT);
  alle('Prädikat die Zoom-Teile stehen unverändert am Ende (7.4)', T,
    ({ f, t }) => teileVon(f).length === 0 || t.endsWith(teileVon(f).join(' · ')), zeigeT);
}

console.log('— C9 KF10: AppStatus über baueAppStatus (E44), Startwert APP_STATUS_START, Tray-Zeilen und Programm-Abzeichen aus der Lage');
{
  const { baueAppStatus, APP_STATUS_START } = await import('../src/shared/app-status');
  const { gaesteZeile, trayTooltip } = await import('../src/shared/zoom-text');
  type AppStatus = import('../src/shared/types').AppStatus;
  type QL = import('../src/shared/types').NdiQuelleLage;
  type PL = import('../src/shared/types').NdiProgrammLage;
  type ZK = import('../src/shared/types').ZoomKurz;
  const gleich = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

  // KF10: eine Lage mit lauter Werten, die von der Vorgabe abweichen.
  const q: QL = { schluessel: 'g7::screen', art: 'bildschirm', label: 'JM Connect – Anna Maria Beispiel (Bildschirm)', zustand: 'neustart', grund: null, code: 139, k: 2, empfaenger: 3 };
  const p: PL = { zustand: 'gescheitert', grund: 'keinStart', code: 7, k: 3, quelle: 'REGIE (JM Switcher B)', hinweis: 'Switcher B', bereit: true };
  const zoom = { zustand: 'fehler' } as unknown as ZK;
  const s = baueAppStatus({
    configured: true, proxyBase: 'https://proxy.beispiel', proxyKeySource: 'session', controlPort: 9999,
    ndiGaeste: [q], ndiProgramm: p, presenterLinked: true, zoom,
  });
  ck('C9 KF10: jedes Feld kommt aus einer Lage mit lauter abweichenden Werten durch',
    gleich(s, { configured: true, proxyBase: 'https://proxy.beispiel', proxyKeySource: 'session', controlPort: 9999, ndiGaeste: [q], ndiProgramm: p, presenterLinked: true, zoom }) && s.zoom === zoom);
  ck('C9 KF10: ndiProgramm samt hinweis kommt durch (T122)',
    s.ndiProgramm.hinweis === 'Switcher B' && s.ndiProgramm.quelle === 'REGIE (JM Switcher B)' && s.ndiProgramm.zustand === 'gescheitert'
      && s.ndiProgramm.grund === 'keinStart' && s.ndiProgramm.code === 7 && s.ndiProgramm.k === 3 && s.ndiProgramm.bereit === true);
  ck('C9 KF10: ndiGaeste mit jedem Feld der Lage (KF11)', gleich(s.ndiGaeste, [q]));
  ck('C9 E44: genau die acht Felder, ohne ndiSenders, programState, programSource',
    gleich(Object.keys(s).sort(), ['configured', 'controlPort', 'ndiGaeste', 'ndiProgramm', 'presenterLinked', 'proxyBase', 'proxyKeySource', 'zoom']));
  q.zustand = 'sendet';
  p.hinweis = 'anders';
  ck('C9 KF10: die NDI-Lagen sind Kopien (eine spätere Änderung der Eingabe ändert den Status nicht)',
    s.ndiGaeste[0].zustand === 'neustart' && s.ndiProgramm.hinweis === 'Switcher B');
  ck('C9 E44: APP_STATUS_START ist nichts Gemessenes: keine Gast-Quelle, Empfang aus, kein Zoom, nicht eingerichtet, Steuerport 8737',
    gleich(APP_STATUS_START, {
      configured: false, proxyBase: null, proxyKeySource: 'none', controlPort: 8737, ndiGaeste: [],
      ndiProgramm: { zustand: 'aus', grund: null, code: null, k: 0, quelle: null, hinweis: '', bereit: false }, presenterLinked: false, zoom: null,
    }));

  // Tray-Gästezeile und Tooltip über AppStatus (Regel R, TT): gaesteZeile/trayTooltip rechnen e/g/b/s/a und ndi_alarm aus der Lage.
  const lage = (zustand: QL['zustand'], i: number): QL => ({
    schluessel: `g${i}`, art: 'kamera', label: `JM Connect – Gast ${i}`, zustand,
    grund: zustand === 'gescheitert' ? 'absturz' : null, code: null, k: zustand === 'neustart' ? 1 : 0, empfaenger: null,
  });
  const status = (gaeste: QL[], programm: Partial<PL> = {}, z: ZK | null = null, configured = true): AppStatus =>
    baueAppStatus({ ...APP_STATUS_START, configured, ndiGaeste: gaeste, ndiProgramm: { ...APP_STATUS_START.ndiProgramm, ...programm }, zoom: z });
  ck('C9 Regel R über AppStatus: ein Ausfall unter zwei Quellen → T129', gaesteZeile(status([lage('sendet', 1), lage('gescheitert', 2)])) === '△ Gäste: 1 von 2 NDI-Quellen ausgefallen');
  ck('C9 Regel R über AppStatus: eine Quelle startet → T130', gaesteZeile(status([lage('startet', 1)])) === '○ Gäste: NDI-Quelle startet …');
  ck('C9 Regel R über AppStatus: zwei bestehen, eine ohne Bild → T131 mit Zusatz', gaesteZeile(status([lage('sendet', 1), lage('ohneBild', 2)])) === '● Gäste: 2 NDI-Quellen, 1 ohne Bild');
  ck('C9 Regel R über AppStatus: keine Quelle, Cloud nicht eingerichtet (wie bisher)', gaesteZeile(status([], {}, null, false)) === '△ Gäste: Cloud nicht eingerichtet');
  ck('C9 Regel TT über AppStatus: Ausfall einer Gast-Quelle → „NDI-Ausfall“ hinter „Zuschaltungen aktiv“',
    trayTooltip(status([lage('neustart', 1)])) === 'JM Connect — Zuschaltungen aktiv · NDI-Ausfall');
  ck('C9 Regel TT über AppStatus: Programm gescheitert ohne Gäste → „JM Connect — NDI-Ausfall“ (ndi_alarm aus dem Programm-Teil)',
    trayTooltip(status([], { zustand: 'gescheitert', grund: 'absturz' })) === 'JM Connect — NDI-Ausfall');
  ck('C9 Regel TT über AppStatus: Programm sucht → kein „NDI-Ausfall“ (22.6)', trayTooltip(status([], { zustand: 'sucht' })) === 'JM Connect');
  ck('C9 Regel TT über AppStatus: die Zoom-Teile bleiben hinter „NDI-Ausfall“',
    trayTooltip(status([lage('gescheitert', 1)], {}, { zustand: 'fehler', slotsLaufen: 0 } as unknown as ZK)) === 'JM Connect — Zuschaltungen aktiv · NDI-Ausfall · Zoom-Fehler');
  ck('C9 Regel TT über AppStatus: n = laufende Slots (9.5) → „Zuschaltungen aktiv“ ohne Gäste',
    trayTooltip(status([], {}, { zustand: 'im_meeting', slotsLaufen: 2 } as unknown as ZK)) === 'JM Connect — Zuschaltungen aktiv');

  // Quelltext (KF10): Main und Tray bauen den Status nur über app-status.ts; das Fenster liest nur die neuen Felder.
  const { readFileSync } = await import('node:fs');
  const lies = (pf: string): string => readFileSync(new URL(pf, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const ipcMain = lies('../src/main/ipc.ts');
  const tray = lies('../src/main/tray.ts');
  const app = lies('../src/renderer/src/App.tsx');
  ck('C9 KF10: currentStatus baut den Status nur über baueAppStatus', /export function currentStatus\(\): AppStatus \{\n\s*return baueAppStatus\(\{/.test(ipcMain));
  ck('C9 KF10: der Tray startet mit APP_STATUS_START, ohne eigenen Startwert', tray.includes('let status: AppStatus = APP_STATUS_START;') && !tray.includes('configured: false'));
  ck('C9 E42, E58: „Raum schließen“ im Tray hängt an e (jeder Eintrag), nicht an g', tray.includes("{ label: 'Raum schließen', enabled: status.ndiGaeste.length > 0,"));
  ck('C9 E44: kein Leser der alten Felder mehr in Main, Tray und Fenster', ![ipcMain, tray, app].some((t) => /ndiSenders|programState|programSource/.test(t)));
  const badge = (() => { const i = app.indexOf('function ProgramBadge('); return i < 0 ? '' : app.slice(i, app.indexOf('\n}\n', i)); })();
  ck('C9 Regel P: das Programm-Abzeichen kommt aus programmAbzeichen, ohne leeres <span /> für unbekannte Zustände',
    badge.includes('programmAbzeichen({ lage: status.ndiProgramm, plattform: plattform() })') && !badge.includes('<span />'));
  ck('C9 Regel P: der volle Text des Abzeichens steht als title', badge.includes('title={titel(a)}'));
}
console.log('— C11 KF12: Kanäle jmc:logordner, jmc:ndi-neustart, jmc:programm-neustart, jmc:ndi-seite, jmc:lizenz');
{
  const k = await import('../src/shared/ipc');
  const gleich = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
  ck('C11 KF12: die fünf Kanalnamen',
    gleich([k.IPC.logordner, k.IPC.ndiNeustart, k.IPC.programmNeustart, k.IPC.ndiSeite, k.IPC.lizenz],
      ['jmc:logordner', 'jmc:ndi-neustart', 'jmc:programm-neustart', 'jmc:ndi-seite', 'jmc:lizenz']));
  ck('C11 KF12: feste Adresse und feste Datei', k.NDI_SEITE === 'https://ndi.video/' && k.LIZENZ_DATEI === 'LIZENZ.txt');
  ck('C11 KF12: { schluessel } feldweise: ein gültiger Schlüssel kommt durch', k.neustartSchluessel({ schluessel: 'g7::screen' }) === 'g7::screen');
  ck('C11 KF12: fehlender, leerer oder falsch getypter Schlüssel und fremde Felder ändern nichts (null)',
    [undefined, null, 'g7', 7, [], {}, { schluessel: '' }, { schluessel: 7 }, { schluessel: 'g7', pfad: 'C:/x' }, { key: 'g7' }]
      .every((p) => k.neustartSchluessel(p) === null));

  // Scheitern je Kanal (22.11 KF12): shell als Attrappe, Electron wird nicht geladen.
  const pfadOk = await k.oeffnePfadMit(async () => '', 'C:/Logs/JM Connect');
  const pfadText = await k.oeffnePfadMit(async () => 'Zugriff verweigert', 'C:/Logs/JM Connect');
  const pfadWirft = await k.oeffnePfadMit(async () => { throw new Error('kaputt'); }, 'C:/Programme/JM Connect/resources/LIZENZ.txt');
  ck('C11 KF12 jmc:logordner: gelungen → ok', gleich(pfadOk, { ok: true }));
  ck('C11 KF12 jmc:logordner: openPath meldet einen Fehlertext → der Pfad für T143', gleich(pfadText, { ok: false, pfad: 'C:/Logs/JM Connect' }));
  ck('C11 KF12 jmc:lizenz: auch eine Ausnahme von openPath → der Pfad für T143',
    gleich(pfadWirft, { ok: false, pfad: 'C:/Programme/JM Connect/resources/LIZENZ.txt' }));
  const adresseOk = await k.oeffneAdresseMit(async () => {}, k.NDI_SEITE);
  const adresseAbgelehnt = await k.oeffneAdresseMit(async () => { throw new Error('abgelehnt'); }, k.NDI_SEITE);
  ck('C11 KF12 jmc:ndi-seite: gelungen → ok', gleich(adresseOk, { ok: true }));
  ck('C11 KF12 jmc:ndi-seite: openExternal lehnt ab → die Adresse für T143', gleich(adresseAbgelehnt, { ok: false, pfad: 'https://ndi.video/' }));

  // Quelltext: Preload (ganze Nutzlast), Anmeldung in registerIpc (beide Plattformen), feste Ziele.
  const { readFileSync } = await import('node:fs');
  const lies = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const preload = lies('../src/preload/index.ts');
  const main = lies('../src/main/ipc.ts');
  const zoom = lies('../src/main/zoom.ts');
  const index = lies('../src/main/index.ts');
  const reg = (() => { const i = main.indexOf('export function registerIpc('); return i < 0 ? '' : main.slice(i, main.indexOf('\n}\n', i)); })();
  ck('C11 KF12: die Preload reicht jede Nutzlast als Ganzes weiter, ohne Nutzlast {}',
    ['  logordner: () => ipcRenderer.invoke(IPC.logordner, {}),', '  ndiNeustart: (p) => ipcRenderer.invoke(IPC.ndiNeustart, p),',
      '  programmNeustart: () => ipcRenderer.invoke(IPC.programmNeustart, {}),', '  ndiSeite: () => ipcRenderer.invoke(IPC.ndiSeite, {}),',
      '  lizenz: () => ipcRenderer.invoke(IPC.lizenz, {}),'].every((z) => preload.includes(z)));
  ck('C11 KF12: alle fünf Kanäle in registerIpc, ohne Plattform-Weiche, nicht in zoom.ts (startZoom läuft nur unter Windows)',
    ['logordner', 'ndiNeustart', 'programmNeustart', 'ndiSeite', 'lizenz'].every((n) => reg.includes(`ipcMain.handle(IPC.${n}, `))
      && !reg.includes('process.platform') && !/IPC\.(logordner|ndiNeustart|programmNeustart|ndiSeite|lizenz)\b/.test(zoom));
  ck('C11 KF12 jmc:ndi-neustart: Nutzlast feldweise über neustartSchluessel, dann gastNeustart der Hülle',
    /ipcMain\.handle\(IPC\.ndiNeustart, async \(_e, p: unknown\): Promise<void> => \{\n\s*const s = neustartSchluessel\(p\);\n\s*if \(s !== null\) gastNeustart\(s\);\n\s*\}\);/.test(reg));
  ck('C11 22.4: jmc:programm-neustart ruft programmNeustart der Hülle, ohne Nutzlast zu lesen',
    reg.includes('ipcMain.handle(IPC.programmNeustart, async (): Promise<void> => programmNeustart());'));
  ck('C11 KF12 jmc:ndi-seite: öffnet nur NDI_SEITE, die Nutzlast wird nicht gelesen',
    reg.includes("ipcMain.handle(IPC.ndiSeite, async (): Promise<OeffnenErgebnis> => meldeOeffnen('ndi.video', await oeffneAdresseMit((a) => shell.openExternal(a), NDI_SEITE)));"));
  ck('C11 KF12 jmc:lizenz: öffnet nur LIZENZ.txt im Paket (resourcePath), die Nutzlast wird nicht gelesen',
    reg.includes("ipcMain.handle(IPC.lizenz, async (): Promise<OeffnenErgebnis> => meldeOeffnen('Lizenzbedingungen', await oeffnePfadMit((pf) => shell.openPath(pf), lizenzPfad())));")
      && /function lizenzPfad\(\): string \{\n\s*return resourcePath\(LIZENZ_DATEI, join\(__dirname, '\.\.', '\.\.', 'resources'\)\);\n\}/.test(main));
  ck('C11 KF12 jmc:logordner: öffnet den Logordner von Connect (logDir aus index.ts)',
    reg.includes("ipcMain.handle(IPC.logordner, async (): Promise<OeffnenErgebnis> => meldeOeffnen('Logordner', await oeffnePfadMit((pf) => shell.openPath(pf), logDir)));")
      && index.includes('      logDir: runtime.logDir,'));
  ck('C11 E35: ein Scheitern steht zusätzlich im Log, ohne Namen', /function meldeOeffnen\(was: string, r: OeffnenErgebnis\): OeffnenErgebnis \{\n\s*if \(!r\.ok\) getLog\(\)\.warn\(`\[connect\] \$\{was\} ließ sich nicht öffnen: \$\{r\.pfad\}`\);/.test(main));
  ck('C11 C-EP18: der alte Kanal zoomLogordner der Zoom-Karte bleibt unter Windows', zoom.includes('ipcMain.handle(IPC.zoomLogordner,'));
}
console.log('— C12: Hauptfenster (Gastzeile, Kopfzeile, Link T133, Fußzeile, Untertitel T145, „Über JM Connect“; PK52, PK55, PK56)');
{
  const { readFileSync, existsSync } = await import('node:fs');
  const lies = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const app = lies('../src/renderer/src/App.tsx');
  const slots = lies('../src/renderer/src/zoom/SlotBereich.tsx');
  const index = lies('../src/main/index.ts');
  const mainIpc = lies('../src/main/ipc.ts');
  const { NDI_TEXT } = await import('../src/shared/ndi-text');
  const { LIZENZ_DATEI } = await import('../src/shared/ipc');
  const funktion = (s: string, kopf: string): string => { const i = s.indexOf(kopf); return i < 0 ? '' : s.slice(i, s.indexOf('\n}\n', i)); };

  // PK52, LP3: T145 ist das erste „NDI“ des Hauptfensters; davor steht im JSX von App nur der Titel.
  const appFn = funktion(app, 'export function App(');
  const vorT145 = (() => { const r = appFn.indexOf('\n  return ('); const t = appFn.indexOf('{NDI_TEXT.t145}'); return r < 0 || t < r ? null : appFn.slice(r, t); })();
  ck('C12 PK52: der Untertitel der Kopfzeile ist T145 aus @shared/ndi-text', appFn.includes('<p className="text-sm text-neutral-400">{NDI_TEXT.t145}</p>'));
  ck('C12 PK52: vor T145 steht im JSX von App nur der Titel „JM Connect“ (kein „NDI“, kein Ausdruck)',
    vorT145 !== null && !vorT145.includes('NDI') && !vorT145.includes('{') && vorT145.includes('<h1 className="text-xl font-bold">JM Connect</h1>'));
  ck('C12 PK52, LP3: T145 trägt das ® am ersten „NDI“', NDI_TEXT.t145.indexOf('NDI®') === NDI_TEXT.t145.indexOf('NDI') && NDI_TEXT.t145.includes('NDI®'));
  ck('C12 PK52, E55: unter macOS trägt das Fenster „Über JM Connect“ T134 (setAboutPanelOptions, credits)',
    index.includes("if (process.platform === 'darwin') app.setAboutPanelOptions({ credits: NDI_TEXT.t134 });"));
  const lizenz = new URL(`../resources/${LIZENZ_DATEI}`, import.meta.url);
  ck('C12 PK52, LP5: apps/connect/resources/LIZENZ.txt ist vorhanden und nicht leer', existsSync(lizenz) && readFileSync(lizenz, 'utf8').trim().length > 0);
  ck('C12 PK52: jmc:lizenz öffnet genau diese Datei (LIZENZ_DATEI unter resources)',
    mainIpc.includes("return resourcePath(LIZENZ_DATEI, join(__dirname, '..', '..', 'resources'));"));

  // PK56: eine Quelle für die Texte (22.9).
  const LITERALE = ['Programm sucht', 'Programm: keine Quelle', 'Programm ●', 'NDI ●', 'NDI ausgefallen', 'Teilt seinen Bildschirm', 'Remote-Zuschaltungen'];
  ck('C12 PK56: App.tsx enthält keines der Literale „Programm sucht“, „Programm: keine Quelle“, „Programm ●“, „NDI ●“, „NDI ausgefallen“, „Teilt seinen Bildschirm“, „Remote-Zuschaltungen“',
    LITERALE.every((l) => !app.includes(l)));
  ck('C12 PK56: App.tsx importiert die NDI-Texte aus @shared/ndi-text', /^import \{[^}]*\bNDI_TEXT\b[^}]*\} from '@shared\/ndi-text';$/m.test(app));

  // Regel G und P an ihren Orten (22.5 Orte 1, 2, 4, 5).
  ck('C12 Regel G: die Gastzeile nimmt die Abzeichen beider Quellen aus gastAbzeichen', app.includes('abzeichen: gastAbzeichen({') && app.includes("ndiPoolKey(g.id, 'screen')"));
  ck('C12 Regel G: die Grundzeile startet genau diese Quelle neu (jmc:ndi-neustart mit ihrem Schlüssel)', app.includes('window.jmconnect.ndiNeustart({ schluessel: n.schluessel })'));
  ck('C12 T113: der Tooltip „🖥 Bildschirm“ kommt aus bildschirmTooltip', app.includes('title={bildschirmTooltip(g.name)}'));
  const kopf = funktion(app, 'function Kopfzeile(');
  ck('C12 Regel P: die Kopfzeile nimmt Abzeichen und Grundzeile aus programmAbzeichen, dazu Link T133 und „Programm neu starten“',
    kopf.includes('programmAbzeichen({ lage: status.ndiProgramm, plattform: plattform() })') && kopf.includes('<NdiLink stelle="linkGaeste" />')
      && kopf.includes('window.jmconnect.programmNeustart()'));
  ck('C12 E53: die Kopfzeile steht, sobald der Empfang nicht aus ist, auch ohne Raumverbindung',
    app.includes('{status && kopfzeileSichtbar({ programm: status.ndiProgramm.zustand, raumverbunden: connected }) && ('));
  ck('C12 22.5 Ort 4: Fußzeile mit T134, „Logordner öffnen“ und „Lizenzbedingungen“ (T142), auf beiden Plattformen',
    app.includes('<span>{NDI_TEXT.t134}</span>') && app.includes('stelle="logordnerFusszeile"')
      && app.includes('stelle="lizenz" text={NDI_TEXT.t142Lizenz} oeffnen={() => window.jmconnect.lizenz()}') && app.includes('      <Fusszeile />'));
  ck('C12 22.5 Ort 5, LP1: Link T133 im Kopf „Zoom-Slots“', slots.includes('<NdiLink stelle="linkSlots" />'));
  const knopf = funktion(slots, 'export function OeffnenKnopf(');
  ck('C12 E35, 22.10: T143 kommt aus oeffnenMeldung neben dem Knopf, der bedienbar bleibt',
    knopf.includes('const meldung = oeffnenMeldung(stelle, letztes, pfad);') && !knopf.includes('disabled'));

  // PK55 (Renderer): die T140-Frist rechnet monoton; Date.now() steht in App.tsx höchstens am Aufruf von raumAbbruch (C13).
  ck('C12 PK55, C-EP16: die Frist für T140 nimmt performance.now()', /function useOhneEintragSeit\([\s\S]*?performance\.now\(\)[\s\S]*?\n\}\n/.test(app));
  ck('C12 PK55: Date.now() in App.tsx nur am Aufruf von raumAbbruch',
    app.split('Date.now()').length === app.split('raumAbbruch({ verbunden: false, jetzt: Date.now(),').length);

  // Regel G, C-EP16 (Nachbesserung C-robust:4): T140 erscheint nach 3 s nur, weil ein Zeitgeber das Fenster neu zeichnet;
  // ohne ihn stünde T140 erst beim nächsten fremden Status- oder Raum-Push. Die Frist kommt aus T140_NACH_MS (eine Quelle).
  {
    const uhr = funktion(app, 'function useOhneEintragSeit(');
    ck('C12 Regel G, C-EP16: nach T140_NACH_MS ohne Eintrag zeichnet ein Zeitgeber das Fenster neu (T140 ohne fremden Push)',
      uhr.includes('.map((t) => T140_NACH_MS - (performance.now() - t)).filter((r) => r > 0);')
        && uhr.includes('const t = setTimeout(() => setTakt((n) => n + 1), Math.min(...rest) + 1);')
        && uhr.includes('return () => clearTimeout(t);') && /^import \{[^}]*\bT140_NACH_MS\b[^}]*\} from '@shared\/ndi-text';$/m.test(app));
  }
}
console.log('— C13: Raum-Bereich nach Regel V, Raumabbruch, T146, Raum-Folge (OE3), Tray-Abo (Quelltext; PK55, PK56, PK58, PK60, OE4 b)');
{
  const { readFileSync } = await import('node:fs');
  const lies = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const app = lies('../src/renderer/src/App.tsx');
  const raum = lies('../src/main/room.ts');
  /** Text ab `start` bis vor das nächste `ende` (leer, wenn `start` fehlt). */
  const abschnitt = (s: string, start: string, ende: string): string => {
    const i = s.indexOf(start);
    if (i < 0) return '';
    const j = s.indexOf(ende, i + start.length);
    return j < 0 ? s.slice(i) : s.slice(i, j);
  };
  const zaehle = (s: string, t: string): number => s.split(t).length - 1;
  const appFn = abschnitt(app, 'export function App(', '\n}\n');
  const openFn = abschnitt(appFn, '  const openRoom = useCallback(', '\n  );\n');
  const closeFn = abschnitt(appFn, '  const closeRoom = useCallback(', '\n  );\n');
  const onOpen = abschnitt(openFn, 'onOpen: () => {', '\n            },');
  const onClose = abschnitt(openFn, 'onClose: () => {', '\n            },');
  const fehlerZweig = abschnitt(openFn, '} catch (e) {', '} finally {');
  const effekt = abschnitt(appFn, '  useEffect(() => {\n    void window.jmconnect.getStatus()', '\n  }, [');
  const wachhund = abschnitt(appFn, '  const wachhundWeg = useCallback(', '\n  }, [');

  // PK58: Regel V im Fenster.
  ck('C13 PK58: der Raum-Bereich entsteht nur über raumAnsicht, kein Raum-Zweig {!connected ? ( mehr',
    appFn.includes('const ansicht = raumAnsicht({ client: clientBesteht, verbunden: connected, raumBekannt: room !== null, raumabbruch });')
      && !app.includes('{!connected ? ('));
  ck('C13 PK58: „Client besteht“ ist ein useState und wird nicht aus clientRef gelesen',
    appFn.includes('const [clientBesteht, setClientBesteht] = useState(false);') && !/client: !*clientRef/.test(app));
  ck('C13 PK58: „Client besteht“ gesetzt in openRoom, zurückgesetzt in closeRoom, im Fehlerzweig und beim Raumabbruch (und nirgends sonst)',
    openFn.includes('setClientBesteht(true);') && closeFn.includes('setClientBesteht(false);') && fehlerZweig.includes('setClientBesteht(false);')
      && onClose.includes('setClientBesteht(false);') && zaehle(app, 'setClientBesteht(') === 4);
  ck('C13 PK58: Gast-Aktionen, die Talkback-Knöpfe und der Folien-Knopf bekommen die Sperre aus raumAnsicht',
    app.includes('<GuestActions guest={g} send={send} gesperrt={!ansicht.wsKnoepfeBedienbar} />') && zaehle(app, 'disabled={!ansicht.wsKnoepfeBedienbar}') === 3
      && zaehle(abschnitt(app, 'function GuestActions(', '\n}\n'), 'disabled={gesperrt}') === 7 && abschnitt(app, 'function PttButton(', '\n}\n').includes('disabled={disabled}'));
  ck('C13 PK58: „Link erzeugen“ nur mit Raumverbindung (raumAnsicht)', /onClick=\{inviteGuest\}\n\s*disabled=\{!ansicht\.linkErzeugenBedienbar\}/.test(app));
  ck('C13 PK58: talkbackDown, talkbackUp und der Folien-Handler prüfen die Raumverbindung vor send und Audit-Zeile, über verbundenRef, nicht roomRef',
    ['const talkbackDown = useCallback(', 'const talkbackUp = useCallback(', 'const folien = useCallback('].every((k) => {
      const t = abschnitt(appFn, k, '[send]');
      const p = t.indexOf('if (!verbundenRef.current) return;');
      return p >= 0 && p < t.indexOf('send(') && p < t.indexOf('window.jmconnect.audit(') && !t.includes('roomRef');
    }) && app.includes('onClick={() => folien(g)}'));
  ck('C13 PK58: der Ref der Raumverbindung folgt onOpen und onClose', onOpen.includes('verbundenRef.current = true;') && onClose.includes('verbundenRef.current = false;'));
  ck('C13 PK58, E57: onClose prüft den Raumabbruch nur für den Client, auf den clientRef noch zeigt',
    onClose.includes('if (clientRef.current !== client) return;') && onClose.indexOf('if (clientRef.current !== client) return;') < onClose.indexOf('raumAbbruch('));
  ck('C13 PK58, E57: der Raumabbruch beendet den Client, setzt clientRef auf null, löscht Wachhund und T146, setzt „Raumabbruch“, schreibt eine Audit-Zeile',
    ['client.close();', 'clientRef.current = null;', 'setRaumabbruch(true);', 'wachhundWeg();', "window.jmconnect.audit('raumabbruch',"].every((t) => onClose.includes(t)));
  ck('C13 OE4 b, E57: clientRef wird an genau vier Stellen zurückgesetzt (closeRoom, Fehlerzweig von openRoom, Raumabbruch, Aufräumen des Effekts)',
    zaehle(app, 'clientRef.current = null;') === 4 && closeFn.includes('clientRef.current = null;') && fehlerZweig.includes('clientRef.current = null;')
      && onClose.includes('clientRef.current = null;') && effekt.includes('clientRef.current = null;'));
  ck('C13 PK58, T146: die Meldung des Wachhunds ist T146 aus @shared/ndi-text, gesetzt nur im Wachhund von openRoom',
    zaehle(app, 'NDI_TEXT.t146(') === 1 && /watchdogRef\.current = setTimeout\(\(\) => \{\n\s*const t = NDI_TEXT\.t146\(session\.room\);/.test(openFn));
  ck('C13 PK58: onOpen löscht Wachhund und Meldung wie bisher', onOpen.includes('clearWatchdog();') && onOpen.includes('setError(null);'));
  ck('C13 PK58, T146: closeRoom löscht Wachhund und Meldung wie der Raumabbruch (wachhundWeg)',
    closeFn.includes('wachhundWeg();') && wachhund.includes('clearWatchdog();') && wachhund.includes('if (t !== null) setError((f) => (f === t ? null : f));'));
  ck('C13 PK58: „Raumabbruch“ endet erst, wenn openRoom den neuen Client anlegt, und in closeRoom',
    zaehle(app, 'setRaumabbruch(false);') === 2 && openFn.indexOf('setRaumabbruch(false);') > openFn.indexOf('clientRef.current = client;') && closeFn.includes('setRaumabbruch(false);'));
  ck('C13 PK58, E57: operatorBis kommt aus der Sitzung von openRoom', onClose.includes('raumAbbruch({ verbunden: false, jetzt: Date.now(), operatorBis: session.operatorBis })'));
  ck('C13 PK58, E57: room.ts setzt operatorBis aus derselben Variable wie exp',
    /const operatorBis = nowMs \+ OPERATOR_TTL_MS;\n[\s\S]*?exp: operatorBis,\n[\s\S]*?proxyBase: base,\n\s*operatorBis,\n\s*\};/.test(raum));
  ck('C13 OE3, C-EP3: openRoom und closeRoom laufen über die Raum-Folge', openFn.includes('raumFolge.oeffnen(async () => {') && closeFn.includes('raumFolge.schliessen(async () => {'));

  // PK60, E58: Tray „Raum schließen“.
  ck('C13 PK60, E58: das Tray-Abo steht im Effekt der Steuerbefehle, ruft bei closeRoom die Funktion des Knopfs und sonst nichts',
    effekt.includes('window.jmconnect.onControlCommand(') && effekt.includes('const offTray = window.jmconnect.onTrayCommand((cmd) => {')
      && effekt.includes("if (cmd.kind === 'closeRoom') void closeRoom();") && zaehle(effekt, 'cmd.kind') === 1);
  ck('C13 PK60: das Aufräumen des Effekts beendet das Tray-Abo', abschnitt(effekt, 'return () => {', '};').includes('offTray();'));
  ck('C13 E58: Knopf und Tray rufen dieselbe Funktion closeRoom (keine zweite Schließ-Funktion)', zaehle(app, 'window.jmconnect.closeRoom()') === 1);

  // PK55, PK56.
  ck('C13 PK55: Date.now() steht in App.tsx genau einmal, am Aufruf von raumAbbruch', zaehle(app, 'Date.now()') === 1 && onClose.includes('jetzt: Date.now()'));
  ck('C13 PK56: App.tsx enthält „Keine Verbindung zum Raum“ und „Verbindung zum Raum beendet“ nicht als Literal (T141, T144, T146)',
    !app.includes('Keine Verbindung zum Raum') && !app.includes('Verbindung zum Raum beendet'));
  ck('C13 Regel V: T141, T144 und sein Zusatz kommen aus NDI_TEXT, gesteuert von raumAnsicht',
    app.includes('{ansicht.t141 && (') && app.includes('{NDI_TEXT.t141}') && app.includes('{ansicht.t144 && (') && app.includes('{NDI_TEXT.t144}')
      && app.includes("{ansicht.t144Zusatz ? NDI_TEXT.t144Zusatz : ''}"));
  ck('C13 Regel V, E53: die Gästeliste steht, sobald raumAnsicht sie zeigt (auch ohne Raumverbindung)', app.includes('{ansicht.gaesteliste && (') && !app.includes('{connected && ('));
  // GG2, OFC2 (Vorgabe wie OE2 für T146; Nachbesserung C-gesamt:3): C13 schreibt die Zeile des Knopfs neu, also mit dem
  // schließenden deutschen Anführungszeichen statt des geraden ASCII-Zeichens.
  ck('C13 GG2, OFC2: der Knopf „Raum öffnen“ mit Show setzt den Raum in deutsche Anführungszeichen, ohne ASCII-Anführungszeichen',
    app.includes('{show ? `Raum „${show.room}“ öffnen` : \'Raum öffnen\'}') && !app.includes('Raum „${show.room}"'));
}
// ── C16 · T135 gegen electron-builder.yml (PK52, E49, C-EP11) ──
{
  const { readFileSync } = await import('node:fs');
  const { NDI_TEXT: T } = await import('../src/shared/ndi-text');
  const SOLL_T135 = 'JM Connect sendet die Gäste als NDI-Quellen ins lokale Netzwerk und empfängt dort das Programm (NDI).';
  ck('S T135 wörtlich (NSLocalNetworkUsageDescription)', T.t135 === SOLL_T135);
  ck('S T135 ohne ASCII-Anführungszeichen und ohne ® (LP3: die Nachfrage von macOS trägt kein Zeichen)', !/["'®]/.test(T.t135));
  const yml = readFileSync(new URL('../electron-builder.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n').split('\n');
  const von = yml.indexOf('mac:');
  const bis = yml.findIndex((z, i) => i > von && /^\S/.test(z));
  const mac = von < 0 ? [] : yml.slice(von + 1, bis < 0 ? yml.length : bis);
  const ext = mac.indexOf('  extendInfo:');
  const kinder: string[] = [];
  for (let i = ext + 1; ext >= 0 && i < mac.length && /^ {4}/.test(mac[i]); i++) kinder.push(mac[i]);
  ck('C16 PK52 T135 wörtlich in electron-builder.yml als mac.extendInfo.NSLocalNetworkUsageDescription (genau einmal in der Datei)',
    kinder.includes(`    NSLocalNetworkUsageDescription: ${T.t135}`) && yml.filter((z) => z.includes('NSLocalNetworkUsageDescription')).length === 1);
  const bonjour = kinder.indexOf('    NSBonjourServices:');
  ck('C16 E49 mac.extendInfo.NSBonjourServices nennt _ndi._tcp', bonjour >= 0 && kinder[bonjour + 1] === '      - _ndi._tcp');
}

console.log('— Nachtrag C (M-C13-3, M-C13-1, R21): spätes Schließen eines ersetzten Clients, Ablehnung von closeRoom (Quelltext)');
{
  const { readFileSync } = await import('node:fs');
  const lies = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const app = lies('../src/renderer/src/App.tsx');
  /** Text ab `start` bis vor das nächste `ende` (leer, wenn `start` fehlt). */
  const abschnitt = (s: string, start: string, ende: string): string => {
    const i = s.indexOf(start);
    if (i < 0) return '';
    const j = s.indexOf(ende, i + start.length);
    return j < 0 ? s.slice(i) : s.slice(i, j);
  };
  const zaehle = (s: string, t: string): number => s.split(t).length - 1;
  const appFn = abschnitt(app, 'export function App(', '\n}\n');
  const openFn = abschnitt(appFn, '  const openRoom = useCallback(', '\n  );\n');
  const closeFn = abschnitt(appFn, '  const closeRoom = useCallback(', '\n  );\n');
  const onClose = abschnitt(openFn, 'onClose: () => {', '\n            },');
  const fehlerZweig = abschnitt(openFn, '} catch (e) {', '} finally {');
  const pruefung = onClose.indexOf('if (clientRef.current !== client) return;');
  ck('Nachtrag C M-C13-3: onClose prüft zuerst, ob clientRef noch auf diesen Client zeigt, und erst danach verbundenRef und setConnected',
    pruefung >= 0 && pruefung < onClose.indexOf('verbundenRef.current = false;') && pruefung < onClose.indexOf('setConnected(false);')
      && /^onClose: \(\) => \{\n(?:\s*\/\/[^\n]*\n)*\s*if \(clientRef\.current !== client\) return;\n/.test(onClose));
  const FEHLERFELD = 'setError(e instanceof Error ? e.message : String(e));';
  ck('Nachtrag C M-C13-1: closeRoom fängt die Ablehnung des IPC-Aufrufs und zeigt sie im Fehlerfeld wie openRoom (kein neuer Text)',
    /try \{\n\s*await window\.jmconnect\.closeRoom\(\);\n\s*\} catch \(e\) \{\n\s*setError\(e instanceof Error \? e\.message : String\(e\)\);\n\s*\}/.test(closeFn)
      && fehlerZweig.includes(FEHLERFELD) && zaehle(app, 'window.jmconnect.closeRoom()') === 1);
  ck('Nachtrag C M-C13-1: Knopf und Tray rufen weiter dieselbe Funktion closeRoom, die nicht mehr ablehnt',
    zaehle(app, 'onClick={closeRoom}') === 2 && app.includes("if (cmd.kind === 'closeRoom') void closeRoom();"));
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
