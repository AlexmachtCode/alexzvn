// Zoom-Statustexte und Klartexte OHNE Electron (tsx): npm run selftest -w @jm/connect
// Spec 7.6: tabellengetrieben, jede Zeile aus 7.2, 7.3, 7.4 und 7.5 wörtlich, für jeden Zustand mit
// n ∈ {0, 2} (Singular mit n = 1), g ∈ {0, 1} und o ∈ {0, 1}, soweit 7.1 die Kombination zulässt.
// Die Tabellen sind Record<ZoomZ | ZoomZustand | ZoomErlaubnis | ZoomMangel, …>: eine neue
// Zustandsart fängt der Typcheck (tsc, CI-Job typecheck); die Zählprüfungen unten schützen nur
// die Testtabellen selbst.
import type { AppStatus, ProxyKeySource, ZoomAbbild, ZoomErlaubnis, ZoomKurz, ZoomMangel, ZoomZustand } from '../src/shared/types';
import {
  gaesteZeile, kartenZeile, MANGEL_GRUND, sdkKnopf, sdkZeile, stateKvAus, TEXT_A4, TEXT_A6, trayTooltip,
  trayVerlassenAktiv, zoomKnoepfe, zoomZ, zoomZeile, zugangZeile, type ZoomStatusWert, type ZoomZ,
} from '../src/shared/zoom-text';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

// ── Testhilfen ──
function kurz(z: Partial<ZoomKurz> = {}): ZoomKurz {
  return {
    zustand: 'bereit', warten: null, erlaubnis: null, quellen: 0, ohneBild: 0, sollOffen: 0,
    versuch: null, maengel: [], kopieLaeuft: false, ...z,
  };
}
function abbild(a: Omit<Partial<ZoomAbbild>, 'kurz'> & { kurz?: Partial<ZoomKurz> } = {}): ZoomAbbild {
  const { kurz: kz, ...rest } = a;
  return {
    kurz: kurz(kz),
    einrichtung: {
      sdk: { stand: 'ok', fassung: '7.1.5.43953', kopie: null, text: null },
      zugang: { herkunft: 'stored', clientIdEnde: '1234', text: null },
    },
    anzeigename: 'Regie Süd',
    versatz: { gewuenschtMs: 0, bestaetigtMs: null },
    teilnehmer: [], soll: [], abriss: null, meldung: null, hinweise: [],
    erneutMoeglich: false, pruefungLaeuft: false,
    ...rest,
  };
}
function status(g: number, configured: boolean, zoom: ZoomKurz | null): AppStatus {
  return {
    configured, proxyBase: null, proxyKeySource: 'none', controlPort: 8737, ndiSenders: g,
    programState: 'off', programSource: null, presenterLinked: false, zoom,
  };
}

const JETZT = 1_000_000;
const MIB = 1024 * 1024;

