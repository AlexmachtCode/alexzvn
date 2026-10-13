// ─────────────────────────────────────────────────────────────────────────────
// Verbund der Tool-Seite: Typen (Master-Link Teil 2b, Release 2, Spec 16.2).
//
// Nur Typen, kein Laufzeitcode. `VerbundDaten` heißt hier wie in Spec 16.2; @jm/master-link
// exportiert einen gleichnamigen ANDEREN Typ (speicher.ts, Teilnehmerliste des Masters).
// Deshalb importiert app-runtime aus @jm/master-link nur einzeln benannte Typen und
// re-exportiert das Paket nie als Ganzes (E27).
// ─────────────────────────────────────────────────────────────────────────────
import type { Show } from '@jm/show';
import type { ClientZustand, DatenGrund } from '@jm/master-link';

/** Ein Stand vom Master, wie das Tool ihn empfangen bzw. angewendet hat (Spec 16.2). */
export interface MasterStand {
  masterId: string;
  masterName: string;
  epoche: string;
  folge: number;
  schluessel: string | null;
  show: Show | null; // nach migrateShow
  grund?: DatenGrund; // 'keine-show' | 'zu-gross' | 'nicht-lesbar', genau dann, wenn show null ist
  mitDokument: string[]; // appIds mit Dokument am Master (13.1)
  empfangenAm: number; // ms, Uhr dieses Rechners (16.4, G13)
}

interface MitStand {
  masterName: string;
  angewendet: MasterStand | null; // zuletzt angewendeter Stand (auch aus dem Zwischenspeicher)
  fehler?: string; // Grund, wenn anwenden zuletzt geworfen hat
  verworfen?: { grund: string; seit: number }; // letzter eingehender Stand ungültig (13.2)
}

export type VerbundDaten =
  | { art: 'einzelplatz' }
  | ({ art: 'warte' } & MitStand) // verbunden, Abo gesendet, noch keine Antwort (≤ 5 s)
  | ({ art: 'ohne-daten' } & MitStand) // verbunden, 5 s ohne Antwort; Abo alle 30 s erneut (13.3)
  | ({ art: 'aktuell'; letzter: MasterStand } & MitStand)
  | ({ art: 'getrennt'; client: ClientZustand } & MitStand)
  | ({ art: 'frueher'; grund: 'entkoppelt' | 'datei' } & MitStand) // Ende des Verbundmodus, Daten stehen noch (16.1)
  | { art: 'datei-defekt' }; // Datei beschädigt, keine Master-Daten im Tool

export interface VerbundKopplung {
  rolle: 'aus' | 'master' | 'slave';
  masterId: string | null;
  masterName: string | null;
  masterAdresse: string | null; // Adresse der laufenden Verbindung, sonst null
  adressen: string[]; // aus dem letzten `angemeldet` (13.7)
  letzteAdresse: string | null; // vom Client: Adresse der letzten Verbindung, sonst aus master-link.json (E6)
}

/** Eine Zeile der Anzeige V2–V15 (16.4); `null` = keine Anzeige (V1). */
export interface VerbundAnzeige {
  text: string;
  farbe: 'gruen' | 'gelb' | 'rot' | 'gedaempft';
}

/** Was ein Tool an `folgeMasterShow` übergibt (16.2). */
export interface FolgeHandler {
  /** Nur mit show !== null. Wirft = nicht angewendet. */
  anwenden(stand: MasterStand & { show: Show }, neueShow: boolean): void;
  beiWechsel?(d: VerbundDaten): void;
}
