# `@jm/suite-control-protocol`

> **Kurzfassung:** Das geteilte, suite-weite TCP-Zeilenprotokoll zur
> Fernsteuerung **aller** JM-Tools (Switcher, Timer, Player, Titler, Prompter,
> Presenter, Recorder, DAW …) — z. B. durch das Bitfocus-Companion-Modul,
> das Stage Display oder die kommende Ablaufregie (Rundown). Verallgemeinert das
> ursprüngliche, switcher-spezifische `@jm/companion-protocol` und bleibt voll
> rückwärtskompatibel.

Dieses Paket ist das **Fundament der Suite-Steuerebene** (Roadmap Welle 1). Es
liefert drei Schichten in einem Paket, sauber getrennt, damit die pure Schicht
ohne node/electron in das standalone baubare Companion-Modul kopiert werden kann:

| Import | Schicht | Verwendung |
|---|---|---|
| `@jm/suite-control-protocol` | **pur** (Parser, Formatter, Typen, Legacy-Shims, Capabilities-Re-Exports) | überall; wird ins Companion-Modul kopiert |
| `@jm/suite-control-protocol/server` | **node** (`SuiteControlServer`) | Main-Prozess eines Tools, das fernsteuerbar sein soll |
| `@jm/suite-control-protocol/client` | **node** (`SuiteControlClient`) | Main-Prozess eines Tally-/Status-Konsumenten |
| `@jm/suite-control-protocol/capabilities` | **pur** (`CAPABILITIES`-Tabelle) | Companion-Modul + maschinenlesbare Doku |

---

## 1. Protokoll

Zeilenbasiert, ASCII, `\n`-terminiert. Ein Tool öffnet einen TCP-Server; Clients
senden Befehle und empfangen Status. Szenen/Cues sind 1-basiert (wie in der UI).

### Befehle (Client → Tool)

```
<NAMESPACE> <VERB> [args…]
```

`<NAMESPACE>` ist die **Rolle** des Tools (`TIMER`, `PLAYER`, `TITLER`, …),
`<VERB>` die Aktion. Beispiele:

```
TIMER START
TIMER ADD 30
PLAYER CUE 3
TITLER TAKE 2
TITLER CLEAR
PROMPTER SCROLL ON
PRESENTER GOTO 5
RECORDER RECORD START
STATE?                     ← Status anfordern (namespace-frei)
```

### Status (Tool → Client)

Bei jeder Zustandsänderung, beim Verbindungsaufbau und als Antwort auf `STATE?`:

```
STATE ns=<rolle> <key>=<value> …
```

Beliebige `key=value`-Paare; Booleans werden als `1`/`0` serialisiert. Beispiele:

```
STATE ns=timer running=1 remaining_s=270 block_label=Block-A
STATE ns=switcher program=2 preview=1 recording=1 streaming=0 scenes=3
STATE ns=titler on_air=1 active=2 active_label=Max-Mustermann
STATE ns=connect onair=1 active_label=Anna%20Maria%20Beispiel
```

**Text-Werte sind kodiert:** `formatSuiteState` schreibt in Text-Werten jeden
Leerraum (Leerzeichen, Tab, Zeilenumbruch, geschütztes Leerzeichen …) und `%`
als `%XX` (UTF-8-Bytes, `kodiereStateWert`); `parseSuiteState` dekodiert
(`dekodiereStateWert`). So kommt „Anna Maria Beispiel“ ganz an, statt am ersten
Leerzeichen abzubrechen. Zahlen, Booleans und Schlüssel bleiben unkodiert.
Zeilen älterer Sender ohne Kodierung liest der Parser unverändert; eine
ungültige `%`-Folge (`100%`) bleibt wörtlich stehen. Ein Leser, der noch den
alten Parser bündelt, zeigt `Anna%20Maria` – erst sein nächstes Release
dekodiert. Befehlszeilen werden **nicht** kodiert: Argumente trennt der Parser
wie bisher am Leerraum (`CONNECT ZOOM_LOAD Anna Maria` → `['Anna', 'Maria']`).

---

## 2. Rückwärtskompatibilität (wichtig)

Das ursprüngliche **Switcher-Protokoll** läuft unverändert weiter:

- **Befehle ohne Namespace** werden weiter akzeptiert. Erkennt der Parser ein
  bekanntes Switcher-Verb (`PREVIEW PROGRAM CUT AUTO RECORD STREAM`), gilt
  implizit `ns=switcher`. `PREVIEW 2`, `CUT`, `RECORD START` funktionieren wie
  bisher.
- **Das alte Companion-Modul** (`packages/companion-jm-switcher`) liest die
  STATE-Zeile per Schlüssel (`program`, `preview`, …) und **ignoriert** das neue
  `ns=switcher`-Token — es bleibt voll funktionsfähig.
- Die Legacy-Funktionen `parseCommand` / `formatState` / `parseState` und die
  Typen `ControlCommand` / `SwitcherStateMsg` sind **byte-/semantisch identisch**
  erhalten. `@jm/companion-protocol` ist nur noch ein dünner Re-Export dieses
  Pakets, sodass bestehende Importe unverändert weiterlaufen.