// ── Spec 7.1/7.2: je Zeile die Lage, die zulässigen (n, k) und beide Spalten wörtlich ──
interface Fall72 {
  lage: Partial<ZoomKurz>;
  abbild?: Omit<Partial<ZoomAbbild>, 'kurz'>;
  /** Geprüfte Paare (n, k) — nur, was 7.1 zulässt. */
  nk: Array<[number, number]>;
  tray: (n: number, k: number) => string | null;
  karte: (n: number, k: number) => string | null;
}
const q = (n: number): string => (n === 1 ? '1 Quelle' : `${n} Quellen`);
const T72: Record<ZoomZ, Fall72> = {
  Z0: { lage: { zustand: 'nicht_verfuegbar' }, nk: [[0, 0]], tray: () => null, karte: () => null },
  Z1a: {
    lage: { zustand: 'einrichtung', maengel: ['sdk_fehlt', 'zugang_fehlt'] }, nk: [[0, 0]],
    tray: () => '△ Zoom: Einrichtung unvollständig',
    karte: () => 'Zoom ist nicht vollständig eingerichtet: SDK-Ordner fehlt · Zugangsdaten fehlen.',
  },
  Z1b: {
    lage: { zustand: 'einrichtung', maengel: ['sdk_fehlt'], kopieLaeuft: true },
    abbild: {
      einrichtung: {
        sdk: { stand: 'kopiert', fassung: null, kopie: { dateien: 40, dateienGesamt: 153, bytes: 105_500_000, bytesGesamt: 329_657_415 }, text: null },
        zugang: { herkunft: 'stored', clientIdEnde: '1234', text: null },
      },
    },
    nk: [[0, 0]],
    tray: () => '◌ Zoom: Einrichtung läuft',
    // 105 500 000 B = 100,6 MiB → 101; 329 657 415 B = 314,4 MiB → 314 (Math.round, L7)
    karte: () => 'Zoom-SDK wird kopiert: 40 von 153 Dateien (101 von 314 MB).',
  },
  Z2: { lage: { zustand: 'bereit' }, nk: [[0, 0]], tray: () => '○ Zoom: kein Meeting', karte: () => 'Bereit. Meeting-Nummer und Kenncode eingeben.' },
  Z3: { lage: { zustand: 'startet' }, nk: [[0, 0], [2, 0]], tray: () => '◌ Zoom: meldet sich an …', karte: () => 'Melde mich bei Zoom an …' },
  Z4: { lage: { zustand: 'tritt_bei' }, nk: [[0, 0], [2, 1]], tray: () => '◌ Zoom: tritt dem Meeting bei …', karte: () => 'Trete dem Meeting bei …' },
  Z5a: {
    lage: { zustand: 'warteraum', warten: 'warteraum' }, nk: [[0, 0], [2, 0]],
    tray: () => '◌ Zoom: im Warteraum', karte: () => 'Im Warteraum. Der Host muss „Regie Süd“ zulassen.',
  },
  Z5b: {
    lage: { zustand: 'warteraum', warten: 'host' }, nk: [[0, 0], [2, 0]],
    tray: () => '◌ Zoom: wartet auf den Host', karte: () => 'Das Meeting hat noch nicht begonnen. Warte auf den Host.',
  },
  Z6: {
    lage: { zustand: 'im_meeting', erlaubnis: 'offen' }, nk: [[0, 0]],
    tray: () => '◌ Zoom: im Meeting, Aufnahme-Erlaubnis ausstehend',
    karte: () => 'Im Meeting. Warte auf die Aufnahme-Erlaubnis: Der Host muss sie im Zoom-Client für „Regie Süd“ erteilen.',
  },
  Z7: {
    lage: { zustand: 'im_meeting', erlaubnis: 'abgelehnt' }, nk: [[0, 0]],
    tray: () => '△ Zoom: im Meeting ohne Aufnahme-Erlaubnis',
    karte: () => 'Im Meeting ohne Aufnahme-Erlaubnis. Der Host hat abgelehnt. Der Host kann sie im Zoom-Client jederzeit erteilen; Connect merkt das von selbst.',
  },
  Z7b: {
    lage: { zustand: 'im_meeting', erlaubnis: 'abgelehnt' }, nk: [[2, 0], [2, 2], [1, 1]],
    tray: (n) => `△ Zoom: ${q(n)}, Aufnahme-Erlaubnis fehlt`,
    karte: (n) => n === 1
      ? 'Die Aufnahme-Erlaubnis fehlt (vom Host abgelehnt). 1 Quelle besteht noch. Der Host kann sie im Zoom-Client erteilen.'
      : `Die Aufnahme-Erlaubnis fehlt (vom Host abgelehnt). ${n} Quellen bestehen noch. Der Host kann sie im Zoom-Client erteilen.`,
  },
  Z8: {
    lage: { zustand: 'im_meeting', erlaubnis: 'ja' }, nk: [[0, 0]],
    tray: () => '○ Zoom: im Meeting, keine Quelle geladen', karte: () => 'Im Meeting. Personen unten als Quelle laden.',
  },
  Z9: {
    lage: { zustand: 'im_meeting', erlaubnis: 'ja' }, nk: [[2, 0], [1, 0]],
    tray: (n) => `● Zoom: ${q(n)} geladen`, karte: (n) => `Im Meeting. ${q(n)} geladen.`,
  },
  Z9b: {
    lage: { zustand: 'im_meeting', erlaubnis: 'ja' }, nk: [[2, 1], [2, 2], [1, 1]],
    tray: (n, k) => `● Zoom: ${q(n)} geladen, ${k} ohne Bild`,
    karte: (n, k) => `Im Meeting. ${q(n)} geladen, ${k} davon ohne Bild (Kamera aus, Person weg oder erstes Bild steht noch aus).`,
  },
  Z10: {
    lage: { zustand: 'abriss', versuch: null }, nk: [[0, 0], [2, 2]],
    tray: () => '△ Zoom: Verbindung unterbrochen, Zoom verbindet neu',
    karte: () => 'Verbindung unterbrochen. Zoom versucht selbst, neu zu verbinden …',
  },
  Z11: {
    lage: { zustand: 'abriss', versuch: 2 }, abbild: { abriss: { versuch: 2, versuche: 5, naechsterUm: JETZT + 4200 } },
    nk: [[0, 0], [2, 2]],
    tray: () => '△ Zoom: Verbindung verloren, Wiederbeitritt 2 von 5',
    karte: () => 'Verbindung zum Meeting verloren. Wiederbeitritt 2 von 5 in 5 s.',
  },
  Z12: { lage: { zustand: 'verlaesst' }, nk: [[0, 0], [2, 0]], tray: () => '◌ Zoom: verlässt das Meeting …', karte: () => 'Verlasse das Meeting …' },
  Z13: {
    lage: { zustand: 'fehler' },
    abbild: { meldung: { art: 'fehler', text: 'Beitritt gescheitert: falscher Kenncode.', detail: 'MEETING_FAIL_PASSWORD_ERR (4)' } },
    nk: [[0, 0], [2, 0]],
    tray: () => '✕ Zoom: Fehler, siehe Connect-Fenster', karte: () => 'Beitritt gescheitert: falscher Kenncode.',
  },
};
/** Abbild für Zeile z mit n Quellen, davon k ohne Bild, o offenen Soll-Einträgen. */
function lage(z: ZoomZ, n: number, k: number, o = 0): ZoomAbbild {
  const f = T72[z];
  return abbild({ ...f.abbild, kurz: { ...f.lage, quellen: n, ohneBild: k, sollOffen: o } });
}

