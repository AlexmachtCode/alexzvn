// Task 5 · Statuslogik (Spec 3.3, 7.2, 4.2) und feste Texte (G5): Reihenfolge, Symbole, Klassen, „unbekannt“,
// Uhrzeit, zahlText, große Schrift auf der LIVE-Fläche (E3) und die neuen Exporte aus src/index.ts.
import * as ui from '../src/index';
import {
  LIVE_EINTRAG_KLASSE,
  LIVE_FLAECHE_KLASSE,
  STATUS_GRUPPEN,
  STATUS_RAND_KLASSE,
  STATUS_SYMBOL,
  STATUS_SYMBOL_KLASSE,
  formatUhrzeit,
  formatUhrzeitKurz,
  ordneStatus,
  unbekannt,
  type StatusItem,
  type StatusState,
} from '../src/lib/status';
import { UI_TEXTE, UNBEKANNT, zahlText } from '../src/lib/texte';
import { gleich, ok } from './harness';

const ZUSTAENDE: readonly StatusState[] = ['ok', 'warn', 'error', 'off', 'live'];

// ── Reihenfolge (Spec 3.3: verbindung → ausgabe → fernsteuerung → tool, in der Gruppe Array-Reihenfolge) ──
{
  const eintrag = (id: string, group: StatusItem['group']): StatusItem => ({ id, group, label: id, state: 'ok' });
  const eingabe: StatusItem[] = [
    eintrag('t1', 'tool'),
    eintrag('a1', 'ausgabe'),
    eintrag('f1', 'fernsteuerung'),
    eintrag('v1', 'verbindung'),
    eintrag('a2', 'ausgabe'),
    eintrag('t2', 'tool'),
    eintrag('v2', 'verbindung'),
    eintrag('a3', 'ausgabe'),
  ];
  const vorher = JSON.stringify(eingabe);
  const geordnet = ordneStatus(eingabe);
  gleich(
    geordnet.map((item) => item.group),
    ['verbindung', 'verbindung', 'ausgabe', 'ausgabe', 'ausgabe', 'fernsteuerung', 'tool', 'tool'],
    'Status: Gruppenreihenfolge verbindung → ausgabe → fernsteuerung → tool',
  );
  gleich(
    geordnet.map((item) => item.id),
    ['v1', 'v2', 'a1', 'a2', 'a3', 'f1', 't1', 't2'],
    'Status: innerhalb einer Gruppe Array-Reihenfolge (stabil)',
  );
  ok(JSON.stringify(eingabe) === vorher && geordnet !== eingabe, 'Status: ordneStatus verändert die Eingabe nicht');
  gleich(ordneStatus([]), [], 'Status: leere Liste bleibt leer');
  gleich([...STATUS_GRUPPEN], ['verbindung', 'ausgabe', 'fernsteuerung', 'tool'], 'Status: STATUS_GRUPPEN in Spec-Reihenfolge');
}

// ── Symbole und Klassen (Spec 3.3, 4.2; G7: Form statt nur Farbe) ──
{
  gleich(
    ZUSTAENDE.map((z) => STATUS_SYMBOL[z]),
    ['●', '▲', '⚠', '○', '■'],
    'Status: Symbole ok ●, warn ▲, error ⚠, off ○, live ■',
  );
  ok(new Set(ZUSTAENDE.map((z) => STATUS_SYMBOL[z])).size === 5, 'Status: fünf verschiedene Symbole');
  gleich(
    { ...STATUS_SYMBOL_KLASSE },
    {
      ok: 'text-[var(--tally-ready)]',
      warn: 'text-[var(--status-warn)]',
      error: 'text-[var(--status-error)]',
      off: 'text-[var(--status-off)]',
      live: 'text-[var(--background)]',
    },
    'Status: Symbolklassen für alle fünf Zustände (live steht auf der roten Fläche in deren Schriftfarbe)',
  );
  gleich(
    { ...STATUS_RAND_KLASSE },
    {
      ok: 'border-[var(--border)]',
      warn: 'border-[var(--status-warn)]',
      error: 'border-[var(--status-error)]',
      off: 'border-[var(--border)]',
      live: 'border-[var(--tally-live)]',
    },
    'Status: Randklassen für alle fünf Zustände',
  );
  ok(
    STATUS_SYMBOL.live !== STATUS_SYMBOL.error &&
      STATUS_RAND_KLASSE.live !== STATUS_RAND_KLASSE.error &&
      LIVE_EINTRAG_KLASSE.split(' ').includes('bg-[var(--tally-live)]') &&
      !STATUS_RAND_KLASSE.error.includes('bg-'),
    'Status: live und error unterscheiden sich in Symbol und Form (live gefüllt, error nur umrandet; Spec 3.3, 4.2)',
  );
  gleich(
    LIVE_EINTRAG_KLASSE,
    'bg-[var(--tally-live)] text-[var(--background)]',
    'Status: LIVE_EINTRAG_KLASSE füllt rot, Schrift in Hintergrundfarbe (normale Schrift, Kontrast Task 4)',
  );
}

