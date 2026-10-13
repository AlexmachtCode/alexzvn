import { EventEmitter } from 'node:events';
import type { Socket } from 'node:net';
import { networkInterfaces } from 'node:os';
import { createServer, type Server as TlsServer, type TLSSocket } from 'node:tls';
import { randomNonce } from '@jm/auth-core';
import { listeKarten, type NetzwerkInterfaces } from './adresswahl';
import { fingerprintVonPem, gleicherBeweis, istEd25519Oeffentlich, masterBeweis, pruefeAnmeldung, slaveBeweis } from './beweis';
import { erzeugeCode } from './code';
import { fristen as mitFristen, GRENZEN, kuerzeName, MASTER_PORT, type Fristen } from './fristen';
import { PROTOKOLL, type DatenZeile, type Grund, type Nachricht, type TeilnehmerInfo } from './rahmen';
import { pruefeAbo } from './show-daten';
import type { Identitaet, VerbundSpeicher } from './speicher';
import { Verbindung } from './verbindung';

// Master-Link-Server (Spec 3, 5, 6). Jeder Teilnehmer (Tool/Slave-Launcher) hat eine eigene
// Verbindung; Schlüssel am Master ist rechnerId + appId, die neuere Verbindung gewinnt.
// Teil 2b (Spec 13.6, 13.7): Show-Daten hängen an der Sitzungs-Kennung `sitzung`, nicht am Schlüssel. Ereignisse:
//  - 'daten' (t: TeilnehmerDaten, abo: AboInhalt) — ein gültiges abo einer angemeldeten Sitzung
//  - 'getrennt' (sitzung: number)  — genau einmal je angemeldeter Sitzung (Ersetzen, Ende oder stoppe())
//  - 'entstaut' (sitzung: number)  — nach 'gestaut' beim nächsten drain
//  - 'aenderung' (ohne Nutzlast)    — Teilnehmerliste/Kopplung geändert (Teil 1, hat mit der Nachricht nichts zu tun)

export interface TeilnehmerStand extends TeilnehmerInfo {
  rechnerId: string;
  adresse: string;
  seit: number;
  letzteZeile: number;
  /** Teil 2b: Sitzungs-Kennung (Zähler je Server, ab 1). */
  sitzung: number;
}

/** Teil 2b (Spec 13.7): wer ein Abo schickt. `appId` meldet der Teilnehmer selbst (gekürzt, Spec 22). */
export interface TeilnehmerDaten {
  sitzung: number;
  schluessel: string;
  rechnerId: string;
  art: 'tool' | 'launcher';
  appId: string;
  dieserRechner: boolean;
}

/** Teil 2b (Spec 13.6): Ergebnis von sendeDaten. */
export type SendeErgebnis = 'gesendet' | 'gestaut' | 'weg';

export interface KopplungsStand {
  offen: boolean;
  code: string | null;
  gueltigBis: number | null;
  rest: number;
  ungueltig: boolean;
}

export interface ServerOptionen {
  identitaet: Identitaet;
  verbund: VerbundSpeicher;
  /** rechner.id des Master-Rechners (Selbstkopplung) — koppeln damit wird abgelehnt. */
  eigeneRechnerId: string;
  suiteVersion: string;
  /** ['0.0.0.0'] (Automatisch) oder [...Karten-IPs, '127.0.0.1'] (gewählte Karte). */
  lauschAdressen: string[];
  /** Vorgabe 8738; 0 = freier Port (Tests). */
  port?: number;
  fristen?: Partial<Fristen>;
  jetzt?: () => number;
  netzwerkKarten?: () => NetzwerkInterfaces;
  /** Vom Signatur-Ratenlimit ausgenommene Quellen. Vorgabe: Loopback (Tools am Master). */
  ratenAusnahme?: (ip: string) => boolean;
  log?: (stufe: 'info' | 'warn', text: string) => void;
}

