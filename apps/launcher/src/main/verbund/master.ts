import { hostname, networkInterfaces } from 'node:os';
import { join } from 'node:path';
import {
  DateiVerbund, erzeugeSchluesselpaar, fingerprintVonPem, kuerzeName, kurzFingerprint, leseMitBak, listeKarten,
  loescheMitBak, MasterAnnonce, MasterLinkServer, pruefeIdentitaet, pruefeVerbund, schreibeMitBak, standardFabrik,
  wirksameKarten,
  type BonjourFabrik, type Fristen, type Identitaet, type Karte, type Kopplung, type MasterLinkDatei,
  type NetzwerkInterfaces, type Schluesselpaar, type VerbundDaten,
} from '@jm/master-link';
import type { MasterZustand, VerbundMasterStand, VerbundRechner } from '@shared/types';
import { fehlerCode } from './fehlercode';
import { erzeugeMasterIdentitaet } from './zertifikat';

// Master-Rolle des Launchers (Spec 2, 3.5, 4.2, 4.3, 7.2, 7.3). Kein Electron hier — der
// Aufrufer reicht Pfade und die gemeinsame master-link.json (lesen/schreiben) herein.

export interface MasterAbhaengigkeiten {
  /** <userData>/master-link */
  speicherDir: string;
  suiteVersion: string;
  datei: () => MasterLinkDatei;
  /** Schreibt die gemeinsame master-link.json. WIRFT bei einem Fehler (auch bei gesperrter Datei): nie „gespeichert“ melden, ohne zu speichern. */
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
  /** Nur Tests: läuft vor jedem Schreiben von identitaet.json/verbund.json durch diese Rolle und darf werfen. Produktion: ungesetzt. */
  vorSchreiben?: (pfad: string) => void;
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
  /**
   * Kette aller Karten-/Annonce-Läufe (Takt, setzeKarte, setzeName): Annonce und Server starten, aktualisieren und
   * stoppen nie gleichzeitig. stoppe() wartet sie ab, bevor es Annonce und Server schließt.
   */
  private kartenLauf: Promise<void> = Promise.resolve();
  /** Letzter geloggter Startfehler-Code: dieselbe Meldung steht nicht bei jeder Wiederholung (alle 10 s) im Log. */
  private letzterStartFehler: string | null = null;
  private letzterKartenFehler: string | null = null;

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
    // Ab hier bleibt nichts still hängen: jeder Wurf schließt, was schon offen ist, meldet „lausch-fehler“ mit Code
    // und plant die Wiederholung (Spec 5.4/7.3: die Statuszeile darf nicht bei „startet“ oder „läuft“ stehen bleiben).
    let verbund: DateiVerbund | null = null;
    let server: MasterLinkServer | null = null;
    try {
      let identitaet: Identitaet;
      if (id.art === 'ok') {
        identitaet = id.wert;
      } else {
        identitaet = erzeugeMasterIdentitaet(hostname());
        this.schreibeIdentitaet(identitaet);
        this.d.log('info', `Master-Identität erzeugt (${kurzFingerprint(fingerprintVonPem(identitaet.zertifikat))}).`);
      }
      this.identitaet = identitaet;
      this.ausBak = (id.art === 'ok' && id.ausBak) || (vb.art === 'ok' && vb.ausBak);
      if (this.ausBak) this.d.log('warn', 'Master: Verbunddaten aus .bak wiederhergestellt.');
      verbund = new DateiVerbund(this.vbPfad, vb.art === 'ok' ? vb.wert : { version: 1, rechner: [] }, {
        schreibIntervallMs: this.d.fristen?.gesehenSchreibMs,
        onFehler: (e) => this.d.log('warn', `verbund.json nicht geschrieben: ${e.message}`),
      });
      this.verbund = verbund;
      // Eintrag „dieser Rechner“ VOR dem Lauschen, damit die eigenen Tools sofort angenommen werden.
      const paar = this.selbstSchluessel(identitaet, verbund);
      const lausch = this.lauschAdressen();
      this.lauschSchluessel = JSON.stringify(lausch);
      server = new MasterLinkServer({
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
      await server.starte();
      if (this.gestoppt) {
        await server.stoppe();
        return;
      }
      // Kann die Selbstkopplung nicht gespeichert werden, finden die eigenen Tools den Master nicht: das ist ein
      // Startfehler, kein „läuft“ (der Wurf schließt den Server wieder).
      this.schreibeSelbstkopplung(identitaet, paar, server.port());
      this.server = server;
    } catch (e) {
      await this.startFehlgeschlagen(e, server, verbund);
      return;
    }
    this.letzterStartFehler = null;
    this.setzeZustand('laeuft', null);
    try {
      this.starteAnnonce();
    } catch (e) {
      // Eine fehlende Annonce (mDNS) legt den Master nicht lahm: Slaves koppeln auch per Adresse. Der Takt versucht sie erneut.
      this.kartenFehler(e);
    }
    this.kartenZeitgeber = setInterval(() => void this.pruefeKarten(), this.intervall());
    this.kartenZeitgeber.unref?.();
  }

  private async startFehlgeschlagen(e: unknown, server: MasterLinkServer | null, verbund: DateiVerbund | null): Promise<void> {
    const code = fehlerCode(e);
    this.server = null;
    try {
      await server?.stoppe();
    } catch {
      /* schon zu */
    }
    verbund?.schliesse();
    this.verbund = null;
    if (code !== this.letzterStartFehler) {
      this.letzterStartFehler = code;
      this.d.log('warn', `Master-Link lauscht nicht: ${code}`);
    }
    this.setzeZustand(code === 'EADDRINUSE' ? 'port-belegt' : 'lausch-fehler', code);
    this.planeWiederholung();
  }

  private schreibeIdentitaet(i: Identitaet): void {
    this.d.vorSchreiben?.(this.idPfad);
    schreibeMitBak(this.idPfad, `${JSON.stringify(i, null, 2)}\n`, pruefeIdentitaet);
  }

  private schreibeVerbundDatei(v: VerbundDaten): void {
    this.d.vorSchreiben?.(this.vbPfad);
    schreibeMitBak(this.vbPfad, `${JSON.stringify(v, null, 2)}\n`, pruefeVerbund);
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
    if (this.gestoppt) return;
    if (this.wiederholung) clearTimeout(this.wiederholung);
    this.wiederholung = setTimeout(() => {
      this.wiederholung = null;
      if (this.gestoppt || this.server) return;
      this.starte().catch((e) => this.d.log('warn', `Master-Link: Wiederholung fehlgeschlagen (${fehlerCode(e)}).`));
    }, this.intervall());
    this.wiederholung.unref?.();
  }

  /** Hängt einen Lauf an die Kartenkette: Läufe überlappen nie, und die Kette reißt nie ab (auch nicht nach einem Wurf). */
  private serialisiere(arbeit: () => Promise<void>): Promise<void> {
    const lauf = this.kartenLauf.then(arbeit);
    this.kartenLauf = lauf.then(() => {}, () => {});
    return lauf;
  }

  /** Nur bei geänderter Meldung loggen; der nächste Takt versucht die Annonce erneut (Schlüssel zurücksetzen). */
  private kartenFehler(e: unknown): void {
    this.kartenSchluessel = '';
    const code = fehlerCode(e);
    if (code === this.letzterKartenFehler) return;
    this.letzterKartenFehler = code;
    this.d.log('warn', `Master-Link: Annonce/Karten-Prüfung fehlgeschlagen (${code}).`);
  }

  /**
   * Alle 10 s und nach einer Kartenwahl: Lauscher und Annonce an die Karten anpassen (Spec 4.1).
   * Läuft über die Kartenkette, wirft nie (Meldung nur bei geänderter Ursache im Log).
   */
  pruefeKarten(): Promise<void> {
    return this.serialisiere(async () => {
      try {
        await this.pruefeKartenJetzt();
        this.letzterKartenFehler = null;
      } catch (e) {
        this.kartenFehler(e);
      }
    });
  }

  private async pruefeKartenJetzt(): Promise<void> {
    const s = this.server;
    if (!s || this.gestoppt) return;
    let geaendert = false;
    const lausch = this.lauschAdressen();
    const schluessel = JSON.stringify(lausch);
    if (schluessel !== this.lauschSchluessel) {
      this.lauschSchluessel = schluessel;
      geaendert = true;
      try {
        await s.setzeLauschAdressen(lausch);
      } catch (e) {
        this.d.log('warn', `Master-Link: Neubinden fehlgeschlagen (${fehlerCode(e)}).`);
      }
      // Nach jedem await: hat inzwischen stoppe() (oder ein neuer Start) übernommen, nichts mehr anfassen.
      if (this.gestoppt || this.server !== s) return;
    }
    const { wirksam } = this.karten();
    const k = JSON.stringify(wirksam);
    if (k !== this.kartenSchluessel) {
      this.kartenSchluessel = k;
      geaendert = true;
      await this.annonce?.aktualisiere(wirksam);
      if (this.gestoppt || this.server !== s) return;
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
    // Ein laufender Karten-/Annonce-Lauf darf nicht nach dem Schließen weiterbinden oder neu annoncieren:
    // abwarten (er bricht nach seinem nächsten await ab, weil gestoppt gesetzt ist).
    await this.kartenLauf;
    const annonce = this.annonce;
    const server = this.server;
    const verbund = this.verbund;
    this.annonce = null;
    this.server = null;
    // Reihenfolge: zuerst den Server anstoßen — sein synchroner Teil zerstört die Sockets und schreibt „zuletzt gesehen“ —
    // und erst dann auf das mDNS-Goodbye (bis 1 s) warten. Beim Beenden des Launchers ist der Prozess sonst vorher weg.
    const serverZu = server?.stoppe();
    const annonceZu = annonce?.stoppe();
    await Promise.allSettled([serverZu, annonceZu]);
    verbund?.schliesse();
    this.verbund = null;
    // Nach dem Schließen nie „läuft“ melden: die Instanz ist zu (Zustand „startet“ ohne Ereignis, bis ein neuer Start ihn setzt).
    if (this.zustand === 'laeuft') {
      this.zustand = 'startet';
      this.fehlerCode = null;
    }
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
    // Lässt sich die Identität nicht speichern, bleibt ALLES beim alten Namen (Wurf, nichts halb umbenannt).
    this.schreibeIdentitaet(neu);
    this.identitaet = neu;
    this.server?.setzeName(neu.name);
    // master-link.json nachziehen. Ein Schreibfehler hier darf Server und Annonce nicht beim alten Namen lassen:
    // erst vollständig umbenennen, den Fehler danach weiterwerfen (der nächste Start schreibt die Selbstkopplung neu).
    let dateiWurf: { e: unknown } | null = null;
    try {
      const d = this.d.datei();
      if (d.kopplung) this.d.schreibeDatei({ ...d, kopplung: { ...d.kopplung, masterName: neu.name } });
    } catch (e) {
      dateiWurf = { e };
      this.d.log('warn', `Master-Name nicht in master-link.json nachgetragen (${fehlerCode(e)}).`);
    }
    await this.serialisiere(async () => {
      const a = this.annonce;
      if (!a || this.gestoppt) return;
      try {
        await a.aktualisiere(this.karten().wirksam, neu.name);
      } catch (e) {
        this.kartenFehler(e);
      }
    });
    this.d.beiAenderung();
    if (dateiWurf) throw dateiWurf.e;
  }

  rechnerNameGeaendert(name: string): void {
    const eigen = this.verbund?.liste().find((e) => e.dieserRechner);
    if (eigen) this.verbund?.setzeDiesenRechner({ ...eigen, name });
  }

  /** Spec 3.5: stoppen (alle Sockets zu) → neue Identität → nur fremde Rechner raus → Start (Selbstkopplung neu). */
  async erneuereIdentitaet(): Promise<void> {
    const name = this.identitaet?.name ?? hostname();
    await this.stoppe();
    // Nach dem Stoppen ist der Master zu: scheitert das Erzeugen oder Schreiben, TROTZDEM neu starten (liest den
    // Plattenstand neu und setzt einen ehrlichen Zustand) und den Fehler danach weiterwerfen, damit der Aufruf ablehnt.
    let wurf: { e: unknown } | null = null;
    try {
      const neu = erzeugeMasterIdentitaet(name);
      this.schreibeIdentitaet(neu);
      const vb = leseMitBak(this.vbPfad, pruefeVerbund);
      const nurSelbst = vb.art === 'ok' ? vb.wert.rechner.filter((e) => e.dieserRechner) : [];
      this.schreibeVerbundDatei({ version: 1, rechner: nurSelbst });
      this.d.log('info', 'Master-Identität erneuert — alle anderen Rechner müssen neu gekoppelt werden.');
    } catch (e) {
      wurf = { e };
      this.d.log('warn', `Master-Identität nicht erneuert (${fehlerCode(e)}).`);
    }
    await this.starte();
    if (wurf) throw wurf.e;
  }

  /** Nur bei „Verbunddaten beschädigt“ angeboten: alles verwerfen, neu beginnen. */
  async neuAufsetzen(): Promise<void> {
    await this.stoppe();
    let wurf: { e: unknown } | null = null;
    try {
      loescheMitBak(this.idPfad);
      loescheMitBak(this.vbPfad);
    } catch (e) {
      wurf = { e };
      this.d.log('warn', `Verbunddaten nicht gelöscht (${fehlerCode(e)}).`);
    }
    await this.starte();
    if (wurf) throw wurf.e;
  }

  stand(): VerbundMasterStand {
    const server = this.server;
    const teilnehmer = server?.teilnehmer() ?? [];
    const rechner: VerbundRechner[] = (this.verbund?.liste() ?? [])
      .map((e) => ({
        rechnerId: e.rechnerId,
        // Namen kommen aus Dateien und vom Netz (verbund.json prüft nur den Typ): an der Quelle kürzen.
        name: kuerzeName(e.name),
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
      name: this.identitaet ? kuerzeName(this.identitaet.name) : '',
      fpKurz: this.identitaet ? kurzFingerprint(fingerprintVonPem(this.identitaet.zertifikat)) : '',
      ausBak: this.ausBak,
      rechner,
      kopplung: server?.kopplungsStand() ?? LEER_FENSTER,
    };
  }
}
