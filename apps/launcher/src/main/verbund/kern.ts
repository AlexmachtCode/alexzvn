import { randomUUID } from 'node:crypto';
import { hostname, networkInterfaces } from 'node:os';
import {
  kuerzeName, leseMasterLinkDatei, schreibeMasterLinkDatei,
  type Lesen, type MasterLinkDatei, type NetzwerkInterfaces,
} from '@jm/master-link';
import type { KoppelAntwort, VerbundRolle, VerbundStand } from '@shared/types';
import { fehlerCode } from './fehlercode';
import { MasterRolle, type MasterAbhaengigkeiten } from './master';
import { SlaveRolle, type SlaveAbhaengigkeiten } from './slave';
import { beobachte, kartenLage, leseBisLesbar } from './wache';

// Kern des Verbunds OHNE Electron (per tsx getestet, Muster wie wache.ts): hält master-link.json im Speicher,
// führt die Rolle, serialisiert zustandsändernde Aufrufe und liefert den Stand. verbund/index.ts ist nur die
// dünne Electron-Anbindung (Pfade, Log, Beenden) darüber. Alles Netz läuft im Main (CSP bleibt unberührt).

export interface VerbundKernDeps {
  /** Pfad der gemeinsamen master-link.json. */
  dateiPfad: () => string;
  /** <userData>/master-link (identitaet.json, verbund.json). */
  speicherDir: () => string;
  suiteVersion: () => string;
  log: (stufe: 'info' | 'warn', text: string) => void;
  // Nähte für Tests — in der Produktion ungesetzt (Vorgabe):
  /** Vorgabe: die Datei lesen. */
  lies?: () => Lesen<MasterLinkDatei>;
  /** Vorgabe: atomar schreiben. Darf werfen. */
  schreibeAufPlatte?: (pfad: string, d: MasterLinkDatei) => void;
  netzwerkKarten?: () => NetzwerkInterfaces;
  /** Wiederholungen des Lesens beim Start (Vorgabe 10 × 500 ms, danach alle 5 s). */
  lesen?: { versuche?: number; pauseMs?: number; taktMs?: number };
  /** Vorgabe 10 s (Spec 4.1). */
  kartenTaktMs?: number;
  /** Bündelung der Änderungsmeldungen, Vorgabe 100 ms. */
  meldeVerzoegerungMs?: number;
  master?: Partial<MasterAbhaengigkeiten>;
  slave?: Partial<SlaveAbhaengigkeiten>;
}

function neueDatei(): MasterLinkDatei {
  return {
    version: 1,
    rolle: 'aus',
    rechner: { id: randomUUID(), name: kuerzeName(hostname()) },
    netzwerk: { karte: null },
    kopplung: null,
  };
}