interface Sitzung {
  v: Verbindung;
  roh: Socket;
  nonce: string;
  angemeldet: boolean;
  wartetAufTeilnehmer: boolean;
  ersteNachricht: boolean;
  rechnerId: string | null;
  info: TeilnehmerInfo | null;
  schluessel: string | null;
  seit: number;
  letzteZeile: number;
  stille: ReturnType<typeof setTimeout> | null;
  /** Teil 2b: 0 bis zur Anmeldung, dann die Kennung. */
  sitzung: number;
  /** 'getrennt' ist für diese Sitzung schon gemeldet (genau einmal). */
  getrenntGemeldet: boolean;
  /** sendeDaten schreibt nicht, bis 'drain' kommt. */
  gestaut: boolean;
  /** Felder, zu denen schon eine Warnung „ungültiges Abo“ geschrieben wurde. */
  aboWarnungen: Set<string>;
}

interface RohEintrag {
  lauscher: string;
  angemeldet: boolean;
  sitzung: Sitzung | null;
  frist: ReturnType<typeof setTimeout>;
}

const istLoopback = (ip: string): boolean => ip.startsWith('127.') || ip === '::1';

/** Code einer Ausnahme fürs Log: err.code, sonst der Fehlertyp — nie die Meldung (wie wurfCode in client.ts). */
function wurfCode(e: unknown): string {
  const o = (typeof e === 'object' && e !== null ? e : {}) as { code?: unknown; name?: unknown };
  const roh = typeof o.code === 'string' && o.code ? o.code : typeof o.name === 'string' && o.name ? o.name : 'UNBEKANNT';
  return roh.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 40) || 'UNBEKANNT';
}

/**
 * TeilnehmerInfo kommt vom Netz (nach der Anmeldung sind Zeilen bis 1 MiB erlaubt) und darf nie ungekürzt in
 * Oberfläche und IPC: Text-Felder laufen durch kuerzeName (höchstens 60 Zeichen), Zusatzfelder fallen weg.
 */
function normiereTeilnehmer(i: TeilnehmerInfo): TeilnehmerInfo {
  return { art: i.art, appId: kuerzeName(i.appId), name: kuerzeName(i.name), version: kuerzeName(i.version), pid: i.pid };
}

export class MasterLinkServer extends EventEmitter {
  readonly fingerprint: string;
  private readonly o: ServerOptionen;
  private readonly f: Fristen;
  private readonly jetzt: () => number;
  private lauschAdressen: string[];
  private name: string;
  private laeuft = false;
  private readonly lauscher = new Map<string, TlsServer>();
  /** Alle TCP-Verbindungen in Annahme-Reihenfolge (Map behält sie) — auch vor dem TLS-Handshake. */
  private readonly roh = new Map<Socket, RohEintrag>();
  private readonly sitzungen = new Set<Sitzung>();
  private readonly teilnehmerMap = new Map<string, Sitzung>();
  private readonly fehlschlaege = new Map<string, number[]>();
  private pulsZeitgeber: ReturnType<typeof setInterval> | null = null;
  private fenster: { code: string; erzeugt: number; fehlversuche: number; verbraucht: boolean } | null = null;
  /** Teil 2b: letzte vergebene Sitzungs-Kennung (nie zurückgesetzt, auch nicht über stoppe()/starte()). */
  private sitzungsZaehler = 0;
  /** Teil 2b: angemeldete Sitzungen nach Kennung, bis 'getrennt' gemeldet ist. */
  private readonly nachKennung = new Map<number, Sitzung>();
  /** Zuletzt geloggter Wurf eines Zuhörers — je Ereignis und Code eine Zeile. */
  private wurfGeloggt: string | null = null;

  constructor(o: ServerOptionen) {
    super();
    this.o = o;
    this.f = mitFristen(o.fristen);
    this.jetzt = o.jetzt ?? Date.now;
    this.lauschAdressen = [...o.lauschAdressen];
    this.name = kuerzeName(o.identitaet.name); // Name steht in hallo/gekoppelt und in fremden Logs (Endprüfung A6)
    this.fingerprint = fingerprintVonPem(o.identitaet.zertifikat);
  }

