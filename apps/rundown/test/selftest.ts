// Selbsttest der reinen Conductor-Logik (kein Framework):
//   node --experimental-strip-types test/selftest.ts
import { buildActionLine, clampIndex, mergeEndpoints, navigate } from '../src/shared/conductor.ts';
import type { RundownDoc } from '../src/shared/types.ts';
import { kontextVon, wendeShowAn } from '../src/shared/abgleich.ts';
import { parseShow, serializeShow } from '@jm/show';
import { LEERER_BERICHT, berichtIstLeer, ersatzSchluessel, gleicheAb } from '../src/shared/abgleich.ts';
import type { AbgleichBericht } from '../src/shared/abgleich.ts';
import type { RundownAction, RundownRow } from '../src/shared/types.ts';
import type { ShowAblaufItem } from '@jm/show';
import { migrate } from '../src/shared/doc-format.ts';

import { loeseSprungZiel } from '../src/shared/sprung.ts';
import type { RundownAction as A7Aktion, RundownDoc as A7Doc, RundownRow as A7Zeile } from '../src/shared/types.ts';

import {
  alsEigeneZeile,
  bereinigeQuellen,
  erzeugeBuendler,
  ersetzeEigeneZeilen,
  indexVon,
  nimmAenderungAn,
  scharfNachBearbeitung,
} from '../src/shared/scharf.ts';

import { waehleAusgangsstand } from '../src/shared/ausgangsstand.ts';
import type { DateiStand as A8DateiStand, GedaechtnisInhalt as A8Gedaechtnis } from '../src/shared/ausgangsstand.ts';
import type { RundownDoc as A8Doc } from '../src/shared/types.ts';

import * as hinweisModul from '../src/shared/hinweise.ts';
import * as zeilenModul from '../src/shared/zeilen.ts';
import * as sprungModul from '../src/shared/sprung.ts';
import * as abgleichModul from '../src/shared/abgleich.ts';
import {
  aktionAendern,
  istSpeakerAbruf,
  loeseSpeakerZiel,
  SPEAKER_NICHT_IN_LISTE,
  speakerChipArgs,
  speakerOptionen,
  speakerPatch,
  titlerKannKennung,
} from '../src/shared/zeilen.ts';
import { normAction } from '../src/shared/doc-format.ts';
import type { ShowIveoSpeaker } from '@jm/show';

let failed = 0;
function eq(actual: unknown, expected: unknown, msg: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failed++;
    console.error(`FAIL ${msg}\n  erwartet: ${e}\n  bekommen: ${a}`);
  } else {
    console.log(`ok   ${msg}`);
  }
}

// ── buildActionLine ──────────────────────────────────────────────────────────
eq(buildActionLine('timer', 'start', []), 'TIMER START', 'timer start → TIMER START');
eq(buildActionLine('presenter', 'goto', [3]), 'PRESENTER GOTO 3', 'presenter goto 3');
eq(buildActionLine('titler', 'template', ['banner']), 'TITLER TEMPLATE banner', 'titler template banner');
eq(buildActionLine('switcher', 'program', [2]), 'PROGRAM 2', 'switcher program → KEIN NS');
eq(buildActionLine('switcher', 'cut', []), 'CUT', 'switcher cut');
eq(buildActionLine('player', 'cue', [5]), 'PLAYER CUE 5', 'player cue 5');

// ── clampIndex ───────────────────────────────────────────────────────────────
eq(clampIndex(5, 3), 2, 'clamp oben');
eq(clampIndex(-1, 3), 0, 'clamp unten');
eq(clampIndex(0, 0), 0, 'leeres Dokument → 0');

// ── navigate ─────────────────────────────────────────────────────────────────
const doc: RundownDoc = {
  schemaVersion: 1,
  name: 'Test',
  rows: [
    {
      id: 'r1',
      label: 'Opener',
      actions: [
        { id: 'a1', role: 'timer', verb: 'start', args: [], enabled: true },
        { id: 'a2', role: 'titler', verb: 'take', args: [], enabled: true },
        { id: 'a3', role: 'player', verb: 'cue', args: [1], enabled: false }, // deaktiviert
      ],
    },
    { id: 'r2', label: 'Talk', actions: [{ id: 'a4', role: 'presenter', verb: 'goto', args: [1], enabled: true }] },
    { id: 'r3', label: 'Outro', actions: [] },
  ],
};

const go0 = navigate(doc, 0, { t: 'go' });
eq(go0.index, 1, 'GO auf Zeile 0 → Index 1 (eins weiter)');
eq(go0.fire.map((a) => a.id), ['a1', 'a2'], 'GO feuert nur aktivierte Aktionen (a3 aus)');

eq(navigate(doc, 0, { t: 'next' }).index, 1, 'NEXT → +1');
eq(navigate(doc, 0, { t: 'next' }).fire.length, 0, 'NEXT feuert nicht');
eq(navigate(doc, 1, { t: 'prev' }).index, 0, 'PREV → -1');
eq(navigate(doc, 0, { t: 'prev' }).index, 0, 'PREV an der Untergrenze bleibt 0');
eq(navigate(doc, 2, { t: 'go' }).index, 2, 'GO auf letzter Zeile bleibt (clamp)');
eq(navigate(doc, 2, { t: 'go' }).fire.length, 0, 'GO auf leerer Zeile feuert nichts');
eq(navigate(doc, 0, { t: 'goto', n: 3 }).index, 2, 'GOTO 3 (1-basiert) → Index 2');
eq(navigate(doc, 0, { t: 'goto', n: 99 }).index, 2, 'GOTO über Ende → letzte Zeile');

// ── mergeEndpoints (mDNS + manuelle Overrides, Override gewinnt) ──────────────
eq(
  mergeEndpoints({ timer: { host: '10.0.0.5', port: 8724 } }, {}),
  { timer: { host: '10.0.0.5', port: 8724, source: 'mdns' } },
  'mDNS-Fund ohne Override → source mdns',
);
eq(
  mergeEndpoints(
    { timer: { host: '10.0.0.5', port: 8724 } },
    { timer: { host: '192.168.1.9', port: 8724 } },
  ),
  { timer: { host: '192.168.1.9', port: 8724, source: 'manual' } },
  'Override gewinnt über mDNS',
);
eq(
  mergeEndpoints({}, { switcher: { host: '192.168.1.2', port: 8723 } }),
  { switcher: { host: '192.168.1.2', port: 8723, source: 'manual' } },
  'reiner Override (kein mDNS) → source manual',
);

// ── Dateiformat Version 2 (Master-Link 2a, Spec 4.1) ─────────────────────────
{
  let zaehler = 0;
  const neueId = (praefix: 'r' | 'a'): string => `${praefix}${++zaehler}`;

  // Version 1: alles wird eigene Zeile, Titel-Zuordnung steht aus.
  eq(
    migrate(
      {
        schemaVersion: 1,
        name: 'COP31 Tag 1',
        rows: [
          {
            id: 'r_alt1',
            label: 'Begrüßung',
            quelle: 'ablauf',
            entfallen: true,
            actions: [{ id: 'a_1', role: 'titler', verb: 'take', args: [], enabled: true }],
          },
          { label: 'Ohne id', durationMs: 90000.7, actions: [{ role: 'timer', verb: 'goto', args: [2], delayMs: 500, zielId: 'u1' }] },
        ],
        fremd: 'fällt weg',
      },
      neueId,
    ),
    {
      schemaVersion: 2,
      name: 'COP31 Tag 1',
      rows: [
        { id: 'r_alt1', label: 'Begrüßung', actions: [{ id: 'a_1', role: 'titler', verb: 'take', args: [], enabled: true }] },
        {
          id: 'r1',
          label: 'Ohne id',
          actions: [{ id: 'a2', role: 'timer', verb: 'goto', args: [2], enabled: true, delayMs: 500, zielId: 'u1' }],
          durationMs: 90000,
        },
      ],
      zuordnungOffen: true,
    },
    'migrate v1 → schemaVersion 2, zuordnungOffen, keine quelle/entfallen, fehlende IDs über neueId',
  );

  // Version 2: neue Felder bleiben, Unbekanntes und Ungültiges fällt weg.
  eq(
    migrate(
      {
        schemaVersion: 2,
        name: 'Gala',
        kontext: 'se:p1',
        rows: [
          {
            id: 'u1',
            quelle: 'ablauf',
            label: 'Keynote',
            actions: [{ id: 'a0', role: 'timer', verb: 'goto', args: [3], enabled: true, zielId: '' }],
          },
          {
            id: 'u2',
            quelle: 'ablauf',
            entfallen: true,
            label: 'Panel',
            actions: [{ id: 'a1', role: 'titler', verb: 'take', args: [], enabled: false, zielId: 'u1' }],
          },
          { id: 'r9', label: 'Eigene', quelle: 'iveo', entfallen: true, actions: [] },
        ],
        archiv: {
          'liste:2026-11-10|||0': [{ id: 'u7', quelle: 'ablauf', label: 'Alt', actions: [] }],
          kaputt: [{ id: 'k', label: 'kein Kontext', actions: [] }],
          'se:p2': 'kein Array',
        },
        zuordnungOffen: true,
        unbekannt: 1,
      },
      neueId,
    ),
    {
      schemaVersion: 2,
      name: 'Gala',
      rows: [
        { id: 'u1', label: 'Keynote', actions: [{ id: 'a0', role: 'timer', verb: 'goto', args: [3], enabled: true }], quelle: 'ablauf' },
        {
          id: 'u2',
          label: 'Panel',
          actions: [{ id: 'a1', role: 'titler', verb: 'take', args: [], enabled: false, zielId: 'u1' }],
          quelle: 'ablauf',
          entfallen: true,
        },
        { id: 'r9', label: 'Eigene', actions: [] },
      ],
      kontext: 'se:p1',
      archiv: { 'liste:2026-11-10|||0': [{ id: 'u7', label: 'Alt', actions: [], quelle: 'ablauf' }] },
      zuordnungOffen: true,
    },
    'migrate v2 → quelle/entfallen/kontext/archiv/zuordnungOffen bleiben, Ungültiges fällt weg',
  );

  // Kontext-Schlüssel, die keine sind (auch __proto__ aus JSON), fallen weg.
  eq(
    migrate(JSON.parse('{"schemaVersion":2,"name":"X","rows":[],"kontext":"__proto__","archiv":{"__proto__":[],"bogus":[]}}'), neueId),
    { schemaVersion: 2, name: 'X', rows: [] },
    'migrate v2 → ungültiger kontext und Archiv-Schlüssel fallen weg',
  );

  // Kaputtes JSON-Gerüst → leeres Version-1-Dokument.
  eq(migrate(null, neueId), { schemaVersion: 2, name: 'Ablauf', rows: [], zuordnungOffen: true }, 'migrate(null) → leeres Dokument');
  eq(migrate('kaputt', neueId), { schemaVersion: 2, name: 'Ablauf', rows: [], zuordnungOffen: true }, 'migrate(String) → leeres Dokument');

  // Spec 9.1 Fall 24, Teil 1: Version-1-Datei ohne Show gespeichert → bleibt zuordnungOffen.
  const einmal = migrate({ schemaVersion: 1, name: 'Alt', rows: [{ id: 'r1', label: 'A', actions: [] }] }, neueId);
  const zweimal = migrate(JSON.parse(JSON.stringify(einmal)), neueId);
  eq(zweimal, einmal, 'Fall 24 (Teil 1): v1 ohne Show als v2 gespeichert → zuordnungOffen bleibt');
}

// ── Abgleich: Schlüssel und Bericht (Master-Link 2a, Spec 3.4, 3.5, R9) ──────
eq(ersatzSchluessel([{ id: 'u1', label: 'A' }, { label: 'B' }]), ['u1', 'ersatz:B'], 'Schlüssel: id, sonst ersatz:<Titel>');
eq(ersatzSchluessel([]), [], 'Schlüssel: leerer Ablauf → keine');
eq(
  ersatzSchluessel([{ label: 'X' }, { label: 'X' }, { label: 'X' }]),
  ['ersatz:X', 'ersatz:X#2', 'ersatz:X#3'],
  'Fall 17: gleiche Titel ohne Kennungen → ersatz:X, ersatz:X#2, ersatz:X#3',
);
eq(
  ersatzSchluessel([{ id: 'u1', label: 'A' }, { id: 'u1', label: 'B' }, { id: 'u1', label: 'C' }]),
  ['u1', 'u1#2', 'u1#3'],
  'Fall 18: doppelte Kennungen im Ablauf → #2, #3',
);
// Review-Focus 3: Titel, die wie Ersatz-Kennungen aussehen, kollidieren nicht.
eq(
  ersatzSchluessel([{ label: 'Panel' }, { label: 'Panel' }, { label: 'Panel#2' }]),
  ['ersatz:Panel', 'ersatz:Panel#2', 'ersatz:Panel#2#2'],
  'RF3: Titel „Panel#2“ neben zweimal „Panel“ → drei verschiedene Schlüssel',
);
eq(
  ersatzSchluessel([{ label: 'Panel' }, { label: 'Panel' }, { label: 'Panel #2' }]),
  ['ersatz:Panel', 'ersatz:Panel#2', 'ersatz:Panel #2'],
  'RF3: Titel „Panel #2“ (mit Leerzeichen) → eigener Schlüssel',
);
eq(
  ersatzSchluessel([{ id: 'ersatz:X', label: 'A' }, { label: 'X' }, { label: 'ersatz:X' }]),
  ['ersatz:X', 'ersatz:X#2', 'ersatz:ersatz:X'],
  'RF3: echte Kennung „ersatz:X“ und Titel „X“/„ersatz:X“ → keine Kollision',
);
eq(
  ersatzSchluessel([{ id: 'X', label: 'A' }, { id: 'X', label: 'B' }, { id: 'X#2', label: 'C' }]),
  ['X', 'X#3', 'X#2'],
  'R9: einmaliger Schlüssel „X#2“ behält seinen Wortlaut, die Doppelung weicht auf #3 aus',
);

eq(
  LEERER_BERICHT,
  { geaendert: 0, neu: 0, entfallen: 0, entfernt: 0, zurueck: 0, verschoben: 0, scharfVerrueckt: null },
  'LEERER_BERICHT: alle Zähler 0',
);
eq(Object.isFrozen(LEERER_BERICHT), true, 'LEERER_BERICHT ist eingefroren');
eq(berichtIstLeer(LEERER_BERICHT), true, 'berichtIstLeer(LEERER_BERICHT)');
eq(berichtIstLeer({ ...LEERER_BERICHT, verschoben: 1 }), false, 'berichtIstLeer: verschoben 1 → nicht leer');
eq(berichtIstLeer({ ...LEERER_BERICHT, scharfVerrueckt: { von: 'A', nach: null } }), false, 'berichtIstLeer: scharfVerrueckt → nicht leer');

