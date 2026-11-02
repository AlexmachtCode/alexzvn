// NDI-Gäste-Pool: EIN utilityProcess (nativer NDI-Sender) je QUELLE. Ein Gast hat bis zu zwei:
// sein Kamerabild und (Welle 6.3) seinen geteilten Bildschirm. Der Pool wird deshalb über den
// NDI-Pool-Schlüssel adressiert (`@jm/rtc`: Gast-ID bzw. `<id>::screen`), nicht über die Gast-ID.
// Löst die „ein Sender pro Prozess"-Regel von @jm/ndi durch Isolation je Quelle —
// gespiegelt aus dem Map-keyed-ein-Prozess-pro-Quelle-Muster des Switchers
// (apps/switcher/src/main/ndi-receive.ts), nur in SEND-Richtung.
//
// Frame-Weg (Welle 6.1): der versteckte Peer-Renderer dekodiert die vom SFU
// abonnierten Gast-Tracks (WebCodecs → BGRA/FLTP) und postet sie auf port1; port2
// bleibt im Main und leitet jede Nachricht per child.postMessage an den Utility
// weiter — Buffer werden KOPIERT, nicht transferiert (ein transferierter
// ArrayBuffer käme über die Port-Grenze als null an).
//
// Plan C (Spec 22.3, E32, E33, E50–E52): Den Zustand jeder Quelle führt die reine Lage (ndi-lage.ts, eine Instanz für
// Gäste und Programm, angelegt in index.ts). Diese Hülle startet und beendet Prozesse nur, wie die Lage es sagt
// (gastHandlung), hört auf `exit` jedes Prozesses, reicht jede Nachricht durch den Leser (leseGastMeldung) und meldet jedes
// weitergeleitete Videobild. Ein MessageChannelMain je Eintrag für dessen ganze Lebenszeit: port2 leitet an den Prozess,
// der gerade aktuell ist, auch nach einem Neustart (der Peer hält port1 fest und startet keine zweite Pumpe, E33).
// Logzeilen tragen Schlüssel, Generation und PID, nie einen Gast- oder NDI-Namen (E35).
import { MessageChannelMain, utilityProcess, type BrowserWindow, type MessagePortMain, type UtilityProcess } from 'electron';
import { join } from 'node:path';
import { getLog } from '@jm/app-runtime';
import { ndiPoolKey } from '@jm/rtc/protocol';
import { PEER_FRAME_PORT } from '@shared/ipc';
import { leseGastMeldung, type NdiArt, type NdiHandlung, type NdiLage, type NdiQuelleLage } from './ndi-lage';

declare const __dirname: string;

/** Ein Prozess einer Quelle mit der Generation, die ihm die Lage gab (22.3, wie ST4 6.9). */
interface Prozess {
  child: UtilityProcess;
  generation: number;
}

interface Eintrag {
  /** Frame-Port zum Peer: einer je Eintrag, vom ersten Prozess bis tearDown (22.3 „Hülle“). */
  port2: MessagePortMain;
  /** Der Prozess, der gerade aktuell ist; null zwischen einem Ausfall und dem Neustart oder in `gescheitert`. */
  aktuell: Prozess | null;
}

const eintraege = new Map<string, Eintrag>();
let getPeer: () => BrowserWindow | null = () => null;
let lage: NdiLage | null = null;
let ausfuehren: (h: NdiHandlung[]) => void = () => {};

export function initNdiGuests(deps: { getPeer: () => BrowserWindow | null; lage: NdiLage; ausfuehren: (h: NdiHandlung[]) => void }): void {
  getPeer = deps.getPeer;
  lage = deps.lage;
  ausfuehren = deps.ausfuehren;
}

/** NDI-Quelle anmelden (spinUpNdi-Effekt). `key` = NDI-Pool-Schlüssel; `<id>::screen` ist die Bildschirm-Quelle. */
export function spinUp(key: string, label: string): void {
  if (!lage) return;
  const art: NdiArt = key.includes('::') ? 'bildschirm' : 'kamera';
  ausfuehren(lage.spinUp(key, art, label));
}

/** Führt eine Handlung der Lage für eine Gast-Quelle aus (index.ts verteilt sie, C-EP1). */
export function gastHandlung(h: Extract<NdiHandlung, { art: 'prozessStarten' | 'prozessBeenden' }>): void {
  if (h.art === 'prozessStarten') starteProzess(h.schluessel, h.generation);
  else beendeProzess(h.schluessel, h.generation);
}