// Zustand → mögliche Zeilen (Spec 7.1). Record über ZoomZustand: ein neuer Zustand scheitert im Typcheck.
const Z_JE_ZUSTAND: Record<ZoomZustand, ZoomZ[]> = {
  nicht_verfuegbar: ['Z0'], einrichtung: ['Z1a', 'Z1b'], bereit: ['Z2'], startet: ['Z3'], tritt_bei: ['Z4'],
  warteraum: ['Z5a', 'Z5b'], im_meeting: ['Z6', 'Z7', 'Z7b', 'Z8', 'Z9', 'Z9b'], abriss: ['Z10', 'Z11'],
  verlaesst: ['Z12'], fehler: ['Z13'],
};

console.log('— Vollständigkeit der Tabellen (Spec 7.6)');
{
  const zeilen = Object.keys(T72) as ZoomZ[];
  ck('7.2 hat 18 Zeilen (Z0 bis Z13 mit a/b)', zeilen.length === 18);
  ck('ZoomZustand hat 10 Werte', Object.keys(Z_JE_ZUSTAND).length === 10);
  const ausZustaenden = Object.values(Z_JE_ZUSTAND).flat().sort();
  ck('jede Zeile gehört zu genau einem Zustand', JSON.stringify(ausZustaenden) === JSON.stringify([...zeilen].sort()));
  ck('jeder Zustand führt zu seiner Zeile', zeilen.every((z) => Z_JE_ZUSTAND[T72[z].lage.zustand ?? 'bereit'].includes(z)));
}

console.log('— 7.1/7.2: zoomZ, Tray-/Kopfzeile und Kartentext je Zeile, n ∈ {0, 2}, Singular n = 1');
for (const z of Object.keys(T72) as ZoomZ[]) {
  for (const [n, k] of T72[z].nk) {
    const a = lage(z, n, k);
    ck(`${z} (n=${n}, k=${k}): zoomZ`, zoomZ(a.kurz) === z);
    ck(`${z} (n=${n}, k=${k}): Tray/Kopfzeile wörtlich`, zoomZeile(a.kurz) === T72[z].tray(n, k));
    ck(`${z} (n=${n}, k=${k}): Kartentext wörtlich`, kartenZeile(a, JETZT) === T72[z].karte(n, k));
  }
}
ck('macOS (zoom: null) → keine Zoom-Zeile', zoomZeile(null) === null);

console.log('— 7.2 Sonderfälle: Prüfung, Countdown, Mängel');
{
  const pruef = abbild({ pruefungLaeuft: true });
  ck('Z2 während „Einrichtung prüfen“: Kartentext', kartenZeile(pruef, JETZT) === 'Prüfe die Einrichtung (Anmeldung bei Zoom, ohne Meeting) …');
  ck('Z2 während „Einrichtung prüfen“: Tray bleibt „kein Meeting“', zoomZeile(pruef.kurz) === '○ Zoom: kein Meeting');
  const laeuft = abbild({ kurz: { zustand: 'abriss', versuch: 3 }, abriss: { versuch: 3, versuche: 5, naechsterUm: null } });
  ck('Z11 ohne Wartezeit: „läuft …“', kartenZeile(laeuft, JETZT) === 'Verbindung zum Meeting verloren. Wiederbeitritt 3 von 5 läuft …');
  const vorbei = abbild({ kurz: { zustand: 'abriss', versuch: 1 }, abriss: { versuch: 1, versuche: 5, naechsterUm: JETZT - 500 } });
  ck('Z11 mit abgelaufener Wartezeit: 0 s, nie negativ', kartenZeile(vorbei, JETZT) === 'Verbindung zum Meeting verloren. Wiederbeitritt 1 von 5 in 0 s.');
  const genau = abbild({ kurz: { zustand: 'abriss', versuch: 1 }, abriss: { versuch: 1, versuche: 5, naechsterUm: JETZT + 2000 } });
  ck('Z11 mit genau 2 s: „in 2 s“', kartenZeile(genau, JETZT) === 'Verbindung zum Meeting verloren. Wiederbeitritt 1 von 5 in 2 s.');
  const ohneMeldung = abbild({ kurz: { zustand: 'fehler' } });
  ck('Z13 ohne Meldung: leerer Kartentext', kartenZeile(ohneMeldung, JETZT) === '');
}

