import { hostname, networkInterfaces } from 'node:os';
import { join } from 'node:path';
import {
  DateiVerbund, erzeugeSchluesselpaar, fingerprintVonPem, kuerzeName, kurzFingerprint, leseMitBak, listeKarten,
  loescheMitBak, MasterAnnonce, MasterLinkServer, pruefeIdentitaet, pruefeVerbund, schreibeMitBak, standardFabrik,
  wirksameKarten,
  type BonjourFabrik, type Fristen, type Identitaet, type Karte, type Kopplung, type MasterLinkDatei,
  type NetzwerkInterfaces, type Schluesselpaar,
} from '@jm/master-link';
import type { MasterZustand, VerbundMasterStand, VerbundRechner } from '@shared/types';
import { erzeugeMasterIdentitaet } from './zertifikat';

// Master-Rolle des Launchers (Spec 2, 3.5, 4.2, 4.3, 7.2, 7.3). Kein Electron hier — der
// Aufrufer reicht Pfade und die gemeinsame master-link.json (lesen/schreiben) herein.

export interface MasterAbhaengigkeiten {
  /** <userData>/master-link */
  speicherDir: string;
  suiteVersion: string;
  datei: () => MasterLinkDatei;
  schreibeDatei: (d: MasterLinkDatei) => void;
  beiAenderung: () => void;
  log: (stufe: 'info' | 'warn', text: string) => void;
  /** Vorgabe 8738. */
  port?: number;
  fristen?: Partial<Fristen>;
  netzwerkKarten?: () => NetzwerkInterfaces;
  /** null = keine mDNS-Annonce (Tests). */
  mdnsFabrik?: BonjourFabrik | null;
  /** Nur Tests: feste Lauschadressen statt Netzwerkwahl. */
  lauschAdressen?: string[];
}

const LEER_FENSTER = { offen: false, code: null, gueltigBis: null, rest: 0, ungueltig: false };

export class MasterRolle {
  private readonly d: MasterAbhaengigkeiten;
  private server: MasterLinkServer | null = null;
  private annonce: MasterAnnonce | null = null;
  private verbund: DateiVerbund | null = null;
  private identitaet: Identitaet | null = null;
  private zustand: MasterZustand = 'startet';
  private fehlerCode: string | null = null;
  private ausBak = false;
  private kartenZeitgeber: ReturnType<typeof setInterval> | null = null;
  private wiederholung: ReturnType<typeof setTimeout> | null = null;
  private lauschSchluessel = '';
  private kartenSchluessel = '';
  private gestoppt = false;
  private laufenderStart: Promise<void> | null = null;

  constructor(d: MasterAbhaengigkeiten) {
    this.d = d;
  }

  private get idPfad(): string {
    return join(this.d.speicherDir, 'identitaet.json');
  }

  private get vbPfad(): string {
    return join(this.d.speicherDir, 'verbund.json');
  }

  private karten(): { wirksam: Karte[]; karteFehlt: boolean } {
    const alle = listeKarten((this.d.netzwerkKarten ?? networkInterfaces)());
    const w = wirksameKarten(alle, this.d.datei().netzwerk.karte);
    return { wirksam: w.karten, karteFehlt: w.karteFehlt };
  }

  /**
   * Spec 4.3: Automatisch → 0.0.0.0; gewählte Karte → alle ihre IPv4 + 127.0.0.1 (eigene Tools).
   * Fehlt die gewählte Karte (Kabel gezogen), gilt Automatisch (4.1) als EINZELNE Lauscher aller Karten
   * + 127.0.0.1: ein Wechsel auf 0.0.0.0 schlösse den Loopback-Lauscher samt den Sitzungen der eigenen
   * Tools (Spec 2, 4.3: „Der Loopback-Lauscher bleibt“).
   */
  private lauschAdressen(): string[] {
    if (this.d.lauschAdressen) return this.d.lauschAdressen;
    if (this.d.datei().netzwerk.karte === null) return ['0.0.0.0'];
    const { wirksam } = this.karten();
    return [...wirksam.flatMap((k) => k.adressen.map((a) => a.adresse)), '127.0.0.1'];
  }