Der Selbsttest (`npm run selftest`) deckt diese Rückwärtskompatibilität explizit
ab (u. a. „Legacy parseState liest ns=switcher-Zeile korrekt").

---

## 3. API

### Pure Schicht (`@jm/suite-control-protocol`)

```ts
import {
  parseSuiteCommand,   // (line) → { ns, verb, args } | null
  formatSuiteCommand,  // ({ ns, verb, args }) → "NS VERB args\n"
  formatSuiteState,    // ({ ns, kv }) → "STATE ns=… k=v …\n"  (bool → 1/0, Text kodiert)
  parseSuiteState,     // (line) → { ns, kv } | null              (Text dekodiert)
  kodiereStateWert,    // (text) → Leerraum und % als %XX
  dekodiereStateWert,  // (text) → %XX-Folgen zurück; ungültige bleiben wörtlich
  createLineBuffer,    // (onLine) → (chunk) => void  (TCP-Zeilenpuffer)
  // Legacy-Switcher-Brücke:
  parseCommand, formatState, parseState,
  switcherStateToSuite, switcherStateFromSuite,
  type SuiteCommand, type SuiteState, type SwitcherStateMsg, type ControlCommand,
} from '@jm/suite-control-protocol';
```

### Server (`@jm/suite-control-protocol/server`) — im fernsteuerbaren Tool

```ts
import { SuiteControlServer } from '@jm/suite-control-protocol/server';

const server = new SuiteControlServer({
  role: 'timer',
  appId: 'jm-timer',
  getState: () => ({ ns: 'timer', kv: { running, remaining_s, block_label } }),
  onCommand: (cmd, ctx) => {
    // cmd: { ns:'timer', verb:'start'|'add'|…, args:[…] }
    // STATE? beantwortet der Server selbst.
    dispatch(cmd);            // in die App-Engine routen
    // ctx.reply('…')         // optional direkt an genau diesen Client antworten
  },
  onStatus: (s) => updateUi(s), // { running, port, clients }
});
await server.start(8724);     // mDNS-Annoncierung automatisch (advertiseService)
server.pushState({ ns: 'timer', kv: { running: true, remaining_s: 269 } }); // broadcast
server.stop();
```

Der Server koppelt die **mDNS-Annoncierung** (`@jm/discovery`) an seinen
Lebenszyklus: nur solange er lauscht, ist das Tool im LAN auffindbar. Damit
findet das Companion-Modul (Auto-Discovery) das Tool ohne IP-Eingabe.

### Client (`@jm/suite-control-protocol/client`) — im Status-Konsumenten

```ts
import { SuiteControlClient } from '@jm/suite-control-protocol/client';

const client = new SuiteControlClient({
  onState: (st) => render(st),              // { ns, kv } je STATE-Zeile
  onConnectedChange: (ok) => setOnline(ok), // Auto-Reconnect (2 s)
});
client.connect(host, port);
client.send('TIMER START');                 // optional Befehle senden
client.disconnect();
```

---

## 4. Capabilities-Tabelle

`@jm/suite-control-protocol/capabilities` exportiert `CAPABILITIES` — eine rein
deklarative Tabelle je Rolle (Actions, Feedbacks, Variablen, Default-Port). Das
generische „JM Suite"-Companion-Modul iteriert sie und baut daraus
`setActionDefinitions` / `setFeedbackDefinitions` / `setVariableDefinitions`. Sie
ist zugleich die maschinenlesbare Referenz, welche Befehle/Status ein Tool
spricht. Enthält Seeds für `switcher, timer, player, titler, prompter,
presenter, recorder, daw`.

> Der `port` je Rolle ist nur ein **Fallback** für die manuelle Companion-
> Konfiguration. Im Regelbetrieb liefert mDNS den tatsächlich gebundenen Port.

---

## 5. Verpackung (Packaging)

Wie `@jm/discovery` wird auch dieses Paket **in den Main-Bundle gebündelt**
(gepackte Apps liefern kein `node_modules`). In jeder App, die es nutzt, muss
`@jm/suite-control-protocol` in der `electron.vite.config.ts` in der
`exclude`-Liste von `externalizeDepsPlugin` stehen. Die Subpfade (`/server`,
`/client`) werden dadurch automatisch mitgebündelt (electron-vite entfernt
ausgeschlossene Pakete inkl. ihrer `…/…`-Subpfade aus der `external`-Liste).

---

## 6. Selbsttest

```
npm run selftest -w @jm/suite-control-protocol
```

Prüft Grammatik (namespaced + Legacy), STATE-Round-Trips, die Switcher-Brücke
und — als Kernpunkt — die Rückwärtskompatibilität des STATE-Formats.

---

## Stand

- **Erledigt (Welle 1.0/1.1):** Paket angelegt; `@jm/companion-protocol` auf
  Re-Export umgestellt; **Switcher** (`control-server.ts`) und **Stage Display**
  (`switcher-client.ts`) nutzen `SuiteControlServer`/`SuiteControlClient` — ohne
  Verhaltensänderung; Selftest + Typecheck + Build aller betroffenen Teile grün.
- **Als Nächstes (Welle 1.2–1.6):** Timer, Player, Titler, Prompter, Presenter,
  Recorder, DAW als Steuerserver nachrüsten; generisches Companion-Modul
  `packages/companion-jm-suite` (manuell → mDNS-Auto-Discovery).

Architektur, Companion-Anbindung und Migrationsweg: siehe
[`docs/suite-control-plane.md`](../../docs/suite-control-plane.md).
