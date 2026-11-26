// Altfehler Stufe 2, Recorder A (Plan 2026-11-26, Task 6; B6): der gemeinsame Ablehnungsweg für Fernbefehle. `pruefeFernbefehl`
// (R/lib/fernbefehl.ts, rein) entscheidet vor jeder Wirkung: RE-2 `arm` und `disarm` in der Aufnahme abgelehnt, RE-2b `record on`
// (und `toggle` außerhalb einer Aufnahme) ohne Zielordner abgelehnt, RE-7b mit offenem Netzwerkordner aus der Show der eigene
// Grund; `record off` nie. Hinweis und Logzeile wörtlich wie im Plan. Ohne window und ohne Electron.
import { gleich } from '@jm/ui/testhilfe';
import type { RecorderRemoteCommand, RecorderStatus } from '@shared/types';
import * as fb from '@/lib/fernbefehl';
import { RECORDER_TEXTE } from '@/lib/oberflaeche';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';

const STATI: RecorderStatus[] = ['idle', 'armed', 'recording'];
const NETZ = '\\\\nas\\x';
const ERGEBNIS = (cmd: RecorderRemoteCommand, status: RecorderStatus, dir: string | null, netzordnerOffen: string | null = null): string =>
  JSON.stringify(fb.pruefeFernbefehl(cmd, { status, dir, netzordnerOffen }));
const OK = JSON.stringify({ ok: true });
const ab = (hinweis: string, log: string): string => JSON.stringify({ ok: false, hinweis, log });

// ── RE-2: arm und disarm in der Aufnahme abgelehnt, sonst ok ──
{
  const faelle = kreuz({ t: ['arm', 'disarm'], status: STATI, dir: ['D:\\Show', null] } as const);
  pruefeFaelle('RE-2 arm und disarm bei recording abgelehnt, bei armed und idle ok (mit und ohne Zielordner)', faelle, (f) => {
    const verb = f.t === 'arm' ? 'ARM' : 'DISARM';
    const soll =
      f.status === 'recording'
        ? ab(`Companion „${verb}“ abgelehnt: Erst die Aufnahme stoppen.`, `Fernbefehl abgelehnt: ${verb} (Aufnahme läuft)`)
        : OK;
    return vergleiche(ERGEBNIS({ t: f.t }, f.status, f.dir), soll);
  });
}

// ── RE-2b: record on und toggle ohne Zielordner abgelehnt, off nie, mit Zielordner ok ──
{
  const faelle = kreuz({ mode: ['on', 'off', 'toggle'], status: STATI, dir: ['D:\\Show', null] } as const);
  pruefeFaelle('RE-2b record on und toggle ohne dir abgelehnt (toggle nur außerhalb einer Aufnahme), off nie, mit dir ok', faelle, (f) => {
    const abgelehnt = f.dir === null && (f.mode === 'on' || (f.mode === 'toggle' && f.status !== 'recording'));
    const verb = f.mode === 'on' ? 'RECORD ON' : 'RECORD TOGGLE';
    const soll = abgelehnt ? ab(`Companion „${verb}“ abgelehnt: Kein Zielordner gewählt.`, `Fernbefehl abgelehnt: ${verb} (kein Zielordner)`) : OK;
    return vergleiche(ERGEBNIS({ t: 'record', mode: f.mode }, f.status, f.dir), soll);
  });
  gleich(
    [ERGEBNIS({ t: 'record', mode: 'off' }, 'recording', null, NETZ), ERGEBNIS({ t: 'record', mode: 'off' }, 'armed', null, NETZ), ERGEBNIS({ t: 'record', mode: 'off' }, 'idle', null)],
    [OK, OK, OK],
    'RE-2b record off wird nie abgelehnt, auch ohne Zielordner und mit offenem Netzwerkordner aus der Show',
  );
}

// ── RE-7b: mit offenem Netzwerkordner aus der Show der eigene Grund ──
{
  gleich(
    [ERGEBNIS({ t: 'record', mode: 'on' }, 'armed', null, NETZ), ERGEBNIS({ t: 'record', mode: 'toggle' }, 'armed', null, NETZ), ERGEBNIS({ t: 'record', mode: 'toggle' }, 'recording', null, NETZ)],
    [
      ab('Companion „RECORD ON“ abgelehnt: Der Netzwerkordner aus der Show ist noch nicht bestätigt.', 'Fernbefehl abgelehnt: RECORD ON (Netzwerkordner aus der Show nicht bestätigt)'),
      ab('Companion „RECORD TOGGLE“ abgelehnt: Der Netzwerkordner aus der Show ist noch nicht bestätigt.', 'Fernbefehl abgelehnt: RECORD TOGGLE (Netzwerkordner aus der Show nicht bestätigt)'),
      OK,
    ],
    'RE-7b record on mit netzordnerOffen nennt den eigenen Grund (toggle außerhalb der Aufnahme ebenso, in der Aufnahme stoppt toggle)',
  );
  gleich(
    [ERGEBNIS({ t: 'arm' }, 'recording', null, NETZ), ERGEBNIS({ t: 'arm' }, 'armed', null, NETZ)],
    [ab('Companion „ARM“ abgelehnt: Erst die Aufnahme stoppen.', 'Fernbefehl abgelehnt: ARM (Aufnahme läuft)'), OK],
    'RE-7b ein offener Netzwerkordner ändert nichts an ARM (in der Aufnahme abgelehnt, sonst ok)',
  );
}

// ── Texte: wörtlich wie im Plan, aus RECORDER_TEXTE ──
{
  gleich(
    [
      RECORDER_TEXTE.fernbefehl.abgelehnt('ARM', 'Grund.'),
      RECORDER_TEXTE.fernbefehl.grund.aufnahmeLaeuft,
      RECORDER_TEXTE.fernbefehl.grund.keinOrdner,
      RECORDER_TEXTE.fernbefehl.grund.netzordnerOffen,
      RECORDER_TEXTE.grund.aufnahmeLaeuft,
    ],
    ['Companion „ARM“ abgelehnt: Grund.', 'Erst die Aufnahme stoppen.', 'Kein Zielordner gewählt.', 'Der Netzwerkordner aus der Show ist noch nicht bestätigt.', 'Erst die Aufnahme stoppen'],
    'RE-2/RE-2b/RE-7b Texte: Hinweis „Companion „‹Verb›“ abgelehnt: ‹Grund›“, die drei Gründe und der Sperrgrund der Taste ohne Punkt',
  );
}