  get gestartet(): boolean {
    return this.laeuft;
  }

  port(): number {
    for (const srv of this.lauscher.values()) {
      const a = srv.address();
      if (a && typeof a === 'object') return a.port;
    }
    return this.o.port ?? MASTER_PORT;
  }

  private zielPort(): number {
    const wunsch = this.o.port ?? MASTER_PORT;
    // Port 0 (Tests): alle Lauscher teilen den zuerst vergebenen Port.
    return wunsch === 0 && this.lauscher.size > 0 ? this.port() : wunsch;
  }

  async starte(): Promise<void> {
    if (this.laeuft) return;
    this.laeuft = true;
    try {
      for (const a of this.lauschAdressen) await this.oeffne(a);
    } catch (e) {
      await this.stoppe();
      throw e;
    }
    this.pulsZeitgeber = setInterval(() => this.pulse(), this.f.pulsMs);
    this.pulsZeitgeber.unref?.();
    this.emit('aenderung');
  }

  private oeffne(adresse: string): Promise<void> {
    const srv = createServer({
      key: this.o.identitaet.schluessel,
      cert: this.o.identitaet.zertifikat,
      handshakeTimeout: this.f.handshakeMs,
      minVersion: 'TLSv1.2',
    });
    srv.on('connection', (roh: Socket) => this.aufTcp(roh, adresse));
    srv.on('secureConnection', (ts: TLSSocket) => this.aufTls(ts));
    // GEMESSEN: handshakeTimeout meldet nur 'tlsClientError' — ohne destroy bliebe der Socket offen.
    srv.on('tlsClientError', (_e: Error, sock: TLSSocket) => sock.destroy());
    const port = this.zielPort();
    return new Promise<void>((fertig, fehler) => {
      srv.once('error', fehler);
      srv.listen(port, adresse, () => {
        srv.off('error', fehler);
        srv.on('error', (e: Error) => this.log('warn', `Lauscher ${adresse}: ${e.message}`));
        this.lauscher.set(adresse, srv);
        fertig();
      });
    });
  }

  private aufTcp(roh: Socket, lauscher: string): void {
    const eintrag: RohEintrag = {
      lauscher,
      angemeldet: false,
      sitzung: null,
      frist: setTimeout(() => this.anmeldefristAbgelaufen(roh), this.f.anmeldefristMs),
    };
    this.roh.set(roh, eintrag);
    roh.on('error', () => {
      /* Fehler landen auch am TLS-Socket; hier nur „unhandled error“ verhindern */
    });
    roh.on('close', () => {
      clearTimeout(eintrag.frist);
      this.roh.delete(roh);
    });
    const unangemeldet = [...this.roh.entries()].filter(([, e]) => !e.angemeldet);
    if (unangemeldet.length > GRENZEN.maxUnangemeldet) {
      // Opfer SOFORT austragen: sein 'close' kommt erst asynchron, bis dahin würde jede weitere Annahme
      // derselben Runde denselben, schon zerstörten Socket als „ältesten“ wählen (Ansturm ginge ungekappt durch).
      const [opfer, e] = unangemeldet[0];
      clearTimeout(e.frist);
      this.roh.delete(opfer);
      opfer.destroy();
    }
  }

  private aufTls(ts: TLSSocket): void {
    const roh = [...this.roh.keys()].find((r) => r.remotePort === ts.remotePort && r.remoteAddress === ts.remoteAddress);
    const eintrag = roh ? this.roh.get(roh) : undefined;
    if (!roh || !eintrag) {
      ts.destroy();
      return;
    }
    const s: Sitzung = {
      v: new Verbindung(ts, GRENZEN.vorAnmeldung),
      roh,
      nonce: randomNonce(),
      angemeldet: false,
      wartetAufTeilnehmer: false,
      ersteNachricht: true,
      rechnerId: null,
      info: null,
      schluessel: null,
      seit: this.jetzt(),
      letzteZeile: this.jetzt(),
      stille: null,
      sitzung: 0,
      getrenntGemeldet: false,
      gestaut: false,
      aboWarnungen: new Set<string>(),
    };
    eintrag.sitzung = s;
    this.sitzungen.add(s);
    s.v.on('nachricht', (n: Nachricht) => this.aufNachricht(s, n));
    s.v.on('unbekannt', () => this.zeileGesehen(s));
    s.v.on('ende', () => this.sitzungEnde(s));
    s.v.sende({ t: 'hallo', protokoll: PROTOKOLL, masterId: this.o.identitaet.masterId, name: this.name, nonce: s.nonce });
  }

