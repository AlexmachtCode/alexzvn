// GENERIERT von scripts/sync-companion-protocol.mjs — NICHT BEARBEITEN.
// Quelle: packages/suite-control-protocol/src/{index,capabilities}.ts

// packages/suite-control-protocol/src/index.ts
var DEFAULT_CONTROL_PORT = 8723;
var SWITCHER_VERBS = /* @__PURE__ */ new Set(["PREVIEW", "PROGRAM", "CUT", "AUTO", "RECORD", "STREAM"]);
function isQueryHead(head) {
  return head === "STATE?" || head === "STATE";
}
function parseSuiteCommand(line) {
  const t = line.trim();
  if (!t) return null;
  const parts = t.split(/\s+/);
  const head = parts[0].toUpperCase();
  if (isQueryHead(head)) return { ns: "", verb: "query", args: [] };
  if (SWITCHER_VERBS.has(head)) {
    return { ns: "switcher", verb: head.toLowerCase(), args: parts.slice(1) };
  }
  if (parts.length >= 2) {
    return { ns: head.toLowerCase(), verb: parts[1].toLowerCase(), args: parts.slice(2) };
  }
  return null;
}
function formatSuiteCommand(c) {
  const head = c.ns === "switcher" ? c.verb.toUpperCase() : `${c.ns.toUpperCase()} ${c.verb.toUpperCase()}`;
  const tail = c.args.length ? " " + c.args.join(" ") : "";
  return `${head}${tail}
`;
}
function serializeValue(v) {
  if (typeof v === "boolean") return v ? "1" : "0";
  return String(v);
}
function formatSuiteState(s) {
  const parts = ["STATE"];
  if (s.ns) parts.push(`ns=${s.ns}`);
  for (const [k, v] of Object.entries(s.kv)) parts.push(`${k}=${serializeValue(v)}`);
  return parts.join(" ") + "\n";
}
function parseSuiteState(line) {
  const t = line.trim();
  if (!/^STATE\b/i.test(t)) return null;
  let ns = "";
  const kv = {};
  for (const tok of t.split(/\s+/).slice(1)) {
    const eq = tok.indexOf("=");
    if (eq <= 0) continue;
    const key = tok.slice(0, eq);
    const val = tok.slice(eq + 1);
    if (key.toLowerCase() === "ns") ns = val;
    else kv[key] = val;
  }
  return { ns, kv };
}
function createLineBuffer(onLine) {
  let buf = "";
  return (chunk) => {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.trim()) onLine(line);
    }
  };
}
var AUTH_PROTO = "scs/1";
var AUTH_OK = "AUTHOK";
var AUTH_FAIL = "AUTHFAIL";
function formatAuthReq(nonceHex) {
  return `AUTHREQ ${AUTH_PROTO} nonce=${nonceHex}
`;
}
function parseAuthReq(line) {
  const t = line.trim();
  if (!t) return null;
  const parts = t.split(/\s+/);
  if (parts[0].toUpperCase() !== "AUTHREQ") return null;
  let proto = "";
  let nonce = "";
  for (const tok of parts.slice(1)) {
    const eq = tok.indexOf("=");
    if (eq < 0) {
      if (!proto) proto = tok;
      continue;
    }
    if (tok.slice(0, eq).toLowerCase() === "nonce") nonce = tok.slice(eq + 1);
  }
  return nonce ? { proto, nonce } : null;
}
function formatAuth(proofHex) {
  return `AUTH ${proofHex}
`;
}
function parseAuth(line) {
  const t = line.trim();
  if (!t) return null;
  const parts = t.split(/\s+/);
  if (parts[0].toUpperCase() !== "AUTH" || !parts[1]) return null;
  return { proof: parts[1] };
}
function isAuthOk(line) {
  return line.trim().toUpperCase() === AUTH_OK;
}
function isAuthFail(line) {
  return line.trim().toUpperCase() === AUTH_FAIL;
}
function parseCommand(line) {
  const t = line.trim();
  if (!t) return null;
  const parts = t.split(/\s+/);
  const verb = parts[0].toUpperCase();
  switch (verb) {
    case "PREVIEW": {
      const n = Number(parts[1]);
      return Number.isFinite(n) ? { type: "preview", scene: Math.trunc(n) } : null;
    }
    case "PROGRAM": {
      const n = Number(parts[1]);
      return Number.isFinite(n) ? { type: "program", scene: Math.trunc(n) } : null;
    }
    case "CUT":
      return { type: "cut" };
    case "AUTO": {
      if (parts[1] == null) return { type: "auto" };
      const ms = Number(parts[1]);
      return Number.isFinite(ms) ? { type: "auto", ms: Math.max(0, Math.trunc(ms)) } : { type: "auto" };
    }
    case "RECORD": {
      const on = onOff(parts[1]);
      return on == null ? null : { type: "record", on };
    }
    case "STREAM": {
      const on = onOff(parts[1]);
      return on == null ? null : { type: "stream", on };
    }
    case "STATE?":
    case "STATE":
      return { type: "queryState" };
    default:
      return null;
  }
}
function onOff(s) {
  if (!s) return null;
  const u = s.toUpperCase();
  if (u === "START" || u === "ON" || u === "1" || u === "TRUE") return true;
  if (u === "STOP" || u === "OFF" || u === "0" || u === "FALSE") return false;
  return null;
}
function formatState(s) {
  return `STATE program=${s.program} preview=${s.preview} recording=${s.recording ? 1 : 0} streaming=${s.streaming ? 1 : 0} scenes=${s.scenes}
`;
}
function parseState(line) {
  const t = line.trim();
  if (!/^STATE\s/i.test(t)) return null;
  const kv = /* @__PURE__ */ new Map();
  for (const tok of t.split(/\s+/).slice(1)) {
    const eq = tok.indexOf("=");
    if (eq > 0) kv.set(tok.slice(0, eq).toLowerCase(), tok.slice(eq + 1));
  }
  const num = (k) => {
    const n = Number(kv.get(k));
    return Number.isFinite(n) ? n : 0;
  };
  return {
    program: num("program"),
    preview: num("preview"),
    recording: kv.get("recording") === "1",
    streaming: kv.get("streaming") === "1",
    scenes: num("scenes")
  };
}
function switcherStateFromSuite(s) {
  const num = (k) => {
    const n = Number(s.kv[k]);
    return Number.isFinite(n) ? n : 0;
  };
  const bool = (k) => s.kv[k] === "1" || s.kv[k] === true || s.kv[k] === "true";
  return {
    program: num("program"),
    preview: num("preview"),
    recording: bool("recording"),
    streaming: bool("streaming"),
    scenes: num("scenes")
  };
}
function switcherStateToSuite(s) {
  return {
    ns: "switcher",
    kv: {
      program: s.program,
      preview: s.preview,
      recording: s.recording,
      streaming: s.streaming,
      scenes: s.scenes
    }
  };
}

