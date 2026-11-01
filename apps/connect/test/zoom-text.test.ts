// Zoom-Statustexte und Klartexte OHNE Electron (tsx): npm run selftest -w @jm/connect
// Spec 7.6: tabellengetrieben, jede Zeile aus 7.2, 7.3, 7.4 und 7.5 wörtlich, für jeden Zustand mit
// n ∈ {0, 2} (Singular mit n = 1), g ∈ {0, 1} und o ∈ {0, 1}, soweit 7.1 die Kombination zulässt.
// Die Tabellen sind Record<ZoomZ | ZoomZustand | ZoomErlaubnis | ZoomMangel, …>: eine neue
// Zustandsart fängt der Typcheck (tsc, CI-Job typecheck); die Zählprüfungen unten schützen nur
// die Testtabellen selbst.
import { readFileSync } from 'node:fs';
import type { AudioReason, VideoReason } from '@jm/zoom-bridge/protocol';
import type {
  AppStatus, ProxyKeySource, ZoomAbbild, ZoomBefehlErgebnis, ZoomErlaubnis, ZoomKurz, ZoomMangel, ZoomQuelle, ZoomSollEintrag, ZoomZustand,
} from '../src/shared/types';
import {
  BETRIEBSGROESSE, bildText, einrichtungsTextArt, gaesteZeile, kartenZeile, MANGEL_GRUND, Q9_ANFANG, quellenZustandText, sdkBalken,
  sdkKnopf, sdkLadenZeile, sdkSchluesselZeile, sdkZeile, sollFarbe, sollZeile, stateKvAus, TEXT_A4, TEXT_A4_SCHREIBFEHLER, TEXT_A6, TEXT_S11,
  TEXT_S17, tonText, trayTooltip, trayVerlassenAktiv, versatzUebernommen, versatzZeile, WIEDERBEITRITT_VERSUCHE, zoomKnoepfe, zoomZ,
  zoomZeile, zugangZeile, type ZoomStatusWert, type ZoomZ,
} from '../src/shared/zoom-text';
import { SDK_FASSUNG, SDK_FASSUNG_BRIDGE } from '@jm/zoom-bridge/sdk';
import * as fristen from '../src/main/zoom/fristen';
import {
  authMeldung, dllMeldung, endeMeldung, ENDGUELTIGE_FAIL_CODES, exitCodeAus, failMeldung, failText, fehlerDetail, fernLogText, FT,
  istEndgueltig, istErlaubnisFehler, istLadeFehler, KT, mangelText, maskiere, maskiereNamen, quellenFehler, spawnMeldung, tonZustand, VORSATZ, type VersuchsAusgang,
} from '../src/main/zoom/klartext';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