// Mängel: Record über ZoomMangel — je Mangel der Grund aus 7.2 (Z1a) wörtlich.
const GRUND_72: Record<ZoomMangel, string> = {
  sdk_fehlt: 'SDK-Ordner fehlt',
  sdk_defekt: 'Zoom-Laufzeit unvollständig, bitte den SDK-Ordner erneut wählen',
  bridge_fehlt: 'Zoom-Bridge fehlt in dieser Installation, bitte JM Connect neu installieren',
  zugang_fehlt: 'Zugangsdaten fehlen',
  zugang_unlesbar: 'Zugangsdaten lassen sich nicht entschlüsseln, bitte die Datei erneut wählen',
};
{
  const alle = Object.keys(GRUND_72) as ZoomMangel[];
  ck('ZoomMangel hat 5 Werte, MANGEL_GRUND trägt alle', alle.length === 5 && Object.keys(MANGEL_GRUND).length === 5);
  for (const m of alle) {
    const a = abbild({ kurz: { zustand: 'einrichtung', maengel: [m] } });
    ck(`Z1a mit ${m}: Kartentext wörtlich`, kartenZeile(a, JETZT) === `Zoom ist nicht vollständig eingerichtet: ${GRUND_72[m]}.`);
  }
  const fuenf = abbild({ kurz: { zustand: 'einrichtung', maengel: alle } });
  ck('Z1a mit allen Mängeln: verbunden mit „ · “ in der gegebenen Reihenfolge',
    kartenZeile(fuenf, JETZT) === `Zoom ist nicht vollständig eingerichtet: ${alle.map((m) => GRUND_72[m]).join(' · ')}.`);
}

// Erlaubnis: Record über ZoomErlaubnis — je Wert die Zeile bei n = 0 und n = 2 und beide Kartentexte.
const ERLAUBNIS: Record<ZoomErlaubnis, { z0: ZoomZ; z2: ZoomZ; karte0: string; karte2: string }> = {
  offen: {
    z0: 'Z6', z2: 'Z7b',
    karte0: 'Im Meeting. Warte auf die Aufnahme-Erlaubnis: Der Host muss sie im Zoom-Client für „Regie Süd“ erteilen.',
    karte2: 'Die Aufnahme-Erlaubnis fehlt (angefragt, noch keine Antwort). 2 Quellen bestehen noch. Der Host kann sie im Zoom-Client erteilen.',
  },
  ja: { z0: 'Z8', z2: 'Z9', karte0: 'Im Meeting. Personen unten als Quelle laden.', karte2: 'Im Meeting. 2 Quellen geladen.' },
  abgelehnt: {
    z0: 'Z7', z2: 'Z7b',
    karte0: 'Im Meeting ohne Aufnahme-Erlaubnis. Der Host hat abgelehnt. Der Host kann sie im Zoom-Client jederzeit erteilen; Connect merkt das von selbst.',
    karte2: 'Die Aufnahme-Erlaubnis fehlt (vom Host abgelehnt). 2 Quellen bestehen noch. Der Host kann sie im Zoom-Client erteilen.',
  },
  abgelaufen: {
    z0: 'Z7', z2: 'Z7b',
    karte0: 'Im Meeting ohne Aufnahme-Erlaubnis. Zoom hat keine Antwort bekommen. Der Host kann sie im Zoom-Client jederzeit erteilen; Connect merkt das von selbst.',
    karte2: 'Die Aufnahme-Erlaubnis fehlt (keine Antwort bekommen). 2 Quellen bestehen noch. Der Host kann sie im Zoom-Client erteilen.',
  },
  entzogen: {
    z0: 'Z7', z2: 'Z7b',
    karte0: 'Im Meeting ohne Aufnahme-Erlaubnis. Der Host hat sie entzogen. Der Host kann sie im Zoom-Client jederzeit erteilen; Connect merkt das von selbst.',
    karte2: 'Die Aufnahme-Erlaubnis fehlt (vom Host entzogen). 2 Quellen bestehen noch. Der Host kann sie im Zoom-Client erteilen.',
  },
};
console.log('— 7.1/7.2 je Erlaubnis (n = 0 und n = 2)');
ck('ZoomErlaubnis hat 5 Werte', Object.keys(ERLAUBNIS).length === 5);
for (const e of Object.keys(ERLAUBNIS) as ZoomErlaubnis[]) {
  const a0 = abbild({ kurz: { zustand: 'im_meeting', erlaubnis: e, quellen: 0 } });
  const a2 = abbild({ kurz: { zustand: 'im_meeting', erlaubnis: e, quellen: 2, ohneBild: 0 } });
  ck(`${e}, n=0 → ${ERLAUBNIS[e].z0}, Kartentext wörtlich`, zoomZ(a0.kurz) === ERLAUBNIS[e].z0 && kartenZeile(a0, JETZT) === ERLAUBNIS[e].karte0);
  ck(`${e}, n=2 → ${ERLAUBNIS[e].z2}, Kartentext wörtlich`, zoomZ(a2.kurz) === ERLAUBNIS[e].z2 && kartenZeile(a2, JETZT) === ERLAUBNIS[e].karte2);
}
ck('im_meeting mit erlaubnis null zählt wie „offen“ (Z6)', zoomZ(kurz({ zustand: 'im_meeting', erlaubnis: null })) === 'Z6');

