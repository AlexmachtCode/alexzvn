// Galerie: jeder Einstellungs-Abschnitt aus @jm/settings in seinen Zuständen (Spec 3.10, 6.2): ok, Warnung, Fehler,
// aus bzw. unbekannt, gesperrt und mit Fehlertext; die Fernsteuerung zusätzlich als Launcher-Vollform.
// Die Abschnitte zeigen feste Zustände, ihre Rückrufe tun nichts. @jm/settings wird relativ importiert (E20): eine
// Paket-Abhängigkeit ui → settings gäbe einen Kreis, denn settings hängt von ui ab.
// Regel wie in beispiele-ui.tsx: keine Pflichtklasse der Bausteine im Text, Maße als `style`.
import type { CSSProperties, ReactElement } from 'react';
import {
  ABSCHNITT_TEXTE,
  AUDIO_TEXTE,
  AudioDeviceSection,
  DataLinkSection,
  IveoSection,
  NdiOutputSection,
  PeersSection,
  RemoteControlSection,
  ScreenOutputSection,
  type AudioChoice,
  type AudioDeviceOption,
  type AudioDeviceSectionProps,
  type DataLinkSectionProps,
  type IveoSectionProps,
  type NdiOutputSectionProps,
  type PeerRow,
  type PeersSectionProps,
  type RemoteControlLauncherProps,
  type RemoteControlSectionProps,
  type ScreenOption,
  type ScreenOutputSectionProps,
} from '../../settings/src/index';
import type { Beispiel, Modus } from './beispiele-ui';

const nichts = (): void => undefined;
const MASTER = ABSCHNITT_TEXTE.gesperrtVomMaster;
/** So breit und so hinterlegt wie im Einstellungs-Panel. */
const PANEL: CSSProperties = { width: 'var(--panel-w)', background: 'var(--surface-raised)', padding: 16, borderRadius: 'var(--radius-lg)' };

// ── NDI-Ausgabe ──
const AUFLOESUNGEN = [
  { value: '1920x1080', label: '1920 × 1080' },
  { value: '1280x720', label: '1280 × 720' },
];
const BILDRATEN = [
  { value: '50', label: '50 fps' },
  { value: '25', label: '25 fps' },
];
function ndi(id: string, extra: Partial<NdiOutputSectionProps>): NdiOutputSectionProps {
  return {
    id,
    enabled: true,
    sending: true,
    sourceName: 'JM Titler',
    networkName: 'REGIE-PC (JM Titler)',
    receivers: 2,
    resolution: '1920x1080',
    resolutionOptions: AUFLOESUNGEN,
    fps: '50',
    fpsOptions: BILDRATEN,
    transparency: true,
    capabilities: { toggle: true, rename: true, resolution: true, fps: true, transparency: true },
    onToggle: nichts,
    onRename: nichts,
    onResolution: nichts,
    onFps: nichts,
    onTransparency: nichts,
    ...extra,
  };
}

// ── Ausgabe auf Bildschirm ──
const BILDSCHIRME: ScreenOption[] = [
  { id: 1, label: 'Bildschirm 1 (2560 × 1440)', primary: true },
  { id: 2, label: 'Bildschirm 2 (1920 × 1080)', primary: false },
];
function bildschirm(id: string, extra: Partial<ScreenOutputSectionProps>): ScreenOutputSectionProps {
  return {
    id,
    enabled: true,
    windowOpen: true,
    screens: BILDSCHIRME,
    selectedId: 2,
    fullscreen: true,
    background: '#00b140',
    capabilities: { toggle: true, fullscreen: true, background: true },
    onToggle: nichts,
    onSelect: nichts,
    onFullscreen: nichts,
    onBackground: nichts,
    ...extra,
  };
}

// ── Fernsteuerung ──
function fernsteuerung(id: string, extra: Partial<RemoteControlSectionProps>): RemoteControlSectionProps {
  return {
    id,
    variante: 'tool',
    running: true,
    mode: 'secure',
    port: 8731,
    clients: 2,
    companionModule: 'jm-suite',
    capabilities: {},
    onOpenLauncher: nichts,
    ...extra,
  };
}
function launcher(extra: Partial<RemoteControlLauncherProps>): RemoteControlLauncherProps {
  // Beispielwerte ohne Geheimnis: Nullen statt eines echten Tokens oder Fingerabdrucks.
  return {
    hasToken: true,
    hasTls: true,
    tlsFingerprint: '00:00:00:00:00:00:00:00',
    busy: false,
    onActivate: nichts,
    onDeactivate: nichts,
    onCopyToken: nichts,
    ...extra,
  };
}
function fernsteuerungLauncher(id: string, extra: Partial<RemoteControlSectionProps>): RemoteControlSectionProps {
  return { id, variante: 'launcher', mode: 'secure', capabilities: {}, launcher: launcher({}), ...extra };
}

