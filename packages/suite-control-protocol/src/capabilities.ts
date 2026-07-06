// ─────────────────────────────────────────────────────────────────────────────
// Capability-Tabelle je Tool-Rolle. Rein deklarativ (keine node/electron-
// Imports), damit sie — wie ./index — ins standalone Companion-Modul kopiert
// werden kann (scripts/sync-companion-protocol.mjs). Das generische „JM Suite"-
// Companion-Modul iteriert diese Tabelle und baut daraus setActionDefinitions /
// setFeedbackDefinitions / setVariableDefinitions je gefundener Rolle.
//
// Dient gleichzeitig als maschinenlesbare Doku, welche Befehle/Status ein Tool
// über @jm/suite-control-protocol spricht.
// ─────────────────────────────────────────────────────────────────────────────

export type ArgType = 'number' | 'string' | 'dropdown';

export interface CapabilityArg {
  /** Option-ID im Companion + Reihenfolge im Befehl (Token nach dem Verb). */
  id: string;
  label: string;
  type: ArgType;
  default?: number | string;
  min?: number;
  max?: number;
  choices?: { id: string; label: string }[];
  /**
   * Optionaler UI-Hinweis: das Argument ist ein Dateipfad. Editoren mit nativem
   * Datei-Dialog (z. B. JM Rundown) zeigen dann einen „Durchsuchen"-Button neben
   * dem Textfeld. Companion ignoriert es und behandelt das Arg als string-Textfeld
   * (Pfad wird getippt) — daher bleibt `type: 'string'`.
   */
  picker?: 'file';
}

export interface CapabilityAction {
  /** Rollen-lokale, stabile ID (z. B. 'preview'); Companion-Action-ID = `${role}.${id}`. */
  id: string;
  label: string;
  /** Protokoll-Verb (z. B. 'preview', 'start', 'cue'). */
  verb: string;
  /** Argumente in Reihenfolge → Token nach dem Verb. */
  args?: CapabilityArg[];
  /**
   * Wenn gesetzt: Toggle-Action. Der Wert ist ein dropdown-Arg mit
   * Choices on/off/toggle; das Modul löst 'toggle' anhand des STATE-Schlüssels
   * `toggleKey` auf (an↔aus). Beispiel: Switcher RECORD/STREAM.
   */
  toggleKey?: string;
}

export interface CapabilityVariable {
  /** Schlüssel im STATE-Push (z. B. 'program', 'remaining'). */
  id: string;
  label: string;
}

export type RGB = [number, number, number];

export interface CapabilityFeedback {
  id: string;
  label: string;
  /** STATE-Schlüssel, der ausgewertet wird. */
  stateKey: string;
  /**
   *  'truthy'     → an, wenn Schlüssel '1'/true ist (z. B. recording).
   *  'equalsArg'  → an, wenn Schlüssel == Optionswert (z. B. program == Szene n).
   */
  match: 'truthy' | 'equalsArg';
  arg?: CapabilityArg;
  bgcolor: RGB;
  color: RGB;
}

export interface RoleCapability {
  role: string;
  label: string;
  /** Standard-Steuerport (mDNS liefert den realen Port; dies ist nur der Default). */
  port: number;
  actions: CapabilityAction[];
  variables: CapabilityVariable[];
  feedbacks: CapabilityFeedback[];
}

const RED: RGB = [200, 30, 30];
const GREEN: RGB = [30, 160, 60];
const YELLOW: RGB = [251, 231, 59];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

const sceneArg: CapabilityArg = { id: 'scene', label: 'Szene (Nr.)', type: 'number', default: 1, min: 1, max: 64 };
const atemInputArg: CapabilityArg = { id: 'input', label: 'Eingang (Nr.)', type: 'number', default: 1, min: 0, max: 40 };
const modeArg: CapabilityArg = {
  id: 'mode',
  label: 'Modus',
  type: 'dropdown',
  default: 'toggle',
  choices: [
    { id: 'toggle', label: 'Umschalten' },
    { id: 'on', label: 'Start' },
    { id: 'off', label: 'Stopp' },
  ],
};