console.log('— 7.3 Gäste-Zeile');
ck('g = 2 → „● Gäste: 2 NDI-Quellen“', gaesteZeile(status(2, true, null)) === '● Gäste: 2 NDI-Quellen');
ck('g = 1 → Singular „1 NDI-Quelle“', gaesteZeile(status(1, true, null)) === '● Gäste: 1 NDI-Quelle');
ck('g > 0 auch ohne Cloud → Gäste-Zahl', gaesteZeile(status(2, false, null)) === '● Gäste: 2 NDI-Quellen');
ck('g = 0, Cloud eingerichtet', gaesteZeile(status(0, true, null)) === '○ Gäste: keine NDI-Quelle');
ck('g = 0, Cloud nicht eingerichtet', gaesteZeile(status(0, false, null)) === '△ Gäste: Cloud nicht eingerichtet');

console.log('— 7.4 Tooltip, Tabelle wörtlich (g ∈ {0, 1}, n ∈ {0, 2})');
const T74: Array<{ zs: ZoomZ[]; n: number; g0: string; g1: string }> = [
  { zs: ['Z0', 'Z1a', 'Z1b', 'Z2', 'Z3', 'Z4', 'Z5a', 'Z5b', 'Z6', 'Z7', 'Z8', 'Z12'], n: 0, g0: 'JM Connect', g1: 'JM Connect — Zuschaltungen aktiv' },
  { zs: ['Z3', 'Z4', 'Z5a', 'Z5b', 'Z7b', 'Z9', 'Z9b', 'Z12'], n: 2, g0: 'JM Connect — Zuschaltungen aktiv', g1: 'JM Connect — Zuschaltungen aktiv' },
  { zs: ['Z10', 'Z11'], n: 0, g0: 'JM Connect — Zoom-Verbindung unterbrochen', g1: 'JM Connect — Zuschaltungen aktiv · Zoom-Verbindung unterbrochen' },
  { zs: ['Z10', 'Z11'], n: 2, g0: 'JM Connect — Zuschaltungen aktiv · Zoom-Verbindung unterbrochen', g1: 'JM Connect — Zuschaltungen aktiv · Zoom-Verbindung unterbrochen' },
  { zs: ['Z13'], n: 0, g0: 'JM Connect — Zoom-Fehler', g1: 'JM Connect — Zuschaltungen aktiv · Zoom-Fehler' },
  { zs: ['Z13'], n: 2, g0: 'JM Connect — Zuschaltungen aktiv · Zoom-Fehler', g1: 'JM Connect — Zuschaltungen aktiv · Zoom-Fehler' },
];
{
  const abgedeckt = new Set(T74.flatMap((r) => r.zs));
  ck('jede Zeile aus 7.2 steht in der Tooltip-Tabelle', (Object.keys(T72) as ZoomZ[]).every((z) => abgedeckt.has(z)));
  for (const r of T74) {
    for (const z of r.zs) {
      const paar = T72[z].nk.find(([n]) => n === r.n);
      ck(`${z} mit n=${r.n} ist nach 7.1 zulässig`, paar !== undefined);
      if (!paar) continue;
      const k = lage(z, paar[0], paar[1]).kurz;
      ck(`${z}, n=${r.n}, g=0: „${r.g0}“`, trayTooltip(status(0, true, k)) === r.g0);
      ck(`${z}, n=${r.n}, g=1: „${r.g1}“`, trayTooltip(status(1, true, k)) === r.g1);
    }
  }
  ck('macOS (zoom: null), g=0 → „JM Connect“', trayTooltip(status(0, true, null)) === 'JM Connect');
  ck('macOS (zoom: null), g=1 → „JM Connect — Zuschaltungen aktiv“', trayTooltip(status(1, true, null)) === 'JM Connect — Zuschaltungen aktiv');
}