  private anmeldefristAbgelaufen(roh: Socket): void {
    const e = this.roh.get(roh);
    if (!e || e.angemeldet) return;
    if (e.sitzung) this.lehneAb(e.sitzung, 'anmeldefrist');
    else roh.destroy();
  }

  private aufNachricht(s: Sitzung, n: Nachricht): void {
    // Nach stoppe(): endgültig still — eine späte Zeile aus einem alten Socket erreicht weder Speicher noch Sitzungen (A7).
    if (!this.laeuft) return;
    this.zeileGesehen(s);
    if (s.angemeldet) {
      if (n.t === 'teilnehmer' && s.info) {
        const info = normiereTeilnehmer(n.teilnehmer);
        if (info.appId === s.info.appId) {
          s.info = info;
          this.emit('aenderung');
        }
      } else if (n.t === 'abo') {
        this.aufAbo(s, n);
      }
      // stand/aenderung von einem Client wertet der Master nicht aus (Spec 22, G4).
      return;
    }
    if (s.wartetAufTeilnehmer) {
      if (n.t === 'teilnehmer' && s.rechnerId) {
        s.wartetAufTeilnehmer = false;
        this.meldeAn(s, s.rechnerId, n.teilnehmer);
      }
      return;
    }
    if (!s.ersteNachricht) return;
    s.ersteNachricht = false;
    if (n.t === 'anmelden') this.behandleAnmelden(s, n);
    else if (n.t === 'koppeln') this.behandleKoppeln(s, n);
    else s.v.schliesse();
  }

  private zeileGesehen(s: Sitzung): void {
    if (!this.laeuft) return;
    s.letzteZeile = this.jetzt();
    if (!s.angemeldet) return;
    if (s.stille) clearTimeout(s.stille);
    s.stille = setTimeout(() => s.v.socket.destroy(), this.f.stilleMs);
    this.merkeGesehen(s, false);
  }

  /** Spec 5.1: „zuletzt gesehen“ — beim Trennen sofort, sonst schreibt der Verbundspeicher höchstens alle 60 s. */
  private merkeGesehen(s: Sitzung, sofort: boolean): void {
    if (!s.rechnerId) return;
    const e = this.o.verbund.finde(s.rechnerId);
    this.o.verbund.gesehen(s.rechnerId, this.jetzt(), e?.dieserRechner ? null : s.v.adresse, sofort);
  }

  private behandleAnmelden(s: Sitzung, n: Extract<Nachricht, { t: 'anmelden' }>): void {
    if (n.protokoll !== PROTOKOLL) {
      this.lehneAb(s, 'protokoll', { master: PROTOKOLL, suite: this.o.suiteVersion });
      return;
    }
    const ip = s.v.adresse;
    const ausgenommen = (this.o.ratenAusnahme ?? istLoopback)(ip);
    if (!ausgenommen && this.zuVieleFehlschlaege(ip)) {
      this.lehneAb(s, 'last');
      return;
    }
    const e = this.o.verbund.finde(n.rechnerId);
    if (!e) {
      this.lehneAb(s, 'unbekannt');
      return;
    }
    if (!pruefeAnmeldung(e.schluessel, this.fingerprint, s.nonce, n.rechnerId, n.signatur)) {
      if (!ausgenommen) this.merkeFehlschlag(ip);
      this.lehneAb(s, 'signatur');
      return;
    }
    const name = kuerzeName(n.rechnerName);
    if (!e.dieserRechner && name !== e.name) this.o.verbund.setze({ ...e, name });
    this.meldeAn(s, n.rechnerId, n.teilnehmer);
  }

