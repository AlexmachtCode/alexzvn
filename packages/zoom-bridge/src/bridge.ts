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
  /**
   * Diese Variablen werden aus der ererbten Umgebung ENTFERNT, bevor das Kind
   * startet - angewendet NACH dem Merge mit `process.env` in `start()`.
   * GEMESSEN, warum das ein eigenes Feld braucht statt eines Vorschlags wie
   * `env: this.opts.env ?? process.env`: eine Variable, die im uebergebenen
   * `env`-Objekt bloss FEHLT, ist fuer den Merge `{ ...process.env,
   * ...this.opts.env }` unsichtbar - `process.env` darunter liefert sie
   * trotzdem wieder. Eine Abwesenheit kann ein Merge nicht sehen, eine Liste
   * schon.
   */
  envRemove?: string[];
  /** Wie lange nach `join` auf einen ruhenden Zustand gewartet wird. */
  joinTimeoutMs?: number;
  /** Wie lange stop() auf ein von selbst endendes Kind wartet, bevor kill() faellt. Vorgabe 8000. */
  killTimeoutMs?: number;
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
  // Trennt "'error' waehrend des Starts" von "'error' NACH einem erfolgreichen
  // Start": nur Letzteres ist in dieser Bruecke killFailed. Ohne diese
  // Unterscheidung wuerde eine gescheiterte spawn() faelschlich als
  // fehlgeschlagenes kill() gemeldet - zwei verschiedene Ursachen, die sonst
  // denselben Namen bekaemen. Der Spawn-Fehler selbst bleibt unveraendert
  // Sache des once('error', reject) unten (eigene, hier nicht angefasste
  // Baustelle - siehe task-10-report.md, "Bedenken").
  private spawned = false;
  // Das laufende stop()-Versprechen, waehrend ein Abbau IN ARBEIT ist - nicht
  // "wurde je gerufen". Ein zweiter, GLEICHZEITIGER stop()-Aufruf bekommt
  // dasselbe Versprechen zurueck, statt selbst noch einmal in child.stdin zu
  // schreiben (siehe stop() unten, Nachbesserung 2). Wird im finally-Zweig
  // von stop() wieder auf null gesetzt, sobald der Abbau abgeschlossen ist -
  // sonst wuerde ein SPAETERER, SEQUENTIELLER stop()-Aufruf faelschlich das
  // alte (schon aufgeloeste) Versprechen zurueckliefern, statt ueber die
  // bestehende `if (!this.child) return 0;`-Kurzschluss-Pruefung zu laufen.
  private stopPromise: Promise<number> | null = null;
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

  /**
   * ACHTUNG (Abschluss-Sichtung, Punkt H2): Wiedereintrittsschutz, derselbe
   * Grundsatz wie stopPromise in stop() (Nachbesserung 2 zu Task 10), nur
   * fuer den START statt fuer den ABBAU. Ohne ihn ueberschreibt ein zweiter
   * start()-Aufruf this.child kommentarlos: das ERSTE Kind verliert seine
   * einzige Referenz, stop() erreicht es danach nie mehr - es sitzt im
   * Meeting, bis der Wirtsprozess stirbt. Die Pruefung steht bewusst GANZ
   * OBEN, VOR jedem await: `this.child = child;` unten passiert SYNCHRON,
   * bevor diese Funktion ihren ersten await erreicht (derselbe Grund, aus
   * dem stopPromise in stop() zwei GLEICHZEITIGE Aufrufe faengt) - ein throw
   * hier fasst darum auch zwei GLEICHZEITIGE start()-Aufrufe, nicht nur
   * sequentielle.
   */
  async start(): Promise<void> {
    if (this.child) throw new Error('Bridge laeuft bereits - start() darf nicht zweimal gerufen werden.');

    const exe = this.opts.exePath ?? binPath();
    const args = this.opts.exeArgs ?? [];
    // Reihenfolge ist tragend: erst der ganz normale Merge (Teil-Umgebungen wie
    // { FAKE_SCRIPT: 'join' } bleiben dadurch mit PATH & Co. versorgt), DANACH
    // envRemove auf das FERTIGE Objekt angewendet - eine bloss fehlende Variable
    // in this.opts.env waere fuer den Merge selbst unsichtbar, siehe Kommentar an
    // envRemove in BridgeOptions.
    const env: NodeJS.ProcessEnv = { ...process.env, ...this.opts.env };
    for (const key of this.opts.envRemove ?? []) delete env[key];
    const child = spawn(exe, args, {
      env,
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

    // child.stdin ist ein eigener Writable-Strom mit eigenem 'error' - ohne
    // Lauscher stuerzt der GESAMTE Wirtsprozess ab (Node wirft 'error' ohne
    // Listener synchron weiter), nicht nur die Bruecke. GEMESSEN: ein write()
    // NACH end() wirft NICHT synchron (kein try/catch faengt es), sondern
    // loest asynchron genau dieses 'error' aus (ERR_STREAM_WRITE_AFTER_END) -
    // exakt der Fall aus zwei gleichzeitigen stop()-Aufrufen, siehe dort. Auch
    // mit dem Wiedereintritts-Schutz in stop() bleibt EPIPE (das Kind stirbt
    // mitten im Schreiben) ein zweiter, unabhaengiger Weg zum selben
    // Symptom - ein Lauscher, der nur den bekannten Weg abdeckt, liesse den
    // unbekannten offen.
    child.stdin.on('error', (e) => this.reportStdinError(e));

    this.exitCode = new Promise<number>((resolve) => {
      child.on('exit', (code, signal) => {
        const exitCode = code ?? 0;
        // Abschluss-Sichtung, Schluss-Pruefung MINOR 4: Node meldet bei
        // einem per Signal beendeten Kind (z. B. kill()) `code === null,
        // signal !== null` - `code ?? 0` allein macht daraus eine Meldung
        // "exitCode=0", dieselbe Zahl, die im gesamten Projekt sonst "sauber
        // beendet" heisst. Fuer die reine Zahl `exitCode` (siehe unten,
        // `resolve()`) bleibt `0` als Platzhalter unveraendert - NUR der
        // Text unterscheidet jetzt: bei `code === null` wird das Signal
        // genannt, sonst der Rueckgabewert.
        const howEnded = code === null ? `Signal=${signal ?? '(unbekannt)'}` : `exitCode=${exitCode}`;
        // Abschluss-Sichtung, Schluss-Pruefung IMPORTANT 1 (Punkt E griff auf
        // dem KILL-Weg falsch): `this.stopPromise === null` allein reicht
        // NICHT. GEMESSEN (Attrappe `stuck`, killTimeoutMs klein): im
        // kill()-Zweig von doStop() loest `resolve(-1)` das `Promise.race`
        // SYNCHRON auf, `this.child = null` und `stopPromise = null` (im
        // finally von stop()) laufen darum ab, BEVOR das ECHTE `exit`-
        // Ereignis dieses Kindes eintrifft - dieser Rueckruf saehe dann
        // `stopPromise === null` und meldete EXITED_UNEXPECTEDLY fuer ein
        // Kind, das WIR selbst abgeschossen haben. `this.child === child`
        // zusaetzlich verlangt: im kill()-Fall zeigt `this.child` zu diesem
        // Zeitpunkt schon auf `null` (oder, nach einem zwischenzeitlichen
        // neuen start(), auf ein ANDERES Kind) - nie mehr auf `child` selbst,
        // die Meldung verstummt zu Recht. Im echten Absturzfall (kein stop()
        // lief) zeigt `this.child` weiterhin auf GENAU dieses `child` - die
        // Meldung bleibt.
        const stillTracked = this.child === child;
        if (this.stopPromise === null && stillTracked) {
          this.dispatch(
            enrich({
              ev: 'error',
              where: 'exit',
              code: 'exited',
              detail: `Kindprozess unerwartet beendet, ${howEnded}`,
            } as WireEvent),
          );
        }
        // Abschluss-Sichtung, Schluss-Pruefung MINOR 7: `this.child` wird
        // ERST HIER genullt, NICHT vor der Pruefung oben - sonst schluege
        // `this.child === child` NIE an und der echte Absturzfall wuerde
        // ebenfalls verstummen (siehe IMPORTANT 1). Der `stillTracked`-
        // Wert von OBEN wird wiederverwendet, nicht neu ausgewertet: ein
        // spaeterer start() koennte `this.child` zwischen den beiden Zeilen
        // NICHT mehr veraendern (dieser Rueckruf laeuft synchron zu Ende,
        // bevor JS wieder etwas anderes einschieben kann), die zweite
        // Auswertung waere also ohnehin dieselbe - die Wiederverwendung
        // spart nur eine ueberfluessige zweite Objektidentitaetspruefung.
        // Zweck: nach einem unerwarteten Tod ohne laufendes stop() bleibt
        // `this.child` sonst NICHT-null stehen (nur der kill()-Weg in
        // doStop() nullt es) - `start()`s Wiedereintrittsschutz (Punkt H2)
        // wuerde einen Wiederanlauf nach einem Absturz dann mit "Bridge
        // laeuft bereits" verweigern, bis irgendwann `stop()` gelaufen ist.
        // Trifft NICHT zu, wenn `this.child` inzwischen schon ein ANDERES
        // Kind ist (`stillTracked === false`): dann wuerde das Nullen hier
        // faelschlich die Referenz auf das NEUE Kind loeschen.
        if (stillTracked) this.child = null;
        resolve(exitCode);
      });
    });

    // DAUERHAFT angemeldet - nicht nur waehrend des Starts. Node kennt genau
    // drei Ursachen fuer 'error' auf einem ChildProcess: der Start schlug fehl,
    // eine IPC-Nachricht schlug fehl (wir benutzen kein IPC, stdio ist reines
    // 'pipe'), oder ein kill() schlug fehl. Die erste Ursache wird unten vom
    // once('error', reject) abgefangen (start() wirft dann) - hier NUR melden,
    // wenn 'spawn' bereits gefeuert hat (this.spawned), sonst wuerde eine
    // gescheiterte spawn() faelschlich als killFailed erscheinen: zwei
    // verschiedene Ursachen, die sonst denselben Namen bekaemen. Ohne diesen
    // DAUERHAFTEN Listener wuerde ein SPAETES 'error' (nach dem Start) entweder
    // in das laengst aufgeloeste Promise unten fallen (reject() auf ein bereits
    // erfuelltes Promise ist ein stiller Leerlauf - GENAU die Kardinalsuende,
    // die diese Bruecke ueberall sonst vermeidet), oder, gaebe es dann GAR
    // KEINEN Listener mehr, den gesamten Prozess mit einer nicht abgefangenen
    // Ausnahme abstuerzen lassen (Node wirft 'error' ohne Listener synchron
    // weiter).
    child.on('error', (e) => {
      if (this.spawned) this.reportKillFailure(`Kindprozess meldet 'error': ${e.message}`);
    });

    await new Promise<void>((resolve, reject) => {
      child.once('spawn', () => {
        this.spawned = true;
        resolve();
      });
      child.once('error', (e) => reject(e));
    });
  }

  /**
   * Meldet einen fehlgeschlagenen Terminierungsversuch, statt ihn verschwinden
   * zu lassen. Zwei Ausloeser, ein gemeinsamer Weg: der synchrone `false`-
   * Rueckgabewert von `kill()` in `stop()`, und das dauerhafte `'error'` oben.
   * `where: 'stop'` grenzt den Ort ab (weder 'join' noch 'auth' noch
   * 'privilege' - der Abbau selbst).
   */
  private reportKillFailure(detail: string): void {
    (this.opts.onLog ?? ((l: string) => console.error(`[zoom-bridge] ${l}`)))(`kill() fehlgeschlagen: ${detail}`);
    this.dispatch(enrich({ ev: 'error', where: 'stop', code: 'killFailed', detail } as WireEvent));
  }

  /**
   * Meldet einen asynchronen Fehler auf child.stdin (z. B.
   * ERR_STREAM_WRITE_AFTER_END, EPIPE), statt ihn den Wirtsprozess mitreissen
   * zu lassen. `where: 'stdin'` grenzt den Ort ab - eine ANDERE Ursache als
   * killFailed (das misst das TERMINIEREN, dies misst das SENDEN).
   */
  private reportStdinError(e: Error): void {
    (this.opts.onLog ?? ((l: string) => console.error(`[zoom-bridge] ${l}`)))(`stdin-Fehler: ${e.message}`);
    this.dispatch(enrich({ ev: 'error', where: 'stdin', code: 'stdinError', detail: e.message } as WireEvent));
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
      // keine Ausnahme: ohne enrich() haette es kein "name"-Feld. GEMESSEN per
      // Mutationsprobe (siehe task-10-report.md): ohne diese Zeile wird GENAU
      // die Zusicherung "und zwar JOIN_TIMEOUT" ROT (name ist undefined statt
      // 'JOIN_TIMEOUT') - das ist der Beleg, dass die Zusicherung diesen
      // Fehler wirklich faengt, nicht nur, dass sie ihn nicht ausschliesst.
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

  /**
   * ACHTUNG (Nachbesserung 2): gegen Wiedereintritt geschuetzt. Zwei
   * GLEICHZEITIGE stop()-Aufrufe (z. B. `Promise.all([b.stop(), b.stop()])`,
   * ein zweimal geklickter Knopf in apps/connect) faengen sonst denselben
   * `this.child` ein - der erste ruft `child.stdin.end()`, bevor der zweite
   * drankommt, dessen `child.stdin.write(...)` schreibt dann gegen einen
   * bereits beendeten Strom. GEMESSEN: das wirft NICHT synchron (kein
   * try/catch faengt es), sondern loest asynchron ein 'error'
   * (ERR_STREAM_WRITE_AFTER_END) auf dem stdin-Socket aus - ohne Lauscher
   * dort stirbt der GESAMTE Wirtsprozess, nicht nur die Bruecke.
   *
   * Die Absicherung: der Zustandswechsel (`this.stopPromise = ...`) passiert
   * hier im SYNCHRONEN Teil, VOR dem ersten `await` - ein zweiter,
   * gleichzeitiger Aufruf sieht `this.stopPromise` darum bereits gesetzt und
   * wartet auf DASSELBE Versprechen, statt selbst noch einmal in
   * child.stdin zu schreiben. Der SEQUENTIELLE Fall bleibt unveraendert:
   * `stop()` abwarten, dann erneut rufen, liefert weiterhin `0` ueber die
   * bestehende `if (!this.child) return 0;`-Pruefung, weil `stopPromise` im
   * finally-Zweig auf `null` zurueckgesetzt wird, sobald der erste Abbau
   * abgeschlossen ist.
   */
  async stop(): Promise<number> {
    this.clearWatchdog();
    if (this.stopPromise) return this.stopPromise;
    if (!this.child) return 0;
    this.stopPromise = this.doStop(this.child);
    try {
      return await this.stopPromise;
    } finally {
      this.stopPromise = null;
    }
  }

  private async doStop(child: ChildProcessWithoutNullStreams): Promise<number> {
    try {
      child.stdin.write(serializeCommand({ cmd: 'quit' }));
      child.stdin.end();
    } catch {
      /* der Prozess ist schon weg - der DAUERHAFTE 'error'-Lauscher auf
         child.stdin faengt einen asynchronen Fehlschlag ab, dieser
         synchrone Zweig bleibt als zweite, unabhaengige Absicherung stehen */
    }

    // Die Zeitgeber-Kennung MUSS festgehalten werden: gewinnt exitCode das
    // Rennen (der Normalfall - alle Attrappen-Drehbuecher ausser 'stuck'
    // enden von selbst sauber), muss der Nachbrenner-Zeitgeber TROTZDEM
    // geloescht werden - sonst laeuft er im Hintergrund weiter und haelt den
    // Node-Prozess bis zu killTimeoutMs laenger am Leben, als noetig waere.
    // Im Selbsttest faellt das NICHT auf, weil die Datei am Ende ohnehin
    // process.exit() ruft (das verdeckt genau diesen Defekt) - Stage 4
    // (apps/connect) hat kein solches process.exit() garantiert. .unref?.()
    // gleich beim Erzeugen als ZWEITE, unabhaengige Absicherung - wie beim
    // Beitritts-Wachhund in armWatchdog().
    let killTimer: NodeJS.Timeout | null = null;
    const code = await Promise.race([
      this.exitCode ?? Promise.resolve(0),
      new Promise<number>((resolve) => {
        killTimer = setTimeout(() => {
          // Endet die Bridge nicht von selbst, wird sie beendet - eine Bridge,
          // die in einem fremden Meeting sitzen bleibt, ist schlimmer als ein
          // harter Abbruch. Schlaegt DAS fehl (kill() liefert false zurueck -
          // gemessen: passiert u. a., wenn der Prozess zwischen Zeitgeber-Start
          // und -Ablauf bereits von selbst verschwunden ist), darf der Fehler
          // nicht spurlos verschwinden.
          if (!child.kill()) this.reportKillFailure('kill() lieferte false zurueck.');
          resolve(-1);
        }, this.opts.killTimeoutMs ?? 8000);
        killTimer.unref?.();
      }),
    ]);
    if (killTimer) clearTimeout(killTimer);
    this.child = null;
    return code;
  }
}