console.log('— 7.3 Tray „Zoom-Meeting verlassen“ aktiv in Z3–Z11');
{
  const aktiv: ZoomZ[] = ['Z3', 'Z4', 'Z5a', 'Z5b', 'Z6', 'Z7', 'Z7b', 'Z8', 'Z9', 'Z9b', 'Z10', 'Z11'];
  for (const z of Object.keys(T72) as ZoomZ[]) {
    const [n, k] = T72[z].nk[0];
    ck(`${z}: Verlassen ${aktiv.includes(z) ? 'aktiv' : 'gesperrt'}`, trayVerlassenAktiv(lage(z, n, k).kurz) === aktiv.includes(z));
  }
  ck('macOS (null): Verlassen gesperrt', trayVerlassenAktiv(null) === false);
}

console.log('— 7.5 STATE je Zustand, o ∈ {0, 1}');
// alarm1 null = „–“ in der Spec-Tabelle (o > 0 kommt in dieser Zeile nicht vor).
const T75: Record<Exclude<ZoomZ, 'Z0'>, { status: ZoomStatusWert; privilege: 0 | 1; alarm0: 0 | 1; alarm1: 0 | 1 | null }> = {
  Z1a: { status: 'einrichtung', privilege: 0, alarm0: 0, alarm1: null },
  Z1b: { status: 'einrichtung', privilege: 0, alarm0: 0, alarm1: null },
  Z2: { status: 'bereit', privilege: 0, alarm0: 0, alarm1: null },
  Z3: { status: 'tritt_bei', privilege: 0, alarm0: 0, alarm1: 1 },
  Z4: { status: 'tritt_bei', privilege: 0, alarm0: 0, alarm1: 1 },
  Z5a: { status: 'warteraum', privilege: 0, alarm0: 0, alarm1: 1 },
  Z5b: { status: 'warteraum', privilege: 0, alarm0: 0, alarm1: 1 },
  Z6: { status: 'im_meeting', privilege: 0, alarm0: 0, alarm1: 1 },
  Z7: { status: 'im_meeting', privilege: 0, alarm0: 1, alarm1: 1 },
  Z7b: { status: 'im_meeting', privilege: 0, alarm0: 1, alarm1: 1 },
  Z8: { status: 'im_meeting', privilege: 1, alarm0: 0, alarm1: 1 },
  Z9: { status: 'im_meeting', privilege: 1, alarm0: 0, alarm1: 1 },
  Z9b: { status: 'im_meeting', privilege: 1, alarm0: 0, alarm1: 1 },
  Z10: { status: 'abriss', privilege: 0, alarm0: 1, alarm1: 1 },
  Z11: { status: 'abriss', privilege: 0, alarm0: 1, alarm1: 1 },
  Z12: { status: 'verlaesst', privilege: 0, alarm0: 0, alarm1: 0 },
  Z13: { status: 'fehler', privilege: 0, alarm0: 1, alarm1: 1 },
};
{
  ck('7.5 hat 17 Zeilen (alle außer Z0)', Object.keys(T75).length === 17);
  ck('Z0 (macOS): keine zoom_*-Schlüssel', stateKvAus(lage('Z0', 0, 0).kurz) === null);
  for (const z of Object.keys(T75) as Array<Exclude<ZoomZ, 'Z0'>>) {
    const soll = T75[z];
    for (const [n, k] of T72[z].nk) {
      for (const o of [0, 1]) {
        const alarm = o === 0 ? soll.alarm0 : soll.alarm1;
        if (alarm === null) continue;
        const kv = stateKvAus(lage(z, n, k, o).kurz);
        ck(`${z} (n=${n}, o=${o}): zoom_status=${soll.status}, sources=${n}, live=${n > 0 ? 1 : 0}, privilege=${soll.privilege}, alarm=${alarm}`,
          kv !== null && kv.zoom_status === soll.status && kv.zoom_sources === n && kv.zoom_live === (n > 0 ? 1 : 0)
          && kv.zoom_privilege === soll.privilege && kv.zoom_alarm === alarm);
      }
    }
  }
  const kv = stateKvAus(lage('Z9', 2, 0, 1).kurz);
  ck('STATE trägt genau die fünf Zoom-Schlüssel (keine Namen, keine Nummer)',
    kv !== null && JSON.stringify(Object.keys(kv).sort()) === '["zoom_alarm","zoom_live","zoom_privilege","zoom_sources","zoom_status"]');
}