function starteProzess(schluessel: string, generation: number): void {
  const q = lage?.quelleLage(schluessel);
  if (!lage || !q) return;
  let eintrag = eintraege.get(schluessel);
  if (!eintrag) {
    const { port1, port2 } = new MessageChannelMain();
    const neu: Eintrag = { port2, aktuell: null };
    // port2 leitet an den Prozess, der GERADE aktuell ist (PK47), nie an einen beim Anlegen festgehaltenen.
    port2.on('message', (ev) => {
      const p = neu.aktuell;
      if (!p) return;
      // Ohne Transfer weiterreichen (Buffer wird kopiert).
      p.child.postMessage(ev.data);
      if ((ev.data as { type?: unknown } | null)?.type === 'video') ausfuehren(lage?.videobild(schluessel) ?? []);
    });
    port2.start();
    eintraege.set(schluessel, neu);
    // port1 an den versteckten Peer-Renderer, getaggt mit dem Pool-Schlüssel der Quelle.
    getPeer()?.webContents.postMessage(PEER_FRAME_PORT, { key: schluessel }, [port1]);
    eintrag = neu;
  }

  // `stdio: 'pipe'` statt des Default 'inherit': eine gepackte Windows-GUI-App hat keine Konsole,
  // an die der Utility-Prozess erben könnte — seine console.log/error (Wachhund-Warnungen, native
  // NDI-Fehler) fielen bisher spurlos ins Nichts. Jetzt landen sie in der Logdatei der App.
  const child = utilityProcess.fork(join(__dirname, 'ndi-guest-sender.cjs'), [], { stdio: 'pipe' });
  const prozess: Prozess = { child, generation };
  const besitzer = eintrag;
  besitzer.aktuell = prozess;

  const forward = (level: 'info' | 'error') => (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n')) {
      if (line.trim()) getLog()[level](`[guest-sender ${schluessel} G${generation}] ${line.trim()}`);
    }
  };
  child.stdout?.on('data', forward('info'));
  child.stderr?.on('data', forward('error'));

  // Jede Nachricht geht durch den Leser (E51): fremde Arten und Werte kommen nicht in die Lage.
  child.on('message', (roh: unknown) => {
    const m = leseGastMeldung(roh);
    if ('verworfen' in m) {
      getLog().warn(`[ndi-guests] ${schluessel} (Generation ${generation}): Meldung verworfen, ${m.verworfen}`);
      return;
    }
    ausfuehren(lage?.gastMeldung(schluessel, generation, m) ?? []);
  });
  // Ein Zuhörer auf `exit` je Prozess (22.1 Nr. 1, PK38): die Lage entscheidet, ob das Ende zählt.
  child.on('exit', (code) => {
    if (besitzer.aktuell === prozess) besitzer.aktuell = null;
    getLog().info(`[ndi-guests] ${schluessel} (Generation ${generation}, PID ${child.pid ?? '?'}): Prozess beendet, Code ${code}`);
    ausfuehren(lage?.gastExit(schluessel, generation, code) ?? []);
  });
  // Die PID gibt es erst ab `spawn` (vorher ist child.pid undefined, Electron-Typen zu UtilityProcess.pid): Startzeile
  // darum hier, und ab jetzt schreibt die Lage die PID in jede Zeile dieser Generation (E35, C-EB4).
  child.on('spawn', () => {
    getLog().info(`[ndi-guests] ${schluessel} (Generation ${generation}, PID ${child.pid ?? '?'}): Prozess gestartet`);
    if (child.pid !== undefined) lage?.prozessPid(generation, child.pid);
  });
  child.postMessage({ type: 'init', name: q.label });
}

function beendeProzess(schluessel: string, generation: number): void {
  const p = eintraege.get(schluessel)?.aktuell;
  if (!p || p.generation !== generation) return;
  try {
    p.child.postMessage({ type: 'stop' });
    p.child.kill();
  } catch {
    /* schon beendet: das exit kommt trotzdem */
  }
}

/**
 * NDI-Sender einer Quelle stoppen (tearDownNdi / Kick / Leave). Wird die KAMERA eines Gasts
 * abgeräumt, geht auch sein Bildschirm — der Gast ist weg. Umgekehrt nicht: das Beenden der
 * Bildschirmfreigabe lässt die Kamera laufen. Die Kaskade bleibt in der Hülle (C-EB12).
 */
export function tearDown(key: string): void {
  if (!key.includes('::')) tearDown(ndiPoolKey(key, 'screen'));
  if (lage) ausfuehren(lage.tearDown(key));
  const e = eintraege.get(key);
  if (!e) return;
  try {
    e.port2.close();
  } catch {
    /* egal */
  }
  eintraege.delete(key);
}

/** Alle Quellen beenden (Raum schließen / App beenden), auch Einträge ohne Prozess (gescheitert). */
export function tearDownAll(): void {
  const alle = new Set([...eintraege.keys(), ...(lage?.quellen().map((q) => q.schluessel) ?? [])]);
  for (const key of alle) tearDown(key);
}

/** Knopf „NDI neu starten“ (22.3 Nr. 9): wirkt nur in `gescheitert`; ein unbekannter Schlüssel ändert nichts. */
export function gastNeustart(schluessel: string): void {
  if (lage) ausfuehren(lage.gastNeustart(schluessel));
}

/** Lage aller Gast-Quellen (jeder Eintrag von spinUp bis tearDown, jeder Zustand) für AppStatus und STATE. */
export function gastLagen(): NdiQuelleLage[] {
  return lage ? lage.quellen() : [];
}

/** e = Einträge (E42): „Raum schließen“ im Tray und „Zuschaltungen aktiv“ hängen wie bisher an ihr. */
export function activeCount(): number {
  return gastLagen().length;
}

/** NDI-Namen für die Kollisionsprüfung mit Zoom-Quellen (Spec 6.3, T46): alle Einträge außer `gescheitert` (E42). */
export function activeLabels(): string[] {
  return lage ? lage.namensListe() : [];
}