// ── gleicheAb: Abgleich im selben Kontext (Master-Link 2a, Spec 4.3, 4.9, 9.1) ─
// Kurzbild einer Zeilenliste: Ablaufzeile „id“, entfallene „id!“, eigene „+id“,
// dahinter die Aktions-IDs in [].
function abBild(rows: RundownRow[]): string[] {
  return rows.map(
    (r) =>
      `${r.quelle === 'ablauf' ? '' : '+'}${r.id}${r.entfallen ? '!' : ''}` +
      (r.actions.length ? `[${r.actions.map((a) => a.id).join(',')}]` : ''),
  );
}
function abAktion(id: string, extra: Partial<RundownAction> = {}): RundownAction {
  return { id, role: 'titler', verb: 'take', args: [], enabled: true, ...extra };
}
/** Ablaufzeile (quelle 'ablauf'), Titel „Punkt <id>“, wenn nicht angegeben. */
function abZeile(id: string, actions: RundownAction[] = [], extra: Partial<RundownRow> = {}): RundownRow {
  return { id, quelle: 'ablauf', label: `Punkt ${id}`, actions, ...extra };
}
function abEigene(id: string, actions: RundownAction[] = [], label = `Eigene ${id}`): RundownRow {
  return { id, label, actions };
}
/** Ablaufpunkt mit Kennung, Titel „Punkt <id>“, wenn nicht angegeben. */
function abPunkt(id: string, extra: Partial<ShowAblaufItem> = {}): ShowAblaufItem {
  return { id, label: `Punkt ${id}`, ...extra };
}
function abBericht(teil: Partial<AbgleichBericht> = {}): AbgleichBericht {
  return { ...LEERER_BERICHT, ...teil };
}
/** Tief einfrieren: jede Veränderung der Eingabe wirft im strikten Modus. */
function abEinfrieren<T>(x: T): T {
  if (x && typeof x === 'object') {
    for (const v of Object.values(x as Record<string, unknown>)) abEinfrieren(v);
    Object.freeze(x);
  }
  return x;
}