console.log('— Einrichtungszeilen (Spec 9 Punkt 3)');
{
  ck('TEXT_A4 wörtlich', TEXT_A4 === 'Nur für diese Sitzung gemerkt — auf diesem Rechner gibt es keinen Schlüsselbund.');
  ck('TEXT_A6 wörtlich', TEXT_A6 === 'Kommt aus Umgebungsvariablen (ZOOM_SDK_…) und hat Vorrang.');
  const ohne = abbild();
  ck('SDK eingerichtet: „Zoom-SDK 7.1.5.43953 eingerichtet“ / „Neu wählen …“',
    sdkZeile(ohne) === 'Zoom-SDK 7.1.5.43953 eingerichtet' && sdkKnopf(ohne) === 'Neu wählen …');
  const fehlt = abbild({ kurz: { zustand: 'einrichtung', maengel: ['sdk_fehlt'] } });
  ck('sdk_fehlt: „Zoom-SDK: nicht eingerichtet“ / „SDK-Ordner wählen …“',
    sdkZeile(fehlt) === 'Zoom-SDK: nicht eingerichtet' && sdkKnopf(fehlt) === 'SDK-Ordner wählen …');
  const defekt = abbild({ kurz: { zustand: 'einrichtung', maengel: ['sdk_defekt'] } });
  ck('sdk_defekt: „Zoom-SDK: Laufzeit unvollständig“ / „Neu wählen …“',
    sdkZeile(defekt) === 'Zoom-SDK: Laufzeit unvollständig' && sdkKnopf(defekt) === 'Neu wählen …');
  const bridge = abbild({ kurz: { zustand: 'einrichtung', maengel: ['bridge_fehlt'] } });
  ck('bridge_fehlt: das SDK selbst gilt als eingerichtet', sdkZeile(bridge) === 'Zoom-SDK 7.1.5.43953 eingerichtet');

  const ZUGANG: Record<ProxyKeySource, string> = {
    stored: 'Zugangsdaten: hinterlegt (Client-ID endet auf ab12)',
    session: TEXT_A4,
    env: TEXT_A6,
    none: 'Zugangsdaten: fehlen',
  };
  for (const h of Object.keys(ZUGANG) as ProxyKeySource[]) {
    const a = abbild({ einrichtung: { sdk: ohne.einrichtung.sdk, zugang: { herkunft: h, clientIdEnde: h === 'none' ? null : 'ab12', text: null } } });
    ck(`Zugangsdaten, Herkunft ${h}: wörtlich`, zugangZeile(a) === ZUGANG[h]);
  }
  const unlesbar = abbild({
    kurz: { zustand: 'einrichtung', maengel: ['zugang_unlesbar'] },
    einrichtung: { sdk: ohne.einrichtung.sdk, zugang: { herkunft: 'none', clientIdEnde: null, text: null } },
  });
  ck('zugang_unlesbar: „Zugangsdaten: lassen sich nicht entschlüsseln“', zugangZeile(unlesbar) === 'Zugangsdaten: lassen sich nicht entschlüsseln');
}