// ── Große Schrift auf der LIVE-Fläche (E3: Weiß auf Rot erreicht dunkel nur 3,90 : 1 → nur groß und fett) ──
{
  const px = /(?:^|\s)text-\[(\d+(?:\.\d+)?)px\](?:\s|$)/.exec(LIVE_FLAECHE_KLASSE);
  ok(
    px !== null &&
      Number(px[1]) >= 18.66 &&
      /(?:^|\s)font-(bold|extrabold|black)(?:\s|$)/.test(LIVE_FLAECHE_KLASSE) &&
      LIVE_FLAECHE_KLASSE.includes('bg-[var(--tally-live)]') &&
      LIVE_FLAECHE_KLASSE.includes('text-[var(--brand-fg-on-dark)]'),
    'Status: LIVE_FLAECHE_KLASSE groß und fett (≥ 18,66 px, bold), Weiß auf --tally-live',
  );
}

// ── Unbekannt ist nicht ok (Spec 7.2) ──
{
  const u = unbekannt({ id: 'master-link', group: 'verbindung', label: 'Master', settingsSection: 'master' });
  gleich(
    u,
    { id: 'master-link', group: 'verbindung', label: 'Master', settingsSection: 'master', state: 'off', detail: 'unbekannt' },
    'Status: unbekannt() → off + „unbekannt“, übrige Felder bleiben',
  );
  ok(u.state !== 'ok' && UNBEKANNT === 'unbekannt', 'Status: unbekannt() ist nie ok');
}

// ── Uhrzeit (Ortszeit, zweistellig) ──
{
  gleich(formatUhrzeit(new Date(2026, 9, 8, 9, 5, 7)), '09:05:07', 'Status: formatUhrzeit 9:05:07 → 09:05:07');
  gleich(formatUhrzeit(new Date(2026, 9, 8, 23, 59, 59)), '23:59:59', 'Status: formatUhrzeit 23:59:59 bleibt');
  gleich(
    [
      formatUhrzeitKurz(new Date(2026, 9, 8, 9, 5, 0).toISOString()),
      formatUhrzeitKurz(''),
      formatUhrzeitKurz('kaputt'),
      formatUhrzeitKurz(undefined),
    ],
    ['09:05', undefined, undefined, undefined],
    'Status: formatUhrzeitKurz ISO → hh:mm, leer, kaputt und undefined → undefined',
  );
}

// ── Texte ──
{
  gleich([zahlText(1.5), zahlText(65535), zahlText(0.1234), zahlText(-2)], ['1,5', '65535', '0,123', '-2'], 'Texte: zahlText 1.5 → 1,5 und 65535 ohne Tausenderpunkt');
  ok(new Set(ZUSTAENDE.map((z) => UI_TEXTE.zustand[z])).size === 5, 'Texte: fünf Zustandswörter verschieden');
  gleich(
    [
      UI_TEXTE.mindestens(1.5),
      UI_TEXTE.hoechstens(65535),
      UI_TEXTE.gesperrt('Show läuft'),
      UI_TEXTE.nichtVerfuegbar('USB-Mikrofon'),
      UI_TEXTE.statusOeffnen('NDI'),
      UI_TEXTE.themeUmschalten(UI_TEXTE.dunkel, UI_TEXTE.hell),
    ],
    [
      'Mindestens 1,5.',
      'Höchstens 65535.',
      'Gesperrt: Show läuft',
      'nicht verfügbar: USB-Mikrofon',
      'NDI: Einstellungen öffnen',
      'Darstellung: Dunkel. Umschalten auf Hell',
    ],
    'Texte: Funktionen setzen Werte ein (Zahlen über zahlText)',
  );
}

// ── Exporte aus src/index.ts (9.8) ──
{
  ok(
    ui.UNBEKANNT === 'unbekannt' &&
      ui.zahlText(2.5) === '2,5' &&
      ui.STATUS_SYMBOL.live === '■' &&
      typeof ui.ordneStatus === 'function' &&
      typeof ui.unbekannt === 'function' &&
      typeof ui.formatUhrzeit === 'function' &&
      typeof ui.formatUhrzeitKurz === 'function',
    'Status: Exporte aus src/index.ts (UNBEKANNT, zahlText, STATUS_SYMBOL, ordneStatus, unbekannt, Uhrzeit)',
  );
}