export function erzeugeVerbundKern(d: VerbundKernDeps) {
  const karten = d.netzwerkKarten ?? networkInterfaces;
  const lies = d.lies ?? (() => leseMasterLinkDatei(d.dateiPfad()));
  const schreibeAufPlatte = d.schreibeAufPlatte ?? schreibeMasterLinkDatei;

  let datei: MasterLinkDatei = neueDatei();
  /** I/O-Code, solange master-link.json beim Start nicht lesbar ist (Spec 7.3) — dann wird NICHTS geschrieben. */
  let dateiFehler: string | null = null;
  let master: MasterRolle | null = null;
  let slave: SlaveRolle | null = null;
  let melde: () => void = () => {};
  let meldeZeitgeber: ReturnType<typeof setTimeout> | null = null;
  let kette: Promise<unknown> = Promise.resolve();
  let waechterStopp: (() => void) | null = null;

  /**
   * Nur der Launcher schreibt die gemeinsame Datei (Spec 7.1). WIRFT bei jedem Fehler (Code im Error) und übernimmt
   * `datei` erst NACH erfolgreichem Schreiben: nie „gespeichert“ melden oder im Speicher vorauseilen (Spec 10).
   */
  function schreibe(neu: MasterLinkDatei): void {
    if (dateiFehler) {
      // Spec 7.3/10: im Speicher steht nur eine Ersatzdatei (neue rechner.id) — nie über die echte Kopplung schreiben.
      d.log('warn', `master-link.json nicht lesbar (${dateiFehler}) — nicht überschrieben.`);
      throw Object.assign(new Error('master-link.json nicht lesbar'), { code: dateiFehler });
    }
    try {
      schreibeAufPlatte(d.dateiPfad(), neu);
    } catch (e) {
      d.log('warn', `master-link.json nicht geschrieben (${fehlerCode(e)}).`);
      throw e;
    }
    datei = neu;
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
    }, d.meldeVerzoegerungMs ?? 100);
  }

  function neuerMaster(): MasterRolle {
    return new MasterRolle({
      speicherDir: d.speicherDir(),
      suiteVersion: d.suiteVersion(),
      datei: () => datei,
      schreibeDatei: schreibe,
      beiAenderung: aenderung,
      log: d.log,
      netzwerkKarten: d.netzwerkKarten,
      ...d.master,
    });
  }

  function neuerSlave(): SlaveRolle {
    return new SlaveRolle({
      dateiPfad: d.dateiPfad(),
      suiteVersion: d.suiteVersion(),
      datei: () => datei,
      schreibeDatei: schreibe,
      beiAenderung: aenderung,
      log: d.log,
      netzwerkKarten: d.netzwerkKarten,
      ...d.slave,
    });
  }

  /** Startet die Rolle, die im Speicherstand (`datei`) steht. */
  async function starteRolleAusSpeicher(): Promise<void> {
    if (datei.rolle === 'master') {
      master = neuerMaster();
      await master.starte();
    } else if (datei.rolle === 'slave') {
      slave = neuerSlave();
      slave.starte();
    }
  }

  async function starteRolle(r: Exclude<Lesen<MasterLinkDatei>, { art: 'io' }>): Promise<void> {
    if (r.art === 'ok') {
      datei = r.wert;
    } else if (r.art === 'defekt') {
      // Nicht überschreiben: der Client meldet „Kopplung beschädigt: neu koppeln“, erst Koppeln schreibt neu.
      d.log('warn', 'master-link.json beschädigt — bitte neu koppeln.');
      datei = { ...neueDatei(), rolle: 'slave' };
    }
    await starteRolleAusSpeicher();
  }

  function stand(): VerbundStand {
    const { karten: liste, karteFehlt } = kartenLage(karten(), datei.netzwerk.karte);
    return {
      rolle: datei.rolle,
      rechnerName: datei.rechner.name,
      karten: liste,
      gewaehlteKarte: datei.netzwerk.karte,
      karteFehlt,
      dateiFehler,
      master: master?.stand() ?? null,
      slave: slave?.stand() ?? null,
    };
  }

  async function starte(): Promise<void> {
    waechterStopp?.();
    // Spec 4.1: Karten alle 10 s neu lesen — in JEDER Rolle, damit „· Karte fehlt“ den Kopf sofort erreicht.
    waechterStopp = beobachte(() => JSON.stringify(kartenLage(karten(), datei.netzwerk.karte)), aenderung, d.kartenTaktMs ?? 10_000);
    // Spec 7.3: I/O-Fehler (EBUSY/EPERM, Virenscanner) sind vorübergehend → erneut lesen, bis es gelingt.
    // Bis dahin startet keine Rolle und nichts wird geschrieben (Spec 10: nie still entkoppeln).
    const r = await leseBisLesbar(lies, (code) => {
      if (dateiFehler === null) d.log('warn', `master-link.json nicht lesbar (${code}) — Verbund wartet, nichts wird überschrieben.`);
      if (dateiFehler !== code) {
        dateiFehler = code;
        aenderung();
      }
    }, d.lesen);
    await nacheinander(async () => {
      const warGesperrt = dateiFehler !== null;
      dateiFehler = null;
      await starteRolle(r);
      if (warGesperrt) aenderung();
    });
  }

  /**
   * Beim Beenden des Launchers: alle Rollen anstoßen. KEIN Abwarten im Quit-Pfad (den teilen sich Installer und
   * Control-Server); MasterRolle.stoppe stößt dafür den Server vor dem mDNS-Goodbye an.
   */
  function beende(): Promise<void> {
    waechterStopp?.();
    waechterStopp = null;
    return Promise.all([master?.stoppe(), slave?.stoppe()]).then(() => undefined, () => undefined);
  }

  /** Spec 5.3: Aus ← Slave löscht die Kopplung; Aus ← Master setzt die Selbstkopplung außer Kraft. */
  function setzeRolle(rolle: VerbundRolle): Promise<VerbundStand> {
    return nacheinander(async () => {
      // Datei nicht lesbar: keine Rolle auf der Ersatzdatei starten (Spec 7.3).
      if (dateiFehler || rolle === datei.rolle) return stand();
      const m = master;
      const s = slave;
      master = null;
      slave = null;
      await m?.stoppe();
      await s?.stoppe();
      try {
        schreibe({ ...datei, rolle, kopplung: null });
      } catch (e) {
        // Die Datei ist unverändert (`datei` wird erst nach dem Schreiben übernommen): die vorige Rolle daraus wieder
        // herstellen, dann ablehnen — sonst stünde der Master zu, und die Anzeige behauptete weiter seine Rolle.
        try {
          await starteRolleAusSpeicher();
        } catch (e2) {
          d.log('warn', `Vorige Rolle nicht wiederhergestellt (${fehlerCode(e2)}).`);
        }
        aenderung();
        throw e;
      }
      await starteRolleAusSpeicher();
      aenderung();
      return stand();
    });
  }

  function setzeRechnerName(name: string): VerbundStand {
    schreibe({ ...datei, rechner: { ...datei.rechner, name: kuerzeName(name) } });
    master?.rechnerNameGeaendert(datei.rechner.name);
    aenderung();
    return stand();
  }

  function setzeMasterName(name: string): Promise<VerbundStand> {
    return nacheinander(async () => {
      await master?.setzeName(name);
      return stand();
    });
  }

  function setzeKarte(karte: string | null): Promise<VerbundStand> {
    return nacheinander(async () => {
      schreibe({ ...datei, netzwerk: { karte } });
      await master?.pruefeKarten();
      aenderung();
      return stand();
    });
  }

  function oeffneKopplung(): VerbundStand {
    master?.oeffneKopplung();
    return stand();
  }

  function neuerKoppelCode(): VerbundStand {
    master?.neuerCode();
    return stand();
  }

  function schliesseKopplung(): VerbundStand {
    master?.schliesseKopplung();
    return stand();
  }

  function entferneRechner(rechnerId: string): VerbundStand {
    master?.entferne(rechnerId);
    return stand();
  }

  function erneuereIdentitaet(): Promise<VerbundStand> {
    return nacheinander(async () => {
      await master?.erneuereIdentitaet();
      return stand();
    });
  }

  function setzeNeuAuf(): Promise<VerbundStand> {
    return nacheinander(async () => {
      await master?.neuAufsetzen();
      return stand();
    });
  }

  function starteMasterSuche(): void {
    slave?.starteSuche();
  }

  function stoppeMasterSuche(): void {
    slave?.stoppeSuche();
  }

  async function koppeleMitMaster(adresse: string, code: string): Promise<KoppelAntwort> {
    if (!slave) return { ok: false, text: 'Zuerst die Rolle „Mit Master verbinden“ wählen.' };
    return slave.koppele(adresse, code);
  }

  function brecheKoppelnAb(): void {
    slave?.brecheKoppelnAb();
  }

  /** Spec 5.3 „Trennen“: Kopplung löschen, Rolle bleibt; alle Tools trennen sich über die Datei. */
  function trenneVerbund(): VerbundStand {
    if (datei.rolle === 'slave') schreibe({ ...datei, kopplung: null });
    aenderung();
    return stand();
  }

  function setzeFesteAdresse(adresse: string | null): VerbundStand {
    if (datei.kopplung) {
      const a = adresse?.trim() ? adresse.trim() : null;
      schreibe({ ...datei, kopplung: { ...datei.kopplung, festeAdresse: a } });
    }
    aenderung();
    return stand();
  }

  return {
    setzeMelder: (fn: () => void): void => { melde = fn; },
    starte,
    beende,
    stand,
    setzeRolle,
    setzeRechnerName,
    setzeMasterName,
    setzeKarte,
    oeffneKopplung,
    neuerKoppelCode,
    schliesseKopplung,
    entferneRechner,
    erneuereIdentitaet,
    setzeNeuAuf,
    starteMasterSuche,
    stoppeMasterSuche,
    koppeleMitMaster,
    brecheKoppelnAb,
    trenneVerbund,
    setzeFesteAdresse,
  };
}

export type VerbundKern = ReturnType<typeof erzeugeVerbundKern>;