  private behandleKoppeln(s: Sitzung, n: Extract<Nachricht, { t: 'koppeln' }>): void {
    if (n.protokoll !== PROTOKOLL) {
      this.lehneAb(s, 'protokoll', { master: PROTOKOLL, suite: this.o.suiteVersion });
      return;
    }
    const f = this.fenster;
    if (!f) {
      this.lehneAb(s, 'keine-kopplung-offen');
      return;
    }
    if (!this.codeGueltig()) {
      this.lehneAb(s, 'code-ungueltig');
      return;
    }
    if (n.rechnerId === this.o.eigeneRechnerId) {
      this.lehneAb(s, 'rechner-id');
      return;
    }
    const d = { fp: this.fingerprint, ns: s.nonce, nc: n.nonce, rechnerId: n.rechnerId, schluessel: n.schluessel };
    if (!istEd25519Oeffentlich(n.schluessel) || !gleicherBeweis(slaveBeweis(f.code, d), n.beweis)) {
      f.fehlversuche++;
      this.emit('aenderung');
      this.lehneAb(s, 'code-falsch', { rest: Math.max(0, GRENZEN.maxFehlversuche - f.fehlversuche) });
      return;
    }
    f.verbraucht = true;
    // Neuer Schlüssel für diesen Rechner: bestehende Verbindungen mit dem alten sind ungültig.
    for (const alt of this.sitzungen) {
      if (alt !== s && alt.rechnerId === n.rechnerId) this.lehneAb(alt, 'signatur');
    }
    const jetzt = this.jetzt();
    this.o.verbund.setze({
      rechnerId: n.rechnerId,
      name: kuerzeName(n.rechnerName),
      schluessel: n.schluessel,
      gekoppeltAm: jetzt,
      zuletztGesehen: jetzt,
      letzteAdresse: s.v.adresse,
      dieserRechner: false,
    });
    s.rechnerId = n.rechnerId;
    s.wartetAufTeilnehmer = true;
    // Frist für 'teilnehmer' neu ansetzen: das Koppeln selbst hat schon Zeit verbraucht.
    const eintrag = this.roh.get(s.roh);
    if (eintrag) {
      clearTimeout(eintrag.frist);
      eintrag.frist = setTimeout(() => this.anmeldefristAbgelaufen(s.roh), this.f.anmeldefristMs);
    }
    s.v.sende({
      t: 'gekoppelt',
      masterId: this.o.identitaet.masterId,
      name: this.name,
      beweis: masterBeweis(f.code, d, this.o.identitaet.masterId),
      adressen: this.adressenFuerSlaves(),
    });
    this.emit('aenderung');
  }

  private codeGueltig(): boolean {
    const f = this.fenster;
    return !!f && !f.verbraucht && f.fehlversuche < GRENZEN.maxFehlversuche && this.jetzt() - f.erzeugt < this.f.codeGueltigMs;
  }

  /** Öffnet das Kopplungsfenster mit einem frischen Code (ein neuer Code ersetzt den alten). */
  oeffneKopplung(): KopplungsStand {
    this.fenster = { code: erzeugeCode(), erzeugt: this.jetzt(), fehlversuche: 0, verbraucht: false };
    this.emit('aenderung');
    return this.kopplungsStand();
  }

  neuerCode(): KopplungsStand {
    return this.oeffneKopplung();
  }

  schliesseKopplung(): void {
    this.fenster = null;
    this.emit('aenderung');
  }

  kopplungsStand(): KopplungsStand {
    const f = this.fenster;
    if (!f) return { offen: false, code: null, gueltigBis: null, rest: 0, ungueltig: false };
    const gueltig = this.codeGueltig();
    return {
      offen: true,
      code: gueltig ? f.code : null,
      gueltigBis: f.erzeugt + this.f.codeGueltigMs,
      rest: Math.max(0, GRENZEN.maxFehlversuche - f.fehlversuche),
      ungueltig: !gueltig,
    };
  }

