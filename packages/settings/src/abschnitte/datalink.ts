// --- @jm/settings: DataLink (Spec 6.2, Regeln 7.1–7.3) ---
//
// Status aus gemessenen Werten: Ordner fehlt, Dateizahl, letzte Änderung. Eine unbekannte Dateizahl
// ist „unbekannt“, nie „0 Dateien“. Quellzeile und Hinweis (Titler Q1–Q3, H1–H7) sind fertige Texte
// der App und werden nur angezeigt; Titel, Feldnamen und Statustexte liegen hier.
import { formatUhrzeitKurz, zahlText } from '@jm/ui';
import { ABSCHNITT_TEXTE, fehlerStatus, hatFehler, istGesperrt, st, STATUS_UNBEKANNT, type SectionBase, type SectionInput, type SectionStatus } from '../vertrag';

export interface DataLinkSectionProps extends SectionInput {
  folder: string;                    // '' = keiner
  folderMissing?: boolean;           // gemessen
  fileCount?: number;                // gemessen; undefined = unbekannt
  lastChange?: string;               // ISO
  sourceLine?: string;               // fertiger Text der App (Titler Q1–Q3), nur angezeigt
  notice?: string;                   // fertiger Hinweis der App (Titler H1–H7), nur angezeigt
  backLabel?: string; onBack?(): void;   // Titler K1; Knopf nur mit beidem
  onPickFolder?(): void;
  // Erweiterung für den Titler (UX-Pilot C6, E10, OF4), additiv: ohne diese Props gilt alles wie bisher.
  externeQuelle?: boolean;           // gemessen: Daten kommen nicht aus dem eigenen Ordner → nicht „kein Ordner“
  eintraege?: number;                // gemessen: abrufbare Einträge; gesetzt → „{n} Einträge“ statt Dateizahl
  onClearFolder?(): void;            // Knopf „Ordner entfernen“ (nur mit Ordner; gesperrt wie „Ordner wählen …“)
  capabilities?: { ordnerText?: boolean };
  onFolderText?(pfad: string): void; // Pfadfeld (Text-Entwurf, Übernahme bei Enter/Verlassen), nur mit ordnerText
}

const EINE_DATEI = '1 Datei';

export const DATALINK_TEXTE = {
  titel: 'DataLink',
  ordner: 'Ordner',
  status: 'Status',
  ordnerWaehlen: 'Ordner wählen …',
  eineDatei: EINE_DATEI,
  dateien: (n: number, hhmm?: string) => `${n === 1 ? EINE_DATEI : `${zahlText(n)} Dateien`}${hhmm ? ` · ${hhmm}` : ''}`,
  ordnerFehlt: 'Ordner fehlt',
  keinOrdner: 'kein Ordner',
  keineDatei: 'keine Datei',
  gesperrtVomMaster: ABSCHNITT_TEXTE.gesperrtVomMaster,
  // UX-Pilot C6 (T8)
  eintrag: '1 Eintrag',
  eintraege: (n: number) => `${zahlText(n)} Einträge`,
  keineEintraege: 'keine Einträge',
  ordnerpfad: 'Ordnerpfad',
  ordnerEntfernen: 'Ordner entfernen',
} as const;

export interface DataLinkView extends SectionBase {
  sichtbar: { ordnerWaehlen: boolean; status: boolean; zurueck: boolean; ordnerEntfernen: boolean; ordnerFeld: boolean };
  ordnerText: string;                // Pfad oder „kein Ordner“
}

function dataLinkStatus(p: DataLinkSectionProps): SectionStatus {
  if (hatFehler(p)) return fehlerStatus(p.error);
  if (p.folderMissing === true) return st('error', DATALINK_TEXTE.ordnerFehlt);
  // Daten aus fremder Quelle (Titler: Show, Master, frühere Show) brauchen keinen eigenen Ordner (E10).
  if (p.folder === '' && p.externeQuelle !== true) return st('off', DATALINK_TEXTE.keinOrdner);
  // Gemessene Einträge gehen vor der Dateizahl; 0 ist eine Messung („keine Einträge“), nie ok.
  if (p.eintraege !== undefined) {
    if (p.eintraege === 0) return st('warn', DATALINK_TEXTE.keineEintraege);
    return st('ok', p.eintraege === 1 ? DATALINK_TEXTE.eintrag : DATALINK_TEXTE.eintraege(p.eintraege));
  }
  if (p.fileCount === undefined) return STATUS_UNBEKANNT;
  if (p.fileCount === 0) return st('warn', DATALINK_TEXTE.keineDatei);
  return st('ok', DATALINK_TEXTE.dateien(p.fileCount, formatUhrzeitKurz(p.lastChange)));
}

export function dataLinkView(p: DataLinkSectionProps): DataLinkView {
  const text = (t: string | undefined): boolean => typeof t === 'string' && t !== '';
  return {
    id: p.id,
    status: dataLinkStatus(p),
    locked: p.locked,
    error: p.error,
    sichtbar: {
      ordnerWaehlen: typeof p.onPickFolder === 'function',
      status: text(p.sourceLine) || text(p.notice),
      zurueck: text(p.backLabel) && typeof p.onBack === 'function',
      ordnerEntfernen: p.folder !== '' && typeof p.onClearFolder === 'function',
      ordnerFeld: p.capabilities?.ordnerText === true && typeof p.onFolderText === 'function',
    },
    ordnerText: p.folder === '' ? DATALINK_TEXTE.keinOrdner : p.folder,
  };
}

/**
 * „Ordner entfernen“ (Muster peerSetzen): meldet onClearFolder nur mit Ordner und ohne Sperre. Rückgabe: gemeldet?
 * Der Knopf ruft genau diese Funktion; der Test prüft die Wirkung ohne DOM.
 */
export function ordnerEntfernen(p: DataLinkSectionProps): boolean {
  if (istGesperrt(p) || p.folder === '' || typeof p.onClearFolder !== 'function') return false;
  p.onClearFolder();
  return true;
}