// ── Testhilfen ──
function kurz(z: Partial<ZoomKurz> = {}): ZoomKurz {
  return {
    zustand: 'bereit', warten: null, erlaubnis: null, quellen: 0, ohneBild: 0, sollOffen: 0,
    versuch: null, maengel: [], kopieLaeuft: false, befehl: null, ...z,
  };
}
function abbild(a: Omit<Partial<ZoomAbbild>, 'kurz'> & { kurz?: Partial<ZoomKurz> } = {}): ZoomAbbild {
  const { kurz: kz, ...rest } = a;
  return {
    kurz: kurz(kz),
    einrichtung: {
      sdk: { stand: 'ok', fassung: '7.1.5.43953', kopie: null, laden: null, text: null },
      zugang: { herkunft: 'stored', clientIdEnde: '1234', text: null },
      sdkSchluessel: { herkunft: 'stored' },
    },
    anzeigename: 'Regie Süd',
    versatz: { gewuenschtMs: 0, bestaetigtMs: null, nurSitzung: false },
    teilnehmer: [], soll: [], abriss: null, meldung: null, hinweise: [],
    erneutMoeglich: false, pruefungLaeuft: false, abbauLaeuft: false,
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
        sdk: { stand: 'kopiert', fassung: null, kopie: { dateien: 40, dateienGesamt: 153, bytes: 105_500_000, bytesGesamt: 329_657_415 }, laden: null, text: null },
        zugang: { herkunft: 'stored', clientIdEnde: '1234', text: null },
        sdkSchluessel: { herkunft: 'stored' },
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
  zugang_unlesbar: 'Zugangsdaten lassen sich nicht entschlüsseln, bitte erneut eintragen oder die Datei erneut wählen',
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
  // 4b (N4b.1, Texttabelle): Die Bridge baut beim Entzug ab; n > 0 gibt es nur, solange sie noch abbaut.
  // karte0 gilt ohne gemerkte Quelle (sollOffen 0, Vorgabe der Testhilfe): dann bleibt der bisherige Satz (Spec 7: jeder Text wahr).
  entzogen: {
    z0: 'Z7', z2: 'Z7b',
    karte0: 'Im Meeting ohne Aufnahme-Erlaubnis. Der Host hat sie entzogen. Der Host kann sie im Zoom-Client jederzeit erteilen; Connect merkt das von selbst.',
    karte2: 'Aufnahme-Erlaubnis vom Host entzogen. Connect stoppt 2 Quellen …',
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
  ck('STATE trägt genau die sieben Zoom-Schlüssel (keine Namen, keine Nummer)',
    kv !== null && JSON.stringify(Object.keys(kv).sort())
      === '["zoom_alarm","zoom_cmd","zoom_cmd_rejected","zoom_live","zoom_privilege","zoom_sources","zoom_status"]');
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
    const a = abbild({ einrichtung: { ...ohne.einrichtung, zugang: { herkunft: h, clientIdEnde: h === 'none' ? null : 'ab12', text: null } } });
    ck(`Zugangsdaten, Herkunft ${h}: wörtlich`, zugangZeile(a) === ZUGANG[h]);
  }
  const schreibfehler = abbild({ einrichtung: { ...ohne.einrichtung, zugang: { herkunft: 'session', grund: 'schreibfehler', clientIdEnde: 'ab12', text: null } } });
  ck('session + schreibfehler: eigener Text, nennt keinen Schlüsselbund', zugangZeile(schreibfehler) === TEXT_A4_SCHREIBFEHLER && !TEXT_A4_SCHREIBFEHLER.includes('Schlüsselbund')
    && TEXT_A4_SCHREIBFEHLER === 'Nur für diese Sitzung gemerkt — die Einstellungsdatei ließ sich nicht schreiben.');
  const unlesbar = abbild({
    kurz: { zustand: 'einrichtung', maengel: ['zugang_unlesbar'] },
    einrichtung: { ...ohne.einrichtung, zugang: { herkunft: 'none', clientIdEnde: null, text: null } },
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
    ['S10', KT.S10, 'Während Zoom läuft oder das Zoom-SDK geladen oder kopiert wird, lässt sich die Einrichtung nicht ändern.'],
    ['A1', KT.A1, 'Die Datei ist kein gültiges JSON (Inhalt wird absichtlich nicht angezeigt).'],
    ['A2', KT.A2, 'In der Datei fehlen Client-ID oder Client-Secret (erwartet: clientId und clientSecret).'],
    ['A3', KT.A3('ENOENT'), 'Die Datei lässt sich nicht lesen (ENOENT).'],
    ['A4', KT.A4, 'Nur für diese Sitzung gemerkt — auf diesem Rechner gibt es keinen Schlüsselbund.'],
    ['A5', KT.A5, 'Die hinterlegten Zugangsdaten lassen sich unter diesem Windows-Konto nicht entschlüsseln. Bitte die Zugangsdaten erneut eintragen oder die Datei erneut wählen.'],
    ['A7', KT.A7, 'Bitte Client-ID und Client-Secret eintragen, ohne Leerzeichen.'],
    ['A6', KT.A6, 'Kommt aus Umgebungsvariablen (ZOOM_SDK_…) und hat Vorrang.'],
    // Zoom-SDK nachladen (Spec 2026-10-06, Abschnitt 5)
    ['S11', KT.S11, 'Für „Zoom-SDK laden“ fehlt der SDK-Schlüssel. Bitte unter „SDK-Schlüssel“ eintragen.'],
    ['S12', KT.S12, 'Der Proxy hat den SDK-Schlüssel abgelehnt. Bitte den Schlüssel prüfen.'],
    ['S13', KT.S13(125), 'Zu viele Versuche. Bitte in 3 Minuten erneut versuchen.'],
    ['S14', KT.S14('ENOTFOUND'), 'Der Proxy ist nicht erreichbar (ENOTFOUND). Bitte die Netzverbindung prüfen oder den SDK-Ordner von Hand wählen.'],
    ['S15', KT.S15, 'Auf dem Proxy liegt kein passendes Zoom-SDK 7.1.5.43953. Bitte den SDK-Ordner von Hand wählen.'],
    ['S16', KT.S16('UND_ERR_SOCKET'), 'Das Zoom-SDK ließ sich nicht laden (UND_ERR_SOCKET). Die bisherige Einrichtung bleibt unverändert.'],
    ['S16b', KT.S16b, 'Das geladene Zoom-SDK hat nicht die erwartete Prüfsumme und wurde verworfen. Die bisherige Einrichtung bleibt unverändert.'],
    ['S16c', KT.S16c('Exit 1'), 'Das geladene Zoom-SDK ließ sich nicht entpacken (Exit 1). Die bisherige Einrichtung bleibt unverändert.'],
    ['S17', KT.S17, 'Laden abgebrochen. Die bisherige Einrichtung bleibt unverändert.'],
    ['S18', KT.S18, 'Bitte den SDK-Schlüssel eintragen, ohne Leerzeichen.'],
    ['B1', KT.B1, 'zoom-bridge.exe fehlt im Laufzeit-Ordner. Bitte den SDK-Ordner erneut wählen.'],
    ['B2', KT.B2('EPERM'), 'Windows hat den Start der Zoom-Bridge verhindert (Virenschutz oder Smart App Control). Detail: EPERM.'],
    ['B3', KT.B3, 'Die Zoom-Bridge ist beim Start gestorben: Eine DLL fehlt (0xC0000135). Mit den Zugangsdaten hat das nichts zu tun. Bitte den SDK-Ordner erneut wählen.'],
    ['B4', KT.B4, 'Die Zoom-Bridge ist beim Start gestorben: Eine DLL ist zu alt oder passt nicht (0xC0000139). Mit den Zugangsdaten hat das nichts zu tun. Bitte den SDK-Ordner erneut wählen.'],
    ['B5', KT.B5, 'Die Zoom-Bridge ist beim Start gestorben: Eine DLL ist kein 64-Bit-Programm oder beschädigt (0xC000007B). Mit den Zugangsdaten hat das nichts zu tun. Bitte den SDK-Ordner erneut wählen.'],
    ['B6', KT.B6('exitCode=1'), 'Die Zoom-Bridge hat sich beendet, bevor Zoom die Anmeldung beantwortet hat (exitCode=1). Details im Log.'],
    ['B7', KT.B7('7.1.6 (99999)'), 'Die Zoom-Laufzeit meldet die Fassung 7.1.6 (99999), erwartet ist 7.1.5 (43953). Bitte den SDK-Ordner erneut wählen.'],
    ['B8', KT.B8('SDKERR_UNINITIALIZE'), 'Das Zoom-SDK ließ sich nicht starten (SDKERR_UNINITIALIZE). Details im Log.'],
    ['B8_14', KT.B8_14, 'Auf diesem PC läuft schon ein anderes Programm mit dem Zoom-Meeting-SDK (zum Beispiel das Einsatzpaket „zoom-join“). Bitte es zuerst beenden.'],
    ['B9', KT.B9('AUTHRET_KEYORSECRETWRONG'), 'Zoom hat die Anmeldung abgelehnt: Client-ID oder Client-Secret stimmen nicht (AUTHRET_KEYORSECRETWRONG). Bitte die Zugangsdaten prüfen.'],
    ['B10', KT.B10, 'Zoom hat die Anmeldung abgelehnt: Das Anmelde-Token passt nicht (AUTHRET_JWTTOKENWRONG). Meist stimmen die Zugangsdaten nicht, oder die Uhr dieses PCs geht falsch.'],
    ['B11', KT.B11('AUTHRET_ACCOUNTNOTSUPPORT'), 'Das Zoom-Konto der App darf das Meeting-SDK nicht nutzen (AUTHRET_ACCOUNTNOTSUPPORT). Das klärt der Inhaber des Zoom-Kontos.'],
    ['B12', KT.B12('AUTHRET_NETWORKISSUE'), 'Zoom ist gerade nicht erreichbar (AUTHRET_NETWORKISSUE). Netzwerk prüfen und erneut versuchen.'],
    ['B13', KT.B13, 'Zoom lässt diese SDK-Fassung nicht mehr zu (AUTHRET_CLIENT_INCOMPATIBLE). Nötig ist ein neuer Connect-Release mit neuer SDK-Fassung.'],
    ['B14', KT.B14, 'Zu viele Anmeldungen in kurzer Zeit (AUTHRET_LIMIT_EXCEEDED_EXCEPTION). Einige Minuten warten.'],
    ['B15', KT.B15('AUTHRET_UNKNOWN'), 'Zoom hat die Anmeldung abgelehnt (AUTHRET_UNKNOWN).'],
    ['B16', KT.B16, 'Zoom hat auf die Anmeldung nicht geantwortet (30 s). Netzwerk prüfen und erneut versuchen.'],
    ['B17', KT.B17, 'Zugangsdaten fehlen — bitte eintragen oder die Datei wählen.'],
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
    ['R2', KT.R2('Zoom hat den Beitritt in 30 s weder bestätigt noch abgelehnt. Netzwerk prüfen und erneut versuchen.'),
      'Wiederbeitritt gescheitert (Zoom hat den Beitritt in 30 s weder bestätigt noch abgelehnt. Netzwerk prüfen und erneut versuchen). „Erneut beitreten“ versucht es noch einmal.'],
    ['R4', KT.R4('EXITED_UNEXPECTEDLY exitCode=3'), 'Die Zoom-Bridge ist abgestürzt (EXITED_UNEXPECTEDLY exitCode=3). Connect tritt neu bei.'],
    ['R5', KT.R5(2, 3), 'Wieder im Meeting. 2 Quellen neu geladen, 3 warten auf eine eindeutige Person.'],
    ['R7', KT.R7, 'Wiederbeitritt abgebrochen.'],
    ['PRUEFUNG_OK', KT.PRUEFUNG_OK, 'Einrichtung in Ordnung: Zoom-SDK 7.1.5 (43953), Anmeldung bei Zoom erfolgreich.'],
  ];
  for (const [id, ist, soll] of KT_SOLL) ck(`${id} wörtlich`, ist === soll);
  ck('Q9 beginnt mit dem geteilten Q9_ANFANG (zweiter Klick der Karte hängt daran)', KT.Q9(6).startsWith(Q9_ANFANG));
  ck('KT und die Tabelle haben dieselben Schlüssel (jeder Text genau einmal wörtlich geprüft)',
    JSON.stringify(Object.keys(KT).sort()) === JSON.stringify(KT_SOLL.map(([id]) => id).sort()));
  ck('S13: ⌈s/60⌉ Minuten, bei 1 die Einzahl (60 s → 1 Minute, 61 s → 2 Minuten, 600 s → 10), nie 0',
    KT.S13(60).includes(' in 1 Minute erneut') && KT.S13(61).includes(' in 2 Minuten erneut')
      && KT.S13(600).includes(' in 10 Minuten erneut') && KT.S13(0).includes(' in 1 Minute erneut'));
  ck('S11 und S17 kommen aus @shared/zoom-text (die Karte zeigt sie ohne klartext.ts)', KT.S11 === TEXT_S11 && KT.S17 === TEXT_S17);
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
    zugang_fehlt: [null, 'Zugangsdaten fehlen — bitte eintragen oder die Datei wählen.'],
    zugang_unlesbar: [null, 'Die hinterlegten Zugangsdaten lassen sich unter diesem Windows-Konto nicht entschlüsseln. Bitte die Zugangsdaten erneut eintragen oder die Datei erneut wählen.'],
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
  ck('audioQueueOverflow → Hinweis Q6 mit dropped, Logtext gleich (kein Name darin)',
    JSON.stringify(e('audioQueueOverflow', 'AUDIO_QUEUE_OVERFLOW', null, 37)) === JSON.stringify({
      art: 'hinweis', text: 'Ton: 37 Pakete verworfen — dieser PC kommt nicht hinterher.', logText: 'Ton: 37 Pakete verworfen — dieser PC kommt nicht hinterher.',
    }));
  ck('audioQueueOverflow ohne dropped → 0', e('audioQueueOverflow', 'AUDIO_QUEUE_OVERFLOW', null).art === 'hinweis' && JSON.stringify(e('audioQueueOverflow', 'AUDIO_QUEUE_OVERFLOW', null)).includes('Ton: 0 Pakete'));
  ck('videoBufferMismatch → Hinweis Q16 (keine Zeile), Logtext mit Kennung statt Name',
    JSON.stringify(quellenFehler('videoBufferMismatch', 'VIDEO_BUFFER_MISMATCH', 'Anna', undefined, 16778240)) === JSON.stringify({
      art: 'hinweis', text: KT.Q16('Anna'), logText: 'Bild: fehlerhafte Bilder von Teilnehmer 16778240 verworfen (videoBufferMismatch).',
    }));
  ck('audioBufferMismatch → Hinweis Q17 (keine Zeile), Logtext mit Kennung statt Name',
    JSON.stringify(quellenFehler('audioBufferMismatch', 'AUDIO_BUFFER_MISMATCH', 'Ben', undefined, 16778243)) === JSON.stringify({
      art: 'hinweis', text: KT.Q17('Ben'), logText: 'Ton: ein fehlerhaftes Paket von Teilnehmer 16778243 verworfen (audioBufferMismatch).',
    }));
  const ohneId = quellenFehler('videoBufferMismatch', 'VIDEO_BUFFER_MISMATCH', 'Anna');
  ck('Q16 ohne Kennung im Ereignis: Logtext „Teilnehmer unbekannt“, nie der Name',
    ohneId.art === 'hinweis' && ohneId.logText.includes('Teilnehmer unbekannt') && !ohneId.logText.includes('Anna'));
  ck('unbekannter Code → Zeile Q4 mit dem Namen', JSON.stringify(e('videoNeu', 'OWN_UNKNOWN(videoNeu)')) === JSON.stringify({ art: 'zeile', text: KT.Q4('OWN_UNKNOWN(videoNeu)') }));
  ck('Ton off/command (ohne Ton geladen) → kein Fehler', tonZustand('off', 'command').art === 'keine');
  ck('Ton off/audioUnavailable → Zeile Q5', JSON.stringify(tonZustand('off', 'audioUnavailable')) === JSON.stringify({ art: 'zeile', text: KT.Q5('audioUnavailable') }));
  ck('Ton off/participantLeft → kein Zeilenfehler', tonZustand('off', 'participantLeft').art === 'keine');
  ck('Ton live → kein Fehler', tonZustand('live', 'packets').art === 'keine');
}

console.log('— Owner 08.10.2026: Welche Zeilenfehler ein gescheitertes Laden genau dieser Person bedeuten (Stand „gescheitert“)');
{
  // Die Bridge lehnt das Abo der Person ab (video.cpp videoSubscribe, main.cpp; jeweils mit Kennung): Q4; dazu Q5,
  // falls ein Tonfehler je eine Kennung trüge, und jeder unbekannte Code (wie quellenFehler: Zeile Q4), etwa die beiden
  // Befehlsfeld-Fehler aus main.cpp (videoBadResolution, videoBadAudioFlag).
  const JA = ['videoRendererFailed', 'videoRawRecordingFailed', 'videoSenderFailed',
    'videoBadResolution', 'videoBadAudioFlag', 'videoNeu', 'audioVoipJoinFailed', 'audioHelperMissing', 'audioSubscribeFailed'];
  for (const code of JA) ck(`${code} → Ladefehler`, istLadeFehler(code) && quellenFehler(code, code, 'Anna', undefined, 16778240).art === 'zeile');
  // Q13 gilt dem Bild-Versatz aller Quellen, kein Laden; Q3, videoNotSubscribed und die Hinweise stehen an keiner Zeile.
  const NEIN = ['videoBadDelay', 'videoAlreadySubscribed', 'videoNotSubscribed', 'audioQueueOverflow', 'videoBufferMismatch', 'audioBufferMismatch'];
  for (const code of NEIN) ck(`${code} → kein Ladefehler`, !istLadeFehler(code));
  // Ruling 08.10.2026 (R1, R2): Q1 und Q2 stehen an der Zeile, sind aber kein Ladefehler, denn „von Hand laden“ brächte nichts.
  // Q2 („Diese Person ist nicht mehr im Meeting.“): Die Person ist weg, der Eintrag wartet auf sie. Q1 („Keine Aufnahme-Erlaubnis …“):
  // Der Eintrag wartet auf die Aufnahme-Erlaubnis (istErlaubnisFehler), auch wenn Connect sie noch als „ja“ führt.
  for (const code of ['videoNoPrivilege', 'videoUnknownParticipant']) {
    ck(`${code} → Zeile, aber kein Ladefehler (Ruling 08.10.2026)`,
      !istLadeFehler(code) && quellenFehler(code, code, 'Anna', undefined, 16778240).art === 'zeile');
  }
  ck('videoNoPrivilege (Q1) → Erlaubnisfehler (Ruling 08.10.2026)', istErlaubnisFehler('videoNoPrivilege'));
  const andere = [...JA, ...NEIN, 'videoUnknownParticipant'];
  const auchErlaubnis = andere.filter((code) => istErlaubnisFehler(code));
  if (auchErlaubnis.length > 0) console.log(`     (fälschlich Erlaubnisfehler: ${auchErlaubnis.join(', ')})`);
  ck(`jeder andere Code (${andere.length}, auch Q2) → kein Erlaubnisfehler`, andere.length === 16 && auchErlaubnis.length === 0);
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

console.log('— Zoom-SDK laden: Zeilen und Knöpfe (Spec SDK nachladen 4.4, 4.5)');
{
  const MiB = 1024 * 1024;
  const GESAMT = 150_120_193; // 143,2 MiB → 143
  type Laden = NonNullable<ZoomAbbild['einrichtung']['sdk']['laden']>;
  const ZEILE: Array<[Laden, string]> = [
    [{ phase: 'link', bytes: 0, bytesGesamt: GESAMT }, 'Zoom-SDK wird geladen …'],
    [{ phase: 'download', bytes: 63 * MiB, bytesGesamt: GESAMT }, 'Zoom-SDK wird geladen … 63 von 143 MB'],
    [{ phase: 'pruefen', bytes: GESAMT, bytesGesamt: GESAMT }, 'Zoom-SDK wird geprüft …'],
    [{ phase: 'entpacken', bytes: GESAMT, bytesGesamt: GESAMT }, 'Zoom-SDK wird entpackt …'],
  ];
  for (const [l, soll] of ZEILE) {
    ck(`Phase ${l.phase}: Zeile „${soll}“`, sdkLadenZeile(l) === soll);
    const a = abbild({
      kurz: { zustand: 'einrichtung', maengel: ['sdk_fehlt'], kopieLaeuft: true },
      einrichtung: { ...abbild().einrichtung, sdk: { stand: 'fehlt', fassung: null, kopie: null, laden: l, text: null } },
    });
    ck(`… Kopfzeile und Tray wie bei der Kopie, die Karte zeigt die Phase (${l.phase})`,
      zoomZ(a.kurz) === 'Z1b' && zoomZeile(a.kurz) === '◌ Zoom: Einrichtung läuft' && kartenZeile(a, JETZT) === soll
        && stateKvAus(a.kurz)?.zoom_status === 'einrichtung');
  }

  const SCHLUESSEL: Record<ProxyKeySource, string> = {
    stored: 'SDK-Schlüssel: hinterlegt',
    session: 'SDK-Schlüssel: hinterlegt (nur für diese Sitzung)',
    env: 'SDK-Schlüssel: aus der Umgebung',
    none: 'SDK-Schlüssel: fehlt',
  };
  for (const h of Object.keys(SCHLUESSEL) as ProxyKeySource[]) {
    const a = abbild({ einrichtung: { ...abbild().einrichtung, sdkSchluessel: { herkunft: h } } });
    ck(`SDK-Schlüssel, Herkunft ${h}: Zeile wörtlich`, sdkSchluesselZeile(a) === SCHLUESSEL[h]);
    ck(`… „Entfernen“ ${h === 'stored' || h === 'session' ? 'da' : 'fehlt'}`,
      zoomKnoepfe(a).sdkSchluesselEntfernbar === (h === 'stored' || h === 'session'));
  }

  const mit = (herkunft: ProxyKeySource, kz: Partial<ZoomKurz> = {}, extra: Omit<Partial<ZoomAbbild>, 'kurz'> = {}): ZoomAbbild =>
    abbild({ ...extra, kurz: kz, einrichtung: { ...abbild().einrichtung, sdkSchluessel: { herkunft } } });
  ck('Z2 mit Schlüssel: „Zoom-SDK laden“ frei', zoomKnoepfe(mit('stored')).sdkLaden === 'frei');
  ck('Z1a mit Schlüssel aus der Umgebung: frei', zoomKnoepfe(mit('env', { zustand: 'einrichtung', maengel: ['sdk_fehlt'] })).sdkLaden === 'frei');
  ck('ohne Schlüssel: gesperrt mit S11', zoomKnoepfe(mit('none', { zustand: 'einrichtung', maengel: ['sdk_fehlt'] })).sdkLaden === 'ohneSchluessel');
  ck('während Kopie oder Laden (Z1b): gesperrt wie die Ordnerwahl (S10)',
    zoomKnoepfe(mit('stored', { zustand: 'einrichtung', maengel: ['sdk_fehlt'], kopieLaeuft: true })).sdkLaden === 'gesperrt');
  ck('während „Einrichtung prüfen“: gesperrt (S10)', zoomKnoepfe(mit('stored', {}, { pruefungLaeuft: true })).sdkLaden === 'gesperrt');
  ck('im Meeting: gesperrt (S10), auch ohne Schlüssel geht S10 vor', zoomKnoepfe(mit('none', { zustand: 'im_meeting', erlaubnis: 'ja' })).sdkLaden === 'gesperrt');
  const laufend = abbild({
    kurz: { zustand: 'einrichtung', maengel: ['sdk_fehlt'], kopieLaeuft: true },
    einrichtung: { ...abbild().einrichtung, sdk: { stand: 'fehlt', fassung: null, kopie: null, laden: { phase: 'download', bytes: 1, bytesGesamt: 2 }, text: null } },
  });
  ck('„Abbrechen“ nur, solange geladen wird (nicht während der Kopie)', zoomKnoepfe(laufend).sdkLadenAbbrechen
    && !zoomKnoepfe(lage('Z1b', 0, 0)).sdkLadenAbbrechen && !zoomKnoepfe(abbild()).sdkLadenAbbrechen);

  // Karte (Aufgabe 9): Balken und Farbe des Einrichtungstexts sind reine Ableitungen.
  const sdkMit = (kopie: ZoomAbbild['einrichtung']['sdk']['kopie'], laden: Laden | null): ZoomAbbild['einrichtung']['sdk'] =>
    ({ ...abbild().einrichtung.sdk, kopie, laden });
  ck('Balken beim Download: 63 von 143 MB → 44 %', sdkBalken(sdkMit(null, { phase: 'download', bytes: 63 * MiB, bytesGesamt: GESAMT })) === 44);
  ck('… kein Balken bei Link, Prüfen und Entpacken, und ohne Laden und Kopie',
    (['link', 'pruefen', 'entpacken'] as const).every((phase) => sdkBalken(sdkMit(null, { phase, bytes: GESAMT, bytesGesamt: GESAMT })) === null)
      && sdkBalken(sdkMit(null, null)) === null);
  ck('… während der Kopie der Kopierfortschritt wie bisher (32 %), Gesamt 0 → 0 %',
    sdkBalken(sdkMit({ dateien: 40, dateienGesamt: 153, bytes: 105_500_000, bytesGesamt: 329_657_415 }, null)) === 32
      && sdkBalken(sdkMit({ dateien: 0, dateienGesamt: 0, bytes: 0, bytesGesamt: 0 }, null)) === 0);
  ck('S17 ist ein Hinweis (grau), S10, S11, S12, S16b und S5 sind Fehler (rot)',
    einrichtungsTextArt(TEXT_S17) === 'hinweis'
      && [KT.S10, TEXT_S11, KT.S12, KT.S16b, KT.S5(872, 871)].every((t) => einrichtungsTextArt(t) === 'fehler'));
}

// ── Aufgabe 4 (4b): zoom_cmd, Entzug, Grenze, Bild/Ton im Klartext, Versatz, Sperre im Abbau ──
console.log('— 4b: Konstanten in den Statustexten (N4b.3 Nr. 8, L16)');
{
  ck('BETRIEBSGROESSE = 5, WIEDERBEITRITT_VERSUCHE = 5', BETRIEBSGROESSE === 5 && WIEDERBEITRITT_VERSUCHE === 5);
  ck('Z11 (Tray) nennt „von WIEDERBEITRITT_VERSUCHE“',
    zoomZeile(kurz({ zustand: 'abriss', versuch: 3 })) === `△ Zoom: Verbindung verloren, Wiederbeitritt 3 von ${WIEDERBEITRITT_VERSUCHE}`);
  const z11 = abbild({ kurz: { zustand: 'abriss', versuch: 3 }, abriss: { versuch: 3, versuche: WIEDERBEITRITT_VERSUCHE, naechsterUm: null } });
  ck('Z11 (Karte) nennt „von WIEDERBEITRITT_VERSUCHE“',
    kartenZeile(z11, JETZT) === `Verbindung zum Meeting verloren. Wiederbeitritt 3 von ${WIEDERBEITRITT_VERSUCHE} läuft …`);
  ck('Q9_ANFANG nennt BETRIEBSGROESSE', Q9_ANFANG === `Mehr als ${BETRIEBSGROESSE} Zoom-Quellen sind nicht gemessen.`);
  const quelle = readFileSync(new URL('../src/shared/zoom-text.ts', import.meta.url), 'utf8');
  ck('Quelltext-Wächter: zoom-text.ts schreibt „von 5“ und „Mehr als 5“ nicht als Literal',
    !quelle.includes('von 5') && !quelle.includes('Mehr als 5'));
  // N4b.3 Nr. 8 „Fassung aus den Konstanten“: Das Abbild trägt sie schon (kern.ts: fassung = SDK_FASSUNG bei stand 'ok').
  const sdk = abbild().einrichtung.sdk;
  ck('sdkZeile nennt die Fassung aus dem Abbild', sdkZeile(abbild({ einrichtung: { ...abbild().einrichtung, sdk: { ...sdk, fassung: '9.9.9.1' } } }))
    === 'Zoom-SDK 9.9.9.1 eingerichtet');
  ck('… ohne Fassung im Abbild: „Zoom-SDK eingerichtet“', sdkZeile(abbild({ einrichtung: { ...abbild().einrichtung, sdk: { ...sdk, fassung: null } } }))
    === 'Zoom-SDK eingerichtet');
  ck('Quelltext-Wächter: zoom-text.ts schreibt die SDK-Fassung nicht als Literal', !quelle.includes('7.1.5'));
}

console.log('— 4b: Z7/Z7b beim Entzug (N4b.1, Texttabelle 4b)');
{
  const z7 = (e: ZoomErlaubnis, n: number, o = 0): ZoomAbbild =>
    abbild({ kurz: { zustand: 'im_meeting', erlaubnis: e, quellen: n, ohneBild: 0, sollOffen: o } });
  ck('Z7 entzogen mit gemerkten Quellen (o = 2): Tray/Kopfzeile wörtlich',
    zoomZeile(z7('entzogen', 0, 2).kurz) === '△ Zoom: Aufnahme-Erlaubnis vom Host entzogen, Quellen gestoppt');
  ck('Z7 entzogen mit gemerkten Quellen (o = 2): Karte wörtlich', kartenZeile(z7('entzogen', 0, 2), JETZT)
    === 'Aufnahme-Erlaubnis vom Host entzogen, Quellen gestoppt. Erteilt der Host sie im Zoom-Client wieder, lädt Connect die gemerkten Quellen von selbst.');
  ck('Z7 entzogen ohne gemerkte Quelle (o = 0): kein „Quellen gestoppt“, Tray und Karte wie vor 4b (Spec 7: jeder Text wahr)',
    zoomZeile(z7('entzogen', 0).kurz) === '△ Zoom: im Meeting ohne Aufnahme-Erlaubnis'
      && kartenZeile(z7('entzogen', 0), JETZT)
        === 'Im Meeting ohne Aufnahme-Erlaubnis. Der Host hat sie entzogen. Der Host kann sie im Zoom-Client jederzeit erteilen; Connect merkt das von selbst.');
  ck('Z7b entzogen, n = 1: Karte im Singular', kartenZeile(z7('entzogen', 1), JETZT) === 'Aufnahme-Erlaubnis vom Host entzogen. Connect stoppt 1 Quelle …');
  ck('Z7b entzogen, n = 2: Karte wörtlich', kartenZeile(z7('entzogen', 2), JETZT) === 'Aufnahme-Erlaubnis vom Host entzogen. Connect stoppt 2 Quellen …');
  ck('Z7b entzogen: Tray bleibt „{n} Quellen, Aufnahme-Erlaubnis fehlt“',
    zoomZeile(z7('entzogen', 1).kurz) === '△ Zoom: 1 Quelle, Aufnahme-Erlaubnis fehlt'
      && zoomZeile(z7('entzogen', 2).kurz) === '△ Zoom: 2 Quellen, Aufnahme-Erlaubnis fehlt');
  ck('Z7 abgelehnt und abgelaufen: Tray unverändert',
    zoomZeile(z7('abgelehnt', 0).kurz) === '△ Zoom: im Meeting ohne Aufnahme-Erlaubnis'
      && zoomZeile(z7('abgelaufen', 0).kurz) === '△ Zoom: im Meeting ohne Aufnahme-Erlaubnis');
  ck('Z7b abgelehnt, n = 1: Karte unverändert', kartenZeile(z7('abgelehnt', 1), JETZT)
    === 'Die Aufnahme-Erlaubnis fehlt (vom Host abgelehnt). 1 Quelle besteht noch. Der Host kann sie im Zoom-Client erteilen.');
  ck('Z7b abgelaufen, n = 2: Karte unverändert', kartenZeile(z7('abgelaufen', 2), JETZT)
    === 'Die Aufnahme-Erlaubnis fehlt (keine Antwort bekommen). 2 Quellen bestehen noch. Der Host kann sie im Zoom-Client erteilen.');
  ck('Z7b offen, n = 2: Karte unverändert', kartenZeile(z7('offen', 2), JETZT)
    === 'Die Aufnahme-Erlaubnis fehlt (angefragt, noch keine Antwort). 2 Quellen bestehen noch. Der Host kann sie im Zoom-Client erteilen.');
}

console.log('— 4b: 7.5 zoom_cmd und zoom_cmd_rejected (8.6, 11.2), in jedem Zustand gleich');
{
  const BEFEHLE: Array<[ZoomBefehlErgebnis | null, string, 0 | 1]> = [
    [null, '', 0],
    [{ kennung: 'f3', abgelehnt: true }, 'f3', 1],
    [{ kennung: 'f8', abgelehnt: false }, 'f8', 0],
    [{ kennung: 'ok', abgelehnt: false }, 'ok', 0],
  ];
  for (const z of Object.keys(T75) as Array<Exclude<ZoomZ, 'Z0'>>) {
    const [n, k] = T72[z].nk[0];
    for (const [befehl, cmd, abgelehnt] of BEFEHLE) {
      const kv = stateKvAus({ ...lage(z, n, k).kurz, befehl });
      ck(`${z}, befehl ${befehl ? `${befehl.kennung}/${befehl.abgelehnt}` : 'null'}: zoom_cmd=„${cmd}“, zoom_cmd_rejected=${abgelehnt}`,
        kv !== null && kv.zoom_cmd === cmd && kv.zoom_cmd_rejected === abgelehnt);
    }
  }
  ck('Z0 (macOS) mit Befehl: weiterhin keine zoom_*-Schlüssel',
    stateKvAus({ ...lage('Z0', 0, 0).kurz, befehl: { kennung: 'ok', abgelehnt: false } }) === null);
}

console.log('— 4b: Gemerkte Quellen (Spec 9 Punkt 9, Stand grenze)');
{
  const e = (stand: ZoomSollEintrag['stand']): ZoomSollEintrag => ({
    name: 'Anna Maria', ton: true, ndiName: 'JM Connect – Zoom Anna Maria', stand, aboId: stand === 'verwaist' ? 16778240 : null, doppelname: false,
  });
  const SOLL: Record<ZoomSollEintrag['stand'], string> = {
    wartet: 'Anna Maria — wartet auf die Person',
    // Fix-Welle 4b (Gesamtprüfung, „Statuszeile lügt“): die Person ist da, es fehlt die Erlaubnis bzw. die Antwort der Bridge.
    erlaubnis: 'Anna Maria — wartet auf die Aufnahme-Erlaubnis',
    laedt: 'Anna Maria — wird geladen …',
    // Owner 08.10.2026: Connect selbst ist nicht im Meeting (Z10, Z11, fehler, „Erneut beitreten“); Vorrang vor allen außer verwaist.
    wiederbeitritt: 'Anna Maria — wartet auf den Wiederbeitritt',
    // Owner 08.10.2026: Die Person ist eindeutig da, ihr Abo blieb ohne Antwort (Q8) bzw. die Bridge lehnte es ab (Zeilenfehler).
    keineAntwort: 'Anna Maria — keine Antwort der Zoom-Bridge, bitte von Hand laden',
    gescheitert: 'Anna Maria — Laden gescheitert, bitte von Hand laden',
    doppelname: 'Anna Maria — Name doppelt, bitte von Hand laden',
    verwaist: 'Anna Maria — Person weg, Quelle schwarz',
    grenze: 'Anna Maria — nicht automatisch geladen (mehr als 5 Zoom-Quellen), bitte von Hand laden',
  };
  ck('ZoomSollEintrag kennt neun Stände', Object.keys(SOLL).length === 9);
  for (const s of Object.keys(SOLL) as Array<ZoomSollEintrag['stand']>) ck(`sollZeile ${s} wörtlich`, sollZeile(e(s)) === SOLL[s]);
}

console.log('— Ruling 08.10.2026 (R3): Farbe der gemerkten Quellen, „keine Antwort …“ und „Laden gescheitert …“ gelb wie grenze');
{
  const e = (stand: ZoomSollEintrag['stand'], doppelname = false): ZoomSollEintrag => ({
    name: 'Anna', ton: true, ndiName: 'JM Connect – Zoom Anna', stand, aboId: stand === 'verwaist' ? 16778240 : null, doppelname,
  });
  // Die drei Stände „…, bitte von Hand laden“ ohne Doppelnamen stehen gelb (grenze seit 4b, keineAntwort und gescheitert seit R3);
  // doppelname rot; verwaist rot nur mit Doppelname (Q11); der Rest grau. Der Record fängt einen neuen Stand im Typcheck.
  const FARBE: Record<ZoomSollEintrag['stand'], 'rot' | 'gelb' | 'grau'> = {
    wartet: 'grau', erlaubnis: 'grau', laedt: 'grau', wiederbeitritt: 'grau', keineAntwort: 'gelb', gescheitert: 'gelb',
    doppelname: 'rot', verwaist: 'grau', grenze: 'gelb',
  };
  const STAENDE = Object.keys(FARBE) as Array<ZoomSollEintrag['stand']>;
  for (const s of STAENDE) ck(`sollFarbe ${s}: ${FARBE[s]}`, sollFarbe(e(s)) === FARBE[s]);
  ck('sollFarbe verwaist mit Doppelname: rot (Q11)', sollFarbe(e('verwaist', true)) === 'rot');
  const anders = STAENDE.filter((s) => s !== 'verwaist' && sollFarbe(e(s, true)) !== FARBE[s]);
  if (anders.length > 0) console.log(`     (mit Doppelname-Markierung anders: ${anders.join(', ')})`);
  ck('… die Doppelname-Markierung ändert die Farbe der übrigen acht Stände nicht', STAENDE.length === 9 && anders.length === 0);
}

console.log('— 4b: Bild und Ton der Quelle im Klartext (Spec 9 Punkt 8, N4b.3 Nr. 8 „Rohwerte“)');
{
  const SCHWARZ: Record<VideoReason, string> = {
    command: 'Bild schwarz: kein Bild von Zoom',
    frames: 'Bild schwarz: kein Bild von Zoom',
    cameraOff: 'Bild schwarz: Kamera aus',
    participantLeft: 'Bild schwarz: Person weg',
    rebound: 'Bild schwarz: kein Bild von Zoom',
    bufferMismatch: 'Bild schwarz: fehlerhafte Bilder',
    meetingEnded: 'Bild schwarz: kein Bild von Zoom',
    reboundByName: 'Bild schwarz: kein Bild von Zoom',
    privilegeRevoked: 'Bild schwarz: kein Bild von Zoom',
  };
  ck('VideoReason hat 9 Werte (mit privilegeRevoked)', Object.keys(SCHWARZ).length === 9);
  for (const g of Object.keys(SCHWARZ) as VideoReason[]) ck(`bildText black/${g}`, bildText('black', g) === SCHWARZ[g]);
  ck('bildText subscribed: „Bild: erstes Bild steht aus“', bildText('subscribed', 'command') === 'Bild: erstes Bild steht aus');
  ck('bildText live: „Bild läuft“, der Grund zählt nicht', bildText('live', 'frames') === 'Bild läuft' && bildText('live', 'rebound') === 'Bild läuft');
  const AUS: Record<AudioReason, string> = {
    command: 'Ton aus',
    audioUnavailable: 'Ton nicht verfügbar',
    packets: 'Ton aus',
    gap: 'Ton aus',
    participantLeft: 'Ton aus: Person weg',
    meetingEnded: 'Ton aus',
    rebound: 'Ton aus',
    reboundByName: 'Ton aus',
    privilegeRevoked: 'Ton aus',
  };
  ck('AudioReason hat 9 Werte (mit privilegeRevoked)', Object.keys(AUS).length === 9);
  for (const g of Object.keys(AUS) as AudioReason[]) ck(`tonText off/${g}`, tonText('off', g) === AUS[g]);
  ck('tonText off ohne Grund: „Ton aus“', tonText('off', null) === 'Ton aus');
  ck('tonText aus (ohne Ton geladen): „ohne Ton“', tonText('aus', null) === 'ohne Ton' && tonText('aus', 'command') === 'ohne Ton');
  ck('tonText waiting: „Ton: wartet auf das erste Paket“', tonText('waiting', 'command') === 'Ton: wartet auf das erste Paket');
  ck('tonText live: „Ton läuft“', tonText('live', 'packets') === 'Ton läuft');
  ck('tonText silent: „Ton: Stille“', tonText('silent', 'gap') === 'Ton: Stille');
  const q: ZoomQuelle = {
    aboId: 16778240, ndiName: 'JM Connect – Zoom Anna', bild: 'black', bildGrund: 'cameraOff', ton: 'off', tonGrund: 'audioUnavailable', fehler: null,
  };
  ck('quellenZustandText: „Bild … · Ton …“', quellenZustandText(q) === 'Bild schwarz: Kamera aus · Ton nicht verfügbar');
  ck('quellenZustandText: frisch ohne Ton geladen',
    quellenZustandText({ ...q, bild: 'subscribed', bildGrund: 'command', ton: 'aus', tonGrund: null }) === 'Bild: erstes Bild steht aus · ohne Ton');
}

console.log('— 4b: Versatz-Zeile (Spec 9 Punkt 7, N4b.3 Nr. 4, L14)');
{
  const v = (bestaetigtMs: number | null, nurSitzung: boolean): ZoomAbbild => abbild({ versatz: { gewuenschtMs: 250, bestaetigtMs, nurSitzung } });
  ck('bestätigt 250 ms', JSON.stringify(versatzZeile(v(250, false))) === JSON.stringify(['bestätigt: 250 ms']));
  ck('bestätigt 0 ms (0 ist ein Wert, kein „fehlt“)', JSON.stringify(versatzZeile(v(0, false))) === JSON.stringify(['bestätigt: 0 ms']));
  ck('ohne Sitzung: „gilt ab dem nächsten Beitritt“', JSON.stringify(versatzZeile(v(null, false))) === JSON.stringify(['gilt ab dem nächsten Beitritt']));
  ck('nur für diese Sitzung: zweite Zeile TEXT_A4_SCHREIBFEHLER',
    JSON.stringify(versatzZeile(v(250, true))) === JSON.stringify(['bestätigt: 250 ms', TEXT_A4_SCHREIBFEHLER]));
  ck('… auch ohne Meeting', JSON.stringify(versatzZeile(v(null, true))) === JSON.stringify(['gilt ab dem nächsten Beitritt', TEXT_A4_SCHREIBFEHLER]));
  // Die Karte übernimmt den Wert bei „ok“ und bei „nur für diese Sitzung“ (L14); jede andere Antwort ist ein Fehler am Feld.
  ck('versatzUebernommen: ok und TEXT_A4_SCHREIBFEHLER gelten, jede andere Antwort nicht',
    versatzUebernommen({ ok: true }) && versatzUebernommen({ ok: false, text: TEXT_A4_SCHREIBFEHLER })
      && !versatzUebernommen({ ok: false, text: 'Bild-Versatz: ganze Zahl von 0 bis 1000 ms.' }) && !versatzUebernommen({ ok: false, text: '' }));
}

console.log('— 4b: Sperre S10 auch während des Abbaus (L13)');
{
  const z2 = abbild({ abbauLaeuft: true, erneutMoeglich: true, meldung: { art: 'warnung', text: 'Meeting beendet: vom Gastgeber beendet.', detail: null } });
  ck('Z2 mit abbauLaeuft: Einrichtung gesperrt, „Zoom-SDK laden“ gesperrt',
    !zoomKnoepfe(z2).einrichtungAenderbar && zoomKnoepfe(z2).sdkLaden === 'gesperrt');
  const z13 = abbild({
    kurz: { zustand: 'fehler' }, abbauLaeuft: true, erneutMoeglich: true, meldung: { art: 'fehler', text: 'Wiederbeitritt abgebrochen.', detail: null },
  });
  ck('Z13 mit abbauLaeuft: Einrichtung gesperrt, „Erneut beitreten“ bleibt',
    !zoomKnoepfe(z13).einrichtungAenderbar && zoomKnoepfe(z13).meldung?.erneut === true);
  ck('Z1a mit abbauLaeuft: Einrichtung gesperrt',
    !zoomKnoepfe(abbild({ kurz: { zustand: 'einrichtung', maengel: ['zugang_fehlt'] }, abbauLaeuft: true })).einrichtungAenderbar);
  ck('ohne Abbau: Z2 und Z13 wie bisher änderbar', zoomKnoepfe(abbild()).einrichtungAenderbar && zoomKnoepfe({ ...z13, abbauLaeuft: false }).einrichtungAenderbar);
}

// ── Aufgabe 5 (4b): Konstanten, Wiederbeitritt, Einordnung, Fernsteuer-Hinweise, Logtexte ohne Namen ──
console.log('— 4b: fristen.ts (Spec 5.2, G3) und die Weitergabe über kern.ts');
{
  ck('ZOOM_FRISTEN wie Spec 5.2', JSON.stringify(fristen.ZOOM_FRISTEN) === JSON.stringify({
    anmeldeMs: 30_000, joinTimeoutMs: 30_000, killTimeoutMs: 12_000, abgleichMs: 300, aboAntwortMs: 10_000, abbildTaktMs: 100, unsubscribeWarteMs: 2_000,
  }));
  ck('WIEDERBEITRITT_PLAN_S = 2, 5, 10, 20, 30 (eine Wartezeit je Versuch)',
    JSON.stringify(fristen.WIEDERBEITRITT_PLAN_S) === '[2,5,10,20,30]' && fristen.WIEDERBEITRITT_PLAN_S.length === WIEDERBEITRITT_VERSUCHE);
  ck('übrige Konstanten wie bisher', fristen.BEENDEN_FRIST_MS === 15_000 && fristen.JWT_GUELTIG_S === 43_200 && fristen.AUFLOESUNG === '720p'
    && fristen.HINWEISE_MAX === 5 && fristen.ANZEIGENAME_VORGABE === 'JM Connect');
  ck('fristen.ts reicht BETRIEBSGROESSE aus shared/zoom-text weiter (L16)', fristen.BETRIEBSGROESSE === BETRIEBSGROESSE);
  const kern = await import('../src/main/zoom/kern');
  ck('kern.ts reicht dieselben Konstanten weiter (zoom.ts, index.ts, settings.ts und die Tests importieren von dort)',
    kern.ZOOM_FRISTEN === fristen.ZOOM_FRISTEN && kern.WIEDERBEITRITT_PLAN_S === fristen.WIEDERBEITRITT_PLAN_S
      && kern.BEENDEN_FRIST_MS === fristen.BEENDEN_FRIST_MS && kern.JWT_GUELTIG_S === fristen.JWT_GUELTIG_S
      && kern.BETRIEBSGROESSE === BETRIEBSGROESSE && kern.AUFLOESUNG === fristen.AUFLOESUNG
      && kern.HINWEISE_MAX === fristen.HINWEISE_MAX && kern.ANZEIGENAME_VORGABE === fristen.ANZEIGENAME_VORGABE);
}

console.log('— 4b: Klartexte aus Konstanten statt Literal (N4b.3 Nr. 8)');
{
  const f = fristen.ZOOM_FRISTEN;
  ck('S3 nennt SDK_FASSUNG', KT.S3('7.1.6.1')
    === `Dieses Zoom-SDK hat die Fassung 7.1.6.1. Diese Connect-Fassung braucht genau ${SDK_FASSUNG}. Für eine andere SDK-Fassung braucht es einen neuen Connect-Release.`);
  ck('S15 nennt SDK_FASSUNG', KT.S15 === `Auf dem Proxy liegt kein passendes Zoom-SDK ${SDK_FASSUNG}. Bitte den SDK-Ordner von Hand wählen.`);
  ck('B7 nennt SDK_FASSUNG_BRIDGE', KT.B7('x') === `Die Zoom-Laufzeit meldet die Fassung x, erwartet ist ${SDK_FASSUNG_BRIDGE}. Bitte den SDK-Ordner erneut wählen.`);
  ck('PRUEFUNG_OK nennt SDK_FASSUNG_BRIDGE', KT.PRUEFUNG_OK === `Einrichtung in Ordnung: Zoom-SDK ${SDK_FASSUNG_BRIDGE}, Anmeldung bei Zoom erfolgreich.`);
  ck('B16 nennt anmeldeMs in Sekunden', KT.B16 === `Zoom hat auf die Anmeldung nicht geantwortet (${f.anmeldeMs / 1000} s). Netzwerk prüfen und erneut versuchen.`);
  ck('CT nennt joinTimeoutMs in Sekunden', KT.CT === `Zoom hat den Beitritt in ${f.joinTimeoutMs / 1000} s weder bestätigt noch abgelehnt. Netzwerk prüfen und erneut versuchen.`);
  ck('CE nennt joinTimeoutMs in Sekunden (derselbe Wachhund der Bridge)',
    KT.CE === `Der Host hat zugelassen, aber Zoom hat den Einlass in ${f.joinTimeoutMs / 1000} s nicht abgeschlossen. Netzwerk prüfen und erneut beitreten.`);
  ck('Q9 nennt BETRIEBSGROESSE', KT.Q9(6) === `Mehr als ${BETRIEBSGROESSE} Zoom-Quellen sind nicht gemessen. Noch einmal klicken, um die 6. Quelle trotzdem zu laden.`);
  const quelle = readFileSync(new URL('../src/main/zoom/klartext.ts', import.meta.url), 'utf8');
  ck('Quelltext-Wächter: klartext.ts schreibt die SDK-Fassung nicht als Literal', !quelle.includes('7.1.5'));
  ck('Quelltext-Wächter: B16, CT und CE schreiben „30 s“ nicht als Literal',
    !quelle.includes('nicht geantwortet (30 s)') && !quelle.includes('Beitritt in 30 s') && !quelle.includes('Einlass in 30 s'));
}

console.log('— 4b: 8.5 Wiederbeitritt (R2, R4, R5, R7) und Vorsatz 8.3');
{
  ck('R2: der Schlusspunkt des letzten Grunds fällt weg', KT.R2('Das Meeting ist voll.')
    === 'Wiederbeitritt gescheitert (Das Meeting ist voll). „Erneut beitreten“ versucht es noch einmal.');
  ck('R2: ein Grund ohne Schlusspunkt bleibt, wie er ist', KT.R2('Wiederverbinden fehlgeschlagen (Code 2)')
    === 'Wiederbeitritt gescheitert (Wiederverbinden fehlgeschlagen (Code 2)). „Erneut beitreten“ versucht es noch einmal.');
  ck('R2 mit Csonst als letztem Grund: kein „.)“', KT.R2(failText(11, 'JM Connect'))
    === 'Wiederbeitritt gescheitert (kein Medienserver gefunden (Code 11)). „Erneut beitreten“ versucht es noch einmal.');
  ck('R4 wörtlich', KT.R4('EXITED_UNEXPECTEDLY exitCode=3') === 'Die Zoom-Bridge ist abgestürzt (EXITED_UNEXPECTEDLY exitCode=3). Connect tritt neu bei.');
  ck('R5 (0, 0)', KT.R5(0, 0) === 'Wieder im Meeting. 0 Quellen neu geladen, 0 warten auf eine eindeutige Person.');
  ck('R5 (1, 1) im Singular (L3)', KT.R5(1, 1) === 'Wieder im Meeting. 1 Quelle neu geladen, 1 wartet auf eine eindeutige Person.');
  ck('R5 (2, 3, 1) mit Grenze', KT.R5(2, 3, 1) === 'Wieder im Meeting. 2 Quellen neu geladen, 3 warten auf eine eindeutige Person, 1 über der Grenze von 5 nicht geladen.');
  ck('R7 wörtlich', KT.R7 === 'Wiederbeitritt abgebrochen.');
  const C63 = 'Das Meeting gehört nicht zum Zoom-Konto dieser App. JM Connect kann nur Meetings im eigenen Zoom-Konto betreten. Bitte das Meeting im eigenen Konto anlegen.';
  ck('Vorsatz „Wiederbeitritt abgebrochen: “ + C63 als ganzer Text', failMeldung(VORSATZ.wiederbeitritt, 63, 'JM Connect').text === `Wiederbeitritt abgebrochen: ${C63}`);
  ck('Vorsatz „Wiederbeitritt abgebrochen: “ + Csonst als ganzer Text',
    failMeldung(VORSATZ.wiederbeitritt, 11, 'JM Connect').text === 'Wiederbeitritt abgebrochen: kein Medienserver gefunden (Code 11).');
}

console.log('— 4b: Einordnung 6.4 (istEndgueltig: Tabelle und L5)');
{
  // Spec 6.4 wörtlich abgeschrieben, NICHT aus ENDGUELTIGE_FAIL_CODES abgeleitet (sonst prüfte der Test sich selbst).
  const ENDGUELTIG = [4, 6, 7, 8, 9, 10, 12, 13, 14, 16, 23, 60, 61, 62, 63, 64, 82, 88, 89, 500, 501, 502, 503, 504, 505, 506];
  for (const code of ENDGUELTIG) ck(`failed ${code}: endgültig`, istEndgueltig({ art: 'failed', code }));
  ck('ENDGUELTIGE_FAIL_CODES hat genau diese 26 Codes', ENDGUELTIGE_FAIL_CODES.size === 26 && ENDGUELTIG.every((c) => ENDGUELTIGE_FAIL_CODES.has(c)));
  for (const code of [1, 2, 3, 5, 11, 15, 0xffff, 4242]) ck(`failed ${code}: vorübergehend`, !istEndgueltig({ art: 'failed', code }));
  for (const code of [6, 8, 9]) ck(`auth ${code}: vorübergehend`, !istEndgueltig({ art: 'auth', code }));
  for (const code of [1, 2, 3, 10, 12]) ck(`auth ${code}: endgültig`, istEndgueltig({ art: 'auth', code }));
  ck('ended: endgültig', istEndgueltig({ art: 'ended' }));
  for (const exitCode of [0xc0000135, 0xc0000139, 0xc000007b]) {
    ck(`exited 0x${exitCode.toString(16).toUpperCase()}: endgültig (DLL-Tod, B3–B5)`, istEndgueltig({ art: 'exited', exitCode }));
  }
  ck('exited 5 und exited ohne Rückgabewert: vorübergehend', !istEndgueltig({ art: 'exited', exitCode: 5 }) && !istEndgueltig({ art: 'exited', exitCode: null }));
  const VORUEBERGEHEND: VersuchsAusgang[] = [{ art: 'joinTimeout' }, { art: 'reconnectTimeout' }, { art: 'keineAuthAntwort' }];
  for (const a of VORUEBERGEHEND) ck(`${a.art}: vorübergehend`, !istEndgueltig(a));
  const ENDGUELTIG_SONST: VersuchsAusgang[] = [
    { art: 'init' }, { art: 'joinFehler' }, { art: 'ndi' }, { art: 'sdkFassung' }, { art: 'spawn' }, { art: 'zugang' }, { art: 'authSofort' },
  ];
  for (const a of ENDGUELTIG_SONST) ck(`${a.art}: endgültig`, istEndgueltig(a));
}

console.log('— 4b: 8.6 Fernsteuer-Hinweise (Vorsatz „Companion: “) und Logtext ohne Namen');
{
  const FT_SOLL: Array<[string, string, string]> = [
    ['F1', FT.F1, 'Companion: kein Anzeigename angegeben.'],
    ['F2', FT.F2('Anna Maria Beispiel'), 'Companion: niemand namens „Anna Maria Beispiel“ im Meeting.'],
    ['F3', FT.F3('Anna', 2), 'Companion: „Anna“ ist nicht eindeutig (2 Personen) — bitte in Connect von Hand laden.'],
    ['F4 nicht im Meeting', FT.F4('nicht im Meeting'), 'Companion: Laden nicht möglich — nicht im Meeting.'],
    ['F4 keine Erlaubnis', FT.F4('keine Aufnahme-Erlaubnis'), 'Companion: Laden nicht möglich — keine Aufnahme-Erlaubnis.'],
    ['F4 Warteraum', FT.F4('die Person ist im Warteraum'), 'Companion: Laden nicht möglich — die Person ist im Warteraum.'],
    ['F5', FT.F5('Ben'), 'Companion: keine geladene Quelle „Ben“.'],
    ['F6', FT.F6('1,5'), 'Companion: Versatz „1,5“ ungültig — erlaubt sind ganze Zahlen von 0 bis 1000.'],
    ['F7', FT.F7('zoom_xyz'), 'Companion: unbekannter Befehl „zoom_xyz“.'],
    ['F8', FT.F8(6), 'Companion: 6. Quelle geladen — mehr als 5 sind nicht gemessen.'],
  ];
  for (const [id, ist, soll] of FT_SOLL) ck(`${id} wörtlich`, ist === soll);
  ck('FT hat genau F1 bis F8 und (Plan B, Task B5) F5_SLOT, F8_SLOT, F9 bis F14',
    JSON.stringify(Object.keys(FT).sort()) === '["F1","F10","F11","F12","F13","F14","F2","F3","F4","F5","F5_SLOT","F6","F7","F8","F8_SLOT","F9"]');
  ck('F8 nennt BETRIEBSGROESSE', FT.F8(7) === `Companion: 7. Quelle geladen — mehr als ${BETRIEBSGROESSE} sind nicht gemessen.`);
  ck('fernLogText: Kennung groß, Verb in Klammern',
    fernLogText('f3', 'zoom_load') === 'Companion: F3 (zoom_load)' && fernLogText('ok', 'zoom_delay') === 'Companion: OK (zoom_delay)');
  ck('fernLogText hat keinen Namensparameter (Kennung und Verb)', fernLogText.length === 2);
}

console.log('— 4b: maskiereNamen (N4b.2, L11): ganze Wörter, längste zuerst');
{
  const P = '‹Name›';
  ck('Platzhalter „‹Name›“ (U+2039, U+203A)', maskiereNamen('Anna', ['Anna']) === P && P.charCodeAt(0) === 0x2039 && P.charCodeAt(5) === 0x203a);
  ck('„Anna, Ben“ → „‹Name›, ‹Name›“', maskiereNamen('Namensprobe: Anna, Ben', ['Anna', 'Ben']) === `Namensprobe: ${P}, ${P}`);
  ck('„Annabell“ bleibt bei Name „Anna“ (nur ganze Wörter)', maskiereNamen('Annabell kommt', ['Anna']) === 'Annabell kommt');
  ck('Ziffer direkt dahinter: „Anna2“ bleibt', maskiereNamen('Anna2', ['Anna']) === 'Anna2');
  ck('Umlaut als Wortteil: „Jörgen“ bleibt bei Name „Jörg“', maskiereNamen('Jörgen', ['Jörg']) === 'Jörgen');
  ck('„Anna Maria“ vor „Anna“ (längste zuerst)', maskiereNamen('Wiederbeitritt 7 (Anna Maria)', ['Anna', 'Anna Maria']) === `Wiederbeitritt 7 (${P})`);
  ck('Name mit „.“, „(“, „)“ wird maskiert', maskiereNamen('Abo für Dr. Ben (Gast) steht', ['Dr. Ben (Gast)']) === `Abo für ${P} steht`);
  ck('„.“ im Namen ist kein Joker: „DrX Ben“ bleibt', maskiereNamen('DrX Ben', ['Dr. Ben']) === 'DrX Ben');
  ck('mehrfach in einer Zeile', maskiereNamen('Ben geht, Ben kommt', ['Ben']) === `${P} geht, ${P} kommt`);
  ck('leere Liste → Zeile unverändert', maskiereNamen('Anna, Ben', []) === 'Anna, Ben');
  ck('Namen unter 2 Zeichen und leere Namen bleiben aus', maskiereNamen('A B Carla', ['A', '', ' ', 'Carla']) === `A B ${P}`);
  ck('NDI-Name: der Name hinter dem Gedankenstrich wird maskiert', maskiereNamen('JM Connect – Zoom Anna (2)', ['Anna']) === `JM Connect – Zoom ${P} (2)`);
}

// ── Plan B, Task B3: NDI-Namensprüfung und Haltezeit (Spec 9.3 T43–T47, 9.4 T74) ──
console.log('— B3 · ST43–ST47, ST74 wörtlich');
{
  const { NDI_NAME_MAX, NDI_NAME_TEXT, HALTEZEIT_UNGUELTIG } = await import('../src/shared/zoom-text');
  const { SPEAKER_HOLD_MAX_MS } = await import('@jm/zoom-bridge/protocol');
  const SOLL: Array<[string, string, string]> = [
    ['T43', NDI_NAME_TEXT.laenge, 'Der NDI-Name muss 1 bis 60 Zeichen lang sein.'],
    ['T44', NDI_NAME_TEXT.doppelpunkt, 'Ein Doppelpunkt ist im NDI-Namen nicht erlaubt (NDI macht daraus ein Leerzeichen).'],
    ['T45', NDI_NAME_TEXT.doppelt(3), 'Diesen NDI-Namen trägt schon Slot 3.'],
    ['T46', NDI_NAME_TEXT.gast('JM Connect – Zoom Anna'),
      'NDI-Name doppelt: Ein Browser-Gast sendet ebenfalls als „JM Connect – Zoom Anna“. Im Switcher ist nicht sicher, welche Quelle ankommt. Einen der beiden umbenennen.'],
    ['T47', NDI_NAME_TEXT.steuerzeichen, 'Steuerzeichen sind im NDI-Namen nicht erlaubt.'],
    ['T74', HALTEZEIT_UNGUELTIG, 'Haltezeit: erlaubt sind 0 bis 5 Sekunden.'],
  ];
  for (const [id, ist, soll] of SOLL) ck(`S${id} wörtlich`, ist === soll);
  ck('ST43 nennt NDI_NAME_MAX (60, E26)', NDI_NAME_MAX === 60 && NDI_NAME_TEXT.laenge.includes(`1 bis ${NDI_NAME_MAX} Zeichen`));
  ck('ST74 nennt SPEAKER_HOLD_MAX_MS in Sekunden', HALTEZEIT_UNGUELTIG.includes(`0 bis ${SPEAKER_HOLD_MAX_MS / 1000} Sekunden`));
}

// ── Plan B, Task B4: Einstellungsdatei (Spec 9.6 T90–T92) ──
console.log('— B4 · ST90–ST92 wörtlich');
{
  const { EINSTELLUNG_TEXT } = await import('../src/shared/zoom-text');
  ck('ST90 wörtlich', EINSTELLUNG_TEXT.unlesbar('connect-settings.unlesbar-20261020-070509.json')
    === 'Die Einstellungen von Connect waren unlesbar. Die Datei liegt gesichert als „connect-settings.unlesbar-20261020-070509.json“; Connect arbeitet mit den Vorgaben weiter, auch für die Zoom-Slots.');
  ck('ST91 wörtlich (Plural)', EINSTELLUNG_TEXT.verworfen(3) === '3 gespeicherte Slots waren unvollständig oder doppelt und wurden nicht übernommen.');
  ck('ST91 wörtlich (Singular bei 1)', EINSTELLUNG_TEXT.verworfen(1) === '1 gespeicherter Slot war unvollständig oder doppelt und wurde nicht übernommen.');
  ck('ST92 = TEXT_A4_SCHREIBFEHLER wörtlich', TEXT_A4_SCHREIBFEHLER === 'Nur für diese Sitzung gemerkt — die Einstellungsdatei ließ sich nicht schreiben.');
}

// ── Plan B, Task B5: Klartexte der Slot-Fehler und Fernsteuer-Hinweise (Spec 9.6 T100–T106, 9.7 F5–F14, 7.1) ──
console.log('— B5 · ST100–ST106, SF5–SF14 wörtlich, SLOT_FEHLER_TEXT je Schlüssel');
{
  const { SLOT_FEHLER_TEXT, SLOT_KT, audioBufferMismatchText, tonAboFehlerText } = await import('../src/main/zoom/klartext');
  const { SLOT_ERROR_KEYS, SLOT_NR_MAX } = await import('@jm/zoom-bridge/protocol');
  const SOLL: Array<[string, string, string]> = [
    ['T100', SLOT_KT.T100, 'Keine Aufnahme-Erlaubnis — der Host muss sie im Zoom-Client erteilen.'],
    ['T101', SLOT_KT.T101('SLOT_SENDER_FAILED'), 'Der Slot ließ sich nicht aufbauen (SLOT_SENDER_FAILED). Details im Log.'],
    ['T102', SLOT_KT.T102, 'Diesen NDI-Namen trägt schon ein laufender Slot.'],
    ['T103', SLOT_KT.T103('SLOT_BAD_MODE'), 'Die Zoom-Bridge hat die Einstellung abgelehnt (SLOT_BAD_MODE). Details im Log.'],
    ['T104', tonAboFehlerText('AUDIO_HELPER_MISSING'),
      'Ton nicht verfügbar (AUDIO_HELPER_MISSING) — das Bild läuft ohne Ton. Für einen neuen Versuch den Ton aus- und wieder einschalten.'],
    ['T105', SLOT_KT.T105(4), 'Bild: fehlerhafte Bilder in Slot 4 verworfen (slotBufferMismatch). Der Slot läuft weiter; ob wieder Bild kommt, zeigt seine Kachel.'],
    ['T106', audioBufferMismatchText(2), 'Ton: ein fehlerhaftes Paket in Slot 2 verworfen (audioBufferMismatch). Der Ton läuft mit dem nächsten gültigen Paket weiter.'],
    ['F5 (geändert)', FT.F5_SLOT('Anna Maria'), 'Companion: kein eingeschalteter Teilnehmer-Slot mit „Anna Maria“.'],
    ['F8 (geändert)', FT.F8_SLOT(6), 'Companion: 6. Slot eingeschaltet — mehr als 5 sind nicht gemessen.'],
    ['F9', FT.F9('17'), 'Companion: Slot „17“ gibt es nicht.'],
    ['F10', FT.F10('galerie'), 'Companion: Modus „galerie“ unbekannt — erlaubt sind teilnehmer, sprecher und freigabe.'],
    ['F11', FT.F11(3), 'Companion: Slot 3: kein Anzeigename angegeben.'],
    ['F12', FT.F12(3), 'Companion: Slot 3: Person-Ton gibt es nur im Modus Teilnehmer, der Slot sendet keinen Meeting-Ton.'],
    ['F13', FT.F13('an'), 'Companion: Wert „an“ ungültig — erlaubt sind ON, OFF und TOGGLE.'],
    ['F14', FT.F14, 'Companion: kein freier Slot (höchstens 16, vorübergehende eingerechnet).'],
  ];
  for (const [id, ist, soll] of SOLL) ck(`S${id} wörtlich`, ist === soll);
  ck('ST100 ist Q1 (wie Q1, Spec 9.6)', SLOT_KT.T100 === KT.Q1);
  ck('ST104, ST106: tonAboFehlerText und audioBufferMismatchText sind T104 und T106',
    tonAboFehlerText('x') === SLOT_KT.T104('x') && audioBufferMismatchText(7) === SLOT_KT.T106(7));
  ck('SF8 nennt BETRIEBSGROESSE, SF14 nennt SLOT_NR_MAX (B-EP7)',
    FT.F8_SLOT(7) === `Companion: 7. Slot eingeschaltet — mehr als ${BETRIEBSGROESSE} sind nicht gemessen.`
      && FT.F14 === `Companion: kein freier Slot (höchstens ${SLOT_NR_MAX}, vorübergehende eingerechnet).`);
  const quelle = readFileSync(new URL('../src/main/zoom/klartext.ts', import.meta.url), 'utf8');
  ck('Quelltext-Wächter: klartext.ts schreibt „höchstens 16“ nicht als Literal (B-EP7)', !quelle.includes('höchstens 16'));
  // Je Schlüssel der Text oder ausdrücklich 'keine' (Gliederung 3.6, Spec 7.1, 9.6, 10.9)
  const T103 = SLOT_KT.T103('NAME_X');
  const T101 = SLOT_KT.T101('NAME_X');
  const ERWARTET: Record<string, string> = {
    slotBadNumber: T103, slotBadName: T103, slotNameTaken: SLOT_KT.T102, slotBadMode: T103, slotBadResolution: T103,
    slotBadAudio: T103, slotBadFallback: T103, slotBadFlag: T103, slotBadTarget: T103, slotAlreadyOn: 'keine', slotNotOn: 'keine',
    slotNoPrivilege: 'keine', slotReconnecting: 'keine', slotRawRecordingFailed: T101, slotSenderFailed: T101, slotRendererFailed: T101,
    slotSubscribeFailed: 'keine', slotBufferMismatch: SLOT_KT.T105(4), speakerBadSignal: T103, speakerBadHold: T103, previewUnavailable: 'keine',
  };
  ck('SLOT_FEHLER_TEXT hat genau die 21 Schlüssel aus SLOT_ERROR_KEYS',
    JSON.stringify(Object.keys(SLOT_FEHLER_TEXT).sort()) === JSON.stringify([...SLOT_ERROR_KEYS].sort()) && SLOT_ERROR_KEYS.length === 21);
  for (const k of SLOT_ERROR_KEYS) {
    const v = SLOT_FEHLER_TEXT[k];
    ck(`SLOT_FEHLER_TEXT ${k} → ${ERWARTET[k] === 'keine' ? 'keine' : 'Text'}`, (v === 'keine' ? 'keine' : v({ name: 'NAME_X', nr: 4 })) === ERWARTET[k]);
  }
  const ohneNr = SLOT_FEHLER_TEXT.slotBufferMismatch;
  ck('ST105 ohne Slot-Nummer: „unbekannt“ wie Q16 ohne Person in 0.3.0', ohneNr !== 'keine'
    && ohneNr({ name: 'SLOT_BUFFER_MISMATCH', nr: null }) === 'Bild: fehlerhafte Bilder in Slot unbekannt verworfen (slotBufferMismatch). Der Slot läuft weiter; ob wieder Bild kommt, zeigt seine Kachel.');
}

// ── Plan B, Task B6: Zustandszeile und Fehlerzeile der Kachel (Spec 10.2, 10.9; Texte 9.1 T1–T4, 9.2) ──
console.log('— B6 · ST1–ST4, ST10–ST29e, ST60, ST97 wörtlich');
{
  const { ERSATZBILD_FELD, ERSATZBILD_NAME, kachelZeile, MODUS_NAME } = await import('../src/shared/zoom-text');
  type KE = import('../src/shared/zoom-text').KachelEingabe;
  const basis: KE = {
    zustand: 'ersatz', z: 'Z9b', erlaubnis: 'ja', modus: 'teilnehmer', grund: 'noTarget', gesendet: 'transparent',
    ersatzbild: 'transparent', zielName: 'Anna', person: 'Anna', doppelt: 1, zweifel: false, imWarteraum: false,
    liefSchon: true, andererSlot: null, freigaben: { zahl: 1, namen: ['Carla'] }, aboFehlerName: null, gescheitertText: null,
  };
  const k = (o: Partial<KE>): string => kachelZeile({ ...basis, ...o });
  const sprecher: Partial<KE> = { modus: 'sprecher', person: '', zielName: 'Ben' };
  const freigabe: Partial<KE> = { modus: 'freigabe', person: '', zielName: 'Carla' };
  const SOLL: Array<[string, string, string]> = [
    ['T10', k({ zustand: 'aus' }), 'Ausgeschaltet.'],
    ['T11a (Z1a)', k({ zustand: 'ohne_meeting', z: 'Z1a', erlaubnis: null }), 'Wartet: Zoom ist auf diesem Rechner noch nicht eingerichtet.'],
    ['T11a (Z1b)', k({ zustand: 'ohne_meeting', z: 'Z1b', erlaubnis: null }), 'Wartet: Zoom ist auf diesem Rechner noch nicht eingerichtet.'],
    ['T11b (Z2)', k({ zustand: 'ohne_meeting', z: 'Z2', erlaubnis: null }), 'Wartet auf den Beitritt zu einem Meeting.'],
    ['T11c (Z3)', k({ zustand: 'ohne_meeting', z: 'Z3', erlaubnis: null }), 'Wartet: Connect tritt dem Meeting bei.'],
    ['T11c (Z4, Sender der aktiven Bridge)', k({ zustand: 'zeigt', z: 'Z4', grund: 'frames', gesendet: 'none' }), 'Wartet: Connect tritt dem Meeting bei.'],
    ['T11h (Z5a)', k({ zustand: 'ohne_meeting', z: 'Z5a', erlaubnis: null }), 'Wartet: Connect ist im Warteraum des Meetings.'],
    ['T11h (Z5b, Sender der aktiven Bridge)', k({ zustand: 'ersatz', z: 'Z5b' }), 'Wartet: Connect ist im Warteraum des Meetings.'],
    ['T11d (Z10)', k({ zustand: 'ersatz', z: 'Z10', grund: 'cameraOff' }), 'Verbindung zum Meeting unterbrochen, Zoom verbindet neu.'],
    ['T11e (Z11)', k({ zustand: 'ohne_meeting', z: 'Z11' }), 'Verbindung zum Meeting verloren, Connect tritt neu bei.'],
    ['T11f (Z12)', k({ zustand: 'zeigt', z: 'Z12', grund: 'frames', gesendet: 'none' }), 'Connect verlässt das Meeting.'],
    ['T11g (Z13)', k({ zustand: 'ohne_meeting', z: 'Z13', erlaubnis: null }), 'Läuft nicht: Zoom meldet einen Fehler (siehe oben).'],
    ['T12a', k({ zustand: 'wartet_erlaubnis', z: 'Z6', erlaubnis: 'offen', liefSchon: false }), 'Wartet auf die Aufnahme-Erlaubnis des Hosts.'],
    ['T12b', k({ zustand: 'wartet_erlaubnis', z: 'Z7', erlaubnis: 'entzogen', liefSchon: true }),
      'Gestoppt: Der Host hat die Aufnahme-Erlaubnis entzogen. Erteilt er sie wieder, startet der Slot von selbst.'],
    ['T12d', k({ zustand: 'wartet_erlaubnis', z: 'Z7', erlaubnis: 'entzogen', liefSchon: false }),
      'Wartet: Der Host hat die Aufnahme-Erlaubnis entzogen. Erteilt er sie wieder, startet der Slot von selbst.'],
    ['T12c (abgelehnt)', k({ zustand: 'wartet_erlaubnis', z: 'Z7', erlaubnis: 'abgelehnt' }), 'Wartet: Ohne Aufnahme-Erlaubnis startet kein Slot.'],
    ['T12c (abgelaufen, Z7b)', k({ zustand: 'wartet_erlaubnis', z: 'Z7b', erlaubnis: 'abgelaufen' }), 'Wartet: Ohne Aufnahme-Erlaubnis startet kein Slot.'],
    ['T13', k({ doppelt: 2 }), 'Name doppelt: „Anna“ ist 2-mal im Meeting. Bitte unten die richtige Person wählen. · Ersatzbild transparent'],
    ['T13b', k({ zweifel: true, grund: 'participantLeft' }),
      '„Anna“ hat das Meeting verlassen; eine andere Person mit diesem Namen ist noch da. Ist sie gemeint, unten wählen. · Ersatzbild transparent'],
    ['T14 (SZ3)', k({ zustand: 'startet', grund: null, gesendet: null }), 'Startet …'],
    ['T14 (SZ11)', k({ zustand: 'geplant', grund: null, gesendet: null }), 'Startet …'],
    ['T15', k({ zustand: 'zeigt', grund: 'frames', gesendet: 'none' }), 'Zeigt Anna.'],
    ['T16', k({ grund: 'participantLeft' }), 'Wartet auf Anna · Ersatzbild transparent'],
    ['T17', k({ imWarteraum: true }), 'Wartet auf Anna (im Warteraum) · Ersatzbild transparent'],
    ['T18', k({ person: '', zielName: null }), 'Keine Person gewählt · Ersatzbild transparent'],
    ['T19', k({ grund: 'cameraOff', gesendet: 'black', ersatzbild: 'schwarz' }), 'Anna: Kamera aus · Ersatzbild schwarz'],
    ['T19b', k({ grund: 'noFrames', gesendet: 'white', ersatzbild: 'weiss' }), 'Anna: Zoom liefert gerade kein Bild · Ersatzbild weiß'],
    ['T20 (Teilnehmer)', k({ grund: 'targetChanged' }), 'Anna: erstes Bild steht noch aus · Ersatzbild transparent'],
    ['T20 (Freigabe)', k({ ...freigabe, grund: 'shareChanged' }), 'Freigabe von Carla: erstes Bild steht noch aus · Ersatzbild transparent'],
    ['T20b', k({ grund: 'bufferMismatch' }), 'Anna: fehlerhafte Bilder verworfen · Ersatzbild transparent'],
    ['T20c', k({ grund: 'subscribeFailed', aboFehlerName: 'SDKERR_INTERNAL_ERROR' }),
      'Anna: Zoom hat das Abo abgelehnt (SDKERR_INTERNAL_ERROR) · Ersatzbild transparent. Für einen neuen Versuch „Stopp“ und wieder „Start“.'],
    ['T21', k({ zustand: 'keine_antwort', gesendet: null }), 'Keine Antwort der Zoom-Bridge. Für einen neuen Versuch „Stopp“ und wieder „Start“.'],
    ['T22', k({ zustand: 'zurueckgestellt', gesendet: null }),
      'Nicht gestartet: mehr als 5 Slots ohne Bestätigung. Für die Bestätigung einmal „Stopp“ und wieder „Start“.'],
    ['T23', k({ zustand: 'gescheitert', gesendet: null, gescheitertText: 'Der Slot ließ sich nicht aufbauen (SLOT_SENDER_FAILED). Details im Log.' }),
      'Gescheitert: Der Slot ließ sich nicht aufbauen (SLOT_SENDER_FAILED). Details im Log. Für einen neuen Versuch „Stopp“ und wieder „Start“.'],
    ['T24', k({ zustand: 'stoppt' }), 'Wird gestoppt …'],
    ['T25', k({ ...sprecher, zustand: 'zeigt', grund: 'frames', gesendet: 'none' }), 'Zeigt Ben (Sprecher).'],
    ['T26', k({ ...sprecher, zielName: null, grund: 'speakerNone' }), 'Wartet auf eine sprechende Person · Ersatzbild transparent'],
    ['T27', k({ ...sprecher, grund: 'speakerNoVideo' }), 'Ben (Sprecher): Kamera aus · Ersatzbild transparent'],
    ['T27b', k({ ...sprecher, grund: 'noFrames' }), 'Ben (Sprecher): Zoom liefert gerade kein Bild · Ersatzbild transparent'],
    ['T28', k({ ...freigabe, zustand: 'zeigt', grund: 'frames', gesendet: 'none' }), 'Zeigt die Freigabe von Carla.'],
    ['T28 (Freigabe, die ersten 2 s mit sent = held)', k({ ...freigabe, zustand: 'zeigt', grund: 'frames', gesendet: 'held' }), 'Zeigt die Freigabe von Carla.'],
    ['T28b', k({ ...freigabe, zustand: 'zeigt', grund: 'frames', gesendet: 'none', freigaben: { zahl: 2, namen: ['Carla', 'Ben'] } }),
      'Zeigt die Freigabe von Carla (die neueste von 2: Carla, Ben).'],
    ['T29', k({ ...freigabe, zustand: 'gehalten', gesendet: 'held', grund: 'sharePaused' }), 'Freigabe von Carla pausiert · letztes Bild gehalten'],
    ['T29b', k({ ...freigabe, zustand: 'gehalten', gesendet: 'held', grund: 'shareStill' }), 'Freigabe von Carla unverändert · letztes Bild gehalten'],
    ['T29d', k({ ...freigabe, grund: 'sharePaused' }), 'Freigabe von Carla pausiert · noch kein Bild · Ersatzbild transparent'],
    ['T29e', k({ ...freigabe, grund: 'noFrames' }), 'Freigabe von Carla: Zoom liefert gerade kein Bild · Ersatzbild transparent'],
    ['T29c', k({ ...freigabe, zielName: null, grund: 'shareNone' }), 'Wartet auf eine Bildschirmfreigabe · Ersatzbild transparent'],
    ['T60', k({ grund: 'cameraOff', ersatzbild: 'eingefroren', gesendet: 'transparent' }),
      'Anna: Kamera aus · Ersatzbild eingefroren (kein gespeichertes Bild, darum transparent)'],
    ['T4 (sent = freeze)', k({ grund: 'cameraOff', ersatzbild: 'eingefroren', gesendet: 'freeze' }), 'Anna: Kamera aus · Ersatzbild eingefroren'],
    ['T4 (sent nennt, was gesendet wird, nicht die Einstellung)', k({ grund: 'cameraOff', ersatzbild: 'schwarz', gesendet: 'transparent' }),
      'Anna: Kamera aus · Ersatzbild transparent'],
    ['T97', k({ grund: 'noFrames', andererSlot: 3 }),
      'Anna: Zoom liefert gerade kein Bild · Ersatzbild transparent · Slot 3 zeigt dieselbe Quelle; ob Zoom zwei Abos derselben Quelle zugleich beliefert, ist noch nicht gemessen.'],
    ['T97 an T20c', k({ ...freigabe, grund: 'subscribeFailed', aboFehlerName: 'SDKERR_INTERNAL_ERROR', andererSlot: 7 }),
      'Freigabe von Carla: Zoom hat das Abo abgelehnt (SDKERR_INTERNAL_ERROR) · Ersatzbild transparent. Für einen neuen Versuch „Stopp“ und wieder „Start“. · Slot 7 zeigt dieselbe Quelle; ob Zoom zwei Abos derselben Quelle zugleich beliefert, ist noch nicht gemessen.'],
  ];
  for (const [id, ist, soll] of SOLL) ck(`S${id} wörtlich`, ist === soll);
  ck('ST1, ST2, ST3 Modus-Namen wörtlich', JSON.stringify(MODUS_NAME) === JSON.stringify({ teilnehmer: 'Teilnehmer', sprecher: 'Aktiver Sprecher', freigabe: 'Bildschirmfreigabe' }));
  ck('ST4 Ersatzbild-Namen (Einstellung und sent) und Feldname wörtlich',
    JSON.stringify(ERSATZBILD_NAME) === JSON.stringify({ transparent: 'transparent', freeze: 'eingefroren', black: 'schwarz', white: 'weiß', eingefroren: 'eingefroren', schwarz: 'schwarz', weiss: 'weiß' })
      && ERSATZBILD_FELD === 'Ersatzbild');
  const quelle = readFileSync(new URL('../src/shared/zoom-text.ts', import.meta.url), 'utf8');
  ck('Quelltext-Wächter: zoom-text.ts schreibt „mehr als 5“ (T22) nicht als Literal, T22 kommt aus BETRIEBSGROESSE', !quelle.includes('mehr als 5'));
}

console.log('— B6 · Zustandszeile 10.2 als Kreuzprodukt (10.5) mit den Wahrheitsprädikaten; Zähltests');
{
  const { kachelZeile } = await import('../src/shared/zoom-text');
  const { SLOT_REASONS, SLOT_SENT } = await import('@jm/zoom-bridge/protocol');
  type KE = import('../src/shared/zoom-text').KachelEingabe;
  type SZ = import('../src/shared/types').ZoomSlotZustand;
  type Modus = import('../src/shared/types').ZoomSlotModus;
  type Ersatzbild = import('../src/shared/types').ZoomSlotErsatzbild;
  type Grund = import('@jm/zoom-bridge/protocol').SlotReason;
  type Sent = import('@jm/zoom-bridge/protocol').SlotSent;

  // Zähltests (10.5 letzter Punkt): Der Record ist vollständig, sonst scheitert der Typcheck.
  const ALLE_SZ: Record<SZ, true> = {
    aus: true, ohne_meeting: true, wartet_erlaubnis: true, startet: true, zeigt: true, gehalten: true,
    ersatz: true, keine_antwort: true, gescheitert: true, stoppt: true, zurueckgestellt: true, geplant: true,
  };
  ck('ZoomSlotZustand hat 12 Werte', Object.keys(ALLE_SZ).length === 12);
  ck('SlotReason hat 20 Werte', SLOT_REASONS.length === 20 && new Set(SLOT_REASONS).size === 20);

  // Texte 9.2, aus der Spec abgeschrieben (nicht aus dem Modul); `art` ist der fertige Ersatzbild-Teil.
  const S = {
    T10: 'Ausgeschaltet.',
    T11a: 'Wartet: Zoom ist auf diesem Rechner noch nicht eingerichtet.',
    T11b: 'Wartet auf den Beitritt zu einem Meeting.',
    T11c: 'Wartet: Connect tritt dem Meeting bei.',
    T11h: 'Wartet: Connect ist im Warteraum des Meetings.',
    T11d: 'Verbindung zum Meeting unterbrochen, Zoom verbindet neu.',
    T11e: 'Verbindung zum Meeting verloren, Connect tritt neu bei.',
    T11f: 'Connect verlässt das Meeting.',
    T11g: 'Läuft nicht: Zoom meldet einen Fehler (siehe oben).',
    T12a: 'Wartet auf die Aufnahme-Erlaubnis des Hosts.',
    T12b: 'Gestoppt: Der Host hat die Aufnahme-Erlaubnis entzogen. Erteilt er sie wieder, startet der Slot von selbst.',
    T12d: 'Wartet: Der Host hat die Aufnahme-Erlaubnis entzogen. Erteilt er sie wieder, startet der Slot von selbst.',
    T12c: 'Wartet: Ohne Aufnahme-Erlaubnis startet kein Slot.',
    T13: (p: string, d: number, art: string): string => `Name doppelt: „${p}“ ist ${d}-mal im Meeting. Bitte unten die richtige Person wählen. · ${art}`,
    T13b: (p: string, art: string): string =>
      `„${p}“ hat das Meeting verlassen; eine andere Person mit diesem Namen ist noch da. Ist sie gemeint, unten wählen. · ${art}`,
    T14: 'Startet …',
    T15: (p: string): string => `Zeigt ${p}.`,
    T16: (p: string, art: string): string => `Wartet auf ${p} · ${art}`,
    T17: (p: string, art: string): string => `Wartet auf ${p} (im Warteraum) · ${art}`,
    T18: (art: string): string => `Keine Person gewählt · ${art}`,
    T19: (p: string, art: string): string => `${p}: Kamera aus · ${art}`,
    T19b: (p: string, art: string): string => `${p}: Zoom liefert gerade kein Bild · ${art}`,
    T20: (z: string, art: string): string => `${z}: erstes Bild steht noch aus · ${art}`,
    T20b: (z: string, art: string): string => `${z}: fehlerhafte Bilder verworfen · ${art}`,
    T20c: (z: string, name: string, art: string): string =>
      `${z}: Zoom hat das Abo abgelehnt (${name}) · ${art}. Für einen neuen Versuch „Stopp“ und wieder „Start“.`,
    T21: 'Keine Antwort der Zoom-Bridge. Für einen neuen Versuch „Stopp“ und wieder „Start“.',
    T22: 'Nicht gestartet: mehr als 5 Slots ohne Bestätigung. Für die Bestätigung einmal „Stopp“ und wieder „Start“.',
    T23: (klartext: string): string => `Gescheitert: ${klartext} Für einen neuen Versuch „Stopp“ und wieder „Start“.`,
    T24: 'Wird gestoppt …',
    T25: (p: string): string => `Zeigt ${p} (Sprecher).`,
    T26: (art: string): string => `Wartet auf eine sprechende Person · ${art}`,
    T27: (p: string, art: string): string => `${p} (Sprecher): Kamera aus · ${art}`,
    T27b: (p: string, art: string): string => `${p} (Sprecher): Zoom liefert gerade kein Bild · ${art}`,
    T28: (p: string): string => `Zeigt die Freigabe von ${p}.`,
    T28b: (p: string, m: number, namen: string): string => `Zeigt die Freigabe von ${p} (die neueste von ${m}: ${namen}).`,
    T29: (p: string): string => `Freigabe von ${p} pausiert · letztes Bild gehalten`,
    T29b: (p: string): string => `Freigabe von ${p} unverändert · letztes Bild gehalten`,
    T29d: (p: string, art: string): string => `Freigabe von ${p} pausiert · noch kein Bild · ${art}`,
    T29e: (p: string, art: string): string => `Freigabe von ${p}: Zoom liefert gerade kein Bild · ${art}`,
    T29c: (art: string): string => `Wartet auf eine Bildschirmfreigabe · ${art}`,
    T60: 'Ersatzbild eingefroren (kein gespeichertes Bild, darum transparent)',
    T97: (m: number): string => ` · Slot ${m} zeigt dieselbe Quelle; ob Zoom zwei Abos derselben Quelle zugleich beliefert, ist noch nicht gemessen.`,
    ART: { transparent: 'transparent', freeze: 'eingefroren', black: 'schwarz', white: 'weiß' } as Record<string, string>,
  };

  const IM = new Set<ZoomZ>(['Z6', 'Z7', 'Z7b', 'Z8', 'Z9', 'Z9b']);
  // Z0 gibt es nur unter macOS; dort steht keine Kachel (7.11). Sender außerhalb des Meetings: 10.2 Regel 2, 10.4.
  const AUSSEN: ZoomZ[] = ['Z1a', 'Z1b', 'Z2', 'Z3', 'Z4', 'Z5a', 'Z5b', 'Z10', 'Z11', 'Z12', 'Z13'];
  const SENDER_AUSSEN = new Set<ZoomZ>(['Z4', 'Z5a', 'Z5b', 'Z10', 'Z11', 'Z12']);
  const OHNE_MEETING: Record<string, string> = {
    Z1a: S.T11a, Z1b: S.T11a, Z2: S.T11b, Z3: S.T11c, Z4: S.T11c, Z5a: S.T11h, Z5b: S.T11h, Z10: S.T11d, Z11: S.T11e, Z12: S.T11f, Z13: S.T11g,
  };
  const MODI: Modus[] = ['teilnehmer', 'sprecher', 'freigabe'];
  const ERSATZBILDER: Ersatzbild[] = ['transparent', 'eingefroren', 'schwarz', 'weiss'];
  const ZIEL0: Grund[] = ['noTarget', 'participantLeft', 'speakerNone', 'shareNone'];   // 6.10 Schritt 3
  const MIT_ZIEL: Grund[] = SLOT_REASONS.filter((g) => !ZIEL0.includes(g));
  const ERSATZ_SENT: Sent[] = ['transparent', 'freeze', 'black', 'white'];             // SZ6 sendet ein Ersatzbild (6.12)
  const NAMEN = ['Carla', 'Ben', 'Anna'];
  const KLARTEXT = 'Der Slot ließ sich nicht aufbauen (SLOT_SENDER_FAILED). Details im Log.';
  const ABO = 'SDKERR_INTERNAL_ERROR';

  function erlaubnisse(z: ZoomZ): (ZoomErlaubnis | null)[] {
    switch (z) {
      case 'Z6': return ['offen'];
      case 'Z7': return ['abgelehnt', 'abgelaufen', 'entzogen'];
      case 'Z7b': return ['offen', 'abgelehnt', 'abgelaufen', 'entzogen'];
      case 'Z8': case 'Z9': case 'Z9b': return ['ja'];
      default: return [null, 'offen', 'ja', 'entzogen', 'abgelehnt', 'abgelaufen'];
    }
  }
  function zustaende(z: ZoomZ): SZ[] {
    switch (z) {
      case 'Z6': case 'Z7': return ['aus', 'wartet_erlaubnis'];
      case 'Z7b': return ['aus', 'wartet_erlaubnis', 'zeigt', 'gehalten', 'ersatz', 'stoppt'];
      case 'Z8': return ['aus', 'startet', 'keine_antwort', 'gescheitert', 'zurueckgestellt', 'geplant'];
      case 'Z9': return ['aus', 'startet', 'zeigt', 'gehalten', 'keine_antwort', 'gescheitert', 'stoppt', 'zurueckgestellt', 'geplant'];
      case 'Z9b': return ['aus', 'startet', 'zeigt', 'gehalten', 'ersatz', 'keine_antwort', 'gescheitert', 'stoppt', 'zurueckgestellt', 'geplant'];
      default: return SENDER_AUSSEN.has(z) ? ['aus', 'ohne_meeting', 'zeigt', 'gehalten', 'ersatz', 'stoppt'] : ['aus', 'ohne_meeting', 'stoppt'];
    }
  }
  interface Lage { ziel0: boolean; grund: Grund | null; gesendet: Sent | null; zahl: number }
  function lagen(sz: SZ, modus: Modus): Lage[] {
    const l: Lage[] = [];
    if (sz === 'zeigt') {
      for (const grund of MIT_ZIEL) for (const gesendet of (modus === 'freigabe' ? ['none', 'held'] : ['none']) as Sent[])
        for (const zahl of modus === 'freigabe' ? [1, 2, 3] : [1]) l.push({ ziel0: false, grund, gesendet, zahl });
    } else if (sz === 'gehalten') {
      if (modus === 'freigabe') for (const grund of ['sharePaused', 'shareStill'] as Grund[]) l.push({ ziel0: false, grund, gesendet: 'held', zahl: 1 });
    } else if (sz === 'ersatz') {
      for (const grund of SLOT_REASONS) for (const gesendet of ERSATZ_SENT) l.push({ ziel0: ZIEL0.includes(grund), grund, gesendet, zahl: 1 });
    } else if (sz === 'stoppt') {
      for (const grund of [null, ...SLOT_REASONS]) for (const gesendet of SLOT_SENT) {
        l.push({ ziel0: grund !== null && ZIEL0.includes(grund), grund, gesendet, zahl: 1 });
      }
    } else {
      for (const grund of [null, ...SLOT_REASONS]) l.push({ ziel0: true, grund, gesendet: null, zahl: 1 });
    }
    return l;
  }
  interface Wahl { person: string; doppelt: number; zweifel: boolean; warteraum: boolean }
  const EINE: Wahl[] = [{ person: 'Anna', doppelt: 1, zweifel: false, warteraum: false }];
  const WAHLEN: Wahl[] = [{ person: '', doppelt: 1, zweifel: false, warteraum: false }];
  for (const doppelt of [1, 2]) for (const zweifel of [false, true]) for (const warteraum of [false, true]) WAHLEN.push({ person: 'Anna', doppelt, zweifel, warteraum });

  /** 10.2, Regel für Regel aus der Spec abgeschrieben; liefert die T-Nummer und den Text. */
  function soll(f: KE): [string, string] {
    if (f.zustand === 'aus') return ['T10', S.T10];
    if (f.zustand === 'stoppt') return ['T24', S.T24];
    if (!IM.has(f.z)) return [({ Z1a: 'T11a', Z1b: 'T11a', Z2: 'T11b', Z3: 'T11c', Z4: 'T11c', Z5a: 'T11h', Z5b: 'T11h', Z10: 'T11d', Z11: 'T11e', Z12: 'T11f', Z13: 'T11g' } as Record<string, string>)[f.z], OHNE_MEETING[f.z]];
    if (f.zustand === 'wartet_erlaubnis') {
      if (f.erlaubnis === 'entzogen') return f.liefSchon ? ['T12b', S.T12b] : ['T12d', S.T12d];
      if (f.erlaubnis === 'abgelehnt' || f.erlaubnis === 'abgelaufen') return ['T12c', S.T12c];
      return ['T12a', S.T12a];
    }
    if (f.zustand === 'startet' || f.zustand === 'geplant') return ['T14', S.T14];
    if (f.zustand === 'keine_antwort') return ['T21', S.T21];
    if (f.zustand === 'gescheitert') return ['T23', S.T23(f.gescheitertText ?? '')];
    if (f.zustand === 'zurueckgestellt') return ['T22', S.T22];
    const p = f.zielName ?? f.person;
    if (f.zustand === 'zeigt') {
      if (f.modus === 'teilnehmer') return ['T15', S.T15(p)];
      if (f.modus === 'sprecher') return ['T25', S.T25(p)];
      return f.freigaben.zahl > 1 ? ['T28b', S.T28b(p, f.freigaben.zahl, f.freigaben.namen.join(', '))] : ['T28', S.T28(p)];
    }
    if (f.zustand === 'gehalten') return f.grund === 'sharePaused' ? ['T29', S.T29(p)] : ['T29b', S.T29b(p)];
    // SZ6 (Regeln 6–10)
    const art = f.ersatzbild === 'eingefroren' && f.gesendet === 'transparent' ? S.T60 : `Ersatzbild ${S.ART[f.gesendet ?? '']}`;
    const g = f.grund;
    const t97 = f.andererSlot !== null && (g === 'noFrames' || g === 'subscribeFailed') ? S.T97(f.andererSlot) : '';
    const ohneZiel = g !== null && ZIEL0.includes(g);
    if (f.modus === 'teilnehmer') {
      if (f.doppelt > 1) return ['T13', S.T13(p, f.doppelt, art)];
      if (f.zweifel) return ['T13b', S.T13b(p, art)];
      if (f.person === '') return ['T18', S.T18(art)];
      if (f.imWarteraum) return ['T17', S.T17(p, art)];
      if (ohneZiel) return ['T16', S.T16(p, art)];
      if (g === 'cameraOff') return ['T19', S.T19(p, art)];
      if (g === 'noFrames') return ['T19b', S.T19b(p, art) + t97];
      if (g === 'bufferMismatch') return ['T20b', S.T20b(p, art)];
      if (g === 'subscribeFailed') return ['T20c', S.T20c(p, f.aboFehlerName ?? '', art) + t97];
      return ['T20', S.T20(p, art)];
    }
    if (f.modus === 'sprecher') {
      if (ohneZiel) return ['T26', S.T26(art)];
      if (g === 'cameraOff' || g === 'speakerNoVideo') return ['T27', S.T27(p, art)];
      if (g === 'noFrames') return ['T27b', S.T27b(p, art) + t97];
      if (g === 'bufferMismatch') return ['T20b', S.T20b(p, art)];
      if (g === 'subscribeFailed') return ['T20c', S.T20c(p, f.aboFehlerName ?? '', art) + t97];
      return ['T20', S.T20(p, art)];
    }
    const ziel = `Freigabe von ${p}`;
    if (ohneZiel) return ['T29c', S.T29c(art)];
    if (g === 'sharePaused') return ['T29d', S.T29d(p, art)];
    if (g === 'noFrames') return ['T29e', S.T29e(p, art) + t97];
    if (g === 'bufferMismatch') return ['T20b', S.T20b(ziel, art)];
    if (g === 'subscribeFailed') return ['T20c', S.T20c(ziel, f.aboFehlerName ?? '', art) + t97];
    return ['T20', S.T20(ziel, art)];
  }

  /** Wahrheitsprädikate 10.2 („Prüfung auf Wahrheit“) und 10.5: Steht die Zeile, muss die Lage stimmen. */
  const PRAED: Array<{ name: string; wenn: (t: string) => boolean; dann: (f: KE, ziel0: boolean, t: string) => boolean }> = [
    { name: '„Zeigt …“ (T15, T25, T28) nur in SZ4; Teilnehmer und Sprecher mit sent none, Freigabe mit none oder held',
      wenn: (t) => t.startsWith('Zeigt '), dann: (f) => f.zustand === 'zeigt' && (f.gesendet === 'none' || (f.modus === 'freigabe' && f.gesendet === 'held')) },
    { name: '„erstes Bild steht noch aus“ (T20) nur mit einem Ziel ≠ 0 (Nachfix W7)',
      wenn: (t) => t.includes('erstes Bild steht noch aus'), dann: (_f, ziel0) => !ziel0 },
    { name: '„Ersatzbild …“ nur in SZ6 und mit dem Namen dessen, was gesendet wird (T60 bei eingefroren und transparent)',
      wenn: (t) => t.includes('Ersatzbild'),
      dann: (f, _z, t) => f.zustand === 'ersatz' && (f.ersatzbild === 'eingefroren' && f.gesendet === 'transparent'
        ? t.includes(S.T60) : t.includes(`Ersatzbild ${S.ART[f.gesendet ?? '']}`) && !t.includes('darum transparent')) },
    { name: '„Wartet auf {Person} ·“ (T16) nur, wenn die Person nicht da ist (Ziel 0, nicht im Warteraum, eindeutig)',
      wenn: (t) => t.startsWith('Wartet auf Anna · '), dann: (f, ziel0) => ziel0 && !f.imWarteraum && f.doppelt <= 1 && !f.zweifel },
    { name: '„(im Warteraum)“ (T17) nur, wenn die Person im Warteraum ist', wenn: (t) => t.includes('(im Warteraum)'), dann: (f) => f.imWarteraum },
    { name: '„Kamera aus“ nur mit dem Grund cameraOff bzw. speakerNoVideo',
      wenn: (t) => t.includes('Kamera aus'), dann: (f) => f.grund === 'cameraOff' || f.grund === 'speakerNoVideo' },
    { name: '„Zoom liefert gerade kein Bild“ (T19b, T27b, T29e) nur mit dem Grund noFrames, nie aus einem bloßen Kennzeichen',
      wenn: (t) => t.includes('Zoom liefert gerade kein Bild'), dann: (f) => f.grund === 'noFrames' },
    { name: '„Name doppelt“ (T13) nur ohne gültige gewaehlteId (doppelt > 1)', wenn: (t) => t.includes('Name doppelt'), dann: (f) => f.doppelt > 1 },
    { name: '„die neueste von {m}“ (T28b) nur bei mehr als einer Bild-Freigabe',
      wenn: (t) => t.includes('die neueste von'), dann: (f) => f.freigaben.zahl > 1 },
    { name: '„gehalten“ (T29, T29b) nur in SZ5', wenn: (t) => t.includes('gehalten'), dann: (f) => f.zustand === 'gehalten' },
    { name: '„Gestoppt“ (T12b) nur bei Erlaubnis entzogen und liefSchon',
      wenn: (t) => t.startsWith('Gestoppt'), dann: (f) => f.erlaubnis === 'entzogen' && f.liefSchon },
    { name: '„Aufnahme-Erlaubnis“ nur im Meeting mit Erlaubnis ≠ ja',
      wenn: (t) => t.includes('Aufnahme-Erlaubnis'), dann: (f) => IM.has(f.z) && f.erlaubnis !== 'ja' },
    { name: '„„Stopp“ und wieder „Start““ (T20c, T21, T22, T23) nur in SZ7, SZ8, SZ10 oder bei abgelehntem Abo',
      wenn: (t) => t.includes('„Stopp“ und wieder „Start“'),
      dann: (f) => f.zustand === 'keine_antwort' || f.zustand === 'gescheitert' || f.zustand === 'zurueckgestellt' || f.grund === 'subscribeFailed' },
    { name: 'T97 nur mit einem anderen laufenden Slot desselben Ziels und dem Grund noFrames oder subscribeFailed',
      wenn: (t) => t.includes('zeigt dieselbe Quelle'), dann: (f) => f.andererSlot !== null && (f.grund === 'noFrames' || f.grund === 'subscribeFailed') },
  ];

  let n = 0;
  const abweichungen: string[] = [];
  const zaehler = PRAED.map(() => ({ treffer: 0, verletzt: 0, beispiel: '' }));
  const gesehen = new Set<string>();
  for (const z of [...IM, ...AUSSEN]) for (const erlaubnis of erlaubnisse(z)) for (const zustand of zustaende(z)) for (const modus of MODI) {
    for (const l of lagen(zustand, modus)) {
      const wahlen = modus === 'teilnehmer' && l.ziel0 && zustand !== 'stoppt' ? WAHLEN : EINE;
      for (const w of wahlen) for (const ersatzbild of ERSATZBILDER) for (const liefSchon of [false, true]) for (const andererSlot of [null, 3]) {
        const f: KE = {
          zustand, z, erlaubnis, modus, grund: l.grund, gesendet: l.gesendet, ersatzbild,
          zielName: modus === 'teilnehmer' ? (w.person === '' ? null : 'Anna') : l.ziel0 ? null : modus === 'sprecher' ? 'Ben' : 'Carla',
          person: modus === 'teilnehmer' ? w.person : '', doppelt: w.doppelt, zweifel: w.zweifel, imWarteraum: w.warteraum,
          liefSchon, andererSlot, freigaben: { zahl: l.zahl, namen: NAMEN.slice(0, l.zahl) }, aboFehlerName: ABO, gescheitertText: KLARTEXT,
        };
        n++;
        const ist = kachelZeile(f);
        const [id, text] = soll(f);
        gesehen.add(id);
        if (ist !== text && abweichungen.length < 5) abweichungen.push(`${JSON.stringify(f)} → „${ist}“, erwartet „${text}“`);
        PRAED.forEach((p, i) => {
          if (!p.wenn(ist)) return;
          zaehler[i].treffer++;
          if (!p.dann(f, l.ziel0, ist)) { zaehler[i].verletzt++; if (!zaehler[i].beispiel) zaehler[i].beispiel = `${JSON.stringify(f)} → „${ist}“`; }
        });
      }
    }
  }
  console.log(`     10.2: ${n} Kombinationen geprüft`);
  for (const a of abweichungen) console.log(`     Abweichung: ${a}`);
  ck('10.2 Kachel: jede zulässige Kombination wörtlich nach der ersten passenden Regel', n > 0 && abweichungen.length === 0);
  PRAED.forEach((p, i) => {
    if (zaehler[i].beispiel) console.log(`     verletzt: ${zaehler[i].beispiel}`);
    ck(`10.2 Prädikat: ${p.name}`, zaehler[i].treffer > 0 && zaehler[i].verletzt === 0);
  });
  const ALLE_IDS = ['T10', 'T11a', 'T11b', 'T11c', 'T11h', 'T11d', 'T11e', 'T11f', 'T11g', 'T12a', 'T12b', 'T12d', 'T12c', 'T13', 'T13b', 'T14',
    'T15', 'T16', 'T17', 'T18', 'T19', 'T19b', 'T20', 'T20b', 'T20c', 'T21', 'T22', 'T23', 'T24', 'T25', 'T26', 'T27', 'T27b', 'T28', 'T28b',
    'T29', 'T29b', 'T29d', 'T29e', 'T29c'];
  ck('10.5 Kachel: jede Zeile aus 9.2 (40) kommt im Kreuzprodukt vor', ALLE_IDS.every((id) => gesehen.has(id)) && gesehen.size === ALLE_IDS.length);
}

console.log('— B6 · Fehlerzeile der Kachel (10.9)');
{
  const { kachelFehlerZeile } = await import('../src/shared/zoom-text');
  type SZ = import('../src/shared/types').ZoomSlotZustand;
  const ZS: SZ[] = ['aus', 'ohne_meeting', 'wartet_erlaubnis', 'startet', 'zeigt', 'gehalten', 'ersatz', 'keine_antwort', 'gescheitert', 'stoppt', 'zurueckgestellt', 'geplant'];
  const T101 = 'Der Slot ließ sich nicht aufbauen (SLOT_RENDERER_FAILED). Details im Log.';
  let falsch = 0;
  for (const zustand of ZS) for (const letzterSlotFehler of [null, T101]) for (const seitDemLive of [false, true]) {
    const erwartet = zustand === 'gescheitert' || seitDemLive ? null : letzterSlotFehler;
    if (kachelFehlerZeile({ zustand, letzterSlotFehler, seitDemLive }) !== erwartet) falsch++;
  }
  ck('10.9: Klartext des letzten Slot-Fehlers, bis der Slot danach live meldet (12 Zustände × Fehler × live)', falsch === 0);
  ck('10.9: in SZ8 nie eine Fehlerzeile (der Klartext steht schon in T23)',
    ZS.length === 12 && kachelFehlerZeile({ zustand: 'gescheitert', letzterSlotFehler: T101, seitDemLive: false }) === null);
  ck('10.9: ohne Fehler keine Zeile', kachelFehlerZeile({ zustand: 'ersatz', letzterSlotFehler: null, seitDemLive: false }) === null);
}

// ── Plan B, Task B7: Ton-, Mess- und Vorschauzeile der Kachel (Spec 10.6, 10.7, 7.7, 10.8; Texte 9.3) ──
console.log('— B7 · ST50–ST58i, ST75, ST75b, ST76 wörtlich; Messbeispiele 10.7; Vorschau-Tabelle 7.7 (KF9)');
{
  const { dezimal, kanaeleText, khzText, slotMessZeile, slotTonZeile, UNBEKANNT } = await import('../src/shared/zoom-text');
  const { VORSCHAU_TEXT, vorschauFlaeche } = await import('../src/renderer/src/zoom/slot-vorschau');
  const { tonAboFehlerText } = await import('../src/main/zoom/klartext');
  type TE = import('../src/shared/zoom-text').TonEingabe;
  type ME = import('../src/shared/zoom-text').MessEingabe;
  type VE = import('../src/renderer/src/zoom/slot-vorschau').VorschauEingabe;
  const ton0: TE = {
    zustand: 'zeigt', modus: 'teilnehmer', ziel: 7, grund: 'frames', tonAn: true, tonArt: 'mischton', computerton: true,
    person: 'Anna', doppelt: 1, zweifel: false, imWarteraum: false, ton: 'live', tonGrund: 'packets', quelle: 'mix',
    eingestellt: 'mix', rateKhz: 32, kanaele: 1, tonAboFehler: null, rateMismatch: null,
  };
  const t = (o: Partial<TE>): string | null => slotTonZeile({ ...ton0, ...o });
  const mess0: ME = { zustand: 'zeigt', modus: 'teilnehmer', stufe: '720p', geliefert: { b: 1280, h: 720, fps: 25 }, zuletzt: { b: 1280, h: 720 } };
  const m = (o: Partial<ME>): string | null => slotMessZeile({ ...mess0, ...o });
  const T104 = tonAboFehlerText('AUDIO_HELPER_MISSING');
  const SOLL: Array<[string, string | null, string]> = [
    ['T50', m({}), '720p · Zoom liefert 1280×720 · 25 Bilder/s'],
    ['T51', m({ stufe: '1080p' }), '1080p gewünscht · Zoom liefert 1280×720 · 25 Bilder/s'],
    ['T51b', m({ geliefert: null, zuletzt: null }), '720p gewünscht · noch kein Bild'],
    ['T51c', m({ geliefert: null }), '720p · zuletzt 1280×720 · jetzt kein Bild'],
    ['T50 (Bildrate mit Nachkommastelle)', m({ geliefert: { b: 1280, h: 720, fps: 12.5 } }), '720p · Zoom liefert 1280×720 · 12,5 Bilder/s'],
    ['T52', VORSCHAU_TEXT.T52, 'Vorschau ohne Bild-Versatz, etwa 2 Bilder pro Sekunde.'],
    ['T53', VORSCHAU_TEXT.T53, 'eingefroren'],
    ['T54', VORSCHAU_TEXT.T54, 'gehalten'],
    ['T55', VORSCHAU_TEXT.T55, 'kein Bild'],
    ['T55b', VORSCHAU_TEXT.T55b, 'kein Vorschaubild'],
    ['T56', VORSCHAU_TEXT.T56, 'Vorschau aus'],
    ['T57', VORSCHAU_TEXT.T57('0x887A0005'), 'Vorschau nicht verfügbar (0x887A0005). Bild und Ton laufen unverändert.'],
    ['T58a', t({ tonAn: false, computerton: false }), 'Ton: aus'],
    ['T58a (Computerton zählt nur im Modus Freigabe)', t({ modus: 'sprecher', tonAn: false, computerton: true }), 'Ton: aus'],
    ['T58b (Mischton)', t({ ton: 'waiting', tonGrund: 'command', quelle: 'none' }), 'Ton: Mischton · wartet auf das erste Paket'],
    ['T58b (Person)', t({ tonArt: 'person', ton: 'waiting', tonGrund: 'command', quelle: 'none', eingestellt: 'person' }),
      'Ton: Anna · wartet auf das erste Paket'],
    ['T58b (Person-Ton ohne gewählte Person, RN12)', t({ tonArt: 'person', person: '', ton: 'waiting', tonGrund: 'command', quelle: 'none', eingestellt: 'person' }),
      'Ton: Person-Ton · wartet auf das erste Paket'],
    ['T58b (Mischton + Computerton)', t({ modus: 'freigabe', ton: 'waiting', tonGrund: 'command', quelle: 'none', eingestellt: 'mixShare' }),
      'Ton: Mischton + Computerton · wartet auf das erste Paket'],
    ['T58c (mono)', t({}), 'Ton: Mischton · läuft (32,0 kHz, mono)'],
    ['T58c (Mischton + Computerton, 2 Kanäle)', t({ modus: 'freigabe', eingestellt: 'mixShare', quelle: 'mixShare', rateKhz: 48, kanaele: 2 }),
      'Ton: Mischton + Computerton · läuft (48,0 kHz, 2 Kanäle)'],
    ['T58c (nur Computerton)', t({ modus: 'freigabe', tonAn: false, eingestellt: 'share', quelle: 'share' }), 'Ton: Computerton · läuft (32,0 kHz, mono)'],
    ['T58d', t({ ton: 'silent', tonGrund: 'gap' }), 'Ton: Mischton · Stille (keine Pakete)'],
    ['T58d (live, im letzten Fenster nichts hinausgegangen)', t({ quelle: 'none' }), 'Ton: Mischton · Stille (keine Pakete)'],
    ['T58e', t({ zustand: 'ersatz', tonArt: 'person', ziel: 0, grund: 'participantLeft', ton: 'off', tonGrund: 'participantLeft', quelle: 'none', eingestellt: 'person' }),
      'Ton: Anna · aus, die Person ist nicht im Meeting'],
    ['T58f', t({ zustand: 'ersatz', modus: 'freigabe', tonAn: false, ziel: 0, grund: 'shareNone', ton: 'off', tonGrund: 'noShare', quelle: 'none', eingestellt: 'share' }),
      'Ton: Computerton · wartet auf eine Bildschirmfreigabe'],
    ['T58g', t({ modus: 'freigabe', eingestellt: 'mixShare', quelle: 'mix' }), 'Ton: Mischton · läuft (32,0 kHz, mono) · Computerton kommt nicht an'],
    ['T58h (Slot läuft nicht)', t({ zustand: 'wartet_erlaubnis', ton: 'aus', tonGrund: null, quelle: 'none' }), 'Ton: Mischton, sobald der Slot läuft'],
    ['T58h (aus während eines Wechsels)', t({ ton: 'off', tonGrund: 'modeChanged', quelle: 'none' }), 'Ton: Mischton, sobald der Slot läuft'],
    ['T58i', t({ zustand: 'ersatz', tonArt: 'person', ziel: 0, grund: 'noTarget', doppelt: 2, ton: 'off', tonGrund: 'participantLeft', quelle: 'none', eingestellt: 'person' }),
      'Ton: Person-Ton · aus, bis eine Person gewählt ist'],
    ['T75', t({ modus: 'sprecher', tonArt: 'person', ton: 'off', tonGrund: 'personNotInMode', quelle: 'none', eingestellt: 'none' }),
      'Ton: Person-Ton gibt es nur im Modus Teilnehmer. Der Slot sendet keinen Meeting-Ton.'],
    ['T75 (Slot läuft nicht)', t({ zustand: 'aus', modus: 'sprecher', tonArt: 'person', ton: 'aus', tonGrund: null, quelle: 'none', eingestellt: 'none' }),
      'Ton: Person-Ton gibt es nur im Modus Teilnehmer. Der Slot sendet keinen Meeting-Ton.'],
    ['T75b', t({ modus: 'freigabe', tonArt: 'person', ton: 'off', tonGrund: 'personNotInMode', quelle: 'share', eingestellt: 'share' }),
      'Ton: Person-Ton gibt es nur im Modus Teilnehmer; es läuft nur der Computerton.'],
    ['T76', t({ modus: 'freigabe', eingestellt: 'mixShare', quelle: 'share', tonGrund: 'rateMismatch', rateMismatch: { r1: '32,0 kHz', r2: '48,0 kHz' } }),
      'Ton: Mischton und Computerton passen nicht zusammen (32,0 kHz und 48,0 kHz). Es läuft nur der Computerton.'],
    ['T104 an der Kachel (Text aus B5)', t({ tonAboFehler: T104, ton: 'off', tonGrund: 'audioUnavailable', quelle: 'none' }),
      'Ton nicht verfügbar (AUDIO_HELPER_MISSING) — das Bild läuft ohne Ton. Für einen neuen Versuch den Ton aus- und wieder einschalten.'],
  ];
  for (const [id, ist, soll] of SOLL) ck(`S${id} wörtlich`, ist === soll);
  ck('ST58 in SZ9 mit eingestelltem Ton: keine Tonzeile (Restrunde RR6, N5)', t({ zustand: 'stoppt' }) === null);
  ck('ST58c ohne gemessene Rate und Kanäle: „unbekannt“ (OFP4; kommt nach 6.3 nicht vor)',
    UNBEKANNT === 'unbekannt' && t({ rateKhz: null, kanaele: null }) === 'Ton: Mischton · läuft (unbekannt kHz, unbekannt)');
  ck('Zahlformat: dezimal 29,97 → „30“, 12,5 → „12,5“; khzText 44,1 → „44,1“; kanaeleText 1 → „mono“, 2 → „2 Kanäle“',
    dezimal(29.97) === '30' && dezimal(12.5) === '12,5' && khzText(44.1) === '44,1' && khzText(32) === '32,0'
      && kanaeleText(1) === 'mono' && kanaeleText(2) === '2 Kanäle');
  ck('10.7 Beispiel: 1280×720 bei 1080p → T51', m({ stufe: '1080p' }) === '1080p gewünscht · Zoom liefert 1280×720 · 25 Bilder/s');
  ck('10.7 Beispiel: 960×720 bei 720p → T50', m({ geliefert: { b: 960, h: 720, fps: 25 } }) === '720p · Zoom liefert 960×720 · 25 Bilder/s');
  ck('10.7 Beispiel: 720×1280 (hochkant) bei 720p → T50', m({ geliefert: { b: 720, h: 1280, fps: 25 } }) === '720p · Zoom liefert 720×1280 · 25 Bilder/s');
  ck('10.7 Beispiel: 1920×1200 bei 1080p → T50', m({ stufe: '1080p', geliefert: { b: 1920, h: 1200, fps: 25 } }) === '1080p · Zoom liefert 1920×1200 · 25 Bilder/s');
  ck('10.7 Beispiel: Freigabe 1280×720 bei 1080p → T50 (eigene Größe, MS1)',
    m({ modus: 'freigabe', stufe: '1080p' }) === '1080p · Zoom liefert 1280×720 · 25 Bilder/s');

  const v0: VE = { zustand: 'zeigt', gesendet: 'none', schalterAn: true, verfuegbar: true, detail: null, frisch: true, letzteDiesesZiels: true };
  const v = (o: Partial<VE>): string => JSON.stringify(vorschauFlaeche({ ...v0, ...o }));
  const F = (art: string, kennzeichen: string | null = null, text: string | null = null): string => JSON.stringify({ art, kennzeichen, text });
  const KF9: Array<[string, string, string]> = [
    ['Schalter „Vorschau“ aus → T56', v({ schalterAn: false }), F('leer', null, 'Vorschau aus')],
    ['previewUnavailable → T57, auch an einer ausgeschalteten Kachel', v({ zustand: 'aus', gesendet: null, verfuegbar: false, detail: '0x887A0005' }),
      F('leer', null, 'Vorschau nicht verfügbar (0x887A0005). Bild und Ton laufen unverändert.')],
    ['kein Sender (SZ0) → leere Fläche, T55', v({ zustand: 'aus', gesendet: null }), F('leer', null, 'kein Bild')],
    ['kein Sender (SZ2) → leere Fläche, T55', v({ zustand: 'wartet_erlaubnis', gesendet: null }), F('leer', null, 'kein Bild')],
    ['SZ4, sent none, Vorschau frisch → das Bild', v({}), F('bild')],
    ['SZ4, sent none, ohne frische Vorschau → leere Fläche, T55b, kein Ersatzbild', v({ frisch: false }), F('leer', null, 'kein Vorschaubild')],
    ['SZ4, sent held → letzte Vorschau dieses Ziels ohne Kennzeichen und ohne Frische-Grenze (W1)', v({ gesendet: 'held', frisch: false }), F('letzte')],
    ['SZ4, sent held, ohne letzte Vorschau → leere Fläche, T55b', v({ gesendet: 'held', letzteDiesesZiels: false }), F('leer', null, 'kein Vorschaubild')],
    ['SZ5 → letzte Vorschau dieses Ziels mit T54', v({ zustand: 'gehalten', gesendet: 'held', frisch: false }), F('letzte', 'gehalten')],
    ['SZ5 ohne letzte Vorschau → leere Fläche mit T54 (RR4)', v({ zustand: 'gehalten', gesendet: 'held', letzteDiesesZiels: false }), F('leer', 'gehalten')],
    ['SZ6, sent transparent → Schachbrett', v({ zustand: 'ersatz', gesendet: 'transparent' }), F('schachbrett')],
    ['SZ6, sent black → schwarz', v({ zustand: 'ersatz', gesendet: 'black' }), F('schwarz')],
    ['SZ6, sent white → weiß', v({ zustand: 'ersatz', gesendet: 'white' }), F('weiss')],
    ['SZ6, sent freeze → letzte Vorschau dieses Ziels mit T53', v({ zustand: 'ersatz', gesendet: 'freeze', frisch: false }), F('letzte', 'eingefroren')],
    ['SZ6, sent freeze ohne letzte Vorschau → leere Fläche mit T53, nie Schachbrett (RR4)',
      v({ zustand: 'ersatz', gesendet: 'freeze', letzteDiesesZiels: false }), F('leer', 'eingefroren')],
    ['SZ9 → letzte Fläche, abgeblendet', v({ zustand: 'stoppt' }), F('abgeblendet')],
    ['Schalter aus geht vor „nicht verfügbar“ (Tabellenfolge 7.7)', v({ schalterAn: false, verfuegbar: false, detail: '0x1' }), F('leer', null, 'Vorschau aus')],
  ];
  for (const [name, ist, soll] of KF9) ck(`KF9 ${name}`, ist === soll);
}

console.log('— B7 · Tonzeile 10.6, Messzeile 10.7 und Vorschau 10.8 als Kreuzprodukt (10.5); Zähltest');
{
  const { slotMessZeile, slotTonZeile } = await import('../src/shared/zoom-text');
  const { vorschauFlaeche } = await import('../src/renderer/src/zoom/slot-vorschau');
  const { SLOT_AUDIO_REASONS, SLOT_SENT } = await import('@jm/zoom-bridge/protocol');
  const { tonAboFehlerText } = await import('../src/main/zoom/klartext');
  type TE = import('../src/shared/zoom-text').TonEingabe;
  type ME = import('../src/shared/zoom-text').MessEingabe;
  type VE = import('../src/renderer/src/zoom/slot-vorschau').VorschauEingabe;
  type VF = import('../src/renderer/src/zoom/slot-vorschau').VorschauFlaeche;
  type SZ = import('../src/shared/types').ZoomSlotZustand;
  type Modus = import('../src/shared/types').ZoomSlotModus;
  type Quelle = import('../src/shared/types').TonQuelle;
  type TonArt = import('../src/shared/types').ZoomSlotTonArt;
  type Stufe = import('../src/shared/types').ZoomSlotAufloesung;
  type TonGrund = import('@jm/zoom-bridge/protocol').SlotAudioReason;
  type Sent = import('@jm/zoom-bridge/protocol').SlotSent;

  // Zähltest (10.5 letzter Punkt): Der Record ist vollständig, sonst scheitert der Typcheck.
  const TON_GRUENDE: Record<TonGrund, true> = {
    command: true, packets: true, gap: true, audioUnavailable: true, participantLeft: true, personNotInMode: true, noShare: true,
    rateMismatch: true, targetChanged: true, modeChanged: true, meetingEnded: true, privilegeRevoked: true,
  };
  ck('SlotAudioReason hat 12 Werte', Object.keys(TON_GRUENDE).length === 12 && SLOT_AUDIO_REASONS.length === 12);

  const ZS: SZ[] = ['aus', 'ohne_meeting', 'wartet_erlaubnis', 'startet', 'zeigt', 'gehalten', 'ersatz', 'keine_antwort', 'gescheitert', 'stoppt', 'zurueckgestellt', 'geplant'];
  const OHNE_SENDER = new Set<SZ>(['aus', 'ohne_meeting', 'wartet_erlaubnis', 'startet', 'keine_antwort', 'gescheitert', 'zurueckgestellt', 'geplant']);
  const MODI: Modus[] = ['teilnehmer', 'sprecher', 'freigabe'];
  const QUELLEN: Quelle[] = ['mix', 'person', 'share', 'mixShare', 'none'];
  const mitShare = (q: Quelle): boolean => q === 'share' || q === 'mixShare';

  // ── Tonzeile ──
  // Texte 9.3 und Ton-Abbildung 7.1 mit dem Tonweg 6.13, aus der Spec abgeschrieben (nicht aus dem Modul)
  const S = {
    T58a: 'Ton: aus',
    T58b: (q: string): string => `Ton: ${q} · wartet auf das erste Paket`,
    T58c: (q: string, rate: string, k: string): string => `Ton: ${q} · läuft (${rate} kHz, ${k})`,
    T58d: (q: string): string => `Ton: ${q} · Stille (keine Pakete)`,
    T58e: (p: string): string => `Ton: ${p} · aus, die Person ist nicht im Meeting`,
    T58f: 'Ton: Computerton · wartet auf eine Bildschirmfreigabe',
    T58g: ' · Computerton kommt nicht an',
    T58h: (q: string): string => `Ton: ${q}, sobald der Slot läuft`,
    T58i: 'Ton: Person-Ton · aus, bis eine Person gewählt ist',
    T75: 'Ton: Person-Ton gibt es nur im Modus Teilnehmer. Der Slot sendet keinen Meeting-Ton.',
    T75b: 'Ton: Person-Ton gibt es nur im Modus Teilnehmer; es läuft nur der Computerton.',
    T76: (r1: string, r2: string): string => `Ton: Mischton und Computerton passen nicht zusammen (${r1} und ${r2}). Es läuft nur der Computerton.`,
  };
  const name = (q: Quelle, person: string): string =>
    q === 'mix' ? 'Mischton' : q === 'share' ? 'Computerton' : q === 'mixShare' ? 'Mischton + Computerton' : person === '' ? 'Person-Ton' : person;
  function wegLautSpec(modus: Modus, tonAn: boolean, tonArt: TonArt, computerton: boolean): Quelle {
    const audio = !tonAn ? 'off' : tonArt === 'mischton' ? 'mix' : 'person';
    if (modus === 'freigabe') {
      if (audio === 'mix') return computerton ? 'mixShare' : 'mix';
      return computerton ? 'share' : 'none';
    }
    if (audio === 'mix') return 'mix';
    return audio === 'person' && modus === 'teilnehmer' ? 'person' : 'none';
  }
  const weg = (f: TE): Quelle => (f.eingestellt !== 'none' ? f.eingestellt : wegLautSpec(f.modus, f.tonAn, f.tonArt, f.computerton));
  const eingestellt = (f: TE): boolean => f.tonAn || (f.modus === 'freigabe' && f.computerton);
  function tonSoll(f: TE): string | null {
    if (!eingestellt(f)) return S.T58a;                                                                  // Regel 1
    const w = weg(f);
    if (f.zustand === 'stoppt') return null;                                                             // Regel 2
    if (OHNE_SENDER.has(f.zustand)) return w === 'none' ? S.T75 : S.T58h(name(w, f.person));
    if (f.tonAboFehler !== null) return f.tonAboFehler;                                                  // Regel 3
    if (f.tonAn && f.tonArt === 'person' && f.modus !== 'teilnehmer') {                                 // Regel 4
      return f.modus === 'freigabe' && f.computerton && mitShare(f.quelle) ? S.T75b : S.T75;
    }
    if (f.rateMismatch !== null) return S.T76(f.rateMismatch.r1, f.rateMismatch.r2);                     // Regel 5
    if (f.modus === 'teilnehmer' && f.tonAn && f.tonArt === 'person' && f.ziel === 0) {                 // Regel 6
      return f.doppelt > 1 || f.zweifel || f.person === '' ? S.T58i : S.T58e(f.person);
    }
    if (f.modus === 'freigabe' && !f.tonAn && f.computerton && f.ziel === 0) return S.T58f;             // Regel 7
    if (w === 'none') return S.T75;
    if (f.ton === 'waiting') return S.T58b(name(w, f.person));                                           // Regel 8
    if (f.ton === 'live') {                                                                              // Regel 9
      if (f.quelle === 'none') return S.T58d(name(w, f.person));   // nichts hinausgegangen: Stille (Lesart des Plans)
      const k = f.kanaele === 1 ? 'mono' : `${f.kanaele} Kanäle`;
      return S.T58c(name(f.quelle, f.person), (f.rateKhz ?? 0).toFixed(1).replace('.', ','), k) + (mitShare(w) && !mitShare(f.quelle) ? S.T58g : '');
    }
    if (f.ton === 'silent') return S.T58d(name(w, f.person));                                            // Regel 10
    return S.T58h(name(w, f.person));                                                                    // Regel 11
  }
  const TPRAED: Array<{ name: string; wenn: (f: TE, t: string | null) => boolean; dann: (f: TE, t: string | null) => boolean }> = [
    { name: '„· läuft (“ (T58c) nur mit dem Ton-Zustand live', wenn: (_f, t) => t?.includes('· läuft (') === true, dann: (f) => f.ton === 'live' },
    { name: '„es läuft nur der Computerton“ (T75b) nur, wenn source share enthält',
      wenn: (_f, t) => t?.includes('es läuft nur der Computerton') === true, dann: (f) => mitShare(f.quelle) },
    { name: '„Person-Ton gibt es nur“ (T75, T75b) nur mit tonAn, Tonart Person und Modus außer Teilnehmer',
      wenn: (_f, t) => t?.includes('Person-Ton gibt es nur') === true, dann: (f) => f.tonAn && f.tonArt === 'person' && f.modus !== 'teilnehmer' },
    { name: '„nicht im Meeting“ (T58e) nur mit gewählter Person, doppelt ≤ 1 und ohne zweifel',
      wenn: (_f, t) => t?.includes('nicht im Meeting') === true, dann: (f) => f.person !== '' && f.doppelt <= 1 && !f.zweifel },
    { name: '„wartet auf eine Bildschirmfreigabe“ (T58f) nur im Modus Freigabe mit Ziel 0',
      wenn: (_f, t) => t?.includes('wartet auf eine Bildschirmfreigabe') === true, dann: (f) => f.modus === 'freigabe' && f.ziel === 0 },
    { name: '„Computerton“ in der Quelle von T58c nur, wenn er gemessen hinausgeht',
      wenn: (_f, t) => t !== null && /^Ton: (Computerton|Mischton \+ Computerton) · läuft/.test(t), dann: (f) => mitShare(f.quelle) },
    { name: '„Ton: aus“ nur, wenn nichts eingestellt ist (nie bei eingeschaltetem Ton, etwa in SZ1 oder SZ2)',
      wenn: (_f, t) => t === 'Ton: aus', dann: (f) => !eingestellt(f) },
    { name: 'in SZ9 keine Tonzeile außer „Ton: aus“ (N5, RR6)', wenn: (f) => f.zustand === 'stoppt', dann: (_f, t) => t === null || t === 'Ton: aus' },
    { name: 'keine Tonzeile (null) nur in SZ9 mit eingestelltem Ton', wenn: (_f, t) => t === null, dann: (f) => f.zustand === 'stoppt' && eingestellt(f) },
    { name: '„Ton nicht verfügbar“ (T104) nur mit Ton-Abo-Fehler oder eigenem Ton-Zustand off/audioUnavailable',
      wenn: (_f, t) => t?.startsWith('Ton nicht verfügbar') === true, dann: (f) => f.tonAboFehler !== null || (f.ton === 'off' && f.tonGrund === 'audioUnavailable') },
    { name: '„Computerton kommt nicht an“ (T58g) nur, wenn er eingestellt ist und source ihn nicht enthält',
      wenn: (_f, t) => t?.includes('Computerton kommt nicht an') === true, dann: (f) => mitShare(weg(f)) && !mitShare(f.quelle) },
    { name: '„bis eine Person gewählt ist“ (T58i) nur bei Teilnehmer, Person-Ton, Ziel 0 und doppelt > 1, zweifel oder keiner Person',
      wenn: (_f, t) => t?.includes('bis eine Person gewählt ist') === true,
      dann: (f) => f.modus === 'teilnehmer' && f.tonAn && f.tonArt === 'person' && f.ziel === 0 && (f.doppelt > 1 || f.zweifel || f.person === '') },
    { name: '„sobald der Slot läuft“ (T58h) nur ohne Sender oder ohne laufenden Ton (off oder keine Meldung)',
      wenn: (_f, t) => t?.includes('sobald der Slot läuft') === true, dann: (f) => OHNE_SENDER.has(f.zustand) || f.ton === 'off' || f.ton === 'aus' },
    { name: '„passen nicht zusammen“ (T76) nur mit gemeldetem rateMismatch',
      wenn: (_f, t) => t?.includes('passen nicht zusammen') === true, dann: (f) => f.rateMismatch !== null },
  ];
  const ZIEL0_GRUND = { teilnehmer: 'participantLeft', sprecher: 'speakerNone', freigabe: 'shareNone' } as const;
  const T104 = tonAboFehlerText('AUDIO_SUBSCRIBE_FAILED');
  interface Wahl { person: string; doppelt: number; zweifel: boolean; warteraum: boolean }
  const EINE: Wahl[] = [{ person: 'Anna', doppelt: 1, zweifel: false, warteraum: false }];
  const WAHLEN: Wahl[] = [];
  for (const person of ['Anna', '']) for (const doppelt of [1, 2]) for (const zweifel of [false, true]) for (const warteraum of [false, true]) {
    WAHLEN.push({ person, doppelt, zweifel, warteraum });
  }
  const EINSTELLUNGEN: Array<[boolean, TonArt, boolean]> = [];
  for (const tonAn of [false, true]) for (const tonArt of ['mischton', 'person'] as TonArt[]) for (const computerton of [false, true]) EINSTELLUNGEN.push([tonAn, tonArt, computerton]);
  let nTon = 0;
  const tAbw: string[] = [];
  const tZaehler = TPRAED.map(() => ({ treffer: 0, verletzt: 0, beispiel: '' }));
  for (const zustand of ZS) for (const modus of MODI) {
    if (zustand === 'gehalten' && modus !== 'freigabe') continue;
    const laeuft = zustand === 'zeigt' || zustand === 'gehalten' || zustand === 'ersatz';
    const ziele = zustand === 'zeigt' || zustand === 'gehalten' ? [7] : laeuft || zustand === 'stoppt' ? [0, 7] : [0];
    for (const ziel of ziele) {
      const wahlen = modus === 'teilnehmer' && ziel === 0 && laeuft ? WAHLEN : EINE;
      for (const w of wahlen) for (const [tonAn, tonArt, computerton] of EINSTELLUNGEN) {
        const eingestellte: Quelle[] = laeuft || zustand === 'stoppt' ? QUELLEN : [wegLautSpec(modus, tonAn, tonArt, computerton)];
        for (const ton of ['waiting', 'live', 'silent', 'off', 'aus'] as const) {
          for (const tonGrund of (ton === 'aus' ? [null] : SLOT_AUDIO_REASONS) as ReadonlyArray<TonGrund | null>) {
            for (const quelle of ton === 'aus' ? (['none'] as Quelle[]) : QUELLEN) for (const eing of eingestellte) {
              for (const tonAboFehler of [null, T104]) for (const kanaele of ton === 'live' ? [1, 2] : [null]) {
                if (ton === 'off' && tonGrund === 'audioUnavailable' && tonAboFehler === null) continue;   // Kern-Vertrag 7.1 (B14)
                const f: TE = {
                  zustand, modus, ziel, grund: ziel === 0 ? ZIEL0_GRUND[modus] : 'frames', tonAn, tonArt, computerton,
                  person: w.person, doppelt: w.doppelt, zweifel: w.zweifel, imWarteraum: w.warteraum, ton, tonGrund, quelle, eingestellt: eing,
                  rateKhz: ton === 'live' ? 32 : null, kanaele, tonAboFehler,
                  rateMismatch: tonGrund === 'rateMismatch' ? { r1: '32,0 kHz', r2: '48,0 kHz' } : null,
                };
                nTon++;
                const ist = slotTonZeile(f);
                const soll = tonSoll(f);
                if (ist !== soll && tAbw.length < 5) tAbw.push(`${JSON.stringify(f)} → ${JSON.stringify(ist)}, erwartet ${JSON.stringify(soll)}`);
                TPRAED.forEach((p, i) => {
                  if (!p.wenn(f, ist)) return;
                  tZaehler[i].treffer++;
                  if (!p.dann(f, ist)) { tZaehler[i].verletzt++; if (!tZaehler[i].beispiel) tZaehler[i].beispiel = `${JSON.stringify(f)} → ${JSON.stringify(ist)}`; }
                });
              }
            }
          }
        }
      }
    }
  }
  console.log(`     10.6: ${nTon} Kombinationen geprüft`);
  for (const a of tAbw) console.log(`     Abweichung: ${a}`);
  ck('10.6 Tonzeile: jede zulässige Kombination wörtlich nach der ersten passenden Regel', nTon > 0 && tAbw.length === 0);
  TPRAED.forEach((p, i) => {
    if (tZaehler[i].beispiel) console.log(`     verletzt: ${tZaehler[i].beispiel}`);
    ck(`10.6 Prädikat: ${p.name}`, tZaehler[i].treffer > 0 && tZaehler[i].verletzt === 0);
  });

  // ── Messzeile ──
  const NENN: Record<Stufe, number> = { '360p': 360, '720p': 720, '1080p': 1080 };
  const GROESSEN: Array<[number, number] | null> = [null, [1280, 720], [1920, 1080], [960, 720], [720, 1280], [1920, 1200], [640, 360]];
  function messSoll(f: ME): string | null {
    if (f.zustand !== 'zeigt' && f.zustand !== 'gehalten' && f.zustand !== 'ersatz') return null;
    if (f.geliefert !== null) {
      const g = f.geliefert;
      return f.modus !== 'freigabe' && Math.min(g.b, g.h) < NENN[f.stufe]
        ? `${f.stufe} gewünscht · Zoom liefert ${g.b}×${g.h} · ${g.fps} Bilder/s`
        : `${f.stufe} · Zoom liefert ${g.b}×${g.h} · ${g.fps} Bilder/s`;
    }
    return f.zuletzt !== null ? `${f.stufe} · zuletzt ${f.zuletzt.b}×${f.zuletzt.h} · jetzt kein Bild` : `${f.stufe} gewünscht · noch kein Bild`;
  }
  const MPRAED: Array<{ name: string; wenn: (f: ME, t: string | null) => boolean; dann: (f: ME, t: string | null) => boolean }> = [
    { name: 'Messzeile nur, solange der Sender läuft (SZ4–SZ6); in SZ9 keine (RR6)',
      wenn: (_f, t) => t !== null, dann: (f) => f.zustand === 'zeigt' || f.zustand === 'gehalten' || f.zustand === 'ersatz' },
    { name: '„Zoom liefert“ (T50, T51) nur mit einem Bild im laufenden Fenster', wenn: (_f, t) => t?.includes('Zoom liefert') === true, dann: (f) => f.geliefert !== null },
    { name: '„Bilder/s“ nur mit Bildern im Fenster, nie „0 Bilder/s“ neben einer alten Größe',
      wenn: (_f, t) => t?.includes('Bilder/s') === true, dann: (f, t) => f.geliefert !== null && f.geliefert.fps > 0 && t?.includes(' 0 Bilder/s') === false },
    { name: '„zuletzt … jetzt kein Bild“ (T51c) nur ohne Bild im Fenster und mit früherem Bild dieses Ziels',
      wenn: (_f, t) => t?.includes('jetzt kein Bild') === true, dann: (f) => f.geliefert === null && f.zuletzt !== null },
    { name: '„noch kein Bild“ (T51b) nur ohne jedes Bild dieses Ziels',
      wenn: (_f, t) => t?.includes('noch kein Bild') === true, dann: (f) => f.geliefert === null && f.zuletzt === null },
    { name: '„gewünscht · Zoom liefert“ (T51) nur bei Teilnehmer und Sprecher mit kürzerer Seite unter der Stufe',
      wenn: (_f, t) => t?.includes('gewünscht · Zoom liefert') === true,
      dann: (f) => f.modus !== 'freigabe' && f.geliefert !== null && Math.min(f.geliefert.b, f.geliefert.h) < NENN[f.stufe] },
  ];
  let nMess = 0;
  const mAbw: string[] = [];
  const mZaehler = MPRAED.map(() => ({ treffer: 0, verletzt: 0 }));
  for (const zustand of ZS) for (const modus of MODI) for (const stufe of ['360p', '720p', '1080p'] as Stufe[]) for (const gr of GROESSEN) {
    for (const imFenster of [false, true]) for (const frueher of [false, true]) {
      const f: ME = {
        zustand, modus, stufe,
        geliefert: gr !== null && imFenster ? { b: gr[0], h: gr[1], fps: 25 } : null,
        zuletzt: gr !== null && frueher ? { b: gr[0], h: gr[1] } : null,
      };
      nMess++;
      const ist = slotMessZeile(f);
      if (ist !== messSoll(f) && mAbw.length < 5) mAbw.push(`${JSON.stringify(f)} → ${JSON.stringify(ist)}`);
      MPRAED.forEach((p, i) => { if (p.wenn(f, ist)) { mZaehler[i].treffer++; if (!p.dann(f, ist)) mZaehler[i].verletzt++; } });
    }
  }
  console.log(`     10.7: ${nMess} Kombinationen geprüft`);
  for (const a of mAbw) console.log(`     Abweichung: ${a}`);
  ck('10.7 Messzeile: jede Kombination wörtlich', nMess > 0 && mAbw.length === 0);
  MPRAED.forEach((p, i) => ck(`10.7 Prädikat: ${p.name}`, mZaehler[i].treffer > 0 && mZaehler[i].verletzt === 0));

  // ── Vorschau ──
  const VT = { T53: 'eingefroren', T54: 'gehalten', T55: 'kein Bild', T55b: 'kein Vorschaubild', T56: 'Vorschau aus' };
  const fl = (art: VF['art'], kennzeichen: string | null = null, text: string | null = null): VF => ({ art, kennzeichen, text });
  function vorschauSoll(f: VE): VF {   // Tabelle 7.7, Zeile für Zeile
    if (!f.schalterAn) return fl('leer', null, VT.T56);
    if (!f.verfuegbar) return fl('leer', null, `Vorschau nicht verfügbar (${f.detail}). Bild und Ton laufen unverändert.`);
    if (OHNE_SENDER.has(f.zustand)) return fl('leer', null, VT.T55);
    if (f.zustand === 'zeigt' && f.gesendet === 'held') return f.letzteDiesesZiels ? fl('letzte') : fl('leer', null, VT.T55b);
    if (f.zustand === 'zeigt') return f.frisch ? fl('bild') : fl('leer', null, VT.T55b);
    if (f.zustand === 'gehalten') return fl(f.letzteDiesesZiels ? 'letzte' : 'leer', VT.T54);
    if (f.zustand === 'ersatz') {
      if (f.gesendet === 'transparent') return fl('schachbrett');
      if (f.gesendet === 'black') return fl('schwarz');
      if (f.gesendet === 'white') return fl('weiss');
      return fl(f.letzteDiesesZiels ? 'letzte' : 'leer', VT.T53);   // freeze
    }
    return fl('abgeblendet');   // SZ9
  }
  const ERSATZ_ART = new Set<VF['art']>(['schachbrett', 'schwarz', 'weiss']);
  const VPRAED: Array<{ name: string; wenn: (f: VE, v: VF) => boolean; dann: (f: VE, v: VF) => boolean }> = [
    { name: 'Schachbrett, Schwarz oder Weiß nur in SZ6 mit passendem sent (Schachbrett nur mit transparent)',
      wenn: (_f, v) => ERSATZ_ART.has(v.art),
      dann: (f, v) => f.zustand === 'ersatz' && ({ schachbrett: 'transparent', schwarz: 'black', weiss: 'white' } as Record<string, Sent>)[v.art] === f.gesendet },
    { name: 'Kennzeichen „gehalten“ (T54) nur in SZ5', wenn: (_f, v) => v.kennzeichen === VT.T54, dann: (f) => f.zustand === 'gehalten' },
    { name: 'Kennzeichen „eingefroren“ (T53) nur mit sent = freeze', wenn: (_f, v) => v.kennzeichen === VT.T53, dann: (f) => f.gesendet === 'freeze' },
    { name: 'SZ5 oder sent = freeze ohne letzte Vorschau: leere Fläche mit Kennzeichen, nie ein Ersatzbild (RR4)',
      wenn: (f) => f.schalterAn && f.verfuegbar && !f.letzteDiesesZiels && (f.zustand === 'gehalten' || (f.zustand === 'ersatz' && f.gesendet === 'freeze')),
      dann: (_f, v) => v.art === 'leer' && v.kennzeichen !== null },
    { name: 'in SZ4 nie ein Ersatzbild', wenn: (f) => f.zustand === 'zeigt', dann: (_f, v) => !ERSATZ_ART.has(v.art) },
    { name: 'SZ4 mit sent = held und letzter Vorschau dieses Ziels: die letzte ohne Kennzeichen, nie T55b (W1)',
      wenn: (f) => f.schalterAn && f.verfuegbar && f.zustand === 'zeigt' && f.gesendet === 'held' && f.letzteDiesesZiels,
      dann: (_f, v) => v.art === 'letzte' && v.kennzeichen === null && v.text === null },
    { name: 'das Bild nur in SZ4 mit sent none und frischer Vorschau', wenn: (_f, v) => v.art === 'bild', dann: (f) => f.zustand === 'zeigt' && f.gesendet === 'none' && f.frisch },
    { name: 'T56 genau bei ausgeschaltetem Schalter, T57 nur, wenn die Vorschau nicht verfügbar ist',
      wenn: (_f, v) => v.text !== null && (v.text === VT.T56 || v.text.startsWith('Vorschau nicht verfügbar')),
      dann: (f, v) => (v.text === VT.T56 ? !f.schalterAn : f.schalterAn && !f.verfuegbar) },
  ];
  function sendeArten(sz: SZ): (Sent | null)[] {
    if (sz === 'zeigt') return ['none', 'held'];
    if (sz === 'gehalten') return ['held'];
    if (sz === 'ersatz') return ['transparent', 'freeze', 'black', 'white'];
    if (sz === 'stoppt') return [...SLOT_SENT];
    return [null];
  }
  let nVor = 0;
  const vAbw: string[] = [];
  const vZaehler = VPRAED.map(() => ({ treffer: 0, verletzt: 0 }));
  for (const zustand of ZS) for (const gesendet of sendeArten(zustand)) for (const schalterAn of [false, true]) for (const verfuegbar of [false, true]) {
    for (const frisch of [false, true]) for (const letzteDiesesZiels of [false, true]) {
      const f: VE = { zustand, gesendet, schalterAn, verfuegbar, detail: '0x887A0005', frisch, letzteDiesesZiels };
      nVor++;
      const ist = vorschauFlaeche(f);
      if (JSON.stringify(ist) !== JSON.stringify(vorschauSoll(f)) && vAbw.length < 5) vAbw.push(`${JSON.stringify(f)} → ${JSON.stringify(ist)}`);
      VPRAED.forEach((p, i) => { if (p.wenn(f, ist)) { vZaehler[i].treffer++; if (!p.dann(f, ist)) vZaehler[i].verletzt++; } });
    }
  }
  console.log(`     10.8: ${nVor} Kombinationen geprüft`);
  for (const a of vAbw) console.log(`     Abweichung: ${a}`);
  ck('10.8 Vorschau: jede zulässige Kombination nach der Tabelle 7.7', nVor > 0 && vAbw.length === 0);
  VPRAED.forEach((p, i) => ck(`10.8 Prädikat: ${p.name}`, vZaehler[i].treffer > 0 && vZaehler[i].verletzt === 0));
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
