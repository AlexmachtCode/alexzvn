// --- @jm/settings: NDI-Ausgabe (Spec 6.2, Regeln 7.1–7.3) ---
//
// Angezeigt wird nur Gemessenes: `sending` und `receivers` kommen aus dem Hauptprozess. Kennt das
// Tool nur seine Einstellung (Titler, Caption heute), steht „an (ohne Rückmeldung)“ (Plan E2: warn).
// Eine unbekannte Empfängerzahl erscheint nie als 0.
import { zahlText, type SelectOption } from '@jm/ui';
import { ABSCHNITT_TEXTE, fehlerStatus, hatFehler, st, type SectionBase, type SectionInput, type SectionStatus } from '../vertrag';

export interface NdiOutputSectionProps extends SectionInput {
  enabled: boolean;                  // Einstellung „Ausgabe an“
  sending?: boolean;                 // gemessen; undefined = keine Rückmeldung
  starting?: boolean;                // gemessen
  sourceName: string;                // '' = leer
  networkName?: string;              // fertiger Name im Netz, nur wenn die App ihn kennt
  receivers?: number;                // gemessen; undefined = unbekannt (nie als 0)
  resolution?: string; resolutionOptions?: SelectOption[];
  fps?: string; fpsOptions?: SelectOption[];
  transparency?: boolean;
  capabilities: { toggle?: boolean; rename?: boolean; resolution?: boolean; fps?: boolean; transparency?: boolean };
  onToggle?(next: boolean): void; onRename?(name: string): void; onResolution?(v: string): void;
  onFps?(v: string): void; onTransparency?(next: boolean): void;
}

export const NDI_TEXTE = {
  titel: 'NDI-Ausgabe',
  ausgabe: 'Ausgabe',
  quellenname: 'Quellenname',
  aufloesung: 'Auflösung',
  bildrate: 'Bildrate',
  transparenz: 'Transparenz',
  imNetz: (name: string) => `Im Netz: ${name}`,
  keinName: 'Kein Quellenname eingetragen.',
  sendet: 'sendet',
  aus: ABSCHNITT_TEXTE.aus,
  startet: 'startet',
  anOhneRueckmeldung: ABSCHNITT_TEXTE.anOhneRueckmeldung,
  anSendetNicht: 'an, sendet aber nicht',
  ausSendetNoch: 'aus, sendet aber noch',
  empfaenger: (n: number) => `${zahlText(n)} Empfänger`,
} as const;

export interface NdiOutputView extends SectionBase {
  sichtbar: { ausgabe: boolean; umbenennen: boolean; aufloesung: boolean; bildrate: boolean; transparenz: boolean };
  empfaenger?: string;               // „{n} Empfänger“, nur wenn receivers gemessen ist
  hinweis?: string;                  // „Kein Quellenname eingetragen.“ bzw. „Im Netz: {name}“
}

function ndiStatus(p: NdiOutputSectionProps): SectionStatus {
  if (hatFehler(p)) return fehlerStatus(p.error);
  if (p.starting === true) return st('warn', NDI_TEXTE.startet);
  if (p.enabled) {
    if (p.sending === true) return st('ok', NDI_TEXTE.sendet);
    if (p.sending === false) return st('error', NDI_TEXTE.anSendetNicht);
    return st('warn', NDI_TEXTE.anOhneRueckmeldung);
  }
  if (p.sending === true) return st('warn', NDI_TEXTE.ausSendetNoch);
  return st('off', NDI_TEXTE.aus);
}

export function ndiOutputView(p: NdiOutputSectionProps): NdiOutputView {
  const c = p.capabilities;
  const name = p.sourceName.trim();
  return {
    id: p.id,
    status: ndiStatus(p),
    locked: p.locked,
    error: p.error,
    sichtbar: {
      ausgabe: c.toggle === true,
      umbenennen: c.rename === true,
      aufloesung: c.resolution === true,
      bildrate: c.fps === true,
      transparenz: c.transparency === true,
    },
    empfaenger: typeof p.receivers === 'number' ? NDI_TEXTE.empfaenger(p.receivers) : undefined,
    hinweis: name === '' ? NDI_TEXTE.keinName : p.networkName ? NDI_TEXTE.imNetz(p.networkName) : undefined,
  };
}
