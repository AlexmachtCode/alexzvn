// Selbsttest der reinen Conductor-Logik (kein Framework):
//   node --experimental-strip-types test/selftest.ts
import { buildActionLine, clampIndex, mergeEndpoints, navigate } from '../src/shared/conductor.ts';
import type { RundownDoc } from '../src/shared/types.ts';
import { LEERER_BERICHT, berichtIstLeer, ersatzSchluessel, gleicheAb } from '../src/shared/abgleich.ts';
import type { AbgleichBericht } from '../src/shared/abgleich.ts';
import type { RundownAction, RundownRow } from '../src/shared/types.ts';
import type { ShowAblaufItem } from '@jm/show';
import { migrate } from '../src/shared/doc-format.ts';

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

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
process.exit(failed === 0 ? 0 : 1);