// ── Audiogerät ──
const EINGAENGE: AudioDeviceOption[] = [
  { id: 'mic-1', label: 'Focusrite USB (Eingang 1/2)' },
  { id: 'mic-2', label: 'Dante Virtual Soundcard' },
];
const AUSGAENGE: AudioDeviceOption[] = [
  { id: 'out-1', label: 'Lautsprecher (Realtek)' },
  { id: 'out-2', label: 'CABLE Input (VB-Audio)' },
];
function wahl(extra: Partial<AudioChoice>): AudioChoice {
  return {
    key: 'eingang',
    label: 'Eingang',
    direction: 'input',
    devices: EINGAENGE,
    value: 'mic-1',
    defaultLabel: 'System-Standard',
    onChange: nichts,
    ...extra,
  };
}
function audio(id: string, extra: Partial<AudioDeviceSectionProps>): AudioDeviceSectionProps {
  return { id, choices: [wahl({})], capabilities: { refresh: true }, onRefresh: nichts, ...extra };
}

// ── iveo ──
function iveo(id: string, extra: Partial<IveoSectionProps>): IveoSectionProps {
  return {
    id,
    bound: true,
    eventName: 'Fachtagung 2026',
    stage: 'Saal 1',
    speakerCount: 24,
    delivery: 'ok',
    onOpenLauncher: nichts,
    ...extra,
  };
}

// ── DataLink ──
function datalink(id: string, extra: Partial<DataLinkSectionProps>): DataLinkSectionProps {
  return {
    id,
    folder: 'D:\\Shows\\Fachtagung\\daten',
    fileCount: 5,
    lastChange: '2026-10-08T09:41:00',
    onPickFolder: nichts,
    ...extra,
  };
}

// ── Gegenstellen ──
const GEGENSTELLEN: PeerRow[] = [
  { role: 'qa', label: 'JM Q&A', host: '', port: 8733, defaultPort: 8733, connected: true, source: 'mdns' },
  { role: 'battle', label: 'JM Battle', host: '', port: 8734, defaultPort: 8734, connected: true, source: 'mdns' },
];
function gegenstellen(id: string, extra: Partial<PeersSectionProps>): PeersSectionProps {
  return {
    id,
    peers: GEGENSTELLEN,
    capabilities: { auto: true },
    onSet: nichts,
    onAuto: nichts,
    onToggle: nichts,
    ...extra,
  };
}

/** Abschnitte für die Rahmen-Seite (eine Seite, deshalb feste ids). */
export const SHELL_ABSCHNITTE = {
  ndi: ndi('ndi', {}),
  fernsteuerung: fernsteuerung('fernsteuerung', { clients: 1, capabilities: { portEditable: true }, onPortChange: nichts }),
  iveo: iveo('iveo', { delivery: 'veraltet', staleSince: '2026-10-08T09:12:00' }),
  datalink: datalink('datalink', {}),
};

