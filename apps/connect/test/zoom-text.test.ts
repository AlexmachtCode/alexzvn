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
import {
  authMeldung, dllMeldung, endeMeldung, exitCodeAus, failMeldung, failText, fehlerDetail, KT, mangelText, maskiere,
  quellenFehler, spawnMeldung, tonZustand, VORSATZ,
} from '../src/main/zoom/klartext';

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

console.log('— Klartexte 8.1–8.5 wörtlich (KT, mit Beispielwerten für die Platzhalter)');
{
  const KT_SOLL: Array<[string, string, string]> = [
    ['S1', KT.S1, 'In diesem Ordner liegt kein Zoom-SDK. Bitte den entpackten SDK-Ordner wählen (der mit dem Unterordner x64\\bin) oder direkt den Ordner x64\\bin.'],
    ['S2', KT.S2, 'Das ist die 32-Bit-Fassung des Zoom-SDK. Bitte den Ordner x64\\bin wählen oder den SDK-Ordner darüber.'],
    ['S3', KT.S3('7.1.6.12345'), 'Dieses Zoom-SDK hat die Fassung 7.1.6.12345. Diese Connect-Fassung braucht genau 7.1.5.43953. Für eine andere SDK-Fassung braucht es einen neuen Connect-Release.'],
    ['S3b', KT.S3b, 'Die Fassung des Zoom-SDK lässt sich nicht lesen. Bitte das unveränderte SDK aus der JM-Ablage wählen.'],
    ['S4', KT.S4('vcruntime140.dll'), 'Im SDK-Ordner liegt eine Datei, die wie eine Connect-Datei heißt (vcruntime140.dll). Das ist kein unverändertes Zoom-SDK.'],
    ['S5', KT.S5(415, 80), 'Für die Kopie des Zoom-SDK fehlt Platz: gebraucht 415 MB, frei 80 MB.'],
    ['S6', KT.S6('EIO'), 'Das Zoom-SDK ließ sich nicht kopieren (EIO). Die bisherige Einrichtung bleibt unverändert.'],
    ['S7', KT.S7(152, 153), 'Die Kopie des Zoom-SDK ist unvollständig (152 von 153 Dateien). Bitte den Ordner erneut wählen.'],
    ['S8', KT.S8, 'Dieser Connect-Installation fehlt die Zoom-Bridge. Bitte JM Connect neu installieren.'],
    ['S9', KT.S9('sdk.dll'), 'Die Zoom-Laufzeit auf diesem PC ist unvollständig (sdk.dll). Bitte den SDK-Ordner erneut wählen.'],
    ['S10', KT.S10, 'Während Zoom läuft oder die Kopie läuft, lassen sich SDK-Ordner und Zugangsdaten nicht ändern.'],
    ['A1', KT.A1, 'Die Datei ist kein gültiges JSON (Inhalt wird absichtlich nicht angezeigt).'],
    ['A2', KT.A2, 'In der Datei fehlen Client-ID oder Client-Secret (erwartet: clientId und clientSecret).'],
    ['A3', KT.A3('ENOENT'), 'Die Datei lässt sich nicht lesen (ENOENT).'],
    ['A4', KT.A4, 'Nur für diese Sitzung gemerkt — auf diesem Rechner gibt es keinen Schlüsselbund.'],
    ['A5', KT.A5, 'Die hinterlegten Zugangsdaten lassen sich unter diesem Windows-Konto nicht entschlüsseln. Bitte die Datei erneut wählen.'],
    ['A6', KT.A6, 'Kommt aus Umgebungsvariablen (ZOOM_SDK_…) und hat Vorrang.'],
    ['B1', KT.B1, 'zoom-bridge.exe fehlt im Laufzeit-Ordner. Bitte den SDK-Ordner erneut wählen.'],
    ['B2', KT.B2('EPERM'), 'Windows hat den Start der Zoom-Bridge verhindert (Virenschutz oder Smart App Control). Detail: EPERM.'],
    ['B3', KT.B3, 'Die Zoom-Bridge ist beim Start gestorben: Eine DLL fehlt (0xC0000135). Mit den Zugangsdaten hat das nichts zu tun. Bitte den SDK-Ordner erneut wählen.'],
    ['B4', KT.B4, 'Die Zoom-Bridge ist beim Start gestorben: Eine DLL ist zu alt oder passt nicht (0xC0000139). Mit den Zugangsdaten hat das nichts zu tun. Bitte den SDK-Ordner erneut wählen.'],
    ['B5', KT.B5, 'Die Zoom-Bridge ist beim Start gestorben: Eine DLL ist kein 64-Bit-Programm oder beschädigt (0xC000007B). Mit den Zugangsdaten hat das nichts zu tun. Bitte den SDK-Ordner erneut wählen.'],
    ['B6', KT.B6('exitCode=1'), 'Die Zoom-Bridge hat sich beendet, bevor Zoom die Anmeldung beantwortet hat (exitCode=1). Details im Log.'],
    ['B7', KT.B7('7.1.6 (99999)'), 'Die Zoom-Laufzeit meldet die Fassung 7.1.6 (99999), erwartet ist 7.1.5 (43953). Bitte den SDK-Ordner erneut wählen.'],
    ['B8', KT.B8('SDKERR_UNINITIALIZE'), 'Das Zoom-SDK ließ sich nicht starten (SDKERR_UNINITIALIZE). Details im Log.'],
    ['B8_14', KT.B8_14, 'Auf diesem PC läuft schon ein anderes Programm mit dem Zoom-Meeting-SDK (zum Beispiel das Einsatzpaket „zoom-join“). Bitte es zuerst beenden.'],
    ['B9', KT.B9('AUTHRET_KEYORSECRETWRONG'), 'Zoom hat die Anmeldung abgelehnt: Client-ID oder Client-Secret stimmen nicht (AUTHRET_KEYORSECRETWRONG). Bitte die Zugangsdaten-Datei prüfen.'],
    ['B10', KT.B10, 'Zoom hat die Anmeldung abgelehnt: Das Anmelde-Token passt nicht (AUTHRET_JWTTOKENWRONG). Meist stimmen die Zugangsdaten nicht, oder die Uhr dieses PCs geht falsch.'],
    ['B11', KT.B11('AUTHRET_ACCOUNTNOTSUPPORT'), 'Das Zoom-Konto der App darf das Meeting-SDK nicht nutzen (AUTHRET_ACCOUNTNOTSUPPORT). Das klärt der Inhaber des Zoom-Kontos.'],
    ['B12', KT.B12('AUTHRET_NETWORKISSUE'), 'Zoom ist gerade nicht erreichbar (AUTHRET_NETWORKISSUE). Netzwerk prüfen und erneut versuchen.'],
    ['B13', KT.B13, 'Zoom lässt diese SDK-Fassung nicht mehr zu (AUTHRET_CLIENT_INCOMPATIBLE). Nötig ist ein neuer Connect-Release mit neuer SDK-Fassung.'],
    ['B14', KT.B14, 'Zu viele Anmeldungen in kurzer Zeit (AUTHRET_LIMIT_EXCEEDED_EXCEPTION). Einige Minuten warten.'],
    ['B15', KT.B15('AUTHRET_UNKNOWN'), 'Zoom hat die Anmeldung abgelehnt (AUTHRET_UNKNOWN).'],
    ['B16', KT.B16, 'Zoom hat auf die Anmeldung nicht geantwortet (30 s). Netzwerk prüfen und erneut versuchen.'],
    ['B17', KT.B17, 'Zugangsdaten fehlen — bitte die Datei wählen.'],
    ['B18', KT.B18('SDKERR_WRONG_USAGE'), 'Das Zoom-SDK hat die Anmeldung sofort abgewiesen (SDKERR_WRONG_USAGE). Mit dem Netzwerk hat das nichts zu tun. Details im Log.'],
    ['N0', KT.N0, 'Die Meeting-Nummer darf nur Ziffern enthalten (Leerzeichen und Bindestriche werden entfernt).'],
    ['N0b', KT.N0b, 'Der Anzeigename muss 1 bis 64 Zeichen lang sein.'],
    ['CT', KT.CT, 'Zoom hat den Beitritt in 30 s weder bestätigt noch abgelehnt. Netzwerk prüfen und erneut versuchen.'],
    ['CE', KT.CE, 'Der Host hat zugelassen, aber Zoom hat den Einlass in 30 s nicht abgeschlossen. Netzwerk prüfen und erneut beitreten.'],
    ['CJ', KT.CJ('SDKERR_INVALID_PARAMETER'), 'Zoom hat den Beitritt nicht angenommen (SDKERR_INVALID_PARAMETER).'],
    ['CB', KT.CB('exitCode=3'), 'Die Zoom-Bridge hat sich während des Beitritts beendet (exitCode=3). Details im Log.'],
    ['Q1', KT.Q1, 'Keine Aufnahme-Erlaubnis — der Host muss sie im Zoom-Client erteilen.'],
    ['Q2', KT.Q2, 'Diese Person ist nicht mehr im Meeting.'],
    ['Q4', KT.Q4('VIDEO_SENDER_FAILED'), 'Die Quelle ließ sich nicht aufbauen (VIDEO_SENDER_FAILED). Details im Log.'],
    ['Q5', KT.Q5('AUDIO_HELPER_MISSING'), 'Ton nicht verfügbar (AUDIO_HELPER_MISSING) — das Bild läuft ohne Ton. Für einen neuen Versuch entladen und neu laden.'],
    ['Q6', KT.Q6(12), 'Ton: 12 Pakete verworfen — dieser PC kommt nicht hinterher.'],
    ['Q7', KT.Q7, 'NDI ließ sich in der Zoom-Bridge nicht starten. Details im Log.'],
    ['Q8', KT.Q8, 'Keine Antwort der Zoom-Bridge auf „Als Quelle laden“.'],
    ['Q9', KT.Q9(6), 'Mehr als 5 Zoom-Quellen sind nicht gemessen. Noch einmal klicken, um die 6. Quelle trotzdem zu laden.'],
    ['Q10', KT.Q10('JM Connect – Zoom Anna'), 'NDI-Name doppelt: Ein Browser-Gast und diese Zoom-Person senden beide als „JM Connect – Zoom Anna“. Im Switcher ist nicht sicher, welche Quelle ankommt. Einen der beiden umbenennen.'],
    ['Q11', KT.Q11, 'Name doppelt im Meeting — nach einem Wiederbeitritt kann Connect diese Quelle nicht von selbst zuordnen.'],
    ['Q12', KT.Q12('SDKERR_NO_PERMISSION'), 'Zoom hat die Anfrage nach der Aufnahme-Erlaubnis nicht angenommen (SDKERR_NO_PERMISSION). Der Host kann sie im Zoom-Client trotzdem erteilen.'],
    ['Q13', KT.Q13, 'Bild-Versatz: erlaubt sind ganze Zahlen von 0 bis 1000 ms.'],
    ['Q14', KT.Q14, 'Zum Umschalten erst entladen.'],
    ['Q15', KT.Q15, 'Erst im Zoom-Client zulassen.'],
    ['Q16', KT.Q16('Anna'), 'Bild: fehlerhafte Bilder von „Anna“ verworfen (videoBufferMismatch). Die Quelle bleibt bestehen; ob wieder Bild kommt, zeigt ihr Bild-Zustand.'],
    ['Q17', KT.Q17('Ben'), 'Ton: ein fehlerhaftes Paket von „Ben“ verworfen (audioBufferMismatch). Der Ton läuft mit dem nächsten gültigen Paket weiter.'],
    ['R6', KT.R6('vom Gastgeber beendet'), 'Meeting beendet: vom Gastgeber beendet.'],
    ['PRUEFUNG_OK', KT.PRUEFUNG_OK, 'Einrichtung in Ordnung: Zoom-SDK 7.1.5 (43953), Anmeldung bei Zoom erfolgreich.'],
    ['UE_RECONNECT', KT.UE_RECONNECT, 'Zoom hat die Verbindung in 30 s nicht wiederhergestellt.'],
    ['UE_ABSTURZ', KT.UE_ABSTURZ('exitCode=3'), 'Die Zoom-Bridge ist abgestürzt (exitCode=3). Details im Log.'],
  ];
  for (const [id, ist, soll] of KT_SOLL) ck(`${id} wörtlich`, ist === soll);
  ck('KT hat genau diese 62 Einträge (F1–F8, R2/R4/R5/R7 erst in 4b)', Object.keys(KT).length === 62 && KT_SOLL.length === 62);
}

