// Altfehler Stufe 2, SD-1 (C6): Regeln der Konfigurationsdatei als reines Modul (src/shared/konfig-regeln.ts, ohne electron). Die
// Nachricht auf der Bühne (`message`) überlebt keinen Neustart mehr; was im Feld stand, bleibt als Entwurf (`nachrichtEntwurf`).
// Eine alte Datei ohne Entwurf übernimmt ihre Nachricht als Entwurf. Dazu die Wächter, dass main/config.ts beide Regeln nutzt.
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import type { StageConfig } from '@shared/types';
import { DEFAULT_CONFIG, konfigAusDatei, konfigMischen } from '@shared/konfig-regeln';
import { VORGABE_HOST } from '@shared/mdns';
import { ohneKommentare } from './testzustand';

const nachricht = (c: StageConfig): [string, string | undefined] => [c.message, c.nachrichtEntwurf];
/** Standardwerte vor dem ersten Aufruf: Lesen und Mischen dürfen sie nie ändern (geprüft am Ende des Moduls). */
const DEFAULT_VORHER = JSON.stringify(DEFAULT_CONFIG);

// ── SD-1 Konfiguration aus der Datei: nach dem Start steht nichts auf der Bühne, der letzte Text bleibt Entwurf ──
{
  gleich(nachricht(konfigAusDatei({ message: 'Bitte Plätze einnehmen' })), ['', 'Bitte Plätze einnehmen'], 'SD-1 konfigAusDatei: eine alte Datei mit Nachricht ohne Entwurf → Bühne leer, die Nachricht wird Entwurf');
  gleich(nachricht(konfigAusDatei({ message: 'Alt', nachrichtEntwurf: 'Neu' })), ['', 'Neu'], 'SD-1 konfigAusDatei: Nachricht und Entwurf in der Datei → Bühne leer, der Entwurf bleibt');
  gleich(nachricht(konfigAusDatei({})), ['', ''], 'SD-1 konfigAusDatei: leere Datei → Bühne leer, Entwurf leer');
  gleich(nachricht(konfigAusDatei({ message: 'Alt', nachrichtEntwurf: '' })), ['', ''], 'SD-1 konfigAusDatei: ein geleerter Entwurf bleibt leer, die alte Nachricht kommt nicht zurück');
}

// ── Zusammenführen beim Lesen wie bisher: Standardwerte je Gruppe, fehlende Felder fallen auf den Standard ──
{
  const c = konfigAusDatei({
    timer: { enabled: true } as StageConfig['timer'],
    presenter: { pin: '4711' } as StageConfig['presenter'],
    widgets: { message: false } as StageConfig['widgets'],
    outputDisplayId: 5,
  });
  gleich(
    [c.timer, c.switcher, c.presenter.host, c.presenter.mode, c.widgets, c.outputDisplayId],
    [
      { enabled: true, host: VORGABE_HOST, port: 7777 },
      { enabled: false, host: VORGABE_HOST, port: 8723 },
      VORGABE_HOST,
      'ref',
      { clock: true, timer: true, switcher: true, message: false, presenter: true },
      5,
    ],
    'SD-1 konfigAusDatei: Standardwerte und gespeicherte Werte je Gruppe zusammengeführt wie bisher',
  );
  ok(c.presenter.pin === '4711', 'SD-1 konfigAusDatei: die gemerkte PIN bleibt');
  gleich(
    [DEFAULT_CONFIG.timer.host, DEFAULT_CONFIG.switcher.host, DEFAULT_CONFIG.presenter.host, DEFAULT_CONFIG.message, DEFAULT_CONFIG.nachrichtEntwurf, VORGABE_HOST],
    ['127.0.0.1', '127.0.0.1', '127.0.0.1', '', '', '127.0.0.1'],
    'SD-1 DEFAULT_CONFIG: Hosts auf der Vorgabe VORGABE_HOST, Nachricht und Entwurf leer',
  );
}

// ── SD-1 Mischen: ein Entwurf lässt die Nachricht auf der Bühne stehen, Senden setzt sie, leer senden nimmt sie herunter ──
{
  const basis: StageConfig = { ...DEFAULT_CONFIG, message: 'Auf der Bühne', nachrichtEntwurf: 'Alt' };
  gleich(nachricht(konfigMischen(basis, { nachrichtEntwurf: 'X' })), ['Auf der Bühne', 'X'], 'SD-1 konfigMischen: ein neuer Entwurf lässt message stehen');
  gleich(nachricht(konfigMischen(basis, { message: 'Neu' })), ['Neu', 'Alt'], 'SD-1 konfigMischen: Senden setzt message, der Entwurf bleibt');
  gleich(nachricht(konfigMischen(basis, { message: '' })), ['', 'Alt'], 'SD-1 konfigMischen: leer senden nimmt die Nachricht von der Bühne (C6)');
  gleich(nachricht(konfigMischen(basis, { widgets: { clock: false } })), ['Auf der Bühne', 'Alt'], 'SD-1 konfigMischen: ein Patch ohne Nachricht und Entwurf lässt beide stehen');
  const m = konfigMischen(basis, { timer: { host: '10.0.0.9' }, presenter: { pin: '12' }, outputDisplayId: null });
  gleich([m.timer, m.presenter.pin, m.presenter.port, m.outputDisplayId], [{ enabled: false, host: '10.0.0.9', port: 7777 }, '12', 7330, null], 'SD-1 konfigMischen: verschachtelt gemischt wie bisher');
  konfigMischen(konfigAusDatei({}), { timer: { host: '10.0.0.9' }, switcher: { enabled: true }, nachrichtEntwurf: 'x' });
  ok(JSON.stringify(DEFAULT_CONFIG) === DEFAULT_VORHER, 'SD-1 DEFAULT_CONFIG: Lesen und Mischen ändern die Standardwerte nicht (Stand vor dem ersten Aufruf dieses Moduls)');
}

// ── Wächter: main/config.ts liest über konfigAusDatei und schreibt über konfigMischen; DEFAULT_CONFIG steht im reinen Modul ──
{
  const cfg = ohneKommentare(leseText('src/main/config.ts'));
  const lesen = cfg.slice(cfg.indexOf('export function getConfig('), cfg.indexOf('export function patchConfig('));
  const schreiben = cfg.slice(cfg.indexOf('export function patchConfig('));
  ok(
    lesen.includes('konfigAusDatei(') && schreiben.includes('konfigMischen(getConfig(), patch)') && !cfg.includes('const DEFAULT_CONFIG') && cfg.includes("from '@shared/konfig-regeln'"),
    'SD-1 Wächter: getConfig nutzt konfigAusDatei, patchConfig nutzt konfigMischen; DEFAULT_CONFIG kommt aus shared/konfig-regeln.ts',
  );
  const regeln = ohneKommentare(leseText('src/shared/konfig-regeln.ts'));
  ok(!/from ['"](?:electron|node:)/.test(regeln), 'SD-1 Wächter: shared/konfig-regeln.ts ist rein (kein electron, kein node:)');
}