console.log('— Knöpfe der Karte je Lage (Spec 9 Punkte 2–6)');
{
  const fehler = abbild({
    kurz: { zustand: 'fehler' }, erneutMoeglich: true,
    meldung: { art: 'fehler', text: 'Beitritt gescheitert: falscher Kenncode.', detail: 'MEETING_FAIL_PASSWORD_ERR (4)' },
  });
  const kf = zoomKnoepfe(fehler);
  ck('Z13 mit Daten: „Erneut beitreten“ + „Schließen“, kein „OK“',
    JSON.stringify(kf.meldung) === JSON.stringify({ erneut: true, schliessen: true, ok: false, logordner: false }));
  ck('Z13: Beitritt sichtbar, Einrichtung änderbar, nicht „Verlassen“', kf.beitrittSichtbar && kf.einrichtungAenderbar && !kf.verlassen && kf.pruefen === 'aus');
  const kf2 = zoomKnoepfe({ ...fehler, erneutMoeglich: false });
  ck('Z13 ohne Daten: nur „Schließen“', JSON.stringify(kf2.meldung) === JSON.stringify({ erneut: false, schliessen: true, ok: false, logordner: false }));

  const ende = abbild({ erneutMoeglich: true, meldung: { art: 'warnung', text: 'Meeting beendet: vom Gastgeber beendet.', detail: null } });
  ck('Z2 nach Meeting-Ende: „Erneut beitreten“ + „Schließen“',
    JSON.stringify(zoomKnoepfe(ende).meldung) === JSON.stringify({ erneut: true, schliessen: true, ok: false, logordner: false }));

  const info = abbild({ meldung: { art: 'info', text: 'Einrichtung in Ordnung: Zoom-SDK 7.1.5 (43953), Anmeldung bei Zoom erfolgreich.', detail: null } });
  ck('Z2 mit Info-Meldung: nur „OK“', JSON.stringify(zoomKnoepfe(info).meldung) === JSON.stringify({ erneut: false, schliessen: false, ok: true, logordner: false }));
  // Nach einem Meeting-Ende stehen Nummer und Kenncode noch im Speicher; „Einrichtung prüfen“ bleibt in Z2 erlaubt.
  const pruefungNachEnde = abbild({ erneutMoeglich: true, meldung: info.meldung });
  ck('Z2 mit erneutMoeglich und Info-Meldung (Ergebnis von „Einrichtung prüfen“): nur „OK“',
    JSON.stringify(zoomKnoepfe(pruefungNachEnde).meldung) === JSON.stringify({ erneut: false, schliessen: false, ok: true, logordner: false }));
  const pruefFehlerNachEnde = abbild({ erneutMoeglich: true, meldung: { art: 'fehler', text: 'Das Zoom-SDK ließ sich nicht starten (SDKERR_UNINITIALIZE). Details im Log.', detail: null } });
  ck('Z2 mit erneutMoeglich und Fehler-Meldung der Prüfung: „OK“ und „Logordner öffnen“, kein „Erneut“',
    JSON.stringify(zoomKnoepfe(pruefFehlerNachEnde).meldung) === JSON.stringify({ erneut: false, schliessen: false, ok: true, logordner: true }));
  const q7 = abbild({ meldung: { art: 'fehler', text: 'NDI ließ sich in der Zoom-Bridge nicht starten. Details im Log.', detail: null } });
  ck('Text mit „Details im Log“: zusätzlich „Logordner öffnen“', JSON.stringify(zoomKnoepfe(q7).meldung) === JSON.stringify({ erneut: false, schliessen: false, ok: true, logordner: true }));
  const imLog13 = zoomKnoepfe({ ...fehler, meldung: { art: 'fehler', text: 'Das Zoom-SDK ließ sich nicht starten (SDKERR_UNINITIALIZE). Details im Log.', detail: null } });
  ck('Z13 mit „Details im Log“: Logordner-Knopf', imLog13.meldung?.logordner === true && imLog13.meldung.schliessen);
  ck('ohne Meldung: kein Meldungsbereich', zoomKnoepfe(abbild()).meldung === null);
  const imMeetingMitMeldung = zoomKnoepfe(abbild({ kurz: { zustand: 'im_meeting', erlaubnis: 'ja' }, erneutMoeglich: true,
    meldung: { art: 'warnung', text: 'Zoom hat die Anfrage nach der Aufnahme-Erlaubnis nicht angenommen (SDKERR_NO_PERMISSION). Der Host kann sie im Zoom-Client trotzdem erteilen.', detail: null } }));
  ck('Meldung im Meeting (Q12): „OK“, nicht „Erneut“', JSON.stringify(imMeetingMitMeldung.meldung) === JSON.stringify({ erneut: false, schliessen: false, ok: true, logordner: false }));

  const bereit = zoomKnoepfe(abbild());
  ck('Z2: Einrichtung änderbar, „Einrichtung prüfen“ bereit, Beitreten frei',
    bereit.einrichtungAenderbar && bereit.pruefen === 'bereit' && bereit.beitrittSichtbar && !bereit.beitretenGesperrt && !bereit.verlassen);
  const pruefung = zoomKnoepfe(abbild({ pruefungLaeuft: true }));
  ck('Z2 mit laufender Prüfung: Einrichtung gesperrt (S10), „Prüfe …“, Beitreten gesperrt',
    !pruefung.einrichtungAenderbar && pruefung.pruefen === 'laeuft' && pruefung.beitrittSichtbar && pruefung.beitretenGesperrt);

  const z1a = zoomKnoepfe(abbild({ kurz: { zustand: 'einrichtung', maengel: ['zugang_fehlt'] } }));
  ck('Z1a: kein Beitritt, Sperrhinweis, Einrichtung offen und änderbar, keine Prüfung',
    !z1a.beitrittSichtbar && z1a.sperrHinweis && z1a.einrichtungOffen && z1a.einrichtungAenderbar && z1a.pruefen === 'aus');
  const z1b = zoomKnoepfe(abbild({ kurz: { zustand: 'einrichtung', maengel: ['sdk_fehlt'], kopieLaeuft: true } }));
  ck('Z1b: Einrichtung während der Kopie gesperrt', !z1b.einrichtungAenderbar && z1b.sperrHinweis && !z1b.beitrittSichtbar);
  ck('ohne Mängel: Einrichtung eingeklappt, kein Sperrhinweis', !bereit.einrichtungOffen && !bereit.sperrHinweis);

  const imMeeting = zoomKnoepfe(lage('Z9', 2, 0));
  ck('im Meeting: Einrichtung gesperrt (S10), „Meeting verlassen“, kein Beitritt',
    !imMeeting.einrichtungAenderbar && imMeeting.verlassen && !imMeeting.beitrittSichtbar && imMeeting.pruefen === 'aus');
  ck('Z10: „Meeting verlassen“, kein „Abbrechen“', zoomKnoepfe(lage('Z10', 0, 0)).verlassen && !zoomKnoepfe(lage('Z10', 0, 0)).abbrechen);
  ck('Z11: „Meeting verlassen“ und „Abbrechen“', zoomKnoepfe(lage('Z11', 0, 0)).verlassen && zoomKnoepfe(lage('Z11', 0, 0)).abbrechen);
  ck('Z12: kein „Meeting verlassen“ mehr', !zoomKnoepfe(lage('Z12', 0, 0)).verlassen);
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
