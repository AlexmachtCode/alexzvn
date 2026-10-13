// ─────────────────────────────────────────────────────────────────────────────
// Verbund der Tool-Seite: Anzeige V1–V15 (Master-Link Teil 2b, Release 2, Spec 16.4).
//
// Rein, ohne Electron. Dauerhafte Anzeigen lügen, wenn ein Zustand vergessen wurde (#208):
// darum prüft die Funktion den Union-Typ vollständig (`never`), und der Selbsttest prüft
// jede Zeile wörtlich. Vorrang: V12 (fehler) vor V15 (verworfen) vor allen anderen.
// ⟨S⟩ ⟨hh:mm⟩ = Showname (höchstens 40 Zeichen) und Empfangszeit auf der Uhr DIESES Rechners.
// ─────────────────────────────────────────────────────────────────────────────
import type { MasterStand, VerbundAnzeige, VerbundDaten } from './verbund-typen';

const SHOWNAME_MAX = 40;

/** Höchstens 40 Zeichen (Code Points, ein Emoji wird nie zerteilt), sonst 39 + „…“. */
export function kuerzeShowName(name: string): string {
  const zeichen = Array.from(name);
  return zeichen.length <= SHOWNAME_MAX ? name : `${zeichen.slice(0, SHOWNAME_MAX - 1).join('')}…`;
}

function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function verbundAnzeige(d: VerbundDaten, uhrzeit: (ms: number) => string = hhmm): VerbundAnzeige | null {
  if (d.art === 'einzelplatz') return null;
  if (d.art === 'datei-defekt') return { text: 'Kopplungsdatei beschädigt. Neu koppeln.', farbe: 'rot' };

  const sz = (s: MasterStand): string => `${kuerzeShowName(s.show?.name ?? '')} ${uhrzeit(s.empfangenAm)}`;
  const m = d.masterName;
  const a = d.angewendet;
  /** Zusatz L: genau dann, wenn etwas angewendet ist. */
  const L = a ? ` · letzter Stand: ${sz(a)}` : '';

  if (d.fehler !== undefined) {
    return { text: `Show vom Master nicht übernommen: ${d.fehler}${a ? ` · in Benutzung: ${sz(a)}` : ''}`, farbe: 'rot' }; // V12
  }
  if (d.verworfen) return { text: `Show-Daten von ${m} nicht lesbar (Tool-Update nötig?)${L}`, farbe: 'rot' }; // V15

  switch (d.art) {
    case 'warte':
      return { text: `Verbunden mit ${m} · Show wird geladen…${L}`, farbe: 'gelb' }; // V2
    case 'ohne-daten':
      return { text: `${m} antwortet nicht auf die Anfrage nach Show-Daten (Launcher-Update am Master nötig?)${L}`, farbe: 'gelb' }; // V3
    case 'aktuell': {
      const l = d.letzter;
      if (l.show) {
        // V4: Name und Uhrzeit des ANGEWENDETEN Stands; nur ohne angewendeten Stand dieses Masters die des empfangenen.
        const s = a && a.masterId === l.masterId ? a : l;
        return { text: `Show vom Master: ${kuerzeShowName(s.show?.name ?? '')} · Stand ${uhrzeit(s.empfangenAm)}`, farbe: 'gruen' };
      }
      const grund = l.grund ?? 'keine-show';
      switch (grund) {
        case 'keine-show':
          return a ? { text: `${m} hat keine Show offen${L}`, farbe: 'gelb' } : { text: `${m} hat keine Show offen`, farbe: 'gedaempft' }; // V5 / V6
        case 'zu-gross':
          return { text: `Show am Master zu groß für den Verbund${L}`, farbe: 'rot' }; // V7
        case 'nicht-lesbar':
          return { text: `Show am Master nicht lesbar${L}`, farbe: 'rot' }; // V8
        default: {
          const nie: never = grund;
          return nie;
        }
      }
    }
    case 'getrennt':
      if (d.client.art === 'fehler') return { text: `${d.client.text}${L}`, farbe: 'rot' }; // V11
      return a ? { text: `${m} nicht verbunden${L}`, farbe: 'gelb' } : { text: `Suche ${m}…`, farbe: 'gelb' }; // V9 / V10
    case 'frueher':
      return d.grund === 'entkoppelt'
        ? { text: `Daten vom früheren Master ${m} (nicht mehr gekoppelt)${L}`, farbe: 'gelb' } // V13
        : { text: `Kopplungsdatei beschädigt. Neu koppeln.${L}`, farbe: 'rot' }; // V13 (datei)
    default: {
      const nie: never = d;
      return nie;
    }
  }
}
