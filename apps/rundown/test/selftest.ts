// Selbsttest der reinen Conductor-Logik (kein Framework):
//   node --experimental-strip-types test/selftest.ts
import { buildActionLine, clampIndex, mergeEndpoints, navigate } from '../src/shared/conductor.ts';
import type { RundownDoc } from '../src/shared/types.ts';
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

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
process.exit(failed === 0 ? 0 : 1);
