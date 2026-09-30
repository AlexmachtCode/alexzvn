import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import { hostname, networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { getLog } from '@jm/app-runtime';
import {
  kuerzeName, leseMasterLinkDatei, masterLinkPfad, schreibeMasterLinkDatei,
  type Lesen, type MasterLinkDatei,
} from '@jm/master-link';
import type { AppEvent, KoppelAntwort, VerbundRolle, VerbundStand } from '@shared/types';
import { MasterRolle } from './master';
import { SlaveRolle } from './slave';
import { beobachte, kartenLage, leseBisLesbar } from './wache';

// Verbund des Launchers (Master-Link Teil 1): hält master-link.json im Speicher, führt die
// Rolle und liefert den Stand an den Renderer. Alles Netz läuft hier im Main (CSP bleibt unberührt).

function neueDatei(): MasterLinkDatei {
  return {
    version: 1,
    rolle: 'aus',
    rechner: { id: randomUUID(), name: kuerzeName(hostname()) },
    netzwerk: { karte: null },
    kopplung: null,
  };
}

let datei: MasterLinkDatei = neueDatei();
/** I/O-Code, solange master-link.json beim Start nicht lesbar ist (Spec 7.3) — dann wird NICHTS geschrieben. */
let dateiFehler: string | null = null;
let master: MasterRolle | null = null;
let slave: SlaveRolle | null = null;
let melde: () => void = () => {};
let meldeZeitgeber: ReturnType<typeof setTimeout> | null = null;
let kette: Promise<unknown> = Promise.resolve();

function pfad(): string {
  return masterLinkPfad(app.getPath('appData'));
}

function log(stufe: 'info' | 'warn', text: string): void {
  getLog()[stufe](text);
}

/** Nur der Launcher schreibt die gemeinsame Datei (Spec 7.1). */
function schreibe(d: MasterLinkDatei): void {
  if (dateiFehler) {
    // Spec 7.3/10: im Speicher steht nur eine Ersatzdatei (neue rechner.id) — nie über die echte Kopplung schreiben.
    log('warn', `master-link.json nicht lesbar (${dateiFehler}) — nicht überschrieben.`);
    return;
  }
  datei = d;
  try {
    schreibeMasterLinkDatei(pfad(), d);
  } catch (e) {
    log('warn', `master-link.json nicht geschrieben: ${(e as Error).message}`);
  }
}

/** Zustandsändernde Aufrufe nacheinander (Review Focus 2): „Master → Aus → Master“ überholt sich sonst. */
function nacheinander<T>(schritt: () => Promise<T>): Promise<T> {
  const lauf = kette.then(schritt);
  kette = lauf.catch(() => {});
  return lauf;
}

/** Ereignisse bündeln (Puls, Teilnehmer, Client-Zustand können in Schüben kommen). */
function aenderung(): void {
  if (meldeZeitgeber) return;
  meldeZeitgeber = setTimeout(() => {
    meldeZeitgeber = null;
    melde();
  }, 100);
}

function neuerMaster(): MasterRolle {
  return new MasterRolle({
    speicherDir: join(app.getPath('userData'), 'master-link'),
    suiteVersion: app.getVersion(),
    datei: () => datei,
    schreibeDatei: schreibe,
    beiAenderung: aenderung,
    log,
  });
}

function neuerSlave(): SlaveRolle {
  return new SlaveRolle({
    dateiPfad: pfad(),
    suiteVersion: app.getVersion(),
    datei: () => datei,
    schreibeDatei: schreibe,
    beiAenderung: aenderung,
    log,
  });
}

async function starteRolle(r: Exclude<Lesen<MasterLinkDatei>, { art: 'io' }>): Promise<void> {
  if (r.art === 'ok') {
    datei = r.wert;
  } else if (r.art === 'defekt') {
    // Nicht überschreiben: der Client meldet „Kopplung beschädigt: neu koppeln“, erst Koppeln schreibt neu.
    log('warn', 'master-link.json beschädigt — bitte neu koppeln.');
    datei = { ...neueDatei(), rolle: 'slave' };
  }
  if (datei.rolle === 'master') {
    master = neuerMaster();
    await master.starte();
  } else if (datei.rolle === 'slave') {
    slave = neuerSlave();
    slave.starte();
  }
}

export async function starteVerbund(emit: (e: AppEvent) => void): Promise<void> {
  melde = () => emit({ type: 'verbund-changed' });
  app.on('before-quit', () => {
    void master?.stoppe();
    void slave?.stoppe();
  });
  // Spec 4.1: Karten alle 10 s neu lesen — in JEDER Rolle, damit „· Karte fehlt“ den Kopf sofort erreicht.
  beobachte(() => JSON.stringify(kartenLage(networkInterfaces(), datei.netzwerk.karte)), aenderung, 10_000);
  // Spec 7.3: I/O-Fehler (EBUSY/EPERM, Virenscanner) sind vorübergehend → erneut lesen, bis es gelingt.
  // Bis dahin startet keine Rolle und nichts wird geschrieben (Spec 10: nie still entkoppeln).
  const r = await leseBisLesbar(() => leseMasterLinkDatei(pfad()), (code) => {
    if (dateiFehler === null) log('warn', `master-link.json nicht lesbar (${code}) — Verbund wartet, nichts wird überschrieben.`);
    if (dateiFehler !== code) {
      dateiFehler = code;
      aenderung();
    }
  });
  await nacheinander(async () => {
    const warGesperrt = dateiFehler !== null;
    dateiFehler = null;
    await starteRolle(r);
    if (warGesperrt) aenderung();
  });
}

export function verbundStand(): VerbundStand {
  const { karten, karteFehlt } = kartenLage(networkInterfaces(), datei.netzwerk.karte);
  return {
    rolle: datei.rolle,
    rechnerName: datei.rechner.name,
    karten,
    gewaehlteKarte: datei.netzwerk.karte,
    karteFehlt,
    dateiFehler,
    master: master?.stand() ?? null,
    slave: slave?.stand() ?? null,
  };
}

/** Spec 5.3: Aus ← Slave löscht die Kopplung; Aus ← Master setzt die Selbstkopplung außer Kraft. */
export function setzeRolle(rolle: VerbundRolle): Promise<VerbundStand> {
  return nacheinander(async () => {
    // Datei nicht lesbar: keine Rolle auf der Ersatzdatei starten (Spec 7.3).
    if (dateiFehler || rolle === datei.rolle) return verbundStand();
    const m = master;
    const s = slave;
    master = null;
    slave = null;
    await m?.stoppe();
    await s?.stoppe();
    schreibe({ ...datei, rolle, kopplung: null });
    if (rolle === 'slave') {
      slave = neuerSlave();
      slave.starte();
    } else if (rolle === 'master') {
      master = neuerMaster();
      await master.starte();
    }
    aenderung();
    return verbundStand();
  });
}

export function setzeRechnerName(name: string): VerbundStand {
  schreibe({ ...datei, rechner: { ...datei.rechner, name: kuerzeName(name) } });
  master?.rechnerNameGeaendert(datei.rechner.name);
  aenderung();
  return verbundStand();
}

export function setzeMasterName(name: string): Promise<VerbundStand> {
  return nacheinander(async () => {
    await master?.setzeName(name);
    return verbundStand();
  });
}

export function setzeKarte(karte: string | null): Promise<VerbundStand> {
  return nacheinander(async () => {
    schreibe({ ...datei, netzwerk: { karte } });
    await master?.pruefeKarten();
    aenderung();
    return verbundStand();
  });
}

export function oeffneKopplung(): VerbundStand {
  master?.oeffneKopplung();
  return verbundStand();
}

export function neuerKoppelCode(): VerbundStand {
  master?.neuerCode();
  return verbundStand();
}

export function schliesseKopplung(): VerbundStand {
  master?.schliesseKopplung();
  return verbundStand();
}

export function entferneRechner(rechnerId: string): VerbundStand {
  master?.entferne(rechnerId);
  return verbundStand();
}

export function erneuereIdentitaet(): Promise<VerbundStand> {
  return nacheinander(async () => {
    await master?.erneuereIdentitaet();
    return verbundStand();
  });
}

export function setzeNeuAuf(): Promise<VerbundStand> {
  return nacheinander(async () => {
    await master?.neuAufsetzen();
    return verbundStand();
  });
}

export function starteMasterSuche(): void {
  slave?.starteSuche();
}

export function stoppeMasterSuche(): void {
  slave?.stoppeSuche();
}

export async function koppeleMitMaster(adresse: string, code: string): Promise<KoppelAntwort> {
  if (!slave) return { ok: false, text: 'Zuerst die Rolle „Mit Master verbinden“ wählen.' };
  return slave.koppele(adresse, code);
}

export function brecheKoppelnAb(): void {
  slave?.brecheKoppelnAb();
}

/** Spec 5.3 „Trennen“: Kopplung löschen, Rolle bleibt; alle Tools trennen sich über die Datei. */
export function trenneVerbund(): VerbundStand {
  if (datei.rolle === 'slave') schreibe({ ...datei, kopplung: null });
  aenderung();
  return verbundStand();
}

export function setzeFesteAdresse(adresse: string | null): VerbundStand {
  if (datei.kopplung) {
    const a = adresse?.trim() ? adresse.trim() : null;
    schreibe({ ...datei, kopplung: { ...datei.kopplung, festeAdresse: a } });
  }
  aenderung();
  return verbundStand();
}
