import { randomUUID } from 'node:crypto';
import { statSync } from 'node:fs';
import { hostname, networkInterfaces } from 'node:os';
import {
  kuerzeName, leseMasterLinkDatei, schreibeMasterLinkDatei, verbindungsrelevantGeaendert,
  type Lesen, type MasterLinkDatei, type NetzwerkInterfaces,
} from '@jm/master-link';
import type { KoppelAntwort, VerbundRolle, VerbundStand } from '@shared/types';
import { pruefeFesteAdresse, pruefeKarte, pruefeKoppelEingabe, pruefeName, pruefeRechnerId, pruefeRolle } from './eingaben';
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
  /** Takt der Datei-Wache auf master-link.json, Vorgabe 5 s (wie der Client, Spec 7.1). */
  dateiTaktMs?: number;
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
  let dateiWacheStopp: (() => void) | null = null;
  /** Der Speicherstand stammt aus „Datei fehlt“ (neue Kennung nur im Speicher): ein weiteres „fehlt“ ändert nichts. */
  let platteFehlt = false;
  /**
   * Wunsch: die Liste „gefundene Master“ soll suchen (solange das Modal offen ist). Der Kern führt ihn, nicht die
   * SlaveRolle: jede NEU angelegte SlaveRolle übernimmt ihn (Rollenwechsel, Wiederanlauf nach gesperrter Datei,
   * Wiederherstellung nach Schreibfehler), und ein Schließen vor dem Ende eines Rollenwechsels lässt nichts laufen.
   */
  let sucheGewuenscht = false;
  /** B9: gesendete Kopplungscodes (SHA-256) über Rollenwechsel hinweg — ein Neustart der Rolle hebt die Sperre nicht auf. */
  const gesendeteCodes = new Map<string, number>();

  /**
   * Nur der Launcher schreibt die gemeinsame Datei (Spec 7.1). WIRFT bei jedem Fehler (Code im Error) und übernimmt
   * `datei` erst NACH erfolgreichem Schreiben: nie „gespeichert“ melden oder im Speicher vorauseilen (Spec 10).
   */
  function schreibe(neu: MasterLinkDatei): void {
    if (dateiFehler) {
      // Spec 7.3/10: im Speicher steht nur eine Ersatzdatei (neue rechner.id) — nie über die echte Kopplung schreiben.
      d.log('warn', `master-link.json nicht lesbar (${dateiFehler}) — nicht überschrieben.`);
      // Code AM ANFANG der Meldung: über IPC kommt nur die Meldung an, ablehnungCode im Renderer liest ihn dort (B7).
      throw Object.assign(new Error(`${dateiFehler}: master-link.json nicht lesbar`), { code: dateiFehler });
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
      gesendeteCodes,
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
      if (sucheGewuenscht) slave.starteSuche();
    }
  }

  /** Speicherstand aus einem Lesergebnis — beim Start und für die Datei-Wache gleich (Spec 7.3). */
  function standAusPlatte(r: Exclude<Lesen<MasterLinkDatei>, { art: 'io' }>): MasterLinkDatei {
    platteFehlt = r.art === 'fehlt';
    if (r.art === 'ok') return r.wert;
    if (r.art === 'defekt') {
      // Nicht überschreiben: der Client meldet „Kopplung beschädigt: neu koppeln“, erst Koppeln schreibt neu.
      d.log('warn', 'master-link.json beschädigt — bitte neu koppeln.');
      return { ...neueDatei(), rolle: 'slave' };
    }
    return neueDatei();
  }

  async function starteRolle(r: Exclude<Lesen<MasterLinkDatei>, { art: 'io' }>): Promise<void> {
    datei = standAusPlatte(r);
    await starteRolleAusSpeicher();
  }

  /**
   * Endprüfung B4 (Ruling): master-link.json von außen geändert (gelöscht, von Hand bearbeitet, defekt, gesperrt).
   * Der Plattenstand ist Wahrheit — die Tools folgen der Datei, der Launcher zeigt dasselbe. Läuft über `nacheinander`.
   * Eigene Schreibvorgänge ändern nur die mtime: der Vergleich mit dem Speicherstand erkennt sie, nichts startet neu.
   */
  async function uebernimmPlatte(): Promise<void> {
    const r = lies();
    if (r.art === 'io') {
      // Spec 7.3: vorübergehend — nichts überschreiben (schreibe() lehnt ab), die Rolle läuft mit dem letzten Stand weiter.
      if (dateiFehler !== r.code) {
        d.log('warn', `master-link.json nicht lesbar (${r.code}) — nichts wird überschrieben.`);
        dateiFehler = r.code;
        aenderung();
      }
      return;
    }
    const warGesperrt = dateiFehler !== null;
    dateiFehler = null;
    if (warGesperrt) aenderung();
    if (r.art === 'fehlt' && platteFehlt) return;
    if (r.art === 'ok' && JSON.stringify(r.wert) === JSON.stringify(datei)) {
      platteFehlt = false;
      return;
    }
    const neu = standAusPlatte(r);
    if (!verbindungsrelevantGeaendert(datei, neu)) {
      datei = neu; // nur Namen/Adressen: übernehmen, ohne die Rolle zu stören (Spec 7.1)
      aenderung();
      return;
    }
    d.log('info', `master-link.json von außen geändert (${r.art === 'fehlt' ? 'gelöscht' : r.art === 'defekt' ? 'beschädigt' : 'neuer Stand'}) — Verbund folgt der Datei.`);
    const m = master;
    const s = slave;
    master = null;
    slave = null;
    await m?.stoppe();
    await s?.stoppe();
    datei = neu;
    await starteRolleAusSpeicher();
    aenderung();
  }

  /** Muster wie wache.beobachte: mtime im Takt; solange die Datei gesperrt ist, jeden Takt neu lesen. */
  function beobachteDatei(): () => void {
    const lage = (): string => {
      try {
        return String(statSync(d.dateiPfad()).mtimeMs);
      } catch (e) {
        return `fehler:${fehlerCode(e)}`;
      }
    };
    let vorher = lage();
    let laeuft = false;
    const zeitgeber = setInterval(() => {
      const jetzt = lage();
      if ((jetzt === vorher && dateiFehler === null) || laeuft) return;
      vorher = jetzt;
      laeuft = true;
      nacheinander(uebernimmPlatte)
        .catch((e) => d.log('warn', `Verbund: Dateiänderung nicht übernommen (${fehlerCode(e)}).`))
        .finally(() => { laeuft = false; });
    }, d.dateiTaktMs ?? 5000);
    zeitgeber.unref?.();
    return () => clearInterval(zeitgeber);
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
    dateiWacheStopp?.();
    dateiWacheStopp = beobachteDatei();
  }

  /**
   * Beim Beenden des Launchers: alle Rollen anstoßen. KEIN Abwarten im Quit-Pfad (den teilen sich Installer und
   * Control-Server); MasterRolle.stoppe stößt dafür den Server vor dem mDNS-Goodbye an.
   */
  function beende(): Promise<void> {
    waechterStopp?.();
    waechterStopp = null;
    dateiWacheStopp?.();
    dateiWacheStopp = null;
    sucheGewuenscht = false;
    return Promise.all([master?.stoppe(), slave?.stoppe()]).then(() => undefined, () => undefined);
  }

  /** Spec 5.3: Aus ← Slave löscht die Kopplung; Aus ← Master setzt die Selbstkopplung außer Kraft. */
  async function setzeRolle(eingabe: VerbundRolle): Promise<VerbundStand> {
    const rolle = pruefeRolle(eingabe); // B8: über IPC kann alles kommen — nie ungeprüft in die Datei
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

  function setzeRechnerName(eingabe: string): VerbundStand {
    const name = pruefeName(eingabe);
    schreibe({ ...datei, rechner: { ...datei.rechner, name: kuerzeName(name) } });
    master?.rechnerNameGeaendert(datei.rechner.name);
    aenderung();
    return stand();
  }

  async function setzeMasterName(eingabe: string): Promise<VerbundStand> {
    const name = pruefeName(eingabe);
    return nacheinander(async () => {
      await master?.setzeName(name);
      return stand();
    });
  }

  async function setzeKarte(eingabe: string | null): Promise<VerbundStand> {
    const karte = pruefeKarte(eingabe);
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

  function entferneRechner(eingabe: string): VerbundStand {
    const rechnerId = pruefeRechnerId(eingabe);
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
    sucheGewuenscht = true;
    slave?.starteSuche();
  }

  function stoppeMasterSuche(): void {
    sucheGewuenscht = false;
    slave?.stoppeSuche();
  }

  async function koppeleMitMaster(adresseEingabe: string, codeEingabe: string): Promise<KoppelAntwort> {
    const { adresse, code } = pruefeKoppelEingabe(adresseEingabe, codeEingabe);
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

  /**
   * Endprüfung B3 (Ruling): geklonter Rechner („Kennung doppelt“, „Anmeldung abgelehnt“, Koppel-Ablehnung rechner-id).
   * Neue rechner.id, Kopplung weg, Rolle bleibt — die EINZIGE Ausnahme von „rechner.id bleibt“ (Spec 7.1, Nachtrag).
   * Die Rolle startet danach neu (wie nach Trennen): der alte Client mit der alten Kennung ist sofort weg und verdrängt
   * das Original nicht noch einmal am Master.
   */
  function neueKennung(): Promise<VerbundStand> {
    return nacheinander(async () => {
      // Wirft bei dateiFehler bzw. Schreibfehler, ohne etwas zu ändern (`datei` erst nach dem Schreiben).
      schreibe({ ...datei, rechner: { ...datei.rechner, id: randomUUID() }, kopplung: null });
      d.log('info', 'Neue Kennung für diesen Rechner erzeugt — bitte neu koppeln.');
      const m = master;
      const s = slave;
      master = null;
      slave = null;
      await m?.stoppe();
      await s?.stoppe();
      await starteRolleAusSpeicher();
      aenderung();
      return stand();
    });
  }

  function setzeFesteAdresse(eingabe: string | null): VerbundStand {
    if (datei.kopplung) {
      // B8: „host“ oder „host:Kopplungsport“ wie beim Koppeln; gespeichert wird nur der Host, anderes lehnt EINVAL ab.
      const a = pruefeFesteAdresse(eingabe, datei.kopplung.port);
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
    neueKennung,
    setzeFesteAdresse,
  };
}

export type VerbundKern = ReturnType<typeof erzeugeVerbundKern>;