  private intervall(): number {
    return this.d.fristen?.kartenPruefMs ?? 10_000;
  }

  private setzeZustand(z: MasterZustand, code: string | null): void {
    this.zustand = z;
    this.fehlerCode = code;
    this.d.beiAenderung();
  }

  async starte(): Promise<void> {
    const lauf = this.starteJetzt();
    this.laufenderStart = lauf;
    try {
      await lauf;
    } finally {
      if (this.laufenderStart === lauf) this.laufenderStart = null;
    }
  }

  private async starteJetzt(): Promise<void> {
    this.gestoppt = false;
    this.setzeZustand('startet', null);
    const id = leseMitBak(this.idPfad, pruefeIdentitaet);
    const vb = leseMitBak(this.vbPfad, pruefeVerbund);
    if (id.art === 'io' || vb.art === 'io') {
      this.setzeZustand('lausch-fehler', id.art === 'io' ? id.code : vb.art === 'io' ? vb.code : 'EIO');
      this.planeWiederholung();
      return;
    }
    if (id.art === 'beschaedigt' || vb.art === 'beschaedigt') {
      // NIE still neu erzeugen und NIE „unbekannt“ an Slaves: gar nicht erst lauschen.
      this.setzeZustand('daten-beschaedigt', null);
      this.d.log('warn', 'Master: identitaet.json/verbund.json beschädigt (auch .bak) — Master-Link startet nicht, nichts wird überschrieben.');
      return;
    }
    let identitaet: Identitaet;
    if (id.art === 'ok') {
      identitaet = id.wert;
    } else {
      identitaet = erzeugeMasterIdentitaet(hostname());
      schreibeMitBak(this.idPfad, `${JSON.stringify(identitaet, null, 2)}\n`, pruefeIdentitaet);
      this.d.log('info', `Master-Identität erzeugt (${kurzFingerprint(fingerprintVonPem(identitaet.zertifikat))}).`);
    }
    this.identitaet = identitaet;
    this.ausBak = (id.art === 'ok' && id.ausBak) || (vb.art === 'ok' && vb.ausBak);
    if (this.ausBak) this.d.log('warn', 'Master: Verbunddaten aus .bak wiederhergestellt.');
    const verbund = new DateiVerbund(this.vbPfad, vb.art === 'ok' ? vb.wert : { version: 1, rechner: [] }, {
      schreibIntervallMs: this.d.fristen?.gesehenSchreibMs,
      onFehler: (e) => this.d.log('warn', `verbund.json nicht geschrieben: ${e.message}`),
    });
    this.verbund = verbund;
    // Eintrag „dieser Rechner“ VOR dem Lauschen, damit die eigenen Tools sofort angenommen werden.
    const paar = this.selbstSchluessel(identitaet, verbund);
    const lausch = this.lauschAdressen();
    this.lauschSchluessel = JSON.stringify(lausch);
    const server = new MasterLinkServer({
      identitaet,
      verbund,
      eigeneRechnerId: this.d.datei().rechner.id,
      suiteVersion: this.d.suiteVersion,
      lauschAdressen: lausch,
      port: this.d.port,
      fristen: this.d.fristen,
      netzwerkKarten: this.d.netzwerkKarten,
      log: this.d.log,
    });
    server.on('aenderung', () => this.d.beiAenderung());
    try {
      await server.starte();
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code ?? 'UNBEKANNT';
      this.d.log('warn', `Master-Link lauscht nicht: ${code}`);
      verbund.schliesse();
      this.verbund = null;
      this.setzeZustand(code === 'EADDRINUSE' ? 'port-belegt' : 'lausch-fehler', code);
      this.planeWiederholung();
      return;
    }
    if (this.gestoppt) {
      await server.stoppe();
      return;
    }
    this.server = server;
    this.schreibeSelbstkopplung(identitaet, paar, server.port());
    this.setzeZustand('laeuft', null);
    this.starteAnnonce();
    this.kartenZeitgeber = setInterval(() => void this.pruefeKarten(), this.intervall());
    this.kartenZeitgeber.unref?.();
  }

