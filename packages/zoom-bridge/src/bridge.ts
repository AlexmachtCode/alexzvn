// Startet zoom-bridge.exe, liest ihre Ereignisse, fuehrt die Zustandsmaschine
// und wacht ueber den Beitritt.
//
// `exePath` ist einstellbar. Genau deshalb ist diese Schicht ohne SDK pruefbar:
// die Selbsttests lassen sie gegen test/fake-bridge.mjs laufen.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LineSplitter,
  enrich,
  parseWireEvent,
  serializeCommand,
  type BridgeEvent,
  type Command,
  type WireEvent,
} from './protocol.ts';
import { initialSession, isSettled, reduce, type Session } from './state.ts';

export interface BridgeOptions {
  exePath?: string;
  /** Zusaetzliche Argumente - die Selbsttests reichen hier den Pfad der Attrappe durch. */
  exeArgs?: string[];
  env?: Record<string, string>;
  /** Wie lange nach `join` auf einen ruhenden Zustand gewartet wird. */
  joinTimeoutMs?: number;
  onEvent?: (ev: BridgeEvent, s: Session) => void;
  /** Klartext der Bridge (stderr). Vorgabe: nach console.error. */
  onLog?: (line: string) => void;
}

const here = dirname(fileURLToPath(import.meta.url));

/** Wo zoom-bridge.exe nach einem Bau liegt. */
export function binPath(): string {
  return join(here, '..', 'build', 'Release', 'zoom-bridge.exe');
}

export class Bridge {
  private child: ChildProcessWithoutNullStreams | null = null;
  private splitter = new LineSplitter();
  private errSplitter = new LineSplitter();
  private state: Session = initialSession();
  private joinTimer: NodeJS.Timeout | null = null;
  private exitCode: Promise<number> | null = null;
  // Kein TS-Konstruktorparameter-Feld (`constructor(private readonly opts...)`):
  // Node's --experimental-strip-types (node:internal/modules/typescript) ist
  // reines Typ-Entfernen, keine Umschreibung - Parameter-Properties brauchen
  // aber generierten Code ("this.opts = opts;") und werden dort ausdruecklich
  // NICHT unterstuetzt (ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX, gemessen). Deshalb
  // Feld und Zuweisung von Hand.
  private readonly opts: BridgeOptions;

  constructor(opts: BridgeOptions = {}) {
    this.opts = opts;
  }

  get session(): Session {
    return this.state;
  }

  async start(): Promise<void> {
    const exe = this.opts.exePath ?? binPath();
    const args = this.opts.exeArgs ?? [];
    const child = spawn(exe, args, {
      env: { ...process.env, ...this.opts.env },
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child = child;

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      for (const line of this.splitter.push(chunk)) this.handleLine(line);
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      // stderr ist Klartext fuer Menschen und geht NICHT durch den Ereignisweg.
      for (const line of this.errSplitter.push(chunk)) {
        (this.opts.onLog ?? ((l: string) => console.error(`[zoom-bridge] ${l}`)))(line);
      }
    });

    this.exitCode = new Promise<number>((resolve) => {
      child.on('exit', (code) => resolve(code ?? 0));
    });

    await new Promise<void>((resolve, reject) => {
      child.once('spawn', () => resolve());
      child.once('error', (e) => reject(e));
    });
  }

  send(cmd: Command): void {
    if (!this.child) throw new Error('Bridge laeuft nicht.');
    if (cmd.cmd === 'join') this.armWatchdog();
    this.child.stdin.write(serializeCommand(cmd));
  }

  /**
   * ACHTUNG: Der Wachhund laeuft NICHT gegen "irgendeine Statusaenderung": `connecting`
   * kommt sofort, und genau dort hing der Stage-0-Spike 90 Sekunden. Er laeuft
   * gegen das Erreichen eines RUHENDEN Zustands (isSettled).
   */
  private armWatchdog(): void {
    this.clearWatchdog();
    const ms = this.opts.joinTimeoutMs ?? 30_000;
    this.joinTimer = setTimeout(() => {
      this.joinTimer = null;
      if (isSettled(this.state.meeting)) return;
      // `joinTimeout`, nicht `timeout`: die Bridge kennt eine zweite Zeitueberschreitung
      // (die Anmeldung), und zwei verschiedene Ursachen duerfen nie denselben Namen
      // bekommen. Siehe OWN_ERROR_NAMES in protocol.ts.
      //
      // enrich() lesen: dispatch() erwartet ein bereits ANGEREICHERTES Ereignis
      // (name/result/explain gesetzt) - handleLine() haelt sich unten an genau
      // diese Regel (dispatch(enrich(wire))). Ein selbst erzeugtes Ereignis ist
      // keine Ausnahme: ohne enrich() haette es kein "name"-Feld, und die
      // Zusicherung, die genau DAS prueft, waere still gruen geblieben, weil
      // "kein name" hier nie vorkommen sollte - siehe task-10-report.md.
      this.dispatch(enrich({ ev: 'error', where: 'join', code: 'joinTimeout', lastStatus: this.state.meeting } as WireEvent));
    }, ms);
    this.joinTimer.unref?.();
  }

  private clearWatchdog(): void {
    if (this.joinTimer) clearTimeout(this.joinTimer);
    this.joinTimer = null;
  }

  private handleLine(line: string): void {
    const wire = parseWireEvent(line);
    if (wire === null) {
      // Eine kaputte Zeile ist Rauschen, kein Abbruch. Sie wird gemeldet, damit
      // sie nicht unbemerkt bleibt, und dann uebersprungen.
      (this.opts.onLog ?? ((l: string) => console.error(`[zoom-bridge] ${l}`)))(`unlesbare Zeile: ${line}`);
      return;
    }
    this.dispatch(enrich(wire));
  }

  private dispatch(ev: BridgeEvent): void {
    if (ev.ev === 'status' && isSettled((ev as { status: Session['meeting'] }).status)) this.clearWatchdog();
    this.state = reduce(this.state, ev);
    this.opts.onEvent?.(ev, this.state);
  }

  /** Wartet, bis `pred` zutrifft. Wirft bei Zeitueberschreitung. */
  async waitFor(pred: (s: Session) => boolean, ms: number): Promise<void> {
    const deadline = Date.now() + ms;
    while (!pred(this.state)) {
      if (Date.now() > deadline) throw new Error('Zeitueberschreitung beim Warten auf einen Zustand.');
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  async stop(): Promise<number> {
    this.clearWatchdog();
    if (!this.child) return 0;
    try {
      this.child.stdin.write(serializeCommand({ cmd: 'quit' }));
      this.child.stdin.end();
    } catch {
      /* der Prozess ist schon weg */
    }
    const code = await Promise.race([
      this.exitCode ?? Promise.resolve(0),
      // Endet die Bridge nicht von selbst, wird sie beendet - eine Bridge, die
      // in einem fremden Meeting sitzen bleibt, ist schlimmer als ein harter Abbruch.
      new Promise<number>((r) => setTimeout(() => { this.child?.kill(); r(-1); }, 8000)),
    ]);
    this.child = null;
    return code;
  }
}
