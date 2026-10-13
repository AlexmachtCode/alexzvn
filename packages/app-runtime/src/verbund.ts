// ─────────────────────────────────────────────────────────────────────────────
// Verbund der Tool-Seite: Electron-Anbindung (Master-Link Teil 2b, Release 2, Spec 16.1, 16.2, 16.5).
//
// Ein VerbundFolger je Tool-Prozess über dem Master-Link-Client aus index.ts (startMasterLink).
// Der Client entsteht erst in app.whenReady und nur mit Single-Instance-Lock; eine Zweitinstanz
// hat deshalb keinen Folger, kein Abo und schreibt nie master-stand.json (G14).
// Die Tools rufen die öffentlichen Funktionen unten jederzeit — auch bevor der Client läuft:
// `folgeMasterShow` und `verbundDatenErsetzt` werden dann gemerkt und beim Start nachgereicht.
// Die Logik steckt in verbund-daten.ts (rein, mit Tests); hier ist nur Verdrahtung (G15).
// ─────────────────────────────────────────────────────────────────────────────
import { app } from 'electron';
import { hostname, networkInterfaces } from 'node:os';
import { eigeneAdressen, istDieserRechner, type MasterLinkClient } from '@jm/master-link';
import type { Logger } from './index';
import { VerbundFolger } from './verbund-daten';
import { registriereVerbundIpc } from './verbund-ipc';
import { erzeugeStandSpeicher, standDatei } from './verbund-speicher';
import type { FolgeHandler, VerbundDaten, VerbundKopplung } from './verbund-typen';

let folger: VerbundFolger | null = null;
let wartenderHandler: FolgeHandler | null = null;
let ersetztVorDemStart = false;

/** Nur intern (index.ts, startMasterLink): hängt den Folger an den Client, direkt nach client.starte() — erst dann kennt kopplung() die master-link.json; sonst sähe ein früh registriertes Tool beim Start kurz „entkoppelt“ (16.3). Wirft nie. */
export function verbundAnClient(client: MasterLinkClient, o: { userData: string; log: Logger }): void {
  if (folger) return;
  try {
    const log = (stufe: 'info' | 'warn', t: string): void => o.log[stufe](t);
    const f = new VerbundFolger({
      client,
      speicher: erzeugeStandSpeicher(standDatei(o.userData), log),
      log,
      darfSchreiben: app.hasSingleInstanceLock(),
    });
    folger = f;
    registriereVerbundIpc(f);
    if (ersetztVorDemStart) f.ersetzt();
    f.starte();
    if (wartenderHandler) f.folge(wartenderHandler);
  } catch (err) {
    const code = (err as { code?: unknown } | null)?.code;
    o.log.warn(`Verbund: nicht gestartet (${typeof code === 'string' ? code : 'unbekannt'}).`);
  }
}

/** Das Tool folgt der Show des Masters (16.2). Erst aufrufen, wenn das Tool bereit ist (E17). */
export function folgeMasterShow(h: FolgeHandler): void {
  wartenderHandler = h;
  folger?.folge(h);
}

export function verbundDaten(): VerbundDaten {
  return folger?.daten() ?? { art: 'einzelplatz' };
}

/** Grundlage für „RELOAD ignoriert“ und „Show-Deep-Link liefert nur Dokumente“ (16.1). */
export function imVerbundmodus(): boolean {
  return folger?.imVerbundmodus() ?? false;
}

/** Das Tool hat eine eigene Show angewendet: Zwischenspeicher löschen, `frueher` beenden (16.1, E16). */
export function verbundDatenErsetzt(): void {
  if (folger) folger.ersetzt();
  else ersetztVorDemStart = true;
}

/** Für die Wahl des Launchers im Rundown (17.4). null ohne lesbare master-link.json. */
export function verbundKopplung(): VerbundKopplung | null {
  return folger?.kopplung() ?? null;
}

/** Logzeilen aus 16.1, höchstens einmal je Minute und Weg (E19). */
export function verbundIgnoriert(weg: 'reload' | 'deeplink', pfad?: string): void {
  folger?.ignoriert(weg, pfad);
}

/** Läuft `host` auf diesem Rechner? (Loopback, eigene Karte, eigener Hostname; Regeln E7.) */
export function istHostDieserRechner(host: string): boolean {
  let adressen: string[] = [];
  try {
    adressen = eigeneAdressen(networkInterfaces());
  } catch {
    /* ohne Kartenliste zählen nur Loopback und der eigene Name */
  }
  return istDieserRechner(host, adressen, hostname());
}