  private selbstSchluessel(identitaet: Identitaet, verbund: DateiVerbund): Schluesselpaar {
    const d = this.d.datei();
    const fp = fingerprintVonPem(identitaet.zertifikat);
    const eigen = verbund.liste().find((e) => e.dieserRechner);
    const k = d.kopplung;
    const passt = d.rolle === 'master' && k !== null && k.fingerprint === fp && eigen !== undefined
      && eigen.rechnerId === d.rechner.id && eigen.schluessel === k.schluessel.oeffentlich;
    if (passt && k) return k.schluessel;
    const paar = erzeugeSchluesselpaar();
    verbund.setzeDiesenRechner({
      rechnerId: d.rechner.id,
      name: d.rechner.name,
      schluessel: paar.oeffentlich,
      gekoppeltAm: Date.now(),
      zuletztGesehen: null,
      letzteAdresse: null,
      dieserRechner: true,
    });
    return paar;
  }

  private schreibeSelbstkopplung(identitaet: Identitaet, paar: Schluesselpaar, port: number): void {
    const d = this.d.datei();
    const kopplung: Kopplung = {
      masterId: identitaet.masterId,
      masterName: identitaet.name,
      fingerprint: fingerprintVonPem(identitaet.zertifikat),
      zertifikat: identitaet.zertifikat,
      port,
      adressen: [],
      letzteAdresse: null,
      festeAdresse: null,
      schluessel: paar,
    };
    if (d.rolle !== 'master' || JSON.stringify(d.kopplung) !== JSON.stringify(kopplung)) {
      this.d.schreibeDatei({ ...d, rolle: 'master', kopplung });
    }
  }

  private starteAnnonce(): void {
    if (this.d.mdnsFabrik === null || !this.server || !this.identitaet) return;
    const fabrik = this.d.mdnsFabrik ?? standardFabrik((t) => this.d.log('warn', t));
    this.annonce = new MasterAnnonce(fabrik, {
      masterId: this.identitaet.masterId,
      name: this.identitaet.name,
      fp: this.server.fingerprint,
      port: this.server.port(),
    });
    const { wirksam } = this.karten();
    this.kartenSchluessel = JSON.stringify(wirksam);
    this.annonce.starte(wirksam);
  }

  private planeWiederholung(): void {
    if (this.wiederholung) clearTimeout(this.wiederholung);
    this.wiederholung = setTimeout(() => {
      this.wiederholung = null;
      if (!this.gestoppt && !this.server) void this.starte();
    }, this.intervall());
    this.wiederholung.unref?.();
  }

  /** Alle 10 s und nach einer Kartenwahl: Lauscher und Annonce an die Karten anpassen (Spec 4.1). */
  async pruefeKarten(): Promise<void> {
    if (!this.server) return;
    let geaendert = false;
    const lausch = this.lauschAdressen();
    const s = JSON.stringify(lausch);
    if (s !== this.lauschSchluessel) {
      this.lauschSchluessel = s;
      geaendert = true;
      try {
        await this.server.setzeLauschAdressen(lausch);
      } catch (e) {
        this.d.log('warn', `Master-Link: Neubinden fehlgeschlagen (${(e as NodeJS.ErrnoException).code ?? (e as Error).message}).`);
      }
    }
    const { wirksam } = this.karten();
    const k = JSON.stringify(wirksam);
    if (k !== this.kartenSchluessel) {
      this.kartenSchluessel = k;
      geaendert = true;
      await this.annonce?.aktualisiere(wirksam);
    }
    if (geaendert) this.d.beiAenderung();
  }

  async stoppe(): Promise<void> {
    this.gestoppt = true;
    // Review Focus 2: ein laufender Start hält den Port, bis sein server.starte() zurückkehrt (danach
    // schließt er selbst). Abwarten — sonst meldet die nächste MasterRolle EADDRINUSE („Port belegt“).
    await this.laufenderStart?.catch(() => {});
    if (this.kartenZeitgeber) {
      clearInterval(this.kartenZeitgeber);
      this.kartenZeitgeber = null;
    }
    if (this.wiederholung) {
      clearTimeout(this.wiederholung);
      this.wiederholung = null;
    }
    await this.annonce?.stoppe();
    this.annonce = null;
    await this.server?.stoppe();
    this.server = null;
    this.verbund?.schliesse();
    this.verbund = null;
  }