// packages/suite-control-protocol/src/capabilities.ts
var RED = [200, 30, 30];
var GREEN = [30, 160, 60];
var YELLOW = [251, 231, 59];
var WHITE = [255, 255, 255];
var BLACK = [0, 0, 0];
var sceneArg = { id: "scene", label: "Szene (Nr.)", type: "number", default: 1, min: 1, max: 64 };
var atemInputArg = { id: "input", label: "Eingang (Nr.)", type: "number", default: 1, min: 0, max: 40 };
var modeArg = {
  id: "mode",
  label: "Modus",
  type: "dropdown",
  default: "toggle",
  choices: [
    { id: "toggle", label: "Umschalten" },
    { id: "on", label: "Start" },
    { id: "off", label: "Stopp" }
  ]
};
var CAPABILITIES = {
  // ── Switcher (Bestand; Verben ohne Namespace) ──────────────────────────────
  switcher: {
    role: "switcher",
    label: "JM Switcher",
    port: 8723,
    actions: [
      { id: "preview", label: "Preview-Szene w\xE4hlen", verb: "preview", args: [sceneArg] },
      { id: "program", label: "Program-Szene (harter Schnitt)", verb: "program", args: [sceneArg] },
      { id: "cut", label: "Cut (Program = Preview)", verb: "cut" },
      {
        id: "auto",
        label: "Auto (Dissolve)",
        verb: "auto",
        args: [{ id: "ms", label: "Dauer ms (0 = Standard)", type: "number", default: 0, min: 0, max: 1e4 }]
      },
      { id: "record", label: "Aufnahme", verb: "record", args: [modeArg], toggleKey: "recording" },
      { id: "stream", label: "Stream (RTMP)", verb: "stream", args: [modeArg], toggleKey: "streaming" }
    ],
    variables: [
      { id: "program", label: "Program-Szene (Nr.)" },
      { id: "preview", label: "Preview-Szene (Nr.)" },
      { id: "recording", label: "Aufnahme (1/0)" },
      { id: "streaming", label: "Stream (1/0)" },
      { id: "scenes", label: "Anzahl Szenen" }
    ],
    feedbacks: [
      { id: "program_scene", label: "Szene ist auf Program", stateKey: "program", match: "equalsArg", arg: sceneArg, bgcolor: RED, color: WHITE },
      { id: "preview_scene", label: "Szene ist auf Preview", stateKey: "preview", match: "equalsArg", arg: sceneArg, bgcolor: GREEN, color: WHITE },
      { id: "recording", label: "Aufnahme l\xE4uft", stateKey: "recording", match: "truthy", bgcolor: RED, color: WHITE },
      { id: "streaming", label: "Stream l\xE4uft", stateKey: "streaming", match: "truthy", bgcolor: YELLOW, color: BLACK }
    ]
  },
  // ── Timer ──────────────────────────────────────────────────────────────────
  timer: {
    role: "timer",
    label: "JM Timer",
    port: 8724,
    actions: [
      { id: "start", label: "Start", verb: "start" },
      { id: "stop", label: "Stopp", verb: "stop" },
      { id: "reset", label: "Reset", verb: "reset" },
      { id: "add", label: "Zeit addieren (s)", verb: "add", args: [{ id: "seconds", label: "Sekunden", type: "number", default: 30, min: -3600, max: 3600 }] },
      { id: "set", label: "Zeit setzen (s)", verb: "set", args: [{ id: "seconds", label: "Sekunden", type: "number", default: 300, min: 0, max: 86400 }] },
      { id: "goto", label: "Block anspringen", verb: "goto", args: [{ id: "block", label: "Block (Nr.)", type: "number", default: 1, min: 1, max: 999 }] }
    ],
    variables: [
      { id: "remaining", label: "Restzeit (mm:ss)" },
      { id: "remaining_s", label: "Restzeit (Sekunden)" },
      { id: "running", label: "L\xE4uft (1/0)" },
      { id: "block_label", label: "Aktueller Block" }
    ],
    feedbacks: [
      { id: "running", label: "Timer l\xE4uft", stateKey: "running", match: "truthy", bgcolor: GREEN, color: WHITE },
      { id: "overrun", label: "Timer \xFCberzogen", stateKey: "overrun", match: "truthy", bgcolor: RED, color: WHITE },
      { id: "warning", label: "Timer-Warnung", stateKey: "warning", match: "truthy", bgcolor: YELLOW, color: BLACK }
    ]
  },
  // ── Player (Soundboard/Cues) ────────────────────────────────────────────────
  player: {
    role: "player",
    label: "JM Player",
    port: 8725,
    actions: [
      { id: "go", label: "GO (Standby-Cue feuern)", verb: "go" },
      { id: "stop", label: "Stopp (alle Cues)", verb: "stop" },
      { id: "pause", label: "Pause/Resume", verb: "pause" },
      { id: "panic", label: "Panic (Hard-Stop)", verb: "panic" },
      { id: "cue", label: "Show-Cue feuern", verb: "cue", args: [{ id: "n", label: "Cue (Nr.)", type: "number", default: 1, min: 1, max: 999 }] },
      { id: "standby", label: "Standby setzen", verb: "standby", args: [{ id: "n", label: "Cue (Nr.)", type: "number", default: 1, min: 1, max: 999 }] },
      { id: "next", label: "Standby +1", verb: "next" },
      { id: "prev", label: "Standby \u22121", verb: "prev" },
      { id: "pad", label: "Soundboard-Pad triggern", verb: "pad", args: [{ id: "slot", label: "Pad (Slot)", type: "number", default: 0, min: 0, max: 99 }] },
      { id: "show", label: "Show aufrufen (Name)", verb: "show", args: [{ id: "show", label: "Show-Name (oder DB-Nr.)", type: "string", default: "" }] }
    ],
    variables: [
      { id: "playing", label: "Spielt (1/0)" },
      { id: "paused", label: "Pausiert (1/0)" },
      { id: "standby", label: "Standby-Cue (Nr.)" },
      { id: "standby_label", label: "Standby-Titel" },
      { id: "cues", label: "Anzahl Cues" },
      { id: "playing_count", label: "Laufende Cues" }
    ],
    feedbacks: [
      { id: "playing", label: "Player spielt", stateKey: "playing", match: "truthy", bgcolor: GREEN, color: WHITE },
      { id: "paused", label: "Player pausiert", stateKey: "paused", match: "truthy", bgcolor: YELLOW, color: BLACK },
      { id: "standby_cue", label: "Cue ist auf Standby", stateKey: "standby", match: "equalsArg", arg: { id: "n", label: "Cue (Nr.)", type: "number", default: 1, min: 1, max: 999 }, bgcolor: GREEN, color: WHITE }
    ]
  },
  // ── Titler (Bauchbinden) ────────────────────────────────────────────────────
  titler: {
    role: "titler",
    label: "JM Titler",
    port: 8726,
    actions: [
      { id: "take", label: "Take (On Air)", verb: "take" },
      { id: "clear", label: "Clear (ausblenden)", verb: "clear" },
      { id: "toggle", label: "On Air umschalten", verb: "toggle" },
      {
        id: "template",
        label: "Vorlage w\xE4hlen",
        verb: "template",
        args: [
          {
            id: "kind",
            label: "Vorlage",
            type: "dropdown",
            default: "lowerthird",
            choices: [
              { id: "lowerthird", label: "Bauchbinde" },
              { id: "banner", label: "Banner" },
              { id: "ticker", label: "Ticker" }
            ]
          }
        ]
      }
    ],
    variables: [
      { id: "on_air", label: "On Air (1/0)" },
      { id: "template", label: "Vorlage" },
      { id: "ndi", label: "NDI aktiv (1/0)" },
      { id: "connections", label: "NDI-Empf\xE4nger" }
    ],
    feedbacks: [
      { id: "on_air", label: "CG ist On Air", stateKey: "on_air", match: "truthy", bgcolor: RED, color: WHITE },
      { id: "ndi", label: "NDI l\xE4uft", stateKey: "ndi", match: "truthy", bgcolor: GREEN, color: WHITE }
    ]
  },
  // ── Prompter ────────────────────────────────────────────────────────────────
  prompter: {
    role: "prompter",
    label: "JM Prompter",
    port: 8727,
    actions: [
      { id: "scroll", label: "Scrollen", verb: "scroll", args: [modeArg], toggleKey: "scrolling" },
      { id: "speed", label: "Tempo setzen (Zeilen/s)", verb: "speed", args: [{ id: "value", label: "Tempo", type: "number", default: 2, min: 0.2, max: 6 }] },
      { id: "faster", label: "Schneller", verb: "faster" },
      { id: "slower", label: "Langsamer", verb: "slower" },
      { id: "top", label: "An den Anfang", verb: "top" }
    ],
    variables: [
      { id: "speed", label: "Tempo (Zeilen/s)" },
      { id: "scrolling", label: "Scrollt (1/0)" }
    ],
    feedbacks: [{ id: "scrolling", label: "Prompter scrollt", stateKey: "scrolling", match: "truthy", bgcolor: GREEN, color: WHITE }]
  },
  // ── Presenter ───────────────────────────────────────────────────────────────
  presenter: {
    role: "presenter",
    label: "JM Presenter",
    port: 8728,
    actions: [
      { id: "next", label: "N\xE4chste Folie", verb: "next" },
      { id: "prev", label: "Vorherige Folie", verb: "prev" },
      { id: "goto", label: "Folie anspringen", verb: "goto", args: [{ id: "n", label: "Folie (Nr.)", type: "number", default: 1, min: 1, max: 999 }] },
      { id: "black", label: "Schwarz", verb: "black" },
      { id: "white", label: "Wei\xDF", verb: "white" },
      { id: "live", label: "Live", verb: "live" },
      { id: "stop", label: "Pr\xE4sentation beenden", verb: "stop" },
      {
        id: "open",
        label: "Pr\xE4sentation \xF6ffnen (Pfad)",
        verb: "open",
        args: [{ id: "path", label: "Pfad (.pdf / .pptx / .jmpres / Bild)", type: "string", default: "", picker: "file" }]
      }
    ],
    variables: [
      { id: "slide", label: "Aktuelle Folie" },
      { id: "total", label: "Folien gesamt" },
      { id: "active", label: "Pr\xE4sentation l\xE4uft (1/0)" }
    ],
    feedbacks: [
      { id: "black", label: "Schwarzbild aktiv", stateKey: "black", match: "truthy", bgcolor: BLACK, color: WHITE },
      { id: "white", label: "Wei\xDFbild aktiv", stateKey: "white", match: "truthy", bgcolor: WHITE, color: BLACK },
      { id: "live", label: "Live aktiv", stateKey: "live", match: "truthy", bgcolor: GREEN, color: WHITE }
    ]
  },
  // ── Recorder ────────────────────────────────────────────────────────────────
  recorder: {
    role: "recorder",
    label: "JM Audio Recorder",
    port: 8729,
    actions: [
      { id: "record", label: "Aufnahme", verb: "record", args: [modeArg], toggleKey: "recording" },
      { id: "arm", label: "Eingang \xF6ffnen (Arm)", verb: "arm" },
      { id: "disarm", label: "Eingang schlie\xDFen", verb: "disarm" }
    ],
    variables: [
      { id: "recording", label: "Aufnahme (1/0)" },
      { id: "armed", label: "Bereit/Armed (1/0)" },
      { id: "status", label: "Status (idle/armed/recording)" },
      { id: "duration", label: "Dauer (Sek.)" }
    ],
    feedbacks: [
      { id: "recording", label: "Aufnahme l\xE4uft", stateKey: "recording", match: "truthy", bgcolor: RED, color: WHITE },
      { id: "armed", label: "Eingang bereit", stateKey: "armed", match: "truthy", bgcolor: YELLOW, color: BLACK }
    ]
  },
  // ── DAW (Transport, minimal) ────────────────────────────────────────────────
  daw: {
    role: "daw",
    label: "JM DAW",
    port: 8730,
    actions: [
      { id: "play", label: "Play", verb: "play" },
      { id: "stop", label: "Stopp", verb: "stop" },
      { id: "toggle", label: "Play/Stop umschalten", verb: "toggle" },
      { id: "rec", label: "Aufnahme", verb: "rec", args: [modeArg], toggleKey: "recording" }
    ],
    variables: [
      { id: "playing", label: "Spielt (1/0)" },
      { id: "recording", label: "Aufnahme (1/0)" }
    ],
    feedbacks: [
      { id: "playing", label: "Wiedergabe l\xE4uft", stateKey: "playing", match: "truthy", bgcolor: GREEN, color: WHITE },
      { id: "recording", label: "Aufnahme l\xE4uft", stateKey: "recording", match: "truthy", bgcolor: RED, color: WHITE }
    ]
  },
  // ── Rundown (Ablaufregie/Conductor) ─────────────────────────────────────────
  rundown: {
    role: "rundown",
    label: "JM Rundown",
    port: 8731,
    actions: [
      { id: "go", label: "GO (Zeile feuern + weiter)", verb: "go" },
      { id: "next", label: "Weiter (ohne feuern)", verb: "next" },
      { id: "prev", label: "Zur\xFCck", verb: "prev" },
      { id: "goto", label: "Zeile anspringen", verb: "goto", args: [{ id: "n", label: "Zeile (Nr.)", type: "number", default: 1, min: 1, max: 999 }] }
    ],
    variables: [
      { id: "cue", label: "Scharfe Zeile (Nr.)" },
      { id: "total", label: "Zeilen gesamt" },
      { id: "label", label: "Scharfe Zeile (Titel)" }
    ],
    feedbacks: []
  },
  // ── Q&A (Wortmeldungs-/Pressekonferenz-Queue) ───────────────────────────────
  qa: {
    role: "qa",
    label: "JM Q&A",
    port: 8733,
    actions: [
      { id: "next", label: "N\xE4chste Wortmeldung (ans Wort)", verb: "next" },
      { id: "end", label: "Sprecher beenden", verb: "end" },
      {
        id: "extend",
        label: "Redezeit verl\xE4ngern (s)",
        verb: "extend",
        args: [{ id: "seconds", label: "Sekunden", type: "number", default: 30, min: 5, max: 600 }]
      },
      { id: "clear", label: "Erledigte entfernen", verb: "clear" }
    ],
    variables: [
      { id: "active", label: "Aktiver Sprecher" },
      { id: "waiting", label: "Wartende Wortmeldungen" },
      { id: "total", label: "Eintr\xE4ge gesamt" },
      { id: "live", label: "Sprecher aktiv (1/0)" },
      { id: "remote", label: "Saal-Einreichung (1/0)" }
    ],
    feedbacks: [
      { id: "live", label: "Sprecher am Wort", stateKey: "live", match: "truthy", bgcolor: GREEN, color: WHITE },
      { id: "remote", label: "Saal-Einreichung an", stateKey: "remote", match: "truthy", bgcolor: YELLOW, color: BLACK }
    ]
  },
  // ── Battle (BattleRap-Toolkit) ──────────────────────────────────────────────
  battle: {
    role: "battle",
    label: "JM Battle",
    port: 8734,
    actions: [
      { id: "next", label: "N\xE4chste Runde", verb: "next" },
      { id: "prev", label: "Vorherige Runde", verb: "prev" },
      {
        id: "win",
        label: "Jury-Entscheid (aktuelle Runde)",
        verb: "win",
        args: [
          {
            id: "side",
            label: "Sieger",
            type: "dropdown",
            default: "a",
            choices: [
              { id: "a", label: "Ecke A" },
              { id: "b", label: "Ecke B" },
              { id: "tie", label: "Unentschieden" }
            ]
          }
        ]
      },
      { id: "voting", label: "Publikums-Voting", verb: "voting", args: [modeArg], toggleKey: "voting" },
      { id: "vs", label: "VS-Bauchbinde (Titler)", verb: "vs", args: [modeArg], toggleKey: "live" },
      { id: "replay", label: "Instant-Replay-Clip", verb: "replay" },
      { id: "reset", label: "Battle zur\xFCcksetzen", verb: "reset" }
    ],
    variables: [
      { id: "round", label: "Aktuelle Runde" },
      { id: "total", label: "Runden gesamt" },
      { id: "wins_a", label: "Rundensiege A" },
      { id: "wins_b", label: "Rundensiege B" },
      { id: "votes_a", label: "Stimmen A" },
      { id: "votes_b", label: "Stimmen B" },
      { id: "voting", label: "Voting offen (1/0)" },
      { id: "live", label: "VS on air (1/0)" },
      { id: "leader", label: "Sieger (A/B/-)" }
    ],
    feedbacks: [
      { id: "live", label: "VS-Bauchbinde on air", stateKey: "live", match: "truthy", bgcolor: RED, color: WHITE },
      { id: "voting", label: "Voting offen", stateKey: "voting", match: "truthy", bgcolor: YELLOW, color: BLACK }
    ]
  },
  // ── Caption (Live-Untertitel) ────────────────────────────────────────────────
  caption: {
    role: "caption",
    label: "JM Caption",
    port: 8732,
    actions: [
      { id: "transcribe", label: "Transkription", verb: "transcribe", args: [modeArg], toggleKey: "running" },
      { id: "hold", label: "Hold (Ausgabe einfrieren)", verb: "hold", args: [modeArg], toggleKey: "hold" },
      { id: "ndi", label: "NDI-Ausgabe", verb: "ndi", args: [modeArg], toggleKey: "ndi" },
      { id: "clear", label: "Untertitel leeren", verb: "clear" }
    ],
    variables: [
      { id: "running", label: "Transkription l\xE4uft (1/0)" },
      { id: "hold", label: "Hold aktiv (1/0)" },
      { id: "ndi", label: "NDI aktiv (1/0)" },
      { id: "connections", label: "NDI-Empf\xE4nger" },
      { id: "lines", label: "Zeilen im Verlauf" }
    ],
    feedbacks: [
      { id: "running", label: "Transkription l\xE4uft", stateKey: "running", match: "truthy", bgcolor: GREEN, color: WHITE },
      { id: "hold", label: "Hold aktiv", stateKey: "hold", match: "truthy", bgcolor: YELLOW, color: BLACK },
      { id: "ndi", label: "NDI l\xE4uft", stateKey: "ndi", match: "truthy", bgcolor: GREEN, color: WHITE }
    ]
  },
  // ── Studio Control Gateway (zentral-auditiert: ATEM / OBS / TriCaster) ───────
  // studio-control ist ein Geräte-Hub. Das Gateway exponiert die PRIMÄR-Instanz
  // je Gerätetyp (erste konfigurierte) an Companion; jeder Befehl läuft durch das
  // Audit-Log. Verben sind typ-präfixiert (atem_/obs_/tricaster_), da eine Rolle
  // mehrere Gerätetypen bündelt. Abgedeckt: ATEM, OBS, TriCaster, PTZ, Audio, Licht.
  studio: {
    role: "studio",
    label: "JM Studio Control",
    port: 8735,
    actions: [
      // ATEM (Hardware-Mischer, M/E 1)
      { id: "atem_program", label: "ATEM: Program-Eingang", verb: "atem_program", args: [atemInputArg] },
      { id: "atem_preview", label: "ATEM: Preview-Eingang", verb: "atem_preview", args: [atemInputArg] },
      { id: "atem_cut", label: "ATEM: Cut", verb: "atem_cut" },
      { id: "atem_auto", label: "ATEM: Auto (\xDCbergang)", verb: "atem_auto" },
      { id: "atem_ftb", label: "ATEM: Fade to Black", verb: "atem_ftb" },
      { id: "atem_record", label: "ATEM: Aufnahme", verb: "atem_record", args: [modeArg], toggleKey: "atem_rec" },
      { id: "atem_stream", label: "ATEM: Stream", verb: "atem_stream", args: [modeArg], toggleKey: "atem_stream" },
      // OBS (WebSocket-Bridge)
      { id: "obs_scene", label: "OBS: Szene w\xE4hlen (Nr.)", verb: "obs_scene", args: [sceneArg] },
      { id: "obs_record", label: "OBS: Aufnahme", verb: "obs_record", args: [modeArg], toggleKey: "obs_rec" },
      { id: "obs_stream", label: "OBS: Stream", verb: "obs_stream", args: [modeArg], toggleKey: "obs_stream" },
      // TriCaster (LiveControl-Shortcut/Makro; Name muss ein einzelnes Token sein)
      { id: "tricaster_shortcut", label: "TriCaster: Shortcut/Makro", verb: "tricaster_shortcut", args: [{ id: "name", label: "Shortcut-Name (z. B. main_take)", type: "string", default: "main_take" }] },
      // PTZ (Panasonic AW)
      { id: "ptz_preset", label: "PTZ: Preset abrufen", verb: "ptz_preset", args: [{ id: "preset", label: "Preset (Nr.)", type: "number", default: 1, min: 0, max: 99 }] },
      { id: "ptz_power", label: "PTZ: Power", verb: "ptz_power", args: [modeArg], toggleKey: "ptz_power" },
      // Audio (Mischpult)
      { id: "audio_mute", label: "Audio: Kanal stumm", verb: "audio_mute", args: [{ id: "channel", label: "Kanal (Nr.)", type: "number", default: 1, min: 1, max: 64 }, { id: "state", label: "Zustand", type: "dropdown", default: "on", choices: [{ id: "on", label: "Mute an" }, { id: "off", label: "Mute aus" }] }] },
      { id: "audio_fader", label: "Audio: Fader (dB)", verb: "audio_fader", args: [{ id: "channel", label: "Kanal (Nr.)", type: "number", default: 1, min: 1, max: 64 }, { id: "db", label: "Pegel (dB)", type: "number", default: 0, min: -60, max: 10 }] },
      // Licht (Art-Net)
      { id: "lighting_blackout", label: "Licht: Blackout", verb: "lighting_blackout", args: [modeArg], toggleKey: "lighting_blackout" }
    ],
    variables: [
      { id: "atem", label: "ATEM verbunden (1/0)" },
      { id: "atem_name", label: "ATEM-Modell" },
      { id: "atem_pgm", label: "ATEM Program (Nr.)" },
      { id: "atem_pvw", label: "ATEM Preview (Nr.)" },
      { id: "atem_rec", label: "ATEM Aufnahme (1/0)" },
      { id: "atem_stream", label: "ATEM Stream (1/0)" },
      { id: "obs", label: "OBS verbunden (1/0)" },
      { id: "obs_scene", label: "OBS Szene (Nr.)" },
      { id: "obs_scene_name", label: "OBS Szene (Name)" },
      { id: "obs_rec", label: "OBS Aufnahme (1/0)" },
      { id: "obs_stream", label: "OBS Stream (1/0)" },
      { id: "tricaster", label: "TriCaster verbunden (1/0)" },
      { id: "tricaster_name", label: "TriCaster" },
      { id: "ptz", label: "PTZ verbunden (1/0)" },
      { id: "ptz_name", label: "PTZ-Kamera" },
      { id: "ptz_power", label: "PTZ Power (1/0)" },
      { id: "audio", label: "Audio verbunden (1/0)" },
      { id: "audio_name", label: "Audiopult" },
      { id: "lighting", label: "Licht konfiguriert (1/0)" },
      { id: "lighting_blackout", label: "Blackout aktiv (1/0)" }
    ],
    feedbacks: [
      { id: "atem_pgm", label: "ATEM: Eingang auf Program", stateKey: "atem_pgm", match: "equalsArg", arg: atemInputArg, bgcolor: RED, color: WHITE },
      { id: "atem_pvw", label: "ATEM: Eingang auf Preview", stateKey: "atem_pvw", match: "equalsArg", arg: atemInputArg, bgcolor: GREEN, color: WHITE },
      { id: "atem_rec", label: "ATEM: Aufnahme l\xE4uft", stateKey: "atem_rec", match: "truthy", bgcolor: RED, color: WHITE },
      { id: "atem_stream", label: "ATEM: Stream l\xE4uft", stateKey: "atem_stream", match: "truthy", bgcolor: YELLOW, color: BLACK },
      { id: "obs_scene", label: "OBS: Szene aktiv", stateKey: "obs_scene", match: "equalsArg", arg: sceneArg, bgcolor: GREEN, color: WHITE },
      { id: "obs_rec", label: "OBS: Aufnahme l\xE4uft", stateKey: "obs_rec", match: "truthy", bgcolor: RED, color: WHITE },
      { id: "obs_stream", label: "OBS: Stream l\xE4uft", stateKey: "obs_stream", match: "truthy", bgcolor: YELLOW, color: BLACK },
      { id: "ptz_power", label: "PTZ: Power an", stateKey: "ptz_power", match: "truthy", bgcolor: GREEN, color: WHITE },
      { id: "lighting_blackout", label: "Licht: Blackout aktiv", stateKey: "lighting_blackout", match: "truthy", bgcolor: RED, color: WHITE }
    ]
  }
};
var KNOWN_ROLES = Object.keys(CAPABILITIES);
export {
  AUTH_FAIL,
  AUTH_OK,
  AUTH_PROTO,
  CAPABILITIES,
  DEFAULT_CONTROL_PORT,
  KNOWN_ROLES,
  createLineBuffer,
  formatAuth,
  formatAuthReq,
  formatState,
  formatSuiteCommand,
  formatSuiteState,
  isAuthFail,
  isAuthOk,
  parseAuth,
  parseAuthReq,
  parseCommand,
  parseState,
  parseSuiteCommand,
  parseSuiteState,
  switcherStateFromSuite,
  switcherStateToSuite
};