  private meldeAn(s: Sitzung, rechnerId: string, netzInfo: TeilnehmerInfo): void {
    const info = normiereTeilnehmer(netzInfo);
    const schluessel = `${rechnerId}\u0000${info.appId}`;
    const alt = this.teilnehmerMap.get(schluessel);
    if (alt && alt !== s) {
      // Gleiche pid und Adresse = derselbe Prozess baut nach einem Aussetzer (WLAN) schnell neu auf — kein Klon-Verdacht (A7).
      const derselbe = alt.info?.pid === info.pid && alt.v.adresse === s.v.adresse;
      if (!derselbe && this.jetzt() - alt.letzteZeile < this.f.pulsMs) {
        this.warne(`Kennung ${kuerzeName(rechnerId.slice(0, 8))}…/${info.appId} doppelt aktiv (${alt.v.adresse}, ${s.v.adresse})`);
      }
      this.teilnehmerMap.delete(schluessel);
      alt.v.sende({ t: 'abgelehnt', grund: 'ersetzt' });
      alt.v.schliesse();
      // Teil 2b (Spec 13.6/13.7): sofort, noch vor 'angemeldet' an die neue Sitzung. Das Ende der alten (bis zu 200 ms
      // später) meldet nichts mehr — so trifft es nie das Abo der neuen.
      this.meldeGetrennt(alt);
    }
    s.angemeldet = true;
    s.sitzung = ++this.sitzungsZaehler;
    this.nachKennung.set(s.sitzung, s);
    s.rechnerId = rechnerId;
    s.info = info;
    s.schluessel = schluessel;
    s.seit = this.jetzt();
    const eintrag = this.roh.get(s.roh);
    if (eintrag) {
      eintrag.angemeldet = true;
      clearTimeout(eintrag.frist);
    }
    s.v.setzeGrenze(GRENZEN.nachAnmeldung);
    this.teilnehmerMap.set(schluessel, s);
    this.zeileGesehen(s);
    s.v.sende({ t: 'angemeldet', adressen: this.adressenFuerSlaves(), suite: this.o.suiteVersion });
    this.emit('aenderung');
  }

  private lehneAb(s: Sitzung, grund: Grund, extra: { rest?: number; master?: number; suite?: string } = {}): void {
    s.v.sende({ t: 'abgelehnt', grund, ...extra });
    s.v.schliesse();
  }

  private sitzungEnde(s: Sitzung): void {
    if (s.stille) clearTimeout(s.stille);
    this.sitzungen.delete(s);
    this.meldeGetrennt(s);
    if (s.schluessel && this.teilnehmerMap.get(s.schluessel) === s) {
      this.teilnehmerMap.delete(s.schluessel);
      this.merkeGesehen(s, true);
      this.emit('aenderung');
    }
  }

  private zuVieleFehlschlaege(ip: string): boolean {
    const grenze = this.jetzt() - this.f.ratenFensterMs;
    const liste = (this.fehlschlaege.get(ip) ?? []).filter((t) => t > grenze);
    this.fehlschlaege.set(ip, liste);
    return liste.length >= GRENZEN.ratenLimit;
  }

  private merkeFehlschlag(ip: string): void {
    const liste = this.fehlschlaege.get(ip) ?? [];
    liste.push(this.jetzt());
    this.fehlschlaege.set(ip, liste);
  }

  private pulse(): void {
    for (const s of this.teilnehmerMap.values()) s.v.sende({ t: 'puls' });
  }

  adressenFuerSlaves(): string[] {
    if (this.lauschAdressen.includes('0.0.0.0')) {
      return listeKarten((this.o.netzwerkKarten ?? networkInterfaces)()).flatMap((k) => k.adressen.map((a) => a.adresse));
    }
    return this.lauschAdressen.filter((a) => !istLoopback(a));
  }