{
  // Fall 1: gleiche Schlüssel, neuer Titel/Notiz/Dauer → Text neu, Aktionen samt delayMs/enabled/zielId gleich.
  const a1 = abAktion('a1', { enabled: false, delayMs: 500, zielId: 'B' });
  const e = gleicheAb({
    alt: [abZeile('A', [a1], { note: 'alt', durationMs: 60000 }), abZeile('B')],
    ablauf: [abPunkt('A', { label: 'Punkt A neu', note: 'neu', durationMs: 90000 }), abPunkt('B')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['A[a1]', 'B'], 'Fall 1: Zeilen');
  eq([e.rows[0]?.label, e.rows[0]?.note, e.rows[0]?.durationMs], ['Punkt A neu', 'neu', 90000], 'Fall 1: Titel, Notiz, Dauer aus dem Ablauf');
  eq(e.rows[0]?.actions, [{ id: 'a1', role: 'titler', verb: 'take', args: [], enabled: false, delayMs: 500, zielId: 'B' }], 'Fall 1: Aktionen unverändert (R2)');
  eq(e.scharfId, 'A', 'Fall 1: scharf bleibt');
  eq(e.bericht, abBericht({ geaendert: 1 }), 'Fall 1: geaendert 1');
  eq(e.umbenannt, {}, 'Fall 1: keine Umbenennung');
}
{
  // Fall 1b: Notiz und Dauer fehlen im neuen Ablauf → Felder fallen weg.
  const e = gleicheAb({
    alt: [abZeile('A', [], { note: 'weg', durationMs: 1000 })],
    ablauf: [abPunkt('A')],
    scharfId: 'A',
    altformat: false,
  });
  eq(e.rows, [{ id: 'A', quelle: 'ablauf', label: 'Punkt A', actions: [] }], 'Fall 1b: note/durationMs entfernt');
  eq(e.bericht, abBericht({ geaendert: 1 }), 'Fall 1b: geaendert 1');
}
{
  // Fall 1c: nur die Notiz ändert sich → Notiz neu, Aktionen bleiben.
  const e = gleicheAb({
    alt: [abZeile('A', [abAktion('a1')], { note: 'alt' })],
    ablauf: [abPunkt('A', { note: 'neu' })],
    scharfId: 'A',
    altformat: false,
  });
  eq(e.rows, [{ id: 'A', quelle: 'ablauf', label: 'Punkt A', actions: [abAktion('a1')], note: 'neu' }], 'Fall 1c: nur Notiz geändert → Notiz neu');
  eq(e.bericht, abBericht({ geaendert: 1 }), 'Fall 1c: geaendert 1');
}
{
  // Fall 1d: nur die Dauer ändert sich → Dauer neu.
  const e = gleicheAb({
    alt: [abZeile('A', [], { durationMs: 60000 })],
    ablauf: [abPunkt('A', { durationMs: 90000 })],
    scharfId: 'A',
    altformat: false,
  });
  eq(e.rows, [{ id: 'A', quelle: 'ablauf', label: 'Punkt A', actions: [], durationMs: 90000 }], 'Fall 1d: nur Dauer geändert → Dauer neu');
  eq(e.bericht, abBericht({ geaendert: 1 }), 'Fall 1d: geaendert 1');
}
{
  // Fall 2: neuer Punkt in der Mitte → neue Zeile an iveo-Stelle; B hat jetzt N als Vorgänger.
  const e = gleicheAb({
    alt: [abZeile('A', [abAktion('a1')]), abZeile('B', [abAktion('b1')])],
    ablauf: [abPunkt('A'), abPunkt('N', { note: 'Bühne 2', durationMs: 300000 }), abPunkt('B')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['A[a1]', 'N', 'B[b1]'], 'Fall 2: Zeilen');
  eq(
    e.rows[1],
    { id: 'N', quelle: 'ablauf', label: 'Punkt N', note: 'Bühne 2', durationMs: 300000, actions: [] },
    'Fall 2: neue Zeile ohne Aktionen, Notiz und Dauer aus dem Punkt (R3)',
  );
  eq(e.bericht, abBericht({ neu: 1, verschoben: 1 }), 'Fall 2: neu 1, verschoben 1');
}
{
  // Fall 3: Punkt ohne Aktionen weg → Zeile weg.
  const e = gleicheAb({
    alt: [abZeile('A', [abAktion('a1')]), abZeile('B'), abZeile('C')],
    ablauf: [abPunkt('A'), abPunkt('B')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['A[a1]', 'B'], 'Fall 3: Zeilen');
  eq(e.bericht, abBericht({ entfernt: 1 }), 'Fall 3: entfernt 1');
}
{
  // R4 gilt auch für eine schon entfallene Zeile, deren letzte Aktion inzwischen gelöscht wurde.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B', [], { entfallen: true })],
    ablauf: [abPunkt('A')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['A'], 'R4: entfallene Zeile ohne Aktionen verschwindet');
  eq(e.bericht, abBericht({ entfernt: 1 }), 'R4: entfernt 1');
}
{
  // Fall 4: Punkt mit einer AUSGESCHALTETEN Aktion weg → bleibt, entfallen.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B'), abZeile('C', [abAktion('c1', { enabled: false })])],
    ablauf: [abPunkt('A'), abPunkt('B')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['A', 'B', 'C![c1]'], 'Fall 4: Zeilen');
  eq([e.rows[2]?.label, e.rows[2]?.actions[0]?.enabled], ['Punkt C', false], 'Fall 4: Text und Aktion unverändert');
  eq(e.bericht, abBericht({ entfallen: 1 }), 'Fall 4: entfallen 1');
}
{
  // Fall 5: entfallener Punkt kommt zurück → Markierung weg, Aktionen da.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B', [abAktion('b1')], { entfallen: true })],
    ablauf: [abPunkt('A'), abPunkt('B')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['A', 'B[b1]'], 'Fall 5: Zeilen');
  eq(e.rows[1] && 'entfallen' in e.rows[1], false, 'Fall 5: Markierung weg');
  eq(e.bericht, abBericht({ zurueck: 1 }), 'Fall 5: zurueck 1');
}
{
  // Fall 5b: alt A, B (entfallen, 1 Aktion), X (eigen); neu A, B → A, B, X.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B', [abAktion('b1')], { entfallen: true }), abEigene('X')],
    ablauf: [abPunkt('A'), abPunkt('B')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['A', 'B[b1]', '+X'], 'Fall 5b: zurückgekommene Zeile ist wieder Anker');
  eq(e.bericht, abBericht({ zurueck: 1 }), 'Fall 5b: zurueck 1');
}
{
  // Fall 5c: entfallene Zeile kommt mit neuem Titel zurück → Text aus dem Ablauf (R2), zählt nur als zurueck.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B', [abAktion('b1')], { entfallen: true, note: 'alt' })],
    ablauf: [abPunkt('A'), abPunkt('B', { label: 'B neu' })],
    scharfId: 'A',
    altformat: false,
  });
  eq(e.rows[1], { id: 'B', quelle: 'ablauf', label: 'B neu', actions: [abAktion('b1')] }, 'Fall 5c: Titel neu, Notiz weg, Markierung weg');
  eq(e.bericht, abBericht({ zurueck: 1 }), 'Fall 5c: zurueck 1, nicht zusätzlich geaendert');
}
{
  // Fall 6: Umsortieren C, A statt A, C → iveo-Reihenfolge, Aktionen wandern mit.
  const e = gleicheAb({
    alt: [abZeile('A', [abAktion('a1')]), abZeile('C', [abAktion('c1')])],
    ablauf: [abPunkt('C'), abPunkt('A')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['C[c1]', 'A[a1]'], 'Fall 6: Zeilen');
  eq(e.bericht, abBericht({ verschoben: 2 }), 'Fall 6: verschoben 2 (A und C haben neue Vorgänger)');
}
{
  // Fall 7: eigene Zeile hinter B, B wandert nach vorne → eigene Zeile wandert mit.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B'), abEigene('x')],
    ablauf: [abPunkt('B'), abPunkt('A')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['B', '+x', 'A'], 'Fall 7: Zeilen');
  eq(e.bericht, abBericht({ verschoben: 2 }), 'Fall 7: verschoben 2');
}
{
  // Fall 8: eigene Zeile hinter B, B weg ohne Aktionen → eigene Zeile hängt an A.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B'), abEigene('x')],
    ablauf: [abPunkt('A')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['A', '+x'], 'Fall 8: Zeilen');
  eq(e.bericht, abBericht({ entfernt: 1 }), 'Fall 8: entfernt 1');
}
{
  // Fall 9: eigene Zeilen ganz oben bleiben ganz oben, auch wenn oben ein Punkt dazukommt.
  const e = gleicheAb({
    alt: [abEigene('x'), abEigene('y'), abZeile('A'), abZeile('B')],
    ablauf: [abPunkt('N'), abPunkt('A'), abPunkt('B')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['+x', '+y', 'N', 'A', 'B'], 'Fall 9: Zeilen');
  eq(e.bericht, abBericht({ neu: 1, verschoben: 1 }), 'Fall 9: neu 1, verschoben 1');
}
{
  // Fall 10: zwei eigene Zeilen hinter B behalten ihre Reihenfolge.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B'), abEigene('x'), abEigene('y')],
    ablauf: [abPunkt('B'), abPunkt('A')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['B', '+x', '+y', 'A'], 'Fall 10: Zeilen');
}
{
  // Fall 11: scharfe Zeile wandert (an eine andere Nummer) → bleibt scharf.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B'), abZeile('C')],
    ablauf: [abPunkt('C'), abPunkt('A'), abPunkt('B')],
    scharfId: 'B',
    altformat: false,
  });
  eq(abBild(e.rows), ['C', 'A', 'B'], 'Fall 11: Zeilen');
  eq(e.scharfId, 'B', 'Fall 11: B bleibt scharf (jetzt Nummer 3)');
  eq(e.bericht, abBericht({ verschoben: 2 }), 'Fall 11: verschoben 2, scharfVerrueckt null');
}
{
  // Fall 12: scharfe Zeile entfällt mit Aktionen → nächste nicht entfallene dahinter.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B', [abAktion('b1')]), abZeile('C')],
    ablauf: [abPunkt('A'), abPunkt('C')],
    scharfId: 'B',
    altformat: false,
  });
  eq(abBild(e.rows), ['A', 'B![b1]', 'C'], 'Fall 12: Zeilen');
  eq(e.scharfId, 'C', 'Fall 12: C scharf');
  eq(
    e.bericht,
    abBericht({ entfallen: 1, verschoben: 1, scharfVerrueckt: { von: 'Punkt B', nach: 'Punkt C' } }),
    'Fall 12: entfallen 1, verschoben 1, scharfVerrueckt B → C',
  );
}
{
  // Fall 12b: alt A, B* (1 Aktion), C; neu C, A → B entfällt, scharf ist C (nicht die Nummer 2 = A).
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B', [abAktion('b1')]), abZeile('C')],
    ablauf: [abPunkt('C'), abPunkt('A')],
    scharfId: 'B',
    altformat: false,
  });
  eq(abBild(e.rows), ['C', 'A', 'B![b1]'], 'Fall 12b: Zeilen');
  eq(e.scharfId, 'C', 'Fall 12b: C scharf');
  eq(
    e.bericht,
    abBericht({ entfallen: 1, verschoben: 2, scharfVerrueckt: { von: 'Punkt B', nach: 'Punkt C' } }),
    'Fall 12b: Bericht',
  );
}
{
  // Fall 12c: scharfe Zeile ohne Aktionen verschwindet (R4) → Nachfolger nach R7 (c).
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B'), abZeile('C')],
    ablauf: [abPunkt('A'), abPunkt('C')],
    scharfId: 'B',
    altformat: false,
  });
  eq(abBild(e.rows), ['A', 'C'], 'Fall 12c: Zeilen');
  eq(e.scharfId, 'C', 'Fall 12c: C scharf');
  eq(
    e.bericht,
    abBericht({ entfernt: 1, verschoben: 1, scharfVerrueckt: { von: 'Punkt B', nach: 'Punkt C' } }),
    'Fall 12c: Bericht',
  );
}
{
  // Fall 12d: eine eigene Zeile ist scharf, ihr Anker wandert → bleibt scharf.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B'), abEigene('x')],
    ablauf: [abPunkt('B'), abPunkt('A')],
    scharfId: 'x',
    altformat: false,
  });
  eq(abBild(e.rows), ['B', '+x', 'A'], 'Fall 12d: Zeilen');
  eq(e.scharfId, 'x', 'Fall 12d: x bleibt scharf');
  eq(e.bericht.scharfVerrueckt, null, 'Fall 12d: scharfVerrueckt null');
}
{
  // Fall 13: scharfe Zeile ist die letzte und entfällt → letzte nicht entfallene.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B'), abZeile('C', [abAktion('c1')])],
    ablauf: [abPunkt('A'), abPunkt('B')],
    scharfId: 'C',
    altformat: false,
  });
  eq(abBild(e.rows), ['A', 'B', 'C![c1]'], 'Fall 13: Zeilen');
  eq(e.scharfId, 'B', 'Fall 13: B scharf');
  eq(e.bericht, abBericht({ entfallen: 1, scharfVerrueckt: { von: 'Punkt C', nach: 'Punkt B' } }), 'Fall 13: Bericht');
}
{
  // Fall 14: alle Zeilen entfallen → scharfId null.
  const e = gleicheAb({
    alt: [abZeile('A', [abAktion('a1')]), abZeile('B', [abAktion('b1')])],
    ablauf: [],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['A![a1]', 'B![b1]'], 'Fall 14: Zeilen');
  eq(e.scharfId, null, 'Fall 14: scharfId null');
  eq(e.bericht, abBericht({ entfallen: 2, scharfVerrueckt: { von: 'Punkt A', nach: null } }), 'Fall 14: Bericht');
}
{
  // Fall 14b: scharfId null, der Ablauf bringt wieder Punkte → erste Zeile scharf.
  const e = gleicheAb({
    alt: [abZeile('A', [abAktion('a1')], { entfallen: true }), abZeile('B', [abAktion('b1')], { entfallen: true })],
    ablauf: [abPunkt('A')],
    scharfId: null,
    altformat: false,
  });
  eq(abBild(e.rows), ['A[a1]', 'B![b1]'], 'Fall 14b: Zeilen');
  eq(e.scharfId, 'A', 'Fall 14b: A scharf');
  eq(e.bericht, abBericht({ zurueck: 1 }), 'Fall 14b: zurueck 1, scharfVerrueckt null');
}
{
  // R7 (a): unbekannte scharfId → erste nicht entfallene, ohne scharfVerrueckt.
  const e = gleicheAb({
    alt: [abZeile('A', [abAktion('a1')], { entfallen: true }), abEigene('x'), abZeile('B')],
    ablauf: [abPunkt('B')],
    scharfId: 'gibt-es-nicht',
    altformat: false,
  });
  eq(abBild(e.rows), ['A![a1]', '+x', 'B'], 'R7 (a): Zeilen');
  eq([e.scharfId, e.bericht.scharfVerrueckt], ['x', null], 'R7 (a): x (erste nicht entfallene) scharf, ohne Meldung');
}
{
  // Fall 15 (R8): zweimal derselbe Ablauf → gleiches Ergebnis, zweiter Bericht leer.
  const alt = [
    abEigene('oben'),
    abZeile('A', [abAktion('a1')]),
    abEigene('x'),
    abZeile('B', [abAktion('b1')]),
    abZeile('C'),
    abZeile('D', [abAktion('d1')], { entfallen: true }),
  ];
  const ablauf = [abPunkt('C', { label: 'C neu' }), abPunkt('N'), abPunkt('A')];
  const erst = gleicheAb({ alt, ablauf, scharfId: 'B', altformat: false });
  const zweit = gleicheAb({ alt: erst.rows, ablauf, scharfId: erst.scharfId, altformat: false });
  eq(abBild(erst.rows), ['+oben', 'C', 'D![d1]', 'N', 'A[a1]', '+x', 'B![b1]'], 'Fall 15: erstes Ergebnis');
  eq(
    [erst.scharfId, erst.bericht],
    ['C', abBericht({ geaendert: 1, neu: 1, entfallen: 1, verschoben: 2, scharfVerrueckt: { von: 'Punkt B', nach: 'C neu' } })],
    'Fall 15: erster Bericht',
  );
  eq(zweit.rows, erst.rows, 'Fall 15: zweites Ergebnis = erstes (tief)');
  eq(zweit.scharfId, erst.scharfId, 'Fall 15: scharfe Zeile gleich');
  eq(zweit.bericht, LEERER_BERICHT, 'Fall 15: zweiter Bericht leer');
}
{
  // Fall 16: Ablauf ohne Kennungen → Ersatz-Kennungen, zweimal hintereinander stabil.
  const ablauf: ShowAblaufItem[] = [{ label: 'Begrüßung' }, { label: 'Keynote', durationMs: 1800000 }];
  const erst = gleicheAb({ alt: [], ablauf, scharfId: null, altformat: false });
  eq(
    erst.rows,
    [
      { id: 'ersatz:Begrüßung', quelle: 'ablauf', label: 'Begrüßung', actions: [] },
      { id: 'ersatz:Keynote', quelle: 'ablauf', label: 'Keynote', durationMs: 1800000, actions: [] },
    ],
    'Fall 16: Ersatz-Kennungen als id',
  );
  eq([erst.scharfId, erst.bericht], ['ersatz:Begrüßung', abBericht({ neu: 2 })], 'Fall 16: erste Zeile scharf, neu 2');
  const zweit = gleicheAb({ alt: erst.rows, ablauf, scharfId: erst.scharfId, altformat: false });
  eq([zweit.rows, zweit.bericht], [erst.rows, LEERER_BERICHT], 'Fall 16: zweiter Lauf stabil, Bericht leer');
}
{
  // Fall 17/18 in gleicheAb: Zeilen tragen die aufgelösten Schlüssel.
  const e17 = gleicheAb({ alt: [], ablauf: [{ label: 'X' }, { label: 'X' }], scharfId: null, altformat: false });
  eq(abBild(e17.rows), ['ersatz:X', 'ersatz:X#2'], 'Fall 17: Zeilen ersatz:X, ersatz:X#2');
  const e18 = gleicheAb({ alt: [], ablauf: [abPunkt('u1'), abPunkt('u1', { label: 'Zweiter' })], scharfId: null, altformat: false });
  eq(abBild(e18.rows), ['u1', 'u1#2'], 'Fall 18: Zeilen u1, u1#2');
}
{
  // Review-Focus 3: Titel wie Ersatz-Kennungen, doppelt → keine Kollision, zweimal stabil.
  const ablauf: ShowAblaufItem[] = [
    { label: 'Panel' },
    { label: 'Panel' },
    { label: 'Panel#2' },
    { label: 'ersatz:X' },
    { label: 'X' },
    { id: 'ersatz:X', label: 'Echt' },
  ];
  const erst = gleicheAb({ alt: [], ablauf, scharfId: null, altformat: false });
  const ids = erst.rows.map((r) => r.id);
  eq(new Set(ids).size, 6, 'RF3: sechs verschiedene Schlüssel');
  const zweit = gleicheAb({ alt: erst.rows, ablauf, scharfId: erst.scharfId, altformat: false });
  eq([zweit.rows, zweit.bericht], [erst.rows, LEERER_BERICHT], 'RF3: zweiter Lauf stabil, Bericht leer');
}
{
  // Fall 19 (R0): Zeile ersatz:X mit Aktionen, neuer Ablauf { id: 'u1', label: 'X' } → Zeile u1.
  const e = gleicheAb({
    alt: [abZeile('ersatz:X', [abAktion('a1')], { label: 'X' })],
    ablauf: [{ id: 'u1', label: 'X' }],
    scharfId: 'ersatz:X',
    altformat: false,
  });
  eq(abBild(e.rows), ['u1[a1]'], 'Fall 19: Zeile u1 mit denselben Aktionen');
  eq(e.bericht, LEERER_BERICHT, 'Fall 19: neu 0, entfallen 0 (Bericht leer)');
  eq(e.umbenannt, { 'ersatz:X': 'u1' }, 'Fall 19: umbenannt ersatz:X → u1');
  eq(e.scharfId, 'u1', 'Fall 19: scharf folgt über R0');
}
{
  // Fall 19b: R0 mit doppeltem Titel → keine Brücke.
  const e1 = gleicheAb({
    alt: [abZeile('ersatz:X', [abAktion('a1')], { label: 'X' })],
    ablauf: [{ id: 'u1', label: 'X' }, { id: 'u2', label: 'X' }],
    scharfId: null,
    altformat: false,
  });
  eq(abBild(e1.rows), ['ersatz:X![a1]', 'u1', 'u2'], 'Fall 19b: Titel doppelt im Ablauf → alte Zeile entfällt');
  eq([e1.bericht, e1.umbenannt], [abBericht({ neu: 2, entfallen: 1 }), {}], 'Fall 19b: neu 2, entfallen 1, keine Brücke');
  const e2 = gleicheAb({
    alt: [abZeile('ersatz:X', [abAktion('a1')], { label: 'X' }), abZeile('ersatz:X#2', [], { label: 'X' })],
    ablauf: [{ id: 'u1', label: 'X' }],
    scharfId: null,
    altformat: false,
  });
  eq(abBild(e2.rows), ['ersatz:X![a1]', 'u1'], 'Fall 19b: Titel doppelt unter verwaisten Zeilen → entfällt bzw. verschwindet');
  eq([e2.bericht, e2.umbenannt], [abBericht({ neu: 1, entfallen: 1, entfernt: 1 }), {}], 'Fall 19b: Bericht ohne Brücke');
}
{
  // Fall 19c: R0 rückwärts — echte Kennung → nur noch Ersatz-Kennung, Aktionen bleiben.
  const e = gleicheAb({
    alt: [abZeile('u1', [abAktion('a1')], { label: 'X' })],
    ablauf: [{ label: 'X' }],
    scharfId: 'u1',
    altformat: false,
  });
  eq(abBild(e.rows), ['ersatz:X[a1]'], 'Fall 19c: Zeile ersatz:X mit Aktionen');
  eq([e.umbenannt, e.bericht, e.scharfId], [{ u1: 'ersatz:X' }, LEERER_BERICHT, 'ersatz:X'], 'Fall 19c: umbenannt, Bericht leer, scharf folgt');
}
{
  // Fall 20: „Als eigene Zeile behalten“, danach kommt der Punkt zurück → beide, keine doppelte id.
  const e = gleicheAb({
    alt: [abZeile('A'), abEigene('r_b', [abAktion('b1')], 'Punkt B')],
    ablauf: [abPunkt('A'), abPunkt('B')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['A', '+r_b[b1]', 'B'], 'Fall 20: eigene Zeile und neue Ablaufzeile');
  eq(new Set(e.rows.map((r) => r.id)).size, e.rows.length, 'Fall 20: keine doppelte id');
  eq(e.bericht, abBericht({ neu: 1 }), 'Fall 20: neu 1');
}
{
  // Fall 21: Ablaufzeile duplizieren (Kopie = eigene Zeile), dann derselbe Ablauf → Kopie bleibt dahinter.
  const alt = [
    abZeile('A', [abAktion('a1')]),
    abEigene('r_kopie', [abAktion('a1k')], 'Punkt A (Kopie)'),
    abZeile('B'),
  ];
  const e = gleicheAb({ alt, ablauf: [abPunkt('A'), abPunkt('B')], scharfId: 'r_kopie', altformat: false });
  eq(e.rows, alt, 'Fall 21: Zeilen unverändert, Kopie direkt hinter dem Original');
  eq([e.scharfId, e.bericht], ['r_kopie', LEERER_BERICHT], 'Fall 21: Bericht leer');
}
{
  // Fall 22 (4.9): Altformat, Titel eindeutig → Zuordnung, Aktionen an der Ablaufzeile.
  const e = gleicheAb({
    alt: [
      abEigene('r1', [abAktion('a1')], 'Begrüßung'),
      abEigene('r2', [abAktion('a2')], 'Keynote'),
      abEigene('r3', [], 'Pause'),
    ],
    ablauf: [{ id: 'u1', label: 'Begrüßung' }, { id: 'u2', label: 'Keynote' }, { id: 'u3', label: 'Pause' }],
    scharfId: 'r2',
    altformat: true,
  });
  eq(abBild(e.rows), ['u1[a1]', 'u2[a2]', 'u3'], 'Fall 22: alte Zeilen werden Ablaufzeilen');
  eq([e.scharfId, e.bericht, e.umbenannt], ['u2', LEERER_BERICHT, {}], 'Fall 22: scharf folgt, Bericht leer');
}
{
  // Fall 23 (4.9): Altformat, Titel doppelt → keine Zuordnung, Ablaufzeilen kommen dazu.
  const e = gleicheAb({
    alt: [abEigene('r1', [abAktion('a1')], 'Panel'), abEigene('r2', [abAktion('a2')], 'Panel'), abEigene('r3', [abAktion('a3')], 'Pause')],
    ablauf: [{ id: 'u1', label: 'Panel' }, { id: 'u2', label: 'Panel' }, { id: 'u3', label: 'Pause' }],
    scharfId: null,
    altformat: true,
  });
  eq(abBild(e.rows), ['+r1[a1]', '+r2[a2]', 'u1', 'u2', 'u3[a3]'], 'Fall 23: doppelte Titel bleiben eigene Zeilen');
  eq(e.bericht, abBericht({ neu: 2, verschoben: 1 }), 'Fall 23: neu 2');
  const e2 = gleicheAb({
    alt: [abEigene('r1', [abAktion('a1')], 'Panel'), abEigene('r2', [abAktion('a2')], 'Panel')],
    ablauf: [{ id: 'u1', label: 'Panel' }],
    scharfId: null,
    altformat: true,
  });
  eq(abBild(e2.rows), ['+r1[a1]', '+r2[a2]', 'u1'], 'Fall 23: Titel einmal im Ablauf, zweimal alt → keine Zuordnung');
  const e3 = gleicheAb({
    alt: [abEigene('r1', [abAktion('a1')], 'Panel')],
    ablauf: [{ id: 'u1', label: 'Panel' }],
    scharfId: null,
    altformat: false,
  });
  eq(abBild(e3.rows), ['+r1[a1]', 'u1'], 'Fall 23: ohne altformat keine Titel-Zuordnung');
}
{
  // Kaputtes Dokument: zwei alte Ablaufzeilen mit derselben id → keine Zeile geht verloren.
  const e = gleicheAb({
    alt: [abZeile('A', [abAktion('a1')]), abZeile('A', [abAktion('a2')])],
    ablauf: [abPunkt('A')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['A[a1]', '+A[a2]'], 'doppelte alte id: zweite Zeile wird eigene Zeile');
}
{
  // Eingaben bleiben unverändert (tief eingefroren; jede Schreibung würde werfen).
  const alt = abEinfrieren([
    abEigene('x', [abAktion('x1')]),
    abZeile('A', [abAktion('a1', { zielId: 'B' })], { note: 'n' }),
    abZeile('B', [abAktion('b1')]),
    abZeile('ersatz:Q', [abAktion('q1')], { label: 'Q' }),
  ]);
  const ablauf = abEinfrieren([abPunkt('B', { label: 'B neu' }), { id: 'q', label: 'Q' }]);
  const vorher = JSON.stringify([alt, ablauf]);
  gleicheAb({ alt, ablauf, scharfId: 'A', altformat: true });
  eq(JSON.stringify([alt, ablauf]), vorher, 'gleicheAb verändert seine Eingaben nicht');
}
{
  // Review-Focus 4: großer Ablauf (51 Programme, 100 eigene Zeilen) → unter 50 ms.
  const ablauf51 = Array.from({ length: 51 }, (_, i) => abPunkt(`p${i}`));
  const alt: RundownRow[] = [];
  ablauf51.forEach((p, i) => {
    alt.push(abZeile(p.id as string, [abAktion(`a${i}`), abAktion(`b${i}`)]));
    if (i < 50) alt.push(abEigene(`x${i}`, [abAktion(`x${i}`)]), abEigene(`y${i}`));
  });
  const neu = [...ablauf51.slice(5).reverse(), ...Array.from({ length: 5 }, (_, i) => abPunkt(`n${i}`))];
  const t0 = performance.now();
  const e = gleicheAb({ alt, ablauf: neu, scharfId: 'p10', altformat: false });
  const ms = performance.now() - t0;
  eq(ms < 50, true, `RF4: 51 Programme + 100 eigene Zeilen in ${ms.toFixed(2)} ms (< 50 ms)`);
  eq([e.rows.length, e.bericht.neu, e.bericht.entfallen, e.scharfId], [156, 5, 5, 'p10'], 'RF4: 156 Zeilen, neu 5, entfallen 5, scharf p10');
}

// ── kontextVon / wendeShowAn (Master-Link 2a, Spec 4.4, 4.9, 9.1 Fälle 22–27) ──
eq(kontextVon({}), 'show', 'kontextVon: ohne iveo → show');
eq(kontextVon({ iveo: {} }), 'liste:|||0', 'kontextVon: iveo ohne Filter → liste mit leeren Teilen');
eq(kontextVon({ iveo: { filter: { programId: 'p-123', day: '2026-11-10' } } }), 'se:p-123', 'kontextVon: programId → se:');
eq(
  kontextVon({ iveo: { filter: { day: '2026-11-10', typeSlug: 'plenary', formatSlug: 'panel', excludeBlockers: true } } }),
  'liste:2026-11-10|plenary|panel|1',
  'kontextVon: Liste mit allen Filterteilen',
);
eq(kontextVon({ iveo: { filter: { day: '2026-11-11' } } }), 'liste:2026-11-11|||0', 'kontextVon: Liste Tag 2');

{
  // Show ohne Ablauf: Dokument bleibt unangetastet (5.2), kein Bericht.
  const doc: RundownDoc = { schemaVersion: 2, name: 'X', rows: [abEigene('x')] };
  const e = wendeShowAn({ doc, scharfId: 'x', show: { name: 'X' } });
  eq([e.doc === doc, e.scharfId, e.bericht, e.kontextGewechselt], [true, 'x', null, false], 'wendeShowAn: Show ohne Ablauf → nichts');
  const e2 = wendeShowAn({ doc, scharfId: 'x', show: { name: 'X', ablauf: [] } });
  eq(e2.doc === doc, true, 'wendeShowAn: leerer Ablauf → nichts');
}
{
  // Fall 22: Altformat (Version-1-Datei), Titel eindeutig → Zuordnung, zuordnungOffen gelöscht.
  const doc = migrate(
    {
      schemaVersion: 1,
      name: 'COP31',
      rows: [
        { id: 'r1', label: 'Begrüßung', actions: [abAktion('a1')] },
        { id: 'r2', label: 'Keynote', actions: [abAktion('a2')] },
      ],
    },
    (p) => `${p}-neu`,
  );
  const e = wendeShowAn({
    doc,
    scharfId: null,
    show: { name: 'COP31', ablauf: [{ id: 'u1', label: 'Begrüßung' }, { id: 'u2', label: 'Keynote' }, { id: 'u3', label: 'Pause' }] },
  });
  eq(abBild(e.doc.rows), ['u1[a1]', 'u2[a2]', 'u3'], 'Fall 22: Aktionen an den Ablaufzeilen (Kennungen aus der Show)');
  eq([e.doc.kontext, e.doc.zuordnungOffen, e.scharfId], ['show', undefined, 'u1'], 'Fall 22: kontext gesetzt, zuordnungOffen weg');
  eq([e.kontextGewechselt, e.bericht], [true, null], 'Fall 22: erster Abgleich zählt als Kontextwechsel (kein Bericht)');
}
{
  // Fall 23: Altformat, Titel doppelt → alte Zeilen bleiben eigene, Ablaufzeilen kommen dazu.
  const doc = migrate(
    {
      schemaVersion: 1,
      name: 'COP31',
      rows: [
        { id: 'r1', label: 'Panel', actions: [abAktion('a1')] },
        { id: 'r2', label: 'Panel', actions: [abAktion('a2')] },
      ],
    },
    (p) => `${p}-neu`,
  );
  const e = wendeShowAn({
    doc,
    scharfId: null,
    show: { name: 'COP31', ablauf: [{ id: 'u1', label: 'Panel' }, { id: 'u2', label: 'Panel' }] },
  });
  eq(abBild(e.doc.rows), ['+r1[a1]', '+r2[a2]', 'u1', 'u2'], 'Fall 23: keine Zuordnung, Ablaufzeilen zusätzlich');
  eq(e.doc.zuordnungOffen, undefined, 'Fall 23: zuordnungOffen trotzdem gelöscht');
}
{
  // Fall 24: Version-1-Datei ohne Show gespeichert (bleibt zuordnungOffen), danach in eine Show eingetragen.
  const neueId = (p: 'r' | 'a'): string => `${p}-neu`;
  const v1 = migrate({ schemaVersion: 1, name: 'Gala', rows: [{ id: 'r1', label: 'Keynote', actions: [abAktion('k1')] }] }, neueId);
  const gespeichert = migrate(JSON.parse(JSON.stringify(v1)), neueId);
  eq(gespeichert.zuordnungOffen, true, 'Fall 24: nach dem Speichern ohne Show noch zuordnungOffen');
  const e = wendeShowAn({ doc: gespeichert, scharfId: null, show: { name: 'Gala', ablauf: [{ id: 'u1', label: 'Keynote' }] } });
  eq([abBild(e.doc.rows), e.doc.zuordnungOffen], [['u1[k1]'], undefined], 'Fall 24: Titel-Zuordnung läuft beim ersten Abgleich');
}
{
  // Fall 25: Kontextwechsel A → B → A.
  const showA = { name: 'COP31', ablauf: [abPunkt('a1p'), abPunkt('a2p')], iveo: { filter: { programId: 'pA' } } };
  const showB = { name: 'COP31', ablauf: [abPunkt('b1p'), abPunkt('b2p')], iveo: { filter: { programId: 'pB' } } };
  const docA: RundownDoc = {
    schemaVersion: 2,
    name: 'COP31',
    kontext: 'se:pA',
    rows: [abZeile('a1p', [abAktion('k1')]), abEigene('x', [abAktion('k2')]), abZeile('a2p')],
  };
  const zuB = wendeShowAn({ doc: docA, scharfId: 'a2p', show: showB });
  eq([zuB.kontextGewechselt, zuB.bericht, zuB.doc.kontext], [true, null, 'se:pB'], 'Fall 25: A → B ist Kontextwechsel ohne Bericht');
  eq([abBild(zuB.doc.rows), zuB.scharfId], [['b1p', 'b2p'], 'b1p'], 'Fall 25: B neu, scharf die erste');
  eq(abBild(zuB.doc.archiv?.['se:pA'] ?? []), ['a1p[k1]', '+x[k2]', 'a2p'], 'Fall 25: A im Archiv');
  const zuA = wendeShowAn({ doc: zuB.doc, scharfId: 'b2p', show: showA });
  eq([zuA.kontextGewechselt, zuA.bericht, zuA.doc.kontext], [true, null, 'se:pA'], 'Fall 25: B → A ist Kontextwechsel ohne Bericht');
  eq([abBild(zuA.doc.rows), zuA.scharfId], [['a1p[k1]', '+x[k2]', 'a2p'], 'a1p'], 'Fall 25: A mit Aktionen und eigener Zeile zurück, scharf die erste');
  eq(Object.keys(zuA.doc.archiv ?? {}), ['se:pB'], 'Fall 25: Archiv hält jetzt nur B');
}
{
  // Fall 25b: Rückkehr in einen archivierten Kontext gleicht mit dem DANN aktuellen Ablauf ab
  // (4.4 Schritt 3): ein inzwischen eingefügter Punkt erscheint, Aktionen und eigene Zeile bleiben.
  const doc: RundownDoc = {
    schemaVersion: 2,
    name: 'COP31',
    kontext: 'se:pB',
    rows: [abZeile('b1p')],
    archiv: { 'se:pA': [abZeile('a1p', [abAktion('k1')]), abEigene('x', [abAktion('k2')]), abZeile('a2p')] },
  };
  const e = wendeShowAn({
    doc,
    scharfId: 'b1p',
    show: { name: 'COP31', ablauf: [abPunkt('a1p'), abPunkt('neu'), abPunkt('a2p')], iveo: { filter: { programId: 'pA' } } },
  });
  eq([e.kontextGewechselt, abBild(e.doc.rows), e.scharfId], [true, ['a1p[k1]', '+x[k2]', 'neu', 'a2p'], 'a1p'], 'Fall 25b: Rückkehr nach A gleicht mit dem aktuellen Ablauf ab');
}
{
  // 4.4 Schritt 4: Nach einem Kontextwechsel ist die erste nicht entfallene Zeile scharf, auch wenn
  // die bisher scharfe Kennung im neuen Kontext vorkommt (Liste Tag 1 → Liste alle Tage).
  const doc: RundownDoc = {
    schemaVersion: 2,
    name: 'COP31',
    kontext: 'liste:2026-11-10|||0',
    rows: [abZeile('p1'), abZeile('p2', [abAktion('k2')])],
    archiv: { 'liste:|||0': [abZeile('p1'), abZeile('p2'), abZeile('p3')] },
  };
  const e = wendeShowAn({ doc, scharfId: 'p2', show: { name: 'COP31', ablauf: [abPunkt('p1'), abPunkt('p2'), abPunkt('p3')], iveo: {} } });
  eq(
    [e.kontextGewechselt, abBild(e.doc.rows), e.scharfId],
    [true, ['p1', 'p2', 'p3'], 'p1'],
    'Kontextwechsel: scharf ist die erste Zeile, auch wenn die alte Kennung dort vorkommt',
  );
}
{
  // Fall 26: Liste Tag 1 → Side Event → Liste Tag 2 → Liste Tag 1.
  const tag1 = { name: 'COP31', ablauf: [abPunkt('t1a'), abPunkt('t1b')], iveo: { filter: { day: '2026-11-10' } } };
  const se = { name: 'COP31', ablauf: [abPunkt('s1')], iveo: { filter: { programId: 'pSE', day: '2026-11-10' } } };
  const tag2 = { name: 'COP31', ablauf: [abPunkt('t2a')], iveo: { filter: { day: '2026-11-11' } } };
  const start: RundownDoc = {
    schemaVersion: 2,
    name: 'COP31',
    kontext: 'liste:2026-11-10|||0',
    rows: [abZeile('t1a', [abAktion('k1')]), abZeile('t1b', [abAktion('k2')]), abEigene('y', [abAktion('k3')])],
  };
  const s1 = wendeShowAn({ doc: start, scharfId: 't1b', show: se });
  eq([s1.kontextGewechselt, abBild(s1.doc.rows)], [true, ['s1']], 'Fall 26: Tag 1 → Side Event');
  const s2 = wendeShowAn({ doc: s1.doc, scharfId: 's1', show: tag2 });
  eq([s2.kontextGewechselt, abBild(s2.doc.rows)], [true, ['t2a']], 'Fall 26: → Tag 2 zeigt nur Tag 2, nichts entfallen');
  const s3 = wendeShowAn({ doc: s2.doc, scharfId: 't2a', show: tag1 });
  eq([s3.kontextGewechselt, abBild(s3.doc.rows)], [true, ['t1a[k1]', 't1b[k2]', '+y[k3]']], 'Fall 26: → Tag 1 alles wieder da');
  eq(s3.doc.rows.some((r) => r.entfallen), false, 'Fall 26: keine Zeile von Tag 1 entfallen');
  eq(Object.keys(s3.doc.archiv ?? {}).sort(), ['liste:2026-11-11|||0', 'se:pSE'], 'Fall 26: Archiv hält Side Event und Tag 2');
}
{
  // Fall 27: R0-Umbenennung schreibt zielId in Zeilen und Archiv und scharfId um.
  const doc: RundownDoc = {
    schemaVersion: 2,
    name: 'Gala',
    kontext: 'show',
    rows: [
      abZeile('ersatz:Keynote', [abAktion('g1', { role: 'timer', verb: 'goto', args: [2], zielId: 'ersatz:Pause' })], { label: 'Keynote' }),
      abZeile('ersatz:Pause', [], { label: 'Pause' }),
    ],
    archiv: {
      'se:alt': [abEigene('z', [abAktion('g2', { role: 'timer', verb: 'goto', args: [1], zielId: 'ersatz:Keynote' })])],
    },
  };
  const e = wendeShowAn({
    doc,
    scharfId: 'ersatz:Pause',
    show: { name: 'Gala', ablauf: [{ id: 'u1', label: 'Keynote' }, { id: 'u2', label: 'Pause' }] },
  });
  eq(abBild(e.doc.rows), ['u1[g1]', 'u2'], 'Fall 27: Zeilen mit echten Kennungen');
  eq(e.doc.rows[0]?.actions[0]?.zielId, 'u2', 'Fall 27: zielId in den Zeilen umgeschrieben');
  eq(e.doc.archiv?.['se:alt']?.[0]?.actions[0]?.zielId, 'u1', 'Fall 27: zielId im Archiv umgeschrieben');
  eq([e.scharfId, e.kontextGewechselt, e.bericht], ['u2', false, LEERER_BERICHT], 'Fall 27: scharfId umgeschrieben, Bericht leer');
}
{
  // Gleicher Kontext liefert den Bericht (für den Hinweis 4.6) und hält die scharfe Zeile (R7).
  const doc: RundownDoc = {
    schemaVersion: 2,
    name: 'Gala',
    kontext: 'liste:|||0',
    rows: [abZeile('A', [abAktion('a1')]), abZeile('B')],
  };
  const e = wendeShowAn({ doc, scharfId: 'B', show: { name: 'Gala', ablauf: [abPunkt('A'), abPunkt('N'), abPunkt('B')], iveo: {} } });
  eq([e.kontextGewechselt, e.bericht, e.scharfId], [false, abBericht({ neu: 1, verschoben: 1 }), 'B'], 'wendeShowAn: gleicher Kontext → Bericht, scharf bleibt');
}
{
  // wendeShowAn verändert seine Eingaben nicht.
  const doc = abEinfrieren<RundownDoc>({
    schemaVersion: 2,
    name: 'Gala',
    kontext: 'se:p1',
    rows: [abZeile('ersatz:A', [abAktion('a1', { zielId: 'ersatz:A' })], { label: 'A' })],
    archiv: { 'se:p2': [abZeile('B', [abAktion('b1', { zielId: 'ersatz:A' })])] },
  });
  const vorher = JSON.stringify(doc);
  wendeShowAn({ doc, scharfId: 'ersatz:A', show: { name: 'Gala', ablauf: [{ id: 'u1', label: 'A' }], iveo: { filter: { programId: 'p1' } } } });
  wendeShowAn({ doc, scharfId: 'ersatz:A', show: { name: 'Gala', ablauf: [{ id: 'u1', label: 'A' }], iveo: { filter: { programId: 'p2' } } } });
  eq(JSON.stringify(doc), vorher, 'wendeShowAn verändert seine Eingaben nicht');
}

{
  // Spec 9.3 (Rundown-Teil): iveo-Kennungen überstehen serializeShow/parseShow und werden Zeilen-ids;
  // eine doppelte Kennung ist beim Lesen schon aufgelöst (#2).
  const show = parseShow(
    serializeShow({
      schemaVersion: 1,
      name: 'COP31',
      tools: [],
      ablauf: [
        { id: '7f0c1a52-0000-4000-8000-000000000001', label: 'Eröffnung' },
        { id: '7f0c1a52-0000-4000-8000-000000000002', label: 'Panel' },
        { id: '7f0c1a52-0000-4000-8000-000000000002', label: 'Panel (doppelt)' },
      ],
      iveo: { event: 'cop31', filter: { programId: 'p-se-1' } },
    }),
  );
  const e = wendeShowAn({ doc: { schemaVersion: 2, name: 'COP31', rows: [] }, scharfId: null, show });
  eq(
    e.doc.rows.map((r) => r.id),
    ['7f0c1a52-0000-4000-8000-000000000001', '7f0c1a52-0000-4000-8000-000000000002', '7f0c1a52-0000-4000-8000-000000000002#2'],
    '9.3: Zeilen tragen die iveo-Kennungen aus der Show-Datei',
  );
  eq([e.doc.kontext, e.scharfId], ['se:p-se-1', '7f0c1a52-0000-4000-8000-000000000001'], '9.3: Kontext Side Event, erste Zeile scharf');
}

// ── Teil 2a · loeseSprungZiel (Fall 30, Review-Focus 5) ──────────────────────
{
  const sprung = (extra: Partial<A7Aktion>): A7Aktion => ({
    id: 'a-sprung30',
    role: 'timer',
    verb: 'goto',
    args: [2],
    enabled: true,
    ...extra,
  });
  eq(loeseSprungZiel(sprung({ zielId: 'p2' }), ['p1', 'p2', 'p3'], false), { n: 2, gebunden: true }, 'Fall 30: Ziel an seiner Stelle → Nummer 2, gebunden');
  eq(loeseSprungZiel(sprung({ zielId: 'p2' }), ['p3', 'p1', 'p2'], false), { n: 3, gebunden: true }, 'Fall 30: Ziel nach Umsortieren an neuer Stelle → Nummer 3');
  eq(loeseSprungZiel(sprung({ zielId: 'p2' }), ['p1', 'p3'], false), { entfallen: true }, 'Fall 30: Ziel entfallen → { entfallen: true }');
  eq(loeseSprungZiel(sprung({ zielId: 'p2' }), ['p3', 'p1', 'p2'], true), { n: 2, gebunden: false }, 'Fall 30: eigene Timer-Liste → args[0], nicht gebunden');
  eq(loeseSprungZiel(sprung({}), ['p3', 'p1', 'p2'], false), { n: 2, gebunden: false }, 'Fall 30: ohne zielId → args[0], nicht gebunden');
  eq(loeseSprungZiel(sprung({ args: ['4'] }), ['p1'], false), { n: 4, gebunden: false }, 'Fall 30: Nummer von Hand als Text → Zahl');
  eq(loeseSprungZiel(sprung({ zielId: 'ersatz:Panel' }), ['ersatz:Keynote', 'ersatz:Panel'], false), { n: 2, gebunden: true }, 'Fall 30: Ersatz-Kennung als Ziel');
  eq(loeseSprungZiel(sprung({ zielId: 'p2' }), [], false), { entfallen: true }, 'Review-Focus 5: zielId, aber Show ohne Ablauf → entfallen, nichts senden');
}

// ── Teil 2a · Fall 31: verzögertes timer goto wird beim Senden aufgelöst (5.4, 6.2) ──
{
  // Zeile „Punkt 2“ trägt ein um 2 s verzögertes „Timer springe zu Punkt 2“.
  const sprung31: A7Aktion = { id: 'a-sprung31', role: 'timer', verb: 'goto', args: [2], enabled: true, delayMs: 2000, zielId: 'p2' };
  const doc31: A7Doc = {
    schemaVersion: 2,
    name: 'Fall 31',
    rows: [
      { id: 'p1', label: 'Punkt 1', quelle: 'ablauf', actions: [] },
      { id: 'p2', label: 'Punkt 2', quelle: 'ablauf', actions: [sprung31] },
      { id: 'p3', label: 'Punkt 3', quelle: 'ablauf', actions: [] },
    ],
  };
  const schluesselBeimGo = ['p1', 'p2', 'p3'];
  // GO auf „Punkt 2“: festgehalten wird das Aktionsobjekt selbst (5.4).
  const go31 = navigate(doc31, 1, { t: 'go' });
  eq(go31.fire.length === 1 && go31.fire[0] === sprung31, true, 'Fall 31: GO hält das Aktionsobjekt selbst fest, keine festgeschriebene Kopie');
  eq(loeseSprungZiel(go31.fire[0], schluesselBeimGo, false), { n: 2, gebunden: true }, 'Fall 31: beim GO stünde das Ziel auf Nummer 2');
  // Während die 2 s laufen, fügt ein Abgleich einen Punkt vor „Punkt 2“ ein.
  // Der Main hält danach die Schlüssel des neuen Ablaufs (5.2).
  const schluesselBeimSenden = ['p1', 'p-neu', 'p2', 'p3'];
  const beimSenden = loeseSprungZiel(go31.fire[0], schluesselBeimSenden, false);
  eq(beimSenden, { n: 3, gebunden: true }, 'Fall 31: beim Senden gilt der neue Stand → Nummer 3');
  eq(
    'n' in beimSenden ? buildActionLine('timer', 'goto', [beimSenden.n]) : 'nicht gesendet',
    'TIMER GOTO 3',
    'Fall 31: gesendet wird TIMER GOTO 3, nicht die alte 2',
  );
}

// ── Teil 2a · Navigation überspringt entfallene Zeilen (Fall 28) ─────────────
{
  const akt = (id: string): A7Aktion => ({ id, role: 'timer', verb: 'start', args: [], enabled: true });
  const navDoc: A7Doc = {
    schemaVersion: 2,
    name: 'Fall 28',
    rows: [
      { id: 'A', label: 'A', quelle: 'ablauf', actions: [akt('aA')] },
      { id: 'B', label: 'B', quelle: 'ablauf', entfallen: true, actions: [akt('aB')] },
      { id: 'X', label: 'X (eigen)', actions: [akt('aX')] },
      { id: 'D', label: 'D', quelle: 'ablauf', entfallen: true, actions: [akt('aD')] },
      { id: 'E', label: 'E', quelle: 'ablauf', actions: [] },
    ],
  };
  const goA = navigate(navDoc, 0, { t: 'go' });
  eq(goA.fire.map((a) => a.id), ['aA'], 'Fall 28: GO auf A feuert A');
  eq(goA.index, 2, 'Fall 28: GO auf A rückt über das entfallene B auf X');
  const goX = navigate(navDoc, 2, { t: 'go' });
  eq(goX.fire.map((a) => a.id), ['aX'], 'Fall 28: GO auf X feuert X');
  eq(goX.index, 4, 'Fall 28: GO auf X rückt über das entfallene D auf E');
  eq(navigate(navDoc, 4, { t: 'go' }).index, 4, 'Fall 28: GO auf der letzten nicht entfallenen Zeile bleibt stehen');
  eq(navigate(navDoc, 0, { t: 'next' }).index, 2, 'Fall 28: Weiter überspringt B');
  eq(navigate(navDoc, 4, { t: 'prev' }).index, 2, 'Fall 28: Zurück überspringt D');
  eq(navigate(navDoc, 2, { t: 'prev' }).index, 0, 'Fall 28: Zurück überspringt B');
  eq(navigate(navDoc, 0, { t: 'goto', n: 3 }).index, 2, 'Fall 28: GOTO zählt alle sichtbaren Zeilen (3 = X)');
  eq(navigate(navDoc, 0, { t: 'goto', n: 2 }).index, 2, 'Fall 28: GOTO 2 (entfallen) → nächste nicht entfallene (X)');
  eq(navigate(navDoc, 0, { t: 'goto', n: 4 }).index, 4, 'Fall 28: GOTO 4 (entfallen) → nächste nicht entfallene (E)');
  const goB = navigate(navDoc, 1, { t: 'go' });
  eq(goB.fire.map((a) => a.id), ['aX'], 'Fall 28: Markierung auf entfallener Zeile → GO feuert nie deren Aktionen, sondern die nächste');
  eq(goB.index, 4, 'Fall 28: … und rückt danach weiter auf E');
  const endeWeg: A7Doc = {
    schemaVersion: 2,
    name: 'Fall 28 Ende',
    rows: [
      { id: 'A', label: 'A', quelle: 'ablauf', actions: [] },
      { id: 'X', label: 'X (eigen)', actions: [] },
      { id: 'D', label: 'D', quelle: 'ablauf', entfallen: true, actions: [akt('aD')] },
    ],
  };
  eq(navigate(endeWeg, 0, { t: 'goto', n: 3 }).index, 1, 'Fall 28: GOTO auf entfallene ohne nicht entfallene dahinter → vorige (X)');
  eq(navigate(endeWeg, 1, { t: 'next' }).index, 1, 'Fall 28: Weiter vor einer entfallenen letzten Zeile bleibt stehen');
  const alleWeg: A7Doc = {
    schemaVersion: 2,
    name: 'Fall 28 alles entfallen',
    rows: [
      { id: 'B', label: 'B', quelle: 'ablauf', entfallen: true, actions: [akt('aB')] },
      { id: 'D', label: 'D', quelle: 'ablauf', entfallen: true, actions: [akt('aD')] },
    ],
  };
  const goWeg = navigate(alleWeg, 0, { t: 'go' });
  eq(goWeg.fire.length, 0, 'Fall 28: nur entfallene Zeilen → GO feuert nichts');
  eq(goWeg.index, 0, 'Fall 28: nur entfallene Zeilen → Markierung bleibt');
}

// ── Teil 2a · scharfNachBearbeitung (Fall 29) und indexVon (5.3) ─────────────
{
  const z = (id: string, extra: Partial<A7Zeile> = {}): A7Zeile => ({ id, label: id, actions: [], ...extra });
  const weg = { quelle: 'ablauf', entfallen: true } as const;
  const alt = [z('A'), z('B'), z('C'), z('D')];
  const altKopie = JSON.stringify(alt);
  eq(scharfNachBearbeitung(alt, [z('B'), z('C'), z('D')], 'C'), 'C', 'Fall 29: Zeile darüber gelöscht → scharfe Zeile bleibt C');
  eq(scharfNachBearbeitung(alt, [z('B'), z('C'), z('A'), z('D')], 'C'), 'C', 'Fall 29: Zeile darüber verschoben → scharfe Zeile bleibt C');
  eq(scharfNachBearbeitung(alt, [z('C'), z('A'), z('B'), z('D')], 'C'), 'C', 'Fall 29: scharfe Zeile selbst verschoben → bleibt scharf an neuer Stelle');
  eq(scharfNachBearbeitung(alt, [z('A'), z('B'), z('D')], 'C'), 'D', 'Fall 29: scharfe Zeile gelöscht → Nachfolger D');
  eq(
    scharfNachBearbeitung([z('A'), z('B'), z('C'), z('D'), z('E')], [z('A'), z('B'), z('D'), z('E')], 'C'),
    'D',
    'Fall 29: scharfe Zeile mitten im Ablauf gelöscht → unmittelbarer Nachfolger D, nicht der übernächste',
  );
  eq(
    scharfNachBearbeitung([z('A'), z('C'), z('D', weg), z('E')], [z('A'), z('D', weg), z('E')], 'C'),
    'E',
    'Fall 29: scharfe Zeile gelöscht, Nachfolger entfallen → nächste nicht entfallene E',
  );
  eq(
    scharfNachBearbeitung([z('A'), z('B'), z('C')], [z('A'), z('B', weg), z('C')], 'B'),
    'C',
    'Fall 29: scharfe Zeile steht danach als entfallene da → wie gelöscht (R7 c): Nachfolger C',
  );
  eq(scharfNachBearbeitung(alt, [z('A'), z('B'), z('C')], 'D'), 'C', 'Fall 29: letzte Zeile scharf und gelöscht → letzte nicht entfallene C');
  eq(
    scharfNachBearbeitung([z('A'), z('B'), z('X', weg)], [z('A'), z('X', weg)], 'B'),
    'A',
    'Fall 29: dahinter nur Entfallene → letzte nicht entfallene A',
  );
  eq(scharfNachBearbeitung([z('A')], [], 'A'), null, 'Fall 29: einzige Zeile gelöscht → null');
  eq(scharfNachBearbeitung([], [z('X', weg), z('N')], null), 'N', 'Fall 29: ohne scharfe Zeile → erste nicht entfallene Zeile');
  eq(
    scharfNachBearbeitung([z('A'), z('B')], [z('X', weg), z('A'), z('B')], 'weg'),
    'A',
    'Fall 29: scharfe Kennung unter alt unbekannt → erste nicht entfallene Zeile (R7 a)',
  );
  eq(JSON.stringify(alt), altKopie, 'Fall 29: Eingabe unverändert');
  eq(indexVon([z('A'), z('B'), z('C')], 'C'), 2, 'indexVon: Stelle der scharfen Zeile');
  eq(indexVon([z('A')], 'weg'), 0, 'indexVon: unbekannte Kennung → 0');
  eq(indexVon([z('A')], null), 0, 'indexVon: null → 0');
  eq(indexVon([], null), 0, 'indexVon: leere Liste → 0');
}

// ── Teil 2a · Absicherung in setDoc (Fall 32, 4.5) und „Als eigene Zeile behalten“ (4.3) ──
{
  let zaehler = 0;
  const neueId = (): string => `r_neu${++zaehler}`;
  const aktion: A7Aktion = { id: 'a1', role: 'titler', verb: 'take', args: [], enabled: true };
  const eingang: A7Zeile[] = [
    { id: 'p1', label: 'Punkt 1', quelle: 'ablauf', actions: [] },
    { id: 'p9', label: 'Schein', quelle: 'ablauf', actions: [] },
    { id: 'p2', label: 'Punkt 2', quelle: 'ablauf', entfallen: true, actions: [aktion] },
    { id: 'p3', label: 'Punkt 3', quelle: 'ablauf', entfallen: true, actions: [] },
    { id: 'p1', label: 'Doppelt', quelle: 'ablauf', actions: [] },
    { id: 'x1', label: 'Eigen', entfallen: true, actions: [] },
    { id: 'p4', label: 'Eigen mit Schlüssel', actions: [] },
    { id: 'x2', label: 'Eigen 2', actions: [] },
    // Bisher entfallen, der Renderer schickt sie aber ohne Marke.
    { id: 'p5', label: 'Punkt 5', quelle: 'ablauf', actions: [aktion] },
  ];
  const vorher = JSON.stringify(eingang);
  const aus = bereinigeQuellen(eingang, ['p1', 'p3', 'p4'], new Set(['p2', 'p5']), neueId);
  eq(aus[1], { id: 'r_neu1', label: 'Schein', actions: [] }, 'Fall 32: Ablaufzeile mit unbekannter id → eigene Zeile mit neuer id');
  eq(
    aus[8],
    { id: 'p5', label: 'Punkt 5', quelle: 'ablauf', actions: [aktion], entfallen: true },
    'Fall 32: bisher entfallene Zeile ohne Marke vom Renderer → der Main setzt entfallen wieder',
  );
  eq(
    aus,
    [
      { id: 'p1', label: 'Punkt 1', quelle: 'ablauf', actions: [] },
      { id: 'r_neu1', label: 'Schein', actions: [] },
      { id: 'p2', label: 'Punkt 2', quelle: 'ablauf', entfallen: true, actions: [aktion] },
      { id: 'p3', label: 'Punkt 3', quelle: 'ablauf', actions: [] },
      { id: 'r_neu2', label: 'Doppelt', actions: [] },
      { id: 'x1', label: 'Eigen', actions: [] },
      { id: 'r_neu3', label: 'Eigen mit Schlüssel', actions: [] },
      { id: 'x2', label: 'Eigen 2', actions: [] },
      { id: 'p5', label: 'Punkt 5', quelle: 'ablauf', actions: [aktion], entfallen: true },
    ],
    'Fall 32: lebend nur mit Schlüssel, entfallen nur wenn vorher entfallen, Markierung setzt der Main',
  );
  eq(new Set(aus.map((r) => r.id)).size, aus.length, 'Fall 32: danach ist jede id eindeutig');
  eq(aus[0] === eingang[0] && aus[2] === eingang[2] && aus[7] === eingang[7], true, 'Fall 32: unveränderte Zeilen bleiben dieselben Objekte');
  eq(JSON.stringify(eingang), vorher, 'Fall 32: Eingabe unverändert');
  eq(
    alsEigeneZeile(eingang[2], 'r_eigen'),
    { id: 'r_eigen', label: 'Punkt 2', actions: [aktion] },
    '4.3: „Als eigene Zeile behalten“ → ohne quelle/entfallen, neue id, Aktionen bleiben',
  );
}

// ── Teil 2a · Annehmen oder Abweisen (Fall 33, 5.5) ──────────────────────────
{
  let rev = 5;
  let abgleichRev = 0;
  // Renderer kennt Stand 5 und tippt zweimal schnell, ohne dass ein Abgleich läuft.
  eq(nimmAenderungAn(5, abgleichRev), true, 'Fall 33: erste schnelle eigene Änderung angenommen');
  rev++;
  eq(nimmAenderungAn(5, abgleichRev), true, 'Fall 33: zweite schnelle eigene Änderung (basisRev < rev) angenommen');
  rev++;
  // Ein Abgleich läuft: rev steigt, abgleichRev merkt sich den Stand.
  rev++;
  abgleichRev = rev;
  eq(nimmAenderungAn(7, abgleichRev), false, 'Fall 33: Änderung auf einem Stand vor dem Abgleich → abgewiesen');
  eq(nimmAenderungAn(rev, abgleichRev), true, 'Fall 33: Änderung auf dem Stand nach dem Abgleich → angenommen');
}

// ── Teil 2a · RELOAD-Zusammenfassung (Fall 34, 5.1) ──────────────────────────
{
  let jetzt = 0;
  const geplant: { fn: () => void; bei: number; weg: boolean }[] = [];
  const plane = (fn: () => void, ms: number): unknown => {
    const h = { fn, bei: jetzt + ms, weg: false };
    geplant.push(h);
    return h;
  };
  const storniere = (h: unknown): void => {
    (h as { weg: boolean }).weg = true;
  };
  const laufeBis = (t: number): void => {
    jetzt = t;
    for (const h of geplant.slice()) {
      if (!h.weg && h.bei <= t) {
        h.weg = true;
        h.fn();
      }
    }
  };
  const buendle = erzeugeBuendler(300, plane, storniere);
  let abgleiche = 0;
  const reload = (): void => buendle(() => abgleiche++);
  reload();
  laufeBis(100);
  reload();
  laufeBis(250);
  reload();
  laufeBis(549);
  eq(abgleiche, 0, 'Fall 34: bis 300 ms nach dem letzten RELOAD noch kein Abgleich');
  laufeBis(550);
  eq(abgleiche, 1, 'Fall 34: drei RELOADs binnen 300 ms → ein Abgleich');
  laufeBis(2000);
  eq(abgleiche, 1, 'Fall 34: danach kein weiterer Abgleich');
  reload();
  laufeBis(2300);
  eq(abgleiche, 2, 'Fall 34: ein neues RELOAD danach gleicht wieder ab');
  let zuletzt = '';
  buendle(() => (zuletzt = 'erstes'));
  buendle(() => (zuletzt = 'zweites'));
  laufeBis(2600);
  eq(zuletzt, 'zweites', 'Fall 34: ausgeführt wird die zuletzt übergebene Funktion');
  eq(geplant.filter((h) => !h.weg).length, 0, 'Fall 34: danach ist nichts mehr geplant');
}

// ── Teil 2a · Regieplan-Import „Ersetzen“ (Fall 36, 4.5) ─────────────────────
{
  const aktion: A7Aktion = { id: 'a1', role: 'titler', verb: 'take', args: [], enabled: true };
  const zeilen: A7Zeile[] = [
    { id: 'p1', label: 'Punkt 1', quelle: 'ablauf', actions: [] },
    { id: 'x1', label: 'Eigen 1', actions: [aktion] },
    { id: 'p2', label: 'Punkt 2', quelle: 'ablauf', entfallen: true, actions: [aktion] },
    { id: 'x2', label: 'Eigen 2', actions: [] },
  ];
  const importiert: A7Zeile[] = [
    { id: 'r_imp1', label: 'Import 1', actions: [] },
    { id: 'r_imp2', label: 'Import 2', note: 'Bühne', actions: [] },
  ];
  const vorher = JSON.stringify(zeilen);
  eq(
    ersetzeEigeneZeilen(zeilen, importiert).map((r) => r.id),
    ['p1', 'p2', 'r_imp1', 'r_imp2'],
    'Fall 36: eigene Zeilen ersetzt, Ablaufzeilen und entfallene bleiben, Import am Ende',
  );
  eq(JSON.stringify(zeilen), vorher, 'Fall 36: Eingabe unverändert');
  eq(
    ersetzeEigeneZeilen([], [{ id: 'r_imp3', label: 'Schein', quelle: 'ablauf', entfallen: true, actions: [] }]),
    [{ id: 'r_imp3', label: 'Schein', actions: [] }],
    'Fall 36: importierte Zeilen sind immer eigene Zeilen',
  );
}

// ── Teil 2a · Ausgangsstand beim Öffnen einer Show (Fall 35, 4.8, 5.2) ───────
{
  const aktion = { id: 'a1', role: 'titler', verb: 'take', args: [], enabled: true };
  const docGedaechtnis: A8Doc = {
    schemaVersion: 2,
    name: 'COP31 Tag 1',
    rows: [{ id: 'p1', label: 'Eröffnung', quelle: 'ablauf', actions: [aktion] }],
    kontext: 'se:prog-1',
  };
  const docDatei: A8Doc = {
    schemaVersion: 2,
    name: 'COP31 Tag 1',
    rows: [{ id: 'p1', label: 'Eröffnung', quelle: 'ablauf', actions: [] }],
    kontext: 'se:prog-1',
  };
  const stand: A8DateiStand = { pfad: 'D:\\Shows\\cop31.jmrundown', mtimeMs: 1727780000000, groesse: 812, sha256: 'aa11' };
  const gedaechtnis = (datei?: A8DateiStand, doc: A8Doc = docGedaechtnis): A8Gedaechtnis => ({
    schemaVersion: 2,
    showPfad: 'D:\\Shows\\COP31 Tag 1.jmshow',
    showName: 'COP31 Tag 1',
    doc,
    scharfId: 'p1',
    gespeichertAm: '2026-10-01T09:00:00.000Z',
    ...(datei ? { datei } : {}),
  });
  const autosaveV1: A8Doc = { schemaVersion: 2, name: 'COP31 Tag 1', rows: [{ id: 'r_alt', label: 'Eröffnung', actions: [aktion] }] };
  const basis = { gedaechtnis: null, datei: null, autosave: null, autosaveWarV1: false, showName: 'COP31 Tag 1' };

  // Gedächtnis vorhanden, keine eigene Datei → Gedächtnis samt scharfer Zeile.
  eq(
    waehleAusgangsstand({ ...basis, gedaechtnis: gedaechtnis(), autosave: autosaveV1, autosaveWarV1: true }),
    { quelle: 'gedaechtnis', doc: docGedaechtnis, scharfId: 'p1', ungespeichert: false },
    'Fall 35: Gedächtnis vorhanden → Gedächtnis (auch vor einem passenden alten Autosave)',
  );
  // Eigene Datei, kein Gedächtnis → Datei, ohne Hinweis.
  eq(
    waehleAusgangsstand({ ...basis, datei: { doc: docDatei, stand } }),
    { quelle: 'datei', doc: docDatei, hinweisAusserhalb: false },
    '4.8: eigene Datei ohne Gedächtnis → Datei, ohne Hinweis',
  );
  // Datei unverändert, Gedächtnis weicht inhaltlich ab → Gedächtnis, „ungespeicherte Änderungen“.
  eq(
    waehleAusgangsstand({ ...basis, gedaechtnis: gedaechtnis({ ...stand }), datei: { doc: docDatei, stand } }),
    { quelle: 'gedaechtnis', doc: docGedaechtnis, scharfId: 'p1', ungespeichert: true },
    '4.8: Datei unverändert, Gedächtnis weicht ab → Gedächtnis, ungespeichert',
  );
  // Datei unverändert, gleicher Inhalt in anderer Feldreihenfolge → nicht ungespeichert.
  const docDateiUmgestellt: A8Doc = {
    kontext: 'se:prog-1',
    rows: [{ actions: [aktion], quelle: 'ablauf', label: 'Eröffnung', id: 'p1' }],
    name: 'COP31 Tag 1',
    schemaVersion: 2,
  };
  eq(
    waehleAusgangsstand({ ...basis, gedaechtnis: gedaechtnis({ ...stand }), datei: { doc: docDateiUmgestellt, stand } }),
    { quelle: 'gedaechtnis', doc: docGedaechtnis, scharfId: 'p1', ungespeichert: false },
    '4.8: Datei unverändert und inhaltsgleich (andere Feldreihenfolge) → Gedächtnis, nicht ungespeichert',
  );
  // Datei außerhalb geändert: neuere Änderungszeit, andere Größe → Datei mit Hinweis.
  eq(
    waehleAusgangsstand({
      ...basis,
      gedaechtnis: gedaechtnis({ ...stand }),
      datei: { doc: docDatei, stand: { ...stand, mtimeMs: stand.mtimeMs + 60000, groesse: 900, sha256: 'bb22' } },
    }),
    { quelle: 'datei', doc: docDatei, hinweisAusserhalb: true },
    'Fall 35: Datei außerhalb geändert → Datei, mit Hinweis',
  );
  // Hineinkopiert: gleiche Änderungszeit und Größe, anderer SHA-256 → Datei mit Hinweis.
  eq(
    waehleAusgangsstand({
      ...basis,
      gedaechtnis: gedaechtnis({ ...stand }),
      datei: { doc: docDatei, stand: { ...stand, sha256: 'cc33' } },
    }),
    { quelle: 'datei', doc: docDatei, hinweisAusserhalb: true },
    'Fall 35: Datei mit alter Änderungszeit hineinkopiert → Datei (SHA-256), mit Hinweis',
  );
  // Gleicher Inhalt, neu gespeichert: nur die Änderungszeit ist anders → Datei mit Hinweis.
  eq(
    waehleAusgangsstand({
      ...basis,
      gedaechtnis: gedaechtnis({ ...stand }),
      datei: { doc: docDatei, stand: { ...stand, mtimeMs: stand.mtimeMs + 1000 } },
    }),
    { quelle: 'datei', doc: docDatei, hinweisAusserhalb: true },
    '4.8: nur die Änderungszeit anders → Datei, mit Hinweis',
  );
  // Verglichen wird über alle vier Merkmale (4.8), also auch über die Größe allein.
  eq(
    waehleAusgangsstand({
      ...basis,
      gedaechtnis: gedaechtnis({ ...stand }),
      datei: { doc: docDatei, stand: { ...stand, groesse: stand.groesse + 1 } },
    }),
    { quelle: 'datei', doc: docDatei, hinweisAusserhalb: true },
    '4.8: nur die Größe anders → Datei, mit Hinweis',
  );
  // Anderer Pfad (Show zeigt jetzt auf eine andere Datei) → Datei mit Hinweis.
  eq(
    waehleAusgangsstand({
      ...basis,
      gedaechtnis: gedaechtnis({ ...stand }),
      datei: { doc: docDatei, stand: { ...stand, pfad: 'D:\\Shows\\cop31-neu.jmrundown' } },
    }),
    { quelle: 'datei', doc: docDatei, hinweisAusserhalb: true },
    '4.8: anderer Pfad → Datei, mit Hinweis',
  );
  // Gedächtnis hat die Datei nie gesehen (früher keine eigene Datei) → Datei mit Hinweis.
  eq(
    waehleAusgangsstand({ ...basis, gedaechtnis: gedaechtnis(), datei: { doc: docDatei, stand } }),
    { quelle: 'datei', doc: docDatei, hinweisAusserhalb: true },
    '4.8: Gedächtnis ohne Dateistand, Show hat jetzt eine Datei → Datei, mit Hinweis',
  );
  // Übergangsregel: alter Autosave (Version 1) mit gleichem Namen → übernommen mit zuordnungOffen.
  eq(
    waehleAusgangsstand({ ...basis, autosave: autosaveV1, autosaveWarV1: true }),
    { quelle: 'autosave-v1', doc: { ...autosaveV1, zuordnungOffen: true } },
    'Fall 35: alter Autosave mit gleichem Namen → übernommen mit zuordnungOffen',
  );
  eq(autosaveV1.zuordnungOffen, undefined, 'Fall 35: der übergebene Autosave bleibt unverändert');
  eq(
    waehleAusgangsstand({ ...basis, autosave: { ...autosaveV1, name: 'COP31 Tag 2' }, autosaveWarV1: true }),
    { quelle: 'leer' },
    'Fall 35: Autosave mit anderem Namen → leer',
  );
  eq(
    waehleAusgangsstand({ ...basis, autosave: autosaveV1, autosaveWarV1: false }),
    { quelle: 'leer' },
    'Fall 35: Autosave schon Version 2 → leer (Übergangsregel nur für Version 1)',
  );
  eq(waehleAusgangsstand({ ...basis }), { quelle: 'leer' }, 'Fall 35: kein Autosave (Beispiel-Dokument) → leer');
  eq(
    waehleAusgangsstand({ ...basis, datei: { doc: docDatei, stand }, autosave: autosaveV1, autosaveWarV1: true }),
    { quelle: 'datei', doc: docDatei, hinweisAusserhalb: false },
    '5.2: Übergangsregel nur ohne eigene Datei → Datei gilt',
  );
}

// ── A10: Hinweistexte (Spec 4.6, wortgleich) ─────────────────────────────────
{
  const { berichtText, scharfVerruecktText, kontextWechselText, showNichtLesbarText, abweisungText, sprungEntfallenText } =
    hinweisModul;
  const leer = { geaendert: 0, neu: 0, entfallen: 0, entfernt: 0, zurueck: 0, verschoben: 0, scharfVerrueckt: null };
  eq(
    berichtText({ geaendert: 2, neu: 1, entfallen: 1, entfernt: 0, zurueck: 1, verschoben: 2, scharfVerrueckt: null }, true),
    'iveo: 2 geändert · 1 neu · 1 entfallen · 1 wieder da · neu sortiert',
    'Bericht: Beispiel aus 4.6 wortgleich',
  );
  eq(berichtText({ ...leer, entfallen: 1, entfernt: 2 }, false), 'Show: 3 entfallen', 'Bericht ohne iveo: „Show:“, entfallen + entfernt zusammen');
  eq(berichtText({ ...leer, neu: 3 }, true), 'iveo: 3 neu', 'Bericht: nur Teile mit Zähler > 0');
  eq(berichtText({ ...leer, scharfVerrueckt: { von: 'A', nach: 'B' } }, true), null, 'Bericht nur mit scharfVerrueckt → kein Kurz-Hinweis');
  eq(
    scharfVerruecktText({ von: 'Panel', nach: 'Pause' }),
    'Deine scharfe Zeile „Panel“ ist entfallen. Scharf ist jetzt „Pause“.',
    'scharfVerrueckt mit Nachfolger',
  );
  eq(
    scharfVerruecktText({ von: 'Panel', nach: null }),
    'Deine scharfe Zeile „Panel“ ist entfallen. Es gibt keine Zeile mehr.',
    'scharfVerrueckt ohne Nachfolger',
  );
  eq(kontextWechselText('se:p1', [{ id: 'p1', title: 'Klima-Panel' }]), 'Side Event gewechselt: Klima-Panel', 'Wechsel zu se: mit Titel');
  eq(kontextWechselText('se:p9', []), 'Side Event gewechselt: p9', 'Wechsel zu se: ohne Titel → programId');
  eq(kontextWechselText('liste:2026-11-12|panel||0', []), 'iveo: Programmliste 2026-11-12', 'Wechsel zu liste: mit Tag');
  eq(kontextWechselText('liste:|||0', []), 'iveo: Programmliste alle Tage', 'Wechsel zu liste: ohne Tag');
  eq(kontextWechselText('show', []), 'Show-Ablauf (ohne iveo)', 'Wechsel zu show');
  eq(showNichtLesbarText('kein gültiges JSON'), 'Show nicht lesbar: kein gültiges JSON', 'Show nicht lesbar');
  eq(
    abweisungText(true),
    'Gleichzeitig kam ein iveo-Abgleich. Deine letzte Änderung wurde nicht übernommen, bitte wiederholen.',
    'Abweisung mit iveo',
  );
  eq(
    abweisungText(false),
    'Gleichzeitig kam ein Abgleich mit der Show. Deine letzte Änderung wurde nicht übernommen, bitte wiederholen.',
    'Abweisung ohne iveo',
  );
  eq(sprungEntfallenText('Panel'), 'Sprung nicht gesendet: Ziel „Panel“ ist entfallen.', 'Sprung-Ziel entfallen');
  eq(
    hinweisModul.RELOAD_OHNE_SHOW,
    'RELOAD empfangen, aber keine Show geladen (nicht per Show gestartet) — nichts neu eingelesen.',
    'RELOAD ohne Show: wortgleich zur Timer-Warnung',
  );
  eq(hinweisModul.DATEI_AUSSERHALB, 'Rundown-Datei wurde außerhalb geändert, Datei geladen.', 'Datei außerhalb geändert');
}

// ── A10: Zeilen-Helfer im Main (5.2, 6.2) ────────────────────────────────────
{
  const { ablaufSchluesselAusZeilen, ersteLebendeZeile, kontextIstIveo, sendeArgs, sprungZielTitel } = zeilenModul;
  const zeilen = [
    { id: 'u2', label: 'Panel', quelle: 'ablauf' as const, entfallen: true as const, actions: [] },
    { id: 'u1', label: 'Begrüßung', quelle: 'ablauf' as const, actions: [] },
    { id: 'r1', label: 'Einspieler', actions: [] },
  ];
  eq(ablaufSchluesselAusZeilen(zeilen), ['u1'], 'Schlüssel aus Zeilen: nur lebende Ablaufzeilen');
  eq(ersteLebendeZeile(zeilen), 'u1', 'erste nicht entfallene Zeile');
  eq(ersteLebendeZeile([zeilen[0]]), null, 'nur entfallene → null');
  eq(
    [kontextIstIveo('se:p1'), kontextIstIveo('liste:|||0'), kontextIstIveo('show'), kontextIstIveo(undefined)],
    [true, true, false, false],
    'Kontext mit iveo',
  );

  // 9.1 Fall 31 im Main: fireOne ruft sendeArgs erst beim Senden, gegen den dann aktuellen Ablauf.
  const sprung = { id: 'a9', role: 'timer', verb: 'goto', args: [2], enabled: true, zielId: 'u3' };
  const loese = (schluessel: string[], eigeneListe: boolean) => (a: typeof sprung) =>
    sprungModul.loeseSprungZiel(a, schluessel, eigeneListe);
  eq(sendeArgs(sprung, loese(['u1', 'u2', 'u3'], false)), [3], 'Sprung beim GO: Stelle der zielId');
  eq(sendeArgs(sprung, loese(['u1', 'neu', 'u2', 'u3'], false)), [4], 'Abgleich vor dem Senden → neue Nummer');
  eq(sendeArgs(sprung, loese(['u1'], false)), null, 'Ziel entfallen → nichts senden');
  eq(sendeArgs(sprung, loese([], false)), null, 'Show ohne Ablauf → nichts senden');
  eq(sendeArgs(sprung, loese(['u1', 'u2', 'u3'], true)), [2], 'eigene Timer-Liste → Argumente unverändert');
  const ohneZiel = { id: 'a7', role: 'timer', verb: 'goto', args: [], enabled: true };
  eq(sendeArgs(ohneZiel, loese(['u1'], false)), [], 'ohne zielId und ohne Nummer → unverändert (kein NaN)');
  const start = { id: 'a8', role: 'timer', verb: 'start', args: [], enabled: true };
  eq(
    sendeArgs(start, () => {
      throw new Error('darf nicht auflösen');
    }),
    [],
    'andere Aktionen: Argumente unverändert, keine Auflösung',
  );
  eq(sprungZielTitel(zeilen, { ...sprung, zielId: 'u2' }), 'Panel', 'Titel des Sprung-Ziels aus der Zeile');
  eq(sprungZielTitel(zeilen, sprung), 'Punkt 2', 'Ziel ohne Zeile → „Punkt <args[0]>“');
}

// ── A10 Fix-Runde 1 ──────────────────────────────────────────────────────────
{
  // Spec 4.6: Kappung trifft nur kurze Hinweise, stehende bleiben.
  const { fuegeHinweisAn, ohneHinweisText, GEDAECHTNIS_GESPERRT } = hinweisModul as any;
  let liste: { id: number; text: string; art: 'kurz' | 'stehend' }[] = [{ id: 1, text: 'stehend 1', art: 'stehend' }];
  for (let i = 2; i <= 10; i++) liste = fuegeHinweisAn(liste, { id: i, text: `kurz ${i}`, art: 'kurz' });
  eq(liste.filter((h) => h.art === 'stehend').length, 1, 'Kappung: stehender Hinweis bleibt trotz vieler kurzer');
  eq(liste.filter((h) => h.art === 'kurz').map((h) => h.id), [5, 6, 7, 8, 9, 10], 'Kappung: nur die 6 neuesten kurzen');
  eq(liste[0].id, 1, 'Kappung: Reihenfolge bleibt');
  const viele = fuegeHinweisAn(
    [1, 2, 3, 4, 5, 6, 7].map((i) => ({ id: i, text: `s${i}`, art: 'stehend' as const })),
    { id: 8, text: 'k', art: 'kurz' },
  );
  eq(viele.length, 8, 'Kappung: sieben stehende plus ein kurzer bleiben alle');
  eq(ohneHinweisText(liste, 'stehend 1').length, liste.length - 1, 'ohneHinweisText entfernt den Hinweis mit dem Text');
  eq(GEDAECHTNIS_GESPERRT, 'Gespeicherter Stand dieser Show ist gerade nicht lesbar und wird nicht überschrieben.', 'Text der Schreibsperre');

  // Spec 5.2: RELOAD einer Show, die vorher keinen Ablauf hatte, ist eine "andere Show".
  const { ablaufNeuEntstanden } = zeilenModul as any;
  eq(
    [ablaufNeuEntstanden(true, 3), ablaufNeuEntstanden(true, 0), ablaufNeuEntstanden(false, 3), ablaufNeuEntstanden(false, 0)],
    [true, false, false, false],
    'RELOAD: nur "vorher leer, jetzt Ablauf" lädt wie eine andere Show',
  );

  // Spec 6.2 letzter Satz: festgehaltene zielId über R0-Umbenennungen seit dem GO abbilden.
  const { bildeZielAb } = sprungModul as any;
  eq(bildeZielAb('ersatz:X', [{ 'ersatz:X': 'u9' }]), 'u9', 'zielId: Ersatz-Kennung → echte Kennung');
  eq(bildeZielAb('ersatz:X', [{ 'ersatz:X': 'u9' }, { u9: 'u10' }]), 'u10', 'zielId: Umbenennungen nacheinander');
  eq(bildeZielAb('u1', [{ 'ersatz:X': 'u9' }]), 'u1', 'zielId: unberührt');
  eq(bildeZielAb(undefined, [{ a: 'b' }]), undefined, 'zielId: ohne Kennung bleibt ohne');
  eq(bildeZielAb('toString', [{}]), 'toString', 'zielId: Objekt-Prototyp wird nicht gelesen');
  const mitUmbenennung = { id: 'a1', role: 'timer', verb: 'goto', args: [2], enabled: true, zielId: 'ersatz:X' };
  eq(
    sprungModul.loeseSprungZiel({ ...mitUmbenennung, zielId: bildeZielAb('ersatz:X', [{ 'ersatz:X': 'u2' }]) }, ['u1', 'u2'], false),
    { n: 2, gebunden: true },
    'verzögerter Sprung findet sein Ziel nach der Umbenennung',
  );
  eq(sprungModul.loeseSprungZiel(mitUmbenennung, ['u1', 'u2'], false), { entfallen: true }, 'ohne Abbildung wäre das Ziel entfallen (Mangel)');

  // wendeShowAn meldet die Umbenennungen (R0) nach außen.
  const r0 = wendeShowAn({
    doc: { schemaVersion: 2, name: 'X', kontext: 'show', rows: [{ id: 'ersatz:A', label: 'A', quelle: 'ablauf', actions: [] }] },
    scharfId: null,
    show: { name: 'X', ablauf: [{ id: 'u1', label: 'A' }], iveo: { filter: { programId: 'p1' } } },
  }) as any;
  eq(typeof r0.umbenannt, 'object', 'wendeShowAn liefert umbenannt');
  eq(wendeShowAn({ doc: { schemaVersion: 2, name: 'X', rows: [] }, scharfId: null, show: { name: 'X' } }).umbenannt, {}, 'ohne Ablauf: umbenannt leer');

  // 4.8: Pfadvergleich ohne Groß-/Kleinschreibung und Schrägstrich-Art (Windows).
  const dok: A8Doc = { schemaVersion: 2, name: 'N', rows: [], kontext: 'show' };
  const st: A8DateiStand = { pfad: 'D:\\Shows\\Cop31.jmrundown', mtimeMs: 1, groesse: 2, sha256: 'ab' };
  const gd: A8Gedaechtnis = { schemaVersion: 2, showPfad: 'D:\\s.jmshow', showName: 'N', doc: dok, scharfId: null, gespeichertAm: '', datei: st };
  const andereSchreibweise: A8DateiStand = { ...st, pfad: 'd:/shows/COP31.jmrundown' };
  const wahl = (stand: A8DateiStand, windows: boolean) =>
    waehleAusgangsstand({ gedaechtnis: gd, datei: { doc: dok, stand }, autosave: null, autosaveWarV1: false, showName: 'N', windows } as any).quelle;
  eq(wahl(andereSchreibweise, true), 'gedaechtnis', 'Windows: Pfad in anderer Groß-/Kleinschreibung = gleicher Stand');
  eq(wahl(andereSchreibweise, false), 'datei', 'nicht Windows: Groß-/Kleinschreibung zählt');
  eq(wahl({ ...andereSchreibweise, pfad: 'D:\\Shows\\anders.jmrundown' }, true), 'datei', 'Windows: anderer Dateiname bleibt ungleich');
}

// ── A11: Sperren, Hinweise, Sprung-Auswahl, Duplizieren (4.5, 6.2) ───────────
{
  const { zeilenArt, sperrenFuer, zeilenHinweis, ablaufPunkte, dupliziereZeile } = zeilenModul;
  const titler = { id: 'a1', role: 'titler', verb: 'take', args: ['x'], enabled: true };
  const lebend = { id: 'u1', label: 'Begrüßung', quelle: 'ablauf' as const, actions: [titler] };
  const weg = { id: 'u2', label: 'Panel', quelle: 'ablauf' as const, entfallen: true as const, actions: [] };
  const eigen = { id: 'r1', label: 'Einspieler', actions: [] };
  eq([zeilenArt(lebend), zeilenArt(weg), zeilenArt(eigen)], ['ablauf', 'entfallen', 'eigen'], 'Zeilenarten');
  eq(sperrenFuer(lebend, true), { text: true, verschieben: true, loeschen: true }, '4.5: lebende Ablaufzeile gesperrt, nicht löschbar');
  eq(sperrenFuer(weg, true), { text: true, verschieben: true, loeschen: false }, '4.5: entfallene Zeile gesperrt, aber löschbar');
  eq(sperrenFuer(eigen, true), { text: false, verschieben: false, loeschen: false }, '4.5: eigene Zeile frei');
  eq(sperrenFuer(lebend, false), { text: false, verschieben: false, loeschen: false }, '4.5: ohne gemerkte Show alles frei');
  eq(zeilenHinweis(lebend, true, true), 'kommt aus iveo', '4.5: Hinweis Ablaufzeile mit iveo');
  eq(zeilenHinweis(lebend, true, false), 'kommt aus der Show, im Show-Editor ändern', '4.5: Hinweis Ablaufzeile ohne iveo');
  eq(zeilenHinweis(lebend, false, true), null, '4.5: ohne gemerkte Show kein Hinweis an Ablaufzeilen');
  eq(zeilenHinweis(weg, true, true), 'in iveo entfallen', '4.5: Hinweis entfallen mit iveo');
  eq(zeilenHinweis(weg, false, false), 'in der Show entfallen', '4.5: ohne Show behält die entfallene Zeile ihren Hinweis');
  eq(zeilenHinweis(eigen, true, true), null, '4.5: eigene Zeile ohne Hinweis');
  eq(
    ablaufPunkte([lebend, weg, eigen], ['u1', 'u9']),
    [
      { n: 1, id: 'u1', label: 'Begrüßung' },
      { n: 2, id: 'u9', label: 'u9' },
    ],
    '6.2: Auswahl in Ablaufreihenfolge mit Nummer und Titel',
  );

  const doc: RundownDoc = { schemaVersion: 2, name: 'T', kontext: 'se:p1', rows: [lebend, weg, eigen] };
  let k = 0;
  const neueId = (p: 'r' | 'a'): string => `${p}_k${++k}`;
  const d = dupliziereZeile(doc, 'u1', neueId);
  eq(d.rows.map((r) => r.id), ['u1', 'r_k1', 'u2', 'r1'], 'Duplizieren: Kopie direkt hinter dem Original');
  eq(
    d.rows[1],
    { id: 'r_k1', label: 'Begrüßung (Kopie)', actions: [{ ...titler, id: 'a_k2' }] },
    'Duplizieren: eigene Zeile ohne quelle, neue ids, Titel mit „(Kopie)“',
  );
  eq(d.rows[1].actions[0].args !== titler.args, true, 'Duplizieren: args kopiert, nicht geteilt');
  eq(dupliziereZeile(doc, 'fehlt', neueId) === doc, true, 'Duplizieren: unbekannte Zeile → Dokument unverändert');
  eq('entfallen' in dupliziereZeile(doc, 'u2', neueId).rows[2], false, 'Duplizieren einer entfallenen Zeile → ohne entfallen');

  // 9.1 Fall 21 mit dem echten Abgleich: Kopie bleibt eigene Zeile hinter dem Original, Bericht leer.
  const basis: RundownDoc = { schemaVersion: 2, name: 'T', kontext: 'se:p1', rows: [lebend] };
  const kopiert = dupliziereZeile(basis, 'u1', neueId);
  const g = abgleichModul.gleicheAb({
    alt: kopiert.rows,
    ablauf: [{ id: 'u1', label: 'Begrüßung' }],
    scharfId: 'u1',
    altformat: false,
  });
  eq(g.rows.map((r) => r.id), kopiert.rows.map((r) => r.id), 'Fall 21: Kopie bleibt direkt hinter dem Original');
  eq('quelle' in g.rows[1], false, 'Fall 21: Kopie bleibt eigene Zeile');
  eq(abgleichModul.berichtIstLeer(g.bericht), true, 'Fall 21: Bericht leer');
}

// ── A11 Fix-Runde 1: Verschieben (4.5/R6) und Import-Meldung (5.5) ───────────
{
  const { darfVerschieben, verschiebeZeilen, importMeldung } = zeilenModul as any;
  const a1 = { id: 'u1', label: 'A1', quelle: 'ablauf' as const, actions: [] };
  const a2 = { id: 'u2', label: 'A2', quelle: 'ablauf' as const, actions: [] };
  const gone = { id: 'u3', label: 'A3', quelle: 'ablauf' as const, entfallen: true as const, actions: [] };
  const e1 = { id: 'r1', label: 'E1', actions: [] };
  const e2 = { id: 'r2', label: 'E2', actions: [] };
  eq([darfVerschieben(a1, true), darfVerschieben(gone, true), darfVerschieben(e1, true)], [false, false, true], '4.5: Verschieben nur für eigene Zeilen');
  eq(darfVerschieben(a1, false), true, '4.5: ohne gemerkte Show frei');
  const rows = [a1, e1, a2, gone, e2];
  eq(verschiebeZeilen(rows, 0, 2, true) === rows, true, 'gesperrte Ablaufzeile bleibt, wo sie ist');
  eq(verschiebeZeilen(rows, 3, 0, true) === rows, true, 'entfallene Zeile bleibt, wo sie ist');
  eq(verschiebeZeilen(rows, 1, 9, true) === rows, true, 'Ziel außerhalb: unverändert');
  const alleZiele: boolean[] = [];
  for (let to = 0; to < rows.length; to++) {
    const neu = verschiebeZeilen(rows, 4, to, true) as typeof rows;
    alleZiele.push(JSON.stringify(neu.filter((r) => r.quelle).map((r) => r.id)) === JSON.stringify(['u1', 'u2', 'u3']));
  }
  eq(alleZiele.every(Boolean), true, 'R6: Ablaufzeilen behalten nach jeder erlaubten Verschiebung ihre Reihenfolge');
  eq((verschiebeZeilen(rows, 4, 1, true) as typeof rows).map((r) => r.id), ['u1', 'r2', 'r1', 'u2', 'u3'], 'eigene Zeile wird verschoben');

  eq(importMeldung(3, true, 0, 0), '3 Punkte importiert (ersetzt).', '5.5: Import angenommen, ersetzt');
  eq(importMeldung(3, false, 2, 2), '3 Punkte angehängt.', '5.5: Import angenommen, angehängt');
  eq(importMeldung(3, true, 0, 1), 'Import abgewiesen, Show hat sich geändert – bitte erneut importieren.', '5.5: Abweisung statt Erfolgsmeldung');
}

// ── Teil 2b · Speaker-Aktion über die Kennung (Spec 8.1–8.4, 9.4 Nr. 1–5, Review Focus 3) ──
{
  const neueIdB15 = (p: 'r' | 'a'): string => `${p}-b15`;
  const abruf = (extra: Partial<RundownAction> = {}): RundownAction => ({
    id: 'a-b15',
    role: 'titler',
    verb: 'recall',
    args: ['Alan'],
    enabled: true,
    ...extra,
  });
  const SP: ShowIveoSpeaker[] = [
    { id: 's-1', name: 'Ada', title: 'Moderation' },
    { id: 's-3', name: 'Alan', title: 'Panel' },
    { id: 'id mit leer', name: 'Grace', title: 'Keynote' },
    { name: 'Hedy' },
  ];

  // Nr. 1: normAction übernimmt speakerId nur als String mit 1 bis 200 Zeichen (8.1).
  const roh = (speakerId: unknown): unknown => ({ id: 'a1', role: 'titler', verb: 'recall', args: ['Alan'], enabled: true, speakerId });
  eq(
    normAction(roh('s-3'), neueIdB15),
    { id: 'a1', role: 'titler', verb: 'recall', args: ['Alan'], enabled: true, speakerId: 's-3' },
    'Nr. 1: normAction behält speakerId, args[0] behält den Namen',
  );
  eq('speakerId' in normAction(roh(''), neueIdB15), false, "Nr. 1: speakerId '' entfällt");
  eq('speakerId' in normAction(roh('x'.repeat(201)), neueIdB15), false, 'Nr. 1: speakerId mit 201 Zeichen entfällt');
  eq('speakerId' in normAction(roh(42), neueIdB15), false, 'Nr. 1: speakerId 42 (keine Zeichenkette) entfällt');
  eq(normAction(roh('x'.repeat(200)), neueIdB15).speakerId?.length, 200, 'Nr. 1: speakerId mit 200 Zeichen bleibt');
  const docB15 = migrate(
    JSON.parse(JSON.stringify({ schemaVersion: 2, name: 'B15', rows: [{ id: 'r1', label: 'Z', actions: [abruf({ speakerId: 's-3' })] }] })),
    neueIdB15,
  );
  eq(docB15.rows[0].actions[0].speakerId, 's-3', 'Nr. 1: migrate (setDoc, Autosave, Gedächtnis) behält speakerId');
  eq(docB15.schemaVersion, 2, 'Nr. 1: schemaVersion bleibt 2');

  // istSpeakerAbruf: nur titler recall.
  eq(
    [istSpeakerAbruf(abruf()), istSpeakerAbruf(abruf({ verb: 'take', args: [] })), istSpeakerAbruf(abruf({ role: 'timer', verb: 'goto', args: [2] }))],
    [true, false, false],
    'istSpeakerAbruf: nur titler recall',
  );

  // Nr. 2: loeseSpeakerZiel, jede Zeile der Tabelle 8.3.
  eq(loeseSpeakerZiel(abruf({ role: 'timer', verb: 'goto', args: [2], speakerId: 's-3' }), SP, true), [2], 'Nr. 2: timer goto mit übrig gebliebener speakerId → args unverändert');
  eq(loeseSpeakerZiel(abruf({ verb: 'take', args: [], speakerId: 's-3' }), SP, true), [], 'Nr. 2: titler take mit speakerId → args unverändert');
  eq(loeseSpeakerZiel(abruf(), SP, true), ['Alan'], 'Nr. 2: ohne speakerId, Titler versteht Kennungen → args unverändert');
  eq(loeseSpeakerZiel(abruf(), SP, false), ['Alan'], 'Nr. 2: ohne speakerId, Titler alt → args unverändert');
  eq(loeseSpeakerZiel(abruf({ speakerId: 's-3' }), SP, true), ['@s-3', 'Alan'], 'Nr. 2: speakerId, recall_kennung=1 → @-Form mit Namen');
  eq(loeseSpeakerZiel(abruf({ speakerId: 's-7' }), SP, true), ['@s-7', 'Alan'], 'Nr. 2: speakerId nicht in der Liste, recall_kennung=1 → @-Form mit args[0]');
  eq(loeseSpeakerZiel(abruf({ speakerId: 's-7', args: [''] }), SP, true), ['@s-7'], 'Nr. 2: @-Form ohne Namen, wenn keiner bekannt ist');
  eq(loeseSpeakerZiel(abruf({ speakerId: 'id mit leer', args: ['Grace alt'] }), SP, true), ['Grace'], 'Nr. 2: speakerId mit Leerraum → aktueller Name statt @-Form');
  eq(loeseSpeakerZiel(abruf({ speakerId: 's-3' }), SP, false), ['Alan'], 'Nr. 2: speakerId, Titler meldet es nicht → aktueller Name');
  eq(loeseSpeakerZiel(abruf({ speakerId: 's-7', args: ['Alan'] }), SP, false), ['Alan'], 'Nr. 2: speakerId nicht in der Liste, Titler alt → args[0]');
  eq(loeseSpeakerZiel(abruf({ speakerId: 's-1', args: ['Ada', 'x'] }), SP, false), ['Ada', 'x'], 'Nr. 2: Namensform behält weitere Argumente');
  eq(buildActionLine('titler', 'recall', loeseSpeakerZiel(abruf({ speakerId: 's-3' }), SP, true)), 'TITLER RECALL @s-3 Alan', 'Nr. 2: gesendete Zeile in der @-Form');

  // Nr. 3: Umbenennung in iveo — gesendet wird der NEUE Name.
  const umbenannt: ShowIveoSpeaker[] = SP.map((s) => (s.id === 's-3' ? { ...s, name: 'Alan Turing' } : s));
  eq(loeseSpeakerZiel(abruf({ speakerId: 's-3' }), umbenannt, true), ['@s-3', 'Alan Turing'], 'Nr. 3: Umbenennung, mit Fähigkeit → @s-3 und der neue Name');
  eq(loeseSpeakerZiel(abruf({ speakerId: 's-3' }), umbenannt, false), ['Alan Turing'], 'Nr. 3: Umbenennung, ohne Fähigkeit → nur der neue Name');
  eq(buildActionLine('titler', 'recall', loeseSpeakerZiel(abruf({ speakerId: 's-3' }), umbenannt, false)), 'TITLER RECALL Alan Turing', 'Nr. 3: gesendete Zeile ohne Fähigkeit');

  // Nr. 4: Chip-Text (8.4).
  eq(speakerChipArgs(abruf({ speakerId: 's-3' }), umbenannt), ['Alan Turing'], 'Nr. 4: Chip mit bekannter Kennung → aktueller Name');
  eq(speakerChipArgs(abruf({ speakerId: 's-7' }), SP), ['Alan, nicht in der Speaker-Liste'], 'Nr. 4: Chip mit unbekannter Kennung');
  eq(SPEAKER_NICHT_IN_LISTE, 'nicht in der Speaker-Liste', 'Nr. 4: Zusatz wörtlich aus 8.4');
  eq(
    `JM Titler · DataLink-Eintrag abrufen (${speakerChipArgs(abruf({ speakerId: 's-7' }), SP).join(' ')})`,
    'JM Titler · DataLink-Eintrag abrufen (Alan, nicht in der Speaker-Liste)',
    'Nr. 4: Etikett wie actionLabel es zusammensetzt',
  );
  eq(speakerChipArgs(abruf(), SP), ['Alan'], 'Nr. 4: Chip ohne speakerId → args unverändert');
  eq(speakerChipArgs(abruf({ role: 'timer', verb: 'goto', args: [2], speakerId: 's-3' }), SP), [2], 'Nr. 4: Chip einer anderen Aktion → args unverändert');

  // Nr. 5: aktionAendern entfernt speakerId (8.1).
  const gebunden = abruf({ speakerId: 's-3' });
  const r1 = aktionAendern(gebunden, { role: 'timer', verb: 'start', args: [], zielId: undefined });
  eq(['speakerId' in r1, r1.role, r1.verb], [false, 'timer', 'start'], 'Nr. 5: Rollenwechsel entfernt speakerId');
  const r2 = aktionAendern(gebunden, { verb: 'take', args: [], zielId: undefined });
  eq(['speakerId' in r2, r2.verb], [false, 'take'], 'Nr. 5: Verbwechsel entfernt speakerId');
  const leerPatch = speakerPatch('', SP);
  const r3 = leerPatch ? aktionAendern(gebunden, leerPatch) : gebunden;
  eq(['speakerId' in r3, r3.args], [false, ['']], 'Nr. 5: „— Speaker wählen —“ entfernt speakerId');
  const r4 = aktionAendern(gebunden, { args: ['Grace'] });
  eq(['speakerId' in r4, r4.args], [false, ['Grace']], 'Nr. 5: Hand-Änderung an args[0] entfernt speakerId');
  eq(aktionAendern(gebunden, { args: ['Alan'] }).speakerId, 's-3', 'Nr. 5: gleiches args[0] (Feld verlassen ohne Änderung) behält speakerId');
  eq(aktionAendern(gebunden, { enabled: false }).speakerId, 's-3', 'Nr. 5: andere Felder (aktiviert) behalten speakerId');
  eq(aktionAendern(gebunden, { delayMs: 500 }).speakerId, 's-3', 'Nr. 5: Verzögerung behält speakerId');
  eq(aktionAendern(gebunden, { role: 'titler' }).speakerId, 's-3', 'Nr. 5: dieselbe Rolle noch einmal gesetzt behält speakerId');
  eq('speakerId' in aktionAendern(gebunden, { speakerId: undefined }), false, 'Nr. 5: speakerId undefined im Patch → kein Schlüssel speakerId im Ergebnis');
  const wahl = speakerPatch('id:s-1', SP);
  eq(wahl ? aktionAendern(abruf(), wahl) : null, abruf({ args: ['Ada'], speakerId: 's-1' }), 'Nr. 5: Picker-Auswahl setzt speakerId und den Namen in args[0]');
  const umwahl = speakerPatch('id:s-1', SP);
  eq(umwahl ? aktionAendern(gebunden, umwahl) : null, abruf({ args: ['Ada'], speakerId: 's-1' }), 'Nr. 5: Picker-Auswahl ersetzt eine vorhandene speakerId');
  const ohneId = speakerPatch('name:Hedy', SP);
  const r5 = ohneId ? aktionAendern(gebunden, ohneId) : gebunden;
  eq(['speakerId' in r5, r5.args], [false, ['Hedy']], 'Nr. 5: Auswahl eines Speakers ohne Kennung → Name, keine speakerId');

  // speakerPatch: alle Werte.
  eq(speakerPatch('', SP), { args: [''] }, "speakerPatch '' → args [''] …");
  eq('speakerId' in (speakerPatch('', SP) ?? {}), true, "speakerPatch '' → … mit speakerId: undefined (entfernt die Kennung)");
  eq(speakerPatch('id:s-3', SP), { speakerId: 's-3', args: ['Alan'] }, 'speakerPatch id:s-3 → Kennung und Name');
  eq(speakerPatch('id:id mit leer', SP), { speakerId: 'id mit leer', args: ['Grace'] }, 'speakerPatch: Kennung mit Leerraum bleibt ganz');
  eq(speakerPatch('id:s-7', SP), null, 'speakerPatch: Kennung nicht (mehr) in der Liste → null');
  eq(speakerPatch('name:Hedy', SP), { args: ['Hedy'] }, 'speakerPatch name:Hedy → nur der Name');
  eq([speakerPatch('alt:', SP), speakerPatch('fehlt:', SP), speakerPatch('quatsch', SP)], [null, null, null], 'speakerPatch alt: / fehlt: / Unbekanntes → null');

  // speakerOptionen (8.2).
  const grund = [
    { wert: '', text: '— Speaker wählen —' },
    { wert: 'id:s-1', text: 'Ada — Moderation' },
    { wert: 'id:s-3', text: 'Alan — Panel' },
    { wert: 'id:id mit leer', text: 'Grace — Keynote' },
    { wert: 'name:Hedy', text: 'Hedy' },
  ];
  eq(speakerOptionen(abruf({ args: [''] }), SP), { optionen: grund, gewaehlt: '' }, 'speakerOptionen: neue Aktion → „— Speaker wählen —“, Speaker mit und ohne Kennung');
  eq(speakerOptionen(abruf({ speakerId: 's-3' }), SP), { optionen: grund, gewaehlt: 'id:s-3' }, 'speakerOptionen: gebundene Aktion → ihr Speaker ausgewählt');
  eq(
    speakerOptionen(abruf({ args: ['Alan'] }), SP),
    { optionen: [...grund, { wert: 'alt:', text: 'Alan · per Name (nicht gebunden)' }], gewaehlt: 'alt:' },
    'speakerOptionen: alte Aktion ohne speakerId → „per Name (nicht gebunden)“ ausgewählt, nie stillschweigend gebunden',
  );
  eq(
    speakerOptionen(abruf({ speakerId: 's-7', args: ['Grace'] }), SP),
    { optionen: [...grund, { wert: 'fehlt:', text: 'Grace · nicht in der Speaker-Liste' }], gewaehlt: 'fehlt:' },
    'speakerOptionen: speakerId nicht in der Liste → „nicht in der Speaker-Liste“ ausgewählt',
  );
  eq(speakerOptionen(abruf({ args: ['Hedy'] }), SP), { optionen: grund, gewaehlt: 'name:Hedy' }, 'speakerOptionen: Name eines Speakers ohne Kennung → er selbst ausgewählt');

  // Review Focus 3: titlerKannKennung nur bei verbundenem Titler mit recall_kennung=1.
  eq(titlerKannKennung([]), false, 'Review Focus 3: kein Titler-Link → false');
  eq(titlerKannKennung([{ role: 'titler', connected: true, state: null }]), false, 'Review Focus 3: verbunden, noch ohne STATE → false');
  eq(titlerKannKennung([{ role: 'titler', connected: false, state: { recall_kennung: '1' } }]), false, 'Review Focus 3: getrennt (mit altem STATE) → false');
  eq(titlerKannKennung([{ role: 'titler', connected: true, state: { on_air: '0', entry: 'Alan', entry_index: '3', entry_count: '4' } }]), false, 'Review Focus 3: STATE eines Titlers 0.9.0 ohne recall_kennung → false');
  eq(titlerKannKennung([{ role: 'titler', connected: true, state: { recall_kennung: '0' } }]), false, 'Review Focus 3: recall_kennung=0 → false');
  eq(titlerKannKennung([{ role: 'timer', connected: true, state: { recall_kennung: '1' } }]), false, 'Review Focus 3: andere Rolle → false');
  eq(titlerKannKennung([{ role: 'titler', connected: true, state: { recall_kennung: '1' } }]), true, 'Review Focus 3: verbunden und recall_kennung=1 → true');
  eq(
    buildActionLine('titler', 'recall', loeseSpeakerZiel(gebunden, SP, titlerKannKennung([{ role: 'titler', connected: true, state: null }]))),
    'TITLER RECALL Alan',
    'Review Focus 3: ein Titler ohne bekannte Fähigkeit bekommt die @-Form nie',
  );
}

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
process.exit(failed === 0 ? 0 : 1);
