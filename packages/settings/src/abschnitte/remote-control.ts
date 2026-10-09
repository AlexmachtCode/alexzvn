// --- @jm/settings: Fernsteuerung (Spec 6.2 Absatz Fernsteuerung, Regeln 7.1–7.3, Plan E15, E16) ---
//
// In einem Tool zeigt der Abschnitt Status, Modus und Port und verweist zum Einrichten auf den
// Launcher (Rückruf `onOpenLauncher`, ohne Rückruf kein Knopf – ein Deep-Link existiert noch nicht,
// E15). Das Token erscheint nur in der Launcher-Vollform. Eine Clientzahl gibt es nur, wenn der
// Steuerserver gemessen läuft – nie „0 verbunden“ für einen Server, von dem niemand weiß, ob er läuft.
import type { SuiteControlConfig } from '@jm/control-config';
import { UNBEKANNT, zahlText } from '@jm/ui';
import { ABSCHNITT_TEXTE, fehlerStatus, hatFehler, st, STATUS_UNBEKANNT, type SectionBase, type SectionInput, type SectionStatus } from '../vertrag';

export type ControlMode = NonNullable<SuiteControlConfig['mode']>;   // 'open' | 'secure'

export interface RemoteControlLauncherProps {
  hasToken: boolean; hasTls: boolean; tlsFingerprint?: string;
  revealedToken?: string;            // nur direkt nach Erzeugen/Erneuern
  busy: boolean;
  onActivate(): void;                // „Aktivieren“ (offen → gesichert) bzw. „Erneuern“ (gesichert)
  onDeactivate(): void;              // „Deaktivieren“
  onCopyToken?(): void;              // „Token kopieren“, nur mit revealedToken
}

export interface RemoteControlSectionProps extends SectionInput {
  variante?: 'tool' | 'launcher';    // Vorgabe 'tool'
  running?: boolean;                 // gemessen; undefined = unbekannt
  mode?: ControlMode;                // undefined = unbekannt
  port?: number;
  clients?: number;                  // gemessen; zählt nur bei running === true
  portInUse?: boolean;
  restartRequired?: boolean;
  companionModule?: string;          // Name des Companion-Moduls für den Hinweis
  enabled?: boolean;                 // nur mit capabilities.enableToggle
  capabilities: { portEditable?: boolean; enableToggle?: boolean };
  onToggle?(next: boolean): void; onPortChange?(port: number): void; onOpenLauncher?(): void;
  launcher?: RemoteControlLauncherProps;   // nur variante 'launcher'; in 'tool' nie gerendert
}

export const REMOTE_TEXTE = {
  titel: 'Fernsteuerung',
  steuerung: 'Steuerserver',
  modus: 'Modus',
  port: 'Port',
  verbunden: 'Verbunden',
  modusOffen: 'offen',
  modusGesichert: 'gesichert',
  modusUnbekannt: UNBEKANNT,
  bereitVerbunden: (n: number) => `bereit · ${zahlText(n)} verbunden`,
  bereit: 'bereit',
  aus: ABSCHNITT_TEXTE.aus,
  neustartNoetig: 'Neustart nötig',
  portBelegt: 'Port belegt',
  gesichertUnvollstaendig: 'gesichert (unvollständig)',
  companion: (modul: string) =>
    `Für ein Stream Deck über Bitfocus Companion: Modul „${modul}“. Dort Host (IP dieses Rechners) und Port eintragen.`,
  imLauncherEinrichten: ABSCHNITT_TEXTE.imLauncherEinrichten,
  aktivieren: 'Aktivieren',
  erneuern: 'Erneuern',
  deaktivieren: 'Deaktivieren',
  token: 'Token',
  tokenKopieren: 'Token kopieren',
  tlsFingerabdruck: 'TLS-Fingerabdruck',
  wirktBeimStart: 'Wirkt beim nächsten Start jedes Tools.',
  einmaligSichtbar: 'Einmalig sichtbar – jetzt in Companion und Clients übernehmen:',
  tokenNurBeimErzeugen: 'Das Token wird aus Sicherheitsgründen nur beim Erzeugen oder Erneuern angezeigt.',
} as const;

export interface RemoteControlView extends SectionBase {
  variante: 'tool' | 'launcher';
  modusText: string;                 // „offen“, „gesichert“ oder „unbekannt“
  verbundenText?: string;            // Zahl, nur bei running === true und gemessener Zahl
  sichtbar: {
    steuerung: boolean; port: boolean; portFeld: boolean; verbunden: boolean; companion: boolean;
    imLauncher: boolean; aktionen: boolean; deaktivieren: boolean; token: boolean; tokenKopieren: boolean;
    fingerabdruck: boolean; tokenHinweis: boolean;
  };
}

function modusText(mode: ControlMode | undefined): string {
  return mode === 'secure' ? REMOTE_TEXTE.modusGesichert : mode === 'open' ? REMOTE_TEXTE.modusOffen : REMOTE_TEXTE.modusUnbekannt;
}

function toolStatus(p: RemoteControlSectionProps): SectionStatus {
  if (hatFehler(p)) return fehlerStatus(p.error);
  if (p.portInUse === true) return st('error', REMOTE_TEXTE.portBelegt);
  if (p.restartRequired === true) return st('warn', REMOTE_TEXTE.neustartNoetig);
  if (p.running === false) return st('off', REMOTE_TEXTE.aus);
  if (p.running === undefined) return STATUS_UNBEKANNT;
  return typeof p.clients === 'number' ? st('ok', REMOTE_TEXTE.bereitVerbunden(p.clients)) : st('ok', REMOTE_TEXTE.bereit);
}

function launcherStatus(p: RemoteControlSectionProps): SectionStatus {
  if (hatFehler(p)) return fehlerStatus(p.error);
  if (p.mode === undefined) return STATUS_UNBEKANNT;
  if (p.mode === 'secure') {
    return p.launcher?.hasToken === true && p.launcher.hasTls === true
      ? st('ok', REMOTE_TEXTE.modusGesichert)
      : st('warn', REMOTE_TEXTE.gesichertUnvollstaendig);
  }
  return st('ok', REMOTE_TEXTE.modusOffen);
}

export function remoteControlView(p: RemoteControlSectionProps): RemoteControlView {
  const variante = p.variante ?? 'tool';
  const tool = variante === 'tool';
  const l = tool ? undefined : p.launcher;
  const token = typeof l?.revealedToken === 'string' && l.revealedToken !== '';
  return {
    id: p.id,
    status: tool ? toolStatus(p) : launcherStatus(p),
    locked: p.locked,
    error: p.error,
    variante,
    modusText: modusText(p.mode),
    verbundenText: tool && p.running === true && typeof p.clients === 'number' ? zahlText(p.clients) : undefined,
    sichtbar: {
      steuerung: tool && p.capabilities.enableToggle === true,
      port: tool,
      portFeld: tool && p.capabilities.portEditable === true,
      verbunden: tool && p.running === true,
      companion: typeof p.companionModule === 'string' && p.companionModule !== '',
      imLauncher: tool && typeof p.onOpenLauncher === 'function',
      aktionen: !tool && l !== undefined,
      deaktivieren: !tool && l !== undefined && p.mode === 'secure',
      token,
      tokenKopieren: token && typeof l?.onCopyToken === 'function',
      fingerabdruck: !tool && typeof l?.tlsFingerprint === 'string' && l.tlsFingerprint !== '',
      tokenHinweis: !tool && !token && p.mode === 'secure' && l?.hasToken === true,
    },
  };
}