console.log('— 8.3: Vorsatz + Text, ganzer Text, nie doppelt „gescheitert:“');
{
  const N = 'JM Connect';
  const C63 = 'Das Meeting gehört nicht zum Zoom-Konto dieser App. JM Connect kann nur Meetings im eigenen Zoom-Konto betreten. Bitte das Meeting im eigenen Konto anlegen.';
  const C500 = 'Zoom verlangt für dieses Meeting einen Beitritt im Namen eines angemeldeten Nutzers (OBF-Token). Das kann JM Connect nicht — nur Meetings im eigenen Zoom-Konto.';
  const faelle: Array<[string, { text: string; detail: string | null }, string]> = [
    ['Beitritt, 63 → C63', failMeldung(VORSATZ.beitritt, 63, N), `Beitritt gescheitert: ${C63}`],
    ['Beitritt, 2 → Csonst', failMeldung(VORSATZ.beitritt, 2, N), 'Beitritt gescheitert: Wiederverbinden fehlgeschlagen (Code 2).'],
    ['Wiederbeitritt, 503 → C500', failMeldung(VORSATZ.wiederbeitritt, 503, N), `Wiederbeitritt abgebrochen: ${C500}`],
    ['Wiederbeitritt, 2 → Csonst', failMeldung(VORSATZ.wiederbeitritt, 2, N), 'Wiederbeitritt abgebrochen: Wiederverbinden fehlgeschlagen (Code 2).'],
    ['Verbindung, 4 → C4', failMeldung(VORSATZ.verbindung, 4, N), 'Verbindung verloren: falscher Kenncode.'],
    ['Verbindung, 2 → Csonst', failMeldung(VORSATZ.verbindung, 2, N), 'Verbindung verloren: Wiederverbinden fehlgeschlagen (Code 2).'],
  ];
  for (const [name, m, soll] of faelle) {
    ck(`${name}: ganzer Text wörtlich`, m.text === soll);
    const nachVorsatz = m.text.slice(m.text.indexOf(': ') + 2);
    ck(`${name}: kein zweites „gescheitert:“`, !m.text.includes('gescheitert: gescheitert') && !nachVorsatz.includes('gescheitert:'));
    ck(`${name}: detail = failCodeName (Code)`, m.detail !== null && /^[A-Z_0-9]+ \(\d+\)$/.test(m.detail));
  }
  ck('detail für 63 wörtlich', failMeldung(VORSATZ.beitritt, 63, N).detail === 'MEETING_FAIL_UNABLE_TO_JOIN_EXTERNAL_MEETING (63)');
  ck('detail für 503 wörtlich', failMeldung(VORSATZ.wiederbeitritt, 503, N).detail === 'MEETING_FAIL_USER_LEVEL_TOKEN_NOT_HAVE_HOST_ZAK_OBF (503)');
  ck('Csonst mit Code 11: failReason deutsch, ohne Vorsatz', failText(11, N) === 'kein Medienserver gefunden (Code 11).');
  const unbekannt = failMeldung(VORSATZ.beitritt, 4242, N);
  ck('unbekannter Code: „unbekannter Grund (Code 4242).“ und MEETING_FAIL_CODE_4242',
    unbekannt.text === 'Beitritt gescheitert: unbekannter Grund (Code 4242).' && unbekannt.detail === 'MEETING_FAIL_CODE_4242 (4242)');
  ck('C61 mit Anzeigename', failText(61, 'Regie Süd') === 'Der Host hat „Regie Süd“ aus dem Meeting entfernt.');

  const C13 = 'Das Meeting ist durch eine Kontoeinstellung eingeschränkt.';
  const C88 = 'Zoom kann die Meeting-Nummer keinem Meeting eindeutig zuordnen. Bitte die Nummer prüfen.';
  const C_83: Record<number, string> = {
    4: 'falscher Kenncode.',
    6: 'Das Meeting ist vorbei.',
    7: 'Das Meeting hat noch nicht begonnen, und Warten auf den Host ist nicht erlaubt.',
    8: 'Dieses Meeting gibt es nicht. Bitte die Nummer prüfen.',
    9: 'Das Meeting ist voll.',
    10: 'Zoom lässt diese SDK-Fassung nicht mehr zu (Client zu alt). Nötig ist ein neuer Connect-Release mit neuer SDK-Fassung.',
    12: 'Das Meeting ist gesperrt.',
    13: C13, 14: C13,
    16: 'Zoom hat das Anmelde-Token als abgelaufen abgewiesen. Meist geht die Uhr dieses PCs falsch.',
    23: 'Das Meeting verlangt eine Anmeldung mit einem Zoom-Konto. JM Connect tritt ohne Anmeldung bei.',
    60: 'Das Meeting ist nur für Mitglieder des Gastgeber-Kontos freigegeben.',
    61: 'Der Host hat „JM Connect“ aus dem Meeting entfernt.',
    62: 'Der Host lässt niemanden von außerhalb seines Zoom-Kontos zu.',
    63: C63,
    64: 'Der Administrator des Gastgeber-Kontos hat diese App gesperrt.',
    82: 'Das Meeting verlangt eine Anmeldung mit dem Konto des Veranstalters. JM Connect tritt ohne Anmeldung bei und kann nur Meetings im eigenen Zoom-Konto betreten.',
    88: C88, 89: C88,
    500: C500, 501: C500, 502: C500, 503: C500, 504: C500, 505: C500, 506: C500,
  };
  for (const [code, soll] of Object.entries(C_83)) ck(`8.3 Code ${code} wörtlich`, failText(Number(code), N) === soll);
}

