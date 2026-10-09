// --- @jm/settings: DataLink (Spec 6.2, Regeln 7.1–7.3) ---
//
// Status aus gemessenen Werten: Ordner fehlt, Dateizahl, letzte Änderung. Eine unbekannte Dateizahl
// ist „unbekannt“, nie „0 Dateien“. Quellzeile und Hinweis (Titler Q1–Q3, H1–H7) sind fertige Texte
// der App und werden nur angezeigt; Titel, Feldnamen und Statustexte liegen hier.
import { formatUhrzeitKurz, zahlText } from '@jm/ui';
import { ABSCHNITT_TEXTE, fehlerStatus, hatFehler, st, STATUS_UNBEKANNT, type SectionBase, type SectionInput, type SectionStatus } from '../vertrag';

export interface DataLinkSectionProps extends SectionInput {
  folder: string;                    // '' = keiner
  folderMissing?: boolean;           // gemessen
  fileCount?: number;                // gemessen; undefined = unbekannt
  lastChange?: string;               // ISO
  sourceLine?: string;               // fertiger Text der App (Titler Q1–Q3), nur angezeigt
  notice?: string;                   // fertiger Hinweis der App (Titler H1–H7), nur angezeigt
  backLabel?: string; onBack?(): void;   // Titler K1; Knopf nur mit beidem
  onPickFolder?(): void;
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
} as const;

export interface DataLinkView extends SectionBase {
  sichtbar: { ordnerWaehlen: boolean; status: boolean; zurueck: boolean };
  ordnerText: string;                // Pfad oder „kein Ordner“
}

function dataLinkStatus(p: DataLinkSectionProps): SectionStatus {
  if (hatFehler(p)) return fehlerStatus(p.error);
  if (p.folderMissing === true) return st('error', DATALINK_TEXTE.ordnerFehlt);
  if (p.folder === '') return st('off', DATALINK_TEXTE.keinOrdner);
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
    },
    ordnerText: p.folder === '' ? DATALINK_TEXTE.keinOrdner : p.folder,
  };
}