  async setzeLauschAdressen(neu: string[]): Promise<void> {
    for (const a of [...this.lauscher.keys()]) {
      if (!neu.includes(a)) await this.schliesseLauscher(a);
    }
    if (!this.laeuft) {
      this.lauschAdressen = [...neu];
      return;
    }
    // Jede Adresse einzeln: scheitert die Karten-IP (belegt, DAD „tentativ“), lauscht 127.0.0.1 trotzdem (Spec 2, 4.3).
    // Geführt (und an Slaves genannt) werden nur tatsächlich gebundene Adressen; der erste Fehler geht danach an den
    // Aufrufer, dessen nächster Takt es erneut versucht (Endprüfung B1).
    let fehler: { e: unknown } | null = null;
    for (const a of neu) {
      if (this.lauscher.has(a)) continue;
      try {
        await this.oeffne(a);
      } catch (e) {
        fehler ??= { e };
      }
    }
    this.lauschAdressen = neu.filter((a) => this.lauscher.has(a));
    this.emit('aenderung');
    if (fehler) throw fehler.e;
  }

  private async schliesseLauscher(adresse: string): Promise<void> {
    const srv = this.lauscher.get(adresse);
    if (!srv) return;
    this.lauscher.delete(adresse);
    for (const [roh, e] of this.roh) if (e.lauscher === adresse) roh.destroy();
    await new Promise<void>((r) => srv.close(() => r()));
  }

  setzeName(name: string): void {
    this.name = kuerzeName(name);
    this.emit('aenderung');
  }

  teilnehmer(): TeilnehmerStand[] {
    const aus: TeilnehmerStand[] = [];
    for (const s of this.teilnehmerMap.values()) {
      if (!s.info || !s.rechnerId) continue;
      aus.push({ ...s.info, rechnerId: s.rechnerId, adresse: s.v.adresse, seit: s.seit, letzteZeile: s.letzteZeile, sitzung: s.sitzung });
    }
    return aus;
  }

  rechnerOnline(rechnerId: string): boolean {
    if (this.o.verbund.finde(rechnerId)?.dieserRechner) return this.laeuft;
    for (const s of this.teilnehmerMap.values()) if (s.rechnerId === rechnerId) return true;
    return false;
  }

  /** Spec 3.4: Schlüssel löschen UND offene Verbindungen sofort mit „unbekannt“ schließen. */
  entferne(rechnerId: string): void {
    const e = this.o.verbund.finde(rechnerId);
    if (!e || e.dieserRechner) return;
    this.o.verbund.entferne(rechnerId);
    for (const s of this.sitzungen) {
      if (s.rechnerId === rechnerId) this.lehneAb(s, 'unbekannt');
    }
    this.emit('aenderung');
  }

  /** Lauscher zu UND alle Sockets aktiv zerstören — server.close() allein ließe sie offen. */
  async stoppe(): Promise<void> {
    this.laeuft = false;
    if (this.pulsZeitgeber) {
      clearInterval(this.pulsZeitgeber);
      this.pulsZeitgeber = null;
    }
    for (const [roh, e] of this.roh) {
      clearTimeout(e.frist);
      roh.destroy();
    }
    for (const s of this.sitzungen) if (s.stille) clearTimeout(s.stille);
    // Spec 5.1: auch wenn der MASTER trennt (Aus, Neustart, Erneuern) — die close-Ereignisse kämen erst nach clear().
    // Ein Schreibvorgang für alle: nur der letzte Aufruf schreibt sofort, die übrigen stehen dann schon im Speicher.
    const getrennt = [...this.teilnehmerMap.values()];
    getrennt.forEach((s, i) => this.merkeGesehen(s, i === getrennt.length - 1));
    // Teil 2b (E4): 'getrennt' synchron je angemeldeter Sitzung; das spätere 'ende' der Sockets meldet nichts mehr.
    for (const s of this.sitzungen) this.meldeGetrennt(s);
    this.teilnehmerMap.clear();
    const alle = [...this.lauscher.values()];
    this.lauscher.clear();
    await Promise.all(alle.map((srv) => new Promise<void>((r) => srv.close(() => r()))));
    this.emit('aenderung');
  }