console.log('— 6.5/8.5: Meeting-Ende (R6 ohne „beendet: “ aus explainStatus, Grund 1 = C61)');
{
  const ende = endeMeldung(2, 'JM Connect');
  ck('Grund 2 → „Meeting beendet: vom Gastgeber beendet.“', ende.text === 'Meeting beendet: vom Gastgeber beendet.' && ende.detail === null);
  ck('Grund 1 → C61 mit Anzeigename', endeMeldung(1, 'JM Connect').text === 'Der Host hat „JM Connect“ aus dem Meeting entfernt.');
  ck('unbekannter Grund → „Meeting beendet: Grund 99.“', endeMeldung(99, 'JM Connect').text === 'Meeting beendet: Grund 99.');
  ck('nie „beendet: beendet“', !endeMeldung(4, 'JM Connect').text.includes('beendet: beendet'));
}

console.log('— 8.2: Anmeldung, DLL-Tod, Spawn');
{
  const a2 = authMeldung(2);
  ck('auth 2 → B9 mit AUTHRET_KEYORSECRETWRONG', a2.text === KT.B9('AUTHRET_KEYORSECRETWRONG') && a2.detail === 'AUTHRET_KEYORSECRETWRONG (2)');
  ck('auth 1 → B9 mit AUTHRET_KEYORSECRETEMPTY', authMeldung(1).text === KT.B9('AUTHRET_KEYORSECRETEMPTY'));
  ck('auth 11 → B10', authMeldung(11).text === KT.B10);
  ck('auth 3 → B11', authMeldung(3).text === KT.B11('AUTHRET_ACCOUNTNOTSUPPORT'));
  ck('auth 4 → B11', authMeldung(4).text === KT.B11('AUTHRET_ACCOUNTNOTENABLESDK'));
  ck('auth 6 → B12', authMeldung(6).text === KT.B12('AUTHRET_SERVICE_BUSY'));
  ck('auth 8 → B12', authMeldung(8).text === KT.B12('AUTHRET_OVERTIME'));
  ck('auth 9 → B12', authMeldung(9).text === KT.B12('AUTHRET_NETWORKISSUE'));
  ck('auth 10 → B13', authMeldung(10).text === KT.B13);
  ck('auth 12 → B14', authMeldung(12).text === KT.B14);
  ck('auth 5 → B15', authMeldung(5).text === KT.B15('AUTHRET_UNKNOWN'));
  ck('auth 99 → B15 mit unbekanntem Namen', authMeldung(99).text === KT.B15('AUTHRET_UNKNOWN_CODE(99)'));

  ck('exitCodeAus liest „exitCode=<n>“', exitCodeAus('EXITED_UNEXPECTEDLY exitCode=3221225781') === 3221225781);
  ck('exitCodeAus: Signal → null', exitCodeAus('Signal=SIGKILL') === null && exitCodeAus(undefined) === null);
  const b3 = dllMeldung(0xc0000135);
  ck('0xC0000135 → B3', b3?.text === KT.B3 && b3.detail === 'STATUS_DLL_NOT_FOUND (0xC0000135)');
  ck('B3 nennt die Zugangsdaten NICHT als Ursache', b3 !== null && b3.text.includes('Mit den Zugangsdaten hat das nichts zu tun') && !b3.text.includes('stimmen nicht'));
  ck('0xC0000139 → B4', dllMeldung(0xc0000139)?.text === KT.B4);
  ck('0xC000007B → B5', dllMeldung(0xc000007b)?.text === KT.B5);
  ck('anderer Rückgabewert / keiner → null', dllMeldung(1) === null && dllMeldung(null) === null);
  ck('Spawn ENOENT → B1', spawnMeldung('ENOENT').text === KT.B1);
  ck('Spawn EACCES → B2 mit Code', spawnMeldung('EACCES').text === KT.B2('EACCES') && spawnMeldung('EACCES').detail === 'EACCES');
  ck('Spawn ohne Code → B2 „unbekannt“', spawnMeldung(undefined).text === KT.B2('unbekannt'));
  ck('fehlerDetail: „NAME (code)“', fehlerDetail({ name: 'SDKERR_UNINITIALIZE', code: 7 }) === 'SDKERR_UNINITIALIZE (7)');
  ck('fehlerDetail ohne Namen', fehlerDetail({ code: 'x' }) === 'unbekannt (x)');
}