  oeffneKopplung(): void {
    this.server?.oeffneKopplung();
  }

  neuerCode(): void {
    this.server?.neuerCode();
  }

  schliesseKopplung(): void {
    this.server?.schliesseKopplung();
  }

  entferne(rechnerId: string): void {
    this.server?.entferne(rechnerId);
  }

  async setzeName(name: string): Promise<void> {
    if (!this.identitaet) return;
    const neu: Identitaet = { ...this.identitaet, name: kuerzeName(name) };
    schreibeMitBak(this.idPfad, `${JSON.stringify(neu, null, 2)}\n`, pruefeIdentitaet);
    this.identitaet = neu;
    this.server?.setzeName(neu.name);
    const d = this.d.datei();
    if (d.kopplung) this.d.schreibeDatei({ ...d, kopplung: { ...d.kopplung, masterName: neu.name } });
    await this.annonce?.aktualisiere(this.karten().wirksam, neu.name);
    this.d.beiAenderung();
  }

  rechnerNameGeaendert(name: string): void {
    const eigen = this.verbund?.liste().find((e) => e.dieserRechner);
    if (eigen) this.verbund?.setzeDiesenRechner({ ...eigen, name });
  }

  /** Spec 3.5: stoppen (alle Sockets zu) → neue Identität → nur fremde Rechner raus → Start (Selbstkopplung neu). */
  async erneuereIdentitaet(): Promise<void> {
    const name = this.identitaet?.name ?? hostname();
    await this.stoppe();
    const neu = erzeugeMasterIdentitaet(name);
    schreibeMitBak(this.idPfad, `${JSON.stringify(neu, null, 2)}\n`, pruefeIdentitaet);
    const vb = leseMitBak(this.vbPfad, pruefeVerbund);
    const nurSelbst = vb.art === 'ok' ? vb.wert.rechner.filter((e) => e.dieserRechner) : [];
    schreibeMitBak(this.vbPfad, `${JSON.stringify({ version: 1, rechner: nurSelbst }, null, 2)}\n`, pruefeVerbund);
    this.d.log('info', 'Master-Identität erneuert — alle anderen Rechner müssen neu gekoppelt werden.');
    await this.starte();
  }

  /** Nur bei „Verbunddaten beschädigt“ angeboten: alles verwerfen, neu beginnen. */
  async neuAufsetzen(): Promise<void> {
    await this.stoppe();
    loescheMitBak(this.idPfad);
    loescheMitBak(this.vbPfad);
    await this.starte();
  }

  stand(): VerbundMasterStand {
    const server = this.server;
    const teilnehmer = server?.teilnehmer() ?? [];
    const rechner: VerbundRechner[] = (this.verbund?.liste() ?? [])
      .map((e) => ({
        rechnerId: e.rechnerId,
        name: e.name,
        dieserRechner: e.dieserRechner,
        online: server?.rechnerOnline(e.rechnerId) ?? false,
        zuletztGesehen: e.zuletztGesehen,
        adresse: e.letzteAdresse,
        tools: teilnehmer
          .filter((t) => t.rechnerId === e.rechnerId)
          .map((t) => ({ appId: t.appId, name: t.name, version: t.version, art: t.art, verbundenSeit: t.seit })),
      }))
      .sort((a, b) => Number(b.dieserRechner) - Number(a.dieserRechner) || a.name.localeCompare(b.name));
    return {
      zustand: this.zustand,
      fehlerCode: this.fehlerCode,
      name: this.identitaet?.name ?? '',
      fpKurz: this.identitaet ? kurzFingerprint(fingerprintVonPem(this.identitaet.zertifikat)) : '',
      ausBak: this.ausBak,
      rechner,
      kopplung: server?.kopplungsStand() ?? LEER_FENSTER,
    };
  }
}