export function settingsBeispiele(modus: Modus): Beispiel[] {
  // ids je Spalte verschieden: der Anker heißt einstellung-<id>, und eine id darf es nur einmal geben.
  const id = (name: string): string => `${modus}-${name}`;
  const b = (name: string, gruppe: string, titel: string, inhalt: ReactElement): Beispiel => ({
    name,
    gruppe,
    titel,
    element: <div style={PANEL}>{inhalt}</div>,
  });
  const N = 'NDI-Ausgabe';
  const S = 'Ausgabe auf Bildschirm';
  const R = 'Fernsteuerung';
  const A = 'Audiogerät';
  const I = 'iveo';
  const D = 'DataLink';
  const G = 'Gegenstellen';
  return [
    b('ndi-ok', N, 'ok: sendet, 2 Empfänger', <NdiOutputSection {...ndi(id('ndi-ok'), {})} />),
    b('ndi-warn', N, 'Warnung: an, ohne Rückmeldung (Empfänger unbekannt)', <NdiOutputSection {...ndi(id('ndi-warn'), { sending: undefined, receivers: undefined })} />),
    b('ndi-startet', N, 'Warnung: startet', <NdiOutputSection {...ndi(id('ndi-startet'), { starting: true, sending: undefined, receivers: undefined })} />),
    b('ndi-error', N, 'Fehler: an, sendet aber nicht', <NdiOutputSection {...ndi(id('ndi-error'), { sending: false, receivers: undefined })} />),
    b('ndi-aus', N, 'aus', <NdiOutputSection {...ndi(id('ndi-aus'), { enabled: false, sending: false, receivers: undefined })} />),
    b('ndi-ohne-name', N, 'aus, ohne Quellenname (nur Schalter und Name, wie im Titler)', <NdiOutputSection {...ndi(id('ndi-ohne-name'), { enabled: false, sending: false, sourceName: '', networkName: undefined, receivers: undefined, capabilities: { toggle: true, rename: true } })} />),
    b('ndi-gesperrt', N, 'gesperrt', <NdiOutputSection {...ndi(id('ndi-gesperrt'), { locked: MASTER })} />),
    b('ndi-fehlertext', N, 'mit Fehlertext', <NdiOutputSection {...ndi(id('ndi-fehlertext'), { sending: false, receivers: undefined, error: 'NDI-Laufzeit nicht gefunden.' })} />),

    b('bildschirm-ok', S, 'ok: auf Bildschirm 2', <ScreenOutputSection {...bildschirm(id('bildschirm-ok'), {})} />),
    b('bildschirm-warn', S, 'Warnung: an, ohne Rückmeldung', <ScreenOutputSection {...bildschirm(id('bildschirm-warn'), { windowOpen: undefined })} />),
    b('bildschirm-error', S, 'Fehler: gewählter Bildschirm fehlt (bleibt gewählt)', <ScreenOutputSection {...bildschirm(id('bildschirm-error'), { selectedId: 3 })} />),
    b('bildschirm-unbekannt', S, 'unbekannt: Liste noch nicht geladen', <ScreenOutputSection {...bildschirm(id('bildschirm-unbekannt'), { screens: undefined })} />),
    b('bildschirm-aus', S, 'aus', <ScreenOutputSection {...bildschirm(id('bildschirm-aus'), { enabled: false, windowOpen: false })} />),
    b('bildschirm-keiner', S, 'aus, kein Bildschirm gefunden', <ScreenOutputSection {...bildschirm(id('bildschirm-keiner'), { enabled: false, windowOpen: false, screens: [], selectedId: null })} />),
    b('bildschirm-gesperrt', S, 'gesperrt', <ScreenOutputSection {...bildschirm(id('bildschirm-gesperrt'), { locked: MASTER })} />),
    b('bildschirm-fehlertext', S, 'mit Fehlertext', <ScreenOutputSection {...bildschirm(id('bildschirm-fehlertext'), { windowOpen: false, error: 'Ausgabefenster ließ sich nicht öffnen.' })} />),

    b('fernsteuerung-ok', R, 'ok: bereit, 2 verbunden', <RemoteControlSection {...fernsteuerung(id('fernsteuerung-ok'), {})} />),
    b('fernsteuerung-warn', R, 'Warnung: Neustart nötig', <RemoteControlSection {...fernsteuerung(id('fernsteuerung-warn'), { restartRequired: true })} />),
    b('fernsteuerung-error', R, 'Fehler: Port belegt', <RemoteControlSection {...fernsteuerung(id('fernsteuerung-error'), { portInUse: true })} />),
    b('fernsteuerung-unbekannt', R, 'unbekannt: läuft der Server? (keine „0 verbunden“)', <RemoteControlSection {...fernsteuerung(id('fernsteuerung-unbekannt'), { running: undefined, clients: 0 })} />),
    b('fernsteuerung-aus', R, 'aus', <RemoteControlSection {...fernsteuerung(id('fernsteuerung-aus'), { running: false, clients: undefined })} />),
    b('fernsteuerung-gesperrt', R, 'gesperrt, Port änderbar', <RemoteControlSection {...fernsteuerung(id('fernsteuerung-gesperrt'), { locked: MASTER, capabilities: { portEditable: true }, onPortChange: nichts })} />),
    b('fernsteuerung-fehlertext', R, 'mit Fehlertext', <RemoteControlSection {...fernsteuerung(id('fernsteuerung-fehlertext'), { running: false, clients: undefined, error: 'Steuerserver nicht gestartet.' })} />),
    b('fernsteuerung-launcher-gesichert', R, 'Launcher: gesichert, Token gerade erzeugt', <RemoteControlSection {...fernsteuerungLauncher(id('fernsteuerung-launcher-gesichert'), { launcher: launcher({ revealedToken: '0000-0000-0000-0000' }) })} />),
    b('fernsteuerung-launcher-unvollstaendig', R, 'Launcher: gesichert, aber ohne Token', <RemoteControlSection {...fernsteuerungLauncher(id('fernsteuerung-launcher-unvollstaendig'), { launcher: launcher({ hasToken: false }) })} />),
    b('fernsteuerung-launcher-offen', R, 'Launcher: offen', <RemoteControlSection {...fernsteuerungLauncher(id('fernsteuerung-launcher-offen'), { mode: 'open', launcher: launcher({ hasToken: false, hasTls: false, tlsFingerprint: undefined }) })} />),
    b('fernsteuerung-launcher-unbekannt', R, 'Launcher: Modus unbekannt', <RemoteControlSection {...fernsteuerungLauncher(id('fernsteuerung-launcher-unbekannt'), { mode: undefined, launcher: launcher({ busy: true }) })} />),

    b('audio-ok', A, 'ok: ein Eingang', <AudioDeviceSection {...audio(id('audio-ok'), {})} />),
    b('audio-warn', A, 'Warnung: Pflichtwahl leer', <AudioDeviceSection {...audio(id('audio-warn'), { choices: [wahl({ value: '', required: true, defaultLabel: undefined })] })} />),
    b('audio-error', A, 'Fehler: Gerät verschwunden (bleibt gewählt)', <AudioDeviceSection {...audio(id('audio-error'), { choices: [wahl({ value: 'mic-9', lastLabel: 'Shure MV7' })] })} />),
    b('audio-unbekannt', A, 'unbekannt: Geräteliste noch nicht geladen', <AudioDeviceSection {...audio(id('audio-unbekannt'), { choices: [wahl({ devices: undefined })] })} />),
    b(
      'audio-drei-wahlen',
      A,
      'Interpreter-Muster: drei Wahlen, jede mit Pegel (auch der Ausgang), eine fehlt',
      <AudioDeviceSection
        {...audio(id('audio-drei-wahlen'), {
          capabilities: { level: true, refresh: true },
          choices: [
            wahl({ key: 'floor', label: 'Floor', levelDb: -18, changeWarning: AUDIO_TEXTE.wechselStoppt }),
            wahl({ key: 'dolmetscher', label: 'Dolmetscher', value: 'mic-7', lastLabel: 'Sennheiser e835', levelDb: -Infinity }),
            wahl({ key: 'ausgabe', label: 'Ausgabe', direction: 'output', devices: AUSGAENGE, value: 'out-2', levelDb: -12 }),
          ],
        })}
      />,
    ),
    b('audio-leer', A, 'aus: keine Geräte gefunden (auch kein Systemstandard)', <AudioDeviceSection {...audio(id('audio-leer'), { choices: [wahl({ devices: [], value: '' })] })} />),
    b('audio-gesperrt', A, 'Wahl gesperrt, solange der Eingang offen ist', <AudioDeviceSection {...audio(id('audio-gesperrt'), { locked: AUDIO_TEXTE.sperreEingangOffen, choices: [wahl({ lockedReason: AUDIO_TEXTE.sperreEingangOffen })] })} />),
    b('audio-fehlertext', A, 'mit Fehlertext', <AudioDeviceSection {...audio(id('audio-fehlertext'), { error: 'Audiogerät ließ sich nicht öffnen.' })} />),

    b('iveo-ok', I, 'ok: verbunden', <IveoSection {...iveo(id('iveo-ok'), {})} />),
    b('iveo-warn', I, 'Warnung: Liste aus früherem Stand', <IveoSection {...iveo(id('iveo-warn'), { delivery: 'veraltet', staleSince: '2026-10-08T09:12:00' })} />),
    b('iveo-aus', I, 'aus: nicht eingerichtet', <IveoSection {...iveo(id('iveo-aus'), { bound: false, eventName: undefined, stage: undefined, speakerCount: undefined, delivery: undefined })} />),
    b('iveo-unbekannt', I, 'unbekannt: keine Rückmeldung', <IveoSection {...iveo(id('iveo-unbekannt'), { delivery: undefined })} />),
    b('iveo-gesperrt', I, 'gesperrt', <IveoSection {...iveo(id('iveo-gesperrt'), { locked: MASTER })} />),
    b('iveo-fehlertext', I, 'mit Fehlertext', <IveoSection {...iveo(id('iveo-fehlertext'), { error: 'Show-Datei nicht lesbar.' })} />),

    b('datalink-ok', D, 'ok: 5 Dateien', <DataLinkSection {...datalink(id('datalink-ok'), {})} />),
    b('datalink-warn', D, 'Warnung: keine Datei', <DataLinkSection {...datalink(id('datalink-warn'), { fileCount: 0, lastChange: undefined })} />),
    b('datalink-error', D, 'Fehler: Ordner fehlt', <DataLinkSection {...datalink(id('datalink-error'), { folderMissing: true, fileCount: undefined, lastChange: undefined })} />),
    b('datalink-unbekannt', D, 'unbekannt: Ordner noch nicht gelesen', <DataLinkSection {...datalink(id('datalink-unbekannt'), { fileCount: undefined, lastChange: undefined })} />),
    b('datalink-aus', D, 'aus: kein Ordner', <DataLinkSection {...datalink(id('datalink-aus'), { folder: '', fileCount: undefined, lastChange: undefined })} />),
    b(
      'datalink-gesperrt',
      D,
      'gesperrt: Show vom Master (Titler-Muster mit Quellzeile, Hinweis, Zurück)',
      <DataLinkSection
        {...datalink(id('datalink-gesperrt'), {
          locked: MASTER,
          sourceLine: 'Quelle: Show vom Master (iveo-Daten)',
          notice: 'Die Liste kommt vom Master. Eigene Dateien sind ausgeblendet.',
          backLabel: 'Zurück zum eigenen Ordner',
          onBack: nichts,
        })}
      />,
    ),
    b('datalink-fehlertext', D, 'mit Fehlertext', <DataLinkSection {...datalink(id('datalink-fehlertext'), { error: 'Ordner nicht lesbar.' })} />),

    b('gegenstellen-ok', G, 'ok: alle verbunden (gefunden per mDNS)', <PeersSection {...gegenstellen(id('gegenstellen-ok'), {})} />),
    b('gegenstellen-warn', G, 'Warnung: manuell gesetzt, nicht verbunden', <PeersSection {...gegenstellen(id('gegenstellen-warn'), { peers: [GEGENSTELLEN[0], { ...GEGENSTELLEN[1], host: '10.0.0.12', connected: false, source: 'manual' }] })} />),
    b('gegenstellen-unbekannt', G, 'unbekannt: keine Rückmeldung', <PeersSection {...gegenstellen(id('gegenstellen-unbekannt'), { peers: [GEGENSTELLEN[0], { ...GEGENSTELLEN[1], connected: undefined }] })} />),
    b('gegenstellen-aus', G, 'aus: keine Gegenstellen', <PeersSection {...gegenstellen(id('gegenstellen-aus'), { peers: [] })} />),
    b(
      'gegenstellen-schalter',
      G,
      'Stage-Display-Muster: ein/aus je Zeile, ohne Auto',
      <PeersSection
        {...gegenstellen(id('gegenstellen-schalter'), {
          capabilities: { toggle: true },
          peers: [
            { role: 'links', label: 'Bühne links', host: '10.0.0.21', port: 7790, enabled: true, connected: true },
            { role: 'rechts', label: 'Bühne rechts', host: '10.0.0.22', port: 7790, enabled: false },
          ],
        })}
      />,
    ),
    b('gegenstellen-gesperrt', G, 'gesperrt', <PeersSection {...gegenstellen(id('gegenstellen-gesperrt'), { locked: MASTER })} />),
    b('gegenstellen-fehlertext', G, 'mit Fehlertext', <PeersSection {...gegenstellen(id('gegenstellen-fehlertext'), { error: 'Suche im Netz nicht möglich.' })} />),
  ];
}