console.log('— Mängel → Text (6.2 Schritt 1)');
{
  const MANGEL_TEXT: Record<ZoomMangel, [string | null, string]> = {
    sdk_fehlt: [null, 'Die Zoom-Laufzeit auf diesem PC ist unvollständig (jm-zoom-laufzeit.json). Bitte den SDK-Ordner erneut wählen.'],
    sdk_defekt: ['sdk.dll', 'Die Zoom-Laufzeit auf diesem PC ist unvollständig (sdk.dll). Bitte den SDK-Ordner erneut wählen.'],
    bridge_fehlt: [null, 'Dieser Connect-Installation fehlt die Zoom-Bridge. Bitte JM Connect neu installieren.'],
    zugang_fehlt: [null, 'Zugangsdaten fehlen — bitte die Datei wählen.'],
    zugang_unlesbar: [null, 'Die hinterlegten Zugangsdaten lassen sich unter diesem Windows-Konto nicht entschlüsseln. Bitte die Datei erneut wählen.'],
  };
  for (const m of Object.keys(MANGEL_TEXT) as ZoomMangel[]) {
    ck(`${m} → Text wörtlich`, mangelText(m, MANGEL_TEXT[m][0]) === MANGEL_TEXT[m][1]);
  }
}

console.log('— 8.4: Bild-/Ton-Fehler → Zeile, Hinweis oder nichts');
{
  const e = (code: string, name: string, person: string | null = 'Anna', dropped?: number) => quellenFehler(code, name, person, dropped);
  ck('videoNoPrivilege → Zeile Q1', JSON.stringify(e('videoNoPrivilege', 'VIDEO_NO_PRIVILEGE')) === JSON.stringify({ art: 'zeile', text: KT.Q1 }));
  ck('videoUnknownParticipant → Zeile Q2', JSON.stringify(e('videoUnknownParticipant', 'VIDEO_UNKNOWN_PARTICIPANT')) === JSON.stringify({ art: 'zeile', text: KT.Q2 }));
  ck('videoAlreadySubscribed → nichts (Q3)', e('videoAlreadySubscribed', 'VIDEO_ALREADY_SUBSCRIBED').art === 'keine');
  for (const [code, name] of [['videoRendererFailed', 'VIDEO_RENDERER_FAILED'], ['videoRawRecordingFailed', 'VIDEO_RAW_RECORDING_FAILED'], ['videoSenderFailed', 'VIDEO_SENDER_FAILED']]) {
    ck(`${code} → Zeile Q4(${name})`, JSON.stringify(e(code, name)) === JSON.stringify({ art: 'zeile', text: KT.Q4(name) }));
  }
  for (const [code, name] of [['audioVoipJoinFailed', 'AUDIO_VOIP_JOIN_FAILED'], ['audioHelperMissing', 'AUDIO_HELPER_MISSING'], ['audioSubscribeFailed', 'AUDIO_SUBSCRIBE_FAILED']]) {
    ck(`${code} → Zeile Q5(${name})`, JSON.stringify(e(code, name)) === JSON.stringify({ art: 'zeile', text: KT.Q5(name) }));
  }
  ck('videoBadDelay → Zeile Q13', JSON.stringify(e('videoBadDelay', 'VIDEO_BAD_DELAY')) === JSON.stringify({ art: 'zeile', text: KT.Q13 }));
  ck('audioQueueOverflow → Hinweis Q6 mit dropped', JSON.stringify(e('audioQueueOverflow', 'AUDIO_QUEUE_OVERFLOW', null, 37)) === JSON.stringify({ art: 'hinweis', text: 'Ton: 37 Pakete verworfen — dieser PC kommt nicht hinterher.' }));
  ck('audioQueueOverflow ohne dropped → 0', e('audioQueueOverflow', 'AUDIO_QUEUE_OVERFLOW', null).art === 'hinweis' && JSON.stringify(e('audioQueueOverflow', 'AUDIO_QUEUE_OVERFLOW', null)).includes('Ton: 0 Pakete'));
  ck('videoBufferMismatch → Hinweis Q16 (keine Zeile)', JSON.stringify(e('videoBufferMismatch', 'VIDEO_BUFFER_MISMATCH')) === JSON.stringify({ art: 'hinweis', text: KT.Q16('Anna') }));
  ck('audioBufferMismatch → Hinweis Q17 (keine Zeile)', JSON.stringify(e('audioBufferMismatch', 'AUDIO_BUFFER_MISMATCH', 'Ben')) === JSON.stringify({ art: 'hinweis', text: KT.Q17('Ben') }));
  ck('unbekannter Code → Zeile Q4 mit dem Namen', JSON.stringify(e('videoNeu', 'OWN_UNKNOWN(videoNeu)')) === JSON.stringify({ art: 'zeile', text: KT.Q4('OWN_UNKNOWN(videoNeu)') }));
  ck('Ton off/command (ohne Ton geladen) → kein Fehler', tonZustand('off', 'command').art === 'keine');
  ck('Ton off/audioUnavailable → Zeile Q5', JSON.stringify(tonZustand('off', 'audioUnavailable')) === JSON.stringify({ art: 'zeile', text: KT.Q5('audioUnavailable') }));
  ck('Ton off/participantLeft → kein Zeilenfehler', tonZustand('off', 'participantLeft').art === 'keine');
  ck('Ton live → kein Fehler', tonZustand('live', 'packets').art === 'keine');
}

console.log('— 8.7: Maskierung nur nicht-leerer Werte, längste zuerst');
{
  ck('Kenncode wird zu •••, leerer Wert stört nicht', maskiere('a KENNCODE-PROBE b', ['', 'KENNCODE-PROBE']) === 'a ••• b');
  ck('nur leerer Wert → Zeile unverändert (kein ••• zwischen den Zeichen)', maskiere('abc', ['']) === 'abc');
  const nummer = '7'.repeat(10);
  ck('eingegebene und normierte Nummer beide maskiert',
    maskiere(`join 777-777-7777 und ${nummer}`, [nummer, '777-777-7777']) === 'join ••• und •••');
  ck('längster Wert zuerst (kein Rest vom kürzeren)', maskiere(nummer, ['77', nummer]) === '•••');
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
