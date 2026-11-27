// Gemeinsamer Ablehnungsweg für Fernbefehle (B6; Altfehler RE-2, RE-2b, RE-7b; Spec 5 „Abgelehnte Fernbefehle“). Rein: Der Store prüft
// jeden Befehl der Fernsteuerung (Companion, Rundown) vor jeder Wirkung. Eine Ablehnung ändert nichts; der Store schickt Hinweis und
// Logzeile über recorder:ablehnung an den Hauptprozess (Meldung bis „OK“, Protokoll). Companion sieht an den bestehenden Zustandswerten,
// dass sich nichts geändert hat; Protokoll und Companion-Modul bleiben unverändert. Relative Importe: der Store-Test läuft ohne Aliase.
import { FERNBEFEHL_ABGELEHNT, type RecorderRemoteCommand, type RecorderStatus } from '../../../shared/types';
import { RECORDER_TEXTE } from './oberflaeche';

export type FernbefehlErgebnis = { ok: true } | { ok: false; hinweis: string; log: string };

/** Was die Prüfung aus dem Store braucht: gemessener Status, Zielordner und ein offener Netzwerkordner aus der Show (RE-7b). */
export interface FernbefehlLage {
  status: RecorderStatus;
  dir: string | null;
  netzordnerOffen: string | null;
}

/**
 * Gründe der Logzeile (nicht sichtbar, nur im Protokoll). „Aufnahme läuft“ nennt seit Ruling R11 auch der Wächter des Hauptprozesses; der
 * Grund und der Satz der Logzeile stehen darum in shared/types.ts (FERNBEFEHL_ABGELEHNT, K4).
 */
const LOG_GRUND = {
  aufnahmeLaeuft: FERNBEFEHL_ABGELEHNT.logAufnahmeLaeuft,
  // Fix-Runde 1 (Ruling R18c, K4): derselbe Wortlaut wie der Statuseintrag „Platz“ ohne Ordner; er steht einmal in lib/platz.ts.
  keinOrdner: RECORDER_TEXTE.platz.keinOrdner,
  netzordnerOffen: 'Netzwerkordner aus der Show nicht bestätigt',
} as const;

function ablehnung(verb: string, grund: keyof typeof LOG_GRUND): FernbefehlErgebnis {
  return {
    ok: false,
    hinweis: RECORDER_TEXTE.fernbefehl.abgelehnt(verb, RECORDER_TEXTE.fernbefehl.grund[grund]),
    log: FERNBEFEHL_ABGELEHNT.log(verb, LOG_GRUND[grund]),
  };
}

/**
 * Abgelehnt werden:
 * - RE-2: `arm` und `disarm` während einer Aufnahme (beenden geht nur mit Stopp);
 * - RE-2b: `record on`, und `toggle` außerhalb einer Aufnahme, ohne Zielordner (von Hand im Fenster öffnet „Aufnahme“ weiter den
 *   Ordnerdialog, über die Fernsteuerung nie); wartet ein Netzwerkordner aus der Show auf „Übernehmen“, mit diesem Grund (RE-7b).
 * `record off` nie. Alles andere gilt wie bisher.
 */
export function pruefeFernbefehl(cmd: RecorderRemoteCommand, lage: FernbefehlLage): FernbefehlErgebnis {
  switch (cmd.t) {
    case 'arm':
    case 'disarm':
      return lage.status === 'recording' ? ablehnung(cmd.t === 'arm' ? 'ARM' : 'DISARM', 'aufnahmeLaeuft') : { ok: true };
    case 'record': {
      if (cmd.mode === 'off' || (cmd.mode === 'toggle' && lage.status === 'recording') || lage.dir) return { ok: true };
      const verb = cmd.mode === 'on' ? 'RECORD ON' : 'RECORD TOGGLE';
      return ablehnung(verb, lage.netzordnerOffen !== null ? 'netzordnerOffen' : 'keinOrdner');
    }
  }
}