  /**
   * Teil 2b (Spec 13.6): eine fertige Zeile (kodiereStand) an eine angemeldete Sitzung. 'weg': unbekannt, ersetzt,
   * beendet oder Server gestoppt. Liegen schon mehr als GRENZEN.stauBytes im Schreibpuffer (socket.writableLength),
   * schreibt er nicht und liefert 'gestaut' — bis zum nächsten 'drain', dann kommt einmal 'entstaut(sitzung)' (E5).
   */
  sendeDaten(sitzung: number, zeile: string): SendeErgebnis {
    const s = this.nachKennung.get(sitzung);
    if (!this.laeuft || !s || s.getrenntGemeldet || !s.v.offen) return 'weg';
    if (s.gestaut) return 'gestaut';
    if (s.v.socket.writableLength > GRENZEN.stauBytes) {
      s.gestaut = true;
      s.v.socket.once('drain', () => this.aufDrain(s));
      return 'gestaut';
    }
    return s.v.sendeZeile(zeile) ? 'gesendet' : 'weg';
  }

  private aufDrain(s: Sitzung): void {
    if (!s.gestaut) return;
    s.gestaut = false;
    if (!this.laeuft || s.getrenntGemeldet || !s.v.offen) return;
    this.sendeEreignis('entstaut', s.sitzung);
  }

  /** Teil 2b (Spec 13.7, E2): nur ein gültiges abo wird gemeldet; ein ungültiges warnt einmal je Sitzung und Feld (E13). */
  private aufAbo(s: Sitzung, n: DatenZeile): void {
    if (!s.rechnerId || !s.info || !s.schluessel || s.getrenntGemeldet) return;
    const p = pruefeAbo(n);
    const eintrag = this.o.verbund.finde(s.rechnerId);
    if (!p.ok) {
      if (s.aboWarnungen.has(p.grund)) return;
      s.aboWarnungen.add(p.grund);
      this.warne(`Master-Link: ungültiges Abo von ${kuerzeName(eintrag?.name ?? s.rechnerId)}/${s.info.appId} (${p.grund}), ignoriert.`);
      return;
    }
    const t: TeilnehmerDaten = {
      sitzung: s.sitzung,
      schluessel: s.schluessel,
      rechnerId: s.rechnerId,
      art: s.info.art,
      appId: s.info.appId,
      dieserRechner: eintrag?.dieserRechner === true,
    };
    this.sendeEreignis('daten', t, p.wert);
  }

  /** Teil 2b (Spec 13.7): genau einmal je angemeldeter Sitzung — beim Ersetzen, beim Ende oder in stoppe(). */
  private meldeGetrennt(s: Sitzung): void {
    if (s.sitzung === 0 || s.getrenntGemeldet) return;
    s.getrenntGemeldet = true;
    this.nachKennung.delete(s.sitzung);
    this.sendeEreignis('getrennt', s.sitzung);
  }

  /** Ein werfender Zuhörer (Verteiler) darf weder den Socket-Handler noch meldeAn/stoppe() treffen. */
  private sendeEreignis(name: 'daten' | 'getrennt' | 'entstaut', ...werte: unknown[]): void {
    try {
      this.emit(name, ...werte);
    } catch (e) {
      const schluessel = `${name}/${wurfCode(e)}`;
      if (schluessel === this.wurfGeloggt) return;
      this.wurfGeloggt = schluessel;
      this.log('warn', `Master-Link: Zuhörer von „${name}“ warf (${wurfCode(e)}).`);
    }
  }

  private warne(text: string): void {
    this.log('warn', text);
    this.emit('warnung', text);
  }

  private log(stufe: 'info' | 'warn', text: string): void {
    this.o.log?.(stufe, text);
  }
}
