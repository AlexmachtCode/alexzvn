import { app } from 'electron';
import { join } from 'node:path';
import { getLog } from '@jm/app-runtime';
import { masterLinkPfad } from '@jm/master-link';
import type { Show } from '@jm/show';
import type { AppEvent, KoppelAntwort, VerbundRolle, VerbundStand } from '@shared/types';
import { erzeugeVerbundKern } from './kern';
import { Verteiler } from './verteiler';

// Verbund des Launchers (Master-Link Teil 1): dünne Electron-Anbindung über dem Kern (kern.ts), der Datei im Speicher,
// Rolle, Reihenfolge der zustandsändernden Aufrufe und Stand OHNE Electron führt und per tsx getestet ist.
// Hier nur, was Electron braucht: Pfade, Log, Änderungsereignis und das Beenden.

/** Teil 2b R2: Änderungsereignis fürs Verbund-Modal, gesetzt in starteVerbund. */
let meldeVerbund: (() => void) | null = null;

/**
 * Teil 2b R2, Spec 15: Verteiler der Show-Daten. Lebt mit dem Launcher und merkt sich die offene Show auch ohne Rolle
 * Master; jede MasterRolle startet und stoppt ihn (neue Epoche je Start).
 */
const verteiler = new Verteiler({
  log: (stufe, text) => {
    getLog()[stufe](text);
  },
  rechnerName: (id) => kern.stand().master?.rechner.find((r) => r.rechnerId === id)?.name ?? id,
  beiAenderung: () => meldeVerbund?.(),
});

const kern = erzeugeVerbundKern({
  dateiPfad: () => masterLinkPfad(app.getPath('appData')),
  speicherDir: () => join(app.getPath('userData'), 'master-link'),
  suiteVersion: () => app.getVersion(),
  log: (stufe, text) => {
    getLog()[stufe](text);
  },
  verteiler,
});

export async function starteVerbund(emit: (e: AppEvent) => void): Promise<void> {
  kern.setzeMelder(() => emit({ type: 'verbund-changed' }));
  meldeVerbund = () => emit({ type: 'verbund-changed' });
  // Nur anstoßen, nie abfangen oder verzögern: den Quit-Pfad teilen sich Installer/Updater und Control-Server.
  app.on('before-quit', () => {
    void kern.beende();
  });
  await kern.starte();
}

export function verbundStand(): VerbundStand {
  return kern.stand();
}

export function setzeRolle(rolle: VerbundRolle): Promise<VerbundStand> {
  return kern.setzeRolle(rolle);
}

export function setzeRechnerName(name: string): VerbundStand {
  return kern.setzeRechnerName(name);
}

export function setzeMasterName(name: string): Promise<VerbundStand> {
  return kern.setzeMasterName(name);
}

export function setzeKarte(karte: string | null): Promise<VerbundStand> {
  return kern.setzeKarte(karte);
}

export function oeffneKopplung(): VerbundStand {
  return kern.oeffneKopplung();
}

export function neuerKoppelCode(): VerbundStand {
  return kern.neuerKoppelCode();
}

export function schliesseKopplung(): VerbundStand {
  return kern.schliesseKopplung();
}

export function entferneRechner(rechnerId: string): VerbundStand {
  return kern.entferneRechner(rechnerId);
}

export function erneuereIdentitaet(): Promise<VerbundStand> {
  return kern.erneuereIdentitaet();
}

export function setzeNeuAuf(): Promise<VerbundStand> {
  return kern.setzeNeuAuf();
}

export function starteMasterSuche(): void {
  kern.starteMasterSuche();
}

export function stoppeMasterSuche(): void {
  kern.stoppeMasterSuche();
}

export function koppeleMitMaster(adresse: string, code: string): Promise<KoppelAntwort> {
  return kern.koppeleMitMaster(adresse, code);
}

export function brecheKoppelnAb(): void {
  kern.brecheKoppelnAb();
}

/** Spec 5.3 „Trennen“: Kopplung löschen, Rolle bleibt; alle Tools trennen sich über die Datei. */
export function trenneVerbund(): VerbundStand {
  return kern.trenneVerbund();
}

/** Endprüfung B3: geklonter Rechner — neue rechner.id, Kopplung weg, Rolle bleibt und startet neu. */
export function neueKennung(): Promise<VerbundStand> {
  return kern.neueKennung();
}

export function setzeFesteAdresse(adresse: string | null): VerbundStand {
  return kern.setzeFesteAdresse(adresse);
}

/** Teil 2b R2, Spec 15.1: die offene Show (wie sie in der Datei steht; null = nicht lesbar) an den Verteiler. */
export function meldeShowAnVerbund(pfad: string, show: Show | null): void {
  verteiler.meldeShow(pfad, show);
}

/**
 * Teil 2b R2, Spec 15.3/15.6 (E12): Rolle Master in master-link.json → RELOAD nur an diesen Rechner, k = Tools anderer
 * Rechner mit Abo; sonst null (alles wie in 2a).
 */
export function verbundReloadInfo(): { andereRechner: number } | null {
  return kern.rolle() === 'master' ? { andereRechner: verteiler.abosAndererRechner() } : null;
}