export const CAPABILITIES: Record<string, RoleCapability> = {
  // ── Switcher (Bestand; Verben ohne Namespace) ──────────────────────────────
  switcher: {
    role: 'switcher',
    label: 'JM Switcher',
    port: 8723,
    actions: [
      { id: 'preview', label: 'Preview-Szene wählen', verb: 'preview', args: [sceneArg] },
      { id: 'program', label: 'Program-Szene (harter Schnitt)', verb: 'program', args: [sceneArg] },
      { id: 'cut', label: 'Cut (Program = Preview)', verb: 'cut' },
      {
        id: 'auto',
        label: 'Auto (Dissolve)',
        verb: 'auto',
        args: [{ id: 'ms', label: 'Dauer ms (0 = Standard)', type: 'number', default: 0, min: 0, max: 10000 }],
      },
      { id: 'record', label: 'Aufnahme', verb: 'record', args: [modeArg], toggleKey: 'recording' },
      { id: 'stream', label: 'Stream (RTMP)', verb: 'stream', args: [modeArg], toggleKey: 'streaming' },
    ],
    variables: [
      { id: 'program', label: 'Program-Szene (Nr.)' },
      { id: 'preview', label: 'Preview-Szene (Nr.)' },
      { id: 'recording', label: 'Aufnahme (1/0)' },
      { id: 'streaming', label: 'Stream (1/0)' },
      { id: 'scenes', label: 'Anzahl Szenen' },
    ],
    feedbacks: [
      { id: 'program_scene', label: 'Szene ist auf Program', stateKey: 'program', match: 'equalsArg', arg: sceneArg, bgcolor: RED, color: WHITE },
      { id: 'preview_scene', label: 'Szene ist auf Preview', stateKey: 'preview', match: 'equalsArg', arg: sceneArg, bgcolor: GREEN, color: WHITE },
      { id: 'recording', label: 'Aufnahme läuft', stateKey: 'recording', match: 'truthy', bgcolor: RED, color: WHITE },
      { id: 'streaming', label: 'Stream läuft', stateKey: 'streaming', match: 'truthy', bgcolor: YELLOW, color: BLACK },
    ],
  },

  // ── Timer ──────────────────────────────────────────────────────────────────
  timer: {
    role: 'timer',
    label: 'JM Timer',
    port: 8724,
    actions: [
      { id: 'start', label: 'Start', verb: 'start' },
      { id: 'stop', label: 'Stopp', verb: 'stop' },
      { id: 'reset', label: 'Reset', verb: 'reset' },
      { id: 'add', label: 'Zeit addieren (s)', verb: 'add', args: [{ id: 'seconds', label: 'Sekunden', type: 'number', default: 30, min: -3600, max: 3600 }] },
      { id: 'set', label: 'Zeit setzen (s)', verb: 'set', args: [{ id: 'seconds', label: 'Sekunden', type: 'number', default: 300, min: 0, max: 86400 }] },
      { id: 'goto', label: 'Block anspringen', verb: 'goto', args: [{ id: 'block', label: 'Block (Nr.)', type: 'number', default: 1, min: 1, max: 999 }] },
    ],
    variables: [
      { id: 'remaining', label: 'Restzeit (mm:ss)' },
      { id: 'remaining_s', label: 'Restzeit (Sekunden)' },
      { id: 'running', label: 'Läuft (1/0)' },
      { id: 'block_label', label: 'Aktueller Block' },
    ],
    feedbacks: [
      { id: 'running', label: 'Timer läuft', stateKey: 'running', match: 'truthy', bgcolor: GREEN, color: WHITE },
      { id: 'overrun', label: 'Timer überzogen', stateKey: 'overrun', match: 'truthy', bgcolor: RED, color: WHITE },
      { id: 'warning', label: 'Timer-Warnung', stateKey: 'warning', match: 'truthy', bgcolor: YELLOW, color: BLACK },
    ],
  },

  // ── Player (Soundboard/Cues) ────────────────────────────────────────────────
  player: {
    role: 'player',
    label: 'JM Player',
    port: 8725,
    actions: [
      { id: 'go', label: 'GO (Standby-Cue feuern)', verb: 'go' },
      { id: 'stop', label: 'Stopp (alle Cues)', verb: 'stop' },
      { id: 'pause', label: 'Pause/Resume', verb: 'pause' },
      { id: 'panic', label: 'Panic (Hard-Stop)', verb: 'panic' },
      { id: 'cue', label: 'Show-Cue feuern', verb: 'cue', args: [{ id: 'n', label: 'Cue (Nr.)', type: 'number', default: 1, min: 1, max: 999 }] },
      { id: 'standby', label: 'Standby setzen', verb: 'standby', args: [{ id: 'n', label: 'Cue (Nr.)', type: 'number', default: 1, min: 1, max: 999 }] },
      { id: 'next', label: 'Standby +1', verb: 'next' },
      { id: 'prev', label: 'Standby −1', verb: 'prev' },
      { id: 'pad', label: 'Soundboard-Pad triggern', verb: 'pad', args: [{ id: 'slot', label: 'Pad (Slot)', type: 'number', default: 0, min: 0, max: 99 }] },
      { id: 'show', label: 'Show aufrufen (Name)', verb: 'show', args: [{ id: 'show', label: 'Show-Name (oder DB-Nr.)', type: 'string', default: '' }] },
    ],
    variables: [
      { id: 'playing', label: 'Spielt (1/0)' },
      { id: 'paused', label: 'Pausiert (1/0)' },
      { id: 'standby', label: 'Standby-Cue (Nr.)' },
      { id: 'standby_label', label: 'Standby-Titel' },
      { id: 'cues', label: 'Anzahl Cues' },
      { id: 'playing_count', label: 'Laufende Cues' },
    ],
    feedbacks: [
      { id: 'playing', label: 'Player spielt', stateKey: 'playing', match: 'truthy', bgcolor: GREEN, color: WHITE },
      { id: 'paused', label: 'Player pausiert', stateKey: 'paused', match: 'truthy', bgcolor: YELLOW, color: BLACK },
      { id: 'standby_cue', label: 'Cue ist auf Standby', stateKey: 'standby', match: 'equalsArg', arg: { id: 'n', label: 'Cue (Nr.)', type: 'number', default: 1, min: 1, max: 999 }, bgcolor: GREEN, color: WHITE },
    ],
  },

  // ── Titler (Bauchbinden) ────────────────────────────────────────────────────
  titler: {
    role: 'titler',
    label: 'JM Titler',
    port: 8726,
    actions: [
      { id: 'take', label: 'Take (On Air)', verb: 'take' },
      { id: 'clear', label: 'Clear (ausblenden)', verb: 'clear' },
      { id: 'toggle', label: 'On Air umschalten', verb: 'toggle' },
      {
        id: 'template',
        label: 'Vorlage wählen',
        verb: 'template',
        args: [
          {
            id: 'kind',
            label: 'Vorlage',
            type: 'dropdown',
            default: 'lowerthird',
            choices: [
              { id: 'lowerthird', label: 'Bauchbinde' },
              { id: 'banner', label: 'Banner' },
              { id: 'ticker', label: 'Ticker' },
              { id: 'graphic', label: 'Grafik-Vorlage' },
            ],
          },
        ],
      },
      {
        // Bauchbinden-Text fernsetzen (z. B. von Q&A). Tokens sind whitespace-frei:
        // Leerzeichen als '_' schreiben, '-' = leeres Feld (Titler dekodiert das).
        id: 'text',
        label: 'Bauchbinden-Text setzen',
        verb: 'text',
        args: [
          { id: 'name', label: 'Name (Leerzeichen als _)', type: 'string', default: '' },
          { id: 'subtitle', label: 'Untertitel (Leerzeichen als _, „-" = leer)', type: 'string', default: '' },
        ],
      },
      {
        // DataLink-Eintrag abrufen: füllt die {{variablen}} aus dem gewählten
        // Listen-Eintrag (CSV-Zeile bzw. key=wert-Datei im Watchfolder).
        id: 'recall',
        label: 'DataLink-Eintrag abrufen',
        verb: 'recall',
        args: [{ id: 'ref', label: 'Eintrag (Nr. oder Name)', type: 'string', default: '1' }],
      },
      { id: 'next', label: 'Nächster DataLink-Eintrag', verb: 'next' },
      { id: 'prev', label: 'Vorheriger DataLink-Eintrag', verb: 'prev' },
      {
        // Importierte Grafik-Vorlage (Bauchbinde aus dem jm Grafiktool / PSD) wählen (#162).
        id: 'graphic',
        label: 'Grafik-Vorlage wählen',
        verb: 'graphic',
        args: [{ id: 'ref', label: 'Vorlage (Nr. oder Name)', type: 'string', default: '1' }],
      },
      {
        // Einzelnes Textfeld einer Grafik-Vorlage setzen. Token whitespace-frei ('_'=Leerzeichen).
        id: 'slot',
        label: 'Grafik-Slot-Text setzen',
        verb: 'slot',
        args: [
          { id: 'key', label: 'Slot-Schlüssel (z. B. titel)', type: 'string', default: '' },
          { id: 'text', label: 'Text (Leerzeichen als _)', type: 'string', default: '' },
        ],
      },
    ],
    variables: [
      { id: 'on_air', label: 'On Air (1/0)' },
      { id: 'template', label: 'Vorlage' },
      { id: 'ndi', label: 'NDI aktiv (1/0)' },
      { id: 'connections', label: 'NDI-Empfänger' },
      { id: 'entry', label: 'Aktiver DataLink-Eintrag' },
      { id: 'entry_index', label: 'Eintrag Nr.' },
      { id: 'entry_count', label: 'Anzahl Einträge' },
    ],
    feedbacks: [
      { id: 'on_air', label: 'CG ist On Air', stateKey: 'on_air', match: 'truthy', bgcolor: RED, color: WHITE },
      { id: 'ndi', label: 'NDI läuft', stateKey: 'ndi', match: 'truthy', bgcolor: GREEN, color: WHITE },
    ],
  },

  // ── Prompter ────────────────────────────────────────────────────────────────
  prompter: {
    role: 'prompter',
    label: 'JM Prompter',
    port: 8727,
    actions: [
      { id: 'scroll', label: 'Scrollen', verb: 'scroll', args: [modeArg], toggleKey: 'scrolling' },
      { id: 'speed', label: 'Tempo setzen (Zeilen/s)', verb: 'speed', args: [{ id: 'value', label: 'Tempo', type: 'number', default: 2, min: 0.2, max: 6 }] },
      { id: 'faster', label: 'Schneller', verb: 'faster' },
      { id: 'slower', label: 'Langsamer', verb: 'slower' },
      { id: 'top', label: 'An den Anfang', verb: 'top' },
    ],
    variables: [
      { id: 'speed', label: 'Tempo (Zeilen/s)' },
      { id: 'scrolling', label: 'Scrollt (1/0)' },
    ],
    feedbacks: [{ id: 'scrolling', label: 'Prompter scrollt', stateKey: 'scrolling', match: 'truthy', bgcolor: GREEN, color: WHITE }],
  },

  // ── Presenter ───────────────────────────────────────────────────────────────
  presenter: {
    role: 'presenter',
    label: 'JM Presenter',
    port: 8728,
    actions: [
      { id: 'next', label: 'Nächste Folie', verb: 'next' },
      { id: 'prev', label: 'Vorherige Folie', verb: 'prev' },
      { id: 'goto', label: 'Folie anspringen', verb: 'goto', args: [{ id: 'n', label: 'Folie (Nr.)', type: 'number', default: 1, min: 1, max: 999 }] },
      { id: 'black', label: 'Schwarz', verb: 'black' },
      { id: 'white', label: 'Weiß', verb: 'white' },
      { id: 'live', label: 'Live', verb: 'live' },
      { id: 'stop', label: 'Präsentation beenden', verb: 'stop' },
      {
        id: 'open',
        label: 'Präsentation öffnen (Pfad)',
        verb: 'open',
        args: [{ id: 'path', label: 'Pfad (.pdf / .pptx / .jmpres / Bild)', type: 'string', default: '', picker: 'file' }],
      },
    ],
    variables: [
      { id: 'slide', label: 'Aktuelle Folie' },
      { id: 'total', label: 'Folien gesamt' },
      { id: 'active', label: 'Präsentation läuft (1/0)' },
    ],
    feedbacks: [
      { id: 'black', label: 'Schwarzbild aktiv', stateKey: 'black', match: 'truthy', bgcolor: BLACK, color: WHITE },
      { id: 'white', label: 'Weißbild aktiv', stateKey: 'white', match: 'truthy', bgcolor: WHITE, color: BLACK },
      { id: 'live', label: 'Live aktiv', stateKey: 'live', match: 'truthy', bgcolor: GREEN, color: WHITE },
    ],
  },

  // ── Recorder ────────────────────────────────────────────────────────────────
  recorder: {
    role: 'recorder',
    label: 'JM Audio Recorder',
    port: 8729,
    actions: [
      { id: 'record', label: 'Aufnahme', verb: 'record', args: [modeArg], toggleKey: 'recording' },
      { id: 'arm', label: 'Eingang öffnen (Arm)', verb: 'arm' },
      { id: 'disarm', label: 'Eingang schließen', verb: 'disarm' },
    ],
    variables: [
      { id: 'recording', label: 'Aufnahme (1/0)' },
      { id: 'armed', label: 'Bereit/Armed (1/0)' },
      { id: 'status', label: 'Status (idle/armed/recording)' },
      { id: 'duration', label: 'Dauer (Sek.)' },
    ],
    feedbacks: [
      { id: 'recording', label: 'Aufnahme läuft', stateKey: 'recording', match: 'truthy', bgcolor: RED, color: WHITE },
      { id: 'armed', label: 'Eingang bereit', stateKey: 'armed', match: 'truthy', bgcolor: YELLOW, color: BLACK },
    ],
  },

  // ── DAW (Transport, minimal) ────────────────────────────────────────────────
  daw: {
    role: 'daw',
    label: 'JM DAW',
    port: 8730,
    actions: [
      { id: 'play', label: 'Play', verb: 'play' },
      { id: 'stop', label: 'Stopp', verb: 'stop' },
      { id: 'toggle', label: 'Play/Stop umschalten', verb: 'toggle' },
      { id: 'rec', label: 'Aufnahme', verb: 'rec', args: [modeArg], toggleKey: 'recording' },
    ],
    variables: [
      { id: 'playing', label: 'Spielt (1/0)' },
      { id: 'recording', label: 'Aufnahme (1/0)' },
    ],
    feedbacks: [
      { id: 'playing', label: 'Wiedergabe läuft', stateKey: 'playing', match: 'truthy', bgcolor: GREEN, color: WHITE },
      { id: 'recording', label: 'Aufnahme läuft', stateKey: 'recording', match: 'truthy', bgcolor: RED, color: WHITE },
    ],
  },

  // ── Rundown (Ablaufregie/Conductor) ─────────────────────────────────────────
  rundown: {
    role: 'rundown',
    label: 'JM Rundown',
    port: 8731,
    actions: [
      { id: 'go', label: 'GO (Zeile feuern + weiter)', verb: 'go' },
      { id: 'next', label: 'Weiter (ohne feuern)', verb: 'next' },
      { id: 'prev', label: 'Zurück', verb: 'prev' },
      { id: 'goto', label: 'Zeile anspringen', verb: 'goto', args: [{ id: 'n', label: 'Zeile (Nr.)', type: 'number', default: 1, min: 1, max: 999 }] },
    ],
    variables: [
      { id: 'cue', label: 'Scharfe Zeile (Nr.)' },
      { id: 'total', label: 'Zeilen gesamt' },
      { id: 'label', label: 'Scharfe Zeile (Titel)' },
    ],
    feedbacks: [],
  },

  // ── Q&A (Wortmeldungs-/Pressekonferenz-Queue) ───────────────────────────────
  qa: {
    role: 'qa',
    label: 'JM Q&A',
    port: 8733,
    actions: [
      { id: 'next', label: 'Nächste Wortmeldung (ans Wort)', verb: 'next' },
      { id: 'end', label: 'Sprecher beenden', verb: 'end' },
      {
        id: 'extend',
        label: 'Redezeit verlängern (s)',
        verb: 'extend',
        args: [{ id: 'seconds', label: 'Sekunden', type: 'number', default: 30, min: 5, max: 600 }],
      },
      { id: 'clear', label: 'Erledigte entfernen', verb: 'clear' },
    ],
    variables: [
      { id: 'active', label: 'Aktiver Sprecher' },
      { id: 'waiting', label: 'Wartende Wortmeldungen' },
      { id: 'total', label: 'Einträge gesamt' },
      { id: 'live', label: 'Sprecher aktiv (1/0)' },
      { id: 'remote', label: 'Saal-Einreichung (1/0)' },
    ],
    feedbacks: [
      { id: 'live', label: 'Sprecher am Wort', stateKey: 'live', match: 'truthy', bgcolor: GREEN, color: WHITE },
      { id: 'remote', label: 'Saal-Einreichung an', stateKey: 'remote', match: 'truthy', bgcolor: YELLOW, color: BLACK },
    ],
  },

  // ── Battle (BattleRap-Toolkit) ──────────────────────────────────────────────
  battle: {
    role: 'battle',
    label: 'JM Battle',
    port: 8734,
    actions: [
      { id: 'next', label: 'Nächste Runde', verb: 'next' },
      { id: 'prev', label: 'Vorherige Runde', verb: 'prev' },
      {
        id: 'win',
        label: 'Jury-Entscheid (aktuelle Runde)',
        verb: 'win',
        args: [
          {
            id: 'side',
            label: 'Sieger',
            type: 'dropdown',
            default: 'a',
            choices: [
              { id: 'a', label: 'Ecke A' },
              { id: 'b', label: 'Ecke B' },
              { id: 'tie', label: 'Unentschieden' },
            ],
          },
        ],
      },
      { id: 'voting', label: 'Publikums-Voting', verb: 'voting', args: [modeArg], toggleKey: 'voting' },
      { id: 'vs', label: 'VS-Bauchbinde (Titler)', verb: 'vs', args: [modeArg], toggleKey: 'live' },
      { id: 'replay', label: 'Instant-Replay-Clip', verb: 'replay' },
      { id: 'reset', label: 'Battle zurücksetzen', verb: 'reset' },
    ],
    variables: [
      { id: 'round', label: 'Aktuelle Runde' },
      { id: 'total', label: 'Runden gesamt' },
      { id: 'wins_a', label: 'Rundensiege A' },
      { id: 'wins_b', label: 'Rundensiege B' },
      { id: 'votes_a', label: 'Stimmen A' },
      { id: 'votes_b', label: 'Stimmen B' },
      { id: 'voting', label: 'Voting offen (1/0)' },
      { id: 'live', label: 'VS on air (1/0)' },
      { id: 'leader', label: 'Sieger (A/B/-)' },
    ],
    feedbacks: [
      { id: 'live', label: 'VS-Bauchbinde on air', stateKey: 'live', match: 'truthy', bgcolor: RED, color: WHITE },
      { id: 'voting', label: 'Voting offen', stateKey: 'voting', match: 'truthy', bgcolor: YELLOW, color: BLACK },
    ],
  },

  // ── Caption (Live-Untertitel) ────────────────────────────────────────────────
  caption: {
    role: 'caption',
    label: 'JM Caption',
    port: 8732,
    actions: [
      { id: 'transcribe', label: 'Transkription', verb: 'transcribe', args: [modeArg], toggleKey: 'running' },
      { id: 'hold', label: 'Hold (Ausgabe einfrieren)', verb: 'hold', args: [modeArg], toggleKey: 'hold' },
      { id: 'ndi', label: 'NDI-Ausgabe', verb: 'ndi', args: [modeArg], toggleKey: 'ndi' },
      { id: 'clear', label: 'Untertitel leeren', verb: 'clear' },
    ],
    variables: [
      { id: 'running', label: 'Transkription läuft (1/0)' },
      { id: 'hold', label: 'Hold aktiv (1/0)' },
      { id: 'ndi', label: 'NDI aktiv (1/0)' },
      { id: 'connections', label: 'NDI-Empfänger' },
      { id: 'lines', label: 'Zeilen im Verlauf' },
    ],
    feedbacks: [
      { id: 'running', label: 'Transkription läuft', stateKey: 'running', match: 'truthy', bgcolor: GREEN, color: WHITE },
      { id: 'hold', label: 'Hold aktiv', stateKey: 'hold', match: 'truthy', bgcolor: YELLOW, color: BLACK },
      { id: 'ndi', label: 'NDI läuft', stateKey: 'ndi', match: 'truthy', bgcolor: GREEN, color: WHITE },
    ],
  },

  // ── Studio Control Gateway (zentral-auditiert: ATEM / OBS / TriCaster) ───────
  // studio-control ist ein Geräte-Hub. Das Gateway exponiert die PRIMÄR-Instanz
  // je Gerätetyp (erste konfigurierte) an Companion; jeder Befehl läuft durch das
  // Audit-Log. Verben sind typ-präfixiert (atem_/obs_/tricaster_), da eine Rolle
  // mehrere Gerätetypen bündelt. Abgedeckt: ATEM, OBS, TriCaster, PTZ, Audio, Licht.
  studio: {
    role: 'studio',
    label: 'JM Studio Control',
    port: 8735,
    actions: [
      // ATEM (Hardware-Mischer, M/E 1)
      { id: 'atem_program', label: 'ATEM: Program-Eingang', verb: 'atem_program', args: [atemInputArg] },
      { id: 'atem_preview', label: 'ATEM: Preview-Eingang', verb: 'atem_preview', args: [atemInputArg] },
      { id: 'atem_cut', label: 'ATEM: Cut', verb: 'atem_cut' },
      { id: 'atem_auto', label: 'ATEM: Auto (Übergang)', verb: 'atem_auto' },
      { id: 'atem_ftb', label: 'ATEM: Fade to Black', verb: 'atem_ftb' },
      { id: 'atem_record', label: 'ATEM: Aufnahme', verb: 'atem_record', args: [modeArg], toggleKey: 'atem_rec' },
      { id: 'atem_stream', label: 'ATEM: Stream', verb: 'atem_stream', args: [modeArg], toggleKey: 'atem_stream' },
      // OBS (WebSocket-Bridge)
      { id: 'obs_scene', label: 'OBS: Szene wählen (Nr.)', verb: 'obs_scene', args: [sceneArg] },
      { id: 'obs_record', label: 'OBS: Aufnahme', verb: 'obs_record', args: [modeArg], toggleKey: 'obs_rec' },
      { id: 'obs_stream', label: 'OBS: Stream', verb: 'obs_stream', args: [modeArg], toggleKey: 'obs_stream' },
      // TriCaster (LiveControl-Shortcut/Makro; Name muss ein einzelnes Token sein)
      { id: 'tricaster_shortcut', label: 'TriCaster: Shortcut/Makro', verb: 'tricaster_shortcut', args: [{ id: 'name', label: 'Shortcut-Name (z. B. main_take)', type: 'string', default: 'main_take' }] },
      // PTZ (Panasonic AW)
      { id: 'ptz_preset', label: 'PTZ: Preset abrufen', verb: 'ptz_preset', args: [{ id: 'preset', label: 'Preset (Nr.)', type: 'number', default: 1, min: 0, max: 99 }] },
      { id: 'ptz_power', label: 'PTZ: Power', verb: 'ptz_power', args: [modeArg], toggleKey: 'ptz_power' },
      // Audio (Mischpult)
      { id: 'audio_mute', label: 'Audio: Kanal stumm', verb: 'audio_mute', args: [{ id: 'channel', label: 'Kanal (Nr.)', type: 'number', default: 1, min: 1, max: 64 }, { id: 'state', label: 'Zustand', type: 'dropdown', default: 'on', choices: [{ id: 'on', label: 'Mute an' }, { id: 'off', label: 'Mute aus' }] }] },
      { id: 'audio_fader', label: 'Audio: Fader (dB)', verb: 'audio_fader', args: [{ id: 'channel', label: 'Kanal (Nr.)', type: 'number', default: 1, min: 1, max: 64 }, { id: 'db', label: 'Pegel (dB)', type: 'number', default: 0, min: -60, max: 10 }] },
      // Licht (Art-Net)
      { id: 'lighting_blackout', label: 'Licht: Blackout', verb: 'lighting_blackout', args: [modeArg], toggleKey: 'lighting_blackout' },
    ],
    variables: [
      { id: 'atem', label: 'ATEM verbunden (1/0)' },
      { id: 'atem_name', label: 'ATEM-Modell' },
      { id: 'atem_pgm', label: 'ATEM Program (Nr.)' },
      { id: 'atem_pvw', label: 'ATEM Preview (Nr.)' },
      { id: 'atem_rec', label: 'ATEM Aufnahme (1/0)' },
      { id: 'atem_stream', label: 'ATEM Stream (1/0)' },
      { id: 'obs', label: 'OBS verbunden (1/0)' },
      { id: 'obs_scene', label: 'OBS Szene (Nr.)' },
      { id: 'obs_scene_name', label: 'OBS Szene (Name)' },
      { id: 'obs_rec', label: 'OBS Aufnahme (1/0)' },
      { id: 'obs_stream', label: 'OBS Stream (1/0)' },
      { id: 'tricaster', label: 'TriCaster verbunden (1/0)' },
      { id: 'tricaster_name', label: 'TriCaster' },
      { id: 'ptz', label: 'PTZ verbunden (1/0)' },
      { id: 'ptz_name', label: 'PTZ-Kamera' },
      { id: 'ptz_power', label: 'PTZ Power (1/0)' },
      { id: 'audio', label: 'Audio verbunden (1/0)' },
      { id: 'audio_name', label: 'Audiopult' },
      { id: 'lighting', label: 'Licht konfiguriert (1/0)' },
      { id: 'lighting_blackout', label: 'Blackout aktiv (1/0)' },
    ],
    feedbacks: [
      { id: 'atem_pgm', label: 'ATEM: Eingang auf Program', stateKey: 'atem_pgm', match: 'equalsArg', arg: atemInputArg, bgcolor: RED, color: WHITE },
      { id: 'atem_pvw', label: 'ATEM: Eingang auf Preview', stateKey: 'atem_pvw', match: 'equalsArg', arg: atemInputArg, bgcolor: GREEN, color: WHITE },
      { id: 'atem_rec', label: 'ATEM: Aufnahme läuft', stateKey: 'atem_rec', match: 'truthy', bgcolor: RED, color: WHITE },
      { id: 'atem_stream', label: 'ATEM: Stream läuft', stateKey: 'atem_stream', match: 'truthy', bgcolor: YELLOW, color: BLACK },
      { id: 'obs_scene', label: 'OBS: Szene aktiv', stateKey: 'obs_scene', match: 'equalsArg', arg: sceneArg, bgcolor: GREEN, color: WHITE },
      { id: 'obs_rec', label: 'OBS: Aufnahme läuft', stateKey: 'obs_rec', match: 'truthy', bgcolor: RED, color: WHITE },
      { id: 'obs_stream', label: 'OBS: Stream läuft', stateKey: 'obs_stream', match: 'truthy', bgcolor: YELLOW, color: BLACK },
      { id: 'ptz_power', label: 'PTZ: Power an', stateKey: 'ptz_power', match: 'truthy', bgcolor: GREEN, color: WHITE },
      { id: 'lighting_blackout', label: 'Licht: Blackout aktiv', stateKey: 'lighting_blackout', match: 'truthy', bgcolor: RED, color: WHITE },
    ],
  },

  // ── Launcher (iveo Side-Event-Umschalter, #11) ─────────────────────────────
  // Der Launcher ist iveo-Token-Halter: EIN Befehl schaltet die offene Show live
  // auf ein Side Event um (Ablauf=Agenda + Speaker → Timer/Titler RELOAD), ohne
  // dass je Side Event eine eigene Show angelegt werden muss.
  launcher: {
    role: 'launcher',
    label: 'JM Launcher',
    port: 8736,
    actions: [
      {
        id: 'sideevent',
        label: 'iveo Side Event live schalten',
        verb: 'sideevent',
        args: [{ id: 'programId', label: 'Side-Event-ID (leer = Tagesübersicht)', type: 'string', default: '' }],
      },
    ],
    variables: [
      { id: 'iveo_event', label: 'iveo Event' },
      { id: 'iveo_day', label: 'iveo Tag' },
      { id: 'iveo_side_event', label: 'Aktives Side Event (ID)' },
    ],
    feedbacks: [],
  },

  // ── Connect (Remote-Zuschaltung / Green Room, Welle 6) ─────────────────────
  // Ein GO holt den vorbereiteten (Standby-)Gast auf Sendung — die eine Rundown-
  // Zeile für Zuschaltungen. Guest-IDs sind die opaken Bezeichner aus dem Raum;
  // im Companion typischerweise als Variable/Text hinterlegt.
  connect: {
    role: 'connect',
    label: 'JM Connect',
    port: 8737,
    actions: [
      { id: 'go', label: 'GO — Standby-Gast auf Sendung', verb: 'go' },
      { id: 'next', label: 'Nächsten Gast vormerken (Standby)', verb: 'next' },
      { id: 'standby', label: 'Gast als Standby vormerken', verb: 'standby', args: [{ id: 'guest', label: 'Gast-ID', type: 'string', default: '' }] },
      { id: 'onair', label: 'Gast auf Sendung', verb: 'onair', args: [{ id: 'guest', label: 'Gast-ID', type: 'string', default: '' }] },
      { id: 'off', label: 'Gast aus Sendung', verb: 'off', args: [{ id: 'guest', label: 'Gast-ID', type: 'string', default: '' }] },
      { id: 'approve', label: 'Gast aus dem Warteraum freigeben', verb: 'approve', args: [{ id: 'guest', label: 'Gast-ID', type: 'string', default: '' }] },
      { id: 'talkback', label: 'Talkback (Regie ins Ohr)', verb: 'talkback', args: [modeArg], toggleKey: 'talkback' },
      { id: 'kick', label: 'Gast entfernen', verb: 'kick', args: [{ id: 'guest', label: 'Gast-ID', type: 'string', default: '' }] },
    ],
    variables: [
      { id: 'room', label: 'Raum' },
      { id: 'connected', label: 'SFU verbunden (1/0)' },
      { id: 'guests', label: 'Gäste gesamt' },
      { id: 'lobby', label: 'Im Warteraum' },
      { id: 'onair', label: 'Auf Sendung (Anzahl)' },
      { id: 'active_label', label: 'Aktiver Gast (Name)' },
      { id: 'standby', label: 'Standby-Gast (ID)' },
      { id: 'standby_label', label: 'Standby-Gast (Name)' },
      { id: 'talkback', label: 'Talkback aktiv (1/0)' },
    ],
    feedbacks: [
      { id: 'onair', label: 'Connect: es ist ein Gast auf Sendung', stateKey: 'onair', match: 'truthy', bgcolor: RED, color: WHITE },
      { id: 'lobby', label: 'Connect: Gäste im Warteraum', stateKey: 'lobby', match: 'truthy', bgcolor: YELLOW, color: BLACK },
      { id: 'talkback', label: 'Connect: Talkback aktiv', stateKey: 'talkback', match: 'truthy', bgcolor: YELLOW, color: BLACK },
    ],
  },
};

/** Liste aller bekannten Rollen (für mDNS-Filter / Dropdowns). */
export const KNOWN_ROLES = Object.keys(CAPABILITIES);
